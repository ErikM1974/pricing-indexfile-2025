# Caspio Integrations quota — the 27 Jul – 1 Aug 2026 work

Definitive record of the week that followed invoice **AI-334269-26072026 ($358)**. Supersedes
the scattered one-liners; `CASPIO_SYNC_CLUSTER_COST.md` holds the per-job cluster attribution.

## The numbers (Caspio's own page — the ONLY billing authority)

| Day | Calls | |
|---|---:|---|
| 27 Jul | 23,959 | pre-fix; the day that produced the bill |
| 28 Jul | 22,659 | pre-fix |
| 29 Jul | 20,616 | six fixes landed *during* the day |
| 30 Jul | 16,729 | ~11,100 business **+ ~5,600 from our OWN pricing-baseline capture** |
| 31 Jul | **10,626** | first fully clean day — **34% under** the 16,129/day budget |

**−56% in five days.** Period 27 Jul–26 Aug (31 d) ⇒ budget **16,129/day**. At 5 days in:
94,589 spent, 26 days left, ~10,600/day running ⇒ **projected ~340,000 of 500,000 (~68%)**.
The first four days are **25% of the whole period's calls from 13% of its days** — the
expensive part is sunk, and breaching 500K would now take a sustained 15,400/day regression.

⚠️ **ALWAYS DERIVE the budget** — the period is the 27th→26th and its LENGTH VARIES 28-31 days.

## What actually fixed it — measured before/after, not estimated

| Fix | Before | After | Where |
|---|---:|---:|---|
| **Googlebot crawling the API** | ~11% of requests @2.2/min | **0** | `robots.txt` (host served a 404 and had no handler) |
| **`sync-manageorders`** | 2,901/day, 22 min | **141/day, 2m47s** | a broken date comparison — see below |
| **ORDER_ODBC + PO** | 55% of a fresh dyno window | `PUT: 2` | content dedupe on bandit |
| **garment tracker jobs** | ~1,900/day | **deleted** | the programme was over — Erik spotted it |
| **DTG `/product-bundle`** | 5-8 calls/hit | **1 cold / 0 warm** | cache + merged the two Sanmar_Bulk scans |
| **thumbnail Box sync** | 3,960/day | ~426/day | 20 min → 4 h cadence (pre-dates this week) |

🔑 **The two biggest wins came from questioning a premise, not optimising code.**
- `sync-manageorders`: the API returns `"…T00:00:00.000Z"`, Caspio returns `"…T00:00:00"`.
  Compared as raw strings they are NEVER equal, so **456 of 457 "changed" orders were phantom**
  and each dragged a full line-item delete-and-repost behind it. One line of normalisation.
- garment tracker: Erik asked *"are we even using this?"* — `GarmentTracker` had **95 rows,
  latest DateInvoiced 2026-06-15, Q3 zero**. A 1,900/day optimisation became a deletion.

## The meter — it read 4% of reality while Caspio billed 138%

Six independent under-counts, all closed. Residual vs Caspio by day:
**−33% → −21% → −10% → +18% → +2.2%** (31 Jul, first clean day).

⚠️ **Post-repair the residual settled POSITIVE and stayed there** — 31 Jul → 3 Aug measured
**+2% / +11% / +12% / +14%**. It no longer flips sign; we consistently over-count. Cause
**unidentified**. Ruled out 2026-08-04: `/oauth/token` fetches are counted (`__oauth_token__`)
but are only **0.2%** of calls — nowhere near the gap. 🔑 **Do not chase it.** A uniform
scaling error does not affect ATTRIBUTION (relative table shares are untouched), and it biases
the projection *high*, so the alert fires early rather than late. Caspio remains the billing
authority and is free to read.

1. **3 scripts never loaded `api-tracker`** — the interceptor installs as a side effect of
   *loading* that module, so it attaches **per-process**. ~950/day invisible.
2. **UTC vs Caspio's Pacific account clock** — a whole-day offset is indistinguishable from
   missing data. `src/utils/account-time.js` is now the one definition.
3. **Scheduler dynos never flushed** — one-off dynos live seconds; a 60-min timer never fires.
   Flush on **call count** (250), not elapsed time.
4. **`process.exit()` skips `beforeExit`** — `check-transfers-received` makes a fixed ~2 calls,
   so every hourly run recorded **zero**. → `flushAndExit(code)`.
5. **Dyno restarts lost the tail** — `server.close()`'s callback fires instantly on an idle
   dyno, killing the flush mid-write. Now flushes **in parallel** with close, 10 s bound.
   Verified on a real dyno: `HTTP server closed` at .352, flush completed at .488.
6. **Our own rollup writes were uncounted** (`_skipMeter`) — counted outside the tracker so
   there is no feedback path. (Counting them *inside* it once wrote ~1,893 junk rows.)

**Permanent floor: ~1 call per process** — a flush cannot record its own cost. ~25-30/day.

🔑 **`/api/admin/metrics` → `persistence.reconciliation`** publishes `pendingUnflushed` +
`selfWritesToday`, so **written + pending = counted** and a gap is arithmetic, not a mystery.

## Operating model (what to actually do)

- **Caspio's page is the source of truth.** Reconcile against it; never quote ours as billing.
- **Our meter's job is ATTRIBUTION** — Caspio will never say "sync-manageorders = 2,901".
  ±12% is plenty for that; a 2,900-call regression is unmistakable.
- **Early warning:** `npm run check-caspio-usage`, Heroku Scheduler **daily 11:00 UTC**
  (4 AM PT — after the 07:00 UTC day rollover, before the 12:00 UTC cluster). First run
  1 Aug 2026 ✅. Silence = fine; a DM names the top 3 tables.
- **Pacing projects `spent + (mean of last 3 COMPLETE days × days left)`** — NOT a
  whole-period average, which stays anchored to how the period started and would have fired
  every day forever. Today is excluded (partial days read as false comfort).

## ADOPTED 2026-08-06 — big table writes go through a CSV data import

Erik's standing instruction after the 5 Aug spike. **Was** listed below as "shelved"; it is
now the default for bulk writes. The always-loaded rule lives in `CLAUDE.md` → Critical
Patterns; this is the evidence behind it.

**Trigger: roughly 1,000+ rows.** Erik's framing — *"only if possible, like for big data,
lots of it."* Under a few hundred rows the API is fine; the import definition costs more to
set up and verify than the calls save. This is a routing rule, not a ban on API writes.

- **Separate 1,000/period meter**, ~0 Integrations cost. Caspio **PULLS** the file
  (HTTPS/Box/OneDrive/S3/FTP), so the transfer is free too. Ceiling ~32 runs/day ⇒ big
  infrequent jobs only, never a frequent sync.
- **Pattern already in the repo:** `scripts/sync-design-lookup.js --csv-out`. Rebuilding
  `Design_Lookup_2026` live costs **38,785 POSTs (~7.8% of the monthly budget)**; as a CSV
  import it is ~0. REPLACE semantics — empty the table first.
- 🔴 **The upsert key is configured in the Caspio UI, invisible to code review.** A wrong key
  silently writes wrong data. Verify it on the import definition, never by reading the script.
- ⚠️ **Why per-row is so expensive:** `POST .../records/bulk` takes an array (≤1,000 = 1 billed
  call), but **`PATCH .../records/bulk` is `{where, recordValues}` — one value-set for every
  match, so it CANNOT do per-row upserts.** Updates therefore cost 1 call per row.
- **Measured 2026-08-05:** a morning of per-row Claude table updates = **~11,800 calls**, 73%
  of a day's budget, split ~7,500 direct-to-Caspio + ~4,300 through the proxy. Day total
  **23,799** — the period's worst, effectively tying 27 Jul (23,959), the day that billed $358.

## Killed by measurement — do NOT re-propose

- `archive-daily-sales` diff-before-write: ~120/day, risks duplicate rows in a financial
  archive that `/ytd` SUMs. **Never shorten its 60-day window** — ManageOrders retains 60 days.
- `sync-sanmar` cap — settled, ~150 excess.
- `rebuild-account-ytd --apply` — first costed at **<50/day**, essentially free.
- **Webhooks** — *"Integrations = REST API, **Webhooks** and Extensions"*. Same meter, no saving.
- **Zapier** — reaches Caspio through the same REST API, and polling triggers are the exact
  pattern we removed. Would also be invisible to our meter.
- Meter precision beyond ~2-12% — Caspio is free and authoritative.

## Shelved — only if the budget is actually missed

- **`sync-supacolor`** runs every 10 min but a 30-min guard makes most runs a `0.0s` no-op.
  Verify before touching.
- **v2 → v4 for bulk writes.** Bulk ≤1,000 records = **1 billed call** (Caspio support
  confirmed). But `POST bulk` takes an array while **`PATCH bulk` is `{where, recordValues}`
  — one value-set for all matches, so it CANNOT do per-row upserts**. And v4 renames
  everything: `tableId` is an opaque **6-char code** (a wrong code reads the WRONG TABLE
  silently), `q.where` → `Where`. ~600 call sites: a project, not an edit.
- **`pricing-bundle` per-method cache split.** Keyed `{method, styleNumber}`, so
  `Pricing_Tiers`/`Pricing_Rules`/`location`/cost re-fetch for **every style**. Production
  traffic does not justify it; **dev tooling does** — one baseline capture cost ~5,600.

## Live risks worth tracking

- 🔴 **`config.js:19` uses `/rest/v2`, which Caspio deprecated 1 June 2026.** Not a cost issue.
- ⚠️ **Our own tooling is now the biggest single swing factor.** One
  `capture-pricing-baselines` run = ~5,600 calls, half a day's budget. Measured again
  2026-08-05: a morning of Claude table updates = **~9,400 calls, over half the day's total**.
- 🔑 **The pacing alert is BLIND to local tooling — by construction.** It reads
  `API_Usage_Daily`, which only Heroku dynos write; a script run from the laptop hits Caspio
  directly and never touches the proxy. On 2026-08-05 Caspio showed **17,824** while the
  rollup showed **9,466** — the alert would have called it a normal day. **Caspio's page is
  the only thing that sees local work.** One heavy session ≈ 2% of the period cap and is
  free; ~13 sessions is the headroom, and a DAILY habit is the one realistic path to an
  overage left in these numbers.
- ⚠️ **Heroku Scheduler has NO CLI and NO API** — job changes are UI-only, Erik's hand.
