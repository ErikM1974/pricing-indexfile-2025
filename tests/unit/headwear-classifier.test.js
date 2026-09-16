/**
 * headwear-classifier.test.js — cap / flat headwear / garment decisions on live catalog rows.
 * Quick Quote routes embroidery rows with this, so a wrong answer prices a cap as a shirt
 * (112FPR, 2026-09-16) or blocks it outright.
 */
const { classify } = require('../../shared_components/js/headwear-classifier');
const { rows } = require('../fixtures/headwear-classifier-rows.json');

test.each(rows.map(r => [r.row.STYLE, r.expected, r.row]))('%s is %s', (style, expected, row) => {
    const result = classify(row);
    expect(result.kind).toBe(expected);
    // A blank-category garment has no positive signal; it stays unconfident (rep choice wins).
    expect(result.confident).toBe(expected !== 'garment' || !!row.CATEGORY_NAME);
    expect(result.isCap).toBe(expected === 'cap');
    expect(result.isFlat).toBe(expected === 'flat');
});

test('Erik 2026-09-16: soft headwear is flat in any category; hoods only inside Caps; bandanas are garments', () => {
    expect(classify({ STYLE: 'C910', PRODUCT_TITLE: 'Port Authority R-Tek Stretch Fleece Headband. C910', CATEGORY_NAME: 'Accessories' })).toMatchObject({ kind: 'flat', confident: true });
    expect(classify({ STYLE: 'FS07', PRODUCT_TITLE: 'Port Authority Fleece Neck Gaiter. FS07', CATEGORY_NAME: 'Personal Protection' }).kind).toBe('flat');
    expect(classify({ STYLE: 'C960', PRODUCT_TITLE: 'Port Authority Cotton Bandana C960', CATEGORY_NAME: 'Personal Protection' }).kind).toBe('garment');
    expect(classify({ STYLE: 'CT102368', PRODUCT_TITLE: 'Carhartt Firm Duck Hood CT102368', CATEGORY_NAME: 'Caps' }).kind).toBe('flat');
    expect(classify({ STYLE: '173', PRODUCT_TITLE: 'Richardson Hood River 173', CATEGORY_NAME: '', PRODUCT_DESCRIPTION: 'Pre-curved visor.' }).kind).toBe('cap');
    expect(classify({ STYLE: 'NKFB6446', PRODUCT_TITLE: 'Nike Dri-FIT Ace Swoosh Visor', CATEGORY_NAME: '' }).kind).toBe('cap');
    expect(classify({ productName: 'Knit Beanie', category: 'Caps' }).kind).toBe('flat');
});

test('Richardson caps with a blank category are caps, Richardson apparel is not', () => {
    expect(classify({ STYLE: '112FPR', PRODUCT_TITLE: 'Richardson Five-Panel with Rope 112FPR', CATEGORY_NAME: '' }).kind).toBe('cap');
    expect(classify({ STYLE: 'RA7110SS', PRODUCT_TITLE: 'Richardson Short Sleeve Tee', CATEGORY_NAME: '', PRODUCT_DESCRIPTION: 'Soft cotton tee.' }).kind).toBe('garment');
});

test('cap shapes only count when the category is blank', () => {
    expect(classify({ PRODUCT_TITLE: 'Duck Trucker Jacket', CATEGORY_NAME: 'Outerwear' }).kind).toBe('garment');
    expect(classify({ PRODUCT_TITLE: 'Canvas Bucket Tote', CATEGORY_NAME: 'Bags' }).kind).toBe('garment');
    expect(classify({ PRODUCT_TITLE: 'Seven-Panel Trucker', CATEGORY_NAME: '' }).kind).toBe('cap');
    // No category: a garment word keeps the rep's choice instead of guessing "cap".
    expect(classify({ PRODUCT_TITLE: 'Duck Trucker Jacket', CATEGORY_NAME: '' })).toMatchObject({ kind: 'garment', confident: false });
    expect(classify({ PRODUCT_TITLE: 'Canvas Bucket Bag', CATEGORY_NAME: '', PRODUCT_DESCRIPTION: 'Adjustable backstrap.' })).toMatchObject({ kind: 'garment', confident: false });
    expect(classify({ PRODUCT_TITLE: 'Safety Cap', CATEGORY_NAME: 'Workwear' }).kind).toBe('cap');
});

test('"cap sleeve" never makes a garment a cap', () => {
    expect(classify({ PRODUCT_TITLE: "Women's Cap Sleeve Tee", CATEGORY_NAME: '' }).kind).toBe('garment');
    expect(classify({ PRODUCT_TITLE: "Women's Slim Tee", CATEGORY_NAME: '', PRODUCT_DESCRIPTION: 'Cap sleeves and a side-seamed fit.' }).kind).toBe('garment');
});

test('no signal is reported as unconfident so callers keep the rep choice', () => {
    expect(classify({ STYLE: 'BC100B', PRODUCT_TITLE: 'Infant Jersey Short Sleeve One Piece', CATEGORY_NAME: '' })).toEqual({ kind: 'garment', isCap: false, isFlat: false, confident: false, reason: 'unknown' });
    expect(classify({ STYLE: 'BC3001T', PRODUCT_TITLE: 'Toddler Jersey Short Sleeve Tee', CATEGORY_NAME: '' })).toMatchObject({ kind: 'garment', confident: false, reason: 'title' });
    expect(classify({ STYLE: '999' })).toMatchObject({ kind: 'cap', confident: false, reason: 'style' });
});

test('accepts camelCase shapes and bad input without throwing', () => {
    expect(classify({ productTitle: 'Snapback Trucker Cap', category: '' }).kind).toBe('cap');
    expect(classify({ title: 'Knit Beanie', category: '', style: 'X1' }).kind).toBe('flat');
    expect(classify(null)).toMatchObject({ kind: 'garment', confident: false });
    expect(classify('112')).toMatchObject({ kind: 'garment', confident: false });
});
