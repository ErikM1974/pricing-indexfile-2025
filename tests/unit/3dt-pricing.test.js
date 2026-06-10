/**
 * 3dt-pricing.test.js — behavioral spec for the 3-Day Tees pricing engine.
 *
 * The fixture mirrors the REAL /api/pricing-bundle?method=DTG&styleNumber=PC54
 * shape as of 2026-06-09, including the two traps that broke the legacy page:
 *   - the 1-23 LTM tier exists in tiersR but has NO rows in allDtgCostsR
 *   - allDtgCostsR carries an orphaned '12-23' label no tier points at
 * Sub-24 must resolve costs at the lowest non-LTM tier (24-47) and add the
 * $75 3DT LTM fee — never a $0 print cost, never the orphaned 12-23 rows.
 */
const TDTPricing = require('../../pages/js/3-day-tees-pricing.js');

const BUNDLE = {
    tiersR: [
        { TierLabel: '24-47', MinQuantity: 24, MaxQuantity: 47, MarginDenominator: 0.53, LTM_Fee: 0 },
        { TierLabel: '48-71', MinQuantity: 48, MaxQuantity: 71, MarginDenominator: 0.53, LTM_Fee: 0 },
        { TierLabel: '72+', MinQuantity: 72, MaxQuantity: 99999, MarginDenominator: 0.53, LTM_Fee: 0 },
        { TierLabel: '1-23', MinQuantity: 1, MaxQuantity: 23, MarginDenominator: 0.55, LTM_Fee: 50 },
    ],
    allDtgCostsR: [
        { PrintLocationCode: 'LC', TierLabel: '12-23', PrintCost: 8.5 },
        { PrintLocationCode: 'LC', TierLabel: '24-47', PrintCost: 7.5 },
        { PrintLocationCode: 'LC', TierLabel: '48-71', PrintCost: 6.5 },
        { PrintLocationCode: 'LC', TierLabel: '72+', PrintCost: 5.5 },
        { PrintLocationCode: 'FF', TierLabel: '12-23', PrintCost: 11 },
        { PrintLocationCode: 'FF', TierLabel: '24-47', PrintCost: 10 },
        { PrintLocationCode: 'FF', TierLabel: '48-71', PrintCost: 9 },
        { PrintLocationCode: 'FF', TierLabel: '72+', PrintCost: 8 },
        { PrintLocationCode: 'FB', TierLabel: '12-23', PrintCost: 11 },
        { PrintLocationCode: 'FB', TierLabel: '24-47', PrintCost: 10 },
        { PrintLocationCode: 'FB', TierLabel: '48-71', PrintCost: 9 },
        { PrintLocationCode: 'FB', TierLabel: '72+', PrintCost: 8 },
    ],
    sizes: [
        { size: 'S', price: 3 }, { size: 'M', price: 3 }, { size: 'L', price: 3 },
        { size: 'XL', price: 3 }, { size: '2XL', price: 4.25 }, { size: '3XL', price: 5.53 },
    ],
    sellingPriceDisplayAddOns: { '2XL': 2, '3XL': 3 },
};

const CONFIG = {
    rushPct: 25, ltmFee: 75, ltmThreshold: 24, shipFee: 30,
    sizes: ['S', 'M', 'L', 'XL', '2XL', '3XL'],
};

const cartOf = (qty, size = 'M', color = 'Jet Black') => [
    { catalogColor: color, colorName: color, qty: { [size]: qty } },
];

const q = (over) => TDTPricing.quote(Object.assign({
    pricingData: BUNDLE,
    config: CONFIG,
    cart: cartOf(24),
    location: 'LC',
    backEnabled: false,
    delivery: { method: 'ship', taxRate: null },
}, over));

describe('unitPrice — 7-step formula parity', () => {
    test('24-47 LC M: 3/0.53 + 7.50 → 13.50 → ×1.25 → 17.00', () => {
        const u = TDTPricing.unitPrice(BUNDLE, CONFIG, 24, 'LC', false, 'M');
        expect(u.basePrice).toBe(13.5);
        expect(u.finalPrice).toBe(17.0);
        expect(u.tierLabel).toBe('24-47');
    });

    test('48-71 LC M: 3/0.53 + 6.50 → 12.50 → 15.625 → ceil 16.00', () => {
        const u = TDTPricing.unitPrice(BUNDLE, CONFIG, 50, 'LC', false, 'M');
        expect(u.basePrice).toBe(12.5);
        expect(u.finalPrice).toBe(16.0);
    });

    test('72+ LC M: 3/0.53 + 5.50 → 11.50 → 14.375 → ceil 14.50', () => {
        const u = TDTPricing.unitPrice(BUNDLE, CONFIG, 100, 'LC', false, 'M');
        expect(u.finalPrice).toBe(14.5);
    });

    test('size upcharge added AFTER final rounding (2XL +2, 3XL +3)', () => {
        expect(TDTPricing.unitPrice(BUNDLE, CONFIG, 24, 'LC', false, '2XL').finalPrice).toBe(19.0);
        expect(TDTPricing.unitPrice(BUNDLE, CONFIG, 24, 'LC', false, '3XL').finalPrice).toBe(20.0);
    });

    test('combo front+back adds FB print cost: LC+FB 24 → base 23.50 → 29.50', () => {
        // 5.6604 + 7.50 + 10 = 23.1604 → 23.50 → ×1.25 = 29.375 → 29.50
        const u = TDTPricing.unitPrice(BUNDLE, CONFIG, 24, 'LC', true, 'M');
        expect(u.basePrice).toBe(23.5);
        expect(u.finalPrice).toBe(29.5);
    });

    test('SUB-24 uses the 1-23 margin with 24-47 COST rows (the legacy $0-print-cost bug)', () => {
        // 3/0.55 = 5.4545 + 7.50 (24-47 LC, NOT 8.50 from orphaned 12-23, NOT 0)
        // = 12.9545 → 13.00 → ×1.25 = 16.25 → 16.50
        const u = TDTPricing.unitPrice(BUNDLE, CONFIG, 15, 'LC', false, 'M');
        expect(u.tierLabel).toBe('1-23');
        expect(u.costLabel).toBe('24-47');
        expect(u.basePrice).toBe(13.0);
        expect(u.finalPrice).toBe(16.5);
    });

    test('missing cost rows for the resolved label THROW — never silent $0', () => {
        const broken = Object.assign({}, BUNDLE, {
            allDtgCostsR: BUNDLE.allDtgCostsR.filter((c) => c.PrintLocationCode !== 'FF'),
        });
        expect(() => TDTPricing.unitPrice(broken, CONFIG, 24, 'FF', false, 'M'))
            .toThrow(/print cost/i);
    });

    test('unloaded rush config throws — pricing is API, never assumed', () => {
        expect(() => TDTPricing.unitPrice(BUNDLE, { rushPct: undefined }, 24, 'LC', false, 'M'))
            .toThrow(/rush/i);
    });
});

describe('quote — order math', () => {
    test('tier driven by COMBINED quantity across colors', () => {
        const r = q({
            cart: [
                { catalogColor: 'Jet Black', qty: { M: 12 } },
                { catalogColor: 'White', qty: { L: 12 } },
            ],
        });
        expect(r.combinedQty).toBe(24);
        expect(r.tierLabel).toBe('24-47');
        expect(r.unitBySize.M.finalPrice).toBe(17.0);
    });

    test('LTM fee applies 1-23, not at 24', () => {
        expect(q({ cart: cartOf(23) }).ltmFee).toBe(75);
        expect(q({ cart: cartOf(6) }).ltmFee).toBe(75);
        expect(q({ cart: cartOf(1) }).ltmFee).toBe(75);
        expect(q({ cart: cartOf(24) }).ltmFee).toBe(0);
    });

    test('shipping $30 when shipped, 0 on pickup', () => {
        expect(q({}).shipping).toBe(30);
        expect(q({ delivery: { method: 'pickup', taxRate: 0.101 } }).shipping).toBe(0);
    });

    test('tax base = shirts + LTM + shipping (billable shipping is taxable, 2026-06-09 ruling)', () => {
        const r = q({ cart: cartOf(15), delivery: { method: 'ship', taxRate: 0.101 } });
        // 15 × 16.50 = 247.50 + 75 + 30 = 352.50 → tax 35.6025 → 35.60
        expect(r.shirtsSubtotal).toBe(247.5);
        expect(r.taxableBase).toBe(352.5);
        expect(r.tax).toBe(35.6);
        expect(r.total).toBe(388.1);
    });

    test('no tax when rate is null (out of state) — total still foots', () => {
        const r = q({ cart: cartOf(24), delivery: { method: 'ship', taxRate: 0 } });
        expect(r.tax).toBe(0);
        expect(r.total).toBe(24 * 17 + 30);
    });

    test('empty cart returns zeros without throwing', () => {
        const r = q({ cart: [] });
        expect(r.combinedQty).toBe(0);
        expect(r.total).toBe(0);
        expect(r.nudge).toBeNull();
    });

    test('lines carry CATALOG_COLOR + exact extended prices', () => {
        const r = q({
            cart: [{ catalogColor: 'Dk Hthr Grey', colorName: 'Dark Heather Grey', qty: { M: 10, '2XL': 2 } }],
            cart_note: undefined,
        });
        const m = r.lines.find((l) => l.size === 'M');
        const xxl = r.lines.find((l) => l.size === '2XL');
        expect(m.catalogColor).toBe('Dk Hthr Grey');
        expect(m.extended).toBe(10 * r.unitBySize.M.finalPrice);
        expect(xxl.extended).toBe(2 * r.unitBySize['2XL'].finalPrice);
        expect(r.shirtsSubtotal).toBe(m.extended + xxl.extended);
    });
});

describe('nudge engine', () => {
    test('sub-24 crossing that genuinely lowers the total → ltm-drop-saves with real math', () => {
        const r = q({ cart: cartOf(23) });
        // 23 × 16.50 + 75 = 454.50 vs 24 × 17.00 = 408.00 → save 46.50
        expect(r.nudge.type).toBe('ltm-drop-saves');
        expect(r.nudge.addQty).toBe(1);
        expect(r.nudge.hereTotal).toBe(454.5);
        expect(r.nudge.thereTotal).toBe(408.0);
        expect(r.nudge.savings).toBe(46.5);
    });

    test('mid-tier → tier-up with per-shirt savings', () => {
        const r = q({ cart: cartOf(40) });
        expect(r.nudge.type).toBe('tier-up');
        expect(r.nudge.addQty).toBe(8);
        expect(r.nudge.perShirtSave).toBe(1.0); // 17.00 → 16.00
    });

    test('top tier → best', () => {
        expect(q({ cart: cartOf(80) }).nudge.type).toBe('best');
    });
});
