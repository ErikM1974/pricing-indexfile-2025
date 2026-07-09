/**
 * builders/emb/shopworks-import.js — extraction #3 lock (roadmap 0.4).
 *
 * DOM/flow-heavy cluster (real behavior check = browser pass + the parser's
 * own 250+ fixture tests); this lock keeps the module contract honest:
 * transpiles + evaluates (with its spr-modal/design-search imports resolved),
 * and exports exactly the bridge surface index.js re-exports.
 */

const fs = require('fs');
const path = require('path');
const esbuild = require('esbuild');

const BRIDGED = [
    'openShopWorksImportModal',
    'closeShopWorksImportModal',
    'showAddNonSanmarModal',
    'closeAddNonSanmarModal',
    'toggleNsMoreOptions',
    'validateNsModalFields',
    'saveNonSanmarProduct',
    'parseAndPreviewShopWorks',
    'confirmShopWorksImport',
    'dismissImportBanner',
    'scrollToProductRow',
];

// Batch 3.3 bridge diet (2026-07-09): these are still EXPORTED (siblings import
// them) but their window bridges were DELETED — no classic/HTML/test consumer.
// Two-way lock: they must stay exported AND stay off the window surface.
const DIET_UNBRIDGED = [
    'showAddNonSanmarModal',
];

function loadModule() {
    // bundle (not transform) — the module imports spr-modal + design-search
    const result = esbuild.buildSync({
        entryPoints: [path.join(__dirname, '../../../shared_components/js/builders/emb/shopworks-import.js')],
        bundle: true,
        format: 'cjs',
        target: 'es2020',
        write: false,
        logLevel: 'silent',
    });
    const code = result.outputFiles[0].text;
    const doc = { getElementById: () => null, querySelectorAll: () => [], addEventListener() {} };
    const moduleObj = { exports: {} };
     
    new Function('module', 'exports', 'window', 'document', 'console', code)(
        moduleObj, moduleObj.exports, { document: doc, APP_CONFIG: { API: { BASE_URL: 'http://test' } } }, doc, { log() {}, warn() {}, error() {} }
    );
    return moduleObj.exports;
}

describe('builders/emb/shopworks-import.js', () => {
    test('bundles (with inter-module imports) and exports the full bridge surface', () => {
        const mod = loadModule();
        for (const name of BRIDGED) expect(typeof mod[name]).toBe('function');
    });

    test('index.js bridges exactly the bridge surface (no drift)', () => {
        const indexSrc = fs.readFileSync(
            path.join(__dirname, '../../../shared_components/js/builders/emb/index.js'),
            'utf8'
        );
        for (const name of BRIDGED.filter((n) => !DIET_UNBRIDGED.includes(n))) expect(indexSrc).toContain(`window.${name} = ${name};`);
        for (const name of DIET_UNBRIDGED) expect(indexSrc).not.toContain(`window.${name} = ${name};`);
    });
});
