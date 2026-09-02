# Customer Portal — 2026-09-01 redesign + reward-dollar accrual program

Erik's ask (2026-09-01): "improve the customer dashboard and modernize it … make sure we have all
their logos, invoices, and anything you can think of to make it a self-serving portal", plus
"calculate the reward dollars based on the items they bought within 12 months — items with more
margin (SanMar cost ≥ $40) get more bonus bucks — only items invoiced AND paid."

Files: `pages/customer-portal.html` · `pages/js/customer-portal.js` · `pages/css/customer-portal.css`
(shared with `customer-product.html`) · server.js "CUSTOMER PORTAL" TOC block · admin console
`dashboards/customer-portal-admin.*` (Reward Dollars modal) · `tests/unit/portal-reward-accrual.test.js`.

## What the portal is now (self-service map)

| View | What the customer can do without calling |
|---|---|
| **Overview** | See what needs them (proofs awaiting approval → *Review & approve*; past-due / due-soon invoices; quotes expiring ≤7 d), KPI tiles (open balance, in production, logos, products), recent orders → drawer, logo strip, rewards card, quick actions |
| **Your products** | Search/sort past styles, re-order via the method-aware product page (unchanged) |
| **Orders** | Filter (in production / shipped / invoiced) + search; **drawer** per order: stitched timeline (Ordered → In production → Shipped/pickup → Invoiced), line items, carrier tracking (`/api/portal/order/:no/tracking`, ManageOrders `/tracking/:no`, link built client-side from carrier), invoice/PDF, re-order |
| **Invoices** | Summary strip (open / past due / paid last 12 mo), filters, per-row PDF, **printable statement** with aging buckets (Current · 1-30 · 31-60 · 61-90 · 90+) |
| **Logos & proofs** | Approved logos / proofs & mockups / finished photos, search, lightbox with **Download**, **Review & approve** (deep link `/mockup/:id?view=customer&cid=` or `/art-request/:id?view=customer&cid=`), *Order with this logo*, *Request a change* |
| **Quotes** | Quote sessions for the **sign-in email only** (exact `CustomerEmail` match — never company-wide), customer-safe status ladder (Shipped › Ordered › Cancelled › Expired › Open), tracking link, `/quote/:id` view |
| **Account & help** | Company / customer # / sign-in email / rep, *Update your details* request, FAQ, contact |
| **Everywhere** | Account-wide search (orders, products, logos, quotes), *Request a quote* / *Send a new logo* → `POST /api/portal/request` (types quote · logo · logo-change · account) → the SAME rep queue (`Portal_Reorder_Requests`, Style = QUOTE/NEWLOGO/LOGOCHG/ACCOUNT, Product_Title starts with a readable label) |

Design language: parchment canvas + forest-green sidebar "spine" with a gold running-stitch and a
knot beside the active item; Fraunces (display) + Instrument Sans (UI) from Google Fonts (precedent:
3-day-tees). Every panel uses the `hidden` attribute (`[hidden]{display:none!important}`); every
loader paints its own view and re-composes the Overview; every failed load is a visible error +
Retry (Erik's #1 rule) — never a reassuring empty state or a false $0.

Staff preview (`/portal-admin/preview/:id`) mirrors everything read-only; the new reads got
mirrors too (`/me` resolves the invite email from `Customer_Portal_Access`, `/quotes` unions all
invited emails for that customer, `/order/:no/tracking`). Every write is a toast in preview.

`portalLimiter` raised 60 → 120 per 15 min: the home now fires 7 reads per load (was 5) plus
per-drawer reads; 60 tripped inside ~8 page views.

## Reward-dollar ACCRUAL program (how it works)

**Rule.** Earned $ = Σ over **garment lines** of orders that are **invoiced AND paid** with the
invoice date inside the window (default **12 months**) of `line revenue × rate for the garment's
SanMar piece-cost band`. Decoration / fee / setup lines never earn (`portalNormalizePart` drops
them). Cost = the **lowest `PIECE_PRICE`** across the ordered color's `/api/product-details` rows
(base-size cost = what the garment "is"; extended sizes cost more but don't change the band).
"Paid" = ManageOrders `sts_Paid = "1"`, or a **known** `cur_Balance` of 0 on a non-zero invoice
(unknown balance ≠ paid; `cur_TotalInvoice = 0` never earns — ShopWorks marks those `sts_Paid = "8"`).

**Config = Caspio → `Service_Codes` (Erik edits, no deploy)** — read via `GET /api/service-codes?type=REWARD`:

| Field | Value |
|---|---|
| ServiceType | `REWARD` |
| ServiceCode | `RWD-EARN` (one row PER band) |
| PricingMethod | `TIERED` |
| TierLabel | the SanMar piece-cost band: `0-39.99`, `40+` (also accepts `$40 +`, `< 40`) |
| SellPrice | the % back for that band (e.g. `1`, `3`) |
| IsActive / Visible | `Yes` / `No` (Visible=No keeps it out of the quote-builder rails) |
| optional | ServiceCode `RWD-WINDOW`, UnitCost = months (default 12) |

🔴 **No rows → nothing earns.** The console says "not configured"; there is deliberately NO default
rate because this mints redeemable credit — a silent fallback would hand out money.

**Flow (staff-in-the-loop, idempotent).** Admin console → customer → Reward Dollars → *Calculate
earned rewards* (`GET /api/portal-admin/rewards/accrual/:id`, nothing written) → per-order
breakdown with expandable lines (style · color · qty · unit price · cost · band · reward) →
*Post $X as N grants* (`POST …/accrual/:id/post`) recomputes SERVER-SIDE and writes ONE ledger
grant per order with `Order_Ref = order #`, `Created_By = staff email`. Re-running only posts the
delta (`pending = reward − already granted for that Order_Ref`), so it can never double-grant.
The customer sees only **posted** credit: balance, `earnedInWindow` (posted grants dated inside the
window) and the program's RATES (`baseRatePct` / `premiumRatePct`) — never the cost thresholds.

**Verified 2026-09-01 (local, live data, injected 1% / 3% bands; nothing written):** Aaberg's
Rentals (#1276) → 2 eligible paid orders in the window, eligible garments $2,446 → **$58.08**
(PC54 $4 cost → 1%; Carhartt CT100617 $53.44 / TravisMathew / OGIO $34.19 → 3% / 1%). With no
REWARD rows the same call returns configured:false and $0 with every line noted "no band covers
this cost". Harness: `scratchpad/accrual-harness.js` pattern (extract the block from server.js,
inject `loadRewardProgram`) — the unit test `portal-reward-accrual.test.js` locks the rules.

**Scope + pacing (added later on 2026-09-01, `9e915f50` + `1983b7e3`):**
- 🔴 **Web-store orders are EXCLUDED by default** (ShopWorks ORDER_TYPE Inksoft / Shopify / web store,
  classified via one `ORDER_ODBC` Caspio query; a failed lookup REFUSES rather than including them).
  Measured: Absher (GOLD) had 622 Inksoft orders in the window — automatic employee purchases, not
  company reorders. Service_Codes row `RWD-WEBSTORE` SellPrice=1 turns them on.
- 🔴 **The proxy's ManageOrders limiter is ONE 30-requests/minute bucket per IP** (the whole dyno).
  Line items are fetched one at a time ~2.2 s apart, memoised 24 h, at most 9 uncached per request
  (Heroku H12 = 30 s); the response says `partial:true` + `progress` and the console keeps calling.
  Posting refuses a partial calculation. ⚠️ `buildMyProducts` still fires 25 line-item calls in
  parallel — same latent 429 risk, not touched here.
- **Redemptions = a ShopWorks LINE ITEM, like a gift certificate** (Erik's call): part `RWD-REDEEM`
  (or the part(s) named in a Service_Codes `RWD-REDEEM` row's TierLabel, comma-separated — so the
  existing gift-certificate part can be reused), qty 1, NEGATIVE unit price. The engine finds it on
  the paid order and posts a `redeem` ledger entry keyed by Order_Ref (idempotent); reps can also log
  it at order entry from the console (order # now required on a redemption). Grants post before
  redemptions in one run so nothing overdraws.
- **Q4 / promo boost**: Service_Codes `RWD-BOOST`, TierLabel `2026-10-01..2026-12-31`, SellPrice =
  multiplier — applies to orders INVOICED in the window; overlapping windows take the max.

**Not built (deliberate):** automatic nightly posting. Erik's existing design keeps every ledger
write staff-initiated; a cron would need a per-customer serialisation lock (the proxy's own
TOCTOU note) and a quota review (one accrual ≈ 1 MO orders call + N line-item calls + 1 Caspio
call per distinct style, memoised 30 min). Add it only after a few manual months prove the bands.

## THE RATES — sized from a live audit, written to Caspio 2026-09-01 (Erik: "go for it")

Audit = every paid, invoiced, rep-handled garment line in the last 12 months for the 25 GOLD +
17 SILVER portal accounts (web-store orders excluded; 37 had eligible orders): **$428,721 garment
revenue · 14,404 pcs · blank cost $183,456 · gross 57% before decoration (~42% after ~$4.50/pc)**.
Gross margin PERCENT falls with cost (tees 68% → $60+ 40%) but gross DOLLARS per piece climb
$13.57 → $55.18 for the same decoration time — that is the case for rates that rise with cost.

| SanMar piece cost | share of rev | GM% | gross/pc | **rate** | reward as % of gross |
|---|---|---|---|---|---|
| $0–9.99 | 42% | 68% | $13.57 | **1%** | 1.5% |
| $10–19.99 | 24% | 55% | $17.34 | **2%** | 3.6% |
| $20–39.99 | 14% | 48% | $23.8 | **3%** | 6.2% |
| $40+ | 19% | 42% | $45 | **5%** | 12% |

**Program cost = 2.31% of garment revenue = 4.0% of gross = 5.5% of net contribution ≈ $267 per
account per year (~$9.9k/yr across the 37).** Break-even: a redeemed dollar rides on a next order
at ~42% net, so the program pays if it lifts spend by ~5.5%. Alternatives modelled: flat 2% =
2.0%/rev; Erik's 2-band 1/3 = 1.38%; lean 1/1.5/2/3 = 1.65%; rich 2/3/4/6 = 3.31%.
**Q4 2026 boost ×1.5 (orders invoiced 2026-10-01..12-31)** → rates 1.5/3/4.5/7.5 in Q4, adds
~$1.5k if Q4 is ~30% of the year. Rows: `RWD-EARN` ×4, `RWD-BOOST`, `RWD-REDEEM` (TierLabel
`RWD-REDEEM` — add the gift-certificate part code there to reuse it). Window default 12.
🔑 The app caches the program 5 min (`_rewardProgramCache`) — a row edit shows within 5 min.
🔑 Service_Codes `Notes` is Text-255: longer notes 400 with "doesn't match the data type".
**First real grants posted 2026-09-01: Aaberg's Rentals #1276, $97.00 (orders 140567 $5 + 140568 $92).**

**Q4 launch plan:** staff post the 12-month catch-up for each GOLD/SILVER account from the console
(Calculate → Post; ~$9.9k of credit across 37 accounts) so every good customer enters Q4 with a
balance; reps mention it on every touch; redemptions go on the order as the `RWD-REDEEM` line.

## "2026 Rewards" — the program year (Erik's rulings 2026-09-02, LIVE v2026.09.02.1 / Heroku v1900)

1. **Earning window = a date range, not rolling months.** `RWD-WINDOW` TierLabel `2026-01-01..2026-08-31`
   (invoices paid in it). Next year set it to `2026-09-01..2027-08-31` → "2027 Rewards".
2. **Spend window / expiry.** `RWD-SPEND` TierLabel `2026-10-01..2026-12-31`. The portal refuses a
   redemption outside it and shows "use by Dec 31, 2026"; after it, the console shows **Expire unused**
   (POST `/api/portal-admin/rewards/expire/:id` → one `adjust` −balance, refuses before the date).
3. **Full balance only.** One redemption = the whole balance (server rejects anything else); the portal
   redeem modal is a single button "Apply my full $X to my next order". One credit line per customer.
4. **Q4 boost pays into NEXT year.** `RWD-BOOST` (×1.5, Oct 1–Dec 31 2026) stays; those orders fall in
   the 2027 earning window, so customers spend 2026 dollars in Q4 AND stack boosted 2027 dollars.
5. **Redemption line = gift-certificate style.** Part `RWD-REDEEM` (or the gift-cert part named in the
   `RWD-REDEEM` row's TierLabel), qty 1, negative price. No per-customer code — the order # is the key.
   ⏭️ Erik still has to name the ShopWorks part (create `RWD-REDEEM` in OnSite or put the existing
   gift-certificate part code in that TierLabel).

**Service_Codes REWARD rows now (8):** `RWD-EARN` ×4 (0-9.99→1, 10-19.99→2, 20-39.99→3, 40+→5) ·
`RWD-BOOST` · `RWD-REDEEM` · `RWD-WINDOW` · `RWD-SPEND`. All Visible=No.

## Line-items table (Erik's ruling 5 — in progress)
Goal: the engine reads a Caspio table instead of ManageOrders (30/min limiter, H12). Export script
`scratchpad/export-order-lines-2026.js` → `Downloads/Order_Lines_2026.csv` (headers from ORDER_ODBC,
lines from MO paced 2.3 s/order, SanMar piece cost + line gross per line; 3,215 orders ≈ 2 h;
resumable via `order-lines-2026.progress.json`). Table `ORDER_LINES_2026`, upsert key `Line_Key` =
`ID_Order-SortOrder`. `sts_Paid`/`cur_Balance` are left blank on purpose — paid status stays LIVE
from MO (one orders call per customer).

**🔑 Erik's steer 2026-09-02: the mirror ALREADY EXISTS — `ManageOrders_LineItems` (+ `ManageOrders_Orders`),
the Caspio archive the rep bonuses use, kept current by proxy `scripts/sync-manageorders.js` (Heroku
Scheduler daily 12:00 UTC: last 60 days of orders, line items for new/changed orders, history preserved
— 141 Caspio calls/day after the 2026-07 fix).** No new table, no CSV import. Columns: `id_Order,
PartNumber, PartDescription, PartColor, LineQuantity, LineUnitPrice, SortOrder, Size01..06` — NO customer
column, so it is read by order id.

**Built (proxy `8db7651`, app `91b80fd5`):** proxy `GET /api/order-lines?orders=140567,…` (≤200 ids,
chunked `IN` clauses; env `ORDER_LINES_TABLE` overrides) + `GET /api/order-lines/coverage?id_Customer=
[&from&to]` (orders in `ManageOrders_Orders` for the window vs. which have archived lines → `missingOrders`).
App engine: `portalMirroredLineItems(orderIds)` seeds the line cache from the archive (10-min memo per order)
BEFORE the paced MO crawl; MO is hit only for orders the archive lacks (the newest, until the next daily
sync); paid status stays LIVE from MO. Console shows "lines from Caspio mirror N, ManageOrders M".
Unavailable archive/route = the old MO path, never a throw.
✅ **LIVE 2026-09-02: proxy v2026.09.02.1 (`4937e66`), app v2026.09.02.2 (Heroku v1901, `7f928e2`).**
Coverage measured live over 2026-01-01..08-31: 10181 19/20 orders with lines · 11392 7/11 · 13542
16/20 · 4461 8/9 · 9886 25/27 · 7273 5/5 · 1276 2/2 — the archive spans Jan–Aug, but a few orders per
account have NO lines (sync gaps, e.g. 139158, 140069, 140317); the engine crawls MO just for those.
⏭️ Optional backfill of those gaps from `Order_Lines_2026.csv` (export still running at write time; lands
in Downloads) via a `heroku run` script that POSTs only the missing orders' lines — the table has no
unique key, so never bulk-import the whole CSV. Root-cause follow-up: why `sync-manageorders` leaves
some orders without lines (line fetch failed + never retried?). Earlier plan text kept below for context:
if `missingOrders` is non-empty (sync began mid-year?), the
`Order_Lines_2026.csv` export (still produced by `scratchpad/export-order-lines-2026.js`) can backfill
`ManageOrders_LineItems` via Caspio import (columns id_Order, PartNumber, PartDescription, PartColor,
LineQuantity, LineUnitPrice, SortOrder, Size01..06 — drop the extras; no unique key on that table, so
import ONLY the missing orders' rows to avoid duplicates). Optional later: add a `SanMar_PieceCost`
column to the archive and have sync-manageorders fill it (the engine already prefers it when present).

## ManageOrders_LineItems — extended columns + unique key (Erik's ask 2026-09-02, in flight)

Erik's export of the table (`Downloads/ManageOrders_LineItems_2026-Sep-02_0509.csv`): **8,942 lines,
2,455 orders, id_Order 139304→143041 (≈Feb 2026 onward — January 2026 is not in the archive at all),
no PK_ID column, 0 duplicate id_Order+SortOrder keys.**

**Six new columns** (add in Caspio table design BEFORE the import): `Line_Key` Text(40) ·
`id_Customer` Integer · `id_OrderType` Integer · `Style` Text(255) · `Is_Garment` **INTEGER 1/0** (Erik built it as Integer, not Yes/No — the sync writes 1/0, proxy v2026.09.02.5; a boolean or "Yes" 400s) ·
`SanMar_PieceCost` Number. Skipped on purpose: date_Invoiced on lines (drifts), LineTotal/Line_Gross
(Caspio formula fields if wanted).

**Sequence (order matters):**
1. Proxy `fd66d0a` (LIVE v2026.09.02.2): `sync-manageorders.js` writes the six columns on every new
   line **only when Heroku config `LINEITEMS_EXTENDED=1`** (a POST naming a missing column is a 400),
   and REPAIRS archived orders that have zero lines (≤25/run) — the cause of the per-account gaps.
2. `scratchpad/enrich-lineitems.js` → `Downloads/ManageOrders_LineItems_ENRICHED.csv` = Erik's rows +
   `Order_Lines_2026.csv` rows for orders the table lacks entirely (January + gaps) + the six columns
   (customer/type from ORDER_ODBC by ID_Order, cost from the export or one product-details lookup per
   style). Run AFTER the export finishes (it is ordered by invoice date; needs all of Jan–Aug).
3. Erik: add the six columns → EMPTY the table → import the enriched CSV as **Add** (outside the
   5:00 AM PT sync and label-station hours; readers see an empty table for a few minutes) → set
   `Line_Key` UNIQUE.
4. ✅ DONE 2026-09-02 05:24 PT — Erik added the six columns (screenshot-verified) and
   `LINEITEMS_EXTENDED=1` is set on caspio-pricing-proxy (via the Platform API with the deploy token;
   the CLI session had expired). Next daily run (5:00 AM PT) carries the columns; the reward engine
   already prefers `SanMar_PieceCost` when present. `Line_Key` UNIQUE = flip AFTER the re-import
   (existing rows have blank keys until then).
Other readers of the table (sanmar-orders label index, industry-lookalikes, check-zero-billing) use the
original columns only — unaffected. The sync's delete-then-insert per order never collides with the key.

**✅ Enriched CSV built 2026-09-02 08:02** → `Downloads\ManageOrders_LineItems_ENRICHED.csv`: **11,882 rows**
(8,942 from Erik's 05:09 table export + 2,940 lines from 1,016 invoiced-2026 orders the table lacked),
`Line_Key` unique 11,882 / 0 duplicates / 0 empty · 9,087 garment lines, 8,955 with `SanMar_PieceCost`
(419 styles looked up) · 55 rows with no ORDER_ODBC header (id_Customer/id_OrderType blank — the sync
fills them when those orders are next touched). `Is_Garment` is 1/0 in the CSV (Caspio import maps it);
the column is INTEGER, so the sync writes 1/0 (proxy v2026.09.02.5). ✅ Erik imported it and flipped `Line_Key` Unique 2026-09-02 ~08:30. `/api/order-lines` returns the six columns since proxy v2026.09.02.6 (its q.select had to stay at the 13 old columns until they existed — a q.select naming a missing column 400s); live-verified on 142999: Style PC54, Is_Garment 1, SanMar_PieceCost 4.

## Re-invoiced orders (Erik's rulings 2026-09-02, LIVE app v2026.09.02.3/.4 · proxy v2026.09.02.3)

**Ruling: never claw back automatically.** A grant already posted stays when an order is later
re-invoiced LOWER (price tweak) — but a $4,000 order the customer rejects 30 days after invoicing
and we zero out must not leave $200 of reward behind. So it is a STAFF decision, never the engine's:

| Layer | What happens on a reopen / re-invoice |
|---|---|
| **Archive within 60 days of order date** | `sync-manageorders` Step 3 sees a CHANGE_FIELD (`cur_SubTotal`, `date_Invoiced`, `sts_Paid`…) and rewrites the lines. Always did. |
| **Archive, older order** | NEW Step 4: `ORDER_ODBC` (bandit delta by `timestamp_Modification` every 15 min, any age) vs archive — subtotal off by > $0.50 or invoice date moved → header re-pulled from MO with `refresh=true`, lines rewritten. 13-month lookback, max 25/run. |
| **Engine (reward math)** | Staleness guard: archived lines whose Σ(qty×price) disagrees with the LIVE `cur_SubTotal` by > $0.50 are refused and that order is fetched fresh (`source.staleMirror`). Paid status is always live. |
| **Grant went UP** | Calculate shows the difference as pending; Post adds it (idempotent by Order_Ref). |
| **Grant went DOWN / order zeroed** | Order shows `overGranted` = granted − now-earned (never a negative pending). Console: "over by $X" + **Reverse** button → `POST /api/portal-admin/rewards/accrual/:id/reverse {orderNumber}` posts ONE `adjust` entry of −min(over-grant, unspent balance), Order_Ref = the order. Dollars already redeemed stay redeemed (the proxy's overdraw guard also refuses below zero). |
| **Ledger netting** | `adjust` entries carrying an order ref net against that order's grants ("granted" = net); only `redeem` entries count as spent on an order. |

Not built: automatic reversal on a zeroed order. If Erik wants it, the rule would be "reverse
automatically when reward drops to $0 (order credited), flag when it merely drops" — one
condition in the reverse route + a nightly caller.

## Open items / next
- ✅ **LIVE v2026.09.01.6** (Heroku v1899, SHA 9f2ce98 verified; new routes answer 401 + `no-store`
  anonymously; `/portal` still 302s to login). Rows written; Aaberg's $97 posted and visible.
- ⏭️ Erik: create the **`RWD-REDEEM` part in OnSite** (or put the existing gift-certificate part code
  in the Service_Codes `RWD-REDEEM` row's TierLabel) so reps can add the redemption line.
- ⏭️ Staff: post the 12-month catch-up per GOLD/SILVER account from the console (Calculate → Post;
  ~$9.9k of credit across 37 accounts) so every good customer enters Q4 with a balance.
- ⏭️ Watch the first real redemption: rep adds the negative line at order entry + logs it with the
  order # (or the engine reconciles it once the order is paid). Balance must drop exactly once.
- 🔴 Not exercised live: the Reverse button (no over-granted order exists yet) and sync Step 4 (first run = 5:00 AM PT 2026-09-03 — read the Heroku Scheduler log line "Step 4: reopened older orders — N mismatch(es)"; a large N on day one means the archive had drifted, not that ShopWorks reopened N orders).
- 🔴 Not exercised live: the redemption reconcile path (no order carries an RWD-REDEEM line yet) —
  unit-locked, same proxy entry route the console already uses.
- ⏭️ First real customer through the new portal: watch the general-request rows (Style QUOTE /
  NEWLOGO / LOGOCHG / ACCOUNT) land in the rep queue with a readable Product_Title.
- The `Source` column of those rows says `reorder` (the proxy only knows reorder|recommendation).
  A proxy tweak could add `portal-request`; the Style column already distinguishes them.
- `/api/portal/quotes` is email-scoped by design; a contact who quotes under a second address
  sees nothing — the empty state names the sign-in email so this is self-explaining.
