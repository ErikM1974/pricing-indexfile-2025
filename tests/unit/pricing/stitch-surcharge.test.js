/**
 * Stitch Surcharge Tests
 * Tests EmbroideryPricingCalculator.getStitchSurcharge() — flat tier surcharges
 *
 * Tiers: 0-10K = $0, 10,001-15K = $4 (Mid), 15,001-25K = $10 (Large)
 * Above 25K (Full Back) — capped at $10 in this method
 */
const { createTestCalculator } = require('../../fixtures/pricing-test-helper');

describe('getStitchSurcharge()', () => {
    let calc;

    beforeEach(() => {
        calc = createTestCalculator();
    });

    // --- Standard tier: $0 ---
    test('5000 stitches → $0 (well under standard)', () => {
        expect(calc.getStitchSurcharge(5000)).toBe(0);
    });

    test('8000 stitches → $0 (standard base)', () => {
        expect(calc.getStitchSurcharge(8000)).toBe(0);
    });

    test('10000 stitches → $0 (upper boundary of standard)', () => {
        expect(calc.getStitchSurcharge(10000)).toBe(0);
    });

    // --- Mid tier: $4 ---
    test('10001 stitches → $4 (just above standard)', () => {
        expect(calc.getStitchSurcharge(10001)).toBe(4);
    });

    test('12000 stitches → $4 (mid range)', () => {
        expect(calc.getStitchSurcharge(12000)).toBe(4);
    });

    test('15000 stitches → $4 (upper boundary of mid)', () => {
        expect(calc.getStitchSurcharge(15000)).toBe(4);
    });

    // --- Large tier: $10 ---
    test('15001 stitches → $10 (just above mid)', () => {
        expect(calc.getStitchSurcharge(15001)).toBe(10);
    });

    test('20000 stitches → $10 (large range)', () => {
        expect(calc.getStitchSurcharge(20000)).toBe(10);
    });

    test('25000 stitches → $10 (upper boundary of large)', () => {
        expect(calc.getStitchSurcharge(25000)).toBe(10);
    });

    // --- Above 25K (Full Back fallback) ---
    test('30000 stitches → $10 (capped at large tier)', () => {
        expect(calc.getStitchSurcharge(30000)).toBe(10);
    });

    test('40000 stitches → $10 (full back range)', () => {
        expect(calc.getStitchSurcharge(40000)).toBe(10);
    });

    // --- Edge cases ---
    test('0 stitches → $0', () => {
        expect(calc.getStitchSurcharge(0)).toBe(0);
    });
});
