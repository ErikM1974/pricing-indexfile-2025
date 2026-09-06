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

## Customer login page (+ vendor twin) — review, 10 items (2026-09-05, `v2026.09.05.26`)

`/customer/login` (`pages/customer-login.html/.js`, `customer-login.css`) — `pages/vendor-login.html/.js`
share the markup and CSS, so every item landed on both. Reviewed live (expired state) + every
state on `static-dist` with fetch stubbed (429 / rejected / 404). Shipped:

1. 🔴 **Deep links were dropped** — `?next=` from the gate never reached the emailed link (see
   LESSONS 2026-09-05). Now forwarded end-to-end through one `safeLoginNext()` allow-list.
2. **Invalid email** — `novalidate` + `if (!email)` let "not-an-email" through to a fake "check your
   email". Now a visible inline message + `aria-invalid` red border; clears on input.
3. **Rate limiter / offline were hidden** — 429 and a rejected fetch showed the sent state (a lie
   for the offline case). Both are now told to the user; every other response stays the SAME sent
   state (no enumeration — a 429 does not reveal whether an email is on file).
4. **"try again" reloaded the page** (losing `?next=`) — now returns to the form in place, resets the
   button, focuses the field.
5. **Notice a11y** — `role="alert"` on the notice; the sent heading is `tabindex=-1` and takes focus.
6. **Field** — `autofocus autocapitalize=off spellcheck=false`; vendor page gained the sr label.
7. **Contrast** — footer `#bbb` (1.9:1) → `#66736a`, hint `#999` → `#5f6b63`; footer link green.
8. **Keyboard focus** visible on the button and links (`:focus-visible`).
9. **Phone** — ≤420px card padding/logo trimmed; `noindex,nofollow` on the customer page too.
10. Lock: `tests/unit/customer-login-page.test.js` (both pages + server).

Not done: the login form is never SUBMITTED live (that emails a real link) — the sent path was
proven locally with the POST 404ing and with fetch stubbed.

## Vendor portal `/vendor` — review, 12 items (2026-09-05, `v2026.09.05.28`)

`pages/vendor-portal.html/.js/.css` (Ed Lacey / L&P Screen Printing). No staff mirror exists and the
vendor's permanent access link is his credential (visiting it stamps a login), so this was reviewed
on `static-dist` with `/api/vendor/*` stubbed — every state exercised: error→Retry→list, filters,
search-empty, card open by Space, detail with broken images, Back button, Esc, Ctrl+Enter post,
375px list + detail. Live check limited to the gate (`/vendor` anon → 302 login?next=). Shipped:

1. 🔴 **Error banner visible on every load since launch** — `.vp-error{display:flex}` beat the
   `hidden` attribute (see LESSONS 2026-09-05). `[hidden]{display:none!important}` added.
2. **Font Awesome from cdnjs** on a vendor-facing page → the vendored 6.6.0 copy (same as builders).
3. **Failures now retryable** — banner is `role=alert` with a Retry that re-runs the failed load
   (jobs, job, note post); the server's own 503/429 message is shown when present; a 404 job says
   it was removed/reassigned instead of "refresh".
4. **Browser Back works** — opening a job `pushState`s `#job=`, `popstate` walks list ↔ job; Esc
   returns to the list; focus lands on the job heading and returns to the card.
5. **Filter chips** are `aria-pressed` buttons with live counts (Active 2 · Completed 1 · All 3);
   empty text names the filter or the search ("No jobs match “zzz”.").
6. **Past due** — a needed-by date before today on a non-terminal job is flagged red on the card
   (left rule) and in the work order ("Sep 2, 2026 · past due").
7. **Labels** on search and message box; Post disabled until text; Ctrl+Enter posts; "Posted — NWCA
   will see it on the job." confirmation; failure keeps the text.
8. **Images degrade** — broken mockup thumb → shirt placeholder, file thumb → icon, mockup hero →
   "preview unavailable, use Download" (`data-onerror`, one capture listener).
9. **Cards** open on Space as well as Enter; `aria-label="Open job TR-…, Company"`.
10. **Every icon `aria-hidden`**; loading/empty are `role=status`; `document.title` per view.
11. **Phone ≤560px** — header user row full-width, tagline hidden, one-column cards, stacked
    comment form; 0 overflow at 375px in list and detail.
12. Lock: `tests/unit/vendor-portal-page.test.js`.

Left alone: job ordering (API order), note timeline newest-first, sign-out as a GET link.

## Customer Portals admin console — review, 14 items (2026-09-05, `v2026.09.05.31`)

`dashboards/customer-portal-admin.html/.js/.css` (Admin → Customer Portals; `PORTAL_ADMIN_ROLES`).
Reviewed live as Erik (141 invites) + every interaction on `static-dist` with `/api/*` stubbed. Shipped:

1. 🔴 **"Have Signed In: 0 / Last Sign-In: Never" for all 141** — nothing ever wrote `LastLogin`
   (see LESSONS 2026-09-05). Proxy `touch-login` route + app verify call. Counts start from today.
2. **Rule 3** — 7 inline `style=` (badge, both modals, requests view, rep filters, table wrapper,
   right-aligned th) + 8 `.style.display` toggles → `hidden` + classes; page CSS gained
   `[hidden]{display:none!important}` (the modal overlay is `display:flex` — same trap as the
   vendor portal, caught before it bit).
3. **Tabs** are a real tablist (`role=tab/tabpanel`, `aria-selected`, ArrowLeft/Right, `document.title`
   per tab); the New badge is `hidden` at zero and carries "N new requests".
4. **705 icon-only buttons had only `title`** — each now has an `aria-label` naming the customer
   ("Remove access for a@x.com", "Preview portal for Aaberg's Rentals"); status selects labelled.
5. **Modals** — both toggle with `hidden`, return focus (rewards falls back to the re-rendered chip),
   Esc closes whichever is open; rewards dialog gained `aria-labelledby`; errors are `role=alert`.
6. **CRM lookup** was a `<div>` list inside a `<label>` (clicking a result re-focused the input) —
   now a labelled combobox with `role=option` results, ArrowDown/Up highlight, Enter picks.
7. **Retry** on both failed loads (was "Please refresh").
8. **Delete toast** said "Access removed" BEFORE the DELETE ran — now "Removing…" then the outcome.
9. **Empty state** distinguishes "no match" from "none of the invited customers are on your accounts".
10. **Pressed state** on My customers / My requests / Rewards sort (`aria-pressed`).
11. **Icons `aria-hidden`**, toast is a `role=status` live region, all buttons `type=button`.
12. **Phone ≤640px** — tabs wrap (were clipped off the edge), stat cards 2-up (accent full width),
    controls stretch, modal padding trimmed.
13. **Focus-visible** rings on buttons, chips, tabs, lookup items.
14. Lock: `tests/unit/customer-portal-admin-page.test.js` (incl. the cross-repo proxy route assert).

Left alone: `window.confirm` for destructive actions (fine on a staff console), Font Awesome from
cdnjs (the staff-page consistency lock requires ONE build across staff pages — a move must be all
pages at once), 5 action buttons per row.

## Leads board — review, 10 items (2026-09-05, `v2026.09.05.32`)

`dashboards/leads.html` + `leads.js` + shared `leads-common.js` (also used by `lead.html`). Already
mature: focus traps, `inert` drawer, focus return, CSV formula hardening, attachment host allow-list,
in-flight load guard, cap warning. Live: 1,136 leads, 0 console errors. Shipped:

1. **Board went BLANK while loading and on failure** — the only message lived in the hidden list
   `<tbody>`. New `#leads-board-msg` status region: loading, "Leads unavailable · Retry", and
   "No leads match the current filters." (table failure cell gained Retry too).
2. **Stat tiles filter** (Purchasing Portal pattern): Leads / New / In Pipeline / Won-all-time are
   `aria-pressed` buttons over status GROUPS (`matchesGroup`); picking a status in the dropdown
   clears the group and vice-versa. "Won" tile says "all time" (the board's Won column is 45 days).
3. **86 icons** → `aria-hidden`; 🔥, overdue dot, source icon and rep initials are `role=img` with
   names; card/row labels say "New, hot, follow-up overdue"; columns are `role=region "New (1)"`;
   "Show N more" carries `aria-expanded`.
4. **Drawer** is `role=dialog aria-modal aria-labelledby=drawer-title`; `document.title` names the
   open lead and resets on close. "Full lead" link has a real href before a lead is chosen.
5. **Rule 3** — thumb fallback `parentNode.style.display` → `hidden`; edit-modal hint
   `style.fontSize` → `.ld-hint-sm`.
6. **Edit-lead modal** inputs have `label/for` pairs; its status line is `role=status`; the
   new-lead status too.
7. **Phone ≤640** — header actions keep icons + `aria-label`, words hidden (`.ld-btn-txt`);
   stat grid 2-up.
8. Focus-visible rings on all `ld-*` buttons.
9. Banner close is `type=button`; asset `?v=` bumped on all three files.
10. Lock: `tests/unit/leads-page.test.js`.

Left alone: drag-and-drop has no keyboard path (the drawer's Status select IS the keyboard path);
the phone header is 155px (two rows) — acceptable for a desktop-first CRM; `lead.html` (the full
workspace) is its own review.

## Lead workspace `lead.html` — review, 9 items (2026-09-05, `v2026.09.05.34`)

`dashboards/lead.html` + `lead-workspace.js` (+ shared `leads-common.js`). Reviewed live on
`#JFL0905-9114` and every state on `static-dist` with fetch stubbed. Already strong: quote-plane
same-origin reads, verify-before-link on quote IDs, timeout-aware outreach send, attacker-safe prefill.
Shipped:

1. **No way to reload** — the page had no refresh path; a header Refresh re-reads the lead + activity
   (hidden when there is no id).
2. **Failures are retryable** — lead load failure ("Lead not found") and activity failure both offer
   Retry; not-found also sets `document.title`.
3. **h1 said "Lead" on every lead** — now the contact/company name (the strip title too).
4. **Rule 3** — art modal `style="display:none"` + 4 `.style.display` toggles → `hidden` (leads.css's
   `[hidden]` rule applies); `style="margin-top"` ×3 → `.lw-mt-6/.lw-mt-8`; thumb fallbacks → `hidden`.
5. **26 icons `aria-hidden`**; timeline icons are `role=img` named by type (note / status / received…).
6. **Labels** — search button (was icon-only), ShopWorks search input, quote-ID input, value and date
   inputs, follow-up chips ("Follow up in 3 days"), kit quantity ("Quantity of Catalog"), hidden file input.
7. **Kit modal** traps Tab and focuses Recipient; **art modal** returns focus to its opener and closes
   via one `closeArtModal()`.
8. **Phone ≤640** — head controls full width, composer stacked, Refresh icon-only; 0 overflow at 375px.
9. Lock: `tests/unit/lead-workspace-page.test.js`.

Left alone: GarmentSubmitForm's jsDelivr EmailJS load (shared bundle, same across pages).

## Rep Account CRM (Nika + Taneisha) — review, 12 items (2026-09-05, `v2026.09.05.36`)

`dashboards/nika-crm.html` + `taneisha-crm.html` (identical apart from tier option values) over shared
`js/rep-crm.js` + `css/rep-crm.css`. Live: Nika 474 accounts, $1.04M YTD, 0 console errors. Shipped:

1. 🔴 **"0 accounts" beside 474 cards** — `updateAccountsCount()` was never called on boot (only after a
   filter change). Now part of `retryLoad()`, which init() calls.
2. 🔴 **Dates a day early / false "Overdue"** — `new Date('YYYY-MM-DD')` is UTC midnight = the previous
   evening in Pacific, so a follow-up due TODAY showed Overdue and every date displayed a day early.
   `RepCRMController.parseCalendarDate()` builds calendar-day shapes as local dates (jest-locked with
   `YYYY-MM-DD`, `T00:00:00`, `T00:00:00.000Z`).
3. **Load failure is retryable** — banner gained a Retry (`data-call="crmController.retryLoad"`) and the
   message carries the real error.
4. **Archive fallback was silent** — when the per-rep archive fails the hint line now says "Per-rep
   archive unavailable — Total YTD is the sum of the account cards" (amber) instead of nothing.
5. **Tier cards were clickable `<div>`s** → `<button type=button aria-pressed>` (inner divs → spans);
   product toggles + At Risk carry `aria-pressed`, all kept in sync on clear.
6. **Account cards** are `role=button tabindex=0` with "Open {company}", Enter/Space opens.
7. **Detail modal** is `role=dialog aria-modal aria-labelledby`; focus moves to Close and returns to the
   card; Escape only acts when open.
8. **Rule 3** — 4 inline `style=` in each page + `.style.display`/`.style.cssText` in the controller →
   `hidden` (+ `[hidden]` rule in rep-crm.css), classes for the archive hint / recon line / primary
   order-type line; the health gauge passes `--fill` as a custom property.
9. **241 icons `aria-hidden`**; filter labels have `for`; Products toggles are a labelled group;
   loading/empty/sync are `role=status`.
10. **`alert()` → toast** for the (currently unwired) ownership-sync success path.
11. **Phone ≤640** — tier grid 2-up, filters single column, welcome chip hidden, header tightened
    (was 247px); 0 overflow at 375px.
12. Lock: `tests/unit/rep-crm-pages.test.js`. 🔑 Verification: the gauge fill has `transition: width`
    — while the Browser pane is hidden `offsetWidth` reads 0; check the `--fill` custom property instead.

Left alone: 401 → `/dashboards/staff-login.html?redirect=` (real page; the server uses it too); the
Sync buttons referenced in the controller have no markup (dead path, harmless).

## House Accounts — review, 13 items (2026-09-05, `v2026.09.05.38`)

`dashboards/house-accounts.html` + `js/house-accounts.js` (2.4k lines) + `css/house-accounts.css`.
Live: 34 accounts, $20.4k YTD, 0 console errors. Every modal exercised on `static-dist` with fetch stubbed.

1. 🔴 **"YTD Sales" tile emptied the grid** — `filterByStatCard` matched the label text `'Total'`, but
   the tile's label is "YTD Sales", so clicking it set the assignee filter to "YTD Sales" (0 accounts).
   Tiles are now `<button data-assignee aria-pressed>`; `''` = show all; clicking the active tile clears.
2. **Inline `onchange`** on the reconcile Assign dropdown → `data-change="houseController.quickAssignFromSelect"`.
3. **5 modals** (to-do, reconcile, confirm, gap report, dynamic assign) are `role=dialog aria-modal
   aria-labelledby`; one `_openOverlay/_closeOverlay` pair moves focus in and back; Esc closes all five
   (to-do + assign were not covered).
4. **~30 `style.display` toggles + `style.cssText`** → `hidden` (+ `[hidden]` rule); expander rows
   `<tr hidden>`; gap section starts open without inline style.
5. **Expanders keyboard-operable** — customer rows, gap rows and rep headers are `tabindex=0` with
   `aria-expanded` + named labels; Enter/Space triggers the same data-call click.
6. **Load failure retryable** — banner Retry (`houseController.retryLoad`) with the real error.
7. **Dates** — `parseCalendarDate()` (local calendar days) for card "Added" dates, orders, to-do days.
8. **Audit trail author** was hardcoded `'Erik'` → the signed-in staffer from `/api/crm-session/me`
   (fallback kept).
9. **Two icon-only refresh buttons** named; status regions on loading/empty/sync/toast; expand column
   header has an sr-only name.
10. **130 icons `aria-hidden`**; all buttons `type=button`.
11. **Assign modal** rep buttons carry `aria-pressed`; first rep focused on open.
12. **Phone ≤640** — stat grid 2-up with the total full-width, header actions wrap, sync controls wrap;
    0 overflow at 375px.
13. Lock: `tests/unit/house-accounts-page.test.js`.

Left alone: `loadSyncStatus()` fetches every Nika + Taneisha account on each page load just to find the
latest `Last_Sync_Date` (a proxy-side "last sync" endpoint would be the real fix — Caspio quota, not UI).

## Portal Directory + Lead Scorecard + Unqualified & Spam — review, 20 items (2026-09-05, `v2026.09.05.41`)

Three small sales pages done as one batch (lock: `tests/unit/sales-small-pages.test.js`).

**Portal Directory** (`portal-directory.*`, 246 companies live):
1. 🔴 **A failed feed rendered a silent half-directory** — `fetchMockups`/`fetchArtRequests` caught
   their own errors and resolved `[]`, so a 404/500 on one source showed the other source as the whole
   truth. Both now throw → error panel with the real message + **Retry**.
2. 🔴 **"Open" was useless for staff** — it linked `/portal/:id`, which the server redirects to `/portal`
   (customer session), bouncing staff to the customer login. Now **Preview** → `/portal-admin/preview/:id`
   (the read-only staff mirror). "Copy Link" still copies the customer-facing URL.
3. Inline `onerror=` on the logo → `data-onerror` + capture listener; 4 `style=display` → `hidden`
   (+ `[hidden]` rule); disabled Preview uses a class, not inline opacity.
4. Clipboard failure fell back to `prompt()` → a 6-second toast carrying the link.
5. 988 icons `aria-hidden`; activity dot is `role=img "Last activity Sep 4, 2026"`; Copy/Preview named
   per company; "1 art" → "1 art request(s)"; loading/stats/empty/toast are status regions.

**Lead Scorecard** (`lead-scorecard.*`): presets carry `aria-pressed` (a custom Apply clears them);
the value bar passes `--w` instead of `style="width"`; failure row gains Retry and clears the stale
leads table; icons decorative; banner close `type=button`.

**Unqualified & Spam** (`unqualified-leads.*`, 545 spam / 171 unqualified live): the tabs are a real
tablist (`aria-selected`, `aria-controls`, roving `tabindex`, ArrowLeft/Right, panel labelled by the
active tab, `document.title` per tab); 🔴 **the rescan SUCCESS message was displayed in the red error
banner** (`DashPage.showError(msg, 'info')` — the helper has no info mode) → a green `#uq-status`
line; spam note toggles with `hidden`; failure row gains Retry.

## Bradley's Transfer Queue — review, 11 items (2026-09-05, `v2026.09.05.43`)

`dashboards/bradley-transfers.html` + `js/bradley-transfers.js` + `css/bradley-transfers.css`. Live: 60
transfers, 0 console errors. Shipped:

1. 🔴 **Rule 6** — `API_BASE` was a hardcoded Heroku host and the page never loaded `app.config.js`.
   Now `config/app.config.js` is loaded first and the controller reads `APP_CONFIG.API.BASE_URL`.
2. **First-load failure left the spinner up forever** (only a toast) → `renderLoadError()` renders an
   error card with the message + Retry; later poll failures still toast without wiping the grid.
3. **Stat chips** were clickable divs and the CSS `.active` style was never applied → `<button
   aria-pressed>`, kept in sync with the Status dropdown, Rush checkbox and Clear (`syncChips()`);
   clicking the active chip clears the filter; Clear keeps the `?view=steve` requester slice.
4. **Rule 3** — 50 inline `onerror=` on thumbnails → `data-onerror="thumb"` + one capture listener;
   13 inline `style=` (h1, icon colour, modal, form rows, checkbox label) → classes; toast fade via
   `.is-leaving`; delete modal via `hidden` (+ `[hidden]` rule).
5. **Cards keyboard-openable** — `role=link tabindex=0` with "Open transfer ST-…, Company";
   Enter/Space opens the detail page (inner buttons keep their own handlers).
6. **Delete modal** is `role=dialog aria-modal aria-labelledby`, focuses the Reason field, returns
   focus, closes on Esc; Reason has a real label; close button named.
7. **Link-Supacolor modal** leaked a document keydown listener on every non-Esc close → removed in
   `close()`; focus returns to the chip that opened it.
8. **Delete audit identity** defaulted to Bradley for everyone → the signed-in staffer from
   `/api/crm-session/me`, then the transfer-detail stash, then Bradley.
9. **270 icons `aria-hidden`**; filter labels have `for`; result count / toasts are status regions;
   the active fake-tab carries `aria-current=page`.
10. **Phone ≤600** — chips 2-up, filter groups full width; 0 overflow at 375px.
11. Lock: `tests/unit/bradley-transfers-page.test.js`.

Left alone: the 60-second poll (paused while the tab is hidden) — Bradley's queue is meant to update
itself; the Caspio quota is tracked separately. 🔑 Local smoke: this page reaches the PUBLIC proxy, so
`static-dist` loads REAL data — the first-load failure path is covered by the jest lock, not the pane.

## Supacolor API Orders — review, 10 items (2026-09-05, `v2026.09.05.45`)

`dashboards/supacolor-orders.html` + `js/supacolor-orders.js` + `css/supacolor-orders.css` (shares
`bradley-transfers.css`). Live: 6 active / 1,064 closed. Shipped:

1. 🔴 **Rule 6** — hardcoded proxy host, no `app.config.js` → loaded first, `APP_CONFIG.API.BASE_URL`.
2. **First-load failure was a dead "Failed to load." panel** → error card with the message + Retry
   (`renderLoadError()`); later polls still toast without wiping the table.
3. **View chips** were `role=button` divs with a `.selected` class → `<button aria-pressed>`; the
   existing Enter/Space keydown path kept.
4. **Rule 3** — h1/logo inline styles → `.sc-title*` classes; pagination, backfill modal, paste
   preview, file input, extract status/results `style="display:none"` → `hidden` (+ `[hidden]` rule);
   15 `.style.display` toggles → `hidden`; preview-note inline style → class.
5. **Backfill modal** is `role=dialog aria-modal aria-labelledby`; focus lands on the paste zone,
   returns to the trigger; Esc closes; the paste-zone is `role=button` with a name and Enter/Space
   opens the file picker; the document `paste` guard reads `.hidden` (was `style.display`).
6. **Pagination** is a `<nav aria-label>` with `type=button` controls and a status page-info.
7. **Labels** — Status/Search `for`; hidden file input renamed "Screenshot file".
8. **Icons `aria-hidden`** (incl. the dynamic risk / toast icons); toast container is a live region;
   the fake active tab carries `aria-current`.
9. **Phone ≤600** — chips 2-up, filter groups full width, title wraps; 0 overflow at 375px.
10. Lock: `tests/unit/supacolor-orders-page.test.js`.

Left alone: dates append `Z` on purpose (Supacolor_Jobs stores UTC — the opposite convention from
Transfer_Orders, which `CaspioDate.parse` treats as Pacific); the 60-second poll.

## Bradley's Screen Print Queue — review, 11 items (2026-09-05, `v2026.09.05.47`)

`dashboards/bradley-screenprint.html` + `js/bradley-screenprint.js` — a stripped twin of the transfers
queue, so it carried the same defects and got the same fixes (see the transfers section): APP_CONFIG
base (Rule 6), first-load error + Retry, synced `aria-pressed` chips (click again to clear), 50
inline `onerror=` → `data-onerror`, inline `style=` → classes, keyboard cards, labelled delete dialog
with focus return + Esc, session identity for the delete audit, icons `aria-hidden`, labels `for`.
**Unique to this page: it had NO h1** — the title was an `<h2>`; now the page's `<h1>`.
Lock: `tests/unit/bradley-screenprint-page.test.js`. Live: 0 active orders today (all terminal) —
the empty state renders; card interactions are covered by the lock + the transfers twin's smoke.

## Finished Photos capture + Library — review, 14 items (2026-09-05, `v2026.09.05.48`)

`dashboards/finished-photos.html` + `js/finished-photos.js` (phone/iPad capture) and
`finished-photos-library.html` + `js/finished-photos-library.js`. Both were already well built (no
inline style, `[hidden]` guard, real `<button>`s) — the fixes are the failure paths and dialogs.

1. 🔴 **Silent "empty" states** — customer search, designs and the manage list all did
   `r.ok ? r.json() : { …: [] }`, so a 500 rendered as "No matches" / "No registered designs" /
   "No photos for this customer yet" — a photographer would think the customer wasn't set up. Now
   each throws and shows "…failed (HTTP 500)" with **Retry** (Erik's #1 rule).
2. 🔴 **Publish toggle + Delete never reported failure** — PATCH ignored `r.ok`, both catches were
   empty; the list just re-rendered unchanged. Now "✗ Photo NOT published/deleted: …" in the status
   line, and a success line ("✓ Published to the portal.").
3. **Rule 3** — the design-thumb and library-card `onerror="this.style.visibility='hidden'"` →
   `data-onerror="blank"` + one capture-phase `error` listener → `.is-broken`.
4. **Back arrow was invisible** — the capture page uses `<i class="fas fa-arrow-left">` but never
   loads Font Awesome (mobile page, no dashboard chrome). Now `&larr;`. Lock forbids `<i class="fa`.
5. **Pinch-zoom blocked** — `maximum-scale=1.0` removed from the viewport meta (WCAG 1.4.4).
6. **Find modes** — tabs carry `aria-controls`, panes `role=tabpanel aria-labelledby`, ArrowLeft/Right
   moves + selects (hand-rolled tabs predate `DashTabs`; left as-is otherwise).
7. **Camera / Album buttons are `<label for=file>`** → not focusable. Now `role=button tabindex=0`
   with Enter/Space clicking the input.
8. **Scanner sheet + lightbox** = `role=dialog aria-modal` labelled; focus → Close, returns to the
   trigger; document-level **Esc** closes whichever is open (lightbox first).
9. Publish toggle `aria-pressed` + spoken label; Delete named; caption chips `role=group`.
10. `fmtDate` → `parseCalendarDate` (both pages) — `YYYY-MM-DD` was read as UTC (day early in Pacific).
11. **Library**: load failure had "refresh to retry" text → inline **Retry** button that re-runs `load(true)`.
12. Library rep chips `aria-pressed` (+ visible pressed outline); Publish/Hide and View buttons named
    per photo ("Hide Acme Co from the portal").
13. Library lightbox `role=dialog aria-labelledby=fpl-lightbox-cap`, focus in/return; `fpl-sub` is
    `role=status`; banner close `type=button`; all icons `aria-hidden`.
14. Lock: `tests/unit/finished-photos-pages.test.js`. Smoke on static-dist (mobile): failed search
    shows the honest message, ArrowRight moves scan←search, scanner dialog focus + Esc return, library
    Retry → data, chips pressed, lightbox focus/Esc — 0 overflow at 375px.

Left alone: camera can't be exercised in the pane (permission blocked); `DashTabs` migration not worth
it for three static tabs; `resolveBoxUrl` thumbs still hit Box directly (design decision).

## Production Shifts + Roland Printer Supplies — review, 9 items (2026-09-05, `v2026.09.05.50`)

`dashboards/production-shifts.html` + `production-shifts/app.jsx` (React 18 via unpkg, JSX transpiled
in-browser by Babel standalone — the only React page in the repo) and `roland-printer-supplies.html`
(85-line static page: intro, PDF link, JotForm embed).

1. 🔴 **Development React builds in production** — `react.development.js` + `react-dom.development.js`
   (≈1 MB unminified, dev-only warnings, slower render) had shipped to staff since launch. Now the
   `production.min` UMD builds, integrity hashes computed from the files (`openssl dgst -sha384`).
   Babel standalone stays — precompiling JSX would need a build step nobody else uses; its one console
   warning ("in-browser Babel transformer") is expected and documented in ACTIVE_FILES.
2. **Master-table rows were `<tr onClick>`** — no keyboard path, nothing announced. The name cell is
   now a real `<button aria-pressed aria-label="Kanha Chhorn — show shift details">`; the row keeps
   its mouse click (`stopPropagation` so a button click doesn't toggle twice).
3. Timeline row labels + roster cards `aria-pressed`; the coloured timeline row is `aria-hidden`
   (its segments are a mouse convenience duplicating the row-label button).
4. Dept chips = `role=group aria-label` + `aria-pressed`; "Filter" caption decorative.
5. **Detail panel = `role=dialog aria-modal aria-labelledby=detail-name`** — `useEffect` focuses Close,
   Esc closes, focus returns to the trigger on unmount. 🔑 `onClose` MUST be a `useCallback` — an
   inline arrow re-creates the function every render, the effect re-runs and yanks focus back to
   Close on each keystroke.
6. Every `<button>` declares `type="button"`; scrim `aria-hidden`; focus rings for row/chip/card/
   label/close/print/ghost controls (`.row-btn` resets the button chrome inside the name cell).
7. Cache-bust `?v=` on `app.jsx` **and** `styles.css` (the CSS was still on `2026.05.26.4`).
8. **Roland**: 5 icons `aria-hidden`. Nothing else — one h1, no inline code, PDF is same-origin.
9. Lock: `tests/unit/production-small-pages.test.js`. Smoke on static-dist: prod builds load, row
   button → dialog with focus on Close, Esc → focus back on the row button + `aria-pressed=false`,
   Embroidery chip → 6 rows; 0 buttons without `type`.

Left alone: in-browser Babel (see 1); the timeline segments' `title` tooltips (mouse-only, duplicates
the detail panel); JotForm embed on Roland (third-party, not ours to fix).

## Steve's Queue (art-hub-steve) — review, 16 items (2026-09-05, `v2026.09.05.52`)

`dashboards/art-hub-steve.html` + `shared_components/js/art-hub-steve.js` (3.2K lines, kanban + notes +
broken-mockups) + `art-hub-steve-gallery.js` (1.1K, the grid) + the SHARED `art-actions-shared.js`
(1.8K — Send Mockup / Log Time modals, also loaded by ae-dashboard, art-request-detail, mockup-detail).
Live probe before: 21 inline `style=`, 31 inline `onerror=`, chips were click-only divs, no dialog
had a role, 6 bare icons.

1. 🔴 **Art hourly rate was `* 75` hardcoded in 18 places** in the shared module — including the
   `Cost:` written to Caspio `Art_Charges` by `logArtCharge()`. Now `artRate()` from Service_Codes
   **`GRT-75`** (`SellPrice` 75 today, so no behaviour change), loaded once at boot; until it lands or
   if the API fails every cost display appends `artRateNote()` — "⚠ fallback $75/h (…)" — never a
   silent fallback price (Erik's rule 2026-06-03). Lock forbids `* 75)` in the file.
2. **Rule 3** — 4 inline `onerror=` templates → `data-onerror="thumb|hide|hide-parent"` + ONE
   capture-phase `error` listener (guarded by `window.__sgThumbErrorsWired`); all page/gallery/kanban
   inline `style=` → classes in `art-hub-steve.css` (`.sg-head`, `.sg-bulkbar`, `.sg-card-selectbox`,
   `.is-selectable/.is-selected`, `.kanban-loading`, `.tool-btn-mark`); `[hidden]` guard added.
   **Left:** the approval modal's 10 `style="display:none"` internals — the shared module toggles
   them with `.style.display` on 4 pages; converting is a shared-module refactor for its own review.
3. **Status chips → `<button aria-pressed>`** inside `role=group`; clicking the ACTIVE chip returns to
   All (was a dead click). Select / Show Archive / Grid-Board carry `aria-pressed`.
4. **Cards had no keyboard path** (card click → `window.open`). The company title is now a real
   `<a class="card-open" target=_blank>` (the delegated handler lets it navigate itself — no double
   open); the rep name is a `<button aria-label="Filter by Nika">`.
5. **Dialogs**: notes panel (`role=dialog`, focus → type select, returns), approval modal (labelled
   by its title, focus → Close, returns — in the shared module so all 4 pages gain it), image modal
   (`<span class="close">` → `<button>`, Esc), broken-mockups modal (labelled, focus in/return), art-time
   modal (`role=dialog aria-labelledby`, focus → minutes, **Esc closes + returns focus**, `type=button`
   on every control, `for=` on the minutes label, stepper buttons named).
6. Tab strip = `<nav aria-label="Steve's tools">` with `aria-current=page` on Gallery; the Transfer
   Workflow strip is `role=group`; icons `aria-hidden`.
7. Load-more / bulk bar / kanban hidden cards / grid view use `hidden` (kanban "Show all" is a
   `<button>`; it used to select `[style*="display: none"]`).
8. `getDueBadge` (both files) → `parseCalendarDate` — Due_Date was UTC-parsed (day early).
9. Notes fetch error shows the reason + `type=button` Retry; loading/empty states use `hidden`.
10. `sg-count`, bulk count, notes badge = `role=status`.
11. Legacy Caspio-era `processCards()` archive toggle de-inlined (dead path but lint-clean).
12. Shared-module `?v=` bumped in all 4 consumer pages (lock checks they agree).
13. Lock: `tests/unit/art-hub-steve-page.test.js`. Smoke on static-dist (real proxy data, 312 requests):
    Submitted chip → "7 of 312", click again → 312; Select → bar visible (display flex via class, not
    inline), 30 checkboxes, Done → hidden; Log Time → dialog, focus on minutes, Esc → focus back on the
    card button; Send Mockup → dialog, focus Close, Esc → back on the card button, body scroll restored;
    Board → grid hidden, 236 kanban cards hidden, Show all → 0 hidden; rate live = 75, note ''.
14. 🔑 Static-dist has no backend: the Box picker 404s inside the Send Mockup modal — the modal
    shows "Box picker error" visibly (correct behaviour, not a regression).
15. Left alone: `confirm()`/`alert()` on Complete / bulk Complete (staff page pattern, consistent with
    earlier decisions); `refresh()` after every action re-fetches 200 rows (fine at this size).
16. ⏭️ Ruth's page (`mockup-ruth.js`, 1.5K) shares the same shared module — review next.

## Ruth's Queue (art-hub-ruth) — review, 15 items (2026-09-05, `v2026.09.05.54`)

`dashboards/art-hub-ruth.html` + `shared_components/js/mockup-ruth.js` (1.5K) + `dashboards/css/art-hub-ruth.css`.
Live probe before: **no h1**, 158 inline `onerror=`, 173 inline `style=`, chips display-only, tabs without
tablist semantics, cards showed **OVERDUE on the due date itself**.

1. 🔴 **Due TODAY read "OVERDUE" all day** — `isOverdue` did `new Date('2026-09-05') < new Date()`; the
   ISO date parses as UTC midnight = 5 PM the day before in Pacific. Now `parseCalendarDate` +
   `daysFromToday` (day-granular): today → "Due Sep 5", yesterday → OVERDUE. Same fix for `isDueSoon`,
   `formatDate`, `formatDateShort` (a day early before).
2. **No `<h1>`** → `sr-only` "Ruth's Queue — Digitizing Mockup Dashboard" (visible title is the breadcrumb,
   same pattern as Steve).
3. **Tabs = real tablist**: 4 `role=tab` buttons (`aria-selected`, roving `tabindex`, `aria-controls`),
   panes `role=tabpanel aria-labelledby`, ArrowLeft/Right/Home/End; the 4 external links sit in a
   sibling `<nav aria-label="Other tools">`. Both wrappers are `display:contents` so the flex row is unchanged.
4. **Status chips filter the queue** (were "display only" divs): `<button aria-pressed>`; click again
   clears; the On Hold chip opens the On Hold tab; empty state explains the active filter with a
   "Show all" link. (Steve's chips got the same treatment in `.52`.)
5. **Rule 3** — 2 inline `onerror=` (each ~80 chars of JS, ×79 cards live) → `data-onerror="box-parent|
   box-self"` + one capture listener that defers to `ArtActions.handleBoxImageError` when present;
   search bar / empty states / error / stagger delays / header rows → classes (`.rq-*`, `.mockup-span`,
   `--delay` custom property). `[hidden]` guard added; view toggle / kanban hidden cards / widget /
   loading use `hidden`.
6. **Quick actions were attributed to a hardcoded Ruth** (`author: 'ruth@…'`). Now `/api/crm-session/me`
   (fallback Ruth) — Erik or a covering artist acting on her page is recorded correctly.
7. **Billing Codes tab typed $50 / $75 / increments** → `loadBillingRates()` fills them from Service_Codes
   GRT-50 / GRT-75; `#billing-rate-note` says "Prices live from Caspio…" or "⚠ Could not verify…
   showing the reference values" (never a silent typed price — Erik's rule).
8. Load failure: reason shown, `role=alert`, **Retry re-fetches** (was `location.reload`); toast
   failures include the reason; toasts are `role=status|alert`.
9. Kanban cards `role=link tabindex=0` + Enter/Space (click already worked via the delegator's
   `data-href`); "Show all" is a `<button>`; hidden-beyond-limit cards use `hidden`.
10. Rep name → `<button aria-label="Filter by Nika">`; action buttons `type=button` + spoken labels
    ("Send Acme Co for approval"); thumbnails get the company in `alt`; SVGs `aria-hidden`.
11. Broken-mockups modal `role=dialog aria-labelledby`, focus → Close, returns on close.
12. Search input is `type=search` + `autocomplete=off`; count is `role=status`.
13. Lock: `tests/unit/art-hub-ruth-page.test.js`.
14. Smoke on static-dist (no backend → real failure path first): "Unable to load mockups (API returned
    404)" + Retry; stubbed data → 3 queue cards, today = "Due Sep 5", yesterday = OVERDUE; Submitted
    chip → 1 card / pressed; click again → 3; On Hold chip → tab 3 selected, tabindex 0/-1 roving;
    ArrowRight → Billing focused+selected; billing prices live ($56.25 for 45 min); Board → grid
    hidden, 5 cards `role=link`; 0 inline styles besides `--delay`, 0 handlers, 0 buttons without type.
15. Left alone: kanban column-header collapse is a click-only div (same on Steve's board — kanban.css
    shared; a future kanban pass); `pollNotifications` still polls as Ruth (`user=ruth@…`) — the
    notifications ARE for Ruth's queue regardless of who is looking.

## Design Queue + Monogram Dashboard + Names & Numbers Dashboard — review, 22 items (2026-09-05, `v2026.09.05.56`)

Three small Art-workspace pages shipped in one deploy.

**Design Queue** (`dashboards/design-queue.html` + `js/design-queue{,-briefs,-metrics}.js`) — already the
best-built page in the workspace (createElement only, `aria-pressed` chips, honest "locked" metrics blocks).
1. Verdict tiles (Ready to draw / Research first / Skip) → filter **buttons** synced two-way with the chips;
   click the active tile to clear; scrolls to the queue.
2. Every load failure now carries a **Retry**: queue (`boot()` re-runs `load()` + hides the banner), briefs
   (`load(root)`), store metrics (`load(true)`). Messages include the reason.
3. Icons `aria-hidden` (5 bare), banner close `type=button`, loading roots `role=status`, dead `heldBy()` removed,
   `[hidden]` guard. Lock: `tests/unit/design-queue-page.test.js`.

**Monogram Dashboard** (`dashboards/monogram-dashboard.html` + `shared_components/js/monogram-dashboard.js`)
4. 🔴 **5 inline `onkeyup=`/`onchange=` handlers** (Rule 3) → `input` (debounced) / `change` listeners.
5. 🔴 **Date filter compared UTC days** — `new Date(CreatedAt).toISOString().split('T')[0]`: an order created
   at 6 PM Pacific fell on the NEXT day's From/To filter. Now `localYmd()` (local calendar day).
6. `response.ok` checked before `.json()` on load / mark-printed / delete (a 500 used to surface as a JSON
   parse error); failure toasts + the load error carry the reason; load error has Retry (no inline style).
7. **Contact bar showed `orders@prior2.com`** — a foreign template leftover on an NWCA staff page → `sales@nwcustomapparel.com`.
8. Labels `for=` (5), `type=search`, icon-only action buttons named per order ("Delete order 140458"),
   `type=button` on all 7 buttons, `resultCount` `role=status` + table `aria-describedby`, breadcrumb labelled,
   `robots noindex` (was missing), inline `style=` → `.td-center` / `.breadcrumb-sep` / `.retry-btn`,
   `btn.style.opacity` → `:disabled` CSS, toasts announce.

**Names & Numbers Dashboard** (`dashboards/names-numbers-dashboard.html` + `shared_components/js/names-numbers-dashboard.js`)
9. KPI tiles → **status filter buttons** (`aria-pressed`, synced with the Status select; Total or the active tile clears).
10. **Filter as you type** (search + rep, debounced) and on Status change — the Filter button stays.
11. Rows `role=link tabindex=0 aria-label="Open roster …"` + Enter/Space (click = delegator `data-href`).
12. Load failure → reason + **Retry** (`data-call="dashboard.loadAll"`); result count `role=status`.
13. Edit link / Delete button named per roster (were icon-only); labels `for=`; inline `style=` → CSS;
    icons `aria-hidden`; `OrderNumber` escaped; toast `role=status aria-live`.
14. Lock for both: `tests/unit/art-small-pages.test.js`.

Smoke on static-dist: DQ tile → 3 rows + chip synced, chip Skip → tile synced; metrics 404 → notice + Retry.
Monogram (real proxy data): typing "zzzz" → "No monogram orders match these filters", future From date → No
results; 0 handlers / inline styles / bare icons / untyped buttons. N&N: Submitted tile → select=Submitted,
5 rows; Draft → empty message; Clear → Total pressed; row role=link with name.

## Digitized Designs + Old Designs (Caspio DataPage embeds) — review, 14 items (2026-09-05, `v2026.09.05.58`)

`dashboards/digitized-designs.html` + `js/digitized-designs.js` (restructures Caspio result rows into cards +
an "AL Pricing" modal) and `old-designs.html` + `shared_components/js/old-designs.js` (Megafile archive search).

1. 🔴 **AL pricing tables were hardcoded** in the Digitized page's JS (garment 10/9/8/7.50/7, cap
   6.50/5.50/4.75/4.50/4.25, $1.25/$1.00 per 1K, $50 LTM, Full Back $100 LTM). Now `/api/al-pricing`
   (Caspio Embroidery_Costs — the same feed `calculateALPrice` uses in the quote builder); the tables are
   the FALLBACK only and `#al-source-note` says "Prices live from Caspio…" or "⚠ Showing reference prices —
   Caspio pricing unavailable (…)". Base stitches / per-1K rates / footnotes / LTM tags all render from the data.
2. 🔑 **Caspio rows with a BLANK Design Number** — the unfiltered search returns ~24 records whose Design
   Number, Company and Cust_ID are empty (cards read "#"). The DST filename (`26664.dst`) carries the
   number, so the card now shows "#26664 (from DST file)" with a tooltip; a truly blank row says "no design
   number". This is a Caspio data-quality issue, surfaced rather than hidden.
3. **Rule 3** — inline `onerror="this.style.display='none'"` on card images → `data-onerror="hide"` +
   capture listener; overage columns / DST dd / nav buttons / counters use `hidden` (`[hidden]` guard in
   both CSS files); fallback-copy textarea → `.sr-copy` class.
4. Thumbnails: Digitized wraps them in `<button class="img-btn" aria-label="Enlarge …">`; Old Designs makes
   Caspio's own `<img>` `role=button tabindex=0` — Enter/Space opens the preview on both.
5. Image modals `role=dialog aria-modal aria-label` + a real Close button; focus → Close, returns to the
   thumbnail; Esc closes. AL modal `aria-labelledby` its title, Close named, focus in/return.
6. Details toggle `aria-expanded` + `aria-controls`; AL button named per design; mockup links `rel=noopener`.
7. **Caspio watchdog** (both pages): 15 s with no form / row / error element → visible "The Caspio list
   did not load" + Reload button (a dead DataPage used to leave a silent blank card).
8. Old Designs: injected Copy / Share buttons `type=button` + `aria-label` (title-only before); hover-only
   `.card-actions` also reveal on `:focus-within`; result badge / spinner / empty state `role=status`;
   toast `role=status|alert`; modal chevrons `aria-hidden`; sticky "Edit Search" typed.
9. `?v=` added to both pages' CSS/JS links (were unversioned).
10. Lock: `tests/unit/caspio-design-pages.test.js`.
11. Smoke on static-dist (Caspio embeds load there): Digitized company search → "#27141 109-15 Divers
    Institute", AL modal open → focus Close, note "Prices live from Caspio Embroidery_Costs.", tiers
    1-7 +$50.00 LTM $10.00 / cap $6.50, Esc → focus back on the AL button; img-btn Enter → preview,
    Esc → back. Old Designs blank search → 24 rows, 48 typed+named actions, 24 keyboard thumbnails,
    "~23,544 designs found" badge role=status, Enter on a thumbnail → dialog with focus on Close, Esc → back.
12. Left alone: Caspio form labels/inputs (Caspio-rendered, already labelled); the 24-per-page estimate
    in the badge (Caspio's own paging); no server-side design-number backfill (Erik's call in Caspio).
