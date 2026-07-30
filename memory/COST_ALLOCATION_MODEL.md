# NWCA cost allocation model

How company overhead is spread across embroidery, DTG, DTF, laser, outsourced screenprint
and outsourced promo. Built 2026-07-30 from the general journal, TimeClick, the employee
file and 16 years of ShopWorks orders. Companion to `EMBROIDERY_PRICING_REALIZATION.md`.

## 🔴 The defect this replaces

Every pricing table before this loaded ALL admin, executive, art and sales cost into a
single **$89.74 production hour**. Wrong twice over:

1. **Admin/sales/art is an ORDER-level cost, not an hour-level one.** A 4-piece order needs
   the same quote, proof, invoice and collection as a 400-piece order. Spreading it on hours
   meant a **150-piece order absorbed 7.3× the overhead of a 4-piece order** — small orders
   were subsidised by large ones.
2. **Embroidery was charged as if it were the whole company** — it is **27.2% of orders and
   51.6% of revenue** (2024-25: 2,765 of 10,160 orders, $3.18M of $6.15M).

## 🔑 The rule: each cost on the base that actually drives it

| cost pool | 2025 w/ taxes | base | per order |
|---|---|---|---|
| Sales reps (Nika, Taneisha) | $237,067 | **rep-touched orders only** | **$79** |
| Bradley — import + purchasing | $67,449 | **ALL orders** (he touches every one) | **$13** |
| Steve — art | $81,267 | **rep-touched orders** | **$27** |
| Jim & Erik — executive | $258,394 | **% of revenue** (Erik's call) | **$97** |
| Production floor + machines | $525,179 | **production hour, IN-HOUSE ONLY** | **$33.17/hr** |

**An embroidery order carries $246. A webstore order carries $28.**

🔴 **REVISED 2026-07-30 after Erik confirmed there is NO RENT** (NWCA owns the building) **and that machines/utilities are production.** Rebuilding from actual GL accounts — payroll from the journal, non-payroll from the GL detail — gives **production $525,179** (payroll $468,403 + utilities/factory $56,776) and **front office $800,635** (payroll $644,177 + non-payroll $156,458). True operating cost is **$1,325,814**, not the $1,494,241 carried earlier. ⚠️ **The GL detail export is MISSING most payroll** (shows 5220 = $162,360 where the journal has $338,723) — always take payroll from the journal and non-payroll from the GL. Only facility cost is **property tax $33,542/yr**; where it sits barely matters ($33.17/hr vs $34.76).

🔴 **Webstore (Inksoft/Shopify) orders are AUTOMATIC** — Erik confirmed Bradley imports them
and buys the blanks; Nika and Taneisha never touch them. So they consume Bradley and nothing
else. An earlier model weighted them at ⅓ of a normal order across ALL admin — wrong in kind,
not degree. **Correcting it RAISED embroidery from $203 to $246**, because taking 2,281
webstore orders out of the sales denominator concentrates rep cost onto the orders reps
actually work. ⚠️ Outsourced screenprint/promo carry admin + executive but **ZERO production
overhead** — no machine hours.

2025 split: 5,271 orders = **2,281 webstore (43%, automatic)** + **2,990 rep-touched (57%)**,
of which 1,346 embroidery.

Sensitivity — the executive base is the only remaining judgement call:
revenue **$246** · rep-touched orders $236 · all orders $198 · unallocated $149.

## 🔑 Measured rep capacity — stable for 15 years

**3.3–5.2 orders per rep-day, every year 2011→2026.** Embroidery specifically **halved**,
2.6/day (2011) → 1.3/day (2025), while the average embroidery order **doubled** ($507 →
$1,116) and revenue per rep-day rose $1,930 → $2,933.

⚠️ A rep's raw order count is misleading: Nika shows 3,137 orders in 2025 (9.65/day) but
**1,490 are Inksoft she never touches** — her real load is **5.07 orders/day, 2.71
embroidery**. Taneisha: 3.20 real, 1.35 embroidery. **That is the true capacity — two people,
~5 real orders a day each.**

🔑 **Tenure buys order VALUE, not order COUNT.** Dedicated sales reps only: tenure vs
embroidery orders/day **r = −0.09**; vs dollars/day +0.24. Taylar peaked at 4.14 emb
orders/day in year 2 then declined to 1.38 by year 10 while her average order rose $827 →
$1,122. Taneisha hit 1.37/day at 11 months. **New reps are productive within a year and
peak around year two.** (A naive all-staff correlation reads r = −0.66 — an artifact of
mixing in Jim, Erik and Ruthie, who are managers, not order-entry reps.)

## 🔑 The daily nut — the number to manage to

Total 2025 operating cost (everything that is not the blank) = **$1,444,538** =
front office $925,968 + production $518,569 (four-year GL basis, below).

- **$5,977 a working day** the company must clear in gross margin.
- **$1,474 per rep-day** (1,014 rep-days worked) ≈ **$2,456/day of billing** at 60% GM.
- **2025 actual: $2,933 per rep-day** — covering it with ~19% headroom.

## ⚠️ Average vs marginal — both are right, for different questions

**$246/order is an AVERAGE, not a marginal cost.** The rep is there 8 hours regardless.

| question | basis | verdict on a 1-7 order |
|---|---|---|
| "Is our pricing structurally sound?" | full $246/order | **loses $160** |
| "Should I take this order this afternoon?" | blank + machine time only | **profitable** — beats idle |

Which applies depends on capacity, and **seasonality says exactly when**: embroidery orders
index **Oct/Nov 136%** of average (Nov revenue **222%**, avg order $1,745) vs **Jan 81%**
(avg order $825) — a **1.67× swing**. So the minimum order should bite hard from September
and relax in Q1. → argues for a **seasonal** minimum, not a flat one.

🔑 **Cost per order is a RESULT of throughput, not an input.** The front office costs $2,577
a day whether it processes 15 orders or 30: at 21/day it is $123/order, at 27/day it is $95.

## The layered build-up (answers "isn't it about $50?")

Erik's instinct of ~$50 is exactly the rep's own time. 2025, per order:

| layer | annual | per order | running |
|---|---|---|---|
| the sales rep's own time | $237,067 | **$45** | $45 |
| + Bradley (bookkeeping/import) | $67,449 | $13 | $58 |
| + Steve (art) | $81,267 | $15 | $73 |
| + Jim & Erik (executive) | $258,394 | $49 | **$122** |

(That column spreads flat over all 5,271 orders; the $246 above is embroidery's share once
each pool sits on its true driver.)

## Data notes

Sources: `General Journal Entries and payroll.csv` (169 payroll entries 2019-2026),
`Employees_2026-Jul-27_1632.csv` (Department / Job_Title / Pay / Date_Hired),
`Hours Timeclick 2018.csv` (01/2018-07/2026), ODBC `Orders` 2011-2026 (74,183 rows with
`CustomerServiceRep`), `ORDER_ODBC_…csv` (`ORDER_TYPE` names — `OrdTyp` returns them blank).
⚠️ The employee file holds **current staff only**, so 5-14% of TimeClick hours a year cannot
be mapped to a department.

## 🔑 The headline this produces

**A 24-piece order uses 2.87 machine hours = $95. The order itself costs $246 to take.**
The paperwork costs **2.6× the stitching**. NWCA is an order-processing business that happens
to embroider — so **per-piece pricing is the wrong instrument for most of the cost**, and a
minimum order / order-level fee is the right one.

Final tier profit per order ($33.17/hr + $246/order): **1-7 −$160** · 8-23 $74 · 24-47 $483 ·
48-71 $912 · 72+ $2,273. **1-7 has now lost money under seven different cost treatments.**

## 🔑 FOUR FULL YEARS — the authoritative basis (added 2026-07-30)

🔴 **`Downloads/General Ledger since 2022.csv` (289K rows) carries FULL payroll** — its 5220 reads
$338,723 for 2025, exactly matching the journal. **It supersedes both the payroll journal and the
19-month `General Ledger Detail` for all cost work.** (The GL *Detail* export is missing most
payroll — 5220 shows $162,360 there. Do not use it for payroll.)

| | 2022 | 2023 | 2024 | 2025 |
|---|---|---|---|---|
| material / blanks | $1,386,710 | $1,248,802 | $1,454,243 | $1,296,431 |
| production payroll | $377,330 | $435,046 | $448,261 | $424,183 |
| production non-payroll | $133,174 | $149,923 | $143,602 | $94,386 |
| office payroll | $550,574 | $650,182 | $688,825 | $688,437 |
| office non-payroll | $275,732 | $309,942 | **$531,497** | $237,531 |
| **PRODUCTION TOTAL** | $510,503 | $584,968 | $591,863 | $518,569 |
| **FRONT OFFICE TOTAL** | $826,306 | $960,124 | $1,220,323 | $925,968 |
| production hours | 17,421 | 21,515 | 21,854 | 19,936 |
| **PRODUCTION $/hour** | **$29.30** | **$27.19** | **$27.08** | **$26.01** |
| all orders | 4,462 | 4,957 | 4,889 | 5,271 |
| **FRONT OFFICE $/order** | **$185** | **$194** | **$250** | **$176** |

🔑 **The production hour is $26-29 and drifting DOWN** — not $89.74, and not the $33.17 computed
off a narrower hours base. Use **~$27/hr**.

🔑 **Front office per order averages $201 across four years** — which is exactly Erik's instinct
of "about $200 per order". Embroidery's $246 is that base redistributed by driver (it carries more
because executive is revenue-weighted and sales cost concentrates on rep-touched orders).

⚠️ **2024 office non-payroll spiked to $531,497** against ~$275K either side — unexplained, and it
alone moves that year's office/order from ~$190 to $250. Worth identifying before quoting 2024.

⚠️ Production hours here are TimeClick Garment Production + Digital Print (19,936 in 2025), a wider
base than the 15,831 embroidery-only figure used earlier — hence $26.01 vs $33.17. Match the hours
base to the cost pool or the rate is wrong.

**Older GL (2015-2021) is nice-to-have, not decision-relevant**: the four measured years are stable
enough that pricing decisions use current cost either way.

## 🔑 ELEVEN-YEAR SERIES from the full GL (added 2026-07-30)

`Downloads/Big general journal from 2014.csv` — 202 MB, 652,226 dated rows, spans 1999-2027
(effectively 2015+ for cost work). ✅ **Cross-checks EXACTLY against
`General Ledger since 2022.csv`** — zero difference on 16 account-year spot checks — so the
two exports agree and the long series is trustworthy. Netting **debit minus credit** on
expense accounts avoids double-counting: a bill and its later payment both post, but the
payment moves AP to cash and never touches the expense account.

| | 2015 | 2017 | 2019 | 2021 | 2023 | 2024 | 2025 |
|---|---|---|---|---|---|---|---|
| production total | $536k | $416k | $438k | $422k | $585k | $592k | $519k |
| front office total | $731k | $708k | $826k | $775k | $960k | $1,220k | $926k |
| **office $/order** | **$141** | $177 | $189 | $184 | $194 | **$250*** | **$176** |
| production $/hour | — | — | $45 | $32 | $27 | $27 | **$26** |

🔑 **Office cost per order has been FLAT at $176-194 since 2017** — a stable ~$185, which is
why Erik's own "$200 per order" instinct was well calibrated.

## ✅ The 2024 office spike is SOLVED — it was a one-off

**Account `6442` "Water Ice Damage": $234,437** in 2024 against **$0** in 2022-23 ($128,000
Write A Check + $106,437 Receive A Bill). A flood/burst-pipe event, **not an operating cost**.
Excluding it, 2024 office cost is **$202/order**, in line with 2023 ($194) and 2025 ($176).
**Exclude 6442 from any run-rate.** (Next largest 2024 movers are trivial by comparison: web
design +$17.6k, professional services +$15.9k, card fees +$8.8k.)

## ⚠️ The production $/hour "decline" is probably an ARTIFACT — do not cite it

$59 (2018) → $26 (2025) looks like a productivity story. It is not. Mapped production hours go
**8,242 (2018) → 21,854 (2024)** while production cost only moves $486k → $592k. The employee
file holds **current staff only**, so early years have far more unmappable people ⇒ hours
understated ⇒ rate inflated. **Trust 2022-2025 only ($29 / $27 / $27 / $26).**

## 🔴 CORRECTED BY ERIK 2026-07-30 — the per-order pool was too broad

Erik: *"the front office would be under admin… I think your totals are too high."* He was
right, and **it reverses the small-order conclusion.**

The old "front office" bucket was every 6xxx account — $925k in 2025 — which swept in
executive pay, marketing, credit-card fees, B&O tax, insurance and property tax alongside
actual admin. **Erik's call: pool = Admin + Art only.**

| 2025 pool | | $/order |
|---|---|---|
| 6149 Admin + taxes | $304,722 | |
| 6150 Art + taxes | $81,322 | |
| admin non-payroll (computers, phone, office, prof. services) | $63,530 | |
| **POOL B** | **$449,574** | **$85 flat** |
| same pool, driver-based (sales → 2,990 rep-touched; rest → all 5,271) | | **$120** |

Excluded and covered from gross margin instead: executive $258,568, sales/marketing
non-payroll $67,281, company non-payroll $104,851. ⚠️ **Total 2025 operating cost is
$1,443,380 either way** — the line only decides what a single order must justify itself
against, not what the company spends.

### 🔑 The consequence: 1-7 is BREAK-EVEN, not a loser

| tier | flats @$85 | flats @$120 | caps @$85 |
|---|---|---|---|
| **1-7** | **+$11** | **−$23** | **−$37** |
| 8-23 | $250 | $216 | $151 |
| 24-47 | $668 | $634 | $307 |
| 48-71 | $1,109 | $1,075 | $547 |
| 72+ | $2,515 | $2,481 | $1,581 |

Previously recorded as **−$165** on pool E. **That was an artefact of charging every order a
share of Jim and Erik's salaries.** Range across defensible treatments is −$23 to +$11.

🔴 **The $450 minimum order is WITHDRAWN.** Three independent findings now agree: 1-7 is
break-even; 68-75% of small orders are reorders from customers who just spent a median
$2,278; and 27% of small-start designs grow to 24+ pieces carrying $1,510 of follow-on
revenue. **The existing $50 fee is correctly sized.**

**Unaffected and still actionable**: caps lose at 1-7 (−$37 to −$71) and are thin at 8-23;
garment mix (a comparison, so per-order cost cancels); the revenue cliffs (pure price
structure); the 85% realization gap (revenue side only).

⚠️ **General lesson: the small-order conclusion was highly sensitive to one classification
choice.** Any future per-order cost claim should be stated with the pool that produced it.

## ✅ SETTLED MODEL (Erik, 2026-07-30) — art is PRODUCTION labour

Erik's final calls: **pool = Admin only** (executive, marketing, card fees, B&O, insurance and
property tax all come out of gross margin instead), and **art belongs in production labour,
not the office**. The latter also matches his own `NWCA_Office_Overhead_2015-2026` report,
which puts 6150 in PRODUCTION LABOR.

| | 2025 |
|---|---|
| production pool (5220+5231+5085+5119) + **art $81,322** | **$599,891** |
| ÷ 19,936 production hours | **$30.09/hour** (was $26.01 without art) |
| order pool: admin $304,722 + office non-payroll $63,530 | **$368,252** |
| ÷ 5,271 orders, flat | **$70/order** |
| driver-based (sales→2,990 rep-touched; Bradley/office→all) | **$100/order** |

Driver split uses **Erik's actual $89,000 for Bradley** rather than a salary-ratio estimate:
sales $69 + Bradley $19 + office $12. (The estimate had given $115; the real figure gives $100.)

⚠️ **Art COST is in the production pool but Steve's HOURS are NOT in the denominator.**
Deliberate: `hours(q) = S + v·q` is fitted on embroidery machine time, which never includes
art. Adding Steve's 4,144 hrs would drop the rate to $24.91 and under-recover art.

### Final tier profit per order

| tier | flats @$70 | flats @$100 | caps @$70 | caps @$100 |
|---|---|---|---|---|
| **1-7** | **+$20** | **−$9** | **−$27** | **−$57** |
| 8-23 | $257 | $227 | $159 | $129 |
| 24-47 | $670 | $640 | $312 | $282 |
| 48-71 | $1,104 | $1,074 | $548 | $518 |
| 72+ | $2,484 | $2,454 | $1,556 | $1,526 |

🔑 **Flats at 1-7 are break-even (−$9 to +$20). Caps at 1-7 still lose (−$27 to −$57).**
So the remaining small-order problem is **caps only**, not small orders generally.

## 🔑 Erik's own overhead report — independent validation + a structural finding

`Downloads/NWCA_Office_Overhead_2015-2026_1.csv`, built from the same big GL. **7 of 10
categories reconcile to the dollar; totals agree within $912 (0.1%)** ($899,774 vs $900,686).
It confirms the 2024 water damage independently: Occupancy & Facility **$308,445 against an
$83,183 ten-year average**.

🔴 **The structural finding, 2015 → 2025:**

| | 2015 | 2025 | change |
|---|---|---|---|
| office overhead | $699,272 | $900,686 | **+29%** |
| production labour | $519,087 | $543,852 | +5% |
| **admin & office payroll** | $325,200 | $509,769 | **+57%** |
| all company orders | 5,176 | 5,271 | +2% |
| **embroidery orders** | 2,293 | 1,346 | **−41%** |

**Office overhead is now 1.66× production labour, against 1.35× in 2015.** Admin payroll grew
57% while order count was flat and embroidery orders nearly halved. The cost pressure is not
on the shop floor.

⚠️ Two flaws in that report, neither consequential: **Depreciation appears only in 2019-2020**
($96,917, $82,344) and nowhere else in eleven years — an accounting change, not reality; and
its "PRODUCTION LABOR" line includes **5119 Factory Expense** ($46,073), which is not labour.
