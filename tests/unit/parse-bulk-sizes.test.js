/**
 * parseBulkSizes — lock for the shared bulk-size-paste parser (UX audit P1 #2,
 * 2026-07-06). Promoted from dtg-inline-form.js (C8) to quote-builder-utils.js
 * so all 4 builders parse "S:2 M:4 L:6" identically; DTG's closure alias and
 * the trio's wireBulkSizePaste() both call this exact function.
 *
 * Contract: returns {} unless the text contains size:qty tokens, so a plain
 * paste (one number, an address, a PO #) falls through to default behavior.
 */
const { parseBulkSizes } = require('../../shared_components/js/quote-builder-utils.js');

describe('parseBulkSizes (shared bulk size paste)', () => {
    test('colon-separated list (the documented format)', () => {
        expect(parseBulkSizes('S:2 M:4 L:6 2XL:1')).toEqual({ S: 2, M: 4, L: 6, '2XL': 1 });
    });

    test('slash / dash / equals separators + commas and semicolons', () => {
        expect(parseBulkSizes('S/4, M/6, L/6')).toEqual({ S: 4, M: 6, L: 6 });
        expect(parseBulkSizes('S-2; M-4; L-6')).toEqual({ S: 2, M: 4, L: 6 });
        expect(parseBulkSizes('S=1 XL=3')).toEqual({ S: 1, XL: 3 });
    });

    test('case-insensitive sizes, XXL standardizes to 2XL', () => {
        expect(parseBulkSizes('s:2 xl:3 xxl:1')).toEqual({ S: 2, XL: 3, '2XL': 1 });
    });

    test('extended sizes parse (trio reports these as skipped, DTG fills them)', () => {
        expect(parseBulkSizes('XS:1 3XL:2 4XL:3 5XL:4 6XL:5')).toEqual({
            XS: 1, '3XL': 2, '4XL': 3, '5XL': 4, '6XL': 5,
        });
    });

    test('longest-size-first matching: 2XL is not read as XL, XL not as L', () => {
        expect(parseBulkSizes('2XL:6')).toEqual({ '2XL': 6 });
        expect(parseBulkSizes('XL:6')).toEqual({ XL: 6 });
    });

    test('zero quantities are kept (paste can clear a size)', () => {
        expect(parseBulkSizes('S:0 M:12')).toEqual({ S: 0, M: 12 });
    });

    test('non-size text returns {} (plain paste falls through)', () => {
        expect(parseBulkSizes('')).toEqual({});
        expect(parseBulkSizes('12')).toEqual({});
        expect(parseBulkSizes('PO-48812')).toEqual({});
        expect(parseBulkSizes('1234 Main St - Apt 6')).toEqual({});
        expect(parseBulkSizes(null)).toEqual({});
        expect(parseBulkSizes(undefined)).toEqual({});
    });

    test('duplicate size keeps the LAST value (rep corrects mid-string)', () => {
        expect(parseBulkSizes('M:4 M:6')).toEqual({ M: 6 });
    });
});
