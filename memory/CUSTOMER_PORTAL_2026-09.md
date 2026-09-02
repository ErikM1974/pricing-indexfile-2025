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

## Open items / next
- ⏭️ Erik: add the `RWD-EARN` rows in Service_Codes (and decide the rates) — the mechanism is live
  the moment they exist. Then post the first grants from the console and check the customer sees
  "Earned in the last 12 months: $X" on their rewards card.
- ⏭️ First real customer through the new portal: watch the general-request rows (Style QUOTE /
  NEWLOGO / LOGOCHG / ACCOUNT) land in the rep queue with a readable Product_Title.
- The `Source` column of those rows says `reorder` (the proxy only knows reorder|recommendation).
  A proxy tweak could add `portal-request`; the Style column already distinguishes them.
- `/api/portal/quotes` is email-scoped by design; a contact who quotes under a second address
  sees nothing — the empty state names the sign-in email so this is self-explaining.
