# AE art request — optional size, and the six systems that lock that form

**Shipped v2026.09.18.2 / Heroku 2132 / `e6e65f3d` (2026-09-18).**

## What changed and why

Steve knows the standard size for each placement, so requiring the rep to type
inches taught them to guess — and a wrong 4" is worse than a blank, because
Steve trusts the number and works to it.

Width is no longer required. But a blank size would have been indistinguishable
from a rep who skipped the field, so the choice is explicit per location:

| Size select | Shows | Steve reads |
|---|---|---|
| **Standard size** (default) | hint: "Steve uses his standard size for this placement." | `Standard` |
| **Customer specified** | Width" / Height", width required | `3.5" × 2" (customer)` |

Placement is now the only required field in the row. Switching back to Standard
clears any inches already typed, so a stale number cannot survive the switch.

`Artwork_Locations` records `sizeSource: 'standard' | 'specified'`. A width with
no mode (a legacy draft or a quote hand-off) counts as **specified** — it is a
size a customer already saw, so it must not be downgraded.

Owner: `shared_components/js/garment-submit-form.js` (`SIZE_MODES`,
`applyLocationSizeMode`). Rendering: `pages/js/art-request-detail.js` (detail
table + printed spec sheet). The kanban/gallery spec lines are deliberately
untouched — placement alone reads fine there.

## 🔴 One shared-form change invalidates SIX recording systems

This is the expensive part. Nothing lists them together, and three only report
failure after a ~33-minute CI run.

### Content-lock ledgers (jest, fast)

`lead-records-content` and `customer-documents-content` both replay
`garment-designer-original-content.json`'s rows for a file **first**, then their
own. So rows for `garment-submit-form.js`, `art-intake.css` and
`garment-designer.css` go in the **garment-designer** fixture once and serve all
three suites.

`specialty-calculators-content` separately locks `dashboards/ae-dashboard.html`,
applying `restorePreQuickQuote` before the replay — compute rows on the
**pre-transformed** text.

Rows are `{file, before, after, count}`, replayed in REVERSE array order, so new
rows are APPENDED. Generate them from a real diff and verify by replaying back to
the base text; hand-written rows reverse to *almost* the original.
`scripts/record-content-lock-change.js` only covers quote-builder and
lead-workspace targets — not these files.

### Browser fixtures (Playwright, slow)

CI-enforced, compared on `['title','fields','links','headings','entries']`:

- `garment-designer-art-form-original-browser.json`
- `garment-designer-art-fees-failure-original-browser.json`
- `quote-view-lazy-art-form-original-browser.json`

🔑 **A recorded form can hold more than one location.** quote-view's lazy art
form records two, so a patch that inserts after the *first* `gsf-loc-place-N`
silently misses `gsf-loc-size-1`. That cost a full CI round trip.

`garment-form-{ae,lead,quote}-original-browser.json` also lock the form's full
**text**, so a field insert is not enough — they need a real recapture run. They
are gated behind `GARMENT_FORM_REVIEW_PHASE` and do **not** run in CI, so they
are still stale as of 2026-09-18.

## 🔑 Deploy traps this change exposed

- **The cache-bust itself edits content-locked files.** Bumping `?v=` in
  `ae-dashboard.html`, `garment-designer.html` and `garment-submit-form.css`
  breaks four lock suites — so a release needs a *second* ledger pass after
  Step 2. This is what `record-content-lock-change.js --only` is for.
- **A `?v=` can hide inside CSS.** `shared_components/css/garment-submit-form.css`
  carries `@import url("/shared_components/css/art-intake.css?v=…")`. Deploy
  Step 2 greps only `*.html`, so it cannot see it — and that import is how the
  **lead workspace and quote view** load the stylesheet. Left unbumped they serve
  new JS against cached CSS. Bump it by hand.
- **Playwright runs only on a `Deploy v…` commit subject** (`ci.yml` job `if:`),
  takes ~33 minutes, and reports one broken recording at a time. Install Chromium
  locally (`npx playwright install chromium`) and run the affected specs first —
  2–3 minutes versus 33.
- Byte budgets: `measuredRawCssBytes` (ae-dashboard, garment-designer) and
  `measuredTriggeredCssBytes` (lead.html, quote-view.html) all need refreshing
  when `art-intake.css` changes size.

## ⏭️ Open

- Regenerate `garment-form-{ae,lead,quote}-original-browser.json` on the next
  `GARMENT_FORM_REVIEW_PHASE=original` run.
- Optional follow-up Erik has not asked for: auto-fill the standard size per
  placement from a Caspio table Steve can edit, so the number shows on every
  request. Needs a decision on adult/youth and method qualifiers for Full Front.
