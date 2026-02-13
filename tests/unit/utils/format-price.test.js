/**
 * formatPrice() Tests
 * Tests price display formatting — removes trailing zeros for whole numbers
 */
const { formatPrice } = require('../../../shared_components/js/quote-builder-utils');

describe('formatPrice()', () => {
    test('whole number → no decimal', () => {
        expect(formatPrice(39)).toBe('39');
    });

    test('whole .00 → no decimal', () => {
        expect(formatPrice(39.00)).toBe('39');
    });

    test('half dollar → 2 decimals', () => {
        expect(formatPrice(39.50)).toBe('39.50');
    });

    test('cents → 2 decimals', () => {
        expect(formatPrice(39.99)).toBe('39.99');
    });

    test('zero → "0"', () => {
        expect(formatPrice(0)).toBe('0');
    });

    test('small value → "0.50"', () => {
        expect(formatPrice(0.50)).toBe('0.50');
    });

    test('one cent → "0.01"', () => {
        expect(formatPrice(0.01)).toBe('0.01');
    });

    test('large value → whole number', () => {
        expect(formatPrice(1000)).toBe('1000');
    });

    test('large value with cents → "1234.56"', () => {
        expect(formatPrice(1234.56)).toBe('1234.56');
    });
});
