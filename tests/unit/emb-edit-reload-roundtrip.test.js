/**
 * Embroidery Quote Builder — TRUE DOM round-trip regression test for the edit-reload path.
 *
 * Locks the three confirmed audit bugs fixed in v2026.06.06.4:
 *   P0  pickup-quote reload silently overwrites the saved tax rate (Erik's #1-rule violation)
 *   P1  legacy additional-logo quotes double-charge the AL on reload
 *   P1  OSFA-only caps/beanies drop their quantity on reload
 *
 * WHY THIS SHAPE
 * --------------
 * embroidery-quote-builder.js (~12.6k lines) is a global-scope <script> with no module
 * exports and top-level DOM init, so it cannot be require()'d. Earlier this file locked the
 * fixes with logic-model + source-guard assertions only — never a real reload. This version
 * loads the ACTUAL builder + its real dependencies into a jsdom window built from the real
 * quote-builders/embroidery-quote-builder.html, stubs fetch for the caspio-pricing-proxy
 * endpoints, then for each fixture builds a saved quote (quote_sessions + quote_items), calls
 * the real loadQuoteForEditing(), and asserts the restored DOM state.
 *
 * HOW THE BUILDER IS LOADED (and why testEnvironment stays 'node')
 * ---------------------------------------------------------------
 * We instantiate jsdom directly (require('jsdom')) instead of using a global jsdom test
 * environment because we need: (a) runScripts:'dangerously' so injected <script>s execute in
 * the window, and (b) control over WHEN scripts inject — AFTER the document's own load event,
 * so the builder's `DOMContentLoaded` init handler never fires and we drive the functions
 * ourselves. Each builder dependency that defines plain `function`s / `window.X =` exports
 * (utils, product-category-filter) becomes globally visible across injected scripts (jsdom runs
 * them in the shared window global). The builder's module-level `let`s (globalAL, quoteService,
 * pricingCalculator …) are NOT window properties, so a tiny accessor object (window.__embTest)
 * is appended to the builder source in the SAME injected script — it closes over those bindings.
 *
 * The pricing engine (EmbroideryPricingCalculator) and its config fetches are out of scope for
 * an edit-reload test, so pricingCalculator is replaced with a benign stub; recalculatePricing()
 * still runs for real, it just gets $0 numbers. None of the asserted state (tax rate, globalAL,
 * OSFA qty) depends on computed prices — they are all restored BEFORE pricing runs.
 *
 * Each assertion was mutation-verified while authoring: stripping the corresponding fix from the
 * builder source flips the asserted value (e.g. removing the P0 guard makes the DOR lookup fire
 * during restore and clobber 8.8 → the stubbed 99.9).
 */
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');

const ROOT = path.join(__dirname, '../..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

// Read once — the builder is large; re-reading per test is wasteful.
const HTML = read('quote-builders/embroidery-quote-builder.html');
const UTILS_SRC = read('shared_components/js/quote-builder-utils.js');
const PCF_SRC = read('shared_components/js/product-category-filter.js');
const SERVICE_SRC = read('shared_components/js/embroidery-quote-service.js');
const SUMMARY_SRC = read('shared_components/js/quote-order-summary.js');
const BUILDER_SRC = read('shared_components/js/embroidery-quote-builder.js');

// Source the builder once for the lightweight source-guard backstop tests at the bottom.
const SRC = BUILDER_SRC;

const PROXY = 'https://proxy.test';

// Appended to the builder script (same injected <script>, so it closes over the module `let`s).
const TEST_HOOKS = `
;(function(){
  window.__embTest = {
    get globalAL(){ return globalAL; },
    get primaryLogo(){ return primaryLogo; },
    get capPrimaryLogo(){ return capPrimaryLogo; },
    get editingQuoteId(){ return editingQuoteId; },
    get restoring(){ return window._restoringQuote; },
    set quoteService(v){ quoteService = v; },
    get quoteService(){ return quoteService; },
    set pricingCalculator(v){ pricingCalculator = v; },
  };
  // Re-export the functions under test (defensive — already globals via function decls).
  window.loadQuoteForEditing = loadQuoteForEditing;
  window.lookupTaxRate = lookupTaxRate;
  window.populateLogoConfig = populateLogoConfig;
})();
`;

const OPEN_DOMS = [];

/**
 * Build a fully-wired builder in a fresh jsdom window.
 * @param {Array<[string, any|((url:string)=>any)]>} routes  fetch URL-fragment → JSON body (or fn)
 * @returns {Promise<{window:Window, fetchCalls:string[]}>}
 */
async function buildBuilder(routes) {
  const virtualConsole = new VirtualConsole(); // no .sendTo() → swallow the builder's console noise
  const dom = new JSDOM(HTML, {
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    url: 'https://test.local/quote-builders/embroidery-quote-builder.html',
    virtualConsole,
  });
  OPEN_DOMS.push(dom);
  const { window } = dom;

  // Globals normally provided by the external scripts the HTML loads (not fetched by jsdom).
  window.APP_CONFIG = { API: { BASE_URL: PROXY } };
  window.emailjs = { init() {} };
  window.scrollTo = () => {};
  if (!window.matchMedia) {
    window.matchMedia = () => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} });
  }

  // Stubbed proxy. Records every call so tests can assert which endpoints fired.
  const fetchCalls = [];
  window.fetch = (url) => {
    const u = String(url);
    fetchCalls.push(u);
    const ok = (body) => Promise.resolve({ ok: true, status: 200, statusText: 'OK', json: () => Promise.resolve(body) });
    for (const [frag, body] of routes) {
      if (u.includes(frag)) return ok(typeof body === 'function' ? body(u) : body);
    }
    return ok({}); // benign default so recalculatePricing()'s fire-and-forget calls never reject
  };

  // Wait for jsdom's own load to pass so the builder's DOMContentLoaded init handler never fires.
  await new Promise((resolve) => {
    if (window.document.readyState === 'complete') return resolve();
    let done = false;
    const finish = () => { if (done) return; done = true; clearTimeout(safety); resolve(); };
    window.addEventListener('load', finish);
    const safety = setTimeout(finish, 1000); // safety net — cleared when load fires so it can't leak
    safety.unref && safety.unref();
  });

  const inject = (code) => {
    const s = window.document.createElement('script');
    s.textContent = code;
    window.document.head.appendChild(s);
  };
  inject(UTILS_SRC);
  inject(PCF_SRC);
  inject(SERVICE_SRC + '\n;window.EmbroideryQuoteService = EmbroideryQuoteService;');
  inject(SUMMARY_SRC);  // shared order-summary band — must load before the builder (matches production) so the builder's QuoteOrderSummary.configure() wires #order-recap / #ship-to-card
  inject(BUILDER_SRC + TEST_HOOKS);

  // Wire the two module-level deps that init() would normally create, without running init().
  window.__embTest.pricingCalculator = {
    initializeConfig: async () => {},
    calculateQuote: async () => ({ products: [], grandTotal: 0, totalQuantity: 0, tier: '1-7' }),
  };
  window.__embTest.quoteService = new window.EmbroideryQuoteService();

  return { window, fetchCalls };
}

// Let fire-and-forget async work (recalculatePricing, detectAndAdjustSizeUI, a would-be tax
// lookup) settle. Real timers; microtasks resolve well within each tick.
const flush = async (n = 12) => { for (let i = 0; i < n; i++) await new Promise((r) => setTimeout(r, 15)); };

afterEach(() => {
  while (OPEN_DOMS.length) {
    try { OPEN_DOMS.pop().window.close(); } catch (_) { /* ignore */ }
  }
});

// Swallow unhandled rejections from fire-and-forget builder work that may settle after a window
// is closed (e.g. a recalc fetch). These are not assertion failures.
let _onUnhandled;
beforeAll(() => { _onUnhandled = () => {}; process.on('unhandledRejection', _onUnhandled); });
afterAll(() => { process.off('unhandledRejection', _onUnhandled); });

// ============================================================================
// P0 — pickup quote reload must KEEP the saved tax rate (Erik's #1 rule)
// ============================================================================
describe('P0 — pickup quote reload keeps the saved tax rate', () => {
  // Fixture: a taxable (8.8%) Customer-Pickup quote. The race is product-independent, so this
  // fixture carries only the TAX fee line — restoreEmbOrderShipping still drives the pickup path
  // (onShipMethodChange → lookupTaxRate), which is what the guard suppresses.
  const taxRoutes = (session, items) => [
    ['/api/quote_sessions', [session]],
    ['/api/quote_items', items],
    // If the guard is gone, the restore's DOR lookup resolves with THIS rate and clobbers 8.8.
    ['/api/tax-rates/lookup', { success: true, taxRate: 99.9, account: '9999' }],
    ['/api/service-codes', []],
  ];
  const pickupSession = {
    QuoteID: 'EMB-PICKUP-1', Status: 'Open', RevisionNumber: 1,
    CustomerName: 'Pickup Co', CustomerEmail: 'p@co.com',
    ShipMethod: 'Customer Pickup', TaxRate: 8.8,
  };
  const taxItem = [{ EmbellishmentType: 'fee', StyleNumber: 'TAX', BaseUnitPrice: 8.8, LineTotal: 0 }];

  test('restored #tax-rate-input keeps 8.8 and the DOR lookup never fires during restore', async () => {
    const { window, fetchCalls } = await buildBuilder(taxRoutes(pickupSession, taxItem));
    const rateInput = window.document.getElementById('tax-rate-input');
    expect(rateInput.value).toBe('10.2'); // HTML default before load (Milton 10.2% since 2026-07-06; 10.1 residuals swept 2026-07-07)

    await window.loadQuoteForEditing('EMB-PICKUP-1');
    await flush(); // give any would-be deferred DOR lookup time to resolve + clobber

    // (1) saved rate survived
    expect(rateInput.value).toBe('8.8');
    // (2) deterministic regression signal: the guard short-circuits lookupTaxRate BEFORE its
    //     fetch, so NO tax-rates/lookup call is made during the whole restore.
    expect(fetchCalls.filter((u) => u.includes('/api/tax-rates/lookup'))).toHaveLength(0);
    // (3) the guard flag is armed during restore and cleared in the finally
    expect(window._restoringQuote).toBe(false);
    // (4) taxable quote stays taxable
    expect(window.document.getElementById('include-tax').checked).toBe(true);
  });

  test('lookupTaxRate STILL performs a live DOR lookup when NOT restoring (guard is conditional)', async () => {
    const { window, fetchCalls } = await buildBuilder([
      ['/api/quote_sessions', [pickupSession]],
      ['/api/quote_items', taxItem],
      ['/api/tax-rates/lookup', { success: true, taxRate: 7.7, account: '1234' }],
    ]);
    // Simulate the rep editing the ship-to AFTER load: WA + a valid ZIP, not restoring.
    window._restoringQuote = false;
    window.document.getElementById('ship-state').value = 'WA';
    window.document.getElementById('ship-zip').value = '98052';
    window.document.getElementById('tax-rate-input').value = '8.8';

    const result = await window.lookupTaxRate();
    await flush(2);

    expect(result).toBe(true);
    expect(window.document.getElementById('tax-rate-input').value).toBe('7.7');
    expect(fetchCalls.filter((u) => u.includes('/api/tax-rates/lookup'))).toHaveLength(1);
  });

  test('source guard: lookupTaxRate no-ops while _restoringQuote is set; load arms + clears it', () => {
    expect(SRC).toMatch(/async function lookupTaxRate\(\)\s*\{[\s\S]{0,500}?if\s*\(\s*window\._restoringQuote\s*\)\s*return\s+false/);
    expect(SRC).toMatch(/window\._restoringQuote\s*=\s*true/);
    expect(SRC).toMatch(/finally\s*\{[\s\S]{0,160}?window\._restoringQuote\s*=\s*false/);
  });
});

// ============================================================================
// P1 — legacy additional-logo quotes must not double-charge on reload
// ============================================================================
describe('P1 — legacy additional-logo quote bills the AL once on reload', () => {
  // populateLogoConfig only re-enables the legacy globalAL path from session.AdditionalLogoLocation
  // when there is NO AL line item to restore. The current row-based flow saves BOTH the field AND
  // an `embroidery-additional` row; enabling globalAL too would bill the AL twice.
  const baseSession = {
    QuoteID: 'EMB-AL-1', Status: 'Open', RevisionNumber: 1,
    CustomerName: 'AL Co', AdditionalLogoLocation: 'Left Sleeve',
  };
  const routesFor = (session, items) => [
    ['/api/quote_sessions', [session]],
    ['/api/quote_items', items],
    ['/api/service-codes', []],
  ];

  test('truly-legacy quote (field set, NO AL row) → globalAL re-enabled so the logo is restored', async () => {
    const { window } = await buildBuilder(routesFor(baseSession, []));
    await window.loadQuoteForEditing('EMB-AL-1');
    await flush();

    expect(window.__embTest.globalAL.garment.enabled).toBe(true);
    // DOM mirror: the legacy switch is activated
    expect(window.document.getElementById('garment-al-switch').classList.contains('active')).toBe(true);
  });

  test('current-flow quote (AL row present) → globalAL NOT re-enabled (billed once, via the row only)', async () => {
    const alRow = [{
      EmbellishmentType: 'embroidery-additional', StyleNumber: 'AL', Quantity: 24,
      BaseUnitPrice: 5, PrintLocationName: 'Left Sleeve', SizeBreakdown: '{"stitchCount":8000}',
    }];
    const { window } = await buildBuilder(routesFor({ ...baseSession, QuoteID: 'EMB-AL-2' }, alRow));
    await window.loadQuoteForEditing('EMB-AL-2');
    await flush();

    // The exact fix: globalAL stays OFF because an AL row exists → the engine bills the AL once.
    expect(window.__embTest.globalAL.garment.enabled).toBe(false);
    expect(window.document.getElementById('garment-al-switch').classList.contains('active')).toBe(false);
    // ...and the AL row itself was restored as a service line item (so it IS billed, just once).
    const restored = [...window.document.querySelectorAll('tr[data-row-id]')]
      .some((r) => (r.dataset.serviceType || '').toUpperCase() === 'AL' || (r.textContent || '').includes('Additional Logo'));
    expect(restored).toBe(true);
  });

  test('AL-CAP line item also suppresses the legacy garment path (StyleNumber-based hasALRow)', async () => {
    const alCapRow = [{ EmbellishmentType: 'fee', StyleNumber: 'AL-CAP', Quantity: 24, BaseUnitPrice: 5, PrintLocationName: 'Cap Back' }];
    const { window } = await buildBuilder(routesFor({ ...baseSession, QuoteID: 'EMB-AL-3', AdditionalLogoLocation: 'Cap Back' }, alCapRow));
    await window.loadQuoteForEditing('EMB-AL-3');
    await flush();
    expect(window.__embTest.globalAL.garment.enabled).toBe(false);
  });

  test('AL row WITHOUT the legacy field never enables globalAL (no phantom enable)', async () => {
    const { AdditionalLogoLocation, ...noFieldSession } = baseSession; // drop the legacy field
    const alRow = [{ EmbellishmentType: 'embroidery-additional', StyleNumber: 'AL', Quantity: 12, BaseUnitPrice: 5, SizeBreakdown: '{"stitchCount":8000}' }];
    const { window } = await buildBuilder(routesFor({ ...noFieldSession, QuoteID: 'EMB-AL-4' }, alRow));
    await window.loadQuoteForEditing('EMB-AL-4');
    await flush();
    expect(window.__embTest.globalAL.garment.enabled).toBe(false);
    expect(window.document.getElementById('garment-al-switch').classList.contains('active')).toBe(false);
  });

  test('source guard: populateLogoConfig gates globalAL on !hasALRow', () => {
    expect(SRC).toMatch(/AdditionalLogoLocation\s*&&\s*!hasALRow/);
  });
});

// ============================================================================
// P1 — OSFA-only caps/beanies must keep their quantity on reload
// ============================================================================
describe('P1 — OSFA-only cap reload keeps its quantity', () => {
  // An OSFA-only product holds its qty on the PARENT row (dataset.osfaQty + .osfa-qty-input), not
  // a child row. OSFA is in SIZE06_EXTENDED_SIZES, so without addProductFromQuote's special-case
  // it routes to createChildRow and the qty is lost on reload.
  const capSession = {
    QuoteID: 'EMB-OSFA-1', Status: 'Open', RevisionNumber: 1,
    CustomerName: 'Cap Co', CapPrintLocation: 'CF', CapStitchCount: 8000,
  };
  const capItem = [{
    EmbellishmentType: 'embroidery', StyleNumber: 'C112', Color: 'Black', ProductName: 'Port Authority Cap',
    SizeBreakdown: '{"OSFA":24}', Quantity: 24, BaseUnitPrice: 12,
  }];
  const capRoutes = [
    ['/api/quote_sessions', [capSession]],
    ['/api/quote_items', capItem],
    ['/api/stylesearch', [{ value: 'C112', label: 'Port Authority Cap' }]],
    ['/api/product-colors', { colors: [{ COLOR_NAME: 'Black', CATALOG_COLOR: 'Black', HEX_CODE: '#000' }], CATEGORY_NAME: 'Caps' }],
    ['/api/sizes-by-style-color', { data: ['OSFA'] }],
    ['/api/service-codes', []],
  ];

  test('reloaded OSFA cap keeps qty 24 on the parent (not pruned to a child row)', async () => {
    const { window } = await buildBuilder(capRoutes);
    await window.loadQuoteForEditing('EMB-OSFA-1');
    await flush();

    const row = [...window.document.querySelectorAll('tr[data-row-id]')]
      .find((r) => r.dataset.style === 'C112' || r.querySelector('.style-input')?.value === 'C112');
    expect(row).toBeTruthy();

    // The product was detected as an OSFA-only cap …
    expect(row.dataset.sizeCategory).toBe('osfa-only');
    // … and its quantity survived on the parent (the bug dropped it to undefined).
    expect(row.dataset.osfaQty).toBe('24');
    expect(row.dataset.isOsfaOnly).toBe('true');
    expect(row.querySelector('.osfa-qty-input').value).toBe('24');
    // No child row was spun up for OSFA (the generic extended-size branch would have).
    expect(window.document.querySelectorAll('tr.child-row').length).toBe(0);
  });

  test('source guard: addProductFromQuote special-cases OSFA-only before the generic extended branch', () => {
    const osfaIdx = SRC.search(/size\.toUpperCase\(\)\s*===\s*'OSFA'\s*&&\s*row\.dataset\.sizeCategory\s*===\s*'osfa-only'/);
    const twoXlIdx = SRC.search(/if\s*\(size === '2XL' \|\| size === 'XXL'\)/);
    expect(osfaIdx).toBeGreaterThan(-1);
    expect(twoXlIdx).toBeGreaterThan(-1);
    expect(osfaIdx).toBeLessThan(twoXlIdx); // OSFA check comes first
  });
});
