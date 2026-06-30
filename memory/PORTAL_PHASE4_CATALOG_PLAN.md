# Customer Portal — Phase 4 Build Plan: Personalized Catalog + Re-order

**Status:** PLANNED 2026-06-30, not built. Sits on top of the LIVE authenticated portal + admin console (→ CASPIO_PORTAL_DESIGN.md). Grounded in a 35-tool Explore of the catalog/cart/pricing/rewards code.

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
