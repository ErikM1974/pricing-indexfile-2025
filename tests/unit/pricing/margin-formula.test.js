/**
 * Margin Formula Tests
 * Tests the core pricing formula: (baseCost / marginDenominator) + embCost → roundPrice()
 *
 * Formula: garmentCost = basePrice / 0.57
 *          baseDecoratedPrice = garmentCost + embCost
 *          roundedBase = roundPrice(baseDecoratedPrice)  ← round ONCE
 *          finalPrice = roundedBase + stitchSurcharge    ← added AFTER rounding
 *
 * This tests the formula components individually since calculateProductPrice() is async (needs API).
 */
const { createTestCalculator } = require('../../fixtures/pricing-test-helper');

describe('Margin formula components', () => {
    let calc;

    beforeEach(() => {
        calc = createTestCalculator({ roundingMethod: 'HalfDollarUp' });
    });

    // --- garmentCost = baseCost / 0.57 ---
    describe('garmentCost = baseCost / 0.57', () => {
        test('$4.67 / 0.57 = $8.19', () => {
            expect(+(4.67 / calc.marginDenominator).toFixed(2)).toBe(8.19);
        });

        test('$8.00 / 0.57 = $14.04', () => {
            expect(+(8.00 / calc.marginDenominator).toFixed(2)).toBe(14.04);
        });

        test('$12.00 / 0.57 = $21.05', () => {
            expect(+(12.00 / calc.marginDenominator).toFixed(2)).toBe(21.05);
        });

        test('$18.00 / 0.57 = $31.58', () => {
            expect(+(18.00 / calc.marginDenominator).toFixed(2)).toBe(31.58);
        });

        test('$0.00 / 0.57 = $0.00', () => {
            expect(0 / calc.marginDenominator).toBe(0);
        });
    });

    // --- baseDecoratedPrice = garmentCost + embCost ---
    describe('baseDecoratedPrice = garmentCost + embCost', () => {
        test('$21.05 + $18.00 (1-7 tier) = $39.05', () => {
            const garmentCost = 12.00 / calc.marginDenominator;
            const embCost = calc.getEmbroideryCost('1-7');
            expect(+(garmentCost + embCost).toFixed(2)).toBe(39.05);
        });

        test('$21.05 + $14.00 (24-47 tier) = $35.05', () => {
            const garmentCost = 12.00 / calc.marginDenominator;
            const embCost = calc.getEmbroideryCost('24-47');
            expect(+(garmentCost + embCost).toFixed(2)).toBe(35.05);
        });

        test('$21.05 + $12.00 (72+ tier) = $33.05', () => {
            const garmentCost = 12.00 / calc.marginDenominator;
            const embCost = calc.getEmbroideryCost('72+');
            expect(+(garmentCost + embCost).toFixed(2)).toBe(33.05);
        });
    });

    // --- roundPrice(baseDecoratedPrice) → final base ---
    describe('roundPrice(baseDecoratedPrice) → rounded base', () => {
        test('$39.05 → $39.50 (HalfDollarUp)', () => {
            expect(calc.roundPrice(39.05)).toBe(39.50);
        });

        test('$35.05 → $35.50 (HalfDollarUp)', () => {
            expect(calc.roundPrice(35.05)).toBe(35.50);
        });

        test('$33.05 → $33.50 (HalfDollarUp)', () => {
            expect(calc.roundPrice(33.05)).toBe(33.50);
        });
    });

    // --- Full pipeline: baseCost → roundedBase + stitchSurcharge ---
    describe('Full pipeline: baseCost → sell price', () => {
        test('$12.00 garment, 1-7 tier, Standard stitches → $39.50', () => {
            const garmentCost = 12.00 / calc.marginDenominator;
            const embCost = calc.getEmbroideryCost('1-7');
            const roundedBase = calc.roundPrice(garmentCost + embCost);
            const stitchSurcharge = calc.getStitchSurcharge(8000);
            expect(roundedBase + stitchSurcharge).toBe(39.50);
        });

        test('$12.00 garment, 1-7 tier, Mid stitches (15K) → $43.50', () => {
            const garmentCost = 12.00 / calc.marginDenominator;
            const embCost = calc.getEmbroideryCost('1-7');
            const roundedBase = calc.roundPrice(garmentCost + embCost);
            const stitchSurcharge = calc.getStitchSurcharge(15000);
            expect(roundedBase + stitchSurcharge).toBe(43.50);
        });

        test('$12.00 garment, 1-7 tier, Large stitches (25K) → $49.50', () => {
            const garmentCost = 12.00 / calc.marginDenominator;
            const embCost = calc.getEmbroideryCost('1-7');
            const roundedBase = calc.roundPrice(garmentCost + embCost);
            const stitchSurcharge = calc.getStitchSurcharge(25000);
            expect(roundedBase + stitchSurcharge).toBe(49.50);
        });

        test('$12.00 garment, 72+ tier, Standard stitches → $33.50', () => {
            const garmentCost = 12.00 / calc.marginDenominator;
            const embCost = calc.getEmbroideryCost('72+');
            const roundedBase = calc.roundPrice(garmentCost + embCost);
            const stitchSurcharge = calc.getStitchSurcharge(8000);
            expect(roundedBase + stitchSurcharge).toBe(33.50);
        });

        test('$4.67 garment, 24-47 tier, Standard stitches → $22.50', () => {
            const garmentCost = 4.67 / calc.marginDenominator;
            const embCost = calc.getEmbroideryCost('24-47');
            const roundedBase = calc.roundPrice(garmentCost + embCost);
            const stitchSurcharge = calc.getStitchSurcharge(8000);
            expect(roundedBase + stitchSurcharge).toBe(22.50);
        });

        test('Size upcharge added AFTER rounding: $12 garment + $2 upcharge, 1-7 tier → $41.50', () => {
            const garmentCost = 12.00 / calc.marginDenominator;
            const embCost = calc.getEmbroideryCost('1-7');
            const roundedBase = calc.roundPrice(garmentCost + embCost);
            const sizeUpcharge = 2.00;
            // Stitch surcharge + size upcharge added AFTER rounding
            expect(roundedBase + sizeUpcharge).toBe(41.50);
        });
    });
});

describe('getEmbroideryCost()', () => {
    let calc;

    beforeEach(() => {
        calc = createTestCalculator();
    });

    test('1-7 tier → $18.00', () => {
        expect(calc.getEmbroideryCost('1-7')).toBe(18.00);
    });

    test('8-23 tier → $18.00', () => {
        expect(calc.getEmbroideryCost('8-23')).toBe(18.00);
    });

    test('24-47 tier → $14.00', () => {
        expect(calc.getEmbroideryCost('24-47')).toBe(14.00);
    });

    test('48-71 tier → $13.00', () => {
        expect(calc.getEmbroideryCost('48-71')).toBe(13.00);
    });

    test('72+ tier → $12.00', () => {
        expect(calc.getEmbroideryCost('72+')).toBe(12.00);
    });

    test('unknown tier → $12.00 (fallback)', () => {
        expect(calc.getEmbroideryCost('999+')).toBe(12.00);
    });
});

describe('getCapEmbroideryCost()', () => {
    let calc;

    beforeEach(() => {
        calc = createTestCalculator();
    });

    test('1-7 tier → $14.00', () => {
        expect(calc.getCapEmbroideryCost('1-7')).toBe(14.00);
    });

    test('72+ tier → $9.00', () => {
        expect(calc.getCapEmbroideryCost('72+')).toBe(9.00);
    });

    test('unknown tier → $9.00 (fallback)', () => {
        expect(calc.getCapEmbroideryCost('999+')).toBe(9.00);
    });
});
