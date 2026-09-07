/**
 * ShopWorks import → the builder's state (2026-09-07, Erik: "fix the bug for the quote to ShopWorks import").
 *
 * The 2026-08-16 rewrite decided how an imported FULL BACK and CAP logo land in `embState`, and the rule that
 * decides whether one decoration is billed ONCE or TWICE (`_applyImportedFullBack`) had no test at all. Nor did
 * the cap write (`_applyImportedCapLogo`) or the service-only fallbacks that keep the charge on an order with no
 * products. This runs the real module (esbuild-bundled with `state.js` shared) with `createServiceProductRow`
 * replaced by a spy, and locks all four primary/fee-line combinations plus the fallbacks.
 */
const path = require('path');
const esbuild = require('esbuild');

const EMB = path.join(__dirname, '../../../shared_components/js/builders/emb');
let mod;
let svcRows;
let notes;

beforeAll(async () => {
    // Stub ONLY createServiceProductRow (it builds DOM rows); everything else in product-rows.js stays real.
    const stubProductRows = {
        name: 'stub-product-rows',
        setup(build) {
            build.onResolve({ filter: /^\.\/product-rows\.js$/ }, (args) => (path.basename(args.importer) === 'shopworks-import.js' ? { path: 'stub:product-rows', namespace: 'stub' } : null));
            build.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({
                resolveDir: EMB,
                contents: `export * from '${path.join(EMB, 'product-rows.js').replace(/\\/g, '/')}';
                           export function createServiceProductRow(serviceType, data) { globalThis.__svcRows.push({ serviceType, data }); return 'svc-row'; }`,
            }));
        },
    };
    const result = await esbuild.build({
        stdin: {
            contents: `export * from './shopworks-import.js'; export { embState } from './state.js';`,
            resolveDir: EMB, sourcefile: 'entry.js',
        },
        bundle: true, format: 'cjs', target: 'es2020', write: false, logLevel: 'silent', plugins: [stubProductRows],
    });
    notes = { value: '' };
    const el = () => ({ checked: false, classList: { add() {}, remove() {}, toggle() {} }, style: {}, textContent: '' });
    const doc = {
        getElementById: (id) => (id === 'notes' ? notes : el()),
        querySelector: () => null, querySelectorAll: () => [], addEventListener() {}, createElement: () => el(), body: el(),
    };
    const moduleObj = { exports: {} };
    globalThis.__svcRows = [];
    new Function('module', 'exports', 'window', 'document', 'console', result.outputFiles[0].text)(
        moduleObj, moduleObj.exports,
        { document: doc, APP_CONFIG: { API: { BASE_URL: 'http://test' } }, addEventListener() {} },
        doc, { log() {}, warn() {}, error() {} }
    );
    mod = moduleObj.exports;
});

beforeEach(() => {
    svcRows = globalThis.__svcRows = [];
    notes.value = '';
    const s = mod.embState;
    s.primaryLogo = { position: 'Left Chest', stitchCount: 8000, needsDigitizing: false, isPrimary: true };
    s.globalAL = {
        garment: { enabled: false, position: 'AL', stitchCount: 8000, needsDigitizing: false },
        cap: { enabled: false, position: 'AL-Cap', stitchCount: 5000, needsDigitizing: false },
    };
    s.additionalLogos = []; s.capAdditionalLogos = [];
});

const withProducts = { products: [{ style: 'PC61' }], customProducts: [] };
const noProducts = { products: [], customProducts: [] };
const progress = () => ({ step: 0, total: 5 });
const fbResult = (over = {}) => ({ type: 'FB', quantity: 24, stitchCount: 30000, unitPrice: 32.5, position: 'Full Back', ...over });
const cbResult = (over = {}) => ({ type: 'CB', quantity: 24, stitchCount: 5000, unitPrice: 9, position: 'Cap Back', ...over });

describe('one full back per order — the primary wins', () => {
    test('primary already Full Back + FB fee line → NOT a second charge, note says charged once', () => {
        mod.embState.primaryLogo.position = 'Full Back';
        mod.embState.primaryLogo.stitchCount = 30000;
        mod._applyImportedFullBack(fbResult());
        expect(mod.embState.globalAL.garment.enabled).toBe(false);
        expect(mod.embState.additionalLogos).toEqual([]);
        expect(notes.value).toMatch(/matched the primary logo — charged once/);
        expect(svcRows).toEqual([]);
    });

    test('primary Left Chest + FB fee line → a real Full Back additional logo on the ladder (both priced)', () => {
        mod._applyImportedFullBack(fbResult({ stitchCount: 30000 }));
        const g = mod.embState.globalAL.garment;
        expect(g.enabled).toBe(true);
        expect(g.position).toBe('Full Back'); // load-bearing: the engine takes the ladder branch only on this string
        expect(g.stitchCount).toBe(30000);
        expect(mod.embState.additionalLogos).toHaveLength(1);
        expect(mod.embState.additionalLogos[0]).toMatchObject({ position: 'Full Back', stitchCount: 30000, isPrimary: false });
        expect(mod.embState.primaryLogo.position).toBe('Left Chest'); // the primary is untouched
        expect(notes.value).toMatch(/imported as an additional logo/);
    });

    test('a fee line under the ladder minimum is floored at 25,000 stitches; digitizing carries over', () => {
        mod._applyImportedFullBack(fbResult({ stitchCount: 12000, originalData: { needsDigitizing: true } }));
        expect(mod.embState.globalAL.garment.stitchCount).toBe(25000);
        expect(mod.embState.globalAL.garment.needsDigitizing).toBe(true);
    });

    test('through applyServiceResults: with products the state path runs, with none the DECG-FB service row keeps the charge', () => {
        mod.applyServiceResults([fbResult()], withProducts, progress());
        expect(mod.embState.globalAL.garment.position).toBe('Full Back');
        expect(svcRows).toEqual([]);

        mod.embState.globalAL.garment = { enabled: false, position: 'AL', stitchCount: 8000, needsDigitizing: false };
        mod.applyServiceResults([fbResult({ quantity: 12, unitPrice: 40 })], noProducts, progress());
        expect(mod.embState.globalAL.garment.enabled).toBe(false);
        expect(svcRows).toEqual([{ serviceType: 'DECG-FB', data: { quantity: 12, stitchCount: 30000, unitPrice: 40, total: 480, isCap: false, position: 'Full Back' } }]);
    });
});

describe('a cap logo lands on the CAP side, never the garment side', () => {
    test('CB with products → globalAL.cap enabled at the cap base, garment side untouched, capAdditionalLogos synced', () => {
        mod.applyServiceResults([cbResult({ originalData: { needsDigitizing: true, additionalLogos: [{ position: 'Cap Back' }, { position: 'Cap Side' }] } })], withProducts, progress());
        const c = mod.embState.globalAL.cap;
        expect(c).toMatchObject({ enabled: true, position: 'AL-Cap', stitchCount: 5000, needsDigitizing: true });
        expect(mod.embState.globalAL.garment.enabled).toBe(false);
        expect(mod.embState.capAdditionalLogos).toHaveLength(1);
        expect(mod.embState.additionalLogos).toEqual([]);
        expect(notes.value).toMatch(/Cap logo positions: Cap Back, Cap Side/);
    });

    test('CS is a cap logo too; with no products the AL-CAP service row keeps the charge', () => {
        mod.applyServiceResults([cbResult({ type: 'CS', position: 'Cap Side', quantity: 6, unitPrice: 8 })], noProducts, progress());
        expect(mod.embState.globalAL.cap.enabled).toBe(false);
        expect(svcRows).toEqual([{ serviceType: 'AL-CAP', data: { quantity: 6, stitchCount: 5000, unitPrice: 8, total: 48, isCap: true, position: 'Cap Side' } }]);
    });
});

describe('a plain additional logo stays a plain AL', () => {
    test('AL with products → position AL (not Full Back), no service row; without products → AL service row', () => {
        mod.applyServiceResults([{ type: 'AL', quantity: 24, stitchCount: 8000, unitPrice: 8 }], withProducts, progress());
        expect(mod.embState.globalAL.garment).toMatchObject({ enabled: true, position: 'AL', stitchCount: 8000 });
        expect(svcRows).toEqual([]);
        mod.applyServiceResults([{ type: 'AL', quantity: 24, stitchCount: 8000, unitPrice: 8 }], noProducts, progress());
        expect(svcRows).toEqual([{ serviceType: 'AL', data: { quantity: 24, unitPrice: 8, total: 192, isCap: false, position: 'Additional Location' } }]);
    });

    test('a mixed order: Left Chest primary + FB line + CB line → garment Full Back AND cap AL, each on its own side', () => {
        mod.applyServiceResults([fbResult(), cbResult()], withProducts, progress());
        expect(mod.embState.globalAL.garment).toMatchObject({ enabled: true, position: 'Full Back', stitchCount: 30000 });
        expect(mod.embState.globalAL.cap).toMatchObject({ enabled: true, position: 'AL-Cap', stitchCount: 5000 });
        expect(mod.embState.additionalLogos).toHaveLength(1);
        expect(mod.embState.capAdditionalLogos).toHaveLength(1);
    });
});
