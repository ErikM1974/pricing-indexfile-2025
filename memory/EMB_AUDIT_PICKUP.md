# EMB Deep Audit — "Bulletproof" Mission (RESUME HERE)

> **MISSION (Erik, 2026-06-04):** Make the **2026 Embroidery quote app bulletproof** before we
> replicate its code to DTF / Screen Print / the other builders. Erik authorized **unlimited
> time + tokens** ("run tests for 10 hours or more"). The deliverable: after exhaustive testing,
> tell Erik **with 100% confidence the app is bullet-proof** — every surface correct for any order.
> **Read this first, then [EMB_REDESIGN_PICKUP.md](EMB_REDESIGN_PICKUP.md) for the redesign history.**

## 🟢 CERT RUN — 2026-06-04 EVENING (6 NEW BUGS FIXED · on `develop` · NOT yet deployed)
Ran the certification matrix (archetypes × surfaces) + a parallel save↔restore code audit (subagent).
Found + fixed **6 real bugs**, all in the **edit-reload / save-restore** path, each verified END-TO-END
(reload → Save Revision → re-fetch `quote_items` reconciles) + regression-checked + **970/970 unit tests
green**. On **`develop`** (commits `e6edad76`, `57c861e5`, `6bd130c6`, `d0b67597`, `db32318c`, `467702fc`
+ memory); frontend asset `?v=` bumped to `.11` — **NOT deployed; prod still `.6`.** Frontend-only, no
proxy change. Bugs #5–6 are the highest-impact (one over-charges /invoice + push, not just reload):
1. **2XL extended-size line DROPPED on edit-reload** (under-charge $88): `addProductFromQuote` put 2XL in a
   child row, then the end-of-fn `onSizeChange` read the empty PARENT 2XL input as qty 0 and DELETED the
   child (the 2XL double-count guard backfiring on programmatic restore; 3XL/4XL unaffected). Fix: set the
   parent Size05 input + let `onSizeChange` create/sync. (EMB-2026-276 reload $3501.50 → correct $3473.50)
2. **AS-Garm/AS-CAP stitch surcharge DOUBLE-COUNTED on reload** (over-charge $116): restored as a row AND
   re-derived by the fee table. Fix: skip auto-recomputed fees in `populateProducts` (`AUTO_RECOMPUTED_FEES`).
3. **Cap embellishment type (3D-puff/laser-patch) LOST on reload**: `populateLogoConfig` never restored
   `CapEmbellishmentType` → cap reverted to flat embroidery AND Save Revision DROPPED the 3D-EMB/Laser Patch
   fee (save gated on capEmbType). Fix: restore capEmbType + `handleCapEmbellishmentChange`; add 3D-EMB/Laser
   Patch to the skip list. (EMB-2026-278 C112 3D-puff: capType preserved, single $240 puff, stable $1104)
4. **Phantom "Garment:" note on cap-only orders** (mirror of the #25 cap-note fix): garment
   PrintLocation/StitchCount/DigitizingFee + LogoSpecs.logos saved the default Left Chest/8000 with no
   garment. Fix: gate all on `garmentQuantity>0` (both save paths) + filter the phantom primary out of
   LogoSpecs.logos. (EMB-2026-278 Art + Production notes now cap-only)
5. **Services-bar fees (GRT-50/GRT-75/DD/RUSH) LOST on reload** (under-charge): added via the bar they save
   as `fee` items but aren't in `SERVICE_STYLE_NUMBERS` → dropped on reload, then Save Revision deletes them
   permanently. RUSH (common 25% rush) verified: EMB-2026-284 reloaded $875→$730 (−$145). Fix: restore
   bar-origin fee items via `addManualServiceRow` in loadQuoteForEditing, gated on the matching SIDEBAR
   session field being 0 (art-charge→GRT-50, gd-hours→GRT-75, digitizing-checkbox→DD, rush-fee→RUSH recompute
   from those fields — non-zero ⇒ sidebar origin, don't add a duplicate row).
6. **DECG/DECC double-SAVE** (2× over-charge on /invoice + push, NOT just reload): a customer-supplied
   garment/cap row is collected by BOTH collectProductsFromTable (→manualServiceItems→saved as `fee`) AND
   collectDECGItems (→saved as `customer-supplied`). DB held 2 DECG ($480) for a $240 order; on-screen total
   read the table once ($240) so the rep never saw it. EMB-2026-286 reproduced. Fix: exclude DECG/DECC from
   `manualServiceItems` in saveAndGetLink. EMB-2026-287 verified: 1 item, /invoice $240, push 1 LinesOE.
**Archetypes certified** (pricing foots · save→reload round-trip · push PNs+notes · /invoice): garment +
extended-sizes + AL + Full-Back + stitch-surcharge (276) · cap + 3D-puff (278) · combined garment-72 + cap-24
separate-tiers (280). **Also round-trip-verified:** AS-CAP cap-stitch surcharge (281, recomputed once not
lost), laser-patch cap + GRT-50 setup (282), LTM qty≤7 $50 distributed (283), sidebar DD+graphic-design (284),
Monogram (288). **API-failure = Erik's #1 rule UPHELD**: init fail→warning toast (builder:1732), calculateQuote
throw→error toast + NO silent $0 (builder:6155), AL fail→error toast+$0 (builder:5693). **Tax engine**:
out-of-state NY→0%, WA 98101→10.5% live DOR; /invoice foots at 0% and 10.1%. LESSONS_LEARNED updated.
**NOT yet verified (why not 100%):** fixes are NOT deployed (prod has all 6 bugs); only push PREVIEW tested,
not live MO→ShopWorks conversion of the new fixes; PDF spot-checked not exhaustive; multi-garment-style only
via the cap+garment combo. **Discount has NO input controls in the EMB builder** (populateAdditionalCharges
discount-restore lines reference non-existent `discount-type/amount/preset` = harmless dead code).
**NEXT:** `/deploy` frontend (tag `v2026.06.04.7`, no proxy change) — **Erik to confirm/run** → then live-push
ONE order to confirm the MO→SW conversion. **Delete test orders 271–288** (all cust 3739 / TEST-prefix).

## ✅ RESUME STATUS — 2026-06-04 PM (everything below is now DEPLOYED + LIVE)
**Frontend prod = v2026.06.04.4; proxy prod = `ab41aa7`.** The "develop NOT deployed" warnings further down are STALE — all of it shipped. What's DONE + LIVE + verified:
- **4 edge-case fixes** (resetQuote crash, logo-only-order block, AL edit-reload persistence, server blank-customer guard) — DEPLOYED. resetQuote no longer crashes/corrupts.
- **4 output-surface fixes** — DEPLOYED + verified live on EMB-2026-275: **/quote foots** (AL/Full Back render: $480+$282+$1650=$2412); **/invoice tax fixed** (Tax $243.61/10.1%, grand $2655.61 foots, no TAX line item); **production Logo Map** live (Notes To Production lists Garment + Cap primaries + "Additional Logos: Right Sleeve 11000 / Full Back 55000"); **PDF** now prints Design#/PO#/Req-Ship + AL placement dup fixed. Quote-mgmt dashboard = already solid (no fix).
- **Shipping estimator** — DEPLOYED + verified. Proxy `POST /api/shipping/estimate-ups-ground {toZip,weightLb,boxes}` (rough zone×weight). Frontend "Estimate UPS Ground" button in the shipping modal → `estimateShipping()` sums real SanMar weight+boxes (`/api/inventory` PIECE_WEIGHT/CASE_SIZE per size, boxes per-product via min case pack) → fills shipping fee. Verified: 4 J790 jackets→Seattle = 7lb, 1 box, $17.12.
- **Box density (v2026.06.04.5):** `perBoxForCategory(avgWt, caseSize)` in embroidery-quote-builder.js uses
  DATA-BACKED outbound pieces-per-box from a real SanMar inbound-carton sample (2026-06-04, 71 cartons): caps
  ~60, tees ~58, polos ~36, hoodies/jackets ~16-17 (decorated-shaved, errs high). Category inferred from
  per-piece weight + case pack (no extra API call). KEY: **SanMar's shipment feed has NO weight/dimensions**
  (confirmed in the raw XML; the `sanmar-soap.js` weight/dim parser is dead code) → carton weight = per-piece
  weight × qty. `/api/sanmar-shipments/by-date` has a **7-day hard limit** (can't mine deep history). **NWCA
  outbound `Box_Contents`/`Box_Shipments` tables DON'T exist** (stale memory pointer in CLAUDE.md →
  `box-labels-details.md` also missing). To get TRUE measured decorated density later, build an outbound
  box-contents log, then re-derive. Category lookup if ever needed: `/api/product-details` → `CATEGORY_NAME`.
- **⚠️ NEEDS ERIK:** the UPS rate model is a ROUGH starter (linear, coarse zones). For accuracy, Erik downloads the **UPS 983 zone chart + Ground rate grid** from ups.com → replace `zoneForZip()` + `ZONE_MODEL` in `caspio-pricing-proxy/src/routes/shipping.js`. Also delete the EMB-TEST-2026-271/272/274/275 test orders from ShopWorks/3739.

## REMAINING for full "100% bulletproof" certification
1. **Run the exhaustive test matrix** (archetypes × 6 surfaces — see the matrix near the bottom of this file). Individual pieces are verified; a full sweep across garment/cap/mixed/full-back/3D-puff/laser/extended-sizes/all-tiers/services/discount/tax-exempt/out-of-state, each save→reload→push→PDF→/quote→/invoice, is the cert step. Bias adversarial — try to break each.
2. **Reconcile totals across surfaces** for each: on-screen == PDF == /quote == /invoice == saved TotalAmount == push subtotal.
3. **Load Erik's real UPS tables** → re-verify estimates.
4. **Minor polish found:** suppress the spurious "Cap: CF — 8000 stitches" production-note line on garment-ONLY orders (transformer buildNotes — only emit the Cap line when there's actually a cap); the latent GRT double-count if a rep uses sidebar AND bar (builder).
Only AFTER the matrix passes + totals reconcile → certify to Erik with the evidence table.

## How to resume / drive the app
- Local app: `npm start` (port 3000). Preview MCP server `pricing-index-preview` (port 3010) — restart if it 404s ("Server not found" → `preview_start`). Drive via `preview_eval` (screenshot tool hangs on this heavy page; use eval + console-logs).
- Build an order in Preview: `addProductRow(style)` → wait → `selectColor(rowId, optEl)` → wait → set `.size-input[data-size=X]`; **caps go in the 3XL/last column via `createOrUpdateExtendedChildRow(rowId,'3XL',qty)`** (cap style = Richardson **112**, not C112). Add logos via `addALLineItem(placement, stitches)`; services via `addManualServiceRow(code)`. Save via `saveAndGetLink()` (needs customer name+email); grab QuoteID from the share-modal: `document.body.innerHTML.match(/EMB-2026-(\d+)/)` (take max).
- **resetQuote() is fragile mid-test** (bug fixed but navigate-fresh is more reliable between orders).
- Push preview (dry-run, no write): `GET /api/embroidery-push/preview/:quoteId` → `.orderJson` (LinesOE, Notes, Designs). Push (live): `POST /api/embroidery-push/push-quote {quoteId, isTest:true}` (TEST- prefix → cust 3739). Verify landed: `GET /api/manageorders/getorderno/:extOrderId` (cron lag ~15-60min).
- Proxy base: `https://caspio-pricing-proxy-ab30a049961a.herokuapp.com`. **The LIVE proxy runs DEPLOYED code — local proxy edits need a proxy deploy to take effect** (bit me on the customer-guard test).
- Read saved quote data: `GET /api/quote_items?QuoteID=...` + `/api/quote_sessions?QuoteID=...`.

## DEPLOY STATE — ⚠️ LOTS ON develop, NOT DEPLOYED (deploy both repos!)
Production (`sanmar-inventory-app` v2026.06.04.2 + the live proxy) is BEHIND. **The resetQuote() crash is
LIVE in prod and silently corrupts quotes** — deploy is overdue. On develop, committed, undeployed:
- **Frontend** (after prod v2026.06.04.2): `fc832404` (4 edge-case fixes), `f599ec1e` (/quote invoice foots), + memory commits. Cache-bust currently `?v=2026.06.04.3` on embroidery-quote-builder.js + .service.js; quote-view.js NOT yet version-bumped (the `/deploy` skill auto-bumps).
- **Proxy** (`../caspio-pricing-proxy`, branch develop): `ef344e5` (blank-customer push guard). Deploy = `git push heroku develop:main` (or its deploy flow). **MUST deploy for the customer guard + (pending) push-notes fix to take effect.**
- **NEXT: once the 4 surface fixes are done + verified → `/deploy` frontend AND deploy proxy.**

## FIXES ALREADY DONE + COMMITTED (verified)
Edge-case hardening (commit `fc832404`, frontend) — all verified live except #4 (needs proxy deploy):
1. **resetQuote() crash** — guarded deleted discount/art elements (was aborting reset → stranded edit
   mode → next save overwrote the prior customer's quote). ✓ no-throw verified.
2. **Logo-only order blocked** — save/push of services-with-no-garment/cap now errors. ✓ verified.
3. **AL placement/stitch survive edit-reload** — save persists `position`→PrintLocationName + stitch/
   position in SizeBreakdown (both save paths in embroidery-quote-service.js); restore re-flags
   AL/AL-CAP/DECG-FB rows `dataset.alPriced`/`alItemType` (embroidery-quote-builder.js ~1207). ✓ save
   side verified (items carry Right Sleeve/11000 + Full Back/55000).
4. **Server blank-customer guard** — non-test push with blank Customer# 400s (proxy `ef344e5`). NOT yet
   live (needs proxy deploy).
5. **Save snapshot determinism** — saveAndGetLink awaits syncALRows()+recalculatePricing() before collecting.

## THE 4-SURFACE AUDIT (2026-06-04, 4 parallel agents) — findings + fix status
| Surface | Verdict | Fix status |
|---|---|---|
| **Quote Management dashboard** | 🟢 SOLID — no EMB bug (amount null-safe, routing/lock/status all correct) | NONE NEEDED |
| **/quote web invoice** (pages/js/quote-view.js) | 🔴 P1 — AL/AL-CAP/DD/GRT fee items silently dropped → didn't foot | ✅ FIXED `f599ec1e` (verify live still pending) |
| **/invoice web invoice** (pages/js/invoice.js) | 🔴 P1 — renders TAX/SHIP/DISCOUNT as line items; tax=$0 in totals for pre-import WA orders | ⏳ **IN PROGRESS (T20)** |
| **ShopWorks push NOTES** (proxy lib/embroidery-push-transformer.js) | 🟡 Production can't see ADDITIONAL logos (sleeve/full-back/cap-back only in line Descriptions, not any production note); no consolidated logo map; 3D/laser not in notes | ⏳ NOT STARTED (T21) |
| **Printed PDF** (shared_components/js/embroidery-quote-invoice.js) | 🟡 Design # / PO # / Req-Ship date never print; AL placement duplicated; money math correct | ⏳ NOT STARTED (T22) |

### IN-FLIGHT FIX DETAILS (resume exactly here)
- **T20 — /invoice (pages/js/invoice.js):** (a) `quoteItemsToInvoiceRows` (~655) maps EVERY item → filter out
  `EmbellishmentType==='fee' && StyleNumber ∈ {TAX,SHIP,SHIPPING,DISCOUNT}` (those are order-level/totals).
  (b) `renderTotals` (~781) reads tax from `order.cur_SalesTaxTotal` → `orig?.totals?.tax || 0`, giving **$0
  tax for pre-import WA orders** — add a fallback to `sessionRaw.TaxAmount` / `TaxRate` (+SubtotalAmount),
  normalizing decimal-vs-percent the way quote-view.js does (`rate>1 ? /100 : rate`). I was MID-EDIT on the
  filter when Erik paused.
- **T21 — Push notes Logo Map (proxy lib/embroidery-push-transformer.js `buildNotes` ~658-784):** Notes To
  Production currently lists only the 2 PRIMARY logos (from session PrintLocation/StitchCount +
  CapPrintLocation/CapStitchCount). ADD a consolidated "LOGO MAP" block that merges primaries (session) +
  every additional-logo line item (iterate `items` where StyleNumber ∈ AL/AL-CAP/DECG-FB/CB/CS, reading
  `PrintLocationName` + `JSON.parse(SizeBreakdown).stitchCount` + PartNumber). Also append cap embellishment
  method when `session.CapEmbellishmentType !== 'embroidery'` (3D Puff / Laser Patch). Also add `CB`/`CS` to
  `KNOWN_FEE_PNS` (config/manageorders-emb-config.js ~62-72) — latent for legacy/imported quotes. All the AL
  data is already persisted on quote_items (ProductName/PrintLocationName/SizeBreakdown) — the transformer
  just isn't reading it into notes.
- **T22 — PDF (shared_components/js/embroidery-quote-invoice.js + printQuote ~11911 in builder):** (a) render
  `logo.designNumber` in `generateLogoListHTML` (~871) — data is on garmentLogos[0]/capLogos[0], never printed.
  (b) pass `#po-number` + order dates (Date Placed / **Req Ship** / Drop-Dead) from printQuote into
  customerData + print in the header (Req Ship is what production needs). (c) drop the duplicated placement on
  AL service rows (`embroidery-quote-invoice.js:1261` appends `- position` to a description that already has
  it → "...(11K stitches) - Right Sleeve"). (d) OPTIONAL: feed bar AL rows into the green logo spec box.
- **Latent (flag, lower priority):** double-count if a rep uses BOTH the sidebar GRT inputs AND the bar GRT-50/
  GRT-75 (builder-side); 250-char LogoSpecs truncation can drop primary stitch lines from Notes To Art;
  existing-design # push sends bare `{id_Design}` with no Locations/ImageURL.

## TEST ORDERS / FIXTURES (test cust 3739, TEST- prefix — Erik to delete after review)
- EMB-TEST-2026-271 (PC54 + AL Right Sleeve 11K + Full Back 55K + DD), -272 (PC61 + 2 AL + Monogram+GRT-50+
  RUSH), -274 (Richardson 112 cap in 3XL col + 2 AL-CAP), -275 (PC54 + AL + Full Back; pushed non-test to 3739
  by accident during the customer-guard test). 273 = incomplete cap (ignore).

## HOW THE NEW BAR AL/SERVICES ARE STORED (key mental model)
Bar Additional Logos + services save as **quote_items, EmbellishmentType:'fee'**, StyleNumber = the part #
(`AL`/`AL-CAP`/`DECG-FB`/`DD`/`GRT-50`/`GRT-75`/`Monogram`/`RUSH`). Placement in `PrintLocationName` +
`ProductName` ("Additional Logo: Right Sleeve (11K stitches)"); stitch+position in `SizeBreakdown` JSON
`{serviceType,stitchCount,position}`. The legacy Quote_Sessions fee COLUMNS (ALChargeGarment, GarmentDigitizing,
ArtCharge, RushFee, …) are **all 0** for new orders. **Every consumer (invoice/notes/PDF) must read the fee
ITEMS, not the old session columns** — that mismatch is the root of the /quote + notes gaps.

## DEFINITION OF "BULLETPROOF" + the exhaustive test matrix still to run
Certify ONLY after every cell below is verified correct (build live → check all 6 surfaces → save→reload→
re-verify → push-preview → inspect). **Order archetypes to test:**
1. Garment-only, single left-chest logo, standard 8K, mid qty (tier 24-47).
2. Garment + additional logos at EVERY placement (L/R chest, L/R sleeve, nape, full back) w/ exact stitches.
3. Full back at 25K / 40K / 55K / 100K (exact-stitch pricing).
4. Cap-only (Richardson 112) + cap front/back/side AL-CAP; 3D-puff cap; laser-patch cap.
5. Mixed garment + cap, multiple logos each.
6. Extended sizes 2XL/3XL/4XL (suffix _2X/_3X/_4X → Size05/06/07) + the cap-in-3XL convention.
7. Tiers: 1-7 (LTM), 8-23, 24-47, 48-71, 72+ — verify tier-correct pricing + LTM.
8. Services: DD, GRT-50, GRT-75 (fractional hrs), Monogram (qty), RUSH (=25% of FULL subtotal — re-verify),
   discount (% and $), tax-exempt, out-of-state (0% tax), pickup vs UPS-ship + address→tax.
9. New design upload vs existing design # (artwork link on push).
10. Edit-reload / Save Revision round-trip for each (placement/stitch/pricing must survive — the fix).
11. Adversarial: $0 lines, blank qty, no customer #, logo-only, huge stitch counts, many logos (250-char note).
**For EACH archetype verify all 6 surfaces:** (1) on-screen pricing foots + tier-correct, (2) PDF complete,
(3) /quote invoice foots + complete, (4) /invoice foots + tax correct, (5) push preview = correct LinesOE +
PNs + production notes, (6) quote-mgmt row correct + Edit opens EMB builder + lock on pushed.
**Also:** calculator-vs-builder price parity (CLAUDE.md rule), and the on-screen total == PDF total == /quote
total == /invoice total == saved TotalAmount == push subtotal (all must reconcile).

## Path to certification
1. Finish T20/T21/T22 (+ re-verify T19 live). 2. Deploy frontend + proxy. 3. Run the full test matrix above,
logging every archetype × surface result. 4. Fix anything that surfaces (adversarial bias — try to break it).
5. Only then report to Erik: "verified bulletproof" with the evidence table. Then replicate to DTF/SCP.
