/**
 * Tax Calculation Tests
 * Tests the rounding rule: Math.round((subtotal + shipping) * rate * 100) / 100
 *
 * Rules:
 * - WA sales tax: rate > 0 (typically 10.1%)
 * - Out-of-state: rate = 0, display "$0.00"
 * - Shipping is taxable in WA
 * - Round each component BEFORE summing into total
 * - Use Math.round() not Math.ceil() for tax
 */

describe('Tax calculation: Math.round((subtotal + shipping) * rate * 100) / 100', () => {

    function calculateTax(subtotal, shipping, rate) {
        return Math.round((subtotal + shipping) * rate * 100) / 100;
    }

    // --- Standard WA rate (10.1%) ---
    test('$100 + $10 shipping @ 10.1% = $11.11', () => {
        expect(calculateTax(100, 10, 0.101)).toBe(11.11);
    });

    test('$100 + $0 shipping @ 10.1% = $10.10', () => {
        expect(calculateTax(100, 0, 0.101)).toBe(10.10);
    });

    test('$500 + $0 shipping @ 10.1% = $50.50', () => {
        expect(calculateTax(500, 0, 0.101)).toBe(50.50);
    });

    test('$1000 + $25 shipping @ 10.1% = $103.53', () => {
        expect(calculateTax(1000, 25, 0.101)).toBe(103.53);
    });

    // --- Tacoma rate (8.1%) ---
    test('$500.49 + $12.99 @ 8.1% = $41.59', () => {
        expect(calculateTax(500.49, 12.99, 0.081)).toBe(41.59);
    });

    // --- Seattle rate (10.25%) ---
    test('$250 + $15 @ 10.25% = $27.16', () => {
        expect(calculateTax(250, 15, 0.1025)).toBe(27.16);
    });

    // --- Out-of-state: 0% ---
    test('$1234.56 + $0 @ 0% = $0.00', () => {
        expect(calculateTax(1234.56, 0, 0)).toBe(0.00);
    });

    test('$500 + $18.99 @ 0% = $0.00', () => {
        expect(calculateTax(500, 18.99, 0)).toBe(0.00);
    });

    // --- Edge cases ---
    test('$0.01 + $0 @ 10.1% = $0.00 (rounds to 0)', () => {
        expect(calculateTax(0.01, 0, 0.101)).toBe(0.00);
    });

    test('$0.05 + $0 @ 10.1% = $0.01 (tiny but nonzero)', () => {
        expect(calculateTax(0.05, 0, 0.101)).toBe(0.01);
    });

    test('$999.99 + $99.99 @ 10.1% = $111.10', () => {
        expect(calculateTax(999.99, 99.99, 0.101)).toBe(111.10);
    });

    test('$5000 + $50 @ 10.1% = $510.05', () => {
        expect(calculateTax(5000, 50, 0.101)).toBe(510.05);
    });
});

describe('Grand total = subtotal + shipping + tax', () => {

    function calculateTotal(subtotal, shipping, rate) {
        const tax = Math.round((subtotal + shipping) * rate * 100) / 100;
        return +(subtotal + shipping + tax).toFixed(2);
    }

    test('$100 + $10 shipping + $11.11 tax = $121.11', () => {
        expect(calculateTotal(100, 10, 0.101)).toBe(121.11);
    });

    test('$500 + $0 shipping + $0 tax (out-of-state) = $500.00', () => {
        expect(calculateTotal(500, 0, 0)).toBe(500.00);
    });

    test('$1000 + $25 shipping + $103.53 tax = $1128.53', () => {
        expect(calculateTotal(1000, 25, 0.101)).toBe(1128.53);
    });

    test('Shipping is taxable: $100 + $20 shipping → tax on $120, not $100', () => {
        const taxWithShipping = Math.round(120 * 0.101 * 100) / 100;
        const taxWithoutShipping = Math.round(100 * 0.101 * 100) / 100;
        expect(taxWithShipping).toBe(12.12);
        expect(taxWithoutShipping).toBe(10.10);
        expect(taxWithShipping).toBeGreaterThan(taxWithoutShipping);
    });
});

describe('Nullish coalescing for tax rate', () => {
    test('rate 0 should NOT fallback to 0.101 (falsy-zero bug)', () => {
        const rate = 0;
        // WRONG: rate || 0.101 → treats 0 as falsy → returns 0.101
        const wrongRate = rate || 0.101;
        // CORRECT: rate ?? 0.101 → only null/undefined trigger fallback
        const correctRate = rate ?? 0.101;

        expect(wrongRate).toBe(0.101);  // Bug behavior
        expect(correctRate).toBe(0);     // Correct behavior
    });

    test('rate null SHOULD fallback to 0.101', () => {
        const rate = null;
        expect(rate ?? 0.101).toBe(0.101);
    });

    test('rate undefined SHOULD fallback to 0.101', () => {
        const rate = undefined;
        expect(rate ?? 0.101).toBe(0.101);
    });
});
