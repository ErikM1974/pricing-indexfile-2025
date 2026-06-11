# NWCA 2026 Design System — Interior-Page Class Reference

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
