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

`training-guide.css` owns opt-in training navigation, document spacing, callouts, scrollable reference tables and print rules. The three initial page sheets retain only their lead examples/accordion, embroidery grouping examples and language-reference columns. Use the shared Public Sans staff surface. Keep wide tables in keyboard-focusable scroll regions and use native buttons for disclosure/copy. Printed guides show all accordion content; the language handout uses two readable landscape pages without fixed-height clipping. Never copy a generic `.card` adapter into a document section; use the owned training section. Legacy training-shared.css remains for its seven other consumers until migrated.
