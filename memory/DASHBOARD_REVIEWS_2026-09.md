# Staff Dashboard + AE Dashboard reviews — 2026-09-04 (what shipped, what to know)

Two full page reviews Erik asked for ("100% satisfied"), all items shipped the same day.
Releases `v2026.09.04.1 → .9`. Detail here; MEMORY.md carries one line each.

## AE Dashboard — redesign + colour-coding (`.1 → .7`)

- All six surfaces (garment / sticker / banner / JDS / Ruth forms + nav + galleries) on ONE
  design language. The four form CSS files share identical field / drop / rush / submit /
  success / toast blocks — only the `--fx-*` accent tokens differ; **keep them in step**.
- **Colour = person/department** (Erik's rule): `memory/DESIGN_COLOUR_CODE.md` is the key.
  Done by re-scoping the `--art-theme*` family per pane in `dashboards/css/ae-dashboard.css`
  (Steve panes green, Ruth panes purple, Transfers slate blue, Personalization shop blue) and
  `--fx-*` per form. **`ae-dashboard.css` MUST stay the last stylesheet** — it owns the theme.
- Transfers / Personalization show launcher cards rendered from `SECTIONS` in ae-dashboard.js.
- Art Request Detail + mockup-detail: the "AE view = maroon" overrides were retired (Steve green
  / Ruth purple in every view).

## AE Dashboard — review, 15 items (`.9`)

- **ONE "needs your review" number.** `art-ae.js` / `mockup-ae.js` dispatch `ae:counts`
  after every render (current, not on hold, Awaiting Approval); ae-dashboard.js paints the
  Steve/Ruth nav badges + the More-menu Review badge, and the Review tab renders
  `ArtAeGallery.getNeedsReview()`. The old badge fetched every Awaiting-Approval row ever
  (94 vs the gallery's 8).
- **Art fees = Service_Codes.** Garment form `loadArtFeeOptions()` lists the live `GRT-*`
  rows (value = SellPrice → `Prelim_Charges`); the typed GRT-25/100/150 never existed in
  Caspio. Requirements tab figures come from `data-fee-price/rate/frac/name` hooks filled by
  `dashboards/js/ae-dashboard-init.js`; failure → "—" + visible warning, never a typed price.
- Garment form: sticky progress bar (`countMissing()` mirrors `validate()`), per-rep draft
  `nwca-gsf-draft:<email>` (7-day TTL, restored on init unless a prefill is passed, Discard
  bar, cleared on success), beforeunload guard. All 4 forms: `wireLabels`/`wireA11y` pair
  labels with controls, drop zones are keyboard buttons, leave-page guard.
- Rule 3 clean: 167 inline styles, the 69-line inline script and every `onclick` are gone —
  bootstrap + `data-action` delegation in `ae-dashboard-init.js`; Requirements tab on
  `.req-*` classes. Dead Caspio note-iframe modals removed. JDS Mockup listed once. SVG
  item-type icons. Both nav tiers + pills = WAI-ARIA tabs (roving tabindex, arrows).
- Lock: `tests/unit/ae-dashboard-page.test.js`.

## Staff Dashboard — review, 13 items (`.8`)

- Row descriptions wrap under the name ≤1100px (were `display:none`). Ctrl+K + the
  Everything filter search descriptions / tooltips / per-row `data-keywords` (38 tools),
  word-start matched, curated keywords ranked first. Everything rows show descriptions.
- Past Due = header chip + ONE row (Production). Production grid hole fixed (`ws-card--full`).
  Bundle rows use `f-store` (per-client colours retired). Phone: header 128→87px, Pride Wall
  closed by default on phones (`tool-grid-controller`), tab-strip fade. Tweaks FAB +
  `sidebar-controller.js` DELETED. `staff` role → Office.
- **The dashboard is a HASHED page**: `lib/hashed-pages.js` `DASHBOARD_PAGES` tranche;
  `scripts/build.js` `ENTRY_BUNDLES` bundles its ~25-file module graph into ONE file; all
  three routes (`/staff-dashboard.html`, `/staff-dashboard-v3/`, `…/index.html`) call
  `sendHashedHtml` after `requireStaff`. Company Numbers still imports the same controllers
  from source by absolute path.
- Locks: `tests/unit/staff-dashboard-workspaces.test.js` "2026-09-04 review" block,
  `tests/unit/build/hashed-pages.test.js`.

## Company Numbers — review, 15 items (2026-09-04, `v2026.09.04.10`)

- **Freshness is printed, not promised.** One 5-minute tick (`dashboards/js/company-numbers.js`
  CARDS registry) re-reads every live card ONLY while the tab is visible, catch-up on return;
  each card header has `.cn-stamp[data-stamp]` → "Updated h:mm" / "Failed h:mm"; the header
  shows the last tick. Controllers expose `refresh*()`; the art widget exposes
  `window.ArtAgingWidget.load()` + `.last` (its first load beats the module entry's listener).
- **The annual goal is a Caspio row**: Service_Codes `CO-ANNUAL-GOAL` (SellPrice = dollars),
  read via `company-goal-service.js` → `/api/staff/service-codes`. `ANNUAL_GOAL` constant gone.
  Fallback $3M is used ONLY with a visible ⚠ (goal chip `.is-goal-fallback`, team card
  `.rep-goal-note`). ⏭️ **Erik must create the row** — the proxy POST needs the CRM secret and
  auto mode blocked the shell that read it. Until then both surfaces show the ⚠ honestly.
- **Date bug**: `formatDateRange` parsed `YYYY-MM-DD` as UTC → a day early in Pacific. Fixed by
  `toLocalDate()`; "Last N days" is now N days inclusive (was N+1).
- Team card: bar + text = share of team, goal share in the tooltip; DEAD → House; full names.
  Team-push title from the API quarter. Production: no refresh button, footer prints
  `metadata.dataThrough` + `updatedAt` (stats file is static, compiled 2026-01-10, data
  through Nov 2025). "Money Collected" → "Online Payments (Stripe)". Sample rows: tel:/mailto:
  from ManageOrders `ContactPhone/ContactEmail`. Art widget on `.aa-*` classes. Entry bundled
  (ENTRY_BUNDLES, relative imports). Phone header stacks; uppercase titles `nowrap`.
- Lock: `tests/unit/company-numbers-page.test.js` (vm-sandbox loads the ESM utils).

### Second pass (`v2026.09.04.11`, 7 items)

- **Production Turnaround RETIRED → "Production Due" (live)**: reads the Past Due report's
  forwarder `/api/crm-proxy/ae-dashboard/due-dates-all?days=30` (ORDER_ODBC + PurchaseOrders);
  tiles past due / at risk / past due with no PO / due this week on track, 6 most urgent rows,
  link to the full report. `production-schedule-stats.js` + `-predictor.js` DELETED (completions
  through Nov 2025; production logging stopped 2026-05-20 — they could never go live).
- Team rows are links (`REP_PAGES`: Nika → nika-crm, Taneisha → taneisha-crm, House →
  house-accounts; Ruthie has no page → plain card). Revenue card gets the archive YTD chip
  (`#revenueYtd`, filled by team-performance-controller) so Revenue/Team/goal chip share ONE
  number. Art widget: `STALE_DAYS = 30` bucket ("close or revive") leads the list.
  ONE header "Refresh now" (`#cn-refresh-all` → `tick('manual', true)`, bypasses caches); the
  four per-card buttons are gone. `@media print` light single-column sheet. 1600px content,
  three-up metrics row (revenue | team | art) from 1500px.

## Verification gotchas learned today

- Browser pane (`mcp__Claude_Browser`): screenshots of a SCROLLED page come back blank on
  these pages — shift `body.style.marginTop` instead; screenshots ≥0.6 scale time out
  intermittently, 0.5 works; the desktop viewport reports `innerHeight 0`, so
  IntersectionObserver-driven UI (the garment progress bar) never shows — verify under the
  **mobile preset** (real viewport). A bare-path ES module is cached by Chrome on the static
  server — `fetch(url,{cache:'reload'})` each changed file before `location.reload()`.
- Deploy skill: the 15s boot probe is too short for this server.js (~20s to `app.listen`);
  a 0-byte probe log means "too slow", not "crashed" — probe at 45s. A `for` loop whose last
  statement is `[ $R -ne 0 ] && …` exits 1 on success and silently skips the `&& git commit`
  after it.
- Local esbuild hashes differ from Heroku's for CRLF working copies — read the LIVE
  `/dist/asset-manifest.json` for the real names when verifying.
