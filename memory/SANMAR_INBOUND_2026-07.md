# SanMar Inbound — PO→WO matching, truthful arrival, received dates (2026-07-15)

Durable detail for the SanMar Inbound dashboard (`/dashboards/quote-management.html?open=inbound-today`,
frontend `dashboards/js/sanmar-inbound-today.js`, backend `caspio-pricing-proxy/src/routes/sanmar-orders.js`).
One-line pointer lives in the auto-index MEMORY.md "Other Systems".

## 1. PO → Work-Order linking = the Caspio `PurchaseOrders` table (the authoritative source)

A PO shows **"unmatched / no WO / Other"** when its `SanMar_Orders` row has a blank `id_Order` — the dashboard
joins company/rep/decoration-method by `id_Order`.

- **THE fix (proxy v913–v915):** `runPurchaseOrderMatch()` links `id_Order` **directly** from Caspio
  **`PurchaseOrders`** (`ID_PO` → `id_Order`), populated at PO-ISSUE time so it's fresh days before the blanks
  arrive. This is the AUTHORITATIVE match and runs FIRST in both matchers (`runQuickMatch` inline in `/sync`,
  `runManageOrdersMatch` via the nightly `/match-manageorders`).
- **Match on `ID_PO` ALONE — no `id_Vendor` filter (v914).** SanMar arrives under MULTIPLE vendor accounts:
  `1002 "SANMAR"` AND e.g. `2425 "6920-0001-Marketing (Sanmar)"`. A `vendor=1002` filter wrongly dropped the
  marketing/promo POs (PO 113539 → WO 142272 was under vendor 2425). `ID_PO` is globally unique (one PO → one WO),
  so vendor is redundant and harmful. `PurchaseOrders` is the SAME table `check-transfers-received.js` /
  `supacolor-jobs.js` already join — the matcher just never used it.
- **The OLD way (now only a FALLBACK):** ≥50% **style-overlap** guess (`minScore = ceil(styleCount/2)`) against the
  LAGGING `ManageOrders_LineItems` Caspio mirror; PO number was only a tiebreaker (`WO ≈ PO + offset`). Fresh WOs
  weren't in that mirror yet → "unmatched." Style overlap now runs only for POs absent from `PurchaseOrders`, and
  NEVER overrides an existing/just-written `id_Order`.
- **Endpoints:** `POST /api/sanmar-orders/po-match` (secret-gated) backfills/relinks. `inbound-today` also has an
  instant `PurchaseOrders` fallback so the dashboard resolves the WO even before the matcher writes it back.
- **Un-auto-matchable:** non-numeric POs (e.g. `LEGEND0611`, an invoice-catchup promo order, blank `ShopWorks_PO`)
  and POs genuinely absent from `PurchaseOrders` — these stay manual.

## 2. Arrival DAY = UPS's real delivery date, not the transit estimate (proxy v915 / pricing v2026.07.15.2)

Staff complaint: the "arriving" day was often wrong. The day view bucketed each PO purely on a ship-date +
hardcoded per-warehouse transit ESTIMATE (`TRANSIT_DAYS_BY_STATE`); UPS's real date was fetched but only shown as
a chip, never moved the PO to the right day.

- **Fix:** `inbound-today` gathers a **±3-day candidate band** (estimate within 3 days of target), fetches UPS's
  real date per PO (`trackOne`, pooled+cached), then keeps only POs whose **EFFECTIVE arrival** (UPS date when
  known, else estimate) == the target day. Adds `arrivalSource` = `ups | estimate` + `estArrival`.
- **Frontend:** `upsChip()` shows the confirmed UPS chip, OR a muted **"~ est. <date>"** (`.sit-ups--est`) when UPS
  hasn't scanned the boxes yet — so staff can tell confirmed from guess.
- Scope: **day view only.** The month **calendar** (`daily-inbound`) is still estimate-only (making it truthful
  needs the persisted dates below across a wide window).

## 3. Shipments now store the UPS received date (proxy v916–v917)

The formerly-empty `SanMar_Shipments` fields `Delivery_Status` + `Estimated_Delivery` are now filled from UPS:
- `Delivery_Status` = `Delivered` / `In Transit` / `Rescheduled`; `Estimated_Delivery` = the **actual delivered
  (received) date** once delivered, else UPS's scheduled date. **Per box** (a split PO shows each box's real date).
- **`POST /api/sanmar-orders/sync-delivery-dates`** (async 202, `?since=YYYY-MM-DD` default today-45, `?force=true`)
  + `GET /sync-delivery-dates-status`. Skips already-`Delivered` rows so repeat runs are cheap. Backfilled 473 rows
  (465 delivered) on 2026-07-15. **Wired into the nightly `sync-sanmar.js`** (after `matchManageOrders`).

## 4. Daily Inbound Report — sectioned by sales rep (pricing v2026.07.15.1)

The Print/PDF report groups POs by sales rep (page-break per rep, per-rep subtotal); unmatched POs collect in an
"Unassigned / Unmatched" section that prints last. `buildPrintSheet()` → `groupOrdersByRep()` + `poBlockHtml()` in
`sanmar-inbound-today.js`. On-screen modal unchanged.

## Gotchas / open
- **Latent bug (task spawned):** `/api/sanmar-orders/lookup` reads `.Result` off a value that `makeCaspioRequest`
  GET returns as a BARE ARRAY (`utils/caspio.js`), so `/lookup` ALWAYS returns `items:[]`/`shipments:[]` and style
  search returns 0. Use `inbound-today` (reads the array correctly) to judge whether items exist, not `/lookup`.
- **`/api/ups-tracking/*` HTTP endpoint is gated** by `requireCrmSecretOrBrowserOrigin` — an `x-api-secret` header
  alone fails; call `trackOne` server-side instead. **UPS creds are Heroku config vars** (`UPS_CLIENT_ID/SECRET`),
  absent from local `.env` → a locally-run proxy always falls back to the estimate.
- Daily sync populates `SanMar_Orders` with `Matched_By:'sync'` and BLANK `id_Order` — the matchers/`/po-match`
  fill `id_Order` afterward. `calculateDynamicOffset()` (WO≈PO+~28856) now only feeds the style-overlap fallback.
