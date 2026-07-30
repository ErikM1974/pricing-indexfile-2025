# Customer order behaviour — 20 years of embroidery

**Measured 2026-07-30** from ShopWorks ODBC (`emb_designs.tsv`, order types 21+1, qty>0):
**42,546 orders · 4,646 customers · $30.5M · 20.6 years.**

Cohort for anything predictive = customers **first seen 2008 or later with ≥3 years of
runway** (**2,873** of them). Both censoring rules matter: 2006–07 first orders may not be
first, and a 2025 first order has had no time to develop.

Rendered on `/dashboards/pricing-analysis.html` → **Customer behaviour**. Figures live in
`memory/pricing-analysis-data.json` under `customers`; never hand-typed.

## The finding that decides small-order policy

🔑 **The second order predicts value ~50% better than the first order's size does.**

| split by | mean lifetime, high vs low | ratio |
|---|---|---|
| reordered within 90 days | $8,382 vs $2,773 | **3.0×** |
| first order 24+ pieces | $6,604 vs $3,171 | 2.1× |

The stronger signal is also **the one a rep can influence** — order size on a first call is
mostly a property of the customer, not the salesperson.

### The cross-tab (this is the table to use)

| first order | came back ≤90d | didn't | difference |
|---|---|---|---|
| under 8 pcs | **$5,479** (173) | $1,227 (417) | 4.5× |
| 8–23 pcs | $6,736 (343) | $1,642 (531) | 4.1× |
| 24–47 pcs | $7,633 (246) | $2,284 (419) | 3.3× |
| 48+ pcs | $12,498 (304) | $6,069 (440) | 2.1× |

**A small first order that reorders beats a 24–47 first order that doesn't** ($5,479 vs
$2,284). Read across, not down.

## Do small orders pay?

**Yes — 8.2×.** 590 customers started under 8 pieces; **mean lifetime $2,474** against
roughly **$300** to serve that first order. Median is only $373, so the distribution is
brutally skewed — but the mean is what a policy applies to, and a firm minimum declines the
whole bet. 🔴 **This, plus the settled cost model showing 1-7 flats at −$9 to +$20 per order
(not a loss), is why the proposed $450 minimum was withdrawn.** See
[COST_ALLOCATION_MODEL.md](COST_ALLOCATION_MODEL.md).

The lever instead: 71% of under-8 starters never return inside 90 days ($1,227); the 29% who
do are worth $5,479. **Converting ten percentage points ≈ $250,878 of lifetime revenue** on a
cohort that size. No pricing change on the page approaches that.

## Other decision-grade numbers

- **The first order is 13% of lifetime spend (median); first 2 = 25%, first 3 = 36%, first 12
  months = 35%.** Judging a customer on order one is judging on an eighth of the evidence.
- **Revenue by return speed:** never returned = 4% of revenue (966 customers, 32% of the
  cohort); **≤90 days = 64%**; 91–365 days = 21%; >1 year = 11%.
- 🔑 **Speed barely matters once they return** — back within 30 days averages $8,514, within
  180 days $8,334. Chase the return, not urgency.
- **Silence → probability of ever ordering again:** 40 d (the median gap) 75% · 90 d 68% ·
  161 d (p75) 60% · **393 d 38%**.
- **Gaps:** first→second p25 14 / p50 63 / p75 310 days. All consecutive: p50 40 / p75 161 /
  p90 393.
- **Concentration:** top 10% of customers = 68% of revenue, top 20% = 82%. The 32% who
  ordered exactly once are **3.1%** of revenue — they cost little to have taken.
- **Repeat-customer active span:** p25 0.6 yr · median 2.3 · p75 5.7.

## Gotchas

- ⚠️ **Association, not causation.** Nothing here shows that calling a customer *causes* the
  reorder. The $250,878 is the value of the gap, not a promised return on a phone campaign.
- ⚠️ Lifetime figures are **revenue**, not margin. At ~60% gross margin the 8.2× return on a
  small first order is still ~5×, so the conclusion survives, but don't quote them as profit.
- ⚠️ The customer key is `id_Customer`; a company that was re-entered under a new account
  reads as two customers and understates lifetime value.
- 🔑 Customer-level ≠ design-level. A customer who orders 6 office polos and 200 event tees
  looks like "a small order grew" but is two unrelated programmes. The design-level cohort is
  the separate test — **16% of small-start designs ever reach 24+**, and their later revenue
  is 48% of a big start's. See the Tier design section of the page.
