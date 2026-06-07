Based on my reconciliation of the five adversarial verification reports against the cross-cited code evidence, here is the lead-engineer final verdict.

---

# FINAL TO-100 VERDICT — Embroidery Quote Builder (16-Fix Batch + Tail)

The five adversarial passes agree on substance. Where they diverge, the divergence is in **scope/coverage of a single fix (B8)** and **framing of one regression (C8 vs A3)** — both reconciled below by strongest evidence.

---

## 1. NEW-FIX VERDICT — all 16 confirmed; one carries an under-coverage gap

**15 of 16 fixes are correct, complete, and regression-free.** The 16th (**B8**) has a correct core but **two incomplete-coverage defects** that one pass (the money-pricing reviewer) proved end-to-end and the others missed — these are real and money-relevant.

| Fix | Verdict | Net |
|---|---|---|
| A1 (tax-rate SQLi) | ✅ CORRECT | `sanitizeAccountNumber` → `safeId` in WHERE (PUT 342, DELETE 386); raw id only in logs. Injection closed. |
| A2 (dup-QuoteID read, 3 surfaces) | ✅ CORRECT | proxy `orderBy=PK_ID DESC` (455, cache-key order-safe) + FE reduce-to-max-PK_ID + server.js prefer-pushed. Split-brain closed. |
| A3 (AL/DECG priceError gate) | ✅ CORRECT | flags on `!cache`/throw/`unit<=0`; save gate blocks (7475-7480). See DECG over-block under §2. |
| A4 (DGT→DD normalize) | ✅ CORRECT | aliases (199-201) → KNOWN_FEE_PNS hit → bills as line not Note. Under-bill closed. |
| A5 (getByCustomerId) | ✅ CORRECT | `/by-customer/:id`, `sanitizeId` numeric-guarded; change-listener stale-await + `_restoringQuote` guarded. |
| A6 (exact-email attach) | ✅ CORRECT | exact-match `find` else `{}` + toast. Wrong-account fill closed. |
| B3 (preview Designs) | ✅ CORRECT | existing/new design render, all `escapeHtml`'d incl. img src. |
| B4 (demoted-fee warn) | ✅ CORRECT | `/^Order notes:/i` matches transformer's exact prefix + object shape. |
| B5 (push-lock) | ✅ CORRECT | 3 layers (showPushButton resetPushed + confirm guard + server 409). Residual new-quote→resave edge is server-backstopped. |
| B6 (discountReason XSS) | ✅ CORRECT | `this.esc()` at 1543; 5-entity escaper. |
| **B8 (tax-exempt persist)** | ⚠️ **CORE OK, 2 GAPS** | See §2 R1/R2 — both MONEY, both fixable now. |
| B9 (% label taxBase) | ✅ CORRECT | label-only; dollars unchanged. |
| B10 (invoice project) | ✅ CORRECT | `esc()`'d, EMB-only by data, no breakage in other 3 builders. |
| B11 (email regex) | ✅ CORRECT | runs before artwork guards; won't block legit edit-reload saves. |
| C1 (writeLimiter) | ✅ CORRECT (comment imprecise) | mounted before routers; registration-order coverage holds. Mount path is `/api`, and the `/preview` GET IS covered — the prose overstating "never read traffic" is cosmetic. |
| C8 (AL backstop) | ✅ CORRECT (was inert) | now DOM-probes A3's `[data-price-error]` flag instead of the undefined `hasAdditionalLogos()`. See §2 for its LOW button-re-enable regression. |

**Most urgent flag:** B8's two gaps (§2) are the only items in the batch that can silently mis-charge tax. Everything else is sound.

---

## 2. REGRESSIONS introduced/left by this batch — apply-ready

Three real regressions. **B8-R1 and B8-R2 are MEDIUM/MONEY; C8 and DECG-over-block are LOW/fail-closed.**

### [B8-R1 · MEDIUM · MONEY] Exempt→non-exempt direct re-select suppresses the new customer's tax
`embroidery-quote-builder.js:1731` calls `lookupTaxRate()` while `window._taxExempt` still holds the **prior** exempt customer's `true` (not updated until 1736) → forces 0% on a new **non-exempt** customer. Fires only in Ship mode with no clear between selects; self-heals on next ZIP/state edit. **Under-charges in that window.**
**Fix (verified safe — lines 1737-1743 read the local `_taxExempt`, not the window flag):** move `window._taxExempt = _taxExempt;` from **1736** to immediately **before** the `if (!_isPickup)` at **1725** (after the local `_taxExempt` is computed at 1724); delete the old 1736 line.

### [B8-R2 · MEDIUM · MONEY] Edit-reload of a saved tax-exempt quote leaves `window._taxExempt` falsy
Reload block (962-965) restores the include-tax checkbox from `taxExempt = !taxFeeItem && !(TaxRate>0)` but **never sets `window._taxExempt`** → a later Pickup→Ship `setShipMode('ship')` re-applies WA tax to an exempt reloaded quote. This is the exact bug B8 targets, unfixed for the reload path.
**Fix (verified safe):** in the `if (includeTaxEl)` block, after line **964**, add `window._taxExempt = taxExempt;` (place just below the block so it lands even if the element were absent — it always exists today). **Couple with B7 — same reload customer-restore block. Do NOT defer this half with B7's cosmetic half.**

### [C8 · LOW · fail-closed, gated harmless] al-pricing backstop force-enables Push/Save in the no-failed-AL branch
`embroidery-quote-pricing.js:1996-1999` sets `btn.disabled=false` on **every** matched button — including `#emb-push-shopworks-btn` and `.btn-save-quote` — overriding B5's `_pushAlreadyDone` "Sent ✓" lock and the blank-Customer# gate. **Confirmed NOT a dup-push/$0 hole:** the downstream gates fire independent of `button.disabled` (A3 save-gate 7475-7480, B5 confirm guard 8136, `_pushInFlight` re-entrancy, server 409), and `updatePushButtonState()` re-corrects on next input. Cosmetic only.
**Fix:** in the no-failed-AL branch, skip the gated controls and let their owner re-assert. Rewrite as `for…of` (so `continue` works) or use `return` in the `forEach` callback:
```js
const alFailed = document.querySelector('#product-tbody tr.service-product-row[data-al-priced="true"][data-price-error="true"]');
if (alFailed) { btn.disabled = true; }
else if (btn.id === 'emb-push-shopworks-btn' || btn.classList.contains('btn-save-quote')) { return; } // owner re-asserts
else { btn.disabled = false; btn.style.opacity='1'; btn.style.cursor='pointer'; btn.title=''; }
```
then after the loop: `if (typeof updatePushButtonState === 'function') updatePushButtonState();`

### [A3-DECG · LOW · fail-closed] syncDECGRows over-blocks manual-override DECG rows when the API is down
`embroidery-quote-builder.js:6013` flags **every** DECG row `priceError='true'` on `!cache`; the manual-override skip (`sellPrice>0`) only runs inside the cache-present loop (6016). So an API outage blocks a **manually-priced** DECG row from saving. `syncALRows` has no manual-override concept → DECG-only. Fail-closed (over-blocks, never mis-prices; toast tells rep to refresh).
**Fix — replace 6013:**
```js
if (!cache) { rows.forEach(r => { if (!(parseFloat(r.dataset.sellPrice) > 0)) r.dataset.priceError = 'true'; }); return; }
```

**No money or push-path regression beyond these four.** The dup-push lock (A2 + B5's three layers + edit-reload `_pushAlreadyDone`) has **no path to a silent duplicate or $0 save.**

---

## 3. REMAINING APPLY-READY LIST — ordered by value

### MONEY / DATA (do these)

**[B8-R1] — `embroidery-quote-builder.js:1725/1736` — APPLY.** (See §2.) Move the window-flag assignment before the Ship-mode `lookupTaxRate` call. Under-charges non-exempt customers re-selected after an exempt one.

**[B8-R2] — `embroidery-quote-builder.js:964` — APPLY (with B7).** (See §2.) Set `window._taxExempt = taxExempt` on edit-reload. Re-taxes exempt reloaded quotes.

**[B1] — DECISION, do NOT blind-patch.** *(Conflict resolved.)* Two passes called B1 "apply-ready", but the strongest evidence proves the naive patch is **unsafe**: saved `SubtotalAmount`/`TotalAmount` exclude shipping **by design** (`embroidery-quote-service.js:236-243`); shipping is a separate `SHIP` line item, and **`pages/js/invoice.js:801` + `quote-view.js:2036-40` add that SHIP line back on top.** Folding shipping into `TotalAmount` would **double-count on every `/invoice` and `/quote`.** The real defect is the **dashboard** (`quote-management.html:335`) reading bare `TotalAmount` → **under-reports by shipping in the pre-import window only** (self-corrects to `cur_TotalInvoice` once Processed). The dashboard loads only `/quote_sessions` (no line items) → it can't sum SHIP without an N+1. **Resolution: add a session-level `ShippingAmount` column populated at save + read by the dashboard, OR accept the bounded pre-import under-report. Erik's call.** The internally-inconsistent tax base (tax computed on shipping-inclusive `#pre-tax-subtotal` while Subtotal is shipping-exclusive) is real but invoice-foots correctly today — do not "fix" it without settling the `TotalAmount` contract first.

**[B12] — `embroidery-quote-builder.js:6159` — APPLY (low-risk) or DEFER.** POST body omits `residential`; proxy supports it (`shipping.js:64/78`, `RESIDENTIAL_SURCHARGE=6.50`). Add `residential: !!document.getElementById('ship-residential')?.checked` to the body + a `#ship-residential` checkbox near the shipping-fee field. Estimate is rep-overridable → bounded $6.50 under-quote. Header-line "~6131" in some reports is the weight loop; the actual payload is **6159**.

**[B13] — `embroidery-pricing-service.js:474 + 629` — APPLY (visibility), corrected scope.** *(Conflict resolved.)* `perThousandUpcharge || (cap?1.00:1.25)` is a silent hardcoded fallback (Erik's #1-rule violation) that **only bites when `extraStitches>0` AND the bundle omits the field** — today the proxy always seeds it (garment 1.25, cap 1.00, both ends agree; the "1.25 vs 1.00 mismatch" sub-claim is **false**), so it's currently dead. **Do NOT toast from inside the service class** (no `showToast` in scope reliably; runs headless too). Instead: switch the trigger from `||` to `== null` (so a legit API `0` isn't overridden), set `usedFallbackUpcharge` on the return objects (AL **649-663**, DECG **498-512**), and toast from the callers `syncALRows`/`syncDECGRows` gated on `res.usedFallbackUpcharge && res.breakdown.extraStitches > 0`. LOW.

### SECURITY HARDENING (low real-world risk; batch together)

**[C11] — `embroidery-quote-builder.js:2697` — APPLY.** Inline `onclick="selectDesignFromSearch('${dn}')"` — `dn`'s HTML-attr escaping (`&#39;`) decodes to `'` before JS parses → breakout if a design # ever contained a quote. Card already has `data-design-number` (2698). Fix: drop the inline onclick, use `onclick="selectDesignFromSearch(this.dataset.designNumber)"` or a delegated listener. (The *design-search company-filter* variant some passes cited at ~2063-2069 is the same class — escape `"`/`'` or go delegated.) LOW (alphanumeric design #s).

**[C10] — `embroidery-quote-invoice.js:632/642/669/678/746 (+514/91)` — DEFER to a cross-builder XSS pass.** DTG/DTF/SCP location labels fall through to raw `printLocation.front/.back` / `config.label` unescaped in the **shared** generator. EMB itself uses a fixed dropdown (low risk); the freer-input paths are DTG/DTF. Wrap each in `this.esc()`. Out of EMB money/security-critical scope — verify each method's location source is user-influenced first.

### NON-MONEY (defer)

**[B7] — DEFER (cosmetic half only); the tax half rides with B8-R2.** *(Framing corrected.)* `surfaceCustomerContext` **already exists** (`customer-context-banners.js:109`, exported 227) — it is **not a missing function**. The gap is that `loadQuoteForEditing` never *calls* it (only `applyContact` does, on live select) → CRM tier/tax-exempt/terms banners blank after edit-reload. Fix = call the existing `surfaceCustomerContext` from the reload block (after ~900/990) using `getByCustomerId(session.CustomerNumber)` (now available via A5), passing **only** `warningContainerId`/`taxChipContainerId`/`tierBadgeContainerId` (skips terms/phone/name blocks → overwrites no saved value). **Citation correction for whoever implements:** the badge fields arrive via `mapRecordToLegacyShape` (`company-contacts.js:58-69`, the `/by-customer/:id` mapper) which passes `Is_Tax_Exempt` **raw** — keep the `=== true || === 1 || === '1'` normalization. Cosmetic; defer.

**[C7] — DEFER (cleanup), with one HARD STOP.** Delete the byte-identical duplicate `embEmailQuote` at **8265-8277** (the `12801` declaration wins via hoisting; the HTML onclick resolves to it) and the EMB-local dead `toggleSaveShare` at **8305-8317** (shared copy in `quote-builder-utils.js:918` stays). **DO NOT remove the `'monogram'` EmbellishmentType (1200):** it is **live** — saved at `embroidery-quote-service.js:521 and 1640` and re-classified back into `serviceItems` on edit-reload. The original "dead monogram" claim is **false**; removing it mis-routes saved monogram lines → money/round-trip break.

**[C2] — DEFER (a11y).** 7 modals lack `role="dialog"`/`aria-modal`/`aria-labelledby`. **Correction:** the shipping-modal title is a `<span>` (1341), not an `<h3>` — point `aria-labelledby` at an id on that span. `emb-sw-push-modal` already compliant.

**[C3/C4/C5/C6/C9] — DEFER (a11y / config).** C3 icon-close `aria-label`; C4 label `for=` (16 fields, all cited); C5 services-bar `aria-haspopup`/`aria-expanded`/Escape (`quote-services-bar.js`, set `aria-expanded` after the `menu.hidden=wasOpen` toggle at 122-124); C6 loading overlay `role="status"` (lines 57 + 981); **C9** `ZONE_MODEL` freight grid hardcoded (`shipping.js:49`) — deliberate published-rate snapshot, **DECISION** not bug. None touch money or the push path.

---

## 4. TRUE-100 VERDICT

**With B8-R1, B8-R2, C8, and the A3-DECG over-block applied — and B1 settled as a dashboard-side decision — this is defensibly 100% on SECURITY and PUSH-PATH, and 100% on MONEY for every path that bills or invoices a customer.**

**Security — 100% on the critical surface.** SQLi closed at every interpolation (A1, A5, A6 proxy `sanitizeId`). Stored-XSS closed on the live invoice/preview paths (B6 discountReason, B3 designs, B10 project, B4 notes). Write endpoints rate-limited (C1). The two residual XSS items (C10 shared-generator location labels, C11 design-search onclick) are **enum/alphanumeric-controlled, low real-world exploitability**, and C10 is a non-EMB code path — genuine hardening, not an open hole.

**Money — 100% on customer-facing dollars after the B8 fixes.** Push has no silent-duplicate or $0 path (A2 + B5 + edit-reload lock). Under-bill on imported digitizing fees closed (A4). Wrong-account attach closed (A6). AL/DECG can't save at $0 (A3). The invoice/PDF foots correctly (B1 save formula is *correct as-is*; the only money gap is the **dashboard's pre-import display under-report** — a reporting surface, self-correcting on import, not a charge error).

**Correctness — 100% on the verified paths**, modulo the four §2 fixes.

**What genuinely remains (real gaps, ranked):**
1. **B8-R1/R2** (tax mis-charge windows) — real, money, **must-fix before "100"**.
2. **B1 dashboard pre-import under-report** — real but bounded and self-correcting; needs a **decision**, not a blind patch.
3. **B12 residential surcharge** — real $6.50 under-quote on residential freight; bounded by rep override.
4. **B13 silent upcharge fallback** — currently **dead** under live API responses; visibility-only hardening.
5. **C10/C11** — low-exploitability XSS hardening.

**Pure a11y/cosmetic polish (NOT correctness gaps):** C2, C3, C4, C5, C6, the C8 button-flicker (gated harmless), C1's imprecise comment, C7 dead-code cleanup, B7's blank context banner, the `(X%)` label refinements (B9). None of these can produce a wrong price, a wrong charge, a duplicate push, or an injection.

**Bottom line:** Ship the 16-fix batch as-is. Apply the four §2 fixes (two MONEY, two LOW-fail-closed) to reach a defensible 100% on security + money + correctness. Everything else is decision-gated or cosmetic.

---

## 5. DECISIONS FOR ERIK (human-only — no code answer exists)

1. **B1 / `ShippingAmount`** — Should the dashboard show shipping-inclusive totals pre-import? If yes: add a `Quote_Sessions.ShippingAmount` column populated at save + read by `quote-management.html:335`. If no: accept the bounded pre-import under-report (self-corrects to `cur_TotalInvoice` on import). **Do not fold shipping into `TotalAmount` — it double-counts on `/invoice` + `/quote`.**
2. **B2** — The ShopWorks part number **and sell amount** a DT/Sample fee should bill as (needed before the design-transfer import-array fix can ship without mis-billing).
3. **B14** — Should imported screen-print / digital-print fees **bill as line items** on an EMB quote, or stay as order notes? (Currently they hit the catch-all → notes, not billed — not dropped, just unbilled.)
4. **`coa_AccountSalesTax01`** — OnSite integration-mapping config: the tax account is not echoed by the MO→SW conversion (rate preserved in Notes). Config item on the OnSite side, not code.
5. **`/verify/:extOrderId` order-pull** — the helper 400s; decide whether to repair the MO order-pull path or retire the verify endpoint.
6. **Dashboard dup-QuoteID dedup** — A2 fixed the *builder* (max-PK_ID reduce) and *server sync*, but the dashboard still **lists** duplicate-QuoteID rows. Scope item-loads to the resolved session PK_ID, or dedup at the dashboard. (Note the latent pre-existing risk: `/quote_items` GET filters by QuoteID only, not session PK_ID — if two sessions share a QuoteID with items, edit-reload merges both.)
7. **`hasUnsavedChanges` semantics** — define what counts as dirty before wiring an unsaved-changes guard.
8. **C9 `ZONE_MODEL`** — confirm the hardcoded freight zone grid is the intended published-rate snapshot (vs. a live-rate lookup).