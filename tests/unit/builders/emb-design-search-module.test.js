/**
 * builders/emb/design-search.js — extraction #1 lock (roadmap 0.4).
 *
 * The cluster is DOM-heavy (the real behavior check is the browser pass in
 * the extraction workflow); this lock keeps the MODULE contract honest:
 *   - transpiles + evaluates with stub globals (no load-time side effects)
 *   - exports exactly the strangler-bridge surface index.js re-exports
 *     (a missing export = a broken inline handler in production)
 *   - the two accessors the monolith's customer-change/reset paths call
 *     are callable and idempotent
 */

const fs = require('fs');
const path = require('path');
const esbuild = require('esbuild');

const BRIDGED = [
    'applyDesignFromCache',
    'filterDesignSearchByTier',
    'filterDesignSearchByCompany',
    'lookupDesignNumber',
    'showDesignThumbnail',
    'openThumbnailFullSize',
    'clearDesignNumber',
    'openDesignSearchModal',
    'closeDesignSearchModal',
    'onDesignSearchInput',
    'runDesignSearch',
    'selectDesignFromSearch',
    'showMoreDesignSearchResults',
    'invalidateDesignGalleryCache',
    'resetDesignSearchState',
];

// Batch 3.3 bridge diet (2026-07-09): these are still EXPORTED (siblings import
// them) but their window bridges were DELETED — no classic/HTML/test consumer.
// Two-way lock: they must stay exported AND stay off the window surface.
const DIET_UNBRIDGED = [
    'applyDesignFromCache',
    'showDesignThumbnail',
    'invalidateDesignGalleryCache',
    'resetDesignSearchState',
];

function loadModule() {
    const result = esbuild.buildSync({
        entryPoints: [path.join(__dirname, '../../../shared_components/js/builders/emb/design-search.js')],
        bundle: true,
        format: 'cjs',
        target: 'es2020',
        write: false,
        logLevel: 'silent',
    });
    const code = result.outputFiles[0].text;
    const doc = {
        getElementById: () => null,
        querySelector: () => null,
        querySelectorAll: () => [],
        createElement: () => ({ style: {}, classList: { add() {}, remove() {} }, addEventListener() {} }),
        addEventListener: () => {},
        body: { appendChild() {}, removeChild() {} },
    };
    const win = { APP_CONFIG: { API: { BASE_URL: 'http://test' } }, document: doc };
    const moduleObj = { exports: {} };
     
    new Function('module', 'exports', 'window', 'document', 'fetch', 'console', code)(
        moduleObj, moduleObj.exports, win, doc,
        () => Promise.resolve({ ok: false, status: 503 }),
        { log() {}, warn() {}, error() {} }
    );
    return moduleObj.exports;
}

describe('builders/emb/design-search.js', () => {
    test('loads with stub globals and exports the full bridge surface', () => {
        const mod = loadModule();
        const exported = Object.keys(mod).sort();
        expect(exported).toEqual([...BRIDGED].sort());
        for (const name of BRIDGED) expect(typeof mod[name]).toBe('function');
    });

    test('index.js bridges exactly the module surface (no drift)', () => {
        const indexSrc = fs.readFileSync(
            path.join(__dirname, '../../../shared_components/js/builders/emb/index.js'),
            'utf8'
        );
        for (const name of BRIDGED.filter((n) => !DIET_UNBRIDGED.includes(n))) {
            expect(indexSrc).toContain(`window.${name} = ${name};`);
        }
        for (const name of DIET_UNBRIDGED) {
            expect(indexSrc).not.toContain(`window.${name} = ${name};`);
        }
    });

    test('reset/invalidate accessors are callable and idempotent without a DOM', () => {
        const mod = loadModule();
        expect(() => {
            mod.invalidateDesignGalleryCache();
            mod.invalidateDesignGalleryCache();
            mod.resetDesignSearchState();
            mod.resetDesignSearchState();
        }).not.toThrow();
    });
});
