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

## Past Due Orders — review, 10 items (2026-09-04, `v2026.09.04.12`)

- Page was already honest (failed load empties the board; print re-pulls; Ctrl+P guard) —
  the work was making it ACTIONABLE and fixing one phone bug (header controls 781px wide
  at 375px → wrap ≤760px in `past-due-orders.css`).
- Rep headings → account pages (`REP_PAGES`, same map as Company Numbers). "no PO raised"
  → `/calculators/purchasingform.html` — 🔑 that form is a **JotForm embed**, it cannot
  prefill the WO from the URL; the link title carries the WO. Vendor under the blanks
  status on screen (print always had it). Column "Late · Due in". Zero value → "—".
- $ under each stat tile (late / at risk / no-PO; on-track is count-only upstream), per-rep
  totals, summary "N orders on the board · R reps", "loaded h:mm" (client clock — the
  payload's `today` is a date), 5-min visible-tab refresh. Site favicon.
- Lock: `tests/unit/past-due-orders-page.test.js`.

## Purchasing Portal — review, 10 items (2026-09-05, app `v2026.09.05.1` + proxy)

- 🔴 **Real defect**: the feed caps at 250 submissions and reports `truncated: 25`; the page
  ignored it — tile said 275, table held 250, nothing said so. Now `#pp-trunc` warns.
- Open work is the default (161 of 261 rows were finished, one 12,000px page); "Show
  finished" toggle; stat tiles are buttons that filter (`applyTile`); "N of M shown".
- Each row links to its JotForm submission (`https://www.jotform.com/submission/{id}` —
  `submissionId` is in the payload); invoice buttons carry aria-labels (253 said "View").
- **Turnaround tile** from the rows: median request→PO 1.2 h, 255 of 261 same day (Bradley).
- Refresh now bypasses the 15-min cache: client `?refresh=1` → server.js forwarder →
  proxy `/purchasing-all` (proxy change, deployed first). `cleanVendors()` trims the
  `"JDS Industries, Inc. \r"` style strings. Chips on `--state-*` tokens. Phone hides
  requester/type/ordered/received. 5-min visible-tab refresh; "Feed built h:mm · loaded h:mm".
- 🔑 False alarm avoided: "Updated 3:52 AM" looked 13 h stale — it was 3:54 AM Pacific.
  Check the wall clock before calling a timestamp stale.
- Lock: `tests/unit/purchasing-portal-page.test.js`.

## Quote Management — review, 10 items (2026-09-05, `v2026.09.05.2–.4`)

- 🔴 **Real defect**: identity came from the legacy Caspio `sessionStorage` keys the SAML
  login never fills → header "Guest", `currentUserEmail` null, EVERY delete button disabled
  for everyone (Erik included). Now `initIdentity()` reads `/api/crm-session/me` (admin role
  = master delete). 🔑 Any staff page still reading `nwca_user_name`/`StaffAuthHelper` alone is
  broken the same way — grep for it.
- Rule 3 sweep: 78 `onclick=` + 23 `style=` → `onDelegatedClick()` on `[data-action]`,
  `hidden` attribute, classes for the ShipStation button states. Row click = view unless the
  click landed on `a, button, select, input, label, .inbound-cell`.
- Server window: `/api/quote_sessions?createdAfter=YYYY-MM-DD` (proxy filter the Orders
  Inbox already used) instead of downloading every quote ever; a search that finds nothing in
  the window widens to All Time ONCE with a visible notice (`#qm-notice`).
- Actions column on one line (rows were 167px, 6 icons stacked in 86px); IDs no longer wrap;
  phone header wraps, 6 columns hidden ≤768px, table in a scroll wrapper.
- alert/confirm/prompt (8) → `openModal()` (promise; confirm or input) + `showToast(msg,
  tone)`. Tiles = filter buttons (`TILE_MATCH`). "Total Value" → "Pipeline Value" (active +
  accepted; lost/expired/cancelled excluded). ARIA tabs (roles, aria-selected, arrows).
  Loaded stamp + 5-min visible-tab refresh. FA 6.4.0 like every other staff page.
- Lock: `tests/unit/quote-management-page.test.js`.

## AE Mission Control — review (2026-09-05, `v2026.09.05.5`) — already mature, 6 small items

- All 6 tabs loaded clean for Taneisha (view-as), no console errors, stamp fresh, phone layout
  fine (tablist scrolls inside itself). Kept: DashTabs, harness + `sync-test-harness.js`.
- Fixed: "1 days past" → `plural()`; swatch/chip inline colours → classes; `style="width:0%"`
  → CSS; the one `alert` → `DashPage.showError`; **5-min visible-tab re-read** of summary +
  inbound (a cockpit sits open all day; Refresh stays the forced pull). The remaining `style=`
  in templates are computed widths/lefts (bar fills, pace markers) — legitimate.
- 🔴 **Attribution gap found via the Pipeline tab**: it filters quotes on `SalesRepEmail`, and
  `volume-quote.js` hardcoded `sales@` → Taneisha's $30,959 Braun NW VQ read "no quotes carry
  your name". Now `repEmailFor(name)` via `StaffAuthHelper.STAFF_EMAIL_MAP` (first name OK).
  Existing VQ rows keep sales@ (Erik can edit `SalesRepEmail` on VQ-2026-002 in Caspio).
- Lock: `tests/unit/ae-mission-control-page.test.js` (runs the harness drift check in the gate).

## Cross-page sweep 1 — identity hydration + favicons (2026-09-05, `v2026.09.05.6`)

- **Root cause of the Quote Management "Guest" bug, generalised**: the staff dashboard mirrors
  the SAML identity into `sessionStorage.nwca_user_name/email`, but sessionStorage is per TAB.
  Any bookmarked / typed / `rel=noopener` open of a staff page had NO identity. Affected
  readers (audit): rep-crm (nika/taneisha pages), quote-view (`isStaff` → staff saw the
  customer view), quote-audit (gate sent staff to the login card), invoice (toolbar hidden),
  transfer-detail ("Who are you?" modal), art-request-detail / mockup-detail / art-hub-steve
  (notes posted as "Staff"), garment-designer (rep email sales@), quote builders
  (`autoSelectSalesRep` → rep blank → `SalesRepEmail` sales@).
- Fix in ONE place: `StaffAuthHelper.ready()` (hydrates from `/api/crm-session/me`, kicked at
  script load, memoised, never throws, `staff-auth:ready` event); `autoSelectSalesRep` retries
  after hydration; init-time readers `await ready()`; 7 pages that read the keys without
  loading the helper now load it. Lock: `tests/unit/staff-identity-hydration.test.js`.
- 8 pages still used the Caspio-CDN favicon → `/favicon.png`. Mission Control hero quarter
  labels ("Your Q3 embroidery bonus", "Earned · Q3") now follow the API's quarter.
- 🔑 Audit script (node, inline in the session): per page — onclick=, style=, inline
  `<script>` bytes, `<style>`, alert/confirm/prompt, legacy identity reads, console.log,
  favicon, FA version. 61 of 96 dashboard-linked pages flagged; the quote builders (98/73/48
  onclick each, 4 alerts) and 5 training pages with 1–19 KB inline scripts are the big
  remaining Rule-3 debt — builders deliberately NOT swept autonomously (pricing-critical,
  Rule 8 sync ×4). Remaining backlog is in this file's next sections as they ship.

## Cross-page sweep 2 — Rule 3 inline `<style>`/`<script>` extraction (2026-09-05, `v2026.09.05.7`)

- 15 pages, 21 new files, every inline block moved VERBATIM to an external file linked at the
  SAME position (cascade + execution order preserved). Rule of the extractor: never append to
  an existing page script — the inline block ran at ITS position; use a sibling `-inline.js`
  (`embroidery-pricing-all-inline.js` is the `?tab=` bootstrap that ran BEFORE the main file).
  JSON-LD blocks are data and stay. Two `<style>` blocks on one page → one CSS file, one link.
- Pages: art-hub-steve (2 style), art-hub-ruth, names-numbers-dashboard, 4 training pages
  (1–19 KB inline scripts), purchasingform, taneisha/nika-crm (`REP_CONFIG`),
  embroidery-pricing-all, screenprint-customer, commission-structure, price-audit-report,
  digitized-designs (18 KB). Script: session scratchpad `extract-inline.js` (rebuild from this
  description if needed — ~70 lines).

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
