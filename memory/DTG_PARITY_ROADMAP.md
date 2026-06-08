# ⭐ NEXT SESSION — START HERE (DTG Phase 1 + 2)

**Goal:** finish bringing the DTG flagship (`quote-builders/dtg-quote-builder.html` → `dtg-inline-form.js` + `dtg-quote-page.js`) to EMB/DTF/SCP parity: sales-tax UI controls + wholesale + the UPS estimator, all money-path-correct (screen = PDF = saved `/quote`+`/invoice` = ShopWorks push must AGREE).

### ✅ Already shipped + safe in production (do NOT redo)
- Legacy DTG builder DELETED (`dtg-quote-builder-legacy.html` + `dtg-quote-builder.js` + `dtg-quote-service.js`); legacy URL 301-redirects to the flagship (`server.js`). (v2026.06.08.21)
- **Tax-EXEMPT bug FIXED** — `recomputeTaxRate()` (dtg-inline-form.js ~2239) zeros exempt customers; `pick()` (~2710) always re-derives. (v2026.06.08.20)
- **PHASE 0 band DONE + verified live** — `quote-order-summary.js` loaded before `dtg-inline-form.js`; `#order-recap`+`#ship-to-card` mounted after `#dtgPriceSummary`; `configure()` in `init()`; `renderBand()` at `renderSummary()` end. (v2026.06.08.22)
- **DTG's tax is CORRECT + SAFE as-is** (exempt + the existing per-address DOR engine). Phases 1/2 are enhancements, not correctness fixes.

### 📦 Phase 1 Chunks A+B are BUILT but UNDEPLOYED — branch `dtg-phase1-wip` (pushed to origin)
`git checkout dtg-phase1-wip` to get them. They add: state flags (`includeTax`/`taxRateOverride`/`isWholesale`); `#include-tax`+`#tax-rate-input`+`#wholesale-checkbox` controls in `#dtgShipToBlock` + CSS; handlers → `recomputeTaxRate()`; wholesale(2203)/opt-out/manual early-return branches in `recomputeTaxRate()` (the single tax authority). **Correct for on-screen + submit + PDF** (all read `state.shipping.taxRate`). ⚠️ **Do NOT deploy A+B without Chunk C** — the saved record would drop the tax (the EMB/SCP desync bug class).

### 🔑 RESOLVED ARCHITECTURE (the blocker, untangled — read before Chunk C)
DTG's manual inline-form **does NOT save sessions itself.** Saving goes through the **CHAT panel's "Save & share link"** button → `handleSaveQuote()` (dtg-quote-page.js ~1391), which reads `aiState.currentPriceQuote` — set ONLY by the AI chat's `parsePriceQuote()` (dtg-quote-page.js:997). The inline-form (`state` in dtg-inline-form.js) **never writes `aiState.currentPriceQuote`** (grep-confirmed). Proof: dtg-inline-form.js:3798 tells the rep *"Open the chat panel (✨ Ask) and click 'Save & share link'"*.

### 🚦 Chunk C — INVESTIGATE THIS FIRST (the real Phase-1 work)
1. **Does `handleSaveQuote` reflect MANUAL inline-form edits at all?** If `aiState.currentPriceQuote` is the AI's original quote and the rep then manually edits rows/qty in the inline-form, the save may persist STALE data — a bug bigger than tax. Trace whether anything syncs the inline-form `state` → `aiState.currentPriceQuote` on edit. If nothing does, that sync is the foundation Chunk C builds on.
2. **Tax bridge (once #1 is understood):** expose the inline-form's live tax for the save. Cleanest: in `dtg-inline-form.js`, whenever `recomputeTaxRate()` runs, write `window._dtgTaxBridge = { taxRate: state.shipping.taxRate, taxAmount, isWholesale: state.customer.isWholesale, includeTax: state.shipping.includeTax }`. Then in `handleSaveQuote`'s `sessionPayload` (dtg-quote-page.js ~1428): keep `TotalAmount = subtotal` (pre-tax — already is), and ADD `TaxRate: window._dtgTaxBridge.taxRate` (DECIMAL like EMB, e.g. 0.101 — NOT percent), `TaxAmount: round(subtotal*taxRate)`, `IsWholesale: window._dtgTaxBridge.isWholesale`. Then `/quote`+`/invoice` reconstruct grand = TotalAmount+TaxAmount and the shared `embroidery-quote-invoice.js` reads the real rate. (1f below — the `computePriceQuoteFromState` tax bridge at dtg-inline-form.js:3816 — feeds the PDF; verify the PDF still foots after.)
3. **VERIFY the full matrix** (below) — screen == PDF == saved == push-preview for each.

### Chunk D (submit wholesale) + E (edit-reload restore) + PHASE 2 (estimator)
See §1h, §1i, §PHASE 2 in the detailed plan below. Phase 2 (estimator + billable shipping) is HIGH risk — it moves the taxed total; do it LAST, after Phase 1's matrix is green.

### Regression matrix (run for Phase 1, re-run with shipping for Phase 2)
pickup(10.1%/2200.101) · in-WA(DOR rate/2200) · out-of-state(0%/2202) · exempt(0%/2204) · **wholesale(0%/2203)** · manual-override(entered%) · include-tax-unchecked(0%) — each: on-screen `#dtgPriceSummary` total == printed PDF GRAND TOTAL == saved `TotalAmount+TaxAmount` == ShopWorks push-preview. Then save → reopen `?edit=DTG…` → rate/account/wholesale survive (don't revert to pickup).

### 📋 Copy-paste pickup prompt for the new session
> Resume DTG parity. Read `memory/DTG_PARITY_ROADMAP.md` (START HERE section). Phase 0 + exempt fix are deployed & safe. Phase 1 Chunks A+B are on branch `dtg-phase1-wip` (tax controls + recomputeTaxRate threading). FIRST: investigate whether `handleSaveQuote` (dtg-quote-page.js) reflects manual inline-form edits (the inline-form never writes `aiState.currentPriceQuote`). Then build Chunk C (save-fidelity: bridge the inline-form's tax to the saved `sessionPayload` via `window._dtgTaxBridge` + add `TaxRate`/`TaxAmount`/`IsWholesale`), then D (submit wholesale + server.js GL-2203 branch), E (edit-reload restore), then Phase 2 (estimator). Run the full regression matrix (screen==PDF==saved==push) before each deploy. Money-path — verify, don't assume.

---

All maps are verified accurate against the live code. The four input maps (TAX/SUMMARY, SHIP/BAND, SAVE/SUBMIT) are correct and internally consistent. I have everything needed to write the plan.

---

# DTG Flagship → EMB/DTF/SCP Parity: 3-Phase Implementation Plan

**Verified pre-conditions (read code, all confirmed):** DTG is id-based like EMB/DTF; the summary panel is 100% JS-rendered in `renderSummary()` (no static tax markup in the HTML); `recomputeTaxRate()` is already the single tax authority with the exempt(2204)/pickup(2200.101)/out-of-state(2202)/DOR branch pattern; `computePriceQuoteFromState()` returns `grandTotal: subtotal` with NO tax; the SAVE in `dtg-quote-page.js` reads `aiState.currentPriceQuote` (decoupled from inline `state`) and the `sessionPayload` has no `TaxRate/TaxAmount/IsWholesale`; `QuoteOrderSummary` is selector-agnostic and must load BEFORE `dtg-inline-form.js`.

All paths absolute under `C:\Users\erik\OneDrive - Northwest Custom Apparel\2025\Pricing Index File 2025\`.

---

## PHASE 0 — Shared "order-at-a-glance" band (Risk: LOW, read-only display)

Pure additive display layer. Reads the DOM live via `_val()`; writes nothing to pricing/tax/save. Cannot move a total. Ship and verify in isolation first.

**Edit 1 — load the module + CSS (`quote-builders/dtg-quote-builder.html`)**
- After the `quote-builder-utils.js` tag (`:198`) and BEFORE `dtg-inline-form.js` (`:202`), add:
  `<script src="/shared_components/js/quote-order-summary.js?v=2026.06.08.X"></script>`
  (Hard requirement — `configure()` runs at eval time inside `dtg-inline-form.js`; if this loads after, `QuoteOrderSummary` is undefined.)
- The band CSS (`.order-recap` / `.ship-to-card` / `.or-*` / `.st-*`) lives in `quote-builder-common.css`, which DTG does NOT load. Pick ONE: (a) add `<link rel="stylesheet" href="/shared_components/css/quote-builder-common.css?v=...">` to the head (`:13-16` block), or (b) copy just the band rules into `dtg-inline-form.css`. Prefer (a) for true parity (single source of CSS truth); audit for class-name collisions with `dtg-*` classes first (grep `.or-`/`.st-` in DTG CSS — expected zero).

**Edit 2 — mount the two band divs (`shared_components/js/dtg-inline-form.js`)**
- In `render()`'s template, immediately after `<div id="dtgPriceSummary" class="dtg-price-summary"></div>` (`:727`) insert:
  `<div class="order-recap" id="order-recap"></div><div class="ship-to-card" id="ship-to-card"></div>`
  (Option A from the SHIP/BAND map — keeps the band with the live total, mirrors SCP's "left-of-totals".)

**Edit 3 — `configure()` call (`shared_components/js/dtg-inline-form.js`)**
- Add a top-level `configure()` block (mirror SCP `screenprint-quote-builder.js:4499-4527`), id-based selectors:
  - `orderRecap: '#order-recap'`, `shipToCard: '#ship-to-card'`
  - `ship: { address:'#dtgShipAddress1', city:'#dtgShipCity', state:'#dtgShipState', zip:'#dtgShipZip', method:'#dtgShipMethod' }` — **omit `fee` and `residential`** (don't exist yet; `fee` arrives in Phase 2).
  - `recap: { company:'#dtgCompanyInput', custNum:'#dtgCompanyId' }` — **omit `name`** (DTG splits first/last; `renderOrderRecap` falls back to company, which is always present for a picked customer). DTG's customer-number IS `companyId`.
  - `logos: () => []` (no recap thumbnail model).
  - No `estimateHooks` yet (Phase 2). No `editOnclick` (DTG has no shipping modal) → Edit button hidden.

**Edit 4 — render hooks (`shared_components/js/dtg-inline-form.js`)**
- Define a guarded local wrapper: `function renderBand(){ if (typeof QuoteOrderSummary!=='undefined') try{ QuoteOrderSummary.renderOrderRecap(); }catch(_){} }`
- Call `renderBand()` at the END of `renderSummary()` (`:1280`) — this single site covers most state mutations (they funnel through `renderSummary()`).
- Add explicit `renderBand()` calls where the band's source fields change but `renderSummary()` may not fire: `pick()` (after the ship pre-fill block ~`:2696-2711`), `applyContact()` (`:3239`), the ship-field `input` handler (`:2191-2208`), the pickup toggle (`:2156-2178`), and `loadSavedDtgQuoteForEdit()` after `renderSummary()` (`:4522`).
- `renderShipToCard()` auto-hides for pickup (its `/pickup|will-call/i` regex), so the pickup toggle correctly blanks the ship card.

**Biggest risk:** script ordering — if `quote-order-summary.js` loads after `dtg-inline-form.js`, `configure()` throws `QuoteOrderSummary is not defined`. **Verify live:** load `/quote-builders/dtg-quote-builder.html`, pick a customer + type a WA ship-to → band shows company/custNum/address; flip to Customer Pickup → ship card hides; reload an existing quote (`?edit=DTG…`) → band paints. Confirm console has zero "QuoteOrderSummary undefined" errors.

---

## PHASE 1 — Tax UI + wholesale + save-fidelity (Risk: MEDIUM — desync hazard) — **THE HEADLINE**

Adds the `#include-tax` / `#tax-rate-input` / `#wholesale-checkbox` controls, a DTG `toggleWholesale`, threads them through ALL tax read-sites, persists `TaxRate`/`TaxAmount`/`IsWholesale`, and restores them on edit-reload.

### 1a. State flags (`shared_components/js/dtg-inline-form.js`, init block ~`:175-231`)
- `state.shipping.includeTax = true` (default on)
- `state.shipping.taxRateOverride = null` (null = auto/DOR)
- `state.customer.isWholesale = false` (mirrors `isTaxExempt` at `:175`)

### 1b. Controls — render from persisted flags in the STATIC ship-to block, NOT inside `renderSummary()`
Per the TAX/SUMMARY map caveat: controls inside `#dtgPriceSummary` get destroyed and lose focus on every re-render. **Use Option (b):** mount the three controls in `#dtgShipToBlock` next to `#dtgTaxStatus` (`:973`), which is built once by `render()` and not rebuilt by `renderSummary()`. Mirror SCP's HTML (`screenprint-quote-builder.html:461/465/474`): `#include-tax` (checkbox, checked), `#tax-rate-input` (number, value reflects `state.shipping.taxRate*100`), `#wholesale-checkbox` (`onchange="..."`). The on-screen tax ROW (`renderSummary` `:1275`) stays display-only and just reflects the computed rate.

### 1c. DTG `toggleWholesale()` (`shared_components/js/dtg-inline-form.js`)
- Set `state.customer.isWholesale = checkbox.checked`.
- Uncheck `#include-tax`, set `#tax-rate-input` to `0` (UI parity with SCP `:3525`).
- Call `recomputeTaxRate()` — do NOT set the rate inline (let the single authority do it).

### 1d. Thread flags into the SINGLE authority — `recomputeTaxRate()` (`:2235`)
This is the desync-proof move: add early-return branches at the TOP of `recomputeTaxRate()`, in priority order, BEFORE the existing exempt check (`:2245`). Each sets `taxRate` + `taxRateSource` + `taxAccount` + `taxAccountName`, calls `renderSummary()`, returns. Because the 3 read-sites already read the post-recompute `state.shipping.taxRate`, **they need ZERO changes**:
1. **Wholesale** (`state.customer.isWholesale`) → `taxRate=0`, source `'wholesale'`, account `'2203'` (per MEMORY: Wholesale→2203), name `'Wholesale'`.
2. **Include-tax opt-out** (`!state.shipping.includeTax`) → `taxRate=0`, source `'tax-opt-out'`.
3. **Manual override** (`state.shipping.taxRateOverride != null`) → `taxRate = override/100`, source `'manual'`; short-circuits the DOR lookup.
- Then the existing exempt(2204)/pickup/out-of-state/DOR chain is unchanged.

### 1e. Control event handlers (`shared_components/js/dtg-inline-form.js`)
- `#include-tax` `change` and `#wholesale-checkbox` `change` and `#tax-rate-input` `input`: each (a) writes the flag/value into `state`, (b) `markDirty()` + `scheduleStateSave()` (pattern at `:2201-2202`), (c) calls **`recomputeTaxRate()`** — NOT `renderSummary()` directly (recompute re-derives `taxAccount`/`taxRateSource` that submit+PDF consume, then re-renders).

### 1f. Bridge tax into `computePriceQuoteFromState()` (`:3747-3780`) — the 4th, easily-missed tax site
Currently returns `grandTotal: subtotal` with NO tax. Add:
```
const taxRate = Number(state.shipping.taxRate) || 0;
const taxAmount = Math.round(subtotal * taxRate * 100) / 100;
// return { ...lineItems..., subtotal,
//   totals: { taxRate, taxAmount, grandTotal: subtotal + taxAmount },
//   grandTotal: subtotal + taxAmount }
```
This is what makes the SAVE see tax (the save reads `currentPriceQuote.totals.grandTotal`). **Without this, sites 1/2/3 agree but the saved total silently drops tax** — exactly the EMB/SCP bug class in MEMORY.

### 1g. Save fidelity (`shared_components/js/dtg-quote-page.js`, `sessionPayload` `:1428-1448`)
The save reads `aiState.currentPriceQuote`, which the inline form never writes. Two-part fix:
- **Bridge state → aiState:** have the manual form populate `aiState.currentPriceQuote = computePriceQuoteFromState()` (now tax-bearing) before save, OR read `state.shipping`/`state.customer` directly in `handleSaveQuote`. Either way the rep's manual tax/wholesale choice must reach the payload.
- **Switch `TotalAmount` to PRE-tax + add the tax columns** (match SCP post-fix shape): persist `SubtotalAmount` (already pre-tax), set `TotalAmount = subtotal` (pre-tax), add `TaxRate: state.shipping.taxRate` (DECIMAL like EMB, e.g. `0.101` — NOT percent), `TaxAmount: taxAmount`, `IsWholesale: state.customer.isWholesale`. So `/quote` + `/invoice` reconstruct `grandTotal = TotalAmount + TaxAmount` and the shared `embroidery-quote-invoice.js` reads the real rate.

### 1h. Submit payload wholesale (`shared_components/js/dtg-inline-form.js` `:3997-4016` + `server.js`)
- Submit already carries `ship.taxRate/taxAccount/...`. Add `info.isWholesale` and ensure `ship.taxAccount='2203'` flows when wholesale. The submit-site redundant out-of-state guard at `:3948` must NOT re-derive — wholesale→0 is already enforced at the writer; keep that site reading `state.shipping.taxRate`.
- **`server.js` Order Form route is net-new work, not a free ride on the trio:** `buildOrderNote()` (`server.js:2062`) + `getTaxAccountForRate` (`:1991-2027`) currently branch only pickup/out-of-state/DOR — grep confirms ZERO `wholesale`/`2203` handling. Add a wholesale branch so the GL-2203 account renders into Notes On Order (still `TaxTotal: 0` per the existing pattern at `:3191`).

### 1i. Edit-reload restore (`shared_components/js/dtg-inline-form.js`, `loadSavedDtgQuoteForEdit()` `:4415-4539`)
Currently restores customer/location/rows but **NONE of shipping/tax/wholesale** → a reopened out-of-state or exempt quote silently reverts to 10.1% Milton pickup. After the customer-restore block (~`:4456`), restore from the saved session: `state.shipping.{method,address1,city,state,zip}`, `state.shipping.taxRate` (from saved `TaxRate`), `state.customer.isWholesale` (from `IsWholesale`), `state.customer.isTaxExempt`. Re-sync the `#include-tax`/`#tax-rate-input`/`#wholesale-checkbox` control values, then call `recomputeTaxRate()` + `renderBand()`. Mirror EMB's edit-reopen restore (the v2026.06.01.10 fix).

**Biggest risk:** **screen / submit / PDF / saved-total desync** — the exact bug class MEMORY flags (EMB/SCP each shipped `includeTax` wired for screen + one path but not all). Mitigation is structural: all rate logic lives ONLY in `recomputeTaxRate()`; the 4 consumers (renderSummary `:1255`, submit `:3946-3951`, PDF `dtgPrintQuote` `:3712`, and the now-tax-bearing `computePriceQuoteFromState` `:3776`→save) read the post-recompute value. **Wire all four or none.**

**Verify live — full regression matrix, screen vs PDF vs saved-record vs ShopWorks-push-preview must agree on grand total for each:**
| Case | Expected rate | Tax account |
|---|---|---|
| Pickup (Milton) | 10.1% | 2200.101 |
| In-WA ship-to (DOR) | DOR city rate | matched 2200 row |
| Out-of-state ship-to | 0% | 2202 |
| Tax-exempt customer | 0% | 2204 |
| **Wholesale checkbox** | 0% | **2203** |
| Manual rate override | entered % | manual (note) |
| Include-tax unchecked | 0% | — |

For each: confirm on-screen `#dtgPriceSummary` total == printed PDF GRAND TOTAL == saved `TotalAmount + TaxAmount` == push-preview total. Then save → reopen via `?edit=` → confirm rate/account/wholesale survive (don't revert to pickup).

---

## PHASE 2 — Estimator + billable shipping (Risk: HIGH — moves the taxed total)

Adds the UPS-Ground estimator + a billable shipping-fee field. **High risk because shipping is taxable in WA (WAC 458-20-110) and changes the tax BASE** — the `recomputeTaxRate()` header at `:2231-2234` explicitly flags that today DTG sends `cur_Shipping: 0` and the base is subtotal-only.

### 2a. Shipping-fee field (`shared_components/js/dtg-inline-form.js` + state)
- Add `#dtgShipFee` input inside `#dtgShipToBlock` and `state.shipping.fee = 0` in the init block. Add `#dtgEstimateShipBtn` + `#dtgEstimateShipResult` next to it.

### 2b. Wire estimator into the Phase 0 `configure()` block
- Add `ship.fee: '#dtgShipFee'` to the now-existing field (was omitted in Phase 0).
- Add `estimateHooks`:
```js
estimateHooks: {
  collectProducts: () => state.rows
    .filter(r => r.style && !isRowColorInvalid(r))
    .map(r => ({ style:r.style, color:r.color, catalogColor:r.catalogColor, sizeBreakdown:r.sizes })),
  onApplied: () => { recomputeTaxRate(); renderSummary(); renderBand(); },
  btn: '#dtgEstimateShipBtn', result: '#dtgEstimateShipResult',
}
```
- Reuse `isRowColorInvalid(r)` (`:451`) so the estimator's product list matches the priced rows (same filter `combinedQty()` `:427` uses). The module needs `{style, sizeBreakdown}` — `sizeBreakdown: r.sizes` matches SCP's `collectProductsFromTable`.

### 2c. Fold the fee into ALL four total/tax sites (the dangerous part)
The fee must enter the **tax base** AND the **total** at every site, consistently — partial wiring re-creates the desync, now on the taxed base:
1. **Screen** `renderSummary()` (`:1255-1256`): `const base = subtotal + (Number(state.shipping.fee)||0); taxEstimate = round(base*rate); grandTotal = base + taxEstimate;` Add a Shipping row to the totals block.
2. **Submit** (`:3946-3951`): change `taxEstimate` base from `subtotal` to `subtotal + fee`; send the real fee in `body` (currently `cur_Shipping: 0` server-side at `server.js:3191` — must now carry the fee, and the server tax/total must account for it).
3. **PDF** `computePriceQuoteFromState()` (`:3770-3776`) + `dtgPrintQuote()` (`:3712`): add fee to the base; the shared invoice generator already has a Shipping row (the v2026.06.01.10 EMB fix added it) — pass the fee so it foots.
4. **Save** (`dtg-quote-page.js` `:1428`): add `ShippingFee` to `sessionPayload`; `TotalAmount` (pre-tax) becomes `subtotal + fee`; `TaxAmount` recomputed on `(subtotal + fee) * rate`.
- Edit-reload (Phase 1i) must also restore `state.shipping.fee` and re-sync `#dtgShipFee`.

**Biggest risk:** **the taxed total now moves with the fee, and the fee must be added to the tax base at all 4 sites identically.** Miss one (e.g. fee in the displayed total but not the tax base, or in screen but not the saved record) and you ship a wrong-tax/wrong-total quote — worse than Phase 1 because the error is now in the dollar amount the customer pays. Also the `server.js` Order Form route must stop hardcoding `cur_Shipping: 0`.

**Verify live:** add multi-style rows → click Estimate → fee populates `#dtgShipFee`; confirm on-screen total = subtotal + fee + tax-on-(subtotal+fee). Re-run the full Phase 1 regression matrix WITH a non-zero shipping fee in each tax case — screen == PDF == saved == push-preview. Specifically check a taxable WA case (fee IS taxed) vs an out-of-state case (fee present, tax still 0). Reopen via `?edit=` → fee survives.

---

## Sequencing / deployability
- **Phase 0** is independently shippable and reversible (display-only; cannot affect a price).
- **Phase 1** is the headline and independently shippable on top of 0 — but its 4 tax sites + the `server.js` wholesale branch must land together (all-or-none).
- **Phase 2** depends on Phase 1's `recomputeTaxRate` threading and the band's `ship.fee` slot; ship last, behind the heaviest verification.

**Cross-cutting must-dos (CLAUDE.md):** `?v=` cache-bust on every shared file touched (`quote-order-summary.js`, `quote-builder-common.css`, `dtg-inline-form.js`); update `ACTIVE_FILES.md`; no hardcoded API URLs (estimator already uses `APP_CONFIG.API.BASE_URL` via `_apiBase()`); append a LESSONS_LEARNED entry after the Phase 1 desync work (it's the recurring `includeTax`-partial-wiring bug). Wholesale GL is **2203** (MEMORY), exempt **2204**, out-of-state **2202**, pickup **2200.101** — already the DTG convention.
---
## STATUS (2026-06-08)
- ✅ Legacy DTG builder DELETED (v2026.06.08.21) — dtg-quote-builder-legacy.html + dtg-quote-builder.js + dtg-quote-service.js; 301 redirect added. dtg-quote-pricing/products/system.js flagged as dead-code candidates (not deleted).
- ✅ DTG tax-EXEMPT bug FIXED + live (v2026.06.08.20) — recomputeTaxRate zeros exempt + pick() always re-derives.
- ✅ PHASE 0 (band) DONE + verified live (v2026.06.08.22) — quote-order-summary.js loaded before dtg-inline-form.js; #order-recap+#ship-to-card mounted after #dtgPriceSummary; configure() at init() (ship=#dtgShip*, recap=#dtgCompanyInput/#dtgCompanyId); renderBand() at renderSummary() end; band CSS in dtg-inline-form.css. NO estimator/edit buttons (Phase 1/2 pending).
- ⏳ PHASE 1 (tax UI + wholesale + save-fidelity) — NOT STARTED. The headline. See plan above (1a-1i). MONEY-PATH: the 4 tax sites (renderSummary/submit/PDF/computePriceQuoteFromState) + save (TaxRate/TaxAmount/IsWholesale) + edit-reload + server.js wholesale→2203 branch must land together. Regression matrix: pickup/in-WA/out-of-state/exempt/wholesale/manual/opt-out × screen==PDF==saved==push.
- ⏳ PHASE 2 (estimator + billable shipping) — NOT STARTED. High risk (moves the taxed total). See plan above (2a-2c).

## PHASE 1 PROGRESS (2026-06-08)
- ✅ Chunks A+B BUILT (branch `dtg-phase1-wip`, NOT deployed): state flags (includeTax/taxRateOverride/isWholesale); #include-tax + #tax-rate-input + #wholesale-checkbox controls in #dtgShipToBlock + CSS; handlers → recomputeTaxRate(); wholesale(2203)/opt-out/manual early-return branches in recomputeTaxRate (the single authority). Correct for on-screen + submit + PDF (all read state.shipping.taxRate).
- 🛑 BLOCKER for Chunk C (save-fidelity): `handleSaveQuote` (dtg-quote-page.js ~1428) reads `aiState.currentPriceQuote`, set ONLY from the AI chat's `parsePriceQuote` (dtg-quote-page.js:997). The manual inline-form (`state`) NEVER writes `aiState.currentPriceQuote` (grep-confirmed). So the manual quote's tax/wholesale choice does NOT reach the saved sessionPayload. **Chunk C MUST first find/build the manual-save bridge** (how does a MANUAL DTG quote currently reach handleSaveQuote? — the inline-form save trigger needs tracing) before adding TaxRate/TaxAmount/IsWholesale to the payload (1g) + the computePriceQuoteFromState tax bridge (1f, dtg-inline-form.js:3816).
- ⚠️ DO NOT deploy Chunks A+B alone — on-screen/submit would show the controls' tax but the saved /quote+/invoice would drop it (the EMB/SCP desync bug class). All-or-none with Chunk C.
- ✅ Production today: DTG tax is CORRECT + SAFE as-is (exempt fix v…20 + the existing engine + Phase 0 band v…22). Phase 1 controls are a UI enhancement, not a correctness fix.
