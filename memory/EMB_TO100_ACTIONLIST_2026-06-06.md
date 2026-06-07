Confirmed: `syncALRows():5916-5917` early-returns on `!cache` with no `priceError` flag set — the API-down save-gate bypass is real. And `filesRoutes` at server.js:394 is mounted with no limiter. All my spot-checks corroborate the reports' corrected findings. I have enough verified evidence to synthesize the final report.

# FINAL ACTION LIST — Embroidery Quote Builder to defensible 100%

All file:line citations below are **independently re-verified** against current code (tax-rate 353/388, quotes.js 449-452, company-contacts by-customer 497-520, parser 1166/1172 + aliases 199-201, server.js 4995/4999, syncALRows 5916-5917, files route 394). Absolute project roots:
- FE: `C:\Users\erik\OneDrive - Northwest Custom Apparel\2025\Pricing Index File 2025\`
- Proxy: `C:\Users\erik\OneDrive - Northwest Custom Apparel\2025\caspio-pricing-proxy\`

---

## 1. DEPLOYED-FIX VERDICT

**~30 deployed fixes: ALL CONFIRMED CORRECT and regression-free. Zero broken/incomplete deployed fixes found.** Every verifier that spot-checked a "verified-good" marker confirmed it present, correctly placed, and behaving as claimed. Specifically re-confirmed:

- **Security (P0):** invoice XSS `esc()` method (`embroidery-quote-invoice.js:26-34`, `&`-escaped first, applied to all customer/notes/address/line/PO/service/product fields); SQLi `sanitizeStyleNumber` (`quotes.js:28-32/212`); DELETE-injection `parsePkId` (6 sites, `emb-design-routes.js`).
- **Tax:** WA DOR `toFixed(2)` (`tax-rate.js`); `getTaxAccount` round-to-2 (`manageorders-emb-config.js:155`); EMB decimal-rate handling; `/invoice` discount+SHIP footing + tax fallback; `/quote` frozen `TaxRate` preference.
- **Edit-reload:** `_restoringQuote` arm/clear/no-op (`820`/`1008`/`7061`/`7178`); 2XL extended-size restore; AS-Garm/AS-CAP stitch-surcharge double-count fix; cap embellishment-type restore; ProjectName persist/restore; ship-to + ship-method restore; `_pushAlreadyDone` edit-reload set (`997`).
- **Push side of P2-2:** push (`embroidery-push.js:58`) AND preview (`:319`) both order `PK_ID DESC` and warn on dup rows — the *push* half is genuinely fixed.
- **Pricing/AL:** freight-on-pickup taxable-base flow (`7185-7187`); tax-exempt clear-on-select; fuzzy→exact contact attach (dropdown path); AL/DECG `priceError` gate (throw/zero path); Full-Back-as-additional sum; Set-dedup + per-surface mutual exclusion in `buildDesigns` (transformer `461-480`); box-density Caspio table.
- **Artwork:** B1 reset clears widget; B5 restore `referenceArtwork`+name; B6 save-gate blocks artwork-but-unnamed; P2-12 server backstop re-checks on push; P2-10 dedup.
- **Push UI (P2-15/16):** email-in-readiness gate; push-modal focus trap + dialog ARIA.

**Caveat (not a broken fix — an incomplete one):** **P2-2 was only half-deployed.** The push/preview were fixed; the *read* path (builder `loadQuote`, generic GET, and the Pricing-Index `server.js` sync) was never ordered. This is carried as **[P2-2]** in the punch-list below, not as a deployed-fix failure. Likewise **P2-13** `al-pricing` backstop shipped with correct *selectors* but an *inert guard* (depends on undefined `embQuoteBuilder.hasAdditionalLogos`) — carried as **[C8]**.

---

## 2. APPLY-READY PUNCH-LIST (execute top-to-bottom)

### GROUP A — P-BLOCKERS (security + real-money correctness; do these first)

**[A1] HIGH — Unauth WHERE-injection on tax-account mutation** — `caspio-pricing-proxy/src/routes/tax-rate.js`
Add a sanitizer after the existing sanitizers (~line 33):
```js
function sanitizeIdAccount(v){
  const s = String(v == null ? '' : v).trim();
  return /^[a-zA-Z0-9._-]{1,20}$/.test(s) ? s : null;
}
```
PUT — replace lines **340-342**, and DELETE — replace lines **381-383**, with:
```js
const safeId = sanitizeIdAccount(id);
if (!safeId) return res.status(400).json({ success:false, error:'Invalid ID_Account' });
```
Then interpolate `safeId` (not `id`) at **line 353** and **line 388**. (ID_Account values are numeric strings e.g. `2200` — safe.)

**[A2] HIGH — P2-2 read-path: builder/sync bind to a non-newest duplicate row → pushed-order lock bypass + split-brain + duplicate ShopWorks order.** Three surfaces, all required:

- **(a) Proxy generic GET** — `caspio-pricing-proxy/src/routes/quotes.js`, inside the `if (whereConditions.length > 0)` block, after **line 451**:
  ```js
  params['q.orderBy'] = 'PK_ID DESC';
  ```
  (Cache key at 439/460 is `whereConditions`-only and order-independent → safe.)
- **(b) Builder loadQuote** — `shared_components/js/embroidery-quote-service.js`, replace **line 1317**:
  ```js
  const matches = sessions.filter(s => s && s.QuoteID === quoteId);
  const session = (matches.length ? matches : sessions)
      .reduce((a, b) => ((Number(b.PK_ID) || 0) > (Number(a.PK_ID) || 0) ? b : a));
  ```
  (Load-bearing: order-agnostic; guarantees `updateQuote`'s PUT at `:1496` targets the same PK_ID push/preview read.)
- **(c) Pricing-Index server.js sync** — `Pricing Index File 2025\server.js`:
  - **line 4995** → append ordering: ``const sessions = await makeApiRequest(`/quote_sessions?filter=QuoteID='${safeQuoteId}'&q.orderBy=PK_ID DESC`);``
  - **line 4999** → `const session = (Array.isArray(sessions) && sessions.find(s => s.PushedToShopWorks)) || sessions[0];`
  - **line ~6057** bulk-sync query → append `&q.orderBy=PK_ID DESC` to the `q.where` querystring.
  (If the `filter=` route strips unknown params, fall back to client sort: `sessions.sort((a,b)=>(b.PK_ID||0)-(a.PK_ID||0))`.)

**[A3] HIGH — AL/DECG $0-line save-gate bypassed when pricing API is unreachable** (violates Erik's #1 rule on the exact API-down path) — `shared_components/js/embroidery-quote-builder.js`:
- **line 5916-5917** (`syncALRows`):
  ```js
  const cache = await loadALPricing();
  if (!cache) { alRows.forEach(r => { r.dataset.priceError = 'true'; }); return; }
  ```
- **line 5984-5985** (`syncDECGRows`):
  ```js
  const cache = await loadDECGPricing();
  if (!cache) { rows.forEach(r => { r.dataset.priceError = 'true'; }); return; }
  ```
  (Success path already `delete row.dataset.priceError` on next good recalc → safe.)

**[A4] MEDIUM-HIGH — P2-4: imported DGT-001/002/003 stored RAW → not in `KNOWN_FEE_PNS` → demoted to a Note → ShopWorks under-bills.** Capture-point fix (the right layer) — `shared_components/js/shopworks-import-parser.js`, `case 'digitizing':` block (1159-1176):
```js
const _normCode = this.SERVICE_CODE_ALIASES[item.partNumber.toUpperCase()] || item.partNumber.toUpperCase();
```
then use `_normCode` at **line 1166** (`digitizingCodes.push(_normCode)`) and **line 1172** (`code: _normCode`). (Map already exists at 199-201; classifier routes `DGT-*`→digitizing at 1566-1567.)
- **Update tests:** `tests/unit/parser/batch11.test.js:630` and `tests/unit/parser/batch12.test.js:91` — change `expect(dgt.code).toBe('DGT-001')` → `'DD'`.
- **Defense-in-depth (optional):** in `caspio-pricing-proxy/lib/embroidery-push-transformer.js` fee branch (203-222), normalize `pn` via a local `{'DGT-001':'DD','DGT-002':'DDE','DGT-003':'DDT'}` before `isKnownFeeCode(pn)` (line 212) and pass the normalized PN into `buildServiceLine` (PartNumber at `:355`).

**[A5] MEDIUM — P2-6: typed Customer # never verified against CRM → pushes to a real-but-wrong account.** Do NOT use `getById()` (it keys `ID_Contact`, not `id_Customer`). Use the existing `by-customer` endpoint (verified at `company-contacts.js:497-520`, returns `{contacts:[{CustomerCompanyName,…}]}`).
- **(1)** `shared_components/js/customer-lookup-service.js`, after `getById` (after line 106), add:
  ```js
  async getByCustomerId(customerId) {
    const id = String(customerId || '').trim();
    if (!id) return null;
    try {
      const resp = await fetch(`${this.baseURL}/api/company-contacts/by-customer/${encodeURIComponent(id)}`);
      if (!resp.ok) return null;
      const data = await resp.json();
      return (data.contacts && data.contacts[0]) || null;
    } catch (e) { console.error('getByCustomerId error:', e); return null; }
  }
  ```
- **(2)** `shared_components/js/embroidery-quote-builder.js`, as a **sibling line after :1663** (reuse existing `_custNumEl`; `change` not `input`; guard `_restoringQuote`; `showToast` is an optional global → call behind `typeof`):
  ```js
  if (_custNumEl) _custNumEl.addEventListener('change', async () => {
    if (window._restoringQuote) return;
    const id = (_custNumEl.value || '').trim();
    const noteEl = document.getElementById('customer-number-resolved');
    if (!id) { if (noteEl){ noteEl.textContent=''; noteEl.hidden=true; } return; }
    if (!window.customerLookupInstance) return;
    const contact = await window.customerLookupInstance.getByCustomerId(id);
    if (!noteEl) return;
    if (contact && contact.CustomerCompanyName) {
      noteEl.textContent = '✓ ' + contact.CustomerCompanyName;
      noteEl.style.cssText = 'font-size:11px;color:#166534;font-weight:600;'; noteEl.hidden = false;
    } else {
      noteEl.textContent = '⚠ No CRM customer for #' + id + ' — verify before pushing.';
      noteEl.style.cssText = 'font-size:11px;color:#92400e;font-weight:600;'; noteEl.hidden = false;
    }
  });
  ```
- **(3)** `quote-builders/embroidery-quote-builder.html`, after **line 647**: `<span id="customer-number-resolved" hidden></span>`. Bump `?v=` at HTML **line 1466**. (Non-blocking warning per Erik's rule.)

**[A6] MEDIUM — ShopWorks-import CRM auto-attach uses fuzzy `results[0]` → wrong-account attach.** `shared_components/js/embroidery-quote-builder.js`, at **:10729-10732**, gate on exact email before trusting `results[0]`:
```js
if (results.length > 0) {
  const want = (data.customer.email || '').toLowerCase().trim();
  const contact = results.find(c => (c.ContactNumbersEmail || '').toLowerCase().trim() === want) || null;
  if (!contact) { showToast('No exact CRM email match — using imported values', 'info'); }
  else { /* existing fill block :10733-10768 */ }
}
```
(The exact-match fix previously only landed on the dropdown `applyContact` path; the import path was uncovered.)

### GROUP B — CORRECTNESS (money/UX accuracy; do after blockers)

**[B1] P2 — Saved `SubtotalAmount`/`TotalAmount` omit shipping → dashboard "Amount" under-reports** (inconsistent with its own shipping-inclusive `TaxAmount`) — `shared_components/js/embroidery-quote-service.js`:
- Add `+ (customerData.shippingFee||0)` to both header formulas at **:241** and **:1377** (second save block is **1372-1379**).
- `shippingFee` is NOT in the save-path charges object — add it where that object is built (builder **:8786-8799**): `shippingFee: parseFloat(document.getElementById('shipping-fee')?.value) || 0`.

**[B2] P2 — `sampleFee` per-unit vs total mismatch (over-taxes when sampleQty>1).** Simplest low-risk fix (align everything to TOTAL, which both save paths + the SAMPLE line item already use): builder **:6991**, change the on-screen tax base from `sampleFee * sampleQty` to bare `sampleFee`. (Latent today — `#sample-fee` not in current HTML — but re-armed by `SampleQty` restore at builder `:1442`.)
  - **Decision needed (see §3):** `'SAMPLE'` is not a real ShopWorks part — confirm with Erik which SW service part a sample fee maps to before adding to `KNOWN_FEE_PNS`. Until then it correctly demotes to a Note. **Alternative:** if sample fees are truly dead, delete the SAMPLE path entirely (service.js 781-789, 317-318/1434-1435, 241/1377; builder 6987-6991, 8640/8653, 8791-8792, 7536-7537, 12208, 12247, 1441-1442).

**[B3] P2-11 — push preview never renders Designs/artwork** (rep can't catch wrong/missing logo) — `shared_components/js/embroidery-quote-builder.js`, in `renderPushPreview`, insert **after line 8022** (after line-items `</div></div>`, before `const warnings = []` at 8024):
```js
const designs = Array.isArray(o.Designs) ? o.Designs : [];
if (designs.length) {
  html += '<div class="preview-products"><h5>Designs (' + designs.length + ')</h5>';
  for (const d of designs) {
    if (d.id_Design && !d.DesignName) { html += '<div class="preview-product-item"><span class="preview-product-desc">Existing design #' + escapeHtml(String(d.id_Design)) + ' (linked in ShopWorks)</span></div>'; continue; }
    const locs = Array.isArray(d.Locations) ? d.Locations : [];
    const thumb = (locs.find(l => l.ImageURL) || {}).ImageURL;
    html += '<div class="preview-product-item">'
      + (thumb ? '<img src="' + escapeHtml(thumb) + '" style="width:40px;height:40px;object-fit:contain;border:1px solid #e2e8f0;border-radius:4px;">' : '')
      + '<span class="preview-product-desc">' + escapeHtml(d.DesignName || '(unnamed)') + ' · ' + escapeHtml(String(locs.length)) + ' location(s)</span>'
      + '</div>';
  }
  html += '</div>';
}
```
(Handles both Branch-1 `{id_Design:N}` and Branch-2 `{DesignName,Locations[].ImageURL}`. `escapeHtml` global; `o.Designs` present in preview payload.)

**[B4] P2-4 surfacing — skipped-fee Note in preview** (pairs with A4) — `shared_components/js/embroidery-quote-builder.js`, in the warnings block (~**8024-8032**, after `oNotes` is in scope; hoist `oNotes` above if needed):
```js
for (const n of (Array.isArray(o.Notes) ? o.Notes : [])) {
  if (/^Order notes:/i.test(String(n.Note || ''))) warnings.push('Fee not billed as a line item (sent as a note): ' + String(n.Note).replace(/^Order notes:\s*/i, ''));
}
```
(`skippedFeeNotes` is NOT a separate field — it's folded into `o.Notes` by transformer 711-712. Optional robustness: expose `_skippedFeeNotes` from the transformer return + preview JSON.)

**[B5] HIGH — `_pushAlreadyDone` "Sent ✓" lock wiped on every re-save (P3-7)** → duplicate ShopWorks order (and `hasUnsavedChanges` is undefined, so push ALWAYS re-saves → fires every time) — `shared_components/js/embroidery-quote-builder.js`:
- `showPushButton` (**7884-7888**) → gate the reset:
  ```js
  function showPushButton(quoteId, opts = {}) {
    _pushQuoteId = quoteId;
    if (opts.resetPushed === true) _pushAlreadyDone = false;
    updatePushButtonState();
  }
  ```
- Save tail **:7770** → `showPushButton(result.quoteID, { resetPushed: !isUpdate });` (`isUpdate` in scope at :7729).
- `confirmPushToShopWorks` (after early-return ~**:8055**) add defense-in-depth:
  ```js
  if (_pushAlreadyDone && confirmBtn.dataset.force !== 'true') {
    showToast('Already sent to ShopWorks this session — re-push only via the explicit duplicate button.', 'warning'); return;
  }
  ```
  (resetQuote clear at :8533 and edit-reload set at :997 stay.)

**[B6] HIGH — Stored XSS via `discountReason` in invoice totals** (only remaining unescaped interpolation; free text saved to Caspio, executes on every later print across all 4 builders) — `shared_components/js/embroidery-quote-invoice.js`, **line 1542**:
```js
<span>Discount${pricingData.discountReason ? ` (${this.esc(pricingData.discountReason)})` : ''}:</span>
```

**[B7] P3-16 — CRM context (warning/tax-exempt chip/tier badge) blank after edit-reload** — `shared_components/js/embroidery-quote-builder.js`, insert **after line 900** (after the ship IIFE, before `populateLogoConfig` at 903). Surface read-only badges ONLY (do not pass terms/phone/email container ids — would overwrite saved values). Depends on `getByCustomerId` from A5:
```js
(function resurfaceCrmContext() {
  const id = (document.getElementById('customer-number')?.value || '').trim();
  if (!id || !window.customerLookupInstance || typeof window.surfaceCustomerContext !== 'function') return;
  window.customerLookupInstance.getByCustomerId(id).then(contact => {
    if (!contact) return;
    window.surfaceCustomerContext(contact, { warningContainerId:'customer-warning-banner', taxChipContainerId:'customer-tax-chip', tierBadgeContainerId:'customer-tier-badge' });
  }).catch(() => {});
})();
```

**[B8] P3 — Tax-exempt rate re-applied by a later Pickup→Ship toggle** — `shared_components/js/embroidery-quote-builder.js`: set `window._taxExempt = _taxExempt;` in `applyContact` (~:1713) and clear it for non-exempt; early-return in `lookupTaxRate` (~:7061) when `window._taxExempt`; belt-and-suspenders skip in `setShipMode('ship')` (~:7231).

**[B9] LOW — `/invoice` tax-rate LABEL under-reports on pre-import discounted quotes** (dollars correct, % label wrong) — `pages/js/invoice.js`, **line 837**: `const taxBase = subtotalNet + shipping;` (subtotalNet in scope from :794).

**[B10] LOW — EMB `customerData.project` collected but never rendered on PDF** — `shared_components/js/embroidery-quote-invoice.js`, insert after **line 515** (conditional → DTG/DTF/SCP unaffected):
```js
${customerData.project ? `<strong>Project:</strong> ${this.esc(customerData.project)}<br>` : ''}
```

**[B11] LOW — P3-15 email presence-checked but not format-validated** — `shared_components/js/embroidery-quote-builder.js`, in the save gate at **:7385-7394**, after the presence check, add:
```js
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) {
  showToast('Enter a valid email address (name@company.com).', 'error');
  document.getElementById('customer-email')?.focus(); return;
}
```

**[B12] LOW — P3 residential freight surcharge never passed (~$6.50 under-estimate)** —
- `quote-builders/embroidery-quote-builder.html`, after **line 1419** inside `#shipping-fee-field`: `<label style="display:block;margin-top:6px;font-size:12px;color:#475569;"><input type="checkbox" id="ship-residential"> Residential delivery (+$6.50)</label>`
- `shared_components/js/embroidery-quote-builder.js`, **:6131** body → add `residential: !!document.getElementById('ship-residential')?.checked` (endpoint `shipping.js:60/64/78` already supports it; no proxy change).

**[B13] LOW — `perThousandUpcharge` silent hardcoded fallback** (API has base prices but lacks upcharge → silently uses $1.00/$1.25) — `shared_components/js/embroidery-pricing-service.js` **:474** (DECG) and **:629** (AL): when `perThousandUpcharge` missing, fire a one-time `showAPIWarning` instead of silently defaulting.

**[B14] NARROW — imported `screenPrintFees` (SPSU/SPRESET/HW-SURCHG) + `digitalPrint` (CDP/Pallet) drop to a Note** (no EMB billable input). **Decision needed (see §3)** — flag to Erik; likely acceptable, but a CDP/Pallet/SPSU import lands in notes not a billable row.

### GROUP C — A11y + DEAD-CODE POLISH (do last; low risk, additive)

**[C1] Rate-limit real-money/upload write routes** — `caspio-pricing-proxy/server.js` (no global limiter exists; comments at 698/725 are stale). Define near other limiters:
```js
const writeLimiter = rateLimit({ windowMs: 15*60*1000, max: 60, standardHeaders: true, legacyHeaders: false, message: { error: 'Too many requests, slow down.' } });
```
**line 837** → `app.use('/api', writeLimiter, embroideryPushRoutes);`; **line 394** → `app.use('/api', writeLimiter, filesRoutes);` (or a tighter `max:20` for files).

**[C2] 7 modals lack dialog semantics** — `quote-builders/embroidery-quote-builder.html`: add `role="dialog" aria-modal="true" aria-labelledby="…"` (+ focus management like `emb-sw-push-modal`) to `logo-modal`(920), `shopworks-import-modal`(992), `decg-stitch-modal`(1041), `service-pricing-review-modal`(1068), `add-nonsanmar-modal`(1202), `design-search-modal`(1272), `shipping-modal`(1337). Shipping modal (edits tax-driving address) is highest-value.

**[C3] Icon-only buttons missing accessible names** — `quote-builders/embroidery-quote-builder.html`: add `aria-label` to `design-btn-lookup/search/clear` garment (109/112/115) + cap (202/205/208), and to `lookup-tax-btn` (1404 — icon-only, NOT icon+text). (`estimate-ship-btn`/`design-search-go` are icon+text → OK.)

**[C4] P3-1 label `for=`/labels** — `quote-builders/embroidery-quote-builder.html`: add `for=` to all cited label→input pairs; add `class="sr-only"` (NOT `visually-hidden` — repo CSS defines `.sr-only` at quote-builder-common.css 1686-1696) labels for `customer-lookup`(619) and the art-charge `$` input(768). Terms(819)/Order#(824) labels wrap nested spans — add `for=` without replacing text.

**[C5] P3-13 services-bar ARIA/Escape** — `shared_components/js/quote-services-bar.js`: add `aria-haspopup="true"` + `aria-expanded` sync on the button (line 108) and Escape-to-close. **Do NOT add `role="menu"`** (children aren't `menuitem` → invalid ARIA). Shared across all 4 builders; purely additive.

**[C6] P3-14 loading overlay** — `quote-builders/embroidery-quote-builder.html` line 57: add `role="status" aria-live="polite" aria-busy="false"` + `class="sr-only"` spinner text.

**[C7] Dead-code deletions** (flag/delete, low risk):
- `toggleSaveShare()` EMB-local copy at builder **8222-8234** (DOM removed). Delete ONLY the EMB copy — the shared `quote-builder-utils.js:918` copy is still live for DTF/SCP/legacy-DTG.
- Duplicate `embEmailQuote` (byte-identical at **8182** and **12709**) — delete one.
- Dead `'monogram'` EmbellishmentType ternary at service.js **521/1635** → collapse to `'embroidery-additional'`.

**[C8] P2-13 inert `al-pricing` backstop** — `embroidery-quote-pricing.js:1989`: replace the `embQuoteBuilder.hasAdditionalLogos` check (undefined → dead branch) with a real DOM probe:
```js
const alFailed = document.querySelector('#product-tbody tr.service-product-row[data-al-priced="true"][data-price-error="true"]');
if (alFailed) { btn.disabled = true; } else { btn.disabled = false; btn.style.opacity='1'; btn.style.cursor='pointer'; btn.title=''; }
```

**[C9] P3-3 ZONE_MODEL grid → Caspio** (`shipping.js:49-57`): mirror box-density pattern with TTL-cached `loadZoneModel()` from `Freight_Zone_Reference`; keep in-file `ZONE_MODEL` as fallback. **NOTE: the POST handler at line 62 is synchronous — you MUST add `async` to the handler signature** for `await loadZoneModel()`. (Nice-to-have; not blocking.)

**[C10] Non-blocking invoice-generator label escaping** (DTG/SCP/DTF only, code-derived location codes — defensibility) — `embroidery-quote-invoice.js` lines 631/641/668/677/745: wrap location labels in `this.esc(...)`.

**[C11] Design-search inline-onclick JS-string context** — `embroidery-quote-builder.js:2673` (`buildDesignSearchCardHtml`): prefer the existing `data-design-number` attribute (2674) + delegated listener over inline `onclick="selectDesignFromSearch('+dn+')"` (harmless today — digits-only — but not JS-escaped).

---

## 3. TRUE-100 VERDICT

**Once Groups A + B are applied, the EMB Quote Builder is defensibly 100% on security and money-correctness.** Group C closes a11y/dead-code polish for full defensibility. Confidence is high because: (a) every deployed fix verified correct/regression-free; (b) every remaining defect was adversarially cross-checked, with the bad fix specs (P2-6 `getById`, sample-fee line-item, P2-4 file path, P3-3 "already async", P2-2 "oldest row" framing) caught and corrected before reaching this list; (c) no verifier found a NEW regression in the deployed batch.

**What is NOT a code task — needs Erik (business/data/schema decision):**

1. **[B2/B14] Sample fee + screen-print/digital-print import mapping** — `'SAMPLE'`, `SPSU`, `SPRESET`, `CDP`, `Pallet` are not in EMB's `KNOWN_FEE_PNS` and have no EMB billable input. **Decision:** which real ShopWorks part each maps to (then add to `KNOWN_FEE_PNS`), OR confirm "demote to a Note is intended" (current behavior), OR delete the dead SAMPLE path. Do not invent a part number.

2. **`coa_AccountSalesTax01` not echoed by the MO→SW conversion** — tax-account dropdown won't auto-fill in ShopWorks; rate is preserved in the order Note as mitigation. This is an **OnSite integration-mapping config item** on the ShopWorks side, not fixable in this codebase. Long-standing known limit — confirm Erik accepts the Note-based mitigation.

3. **`/verify/:extOrderId` order-pull 400s** (broken MO helper) — orthogonal to the builder; the push itself is conversion-verified. Flag whether to fix the verify helper now or defer.

4. **Dashboard duplicate-QuoteID dedup (P3-6)** — A2 fixes the *builder/sync* split-brain (the duplicate-order risk). A full dashboard-level dedup/roll-up of locked state across duplicate rows is a larger, separate change; the per-row pushed-lock is already correct. Judgment call on whether to scope it now.

5. **`hasUnsavedChanges` is undefined** → push always re-saves (B5 neutralizes the lock-wipe consequence). Defining a real dirty-check to skip needless re-saves is an optimization, not a correctness gap — defer unless Erik wants it.

Everything else in Groups A–C is deterministic, apply-ready, and safe as written above. Nothing in this list is speculative; every line number was re-verified against current source.