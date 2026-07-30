# Embroidery pricing vs real cost — findings 2026-07-29

Report artifact: <https://claude.ai/code/artifact/6dd19667-f19c-4a4a-aa06-186dc2b75ba0>

## The headline

**The Caspio embroidery price list is broadly sound. It is not being charged.**
Orders placed 2024-08-01 → 2026-07-29 (Custom Embroidery + Caps, 1,938 orders with a PO,
78,707 pieces) invoiced **$2,561,910** against a Caspio-list value of **$3,003,911** —
**85% realization, a $442,001 gap, ≈$221,000/yr.** 88% of orders invoice below list.

The gap is **revenue-side only** (list minus invoiced on identical orders), so it holds
regardless of how labour is modelled. That is why it is the number to lead with.

## ShopWorks ODBC — the production tables (this is the reusable part)

DSN `SWODBC` on **bandit**, `UID=extro;PWD=extro`. Reach it with
`Import-Clixml "$env:USERPROFILE\bandit-cred.xml"` + `Invoke-Command -ComputerName bandit`.
The table/column catalog is `shopworks-odbc-schema-catalog.txt` — **only 16 tables are
exposed**; restore it from `Downloads/repo-memory-backup-2026-07-28` (the 7/28 reset deleted it).

| Table | What it actually holds |
|---|---|
| `ProductionLogDetails` | the real production log: `id_Order`, `id_Machine`, `id_Employee`, `date_Log`, `Qty`, `cn_Hours_Calculated`, `cur_LaborRate`, `cnCur_RevenuePerHour` |
| `Machines` | `MachineName`, **`NumberOfHeads`**, **`StitchesPerMinute`**, `UnitsPerHour`, `cur_MachineRate` |
| `Orders` | `cn_StitchCount`, `cn_TotalProductQty_Act`, `cn_TotalProductQty_Imprints` |
| `LinesOE` | 494 cols: `PartNumber`, `Size01..06_Act`, `cur_UnitCost`, `cnCur_UnitPriceCalculated`, `cur_UnitPriceUserEntered`, `cnCur_UnitPriceUsed` |
| `PO` | `id_Order`, `cur_Subtotal`, `cur_Shipping`, `cnCur_PayablesDifference` |

🔑 **`ProductionLogDetails.Hours` is NULL — use `cn_Hours_Calculated`.** (`Hours` is populated
on 4 of 14,837 rows.)
🔑 **`Orders.cn_StitchCount` is the SUM across the order's designs/locations**, not per piece.
`cn_TotalProductQty_Imprints ÷ cn_TotalProductQty_Act` = locations per piece.
🔑 **`LinesOE` cost fields are mostly dead**: `cnCur_Line_GrossProfit`, `cnCur_LineCost_Product`,
`cnCur_LineCost_Purchased`, `cnCur_UnitCostPurchasedAvg` are 0/NULL on every row.
`cnCur_LineCost_ToPurchase` is just `cur_UnitCost × qty`, so it is 0 wherever `cur_UnitCost` is.
**Take blank cost from the PO at order level** — line cost misses ~40% of blank dollars.
🔑 **Calc fields (`cn_`/`cnCur_`/`ct_`/`sum_`) are slow in FileMaker** — a 12,929-row `Orders`
pull with `cn_StitchCount` exceeds 2 minutes. Background it with a long `CommandTimeout`.
🔑 `cnCur_UnitPriceDiscount` is **0 everywhere** — discounts are applied by editing the unit
price or as a separate line literally titled "25% OFF". Detect discounting by comparing to
list, never by reading that field.

## Measured production rates (the numbers to price on)

From `ProductionLogDetails` 2024-01-01 → 2026-05-31, 5,383 clean logs:

| process | actual pcs/hr | Erik's estimate | |
|---|---|---|---|
| Cap embroidery | **12.0** | 12 | ✅ |
| DTG | **21.1** | 22 | ✅ |
| Flat embroidery | **10.8** | 16 | ❌ high 48% |
| Transfers | 19.4 (70 hrs only) | 30 | ❌ |
| Patch sewing | 17.1 | 35 | ❌ |

By quantity tier — **this is the cost curve the tier ladder should follow**:
garments 3.82 / 6.84 / 8.26 / 10.56 / 13.66 · caps 4.50 / 9.96 / 11.28 / 11.75 / 19.96.
Cost/pc swings **3.6× (garments) and 4.4× (caps)** across tiers while the price only swings
1.5× and 1.8×. **Only garments at 72+ fully cover their hour (+$2.43/pc).**

⚠️ **Production logging is dying** — 4–14 logs/day Oct–Nov 2025, 1–5/day by spring, **nothing
after 2026-05-20**. It covers only ~50% of paid embroidery hours. This is the ceiling on all
future job-costing accuracy.

## Cost model

`$89.74` per paid production hour = `$1,494,241` GL non-material cost (12 mo to 2026-07-31,
5xxx+6xxx less materials 5000/5003/5004/5005/5034/5035/5037/5042 and income tax 6830/6821)
÷ `16,650` production hours. Uplift to chargeable hours **×3.19** → **`$285.92` per chargeable
embroidery hour**. Embroidery book runs **−19.3% as invoiced, −1.7% at full list**.

Validated against the prior Excel model: its **$91.52/production hour and $53.63 break-even
were both confirmed** (within 8% and 5%). Its **$127.99/machine hour is not reproducible** —
it compared 2.65 years of machine hours against 7 months of cost.

## Two prior recommendations that were dangerous

1. **"Quote embroidery at $6.75 a logo"** — the engine charges **$12–18** and realized revenue
   net of blank is **$28.58/pc**. Would have been a 44–63% cut on the largest revenue line.
2. **"Quote patch sewing at $3.25/patch"** — service code `SEG` charges **$10**, and
   17.1 pcs/hr × $10 = $171/hr matches ShopWorks' own $170/hr. Would have been a 68% cut.

## Other live findings

- **The $50 LTM is mostly uncollected.** On 261 small orders invoices sit closer to the *no-fee*
  list (median 92% vs 78%); only ~19% show it. It is **baked into the per-piece price**, not a
  line item (`Service_Codes.LTM` notes this), so nobody can see whether it went on.
- **The 8-23 tier is the weakest spot in the list**: same $18 decoration as 1-7, **no LTM at
  all**, 6.84 pcs/hr, ~334 orders/yr.
- **Contract embroidery runs at the SAME speed as retail** (10.9 vs 10.0 pcs/hr, same median
  stitch count) for **16% of the price** ($6.15/pc vs $38.41). The workbook's "contract is slow
  because of changeovers" explanation is wrong — it is purely priced low.
- **Garment margin swings 33×** ($3.06 on a PC61, $90.45 on a North Face) while embroidery cost
  swings 3.6×. **Which garment it goes on matters more than which tier.**
- **GL 5231 "Digital Printing" is DTG PAYROLL**, not purchased print (27 General Journal rows
  labelled "payroll NN"). 5003 ($60,027) is Supacolor film. Only Screenprint (4200) is brokered.
- **DTG ink is $57,427/yr** (GL), not the $35,000 estimate → ~$3.20/print at 17,900 prints.
- **`Machines.cur_MachineRate` is $50/hr embroidery, $25 Kornit** against $89.74 actual, and
  `UnitsPerHour` standards are optimistic (Kornit 30 vs 21, Transfer 35 vs 19.4). ShopWorks job
  costing understates by 41–70%.

## Method traps hit along the way

- **Never mix periods.** Machine hours from a 2.65-year log ÷ 7 months of cost produced the
  bogus $127.99. Label every figure with its window.
- **Order-by-order costing is the right method but this data cannot support it** — 2025 logged
  only 21% of paid hours, and 3% of orders imply impossible rates (0.2 to 283 pcs/hr). Pooled
  tier rates average the logging noise out; single-order figures inherit it.
- **Calibrate and apply the hours uplift on the same rate basis.** Stitch-band rates and
  quantity-tier rates give the same 2025 pool but different 2-year totals; the tier basis is
  measured directly on the orders being priced, so it wins.

## Open

- DTG prints/year (closes the last ink variable) · why logging stopped 2026-05-20 · whether DTF
  `PressingLaborCost` $2.50 is wage-only or loaded · split the uplift per-order vs per-piece.
- **Rounding drift**: Caspio sends `HalfDollarCeil_Final`;
  `embroidery-pricing-service.js:230` tests `'HalfDollarUp'` → falls to whole-dollar ceil, while
  `cap-embroidery-pricing-service.js:224` defaults to half-dollar. The Caspio field is dead
  config for both. Check whether the catalog matrix and `QuoteCartEngine.singleItemPreview`
  (`quote-cart-engine.js:931`) disagree by $0.50 on some styles — that would be a Rule 9 break.

---

# Ten-year order profile (2016-01-01 → 2026-07-29) — added 2026-07-29

Types 21 (Custom Embroidery) + 1 (Caps) only. 16,106 orders, $14.03M, **604,441 units**
(15,567 orders carry qty > 0; 539 do not and are excluded from unit maths).

## 🔑 `LinesOE.id_ProductClass` — the filter that makes line data usable

| value | meaning | example |
|---|---|---|
| **1** | product (garments AND caps) | `PC61`, `112` Richardson |
| **''** (unset) | **also a real product** — a steady 10–18% of lines *every* year, not legacy | `2000` Gildan, `156` Vision polo |
| 9 | decoration | `DECG` Di. Embroider Garms, `DECC` Dir Embroider Customer Caps |
| 10 | additional logo | `AL`, `FB`, `ES` additional stitches |
| 2 | fees | `DGT-001` digitizing, `GRT-50` mockup |

**Without this filter, line quantity treble-counts: 1.95M line-units vs 604K real units** —
because the garment line, its `DECG` decoration line, and its `AL` additional-logo line each
carry the same quantity. Class 1 still contains fee rows (`DD` Digitizing Setup), so a
part-number/description fee filter is needed on top. Reconciliation against
`Orders.cn_TotalProductQty_Act`: median 1.000, total 0.884.

🔑 **`LinesOE.id_OrderType` is denormalised** — filter lines by order type with NO join and NO
subquery to Orders. A subquery (`WHERE id_Order IN (SELECT …)`) never returned; the flat form
pulled 81,694 rows in ~12 min chunked one year per connection.

## 🔴 Caps were recoded into Custom Embroidery GRADUALLY over the whole decade

Cap units as a share of **order-type-21** units: **8.0% (2016) → 12.7 → 19.2 → 22.0 → 22.4 →
14.1 → 24.7 → 20.2 → 22.5 → 30.5% (2025) → 53.4% (2026)**. So it is not a 2026 event —
**any cap series built on order type is wrong for every year**, and "caps fell 74%" (582 → 154
type-1 orders) is largely an artifact. Cap units actually held: 40,342 (2016) → 21,379 (2025).

**Classify caps from the garment.** Keywords `cap|caps|trucker|hat|hats|beanie|visor|snapback|
flexfit|osfa|dad hat|mesh back|knit cap`. Validated against type-1 orders (trustworthy through
~2024): **recovery 81.3–93.0% in every year**. Orders that sold no blank (customer-supplied
goods) fall back to the decoration line, which names the substrate (`DECC`, `Cap Back`) —
that lifts coverage from 87.5% to **99.8% of units**.

## Units per quantity tier — the order/unit inversion

Caps and garments tiered **separately** (as the Caspio engine prices them; a mixed order
contributes one cap stream and one garment stream, so stream-orders 17,160 > 15,567 orders):

| tier | cap units | % | garm units | % | total | % |
|---|---|---|---|---|---|---|
| 1-7 | 2,527 | 0.9% | 16,781 | 5.3% | 19,307 | 3.2% |
| 8-23 | 12,951 | 4.6% | 51,847 | 16.3% | 64,798 | 10.7% |
| 24-47 | 38,915 | 13.7% | 59,194 | 18.6% | 98,109 | 16.3% |
| 48-71 | 38,100 | 13.4% | 40,840 | 12.8% | 78,940 | 13.1% |
| **72+** | **191,829** | **67.5%** | **150,263** | **47.1%** | **342,092** | **56.7%** |
| total | 284,322 | | 318,925 | | 603,247 | |

- **1-7 is 31.3% of orders but 2.8% of units. 72+ is 13.9% of orders and 59.9% of units.**
  Small-order fees are an order-count lever, not a volume lever.
- **Caps are 47.1% of units but only ~29% of dollars** ($14.08/unit vs $31.40) — and two thirds
  of all cap volume sits in 72+, the one tier where caps are cheapest.
- ⚠️ Per-unit revenue in mixed orders is allocated unit-proportionally, so it flatters caps and
  understates garments. Treat the $/unit columns as indicative, not line-accurate.

## Reconciliation against the published 24-month report

Same window (2024-08-01 → 2026-07-29), invoiced, PO + revenue + qty present:
**Caps match exactly** — 205 orders / 16,695 pcs / $264,213.01. Custom Embroidery comes out
**+98 orders / +3,840 pcs / +$106,624** because the ten-year companion extracts have better
coverage (50 fewer no-PO, 38 fewer no-qty). Not a scope bug — the published $442,001 uplift is
understated by roughly 4%.

## Source files (scratchpad, regenerable)

`hist_orders.tsv` 16,106 · `hist_stitch.tsv` 16,106 · `hist_po.tsv` 45,847 ·
**`hist_lines_class.tsv` 81,694 (the good one — has `id_ProductClass`)**.
⚠️ The older `hist_lines.tsv` (173,547 rows) is **over-broad — it contains other order types**
(stickers, bags, temporary tattoos). Do not use it.

---

# Tier design: where the breaks belong and what the LTM must be — added 2026-07-30

## 🔑 The cost curve: hours(q) = S + v·q, fitted three ways

| | fixed setup S | variable v | R² |
|---|---|---|---|
| Flats (pooled tiers) | **1.279 hr/order** | 0.06612 hr/pc | 0.988 |
| Caps (pooled tiers) | **1.224 hr/order** | 0.04550 hr/pc | 0.985 |
| Order-level OLS, type 21 | 1.138 hr | 0.07022 hr/pc | 0.622 |
| Order-level OLS, type 1 (+imprints) | 1.184 hr | 0.06318 hr/pc | 0.773 |

Setup = **$114.75 direct** ($89.74/hr) or **$365.59 loaded** ($285.92/hr). ⚠️ `sts_Setup` is
logged on only 51 of 5,521 prodlog rows — setup CANNOT be measured directly, it must be
regressed out. Kornit and patch rows must be excluded (they are DTG / a different process).

## 🔴 The breaks are in the wrong place — hours per piece fall 83% by 8 pieces

Hours per piece: **1.345 (q=1) → 0.226 (q=8) → 0.119 (q=24) → 0.093 (q=48) → 0.084 (q=72) → 0.071 (q=288)**.
By 8 pieces the figure is **17% of its q=1 value** (an 83% fall), which is **87.5% of the total
improvement ever available** — the floor is v = 0.066 hr/pc no matter how big the order gets.
So the ladder has **zero breaks across 1-23 where cost falls 6×**, and **three breaks across
24-72+ where it falls 30%**. A DP k-segmentation on the real order distribution (piece-weighted,
optimal by construction) picks **2 / 4 / 8 / 18-26 at EVERY target rate tested** ($89.74 → $285.92)
against today's 8 / 24 / 48 / 72.

🔑 **S/v = 19.3 pieces (flats), 26.9 (caps)** — below that an order is mostly setup, above it
mostly running. That is the natural ceiling for a setup fee, and 23 already aligns with an
existing tier boundary.

## Contribution per production hour — the metric that makes tiers comparable

| tier | FLAT | CAP | marginal gain (flat) |
|---|---|---|---|
| 1-7 | $134 | $101 | — |
| 8-23 | $225 | $174 | **+$91** |
| 24-47 | $276 | $196 | +$51 |
| 48-71 | $312 | $214 | +$36 |
| 72+ | $321 | $255 | **+$9** |

**Spread 3.2×.** 🔑 **The 72 break is worth almost nothing (+2.9%) — 48 is the target.** Getting an
order out of 1-7 is the single highest-value move (+68%). ⚠️ At the $89.74 direct basis every tier
clears; 1-7 is not losing cash, it is the **worst use of a constrained hour**. The gap between
$89.74 and $285.92 is a *utilization* problem (only ~31% of embroidery hours log as productive)
and pricing cannot fix it.

## The small-order fee

Today's **$50 covers 44% of the $114.75 direct setup** and stops at 7, leaving 8-23 (285 orders/yr)
with nothing. Scenarios scored on 12,799 real orders over 11 years:

| scenario | fee rev/yr | vs today | FLAT 1-7 | FLAT 8-23 |
|---|---|---|---|---|
| A today $50, q≤7 | $15,768 | — | $134 | $225 |
| B $115, q≤7 | $36,267 | +$20,499 | $176 | $225 |
| **C $115, q≤23** | **$72,607** | **+$56,839** | **$176** | **$277** |
| D $150, q≤23 | $94,705 | +$78,936 | $199 | $293 |
| F $200 q≤7 / $100 q8-23 | $94,673 | +$78,905 | $232 | $271 |

**Recommend C**: $115 on every order of ≤23. Lands 8-23 exactly at 24-47 parity. 🔴 **No sellable
fee closes 1-7** — full equalization needs **$267/order** (four shirts at $117 each). Residual gap
$81,154/yr on 304 orders/yr; accept it or decline the work.

## Reorder economics

66% of customers reorder; **95.1% of all orders come from repeat customers**. Median gap **56 days**
(p25 19, p50 56, p75 180, p90 399).

🔴 **A reorder is NOT cheaper to set up.** Like-for-like (customers whose genuine first order is
inside the log window): first **1.299 hr** vs later **1.382 hr** — no saving. **Do not fund a
reorder discount from an assumed setup saving; it does not exist.** The naive all-orders
comparison (1.299 vs 1.587) is confounded — "first" only means first *in the log window*.

**The real prize is consolidation**, not earliness. Pairs of orders from one customer landing
inside a window, each paying a fresh 1.28 hr setup:

| window | pairs/yr | hours/yr | value/yr |
|---|---|---|---|
| 30 days | 374 | 478 | **$42,885** |
| 60 days | 456 | 583 | $52,322 |
| 90 days | 498 | 636 | $57,105 |

Merging just the 30-day pairs would cut 1-7 orders **2,760 → 484**. ⚠️ **32.3% of reorders drop a
tier** (37.3% same, 30.4% up); from 72+, **65% shrink and 372 of 1,896 fall all the way to 1-7**.
Target: at order entry, if the customer ordered within 60 days, offer to combine — and ask what
they need through the next quarter rather than taking the reorder as presented.

Scripts: `cost_curve.py`, `optimize_breaks.py`, `optimal_tiers.py`, `final_answers.py`,
`reorder_detail.py`, `scenarios.py` (session scratchpad). Customer pull =
`hist_customers.tsv`. ⚠️ **PowerShell writes dates in the LOCAL culture (M/D/YYYY)** — parse
before sorting or the sequence is wrong.

---

# Cost basis rebuilt from the general journal + TimeClick — added 2026-07-30

## 🔴 The GL is NOT on the ShopWorks ODBC — verified, don't look again

Scanned **all 2,724 columns across 18 exposed tables**. **Zero** columns match
`payroll|salary|wage`. No ledger, no journal, no debit/credit transaction table.
(`GetSchema("Columns")` throws `SQL_NO_NULLS already belongs to this DataTable` on the
FileMaker driver — enumerate columns with `SELECT * FROM t WHERE 1=0` and read
`rd.GetName(i)` instead.) ⚠️ **`LinesPur` errors `<File Missing>`** — it is listed but
unreadable.

Tables (19): `Addr Buttons ContactNumbers Contacts Cust Des DesignLocations Event InvLevel
LinesOE LinesPur Machines Orders OrdTyp PO Prod ProductionLogDetails Thumbnails Version`.

What exists is **account POINTERS, not postings**: `OrdTyp.coa_Revenue` /`coa_CostOfGoods`
/`gt_DepartmentCode` (all blank via ODBC), `Orders.cur_JobCost_Labor`,
`LinesOE.cnCur_LineCost_LaborDistribution`, `ProductionLogDetails.cnCur_TotalLabor`.
**Source of record for GL/payroll is Erik's CSV exports**, not the ODBC.

## Payroll by department (journal, 169 "YYYY Payroll NN" entries, 2019-2026)

| year | 5220 Production | 5231 Digital Print | indirect + tax | all payroll |
|---|---|---|---|---|
| 2021 | $242,994 | $60,681 | $510,662 | $814,337 |
| 2022 | $222,909 | $47,984 | $411,307 | $682,200 |
| 2023 | $310,595 | $58,433 | $558,738 | $927,766 |
| 2024 | $344,994 | $73,722 | $645,082 | $1,063,798 |
| 2025 | $338,723 | $85,460 | $688,397 | $1,112,580 |

Indirect = 6149 Admin + 6150 Art + 6155 Executive + 6472/3/6/8 taxes. 🔑 **Every $1 of
production wage carries $1.64 of indirect payroll ⇒ a loaded hour is 2.64× the floor wage**,
before any non-payroll cost. All payroll = **71-74% of the $1,494,241 non-material basis**,
so the payroll-only rate needs a **1.34× gross-up** for rent/equipment/utilities/supplies.

## 🔑 The $89.74/hr is CONSERVATIVE, and the rate choice changes no comparison

2025 bracket: payroll-only loaded **$49.03-56.12** → grossed up **$65.70-75.20** vs the
**$89.74** used in every table. So published profit figures understate by $14-24/hr.

**This does not matter for any ranking.** `profit/hr = contribution/hours − rate`: the rate
enters as a *subtraction*, so changing it shifts **every cell by the same amount**. Only the
position of zero moves — i.e. whether 1-7 is called a small loss (−$17 at $89.74) or a small
gain (+$6 at $66). Every conclusion about *relative* merit (garment mix beats quantity,
48 vs 72, the dead zones) is **rate-independent**.

⚠️ **The employee file holds CURRENT staff only**, so 5-14% of TimeClick hours per year
can't be mapped to a department (worst: Meang Sreynai, 12,309 hrs). Hence the bracket rather
than a point estimate.

## ⚠️ Data-quality traps in these exports

- **`General Journal Entries and payroll.csv` is a FileMaker portal export**: one header row
  per entry then continuation rows carrying only the extra GL lines. A record starts where
  `date_Transaction` is non-empty.
- 🔴 **`GJ_GL_COA::AccountName` is MISALIGNED with `GJ_GL::id_AccountMain`** — 93 of 110
  account ids carry two or more different names. **Key on the id**; get names from
  `General Ledger Detail…csv` (`id_AccountMain` → `GL_COA::ct_AccountName_FullShort`).
- `ProductionLogDetails.cur_LaborRate` is a **placeholder, not actual wages**: $17.00 flat on
  4,424 of 5,024 rows, $21.55 hours-weighted, one row at $135,000. ShopWorks job costing is
  therefore **wage-only with no overhead** — it reports every order far more profitable than
  it is. `Machines.cur_MachineRate` ($50/hr embroidery) has the same flaw.

---

# 🔴 Small orders are REORDERS — 21 years, and it revises the fee recommendation (2026-07-30)

Erik's objection killed a flat minimum: *"a customer orders 48, comes back for 3 within a
month, you hit them with $450 — they'll freak out."* He was right, and it is not an edge
case — **it is the majority of small orders and always has been.**

Pull: `Orders` types 21+1, **2006-2026, 42,545 orders** with `cn_TotalProductQty_Act`,
`id_Customer`, `CustomerServiceRep` → `%TEMP%/emb20.tsv`. ⚠️ **`LinesOE.id_Design` returns
EMPTY through the ODBC**, so "same customer within 90 days" is the proxy for "same job".

## Two-thirds of every 1-7 order is a reorder, in every era

| era | orders/yr | 1-7/yr | after a 24+ order | **reorder share of 1-7** |
|---|---|---|---|---|
| 2006-2010 | 2,859 | 755 | 351 | **78%** |
| 2011-2015 | 2,537 | 806 | 322 | **76%** |
| 2016-2020 | 1,688 | 492 | 209 | **74%** |
| 2021-2026 | 1,188 | 401 | 126 | **68%** |

Never below 63% in any single year, 2006→2026.

## The "freak out" case, measured (5,170 cases, 246/yr)

| | p25 | median | p75 |
|---|---|---|---|
| days since the big order | 10 | **27** | 49 |
| size of that big order | 38 | **62** | 133 |
| size of the follow-up | 2 | **3** | 5 |
| value of the follow-up | $47 | **$90** | $162 |
| **their spend in prior 90 days** | $1,185 | **$2,278** | $4,453 |

**32% come back within 14 days.** Erik's "48 then 3 within a month" is the median almost
exactly.

## 🔑 The 1-7 tier is TWO problems, now roughly even

| | 2021+ | treatment |
|---|---|---|
| **reorder after a 24+ order** | 126/yr | **keep the $50 fee** — incremental cost $230 vs $185 billed, short **$45** |
| **standalone small order** | 130/yr | **$450 minimum** — no relationship to protect |

🔑 **The existing $50 LTM is the RIGHT number for a reorder and always has been.** A re-run
costs only the blank ($97) + machine time ($41) + rep ($79) + Bradley ($13) = **$230**; art is
zero (design exists) and executive/office is already carried by the parent order. What is
missing is the **standalone** case, where $50 covers about a fifth of the $381 real cost.

**So: do NOT raise the fee to $200 and do NOT apply a flat minimum.** Keep $50 for reorders;
add a minimum that bites only when there is no qualifying recent order behind it.

## By rep — structural, not behavioural

Brian Egan 1,440 cases (180/yr) · Shannon Lundrigan 1,104 (110/yr) · Tracy Murphy 446
(112/yr) · Taylar Hanson 708 (64/yr) · **Nika Lao 468 (58/yr)**. Historical volume sits with
former reps; among current staff it is Nika. **Every rep who has ever held the desk shows the
same pattern** — it is customer behaviour, not anyone's habit, so it is not a coaching issue.

---

# Erik's ratchet hypothesis, tested against a control (2026-07-30)

**Claim:** big order → small fill-in (billed at the big-order price) → small becomes the norm
→ **the big order never comes back**.

## Design — why a control was needed

Without one, "orders shrank 48% after a small follow-up" proves nothing: embroidery orders
might shrink for everyone. **Treated** = customer placed ≥24 pieces then ≤7 within 90 days.
**Control** = placed ≥24 pieces, no small follow-up, anchored on the big order's date.
For the sharpened test both groups anchor on an **identical order N (≥48 pieces AND >$1,000)**.

✅ **Groups verified comparable**: order N median **100 vs 110 pieces**, **$2,031 vs $1,968**,
**19 prior orders each**, same era (2014 vs 2013). So the result is not composition.
⚠️ Confound worth naming: average order size ROSE over the two decades, so every "after"
window sits later in time and is biased **upward** — making the test conservative.

## Verdict: right on steps 1-3, wrong on step 4

| | after a fill-in | control |
|---|---|---|
| **order N+2 clears $1,000** | **26%** | 34% matched / 37% raw |
| median value of N+2 | $396 | $600 |
| median pieces of N+2 | 15 | 35 |

**0.75× matched.** Real effect — but *"rarely"* overstates it: **one in four still clears
$1,000.**

🔑 **The dip is ONE ORDER deep.** % over $1,000 at N+2 / N+3 / N+4 / N+5 = **26 / 32 / 29 /
30** against a flat **37** control (on the strict 2-3 piece definition the gap closes fully by
N+3: 36% vs 36%). 🔴 **"The big order never comes back" is REFUTED — 83% place another 24+
order within two years, statistically identical to the control's 82%** (median 133 days).

🔑 **But the money does not recover the way the order count does.** Total billed in the 12
months after order N: **$3,053 vs $6,080 median — half.** Within-customer, median order size
falls **−48% vs −9%** control; share of orders ≥24 falls 55%→36% vs 52%→46%.

**So the accurate statement is: a fill-in does not kill the next big order — it predicts an
account that bills half as much over the following year.**

## Does the fill-in get big-order pricing? Partly

Price/piece on the small order as a multiple of the big order it followed: p25 **1.03×**,
median **1.78×**, p75 4.08×. The tier structure implies ~1.35×, so the median IS charged more
— but **29% pay the same or less per piece**, i.e. the big-order price carried over.

## ⚠️ Association, not cause — and it matters for policy

A customer needing 2-3 pieces three weeks after a 100-piece run may be one whose programme is
winding down: the fill-in would then be **symptom, not cause**, and no pricing change fixes
it. Order data cannot separate the two. **It is still a strong predictor** (~750 examples), so
use it as a **sales trigger — a call, not a fee.** Samples: 240 treated / 354 control on the
size test; only 91 treated survive the frequency test's span requirement, so that table is
directional only.

Scripts: `ratchet.py`, `fillin.py`, `reorder20.py` (session scratchpad); data
`%TEMP%/emb20.tsv` (Orders types 21+1, 2006-2026, 42,545 rows with qty + customer + rep).

---

# Do small orders turn into big ones? — design-level, 2007-2008 (2026-07-30)

Erik's point, and he is right: at CUSTOMER level, 6 polos in March and 200 event tees in
September looks like "a small order grew". It did not — two unrelated programmes sharing a
customer. Only a **design-level** test answers whether a job that started small ever scales.

## 🔴 `Orders.id_DesignBlock` was ABANDONED after 2008 — check before reusing

Coverage: **98-99% for 2006-2008**, then **44% (2009), 15% (2010), 8% (2011), 5% (2012),
~1% from 2013 onward.** `LinesOE.id_Design` is empty at every date. So design history is
reconstructable **only for 2006-2008** and the question cannot be answered for the modern
business. `cn_DesignCount` shows multi-design orders exist (4,441 twos, 744 threes) but
`id_DesignBlock` never contains a separator — it holds **one** ID, so multi-design orders are
attributed to a single design.

⚠️ **The coverage collapse silently biases any cohort formed after 2008**: a design first
ordered in 2008 has its 2009-10 follow-ups invisible, so it scores as one-and-done. A first
run over a 2008+ cohort gave 11% growth; the clean 2007 window gives 17%. **Use 2007 only.**

❌ Fallback checked and rejected: the decoration line's free text (class 9/10
`PartDescription`) names a logo only rarely — 68% carry *something* but it is mostly garment
types ("Jackets", "Polos") and fee labels ("Additional Stitches in Logo Charge"). Only ~20% of
modern orders would get a usable key, and a noisy one.

## The answer, clean window (first order 2007, followed through 2008)

| | started SMALL (<24 pcs) | started BIG (24+) |
|---|---|---|
| designs | 316 | 697 |
| ever ordered again | **47%** | 48% |
| **ever reached 24+ pieces** | **17%** | **37%** |
| ever reached 48+ pieces | 9% | 24% |
| ever reached $1,000+ | 7% | 11% |
| mean later revenue | **$657** | $914 |

Under-$550 start (615 designs): 26% reach 24+ pieces but only **4% reach $1,000+** against 19%
for big starts; later revenue **$412 vs $1,486**. Median time for a small start to reach 24+
pieces: **141 days**.

## 🔑 What it means for the minimum-order decision

1. **Half of all designs never reorder at all — 47% vs 48%, identical regardless of start
   size.** A small first order is a worse *volume* signal, not a worse *relationship* signal.
2. **A small first order still carries ~$657 of follow-on revenue**, about 72% of a big first
   order's. That is real option value and **argues against a hard minimum on a design's FIRST
   order.**
3. **But big starts repeat big at roughly twice the rate** (37% vs 17%). Small starts grow —
   just less often.

⚠️ This is **2007-2008 evidence**, from a business doing ~3,300 orders/yr against today's
~1,300, and it cannot be refreshed. Weight it accordingly.

Scripts: `pull_designs.ps1`, `design_cohort.py` (session scratchpad); data
`%TEMP%/emb_designs.tsv` (43,764 rows, types 21+1, 2006-2026, with `id_DesignBlock`).

---

# 🔑 SUPERSEDES the 2007-08 design finding: modern window says small orders DO grow (2026-07-30)

Erik insisted the order↔design link must exist. **He was right** — there are TWO sources and
they cover different eras:

| source | populated |
|---|---|
| `Orders.id_DesignBlock` | **98-99% 2006-2008**, 44% 2009, then dead (~1% from 2013) |
| **`Event.ct_DesignIDs`** (+ `ct_DesignTitle`) | 0% pre-2009, **83-89% 2016-2018**, 39% 2019, **0% 2020-21**, 16-17% 2022-24, 8% 2025 |

🔑 **`Event` is the join table**: one row per order-event, `id_Order` always populated,
`ct_DesignIDs` on the design rows. ⚠️ `Event.id_Design` and `id_OrderDesign` are ALWAYS empty —
use `ct_DesignIDs`. `Des` (39,788 rows 2010-2026 via `date_Creation` chunking) gives
`DesignName`, `id_Customer` and **`date_Creation`** — anchor cohorts on that, not on first
appearance, because 2010-2015 is blind and a design "first seen" in 2016 may be years old.

## The answer, 2016 cohort followed to end-2018 (443 designs)

| | started SMALL (<24 pcs) | started BIG (24+) |
|---|---|---|
| designs | 206 | 237 |
| ever ordered again | **50%** | 46% |
| **ever reached 24+ pieces** | **27%** | **32%** |
| ever reached 48+ pieces | 14% | 21% |
| ever reached $1,000+ | 13% | 19% |
| **mean later revenue** | **$1,510** | $1,705 |
| mean first order value | $274 | $1,249 |

Under-$550 start (258 designs): 27% vs 34% reach 24+; later revenue $1,204 vs $2,186.
Median time for a small start to reach 24+ pieces: **105 days**.

🔑 **The gap has closed.** In 2007-08 it was 17% vs 37%; in 2016-18 it is **27% vs 32%**.
Small starts even reorder slightly MORE often and return **89% as much follow-on revenue off a
first order worth a fifth as much.** Real cases: *Carlisle Foodservice* 1 pc/$71 (Feb 2016) →
**70 pcs/$2,598** (Jan 2017); *Hop Jacks 12* 2 pcs → 26 pcs.

## 🔴 Decision consequence

**Do NOT apply a minimum to a design's FIRST order.** Option value is $1,510 of follow-on
revenue off a $274 order. The minimum belongs only on a small order of an **existing** design
with no recent big order behind it — a repeat that stayed small, not a new logo finding its
feet. This is the third revision of the small-order policy and the reason each earlier version
was wrong was always the same: too coarse a definition of "small order".

⚠️ Coverage 83-89% biases the growth rates **DOWN**. ⚠️ 2019-2026 coverage collapses (0-17%),
so the pattern cannot be confirmed for today — **restoring the design link on orders is the
one data fix that would make this question answerable going forward.**

Scripts: `pull_event_designs.ps1`, `pull_des.ps1`, `design_cohort2.py`; data
`%TEMP%/event_designs.tsv` (19,707 links), `%TEMP%/des_table.tsv` (39,788 designs).
