/**
 * builders/emb/persistence.js — extraction #4 lock (roadmap 0.4).
 *
 * The autosave/draft/edit-load/duplicate cluster (real behavior check =
 * browser pass; the save-parity suites lock the payload math elsewhere).
 * This lock keeps the module contract honest: bundles with its
 * design-search import and exports exactly the bridge surface.
 */

const fs = require('fs');
const path = require('path');
const esbuild = require('esbuild');

const BRIDGED = [
    'initEmbroideryPersistence',
    'getEmbroideryQuoteData',
    'restoreEmbroideryDraft',
    'markEmbroideryDirty',
    'loadQuoteForEditing',
    'duplicateQuote',
    'addProductFromQuote',
];

function loadModule() {
    const result = esbuild.buildSync({
        entryPoints: [path.join(__dirname, '../../../shared_components/js/builders/emb/persistence.js')],
        bundle: true,
        format: 'cjs',
        target: 'es2020',
        write: false,
        logLevel: 'silent',
    });
    const code = result.outputFiles[0].text;
    const doc = { getElementById: () => null, querySelectorAll: () => [], addEventListener() {} };
    const moduleObj = { exports: {} };
    // eslint-disable-next-line no-new-func
    new Function('module', 'exports', 'window', 'document', 'console', code)(
        moduleObj, moduleObj.exports, { document: doc }, doc, { log() {}, warn() {}, error() {} }
    );
    return moduleObj.exports;
}

describe('builders/emb/persistence.js', () => {
    test('bundles (with design-search import) and exports the full bridge surface', () => {
        const mod = loadModule();
        for (const name of BRIDGED) expect(typeof mod[name]).toBe('function');
    });

    test('index.js bridges exactly the bridge surface (no drift)', () => {
        const indexSrc = fs.readFileSync(
            path.join(__dirname, '../../../shared_components/js/builders/emb/index.js'),
            'utf8'
        );
        for (const name of BRIDGED) expect(indexSrc).toContain(`window.${name} = ${name};`);
    });
});
