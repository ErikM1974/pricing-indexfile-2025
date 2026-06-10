/**
 * parseRatePercent — regression lock for the 2026-06-10 out-of-state tax fix.
 *
 * The falsy-zero bug: `parseFloat(input) || 10.1` coerced a legitimate 0% rate
 * (out-of-state / exempt) to 10.1%, so the screen showed $0 tax while the saved
 * session, /quote page, and ShopWorks push all charged WA tax. parseRatePercent
 * must treat 0 as VALID and fall back ONLY on NaN/empty.
 */
const { parseRatePercent } = require('../../shared_components/js/quote-builder-utils.js');

describe('parseRatePercent (falsy-zero tax fix)', () => {
    test('0 is a VALID rate — never falls back (the critical case)', () => {
        expect(parseRatePercent('0', 10.1)).toBe(0);
        expect(parseRatePercent(0, 10.1)).toBe(0);
        expect(parseRatePercent('0.0', 10.1)).toBe(0);
    });

    test('normal rates parse through', () => {
        expect(parseRatePercent('10.1', 10.1)).toBe(10.1);
        expect(parseRatePercent('8.8', 10.1)).toBe(8.8);
        expect(parseRatePercent(10.35, 10.1)).toBe(10.35);
    });

    test('empty / NaN / garbage falls back', () => {
        expect(parseRatePercent('', 10.1)).toBe(10.1);
        expect(parseRatePercent(null, 10.1)).toBe(10.1);
        expect(parseRatePercent(undefined, 10.1)).toBe(10.1);
        expect(parseRatePercent('abc', 10.1)).toBe(10.1);
        expect(parseRatePercent(NaN, 10.1)).toBe(10.1);
    });

    test('leading-numeric strings parse like parseFloat (input type=number safety)', () => {
        expect(parseRatePercent('10.1%', 10.1)).toBe(10.1);
    });
});
