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

- **`sync-garment-tracker` is now the biggest remaining target** (~1,900/day). It POSTs one
  HTTP request per garment record in a serial loop (`scripts/sync-garment-tracker.js:218`) —
  1,750 Caspio calls in 43 seconds, an unconditional upsert per record. Same class of bug as
  the one fixed in `sync-manageorders`; the fix is the same content-signature diff.
- **ORDER_ODBC overnight** — ~2,900 web.1 calls between midnight and 5 AM PT with no staff on
  site. Fix is agent-side dedupe on `{ID_Order: timestamp_Modification}`. **Do NOT shorten the
  20-min overlap window** — it is the clock-skew safety net.
- **Crawler unconfirmed.** `robots.txt` is live (200, `Disallow: /`) but Heroku retained only an
  11-min log window, too small and too late in the day to prove Googlebot stopped. Settle it by
  capturing `heroku logs` around 04:00 PT.

## Gotchas

- **`/api/admin/usage` `projected` is biased LOW.** It divides periodToDate by `daysElapsed`,
  which counts today as a full day — at 08:45 PT it read 95% of cap while the real run rate
  was ~140%. Never quote `projected` before end of day.
- **Our meter is a lower bound, always.** It read 67% of Caspio on 27 Jul and 79% on 28 Jul.
  Scripts ending in `process.exit(0)` skip the `beforeExit` flush, so anything under the
  250-call threshold records **zero**; a dyno restart loses the in-flight tail.
- Usage_Date buckets on the **Pacific** account clock, matching Caspio — verified: the last
  `2026-07-28` row is `2026-07-29T06:59Z` (23:59 PT) and the first `2026-07-29` row is
  `07:38Z` (00:38 PT).
