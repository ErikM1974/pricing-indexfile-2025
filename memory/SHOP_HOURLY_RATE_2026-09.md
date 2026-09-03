# Shop hourly rate — what an embroidery machine-hour costs (2026-09-03)

Erik's ask (2026-09-02 EOD): "calculate our hourly shop rate — like an auto repair garage or a
lawyer — an hourly rate for factory work." Report artifact: "NWCA Shop Rate" (claude.ai, 2026-09-03).
Companion to `EMBROIDERY_STITCH_COST_2026-09.md`, `COST_ALLOCATION_MODEL.md`, `VOLUME_QUOTE_2026-09.md`.

## The three rates (2025 ledger ÷ 2025 billable machine-hours)

| tier | 2025 pool | per BILLABLE h (7,733) | per worst-case h (14,838) | per PAID emb h (15,831) |
|---|---|---|---|---|
| A production floor (5220+burden, thread, digitizing, 80% util/factory, 50% art) | $514,815 | **$66.57** | $34.70 | $32.52 |
| B shop (A + 51.9% of admin 6149+burden+admin non-payroll) | $705,653 | **$91.25** | $47.56 | $44.57 |
| C whole company (B + 51.9% of exec, insurance, prop tax, marketing, card fees, B&O) | $929,019 | **$120.14** | $62.61 | $58.68 |

- **Posted rate with margin: $150/h (C ÷ 0.80), $172/h at 30%.**
- 🔑 **Billable hours ≠ paid hours.** 2025 embroidery: 1,457 orders, 61,543 pcs, 747M stitches →
  model hours **7,733 typical / 14,838 worst**; paid 15,831; logged only 5,321 (logging ~half, stopped
  May 2026). Fleet capacity 9 machines × 2,000 h = 18,000 → **utilization 43% typical / 82% worst**.
- 🔴 **VOL-HOUR-RATE $30.09 is per PAID hour, but the Volume Quote / Break-Even pages multiply it
  by BILLABLE minutes** → idle/unlogged time is not recovered. Same production pool per billable hour
  = **$67**. Sanity: pool ÷ paid hours = $32.52 = July's $30.09 + thread + digitizing ✓. Erik decides
  whether to set VOL-HOUR-RATE to 67 (would turn several contract cells red at typical run). NOT changed.

## What the cards bill per billable hour (decoration line only, typical minutes incl. setup share)

Full back 72+ $195 · FB 24-47 $176 · custom 72+ $12 flat $144 · contract 1-7 ($250 min) $143 ·
Braun VQ-2026-002 $127 · custom 24-47 $123 · contract 8-23 ($250 min) $107 · **contract garment 72+
$82 · contract 24-47 $77 · contract cap 24-47 $71 · custom 1-7 ($18+$50) $70 · contract cap 72+ $69**
· **2025 contract as invoiced $57/h (below the production rate)**.
🔑 Custom 24+ and full back clear the whole-company rate on decoration alone; contract at 24+ pays
the floor but not the office (deliberate market position; the $250 minimum fixes the small end).
🔑 Utilization is the lever pricing can't reach: at 43% of one shift, extra billable hours cost
only the production rate.

## Four-year check (Erik: "look at all the transactions", 232K journal lines 2023→2026-09-02)

| year | emb share | production/h | shop/h | company/h | posted (20%) |
|---|---|---|---|---|---|
| 2023 | 54.2% | $74 | $99 | $129 | $161 |
| 2024 | 56.1% | $64 | $88 | $116 | $145 |
| 2025 | 51.9% | $67 | $91 | $120 | $150 |
| **2023-25 weighted** | 54.0% | **$68** | **$92** | **$121** | **$152** |

🔑 **$150 holds across three full years.** Materials 40–42% of revenue every year; net $92K / −$18K /
$164K. 2024 carries the $308K water-damage repair (facility) — excluded as a one-off. ⚠️ 2026 YTD
computes to $273 only because `orders.csv` holds $542K of the $876K embroidery the GL invoiced in
2026 — hours understated; redo the order pull before quoting a 2026 rate.

🔑 **The custom card IS $150/h × median logged minutes** (6-10K garments): 1-7 12.0 min → $30.00
vs card $30.50 · 8-23 6.58 → $16.45 vs $18 · 24-47 5.31 → $13.28 vs $14 · 48-71 5.22 → $13.05 vs
$13 · 72+ 4.33 → $10.83 vs $12. Contract garments 72+ = 63% of book, caps 81%.

## Bench rate + book-rate manual (Erik's garage idea)
- **Two posted rates: machine time $150/h; bench (hand work) $90/h**, quarter hours, $22.50 min,
  materials cost +30%. Bench basis: prod wages+burden $23.64/paid h ÷ 75% productive = $31.50 →
  +office $47.60 → +company $66.40 → $83 (20%) / $95 (30%).
- Book seeds: logged medians by product × qty band × stitch band (in the study script output —
  garment 72+ 6-10K 4.33 min; 24-47 5.31; 8-23 6.58; 1-7 12.0; cap 72+ <6K 2.95; full back 15K+
  24-47 8.75, 72+ 6.02). ShopWorks `Machines`: Sewing Patches 35/h, Transfer 35/h, Kornit 30/h →
  patch/transfer 1.7 min = $2.57 at bench. Estimates (need stopwatching): label removal 3 min,
  sew-in label 3, hem/tack 8, fold+bag 1, rehoop/rerun 6 (machine).
- ⏭️ Optional build: Caspio `Book_Rates` table + calculator, like the VOL-* rows.
- **Operator efficiency** (2025-26, single-operator orders, book = mean model): emp 151 120%, 136
  162%, 200 148%, 257 181% → the mean-model book is too loose for solo orders AND logs undercount;
  reset book to medians after logging is complete, then post a monthly scoreboard.
- ⚠️ Machines 4 and 15 log absurd units/hour (552, 185) — Qty field misuse; don't trust per-machine
  units/h from `ProductionLogDetails`.

## Method / gotchas
- Allocation: emb revenue share (4050+4150+4303)/total = 51.9%; burden 105,784/1,007,547 = 10.5%.
- Hours model: setup 87 min (caps 75) + (2.4 handling [2.7 caps] + 0.25 min/1K) per pc; worst ×1.5
  on setup+handling, 0.5 min/1K garments (4-head). From `orders.csv` types 21/1/22/42 + small types.
- Custom decoration $/h not computed — invoiced garment vs embroidery lines are not separable in
  the Orders export (would need LinesOE by id_ProductClass).
