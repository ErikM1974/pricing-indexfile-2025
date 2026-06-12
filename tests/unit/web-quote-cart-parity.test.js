/**
 * web-quote-cart-parity.test.js — Customer quote-cart engine parity lock.
 *
 * Every worked example in memory/CUSTOMER_QUOTE_CART_DESIGN_2026-06.md (the
 * design bible — examples were produced by EXECUTING the staff engines against
 * the live API) is asserted here to EXACT dollar equality against
 * shared_components/js/quote-cart-engine.js.
 *
 * Fixtures: tests/fixtures/pricing/*.json — captured FRESH from the live
 * caspio-pricing-proxy on 2026-06-11 (same day the design doc's examples were
 * executed). The 8 dtg-quote-*.json files are recorded POST
 * /api/dtg/quote-pricing responses for the exact worked-example bodies.
 * All network access is mocked to serve those captures.
 *
 * Also covers: the P0 manual-cost host gate across ALL FIVE pricing services
 * (gate ON for customer hosts — SCP was the live hole fixed this wave), and a
 * source-string canary asserting the engine's findPricingTier copy still
 * matches screenprint-quote-builder.js verbatim.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const FIXTURE_DIR = path.join(ROOT, 'tests', 'fixtures', 'pricing');
const fixture = (name) => JSON.parse(fs.readFileSync(path.join(FIXTURE_DIR, name), 'utf8'));

// ---------------------------------------------------------------------------
// Browser shims (must exist BEFORE the pricing services are required — they
// set window globals and read window.location/sessionStorage at call time).
// Default host = a CUSTOMER domain so the manual-cost gates are ON for every
// engine pricing run in this file.
// ---------------------------------------------------------------------------
const CUSTOMER_HOST = 'www.nwcustomapparel.com';
global.window = {
    location: { hostname: CUSTOMER_HOST, search: '', href: 'https://' + CUSTOMER_HOST + '/' },
    APP_CONFIG: { API: { BASE_URL: 'https://api.test' } }
};
global.sessionStorage = {
    _s: {},
    getItem(k) { return Object.prototype.hasOwnProperty.call(this._s, k) ? this._s[k] : null; },
    setItem(k, v) { this._s[k] = String(v); },
    removeItem(k) { delete this._s[k]; },
    clear() { this._s = {}; }
};
global.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };

// ---------------------------------------------------------------------------
// fetch mock — serves the captured fixtures; throws on any unmocked URL so a
// new adapter fetch can never silently hit the live network from jest.
// ---------------------------------------------------------------------------
function okJson(data) {
    return { ok: true, status: 200, json: async () => data, text: async () => JSON.stringify(data) };
}

// Order matters: more specific keys first.
const GET_ROUTES = [
    ['method=EMB-AL', 'emb-al-bundle.json'],
    ['method=EMB&styleNumber=', 'emb-bundle-PC54.json'], // calculator always inits from PC54
    ['method=CAP-AL', 'cap-al-bundle.json'],
    ['method=CAP-PUFF', 'cap-puff-bundle.json'],
    ['method=CAP&styleNumber=', 'cap-bundle-C112.json'],
    ['method=PATCH', 'patch-bundle.json'],
    ['/api/service-codes', 'service-codes.json'],
    ['/api/size-pricing?styleNumber=PC61', 'size-pricing-PC61.json'],
    ['/api/size-pricing?styleNumber=PC90H', 'size-pricing-PC90H.json'],
    ['/api/size-pricing?styleNumber=C112', 'size-pricing-C112.json'],
    ['method=ScreenPrint&styleNumber=PC61', 'scp-bundle-PC61.json'],
    ['method=ScreenPrint&styleNumber=PC54', 'scp-bundle-PC54.json'],
    ['method=BLANK&styleNumber=PC61', 'blank-bundle-PC61.json'],
    ['method=BLANK&styleNumber=PC54', 'blank-bundle-PC54.json'],
    ['method=DTF', 'dtf-bundle.json']
];

function dtgKey(body) {
    return body.locationCode + '|' + body.lines.map(
        (l) => l.styleNumber + ':' + Object.entries(l.sizes).map(([s, q]) => s + '=' + q).join(',')
    ).join('|');
}
const DTG_FIXTURES = {
    'LC|PC61:M=24': 'dtg-quote-a-LC-24.json',
    'LC_FB|PC61:M=24': 'dtg-quote-b-LCFB-24.json',
    'FF|PC61:M=12': 'dtg-quote-c-FF-12.json',
    'LC|PC61:M=12|PC54:M=12': 'dtg-quote-d-pooled.json',
    'LC|PC61:M=12': 'dtg-quote-d-ctrl-PC61-12.json',
    'LC|PC54:M=12': 'dtg-quote-d-ctrl-PC54-12.json',
    'LC|PC61:M=18,2XL=6': 'dtg-quote-mixed-size-24.json',
    'FF|PC61:M=24': 'dtg-quote-c-nudge-FF-24.json'
};

let serviceCodesDown = false;

const mockFetch = jest.fn(async (url, opts = {}) => {
    url = String(url);
    const method = (opts.method || 'GET').toUpperCase();
    if (method === 'POST' && url.includes('/api/dtg/quote-pricing')) {
        const body = JSON.parse(opts.body);
        const file = DTG_FIXTURES[dtgKey(body)];
        if (!file) {
            return { ok: false, status: 404, json: async () => ({}), text: async () => 'No DTG fixture for ' + dtgKey(body) };
        }
        return okJson(fixture(file));
    }
    if (url.includes('/api/service-codes') && serviceCodesDown) {
        return { ok: false, status: 503, json: async () => ({}), text: async () => 'service unavailable' };
    }
    const hit = GET_ROUTES.find(([key]) => url.includes(key));
    if (!hit) throw new Error('Unmocked URL in test: ' + url);
    return okJson(fixture(hit[1]));
});
global.fetch = mockFetch;
global.window.fetch = mockFetch;

// ---------------------------------------------------------------------------
// Load the authorities (window-global modules) + the engine
// ---------------------------------------------------------------------------
const EmbroideryPricingCalculator = require('../../shared_components/js/embroidery-quote-pricing.js');
require('../../shared_components/js/screenprint-pricing-service.js');
const ScreenPrintPricingService = global.window.ScreenPrintPricingService;
require('../../shared_components/js/dtf-pricing-service.js');
const DTFPricingService = global.window.DTFPricingService;
require('../../shared_components/js/dtg-pricing-service.js');
const DTGPricingService = global.window.DTGPricingService;
require('../../shared_components/js/embroidery-pricing-service.js');
const EmbroideryPricingService = global.window.EmbroideryPricingService;
require('../../shared_components/js/cap-embroidery-pricing-service.js');
const CapEmbroideryPricingService = global.window.CapEmbroideryPricingService;

let DTFConfig = null;
try {
    require('../../shared_components/js/dtf-quote-pricing.js'); // window.DTFConfig (location→size authority)
    DTFConfig = global.window.DTFConfig;
} catch (e) {
    DTFConfig = null; // engine falls back to its exact structural copy
}

const QuoteCartEngine = require('../../shared_components/js/quote-cart-engine.js');

const DEPS = { EmbroideryPricingCalculator, ScreenPrintPricingService, DTFPricingService, DTFConfig };
const run = (cart, opts = {}) =>
    QuoteCartEngine.priceCart(cart, { deps: DEPS, fetch: mockFetch, apiBase: 'https://api.test', nudge: false, ...opts });
const preview = (item, opts = {}) =>
    QuoteCartEngine.singleItemPreview(item, { deps: DEPS, fetch: mockFetch, apiBase: 'https://api.test', ...opts });

beforeAll(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
});
beforeEach(() => {
    serviceCodesDown = false;
    global.sessionStorage.clear();
    global.window.location.hostname = CUSTOMER_HOST;
    global.window.location.search = '';
});

// ---------------------------------------------------------------------------
// Cart helpers
// ---------------------------------------------------------------------------
const EMB_LOGOS_LC = { logos: { primary: { position: 'Left Chest', stitchCount: 8000, needsDigitizing: false }, additional: [] } };
const EMB_LOGOS_LC_PLUS_BACK = {
    logos: {
        primary: { position: 'Left Chest', stitchCount: 8000, needsDigitizing: false },
        additional: [{ position: 'Back', stitchCount: 8000, needsDigitizing: false }]
    }
};
const CAP_LOGOS_FRONT_PLUS_BACK = {
    logos: {
        primary: { position: 'Cap Front', stitchCount: 8000, needsDigitizing: false },
        additional: [{ position: 'Cap Back', stitchCount: 5000, needsDigitizing: false }]
    }
};

const pc61Emb = (sizes, id = 'e1') =>
    ({ id, method: 'EMB', styleNumber: 'PC61', title: 'PC61 Tee', colorName: 'Deep Marine', catalogColor: 'DeepMarine', sizes });
const pc90hEmb = (sizes, id = 'e2') =>
    ({ id, method: 'EMB', styleNumber: 'PC90H', title: 'PC90H Hoodie', colorName: 'Dark Heather Grey', catalogColor: 'DkHthGry', sizes });
const c112Cap = (sizes, id = 'c1') =>
    ({ id, method: 'CAP', styleNumber: 'C112', title: 'C112 Trucker', colorName: 'Rich Navy', catalogColor: 'RichNvy', sizes, isCap: true });
const dtgItem = (style, sizes, id = 'd1') =>
    ({ id, method: 'DTG', styleNumber: style, colorName: 'Jet Black', catalogColor: 'JetBlack', sizes });
const scpItem = (style, sizes, id = 's1') =>
    ({ id, method: 'SCP', styleNumber: style, colorName: 'White', catalogColor: 'White', sizes });
const dtfItem = (style, sizes, id = 'f1') =>
    ({ id, method: 'DTF', styleNumber: style, colorName: 'Jet Black', catalogColor: 'JetBlack', sizes });

const groupOf = (res, gid) => res.groups.find((g) => g.groupId === gid);

// ===========================================================================
// EMBROIDERY — worked examples (a)-(d) + LTM display/footing rules
// ===========================================================================
describe('EMB parity (EmbroideryPricingCalculator authority)', () => {
    test('(a) 24× PC61 LC 8K + additional back logo 8K = $696.00 (unit $21, AL $8×24)', async () => {
        const res = await run({
            items: [pc61Emb({ S: 6, M: 6, L: 6, XL: 6 })],
            groups: { 'emb:garment': EMB_LOGOS_LC_PLUS_BACK }
        });
        expect(res.errors).toEqual([]);
        const g = groupOf(res, 'emb:garment');
        expect(g.tierLabel).toBe('24-47');
        expect(g.pooledQty).toBe(24);
        expect(g.lines).toHaveLength(1);
        expect(g.lines[0].baseUnit).toBe(21);
        expect(g.lines[0].lineTotal).toBe(504);
        const al = g.serviceLines.find((s) => s.code === 'AL');
        expect(al.unitPrice).toBe(8);
        expect(al.quantity).toBe(24);
        expect(al.total).toBe(192);
        expect(g.groupTotal).toBe(696);
        expect(res.grandTotal).toBe(696);
        expect(g.trace.source).toBe('emb-calculator');
        expect(g.trace.marginDenominator).toBe(0.53);
        expect(g.trace.embCost).toBe(14);
        expect(g.trace.roundingMethod).toBe('CeilDollar');
    });

    test('(a variant) both logos needing digitizing add $100 each → $896.00', async () => {
        const res = await run({
            items: [pc61Emb({ S: 6, M: 6, L: 6, XL: 6 })],
            groups: {
                'emb:garment': {
                    logos: {
                        primary: { position: 'Left Chest', stitchCount: 8000, needsDigitizing: true },
                        additional: [{ position: 'Back', stitchCount: 8000, needsDigitizing: true }]
                    }
                }
            }
        });
        const g = groupOf(res, 'emb:garment');
        const dd = g.fees.find((f) => f.code === 'DD');
        expect(dd.amount).toBe(200);
        expect(dd.oneTime).toBe(true);
        expect(g.groupTotal).toBe(896);
    });

    test('(b) 5× PC61 LC — LTM baked: effective $35.00/pc, foot $125 + exact $50 = $175.00', async () => {
        const res = await run({
            items: [pc61Emb({ S: 2, M: 2, L: 1 })],
            groups: { 'emb:garment': EMB_LOGOS_LC }
        });
        const g = groupOf(res, 'emb:garment');
        expect(g.tierLabel).toBe('1-7');
        expect(g.lines[0].baseUnit).toBe(25);
        expect(g.lines[0].effectiveUnit).toBe(35);
        expect(g.lines[0].lineTotal).toBe(125);
        expect(g.ltm).toEqual({ fee: 50, perUnit: 10, mode: 'baked' });
        expect(g.groupTotal).toBe(175);
    });

    test('(c) 12× PC61 + 12× PC90H POOL to 24-47 = $780.00; 12× PC61 alone control = $300.00', async () => {
        const pooled = await run({
            items: [pc61Emb({ S: 3, M: 3, L: 3, XL: 3 }), pc90hEmb({ S: 3, M: 3, L: 3, XL: 3 })],
            groups: { 'emb:garment': EMB_LOGOS_LC }
        });
        const g = groupOf(pooled, 'emb:garment');
        expect(g.pooledQty).toBe(24);
        expect(g.tierLabel).toBe('24-47');
        const pc61Line = g.lines.find((l) => l.styleNumber === 'PC61');
        const pc90hLine = g.lines.find((l) => l.styleNumber === 'PC90H');
        expect(pc61Line.baseUnit).toBe(21);
        expect(pc61Line.lineTotal).toBe(252);
        expect(pc90hLine.baseUnit).toBe(44);
        expect(pc90hLine.lineTotal).toBe(528);
        expect(g.groupTotal).toBe(780);

        const control = await run({
            items: [pc61Emb({ S: 3, M: 3, L: 3, XL: 3 })],
            groups: { 'emb:garment': EMB_LOGOS_LC }
        });
        const cg = groupOf(control, 'emb:garment');
        expect(cg.tierLabel).toBe('8-23');
        expect(cg.lines[0].baseUnit).toBe(25);
        expect(cg.groupTotal).toBe(300);
    });

    test('(d) 24× C112 cap front 8K + Cap Back AL 5K = $594.00 (cap unit $20 CeilDollar, CB $4.75)', async () => {
        const res = await run({
            items: [c112Cap({ OSFA: 24 })],
            groups: { 'emb:cap': CAP_LOGOS_FRONT_PLUS_BACK }
        });
        expect(res.errors).toEqual([]);
        const g = groupOf(res, 'emb:cap');
        expect(g.method).toBe('CAP');
        expect(g.tierLabel).toBe('24-47');
        expect(g.lines[0].baseUnit).toBe(20);
        expect(g.lines[0].lineTotal).toBe(480);
        const cb = g.serviceLines.find((s) => s.code === 'CB');
        expect(cb.unitPrice).toBe(4.75);
        expect(cb.total).toBe(114);
        expect(g.groupTotal).toBe(594);
        expect(g.trace.roundingMethod).toBe('CeilDollar'); // cap rounding is CeilDollar — memory doc was stale
    });

    test('7-pc penny-drift rule: display $32.14/pc but foot 7×$25 + exact $50 = $225.00 (never 224.98)', async () => {
        const res = await run({
            items: [pc61Emb({ S: 2, M: 2, L: 2, XL: 1 })],
            groups: { 'emb:garment': EMB_LOGOS_LC }
        });
        const g = groupOf(res, 'emb:garment');
        expect(g.lines[0].effectiveUnitDisplay).toBe(32.14);
        expect(g.groupTotal).toBe(225);
        // re-multiplying the rounded display unit would drift — engine must not do it
        expect(Math.round(g.lines[0].effectiveUnitDisplay * 7 * 100) / 100).toBe(224.98);
    });

    test('2XL upcharge is +$2 AFTER CeilDollar (unit $23 at 24-47), pieces count fully toward the tier', async () => {
        const res = await run({
            items: [pc61Emb({ S: 6, M: 6, L: 6, XL: 4, '2XL': 2 })],
            groups: { 'emb:garment': EMB_LOGOS_LC }
        });
        const g = groupOf(res, 'emb:garment');
        expect(g.pooledQty).toBe(24);
        expect(g.tierLabel).toBe('24-47');
        const std = g.lines.find((l) => l.qty === 22);
        const up = g.lines.find((l) => l.qty === 2);
        expect(std.baseUnit).toBe(21);
        expect(up.baseUnit).toBe(23);
        expect(g.groupTotal).toBe(508);
    });

    test('AL inside an LTM order never double-charges LTM ($225, not $275)', async () => {
        const res = await run({
            items: [pc61Emb({ S: 2, M: 2, L: 1 })],
            groups: { 'emb:garment': EMB_LOGOS_LC_PLUS_BACK }
        });
        const g = groupOf(res, 'emb:garment');
        const al = g.serviceLines.find((s) => s.code === 'AL');
        expect(al.unitPrice).toBe(10); // 1-7 AL tier cost — NO extra ltmFee folded in
        expect(al.total).toBe(50);
        expect(g.ltm.fee).toBe(50); // exactly one $50 LTM for the category
        expect(g.groupTotal).toBe(225); // 125 products + 50 LTM + 50 AL
    });

    test('caps NEVER pool with garments: 12 shirts + 12 caps tier at 8-23 EACH', async () => {
        const res = await run({
            items: [pc61Emb({ S: 3, M: 3, L: 3, XL: 3 }), c112Cap({ OSFA: 12 })],
            groups: {
                'emb:garment': EMB_LOGOS_LC,
                'emb:cap': { logos: { primary: { position: 'Cap Front', stitchCount: 8000, needsDigitizing: false }, additional: [] } }
            }
        });
        expect(res.errors).toEqual([]);
        const garments = groupOf(res, 'emb:garment');
        const caps = groupOf(res, 'emb:cap');
        expect(garments.tierLabel).toBe('8-23');
        expect(caps.tierLabel).toBe('8-23');
        expect(garments.pooledQty).toBe(12);
        expect(caps.pooledQty).toBe(12);
        expect(garments.groupTotal).toBe(300); // ceil(3.53/0.53+18)=25 × 12
        expect(caps.groupTotal).toBe(288);     // ceil(3.41/0.53+17)=24 × 12
        expect(res.grandTotal).toBe(588);
    });

    test('cross-implementation equality: engine groups sum == one direct calculateQuote run (garments + caps)', async () => {
        const res = await run({
            items: [pc61Emb({ S: 6, M: 6, L: 6, XL: 6 }), c112Cap({ OSFA: 24 })],
            groups: { 'emb:garment': EMB_LOGOS_LC_PLUS_BACK, 'emb:cap': CAP_LOGOS_FRONT_PLUS_BACK }
        });
        const engineSum = groupOf(res, 'emb:garment').groupTotal + groupOf(res, 'emb:cap').groupTotal;

        // Direct run of the SAME staff class on identical combined inputs
        const calc = new EmbroideryPricingCalculator({ skipInit: true });
        await calc.initializeConfig();
        await calc.initializeCapConfig();
        const products = [
            {
                style: 'PC61', color: 'Deep Marine', catalogColor: 'DeepMarine', title: 'PC61',
                sizeBreakdown: { S: 6, M: 6, L: 6, XL: 6 }, totalQuantity: 24, isCap: false,
                sellPriceOverride: 0, sizeOverrides: {},
                logoAssignments: { primary: { logoId: 'primary', quantity: 24 }, additional: [{ id: 'al-0', position: 'Back', stitchCount: 8000, quantity: 24 }] }
            },
            {
                style: 'C112', color: 'Rich Navy', catalogColor: 'RichNvy', title: 'C112',
                sizeBreakdown: { OSFA: 24 }, totalQuantity: 24, isCap: true,
                sellPriceOverride: 0, sizeOverrides: {},
                logoAssignments: { primary: { logoId: 'primary', quantity: 24 }, additional: [{ id: 'al-0', position: 'Cap Back', stitchCount: 5000, quantity: 24 }] }
            }
        ];
        const logoConfigs = {
            garment: { primary: { position: 'Left Chest', stitchCount: 8000, needsDigitizing: false }, additional: [{ position: 'Back', stitchCount: 8000, needsDigitizing: false }] },
            cap: { primary: { position: 'Cap Front', stitchCount: 8000, needsDigitizing: false }, additional: [{ position: 'Cap Back', stitchCount: 5000, needsDigitizing: false }] }
        };
        const direct = await calc.calculateQuote(products, [], logoConfigs, { ltmEnabled: true });
        expect(direct.grandTotal).toBe(1290); // 696 garments + 594 caps
        expect(engineSum).toBe(direct.grandTotal);
        expect(res.grandTotal).toBe(1290);
    });
});

// ===========================================================================
// DTG — worked examples (a)-(d) + inversion quirk + combo anti-double-count
// ===========================================================================
describe('DTG parity (POST /api/dtg/quote-pricing authority, consumed verbatim)', () => {
    test('(a) 24× PC61 M, LC → $14.50/pc, $348.00, tier 24-47, no LTM', async () => {
        const res = await run({
            items: [dtgItem('PC61', { M: 24 })],
            groups: { 'dtg:main': { locationCode: 'LC' } }
        });
        expect(res.errors).toEqual([]);
        const g = groupOf(res, 'dtg:main');
        expect(g.tierLabel).toBe('24-47');
        expect(g.lines[0].baseUnit).toBe(14.5);
        expect(g.lines[0].lineTotal).toBe(348);
        expect(g.ltm.fee).toBe(0);
        expect(g.groupTotal).toBe(348);
        expect(g.trace.source).toBe('dtg-endpoint');
    });

    test('(b) LC_FB combo re-derives the unit: $24.50/pc, $588.00 — NOT $31.50 (no garment double-count)', async () => {
        const res = await run({
            items: [dtgItem('PC61', { M: 24 })],
            groups: { 'dtg:main': { locationCode: 'LC_FB' } }
        });
        const g = groupOf(res, 'dtg:main');
        expect(g.lines[0].baseUnit).toBe(24.5);
        expect(g.lines[0].baseUnit).not.toBe(31.5); // 14.50 + 17.00 separately-rounded = WRONG
        expect(g.groupTotal).toBe(588);
    });

    test('(c) 12× PC61 FF — honest LTM: base $16.50 + floor(50/12)=$4.16 → $20.66/pc, subtotal $247.92 (floor under-recovery, never $250)', async () => {
        const res = await run({
            items: [dtgItem('PC61', { M: 12 })],
            groups: { 'dtg:main': { locationCode: 'FF' } }
        });
        const g = groupOf(res, 'dtg:main');
        expect(g.tierLabel).toBe('1-23 (LTM)');
        expect(g.lines[0].baseUnit).toBe(16.5);
        expect(g.lines[0].effectiveUnit).toBe(20.66);
        expect(g.ltm).toEqual({ fee: 50, perUnit: 4.16, mode: 'baked' });
        expect(g.groupTotal).toBe(247.92);
        expect(g.groupTotal).not.toBe(250); // do NOT re-add a $50 line
    });

    test('(d) mixed-style pooling: 12 PC61 + 12 PC54 share tier 24-47 ($336.00); unpooled controls total $423.84', async () => {
        const pooled = await run({
            items: [dtgItem('PC61', { M: 12 }, 'd1'), dtgItem('PC54', { M: 12 }, 'd2')],
            groups: { 'dtg:main': { locationCode: 'LC' } }
        });
        const g = groupOf(pooled, 'dtg:main');
        expect(g.pooledQty).toBe(24);
        expect(g.tierLabel).toBe('24-47');
        expect(g.lines.find((l) => l.styleNumber === 'PC61').baseUnit).toBe(14.5);
        expect(g.lines.find((l) => l.styleNumber === 'PC54').baseUnit).toBe(13.5);
        expect(g.groupTotal).toBe(336);

        const ctrl61 = await run({ items: [dtgItem('PC61', { M: 12 })], groups: { 'dtg:main': { locationCode: 'LC' } } });
        const ctrl54 = await run({ items: [dtgItem('PC54', { M: 12 })], groups: { 'dtg:main': { locationCode: 'LC' } } });
        const unpooled = groupOf(ctrl61, 'dtg:main').groupTotal + groupOf(ctrl54, 'dtg:main').groupTotal;
        expect(groupOf(ctrl61, 'dtg:main').lines[0].effectiveUnit).toBe(18.16); // 14.00 base + 4.16 — the 1-23 base UNDERCUTS 24-47 (inversion), effective does not
        expect(groupOf(ctrl61, 'dtg:main').lines[0].baseUnit).toBe(14.0);
        expect(unpooled).toBe(423.84);
        expect(unpooled - g.groupTotal).toBeCloseTo(87.84, 2); // pooling saves $87.84
    });

    test('mixed sizes: 18 M + 6 2XL @ LC = 18×$14.50 + 6×$16.50 = $360.00', async () => {
        const res = await run({
            items: [dtgItem('PC61', { M: 18, '2XL': 6 })],
            groups: { 'dtg:main': { locationCode: 'LC' } }
        });
        const g = groupOf(res, 'dtg:main');
        const m = g.lines.find((l) => l.size === 'M');
        const xxl = g.lines.find((l) => l.size === '2XL');
        expect(m.baseUnit).toBe(14.5);
        expect(xxl.baseUnit).toBe(16.5);
        expect(g.groupTotal).toBe(360);
    });

    test('unpriceable combos FF_JB / JF_FB are rejected up front (grand total withheld)', async () => {
        for (const bad of ['FF_JB', 'JF_FB']) {
            const res = await run({
                items: [dtgItem('PC61', { M: 24 })],
                groups: { 'dtg:main': { locationCode: bad } }
            });
            expect(res.errors).toHaveLength(1);
            expect(res.errors[0].code).toBe('BAD_LOCATION');
            expect(res.grandTotal).toBeNull();
        }
    });
});

// ===========================================================================
// SCP — worked examples (a)-(d), separate-mode footing, dark-garment rule
// ===========================================================================
describe('SCP parity (ScreenPrintPricingService bundle + exact builder tier/rounding copies)', () => {
    const SCP_1C = { frontColors: 1, backColors: 0, darkGarment: false, safetyStripes: false };

    test('(a) 48× PC61, 1-color front → $13.00 base, separate-mode GRAND $704.00 (LTM $50 lives at 37-71!)', async () => {
        const res = await run({
            items: [scpItem('PC61', { S: 12, M: 12, L: 12, XL: 12 })],
            groups: { 'scp:design-1': SCP_1C }
        });
        expect(res.errors).toEqual([]);
        const g = groupOf(res, 'scp:design-1');
        expect(g.tierLabel).toBe('37-71');
        g.lines.forEach((l) => expect(l.baseUnit).toBe(13));
        expect(g.subtotal).toBe(624);
        expect(g.ltm).toMatchObject({ fee: 50, mode: 'itemized' });
        expect(g.fees.find((f) => f.code === 'SPSU').amount).toBe(30);
        expect(g.fees.find((f) => f.code === 'LTM').amount).toBe(50);
        expect(g.groupTotal).toBe(704); // builder separate mode + calculator v2 both foot here (builtin floor $703.92 is a non-goal)
        expect(g.trace.source).toBe('scp-replica');
    });

    test('(a 2XL spot) 2XL prices at $15.00 (upcharge before the single rounding)', async () => {
        const res = await run({
            items: [scpItem('PC61', { S: 12, M: 12, L: 12, XL: 6, '2XL': 6 })],
            groups: { 'scp:design-1': SCP_1C }
        });
        const g = groupOf(res, 'scp:design-1');
        expect(g.lines.find((l) => l.size === '2XL').baseUnit).toBe(15);
        expect(g.lines.find((l) => l.size === 'M').baseUnit).toBe(13);
    });

    test('(b) 2-color front + 1-color back: $14.50 + $5.50 (rounded SEPARATELY) = $20.00; setup 3×$30; GRAND $1,100.00', async () => {
        const res = await run({
            items: [scpItem('PC61', { S: 12, M: 12, L: 12, XL: 12 })],
            groups: { 'scp:design-1': { frontColors: 2, backColors: 1, darkGarment: false, safetyStripes: false } }
        });
        const g = groupOf(res, 'scp:design-1');
        g.lines.forEach((l) => expect(l.baseUnit).toBe(20));
        expect(g.subtotal).toBe(960);
        expect(g.fees.find((f) => f.code === 'SPSU').amount).toBe(90);
        expect(g.groupTotal).toBe(1100);
    });

    test('(b dark) underbase touches SETUP ONLY: per-piece identical, 5 screens = $150 → GRAND $1,160.00', async () => {
        const res = await run({
            items: [scpItem('PC61', { S: 12, M: 12, L: 12, XL: 12 })],
            groups: { 'scp:design-1': { frontColors: 2, backColors: 1, darkGarment: true, safetyStripes: false } }
        });
        const g = groupOf(res, 'scp:design-1');
        g.lines.forEach((l) => expect(l.baseUnit).toBe(20)); // RAW design colors — never +1 on darks
        expect(g.trace.screens).toBe(5);
        expect(g.fees.find((f) => f.code === 'SPSU').amount).toBe(150);
        expect(g.groupTotal).toBe(1160);
    });

    test('(c) 20× PC61 below-minimum: clamps to 13-36 row, $14.50 base, $75 LTM, GRAND $395.00', async () => {
        const res = await run({
            items: [scpItem('PC61', { S: 5, M: 5, L: 5, XL: 5 })],
            groups: { 'scp:design-1': SCP_1C }
        });
        const g = groupOf(res, 'scp:design-1');
        expect(g.tierLabel).toBe('13-36');
        g.lines.forEach((l) => expect(l.baseUnit).toBe(14.5));
        expect(g.ltm.fee).toBe(75);
        expect(g.groupTotal).toBe(395);
        // honest effective per-piece incl. LTM = $18.25
        expect(g.lines[0].effectiveUnitDisplay).toBe(18.25);
    });

    test('(c2) 12× PC61 below the 13-piece floor: hard block, never priced (customer gate, Erik 2026-06-11)', async () => {
        // The builder's findPricingTier deliberately lets a REP clamp below
        // the lowest tier; customers cannot order below the method minimum.
        // Min is data-derived from the bundle's lowest tier (13 today).
        const res = await run({
            items: [scpItem('PC61', { S: 3, M: 3, L: 3, XL: 3 })],
            groups: { 'scp:design-1': SCP_1C }
        });
        expect(res.errors).toHaveLength(1);
        expect(res.errors[0].code).toBe('BELOW_MINIMUM');
        expect(res.errors[0].message).toMatch(/starts at 13 pieces/);
        expect(res.grandTotal).toBeNull();
    });

    test('(d) pooling proof: 24 PC61 + 24 PC54, one design → ONE tier/LTM/screen set, $680.00 vs $882.00 quoted separately', async () => {
        const pooled = await run({
            items: [scpItem('PC61', { M: 24 }, 's1'), scpItem('PC54', { M: 24 }, 's2')],
            groups: { 'scp:design-1': SCP_1C }
        });
        const g = groupOf(pooled, 'scp:design-1');
        expect(g.pooledQty).toBe(48);
        expect(g.tierLabel).toBe('37-71');
        expect(g.lines.find((l) => l.styleNumber === 'PC61').baseUnit).toBe(13);
        expect(g.lines.find((l) => l.styleNumber === 'PC54').baseUnit).toBe(12);
        expect(g.groupTotal).toBe(680);

        const sep61 = await run({ items: [scpItem('PC61', { M: 24 })], groups: { 'scp:design-1': SCP_1C } });
        const sep54 = await run({ items: [scpItem('PC54', { M: 24 })], groups: { 'scp:design-1': SCP_1C } });
        const separately = groupOf(sep61, 'scp:design-1').groupTotal + groupOf(sep54, 'scp:design-1').groupTotal;
        expect(groupOf(sep61, 'scp:design-1').groupTotal).toBe(453);
        expect(groupOf(sep54, 'scp:design-1').groupTotal).toBe(429);
        expect(separately - g.groupTotal).toBe(202);
    });

    test('safety stripes: flat $2/pc/location AFTER rounding, setup unchanged (rule-derived from builder :3070-3073)', async () => {
        const res = await run({
            items: [scpItem('PC61', { S: 12, M: 12, L: 12, XL: 12 })],
            groups: { 'scp:design-1': { frontColors: 1, backColors: 0, darkGarment: false, safetyStripes: true } }
        });
        const g = groupOf(res, 'scp:design-1');
        g.lines.forEach((l) => expect(l.baseUnit).toBe(15)); // 13 + $2 × 1 location
        expect(g.fees.find((f) => f.code === 'SPSU').amount).toBe(30);
        expect(g.groupTotal).toBe(800); // 720 + 50 + 30
    });

    test('unknown size hard-errors (no silent M→L fallback) and withholds the grand total', async () => {
        const res = await run({
            items: [scpItem('PC61', { XS: 48 })],
            groups: { 'scp:design-1': SCP_1C }
        });
        expect(res.errors).toHaveLength(1);
        expect(res.errors[0].code).toBe('PRICE_UNAVAILABLE');
        expect(res.grandTotal).toBeNull();
    });

    test('service-codes outage → fallback fees fire WITH a visible warning (never silent)', async () => {
        serviceCodesDown = true;
        const res = await run({
            items: [scpItem('PC61', { S: 12, M: 12, L: 12, XL: 12 })],
            groups: { 'scp:design-1': SCP_1C }
        });
        const g = groupOf(res, 'scp:design-1');
        expect(g.groupTotal).toBe(704); // fallback constants match today's live values
        expect(res.warnings.length).toBeGreaterThan(0);
        expect(res.warnings.join(' ')).toMatch(/service fees unavailable/i);
    });

    test('CANARY: engine findPricingTier is a byte-equal copy of screenprint-quote-builder.js:2975-2985', () => {
        const builderSrc = fs.readFileSync(path.join(ROOT, 'shared_components', 'js', 'screenprint-quote-builder.js'), 'utf8');
        const match = builderSrc.match(/function findPricingTier\(tiers, qty\) \{[\s\S]*?\n\}/);
        expect(match).toBeTruthy();
        const normalize = (s) => s.replace(/\/\/[^\n]*/g, '').replace(/\s+/g, ''); // token-exact, formatting-immune
        expect(normalize(QuoteCartEngine._internals.findPricingTier.toString())).toBe(normalize(match[0]));
    });

    test('findPricingTier clamps: qty 600 → top tier (145-576); qty 5 → lowest tier (13-36)', () => {
        const tiers = [
            { minQty: 13, maxQty: 36, tag: 'low' },
            { minQty: 37, maxQty: 71, tag: 'mid' },
            { minQty: 72, maxQty: 144, tag: 'high' },
            { minQty: 145, maxQty: 576, tag: 'top' }
        ];
        expect(QuoteCartEngine._internals.findPricingTier(tiers, 600).tag).toBe('top');
        expect(QuoteCartEngine._internals.findPricingTier(tiers, 5).tag).toBe('low');
        expect(QuoteCartEngine._internals.findPricingTier(tiers, 48).tag).toBe('mid');
    });
});

// ===========================================================================
// DTF — worked examples (a)-(d), LTM-pre-rounding, upcharge-after-margin
// ===========================================================================
describe('DTF parity (DTFPricingService.calculatePriceForQuantity authority)', () => {
    test('(a) 24× PC61, small front → $15.50/pc, $372.00 (tier 24-47)', async () => {
        const res = await run({
            items: [dtfItem('PC61', { S: 6, M: 6, L: 6, XL: 6 })],
            groups: { 'dtf:main': { locations: ['left-chest'] } }
        });
        expect(res.errors).toEqual([]);
        const g = groupOf(res, 'dtf:main');
        expect(g.tierLabel).toBe('24-47');
        g.lines.forEach((l) => expect(l.baseUnit).toBe(15.5));
        expect(g.groupTotal).toBe(372);
        expect(g.ltm.fee).toBe(0);
        expect(g.trace.source).toBe('dtf-service');
    });

    test('(a 2XL spot) 2XL = upcharge AFTER margin → $17.50/pc, NOT the legacy margined-upcharge $19.50', async () => {
        const res = await run({
            items: [dtfItem('PC61', { S: 6, M: 6, L: 6, XL: 4, '2XL': 2 })],
            groups: { 'dtf:main': { locations: ['left-chest'] } }
        });
        const g = groupOf(res, 'dtf:main');
        const xxl = g.lines.find((l) => l.size === '2XL');
        expect(xxl.baseUnit).toBe(17.5);
        expect(xxl.baseUnit).not.toBe(19.5); // DTFQuotePricing.calculateProductPricing path = WRONG
    });

    test('(b) small front + large back, 2 locations → $31.50/pc, $756.00', async () => {
        const res = await run({
            items: [dtfItem('PC61', { S: 6, M: 6, L: 6, XL: 6 })],
            groups: { 'dtf:main': { locations: ['left-chest', 'full-back'] } }
        });
        const g = groupOf(res, 'dtf:main');
        g.lines.forEach((l) => expect(l.baseUnit).toBe(31.5));
        expect(g.groupTotal).toBe(756);
    });

    test('(c) 15× PC61 LTM tier: billed unit IS LTM-inclusive pre-rounding → $19.50/pc, $292.50 (NOT $16.00+$3.33=$19.33)', async () => {
        const res = await run({
            items: [dtfItem('PC61', { S: 5, M: 5, L: 5 })],
            groups: { 'dtf:main': { locations: ['left-chest'] } }
        });
        const g = groupOf(res, 'dtf:main');
        expect(g.tierLabel).toBe('10-23');
        g.lines.forEach((l) => {
            expect(l.baseUnit).toBe(19.5);
            expect(l.effectiveUnit).toBe(19.5); // saved/billed price == displayed price (2026-06-01 lesson)
            expect(l.baseUnit).not.toBe(19.33);
        });
        expect(g.ltm).toEqual({ fee: 50, perUnit: 3.33, mode: 'baked' });
        expect(g.groupTotal).toBe(292.5);
    });

    test('(d) pooled styles: 12 PC61 + 12 PC54 → ONE 24-47 tier, $15.50/$14.50, $360.00', async () => {
        const res = await run({
            items: [dtfItem('PC61', { M: 12 }, 'f1'), dtfItem('PC54', { M: 12 }, 'f2')],
            groups: { 'dtf:main': { locations: ['left-chest'] } }
        });
        const g = groupOf(res, 'dtf:main');
        expect(g.pooledQty).toBe(24);
        expect(g.tierLabel).toBe('24-47');
        expect(g.lines.find((l) => l.styleNumber === 'PC61').baseUnit).toBe(15.5);
        expect(g.lines.find((l) => l.styleNumber === 'PC54').baseUnit).toBe(14.5); // PC54 garment cost = min BLANK size price $3.00
        expect(g.groupTotal).toBe(360);
    });

    test('below 10 pooled pieces is a hard block (no tier exists; never price it)', async () => {
        const res = await run({
            items: [dtfItem('PC61', { S: 4, M: 4 })],
            groups: { 'dtf:main': { locations: ['left-chest'] } }
        });
        expect(res.errors).toHaveLength(1);
        expect(res.errors[0].code).toBe('BELOW_MINIMUM');
        expect(res.grandTotal).toBeNull();
    });

    test('front-zone conflicts are rejected (one pick per zone)', async () => {
        const res = await run({
            items: [dtfItem('PC61', { S: 6, M: 6, L: 6, XL: 6 })],
            groups: { 'dtf:main': { locations: ['left-chest', 'center-front'] } }
        });
        expect(res.errors[0].code).toBe('BAD_OPTIONS');
        expect(res.grandTotal).toBeNull();
    });
});

// ===========================================================================
// Cross-method behavior + engine API
// ===========================================================================
describe('Engine orchestration (pooling scope, grand-total integrity, preview, nudges)', () => {
    test('mixed-method cart: methods never pool with each other; grandTotal = sum of group totals', async () => {
        const res = await run({
            items: [
                pc61Emb({ S: 6, M: 6, L: 6, XL: 6 }, 'e1'),
                dtgItem('PC61', { M: 24 }, 'd1')
            ],
            groups: {
                'emb:garment': EMB_LOGOS_LC_PLUS_BACK,
                'dtg:main': { locationCode: 'LC' }
            }
        });
        expect(res.errors).toEqual([]);
        expect(res.groups).toHaveLength(2);
        expect(groupOf(res, 'emb:garment').pooledQty).toBe(24); // DTG pieces do NOT count toward the EMB tier
        expect(groupOf(res, 'dtg:main').pooledQty).toBe(24);
        expect(res.grandTotal).toBe(696 + 348);
    });

    test('grand total is WITHHELD when any group fails (no partial sums)', async () => {
        const res = await run({
            items: [
                pc61Emb({ S: 6, M: 6, L: 6, XL: 6 }, 'e1'),
                dtgItem('PC61', { M: 24 }, 'd1')
            ],
            groups: {
                'emb:garment': EMB_LOGOS_LC,
                'dtg:main': { locationCode: 'FF_JB' } // unpriceable
            }
        });
        expect(res.errors).toHaveLength(1);
        expect(res.grandTotal).toBeNull();
        expect(groupOf(res, 'emb:garment').groupTotal).toBe(504 + 0); // healthy group still reported (no AL here)
    });

    test('unknown method is rejected, never guessed', async () => {
        const res = await run({ items: [{ id: 'x', method: 'LASER', styleNumber: 'PC61', sizes: { M: 24 } }], groups: {} });
        expect(res.errors[0].code).toBe('UNKNOWN_METHOD');
        expect(res.grandTotal).toBeNull();
    });

    test('grouping: EMB isCap → emb:cap; SCP honors per-design groupId; others fixed', () => {
        const gid = QuoteCartEngine._internals.groupIdForItem;
        expect(gid({ method: 'EMB' })).toBe('emb:garment');
        expect(gid({ method: 'EMB', isCap: true })).toBe('emb:cap');
        expect(gid({ method: 'CAP' })).toBe('emb:cap');
        expect(gid({ method: 'DTG', groupId: 'dtg:custom' })).toBe('dtg:main'); // fixed pool — staff builder scope
        expect(gid({ method: 'SCP', groupId: 'scp:design-2' })).toBe('scp:design-2');
        expect(gid({ method: 'dtf' })).toBe('dtf:main');
    });

    test('singleItemPreview (configurator, decision #17): DTG 12-pc FF — honest effective price + next-tier nudge', async () => {
        const p = await preview(
            dtgItem('PC61', { M: 12 }, undefined),
            { groups: { 'dtg:main': { locationCode: 'FF' } } }
        );
        expect(p.ok).toBe(true);
        expect(p.pooledQty).toBe(12);
        expect(p.pooledWithCart).toBe(false);
        expect(p.tierLabel).toBe('1-23 (LTM)');
        expect(p.effectivePerPiece).toBe(20.66);
        expect(p.itemTotal).toBe(247.92);
        expect(p.groupTotal).toBe(247.92);
        // Nudge re-runs the SAME authority at the next tier min (24):
        // FF@24 = $17.00/pc → save $3.66/pc, and the $50 small-batch fee disappears.
        expect(p.nudge).toMatchObject({ addQty: 12, nextTierMinQty: 24, perPieceSavings: 3.66, ltmDisappears: true });
    });

    test('singleItemPreview pools with existing cart items: PC54 preview rides the 24-47 tier', async () => {
        const p = await preview(
            dtgItem('PC54', { M: 12 }, 'preview-54'),
            {
                cartItems: [dtgItem('PC61', { M: 12 }, 'incart-61')],
                groups: { 'dtg:main': { locationCode: 'LC' } },
                nudge: false
            }
        );
        expect(p.ok).toBe(true);
        expect(p.pooledQty).toBe(24);
        expect(p.pooledWithCart).toBe(true);
        expect(p.tierLabel).toBe('24-47');
        expect(p.effectivePerPiece).toBe(13.5);
        expect(p.itemTotal).toBe(162);
        expect(p.groupTotal).toBe(336);
    });

    test('EMB nudge: 5 pcs → "add 3 more" reaches 8-23, savings > 0 and the LTM disappears', async () => {
        const res = await run(
            { items: [pc61Emb({ S: 2, M: 2, L: 1 })], groups: { 'emb:garment': EMB_LOGOS_LC } },
            { nudge: true }
        );
        const g = groupOf(res, 'emb:garment');
        // current basis $35/pc → at 8 pcs unit $25, no LTM → save $10/pc
        expect(g.nudge).toMatchObject({ addQty: 3, nextTierMinQty: 8, nextTierLabel: '8-23', perPieceSavings: 10, ltmDisappears: true });
    });

    test('nudge is suppressed when the next tier saves nothing (never a lying nudge)', async () => {
        // DTG 24-47 → 48-71 has no recorded fixture; the nudge re-run fails and
        // the engine returns null instead of guessing (best-effort contract).
        const res = await run(
            { items: [dtgItem('PC61', { M: 24 })], groups: { 'dtg:main': { locationCode: 'LC' } } },
            { nudge: true }
        );
        expect(groupOf(res, 'dtg:main').nudge).toBeNull();
    });
});

// ===========================================================================
// P0 HOTFIX — manual-cost override host gates across ALL FIVE pricing services
// (MEMORY rule: gate on host==='localhost' || host.endsWith('.herokuapp.com'))
// ===========================================================================
describe('Manual-cost override host gates (P0 price-integrity)', () => {
    const services = [
        ['EmbroideryPricingService', () => new EmbroideryPricingService()],
        ['CapEmbroideryPricingService', () => new CapEmbroideryPricingService()],
        ['DTGPricingService', () => new DTGPricingService()],
        ['DTFPricingService', () => new DTFPricingService()],
        ['ScreenPrintPricingService', () => new ScreenPrintPricingService()] // the ungated hole fixed this wave
    ];

    test.each(services)('%s: ?manualCost on a CUSTOMER host is ignored and never persisted', (name, make) => {
        global.window.location.hostname = 'www.nwcustomapparel.com';
        global.window.location.search = '?manualCost=0.01';
        const svc = make();
        expect(svc.getManualCostOverride()).toBeNull();
        expect(global.sessionStorage.getItem('manualCostOverride')).toBeNull();
    });

    test.each(services)('%s: stale sessionStorage override is ALSO blocked on a customer host', (name, make) => {
        global.window.location.hostname = 'teamnwca.com';
        global.window.location.search = '';
        global.sessionStorage.setItem('manualCostOverride', '0.01');
        const svc = make();
        expect(svc.getManualCostOverride()).toBeNull();
    });

    test.each(services)('%s: localhost (staff) still honors the override', (name, make) => {
        global.window.location.hostname = 'localhost';
        global.window.location.search = '?manualCost=0.01';
        const svc = make();
        expect(svc.getManualCostOverride()).toBe(0.01);
    });

    test.each(services)('%s: .herokuapp.com (staff) still honors the override', (name, make) => {
        global.window.location.hostname = 'sanmar-inventory-app.herokuapp.com';
        global.window.location.search = '';
        global.sessionStorage.setItem('manualCostOverride', '7.77');
        const svc = make();
        expect(svc.getManualCostOverride()).toBe(7.77);
    });
});
