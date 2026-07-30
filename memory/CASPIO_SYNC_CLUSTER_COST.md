# Caspio morning sync cluster — first measured per-job cost (29 Jul 2026)

First day the 12:00–15:00 UTC (5–8 AM PT) scheduler cluster was ever measured. Before
28 Jul 12:04 PT the rollup only flushed on a 60-min timer, and Heroku Scheduler jobs are
one-off dynos that live seconds — so they never recorded anything.

## How the jobs reach Caspio (this is the attribution key)

Two distinct shapes — check which one a job is before trying to cost it:

| Shape | Scripts | Where its calls are metered |
|---|---|---|
| **Direct to Caspio** (`CASPIO_BASE` + raw axios, `require('../src/utils/api-tracker')`) | `sync-manageorders`, `check-zero-billing`, `sync-commissions` | Its **own** `scheduler.NNNN` row in `API_Usage_Daily` |
| **HTTP through the proxy** (`BASE_URL` → `/api/...`) | `sync-sanmar`, `sync-garment-tracker`, `archive-daily-sales`, `archive-garment-tracker`, `sync-crm-dashboards`, `rebuild-account-ytd` | **`web.1`** — indistinguishable from user traffic except by burst timing |

So only 3 of 9 jobs can be costed exactly. The other 6 are attributed by subtracting the
web.1 baseline (**~12 calls/min**, from quiet inter-flush windows: 11:45→12:06 = 11.7/min,
12:30:43→12:51 = 12.3/min, 13:29:52→13:49 = 12.9/min) across their scheduled window.

**Reading the rollup rows:** a row of exactly `250` is a threshold flush; `<250` is the
timer flush. Consecutive 250-rows seconds apart = a burst job. That is the signal that
identifies an HTTP-shaped job — e.g. 8 flushes in 43 s at 13:00:08–13:00:51.

## Measured 29 Jul 2026 (pre-fix run)

| Job (UTC) | Calls | Confidence |
|---|---:|---|
| `sync-manageorders` 12:00 | 2,901 + ~510 web ≈ **3,410** | 2,901 **exact** (scheduler.8023, 12:01:55–12:23:10) |
| `sync-garment-tracker` 13:00 | ~**1,900** | 1,750 **exact by burst**; tail estimated |
| `archive-garment-tracker` + `sync-crm-dashboards` 14:30 | ~**640** | estimate, **cannot separate** (same slot) |
| `sync-sanmar` 12:30 | ~**150** | estimate |
| `archive-daily-sales` 14:00 | ~**40–190** | estimate |
| `check-zero-billing` 13:30 | **35** | exact (scheduler.7221) |
| `rebuild-account-ytd` 15:00 | **<50** | estimate |
| `sync-commissions` 15:00 | **10** | exact (scheduler.8771) |
| **Cluster total** | **~6,300** | ~39% of the 16,129/day budget in a 3-hour window |

## Suspicions killed by real data — do not re-propose

- **`archive-daily-sales` is NOT the problem.** Suspected ~186/run of waste; measured excess
  is ~40–190 *total*. A diff-before-write saves ~120/day = 0.7% of budget, against the risk of
  duplicate rows in a financial archive that `/ytd` SUMs. Not worth it. (The 60-day span is
  load-bearing — ManageOrders only retains 60 days — never shorten it.)
- **`sync-sanmar` has settled.** ~150 excess; the Discovery C backlog drained. No cap needed.
- **`rebuild-account-ytd --apply`** — first time costed: **<50 calls**. Essentially free.
- **Thumbnail cadence intact** — bandit `\NWCA\Thumbnail Box Sync` = `Repeat: Every: 4 Hour(s)`.
  71 calls/run × 6 = ~426/day. Verified by the count *freezing* at 71 across two samples 6 min
  apart — that proves one burst, not a rate. Use that trick before calling a table a regression.

## Still open

- ~~**`sync-garment-tracker` is now the biggest remaining target** (~1,900/day)~~
  **🔴 DO NOT OPTIMISE THIS — THE JOB IS DEAD. DELETE IT (2026-07-30).** Erik asked whether the
  garment tracker was still in use; it is not, and the evidence is unambiguous:
  - `GarmentTracker` (live) — **95 rows, latest `DateInvoiced` 2026-06-15**, i.e. nothing for
    six weeks. Derived quarters: Q1 78, Q2 17, **Q3 zero** — and Q3 was 30 days old at the time.
  - `GarmentTrackerArchive` — Q1 103, Q2 17, **Q3 zero**. `Quarter` is derived from the invoice
    date (`src/routes/garment-tracker.js:26 getQuarterFromDate`), so qualifying Q3 orders WOULD
    have landed as Q3 rows. None did. **The programme ended; the pipeline is not broken.**
  - It was the Q2 spiff for **Nika Lao + Taneisha Clark** (live rows: Taneisha 43, Nika 42).
  - The dashboard tile is gone — `staff-dashboard-v3/index.html:1004` says so in its own words:
    *"the Embroidery Bonus card that replaced that tracker"*. The remaining `garment` hits in
    that file are unrelated (Shirt Designer, "on NWCA garments").
  - `dashboard-endpoints.js:30-32` still DEFINES `garmentTracker` / `…Cfg` / `…Archive`, but
    nothing calls them — dead definitions.
  - Only live reader is `commission-payouts.js:177 getGarmentSpiffs(quarter, year)`, which
    queries `GarmentTrackerArchive` BY QUARTER. Q1/Q2 data already exists, so historical payout
    reports keep working with the jobs switched off.

  **✅ DONE 2026-07-30 — Erik deleted both jobs.** Verified from the Heroku dashboard: 18 jobs
  → 16, zero garment jobs remain. The 14:30 UTC slot is now clean `sync-crm-dashboards` only,
  so that job can finally be costed on its own (it was previously inseparable from
  `archive-garment-tracker`).

  ~~**Action: delete the two Heroku Scheduler jobs**~~ — `sync-garment-tracker` (15:00 UTC) and
  `archive-garment-tracker` (14:00 UTC). ~1,900+/day, ~12% of the daily budget, for a programme
  that ended. **Keep the tables and the code** so Q1/Q2 spiffs still resolve and it is reversible.
  🔑 **Heroku Scheduler has NO CLI and NO Platform API** — verified 2026-07-30 (`heroku help`
  has no scheduler command; the addons API exposes no job definitions). It is UI-only, so this
  is an Erik action, not something a session can do.
  If the spiff ever returns, rebuild it as a **Data import task** (separate 1,000/period meter,
  ~0 Integrations calls) rather than ~1,900 record writes.
- ✅ **ORDER_ODBC overnight — FIXED 2026-07-29** (proxy v2026.07.29.9). Was ~2,900 web.1 calls
  between midnight and 5 AM PT with no staff on site. `sync-orders.ps1` + `sync-purchase-orders.ps1`
  now keep a SHA-1 of what they last sent per row and skip unchanged ones. **The 20-min overlap was
  NOT shortened** — it is the clock-skew safety net and the dedupe makes it free. Proven on bandit:
  `2 to send → posted 2`, immediate re-run `0 to send, 2 unchanged → posted 0`. Measured effect the
  next morning: the evening of 7/29 went from ~350/hr to **63 calls across 7 hours**.
- ✅ **Crawler CONFIRMED STOPPED 2026-07-30.** Googlebot was **0 of 117 router requests** in the
  04:04–04:33 PT window; it had been ~11% at 2.2/min at the same hour the previous day. Google
  re-read `robots.txt` roughly 24 h after it shipped, exactly as expected.

## Gotchas

- **`/api/admin/usage` `projected` is biased LOW.** It divides periodToDate by `daysElapsed`,
  which counts today as a full day — at 08:45 PT it read 95% of cap while the real run rate
  was ~140%. Never quote `projected` before end of day.
- **Our meter WAS a lower bound** — 67% of Caspio on 27 Jul, 79% on 28 Jul. Both causes are now
  closed, so treat a large gap as a NEW bug rather than the expected state:
  - ✅ `process.exit(0)` skipping the `beforeExit` flush — fixed 2026-07-29 (v2026.07.29.11) with
    `flushAndExit(code)`. Proven: `check-transfers-received` makes a fixed ~2 calls/run and had
    recorded **zero every hour**; it now writes a 2-call row every run.
  - ✅ A dyno restart losing the in-flight tail — fixed 2026-07-30 (v2026.07.30.1). `runOnce()` now
    returns the RUNNING promise instead of `undefined`, and shutdown runs the flush in PARALLEL
    with `server.close()` under a 10 s bound. Proven on a real dyno: `HTTP server closed` at
    11:49:10.352 and the flush completing at .488 — **136 ms after the old code would have exited**
    — with the 23-call row confirmed in Caspio.
  - ⚠️ Still true: the flush is bounded, so a Caspio outage at shutdown can still drop a tail. It
    now says so loudly with the count instead of failing silently.
- Usage_Date buckets on the **Pacific** account clock, matching Caspio — verified: the last
  `2026-07-28` row is `2026-07-29T06:59Z` (23:59 PT) and the first `2026-07-29` row is
  `07:38Z` (00:38 PT).
