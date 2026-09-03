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

## Method / gotchas
- Allocation: emb revenue share (4050+4150+4303)/total = 51.9%; burden 105,784/1,007,547 = 10.5%.
- Hours model: setup 87 min (caps 75) + (2.4 handling [2.7 caps] + 0.25 min/1K) per pc; worst ×1.5
  on setup+handling, 0.5 min/1K garments (4-head). From `orders.csv` types 21/1/22/42 + small types.
- Custom decoration $/h not computed — invoiced garment vs embroidery lines are not separable in
  the Orders export (would need LinesOE by id_ProductClass).
