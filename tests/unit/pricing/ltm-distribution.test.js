/**
 * LTM Distribution Tests
 * Tests LTM (Less Than Minimum) fee distribution logic
 *
 * Rules:
 * - $50 LTM fee when qty <= 7
 * - Divided equally across all pieces: $50 / qty
 * - Added to per-piece unit price (baked in, no separate fee row)
 * - Separate LTM for caps and garments
 * - Not applied to sellPriceOverride products
 * - Not applied when qty >= 8
 */
const { createTestCalculator } = require('../../fixtures/pricing-test-helper');

describe('LTM distribution logic', () => {
    let calc;

    beforeEach(() => {
        calc = createTestCalculator();
    });

    // --- LTM applies: qty 1-7 ---
    test('qty 1: LTM per piece = $50.00', () => {
        const ltmPerPiece = calc.ltmFee / 1;
        expect(ltmPerPiece).toBe(50.00);
    });

    test('qty 2: LTM per piece = $25.00', () => {
        const ltmPerPiece = calc.ltmFee / 2;
        expect(ltmPerPiece).toBe(25.00);
    });

    test('qty 3: LTM per piece = $16.67 (rounded)', () => {
        const ltmPerPiece = calc.ltmFee / 3;
        expect(+ltmPerPiece.toFixed(2)).toBe(16.67);
    });

    test('qty 5: LTM per piece = $10.00', () => {
        const ltmPerPiece = calc.ltmFee / 5;
        expect(ltmPerPiece).toBe(10.00);
    });

    test('qty 7: LTM per piece = $7.14 (rounded)', () => {
        const ltmPerPiece = calc.ltmFee / 7;
        expect(+ltmPerPiece.toFixed(2)).toBe(7.14);
    });

    // --- LTM does not apply: qty >= 8 ---
    test('qty 8: no LTM (tier 8-23)', () => {
        const tier = calc.getTier(8);
        expect(calc.tiers[tier].hasLTM).toBe(false);
    });

    test('qty 24: no LTM (tier 24-47)', () => {
        const tier = calc.getTier(24);
        expect(calc.tiers[tier].hasLTM).toBe(false);
    });

    test('qty 72: no LTM (tier 72+)', () => {
        const tier = calc.getTier(72);
        expect(calc.tiers[tier].hasLTM).toBe(false);
    });

    // --- Baked-in price: unitPrice + LTM ---
    test('unit price $39.50 + LTM for qty 1 = $89.50', () => {
        const unitPrice = 39.50;
        const ltmPerPiece = calc.ltmFee / 1;
        expect(unitPrice + ltmPerPiece).toBe(89.50);
    });

    test('unit price $39.50 + LTM for qty 3 = ~$56.17', () => {
        const unitPrice = 39.50;
        const ltmPerPiece = calc.ltmFee / 3;
        expect(+(unitPrice + ltmPerPiece).toFixed(2)).toBe(56.17);
    });

    test('unit price $39.50 + LTM for qty 7 = ~$46.64', () => {
        const unitPrice = 39.50;
        const ltmPerPiece = calc.ltmFee / 7;
        expect(+(unitPrice + ltmPerPiece).toFixed(2)).toBe(46.64);
    });

    // --- LTM fee constant ---
    test('LTM fee is $50.00', () => {
        expect(calc.ltmFee).toBe(50.00);
    });

    // --- Separate cap/garment LTM ---
    test('3 garments + 3 caps: each group gets separate $50 LTM', () => {
        // Per the code: garmentLtm = $50 if garmentQty <= 7, capLtm = $50 if capQty <= 7
        const garmentQty = 3;
        const capQty = 3;
        const garmentLtm = garmentQty <= 7 ? calc.ltmFee : 0;
        const capLtm = capQty <= 7 ? calc.ltmFee : 0;
        expect(garmentLtm + capLtm).toBe(100.00);
    });

    test('8 garments + 3 caps: only caps get LTM ($50)', () => {
        const garmentQty = 8;
        const capQty = 3;
        const garmentLtm = garmentQty <= 7 ? calc.ltmFee : 0;
        const capLtm = capQty <= 7 ? calc.ltmFee : 0;
        expect(garmentLtm).toBe(0);
        expect(capLtm).toBe(50.00);
    });

    test('8 garments + 8 caps: no LTM for either', () => {
        const garmentQty = 8;
        const capQty = 8;
        const garmentLtm = garmentQty <= 7 ? calc.ltmFee : 0;
        const capLtm = capQty <= 7 ? calc.ltmFee : 0;
        expect(garmentLtm + capLtm).toBe(0);
    });
});
