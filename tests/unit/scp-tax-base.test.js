/**
 * Regression lock for the SCP saved-TaxAmount invariant (re-cert P1, 2026-06-08).
 * `/invoice` (pages/js/invoice.js) TRUSTS the saved TaxAmount verbatim, so the saved value MUST tax
 * (base + shipping) — WA taxes shipping. A 3rd shipping-tax bug came from taxing base only. This test
 * loads the real ScreenPrintQuoteService, mocks fetch to capture the saved session + items, and asserts:
 *   - TaxAmount == round(rate * (TotalAmount + shippingFee), 2)   (shipping IS in the tax base)
 *   - a SHIP fee line item (StyleNumber='SHIP', EmbellishmentType='fee') is written
 *   - rate 0 (exempt / out-of-state / wholesale) => TaxAmount 0 even with shipping
 * Service is a browser global (no module.exports); loaded via Function injection like invoice-totals.test.js.
 */
const fs = require('fs');
const path = require('path');

function loadService(captured) {
  const code = fs.readFileSync(path.join(__dirname, '../../shared_components/js/screenprint-quote-service.js'), 'utf8');
  const win = { APP_CONFIG: { API: { BASE_URL: 'http://test' } } };
  const fetchMock = (url, opts) => {
    captured.push({ url: String(url), body: opts && opts.body ? JSON.parse(opts.body) : null });
    return Promise.resolve({ ok: true, status: 200, text: () => Promise.resolve(''), json: () => Promise.resolve({ PK_ID: 1, QuoteID: 'TEST-SCP' }) });
  };
  win.fetch = fetchMock;
  const doc = { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [] };
  const quietConsole = { log() {}, warn() {}, error() {}, info() {} };
  const mkStorage = () => { const m = {}; return { getItem: (k) => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, removeItem: (k) => { delete m[k]; }, clear: () => { Object.keys(m).forEach((k) => delete m[k]); } }; };
  // eslint-disable-next-line no-new-func
  const factory = new Function('window', 'document', 'fetch', 'console', 'sessionStorage', 'localStorage', code + '\nreturn window.ScreenPrintQuoteService;');
  return factory(win, doc, fetchMock, quietConsole, mkStorage(), mkStorage());
}

const baseQuote = (over) => Object.assign({
  grandTotal: 100, shippingFee: 30, taxRate: 10.1, totalQuantity: 24,
  items: [{ total: 100, quantity: 24, styleNumber: 'PC54', productName: 'Tee', unitPrice: 4.17, basePrice: 4.17, lineTotal: 100, sizeBreakdown: { M: 24 } }],
  customerName: 'Test Co', customerEmail: 't@x.com', printLocations: [], primaryColors: 1,
}, over || {});

describe('SCP saved TaxAmount invariant (re-cert P1 lock)', () => {
  test('service class loads from source', () => {
    expect(typeof loadService([])).toBe('function');
  });

  test('saved TaxAmount taxes (base + shipping), not base alone', async () => {
    const captured = [];
    const svc = new (loadService(captured))();
    await svc.saveQuote(baseQuote());
    const session = captured.find(c => c.url.includes('/api/quote_sessions'));
    expect(session).toBeTruthy();
    // 10.1% of (100 base + 30 shipping) = 13.13  (NOT 10.10 = base only)
    expect(session.body.TaxAmount).toBeCloseTo(13.13, 2);
    expect(session.body.TaxAmount).not.toBeCloseTo(10.10, 2);
  });

  test('a SHIP fee line item is written so the mirror foots', async () => {
    const captured = [];
    const svc = new (loadService(captured))();
    await svc.saveQuote(baseQuote());
    const ship = captured.find(c => c.url.includes('/api/quote_items') && c.body && c.body.StyleNumber === 'SHIP');
    expect(ship).toBeTruthy();
    expect(ship.body.EmbellishmentType).toBe('fee');
    expect(ship.body.LineTotal).toBeCloseTo(30, 2);
  });

  test('rate 0 (exempt / out-of-state / wholesale) => TaxAmount 0 even with shipping', async () => {
    const captured = [];
    const svc = new (loadService(captured))();
    await svc.saveQuote(baseQuote({ taxRate: 0 }));
    const session = captured.find(c => c.url.includes('/api/quote_sessions'));
    expect(session.body.TaxAmount).toBe(0);
  });

  test('no shipping => TaxAmount taxes base only (no SHIP row)', async () => {
    const captured = [];
    const svc = new (loadService(captured))();
    await svc.saveQuote(baseQuote({ shippingFee: 0 }));
    const session = captured.find(c => c.url.includes('/api/quote_sessions'));
    expect(session.body.TaxAmount).toBeCloseTo(10.10, 2);  // 10.1% of 100, no shipping
    const ship = captured.find(c => c.url.includes('/api/quote_items') && c.body && c.body.StyleNumber === 'SHIP');
    expect(ship).toBeFalsy();
  });
});
