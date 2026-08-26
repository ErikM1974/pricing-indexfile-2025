/**
 * express-eligibility.test.js — lock for the buy-online bridge's eligibility
 * module (shared_components/js/express-eligibility.js, 2026-08-25).
 *
 * Locks the rules that keep a badge from lying:
 *  - eligibility parses ONLY the storefronts' own whitelist payload shapes;
 *  - caps win when a style is in both lists (headwear prices as caps);
 *  - color rides only on the tees deep link (custom-caps has no color param);
 *  - an unknown style gets NO link — never a guessed one.
 */
const { _parseLists, _linkFor } = require('../../shared_components/js/express-eligibility.js');

const TEES_JSON = { success: true, records: [{ style: 'PC54' }, { style: 'pc61' }, { style: 'PC54' }, { notStyle: true }] };
const CAPS_JSON = { data: [{ style: '112' }, { style: 'C402' }, {}] };

describe('parseLists', () => {
    test('normalizes to uppercase, dedupes, drops style-less rows', () => {
        const lists = _parseLists(TEES_JSON, CAPS_JSON);
        expect(lists.tees).toEqual(['PC54', 'PC61']);
        expect(lists.caps).toEqual(['112', 'C402']);
    });

    test('null / malformed payloads resolve to empty lists, never throw', () => {
        expect(_parseLists(null, null)).toEqual({ tees: [], caps: [] });
        expect(_parseLists({ records: 'nope' }, [])).toEqual({ tees: [], caps: [] });
    });
});

describe('linkFor', () => {
    const lists = _parseLists(TEES_JSON, CAPS_JSON);

    test('tees style links to /custom-tees with the chosen color', () => {
        const l = _linkFor(lists, 'pc54', 'Jet Black');
        expect(l.kind).toBe('tees');
        expect(l.url).toBe('/custom-tees?style=PC54&color=Jet%20Black');
    });

    test('caps style links to /custom-caps without a color param', () => {
        const l = _linkFor(lists, '112', 'Black');
        expect(l.kind).toBe('caps');
        expect(l.url).toBe('/custom-caps?style=112');
    });

    test('ineligible or blank style -> null (no badge, never a guess)', () => {
        expect(_linkFor(lists, 'CT103828', null)).toBeNull();
        expect(_linkFor(lists, '', null)).toBeNull();
    });
});
