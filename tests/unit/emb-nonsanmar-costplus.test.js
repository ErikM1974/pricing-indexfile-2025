/**
 * Vendor (non-SanMar) cost-plus pricing — THE Rule 9 lock.
 *
 * A garment we buy from S&S Activewear (or any non-SanMar vendor) is priced from a
 * rep-entered BLANK COST instead of SanMar's CASE_PRICE. The design claim is that this
 * adds no second pricing path: buildSyntheticSizePricing() merely hands the UNTOUCHED
 * formula the same payload shape /api/size-pricing returns.
 *
 * The headline test proves that literally — for the same cost, a synthetic-payload
 * product and an API-payload product must produce BYTE-IDENTICAL lineItems. If someone
 * ever forks the vendor path into its own formula, that test fails.
 *
 * Fixture mirrors emb-margin-stitch-band.test.js (same synthetic per-tier shape).
 */
const Calc = require('../../shared_components/js/embroidery-quote-pricing.js');

const BLANK_COST = 8.42;   // what S&S charges us per blank

function makeCalc() {
    const c = new Calc();
    c.roundingMethod = 'CeilDollar';
    c.marginDenominator = 0.53;
    c.capMarginDenominator = 0.53;
    c.tiers = {
        '1-7': { embCost: 18, marginDenominator: 0.53, hasLTM: true },
        '8-23': { embCost: 18, marginDenominator: 0.53 },
        '24-47': { embCost: 14, marginDenominator: 0.53 },
        '48-71': { embCost: 13, marginDenominator: 0.53 },
        '72+': { embCost: 12, marginDenominator: 0.53 },
    };
    c.capTiers = {
        '1-7': { embCost: 17, marginDenominator: 0.53 },
        '8-23': { embCost: 17, marginDenominator: 0.53 },
        '24-47': { embCost: 13, marginDenominator: 0.53 },
        '48-71': { embCost: 11, marginDenominator: 0.53 },
        '72+': { embCost: 10, marginDenominator: 0.53 },
    };
    c.capInitialized = true;              // skip the network init in calculateCapProductPrice
    c.standardSizeUpcharges = { '2XL': 2, '3XL': 3, '4XL': 4 };
    return c;
}

/** A SanMar-shaped product: pricing comes from a stubbed /api/size-pricing. */
function sanmarProduct(sizeBreakdown, isCap = false) {
    return { style: 'PC54', color: 'Navy', sizeBreakdown, isCap, sizeOverrides: {} };
}

/** The same garment sourced from a vendor: no API row, a typed blank cost instead. */
function vendorProduct(sizeBreakdown, isCap = false, extra = {}) {
    return {
        style: 'SS-B00760', color: 'Navy', sizeBreakdown, isCap,
        sizeOverrides: {}, blankCost: BLANK_COST, vendorCode: 'SSA', ...extra
    };
}

/** What the real /api/size-pricing returns: raw blank cost per size + upcharges. */
function apiSizePricing(sizes, upcharges = { '2XL': 2, '3XL': 3, '4XL': 4 }) {
    const basePrices = {};
    sizes.forEach(s => { basePrices[s] = BLANK_COST; });
    const sizeUpcharges = {};
    Object.entries(upcharges).forEach(([s, v]) => { if (sizes.includes(s)) sizeUpcharges[s] = v; });
    return [{ styleNumber: 'PC54', color: 'Navy', basePrices, sizeUpcharges }];
}

describe('Rule 9 — a vendor garment prices through the SAME engine as a SanMar one', () => {
    test('cost-plus lineItems are byte-identical to the API-sourced equivalent (garment)', async () => {
        const breakdown = { S: 4, M: 8, L: 6, XL: 2, '2XL': 3 };
        const sizes = ['S', 'M', 'L', 'XL', '2XL'];

        const sanmarCalc = makeCalc();
        sanmarCalc.fetchSizePricing = async () => apiSizePricing(sizes);
        const fromApi = await sanmarCalc.calculateProductPrice(sanmarProduct(breakdown), 23);

        const vendorCalc = makeCalc();
        // If the vendor path ever falls back to the network, this throw exposes it.
        vendorCalc.fetchSizePricing = async () => { throw new Error('must not hit /api/size-pricing'); };
        const fromCost = await vendorCalc.calculateProductPrice(vendorProduct(breakdown), 23);

        expect(fromCost.lineItems).toEqual(fromApi.lineItems);
        expect(fromCost.subtotal).toBe(fromApi.subtotal);
        expect(fromCost.tier).toBe(fromApi.tier);
    });

    test('cost-plus lineItems are byte-identical to the API-sourced equivalent (cap)', async () => {
        const breakdown = { OSFA: 30 };

        const sanmarCalc = makeCalc();
        sanmarCalc.fetchSizePricing = async () => apiSizePricing(['OSFA'], {});
        const fromApi = await sanmarCalc.calculateCapProductPrice(sanmarProduct(breakdown, true), 30, 8000);

        const vendorCalc = makeCalc();
        vendorCalc.fetchSizePricing = async () => { throw new Error('must not hit /api/size-pricing'); };
        const fromCost = await vendorCalc.calculateCapProductPrice(vendorProduct(breakdown, true), 30, 8000);

        expect(fromCost.lineItems).toEqual(fromApi.lineItems);
        expect(fromCost.subtotal).toBe(fromApi.subtotal);
    });

    test('the tier ladder still applies — a bigger order prices lower per piece', async () => {
        const breakdown = { M: 10 };
        const c = makeCalc();
        c.fetchSizePricing = async () => { throw new Error('must not hit the API'); };

        const small = await c.calculateProductPrice(vendorProduct(breakdown), 10);   // 8-23, emb 18
        const big = await c.calculateProductPrice(vendorProduct(breakdown), 100);    // 72+,  emb 12

        expect(small.lineItems[0].unitPrice).toBeGreaterThan(big.lineItems[0].unitPrice);
        expect(small.tier).toBe('8-23');
        expect(big.tier).toBe('72+');
    });
});

describe('size upcharges on vendor products', () => {
    test('2XL takes the shared Caspio ladder when the style has no override', async () => {
        const c = makeCalc();
        c.fetchSizePricing = async () => { throw new Error('must not hit the API'); };
        const res = await c.calculateProductPrice(vendorProduct({ L: 10, '2XL': 4 }), 14);

        const std = res.lineItems.find(li => !li.hasUpcharge);
        const up = res.lineItems.find(li => li.hasUpcharge);
        expect(up.upcharge).toBe(2);
        expect(up.unitPrice).toBe(std.unitPrice + 2);
    });

    test('a per-style SizeUpcharge2XL overrides the shared ladder', async () => {
        const c = makeCalc();
        c.fetchSizePricing = async () => { throw new Error('must not hit the API'); };
        const res = await c.calculateProductPrice(
            vendorProduct({ L: 10, '2XL': 4 }, false, { sizeUpchargeOverrides: { '2XL': 5 } }), 14);

        expect(res.lineItems.find(li => li.hasUpcharge).upcharge).toBe(5);
    });

    test('the upcharge is added AFTER rounding, not before', async () => {
        const c = makeCalc();
        c.fetchSizePricing = async () => { throw new Error('must not hit the API'); };
        const res = await c.calculateProductPrice(vendorProduct({ L: 10, '2XL': 4 }), 14);

        // roundPrice(cost/margin + emb) + upcharge — NOT roundPrice(cost/margin + emb + upcharge)
        const expectedStd = c.roundPrice(BLANK_COST / 0.53 + 18);
        expect(res.lineItems.find(li => !li.hasUpcharge).unitPrice).toBe(expectedStd);
        expect(res.lineItems.find(li => li.hasUpcharge).unitPrice).toBe(expectedStd + 2);
    });

    test('a 2XL/3XL-only order still anchors on S, so the upcharge survives', async () => {
        // The anchor sizes exist precisely so the base-size search lands on a size with no
        // upcharge. Without them the engine would pick 2XL as its own base and the relative
        // upcharge would collapse to 0 — a silent under-charge on big-and-tall vendor goods.
        const c = makeCalc();
        c.fetchSizePricing = async () => { throw new Error('must not hit the API'); };
        const res = await c.calculateProductPrice(vendorProduct({ '2XL': 6, '3XL': 2 }), 8);

        const two = res.lineItems.find(li => li.description.startsWith('2XL'));
        const three = res.lineItems.find(li => li.description.startsWith('3XL'));
        expect(two.upcharge).toBe(2);
        expect(three.upcharge).toBe(3);
        // Anchors must never become their own line items.
        expect(res.lineItems.some(li => /^S\(/.test(li.description))).toBe(false);
        expect(res.lineItems.reduce((s, li) => s + li.quantity, 0)).toBe(8);
    });

    test('an empty upcharge ladder + extended sizes raises the visible-warning flag', async () => {
        // Caspio rate-limiting returns a degraded bundle. Pricing a 2XL with a $0 upcharge
        // silently is exactly the wrong-price failure Erik's #1 rule forbids.
        const c = makeCalc();
        c.standardSizeUpcharges = {};
        c.fetchSizePricing = async () => { throw new Error('must not hit the API'); };
        await c.calculateProductPrice(vendorProduct({ L: 10, '2XL': 4 }), 14);

        expect(c._costFallbackUsed).toBeTruthy();
    });
});

describe('buildSyntheticSizePricing guard rails', () => {
    test('returns null without a usable cost, so the caller falls back to the API', () => {
        const c = makeCalc();
        expect(c.buildSyntheticSizePricing({ blankCost: 0, sizeBreakdown: { M: 1 } })).toBeNull();
        expect(c.buildSyntheticSizePricing({ sizeBreakdown: { M: 1 } })).toBeNull();
        expect(c.buildSyntheticSizePricing({ blankCost: -3, sizeBreakdown: { M: 1 } })).toBeNull();
    });

    test('a manual price override still wins over cost-plus', async () => {
        const c = makeCalc();
        c.fetchSizePricing = async () => { throw new Error('must not hit the API'); };
        const res = await c.calculateProductPrice(
            vendorProduct({ M: 10 }, false, { sellPriceOverride: 42 }), 10);

        expect(res.lineItems.every(li => li.unitPrice === 42)).toBe(true);
    });

    test('caps anchor on OSFA (never in the upcharge ladder) so relative === absolute', () => {
        const c = makeCalc();
        const out = c.buildSyntheticSizePricing({
            style: 'RICH-112', isCap: true, blankCost: BLANK_COST, sizeBreakdown: { OSFA: 30 }
        });
        expect(Object.keys(out[0].basePrices)).toEqual(['OSFA']);
        expect(out[0].sizeUpcharges).toEqual({});
    });
});
