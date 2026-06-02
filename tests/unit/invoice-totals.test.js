/**
 * Regression test for the SHARED invoice/PDF generator total math.
 * Guards the 2026-06-01 fix (workflow wp2s2j3as): the printed GRAND TOTAL must equal
 * the on-screen pre-tax subtotal + tax, with fees/discount folded in. Contract:
 *   - builders pass preTaxSubtotal = the on-screen pre-tax adjusted subtotal
 *   - GRAND TOTAL = (preTaxSubtotal || grandTotal) * (1 + taxRate)
 *   - taxRate normalized (a value > 1 is a percent -> /100)
 *   - includeTax === false suppresses tax entirely
 * The generator is a browser global with no module.exports, so we load it by
 * evaluating the file with window/document injected (environment-agnostic).
 */
const fs = require('fs');
const path = require('path');

function loadGenerator() {
  const code = fs.readFileSync(path.join(__dirname, '../../shared_components/js/embroidery-quote-invoice.js'), 'utf8');
  const win = {};
  const doc = { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [] };
  // eslint-disable-next-line no-new-func
  const factory = new Function('window', 'document', code + '\nreturn window.EmbroideryInvoiceGenerator;');
  return factory(win, doc);
}

function parseTotals(html) {
  const gt = [...html.matchAll(/GRAND TOTAL:<\/span>\s*<span>\$([\d,]+\.\d{2})<\/span>/g)];
  const grand = gt.length ? parseFloat(gt[gt.length - 1][1].replace(/,/g, '')) : null;
  const taxM = html.match(/Sales Tax \([\d.]+%\):<\/span>\s*<span>\$([\d,]+\.\d{2})<\/span>/);
  const tax = taxM ? parseFloat(taxM[1].replace(/,/g, '')) : 0;
  return { grand, tax };
}

const Generator = loadGenerator();
const CUST = { customerName: 'Test Co', salesRepEmail: '' };
const render = (pd) => parseTotals(new Generator().generateInvoiceHTML(pd, CUST));

describe('EmbroideryInvoiceGenerator total math (2026-06-01 PDF regression)', () => {
  test('class loads from the source file', () => {
    expect(typeof Generator).toBe('function');
  });
  test('folds fees + discount into GRAND TOTAL (they were display-only)', () => {
    const { grand, tax } = render({ quoteId: 'T1', grandTotal: 1000, preTaxSubtotal: 1100, artCharge: 75, graphicDesignCharge: 75, rushFee: 50, discount: 100, taxRate: 0.101, products: [] });
    expect(tax).toBeCloseTo(111.10, 2);
    expect(grand).toBeCloseTo(1211.10, 2);
  });
  test('no-fee quote is unchanged (backward compatible)', () => {
    const { grand, tax } = render({ quoteId: 'T2', grandTotal: 300, taxRate: 0.101, products: [] });
    expect(tax).toBeCloseTo(30.30, 2);
    expect(grand).toBeCloseTo(330.30, 2);
  });
  test('normalizes a PERCENT tax rate (SCP/DTF store 10.1, not 0.101)', () => {
    const { grand, tax } = render({ quoteId: 'T3', grandTotal: 510, preTaxSubtotal: 560, rushFee: 50, taxRate: 10.1, products: [] });
    expect(tax).toBeCloseTo(56.56, 2);
    expect(grand).toBeCloseTo(616.56, 2);
  });
  test('taxes the pre-tax base exactly ONCE (no double-tax)', () => {
    const { grand } = render({ quoteId: 'T4', grandTotal: 500, preTaxSubtotal: 500, taxRate: 0.101, products: [] });
    expect(grand).toBeCloseTo(550.50, 2);
  });
  test('includeTax=false adds no tax (tax-exempt)', () => {
    const { grand, tax } = render({ quoteId: 'T5', grandTotal: 1000, preTaxSubtotal: 1100, artCharge: 100, includeTax: false, taxRate: 0.101, products: [] });
    expect(tax).toBe(0);
    expect(grand).toBeCloseTo(1100.00, 2);
  });
  test('renders a Shipping row and folds it into the total (rows foot to GRAND TOTAL)', () => {
    // base 200 + art 50 + shipping 30 = 280 pre-tax; x1.101 = 308.28
    const html = new Generator().generateInvoiceHTML({
      quoteId: 'T6', grandTotal: 200, preTaxSubtotal: 280, artCharge: 50, shippingFee: 30,
      taxRate: 0.101, products: [],
    }, CUST);
    expect(html).toMatch(/Shipping:<\/span>\s*<span>\$30\.00<\/span>/);
    const { grand } = parseTotals(html);
    expect(grand).toBeCloseTo(308.28, 2);
  });
  test('GRAND TOTAL always equals (preTaxSubtotal || grandTotal) x (1 + normalizedRate)', () => {
    const cases = [
      { grandTotal: 1000, preTaxSubtotal: 1234.56, taxRate: 0.101 },
      { grandTotal: 800, taxRate: 0.088 },
      { grandTotal: 800, preTaxSubtotal: 900, taxRate: 0 },
      { grandTotal: 250, preTaxSubtotal: 250, taxRate: 8.8 },
    ];
    for (const c of cases) {
      const base = c.preTaxSubtotal != null ? c.preTaxSubtotal : c.grandTotal;
      const rate = c.taxRate > 1 ? c.taxRate / 100 : c.taxRate;
      const expected = +(base * (1 + rate)).toFixed(2);
      const { grand } = render({ quoteId: 'T', products: [], ...c });
      expect(grand).toBeCloseTo(expected, 2);
    }
  });
});

/**
 * Phase 3.1 — QuotePricingData contract. Locks the shape every builder must emit.
 * The generator is unchanged; the contract normalizes inputs (method→flags,
 * percent tax→decimal, zero-fills) so the same on-screen quote renders to the
 * same printed PDF regardless of which builder produced it.
 */
function loadContract() {
  const code = fs.readFileSync(path.join(__dirname, '../../shared_components/js/quote-pricing-data.js'), 'utf8');
  const win = {};
  // No `location` global in node — validator's isDevHost() falls back to false (prod = warn).
  new Function('window', code).call(null, win);
  return win.QuotePricingData;
}
const Contract = loadContract();

// Common quote fields so each test only states what it's varying.
const BASE = { quoteId: 'T', tier: '24-47', totalQuantity: 30, products: [],
               subtotal: 900, preTaxSubtotal: 900, grandTotal: 900, taxRate: 0 };

describe('QuotePricingData contract (Phase 3.1)', () => {
  test('loads from the source file', () => {
    expect(Contract.CONTRACT_VERSION).toBe('3.1.0');
    expect(typeof Contract.buildPricingData).toBe('function');
  });
  test('rejects unknown method', () => {
    expect(() => Contract.buildPricingData({ ...BASE, method: 'XYZ' })).toThrow();
    expect(() => Contract.buildPricingData({ ...BASE })).toThrow(); // missing method
  });
  test('derives isDTG/isScreenprint/isDTF from method', () => {
    expect(Contract.buildPricingData({ ...BASE, method: 'DTG' })).toMatchObject({ isDTG: true, isScreenprint: false, isDTF: false });
    expect(Contract.buildPricingData({ ...BASE, method: 'EMB' })).toMatchObject({ isDTG: false, isScreenprint: false, isDTF: false });
    expect(Contract.buildPricingData({ ...BASE, method: 'SCP' })).toMatchObject({ isDTG: false, isScreenprint: true, isDTF: false });
    expect(Contract.buildPricingData({ ...BASE, method: 'DTF' })).toMatchObject({ isDTG: false, isScreenprint: false, isDTF: true });
  });
  test('normalizes percent tax → decimal (10.1 → 0.101)', () => {
    expect(Contract.buildPricingData({ ...BASE, method: 'SCP', taxRate: 10.1 }).taxRate).toBeCloseTo(0.101, 4);
    expect(Contract.buildPricingData({ ...BASE, method: 'EMB', taxRate: '10.1' }).taxRate).toBeCloseTo(0.101, 4);
    expect(Contract.buildPricingData({ ...BASE, method: 'DTG', taxRate: 0.088 }).taxRate).toBeCloseTo(0.088, 4);
    expect(Contract.buildPricingData({ ...BASE, method: 'DTF', taxRate: '' }).taxRate).toBe(0);
  });
  test('zero-fills missing fee fields (DTG inline-form ships sparse)', () => {
    const pd = Contract.buildPricingData({ ...BASE, method: 'DTG' });
    ['artCharge', 'graphicDesignCharge', 'rushFee', 'discount', 'setupFees',
     'shippingFee', 'safetyStripesTotal', 'ltmFee'].forEach(k => expect(pd[k]).toBe(0));
  });
  test('grandTotal defaults to preTaxSubtotal when missing', () => {
    const pd = Contract.buildPricingData({ ...BASE, method: 'EMB', grandTotal: undefined, preTaxSubtotal: 777 });
    expect(pd.grandTotal).toBe(777);
  });
  test('includeTax defaults to true; explicit false honored', () => {
    expect(Contract.buildPricingData({ ...BASE, method: 'EMB' }).includeTax).toBe(true);
    expect(Contract.buildPricingData({ ...BASE, method: 'EMB', includeTax: false }).includeTax).toBe(false);
  });
  test('warns (prod) on missing required fields, does not throw', () => {
    const origWarn = console.warn;
    const warnings = [];
    console.warn = (m) => warnings.push(m);
    try {
      // No `location` in node → validator treats as prod → warn-only.
      const pd = Object.assign({}, BASE); delete pd.tier; pd.method = 'EMB';
      // Bypass buildPricingData (it would set defaults) — call validator directly.
      Contract.validatePricingData(pd);
      expect(warnings.length).toBe(1);
      expect(warnings[0]).toMatch(/missing: tier/);
    } finally {
      console.warn = origWarn;
    }
  });
  test('contract output renders to the same GRAND TOTAL as a hand-built pricingData (EMB, percent tax)', () => {
    const handBuilt = { ...BASE, quoteId: 'EMB1', tier: '24-47', totalQuantity: 30, subtotal: 900,
                        grandTotal: 1000, preTaxSubtotal: 1075, includeTax: true, taxRate: 10.1,
                        artCharge: 75, setupFees: 100, ltmFee: 0, ltmDistributed: true };
    const contracted = Contract.buildPricingData({ method: 'EMB', ...handBuilt });
    expect(render(handBuilt).grand).toBeCloseTo(render(contracted).grand, 2);
  });
  test('contract output renders to the same GRAND TOTAL as a hand-built pricingData (DTG, decimal tax)', () => {
    const handBuilt = { quoteId: 'DTG1', isDTG: true, tier: 'Standard', totalQuantity: 12,
                        products: [], subtotal: 240, grandTotal: 240, preTaxSubtotal: 240,
                        taxRate: 0.101, ltmDistributed: true, ltmFee: 0, shippingFee: 0 };
    const contracted = Contract.buildPricingData({ method: 'DTG', quoteId: 'DTG1', tier: 'Standard',
                        totalQuantity: 12, products: [], subtotal: 240, grandTotal: 240,
                        preTaxSubtotal: 240, taxRate: 0.101, ltmDistributed: true, ltmFee: 0 });
    expect(render(handBuilt).grand).toBeCloseTo(render(contracted).grand, 2);
  });
  test('dead garmentLtmFee/capLtmFee are no longer rendered (3.1 cleanup)', () => {
    // Even if a stale caller still passes them, the generator must not render them.
    const html = new Generator().generateInvoiceHTML({
      quoteId: 'T', products: [], grandTotal: 500, preTaxSubtotal: 500, taxRate: 0.101,
      garmentLtmFee: 99.99, capLtmFee: 88.88, ltmDistributed: false,
    }, CUST);
    expect(html).not.toMatch(/Less Than Minimum Fee - Garments/);
    expect(html).not.toMatch(/Less Than Minimum Fee - Caps/);
  });
});
