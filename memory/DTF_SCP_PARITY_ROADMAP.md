# DTF + SCP → EMB Flagship: Order-Summary Parity Roadmap

## ✅ PROGRESS
- **Phase 0 — DONE + verified live (2026-06-08, v2026.06.08.1).** Created `shared_components/js/quote-order-summary.js` (Order Recap + Ship-To card + `getShipFields()` accessor; selector-agnostic via `QuoteOrderSummary.configure()`). EMB rewired to configure it; output byte-identical. De-scoped `.ship-to-card` shell → shared. Locked by `tests/unit/quote-order-summary.test.js`.
- **Phase 2 (DTF band) — DONE + verified live + adversarial-review-clean (2026-06-08, v2026.06.08.4).** DTF adopts the recap + ship-to card, stacked in the Quote Summary sidebar (Option A — zero pricing risk: two `:empty`-hidden divs). `configure()` with DTF selectors (fee=`#dtf-shipping-fee`; no shippingDisplay/logos/estimator). renderOrderRecap wired on customer pick/clear, all ship-field edits, recalc (updateTaxCalculation), edit-reload (populateCustomerInfo), reset, AND restoreDraft (review-caught stale-recap gap). Module's Re-estimate button gated on `_cfg.estimate` (DTF has none; EMB byte-identical). +`.dtf-builder` band CSS. 1009 tests. **Re-sequenced BEFORE Phase 1 for visible value.**
- **Phase 3 (SCP band) — DONE + verified live + adversarial-review-clean (2026-06-08, v2026.06.08.6).** SCP adopts the recap + ship-to card. **Selector-agnostic design VALIDATED:** `configure()` uses `.os-ship-*` CLASS selectors SCOPED to `#spc-order-fields` (e.g. `#spc-order-fields .os-ship-zip`, fee `.os-shipping-fee`) — the SAME shared module now drives both `#ship-*` (EMB/DTF) and `.os-ship-*` (SCP). Ship-field render hooks are SCP-LOCAL listeners (shared `quote-builder-utils.js` NOT touched — protects EMB/DTF/Order Form). renderOrderRecap wired on customer pick/clear, all `.os-ship-*` edits, fee, recalc (updatePricingDisplay), edit-reload (setOrderShippingData), reset, draft. Review-caught reset gap FIXED: `setOrderShippingData({})` is a no-op for blanking (shared setter guards `if(el&&val)`), so resetQuote now blanks the scoped fields explicitly (state→WA, fee→0) → card clears on New Quote (verified live). +`.scp-builder` band CSS. 1014 tests.
- **✅ ORDER-SUMMARY BAND PARITY COMPLETE across EMB + DTF + SCP.**
- **✅ PRODUCTION-READINESS (audit `wo2slacjf` punch list) — Commits 1-3 DONE (2026-06-08, FE v2026.06.08.10 + proxy `d585167`). DTF + SCP now price correctly for EVERY tax scenario + route to the right GL — the audit's "production-ready" bar.**
  - **P0-1 tax-exempt (DTF+SCP, v…8):** `applyContact` reads `contact.Is_Tax_Exempt` → zeros tax (was billing exempt customers WA tax — CRM chip was cosmetic). **P0-completion (v…9, adversarial-review `wipu9vuvg` found 4 more):** the `TaxRate: parseFloat||10.1` falsy trap stored 10.1% for exempt (mirror+push re-taxed) → `Number.isFinite` guard in BOTH services + SCP `updateTaxCalculation`; SCP edit-reload now restores the saved rate; DTF `onShipStateChange` now guards on `_taxExempt`/`_isWholesale`. **P0-2/3 DTF double-tax (v…8):** `saveQuote`/`updateQuote` double-taxed the tax-inclusive total at hardcoded 0.101 → store pre-tax all-in (`SubtotalAmount=TotalAmount=preTaxSubtotal`), TaxAmount from real rate honoring include-tax (mirror EMB).
  - **Wholesale (Commit 3):** backend `resolveTaxAccount({taxRate,shipState,isWholesale})` + `isWholesaleSession` in `manageorders-emb-config.js` route per-order `IsWholesale`→GL **2203** (DTF+SCP transformers import from emb-config; +16 jest). Frontend: `#wholesale-checkbox` + `toggleWholesale()` + `IsWholesale` persisted (both services, create+update) + edit-reload restore + reset-clear (mirror EMB). Verified live (toggle ON→rate 0/include-tax off; OFF→restores).
- **✅ SHIPPING ESTIMATOR (Commits 4-6) — DONE + verified live (2026-06-08, v2026.06.08.12).** Extracted `estimateShipping` + `perBoxForCategory` (box-math LIFTED BYTE-FOR-BYTE) + box-density into `quote-order-summary.js`, parameterized via `_cfg.estimateHooks{collectProducts,onApplied,btn,result}` + `getShipFields()` + `_cfg.ship.fee` (write). `configure()` auto-points `_cfg.estimate` at the module estimator (ship-to card Re-estimate auto-lights). **SAFE EMB choice: EMB's own estimator is UNTOUCHED (Option B — zero regression risk on a money path); EMB keeps its private copy, DTF/SCP use the module's byte-identical one.** DTF: 'Estimate UPS Ground' button + `#ship-residential`, products remapped `{styleNumber,quantities}→{style,sizeBreakdown}`. SCP: button as `#spc-order-fields` sibling (no shared-util change), `collectProductsFromTable` (module's `p.style` guard skips service rows), `onApplied=recalculatePricing`, scoped `.os-shipping-fee` write. Locked by 4 jest box-math cases. **Verified LIVE: DTF + SCP both compute $16.55 / 17 lb / 1 box / zone 2 for a PC54 (42 pc) order → ZIP 98201; SCP's scoped fee write works.** 1018 tests.
- **🎉 DTF + SCP FLAGSHIP PARITY COMPLETE.** Full feature set now matches EMB: Option C page-flow, Order Recap + Ship-To card, shipping estimator + Re-estimate, correct tax (standard/out-of-state/exempt/wholesale) + GL 2203 routing, ShopWorks push. Remaining = optional Phase 5 polish only (visual sweep at breakpoints, EMB estimator DRY-rewire if ever desired with a full regression gate, SCP toggle-OFF DOR re-fetch). Punch list: `C:\Users\erik\AppData\Local\Temp\punchlist.md`.
- **✅ FINAL CERT (www9dc1la) → 2 pre-existing P1 pricing bugs FIXED + verified live (v2026.06.08.13/.14).** (1) **Non-idempotent `updateTaxCalculation`** (DTF+SCP) double-added fees+shipping on a 2nd direct call (tax-rate/fee/include-tax change) → inflated screen+PDF. Fixed: recalc owns a stable `#pre-tax-subtotal` `data-base` attr; tax-calc only reads it. VERIFIED LIVE (3× = $116.55, was $133.10). (2) **SCP saved-mirror dropped shipping** (under-charge): no SHIP line item → `getShippingFee` returned 0. Fixed: `_saveShipFeeItem` writes `StyleNumber='SHIP'`/`EmbellishmentType='fee'` in both save paths (mirror EMB). +resets now clear residential/estimate state. Both patterns → LESSONS_LEARNED 2026-06-08.
- **✅ RE-CERT (wo7g90h4e) → 3rd SCP shipping-tax bug FIXED (v2026.06.08.15).** The SHIP-row fix exposed it: SCP saved `TaxAmount` taxed `preTaxTotal` EXCLUDING shipping, and `/invoice` (invoice.js:795) TRUSTS the saved value → under-charged WA tax on shipping ($30 ship × 10.1% = $3.03 short) on every SCP quote with shipping; on-screen/PDF/`/quote` recompute tax on base+shipping so `/invoice` silently disagreed. Fixed: saved `TaxAmount` now taxes `(base + shippingFee)` in both save paths (screenprint-quote-service.js:93/394), mirroring EMB. DTF already correct (bakes shipping into the taxed total). SCP tax is computed on 5 surfaces (on-screen / PDF / saved / `/quote` / `/invoice`) — final tax-consistency audit (wkyypsd3a) verifying all agree across standard/exempt/wholesale/out-of-state × shipping.

**Derived from live source (2026-06-07).** The 3 audit inputs arrived null, so current-state was reverse-engineered from `embroidery-quote-builder.{js,html}` (flagship), `dtf-quote-builder.{js,html}`, `screenprint-quote-builder.{js,html}`, `quote-builder-utils.js`, and the band CSS. Reference architecture doc: `memory/quote-builder-architecture.md`.

**Core problem:** the EMB order-summary band (recap + ship-to card + estimator + footer) and ALL its supporting JS/CSS live in **EMB-only files** (`embroidery-quote-builder.js`, `embroidery-quote-builder-extracted.css`). DTF and SCP also use **two different ship-to field conventions** — DTF is id-based (`#ship-zip`), SCP is the shared `.os-ship-*` class panel. Any port must therefore be **selector-agnostic** and **promoted to shared files**, not copied.

---

## 1. GAP MATRIX

Cells: **✅ present** · **◑ partial** · **✗ absent**

| Dimension | EMB (ref) | DTF | SCP |
|---|:---:|:---:|:---:|
| `.invoice-totals-wrap` totals box (Subtotal/Tax/Total) | ✅ | ✅ | ◑ (own pricing-summary, not the shared band) |
| Shipping row **as modal button** (`#it-shipping-amt` → `openShippingModal`) | ✅ | ✗ (inline `#dtf-shipping-fee`) | ✗ (`.os-shipping-fee` in panel) |
| `#order-recap` "Order at a glance" (customer/ship/logos) | ✅ | ✗ | ✗ |
| Logo/design **thumbnails** in recap | ✅ | ✗ (n/a — no logo model) | ✗ (n/a) |
| `#ship-to-card` recap card (destination + re-estimate/edit) | ✅ | ✗ | ✗ |
| `estimateShipping()` UPS-Ground prepay button + box-density | ✅ | ✗ (manual only) | ✗ (manual only) |
| `openShippingModal()` shipping modal | ✅ | ✗ | ✗ |
| `relocateOrderFooter()` bottom footer band (order details + notes) | ✅ | ✗ | ✗ |
| Ship-to address fields | ✅ id-based `#ship-*` | ◑ id-based `#ship-*` (+`#dtf-shipping-fee`) | ◑ class-based `.os-ship-*` (shared panel) |
| ZIP → tax-rate lookup | ✅ (own) | ◑ (id-based) | ✅ (`initOrderShippingListeners`, shared) |
| Wholesale / tax-exempt checkbox in band | ✅ | ✗ | ✗ |
| Tax % editable in band (`#tax-rate-input`) | ✅ | ✅ | ✅ |
| Residential surcharge toggle (`#ship-residential`) | ✅ | ✗ | ✗ |
| PDF/invoice generator (shared `embroidery-quote-invoice.js`) | ✅ | ✅ | ✅ |
| Push-to-ShopWorks parity | ✅ (richest) | ✅ | ✅ |
| Selector convention | `#ship-*` | `#ship-*` | `.os-ship-*` ⚠ |

**The two structural blockers:** (a) recap/ship-card/estimator/footer code is EMB-private; (b) SCP and DTF disagree on selector namespace, so a naïve port would need writing twice.

---

## 2. PHASED ROADMAP

> Sequencing principle from the manifest: **structure is SHARED, content is per-method. ADOPT, don't COPY.** Extract EMB's band into a shared module that reads a small per-builder **selector/config map**, then have DTF + SCP adopt it.

### Phase 0 — Reconcile selectors + extract the shared band module *(do FIRST)*
**Goal:** one source of truth for the order-summary band that works regardless of `#ship-*` vs `.os-ship-*`, with zero behavior change to EMB.

- **Shared (`quote-builder-utils.js` + `quote-builder-common.css`):**
  - Add a `ShipFieldAccessor` (or `getShipFields(scope)`) selector-agnostic helper: pass a config `{address, city, state, zip, method, fee, residential}` of selectors; all band code reads/writes through it. This is the keystone — `renderShipToCard()` and `estimateShipping()` currently hardcode `document.getElementById('ship-zip')` etc.
  - Move `renderOrderRecap()`, `renderShipToCard()`, `reestimateShipFromCard()`, `relocateOrderFooter()` out of `embroidery-quote-builder.js` into a new shared module `shared_components/js/quote-order-summary.js` (parameterized by the accessor + a per-builder `recapConfig` that supplies the logo/thumbnail rows — EMB supplies logos, DTF/SCP supply none).
  - Move `.order-recap / .ship-to-card / .st-* / .or-* / .order-footer / .in-footer / .footer-notes-row` rules from `embroidery-quote-builder-extracted.css` into `quote-builder-common.css`.
- **EMB:** rewire to call the shared module via an accessor mapping its `#ship-*` ids + a `recapConfig` that emits logos/thumbs. **Net behavior unchanged** (regression guard).
- **Effort:** **L** · **Risk:** Med (EMB is live — must not regress the flagship; lock with a visual snapshot before/after). · **Deps:** none.

### Phase 1 — Shared shipping estimator + modal + box-density
**Goal:** the UPS-Ground prepay estimator and the shipping modal become shared, callable by any builder.

- **Shared (`quote-order-summary.js`):** move `estimateShipping()` + `perBoxForCategory()` + box-density fetch/cache (`window._boxDensity`, `window._shipWtCache`) and `openShippingModal()` markup/logic out of EMB. Estimator must read products via a per-builder `collectProducts()` callback (EMB has `collectProductsFromTable()`; DTF/SCP pass their own) and write the fee via the accessor.
- **EMB:** delete its private copies, call shared. Verify estimate value unchanged on a known order.
- **Effort:** **M** · **Risk:** Med (weight/box math is money-adjacent — diff against EMB output on 2–3 fixed orders). · **Deps:** Phase 0 accessor.

### Phase 2 — DTF adopts the band
**Goal:** DTF gets recap + ship-to card + estimator + modal + footer.

- **DTF (`dtf-quote-builder.{js,html}`):**
  - Add `#order-recap`, `#ship-to-card` inside `.invoice-totals-wrap`; replace inline `#dtf-shipping-fee` with the shared shipping-row modal button (or keep the input but add the modal as the editor).
  - Provide accessor config mapping DTF's existing `#ship-*` ids + `#dtf-shipping-fee`; provide `collectProducts()` + an empty `recapConfig` (no logos) — recap shows Customer + Shipping only.
  - Call `relocateOrderFooter()` (DTF has order details + notes blocks to relocate — confirm IDs).
- **Effort:** **M** · **Risk:** Low-Med (DTF already id-based — closest to EMB). · **Deps:** Phases 0–1.

### Phase 3 — SCP adopts the band (selector bridge)
**Goal:** SCP gets the same band despite using `.os-ship-*`.

- **SCP (`screenprint-quote-builder.{js,html}`):**
  - Add `.invoice-totals-wrap` band markup with `#order-recap` + `#ship-to-card` (SCP currently has NO order-at-a-glance band — only the `.os-*` collapsible panel + a separate pricing-summary).
  - Provide accessor config pointing at `.os-ship-address/.os-ship-city/.os-ship-state/.os-ship-zip/.os-ship-method/.os-shipping-fee` (scoped to `#spc-order-fields`). **This is the payoff of the Phase-0 accessor** — no band code changes, only the config.
  - Decide: keep the `.os-*` panel as the *editor* (the modal becomes optional for SCP) OR fold the panel into the shared modal. Recommend: keep `.os-*` panel as editor short-term; wire estimator + recap + ship-to card on top.
- **Effort:** **M-L** · **Risk:** Med (selector divergence + SCP has the least existing scaffolding). · **Deps:** Phases 0–2 (DTF proves the adopt path first).

### Phase 4 — Tax/exempt + residential parity
**Goal:** match EMB's tax-band controls everywhere.

- **Shared/per-builder:** add the **Wholesale / tax-exempt** checkbox + the **residential surcharge** toggle to DTF + SCP bands; ensure exempt unchecks tax and zeros rate (mirror EMB). Confirm DTF's id-based tax lookup and SCP's shared `initOrderShippingListeners` both feed the band's `#tax-rate-input`.
- **Effort:** **S-M** · **Risk:** Low-Med (money — verify exempt/out-of-state totals on save + PDF + push). · **Deps:** Phase 2/3.

### Phase 5 — Polish + lock
**Goal:** prevent drift; certify.

- Visual sweep at 1024/768/480 across all 3; confirm `:empty` hide behavior, footer relocation, thumbnails (EMB only).
- Add a jest/snapshot lock on `quote-order-summary.js` render output per builder config.
- Update `memory/quote-builder-architecture.md` change-routing table: move recap/ship-card/estimator/modal/footer rows to **SHARED**. Update `ACTIVE_FILES.md` + `shared_components/js/GUIDE.md` for the new `quote-order-summary.js`.
- **Effort:** **S** · **Risk:** Low. · **Deps:** all.

---

## 3. KEY SHARED-vs-PER-BUILDER DECISIONS

1. **Selector-agnostic accessor is the linchpin (Phase 0).** EMB's `renderShipToCard()`/`estimateShipping()` hardcode `getElementById('ship-zip'|'ship-method'|'shipping-fee')`. SCP uses `.os-ship-*` (scoped to `#spc-order-fields`), DTF uses `#ship-*` + `#dtf-shipping-fee`. **Refactor all band reads/writes through a `{selector}` config object** so the same module serves all three. Without this, the band is ported 3× and drifts immediately (exactly the anti-pattern the manifest warns against).

2. **What MOVES to shared:**
   - **`quote-order-summary.js` (new):** `renderOrderRecap`, `renderShipToCard`, `reestimateShipFromCard`, `relocateOrderFooter`, `estimateShipping`, `perBoxForCategory`, box-density fetch/cache, `openShippingModal`. All currently EMB-private.
   - **`quote-builder-common.css`:** `.order-recap`, `.ship-to-card`, `.st-*`, `.or-*`, `.order-footer`, `.in-footer`, `.footer-notes-row` (currently in `embroidery-quote-builder-extracted.css`).
   - **`quote-builder-utils.js`:** the `ShipFieldAccessor`/`getShipFields(config)` helper (sits next to the existing `getOrderShippingData`/`setOrderShippingData` `.os-*` functions).

3. **What STAYS per-builder (content/config, not structure):**
   - `recapConfig` — EMB supplies logo rows + design thumbnails (`primaryLogo`/`capPrimaryLogo`); DTF/SCP supply none. The recap renders only the rows its config provides.
   - `collectProducts()` callback for the estimator (each builder reads its own product table).
   - The pricing engine, location/artwork UI, and `{method}-pricing-service.js` — untouched.

4. **Don't drag EMB-only fields along.** The recap's logo/thumbnail block must be config-gated, not hardcoded — DTF/SCP have no logo model. This is the "ADOPT don't COPY" rule: extract the structural shell, let each builder feed its own content.

5. **DTG stays out of scope** (inline-form architecture; manifest rule #4 — leave it).

6. **SCP `.os-*` panel decision:** keep it as the shipping *editor* (it already has ZIP→tax lookup via `initOrderShippingListeners`) and layer recap + ship-to card + estimator on top, rather than rip it out for the modal. Lower risk, reuses working tax wiring.

---

## 4. RECOMMENDED SEQUENCE + "DO THIS FIRST"

**Sequence:** Phase 0 → 1 → 2 (DTF) → 3 (SCP) → 4 → 5. DTF before SCP because DTF is already id-based (`#ship-*`, like EMB) so it proves the adopt-path with minimal selector friction; SCP then validates the accessor against the *other* namespace (`.os-ship-*`), which is the real generality test.

**DO THIS FIRST (Phase 0, single starting commit):**
> In `embroidery-quote-builder.js`, replace every hardcoded `document.getElementById('ship-zip'|'ship-city'|'ship-state'|'ship-method'|'shipping-fee'|'ship-residential')` inside `renderShipToCard`, `renderOrderRecap`, and `estimateShipping` with calls to a new `getShipFields(EMB_SHIP_CONFIG)` accessor; then physically move those functions (+ `relocateOrderFooter`, `reestimateShipFromCard`) into a new shared `shared_components/js/quote-order-summary.js` and the `.order-recap/.ship-to-card/.st-*/.or-*/.order-footer` CSS into `quote-builder-common.css`. **Acceptance: EMB renders byte-identical before/after** (snapshot the `#order-recap` + `#ship-to-card` innerHTML and an estimate value on one fixed order). This extraction with zero EMB behavior change unblocks every later phase and is where regression risk is lowest to catch.

---

**Files in play (all absolute):**
- Flagship JS: `C:\Users\erik\OneDrive - Northwest Custom Apparel\2025\Pricing Index File 2025\shared_components\js\embroidery-quote-builder.js` (recap/ship-card/estimator/footer at lines ~1930-2042, ~6244-6332)
- Flagship HTML band: `...\quote-builders\embroidery-quote-builder.html` (`.invoice-totals-wrap` ~565-604)
- Shared utils + `.os-*` panel: `...\shared_components\js\quote-builder-utils.js` (~1000-1287)
- Shared CSS target: `...\shared_components\css\quote-builder-common.css`
- EMB CSS to drain: `...\shared_components\css\embroidery-quote-builder-extracted.css`
- DTF: `...\shared_components\js\dtf-quote-builder.js`, `...\quote-builders\dtf-quote-builder.html`
- SCP: `...\shared_components\js\screenprint-quote-builder.js` (band wiring ~644-968, 3424-4004), `...\quote-builders\screenprint-quote-builder.html` (`#spc-order-fields` line 540)
- New file to create: `...\shared_components\js\quote-order-summary.js`
- Routing doc to update: `...\memory\quote-builder-architecture.md`