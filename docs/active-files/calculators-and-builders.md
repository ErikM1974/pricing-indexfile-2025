# 📊 Calculators & Quote Builders

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
| `/calculators/service-price-cheat-sheet.html` | **The Shop Menu** (2026-09-03) — the ONE rep + customer price page for work on customer-supplied goods: restaurant-menu layout, Rep view (ShopWorks codes + book times) / Customer view (prices only), "Print customer menu" (one page, no URL footer) and "Print rep copy". Every SHOP line + Setup & Art fee loads from Caspio `Service_Codes`; $100 job minimum, bench $25/¼h, machine $37.50/¼h, supplies cost ÷ 0.53. The separate customer card and the SHP calculator were both deleted 2026-09-03 (one page rule). | service-price-cheat-sheet.js/css, app-config.js, `GET /api/service-codes` | ✅ Active |
| `/calculators/service-price-cheat-sheet.js` | Shop Menu controller — fetches `/api/service-codes`, builds the courses from the SHOP rows (Position/PerUnit → bench/machine/add-on footnote), Setup & Art fee course, rep/customer view toggle (localStorage), the two print buttons. Rule 4: Caspio failure = banner + no prices. | /api/service-codes, app-config.js | ✅ Active |
| `/calculators/service-price-cheat-sheet.css` | Shop Menu styles — Bodoni Moda / Libre Franklin, dot leaders, minimum stamp, rep-only/customer-only visibility, print block (`@page margin 0`, one letter page). | Google Fonts | ✅ Active |

### Compare Pricing by Style
| File | Purpose | Dependencies | Status |
|------|---------|--------------|--------|

### DTG System
| File | Purpose | Dependencies | Status |
|------|---------|--------------|--------|
| `/calculators/dtg-pricing.html` | DTG pricing calculator | dtg-adapter.js, dtg-pricing-service.js | ✅ Active |
| `/calculators/dtg-manual-pricing.html` | ~~DELETED~~ Manual DTG pricing — superseded by `/calculators/manual-pricing.html` (unified) | — | ❌ Deleted |
| `/calculators/archive/manual-pricing-deprecated/dtg-manual-pricing.html` | Archived pre-unification DTG manual calculator | — | 📦 Archived |
| `/quote-builders/dtg-quote-builder.html` | **DTG flagship (v14, 2026-05-19+).** Manual-first inline-form DTG quote builder + DTG AI bot + Submit-to-ShopWorks + sales tax (per-address WA DOR lookup, exempt/pickup/out-of-state) + order-summary band. Legacy iframe REMOVED (legacy builder deleted 2026-06-08; `/quote-builders/dtg-quote-builder-legacy.html` 301-redirects here). This is the sole DTG builder. | builders/dtg/* (bundle), dtg-quote-page.js, dtg-pricing-service.js, quote-order-summary.js | ✅ Active |
| ~~`/shared_components/js/dtg-quote-pricing.js`~~ | **DELETED 2026-06-09** — dead legacy DTG quote pricing engine; only consumer was the also-dead dtg-quote-products.js. No HTML loaded it. | — | ❌ Deleted |

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
| `/calculators/embroidery-pricing-all/embroidery-pricing-all.js` | Corporate embroidery pricing logic (AL retail + DECG retail + stitch surcharges + Full Back). **Full Back consolidated 2026-08-15**: renders the ONE ladder (`Embroidery_Costs` `ItemType='DECG-FB'`) that the quote builder + contract calculator also price from — it previously showed CTR-FB *wholesale* rates under a "DECG-FB" heading (~29% under retail). Hardcoded `$20` min-charge floor and 3 dead full-back matrix builders (127 lines) deleted. | /api/al-pricing, /api/decg-pricing, /api/pricing-bundle?method=EMB, /api/contract-pricing | ✅ Active |
| `/calculators/embroidery-pricing-all/embroidery-pricing-all.css` | Tabbed interface styles | - | ✅ Active |
| `/calculators/embroidery-contract/index.html` | **Round 7 (2026-05-14)** Editorial Contract Embroidery pricing page. Replaced the Round 6 minimal-pink page with a magazine-style layout extracted from the Claude Designer mockup: top bar with theme chip, editorial hero (serif title with italic year + 3-fact aside), 2-column calculator card with pink-gradient result panel + 72px hero price, 3-card callouts, tabbed pricing tables (Garment / Cap / Full Back) with live active-tier-column + current-stitch-row + intersection-cell highlighting, ShopWorks parts row, dark contact card with numbered checklist, footnote. Single-tier wholesale pricing for Ruthie / ASI distributors who supply their own blanks. | embroidery-contract.js, embroidery-contract.css, Google Fonts (Fraunces, Geist, Geist Mono) | ✅ Active |
| `/calculators/embroidery-contract/embroidery-contract.js` | **Round 7 (2026-05-14)** Standalone calculator JS for the Contract Embroidery page. Fetches `/api/contract-pricing`, builds 3 pricing matrices, drives the editorial UI (segmented item picker, qty/stitch presets, hero serif price, live table highlighting), supports URL-param share-links (`?type=&qty=&stitches=`) — Ruthie types inputs, copies a share-URL, customer clicks the URL and sees the calculator pre-filled with the same quote. No ES-module deps; pure browser JS. | /api/contract-pricing **2026-09-02**: fee now per product from the payload (`garments.ltmFee`/`caps.ltmFee`; the old `data.ltmFee \|\| 50` was a hardcoded $50) and the full-back mapping keeps `ltmFee`/`ltmThreshold` (it dropped them → $0 fee); `$150` order minimum from Service_Codes `CTR-MIN-ORDER` applied once in `priceAllLines()` after `combineLines` (`applyOrderMinimum`), so hero/total/copy/AI agree; page facts + hero terms filled from the API (`renderPricingFacts`). | ✅ Active |
| `/calculators/embroidery-contract/embroidery-contract.css` | **DEDUP (2026-05-29)** Now page-specific ONLY (~137 lines): segmented item-type picker (`.seg`), pricing-table tabs (`.tabs`), `.divider`, two-column qty/stitch row (`.calc-form .row`), tfoot active-column highlight, + seg/tabs focus rings. All shared chrome (tokens, top bar, hero, calc shell, result panel, buttons, table base, contact, footer, AI chat panel) moved to `/shared_components/css/contract-pricing-2026.css`, loaded BEFORE this file so page rules win the cascade. | contract-pricing-2026.css, Google Fonts | ✅ Active |
| `/shared_components/css/contract-pricing-2026.css` | **NEW (2026-05-29)** Shared editorial chrome for BOTH contract calculators (`embroidery-contract` + `dtg-contract`): design tokens, top bar, hero, calculator shell, result panel, totals, buttons, pricing-table base, contact card, footnote, toast, pricing-error, and the entire AI chat panel (~1,207 lines). Eliminates the ~1,090 lines that were copy-pasted between the two pages. Loaded BEFORE each page's own CSS so page rules win the cascade. **Bump the `?v=` on BOTH pages when editing this file.** | embroidery-contract.css, dtg-contract.css | ✅ Active |
| `/quote-builders/embroidery-quote-builder.html` | Embroidery/Cap Combo Quote Builder 2026 (Excel-style) | embroidery-quote-pricing.js | ✅ Active |
| `/shared_components/js/embroidery-quote-pricing.js` | Embroidery pricing engine (tiers, LTM, stitch surcharges, FB). **`buildSyntheticSizePricing()` (2026-08-14)** builds a `/api/size-pricing`-shaped payload from a rep-entered BLANK COST so vendor (non-SanMar) garments price through the SAME untouched formula — one new input shape, no 4th pricing path (Rule 9); locked byte-identical by tests/unit/emb-nonsanmar-costplus.test.js. ⚠️ Never seed `sizePricingCache` with it — that cache is never cleared and would shadow a real SanMar style. | Caspio API | ✅ Active |
| `/shared_components/js/embroidery-quote-service.js` | Embroidery quote save/update/email service | Caspio API, EmailJS | ✅ Active |
| `/shared_components/js/embroidery-quote-invoice.js` | Embroidery invoice generation (ShopWorks format) | — | ✅ Active |
| `/shared_components/js/quote-pricing-data.js` | Shared `pricingData` contract (Phase 3.1) — builds + validates the shape all 4 quote builders pass to `embroidery-quote-invoice.js`. Normalizes method→flags, percent tax→decimal, zero-fills fee fields. | — | ✅ Active |
| `/shared_components/js/quote-services-bar.js` | Persistent, catalog-driven "Add to order" services bar (2026-06-03) — `QuoteServicesBar.render(mountId, catalog, onAdd)`; clicking a chip adds that service as a line item. Reusable across EMB/SCP/DTG/DTF (each passes its own catalog). **`openServiceGroup(label)` (2026-08-14)** opens a group programmatically (deferred past the caller's own click) so a page can point a rep at a group they wouldn't find — used by the EMB empty state for Customer-Supplied. | quote builders | ✅ Active |

> `embroidery-quote-logos.js` + `embroidery-quote-products.js` DELETED 2026-07-07 (expert audit): zero `<script>` references repo-wide, encoded an OLDER ruleset than the live builder (a fix applied there was a silent no-op), yet were documented ✅ Active — exactly the drift ACTIVE_FILES.md exists to prevent. Live logo/product logic is all in `embroidery-quote-builder.js`.

### Screen Print System
| File | Purpose | Dependencies | Status |
|------|---------|--------------|--------|
| `/calculators/screen-print-pricing.html` | Screen print calculator | screenprint-pricing-v2.js, screenprint-pricing-service.js | ✅ Active |
| `/quote-builders/screenprint-quote-builder.html` | Screen Print Quote Builder 2026 (Excel-style) | screenprint-pricing-service.js | ✅ Active |
| `/shared_components/js/screenprint-quote-service.js` | Screen print quote save/email service | Caspio API, EmailJS | ✅ Active |
| `/quote-builders/screenprint-fast-quote.html` | Fast quote form (60 sec) | screenprint-fast-quote-service.js | ✅ Active |
| `/shared_components/js/screenprint-pricing-v2.js` | Main calculator logic | screenprint-pricing-service.js | ✅ Active |
| `/shared_components/js/screenprint-pricing-service.js` | Pricing data adapter | Caspio API | ✅ Active |
| `/shared_components/js/screenprint-fast-quote-service.js` | Fast quote service | EmailJS, Caspio API | ✅ Active |
| `/tests/unit/scp-dark-garment-parity.test.js` | **NEW (2026-06-11)** Rule-7 lock: calculator dark-garment underbase = setup screen only, per-piece by RAW colors — parity vs builder worked-example fixtures (covers v2 + manual calculator) | jest, screenprint-pricing-v2.js, screenprint-manual-pricing.js | ✅ Active |

### Monogram Form System (NEW 2026-01-08)
| File | Purpose | Dependencies | Status |
|------|---------|--------------|--------|
| `/quote-builders/monogram-form.html` | Monogram/personalization tracking form | monogram-form-service.js, monogram-form-controller.js, monogram-name-qa.js, dst-palette.js | ✅ Active |
| `/shared_components/js/monogram-form-service.js` | API service (ManageOrders, Caspio) | ManageOrders API | ✅ Active |
| `/shared_components/js/monogram-form-controller.js` | UI controller and state management | monogram-form-service.js, monogram-name-qa.js | ✅ Active |
| `/shared_components/js/monogram-name-qa.js` | **NEW (2026-08-04)** "Stitch Check" pure QA engine: whitespace/case/duplicate/near-dup/punctuation/completeness checks + thread-grouped machine run plan (UMD, jest-tested) | none (pure) | ✅ Active |
| `/tests/unit/monogram-name-qa.test.js` | **NEW (2026-08-04)** Pins every Stitch Check rule (41 tests) | jest, monogram-name-qa.js | ✅ Active |
| `/shared_components/css/monogram-form.css` | Monogram form styling (incl. Stitch Check panel + customer proof sheet print styles) | quote-builder-common.css | ✅ Active |
| `/memory/MONOGRAM_FORM_SYSTEM.md` | Implementation documentation | - | 📚 Docs |

**Features:** Order lookup from ShopWorks, dynamic name entry (up to 50), print PDF for production (thread-grouped machine run plan when 2+ threads), live Stitch Check QA panel, customer proof sheet with per-name approval checkboxes + signature line (names rendered in mapped font + real thread hex from Caspio `Hex_Color`, RA palette fallback), search by order/company.

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
| `/calculators/webstores-styles.css` | 🗄️ Pre-AI page styles. New page uses sticker-pricing-page.css + webstore-pricing-page.css. Delete after soak. | — | ❌ Removed 2026-09-07 — dead: no page, script, route or @import referenced it (verified by path, basename and stem search); deleted with the CSS standardization tail batch |

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
| `/calculators/laser-tumbler-styles.css` | Laser tumbler page styles | — | ❌ Removed 2026-09-07 — dead: no page, script, route or @import referenced it (verified by path, basename and stem search); deleted with the CSS standardization tail batch |
| `/calculators/custom-decal-pricing.html` | **NEW (2026-07-29)** Custom & oversize decal pricing — the square-foot calculator + API-driven rate card for anything the sticker grid can't price (>6×6, odd dims, mixed sizes, runs under the 50-piece minimum). Staff-gated at `/calculators/custom-decal-pricing.html` and `/pricing/decals`; the ONLY consumer of proxy `/api/custom-decal-pricing`. Extracted from the retired sticker-manual-pricing.html. Reuses sticker-pricing-page.css deliberately (that file already owns every `.decal-*` rule and is shared by 5 pages). Loads `/config/app.config.js` — NOT `shared_components/js/app-config.js`, which sets a different global. | custom-decal-pricing-page.js, sticker-pricing-page.css, /config/app.config.js, memory/CUSTOM_DECAL_PRICING_2026-06.md | ✅ Active |
| `/calculators/sticker-manual-pricing.html` | 🔻 **DEAD 2026-07-29** — the "Stickers/Banners" staff page. Its sticker grid and banner rate card are redundant (customers get the same Caspio-backed numbers at `/custom-stickers` and `/custom-banners`); its oversize-decal calculator moved to custom-decal-pricing.html. Both its routes now return a **410 signpost** — that tombstone route is load-bearing, because `/calculators` is a static mount and without it Express would serve this file to anyone, dropping the requireStaff gate its AI drawer needed. File left on disk per flag-don't-delete. | (none — no UI links here) | 🔻 Dead — retired 2026-07-29 |
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
- **Docs:** the DECG rate card + formula live in `shared_components/js/embroidery-pricing-service.js` (`calculateDECGPrice`) and `memory/DASHBOARD_REVIEWS_2026-09.md` § CUSTOMER-SUPPLIED (the old `DECG_PRICING_2026.md` / `EMBROIDERY_PRICING_RULES.md` were removed in the 2026-09-06 dead-files sweep)

[Back to the registry index](../../ACTIVE_FILES.md)
