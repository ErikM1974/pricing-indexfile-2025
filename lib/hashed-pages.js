/**
 * THE list of pages whose assets are content-hashed.
 *
 * Two things have to agree or the feature silently does nothing:
 *   - scripts/build.js reads this to decide which pages' /js and /css refs get
 *     minified + content-hashed into /dist and recorded in asset-manifest.json;
 *   - server.js reads it to decide which pages get their tags rewritten to the
 *     hashed URLs when served.
 * A page in the build list but not the serve list produces hashed assets nobody
 * ever loads; the reverse serves source paths and looks like the build broke.
 * Keeping ONE list here makes that drift impossible, and
 * tests/unit/build/hashed-pages.test.js locks the invariants.
 *
 * Why these pages: hashed URLs are served `immutable, max-age=1y`, so a repeat
 * visitor re-downloads nothing. That only pays where visitors actually return
 * and aren't already authenticated — i.e. the public storefront. Staff pages sit
 * behind SSO with a small audience and are deliberately NOT here yet.
 *
 * Adding a page:
 *   1. add its repo-relative path below;
 *   2. make sure whatever serves it calls sendHashedHtml() (server.js) — a page
 *      reached only through a static mount needs the /pages-style middleware;
 *   3. run `npm run build` and confirm the page's assets appear in the manifest.
 *
 * Caveat worth knowing: the build only discovers `/`-absolute refs
 * (build.js discoverAssets). A page that references a sibling by bare name
 * ("app-modern.js?v=") keeps serving that file uncached — harmless, just no
 * benefit. index.html has 7 such refs today.
 */

/** Quote builders — the original tranche (ESM entry bundles + classic assets). */
const BUILDER_PAGES = [
    'quote-builders/embroidery-quote-builder.html',
    'quote-builders/screenprint-quote-builder.html',
    'quote-builders/dtf-quote-builder.html',
    'quote-builders/dtg-quote-builder.html',
];

/**
 * Public storefront pages (tranche 2, 2026-08-05). Every one of these is
 * reachable anonymously, so a returning customer is the person who benefits.
 */
const STOREFRONT_PAGES = [
    'index.html',
    'product.html',
    'brands.html',
    'pages/catalog.html',
    'pages/customer-product.html',
    'pages/quote-cart.html',
    'pages/sample-cart.html',
    'pages/custom-tees.html',
    'pages/custom-caps.html',
    'pages/custom-stickers.html',
    'pages/custom-banners.html',
    'pages/custom-bella-canvas.html',
    'pages/custom-carhartt.html',
    'pages/custom-cornerstone.html',
    'pages/custom-district.html',
    'pages/custom-eddie-bauer.html',
    'pages/custom-gildan.html',
    'pages/custom-new-era.html',
    'pages/custom-nike.html',
    'pages/custom-north-face.html',
    'pages/custom-ogio.html',
    'pages/custom-port-and-company.html',
    'pages/custom-port-authority.html',
    'pages/custom-richardson.html',
    'pages/custom-sport-tek.html',
    'pages/custom-travismathew.html',
];

/**
 * Staff pages (tranche 3, 2026-08-05) — every .html under /dashboards and
 * /tools. Globbed rather than listed because both directories are gated
 * UNIFORMLY at the mount (`app.use('/dashboards', gateStaffHtml)` runs before
 * the static mount), so a page added later is gated the moment it exists and
 * should be hashed the moment it exists too. The security boundary is that
 * gate, never this list — nothing here grants access to anything.
 *
 * The serve-side rewrite for these sits BETWEEN the gate and the static mount,
 * so an anonymous request is still bounced to SSO before any HTML is read.
 * tests/unit/build/hashed-pages.test.js asserts that ordering.
 */
function listHtml(dir) {
    const fs = require('fs');
    const path = require('path');
    const abs = path.join(__dirname, '..', dir);
    let names;
    try {
        names = fs.readdirSync(abs);
    } catch {
        return []; // directory absent (partial checkout) — degrade to no hashing
    }
    return names
        .filter((n) => n.endsWith('.html'))
        .sort()
        .map((n) => dir + '/' + n);
}

const STAFF_PAGES = [...listHtml('dashboards'), ...listHtml('tools')];

/**
 * Calculator pages (tranche 4, 2026-08-05), flat and one level nested.
 *
 * /calculators has NO mount gate — unlike /dashboards, it is mostly public and
 * the one staff-only page (custom-decal-pricing.html) is protected by its own
 * `requireStaff` route. The rewrite is therefore registered immediately before
 * the static mount, which puts it after EVERY gate for this prefix: a gate
 * registered after the static mount would already be bypassed by express.static,
 * so "before the static mount" necessarily means "after all gates".
 *
 * archive/ is excluded — those pages are retired.
 */
function listCalculatorHtml() {
    const fs = require('fs');
    const path = require('path');
    const root = path.join(__dirname, '..', 'calculators');
    const out = [];
    let entries;
    try {
        entries = fs.readdirSync(root, { withFileTypes: true });
    } catch {
        return [];
    }
    for (const e of entries.sort((a, b) => a.name.localeCompare(b.name))) {
        if (e.isFile() && e.name.endsWith('.html')) {
            out.push('calculators/' + e.name);
        } else if (e.isDirectory() && e.name !== 'archive') {
            let inner = [];
            try {
                inner = fs.readdirSync(path.join(root, e.name));
            } catch {
                continue;
            }
            for (const n of inner.sort()) {
                if (n.endsWith('.html')) out.push('calculators/' + e.name + '/' + n);
            }
        }
    }
    return out;
}

const CALCULATOR_PAGES = listCalculatorHtml();

/**
 * The Staff Dashboard (tranche 5, 2026-09-04). The one page every staffer
 * opens every day, so the "returning visitor" argument above applies to it
 * more than to any storefront page: nine stylesheets (217 KB) and a ~25-file
 * ES-module graph were re-downloaded on every visit. Its module entry is
 * BUNDLED by scripts/build.js (ENTRY_BUNDLES) into one hashed file, and its
 * three routes in server.js (/staff-dashboard.html, /staff-dashboard-v3/,
 * /staff-dashboard-v3/index.html) all call sendHashedHtml() after requireStaff.
 */
const DASHBOARD_PAGES = ['staff-dashboard-v3/index.html'];

const HASHED_PAGES = [...BUILDER_PAGES, ...STOREFRONT_PAGES, ...STAFF_PAGES, ...CALCULATOR_PAGES, ...DASHBOARD_PAGES];

/**
 * Pages under /pages that are reached through the static mount rather than a
 * bespoke route — server.js puts a small rewrite middleware in front of that
 * mount for exactly these.
 */
const HASHED_PAGES_UNDER_PAGES_MOUNT = HASHED_PAGES
    .filter((p) => p.startsWith('pages/'))
    .map((p) => '/' + p);

/** Staff pages keyed by mount, for the gated rewrite routes in server.js. */
const HASHED_STAFF_UNDER_MOUNT = {
    dashboards: new Set(STAFF_PAGES.filter((p) => p.startsWith('dashboards/')).map((p) => p.split('/')[1])),
    tools: new Set(STAFF_PAGES.filter((p) => p.startsWith('tools/')).map((p) => p.split('/')[1])),
};

/** Calculator paths below /calculators, as a Set for the rewrite route. */
const HASHED_CALCULATOR_PATHS = new Set(
    CALCULATOR_PAGES.map((p) => p.slice('calculators/'.length))
);

module.exports = {
    BUILDER_PAGES,
    STOREFRONT_PAGES,
    STAFF_PAGES,
    CALCULATOR_PAGES,
    DASHBOARD_PAGES,
    HASHED_PAGES,
    HASHED_PAGES_UNDER_PAGES_MOUNT,
    HASHED_STAFF_UNDER_MOUNT,
    HASHED_CALCULATOR_PATHS,
};
