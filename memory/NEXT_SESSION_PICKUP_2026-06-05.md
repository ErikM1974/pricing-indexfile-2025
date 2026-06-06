# NEXT SESSION PICKUP — set 2026-06-05 (Erik powering off)

## ✅ DONE THIS SESSION — deployed + verified, DON'T redo

### 1. ShopWorks receiving outage — FIXED + DEPLOYED + VERIFIED
- **Root cause:** the OnSite "Manage Orders" integration's **`APISource` filter = `ManageOrders`** silently
  dropped 100% of our blank-APISource pushes.
- **Fix:** stamp `APISource:"ManageOrders"` on EVERY push path. Deployed: proxy **v787** (EMB/SCP/DTF +
  order-form/3DT/DTG via `transformOrder`), Inksoft `transform.py` **v262**, frontend `server.js`
  (shipped in v2026.06.05.1).
- **Verified:** Erik's rep-built order **`EMB-2026-293` imported into ShopWorks** — `APISource:"ManageOrders"`,
  `id_Integration:200`, design #9449 linked.

### 2. AS-Garm subtotal fix — FIXED + DEPLOYED (frontend **v2026.06.05.1**) + VERIFIED
- **Bug:** EMB `SubtotalAmount` was saved as `pricingResults.subtotal + ltmFee`, which EXCLUDED the
  AS-Garm/AS-CAP stitch surcharges (they live in `grandTotal`, not `subtotal`), while `TaxAmount` + the
  pushed ShopWorks lines INCLUDED them → quote under-counted vs ShopWorks (291: $2493 vs $2605 lines).
- **Fix:** `shared_components/js/embroidery-quote-service.js` — BOTH save paths (saveQuote + updateQuote)
  now compute one shared `const preTaxSubtotal = grandTotal + art/design/rush/sample − discount` and use
  it for BOTH `SubtotalAmount` AND `TotalAmount` (can't diverge again). 40 jest tests pass.
- **Verified:** `EMB-2026-293` foots perfectly — Subtotal **$1142 = sum of all 9 lines** (incl the $312
  Additional-Logo fee); Total $1257.34 = Subtotal + Tax. (293's logo was ≤10K so it had no AS-Garm
  surcharge specifically — the AL fee folded in correctly; the jest tests cover the AS-Garm delta.)
- **TODO (carry-over):** add this to `LESSONS_LEARNED.md` (file was ~300 lines — archive an old resolved
  entry first). Lesson = "saved SubtotalAmount must equal the all-in pre-tax base the tax uses (= sum of
  pushed lines); never derive it from `pricingResults.subtotal` (products-only, drops stitch fees). Same
  'output paths must agree' class as the 2026-06-01 invoice bug."

---

## ✅ SHIPPED v2026.06.05.2 (Heroku v1237, commit c3123247) — 3 order-entry improvements; PENDING Erik's live-build verify

> **#1 AL qty auto-tally** — `embroidery-quote-builder.js`: new `getOrderPieceCounts()`; `addALLineItem`
> defaults qty to total garment/cap count (not 1); `syncALRows` auto-syncs it (now called from
> `recalculatePricing` so a garment-qty change flows in); `onServiceQtyChange` sets `alQtyAuto='false'`
> on manual edit; edit-reload sets `alQtyAuto='false'` to preserve the saved qty.
> **#2 logo card auto-collapse** — `updateLogoCardHeader` adds `.collapsed` once a Design # is set (chevron re-opens).
> **#3 one-click Push** — new `pushToShopWorks()` auto-saves via `saveAndGetLink({skipShareModal:true})` then
> opens the preview; button is now FIRST + prominent, enabled on Customer # (removed a dup legacy `pushToShopWorks` alias).
> AL still lands as a ShopWorks **LinesOE line item** (KNOWN_FEE_PNS has AL/AL-CAP/DECG-FB; `manualServiceItems` saves AL).
> **TO VERIFY (Erik builds an order):** AL qty auto-fills to the total + pushes as a line item with that qty; logo card collapses; one-click Push auto-saves then previews.

### Original feedback detail (now shipped)

### #1 (DO FIRST — pricing-safety BUG): Additional-Logo qty defaults to 1, should auto-tally to total pieces
- When a rep adds an **Additional Logo (AL)** from the Services bar, its qty defaults to **1**. It should
  default to the **total garment quantity** on the order (e.g. 39) and stay in sync as sizes change.
- **Risk:** if the rep forgets to change 1→39, the logo is under-billed ($8 vs $312) — Erik's #1 rule.
- **Where:** `shared_components/js/embroidery-quote-builder.js` — `addALLineItem` / the Services-bar onAdd
  handler. Set AL qty = sum of garment quantities (the "Total Pieces" value), and re-sync on garment qty
  change (in `recalculatePricing` or a qty-change hook).
- Erik's words: "it should default to the total quantity currently on the order… right now it sets the
  additional logo to one… thinking of a better, easier way to key this in." → answer: auto-tally, no manual count.

### #2 (UX): Logo card crowds the line items / hard to read
- The Primary Logo card is tall and sits ABOVE the product table, squeezing the line items into a tiny
  scroll area (worse with multiple logos).
- **Recommended fix:** auto-collapse the logo card to a one-line summary once a Design # is set (it already
  has the chevron / `toggleLogoCard`). Keeps it accessible but out of the way.
- **Where:** `quote-builders/embroidery-quote-builder.html` (logo-card markup) + `embroidery-quote-builder.js`
  (`toggleLogoCard` / the Design# set handler — `setDesignNumberOnLogo` / `updateLogoCardHeader`).

### #3 (UX — biggest workflow win): "Push to ShopWorks" is buried + Save-vs-Push flow confusing
- It's the LAST button under Copy/Print/Email/Save&Share. Erik got confused about what to click after
  entering the line items ("I think you have to click Save and Share… that option is buried").
- **Recommended fix:** make **Push to ShopWorks the prominent PRIMARY action** (top, full-width, distinct
  color) and have it **auto-save before pushing** (no separate Save step). One clear path: fill order →
  Push → review modal → confirm.
- **Where:** the right-panel action buttons in `quote-builders/embroidery-quote-builder.html` (Save & Share
  section + Copy/Print/Email/Push) + the push handler (`openPushPreview`/`confirmPushToShopWorks` — ensure
  it saves first).

---

## ⚠️ Flags + cleanup
- **`loadQuoteForEditing` froze the page** (90s+, twice) when I called it programmatically on complex
  quote 291 (DECG + multi-logo). May be my direct invocation (not the dashboard edit flow), OR a real
  edit-load hang on heavy quotes — worth a look; could bite reps editing big orders.
- **AUTOMATION NOTE:** the EMB builder is too heavy to drive reliably via Chrome CDP (freezes/races on the
  product autocomplete + edit-load). For live E2E tests, have ERIK build the order; I verify the pushed JSON.
- **Test orders to DELETE in ShopWorks/Caspio** (all test): `EMB-2026-293` (cust 1276 Aaberg's, Erik's
  test), `EMB-TEST-2026-291` (HAND-EDITED this session: SubtotalAmount forced to 2605, re-pushed, left
  `Status=Open` + `PushedToShopWorks` reset then re-set — re-lock or delete), `EMB-TEST-2026-294`,
  `VERIFY-1/2/3-0604`, `CTRLA/CTRLB-0604`; draft Caspio quotes `EMB-2026-294` / `EMB-2026-295`.

## Deploy state
- Frontend **v2026.06.05.6** (Heroku v1241, develop=main synced) · Proxy **v789** · Inksoft **v262**.
- **v2026.06.05.6 — audit #3 right-panel re-skin SHIPPED** (SHARED css → DTF/SCP/DTG affected, verify): Quote Summary
  `.pricing-panel` now bordered white card (14px pad); `.pricing-title i` + `.tier-badge` → indigo #6366f1 (match step
  numbers; green invoice TOTAL stays money accent); Special Notes header off-yellow → neutral gradient; Order Details
  renumbered 3→2. STILL REMAINING from audit: #4a light action bar (caveat: shared w/ modal Cancel buttons), #8 push-
  readiness checklist, #9 full numbered spine, #11 surface tax in push preview, #12 logo card collapse-default, #13
  Rush%→Service_Codes + resetQuote childRowMap/cap-embellishment hygiene.
- **EMB BUILDER AUDIT (workflow ww781a8f5 — 39 agents, 53 confirmed findings → 13 fixes).** Full plan in
  `tasks/ww781a8f5.output`. SHIPPED BATCH (proxy v789 + frontend v2026.06.05.5): **artwork-upload HTTP 500**
  (`files-simple.js` streamed Readable.from(buffer)→chunked→Caspio reset; now Buffer append + timeout, mirrors
  thumbnails.js; +frontend xhr.timeout); **3 pricing bugs** (tax-exempt re-tax on reload → restore #include-tax;
  stale AL auto-tally bills vs 0 garments → zero it; legacy XXL dropped on reload → normalize to 2XL parent col);
  **artwork widget shrink** (quote-builder-shell.css dropzone/icon/thumb/design-name — SHARED, affects DTF/SCP);
  **shipping de-dup** (removed right-rail #shipping-step card; lives in bottom-left invoice block — answers Erik's Q);
  **design-name focus bug** (selector fixed). REMAINING (visual/polish, pending Erik's eye): #3 right-panel re-skin
  (Quote Summary card chrome + indigo headers + Special Notes off-yellow + collapse CSS), #4a light action bar,
  #8 push-readiness checklist, #9 one numbered spine, #11 surface tax in push preview, #12 logo card collapse-default,
  #13 Rush%→Service_Codes + resetQuote childRowMap/cap-embellishment hygiene.
- **v2026.06.05.4 — right-panel UX redesign (Erik feedback):** (1) Reference Artwork moved OUT of the retired
  "Save & Share" dropdown INTO the garment logo card under the Design # (`emb-artwork-mount` relocated; collapses
  with the card once a Design # is set). (2) "Save & Get Shareable Link" → renamed "Get Shareable Link", moved into
  the action stack directly under Push (order now Push ▸ Get Link ▸ Copy ▸ Print ▸ Email). (3) "Save & Share"
  collapsible dropdown retired. (4) Special Notes now a standalone field. KNOWN EDGE CASE: garment logo card hides for
  cap-only orders → artwork upload is garment-orders-only (flagged to Erik; add to cap card if he does cap-only art).
  DEAD CODE: `toggleSaveShare()` in embroidery-quote-builder.js (no longer called; references removed elements) — flag, don't auto-delete.
- **PROXY v788 — push session-selection fix (Erik's #1 rule: wrong total to ShopWorks).** EMB-2026-294
  pushed STALE notes ($2493/qty28/12000st — from old 291) while its LINE ITEMS were fresh ($366/qty5/8000st).
  ROOT: TWO `Quote_Sessions` rows shared QuoteID 294 (stale PK_ID 1622 from a 06/04 out-of-band test draft +
  fresh PK_ID 1624 = Erik's order); the push read `sessions[0]` UNORDERED → Caspio returns oldest-first → grabbed
  the stale row for the Notes. FIX: `embroidery/dtf/scp-push.js` session query now `q.orderBy:'PK_ID DESC'` (newest
  save first) on BOTH push + preview; EMB warns on >1 row. Verified live: 294 preview now reads $366. Why the dup id:
  `quote-sequence.js` is a BLIND counter (`quote_counters.NextSequence`, no existence check) — the 06/04 294 draft was
  inserted out-of-band so it never advanced the counter → 294 reissued ONCE. Counter now at 295 (EMB-2026-295 does NOT
  exist → no imminent collision). OPEN (Erik's call): delete stale 294 (PK_ID 1622) + wrong ShopWorks 294 (test cust 3739);
  OPTIONAL harden quote-sequence to skip already-existing ids (defense-in-depth; low priority, counter is clean).
- **v2026.06.05.3 also shipped** a customer-lookup fix: `customer-lookup-service.js` `maxResults` 10→25 so the
  contact dropdown shows ALL of a company's contacts (Aaberg's has 17; was capped at 10). Shared service → all 4 builders.
  NOTE: proxy `/api/company-contacts/search` caps at 25 — a company with >25 contacts would still truncate (bump proxy if needed).
- **Email-not-filling investigation (Maxx Bacon @ Aaberg's):** NOT a code bug — the contact's `Email`/`ContactNumbersEmail`
  columns are genuinely blank (only the shared `Company_Email` is set; it's identical on all 17 Aaberg's rows so it's NOT a
  safe fallback — Erik vetoed that). Maxx (ID_Contact 162449) is a no-email DUP of Alexx Bacon (116287, has alexx@aabergsequipment.com).
  Resolution = data cleanup in ShopWorks (Erik's call), no code change. Lesson: ran proxy locally vs live Caspio to PROVE the
  `Email` vs `ContactNumbersEmail` columns are identical before deploying a "fix" — caught a wrong theory pre-deploy.
