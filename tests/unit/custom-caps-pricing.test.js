/**
 * custom-caps-pricing.test.js — parity lock for the Custom Hats engine.
 *
 * Fixtures carry the LIVE Caspio values verified 2026-06-11
 * (memory/CUSTOMER_SITE_REDESIGN_2026-06.md "Custom Hats v1 lineup"):
 *   EmbroideryCaps tiers: 1-7 (0.55 + $50 LTM — UNREACHABLE, 8-cap minimum),
 *   8-23 / 24-47 / 48-71 / 72+ all MarginDenominator 0.53.
 *   Embroidery_Costs Cap@8000: $17 / $17 / $13 / $11 / $9.50.
 *   CAP-AL back logo: $6.50 / $5.50 / $4.75 / $4.50 / $4.25.
 *   Rounding: CeilDollar.
 *
 * The lineup table below is asserted EXACTLY — every (style, qty-tier) price
 * was cross-checked against the internal EMB builder formula and
 * /api/decorated-cap-prices at curation time. If one of these expectations
 * has to change, the STOREFRONT price is changing: don't, unless Erik asked.
 */
const CAPS = require('../../pages/js/custom-caps-pricing.js');

// ── Fixtures: live Caspio values (verified 2026-06-11) ─────────────────────
const TIERS = [
    { TierLabel: '24-47', MinQuantity: 24, MaxQuantity: 47, MarginDenominator: 0.53, LTM_Fee: 0 },
    { TierLabel: '48-71', MinQuantity: 48, MaxQuantity: 71, MarginDenominator: 0.53, LTM_Fee: 0 },
    { TierLabel: '72+', MinQuantity: 72, MaxQuantity: 99999, MarginDenominator: 0.53, LTM_Fee: 0 },
    { TierLabel: '1-7', MinQuantity: 1, MaxQuantity: 7, MarginDenominator: 0.55, LTM_Fee: 50 },
    { TierLabel: '8-23', MinQuantity: 8, MaxQuantity: 23, MarginDenominator: 0.53, LTM_Fee: 0 },
];

const CAP_COSTS = [
    { ItemType: 'Cap', TierLabel: '1-7', StitchCount: 8000, EmbroideryCost: 17, AdditionalStitchRate: 1, BaseStitchCount: 8000 },
    { ItemType: 'Cap', TierLabel: '8-23', StitchCount: 8000, EmbroideryCost: 17, AdditionalStitchRate: 1, BaseStitchCount: 8000 },
    { ItemType: 'Cap', TierLabel: '24-47', StitchCount: 8000, EmbroideryCost: 13, AdditionalStitchRate: 1, BaseStitchCount: 8000 },
    { ItemType: 'Cap', TierLabel: '48-71', StitchCount: 8000, EmbroideryCost: 11, AdditionalStitchRate: 1, BaseStitchCount: 8000 },
    { ItemType: 'Cap', TierLabel: '72+', StitchCount: 8000, EmbroideryCost: 9.5, AdditionalStitchRate: 1, BaseStitchCount: 8000 },
];

const capBundle = (blankOsfa) => ({
    tiersR: TIERS.map((t) => ({ ...t })),
    allEmbroideryCostsR: CAP_COSTS.map((c) => ({ ...c })),
    rulesR: { RoundingMethod: 'CeilDollar' },
    sizes: [{ size: 'OSFA', price: blankOsfa, sortOrder: 90 }],
    locations: [{ code: 'CF' }, { code: 'CB' }],
});

const AL_BUNDLE = {
    tiersR: TIERS.map((t) => ({ ...t })),
    allEmbroideryCostsR: [
        { ItemType: 'AL-CAP', TierLabel: '1-7', StitchCount: 5000, EmbroideryCost: 6.5 },
        { ItemType: 'AL-CAP', TierLabel: '8-23', StitchCount: 5000, EmbroideryCost: 5.5 },
        { ItemType: 'AL-CAP', TierLabel: '24-47', StitchCount: 5000, EmbroideryCost: 4.75 },
        { ItemType: 'AL-CAP', TierLabel: '48-71', StitchCount: 5000, EmbroideryCost: 4.5 },
        { ItemType: 'AL-CAP', TierLabel: '72+', StitchCount: 5000, EmbroideryCost: 4.25 },
    ],
};

const CONFIG = { shipFlat: 7.99, shipFreeOver: 100 };

const cartOf = (qty, color = 'Black') => [{ catalogColor: color, colorName: color, quantity: qty }];

const q = (over) => CAPS.quote(Object.assign({
    capBundle: capBundle(6.75),     // Richardson 112
    capAlBundle: AL_BUNDLE,
    config: CONFIG,
    cart: cartOf(24),
    backLogo: false,
    delivery: { method: 'ship', taxRate: null },
}, over));

// ── The verified 9-style lineup table (Erik decision #12, 2026-06-11) ──────
// [style, blank OSFA, $@8, $@24, $@48, $@72]
const LINEUP = [
    ['112', 6.75, 30, 26, 24, 23],          // Richardson Trucker
    ['C402', 3.79, 25, 21, 19, 17],          // Port Authority Snapback Trucker
    ['112PFP', 8.25, 33, 29, 27, 26],          // Richardson Printed Five-Panel
    ['256', 9.25, 35, 31, 29, 27],          // Richardson Umpqua Gramps
    ['258', 7.50, 32, 28, 26, 24],          // Richardson Rope Cap
    ['220', 8.00, 33, 29, 27, 25],          // Richardson Relaxed Perf Lite
    ['C914', 3.12, 23, 19, 17, 16],          // Port Authority Unstructured Twill
    ['STC26', 4.23, 25, 21, 19, 18],          // Sport-Tek RacerMesh
    ['CT105298', 13.04, 42, 38, 36, 35],          // Carhartt Canvas Mesh Back
];

describe('lineup parity — front logo included, all 9 styles × 4 reachable tiers', () => {
    LINEUP.forEach(([style, blank, p8, p24, p48, p72]) => {
        test(`${style} (blank $${blank}) → $${p8}/$${p24}/$${p48}/$${p72}`, () => {
            const b = capBundle(blank);
            expect(CAPS.unitPrice(b, 8).perCap).toBe(p8);
            expect(CAPS.unitPrice(b, 23).perCap).toBe(p8);     // tier edge
            expect(CAPS.unitPrice(b, 24).perCap).toBe(p24);
            expect(CAPS.unitPrice(b, 48).perCap).toBe(p48);
            expect(CAPS.unitPrice(b, 71).perCap).toBe(p48);    // tier edge
            expect(CAPS.unitPrice(b, 72).perCap).toBe(p72);
            expect(CAPS.unitPrice(b, 500).perCap).toBe(p72);   // 72+ is open-ended
        });
    });

    test('chain internals surface for the audit trail (112 @ 24: 6.75/0.53 + 13 → ceil 26)', () => {
        const u = CAPS.unitPrice(capBundle(6.75), 24);
        expect(u.blankPrice).toBe(6.75);
        expect(u.marginDenominator).toBe(0.53);
        expect(u.garmentCost).toBe(12.74);     // r2(6.75/0.53)
        expect(u.embCost).toBe(13);
        expect(u.tierLabel).toBe('24-47');
        expect(u.minQuantity).toBe(8);
    });
});

describe('back logo — flat tiered CAP-AL add-on ($5.50/$4.75/$4.50/$4.25 at reachable tiers)', () => {
    test('per-cap add-on by tier', () => {
        expect(CAPS.backLogoPerCap(AL_BUNDLE, 8)).toBe(5.5);
        expect(CAPS.backLogoPerCap(AL_BUNDLE, 24)).toBe(4.75);
        expect(CAPS.backLogoPerCap(AL_BUNDLE, 48)).toBe(4.5);
        expect(CAPS.backLogoPerCap(AL_BUNDLE, 72)).toBe(4.25);
    });

    test('added AFTER CeilDollar — 112 @ 8 with back logo = 30 + 5.50 = 35.50 (not re-rounded to 36)', () => {
        const r = q({ cart: cartOf(8), backLogo: true });
        expect(r.unitBySize.OSFA.basePrice).toBe(30);
        expect(r.unitBySize.OSFA.backLogoPerCap).toBe(5.5);
        expect(r.unitBySize.OSFA.finalPrice).toBe(35.5);
        expect(r.perCap).toBe(35.5);
    });

    test('72+ back logo: 23 + 4.25 = 27.25', () => {
        const r = q({ cart: cartOf(72), backLogo: true });
        expect(r.perCap).toBe(27.25);
    });

    test('backLogo flag off → no add-on, even with the AL bundle present', () => {
        const r = q({ cart: cartOf(24) });
        expect(r.backLogoPerCap).toBe(0);
        expect(r.perCap).toBe(26);
    });

    test('backLogo on with MISSING CAP-AL bundle throws (never a silent front-only price)', () => {
        expect(() => q({ cart: cartOf(24), backLogo: true, capAlBundle: undefined }))
            .toThrow(/CAP-AL/);
    });

    test('backLogo on with no AL row for the tier throws', () => {
        const broken = { tiersR: AL_BUNDLE.tiersR, allEmbroideryCostsR: [] };
        expect(() => q({ cart: cartOf(24), backLogo: true, capAlBundle: broken }))
            .toThrow(/back-logo/i);
    });

    test('legacy ItemType "AL" rows are accepted (builder 2026-02-01 tolerance)', () => {
        const legacy = {
            tiersR: AL_BUNDLE.tiersR,
            allEmbroideryCostsR: [{ ItemType: 'AL', TierLabel: '24-47', EmbroideryCost: 4.75 }],
        };
        expect(CAPS.backLogoPerCap(legacy, 24)).toBe(4.75);
    });
});

describe('8-cap minimum — the 1-7 LTM tier is UNREACHABLE (structured error, never a price)', () => {
    [0, 1, 4, 7].forEach((n) => {
        test(`qty ${n} → BELOW_MINIMUM with minQuantity 8`, () => {
            let err = null;
            try { CAPS.unitPrice(capBundle(6.75), n); } catch (e) { err = e; }
            expect(err).not.toBeNull();
            expect(err.code).toBe('BELOW_MINIMUM');
            expect(err.minQuantity).toBe(8);
            expect(err.message).toMatch(/8-cap minimum/);
        });
    });

    test('quote() with a 7-cap cart throws BELOW_MINIMUM (no 1-7 price, no $50 LTM)', () => {
        expect(() => q({ cart: cartOf(7) })).toThrow(expect.objectContaining({ code: 'BELOW_MINIMUM' }));
    });

    test('combined quantity across colors counts toward the minimum (5 + 3 = 8 prices fine)', () => {
        const r = q({ cart: [{ catalogColor: 'Black', quantity: 5 }, { catalogColor: 'Navy', quantity: 3 }] });
        expect(r.combinedQty).toBe(8);
        expect(r.perCap).toBe(30);
        expect(r.tierLabel).toBe('8-23');
    });

    test('a tier table where qty lands on an LTM tier still refuses to price it', () => {
        // Defensive: even if findTier matched an LTM_Fee tier (data drift),
        // the module must never emit a 1-7 price.
        const drifted = capBundle(6.75);
        drifted.tiersR = drifted.tiersR.map((t) =>
            t.TierLabel === '8-23' ? { ...t, LTM_Fee: 50 } : t);
        let err = null;
        try { CAPS.unitPrice(drifted, 10); } catch (e) { err = e; }
        expect(err && err.code).toBe('BELOW_MINIMUM');
    });

    test('minOrderQuantity derives 8 from the tier rows (Caspio-tunable, no deploy)', () => {
        expect(CAPS.minOrderQuantity(TIERS)).toBe(8);
    });

    test('NO LTM anywhere: ltmFee is hard 0 on every quote', () => {
        expect(q({ cart: cartOf(8) }).ltmFee).toBe(0);
        expect(q({ cart: cartOf(100) }).ltmFee).toBe(0);
    });
});

describe('fail-closed — missing data throws, never a fallback price (Erik #1 rule)', () => {
    test('missing bundle', () => {
        expect(() => CAPS.unitPrice(undefined, 24)).toThrow(/not loaded/);
        expect(() => CAPS.unitPrice({}, 24)).toThrow(/not loaded/);
        expect(() => CAPS.unitPrice({ tiersR: [] }, 24)).toThrow(/not loaded/);
    });

    test('missing 8K Cap cost row for the matched tier', () => {
        const b = capBundle(6.75);
        b.allEmbroideryCostsR = b.allEmbroideryCostsR.filter((c) => c.TierLabel !== '24-47');
        expect(() => CAPS.unitPrice(b, 24)).toThrow(/embroidery cost/i);
        expect(CAPS.unitPrice(b, 8).perCap).toBe(30);   // other tiers unaffected
    });

    test('no OSFA blank price (fitted caps like NE1000 are excluded from v1)', () => {
        const fitted = capBundle(6.75);
        fitted.sizes = [{ size: 'S/M', price: 7.59 }, { size: 'M/L', price: 7.59 }, { size: 'L/XL', price: 7.59 }];
        expect(() => CAPS.unitPrice(fitted, 24)).toThrow(/OSFA/);
    });

    test('zero/missing MarginDenominator on the matched tier', () => {
        const b = capBundle(6.75);
        b.tiersR = b.tiersR.map((t) => (t.TierLabel === '24-47' ? { ...t, MarginDenominator: 0 } : t));
        expect(() => CAPS.unitPrice(b, 24)).toThrow(/MarginDenominator/);
    });

    test('shipped order without the CAPS-SHIP-* config throws (no legacy flat fallback)', () => {
        expect(() => q({ config: {} })).toThrow(/CAPS-SHIP/);
        expect(() => q({ config: { shipFlat: 7.99 } })).toThrow(/CAPS-SHIP/);   // half-loaded is still closed
    });

    test('pickup order does NOT need the shipping config', () => {
        const r = q({ config: {}, delivery: { method: 'pickup', taxRate: null } });
        expect(r.shipping).toBe(0);
        expect(r.total).toBe(r.capsSubtotal);
    });
});

describe('CeilDollar rounding edges', () => {
    test('a cent over the dollar rounds UP (blank 4.78 @ 8-23: 9.0189 + 17 = 26.0189 → 27)', () => {
        expect(CAPS.unitPrice(capBundle(4.78), 8).perCap).toBe(27);
    });

    test('IEEE float dust on an exact dollar does NOT bill an extra dollar (5.30/0.53 + 17 = 27.000000000000004 → 27)', () => {
        expect(CAPS.unitPrice(capBundle(5.30), 8).perCap).toBe(27);
    });

    test('ceilDollar primitive: 25.999 → 26, 26 → 26, 26.001 → 27 (cents-resolution)', () => {
        expect(CAPS.ceilDollar(25.999)).toBe(26);   // r2 → 26.00 exactly
        expect(CAPS.ceilDollar(26)).toBe(26);
        expect(CAPS.ceilDollar(26.01)).toBe(27);
        expect(CAPS.ceilDollar(26.004)).toBe(26);   // sub-cent dust collapses first
    });
});

describe('order math — lines, threshold shipping, WA tax base', () => {
    test('multi-color order: per-line extensions + subtotal (24 caps @ $26 = $624, matches lineup)', () => {
        const r = q({
            cart: [
                { catalogColor: 'Black', colorName: 'Black', quantity: 16 },
                { catalogColor: 'Navy', colorName: 'Navy', quantity: 8 },
            ],
        });
        expect(r.combinedQty).toBe(24);
        expect(r.lines).toEqual([
            { catalogColor: 'Black', colorName: 'Black', size: 'OSFA', quantity: 16, unitPrice: 26, extended: 416 },
            { catalogColor: 'Navy', colorName: 'Navy', size: 'OSFA', quantity: 8, unitPrice: 26, extended: 208 },
        ]);
        expect(r.capsSubtotal).toBe(624);
        expect(r.shirtsSubtotal).toBe(624);   // checkout-route compat alias
    });

    test('free shipping at/over the threshold — and the 8-cap minimum ALWAYS clears the $100 launch threshold (cheapest style C914: 8 × $23 = $184)', () => {
        const cheapest = q({ capBundle: capBundle(3.12), cart: cartOf(8) });
        expect(cheapest.capsSubtotal).toBe(184);
        expect(cheapest.capsSubtotal).toBeGreaterThanOrEqual(CONFIG.shipFreeOver);
        expect(cheapest.shipping).toBe(0);
        expect(cheapest.freeShipRemaining).toBe(0);
    });

    test('flat rate under the threshold (exercised with a raised threshold — Erik can retune CAPS-SHIP-FREE-OVER in Caspio)', () => {
        const r = q({ cart: cartOf(8), config: { shipFlat: 7.99, shipFreeOver: 500 } });
        expect(r.capsSubtotal).toBe(240);
        expect(r.shipping).toBe(7.99);
        expect(r.freeShipRemaining).toBe(260);
        expect(r.shipFreeOver).toBe(500);
    });

    test('WA tax on (merchandise + billable shipping), rounded to cents', () => {
        const r = q({
            cart: cartOf(8),
            config: { shipFlat: 7.99, shipFreeOver: 500 },
            delivery: { method: 'ship', taxRate: 0.101 },
        });
        expect(r.taxableBase).toBe(247.99);            // 240 + 7.99
        expect(r.tax).toBe(25.05);                     // r2(247.99 × 0.101)
        expect(r.total).toBe(273.04);
    });

    test('pickup: no shipping in the tax base', () => {
        const r = q({ cart: cartOf(8), delivery: { method: 'pickup', taxRate: 0.101 } });
        expect(r.shipping).toBe(0);
        expect(r.taxableBase).toBe(240);
        expect(r.tax).toBe(24.24);
        expect(r.total).toBe(264.24);
    });

    test('no tax rate → 0 tax (out-of-state)', () => {
        const r = q({ cart: cartOf(24) });
        expect(r.tax).toBe(0);
        expect(r.total).toBe(624);
    });

    test('unitBySize.OSFA carries the price the shared checkout route stamps onto cleanConfigs', () => {
        const r = q({ cart: cartOf(48), backLogo: true });
        expect(r.unitBySize.OSFA.finalPrice).toBe(28.5);   // 24 + 4.50
        expect(r.lines[0].unitPrice).toBe(28.5);
    });
});

describe('module loading', () => {
    test('require() returns the engine (server twin uses this path)', () => {
        expect(typeof CAPS.quote).toBe('function');
        expect(typeof CAPS.unitPrice).toBe('function');
        expect(typeof CAPS.backLogoPerCap).toBe('function');
        expect(CAPS.INCLUDED_STITCH_COUNT).toBe(8000);
    });

    test('browser-global dual-load: with a window present, CAPSPricing hangs off it (same guard as the tees module)', () => {
        // Simulate a browser: the IIFE binds to `window` when one exists.
        globalThis.window = globalThis;
        try {
            let browserExport;
            jest.isolateModules(() => {
                browserExport = require('../../pages/js/custom-caps-pricing.js');
            });
            expect(globalThis.CAPSPricing).toBe(browserExport);
            expect(typeof globalThis.CAPSPricing.quote).toBe('function');
        } finally {
            delete globalThis.window;
            delete globalThis.CAPSPricing;
        }
    });
});
