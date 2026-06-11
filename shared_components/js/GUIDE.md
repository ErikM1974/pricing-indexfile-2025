# shared_components/js/ — File Guide

**124 JavaScript files** organized by function. Updated 2026-02-27.

## Quote Builder System (shared across all builders)

| File | Purpose |
|------|---------|
| `base-quote-service.js` | Base class for all quote save/email services |
| `quote-builder-base.js` | Base quote builder functionality |
| `quote-builder-core.js` | Core quote builder shared logic (2026 consolidation) |
| `quote-builder-utils.js` | Shared utilities: escapeHtml, formatPrice, showToast, copyShareableUrl |
| `quote-cart-engine.js` | **Customer quote-cart engine (Phase 0, 2026-06-11)** — PURE orchestration (pooling, grouping, fees, honest-LTM, tier nudges, trace); zero price formulas: per-method adapters call the staff authorities (EMB calculator class / POST /api/dtg/quote-pricing / SCP service bundle + exact builder findPricingTier copy / DTFPricingService.calculatePriceForQuantity). `priceCart(cart)` + `singleItemPreview(item)`. Dual browser/Node; parity-locked by tests/unit/web-quote-cart-parity.test.js against memory/CUSTOMER_QUOTE_CART_DESIGN_2026-06.md worked examples |
| `quote-cart-store.js` | **Customer quote-cart store (Phase 2, 2026-06-11)** — `window.QuoteCartStore`: sessionStorage key `nwca.quoteCart.v1`, schema v1, 24h TTL (mismatch/expiry/corruption → silent reset). Stores items (style/color/qty/sizes/method/placement/inkColors) — **never prices**; the cart reprices via quote-cart-engine at render time. API: `add/updateQty/remove/clear/getItems/count/totalPieces/onChange` (same-tab pub/sub + `storage` events). Auto-wires masthead `[data-quote-badge]` elements (count into `[data-quote-badge-count]`, hidden at 0). Dual browser/Node; locked by tests/unit/quote-cart-store.test.js |
| `quote-services-bar.js` | Persistent catalog-driven services bar; `render(mountId, catalog, onAdd)` → one-click chips that add services as line items (EMB/SCP/DTG/DTF, each with its own catalog) |
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
| `quote-extended-sizes.js` | Extended size popup functions (open/close/apply/child rows) — shared by EMB, DTG, SP |
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
| `dash-page-helpers.js` | Canonical helpers for staff-dashboard child pages — `DashPage.showError/hideError/apiUrl/fetchJson`. Loaded by every page scaffolded via the `/dash-page` skill. Wraps APP_CONFIG + fetch-timeout, enforces CLAUDE.md API-error rule (no silent fallback). |
| `caspio-date-utils.js` | Parse Caspio timestamps (Pacific server time → correct UTC instant, DST-aware). `window.CaspioDate.parse/formatDateTime/formatDate/formatAge`. Use this — never `+ 'Z'`. |

## DTG System

| File | Purpose |
|------|---------|
| `dtg-adapter.js` | Caspio pricing data adapter |
| `dtg-config.js` | DTG configuration |
| `dtg-integration.js` | Coordinates calculator, adapter, events |
| `dtg-page-setup.js` | DTG calculator page initialization |
| `dtg-pricing-service.js` | DTG pricing API service |
| ~~`dtg-quote-pricing.js`~~ | **DELETED 2026-06-09** — dead legacy DTG quote pricing engine (no HTML loaded it) |
| `dtg-quote-products.js` | DTG quote product manager (⚠️ legacy — dead-code candidate; refs deleted DTGQuotePricing) |
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
| ~~`dtf-quote-adapter.js`~~ | **DELETED 2026-06-09** — orphaned DTF adapter w/ hardcoded price grid (re-wire trap) |
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
| ~~`cap-quote-builder.js`~~ | **DELETED 2026-06-09** — dead cap-quote system (EMB builder handles caps) |
| ~~`cap-quote-logos.js`~~ | **DELETED 2026-06-09** — orphaned (controller deleted), zero references |
| ~~`cap-quote-pricing.js`~~ | **DELETED 2026-06-09** — dead cap-quote pricing engine |
| ~~`cap-quote-products.js`~~ | **DELETED 2026-06-09** — orphaned (controller deleted), zero references |
| ~~`cap-quote-service.js`~~ | **DELETED 2026-06-09** — dead cap-quote save/email service |

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
| `decoration-methods.js` | Decoration method eligibility (NEW 2026-06-11) — `/api/decoration-methods` rules+overrides, sessionStorage 1h cache. `eligibleFor(product)` → EMB/SCP/DTF bools + DTG 'yes'/'warn'/'no' cotton gate; `categoriesFor(method)` feeds the /catalog Decoration filter. API down → embroidery-only fallback (`source:'fallback'` — caller MUST show a visible warning). Used by product.html + /catalog. |
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
| `pricing-pages.js` | Shared pricing page utilities |
| `manual-mode-indicator.js` | Manual pricing mode UI indicator |
| `laser-tumbler-simple.js` | Laser tumbler pricing logic |
| `design-thumbnail-service.js` | Design thumbnail resolution service |
| `sticker-pricing-service.js` | Sticker pricing fetcher (`/api/sticker-pricing`) — 50 SKUs (5 sizes × 10 qty tiers) with PartNumber. Used by order-form sticker method + sticker page. |
| `sticker-pricing-page.js` | Sticker + Banner quote page logic — renders 5 sticker tables (`/api/sticker-pricing`) AND banner rate-card grid (`/api/banner-pricing`); drives AI chat (SSE to `/api/contract-sticker-ai/chat`, handles BOTH product lines); parses PRICE_QUOTE/CUSTOMER_FINAL/EMAIL DRAFT blocks; highlights sticker rows OR banner rate cards based on `productType`; renders inline banner-quote card; saves to `quote_sessions` with STK prefix. |
| `emblem-pricing-service.js` | Embroidered emblem pricing fetcher (`/api/emblem-pricing`). |
| `emblem-pricing-page.js` | Embroidered emblem patch quote page logic — renders 16×10 pricing grid (`/api/emblem-pricing`); drives AI chat (SSE to `/api/contract-emblem-ai/chat`); parses PRICE_QUOTE/CUSTOMER_FINAL/EMAIL DRAFT blocks; highlights pricing-grid cells on AI quote; renders inline emblem-quote card with order total + LTM note; saves to `quote_sessions` with PATCH prefix. Mirrors sticker-pricing-page.js exactly — single product line, single quote tool. |
| `webstore-pricing-page.js` | Custom-webstore page logic — drives AI chat (SSE to `/api/contract-webstore-ai/chat`). **DUAL-MODE**: parses PRICE_QUOTE with `productType: "webstore-setup"` (renders cream/navy store-quote card) OR `"fundraiser-item"` (renders deep-purple sell-price card with breakdown + 1099-NEC warning). Renders `web_search` tool results inline as a list of linked sources (Tavily-backed). Saves to `quote_sessions` with WEB prefix. Mirrors sticker pattern (2 product lines / 1 chat). |
| `dtg-quote-page.js` | DTG quote-builder page logic — drives AI chat (SSE to `/api/dtg-quote-ai/chat`). Renders deep-green `.dtg-quote-card` for the live DTG price, `.top-seller-card` recommendation cards inline when bot calls recommend_top_sellers, web-search result cards (Tavily). **First bot with a frontend "Submit to ShopWorks" button** that POSTs to `/api/submit-order-form` (same payload shape as the order form's shopworks.js). Bot collects designNumber during intake; push button gates on it. Saves with DTG prefix. |

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

## Art Hub Dashboard

| File | Purpose |
|------|---------|
| `art-actions-shared.js` | Shared art action modals (Log Time, Mark Complete, Send Mockup, Time Log) — `window.ArtActions` namespace, used by art-hub-steve.js + art-request-detail.js |
| `art-hub-steve.js` | Steve's gallery card processing + notes panel — delegates modals to art-actions-shared.js |
| `ae-dashboard.js` | AE dashboard: tab switching, modals, dropdown, notification polling + toasts |
| `ae-submit-form.js` | AE submit form enhancements: swatches, model images, row numbers, submission notification |

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
| `names-numbers-service.js` | Names & Numbers roster API service (CRUD, Excel parse, OCR) |
| `names-numbers-controller.js` | Names & Numbers roster form UI controller (tabs, groups, import) |
| `names-numbers-dashboard.js` | Names & Numbers dashboard logic (search, filter, KPIs) |

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
- `features-bundle.js` — unreferenced Phase 2 feature experiment (never loaded)
- `hero-quantity-calculator.js` — unreferenced cap embroidery quantity UX (never loaded)
- `pricing-matrix-capture-fix.js` — unreferenced DTG matrix capture workaround (superseded)
