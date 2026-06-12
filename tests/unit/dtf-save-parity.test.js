/**
 * Regression lock for the 2026-06-11 DTF audit fixes (save path).
 *
 * Locks three behaviors the audit found broken:
 *   1. EVERY sizeGroup the builder sends becomes a quote_items row — including
 *      popup sizes outside 2XL-6XL (XS, talls, youth). The old builder loop
 *      dropped them from quote_items while still charging them in the session
 *      totals, so quote-view didn't foot and the ShopWorks push under-billed.
 *      (The builder now emits one group per actual child row; this test pins the
 *      service writing a row per group, XS included.)
 *   2. quote_items.ColorCode is the CATALOG_COLOR (sizeGroup.catalogColor →
 *      product.catalogColor chain) — the old read saved '' and the push fell
 *      back to display COLOR_NAME ("Unable to verify" bug class).
 *   3. Notes JSON carries shipToName + includeTax + the pricingMetadata snapshot
 *      (the old reads were always undefined / never persisted).
 *
 * Uses the same source-loading harness as dtf-tax-base.test.js.
 */
const fs = require('fs');
const path = require('path');

function loadService(captured) {
  const code = fs.readFileSync(path.join(__dirname, '../../shared_components/js/dtf-quote-service.js'), 'utf8');
  const win = { APP_CONFIG: { API: { BASE_URL: 'http://test/api' } } };
  const fetchMock = (url, opts) => {
    captured.push({ url: String(url), body: opts && opts.body ? JSON.parse(opts.body) : null });
    return Promise.resolve({ ok: true, status: 200, text: () => Promise.resolve(''), json: () => Promise.resolve({ PK_ID: 1, QuoteID: 'TEST-DTF' }) });
  };
  win.fetch = fetchMock;
  const doc = { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [] };
  const quietConsole = { log() {}, warn() {}, error() {}, info() {} };
  const mkStorage = () => { const m = {}; return { getItem: (k) => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, removeItem: (k) => { delete m[k]; }, clear: () => { Object.keys(m).forEach((k) => delete m[k]); }, length: 0, key: () => null }; };
  // eslint-disable-next-line no-new-func
  const factory = new Function('window', 'document', 'fetch', 'console', 'sessionStorage', 'localStorage', code + '\nreturn window.DTFQuoteService;');
  return factory(win, doc, fetchMock, quietConsole, mkStorage(), mkStorage());
}

/** Quote payload shaped the way the FIXED saveAndGetLink builds it:
 *  one standard group + one XS child group + one 3XL child group. */
const baseQuote = (over) => Object.assign({
  quoteId: 'DTF0611-77',
  customerName: 'Brad Wright', customerEmail: 'brad@acme.com', companyName: 'Acme Co',
  selectedLocations: ['left-chest', 'full-back'],
  totalQuantity: 23,
  subtotal: 917.5,      // 711 (std) + 127.50 (3XL) + 79 (XS)
  preTaxSubtotal: 917.5,
  taxRate: 10.1, includeTax: true,
  shippingFee: 0,
  tierLabel: '10-23',
  shipToName: 'Receiving Dock — Brad',
  pricingMetadata: {
    tier: '10-23', marginDenominator: 0.55, laborCostPerLocation: 2.5,
    freightPerTransfer: 0.5, ltmPerUnit: 2.17, totalLtmFee: 50,
    transferBreakdown: { breakdown: [{ location: 'left-chest', unitCost: 6.5 }, { location: 'full-back', unitCost: 15 }], total: 21.5 },
  },
  products: [{
    styleNumber: 'ST350', productName: 'Sport-Tek Competitor Tee', description: 'Sport-Tek Competitor Tee',
    color: 'Brilliant Orange', catalogColor: 'BrillOrng',
    baseCost: 5.16, sizeUpcharges: { '3XL': 3 },
    quantities: { M: 6, L: 6, XL: 6, '3XL': 3, XS: 2 },
    sizeGroups: [
      { sizes: { M: 6, L: 6, XL: 6 }, quantity: 18, unitPrice: 39.5, total: 711, effectiveCost: 5.16, color: 'Brilliant Orange', catalogColor: 'BrillOrng', imageUrl: '' },
      { sizes: { '3XL': 3 }, quantity: 3, unitPrice: 42.5, total: 127.5, effectiveCost: 8.16, color: 'Brilliant Orange', catalogColor: 'BrillOrng', imageUrl: '' },
      { sizes: { XS: 2 }, quantity: 2, unitPrice: 39.5, total: 79, effectiveCost: 5.16, color: 'Brilliant Orange', catalogColor: 'BrillOrng', imageUrl: '' },
    ],
  }],
}, over || {});

describe('DTF save parity — 2026-06-11 audit locks', () => {
  test('every sizeGroup becomes a quote_items row — XS (outside 2XL-6XL) included', async () => {
    const captured = [];
    const svc = new (loadService(captured))();
    await svc.saveQuote(baseQuote());

    const items = captured.filter(c => c.url.includes('/quote_items') && c.body && c.body.EmbellishmentType === 'dtf');
    expect(items.length).toBe(3);

    const xsRow = items.find(i => JSON.parse(i.body.SizeBreakdown).XS);
    expect(xsRow).toBeTruthy();
    expect(xsRow.body.Quantity).toBe(2);
    expect(xsRow.body.LineTotal).toBeCloseTo(79, 2);

    // items foot to the session subtotal (the under-billing the audit caught)
    const lineSum = items.reduce((s, i) => s + i.body.LineTotal, 0);
    const session = captured.find(c => c.url.includes('/quote_sessions'));
    expect(lineSum).toBeCloseTo(session.body.SubtotalAmount, 2);
  });

  test('ColorCode persists CATALOG_COLOR on every garment row (never blank/display name)', async () => {
    const captured = [];
    const svc = new (loadService(captured))();
    await svc.saveQuote(baseQuote());

    const items = captured.filter(c => c.url.includes('/quote_items') && c.body && c.body.EmbellishmentType === 'dtf');
    expect(items.length).toBeGreaterThan(0);
    for (const i of items) {
      expect(i.body.ColorCode).toBe('BrillOrng');
      expect(i.body.Color).toBe('Brilliant Orange'); // display stays COLOR_NAME
    }
  });

  test('Notes JSON round-trips shipToName, includeTax, and the pricingMetadata snapshot', async () => {
    const captured = [];
    const svc = new (loadService(captured))();
    await svc.saveQuote(baseQuote({ includeTax: false }));

    const session = captured.find(c => c.url.includes('/quote_sessions'));
    const notes = JSON.parse(session.body.Notes);
    expect(notes.shipToName).toBe('Receiving Dock — Brad');
    expect(notes.includeTax).toBe(false);
    expect(notes.marginDenominator).toBeCloseTo(0.55, 4);
    expect(notes.laborPerLocation).toBeCloseTo(2.5, 4);
    expect(notes.freightPerLocation).toBeCloseTo(0.5, 4);
    expect(notes.transferBreakdown && notes.transferBreakdown.total).toBeCloseTo(21.5, 2);
  });

  test('includeTax=false saves TaxAmount 0 while keeping the real rate', async () => {
    const captured = [];
    const svc = new (loadService(captured))();
    await svc.saveQuote(baseQuote({ includeTax: false }));
    const session = captured.find(c => c.url.includes('/quote_sessions'));
    expect(session.body.TaxAmount).toBe(0);
    expect(session.body.TaxRate).toBeCloseTo(10.1, 2);
  });
});
