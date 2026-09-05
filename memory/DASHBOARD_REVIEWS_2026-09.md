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

## Live crawl of ~60 dashboard pages (2026-09-05, Erik's Chrome) — 2 real defects, rest clean

- Method: navigate each dashboard-linked page, wait 6–8 s, collect console errors + visible
  `[role=alert]/.error/.dash-error-banner` text + first 160 chars. Cheap and it found what the
  static audit could not.
- 🔴 **Design Vault dead for 31 days**: `/api/design-search/index` sends `If-None-Match`; the
  proxy's CORS `Access-Control-Allow-Headers` did not list it → preflight OK but the browser
  dropped the GET ("Failed to fetch") → the page honestly showed the stale cached index. Fix:
  proxy CORS allows `If-None-Match, If-Modified-Since, Range, Cache-Control, Pragma` and exposes
  `ETag, Content-Length, Retry-After` (proxy `v2026.09.05.2`). 🔑 A CORS-blocked request never
  reaches the server log — curl with `-H Origin` returns 200, so reproduce the PREFLIGHT
  (`-X OPTIONS -H Access-Control-Request-Headers: <header>`) and read the allow list.
- 🔴 **Policies Hub / Policy Detail redirected Erik to "Sign in to User Portal"**: the Caspio
  auth embed was a static `<script>` that ran for everyone; for a SAML-only session it took the
  page to the Caspio login. Now a `#caspio-auth-embed` placeholder that the gate injects only
  when `/me` and sessionStorage found nothing (app `v2026.09.05.9`).
- Everything else loaded clean: no console errors, no error banners on 58 pages. Lock:
  `tests/unit/policies-gate-and-vault.test.js`.

## Cross-page sweep 3 — alert() → toasts on the detail pages (2026-09-05, `v2026.09.05.10`)

- 45 blocking `alert()` dialogs replaced: mockup-detail (7 → its own `showToast(msg, type)`),
  art-request-detail (15), quote-view (18, customer-facing acceptance flow included), invoice
  (5) → shared `ToastNotifications.error/success/info`. Tone chosen from the message text
  (✓/"successfully"/"Deposit enabled" = success; "Skipped"/"deleted in ShopWorks" = info; else
  error). `confirm()`/`prompt()` left alone — synchronous return values need per-site work.
- 🔑 The shared toast module was UNSTYLED (no stylesheet defined `.nwca-toast`, so the Design
  Vault's toasts were bare text at the page bottom) and used innerHTML for the message. Now
  self-styling + textContent + `role=alert`. Any page that adds `toast-notifications.js`
  gets a real toast.
- Also in this release: policy-questions.html got the on-demand Caspio embed; favicons added to
  garment-designer, price-audit-report, quick-reference-tips, box-labels.

## Cross-page sweep 4 — consistency lock over EVERY staff page (2026-09-05, `v2026.09.05.11`)

- `tests/unit/staff-pages-consistency.test.js` scans the directories, not a hand list, so new
  pages are covered automatically: no inline `<style>`/`<script>` bodies, Font Awesome 6.4.0
  only (was 6.0.0 / 6.0.0-beta3 / 6.5.1 / 6.6.0 across 54 pages), site-hosted favicon.
- Widening the net found 25 more pages with inline code (Training Center sub-pages, the
  DrainPro bundle storefront, bundle-orders, staff-portal-simple) → extracted the same way
  (47 new files); 41 pages got a favicon. Sales Coordinator manual: 45 `onclick=` →
  `data-chapter` + one delegator.
- 🔑 Two pages keep a deliberate own icon (Design Vault, Finished Photos PWA) — the lock
  accepts any site-hosted icon, rejects Caspio-CDN.

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
- Chrome `navigate` to the SAME URL that differs only by `#hash` is a same-document navigation — nothing
  reloads, so a post-deploy check reads the OLD CSS/JS. Add a throwaway `?r=N` query to force a fresh load
  (cost me an unneeded `.21` on the portal review).
- Local esbuild hashes differ from Heroku's for CRLF working copies — read the LIVE
  `/dist/asset-manifest.json` for the real names when verifying.

## Quote builders review — all 4 (2026-09-05, `v2026.09.05.13`)

Review scope was the shell, wiring, dialogs and labels — **pricing logic untouched** (parity
84/84 + full unit 3,546 green before and after). Items shipped:

1. **~150 inline `onclick=` → ONE data-call delegator** in `quote-builder-utils.js`
   (`qbInstallCallDelegator`): `data-call="fn" data-args='[…]'`, `data-href`,
   `data-toggle-hidden`, `data-stop`, `data-self-only`, `data-prevent`; `"$this"`/`"$event"`
   arg tokens; dotted names resolve off `window`. A missing global shows a **toast** ("That
   action isn't available (fn) — refresh…") instead of a silent dead click. Converted: the 4
   pages (60/21/26/3), the rendered templates in emb/dtf/scp `product-rows`, emb
   `pricing-sync`, `design-search`, `shopworks-import`, dtg `form-core`, plus the classic
   shared scripts (`quote-builder-utils` thumbnail + order-shipping header,
   `quote-order-summary` Re-estimate/Edit, `quote-extended-sizes` waist header).
2. **`alert()` → `showToast(…, 'error'|'warning', 6–8s)`** in scp/dtf/dtg modules and the
   utils locked-quote redirect (toast, then navigate after 2.5s). DTG page gained
   `#toast-container` + toast CSS — `showToast` there was a silent console line.
3. **`console.log` removed** from shipped scp/dtf/dtg modules (adapter, push, output).
4. **aria-labels** on the 12 shared `.os-*` order-summary inputs and the DTG form inputs.
5. **Lock**: `tests/unit/quote-builders-page.test.js` (jsdom behaviour test for the
   delegator + repo scans); `quote-order-summary.test.js` updated to expect `data-call`.
6. **Phone layout (`v2026.09.05.14`)** — shared ≤640px block in `quote-builder-shell.css` (trio) mirrored in
   `dtg-quote-page.css`: header 200→100px (DTG 240→90) as two rows (logo+title / actions+method-switch,
   subtitle hidden, switch label hidden), and the page no longer widens to 600–750px — the table scrolls
   inside `.product-table-wrapper` (`body.qb-shell-body` scope beats the Option C `overflow: visible`),
   DTG `.dtg-layout` ≤1279 uses `minmax(0,1fr)` and the customer-pane `.dcp-row` grid too. 🔑 A bare `1fr`
   is `minmax(auto,1fr)` — min-content wins and the layout viewport grows; measure with the mobile preset.

🔑 Gotchas: `data-args` inside a JS template literal → `data-args="${escapeHtml(JSON.stringify([…]))}"`
(never a raw `${rowId}` inside the JSON — it broke the SCP `clearExtendedSize` button once);
`quote-order-summary` still accepts the legacy `editOnclick: 'openShippingModal()'` config —
`callName()` strips the `()`. The builders are SAML-gated even locally, and the python static
server serves the raw ESM entry (bundle never boots) → use the new `static-dist` launch entry
(`scripts/qa-static-server.js`, manifest-rewritten HTML) after `node scripts/build.js`.

## Whole-dashboard sweep — every page linked from the staff dashboard (2026-09-05, standing authorization)

Erik: "keep going on the entire staff dashboard … deploying … don't stop until each page is cleaned up."
Method: a per-page audit run in Erik's signed-in Chrome over all 108 dashboard links (structure,
labels, inline handlers, dead text, dead images, console errors) + a phone-width pass on the
`static-dist` QA server (mobile preset). Findings log: scratchpad `sweep-findings.md` (session).

**Results:** zero JS console errors on any page. Every "2025" hit was legitimate (2025 Freeman Rd
address, historic data, design names). The Caspio-embed pages (digitized/old designs) carry
Caspio-injected inline scripts — not ours. Customer bundle pages (`/DrainPro-Bundle`,
`/streich-bros-bundle`, `/wcttr-bundle`, `/sanmar-vendor-portal`) redirect to the Caspio user
portal by design.

**Batch 1 (`v2026.09.05.15`)** — ~70 unlabelled inputs given `aria-label`s across 35 pages
(static HTML + the rendered templates in access-admin, table-usage-audit, volume-quote,
mockup-ruth, art-hub-steve-gallery, policy-comments); icon-only close/dismiss buttons named;
duplicate `<h1>` removed (Design Vault boot title, embroidery-pricing print header, 43 chapter
headings in the Sales Coordinator manual → `h2.chapter-title`); `<img src="">` removed
(digitized/old designs, christmas bundles — an empty src re-requests the page); `rel="noopener"`
on blank-target links (calibrate tool, portal-directory rows); Dashboard links added to
design-queue, gear-publisher, finished-photos, box-labels, custom-tees-calibrate; the AI chat
panel on webstores/emblem no longer auto-opens on phones (`matchMedia(min-width: 900px)`);
phone-width fixes for leads, house-accounts, customer-portal-admin, seo-strategy, box-labels,
names-numbers, customer-service training, sales-coordinator manual, volume-quote,
policy-migration, embroidery-contract, dtg-contract (`.contact` grid).

🔑 Phone audit gotcha: a table whose right edge passes the viewport is NOT a defect when it sits in
an `overflow:auto` wrapper — only `innerWidth > 375` (Chrome zooms out to fit real overflow) is.
Find the culprit with "elements whose right edge > body width, deepest first"; the usual causes were
a nowrap flex header row, a bare `1fr` grid track, or a fixed-width input.

**Batch 2 (`v2026.09.05.16`, fix `.17`) — inline `onclick=` → `data-call`** via the new shared
`shared_components/js/data-call-delegator.js` on 14 pages (universal-records-admin, embroidery-pricing-all,
art-hub-ruth, screenprint-customer, names-numbers, art-hub-steve, commission-structure, manual-pricing,
monogram, data-entry-guide, nika/taneisha CRM, house-accounts, portal-directory) and the 8 modules that render
their rows (mockup-ruth, names-numbers-dashboard, art-hub-steve, portal-directory, house-accounts,
monogram-dashboard, universal-records-admin, embroidery-pricing-all). `admin/universal-records-admin.html`'s
1,300-line inline script/style extracted (Rule 3). Lock: `tests/unit/staff-pages-datacall.test.js`.
🔑 Lexical `let/const` globals (`manualCalc`, `dashboard`) are NOT window properties — the delegator resolves off
`window`, so expose them (`window.dashboard = dashboard`). `data-stop` on an inner element beats an outer
`data-call`/`data-href` (the old `event.stopPropagation()` semantics) because both are decided in ONE listener.
🔴 A `textContent`-based `esc()` does NOT escape quotes — JSON in `data-args` needs `&quot;` (`.17` fixed the
Names & Numbers delete button, whose roster name truncated the attribute at the first quote).

**Batch 3 (`v2026.09.05.18`)** — re-audit follow-ups: access-admin page-access editor inputs labelled
(42 rendered inputs), Steve's hub got a real (sr-only) `<h1>` + alt on the zoom image, Bradley Transfers /
Supacolor page titles → `<h1>`, Production Shifts print title → `<div>` (was a 2nd h1, React `app.jsx`),
SanMar Payables row checkboxes labelled, old-designs sticky button → data-call, and the public
`calculators/christmas-bundles.html` fully de-inlined (2 scripts + style extracted to `calculators/{js,css}/`,
41 `onclick`/`onerror`/`onchange`/`onsubmit` → data-call + a capture-phase `error` listener for image fallbacks).

**Batch 4 (`v2026.09.05.19`)** — compact live re-audit of every page (0 onclick / 0 unlabelled / 1 h1 / 0 console
errors across the board) surfaced the last few: the delegator now also handles `data-change="fn"` (change events),
manual-pricing de-inlined (12 `onchange` + an Enter-key `onkeypress`) with a real `<h1>`, screenprint-customer `<h1>`
+ notes label, Universal Records status selects labelled, the quick-tips Caspio link `rel=noopener`.

**Deliberately left:** retiring `dst-viewer` / `garment-designer` (chips due for removal ~Sept 2026),
Caspio-injected inline scripts on the design-archive pages (not ours), the JotForm iframe width on the
Purchasing Request form (third-party embed).

## Customer Portal + login — review, 7 items (2026-09-05, `v2026.09.05.20`–`.22`)

Reviewed live via the staff mirror `/portal-admin/preview/1276` (Aaberg's Rentals) + phone pass on
`static-dist` (the page's error states render without the API — every feed shows a red alert + Retry).
Already strong: dialogs are `role=dialog aria-modal`, Esc closes everything, `hidden` panels,
skeletons, zero-badges hidden, phone bottom nav + off-canvas menu, printable statement. Items shipped:

1. **Orders/Invoices tables overflowed even at 1500px** — `td{white-space:nowrap}` + long ShopWorks
   design names ("P1008, Aaberg's - Navy ,Black, Red, …") pushed Status/Actions off the edge. Design
   cell now `td.cp-cell-design` with the `max-width:0; width:34%` auto-layout trick (absorbs the leftover width,
   ellipsis, `title` tooltip); invoice sub-line clamped too. 🔑 A px/vw clamp could not know the CARD width —
   the portal column is centered inside a 2000px window, so `20vw` still overflowed by 16px.
2. 🔴 **Reward ledger leaked the internal cost bands** ("… (12-mo program · band 40+, 20-39.99)") on the
   Account tab and in the redeem modal. Server `portalCustomerReason()` strips any parenthetical naming
   band / program / RWD- / already before `/api/portal/rewards` (and the preview mirror) return it. Rule
   stays: rates yes, cost thresholds never.
3. **Global search keyboard** — results now carry `id` + `aria-selected`; ArrowDown/ArrowUp move
   `aria-activedescendant`, Enter opens the highlighted hit; input is `role=combobox aria-autocomplete=list`.
4. **Focus return** — `rememberFocus()/restoreFocus()` around lightbox, order drawer, request, generic,
   redeem and statement modals; the phone menu focuses the current nav link on open and the ☰ button on close.
5. **Login page** — the email field has a (sr-only) `<label>`; footer sentence no longer dangles a "·".
6. **Design names** — `designLabel()` tidies "Navy ,Black" → "Navy, Black" everywhere they render.
7. Lock: `tests/unit/customer-portal-page.test.js` (Rule 3, combobox, focus, clamp, sanitizer, label).

Left alone on purpose: `$0.00` zero-total orders (real ShopWorks records), the raw sign-in email in the
Quotes empty state (it explains WHY nothing shows), the JotForm-style statement header wrap.

## Customer product (re-order) page — review, 9 items (2026-09-05, `v2026.09.05.24`–`.25`)

`/portal/product/:style` (`pages/customer-product.html` + `customer-product.js`; shares `customer-portal.css`
and the `portal-reorder-list.js` drawer). Reviewed live via `/portal-admin/preview/1276/product/PC54`;
phone pass on `static-dist` (error state only — the page needs the API for the full render). Already
strong: no onclick, every input labelled, swatches/upgrade table fit, 0 console errors. Shipped:

1. **Header logo + favicon were a dead Box shared-static PNG** (the portal had already moved to the
   Caspio CDN logo) — now the site logo + `/favicon.png`; alt is the company name.
2. **Two h1s / wrong h1** — the header said "Your Account" in an `<h1>` and the product name was a div.
   Header brand is now a div ("Northwest Custom Apparel / Customer portal", same as the portal) and
   `.pp-title` is the page's `<h1>`.
3. **`document.title` was static** — now `STYLE · Product name | Northwest Custom Apparel`
   ("Product unavailable | …" on error). 🔑 `.25` hotfix: NEVER `esc()` a title — it is plain text, so
   "Port &amp; Co" showed literally in the tab.
4. **Rule 3** — 8 template `onerror=` handlers + the reorder drawer's `style="display:none"` /
   `.style.display` toggles → `data-onerror="hide|hide-parent|hide-thumb|noimg|remove"` + ONE
   capture-phase `error` listener; loading/error/content/thumbs/fab/drawer all toggle with `hidden`.
   🔑 `.rl-fab` had NO `display` in CSS (it came from the inline `inline-flex`) — added, or `hidden=false` shows nothing.
5. **Failed load offers Retry** (calls `load()` again); "No product specified" stays retry-less.
6. **Header back link** ("← Back to your account", "← Account" under 560px) so the phone user is not
   scrolling to the body link. Header at 375px: 135px → 60px tall, link no longer clips off the edge.
7. **Availability dots** carry `role=img aria-label` matching the tooltip.
8. Reorder drawer shared fix also lands on the portal page (same `portal-reorder-list.js`).
9. Lock: `tests/unit/customer-product-page.test.js`.

Left alone: swatch grid "blank boxes" on first paint are lazy-load timing (82 unique colours, every
image resolves); the size matrix legitimately scrolls inside its own wrapper on phones.

