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
    'calculators/breast-cancer-awareness-bundle.css',
    'calculators/screenprint-customer/screenprint-customer-invoice.css',
    "shared_components/css/specialty-pricing.css",
    "calculators/custom-decal-pricing.css",
    "calculators/embroidered-emblem/embroidered-emblem.css",
    "shared_components/css/specialty-assistant.css",
    'shared_components/css/crm-accounts.css',
    'shared_components/css/crm-pipeline.css',
    'shared_components/css/crm-records.css',
    'shared_components/css/personalization-workspaces.css',
    'shared_components/css/staff-toolkit.css',
    'shared_components/css/staff-workspaces.css',
    'shared_components/css/staff-schedules.css',
    'shared_components/css/staff-payroll.css',
    'shared_components/css/staff-mission-control.css',
    'shared_components/css/staff-company-numbers.css',
    'shared_components/css/staff-quote-management.css',
    'shared_components/css/vendor-inbound.css',
    'shared_components/css/vendor-box-labels.css',
    'shared_components/css/customer-intake.css',
    'shared_components/css/hosted-workspace.css',
    'shared_components/css/staff-admin-tools.css',
    'shared_components/css/staff-monitoring.css',
    'shared_components/css/staff-import-tools.css',
    'shared_components/css/purchasing-workspaces.css',
    'shared_components/css/photo-workspaces.css',
    'shared_components/css/design-libraries.css',
    'shared_components/css/design-library-provider.css',
    'shared_components/css/vendor-invoice.css',
    'shared_components/css/api-reference.css',
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
    'shared_components/css/campaign-storefront.css',
    'shared_components/css/golf-tournament-product.css',
    'shared_components/css/cart-drawer.css',
    'shared_components/css/safety-stripe-recs.css',
    'shared_components/css/blog.css',
    'shared_components/css/embroidery-quote-pricing.css',
    'pages/css/brand-guide.css',
    'shared_components/css/storefront-shell.css',
    'shared_components/css/catalog-storefront.css',
    'shared_components/css/calculator-reference.css',
    'shared_components/css/core-calculators.css',
    'shared_components/css/storefront-commerce.css',
    'shared_components/css/staff-reference.css',
    'pages/css/company-webstores.css',
    'pages/css/webstore-inquiry.css',
    'pages/css/instant-quote.css',
    'pages/css/customer-cart.css',
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
    'shared_components/css/transfer-workflow.css',
    'shared_components/css/art-workflow.css',
    'shared_components/css/art-detail.css',
    'shared_components/css/art-actions.css',
    'shared_components/css/art-theme.css',
    'shared_components/css/training-guide.css',
    'shared_components/css/training-service.css',
    'shared_components/css/training-practice.css',
    'shared_components/css/training-reference.css',
    'shared_components/css/training-manual.css',
    'shared_components/css/training-simulator.css',
    'shared_components/css/printable-forms.css',
    'shared_components/css/art-intake.css',
    'shared_components/css/sanmar-invoice-viewer.css',
    'shared_components/css/mockup-ruth.css',
    'shared_components/css/kanban.css',
    'shared_components/css/elapsed-time-utils.css',
    'shared_components/css/box-label-print.css',
    'shared_components/css/toast-notifications.css',
    'shared_components/css/sticker-banner-submit-form.css',
    'shared_components/css/old-designs.css',
    // Calculators family (2026-09-07): every calculator page sheet + the shared calculator/pricing widgets the
    // builders do NOT load (quote-builder-shell.css and sticker-pricing-page.css wait for the builders family)
    'shared_components/css/universal-pricing-header.css',
    'shared_components/css/manual-mode-indicator.css',
    'shared_components/css/calculator-inventory.css',
    'shared_components/css/universal-toggle-pricing.css',
    'shared_components/css/universal-ltm-quantity-input.css',
    'shared_components/css/calculator-base.css',
    'shared_components/css/universal-pricing-grid.css',
    'shared_components/css/universal-pricing-components.css',
    'shared_components/css/universal-image-gallery.css',
    'shared_components/css/universal-header.css',
    'shared_components/css/universal-calculator-theme.css',
    'shared_components/css/shared-pricing-styles.css',
    'shared_components/css/modern-enhancements.css',
    'shared_components/css/force-green-theme.css',
    'shared_components/css/contract-pricing-2026.css',
    'shared_components/css/additional-logo-pricing-table.css',
    'calculators/manual-calculator-styles.css',
    'shared_components/css/webstore-pricing-page.css',
    'shared_components/css/universal-quick-quote.css',
    'shared_components/css/universal-product-display.css',
    'shared_components/css/universal-pricing-layout.css',
    'shared_components/css/screenprint-toggle-styles.css',
    'shared_components/css/screenprint-safety-stripes.css',
    'shared_components/css/screenprint-pricing-v2.css',
    'shared_components/css/screenprint-pricing-tables.css',
    'shared_components/css/screenprint-pricing-clean.css',
    'shared_components/css/safety-stripe-creator.css',
    'shared_components/css/quote-system.css',
    'shared_components/css/laser-tumbler-simple.css',
    'shared_components/css/image-modal.css',
    'shared_components/css/emblem-pricing-page.css',
    'shared_components/css/dtg-ltm-quantity-input.css',
    'shared_components/css/dtf-toggle-pricing.css',
    'shared_components/css/dtf-outline-override.css',
    'shared_components/css/dtf-calculator.css',
    'shared_components/css/dtf-calculator-fix.css',
    'shared_components/css/calculator-modern-enhancements.css',
    'calculators/service-price-cheat-sheet.css',
    'calculators/screenprint-customer/screenprint-customer-styles.css',
    'calculators/screenprint-customer/screenprint-customer-fix.css',
    'calculators/richardson-2025-styles.css',
    'calculators/quick-quote/quick-quote.css',
    'calculators/quick-quote/linesheet-print.css',
    'calculators/manual-pricing.css',
    'calculators/embroidery-pricing-all/embroidery-pricing-all.css',
    'calculators/embroidery-contract/embroidery-contract.css',
    'calculators/dtg-contract/dtg-contract.css',
    'calculators/css/screen-print-pricing.css',
    'calculators/css/laser-manual-pricing.css',
    'calculators/css/embroidery-pricing.css',
    'calculators/css/embroidery-pricing-overrides.css',
    'calculators/css/dtg-pricing.css',
    'calculators/css/dtf-pricing.css',
    'calculators/css/christmas-bundles.css',
    'calculators/css/cap-embroidery-pricing-integrated.css',
    // pages/css staff + customer-portal batch (2026-09-07): the remaining page sheets under pages/ and their widgets
    'pages/css/3-day-tees.css',
    'pages/css/art-billing-reference.css',
    'pages/css/art-request-detail.css',
    'shared_components/css/staff-box-labels.css',
    'shared_components/css/custom-apparel-studio.css',
    'pages/css/custom-caps.css',
    'pages/css/custom-tees.css',
    'shared_components/css/customer-documents.css',
    'pages/css/customer-login.css',
    'shared_components/css/access-shell.css',
    'shared_components/css/catalog-discovery.css',
    'pages/css/order-confirmation.css',
    'pages/css/customer-portal.css',
    'pages/css/customer-product.css',
    'shared_components/css/design-preview-tools.css',
    'shared_components/css/embroidery-studio.css',
    'shared_components/css/product-detail-tools.css',
    'shared_components/css/pricing-reports.css',
    'pages/css/garment-designer.css',
    'pages/css/handbook.css',
    'pages/css/invoice.css',
    'pages/css/mockup-detail.css',
    'pages/css/mockup-generator.css',
    'pages/css/mockup-library.css',
    'pages/css/order-status.css',
    'pages/css/org-chart-2026.css',
    'pages/css/policy-workspace.css',
    'pages/css/policy-detail.css',
    'pages/css/portal-reorder-list.css',
    'pages/css/pricing-negotiation-policy.css',
    'pages/css/quote-view.css',
    'pages/css/simple-notice-page.css',
    'pages/css/supacolor-job-detail.css',
    'pages/css/thread-color-picker.css',
    'pages/css/transfer-detail.css',
    'pages/css/vendor-portal.css',
    'pages/data-entry-guide.css',
    'pages/embroidery-contract-pricing.css',
    'pages/request-a-quote.css',
    'product/styles/product.css',
    'shared_components/css/company-contact-picker.css',
    'shared_components/css/garment-submit-form.css',
    'shared_components/css/product-thumbnail-modal.css',
    // quote builders family (2026-09-07, LAST — the money path): the builders' sheets + quote-builder-utilities.css (replaces the generated quote-builder-inline.css)
    'shared_components/css/quote-builder-shell.css',
    'shared_components/css/sticker-pricing-page.css',
    'shared_components/css/quote-share-modal.css',
    'shared_components/css/quote-session.css',
    'shared_components/css/quote-builder-guided.css',
    'shared_components/css/quote-builder-common.css',
    'shared_components/css/customer-lookup.css',
    'shared_components/css/color-picker-shared.css',
    'shared_components/css/quote-print.css',
    'shared_components/css/shopworks-import.css',
    'shared_components/css/screenprint-quote-builder-extracted.css',
    'shared_components/css/embroidery-quote-builder-extracted.css',
    'shared_components/css/dtg-quote-page.css',
    'shared_components/css/dtg-inline-form.css',
    'shared_components/css/dtg-catalog.css',
    'shared_components/css/dtf-quote-builder.css',
    'shared_components/css/screenprint-fast-quote.css',
    'shared_components/css/quote-builder-utilities.css',
    // shared_components/css remainder (2026-09-07, with the quote builders family): the AE dashboard's nav + submit-form sheets
    'shared_components/css/ae-nav-v2.css',
    'shared_components/css/jds-submit-form.css',
    'shared_components/css/mockup-submit-form.css',
    // tail batch (2026-09-07): admin, production-shifts, price-audit-report, employee bundles, tools, vendor-portal css, dtf prototype css
    'calculators/quick-quote/dtf-prints-prototype.css',
    'shared_components/css/employee-bundles.css',
    'shared_components/css/staff-calibration.css',
    'shared_components/css/staff-records.css',
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
