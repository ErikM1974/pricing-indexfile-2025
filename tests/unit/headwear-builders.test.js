/**
 * Cap vs garment in the quote builders = the shared headwear rule (Erik 2026-09-16).
 *
 * Every price surface decides cap vs garment embroidery with ONE rule,
 * shared_components/js/headwear-classifier.js. The EMB and SCP builders each carry an
 * isCapProduct() (Rule 8 twins); this runs the REAL functions (esbuild-bundled from the
 * modules) over every live catalog row in the classifier fixture, fed exactly the way
 * onStyleChange feeds them — the stylesearch label "STYLE - TITLE", CATEGORY_NAME, and the
 * SUBCATEGORY_NAME / PRODUCT_DESCRIPTION /api/product-colors carries — and requires the
 * same answer as HeadwearClassifier.classify(row).isCap.
 */
const path = require('path');
const esbuild = require('esbuild');

// Sets globalThis.HeadwearClassifier (the page loads it before the builder bundle).
const HeadwearClassifier = require('../../shared_components/js/headwear-classifier');
const { rows } = require('../fixtures/headwear-classifier-rows.json');

const BUILDERS = path.join(__dirname, '../../shared_components/js/builders');
let builders;

beforeAll(async () => {
    const result = await esbuild.build({
        stdin: {
            contents: `export { isCapProduct as embIsCapProduct } from './emb/product-rows.js';
                       export { isCapProduct as scpIsCapProduct } from './scp/product-rows.js';`,
            resolveDir: BUILDERS, sourcefile: 'entry.js',
        },
        bundle: true, format: 'cjs', target: 'es2020', write: false, logLevel: 'silent',
    });
    const el = () => ({ style: {}, classList: { add() {}, remove() {}, toggle() {} }, addEventListener() {} });
    const doc = { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], addEventListener() {}, createElement: el, body: el() };
    const moduleObj = { exports: {} };
    new Function('module', 'exports', 'window', 'document', 'console', result.outputFiles[0].text)(
        moduleObj, moduleObj.exports,
        { document: doc, APP_CONFIG: { API: { BASE_URL: 'http://test' } }, addEventListener() {}, location: { search: '', hostname: 'test' } },
        doc, { log() {}, warn() {}, error() {} }
    );
    builders = moduleObj.exports;
}, 30000);   // esbuild bundling can outlast jest's 5 s default on a busy machine

const builderInputs = (row) => [
    row.STYLE,
    `${row.STYLE} - ${row.PRODUCT_TITLE}`,
    row.CATEGORY_NAME || '',
    { subcategory: row.SUBCATEGORY_NAME || '', description: row.PRODUCT_DESCRIPTION || '' },
];

describe.each([
    ['EMB', () => builders.embIsCapProduct],
    ['SCP', () => builders.scpIsCapProduct],
])('%s isCapProduct follows the shared headwear rule', (_name, fn) => {
    test.each(rows.map(r => [r.row.STYLE, r.expected, r.row]))('%s (%s)', (_style, expected, row) => {
        const isCap = fn()(...builderInputs(row));
        expect(isCap).toBe(HeadwearClassifier.classify(row).isCap);
        // Pricing contract: only a cap takes cap pricing — flat headwear prices as a garment.
        expect(isCap).toBe(expected === 'cap');
    });

    test('ShopWorks service descriptions never make a garment a cap', () => {
        expect(fn()('PC54', 'Di. Embroider Cap - T-shirt')).toBe(false);
        expect(fn()('112', 'Di. Embroider Garment - Richardson Trucker Cap')).toBe(true);
    });

    test('flat headwear is never a cap, whatever the category; visors are', () => {
        expect(fn()('CP90', 'CP90 - Port Authority Knit Cap. CP90', 'Caps', { subcategory: 'Fleece/Beanies' })).toBe(false);
        expect(fn()('C916', 'C916 - Port Authority Two-Color Fleece Headband. C916', 'Caps')).toBe(false);
        expect(fn()('X1', 'X1 - Fleece Neck Gaiter', 'Personal Protection')).toBe(false);
        expect(fn()('STC57', 'STC57 - Sport-Tek Repeat Visor STC57', '')).toBe(true);
        // The old keyword rules called these caps; they are garments.
        expect(fn()('NEA100', 'NEA100 - New Era Heritage Blend Crew Tee. NEA100', 'T-Shirts')).toBe(false);
        expect(fn()('MM3032', 'MM3032 - Mercer+Mettle Capital Tech Blazer MM3032', '')).toBe(false);
    });

    test('the description is read when the category is blank (Richardson 112WH)', () => {
        const row = rows.find(r => r.row.STYLE === '112WH').row;
        expect(fn()(row.STYLE, `${row.STYLE} - ${row.PRODUCT_TITLE}`, '')).toBe(false);
        expect(fn()(...builderInputs(row))).toBe(true);
    });

    test('a missing classifier is a visible error, never the old keyword guess (Rule 4)', () => {
        const saved = globalThis.HeadwearClassifier;
        const toasts = [];
        globalThis.showToast = (message, type) => toasts.push([message, type]);
        delete globalThis.HeadwearClassifier;
        try {
            expect(() => fn()('C112', 'C112 - Port Authority Snapback Trucker Cap', 'Caps')).toThrow(/cap\/garment check did not load/);
            expect(toasts).toEqual([[expect.stringMatching(/cap\/garment check did not load/), 'error']]);
        } finally {
            globalThis.HeadwearClassifier = saved;
            delete globalThis.showToast;
        }
    });
});

test('the builder pages load the classifier before the builder code', () => {
    const fs = require('fs');
    const root = path.join(__dirname, '../..');
    const tag = '/shared_components/js/headwear-classifier.js?v='; // /deploy moves the version
    for (const [page, consumer] of [
        ['embroidery-quote-builder.html', '/shared_components/js/builders/emb/index.js'],
        ['screenprint-quote-builder.html', '/shared_components/js/builders/scp/index.js'],
        ['dtf-quote-builder.html', '/shared_components/js/dtf-quote-products.js'],
    ]) {
        const html = fs.readFileSync(path.join(root, 'quote-builders', page), 'utf8');
        expect([page, html.indexOf(tag)]).not.toEqual([page, -1]);
        expect([page, html.indexOf(tag) < html.indexOf(consumer)]).toEqual([page, true]);
    }
    // No builder decides cap vs garment with the old keyword filter any more.
    for (const file of ['builders/emb/product-rows.js', 'builders/scp/product-rows.js', 'dtf-quote-products.js']) {
        const src = fs.readFileSync(path.join(root, 'shared_components/js', file), 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, '');
        expect([file, /ProductCategoryFilter\./.test(src)]).toEqual([file, false]);
    }
});
