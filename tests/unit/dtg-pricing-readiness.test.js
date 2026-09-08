/** Real DTG pricing module with controlled bundle responses; no network or writes. */
const fs = require('fs');
const path = require('path');
const esbuild = require('esbuild');

function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}
function row(over = {}) {
  return { id: 'one', style: 'PC54', color: 'Black', catalogColor: 'Black', sizes: { M: 24 }, availableSizes: ['M'], ...over };
}
function loadPricing(rows = [row()]) {
  const state = { rows, front: 'LC', back: '', shipping: { taxRate: 0 }, customer: {} };
  const dtgIF = {};
  const bundle = { tiers: [{ TierLabel: 'test', LTM_Fee: 0 }] };
  const fetchPricingData = jest.fn(() => Promise.resolve(bundle));
  const doc = { getElementById: () => null, createElement: () => ({ setAttribute() {}, style: {} }) };
  const deps = {
    './state.js': { state, dtgIF, _bundleCache: new Map() },
    './form-core.js': {
      effectiveLocationCode: () => state.back ? state.front + '_' + state.back : state.front,
      effectiveLocationLabel: () => state.front,
      isRowColorInvalid: r => !!(r.colorsAvailable?.length && !r.catalogColor),
      renderTable: jest.fn(), renderBand: jest.fn(), syncDueDateFromQty() {}, updateArtFeeDisplay() {}, updateSubmitEnabled: jest.fn(),
    },
    './fees.js': { artFeeTotals: () => ({ total: 0, artCharge: 0, graphicDesignCharge: 0 }) },
    './tax-shipping.js': { effectiveShipFee: () => 0 },
    './utils.js': {}, '../shared/errors.js': { showFallbackPricingWarning: jest.fn() },
  };
  const win = {
    DTGCanonicalPricing: { ltmPerUnit: () => 0 },
    DTGPricingService: class {
      fetchPricingData(style) { return fetchPricingData(style); }
      getTierForQuantity() { return bundle.tiers[0]; }
      calculateAllLocationPrices(_bundle, quantity) {
        return { LC: { M: { test: quantity >= 48 ? 8 : 10 }, L: { test: 11 } }, FF: { M: { test: 12 } } };
      }
    },
  };
  const source = fs.readFileSync(path.join(__dirname, '../../shared_components/js/builders/dtg/pricing.js'), 'utf8');
  const code = esbuild.transformSync(source, { format: 'cjs', target: 'es2020' }).code;
  const moduleObj = { exports: {} };
  // eslint-disable-next-line no-new-func
  new Function('require', 'module', 'exports', 'window', 'document', 'console', code)(
    name => { if (!deps[name]) throw new Error('Unexpected dependency: ' + name); return deps[name]; },
    moduleObj, moduleObj.exports, win, doc, { error() {}, warn() {} },
  );
  return { ...moduleObj.exports, state, dtgIF, bundle, fetchPricingData };
}

describe('DTG complete and current pricing', () => {
  afterEach(() => jest.useRealTimers());
  test('pending bundle cannot produce a saveable quote; completion enables it', async () => {
    const mod = loadPricing(); const pending = deferred();
    mod.fetchPricingData.mockReturnValueOnce(pending.promise);
    const run = mod.updateLivePrices();
    expect(mod.getPricingReadiness()).toMatchObject({ hasRows: true, ready: false });
    expect(() => mod.assertPricingReady()).toThrow(/loading/);
    pending.resolve(mod.bundle); await run;
    expect(mod.getPricingReadiness().ready).toBe(true);
    expect(mod.computePriceQuoteFromState().subtotal).toBe(240);
  });
  test('every row must finish, even when the first has positive dollars', async () => {
    const mod = loadPricing([row(), row({ id: 'two', style: 'PC61' })]); const pending = deferred();
    mod.fetchPricingData.mockImplementation(style => style === 'PC61' ? pending.promise : Promise.resolve(mod.bundle));
    const run = mod.updateLivePrices(); await Promise.resolve(); await Promise.resolve();
    expect(mod.getPricingReadiness().ready).toBe(false);
    pending.resolve(mod.bundle); await run;
    expect(mod.getPricingReadiness().ready).toBe(true);
    expect(mod.computePriceQuoteFromState().subtotal).toBe(384);
  });
  test('unsupported positive size cannot hide behind another priced size', async () => {
    const mod = loadPricing([row({ sizes: { M: 24, '6XL': 1 }, availableSizes: ['M', '6XL'] })]);
    await mod.updateLivePrices();
    expect(mod.state.rows[0]._lineTotal).toBeGreaterThan(0);
    expect(mod.getPricingReadiness().ready).toBe(false);
    expect(() => mod.assertPricingReady()).toThrow(/every product/);
  });
  test('invalid catalog color and unfinished second row block the entire quote', async () => {
    const mod = loadPricing([row(), row({ id: 'two', color: '', sizes: {} })]);
    await mod.updateLivePrices(); expect(mod.getPricingReadiness().ready).toBe(false);
    mod.state.rows.pop(); await mod.updateLivePrices(); expect(mod.getPricingReadiness().ready).toBe(true);
    mod.state.rows[0].catalogColor = ''; mod.state.rows[0].colorsAvailable = [{}];
    expect(mod.getPricingReadiness().ready).toBe(false);
  });
  test('a quantity edit invalidates pricing immediately, before debounce runs', async () => {
    jest.useFakeTimers(); const mod = loadPricing();
    await mod.updateLivePrices(); expect(mod.getPricingReadiness().ready).toBe(true);
    mod.state.rows[0].sizes.M = 48; mod.schedulePriceUpdate();
    expect(mod.getPricingReadiness().ready).toBe(false);
    clearTimeout(mod.dtgIF._priceTimer);
    await mod.updateLivePrices();
    expect(mod.computePriceQuoteFromState().subtotal).toBe(384);
    expect(mod.getPricingReadiness().ready).toBe(true);
  });
  test('late old response cannot overwrite a newer location and quantity calculation', async () => {
    const mod = loadPricing(); const first = deferred(); const second = deferred();
    mod.fetchPricingData.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const oldRun = mod.updateLivePrices();
    mod.state.front = 'FF'; mod.state.rows[0].sizes.M = 48;
    const newRun = mod.updateLivePrices(); second.resolve(mod.bundle); await newRun;
    expect(mod.computePriceQuoteFromState().subtotal).toBe(576);
    first.resolve(mod.bundle); await oldRun;
    expect(mod.getPricingReadiness().ready).toBe(true);
    expect(mod.computePriceQuoteFromState().subtotal).toBe(576);
  });
  test('failed bundle stays blocked; an explicit recalculation can recover', async () => {
    const mod = loadPricing(); mod.fetchPricingData.mockRejectedValueOnce(new Error('offline'));
    await mod.updateLivePrices(); expect(mod.getPricingReadiness().ready).toBe(false);
    await mod.updateLivePrices(); expect(mod.getPricingReadiness().ready).toBe(true);
  });
  test('save snapshot size maps cannot change while quote ID allocation awaits', async () => {
    const mod = loadPricing(); await mod.updateLivePrices();
    const quote = mod.computePriceQuoteFromState();
    mod.state.rows[0].sizes.M = 72; mod.state.rows[0]._priceBySize.M = 1;
    expect(quote.lineItems[0].sizes).toEqual({ M: 24 });
    expect(quote.lineItems[0].priceBySize).toEqual({ M: 10 });
    expect(quote.subtotal).toBe(240);
  });
  test('an unused blank row does not invalidate a completed quote', async () => {
    const mod = loadPricing(); await mod.updateLivePrices();
    mod.state.rows.push(row({ id: 'blank', style: '', color: '', sizes: {} }));
    expect(mod.getPricingReadiness().ready).toBe(true);
  });
  test('mixed sizes use their own prices, not the rounded weighted unit price', async () => {
    const mod = loadPricing([row({ sizes: { M: 1, L: 2 }, availableSizes: ['M', 'L'] })]);
    await mod.updateLivePrices();
    expect(mod.getPricingReadiness().ready).toBe(true);
    expect(mod.computePriceQuoteFromState()).toMatchObject({ subtotal: 32, lineItems: [{ finalUnitPrice: 10.67 }] });
  });
  test('empty form remains distinct from an entered, unpriced form', () => {
    const mod = loadPricing([]);
    expect(mod.assertPricingReady()).toMatchObject({ hasRows: false, ready: false });
  });
});
