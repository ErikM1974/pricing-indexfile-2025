/**
 * Repo-wide hygiene lock (2026-09-06, the final census after the staff / customer / calculator / builder sweeps).
 *
 *   1. EVERY served HTML page in the repo is Rule-3 clean: no <style> block, no inline <script> with content,
 *      no inline event handlers, no bare Font Awesome icon (aria-hidden or aria-label), every local .css/.js
 *      versioned (?v=) — the per-area locks cover their own lists; this one catches a NEW page anywhere.
 *   2. No orphan browser script: every JS file outside the Node-side dirs is referenced by name from at least
 *      one page, script, server.js or the build. The 2026-09-06 census found 35 unreferenced scripts (the
 *      oldest untouched since 2025-06); a script nobody loads is dead weight that still gets "fixed" in sweeps.
 *   3. The files the census verified dead stay out: if one is still present it must stay unreferenced
 *      (never resurrected by a link), and once deleted it must not come back.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const ROOT = path.join(__dirname, '..', '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const exists = (rel) => fs.existsSync(path.join(ROOT, rel));
const tracked = execSync('git ls-files', { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).split(/\r?\n/).filter(Boolean).map((f) => f.replace(/\\/g, '/'));

// Dead files verified by the 2026-09-06 census (zero references from any page, script, route or build).
// Their removal is a separate, human-run `git rm` — until then they are skipped by lock 1 and must stay unreferenced.
const PENDING_DELETION = [
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
const PENDING = new Set(PENDING_DELETION);

// Not served pages: build output, tests, Node-side code, documentation, email/HTML templates, archives, vendored code.
const HTML_SKIP = /^(dist|tests|node_modules|memory|docs|scripts|templates|reference|email-templates|richardson-caps)\/|\/archive\/|archive-working-files\/|\/vendor\//;
const PAGES = tracked.filter((f) => f.endsWith('.html') && !HTML_SKIP.test(f) && !PENDING.has(f));

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
function referrers(rel) {
    const base = path.basename(rel);
    const out = [];
    for (const [f, t] of TEXT) if (f !== rel && !PENDING.has(f) && t.includes(base)) out.push(f);
    return out;
}

describe('no orphan browser script', () => {
    test('script list resolves', () => { expect(BROWSER_JS.length).toBeGreaterThan(300); });
    test('every browser script outside PENDING_DELETION is referenced by a page, script, route or the build', () => {
        const orphans = BROWSER_JS.filter((f) => !PENDING.has(f) && referrers(f).length === 0);
        expect(orphans).toEqual([]);
    });
    test('a file verified dead is never resurrected by a new reference', () => {
        // server.js names the two art-tools stubs only inside their 301 route, and the C112 files inside the 410 route
        // that retired the promo — neither is a load.
        const real = (f) => referrers(f).filter((r) => !(r === 'server.js' && /^(art-tools\/|admin\/c112-bogo-promo|c112-bogo-promo)/.test(f)));
        const revived = PENDING_DELETION.filter((f) => exists(f) && real(f).length > 0).map((f) => ({ file: f, referrers: real(f) }));
        expect(revived).toEqual([]);
    });
});
