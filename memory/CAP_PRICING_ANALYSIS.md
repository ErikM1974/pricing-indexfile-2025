# Cap pricing — the 8-23 "gap" investigated (2026-07-30)

**Verdict: cap 8-23 is not underpriced. Change nothing. Real gap ≈ $1,515/yr.**

Investigated because a realization pass flagged *"Cap 8-23 at 79.9-80.5% — the single worst
cell in the book (2,122 pcs)."* That figure is a composition artifact.

## Live Caspio (verified 2026-07-30)

`GET /api/pricing-bundle?method=CAP&styleNumber=C112`. Cap decoration by tier:
**1-7 $17 · 8-23 $17 · 24-47 $13 · 48-71 $11 · 72+ $9.50**, `MarginDenominator` 0.53 on every
tier, `LTM_Fee $50` at 1-7 only, rounding `HalfDollarCeil_Final`.
(⚠️ `/api/pricing-tiers` rejects `EmbroideryCaps` — its whitelist is DTG/ScreenPrint/
Embroidery/EmbroideryShirts. Cap margins come from the bundle.)

## 🔑 The headline number was a mix artifact

Splitting cap lines by what kind of order they are (`Orders.ExtSource` blank = quoted,
populated = webstore) changes everything:

| | lines | pieces | realization |
|---|---|---|---|
| Webstore / company store | 150 | 565 | **76.5%** |
| Quoted, decoration on its own line | 53 | 960 | 100.8% |
| Quoted, decoration in the unit price | 362 | 7,762 | **97.9%** |

Webstore orders run program pricing (Hops n Drops hats $11; company stores with a dozen
assorted items at flat price points). They are the biggest share of small-tier lines, so they
drag small tiers hardest.

**Quoted-only realization by tier:** 1-7 **92.6%** · 8-23 **88.9%** · 24-47 99.7% ·
48-71 100.8% · 72+ 97.4%. Small-tier gap = **$884 over 7 months ≈ $1,515/yr**.

⚠️ Two further confounds in any realization figure built from garment-line prices:
- Some orders bill decoration on its **own line** (`id_ProductClass` 9/10, e.g. `DECG`), so the
  garment line legitimately excludes decoration and reads as a deep discount.
- Order **141715 billed 20 caps at exactly blank cost ($3.12) with no decoration line at all**
  — a missing charge, not a discount. Worth a human look.

## 🔑 8-23 is not underpriced — it is the 2nd-best tier per production hour

At list, using the settled model ($30.09/hr, $100 order pool) and measured cap throughput
(pcs/hr: 1-7 4.50 · 8-23 9.96 · 24-47 11.28 · 48-71 11.75 · 72+ 19.96):

| tier | contribution / production hour |
|---|---|
| 1-7 | $159.50 |
| **8-23** | **$231.57** |
| 24-47 | $217.14 |
| 48-71 | $202.69 |
| 72+ | $314.37 |

Raising 8-23 would be fixing something that is not broken.

## 🔴 What IS broken: two revenue cliffs (pure arithmetic, no measurement involved)

| qty | tier | price/cap | order total |
|---|---|---|---|
| 7 | 1-7 | $30.00 | **$260** (incl. $50 LTM) |
| 8 | 8-23 | $30.00 | **$240** ← −$20 |
| 23 | 8-23 | $30.00 | **$690** |
| 24 | 24-47 | $26.00 | **$624** ← **−$66** |

**Profit inverts too: 23 caps earns $365, 24 caps earns $298 — rounding up costs $67.**
Behaviour already routes around it: **21 orders at exactly 24 pieces vs 10 across all of 20-23.**
The same cliff exists on garments (23 × $24.50 = $563.50 vs 24 × $20.50 = $492).

**Why it was not fixed:** removing the 23→24 cliff needs `p(24-47) ≥ 0.958 × p(8-23)`; it is
0.867 today. That means +11% on 24-47 (a tier realizing 99.7%) or −8% on 8-23 — both cost more
than the ~$1,150/yr the cliff leaks. Erik's call: leave it.

## Where cap money actually is

**Cap 1-7 is the only negative-profit cell** in the settled model (−$27 to −$57/order,
break-even 7.5 pcs vs 6.2 for garments). That is a decoration-price question, not a
realization one. See [COST_ALLOCATION_MODEL.md](COST_ALLOCATION_MODEL.md).

## 🔑 Reusable method lesson

**Split by `ExtSource` before computing realization, and check for class-9/10 decoration lines
before calling a low garment price a discount.** Every aggregate agreed with the wrong answer
until the raw `LinesOE` rows for the outlier orders were read one by one. Full write-up in
[LESSONS_LEARNED.md](LESSONS_LEARNED.md).

Scripts (scratchpad, regenerable): `cap_8_23.py`, `cap_realization.py`, `cap_topband.py`,
`cap_implied_dec.py`, `pull_cap_lines.ps1`, `pull_cap_source.ps1`.
