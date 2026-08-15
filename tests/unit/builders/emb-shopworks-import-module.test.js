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

// The Add-Product modal and its 8 helpers were DELETED 2026-08-15 along with their
// bridges: an unknown style is now typed straight onto the line (stampManualItem in
// product-rows.js) instead of being registered in Non_SanMar_Products first. What
// remains here is the paste-from-ShopWorks import flow only.
const BRIDGED = [
    'openShopWorksImportModal',
    'closeShopWorksImportModal',
    'parseAndPreviewShopWorks',
    'confirmShopWorksImport',
    'dismissImportBanner',
    'scrollToProductRow',
];

// Batch 3.3 bridge diet (2026-07-09): exports whose window bridges were deleted —
// no classic/HTML/test consumer. Two-way lock: exported AND off the window surface.
// Emptied 2026-08-15 when showAddNonSanmarModal (its only member) was removed.
const DIET_UNBRIDGED = [];

// Regression lock for the deletion: these must NOT come back as exports. Re-adding
// a register-first path would put the friction back that this removed.
const DELETED_MODAL_API = [
    'showAddNonSanmarModal',
    'closeAddNonSanmarModal',
    'toggleNsMoreOptions',
    'validateNsModalFields',
    'onNsVendorChange',
    'onNsPricingModeChange',
    'saveNonSanmarProduct',
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

    test('the deleted Add-Product modal API stays deleted', () => {
        // Reintroducing any of these means an unknown style has to be registered in
        // Non_SanMar_Products before it can be quoted — the friction removed 2026-08-15.
        const mod = loadModule();
        const indexSrc = fs.readFileSync(
            path.join(__dirname, '../../../shared_components/js/builders/emb/index.js'),
            'utf8'
        );
        for (const name of DELETED_MODAL_API) {
            expect(mod[name]).toBeUndefined();
            expect(indexSrc).not.toContain(`window.${name}`);
        }
    });
});
