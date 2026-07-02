# Customer Portal — Phase 4: Personalized Catalog + Re-order

**Status:** ✅ **4a + 4b COMPLETE + VERIFIED LIVE 2026-06-30** (FE v2026.06.30.4 + proxy v2026.06.30.2). End-to-end verified in Erik's browser (Lincoln 13616 preview → 3 products + 6 recs; request → queue → status New→Quoted persisted → delete). Sits on the LIVE authenticated portal + admin console (→ CASPIO_PORTAL_DESIGN.md).

**What shipped:** `GET /api/portal/my-products` (order history → distinct base-style+color via `PartNumber.split('_')[0]`, image via `/api/product-details` COLOR_NAME match; verified Lincoln → ST254/PC54/TST254) · `GET /api/portal/recommendations` (from `Portal_Recommendations`, **6 rows seeded** via `scripts/seed-portal-recommendations.js`) · `POST /api/portal/reorder-request` (rate-limited, session-scoped, NO price) → proxy `src/routes/portal-reorder.js` writes `Portal_Reorder_Requests` (rep from `Sales_Reps_2026`, `RR-YYYYMMDD-HHMMSS`, Status=New) + best-effort Slack. Portal UI = "Your Products" + "Recommended for You" grids + request modal (`customer-portal.{html,js,css}`).
**✅ Follow-ups DONE:** catalog now shows **in staff preview** too (mirror endpoints `/api/portal-admin/preview/:id/my-products` + `/recommendations`, reuse `buildMyProducts`/`buildRecommendations`; preview request = view-only) — THIS was the "I don't see the catalog" bug (preview skipped it). **Rep work-queue = a "Re-order Requests" tab IN the console** (`customer-portal-admin`, not a DataPage): list/status-dropdown(PUT)/delete/filter/My-requests + New-count badge, via `/api/crm-proxy/portal-reorder/requests`.
**Remaining (optional):** ① per-rep email + a real Slack webhook (`SLACK_PORTAL_REQUESTS_WEBHOOK_URL` — today = saved row in the queue + New badge; best-effort Slack if webhook set). ② "Build quote" deep-link prefill from a request → the EMB/DTG/etc. builder. ③ customer "Your requests" status list in `/portal`. ④ Erik curates `Portal_Recommendations` (6 starter rows in place).

**Phase 5 = reward dollars — NOT started; needs Erik's business input first** (earn rules: $/product/threshold + accounting sign-off — it's a real liability). Head start: gift-cert ledger `Inksoft_Gift_Certificates` (→ CASPIO_PORTAL_DESIGN.md roadmap).

Original plan below (grounded in a 35-tool Explore of the catalog/cart/pricing/rewards code).

## Locked decisions (Erik, 2026-06-30)
1. **Re-order action = Request → routes to the customer's rep.** Customer picks item + qty; it lands with their sales rep as a request the rep finishes into a real quote/order. **No customer-facing price, no payment.** (Self-serve price+checkout = a later Phase 4b; deliberately out of scope.)
2. **v1 catalog = Your Products + curated recommendations.**

Why this is the safe v1: no price reaches the customer → zero exposure to the #1 "wrong-price" rule; no cart/payment to build; fits NWCA's rep-relationship B2B model; the rep prices it through the live engine when they build the quote.

## What the customer sees (two new sections in /portal)
1. **Your Products** — one card per distinct style+color the customer has ordered: SanMar product image, name, color, the design they ran (Design #), last-ordered date + last qty, and a **"Request re-order"** button.
2. **Recommended for you** — a curated strip ("new this season" / top sellers / same-category picks), each with a **"Request this"** button.

Clicking either → a small **request modal**: quantity (pre-filled from the last order for re-orders; size breakdown), an optional note ("same as last time" or changes), Submit → toast "Sent to [rep] — they'll follow up with a quote." Optional: a small "Your requests" list showing status.

## Backend
1. **`GET /api/portal/my-products`** (FE, `requireCustomer`) — aggregate the session customer's orders (reuse the existing orders fetch) → pull line items → dedupe by (style, color) → keep latest design + last-ordered date + last qty + times-ordered → enrich each with `/api/product-details` (image/title/colors). Customer-safe projection only.
   - **MAIN TECHNICAL WORK = normalization:** ShopWorks `PartNumber` may be a base style OR a size-suffixed SKU (PC54_2X → base PC54); `PartColor` may be the catalog code or the display name. Resolve both to the SanMar style+color for the image lookup; **graceful fallback** (description + placeholder, never block) when a legacy line won't resolve.
2. **`GET /api/portal/recommendations`** (FE, `requireCustomer`) — curated list from a new **Erik-editable Caspio table `Portal_Recommendations`** (Featured_Style, Color, Blurb, Active, Sort), fallback to the existing top-sellers list. Optionally filter to the customer's categories.
3. **`POST /api/portal/reorder-request`** (FE, `requireCustomer`, **rate-limited**) — the portal's FIRST customer write. Server-validates (style/qty sane; **scoped to the session id_Customer — can't request for another company**). Writes a `Portal_Reorder_Requests` row + fires the rep notification. Returns `{ok, requestId}`. Carries NO price.
4. **`GET /api/portal/my-requests`** (optional) — the customer's own recent requests + status.

## New Caspio tables (Erik-managed, no deploy)
- **`Portal_Recommendations`** — Featured_Style, Color, Blurb, Active (Yes/No), Sort. Erik curates the recs strip.
- **`Portal_Reorder_Requests`** — id_Customer, Company, Email, Style, Color, Design_Number, Design_Name, Qty, Size_Breakdown, Note, Rep, Status (New/In Progress/Quoted/Closed), Created (+ request id). The rep's work queue + audit trail.

## Rep side ("lands with the rep")
- **Notification:** on a new request, email + Slack-DM the customer's rep. Rep = `Sales_Reps_2026.CustomerServiceRep` for that id_Customer (the authoritative owner the admin console already joins); rep email via contacts `Email_Salesrep` / staff directory. Reuse existing EmailJS + `slack-*-notify.js`.
- **Queue:** where the rep sees + works requests. **★ Ideal Caspio DataPage** (staff-only, tabular, read-mostly, filter by rep/status) — exactly the internal-report shape from the DataPages discussion where a DataPage saves real dev time (uses one of the 50 free slots). Alternative: a small dash-page `portal-reorder-requests.html`. The rep then builds the real quote in the existing EMB/DTG/SCP/DTF builder.
  - **4a.1 enhancement:** a "Build quote" deep-link that pre-fills the right quote builder from the request (style/color/qty/design).

## Security (consistent with the portal posture)
- All reads `requireCustomer`, session-scoped — the customer only ever sees/requests for their own id_Customer (never a URL id).
- The request WRITE is gated + rate-limited + server-validated, carries NO price (no #1-rule exposure), and can't target another company. **This also advances open task #7 (gate portal writes).**
- Customer-safe projections on my-products (no costs/margins/internal fields).

## Reuse (almost all of it exists)
| Need | Reuse |
|---|---|
| Product image/name/colors | `/api/product-details` + `/api/color-swatches` (proxy `products.js`, `Sanmar_Bulk_251816_Feb2024`) |
| Customer's bought styles | existing `/api/portal/orders` + invoice line-item projection |
| Rep identity per customer | `Sales_Reps_2026` join (already wired in the admin console) |
| Notifications | existing EmailJS + `slack-*-notify.js` |
| Portal UI cards/sections | existing `customer-portal.css` |
| Net-new | my-products dedupe+normalize · 2 Caspio tables · the request write + notify · the rep queue (DataPage) · 2 portal sections |

## Build sequence
- **4a (core):** my-products endpoint (+normalization) → "Your Products" section → request modal → `reorder-request` write + `Portal_Reorder_Requests` table → rep email+Slack → rep queue (DataPage). *Ship + verify against a real customer's history.*
- **4b (recs):** `Portal_Recommendations` table + endpoint → "Recommended for you" section.
- **4a.1 (later):** "Build quote" deep-link prefill; customer "Your requests" status list.

## Risks / unknowns to resolve at build time
1. **PartNumber/PartColor → SanMar style/color resolution** — the main risk; some legacy line items may not map cleanly. Mitigate: normalize + graceful fallback; verify against a few real customers' histories first.
2. **Rep email source** — confirm authoritative rep-email (Email_Salesrep vs staff directory); handle House/unassigned accounts.
3. **Decoration carry-over** — the request references the prior Design #, so the rep knows the decoration; confirm that's sufficient.
4. **Size-breakdown UX** — 1-click "same sizes" vs. per-size adjust.

## Effort (rough)
- 4a core: ~1–2 focused sessions (normalization + the request/notify loop are the real work; endpoints + UI are assembly).
- 4b recs: ~half a session.
- Rep queue as a DataPage: minimal (Erik builds the DataPage; I wire the table + notification).

## ✅ SHIPPED — catalog-style re-order color picker + per-color order totals (2026-07-01, FE v2026.07.01.17)
Erik's ask: make "Your Products" re-order feel like the main catalog — selectable color swatches, and show HOW MUCH of each color the customer has ordered ("so they know they order a lot of that style"). Chose **pieces** (not $), though $ is also computable (line items carry `LineUnitPrice`; extended = unit×qty, no native line total).
- **Backend** (`buildMyProducts`, server.js ~3488/3533): sums `LineQuantity` → `totalQty` per style+color + `styleTotalQty` per style (over the existing ~3yr / last-25-order window — NOT lifetime). `colors[]` entries carry `totalQty`, sorted most-ordered-first. No new endpoint.
- **Card**: new "You've ordered N" line (`.cp-product-total`); the re-order button carries `data-colors='[{name,qty}]'`.
- **Picker** (`customer-portal.js`): the native color `<select>` (#cp-req-color) is REPLACED by a swatch grid (`#cp-req-colors`) + a HIDDEN `#cp-req-color` input holding the chosen color (so `submitReq` is unchanged). Every available color from `/api/portal/product-colors/:style` renders as a tile; previously-ordered ones get an "N ordered" badge + sort to the FRONT; the most-ordered = "Top color" tag + default-selected; live model preview (`#cp-req-image`) + a "· N ordered before" caption update on click. Functions: `renderColorPicker`/`renderTiles`/`setColorStat` + a delegated `.cp-swatch-btn` click handler.
- **Color-name matching — DATA-DRIVEN via CATALOG_COLOR (v.17, resolves Risk #1; Erik's steer)**: the ShopWorks order `PartColor` **IS the SanMar `CATALOG_COLOR`** (e.g. "Hthrd Charcoal"), NOT the `COLOR_NAME` ("Heathered Charcoal") — the [Two Color-Field System] rule in CLAUDE.md. `buildMyProducts` resolves each ordered color via `portalMatchColor` (server.js:3415 — matches on CATALOG_COLOR → returns COLOR_NAME + swatch), **DISPLAYS the COLOR_NAME**, carries `catalogColor`, and MERGES spellings that map to the same COLOR_NAME (SanMar exposes ≥2 catalog codes per color, e.g. `Hthrd Charcoal` + `HtdChar`) so the piece total isn't split. The picker matches ordered→available on **EITHER COLOR_NAME or CATALOG_COLOR** (exact `normColor`) — no abbreviation heuristic; generalizes to compressed codes (CoyoteBrn/FieryRed). ⚠️ **v.16's `colorKey()` abbreviation heuristic was a WORSE first pass — REPLACED by this.** Verified live 10181 DT6000: 5 ordered colors → proper COLOR_NAMEs, ALL swatches, 0 dupes, 56 tiles.
- **Scope**: portal-only (NOT the 4 quote builders → builder-sync rule N/A); FE + one server function; customer's OWN order data (no cost/margin); no pricing path (re-order = request-to-rep, no price).
- ⏳ **Follow-ups (optional):** (1) clickable card swatches → open the modal on that color; (2) a $ badge (data supports `LineUnitPrice × LineQuantity`). [The former "backend abbrev-match for card swatches" follow-up is DONE — `buildMyProducts` now resolves via CATALOG_COLOR so CARD names + swatches are proper COLOR_NAMEs too.]

## ✅ SHIPPED — Phase A: card top-color image + grid search/sort/show-more (2026-07-01, FE v2026.07.01.18)
Erik "do it in phases." Phase A (quick wins + the bug he screenshotted):
- **Per-color model image**: `portalRowImage` (server.js:3412) now prefers **`FRONT_MODEL`** (per-color, e.g. `DT6000_black_model_front.jpg`) over `PRODUCT_IMAGE` (ONE generic `DT6000.jpg` for every color — that was the "yellow preview" bug). `buildMyProducts` sets the card `image` + modal default `color` to the **TOP-selling color** (`colors[0]`, sorted by totalQty), not the most-recent.
- **Your Products discovery aids** (`customer-portal.{html,js,css}`): search box + sort (Most ordered/Most recent/Most colors) + show-first-12 + "Show all N" (`renderProducts()`, toolbar shows only when >6 products). Search shows all matches; browse paginates.
- ⚠️ NOT live-verified in browser (auth tab closed); deployed + syntax-checked + data path confirmed via public product-details.

## 🎨 Phase B PLAN (mockup approved? — a gated product-detail PAGE, replaces the modal for depth)
New `GET /portal/product/:style` (requireCustomer) + `GET /api/portal/product/:style` + staff-preview mirror — **copy the invoice sub-page pattern** (`customer-invoice.*` / `/portal/invoice/:orderNo` / `projectPortalInvoice`; reuse `portalStyleRows`/`portalColorList`/`portalMatchColor`; PDP inventory grid = `product/components/inventory.js`). Page contents (ALL data confirmed by the 2026-07-01 feasibility workflow):
- Hero = top-color FRONT_MODEL + swatch strip; **color×size MATRIX** of what they ordered (ManageOrders `PartColor`×`Size01-06`); order history (date/#/qty); reorder panel pre-filled from last order + notes (NO price — Rule 9).
- Spec strip (SanMar getProduct: description/weight/fit/sizes). Soft **availability badge** ("In stock/Limited/Ask us") — **NOT raw stock numbers** (SanMar stock, changes constantly, 3000-cap, supplier leak); full warehouse×size grid = STAFF side only. **NO prices** (API has cost/MSRP — never show).
- Cross-sell "Your logo also looks great on" = **design# → other styles this customer decorated** (order-level `id_Design`; multi-design order = rare ambiguity) + SanMar **`COMPANION_STYLES`** (men's↔ladies', already in /api/product-details). SanMar `RelatedProductArray` exists but UNMAPPED (skip).
- Closeout/discontinued warning via `isCloseout`.
- Data APIs: SanMar inventory = proxy `/api/sanmar/inventory/:style` (per-warehouse/color/size, 5-min cache, 3000-cap). Order history granularity FULL. Deeper-than-3yr history possible per-style (API supports; NWCA uses 3yr by choice).
- **Phase C** (enrichments): logo cross-sell + COMPANION_STYLES + availability badge + closeout warning + "your logo on this" proof image. **Phase D**: batch reorder list, product-sheet PDF, reorder-cadence nudge.

### Phase B/C decisions (Erik, 2026-07-01 — design approved, NOT built yet)
- **Order history**: add per-order SIZE breakdown (`Size01-06`) → enables one-click "reorder these exact sizes".
- **Colors**: show ALL available (split "Your colors" w/ totals vs "More colors available").
- **Inventory = TRAFFIC LIGHT per size** (In stock/Low/Out) from `/api/sanmar/inventory/:style` — Erik chose this; **NEVER raw stock numbers to customers** (SanMar stock, changes, 3000-cap, supplier leak). Full warehouse×size grid = STAFF preview only.
- **⭐ Embroidery UPGRADE module (Phase C — the margin play)**: "your logo, embroidered, on a premium tee." Show a **Quick-Quote-style price-breaks MATRIX** (Erik's ask) — tiers × per-pc + "Small-batch fee +$50" row + current-qty highlight. **Engine-authoritative, RULE 9**: render client-side EXACTLY like Quick Quote (`calculators/quick-quote/quick-quote.js` `probeLadder()`+`paintMatrix()` ~900-983 → `window.QuoteCartEngine.singleItemPreview(item,{groups,deps})`, EMB primary logo `stitchCount:8000` Left Chest). Load `quote-cart-engine.js`+`embroidery-quote-pricing.js` on the portal product page (same 3rd-surface pattern). ⚠️ do NOT reuse the hardcoded `/api/embroidery-pricing` (server.js:7378 — an EXISTING Rule-9 violation).
- **Upgrade source = CURATED LADDER, not algorithmic** (30K styles, no discrete quality field → algo = junk). NEW Erik-editable Caspio **`Product_Upgrades`** table: `Category`(anchor=CATEGORY_NAME), `From_Style`(opt), `Tier`(Better/Best), `Upgrade_Style`, `Default_Stitch`(8000), `Default_Location`(Left Chest), `Sell_Anchor`/`GP_Pct`(margin rank), `Blurb`, `Active`, `Sort`. Product page looks up by category, margin-ranked. Edit in Caspio UI now → add "Upgrades" tab to `customer-portal-admin.html` later. SEED from existing curation: `caspio-pricing-proxy/lib/dtg-curated-products.js` already encodes **PC54→PC450→BC3001** + warnings; `emb-curated-products.js`; `Portal_Recommendations` premium pool. Start ~10 rows / 4 categories (Tees→PC450/BC3001, Polos→NKDC1963, Fleece→PC90H, Outerwear→CT104670).
  - **✅ TABLE + API BUILT + LIVE 2026-07-01 (proxy v871):** `caspio-pricing-proxy/scripts/setup-product-upgrades.js` (`--apply`) **created the `Product_Upgrades` Caspio table via REST `POST /tables`** (note: the create ignored the inline `Columns` — the script then adds each field via `POST /tables/{t}/fields`; PK_ID auto) + seeded 6 rows (Tees Better/Best PC450/BC3001, Polos NKDC1963, Fleece PC90H/CTK121, Outerwear CT104670; real CATEGORY_NAME strings: `T-Shirts`/`Polos/Knits`/`Sweatshirts/Fleece`/`Outerwear`). New route `src/routes/product-upgrades.js` mounted `/api/product-upgrades` **requireCrmApiSecret-gated** (server.js:482): `GET ?category=&excludeStyle=` (customer-safe, active-only, margin-ranked, **strips Sell_Anchor/GP_Pct**) · `?all=1` (admin, full rows) · POST/PUT/DELETE for the future admin tab. Verified: 401 w/o secret; T-Shirts→PC450/BC3001 excl PC61; no margin leak. **+ `Image_URL` column** (Erik-editable; seeded on all 6 rows with the embroidered-caps-at-machine photo `https://c3eku948.caspio.com/dp/a0e150004df4984fb1ef4d30b01a/files/9444312` — a PUBLIC Caspio JPEG, renders in `<img>`) for the "think embroidery" module visual; API returns `image` per row. ⚠️ **GOTCHA (fixed)**: a Caspio `q.where` upsert must escape quotes INSIDE the value only — NOT the `'` string delimiters. Escaping the whole clause (`Category=''T-Shirts''`) → `IncorrectQueryParameter` + SILENT update failure (POST inserts worked, PUT updates didn't). ⏳ Product page (Phase B) + upgrade module (Phase C) not built yet — this is the data+API groundwork.
- **Digitizing offer** (Erik, wordsmithed): if NO embroidery file on record → "New to embroidery? We'll digitize your logo — **$50, half off the usual $100**, one-time, yours to reuse." If file EXISTS → "already digitized — no setup fee." DETECT via design# → `Design_Lookup_2026`/`EMB_Design_Files`/`Digitizing_Mockups` (default to showing the offer when unsure). **$ from `Service_Codes` digitizing code × editable 50%** — NOT hardcoded (Rule 9).
- Cross-sell "Your logo also looks great on" = design# → other styles they decorated (order-level `id_Design`) + `COMPANION_STYLES`.
