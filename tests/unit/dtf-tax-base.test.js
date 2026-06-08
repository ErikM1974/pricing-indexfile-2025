/**
 * Regression lock for the DTF saved invoice/tax invariant (2026-06-08 polish).
 * DTF now writes TotalAmount/SubtotalAmount EXCLUDING shipping + a separate SHIP fee line item (like SCP), while
 * still taxing the shipping-inclusive base — so /invoice (which trusts the saved TaxAmount and re-adds shipping via
 * the SHIP row) foots with NO double-count and shows a Shipping line. This test loads the real DTFQuoteService,
 * mocks fetch, and asserts:
 *   - TotalAmount == SubtotalAmount == base (preTaxSubtotal − shippingFee)
 *   - TaxAmount == round(rate * preTaxSubtotal, 2)   (shipping IS in the tax base)
 *   - a SHIP fee item (StyleNumber='SHIP', EmbellishmentType='fee', LineTotal=shipping) is written
 *   - subtotalNet + SHIP + tax foots to the grand total (no double-count)
 *   - no shipping => no SHIP row, TotalAmount = base
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

const baseQuote = (over) => Object.assign({
  preTaxSubtotal: 130, subtotal: 100, shippingFee: 30, taxRate: 10.1, includeTax: true, totalQuantity: 24,
  products: [{ styleNumber: 'PC54', productName: 'Tee', color: 'Black', quantities: { M: 24 }, totalQuantity: 24, unitPrice: 4.17, lineTotal: 100 }],
  customerName: 'Test Co', customerEmail: 't@x.com', selectedLocations: [],
}, over || {});

describe('DTF saved invoice/tax invariant (shipping excluded from TotalAmount, in tax base, SHIP row)', () => {
  test('service class loads from source', () => {
    expect(typeof loadService([])).toBe('function');
  });

  test('TotalAmount EXCLUDES shipping; TaxAmount taxes base+shipping; SHIP row written; foots with no double-count', async () => {
    const captured = [];
    const svc = new (loadService(captured))();
    await svc.saveQuote(baseQuote());
    const session = captured.find(c => c.url.includes('/quote_sessions'));
    expect(session).toBeTruthy();
    expect(session.body.TotalAmount).toBeCloseTo(100, 2);     // 130 preTaxAllIn − 30 shipping
    expect(session.body.SubtotalAmount).toBeCloseTo(100, 2);
    expect(session.body.TaxAmount).toBeCloseTo(13.13, 2);     // 10.1% of (100 + 30) — shipping IS taxed
    const ship = captured.find(c => c.url.includes('/quote_items') && c.body && c.body.StyleNumber === 'SHIP');
    expect(ship).toBeTruthy();
    expect(ship.body.EmbellishmentType).toBe('fee');
    expect(ship.body.LineTotal).toBeCloseTo(30, 2);
    // /invoice: subtotalNet(100) + SHIP(30) + tax(13.13) = 143.13 — no double-count
    expect(session.body.TotalAmount + ship.body.LineTotal + session.body.TaxAmount).toBeCloseTo(143.13, 2);
  });

  test('no shipping => no SHIP row, TotalAmount = base', async () => {
    const captured = [];
    const svc = new (loadService(captured))();
    await svc.saveQuote(baseQuote({ preTaxSubtotal: 100, shippingFee: 0 }));
    const session = captured.find(c => c.url.includes('/quote_sessions'));
    expect(session.body.TotalAmount).toBeCloseTo(100, 2);
    const ship = captured.find(c => c.url.includes('/quote_items') && c.body && c.body.StyleNumber === 'SHIP');
    expect(ship).toBeFalsy();
  });
});
