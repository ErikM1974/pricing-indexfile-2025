/**
 * Hardcoded-host / EmailJS-ID guard (roadmap 0.6, enforcing 0.3).
 *
 * config/ is the ONLY home for the proxy host and EmailJS credentials
 * (CLAUDE.md Rule 6). Three enforcement tiers:
 *
 *   1. CLEAN set — the quote-builder path swept in task 0.3 plus all new
 *      Phase-0 code. Zero literals allowed, ever.
 *   2. EXACT-COUNT set — files keeping exactly one sanctioned literal:
 *      server.js (the CASPIO_PROXY_BASE constant default) and
 *      quote-cart-engine.js (DEFAULT_API_BASE, the dual browser/Node
 *      injection default for the parity harness). A second literal fails.
 *   3. RATCHET — the legacy repo-wide count outside config/ may only go
 *      DOWN. When you remove literals from a legacy file, lower the
 *      baseline here in the same commit. Raising it is a build break by
 *      design.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const HOST_RE = /caspio-pricing-proxy-ab30a049961a/g;
const EMAILJS_RE = /service_jgrave3|4qSbDO-SQs19TbP80/g;

// Frozen 2026-07-07 (task 0.3 sweep complete). Only lower these.
const HOST_BASELINE = 225;
const EMAILJS_BASELINE = 69;

const SKIP_DIRS = new Set(['node_modules', '.claude', '.git', 'dist', 'tests', 'memory', 'docs', 'migrations', 'workflows']);

const CLEAN_FILES = [
    'shared_components/js/embroidery-quote-builder.js',
    'shared_components/js/screenprint-quote-builder.js',
    'shared_components/js/dtf-quote-builder.js',
    'shared_components/js/quote-builder-utils.js',
    'shared_components/js/embroidery-quote-invoice.js',
    'shared_components/js/embroidery-quote-service.js',
    'shared_components/js/dtf-quote-service.js',
    'calculators/quick-quote/quick-quote.js',
    'quote-builders/embroidery-quote-builder.html',
    'quote-builders/screenprint-quote-builder.html',
    'quote-builders/dtf-quote-builder.html',
    'config/tenant.js', // logic, not data — the literals live in app.config.js / tenants/*.json
    'lib/asset-manifest.js',
    'scripts/build.js',
];

const CLEAN_DIRS = ['shared_components/js/builders'];

const EXACT_ONE = ['server.js', 'shared_components/js/quote-cart-engine.js'];

function read(rel) {
    return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

function count(text, re) {
    return (text.match(re) || []).length;
}

function walk(dir, out = []) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.isDirectory()) {
            if (!SKIP_DIRS.has(entry.name)) walk(path.join(dir, entry.name), out);
        } else if (/\.(js|html)$/i.test(entry.name)) {
            out.push(path.join(dir, entry.name));
        }
    }
    return out;
}

describe('no hardcoded proxy host / EmailJS IDs (Rule 6)', () => {
    test.each(CLEAN_FILES)('%s is literal-free', (rel) => {
        const text = read(rel);
        expect({ file: rel, hostLiterals: count(text, HOST_RE) }).toEqual({ file: rel, hostLiterals: 0 });
        expect({ file: rel, emailjsLiterals: count(text, EMAILJS_RE) }).toEqual({ file: rel, emailjsLiterals: 0 });
    });

    test.each(CLEAN_DIRS)('%s/** is literal-free', (relDir) => {
        const dir = path.join(ROOT, relDir);
        if (!fs.existsSync(dir)) return;
        for (const f of walk(dir)) {
            const rel = path.relative(ROOT, f).split(path.sep).join('/');
            const text = fs.readFileSync(f, 'utf8');
            expect({ file: rel, hostLiterals: count(text, HOST_RE) }).toEqual({ file: rel, hostLiterals: 0 });
            expect({ file: rel, emailjsLiterals: count(text, EMAILJS_RE) }).toEqual({ file: rel, emailjsLiterals: 0 });
        }
    });

    test.each(EXACT_ONE)('%s keeps exactly ONE sanctioned host literal', (rel) => {
        expect({ file: rel, hostLiterals: count(read(rel), HOST_RE) }).toEqual({ file: rel, hostLiterals: 1 });
    });

    test('legacy literal count outside config/ only ratchets DOWN', () => {
        let host = 0;
        let emailjs = 0;
        const offenders = [];
        for (const f of walk(ROOT)) {
            const rel = path.relative(ROOT, f).split(path.sep).join('/');
            if (rel.startsWith('config/')) continue; // the allowed home
            const text = fs.readFileSync(f, 'utf8');
            const h = count(text, HOST_RE);
            const e = count(text, EMAILJS_RE);
            host += h;
            emailjs += e;
            if (h + e > 0) offenders.push(`${rel} (host ${h}, emailjs ${e})`);
        }
        const message =
            `host ${host}/${HOST_BASELINE}, emailjs ${emailjs}/${EMAILJS_BASELINE}. ` +
            'If you ADDED a literal, read it from APP_CONFIG/TENANT instead. ' +
            'If you REMOVED literals, lower the baselines in this test — same commit.';
        expect({ note: message, hostOverBaseline: host > HOST_BASELINE }).toEqual({ note: message, hostOverBaseline: false });
        expect({ note: message, emailjsOverBaseline: emailjs > EMAILJS_BASELINE }).toEqual({ note: message, emailjsOverBaseline: false });
    });
});
