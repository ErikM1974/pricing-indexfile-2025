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

## Contract embroidery (added same day — "do we embroider caps faster? does contract make money?")

- **Caps are ~20% faster than garments at every tier** (logs 2023-26, 24+ pcs, comparable stitch
  counts): 144+ pcs caps 3.52 min/pc vs garments 4.46; 72-143 3.80 vs 5.00. Fit: cap sewing
  0.035 min/1K vs garment 0.090; handling similar (2.70 vs 2.61). Contract garments 6.3 min/pc
  at median 29 pcs; contract caps 3.65 at median 48.
- **Rate card** (contract calculator, 8K min): garments $1.10/1.00/0.90/0.85/0.80 per 1K by
  tier, caps $1.00/0.90/0.80/0.75/0.70. At 8K: 24+ makes $2.80–3.73/pc typical, $0.41–1.51
  worst; **1-7 and 8-23 lose money without the $50 small-order fee** (1-7: −$4.47 typical
  before fee). Caps = better contract product (cheaper to sew, priced only 10-12% lower).
- **2025 actual (Orders types 22/42)**: garments 207 orders / 12,711 pcs / $78,541 = $6.18/pc =
  **$0.50 per 1K BILLABLE vs card $0.80–1.10**; caps 71 / 7,046 / $36,054 = $5.12/pc = $0.46 vs
  $0.70–1.00. Direct contribution typical $50K (46% / 39%), ≈ break-even after $100/order
  (+$15.2K / +$7.1K), −$74K on full $6.27/pc absorption (overstated for contract — no garment
  purchasing/receiving). 🔴 **Realization is the problem, not the card**: card value of 2025
  contract work ≈ $150–190K vs $114.6K invoiced.

## Contract card verdict + recommendation (per ORDER incl. $100 order cost, 8K min)

- Current card + $50 fee, typical run: **1-7 −$68 / 8-23 −$26 per order (garments), caps −$66 / −$31**;
  24-47 +$30 / +$2; 48-71 +$122 / +$71; 72+ +$437 / +$306. Worst case: only 72+ positive.
  Break-even $/1K typical: 3.22 / 1.27 / 0.79 / 0.60 / 0.42 (garments); worst 4.23 / 1.82 / 1.20 / 0.97 / 0.77.
- 🔴 **The $50 fee cannot make small contract orders profitable** — needs $118–150 (1-7) or
  $76–129 (8-23); 93 of 207 contract garment orders in 2025 were < 24 pcs. No garment margin to absorb it.
- **APPLIED 2026-09-02 (final form)**: garments $1.25 / 1.10 / 1.00 / 0.90 / 0.85, caps $1.10 / 1.00 / 0.90 /
  0.80 / 0.75, **no fee, single $250 order minimum** (Erik: fee + minimum = two rules + a cliff at 24).
  $250 covers the worst case to ~18 pcs and the normal run to ~30; 4 pcs +$97, 12 pcs +$78, 24 pcs +$46.
  Earlier draft was fee $100 + $150 minimum. Typical per-order: 1-7 ≈ break-even, 8-23 +$34/+$28,
  24-47 +$59/+$31, 48-71 +$146/+$95, 72+ +$495/+$364. Worst case still negative at 24-71 @8K —
  priced for a normal run deliberately (worst-case break-even $1.20 would price us out).
- 🔑 **2025 contract work: invoiced $114.6K · at current card $191.8K (58% garments / 64% caps
  realization) · at recommended card $203.9K.** Collect the card first (+$77K), raise it second (+$12K).

## Direct (custom) embroidery verdict — LC 8K, garment ÷ 0.53 + $18/18/14/13/12, $50 LTM at 1-7

- Profit/pc typical: $4 tee $8.73 (1-7) → $13–16 (8+); $21 sweatshirt $23–31; $39 Carhartt $40–47.
  GM 34–67%. Worst case still $11+/pc on a $4 tee at 24+.
- **Only losing cell: 4 cheap tees at 1-7 → −$15 typical / −$47 worst per order after $100 order
  cost, even with the $50 fee** (= July's "1-7 flats break-even"). Everything else positive; a
  $21 sweatshirt at 1-7 still +$43.
- 🔑 The garment margin (47%) is the profit engine, not the $12 — why a $4 concession on Braun was
  affordable and the same on a contract job never would be.

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
