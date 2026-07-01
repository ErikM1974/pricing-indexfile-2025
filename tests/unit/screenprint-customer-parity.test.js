/**
 * screenprint-customer-parity.test.js — regression lock for the customer-supplied-
 * garment screen print calculator (calculators/screenprint-customer/).
 *
 * CLAUDE.md Rule 9 (3 price surfaces = ONE engine) + Rule 7 (sync calculator +
 * builder prices, test identical inputs match). Before 2026-07-01 this calculator
 * had 100% hardcoded pricing (wrong tier boundaries, wrong LTM amount/threshold,
 * a dark-garment bug that inflated the per-piece price) — a 4th, disconnected
 * pricing path. The fix reuses the SAME QuoteCartEngine.singleItemPreview() /
 * ScreenPrintPricingService authority Quick Quote and the staff Screen Print
 * Quote Builder use, via a new `customerSuppliedGarment:true` option that forces
 * garment cost to $0 through the EXISTING generateManualPricingData(0) path
 * (same machinery Order Form manual rows already use) — see quote-cart-engine.js
 * priceScpGroup().
 *
 * Expected values were cross-verified against the LIVE proxy on 2026-07-01
 * (this fixture mirrors it exactly, including the 2026-06-19 Ed_Cost +15% update).
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const FIXTURE_DIR = path.join(ROOT, 'tests', 'fixtures', 'pricing');
const fixture = (name) => JSON.parse(fs.readFileSync(path.join(FIXTURE_DIR, name), 'utf8'));

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

function okJson(data) {
    return { ok: true, status: 200, json: async () => data, text: async () => JSON.stringify(data) };
}

const SCP_BUNDLE = fixture('scp-bundle-PC61.json');
const SERVICE_CODES = fixture('service-codes.json');

global.fetch = jest.fn(async (url) => {
    if (url.includes('/api/service-codes')) return okJson(SERVICE_CODES);
    if (url.includes('method=ScreenPrint&styleNumber=')) return okJson(SCP_BUNDLE);
    throw new Error('Unmocked fetch URL in screenprint-customer-parity.test.js: ' + url);
});

require(path.join(ROOT, 'shared_components/js/screenprint-pricing-service.js'));
const QuoteCartEngine = require(path.join(ROOT, 'shared_components/js/quote-cart-engine.js'));

function priceCustomerSupplied(qty, frontColors, backColors, darkGarment, safetyStripes) {
    return QuoteCartEngine.singleItemPreview({
        id: 'x', styleNumber: 'CUSTOMER-SUPPLIED', method: 'SCP', groupId: 'scp:customer-supplied',
        sizes: { S: qty }
    }, {
        deps: { ScreenPrintPricingService: global.window.ScreenPrintPricingService },
        groups: { 'scp:customer-supplied': { frontColors, backColors, darkGarment, safetyStripes, customerSuppliedGarment: true } },
        nudge: false
    });
}

describe('Screen print customer-supplied-garment calculator — engine parity lock', () => {
    test('manual-cost host gate stays ON for this host (never a URL-tamperable price)', () => {
        const svc = new global.window.ScreenPrintPricingService();
        expect(svc.getManualCostOverride()).toBeNull();
    });

    test('1-color front, 24-47 tier: $6.00/pc, $50 LTM, 1 screen ($30 setup)', async () => {
        const r = await priceCustomerSupplied(24, 1, 0, false, false);
        expect(r.ok).toBe(true);
        expect(r.tierLabel).toBe('24-47');
        expect(r.lines[0].baseUnit).toBeCloseTo(6.00, 2);
        expect(r.ltm.fee).toBeCloseTo(50, 2);
        expect(r.fees.find((f) => f.code === 'SPSU').amount).toBeCloseTo(30, 2);
        expect(r.groupTotal).toBeCloseTo(24 * 6.00 + 50 + 30, 2); // $224
    });

    test('3-color front, 24-47 tier: $9.00/pc (NOT the old hardcoded $10.00)', async () => {
        const r = await priceCustomerSupplied(40, 3, 0, false, false);
        expect(r.lines[0].baseUnit).toBeCloseTo(9.00, 2);
    });

    test('1-color front, 145-576 tier: $5.00/pc, $0 LTM (NOT the old hardcoded $100 flat-fee model)', async () => {
        const r = await priceCustomerSupplied(200, 1, 0, false, false);
        expect(r.tierLabel).toBe('145-576');
        expect(r.lines[0].baseUnit).toBeCloseTo(5.00, 2);
        expect(r.ltm.fee).toBe(0);
    });

    test('below the real live minimum (24) is rejected — no hardcoded threshold drift', async () => {
        const r = await priceCustomerSupplied(12, 1, 0, false, false);
        expect(r.ok).toBe(false);
        expect(r.error.code).toBe('BELOW_MINIMUM');
        expect(r.error.minQuantity).toBe(24);
    });

    // The core regression this fix closes: the OLD calculator bumped color count on
    // dark garments, inflating the PER-PIECE price. The engine's rule (authoritative
    // per CUSTOMER_QUOTE_CART_DESIGN_2026-06.md + quote-cart-engine.js:730-733) is
    // underbase = EXTRA SCREENS ONLY, never a per-piece change.
    test('dark garment: per-piece price UNCHANGED, only screens/setup fee increase', async () => {
        const light = await priceCustomerSupplied(48, 2, 1, false, false);
        const dark = await priceCustomerSupplied(48, 2, 1, true, false);

        expect(light.tierLabel).toBe('48-71');
        expect(dark.lines[0].baseUnit).toBeCloseTo(light.lines[0].baseUnit, 2); // NOT inflated
        expect(dark.lines[0].baseUnit).toBeCloseTo(10.50, 2);

        expect(light.trace.screens).toBe(3); // 2 front + 1 back
        expect(dark.trace.screens).toBe(5);  // + 1 per printed location (front, back) = +2

        expect(light.fees.find((f) => f.code === 'SPSU').amount).toBeCloseTo(90, 2);
        expect(dark.fees.find((f) => f.code === 'SPSU').amount).toBeCloseTo(150, 2);

        expect(dark.groupTotal - light.groupTotal).toBeCloseTo(60, 2); // ONLY the +2 screens
    });

    test('safety stripes scale by printed-location count, not a hardcoded flat $2', async () => {
        const frontOnly = await priceCustomerSupplied(24, 2, 0, false, true);
        const frontAndBack = await priceCustomerSupplied(24, 2, 1, false, true);

        // trace.fees.stripe is the live SP-STRIPE rate ($2/location/piece); front-only
        // adds it once, front+back adds it twice — verified via the per-piece delta
        // against the no-stripes control for each shape.
        const frontOnlyControl = await priceCustomerSupplied(24, 2, 0, false, false);
        const frontAndBackControl = await priceCustomerSupplied(24, 2, 1, false, false);

        expect(frontOnly.lines[0].baseUnit - frontOnlyControl.lines[0].baseUnit).toBeCloseTo(2.00, 2);
        expect(frontAndBack.lines[0].baseUnit - frontAndBackControl.lines[0].baseUnit).toBeCloseTo(4.00, 2);
    });

    test('back-print cost is garment-independent — identical to the additionalLocationPricing used elsewhere', async () => {
        const r = await priceCustomerSupplied(24, 1, 2, false, false);
        // 24-47 tier, 2-color back Ed_Cost 3.28 -> (3.28)/0.53 = 6.19 -> HalfDollarCeil -> 6.50
        const back = r.trace.perStyle[0].addlPerPiece;
        expect(back).toBeCloseTo(6.50, 2);
    });

    test('same engine call Quick Quote uses (QuoteCartEngine.singleItemPreview) — alignment by construction, not just by test', () => {
        const quickQuoteSrc = fs.readFileSync(path.join(ROOT, 'calculators/quick-quote/quick-quote.js'), 'utf8');
        expect(quickQuoteSrc).toMatch(/QuoteCartEngine\.singleItemPreview/);
    });
});
