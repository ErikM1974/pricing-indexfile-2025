# Active Files Registry
**Last Updated:** 2026-07-23
**Total Active Files:** 587 (HTML+JS+CSS, excludes `node_modules/`, `.git/`, `tests/`, `.claude/`, `archive-working-files/`)
**Purpose:** Track all active files to prevent orphaned code accumulation
**Audit cadence:** Quarterly. Bump the timestamp on every file create/delete/move (CLAUDE.md Top 8 Rule #5).

## ⚠️ Root Directory JavaScript Files (Legacy Location)

**Note:** These files are still in root directory for historical reasons. They should eventually move to `/shared_components/js/` but currently index.html depends on these paths.

**⚠️ IMPORTANT:** DO NOT MOVE these files without updating all HTML references. index.html has hardcoded paths to these root files.

| File | Purpose | Used By | Future Action |
|------|---------|---------|---------------|
| `favicon.png` / `favicon.ico` / `apple-touch-icon.png` | Self-hosted site icon — NWCA circle/tee mark (refreshed 2026-07-13 from Erik's logo). favicon.png 48×48, favicon.ico multi-size 16/32/48 PNG-in-ICO, apple-touch-icon 180×180 for iOS. SERP favicon (old cdn.caspio.com URL is robots-blocked so Google showed a globe); served by explicit server.js routes | every page + Google Search + iOS home screen | ✅ Active (icon updated 2026-07-13) |
| `app-modern.js` | Main application logic | index.html | Move to shared_components |
| `app-new.js` | New app version | Unknown | Verify if needed |
| `autocomplete-new.js` | Search autocomplete | index.html | Move to shared_components |
| `brands.js` | Brands listing page logic | brands.html | Move to shared_components |
| `brands-flyout.js` | Brands flyout/dropdown menu (header nav) | index.html, multiple | Move to shared_components |
| `shared_components/js/nav-dropdown.js` | CLICK-to-open disclosure for the Products/Brands mega dropdowns — toggles `.nav-open`, closes on outside-click/Escape/other-trigger, one open at a time, `aria-expanded`. Replaced hover-open (finicky on desktop, absent on touch); CSS has NO `:hover` open rule | index.html, pages/catalog.html; CSS `.nav-item.nav-open` in nwca-2026-core.css | ✅ Active (NEW 2026-07-13) |
| `c112-bogo-promo.js` | BOGO promotion logic | Specific promo | Move to calculators |
| `cart.js` | Cart functionality | NONE (cart.html retired 2026-06-11) | 🚩 Dead — flagged for deletion |
| `cart-ui.js` | Cart UI components | NONE (cart.html retired 2026-06-11) | 🚩 Dead — flagged for deletion |
| `cart-price-recalculator.js` | Price recalculation | NONE (cart.html retired 2026-06-11) | 🚩 Dead — flagged for deletion |
| `catalog-search.js` | Catalog search | index.html | Move to shared_components |
| `home-2026.js` | Homepage chrome glue (drawer close/Escape/scroll-lock, All-categories tile) — 2026 redesign | index.html | ✅ Active (NEW 2026-06-11) |
| `dp5-helper.js` | Helper functions (root copy — see also `/shared_components/js/dp5-helper.js`) | Unknown | Verify if needed |
| `order-form-pdf.js` | PDF generation | NONE (cart.html retired 2026-06-11) | 🚩 Dead — flagged for deletion |
| `pricing-matrix-api.js` | Pricing API (root copy — see also `/shared_components/js/pricing-matrix-api.js`) | NONE (cart.html retired 2026-06-11; calculators use the shared_components copy) | 🚩 Dead — flagged for deletion |
| `product-search-service.js` | Product search | index.html, multiple | Move to shared_components |
| `utils.js` | Utility functions | Multiple pages | Move to shared_components |

### Root-Level HTML & Backend (not migrated to subdirs)

| File | Purpose | Notes | Status |
|------|---------|-------|--------|
| `/BUILDER_A_GRADE_PLAN.md` | **NEW (2026-07-08)** Executable plan taking each quote builder's CODE to A-grade (7 batches: correctness → safety net → EMB/DTF/DTG structure → formula collapse → polish); evidence file:lines from 5 parallel audits. Companion to `A_PLUS_ROADMAP_FOR_FABLE.md` | Erik go/cherry-pick pending | 📖 Plan |
| `/index.html` | Main catalog page | See "Main Pages" section | ✅ Active |
| `/product.html` | Product display page | See "Main Pages" section | ✅ Active |
| `/brands.html` | Brands listing page | brands.js, brands.css, brands-flyout.js | ✅ Active |
| `/staff-dashboard-v3/index.html` | Staff dashboard (V3 — sole canonical, served at `/staff-dashboard.html`) | See "Dashboard & Admin" section | ✅ Active |
| `/staff-dashboard-v3/art-aging-widget.js` | Hub "Art Requests Needing Attention" card — aging counts (>7d red / 3-7d yellow) + 5 oldest, lazy-loaded, self-contained (2026-07-05) | config.js, caspio-date-utils.js, /api/artrequests | ✅ Active |
| `/emailjs-template-mockup-customer-approval.html` | EmailJS HTML template — customer mockup approval email body | EmailJS service | ✅ Active |
| `/server.js` | Express server (port 3000) — routes for `/api/submit-order-form`, `/api/3-day-tees-checkout`, etc. | Express, EmailJS, Stripe, Caspio proxy | ✅ Active |
| `/lib/quote-snapshot-diff.js` | **NEW (2026-06-26)** `diffSnapshots()` + helpers (`WATCHED_ORDER_FIELDS`, `normalizeForDiff`, `sizeColsOf`) extracted from server.js so the SW-snapshot change-detection is unit-testable (server.js boots on require). Now also diffs per-size `Size01..06` → `LineSizes[...]` change rows. | required by server.js (sync-from-shopworks) | ✅ Active |
| `/lib/asset-manifest.js` | **NEW (2026-07-07, roadmap 0.1)** Pure helpers for the esbuild pipeline: `rewriteHtmlAssets(html, manifest)` swaps builder-page `src`/`href` (± legacy `?v=`) to hashed `/dist` URLs; `cssHasRelativeUrls()` (files with relative `url()` refs are left unhashed); mtime-cached manifest/HTML loaders. No manifest → pages fall through to source paths (build is an overlay, never a gate). | required by server.js (builder-page rewrite); locked by tests/unit/build/asset-manifest.test.js | ✅ Active |
| `/config/app.config.js` | **RESTRUCTURED (2026-07-07, roadmap 0.3)** Seeds `window.TENANT` (default NWCA tenant — the ONLY allowed home for the proxy host + EmailJS ID literals, Rule 6) and defines `window.APP_CONFIG` as a compatibility shim whose API/EMAIL/COMPANY/ERRORS values DELEGATE to TENANT via getters. Pages that never load tenant.js behave exactly as before. | consumed by every page; builder pages pair it with config/tenant.js | ✅ Active |
| `/config/tenant.js` | **NEW (2026-07-07, roadmap 0.3)** Runtime tenant resolution + hydration: `?tenant=<id>` (dev/demo) or hostname → GET `/api/tenants/:id/config` → deep-merge into `window.TENANT` → `tenant:loaded` event + `TENANT.ready` promise. Hydration failure keeps the seeded default and logs loudly. Loads right after app.config.js on the 3 builder pages. | app.config.js (seeds TENANT), server.js `/api/tenants/:id/config` | ✅ Active |
| `/config/tenants/nwca.json` | **NEW (2026-07-07, roadmap 0.3)** Default tenant config (branding/api/email/tax/methods/currency/units) — mirrors the seeded defaults in app.config.js. | served by GET /api/tenants/nwca/config | ✅ Active |
| `/config/tenants/demo.json` | **NEW (2026-07-07, roadmap 0.3)** Demo tenant overlay (Cascade Custom Threads branding, flat-0 tax display, DTG off) proving runtime white-label with zero code change (`?tenant=demo`). Deliberately omits `api`/`email` so pricing still flows through the NWCA proxy; the fully standalone demo stack is roadmap 2.7. | served by GET /api/tenants/demo/config | ✅ Active |
| `/scripts/build.js` | **NEW (2026-07-07, roadmap 0.1)** esbuild pipeline: minifies+content-hashes every local .js/.css the 3 builder HTMLs reference (transform mode — top-level symbols never renamed, so inline `onclick=` keeps working) + bundles the `builders/{emb,scp,dtf}/index.js` ESM entries to IIFE; emits `/dist` + `dist/asset-manifest.json`. Deterministic hashes (no-op rebuild = identical). Strips `console.log/debug/info` + `debugger` (KEEPS warn/error per Erik's #1 rule). Runs via `npm run build` / `prestart` / `heroku-postbuild`; exits 0 without esbuild when dist exists (Heroku dyno boot after devDep prune). | esbuild (devDep), lib/asset-manifest.js | ✅ Active |
| `/robots.txt` | Crawler rules — staff/internal paths + credential share-links disallowed (2026-06-11) | served via server.js `/robots.txt` route | ✅ Active |
| `/jest.config.js` | Jest test runner config (used by `tests/jest/`) | Jest | ⚙️ Tooling |
| `/eslint.config.mjs` | **NEW (2026-07-07, roadmap 0.6)** ESLint flat config scoped to NEW code only (`builders/**`, `lib/`, `scripts/build.js`, `config/tenant.js`) — legacy grandfathered, scope widens as 0.4 migrates modules. Bans new `window.X=` outside `builders/*/index.js` (strangler re-export surface); `eslint-plugin-no-unsanitized` guards innerHTML sinks. Run: `npm run lint`. | eslint 9 (devDep) | ⚙️ Tooling |
| `/tsconfig.json` | **NEW (2026-07-07, roadmap 0.6)** JSDoc typecheck (`checkJs`, noEmit — NO TS migration) over `builders/**` + `lib/` + `types/*.d.ts`. Run: `npm run typecheck`. | typescript (devDep) | ⚙️ Tooling |
| `/shared_components/js/types/quote.d.ts` | **NEW (2026-07-07, roadmap 0.6)** Shared typedefs: QuoteItem, SizeQty, TierConfig, ServiceCodePrice, PricingResult (singleItemPreview shape), MethodAdapter (0.4 adapter contract). | consumed via JSDoc imports in builders/** | ✅ Active |
| `/shared_components/js/types/globals.d.ts` | **NEW (2026-07-07, roadmap 0.6)** Window extensions (TENANT/APP_CONFIG/__QB_BUILD) + the TenantConfig shape. | tsconfig typecheck | ✅ Active |
| `/.prettierrc.json` + `/.prettierignore` | **NEW (2026-07-07, roadmap 0.6)** Prettier for NEW code only (ignore-all + allowlist mirrors the eslint scope) — never bulk-format legacy files. | prettier (devDep) | ⚙️ Tooling |
| `/.github/workflows/ci.yml` | **NEW (2026-07-07, roadmap 0.6)** GitHub Actions on PR + push (develop/main): test job (npm ci → build → test:unit incl. both parity locks + the no-hardcoded-hosts guard) + lint + typecheck; npm audit advisory (15 pre-existing vulns — tighten once cleared). ⚠️ Branch-protection required checks = Erik, GitHub settings. | GitHub Actions | ✅ Active |
| `/.github/dependabot.yml` | **NEW (2026-07-07, roadmap 0.6)** Weekly npm dependency PRs, dev-tooling grouped. | GitHub | ✅ Active |

### Root-Level Stylesheets (legacy location)

| File | Purpose | Used By | Future Action |
|------|---------|---------|---------------|
| `main.css` | Primary global styles | NONE (index.html moved to nwca-2026.css 2026-06-11) | 🚩 Dead — flagged for deletion |
| `main-redesign.css` | 2025 redesign styles | brands.html ONLY (index.html moved to nwca-2026.css 2026-06-11) | ⚠️ Retire after brands.html migrates |
| `cart-styles.css` | Cart page styles | NONE (cart.html retired 2026-06-11) | 🚩 Dead — flagged for deletion |
| `gallery-styles.css` | Product gallery styles | NONE (no HTML links it, verified 2026-06-11) | 🚩 Dead — flagged for deletion |
| `pricing-pages.css` | Shared pricing page styles | Pricing pages | Move to shared_components |
| `pricing-pages-enhanced.css` | Enhanced pricing page styles | Pricing pages | Move to shared_components |
| `product-styles.css` | Product page styles | product.html | Move to shared_components |
| `modern-search-interface.css` | Modern search UI styles | NONE (no HTML links it, verified 2026-06-11) | 🚩 Dead — flagged for deletion |
| `catalog-search.css` | Catalog search base styles (autocomplete, product cards) — skinned by nwca-2026.css | index.html | ✅ Active |
| `/shared_components/css/nwca-2026-core.css` | **NEW** 2026 design system CORE — tokens/base, buttons/chips, masthead + mega-nav, drawer, footer, interior-page primitives (page header, forms, tables, alerts, toasts, badges, pager, skeletons, cards, modal base, empty state). Load FIRST on every 2026-system page. Class reference: `NWCA-2026-GUIDE.md` | index.html (+ all interior pages migrating per memory/CUSTOMER_SITE_REDESIGN_2026-06.md) | ✅ Active (NEW 2026-06-11, split from nwca-2026.css) |
| `/shared_components/css/nwca-2026.css` | 2026 design system HOMEPAGE layer ("press-room editorial" green refresh) — hero, homepage bands, catalog results layer, quick-view/compare modals. REQUIRES nwca-2026-core.css loaded first | index.html only | ✅ Active (NEW 2026-06-11; core layers split out 2026-06-11) |
| `/shared_components/css/NWCA-2026-GUIDE.md` | **NEW** Class reference for nwca-2026-core.css interior-page primitives (one snippet per primitive) — read this instead of the CSS when building pages | Developers building 2026-system pages | 📖 Docs (NEW 2026-06-11) |
| `brands.css` | Brands page styles | brands.html | Move to shared_components |

## 🎯 Core Entry Points

### Main Pages
| File | Purpose | Dependencies | Status |
|------|---------|--------------|--------|
| `/index.html` | Main catalog page | app-modern.js, product-search-service.js, catalog-search.js, autocomplete-new.js | ✅ Active |
| `/product.html` | Product detail (2026 redesign) — gallery, swatches, live inventory, 3-question decoration CONFIGURATOR (qty → placement → priced method chips) gated by method eligibility; tier matrix demoted to "See every quantity price" expandable; "Add to quote" CTA + masthead quote badge + toast (Phase 2 quote-cart) | product/js/product-2026.js, product/js/pdp-configurator.js, product/css/product-2026.css, nwca-2026-core.css, decoration-methods.js, quote-cart-engine.js, quote-cart-store.js, embroidery-quote-pricing.js, dtf-quote-pricing.js, 5 shared pricing services | ✅ Active (quote-cart Phase 2 2026-06-11) |
| `/product/css/product-2026.css` | Page-layer CSS for product.html on nwca-2026 system (incl. `.pdp-cfg-*` configurator styles + `.pdp-cfg-actions` add-to-quote block) | nwca-2026-core.css | ✅ Active |
| `/product/js/product-2026.js` | product.html page logic: product/inventory/related fetch, eligibility lookup (DecorationMethods), SEO/JSON-LD, CTA mailto built from the configurator selection; Add-to-Quote wiring (pooling-scope conflict guard + toast w/ "View quote (N)" link — zero price math, selection from PdpConfigurator.getSelection); hands all pricing UI to PdpConfigurator | DecorationMethods, PdpConfigurator, QuoteCartStore | ✅ Active |
| `/product/js/related-posts.js` | PDP "This style on our blog" block — fetches /api/blog-product-map (style→published posts, live-derived server-side), reveals #blogPostsSection when the style is featured; progressive enhancement (hidden on any failure), createElement/textContent only | /api/blog-product-map (server.js + lib/blog.js productMap) | ✅ Active (NEW 2026-07-12) |
| `/product/js/pdp-configurator.js` | 3-question decoration configurator (Phase 1 quote-cart): qty stepper, placement chips (garment/cap), SCP ink stepper, per-method priced chips + total/LTM-honesty/nudge via QuoteCartEngine.singleItemPreview (zero local price math), location-aware tier-matrix expandable, per-chip visible error states; getSelection() exposes status/engineMethod/sizes for the Add-to-Quote flow | QuoteCartEngine + EmbroideryPricingCalculator + DTFConfig + EMB/CAP/DTG/SCP/DTF PricingService globals | ✅ Active (NEW 2026-06-11) |
| `/pages/catalog.html` | Dedicated customer catalog (URL state, facets, quick view, category landing) — served at `/catalog`; masthead quote badge (markup + quote-cart-store.js script only — catalog-2026.js untouched) | nwca-2026-core.css, catalog-2026.css/js, product-search-service.js, decoration-methods.js, app-modern.js, brands-flyout.js, quote-cart-store.js | ✅ Active (badge 2026-06-11) |
| `/pages/css/catalog-2026.css` | Catalog page layer CSS (facet rail + mobile filter drawer, cards, autocomplete v2) | nwca-2026-core.css | ✅ Active |
| `/pages/js/catalog-2026.js` | Catalog logic: URL state, facets (incl. `?method=` Decoration filter from the decoration-methods rules feed), server-price-only cards, autocomplete v2 w/ thumbnails, quick view | product-search-service.js (read-only), DecorationMethods | ✅ Active |
| `/pages/quote-cart.html` | Customer cart page (clean URL `/quote-cart`) — per-print-type group cards (pooled qty + tier badge + tier-progress meter), qty steppers, engine service/fee/LTM rows, amber tier nudges, totals panel (engine grandTotal ONLY — withheld w/ visible error when any group fails), Email-instead mailto, empty state. **Phase 3 (2026-06-11): "Save & email my quote" — slide-down form + per-group artwork upload + frozen WQ save (web-quote-service.js) + share-link success panel + EmailJS notifications** | nwca-2026-core.css, quote-cart.css, quote-cart-page.js, quote-cart-store.js, quote-cart-engine.js, web-quote-service.js, EmailJS SDK + authorities (embroidery-quote-pricing.js, screenprint-pricing-service.js, dtf-pricing-service.js, dtf-quote-pricing.js) | ✅ Active (Phase 3 2026-06-11) |
| `/pages/css/quote-cart.css` | Quote-cart page layer CSS (group cards, tier-progress meter, line rows + steppers, fee rows, amber nudge box, sticky totals rail; Phase 3 save panel: slide-down form, artwork fieldset, spinner, share-link success block; 375px single-column) | nwca-2026-core.css | ✅ Active |
| `/pages/js/quote-cart-page.js` | Quote-cart page logic: reprice via QuoteCartEngine.priceCart on every load + after every store mutation (ZERO local price math); group cards render engine results verbatim (baked-LTM honest lines foot via full-precision effectiveUnit, SCP itemized fees), per-group error card + Retry + grand-total withholding, qty steppers → QuoteCartStore.updateQty, mailto from the grouped summary. **Phase 3: save-panel state machine (form → saving → success, PRICING_CHANGED re-confirm), per-group artwork picks (20 MB image/pdf; upload failure = visible warning, save continues), localhost-gated `?dryrun=1`, fire-and-forget emails** | QuoteCartEngine, QuoteCartStore, WebQuoteService, EmbroideryPricingCalculator + DTFConfig + SCP/DTF services | ✅ Active (Phase 3 2026-06-11) |

### Secondary Pages (/pages/ directory)
| File | Purpose | Dependencies | Status |
|------|---------|--------------|--------|
| `/pages/forms/nwca-form-shared.css` | **NEW (2026-07-11)** Shared framework for ALL fillable form twins in /pages/forms/ — toolbar, sheet (portrait + `--landscape`), section bars, info grids, checkbox rows, `.form-table` base, waiver box, signatures, print rules (@page orientation stays per-form). Green #256a42 sampled from the official PDFs. | — | ✅ Active |
| `/pages/forms/nwca-form-shared.js` | **NEW (2026-07-11)** Shared form behaviors — `NWCAForm.init({onAfterClear})` + `markClean()`: print button, confirm-guarded Clear, dirty beforeunload guard (cleared after print/save). | — | ✅ Active |
| `/pages/forms/nwca-form-contacts.js` | **NEW (2026-07-11)** Customer lookup for ALL 5 twins — type-ahead on Company/Customer via proxy `GET /api/company-contacts-2026/search` (company row + contact sub-rows; picking fills fldCompany/Contact/Phone/Email/CustomerNum/SalesRep/Ae where present). Manual typing always works; lookup failure shows "type manually", never blocks. | APP_CONFIG, /api/company-contacts-2026/search | ✅ Active |
| `/pages/forms/nwca-form-save.js` | **NEW (2026-07-11)** "Save to NWCA" for the 4 saving twins (NOT box label) — injects toolbar button, per-form `build()` serializer → `POST /api/form-submissions` (public, rate-limited), success banner with Submission_ID, red NOT-saved banner on failure (typed data preserved). Normalizes free-text dates → ISO for Inbox due-date math. ⚠️ sample-checkout serializer NEVER reads the card section (server re-strips, jest-locked). | APP_CONFIG, NWCAForm, /api/form-submissions | ✅ Active |
| `/pages/forms/nwca-form-styles.js` | **NEW (2026-07-11, v2 same day)** SanMar style lookup for form twins — per-row type-ahead via `/api/stylesearch`; pick fills Description + a SWATCH color picker (COLOR_SQUARE_IMAGE grid, built once/never regenerated mid-hover; CATALOG_COLOR remembered per row for the ShopWorks push); `loadSizes()` (`/api/sizes-by-style-color`) + `loadUpcharges()` (`/api/max-prices-by-style` sellingPriceDisplayAddOns = Caspio `Standard_Size_Upcharges`) power the AE form's dynamic size chips; "type manually" always available | APP_CONFIG, /api/stylesearch, /api/product-colors, /api/sizes-by-style-color, /api/max-prices-by-style | ✅ Active |
| `/pages/forms/nwca-form-dates.js` | **NEW (2026-07-11)** Hybrid 📅 date pickers — date fields stay free-text ("ASAP" works) with a button opening the native picker (writes M/D/YYYY); `today()`/`plusDays()` power auto-dates (sample checkout +14 due/+17 grace; today-defaults on drop-off/artwork/QC/spoilage/maintenance/AE) | — | ✅ Active |
| `/pages/forms/nwca-form-designs.js` | **NEW (2026-07-11)** Digitized-design lookup — type-ahead on Logo/Artwork via `/api/digitized-designs/search-all` (customer-scoped when a customer # was captured); picking stores `dataset.designNumber` so the AEO→ShopWorks push LINKS the design (id_Design + method design type) | APP_CONFIG, /api/digitized-designs/search-all | ✅ Active |
| `/pages/forms/ae-order-intake-form.html` | **NEW (2026-07-11)** Fillable twin of the AE Customer Order Intake PDF — customer lookup, SanMar style/color assist per line, auto math (sizes→Qty→Line→Subtotal→Tax→Total→Balance; Unit Price deliberately MANUAL per Rule 9 — records the AE's quoted decorated price), DOR tax-rate lookup button (never hardcoded), Save to NWCA (AEO → Forms Inbox). Portrait print. | nwca-form-shared.css/js, nwca-form-contacts.js, nwca-form-styles.js, nwca-form-save.js, ae-order-intake-form.css/js | ✅ Active |
| `/pages/forms/ae-order-intake-form.css` | AE intake page-specifics (13-col order table widths, fulfillment + money stack, tax-lookup row, verified-color tick) | nwca-form-shared.css | ✅ Active |
| `/pages/forms/ae-order-intake-form.js` | AE intake controller — 4 seeded rows + Add Row, style/color assist wiring, auto-math chain w/ per-field manual override, POST /api/tax-rates/lookup suggestion, AEO save serializer (Catalog Color column persisted per row) | nwca-form-shared.js, nwca-form-contacts.js, nwca-form-styles.js, nwca-form-save.js | ✅ Active |
| `/pages/forms/box-label-form.html` | **NEW (2026-07-11)** Fillable twin of the 8.5×11 Box Label — BIG shop-floor text, boxed fields, orange Drop-Dead Date, huge Customer field with lookup, 6-row style grid with auto row totals. PRINT-ONLY (no save — the box is the record). | nwca-form-shared.css/js, nwca-form-contacts.js, box-label-form.css/js | ✅ Active |
| `/pages/forms/box-label-form.css` | Box label page-specifics (portrait @page, big-type boxed inputs, orange drop-dead, grid column widths) | nwca-form-shared.css | ✅ Active |
| `/pages/forms/box-label-form.js` | Box label controller — 6 style rows + Add Row, per-row auto-total (manual wins), customer lookup fills the Customer box | nwca-form-shared.js, nwca-form-contacts.js | ✅ Active |
| `/pages/forms/maintenance-log-form.html` | **NEW (2026-07-11)** ONE fillable page for all SIX equipment maintenance logs (`?type=embroidery\|kornit\|heat-press\|laser\|roland\|compressor`) — identity block, maintenance-type checks, per-equipment 14-task Done/N-A checklist + readings (mirroring each official PDF's AcroForm fields exactly), issues/action, machine status, sign-off. Saves MNT → Forms Inbox; Next Service Due = submission due date (feeds the "Due in 7 days" stat). | nwca-form-shared.css/js, nwca-form-save.js, maintenance-log-form.css/js | ✅ Active |
| `/pages/forms/maintenance-log-form.css` | Maintenance log page-specifics (equipment-type chip switcher, task checklist table, sign-off grid) | nwca-form-shared.css | ✅ Active |
| `/pages/forms/maintenance-log-form.js` | Maintenance log controller — 6 equipment configs (task lists + readings extracted from the PDFs), type switcher w/ confirm, Done/N-A row exclusivity, MNT save serializer (equipment ID rides in the Company column) | nwca-form-shared.js, nwca-form-save.js | ✅ Active |
| `/pages/forms/qc-checklist-form.html` | **NEW (2026-07-11)** Fillable twin of the Final QC Checklist PDF — 14-point OK/FAIL/N-A inspection (exclusive per row), decoration checks, quantity verification table (+Add Row), exceptions, exclusive final disposition (RELEASE/HOLD/REWORK/PARTIAL/REJECT), inspector sign-off. Saves QCC → Forms Inbox (fails called out in summary). | nwca-form-shared.css/js, nwca-form-contacts.js, nwca-form-save.js, qc-checklist-form.css/js | ✅ Active |
| `/pages/forms/qc-checklist-form.css` | QC checklist page-specifics (OK/FAIL/N-A columns, red FAIL accent, disposition row) | nwca-form-shared.css | ✅ Active |
| `/pages/forms/qc-checklist-form.js` | QC controller — 14 items w/ mark exclusivity, qty table, exclusive disposition, QCC save serializer | nwca-form-shared.js, nwca-form-contacts.js, nwca-form-save.js | ✅ Active |
| `/pages/forms/spoilage-report-form.html` | **NEW (2026-07-11)** Fillable twin of the Spoilage/Damage & Reprint PDF — where-found + cause checks, item rows with per-row Loss = Qty × (Garment + Decoration cost) (manual wins) rolling into Estimated Total Loss, SanMar style lookup per row, root cause / corrective action, replacement & resolution block. Saves SPL → Forms Inbox (loss $ in summary). | nwca-form-shared.css/js, nwca-form-contacts.js, nwca-form-styles.js, nwca-form-save.js, spoilage-report-form.css/js | ✅ Active |
| `/pages/forms/spoilage-report-form.css` | Spoilage report page-specifics (items table, loss-total row) | nwca-form-shared.css | ✅ Active |
| `/pages/forms/spoilage-report-form.js` | Spoilage controller — loss auto-math, style lookup wiring, SPL save serializer | nwca-form-shared.js, nwca-form-styles.js, nwca-form-save.js | ✅ Active |
| `/pages/forms/customer-onboarding-form.html` | **NEW (2026-07-11)** New Customer Onboarding — company (existing-customer duplicate guard via contacts lookup), contacts, addresses (same-as-billing copy), tax status + terms checks, decoration profile, office setup checklist. Fill-online only (no source PDF). Saves ONB → Forms Inbox. | nwca-form-shared.css/js, nwca-form-contacts.js, nwca-form-dates.js, nwca-form-save.js, customer-onboarding-form.css/js | ✅ Active |
| `/pages/forms/customer-onboarding-form.css` | Onboarding page-specifics (wide fields, assist hints) | nwca-form-shared.css | ✅ Active |
| `/pages/forms/customer-onboarding-form.js` | Onboarding controller — same-as-billing copy, ONB save serializer | nwca-form-shared.js, nwca-form-save.js | ✅ Active |
| `/pages/forms/team-roster-form.html` | **NEW (2026-07-11)** Team Roster (Names & Numbers) — one garment spec (style lookup + swatch color + size datalist) + 14-row player grid (name/number/size/notes), live printed size tally, spelling-verification waiver + signature. Saves RST → Forms Inbox with machine lines[] for a future SW per-line push. | nwca-form-shared.css/js, nwca-form-contacts.js, nwca-form-styles.js, nwca-form-dates.js, nwca-form-save.js, team-roster-form.css/js | ✅ Active |
| `/pages/forms/team-roster-form.css` | Roster page-specifics (grid columns, auto row numbers, tally line) | nwca-form-shared.css | ✅ Active |
| `/pages/forms/team-roster-form.js` | Roster controller — row numbering, size tally (prints), size datalist from verified style+color, RST save serializer (lines[]) | nwca-form-shared.js, nwca-form-styles.js, nwca-form-save.js | ✅ Active |
| `/pages/forms/webstore-request-form.html` | **NEW (2026-07-11)** Webstore / Company Store Request — window vs always-on, funding (company/employee/split allowance), fulfillment model, 5-row product lineup (style lookup + swatches), logos + mockup approver. Saves WSR → Forms Inbox; Due_Date = target launch. | nwca-form-shared.css/js, nwca-form-contacts.js, nwca-form-styles.js, nwca-form-dates.js, nwca-form-save.js, webstore-request-form.css/js | ✅ Active |
| `/pages/forms/webstore-request-form.css` | Webstore request page-specifics (product table columns) | nwca-form-shared.css | ✅ Active |
| `/pages/forms/webstore-request-form.js` | Webstore controller — product rows w/ style lookup, WSR save serializer | nwca-form-shared.js, nwca-form-styles.js, nwca-form-save.js | ✅ Active |
| `/pages/forms/credit-application-form.html` | **NEW (2026-07-11)** Net-Terms Credit Application — business info + entity checks, AP contact, requested limit, 3 trade references, bank REFERENCE (red banner: NO account numbers ever), authorization text + signatures. Saves CRD → Forms Inbox (default status Under Review). | nwca-form-shared.css/js, nwca-form-contacts.js, nwca-form-save.js, credit-application-form.css/js | ✅ Active |
| `/pages/forms/credit-application-form.css` | Credit app page-specifics (no-account-numbers banner, reference table) | nwca-form-shared.css | ✅ Active |
| `/pages/forms/credit-application-form.js` | Credit app controller — 3 reference rows, CRD save serializer | nwca-form-shared.js, nwca-form-save.js | ✅ Active |
| `/pages/forms/tax-exempt-cert-form.html` | **NEW (2026-07-11)** Tax-Exempt / Resale Certificate on File — exemption type checks, permit # + issued/EXPIRES dates (expiration saves as Due_Date → Inbox "due in 7 days" flags the renewal before a DOR audit would), cert-copy location, customer certification + signature, office verify checklist. Saves TAX → Forms Inbox. | nwca-form-shared.css/js, nwca-form-contacts.js, nwca-form-dates.js, nwca-form-save.js, tax-exempt-cert-form.css/js | ✅ Active |
| `/pages/forms/tax-exempt-cert-form.css` | Tax cert page-specifics (expiration hint) | nwca-form-shared.css | ✅ Active |
| `/pages/forms/tax-exempt-cert-form.js` | Tax cert controller — TAX save serializer (Due_Date = expiration) | nwca-form-shared.js, nwca-form-save.js | ✅ Active |
| `/pages/forms/pto-request-form.html` | **NEW (2026-07-11)** PTO / Time-Off Request — employee (staffFill), leave-type checks (handbook is authority), date range + hours, coverage, employee signature + manager paper strip. Saves PTO → Forms Inbox as Pending; manager approves/denies via Inbox status; Due_Date = first day off. | nwca-form-shared.css/js, nwca-form-dates.js, nwca-form-save.js, pto-request-form.css/js | ✅ Active |
| `/pages/forms/pto-request-form.css` | PTO page-specifics (manager approval strip) | nwca-form-shared.css | ✅ Active |
| `/pages/forms/pto-request-form.js` | PTO controller — company=employee mapping, PTO save serializer | nwca-form-shared.js, nwca-form-save.js | ✅ Active |
| `/pages/forms/injury-report-form.html` | **NEW (2026-07-11)** Employee Injury / Incident Report — same-day documentation; DOSH 8-hour hospitalization notice + L&I claim reminder printed on-form; incident kind + equipment checks (mirror the 6 maintenance machines), response/treatment, corrective action, signatures. Saves INJ → Forms Inbox (status Open). | nwca-form-shared.css/js, nwca-form-dates.js, nwca-form-save.js, injury-report-form.css/js | ✅ Active |
| `/pages/forms/injury-report-form.css` | Injury report page-specifics (urgent DOSH banner, equipment row) | nwca-form-shared.css | ✅ Active |
| `/pages/forms/injury-report-form.js` | Injury controller — company=employee mapping, INJ save serializer | nwca-form-shared.js, nwca-form-save.js | ✅ Active |
| `/pages/forms/credit-card-auth-form.html` | **NEW (2026-07-12)** Credit Card Authorization (2026 rebuild of the 2015 PDF) — card IDENTITY only (last 4 + good-through, type checks, issuing bank), secure-channels box (phone keyed direct / secure payment link / in person; NEVER email-text-write the number), billing + 2 ship-tos + authorized users, modernized agreement, NWCA-use verify block. sales@ email, no fax. Saves CCA → Forms Inbox; Due_Date = card expiry (renewal flag). | nwca-form-shared.css/js, nwca-form-contacts.js, nwca-form-dates.js, nwca-form-save.js, credit-card-auth-form.css/js | ✅ Active |
| `/pages/forms/credit-card-auth-form.css` | CC auth page-specifics (PCI secure-channels box, PAN-block banner, ship-to grid) | nwca-form-shared.css | ✅ Active |
| `/pages/forms/credit-card-auth-form.js` | CC auth controller — Ending-in keeps LAST 4 on full-PAN paste, MM/YY autoformat, save-time 13+-digit PAN sweep blocks save naming the field, expiry→Due_Date, CCA serializer (server re-strips card-ish labels — jest-locked) | nwca-form-shared.js, nwca-form-save.js | ✅ Active |
| `/pages/forms/nwca-public-form.js` | **NEW (2026-07-12)** Submit helper for CUSTOMER-facing public forms — required-field + email validation, honeypot (body.hp; server fakes success for bots), success panel with reference #, failure keeps typing + says call us. Staff twins keep using nwca-form-save.js. | APP_CONFIG | ✅ Active |
| `/pages/request-a-quote.html` | **NEW (2026-07-12)** PUBLIC Request-a-Quote lead form (nav "Get a Quote" + footer) — contact info, project description, method checks incl. "not sure", qty, need-by 📅, SanMar style lookup, logo image upload (/api/image-uploads). Saves QRQ → Forms Inbox + Slack lead ping. Indexable (SEO). | nwca-form-shared.css, nwca-form-dates.js, nwca-form-styles.js, nwca-public-form.js, request-a-quote.css/js | ✅ Active |
| `/pages/request-a-quote.css` | Public-form look: green topbar, submit CTA, upload row, honeypot offscreen, success panel (SHARED by webstore-inquiry.html too) | nwca-form-shared.css | ✅ Active |
| `/pages/request-a-quote.js` | Quote-lead controller — logo upload (failure never blocks the lead), QRQ serializer (company falls back to name) | nwca-form-styles.js, nwca-public-form.js | ✅ Active |
| `/pages/webstore-inquiry.html` | **NEW (2026-07-12)** PUBLIC company-store inquiry (replaces webstore-info's mailto CTA) — type/funding/headcount/launch + product ideas. Saves as webstore-request (WSR, "Submitted by: Customer (web)") + Slack lead ping. | nwca-form-shared.css, request-a-quote.css, nwca-form-dates.js, nwca-public-form.js, webstore-inquiry.js | ✅ Active |
| `/pages/webstore-inquiry.js` | Store-inquiry controller — WSR serializer with WEB LEAD summary tag | nwca-public-form.js | ✅ Active |
| `/lib/blog.js` | **NEW (2026-07-12)** Blog data+render layer — proxy /api/blog-posts fetch w/ 5-min cache; markdown→safe HTML (marked + xss allowlist; YouTube/Vimeo lines become server-built youtube-nocookie/vimeo iframes via token swap — foreign iframes can't ride in); reading time, dates. | marked, xss, node-fetch | ✅ Active |
| `/lib/blog-templates.js` | Blog SSR templates — page shell w/ full SEO head (title/meta/canonical/OG/Twitter/JSON-LD BlogPosting + Blog), index w/ featured+category chips, post page w/ hero/prose/CTA/related, RSS feed, sitemap XML. | lib/blog.js | ✅ Active |
| `/lib/product-seo.js` | **NEW (2026-07-12)** Product-page SEO layer — hybrid-SSR head injection for /product[.html]?style= (per-product title w/ SanMar ".STYLE"-tail dedup, meta desc, canonical sans color, OG, Product JSON-LD with NO offers/prices — decorated-pricing rule), 10-min head cache (misses retry 60s), + /sitemap-products.xml from proxy /api/all-styles. Fail-open: any hiccup serves the untouched static file. | node-fetch, proxy /api/product-details + /api/all-styles | ✅ Active |
| `/shared_components/css/blog.css` | Blog styles on the nwca-2026-core tokens — topnav/footer, card grid, featured, prose (h2/h3, img, blockquote, tables, video 16:9), post CTA, homepage teaser block. Loaded by SSR pages + index.html + blog-editor. | nwca-2026-core.css | ✅ Active |
| `/shared_components/js/blog-teaser.js` | Homepage "From the blog" — fetches 3 newest published posts (public proxy GET); section stays [hidden] on empty/failed fetch (a teaser is never worth an error). | APP_CONFIG, blog.css | ✅ Active |
| `/dashboards/blog-editor.html` | **NEW (2026-07-12)** Blog Editor (staff) — post list w/ Draft/Published states, editor (title, slug w/ publish-lock, meta-desc w/ counter + Google-snippet preview, category datalist, hero upload, markdown toolbar + body-image upload, YouTube/Vimeo by pasting the URL), live preview via /api/blog-preview (SAME renderer as live pages). | dash-shell.css, blog.css, blog-editor.css/js | ✅ Active |
| `/dashboards/js/blog-editor.js` | Blog Editor controller — CRUD via /api/crm-proxy/blog-posts* (secret-adding forwarder; sees Drafts), slug auto-gen + permanence lock after first publish, publish gate requires meta description, image uploads via /api/image-uploads, debounced live preview, beforeunload guard. | dash-page-helpers.js, APP_CONFIG | ✅ Active |
| `/dashboards/css/blog-editor.css` | Blog Editor page-specifics — two-pane editor/preview grid (sticky preview), toolbar, Google-snippet card, list rows. | art-hub.css tokens | ✅ Active |
| `/pages/forms/garment-drop-off-form.html` | **NEW (2026-07-10)** Fillable on-screen twin of the Customer Garment Drop-Off PDF — type in browser, Print / Save as PDF outputs the filled one-page letter form. Nothing is saved server-side. Linked from Forms Library ("Fill Out Online"). | nwca-form-shared.css/js, garment-drop-off-form.css, garment-drop-off-form.js | ✅ Active |
| `/pages/forms/garment-drop-off-form.css` | Drop-off form page-specifics (portrait @page, garment table column widths) on top of nwca-form-shared.css | nwca-form-shared.css | ✅ Active |
| `/pages/forms/garment-drop-off-form.js` | Drop-off form controller — seeds 5 garment rows, Add Row, per-row auto-total (manual override wins); print/clear/dirty via NWCAForm | nwca-form-shared.js | ✅ Active |
| `/pages/forms/artwork-request-form.html` | **NEW (2026-07-11)** Fillable twin of the Custom Artwork Request PDF — customer info, 8 artwork-type checks, project details + art direction side-by-side, sketch/notes areas, art budget & approval. Portrait print. | nwca-form-shared.css/js, artwork-request-form.css/js | ✅ Active |
| `/pages/forms/artwork-request-form.css` | Artwork request page-specifics (two-column details/direction, sketch area sizing, budget box) | nwca-form-shared.css | ✅ Active |
| `/pages/forms/artwork-request-form.js` | Artwork request controller — no tables/computed fields; just NWCAForm.init | nwca-form-shared.js | ✅ Active |
| `/pages/forms/name-personalization-form.html` | **NEW (2026-07-11)** Fillable twin of the Customer Name Personalization PDF — spec row (method/location/font/letter height/capitalization), 20-row name list, verification & approval. LANDSCAPE print. | nwca-form-shared.css/js, name-personalization-form.css/js | ✅ Active |
| `/pages/forms/name-personalization-form.css` | Name personalization page-specifics (landscape @page, name-list column widths, 5-field signature row) | nwca-form-shared.css | ✅ Active |
| `/pages/forms/name-personalization-form.js` | Name personalization controller — seeds 20 numbered rows, Add Row, auto "Total Names" count from non-empty names (manual override wins) | nwca-form-shared.js | ✅ Active |
| `/pages/forms/sample-checkout-form.html` | **NEW (2026-07-11)** Fillable twin of the Sample Checkout & Return Agreement PDF — checkout info, 7-row items table, return conditions + card-on-file (last-4 ONLY, maxlength=4), authorization text, signatures. LANDSCAPE print. | nwca-form-shared.css/js, sample-checkout-form.css/js | ✅ Active |
| `/pages/forms/sample-checkout-form.css` | Sample checkout page-specifics (landscape @page, items column widths, conditions/card two-column) | nwca-form-shared.css | ✅ Active |
| `/pages/forms/sample-checkout-form.js` | Sample checkout controller — seeds 7 numbered rows, Add Row, per-row Charge Value = 75% of Retail (cents-rounded; manual override wins) | nwca-form-shared.js | ✅ Active |
| `/pages/policies-hub.html` | **CANONICAL** Caspio-backed Policies Hub (tree sidebar, search, category chips, admin-gated CRUD) — renamed 2026-05-14 from policies-hub-v2.html as the production cutover | policies-admin-gate.js, policies-api.js, policies-hub.js, policies-hub-v2.css | ✅ Active |
| `/pages/policies-hub-legacy.html` | Pre-Caspio hardcoded hub (9 cards, no editing) — archived 2026-05-14 for safety; safe to delete after ~30 days if no fallback events | dashboard-styles.css, policies-hub.css | 🗄️ Legacy |
| `/pages/policy-detail.html` | **NEW** Individual policy read/edit page (TipTap rich-text editor, breadcrumb, outline, sub-procedures) | policies-admin-gate.js, policies-api.js, policy-editor-tiptap.js, policy-detail.js, policies-hub-v2.css, policy-detail.css | ✅ Active |
| `/pages/css/policies-hub-v2.css` | **NEW** Stylesheet for policies hub v2 (tree sidebar, cards, category chips, NW-green theme) | — | ✅ Active |
| `/pages/css/policy-detail.css` | **NEW** Stylesheet for policy-detail.html (prose body, TipTap chrome, outline sidebar, edit form) | — | ✅ Active |
| `/pages/css/org-chart-2026.css` | **NEW (2026-07-14)** Scoped 2026 visual system for the Organizational Chart policy — responsive hierarchy cards, production grid, search states, print and reduced-motion support | org-chart-2026.js | ✅ Active |
| `/shared_components/js/policies/policies-api.js` | **NEW** Policies Hub fetch wrapper (public reads + admin CRUD, 401 redirect, 409 concurrency) | /api/policies-public/*, /api/crm-proxy/policies/* | ✅ Active |
| `/shared_components/js/policies/policies-admin-gate.js` | **NEW** Resolves `window.IS_POLICIES_ADMIN` from `/api/crm-session/me` permissions; emits `policies:admin-resolved` event | /api/crm-session/me | ✅ Active |
| `/shared_components/js/policies/policies-hub.js` | **NEW** Hub page controller (tree render, search debounce, category filter, grid/list toggle, recently-updated) | PoliciesAPI, PoliciesAdminGate | ✅ Active |
| `/shared_components/js/policies/policy-detail.js` | **NEW** Detail page controller (read/edit/new modes, save flow, autosave drafts, sub-procedure listing) | PoliciesAPI, PoliciesAdminGate, PolicyEditor, DOMPurify (CDN) | ✅ Active |
| `/shared_components/js/policies/org-chart-2026.js` | **NEW (2026-07-14)** Progressive enhancement for `org-chart-2026`: converts Caspio inline markup to semantic classes, member search, production collapse, and keyboard-operable department toggles; no effect on other policies | policy-detail.html, org-chart-2026.css | ✅ Active |
| `/shared_components/js/policies/policy-editor-tiptap.js` | **NEW** TipTap 2.10.4 rich-text editor wrapper loaded from esm.sh — StarterKit + Image + Link + Table + Placeholder + Typography + custom videoEmbed node (YouTube/Loom/Vimeo). Image upload via drag-drop, paste, or button → `/api/files/upload`. AI Assist toolbar button. | esm.sh @tiptap/* @2.10.4, /api/files/upload, PolicyAIAssist | ✅ Active |
| `/shared_components/js/policies/policy-ai-assist.js` | **NEW** AI Assist modal for the TipTap editor — action picker (Generate / Polish / Expand / Summarize / FAQ / Translate / Explain-like-I'm-new), SSE stream consumer with live token rendering, Insert or Replace into editor | `/api/policies/ai-assist`, DOMPurify | ✅ Active |
| `/shared_components/js/policies/policy-ai-search.js` | **NEW** AI semantic search modal for the hub — natural-language query → Claude ranks the policy index → shows confidence-tagged results with "why this matches" explanations | `https://caspio-pricing-proxy/api/policies-ai-search` (public, rate-limited) | ✅ Active |
| `/shared_components/js/policies/policy-lightbox.js` | **NEW** Image lightbox for the policy detail page — click any `<img>` inside `.policy-body` → fullscreen overlay with prev/next arrow navigation, Esc closes, ← → cycles | (no deps) | ✅ Active |
| `/shared_components/js/policies/policy-mermaid.js` | **NEW** Mermaid diagram support — auto-renders `<pre class="mermaid">` blocks on read view (lazy-loaded from jsDelivr CDN), plus "Insert diagram" modal with tabs (Generate-from-prompt via Claude / Write Mermaid code by hand), live preview, and Insert into TipTap editor | mermaid@10.9.1 from jsDelivr CDN, `/api/policies/ai-assist` (action=generate-mermaid) | ✅ Active |
| `/shared_components/js/policies/policy-comments.js` | **NEW** Threaded discussion / Q&A panel on every policy detail page — anyone with sessionStorage auth can post + reply; admin (policies-admin) can resolve questions, hide comments, and click "✨ Polish with AI" to clean up draft text via the existing AI Assist endpoint. Author avatar shows stable color-coded initials. URL-hash deep-link (`#comment-<id>`) scrolls into view + flashes the target + auto-sets reply target. | `https://caspio-pricing-proxy/api/policy-comments-public` (open reads + posts), `/api/crm-proxy/policy-comments` (admin moderation), `/api/policies/ai-assist` (action=polish-draft) | ✅ Active |
| `/pages/policy-questions.html` | **NEW** Open Questions Inbox — admin-only aggregated view of every unresolved question across all policies. Sortable/filterable, with "Reply on policy" / "Mark resolved" / "Hide" actions. Stale (>3 day) and very-stale (>7 day) cards get amber/red left-border accents. | policy-questions-inbox.js, policies-admin-gate.js, policies-hub-v2.css | ✅ Active |
| `/shared_components/js/policies/policy-questions-inbox.js` | **NEW** Question Inbox controller — fetches /api/crm-proxy/policy-comments/inbox (admin-gated, joins questions with policy metadata server-side), renders sort/filter toolbar + question cards, handles resolve/hide actions, falls back to a "locked" notice for non-admin users. | `/api/crm-proxy/policy-comments/inbox`, policies-admin-gate.js | ✅ Active |
| `/pages/handbook.html` | **NEW (2026-05-27)** Employee Handbook online reader — single-page scrolling view of all 22 chapters with sticky TOC sidebar, scroll-spy highlighting, smooth-scroll anchors, print + PDF download buttons. Auto-syncs with Caspio chapter policies (same content as the auto-generated PDF). | handbook-reader.js, handbook.css, policies-hub-v2.css | ✅ Active |
| `/pages/css/handbook.css` | **NEW (2026-05-27)** Stylesheet for handbook.html — sticky TOC sidebar layout, chapter cards, Fraunces typography for chapter titles, print media query, mobile collapse. Extends policies-hub-v2.css design tokens. | — | ✅ Active |
| `/shared_components/js/policies/handbook-reader.js` | **NEW (2026-05-27)** Handbook reader controller — fetches parent + 22 chapters from `/api/policies-public/*` in throttled batches (4 parallel, 250ms gap to avoid 429), renders hero + intro + chapters + TOC, scroll-spy via IntersectionObserver, back-to-top button, print handler. | `https://caspio-pricing-proxy/api/policies-public/*` | ✅ Active |
| `/scripts/build-handbook-pdf.py` | **NEW (2026-05-27, polished 2026-05-28)** Permanent PDF generator — fetches employee-handbook parent + 22 chapters via the public proxy API, assembles into single HTML, renders to PDF via xhtml2pdf. Corporate polish: full-bleed "Employee Handbook" cover with NWCA logo (PIL-rendered PNG, prepended as a full-page image by PyMuPDF since xhtml2pdf can't full-bleed), embedded brand fonts (Source Serif 4 + Source Sans 3 from `scripts/fonts/`), Contents page (one page) with real page numbers via 2-pass render (PyMuPDF reads pass-1 bookmarks → rebuilds TOC), `Page N` footers, numbered chapter openers, signature block on the Acknowledgment page for bound copies. Re-run any time chapters change. Output → `forms/Employee-Handbook-Latest.pdf`. **Not a temp script** — keep. | Python 3 + xhtml2pdf + Pillow + PyMuPDF (`pip install xhtml2pdf Pillow PyMuPDF`) | ✅ Active |
| `/scripts/fonts/` | **NEW (2026-05-28)** 7 OFL static TTFs embedded into the handbook PDF (xhtml2pdf `@font-face` is broken on Windows, so these are pre-registered with reportlab in `register_fonts()`): `SourceSerif4-Regular/Bold/Black.ttf` (display headings + cover) + `SourceSans3-Regular/Bold/It/BoldIt.ttf` (body). Used only by `build-handbook-pdf.py`. | (consumed by build-handbook-pdf.py) | ✅ Active |
| `/scripts/assets/nwca-logo.png` | **NEW (2026-05-28)** NWCA logo (437×238 RGBA) composited onto the handbook PDF cover by `build_title_png` (placed on a white rounded plate so the dark-green artwork shows on the green gradient). Used only by `build-handbook-pdf.py`. | (consumed by build-handbook-pdf.py) | ✅ Active |
| `/forms/Employee-Handbook-Latest.pdf` | **NEW (2026-05-27, repolished 2026-05-28)** Auto-generated 37-page Employee Handbook PDF — full-bleed "Employee Handbook" cover with NWCA logo, single-page Contents with `Page N` footers, brand-fonted corporate typography, print/bind-ready. Regenerate via `python scripts/build-handbook-pdf.py` after any chapter edit in the Policies Hub. Linked from `/pages/handbook.html`, `/pages/policies-hub.html` hero tile, and the parent policy's Body_HTML. | (generated by build-handbook-pdf.py) | ✅ Active |
| `/scripts/seed-policies.js` | **NEW** Stub seed script — inserts via /api/policies once the proxy is deployed (superseded by `seed-policies-direct.js` for initial migration) | Node `https`, CRM_API_SECRET env var | 🔧 Deferred (proxy-based) |
| `/scripts/extract-legacy-policies.js` | **NEW** Extracts/cleans the 9 legacy policy HTML files → writes `scripts/legacy-policies.json` | Node `fs`/`path` | 🔧 One-time (ran 2026-05-14) |
| `/scripts/seed-policies-direct.js` | **NEW** Direct Caspio inserter — reads `legacy-policies.json` and POSTs to Caspio REST API using credentials from `caspio-pricing-proxy/.env`. Used for initial migration before proxy deploy. | Node `https`, Caspio OAuth | 🔧 One-time (ran 2026-05-14, seeded 9 rows) |
| `/scripts/verify-policies.js` | **NEW** Reads back the `Policies` table from Caspio and prints a per-row summary — confirms a seed/migration landed | Node `https`, Caspio OAuth | 🔧 Diagnostic |
| `/scripts/backfill-body-plain.js` | **NEW** One-shot: scans every `Policies` row where Body_HTML is set but Body_Plain is empty, derives plain text locally, and PUTs it back via Caspio REST. Used 2026-05-14 to fix the 9 legacy-migrated rows whose bulk insert bypassed the server-side strip. | Node `https`, Caspio OAuth | 🔧 One-time (ran 2026-05-14) |
| `/scripts/reparent-policy.js` | **NEW** Direct Caspio PUT to set `Parent_Policy_ID` on a given policy — used to demo the 3-level hierarchy. Started with `ltm-order-decision-algorithm` → child of `ltm-fee-policy`. Add more `RE_PARENT_PAIRS` and re-run. | Node `https`, Caspio OAuth | 🔧 Reusable |
| `/scripts/legacy-policies.json` | **NEW** Generated artifact from `extract-legacy-policies.js` — 9 cleaned policy records ready for Caspio insert | (generated) | 🔧 Generated |
| `/scripts/dry-run-backfill-shopworks-wo.js` | **NEW (2026-06-16)** READ-ONLY audit: finds storefront quotes whose ShopWorks order exists in ManageOrders but whose `quote_sessions.ShopWorks_Order_Number` is empty (which freezes their synced name/status). Cross-checks live MO orders (PO==QuoteID) against quote_sessions via the proxy public API — no Caspio creds, no writes. Builder quotes (EMB/SCP/DTF/OF) link by ExtOrderID, not PO, so they're out of scope (see header). `DAYS_BACK=N node scripts/dry-run-backfill-shopworks-wo.js`. | Node global `fetch`, proxy `/api/manageorders/orders` + `/api/quote_sessions` | 🔧 Diagnostic (reusable) |
| `/scripts/capture-pricing-baselines.js` | **NEW (2026-05-23)** Phase 0b — Puppeteer headless capture of all 22 pricing baseline scenarios (DTG/EMB/DTF/SCP). Spawns or reuses dev server, navigates each builder, evals pricing services, writes `tests/pricing-baselines/baselines.captured.json`. Used by `npm run capture:pricing` (local) and `npm run test:pricing-baselines` (CI gate vs `baselines.locked.json`). | puppeteer@24, server.js on :3000, each builder's `*-pricing-service.js` exposed on window | ✅ Active (18/22 wired: DTG 5/5, EMB 3/7, DTF 5/5, SCP 5/5; EMB-03/04/05/06 stubs for Phase 0b.1) |
| `/tests/integration/pricing-baselines.test.js` | **NEW (2026-05-23)** Phase 0b — Jest regression gate. Runs the capture script then diffs each scenario's captured values against `baselines.locked.json`. Fails CI if any per-piece, line subtotal, LTM, or grand-total drifts >$0.01. Per-size breakdown comparison too. Tolerates stub scenarios (Phase 0b.1) — they skip rather than fail. | `scripts/capture-pricing-baselines.js`, jest@30, `tests/pricing-baselines/baselines.locked.json` | ✅ Active |
| `/tests/pricing-baselines/README.md` | **NEW (2026-05-23)** Phase 0b — Workflow guide. How to capture locally, how to re-lock after intentional pricing change, how to debug CI drift failures, what files do what. | (docs) | ✅ Active |
| `/tests/pricing-baselines/SCENARIOS.md` | **NEW (2026-05-23)** Phase 0a — Human-readable list of all 22 pricing scenarios (DTG 5, EMB 7, DTF 5, SCP 5). Specifies inputs (style, qty, sizes, location, stitches/colors) per case. | (docs) | ✅ Active |
| `/tests/pricing-baselines/baselines.captured.json` | **NEW (2026-05-23)** Phase 0b — Fresh capture output. Overwritten by every `npm run capture:pricing` run. **DO NOT manually edit.** | (generated) | 🔧 Generated |
| `/shared_components/js/dtf-quote-builder.js` (Phase 8 push) | **2026-05-23** Added `showDtfPushButton(quoteId)` + `dtfPushToShopWorks()` + invocation in `saveAndGetLink()` success. Mirrors EMB push pattern. Gated behind `?enableDtfPush=1` until Erik confirms `caspio-pricing-proxy/config/manageorders-dtf-config.js` OnSite IDs. POSTs to proxy `/api/dtf-push/push-quote`. | dtf-quote-builder.html (`#dtf-push-shopworks-btn`), proxy DTF push endpoint | ✅ Active (gated) |
| `/tests/pricing-baselines/baselines.locked.json` | **NEW (pending Erik sign-off)** Phase 0b — Erik-approved baseline values. CI gate target. Only updated via explicit lock workflow (see `README.md`). | (Erik-approved) | ⏸ Pending lock |
| `/shared_components/js/artwork-upload.js` | **NEW (2026-05-23)** Phase 9 — Shared drag-drop multi-file artwork upload widget. Posts to `/api/files/upload` (Caspio Artwork folder). Used by EMB/DTF/SCP quote builders to attach reference art to a quote. DTG has its own inline version with extra design-name/placements + SW Designs[] linking. API: `ArtworkUpload.attach({mountSelector, onChange})` → returns `{getFiles, setFiles, clear, isUploading, count}`. 20MB cap. Files saved as JSON inside `quote_sessions.Notes.referenceArtwork[]` — no schema change. | `/api/files/upload`, `quote-builder-shell.css`, Font Awesome | ✅ Active |
| `/shared_components/js/inventory-badges.js` | **NEW (2026-05-23)** Phase 10.1 — Shared SanMar inventory badge renderer for table-based quote builders (EMB/DTF/SCP). Wraps existing `OrderFormInventory.getInventoryForRow()`. When called with `(rowEl, {style, catalogColor})`, fetches per-size stock and injects small `.inv-badge` next to each `input.size-input`. Color-coded: green (≥100), amber (1-99), red (OOS), gray (unknown). Has size aliasing (XXL/2XL). DTG uses OrderFormInventory directly via React-style re-render; this module exists so HTML-table builders don't need a render-layer rewrite. API: `InventoryBadges.attach(rowEl, {style, catalogColor, sizeCellSelector})` and `clear(containerEl)`. | `shared_components/js/sanmar-inventory-check.js`, `quote-builder-shell.css` (`.inv-badge` styles) | ✅ Active |
| `/shared_components/js/customer-design-combobox.js` | **NEW (2026-05-24)** Phase 11.1 — Shared customer-aware design lookup widget. Wraps an existing `<input>` and turns it into an autocomplete that searches the picked customer's designs via proxy `/api/designs/by-customer/:customerId?method=dtf\|scp\|emb\|dtg`. Per-customer 5-min cache. Shows thumbnail per row. Keyboard navigation (↑↓ Enter Esc). DTG has its own inline implementation; this widget is for DTF/SCP (and optionally a lighter alternative for EMB's modal+gallery). API: `CustomerDesignCombobox.attach(inputEl, {method, getCustomerId, onPick})` → returns `{refresh, clearCache, close}`. | proxy `/api/designs/by-customer`, `Designs2026` Caspio table | ✅ Active |
| `/shared_components/js/embroidery-chat.js` | **NEW (2026-05-24)** EMB Chat C — Research-only chat controller for the Embroidery Quote Builder's floating "Ask" panel. Streams SSE from proxy `/api/emb-quote-ai/chat` (Claude Sonnet 4.6). 3 tools: lookup_customer, recommend_top_sellers_emb (Caspio `EMB_Top_Sellers_2026` — Erik curates from 10yr sales), lookup_product_details (live SanMar). Does NOT write to the form (matches Erik's "rep builds quotes manually" charter). Leaner than DTG's controller — text bubbles + tool chips only, no result cards. Reuses `.ai-chat-*` CSS from sticker-pricing-page.css. | `/api/emb-quote-ai/chat`, sticker-pricing-page.css (chat panel styles), Font Awesome | ✅ Active |
| `/pages/pricing-negotiation-policy.html` | Pricing strategy & negotiation guide | Bootstrap, Font Awesome | ✅ Active |
| `/pages/inventory-details.html` | Inventory details page | Various | ✅ Active |
| `/pages/resources.html` | Resources page | Various | ✅ Active |
| `/pages/sale.html` | Sale page | Various | ✅ Active |
| `/pages/webstore-info.html` | Webstore information | Various | ✅ Active |
| `/pages/js/catalog-samples.js` | **NEW (2026-07-06)** Sample-program layer for /catalog Top Sellers view (`?topSellers=1`) — renders Request FREE sample / Order sample buttons into pcard slots, opens cart-drawer, syncs header Samples badge. Successor to the retired top-sellers-showcase page. | sample-cart-service.js, cart-drawer.js, catalog-2026.js | ✅ Active |
| `/pages/golf-tournaments-2026.html` | **NEW** Summer 2026 golf tournament campaign landing page (MailChimp funnel target) | golf-tournament-showcase.js, .css, embroidery-pricing-service.js, EmailJS | ✅ Active |
| `/pages/golf-tournament-product.html` | **NEW** Per-style detail page (colors/sizes/full pricing) — linked from golf-tournaments-2026.html product cards | golf-tournament-product.js, .css, embroidery-pricing-service.js | ✅ Active |
| `/memory/emailjs-custom-tees-templates.md` | **NEW** Paste-ready Subject + HTML for EmailJS `template_sample_customer`/`template_sample_sales` (Custom T-Shirts rewire of the legacy 3DT templates) + wiring checklist | EmailJS dashboard | ✅ Reference |
| `/reference/nwcustomapparel-net-blogs/` | **NEW (2026-07-13)** Full export of the nwcustomapparel.net WordPress blog (316 .md: 227 published / 69 draft / 18 trash + `INDEX.md`). REFERENCE ONLY — **never served** (no root static) and **never republished** on teamnwca.com (= duplicate content). Consult before writing teamnwca blogs so we don't duplicate .net topics or copy its text. | Blog writing (see memory/blog-content-differentiation.md) | 📖 Reference (NEW 2026-07-13) |
| `/memory/blog-content-differentiation.md` | **NEW (2026-07-13)** Blog SEO lane split: teamnwca = product/style (commercial), .net = education/authority. .net topic map + overlap watch-list (🚨 hi-vis) + rules for teamnwca blogs | Blog writing + Monday autopilot | 📖 Reference (NEW 2026-07-13) |
| `/pages/golf-tournament-lead-emailjs-template.html` | **NEW** Reference HTML for EmailJS `template_golf_lead` (paste into EmailJS dashboard) — internal lead alert to taneisha+nika+erik | EmailJS dashboard | ✅ Reference |
| `/pages/golf-tournament-customer-emailjs-template.html` | **NEW** Reference HTML for EmailJS `template_golf_customer` (paste into EmailJS dashboard) — customer-facing "thanks, we got your inquiry" confirmation | EmailJS dashboard | ✅ Reference |
| `/pages/quote-view.html` | **NEW** Public quote viewing page (shareable URL) | quote-view.js, quote-view.css | ✅ Active |
| `/pages/invoice.html` | **NEW** Single-page invoice view at `/invoice/:quoteId` — clean PDF-style one-pager that auto-syncs from ShopWorks (shares `/api/quote-sessions/:quoteId/full` with quote-view) | invoice.js, invoice.css | ✅ Active |
| `/pages/js/invoice.js` | **NEW** Invoice page controller — fetches full quote+ShopWorks snapshot, renders header/bill+ship/details/line items/totals, wires Print + Refresh-from-ShopWorks buttons, auto-syncs when snapshot >30min stale | /api/quote-sessions/:quoteId/full, /api/quote-sessions/:quoteId/sync-from-shopworks | ✅ Active |
| `/pages/css/invoice.css` | **NEW** Invoice page styles — print-first letter-paper layout, NWCA forest-green accent, condensed line items, screen-only toolbar, @media print rules | Inter font | ✅ Active |
| `/pages/embroidery-contract-pricing.html` | **NEW** Shareable contract embroidery pricing page | embroidery-contract-pricing.js, embroidery-contract-pricing.css | ✅ Active |
| `/pages/data-entry-guide.html` | **NEW** ShopWorks data entry guide with API-driven service prices | data-entry-guide.js, data-entry-guide.css, app-config.js | ✅ Active |
| `/pages/jds-mockup-creator.html` | Standalone JDS Polar Camel tumbler mockup creator — AEs/Steve pick a color, drop a logo, then download/copy/compare a customer-approval mockup. Canvas compositing + branded presentation frame + multi-color comparison sheet; no backend or AI calls. | jds-mockup-creator.js, jds-mockup-creator.css, jds-tumbler-template.js, /api/jds-catalog, /api/jds/products/:sku | ✅ Active |
| `/pages/garment-designer.html` | **NEW (2026-06-17)** NWCA Easy Shirt Designer — standalone canvas tool: place artwork (PNG/JPG/SVG/AI/PSD/PDF) **+ Tajima DST embroidery files** on a recolored shirt mockup by placement (Left Chest/Full Front/Upper/Full Back), assign Robison-Anton Poly thread colors per stitch element, generate a Customer Proof. Productionized from an 868KB single-file app → extracted JS/CSS (no-inline). Phase 1 integration (pre-seed + attach-to-ArtRequest) pending. | garment-designer.js, garment-designer.css, ag-psd@27, pdf.js@3.11, jszip@3.10 | ✅ Active |
| `/pages/data-entry-guide.js` | **NEW** API price fetching for data entry guide | /api/service-codes | ✅ Active |
| `/pages/data-entry-guide.css` | **NEW** Data entry guide styles (print-friendly) | — | ✅ Active |
| `/pages/design-gallery.html` | **NEW** Standalone design gallery — search 39K+ digitized designs | design-gallery.js, design-gallery.css, design-thumbnail-service.js, app-config.js | ✅ Active |
| `/pages/js/design-gallery.js` | **NEW** Design gallery controller — search, cards, share with customer, lightbox zoom | /api/digitized-designs/search-all, /by-customer | ✅ Active |
| `/pages/css/design-gallery.css` | **NEW** Design gallery page styles (responsive grid, cards, enlarged modal, lightbox) | — | ✅ Active |
| `/pages/design-view.html` | **NEW** Public customer-facing design preview page — shareable via /design/:designNumber | design-view.js, design-view.css, app-config.js | ✅ Active |
| `/pages/js/design-view.js` | **NEW** Customer design view — fetches design images, renders gallery + lightbox | /api/digitized-designs/lookup | ✅ Active |
| `/pages/css/design-view.css` | **NEW** Customer design view styles (branded, responsive, lightbox overlay) | — | ✅ Active |
| `/pages/art-request-detail.html` | **NEW** Staff-facing art request detail page — shareable via /art-request/:designId | art-request-detail.js, art-request-detail.css, app-config.js | ✅ Active |
| `/pages/art-billing-reference.html` | **NEW** Standalone billing-codes / file-requirements / file-definitions reference. Linked from Steve's gallery toolbar; shareable URL for customers and AEs. Was a tab on art-hub-steve.html (extracted 2026-04-26 to declutter Steve's nav). | art-hub.css | ✅ Active |
| `/pages/js/art-request-detail.js` | **NEW** Art request detail — fetches art request + notes, renders info cards + timeline, Box file upload | /api/artrequests, /api/design-notes, /api/art-requests/:id/upload-mockup (box-upload.js) | ✅ Active |
| `/pages/css/art-request-detail.css` | **NEW** Art request detail styles (two-column, status badges, billing grid, notes timeline) | — | ✅ Active |
| `/pages/dst-viewer.html` | **NEW** DST embroidery stitch file viewer — drag-drop .DST, color/mono/trace modes | dst-viewer.js, dst-viewer.css, Font Awesome, DM Mono/Outfit fonts | ✅ Active |
| `/pages/js/dst-viewer.js` | **NEW** DST binary parser, canvas renderer (3 modes), trace animation, thread color sequence | Vanilla JS, no dependencies | ✅ Active |
| `/pages/css/dst-viewer.css` | **NEW** DST viewer dark theme styles (2-col grid, canvas, sidebar, trace controls, responsive) | CSS variables | ✅ Active |
| `/pages/mockup-generator.html` | **NEW** Embroidery mockup generator — upload DST+EMB/PDF, generate colored mockups, compare threads | mockup-generator.js, mockup-generator.css, Font Awesome, Inter font | ✅ Active |
| `/pages/js/mockup-generator.js` | **NEW** Mockup generator frontend — file upload, API calls to Python Inksoft, thread display, comparison table | Vanilla JS, calls inksoft-transform Heroku | ✅ Active |
| `/pages/css/mockup-generator.css` | **NEW** Mockup generator dark theme styles (upload zones, results grid, comparison table, spinner) | CSS variables | ✅ Active |
| `/pages/js/thread-color-picker.js` | **NEW** Thread color picker modal — searchable RA catalog (~866 colors), family tabs, swatch grid | Vanilla JS, calls /api/embroidery/palette | ✅ Active |
| `/pages/css/thread-color-picker.css` | **NEW** Thread color picker modal dark theme styles (overlay, search, family tabs, color grid) | CSS variables | ✅ Active |

### 3-Day Tees System (design-studio rebuild 2026-06-09)
| File | Purpose | Dependencies | Status |
|------|---------|--------------|--------|
| `/pages/3-day-tees.html` | 3-Day Tees design studio — single-page designer→colors→checkout flow, Stripe hosted checkout | 3-day-tees-app.js + modules below, 3-day-tees.css, app.config.js | ✅ Active |
| `/pages/3-day-tees-success.html` | Post-payment confirmation — polls quote session, EmailJS confirmations, mockups + promise date | 3-day-tees-success.js, 3-day-tees-success.css | ✅ Active |
| `/pages/js/3-day-tees-app.js` | App core: state + sessionStorage restore, API loads, UI renderers, 4-step checkout pipeline | TDTPricing/TDTShipDate/TDTCalibration/TDTDesigner | ✅ Active |
| `/pages/js/3-day-tees-pricing.js` | PURE pricing engine (quote/unitPrice) — also require()d by server.js for the authoritative reprice | — (dual browser/Node) | ✅ Active |
| `/pages/js/3-day-tees-shipdate.js` | PURE ship-promise engine (9AM Pacific cutoff, holiday calendar → 2032) — also require()d by server.js | — (dual browser/Node) | ✅ Active |
| `/pages/js/3-day-tees-calibration.js` | Print-area calibration (pixel-measured PC54 ghost shots, LC/FF/FB rects in image fractions) | — | ✅ Active |
| `/pages/js/3-day-tees-designer.js` | Canvas designer component: drag/pinch/keyboard placement in inches, per-color preview, hi-res mockup export | TDTCalibration, /api/image-proxy | ✅ Active |
| `/pages/js/3-day-tees-success.js` | Success-page logic (status polling w/ refresh=true, EmailJS once-guard) | TDTShipDate, app.config.js | ✅ Active |
| `/pages/css/3-day-tees.css` | Studio design system ("press-room editorial": paper/ink-green/safety-orange, Bricolage Grotesque) | — | ✅ Active |
| `/pages/css/3-day-tees-success.css` | Success page styles (rides 3-day-tees.css tokens) | 3-day-tees.css | ✅ Active |
| `/tests/unit/cors-origin-allowlist.test.js` | **NEW (2026-07-08, roadmap 1.2)** Locks the CORS exact-match allowlist: look-alike domains (evil-teamnwca.com) + arbitrary *.herokuapp.com + prod localhost all REJECTED; env-list replaces defaults | jest, lib/cors-allowlist.js | ✅ Active |
| `/shared_components/vendor/` (bootstrap 5.1.3 css+js, fontawesome 6.6.0 css+webfonts, @emailjs/browser 3.12.1, dompurify 3.0.6, @sentry/browser 8.55.0) | **NEW (2026-07-08, roadmap 1.3)** Self-hosted pinned copies of every third-party lib the quote builders execute — CDN compromise or a floating-tag bump (@3) can't change builder code. Upgrades = replace the file in git (byte-diff reviewable) | all 4 builder HTMLs; embroidery-chat.js, sample-cart-service.js, policies/policy-detail.js (dynamic loaders); observability.js | ✅ Active |
| `/tests/unit/no-cdn-in-builders.test.js` | **NEW (2026-07-08, roadmap 1.3)** Ratchet: builder HTMLs reference no code CDN + no floating @major; vendored files exist (>1KB); builder-shipped JS has no dynamic CDN script.src | jest | ✅ Active |
| `/shared_components/js/observability.js` | **NEW (2026-07-08, roadmap 1.10)** Browser Sentry init for the 4 builders: early-error buffer (pre-init crashes replay), /api/version config fetch (no DSN → tracking OFF, zero impact), release-SHA + tenant/method tags, inline PII scrub (twin of lib/sentry-scrub.js — keep regexes in sync). Never load-bearing | vendor/sentry/bundle.min.js (loads first); GET /api/version | ✅ Active |
| `/lib/sentry-scrub.js` | **NEW (2026-07-08, roadmap 1.10)** Server-side Sentry beforeSend PII scrubber — masks emails/phones anywhere in the event tree (cycle-safe, non-mutating) so error tracking never leaks customer data | server.js Sentry.init; locked by tests/unit/sentry-scrub.test.js | ✅ Active |
| `/tests/unit/sentry-scrub.test.js` | **NEW (2026-07-08, roadmap 1.10)** Locks the PII scrub: email+phone formats masked in nested events/breadcrumbs; prices/qtys untouched; input not mutated; cycle-safe | jest, lib/sentry-scrub.js | ✅ Active |
| `/tests/dom/` (setup, global-setup, adapter-contract.test, dtf-child-rows.test) | **NEW (2026-07-08, roadmap 1.14)** jsdom jest project: all 3 adapters boot QuoteBuilderBase in a real DOM (dropped contract method fails loudly); nudge tiers locked + cross-checked vs the utils map (all 4 builders); DTF childRows Map semantics off the real prototype. global-setup pre-bundles (esbuild can't run inside jsdom) | jest jsdom project, esbuild | ✅ Active |
| `/tests/a11y/` (axe-common, builders.a11y.test, update-baseline, baseline.json) | **NEW (2026-07-08, roadmap 1.9)** Static-DOM axe RATCHET: per-rule violation counts only drop vs baseline.json (regenerate via update-baseline.js AFTER 1.8 fixes — never to absorb a regression); color-contrast excluded here (jsdom can't render — the e2e pass owns it) | jest jsdom project, jest-axe | ✅ Active |
| `/tests/e2e/` (playwright.config, money-path.spec, a11y.spec, update-a11y-baseline, a11y-baseline.json) | **NEW (2026-07-08, roadmap 1.13+1.9)** Real-browser money path: EMB search→color→qty→reprice→save mints EMB-2026-777 with TotalAmount>0 (all writes route-mocked — no real quotes/email ever); EMB LTM ≤7 guard; DTF zero-location save block. Rendered axe ratchet incl. color-contrast (trio ~5-11 serious nodes; DTG 60 = the 1.8 outlier) | @playwright/test chromium, @axe-core/playwright; npm run test:e2e | ✅ Active |
| `/tests/unit/parse-rate-percent.test.js` | Regression lock: 2026-06-10 falsy-zero tax fix (0% is a valid rate, NaN falls back) | jest, quote-builder-utils.js | ✅ Active |
| `/tests/unit/parse-bulk-sizes.test.js` | **NEW (2026-07-06)** Locks the shared bulk-size-paste parser (UX audit P1 #2): "S:2 M:4 L:6" formats, XXL→2XL, non-size text → {} so plain pastes fall through | jest, quote-builder-utils.js | ✅ Active |
| `/tests/unit/distribute-proportionally.test.js` | **NEW (2026-07-06)** Locks the clickable quantity-nudge math (UX audit P1 #3): additions sum to EXACTLY delta (largest remainder), zero-qty cells excluded, deterministic ties | jest, quote-builder-utils.js | ✅ Active |
| `/tests/unit/quote-snapshot-diff.test.js` | **NEW (2026-06-26)** Locks the size-aware ShopWorks-snapshot diff: a per-size redistribution (S→M) at constant total qty + unit price now emits a `LineSizes[...]` change row (powers the quote-view "edited in ShopWorks" banner) — old diff missed it. | jest, lib/quote-snapshot-diff.js | ✅ Active |
| `/tests/unit/build/asset-manifest.test.js` | **NEW (2026-07-07, roadmap 0.1)** Locks the builder-page asset rewrite: ?v= stripping, single/double quotes, CDN + unlisted files untouched, no prefix over-matching, relative-`url()` CSS detection, mtime-cached manifest loader (absent/broken manifest → null → source-path fallback). | jest, lib/asset-manifest.js | ✅ Active |
| `/tests/unit/no-hardcoded-hosts.test.js` | **NEW (2026-07-07, roadmap 0.6)** Rule-6 guard, 3 tiers: CLEAN set (builder path + all Phase-0 code = zero proxy-host/EmailJS literals), EXACT-ONE set (server.js CASPIO_PROXY_BASE + quote-cart-engine.js DEFAULT_API_BASE), repo-wide RATCHET baselines (host 225 / emailjs 69 outside config/ — may only go DOWN; lower them in the same commit that removes literals). | jest | ✅ Active |
| `/tests/unit/dtf-save-parity.test.js` | **NEW (2026-06-11)** DTF audit lock: every sizeGroup → quote_items row (XS incl.), ColorCode=CATALOG_COLOR chain, Notes JSON round-trips shipToName/includeTax/pricingMetadata | jest, dtf-quote-service.js | ✅ Active |
| `/tests/unit/dtf-childrow-state.test.js` | **NEW (2026-06-11)** P2 closure lock: DTFQuoteBuilder.childRows JS-state model — calculateFromState/getTotalQuantity price extended-size child rows with ZERO DOM (document stub throws on any query) | jest, dtf-quote-builder.js | ✅ Active |
| `/tests/unit/dtf-location-size-lock-parity.test.js` | **NEW (2026-06-19)** Guards the DTF location→transfer-size lock (Small/Med/Large) against drift between its 2 hand-copies — `DTFConfig.transferLocations` (dtf-quote-pricing.js) ↔ `DTF_LOCATIONS_FALLBACK` (quote-cart-engine.js); also pins the audited mapping. Keeps all 3 DTF surfaces sizing identically (from the 2026-06-19 3-surface audit). | jest, dtf-quote-pricing.js, quote-cart-engine.js | ✅ Active |
| `/tests/unit/dtf-size-upcharge-fallback.test.js` | **NEW (2026-06-20)** DTF-1 audit lock: builder `getSizeUpcharge()` flags + fires a VISIBLE warning when it substitutes a hardcoded extended-size upcharge because the API lacked it (Erik #1: never a silent hardcoded price); price unchanged, warning de-duped. Runs the real class via the dtf-childrow-state harness. | jest, dtf-quote-builder.js | ✅ Active |
| `/tests/unit/dtg-canonical-fallback-parity.test.js` | **NEW (2026-06-20)** DTG-4 audit lock: pins the empty-tiers fallback margin equal across the TWO DTG copies — server `caspio-pricing-proxy/lib/dtg-canonical-pricing.js` ↔ client `dtg-pricing-service.js` (both 0.53; had drifted 0.57 vs 0.53). Cross-repo, skips if the proxy sibling isn't checked out. | jest, dtg-pricing-service.js | ✅ Active |
| `/tests/unit/scp-save-parity.test.js` | **NEW (2026-06-11)** Rule-8 sweep lock: SCP save persists FULL sizeBreakdown (XS/LT/7XL) + foots to SubtotalAmount; print path (buildScreenprintPricingData) emits a PDF line for EVERY popup size, XXL child-row price, OSFA-only parent price | jest, screenprint-quote-service.js, screenprint-quote-builder.js | ✅ Active |
| `/tests/unit/emb-save-parity.test.js` | **NEW (2026-06-11)** Rule-8 sweep lock: every EMB engine lineItem (XS + tall LT groups incl.) → quote_items row, foots to SubtotalAmount, ColorCode=CATALOG_COLOR | jest, embroidery-quote-service.js | ✅ Active |
| `/tests/unit/push-button-binding.test.js` | **NEW (2026-06-14)** Regression lock (SCP+DTF): exactly ONE `scp/dtfPushToShopWorks` declaration and it's `async`; the bound `window.*` fn returns a Promise (catches a duplicate back-compat alias hoisting over the async one-click auto-save flow) | jest, screenprint-quote-builder.js, dtf-quote-builder.js | ✅ Active |
| `/tests/unit/3dt-pricing.test.js` | Behavioral spec: 7-step formula, sub-24 cost fallback, LTM, tax base | jest | ✅ Active |
| `/tests/unit/3dt-shipdate.test.js` | Behavioral spec: cutoff/weekend/holiday/PST-PDT matrix | jest | ✅ Active |
| `/tests/3dt-test-push-payload.json` | Reference webhook-equivalent payload for ManageOrders TEST pushes | — | ✅ Active |
| `/tests/3dt-fire-test-webhook.js` | Fires a SIGNED synthetic checkout.session.completed at localhost — full post-payment pipeline test without a card (reads .env webhook secret) | node, .env | ✅ Active |

> Deleted 2026-06-09 (legacy implementation): `/pages/js/3-day-tees.js`, `/pages/js/3-day-tees-debug.js`, `/pages/css/3-day-tees-redesign.css`, `/pages/js/services/ApiService.js`, `/pages/js/services/InventoryService.js`, `/pages/js/utils/debounce.js`, `/tests/test-3day-{inventory,multisku}.js`, `/tests/3-day-tees-{redesign-demo,performance-test}.html`, `/tests/3-day-tees-inventory-summary.md`. Recovery: `git show HEAD~1:<path>`.

### Custom T-Shirts System (multi-style DTG storefront, built 2026-06-10 — pre-launch, awaiting Erik review + redirect cutover)
| File | Purpose | Dependencies | Status |
|------|---------|--------------|--------|
| `/pages/custom-tees.html` | Custom T-Shirts page at /custom-tees — gallery of the 20 DTG top sellers + designer + Stripe checkout | custom-tees-app.js + modules below (absolute /pages/ asset paths — clean-URL serving) | ✅ Built |
| `/pages/custom-tees-success.html` | Post-payment success page | custom-tees-success.js | ✅ Built |
| `/pages/js/custom-tees-app.js` | App core: gallery (/api/dtg/top-sellers/styles), per-style designer/state, rush toggle, checkout pipeline (channel:'custom-tees') | TDTPricing/TDTShipDate/CTS_CALIBRATION/TDTDesigner | ✅ Built |
| `/pages/js/custom-tees-pricing.js` | PURE pricing engine — INTERNAL-DTG-BUILDER PARITY: rush opt-in, tier-row distributed LTM, FB/JB/JF locations. Jest-locked. | — (dual browser/Node; server requires it) | ✅ Built |
| `/pages/js/cts-gallery-merch.js` | **NEW (2026-06-12)** PURE gallery merchandising helpers: SanMar PRODUCT_DESCRIPTION → card blurb + fabric facts; featured-color variety pass (de-dupes Jet Black across the grid). NO pricing math — card prices come from server `GET /api/cts/gallery-extras` via CTS_PRICING.quote().perShirt. Jest-locked. | — (dual browser/Node; server requires it) | ✅ Built |
| `/pages/js/custom-tees-shipdate.js` | Ship-promise engine: standardPromise() 7–10 biz-day window + rush 3-day cutoff promise. Jest-locked. | — (dual browser/Node) | ✅ Built |
| `/pages/js/custom-tees-calibration.js` | Per-style print-area registry `window.CTS_CALIBRATION.forStyle()` — hybrid: PC54 hand-calibrated + generic flat-lay model for other styles; LC/FF/JF/FB/JB inches authoritative | — | ✅ Built |
| `/pages/js/custom-tees-designer.js` | Canvas designer (3DT fork): styleNumber-aware via CTS_CALIBRATION, JF/JB jumbo locations, approximate-preview flag for uncalibrated styles | CTS_CALIBRATION, /api/image-proxy | ✅ Built |
| `/pages/js/custom-tees-success.js` | Success-page logic: mode-aware promise copy, style-aware emails | TDTShipDate, app.config.js, EmailJS | ✅ Built |
| `/pages/css/custom-tees.css` + `/pages/css/custom-tees-success.css` | Page styling (3DT theme + gallery band) | — | ✅ Built |
| `/pages/order-status.html` | Customer order-status page at /order-status?id=&t= — HMAC-token link from the confirmation email, no login (timeline, promise date, UPS tracking, mockups, summary) | order-status.js/.css + custom-tees.css tokens (absolute /pages/ paths — clean-URL serving) | ✅ Built |
| `/pages/js/order-status.js` | Status-page logic: reads ?id&t, calls same-origin /api/order-status/:quoteId, renders 4-step timeline + totals; friendly 404 state; everything escaped | server.js GET /api/order-status | ✅ Built |
| `/pages/css/order-status.css` | Status-page styling (rides on custom-tees.css tokens) | custom-tees.css | ✅ Built |
| `/tests/unit/custom-tees-pricing.test.js` | Jest lock: rush opt-in, distributed LTM ($49.92/12pcs), FB/JB/JF, fail-closed (17 tests) | custom-tees-pricing.js | ✅ Active |
| `/tests/unit/custom-tees-shipdate.test.js` | Jest lock: 7–10 day window, holiday skip, binding end date (7 tests) | custom-tees-shipdate.js | ✅ Active |
| `/tests/unit/cts-gallery-merch.test.js` | **NEW (2026-06-12)** Jest lock for cts-gallery-merch: real-PC54-copy blurb/fabric parsing, entity decode, variety-pass de-dupe/lookback/determinism | cts-gallery-merch.js | ✅ Active |
| `/config/storefront-channels.js` | Storefront CHANNEL REGISTRY (pure half): per-channel QuoteID builders, ShopWorks push constants (designTypeId/artistId/SW_LOC/LTM part), banners, EmailJS templates, Stripe paths — server.js binds server-only behaviors on top; adding 'custom-caps' = one entry here + one in server.js CHANNELS | server.js (checkout/webhook emails/push/order-status/shipped email) | ✅ Active |
| `/tests/unit/storefront-channels.test.js` | Characterization lock (28 tests): exact pre-registry strings/values for BOTH channels — QuoteID formats, note labels, banners, push ids, shipped-email gate, resolver default semantics | config/storefront-channels.js | ✅ Active |
| `/tests/cts-e2e-local.js` | Local E2E driver: checkout-session → Caspio stamp assertions → prints webhook-leg command | local server :3000 + live proxy | ✅ Active |
| `/tools/seed-top-sellers.js` | **NEW (2026-07-06)** One-time CLI seed of Caspio IsTopSeller flags for the 68 styles the retired showcase page displayed (drives /catalog?topSellers=1); idempotent, undo via clear-topsellers endpoint | proxy /api/admin/products/mark-as-topseller | ✅ Utility |
| `/tools/custom-tees-calibrate.html` | STAFF print-box calibration tool — lay the 16×20 envelope on each style's photo once; the storefront designer anchors to it (no-deploy edits) | custom-tees-calibrate.{js,css}, app.config.js, proxy /api/dtg-calibration | ✅ Active |
| `/tools/custom-tees-calibrate.js` | Tool logic: style/color/view picker, drag/scale aspect-locked box, upsert to Caspio DTG_Calibration via proxy; silhouette auto-detect starting position | proxy /api/dtg-calibration + /api/dtg/top-sellers + /api/product-details | ✅ Active |
| `/tools/custom-tees-calibrate.css` | Calibration-tool styling | — | ✅ Active |

### Custom Hats System ('custom-caps' channel — server core built 2026-06-11; storefront pages built 2026-06-11, /custom-caps route NOT yet registered)
| File | Purpose | Dependencies | Status |
|------|---------|--------------|--------|
| `/pages/custom-carhartt.html` | Custom Carhartt SEO brand landing page (/custom-carhartt) — fully STATIC on purpose (indexable): 18-style curated grid with real order stats, decoration section, FAQ, BreadcrumbList/CollectionPage-ItemList/FAQPage JSON-LD, .net break-in-guide cross-link; no prices (Rule 9) | custom-carhartt.css, custom-carhartt.js, nwca-2026-core.css | ✅ Active (NEW 2026-07-12) |
| `/pages/custom-richardson.html` | Custom Richardson SEO brand landing page (/custom-richardson) — static: 112-family + trucker/rope cap grid w/ real order stats, leather/laser-patch decoration section, REAL customer showcase (Pro Vac/South Sound/Gonnason), FAQ + same JSON-LD trio; no prices. Reuses the Carhartt landing CSS/JS | custom-carhartt.css, custom-carhartt.js, nwca-2026-core.css | ✅ Active (NEW 2026-07-13) |
| `/pages/custom-nike.html` | Custom Nike SEO brand landing page (/custom-nike) — static: Dri-FIT polo families + fleece/caps/tees grid w/ real order stats (NKDC1963 = 1,700+ embroidered), swoosh/premium-gift angle, embroidery decoration section, FAQ + same JSON-LD trio; no prices. Reuses the Carhartt landing CSS/JS | custom-carhartt.css, custom-carhartt.js, nwca-2026-core.css | ✅ Active (NEW 2026-07-13) |
| `/pages/custom-new-era.html` | Custom New Era SEO brand landing page (/custom-new-era) — static: structured caps + snapbacks/truckers + beanies/apparel grid w/ real order stats (NE1000 = 2,500+ decorated), big-league/fitted-feel angle, embroidery+patch decoration section, FAQ + same JSON-LD trio; no prices. Reuses the Carhartt landing CSS/JS | custom-carhartt.css, custom-carhartt.js, nwca-2026-core.css | ✅ Active (NEW 2026-07-13) |
| `/pages/custom-sport-tek.html` | Custom Sport-Tek SEO brand landing page (/custom-sport-tek) — static: performance polos + Competitor tees + 1/4-zips/fleece grid w/ real order stats (ST350 = 3,800+ printed; 25,000+ Sport-Tek pieces total), team/spirit-wear + Sport-Wick/PosiCharge angle, embroidery/screen-print/DTF decoration section, FAQ + same JSON-LD trio; no prices. Reuses the Carhartt landing CSS/JS | custom-carhartt.css, custom-carhartt.js, nwca-2026-core.css | ✅ Active (NEW 2026-07-13) |
| `/pages/custom-ogio.html` | Custom OGIO SEO brand landing page (/custom-ogio) — static: premium polos + signature bags/packs + soft-shell jackets grid w/ real order stats (OG101 = 500+ decorated; 3,000+ OGIO pieces total), executive-gift/retail-grade angle, embroidery (incl. bags) decoration section, FAQ + same JSON-LD trio; no prices. Reuses the Carhartt landing CSS/JS | custom-carhartt.css, custom-carhartt.js, nwca-2026-core.css | ✅ Active (NEW 2026-07-13) |
| `/pages/custom-district.html` | Custom District SEO brand landing page (/custom-district) — static: soft Very Important Tees + tri-blends + fleece grid w/ real order stats (DT6000 = 2,400+ printed; 12,000+ District pieces total), retail-soft/merch + Perfect Tri angle, screen-print/DTF/embroidery decoration section, FAQ + same JSON-LD trio; no prices. Reuses the Carhartt landing CSS/JS | custom-carhartt.css, custom-carhartt.js, nwca-2026-core.css | ✅ Active (NEW 2026-07-13) |
| `/pages/custom-port-authority.html` | Custom Port Authority SEO brand landing page (/custom-port-authority) — static: caps + performance polos + soft-shell jackets grid w/ real order stats (C112 = 9,800+ decorated; 65,000+ PA pieces / 5,700+ orders = most-ordered brand), corporate-wardrobe angle, embroidery decoration section, FAQ + same JSON-LD trio; no prices. browse-all → `?brand=Port Authority`. Reuses the Carhartt landing CSS/JS | custom-carhartt.css, custom-carhartt.js, nwca-2026-core.css | ✅ Active (NEW 2026-07-13) |
| `/pages/custom-port-and-company.html` | Custom Port & Company SEO brand landing page (/custom-port-and-company) — static: value cotton/blend tees + Core Fleece grid w/ real order stats (PC54 = 18,000+ printed = biggest style we run; 80,000+ P&C pieces total), budget/big-order + screen-print/DTF angle, FAQ + same JSON-LD trio; no prices. ⚠ brand is name-split in Caspio: `Port & Co` (136 styles) + `Port & Company` (32) — browse-all uses `?brand=Port & Co`; both map keys in brands-flyout. Reuses the Carhartt landing CSS/JS | custom-carhartt.css, custom-carhartt.js, nwca-2026-core.css | ✅ Active (NEW 2026-07-13) |
| `/pages/custom-cornerstone.html` | Custom CornerStone SEO brand landing page (/custom-cornerstone) — static: ANSI hi-vis vests/tees + snag-proof tactical polos + Class 3 outerwear grid w/ real order stats (CS413 = 990+ decorated; 10,000+ CornerStone pieces total), safety/hi-vis + "decorated within ANSI limits" angle, embroidery/heat-transfer decoration section, FAQ + same JSON-LD trio; no prices. Reuses the Carhartt landing CSS/JS | custom-carhartt.css, custom-carhartt.js, nwca-2026-core.css | ✅ Active (NEW 2026-07-13) |
| `/pages/custom-north-face.html` | Custom The North Face SEO brand landing page (/custom-north-face) — static: DryVent jackets + Skyline fleece + insulated vests grid w/ real order stats (NF0A3LH4 = 300+ decorated/120 orders; 2,200+ TNF pieces total), premium-gift angle, left-chest embroidery section, FAQ + same JSON-LD trio; no prices. Reuses the Carhartt landing CSS/JS | custom-carhartt.css, custom-carhartt.js, nwca-2026-core.css | ✅ Active (NEW 2026-07-13) |
| `/pages/custom-gildan.html` | Custom Gildan SEO brand landing page (/custom-gildan) — static: Ultra Cotton/DryBlend tees + Heavy Blend hoodies grid w/ real order stats (2000 = 2,300+ printed; 8,000+ Gildan pieces total), value-blank/big-print-run + screen-print/DTF angle, FAQ + same JSON-LD trio; no prices. Reuses the Carhartt landing CSS/JS | custom-carhartt.css, custom-carhartt.js, nwca-2026-core.css | ✅ Active (NEW 2026-07-13) |
| `/pages/custom-eddie-bauer.html` | Custom Eddie Bauer SEO brand landing page (/custom-eddie-bauer) — static: soft shell + rain + quilted jackets/vests grid w/ real order stats (EB532 = 500+ decorated; 2,300+ EB pieces total), premium-outerwear/executive-gift angle, left-chest embroidery section, FAQ + same JSON-LD trio; no prices. Reuses the Carhartt landing CSS/JS | custom-carhartt.css, custom-carhartt.js, nwca-2026-core.css | ✅ Active (NEW 2026-07-13) |
| `/pages/custom-travismathew.html` | Custom TravisMathew SEO brand landing page (/custom-travismathew) — static: golf polos + 1/4-zips + signature caps grid w/ real order stats (TM1MU411 = 74 orders; TM1MU426 = 370+ decorated; 2,300+ TM pieces total), premium-golf/tournament angle (links golf-tournaments-2026), left-chest embroidery section, FAQ + same JSON-LD trio; no prices. Reuses the Carhartt landing CSS/JS | custom-carhartt.css, custom-carhartt.js, nwca-2026-core.css | ✅ Active (NEW 2026-07-13) |
| `/pages/custom-bella-canvas.html` | Custom Bella+Canvas SEO brand landing page (/custom-bella-canvas) — static: soft jersey/CVC tees + sponge fleece + tri-blends/women's grid w/ real order stats (BC3001 = 2,300+ printed; 4,600+ B+C pieces total), premium-merch-tee/fashion-drop + screen-print/DTF angle, FAQ + same JSON-LD trio; no prices. browse-all → `?brand=Bella + Canvas` (URL-enc `%20%2B%20`). 15th & final brand-program page (top-15 by GP). Reuses the Carhartt landing CSS/JS | custom-carhartt.css, custom-carhartt.js, nwca-2026-core.css | ✅ Active (NEW 2026-07-13) |
| `/pages/company-webstores.html` | **NEW (2026-07-14)** Company & Team Webstores SEO HUB (`/company-webstores`) targeting the B2B "company store / team store / employee uniform store" cluster. Golf-page showcase style (reuses golf-tournament-showcase.css + page-local company-webstores.css); STATIC, no prices (Rule 9): hero + trust-band + 8 store-type cards (company/team/uniform/school-spirit/nonprofit/booster/franchise/event — the hub-and-spoke) + how-it-works (4 steps) + benefits + sample-store CTA + FAQ. canonical + BreadcrumbList + Service + FAQPage JSON-LD. Supersedes legacy `/webstore-info.html` (301'd) + `/pages/webstore-info.html` (noindex+canonical). Homepage nav/footer/svc-card repointed here. | golf-tournament-showcase.css, pages/css/company-webstores.css | ✅ Active (NEW 2026-07-14) |
| `/pages/{team,school-spirit,fundraising,college,event}-webstores.html` | **NEW (2026-07-14)** Webstore SPOKES wave 2 — the InkSoft-marketed niches (team/sports, school spirit, fundraising, college/Greek, event). Same generator (gen-spokes.js) + embroidery-only pricing (emb + $6). Sensible product picks (no NWCA order data — these aren't current NWCA business; speculative expansion). Routes `/team-webstores`, `/school-spirit-webstores`, `/fundraising-webstores`, `/college-webstores`, `/event-webstores`. | golf-tournament-showcase.css, pages/css/company-webstores.css | ✅ Active (NEW 2026-07-14) |
| `/pages/{property-management,industrial,retail,government}-webstores.html` | **NEW (2026-07-14)** Webstore SPOKES #3–6 (data-ranked B2B niches). Generated from the construction/restaurant template (golf-showcase + company-webstores.css), each with its niche's real products from InkSoft order data + embroidery-only pricing (emb + $6). Routes `/property-management-webstores`, `/industrial-webstores`, `/retail-webstores`, `/government-webstores`. canonical + BreadcrumbList + Service + FAQPage JSON-LD; link to /company-webstores hub. Generator: scratchpad gen-spokes.js. | golf-tournament-showcase.css, pages/css/company-webstores.css | ✅ Active (NEW 2026-07-14) |
| `/pages/restaurant-webstores.html` | **NEW (2026-07-14)** Webstore SPOKE #2: Restaurant & hospitality stores (`/restaurant-webstores`) — Hops N Drops is the big account. Mixed pricing: screen-printed staff tees (ST350/LST700/ST700/PC61, "priced by run") + embroidered polos/caps (K810 $42, CP96 $31 = emb + $6 handling). Hub-template + product grid from real InkSoft order data. canonical + BreadcrumbList + Service + FAQPage JSON-LD. Links to /company-webstores hub. | golf-tournament-showcase.css, pages/css/company-webstores.css | ✅ Active (NEW 2026-07-14) |
| `/pages/construction-webstores.html` | **NEW (2026-07-14)** Webstore SPOKE #1: Construction company stores (`/construction-webstores`) — NWCA's #1 webstore niche (663 InkSoft orders). Hub-template (golf-showcase + company-webstores.css, ABSOLUTE asset paths); product grid = the styles construction crews ACTUALLY order (CT100617, CTK121, NKDC1963, 112, W668, ST469 + hi-vis/Carhartt cross-links). canonical + BreadcrumbList + Service + FAQPage JSON-LD. Links back to /company-webstores hub. First of 6 data-ranked B2B spokes (see memory/webstore-seo-strategy.md). | golf-tournament-showcase.css, pages/css/company-webstores.css | ✅ Active (NEW 2026-07-14) |
| `/pages/css/company-webstores.css` | Scoped card grids (store-type + benefit icon cards, how-it-works steps) for the Webstores hub — shell/typography come from golf-tournament-showcase.css. Linked via ABSOLUTE `/pages/css/` path (hub served at clean route `/company-webstores`). | company-webstores.html | ✅ Active (NEW 2026-07-14) |
| `/pages/custom-safety-apparel.html` | Custom Safety STRIPE Apparel USE-CASE landing page (/custom-safety-apparel) — screen-printed hi-vis safety-stripes program (NWCA signature). Golf-page visual style (reuses golf-tournament-showcase.css); STATIC (no live-pricing JS, no prices/Rule 9): hero + trust-band + "Pick Your Stripe Design" gallery (14 Caspio `cdn.caspio.com/A0E15000/Safety Stripes/*.png` layout designs: stripe styles + logo placements) + prominent NOT-ANSI-certified disclaimer band (`.bonus-band`) + Steve custom-stripes callout + "Hi-Vis Gear We Print On" (9 recommended blanks from proxy `GET /api/safety-stripes/top-sellers/styles`, SanMar safety-color images) + "Real Crews" gallery (Erik's Caspio photos + 3 customer stripe samples) + how-it-works + FAQ + CTA→request-a-quote (+ screenprint builder). Compliance-careful: hi-vis apparel ≠ certified ANSI garment (CSV405 vest is certified). cross-links CornerStone (both directions). canonical + BreadcrumbList + FAQPage JSON-LD. 1st cross-brand use-case page after golf | golf-tournament-showcase.css | ✅ Active (NEW 2026-07-13) |
| `/pages/golf-tournaments-2026.html` | Golf Tournament Apparel USE-CASE landing page (clean URL `/golf-tournament-apparel` + `/golf-tournaments`) — rich campaign page: hero, live-pricing product showcase + EmailJS quote form (golf-tournament-showcase.js), pricing tiers, proof gallery, FAQ. SEO-wired 2026-07-13: canonical, BreadcrumbList+FAQPage JSON-LD, brand cross-links, in sitemap | golf-tournament-showcase.css, golf-tournament-showcase.js, embroidery-pricing-service.js, base-quote-service.js | ✅ Active |
| `/pages/css/custom-carhartt.css` | SHARED brand-landing layer (hero, family grids, tiles, FAQ, CTA band) — used by /custom-carhartt AND /custom-richardson (.cch- classes; rename to brand-landing.* when a 3rd page ships) | nwca-2026-core.css | ✅ Active (NEW 2026-07-12) |
| `/pages/js/custom-carhartt.js` | SHARED brand-landing chrome wiring (drawer + masthead search → /?q=) — used by both brand landing pages; page content is static | — | ✅ Active (NEW 2026-07-12) |
| `/pages/custom-caps.html` | Custom Hats storefront (future /custom-caps) — 9-style cap gallery (/api/caps/catalog), logo upload + proof panel, OSFA qty + tier ladder, Stripe checkout (channel:'custom-caps'). Absolute /pages/ asset paths — clean-URL serving | custom-caps-app.js, custom-caps-pricing.js, custom-caps.css, app.config.js | ✅ Built |
| `/pages/custom-caps-success.html` | Post-payment success page (Stripe redirect target per registry stripeSuccessPath) | custom-caps-success.js, custom-caps.css | ✅ Built |
| `/pages/js/custom-caps-app.js` | App core: catalog gallery w/ live from-prices, per-style CAP bundle loads, color-aggregated SanMar stock (never per-size — stale sized partIds), 8-cap-min inline error, back-logo CAP-AL add-on, tax lookup, 4-step checkout pipeline → POST /api/create-checkout-session | CAPSPricing, app.config.js, proxy /api/caps/catalog + /api/pricing-bundle + /api/sanmar/inventory + /api/service-codes + /api/tax-rates/lookup + /api/files/upload | ✅ Built |
| `/pages/js/custom-caps-success.js` | Success-page logic: polls quote session (refresh=true), proof-first timeline/promise copy from server-stamped settings, clears caps_studio_v1, EmailJS FALLBACK sends gated on webhook emailsSentAt stamp | app.config.js, EmailJS | ✅ Built |
| `/pages/css/custom-caps.css` | Storefront + success styling (press-room editorial tokens layered from the custom-tees look; cap-native: proof panel, tier ladder, OSFA steppers) | — | ✅ Built |
| `/pages/js/custom-caps-pricing.js` | PURE pricing engine for Custom Hats — EMB CAP PARITY: blank OSFA ÷ tier margin + EmbroideryCost(tier, 8K) → CeilDollar; CAP-AL back-logo flat tier add-on; 8-cap minimum enforced (structured BELOW_MINIMUM error — 1-7 LTM tier unreachable); NO LTM/digitizing lines; CAPS-SHIP-* threshold shipping fail-closed. Jest-locked. | — (dual browser/Node; server.js requires it) | ✅ Built |
| `/tests/unit/custom-caps-pricing.test.js` | Jest parity lock vs the verified 9-style lineup (112/C402/112PFP/256/258/220/C914/STC26/CT105298 @ qty 8/24/48/72), back-logo tiers, qty<8 structured error, fail-closed throws, CeilDollar edges | custom-caps-pricing.js | ✅ Active |

### Other Pages (Undocumented Until 2026-02-27)
| File | Purpose | Dependencies | Status |
|------|---------|--------------|--------|
| `/pages/dtg-compatible-products.html` | DTG-compatible products listing | — | ✅ Active |
| `/pages/sample-cart.html` | Sample ordering cart + checkout page — **RESKINNED on nwca-2026 (2026-07-06)**, inline monolith extracted per Rule 3 | sample-cart.css, sample-cart-page.js, sample-checkout.js, sample-order-service.js, sample-inventory-service.js, nwca-2026-core.css | ✅ Active |
| `/pages/css/sample-cart.css` | **NEW (2026-07-06)** Sample Cart page styles on 2026 tokens (replaces the legacy inline style monolith); styles the SAME class names the extracted renderer emits + legacy token bridge (--primary-color → --green-700) | nwca-2026-core.css | ✅ Active |
| `/pages/js/sample-cart-page.js` | **NEW (2026-07-06)** Sample Cart page controller — extracted VERBATIM from the legacy inline script (cart load + upcharge migration, inventory check, render, free-flow direct ShopWorks submit, EmailJS notify) minus debug chatter + old chrome; adds 2026 drawer/search wiring. Paid carts delegate to sample-checkout.js. | sample-order-service.js, sample-inventory-service.js, sample-checkout.js, EmailJS | ✅ Active |
| `/shared_components/js/sticker-pricing-service.js` | Sticker pricing service — fetches `/api/sticker-pricing` Caspio table; INLINE_GRID now includes PartNumber + 6×6 tier (50 SKUs total). Used by the sticker quote page (sticker-pricing-page.js) | — | ✅ Active |
| `/shared_components/js/sticker-pricing-page.js` | **NEW (2026-05-15)** Sticker + Banner quote page logic — renders sticker pricing tables (`/api/sticker-pricing`) AND banner rate card (`/api/banner-pricing`), drives AI chat (SSE via `/api/contract-sticker-ai/chat` which handles BOTH product lines), parses PRICE_QUOTE/CUSTOMER_FINAL/EMAIL DRAFT blocks, highlights sticker rows OR banner rate cards based on `productType`, renders inline banner-quote card, saves to `quote_sessions` with STK prefix | sticker-pricing-service.js, sticker-manual-pricing.html | ✅ Active |
| `/shared_components/js/emblem-pricing-service.js` | Embroidered emblem/patch pricing service — fetches `/api/emblem-pricing`; falls back to inline grid (16 sizes × 10 qty tiers + LTM/digitizing/add-on rules) until Caspio table is deployed | — | ✅ Active |
| `/shared_components/js/order-form-size-suffix.js` | Isomorphic ShopWorks size-suffix mapping (PC61 → PC61_2X / PC61_3XL etc.). `require()`d by server.js for ShopWorks push size mapping (the browser copy was only loaded by the Order Form, retired 2026-07-11). Single source of truth — verified against the 15,152-row ShopWorks CSV | — | ✅ Active |
| `/shared_components/js/sanmar-inventory-check.js` | **MOVED 2026-07-11** from `/pages/order-form/inventory/inventory-check.js` (Order Form retired) — SanMar per-size inventory fetch (`/api/sanmar/inventory/{style}?color=`, 5-min cache, 2XL/XXL alias) + `classifyInventory()`. Exposes `window.OrderFormInventory` (legacy global name kept — every consumer references it). Stock badges for ALL 4 quote builders: EMB/SCP/DTF via inventory-badges.js, DTG via builders/dtg/catalog-search.js + form-core.js | — | ✅ Active |
| `/pages/css/policies-hub.css` | Policies hub page styles | — | ✅ Active |
| `/pages/css/utilities.css` | Shared utility CSS for pages | — | ✅ Active |
| `/pages/policies/dtg-artwork-checklist.html` | DTG artwork preparation checklist | — | ✅ Active |

### SanMar Catalog Color Audit (NEW 2026-05-02)
| File | Purpose | Dependencies | Status |
|------|---------|--------------|--------|
| `/pages/sanmar-catalog-color-audit.html` | Diagnostic page — diffs Caspio `Sanmar_Bulk_251816_Feb2024` vs SanMar's live `mainframeColor` per style. Read-only, surfaces rejection candidates for ShopWorks→SanMar PO pushes | sanmar-catalog-color-audit.js, sanmar-catalog-color-audit.css | ✅ Active |
| `/pages/sanmar-catalog-color-audit.js` | Audit page controller — fetches `/api/sanmar/catalog-color-audit/:style`, renders 5 buckets (inSync / caspioMismatch / caspioOrphan / sanmarOnly / internalDrift), Copy-CSV per bucket | /api/sanmar/catalog-color-audit (proxy) | ✅ Active |
| `/pages/sanmar-catalog-color-audit.css` | Audit page styles — summary cards, bucket tables, sticky headers | — | ✅ Active |

### SanMar PO Integration — Planning Docs (NEW 2026-06-23)
| File | Purpose | Dependencies | Status |
|------|---------|--------------|--------|
| `/memory/sanmar-po/` | Outbound SanMar **PO submission** (blank ordering) — review/plan/field-mapping/onboarding + buildable PO templates (`po-payload.schema.json`, `po-sample.json`, `submitPO`/`getPreSubmitInfo` SOAP skeletons). Distinct from the read-side `/memory/SANMAR_API_REFERENCE.md`. Code (when built) lands in `caspio-pricing-proxy`. | PO Integration Guide v24.3; caspio-pricing-proxy `sanmar-soap.js` | 🟡 Reference (review/not built) |

### Box Labels - Shipping & Receiving (NEW 2026-04-01)
| File | Purpose | Dependencies | Status |
|------|---------|--------------|--------|
| `/pages/box-labels.html` | Box label management page — lookup, drag/drop, print labels | box-labels.js, box-labels.css, SortableJS, jsPDF, JsBarcode, qrcode-generator | ✅ Active |
| `/pages/js/box-labels.js` | Box management logic — API calls, drag/drop, PDF generation | SortableJS CDN, jsPDF CDN, JsBarcode CDN | ✅ Active |
| `/pages/css/box-labels.css` | Box labels page styling — production-floor UI | — | ✅ Active |

### Customer Portal (NEW 2026-03-21)
| File | Purpose | Dependencies | Status |
|------|---------|--------------|--------|
| `/pages/customer-portal.html` | Customer-facing portal at `/portal/:customerId` — mockups + art requests, no login (URL = token) | customer-portal.js, customer-portal.css, app-config.js | ✅ Active |
| `/pages/js/customer-portal.js` | Portal controller — fetches mockups + art requests by customer ID | /api/mockups, /api/artrequests | ✅ Active |
| `/pages/css/customer-portal.css` | Portal styling (responsive cards, branded) | — | ✅ Active |
| `/pages/customer-login.html` | Magic-link login page at `/customer/login` — email entry → "check your email" (passwordless, invite-only, #6 Phase 1) | customer-login.js/.css | ✅ Active |
| `/pages/js/customer-login.js` | Login logic — POSTs `/auth/customer/request-link`; always shows the same "check your email" state (no account enumeration) | server.js POST /auth/customer/request-link | ✅ Active |
| `/pages/css/customer-login.css` | Login page styling (branded green card) | — | ✅ Active |
| `/lib/customer-magic-link.js` | Magic-link + session token crypto (HMAC mint/verify; MAGIC_LINK_SECRET link / SESSION_SECRET cookie) for the authenticated customer portal | server.js (loadCustomerSession, /auth/customer/*) | ✅ Active |
| `/lib/cors-allowlist.js` | CORS EXACT-match origin allowlist (roadmap 1.2) — kills endsWith look-alike + *.herokuapp.com wildcard; env-extensible via CORS_ALLOWED_ORIGINS; dev localhost gated out of production | server.js CORS middleware; tests/unit/cors-origin-allowlist.test.js | ✅ Active |
| `/pages/customer-invoice.html` | ShopWorks-style invoice page at `/portal/invoice/:orderNo` (session-gated) — on-screen + Download PDF (html2pdf) | customer-invoice.js/.css | ✅ Active |
| `/pages/js/customer-invoice.js` | Fetches `/api/portal/invoice/:orderNo` (ownership-checked), renders the invoice (header/line-items/sizes/totals), wires html2pdf download | server.js GET /api/portal/invoice | ✅ Active |
| `/pages/css/customer-invoice.css` | Invoice paper styling (print-friendly) | — | ✅ Active |
| `/pages/customer-product.html` | Portal product-detail page at `/portal/product/:style` (session-gated) — specs, all colors, order-history size matrix, traffic-light availability, re-order (Phase B, 2026-07-01) | customer-product.js/.css, customer-portal.css, app-config.js | ✅ Active |
| `/pages/js/customer-product.js` | Fetches `/api/portal/product/:style` (+ preview mirror), renders specs/swatch gallery/size matrix/availability/re-order; POSTs `/api/portal/reorder-request` | server.js GET /api/portal/product | ✅ Active |
| `/pages/css/customer-product.css` | Product-detail page styling (layers on customer-portal.css tokens) | customer-portal.css | ✅ Active |
| `/pages/js/portal-reorder-list.js` | Shared multi-item "Re-order List" (2026-07-04) — floating FAB + drawer; sessionStorage-persisted across portal pages; "Send all" POSTs `/api/portal/reorder-batch` (grouped Batch_Num, no price). Loaded on product page + portal home | server.js POST /api/portal/reorder-batch | ✅ Active |
| `/pages/css/portal-reorder-list.css` | Re-order List floating button + drawer styling (portal --cp-* tokens w/ fallbacks) | — | ✅ Active |

### Vendor Portal — L&P Screen Printing subcontractor (NEW 2026-07-19)
| File | Purpose | Dependencies | Status |
|------|---------|--------------|--------|
| `/pages/vendor-portal.html` | Subcontractor job portal at `/vendor` (session-gated) — Ed Lacey / L&P sees every `Method='Screen Print'` transfer order: work-order details, print lines, artwork + working-file downloads (Box links), activity timeline + post-a-note. Replaces the email-everything-to-Ed process | vendor-portal.js/.css, caspio-date-utils.js, server.js /api/vendor/* | ✅ Active |
| `/pages/js/vendor-portal.js` | Portal controller — list/filter/search cards, `#job=` deep links, detail render (meta/lines/files/mockup/notes), note posting; same-origin `/api/vendor/*` only (never hits the proxy directly) | server.js GET /api/vendor/jobs[,/:id], POST /api/vendor/jobs/:id/notes | ✅ Active |
| `/pages/css/vendor-portal.css` | Vendor portal styling (self-contained; NWCA green brand, status badges, cards/files/timeline) | — | ✅ Active |
| `/pages/vendor-login.html` | Vendor magic-link login page at `/vendor/login` (passwordless, invite-only via proxy `Vendor_Portal_Access`) | vendor-login.js, customer-login.css (shared) | ✅ Active |
| `/pages/js/vendor-login.js` | Vendor login logic — POSTs `/auth/vendor/request-link`; constant "check your email" state (no account enumeration) | server.js POST /auth/vendor/request-link | ✅ Active |
| `/lib/vendor-magic-link.js` | Vendor magic-link + session token crypto (HMAC; distinct `vlink`/`vsess` type tags so customer/staff tokens can never be replayed as vendor sessions; nwca_vendor cookie) | server.js (loadVendorSession, /auth/vendor/*, requireVendor) | ✅ Active |

### Mockup Detail Page (NEW 2026-04)
| File | Purpose | Dependencies | Status |
|------|---------|--------------|--------|
| `/pages/mockup-detail.html` | Single-mockup detail page — full image, design info, history | mockup-detail.js, mockup-detail.css | ✅ Active |
| `/pages/js/mockup-detail.js` | Mockup detail controller — fetches record + thumbnails, history timeline | /api/mockups/:id | ✅ Active |
| `/pages/css/mockup-detail.css` | Mockup detail styling | — | ✅ Active |

### Supacolor Job Detail (NEW 2026-04)
| File | Purpose | Dependencies | Status |
|------|---------|--------------|--------|
| `/pages/supacolor-job-detail.html` | Single Supacolor job detail page — sync status, line items | supacolor-job-detail.js, supacolor-job-detail.css | ✅ Active |
| `/pages/js/supacolor-job-detail.js` | Supacolor job detail controller — fetches job, sync trigger, status badges | /api/supacolor-jobs/:jobNumber | ✅ Active |
| `/pages/css/supacolor-job-detail.css` | Supacolor job detail styling (matches dashboard theme) | — | ✅ Active |

### Embroidery Contract Pricing (Page-Level Assets)
| File | Purpose | Dependencies | Status |
|------|---------|--------------|--------|
| `/pages/embroidery-contract-pricing.js` | Contract embroidery pricing logic for shareable customer page | /api/embroidery-costs, app-config.js | ✅ Active |
| `/pages/embroidery-contract-pricing.css` | Contract embroidery pricing page styles | — | ✅ Active |

## 📊 Calculators & Quote Builders

### Quick Quote (staff rapid all-method)
| File | Purpose | Dependencies | Status |
|------|---------|--------------|--------|
| `/calculators/quick-quote/index.html` | Staff rapid price lookup — type style + qty + placement → every eligible method priced at once. No customer record/save. Linked from staff dashboard "Quote Builders". | quick-quote.js, quick-quote.css, quote-cart-engine.js, all 5 pricing services, decoration-methods.js, app.config.js | ✅ Active |
| `/calculators/quick-quote/quick-quote.js` | Page logic — drives `QuoteCartEngine.singleItemPreview()` (SAME engine as the Quote Builder + customer catalog, so prices can't drift). Cap-aware placements, per-size 2XL+ breakdown, advanced stitch-count/ink/dark/stripes inputs. Style lookup via `/api/product-details`; eligibility via DecorationMethods. **Two modes: Quick Price (1 style, every method) + Line Sheet (1 method, up to 6 styles → branded one-page PDF via window.print; each style priced independently via `probeLadder`, never summed).** | quote-cart-engine.js, embroidery-quote-pricing.js, all 5 *-pricing-service.js, decoration-methods.js, /api/product-details | ✅ Active |
| `/calculators/quick-quote/quick-quote.css` | Page styles — self-contained light card UI; includes Line Sheet mode (mode toggle, style list, on-screen sheet preview) | — | ✅ Active |
| `/calculators/quick-quote/linesheet-print.css` | Print stylesheet (`media="print"`) for Line Sheet mode — strips app chrome, prints only `#qqSheet` as a one-page NWCA line sheet (Print / Save as PDF). Scoped to `body.qq-mode-line`. | quick-quote.js (toggles body class), index.html | ✅ Active |
| `/calculators/quick-quote/dtf-prints-prototype.html` | **Prototype** — DTF "logo = size + position" model: add prints, each a size + position, priced by size via the live DTFPricingService. Not linked from anywhere (noindex); evaluates a unified placement model before touching live tools. | dtf-prints-prototype.js, dtf-prints-prototype.css, quick-quote.css, dtf-pricing-service.js, app.config.js | 🧪 Prototype |
| `/calculators/quick-quote/dtf-prints-prototype.js` | Prototype logic — prices a list of (size, position) prints through `DTFPricingService.calculatePriceForQuantity` (sums per-size transfer + $2.50 labor + freight). DTF-only, no engine/cart dependency. | dtf-pricing-service.js, app.config.js | 🧪 Prototype |
| `/calculators/quick-quote/dtf-prints-prototype.css` | Prototype styles — layers on quick-quote.css tokens (prints rows + breakdown only) | quick-quote.css | 🧪 Prototype |

### Unified Manual Pricing Calculator
| File | Purpose | Dependencies | Status |
|------|---------|--------------|--------|
| `/calculators/manual-pricing.html` | Unified manual pricing — all 5 methods on one page | manual-pricing.js, manual-pricing.css, all 5 pricing services | ✅ Active |
| `/calculators/manual-pricing.js` | Page logic — orchestrates DTG/DTF/EMB/CAP/SP pricing services | All 5 *-pricing-service.js files | ✅ Active |
| `/calculators/manual-pricing.css` | Page styles — extends manual-calculator-styles.css | manual-calculator-styles.css | ✅ Active |

### Service Price Cheat Sheet
| File | Purpose | Dependencies | Status |
|------|---------|--------------|--------|
| `/calculators/service-price-cheat-sheet.html` | Printable service price reference — all embroidery service prices | service-price-cheat-sheet.js, .css, app-config.js | ✅ Active |
| `/calculators/service-price-cheat-sheet.js` | API-driven price fetching and rendering | /api/service-codes, /api/decg-pricing, /api/al-pricing | ✅ Active |
| `/calculators/service-price-cheat-sheet.css` | Page styles with print-friendly layout | — | ✅ Active |

### Compare Pricing by Style
| File | Purpose | Dependencies | Status |
|------|---------|--------------|--------|
| `/calculators/compare-pricing.html` | Compare pricing by SanMar style — all methods on one page | compare-pricing.js, compare-pricing.css, manual-pricing.css, all 5 pricing services | ✅ Active |
| `/calculators/compare-pricing.js` | Page logic — fetches SanMar product data then pricing | All 5 *-pricing-service.js files | ✅ Active |
| `/calculators/compare-pricing.css` | Page styles — product info banner, extends manual-pricing.css | manual-pricing.css, manual-calculator-styles.css | ✅ Active |

### DTG System
| File | Purpose | Dependencies | Status |
|------|---------|--------------|--------|
| `/calculators/dtg-pricing.html` | DTG pricing calculator | dtg-adapter.js, dtg-pricing-service.js | ✅ Active |
| `/calculators/dtg-manual-pricing.html` | ~~DELETED~~ Manual DTG pricing — superseded by `/calculators/manual-pricing.html` (unified) | — | ❌ Deleted |
| `/calculators/archive/manual-pricing-deprecated/dtg-manual-pricing.html` | Archived pre-unification DTG manual calculator | — | 📦 Archived |
| `/quote-builders/dtg-quote-builder.html` | **DTG flagship (v14, 2026-05-19+).** Manual-first inline-form DTG quote builder + DTG AI bot + Submit-to-ShopWorks + sales tax (per-address WA DOR lookup, exempt/pickup/out-of-state) + order-summary band. Legacy iframe REMOVED (legacy builder deleted 2026-06-08; `/quote-builders/dtg-quote-builder-legacy.html` 301-redirects here). This is the sole DTG builder. | builders/dtg/* (bundle), dtg-quote-page.js, dtg-pricing-service.js, quote-order-summary.js | ✅ Active |
| ~~`/shared_components/js/dtg-quote-pricing.js`~~ | **DELETED 2026-06-09** — dead legacy DTG quote pricing engine; only consumer was the also-dead dtg-quote-products.js. No HTML loaded it. | — | ❌ Deleted |
| `/shared_components/js/dtg-quote-products.js` | DTG quote product manager (⚠️ legacy — was loaded by the deleted legacy builder; dead-code candidate; refs now-deleted DTGQuotePricing) | SanMar API | ⚠️ Orphan? |
| `/shared_components/js/dtg-quote-system.js` | DTG quote system orchestrator (⚠️ legacy — dead-code candidate) | — | ⚠️ Orphan? |

### DTF System

#### DTF Pricing Calculator (Customer-facing)
| File | Purpose | Dependencies | Status |
|------|---------|--------------|--------|
| `/calculators/dtf-pricing.html` | DTF pricing page | dtf-pricing-calculator.js, dtf-pricing-service.js | ✅ Active |
| `/pricing/dtf/index.html` | ~~PATH NEVER EXISTED~~ — actual DTF page is at `/calculators/dtf-pricing.html` | — | ❌ Stale path |
| `/shared_components/js/dtf-pricing-calculator.js` | DTF calculator UI & pricing logic | dtf-pricing-service.js, DTFConfig | ✅ Active |
| `/shared_components/js/dtf-pricing-service.js` | API data fetcher & transformer | Caspio API | ✅ Active |
| `/shared_components/js/dtf-integration.js` | Coordinates calculator, adapter, events | dtf-pricing-calculator.js | ✅ Active |
| `/shared_components/js/dtf-adapter.js` | Caspio data adapter | Caspio API | ✅ Active |
| `/shared_components/js/dtf-config.js` | Location mappings (no pricing values) | - | ✅ Active |
| `/shared_components/css/dtf-toggle-pricing.css` | Toggle interface styles | - | ✅ Active |

#### DTF Quote Builder (Staff)
| File | Purpose | Dependencies | Status |
|------|---------|--------------|--------|
| `/quote-builders/dtf-quote-builder.html` | DTF Quote Builder 2026 (Excel-style) | 4 JS files below | ✅ Active |
| `/shared_components/js/dtf-quote-builder.js` | **TOMBSTONE (2026-07-08)** — the DTF monolith is fully decomposed into `builders/dtf/*` (class + state/adapter + output/push + index boot); the page loads ONLY the bundle. Kept so stale references fail loudly. | (none — do not add code) | 🪦 Tombstone |
| `/shared_components/js/dtf-quote-pricing.js` | **CONSOLIDATED** Pricing + Config + Service | Caspio API | ✅ Active |
| `/shared_components/js/dtf-quote-products.js` | DTF quote product manager | ExactMatchSearch | ✅ Active |
| `/shared_components/js/dtf-quote-service.js` | DTF quote database service | EmailJS, Caspio API | ✅ Active |
| `/shared_components/css/dtf-quote-builder.css` | DTF quote builder styles (green theme) | - | ✅ Active |

**DTF Formula Alignment (2026-01-07):** Fixed dtf-pricing-calculator.js to use pre-transformed API data from service. Both calculator and quote builder now use identical pricing formula. See `/memory/DTF_PRICING_SYSTEM.md`.

### Embroidery System
| File | Purpose | Dependencies | Status |
|------|---------|--------------|--------|
| `/calculators/embroidery-pricing-all/index.html` | **CORPORATE-ONLY** Embroidery pricing page — Additional Logo · Customer Supplied Garments · Additional Stitches · Full Back Embroidery tabs. Contract Embroidery split off into its own standalone page (`/calculators/embroidery-contract/`) Round 6 / 2026-05-13. Old `?tab=contract` URLs redirect via JS. | embroidery-pricing-all.js | ✅ Active |
| `/calculators/embroidery-pricing-all/embroidery-pricing-all.js` | Corporate embroidery pricing logic (AL retail + DECG retail + stitch surcharges + Full Back) | /api/al-pricing, /api/decg-pricing, /api/pricing-bundle?method=EMB | ✅ Active |
| `/calculators/embroidery-pricing-all/embroidery-pricing-all.css` | Tabbed interface styles | - | ✅ Active |
| `/calculators/embroidery-contract/index.html` | **Round 7 (2026-05-14)** Editorial Contract Embroidery pricing page. Replaced the Round 6 minimal-pink page with a magazine-style layout extracted from the Claude Designer mockup: top bar with theme chip, editorial hero (serif title with italic year + 3-fact aside), 2-column calculator card with pink-gradient result panel + 72px hero price, 3-card callouts, tabbed pricing tables (Garment / Cap / Full Back) with live active-tier-column + current-stitch-row + intersection-cell highlighting, ShopWorks parts row, dark contact card with numbered checklist, footnote. Single-tier wholesale pricing for Ruthie / ASI distributors who supply their own blanks. | embroidery-contract.js, embroidery-contract.css, Google Fonts (Fraunces, Geist, Geist Mono) | ✅ Active |
| `/calculators/embroidery-contract/embroidery-contract.js` | **Round 7 (2026-05-14)** Standalone calculator JS for the Contract Embroidery page. Fetches `/api/contract-pricing`, builds 3 pricing matrices, drives the editorial UI (segmented item picker, qty/stitch presets, hero serif price, live table highlighting), supports URL-param share-links (`?type=&qty=&stitches=`) — Ruthie types inputs, copies a share-URL, customer clicks the URL and sees the calculator pre-filled with the same quote. No ES-module deps; pure browser JS. | /api/contract-pricing | ✅ Active |
| `/calculators/embroidery-contract/embroidery-contract.css` | **DEDUP (2026-05-29)** Now page-specific ONLY (~137 lines): segmented item-type picker (`.seg`), pricing-table tabs (`.tabs`), `.divider`, two-column qty/stitch row (`.calc-form .row`), tfoot active-column highlight, + seg/tabs focus rings. All shared chrome (tokens, top bar, hero, calc shell, result panel, buttons, table base, contact, footer, AI chat panel) moved to `/shared_components/css/contract-pricing-2026.css`, loaded BEFORE this file so page rules win the cascade. | contract-pricing-2026.css, Google Fonts | ✅ Active |
| `/shared_components/css/contract-pricing-2026.css` | **NEW (2026-05-29)** Shared editorial chrome for BOTH contract calculators (`embroidery-contract` + `dtg-contract`): design tokens, top bar, hero, calculator shell, result panel, totals, buttons, pricing-table base, contact card, footnote, toast, pricing-error, and the entire AI chat panel (~1,207 lines). Eliminates the ~1,090 lines that were copy-pasted between the two pages. Loaded BEFORE each page's own CSS so page rules win the cascade. **Bump the `?v=` on BOTH pages when editing this file.** | embroidery-contract.css, dtg-contract.css | ✅ Active |
| `/quote-builders/embroidery-quote-builder.html` | Embroidery/Cap Combo Quote Builder 2026 (Excel-style) | embroidery-quote-pricing.js | ✅ Active |
| `/shared_components/js/embroidery-quote-pricing.js` | Embroidery pricing engine (tiers, LTM, stitch surcharges, FB) | Caspio API | ✅ Active |
| `/shared_components/js/embroidery-quote-service.js` | Embroidery quote save/update/email service | Caspio API, EmailJS | ✅ Active |
| `/shared_components/js/embroidery-quote-invoice.js` | Embroidery invoice generation (ShopWorks format) | — | ✅ Active |
| `/shared_components/js/quote-pricing-data.js` | Shared `pricingData` contract (Phase 3.1) — builds + validates the shape all 4 quote builders pass to `embroidery-quote-invoice.js`. Normalizes method→flags, percent tax→decimal, zero-fills fee fields. | — | ✅ Active |
| `/shared_components/js/quote-services-bar.js` | Persistent, catalog-driven "Add to order" services bar (2026-06-03) — `QuoteServicesBar.render(mountId, catalog, onAdd)`; clicking a chip adds that service as a line item. Reusable across EMB/SCP/DTG/DTF (each passes its own catalog). | quote builders | ✅ Active |
| `/shared_components/js/embroidery-quote-adapter.js` | Embroidery data adapter (Caspio → pricing engine) | Caspio API | ✅ Active |

> `embroidery-quote-logos.js` + `embroidery-quote-products.js` DELETED 2026-07-07 (expert audit): zero `<script>` references repo-wide, encoded an OLDER ruleset than the live builder (a fix applied there was a silent no-op), yet were documented ✅ Active — exactly the drift ACTIVE_FILES.md exists to prevent. Live logo/product logic is all in `embroidery-quote-builder.js`.

### Screen Print System
| File | Purpose | Dependencies | Status |
|------|---------|--------------|--------|
| `/calculators/screen-print-pricing.html` | Screen print calculator | screenprint-pricing-v2.js, screenprint-pricing-service.js | ✅ Active |
| `/quote-builders/screenprint-quote-builder.html` | Screen Print Quote Builder 2026 (Excel-style) | screenprint-pricing-service.js | ✅ Active |
| `/shared_components/js/screenprint-quote-products.js` | Screen print quote product manager | SanMar API | ✅ Active |
| `/shared_components/js/screenprint-quote-service.js` | Screen print quote save/email service | Caspio API, EmailJS | ✅ Active |
| `/quote-builders/screenprint-fast-quote.html` | Fast quote form (60 sec) | screenprint-fast-quote-service.js | ✅ Active |
| `/shared_components/js/screenprint-pricing-v2.js` | Main calculator logic | screenprint-pricing-service.js | ✅ Active |
| `/shared_components/js/screenprint-pricing-service.js` | Pricing data adapter | Caspio API | ✅ Active |
| `/shared_components/js/screenprint-fast-quote-service.js` | Fast quote service | EmailJS, Caspio API | ✅ Active |
| `/tests/unit/scp-dark-garment-parity.test.js` | **NEW (2026-06-11)** Rule-7 lock: calculator dark-garment underbase = setup screen only, per-piece by RAW colors — parity vs builder worked-example fixtures (covers v2 + manual calculator) | jest, screenprint-pricing-v2.js, screenprint-manual-pricing.js | ✅ Active |

### Monogram Form System (NEW 2026-01-08)
| File | Purpose | Dependencies | Status |
|------|---------|--------------|--------|
| `/quote-builders/monogram-form.html` | Monogram/personalization tracking form | monogram-form-service.js, monogram-form-controller.js | ✅ Active |
| `/shared_components/js/monogram-form-service.js` | API service (ManageOrders, Caspio) | ManageOrders API | ✅ Active |
| `/shared_components/js/monogram-form-controller.js` | UI controller and state management | monogram-form-service.js | ✅ Active |
| `/shared_components/css/monogram-form.css` | Monogram form styling | quote-builder-common.css | ✅ Active |
| `/memory/MONOGRAM_FORM_SYSTEM.md` | Implementation documentation | - | 📚 Docs |

**Features:** Order lookup from ShopWorks, dynamic name entry (up to 50), print PDF for production, search by order/company.

### Cap Embroidery System
| File | Purpose | Dependencies | Status |
|------|---------|--------------|--------|
| `/calculators/cap-embroidery-pricing-integrated.html` | SanMar cap pricing (23 Richardson styles) | cap-embroidery-pricing-service.js | ✅ Active |
| `/calculators/richardson-2025.html` | Richardson Factory Direct pricing (133 styles) | richardson-factory-direct.js | ✅ Active |
| `/calculators/richardson-factory-direct.js` | Richardson pricing lookup (2026 refactor - simplified) | API pricing-bundle | ✅ Active |
| `/calculators/richardson-2025-styles.css` | Richardson page styles | - | ✅ Active |

### Webstore System
| File | Purpose | Dependencies | Status |
|------|---------|--------------|--------|
| `/calculators/webstores.html` | **REWRITTEN (2026-05-16)** Custom webstore quote + fundraiser pricing page — AI-first redesign mirroring sticker/emblem layout. Bot handles BOTH store-setup quotes AND per-item fundraiser math via 4 tools (lookup_customer + 2 pricing + web_search). External CSS/JS only. | sticker-pricing-page.css, webstore-pricing-page.css, webstore-pricing-page.js | ✅ Active |
| `/calculators/webstores-calculator.js` | 🗄️ Pre-AI store-setup logic. Save flow + math now handled inline in webstore-pricing-page.js (same WEB prefix). Delete after soak. | — | 🗄️ Legacy (delete ~2026-06-16) |
| `/calculators/webstores-fundraiser.js` | 🗄️ Pre-AI fundraiser pricing calculator. Math now in `quote_fundraiser_pricing` tool on the proxy. Delete after soak. | — | 🗄️ Legacy (delete ~2026-06-16) |
| `/calculators/webstores-quote-service.js` | 🗄️ Pre-AI quote save service. Save flow now in webstore-pricing-page.js (same Caspio endpoints, same WEB prefix). Delete after soak. | base-quote-service.js | 🗄️ Legacy (delete ~2026-06-16) |
| `/calculators/webstores-styles.css` | 🗄️ Pre-AI page styles. New page uses sticker-pricing-page.css + webstore-pricing-page.css. Delete after soak. | — | 🗄️ Legacy (delete ~2026-06-16) |

### Special Calculators
| File | Purpose | Dependencies | Status |
|------|---------|--------------|--------|
| `/calculators/christmas-bundles.html` | Christmas bundle | christmas-bundle-service.js, product-search-service.js | ✅ Active |
| `/calculators/christmas-bundle-service.js` | Christmas bundle pricing/quote service | base-quote-service.js | ✅ Active |
| `/calculators/christmas-bundle-emailjs-template.html` | EmailJS HTML template for Christmas bundle | EmailJS service | ✅ Active |
| `/calculators/archive/seasonal-2025/breast-cancer-awareness-bundle.html` | BCA bundle (Oct 2025 promo - archived) | breast-cancer-bundle-service.js | 📦 Archived |
| `/calculators/archive/seasonal-2025/breast-cancer-awareness-bundle-tailwind.html` | BCA bundle Tailwind variant | breast-cancer-bundle-service.js | 📦 Archived |
| `/calculators/archive/seasonal-2025/breast-cancer-bundle-service.js` | BCA bundle quote/email service | EmailJS | 📦 Archived |
| `/calculators/archive/seasonal-2025/breast-cancer-sales-email.html` | BCA promotional email body | EmailJS | 📦 Archived |
| `/calculators/safety-stripe-creator.html` | Safety stripes creator (drag-drop config builder) | safety-stripe-calculator.js, safety-stripe-creator-service.js | ✅ Active |
| `/calculators/safety-stripe-calculator.js` | Safety stripes pricing logic | screenprint-pricing-service.js | ✅ Active |
| `/calculators/safety-stripe-creator-service.js` | Safety stripes quote save/email service | base-quote-service.js, EmailJS | ✅ Active |
| `/calculators/art-invoice-creator.html` | Art invoices | art-invoice-service-v2.js | ✅ Active |
| `/calculators/art-invoice-service-v2.js` | Art invoice creation/save/email service (v2) | Caspio API, EmailJS | ✅ Active |
| `/calculators/art-invoice-emailjs-template.html` | EmailJS HTML template for art invoices | EmailJS service | ✅ Active |
| `/calculators/embroidery-manual-service.js` | Embroidery manual pricing service (used by unified manual calculator) | embroidery-pricing-service.js | ✅ Active |
| `/calculators/leatherette-patch-quote-service.js` | Leatherette patch (PATCH) quote save service | base-quote-service.js | ✅ Active |

### DTG Contract Pricing (Customer-facing)
| File | Purpose | Dependencies | Status |
|------|---------|--------------|--------|
| `/calculators/dtg-contract/index.html` | **REWRITTEN (2026-05-15)** Contract DTG editorial page — matches Contract Embroidery layout (Fraunces serif + pink accents + AI quote assistant). Replaces the old calculator-base.css layout. | dtg-contract.css, dtg-contract.js | ✅ Active |
| `/calculators/dtg-contract/dtg-contract.css` | **DEDUP (2026-05-29)** Now page-specific ONLY (~339 lines): location checkbox grid (`.loc*`), heavyweight toggle (`.hw-toggle*`), per-piece breakdown (`.pp-breakdown*`), per-location pricing-table extras (tfoot qty-col highlight + `.effective-row`), + location/toggle focus-within rings. All shared chrome moved to `/shared_components/css/contract-pricing-2026.css`, loaded BEFORE this file. | contract-pricing-2026.css | ✅ Active |
| `/calculators/dtg-contract/dtg-contract.js` | **NEW (2026-05-15)** Contract DTG calc + AI assistant. Hardcoded 4-tier pricing ($7.50/$6.75/$6.00/$5.25 per location), $50 LTM at qty≤23, +$1 heavyweight. AI panel calls `/api/contract-dtg-ai/chat`, saves quotes with `CDTG` prefix. | — | ✅ Active |

### Screen Print Customer Pricing (Customer-facing)
| File | Purpose | Dependencies | Status |
|------|---------|--------------|--------|
| `/calculators/screenprint-customer/index.html` | Customer-supplied-garment screen print pricing calculator (staff-used, linked from Staff Dashboard) — pre-submission price-tier ladder + live-pricing error banner (FIXED 2026-07-01) | screenprint-customer-calculator.js, screenprint-pricing-service.js, quote-cart-engine.js | ✅ Active |
| `/calculators/screenprint-customer/screenprint-customer-calculator.js` | Customer-facing screen print calculator logic — pricing = 100% live via `QuoteCartEngine.singleItemPreview({customerSuppliedGarment:true})`, SAME engine Quick Quote uses (FIXED 2026-07-01: was 100% hardcoded pricing, wrong tier boundaries/LTM/dark-garment math — see LESSONS_LEARNED) | quote-cart-engine.js, screenprint-pricing-service.js, calculator-utilities.js (escapeHTML), screenprint-customer-quote-service.js | ✅ Active |
| `/calculators/screenprint-customer/screenprint-customer-quote-service.js` | Screen print customer quote save service | base-quote-service.js | ✅ Active |
| `/calculators/screenprint-customer/screenprint-customer-styles.css` | Screen print customer page styles | — | ✅ Active |
| `/calculators/screenprint-customer/screenprint-customer-fix.css` | Screen print customer style fixes + tier-ladder/error-banner styles (2026-07-01) | — | ✅ Active |

### Embroidered Emblem Calculator
| File | Purpose | Dependencies | Status |
|------|---------|--------------|--------|
| `/calculators/embroidered-emblem/index.html` | **REWRITTEN (2026-05-16; hardened 2026-05-29)** Embroidered emblem patch quote page — AI-first, mirrors sticker layout. External CSS/JS only. Chat auto-opens with a STATIC greeting (no Claude call until the first rep message); accessible dialog (role=dialog/aria-modal/focus-trap/focus-return). | sticker-pricing-page.css, emblem-pricing-page.css, emblem-pricing-page.js | ✅ Active |
<!-- 4 pre-AI legacy files (emblem-calculator.js, emblem-quote-service.js, embroidered-emblem-styles.css, emblem-calculator-missing-styles.css) DELETED 2026-05-29 — unreferenced by index.html, confirmed via grep. Recover from git history if ever needed. -->


### Laser Tumbler & Sticker Calculators
| File | Purpose | Dependencies | Status |
|------|---------|--------------|--------|
| `/calculators/laser-tumbler-polarcamel.html` | Laser tumbler (Polar Camel) customer product page — color picker, formula-priced tier table, logo mockup + instant quote section. Prices 100% live via jds-api-service.js (Caspio JDS-* Service_Codes). | laser-tumbler-simple.js, laser-tumbler-mockup.js, jds-tumbler-template.js, jds-api-service.js, manageorders-inventory-service.js | ✅ Active |
| `/calculators/laser-tumbler-styles.css` | Laser tumbler page styles | — | ✅ Active |
| `/calculators/sticker-manual-pricing.html` | Sticker + banner + **custom/oversize decal** pricing page (AI quote chat). 2026-06-18: added the Custom & Oversize Decal square-foot calculator + API-driven rate card (cliff-protected ladder, $90 min, GRT-50 setup) for sizes >6×6 / odd dims the standard grid can't cover. Backed by proxy `/api/custom-decal-pricing`. | sticker-pricing-page.css, sticker-pricing-page.js, memory/CUSTOM_DECAL_PRICING_2026-06.md | ✅ Active |
| `/calculators/laser-manual-pricing.html` | Laser pricing calculator (manual) | manual-calculator-styles.css | ✅ Active |

### Caspio-Embedded Forms
| File | Purpose | Dependencies | Status |
|------|---------|--------------|--------|
| `/calculators/digitizingform.html` | Digitizing request form (Caspio-embedded) | Caspio datapage | ✅ Active |
| `/calculators/monogramform.html` | Monogram request form (Caspio-embedded) | Caspio datapage | ✅ Active |
| `/calculators/purchasingform.html` | Purchasing form (Caspio-embedded) | Caspio datapage | ✅ Active |

### Embroidery Pricing (Unified - Feb 2026)

**All embroidery pricing now consolidated in `/calculators/embroidery-pricing-all/`**

| File | Purpose | Dependencies | Status |
|------|---------|--------------|--------|
| `/calculators/embroidery-pricing-all/index.html` | Unified AL/CEMB + DECG pricing page | embroidery-pricing-all.js, .css | ✅ Active |
| `/calculators/embroidery-pricing.html` | Embroidery pricing calculator (garment + cap) | embroidery-pricing-service.js | ✅ Active |
| `/calculators/archive/embroidery-customer/*` | DECG standalone calculator (3 files: index.html, embroidery-customer-calculator.js, embroidery-customer-styles.css) | - | 📦 Archived |
| `/calculators/archive/embroidery-contract/*` | Contract embroidery calculator (5 files: index.html, embroidery-contract-calculator.js, embroidery-quote-service.js, embroidery-contract-fix.css, embroidery-contract-styles.css) | - | 📦 Archived |
| `/calculators/archive/embroidery-pricing.html` | Old embroidery pricing page | - | 📦 Archived |
| `/calculators/archive/manual-pricing-deprecated/*` | Pre-unification manual calculators (5 HTML: dtg, dtf, embroidery, screenprint, cap-embroidery — superseded by `/calculators/manual-pricing.html`) | - | 📦 Archived |
| `/calculators/archive/cap-embroidery-manual-pricing.html` | Pre-unification cap embroidery manual calculator | cap-embroidery-manual-service.js | 📦 Archived |
| `/calculators/archive/cap-embroidery-pricing-integrated.html` | Pre-unification integrated cap embroidery pricing | - | 📦 Archived |
| `/calculators/archive/cap-embroidery-manual-service.js` | Cap embroidery manual service (archived) | - | 📦 Archived |
| `/calculators/archive/cap-embroidery-fix.css` | Cap embroidery fix styles (archived) | - | 📦 Archived |

**AL/CEMB Pricing (Additional Logo / Contract Embroidery):**
- Garments: 5K base, $13→$5 (1-7 to 72+), +$1.00/1K
- Caps (AL-CAP/CB/CS): 5K base, $6.50→$4 (1-7 to 72+), +$1.00/1K
- Full Back (FB): $1.25/1K flat rate, 25K minimum
- LTM Fee: $50 for qty 1-7
- **API:** `/api/al-pricing`

**DECG Pricing (Customer-Supplied Embroidery):**
- Garments: $28-$20/pc (1-7 to 72+ tier) + $1.25/1K above 8K stitches
- Caps: $22.50-$16/pc (1-7 to 72+ tier) + $1.00/1K above 8K stitches
- Full Back: $1.40-$1.20/1K (8-23 to 72+ tier, **MIN 8 PIECES**, min 25K stitches)
- LTM Fee: $50 for 1-7 pieces (garments/caps only, not full back)
- Heavyweight Surcharge: +$10/piece (Carhartt jackets, bags, canvas, leather)
- **API:** `/api/decg-pricing`
- **Docs:** `/memory/DECG_PRICING_2026.md`, `/memory/EMBROIDERY_PRICING_RULES.md`

## 🔧 Services & Components

### Core JavaScript Services
| File | Purpose | Used By | Status |
|------|---------|---------|--------|
| `/config/app.config.js` | Central configuration - ALL hardcoded values | All pages | ✅ Active |
| `/shared_components/js/base-quote-service.js` | Base quote class | All quote builders | ✅ Active |
| `/shared_components/js/calculator-utilities.js` | Shared utilities | All calculators | ✅ Active |
| `/shared_components/js/utils.js` | General utilities | Multiple pages | ✅ Active |
| `/shared_components/js/app-config.js` | Legacy config (migrate to /config/) | DTF system | ⚠️ Deprecate |

### Adapters (Master Bundle Pattern)
| File | Purpose | Used By | Status |
|------|---------|---------|--------|
| `/shared_components/js/dtg-adapter.js` | DTG pricing adapter | DTG, DTF systems | ✅ Active |
| `/shared_components/js/dtf-adapter.js` | DTF pricing adapter | DTF system | ✅ Active |
| `/shared_components/js/embroidery-pricing-service.js` | Embroidery adapter | Embroidery system | ✅ Active |
| `/shared_components/js/golf-tournament-showcase.js` | **NEW** Golf tournament landing page logic — fetches Garment Tracker config + live embroidery pricing, renders product grid, handles EmailJS lead capture | embroidery-pricing-service.js, EmailJS, /api/garment-tracker/config, /api/pricing-bundle | ✅ Active |
| `/shared_components/js/golf-tournament-product.js` | **NEW** Product detail page logic — fetches /api/products/search for colors/sizes/description + embroidery pricing for full tier table | embroidery-pricing-service.js, /api/products/search, /api/pricing-bundle | ✅ Active |

### Quote System Components

> `quote-builder-core.js` (684 lines) + `INTEGRATION-EXAMPLE.js` (329) DELETED 2026-07-07 (roadmap 0.4 base audit, Erik-approved): zero `<script>` tags and zero JS references repo-wide — 2026-01 consolidation scaffolding nobody adopted. `quote-builder-base.js` won the keep-ONE-base decision.

| File | Purpose | Used By | Status |
|------|---------|---------|--------|
| `/shared_components/js/quote-builder-base.js` | **RETIRED → pointer stub (2026-07-08)**: the ONE base is now `builders/shared/quote-builder-base.js` (QuoteBuilderBase, ES module) + per-method adapters. No page loads this path. | — | 🪦 Pointer stub |
| `/shared_components/js/quote-builder-utils.js` | **NEW** Shared utilities: escapeHtml, formatPrice, showToast, etc. (2026-01-30 consolidation) | All quote builders | ✅ Active |
| `/shared_components/js/quote-builder-guided.js` | **NEW (2026-07-07, guided-quote Phase B)** Guided Quote shell for the TRIO: 4-step flow (Products → Decoration → Customer → Review & send) via tag-don't-wrap visibility on existing sections + exactly 2 id-preserving relocations (sidebar customer panel → step 3, action panel → step 4, hidden anchors restore them); "Show everything" workbench toggle persisted in localStorage `nwca-guided-mode`; defensive no-op if any section is missing. DTG excluded by design. | EMB/SCP/DTF builder HTMLs, quote-builder-guided.css | ✅ Active |
| `/shared_components/js/builders/emb/index.js` | **EMB ESM entry point (roadmap 0.1/0.4)** — the ONE sanctioned window re-export surface for extracted modules (eslint-enforced); executes at parse time, before DOMContentLoaded, so init callers always find the bridges. ALL clusters extracted (11 modules; monolith = 728-line state + composition root). Extraction map → memory/emb-decomposition-plan.md | scripts/build.js; embroidery-quote-builder.html | ✅ Active |
| `/shared_components/js/builders/emb/pricing.js` | **NEW (2026-07-07, roadmap 0.4 extraction #0)** Service_Codes fee loading moved verbatim from the monolith: `loadServiceCodePrices()` (caches on `window._serviceCodes` — cross-file contract) + `getServicePrice(code, fallback)` (live SellPrice, documented fallback + visible toast on API failure — never silent). Grows into the ONLY module that talks to the pricing APIs. | builders/emb/index.js (bridges); locked by tests/unit/builders/emb-pricing-module.test.js | ✅ Active |
| `/shared_components/js/builders/emb/design-search.js` | **NEW (2026-07-07, roadmap 0.4 extraction #1)** Design-number lookup / customer design-gallery modal moved verbatim from the monolith (986-line contiguous cluster): open/close, debounced `/api/digitized-designs` search, tier+company filters, batched grid (50-initial + show-more), lazy thumbnails, apply-design-to-logo-card, customer autofill. 15 window bridges via index.js (incl. generated-markup onclick handlers); `window._designSearchCache` now module-private; monolith's customer-change/reset paths call the exported `invalidateDesignGalleryCache()`/`resetDesignSearchState()`. Carries `@ts-nocheck` + a no-unsanitized file override (moved-legacy debt, burned down with typing / roadmap 1.4). | builders/emb/index.js; locked by tests/unit/builders/emb-design-search-module.test.js | ✅ Active |
| `/shared_components/js/builders/emb/spr-modal.js` | **NEW (2026-07-07, roadmap 0.4 extraction #2)** Service-pricing-review modal moved verbatim (941-line cluster): the ShopWorks-import review step for AL/DECG/DECC/Monogram/FB items — per-item price source (SW/API/custom), product source tables, EMB config, LTM default, promise plumbing (`showServicePricingReview()` resolves services/products/embConfig; cancel → null). 12 bridges via index.js (all 5 onSpr row handlers are GENERATED-markup); import cluster reads via `getSprEmbConfigOptions()`. @ts-nocheck + no-unsanitized override (moved-legacy debt → 1.4). | builders/emb/index.js; locked by tests/unit/builders/emb-spr-modal-module.test.js | ✅ Active |
| `/shared_components/js/builders/emb/shopworks-import.js` | **NEW (2026-07-07, roadmap 0.4 extraction #3)** Paste-from-ShopWorks import flow moved verbatim (2,012-line cluster): import modal, parse+preview, the 999-line `confirmShopWorksImport` orchestrator, per-row `importProductRow`, non-SanMar add/re-import modal, summary banner. 11 bridges; FIRST real inter-module ESM imports (spr-modal, design-search). `pendingShopWorksImport`/`lastImportMetadata` stay monolith-declared (scope-chain access; 26 outside readers). @ts-nocheck + no-unsanitized override (moved-legacy debt → 1.4). | builders/emb/index.js, spr-modal.js, design-search.js; locked by tests/unit/builders/emb-shopworks-import-module.test.js | ✅ Active |
| `/shared_components/js/builders/emb/persistence.js` | **NEW (2026-07-07, roadmap 0.4 extraction #4)** Autosave/draft/edit-load cluster moved verbatim (1,195 lines): initEmbroideryPersistence (QuotePersistence/QuoteSession wiring), getEmbroideryQuoteData/restoreEmbroideryDraft snapshots, loadQuoteForEditing + populate* builders, duplicateQuote (QM ?duplicate=). 8 bridges; imports design-search directly; cross-file contract flags (window._restoringQuote etc.) documented with inline disables. @ts-nocheck + no-unsanitized override (→ 1.4). | builders/emb/index.js, design-search.js; exercised by tests/unit/emb-edit-reload-roundtrip.test.js (jsdom + real bundle) + emb-persistence-module.test.js | ✅ Active |
| `/shared_components/js/builders/emb/output.js` | **NEW (2026-07-07, roadmap 0.4 extraction #5)** Output + diagnostics moved verbatim (780-line tail): buildEmbroideryPricingData (the pricingData contract → shared embroidery-quote-invoice.js), printQuote, embEmailQuote, generateEmbQuoteText + copyToClipboard, diagnoseQuote. 6 bridges; imports pricing.js. @ts-nocheck + no-unsanitized override (→ 1.4). | builders/emb/index.js, pricing.js | ✅ Active |
| `/shared_components/js/builders/emb/save-push.js` | **NEW (2026-07-07, roadmap 0.4 extraction #6)** Save + push endgame moved verbatim (918 lines): saveAndGetLink → _saveAndGetLinkInner (450-line save orchestrator: state collect, quote-sequence id, two-table Caspio save, share link), push readiness/preview/confirm/verify. 11 bridges; push-state vars hoisted back to the monolith (cross-module readers). @ts-nocheck + no-unsanitized override (→ 1.4). | builders/emb/index.js, pricing.js | ✅ Active |
| `/shared_components/js/builders/emb/quote-lifecycle.js` | **NEW (2026-07-07, roadmap 0.4 extraction #7)** Quote-level lifecycle moved verbatim (643 lines): resetQuote (Rule-7 reset checklist), discount type/presets, additional-charges + fee table, getAdditionalCharges/collectDECGItems collectors, unsaved-changes tracking, panel toggles. 13 bridges; persistence/output/save-push import its collectors directly. @ts-nocheck + no-unsanitized override (→ 1.4). | builders/emb/index.js; consumed by persistence/output/save-push | ✅ Active |
| `/shared_components/js/builders/emb/pricing-sync.js` | **NEW (2026-07-07, roadmap 0.4 extraction #8)** THE hot pricing path moved verbatim (1,795 lines): recalculatePricing (353L orchestrator, ships pre-wrapped with the reprice pill via live `export let`), collectProductsFromTable, updatePricingDisplay (351L), AL/DECG/rush sync, nudges, tax + shipping UI (lookupTaxRate → DOR). 27 bridges; 6 sibling modules real-import from it. @ts-nocheck + no-unsanitized + no-restricted-syntax overrides (moved-legacy; ~20 window-flag seams inventoried in the plan doc). | builders/emb/index.js + all sibling modules | ✅ Active |
| `/shared_components/js/builders/emb/logo-config.js` | **NEW (2026-07-07, roadmap 0.4 extraction #9)** Logo-config UI moved verbatim (378 lines): stitch estimators + tier dropdowns, logo cards, global-AL state sync (_syncALArrays), cap embellishment types, notes badge. 18 bridges; 8 sibling modules real-import its helpers. @ts-nocheck + no-unsanitized override (→ 1.4). | builders/emb/index.js + siblings | ✅ Active |
| `/shared_components/js/builders/emb/product-rows.js` | **NEW (2026-07-07, roadmap 0.4 extraction #10 — final cluster)** The row machinery moved verbatim (3,164 lines): search/autocomplete, addNewRow/onStyleChange, non-SanMar + service rows, size-category engine, color picker + child rows, price override, logo card header, date helpers. 45 bridges; siblings real-import 25+ helpers. @ts-nocheck + overrides (-> 1.4). | builders/emb/index.js + siblings | OK Active |
| `/shared_components/js/builders/shared/quote-builder-base.js` | **NEW (2026-07-08, roadmap 0.4)** QuoteBuilderBase — the ONE base: owns the page lifecycle (hook order, loading overlay, visible pricing-failure warning, entry focus) and validates the MethodAdapter contract at boot. Common behavior graduates here from adapters as SCP/DTF adopt (rule of two). | consumed by builders/*/index.js | ✅ Active |
| `/shared_components/js/builders/emb/adapter.js` | **NEW (2026-07-08, roadmap 0.4)** EmbAdapter — MethodAdapter contract (live pricing service, Caspio-hydrated tier config, location model, nudge tiers 8/24/48/72) + the EMB page init moved VERBATIM from the monolith's DOMContentLoaded listener into the base's two lifecycle hooks (setupPage, initPricingAndRoute). | quote-builder-base.js + all emb modules | ✅ Active |
| `/shared_components/js/builders/shared/quote-model.js` | **NEW (2026-07-08, roadmap 0.5)** Canonical quote-item model: createQuoteItem factory + QuoteState store (add/update/remove/duplicate line, totals, onChange, tierGroups with the EMB caps-vs-garments separation). ZERO price math (Rule 9). EMB instantiates it (state.js); SCP/DTF adopt during their decompositions. | locked by tests/unit/builders/quote-model.test.js | ✅ Active |
| `/shared_components/js/builders/shared/errors.js` | **NEW (2026-07-08, roadmap 1.15)** Structural "never a silent wrong price": showErrorBanner (persistent role=alert strip), showFallbackPricingWarning (persistent amber role=status badge, accumulates labels), safeExecute (loud-failure wrapper — surfaces then rethrows/falls back), assertPriceOrThrow (PricingError on NaN/negative money). Wired: QuoteBuilderBase pricing-init catch; window-bridged by all 3 index.js; quote-builder-utils + emb/pricing call behind typeof guards. Styles: quote-builder-common.css | locked by tests/unit/builders/errors.test.js | ✅ Active |
| `/shared_components/js/builders/emb/state.js` | **NEW (2026-07-08, roadmap 0.5)** THE home for EMB state: constants (EMB_DEFAULTS, SIZE_TO_SLOT, SIZE06 list, caches, API_BASE) + `embState` (services/edit/logos/rows/push/import fields — 347 refs across 11 modules swept from lexical globals) + the `quoteState` store instance. THREE window-backed accessor fields (childRowMap/hasChanges/pricingCalculator) keep the classic multi-builder consumers (quote-extended-sizes/utils/quote-service) on ONE shared slot. | quote-model.js; consumed by every emb module | ✅ Active |
| `/shared_components/js/dtg-canonical-pricing.js` | **NEW (2026-07-09, Batch 6)** vendored byte-identical DTG canonical engine (proxy is authoritative; parity tests both repos) | 7 pages before dtg-pricing-service.js | ✅ Active |
| `/shared_components/js/builders/dtf/methods-*.js` (5 files) | **NEW (2026-07-09, Batch 4.2)** DTFQuoteBuilder prototype mixins — pricing/rows/locations/lifecycle/output | quote-builder-class.js assembles | ✅ Active |
| `/shared_components/js/builders/dtf/product-rows.js` | **NEW (2026-07-09, Batch 4.3)** migrated dtf-quote-page.js row machinery (childRowMap → dtfState) | dtf bundle | ✅ Active |
| `/shared_components/js/builders/dtf/page-ui.js` | **NEW (2026-07-09, Batch 4.3)** migrated page shims/tax/fees/save-modal; `dtf-quote-page.js` DELETED (recovery: `git show v2026.07.09.8:shared_components/js/dtf-quote-page.js`) | dtf bundle | ✅ Active |
| `/shared_components/js/builders/shared/service-codes.js` | **NEW (2026-07-09)** ONE Service_Codes pricing impl for all 4 builders (was duplicated emb/pricing.js + quote-builder-utils.js guarded copies) | errors.js; bridged by emb/scp/dtf index.js | ✅ Active |
| `/shared_components/js/builders/shared/color-dropdown-position.js` | **NEW (2026-07-10, P1)** viewport-fixed positioning for the trio's color-picker dropdowns — escapes table-card overflow clipping, flips up near viewport bottom, scroll/resize re-pins | imported by emb/scp/dtf product-rows.js | ✅ Active |
| `/shared_components/js/builders/shared/size-constants.js` | **NEW (2026-07-09, Batch 7.5)** ONE size↔slot constants file (EXTENDED_SIZES/SIZE_TO_SLOT/SIZE06_EXTENDED_SIZES); emb+scp state.js re-export; drift test locks re-exports + Size05 invariants | emb/scp state.js re-exports | ✅ Active |
| `/shared_components/js/builders/dtg/index.js` | **NEW (2026-07-08)** DTG bridge shell — brings the shared 1.15 error surfaces (persistent banner + fallback badge) to the bundle-less DTG page; becomes DTG's composition root if it ever decomposes (proven playbook) | scripts/build.js entry; dtg-quote-builder.html (now in REWRITTEN_BUILDER_PAGES); builders/shared/errors.js | ✅ Active |
| `/shared_components/js/builders/scp/index.js` | **SCP ESM entry point (roadmap 0.4; decomposition COMPLETE 2026-07-08)** — the ONE sanctioned window re-export surface (46 bridges for HTML handlers + shared classics) + `new QuoteBuilderBase(new ScpAdapter()).init()` boot + `__scpState` debug handle. The page's ONLY builder script. | scripts/build.js; screenprint-quote-builder.html | ✅ Active |
| `/shared_components/js/builders/scp/state.js` | **NEW (2026-07-08, SCP S2)** THE home for SCP state: constants (API_BASE, sizes/slots, SCREEN_FEE, LOCATION_NAMES, dark-color words) + `scpState` (services/rows/edit/printConfig/push — 236 refs swept across 7 modules) + window-backed childRowMap/hasChanges (shared classic consumers: quote-extended-sizes.js, quote-builder-utils.js) + the `quoteState` store instance. | quote-model.js; consumed by every scp module | ✅ Active |
| `/shared_components/js/builders/scp/adapter.js` | **NEW (2026-07-08, SCP S2)** ScpAdapter — MethodAdapter contract (live ScreenPrintPricingService, nudge tiers 24/48/72/145, print-location model) + the SCP page init moved VERBATIM from the monolith's DOMContentLoaded listener into the base's lifecycle hooks; QuoteOrderSummary.configure() at module tail (parse-time, as before). | quote-builder-base.js + all scp modules | ✅ Active |
| `/shared_components/js/builders/scp/print-config.js` | **NEW (2026-07-08, SCP S1a)** Print locations/ink colors/dark-garment + safety-stripes config (`updatePrintConfig`) + dark-garment nudge banner. Moved verbatim from screenprint-quote-builder.js. | builders/scp/index.js | ✅ Active |
| `/shared_components/js/builders/scp/persistence.js` | **NEW (2026-07-08, SCP S1a)** Draft autosave/restore, edit/duplicate quote loading, Quick-Quote + method-switch prefills, resetQuote checklist. Moved verbatim (813L). Known latent monolith bug preserved: `updateRowQuantityTotal` call has no definition anywhere (draft-restore path). | builders/scp/index.js | ✅ Active |
| `/shared_components/js/builders/scp/product-rows.js` | **NEW (2026-07-08, SCP S1a)** Search/autocomplete, add-row/style-change, size engine, color picker + child rows (SCP dup-row auto-merge), Excel keyboard nav, page-level click-away listener. Moved verbatim (1,936L). Latent monolith bug preserved: deleteRow tail calls EMB-only `updateCapLogoSectionVisibility` (swallowed ReferenceError). | builders/scp/index.js | ✅ Active |
| `/shared_components/js/builders/scp/pricing-sync.js` | **NEW (2026-07-08, SCP S1b)** SCREENPRINT_TIERS + `findPricingTier` (the tier authority web-quote-cart-parity byte-compares) + `recalculatePricing` pipeline (live `export let`, reprice-pill wrapped at module tail) + display/tax/wholesale sync. Moved verbatim. | builders/scp/index.js; locked by tests/unit/web-quote-cart-parity.test.js | ✅ Active |
| `/shared_components/js/builders/scp/quote-lifecycle.js` | **NEW (2026-07-08, SCP S1b)** Additional charges (art/rush), discount controls, fee-table renderer. Moved verbatim. | builders/scp/index.js | ✅ Active |
| `/shared_components/js/builders/scp/save-output.js` | **NEW (2026-07-08, SCP S1b)** printQuote + buildScreenprintPricingData (scp-save-parity locks the PDF line math here), saveAndGetLink/saveQuote, email + clipboard quote text. Moved verbatim. | builders/scp/index.js; locked by tests/unit/scp-save-parity.test.js | ✅ Active |
| `/shared_components/js/builders/scp/push.js` | **NEW (2026-07-08, SCP S1b)** One-click push-to-ShopWorks (push-button-binding locks the single-async-decl rule here), review/confirm preview, button state. `_scpPushQuoteId`/`_scpPushInFlight` stay shell-side until S2. | builders/scp/index.js; locked by tests/unit/push-button-binding.test.js | ✅ Active |
| `/shared_components/js/builders/dtf/index.js` | **DTF ESM entry point (roadmap 0.4; decomposition COMPLETE 2026-07-08)** — the ONE sanctioned window re-export surface (12 bridges) + `new QuoteBuilderBase(new DtfAdapter()).init()` boot + `__dtfState` handle. The page's ONLY builder script. | scripts/build.js; dtf-quote-builder.html | ✅ Active |
| `/shared_components/js/builders/dtf/state.js` | **NEW (2026-07-08, DTF D2)** dtfState (push flags) + window-backed `hasChanges` (quote-builder-utils contract) + sizeDetectionCache + the `quoteState` store instance. DTF's real state is `this.`-scoped on the class instance (window.dtfQuoteBuilder). | quote-model.js; consumed by class/push | ✅ Active |
| `/shared_components/js/builders/dtf/adapter.js` | **NEW (2026-07-08, DTF D2)** DtfAdapter — MethodAdapter contract + the DOMContentLoaded init VERBATIM (DTF is instantiate-then-wire, so the whole body rides initPricingAndRoute; setupPage documented no-op until the constructor init is unpacked). | quote-builder-base.js + quote-builder-class.js | ✅ Active |
| `/shared_components/js/builders/dtf/quote-builder-class.js` | **NEW (2026-07-08, DTF D1)** The whole DTFQuoteBuilder class VERBATIM (state `this.`-scoped; childRows Map = single money source) + the reprice-pill prototype wrap at its tail. dtf-childrow-state + dtf-size-upcharge-fallback lock methods from THIS file. | builders/dtf/index.js | ✅ Active |
| `/shared_components/js/builders/dtf/output.js` | **NEW (2026-07-08, DTF D1)** HTML-onclick wrappers (copy/print → class methods) + the auto-% rush chip. Verbatim. | builders/dtf/index.js | ✅ Active |
| `/shared_components/js/builders/dtf/push.js` | **NEW (2026-07-08, DTF D1)** One-click push-to-ShopWorks + preview/confirm (push-button-binding locks the single-async-decl rule HERE). Push state stays shell-side until D2. | builders/dtf/index.js | ✅ Active |
| `/staff-dashboard-v3/quote-launcher.js` | **NEW (2026-07-07, guided-quote entry)** Dashboard "New Quote" launcher behavior: opens/closes the #quote-launcher dialog (one question — decoration method → guided builder; "not sure" → Quick Quote ?mode=quick), Escape/backdrop close, focus return, "Continue in X →" last-method chip via localStorage `nwca-last-quote-method` (href validated against the launcher's own targets). Pure UI routing — no pricing, no API. | staff-dashboard-v3/index.html, staff-dashboard/components.css | ✅ Active |
| `/shared_components/js/quote-cart-engine.js` | **NEW (2026-06-11, customer quote-cart Phase 0)** PURE orchestration engine for the customer quote cart — pooling/grouping per staff-builder scope (EMB garments / EMB caps / DTG / SCP-per-design / DTF), fee assembly via /api/service-codes, honest-LTM display math, tier nudges, per-group trace. Owns ZERO price formulas: adapters call the staff authorities (EmbroideryPricingCalculator class, POST /api/dtg/quote-pricing, ScreenPrintPricingService bundle + exact builder findPricingTier copy, DTFPricingService.calculatePriceForQuantity). Dual browser/Node. API: `priceCart(cart)`, `singleItemPreview(item)`. **`priceScpGroup` opts gained `customerSuppliedGarment` (2026-07-01)** — routes to `ScreenPrintPricingService.generateManualPricingData(0)` instead of a per-style fetch, for customer-supplied-blank orders (calculators/screenprint-customer); every other formula (tier/LTM/screens/stripes) unchanged. Design: memory/CUSTOMER_QUOTE_CART_DESIGN_2026-06.md | embroidery-quote-pricing.js, screenprint-pricing-service.js, dtf-pricing-service.js, /api/dtg/quote-pricing, /api/service-codes; locked by tests/unit/web-quote-cart-parity.test.js + tests/unit/screenprint-customer-parity.test.js | ✅ Active |
| `/shared_components/js/quote-cart-store.js` | **NEW (2026-06-11, customer quote-cart Phase 2; localStorage since 2026-07-04)** localStorage cart store (`window.QuoteCartStore`) — key `nwca.quoteCart.v1`, schema v1, 24h TTL (mismatch/expiry/corruption → silent reset); localStorage so the quote survives closing the tab. Items carry style/color/qty/sizes/method/placement/inkColors ONLY — **zero prices stored**; pricing happens via quote-cart-engine at render time so Caspio changes reprice on next view. API: add/updateQty/remove/clear/getItems/count/totalPieces/onChange (same-tab pub/sub + storage events). Auto-wires masthead `[data-quote-badge]` elements (hidden at 0). Dual browser/Node | localStorage; consumed by index.html, product.html, pages/catalog.html, pages/quote-cart.html; locked by tests/unit/quote-cart-store.test.js | ✅ Active |
| `/shared_components/js/mo-fetch.js` | **NEW (2026-07-04, airtight PII path)** `window.moFetch(path)` — ManageOrders READ fetch that tries the SAML-authed same-origin forwarder `/api/mo/*` first and FALLS BACK to the direct proxy `/api/manageorders/*` on 401 (customer context) / non-2xx / network error, so repointing a caller can't break a page. Only `orders`/`lineitems` are forwarded. Consumed by art-hub-steve/ae, mockup-detail, mockup-ruth, art-request-detail. Server side: `moForwardTo` + `/api/mo/{orders,orders/:no,lineitems/:no}` in server.js (requireStaff). Plan/finish: memory/AIRTIGHT_PII_PROXY_PLAN_2026-07.md | app-config.js (APP_CONFIG.API.BASE_URL); server `/api/mo/*` forwarder | ✅ Active (migration; gate-flip pending verify) |
| `/shared_components/js/web-quote-service.js` | **NEW (2026-06-11, customer quote-cart Phase 3)** SAVE/SHARE/EMAIL service for the customer cart (`window.WebQuoteService`) — WQ-prefix QuoteID via GET /api/quote-sequence/WQ (visible fallback), pre-save PARITY GATE (forceRefresh reprice; >1¢ group-total move → PRICING_CHANGED, nothing saved), two-table save via proxy CRUD (POST /api/quote_sessions + /api/quote_items), FOOTING ASSERT (rows must foot to engine group totals ±2¢ or the save aborts), artwork upload (POST /api/files/upload), fire-and-forget EmailJS (reuses service_jgrave3/template_quote_email: customer copy + sales@ alert). ZERO price math — every dollar copied from QuoteCartEngine.priceCart results. Sessions: Status 'Web Quote Request', SubtotalAmount===TotalAmount===engine grandTotal, TaxRate/TaxAmount 0 (rep taxes at confirmation), NO method-specific columns (phantom-default rule), Notes JSON {channel, taxNote, groups, artworkKeys}. Items: product rows per engine line (baked-LTM billed units) + fee/service rows (EmbellishmentType 'fee', StyleNumber = service code). Dual browser/Node | quote-cart-engine.js, /api/quote-sequence, /api/quote_sessions, /api/quote_items, /api/files/upload, EmailJS; locked by tests/unit/web-quote-service.test.js | ✅ Active |
| `/tests/unit/quote-cart-store.test.js` | **NEW (2026-06-11)** QuoteCartStore lock — add/updateQty(sizes rewrite, min-1)/remove/clear/deep-copy, 24h TTL expiry reset, schema-version-mismatch reset, corrupted-JSON reset, onChange pub/sub + unsubscribe, no-price-fields-stored guard (9 tests) | jest (node env, sessionStorage shim), quote-cart-store.js | ✅ Active |
| `/tests/unit/web-quote-service.test.js` | **NEW (2026-06-11, Phase 3)** WebQuoteService save-contract lock (25 tests) — WQ QuoteID formatting + fallback, parity gate (changed price → PRICING_CHANGED, zero POSTs), session/items payload goldens for a mixed EMB+DTG cart (footing to group totals + grand total, fee-row conventions, no phantom session columns, CATALOG_COLOR in ColorCode), SCP itemized-LTM convention, FOOTING_MISMATCH abort, partial-save warning, email reuse/failure/skip behavior, dry-run never POSTs. All fetches mocked — no Caspio rows created | jest, web-quote-service.js | ✅ Active |
| `/shared_components/js/storefront-quote-items.js` | **NEW (2026-06-12)** Synthesizes quote_items rows from a storefront order's colorConfigs (custom-tees/custom-caps) so /quote + /invoice render line items + foot to subtotal. Pure logic, dual browser/node export. Consumed by server.js save3DTQuoteSession | (none) | ✅ Active |
| `/shared_components/js/delivery-promise.js` | **NEW (2026-07-06, BAW adoption #1)** "Order today → est. ship by X" chips on PDP configurator + quote-cart groups. Lead days from Caspio Service_Codes `LEAD-DAYS-{EMB\|CAP\|DTG\|SCP\|DTF}` (SellPrice = business days, Category 'Lead Times') — Erik tunes in Caspio, no deploy. One category fetch, 5-min cache, weekend-skip date math. FAIL-SOFT: any miss hides the chip (marketing line, never a guessed date) | APP_CONFIG, /api/service-codes; consumed by pdp-configurator.js + quote-cart-page.js | ✅ Active |
| `/shared_components/js/quote-deposit-math.js` | **NEW (2026-07-05, Storefront Checkout Phase 1)** Deposit-terms money math (`computeDepositTerms`): WA tax on subtotal+shipping (cents-rounded before summing), grand total, DEPOSIT-PCT split, balance foots exactly. PURE dual browser/Node — server (enable-deposit endpoint) is authoritative; quote-view.js uses it only for the staff live preview (depositPct:100). Fail-closed on bad input — never a silent $0 charge | server.js, pages/js/quote-view.js; locked by tests/unit/quote-deposit-math.test.js | ✅ Active |
| `/tests/unit/quote-deposit-math.test.js` | **NEW (2026-07-05)** Deposit-math lock (9 tests) — WA tax base incl. shipping, cent-rounding order, deposit+balance foot to grand total, non-50% pcts, falsy-zero (0% tax / $0 ship valid), fail-closed throws, webhook metadata.kind shape contract (deposit/balance carry kind, express sessions never do) | jest, quote-deposit-math.js | ✅ Active |
| `/tests/unit/storefront-quote-items.test.js` | **NEW (2026-06-12)** storefront-quote-items lock (7 tests) — caps single-color OSFA foots to subtotal, tees multi-color+extended-size upcharge in LineTotal + SHIP fee row, empty/zero-qty robustness | jest, storefront-quote-items.js | ✅ Active |
| `/tests/unit/web-quote-cart-parity.test.js` | **NEW (2026-06-11)** Quote-cart engine parity lock — every worked example from memory/CUSTOMER_QUOTE_CART_DESIGN_2026-06.md asserted to the cent (EMB a-d, DTG a-d incl. 1-23 inversion + combo anti-double-count, SCP a-d separate-mode footing, DTF a-d), pooling/caps-separate/below-minimum guards, manual-cost host-gate coverage for all 5 pricing services, SCP findPricingTier source canary | jest, quote-cart-engine.js, tests/fixtures/pricing/ | ✅ Active |
| `/tests/unit/screenprint-customer-parity.test.js` | **NEW (2026-07-01)** Regression lock for the fixed customer-supplied-garment SCP calculator — live-API-cross-verified tier/LTM/screen values (24-47/48-71/72-144/145-576, $50 LTM only at 24-47), dark-garment per-piece-unchanged/screens-only assertion, safety-stripe location scaling, below-minimum gate, manual-cost host-gate-stays-on, source assertion that Quick Quote calls the SAME `QuoteCartEngine.singleItemPreview` (9 tests) | jest, quote-cart-engine.js, screenprint-pricing-service.js, tests/fixtures/pricing/scp-bundle-PC61.json + service-codes.json | ✅ Active |
| `/tests/fixtures/pricing/` (24 JSON files) | **NEW (2026-06-11)** Live API captures backing the quote-cart parity tests: EMB/EMB-AL/CAP/CAP-AL/CAP-PUFF/PATCH bundles, size-pricing (PC61/PC90H/C112), ScreenPrint bundles (PC61/PC54), DTF + BLANK bundles, service-codes, 8 recorded POST /api/dtg/quote-pricing responses. Captured 2026-06-11 from caspio-pricing-proxy | jest fetch mock in web-quote-cart-parity.test.js | ✅ Active |
| `/shared_components/js/quote-order-summary.js` | **Shared order-summary band** (Order Recap + Ship-To card + getShipFields accessor), selector-agnostic via `QuoteOrderSummary.configure()`. Extracted from EMB (2026-06-08, Phase 0 of DTF/SCP parity). MUST load before each `*-quote-builder.js`. | EMB (live); DTF/SCP (Phase 2/3) | ✅ Active |
| `/shared_components/js/fetch-timeout.js` | Global fetch() wrapper adding 15s AbortController timeout to all requests | All embroidery pages | ✅ Active |
| `/shared_components/js/dash-page-helpers.js` | **NEW (2026-05-16)** Canonical helpers for staff-dashboard child pages — `window.DashPage.showError/hideError/apiUrl/fetchJson`. Enforces CLAUDE.md API-error rule (no silent fallback). Loaded by every page scaffolded via the `/dash-page` skill. | APP_CONFIG, fetch-timeout.js | ✅ Active |
| `/shared_components/js/emblem-pricing-page.js` | **NEW (2026-05-16)** Embroidered emblem patch page controller — fetches `/api/emblem-pricing` grid, renders 16×10 table, drives AI chat panel via SSE to `/api/contract-emblem-ai/chat`, parses PRICE_QUOTE/CUSTOMER_FINAL/EMAIL DRAFT blocks, highlights pricing-grid cell on quote, saves to `quote_sessions` with PATCH prefix. Mirrors sticker-pricing-page.js pattern. | /api/emblem-pricing, /api/contract-emblem-ai/chat, /api/quote-sequence/PATCH, /api/quote_sessions, /api/quote_items | ✅ Active |
| `/shared_components/js/webstore-pricing-page.js` | **NEW (2026-05-16)** Custom-webstore page controller — drives AI chat via SSE to `/api/contract-webstore-ai/chat`. **Dual-mode**: parses PRICE_QUOTE blocks with `productType: "webstore-setup"` (renders cream/navy store-quote card with store-type pill + per-item surcharge meta) OR `"fundraiser-item"` (renders deep-purple sell-price card with breakdown + 1099-NEC warning). Renders web_search results inline as a search-results list with linked sources. Saves to `quote_sessions` with WEB prefix. | /api/contract-webstore-ai/chat, /api/quote-sequence/WEB, /api/quote_sessions, /api/quote_items | ✅ Active |
| `/shared_components/js/dtg-quote-page.js` | **NEW (2026-05-17)** DTG quote-builder controller — drives AI chat via SSE to `/api/dtg-quote-ai/chat`. Renders deep-green `.dtg-quote-card` on PRICE_QUOTE, renders `.top-seller-card` recommendation cards inline on recommend_top_sellers tool, renders web_search results inline. When the bot emits PRICE_QUOTE + CUSTOMER_FINAL, it calls `window.DTGInlineForm.fillFromQuote()` to populate the inline order form below — the rep reviews + clicks Submit on the form (NOT in chat). Saves to `quote_sessions` with DTG prefix. | /api/dtg-quote-ai/chat, /api/quote-sequence/DTG, /api/quote_sessions, builders/dtg (window.DTGInlineForm) | ✅ Active |
| `/shared_components/js/builders/dtg/adapter.js` | **NEW (2026-07-09, F1)** DtgAdapter — DTG joins QuoteBuilderBase (loud-pricing lifecycle) + adapter-contract.test.js; init rides initPricingAndRoute verbatim (DTF pattern). | quote-builder-base.js; index.js boots | ✅ Active |
| `/shared_components/js/builders/dtg/index.js` | **DTG ESM entry point (Batch 5, 2026-07-09 — decomposition COMPLETE; F1 base boot)** — shared-error bridges + `QuoteBuilderBase(new DtgAdapter()).init()`. The page's ONLY builder script; the 5,498-line `dtg-inline-form.js` monolith is DELETED (recovery: `git show v2026.07.09.12:shared_components/js/dtg-inline-form.js`). | scripts/build.js; dtg-quote-builder.html | ✅ Active |
| `/shared_components/js/builders/dtg/state.js` | **NEW (2026-07-09, Batch 5)** — the IIFE's consts/caches + `state` + `dtgIF` (cross-module lets) + window-backed `hasChanges` (quote-builder-utils leave-guard contract). API_BASE from APP_CONFIG only. | consumed by all dtg modules | ✅ Active |
| `/shared_components/js/builders/dtg/form-core.js` | **NEW (2026-07-09, Batch 5)** — render/wire/init/readiness + boot + `window.DTGInlineForm` 14-method surface (dtg-catalog.js + dtg-quote-page.js consumers unchanged). | builders/dtg/index.js | ✅ Active |
| `/shared_components/js/builders/dtg/{persistence,catalog-search,pricing,tax-shipping,artwork,crm,utils,output}.js` (8 files) | **NEW (2026-07-09, Batch 5)** — draft/edit-load/fillFromQuote · comboboxes/lightbox · bundle+live price rail (math via DTGPricingService→canonical) · ship/tax · artwork upload · customer history/contacts · helpers · confirm-modals/print/email/submitToShopWorks. | form-core.js imports | ✅ Active |
| `/shared_components/js/quote-formatter.js` | Format quotes | All quote builders | ✅ Active |
| `/shared_components/js/quote-persistence.js` | Save/load quotes | All quote builders | ✅ Active |
| `/shared_components/js/quote-session.js` | Session management | All quote builders | ✅ Active |
| `/shared_components/js/quote-validation.js` | Input validation | All quote builders | ✅ Active |
| `/shared_components/js/quote-ui-feedback.js` | User feedback | All quote builders | ✅ Active |
| `/shared_components/js/quote-builder-step2-modern.js` | **NEW** Modern Step 2 UI manager (2025 refactor) | Embroidery & Cap quote builders | ✅ Active |
| `/shared_components/js/sidebar-resize.js` | **NEW** Resizable sidebar with drag handle | Embroidery quote builder | ✅ Active |
| `/shared_components/js/color-picker-component.js` | **NEW** Shared color picker module (2026 consolidation) | All quote builders | ✅ Active |
| `/shared_components/js/extended-sizes-config.js` | **NEW** Shared extended sizes config (2026 consolidation) | All quote builders | ✅ Active |
| `/shared_components/js/quote-extended-sizes.js` | **NEW** Shared extended size popup functions (2026-03-21 extraction) | EMB, DTG, Screenprint | ✅ Active |
| `/shared_components/js/pricing-sidebar-component.js` | **NEW** Unified pricing sidebar (2026 consolidation) | All quote builders | ✅ Active |
| `/shared_components/js/quote-share-modal.js` | **NEW** Shareable URL success modal (2026 consolidation) | All quote builders | ✅ Active |
| `/shared_components/js/customer-lookup-service.js` | **NEW** Customer autocomplete search (2026-01-29) | All quote builders | ✅ Active |
| `/shared_components/js/customer-context-banners.js` | **NEW** Customer Warning banner + Tax Exempt chip + Account Tier badge + Payment Terms autofill with legacy-CRM mapping (2026-05-23). Exposes `window.surfaceCustomerContext(contact, config)` + `window.mapToOfferedTerms()` | EMB, DTF, SCP quote builders + customer-lookup-service.js | ✅ Active |
| `/shared_components/js/product-thumbnail-modal.js` | **NEW** Product image thumbnail + click-to-enlarge modal (2026-01-29) | DTG, Screen Print, Embroidery builders | ✅ Active |
| `/shared_components/js/shopworks-import-parser.js` | **NEW** ShopWorks order text parser (2026-01-31) | Embroidery quote builder | ✅ Active |

### Customer Lookup System (NEW 2026-01-29)
| File | Purpose | Dependencies | Status |
|------|---------|--------------|--------|
| `/shared_components/js/customer-lookup-service.js` | Customer autocomplete from Caspio Company_Contacts_Merge_ODBC | caspio-proxy API | ✅ Active |
| `/shared_components/css/customer-lookup.css` | Autocomplete dropdown styling | - | ✅ Active |
| `/shared_components/css/safety-stripe-recs.css` | **NEW (2026-06-28)** Styles for the shared safety-apparel recommendation cards (`.ssr-*`): hi-vis accent panel, responsive card grid, color swatch dots, rank/hi-vis badges, Add button. Paired with safety-stripe-recs.js. | safety-stripe-recs.js | ✅ Active |

**Backend (caspio-pricing-proxy):**

### ShopWorks Import System (NEW 2026-01-31)
| File | Purpose | Dependencies | Status |
|------|---------|--------------|--------|
| `/shared_components/js/shopworks-import-parser.js` | Parse ShopWorks order text into structured data | - | ✅ Active |
| `/shared_components/css/shopworks-import.css` | Import modal and preview styling | - | ✅ Active |
| `/shared_components/css/old-designs.css` | Old designs archive page styling (amber theme) | - | ✅ Active |
| `/shared_components/js/old-designs.js` | Old designs image modal and Caspio enhancements | - | ✅ Active |

**Features:**
- "Paste from ShopWorks" button in quote builders
- Parses customer info, products, sizes, quantities
- Detects service items: digitizing (DD), additional logo (AL), DECG, monograms
- Auto-populates customer, sales rep, and product rows
- Preview before import with summary

**Backend (caspio-pricing-proxy):**
- `GET /api/company-contacts/search?q=<term>` - Search contacts by company, name, or email
- `GET /api/company-contacts/:id` - Get single contact
- `POST /api/company-contacts` - Create new contact
- `PUT /api/company-contacts/:id` - Update contact
- `POST /api/company-contacts/sync` - Sync contacts from ManageOrders (Heroku Scheduler)

**Features:**
- Autocomplete search with 3+ character minimum
- Active customers only (Customersts_Active = 1)
- Results sorted by most recent order
- Auto-fills name, email, company fields in quote builders
- Phone field removed from all quote builders (not in Caspio table)

### Public Quote View System (NEW 2026-01-12)
| File | Purpose | Dependencies | Status |
|------|---------|--------------|--------|
| `/pages/quote-view.html` | Public customer-facing quote page | quote-view.js, quote-view.css, jsPDF | ✅ Active |
| `/pages/js/quote-view.js` | Quote data loading, PDF generation, acceptance flow; WQ web-cart support (2026-06-11): 'Web Quote Request' type label, method-subhead rows on MIXED-EmbellishmentType quotes (single-method staff quotes unchanged), 'Sales tax — calculated by your rep' zero-tax label for WQ | jsPDF, html2canvas | ✅ Active |
| `/pages/css/quote-view.css` | Professional quote styling (mobile-responsive) | Inter font | ✅ Active |
| `/pages/quote-audit.html` | Staff-only pricing audit page (SW vs 2026) | quote-audit.js, quote-audit.css, staff-auth-helper.js | ✅ Active |
| `/pages/js/quote-audit.js` | Audit data rendering, staff auth gate | staff-auth-helper.js | ✅ Active |
| `/pages/css/quote-audit.css` | Audit page styling (self-contained) | Inter font | ✅ Active |
| `/tools/art-search.html` | Staff-only cross-tool art search ("where is design 12345?") — SERVER-gated via /tools gateStaffHtml + client StaffAuthHelper belt-and-braces (moved from /pages 2026-07-05) | art-search.js, art-search.css, staff-auth-helper.js | ✅ Active |
| `/tools/art-search.js` | Art search logic: design # exact / company LIKE / contact client-filter over /api/artrequests; normalizeStatus pills; deep-link ?q= | staff-auth-helper.js, /api/artrequests | ✅ Active |
| `/tools/art-search.css` | Art search styling (2026 art-hub tokens) | art-hub.css :root tokens | ✅ Active |

**Server Routes (server.js):**
- `GET /quote/:quoteId` - Serves public quote page
- `GET /api/public/quote/:quoteId` - Returns quote data + tracks views
- `POST /api/public/quote/:quoteId/accept` - Accepts quote with name/email
- `GET /api/quote_items/quote/:quoteId` - Get items by quote ID

**Features:**
- Shareable URLs like `nwcustomapparel.com/quote/DTF0112-1`
- View tracking (FirstViewedAt, ViewCount)
- One-click PDF download via jsPDF
- Quote acceptance workflow
- Status badges (Open, Viewed, Accepted, Expired)

**Database Fields Required in `quote_sessions` (Caspio):**
- `FirstViewedAt` (DateTime) - When customer first opened
- `ViewCount` (Integer) - Number of times viewed
- `AcceptedAt` (DateTime) - When customer accepted
- `AcceptedByName` (Text) - Name of person accepting
- `AcceptedByEmail` (Text) - Email of person accepting

### Cap Embroidery Quote System
| File | Purpose | Dependencies | Status |
|------|---------|--------------|--------|
| `/shared_components/js/cap-embroidery-pricing-logic.js` | Cap embroidery pricing logic (shared between manual + quote builder) | embroidery-pricing-service.js | ✅ Active |
| `/shared_components/js/cap-embroidery-pricing-service.js` | Cap embroidery Caspio data adapter | Caspio API | ✅ Active |
| ~~`/shared_components/js/cap-quote-builder.js`~~ | **DELETED 2026-06-09** — dead cap-quote system (no HTML loads it; EMB builder handles caps via shared services). | — | ❌ Deleted |
| ~~`/shared_components/js/cap-quote-logos.js`~~ | **DELETED 2026-06-09** — orphaned after cap-quote-builder.js deletion; zero references verified. | — | ❌ Deleted |
| ~~`/shared_components/js/cap-quote-pricing.js`~~ | **DELETED 2026-06-09** — dead cap-quote pricing engine (50/100 hardcodes, no HTML loads it). | — | ❌ Deleted |
| ~~`/shared_components/js/cap-quote-products.js`~~ | **DELETED 2026-06-09** — orphaned after cap-quote-builder.js deletion; zero references verified. | SanMar API | ❌ Deleted |
| ~~`/shared_components/js/cap-quote-service.js`~~ | **DELETED 2026-06-09** — dead cap-quote save/email service (50/100 hardcodes diverged saved totals). | — | ❌ Deleted |

### Art Invoice System
| File | Purpose | Dependencies | Status |
|------|---------|--------------|--------|
| `/shared_components/js/art-invoice-config.js` | Art invoice business constants (tiers, defaults) | — | ✅ Active |
| `/shared_components/js/art-invoice-creator.js` | Art invoice creator UI controller | art-invoice-config.js, EmailJS | ✅ Active |
| `/shared_components/js/art-invoice-utils.js` | Shared art invoice utility functions | — | ✅ Active |
| `/shared_components/js/art-invoice-viewer.js` | Art invoice viewer / PDF rendering | jsPDF | ✅ Active |

### Art Hub Extended
| File | Purpose | Dependencies | Status |
|------|---------|--------------|--------|
| `/shared_components/js/art-hub-steve-gallery.js` | **NEW** JS-rendered Steve gallery (replaces Caspio DataPage 2026-04-25) — exposes `window.SteveGallery` | /api/art-requests, /api/box/shared-image | ✅ Active |

### DTG Extended Services
| File | Purpose | Dependencies | Status |
|------|---------|--------------|--------|
| `/shared_components/js/dtg-catalog.js` | NWCA-Approved DTG Catalog browser on `/quote-builders/dtg-quote-builder.html` — fetches `/api/dtg/top-sellers/{categories,styles,?style=X}`, renders style grid + detail modal with colors/sizes, drops picks onto the inline form via `window.DTGInlineForm.previewStyle()` (surface now served by builders/dtg/form-core.js). **2026-06-03**: when a quick-find search misses the curated 20, offers a fallback to the FULL SanMar catalog via `/api/stylesearch` (empty-state CTA + a quiet footer link for queries that collide with a curated style, e.g. "5000"→DT5000); picking a result fetches `/api/product-colors` and drops the style into the form (full DTG pricing hydrates via `/api/dtg/product-bundle`, identical to curated). Non-blocking DTG-suitability warnings flag Gildan + poly/performance fabrics (`dtgSuitabilityWarning()`). | `/api/dtg/top-sellers/*`, `/api/stylesearch`, `/api/product-colors` proxy endpoints, dtg-inline-form.js, dtg-catalog.css | ✅ Active |
| `/shared_components/js/dtg-config.js` | DTG location/print settings configuration | — | ✅ Active |
| `/shared_components/js/dtg-integration.js` | DTG calculator/adapter coordinator | dtg-pricing-service.js | ✅ Active |
| `/shared_components/js/dtg-page-setup.js` | DTG pricing page initialization | — | ✅ Active |
| `/shared_components/js/dtg-pricing-service.js` | DTG pricing Caspio data adapter | Caspio API | ✅ Active |
| `/shared_components/js/dtg-product-recommendations.js` | DTG-tested product suggestions | — | ✅ Active |
| `/shared_components/js/dtg-product-recommendations-modal.js` | Modal UI for DTG product recommendations | dtg-product-recommendations.js | ✅ Active |

### DTF Extended Services
| File | Purpose | Dependencies | Status |
|------|---------|--------------|--------|
| ~~`/shared_components/js/dtf-quote-adapter.js`~~ | **DELETED 2026-06-09** — orphaned DTF quote adapter carrying a full hardcoded DTF price grid (re-wire trap). Zero script refs. | — | ❌ Deleted |
| `/shared_components/js/dtf-quote-page.js` | DTF quote page initialization | — | ✅ Active |

### Embroidery Extended Services
| File | Purpose | Dependencies | Status |
|------|---------|--------------|--------|
| `/shared_components/js/embroidery-customization-options.js` | Embroidery customization options UI (logo placements, AL toggles) | — | ✅ Active |
| `/shared_components/js/embroidery-enhanced-loading.js` | Embroidery page loading animations | — | ✅ Active |
| `/shared_components/js/embroidery-quote-builder.js` | **TOMBSTONE (2026-07-08)** — the 13,703-line monolith is fully decomposed (0.4+0.5): behavior → builders/emb/*.js, boot → QuoteBuilderBase+EmbAdapter, state → builders/emb/state.js. The EMB page no longer loads this path; delete once nothing references it. | — | 🪦 Tombstone |

### Screen Print Extended Services
| File | Purpose | Dependencies | Status |
|------|---------|--------------|--------|
| `/shared_components/js/screenprint-manual-pricing.js` | Screen print manual pricing service (used by unified manual calculator) | screenprint-pricing-service.js | ✅ Active |
| `/shared_components/js/screenprint-quote-builder.js` | **TOMBSTONE (2026-07-08)** — the SCP monolith is fully decomposed into `builders/scp/*` (state/adapter + 7 domain modules + index boot); the page loads ONLY the bundle. Kept so stale references fail loudly. | (none — do not add code) | 🪦 Tombstone |
| `/shared_components/js/screenprint-shopworks-guide-generator.js` | Screen print ShopWorks manual data-entry guide generator | shopworks-guide-generator.js | ⚠️ Orphan — loaded by no HTML; superseded by the `/api/scp-push/push-quote` API push (2026-05-29). Safe to delete pending Erik's OK. |

### Universal Components (header, gallery, grid)
| File | Purpose | Dependencies | Status |
|------|---------|--------------|--------|
| `/shared_components/js/universal-cart-header.js` | Universal cart header (icon + item count) | cart.js, app-config.js | ✅ Active |
| `/shared_components/js/universal-header-component.js` | Universal page header (logo, nav, search) | brands-flyout.js | ✅ Active |
| `/shared_components/js/universal-image-gallery.js` | Universal product image gallery | — | ✅ Active |
| `/shared_components/js/universal-pricing-grid.js` | Universal pricing grid (tiered pricing display) | — | ✅ Active |
| `/shared_components/js/universal-product-display.js` | Universal product display (info, swatches, decoration selector) | — | ✅ Active |

### Product Search & Filtering
| File | Purpose | Dependencies | Status |
|------|---------|--------------|--------|
| `/shared_components/js/decoration-methods.js` | **NEW 2026-06-11** Decoration method eligibility — fetches `/api/decoration-methods` rules+overrides (sessionStorage 1h cache), `eligibleFor(product)` → EMB/SCP/DTF bools + DTG `'yes'/'warn'/'no'` cotton gate, `categoriesFor(method)` for the catalog Decoration filter; API down → embroidery-only fallback (`source:'fallback'`, caller must show a visible warning) | APP_CONFIG (optional) | ✅ Active |
| `/shared_components/js/product-category-filter.js` | Single source of truth for cap-vs-flat-headwear classification | — | ✅ Active |
| `/shared_components/js/product-filters.js` | Product filter UI (size, color, brand, etc.) | — | ✅ Active |
| `/shared_components/js/product-grid.js` | Product grid display + lazy load | — | ✅ Active |
| `/shared_components/js/safety-stripe-recs.js` | **NEW (2026-06-28)** Shared renderer for curated hi-vis "safety apparel" recommendation cards (`SafetyStripeRecs.render(mountId, {variant,audience,onAdd,limit})`). Used by all 4 quote builders, Quick Quote, and the customer catalog. Fetches `GET /api/safety-stripes/top-sellers/styles` (Caspio `Safety_Stripe_Top_Sellers_2026`); `variant:'builder'` = one-click Add, `variant:'catalog'` = customer card (no sales numbers). Fails quiet (optional cross-sell). | safety-stripe-recs.css, caspio-proxy API | ✅ Active |
| `/shared_components/js/product-pricing-ui.js` | Product pricing UI rendering | universal-pricing-grid.js | ✅ Active |
| `/shared_components/js/product-recommendations.js` | Product recommendation engine | — | ✅ Active |
| `/shared_components/js/product-search.js` | Product search UI | product-search-service.js | ✅ Active |
| `/shared_components/js/exact-match-search.js` | Optimized exact-style-number search for sales reps | /api/products/search | ✅ Active |

### ShopWorks Integration Services
| File | Purpose | Dependencies | Status |
|------|---------|--------------|--------|
| `/shared_components/js/edp-generator-service.js` | OnSite 7 EDP file generator (External Data Processor format) | — | ✅ Active |
| `/shared_components/js/shopworks-edp-generator.js` | ShopWorks-specific EDP wrapper | edp-generator-service.js | ✅ Active |
| `/shared_components/js/shopworks-guide-generator.js` | Generic ShopWorks order guide generator | — | ✅ Active |
| `/shared_components/js/manageorders-customer-service.js` | ManageOrders customer lookup service | /api/manageorders/customers | ✅ Active |
| `/shared_components/js/manageorders-inventory-service.js` | ManageOrders inventory queries | /api/manageorders/inventory | ✅ Active |

### Mockup Workflow Services
| File | Purpose | Dependencies | Status |
|------|---------|--------------|--------|
| `/shared_components/js/mockup-ae.js` | AE mockup workflow logic (review, send, approve) | — | ✅ Active |
| `/shared_components/js/mockup-ruth.js` | Ruth mockup workflow logic (digitizing) | — | ✅ Active |
| `/shared_components/js/mockup-submit-form.js` | Mockup submit form controller | — | ✅ Active |
| `/shared_components/js/sticker-banner-submit-form.js` | **NEW** AE Sticker/Banner art-request intake form (posts to /api/artrequests with Item_Type=Sticker/Banner + structured Item_Specs_Notes block) | /api/artrequests, /api/files/upload, EmailJS | ✅ Active |
| `/shared_components/js/garment-submit-form.js` | **NEW (2026-06-17)** AE Garment art-request intake form — replaced Caspio DataPage a0e150009f0e9f9d4ff3457dae47. Fully structured fields (Artwork_Status, Approval_Status, Artwork_Locations JSON, Color_Mode/PMS/Thread/Underbase, Exact_Text, prev-order ref, Uploaded_File_Type, AE checklist). Style→Color cascade via /api/stylesearch + /api/product-colors. | /api/artrequests, /api/files/upload, /api/stylesearch, /api/product-colors, CompanyContactPicker, DesignNamePicker, WorkOrderPicker, EmailJS | ✅ Active |
| `/shared_components/js/jds-tumbler-template.js` | **NEW** Algorithm module for JDS Tumbler Mockup Creator — mask coords, color sampling, engrave-color resolver, logo silhouette extractor. Shared by standalone page and (Phase 2) art-request integration. | (none — pure canvas logic) | ✅ Active |
| `/pages/js/jds-mockup-creator.js` | Standalone JDS Mockup Creator page logic — color picker, file upload (PNG/JPG/SVG), live preview with pointer/touch drag + arrow-key nudge, auto-fit, recenter, toggleable imprint guide, branded presentation frame, full-res PNG download, copy-to-clipboard, multi-color comparison sheet, and an Edit/Preview-frame toggle. | jds-tumbler-template.js, /api/jds-catalog, /api/jds/products/:sku | ✅ Active |
| `/pages/css/jds-mockup-creator.css` | Standalone JDS Mockup Creator styling — 2026 design tokens (scoped :root), Inter, two-column layout, swatch grid, drop zone, segmented Edit/Preview control, compare grid, focus/reduced-motion a11y states, brand maroon accent. | jds-mockup-creator.html | ✅ Active |
| `/pages/js/garment-designer.js` | **NEW (2026-06-17)** Easy Shirt Designer logic (extracted from the single-file app, 5028 lines) — entries[] model, DST decoder/renderer, RA-Poly thread system (per-stitch element naming), drawn/photo shirt mockup compositor, Customer Proof, PNG/proof export. Fixed: duplicate proof thread line, malformed-DST guard. | garment-designer.html, ag-psd, pdf.js, jszip | ✅ Active |
| `/pages/css/garment-designer.css` | **NEW (2026-06-17)** Easy Shirt Designer styling (extracted, 1851 lines). | garment-designer.html | ✅ Active |
| `/shared_components/js/garment-text-engine.js` | **NEW (2026-06-20)** Pure text-tool + contrast math (txtCase/defaultTextModel/rotatedBounds/arcLayout/hexLuminance/pickContrastWarning) — no DOM/canvas, loads in browser (window.GarmentTextEngine) AND Jest. Extracted from garment-designer.js for testability; loaded before it. | garment-designer.js (delegates), tests/unit/garment-text-engine.test.js | ✅ Active |
| `/images/garments/{polo,hoodie,longsleeve,ladies}_{front,back}.jpg` | **NEW (2026-06-20)** SanMar flat-laydown garment photos (K500 polo, PC78H hoodie, PC54LS long-sleeve, LPC54 ladies tee — solid colors, 1200×1800) for the Easy Shirt Designer "Garment style" picker. Same-origin so the recolor canvas can read pixels (SanMar CDN lacks CORS). Sourced via proxy `/api/product-details`. | garment-designer.js (GARMENT_STYLES) | ✅ Active |
| `/pages/mockup-library.html` | **NEW (2026-06-20)** Saved Mockups library — gallery of every art request with a `Rep_Mockup` (Shirt Designer mockups). Search + re-open in designer + open request. No new Caspio table (reads existing `Rep_Mockup`). Linked from AE dashboard nav + designer header. | mockup-library.js/.css, art-hub.css, app.config.js | ✅ Active |
| `/pages/js/mockup-library.js` | **NEW (2026-06-20)** Saved Mockups logic — fetches `/api/artrequests?repMockup=true`, renders cards (image + company + design# + meta chips), company/design# search, lightbox, visible-error handling. | mockup-library.html, proxy `/api/artrequests` | ✅ Active |
| `/pages/css/mockup-library.css` | **NEW (2026-06-20)** Saved Mockups library styling (reuses art-hub.css tokens) — responsive card grid, lightbox. | mockup-library.html | ✅ Active |

### Sample Order System
| File | Purpose | Dependencies | Status |
|------|---------|--------------|--------|
| `/shared_components/js/sample-pricing.js` | **NEW (2026-07-06)** Dual-load blank-sample pricing math (free <$10 blank cost, else halfDollarCeil(cost ÷ BLANK MarginDenominator) + size upcharge) — the SAME module prices the browser buttons AND server.js's /api/samples/create-checkout-session reprice (screen === Stripe charge by construction). Jest: sample-pricing.test.js | pure (raw /api/size-pricing + BLANK-bundle responses in) | ✅ Active |
| `/shared_components/js/sample-cart-service.js` | **NEW (2026-07-06)** Shared sample-program engine (extracted from retired top-sellers-showcase inline script) — eligibility/pricing via sample-pricing.js, color/size variants, sessionStorage('sampleCart') CRUD, inventory gate, toasts. window.sampleCart singleton. | sample-pricing.js, /api/size-pricing, /api/pricing-bundle?method=BLANK, /api/color-swatches, sample-inventory-service.js | ✅ Active |
| `/shared_components/js/samples-order-payload.js` | **NEW (2026-07-06)** Pure ManageOrders push-payload builder for PAID sample orders — mirrors the free flow's proven line-item shape + the storefront Stripe payments block (order lands in ShopWorks PAID, terms Prepaid). Consumed by server.js handleSamplesOrderPaid (webhook kind 'samples-order'). Jest: samples-order-payload.test.js | pure | ✅ Active |
| `/pages/js/sample-checkout.js` | **NEW (2026-07-06)** Paid-sample Stripe checkout layer for sample-cart.html — delegated from the page's submit handler when the cart has paid items; POSTs /api/samples/create-checkout-session then redirects to Stripe hosted checkout; handles ?success/?canceled returns; paid-cart copy (secure-payment button, credit-toward-first-order note). Free-only carts keep the direct request flow. | /api/samples/create-checkout-session, sessionStorage('sampleCart') | ✅ Active |
| `/shared_components/js/sample-inventory-service.js` | Real-time SanMar inventory check for sample products | /api/sanmar/inventory | ✅ Active |
| `/shared_components/js/sample-order-service.js` | Free sample order submission to ShopWorks (customer #2791, $0.01/sample) | /api/manageorders, EmailJS | ✅ Active |

### Pricing Matrix & Calculator Helpers
| File | Purpose | Dependencies | Status |
|------|---------|--------------|--------|
| `/shared_components/js/pricing-calculator.js` | Generic pricing calculator helper | — | ✅ Active |
| `/shared_components/js/pricing-matrix-api.js` | Pricing matrix API client (shared_components copy) | Caspio API | ✅ Active |
| `/shared_components/js/pricing-matrix-capture.js` | Captures pricing matrix from hidden Caspio iframe | Caspio datapage | ✅ Active |
| `/shared_components/js/pricing-pages.js` | Shared logic for pricing pages (legacy) | — | ✅ Active |
| `/shared_components/js/calculator-inventory.js` | Collapsible warehouse inventory grid (auto-attaches to color swatches) | /api/sanmar/inventory | ✅ Active |
| `/shared_components/js/sku-validation-service.js` | SanMar→ShopWorks SKU validation + 2XL→`_2X` translation | — | ✅ Active |

### Additional Logo (AL) Helpers
| File | Purpose | Dependencies | Status |
|------|---------|--------------|--------|
| `/shared_components/js/additional-logo-cap-simple.js` | Simple AL pricing for cap quote builder | embroidery-pricing-service.js | ✅ Active |
| `/shared_components/js/additional-logo-embroidery-simple.js` | Simple AL pricing for embroidery quote builder | embroidery-pricing-service.js | ✅ Active |

### UI Utilities & Helpers
| File | Purpose | Dependencies | Status |
|------|---------|--------------|--------|
| `/shared_components/js/toast-notifications.js` | Toast notification system (success/error/info) | — | ✅ Active |
| `/shared_components/js/elapsed-time-utils.js` | Elapsed-time badges with urgency tiers (Fresh / Waiting / Overdue) — used by all art/mockup dashboards | caspio-date-utils.js | ✅ Active |
| `/shared_components/js/caspio-date-utils.js` | Single source of truth for parsing Caspio timestamps (Pacific server time → correct UTC instant, DST-aware). Use `window.CaspioDate.parse/formatDateTime/formatDate/formatAge` instead of any `+ 'Z'` append idiom. | — | ✅ Active |
| `/shared_components/js/enhanced-loading-animations.js` | Enhanced loading animations (skeleton screens, spinners) | — | ✅ Active |
| `/shared_components/js/manual-mode-indicator.js` | Visual banner shown when pricing pages are in manual cost override mode | — | ✅ Active |
| `/shared_components/js/header-button-functions.js` | Header button helper functions (shareQuote, etc.) | — | ✅ Active |
| `/shared_components/js/cart-drawer.js` | Slide-in sample-cart drawer (color/size picker) — used by /catalog Top Sellers view + product.html Order-a-sample CTA | sample-cart-service.js, cart-drawer.css | ✅ Active |
| `/shared_components/js/confetti.js` | Canvas-based confetti animation (lightweight, no library) | — | ✅ Active |
| `/shared_components/js/quote-indicator-manager.js` | Persistent quote-indicator widget (collapsible, real-time updates) | — | ✅ Active |
| `/shared_components/js/design-thumbnail-service.js` | Fetch design thumbnails from `Shopworks_Thumbnail_Report` (cached) | /api/thumbnails | ✅ Active |
| `/shared_components/js/jds-api-service.js` | JDS Industries API service (laser tumblers, 1hr cache) | /api/jds | ✅ Active |
| `/shared_components/js/laser-tumbler-simple.js` | Simple laser tumbler quote flow | jds-api-service.js | ✅ Active |
| `/shared_components/js/laser-tumbler-mockup.js` | Customer logo mockup + instant quote on the laser tumbler page — page's 4 colors only, logo upload w/ artwork warnings, drag/size canvas preview, PNG download, qty→price via formula pricing | jds-tumbler-template.js, jds-api-service.js, laser-tumbler-simple.js, /api/jds-catalog | ✅ Active |
| `/shared_components/js/dp5-helper.js` | Embroidery pricing UI helper — bridges hidden Caspio matrix to custom UI | Caspio datapage | ✅ Active |

### Staff Auth & Misc Dashboards
| File | Purpose | Dependencies | Status |
|------|---------|--------------|--------|
| `/lib/staff-saml.js` | Staff SAML SSO Service Provider (#2) — verifies Caspio "Staff" directory signed assertions server-side; replaces forgeable /api/crm-session. Used by `/auth/saml/*` routes in server.js | @node-saml/node-saml, SAML_* env vars | 🟡 Built 2026-06-29, awaiting deploy+test (see memory/STAFF_AUTH_DESIGN.md) |
| `/shared_components/js/staff-auth-helper.js` | Staff auth gate (Caspio role lookup) — used by quote-audit and staff-only pages | /api/staff/auth | ✅ Active |
| `/shared_components/js/staff-dashboard-employees.js` | Staff dashboard employee list/widget | /api/employees | ✅ Active |
| `/shared_components/js/monogram-dashboard.js` | Monogram dashboard controller | — | ✅ Active |

### Test/Dev Utilities (in shared_components/js — TODO move to /tests/)
| File | Purpose | Dependencies | Status |
|------|---------|--------------|--------|
| `/shared_components/js/order-service-test-extended.js` | Extended order service tests | sample-order-service.js | ⚠️ Move to /tests/ |
| `/shared_components/js/order-service-test-utilities.js` | Order service test utilities | — | ⚠️ Move to /tests/ |

### Product Page Modules (`/product/`)
| File | Purpose | Dependencies | Status |
|------|---------|--------------|--------|
| `/product/js/pdp-configurator.js` | Product page 3-question configurator (2026-06-11 redesign) | QuoteCartEngine | ✅ Active |
| `/product/js/product-2026.js` | Product page controller (2026-06-11 redesign) | — | ✅ Active |
| `/product/css/product-2026.css` | Product page styles (2026-06-11 redesign) | — | ✅ Active |
| `/product/js/decoration-selector.js` | Legacy decoration selector — zero references repo-wide (verified 2026-06-11), kept pending owner decision | — | 🚩 Orphan |
| `/product/components/inventory.js` | Product inventory display (per size/color) — used by pages/inventory-details.html | services/api.js | ✅ Active |
| `/product/services/api.js` | Product API service (fetch product, inventory, pricing) — used by pages/inventory-details.html | Caspio API | ✅ Active |
| `/product/styles/product.css` | Inventory-details page styles (linked by pages/inventory-details.html) | — | ✅ Active |

> 🗑️ **2026-06-11 legacy ES-module tree deleted** (dead since the product.html configurator rewrite; zero references verified): `app.js`, `components/{search,gallery,pricing,inventory-summary,info,swatches,decoration-selector,quote-modal,image-zoom}.js`, `services/{state,quote-service,email-service}.js`, `styles/{product-2025,product-redesign,quote-modal}.css`. Recovery: `git show <pre-cleanup-commit>:product/app.js`.

## 🎨 Stylesheets

### Core CSS Files
| File | Purpose | Used By | Status |
|------|---------|---------|--------|
| `/shared_components/css/universal-header.css` | Header styles | All pages | ✅ Active |
| `/shared_components/css/universal-calculator-theme.css` | Calculator theme | All calculators | ✅ Active |
| `/shared_components/css/embroidery-quote-builder.css` | ~~DELETED~~ — replaced by `embroidery-quote-builder-extracted.css` (2026-01-27) | — | ❌ Deleted |
| `/shared_components/css/embroidery-quote-builder-extracted.css` | Embroidery quote builder styles (2026-01-27 extraction) | Embroidery quote builder | ✅ Active |
| `/shared_components/css/quote-builder-unified-step1.css` | ~~DELETED~~ — superseded by `quote-builder-common.css` (2026-01-27) | — | ❌ Deleted |
| `/shared_components/css/dtg-quote-builder.css` | DTG specific | DTG quote builder | ✅ Active |
| `/shared_components/css/golf-tournament-showcase.css` | **NEW** Golf tournament landing page styles (golf theme — fairway greens, sand accents, gold offer ribbon) | golf-tournaments-2026.html, golf-tournament-product.html | ✅ Active |
| `/shared_components/css/golf-tournament-product.css` | **NEW** Product detail page styles (gallery, color swatches, size pills, volume pricing table) — layered on top of showcase.css | golf-tournament-product.html | ✅ Active |
| `/shared_components/css/dtg-quote-builder-extracted.css` | DTG quote builder extracted styles (2026-01-27) | DTG quote builder | ✅ Active |
| `/shared_components/css/screenprint-quote-builder-extracted.css` | Screenprint quote builder extracted styles (2026-01-27) | Screenprint quote builder | ✅ Active |
| `/shared_components/css/quote-builder-step2-modern.css` | ~~DELETED~~ — Step 2 styles merged into `quote-builder-common.css` | — | ❌ Deleted |
| `/shared_components/css/quote-builder-common.css` | **Shared** quote builder styles (2026-03 unification — common to all 4 builders) | All 4 quote builders | ✅ Active |
| `/shared_components/css/quote-builder-guided.css` | **NEW (2026-07-07, guided-quote Phase B)** Styles for the Guided Quote shell: sticky 4-step header, one-step-at-a-time visibility (`.guided-hidden`), prev/next nav, workbench toggle, card treatment for the 2 relocated sidebar panels; print rule force-shows all steps. Loads after quote-builder-shell.css (PNW tokens). | EMB/SCP/DTF builder HTMLs, quote-builder-guided.js | ✅ Active |
| `/shared_components/css/quote-builder-shell.css` | **NEW (2026-05-23)** Phase 2a — Canonical PNW visual language. PNW palette tokens (forest greens + birch + mist), card/button/titlebar/chip/input primitives (`.qb-*`), and legacy aliases that auto-uplift `var(--builder-primary)` / `var(--nwca-blue)` / `var(--nwca-green)` to PNW forest. Load order: shell BEFORE common BEFORE builder-specific. Opt-in body class `qb-shell-body` activates Inter typography + topo SVG background. | All 4 quote builders (Phase 2b rollout: SCP → DTF → EMB) | ✅ Active (Phase 2a tokens defined; per-builder reskin in progress) |
| `/shared_components/css/quote-share-modal.css` | **NEW** Shareable URL modal styles (2026 consolidation) | All quote builders | ✅ Active |
| `/shared_components/css/quote-print.css` | Quote print styles (PDF export) | All quote builders | ✅ Active |
| `/shared_components/css/quote-system.css` | Quote system shared styles | All quote builders | ✅ Active |

### Calculator & Pricing Stylesheets
| File | Purpose | Used By | Status |
|------|---------|---------|--------|
| `/shared_components/css/calculator-base.css` | Calculator base styles (foundation for all calc pages) | All calculators | ✅ Active |
| `/shared_components/css/contract-pricing-theme.css` | **NEW (2026-05-13)** Pink-accent theme overlay for Contract pricing pages — operational color-code matching the pink box labels NWCA puts on contract jobs in the factory. Layers on top of calculator-base.css; rebinds `--primary-green`/`--primary-color`/`--primary-dark` to rose-600/700 so existing calculator CSS reuses pink without rewrite. Adds `.contract-share-btn` + `.contract-share-toast` + `.contract-info-banner` components for the "calculate → copy link → share with customer" workflow. Activated via `<body class="contract-pricing">`. | calculators/dtg-contract/index.html, calculators/embroidery-contract/index.html | ✅ Active |
| `/shared_components/css/calculator-modern-enhancements.css` | Modern calculator enhancements (2026 refresh) | All calculators | ✅ Active |
| `/shared_components/css/shared-pricing-styles.css` | Shared pricing display styles | All pricing pages | ✅ Active |
| `/shared_components/css/screenprint-pricing-clean.css` | Clean screen print pricing styles | Screen print calculator | ✅ Active |
| `/shared_components/css/screenprint-pricing-tables.css` | Screen print pricing tables | Screen print calculator | ✅ Active |
| `/shared_components/css/screenprint-toggle-styles.css` | Screen print toggle styles | Screen print calculator | ✅ Active |
| `/shared_components/css/screenprint-safety-stripes.css` | Safety stripes feature styles | Screen print + safety stripe creator | ✅ Active |
| `/shared_components/css/safety-stripe-creator.css` | Safety stripe creator styles | safety-stripe-creator.html | ✅ Active |
| `/shared_components/css/dtf-calculator.css` | DTF calculator styles | DTF pricing calculator | ✅ Active |
| `/shared_components/css/dtf-calculator-fix.css` | DTF calculator style fixes | DTF pricing calculator | ✅ Active |
| `/shared_components/css/dtf-outline-override.css` | DTF outline override styles | DTF pricing calculator | ✅ Active |
| `/shared_components/css/dtg-brand-override.css` | DTG brand color overrides | DTG quote builder | ✅ Active |
| `/shared_components/css/dtg-ltm-quantity-input.css` | DTG LTM quantity input styles | DTG calculators | ✅ Active |
| `/shared_components/css/laser-tumbler-simple.css` | Laser tumbler simple flow styles | Laser tumbler calculator | ✅ Active |
| `/calculators/screenprint-manual-fix.css` | Screen print manual calculator fix styles | Manual pricing calculator | ✅ Active |

### Universal & Component Stylesheets
| File | Purpose | Used By | Status |
|------|---------|---------|--------|
| `/shared_components/css/universal-image-gallery.css` | Universal image gallery styles | Product pages | ✅ Active |
| `/shared_components/css/universal-pricing-components.css` | Universal pricing component styles | Pricing pages | ✅ Active |
| `/shared_components/css/universal-pricing-grid.css` | Universal pricing grid styles | Pricing pages | ✅ Active |
| `/shared_components/css/universal-pricing-header.css` | Universal pricing header styles | Pricing pages | ✅ Active |
| `/shared_components/css/universal-pricing-layout.css` | Universal pricing layout styles | Pricing pages | ✅ Active |
| `/shared_components/css/universal-product-display.css` | Universal product display styles | Product pages | ✅ Active |
| `/shared_components/css/universal-quick-quote.css` | Universal quick quote styles | Quote builders | ✅ Active |
| `/shared_components/css/universal-toggle-pricing.css` | Universal toggle pricing styles | Pricing pages | ✅ Active |
| `/shared_components/css/universal-ltm-quantity-input.css` | Universal LTM quantity input styles | All quote builders | ✅ Active |
| `/shared_components/css/additional-logo-pricing-table.css` | Additional logo pricing table styles | Cap + embroidery quote builders | ✅ Active |
| `/shared_components/css/color-picker-shared.css` | Shared color picker styles | All quote builders | ✅ Active |
| `/shared_components/css/product-thumbnail-modal.css` | Product thumbnail modal styles | All quote builders | ✅ Active |
| `/shared_components/css/image-modal.css` | Generic image modal styles | Multiple pages | ✅ Active |
| `/shared_components/css/cart-drawer.css` | Cart drawer slide-in styles | Cart UI | ✅ Active |
| `/shared_components/css/dashboard-styles.css` | Shared dashboard styles | All dashboards | ✅ Active |
| `/shared_components/css/kanban.css` | Kanban board shared styles (4 boards: art-hub, transfers, supacolor, etc.) | All kanban dashboards | ✅ Active |
| `/shared_components/css/art-hub.css` | Art Hub design tokens + shared styles (2026 design system) | art-hub-steve, art-hub-ruth, ae-dashboard, bradley-transfers | ✅ Active |
| `/shared_components/css/dash-shell.css` | **NEW (2026-05-16)** Canonical shell classes (`.dash-header`, `.dash-back-link`, `.dash-content`, `.dash-error-banner`, `.dash-stat-card`, `.dash-card`, `.dash-btn`) for staff-dashboard child pages. Reuses art-hub.css tokens — defines NO new tokens. Emitted by every page scaffolded via the `/dash-page` skill. | art-hub.css, all `/dash-page new`-scaffolded pages | ✅ Active |
| `/dashboards/css/digitized-designs.css` | **NEW (2026-05-16)** Page-specific styles for digitized-designs.html. Extracted from inline `<style>` block on 2026-05-16 by `/dash-page lift` — pure extraction (no token swap, no class rename) so behavior matches pre-lift exactly. | digitized-designs.html | ✅ Active |
| `/shared_components/css/emblem-pricing-page.css` | **NEW (2026-05-16)** Emblem patch page overrides — loads ON TOP of sticker-pricing-page.css. Adds the 16×10 pricing-grid table styling, AI-quoted cell highlight, live emblem-quote card, mobile collapse. Sticker provides the chat panel + hero + accordion shell; this file only adds emblem-unique bits. | sticker-pricing-page.css, /calculators/embroidered-emblem/index.html | ✅ Active |
| `/shared_components/css/webstore-pricing-page.css` | **NEW (2026-05-16)** Custom-webstore page overrides — loads ON TOP of sticker-pricing-page.css. Adds: cream/navy `.webstore-quote-card` for store-setup quotes, deep-purple/gold `.fundraiser-quote-card` for fundraiser sell-price math, distinct `.web-search-chip` styling + `.web-search-results` inline list for Tavily search results. | sticker-pricing-page.css, /calculators/webstores.html | ✅ Active |
| `/shared_components/css/dtg-quote-page.css` | **NEW (2026-05-17)** DTG quote-builder overrides — loads ON TOP of sticker-pricing-page.css. Adds: deep-green `.dtg-quote-card` for the live price card, `.top-seller-card` recommendation cards (rendered inline in chat by the recommend_top_sellers tool), `.shopworks-success-card`, `.shopworks-error-card`. | sticker-pricing-page.css, /quote-builders/dtg-quote-builder.html | ✅ Active |
| `/shared_components/css/dtg-inline-form.css` | **NEW (2026-05-18)** Inline DTG order form styles — NWCA-green, replaces the iframed legacy Bootstrap form. Adds `.dtg-form-wrap` (paper card), `.dtg-location-pill` (front/back imprint chooser), `.dtg-rows-table` (multi-row table with style/color combobox + size grid), `.dtg-price-summary` (live tier + LTM card), `.dtg-customer-pane` (right-side customer panel mirroring the order form). | /quote-builders/dtg-quote-builder.html, builders/dtg | ✅ Active |
| `/shared_components/css/dtg-catalog.css` | **NEW (2026-05-18)** NWCA-Approved DTG Catalog browser styles — category-tabbed style grid (`.dtg-catalog-grid` + `.dtg-catalog-card`) with rank badges, plus full-screen detail modal (`.dtg-catalog-modal`) with per-color "Add to quote" cards. **2026-06-03**: + full-catalog fallback styles (`.dtg-fullcat-*`: empty-state CTA, results header/back link, compact result cards, suitability warning chips, footer link). Loaded on dtg-quote-builder.html. | /quote-builders/dtg-quote-builder.html, dtg-catalog.js | ✅ Active |
| `/shared_components/css/art-invoice-shared.css` | Shared art invoice styles | Art invoice creator + viewer | ✅ Active |
| `/shared_components/css/art-invoice-dashboard.css` | Art invoice dashboard styles | art-invoices-dashboard.html | ✅ Active |
| `/shared_components/css/mockup-ruth.css` | Ruth mockup workflow styles | art-hub-ruth.html | ✅ Active |
| `/shared_components/css/mockup-submit-form.css` | Mockup submit form styles | mockup-submit-form | ✅ Active |
| `/shared_components/css/sticker-banner-submit-form.css` | **NEW** Sticker/Banner intake form + Item-Type pill bar styles (ae-dashboard Submit Artwork tab) | ae-dashboard.html | ✅ Active |
| `/shared_components/css/garment-submit-form.css` | **NEW (2026-06-17)** Garment art-request form styles (.gsf-* — sections, garment rows, location rows, AE checklist, style autocomplete) | ae-dashboard.html | ✅ Active |
| `/shared_components/css/sticker-pricing-page.css` | **NEW (2026-05-15)** Sticker + Banner quote page styles — NWCA green theme, right-side drawer chat panel, row-highlight animation on AI-quoted SKU, dark-blue banner rate-card grid + live banner-quote card | sticker-manual-pricing.html | ✅ Active |
| `/shared_components/css/ae-nav-v2.css` | **NEW** AE Dashboard two-tier navigation (Tier 1: Steve/Ruth/Transfers/Personalization sections; Tier 2: sub-tabs) | ae-dashboard.html | ✅ Active |
| `/shared_components/css/transfer-actions.css` | Transfer action button styles | bradley-transfers + transfer-detail | ✅ Active |
| `/shared_components/css/force-green-theme.css` | Force NWCA green theme override | Multiple pages | ✅ Active |
| `/shared_components/css/modern-enhancements.css` | Modern UI enhancement overlays | Multiple pages | ✅ Active |
| `/shared_components/css/names-numbers.css` | Names & Numbers roster manager styles | names-numbers.html + dashboard | ✅ Active |
| `/shared_components/css/monogram-form.css` | Monogram form styles | monogram-form.html | ✅ Active |
| `/shared_components/css/old-designs.css` | Old designs archive styles | old-designs.html | ✅ Active |
| `/shared_components/css/customer-lookup.css` | Customer lookup autocomplete styles | All quote builders | ✅ Active |
| `/shared_components/css/shopworks-import.css` | ShopWorks import modal styles | Embroidery quote builder | ✅ Active |

### 🧮 Manual Calculator CSS Architecture

**Shared Foundation:** `/calculators/manual-calculator-styles.css` (655 lines)
- Provides: Headers, breadcrumbs, forms, buttons, alerts, pricing displays, responsive design, print styles
- Color Theme: NWCA Green (#4cb354)
- Used by: DTG, DTF, Embroidery, Laser manual calculators

**⚠️ IMPORTANT:** These calculators were built independently over time. Each works correctly but uses different CSS approaches. **Leave as-is unless broken.**

| Calculator | CSS Pattern | External Files | Inline CSS | Notes |
|------------|-------------|----------------|------------|-------|
| **DTG Manual** | ✅ Standard | 1 (shared) | ~100 lines | Product showcase, hero section |
| **DTF Manual** | ✅ Standard | 1 (shared) | ~150 lines | Product showcase, DTF features |
| **Embroidery Manual** | ✅ Standard | 1 (shared) | ~200 lines | Product showcase, stitch displays |
| **Laser Manual** | ✅ Standard | 1 (shared) | ~150 lines | Product showcase, laser features |
| **Screen Print Manual** | 🔶 Complex | **16 files** | ~200 lines | Copied from contract page, never refactored. Uses universal-pricing-* files + manual-calculator-styles.css. **Looks great, leave it alone.** |
| **Cap Embroidery Manual** | 🔶 Standalone | 1 (cap-fix) | ~550 lines | Built independently, doesn't use shared CSS. **Works fine as-is.** |
| **Sticker Pricing** | ✅ Clean Table | 0 | ~400 lines | **Simple pricing table page - NO calculator.** Replaced complex calculator with clean, easy-to-read tables for 4 standard sizes (2"×2", 3"×3", 4"×4", 5"×5"). Mobile-responsive, NWCA green theme. |

#### CSS Files Detail

**Screen Print Manual (16 files):**
```
manual-calculator-styles.css (shared)
universal-pricing-header.css
universal-pricing-layout.css
universal-calculator-theme.css
universal-pricing-components.css
shared-pricing-styles.css
modern-enhancements.css
universal-header.css
universal-image-gallery.css
universal-quick-quote.css
universal-pricing-grid.css
image-modal.css
force-green-theme.css
screenprint-pricing-tables.css
screenprint-safety-stripes.css
screenprint-toggle-styles.css
```

**Cap Embroidery Manual:**
```
cap-embroidery-fix.css
+ 550 lines of inline CSS
```

**Sticker Manual:**
```
686 lines of inline CSS (complete framework)
```

#### Guidance for NEW Manual Calculators

**Standard Pattern (Recommended):**
```html
<link href="manual-calculator-styles.css" rel="stylesheet">

<style>
    /* ONLY calculator-specific features */
    /* Product showcase, unique animations, method-specific UI */
    /* Keep under 200 lines */
</style>
```

**What Goes Where:**
- **Shared CSS:** Headers, breadcrumbs, forms, buttons, pricing displays
- **Inline CSS:** Product showcases, unique features, method-specific animations

**DO NOT:** Try to "fix" existing calculators unless there's a bug. They work.

## 📚 Documentation & Guides

### Memory/Reference Documentation
| File | Purpose | Status |
|------|---------|--------|
| `/memory/CUSTOMER_SITE_REDESIGN_2026-06.md` | **NEW** Customer-facing redesign master plan + Custom Hats store spec (2026-06-11) | ✅ Active |
| `/memory/CUSTOMER_SITE_REDESIGN_2026-06_FINDINGS.md` | **NEW** Full 8-agent discovery audit evidence for the redesign (2026-06-11) | ✅ Active |
| `/memory/CUSTOMER_QUOTE_CART_DESIGN_2026-06.md` | **NEW** Customer quote-cart: builder parity rules EMB/DTG/SCP/DTF (worked examples = jest fixtures) + architect design + 5-phase plan (2026-06-11) | ✅ Active |
| `/memory/QUOTE_BUILDER_GUIDE.md` | Complete guide for creating new quote builders | ✅ Active |
| `/memory/QUOTE_BUILDER_UX_AUDIT_2026-07.md` | Order-entry UX audit of all 4 quote builders — click scorecard, verified price-display risks, P1–P3 recommendations (2026-07-06) | ✅ Active |
| `/memory/QUOTE_BUILDER_EXPERT_AUDIT_2026-07-07.md` | **NEW** 5-expert audit of EMB/DTF/SCP builders — 62 verified findings: money leaks, endgame drift, guided-shell follow-ups, CSS/shell; punch list + policy decisions (2026-07-07) | ✅ Active |
| `/memory/SCREENPRINT_QUOTE_BUILDER.md` | Screen Print Quote Builder 2026 documentation | ✅ Active |
| `/memory/EMBROIDERY_PRICING_RULES.md` | Complete embroidery pricing formulas (FB, AL, caps, tiers) | ✅ Active |
| `/memory/EMBROIDERY_PRICING_PHILOSOPHY.md` | **NEW** Three-tier philosophy, loopholes, financial impact (2026-02-05) | ✅ Active |
| `/memory/training/EMBROIDERY_PRICING_SALES_TRAINING.md` | **NEW** Sales rep training slides for Taneisha & Ruthie (2026-02-05) | ✅ Active |
| `/memory/EMBROIDERY_ITEM_TYPES.md` | Canonical ItemType reference for Embroidery_Costs table | ✅ Active |
| `/memory/DECG_PRICING_2026.md` | **NEW** Customer Supplied Embroidery (DECG) pricing reference | ✅ Active |
| `/memory/CASPIO_API_TEMPLATE.md` | API documentation (55 endpoints) | ✅ Active |
| `/memory/STAFF_DIRECTORY.md` | Staff contacts for dropdowns | ✅ Active |
| `/memory/DATABASE_PATTERNS.md` | Database schema reference | ✅ Active |
| `/memory/CRM_DASHBOARD_AUTH.md` | CRM dashboard role-based auth (sessions + API proxy) | ✅ Active |

## 📂 Dashboard & Admin

### Handbook PDF Generator (`/scripts/handbook-pdf/` — NEW 2026-07-10)

| File | Purpose | Dependencies | Status |
|------|---------|--------------|--------|
| `/scripts/handbook-pdf/build_handbook_docx.js` | Rebuilds the printable Employee Handbook booklet (forms/Employee-Handbook-Latest.pdf) from LIVE hub chapters — cover w/ logo, TOC w/ page numbers, punch margins, per-chapter ghost-page compaction | npm docx + node-html-parser, Word COM for PDF export | ✅ Active |
| `/scripts/handbook-pdf/README.md` | Run instructions + ghost-page check recipe | — | ✅ Active |
| `/scripts/handbook-pdf/logo.png` | NWCA logo for the cover (from Caspio CDN) | — | ✅ Active |

### New Dashboard Pages (NEW 2026-04)
| File | Purpose | Dependencies | Status |
|------|---------|--------------|--------|
| `/dashboards/ae-mission-control.html` | **NEW (2026-07-19)** AE Mission Control — per-AE cockpit (Taneisha/Nika; admin view-as): action queue (overdue/due-today/untouched leads, stale quotes, art awaiting approval, kits pending), KPI strip (YTD/MTD, open quotes $, store commission QTD, lead win rate), My Leads/Quotes/Art/Orders panels, quick-actions rail (builders, kit request modal, one-click outreach), rep-scoped SanMar inbound card. Data = ONE `/api/crm-proxy/ae-dashboard/summary` call (proxy aggregate, 3-min cache). Role-gated in server.js (`taneisha`/`nika`; admin auto-passes); AEs land here after SAML login. | dash-shell.css, dash-page-helpers.js, sanmar-inbound-today.js, ae-mission-control.css/js | ✅ Active |
| `/dashboards/js/ae-mission-control.js` | Mission Control controller — `/api/crm-session/me` identity + admin view-as, `/api/crm-proxy/ae-dashboard/summary` aggregate render (per-panel visible errors), kit-request modal (`/api/crm-proxy/marketing-shipments`), outreach modal (`/api/crm-proxy/lead-outreach`), stale-quote reopen via builder `?duplicate=`, art-notification toasts (45s poll), rep-filtered inbound-today; esc() on every value | DashPage, crm-proxy forwarders, sanmar-inbound-today.js | ✅ Active |
| `/dashboards/css/ae-mission-control.css` | Mission Control styles (2026 tokens; greeting row, view-as pill, action-queue color-coded sections, KPI strip, 2-col work panels, kit/outreach modals, toasts) | dash-shell.css, art-hub.css | ✅ Active |
| `/dashboards/purchasing-portal.html` | **NEW (2026-07-19)** Purchasing Portal — company-wide view of every blanks-purchase request sent to Bradley (JotForm Purchasing form, 60d) with requester, WO#/company, Bradley PO#, vendors, ordered/received dates, and status ladder (Sent→Ordered→Received→Invoiced/Shipped). Stat tiles + search + requester/status filters. Any logged-in staff; tile in staff-dashboard Frequently Used; Mission Control purchasing card links here. | dash-shell.css, dash-page-helpers.js, purchasing-portal.css/js, /api/crm-proxy/purchasing-portal | ✅ Active |
| `/dashboards/js/purchasing-portal.js` | Purchasing Portal controller — same-origin `/api/crm-proxy/purchasing-portal` fetch (proxy joins JotForm × PurchaseOrders × ORDER_ODBC), flattens to one row per work order, client search + requester/status filters, SanMar Invoice buttons → shared SanMarInvoiceViewer; esc() everywhere, visible errors | DashPage, crm-proxy forwarder, sanmar-invoice-viewer.js | ✅ Active |
| `/shared_components/js/sanmar-invoice-viewer.js` | **NEW (2026-07-19)** Shared SanMar invoice modal (`window.SanMarInvoiceViewer.open({wo,company,pos,orderedDate})`) — fetches `/api/sanmar-invoices/by-po/:po?orderedDate=` per PO, renders a paper-style invoice document (header/terms/ship-to/line items/totals/Paid-Unpaid badge) + Print/Save PDF via print-sheet pattern. Used by Purchasing Portal AND AE Mission Control so the invoice never drifts between surfaces | APP_CONFIG, sanmar-invoice-viewer.css | ✅ Active |
| `/shared_components/css/sanmar-invoice-viewer.css` | Shared invoice-viewer styles (modal shell, paper-style invoice doc, `#smiv-print-sheet` @media print isolation) | art-hub.css tokens (with fallbacks) | ✅ Active |
| `/dashboards/css/purchasing-portal.css` | Purchasing Portal styles (2026 tokens; stat grid reuse, filter row, scrollable table, status chips matching Mission Control's purchasing palette) | dash-shell.css, art-hub.css | ✅ Active |
| `/dashboards/sanmar-payables.html` | **NEW (2026-07-20)** SanMar Payables — native replacement for the Caspio "Sanmar Vendor Portal" embed + email parse. TWO tabs: **Invoices = OPEN payables worklist** (SanMar `GetUnpaidInvoices` = what we still owe, vendor 1002 only, recent-90d default w/ older-items hint; **upload the ShopWorks payables export** → per-row Imported?/Paid? status + status filter [not-imported / to-pay / all-owed / everything]; per-row viewer; **Download ShopWorks 1002 CSV**) and **Marketing Fund** (SanMar 2026 allotment $35,110.95 → vendor 2425; remaining = allotment − net MRKFUND YTD, year-end projection, month bars, 2425 CSV). MRKFUND excluded from Invoices entirely. Admin+accountant via Staff_Page_Access. ODBC auto-sync of ShopWorks payables replaces the upload later. | dash-shell.css, dash-page-helpers.js, sanmar-payables.css/js, sanmar-invoice-viewer.js, /api/staff/sanmar-invoices/{unpaid,by-date} | ✅ Active |
| `/dashboards/js/sanmar-payables.js` | SanMar Payables controller — Invoices tab: `/api/staff/sanmar-invoices/unpaid` (open ledger, exclude MRKFUND, date-window filter) cross-referenced against an uploaded ShopWorks payables CSV (inline RFC-4180 parser; `normInv()` matches SanMar raw ↔ ShopWorks INV-/CR-/FTC-; Imported=row exists, Paid=date_Paid set) → status badges + filter, default = not-imported+unpaid; ShopWorks 1002 CSV export (M/D/YYYY, INV-/CR-, `$`-amounts, csvCell+BOM). Marketing tab: quarterly YTD `/by-date` filtered to MRKFUND, editable allotment, remaining/projection, month bars, 2425 CSV. SanMarInvoiceViewer drill; esc() everywhere; visible errors. Test seam `window.__SMP_TEST_SW__`. | DashPage, sanmar-invoice-viewer.js, /api/staff/sanmar-invoices/{unpaid,by-date} | ✅ Active |
| `/dashboards/css/sanmar-payables.css` | SanMar Payables styles (2026 tokens; tabs, stat grid, date/PO/invoice filter row, scrollable table w/ checkbox column, credit-row highlight, MRKFUND/credit/zero badges, marketing progress bar + monthly spend bars, export footer) | dash-shell.css, art-hub.css | ✅ Active |
| `/tests/ui/test-sanmar-payables.html` | SanMar Payables UI harness — real controller + CSS over stubbed fetch (no SAML/live SanMar); exercises both tabs, terms-aware checkbox logic (Net30/credit checked, MRKFUND disabled, $0 unchecked), net-amount math, marketing fund tiles/projection/month bars, XSS escaping | sanmar-payables.css/js, test-sanmar-payables-stub.js | ✅ Active |
| `/tests/ui/test-sanmar-payables-stub.js` | Fetch stub for the SanMar Payables harness — window-filtered by-date fixture (Net30 + credit + $0 + MRKFUND across the year, XSS probe) + by-po viewer payload | — | ✅ Active |
| `/tests/ui/test-ae-mission-control.html` | Mission Control UI harness — real controller + CSS over stubbed fetch (no SAML/Caspio); exercises KPIs/queue/panels/view-as/kit modal/outreach modal/inbound rep-scope | ae-mission-control.css/js, test-ae-mission-control-stub.js | ✅ Active |
| `/tests/ui/test-ae-mission-control-stub.js` | Fetch stub for the Mission Control harness — crm-session (admin), ae-dashboard summary (per-rep fixtures incl. XSS probe), bonus/growth/purchasing fixtures, marketing-shipments items+POST, lead-outreach preview/send, inbound-today, art-notifications | — | ✅ Active |
| `/tests/ui/test-inbound-print.html` | **NEW (2026-07-22)** SanMar Inbound print-profile harness — loads the real `sanmar-inbound-today.js` over mock inbound data (no live API), opens the modal, and renders all 6 "Print for…" recipient reports + the dropdown into static preview panes for eyeball/screenshot | quote-management.css, sanmar-inbound-today.js, test-inbound-print.js | ✅ Active |
| `/tests/ui/test-inbound-print.js` | Harness driver + mock — 6 orders (2 AE reps + unassigned, multi-method, box-detail vs lines-only, backorder/short-ship, one received-excluded), mocks fetch/print, clones each print sheet into a visible frame | — | ✅ Active |
| `/tests/ui/test-purchasing-portal.html` | Purchasing Portal UI harness — real controller + CSS over stubbed fetch (no SAML/JotForm/Caspio); exercises stats, table, search + requester/status filters, XSS escaping | purchasing-portal.css/js, test-purchasing-portal-stub.js | ✅ Active |
| `/tests/ui/test-purchasing-portal-stub.js` | Fetch stub for the Purchasing Portal harness — one purchasing-portal payload with all 6 statuses, 3 requesters, and an XSS-probe company name | — | ✅ Active |
| `/tests/ui/test-finished-photos-library.html` | Finished Photos Library UI harness — real controller + CSS over stubbed fetch (no SAML/Caspio/Box); exercises stats, rep chips, account grouping, search/visibility filters, publish toggle, lightbox, XSS escaping | finished-photos-library.css/js, test-finished-photos-library-stub.js | ✅ Active |
| `/tests/ui/test-finished-photos-library-stub.js` | Fetch stub for the library harness — 5 photos across 3 accounts (2 reps + house bucket, XSS-probe company), inline-SVG images, stateful PATCH publish/hide | — | ✅ Active |
| `/tests/ui/test-phase1-widgets.html` | Phase 1+2 widgets harness — real Win Bell/Pride Wall/My Stuff/Command Palette controllers over mocked APP_CONFIG + fetch; exercises fresh-win celebration (ticker + bell + confetti), 6-tile wall rotation, pin/unpin persistence, Ctrl+K open/search/keyboard-nav/copy-toast | phase1-widgets.css, command-palette.css, test-phase1-widgets-mocks.js, test-phase1-widgets.js/.css | ✅ Active |
| `/tests/ui/test-phase1-widgets-mocks.js` | Mocks for the Phase 1 harness — APP_CONFIG, quote_sessions (1 paid CAP + 1 Accepted + 1 ignored), 8 inline-SVG library photos, localStorage scenario seeding | — | ✅ Active |
| `/tests/ui/test-phase1-widgets.js` | Module entry for the Phase 1 harness — imports + inits the three real controllers | win-bell/pride-wall/my-stuff controllers | ✅ Active |
| `/tests/ui/test-phase1-widgets.css` | Harness-only page chrome (dark ground, wrap, note styles) | tokens.css | ✅ Active |
| `/dashboards/lead.html` | **NEW (2026-07-18)** Lead workspace (CRM v2 P2) — full-width "work a lead" record opened from the board/drawer/emails via `#Submission_ID` hash: activity timeline + note composer + drag/paste/click file attach (ArtworkUpload → `/api/files/upload` → timeline `attachment` rows), header status/rep controls, rail panels (contact, follow-up date + quick chips, est. value, ShopWorks match + customer-history intelligence, linked quote w/ live $ + Lead_Value snapshot re-sync, click-gated order history, submitted details, original artwork). No pollers. | leads.css, lead-workspace.css, leads-common.js, lead-workspace.js, artwork-upload.js | ✅ Active |
| `/dashboards/js/lead-workspace.js` | Lead workspace controller — crm-proxy form-submissions detail read + PUTs, lead-activity timeline reads/appends, public customer-history/quote_sessions/company-contacts reads; escapeHTML everywhere | LeadsCommon, DashPage, ArtworkUpload, crm-proxy forwarders | ✅ Active |
| `/dashboards/css/lead-workspace.css` | Lead workspace styles (2-column grid, composer, dropzone, timeline items, rail panels; reuses leads.css ld-* atoms; 2026 tokens) | leads.css, dash-shell.css, art-hub.css | ✅ Active |
| `/dashboards/js/leads-common.js` | Shared Leads CRM core (`window.LeadsCommon`) — pipeline vocabulary (STATUS_CHOICES/WON/TERMINAL/STAGE_OF/DRAG_STATUS), REPS + EMAIL_TO_REP, esc/date/money formatting, payload + attachment parsing (collectAttachments, viewUrl/downloadUrl passthroughs), crm-proxy fetch helpers + logActivity | DashPage | ✅ Active |
| `/tests/ui/test-lead-workspace.html` | Lead workspace UI harness — real controller + CSS over the shared fetch stub + faked XHR uploads (no SAML/Caspio); open with `#JFL0716-1234` | lead-workspace.js/css, leads-common.js, test-leads-stub.js | ✅ Active |
| `/dashboards/leads.html` | **NEW (2026-07-18)** Leads CRM — unified lead board: JotForm website leads (`jotform-lead` rows, 6 forms) + Quote Request/Webstore/Roster from `Form_Submissions`; stat tiles, source/status/rep filters + search, detail drawer with per-form status pipeline, rep assignment, ShopWorks customer match (auto by email at ingest, manual search + link), click-to-load order history. Sidebar 🎯 Leads (top) + CRM & Customers card. No pollers (Caspio quota). | dash-shell.css, dash-page-helpers.js, leads.css, leads.js | ✅ Active |
| `/dashboards/js/leads.js` | Leads CRM controller — same-origin `/api/crm-proxy/form-submissions*` reads + status/rep/customer-link PUTs, public `/api/company-contacts/*` match/search, `/api/crm-proxy/order-odbc*` history; escapeHTML on every lead-sourced value (XSS) | DashPage, /api/crm-session/me, crm-proxy forwarders | ✅ Active |
| `/dashboards/css/leads.css` | Leads CRM styles (2026 tokens; toolbar, table, source badges, status pills, right drawer, match card, orders mini-table) | dash-shell.css, art-hub.css | ✅ Active |
| `/dashboards/lead-scorecard.html` | **NEW (2026-07-19)** Lead Scorecard — per-rep close report over WON leads via `/api/crm-proxy/lead-scorecard`: date-range presets (Since Oct 2025 / YTD / 90d / all), per-rep table (leads closed, order value = orders AFTER inquiry, lifetime value), closed-leads detail w/ rep filter. Linked from the Leads board header. | dash-shell.css, dash-page-helpers.js, lead-scorecard.css, lead-scorecard.js | ✅ Active |
| `/dashboards/js/lead-scorecard.js` | Lead Scorecard controller — session-gated `/api/crm-proxy/lead-scorecard?since=&until=` fetch, preset ranges, per-rep bars + closed-leads table (deep-links to `lead.html#id`); escapes every value | DashPage, crm-proxy forwarder | ✅ Active |
| `/dashboards/css/lead-scorecard.css` | Lead Scorecard styles (2026 tokens; preset chips, date range, rep value-bars, tabular-num tables) | dash-shell.css, art-hub.css | ✅ Active |
| `/dashboards/unqualified-leads.html` | **NEW (2026-07-19)** Unqualified & Spam Leads — review page for leads Claude tagged `Lead_Category='spam'|'unqualified'` (kept `Status=Archived`, off the board + win-rate). Spam/Unqualified tabs w/ counts + search; spam tab shows a delete-from-CSV note. Reads `/api/crm-proxy/form-submissions?category=`. Linked from Leads board header. | dash-shell.css, dash-page-helpers.js, unqualified-leads.css, unqualified-leads.js | ✅ Active |
| `/dashboards/js/unqualified-leads.js` | Unqualified & Spam controller — session-gated `form-submissions?category=spam\|unqualified` fetch, tab toggle, badge counts, client search; escapes every value | DashPage, crm-proxy forwarder | ✅ Active |
| `/dashboards/css/unqualified-leads.css` | Unqualified & Spam styles (2026 tokens; category tabs + badges, delete note, sticky-header table) | dash-shell.css, art-hub.css | ✅ Active |
| `/tests/ui/test-unqualified-leads.html` | Harness for the Unqualified & Spam page — real controller + CSS over stubbed category fixtures | unqualified-leads.css/js, test-unqualified-leads-stub.js | ✅ Active |
| `/tests/ui/test-unqualified-leads-stub.js` | Fetch-stub fixtures (3 spam + 2 unqualified) for the harness | — | ✅ Active |
| `/dashboards/marketing-shipments.html` | **NEW (2026-07-19)** Marketing-kit fulfillment queue (Mikalah) — Requested/Packed/Shipped tabs over `Marketing_Shipments` via `/api/crm-proxy/marketing-shipments`; per-row recipient/ship-to/contents/AE + lead deep-link, inline "Mark packed"/"Mark shipped" (carrier+tracking) PUTs. **Restricted via `Staff_Page_Access` row (shipping,sales,admin)**. AEs request kits from the lead workspace "Send kit" button. | dash-shell.css, dash-page-helpers.js, leads.css, marketing-shipments.css, marketing-shipments.js | ✅ Active |
| `/dashboards/js/marketing-shipments.js` | Marketing-kit queue controller — session-gated `/api/crm-proxy/marketing-shipments*` list + status/tracking PUTs; parses Items_JSON; escapes every value (recipient/company/notes are lead-sourced) | DashPage, /api/crm-session/me, crm-proxy forwarder | ✅ Active |
| `/dashboards/css/marketing-shipments.css` | Marketing-kit queue styles (2026 tokens; reuses leads.css ld-* atoms; inline ship form, tracking chip) | leads.css, dash-shell.css, art-hub.css | ✅ Active |
| `/dashboards/jim-mailing-list.html` | **NEW (2026-07-21)** Jim's Mailing List — the owner's manual prospect list. Deliberately oversized/plain-language UI (primary user is 83): one always-visible add/edit form + searchable card list w/ big Edit/Delete. Reads+writes `/api/crm-proxy/jim-mailing-list*` (session-gated forwarder → secret-only proxy `Prospect_Mailing_List`). Standalone — NOT the Leads CRM (no AE routing/Slack/digest). Any logged-in staff (no `Staff_Page_Access` row). Sidebar: top-level after Leads. | dash-shell.css, dash-page-helpers.js, jim-mailing-list.css, jim-mailing-list.js | ✅ Active |
| `/dashboards/js/jim-mailing-list.js` | Jim's Mailing List controller — same-origin `/api/crm-proxy/jim-mailing-list` GET/POST/PUT/DELETE; one form reused for add+edit, native confirm on delete, client-side search, green "saved" toast; escapes every value; errors via DashPage.showError | DashPage, crm-proxy forwarder | ✅ Active |
| `/dashboards/css/jim-mailing-list.css` | Jim's Mailing List styles — senior-friendly (2026 tokens; 19px+ inputs, ≥52px targets, high contrast, single column, `--art-theme` green) | dash-shell.css, art-hub.css | ✅ Active |
| `/tests/ui/test-jim-mailing-list.html` | Harness for Jim's Mailing List — real controller + CSS over an in-memory fetch stub (no SAML/Caspio); exercises add/edit/delete/search | jim-mailing-list.css/js, test-jim-mailing-list-stub.js | ✅ Active |
| `/tests/ui/test-jim-mailing-list-stub.js` | Fetch-stub (3 seed companies + in-memory CRUD) for the harness | — | ✅ Active |
| `/dashboards/seo-strategy.html` | **NEW (2026-07-14)** SEO Strategy — admin-only living reference: two-site lane map (teamnwca product/style/tools vs .net local/education), teamnwca phased plan, Mehar's .net recovery summary, coordination treaty (funnel map, collision protocol, NAP contract), scoreboard + change log. Admin-gated via `Staff_Page_Access` row. Sidebar: Administration. | dash-shell.css, dash-page-helpers.js, seo-strategy.css, seo-strategy.js | ✅ Active |
| `/dashboards/js/seo-strategy.js` | SEO Strategy controller — sticky-TOC smooth scroll + scroll-spy (static reference page, no API calls) | DashPage, APP_CONFIG | ✅ Active |
| `/dashboards/css/seo-strategy.css` | SEO Strategy page styles (2026 tokens; lane badges, status chips, phase blocks, callouts, sticky TOC, print rules) | dash-shell.css, art-hub.css | ✅ Active |
| `/dashboards/forms-library.html` | **NEW (2026-07-10)** Forms Library — central staff page for printable/fillable company forms, grouped by category. Driven by Caspio `Forms_Library` table via proxy `GET /api/forms-library` (Erik adds a row → form appears, no deploy). Each form: Download/Print PDF + optional Fill Out Online link. Sidebar 📄 Forms section (with the Inbox). | dash-shell.css, dash-page-helpers.js, forms-library.css, forms-library.js | ✅ Active |
| `/dashboards/form-submissions.html` | **NEW (2026-07-11)** Forms Inbox — saved fillable-form submissions (Caspio `Form_Submissions` + `Sample_Checkout_Items` via session-gated `/api/crm-proxy/form-submissions*`): stat strip, form/status/search filters, detail modal (status moves, print, sample check-ins, artwork "Create Art Request" push into Art Hub), Samples Tracker tab (item-level open checkouts, overdue-first, Mark Returned/Charged with parent-status rollup). | dash-shell.css, dash-page-helpers.js, form-submissions.css/js | ✅ Active |
| `/dashboards/js/form-submissions.js` | Forms Inbox controller — same-origin crm-proxy fetches (PII airtight path), stats, filters, self-describing-payload detail render, item check-in + rollup, art-hub push (POST /api/artrequests + Art_Request_ID write-back) | DashPage, /api/crm-session/me, /api/crm-proxy/form-submissions* | ✅ Active |
| `/dashboards/css/form-submissions.css` | Forms Inbox styles (2026 tokens; form badges, status chips, samples tracker groups, [hidden] modal fix, print-the-modal rules) | dash-shell.css, art-hub.css | ✅ Active |
| `/tests/ui/test-leads.html` | **NEW (2026-07-18)** Leads CRM UI harness — real controller + real CSS over stubbed fetch fixtures (no SAML/Caspio); exercises stats/filters/drawer/status+rep saves/customer match (found + prospect)/order history | leads.css/js, test-leads-stub.js, test-harness-ribbon.css | ✅ Active |
| `/tests/ui/test-leads-stub.js` | Fetch-stub fixtures for the Leads harness (6 leads across all 4 sources incl. an Archived backfill row; contact match hit + 404; order rows; PUTs mutate state) | — | ✅ Active |
| `/tests/ui/test-harness-ribbon.css` | Shared "stubbed harness" warning ribbon for tests/ui pages | — | ✅ Active |
| `/tests/ui/test-form-submissions.html` | Forms Inbox UI harness — real controller + real CSS over stubbed fetch fixtures (no SAML needed); exercises stats/filters/detail/art-push/check-in-rollup | form-submissions.css/js, test-form-submissions-stub.js | ✅ Active |
| `/tests/ui/test-form-submissions-stub.js` | Fetch-stub fixtures for the Inbox harness (in-memory submissions/items; PUTs mutate state so flows click through) | — | ✅ Active |
| `/forms/box-label.pdf` | **NEW (2026-07-11)** Box Label 8.5×11 (natively fillable PDF, 73 fields) — taped to the front of a finished shirt box; fillable twin = /pages/forms/box-label-form.html | listed in Caspio Forms_Library | ✅ Active |
| `/forms/final-qc-checklist.pdf` · `/forms/spoilage-damage-reprint-report.pdf` | **NEW (2026-07-11)** Ops batch: Final QC Checklist (85 AcroForm fields) + Spoilage/Damage & Reprint Report (86) — natively fillable; twins = qc-checklist-form.html / spoilage-report-form.html | listed in Caspio Forms_Library (Quality Control) | ✅ Active |
| `/forms/{embroidery,kornit-dtg,heat-press,laser,roland,compressor-support}-maintenance-log.pdf` | **NEW (2026-07-11)** Six equipment maintenance logs (55 AcroForm fields each, identical skeleton) — natively fillable; shared twin = maintenance-log-form.html?type=… | listed in Caspio Forms_Library (Equipment Maintenance) | ✅ Active |
| `/forms/operations-forms-complete-packet.pdf` | **NEW (2026-07-11)** All 8 ops forms as one 8-page fillable packet (501 fields) — for printing the full set; not in the registry (individual forms are) | — | ✅ Active |
| `/dashboards/js/forms-library.js` | Forms Library controller — fetch /api/forms-library, group by Category, render Download/Fill actions; escapes API text, refuses non-http(s)/relative URLs | DashPage, APP_CONFIG | ✅ Active |
| `/dashboards/css/forms-library.css` | Forms Library page styles (2026 tokens) | dash-shell.css, art-hub.css | ✅ Active |
| `/forms/customer-garment-drop-off-form.pdf` | **NEW (2026-07-10)** Customer Garment Drop-Off Form (blank printable) — customer-supplied garment intake: contact info, decoration checklist, size grid, liability waiver | listed in Caspio Forms_Library; fillable twin = /pages/forms/garment-drop-off-form.html | ✅ Active |
| `/forms/Customer-Supplied-Garments-Acknowledgment.pdf` | Customer-supplied garments liability acknowledgment (signed waiver PDF) | listed in Caspio Forms_Library | ✅ Active |
| `/dashboards/policy-migration.html` | **NEW (2026-07-10)** Policy Migration tracker — SweetProcess→Policies Hub project status: hub-live count, Erik question queue, wave log, per-document tier/status table with hub deep-links. Read-only snapshot; confidential HR rows excluded from data. | dash-shell.css, dash-page-helpers.js, policy-migration.css, policy-migration.js, policy-migration-data.json | ✅ Active |
| `/dashboards/js/policy-migration.js` | Policy Migration controller — stats, questions, wave log, tier-filtered document table | DashPage, fetch-timeout, policy-migration-data.json | ✅ Active |
| `/dashboards/css/policy-migration.css` | Policy Migration page styles (2026 tokens) | dash-shell.css, art-hub.css | ✅ Active |
| `/dashboards/policy-migration-data.json` | Policy Migration data snapshot (regenerated by Claude each work session; no confidential titles) | — | ✅ Active |
| `/dashboards/product-manager.html` | **NEW (2026-07-06)** Rep-facing non-SanMar Product Manager — add/edit products (COST in, never sell price; margin machinery prices them like SanMar goods; FixedPrice mode for specials), image upload to Caspio CDN, live-in-catalog toggle. Active rows merge into /api/products/search (proxy). | dash-shell.css, dash-page-helpers.js, product-manager.css, product-manager.js | ✅ Active |
| `/dashboards/js/product-manager.js` | Product Manager controller — list/filter/stats, add-edit form, /api/files/upload image flow, POST/PUT /api/non-sanmar-products | DashPage, APP_CONFIG | ✅ Active |
| `/dashboards/css/product-manager.css` | Product Manager page styles (2026 tokens) | dash-shell.css, art-hub.css | ✅ Active |
| `/dashboards/portal-directory.html` | Customer portal directory — index of customer portals | portal-directory.js, portal-directory.css | ✅ Active |
| `/dashboards/js/portal-directory.js` | Portal directory controller — customer list, search | /api/customers | ✅ Active |
| `/dashboards/css/portal-directory.css` | Portal directory styles | — | ✅ Active |
| `/dashboards/supacolor-orders.html` | Supacolor orders dashboard — local mirror of Supacolor jobs | supacolor-orders.js, supacolor-orders.css, kanban.css | ✅ Active |
| `/dashboards/js/supacolor-orders.js` | Supacolor orders controller — sync trigger, kanban view, filters | /api/supacolor-jobs | ✅ Active |
| `/dashboards/css/supacolor-orders.css` | Supacolor orders dashboard styles | kanban.css | ✅ Active |
| `/dashboards/roland-printer-supplies.html` | Roland Printer Supplies — JotForm supply-order embed (ink/parts/consumables) for Steve & Brian + printable PDF download (added 2026-06-02, dash-shell canonical) | dash-shell.css, art-hub.css, roland-printer-supplies.css, JotForm 261515595979071 | ✅ Active |
| `/dashboards/css/roland-printer-supplies.css` | Roland Printer Supplies page-specific styles | dash-shell.css, art-hub.css | ✅ Active |
| `/forms/NWCA_LG540_Order_Form_1page.pdf` | Roland printer printable supply-order form (1-page; downloaded from roland-printer-supplies.html) | — | ✅ Active |
| `/dashboards/caspio-api-reference.html` | **NEW (2026-07-09)** Caspio REST API **v4** platform reference viewer — full 107-endpoint catalog + querying/bulk/auth/webhook guidance, live filter. **ERIK-ONLY** (email-gated route in server.js `requireCrmEmail`; admin-override does NOT apply). Static — no API calls. Mirrors `memory/CASPIO_REST_API_V4_REFERENCE.md`. | dash-shell.css, art-hub.css, caspio-api-reference.css, caspio-api-reference.js | ✅ Active |
| `/dashboards/css/caspio-api-reference.css` | Caspio API reference page styles (2026 tokens; HTTP verbs → --state-* colors) | dash-shell.css, art-hub.css | ✅ Active |
| `/dashboards/js/caspio-api-reference.js` | Caspio API reference controller — renders the v4 endpoint catalog from a static snapshot + live filter/highlight + smooth-scroll nav (no API calls) | APP_CONFIG | ✅ Active |
| `/dashboards/table-usage-audit.html` | **NEW (2026-07-10)** Caspio Table Audit cleanup tool — all 163 tables + usage signals (code/view/rel/task/webhook) so admin can find + archive stale tables. **ADMIN-only** (`requireCrmRole(['admin'])` route in server.js). ⚠️ does NOT detect DataPage/Flex usage. | dash-shell.css, art-hub.css, dash-page-helpers.js, table-usage-audit.css, table-usage-audit.js | ✅ Active |
| `/dashboards/css/table-usage-audit.css` | Table-audit page styles (2026 tokens; usage/tier chips → --state-* colors) | dash-shell.css, art-hub.css | ✅ Active |
| `/dashboards/js/table-usage-audit.js` | Table-audit controller — static 163-table snapshot + filter/sort/search, per-table review (localStorage), live-existence check via `/api/caspio-schema/tables`, CSV export | DashPage, APP_CONFIG | ✅ Active |
| `/dashboards/manageorders-api-reference.html` | **NEW (2026-07-10)** ManageOrders / OnSite External API field cheat sheet — all push/pull endpoints + every ExternalOrderJson field (from public Swagger + tested gotchas), live filter. **ADMIN-only** (`requireCrmRole(['admin'])`). Canonical deep doc = `memory/MANAGEORDERS_COMPLETE_REFERENCE.md`. | dash-shell.css, art-hub.css, manageorders-api-reference.css, manageorders-api-reference.js | ✅ Active |
| `/dashboards/css/manageorders-api-reference.css` | ManageOrders cheat-sheet styles (2026 tokens; HTTP verbs → --state-*) | dash-shell.css, art-hub.css | ✅ Active |
| `/dashboards/js/manageorders-api-reference.js` | ManageOrders cheat-sheet controller — renders endpoints + 12 field models from an embedded snapshot + live filter/highlight (no API calls) | — | ✅ Active |
| `/dashboards/sanmar-api-reference.html` | **NEW (2026-07-10)** SanMar Web Services (SOAP) cheat sheet — 12 services/WSDLs, methods + fields + gotchas (catalogColor, 3000 cap, sizeIndex, 301/303), cadence, warehouses, v24.5 MAP/brand restrictions, live filter. **ADMIN-only** (`requireCrmRole(['admin'])`). Canonical = `memory/SANMAR_API_REFERENCE.md`. | dash-shell.css, art-hub.css, sanmar-api-reference.css, sanmar-api-reference.js | ✅ Active |
| `/dashboards/css/sanmar-api-reference.css` | SanMar cheat-sheet styles (2026 tokens) | dash-shell.css, art-hub.css | ✅ Active |
| `/dashboards/js/sanmar-api-reference.js` | SanMar cheat-sheet controller — 14 sections (services/methods/fields/bridge rules) from an embedded snapshot + live filter/highlight (no API calls) | — | ✅ Active |
| `/dashboards/shopworks-odbc-reference.html` | **NEW (2026-07-16)** ShopWorks OnSite ODBC reference — connection card (bandit bridge → 192.168.10.6 Data_ODBCMapping), vendor rules, FileMaker SQL gotchas, gap-fill table, searchable 2,630-field catalog. **ERIK-only** (`requireCrmEmail` route in server.js — page shows credentials). Canonical deep doc = `memory/SHOPWORKS_ODBC_INTEGRATION.md`. | dash-shell.css, art-hub.css, shopworks-odbc-reference.css, shopworks-odbc-reference.js, data/shopworks-odbc-schema.json | ✅ Active |
| `/dashboards/css/shopworks-odbc-reference.css` | ShopWorks ODBC reference styles (2026 tokens; calc/global/summary field badges → --state-*) | dash-shell.css, art-hub.css | ✅ Active |
| `/dashboards/bandit-integration.html` | **NEW (2026-07-18)** Bandit integration reference — data-flow (bandit→proxy→Caspio/Box), live scheduled-task table, sync mechanics (ODBC read→clean→POST), thumbnails→Box, connect/troubleshoot, the per-second-rate-limit rule. Admin doc; static (no JS). Deep detail = `memory/SHOPWORKS_ODBC_INTEGRATION.md` | dash-shell.css, art-hub.css, bandit-integration.css | ✅ Active |
| `/dashboards/css/bandit-integration.css` | Bandit integration page styles (2026 tokens; flow strip, task table, status pills) | dash-shell.css, art-hub.css | ✅ Active |
| `/dashboards/sanmar-ftp-integration.html` | **NEW (2026-07-22)** SanMar Downloads — admin page that lists SanMar's FTP data files and streams the chosen one to the browser (replaces manual FileZilla). Primary = `SanMarPI-Bulk-*.csv` → import into `Sanmar_Bulk_251816_Feb2024` (the master every quote builder prices from). Backed by `/api/staff/sanmar-ftp/{list,download}` in server.js (basic-ftp, admin-gated). Needs `SANMAR_FTP_PASSWORD` config var. Deep detail = `memory/SANMAR_FTP_INTEGRATION.md` | dash-shell.css, art-hub.css, sanmar-ftp-integration.css, sanmar-ftp-integration.js | ✅ Active |
| `/dashboards/css/sanmar-ftp-integration.css` | SanMar Downloads page styles (2026 tokens; file table, flow strip, callouts, download buttons) | dash-shell.css, art-hub.css | ✅ Active |
| `/dashboards/js/sanmar-ftp-integration.js` | SanMar Downloads controller — fetches `/api/staff/sanmar-ftp/list`, renders the file table (pins the pricing master, human size/date/kind), builds per-file Download links to `/api/staff/sanmar-ftp/download`; handles not-configured/ftp-error/401 states | fetch (same-origin admin API) | ✅ Active |
| `/dashboards/sanmar-shopworks-converter.html` | **NEW (2026-07-23)** Admin tool — upload a SanMar price list, convert (100% in-browser, no upload) to a ShopWorks Parts import CSV. Auto-detects the ShopWorks Integration list (fixup: add sizes to descriptions, `_2XL`→`_2X`) vs a raw SanMar feed (full conversion). Route `requireCrmRole(['admin'])` in server.js. Detail = `memory/SANMAR_SHOPWORKS_PARTS.md` | sanmar-shopworks-converter.css/.js, sanmar-shopworks-parts.js, sku-validation-service.js, vendor/papaparse.min.js, vendor/xlsx.full.min.js | ✅ Active |
| `/dashboards/css/sanmar-shopworks-converter.css` | SanMar→ShopWorks converter page styles (2026 tokens; file picker, stats, preview table) | dash-shell.css, art-hub.css | ✅ Active |
| `/dashboards/js/sanmar-shopworks-parts.js` | Pure transform (unit-tested, node+browser): `detectFormat`, `fixupRow(s)`, `fullConvertRows`/`RawAccumulator`, `limits`, `toCsv`. Fixup rules verified vs existing parts; full path reuses `sanmarToShopWorksSKU` | sku-validation-service.js (full path) | ✅ Active |
| `/dashboards/js/sanmar-shopworks-converter.js` | Converter page controller — file input, PapaParse (CSV stream) / SheetJS (XLSX), calls the transform, preview + Download CSV | sanmar-shopworks-parts.js, Papa, XLSX | ✅ Active |
| `/dashboards/js/vendor/papaparse.min.js` | Vendored PapaParse (client-side CSV streaming) for the SanMar→ShopWorks converter | — | ✅ Active |
| `/dashboards/js/vendor/xlsx.full.min.js` | Vendored SheetJS (client-side XLSX read) for the SanMar→ShopWorks converter | — | ✅ Active |
| `/dashboards/js/shopworks-odbc-reference.js` | ShopWorks ODBC reference controller — fetches the schema JSON, renders 16 collapsible tables + live filter/highlight, stored-only toggle, curated gotcha notes, auto kind-badges for calc/global/summary prefixes | fetch (static JSON), DashPage (errors) | ✅ Active |
| `/dashboards/data/shopworks-odbc-schema.json` | Static schema snapshot — 2,630 fields/16 tables pulled live from FileMaker_Fields 2026-07-16. Regenerate from `memory/shopworks-odbc-schema-catalog.txt` if ShopWorks extends Data_ODBCMapping. | — | ✅ Active |

### Staff Dashboards
| File | Purpose | Dependencies | Status |
|------|---------|--------------|--------|
| `/staff-dashboard-v3/index.html` | **CANONICAL (V3 sole survivor, 2026-05-28)** Main staff dashboard served at `/staff-dashboard.html`. Uses @layer CSS (tokens → base → components → utilities → overrides) + unlayered theme. v2 and v1 files deleted; their URLs 301-redirect to canonical. Recovery: `git show v2026.05.27.5:staff-dashboard.html`. | staff-dashboard/{tokens,base,components,utilities,dashboard-v3-theme,dashboard-v3-patch-2}.css, staff-dashboard-v3/{config,caspio-isolation}.js + modular controllers under shared_components/js/staff-dashboard/ | ✅ Active |
| `/dashboards/ae-dashboard.html` | AE dashboard | Multiple | ✅ Active |
| `/dashboards/art-hub-dashboard.html` | ~~DELETED~~ Coordinator redirect (removed 2026-03-15) | — | ❌ Deleted |
| `/dashboards/art-invoices-dashboard.html` | Art invoices | art-invoice-* files | ✅ Active |
| `/dashboards/commission-structure.html` | Online store commission structure reference | commission-structure.css | ✅ Active |
| `/dashboards/css/commission-structure.css` | Commission dashboard styles | - | ✅ Active |
| `/dashboards/access-admin.html` | **NEW (2026-06-30)** Erik-only RBAC control panel — manage staff roles (`Staff_App_Roles`) + page access (`Staff_Page_Access`). Code-gated `requireCrmRole(['admin'])`. | access-admin.js, access-admin.css, `/api/crm-proxy/admin-rbac/*` | ✅ Active |
| `/dashboards/js/access-admin.js` | Access-Admin controller — roles + page-access CRUD via admin-gated crm-proxy | /api/crm-proxy/admin-rbac | ✅ Active |
| `/dashboards/css/access-admin.css` | Access-Admin panel styles (NWCA green, no inline) | - | ✅ Active |
| `/dashboards/customer-portal-admin.html` | **NEW (2026-06-30)** Customer Portals admin console — list/add/enable-disable/delete portal invites (`Customer_Portal_Access`), send magic-link login emails, preview a customer's portal. Role-gated `requireCrmRole(['admin','accountant','art','sales','taneisha','nika'])`. | dash-shell.css, dash-page-helpers.js, customer-portal-admin.css/js, `/api/crm-proxy/customer-portal-access/*`, `/api/portal-admin/*` | ✅ Active |
| `/dashboards/js/customer-portal-admin.js` | Customer Portals console controller (CRUD + CRM lookup + send-link + preview) | DashPage, same-origin `/api/crm-proxy/*` + `/api/portal-admin/*` | ✅ Active |
| `/dashboards/finished-photos.html` | Factory finished-product photo capture + manage (mobile-first, iPad/phones). **2026-07-17 v2:** NWCA-logo top bar, 3 find modes (barcode Scan / Order # / company Search) resolving via work-order barcodes, design auto-select from design-sheet scans, client-side photo compression, caption chips, publish list w/ lightbox. SAML-gated (any staff). | finished-photos.js/css, vendor/html5-qrcode.min.js, proxy `/api/finished-photos` (open POST) + same-origin `/api/staff/finished-photos` (GET/lookup/PATCH/DELETE forwarders), `/api/company-contacts/search`, `/api/designs/by-customer` | ✅ Active |
| `/dashboards/js/finished-photos.js` | Finished-photos capture controller (find modes + barcode scanner + order/design lookup, design picker, photo compression ≤2000px JPEG, upload, publish/delete manage, lightbox) | APP_CONFIG, vendor/html5-qrcode.min.js, proxy `/api/finished-photos`, `/api/staff/finished-photos/*` | ✅ Active |
| `/dashboards/js/vendor/html5-qrcode.min.js` | **NEW (2026-07-17)** Vendored html5-qrcode v2.3.8 (MIT, ZXing-based) — Code 39/128 + QR camera scanning on iOS Safari for the finished-photos work-order scanner. Copied from npm `html5-qrcode` (also in package.json). | - | ✅ Active |
| `/dashboards/finished-photos.webmanifest` | **NEW (2026-07-17)** Web-app manifest for the capture page — makes Add-to-Home-Screen install as a standalone app ("Finished Photos", portrait, green theme). | images/fp-icon-192/512.png | ✅ Active |
| `/dashboards/images/fp-icon-{180,192,512}.png` | **NEW (2026-07-17)** Home-screen app icons for the capture page (NWCA logo on white, green base band; 180 = apple-touch-icon). Generated from the Caspio CDN logo. | - | ✅ Active |
| `/dashboards/css/finished-photos.css` | Finished-photos capture page + wall-poster styles (NWCA green, mobile-first, segmented modes, scanner sheet, safe-area, print `@media`, no inline) | - | ✅ Active |
| `/dashboards/finished-photos-poster.html` | Printable QR wall poster → the capture page. Static inline SVG QR (no runtime lib). Print for factory wall / staff desks. (No longer linked from the capture page header — 2026-07-17.) | finished-photos.css, finished-photos-poster.js | ✅ Active |
| `/dashboards/js/finished-photos-poster.js` | Wall-poster Print button handler (window.print) | - | ✅ Active |
| `/dashboards/finished-photos-library.html` | **NEW (2026-07-19)** Finished Photos Library — company-wide browse of every finished-product photo, grouped by account with the account's sales rep badge; rep filter chips + search + published/hidden filter + inline Publish/Hide + lightbox. Deep link `#rep=<full name>` (Mission Control "My Finished Photos"). SAML-gated (any staff). | dash-shell.css, dash-page-helpers.js, finished-photos-library.css/js, same-origin `/api/staff/finished-photos/library` + PATCH forwarder | ✅ Active |
| `/dashboards/js/finished-photos-library.js` | Finished Photos Library controller (one library fetch, client-side rep/search/visibility filters, account grouping, publish toggle, hash deep-link) | DashPage, `/api/staff/finished-photos/library`, `/api/staff/finished-photos/:pk` PATCH | ✅ Active |
| `/dashboards/css/finished-photos-library.css` | Finished Photos Library page styles (rep chips, account sections, photo grid, lightbox — tokens only) | dash-shell.css, art-hub.css | ✅ Active |
| `/dashboards/css/customer-portal-admin.css` | Customer Portals console page styles (table, modal, badges) | dash-shell.css, art-hub.css tokens | ✅ Active |
| `/dashboards/taneisha-crm.html` | Taneisha's Account CRM dashboard | rep-crm.js, rep-crm.css | ✅ Active |
| `/dashboards/nika-crm.html` | **NEW** Nika's Account CRM dashboard | rep-crm.js, rep-crm.css | ✅ Active |
| `/dashboards/css/rep-crm.css` | **SHARED** CRM dashboard styles (used by both reps) | - | ✅ Active |
| `/dashboards/js/rep-crm.js` | **SHARED** CRM service/controller (config-driven) | APP_CONFIG, REP_CONFIG | ✅ Active |
| `/dashboards/js/rep-calendar.js` | **SHARED** Calendar logic (config-driven) | APP_CONFIG, REP_CONFIG | ✅ Active |
| `/dashboards/house-accounts.html` | **NEW** House Account assignment dashboard | house-accounts.js, house-accounts.css | ✅ Active |
| `/dashboards/css/house-accounts.css` | **NEW** House Accounts dashboard styles | - | ✅ Active |
| `/dashboards/js/house-accounts.js` | **NEW** House Accounts service/controller | APP_CONFIG | ✅ Active |
| `/dashboards/monogram-dashboard.html` | Monogram orders dashboard | monogram-dashboard.css, monogram-dashboard.js | ✅ Active |
| `/dashboards/css/monogram-dashboard.css` | Monogram dashboard styles (NWCA green theme) | CSS variables | ✅ Active |
| `/dashboards/names-numbers-dashboard.html` | Names & Numbers roster dashboard | names-numbers-dashboard.js, names-numbers.css | ✅ Active |
| `/pages/names-numbers.html` | Names & Numbers roster form (team names, numbers, sizes) | names-numbers-controller.js, names-numbers-service.js | ✅ Active |
| `/shared_components/js/names-numbers-controller.js` | Roster form UI controller (tabs, groups, table, OCR, import) | names-numbers-service.js | ✅ Active |
| `/shared_components/js/names-numbers-service.js` | Roster API service (CRUD, Excel parse, OCR) | APP_CONFIG | ✅ Active |
| `/shared_components/js/names-numbers-dashboard.js` | Roster dashboard logic (search, filter, KPIs) | names-numbers-service.js | ✅ Active |
| `/shared_components/css/names-numbers.css` | Names & Numbers shared styles (blue theme) | CSS variables | ✅ Active |
| `/dashboards/staff-login.html` | Staff authentication login page | — | ✅ Active |
| `/dashboards/staff-portal-simple.html` | Simplified staff portal | — | ✅ Active |
| `/dashboards/staff-portal-final.html` | Final staff portal layout | — | ✅ Active |
| `/dashboards/quote-management.html` | Quote management dashboard (search, edit, manage quotes) | quote-management.css, js/quote-management.js | ✅ Active |
| `/dashboards/js/quote-management.js` | Quote management page logic (extracted from inline `<script>` 2026-07-05 — Rule 3) | APP_CONFIG, staff-auth-helper, caspio-date-utils | ✅ Active |
| `/dashboards/css/quote-management.css` | Quote management dashboard styles | — | ✅ Active |
| `/dashboards/js/sanmar-inbound-today.js` | "SanMar Inbound Calendar" modal — pick any day → that day's POs (PO+WO, line items w/ color/size, per-box contents, logos), box labels + PDF; month-calendar picker | APP_CONFIG, /api/sanmar-orders/inbound-today + /daily-inbound (proxy) | ✅ Active |
| `/dashboards/digitized-designs.html` | Digitized designs management dashboard | — | ✅ Active |
| `/dashboards/old-designs.html` | Old designs archive search (Caspio embed) | old-designs.css, old-designs.js | ✅ Active |
| `/dashboards/art-invoice-view.html` | Art invoice detail view page | — | ✅ Active |
| `/dashboards/bundle-orders-dashboard.html` | Bundle orders management dashboard | bundle-orders.js | ✅ Active |
| `/dashboards/bundle-orders.js` | Bundle orders dashboard logic | — | ✅ Active |
| `/dashboards/art-hub-coordinator.html` | ~~DELETED~~ Coordinator workflow (removed 2026-03-15) | — | ❌ Deleted |
| `/dashboards/art-hub-ruth.html` | Art hub — Ruth's personalized view | — | ✅ Active |
| `/dashboards/art-hub-steve.html` | Art hub — Steve's personalized view | art-hub.css, art-hub-steve.js | ✅ Active |
| `/dashboards/bradley-transfers.html` | **NEW** Bradley's Supacolor transfer queue (heat-transfer orders to subcontractor) | bradley-transfers.js, bradley-transfers.css, art-hub.css, caspio-pricing-proxy /api/transfer-orders | ✅ Active |
| `/dashboards/production-shifts.html` | **NEW** Production team daily shift schedule + WA labor rules (clock-in/out, breaks, lunch) | production-shifts/{styles.css, app.jsx, data.js}, React 18 + Babel CDN | ✅ Active |
| `/dashboards/production-shifts/styles.css` | **NEW** Production Shifts page styles (Geist font, timeline, table, work-rules cards) | — | ✅ Active |
| `/dashboards/production-shifts/app.jsx` | **NEW** Production Shifts React app (Header, DaySummary, MasterTable, Timeline, WorkRules, LaborRules) | data.js (window.NWCA_SCHEDULE + NWCA_HELPERS) | ✅ Active |
| `/dashboards/production-shifts/data.js` | **NEW** Production Shifts employee data + time helpers (window.NWCA_SCHEDULE, NWCA_HELPERS) | — | ✅ Active |
| `/forms/NWCA-Meal-Period-Waiver.pdf` | **NEW** Voluntary Meal Period Waiver — employees download, fill out, return to Bradley Wright | served via `/forms` static route, linked from production-shifts dashboard | ✅ Active |
| `/forms/policies/*` (9 files) | **NEW** SweetProcess-migrated policy attachments — screen-print & Shopify workflow diagrams, Providing Good Artwork guide, Polycom + SoundPoint IP 650 phone manuals, DTG ops manual + ink order form, credit-card auth form, new-clerk receiving checklist | served via `/forms` static route; embedded/linked from Policies Hub policies (Caspio) | ✅ Active |
| `/dashboards/js/bradley-transfers.js` | **NEW** Transfer queue controller — poll API, filter/sort, create transfer modal | /api/transfer-orders, /api/transfer-orders/stats | ✅ Active |
| `/dashboards/css/bradley-transfers.css` | **NEW** Transfer queue styles (navy theme, rush pulse, status chips, modal) | — | ✅ Active |
| `/pages/transfer-detail.html` | **NEW** Single-transfer detail page with status transition buttons (Mark Ordered / Add PO / Ship / Receive / Cancel / Rush) + activity timeline | transfer-detail.js, transfer-detail.css, bradley-transfers.css, /api/transfer-orders/:id | ✅ Active |
| `/pages/js/transfer-detail.js` | **NEW** Transfer detail controller — fetches record + notes, status machine, 6 modals, localStorage-based user identity | /api/transfer-orders/:id (+ /status, /rush, /notes) | ✅ Active |
| `/pages/css/transfer-detail.css` | **NEW** Transfer detail page styles (header card, 2-col grid, timeline, action buttons) | — | ✅ Active |
| `/shared_components/js/transfer-actions-shared.js` | **NEW** Box file picker modal + `window.TransferActions.openSendModal()` — shared by mockup-detail, art-request-detail, Steve's dashboard | /api/box/folder-files, /api/box/shared-link, /api/transfer-orders, transfer-actions.css | ✅ Active |
| `/shared_components/css/transfer-actions.css` | **NEW** Self-contained modal styling for Send to Supacolor picker (navy theme, toasts) | — | ✅ Active |
| `/dashboards/js/steve-send-supacolor.js` | **NEW** Steve's dashboard header button handler — prompts for design #, looks up ArtRequest, opens shared modal | transfer-actions-shared.js, /api/artrequests | ✅ Active |
| `/dashboards/bradley-screenprint.html` | **NEW** Bradley's screen-print queue (Method='Screen Print' transfers to L&P Printing — no upstream API) | bradley-screenprint.js, bradley-transfers.css (shared), art-hub.css, /api/transfer-orders?method=Screen%20Print | ✅ Active |
| `/dashboards/js/bradley-screenprint.js` | **NEW** Screen-print queue controller — mirrors bradley-transfers.js, strips Supacolor-only chrome (auto-link, stale-link, job navigation) | /api/transfer-orders?method=Screen%20Print | ✅ Active |
| `/dashboards/js/steve-send-screenprint.js` | **NEW** Steve's "Send to Screen Print" button handler — opens shared modal in `method:'Screen Print'` mode (L&P Printing vendor) | transfer-actions-shared.js | ✅ Active |
| `/shared_components/css/art-hub.css` | **NEW** Shared art hub dashboard styles (CSS custom props for theming) | — | ✅ Active |
| `/shared_components/js/art-actions-shared.js` | **NEW** Shared art action modals (Log Time, Mark Complete, Send Mockup) — used by art-hub-steve.js + art-request-detail.js | art-hub.css, caspio-proxy API, EmailJS | ✅ Active |
| `/shared_components/js/art-hub-steve.js` | Steve's gallery card processing + notes panel — delegates modals to art-actions-shared.js | art-hub.css, art-actions-shared.js, caspio-proxy API | ✅ Active |
| `/shared_components/js/art-hub-ae.js` | AE gallery card processing (maroon theme, View Details only) | art-hub.css, ae-dashboard.html | ✅ Active |
| `/shared_components/js/art-ae.js` | AE Steve Mockups tab — API-driven art request gallery (replaces Caspio DataPage) | art-hub.css, ae-dashboard.html | ✅ Active |
| `/shared_components/js/ae-dashboard.js` | **NEW** AE dashboard: tab switching, modals, dropdown, notification polling + toasts | ae-dashboard.html | ✅ Active |
| `/dashboards/css/taneisha-crm.css` | ⚠️ DEPRECATED - use rep-crm.css | - | ⚠️ Legacy |
| `/dashboards/js/taneisha-crm.js` | ⚠️ DEPRECATED - use rep-crm.js | - | ⚠️ Legacy |

### Staff Dashboard Legacy JS (still loaded by V3 as bridge globals)
| File | Purpose | Status |
|------|---------|--------|
| `/shared_components/js/staff-dashboard-service.js` | ShopWorks ManageOrders API integration; V3 garment-tracker controller bridges to its `window.StaffDashboardService.*` globals | ✅ Active |
| `/shared_components/js/staff-dashboard-announcements.js` | Priority announcements with dismiss | ✅ Active |
| `/shared_components/js/staff-dashboard-init.js` | Initialization, widget toggles, auto-refresh | ✅ Active |
| `/shared_components/js/production-schedule-stats.js` | Precomputed turnaround stats from 819 records | ✅ Active |
| `/shared_components/js/production-schedule-predictor.js` | Prediction engine for turnaround times | ✅ Active |

### Staff Dashboard V3 Refactor (in development on `refactor/staff-dashboard-v3` branch — 2026-05-12)
Polish + code-quality pass. Plan: `~/.claude/plans/this-is-a-big-parsed-unicorn.md`. Built in parallel at `/staff-dashboard-v3/`; cuts over once 90-day soak passes. v2 will move to `/staff-dashboard-v2.html` at cutover.
| File | Purpose | Dependencies | Status |
|------|---------|--------------|--------|
| `/shared_components/css/staff-dashboard/tokens.css` | **NEW (v3)** Design tokens — oklch + NW green, space/motion/z-index/font-size/focus-ring scales, semantic alias layer. Wrapped in `@layer tokens`. | — | 🚧 In dev |
| `/shared_components/css/staff-dashboard/phase1-widgets.css` | **Phase 1 widgets (2026-07-20)** Win Bell (`.wb-`, incl. subtotal/rep/prefix chips) · Pride Wall (`.pw-`) · My Stuff (`.ms-`) · **2026 Goal chip** (`.goal-chip`, header-scoped to out-specify the big `.sales-goal-banner` rules; keeps #goal* IDs + is-loading so sales-goal-controller drives it unchanged). Loaded UNLAYERED after dashboard-v3-theme.css; all values from tokens. Reduced-motion + responsive. | tokens.css | ✅ Active |
| `/shared_components/css/staff-dashboard/command-palette.css` | **Phase 2 (2026-07-20; re-anchored same day)** Hero search bar (`.hero-search__*`, 52px, focus-within accent ring) + anchored results panel (`.cp-panel` absolute under the bar, drops downward) + grouped results/status + fixed bottom-center copy toast. Unlayered, token-driven. | tokens.css | ✅ Active |
| `/shared_components/js/staff-dashboard/core/dashboard-endpoints.js` | **NEW (v3)** Endpoint registry — single source of truth for every URL the dashboard hits. Reads BASE from `window.APP_CONFIG.API.BASE_URL` (Rule #7). | window.APP_CONFIG | 🚧 In dev |
| `/shared_components/js/staff-dashboard/core/dashboard-fetch.js` | **NEW (v3)** Uniform fetch wrapper. Always throws on error (Rule #4 — no silent fallbacks), GET dedup, 30s timeout, 429 jittered retry. Exports `dashboardFetch`, `dashboardFetchJson`, `DashboardApiError`. | — | 🚧 In dev |
| `/shared_components/js/staff-dashboard/core/dashboard-store.js` | **NEW (v3)** Versioned state store — namespaced `nwca-dash:*` keys, per-key TTL + version stamping, safe corrupt-entry recovery. Replaces 10 scattered localStorage/sessionStorage keys. | — | 🚧 In dev |
| `/shared_components/js/staff-dashboard/core/dashboard-events.js` | **NEW (v3)** Delegated event router — replaces 22+ inline `onclick=` (Rule #3). Markup: `data-action="metrics:refresh"`. Listen: `events.register('metrics:refresh', fn)`. Auto-installs on import. | — | 🚧 In dev |
| `/shared_components/js/staff-dashboard/core/dashboard-errors.js` | **NEW (v3)** Centralized error UI — `showApiError(area, error, { onRetry })` replaces 4 inline error renderers. Retry buttons routed through the event delegator. | dashboard-events.js, dashboard-fetch.js, dashboard-ui-utils.js | 🚧 In dev |
| `/shared_components/js/staff-dashboard/core/dashboard-ui-utils.js` | **NEW (v3)** Shared UI helpers — `escapeHtml`, `formatMoney`, `formatPercent`, `formatRelativeTime`, `daysRemainingInYear`, `sparklineSvg`, `debounce`, etc. Used by every controller. | — | 🚧 In dev |
| `/shared_components/css/staff-dashboard/base.css` | **NEW (v3)** Reset, body, typography, layout shell, sidebar, header. Wrapped in `@layer base`. Includes responsive sidebar overlay for tablet (<1100px) + mobile (<768px). | tokens.css | 🚧 In dev |
| `/shared_components/js/staff-dashboard/widgets/dashboard-modal.js` | **NEW (v3)** `<dashboard-modal>` custom element — owns scroll-lock, focus-trap, escape-to-close, backdrop-click, ARIA dialog. Replaces duplicated logic in staff-directory + gap-report modals. | — | 🚧 In dev |
| `/shared_components/js/staff-dashboard/services/employees-service.js` | **NEW (v3)** Wraps the hardcoded employee roster (data preserved verbatim from staff-dashboard-employees.js per Erik's plan answer #2). Exposes `all()`, `active()`, `upcomingBirthdays(N)`, `upcomingAnniversaries(N)`, `search(q)`. | — | 🚧 In dev |
| `/shared_components/js/staff-dashboard/controllers/sidebar-controller.js` | **NEW (v3)** Sidebar collapse/expand + mobile hamburger overlay. Persists section states via dashboard-store. Replaces inline `toggleSidebarSection` from staff-dashboard.html. | dashboard-events.js, dashboard-store.js | 🚧 In dev |
| `/shared_components/js/staff-dashboard/controllers/orders-inbox-controller.js` | **NEW (2026-07-06)** Orders Inbox + Money Collected + Sample Follow-ups zones (replaced announcements) — quote_sessions last-7-days (paid web orders SAM/CAP/DTG/3DT, Accepted-unpaid, ShopWorks-Failed pinned loudly), Order_Payments totals+recent, sample orders w/o later order = rep call list. Rows link to /quote/{id}. | dashboard-endpoints.js (createdAfter param), dashboard-fetch.js, /api/order-payments/recent, /api/mo/orders | ✅ Active |
| `/shared_components/js/staff-dashboard/controllers/announcements-controller.js` | Announcements zone controller — **DEAD 2026-07-06** (Erik retired announcements; no longer imported by dashboard-app.js). Flag-not-delete per CLAUDE.md dead-code policy. | — | ⚠️ Dead — retired |
| `/shared_components/js/staff-dashboard/controllers/sales-goal-controller.js` | **NEW (v3, Phase 4.1)** Compressed 56px sales-goal pill. Pace badge (+%/− vs expected-today), days-remaining countdown, projected EOY. Reads `ANNUAL_GOAL` from `dashboard-ui-utils`. All client-side math. | dashboard-ui-utils.js | 🚧 In dev |
| `/shared_components/js/staff-dashboard/controllers/celebrations-controller.js` | **NEW (v3, Phase 4.5)** Combined "Team" widget — single dropdown for birthdays + anniversaries (replaces 3 separate pills) + staff-directory modal with live search input. Uses `<dashboard-modal>`. | dashboard-events.js, employees-service.js, dashboard-modal.js | 🚧 In dev |
| `/shared_components/js/staff-dashboard/services/shopworks-service.js` | **NEW (v3)** Wraps ManageOrders endpoints — `loadRevenueWindow(days)`, `loadYearOverYear(days)`, `loadYtdSubset(60)`. Uses `dashboardFetch` (no silent fallbacks). v3 first cut covers revenue + YoY; team-perf hybrid YTD lands in follow-up phase. | dashboard-fetch.js, dashboard-endpoints.js, dashboard-store.js | 🚧 In dev |
| `/shared_components/js/staff-dashboard/controllers/metrics-controller.js` | **NEW (v3, Phase 4.4)** Revenue card with sparkline (220×32 inline SVG), AOV + order count, YoY badge. Reads `defaultRevenuePeriod` from Tweaks. **Does not** touch `#salesTeamList` — that's owned by team-performance-controller. 60-day window deliberately doesn't feed sales-goal banner (Rule #4 — partial-year would skew pace math). | shopworks-service.js, dashboard-errors.js, dashboard-events.js | 🚧 In dev |
| `/shared_components/js/staff-dashboard/controllers/auth-controller.js` | **NEW (v3)** Lifts the inline auth code out of staff-dashboard.html (Rule #3). Polls Caspio `[@authfield:...]` placeholders + listens for `DataPageReady`, applies welcome name, mirrors to legacy sessionStorage keys for back-compat with downstream pages. | dashboard-store.js | 🚧 In dev |
| `/shared_components/js/staff-dashboard/widgets/tweaks-fab.js` | **NEW (v3, Phase 4.7)** Floating settings drawer. Persists via `dashboard-store`. Options: accent (4 hues), density (comfy/compact), default revenue period (7/30/60/90 — NEW), reset to defaults (NEW). Light theme intentionally NOT exposed. Exposes `window.StaffDashboardV3Tweaks`. | dashboard-store.js | 🚧 In dev |
| `/shared_components/js/staff-dashboard/core/dashboard-app.js` | **NEW (v3)** Single ES module entry point. Loaded as `<script type="module">` from `/staff-dashboard-v3/index.html`. Bootstraps tweaks → auth → sidebar → announcements → sales-goal → celebrations → metrics, then sets a 5-min refresh interval. | All controllers + tweaks-fab + dashboard-modal | 🚧 In dev |
| `/shared_components/css/staff-dashboard/components.css` | **NEW (v3)** All reusable components — sales-goal pill (Phase 4.1), announcements, tool categories + buttons, metrics cards (revenue + rep cards + sparkline), Team widget dropdown (Phase 4.5), staff modal (uses `<dashboard-modal>`), production predictor, garment tracker, error banners, skeleton loaders, tweaks FAB + panel. Wrapped in `@layer components`. Uses CSS nesting + container queries. | tokens.css, base.css | 🚧 In dev |
| `/shared_components/css/staff-dashboard/utilities.css` | **NEW (v3)** Single-purpose helpers — `.stack`, `.cluster`, `.text-*`, `.surface-*`, `.visually-hidden`, `.is-hidden`, `.hide-mobile`/`.show-mobile-only`, focus + spacing + width utilities. Wrapped in `@layer utilities` so direct usage beats component defaults. | tokens.css | 🚧 In dev |
| `/staff-dashboard-v3/index.html` | **NEW (v3)** Parallel-build entry point at `/staff-dashboard-v3/`. Will live alongside `/staff-dashboard.html` (v2) for 90-day soak. At cutover, v2 moves to `/staff-dashboard-v2.html` and the canonical route serves v3. **Coming next.** | All v3 CSS + dashboard-app.js | 🚧 In dev |
| `/staff-dashboard-v3/config.js` | **NEW (v3)** Tiny bootstrap that sets `window.APP_CONFIG.API.BASE_URL` to the caspio-pricing-proxy URL. Loaded as a regular `<script>` BEFORE the module entry point so dashboard-endpoints.js can read it. Keeps Rule #3 (no inline JS in HTML) clean. | — | 🚧 In dev |
| `/staff-dashboard-v3/announcements-bootstrap.js` | Announcements data bootstrap — **DEAD 2026-07-06** (announcements retired; script tag + JSON island removed from index.html). | — | ⚠️ Dead — retired |
| `/staff-dashboard-v3/caspio-isolation.js` | **NEW (v3, 2026-05-13)** Tiny non-module `<script>` loaded in `<head>` BEFORE the Caspio auth embed runs. Sets up a `MutationObserver` on `<head>` that disables any `<link rel="stylesheet">` Caspio's embed script injects (semantic.css, responsive576/1024.css, etc). Fixes the "dashboard renders correctly then half-a-second later reverts to dim" bug — Caspio's `semantic.css` was overriding our color palette. Caspio's JS keeps working (still populates `[@authfield:*]` divs for auth-controller). Observer auto-disconnects after 30s. | — | ✅ Active |
| `/shared_components/js/staff-dashboard/controllers/production-controller.js` | **NEW (v3)** Renders the Production Schedule Predictor widget (per-service turnaround days + season badge). Depends on legacy `production-schedule-stats.js` + `production-schedule-predictor.js` loaded as plain `<script>` tags before the v3 module entry. | window.ProductionPredictor (legacy globals) | 🚧 In dev |
| `/shared_components/js/staff-dashboard/services/caspio-archive-service.js` | **NEW (v3)** Reads per-rep YTD totals from the Caspio archive via `/caspio/daily-sales-by-rep/ytd?year=N`. Single source of truth for archived per-rep YTD data. | dashboard-fetch.js, dashboard-endpoints.js, dashboard-store.js | 🚧 In dev |
| `/shared_components/js/staff-dashboard/controllers/team-performance-controller.js` | **NEW (v3)** Renders per-rep YTD revenue cards. v3 first cut: archive-only (covers Jan 1 → ~60 days ago); live top-up + full hybrid logic in follow-up phase. Includes name normalization (Ruth↔Ruthie, House+House-Legacy aggregation). Pushes total YTD to sales-goal banner. | caspio-archive-service.js, sales-goal-controller.js, dashboard-events.js | 🚧 In dev |
| `/shared_components/js/staff-dashboard/controllers/garment-tracker-controller.js` | **NEW (v3)** Renders the Garment Tracker table (per-rep premium item quantities + bonus pace toward $500 goal). **Bridges** to legacy `window.StaffDashboardService.loadGarmentTrackerFromTable/syncGarmentTracker/getGarmentTrackerConfig` (loaded as plain `<script>` from `/shared_components/js/staff-dashboard-service.js`). Full proper port of the 1,500-line legacy sync logic deferred to Phase 2 follow-up. | window.StaffDashboardService (legacy bridge), dashboard-events.js, dashboard-errors.js | 🚧 In dev |
| `/shared_components/js/staff-dashboard/controllers/win-bell-controller.js` | **Phase 1 "alive" layer (2026-07-20)** Win Bell live ticker — polls quote_sessions (5 min, proxy-cache, no `refresh=true` so Caspio usage stays flat), diffs paid storefront orders + Accepted quotes against a localStorage seen-set, celebrates fresh wins with bell-ring + confetti (reduced-motion aware, background-tab-safe removal). Goal 10%-band milestones read from `#goalPercent`. | dashboard-fetch.js, dashboard-endpoints.js, dashboard-ui-utils.js | ✅ Active |
| `/shared_components/js/staff-dashboard/controllers/pride-wall-controller.js` | **Phase 1 "alive" layer (2026-07-20)** Pride Wall — ambient 6-tile strip of finished-product photos from `/api/staff/finished-photos/library` (published first, fallback all), one tile crossfades every 7s (no on-screen duplicates), hourly pool refresh, calm visible error state. | /api/staff/finished-photos/library, dashboard-ui-utils.js | ✅ Active |
| `/shared_components/js/staff-dashboard/controllers/my-stuff-controller.js` | **Phase 1 "personal" layer (2026-07-20)** My Stuff row — per-browser pinned + recent tools (localStorage `nwca-mystuff-v1`), learned from delegated clicks on `.tool-btn`/`.nav-link`; ☆/★ pin toggle via dashboard-events. Purely additive — never hides or moves the tool grid. | dashboard-events.js, dashboard-ui-utils.js | ✅ Active |
| `/shared_components/js/staff-dashboard/controllers/command-palette-controller.js` | **Phase 2 "effortless" layer (2026-07-20; re-anchored to a persistent hero bar same day)** Everything Bar — a PERSISTENT hero search input near the top of the dashboard; focus (or Ctrl+K) opens a results panel that drops DOWNWARD anchored under the bar (never covers the header/goal). Tool registry harvested live from the page DOM (zero-maintenance), debounced backend fan-out via `/api/staff/command-search` (customers→rep CRM, orders→copy #, quotes→`/quote/<ID>`, designs→copy #), keyboard nav, per-source failure notes, plain "lights up after backend deploy" state pre-proxy-deploy. No blur→close (Escape/backdrop/pick only). | dashboard-events.js, dashboard-ui-utils.js, /api/staff/command-search | ✅ Active |

### Dashboard Reports
| File | Purpose | Status |
|------|---------|--------|
| `/dashboards/reports/price-audit-report.html` | **NEW** Price audit report — SW 2025 vs 2026 pricing comparison for rep training (2026-02-15) | ✅ Active |
| `/dashboards/reports/price-audit-report.css` | **NEW** Styles for price audit report page (2026-02-15) | ✅ Active |

### Employee Bundle Pages
| File | Purpose | Dependencies | Status |
|------|---------|--------------|--------|
| `/dashboards/DrainPro-Bundle.html` | Drain-Pro employee bundle labels | Caspio datapage | ✅ Active |
| `/employee-bundles/streich-bros-bundle.html` | Streich Bros employee bundle labels | Caspio datapage | ✅ Active |
| `/employee-bundles/wcttr-bundle.html` | WCTTR (West Coast Truck and Trailer Repair) employee bundle labels | Caspio datapage | ✅ Active |

## 🗑️ Recently Removed (For Reference)

### CRM Role-Based Access Control (2026-01-23)
**Context:** Replaced shared password login with Caspio-based role permissions
- `/pages/crm-login.html` (255 lines) → Deleted (replaced by Caspio auth)
- CRM dashboards now use role-based access via Express session
- **Erik:** Full access (taneisha, nika, house)
- **Taneisha:** Own dashboard only
- **Nika:** Own dashboard only

### Richardson Simplification (2026-01-02)
**Context:** Richardson quote builder simplified to real-time pricing lookup (81% code reduction)
- `richardson-caps-calculator.js` (2,659 lines) → Replaced by `richardson-factory-direct.js` (450 lines)
- `richardson-quote-service.js` (262 lines) → Quote building removed
- `richardson-112-images.js` → 112 is SanMar product, not Factory Direct
- `richardson-color-selector-enhancement.js` → Color picker not needed
- `richardson-color-selector.css` → Color picker styles removed

### Memory System Cleanup (2026-01-08)
**Context:** Cleaned up /memory/ docs to reduce Claude Code context bloat
- `/memory/3-day-tees/DAY-5-MORNING-SUMMARY.md` (413 lines) → Deleted (outdated dev log)
- `/memory/3-day-tees/DAY-5-AFTERNOON-SUMMARY.md` (498 lines) → Deleted (outdated dev log)
- `/memory/3-day-tees/DAY-6-MORNING-SUMMARY.md` (357 lines) → Deleted (outdated dev log)
- `/memory/PRICING_MANUAL_CORE.md` (294 lines) → Deleted (duplicated MANUAL_CALCULATOR_CONCEPTS.md)
- `/memory/INDEX.md` (525 lines → 130 lines) → Trimmed by 75%
- **Total savings:** ~1,957 lines of duplicate/stale content

### Removed During Cleanup (2025-01-27)
- **71 JavaScript files** - Orphaned, unused, or duplicate
- **6 HTML backup files** - Replaced by Git version control
- **Archive folder** - 3.8MB moved to external backup
- **Test files in root** - Moved to `/tests/` folder

### Additional Cleanup (2025-01-27 - Second Pass)
- **8 data/test files from root** - CSV test results, log files
- **5 training folder files** - .bak file, test files, duplicates
- **11 orphaned JS files** - Unused adapters and utilities in shared_components/js/

### Root Directory Organization (2025-01-27 - Third Pass)
**Moved from root to organized folders:**
- **6 data export files** → `/docs/data-exports/` (CSV, JSON, XML exports)
- **2 template files** → `/docs/templates/` (EmailJS and instructions)
- **4 guide documents** → `/docs/guides/` (API, CSS, system docs)
- **4 log/generated files** → `/logs/` (server.log, dependency maps)
- **1 script file** → `/scripts/` (migrate-beta.sh)
- **Total:** 17 files moved from root, reducing clutter by ~25%

### Files Scheduled for Removal
| File | Reason | Remove By | Status |
|------|--------|-----------|--------|
| None currently | - | - | - |

## 📊 Statistics

**As of 2026-04-29 audit (filesystem totals — see header for scope):**
- Active code files: **575** (296 HTML, 269 JS, 195 CSS — `tests/` excluded)
- Per directory:
  - `shared_components/js/`: 146 files (largest single dir)
  - `calculators/` (incl. archive): 84 files
  - `pages/` (incl. js/, css/, services/, utils/; order-form/ removed 2026-07-11): 43 files
  - `shared_components/css/`: 61 files
  - `dashboards/` (incl. js/, css/, reports/): 39 files
  - `training/`: 44 files (+ `images/sanmar-purchasing/`, 8 screenshots)
  - Root (HTML/JS/CSS only): 34 files
  - `product/` (incl. components/, services/, styles/, js/): 20 files
  - `scripts/` (incl. safety-tools/): 20 files
  - `mockups/`: 11 files
  - `policies/`: 8 files
  - `email-templates/`: 7 files
  - `quote-builders/`: 6 files
  - `tools/`, `templates/`: 5 each
  - `admin/`, `art-tools/`, `vendor-portals/`: 3-4 each
  - `employee-bundles/`, `richardson-caps/`: 2 each


### File Count by Type
- **HTML Files:** ~120
- **JavaScript Files:** ~130
- **CSS Files:** ~65
- **Active Calculators:** 20 (includes contract, customer-facing, forms)
- **Active Quote Builders:** 5 (DTG, DTF, Embroidery, Screen Print, Monogram)
- **Active Dashboards:** 20 (includes staff portals, CRM, art hub variants, bundle orders, quote management)

### Organization Health
- **Files in correct folders:** 100%
- **No inline code:** Target achieved
- **No duplicate files:** Target achieved
- **No test files in root:** Target achieved

## ⚠️ Files Requiring Attention

### Need Refactoring
| File | Issue | Priority |
|------|-------|----------|
| Various HTML files | Still have inline scripts (113 files) | Medium |
| Multiple JS files | Hardcoded API URLs (149 instances) | High |

## 📁 Additional Directories

### Training Materials (`/training/` — 47 files)

Operational guides, training modules, and Adriyella's daily-task tooling. Most are standalone HTML pages with embedded JS/CSS.

| File | Purpose | Status |
|------|---------|--------|
| `/training/index.html` | **NEW (2026-07-10)** Training Center — role-track directory of ALL training (static guides + live Policies Hub Training category via public API); dashboard Training nav lands here | ✅ Active |
| `/training/training-center.js` | Training Center controller — curated role tracks + live hub Training-category list | ✅ Active |
| `/training/training-center.css` | Training Center styles (2026 tokens, dash-shell) | ✅ Active |
| `/training/garment-art-request-guide.md` | **NEW (2026-06-17)** AE field guide for the rebuilt Garment art-request form — each field, what's required, what "approved" means, repeat/revision how-tos, short-notes rule | ✅ Active |
| `/training/api-test-runner.html` | API test runner harness | ✅ Active |
| `/training/art-approval-guide.html` | Art approval workflow guide | ✅ Active |
| `/training/bonus-policy.html` | Bonus policy reference | ✅ Active |
| `/training/cap-training.html` | Cap embroidery training | ✅ Active |
| `/training/customer-categorization-training.html` | Customer categorization training | ✅ Active |
| `/training/customer-service.html` | Customer service training | ✅ Active |
| `/training/get-to-know-erik.html` | "Get to know Erik" intro page | ✅ Active |
| `/training/google-review-guide.html` | Google review request guide | ✅ Active |
| `/training/lead-email-templates.html` | Lead email templates | ✅ Active |
| `/training/lead-follow-up-guide.html` | Lead follow-up guide | ✅ Active |
| `/training/lead-sheet-guide.html` | Lead sheet guide | ✅ Active |
| `/training/lead-source-training.html` | Lead source training | ✅ Active |
| `/training/nwca-language-reference.html` | NWCA language/terminology reference | ✅ Active |
| `/training/quick-reference-tips.html` | Quick reference tips | ✅ Active |
| `/training/sales-coordinator-manual.html` | Sales coordinator manual | ✅ Active |
| `/training/sales-coordinator-training-schedule.html` | Sales coordinator training schedule | ✅ Active |
| `/training/sales-tax-code-trainer.html` | Sales tax code trainer | ✅ Active |
| `/training/sanmar-purchasing-guide.html` | **NEW (2026-07-10)** SanMar purchasing via ShopWorks API training guide — 3 phases (cost line items / build+send PO / note order), size-annotation cheat sheet, ShopWorks screenshots from Bradley's deck, official ShopWorks Wistia videos. Linked from staff-dashboard Training nav | ✅ Active |
| `/training/sanmar-purchasing-guide.css` | Styles for the SanMar purchasing training guide (print-friendly) | ✅ Active |
| `/training/sanmar-purchasing-guide.js` | SanMar purchasing guide behaviour: print, persistent checklists, back-to-top | ✅ Active |
| `/training/images/sanmar-purchasing/` | 8 ShopWorks screenshots for the SanMar purchasing guide (from Bradley's PPTX; account # redacted) | ✅ Active |
| `/training/shipping-receiving-guide.html` | Shipping & Receiving Clerk training guide (receiving/shipping/pickups/close-day/hand-off) | ✅ Active |
| `/training/shipping-receiving-guide.css` | Styles for the Shipping & Receiving training guide (print-friendly) | ✅ Active |
| `/training/shipping-receiving-guide.js` | Shipping & Receiving guide behaviour: print, persistent checklists, back-to-top | ✅ Active |
| `/training/shopworks-customer-setup.html` | ShopWorks customer setup guide | ✅ Active |
| `/training/shopworks-customer-setup-enhanced.html` | ShopWorks customer setup (enhanced) | ✅ Active |
| `/training/shopworks-customer-setup-working.html` | ShopWorks customer setup (working draft) | ⚠️ Verify |
| `/training/shopworks-embroidery-order-type.html` | ShopWorks embroidery order type guide | ✅ Active |
| `/training/shopworks-notes.html` | ShopWorks notes reference | ✅ Active |
| `/training/shopworks-sales-tax-training.html` | ShopWorks sales tax training | ✅ Active |
| `/training/team-match-game.html` | Team match game (training) | ✅ Active |
| `/training/test.html` | Test page (likely scratch — verify) | ⚠️ Verify |
| `/training/thank-you-card-guide.html` | Thank-you card guide | ✅ Active |
| `/training/training-engine-base.js` | Training engine base class | ✅ Active |
| `/training/training-games-hub.html` | Training games hub | ✅ Active |
| `/training/server.js` | Local training server (dev only) | ⚙️ Tooling |
| `/training/simple-server.js` | Simple training server (dev only) | ⚙️ Tooling |

### Mockups & Prototypes (`/mockups/` — 11 files)

UI/UX prototypes used during design iteration. Not in production routes.

| File | Purpose | Status |
|------|---------|--------|
| `/mockups/dtg-3-step-mockup.html` | DTG 3-step ordering flow mockup | 🎨 Prototype |
| `/mockups/dtg-3-step-complete.html` | DTG 3-step complete state mockup | 🎨 Prototype |
| `/mockups/dtg-location-mockup.html` | DTG location selector mockup | 🎨 Prototype |
| `/mockups/dtg-location-mockup-real-image.html` | DTG location mockup (real image variant) | 🎨 Prototype |
| `/mockups/dtg-location-mockup-with-images.html` | DTG location mockup (with images) | 🎨 Prototype |
| `/mockups/dtg-location-selector-final.html` | DTG location selector (final design) | 🎨 Prototype |
| `/mockups/edit-ruth-mockup.html` | Ruth mockup edit prototype | 🎨 Prototype |
| `/mockups/product-page-complete-mockup.html` | Product page complete mockup | 🎨 Prototype |
| `/mockups/staff-portal-mockup-1.html` | Staff portal mockup variant 1 | 🎨 Prototype |
| `/mockups/staff-portal-mockup-2.html` | Staff portal mockup variant 2 | 🎨 Prototype |
| `/mockups/staff-portal-mockup-3.html` | Staff portal mockup variant 3 | 🎨 Prototype |

### Other Active Directories (file-count summary)

These directories contain code but aren't enumerated at file level — list grows on demand.

| Directory | File Count | Contents |
|-----------|-----------|----------|
| `/admin/` | 4 HTML | Announcements admin, BOGO promo admin, universal records admin |
| `/art-tools/` | 3 HTML | AE art dashboard, AE submit art, art approval |
| `/email-templates/` | 7 HTML | EmailJS templates: BCA customer email, xmas bundle, ready, embroidery, sample request, screenprint customer |
| `/employee-bundles/` | 2 HTML | streich-bros-bundle, wcttr-bundle |
| `/policies/` (root-level) | 8 HTML | Bundle kitting xmas, customer notification SOP, DTG artwork checklist, LTM fee policy, LTM order decision algorithm, payment terms, retail-vs-wholesale policy, sales office procedures |
| `/richardson-caps/` | 1 HTML + 1 JS | view-combination-caps.html, scripts/richardson-combination-caps-manual.js |
| `/scripts/` | 14 JS | Backfill, validation, prevention, cleanup, doc-freshness, generate-new-products, parse-production-schedule, etc. |
| `/scripts/safety-tools/` | 7 JS | auto-recovery, comprehensive-test-suite, dependency-mapper, error-monitor, file-access-monitor, safe-delete, validate-critical-paths |
| `/templates/` | 4 HTML + 1 JS | Calculator template, email template, emblem email template, laser tumbler EmailJS template, quote service template |
| `/tools/` | 5 HTML | Cap layout mockup, CSS diagnostic, decoration selector mockup, diagnose-css-override, diagnose-search-issue |
| `/vendor-portals/` | 3 HTML | sanmar-credits, sanmar-invoices, sanmar-vendor-portal |
| `/config/` | 1 JS | app.config.js (central configuration) |
| `/temp/` | 1 JS | verify-dtg-pricing.js (likely cruft — verify and remove) |

### Support & Documentation
| Directory | Purpose | Status | Notes |
|-----------|---------|--------|-------|
| `/admin/` | Administrative tools and utilities | ✅ Active | Backend administration |
| `/art-tools/` | Art department tools | ✅ Active | Design utilities |
| `/caspio-tables/` | Caspio database configurations | ✅ Active | Database schemas |
| `/email-templates/` | EmailJS templates | ✅ Active | Quote email templates |
| `/logs/` | Log and generated files | 🚫 Ignored | Not in version control |
| `/memory/` | Claude AI memory files | ✅ Active | API specs only |
| `/mockups/` | Design mockups | ✅ Active | UI/UX references |
| `/node_modules/` | NPM dependencies | 🔧 Generated | Do not modify |
| `/policies/` | Business policies | ✅ Active | Company procedures |
| `/product/` | Product pages | ✅ Active | Product display system |
| `/scripts/` | Utility scripts | ✅ Active | Contains safety-tools/ |
| `/src/` | Server source code | ✅ Active | Node.js backend |
| `/templates/` | HTML templates | ✅ Active | Reusable components |
| `/tests/` | **Automated Testing Suite** | ✅ Active | **Screen print calculator validation** |
| `/tools/` | Development tools | ✅ Active | Build and dev utilities |
| `/training/` | Training materials | ✅ Active | Staff training docs |
| `/vendor-portals/` | Vendor integrations | ✅ Active | External vendor access |

## 🧪 Automated Testing System

**Created:** 2025-10-03
**Purpose:** Comprehensive automated testing for all screen print calculators

### Test Suite Files
| File | Purpose | Status |
|------|---------|--------|
| `/tests/screenprint-calculator-test-suite.js` | Core testing framework | ✅ Active |
| `/tests/screenprint-test-cases.js` | 17 comprehensive test cases | ✅ Active |
| `/tests/screenprint-test-runner.html` | Visual test interface | ✅ Active |
| `/tests/README-TESTING.md` | Testing documentation | ✅ Active |

### Features
- ✅ Automated pricing validation across all calculators
- ✅ Safety stripes functionality testing
- ✅ Dark garment toggle verification
- ✅ Cross-calculator consistency checks
- ✅ Auto-fix suggestions for detected issues
- ✅ Visual test results with export options
- ✅ 17 test cases covering all scenarios

### Test Categories
1. **Basic Pricing** (3 tests) - Fundamental pricing calculations
2. **Safety Stripes** (4 tests) - $2.00 surcharge validation
3. **Dark Garment** (2 tests) - Underbase color addition
4. **LTM Fee** (2 tests) - Minimum order fee logic
5. **Additional Locations** (2 tests) - Multi-location pricing
6. **Color Count** (2 tests) - 1-6 color validation
7. **Complex Scenarios** (2 tests) - Combined features testing

### Embroidery CSV Validator (2026-02)
| File | Purpose | Status |
|------|---------|--------|
| `/tests/embroidery-csv-validator.html` | Drag-and-drop ShopWorks CSV validation tool (size suffix, qty math, fee checks) | ✅ Active |

**Usage:** Open in browser, drag CSV export → instant validation report with pass/warn/fail per row

### Order Validation Tests (2026-02)
| File | Purpose | Status |
|------|---------|--------|
| `/tests/validation/validate-2025-orders.js` | Validate 2025 embroidery orders against pricing system | ✅ Active |
| `/tests/validation/known-vendors.js` | Non-SanMar vendor identification patterns (Carhartt infant, Rabbit Skins added 2026-02-01) | ✅ Active |
| `/tests/validation/2025-orders-validation-report.json` | Generated validation report (not in git) | 📊 Output |
| `/tests/validation/2025-oddballs-recommendations.csv` | **NEW** CSV export of 110 oddball items with recommendations | 📊 Output |

**Run:** `node tests/validation/validate-2025-orders.js`

**Purpose:** Analyzes 6,222 embroidery line items from 2025 to determine:
- Which orders can be priced via the quote builder (service codes + SanMar products)
- Which need manual lookup (non-SanMar vendors)
- Which are oddballs (typos, free-text, comments)

| `/tests/validation/validate-csv-output-paths.js` | Full simulation: 3-CSV join, live API pricing, all 4 output path validation | ✅ Active |
| `/tests/validation/csv-output-paths-report.json` | Generated full simulation report (not in git) | 📊 Output |

**Run:** `node tests/validation/validate-csv-output-paths.js` (~3 min, 1134 API calls)

**Purpose:** Joins 3 CSV data sources (line items, ODBC orders, stitch counts), reconstructs 1,261 embroidery orders, calls live pricing API, validates all 4 output paths (UI, PDF, Save, Clipboard). Compares computed pricing vs ShopWorks actuals.

### Data Seeding Scripts (2026-02)
| File | Purpose | Status |
|------|---------|--------|
| `/tests/scripts/seed-classified-items.js` | Seed service codes & non-SanMar products to Caspio | ✅ Active |
| `/tests/scripts/cleanup-duplicate-products.js` | Remove duplicate non-SanMar products | ✅ Active |
| `/tests/scripts/cleanup-duplicate-service-codes.js` | Remove duplicate service codes | ✅ Active |
| `/tests/scripts/update-embroidery-costs.js` | **NEW** Update AL/CB/CS/FB records in Embroidery_Costs | ✅ Active |
| `/tests/scripts/add-cemb-service-codes.js` | **NEW** Add CEMB/CEMB-CAP service codes | ✅ Active |
| `/tests/scripts/cleanup-embroidery-costs.js` | **NEW** Delete duplicates, add missing DECG-FB 1-7 (2026-02-04) | ✅ Active |
| `/tests/scripts/update-ctr-pricing-linear.js` | **NEW** Update CTR pricing with linear $/1K model (2026-02-04) | ✅ Active |
| `/tests/scripts/sync-shopworks-service-codes.js` | **NEW** Sync all 28 ShopWorks service codes to Caspio (2026-02-14) | ✅ Active |
| `/tests/scripts/batch-price-audit-report.js` | **NEW** Batch service pricing audit — compares SW vs 2026 prices across all fixtures. `--html` generates dashboard report (2026-02-15) | ✅ Active |

**Run:** `node tests/scripts/seed-classified-items.js`

**Seeded Data (Feb 2026):**
- **8 service codes:** CDP, SPSU, Transfer, SPRESET, Shipping, Freight, Name/Number, emblem
- **26 non-SanMar products:** Richardson caps (6), Callaway polos (2), Cutter & Buck (3), Hi-Vis safety (4), Polar Camel drinkware (4), Specialty items (5), Other (2)

**Embroidery Pricing Consolidation (Feb 2026):**
- **`update-embroidery-costs.js`:** Adds AL (5 tiers), AL-CAP (5 tiers), CB (5 tiers), CS (5 tiers), FB (1 record) = 21 records
- **`add-cemb-service-codes.js`:** Adds CEMB (5 tiers), CEMB-CAP (5 tiers) = 10 service codes
- **`update-ctr-pricing-linear.js`:** Updates CTR-Garmt, CTR-Cap, CTR-FB with linear $/1K pricing (Feb 2026)

## 🔄 Update Protocol

### When to Update This File
1. **After creating** any new file
2. **After deleting** any file
3. **After moving** files to different folders
4. **Weekly** review for orphaned files

### How to Update
1. Add new files to appropriate section
2. Mark deprecated files with removal date
3. Update statistics section
4. Update last modified date at top

### Validation Commands
```bash
# Find files not listed in ACTIVE_FILES.md
find . -type f -name "*.js" -o -name "*.html" | grep -v node_modules | while read file; do
  grep -q "$file" ACTIVE_FILES.md || echo "Not documented: $file"
done

# Find files listed but not existing
grep -o '`[^`]*`' ACTIVE_FILES.md | tr -d '`' | while read file; do
  [ -f ".$file" ] || echo "File missing: $file"
done
```

---

**Maintenance Note:** This file is critical for preventing code chaos. Keep it updated!

*Generated after comprehensive cleanup that removed 71+ orphaned files*