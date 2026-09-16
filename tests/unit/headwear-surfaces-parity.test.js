/**
 * headwear-surfaces-parity.test.js — Rule 9 for cap vs garment embroidery (Erik 2026-09-16).
 *
 * Every price surface must pick cap or garment embroidery the same way, from
 * shared_components/js/headwear-classifier.js. This runs each surface's REAL decision code over
 * every live catalog row in tests/fixtures/headwear-classifier-rows.json and requires one answer:
 *   - EMB and SCP quote builders: isCapProduct() (esbuild-bundled, fed like onStyleChange)
 *   - customer product page: detectHeadwear() in product/js/product-2026.js
 *   - flat embroidery calculator: validateProductType() in calculators/js/embroidery-pricing-page.js
 *   - cap embroidery calculator and Quick Quote: the classifier result they read (source-locked)
 */
const fs = require('fs');
const path = require('path');
const esbuild = require('esbuild');
const HeadwearClassifier = require('../../shared_components/js/headwear-classifier');
const { rows } = require('../fixtures/headwear-classifier-rows.json');

const ROOT = path.join(__dirname, '..', '..');
const read = file => fs.readFileSync(path.join(ROOT, file), 'utf8').replace(/\r\n/g, '\n');
function cut(src, signature, end) {
    const start = src.indexOf(signature);
    if (start < 0) throw new Error('missing ' + signature);
    return src.slice(start, src.indexOf(end, start) + end.length);
}

// Extra live rows the fixture does not carry (captured 2026-09-16), covering Erik's rules.
const EXTRA = [
    { STYLE: 'NEA220', PRODUCT_TITLE: 'New Era Sueded Cotton Blend Full-Zip Hoodie', CATEGORY_NAME: 'Sweatshirts/Fleece', SUBCATEGORY_NAME: 'Hoodie', PRODUCT_DESCRIPTION: 'Like our baseball caps, this hoodie...' },
    { STYLE: 'FS07', PRODUCT_TITLE: 'Port Authority Fleece Neck Gaiter. FS07', CATEGORY_NAME: 'Personal Protection', SUBCATEGORY_NAME: 'Face Coverings' },
    { STYLE: 'NKFB5675', PRODUCT_TITLE: 'Nike Dri-FIT Team Performance Visor NKFB5675', CATEGORY_NAME: '', SUBCATEGORY_NAME: '' },
    { STYLE: 'BG100', PRODUCT_TITLE: 'Port Authority Xcape Mesh Backpack', CATEGORY_NAME: 'Bags', SUBCATEGORY_NAME: 'Backpacks', PRODUCT_DESCRIPTION: 'Large capacity main compartment.' },
];
const ALL = [...rows.map(r => r.row), ...EXTRA];

let emb, scp;
beforeAll(async () => {
    const built = await esbuild.build({
        stdin: {
            contents: `export { isCapProduct as emb } from './emb/product-rows.js';
                       export { isCapProduct as scp } from './scp/product-rows.js';`,
            resolveDir: path.join(ROOT, 'shared_components/js/builders'), sourcefile: 'entry.js',
        },
        bundle: true, format: 'cjs', target: 'es2020', write: false, logLevel: 'silent',
    });
    const el = () => ({ style: {}, classList: { add() {}, remove() {}, toggle() {} }, addEventListener() {} });
    const doc = { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], addEventListener() {}, createElement: el, body: el() };
    const mod = { exports: {} };
    new Function('module', 'exports', 'window', 'document', 'console', built.outputFiles[0].text)(
        mod, mod.exports,
        { document: doc, HeadwearClassifier, APP_CONFIG: { API: { BASE_URL: 'http://test' } }, addEventListener() {}, location: { search: '', hostname: 'test' } },
        doc, { log() {}, warn() {}, error() {} });
    ({ emb, scp } = mod.exports);
});

const win = { HeadwearClassifier };
const detectHeadwear = new Function('window', 'console', cut(read('product/js/product-2026.js'), 'function detectHeadwear(product, style) {', '\n    }\n') + 'return detectHeadwear;')(win, console);
const flatCalc = read('calculators/js/embroidery-pricing-page.js');
const validateProductType = new Function('window', 'showProductMismatchOverlay',
    cut(flatCalc, 'function classifyHeadwear(row) {', '\n}\n') + cut(flatCalc, 'function validateProductType(product, styleNumber) {', '\n}\n') + 'return validateProductType;')(win, () => {});

test.each(ALL.map(row => [row.STYLE, row]))('%s: every surface makes the same cap/garment call', (style, row) => {
    const expected = HeadwearClassifier.classify(row).isCap;
    const label = row.STYLE + ' - ' + row.PRODUCT_TITLE;
    const details = { subcategory: row.SUBCATEGORY_NAME || '', description: row.PRODUCT_DESCRIPTION || '' };
    const pdp = detectHeadwear({ title: row.PRODUCT_TITLE, category: row.CATEGORY_NAME, subcategory: row.SUBCATEGORY_NAME, description: row.PRODUCT_DESCRIPTION }, row.STYLE);
    expect({
        emb: emb(row.STYLE, label, row.CATEGORY_NAME || '', details),
        scp: scp(row.STYLE, label, row.CATEGORY_NAME || '', details),
        productPage: pdp.isCap,
        flatCalculatorSendsToCapPage: !validateProductType(row, row.STYLE),
    }).toEqual({ emb: expected, scp: expected, productPage: expected, flatCalculatorSendsToCapPage: expected });
});

test("Erik's rules hold on the live rows", () => {
    const kind = style => HeadwearClassifier.classify(ALL.find(r => r.STYLE === style)).kind;
    for (const style of ['CP90', 'C916', 'HT01', 'CTA207', 'WW3040', 'CT102368', 'FS07']) expect([style, kind(style)]).toEqual([style, 'flat']);
    for (const style of ['STC57', 'NKFB5675', '112FPR', 'C112']) expect([style, kind(style)]).toEqual([style, 'cap']);
    for (const style of ['NEA100', 'NEA220', 'RA7110SS', 'MM3032', '980', 'C960', 'BG100']) expect([style, kind(style)]).toEqual([style, 'garment']);
});

test('the cap calculator and Quick Quote read the same classifier result', () => {
    const capCalc = read('calculators/js/cap-embroidery-pricing-integrated-page.js');
    expect(capCalc).toContain('const headwear = classifyHeadwear(currentProduct);');
    expect(capCalc).toMatch(/if \(!headwear\.isCap\) \{/);
    expect(capCalc).not.toMatch(/ProductCategoryFilter\./);
    const qq = read('calculators/quick-quote/quick-quote.js');
    expect(qq).toContain('var headwear = classifyHeadwear(meta);');
    expect(qq).toContain('var cap = headwear.isCap;');
    expect(qq).not.toContain('matchBuilderFlat');
});
