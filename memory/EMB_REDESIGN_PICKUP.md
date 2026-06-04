# EMB Quote-Builder Redesign — Session Pickup (2026-06-03)

> Active hands-on thread with Erik: redesigning the **Embroidery** quote builder into a
> clean, invoice-style order flow, then **replicating the final design to SCP / DTG / DTF**.
> Read this first, then [quote-builder-architecture.md](quote-builder-architecture.md).
> Erik builds it on EMB, reviews live, then we roll out. He sends screenshots; iterate fast.

## How to resume / see it
- Frontend app: `npm start` (port 3000) → `http://localhost:3000/quote-builders/embroidery-quote-builder.html` (hard-refresh).
- Verify in-browser with the Preview MCP (`preview_start` name `pricing-index-preview`, autoPort, port 3010) — **restart the preview server if it serves stale HTML** (it cached an old copy mid-session once).
- Branch: **develop** (frontend) and **develop** (proxy). Deploy frontend = `/deploy` skill; proxy = `git push heroku develop:main`.

## UPDATE 2026-06-04 — AL picker redesigned (placement + EXACT stitches); J790 stress-test
- **DEPLOYED v2026.06.04.1**: AL-as-bar-line-item + Design#-into-logo-cards (see below).
- **THEN (develop, VERIFIED, NOT deployed — commit f319ac6c, `?v=2026.06.04.2`):** Erik stress-tested a
  real order (J790 Glacier jacket, 3 logos incl. a 55K full back) and surfaced that the AL picker's coarse
  buckets (Std/Mid/Large + locked-25K Full Back) couldn't represent 11K or 55K → mis-priced. **Redesigned the
  AL picker:** (1) **Placement** dropdown (grouped Garment/Cap incl Full Back) that DRIVES the pricing path
  (Full Back→fullback rate, Cap*→cap, else garment) AND prints on the line + carries to ShopWorks (was
  notes-only). (2) **Exact Stitches** number field + Std/Mid/Large preset chips — simple for common, exact
  when it matters; feeds `calculateALPrice` directly. `quote-services-bar.js` gained grouped `<optgroup>` +
  a `number`/`stitches` field type w/ preset chips (reusable). `addALLineItem(placement, stitches)`.
  Live-verified (17 pcs, tier 8-23): Right Sleeve **11K=$12.75/pc**, Full Back **55K=$68.75/pc** (was locked
  $31.25 — **gap fixed**), Cap Front 8K=$8.50. **Full J790 order entered live** (Aaberg's/Nika, sizes
  L1/XL2/2XL3/3XL6/4XL5=17 via `createOrUpdateExtendedChildRow`, Mid primary, sleeve 11K+DD, back 55K, GRT-50,
  UPS→Sumner): Subtotal **$3,024.50** + WA tax $305.47 = **$3,329.97**. PNs all correct: J790(+_2X/_3X/_4X),
  AL, DD, DECG-FB, GRT-50. **NEXT: `/deploy` this fix** (prod still has the bucketed picker w/ the full-back
  gap), then push-verify + roll to SCP/DTF.

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
- **DONE 2026-06-03 — Additional Logo on the bar (verified; on develop, NOT yet deployed):** Artwork ▾ →
  "Additional Logo" picker (Garment/Cap + size Standard/Mid/Large/Full Back) → drops an `AL`/`AL-CAP`/
  `DECG-FB` line item; rep types qty → per-piece price LIVE from the API (`EmbroideryPricingService.
  calculateALPrice`, cached via `/api/al-pricing`). Re-prices on add (`addALLineItem` awaits `syncALRows`)
  + on qty-change (`onServiceQtyChange` → `syncALRows().then(recalc)` for `[data-al-priced]` rows) — NOT in
  the sync `updatePricingDisplay` (putting `await` there was a SyntaxError that nuked the whole script; see
  LESSONS 2026-06-03). Top toggle RETIRED: `garment-al-inline`/`cap-al-inline` hidden; `globalAL` defaults
  false so the legacy fee-row path stays dormant on new quotes (no double-count); engine kept for
  backward-compat load of old quotes. Size→stitch per type: garment 8000/13000/20000, cap 5000/8000/11000,
  FB 25000. Commits e84896f7 + ee044c7e + db2c7930; cache-bust `?v=2026.06.03.6`. Live-verified (Preview):
  garment Std $9.00@12 (== old toggle + direct API), $7.50@48 (tier-aware), cap Mid $8.50, FB $31.25; 3
  independent rows; grand $837 foots; toggles hidden; globalAL off; no legacy fee row. NEW shared-bar
  capability: `quote-services-bar.js` now supports a `fields` picker item (inline selects + Add) — reusable.
- **DONE 2026-06-04 — Design # lookup moved INTO the logo cards (verified; develop, NOT deployed):** garment
  Design # now at the top of the Primary Logo card, cap Design # at the top of the Cap Front Logo card (label
  "Design #"). Standalone sidebar "Artwork" step (`#design-config-section`) REMOVED; flow renumbered
  Customer(1) → Shipping(2) → Order Details(3) (hidden Artwork-Services panel left as 4). Inner IDs unchanged
  (`garment-design-number`/`-info`/`-clear`, cap equiv) so `lookupDesignNumber`/`openDesignSearchModal`/
  `clearDesignNumber`/thumbnails stay wired by ID — zero JS change. Re-scoped sidebar sizing to
  `.logo-card-design-row` + separator border (`embroidery-quote-builder-extracted.css?v=2026.06.04.1`). Commit
  ed7ed481. Note: design inputs are visible only once that product type is in the order (cards show on add) —
  intended. Verified (Preview): inputs in cards, no dup IDs, section gone, steps 1/2/3, styled, no errors.
- **NEXT:** (1) Erik reviews AL + Design# live on localhost:3000 (hard-refresh; EMB js `?v=2026.06.03.6`, css
  `?v=2026.06.04.1`) → `/deploy` when happy (ships BOTH). (2) Push-verify a live TEST order — AL/GRT/Monogram/
  RUSH/DD land as LinesOE (qty → Size01); confirm `AL-CAP` + `DECG-FB` are in proxy `KNOWN_FEE_PNS`. (3) Roll
  bar + invoice layout to SCP/DTF.

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
