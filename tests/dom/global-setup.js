/**
 * DOM-project globalSetup (roadmap 1.14) — runs in NODE context, where esbuild
 * works (it refuses to load inside the jsdom realm: cross-VM Uint8Array
 * invariant). Pre-bundles the ES modules the jsdom suites exercise into CJS
 * files under tests/dom/.bundles/ (gitignored); suites plain-require them so
 * window/document references resolve against the jsdom globals.
 */

const fs = require('fs');
const path = require('path');
const esbuild = require('esbuild');

const ROOT = path.join(__dirname, '../..');
const OUT = path.join(__dirname, '.bundles');

const ENTRIES = {
    'quote-builder-base.cjs': 'shared_components/js/builders/shared/quote-builder-base.js',
    'emb-adapter.cjs': 'shared_components/js/builders/emb/adapter.js',
    'scp-adapter.cjs': 'shared_components/js/builders/scp/adapter.js',
    'dtf-adapter.cjs': 'shared_components/js/builders/dtf/adapter.js',
    'dtg-adapter.cjs': 'shared_components/js/builders/dtg/adapter.js',
    'dtf-quote-builder-class.cjs': 'shared_components/js/builders/dtf/quote-builder-class.js',
    'scp-persistence.cjs': 'shared_components/js/builders/scp/persistence.js',
    'emb-persistence.cjs': 'shared_components/js/builders/emb/persistence.js',
};

module.exports = async function globalSetup() {
    fs.mkdirSync(OUT, { recursive: true });
    for (const [out, entry] of Object.entries(ENTRIES)) {
        const result = esbuild.buildSync({
            entryPoints: [path.join(ROOT, entry)],
            bundle: true,
            format: 'cjs',
            platform: 'neutral',
            mainFields: ['main'],
            target: 'es2020',
            write: false,
            logLevel: 'silent',
        });
        fs.writeFileSync(path.join(OUT, out), result.outputFiles[0].text);
    }
};
