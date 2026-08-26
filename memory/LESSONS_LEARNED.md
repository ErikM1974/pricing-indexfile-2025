# LESSONS LEARNED

Bug â†’ root cause â†’ fix â†’ prevention. Newest first. **Hard limit 300 lines** â€” archive the
oldest resolved entry to `LESSONS_LEARNED_ARCHIVE.md` once this passes 250.

---

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

## First-ever caps order pushed to ShopWorks with NO artwork — the stamp had flattened the file ref to a boolean (2026-08-25)

**Problem.** First exercise of the /custom-caps paid leg (Stripe TEST-mode E2E, CAP0825-4781):
order reached OnSite with `designs: []` and `attachments: []` — production would get a proof-first
embroidery order with no logo attached. Quote-view and custom-caps-success were ALSO silently
artless for every future CAP order.

**Root cause.** The caps channel's `stampedOrderSettings` (server.js) wrote `frontLogo: true` /
`backLogo: <bool>` — server-authoritative *pricing flags* — into OrderSettingsJSON, clobbering the
client's `{fileUrl, fileName}` objects (Object.assign stamp wins over client base). Three consumers
(`submit-3day-order` push, quote-view.js:3481, custom-caps-success logoFig) all read `.fileUrl` and
optional-chain to nothing. Tees never hit it: its stamp doesn't touch artwork keys.

**Fix.** `sanitizeUploadedLogoRef(ref, allowedPrefix)` in config/storefront-channels.js (jest-locked);
caps stamp now carries the sanitized `{fileUrl, fileName}` through — only `{proxy}/api/files/` URLs
survive, and backLogo rides ONLY when the reprice charged it. Verified by rerun CAP0825-7724:
`Built designs: 1`, `Built attachments: 1`, Processed.

**Prevention.** A channel launched without ONE full test-mode E2E (create-session → signed webhook →
push) is unverified no matter how much code it shares — the tees channel being production-proven
proved nothing about the caps STAMP. `tests/3dt-fire-test-webhook.js` makes the full rehearsal a
two-command job; run it for every NEW storefront channel before launch, and read the push payload
log, not just the status flip.

---


## curl from git-bash mangled em dashes into U+FFFD inside a Caspio row (2026-08-25)

**Problem.** Creating the Forms_Library row for the embroidery-operator employment application
via `curl -d '{...}'` in git-bash returned HTTP 201 — but the stored `Form_Name`/`Description`
carried literal U+FFFD replacement characters where the em dashes were. The 201 looks like
success; the corruption only shows when you read the row BACK and inspect the bytes.

**Root cause.** git-bash on Windows handed curl the heredoc body in a non-UTF-8 encoding; the
proxy/Caspio replaced the invalid bytes with U+FFFD, which then round-trips as "valid" text.
Printing the GET response to the console ALSO renders "�" for unrelated console-encoding
reasons, so eyeballing output can't distinguish stored corruption from display noise.

**Solution.** Re-sent via `PUT /api/forms-library/:id` from Python with
`json.dumps(..., ensure_ascii=True)` (escapes non-ASCII to `\uXXXX`, so the wire body is pure
ASCII and immune to shell encoding), then verified the stored value with `ascii(field)` on a
fresh GET — shows `—`, proving real em dashes.

**Prevention.**
- 🔑 **Any Caspio/proxy write containing non-ASCII (em dash, ×, ’, é) goes through Python with
  `ensure_ascii=True` — never a curl body typed in git-bash.** JSON `\uXXXX` escapes are the
  portable path on Windows shells.
- 🔑 **Verify stored TEXT with `ascii()`/`repr()` on a re-read, not by eyeballing console
  output** — the console lies about encoding in both directions.

---

## A customer's real size request was captured, saved, and shown to nobody (2026-08-19)

**Problem.** WQ-2026-006 (web quote-cart) showed 18500B "S × 17". The customer's actual request
— A-M 8 / A-S 6 / XS 1 / L 2 — existed only in the notes box they typed at checkout, and no
surface displayed it. Erik caught it because "17 smalls" looked wrong.

**Root cause.** Two halves. (1) The quote-cart lets a customer add a line with one size + qty,
so they dumped the total on the default size and typed the real distribution into notes. (2)
quote-view's `renderNotes()` skipped ANY valid-JSON Notes as "structured config" — but the WQ
channel stores the customer's typed text INSIDE that JSON (`customerNotes`), so the one
free-text field a customer fills was invisible to reps by construction.

**Solution.** `renderNotes()` now renders a "Customer notes (typed at checkout)" block
(pre-wrap, text-only) when JSON Notes carries a non-empty `customerNotes`; structured config
without customer text stays hidden. Verified against the live row. The quote itself still says
S × 17 — sizes on a quote are the REP'S call after clarifying (here "A-" prefixed sizes look
ADULT while 18500B is the YOUTH hoodie — repricing territory, never an auto-rewrite).

**Prevention.**
- 🔑 **"Skip it, it's structured JSON" needs a look INSIDE the JSON first** — channels tuck
  human-typed text into structured blobs, and a skip on the container silently drops the one
  field a human wrote.
- 🔑 When a quote's numbers look odd, read the session row's `Notes`/`customerNotes` before
  trusting the line items — the cart shape (one size per line) invites totals-on-one-size.

---

## SAM quotes rendered "No items in this quote" — the samples channel opted out of the fix built for exactly this (2026-08-19)

**Problem.** First real paid-sample order (SAM0819-8320, Peak Industrial, $100.73 via Stripe)
showed an empty "Quote Details" on `/quote/:id` even though payment, ShopWorks push (WO 142865)
and snapshot sync all worked.

**Root cause.** `/quote` + `/invoice` render line items from the `quote_items` table.
`storefront-quote-items.js` exists precisely because storefront carts once lived only in
quote_sessions JSON blobs and those pages showed "No items" — but the samples launch (2026-07-06)
deliberately skipped it (`colorConfigs: {}`, comment: "no junk quote_items rows"), because sample
carts aren't colorConfigs-shaped. The ShopWorks snapshot couldn't save the page either:
`_overlayQuoteFromShopWorks` only repaints rows that already exist — zero quote-side rows means
the synced SW lines render nowhere.

**Fix.** Samples branch in `buildStorefrontQuoteItems` (one row per `orderSettings.samples`
entry, `EmbellishmentType: 'blank'`, free samples as $0 `FREE sample —` rows; jest-locked in
`tests/unit/storefront-quote-items.test.js`). Backfilled SAM0819-8320's two rows via the proxy
using the same builder — live page verified rendering both, matching the SW snapshot 1:1.

**Prevention.**
- 🔑 **"This channel doesn't need X" must name every READER of X, not just the writer's needs.**
  The push reads OrderSettingsJSON, but /quote + /invoice read quote_items — the opt-out comment
  only considered the push.
- 🔑 The SW snapshot overlay is an OVERLAY, not a renderer — it can correct rows but never create
  them. Any quote with zero quote_items rows stays visually empty no matter how good the sync is.
- 🔑 Backfill through the SAME builder the code path now uses (require the module in a one-off
  script), so the repaired row and future rows are identical by construction.

---

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
