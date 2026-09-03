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

## Oddball price list (from real LinesOE history 2023→2026-09-03; Erik-approved rates $150 machine / $90 bench)

History (6,503 service-like lines): **names/monograms/numbers 539 orders, 5,247 pcs, $54K, always $12.50**
(= 5 min × $150 ✓) · sew patches on caps 15 orders / 2,529 pcs, $5.00–6.00 · patches on garments/vests
32 orders / 716 pcs, $5–12.50 (median $8) · heat-press customer transfer 27 orders, median $15 (incl.
Supacolor), press-only ~$8.50 · bag & label $0.75 (1,156 pcs) · laser run $1.15–1.25/side + $65 setup ·
patch-during-run upcharge $5 · puff $5 · velcro $5 · samples $30–75 · **label removal / relabel / hem /
re-run: NO history — given away or folded into garment price.** Stable fee catalogue unchanged: DD $100,
GRT-50 $50, GRT-75 $75/h, SPSU $30, SPRESET $25, RUSH 25%, AL, webstore $300, laser setup $65.

**List (book min → price):** name/monogram 5 min → $12.50 · patch on cap 3.5 → $5.50 · patch on
garment/vest 5 → $7.50 · patch on bag/backpack 6 → $9.00 · velcro 3.5 → $5.25 · heat-press press-only
3 → $4.50 (+transfer cost ×1.3) · patch-during-run $5 · puff $5 · laser $1.25/side + $65 · bag & label
$0.75 (fold+bag+tag $1.50) · label removal 3 → $4.50 · sew-in label 4 → $6.00 · hem/tack 8 → $12.00 ·
single-head sample 20 min → $50 (8K) / $75 / $100 · re-run 6 min machine → $15 · **job setup $22.50 on
every oddball job, $75 job minimum; $250 contract minimum still governs customer-supplied embroidery;
shop-supplied materials cost +30%; bill in quarter hours.** ✅ BUILT 2026-09-03 (Erik: "build all three"):
(1) customer card `/pages/shop-services-pricing.html` (printable, LIVE v2026.09.03.1); (2) **25 Caspio
`Service_Codes` rows, ServiceType `SHOP`** = the price list (Position RULE rows: SHOP-JOB-MIN 75,
SHOP-BENCH-QH 25, SHOP-MACHINE-QH 37.50, SHOP-MATERIAL-MARKUP 30; SHOP-LASER-SETUP 65; UnitCost = book
minutes) — edit prices in Caspio, no deploy; (3) rep calculator `/calculators/shop-services/` (card
lines + quarter-hour time + materials, job minimum, Save → `SHP-YYYY-NNN`, read-only in Quote Mgmt;
Staff dashboard → Calculators next to Contract Embroidery). Erik simplified the structure: NO $22.50
setup line — setup is inside the $75 minimum. Laser on customer items: $65 setup + $10/tumbler (rotary,
~4 min) or $7.50/flat item; 5 tumblers = $115. ⚠️ SHP save path not yet exercised with a real quote.

**MERGE 2026-09-03 (Erik: paid prices, reuse existing parts, one page):** SECC $10→**$5.50**, SEG $10→**$8.00**
(paid numbers; the $10 card was never collected). Every SHOP menu row now names its ShopWorks part in
`AliasFor`: Monogram · Name/Number ($15, new menu row) · SECC · SEG (garments + vests + bags + backpacks +
velcro, one price) · DT (samples $50/75/100) · 3D-EMB · Laser Patch · Transfer (press-only **$8.50** — a heat press is MACHINE time, 3 min = $7.50 basis; $4.50 bench figure was wrong, Erik 2026-09-03) · DECG
(labels, hems, bag & label, fold/bag/tag, re-runs, off-card time; DECC for caps) · Laser + Setup (customer
items) · LTM (= the $75 top-up). Retired: SHOP-PATCH-BAG, SHOP-VELCRO (→SEG), SHOP-LASER-SIDE (JDS calc).
🔑 **The SHOP menu row is the price of record; AliasFor is only the billing code** — a first pass let
the part's flat price win and the $75 minimum became $50 (LTM) and the bigger samples $50 (DT). The
cheat sheet (`/calculators/service-price-cheat-sheet.html`) is now the ONE rep page: rules strip +
shop-services section with part numbers + fees; the customer card and calculator read the same rows.
Calculator saves StyleNumber = part number, minimum top-up as an `LTM` line.

**Customer-copy revision (Erik's 10 points, 2026-09-03 PM, plan-mode agreed):** minimum **$100** ("one hour of bench
time"; was $90 → $100 same day when Erik noticed $25/¼h = $100/h, so the BENCH RATE IS NOW $100/h for easy math;
bench = sewing/finishing/hand work, machine = heads/heat press/laser/DTG at $150/h; per-piece prices unchanged — they
are paid numbers ~8% under the $100 book and ~30% over cost); ONE sample price **$50**; supplies we provide priced like garments **cost ÷ 0.53** (`SHOP-MATERIAL-DENOM`;
markup row retired — Erik: we work on MARGIN, 30% markup was only 23% margin); removed from the menu: Name/Number
(DTG/transfers), Re-run, Patch-during-run (SECC/SEG cover it), Laser Patch; 3D puff = a footnote "add $5 per piece
to any embroidery price", not a line; customer print = shop courses + Setup & Art only (Screen Print & Other is
rep-only); two print buttons ("Print customer menu" forces the customer view). Bench $90/h ≠ the minimum: the rate
only shows as $25/¼h. 🔴 Erik printed the REP view by mistake the first time — hence the dedicated button.

**DTF course (2026-09-03):** new Menu course "DTF (Direct-to-Film)" — press-only $8.50 moved there from Finishing; `SHOP-NAME-NUMBER` re-activated as "Names and numbers in DTF, transfers included" **$15 each, 10 minimum** (Supacolor LA vendor minimum; course note says so). Print: `@page{margin:0}` + sheet padding removes the browser URL/date header-footer; tighter print sizes so the customer copy fits ONE letter page (rep copy may run two).

**SHOP MENU (2026-09-03, Erik's "restaurant menu" idea):** `/calculators/service-price-cheat-sheet.html` rebuilt
as the NWCA Shop Menu — Bodoni Moda masthead "Shop Menu · Est. 1977", House Rules, courses (Sewing Bench /
Embroidery Heads / Finishing / Laser Bar / Setup & Art / Screen Print & Other), dot leaders. **Two views,
one page**: Rep (ShopWorks code + book time under each item) / Customer (prices only), localStorage-remembered;
Print / Save PDF = the current view on one letter page. The separate customer card
`/pages/shop-services-pricing.*` was DELETED (one-page rule); the calculator links to the Menu. Fee courses
fall back to documented prices ONLY when Caspio is down and are badged; shop courses show nothing.
Stopwatch the no-history items (labels, hems, re-runs, backpacks) before printing the card widely.
- Pull recipe: bandit by IP `192.168.10.219` (hostname does not resolve over VPN); LinesOE has
  `date_Creation`, `PartDescription`, `id_ProductClass`, `cn_LineQuantity_ToPrice`, `cnCur_UnitPriceUsed`,
  `cnCur_LinePrice_Act`. Keyword LIKE on PartDescription; drop class 1/'' rows whose PartNumber looks
  like a SKU (Sport-Tek "PosiCharge" matches "charge"; Richardson "…Patch" caps match "patch").

## Method / gotchas
- Allocation: emb revenue share (4050+4150+4303)/total = 51.9%; burden 105,784/1,007,547 = 10.5%.
- Hours model: setup 87 min (caps 75) + (2.4 handling [2.7 caps] + 0.25 min/1K) per pc; worst ×1.5
  on setup+handling, 0.5 min/1K garments (4-head). From `orders.csv` types 21/1/22/42 + small types.
- Custom decoration $/h not computed — invoiced garment vs embroidery lines are not separable in
  the Orders export (would need LinesOE by id_ProductClass).
