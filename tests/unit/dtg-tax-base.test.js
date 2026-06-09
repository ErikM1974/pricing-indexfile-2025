/**
 * Regression lock for the DTG saved-quote tax invariant (Phase 1 Chunk C, 2026-06-08).
 *
 * DTG's "Save & share link" (dtg-quote-page.js handleSaveQuote) now reads the MANUAL form
 * quote (window.DTGInlineForm.getSaveQuote()) and persists tax explicitly. The contract that
 * MUST hold so screen == saved == /quote == /invoice == push (Erik's #1 rule):
 *   - TotalAmount is PRE-tax (== SubtotalAmount). /invoice reconstructs grand = TotalAmount +
 *     TaxAmount reading TaxAmount VERBATIM, so baking tax into TotalAmount would double-tax.
 *   - TaxRate is persisted as a DECIMAL (0.101), matching EMB (NOT percent like SCP/DTF).
 *   - TaxAmount == round(subtotal * rate); 0 for wholesale / exempt / out-of-state / opt-out.
 *   - IsWholesale 'Yes'/'No'; TotalAmount + TaxAmount == the on-screen grand total.
 *
 * dtg-quote-page.js is a browser IIFE (no module.exports). It exposes window.dtgSaveQuote and
 * reads the form quote via window.DTGInlineForm.getSaveQuote(). We load it via Function
 * injection (like scp-tax-base.test.js), stub the DOM so init() never fires, mock the form
 * quote + fetch, call window.dtgSaveQuote(), and assert the captured quote_sessions payload.
 */
const fs = require('fs');
const path = require('path');

function loadPage(captured) {
  const code = fs.readFileSync(path.join(__dirname, '../../shared_components/js/dtg-quote-page.js'), 'utf8');
  const win = { APP_CONFIG: { API: { BASE_URL: 'http://test' } } };
  const fetchMock = (url, opts) => {
    const u = String(url);
    if (u.indexOf('/api/quote-sequence/') !== -1) {
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ prefix: 'DTG', year: 2026, sequence: 99 }) });
    }
    if (u.indexOf('/api/quote_sessions') !== -1 || u.indexOf('/api/quote_items') !== -1) {
      captured.push({ url: u, method: (opts && opts.method) || 'GET', body: opts && opts.body ? JSON.parse(opts.body) : null });
      return Promise.resolve({ ok: true, status: 201, text: () => Promise.resolve(''), json: () => Promise.resolve({ PK_ID: 1, QuoteID: 'DTG-2026-099' }) });
    }
    return Promise.resolve({ ok: true, status: 200, text: () => Promise.resolve(''), json: () => Promise.resolve({}) });
  };
  win.fetch = fetchMock;
  // Stub doc: addEventListener no-ops (so DOMContentLoaded init() never runs); getElementById
  // returns null (every consumer guards on null).
  const doc = { addEventListener: () => {}, getElementById: () => null, querySelector: () => null, querySelectorAll: () => [] };
  const quietConsole = { log() {}, warn() {}, error() {}, info() {} };
  const mkStorage = () => { const m = {}; return { getItem: (k) => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, removeItem: (k) => { delete m[k]; }, clear: () => {} }; };
  const loc = { origin: 'http://test', href: 'http://test/quote-builders/dtg-quote-builder.html' };
  const nav = { clipboard: { writeText: () => Promise.resolve() } };
  // eslint-disable-next-line no-new-func
  const factory = new Function('window', 'document', 'fetch', 'console', 'sessionStorage', 'localStorage', 'location', 'navigator',
    code + '\nreturn { save: window.dtgSaveQuote };');
  win.document = doc;
  return factory(win, doc, fetchMock, quietConsole, mkStorage(), mkStorage(), loc, nav).save && win;
}

// A form quote in the shape window.DTGInlineForm.getSaveQuote() returns (computePriceQuoteFromState
// + customer + shipping). subtotal 205.92; rate varies per case.
const formQuote = (over) => Object.assign({
  lineItems: [{
    style: 'PC54', color: 'Jet Black', description: 'PC54 Jet Black', sizes: { M: 12 },
    priceBySize: { M: 17.16 }, totalQuantity: 12, baseUnitPrice: 13, ltmPerUnit: 4.16,
    finalUnitPrice: 17.16, lineTotal: 205.92, locationCode: 'LC', locationLabel: 'Left Chest', tier: '1-23',
  }],
  combinedQuantity: 12, subtotal: 205.92, totalLtmFee: 49.92, tier: '1-23',
  locationCode: 'LC', locationLabel: 'Left Chest',
  taxRate: 0.101, taxAmount: 20.80, taxAccount: '2200.101', taxAccountName: 'Wash:10.1%',
  isWholesale: false, isTaxExempt: false, taxExemptNumber: '',
  grandTotal: 226.72,
  totals: { subtotal: 205.92, taxRate: 0.101, taxAmount: 20.80, grandTotal: 226.72 },
  customer: { name: 'Test Co', company: 'Test Co', email: 't@x.com', phone: '', designNumber: '', companyId: '' },
  shipping: { method: 'Customer Pickup', city: '', state: '', zip: '', taxRate: 0.101, taxRateSource: 'default-pre-lookup', taxAccount: '2200.101', taxAccountName: 'Wash:10.1%', taxRateOverride: null, includeTax: true },
}, over || {});

async function saveAndCapture(quote) {
  const captured = [];
  const win = loadPage(captured);
  win.DTGInlineForm = { getSaveQuote: () => quote };
  await win.dtgSaveQuote();
  const session = captured.find(c => c.url.indexOf('/api/quote_sessions') !== -1);
  const itemPosts = captured.filter(c => c.url.indexOf('/api/quote_items') !== -1 && c.method === 'POST' && c.body);
  // [2026-06-09] Phase 2 — the product item (EmbellishmentType 'dtg') vs the SHIP fee item.
  const item = itemPosts.find(c => c.body.EmbellishmentType === 'dtg') || (itemPosts[0] && itemPosts[0]);
  const shipItem = itemPosts.find(c => c.body.StyleNumber === 'SHIP');
  return { session: session && session.body, item: item && item.body, shipItem: shipItem && shipItem.body };
}

describe('DTG saved-quote tax invariant (Phase 1 Chunk C lock)', () => {
  test('page IIFE loads and exposes window.dtgSaveQuote', () => {
    const win = loadPage([]);
    expect(typeof win.dtgSaveQuote).toBe('function');
  });

  test('PICKUP 10.1%: TotalAmount is PRE-tax, TaxRate decimal, TaxAmount = round(subtotal*rate)', async () => {
    const { session } = await saveAndCapture(formQuote());
    expect(session).toBeTruthy();
    expect(session.SubtotalAmount).toBeCloseTo(205.92, 2);
    expect(session.TotalAmount).toBeCloseTo(205.92, 2);   // PRE-tax (NOT 226.72)
    expect(session.TotalAmount).not.toBeCloseTo(226.72, 2);
    expect(session.TaxRate).toBeCloseTo(0.101, 4);          // DECIMAL, not 10.1
    expect(session.TaxAmount).toBeCloseTo(20.80, 2);
    expect(session.IsWholesale).toBe('No');
    // /invoice reconstructs grand = TotalAmount + TaxAmount → must equal the on-screen grand
    expect(session.TotalAmount + session.TaxAmount).toBeCloseTo(226.72, 2);
  });

  test('WHOLESALE: TaxRate 0, TaxAmount 0, IsWholesale Yes, TotalAmount still pre-tax subtotal', async () => {
    const { session } = await saveAndCapture(formQuote({
      taxRate: 0, taxAmount: 0, isWholesale: true, grandTotal: 205.92,
      taxAccount: '2203', taxAccountName: 'Wholesale Sales (WA reseller permit)',
      totals: { subtotal: 205.92, taxRate: 0, taxAmount: 0, grandTotal: 205.92 },
    }));
    expect(session.TotalAmount).toBeCloseTo(205.92, 2);
    expect(session.TaxRate).toBe(0);
    expect(session.TaxAmount).toBe(0);
    expect(session.IsWholesale).toBe('Yes');
    expect(session.TotalAmount + session.TaxAmount).toBeCloseTo(205.92, 2);
  });

  test('OUT-OF-STATE / exempt / opt-out (rate 0): TaxAmount 0, TotalAmount = subtotal', async () => {
    const { session } = await saveAndCapture(formQuote({
      taxRate: 0, taxAmount: 0, grandTotal: 205.92,
      totals: { subtotal: 205.92, taxRate: 0, taxAmount: 0, grandTotal: 205.92 },
    }));
    expect(session.TotalAmount).toBeCloseTo(205.92, 2);
    expect(session.TaxAmount).toBe(0);
    expect(session.TaxRate).toBe(0);
    expect(session.IsWholesale).toBe('No');
  });

  test('MANUAL 8.5%: decimal rate persists; grand = TotalAmount + TaxAmount', async () => {
    const { session } = await saveAndCapture(formQuote({
      taxRate: 0.085, taxAmount: 17.50, grandTotal: 223.42,
      totals: { subtotal: 205.92, taxRate: 0.085, taxAmount: 17.50, grandTotal: 223.42 },
    }));
    expect(session.TaxRate).toBeCloseTo(0.085, 4);
    expect(session.TaxAmount).toBeCloseTo(17.50, 2);
    expect(session.TotalAmount).toBeCloseTo(205.92, 2);
    expect(session.TotalAmount + session.TaxAmount).toBeCloseTo(223.42, 2);
  });

  test('LTM is persisted on the saved item (not stripped): LTMFeeTotal + per-item LTM fields', async () => {
    const { session, item } = await saveAndCapture(formQuote());
    expect(session.LTMFeeTotal).toBeCloseTo(49.92, 2);  // 4.16/pc * 12
    expect(item.LTMPerUnit).toBeCloseTo(4.16, 2);
    expect(item.BaseUnitPrice).toBeCloseTo(13, 2);
    expect(item.HasLTM).toBe('Yes');
    expect(item.LineTotal).toBeCloseTo(205.92, 2);
    expect(item.PricingTier).toBe('1-23');
  });

  // [2026-06-09] Phase 2 — billed shipping (taxable in WA). The form quote carries shippingFee
  // and computes taxAmount on (subtotal + shippingFee). Mirroring DTF/SCP, the saved record MUST:
  // keep TotalAmount = products-only PRE-tax (EXCLUDES shipping), write a SHIP fee line item, and
  // keep TaxAmount = round((subtotal+fee)*rate). The readers (/quote, /invoice) foot via
  // (TotalAmount + SHIP-item + tax). subtotal 205.92, fee 25, rate 10.1% → tax 23.32, grand 254.24.
  test('PHASE 2 — WA-taxable 10.1% with shipping fee: TotalAmount products-only, SHIP item carries fee, tax on the base', async () => {
    const { session, shipItem } = await saveAndCapture(formQuote({
      shippingFee: 25, taxRate: 0.101, taxAmount: 23.32, grandTotal: 254.24,
      totals: { subtotal: 205.92, shippingFee: 25, taxRate: 0.101, taxAmount: 23.32, grandTotal: 254.24 },
    }));
    expect(session.SubtotalAmount).toBeCloseTo(205.92, 2);   // products only
    expect(session.ShippingFee).toBeUndefined();             // we don't write a ShippingFee column (DTF/SCP don't) — fee lives in the SHIP item
    expect(session.TotalAmount).toBeCloseTo(205.92, 2);       // PRE-tax, products-only (EXCLUDES shipping)
    expect(session.TotalAmount).not.toBeCloseTo(230.92, 2);   // NOT baked with the fee
    expect(session.TaxRate).toBeCloseTo(0.101, 4);
    expect(session.TaxAmount).toBeCloseTo(23.32, 2);          // round((205.92+25)*0.101) — shipping IS taxed
    // SHIP line item written so /quote + /invoice show + foot a Shipping row (DTF/SCP convention)
    expect(shipItem).toBeTruthy();
    expect(shipItem.StyleNumber).toBe('SHIP');
    expect(shipItem.EmbellishmentType).toBe('fee');
    expect(shipItem.LineTotal).toBeCloseTo(25, 2);
    // Reader footing: TotalAmount + SHIP + TaxAmount == on-screen grand
    expect(session.TotalAmount + shipItem.LineTotal + session.TaxAmount).toBeCloseTo(254.24, 2);
  });

  test('PHASE 2 — out-of-state with shipping fee: SHIP item written, fee NOT in TotalAmount, tax still 0', async () => {
    const { session, shipItem } = await saveAndCapture(formQuote({
      shippingFee: 25, taxRate: 0, taxAmount: 0, grandTotal: 230.92,
      shipping: { method: 'UPS Ground', city: 'Portland', state: 'OR', zip: '97201', fee: 25, taxRate: 0, taxRateSource: 'out-of-state', taxAccount: '2202', taxAccountName: 'Out of State Sales', taxRateOverride: null, includeTax: true },
      totals: { subtotal: 205.92, shippingFee: 25, taxRate: 0, taxAmount: 0, grandTotal: 230.92 },
    }));
    expect(session.ShippingFee).toBeUndefined();             // no session column — SHIP item carries the fee
    expect(session.TotalAmount).toBeCloseTo(205.92, 2);       // products only — fee is in the SHIP item
    expect(session.TaxAmount).toBe(0);
    expect(session.TaxRate).toBe(0);
    expect(shipItem).toBeTruthy();
    expect(shipItem.LineTotal).toBeCloseTo(25, 2);
    expect(session.TotalAmount + shipItem.LineTotal + session.TaxAmount).toBeCloseTo(230.92, 2);
    // Notes.shipping carries the fee for edit-reload (Chunk E)
    const notes = JSON.parse(session.Notes);
    expect(notes.shipping.fee).toBeCloseTo(25, 2);
  });

  test('PICKUP with no fee: ShippingFee 0, no SHIP item, TotalAmount unchanged (regression guard)', async () => {
    const { session, shipItem } = await saveAndCapture(formQuote());  // base quote, no shippingFee
    expect(Number(session.ShippingFee) || 0).toBe(0);
    expect(session.TotalAmount).toBeCloseTo(205.92, 2);       // still products-only pre-tax
    expect(shipItem).toBeFalsy();                             // no SHIP item when fee is 0
  });

  // [2026-06-09] Phase 2 — STALE-PICKUP-FEE guard (adversarial-review finding 3). effectiveShipFee()
  // in dtg-inline-form.js zeroes the fee for pickup, so getSaveQuote() yields shippingFee 0 even if a
  // stale fee lingers in state. This test simulates that output (pickup quote, shippingFee 0) and
  // asserts NO fee is billed/taxed + NO SHIP item — i.e. a pickup quote saved after a ship quote does
  // not carry the prior shipping charge.
  test('PHASE 2 — pickup with a stale fee zeroed upstream: no SHIP item, no fee in totals', async () => {
    const { session, shipItem } = await saveAndCapture(formQuote({
      shippingFee: 0, taxRate: 0.101, taxAmount: 20.80, grandTotal: 226.72,
      shipping: { method: 'Customer Pickup', city: '', state: '', zip: '', fee: 0, taxRate: 0.101, taxRateSource: 'pickup-flat', taxAccount: '2200.101', taxAccountName: 'Wash:10.1%', taxRateOverride: null, includeTax: true },
      totals: { subtotal: 205.92, shippingFee: 0, taxRate: 0.101, taxAmount: 20.80, grandTotal: 226.72 },
    }));
    expect(Number(session.ShippingFee) || 0).toBe(0);
    expect(session.TotalAmount).toBeCloseTo(205.92, 2);       // products only, no shipping folded in
    expect(session.TaxAmount).toBeCloseTo(20.80, 2);          // tax on products only (no shipping)
    expect(shipItem).toBeFalsy();
  });

  test('Notes carries shipping + tax blocks for edit-reload (Chunk E round-trip)', async () => {
    const { session } = await saveAndCapture(formQuote({
      taxRate: 0, taxAmount: 0, grandTotal: 205.92,
      shipping: { method: 'UPS Ground', city: 'Portland', state: 'OR', zip: '97201', taxRate: 0, taxRateSource: 'out-of-state', taxAccount: '2202', taxAccountName: 'Out of State Sales', taxRateOverride: null, includeTax: true },
      totals: { subtotal: 205.92, taxRate: 0, taxAmount: 0, grandTotal: 205.92 },
    }));
    const notes = JSON.parse(session.Notes);
    expect(notes.shipping.method).toBe('UPS Ground');
    expect(notes.shipping.state).toBe('OR');
    expect(notes.tax.taxRateSource).toBe('out-of-state');
    expect(notes.tax.isWholesale).toBe(false);
  });
});
