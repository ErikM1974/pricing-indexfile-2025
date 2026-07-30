/**
 * EMB pricing config — a 200 with empty arrays must FAIL, not fall back to seed values.
 *
 * Why this exists: /api/pricing-bundle answers HTTP 200 with
 * {tiersR: [], allEmbroideryCostsR: [], ...} when Caspio rate-limits, rather than erroring
 * (its sibling /api/pricing-tiers fails loudly). The constructor pre-seeds a full tier ladder,
 * so before the guard those empty arrays simply skipped the "build tiers from API" block and
 * every quote priced off hardcoded numbers frozen at the last edit of the source file —
 * with no banner and no toast. Harmless only while the seed happened to match Caspio;
 * silently wrong the moment anyone changed a price there.
 *
 * Erik's #1 rule: never a silent wrong price. These tests lock that in.
 */
const Calc = require('../../shared_components/js/embroidery-quote-pricing.js');

// showAPIWarning/disableQuoteCreation touch `document`, which does not exist in the node
// project. Stub them so the catch path completes and its effects can be asserted.
let warnings = [];
beforeEach(() => {
    warnings = [];
    Calc.prototype.showAPIWarning = function (message, failureType) {
        warnings.push({ message, failureType });
    };
    Calc.prototype.disableQuoteCreation = function () {
        this._quoteCreationDisabled = true;
    };
});

const VALID_TIERS = [
    { TierLabel: '1-7', MarginDenominator: 0.55, LTM_Fee: 50 },
    { TierLabel: '8-23', MarginDenominator: 0.53, LTM_Fee: 0 },
    { TierLabel: '24-47', MarginDenominator: 0.53, LTM_Fee: 0 },
    { TierLabel: '48-71', MarginDenominator: 0.53, LTM_Fee: 0 },
    { TierLabel: '72+', MarginDenominator: 0.53, LTM_Fee: 0 },
];
const VALID_COSTS = [
    { ItemType: 'Shirt', TierLabel: '1-7', EmbroideryCost: 19, DigitizingFee: 100, AdditionalStitchRate: 1.25, BaseStitchCount: 8000, StitchIncrement: 1000 },
    { ItemType: 'Shirt', TierLabel: '8-23', EmbroideryCost: 19 },
    { ItemType: 'Shirt', TierLabel: '24-47', EmbroideryCost: 15 },
    { ItemType: 'Shirt', TierLabel: '48-71', EmbroideryCost: 14 },
    { ItemType: 'Shirt', TierLabel: '72+', EmbroideryCost: 13 },
    { ItemType: 'AS-Garm', TierLabel: 'Mid', EmbroideryCost: 4, StitchCount: 15000 },
    { ItemType: 'AS-Garm', TierLabel: 'Large', EmbroideryCost: 10, StitchCount: 25000 },
];

/** Route mock responses by URL so EMB / EMB-AL / service-codes can differ. */
function mockFetch(embPayload) {
    global.fetch = (url) => {
        const u = String(url);
        const ok = (body) => Promise.resolve({ ok: true, status: 200, statusText: 'OK', json: () => Promise.resolve(body) });
        if (u.includes('method=EMB-AL')) {
            return ok({ allEmbroideryCostsR: [{ ItemType: 'AL', TierLabel: '1-7', EmbroideryCost: 12, BaseStitchCount: 8000, AdditionalStitchRate: 1.25 }] });
        }
        if (u.includes('/api/service-codes')) {
            return ok({ success: true, data: [{ ServiceCode: 'LTM', SellPrice: 50 }] });
        }
        if (u.includes('/api/pricing-bundle')) return ok(embPayload);
        return ok({});
    };
}

async function init(embPayload) {
    mockFetch(embPayload);
    const c = new Calc({ skipInit: true });
    await c.initializeConfig();
    return c;
}

describe('empty pricing bundle must not price from seed values', () => {
    // The exact shape observed in production when Caspio rate-limits.
    const RATE_LIMITED = { tiersR: [], rulesR: {}, locations: [], allEmbroideryCostsR: [], sizes: [] };

    test('HTTP 200 with empty arrays does NOT initialize the calculator', async () => {
        const c = await init(RATE_LIMITED);
        expect(c.initialized).toBe(false);
        expect(c.apiError).toBe(true);
        expect(c.apiStatus.mainPricing).toBe(false);
    });

    test('it raises the CRITICAL banner and disables quote creation', async () => {
        const c = await init(RATE_LIMITED);
        const critical = warnings.filter(w => w.failureType === 'main-pricing');
        expect(critical.length).toBeGreaterThan(0);
        expect(c._quoteCreationDisabled).toBe(true);
    });

    test('missing arrays entirely are treated the same as empty ones', async () => {
        const c = await init({ rulesR: {} });
        expect(c.initialized).toBe(false);
        expect(c.apiError).toBe(true);
    });

    test('costs present but tiers empty still fails — both are required to price', async () => {
        const c = await init({ tiersR: [], allEmbroideryCostsR: VALID_COSTS });
        expect(c.initialized).toBe(false);
        expect(c.apiError).toBe(true);
    });

    test('tiers present but costs empty still fails', async () => {
        const c = await init({ tiersR: VALID_TIERS, allEmbroideryCostsR: [] });
        expect(c.initialized).toBe(false);
        expect(c.apiError).toBe(true);
    });
});

describe('a real bundle still initializes, and Caspio wins over the seed', () => {
    test('initializes and adopts the API ladder', async () => {
        const c = await init({ tiersR: VALID_TIERS, allEmbroideryCostsR: VALID_COSTS, rulesR: { RoundingMethod: 'HalfDollarCeil_Final' } });
        expect(c.initialized).toBe(true);
        expect(c.apiError).toBeFalsy();
        expect(c.apiStatus.mainPricing).toBe(true);
    });

    test('API prices replace the constructor seed rather than sitting alongside it', async () => {
        const c = await init({ tiersR: VALID_TIERS, allEmbroideryCostsR: VALID_COSTS, rulesR: { RoundingMethod: 'HalfDollarCeil_Final' } });
        // Seed ladder is 18/18/14/13/12; this fixture deliberately differs (19/19/15/14/13).
        expect(c.getEmbroideryCost('1-7')).toBe(19);
        expect(c.getEmbroideryCost('72+')).toBe(13);
        // Per-tier margin must survive too (the N2 fix) — 1-7 is 0.55, the rest 0.53.
        expect(c.getMarginDenominator('1-7')).toBeCloseTo(0.55, 5);
        expect(c.getMarginDenominator('24-47')).toBeCloseTo(0.53, 5);
    });

    test('the seed ladder is never what a caller reads after a failed load', async () => {
        const c = await init({ tiersR: [], allEmbroideryCostsR: [] });
        // The object still carries seed values — that is fine and deliberate — but the
        // calculator must be unusable, which is what actually prevents the wrong price.
        expect(c.initialized).toBe(false);
        expect(c._quoteCreationDisabled).toBe(true);
    });
});
