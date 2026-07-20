# shared_components/js/ — File Guide

**124 JavaScript files** organized by function. Updated 2026-02-27.

## Quote Builder System (shared across all builders)

| File | Purpose |
|------|---------|
| `base-quote-service.js` | Base class for all quote save/email services |
| `quote-builder-base.js` | **RETIRED → pointer stub (2026-07-08)** — the ONE base lives at `builders/shared/quote-builder-base.js`; per-method adapters implement the MethodAdapter contract (`builders/emb/adapter.js` first) |
| `builders/emb/index.js` | **ESM entry point (roadmap 0.1/0.4)** — the ONE sanctioned window re-export surface for the EMB decomposition (eslint-enforced); runs before DOMContentLoaded. Extracted so far: `pricing.js`, `design-search.js`, `spr-modal.js`, `shopworks-import.js`, `persistence.js`, output.js. Map → memory/emb-decomposition-plan.md |
| `builders/emb/pricing.js` | **Extraction #0 (2026-07-07)** — Service_Codes fees: `loadServiceCodePrices()` (window._serviceCodes cache = cross-file contract) + `getServicePrice(code, fallback)` (live price, fallback + visible toast on API failure). Becomes the only module talking to the pricing APIs |
| `builders/emb/design-search.js` | **Extraction #1 (2026-07-07)** — design lookup/gallery modal (search, filters, batched grid, apply-to-logo-card, customer autofill). 15 window bridges via index.js; reset accessors for the monolith's customer-change/resetQuote paths |
| `builders/emb/spr-modal.js` | **Extraction #2 (2026-07-07)** — ShopWorks-import service-pricing-review modal (price source per item, EMB config, promise contract `showServicePricingReview()` → services/products/embConfig). 12 bridges; `getSprEmbConfigOptions()` accessor for the import cluster |
| `builders/emb/shopworks-import.js` | **Extraction #3 (2026-07-07)** — ShopWorks import flow (modal, parse/preview, 999-line confirm orchestrator, non-SanMar modal, banner). 11 bridges; imports spr-modal + design-search directly |
| `builders/emb/persistence.js` | **Extraction #4 (2026-07-07)** — autosave/draft/edit-load/duplicate (initEmbroideryPersistence, getEmbroideryQuoteData, restoreEmbroideryDraft, loadQuoteForEditing, populate*, duplicateQuote). 8 bridges; contract flags (window._restoringQuote) documented inline |
| `builders/emb/output.js` | **Extraction #5 (2026-07-07)** — output paths (buildEmbroideryPricingData → invoice contract, printQuote, embEmailQuote, quote text/copy, diagnoseQuote). 6 bridges |
| `builders/emb/save-push.js` | **Extraction #6 (2026-07-07)** — saveAndGetLink/_saveAndGetLinkInner (the save orchestrator) + push readiness/preview/confirm/verify. 11 bridges; push gates on THIS call's fresh save id (LESSONS 2026-07-04b) |
| `builders/emb/quote-lifecycle.js` | **Extraction #7 (2026-07-07)** — resetQuote/discounts/fees panel/tracking + the getAdditionalCharges/collectDECGItems collectors (real-imported by persistence/output/save-push). 13 bridges |
| `builders/emb/pricing-sync.js` | **Extraction #8 (2026-07-07)** — recalculatePricing (live export let, pre-wrapped w/ reprice pill) + display + AL/DECG/rush sync + tax/ship UI. 27 bridges; siblings real-import the live binding |
| `builders/emb/logo-config.js` | **Extraction #9 (2026-07-07)** — stitch/logo/embellishment UI + `_syncALArrays` global-AL sync + notes badge. 18 bridges; siblings real-import |
| `builders/emb/product-rows.js` | **Extraction #10, final cluster (2026-07-07)** — search/rows/sizes/colors machinery (45 bridges; size-category engine, color picker, child rows). Siblings real-import its helpers |
| `builders/shared/quote-builder-base.js` | **QuoteBuilderBase (2026-07-08)** — the ONE base: lifecycle (setupPage → initPricingAndRoute → focus), loud pricing-failure path, adapter-contract validation at boot |
| `builders/emb/adapter.js` | **EmbAdapter (2026-07-08)** — MethodAdapter contract + the EMB init verbatim (services bar, customer panel wiring, ?edit/?duplicate/QQ/method-switch routing) |
| `builders/shared/quote-model.js` | **0.5 (2026-07-08)** — createQuoteItem + QuoteState store (line CRUD, totals, caps-vs-garments tierGroups). Zero price math |
| `builders/shared/errors.js` | **1.15 (2026-07-08)** — structural no-silent-wrong-price: `showErrorBanner` (persistent role=alert strip), `showFallbackPricingWarning` (persistent amber badge, accumulates labels), `safeExecute` (loud-failure wrapper), `assertPriceOrThrow` (money-math guard). Bridged to window by all 3 index.js; classic scripts call behind typeof guards. CSS in quote-builder-common.css |
| `builders/shared/service-codes.js` | **THE Service_Codes implementation (Batch 3.5, 2026-07-09)** — `loadServiceCodePrices()` (caches window._serviceCodes = cross-file contract) + `getServicePrice(code, fallback)` w/ visible-warning fallback. Bundled by EMB (via `emb/pricing.js` re-export) + SCP/DTF index bridges; the typeof-guarded utils copies are GONE |
| `builders/shared/color-dropdown-position.js` | **P1 (2026-07-10)** — pins the trio's color-picker dropdowns to viewport coords on open (ancestor overflow was CLIPPING them); flips upward near the bottom; one capture-phase scroll/resize re-pin per page |
| `builders/shared/size-constants.js` | **THE size↔ShopWorks-slot constants (Batch 7.5, 2026-07-09)** — EXTENDED_SIZES / SIZE_TO_SLOT / SIZE06_EXTENDED_SIZES graduated from identical emb+scp state.js copies (both now re-export; `size-constants-drift.test.js` locks the re-exports + the 2XL/XXL→Size05 invariants) |
| `dtg-canonical-pricing.js` | **THE DTG formula (Batch 6, 2026-07-09)** — UMD, vendored BYTE-IDENTICAL from `caspio-pricing-proxy/lib/dtg-canonical-pricing.js` (equality CI-enforced both repos). `window.DTGCanonicalPricing`; dtg-pricing-service.js + the DTG builder modules (builders/dtg) delegate ALL math here. NEVER edit this copy — edit the proxy file and re-copy |
| `builders/emb/state.js` | **0.5 (2026-07-08)** — embState (all EMB mutable state; 3 window-backed contract fields for classic consumers) + constants + the quoteState instance |
| `builders/dtg/index.js` | **DTG ESM entry point (decomposition COMPLETE 2026-07-09; base boot F1 same day)** — shared-error bridges + `QuoteBuilderBase(new DtgAdapter()).init()` boot. The page's ONLY builder script (dtg-inline-form.js monolith DELETED) |
| `builders/dtg/adapter.js` | **DtgAdapter (F1, 2026-07-09)** — MethodAdapter contract; form-core's init (wiring + ?edit/?duplicate routing, early returns) rides initPricingAndRoute verbatim like DTF; DTG now in adapter-contract.test.js + shared loud-pricing-failure lifecycle |
| `builders/dtg/state.js` | **Batch 5 (2026-07-09)** — the IIFE's 23 consts/caches + THE `state` object + `dtgIF` (cross-module reassigned lets) + window-backed `hasChanges` (quote-builder-utils contract; SCP pattern). API_BASE from APP_CONFIG only (Rule 6, loud on missing) |
| `builders/dtg/form-core.js` | **Batch 5 (2026-07-09)** — render/wire/init/readiness/preview + DOMContentLoaded boot + `window.DTGInlineForm` 14-method surface (dtg-catalog.js + dtg-quote-page.js consume it — byte-stable through the decomposition) |
| `builders/dtg/persistence.js` | **Batch 5 (2026-07-09)** — session draft save/restore, QuoteID, `loadSavedDtgQuoteForEdit` (edit/duplicate flows), `fillFromQuote` (chat bridge), resume/edit banners, resetForm |
| `builders/dtg/catalog-search.js` | **Batch 5 (2026-07-09)** — style/color/company/design comboboxes + fetches, design lightbox, inventory kick |
| `builders/dtg/pricing.js` | **Batch 5 (2026-07-09)** — bundle fetch/cache, tier resolution, live price rail (renderSummary); ALL math delegates through DTGPricingService → DTGCanonicalPricing (Batch 6) |
| `builders/dtg/tax-shipping.js` | **Batch 5 (2026-07-09)** — ship-fee/pickup sync + WA DOR tax recompute (10.2 fallback via service codes) |
| `builders/dtg/artwork.js` | **Batch 5 (2026-07-09)** — new-artwork upload (validate → Caspio hosted URL), thumbs, placement select |
| `builders/dtg/crm.js` | **Batch 5 (2026-07-09)** — customer history pill, contact picker, contact→state apply, terms mapping |
| `builders/dtg/utils.js` | **Batch 5 (2026-07-09)** — reps/dates/location helpers, bulk-size parser, escapeHtml/fmtMoney, dirty-flag marks |
| `builders/dtg/output.js` | **Batch 5 (2026-07-09)** — stock-overflow confirm modals, print/email quote, `submitToShopWorks` (+ retry card) |
| `builders/scp/index.js` | **SCP ESM entry point (decomposition COMPLETE 2026-07-08)** — 46 window bridges + `QuoteBuilderBase(new ScpAdapter()).init()` boot + `__scpState` handle. The page's ONLY builder script (monolith = tombstone) |
| `builders/scp/state.js` | **SCP S2 (2026-07-08)** — scpState (all SCP mutable state; window-backed childRowMap/hasChanges for shared classics) + constants + the quoteState instance |
| `builders/scp/adapter.js` | **ScpAdapter (2026-07-08)** — MethodAdapter contract + the SCP init verbatim (chips, service-code labels, safety recs, artwork, customer lookup, ?edit/?duplicate/QQ/method-switch routing); QoS configure at module tail |
| `builders/scp/print-config.js` | **SCP S1a (2026-07-08)** — `updatePrintConfig` (locations/ink colors/dark-garment/safety-stripes) + dark-garment nudge. Verbatim move |
| `builders/scp/persistence.js` | **SCP S1a (2026-07-08)** — draft autosave/restore, edit/duplicate load, QQ + method-switch prefills, resetQuote. Verbatim move; latent monolith bug preserved (`updateRowQuantityTotal` undefined on draft-restore path) |
| `builders/scp/product-rows.js` | **SCP S1a (2026-07-08)** — search/rows/size engine/color picker + child rows (dup-row auto-merge) + keyboard nav + click-away listener. Verbatim move; latent bug preserved (deleteRow tail calls EMB-only `updateCapLogoSectionVisibility`) |
| `builders/scp/pricing-sync.js` | **SCP S1b (2026-07-08)** — SCREENPRINT_TIERS + findPricingTier (web-quote-cart-parity byte-compares HERE) + recalculatePricing (live `export let`, reprice-pill wrapped) + display/tax/wholesale |
| `builders/scp/quote-lifecycle.js` | **SCP S1b (2026-07-08)** — additional charges, discount controls, fee-table renderer |
| `builders/scp/save-output.js` | **SCP S1b (2026-07-08)** — printQuote/buildScreenprintPricingData (scp-save-parity locks HERE) + saveAndGetLink + email/clipboard output |
| `builders/scp/push.js` | **SCP S1b (2026-07-08)** — one-click push + preview/confirm (push-button-binding locks HERE); push state stays shell-side until S2 |
| `builders/dtf/index.js` | **DTF ESM entry point (decomposition COMPLETE 2026-07-08)** — 12 window bridges + `QuoteBuilderBase(new DtfAdapter()).init()` boot + `__dtfState` handle. The page's ONLY builder script (monolith = tombstone) |
| `builders/dtf/state.js` | **DTF D2 (2026-07-08)** — dtfState (push flags; window-backed hasChanges) + sizeDetectionCache + quoteState instance (real state = `this.` on the class) |
| `builders/dtf/adapter.js` | **DtfAdapter (2026-07-08)** — contract + the DTF init verbatim (instantiate-then-wire → whole body in initPricingAndRoute) |
| `builders/dtf/quote-builder-class.js` | **DTF D1 (2026-07-08)** — the WHOLE DTFQuoteBuilder class verbatim (childRows Map = single money source; locked by dtf-childrow-state/dtf-size-upcharge-fallback) + reprice-pill prototype wrap |
| `builders/dtf/methods-{pricing,rows,locations,lifecycle,output}.js` | **Batch 4.2 (2026-07-09)** — the 69 class methods as 5 prototype mixins (verbatim bodies, `this.` intact; class assembles via Object.assign; childRows money contract untouched — dtf-childrow-state locks the prototype). quote-builder-class.js = constructor + assembly + reprice wrap (145 lines) |
| `builders/dtf/output.js` | **DTF D1 (2026-07-08)** — copy/print onclick wrappers + auto-% rush chip |
| `builders/dtf/push.js` | **DTF D1 (2026-07-08)** — one-click push + preview/confirm (push-button-binding locks HERE); push state on dtfState since D2 |
| `builders/dtf/product-rows.js` | **Batch 4.3 (2026-07-09)** — the classic dtf-quote-page.js row machinery migrated in: search/style change, color pickers, size inputs, extended-size child rows (childRowMap → dtfState + window accessor), delete/duplicate, thumbnails |
| `builders/dtf/page-ui.js` | **Batch 4.3 (2026-07-09)** — page shims + tax/fee/shipping renderers (updateTaxCalculation RENDERS computeFeesAndTotals) + email + save modal, migrated from the classic page script (now deleted; DTF page = bundle + services only) |
| `quote-builder-guided.js` | **Guided Quote shell (Phase B, 2026-07-07)** — 4-step flow (Products → Decoration → Customer → Review & send) over the TRIO's existing sections: tag-don't-wrap visibility (`data-guided-step` + `.guided-hidden`), exactly 2 id-preserving relocations (sidebar customer panel → step 3, action panel → step 4; hidden anchors restore), "Show everything" workbench toggle (localStorage `nwca-guided-mode`), push-readiness rows jump to the fixing step. Defensive no-op if any configured section is missing. DTG excluded (inline-form architecture) |
| `quote-builder-utils.js` | Shared utilities: escapeHtml, formatPrice, showToast, copyShareableUrl |
| `quote-cart-engine.js` | **Customer quote-cart engine (Phase 0, 2026-06-11)** — PURE orchestration (pooling, grouping, fees, honest-LTM, tier nudges, trace); zero price formulas: per-method adapters call the staff authorities (EMB calculator class / POST /api/dtg/quote-pricing / SCP service bundle + exact builder findPricingTier copy / DTFPricingService.calculatePriceForQuantity). `priceCart(cart)` + `singleItemPreview(item)`. Dual browser/Node; parity-locked by tests/unit/web-quote-cart-parity.test.js against memory/CUSTOMER_QUOTE_CART_DESIGN_2026-06.md worked examples |
| `quote-cart-store.js` | **Customer quote-cart store (Phase 2, 2026-06-11)** — `window.QuoteCartStore`: sessionStorage key `nwca.quoteCart.v1`, schema v1, 24h TTL (mismatch/expiry/corruption → silent reset). Stores items (style/color/qty/sizes/method/placement/inkColors) — **never prices**; the cart reprices via quote-cart-engine at render time. API: `add/updateQty/remove/clear/getItems/count/totalPieces/onChange` (same-tab pub/sub + `storage` events). Auto-wires masthead `[data-quote-badge]` elements (count into `[data-quote-badge-count]`, hidden at 0). Dual browser/Node; locked by tests/unit/quote-cart-store.test.js |
| `web-quote-service.js` | **Customer quote-cart save/share/email (Phase 3, 2026-06-11)** — `window.WebQuoteService`: WQ-prefix QuoteID via /api/quote-sequence/WQ (visible fallback); pre-save PARITY GATE (forceRefresh reprice, >1¢ move → `PRICING_CHANGED`, nothing saved); two-table save via proxy CRUD (quote_sessions Status 'Web Quote Request', SubtotalAmount===TotalAmount===engine grandTotal, TaxRate/TaxAmount 0, no method-specific columns; quote_items product rows per engine line + fee/service rows w/ EmbellishmentType 'fee'); FOOTING ASSERT (rows must foot to engine totals ±2¢ or abort); artwork upload (POST /api/files/upload, 20 MB); fire-and-forget EmailJS reusing `service_jgrave3/template_quote_email` (customer copy + sales@ alert); `dryRun` logs payloads instead of POSTing. ZERO price math — all dollars copied from QuoteCartEngine results. Dual browser/Node; locked by tests/unit/web-quote-service.test.js |
| `delivery-promise.js` | **Delivery-promise chips (BAW adoption #1, 2026-07-06)** — `window.DeliveryPromise.render(el, method)` fills "🚚 Order today — estimated to ship by {date}"; lead days from Service_Codes `LEAD-DAYS-*` (business days, Erik-tunable, one category fetch + 5-min cache), weekend-skip date math. FAIL-SOFT: missing row/fetch error hides the chip. Consumers: pdp-configurator renderTotalCard + quote-cart-page group cards |
| `quote-deposit-math.js` | **Online deposit money math (Storefront Checkout Phase 1, 2026-07-05)** — `computeDepositTerms({subtotal, shipping, taxRatePct, depositPct})`: WA tax on subtotal+shipping (cents-rounded before summing), grand total, deposit split, balance foots exactly. PURE dual browser/Node; the SERVER (enable-deposit endpoint) is authoritative — quote-view.js uses it only for the staff preview (depositPct:100 → grand total). depositPct comes from Service_Codes DEPOSIT-PCT, never hardcoded. Fail-closed on bad input. Locked by tests/unit/quote-deposit-math.test.js |
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
| `embroidery-quote-invoice.js` | **THE shared invoice/print engine for ALL 4 builders** (EMB/SCP/DTF/DTG — Rule 8; name is historical). Rate labels derive from CHARGED totals (always foot); underivable → Service_Codes `DD` via window.getServicePrice → $100 literal + console warning (Batch 7). Any change = 4-builder change |
| `embroidery-quote-pricing.js` | Pricing engine (tiers, LTM, stitch, FB) |
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
| `laser-tumbler-mockup.js` | Customer-facing logo mockup + instant quote on the laser tumbler page — reuses `jds-tumbler-template.js` engraving pipeline (page's 4 colors only), logo upload with customer-worded artwork warnings, drag/size canvas preview, PNG download, qty→price quote via `jds-api-service.js` formula pricing (no hardcoded prices). Hooked from `laser-tumbler-simple.js` (`onPageReady`/`onColorChanged`, optional-chained). |
| `design-thumbnail-service.js` | Design thumbnail resolution service |
| `sticker-pricing-service.js` | Sticker pricing fetcher (`/api/sticker-pricing`) — 50 SKUs (5 sizes × 10 qty tiers) with PartNumber. Used by the sticker quote page. |
| `sticker-pricing-page.js` | Sticker + Banner quote page logic — renders 5 sticker tables (`/api/sticker-pricing`) AND banner rate-card grid (`/api/banner-pricing`); drives AI chat (SSE to `/api/contract-sticker-ai/chat`, handles BOTH product lines); parses PRICE_QUOTE/CUSTOMER_FINAL/EMAIL DRAFT blocks; highlights sticker rows OR banner rate cards based on `productType`; renders inline banner-quote card; saves to `quote_sessions` with STK prefix. |
| `emblem-pricing-service.js` | Embroidered emblem pricing fetcher (`/api/emblem-pricing`). |
| `emblem-pricing-page.js` | Embroidered emblem patch quote page logic — renders 16×10 pricing grid (`/api/emblem-pricing`); drives AI chat (SSE to `/api/contract-emblem-ai/chat`); parses PRICE_QUOTE/CUSTOMER_FINAL/EMAIL DRAFT blocks; highlights pricing-grid cells on AI quote; renders inline emblem-quote card with order total + LTM note; saves to `quote_sessions` with PATCH prefix. Mirrors sticker-pricing-page.js exactly — single product line, single quote tool. |
| `webstore-pricing-page.js` | Custom-webstore page logic — drives AI chat (SSE to `/api/contract-webstore-ai/chat`). **DUAL-MODE**: parses PRICE_QUOTE with `productType: "webstore-setup"` (renders cream/navy store-quote card) OR `"fundraiser-item"` (renders deep-purple sell-price card with breakdown + 1099-NEC warning). Renders `web_search` tool results inline as a list of linked sources (Tavily-backed). Saves to `quote_sessions` with WEB prefix. Mirrors sticker pattern (2 product lines / 1 chat). |
| `dtg-quote-page.js` | DTG quote-builder page logic — drives AI chat (SSE to `/api/dtg-quote-ai/chat`). Renders deep-green `.dtg-quote-card` for the live DTG price, `.top-seller-card` recommendation cards inline when bot calls recommend_top_sellers, web-search result cards (Tavily). **First bot with a frontend "Submit to ShopWorks" button** that POSTs to `/api/submit-order-form` (payload shape inherited from the retired Order Form's client). Bot collects designNumber during intake; push button gates on it. Saves with DTG prefix. |

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
| `sanmar-invoice-viewer.js` | Shared SanMar invoice modal (`SanMarInvoiceViewer.open`) — on-screen invoice + Print/Save PDF; used by Purchasing Portal + AE Mission Control |

## Art Hub Dashboard

| File | Purpose |
|------|---------|
| `art-actions-shared.js` | Shared art action modals (Log Time, Mark Complete, Send Mockup, Time Log) — `window.ArtActions` namespace, used by art-hub-steve.js + art-request-detail.js |
| `art-hub-steve.js` | Steve's gallery card processing + notes panel — delegates modals to art-actions-shared.js |
| `ae-dashboard.js` | AE dashboard: tab switching, modals, dropdown, notification polling + toasts |

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
| `sanmar-inventory-check.js` | SanMar per-size inventory check + `classifyInventory()` (`window.OrderFormInventory` — legacy global name kept). Moved 2026-07-11 from `pages/order-form/inventory/` when the Order Form was retired; powers stock badges in all 4 builders (EMB/SCP/DTF via inventory-badges.js, DTG direct) |
| `sample-pricing.js` | Dual-load blank-sample pricing math — browser buttons + server /api/samples/create-checkout-session reprice share it (jest-locked, 2026-07-06) |
| `sample-cart-service.js` | Sample-program engine (eligibility/pricing via sample-pricing.js, sessionStorage cart, `window.sampleCart`) — extracted 2026-07-06 from the retired top-sellers-showcase page; used by /catalog Top Sellers view + product.html |
| `samples-order-payload.js` | Pure ManageOrders push payload for PAID sample orders (Stripe payments block → lands in ShopWorks PAID); consumed by server.js webhook 'samples-order' branch (jest-locked, 2026-07-06) |
| `observability.js` | **1.10 (2026-07-08)** Browser Sentry init (4 builders): early-error buffer + /api/version config (no DSN → OFF) + release/tenant/method tags + inline PII scrub (twin of lib/sentry-scrub.js). Loads right after vendor/sentry/bundle.min.js in `<head>`; never load-bearing |
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

## blog-teaser.js (2026-07-12)
Homepage "From the blog" section (index.html). Fetches the 3 newest Published posts from the proxy's public `/api/blog-posts` and renders blog.css cards into `#blogTeaserGrid`; the `#blogTeaser` section stays `[hidden]` unless posts actually render (failed/empty fetch = untouched homepage). Needs `/config/app.config.js` loaded first. The SSR `/blog` pages carry the SEO — this is décor only.
