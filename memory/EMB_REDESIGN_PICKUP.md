# EMB Quote-Builder Redesign — Session Pickup (2026-06-03)

> Active hands-on thread with Erik: redesigning the **Embroidery** quote builder into a
> clean, invoice-style order flow, then **replicating the final design to SCP / DTG / DTF**.
> Read this first, then [quote-builder-architecture.md](quote-builder-architecture.md).
> Erik builds it on EMB, reviews live, then we roll out. He sends screenshots; iterate fast.

## How to resume / see it
- Frontend app: `npm start` (port 3000) → `http://localhost:3000/quote-builders/embroidery-quote-builder.html` (hard-refresh).
- Verify in-browser with the Preview MCP (`preview_start` name `pricing-index-preview`, autoPort, port 3010) — **restart the preview server if it serves stale HTML** (it cached an old copy mid-session once).
- Branch: **develop** (frontend) and **develop** (proxy). Deploy frontend = `/deploy` skill; proxy = `git push heroku develop:main`.

## UPDATE 2026-06-03 PM — Services bar SHIPPED; AL is the open piece
- **DEPLOYED v2026.06.03.2** (frontend): the whole Services-bar arc is LIVE — categorized bar
  (Artwork / Add-Ons), `GRT-50` Logo Mockup ($50), `GRT-75` Graphic Design ($75/hr, fractional
  hrs), `Monogram` ($12.50), `RUSH` (live 25%-of-subtotal line). Parts/descriptions match Erik's
  ShopWorks test order 142021; all in proxy `KNOWN_FEE_PNS` → push as LinesOE (qty → Size01).
- **On develop, committed, NOT yet deployed:** (1) Digitizing moved to the bar (Artwork ▾ → `DD` $100
  line, multiples) + top Digitizing checkboxes hidden (commit 425353ff). (2) **Bar fee prices now
  SOURCED from Caspio `Service_Codes`** via proxy `GET /api/service-codes` (commit 516a5d77) —
  `loadServiceCodePrices()`+`getServicePrice(code,fallback)` in embroidery-quote-builder.js; catalog +
  SERVICE_DEFAULTS read live SellPrice (GRT-50/GRT-75/DD/Monogram), hardcoded #s are fallback-only
  (visible toast on API fail, never silent-wrong). Change a price in Caspio → bar updates, no deploy.
  Backend route already existed: `caspio-pricing-proxy/src/routes/service-codes.js` (GET all/filter,
  `/tier/:code/:qty`, full CRUD, /seed). **AL pricing source = pricing-bundle `calculateALPrice` (NOT
  Service_Codes — its AL row is a sell-0 placeholder).** ShopWorks descriptions kept on the line item
  (Caspio DisplayName differs, e.g. GRT-50 "Setup Fee (Standard)" vs SW "Logo Mockup & Print Review").
- **Flagship strategy locked** (Erik's call): EMB is flagship; structure=shared, content=per-method;
  adopt-don't-copy; DTG stays separate. See quote-builder-architecture.md "Flagship model".
- **NEXT — Additional Logo onto the bar (the big one):** Artwork ▾ → "Additional Logo" → mini-picker
  (Garment/Cap + stitch: Standard/Mid/Large/Full Back) → adds `AL`/`AL-CAP` line; type qty → unit
  price LIVE from the API (`embroidery-pricing-service.calculateALPrice(qty, stitch, itemType)`,
  fetch once + cache, recompute on qty change like syncRushRow — it's tier-aware). Multiple ALs,
  each independent. Then RETIRE the top AL toggle (`toggleGlobalALNew`/`globalAL`, the `garment-al-inline`
  /`cap-al-inline` controls) + its recalc AL-fee-row path. Verify API price matches the old toggle
  ($9/pc Standard @ 12pc). Erik confirmed: move it + REMOVE the top controls (logo card keeps
  Position + Design Size only). Also still pending: push-verify live test (GRT/Monogram/RUSH/DD →
  Size01), Design # into logo cards, roll to SCP/DTF.

## DONE + SHIPPED to production (Release v2026.06.03.1, frontend)
A `/deploy` ran mid-session, so these EMB changes are LIVE in prod (not just localhost):
1. **Linear numbered order-flow sidebar** — Customer(1) → Artwork(2) → Shipping(3) → Order Details(4). Pickup is the DEFAULT ship mode; Date Placed defaults to today, Req Ship = +2 weeks (`setQuoteDateDefaults` in `quote-builder-utils.js`). ShopWorks Order # demoted ("filled after import").
2. **Invoice totals moved UNDER the line items** (right-aligned box `#invoice-totals-box`): Subtotal / Shipping / Sales Tax (editable %) / TOTAL. `#pre-tax-subtotal` kept as a HIDDEN canonical carrier (incl. shipping) for the save path; visible Subtotal = adjustedSubtotal − shipping.
3. **Shipping editor MODAL** (`#shipping-modal`) — the single home of the Pickup/Ship toggle + carrier + ship-to address + shipping charge. Opened from the totals "Shipping" line AND Step-3's "Change" button (one set of `#ship-*` IDs, no dupes). `updateShippingSummary()` keeps Step-3's summary in sync.
4. **Billing address on the printed invoice** — `generateCustomerSection` in `embroidery-quote-invoice.js` now prints a BILL TO street address + a conditional SHIP TO block (when shipping). EMB `printQuote` sources billing from the customer record (stash `window._lastCustomerShipTo`) → never the Milton pickup shop; falls back to ship-to when shipping.
5. **Tax-rate WRONG-TAX bug FIXED + DEPLOYED** (proxy Heroku **v783**): `caspio-pricing-proxy/src/routes/tax-rate.js` was discarding valid DOR rates on `ResultCode===2` and falling back to a hardcoded (often wrong) 10.1%. Now accepts any positive rate regardless of ResultCode + ZIP-only retry. Verified: Bellevue→10.3%, Tacoma→10.4%, etc. (See LESSONS_LEARNED 2026-06-03.)

## DONE on develop, NOT yet deployed (newest 2 commits)
6. **Persistent, catalog-driven Services bar** (commits 27a4e2ad + a2f74fe5):
   - NEW shared **`shared_components/js/quote-services-bar.js`** — `QuoteServicesBar.render(mountId, catalog, onAdd)` draws a persistent strip of one-click service chips under the line-items table; clicking a chip calls `onAdd(code)`.
   - EMB: replaced the "Add Service" dropdown with `#emb-services-bar`. Catalog = Logo Mockup & Review, Graphic Design, Monogram, Name/Number, Sewing (SEG), Design Transfer (DT). `onAdd` = `addManualServiceRow`.
   - **Logo Mockup → line item w/ editable price**; **Graphic Design → line item, Qty = hours × $75** (added to `SERVICE_META` + `SERVICE_DEFAULTS` + stitch-suffix exclusion in `embroidery-quote-builder.js`).
   - The old sidebar **"Artwork Services" step is HIDDEN** (`#artwork-services-step` display:none) — kept in DOM at $0 so existing save/load/pricing code is untouched (services now ride as line items, which already sum into `grandTotal`).
   - Verified live: 6 chips render, click→line item, totals foot ($150 GD → $165.15), no console errors.

## NEXT — Step B (do these next, in roughly this order)
1. **Confirm the printed invoice itemizes Logo Mockup / Graphic Design** as line items (they're now standard service rows like Monogram, which already print+push — likely fine, but VERIFY a Print Quote; the old `#art-charge`/`#graphic-design-hours` path is now hidden at $0). If the PDF doesn't show them, make the generator/`buildEmbroideryPricingData` include service rows.
2. **Move the Design # lookup INTO the logo cards** (Erik's choice): garment Design # → "Primary Logo" card, cap Design # → "Cap Front Logo" card (top-left). Then drop the sidebar "Artwork"(2) step + renumber. (Complex: design lookup has search modal + thumbnails + gallery cache — move carefully.)
3. **Roll the Services bar + the whole invoice-style layout onto SCP, DTG, DTF** — each gets its own service catalog; reuse `quote-services-bar.js`, the `.flow-step`/`.invoice-totals`/`.ship-modal`/`.service-bar` CSS (all already in `quote-builder-common.css`), `setQuoteDateDefaults`, the shipping modal pattern, totals-under-line-items. DTG is the inline-form architecture (separate). 
4. **Deploy** the Services bar (and Step-B work) once Erik signs off (`/deploy`).
5. **OPTIONAL (Erik offered, deferred):** add a real **billing-address field** to the Customer panel (auto-fill from lookup + saved) so billing prints for walk-ins + reopened pickup quotes (today it relies on the live `_lastCustomerShipTo` stash).

## Decisions Erik already made
- Shipping default = **Pickup**. Dates: **Placed=today, Req Ship=+2 weeks**. Rollout = **EMB first → SCP/DTF (and DTG)**. Billing = **reuse ship-to** (I source from customer record for pickup correctness) + **show SHIP TO when shipping**. Services menu = **persistent catalog-driven bar** (he deferred the exact style to me). Design # → **into the logo cards**.

## Gotchas carried in
- **OneDrive churn**: this repo is under OneDrive; a `/deploy` mid-session rewrote all `?v=` cache-bust strings to `2026.06.03.1` (why my `.07`/`.09` edits "didn't match"). Commit immediately after editing; the Preview server can serve a STALE copy → restart it if elements are missing.
- Service line items already sum into `pricing.grandTotal` (`embroidery-quote-builder.js` ~line 11082) → `#grand-total` → `#pre-tax-subtotal` → totals. So anything added via `addManualServiceRow` foots automatically.
- `#pre-tax-subtotal` is read by the SAVE path (`embroidery-quote-service.js:823`) — keep it = full pre-tax incl. shipping (it's now a hidden span).
