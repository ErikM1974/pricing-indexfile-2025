/**
 * custom-tees-pricing.test.js — behavioral spec for the Custom T-Shirts engine.
 *
 * The engine is the 3DT module converted to INTERNAL-DTG-BUILDER parity
 * (Erik 2026-06-10):
 *   - rush is OPT-IN: standard orders take NO markup; rush applies rushPct
 *   - LTM is the DTG builder's distributed math: tier LTM_Fee floor'd per
 *     piece × qty (12 pcs @ $50 → $4.16/pc → $49.92, NOT flat $50/$75)
 *   - back print can be FB or JB; front adds JF
 * Fixture mirrors /api/pricing-bundle?method=DTG_Store — the retail storefront's
 * OWN tiers (Erik 2026-06-22): $25 LTM on the 1-11/12-23 tiers, margin 0.53.
 * 1-11 has no cost rows so it falls back to the lowest non-LTM tier (24-47),
 * while 12-23 has its own $8.50 row and uses it directly.
 */
const CTSPricing = require('../../pages/js/custom-tees-pricing.js');

const BUNDLE = {
    tiersR: [
        { TierLabel: '1-11', MinQuantity: 1, MaxQuantity: 11, MarginDenominator: 0.53, LTM_Fee: 25 },
        { TierLabel: '12-23', MinQuantity: 12, MaxQuantity: 23, MarginDenominator: 0.53, LTM_Fee: 25 },
        { TierLabel: '24-47', MinQuantity: 24, MaxQuantity: 47, MarginDenominator: 0.53, LTM_Fee: 0 },
        { TierLabel: '48-71', MinQuantity: 48, MaxQuantity: 71, MarginDenominator: 0.53, LTM_Fee: 0 },
        { TierLabel: '72+', MinQuantity: 72, MaxQuantity: 99999, MarginDenominator: 0.53, LTM_Fee: 0 },
    ],
    allDtgCostsR: [
        { PrintLocationCode: 'LC', TierLabel: '12-23', PrintCost: 8.5 },
        { PrintLocationCode: 'LC', TierLabel: '24-47', PrintCost: 7.5 },
        { PrintLocationCode: 'LC', TierLabel: '48-71', PrintCost: 6.5 },
        { PrintLocationCode: 'LC', TierLabel: '72+', PrintCost: 5.5 },
        { PrintLocationCode: 'FF', TierLabel: '24-47', PrintCost: 10 },
        { PrintLocationCode: 'FF', TierLabel: '48-71', PrintCost: 9 },
        { PrintLocationCode: 'FF', TierLabel: '72+', PrintCost: 8 },
        { PrintLocationCode: 'JF', TierLabel: '24-47', PrintCost: 12.5 },
        { PrintLocationCode: 'JF', TierLabel: '48-71', PrintCost: 11.5 },
        { PrintLocationCode: 'JF', TierLabel: '72+', PrintCost: 10.5 },
        { PrintLocationCode: 'FB', TierLabel: '24-47', PrintCost: 10 },
        { PrintLocationCode: 'FB', TierLabel: '48-71', PrintCost: 9 },
        { PrintLocationCode: 'FB', TierLabel: '72+', PrintCost: 8 },
        { PrintLocationCode: 'JB', TierLabel: '24-47', PrintCost: 12.5 },
        { PrintLocationCode: 'JB', TierLabel: '48-71', PrintCost: 11.5 },
        { PrintLocationCode: 'JB', TierLabel: '72+', PrintCost: 10.5 },
    ],
    sizes: [
        { size: 'S', price: 3 }, { size: 'M', price: 3 }, { size: 'L', price: 3 },
        { size: 'XL', price: 3 }, { size: '2XL', price: 4.25 }, { size: '3XL', price: 5.53 },
    ],
    sellingPriceDisplayAddOns: { '2XL': 2, '3XL': 3 },
};

const CONFIG = { rushPct: 25, shipFee: 30, sizes: ['S', 'M', 'L', 'XL', '2XL', '3XL'] };

const cartOf = (qty, size = 'M', color = 'Jet Black') => [
    { catalogColor: color, colorName: color, qty: { [size]: qty } },
];

const q = (over) => CTSPricing.quote(Object.assign({
    pricingData: BUNDLE,
    config: CONFIG,
    cart: cartOf(24),
    location: 'LC',
    backLocation: null,
    rush: false,
    delivery: { method: 'ship', taxRate: null },
}, over));

describe('standard pricing — NO rush markup (internal-builder parity)', () => {
    test('24-47 LC M standard: 3/0.53 + 7.50 → halfDollarCeil 13.50, NO ×1.25', () => {
        const u = CTSPricing.unitPrice(BUNDLE, CONFIG, 24, 'LC', null, 'M', false);
        expect(u.basePrice).toBe(13.5);
        expect(u.finalPrice).toBe(13.5);     // rush off → final == base
        expect(u.rushFee).toBe(0);
        expect(u.tierLabel).toBe('24-47');
    });

    test('size upcharge added AFTER rounding, rush off (2XL +2)', () => {
        expect(CTSPricing.unitPrice(BUNDLE, CONFIG, 24, 'LC', null, '2XL', false).finalPrice).toBe(15.5);
    });

    test('rush=true applies rushPct on top: 13.50 × 1.25 = 16.875 → ceil 17.00', () => {
        const u = CTSPricing.unitPrice(BUNDLE, CONFIG, 24, 'LC', null, 'M', true);
        expect(u.basePrice).toBe(13.5);
        expect(u.finalPrice).toBe(17.0);
        expect(u.rushFee).toBe(3.5);
    });

    test('rush=true with missing rushPct throws (never silent 0%)', () => {
        expect(() => CTSPricing.unitPrice(BUNDLE, {}, 24, 'LC', null, 'M', true))
            .toThrow(/Rush percent/);
    });
});

describe('LTM — DTG builder distributed math (tier LTM_Fee, floor per piece)', () => {
    test('12 pcs @ $25 tier fee (12-23) → 2.08/pc → order LTM $24.96', () => {
        const r = q({ cart: cartOf(12) });
        expect(r.ltmPerPiece).toBe(2.08);
        expect(r.ltmFee).toBe(24.96);
        expect(r.tierLabel).toBe('12-23');
    });

    test('24 pcs → no LTM (tier fee 0)', () => {
        const r = q({ cart: cartOf(24) });
        expect(r.ltmFee).toBe(0);
        expect(r.ltmPerPiece).toBe(0);
    });

    test('12-23 is a real tier: uses its own $8.50 print row → base 14.50 (no orphan fallback)', () => {
        // 12-23 tier: garment 3/0.53=5.6604 + LC@12-23 8.50 = 14.1604 → ceil 14.50
        const u = CTSPricing.unitPrice(BUNDLE, CONFIG, 12, 'LC', null, 'M', false);
        expect(u.basePrice).toBe(14.5);
        expect(u.costLabel).toBe('12-23');
    });

    test('1-11 tier has no cost rows → falls back to lowest non-LTM (24-47), never $0', () => {
        // 1-11 tier: garment 3/0.53=5.6604 + LC@24-47 7.50 = 13.1604 → ceil 13.50
        const u = CTSPricing.unitPrice(BUNDLE, CONFIG, 5, 'LC', null, 'M', false);
        expect(u.basePrice).toBe(13.5);
        expect(u.costLabel).toBe('24-47');
    });

    test('total parity example: 12×M LC standard = 12×14.50 + 24.96 = 198.96', () => {
        const r = q({ cart: cartOf(12), delivery: { method: 'pickup', taxRate: null } });
        expect(r.shirtsSubtotal).toBe(174.0);
        expect(r.total).toBe(198.96);
    });

    test('the DTG_Store tier LTM_Fee is the SOLE source — a stray config.ltmFee is ignored', () => {
        // CTS-LTM override retired 2026-06-22: only the tier ($25 on 12-23) drives the fee.
        const r = q({ cart: cartOf(12), config: { ...CONFIG, ltmFee: 999 }, delivery: { method: 'pickup', taxRate: null } });
        expect(r.ltmPerPiece).toBe(2.08);
        expect(r.ltmFee).toBe(24.96);
        expect(r.total).toBe(198.96);
    });

    test('to WAIVE the fee, set the tier LTM_Fee to 0 in Caspio (a 0-LTM tier charges nothing)', () => {
        const zeroLtm = { ...BUNDLE, tiersR: BUNDLE.tiersR.map((t) => ({ ...t, LTM_Fee: 0 })) };
        const r = CTSPricing.quote({
            pricingData: zeroLtm, config: CONFIG, cart: cartOf(12),
            location: 'LC', backLocation: null, rush: false,
            delivery: { method: 'pickup', taxRate: null },
        });
        expect(r.ltmFee).toBe(0);
    });
});

describe('BAKED LTM + threshold shipping (UberPrints model, Erik 2026-06-10)', () => {
    const BAKED_CFG = { ...CONFIG, bakeLtm: true, shipFlat: 7.99, shipFreeOver: 100 };

    test('bake folds the per-piece share into unit prices — IDENTICAL total, no fee line', () => {
        const sep = q({ cart: cartOf(12), delivery: { method: 'pickup', taxRate: null } });
        const bak = q({ cart: cartOf(12), config: BAKED_CFG, delivery: { method: 'pickup', taxRate: null } });
        expect(bak.ltmFee).toBe(0);
        expect(bak.ltmBaked).toBe(true);
        expect(bak.ltmBakedPerPiece).toBe(2.08);
        expect(bak.ltmBakedTotal).toBe(24.96);
        expect(bak.unitBySize.M.finalPrice).toBe(16.58);          // 14.50 + 2.08
        expect(bak.lines[0].unitPrice).toBe(16.58);
        expect(bak.total).toBe(sep.total);                         // 198.96 either way
    });

    test('24+ pieces: nothing to bake — unit price is the clean tier price', () => {
        const r = q({ cart: cartOf(24), config: BAKED_CFG, delivery: { method: 'pickup', taxRate: null } });
        expect(r.ltmBaked).toBe(false);
        expect(r.ltmBakedTotal).toBe(0);
        expect(r.unitBySize.M.finalPrice).toBe(13.5);   // fixture's 24-47 M LC price, no bake added
    });

    test('threshold shipping: under $100 merch pays the flat $7.99', () => {
        const r = q({ cart: cartOf(5), config: BAKED_CFG, delivery: { method: 'ship', taxRate: null } });
        // 5 pcs in the 1-11 tier: base 13.50 (LC falls back to 24-47 $7.50) +
        // ltmPerPiece floor(25/5*100)/100 = 5.00 → unit 18.50, merch 92.50 < 100
        expect(r.unitBySize.M.finalPrice).toBe(18.5);
        expect(r.shipping).toBe(7.99);
        expect(r.shippingModel).toBe('threshold');
        expect(r.freeShipRemaining).toBe(7.5);                     // 100 − 92.50
    });

    test('threshold shipping: at/over $100 merch ships FREE', () => {
        const r = q({ cart: cartOf(12), config: BAKED_CFG, delivery: { method: 'ship', taxRate: null } });
        expect(r.shipping).toBe(0);                                // merch 198.96 ≥ 100
        expect(r.freeShipRemaining).toBe(0);
    });

    test('pickup never charges shipping regardless of threshold', () => {
        const r = q({ cart: cartOf(5), config: BAKED_CFG, delivery: { method: 'pickup', taxRate: null } });
        expect(r.shipping).toBe(0);
        expect(r.freeShipRemaining).toBe(null);
    });

    test('WA tax bases on merch + flat shipping when charged', () => {
        const r = q({ cart: cartOf(5), config: BAKED_CFG, delivery: { method: 'ship', taxRate: 0.101 } });
        expect(r.taxableBase).toBe(100.49);                        // 92.50 + 7.99
        expect(r.tax).toBe(10.15);                                 // r2(100.49 × .101) = 10.1495 → 10.15
        expect(r.total).toBe(110.64);
    });

    test('legacy fixed shipFee still works when the threshold pair is absent', () => {
        const r = q({ cart: cartOf(12), delivery: { method: 'ship', taxRate: null } });
        expect(r.shipping).toBe(30);
        expect(r.shippingModel).toBe('legacy');
    });
});

describe('back locations FB/JB + front JF', () => {
    test('JF front prices from the JF cost row', () => {
        // 3/0.53 + 12.50 = 18.1604 → ceil 18.50
        const u = CTSPricing.unitPrice(BUNDLE, CONFIG, 24, 'JF', null, 'M', false);
        expect(u.basePrice).toBe(18.5);
    });

    test('JB back adds the JB cost row', () => {
        // 3/0.53 + 7.50 + 12.50 = 25.6604 → ceil 26.00
        const u = CTSPricing.unitPrice(BUNDLE, CONFIG, 24, 'LC', 'JB', 'M', false);
        expect(u.basePrice).toBe(26.0);
    });

    test('legacy backEnabled:true still means FB', () => {
        const r = q({ backLocation: undefined, backEnabled: true });
        // 3/0.53 + 7.50 + 10 = 23.1604 → ceil 23.50
        expect(r.unitBySize.M.basePrice).toBe(23.5);
        expect(r.backLocation).toBe('FB');
    });

    test('missing back cost row throws — never a silent $0 back print', () => {
        const noJb = { ...BUNDLE, allDtgCostsR: BUNDLE.allDtgCostsR.filter(c => c.PrintLocationCode !== 'JB') };
        expect(() => CTSPricing.unitPrice(noJb, CONFIG, 24, 'LC', 'JB', 'M', false))
            .toThrow(/No DTG print cost/);
    });

    test('back-only design (null front): no front print cost, back cost applies', () => {
        // 3/0.53 + FB 10 = 15.6604 → ceil 16.00 (no LC 7.50 in there)
        const u = CTSPricing.unitPrice(BUNDLE, CONFIG, 24, null, 'FB', 'M', false);
        expect(u.basePrice).toBe(16.0);
    });

    test('NO print on either side throws — undecorated shirt never silently priced', () => {
        expect(() => CTSPricing.unitPrice(BUNDLE, CONFIG, 24, null, null, 'M', false))
            .toThrow(/No print/);
    });
});

describe('order math — shipping + WA tax base', () => {
    test('shipping joins the tax base; tax rounds before summing', () => {
        const r = q({ cart: cartOf(24), delivery: { method: 'ship', taxRate: 0.101 } });
        // 24 × 13.50 = 324 + ship 30 = 354 taxable → 35.754 → 35.75
        expect(r.shipping).toBe(30);
        expect(r.taxableBase).toBe(354);
        expect(r.tax).toBe(35.75);
        expect(r.total).toBe(389.75);
    });

    test('pickup → no shipping, no ship tax', () => {
        const r = q({ cart: cartOf(24), delivery: { method: 'pickup', taxRate: 0.101 } });
        expect(r.shipping).toBe(0);
        expect(r.taxableBase).toBe(324);
    });

    test('empty cart quotes $0 without throwing', () => {
        const r = q({ cart: [] });
        expect(r.total).toBe(0);
        expect(r.combinedQty).toBe(0);
    });
});

describe('locationForArtSize — size drives the price tier (Erik 2026-06-10)', () => {
    const f = CTSPricing.locationForArtSize;
    test('front: ≤4×4 is Left Chest', () => {
        expect(f('front', 4, 4)).toBe('LC');
        expect(f('front', 3.2, 2.4)).toBe('LC');
    });
    test('front: over 4″ in EITHER dimension jumps to Full Front', () => {
        expect(f('front', 4.5, 3)).toBe('FF');
        expect(f('front', 3, 4.5)).toBe('FF');
        expect(f('front', 12, 16)).toBe('FF');
    });
    test('front: over 12×16 is Jumbo Front', () => {
        expect(f('front', 12.5, 10)).toBe('JF');
        expect(f('front', 10, 16.5)).toBe('JF');
        expect(f('front', 16, 20)).toBe('JF');
    });
    test('back: ≤12×16 is Full Back, bigger is Jumbo Back', () => {
        expect(f('back', 10, 12)).toBe('FB');
        expect(f('back', 12, 16)).toBe('FB');
        expect(f('back', 12.5, 12)).toBe('JB');
        expect(f('back', 16, 20)).toBe('JB');
    });
    test('garbage dims fall to the smallest tier (fail-cheap is fail-VISIBLE: server clamps art to envelope before calling)', () => {
        expect(f('front', null, undefined)).toBe('LC');
        expect(f('back', NaN, NaN)).toBe('FB');
    });
});

describe('nudge — tier-derived LTM', () => {
    test('sub-24 nudge reports the LTM drop using distributed fee', () => {
        const r = q({ cart: cartOf(20), delivery: { method: 'pickup', taxRate: null } });
        expect(['ltm-drop', 'ltm-drop-saves']).toContain(r.nudge.type);
        expect(r.nudge.addQty).toBe(4);
    });

    test('72+ is the best tier — no further nudge', () => {
        const r = q({ cart: cartOf(100) });
        expect(r.nudge.type).toBe('best');
    });
});

describe('per-shirt sale — config.saleOff (CTS-SALE-{STYLE} Caspio code, 2026-06-12)', () => {
    test('saleOff 1.00 takes exactly $1 off every unit: 13.50 → 12.50, subtotal 24×12.50', () => {
        const r = q({ config: Object.assign({}, CONFIG, { saleOff: 1.0 }) });
        expect(r.unitBySize.M.finalPrice).toBe(12.5);
        expect(r.shirtsSubtotal).toBe(300);
        expect(r.perShirt).toBe(12.5);
        expect(r.saleOff).toBe(1.0);
    });

    test('absent / 0 / negative saleOff changes NOTHING (regular price)', () => {
        const base = q({});
        expect(base.saleOff).toBe(0);
        expect(base.unitBySize.M.finalPrice).toBe(13.5);
        expect(q({ config: Object.assign({}, CONFIG, { saleOff: 0 }) }).unitBySize.M.finalPrice).toBe(13.5);
        expect(q({ config: Object.assign({}, CONFIG, { saleOff: -5 }) }).unitBySize.M.finalPrice).toBe(13.5);
        expect(q({ config: Object.assign({}, CONFIG, { saleOff: 'nope' }) }).unitBySize.M.finalPrice).toBe(13.5);
    });

    test('sale applies AFTER rush markup (off the sticker): 17.00 − 1.00 = 16.00', () => {
        const r = q({ rush: true, config: Object.assign({}, CONFIG, { saleOff: 1.0 }) });
        expect(r.unitBySize.M.finalPrice).toBe(16.0);
    });

    test('sale stacks with the baked LTM: unit = (13.50+1LC tier) discounted then +ltmPerPiece', () => {
        // 12 pcs LC: 1-23 tier (12-23 cost row 8.50, MD 0.55) — with bakeLtm the
        // distributed fee joins the unit AFTER the sale discount.
        const cfg = Object.assign({}, CONFIG, { saleOff: 1.0, ltmFee: 25, bakeLtm: true });
        const withSale = q({ cart: cartOf(12), config: cfg });
        const noSale = q({ cart: cartOf(12), config: Object.assign({}, cfg, { saleOff: 0 }) });
        // exactly $1/shirt apart, LTM bake identical on both sides
        expect(noSale.perShirt - withSale.perShirt).toBeCloseTo(1.0, 2);
        expect(withSale.ltmBakedTotal).toBe(noSale.ltmBakedTotal);
    });

    test('clamps at $0 — an oversized sale can never go negative', () => {
        const r = q({ config: Object.assign({}, CONFIG, { saleOff: 999 }) });
        expect(r.unitBySize.M.finalPrice).toBe(0);
        expect(r.shirtsSubtotal).toBe(0);
    });
});
