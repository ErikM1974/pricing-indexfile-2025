/**
 * Repo-wide hygiene lock (2026-09-06, the final census after the staff / customer / calculator / builder sweeps).
 *
 *   1. EVERY served HTML page in the repo is Rule-3 clean: no <style> block, no inline <script> with content,
 *      no inline event handlers, no bare Font Awesome icon (aria-hidden or aria-label), every local .css/.js
 *      versioned (?v=) — the per-area locks cover their own lists; this one catches a NEW page anywhere.
 *   2. No orphan browser script: every JS file outside the Node-side dirs is referenced by name from at least
 *      one page, script, server.js or the build. The 2026-09-06 census found 35 unreferenced scripts (the
 *      oldest untouched since 2025-06); a script nobody loads is dead weight that still gets "fixed" in sweeps.
 *   3. The 69 files the census verified dead (deleted 2026-09-06 on Erik's instruction) stay deleted.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const ROOT = path.join(__dirname, '..', '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const exists = (rel) => fs.existsSync(path.join(ROOT, rel));
const tracked = execSync('git ls-files', { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).split(/\r?\n/).filter(Boolean).map((f) => f.replace(/\\/g, '/'));

// Dead files verified by the 2026-09-06 census (zero references from any page, script, route or build) were
// removed on Erik's instruction the same day (69 files — `memory/DEAD_FILES_2026-09-06.md`). This list is the
// record of what must stay gone: a file here that reappears fails the lock below. Add to it only with the same
// evidence (a referrer census), never to park a file you merely suspect is dead.
const DELETED_2026_09_06 = [
    'shared_components/js/header-button-functions.js', 'shared_components/js/enhanced-loading-animations.js', 'shared_components/js/dtg-product-recommendations.js',
    'shared_components/js/dtg-integration.js', 'training/training-engine-base.js', 'calculators/leatherette-patch-quote-service.js', 'calculators/webstores-quote-service.js',
    'calculators/webstores-fundraiser.js', 'calculators/webstores-calculator.js', 'richardson-caps/scripts/richardson-combination-caps-manual.js', 'shared_components/js/edp-generator-service.js',
    'shared_components/js/color-picker-component.js', 'shared_components/js/cap-embroidery-pricing-logic.js', 'shared_components/js/embroidery-customization-options.js',
    'shared_components/js/embroidery-enhanced-loading.js', 'shared_components/js/embroidery-quote-adapter.js', 'shared_components/js/order-form-size-suffix.js',
    'shared_components/js/screenprint-shopworks-guide-generator.js', 'training/js/api-test-runner.js', 'shared_components/js/dtg-product-recommendations-modal.js',
    'shared_components/js/dtg-quote-products.js', 'shared_components/js/dtg-quote-system.js', 'shared_components/js/emblem-pricing-service.js', 'shared_components/js/pricing-sidebar-component.js',
    'shared_components/js/quote-builder-step2-modern.js', 'shared_components/js/quote-indicator-manager.js', 'shared_components/js/quote-ui-feedback.js', 'shared_components/js/quote-validation.js',
    'shared_components/js/screenprint-quote-products.js', 'shared_components/js/shopworks-edp-generator.js', 'shared_components/js/staff-dashboard-announcements.js',
    'shared_components/js/sticker-pricing-service.js', 'shared_components/js/order-service-test-extended.js', 'shared_components/js/order-service-test-utilities.js', 'shared_components/js/product-recommendations.js', 'calculators/embroidery-manual-service.js',
    'shared_components/js/dtg-config.js', 'shared_components/js/shopworks-guide-generator.js',
    // the C112 BOGO promo: server.js answers its URL with a 410 (promo ended), so the page, its script and the S2 extractions never render
    'admin/c112-bogo-promo.html', 'c112-bogo-promo.js', 'admin/css/c112-bogo-promo.css', 'admin/js/c112-bogo-promo-page.js', 'admin/js/c112-bogo-promo-page-2.js',
    'mockups/dtg-3-step-complete.html', 'mockups/dtg-3-step-mockup.html', 'mockups/dtg-location-mockup-real-image.html', 'mockups/dtg-location-mockup-with-images.html',
    'mockups/dtg-location-mockup.html', 'mockups/dtg-location-selector-final.html', 'mockups/edit-ruth-mockup.html', 'mockups/product-page-complete-mockup.html',
    'mockups/staff-portal-mockup-1.html', 'mockups/staff-portal-mockup-2.html', 'mockups/staff-portal-mockup-3.html',
    'policies/bundle-kitting-xmas-2025.html', 'policies/customer-notification-sop.html', 'policies/dtg-artwork-checklist.html', 'policies/ltm-fee-policy.html',
    'policies/ltm-order-decision-algorithm.html', 'policies/payment-terms.html', 'policies/retail-vs-wholesale-pricing-policy.html', 'policies/sales-office-procedures.html',
    'pages/policies-hub-legacy.html', 'pages/policies/dtg-artwork-checklist.html', 'richardson-caps/view-combination-caps.html',
    'art-tools/art-approval.html', 'art-tools/ae-art-dashboard.html', 'art-tools/ae-submit-art.html', 'tests/order-service-test-harness.html',
];
const DELETED = new Set(DELETED_2026_09_06);
// Stale root-level copies found by the path-aware referrer check (2026-09-06, second pass): nothing loads them —
// the pages load the shared_components/js twins (dp5-helper is an older 632-line version, pricing-matrix-api is
// byte-identical, utils.js diverged in 2025-07) and no page ever requested /app-new.js. Removal is Erik's `git rm`
// (memory/DEAD_FILES_2026-09-06.md § root duplicates); until then they are skipped below and must stay unreferenced.
const PENDING_DELETION = ['pricing-matrix-api.js', 'dp5-helper.js', 'utils.js', 'app-new.js',
    'shared_components/js/quote-builder-base.js']; // a comment-only tombstone since 2026-07-08 — the real base is builders/shared/quote-builder-base.js
const PENDING = new Set(PENDING_DELETION);

// Not served pages: build output, tests, Node-side code, documentation, email/HTML templates, archives, vendored code.
const HTML_SKIP = /^(dist|tests|node_modules|memory|docs|scripts|templates|reference|email-templates|richardson-caps)\/|\/archive\/|archive-working-files\/|\/vendor\//;
const PAGES = tracked.filter((f) => f.endsWith('.html') && !HTML_SKIP.test(f) && !DELETED.has(f));

const strip = (h) => h.replace(/<!--[\s\S]*?-->/g, '').replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/g, '');
const BARE_ICON = /<i\b(?![^>]*aria-hidden)(?![^>]*aria-label)[^>]*\bclass="(?:fa[sr]|fab|fa-solid|fa-regular) [^"]*"[^>]*><\/i>/;
const HANDLER = /\son(click|change|input|blur|keydown|keyup|keypress|error|load|submit|mouseover|mouseout|focus)=/;
const INLINE_SCRIPT = /<script(?![^>]*\bsrc=)[^>]*>\s*[^\s<]/;
const UNVERSIONED_ABS = /(?:href|src)="\/(?!config\/app\.config\.js)(?!shared_components\/vendor\/)[^"?]+\.(?:css|js)"/;
const UNVERSIONED_REL = /(?:href|src)="(?!https?:|\/\/|\/|#|data:|mailto:)(?!(?:\.\.\/)*config\/app\.config\.js)[^"?]+\.(?:css|js)"/;

describe('every served HTML page is Rule-3 clean (2026-09-06 census)', () => {
    test('page list resolves', () => { expect(PAGES.length).toBeGreaterThan(200); });
    test.each(PAGES)('%s', (rel) => {
        const html = strip(read(rel));
        expect({ file: rel, styleBlocks: (html.match(/<style[\s>]/g) || []).length }).toEqual({ file: rel, styleBlocks: 0 });
        expect({ file: rel, inlineScript: INLINE_SCRIPT.test(html) }).toEqual({ file: rel, inlineScript: false });
        expect({ file: rel, handlers: (html.match(new RegExp(HANDLER.source, 'g')) || []).length }).toEqual({ file: rel, handlers: 0 });
        expect({ file: rel, bareIcons: (html.match(new RegExp(BARE_ICON.source, 'g')) || []).length }).toEqual({ file: rel, bareIcons: 0 });
        expect({ file: rel, unversioned: (html.match(new RegExp(UNVERSIONED_ABS.source, 'g')) || []).concat(html.match(new RegExp(UNVERSIONED_REL.source, 'g')) || []) }).toEqual({ file: rel, unversioned: [] });
    });
});

// Browser scripts: everything tracked as .js except Node-side dirs, tests, build output, vendored/archived code.
const JS_SKIP = /^(dist|tests|node_modules|memory|docs|scripts|templates|lib|config|\.claude|richardson-caps)\/|^server\.js$|^tools\/seed-top-sellers\.js$|\/vendor\/|\/archive\/|archive-working-files\//;
const BROWSER_JS = tracked.filter((f) => f.endsWith('.js') && !JS_SKIP.test(f));
// Referrers that count: served pages, browser scripts, server.js and the build. Not: tests, one-off Node scripts, archives.
const CORPUS = tracked.filter((f) => (f.endsWith('.html') || f.endsWith('.js') || f.endsWith('.jsx')) && !/^(dist|node_modules|tests)\/|\/archive\/|archive-working-files\//.test(f) && (!f.startsWith('scripts/') || f === 'scripts/build.js'));
const TEXT = new Map(CORPUS.map((f) => [f, read(f)]));
// A basename shared by two tracked scripts (utils.js, dp5-helper.js, pricing-matrix-api.js…) hid stale root-level
// copies from the first census: for those, a referrer must name the file by its directory ("shared_components/js/utils.js")
// or, for a root-level file, as a quoted "/name.js" / "name.js" — a bare basename anywhere no longer counts.
const baseCount = new Map();
for (const f of BROWSER_JS) { const b = path.basename(f); baseCount.set(b, (baseCount.get(b) || 0) + 1); }
function referrers(rel) {
    const base = path.basename(rel);
    const dup = (baseCount.get(base) || 0) > 1;
    const esc = base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const needle = !dup ? null : (rel.includes('/') ? rel.split('/').slice(-2).join('/') : null);
    // root-level duplicate: an absolute "/name.js" counts from anywhere; a bare "name.js" / "./name.js" only from another root file
    const rootAbs = dup && !needle ? new RegExp(`["'\`]/${esc}["'\`?]`) : null;
    const rootRel = dup && !needle ? new RegExp(`["'\`](\\./)?${esc}["'\`?]`) : null;
    const rootRe = rootAbs ? { test: (t, f) => rootAbs.test(t) || (path.posix.dirname(f) === '.' && rootRel.test(t)) } : null;
    const out = [];
    const dir = path.posix.dirname(rel);
    for (const [f, t] of TEXT) {
        if (f === rel || DELETED.has(f)) continue;
        // a sibling module importing `./base` (the builders' ES modules) is a real reference too
        const sibling = dup && needle && path.posix.dirname(f) === dir && t.includes('./' + base);
        const hit = rootRe ? rootRe.test(t, f) : (t.includes(needle || base) || sibling);
        if (hit) out.push(f);
    }
    return out;
}

// ── Static accessibility (2026-09-06 census: 118 unlabelled controls, 5 unnamed buttons, 3 unnamed links, 4 alt-less
//    images, 12 SEO pages that were bare fragments with no <html lang>) ──
const innerText = (frag) => frag.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim();
const NAMED = /aria-label|aria-labelledby|\btitle=/;
const A11Y_SKIP = /emailjs-template/; // email bodies, not pages
function a11yFindings(html) {
    const h = html.replace(/<!--[\s\S]*?-->/g, '');
    const out = [];
    for (const m of h.matchAll(/<img\b[^>]*>/g)) if (!/\balt=/.test(m[0])) out.push('img without alt: ' + m[0].slice(0, 80));
    for (const m of h.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)) if (!innerText(m[2]) && !NAMED.test(m[1])) out.push('unnamed button: ' + m[0].slice(0, 80));
    for (const m of h.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)) if (!innerText(m[2]) && !NAMED.test(m[1]) && !/<img[^>]*\balt="[^"]+"/.test(m[2])) out.push('unnamed link: ' + m[0].slice(0, 80));
    const labelsFor = new Set([...h.matchAll(/<label\b[^>]*\bfor="([^"]+)"/g)].map((m) => m[1]));
    for (const m of h.matchAll(/<(input|select|textarea)\b([^>]*)>/g)) {
        const attrs = m[2];
        if (/type="(hidden|submit|button|reset|image)"/.test(attrs) || NAMED.test(attrs)) continue;
        const id = (attrs.match(/\bid="([^"]+)"/) || [])[1];
        if (id && labelsFor.has(id)) continue;
        const before = h.slice(Math.max(0, m.index - 300), m.index);
        if (before.lastIndexOf('<label') > before.lastIndexOf('</label>')) continue; // wrapped in its label
        out.push('unlabelled control: ' + m[0].slice(0, 80));
    }
    if (!/<html\b[^>]*\blang=/.test(h)) out.push('no <html lang>');
    if (!/<title>/.test(h)) out.push('no <title>');
    return out;
}
describe('every served HTML page names its controls (static accessibility)', () => {
    test.each(PAGES.filter((p) => !A11Y_SKIP.test(p)))('%s', (rel) => {
        expect({ file: rel, findings: a11yFindings(read(rel)) }).toEqual({ file: rel, findings: [] });
    });
});

describe('no URL string with an unexpanded template expression (2026-09-06: the S3 host rewrite turned 7 template literals into quoted strings)', () => {
    test('every browser script builds ${…} URLs inside backticks', () => {
        // a COMPLETE single/double-quoted string that contains both /api/ and ${ — backtick strings are fine
        // (an HTML attribute inside a template literal — src="${base}/api/…" — has no space before its quote and is fine)
        const BAD = /(?<!=)(['"])(?:(?!\1)[^\n\\`])*\/api\/(?:(?!\1)[^\n\\`])*\$\{(?:(?!\1)[^\n\\`])*\1/;
        const offenders = BROWSER_JS.filter((f) => BAD.test(read(f)));
        expect(offenders).toEqual([]);
    });
});

describe('no bare console.log in a served script (CLAUDE.md pre-commit rule; 2026-09-06 sweep gated ~700 behind localhost / ?debug=1)', () => {
    test('every browser script is free of console.log(', () => {
        const offenders = BROWSER_JS.filter((f) => /(?<![\w.$])console\.log\(/.test(read(f)));
        expect(offenders).toEqual([]);
    });
});

describe('no orphan browser script', () => {
    test('script list resolves', () => { expect(BROWSER_JS.length).toBeGreaterThan(300); });
    test('every browser script outside DELETED_2026_09_06 is referenced by a page, script, route or the build', () => {
        const orphans = BROWSER_JS.filter((f) => !DELETED.has(f) && !PENDING.has(f) && referrers(f).length === 0);
        expect(orphans).toEqual([]);
    });
    test('the root-level duplicates pending deletion stay unreferenced (and disappear once removed)', () => {
        const revived = PENDING_DELETION.filter((f) => exists(f) && referrers(f).length > 0).map((f) => ({ file: f, referrers: referrers(f) }));
        expect(revived).toEqual([]);
    });
    test('the 69 files deleted on 2026-09-06 stay deleted', () => {
        expect(DELETED_2026_09_06.length).toBe(69);
        expect(DELETED_2026_09_06.filter(exists)).toEqual([]);
    });
});
