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

## Design Vault + 253gear Publisher — review, 9 items (2026-09-05, `v2026.09.05.60`) — Art workspace COMPLETE

Both pages were already the strongest in the workspace (textContent renderers, drawer focus trap +
lightbox, Retry on every fetch, honest "locked" metrics). Fixes are hygiene:
1. **236 bare icons** live on the Vault → `aria-hidden` across the HTML + 4 renderer modules (static
   `<i class="fas fa-x">` and the dynamic `'<i class="fas ' + icon + '">'` pattern).
2. Tier pills / source chips → `aria-pressed`; density buttons `aria-pressed` + spoken names; customer
   portfolio button named; boot bar is a `role=progressbar` with `aria-valuenow`.
3. Layout values via custom properties: boot bar `--w`, virtual-scroll spacers `--h`, blank thumbnails
   `.is-blank`, `overflow-anchor:none` moved into CSS — no `.style.width/height/visibility` left.
4. Publisher: 8 status lines (`gp-ocr-status`, dup check, copy status, word count, counter, publish reason,
   blockers, job body) → `role=status`; step rail `aria-current="step"` follows the wizard; upload
   progress bar `role=progressbar` + `--w` (was `style="width:"`); `[hidden]` guard in its CSS.
5. `?v=` bumped on all 5 Vault assets + 4 Publisher assets.
6. Lock: `tests/unit/art-tools-pages.test.js`.
7. Smoke on static-dist: Vault pills toggle pressed (All→Standard), density wall/comfortable pressed,
   boot bar `--w` 97% + valuenow 97, spacers/anchor via CSS, 0 bare icons / unnamed buttons / inline
   styles; Publisher rail `step` follows Next/Back, all 8 statuses announce, blockers list + config 404
   surfaced in the banner (no backend locally).
8. 🔑 The Vault's design index is same-origin — static-dist shows "Building search…" with 0 results;
   the real page was verified live before the change (37,731 designs).
9. Left alone: Vault card grid semantics (`role=grid` with virtualised rows — a deeper ARIA pass for
   another day); Publisher `Ctrl+V` screenshot OCR (works, untestable without the proxy).

**Art workspace done (2026-09-05):** Steve `.53`, Ruth `.55`, Design Queue + Monogram + Names & Numbers
`.57`, Digitized + Old Designs `.59`, Vault + Publisher `.60`. Next: Office workspace.

## SanMar Payables — review, 14 items (2026-09-05, `v2026.09.05.62`) — Office workspace begins

`dashboards/sanmar-payables.html` + `js/sanmar-payables.js` (586) + the SHARED `sanmar-invoice-viewer.js`
(also loaded by purchasing-portal + ae-mission-control).

1. 🔴 **UTC "today"** — `todayIso()` / `isoDaysAgo()` used `toISOString().slice(0,10)`. After 5 PM Pacific
   that is tomorrow: the default To-date, the 90-day From-date and the **import-stamp date** written when
   Erik clicks "Mark imported" were all a day ahead every evening. Confirmed on static-dist at 8 PM:
   UTC said 2026-09-06, the page now says 2026-09-05. → `localIso()`.
2. 🔴 **Imported cross-reference failure was silent** — `loadImports().catch(() => { importsLoaded = true; render })`:
   if `/api/staff/sanmar-invoices/imports` failed, every open invoice rendered **NOT IMPORTED** and looked
   like fresh work to re-import. Now the status line says "⚠ Imported status unavailable (HTTP …) — every row
   shows as not imported" with a Retry (Erik's #1 rule).
3. 🐛 **Load-error row was overwritten** — the invoices error row was replaced by "No open SanMar payables in
   this date range" as soon as the imports/ShopWorks feeds landed and re-rendered the table (found during
   smoke). `state.loadError` now keeps the error + Retry row until a load succeeds.
4. Retry on both tabs' failures (messages said "refresh to retry"); banner text without the refresh advice.
5. Tabs = real tablist: `aria-selected`, roving tabindex, `aria-controls`, ArrowLeft/Right; panels `aria-labelledby`.
6. "Open payables" / "Not imported yet" tiles → filter buttons synced with the Show select (`aria-pressed`);
   click the active one → back to "Not imported & unpaid"; disabled until the cross-reference has loaded.
7. Upload `<label for=file>` → `role=button tabindex=0` + Enter/Space; View buttons named per invoice
   ("View SanMar invoice 161194119").
8. Status regions: sw-status, updated, older-hint, mkt-updated, projnote, selected count; marketing bar is a
   `role=progressbar` with live `aria-valuenow`; bar + month bars via `--w` (no `.style.width`).
9. 32 icons `aria-hidden`; banner close `type=button`; `[hidden]` guard; `?v=` on css/js/viewer.
10. **Shared viewer**: title said **"SanMar Invoice — WO #undefined"** whenever a page opened it by PO only
    (Payables always does) → "PO 114323" when there is no WO; `aria-labelledby`; focus → Close, returns to the
    View button (`returnFocus` option); Esc only when open; icons decorative. All three consumers now load
    the same `?v=` (they were on two different versions).
11. Lock: `tests/unit/sanmar-payables-page.test.js`.
12. Smoke on static-dist: 404 → error row + Retry AND the imports warning + Retry; stubbed data → 2 rows,
    "1 marked imported (your log)", CR-005820956 matched via zero-strip, "Open payables" tile → filter open /
    2 rows, again → needimport / 1 row; viewer title "PO 114323", focus Close, Esc → back on View; ArrowRight →
    Marketing tab selected/focused, bar `--w` 4.3% + valuenow 4, month bar `--w`.
13. Left alone: the 2026 marketing allotment default ($35,110.95) typed in JS — it is editable on the tab and
    is an allotment, not a price; the 15-min ODBC feed silence when empty (documented "optional" by design).
14. ⏭️ Purchasing Portal + AE Mission Control carry the viewer change — smoke both when their turn comes.

## Payroll + Forms Inbox + Forms Library — review, 18 items (2026-09-05, `v2026.09.05.64`)

**Payroll** (`dashboards/payroll.html` + `js/payroll.js`, admin-only)
1. 🔴 UTC "today" ×3: the "accrues <date>" pill (`eligible > toISOString()`), `VC.buildSlipFigures` default
   `today`, and the **printed slip run date + audit CSV** were a day ahead after 5 PM Pacific → `todayLocal()`
   (also passed explicitly as `today:` to the carryover module; its unit tests already pass `today`).
2. Tabs → tablist (`aria-selected`, roving tabindex, `aria-controls`, arrows); panels `role=tabpanel`.
3. Retry on all three loads (leave balances / pay periods / register) with the reason; `[hidden]` guard; `?v=`.

**Forms Inbox** (`dashboards/form-submissions.html` + `js/form-submissions.js`)
4. 🔴 **`manual-lead` rows rendered the raw id** "manual-lead" with a generic file icon (every lead typed on the
   Leads board) — no `FORM_META` entry. Now "Manual Lead". A **"Leads" chip** (quote-request, sample-request,
   manual-lead — `data-form` accepts a comma list) joins the filter row; the lead types had no chip at all.
5. 🔴 `Date_Returned` written to Caspio as `toISOString().slice(0,10)` (UTC) when marking a sample returned →
   tomorrow's date after 5 PM → `localToday()`.
6. Tiles: "New this week" toggles the status filter to New (`aria-pressed`, synced with the select); the two
   sample tiles open the Samples Tracker. Chips `aria-pressed`; tabs → tablist + arrows; panels labelled.
7. Load failure → reason + Retry in both roots (was "Refresh to retry"); a Refresh button on the Samples card.
8. Detail dialog: focus → Close, returns to the row's View button; Esc only when open; copy-id button named;
   action message `role=status|alert`; inline `style="width:100%"` → `.sw-preview-body`; 41 icons `aria-hidden`.

**Forms Library** (`dashboards/forms-library.html` + `js/forms-library.js`)
9. Load failure → reason + Retry (`boot()`); action links named per form ("Download or print X (PDF, opens in
   a new tab)"); 54 icons `aria-hidden`; banner close typed; `?v=` (assets were unversioned).
10. Lock for all three: `tests/unit/office-forms-pages.test.js`.
11. Smoke on static-dist: Payroll 404 → 3 Retry rows; stubbed → "accrues 2026-09-06" for an eligible-tomorrow
    employee (UTC today was already 09-06); ArrowRight → Pay Periods selected/focused. Inbox 404 → 2 Retry
    buttons; stubbed → "Manual Lead" badge, Leads chip → 2 rows, New tile → status New / pressed, sample tile →
    Samples tab focused; detail → focus Close, Esc → back on View. Library live data (proxy): 6 categories,
    29 rows, named links.
12. Left alone: `window.prompt` for the return condition (staff pattern); `window.confirm` before an art push.

## Jim's Mailing List + Commission Structure — review, 11 items (2026-09-05, `v2026.09.05.66`)

**Jim's Mailing List** (`dashboards/jim-mailing-list.html` + `js/jim-mailing-list.js`) — Jim's page; big type, one job.
1. 🔴 **Empty screenshot placeholder + "Remove" button visible on every load** — `.jml-ai-thumb-wrap`,
   `.jml-welcome`, `.jml-filterbar`, `.jml-list-actions` are `display:flex`, which beats the UA `[hidden]`
   rule; the page had no `[hidden]` guard. One CSS line fixes all four (the welcome row would also have shown
   an empty portrait when the session lookup failed).
2. "Your companies / All companies" + the group chips carry `aria-pressed`; list count `role=status`.
3. Load failure shows the reason + **Try again** (was "Your list could not load."); portrait `error` → `hidden`.
4. "Choose a screenshot" `<label>` wrapped a hidden file input (unreachable by keyboard) → `for=` + `role=button
   tabindex=0` + Enter/Space, input visually hidden with a name; icons decorative; banner close typed; `?v=`.

**Commission Structure** (`dashboards/commission-structure.html`, static reference)
5. **22 inline `style=`** → classes in `commission-structure.css` (`.cs-lead`, `.cs-h3`, `.detail-table .num`,
   `.cs-mt*`, `.cs-legacy/.cs-new`, `.scenario-icon--danger/ok/warn`).
6. **Accordion headers were click-only `<div>`s** → `<button type=button aria-expanded aria-controls>`;
   `toggleAccordion()` keeps `aria-expanded` in step; contents carry ids; button chrome reset in CSS.
7. 28 icons `aria-hidden`; scenario icon tiles `aria-hidden`; CSS `?v=` (was unversioned); `[hidden]` guard.
8. Lock: `tests/unit/office-misc-pages.test.js`.
9. Smoke on static-dist: Jim thumb-wrap `display:none` while hidden (was flex), welcome hidden, 404 → reason +
   Try again, stubbed → view All pressed + filter bar flex, Mine → filter bar/actions none; Commission 0 inline
   styles, 3 accordion BUTTONs, click → `aria-expanded` false,true,false, th.num right-aligned.
10. Left alone: `window.confirm` before delete / Mailchimp sync (deliberate friction).
11. ⏭️ Next: Volume Quote, Blog Editor, SEO Strategy, then Quote Management + Purchasing Portal + Product
    Manager + the reference/admin pages.

## Volume Quote + Blog Editor + SEO Strategy — review, 12 items (2026-09-05, `v2026.09.05.68`)

**Blog Editor** (`dashboards/blog-editor.html` + `js/blog-editor.js`)
1. 🔴 **Every error showed an EMPTY red banner** — the page's banner span was `.dash-error-text` but
   `DashPage.showError` writes `.dash-error-banner-message`. Save failures ("NOT saved: …"), upload failures
   and list failures all rendered as a blank red bar. Fixed + a Dismiss button (the helper wires it).
2. Failed live preview used to keep the previous render on screen (a stale preview lies about what publishes)
   → "Preview unavailable (HTTP …) — keep writing, it retries on the next keystroke"; `!r.ok` now throws.
3. List failure → reason + Retry (was "Refresh to retry"); banner cleared on success.
4. Toolbar icon buttons named (Bold / Italic / Bullet list / Insert link / Quote); "Upload image" + "Insert
   image" `<label for=file>` → `role=button tabindex=0` + Enter/Space, inputs visually hidden with names;
   "Hero image" label (no control) → labelled group; 15 icons `aria-hidden`; `[hidden]` guard; `?v=`.

**Volume Quote** (`dashboards/volume-quote.html` + `js/volume-quote.js`) — pricing math untouched.
5. Default "valid until" (today + 30) was `toISOString().slice(0,10)` → a day late after 5 PM Pacific → local.
6. Remove-style buttons named; 12 icons `aria-hidden`; save status `role=status`; banner close typed;
   `[hidden]` guard; `?v=` on css/js (were unversioned).
7. 🔑 Left alone on purpose: `CreatedAt_Quote`/`AddedAt` are stamped `toISOString().replace(/\.\d{3}Z$/,'')`
   (UTC wall-clock, no Z) — the SAME convention every quote builder uses (`embroidery-quote-service.js`),
   so VQ stays consistent. Whether Caspio should hold UTC-no-Z vs Pacific wall-clock is a system-wide call
   (CaspioDate treats naive stamps as Pacific) — flagged for Erik, not changed page-by-page.

**SEO Strategy** (`dashboards/seo-strategy.html`, static)
8. TOC `<nav aria-labelledby>`; scroll-spy sets `aria-current="true"` on the active link; 4 icons
   `aria-hidden`; banner close typed; `?v=`; `[hidden]` guard.
9. Lock: `tests/unit/office-content-pages.test.js`.
10. Smoke on static-dist: Blog 404 → banner "Unable to load posts (HTTP 404)." (visible text now) + Retry;
    stubbed → 1 row, editor opens, preview 500 → "Preview unavailable (HTTP 500)…"; VQ valid-until
    2026-10-05 (UTC would be 10-06); SEO first TOC link `aria-current`.
11. Left alone: VQ `loadReps` silent fallback to free text (rep name is free text by design); the Blog
    `beforeunload` guard.
12. ⏭️ Next: Quote Management hygiene (25 bare icons, 3 unnamed buttons — it had its own deep review
    2026-09-05.2), Purchasing Portal, Product Manager, then the reference/admin pages.

## Quote Management (hygiene) + SanMar Inbound Calendar + box labels + Purchasing Portal (hygiene) + Product Manager — 12 items (2026-09-05, `v2026.09.05.70`)

Quote Management and Purchasing Portal had their deep reviews earlier on 2026-09-05 (`.2`, `.1`); this pass
is what those left: icons, the shared Inbound Calendar modal they open, and the print-label template.
1. **Inbound Calendar modal** (`js/sanmar-inbound-today.js`, opened from Quote Management): 7 inline `style=`
   (method chip colours, right-aligned Qty/Cost cells, method border colour, calendar heat) → `--c` / `--bg`
   custom properties + `.sit-r`; 2 inline `onerror=` (artwork tile swap, print-sheet logo) → `data-onerror`
   + one capture-phase listener; `modalEl.style.display` ×4 → `hidden` (+ `.sit-modal[hidden]` in its CSS);
   `role=dialog aria-modal aria-label`; focus → first control, **returns to the header button** on close/Esc.
2. **Box-label print template** (`shared_components/js/box-label-template.js`): method colour via `--m` on
   `.sl-type` (border + name), `style="flex:1.7"` → `.sl-fill--wide`, artwork `onerror` → `data-onerror`
   + listener (guarded `window.__slLogoErrWired`). `box-label-template.test.js` still green.
3. Quote Management: 9 + 23 bare icons `aria-hidden` (incl. the dynamic `${icon}` template and the three
   spinner swaps); every `title`-only button also carries `aria-label` (3 were unnamed live); all 5 QM assets
   `?v=` bumped.
4. Purchasing Portal: banner close typed, 6 icons `aria-hidden`, viewer CSS `?v=` aligned, `[hidden]` guard.
5. **Product Manager**: load failure → reason + Retry (was "Please refresh"); Edit / View buttons named per
   style ("Edit CTJ140", "View CTJ140 in the catalog (new tab)"); opening the form focuses the first editable
   field, closing returns focus to "Add product"; empty-thumb placeholder named; icons `aria-hidden`;
   `[hidden]` guard; `?v=`.
6. Lock: `tests/unit/office-ops-pages.test.js`.
7. Smoke on static-dist: QM 0 bare icons / 0 untitled-only buttons; Inbound Calendar → `display:flex`,
   `role=dialog`, focus inside (day-step button), 0 non-custom-property inline styles, Esc → `display:none`
   + focus back on the header button; Product Manager (real proxy data) 35 rows, "Edit CTJ140", Add →
   focus `fStyle`, Close → focus `pmAddBtn`.
8. 🔑 Custom-property inline styles (`style="--c:…"`) are the sanctioned form for computed colours/sizes —
   the lock regex allows `style="--` and nothing else.
9. Left alone: QM 5-minute visible-tab refresh; the Inbound modal's `window.print` flows (printed on real
   paper by Bradley — not exercised here).
10. ⏭️ Next: the admin + reference pages (api-usage, access-admin, drive-access, bandit-integration,
    contract-break-even, policy-migration, table-usage-audit, sanmar-ftp-integration, sanmar-shopworks-converter,
    the 4 API reference pages), then AE Mission Control, pricing-analysis (GENERATED — edit Python, not HTML)
    and price-audit-report.

## 13 admin + reference pages — hygiene sweep, 9 items (2026-09-05, `v2026.09.05.72`)

api-usage · access-admin · drive-access · bandit-integration · contract-break-even · policy-migration ·
table-usage-audit · sanmar-ftp-integration · sanmar-shopworks-converter · caspio-api-reference ·
manageorders-api-reference · sanmar-api-reference · shopworks-odbc-reference. All small, all already
Rule-3 clean; the sweep is what the earlier passes left.
1. ~90 bare icons `aria-hidden` across HTML + JS templates; every `title`-only button also named.
2. Banner close `type=button` on the 4 pages that lacked it; `[hidden]` guard added to all 13 page CSS files.
3. Every page asset now carries `?v=` (5 pages had unversioned CSS/JS links, incl. the converter's vendor
   PapaParse/xlsx scripts) and all page-asset versions bumped so the guards ship.
4. **api-usage**: meter fill / row share / trend bars via `--w`/`--h` custom properties (no `.style.width`,
   no inline width/height).
5. **table-usage-audit**: inline `style="color:…"` placeholder → `.tua-none`.
6. **sanmar-shopworks-converter**: three `style="display:none"` nodes → `hidden` (+ `role=status`/`alert`);
   the `show()` helper toggles `hidden`.
7. **Retry instead of "please refresh"**: drive-access `fail()` appends a "Try again" button (+ `role=alert`);
   policy-migration `boot()` renders Retry in the content root; ODBC reference renders Retry under the
   catalog and its banner carries the reason.
8. Lock: `tests/unit/admin-reference-pages.test.js` (13 parametrised page checks + specifics).
9. Smoke on static-dist: api-usage meter `--w` computed width, bars `--h`; converter status/results
   `display:none` via `hidden`; drive-access 404 → "Try again" + `role=alert`; policy-migration 404 → Retry;
   ODBC reference schema (static JSON) renders with 0 bare icons; bandit page 0 bare icons.

## AE Mission Control (hygiene) + Pricing Analysis + Price Audit Report — 8 items (2026-09-05, `v2026.09.05.74`) — ALL 54 linked pages now deep-reviewed

1. **Mission Control** (`dashboards/js/ae-mission-control.js`, 2.7K — deep review was `.5`): bar widths
   (`aemc-bh-fill`, kicker, condensed) and ladder marker positions via `--w`/`--x` custom properties — no
   `.style.width/left`, no inline `width:`/`left:` strings; the existing lock's regex now accepts the custom
   properties. **"Refresh to retry." ×12 panel messages → a one-click `Reload to retry` button** (one
   delegated `[data-reload]` listener); the two banner texts drop the advice. Modal scroll lock via
   `body.is-modal-open`; 42 + 15 icons `aria-hidden`; banner close typed; `?v=` bumped. The UI harness
   (`tests/ui/test-ae-mission-control.html`) re-synced with `node scripts/sync-test-harness.js`.
2. **Pricing Analysis is GENERATED** — edited `scripts/build-pricing-analysis.py` (2 header icons
   `aria-hidden`, `CSS_VER`/`JS_VER` bumped) and re-ran it; structural self-check OK; the HTML diff is
   exactly those 4 lines. Never hand-edit the HTML.
3. **Price Audit Report** (static export): 14 icons `aria-hidden`, CSS `?v=` (was unversioned).
4. Lock: `tests/unit/ae-mc-reports-hygiene.test.js`.
5. 🔑 **API Usage meter "0px" scare** — after `.73` the live meter read `--w: 85%` yet `width: 0px`, even with
   `width:300px !important` inline, while a fresh child rendered fine. Cause: `.au-meter-fill` has
   `transition: width .24s` and Claude-in-Chrome's tab is a background tab — CSS transitions never advance,
   so the computed value stays at the start (0). `transition:none` → 85% instantly. Same trap as the hidden
   Browser pane (`DASHBOARD_REVIEWS` § Verification gotchas). Not a bug; nothing changed.
6. Smoke on static-dist: Mission Control stops at the login check without a backend ("Could not confirm
   your login: HTTP 404"), so the panels never render locally — the `Reload to retry` markup is covered by
   the jest lock and verified live; 0 bare icons, banner close typed, 0 non-custom-property inline styles.
   Pricing Analysis 33 tables / 0 bare icons; Price Audit Report 0 bare icons, CSS versioned.
7. Left alone: Mission Control's 5-minute refresh and confetti; the Price Audit Report is a frozen export
   (regenerate from its source when the numbers are refreshed).
8. **Sweep complete**: every page linked from the staff dashboard (54 hrefs) has had a review pass in
   this series (`.24` → `.74` today). Remaining known debt is listed per section as "Left alone".

---

# CUSTOMER-FACING PAGES (public) — second sweep, begins 2026-09-05

## Public batch B1 — 5 legacy pages (webstore-info · inventory-details · dtg-compatible-products · pricing-negotiation-policy · design-view), 14 items (2026-09-05, `v2026.09.05.76`)

Lock: `tests/unit/public-legacy-pages.test.js`. Four of these PUBLIC pages still carried whole `<style>` + `<script>` blocks and `onclick=`/`onerror=` handlers (Rule 3); design-view had 4 inline handlers and display toggles.

1. **Rule 3 extraction** — `<style>` → `pages/css/<page>.css` (+ `[hidden]` guard), inline script → `pages/js/<page>.js` (inventory-details stays an ES module: `<script type="module" src>`). All `on*=` handlers → listeners. Everything versioned `?v=2026.09.05.76`.
2. **webstore-info** — FAQ questions are `role=button tabindex=0 aria-expanded`; sample-store image opens a real dialog (`role=dialog aria-modal`, close button, Esc, focus return); the "mobile menu" button only ever `alert()`ed "Full implementation needed" → hidden; icons decorative.
3. **inventory-details** — pricing dropdown is a disclosure (`aria-haspopup/aria-expanded/aria-controls`, Esc closes); colour options are keyboard buttons with `aria-pressed`; search results are `<button data-style>` with escaped text (was `onclick="navigateToProduct('${style}')"` string-interpolated into HTML); swatch colour via `--swatch` custom property (82 inline styles gone); the breadcrumb product name is now the page's `<h1>` (had none); `console.log` removed.
4. **dtg-compatible-products** — proxy host from `APP_CONFIG.API.BASE_URL` (was the Heroku host hardcoded in the page); 🔴 the grid had `style="display:none"` while the script set `.hidden=false` — the inline style won, so the grid could never show → `hidden` attribute; empty state is honest ("Products could not be loaded (…)" + Retry) instead of a blank grid; cards are keyboard `role=link`; image fallback via one capture-phase error listener; 3 inline `<p style>` → classes; card-template icon decorative.
5. **pricing-negotiation-policy** — back-to-top toggles `hidden`; smooth anchors; icons decorative.
6. **design-view** — lightbox is `hidden` at rest (a visible-to-AT `aria-modal` dialog at opacity 0 before), fade via reflow + `.active`, focus to Close and back; 🔴 the Escape listener was registered AFTER `init()`'s early `return` (no design number → no Esc) → registered unconditionally; hero/grid items are buttons; `data-onerror="hide|hide-parent"`; company/name lines use `hidden` not `.style.display`.

**Verification** — static-dist smoke of all 5 (webstore FAQ/modal/Esc, inventory `?style=PC54` disclosure + 82 keyboard colours + visible "Failed to load inventory" on the 404 path, DTG grid `display:grid` with 11 cards via the proxy, lightbox open/Esc/hidden), eslint clean, lock 9/9, consistency suites green.

**Left alone** — the universal header component injects its own `<style>` + 3 bare icons + 2 inline styles on every public page (shared component, separate batch); `pages/inventory-details.html` still has no visible product image (by design); `design-view` fetch error copy unchanged.

## Public batch B2 — storefronts (custom-tees · custom-caps · custom-stickers · custom-banners · 2 success pages), 9 items (2026-09-05, `v2026.09.05.78`)

Lock: `tests/unit/public-storefront-pages.test.js`. These pages were already Rule-3 clean (external CSS/JS, no handlers); the work was hygiene + one rule violation.

1. 🔴 **Silent hardcoded proxy fallback removed** in all 4 storefront scripts (`custom-tees-app`, `custom-caps-app`, both success scripts): `API_BASE` was `APP_CONFIG… || 'https://caspio-pricing-proxy-…'`. Rule 6 + Erik's #1 rule — a missing config now shows a `role=alert` toast ("Pricing is unavailable right now… call 253-922-5793") on the studios and flips the success page to its error panel, instead of guessing a backend.
2. **Icons decorative** — 36 (tees) + 34 (caps) + 6 + 6 (success) in HTML, plus the JS templates including the dynamic `<i class="fas ${…}">` ones.
3. **Hidden file inputs named** (`art-input`, `front-input`, `back-input` had no accessible name — the visible "Upload" button is a sibling).
4. **"(optional)" hints** on stickers/banners were `style="font-weight:400"` ×6 → `.stk-optional` in the shared `instant-quote.css`.
5. **Tees zoom lightbox** scroll lock via `body.is-modal-open` (was `body.style.overflow`).
6. **Success pages**: `console.log` ×3 each removed (webhook-skip line kept as `console.info`).
7. **Versions** bumped on every touched asset.
8. **inventory-details follow-up** (B1 live find): colours were rendered BEFORE the fallback colour was resolved, so with no `COLOR` in the URL no swatch showed as selected → populate after resolution.
9. Verified: static-dist smoke of all 6 pages (prices render via the proxy: stickers $87/$98/$153, banners $10/sqft, 138 tee tiles, 9 caps; success page lands on its error panel with no session, one visible h1).

**Left alone** — success pages keep 4 `<h1>` inside mutually-exclusive `hidden` state panels (one visible at a time; AT sees one); `thumb.style.backgroundImage` for uploaded-art previews (data URLs — legitimately dynamic); `rightsAck.ts = toISOString()` is a real timestamp, not a calendar day; the universal header's own inline styles/icons (shared component, separate batch); 🔍 the AI-artwork band's 5 `loading="lazy"` images reported not loaded in the hidden preview — re-check live in a visible tab.

## Public batch B3 — lead forms + account pages (request-a-quote · webstore-inquiry · order-status · company-webstores · quote-view · customer-portal · customer-invoice · customer-login), 10 items (2026-09-05, `v2026.09.05.80`)

Lock: `tests/unit/public-forms-account-pages.test.js`.

1. **request-a-quote / webstore-inquiry** — the shared form assets (`nwca-form-shared.css`, `nwca-form-dates.js`, `nwca-form-styles.js`) were the ONLY unversioned assets on the public forms → `?v=`; icons decorative (HTML + the upload-status template in `request-a-quote.js`).
2. **order-status** — icons decorative incl. the dynamic step icon; `[hidden]` guard added to its CSS (the state panels rely on the attribute).
3. **company-webstores** — 32 bare icons → decorative (`/pages/webstore-info.html` 301s here; the legacy file fixed in B1 is retired — flag for deletion, see below).
4. **quote-view** — 🔴 proxy host was hardcoded in the class (`this.apiBaseUrl = 'https://caspio-pricing-proxy…'`) → `APP_CONFIG.API.BASE_URL` (page now loads `/config/app.config.js`); only product-image lookups depend on it, so a missing config logs an error and the placeholder glyph shows. The rendered product modal + style cells used `onclick="window.quoteViewPage.…"` ×3 → `data-qv-close-modal` / `data-qv-group` with one delegated click + Enter/Space listener; style cells are `role=button tabindex=0`; modal close is `type=button aria-label="Close"`; 6 template icons decorative; `[hidden]` guard.
5. **customer-portal** — `/api/crm-session/me` failure was `r.ok ? json : null` → the account panel silently showed "—"; now throws and prints "Unavailable — refresh to retry" + console.error. Reward-window "today" was `toISOString().slice(0,10)` (UTC) → local calendar day (a 4–5 PM Pacific redemption on the last day would have read as tomorrow).
6. **customer-invoice** — `style="display:none"` ×2 + 4 `.style.display` toggles → `hidden` attribute + guard.
7. Verified on static-dist: quote-view boots on config and shows "Invalid quote URL"; customer-invoice + order-status land on their error panels (visible `display:block`); request-a-quote loads the versioned form assets with 22 fields; portal shows the visible account-lookup failure; company-webstores 0 bare icons outside the header.

**Left alone** — `quote-view.js` (5,261 lines) still has 122 `.style.` sites and 35 `display:none` inline styles in its HTML (the JS toggles them; a `hidden` migration is a dedicated job); its `console.log` calls are gated to localhost by `QV_DEBUG`; `pages/invoice.html` (`/invoice/:quoteId`) is STAFF-facing (28 display toggles) — not in this customer pass; `sample-cart`/`quote-cart` `<link rel=preconnect>` to the proxy host is a perf hint, not a data path; portal colour-picker `r.ok ? json : {colors:[]}` keeps the seeded ordered colours (acceptable, no wrong data); order-status/customer-login/success pages keep one `<h1>` per mutually-exclusive hidden state panel. 🗑️ **Dead file to delete (flag, not auto-deleted):** `pages/webstore-info.html` + the B1-extracted `pages/css/webstore-info.css` + `pages/js/webstore-info.js` — every route 301s to `/company-webstores`.

## Public batch B4 — content families (12 webstore pages · golf · safety apparel · laser tumbler · fall catalog · brands · contract pricing · resources/sale · richardson), 9 items (2026-09-06, `v2026.09.06.2`)

Lock: `tests/unit/public-content-pages.test.js`.

1. **Icons decorative** — 12 `*-webstores` pages (12–15 bare each, incl. the footer rep icons whose `g-footer__rep-icon` class the sweep regex had missed), golf-tournaments-2026 (33), golf-tournament-product (6), custom-safety-apparel (21), laser tumbler page (6) + its two JS templates (8 incl. dynamic status icons).
2. **fall-catalog** — empty-state "Clear filters" used `onclick="document.getElementById('fcClear').click()"` → `data-fc-clear` forwarded in `init()`.
3. **brands** — 🔴 proxy host hardcoded in `brands.js` → `APP_CONFIG.API.BASE_URL` (page now loads `/config/app.config.js`; missing config → the fetch fails → the existing error state, visible); Retry `onclick="location.reload()"` → `#brandsRetry` listener; `style="display:none"` ×2 + 4 `.style.display` → `hidden`; per-card `onerror="this.style.display='none'"` → `data-onerror="hide"` + one capture-phase listener; 9 `console.log` removed; `[hidden]` guard.
4. **embroidery-contract-pricing** — print button `onclick` → `#ecp-print` listener; `display:none` → `hidden` (JS toggles follow); the page CSS was unversioned → `?v=`; guard.
5. **resources / sale** — two identical inline `<style>` blocks (97 lines each) → shared `pages/css/simple-notice-page.css`; the header "Resources"/"Sale Items" `<h1 style=…>` duplicated the page h1 → `<p class="header-title">` (ONE h1 each).
6. **laser tumbler** — `#loading-spinner`/`#error-message` were CSS `display:none` toggled by `.style.display` → `hidden` attribute + guard (CSS default is now `display:flex` for the spinner, the attribute hides it); `#color-loading` inline style → `hidden`; `th style="text-align:center"` → `.pricing-table th.th-center` (a bare `.th-center` LOST to `.pricing-table th` — specificity, caught in smoke).
7. **custom-richardson** — 3 `style="cursor:default"` tiles → `.cch-tile--static` in the shared brand CSS.
8. Verified on static-dist: brands renders 46 cards with `hidden` toggles and 46 fallback-tagged logos; contract pricing shows 36 rows; laser shows $50/$18.50 with centred header and 0 bare icons; resources ONE h1 + extracted CSS applied (header green, 24px title); fall-catalog forward click reaches `#fcClear`; college-webstores 0 bare icons outside the header.

**Left alone** — the two golf EmailJS templates (`golf-tournament-*-emailjs-template.html`, 53 + 42 inline styles) are EMAIL bodies, inline CSS is required there; `index.html` 6 `display:none` inline styles are toggled by `catalog-search.js` `.style.display` (a `hidden` migration of the catalog search is a dedicated job); `product.html` `<link rel=preconnect>` to the proxy host (perf hint); brand pages (22) were already clean; `#universal-header-placeholder` component still injects its own `<style>`, 3 bare icons and 2 inline styles on every public page — the ONE remaining shared item, see B5.

## Public batch B5 — cart pages + JS-rendered shared components (universal cart header · sample-cart · quote-cart · PDP modules), 8 items (2026-09-06, `v2026.09.06.4`)

Lock: `tests/unit/public-cart-header-pages.test.js`.

1. **universal-cart-header.js** (sole consumer: dtg-compatible-products) — injected a 140-line `<style>` block on every render → extracted to `shared_components/css/universal-cart-header.css`, linked by the page; the cart indicator was a `<div onclick=… style="cursor:…">` → a real `<a href="/pages/sample-cart.html">` (keyboard + middle-click work) with a listener; badge `style="display:…"` + `.style.animation` → `hidden` + `.is-pulse`; 3 icons decorative. The page's 4 remaining unversioned shared assets → `?v=`.
2. **sample-cart** — 🔴 proxy host hardcoded (`const apiBase = 'https://caspio-pricing-proxy…'`) → `APP_CONFIG.API.BASE_URL` with a console.error when missing (prices then fail visibly in the cells); 9 `.style.display` toggles (badge, container, contact form, summary bar, shipping section, success) → `hidden` + guard; `onclick="removeItem(i)"` on a `<div>` → `<button data-remove aria-label="Remove …">` + delegated listener; render-error card `onclick="location.reload()"` + 4 inline styles → `.sc-render-error` classes + `.sc-reload`; 17 icons decorative; `console.log` removed; `escText()` added — `item.style` and `error.message` were interpolated into HTML unescaped.
3. **quote-cart** — size-list lookup host fallback removed (Rule 6); prices already go through the same-origin engine.
4. **PDP modules** — `product/components/inventory.js` print button `onclick="window.print()"` → container listener; `safety-stripe-recs.js` swatch `style="background:#…"` ×15 → `--swatch` custom property (+ CSS); head icon decorative; `cart-drawer.js` close button had no accessible name → `aria-label="Close cart"`, icon decorative. PDP live probe: 0 bare icons, 0 unnamed buttons.
5. Verified on static-dist: header renders from the linked stylesheet (green border, 0 injected styles, indicator is an `<a>` with pointer cursor, badge hidden at 0); sample-cart empty state hides form/summary via `hidden`, shipping toggle flips `hidden` both ways; PDP swatch computed `rgb(185,211,0)` from `--swatch`; drawer close named.

**Left alone** — `sample-cart-page.js` keeps 8 inline `style=` in item templates (spacing/colour only); `product/js/decoration-selector.js` is an ORPHAN (already flagged 2026-06-11, 9 bare icons + injected styles — delete, don't fix); `cart.js` is flagged dead since 2026-06-11 but is still loaded by `dtg-compatible-products.html` (the universal header reads the sample-cart localStorage itself) — candidate for removal from that page; quote-cart `r.ok ? json : null` on the size lookup falls back to the item's own sizes (no wrong data).

---

# CALCULATORS (staff) — Rule 3 extraction sweep, begins 2026-09-06

## Screen Print Pricing calculator — 9 items (2026-09-06, `v2026.09.06.9`)

Lock: `tests/unit/screen-print-pricing-page.test.js`. Erik: "fix the inline scripts on screen-print-pricing too … keep going until you are 100 percent satisfied."

1. **Rule 3** — 1,100-line inline `<style>` → `calculators/css/screen-print-pricing.css`; two inline `<script>` blocks (447 + 410 lines) → `calculators/js/screen-print-pricing-product.js` (before `pricing-pages.js`, order locked) and `…-page.js` (after `screenprint-pricing-v2.js`). Both wrapped in IIFEs; nothing outside used their functions (checked).
2. 🔴 **Proxy host hardcoded** in the product-details fetch → `APP_CONFIG.API.BASE_URL` (page now loads `/config/app.config.js` first; missing config → console.error, no guessed host).
3. **67 `console.log` lines** → `spLog`, gated to localhost / `?debug=1` (the `SCREENPRINT_API_TEST` / `SCREENPRINT_DEBUG` console helpers survive, gated).
4. **Six `style="display:none"` regions** → `hidden` + guard; 14 `.style.display` toggles → `.hidden`; the size-upcharge panel's 7-property "force visibility" hack (visibility/opacity/zIndex/…) removed.
5. **Swatch colours** via `--swatch` (was 3 inline background props per swatch ×82).
6. `alert('Failed to load manual pricing mode')` → inline `role=alert` card with the reason.
7. Template inline styles/icons → classes (`.sp-placeholder-icon`, `.sp-upcharge-icon`, `.sp-upcharge-empty`); 9 icons decorative.
8. **22 unversioned shared CSS/JS assets** → `?v=`.
9. Verified on static-dist: hero, product image, 2 thumbnails, 82 swatches with computed `--swatch` backgrounds, prices ($2.00/$75/$50), calculator + debug objects present, no console errors.

**Not a regression, pre-existing:** `#sp-size-upcharges-container` is empty/hidden on LIVE too (the v2 calculator renders its own upcharge info) — the panel code is effectively dormant. **Left alone (next batch):** the remaining 22 bare icons / 19 inline styles / 2 injected `<style>` blocks on this page come from SHARED components — `screenprint-pricing-v2.js`, `calculator-inventory.js` (whose inventory IIFE is ALSO duplicated inside `pricing-pages.js` — two identical `<style>` injections), `universal-header-component.js`.

## The other 7 inline-code calculators — Rule 3 extraction, 8 items (2026-09-06, `v2026.09.06.11`)

Lock: `tests/unit/calculator-pages-rule3.test.js`. dtf (805-line script, 2 style blocks) · dtg (1,416-line script, 1,250-line style) · embroidery (967 + 2 styles) · cap-embroidery-integrated (893) · digitizingform · monogramform · laser-manual (style only).

1. **Extraction, verbatim** — one `calculators/css/<page>.css` per page (+ `[hidden]` guard), one `calculators/js/<page>-page.js` per page at the same script position. Scripts stay at GLOBAL scope on purpose: `showLoading`, `loadProduct`, `fetchProductDetails`, `getTierForQuantity`… are called by name from the shared calculator scripts, so an IIFE would have changed behaviour.
2. 🔴 **Hardcoded proxy host** in dtf (1), dtg (5), embroidery (4), cap (4) → `<PFX>_API_BASE` from `APP_CONFIG` (pages now load `/config/app.config.js`; missing config → console.error, no guessed host).
3. **`console.log`** (69 dtf, 54 dtg, 1 + 1) → gated `<pfx>Log` (localhost / `?debug=1`). 🔑 The flag is `<PFX>_LOG_ON`, not `_DEBUG` — dtg already owns `window.DTG_DEBUG` (its console helper object) and the first name collided.
4. **Embroidery cascade** — a shared stylesheet (`additional-logo-pricing-table.css`) sat BETWEEN its two inline style blocks, so the second block is its own file linked at the original position (order locked).
5. **digitizingform** `<iframe onload="hideLoading()">` → id + `load` listener (the existing 10 s timeout fallback covers an early load).
6. **`alert()`** → inline `role=alert` cards (dtf manual-mode failure, dtg API error).
7. **Icons** decorative (10 + 14 + 17 + 18 + 8 + 5 + 8); remaining unversioned assets → `?v=`.
8. Verified on static-dist: dtf/dtg/embroidery/cap render 82/82/82/54 swatches with prices ($40.67/$24/$20 emb, $40.17/$23.50/$19.50 cap), digitizing iframe present + overlay hidden, monogram/laser-manual styled from the extracted CSS, no console errors.

**Left alone** — inline `style="display:none"` attributes + their `.style.display` JS toggles inside these page scripts (they are consistent with each other; a `hidden` migration is a per-page job); `laser-manual-pricing` shows 4 bare icons rendered by its shared script; 🔍 `calculators/js/christmas-bundles.js` fails to PARSE under eslint ("Identifier 'resetForm' has already been declared", two `function resetForm()` in one scope, lines 1417/4198) — legal in a sloppy classic script (later wins) but verify the page live; shared calculator components (`screenprint-pricing-v2.js`, `calculator-inventory.js`, `manual-mode-indicator.js`, `pricing-pages.js` with its duplicated inventory IIFE, `dp5-helper.js`, `dtg-page-setup.js`) still carry hosts / injected `<style>` / bare icons — next batch.

## Shared calculator components — 9 items (2026-09-06, `v2026.09.06.13`)

Lock: `tests/unit/calculator-shared-components.test.js`. The scripts every calculator page shares: `screenprint-pricing-v2`, `calculator-inventory`, `manual-mode-indicator`, `pricing-pages`, `dp5-helper`, `dtg-page-setup`, `universal-image-gallery`, `universal-header-component`.

1. 🔴 **Hardcoded proxy host** in five of them (v2's `|| 'https://…'` fallback, calculator-inventory ×2, pricing-pages, dp5-helper's `window.API_PROXY_BASE_URL` default, dtg-page-setup) → `APP_CONFIG.API.BASE_URL` with a console.error when missing. pricing-pages also carried an UNUSED `FALLBACK_API_BASE_URL = 'https://caspio-pricing-proxy-backup…'` + `usingFallbackApi` — a would-be silent host switch — deleted.
2. 🔴 **`app.config.js` was loaded AFTER `pricing-pages.js`/`dp5-helper.js` on dtf (and after `manual-mode-indicator.js` on dtg/emb/cap)** — a module-level `const` host read at parse time would have been empty. Now ONE config tag in `<head>` on all 5 pages, order locked.
3. **Injected `<style>` blocks** → real stylesheets: `calculator-inventory.css` (26 rules), `manual-mode-indicator.css` (111 lines), `screenprint-pricing-v2.css` (spin keyframes + loading/error/fee classes). Zero `<style>` elements on any calculator page now (was 2–3 each).
4. **`pricing-pages.js` carried a FULL DUPLICATE of `calculator-inventory.js`** (the second IIFE, 170 lines, injecting the same CSS twice) — deleted; every consumer loads the real file after it, so the later definition already won. Also its cart-era "View Cart" success toast (dead, injected a third style block) — deleted. 1,292 → 1,127 lines.
5. **Inline handlers** → delegated listeners: inventory bar (`data-calc-inv-toggle`, now `role=button tabindex=0` + Enter/Space), manual-mode exit button, v2 error-banner dismiss (`type=button aria-label="Dismiss"`).
6. **`console.log`**: pricing-pages 64, dp5-helper 33, dtg-page-setup 15, gallery 6, header 4, manual-mode 3, v2 1 → gated `<x>Log` (localhost / `?debug=1`).
7. **Icons** decorative (v2 20, inventory 3, manual-mode 3, pricing-pages 3); v2 cosmetic inline styles (fee note, tooltip list, tiers note, loading spinner, dismiss button) → classes.
8. `calculators/js/christmas-bundles.js` had TWO `function resetForm()` in one scope (the first, lines 1417–1441, was dead — the later one wins) and eslint could not parse the file → first removed; the file lints again.
9. Verified on static-dist (5 pages): `<style>` count 0 everywhere, config precedes pricing-pages, inventory bar renders from the linked CSS (flex, role=button) and expands to 11 rows on click, prices and swatches unchanged (82/82/82/82/54).

**Left alone** — v2's `style="display:none"` regions + their `.style.display` toggles (consistent pair, 2,525-line file); pricing-pages' 26 inline styles in the legacy price-card templates; `shared_components/js/dtg-config.js` (orphan, still has a host fallback — no consumer); `calculators/archive/*` pages (archived).

## Calculators — final hygiene pass, every remaining page (2026-09-06, `v2026.09.06.15`) — CALCULATOR SWEEP COMPLETE

Lock: `tests/unit/calculator-hygiene.test.js` (parametrised over all 19 non-template calculator pages + 7 page scripts).

1. **compare-pricing** — 18 inline handlers (`onchange="compareCalc.onX()"` ×17, `onclick`, `onkeypress`) → `data-change`/`data-call` through the shared `data-call-delegator.js` + an Enter-key listener; 🔴 the delegator resolves `window.compareCalc`, and the page's `let compareCalc` was NOT a window property (inline handlers see lexical globals; `data-call` does not) → `window.compareCalc = compareCalc` after construction — caught in the static-dist smoke (lookup did nothing). Page gained its `<h1>` (was a `div.page-title`); 13 + 7 icons decorative; 10 unversioned assets versioned; two inline styles → classes; debug logs removed.
2. **safety-stripe-creator** — 9 `onclick` → `data-call`; the four stripe tiles are `role=button tabindex=0` with Enter/Space; required-field asterisks via `.req`; 6 assets versioned; icons.
3. **webstores** — hero `onerror="this.style.display='none'"` → `data-onerror="hide"` + capture listener; 20 + 1 icons; 2 inline styles → classes.
4. **christmas-bundles** — 🔴 3 hardcoded proxy hosts in the page script → `CB_API_BASE` from `APP_CONFIG` (config script added to `<head>`); **185 `console.log`** → gated `cbLog`; 41 + 26 icons decorative (incl. two dynamic `fa-${…}` forms).
5. **service-price-cheat-sheet.js** — the ternary's hardcoded fallback host → `''` + console.error (Rule 6).
6. **manual-pricing** (11 + 3 icons, 9 versions, 2 inline spans), **custom-decal-pricing** (11), **sticker-manual-pricing** (22), **purchasingform** (5 + a debug log), **richardson-2025** (3 versions), **laser-manual-pricing** (6 inline icon/paragraph styles → classes) — icons decorative everywhere; `screenprint-pricing-v2.js` had 3 icons with an `id` attribute the regex had skipped.
7. Verified on static-dist: compare-pricing Enter → lookup → banner + method cards + 4 prices, a delegated `data-change` reaches `compareCalc.onEmbLTMQtyChange`; safety-stripe tile click AND Enter select (design area `grid`), `.req` red; webstores prices; christmas-bundles $213/$258/$295 with `CB_API_BASE` set; cheat sheet $75/$75/$25; laser-manual 0 inline styles, class colours applied.

**Left alone** — inline `style="display:none"` + `.style.display` toggle PAIRS in compare/manual/safety/christmas (consistent; a per-page `hidden` migration); christmas-bundles' 45 cosmetic inline styles in its HTML; `calculators/archive/*`; `shared_components/js/dtg-config.js` orphan.

---

# QUOTE BUILDERS — review, 9 items (2026-09-06, `v2026.09.06.18`)

Lock: `tests/unit/quote-builders-hygiene.test.js` (+ the existing `quote-builders-page`, `no-cdn-in-builders`, all `*-save-parity` / `quick-quote-parity` / `web-quote-cart-parity` suites green — NO pricing math touched, Rule 9). Synced across all four per Rule 8 by changing the SHARED delegator, not four copies.

1. **The delegator in `quote-builder-utils.js` now covers change / input / blur / keydown / image-error** — `data-change="a,?b"` (comma list, `?` = optional, the old `if(window.x)x()` guard), `data-*-args` JSON with `$this`/`$event`, `data-keyclick` (Enter/Space clicks a role=button), `data-enter` (+`-args`, `-unless="prop"`), `<img data-onerror="hide|hide-parent|no-image|placeholder-icon">`. The 2026-09-05 review had only converted `onclick=`.
2. **185 remaining inline handlers → attributes**: dtf 22, embroidery 38, screenprint 52 in the pages; dtf/emb/scp `product-rows` (19/21/19), emb `spr-modal` (10), emb `design-search` (2 escaped-quote `onerror`s) in the module templates. The parser converted every form mechanically (single/multi call, guarded, with args, Enter-only, Enter/Space-click, `!this._galleryMode`); zero left (`grep on\w+="` = 0).
3. **Icons decorative**: pages 34 + 14 + 88 + 24 + 6 + 34; modules ~150 (incl. dynamic `fa-${…}`); utils 14.
4. **Every builder asset versioned** (`tenant.js`, `fetch-timeout.js`, `product-category-filter.js`, `*-pricing-service.js`, `builders/*/index.js`, monogram's `quote-builder-common.css`).
5. **screenprint-fast-quote** — 370-line inline `<style>` + 170-line inline `<script>` extracted; 4 `onclick` → `data-call`/`data-href` via `data-call-delegator.js`; EmailJS from the jsdelivr CDN → the vendored copy (the `no-cdn-in-builders` rule now holds for this page too).
6. 🔑 **h1s NOT added**: an `sr-only` h1 on the four builders tripped the axe `heading-order` + `region` baselines (`tests/a11y/builders.a11y.test.js`), so the builders stay without an h1 by design; monogram + fast-quote already have one.
7. 🔑 **Logging gates hardened repo-wide** (16 files from the calculator sweep): `window.location.hostname` at module top threw in `scp-dark-garment-parity.test.js`, which evals `screenprint-pricing-v2.js` without a window → `typeof window !== 'undefined' && !!window.location && (…)`.
8. `utils` version bumped on every consumer page (builders + the other pages that load it).
9. Verified: full unit suite 4,079 passed (the only other failure, `tests/integration/pricing-baselines`, is the live-API integration test); jsdom test exercises every new delegator path; live check after deploy below.

**Left alone** — inline `style="display:none"` regions + their `.style.display` toggles in utils (61 sites, consistent pairs); ~150 cosmetic inline styles on the embroidery page (149) / screenprint (78) / dtf (50) — a classes migration is its own job; `confirm()` dialogs for destructive actions (deliberate).

---

# STAFF PAGES — LIVE PASS on teamnwca.com (signed in), 80 pages, 10 items (2026-09-06, `v2026.09.06.26`)

Lock: `tests/unit/staff-live-hygiene.test.js`. Method: collected every internal link from the signed-in dashboard (98), probed each page's RUNTIME DOM in Erik's browser (inline handlers, undecorated icons, injected `<style>`, unversioned assets, unnamed buttons, unlabeled inputs, h1), then traced every finding to its source file. The static locks from the 09-05 sweep had missed everything a script renders after load.

1. **`data-call-delegator.js` extended** — `data-input`, `data-open` (new tab), `<img data-onerror="hide|hide-parent|closest-class|parent-remove-class|call:obj.fn" data-onerror-else>` and `data-onload`.
2. **Garment designer (`/pages/garment-designer.html`)** had **64 inline `onclick`/`onchange`** in the page + 7 in its script → delegated (incl. `if(event.target===this)` overlays → `data-self-only`, and `this.value` args). It was the single biggest Rule 3 hole left on a staff page.
3. **AE dashboard** — 13 runtime handlers came from `mockup-ae.js` (6), `art-ae.js` (8: kanban collapse/show-all, gallery init/filter, new-tab opens, Box-image error fallbacks) and the art-card `onload/onerror` pair in `ae-dashboard.js` → `data-*`; `window.aeArtCardImageError` holds the placeholder SVG. 7 unlabeled inputs → the four submit-form templates' `<label>`s now carry `for=` (77 wired across mockup/garment/sticker-banner/JDS forms).
4. **Staff dashboard** Pride Wall tiles: `onerror="this.closest('.pw-tile').classList.add('pw-tile--dead')"` → `data-onerror="closest-class"` (bundle rebuilt by `scripts/build.js`).
5. **Injected `<style>` blocks → stylesheets** (7 scripts): `elapsed-time-utils` (art hubs/AE), `company-contact-picker`, `toast-notifications`, `universal-records-admin` (3 blocks), `embroidery-quote-pricing` (builders), `quote-session` (2), `universal-pricing-grid`; each consumer page links the CSS. 🔍 `dtg-product-recommendations(-modal).js` and `header-button-functions.js` also inject styles but have ZERO consumers — orphans, flagged.
6. **Employee-bundle pages** (`/streich-bros-bundle.html`, `/wcttr-bundle.html`) carried 230-line inline `<style>` blocks → `employee-bundles/css/*.css`; DrainPro tabs `onclick` → `data-call`, inline styles → classes.
7. **Icons**: any-attribute-order + dynamic forms hidden across 97 staff HTML + 38 scripts (policies suite alone had 103 + 23 + 21 + 26 + 16 + 14 in six scripts; dst-viewer 42 + 7; universal-records-admin 56; training pages 5–19 each). 🔑 The Design Vault's 110 "bare" icons are **intentional**: `<i class="dg-src fas …" aria-label="Art request">` source badges with accessible names — not defects.
8. **Unversioned assets** on 20 pages (`art-hub.css`, `dash-shell.css`, `fetch-timeout.js`, `dash-page-helpers.js`, `data-call-delegator.js`, `confetti.js`, training/calculator page assets) → `?v=`.
9. `pages/data-entry-guide.html` gained its `<h1>` (was a `div.page-title`); `screenprint-pricing-service.js` (27), `jds-api-service.js` (7), `art-actions-shared.js` (3) `console.log` gated.
10. Verified on static-dist: garment designer — `data-call` nudge reaches `designerNudge(-5,0)`, `pickSide('front')`, 3 self-only overlays, 0 handlers; AE dashboard 0 handlers, 0 injected styles, delegator + CSS links present; universal-records-admin toast rules load from the linked file; Design Vault toast CSS linked; full unit suite + a11y baselines green (Mission Control harness re-synced).

**Backlog (not linked from the dashboard, found by the lock's directory scan, deliberately out of this batch):** 33 second-hop/orphan staff pages with inline code — `dashboards/{bundle-orders-dashboard,embroidery-bonus-plan,staff-login,staff-portal-final}.html`, `admin/{announcements-create,announcements-manage,c112-bogo-promo}.html`, 21 `training/*.html` sub-guides/games (handlers), `tools/{cap-layout-mockup,css-diagnostic,decoration-selector-mockup,diagnose-*}.html`. Also: the `no-hardcoded-hosts` ratchet (222 literals) — ~40 `|| 'https://caspio-pricing-proxy…'` silent fallbacks in shared scripts are the next Rule 6 batch.

# UNLINKED STAFF PAGES — the 42-page backlog batch (2026-09-06, `v2026.09.06.30`)

Every `.html` under `dashboards/ admin/ training/ tools/ employee-bundles/` that the dashboard does not link (the live-pass lock's directory scan found them). Same rules as the live pass, applied by `fix-s2.py`:

1. **Inline code → files on 12 pages**: admin `announcements-create/-manage`, `c112-bogo-promo` (2 scripts), `dashboards/staff-login`, `staff-portal-final`, five `/tools/` diagnostic pages → `<dir>/css/<page>.css` + `<dir>/js/<page>-page.js` (verbatim, same position, global scope kept).
2. **227 inline handlers on 27 training/dashboard/tools pages** → `data-call` / `data-change` / `data-input` (+ `data-args`, `data-open`, `data-href`, `data-self-only`, `data-stop`) through `data-call-delegator.js`, which the script adds to any page that lacked it.
3. **h1 hygiene**: `sales-coordinator-training-schedule` had **12 `<h1>`** (every section) → `<h2>` + one sr-only `<h1>`; `nwca-language-reference` and `shopworks-embroidery-order-type` had two; `staff-portal-final` had an h1 as a section title; `shopworks-customer-setup-enhanced` had none.
4. Icons hidden (any attribute order), bare local assets versioned, `.sr-only` added to the two training stylesheets that host the new headings.
5. Lock: `staff-live-hygiene.test.js` STAFF_HTML now includes **every** page under those five directories (a new page is locked the day it is created).

**Reachability of the 42 (`reach.py`, grep of every HTML/JS/server.js for each filename):**
- **Linked, second-hop** (reachable, just not from a dashboard tile): most `training/*.html` (via `training/training-center.js` + `training/index.html`), `admin/announcements-*` (announcement bar), `dashboards/staff-login` (SAML fallback), `dashboards/embroidery-bonus-plan`, `bradley-*`, `sanmar-inbound-*` (linked from their parent pages).
- **Server-route only**: `dashboards/bundle-orders-dashboard.html` (a `server.js` route serves it; no menu).
- **ORPHANS — nothing links them**: `dashboards/finished-photos-poster.html`, `dashboards/staff-portal-simple.html`, `tools/cap-layout-mockup.html`, `tools/diagnose-css-override.html`, plus pages whose ONLY reference is their own extracted script: `tools/{css-diagnostic,decoration-selector-mockup,diagnose-search-issue,art-search,api-test-runner}.html`, `dashboards/{staff-portal-final,bonus-policy}.html`, `training/{sales-coordinator-training-schedule,shopworks-customer-setup-enhanced,shopworks-customer-setup-working,test}.html`.

**Recommendation for Erik (his question "should the 33 unlinked pages have buttons?"):** no — most are reachable already, and the orphans split two ways. (a) **Real tools worth a tile**: `bundle-orders-dashboard` (Christmas/BCA bundle orders — Office/Sales), `finished-photos-poster` (Production, if still used), `bonus-policy` (Company), `art-search` (Art). (b) **Developer diagnostics and leftovers to delete**: the five `/tools/` diagnostic pages, `staff-portal-simple`/`staff-portal-final` (pre-Workspaces portal indexes), `training/test.html`, `shopworks-customer-setup-working` (the `-enhanced` twin supersedes it). Nothing was deleted or tiled without his call.

# RULE 6 SWEEP S3 — proxy host from APP_CONFIG everywhere (2026-09-06, `v2026.09.06.31`)

1. **118 JS files** lost their `|| 'https://caspio-pricing-proxy…'` fallback (also ternary, direct-assignment, object-property and direct `fetch(HOST)` forms) → `APP_CONFIG.API.BASE_URL` + `console.error('[file] APP_CONFIG.API.BASE_URL missing — the proxy host is not configured')`. Accessor functions (`artwork-upload`, `monogram-dashboard`, `monogram-form-service`, `delivery-promise`, `design-thumbnail-service`, `quote-order-summary`, `sample-cart-service`) return `''` + the error; `dp5-helper.js` no longer seeds `window.API_PROXY_BASE_URL` with a literal; `training-center.js` throws.
2. **`/config/app.config.js`** added in `<head>` of 32 consumer pages; moved ahead of the first script on `index.html` (also lost `defer` — `brands-flyout.js` instantiates at parse time), `laser-tumbler-polarcamel`, `screenprint-customer`, both golf pages. `quote-cart.html` / `product.html` keep `defer` because every script there is deferred in order.
3. Script misfires caught in review: `dtg-quote-system.js` and `staff-dashboard-service.js` object properties had become `''` (the `[?:]` regex read the property colon as a ternary) → fixed to `CFG ? BASE + '/api' : ''` with the error line after the literal.
4. `bundle-orders.js`: a second `async function downloadOrderPDF` shadowed the first for its whole life → dead first copy removed (runtime behaviour unchanged, eslint parses again).
5. `no-hardcoded-hosts.test.js` `HOST_BASELINE` 222 → **42** (what remains: `lib/`, `scripts/`, `tools/seed-top-sellers.js`, `templates/`, the two `EXACT_ONE` literals, 3 `<link rel=preconnect>` hints).
6. `emb-margin-stitch-band` + `emb-nonsanmar-costplus` had been fetching the LIVE proxy from Node on every run → `new Calc({ skipInit: true })`.
7. **Verified live** (no `BASE_URL missing`, no relative `/api/` fetch, proxy calls present): public homepage (config tag first, `brandsFlyout.apiBase` + `searchService.baseURL` resolved), PC54 product page (25 proxy calls), screen-print calculator (6), sample cart; teamnwca.com art-hub-steve (4), embroidery quote builder (6), DTF calculator (config present, `API_PROXY_BASE_URL` resolved), monogram dashboard (1). The only console errors are the known `CO-ANNUAL-GOAL` fallback on the AE dashboard (Erik's open Caspio row).

# FINAL CENSUS — every page and script in the repo (2026-09-06, `v2026.09.06.33`–`.34`) — SWEEP COMPLETE

`final-census.py` scanned all 280 tracked, served HTML pages and every browser script for the sweep's rules (inline `<style>`/`<script>`, handlers, bare icons, unversioned assets, h1 count, hardcoded host) and computed reference counts for every JS file.

1. **69 dead files identified and DELETED (`v2026.09.06.35`, Erik: "i ran the git rm, now commit and deploy it")** — evidence per group in `memory/DEAD_FILES_2026-09-06.md`; `repo-hygiene-final.test.js` `DELETED_2026_09_06` asserts they stay gone; 50 ACTIVE_FILES + 30 GUIDE.md rows dropped. Smoke-tested live afterwards: staff dashboard, embroidery builder, AE dashboard, PC54 product page, webstores calculator — no 404s.
2. **Forms library (18 pages)**: 85 bare icons hidden, every local asset versioned, `box-label-form` got its h1; the three shared scripts (`nwca-form-save/-dates/-shared.js`) rendered 5 more bare icons per form at runtime (found only by the live probe, `v2026.09.06.34`) — now decorative and in the renderer lock.
3. **Vendor portals (3)**: the SanMar credits + invoices pages carried one IDENTICAL 178-line inline `<style>` each → `vendor-portals/css/sanmar-portal-shared.css`; the portal index → its own file; icons hidden, assets versioned. The 14 runtime `<style>` blocks that remain are the Caspio DataPage embeds + the Glasp extension.
4. **art-billing-reference**: `:root` theme block + style block → `pages/css/art-billing-reference.css`; the three `scrollIntoView` quick-nav buttons became in-page anchors (`html { scroll-behavior: smooth }`).
5. **quote-audit** print `onclick` → listener in its script; **embroidery-pricing** Headwear Note link (inline style + `onmouseover`/`onmouseout`) → `.emb-note-link`; **handbook** topbar title is now the page `<h1>` (the reader's 112 rendered chapter titles stepped down to `<h2>`, `margin:0` keeps the topbar look); **customer-invoice** got an sr-only h1; two `/tools/` diagnostics had relative unversioned assets.
6. **server.js**: `/ae-art-dashboard.html` + `/ae-submit-art.html` (a JS-redirect page and a meta-refresh page) → one real 301 to `/ae-dashboard.html`; the `art-tools` static mount removed.
7. **Locks**: `repo-hygiene-final.test.js` (every served page Rule-3 clean · no orphan browser script · dead files never resurrected); `office-ops-pages` pinned a version PREFIX (`2026.09.05.7x`) and broke on the deploy bump → numeric ≥ compare.
8. **Left alone, documented**: state-screen pages with one `<h1>` per mutually-exclusive state (`3-day-tees-success`, `custom-caps-success`, `order-status`, `customer-login`, `vendor-login`, `monogram-form` print titles) — one is visible at a time; inline `style=""` attributes (embroidery builder 149, screenprint 78, DTF 50, `quote-view.js` `.style.` sites) are not a Top-9 rule and would need a layout-by-layout CSS refactor; `reference/*.html` are documents, not pages; `richardson-caps/{docs,data}` and `calculators/archive/` are archives.
9. **Verified live**: invoices portal (stylesheet loaded, 0 bare icons, Inter font applied), art-billing (css + `--art-theme` var + 3 anchor links, smooth scroll), handbook (1 h1 / 112 h2), PTO form (0 bare icons after `.34`, date pickers named "Pick a date"), embroidery calculator (`.emb-note-link` dotted → styled, 0 handlers, 8 proxy calls), `/ae-submit-art.html` on the public host → 301 → staff login (gated target).

# EMAILJS RULE 6 + STATIC ACCESSIBILITY PASS (2026-09-06, `v2026.09.06.36`)

1. **EmailJS literals 69 → 10** (`no-hardcoded-hosts` `EMAILJS_BASELINE`; the 10 left are `calculators/archive/`). 25 served scripts had `emailjs.init('4qSb…')`, `emailjs.send('service_jgrave3', …)` or `EMAILJS_*` constants → every one reads `APP_CONFIG.EMAIL.PUBLIC_KEY` / `.SERVICE_ID` (the tenant getters in `config/app.config.js`) and logs `[file] APP_CONFIG.EMAIL.x missing — EmailJS is not configured` when absent. `app.config.js` moved ahead of its readers on `safety-stripe-creator`, `screenprint-fast-quote`, `richardson-2025`. 🔑 Reads are `typeof window !== 'undefined'`-guarded: `web-quote-service.js` is evaluated in Node by its test (the test now seeds `APP_CONFIG.EMAIL` for the require).
2. **Static accessibility census** (`a11y-census.py` over 243 served pages): 118 unlabelled form controls, 5 icon-only buttons, 3 empty links, 4 alt-less images, 19 pages without `<html lang>`, 2 without `<title>` — fixed on 28 pages by `fix-a11y.py`: a bare `<label>` beside a control gets `for=` (ids minted on `transfer-detail`, e.g. `notes`, `notes-2`), otherwise `aria-label` from the visible label span / placeholder / humanised id; `searchCloseBtn` "Close search", `toggleConfigBtn` "Show or hide configuration", Mission Control view-all "View all", `expressLaneLink` "Express lane", the Supacolor tracking link `aria-labelledby` its number; `productImage` `alt="Product image"` (JS overwrites with colour); golf product page `<title>`.
3. **12 webstore SEO pages were bare fragments** — no doctype, `<html>`, `<head>` or `<body>` (browsers rendered them in QUIRKS mode) → wrapped as real documents with `lang="en"`; verified live `document.compatMode === "CSS1Compat"`.
4. **Lock**: `repo-hygiene-final.test.js` gained a static-accessibility describe over every served page (email-template HTML excluded).
5. **Left alone**: `no-main` landmark on 115 pages (a layout-level change, not a defect a user hits); state-screen multiple h1s.
6. **Verified live**: transfer-detail 0 unlabelled controls; names-numbers buttons named; art-hub-steve `APP_CONFIG.EMAIL.SERVICE_ID` resolved, no EMAIL errors; public fast-quote + safety-stripe: config first, 0 unlabelled, service id resolved; company-webstores standards mode.

# CONSOLE SWEEP + PATH-AWARE ORPHAN LOCK (2026-09-06, `v2026.09.06.37`)

1. **~700 bare `console.log` in 68 served scripts** (screenprint-manual-pricing 35, quote-view 35, sample-order-service 32, shopworks-import-parser 31, dtf-pricing-calculator 30, …) → each file gets `var <PFX>_LOG_ON = localhost || ?debug=1; var <pfx>Log = … ? console.log.bind(console) : function () {};` after its leading comment / `'use strict'`, and every call becomes `<pfx>Log(`. `console.error`/`warn` untouched (those are the visible-failure channel). Lock: `repo-hygiene-final` "no bare console.log in a served script". 🔑 A prefix derived from `3-day-tees-success.js` starts with a digit — identifiers get a `p` prefix.
2. **Orphan lock made path-aware** — the first census matched referrers by basename, so a stale root copy hid behind its `shared_components/js` twin. Now a duplicated basename must be referenced by directory (or a sibling `./name.js` import for the builders' ES modules), and a root-level file only by a quoted `"/name.js"` (or bare from another root file). Found **5 more dead files** → `PENDING_DELETION` + `memory/DEAD_FILES_2026-09-06.md` § root duplicates: root `pricing-matrix-api.js` (byte-identical twin), root `dp5-helper.js` (632-line 2025 copy of the 938-line twin), root `utils.js` (diverged 2025-07; the DTG builder's `./utils.js` is its own), `app-new.js` (its explicit route removed from `server.js` — nothing ever requested it), `shared_components/js/quote-builder-base.js` (comment-only tombstone since 2026-07-08).
3. **Verified live**: screen-print calculator + PC54 product page (public) and quote-management + DTF builder (staff) — console silent, prices render, no failed requests.

# CALCULATOR CONSOLE ERRORS + CSP REPORT-ONLY CLEANUP (2026-09-06, `v2026.09.06.38`–`.39`)

Found by reading the customer-facing console AFTER the console sweep made it readable:
1. **`[SizeUpcharges] Section not found!` twice per load** on the screen-print calculator — `updateSizeUpchargesDisplay()` rendered a size-upcharge panel into `#sp-size-upcharges-section`, an id the page never had (it shipped 2025-11 with `#sp-size-upcharges-container`), so the panel had NEVER rendered; `screenprint-pricing-v2` shows size pricing in its own tooltip, so the function, its listener and the vestigial hidden container were retired (lock updated).
2. **`[DP5-HELPER] Final fallback … Caspio table not found after 7s`** (error) on the screen-print page — the legacy helper waited for a `#custom-pricing-grid` that page does not have; it now skips like the DTF branch. Absent `#color-swatches` (the calculators render their own `#colorSwatches`) is a debug note. `[PRICING-MATRIX-API] Creating alias` warning → debug.
3. **CSP**: helmet's default `upgrade-insecure-requests` was being sent in the Report-Only policy, which browsers reject and log as an error on EVERY page → `upgradeInsecureRequests: null`; `https://northwestcustomapparel.app.box.com` added to `img-src` (two report-only violations on the calculator + PC54 page).
4. **Six locks pinned a cache-bust version PREFIX** (`2026.09.05.3\d`, `.7\d`, `2026.09.`) — the `.38` bump broke two and October would break the rest → `\?v=\d{4}\.\d{2}\.\d{2}\.\d+`. ⚠️ My first fix chained `grep … && git commit` — grep matched the FAIL lines and the commit went in with failing tests; caught before phase B. Gate on the summary line, never on grep's exit code.
5. Second-pass dead files (path-aware orphan check) still pending Erik: root `pricing-matrix-api.js`, `dp5-helper.js`, `utils.js`, `app-new.js`, `shared_components/js/quote-builder-base.js` → `DEAD_FILES_2026-09-06.md` § root duplicates.

# RUNTIME CONSOLE AUDIT — 27 pages on both hosts (2026-09-06, `v2026.09.06.40`)

With debug logging gated, every page's console was read after load (clear → navigate → 6–9 s → read):
- **Clean**: homepage, catalog, PC54 product, embroidery + screen-print calculators, custom-tees, custom-caps, 3-day-tees, quote-cart, sample-cart, brands, custom-stickers, staff dashboard (only the known `CO-ANNUAL-GOAL` fallback), payroll, sanmar-payables, digitized-designs, blog-editor, supacolor-orders, quote-management, past-due, purchasing, AE dashboard, all four quote builders, art hubs, design-gallery, leads, company-numbers, garment designer.
- 🔴 **DTF calculator** requested `…/api/base-item-costs?styleNumber=${encodeURIComponent(styleNumber)}` LITERALLY (404 + "Alternative endpoint error" every load) — the S3 host rewrite had turned 7 template-literal URLs (dtf-adapter ×3, catalog-search ×2 cap pricing, bundle-orders ×2) into single-quoted strings. Restored; lock "no quoted URL string with an unexpanded `${…}`" (attribute strings inside template literals excluded).
- **Cap calculator (C112)**: `/api/sanmar/inventory/C112` is 400 "Product Id not found" for EVERY colour — Richardson caps are not SanMar items; the widget said "Please try again" → now "Live inventory is not available for this style (not a SanMar item)".
- **DTG calculator**: `[UniversalPricingGrid] Upcharge container not found` — the page shows size pricing in its tooltip; debug note now.

# RUNTIME A11Y PROBE + CSP REPORT STREAM (2026-09-06, `v2026.09.06.41`)

- Runtime probe (labels/names after JS render) on custom-tees, custom-caps, PC54 product, homepage, screen-print calculator, transfer-detail, names-numbers, quote-management, past-due, purchasing, AE dashboard, art-hub-ruth, design-gallery, leads, company-numbers, garment designer: only two misses — the homepage category search input (`app-modern.js`, now `aria-label`) and the v2 screen-print quantity-tier inputs (labels had no `for=`, now wired). `tests/a11y` (axe on the builders) green.
- **CSP report-only stream** (Heroku logs): the only violations are `script-src-elem: inline` on `vendor-portals/sanmar-invoices.html` — the Caspio DataPage embed injects inline scripts. ⏭️ **Enforce-day backlog**: Caspio embeds need a nonce or `'unsafe-inline'` scoped to those pages before the policy can be enforced; nothing in our own code trips it.
- Heroku logs (last 1,500 lines): no 5xx, no unhandled rejections.
- The DTF page's "Calculator not found yet" timing message is a debug note now.

# SCREEN-PRINT CALCULATOR: TIER STRIP FROM THE API (2026-09-06, `v2026.09.06.42`) — Rule #1 bug

Found while chasing the fee labels: `screenprint-pricing-v2.js` typed its quantity-tier buttons as **24-36 (+$75) / 37-71 (+$50) / 72-144 / 145-576** while live Caspio `Pricing_Tiers` for ScreenPrint are **24-47 (LTM $50) / 48-71 ($0) / 72-144 / 145-576**. The engine priced from the API (`findTierForQuantity` + `LTM_Fee`), so a customer at 50 pieces saw "+ $50 Small Batch Fee" and "$50 ÷ 50 = $1.00/piece" while paying no fee, and at 30 pieces saw $75 while paying $50 — confirmed on the live page before the fix.
1. `renderTierButtons()` builds the strip from `masterBundle.tierData|tiersR|tiers`: one button per tier (`sp-tier-<TierLabel>`, "min-max pieces" / "145+ pieces", fee note only when `LTM_Fee > 0`), an exact-quantity input + hint only for LTM tiers (`sp-qty-<label>`, `sp-ltm-calc-<label>`, clamped to the tier range), handlers wired per tier; `isQuantityInTier` / `collapseLTMTiers` / `expandLTMTier` / `isLtmTier` read the same list. Art-setup tooltip amount from Service_Codes `GRT-50`.
2. Lock (`calculator-shared-components`): no typed tier id / fee / "$75 Small Batch" in v2, `renderTierButtons` + `LTM_Fee` + `map['GRT-50']` present.
3. ⚠️ The scripted refactor's `cut(start, end)` between two markers removed 117 lines of unrelated methods (`updateColorToggles` …) — caught only because the local dev-server probe showed the calculator failing to construct. Restored from `git show HEAD:`, method list diffed against HEAD (0 missing, 6 added). 🔑 Assert the method count before/after any marker-based cut.
4. Dead duplicate `showError()` (alert) removed — the banner version always won.
5. Verified on the local dev server and live: 24-47 (+$50) selected with the exact-quantity input open, 50 clamps to 47 inside 24-47, 48-71 has no fee and no input, tier label + prices follow, console clean.

# DTG CALCULATOR: SUB-24 PRICING DISAGREED WITH THE ENGINE (2026-09-06, `v2026.09.06.43`) — Rule 9 gap

Caspio's DTG `Pricing_Tiers` now has **1-11 (LTM $50)** and **12-23 (LTM $0)** rows (12-23 has its own `DTG_Costs`; 1-11 has none). `dtg-canonical-pricing.js` — Quick Quote and the quote builders — resolves the row by quantity and reads its `LTM_Fee`. The customer DTG calculator (`calculators/dtg-pricing.html`) still typed "Less than 24 pieces + $50 Small Batch Fee" and priced every sub-24 quantity as **24-47 base + $50/qty**: LC on PC54 at 8 pieces $19.75 vs the engine's $20.75 (1-11 falls back to 12-23 costs), at 15 pieces $16.83 vs $14.50 (no fee).
1. Tier strip rendered from the API tiers (`#dtg-tier-list`); the exact-quantity box's range/fee copy are spans filled from the selected LTM tier; input clamps to that tier.
2. `getDTGPrice`: LTM tiers → `DTGCanonicalPricing.priceForLocationCombo` (same cost-row fallback as the builders); non-LTM → the service's strict path (missing cost row throws). LTM per piece = `DTGCanonicalPricing.ltmPerUnit(tier, qty)`.
3. Lock in `calculator-shared-components`. Parity suites green. Verified locally AND live against the engine computed from the live bundle: 8 → $20.75, 11 → $19.04, 12-23 → $14.50, 24-47 → $13.50, 72+ → $11.50.
   **Cross-surface check against the proxy's `POST /api/dtg/quote-pricing` (what Quick Quote and the builders call):** 8 pcs → tier 1-11 (LTM), subtotal $166 = $20.75/pc · 15 → 12-23, $217.50 = $14.50 · 30 → 24-47, $405 = $13.50 — identical to the calculator after `.43`.
4. Checked the other calculators: **DTF** builds its tier buttons from the API and reads `LTM_Fee` per tier (live: one LTM row, 10-23/$50) — ⚠️ it takes the FIRST tier with a fee as "the" LTM tier and `threshold = its max + 1`, so a second LTM row (as DTG now has) would need the DTG treatment. **Embroidery/cap** pages read the small-order fee live (`_ltmFeeLive`, visible fallback warning) and show the documented 1-7/8-23/24-47/48-71/72+ headers (stable since 2026-02; typed, so re-check after any embroidery tier change). `screenprint-manual-pricing.js` has the same typed strip but is loaded only by an ARCHIVED page → added to `PENDING_DELETION`.

# CROSS-SURFACE PRICING PARITY RUN — every customer calculator vs the shared engine (2026-09-06, `v2026.09.06.44`)

Erik: "so are you saying our pricing isn't the same for all the calculators… run the test." Method: on the Quick Quote page (staff, loads `quote-cart-engine.js` + services) call `QuoteCartEngine.singleItemPreview` for a fixed scenario set; then read what each customer calculator DISPLAYS for the same style/location/quantity.

| Method · scenario | Engine (Quick Quote / builders) | Calculator page | Match |
|---|---|---|---|
| SCP 1-color LC, PC54: 30 / 48 / 72 / 145 | $13.17 (incl. $50 LTM ÷ 30) / $11.00 / $11.00 / $10.50 | $13.17 / $11.00 / $11.00 / $10.50 | ✅ |
| DTG LC, PC54: 8 / 15 / 30 | $20.75 / $14.50 / $13.50 (proxy `/api/dtg/quote-pricing`) | same after `.43` (was $19.75 / $16.83 / $13.50) | ✅ after fix |
| EMB LC 8k, PC54: 5 / 8 / 24 / 48 / 72 | $34.00 / $24.00 / $20.00 / $19.00 / $18.00 | table S-XL: $34.00 / $24.00 / $20.00 / $19.00 / $18.00 | ✅ |
| CAP C112 8k: 5 / 24 / 48 / 72 | $33.50 / $19.50 / $17.50 / $16.00 | $33.50 / $19.50 / $17.50 / $16.00 | ✅ |
| DTF LC, PC54: 15 / 24 / 48 | $19.00 / $15.00 / $13.50 | **$0.00 / $0.00 / $0.00** → fixed `.44`: $19.00 / $15.00 / $13.50 | ✅ after fix |

🔴 **DTF was showing $0.00 to customers.** `dtf-adapter.js` fetched the garment cost ($3, `base-item-costs` 200) and then merged the sessionStorage copy over it: the merge assigned the stored object onto the target and the target onto itself, so a stored `garmentCost: 0` (the adapter persists its initial state on every update) won → `updateGarmentCost(0)` → "No garment cost" → $0.00 on every load after the first in a tab. Fixed: fresh URL/API data wins; a stored cost of 0 or for another style is dropped. Reproduced with a seeded stale copy on the dev server, then live.
🔑 This is exactly the check the repo lacked: the jest parity suites hold Quick Quote ↔ builders ↔ engine, but nothing compared a customer calculator PAGE (its own DOM + adapters + sessionStorage) with the engine. Two of five calculators were wrong today (DTG maths for <24, DTF $0.00) and one had wrong labels (SCP). ⏭️ Turn this table into a repeatable check (see backlog).

# ORPHAN SWEEP — 42 more files removed (2026-09-06, `v2026.09.06.46`; Erik: "get rid of the orphan files .. go for it")

Erik chose deletion over dashboard tiles for the four unlinked tools. Removed with their extracted CSS/JS: `bundle-orders-dashboard` (+ its `server.js` route), `finished-photos-poster`, `training/bonus-policy`, `tools/art-search`, `staff-portal-simple`, `staff-portal-final`, the five `/tools/` diagnostics, `training/test`, `shopworks-customer-setup-working`, the orphan `api-test-runner.css`; the six pending root files (stale `utils.js`/`dp5-helper.js`/`pricing-matrix-api.js` copies, `app-new.js`, the quote-builder-base tombstone, the archive-only manual screen-print calculator); and `product-filters/grid/search.js`, which only the deleted diagnostics loaded (the orphan lock found them the moment their pages went). `scp-dark-garment-parity` lost its manual-calculator describe. `DELETED_2026_09_06` = **111 files**; nothing pending. Full suite green, 445 assets in dist (was 461).

# REPEATABLE CROSS-SURFACE PARITY CHECK BUILT (2026-09-06) — `npm run test:parity:surfaces`

`tests/e2e/calculator-parity.spec.js` (Playwright, the existing e2e project: server.js on :3400 with the staff session). On the Quick Quote page it runs `QuoteCartEngine.singleItemPreview` for every LIVE tier of each method (tiers read from `/api/pricing-bundle`, so a Caspio re-cut reshapes the table instead of breaking it; LTM tiers use a mid-range exact quantity), then drives each customer calculator's strip and asserts the displayed price to the cent. First full run, all green (23 rows):

| SCP 1c LC | 24-47 @36 $12.89 · 48-71 $11.00 · 72-144 $11.00 · 145+ $10.50 |
|---|---|
| DTG LC | 1-11 @6 $22.83 · 12-23 $14.50 · 24-47 $13.50 · 48-71 $12.50 · 72+ $11.50 |
| DTF LC | 10-23 @17 $18.50 · 24-47 $15.00 · 48-71 $13.50 · 72+ $12.50 |
| EMB LC 8k (S–XL) | 1-7 @4 $36.50 · 8-23 $24.00 · 24-47 $20.00 · 48-71 $19.00 · 72+ $18.00 |
| CAP C112 8k | 1-7 @4 $36.00 · 8-23 $23.50 · 24-47 $19.50 · 48-71 $17.50 · 72+ $16.00 |

🔑 Locally it drives the installed Chrome (`channel: 'chrome'`) because this network's TLS interception blocks Playwright's browser download (`UNABLE_TO_VERIFY_LEAF_SIGNATURE`); CI uses the project's chromium. ~100 live proxy reads per run — run after a calculator/adapter/Caspio-tier change, not in a loop. Rule 9 in CLAUDE.md now names it.

# EMBROIDERY + CAP TABLES FROM THE API TIERS (2026-09-06, `v2026.09.06.47`) — the last typed tier structure

`calculators/js/embroidery-pricing-page.js` and `cap-embroidery-pricing-integrated-page.js` typed their five table columns (HTML `<th>`s + `basePrices.tier0…tier4` / `price1_7…price72` builders); the cap page also typed `LTM_FEE = 50` and a `quantity >= 72 → '72+'` ladder, and fell back to a typed `'24-47'` for small-order embroidery costs. Now `apiTiersFrom()` / `renderTierHead()` (shared helper text in both page scripts) build the header, the LTM column (`data-tier` on the `<th>`, `td.ltm-column` on the cells) and every per-tier price from `Pricing_Tiers`; the small-order copy (`#ltmCalculator h4 span`, `.pricing-note`) is filled from the LTM tier; the cap fee is the API tier's `LTM_Fee` (⚠ est. when absent); a tier without cost rows prices at the lowest tier that has one (the engines' rule). `updateLTMCalculator` on both pages addresses `td.ltm-column` instead of column index 1. The additional-logo tables (`emb-al-*` / `cap-al-*`, filled by `additional-logo-*-simple.js`) still key by label — noted as the remaining debt. Cross-surface parity spec green on all 10 rows; verified live.

# ADDITIONAL-LOGO TABLES FROM THE API TIERS + PARITY CHECK EXTENDED (2026-09-06, `v2026.09.06.48`)

`additional-logo-embroidery-simple.js` / `additional-logo-cap-simple.js` filled five typed cell ids (`emb-al-1-7` … `emb-al-72`) from the EMB-AL / CAP-AL bundle; the bundle also carries `tiersR`, so `renderTableFromTiers()` now builds the header row and the price row from those tiers (LTM column by `LTM_Fee`, cells keep `<prefix>-al-<TierLabel>` ids). The typed-id fill remains only as the no-tier-list fallback. The parity spec gained an additional-logo row per tier for EMB (AL service line, 8k) and CAP (CB service line, cap back 5k) — the engine prices a second logo as a SERVICE LINE, not in the unit price, so the check reads `serviceLines[code].unitPrice`. Engine calls are now paced (350 ms) with a 429 retry: an unpaced loop tripped the proxy's limiter ("Too Many Requests" / "size pricing unavailable"). Full run: **33 rows, all to the cent** (SCP 4 · DTG 5 · DTF 4 · EMB 5+5 · CAP 5+5). No typed tier label or fee remains on any customer calculator.

# BUILDER INLINE STYLES → STYLESHEET (2026-09-06, `v2026.09.06.49`; Erik: "start with the builders inline styles")

277 `style=""` attributes on the three builders (EMB 149 · SCP 78 · DTF 50; DTG 0). Census: 79 were `display:none` only and 49 more mixed `display:none` with decoration. Approach (`fix-builder-inline-styles.py`): split each attribute — **state** properties (display / opacity / visibility) stay inline because the builders' scripts toggle them (`el.style.display = ''` SHOWS an element by clearing the inline value; a class would keep it hidden, and 319 `style.display` writes exist); everything else moves to `shared_components/css/quote-builder-inline.css` as a hash-named class per distinct declaration set (196 attrs → 127 classes), `!important` because the builders' stylesheets carry 124+88+48 id-based rules that would otherwise outrank a class. Result: EMB 149→85, SCP 78→28, DTF 50→17 (all remaining are state). Verification: before/after full-page screenshots on the e2e server **0 differing pixels** on all three; `money-path` (10 tests: search → row → reprice → save on EMB/SCP/DTF) + axe green; a by-id scan found no builder script writing a moved property at runtime. 🔑 The e2e config now drives the installed Chrome locally (`channel: 'chrome'`) — this network blocks Playwright's browser download — so the whole e2e suite runs on Erik's machine again.

# `<main>` LANDMARK ON EVERY SERVED PAGE (2026-09-06, `v2026.09.06.51`; Erik: "go for it on the 115 pages")

Census: 230 served pages, 129 already had a `<main>` / `role="main"`, **97 did not** (the "~115" estimate included email templates and the React page). Approach (`main-apply.py`, a parser over the top-level `<body>` children, each classified pre = header/nav/skip-link/toolbar · post = footer/modal/toast/overlay/script · content): a page with ONE content child gets its tag **swapped** (`<div class="main-container">` → `<main class="main-container">`, every class/id kept so no selector or script changes — 70 pages); several content siblings get **wrapped** in a bare `<main>` from the first to the last (26 pages: the 14 g-header webstore pages, golf, box-labels, mockup-generator, quote-audit, the state+content pairs on customer-invoice / mockup-library). `production-shifts` is exempt — its React app renders `<main className="main">` into `#root`. Before applying, every page's stylesheets were checked for bare `main {}` rules (none) and `body >` / sibling / positional selectors on the moved elements (none real), and its scripts for body-relative insertions (none). Two real markup bugs fell out of parsing: the embroidery calculator's `.main-container` never closed (scripts sat inside it), and the thank-you-card guide wrote its placeholders as literal `<<Contact First Name>>`, which the browser parsed as an element — the text was invisible. Verification: full-page 1440-wide screenshots of all 96 pages on the e2e server before and after — **91 pixel-identical**; the 5 that differed were a loaded-at timestamp (data-entry-guide, quote-management), a random card shuffle (team-match-game), and two async loads the after-shot caught mid-flight (christmas-bundles product grid from the API — re-checked in the browser, 53 product cards render inside the new main; digitized-designs is a Caspio DataPage embed — verified on live). 182 unit suites + jsdom a11y/DOM green. Lock: `repo-hygiene-final` a11y findings now require exactly one main landmark per served page (`MAIN_AT_RUNTIME` exempts production-shifts). `builder-screenshots.spec.js` takes `SHOT_PAGES_FILE` so any page set can be before/after diffed. 🔑 The employee-bundle pages are served at ROOT paths (`/streich-bros-bundle.html`), not `/employee-bundles/…` — a screenshot list built from repo paths 404s on them.
