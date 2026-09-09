# 🎨 Stylesheets

Reviewed: shared_components/css/purchasing-workspaces.css — canonical Purchasing Portal and Payables arrangements; two legacy page owners retired.

Reviewed: shared_components/css/vendor-invoice.css — native opt-in purchasing invoice dialog and complete printed documents; legacy AE CSS retained with compatibility coverage.

Reviewed: shared_components/css/staff-import-tools.css — shared SanMar file-tool layout; both consumers migrated and two legacy owners retired.

### Core CSS Files
| File | Purpose | Used By | Status |
|------|---------|---------|--------|
| /shared_components/css/art-theme.css | Small art-family semantic aliases and elapsed-time badges; shared by queues and details. | Steve, AE, Art Request Detail and Mockup Detail | Active |
| /shared_components/css/art-intake.css | Common request form, upload and customer lookup patterns for four art request types. | AE Dashboard | Active |
| /shared_components/css/art-actions.css | Shared ArtActions time, notes, approval and file dialogs. Separate from the smaller queue owner. | Steve, AE and Art Request Detail | Active |
| /shared_components/css/art-detail.css | Shared artwork detail shell, panels, dialogs and customer theme adapters. | Art Request Detail and Mockup Detail | Active |
| /shared_components/css/art-workflow.css | Scoped art queue, board, recovery and action dialog patterns. | Ruth, Steve, AE and art detail pages | Active |
| `/shared_components/css/transfer-workflow.css` | Shared scoped sender patterns for migrated staff workflows (2026-09-08); legacy sender entry point remains for unmigrated art consumers. | Bradley Transfer / Screen Print queues | Active |
| `/scripts/css/runtime-inventory.js` | Runtime style census: tracked pages, literal route aliases, CSS imports and script-generated owners; source evidence is distinct from browser coverage (2026-09-08). | CSS migration maintenance | Active |
| `/shared_components/css/tokens.css` | **App-wide design tokens (2026-09-07)** — `@layer` order + palette/type/space/radius/shadow/motion/z-index; load FIRST on every page | staff dashboard, company numbers; every migrated family | ✅ Active |
| `/shared_components/css/universal-header.css` | Header styles | All pages | ✅ Active |
| `/shared_components/css/universal-calculator-theme.css` | Calculator theme | All calculators | ✅ Active |
| `/shared_components/css/embroidery-quote-builder.css` | ~~DELETED~~ — replaced by `embroidery-quote-builder-extracted.css` (2026-01-27) | — | ❌ Deleted |
| `/shared_components/css/embroidery-quote-builder-extracted.css` | Embroidery quote builder styles (2026-01-27 extraction) | Embroidery quote builder | ✅ Active |
| `/shared_components/css/quote-builder-unified-step1.css` | ~~DELETED~~ — superseded by `quote-builder-common.css` (2026-01-27) | — | ❌ Deleted |
| `/shared_components/css/dtg-quote-builder.css` | DTG specific | DTG quote builder | ❌ Removed 2026-09-07 — dead: no page, script, route or @import referenced it (verified by path, basename and stem search); deleted with the CSS standardization tail batch |
| `/shared_components/css/campaign-storefront.css` | **NEW** Golf tournament landing page styles (golf theme — fairway greens, sand accents, gold offer ribbon) | golf-tournaments-2026.html, golf-tournament-product.html | ✅ Active |
| `/shared_components/css/golf-tournament-product.css` | **NEW** Product detail page styles (gallery, color swatches, size pills, volume pricing table) — layered on top of showcase.css | golf-tournament-product.html | ✅ Active |
| `/shared_components/css/dtg-quote-builder-extracted.css` | DTG quote builder extracted styles (2026-01-27) | DTG quote builder | ❌ Removed 2026-09-07 — dead: no page, script, route or @import referenced it (verified by path, basename and stem search); deleted with the CSS standardization tail batch |
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
| `/shared_components/css/contract-pricing-theme.css` | **NEW (2026-05-13)** Pink-accent theme overlay for Contract pricing pages — operational color-code matching the pink box labels NWCA puts on contract jobs in the factory. Layers on top of calculator-base.css; rebinds `--primary-green`/`--primary-color`/`--primary-dark` to rose-600/700 so existing calculator CSS reuses pink without rewrite. Adds `.contract-share-btn` + `.contract-share-toast` + `.contract-info-banner` components for the "calculate → copy link → share with customer" workflow. Activated via `<body class="contract-pricing">`. | calculators/dtg-contract/index.html, calculators/embroidery-contract/index.html | ❌ Removed 2026-09-07 — dead: no page, script, route or @import referenced it (verified by path, basename and stem search); deleted with the CSS standardization tail batch |
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
| `/shared_components/css/dtg-brand-override.css` | DTG brand color overrides | DTG quote builder | ❌ Removed 2026-09-07 — dead: no page, script, route or @import referenced it (verified by path, basename and stem search); deleted with the CSS standardization tail batch |
| `/shared_components/css/dtg-ltm-quantity-input.css` | DTG LTM quantity input styles | DTG calculators | ✅ Active |
| `/shared_components/css/laser-tumbler-simple.css` | Laser tumbler simple flow styles | Laser tumbler calculator | ✅ Active |
| `/calculators/screenprint-manual-fix.css` | Screen print manual calculator fix styles | Manual pricing calculator | ❌ Removed 2026-09-07 — dead: no page, script, route or @import referenced it (verified by path, basename and stem search); deleted with the CSS standardization tail batch |

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
| `/shared_components/css/dashboard-styles.css` | Shared dashboard styles | All dashboards | ❌ Removed 2026-09-07 — dead: no page, script, route or @import referenced it (verified by path, basename and stem search); deleted with the CSS standardization tail batch |
| `/shared_components/css/kanban.css` | Kanban board shared styles (4 boards: art-hub, transfers, supacolor, etc.) | All kanban dashboards | ✅ Active |
| `/shared_components/css/art-hub.css` | Art Hub design tokens + shared styles (2026 design system) | art-hub-steve, art-hub-ruth, ae-dashboard, bradley-transfers | ✅ Active |
| `/shared_components/css/dash-shell.css` | **NEW (2026-05-16)** Canonical shell classes (`.dash-header`, `.dash-back-link`, `.dash-content`, `.dash-error-banner`, `.dash-stat-card`, `.dash-card`, `.dash-btn`) for staff-dashboard child pages. Reuses art-hub.css tokens — defines NO new tokens. Emitted by every page scaffolded via the `/dash-page` skill. | art-hub.css, all `/dash-page new`-scaffolded pages | ✅ Active |
| `/dashboards/css/digitized-designs.css` | **NEW (2026-05-16)** Page-specific styles for digitized-designs.html. Extracted from inline `<style>` block on 2026-05-16 by `/dash-page lift` — pure extraction (no token swap, no class rename) so behavior matches pre-lift exactly. | digitized-designs.html | ✅ Active |
| `/shared_components/css/emblem-pricing-page.css` | **NEW (2026-05-16)** Emblem patch page overrides — loads ON TOP of sticker-pricing-page.css. Adds the 16×10 pricing-grid table styling, AI-quoted cell highlight, live emblem-quote card, mobile collapse. Sticker provides the chat panel + hero + accordion shell; this file only adds emblem-unique bits. | sticker-pricing-page.css, /calculators/embroidered-emblem/index.html | ✅ Active |
| `/shared_components/css/webstore-pricing-page.css` | **NEW (2026-05-16)** Custom-webstore page overrides — loads ON TOP of sticker-pricing-page.css. Adds: cream/navy `.webstore-quote-card` for store-setup quotes, deep-purple/gold `.fundraiser-quote-card` for fundraiser sell-price math, distinct `.web-search-chip` styling + `.web-search-results` inline list for Tavily search results. | sticker-pricing-page.css, /calculators/webstores.html | ✅ Active |
| `/shared_components/css/dtg-quote-page.css` | **NEW (2026-05-17)** DTG quote-builder overrides — loads ON TOP of sticker-pricing-page.css. `.toast-container`/`.toast-*` rules added 2026-09-05 so `showToast()` is visible on the DTG page (it was a silent console line). Adds: deep-green `.dtg-quote-card` for the live price card, `.top-seller-card` recommendation cards (rendered inline in chat by the recommend_top_sellers tool), `.shopworks-success-card`, `.shopworks-error-card`. | sticker-pricing-page.css, /quote-builders/dtg-quote-builder.html | ✅ Active |
| `/shared_components/css/dtg-inline-form.css` | **NEW (2026-05-18)** Inline DTG order form styles — NWCA-green, replaces the iframed legacy Bootstrap form. Adds `.dtg-form-wrap` (paper card), `.dtg-location-pill` (front/back imprint chooser), `.dtg-rows-table` (multi-row table with style/color combobox + size grid), `.dtg-price-summary` (live tier + LTM card), `.dtg-customer-pane` (right-side customer panel mirroring the order form). | /quote-builders/dtg-quote-builder.html, builders/dtg | ✅ Active |
| `/shared_components/css/dtg-catalog.css` | **NEW (2026-05-18)** NWCA-Approved DTG Catalog browser styles — category-tabbed style grid (`.dtg-catalog-grid` + `.dtg-catalog-card`) with rank badges, plus full-screen detail modal (`.dtg-catalog-modal`) with per-color "Add to quote" cards. **2026-06-03**: + full-catalog fallback styles (`.dtg-fullcat-*`: empty-state CTA, results header/back link, compact result cards, suitability warning chips, footer link). Loaded on dtg-quote-builder.html. | /quote-builders/dtg-quote-builder.html, dtg-catalog.js | ✅ Active |
| `/shared_components/css/mockup-ruth.css` | Ruth mockup workflow styles | art-hub-ruth.html | ✅ Active |
| `/shared_components/css/mockup-submit-form.css` | Ruth digitizing/mockup request form styles (.msf-*). **2026-09-03 redesign**: Ruth's PURPLE identity is scoped to `.msf-container` (the old `:root` purple default is gone, so the sheet no longer leaks a theme); profile-card banner, segmented request-type toggle, pill multi-select, shared field/drop-zone/rush/submit/success blocks identical to the other three intake forms | mockup-submit-form, ae-dashboard.html | ✅ Active |
| `/shared_components/css/sticker-banner-submit-form.css` | Sticker/Banner intake form (.sbf-*) + the Item-Type segmented control (.ae-item-pill*) on the AE dashboard. **2026-09-03 redesign**: hero banner, eyebrow section headers, radio pills; shared blocks identical to the other three intake forms. **2026-09-04**: Steve = GREEN for both item types (person colour-coding — Steve green, Ruth purple), the earlier red/blue split is gone | ae-dashboard.html | ✅ Active |
| `/shared_components/css/garment-submit-form.css` | Garment art-request form styles (.gsf-*). **2026-09-03 redesign**: 11 numbered sections on a vertical stepper rail, choice tiles for decoration methods + the AE checklist (checklist turns green via `:has(input:checked)`), elevated garment/location rows, amber "required" spotlight for repeat/revision, hero banner. Shared field/drop-zone/rush/submit/success/toast blocks are identical across all four intake forms (only the `--fx-*` accent tokens differ) — keep them in step | ae-dashboard.html, garment-designer.html (linked, unused) | ✅ Active |
| `/shared_components/css/jds-submit-form.css` | JDS vendor-product intake styles (.jds-*): catalog category/product tiles, sticky selected-product summary card with live JDS price tiers, and the art-request form. **2026-09-03 redesign** — icon search field, breadcrumb pills; shared field/drop-zone/rush/submit/success blocks identical to the other three intake forms. **2026-09-04**: accent is Steve GREEN (person colour-coding), not amber | ae-dashboard.html | ✅ Active |
| `/shared_components/css/sticker-pricing-page.css` | **NEW (2026-05-15)** NWCA green theme, right-side drawer chat panel, row-highlight animation on AI-quoted SKU, dark-blue banner rate-card grid + live banner-quote card, and all `.decal-*` rules. ⚠️ **The name is stale** — its original page was retired 2026-07-29 and it is now shared by 6 others (emblem, webstores, DTG + EMB builders, embroidery-chat's `.ai-chat-*` classes, custom-decal-pricing). **Do not delete or rename without touching all six**, and never load it alongside `instant-quote.css` — both redefine core tokens. | custom-decal-pricing.html, embroidered-emblem, webstores, dtg/emb quote builders, embroidery-chat.js | ✅ Active |
| `/shared_components/css/ae-nav-v2.css` | AE Dashboard two-tier navigation as a floating card (Tier 1: solid-gradient department tabs Steve/Ruth/Transfers/Personalization + tool links pushed right behind a hairline; Tier 2: raised sub-tabs + More dropdown). Accent follows `data-section` on `.ae-nav` (set by ae-dashboard.js): **Steve = GREEN, Ruth = PURPLE, Transfers (Bradley/purchasing) = slate BLUE `#4a6fa5`, Personalization (Names & Numbers / Monogram) = shop-floor BLUE `#2563eb`** (person/department colour-coding, Erik 2026-09-04); only the page chrome is maroon | ae-dashboard.html | ✅ Active |
| `/shared_components/css/transfer-actions.css` | Transfer action button styles | bradley-transfers + transfer-detail | ✅ Active |
| `/shared_components/css/force-green-theme.css` | Force NWCA green theme override | Multiple pages | ✅ Active |
| `/shared_components/css/modern-enhancements.css` | Modern UI enhancement overlays | Multiple pages | ✅ Active |
| `/shared_components/css/names-numbers.css` | Names & Numbers roster manager styles. **2026-09-04**: shop-floor BLUE identity above the fold — blue top strip on `.header`, `.page-header` is a blue gradient band with white title (both the dashboard and the roster form page share it; see `memory/DESIGN_COLOUR_CODE.md`) | names-numbers.html + dashboard | ✅ Active |
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

[Back to the registry index](../../ACTIVE_FILES.md)

## Unified UI migration (2026-09-08)

- `scripts/css/migration-manifest.json`: first four pilot style owners, state fixtures, source-byte budgets and pending generated/dynamic surfaces. Pending means not yet migrated or verified.
- `pages/css/webstore-inquiry.css`: storefront inquiry arrangement; shared controls belong to `components.css`.

- `shared_components/css/training-guide.css`: scoped navigation, reading, table, callout and print owner for reviewed training guides. The superseded training-shared.css was retired after its last consumers migrated.

- `shared_components/css/training-service.css`: shared service-guide disclosures, examples, images and print; replaces art-approval/google-review page CSS. Thank-you specimens and lead practice fields retain their two small page sheets.

- `shared_components/css/printable-forms.css`: scoped shared printable-form layout, controls, lookup/swatch states, phone table regions and paper rules for 17 `/pages/forms/` consumers. Their page sheets retain unique layouts/orientation. The old `nwca-form-shared.css` was retired when its last public quote-request consumer moved to canonical components and customer-intake.css.

- `shared_components/css/training-practice.css`: scoped practice layouts and feedback for seven games/reference pages; shared controls remain in components.css. Replaces the last training-shared.css consumers and their duplicated page controls.

- `shared_components/css/training-reference.css` — reference reading/nav/steps/contact/checklist pattern; four explicitly opted-in training pages.


- `shared_components/css/training-manual.css` — shared manual contents, reading layout and print contract.

- `/shared_components/css/training-simulator.css` — shared scoreboards, exercise options, feedback and native dialogs; Training Center and both ShopWorks simulations keep their arrangements in their scoped training sheets.

API reference family: Caspio, ManageOrders, SanMar and ShopWorks ODBC load tokens → components → api-reference → page arrangements. Shared reference CSS owns page chrome, labeled search, count/status, endpoint/field tables, callouts, mobile wrapping and paper rhythm. Keep technical catalogs in page controllers/data; original-content and schema guards prevent accidental edits. Native ODBC details and failed/malformed catalogue retry remain page behavior.

Policy guides/notices: shared components own page chrome, fields/buttons, cards and visibility. policy-migration.css and pricing-negotiation-policy.css own domain arrangements; simple-notice-page.css is shared by Resources/Sale. These four opt in with data-guidance. Preserve historical policy figures and the migration snapshot. Bootstrap and art-hub/dash-shell dependencies are removed from this family.

## Unified policies workspace — 2026-09-08

The four policy pages load tokens, shared components, then pages/css/policy-workspace.css. Policy Detail adds policy-detail.css and org-chart-2026.css; Handbook adds handbook.css. Each owns its responsive domain layout and one print layer. The prior policies-hub-v2.css path is retired. Shared policy-workspace.js owns contents disclosure, read-only table scrolling and control classes, excluding editor-owned DOM.

## Public webstore family — 2026-09-08

The twelve public webstore marketing pages share tokens/components/Public Sans and the rebuilt pages/css/company-webstores.css. They no longer borrow campaign-storefront.css. The family owns a split photo/text hero, reachable public navigation, image/product/price grids, native FAQs and paper layout. Shared webstore-guide.js only focuses fragment destinations and restores FAQ state after printing. Preserve original terms, full main text, image destinations and SEO JSON-LD data; no business API calls.

Brand guides: fifteen custom-brand pages now use tokens/components + shared `storefront-shell.css` + `pages/css/brand-guide.css`. The shared shell owns public navigation/footer; family CSS owns original content layout. `shared_components/js/storefront-navigation.js` manages native mobile dialog and existing encoded catalogue search. Other storefront consumers retain nwca-2026-core.css.

- `shared_components/css/staff-reference.css` — five staff reference pages, complete printed titles/content and source warnings, with existing shared component headers/buttons/cards.

- Entry/status: `shared_components/css/access-shell.css` + the two scoped login page sheets; `pages/css/order-confirmation.css` owns3-Day Tees/custom-tees/custom-caps confirmation layout without loading builder styles. All use tokens/components and Public Sans.

Catalog discovery: shared `catalog-discovery.css` follows tokens/components/storefront-shell and owns brand/product cards and controls; existing brands.css and fall-catalog-2026.css contain scoped page arrangements. Header navigation controller is now shared_components/js/storefront-navigation.js; original fifteen brand-guide consumers updated without runtime changes.

- shared_components/css/storefront-commerce.css extends storefront-shell for live commerce dropdowns; instant-quote.css/custom-banners.css now scoped to data-instant.

Instant storefront: banner/sticker configurators use scoped instant-quote/custom-banners plus storefront-commerce, existing tokens/components/storefront-shell and Public Sans. Native dialogs and one disclosure owner retain keyboard navigation. Pricing, quote submission and artwork controllers remain source locked; app-modern delegates only the new native menu/disclosure paths. Four widths, all50 sticker prices, seven banner presets, quantity/custom/finishing, visible failed/empty/degraded data, retained draft/artwork and retry, and419 PDF text nodes reviewed. Entire raw CSS graph grows with shared primitives and full paper support; measured budgets track that honestly.

Customer intake: shared_components/css/customer-intake.css owns four scoped page frames, hosted-form geometry and paper destinations; pages/request-a-quote.css owns the native form arrangement on canonical fields/buttons. The three calculators/css/*form sheets and pages/forms/nwca-form-shared.css are retired; the public quote request was the last legacy framework consumer. Vendor form content remains external. Review pending.

Customer intake: public request-a-quote and three hosted staff forms use canonical tokens/components/Public Sans with one scoped customer-intake.css owner; public fields retain their own arrangement. Digitizing follows Ruth purple, monogram follows shop-floor blue, purchasing follows Bradley slate. Four old CSS owners retired after their final consumers migrated. Seven existing controller sources remain unchanged; complete original prose/fields/images/vendor URLs locked.14 focused browser cases,11 original-contract checks, four widths/zero axe, navigation, blocked embeds and keyboard fallback, public validation/prefill/calendar/lookup/upload/save failures and retained draft retry checked with all business writes and hosted content mocked. Four one-page reference PDFs retain74 checked text nodes; vendor form contents stay external and are not printed from the wrapper. Raw CSS graph grows with shared primitives/scoping; no network byte-reduction claim. Full release gates remain.

SanMar vendor wrappers share scoped vendor-portals/css/sanmar-portal-shared.css after tokens/components. The duplicate sanmar-vendor-portal.css is retired. Canonical navigation and Bradley purchasing colors replace duplicated WSU aliases. Caspio controls/data remain external; wrapper scope and state/paper tests pending.

SanMar vendor portal wrappers: three pages use canonical navigation/typography/Bradley purchasing accents and one scoped sanmar-portal-shared.css owner; the duplicate sanmar-vendor-portal.css is retired. Original invoice/credit Caspio app URLs and wrapper content remain unchanged.12 focused browser cases cover four widths, zero wrapper axe, native focus/keyboard scrolling, mocked login/empty/failure states and complete synthetic report printing; three landscape PDFs retain216 checked nodes. All provider writes blocked. Provider-owned UI styling/data remains explicitly separate; the runtime census now recognizes Jotform alongside Caspio and the external-owner backlog names all six reviewed hosted wrappers. Full release gates remain; no raw-CSS byte reduction claim.

Hosted staff tools migration: shared_components/css/hosted-workspace.css now owns five Caspio wrappers (SanMar vendor/invoices/credits and announcement create/manage), using canonical tokens/components. Retired admin/css/announcements-create.css, admin/css/announcements-manage.css and vendor-portals/css/sanmar-portal-shared.css after their final consumers moved. Exact provider URLs and announcement controllers preserved; native skip links, loading labels and permanent hosted fallback added. Five-page review pending.

Hosted staff tools: five Caspio page wrappers (SanMar vendor/invoices/credits, announcement create/manage) share shared_components/css/hosted-workspace.css with canonical tokens/components. Vendor-local and two announcement sheets retired; the earlier duplicate sanmar-vendor-portal.css is also retired. Bradley purchasing and neutral administrative colors follow the ownership rules. Exact provider IDs and both announcement controller sources retained.20 focused browser cases cover four widths/zero wrapper axe, native skip/navigation/scrolling, loading/failure/fallback and synthetic login/form/report/empty boundaries; five landscape reference PDFs retain258 text nodes, every page visually reviewed. Provider-owned controls and data remain separate unfinished work. Seven original source contracts passed; broader inventory guards and full release gates remain. Raw CSS graph grows with scoped shared primitives; no network-byte reduction claim.

Staff access/portal migration in progress: shared_components/css/staff-admin-tools.css replaces dashboards/css/access-admin.css, drive-access.css and portal-directory.css after their final consumers move. Canonical buttons/fields/cards/tables, named keyboard table scrolling and skip links. Three controllers differ only through explicitly recorded presentation-class and heading/pressed-state replacements; permission payloads, drive rights and portal links unchanged. Full state/content/paper review pending; no added reviewed pages.

Staff access and portal tools: dashboards/access-admin.html, dashboards/drive-access.html and dashboards/portal-directory.html share canonical tokens/components and shared_components/css/staff-admin-tools.css. Their three obsolete local CSS owners are retired. Neutral admin/drive and CRM ink preserved.15 focused browser cases cover four widths/zero axe, keyboard views, mocked permissions/save failure/retry/removal confirmation, separate drive rights, denied/malformed data, portal counts/search/sort/clipboard fallback and distinct staff-preview/customer URLs. Three reference PDFs/four pages preserve65 checked text/value nodes, including long wrapping permissions; all visually reviewed. Current-value print mirrors are removed after printing and never change editable data. Original controller hashes restored by reversing only explicit presentation mappings.29 source/hygiene unit checks and290-file CSS lint pass. No actual permission or clipboard writes, business actions or messages. Shared raw CSS graph grows; no byte-reduction claim.

Staff monitoring migration in progress: new shared_components/css/staff-monitoring.css owns layouts for dashboards/api-usage.html,table-usage-audit.html,bandit-integration.html. Their three dashboards/css sheets retired. Shared tokens/components replace art-hub/dash-shell dependencies. Original data/controllers retained pending specific review refinements; no live completion claimed.

Staff monitoring: API Usage,Table Usage Audit and Bandit Integration share tokens/components/Public Sans and shared_components/css/staff-monitoring.css. Their three local sheets are retired. Native keyboard sorting/filtering, named scrolling tables and current-value print mirrors preserve the original163-table evidence and full reference prose. Usage failures stay unknown; malformed/incomplete live schema cannot label tables gone. Local storage failures stay visible with export available, and successful recovery clears the related error.17 mocked browser cases cover all four widths/zero axe, numeric/source states, retry, saved notes and CSV export. Three reference PDFs/nine pages retain213 checked text/value nodes, all visually inspected. Print uses normal block flow so a flex fragment cannot produce a blank trailing sheet; focus outlines remain screen-only. All real business writes and notifications blocked. Measured LF raw CSS per page is70,169bytes, down from162,994–164,472bytes (about57%); these are source bytes, not compressed network transfer.

Staff import tools in progress: dashboards/sanmar-ftp-integration.html and dashboards/sanmar-shopworks-converter.html use shared_components/css/staff-import-tools.css with tokens/components. Their two dashboards/css/*.css owners are retired after their final consumers moved. Pure conversion/SKU helpers and converter controller retained; FTP changes are explicitly recorded presentation/loading/response-validation hooks. Browser/source review pending; no new reviewed/live count.

Staff file tools: SanMar Downloads and SanMar → ShopWorks Parts share tokens/components/Public Sans and shared_components/css/staff-import-tools.css; two local sheets retired. Canonical buttons/data tables, native named file input, skip links and focused scrolling regions retain all original prose/IDs/dependencies and source-locked financial/SKU transforms. Malformed FTP listings and missing converter libraries report visible failures with retry/file retention.17 mocked browser cases cover four widths/zero axe, exact synthetic FTP download query/bytes, CSV/TSV/XLSX conversion, errors and recovery. Two one-page portrait PDFs retain70 checked content/data blocks, visually reviewed; print hides only action controls and their empty download column. All real business writes/imports/uploads/emails blocked. A tiny temporary loopback server serves only synthetic CSV because browser-managed attachments bypass page routing; request assertions observe that server and compare actual downloaded bytes.

Purchasing migration in progress: dashboards/purchasing-portal.html and dashboards/sanmar-payables.html plus their two tests/ui/test-… harnesses now load purchasing-workspaces.css and canonical components. Retired dashboards/css/purchasing-portal.css and dashboards/css/sanmar-payables.css after all four consumers moved. The shared legacy sanmar-invoice-viewer.css remains for its three production consumers while the separate invoice-viewer review proceeds. Source tests and browser review pending; these two pages are not yet in the reviewed manifest.

Invoice viewer opt-in: Purchasing/Payables and their two harnesses now load vendor-invoice.css with a native dialog; AE Mission Control and its harness retain legacy sanmar-invoice-viewer.css. All six HTML consumers use one shared controller cache version. Invoice rendering/money functions remain unchanged; documented changes decorate tables, manage focus/request lifetime and preserve failed-PO notes on paper. Verification pending.

Purchasing Portal and SanMar Payables reviewed: shared purchasing-workspaces.css and opt-in vendor-invoice.css use canonical tokens, controls, data tables, named file input and native invoice dialog. Bradley slate and existing payables ownership retained. Two old page sheets retired across production/harness HTML; AE keeps its legacy invoice CSS with the same updated controller version.24 mocked browser cases cover four widths/zero axe, keyboard/focus, source filters, exact CSV values, mock-only import confirmation/cancellation/failure, visible unknown balances and optional feed recovery, concurrent lookup protection and legacy AE compatibility. Four one-page PDFs preserve176 checked reading/data/current-field blocks; invoice columns, totals and failed PO notes verified together. Original five controller/helper hashes reverse through50 documented UI/load-validation edits; money/CSV calculations unchanged. The AE page and other generated-document families receive no review credit.
In progress: shared_components/css/photo-workspaces.css — shared finished-photo capture/library arrangements. Original page owners remain until all consumers migrate and browser checks pass.

Photo implementation in progress: capture/library and their library harness now load tokens/components/photo-workspaces.css with Public Sans, canonical controls, visible native camera/album inputs and shared UiDialog focus/inert/scroll handling. Original photo upload, compression, customer visibility and API helpers remain unchanged outside documented presentation/dialog edits. Retired dashboards/css/finished-photos.css and dashboards/css/finished-photos-library.css after all three consumers moved; former poster references were already retired. Digitized/old-design pages remain at originals. New family review still pending; no extra reviewed/live credit.

Reviewed photo family: shared_components/css/photo-workspaces.css owns capture/library arrangements across dashboards/finished-photos.html, dashboards/finished-photos-library.html and tests/ui/test-finished-photos-library.html. Two old photo sheets retired.22 mocked browser checks cover four widths/zero axe, native camera/album fields, exact synthetic JPEG resizing/upload metadata, customer/rep filters, errors remaining visible through filtering, publish/delete confirmation failures and delayed customer/image responses.28 printed content blocks retained across three pages/two PDFs.46 explicit controller edits reverse to eight original controller/helper hashes; image compression, URL resolution and API payload structure preserved. The library graph falls from164,116 to68587LFbytes; capture grows from34,293 to the same shared graph because it now loads canonical components. This is a maintenance/consistency gain on capture, not a per-page byte reduction. Caspio design pages remain original and unreviewed.
