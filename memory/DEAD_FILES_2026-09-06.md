# Dead files verified by the 2026-09-06 final census — ✅ DELETED, live `v2026.09.06.35`

> Done 2026-09-06 on Erik's instruction ("i ran the git rm, now commit and deploy it" — his run had not reached this checkout, so the removal ran here). `tests/unit/repo-hygiene-final.test.js` `DELETED_2026_09_06` now asserts all 69 stay gone. The command below is kept as the record.

Every file below has **zero references** from any served page, browser script, `server.js` route or the build
(`tests/unit/repo-hygiene-final.test.js` re-verifies this on every run — it fails if one of them is ever
linked again). They are still in the tree only because the bulk removal is a human decision; the rows are
marked ⛔ DEAD in `ACTIVE_FILES.md`.

Why each group is dead:
- **35 browser scripts** — no page loads them; the oldest untouched since 2025-06 (`header-button-functions.js`,
  `enhanced-loading-animations.js`); several are superseded services (`dtg-quote-system.js`, `sticker-pricing-service.js`,
  `emblem-pricing-service.js`, `dtg-config.js` — only a validator script named it) or 2025 prototypes
  (`quote-builder-step2-modern.js`, `pricing-sidebar-component.js`).
- **11 `mockups/*.html`** — 2025 design mockups, served by a static mount, linked from nowhere.
- **8 `policies/*.html` + `pages/policies-hub-legacy.html` + `pages/policies/dtg-artwork-checklist.html`** — the pre-Caspio
  static policy pages; `policies/` has no static mount (404 live) and the legacy hub is itself unlinked. The two
  one-time seed scripts (`scripts/extract-legacy-policies.js`, `seed-policies.js`) read them and will fail visibly if re-run —
  the policies live in Caspio now.
- **`art-tools/`** — `art-approval.html` still carries the placeholder `[ART_APPROVAL_PUBLIC_KEY]` (never finished);
  the two AE stubs were redirect pages and are now real 301s in `server.js` (`v2026.09.06.33`), so the mount is gone.
- **C112 BOGO promo** (`admin/c112-bogo-promo.html`, `c112-bogo-promo.js`, the S2 extractions) — `server.js` answers
  the page URL with a 410 (promo ended, frozen prices), so nothing here ever renders.
- **`richardson-caps/view-combination-caps.html` + its script** — Richardson is CLOSED (Erik); no mount, no links.
- **`tests/order-service-test-harness.html` + the two `order-service-test-*.js`** — a manual harness for a retired service.

Not deleted, deliberately: `reference/*.html` (SEO documentation for Mehar), `richardson-caps/{docs,data,README}`, `calculators/archive/`.

## Erik: run this from the repo root, then `git commit -m "Delete the 69 dead files from the 2026-09-06 census"` and `/deploy`

```bash
git rm -q -- admin/c112-bogo-promo.html admin/css/c112-bogo-promo.css admin/js/c112-bogo-promo-page-2.js admin/js/c112-bogo-promo-page.js art-tools/ae-art-dashboard.html art-tools/ae-submit-art.html art-tools/art-approval.html c112-bogo-promo.js calculators/embroidery-manual-service.js calculators/leatherette-patch-quote-service.js calculators/webstores-calculator.js calculators/webstores-fundraiser.js calculators/webstores-quote-service.js mockups/dtg-3-step-complete.html mockups/dtg-3-step-mockup.html mockups/dtg-location-mockup-real-image.html mockups/dtg-location-mockup-with-images.html mockups/dtg-location-mockup.html mockups/dtg-location-selector-final.html mockups/edit-ruth-mockup.html mockups/product-page-complete-mockup.html mockups/staff-portal-mockup-1.html mockups/staff-portal-mockup-2.html mockups/staff-portal-mockup-3.html pages/policies-hub-legacy.html pages/policies/dtg-artwork-checklist.html policies/bundle-kitting-xmas-2025.html policies/customer-notification-sop.html policies/dtg-artwork-checklist.html policies/ltm-fee-policy.html policies/ltm-order-decision-algorithm.html policies/payment-terms.html policies/retail-vs-wholesale-pricing-policy.html policies/sales-office-procedures.html richardson-caps/scripts/richardson-combination-caps-manual.js richardson-caps/view-combination-caps.html shared_components/js/cap-embroidery-pricing-logic.js shared_components/js/color-picker-component.js shared_components/js/dtg-config.js shared_components/js/dtg-integration.js shared_components/js/dtg-product-recommendations-modal.js shared_components/js/dtg-product-recommendations.js shared_components/js/dtg-quote-products.js shared_components/js/dtg-quote-system.js shared_components/js/edp-generator-service.js shared_components/js/emblem-pricing-service.js shared_components/js/embroidery-customization-options.js shared_components/js/embroidery-enhanced-loading.js shared_components/js/embroidery-quote-adapter.js shared_components/js/enhanced-loading-animations.js shared_components/js/header-button-functions.js shared_components/js/order-form-size-suffix.js shared_components/js/order-service-test-extended.js shared_components/js/order-service-test-utilities.js shared_components/js/pricing-sidebar-component.js shared_components/js/product-recommendations.js shared_components/js/quote-builder-step2-modern.js shared_components/js/quote-indicator-manager.js shared_components/js/quote-ui-feedback.js shared_components/js/quote-validation.js shared_components/js/screenprint-quote-products.js shared_components/js/screenprint-shopworks-guide-generator.js shared_components/js/shopworks-edp-generator.js shared_components/js/shopworks-guide-generator.js shared_components/js/staff-dashboard-announcements.js shared_components/js/sticker-pricing-service.js tests/order-service-test-harness.html training/js/api-test-runner.js training/training-engine-base.js
```

After the deletion, also remove the ⛔ DEAD rows from `ACTIVE_FILES.md` (`grep -n "DEAD (2026-09-06 census" ACTIVE_FILES.md`)
and the `PENDING_DELETION` entries in `tests/unit/repo-hygiene-final.test.js` (the lock then guards the absence).

## The list (69 files)

- `admin/c112-bogo-promo.html`
- `admin/css/c112-bogo-promo.css`
- `admin/js/c112-bogo-promo-page-2.js`
- `admin/js/c112-bogo-promo-page.js`
- `art-tools/ae-art-dashboard.html`
- `art-tools/ae-submit-art.html`
- `art-tools/art-approval.html`
- `c112-bogo-promo.js`
- `calculators/embroidery-manual-service.js`
- `calculators/leatherette-patch-quote-service.js`
- `calculators/webstores-calculator.js`
- `calculators/webstores-fundraiser.js`
- `calculators/webstores-quote-service.js`
- `mockups/dtg-3-step-complete.html`
- `mockups/dtg-3-step-mockup.html`
- `mockups/dtg-location-mockup-real-image.html`
- `mockups/dtg-location-mockup-with-images.html`
- `mockups/dtg-location-mockup.html`
- `mockups/dtg-location-selector-final.html`
- `mockups/edit-ruth-mockup.html`
- `mockups/product-page-complete-mockup.html`
- `mockups/staff-portal-mockup-1.html`
- `mockups/staff-portal-mockup-2.html`
- `mockups/staff-portal-mockup-3.html`
- `pages/policies-hub-legacy.html`
- `pages/policies/dtg-artwork-checklist.html`
- `policies/bundle-kitting-xmas-2025.html`
- `policies/customer-notification-sop.html`
- `policies/dtg-artwork-checklist.html`
- `policies/ltm-fee-policy.html`
- `policies/ltm-order-decision-algorithm.html`
- `policies/payment-terms.html`
- `policies/retail-vs-wholesale-pricing-policy.html`
- `policies/sales-office-procedures.html`
- `richardson-caps/scripts/richardson-combination-caps-manual.js`
- `richardson-caps/view-combination-caps.html`
- `shared_components/js/cap-embroidery-pricing-logic.js`
- `shared_components/js/color-picker-component.js`
- `shared_components/js/dtg-config.js`
- `shared_components/js/dtg-integration.js`
- `shared_components/js/dtg-product-recommendations-modal.js`
- `shared_components/js/dtg-product-recommendations.js`
- `shared_components/js/dtg-quote-products.js`
- `shared_components/js/dtg-quote-system.js`
- `shared_components/js/edp-generator-service.js`
- `shared_components/js/emblem-pricing-service.js`
- `shared_components/js/embroidery-customization-options.js`
- `shared_components/js/embroidery-enhanced-loading.js`
- `shared_components/js/embroidery-quote-adapter.js`
- `shared_components/js/enhanced-loading-animations.js`
- `shared_components/js/header-button-functions.js`
- `shared_components/js/order-form-size-suffix.js`
- `shared_components/js/order-service-test-extended.js`
- `shared_components/js/order-service-test-utilities.js`
- `shared_components/js/pricing-sidebar-component.js`
- `shared_components/js/product-recommendations.js`
- `shared_components/js/quote-builder-step2-modern.js`
- `shared_components/js/quote-indicator-manager.js`
- `shared_components/js/quote-ui-feedback.js`
- `shared_components/js/quote-validation.js`
- `shared_components/js/screenprint-quote-products.js`
- `shared_components/js/screenprint-shopworks-guide-generator.js`
- `shared_components/js/shopworks-edp-generator.js`
- `shared_components/js/shopworks-guide-generator.js`
- `shared_components/js/staff-dashboard-announcements.js`
- `shared_components/js/sticker-pricing-service.js`
- `tests/order-service-test-harness.html`
- `training/js/api-test-runner.js`
- `training/training-engine-base.js`

## Second pass (2026-09-06, later): 4 stale ROOT-LEVEL duplicates — pending Erik's `git rm`

The first census matched referrers by basename, which let a stale root copy hide behind its `shared_components/js`
twin. The lock is now path-aware (`referrers()` in `repo-hygiene-final.test.js`) and these four have NO loader:

- `pricing-matrix-api.js` — byte-identical to `shared_components/js/pricing-matrix-api.js`, which is what the two calculators load.
- `dp5-helper.js` — a 632-line 2025 version of the 938-line `shared_components/js/dp5-helper.js` the calculators load.
- `utils.js` — diverged from `shared_components/js/utils.js` in 2025-07; the DTG builder's `./utils.js` imports resolve to `builders/dtg/utils.js`, not this.
- `app-new.js` — only ever served by an explicit `/app-new.js` route that no page requested (removed from `server.js` in `v2026.09.06.37`); `index.html` loads `app-modern.js`.
- `shared_components/js/quote-builder-base.js` — a comment-only tombstone since 2026-07-08 pointing at `builders/shared/quote-builder-base.js`; no page or script loads it.
- `shared_components/js/screenprint-manual-pricing.js` — the manual screen-print calculator; its only page is `calculators/archive/manual-pricing-deprecated/screenprint-manual-pricing.html` (retired 2026-08-05); two shared scripts name it in comments only. It still carries the typed 24-36/$75 tier strip the live v2 lost in `.42`.

```bash
git rm -q -- pricing-matrix-api.js dp5-helper.js utils.js app-new.js shared_components/js/quote-builder-base.js shared_components/js/screenprint-manual-pricing.js
```

Then drop the four rows from `ACTIVE_FILES.md` and move them from `PENDING_DELETION` to `DELETED_2026_09_06` in the lock.
