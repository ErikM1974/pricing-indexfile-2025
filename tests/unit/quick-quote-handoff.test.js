/** @jest-environment jsdom */
const { parseQuickQuoteDecoration, getQuickQuotePrefill } = require('../../shared_components/js/quote-builder-utils');
const configs = [
    { version: 1, method: 'emb', primary: { stitchCount: 11000, needsDigitizing: true, embellishmentType: 'embroidery' }, additional: [{ stitchCount: 8000 }, { stitchCount: 16000 }] },
    { version: 1, method: 'capemb', primary: { stitchCount: 12000, needsDigitizing: false, embellishmentType: '3d-puff' }, additional: [{ stitchCount: 5000 }] },
    { version: 1, method: 'dtg', location: 'LC_FB' },
    { version: 1, method: 'dtf', locations: ['center-front', 'full-back', 'left-sleeve', 'right-sleeve'] },
    { version: 1, method: 'scp', front: '', back: 'FB', frontInk: 3, backInk: 1, sleeveInkL: 2, sleeveInkR: 4, left: true, right: true, dark: false, stripes: true },
];
test.each(configs)('decoration round trip preserves %s configuration', config => {
    expect(parseQuickQuoteDecoration(JSON.stringify(config))).toEqual(config);
    expect(parseQuickQuoteDecoration(JSON.stringify({ ...config, price: 0.01 }))).toEqual(config);
});
test.each(['{', 'x'.repeat(6001), '{"version":9,"method":"emb"}', JSON.stringify({ ...configs[0], primary: { ...configs[0].primary, stitchCount: -1 } }), JSON.stringify({ ...configs[3], locations: ['left-chest', 'full-front'] }), JSON.stringify({ ...configs[4], frontInk: 50 })])('malformed decoration is rejected', raw => {
    expect(() => parseQuickQuoteDecoration(raw)).toThrow();
});
test('legacy URLs still work; malformed new decoration produces a visible error field', () => {
    history.replaceState(null, '', '/?from=quickquote&style=PC54&color=BrillOrng&sizes=S:5,2XL:2&qty=7');
    expect(getQuickQuotePrefill()).toMatchObject({ style: 'PC54', color: 'BrillOrng', sizeBreakdown: { S: 5, '2XL': 2 }, decoration: null, decorationError: '' });
    history.replaceState(null, '', location.search + '&decoration=bad');
    expect(getQuickQuotePrefill().decorationError).toBeTruthy();
});
