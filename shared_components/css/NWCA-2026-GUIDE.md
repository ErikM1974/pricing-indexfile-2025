# NWCA 2026 Design System — Interior-Page Class Reference

## Unified component pilots (2026-09-08)

For new staff pages, start with `templates/page-template.html`. The living examples are
`dashboards/brand-standards.html#components`. The first migrated consumers are Brand Standards,
Design Queue, Art Billing & File Reference and Company Store Inquiry.

- Load `tokens.css`, then `components.css`, optional `utilities.css`, then the page stylesheet.
- Put `data-ui="unified"`, `data-surface="staff|storefront"`, `data-department="brand|steve|ruth|bradley|floor|ae"`
  and `data-density="comfortable|compact"` on the body. Public Sans is loaded by the page; customer headings may use Bricolage.
- Numeric space/radius/type/shadow tokens never change by page. Density changes only `--ui-panel-space` and `--ui-row-space`.
- Components use `components.primitives` and `components.patterns`; unique page arrangements use `components.pages`.
  Every selector is scoped to the opted-in body. The utilities layer owns `[hidden]`; migrated pages need no important flag.
- Shared vocabulary: `btn`, `btn-primary`, `btn-ghost`, `btn-danger`; `field`, `field-label`, `field-input/select/textarea`,
  `field-help/msg`, `choice`; `card`, `card-title`; `alert-info/success/warn/error`; `badge-ok/warn/bad`;
  `table-wrap`, `data-table`; native `dialog.ui-dialog` and `dialog-actions`.
- Use native disabled controls. Label fields and errors. A scrollable table needs a named focusable region.
  Use native dialog.showModal()/close() and restore opener focus; the reference demonstrates Escape and confirmation.
- Temporary Design Queue `dash-*` / `dq-*` and public-form/date selectors adapt existing behavior hooks to these same rules.
  Remove adapters as siblings adopt canonical presentation classes; never copy the visual rules into another page file.
- Add each migrated consumer, styles, fixtures and byte budget to `scripts/css/migration-manifest.json`.
  Unit guards reject unresolved tokens, important declarations, CSS IDs, global-scale shadows and changed billing content.
  Browser fixtures exercise states without contacting production business endpoints.

The rest of this guide describes the existing storefront entry point. Its consumers remain on that entry point until their family migrates.
Do not link both shared entry points onto an existing storefront page; replace competing ownership under state tests.

Quick reference for the primitives in `nwca-2026-core.css` (layer 7). Build interior pages from these without reading the CSS.

**Load order (required):**

```html
<link rel="stylesheet" href="/shared_components/css/nwca-2026-core.css?v=YYYY.MM.DD.N">
<!-- page-layer CSS after core; homepage uses nwca-2026.css -->
```

Core ships: tokens/base, `.btn*`/`.chip-btn`/`.flag-new`, masthead + mega-nav, drawer, footer, and everything below. `nwca-2026.css` is **homepage-only** (hero, bands, catalog results, quick-view/compare).

**Color rules:** `--ink-faint` is decorative/disabled ONLY (fails AA). Meaningful small text = `--ink-soft`. Small white-on-orange = `--rush-deep` ground (never `--rush`).

---

## Page header band

Breadcrumb + title + optional subtitle + optional right-side action slot.

```html
<header class="page-head">
  <div class="wrap">
    <nav class="crumbs" aria-label="Breadcrumb">
      <a href="/">Home</a><span class="crumbs-sep">/</span>
      <a href="/pages/services.html">Services</a><span class="crumbs-sep">/</span>
      <span aria-current="page">Contract Embroidery</span>
    </nav>
    <div class="page-head-row">
      <div>
        <h1 class="page-title">Contract Embroidery Pricing</h1>
        <p class="page-sub">2026 tier pricing for garments and caps.</p>
      </div>
      <div class="page-actions"><a class="btn btn-primary" href="#">Get a Quote</a></div>
    </div>
  </div>
</header>
```

## Forms

44px touch height. States go on the `.field` wrapper: `is-error` / `is-success`.

```html
<fieldset class="form-fieldset">
  <legend class="form-legend">Contact</legend>
  <div class="form-row"><!-- 2-col, stacks ≤768px -->
    <div class="field is-error">
      <label class="field-label" for="em">Email <span class="req">*</span></label>
      <input class="field-input" id="em" type="email" aria-describedby="em-msg">
      <p class="field-msg" id="em-msg">Enter a valid email address.</p>
    </div>
    <div class="field">
      <label class="field-label" for="dm">Decoration</label>
      <select class="field-select" id="dm"><option>Embroidery</option></select>
      <p class="field-help">Caps and garments tier separately.</p>
    </div>
  </div>
  <div class="field">
    <label class="field-label" for="nt">Notes</label>
    <textarea class="field-textarea" id="nt"></textarea>
  </div>
  <div class="field">
    <label class="field-label" for="po">Style #</label>
    <div class="input-combo">
      <input class="field-input" id="po" placeholder="PC54">
      <button class="btn btn-primary" type="button">Look up</button>
    </div>
  </div>
</fieldset>
```

## Data / pricing tables

Always wrap in `.table-wrap` (≤768px collapse = horizontal scroll — never shrink the font). Right-align numbers with `.num`.

```html
<div class="table-wrap">
  <table class="data-table">
    <thead><tr><th>Style</th><th>Description</th><th class="num">Price</th></tr></thead>
    <tbody><tr><td>PC54</td><td>Core Cotton Tee</td><td class="num">$8.50</td></tr></tbody>
  </table>
</div>
```

**Tier-price variant** — qty tiers as columns; add `.is-active-tier` to the active tier's `th` and `td`s:

```html
<div class="table-wrap">
  <table class="data-table tier-table">
    <thead><tr><th>Item</th><th>8–23</th><th class="is-active-tier">24–47</th><th>48–71</th><th>72+</th></tr></thead>
    <tbody><tr><td>Left chest</td><td>$14.00</td><td class="is-active-tier">$12.50</td><td>$11.00</td><td>$10.00</td></tr></tbody>
  </table>
</div>
```

## Alert banners

`.alert` + one of `alert-info` / `alert-success` / `alert-warn` / `alert-error`. Icon slot + optional dismiss. **`.alert-error` with `role="alert"` is the standard for visible API failures (Erik's #1 rule — never silently fall back to stale pricing).**

```html
<div class="alert alert-error" role="alert">
  <svg class="alert-icon" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path d="M10 1 1 18h18L10 1zm1 13h-2v2h2v-2zm0-7h-2v5h2V7z"/></svg>
  <div class="alert-body">
    <strong class="alert-title">Unable to load pricing</strong>
    <p>Live pricing is unavailable right now. Please refresh — do not quote from memory.</p>
  </div>
  <button class="alert-dismiss" type="button" aria-label="Dismiss">&times;</button>
</div>
```

## Toasts

Fixed bottom-right stack (z 290, above modals). JS appends/removes `.toast`; entrance animation is reduced-motion safe (global kill). Use `aria-live="polite"` on the stack.

```html
<div class="toast-stack" aria-live="polite">
  <div class="toast toast-success">
    <svg class="toast-icon" width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M6.5 11.2 3.3 8l-1 1 4.2 4.2 7.2-7.2-1-1z"/></svg>
    Quote saved.
    <button class="toast-dismiss" type="button" aria-label="Dismiss">&times;</button>
  </div>
</div>
```

Variants: default (ink-green), `.toast-success` (green check icon), `.toast-warn`, `.toast-error`.

## Badges / status chips

Static cousin of `.chip-btn` (which stays for interactive chips). `.badge-dot` adds a status dot.

```html
<span class="badge badge-ok badge-dot">In stock</span>
<span class="badge badge-warn">Low stock</span>
<span class="badge badge-bad">Out of stock</span>
<span class="badge badge-rush">Rush</span>
<span class="badge badge-ink">Staff</span>
```

## Pagination

`.pager-btn` works on `<a>` and `<button>`; mark the current page `is-current` + `aria-current="page"`.

```html
<nav class="pager" aria-label="Pagination">
  <button class="pager-btn" disabled>&larr; Prev</button>
  <a class="pager-btn is-current" href="?p=1" aria-current="page">1</a>
  <a class="pager-btn" href="?p=2">2</a>
  <span class="pager-gap">…</span>
  <a class="pager-btn" href="?p=9">9</a>
  <a class="pager-btn" href="?p=2">Next &rarr;</a>
</nav>
```

## Skeleton loading

Shimmer blocks while data loads (frozen under reduced motion). Compose sizes: `skeleton-text`, `skeleton-title`, `skeleton-block`, `skeleton-circle`, or size inline via your page CSS.

```html
<div class="card" aria-busy="true">
  <div class="skeleton skeleton-title"></div>
  <div class="skeleton skeleton-text"></div>
  <div class="skeleton skeleton-block"></div>
</div>
```

## Card grid

```html
<div class="card-grid">
  <div class="card">
    <h3 class="card-title">Left Chest Logo</h3>
    <p class="card-sub">Up to 8,000 stitches included.</p>
  </div>
</div>
```

## Modal base

Generic modal (the homepage quick-view/compare keep their own classes; `.modal-close` is shared from core). Toggle with `[hidden]`. `.modal-wide` = 940px.

```html
<div class="modal" role="dialog" aria-modal="true" aria-labelledby="m1-title" hidden>
  <div class="modal-content">
    <div class="modal-header">
      <h2 id="m1-title">Confirm order</h2>
      <button class="modal-close" type="button" aria-label="Close">&times;</button>
    </div>
    <div class="modal-body">…</div>
    <div class="modal-footer">
      <button class="btn btn-ghost" type="button">Cancel</button>
      <button class="btn btn-primary" type="button">Confirm</button>
    </div>
  </div>
</div>
```

## Empty state

```html
<div class="empty-state">
  <div class="empty-state-icon" aria-hidden="true">🧵</div>
  <h3 class="empty-state-title">No saved quotes yet</h3>
  <p class="empty-state-sub">Build a quote and it will show up here for easy reordering.</p>
  <a class="btn btn-primary" href="/quote-builders/embroidery-quote-builder.html">Start a quote</a>
</div>
```

---

## Tokens you'll actually use

`--paper` `--paper-deep` `--card` · `--ink` `--ink-soft` (`--ink-faint` decorative only) · `--green-950/900/700/600/100/50` · `--rush` `--rush-deep` `--rush-deeper` `--rush-soft` · `--ok` `--warn(-soft)` `--bad(-soft)` · `--radius` `--radius-sm` · `--shadow-card` `--shadow-pop` · `--font-display` `--font-body` · `--wrap` (1240px, via `.wrap`)

Breakpoints: 1100 / 960 (drawer nav) / **768 (primitives collapse: form-row, page-head-row, table density, toast full-width)** / 560. Z-index map: nav 90, compare-bar 220, drawer 230–245, modals 260, **toasts 290**, skip-link 300.

## Staff workspace adapters (2026-09-08)

Design Vault and Gear Publisher use components.css as their only common control/shell owner. Existing dash-btn, gp-field, gp-check and gp-binding-table hooks temporarily share the canonical button/field/choice/table implementations. New markup should use the canonical classes. Keep dg-* artwork/windowing and gp-* photo-binding arrangement in their scoped page files.

The toast service now supplies .nwca-toast-container as well as its existing ID. Migrated pages use the scoped toast pattern in components.css and omit toast-notifications.css; unmigrated consumers continue loading that sheet. No browser stylesheet injection is added.

Drawers need a nonshrinking content flow inside an independently scrollable body. Nested overlays consume Escape once, trap focus at the active level and return focus to a visible connected trigger. Windowed galleries use viewport screenshots; a full-page capture cannot represent unmounted rows. Publisher review fixtures mock the complete service path, including XHR photo uploads, job polling and publish responses.

## Transfer workflow owners (2026-09-08)

The five Bradley pages use tokens.css → components.css → bradley-transfers.css, plus only their page layout and transfer-workflow.css when they expose the sender. Art Hub is no longer an owner for these pages. Status colors stay distinct from the department accent. Buttons, fields, navigation, toasts and image previews live in components.css; transfer/order layouts and screenshot patterns live in the Bradley family owner.

Load ui-dialog.js before controllers for existing custom overlay markup. Call UiDialog.open(host, { focus, onDismiss }) and UiDialog.close(host); the helper owns focus trapping, Escape, background inert state and scroll/focus restoration. Keep business state cleanup in onDismiss. New dialogs may continue to use the native dialog API demonstrated in Brand Standards.

The sender and thumbnail helpers opt in to hidden state only on migrated bodies. Legacy Steve/art-detail and three builder thumbnail callers retain their current display behavior until their family migrates. transfer-actions.css remains for those old consumers. Its two dynamic badge colors are documented manifest exceptions; all fixed styling lives in the owning sheet.

## Art workflow owners (2026-09-08)

Ruth uses tokens.css → components.css → art-workflow.css → art-hub-ruth.css. The shared art owner covers status filters, artwork cards, boards, elapsed/audit badges and file recovery. Existing business hooks carry canonical btn/field-input classes. Page-specific search and billing arrangement remain in Ruth’s sheet. Saved Mockups uses tokens → components → its page sheet and UiDialog for image preview. Art Hub, mockup-ruth.css, kanban.css and elapsed-time-utils.css remain for other consumers until their coordinated migration.

Keep board search/status filters aligned with the grid and paused work in the On Hold tab. Give a horizontally scrolling board an accessible name and keyboard focus. Recovery overlays use UiDialog; after a refresh replaces the opening button, return focus to its new element or the Queue tab. A failed request must not show success or leave stale results in another tab. Source-byte budgets measure committed LF source, independent of checkout line endings.

### Steve, AE and art-detail ownership

The four consumers load tokens and components first, then the small art-theme.css owner for scoped semantic aliases, input sizing and elapsed badges. art-workflow.css supplies queue/board controls to Steve and AE; art-actions.css supplies their shared notes/time/sender dialogs and Art Request Detail's sender. Mockup Detail uses its own dialog markup and does not load art-actions. The two detail pages share art-detail.css, and AE's four request types share art-intake.css. Each page keeps only its own arrangement and business-specific states.

Use stable page classes for scoping; customer mode changes data-surface and department accents at runtime. Do not scope a page's layout to a staff department value. Thread Color Picker uses native buttons, a named dialog, Escape and focus restoration; its mockup styling is owned by mockup-detail.css, while the older generator retains thread-color-picker.css. Thread swatches remain actual palette colors.

The ownership test resolves variables from each consuming page's complete style graph. JavaScript-generated transfer badge colors remain explicit dynamic variables. Exactly four Art Request Detail important declarations are locked by selector/property/value: customer staff-control visibility plus the three staff-print rules. These are verified with customer/staff print fixtures; they are not a general important allowance.

### Training documents

`training-guide.css` owns opt-in training navigation, document spacing, callouts, scrollable reference tables and print rules. The three initial page sheets retain only their lead examples/accordion, embroidery grouping examples and language-reference columns. Use the shared Public Sans staff surface. Keep wide tables in keyboard-focusable scroll regions and use native buttons for disclosure/copy. Printed guides show all accordion content; the language handout uses two readable landscape pages without fixed-height clipping. Never copy a generic `.card` adapter into a document section; use the owned training section. Legacy training-shared.css is retired now that its last seven consumers use the practice owner.

Service training guides add `training-service.css` after `training-guide.css`. It owns disclosures, examples, image states and print groups. Page sheets own only handwritten thank-you specimens and the practice lead grid; fields opt into `.field-input` / `.field-textarea`. `training-guide.js` owns scoped disclosure/navigation/image behavior.

Printable twins opt in with `data-form="printable"` and load components → printable-forms → their page sheet. Shared form selectors stay within that scope. Paper geometry has its own media rules; `components.print` owns only the three screen-control visibility rules, replacing important flags. Public request-a-quote remains on its legacy owner pending separate review.

Training practice pages opt in with data-training="practice". training-practice.css owns exercise layouts and feedback, while small page sheets own matching columns, source scenarios, template previews and the training directory. Native buttons/fields reuse components.css; do not add game-specific control primitives. training-practice.js provides one scoped selection/status and delegated-argument interface. Content/fixture preservation and complete keyboard/touch/error/print workflows are release gates.


Training reference pages opt in with data-training="reference". training-reference.css owns reference navigation, procedure/contacts/checklists and paper rhythm; components/training-guide remain the control/table/callout owners. Page CSS owns caps, tip articles and shipping/purchasing examples.


Training manuals: tokens → components → training-guide → training-reference → training-manual → page arrangement. data-training-manual identifies this family; data-manual-mode=chapters hides other sections on screen. Mobile contents use native details, biography uses native buttons, and printing temporarily opens complete content then restores it. Keep generic card classes out of long document sections. Original prose, destinations, media, employee and exercise data have source guards.

### Training Center and simulators

The final four training pages share tokens, components, training-practice and training-simulator. Page owners contain layout only; native buttons/dialogs, named fields, current-round scoring, timer cancellation and visible progress failures stay in the page controllers. Static course data remains unchanged and locked. CSS uses no ID selectors or new important exceptions.

API reference family: Caspio, ManageOrders, SanMar and ShopWorks ODBC load tokens → components → api-reference → page arrangements. Shared reference CSS owns page chrome, labeled search, count/status, endpoint/field tables, callouts, mobile wrapping and paper rhythm. Keep technical catalogs in page controllers/data; original-content and schema guards prevent accidental edits. Native ODBC details and failed/malformed catalogue retry remain page behavior.

Policy guides/notices: shared components own page chrome, fields/buttons, cards and visibility. policy-migration.css and pricing-negotiation-policy.css own domain arrangements; simple-notice-page.css is shared by Resources/Sale. These four opt in with data-guidance. Preserve historical policy figures and the migration snapshot. Bootstrap and art-hub/dash-shell dependencies are removed from this family.

### Policies, handbook and questions

The four policy pages load tokens, shared components, then pages/css/policy-workspace.css. Policy Detail adds policy-detail.css and org-chart-2026.css; Handbook adds handbook.css. Each owns its responsive domain layout and one print layer. The prior policies-hub-v2.css path is retired. Shared policy-workspace.js owns contents disclosure, read-only table scrolling and control classes, excluding editor-owned DOM. Use Public Sans and neutral/forest tokens. Keep all chapter links reachable on phones, preserve existing editing behavior and exclude edit controls from paper.

## Public webstore family — 2026-09-08

The twelve public webstore marketing pages share tokens/components/Public Sans and the rebuilt pages/css/company-webstores.css. They no longer borrow campaign-storefront.css. The family owns a split photo/text hero, reachable public navigation, image/product/price grids, native FAQs and paper layout. Shared webstore-guide.js only focuses fragment destinations and restores FAQ state after printing. Preserve original terms, full main text, image destinations and SEO JSON-LD data; no business API calls.

Brand guides: fifteen custom-brand pages now use tokens/components + shared `storefront-shell.css` + `pages/css/brand-guide.css`. The shared shell owns public navigation/footer; family CSS owns original content layout. `shared_components/js/storefront-navigation.js` manages native mobile dialog and existing encoded catalogue search. Other storefront consumers retain nwca-2026-core.css.

Staff references load tokens -> components -> staff-reference.css -> scoped page arrangements. Headers, buttons, cards and table primitives use existing shared components; staff-reference owns paper and source-warning presentation.

- Entry/status: `shared_components/css/access-shell.css` + the two scoped login page sheets; `pages/css/order-confirmation.css` owns3-Day Tees/custom-tees/custom-caps confirmation layout without loading builder styles. All use tokens/components and Public Sans.

Catalog discovery: shared `catalog-discovery.css` follows tokens/components/storefront-shell and owns brand/product cards and controls; existing brands.css and fall-catalog-2026.css contain scoped page arrangements. Header navigation controller is now shared_components/js/storefront-navigation.js; original fifteen brand-guide consumers updated without runtime changes.

Instant configurators share storefront-shell/commerce navigation, canonical components and scoped instant-quote arrangements. Preserve server prices and full rate cards.

Instant storefront: banner/sticker configurators use scoped instant-quote/custom-banners plus storefront-commerce, existing tokens/components/storefront-shell and Public Sans. Native dialogs and one disclosure owner retain keyboard navigation. Pricing, quote submission and artwork controllers remain source locked; app-modern delegates only the new native menu/disclosure paths. Four widths, all50 sticker prices, seven banner presets, quantity/custom/finishing, visible failed/empty/degraded data, retained draft/artwork and retry, and419 PDF text nodes reviewed. Entire raw CSS graph grows with shared primitives and full paper support; measured budgets track that honestly.

Customer intake: public request-a-quote and three hosted staff forms use canonical tokens/components/Public Sans with one scoped customer-intake.css owner; public fields retain their own arrangement. Digitizing follows Ruth purple, monogram follows shop-floor blue, purchasing follows Bradley slate. Four old CSS owners retired after their final consumers migrated. Seven existing controller sources remain unchanged; complete original prose/fields/images/vendor URLs locked.14 focused browser cases,11 original-contract checks, four widths/zero axe, navigation, blocked embeds and keyboard fallback, public validation/prefill/calendar/lookup/upload/save failures and retained draft retry checked with all business writes and hosted content mocked. Four one-page reference PDFs retain74 checked text nodes; vendor form contents stay external and are not printed from the wrapper. Raw CSS graph grows with shared primitives/scoping; no network byte-reduction claim. Full release gates remain.

SanMar vendor portal wrappers: three pages use canonical navigation/typography/Bradley purchasing accents and one scoped sanmar-portal-shared.css owner; the duplicate sanmar-vendor-portal.css is retired. Original invoice/credit Caspio app URLs and wrapper content remain unchanged.12 focused browser cases cover four widths, zero wrapper axe, native focus/keyboard scrolling, mocked login/empty/failure states and complete synthetic report printing; three landscape PDFs retain216 checked nodes. All provider writes blocked. Provider-owned UI styling/data remains explicitly separate; the runtime census now recognizes Jotform alongside Caspio and the external-owner backlog names all six reviewed hosted wrappers. Full release gates remain; no raw-CSS byte reduction claim.

Hosted staff tools: five Caspio page wrappers (SanMar vendor/invoices/credits, announcement create/manage) share shared_components/css/hosted-workspace.css with canonical tokens/components. Vendor-local and two announcement sheets retired; the earlier duplicate sanmar-vendor-portal.css is also retired. Bradley purchasing and neutral administrative colors follow the ownership rules. Exact provider IDs and both announcement controller sources retained.20 focused browser cases cover four widths/zero wrapper axe, native skip/navigation/scrolling, loading/failure/fallback and synthetic login/form/report/empty boundaries; five landscape reference PDFs retain258 text nodes, every page visually reviewed. Provider-owned controls and data remain separate unfinished work. Seven original source contracts passed; broader inventory guards and full release gates remain. Raw CSS graph grows with scoped shared primitives; no network-byte reduction claim.

Staff access and portal tools: dashboards/access-admin.html, dashboards/drive-access.html and dashboards/portal-directory.html share canonical tokens/components and shared_components/css/staff-admin-tools.css. Their three obsolete local CSS owners are retired. Neutral admin/drive and CRM ink preserved.15 focused browser cases cover four widths/zero axe, keyboard views, mocked permissions/save failure/retry/removal confirmation, separate drive rights, denied/malformed data, portal counts/search/sort/clipboard fallback and distinct staff-preview/customer URLs. Three reference PDFs/four pages preserve65 checked text/value nodes, including long wrapping permissions; all visually reviewed. Current-value print mirrors are removed after printing and never change editable data. Original controller hashes restored by reversing only explicit presentation mappings.29 source/hygiene unit checks and290-file CSS lint pass. No actual permission or clipboard writes, business actions or messages. Shared raw CSS graph grows; no byte-reduction claim.

Staff monitoring: API Usage,Table Usage Audit and Bandit Integration share tokens/components/Public Sans and shared_components/css/staff-monitoring.css. Their three local sheets are retired. Native keyboard sorting/filtering, named scrolling tables and current-value print mirrors preserve the original163-table evidence and full reference prose. Usage failures stay unknown; malformed/incomplete live schema cannot label tables gone. Local storage failures stay visible with export available, and successful recovery clears the related error.17 mocked browser cases cover all four widths/zero axe, numeric/source states, retry, saved notes and CSV export. Three reference PDFs/nine pages retain213 checked text/value nodes, all visually inspected. Print uses normal block flow so a flex fragment cannot produce a blank trailing sheet; focus outlines remain screen-only. All real business writes and notifications blocked. Measured LF raw CSS per page is70,169bytes, down from162,994–164,472bytes (about57%); these are source bytes, not compressed network transfer.

Staff file tools: SanMar Downloads and SanMar → ShopWorks Parts share tokens/components/Public Sans and shared_components/css/staff-import-tools.css; two local sheets retired. Canonical buttons/data tables, native named file input, skip links and focused scrolling regions retain all original prose/IDs/dependencies and source-locked financial/SKU transforms. Malformed FTP listings and missing converter libraries report visible failures with retry/file retention.17 mocked browser cases cover four widths/zero axe, exact synthetic FTP download query/bytes, CSV/TSV/XLSX conversion, errors and recovery. Two one-page portrait PDFs retain70 checked content/data blocks, visually reviewed; print hides only action controls and their empty download column. All real business writes/imports/uploads/emails blocked. A tiny temporary loopback server serves only synthetic CSV because browser-managed attachments bypass page routing; request assertions observe that server and compare actual downloaded bytes.

Purchasing Portal and SanMar Payables reviewed: shared purchasing-workspaces.css and opt-in vendor-invoice.css use canonical tokens, controls, data tables, named file input and native invoice dialog. Bradley slate and existing payables ownership retained. Two old page sheets retired across production/harness HTML; AE keeps its legacy invoice CSS with the same updated controller version.24 mocked browser cases cover four widths/zero axe, keyboard/focus, source filters, exact CSV values, mock-only import confirmation/cancellation/failure, visible unknown balances and optional feed recovery, concurrent lookup protection and legacy AE compatibility. Four one-page PDFs preserve176 checked reading/data/current-field blocks; invoice columns, totals and failed PO notes verified together. Original five controller/helper hashes reverse through50 documented UI/load-validation edits; money/CSV calculations unchanged. The AE page and other generated-document families receive no review credit.

Reviewed photo family: shared_components/css/photo-workspaces.css owns capture/library arrangements across dashboards/finished-photos.html, dashboards/finished-photos-library.html and tests/ui/test-finished-photos-library.html. Two old photo sheets retired.22 mocked browser checks cover four widths/zero axe, native camera/album fields, exact synthetic JPEG resizing/upload metadata, customer/rep filters, errors remaining visible through filtering, publish/delete confirmation failures and delayed customer/image responses.28 printed content blocks retained across three pages/two PDFs.46 explicit controller edits reverse to eight original controller/helper hashes; image compression, URL resolution and API payload structure preserved. The library graph falls from164,116 to68587LFbytes; capture grows from34,293 to the same shared graph because it now loads canonical components. This is a maintenance/consistency gain on capture, not a per-page byte reduction. Caspio design pages remain original and unreviewed.

Design libraries: actual read-only Caspio searches verified 24 provider records per page and exposed a nested source dl plus generated mobile hiding rules. Shared adapter currently inventories 77 exact important declarations (275 in the two retired sheets); ordinary local app owner uses zero. Existing four art-detail exceptions stay exact. Tests use synthetic nested markup and provider-like unlayered styles. Complete visual/print and full release gates before review/live credit. Both new graphs 73748LFbytes: original digitized34,811/archive61,697; maintenance consistency grows these payloads and is not claimed as a per-page byte reduction.

Reviewed design libraries: dashboards/digitized-designs.html and dashboards/old-designs.html load tokens/components/design-libraries.css plus the explicitly inventoried design-library-provider.css. The helper shared_components/js/design-library-ui.js preserves provider field names and submit handlers, adapts nested mobile form/results and hides only cloned source definitions. Neutral reference/amber archive retained. Fifteen focused browser cases cover four widths, zero fixture axe violations, complete five-tier AL and full-back prices, visible reference fallback, dialogs/keyboard, exact clipboard values, failed/empty/recovered search and replacement forms. Two PDFs/three pages retain39visible text/current-filter blocks. Six suites/220source/CSS checks and286CSSfiles clean.31recorded controller UI edits reverse to six original hashes. Actual read-only Caspio queries returned24records per page without business writes; private actual data is not in Git. Two old sheets retire275flags;77exact provider exceptions remain, ordinary app owner zero. Both CSS graphs74123LFbytes versus34,811/61,697: consistency/maintenance gain with larger payloads, not a byte-reduction claim. Original hidden/focus/typed-button tests now follow shared owners and always-visible actions. Initial strict-locator, incomplete mock select tags and print-context exception matching errors were corrected.

Preview tool ownership: pages/design-view.html and pages/jds-mockup-creator.html load tokens/components/design-preview-tools.css; pages/dst-viewer.html loads tokens/components/embroidery-studio.css. All three old page CSS files retired (seven flags removed; new owners zero). Shared app type/control/focus, local dark instrument and oxblood identities. Five PNG exports verified byte-identical to originals; approval text retained. Three original CSS graphs grow to shared component ownership: pages/design-view.html 25016→72122LFbytes; pages/dst-viewer.html 47479→102971LFbytes; pages/jds-mockup-creator.html 38748→72122LFbytes. Payload reduction is not claimed. Focused browser/source/print review continues before release credit.

Reviewed preview tools: pages/design-view.html, pages/dst-viewer.html and pages/jds-mockup-creator.html now share canonical UI controls/type/focus and two scoped layout owners. Native file inputs stay visible. Gallery excludes internal fields and reports failed/malformed/image states; DST keeps its dark instrument role, accessible thread dialog, keyboard stats and fitted resize behavior; tumbler retains oxblood identity with latest-image protection and retryable failures. Sixteen focused browser cases pass at1440/768/390/320 with zero fixture axe findings. Eight suites/748source/CSS/historical guards pass. Eight original script hashes preserved outside38 mapped UI edits. Five actual downloads match original bytes and filenames: DST1166×662stitchout/1410×1600garment; JDS1840×1980framed/1800×1800bare/1708×1178comparison. Two reviewed PDFs each one page retain all original text words; gallery shrank from two pages. Original approval fonts remain an output boundary. No real business writes/uploads/messages. Three old sheets/seven important flags removed; new owners zero. Existing historical gallery guards follow its new owner and semantically inspect hidden dialog attributes. Zero-size ResizeObserver callbacks while printing and print-rule order are regression-covered. LESSONS_LEARNED now254lines;15 already-archived short references moved to the archive before adding the preview lesson. CSS byte budgets measured honestly: shared ownership increases these three graphs.

Product detail draft evidence registered: tests/fixtures/product-detail-original-content.json (seven original script hashes reversed through32mapped UI edits), tests/fixtures/product-detail-review-data.json (synthetic records), tests/unit/product-detail-content.test.js and tests/e2e/css-unification-product-detail-tools.spec.js. Three pages use shared product-detail-tools.css; three old sheets retired. Discovery retains11style destinations; inventory API/renderer helpers unchanged. Confirmed backend src/routes/inventory.js returns source sanmar-bulk with sizes and placeholder zero totals: UI now labels warehouse availability unavailable. Failed/partial audit does not label unavailable SanMar results as clean or orphans. Four copied table outputs stay unchanged. Browser/source/print review pending; no live credit. Graphs 42911→75201LFbytes, 44431→75201LFbytes, 21628→75201LFbytes.

Reviewed product detail tools: DTG-compatible products, inventory details and SanMar catalog-color audit share canonical typography, controls, stock/audit tables and one scoped page owner. Four old stylesheets/five important declarations retired; new owner zero.22focused browser cases pass at1440/768/390/320 with zero fixture axe findings; eight source/CSS/legacy suites238checks pass and282CSS files lint clean in the isolated tree. Seven original script hashes preserved outside33mapped changes (including one obsolete header comment). All11style destinations, warehouse quantities/stock thresholds and four exact clipboard strings retained. Inventory missing configuration and catalog-size placeholder quantities are handled explicitly; unknown stock stays unknown. Malformed/partial/empty/retry, delayed color/search responses and denied clipboard covered. Three PDF outputs/six pages/610extracted words preserve all original data words; action-only request/cart/copied labels omitted intentionally in print. All11product pictures verified in PDF raster output after correcting clipped relative-position containers. DTG print reduces5→3pages; inventory1 and audit2 remain complete. Graphs now75,936LFbytes each versus42,911/44,431/21,628originally; no payload reduction claim. Lessons remain254lines after archiving six redundant short references. No business writes/uploads/emails/notifications.

Reviewed pricing reports: price-audit-report, quote-audit and generated pricing-analysis share canonical typography, table/control/focus rules and one scoped pricing-reports.css owner. Three legacy sheets/18important declarations retired; new owner zero.19focused browser cases cover four widths, zero fixture axe findings, all42original table outputs/363rows, keyboard numeric/text sorting, current-section navigation, session hydration, denied/missing/failed/malformed/empty data and retry. Complete quote comparisons preserve valid zero audit totals instead of replacing them with old session totals; all pricing formulas remain unchanged.33explicit mappings reverse six original script/generator/data hashes. Generator layout and output stay synchronized, private memory JSON remains unserved, and financial report fixtures contain hashes instead of copied records. Three PDFs/32landscape pages/10,146checked original data words; all pages visually reviewed. Price audit12→9pages, quote1→1, analysis20portrait→22landscape. Graphs: dashboards/reports/price-audit-report.html 23434→85591LFbytes; pages/quote-audit.html 25979→85591LFbytes; dashboards/pricing-analysis.html 168092→85591LFbytes. Full release gates pending; this review reaches149/76 locally, live count changes only after verified rollout. No real writes, imports, uploads, emails or notifications.
