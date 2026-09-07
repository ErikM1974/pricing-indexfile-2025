#!/usr/bin/env node
/**
 * lint-css.js — stylelint over the standardized stylesheets (CSS standardization Step 3, 2026-09-07).
 *
 * CSS_LINT_SCOPE is the ratchet: a family's stylesheets are added when the family migrates to
 * shared_components/css/tokens.css (memory/CSS_STANDARDIZATION_PLAN_2026-09.md § 4) and are never
 * removed. The rules live in stylelint.config.mjs. Run `npm run lint:css`; tests/unit/css-lint.test.js
 * runs this same script under jest so `npm test` and the deploy gate fail on a CSS lint error.
 *
 * Exit 0 = every file in scope is clean; exit 1 = findings (printed) or a stylelint error.
 */
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

/** Repo-relative globs. Widen only — never remove a file to make the lint pass. */
const CSS_LINT_SCOPE = [
    // Step 1 (2026-09-07): the two token files
    'shared_components/css/tokens.css',
    'shared_components/css/staff-dashboard/tokens.css',
    // Forms family (2026-09-07): the shared form framework + 17 per-form sheets
    'pages/forms/*.css',
    // Brand Standards page (2026-09-07): the first page built from templates/page-template.html
    'dashboards/css/brand-standards.css',
    // Training family (2026-09-07): the shared chrome + 26 page sheets (page themes in one :root block each)
    'training/css/*.css',
    'training/*.css',
    // Step 2 (2026-09-07): the shared component + utility layers
    'shared_components/css/components.css',
    'shared_components/css/utilities.css',
    // Webstore / SEO family (2026-09-07): the storefront system, the g-header template sheets, catalog + carts
    'shared_components/css/nwca-2026-core.css',
    'shared_components/css/nwca-2026.css',
    'shared_components/css/golf-tournament-showcase.css',
    'shared_components/css/golf-tournament-product.css',
    'shared_components/css/cart-drawer.css',
    'shared_components/css/safety-stripe-recs.css',
    'shared_components/css/blog.css',
    'shared_components/css/embroidery-quote-pricing.css',
    'pages/css/custom-carhartt.css',
    'pages/css/company-webstores.css',
    'pages/css/instant-quote.css',
    'pages/css/sample-cart.css',
    'pages/css/quote-cart.css',
    'pages/css/fall-catalog-2026.css',
    'pages/css/custom-banners.css',
    'pages/css/catalog-2026.css',
    'product/css/product-2026.css',
    'catalog-search.css',
    'brands.css',
    // Dashboards family (2026-09-07): the queue-dashboard system (art-hub + dash-shell), the staff dashboard's
    // own layers, every dashboards/css sheet and the shared widgets the dashboards load
    'shared_components/css/art-hub.css',
    'shared_components/css/dash-shell.css',
    'shared_components/css/staff-dashboard/*.css',
    'dashboards/css/*.css',
    'shared_components/css/transfer-actions.css',
    'shared_components/css/sanmar-invoice-viewer.css',
    'shared_components/css/mockup-ruth.css',
    'shared_components/css/kanban.css',
    'shared_components/css/elapsed-time-utils.css',
    'shared_components/css/box-label-print.css',
    'shared_components/css/toast-notifications.css',
    'shared_components/css/sticker-banner-submit-form.css',
    'shared_components/css/old-designs.css',
    'shared_components/css/names-numbers.css',
];

async function run() {
    const { default: stylelint } = await import('stylelint');
    const result = await stylelint.lint({
        files: CSS_LINT_SCOPE,
        cwd: ROOT,
        configFile: path.join(ROOT, 'stylelint.config.mjs'),
        formatter: 'string',
    });
    return { errored: result.errored, report: result.report || '', files: result.results.map((r) => path.relative(ROOT, r.source).replace(/\\/g, '/')) };
}

module.exports = { CSS_LINT_SCOPE, run };

if (require.main === module) {
    run()
        .then((r) => {
            if (r.report.trim()) console.log(r.report);
            if (r.errored) process.exit(1);
            console.log(`stylelint: ${r.files.length} file(s) in scope, all clean`);
        })
        .catch((e) => {
            console.error(e);
            process.exit(1);
        });
}
