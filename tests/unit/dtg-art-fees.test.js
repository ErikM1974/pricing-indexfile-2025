/**
 * DTG art charges — GRT-50 (art setup / logo mockup) + GRT-75 (graphic design, per hour).
 * Added 2026-08-06; DTG was the only builder without them.
 *
 * Two contracts are locked here.
 *
 * 1. builders/dtg/fees.js is THE authority (the effectiveShipFee() pattern). The rep
 *    enters COUNTS; every dollar comes from the live Caspio Service_Codes SellPrice, so
 *    a price change in Caspio reprices open quotes with no deploy (Erik's Pricing=API
 *    rule). A hardcoded number is fallback-ONLY and must surface a visible warning.
 *    Counts — not a typed dollar amount — because server.js prices the ShopWorks
 *    `addOns` from Service_Codes (FLAT → qty × SellPrice); a typed amount would be
 *    quoted to the customer and never billed.
 *
 * 2. The save (dtg-quote-page.js handleSaveQuote) puts the charges in the SESSION
 *    COLUMNS, not fee line items: quote-view.js/invoice.js render GRT-50/GRT-75 from
 *    ArtCharge/GraphicDesignCharge and their fee-item catch-all suppresses those codes
 *    once the columns are non-zero — writing both would double-bill. TotalAmount must
 *    therefore INCLUDE the charges (unlike shipping, which the readers add on top from
 *    the SHIP item), and TaxAmount stays verbatim from the on-screen quote.
 */

const path = require('path');
const esbuild = require('esbuild');

// ---------------------------------------------------------------------------
// Part 1 — builders/dtg/fees.js (ESM; transpiled with the same esbuild the build
// uses, so the test also keeps the module honest about bundle-ability).
// ---------------------------------------------------------------------------
// One bundle re-exporting BOTH fees.js and the `state` it reads, so the test mutates
// the same module instance artFeeTotals() closes over (two separate bundles would
// each get their own copy of state.js).
function loadFees(win) {
    const result = esbuild.buildSync({
        stdin: {
            contents: "export { artFeeTotals, artFeeAddOns } from './fees.js';\nexport { state } from './state.js';\n",
            resolveDir: path.join(__dirname, '../../shared_components/js/builders/dtg'),
            loader: 'js',
        },
        bundle: true,
        format: 'cjs',
        target: 'es2020',
        write: false,
        logLevel: 'silent',
    });
    const moduleObj = { exports: {} };
    const storage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
    // eslint-disable-next-line no-new-func
    new Function('module', 'exports', 'window', 'console', 'localStorage', 'fetch', result.outputFiles[0].text)(
        moduleObj, moduleObj.exports, win, win.console, storage, win.fetch
    );
    return moduleObj.exports;
}

function makeFeesWin(serviceCodes) {
    const win = {
        APP_CONFIG: { API: { BASE_URL: 'http://test' } },
        console: { error: () => {}, warn: () => {}, log: () => {} },
        fetch: () => Promise.reject(new Error('no network in test')),
        warnIfServiceCodeMissing: jest.fn(),
    };
    if (serviceCodes !== undefined) win._serviceCodes = serviceCodes;
    return win;
}

const LIVE_CODES = { 'GRT-50': { SellPrice: '50' }, 'GRT-75': { SellPrice: '75' } };

describe('builders/dtg/fees.js — counts × the LIVE Caspio rate', () => {
    test('nothing charged by default: zero totals and no ShopWorks add-ons', () => {
        const win = makeFeesWin(LIVE_CODES);
        const mod = loadFees(win);
        const f = mod.artFeeTotals();
        expect(f.artCharge).toBe(0);
        expect(f.graphicDesignCharge).toBe(0);
        expect(f.total).toBe(0);
        expect(mod.artFeeAddOns()).toEqual([]);
        // A quote that isn't charging the fee must not nag about its rate.
        expect(win.warnIfServiceCodeMissing).not.toHaveBeenCalled();
    });

    test('GRT-50 × count and GRT-75 × hours use the live SellPrice', () => {
        const win = makeFeesWin(LIVE_CODES);
        const mod = loadFees(win);
        mod.state.fees.artSetupQty = 2;
        mod.state.fees.designHours = 1.5;
        const f = mod.artFeeTotals();
        expect(f.artSetupRate).toBe(50);
        expect(f.artCharge).toBeCloseTo(100, 2);
        expect(f.designRate).toBe(75);
        expect(f.graphicDesignCharge).toBeCloseTo(112.5, 2);
        expect(f.total).toBeCloseTo(212.5, 2);
    });

    test('a Caspio price change flows straight through — nothing is hardcoded', () => {
        const win = makeFeesWin({ 'GRT-50': { SellPrice: '65' }, 'GRT-75': { SellPrice: '95' } });
        const mod = loadFees(win);
        mod.state.fees.artSetupQty = 1;
        mod.state.fees.designHours = 2;
        const f = mod.artFeeTotals();
        expect(f.artCharge).toBeCloseTo(65, 2);          // NOT the $50 fallback
        expect(f.graphicDesignCharge).toBeCloseTo(190, 2); // NOT 2 × $75
    });

    test('codes missing from the API → documented fallback AND a visible warning', () => {
        const win = makeFeesWin({});                 // fetched, but neither code present
        const mod = loadFees(win);
        mod.state.fees.artSetupQty = 1;
        mod.state.fees.designHours = 1;
        const f = mod.artFeeTotals();
        expect(f.artCharge).toBeCloseTo(50, 2);
        expect(f.graphicDesignCharge).toBeCloseTo(75, 2);
        // Erik's #1 rule: a fallback price is never silent.
        expect(win.warnIfServiceCodeMissing).toHaveBeenCalledWith('GRT-50', 50, 'Art setup');
        expect(win.warnIfServiceCodeMissing).toHaveBeenCalledWith('GRT-75', 75, 'Graphic design');
    });

    test('garbage / negative counts resolve to no charge (never a negative line)', () => {
        const win = makeFeesWin(LIVE_CODES);
        const mod = loadFees(win);
        mod.state.fees.artSetupQty = -3;
        mod.state.fees.designHours = NaN;
        const f = mod.artFeeTotals();
        expect(f.artSetupQty).toBe(0);
        expect(f.artCharge).toBe(0);
        expect(f.designHours).toBe(0);
        expect(f.graphicDesignCharge).toBe(0);
        expect(mod.artFeeAddOns()).toEqual([]);
    });

    test('addOns carry the COUNT so server.js reprices them to the same dollars', () => {
        const win = makeFeesWin(LIVE_CODES);
        const mod = loadFees(win);
        mod.state.fees.artSetupQty = 2;
        mod.state.fees.designHours = 1.5;
        // server.js: FLAT → LinesOE price = qty × SellPrice. 2×50 + 1.5×75 = 212.50,
        // which is exactly artFeeTotals().total — the push cannot drift from the quote.
        expect(mod.artFeeAddOns()).toEqual([
            { code: 'GRT-50', qty: 2 },
            { code: 'GRT-75', qty: 1.5 },
        ]);
        const f = mod.artFeeTotals();
        const pushed = 2 * Number(LIVE_CODES['GRT-50'].SellPrice) + 1.5 * Number(LIVE_CODES['GRT-75'].SellPrice);
        expect(pushed).toBeCloseTo(f.total, 2);
    });

    test('only the charged code is billed when just one is used', () => {
        const win = makeFeesWin(LIVE_CODES);
        const mod = loadFees(win);
        mod.state.fees.artSetupQty = 1;
        mod.state.fees.designHours = 0;
        expect(mod.artFeeAddOns()).toEqual([{ code: 'GRT-50', qty: 1 }]);
        expect(mod.artFeeTotals().total).toBeCloseTo(50, 2);
    });
});

// ---------------------------------------------------------------------------
// Part 2 — the SAVE path (dtg-quote-page.js). Same harness as dtg-tax-base.test.js:
// the page is a browser IIFE, so load it via Function injection, stub the DOM so
// init() never fires, mock the form quote + fetch, and assert what was POSTed.
// ---------------------------------------------------------------------------
const fs = require('fs');

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
    const doc = { addEventListener: () => {}, getElementById: () => null, querySelector: () => null, querySelectorAll: () => [] };
    const quietConsole = { log() {}, warn() {}, error() {}, info() {} };
    const mkStorage = () => { const m = {}; return { getItem: (k) => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, removeItem: (k) => { delete m[k]; }, clear: () => {} }; };
    const loc = { origin: 'http://test', href: 'http://test/quote-builders/dtg-quote-builder.html' };
    const nav = { clipboard: { writeText: () => Promise.resolve() } };
    // eslint-disable-next-line no-new-func
    const factory = new Function('window', 'document', 'fetch', 'console', 'sessionStorage', 'localStorage', 'location', 'navigator',
        code + '\nreturn { save: window.dtgSaveQuote };');
    win.document = doc;
    factory(win, doc, fetchMock, quietConsole, mkStorage(), mkStorage(), loc, nav);
    return win;
}

// Shape computePriceQuoteFromState() returns. Products 205.92; art charges vary.
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
    shipping: { method: 'Customer Pickup', city: '', state: '', zip: '', taxRate: 0.101, taxRateSource: 'pickup-flat', taxAccount: '2200.101', taxAccountName: 'Wash:10.1%', taxRateOverride: null, includeTax: true },
}, over || {});

async function saveAndCapture(quote) {
    const captured = [];
    const win = loadPage(captured);
    win.DTGInlineForm = { getSaveQuote: () => quote };
    await win.dtgSaveQuote();
    const session = captured.find(c => c.url.indexOf('/api/quote_sessions') !== -1);
    const itemPosts = captured.filter(c => c.url.indexOf('/api/quote_items') !== -1 && c.method === 'POST' && c.body);
    return { session: session && session.body, itemPosts: itemPosts.map(c => c.body) };
}

describe('DTG save — art charges in the session columns', () => {
    // 1 setup @ $50 + 1.5 hrs @ $75 = $162.50 of art on top of $205.92 of product.
    // Tax is on (205.92 + 162.50) × 10.1% = 37.21 → grand 405.63.
    const withArt = () => formQuote({
        artSetupQty: 1, artSetupRate: 50, artCharge: 50,
        graphicDesignHours: 1.5, graphicDesignRate: 75, graphicDesignCharge: 112.5,
        artFeesTotal: 162.5,
        taxAmount: 37.21, grandTotal: 405.63,
        totals: { subtotal: 205.92, artFeesTotal: 162.5, taxRate: 0.101, taxAmount: 37.21, grandTotal: 405.63 },
    });

    test('columns carry the charges; SubtotalAmount stays products-only', async () => {
        const { session } = await saveAndCapture(withArt());
        expect(session.ArtCharge).toBeCloseTo(50, 2);
        expect(session.GraphicDesignHours).toBeCloseTo(1.5, 2);
        expect(session.GraphicDesignCharge).toBeCloseTo(112.5, 2);
        expect(session.SubtotalAmount).toBeCloseTo(205.92, 2);   // products only
    });

    test('TotalAmount INCLUDES the art charges and stays PRE-tax', async () => {
        const { session } = await saveAndCapture(withArt());
        expect(session.TotalAmount).toBeCloseTo(368.42, 2);        // 205.92 + 162.50
        expect(session.TotalAmount).not.toBeCloseTo(205.92, 2);    // fees not dropped
        expect(session.TotalAmount).not.toBeCloseTo(405.63, 2);    // tax not baked in
        // /quote + /invoice reconstruct grand = TotalAmount + TaxAmount (the columns are
        // rendered from ArtCharge/GraphicDesignCharge, NOT re-added) → must foot.
        expect(session.TotalAmount + session.TaxAmount).toBeCloseTo(405.63, 2);
    });

    test('tax rides verbatim from the on-screen quote (already on the fee-inclusive base)', async () => {
        const { session } = await saveAndCapture(withArt());
        expect(session.TaxRate).toBeCloseTo(0.101, 4);             // DECIMAL, like EMB
        expect(session.TaxAmount).toBeCloseTo(37.21, 2);
        // Sanity: that IS round((products + art) × rate) — art is taxed, not exempted.
        expect(Math.round((205.92 + 162.5) * 0.101 * 100) / 100).toBeCloseTo(session.TaxAmount, 2);
    });

    test('no GRT-50/GRT-75 fee LINE ITEMS — the readers would double-bill against the columns', async () => {
        const { itemPosts } = await saveAndCapture(withArt());
        const feeCodes = itemPosts.filter(i => ['GRT-50', 'GRT-75'].includes(i.StyleNumber));
        expect(feeCodes).toHaveLength(0);
        expect(itemPosts.filter(i => i.EmbellishmentType === 'dtg')).toHaveLength(1);
    });

    test('Notes.fees round-trips the COUNTS for edit-reopen (not the dollars)', async () => {
        const { session } = await saveAndCapture(withArt());
        const notes = JSON.parse(session.Notes);
        expect(notes.fees).toEqual({ artSetupQty: 1, designHours: 1.5 });
    });

    test('wholesale/exempt: art is still billed, tax still 0', async () => {
        const { session } = await saveAndCapture(formQuote({
            artSetupQty: 1, artCharge: 50, graphicDesignHours: 0, graphicDesignCharge: 0, artFeesTotal: 50,
            taxRate: 0, taxAmount: 0, isWholesale: true, grandTotal: 255.92,
            totals: { subtotal: 205.92, artFeesTotal: 50, taxRate: 0, taxAmount: 0, grandTotal: 255.92 },
        }));
        expect(session.ArtCharge).toBeCloseTo(50, 2);
        expect(session.TotalAmount).toBeCloseTo(255.92, 2);
        expect(session.TaxAmount).toBe(0);
        expect(session.IsWholesale).toBe('Yes');
        expect(session.TotalAmount + session.TaxAmount).toBeCloseTo(255.92, 2);
    });

    test('shipping and art coexist: SHIP item carries shipping, columns carry art', async () => {
        // 205.92 products + 162.50 art + 25 shipping; tax 10.1% on all three = 39.73.
        const { session, itemPosts } = await saveAndCapture(formQuote({
            artSetupQty: 1, artCharge: 50, graphicDesignHours: 1.5, graphicDesignCharge: 112.5, artFeesTotal: 162.5,
            shippingFee: 25, taxAmount: 39.73, grandTotal: 433.15,
            totals: { subtotal: 205.92, artFeesTotal: 162.5, shippingFee: 25, taxRate: 0.101, taxAmount: 39.73, grandTotal: 433.15 },
        }));
        const shipItem = itemPosts.find(i => i.StyleNumber === 'SHIP');
        expect(session.TotalAmount).toBeCloseTo(368.42, 2);   // products + art, NOT shipping
        expect(shipItem).toBeTruthy();
        expect(shipItem.LineTotal).toBeCloseTo(25, 2);
        // Reader footing: TotalAmount + SHIP + TaxAmount == the on-screen grand.
        expect(session.TotalAmount + shipItem.LineTotal + session.TaxAmount).toBeCloseTo(433.15, 2);
    });

    test('REGRESSION: a quote with no art charge saves exactly as it did before', async () => {
        const { session } = await saveAndCapture(formQuote());
        expect(session.TotalAmount).toBeCloseTo(205.92, 2);   // == SubtotalAmount, unchanged
        expect(session.ArtCharge).toBe(0);
        expect(session.GraphicDesignCharge).toBe(0);
        expect(session.GraphicDesignHours).toBe(0);
        expect(session.TotalAmount + session.TaxAmount).toBeCloseTo(226.72, 2);
    });
});
