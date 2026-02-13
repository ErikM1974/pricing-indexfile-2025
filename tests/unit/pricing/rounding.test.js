/**
 * Rounding Tests
 * Tests roundPrice() and roundCapPrice() — API-driven rounding methods
 *
 * Methods: HalfDollarUp (round up to nearest $0.50), CeilDollar (round up to $1.00)
 */
const { createTestCalculator } = require('../../fixtures/pricing-test-helper');

describe('roundPrice() — HalfDollarUp (default)', () => {
    let calc;

    beforeEach(() => {
        calc = createTestCalculator({ roundingMethod: 'HalfDollarUp' });
    });

    test('$39.00 → $39.00 (already on dollar)', () => {
        expect(calc.roundPrice(39.00)).toBe(39.00);
    });

    test('$39.50 → $39.50 (already on half)', () => {
        expect(calc.roundPrice(39.50)).toBe(39.50);
    });

    test('$39.05 → $39.50 (rounds up to half)', () => {
        expect(calc.roundPrice(39.05)).toBe(39.50);
    });

    test('$39.51 → $40.00 (rounds up to next dollar)', () => {
        expect(calc.roundPrice(39.51)).toBe(40.00);
    });

    test('$39.25 → $39.50 (rounds up to half)', () => {
        expect(calc.roundPrice(39.25)).toBe(39.50);
    });

    test('$39.75 → $40.00 (rounds up to next dollar)', () => {
        expect(calc.roundPrice(39.75)).toBe(40.00);
    });

    test('$39.99 → $40.00 (rounds up to next dollar)', () => {
        expect(calc.roundPrice(39.99)).toBe(40.00);
    });

    test('$40.01 → $40.50 (just above dollar)', () => {
        expect(calc.roundPrice(40.01)).toBe(40.50);
    });

    test('$0.10 → $0.50 (small value)', () => {
        expect(calc.roundPrice(0.10)).toBe(0.50);
    });

    test('$100.00 → $100.00 (exact dollar)', () => {
        expect(calc.roundPrice(100.00)).toBe(100.00);
    });

    test('NaN → null', () => {
        expect(calc.roundPrice(NaN)).toBeNull();
    });
});

describe('roundPrice() — CeilDollar', () => {
    let calc;

    beforeEach(() => {
        calc = createTestCalculator({ roundingMethod: 'CeilDollar' });
    });

    test('$39.00 → $39 (already on dollar)', () => {
        expect(calc.roundPrice(39.00)).toBe(39);
    });

    test('$39.01 → $40 (rounds up)', () => {
        expect(calc.roundPrice(39.01)).toBe(40);
    });

    test('$39.50 → $40 (half rounds up)', () => {
        expect(calc.roundPrice(39.50)).toBe(40);
    });

    test('$39.99 → $40 (rounds up)', () => {
        expect(calc.roundPrice(39.99)).toBe(40);
    });
});

describe('roundCapPrice() — HalfDollarUp (default)', () => {
    let calc;

    beforeEach(() => {
        calc = createTestCalculator({ capRoundingMethod: 'HalfDollarUp' });
    });

    test('$25.00 → $25.00 (already on dollar)', () => {
        expect(calc.roundCapPrice(25.00)).toBe(25.00);
    });

    test('$25.50 → $25.50 (already on half)', () => {
        expect(calc.roundCapPrice(25.50)).toBe(25.50);
    });

    test('$25.10 → $25.50 (rounds up to half)', () => {
        expect(calc.roundCapPrice(25.10)).toBe(25.50);
    });

    test('$25.60 → $26.00 (rounds up to dollar)', () => {
        expect(calc.roundCapPrice(25.60)).toBe(26.00);
    });

    test('NaN → null', () => {
        expect(calc.roundCapPrice(NaN)).toBeNull();
    });
});

describe('roundStitchCount()', () => {
    let calc;

    beforeEach(() => {
        calc = createTestCalculator();
    });

    test('8000 → 8000 (exact increment)', () => {
        expect(calc.roundStitchCount(8000)).toBe(8000);
    });

    test('8500 → 9000 (rounds up, standard Math.round)', () => {
        expect(calc.roundStitchCount(8500)).toBe(9000);
    });

    test('8499 → 8000 (rounds down)', () => {
        expect(calc.roundStitchCount(8499)).toBe(8000);
    });

    test('15750 → 16000 (rounds up)', () => {
        expect(calc.roundStitchCount(15750)).toBe(16000);
    });

    test('25000 → 25000 (exact)', () => {
        expect(calc.roundStitchCount(25000)).toBe(25000);
    });
});
