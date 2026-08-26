# SanMar PSST inbound report — state as of 2026-08-26

The daily board that answers *"what SanMar freight arrives at 2025 Freeman Road today?"*, and
the print sheets Erik runs each morning and hands to **Ruthie (production), Nika, Taneisha
(sales), Mikalah (receiving), Bradley (purchasing)**.

- Backend: `caspio-pricing-proxy/src/routes/sanmar-orders.js` → `GET /inbound-today` (~:1279)
- Sheets: `Pricing Index File 2025/dashboards/js/sanmar-inbound-today.js` (+ `css/sanmar-inbound.css`)
- Harness: `tests/ui/test-inbound-print.html` — renders all 7 print profiles offline, no live API
- Manifest audit: `caspio-pricing-proxy/scripts/psst-audit.js`

---

## ⏭️ STOPPING POINT — pick up here

**One thing left: deploy the APP.** The proxy half is already live; the app half is committed
and pushed to `develop` but NOT deployed.

```
cd "Pricing Index File 2025" && /deploy
```

That release will carry **2 commits**: `29f9db10` (the inbound-sheet work) and `fad909e0`
(another session's memory doc). Nothing risky. Heroku and `origin/main` were in sync at
`d842a718` when this was written — no interrupted deploy to resume.

After deploying, verify on a real morning sheet: open AE Mission Control → SanMar Inbound →
Print, and confirm every profile footer reads **“Data as of … Pacific”**.

---

## What shipped 2026-08-26 (proxy) — LIVE

`04833cd`, deployed inside another session's proxy release. Verified live: `/inbound-today`
returns `generatedAtLocal: "Aug 26, 6:47 AM"` and `today: 2026-08-26`.

- **The report's day is Pacific, not UTC.** All four `const today` seeds now go through
  `localDay()` → the existing `src/utils/account-time.js` account clock. Before this, from about
  5 PM Pacific the default board silently showed **tomorrow**, taking the rush anchor, the
  past-due count and the received comparison with it.
- `generatedAtLocal` added beside the UTC `generatedAt`, so a printed sheet can say when it was
  true. Locked by `tests/jest/inbound-pacific-day.test.js` (both PDT and PST boundaries; fails if
  a bare `new Date().toISOString().slice(0,10)` reappears in live code — it strips comments first,
  because the rationale comment quotes the offending expression).

## What is committed but NOT deployed (app)

`29f9db10` on `develop`. Three files: the sheet JS, its CSS, the UI harness.

- **Drop-ships are marked.** The proxy has returned `destination` / `destCity` / `destState`
  and `totals.dropship` since 2026-08-18; the sheets referenced **none of it**, so a PO SanMar
  sent straight to the customer printed as ordinary arriving freight on every sheet. This was
  the one place the report stated something *false* rather than merely incomplete.
- **Backorder / hold / urgent reach every sheet.** Previously only Bradley's purchasing sheet.
  The badge also only tested `backorder|hold`, so `issue.urgent` (SanMar waiting on *us*) and the
  generic `issue.label` were derived, sent to the browser and read by nobody.
- **Every profile prints “Data as of … Pacific.”** The AE sheets build their own header rather
  than calling `psHeader`, so they needed doing separately — easy to miss.

🔑 **The issue sentence is opt-in (`issueTag(o, {detail:true})`).** SanMar's issue text runs to a
clause; inside a narrow table cell it wrapped to five lines and made the row taller than a RUSH
row, on a sheet whose whole job is to be scanned down a column. Word in tables, sentence on the
prose sheets.

🔑 **Every new token has a `@media print` black-fill rule.** These go to the mono laser — colour
is not a signal. Verified by reading the parsed `@media print` block, not by trusting the source.

---

## 🔴 Known gap: drop-ship detection has ~53% coverage

Measured on the live 2026-08-26 board: of 32 orders, **17 classify as `ours`, 15 come back
`unknown`** with no ship-to at all. Not an age effect — both groups span the same ship dates and
both have box detail. The `Ship_To_*` columns are simply absent on many carton rows.

`unknown` stays deliberately silent and keeps reading as arriving; the backend returns `unknown`
rather than `dropship` when ship-to is missing, precisely so a data gap can never quietly delete
a real carton from the receiving sheet. **So the marker catches drop-ships where the data exists
and is silent where it does not.** Closing it is the `Ship_To_*` backfill (~83 blank carton rows,
already on the backlog) — that is the next thing to do here.

---

## Ranked backlog for this report (adversarially verified 2026-08-26)

Two independent multi-agent passes over the backend and sheets; 24 proposals → 10 survived. The
four built or confirmed above are done. **Remaining, highest value first:**

1. **Ruthie's plan has no “CAN'T START” column.** Its columns are Due / Company / WO / Design /
   Pcs / Rep — arrivals, not startable work. All three blockers (drop-ship, short ship,
   backorder) are already in the payload; two now render as tags but there is no single column
   that says *do not schedule this*.
2. **The short-ship ✗ compares mismatched scopes.** `piecesOrdered` is the whole PO;
   `piecesShipped` is only today's cartons (`sanmar-orders.js` ~:1437 vs ~:1440). Every PO split
   across *days* prints a false ✗ on Bradley's sheet, camouflaging the real ones. Ruthie's sheet
   has no shortfall column at all. ⚠️ The bug is real and I confirmed it in the code; the two
   verification passes **disagreed on the remedy**, so design it before building it. Note SanMar's
   own `complete` flag is parsed in `sanmar-soap.js` and discarded by `fetchLiveBoxesByPo`.
3. **Unaccounted-for freight is buried.** No work order → method `Other` (sorts last) → blank due
   date (sorts last within it). The freight most likely to blindside the floor lands on the last
   page, bottom row, uncounted.
4. **Unknown states print as blank.** “No due date on file” and “plenty of runway” are the same
   empty space on paper — the Rule #4 failure mode.
5. **ManageOrders-unresolved POs print as routine.** When the nightly sync lags only the first 25
   unmatched WOs get live-resolved; the rest print with Due `—`, method `Other` and **no rush
   badge** — a genuine rush silently demoted and sorted last.

---

## psst-audit.js — fixed 2026-08-26 (`5a54396`, script only, nothing to deploy)

Reported the clean 08-26 manifest as 26 missing POs. Three defects, each alone enough:
refreshed the padding band instead of the arrival span; no sync-freshness check; and a
rate-limited fetch counted as "not on the board". Full write-up in
[`LESSONS_LEARNED.md`](LESSONS_LEARNED.md) — the durable rule is that **a check must distinguish
“I looked and it isn't there” from “I never looked”, and must say which.**

Usage — the window is derived from the CSV, never typed:

```bash
node scripts/psst-audit.js "path/to/FreightManifest.csv"
```

⚠️ Run it **after** the ~05:31 PT sync. Before that it now says so plainly instead of inventing
discrepancies. Exit 1 = issues **or** an inconclusive run; read the header lines, not just the tail.
