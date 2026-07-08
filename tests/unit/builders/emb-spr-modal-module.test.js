/**
 * builders/emb/spr-modal.js — extraction #2 lock (roadmap 0.4).
 *
 * DOM-heavy modal (real behavior check = browser pass); this lock keeps the
 * module contract honest: loads with stub globals, exports exactly the
 * bridge surface index.js re-exports (a missing export = a dead handler in
 * the modal's GENERATED product/service tables), and the empty-input
 * fast-path resolves without touching the DOM.
 */

const fs = require('fs');
const path = require('path');
const esbuild = require('esbuild');

const BRIDGED = [
    'showServicePricingReview',
    'onSprProductSourceChange',
    'onSprCustomProductFocus',
    'onSprSourceChange',
    'onSprCustomServiceFocus',
    'onSprGarmentPositionChange',
    'onSprGarmentStitchTierChange',
    'onSprCapEmbellishmentChange',
    'onSprStitchChange',
    'cancelServicePricingReview',
    'applyServicePricingReview',
    'getSprEmbConfigOptions',
];

function loadModule() {
    const result = esbuild.buildSync({
        entryPoints: [path.join(__dirname, '../../../shared_components/js/builders/emb/spr-modal.js')],
        bundle: true,
        format: 'cjs',
        target: 'es2020',
        write: false,
        logLevel: 'silent',
    });
    const code = result.outputFiles[0].text;
    const doc = { getElementById: () => null, querySelectorAll: () => [], addEventListener() {}, body: { appendChild() {} } };
    const moduleObj = { exports: {} };
    // eslint-disable-next-line no-new-func
    new Function('module', 'exports', 'window', 'document', 'console', code)(
        moduleObj, moduleObj.exports, { document: doc, APP_CONFIG: { API: { BASE_URL: 'http://test' } } }, doc, { log() {}, warn() {}, error() {} }
    );
    return moduleObj.exports;
}

describe('builders/emb/spr-modal.js', () => {
    test('loads with stub globals and exports the full bridge surface', () => {
        const mod = loadModule();
        expect(Object.keys(mod).sort()).toEqual([...BRIDGED].sort());
    });

    test('index.js bridges exactly the module surface (no drift)', () => {
        const indexSrc = fs.readFileSync(
            path.join(__dirname, '../../../shared_components/js/builders/emb/index.js'),
            'utf8'
        );
        for (const name of BRIDGED) expect(indexSrc).toContain(`window.${name} = ${name};`);
    });

    test('empty input fast-path resolves {services:[], products:[], embConfig:null} without DOM', async () => {
        const mod = loadModule();
        await expect(mod.showServicePricingReview([], [], null)).resolves.toEqual({
            services: [],
            products: [],
            embConfig: null,
        });
        expect(mod.getSprEmbConfigOptions()).toBeNull();
    });
});
