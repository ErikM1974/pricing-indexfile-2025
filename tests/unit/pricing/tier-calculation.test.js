/**
 * Tier Calculation Tests
 * Tests EmbroideryPricingCalculator.getTier() — determines pricing tier from quantity
 *
 * Tiers: 1-7 (LTM), 8-23, 24-47, 48-71, 72+
 */
const { createTestCalculator } = require('../../fixtures/pricing-test-helper');

describe('getTier()', () => {
    let calc;

    beforeEach(() => {
        calc = createTestCalculator();
    });

    // --- 1-7 tier (LTM applies) ---
    test('qty 1 → tier 1-7', () => {
        expect(calc.getTier(1)).toBe('1-7');
    });

    test('qty 3 → tier 1-7', () => {
        expect(calc.getTier(3)).toBe('1-7');
    });

    test('qty 7 → tier 1-7 (upper boundary)', () => {
        expect(calc.getTier(7)).toBe('1-7');
    });

    // --- 8-23 tier ---
    test('qty 8 → tier 8-23 (LTM boundary)', () => {
        expect(calc.getTier(8)).toBe('8-23');
    });

    test('qty 15 → tier 8-23', () => {
        expect(calc.getTier(15)).toBe('8-23');
    });

    test('qty 23 → tier 8-23 (upper boundary)', () => {
        expect(calc.getTier(23)).toBe('8-23');
    });

    // --- 24-47 tier ---
    test('qty 24 → tier 24-47', () => {
        expect(calc.getTier(24)).toBe('24-47');
    });

    test('qty 35 → tier 24-47', () => {
        expect(calc.getTier(35)).toBe('24-47');
    });

    test('qty 47 → tier 24-47 (upper boundary)', () => {
        expect(calc.getTier(47)).toBe('24-47');
    });

    // --- 48-71 tier ---
    test('qty 48 → tier 48-71', () => {
        expect(calc.getTier(48)).toBe('48-71');
    });

    test('qty 60 → tier 48-71', () => {
        expect(calc.getTier(60)).toBe('48-71');
    });

    test('qty 71 → tier 48-71 (upper boundary)', () => {
        expect(calc.getTier(71)).toBe('48-71');
    });

    // --- 72+ tier ---
    test('qty 72 → tier 72+', () => {
        expect(calc.getTier(72)).toBe('72+');
    });

    test('qty 100 → tier 72+', () => {
        expect(calc.getTier(100)).toBe('72+');
    });

    test('qty 500 → tier 72+ (large order)', () => {
        expect(calc.getTier(500)).toBe('72+');
    });

    // --- Edge cases ---
    test('qty 0 → tier 1-7 (edge: zero)', () => {
        expect(calc.getTier(0)).toBe('1-7');
    });

    test('qty -1 → tier 1-7 (edge: negative)', () => {
        expect(calc.getTier(-1)).toBe('1-7');
    });
});

describe('getTier() — tier has correct LTM flag', () => {
    let calc;

    beforeEach(() => {
        calc = createTestCalculator();
    });

    test('tier 1-7 has LTM', () => {
        expect(calc.tiers['1-7'].hasLTM).toBe(true);
    });

    test('tier 8-23 has no LTM', () => {
        expect(calc.tiers['8-23'].hasLTM).toBe(false);
    });

    test('tiers 24-47, 48-71, 72+ have no LTM', () => {
        expect(calc.tiers['24-47'].hasLTM).toBe(false);
        expect(calc.tiers['48-71'].hasLTM).toBe(false);
        expect(calc.tiers['72+'].hasLTM).toBe(false);
    });
});
