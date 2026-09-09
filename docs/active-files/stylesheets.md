# 🎨 Stylesheets

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
| `/shared_components/css/golf-tournament-showcase.css` | **NEW** Golf tournament landing page styles (golf theme — fairway greens, sand accents, gold offer ribbon) | golf-tournaments-2026.html, golf-tournament-product.html | ✅ Active |
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

- `shared_components/css/printable-forms.css`: scoped shared printable-form layout, controls, lookup/swatch states, phone table regions and paper rules for 17 `/pages/forms/` consumers. Their page sheets retain unique layouts/orientation. Old `nwca-form-shared.css` remains for public `pages/request-a-quote.html`; it is not retired.

- `shared_components/css/training-practice.css`: scoped practice layouts and feedback for seven games/reference pages; shared controls remain in components.css. Replaces the last training-shared.css consumers and their duplicated page controls.

- `shared_components/css/training-reference.css` — reference reading/nav/steps/contact/checklist pattern; four explicitly opted-in training pages.


- `shared_components/css/training-manual.css` — shared manual contents, reading layout and print contract.

- `/shared_components/css/training-simulator.css` — shared scoreboards, exercise options, feedback and native dialogs; Training Center and both ShopWorks simulations keep their arrangements in their scoped training sheets.

API reference family: Caspio, ManageOrders, SanMar and ShopWorks ODBC load tokens → components → api-reference → page arrangements. Shared reference CSS owns page chrome, labeled search, count/status, endpoint/field tables, callouts, mobile wrapping and paper rhythm. Keep technical catalogs in page controllers/data; original-content and schema guards prevent accidental edits. Native ODBC details and failed/malformed catalogue retry remain page behavior.

Policy guides/notices: shared components own page chrome, fields/buttons, cards and visibility. policy-migration.css and pricing-negotiation-policy.css own domain arrangements; simple-notice-page.css is shared by Resources/Sale. These four opt in with data-guidance. Preserve historical policy figures and the migration snapshot. Bootstrap and art-hub/dash-shell dependencies are removed from this family.
