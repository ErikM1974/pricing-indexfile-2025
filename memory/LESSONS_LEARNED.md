# LESSONS LEARNED

Bug â†’ root cause â†’ fix â†’ prevention. Newest first. **Hard limit 300 lines** â€” archive the
oldest resolved entry to `LESSONS_LEARNED_ARCHIVE.md` once this passes 250.

---

## Bonus hero dial: money inside a fixed ring, and a CTA column that wrapped at every width (2026-09-01)

**Problem.** Erik: the Mission Control bonus meter circle "looks off." Two defects: the earned
amount ("$1,050.00" at 34px JetBrains Mono ≈ 184px) painted over the 176px ring's arc — its
clear centre is only ~129px — and the 208px CTA column wrapped below the dial at EVERY desktop
width, leaving an empty green corner bottom-right.

**Root cause.** (1) Variable-width money can't live inside a fixed-diameter ring; anything over
six characters collides. (2) A `flex-wrap` container places items on lines by their MAX-CONTENT
width (`flex-basis: auto`), and the unwrapped headline sentence measures ~1100px — the ladder
claimed the whole line and pushed the CTA down, so the ≤1100px media query never even mattered.

**Solution.** Redesign Option B (canvas artifact 2d3ed8c4, picked by Erik): the ring (r=52,
CIRC 326.73) holds only the percentage with the 85% tick; the dollars are HTML text beside it
(`.aemc-bh-earned`); `.aemc-bh-ladder` moved to `flex: 1 1 0` so the band stays
dial | ladder | CTA. Harness re-synced; verified at 1280px and mobile with worst-case strings
("$1,050.00", "118.4%").

**Prevention.**
- 🔑 **Never put a variable-width figure inside a fixed-size ring** — the ratio gets the meter,
  the number gets a free-standing hero figure beside it.
- 🔑 **In a `flex-wrap` container, line-breaking uses MAX-CONTENT width, not post-shrink
  width** — a long sentence in a `flex: 1 1 auto` sibling silently shoves later columns onto a
  new row; `flex-basis: 0` is the fix (keep `min-width: 0`).
- 🔑 The hero markup is drift-locked: run `node scripts/sync-test-harness.js` after ANY change
  inside `#aemc-bonus-hero`.

## First real custom-tees order: proforma hid data the session already had; ShopWorks dates were UTC days (2026-09-01)

**Problem.** Real paid order DTG0831-2727 ($68.99 CC, ship Eugene OR): the pre-import
proforma (`/invoice/:id`) showed Ship To "—", REQ SHIP DATE "—", Bill To with no street,
and "2 @ $29.50 = $61.00" (doesn't foot). ShopWorks also recorded the order/payment as
08/31 though the customer paid Sun 8/30 7:38 PM Pacific.

**Root cause.** (1) invoice.js only read `pushed.ShippingAddresses` (exists post-import)
or `originalSubmission.ship` (quote-builders only) — storefront orders keep the address in
the flat `CustomerDataJSON`/`OrderSettingsJSON` session columns it never parsed. (2)
Storefront quote_items store the BASE-size price in `FinalUnitPrice` with extended-size
upcharges only in `LineTotal`, and `SizeBreakdown` was never rendered. (3) The push stamped
`new Date().toISOString()` = the UTC day — every order after ~5 PM PT dates +1 in ShopWorks.
Also: `″` (U+2033) in push notes → "?" (ManageOrders is cp1252); `requestedShipDate` was
never sent though the proxy supports it and `shipPromise.iso` is stamped at checkout.

**Solution.** invoice.js: lazy `storefrontCustomerData()/storefrontOrderSettings()` blob
parsers feeding Ship-To/Bill-To/req-ship-date fallbacks; blended unit price when
unit×qty ≠ LineTotal + render SizeBreakdown; `parseDateSafe()` so bare `YYYY-MM-DD` renders
local, not UTC-shifted a day early. server.js push: `orderDate`/payment `date`/samples dates
= `nowPacificNaiveIso().split('T')[0]`; send `requestedShipDate: shipPromise.iso`; `″`→" in".

**Prevention.** A "blank" field on a pre-import surface is usually a READER gap, not missing
data — check the session's JSON blob columns before touching the push. Any date written to
ShopWorks/Caspio must be the PACIFIC day (`nowPacificNaiveIso()`), and any bare date STRING
rendered in the browser must not go through `new Date('YYYY-MM-DD')`. Push text stays cp1252.

## An audit that reported a clean manifest as 26 missing POs — three ways to confuse "not there" with "never looked" (2026-08-26)

**Problem.** `scripts/psst-audit.js` reconciles SanMar's daily freight manifest against our
inbound board. Run against the 2026-08-26 manifest (26 POs / 505 pcs / 32 cartons) it reported
EVERY PO as `NOT FOUND`. The manifest was perfect — verified afterwards, ISSUES: 0.

**Root cause — three independent defects, each alone producing the same false alarm.**
1. **Refreshed the wrong dates.** `i < REFRESH_NEAR_DAYS` took the first three entries of the
   date window, but the window starts BAND business days BEFORE the earliest arrival, so those
   three are the OLDEST days. The arrival dates always sat past them and came from the 600 s
   cache. It refreshed 08-21/24/25 and read 08-26 and 08-27 — the only two that mattered —
   stale, labelling them `(cached)` in output nobody reads closely.
2. **A stale mirror looked like missing freight.** The board is a once-a-day copy of SanMar
   (~05:31 PT). The audit ran at 05:25 PT. Nothing in the output said the mirror predated the
   manifest, so a sync-timing artifact presented as 26 lost cartons.
3. **A failed fetch counted as a discrepancy.** Caspio rate-limits hardest right after the
   morning sync; both arrival dates returned "rate limit exceeded" and the script still listed
   26 POs as "not on the board" — while its own header comment had promised since the day it
   was written that a failed date is "NEVER counted as nothing arriving."

**Solution.** Refresh set = the arrival span `[lo, hi]` itself, capped by `REFRESH_MAX` (costs
no extra calls — the padding band is for early/late arrivals synced days ago). Probe
`/status-summary` for `lastSync` and compare `<=` the manifest ship date, NOT `<`: SanMar
publishes a day's shipments AFTER our sync runs, which is why the manifest arrives by email the
next morning, so a sync stamped the same day ran before those cartons existed. A failed date
inside the arrival span marks the run INCONCLUSIVE and its POs UNKNOWN, never missing.

**Prevention.** 🔴 **A check must distinguish "I looked and it isn't there" from "I never
looked" — and must SAY WHICH.** Every one of these three failures collapsed those two states
into one confident negative. Same shape as the 2026-08-20 window bug in the same script, and as
the ghost-order near-miss where three numeric guards passed on unread data. When a verifier
reports absence, make it state its own coverage: which dates it read, how fresh the source was,
and what it could not fetch. Prose promises in a header comment are not enforcement — this
file's own comment made exactly this promise and the code did the opposite for weeks.

### curl from git-bash mangled em dashes into U+FFFD (2026-08-25, ARCHIVED 2026-09-01): non-ASCII Caspio writes go through Python `ensure_ascii=True`, never a git-bash curl body; verify stored text with `ascii()` on a re-read. Full entry in archive.
### A customer's real size request was shown to nobody (2026-08-19, ARCHIVED 2026-08-27): render every field you persist — a saved-but-unshown field is data loss with extra steps. Full entry in archive.
### SAM quotes rendered “No items” (2026-08-19, ARCHIVED 2026-08-27): a channel that opts out of a shared fix re-inherits the bug it fixed; SW-snapshot overlay repaints EXISTING rows only. Full entry in archive.

## Staff dashboard full review — 5 UTC/Pacific bugs on ONE page, and the error system silently failing itself (2026-08-26)

**Problem.** Multi-agent review of every file the staff dashboard loads (30 files) confirmed 13
defects. Worst: paid 3-Day Tees orders could NEVER appear in the Orders Inbox; the Money
Collected "Today" tile showed $0 every evening; the Q3 bonus card's API-failure path rendered
nothing (spinner forever); concurrent same-URL fetches crashed the second caller.

**Root Cause.** Four families: (1) UTC-vs-Pacific in FIVE independent spots on one page —
`toISOString().slice(0,10)` for calendar-day compares/windows, `new Date('YYYY-MM-DD')` then
local getters (all 19 anniversaries a day early), a holiday check using the UTC day while the
weekend check used local. (2) `showApiError('embroidery-bonus')` targeted an area never added to
ERROR_AREAS — the unknown-area guard console-logs and returns, so THE ERROR RENDERER was the
silent failure. (3) GET dedup handed every caller the SAME Response — second `.json()` throws
"body stream already read", painting an error card for a request that succeeded. (4) The quote
prefix regex `/^([A-Z]+)/` returns '' for digit-leading '3DT…' IDs, so the storefront filter
dropped them; dead 'TDT'/'CTS' entries masked the gap.

**Solution.** All fixed in one commit on develop (+ metricsCache split into per-service store
slots, YoY failure now an amber badge, dead exports/areas/endpoints pruned, inline <style> moved
into tokens.css). Verified: full unit suite (126 suites/2631), acorn parse of all 19 edited JS,
jsdom import of all 25 v3 modules, regex/date spot-checks.

**Prevention.**
- 🔴 **Calendar-day math NEVER goes through `toISOString()`** and date-only strings NEVER through
  `new Date('YYYY-MM-DD')` + local getters. Local parts out, split-parse in — or
  `toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' })` for "today". The repo
  "knows" this trap; it still appeared 5× on the flagship staff page.
- 🔑 **An error-UI registry with a soft unknown-key guard turns typos into Rule-4 violations.**
  Register the ERROR_AREAS entry in the SAME commit as the `showApiError()` call — a call site
  with no registry entry renders nothing, forever.
- 🔑 **Never hand one fetch Response to two consumers** — dedup must `.clone()` per caller (and
  clean up with `.then(fn, fn)`, not a discarded `.finally()` chain, which fires a spurious
  unhandledrejection per failure).
- 🔑 **A prefix whitelist + extraction regex is two chances to be wrong.** '3DT' broke the
  letters-only regex silently; nonexistent 'TDT'/'CTS' entries made the list look maintained.
  Derive prefixes from config/storefront-channels.js shapes, and test the digit-leading one.

---

## Quote data plane locked down — 44 caller files, 2 repos, one gate flip left (2026-08-26)

**Problem.** Step 2 of the 2026-08-17 review: the proxy's quote surface was anonymous.
GET /api/quote_sessions with no filter dumped the ENTIRE customer book (no limiter, no
auth — MEMORY's "rate limiter" claim was generous); quote_change_log and dtf/scp-push had
NOTHING; push preview routes dumped full customer PII per quoteId; PUT quote_items let
anyone rewrite prices on a live quote link.

**Root Cause.** Browser call sites (~90 across 44 files) hit the proxy base directly, so
the proxy could never require auth without breaking every page. The app ALSO exposed its
own anonymous CRUD twin (/api/quote_sessions* etc.) that dropped query strings and sent
no secret upstream.

**Solution.** App `v2026.08.26.3` + proxy `v2026.08.26.2`, deployed app-first:
app relays hardened (PUT/DELETE staff-only; POST anonymous behind quotePlaneWriteLimiter
with staff skip; list reads staff-or-quoteID-scoped, query forwarded verbatim; NEW
quote-sequence + 3×push relays), 19 live browser files migrated same-origin,
withProxySecret() on every dyno→proxy quote call, e2e harnesses read the secret from env.
Proxy: quotePlaneGate on all 8 prefixes, mode via QUOTE_PLANE_GATE config var
(off→log→enforce, no deploy to flip). NOW IN LOG MODE — flip to enforce after the
WOULD-BLOCK log goes quiet: `heroku config:set QUOTE_PLANE_GATE=enforce --app caspio-pricing-proxy`.

**Prevention.**
- 🔑 **A gate you can't flip without a deploy is a gate you'll ship scared.** Mode-switch
  by config var: deploy dormant, watch in log mode, enforce when the log proves coverage.
- 🔑 **Migrate by ENDPOINT grep, never by config swap** — 141 files hardcode the proxy
  host, and 4 of the migrated files used their base for NON-quote endpoints too
  (dtg top-sellers, quote-view thumbnails, /api/files uploads, sanmar-orders) — a blanket
  base swap would have broken them. Audit EVERY use of a base const before flipping it.
- 🔑 **The app's own passthrough routes silently dropped query strings** (GET
  /api/quote_items forwarded bare for years — callers got ALL items). When hardening a
  relay, forward `req.originalUrl`'s query verbatim; the upstream validates.
- 🔴 **Postures are jest-locked in BOTH repos** (`tests/unit/quote-plane-postures.test.js`
  app, `tests/jest/quote-plane-gate.test.js` proxy) — source-parsed mounts + behavioral
  mode tests, so a refactor can't silently reopen the plane or unmount the gate.
- 🔑 Shared-checkout deploys: THREE concurrent-session collisions in one day (trust band
  committed onto main mid-deploy; sanmar css bumped into my release; proxy inbound commit
  riding my proxy release). `git add -u` is never safe here — stage explicit file lists,
  read `main..develop` before every merge.

---

## Staff-dashboard hardening: PII roster, proxy-direct reads, third-party auth embed (2026-08-26)

**Problem.** Three structural exposures on the staff dashboard, found by the same review that
fixed its 13 defects: (1) the full employee roster — names, birthdays, hire dates, TERMINATION
dates — hardcoded in TWO anonymously-served JS files; (2) three reads (quote book, per-rep YTD
revenue, art requests) hitting the public proxy base directly, relying on obscurity; (3) the
welcome chip fed by a hidden third-party Caspio DataPage embed that needed its own caspio.com
session, silently failed under third-party-cookie blocking, and forced the caspio-isolation.js
MutationObserver hack.

**Root Cause.** The staff gate covers only `.html` — every `.js` under the static mounts serves
anonymously — and the dashboard predated the same-origin forwarder pattern.

**Solution.** Roster → `lib/staff-roster.js` (never statically served) behind requireStaff
`GET /api/staff/employees`; employees-service became fetch-once async with a visible roster-error
state; legacy roster file deleted. The three reads → `/api/staff/{quote-sessions,
daily-sales-by-rep-ytd,artrequests}` relays (staffProxyForward). Auth embed + caspio-isolation.js
DELETED — identity now `/api/crm-session/me` (which gained `role`). Shipped `v2026.08.26.3`;
the proxy side of the reads was locked by the quote-plane gate (entry above).

**Prevention.**
- 🔴 **Data a staff page needs is either in `lib/` behind a route, or it is PUBLIC** — there is
  no third state. The drive-access pattern is the template; grep the static mounts before
  hardcoding anything person-shaped in JS.
- 🔑 **A second copy of retired data is a second leak** — the live service had been "migrated"
  once already, but the legacy file it was copied from kept serving the identical roster.
  Deleting the consumer without deleting the source fixes nothing.
- 🔑 **Same-origin identity (`/api/crm-session/me`) beats a third-party auth embed** everywhere:
  no cross-site cookies, no injected CSS to quarantine, one auth source. If a page still embeds
  a Caspio DataPage just to display who is signed in, that is the replacement.

## /inventorylevels served our wholesale costs and supplier to the internet — fixed with a projection, not a gate (2026-08-27)

**Problem.** `GET /api/manageorders/inventorylevels` (proxy) is deliberately anonymous — its one
live caller is the customer-facing laser-tumbler calculator — but it returned raw ManageOrders
rows: `UnitCost`, `TotalCost`, `VendorName` (our supplier, "JDS Industries"), plus internal
accounting fields (`GLAccount`, `FindCode`, `id_Vendor`, `ID_InvLevel`).

**Root Cause.** The route forwarded upstream rows verbatim; "customer-facing" was decided at the
ROUTE level with no thought to the FIELD level.

**Solution.** Whitelist projection at the response boundary (`INVENTORY_PUBLIC_FIELDS` +
`projectInventoryRows` in proxy `src/utils/manageorders.js`), applied on both the cache-hit and
fresh-fetch paths. Caller inventory first proved the calculator reads only
PartNumber/SKU/Color/Size01-06 (its `vendorName` passthrough is never rendered). Shipped proxy
`v2026.08.26.4`; live-verified before/after — the leak fields are gone, sizes intact.

**Prevention.**
- 🔑 **An anonymous route's contract is its FIELD LIST, not its path.** Before leaving any route
  open, print `sorted(rows[0].keys())` from the live response and justify every field. The gate
  question ("who may call this?") and the projection question ("what may it say?") are separate.
- 🔑 **Whitelist, never blacklist** — unknown upstream fields (ManageOrders can add columns any
  time) must default to STRIPPED, and a no-drift test asserts projected rows carry only
  whitelisted keys.
- 🔑 **Prove a new lock goes RED**: `git stash` the fix, run the test (fails), pop, run again
  (14/14 green). A lock that has never failed proves nothing (DURABLE_GOTCHAS § Verification).

## 2-minute proxy outage: the commit shipped half the change, and the boot probe tested the other half (2026-08-27)

**Problem.** Deleting the legacy box-labels routes crashed the proxy dyno on deploy (H10 on
customer pricing calls, ~2 min until `heroku releases:rollback`). The slug had the route FILE
deleted but `server.js` still `require`d it — `Cannot find module` on boot.

**Root Cause.** Two failures stacked: (1) `git add <deleted-file> <edited-files>` — the first
pathspec matched nothing (the file was already staged by `git rm`), and **git add ABORTS the
whole command on a bad pathspec, staging NONE of the later files**; the commit went out with
only the `git rm`. (2) The local boot probe passed because it ran against the WORKING TREE
(which had the server.js edit), not against what was committed — the exact gap between "my
checkout works" and "the commit works".

**Solution.** Rollback restored production in seconds; the missing edit was committed with the
staged diff INSPECTED (`git diff --cached` shows the require removal), boot-probed with
`tree == HEAD` asserted first, and redeployed clean (proxy `v2026.08.26.6`). Legacy routes now
404 live; the repack station's `/api/sanmar-orders/label-data` unaffected.

**Prevention.**
- 🔴 **Never combine pathspecs in one `git add` during a delete+edit change.** One `git add`
  per file, then `git diff --cached --stat` MUST list every file you meant to ship — read it
  before committing. An already-`git rm`'d path in the list is the trap that aborts the rest.
- 🔴 **A boot probe is only honest when `git status --porcelain` shows no tracked dirt** —
  otherwise it verifies the working tree, not the commit that deploys. Assert clean, THEN probe.
- 🔑 **Delete a module and its require in the SAME commit, verified in the same staged diff.**
  The app-side twin of this change survived because its deletion was a single-file block edit.
- 🔑 The rollback playbook worked exactly as written: slug rollback in seconds, fix landed
  forward through the normal gated path — no hand-pushes, no `--no-verify`.

## Top Sellers "flickers blank, refresh fixes it" — a cold query the cache was hiding (2026-08-26)

**Problem:** Erik: clicking the header's Top Sellers link, products "try to load", images flicker
blank, and only a refresh loads them properly.
**Root cause (three stacked):** (1) the topSellers listing query took 10-18s COLD on the proxy —
`IsTopSeller=1` alone forces Caspio to scan the 181k-row table, and phase-2 hydration pulled ~10k
variant rows (top sellers are the MOST-varianted styles) as 10 SEQUENTIAL 1,000-row pages. The
5-min response cache made the NEXT load instant, so a refresh "fixed" it — the classic
cold-query-behind-a-cache signature. (2) Only the first 5 of 48 card images were
`loading=eager`; a desktop first screen shows ~12-20, so most visible images lazy-popped late.
(3) All 48 sample-eligibility checks (~2 proxy calls each) fired the instant the grid rendered,
competing with the page's own images, and the "Checking availability" → button swap had no
reserved height.
**Solution:** proxy `7424e77` — style index carries IsTopSeller so the WHERE narrows to
`STYLE IN (...)` (Rule 4 intact: every row still verified live; membership lags a flip ≤30 min),
and phase-2 hydration partitions styles into 12-style chunks fetched in PARALLEL (identical rows,
same Caspio call count, ~1/4 wall clock). Measured: 18s → 6.3s cold, 0.01s warm. App: eager
first 12 images + `decoding=async`, sample slots decorate via IntersectionObserver (600px
lookahead, 8s catch-all sweep), placeholder holds the button's 38px.
**Prevention:** 🔑 "Works after refresh" = a cold path behind a response cache — time the
UNCACHED query before blaming the frontend. 🔑 A `limit=48` page can hydrate 10k+ rows when its
styles are variant-heavy; disjoint STYLE IN partitions parallelize for free (quota-neutral).
🔑 `?isTopSeller=1` is silently IGNORED by the route (`=== 'true'`) — a wrong-param probe times
the WRONG query and returns the whole catalog; validate the response set before trusting a timing.
