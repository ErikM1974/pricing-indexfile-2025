# What a thousand stitches costs — embroidery cost study (2026-09-02)

Erik's ask: "the cost of a 5,000-stitch logo vs an 8,000-stitch logo; cost per 1,000 stitches;
include slack and worst production cases." Report artifact: "Cost of a Thousand Stitches"
(claude.ai artifact, published 2026-09-02). Companion to `COST_ALLOCATION_MODEL.md`,
`EMBROIDERY_PRICING_REALIZATION.md`, `VOLUME_QUOTE_2026-09.md`.

## Headline numbers (2025 ledger, logs 2018-2026, machines all 500 spm)

| figure | value | basis |
|---|---|---|
| **Marginal cost of 1,000 stitches on one piece** | **$0.15 (8-head) – $0.40 (4-head +50% slack)** | 2 min/head-run ÷ heads × $30.09/h + thread $0.020/1K |
| **8K vs 5K logo, direct cost difference / pc** | **$0.44 typical · $1.19 worst** | any quantity |
| Handling per piece (hoop/unhoop/trim/inspect) | **2.4 min = $1.20** | OLS on 1,745 garment orders (2.31–2.61 across size cuts) |
| Setup per order | 87 min (all) · 143 (24+) · 216 (72+) | OLS; big orders carry more locations |
| Fitted min per 1K stitches / pc | 0.083–0.090 | BELOW physics 0.25 — one operator runs >1 machine, so logged operator hours understate sewing |
| Fully absorbed cost per 1,000 stitches | **$1.10** | emb share of production pool $470K + overhead $387K ÷ 776.6M stitches |
| Price list per 1K stitches | 72+: $1.50 (8K) / $2.40 (5K) · 1-7: $2.25 / $3.60 | flat $12 / $18 spread over the logo |
| Worst-case multiplier | p90 = 1.36–1.46× fitted, p95 1.55–1.64× | actual/fitted hours per order → 50% slack ≈ 19 of 20 orders |
| 144+ pc orders, min/pc | p50 3.50 · p90 5.99 · p95 6.65 | logs |
| Thread | $0.020 per 1K stitches | GL 5034 $15,749 / 776.6M stitches |
| Overhead excl. production pool | $747,484 → emb 51.8% = $387,435 = **$6.27/pc · $263/order** | vs Erik's settled $100/order (admin only, exec excluded) |
| ShopWorks schedule TimeRun (696 cap events) | 0.30 min per 1K/pc = ~420 effective spm on 8 heads | validates 500 spm physics |

🔑 **The cost is per PIECE and per ORDER, not per stitch.** Same 8K logo: $6.00 direct at 12 pcs,
$2.46 at 500. Above 48 pcs the $12–13 charge covers even the fully-absorbed worst case; below 24
it does not — that is what the $50 fee is for.
🔑 **A stitch-based discount under 8K is worth ≤ $1/pc.** Keep $12 flat; the >8K surcharge
($1.25/1K) recovers 3–8× marginal cost. Volume breaks belong on setup/order cost.
🔑 Braun re-check (498 × 4,800 st @ $8): typical $1.99/pc, worst $3.84, fully absorbed worst
$10.31 → the $8 line is $2.31 short on FULL absorption; the garment margin ($15.76–34.58/pc)
carries it, order GM 49%. The "smaller logo" reason is worth $0.50–1.00/pc, not $4.

## Recommended Caspio changes (NOT applied — Erik decides)
- `VOL-HANDLING-MIN` 1.0 → **2.4** (raises Braun worst case $2.87 → $3.84/pc; matches p90).
- `VOL-SETUP-MIN` 77 → 90 (immaterial at volume). Keep `VOL-HOUR-RATE` 30.09 (Erik 2026-09-02).

## 2025 embroidery volume (Orders, invoiced 2025)
1,474 orders · 61,800 pieces · 776.6M stitches · $1.452M subtotal · median custom-emb order
8,295 stitches/pc (p25 5,089 · p75 15,040; MEAN 13.3K because multi-location). Revenue $1.87 per
1K stitches (garments included), $23.50/pc. 2024: 73,907 pcs / 944M st. 2026 YTD (Sep 2): 21,246
pcs / 254.6M st, $2.14 per 1K.

## Data + gotchas
- Pulled via `Invoke-Command bandit` + `DSN=SWODBC`: ProductionLogDetails (14,962 rows, 2018→),
  Orders since 2023 (`date_OrderPlaced`, NOT `date_Ordered` — that column does not exist),
  Machines, DesignLocations (63,065; `StitchesTotal` per location), Event (`TimeSetup`/`TimeRun`
  hours — only cap machines populate them), OrdTyp (`coa_Revenue`/`coa_CostOfGoods` per type).
- ⚠️ `conn.GetSchema('Columns')` throws on FileMaker ODBC; use `SELECT * … FETCH FIRST 1 ROWS ONLY`
  and read `GetName(i)`.
- GL: `Downloads/Tax-Finance/General Ledger since 2022.csv` (288,949 rows, through 2026-07-29;
  bandit `C:\SWF\general ledger 2026.csv` is the Jul-21 twin). Erik's newer export:
  `Downloads/General Journal 2023 to Sept 2 2026.csv`. Debit-positive; revenue negative.
- TimeClick `Hours Timeclick 2018.csv` double-counts salaried staff (Total rows + awarded rows
  → 4,144 h); use the July model's 19,936 production hours, don't re-sum naively.
- Logging RESUMED Aug 2026 (118 rows) after the May 20 stop.
