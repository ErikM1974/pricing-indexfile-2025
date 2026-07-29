# LESSONS LEARNED

Bug → root cause → fix → prevention. Newest first. **Hard limit 300 lines** — archive the
oldest resolved entry to `LESSONS_LEARNED_ARCHIVE.md` once this passes 250.

---

## A shared modal's CSS lived in ONE page's stylesheet — the other host printed the whole dashboard (2026-07-29)

**Problem.** `sanmar-inbound-today.js` is loaded by BOTH `quote-management.html` and
`ae-mission-control.html`, but every `.sit-*` rule lived in `quote-management.css`, which only
the first page loads. From AE Mission Control the modal opened `position: static` at
**y = 3862px** — ~3.8 screens below the fold, so the Inbound button looked dead — with no
scroll container, and **without `body.sit-printing > *:not(#sit-print-sheet){display:none}`**,
so printing a report or a box label would have printed the entire dashboard.

**Root cause.** A page-named stylesheet became a silent dependency of a *shared* component.
Nothing links the two: the JS loads fine, the modal builds fine, and the failure only shows on
the page nobody tests. It also leaned on that file's generic `.modal` / `.modal-content` /
`.btn-cancel` **and** its global `* { box-sizing: border-box }` — no stylesheet on the AE page
declares one, which by itself moved the panel 960px → 945px.

**Fix** (`d78e1391`). `dashboards/css/sanmar-inbound.css`, loaded by every host page. Block moved
**verbatim** (byte-identical, diffed), plus a scoped border-box reset and restatements of
`.modal`/`.modal-content`/`.btn-cancel` at `.modal.sit-modal` specificity (0,2,0) so they win
regardless of load order — self-contained, no dependency on any other sheet.

**Prevention.**
- **A shared JS component owns a stylesheet of the same name, loaded by every page that loads
  the JS.** Styles for `foo.js` never live in `some-page.css`. Grep for other offenders.
- **Verify a CSS refactor by computed-style diff, not by eye.** Snapshotting 519 elements × 41
  properties across three configurations (pre-split re-injected inline, and each new host page)
  proved 0 differences on quote-management.html — and caught a `font-family` I had "helpfully"
  pinned, which would have silently restyled the whole modal.
- **What a modal inherits is part of its contract**: `box-sizing`, `color`, `font-family` all
  came from the host page. List them explicitly before moving a component between hosts.

---

## Deleting a `requireStaff` route can UNGATE the file, not remove it (2026-07-29)

**Problem.** Retiring `/calculators/sticker-manual-pricing.html` meant deleting its
`app.get([...], requireStaff, …)` route. That route was the *only* thing gating a page whose AI
drawer could return customer email, phone, address, sales rep and payment terms.

**Root cause.** `app.use('/calculators', express.static(...))` is mounted a few lines below it.
The gated route existed *because* it sits earlier in the stack and wins. Remove it and the request
falls through to the static mount, which cheerfully serves the same file **to anyone** — so the
"removal" would have silently converted a staff-only page into a public one. The file was staying
on disk (flag-don't-delete policy), which is exactly what makes this reachable.

**Fix.** An explicit tombstone route at the old paths returning **410** with a signpost to the
replacements. Verified by status code, not by reading the diff: `410`, not `200`.

**Prevention.** **Before deleting any route, check whether a `static` mount covers its path.** If
one does, the route is load-bearing access control and deleting it is a privilege escalation, not
a cleanup — replace it with a tombstone or delete the file too. Same trap as the 2026-07-29
`express.static('.')` repo-root exposure, one layer down: *static mounts serve whatever the router
didn't claim.* Grep `app.use\(.*express.static` and compare against the path you're removing.

---

## A closed `<details>` still reports its old size — `checkVisibility()`, not `getBoundingClientRect()` (2026-07-29)

**Problem.** A layout test asserted that collapsing the Pride Wall hid its photo track:
`pw.open = false; track.getBoundingClientRect().height === 0`. It failed at **every** viewport
width — the track kept reporting 164.6px while the parent `<details>` correctly shrank 191px → 19px.
The widget was working; the assertion could never pass.

**Root cause.** A closed `<details>` hides its content with **`content-visibility: hidden`**, not
`display: none`. The subtree is skipped for rendering but **retains its last laid-out geometry**, so
`getBoundingClientRect()` returns the size it had when it was last open. `getComputedStyle(el).display`
is likewise still `grid`. Nothing about the element's own boxes says "I am hidden".

**Fix.** `!el.checkVisibility()` — it accounts for content-visibility, `visibility`, and opacity, and
correctly returns `false` inside a closed `<details>`. Alternatively assert on the *parent*
`<details>` height, which does collapse.

**Prevention.** Never probe visibility through the geometry of a descendant — measure the collapsing
container, or use `checkVisibility()`. This bites anything wrapped in `content-visibility`
(`<details>`, `content-visibility: auto` virtualization), and it fails *silently in the passing
direction* too: a "the panel is hidden" assertion written this way would pass while the panel is open.

---

## Three stylesheets declared the same grid; two had never applied (2026-07-29)

**Problem.** `.quick-access-grid` column tracks were declared in components.css (with `@container`
breakpoints), again in dashboard-v3-theme.css, and a third time in dashboard-v3-patch-2.css with
`!important`. Editing the first two did nothing, and it was not obvious why.

**Root cause.** components.css is inside `@layer components`; the theme and patch files are
**unlayered**. Unlayered styles beat *any* layered style regardless of specificity or source order,
so the container queries in components.css had never once matched — they looked live and were dead.

**Fix.** patch-2 §7 is now the single owner of the tracks; components.css keeps a 1fr base and the
theme keeps only the gap, each with a comment naming the owner.

**Prevention.** In this codebase `@layer` = "loses to everything in the theme/patch files". Before
editing a dashboard rule, check whether an unlayered file also declares it — and when a CSS edit
appears to do nothing, suspect layering before specificity.

---

## The 4 AM inbound printout missed 4 POs — the WA cartons sync in AFTER it prints (2026-07-29)

**Problem.** The Daily Inbound PDF Erik printed at **3:57 AM on 7/29** listed 8 POs / 17 boxes /
751 pcs / $5,956. SanMar's PSST freight manifest for ship-date 7/28 showed 4 more POs
(**142476, 113825, 113834, 113835** — 5 cartons, 126 pcs, $398) that UPS had already scheduled
for 7/29 delivery. Reloading the page at 4:03 AM gave the correct **12 POs / 22 boxes / 877 pcs
/ $6,354**. Nothing on the printed sheet was *wrong* — it was 6 minutes too early.

**Root cause.** All four are **WA-INV (Issaquah)** shipments that SanMar packed between
**4:58 and 6:55 PM PDT on 7/28**. The shipment sync writes those cartons to the Caspio
`shipments` table in the small hours; on 7/29 they landed **between 10:56:56 and ~11:02 UTC**
(3:57–4:02 AM PDT). `/api/sanmar-orders/inbound-today` caches its payload for **600 s**
(`sanmar-orders.js` → `orderCache.set(cacheKey, payload, 600)`), and the print builders render
`lastData` — the payload captured when the modal loaded. So a 3:57 AM print serves a payload
built at 3:56:56 AM, before the WA rows existed. WA is the worst case precisely *because* its
transit is 1 business day: an Issaquah carton packed at 6 PM is inbound **the next morning**,
with no slack for the sync to catch up. NV/AZ/TX/VA cartons get 2–5 days, so a late sync never
shows on their printout.

**Fix (operational).** Print the inbound report **after ~5:00 AM**, and hit **Refresh** on the
SanMar Inbound modal before printing or running Box Labels. Re-check any pre-5 AM printout
against that day's PSST manifest CSV.

**Prevention.** Treat `generatedAt` as the report's real timestamp, not the print time. Worth
building: have the "Print for…" flow force `load(true, viewDate)` first, or surface a banner
when `generatedAt` predates the last shipment sync. Same trap applies to Box Labels — labels
printed at 3:57 AM would have been 5 cartons short.

**Fixed 2026-07-29** (`b97868e2`): Print for…, Box Labels and the per-box label button all call
`syncBeforeOutput()` first — force `refresh=true`, re-render, then build the sheet — with a
2-minute freshness window so a printing session costs ONE re-pull, not one per sheet. A failed
re-pull shows an alert strip and prints **nothing**.

**Related drift found the same day (not fixed).** The calendar heat-map (`/daily-inbound`) and
the detail modal (`/inbound-today`) disagree on the *same* day: 7/29 = 13 PO / 478 pcs on the
calendar vs 12 PO / 877 pcs in the detail; PO 113805 sits on 8/4 in the calendar and 8/3 in the
detail. Calendar buckets on ship-date + transit **estimate** and sums the PO items table;
the detail view uses **UPS's real delivery date** and live carton contents. Clicking a "13 PO"
day and getting 12 reads as a bug to staff.

---

## Two syncs land AFTER the 4 AM inbound print — the second one blanked the box labels (2026-07-29)

**Problem.** POs 113825 and 113834 printed as **"Unmatched"** on the inbound sheet and, worse,
on the receiving box label: no company, no due date, no design, no contact, no rep, method
"Other". They were real orders — Stella Jones and All The Bases Youth Sports.

**Root cause.** Same shape as the carton lag above, different sync. `scripts/sync-manageorders.js`
runs on **Heroku Scheduler at 12:00 UTC = 5:00 AM PT**, an hour *after* the report prints, so a
work order written yesterday afternoon has no `ManageOrders_Orders` row when the sheet is built.
`inbound-today` reads only that archive, so it had nothing to show. `PurchaseOrders` resolves the
WO **number** but carries no customer (its only name column is `VendorName` = SanMar), which is
why the WO printed while the company didn't.

**Fix** (`a0e2bc6`). For any arriving work order missing from the archive, pull it from the
**live ManageOrders API** (`fetchOrderByNumber`). The API returns the *same field names* as the
Caspio columns, so rows drop into `moByIdOrder` unchanged. Pooled 4-at-a-time, capped at 25 per
request with a `console.warn` when it truncates — a silent cap would read as "nothing was
missing" when the sync is down.

**Prevention.**
- **Anything printed at ~4 AM is upstream of both syncs.** Before trusting a field on that sheet,
  ask which table feeds it and when that table is written — shipments ~4 AM, ManageOrders 5 AM.
- **A staff-facing view should not be limited to the archive's freshness** when the live source is
  one call away and the miss count is small. Archive first, live for the remainder.
- Two independent bugs, one date, one cause: *our copy* of the truth lagged the truth.

### The UI harness stalled because printing became async

Making print `await` a refresh broke `tests/ui/test-inbound-print.js`, which read
`#sit-print-sheet` on the same tick as the click. Converting it to `setInterval` polling then
stalled at profile 3 in a way that looked like an app bug — it wasn't. **A backgrounded tab
throttles `setInterval` to ~1 s and then to a crawl**, so a polling harness hangs while the page
underneath is perfectly healthy. `MutationObserver` fires on the DOM change regardless of tab
visibility — use it, never a timer, to wait for a node in a UI harness. (Second time this class
of trap has cost a debugging session; the first was throttled CSS transitions.) Also: wait for a
*new* node — the previous profile's sheet lingers until its 1500 ms cleanup, so "a sheet exists"
silently clones the previous profile.

---

## An audit measured our own broken meter and declared us on budget (2026-07-28)

**Problem.** An external code audit of Caspio call volume opened with "the cross-dyno rollup
shows 16,055 calls on 7/27 vs the 16,129/day budget — the July fixes already took you from
~22k to ~16k." Every savings estimate in it was then sized against that denominator. Caspio
billed **23,959** that day. We were at ~132% of pace, not at it.

**Root cause.** 16,055 was our own meter's known-low reading — the exact figure recorded one
entry below as the *under-count*. The audit read the number from `/api/admin/usage`, saw the
field labelled `mode: "rollup"`, and treated it as cross-dyno truth. It was one row from one
web dyno. The label was accurate about the code path and silent about the coverage.

**Solution.** Re-anchored on Caspio's own billing page and re-derived every estimate from it.
Then closed the biggest remaining hole: `sync-manageorders`, `check-zero-billing` and
`sync-commissions` build their own Caspio URLs with raw axios and never load `api-tracker`.
The global interceptor installs as a side effect of **loading** that module, so it attaches
**per-process** — the docs claiming it catches "any process that talks to Caspio" were wrong;
it catches any process that *loads the tracker*. ~950 calls/day were invisible.

**Prevention.**
- **A meter may not grade its own coverage.** Reconcile against the party that bills you,
  every time, before quoting a number to anyone — including to a tool you asked for advice.
- **A label describes a code path, not a guarantee.** `mode: "rollup"` was true and useless.
  When a field asserts scope, make it carry the evidence: row count, dyno list, first/last
  write. A scope claim nothing can falsify will eventually be believed while wrong.
- **Give an outside auditor your known-wrong numbers up front.** This audit was competent —
  it independently found the metering hole — but nobody told it the baseline was suspect, so
  it anchored on it and mis-ranked everything downstream. The brief is part of the tool.
- Sixth appearance this week of the same shape: **the error always points DOWN, and
  under-reporting reads as "we're fine."**

### The same audit's fixes had to be adversarially checked before shipping

Three of six proposed fixes would have introduced a silent wrong answer, each in the
"looks healthy, isn't" family — worth internalizing as a pattern, not three anecdotes:
- **`Promise.allSettled` status is not a completeness test.** `fetchAllCaspioPages` *resolves*
  with PARTIAL results when pagination fails mid-way, so `status === 'fulfilled'` is true for
  a truncated read. Test the DATA (`length > 0`, expected keys present), never promise state.
- **A cache TTL borrowed from a neighbour imports its freshness assumptions.** Reusing the
  1-hour `STATIC_TABLE_TTL_MS` for `Pricing_Tiers`/`DTG_Costs` would have quadrupled staleness
  on the tables Erik actually edits, and desynced DTG from `/api/pricing-bundle`, which reads
  the same two tables at 15 min. Match the TTL to the sibling that shares the table.
- **Failing only when EVERYTHING fails is failing open.** `/api/dtg/quote-pricing` 502'd only
  when every bundle was missing. A partial set still answered 200 — `priceLines()` drops the
  failing line but keeps its quantity in `combinedQty`, and the cart engine index-aligns items
  to a now-shorter array. Under-stated subtotal *and* mis-attributed line items. The
  any/all distinction in an error guard is a pricing decision.

## Our "day" was 7 hours off the vendor's, and the offset looked like thousands of missing API calls (2026-07-28)

**Problem.** Reconciling our Caspio call meter against Caspio's own usage chart showed a
persistent 30-40% shortfall — 23,959 billed vs 16,055 measured on 27 Jul. A full day went
into hunting the "missing" caller: audited Python Inksoft, the main app's runtime, every
`fetch`/raw-HTTP path in the proxy, and the Caspio account's API profiles. All clean.

**Root cause.** Two independent under-counts, and neither was an unknown integration.
(a) Heroku Scheduler runs every `npm run sync-*` job as a **one-off dyno** that lives for
seconds and exits via `process.exit(0)`. The rollup flushed on a 60-minute `setInterval`, so
it never fired there and SIGTERM never arrived — the table held `web.1` rows and nothing
else, hiding ~30% of traffic. (b) **Caspio buckets usage on the ACCOUNT timezone** — its
Integrations log header reads literally `Log date (UTC-07:00)` — while we keyed days on UTC.
Our "28 Jul" began at 5 PM Pacific on the 27th, so the two windows were never comparable.

**Solution.** Flush on a **call-count threshold** (250) instead of a timer, so a trigger
fires regardless of process lifetime; writes became **append-only deltas** (no read, no
read-modify-write race between concurrent dynos); auto-start metering from `api-tracker` so
any process talking to Caspio records, not just the one that loads `server.js`. And a single
`utils/account-time.js` now owns "what day is it" (DST-aware `America/Los_Angeles`), used by
the tracker, the rollup and the period window — they must agree, because the rollup looks
days up by the tracker's own key.

**Prevention.** **Before reconciling your number against a vendor's, match their clock —
check the timezone on their own log/report headers first.** A whole-day offset is
indistinguishable from missing data and will send you hunting a phantom. And **a time-based
flush cannot work in a short-lived process**: if a metric must survive processes you don't
control the lifetime of, trigger on *work done*, not on elapsed time. Both bugs shared the
signature that has now appeared five times this week — the error only ever pointed one way,
DOWN, and under-reporting always reads as "we're fine".

## A CSS specificity TIE pinned the Administration menu permanently open (2026-07-28)

Full entry archived to `LESSONS_LEARNED_ARCHIVE.md`. Durable part: **two rules with EQUAL
specificity are resolved by source order, so a later `max-height: none` silently beat the
collapse** — when a CSS edit appears to do nothing, count specificity AND check what comes
after it. See also the `@layer`-vs-unlayered entry above.

---

## A ratchet test sat red for 9 days because /deploy only runs test:parser (2026-07-28)

Full entry archived to `LESSONS_LEARNED_ARCHIVE.md`. The durable part: **`/deploy`'s smoke
gate runs `npm run test:parser` only, so a red ratchet anywhere else in `tests/unit/` does
not block a release** — run `npm test` yourself before shipping. And allowlisting a ratchet
entry is almost always wrong; it freezes the regression as acceptable.

---

## RBAC: an unlisted page defaults to OPEN, so half the Administration menu was public to staff (2026-07-28)

Full entry archived to `LESSONS_LEARNED_ARCHIVE.md`. The durable parts now live in CLAUDE.md's
Security Checklist: **an unlisted page defaults to any-logged-in-staff, so a new restricted page
needs a `Staff_Page_Access` row (or a spot in `ADMIN_DEFAULT_PAGES`)** — and **gating a page is
half the job; gate the routes that feed it with `requirePageAccess` too.**
