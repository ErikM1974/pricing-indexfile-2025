/**
 * Screenprint save + print parity — 2026-06-11 sibling sweep of the DTF audit fix.
 *
 * The DTF audit found saveAndGetLink built quote_items from a hardcoded
 * ['2XL'..'6XL'] size list, silently dropping every other popup size (XS, talls,
 * youth, 7XL+) from quote_items while still charging them in the session totals.
 * CLAUDE.md Rule 8: sweep the other builders. SCP's SAVE path was already
 * row-driven (collectProductsFromTable iterates actual child rows and the priced
 * snapshot carries the full sizeBreakdown) — test 1 LOCKS that. SCP's PRINT path
 * (buildScreenprintPricingData) still had the hardcoded list — fixed 2026-06-11
 * to mirror EMB's 2026-06-04 B3 fix; tests 2-4 lock the fixed behavior.
 *
 * Test 1 uses the same source-loading harness as dtf-save-parity.test.js.
 * Tests 2-4 extract buildScreenprintPricingData from the builder source by brace
 * counting (the builder is a global-scope <script>, not require()-able) and run
 * it against a stubbed DOM. Mutation-verified: restoring the old hardcoded
 * extendedSizes list makes the XS/LT/7XL lines vanish and the footing fail.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '../..');

// ---------------------------------------------------------------------------
// Part 1 — SAVE path: ScreenPrintQuoteService persists the FULL sizeBreakdown
// ---------------------------------------------------------------------------

function loadService(captured) {
  const code = fs.readFileSync(path.join(ROOT, 'shared_components/js/screenprint-quote-service.js'), 'utf8');
  const win = { APP_CONFIG: { API: { BASE_URL: 'http://test/api' } } };
  const fetchMock = (url, opts) => {
    captured.push({ url: String(url), method: (opts && opts.method) || 'GET', body: opts && opts.body ? JSON.parse(opts.body) : null });
    return Promise.resolve({ ok: true, status: 200, text: () => Promise.resolve(''), json: () => Promise.resolve({}) });
  };
  win.fetch = fetchMock;
  const doc = { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [] };
  const quietConsole = { log() {}, warn() {}, error() {}, info() {} };
  const mkStorage = () => { const m = {}; return { getItem: (k) => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, removeItem: (k) => { delete m[k]; }, clear: () => { Object.keys(m).forEach((k) => delete m[k]); }, length: 0, key: () => null }; };
   
  const factory = new Function('window', 'document', 'fetch', 'console', 'sessionStorage', 'localStorage', code + '\nreturn window.ScreenPrintQuoteService;');
  return factory(win, doc, fetchMock, quietConsole, mkStorage(), mkStorage());
}

/** Quote payload shaped the way saveAndGetLink builds it: ONE item per product
 *  row carrying the FULL sizeBreakdown (incl. popup sizes outside 2XL-6XL). */
const baseQuote = (over) => Object.assign({
  customerName: 'Brad Wright', customerEmail: 'brad@acme.com', companyName: 'Acme Co',
  salesRep: 'sales@nwcustomapparel.com',
  items: [{
    styleNumber: 'PC54', productName: 'Port & Company Core Cotton Tee',
    color: 'Navy', colorCode: 'Navy',
    quantity: 28,
    sizeBreakdown: { S: 6, M: 6, L: 6, XS: 2, LT: 3, '7XL': 1, '2XL': 4 },
    basePrice: 15.23, unitPrice: 15.23, ltmPerUnit: 0,
    lineTotal: 426.5, imageUrl: '',
  }],
  totalQuantity: 28,
  subtotal: 426.5,
  ltmFee: 0, setupFees: 90, grandTotal: 516.5,
  frontLocation: 'FF', frontColors: 2, backLocation: '', backColors: 0,
  isDarkGarment: false, hasSafetyStripes: false,
  artCharge: 0, graphicDesignHours: 0, graphicDesignCharge: 0, rushFee: 0,
  discount: 0, discountPercent: 0, discountReason: '',
  ltmDisplayMode: 'builtin', ltmWaived: false, isWholesale: false,
  taxRate: 10.1, shippingFee: 0,
}, over || {});

describe('SCP save parity — full sizeBreakdown reaches quote_items', () => {
  test('popup sizes outside 2XL-6XL (XS, LT, 7XL) persist in SizeBreakdown and foot to SubtotalAmount', async () => {
    const captured = [];
    const svc = new (loadService(captured))();
    const result = await svc.saveQuote(baseQuote());
    expect(result.success).toBe(true);

    const items = captured.filter(c => c.url.includes('/quote_items') && c.method === 'POST' && c.body && c.body.EmbellishmentType === 'screenprint');
    expect(items.length).toBe(1);

    const sb = JSON.parse(items[0].body.SizeBreakdown);
    expect(sb).toEqual({ S: 6, M: 6, L: 6, XS: 2, LT: 3, '7XL': 1, '2XL': 4 });
    expect(items[0].body.Quantity).toBe(28);
    expect(items[0].body.ColorCode).toBe('Navy');

    // product line totals foot to the session subtotal (the DTF under-billing class)
    const lineSum = items.reduce((s, i) => s + i.body.LineTotal, 0);
    const session = captured.find(c => c.url.includes('/quote_sessions') && c.method === 'POST');
    expect(lineSum).toBeCloseTo(session.body.SubtotalAmount, 2);
  });
});

// ---------------------------------------------------------------------------
// Part 2 — PRINT path: buildScreenprintPricingData emits a PDF line for EVERY
// ordered size (no hardcoded extended-size list), and the lines foot.
// ---------------------------------------------------------------------------

function extractFunction(src, name) {
  const start = src.indexOf(`function ${name}(`);
  if (start === -1) throw new Error(`${name} not found in builder source`);
  const bodyStart = src.indexOf('{', start);
  let depth = 0;
  let end = -1;
  for (let i = bodyStart; i < src.length; i++) {
    const ch = src[i];
    if (ch === '{') depth++;
    else if (ch === '}') { depth--; if (depth === 0) { end = i + 1; break; } }
  }
  if (end === -1) throw new Error(`${name}: unbalanced braces`);
  return src.slice(start, end);
}

const BUILDER_SRC = fs.readFileSync(path.join(ROOT, 'shared_components/js/builders/scp/save-output.js'), 'utf8');
// D3 (2026-07-09): the per-product build was split out — extract the helper
// alongside so the evaluated source stays complete.
const PDF_FN_SRC = extractFunction(BUILDER_SRC, '_buildScpInvoiceProduct') + '\n'
    + extractFunction(BUILDER_SRC, 'buildScreenprintPricingData');

function loadPdfBuilder({ cells, parentRows, childRowMap, currentPricingData }) {
  // sanity: brace counting captured the whole function
  expect(PDF_FN_SRC).toContain('return window.QuotePricingData.buildPricingData(');

  const win = {
    currentPricingData,
    QuotePricingData: { buildPricingData: (o) => o }, // capture the arg verbatim
  };
  const doc = {
    getElementById: (id) => (id in cells ? { textContent: cells[id], value: cells[id] } : null),
    querySelector: (sel) => {
      const m = /tr\[data-style="([^"]+)"\]\[data-catalog-color="([^"]+)"\]/.exec(String(sel));
      if (m) return parentRows[`${m[1]}|${m[2]}`] || null;
      return null; // '#spc-order-fields .os-shipping-fee' etc.
    },
  };
  const printConfig = { frontLocation: 'FF', frontColors: 2, backLocation: null, backColors: 0, isDarkGarment: false, isSafetyStripes: false, setupFee: 60 };
  // S2 (2026-07-08): the builder's state moved onto scpState (builders/scp/state.js)
  // — the extracted fn now reads scpState.printConfig / scpState.childRowMap.
  const scpState = { printConfig, childRowMap };
  const getLocationName = (c) => String(c);
  const getServicePrice = (code, fallback) => fallback;
  const getLtmControlState = () => ({ enabled: true, displayMode: 'builtin' });
   
  const factory = new Function(
    'window', 'document', 'scpState', 'getLocationName', 'getServicePrice', 'getLtmControlState',
    PDF_FN_SRC + '\nreturn buildScreenprintPricingData;'
  );
  return factory(win, doc, scpState, getLocationName, getServicePrice, getLtmControlState);
}

describe('SCP print parity — buildScreenprintPricingData (2026-06-11 fix)', () => {
  test('every popup size gets a PDF line at its child-row price; lines foot to the grand total', () => {
    const build = loadPdfBuilder({
      cells: {
        'row-price-7': '$14.50',     // parent (base) price
        'row-price-101': '$14.50',   // XS child
        'row-price-102': '$16.50',   // LT (tall) child
        'row-price-103': '$20.50',   // 7XL child
        'row-price-104': '$16.50',   // 2XL child
      },
      parentRows: { 'PC54|Navy': { dataset: { rowId: '7' } } },
      childRowMap: { 7: { XS: 101, LT: 102, '7XL': 103, '2XL': 104 } },
      currentPricingData: { tier: '24-36', totalQuantity: 28, grandTotal: 426, subtotal: 426, setupFees: 60 },
    });

    const pricingData = build([{
      style: 'PC54', productName: 'Port & Company Core Cotton Tee',
      color: 'Navy', catalogColor: 'Navy',
      sizeBreakdown: { S: 6, M: 6, L: 6, XS: 2, LT: 3, '7XL': 1, '2XL': 4 },
      totalQty: 28,
    }]);

    const lines = pricingData.products[0].lineItems;
    const byDesc = (frag) => lines.find(l => l.description.includes(frag));

    // base group (S/M/L → LG display) at parent price
    expect(byDesc('S(6)')).toBeTruthy();
    expect(byDesc('S(6)').quantity).toBe(18);
    expect(byDesc('S(6)').unitPrice).toBeCloseTo(14.5, 2);

    // the sizes the old hardcoded ['2XL'..'6XL','OSFA'] list silently dropped
    expect(byDesc('XS(2)')).toBeTruthy();
    expect(byDesc('XS(2)').total).toBeCloseTo(29, 2);
    expect(byDesc('LT(3)')).toBeTruthy();
    expect(byDesc('LT(3)').unitPrice).toBeCloseTo(16.5, 2);
    expect(byDesc('7XL(1)')).toBeTruthy();
    expect(byDesc('7XL(1)').unitPrice).toBeCloseTo(20.5, 2);

    // 2XL still prices from its child row (upcharge), not the parent base
    expect(byDesc('2XL(4)').unitPrice).toBeCloseTo(16.5, 2);

    // PDF product lines foot to the on-screen grand total — the Bradley symptom
    const lineSum = lines.reduce((s, l) => s + l.total, 0);
    expect(lineSum).toBeCloseTo(426, 2);
    expect(pricingData.subtotal).toBeCloseTo(426, 2);
  });

  test('XXL (Ladies, Size05 child row) prices from its child row, not the parent base', () => {
    const build = loadPdfBuilder({
      cells: { 'row-price-3': '$12.00', 'row-price-201': '$14.00' },
      parentRows: { 'LPC54|Red': { dataset: { rowId: '3' } } },
      childRowMap: { 3: { XXL: 201 } },
      currentPricingData: { tier: '24-36', totalQuantity: 26, grandTotal: 316, subtotal: 316 },
    });

    const pricingData = build([{
      style: 'LPC54', productName: 'Ladies Core Cotton Tee', color: 'Red', catalogColor: 'Red',
      sizeBreakdown: { S: 12, M: 12, XXL: 2 }, totalQty: 26,
    }]);

    const lines = pricingData.products[0].lineItems;
    const xxl = lines.find(l => l.description.includes('XXL(2)'));
    expect(xxl).toBeTruthy();
    expect(xxl.unitPrice).toBeCloseTo(14.0, 2); // old code put XXL in baseSizes → $12.00 under-bill
    const lineSum = lines.reduce((s, l) => s + l.total, 0);
    expect(lineSum).toBeCloseTo(12 * 24 + 14 * 2, 2);
  });

  test('OSFA-only product (beanie) prices from the PARENT row instead of a missing child row', () => {
    const build = loadPdfBuilder({
      cells: { 'row-price-9': '$11.00' },
      parentRows: { 'CP90|Black': { dataset: { rowId: '9' } } },
      childRowMap: {},
      currentPricingData: { tier: '24-36', totalQuantity: 12, grandTotal: 132, subtotal: 132 },
    });

    const pricingData = build([{
      style: 'CP90', productName: 'Port & Company Knit Cap', color: 'Black', catalogColor: 'Black',
      sizeBreakdown: { OSFA: 12 }, totalQty: 12,
    }]);

    const lines = pricingData.products[0].lineItems;
    expect(lines.length).toBe(1);
    expect(lines[0].description).toBe('OSFA(12)');
    expect(lines[0].unitPrice).toBeCloseTo(11.0, 2); // old code: childRowMap miss → $0.00 line
    expect(lines[0].total).toBeCloseTo(132, 2);
  });
});
