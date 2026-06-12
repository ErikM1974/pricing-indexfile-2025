/**
 * Embroidery save parity — 2026-06-11 sibling sweep of the DTF audit fix.
 *
 * The DTF audit found saveAndGetLink built quote_items from a hardcoded
 * ['2XL'..'6XL'] size list, silently dropping every other popup size (XS, talls,
 * youth, 7XL+) from quote_items while still charging them in the session totals
 * — quote-view didn't foot and the ShopWorks push under-billed. CLAUDE.md Rule 8:
 * sweep the other builders.
 *
 * EMB's save path was verified CLEAN in the sweep: collectProductsFromTable
 * iterates actual child rows, the pricing engine groups Object.entries(
 * product.sizeBreakdown) by API upcharge (no hardcoded list), and the service
 * writes one quote_items row per engine lineItem. This test LOCKS that pipeline
 * at the service layer: every lineItem — including an XS group and a tall (LT)
 * group, both outside the legacy 2XL-6XL list — becomes a quote_items row whose
 * SizeBreakdown round-trips, and the product rows foot to SubtotalAmount.
 *
 * Uses the same source-loading harness as dtf-save-parity.test.js.
 */
const fs = require('fs');
const path = require('path');

function loadService(captured) {
  const code = fs.readFileSync(path.join(__dirname, '../../shared_components/js/embroidery-quote-service.js'), 'utf8');
  const win = { APP_CONFIG: { API: { BASE_URL: 'http://test/api' } } };
  const fetchMock = (url, opts) => {
    const u = String(url);
    captured.push({ url: u, method: (opts && opts.method) || 'GET', body: opts && opts.body ? JSON.parse(opts.body) : null });
    const json = u.includes('/api/quote-sequence/')
      ? { prefix: 'EMB', year: 2026, sequence: 307 }
      : u.includes('/api/quote_items?') ? [] : {};
    return Promise.resolve({ ok: true, status: 200, text: () => Promise.resolve(''), json: () => Promise.resolve(json) });
  };
  win.fetch = fetchMock;
  const doc = { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [] };
  const quietConsole = { log() {}, warn() {}, error() {}, info() {} };
  const mkStorage = () => { const m = {}; return { getItem: (k) => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, removeItem: (k) => { delete m[k]; }, clear: () => { Object.keys(m).forEach((k) => delete m[k]); }, length: 0, key: () => null }; };
  const emailjsStub = { init() {}, send: () => Promise.resolve({ status: 200 }) };
  win.emailjs = emailjsStub;
  // eslint-disable-next-line no-new-func
  const factory = new Function('window', 'document', 'fetch', 'console', 'sessionStorage', 'localStorage', 'emailjs', code + '\nreturn window.EmbroideryQuoteService;');
  return factory(win, doc, fetchMock, quietConsole, mkStorage(), mkStorage(), emailjsStub);
}

/** pricingResults shaped the way the pricing engine emits it: per-product
 *  lineItems already split into base + per-upcharge size groups. The XS and LT
 *  groups are the ones the DTF-class bug dropped. */
const basePricing = (over) => Object.assign({
  products: [{
    product: {
      style: 'PC54', title: 'Port & Company Core Cotton Tee',
      color: 'Navy', colorCode: 'Navy', catalogColor: 'Navy',
      totalQuantity: 23, imageUrl: '', sellPriceOverride: 0, sizeOverrides: {},
    },
    lineItems: [
      { description: 'S(6) M(6) L(6)', quantity: 18, unitPrice: 24.5, basePrice: 24.5, total: 441 },
      { description: 'XS(2)', quantity: 2, unitPrice: 24.5, basePrice: 24.5, total: 49, hasUpcharge: true },
      { description: 'LT(3)', quantity: 3, unitPrice: 27.5, basePrice: 27.5, total: 82.5, hasUpcharge: true },
    ],
  }],
  logos: [{ id: 'primary', isPrimary: true, position: 'Left Chest', positionCode: 'LC', stitchCount: 8000, needsDigitizing: false }],
  tier: '8-23',
  totalQuantity: 23,
  garmentQuantity: 23,
  capQuantity: 0,
  subtotal: 572.5,
  grandTotal: 572.5,
  ltmFee: 0,
  setupFees: 0,
  garmentSetupFees: 0,
  capSetupFees: 0,
  garmentStitchTotal: 0,
  capStitchTotal: 0,
  additionalStitchTotal: 0,
  additionalServices: [],
  decgItems: [],
  manualServiceItems: [],
}, over || {});

const baseCustomer = (over) => Object.assign({
  email: 'brad@acme.com', name: 'Brad Wright', company: 'Acme Co',
  salesRepEmail: 'sales@nwcustomapparel.com', salesRepName: 'General Sales',
  artCharge: 0, graphicDesignHours: 0, graphicDesignCharge: 0,
  rushFee: 0, sampleFee: 0, sampleQty: 0,
  discount: 0, discountPercent: 0, discountReason: '',
  taxRate: 0.101, taxAmount: 57.82,
}, over || {});

describe('EMB save parity — every engine lineItem reaches quote_items', () => {
  test('XS and LT groups (outside the legacy 2XL-6XL list) persist and foot to SubtotalAmount', async () => {
    const captured = [];
    const svc = new (loadService(captured))();
    const result = await svc.saveQuote({}, baseCustomer(), basePricing());
    expect(result.success).toBe(true);

    const items = captured.filter(c => c.url.includes('/quote_items') && c.method === 'POST' && c.body && c.body.EmbellishmentType === 'embroidery');
    expect(items.length).toBe(3);

    const xs = items.find(i => JSON.parse(i.body.SizeBreakdown).XS);
    expect(xs).toBeTruthy();
    expect(xs.body.Quantity).toBe(2);
    expect(xs.body.LineTotal).toBeCloseTo(49, 2);

    const lt = items.find(i => JSON.parse(i.body.SizeBreakdown).LT);
    expect(lt).toBeTruthy();
    expect(lt.body.Quantity).toBe(3);
    expect(lt.body.FinalUnitPrice).toBeCloseTo(27.5, 2);
    expect(lt.body.LineTotal).toBeCloseTo(82.5, 2);

    // product rows foot to the session subtotal (the DTF under-billing class)
    const lineSum = items.reduce((s, i) => s + i.body.LineTotal, 0);
    const session = captured.find(c => c.url.includes('/quote_sessions') && c.method === 'POST');
    expect(lineSum).toBeCloseTo(session.body.SubtotalAmount, 2);
    expect(session.body.SubtotalAmount).toBeCloseTo(572.5, 2);
  });

  test('ColorCode persists CATALOG_COLOR on every garment row', async () => {
    const captured = [];
    const svc = new (loadService(captured))();
    await svc.saveQuote({}, baseCustomer(), basePricing());

    const items = captured.filter(c => c.url.includes('/quote_items') && c.method === 'POST' && c.body && c.body.EmbellishmentType === 'embroidery');
    expect(items.length).toBeGreaterThan(0);
    for (const i of items) expect(i.body.ColorCode).toBe('Navy');
  });
});
