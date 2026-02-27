# shared_components/js/ — File Guide

**127 JavaScript files** organized by function. Updated 2026-02-27.

## Quote Builder System (shared across all builders)

| File | Purpose |
|------|---------|
| `base-quote-service.js` | Base class for all quote save/email services |
| `quote-builder-base.js` | Base quote builder functionality |
| `quote-builder-core.js` | Core quote builder shared logic (2026 consolidation) |
| `quote-builder-utils.js` | Shared utilities: escapeHtml, formatPrice, showToast, copyShareableUrl |
| `quote-builder-step2-modern.js` | Modern Step 2 UI (embroidery/cap builders) |
| `quote-formatter.js` | Quote formatting for display/print |
| `quote-persistence.js` | Save/load quote drafts |
| `quote-session.js` | Session management for quotes |
| `quote-validation.js` | Input validation for quote builders |
| `quote-ui-feedback.js` | User feedback (loading states, errors) |
| `quote-share-modal.js` | Shareable URL success modal |
| `quote-indicator-manager.js` | Quote status indicators |
| `color-picker-component.js` | Shared color picker module |
| `extended-sizes-config.js` | Extended size definitions (2XL→6XL, OSFA, etc.) |
| `pricing-sidebar-component.js` | Unified pricing sidebar |
| `customer-lookup-service.js` | Customer autocomplete from Caspio |
| `product-thumbnail-modal.js` | Product image thumbnail + click-to-enlarge |
| `exact-match-search.js` | Exact product style search |
| `sidebar-resize.js` | Resizable sidebar with drag handle |
| `shopworks-import-parser.js` | ShopWorks order text parser |
| `shopworks-guide-generator.js` | ShopWorks data entry guide generator |
| `staff-auth-helper.js` | Staff authentication helper |
| `INTEGRATION-EXAMPLE.js` | Integration reference/docs (not runtime) |
| `fetch-timeout.js` | Global fetch() wrapper with 15s timeout |

## DTG System

| File | Purpose |
|------|---------|
| `dtg-adapter.js` | Caspio pricing data adapter |
| `dtg-config.js` | DTG configuration |
| `dtg-integration.js` | Coordinates calculator, adapter, events |
| `dtg-page-setup.js` | DTG calculator page initialization |
| `dtg-pricing-service.js` | DTG pricing API service |
| `dtg-quote-builder.js` | DTG quote builder controller |
| `dtg-quote-pricing.js` | DTG quote pricing engine |
| `dtg-quote-products.js` | DTG quote product manager |
| `dtg-quote-service.js` | DTG quote save/email service |
| `dtg-quote-system.js` | DTG quote system orchestrator |
| `dtg-product-recommendations.js` | Product recommendations for DTG |
| `dtg-product-recommendations-modal.js` | Recommendations modal UI |
| `dtg-pricing-calculator.js` | DTG calculator UI logic |

## DTF System

| File | Purpose |
|------|---------|
| `dtf-adapter.js` | Caspio pricing data adapter |
| `dtf-config.js` | DTF location mappings (no pricing values) |
| `dtf-integration.js` | Coordinates calculator, adapter, events |
| `dtf-pricing-calculator.js` | DTF calculator UI & pricing logic |
| `dtf-pricing-service.js` | DTF API data fetcher & transformer |
| `dtf-quote-adapter.js` | DTF quote data adapter |
| `dtf-quote-builder.js` | DTF quote builder controller |
| `dtf-quote-pricing.js` | DTF pricing + config + service (consolidated) |
| `dtf-quote-products.js` | DTF quote product manager |
| `dtf-quote-service.js` | DTF quote save/email service |

## Embroidery System

| File | Purpose |
|------|---------|
| `embroidery-pricing-service.js` | Embroidery pricing adapter (Caspio API) |
| `embroidery-quote-adapter.js` | Embroidery data adapter for pricing engine |
| `embroidery-quote-invoice.js` | Invoice generation (ShopWorks format) |
| `embroidery-quote-logos.js` | Logo card management (positions, tiers, AL) |
| `embroidery-quote-pricing.js` | Pricing engine (tiers, LTM, stitch, FB) |
| `embroidery-quote-products.js` | Product row management |
| `embroidery-quote-service.js` | Quote save/update/email service |
| `additional-logo-embroidery-simple.js` | AL pricing for garment embroidery calculator |
| `additional-logo-cap-simple.js` | AL pricing for cap embroidery calculator |
| `embroidery-manual-service.js` | Manual embroidery calculator pricing service |

## Cap Embroidery System

| File | Purpose |
|------|---------|
| `cap-embroidery-pricing-service.js` | Cap embroidery pricing adapter |
| `cap-quote-builder.js` | Cap quote builder controller |
| `cap-quote-logos.js` | Cap logo position management |
| `cap-quote-pricing.js` | Cap quote pricing engine |
| `cap-quote-products.js` | Cap quote product manager |
| `cap-quote-service.js` | Cap quote save/email service |

## Screen Print System

| File | Purpose |
|------|---------|
| `screenprint-pricing-service.js` | Pricing data adapter (Caspio API) |
| `screenprint-pricing-v2.js` | Main calculator logic (v2 = current active) |
| `screenprint-manual-pricing.js` | Manual pricing calculator logic |
| `screenprint-quote-pricing.js` | Quote builder pricing engine |
| `screenprint-quote-products.js` | Quote product manager |
| `screenprint-quote-service.js` | Quote save/email service |
| `screenprint-fast-quote-service.js` | Fast quote (60 sec) service |

## Catalog & Product Display

| File | Purpose |
|------|---------|
| `product-search.js` | Product search functionality |
| `product-grid.js` | Product grid display |
| `product-filters.js` | Product filtering |
| `product-category-filter.js` | Category-based filtering |
| `product-recommendations.js` | Product recommendations |
| `product-pricing-ui.js` | Product pricing display |
| `universal-product-display.js` | Universal product display component |
| `universal-image-gallery.js` | Image gallery component |
| `universal-pricing-grid.js` | Pricing grid component |

## Pricing & Calculators

| File | Purpose |
|------|---------|
| `calculator-utilities.js` | Shared calculator utilities |
| `pricing-calculator.js` | Generic pricing calculator |
| `pricing-matrix-api.js` | Pricing matrix API calls |
| `pricing-matrix-capture.js` | Pricing matrix data capture |
| `pricing-matrix-capture-fix.js` | Pricing matrix capture fixes |
| `pricing-pages.js` | Shared pricing page utilities |
| `hero-quantity-calculator.js` | Homepage quantity-based pricing preview |
| `manual-mode-indicator.js` | Manual pricing mode UI indicator |
| `laser-tumbler-simple.js` | Laser tumbler pricing logic |
| `design-thumbnail-service.js` | Design thumbnail resolution service |

## Staff Dashboard

| File | Purpose |
|------|---------|
| `staff-dashboard-init.js` | Dashboard initialization, widget toggles |
| `staff-dashboard-service.js` | ManageOrders API integration |
| `staff-dashboard-announcements.js` | Priority announcements |
| `staff-dashboard-employees.js` | Employee widget management |
| `production-schedule-stats.js` | Precomputed turnaround stats |
| `production-schedule-predictor.js` | Turnaround prediction engine |
| `monogram-dashboard.js` | Monogram dashboard controller |

## Art Invoice System

| File | Purpose |
|------|---------|
| `art-invoice-config.js` | Art invoice configuration |
| `art-invoice-creator.js` | Art invoice creation logic |
| `art-invoice-utils.js` | Art invoice utilities |
| `art-invoice-viewer.js` | Art invoice display/view |

## Services & APIs

| File | Purpose |
|------|---------|
| `manageorders-customer-service.js` | ManageOrders customer API |
| `manageorders-inventory-service.js` | ManageOrders inventory API |
| `sample-inventory-service.js` | Sample inventory tracking |
| `sample-order-service.js` | Sample order management |
| `edp-generator-service.js` | EDP (Electronic Data Processing) service |
| `shopworks-edp-generator.js` | ShopWorks EDP generator |
| `jds-api-service.js` | JDS supplier API service |
| `monogram-form-service.js` | Monogram form API service |
| `monogram-form-controller.js` | Monogram form UI controller |

## UI Components & Utilities

| File | Purpose |
|------|---------|
| `utils.js` | General utilities |
| `app-config.js` | Legacy app configuration |
| `universal-header-component.js` | Site header component |
| `universal-cart-header.js` | Cart header component |
| `cart-drawer.js` | Slide-out cart drawer |
| `toast-notifications.js` | Toast notification system |
| `enhanced-loading-animations.js` | Loading animation components |
| `features-bundle.js` | Feature flag bundle |
| `header-button-functions.js` | Header button event handlers |
| `dp5-helper.js` | DataPage 5 (Caspio) helper |

## Test Utilities (in shared_components — should be in /tests/)

| File | Purpose |
|------|---------|
| `order-service-test-extended.js` | Extended order service tests |
| `order-service-test-utilities.js` | Order service test helpers |

## Previously Orphaned (removed 2026-02-27)

- `dtg-pricing-v4.js` — replaced by `dtg-pricing-service.js` + `dtg-adapter.js`
- `dtg-pricing-v4-cleaned.js` — duplicate of above
- `embroidery-pricing-v3.js` — replaced by `embroidery-pricing-service.js`
