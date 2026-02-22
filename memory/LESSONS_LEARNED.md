# Lessons Learned

A running log of problems solved, gotchas discovered, and patterns that work. Covers all three related projects:
- **Pricing Index File 2025** (Frontend) - Calculators, quote builders, pricing pages
- **caspio-pricing-proxy** (Backend) - API proxy server
- **Python Inksoft** (Integration) - InkSoft to ShopWorks order transformation

Add new entries at the top of the relevant category.

---

## Table of Contents
1. [API & Data Flow](#api--data-flow)
2. [Order Processing & ShopWorks](#order-processing--shopworks)
3. [Multi-SKU Products & Sizes](#multi-sku-products--sizes)
4. [Code Organization](#code-organization)
5. [Calculator & Quote Builder Sync](#calculator--quote-builder-sync)
6. [Development Environment](#development-environment)
7. [Security](#security)
8. [Best Practices](#best-practices)
9. [Business Insights](#business-insights)

---

## Related Documentation

**For comprehensive ManageOrders API documentation, see:**
- **[MANAGEORDERS_COMPLETE_REFERENCE.md](./MANAGEORDERS_COMPLETE_REFERENCE.md)** - Complete API reference covering all PULL/PUSH endpoints, every field, patterns, gotchas, and usage across all three projects (1000+ lines)

---

# API & Data Flow

## Pattern: Fee Items Catch-All for Quote Display (2026-02-14)
**Date:** 2026-02-14
**Project:** [Pricing Index]
**Problem:** Fee items saved as `quote_items` with `EmbellishmentType='fee'` (Monogram, NAME, WEIGHT, SEG, DT, etc.) were persisted correctly but never rendered in quote-view or PDF. Only session-level fees (tax, shipping, stitch surcharges) rendered because they had explicit rendering code.
**Root cause:** `renderFeeRows()` had hardcoded rendering for specific fee types (stitch surcharge, AL, digitizing, rush, etc.) but no catch-all for unknown/new fee types. Every new fee type required explicit rendering code.
**Solution:** Added a `handledFeeStyleNumbers` Set containing all explicitly rendered part numbers. After all explicit rendering, a catch-all loop processes remaining `EmbellishmentType='fee'` items not in the Set. Applied to both web view (`renderFeeRows()`) and PDF (`renderPdfFeeRows()`).
**Prevention:** When adding new fee types, they automatically appear via the catch-all. Only add explicit rendering if the fee needs special formatting (e.g., percentage display, clickable links).

---

## Pattern: Service Row Promotion from Notes to Product Table (2026-02-14)
**Date:** 2026-02-14
**Project:** [Pricing Index]
**Problem:** During ShopWorks import, Weight and Sewing services were dumped into the notes textarea as text. They weren't visible in the product table and weren't saved as fee line items.
**Root cause:** `confirmShopWorksImport()` had handling for some services (digitizing, rush, art) but Weight/Sewing/DT/Contract fell through to a catch-all that appended to notes.
**Solution:** Added `createServiceProductRow()` calls for sewing, weight, DT, and contract items. Added their keys to `handledServiceKeys` array so they don't fall to the catch-all. Extended `SERVICE_META` with metadata for each new type (description, icon, isCap flag, default price).
**Prevention:** When the parser adds a new service type, always (1) add to `SERVICE_META`, (2) add import handling in `confirmShopWorksImport()`, (3) add to `handledServiceKeys`, (4) add to `SERVICE_STYLE_NUMBERS`.

---

## Pattern: DOM Decoupling for Reusable Functions (2026-02-14)
**Date:** 2026-02-14
**Project:** [Pricing Index]
**Problem:** `generateProfessionalQuoteHTML()` and `sendQuoteEmail()` read `document.getElementById('shipping-fee')` and `document.getElementById('tax-rate-input')` directly. This couples them to the embroidery builder DOM, making them unusable from other contexts (e.g., quote-view resend, batch processing).
**Solution:** Added `options = {}` parameter with `options.shippingFee` and `options.taxRate`. Uses nullish coalescing `??` to fall back to DOM reads when options not provided. Backward-compatible — existing callers work unchanged.
**Prevention:** When a function reads from the DOM, consider whether it might be called from another context. If so, accept the values as parameters with DOM as fallback via `??`.

---

## Fix: resetQuote() crash + stale patch setup checkbox (2026-02-11)
**Date:** 2026-02-11
**Project:** [Pricing Index]
**Symptom:** Clicking "New Quote" in embroidery builder crashed with `recalculateAllPricing is not defined`. Additionally, importing an order without leather patches after one that had them left the `cap-patch-setup` checkbox checked, causing incorrect GRT-50 fee.
**Root cause (two bugs):**
1. `resetQuote()` called `recalculateAllPricing()` — a function that doesn't exist. The correct name is `recalculatePricing()`. The crash at line 7528 prevented `updateAdditionalCharges()`, `markAsSaved()`, and focus from running.
2. `resetQuote()` never unchecked the `cap-patch-setup` checkbox. The import code re-checks it when `patchSetup: true`, but reset needs to clear it first so consecutive imports start clean.
**Solution:** Fixed function name to `recalculatePricing()`. Added checkbox reset (`.checked = false` + remove `.checked` class from wrapper) alongside the other logo config resets.
**Prevention:** After renaming/removing a function, search for all call sites. When adding a new checkbox/toggle to a builder, always add its reset to `resetQuote()`.

---

## Fix: Falsy-zero bug in debug tax rate display (2026-02-11)
**Date:** 2026-02-11
**Project:** [Pricing Index]
**Symptom:** Debug console (`debugChargeVerification()`) showed "Tax Rate: 10.1%" for out-of-state quotes where `this.taxRate` was `0`.
**Root cause:** `const taxRate = this.taxRate || 0.101` — JavaScript `||` treats `0` as falsy and falls through to the default.
**Solution:** Changed to `this.taxRate ?? 0.101` (nullish coalescing) — only falls through on `null`/`undefined`, not `0`.
**Prevention:** Always use `??` instead of `||` when the variable can legitimately be `0`, `""`, or `false`. Reserve `||` for cases where all falsy values should trigger the default.

---

## Fix: Tax Lookup Crashes on Undeployed Backend + Import Loses Fallback Rate (2026-02-11)
**Date:** 2026-02-11
**Project:** [Pricing Index]
**Symptoms:** Importing ShopWorks order for Graham, WA 98338 showed 10.1% tax ($8.89) instead of 8.1% ($7.13). Console showed `SyntaxError: Unexpected token '<', "<!DOCTYPE "... is not valid JSON`.
**Root cause (two bugs):**
1. `lookupTaxRate()` called `resp.json()` without checking `resp.ok`. When backend wasn't deployed, the 404 HTML page caused a JSON parse crash.
2. Import code called `lookupTaxRate()` as fire-and-forget (no `await`). When it failed, the `else if` branch with the order summary's back-calculated rate (9.5%) was never reached. Tax stayed at default 10.1%.
**Solution:**
1. Added `if (!resp.ok) throw new Error(...)` before `resp.json()`
2. Made `lookupTaxRate()` return `true`/`false`. Import now `await`s it and falls back to order summary rate when lookup fails.
**Prevention:** Always check `resp.ok` before parsing JSON. Never fire-and-forget an async call when a fallback `else if` depends on its result — `await` it and check the return value.

---

## Feature: WA DOR Tax Rate Lookup — Hybrid API + Caspio (2026-02-11)
**Date:** 2026-02-11
**Project:** [Pricing Index] + [caspio-proxy]
**Problem:** WA sales tax varies by city (Milton=10.1%, Graham=8.1%, etc.). Embroidery builder defaulted to 10.1% requiring manual override per order, causing wrong tax on ~40% of quotes.
**Solution:** Hybrid lookup system:
1. Backend `POST /api/tax-rates/lookup` calls WA DOR API (`webgis.dor.wa.gov/webapi/AddressRates.aspx`) with address/city/zip
2. DOR returns location code + exact rate (e.g., 0.081 for Graham)
3. Rate matched to ShopWorks tax account in Caspio `sales_tax_accounts_2026` table (e.g., 0.081 → account `2200.81`)
4. Two caches: DOR results (24h TTL, keyed by ZIP), Caspio accounts (5min TTL)
5. Non-WA → account 2202 (0%). DOR failure → fallback to 10.1% with warning
6. Frontend: Ship To fields in embroidery builder, auto-lookup on ZIP blur or ShopWorks import
7. ShopWorks parser (`_parseShippingInfo()`) extracts address from `Ship Address:` line
**Prevention:** Always use DOR lookup for WA addresses. Out-of-state detection is automatic. DOR API is free, no auth needed.

---

## Fix: Shipping Not Taxed in Quote View / Email (WA State Requires It) (2026-02-11)
**Date:** 2026-02-11
**Project:** Pricing Index
**Symptoms:** Quote view, PDF, and email showed tax calculated on subtotal only (`$75.00 × 9.5% = $7.13`), but WA state requires tax on shipping too (`$87.99 × 9.5% = $8.36`). The embroidery quote builder UI already taxed shipping correctly, so saved quotes showed different totals when viewed.
**Root cause:** `quote-view.js` had `tax = subtotal * rate` in 4 places and `embroidery-quote-service.js` had `tax = subtotal * 0.101` in 2 email generation functions. Shipping was added after tax, not before.
**Solution:** Changed all 6 sites to `taxableAmount = subtotal + shipping; tax = round(taxableAmount * rate)`. Reordered display: Subtotal → Shipping → Tax → Total. Added shipping row to professional quote email HTML.
**Prevention:** WA state taxes shipping. When adding new tax calculation sites, always include shipping in the taxable base.

---

## Fix: 1-Cent Tax Rounding Error in Quote PDF Totals (2026-02-11)
**Date:** 2026-02-11
**Project:** Pricing Index
**Symptoms:** Quote EMB0211-1 PDF showed TOTAL $95.11, but $75.00 + $7.13 + $12.99 = $95.12. Off by 1 cent.
**Root cause:** Tax was computed as a raw float ($75 × 0.095 = $7.125), displayed rounded to $7.13, but added to the total as $7.125. The sum $75 + $7.125 + $12.99 = $95.115, which IEEE 754 represents as ~95.11499… so `toFixed(2)` rounds down to $95.11.
**Solution:** Round tax to cents **before** summing into total: `Math.round(subtotal * taxRate * 100) / 100`. Applied to all 4 tax calculation sites in `quote-view.js` (lines 1647, 1659, 2308, 2842).
**Prevention:** Standard accounting rule — round each component to cents first, then sum. Never sum unrounded floats and round only at the end.

---

## Bug: Embroidery Tier Ordering Wrong — API Returns Non-Sequential `tiersR`
**Date:** 2026-02-11
**Project:** [Pricing Index]

**Problem:** Compare Pricing and Manual Pricing embroidery cards showed tiers in wrong order: 1-7, 24-47, 48-71, 72+, 8-23. The 8-23 tier appeared last.

**Root Cause:** `fetchPricingData()` returns `tiersR` from the API in whatever order the database returns them. Unlike `generateManualPricingData()` which constructs tiers in hardcoded order, the API path has no guaranteed sort.

**Solution:** Sort `tierData` by `MinQuantity` before rendering: `[...tierData].sort((a, b) => (a.MinQuantity || 0) - (b.MinQuantity || 0))`. Applied to `renderEmbroidery()` and `renderCapEmbroidery()` in both `compare-pricing.js` and `manual-pricing.js`.

**Prevention:** Always sort API-returned tier data by `MinQuantity` before display. Never assume API returns data in presentation order.

**Files:** `calculators/compare-pricing.js`, `calculators/manual-pricing.js`

---

## Bug: LTM Fee Not Distributed in Manual/Compare Calculators — Price Mismatch
**Date:** 2026-02-11
**Project:** [Pricing Index]

**Problem:** Compare Pricing showed J790 embroidery 1-7 tier at $78.00 (base price), while customer-facing calculator showed $94.67. $16.67 discrepancy.

**Root Cause:** Customer-facing embroidery calculator distributes $50 LTM across pieces via `updateLTMCalculator()` (default 3 pcs → $50/3 = $16.67 added per piece). The internal calculators rendered raw base prices without LTM distribution.

**Solution:** Added LTM qty picker dropdown (1-7 pcs, default 3) to embroidery and cap embroidery cards. `renderEmbroidery()` adds `$50/ltmQty` to 1-7 tier prices only. Footer note clarifies: "1-7 prices include $50 LTM fee (N pcs). Tiers 8+ are standard pricing (no LTM)."

**Prevention:** When building new pricing displays, always check how the customer-facing calculator handles LTM/fees. The LTM Sync Rule (MEMORY.md) now covers 4 places: embroidery calculator, cap embroidery calculator, manual pricing, compare pricing.

**Files:** `calculators/compare-pricing.js`, `calculators/compare-pricing.html`, `calculators/manual-pricing.js`, `calculators/manual-pricing.html`, `calculators/manual-pricing.css`

---

## Bug: Embroidery/Cap Manual Pricing Crash — Double-Calculation of Already-Transformed Data
**Date:** 2026-02-11
**Project:** [Pricing Index]

**Problem:** Unified manual pricing page crashed with `TypeError: sizes is not iterable` when rendering embroidery and cap embroidery cards.

**Root Cause:** `generateManualPricingData()` in both `embroidery-pricing-service.js` and `cap-embroidery-pricing-service.js` internally calls `calculatePricing()` + `transformToExistingFormat()`, returning FINAL transformed data. The manual pricing page then called `calculatePricing()` AGAIN on the already-transformed output. The transformed data uses `uniqueSizes`/`tierData` instead of `sizes`/`tiersR`, so destructuring `sizes` yields `undefined` → crash.

**Solution:** Removed redundant `calculatePricing()` call. Cached the returned data directly. Updated render methods to destructure `tierData` (array of tier objects) instead of `tiers`.

**Prevention:**
- **Each pricing service's `generateManualPricingData()` has a different return contract.** DTG returns raw data (needs manual calculation). DTF/Embroidery/Cap/ScreenPrint return fully transformed data. Always check what the service returns before adding calculation steps.
- When reusing a service method, read its implementation to understand the return shape — don't assume it matches another service.

**Files:** `calculators/manual-pricing.js` (fetchEmbroidery, fetchCapEmbroidery, renderEmbroidery, renderCapEmbroidery)

---

## Change: ShopWorks Part Number Alignment — 10 Fixes Across 3 Files
**Date:** 2026-02-10
**Project:** [Pricing Index]
**Problem:** Frontend embroidery quote builder saved part numbers that didn't match what ShopWorks expects. 10 mismatches found: wrong casing (AS-GARM→AS-Garm, MONOGRAM→Monogram), wrong abbreviations (CSD→CS), non-standard formats (FB-30000→DECG-FB, AL-12000→AL), missing position-awareness for cap ALs (all saved as 'AL' instead of AL-CAP/CB/CS), and missing fee items (3D Puff and Laser Patch upcharges baked into per-piece price instead of separate line items).
**Root Cause:** Part numbers were defined organically as the builder was built, never cross-referenced against ShopWorks' actual part number list. Each service got whatever abbreviation felt natural at the time.
**Solution:**
1. Position-aware AL: garment→`AL`, cap front→`AL-CAP`, cap back→`CB`, cap side→`CS` (pricing engine)
2. Full Back: `DECG-FB` instead of `FB-{stitchCount}` (pricing engine)
3. Casing fixes: `AS-Garm` (service file), `Monogram` (HTML builder)
4. Cap Side abbreviation: `CS` instead of `CSD` (pricing engine)
5. 3D Puff/Laser Patch extracted from per-piece cap price → separate fee items (`3D-EMB`, `Laser Patch`). `grandTotal` updated to include `puffUpchargeTotal + patchUpchargeTotal`
6. `cap-embellishment-fee-row` added to UI for 3D/patch display
7. SERVICE_STYLE_NUMBERS + SERVICE_META updated with new entries + legacy backward-compat entries
**Prevention:**
- Always cross-reference part numbers against ShopWorks' master list before adding new services
- Keep legacy part numbers in SERVICE_STYLE_NUMBERS for backward compatibility with old saved quotes
- Backend Caspio proxy was already correct — frontend was the only place with mismatches
**Files:** `shared_components/js/embroidery-quote-pricing.js`, `shared_components/js/embroidery-quote-service.js`, `quote-builders/embroidery-quote-builder.html`

---

## Change: Stitch Surcharges Switched from Linear to Flat Tiers
**Date:** 2026-02-10
**Project:** [Pricing Index] + [caspio-proxy]
**Problem:** Additional stitch fees (AS-GARM/AS-CAP) used a linear per-1K rate formula: `(stitchCount - 8000) / 1000 × $1.25` for garments, `$1.00` for caps. This produced inconsistent prices (e.g., 12K stitches = $5.00, 18K = $12.50) that didn't match business intent.
**Root Cause:** The pricing model was inherited from the original linear rate system. Business actually wanted simple flat tier pricing: $4 for Mid (10K-15K), $10 for Large (15K-25K).
**Solution:**
1. Added `stitchSurchargeTiers` array and `getStitchSurcharge(stitchCount)` method to `embroidery-quote-pricing.js` — returns flat $0/$4/$10
2. Replaced 3 linear calculation sites (garment primary, cap per-product, cap total) with flat tier lookup
3. Added 4 new rows to Caspio `Embroidery_Costs` table: `AS-Garm`/`AS-Cap` × `StitchCount=10000` ($4) and `15000` ($10), `TierLabel='ALL'`
4. Added `'AS-Garm', 'AS-Cap'` to `allowedItemTypes` in `caspio-pricing-proxy/src/routes/pricing.js:109`
5. Created "Additional Stitch Charges" tab on embroidery pricing calculator page with tier cards, customer surcharge list (107 designs), and Full Back table
**Prevention:** AL and Full Back stitch costs still use linear per-1K rates — do NOT change those. Only primary logo stitch surcharges use flat tiers.
**Files:** `shared_components/js/embroidery-quote-pricing.js` (pricing engine), `caspio-pricing-proxy/src/routes/pricing.js` (API), `calculators/embroidery-pricing-all/` (staff reference tab)

---

## Pattern: Retry Wrapper for POST/PUT API Calls — `_fetchWithRetry()`
**Date:** 2026-02-10
**Project:** [Pricing Index]
**Problem:** 9 POST/PUT fetch calls in the embroidery quote service had no retry logic. A transient network hiccup or 5xx error = lost data, no recovery.
**Solution:** Added `_fetchWithRetry(url, options, maxRetries = 2)` to `EmbroideryQuoteService`. Retries on network errors, 5xx, and 429 with exponential backoff (1s, 2s). Does NOT retry 4xx (client errors). Returns the Response object so existing `.ok` checks work unchanged.
**Prevention:** All new POST/PUT calls in quote services should use `_fetchWithRetry()` instead of raw `fetch()`. GET calls don't need it (already have fallbacks).
**Files:** `shared_components/js/embroidery-quote-service.js` (`_fetchWithRetry()`, 9 call sites)

---

## Fix: Partial Quote Save Shown as Full Success
**Date:** 2026-02-10
**Project:** [Pricing Index]
**Problem:** `saveQuote()` returned `{ success: true, partialSave: true, warning: "..." }` when some items failed to save, but the caller only checked `result.quoteID`. User saw "Quote saved successfully!" with missing items.
**Root Cause:** Caller didn't check `result.partialSave` flag. The service returned the data, but the UI ignored the warning.
**Solution:** Added `if (result.partialSave && result.warning) showToast(result.warning, 'error')` before the success modal in the save handler.
**Prevention:** Any API response with a `partialSave` or `warning` field must be surfaced to the user, not silently swallowed.
**Files:** `quote-builders/embroidery-quote-builder.html` (~line 6584)

---

## Fix: Quote Update Race Condition — DELETE-then-INSERT Risks Data Loss
**Date:** 2026-02-10
**Project:** [Pricing Index]
**Problem:** `updateQuote()` deleted ALL existing quote items, then re-inserted them one by one. If the browser crashed or network failed mid-insert, the quote was permanently empty — all items lost with no recovery.
**Root Cause:** Classic delete-then-insert anti-pattern. The delete was unconditional and happened before any new data was written.
**Solution:** Reversed to insert-then-delete: (1) capture existing item IDs, (2) insert all new items, (3) only delete old items if ALL new inserts succeeded. If any inserts fail, old items are preserved and an error is thrown.
**Prevention:** For any replace-all operation on important data, always write new data first, verify success, then remove old data. Never delete before confirming the replacement exists.
**Files:** `shared_components/js/embroidery-quote-service.js` (`updateQuote()`, `fetchExistingItemIds()`, `deleteExistingItems()`)

---

## Fix: Quote Sequence Race Condition — Concurrent Requests Get Duplicate IDs
**Date:** 2026-02-10
**Project:** [caspio-proxy]
**Problem:** Two rapid save clicks or two browser tabs could get the same quote sequence number because the GET-then-PUT on Caspio's `quote_counters` table isn't atomic.
**Root Cause:** Caspio doesn't support atomic increment. The endpoint reads `NextSequence`, returns it, then PUTs the incremented value. Two concurrent requests could read the same value before either increments.
**Solution:** Added in-memory mutex lock per prefix (`acquireLock`/`releaseLock`). Concurrent requests for the same prefix are serialized via a promise queue. Lock is always released in a `finally` block.
**Prevention:** Any read-modify-write pattern on Caspio needs application-level locking. Since there's one backend server, an in-memory mutex per key is sufficient.
**Files:** `caspio-pricing-proxy/src/routes/quote-sequence.js`

---

## Fix: ShopWorks Import Duplicate Detection Dropping Rows ($366 Discrepancy)
**Date:** 2026-02-10
**Project:** [Pricing Index]
**Problem:** Order #136706 showed $3,591 in the embroidery quote builder but should have been $3,957. Six product rows were silently dropped during ShopWorks import, losing $366.
**Root Cause:** `selectColor()` has duplicate detection that prevents adding the same style+color combination twice (shows "already exists" toast and returns early). During ShopWorks import, products with the same style and same color but different prices (e.g., M=$61 vs 2XL=$63 due to size upcharges) were being rejected as duplicates. The first row imported fine, but subsequent rows for the same style+color were silently skipped.
**Solution:** Added `skipDuplicateCheck` parameter to `selectColor()`. When called from `importProductRow()`, passes `skipDuplicateCheck=true` to bypass the duplicate detection. Manual interactive use still gets duplicate warnings.
**Prevention:**
- Import flows should always bypass interactive safety checks (duplicate detection, confirmation dialogs) since the data is already validated
- Added **post-import validation** (line ~8788): after import completes, counts expected vs actual valid product rows. If any rows are missing `data-color`, shows a warning toast. This catches **any** future row-drop scenario regardless of cause.
**Files:** `embroidery-quote-builder.html` (`selectColor()`, `importProductRow()`, post-import validation block)

## Bug: Custom Price Override Lost During ShopWorks Import (Async Race Condition)
**Date:** 2026-02-06
**Project:** [Pricing Index]
**Problem:** User selects "Custom" radio in the ShopWorks import review modal and enters $55.00 for NKDM3976 (Nike duffel bag). After import, the product shows $67.50 (API price) instead of $55.00. The custom price override was silently discarded.
**Root Cause:** `importProductRow()` set `row.dataset.sellPrice` at line 8878 — **after** `selectColor()` at line 8789. `selectColor()` calls `recalculatePricing()` asynchronously (fire-and-forget, not awaited). The timeline:
1. `selectColor()` fires `recalculatePricing()` — sellPrice NOT yet set → calculates API price ($67.50)
2. Code continues, sets sizes, then finally sets `row.dataset.sellPrice = "55"`
3. `onSizeChange()` fires `recalculatePricing()` — sees sellPrice → calculates $55.00
4. `selectColor()`'s async `recalculatePricing()` resolves **last** → overwrites $55.00 with $67.50

Additionally, two early-return paths (non-SanMar, not-found) skipped the sellPrice assignment entirely.
**Solution:** Move `row.dataset.sellPrice` assignment to immediately after row creation (line 8745), **before** any pricing-related calls (`onStyleChange`, `selectColor`, `onSizeChange`). Remove the duplicate late assignment.
**Prevention:** When a function sets dataset attributes that affect pricing, always set them **before** any function that triggers `recalculatePricing()`. Async fire-and-forget calls are especially dangerous — they resolve in unpredictable order. Rule of thumb: **dataset setup first, then trigger pricing.**
**Files:** `embroidery-quote-builder.html` (`importProductRow()` ~line 8745)

## Bug: SanMar Prices Lost + Empty-PN Items Show No Price After ShopWorks Import
**Date:** 2026-02-09
**Project:** [Pricing Index]
**Problem:** Two ShopWorks import bugs: (A) SanMar products used API-calculated prices instead of ShopWorks invoiced prices (e.g., C909 showed $20 instead of $23). (B) Empty-PN items like "drinkware laser logo setup" showed "-" for price instead of the expected $65.
**Root Cause A:** `selectColor()` (line 4668) deletes `row.dataset.sellPrice` for SanMar products (`nonSanmar !== 'true'`). During import, `sellPriceOverride` was re-applied at line 8625 (after `onStyleChange`) but **before** `selectColor()`. After `selectColor()` deleted it, no re-apply existed. The pricing engine saw `sellPriceOverride = 0` and used API pricing.
**Root Cause B:** Empty-PN handler set `row.dataset.style = ''` (empty string) and had no color. `collectProductsFromTable()` checks `if (!style || !parentColor) return` — both empty, so the row was skipped entirely, producing "-" in price display.
**Solution A:** Re-apply `sellPriceOverride` immediately after `selectColor()` and its 300ms wait (line 8760-8762).
**Solution B:** Set `row.dataset.style = product.description || 'Custom Item'` instead of empty string (line 8631). Set default color `product.color || 'N/A'` with dataset assignments before calling `reImportNonSanmarRow()` (lines 8712-8714).
**Prevention:** Any function that clears dataset attributes (like `selectColor()` clearing `sellPrice`) is dangerous during import flows. Always re-apply overrides **after** every function that might clear them, not just before. For empty/missing data, use sentinel values ('N/A', 'Custom Item') instead of empty strings when downstream code has `if (!value)` guards.
**Files:** `embroidery-quote-builder.html` (lines 8760-8762, 8631, 8712-8714)

## Bug: "Unable to load size pricing for DECG" on ShopWorks DECG-Only Import
**Date:** 2026-02-06
**Project:** [Pricing Index]
**Problem:** Pasting a ShopWorks order with only DECG/DECC items (customer-supplied garments, no SanMar products) showed a red error banner: "Unable to load size pricing for style DECG." The import partially worked but the error was confusing.
**Root Cause:** `collectProductsFromTable()` pushes DECG service rows into `products[]` with `isService: true`. In `recalculatePricing()`, the check `if (productList.length === 0)` was supposed to trigger the DECG-only path, but the array contained the service row so `length > 0`. The pricing engine then tried `fetchSizePricing('DECG')` which returned nothing, triggering the error.
**Solution:** Filter service items out before sending to pricing engine:
```javascript
const allItems = collectProductsFromTable();
const productList = allItems.filter(p => !p.isService);
const serviceItems = allItems.filter(p => p.isService);
```
For mixed orders (SanMar + DECG), add service item totals back to `pricing.subtotal` and `pricing.grandTotal` after the engine returns.
**Prevention:** When a collection function returns mixed item types (products vs. services), always filter before passing to type-specific logic. Don't assume `length > 0` means "has real products."
**Files:** `embroidery-quote-builder.html` (lines 5192-5194, 5375-5382)

## Pattern: Non-SanMar Product "Add on the Fly" in Quote Builder
**Date:** 2026-02-06
**Project:** [Pricing Index]
**Problem:** ShopWorks orders with non-SanMar products (e.g. HT01 Edwards Skull Cap) failed silently — showed "Not found" with no way to proceed. The `Non_SanMar_Products` API existed but was disconnected from the quote builder.
**Solution:** Three-tier fallback in `onStyleChange()`: (1) SanMar API, (2) Non-SanMar Products API, (3) "Add" button with modal. Pricing engine supports `sellPriceOverride` — bypasses margin formula via `buildFixedPriceResult()`. ShopWorks parser's `customProducts` now imported as real rows instead of notes.
**Key Design Decisions:**
- Sell price override = user enters final decorated price (no margin calculation)
- `parseShopWorksDescription()` pre-parses brand/name/color/category from ShopWorks description patterns
- Non-SanMar rows get simplified color picker (no swatch images) and manually-set size UI
- LTM still distributes on top of sell price override (it's a minimum order surcharge, not part of product price)
**Prevention:** When adding a new product source, always wire it into the existing product lookup chain rather than creating a parallel flow.
**Files:** `embroidery-quote-builder.html`, `embroidery-quote-pricing.js`

## Bug: /api/embroidery-costs Endpoint Always Returns 400
**Date:** 2026-02-05
**Project:** [caspio-proxy]
**Problem:** `GET /api/embroidery-costs?itemType=Shirt&stitchCount=8000` always returned 400. The endpoint appeared non-functional since creation.
**Root Cause:** WHERE clause referenced `StitchCountRange` (non-existent field). The actual Caspio field is `StitchCount`. Also the value was quoted as a string (`'8000'`) but it's a numeric field.
**Solution:** Changed `StitchCountRange='${stitchCount}'` to `StitchCount=${stitchCountInt}`. Added itemType whitelist and integer validation for security.
**Prevention:** When writing Caspio WHERE clauses, always verify field names against the actual table schema. Use the Caspio DataPage builder to confirm field names.
**File:** `caspio-pricing-proxy/src/routes/pricing.js`

## Discovery: Fee Items Not Saved as quote_items Line Items
**Date:** 2026-02-05
**Project:** [Pricing Index]
**Problem:** Embroidery quote fees (digitizing, stitch charges, art, rush, LTM, discount) were stored ONLY as session-level fields on `quote_sessions`. ShopWorks order entry was incomplete because each fee has a specific part number that should appear as a separate line.
**Solution:** Added `_saveFeeLineItems()` method to `embroidery-quote-service.js`. Saves 11 fee types as `quote_items` with `EmbellishmentType: 'fee'` and correct ShopWorks part numbers (AS-GARM, AS-CAP, DD, GRT-50, GRT-75, RUSH, SAMPLE, LTM, DISCOUNT).
**Prevention:** When adding new charge types to quote builders, always consider: does this need its own line item for ShopWorks order entry?

## Bug: Garment Tracker Archive Silently Archiving 0 Records for 11 Days
**Date:** 2026-02-05
**Project:** [caspio-proxy]
**Problem:** The Heroku Scheduler ran `npm run archive-garment-tracker` daily since Jan 25, but archived 0 records every time. The script reported "SUCCESS" with exit code 0, so Heroku showed no errors.
**Symptoms:** Archive table had only 15 records (from initial manual backfill on Jan 25). Live table had 22 records. 11 days of scheduled runs produced nothing.
**Root Cause:** Two bugs in the `archive-range` endpoint (`garment-tracker.js`):
1. Tried to read `Part01`-`Part10` fields on ManageOrders ORDER objects, but part numbers only exist on LINE ITEMS (separate API call via `fetchLineItems()`)
2. Used exact `===` matching for part numbers instead of `startsWith()` — missed size variants like `CT104670_2X`, `112_OSFA`
**Solution:**
1. Changed daily script default from `archive-range` (broken) to `archive-from-live` (working) — copies live GarmentTracker table to archive
2. Rewrote `archive-range` endpoint to use `fetchLineItems()` per order with `startsWith` matching
3. Added dashboard-triggered background archival as safety net (fire-and-forget on page load)
4. Added `console.warn` 0-record warnings to ALL 4 Heroku Scheduler scripts
**Prevention:**
- **Never assume ManageOrders order objects have part/line item data** — always use `fetchLineItems(orderId)` for part numbers
- **Use `startsWith(base + '_')` matching** for part numbers, never exact equality
- **Add 0-record warnings** to any archival/sync script — silent "success" with no data is a hidden failure
- **Test archival scripts end-to-end** by checking if records actually appear in the target table, not just that the script exits 0
**Files:**
- `caspio-pricing-proxy/scripts/archive-garment-tracker.js` (default mode changed)
- `caspio-pricing-proxy/src/routes/garment-tracker.js` (archive-range rewritten)
- `caspio-pricing-proxy/scripts/archive-daily-sales.js` (0-record warning added)
- `caspio-pricing-proxy/scripts/sync-crm-dashboards.js` (0-record warning added)
- `caspio-pricing-proxy/scripts/sync-contacts.js` (0-record warning added)
- `shared_components/js/staff-dashboard-service.js` (dashboard archival function added)
- `shared_components/js/staff-dashboard-init.js` (background archival trigger added)

## Bug: Manual Calculator Used Old 4-Tier Tiers While Quote Builder Used New 5-Tier
**Date:** 2026-02-02
**Project:** [Pricing Index]
**Problem:** The embroidery manual pricing calculator (`embroidery-manual-service.js`) still showed the old 4-tier structure (1-23, 24-47, 48-71, 72+) while the quote builder and integrated calculator had been updated to the new 5-tier structure (1-7, 8-23, 24-47, 48-71, 72+).
**Root Cause:** When the Feb 2026 tier restructure was implemented, the manual calculator service was missed. It had hardcoded tier labels and fallback pricing that weren't updated.
**Solution:** Updated `embroidery-manual-service.js` and related files:
1. Updated `getTierLabel()` function with new 5-tier boundaries
2. Updated `defaultTiers` array with new tier labels
3. Updated fallback pricing in `FALLBACK_PRICING` object
4. Updated LTM threshold from `< 24` to `<= 7`
**Prevention:**
- When changing pricing tiers, search ALL files for tier-related strings: `'1-23'|"1-23"|< 24|getTier|getTierLabel|LTM`
- Created master reference document `/memory/PRICING_TIERS_MASTER_REFERENCE.md` with all tier structures
- Added verification checklist for tier changes
**Files:**
- `calculators/embroidery-manual-service.js`
- `calculators/cap-embroidery-manual-service.js`
- `calculators/cap-embroidery-manual-pricing.html`
- `calculators/embroidery-manual-pricing.html` (if exists)
**See also:** `/memory/PRICING_TIERS_MASTER_REFERENCE.md`

---

## Embroidery Pricing Restructure 2026-02
**Date:** 2026-02-02
**Project:** [Pricing Index]
**Change:** Updated embroidery pricing tier structure from 4 tiers to 5 tiers.
**Old Tiers:** 1-23 (LTM), 24-47, 48-71, 72+
**New Tiers:** 1-7 (LTM $50), 8-23 (no LTM, +$4 surcharge baked in), 24-47, 48-71, 72+
**Files Modified:**
- `shared_components/js/embroidery-quote-pricing.js` - Core `getTier()` and LTM logic
- `shared_components/js/cap-quote-pricing.js` - `getTierLabel()` and LTM logic
- `shared_components/js/embroidery-pricing-service.js` - Default tiers
- `shared_components/js/additional-logo-embroidery-simple.js` - Fallback pricing
- `shared_components/js/additional-logo-cap-simple.js` - Fallback pricing
- `shared_components/js/base-quote-service.js` - Base tier function
- `shared_components/js/cap-quote-service.js` - Cap tier function
- `shared_components/js/quote-builder-core.js` - Core tier function
- `shared_components/js/embroidery-quote-invoice.js` - Invoice tier fallbacks
- `shared_components/js/embroidery-quote-products.js` - Products display
- `shared_components/js/cap-quote-products.js` - Cap products display
- `shared_components/js/product-pricing-ui.js` - UI tier config
- `quote-builders/embroidery-quote-builder.html` - Default badges and fallbacks
- `calculators/embroidery-pricing.html` - Table headers and info text
**Key Changes:**
1. LTM/Setup fee now only applies to 1-7 pieces (was 1-23)
2. 8-23 tier has no LTM but +$4/piece surcharge baked into EmbroideryCost
3. All boundary checks changed from `< 24` to `<= 7` for LTM
4. HTML displays updated with new tier columns and messaging
**Prevention:** When changing pricing tiers, search ALL files for tier-related strings and functions. Use grep: `'1-23'|"1-23"|< 24|getTier|getTierLabel|LTM`
**See also:** `/memory/EMBROIDERY_PRICING_2026.md`

---

## Bug: Phone Field in Quote Builders Wasn't Stored Anywhere
**Date:** 2026-01-29
**Project:** [Pricing Index]
**Problem:** All 4 quote builders had a Phone field in the customer info form, but it was never saved to the database. Users entered phone numbers that were silently discarded.
**Root Cause:** The `quote_sessions` Caspio table and `Company_Contacts_Merge_ODBC` table don't have a Phone column. The quote service files never included Phone in the data payload.
**Solution:** Removed the Phone field from all 4 quote builder HTML forms:
- `dtf-quote-builder.html`
- `dtg-quote-builder.html`
- `screenprint-quote-builder.html`
- `embroidery-quote-builder.html`
**Prevention:** Before adding form fields to quote builders:
1. Verify the field exists in `quote_sessions` Caspio table
2. Verify the quote service includes the field in save/update payloads
3. Test that the field persists after save and reload
**See also:** `/memory/CUSTOMER_LOOKUP_SYSTEM.md`

---

## Bug: Chunk Boundary Overlap Causes Double-Counting
**Date:** 2026-01-25
**Project:** [caspio-proxy]
**Problem:** Sync-sales endpoints showed YTD totals ~10% higher than ManageOrders. Some accounts had exactly DOUBLE the correct amount.
**Root Cause:** Orders were fetched in 20-day chunks to avoid API timeouts, but chunk boundaries overlapped. Orders invoiced on boundary dates (e.g., Jan 5) appeared in multiple chunks and were counted twice.
**Solution:** Added deduplication by `id_Order` before aggregation:
```javascript
const seenOrderIds = new Set();
const uniqueOrders = allOrders.filter(order => {
    if (seenOrderIds.has(order.id_Order)) return false;
    seenOrderIds.add(order.id_Order);
    return true;
});
```
**Prevention:** When fetching data in chunks, ALWAYS deduplicate by unique ID before processing. Chunk boundary dates are inherently risky.
**Files fixed:** `nika-accounts.js`, `taneisha-accounts.js`, `house-accounts.js`
**See also:** `/memory/CRM_DASHBOARD_RECONCILIATION.md`

## Pattern: Rate Limit Handling with Exponential Backoff
**Date:** 2026-01-28
**Project:** [Pricing Index]
**Problem:** Rep CRM dashboards (Nika, Taneisha) failed to load when API returned 429 (rate limited). Users saw generic errors with no recovery.
**Root Cause:** No retry logic in `rep-crm.js` - all API calls were single-shot.
**Solution:** Added linear exponential backoff (5s → 10s → 15s) on 429 responses:
```javascript
async fetchAccounts(filters = {}, retries = 3) {
    const response = await fetch(url, { credentials: 'same-origin' });

    // Retry on rate limit with exponential backoff
    if (response.status === 429 && retries > 0) {
        const waitTime = (4 - retries) * 5000; // 5s, 10s, 15s
        console.warn(`[RepCRM] Rate limited (429), retrying in ${waitTime/1000}s...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        return this.fetchAccounts(filters, retries - 1);
    }
    // ... rest of function
}
```
**Prevention:** All API fetch functions should include retry logic for 429 responses. Copy pattern from `house-accounts.js` or `rep-crm.js`.
**Files with pattern:** `house-accounts.js`, `rep-crm.js`, `ApiService.js`
**Rate limits:** Server: 200 req/15min, ManageOrders backend: 30 req/min

---

## Bug: Quote URL Save/Load Lost Additional Fees (Art Charge, Rush, Discount)
**Date:** 2026-01-28
**Project:** [Pricing Index] (All 4 Quote Builders)
**Problem:** When user saved a quote with fees (art charge $50, rush fee $25, discount 10%) and shared the URL, loading that quote showed all fees as $0. The fees were never saved to the database.
**Root Cause:** Only Embroidery quote service was saving fee fields to `quote_sessions` table. DTG, Screen Print, and DTF services didn't include these fields in `sessionData` object. Additionally, no `populateAdditionalCharges()` function existed to restore fees when loading.
**Solution:**
1. Updated all quote services (`dtg-quote-service.js`, `screenprint-quote-service.js`, `dtf-quote-service.js`) to save fee fields:
   - `ArtCharge`, `GraphicDesignHours`, `GraphicDesignCharge`
   - `RushFee`, `Discount`, `DiscountPercent`, `DiscountReason`
2. Added `populateAdditionalCharges(session)` function to all 4 quote builders
3. Called `populateAdditionalCharges()` in `loadQuoteForEditing()` after `populateCustomerInfo()`
**Prevention:** When adding new fee fields to quote builders:
1. Add column to Caspio `quote_sessions` table (if not exists)
2. Add field to ALL quote service `sessionData` objects (save AND update methods)
3. Add restore logic in `populateAdditionalCharges()` for ALL builders
4. Test save/load round-trip for each quote type
**Files:**
- `shared_components/js/dtg-quote-service.js`, `screenprint-quote-service.js`, `dtf-quote-service.js`
- `quote-builders/dtg-quote-builder.html`, `screenprint-quote-builder.html`, `dtf-quote-builder.html`
**Database:** All columns already existed in `quote_sessions` - just weren't being used by all services.

---

## Rule: ALWAYS Pull Pricing From Caspio API - Never Hardcode
**Date:** 2026-01-15
**Project:** [All]
**Context:** When adding 3D Puff embroidery upcharge ($5/cap), initially hardcoded the value in JavaScript. This violates our pricing architecture.
**The Rule:** ALL pricing values MUST come from Caspio API, never hardcoded in frontend code.
**Why:**
1. Single source of truth - update price in Caspio, all apps update automatically
2. No code deploys needed for price changes
3. Sales team can adjust pricing without developer involvement
4. Audit trail in Caspio for price history
**Pattern:** Store pricing in Caspio tables (Pricing_Tiers, Embroidery_Costs, etc.) → Fetch via caspio-pricing-proxy API → Use in calculators/quote builders
**Files affected:** `embroidery-quote-pricing.js`, all pricing calculators
**See also:** `/memory/QUOTE_BUILDER_GUIDE.md` for pricing data flow

---

## Pattern: Mixed Quote Tier Separation (Caps vs Garments)
**Date:** 2026-02-01
**Project:** [Pricing Index]
**Context:** Embroidery quotes with both caps and garments require SEPARATE tier calculations.

**The Rule:** Caps and garments CANNOT be combined for quantity discounts. Each product type gets its own tier.

**Example - 18 caps + 30 shirts:**
```javascript
// WRONG - Combined quantities
totalQty = 18 + 30;  // 48 -> 48-71 tier for everything

// CORRECT - Separate tiers
garmentTier = getTier(30);  // 24-47 tier
capTier = getTier(18);      // 1-23 tier (plus LTM!)
```

**Why Separate:**
- Different embroidery methods (flat vs structured cap embroidery)
- Different base stitch counts (garments: 8K, cap AL: 5K)
- Different stitch rates (garments: $1.25/1K, caps: $1.00/1K)
- Industry standard practice
- Different LTM application (each type under 24 gets separate $50 fee)

**LTM Implications:**
- 18 caps alone: $50 cap LTM
- 30 shirts alone: No LTM (24-47 tier)
- Both together: Still $50 cap LTM (caps < 24)

**Files:**
- `embroidery-quote-pricing.js` lines 1203-1211 (tier separation)
- `embroidery-quote-pricing.js` lines 1305-1332 (LTM separation)

**See also:** `/memory/EMBROIDERY_PRICING_RULES.md` for complete mixed quote documentation

---

## Pattern: Two Embroidery Pricing Systems (Both Use Service_Codes API)
**Date:** 2026-02-01
**Project:** [Pricing Index]
**Context:** Pricing audit revealed two independent pricing systems that must stay in sync.

**The Two Systems:**
| System | Purpose | File | API Source |
|--------|---------|------|------------|
| **Quote Builder** | Build new quotes from scratch (manual entry) | `embroidery-quote-pricing.js` | `/api/pricing-bundle`, `/api/service-codes` |
| **ShopWorks Import** | Import existing ShopWorks orders | `shopworks-import-parser.js` | `/api/service-codes` |

**Service_Codes API (38 records):**
Both systems fetch from the same `Service_Codes` Caspio table via `/api/service-codes`:
- **CONFIG values:** STITCH-RATE, CAP-STITCH-RATE, CAP-DISCOUNT, HEAVYWEIGHT-SURCHARGE, PUFF-UPCHARGE, PATCH-UPCHARGE
- **Fees:** LTM, GRT-50, GRT-75, RUSH, ART, SEG, DD
- **Embroidery:** AL (4 tiers), CB (4 tiers), FB (stitch-based), Monogram, Name
- **Decoration:** DECG (7 tiers), DECC (7 tiers)

**How They Load Data:**
- `embroidery-quote-pricing.js`: Calls `loadServiceCodes()` during `initializeConfig()` - loads FB, LTM, GRT-50, Monogram, STITCH-RATE, CAP-STITCH-RATE, PUFF-UPCHARGE, PATCH-UPCHARGE
- `shopworks-import-parser.js`: Calls `loadServiceCodes()` + `_buildPricingTables()` - loads DECG/DECC tiers, Monogram, LTM, CAP-DISCOUNT, HEAVYWEIGHT-SURCHARGE, GRT-75

**Prevention:**
1. When adding new pricing values, add to BOTH systems if applicable
2. Add to `Service_Codes` Caspio table first (via `/api/service-codes/seed` or POST)
3. Update the loader in each JS file to fetch the new value
4. Keep fallback defaults in constructors (only used if API fails)

**Files:**
- `shared_components/js/embroidery-quote-pricing.js` (lines 256-341)
- `shared_components/js/shopworks-import-parser.js` (lines 142-236)
- `caspio-pricing-proxy/src/routes/service-codes.js` (seed data lines 280-337)

**See also:** `/memory/SERVICE_CODES_TABLE.md` for complete table schema

---

## Problem: Quote items accumulate instead of being replaced on re-save
**Date:** 2026-01-14
**Project:** Pricing Index (Embroidery Quote Builder)
**Symptoms:** Quote View showed 470+ items including products never added. Prices completely wrong. SubtotalAmount didn't match Items Total.
**Root cause:** `saveQuote()` in quote service only POSTed new items, never deleted existing ones first. Quote ID generation uses sessionStorage which resets on page refresh, allowing same ID to be reused.
**Solution:** Added `deleteExistingItems(quoteID)` method that:
1. Queries existing items by QuoteID
2. Deletes them in parallel batches (10 at a time) before inserting new ones
**Prevention:** ANY quote save operation MUST delete existing items for that QuoteID before inserting. Use parallel batches for bulk operations. See QUOTE_BUILDER_GUIDE.md "Critical Save Pattern" section.
**Files:** `/shared_components/js/embroidery-quote-service.js` lines 94-125, 239

---

## Problem: Extra stitch charges double-counted in unit price AND line item
**Date:** 2026-01-14
**Project:** Pricing Index (Embroidery Quote Builder)
**Symptoms:** J790 @ 9000 stitches showed $74.25 (base $72 + $2.25 stitch) in matrix, PLUS separate AS-GARM line item. Customer pays twice.
**Root cause:** `calculateProductPrice()` received non-zero `additionalStitchCost` parameter AND the pricing engine calculated stitch totals separately.
**Solution:** Pass `0` to `calculateProductPrice()` - extra stitches shown ONLY as separate AS-GARM/AS-CAP line items, never embedded in unit price.
**Files:**
- `embroidery-quote-pricing.js` line 1040: Pass `0` instead of `primaryAdditionalStitchCost`
- `embroidery-quote-pricing.js` line 422: Use `roundedBase` not `roundedBase + capExtraStitchCost`
**Prevention:** Extra charges (stitches, additional logos, setup fees) should NEVER be embedded in unit price. Always show as separate fee line items with ShopWorks SKUs.

---

## Decision: Additional Stitch Charges as Separate Line Item (Not Baked Into Unit Price)
**Date:** 2026-01-14
**Project:** Pricing Index (Embroidery Quote Builder, Quote View, PDF)
**Context:** When embroidery logos exceed 8000 stitches, there's an additional charge ($1.25/1K for garments, $1.00/1K for caps). Previously, this was BOTH baked into the unit price AND shown as a separate sidebar line (informational only), causing confusion.
**Decision:** Display base price (8K stitches) in the table, with Additional Stitches as a SEPARATE line item that is ADDED to the total. This follows B2B industry standard for transparent, itemized quotes.
**Changes made:**
1. `embroidery-quote-pricing.js` - Line item totals now use `basePrice` (8K) instead of `finalPrice` (with stitches); `grandTotal` now explicitly adds `additionalStitchTotal`
2. `embroidery-quote-builder.html` - Table displays `basePrice`, sidebar label changed to "Products (Base 8K)"
3. `quote-view.js` - Re-added ADDL-STITCH fee row (was removed when stitches were baked in)
**Result:**
- Table shows: "$21.00/ea" (base price only)
- Sidebar shows: "Additional Stitches: $47.50" (clearly ADDED)
- More transparent for B2B customers; easier to explain pricing

---

## Fee Line Item Naming Standardization (ShopWorks Alignment)
**Date:** 2026-01-14
**Project:** Pricing Index (Quote Builder, Quote View, PDF)
**Context:** Fee line item SKUs and descriptions were inconsistent with ShopWorks naming conventions. User requested standardization for consistency.

**Naming Changes:**
| Old SKU | New SKU | Old Description | New Description |
|---------|---------|-----------------|-----------------|
| ADDL-STITCH | AS-GARM / AS-CAP | Additional Stitch Charge | Additional Stitches in Garment Logo / Cap Logo |
| AL-GARMENT | AL-GARM | AL: Additional Logo | Additional Logo - Garments |
| AL-CAP | CB | AL: Cap Logo | Cap Back Embroidery |
| DIGITIZE-G | DD | Garment Digitizing | Digitizing Setup Garments |
| DIGITIZE-C | DD-CAP | Cap Digitizing | Digitizing Setup Cap |
| ARTWORK | GRT-50 | Art Charge / Redraw | Logo Mockup & Print Review |
| LTM-G | LTM | LTM Fee: Garments | Less than minimum fee garments |
| LTM-C | LTM-CAP | LTM Fee: Caps | Less than minimum fee Caps |
| SAMPLE | **REMOVED** | Sample Fee | (Removed from UI) |

**Files Changed:**
1. `pages/js/quote-view.js` - `renderFeeRows()` and `renderPdfFeeRows()` updated with new SKUs/descriptions
2. `shared_components/js/embroidery-quote-pricing.js` - Split `additionalStitchTotal` into `garmentStitchTotal` and `capStitchTotal`
3. `shared_components/js/embroidery-quote-service.js` - Added `GarmentStitchCharge` and `CapStitchCharge` fields
4. `quote-builders/embroidery-quote-builder.html` - Updated sidebar labels, removed Sample Fee

**Prevention:** When adding new fee types, check ShopWorks for standard naming conventions first.

---

## Problem: Digitizing fees combined into one row instead of separate garment/cap rows
**Date:** 2026-01-14
**Project:** Pricing Index (Embroidery Quote Builder)
**Symptoms:** Quote View showed one "DIGITIZE-G" row at $200 instead of two rows: "DIGITIZE-G" at $100 and "DIGITIZE-C" at $100. Quote Details header correctly showed them separately, but line items table combined them.
**Root cause:** In `saveAndGetLink()` function, `calculateQuote()` was called WITHOUT the `logoConfigs` parameter. Without it, the pricing engine uses the legacy path that counts ALL logos as garment digitizing:
```javascript
// Legacy path (line 1223-1225 in embroidery-quote-pricing.js):
garmentDigitizingCount = logos.filter(l => l.needsDigitizing).length;  // Counts ALL as garment!
```
Result: `GarmentDigitizing = $200`, `CapDigitizing = $0`
**Solution:** Added `logoConfigs` parameter to `saveAndGetLink()` to match `recalculatePricing()`:
```javascript
const logoConfigs = {
    garment: { primary: { ...primaryLogo, id: 'primary' }, additional: additionalLogos },
    cap: { primary: { ...capPrimaryLogo, id: 'cap-primary' }, additional: capAdditionalLogos }
};
const pricing = await pricingCalculator.calculateQuote(products, allLogos, logoConfigs);
```
**Prevention:** When calling pricing functions, always check if other callers pass additional parameters. The save function should use identical parameters to the live UI calculation function.
**Files:** `/quote-builders/embroidery-quote-builder.html` function `saveAndGetLink()` ~line 4333

---

## Problem: Parent row quantity includes child row quantities (confusing UX)
**Date:** 2026-01-14
**Project:** Pricing Index (Embroidery Quote Builder)
**Symptoms:** PC61 parent row showed Qty: 16 but only had S(2)+M(4)+L(4)+XL(4)=14 pieces in the size columns. The 2XL and 3XL child rows also showed their own quantities (2, 2). Visually looked like 16+2+2=20, but sidebar correctly showed 18.
**Root cause:** In `onSizeChange()` function, lines 3290-3295 intentionally added child row quantities to the parent display total. This was confusing because child rows ALSO display their own quantities, leading to visual double-counting.
**Solution:** Removed the child row quantity addition from parent display. Now:
- Parent shows ONLY its own sizes (S+M+L+XL = 14)
- Child rows show their own quantities (2, 2)
- Visual math adds up: 14 + 2 + 2 = 18 ✓
- Pricing calculator (`collectProductsFromTable()`) still correctly sums ALL quantities for pricing
**Code change:**
```javascript
// REMOVED this code block from onSizeChange():
const childRows = document.querySelectorAll(`tr[data-parent-row-id="${rowId}"]`);
childRows.forEach(childRow => {
    const qtyDisplay = childRow.querySelector('.qty-display');
    total += parseInt(qtyDisplay?.textContent) || 0;  // DELETED
});
```
**Prevention:** When displaying quantities in tables with parent/child relationships, each row should show only its OWN quantity. The pricing system handles true totals separately.
**Files:** `/quote-builders/embroidery-quote-builder.html` function `onSizeChange()` ~line 3290

## Problem: Quote View Subtotal doesn't match visible line items
**Date:** 2026-01-14
**Project:** Pricing Index (Quote View)
**Symptoms:** EMB0114-9 Quote View showed Subtotal $939 but visible rows summed to $1,189. Customer sees Digitizing ($200) and Artwork ($50) as line items, but they weren't included in Subtotal.
**Root cause:** Quote View used `SubtotalAmount` field ($839 products + $100 LTM = $939) for Subtotal display. But `TotalAmount` field ($1,189) correctly includes all fees (digitizing, art, rush, sample, discount).
**Solution:** Changed Subtotal display to use `TotalAmount` instead of calculated `SubtotalAmount + LTM`:
```javascript
// BEFORE:
const subtotal = (this.quoteData.SubtotalAmount || 0) + ltmTotal;

// AFTER:
const grandTotalBeforeTax = parseFloat(this.quoteData.TotalAmount) || 0;
```
**Prevention:** For customer-facing displays, use `TotalAmount` (pre-tax grand total) not `SubtotalAmount` (products only). The naming is confusing - document what each field contains.
**Files:** `/pages/js/quote-view.js` functions `renderTotals()` and PDF generation

## Problem: TotalAmount missing Art/Rush/Sample/Discount fees
**Date:** 2026-01-14
**Project:** Pricing Index (Embroidery Quote Builder)
**Symptoms:** Quote EMB0114-3 had TotalAmount of $1,484.50 but should have been $1,555.20. Art Charge ($75), Rush Fee ($50), Sample Fee ($25), and Discount (-$79.30) were shown as line items in the quote view but NOT included in TotalAmount.
**Root cause:** In `embroidery-quote-service.js` line 121, TotalAmount was set to `pricingResults.grandTotal` which only includes subtotal + LTM + setup + AL charges. Art/Rush/Sample/Discount are entered via customerData, not calculated by the pricing engine.
**Solution:** Updated TotalAmount calculation to include all fees:
```javascript
TotalAmount: parseFloat((
    pricingResults.grandTotal +
    (customerData.artCharge || 0) +
    (customerData.rushFee || 0) +
    (customerData.sampleFee || 0) -
    (customerData.discount || 0)
).toFixed(2)),
```
**Prevention:** When adding new fee fields to quote builders, ensure they are included in TotalAmount calculation. The quote-view.js uses TotalAmount for tax calculation, so missing fees means wrong tax and totals.
**Files:** `/shared_components/js/embroidery-quote-service.js` line 121-129

---

## Problem: ADDL-STITCH fee row confused customers
**Date:** 2026-01-14
**Project:** Pricing Index (Quote View)
**Symptoms:** Customers saw an "ADDL-STITCH" fee row in the quote products table showing extra stitch charges, but the math didn't add up because these charges were already included in the product unit prices.
**Root cause:** Extra stitch costs are calculated in `embroidery-quote-pricing.js` and added to the unit price (`finalPrice = roundedBase + additionalStitchCost`). The ADDL-STITCH row was purely informational but appeared to be a separate charge.
**Solution:** Removed ADDL-STITCH fee row from both web display (`renderFeeRows`) and PDF generation (`renderPdfFeeRows`) in `quote-view.js`. The extra stitch info remains visible in the embroidery details section.
**Prevention:** When showing fee breakdowns, distinguish between informational values (already in prices) vs actual additional charges. Comment code clearly to explain what's already baked into unit prices.
**Files:** `/pages/js/quote-view.js` lines 491-497 (web) and 1890-1894 (PDF)

---

## Problem: LTM fee displayed twice in Quote View (double-display bug)
**Date:** 2026-01-14
**Project:** Pricing Index (Quote View)
**Symptoms:** Quote EMB0114-7 showed inflated unit prices ($25.78 instead of $23.00) AND a separate LTM-G fee row ($50.00). Customer math didn't add up - product totals + LTM row ≠ Subtotal.
**Root cause:** Quote items are saved with both `BaseUnitPrice` ($23) and `FinalUnitPrice` ($25.78 = base + LTM per unit). Quote View was displaying `FinalUnitPrice` (which includes LTM) but ALSO showing the LTM-G fee row separately.
**Solution:** Changed quote-view.js to prefer `BaseUnitPrice` over `FinalUnitPrice` in all display functions:
- `buildProductRows()` - size aggregation
- `renderSizeMatrix()` - row data
- `parseSizeData()` - size parsing
- `getBaseSellingPrice()` - price lookup
- `getEstimatedUnitPrice()` - price estimation
**Prevention:** When items store both base and final prices, decide which to display based on whether fees are shown separately. If LTM has its own row, use BaseUnitPrice. Document the two-price pattern in code comments.
**Files:** `/pages/js/quote-view.js` - ~10 lines changed to prefer BaseUnitPrice

---

## Problem: 3 of 4 quote builders had ZERO mobile responsiveness
**Date:** 2026-01-13
**Project:** Pricing Index
**Symptoms:** DTG, Embroidery, Screen Print quote builders unusable on tablets/phones. Product tables overflowed viewport, sidebars didn't stack, buttons too small for touch.
**Root cause:** CSS was extracted from inline styles but no @media queries were added. DTF was the only builder with breakpoints.
**Solution:** Added comprehensive responsive breakpoints to all 3 CSS files:
- 1024px: Sidebar stacks below content, columns become full-width
- 768px: Tables get horizontal scroll, inputs become compact
- 480px: Single-column layout, minimum touch targets (44px)
- Print styles: Hidden sidebar, optimized table layout
**Prevention:** Added mobile testing requirement to QUOTE_BUILDER_GUIDE.md Final Checklist. All new quote builders must include these breakpoints.
**Files:**
- `/shared_components/css/dtg-quote-builder-extracted.css`
- `/shared_components/css/embroidery-quote-builder-extracted.css`
- `/shared_components/css/screenprint-quote-builder-extracted.css`

---

## Problem: DTF Quote Builder shareable URL - colors not saving correctly
**Date:** 2026-01-13
**Project:** Pricing Index
**Symptoms:** Four separate bugs when implementing shareable quote URLs:
1. All prices showed $0.00 on quote view
2. Color showed "N/A" for all items
3. Product images not loading
4. Extended sizes with different colors all saved with parent row's color

**Root causes:**
1. **Price selector mismatch** - Parent rows use `id="row-price-${rowId}"`, child rows use `.cell-price` class. Code only tried one selector.
2. **Color stored on row.dataset** - HTML `selectColor()` stores on `row.dataset.color`, but JS read from `product.color` (different data stores!)
3. **Image URL on row.dataset** - HTML stores `row.dataset.swatchUrl`, JS expected `product.imageUrl`
4. **Single color for all sizeGroups** - Code read color once from parent row, used for ALL line items including extended sizes with different colors

**Solutions:**
1. Use fallback pattern: `querySelector('.row-price') || getElementById(`row-price-${rowId}`)`
2. Read from `parentRow?.dataset?.color || p.color`
3. Read from `parentRow?.dataset?.swatchUrl || p.imageUrl`
4. Each sizeGroup carries its own `color`, `catalogColor`, `imageUrl`. Extended sizes loop reads from child row's dataset.

**Prevention:**
- Always check where HTML stores data vs where JS expects it (dataset vs object)
- Each line item (sizeGroup) should carry its own color/imageUrl, not inherit from parent
- Use fallback patterns for selectors when parent/child rows have different structures
- See `/memory/quote-builders/SHAREABLE_QUOTE_BLUEPRINT.md` for full implementation guide

**Files:** dtf-quote-builder.js:1598-1690, dtf-quote-service.js:185-210

---

## Problem: DTF Quote Builder internal size names vs display names
**Date:** 2026-01-13
**Project:** Pricing Index
**Symptoms:** Child row lookup failing for 2XL and 3XL sizes
**Root cause:** HTML creates child rows with internal names (XXL, XXXL) but display shows 2XL, 3XL. `childMap[size]` lookup failed because keys were XXL/XXXL, not 2XL/3XL.
**Solution:** Try both: `childMap[size] || childMap[internalSize]` where `internalSize = size === '2XL' ? 'XXL' : (size === '3XL' ? 'XXXL' : size)`
**Prevention:** Document size name mappings: 2XL=XXL, 3XL=XXXL. Always try both when looking up child rows.
**Files:** dtf-quote-builder.js:1662-1666

---

## Problem: DTF Quote Builder extended size upcharges always used defaults
**Date:** 2026-01-12
**Project:** Pricing Index
**Symptoms:** Extended sizes (2XL, 3XL, 4XL, etc.) showed wrong upcharge prices. Console showed `getSizeUpcharge(2XL): API value=null, result=2` - always falling back to hardcoded defaults ($2, $3, $4, $5, $6)
**Root cause:** DTF Quote Builder fetched from `/api/pricing-bundle?method=DTF` which returns **empty** `sellingPriceDisplayAddOns: {}`. DTF pricing bundle doesn't include garment-level upcharges - those come from a separate product lookup
**Solution:** Fetch from `/api/pricing-bundle?method=BLANK&styleNumber=XXX` instead, which returns actual `sellingPriceDisplayAddOns` with size upcharges. Also fixed `getSizeUpcharge()` to use nullish coalescing (`??`) instead of `||` so `0` values aren't treated as falsy
**Prevention:** When DTF pricing-bundle returns empty arrays/objects for product-specific data, check BLANK or method-specific product bundles. Document which endpoints return which data in API docs
**Files:** dtf-quote-builder.html:448-451, dtf-quote-products.js:165-167, dtf-quote-builder.js:1211-1252

---

## Problem: Caspio ArtRequests file uploads stored wrong data pattern
**Date:** 2026-01
**Project:** caspio-pricing-proxy
**Symptoms:** Documentation incorrectly described storing ExternalKeys in File_Upload fields
**Root cause:** Assumed REST API pattern without checking existing data - CSV export revealed 3000+ records use file PATH pattern (`/Artwork/logo.png`), not ExternalKey UUIDs
**Solution:** Store file paths (`/Artwork/${fileName}`) not ExternalKeys. CDN_Link formula auto-generates URLs from paths
**Prevention:** Always check existing data patterns via CSV export before documenting API usage. Added to `ARTREQUESTS_FILE_UPLOAD_GUIDE.md` with "CRITICAL: Store File Paths, Not ExternalKeys" warning

---

## Problem: OGIO brand products missing from search results
**Date:** 2025
**Project:** caspio-pricing-proxy
**Symptoms:** OGIO products never appeared in search, other brands worked fine
**Root cause:** Using `makeCaspioRequest()` which doesn't handle pagination. OGIO has 100+ products, Caspio returns max 1000 per page but OGIO was on page 2 of results
**Solution:** Always use `fetchAllCaspioPages()` for any multi-record query
**Prevention:** `makeCaspioRequest()` is now deprecated (server.js line 89). Use `fetchAllCaspioPages()` everywhere

---

## Problem: Caspio API quota exceeded (630K calls/month)
**Date:** 2025
**Project:** caspio-pricing-proxy
**Symptoms:** API throttling, requests failing with 429 errors
**Root cause:** No caching - identical queries hitting Caspio repeatedly
**Solution:** Implemented caching with TTLs: 15min for pricing, 5min for searches, 1hr for Sanmar mappings
**Prevention:** Always check if caching exists before adding new endpoints. Target: <500K calls/month

---

## Problem: API requests failing mid-stream
**Date:** 2025
**Project:** caspio-pricing-proxy
**Symptoms:** Random auth failures even with valid token
**Root cause:** Token expiring during request processing
**Solution:** Check token expiry with 60-second buffer before making requests
**Prevention:** `getCaspioAccessToken()` in server.js (lines 45-79) handles this automatically

---

## Problem: Inventory showing "Unable to Verify"
**Date:** 2025
**Project:** Pricing Index
**Symptoms:** Cart saves successfully but inventory check shows "Unable to Verify"
**Root cause:** Using `COLOR_NAME` instead of `CATALOG_COLOR` for API queries
**Solution:** Always use `product.CATALOG_COLOR` for inventory API calls, not `product.COLOR_NAME`
**Prevention:** Added to CLAUDE.md Critical Patterns - Two Color Field System:
- `COLOR_NAME` = Display to users ("Brilliant Orange")
- `CATALOG_COLOR` = API queries ("BrillOrng")

---

## Problem: Wrong pricing displayed silently
**Date:** 2025
**Project:** Pricing Index
**Symptoms:** Prices shown to customers were incorrect, no error visible
**Root cause:** API failed but code used cached/fallback data silently
**Solution:** Always show visible error when API fails - throw errors, don't fallback
**Prevention:** Rule #4 in CLAUDE.md: NO Silent API Failures. Every service file has "NO FALLBACK VALUES" comments

---

## Problem: API URL hardcoded, broke in different environments
**Date:** 2025
**Project:** Pricing Index
**Symptoms:** API calls fail when deployed or URL changes
**Root cause:** Hardcoded `caspio-pricing-proxy` URL in code
**Solution:** Use `APP_CONFIG.API.BASE_URL` or config object
**Prevention:** Rule #7 in CLAUDE.md: USE CONFIG FOR API URLs. Config is in `/config/app.config.js`

---

## Problem: Rate limiting not applied correctly
**Date:** 2025
**Project:** caspio-pricing-proxy
**Symptoms:** External APIs (ManageOrders, JDS) getting throttled
**Root cause:** No rate limiting on proxy endpoints
**Solution:** Implemented three rate-limit tiers:
- ManageOrders: 30 requests/minute
- JDS Industries: 60 requests/minute
- General API: 200 requests/15 minutes
**Prevention:** Always add rate limiter when creating new external API endpoints

---

# Order Processing & ShopWorks

## Bug: "Sew-on" Description with Empty PN Bypasses Alias System
**Date:** 2026-02-15
**Project:** [Pricing Index]
**Problem:** Order #136562 (Fire Buffs) has `Part Number:` empty, `Description:Sew-on`, `Unit Price:12.50`, `Qty:2`. The `SERVICE_CODE_ALIASES` map has `'SEW-ON': 'SEG'`, but aliases are only applied to non-empty part numbers. Empty PN → `classifyPartNumber('')` → `'comment'` → `customProducts[]` ("Priced item with no part number") instead of `services.sewing[]`.
**Root Cause:** The alias system (`SERVICE_CODE_ALIASES`) checks the part number string, not the description. When PN is empty, the entire alias/classification pipeline is bypassed — `classifyPartNumber('')` immediately returns `'comment'`.
**Solution:** Added description-based reclassification in `_classifyAndAddItem()` before the switch statement. When classification is `'comment'` AND item has pricing AND description matches `/^sew[\s-]?on/i`, override classification to `'sewing'`. The existing sewing case handler then assigns `partNumber: 'SEG'` and uses `this.SEWING_PRICE` ($10 API-driven).
**Prevention:** When encountering service items with empty part numbers but recognizable descriptions, add description-based fallback detection. The alias system only works for non-empty PNs.

---

## Bug: Lowercase State Abbreviation Fails Ship Address Parsing
**Date:** 2026-02-15
**Project:** [Pricing Index]
**Problem:** Order #136566 (Vadis) has ship address `Sumner, Wa 98390`. The `_parseShippingInfo()` regex at line 829 uses `[A-Z]{2}` (uppercase only), so "Wa" doesn't match. State and ZIP extraction fails silently.
**Root Cause:** The regex `^([A-Z]{2})\s+(\d{5})(?:-\d{4})?$` is case-sensitive. ShopWorks data entry sometimes uses mixed-case state abbreviations.
**Solution:** Added `.toUpperCase()` to `stateZipStr` before the regex match at both the initial parse (line 826) and the retry path (line 836).
**Prevention:** When parsing user-entered or external-system strings for pattern matching, always normalize case first. Address data is especially prone to inconsistent casing.

---

## Bug: DECG "Di. Embroider Cap" Prefix Falsely Classifying Garments as Caps
**Date:** 2026-02-15
**Project:** [Pricing Index]
**Problem:** ShopWorks uses "Di. Embroider Cap" as a service name prefix for DECG items, even when the garment is NOT a cap. E.g., "Di. Embroider Cap - T-shirt - Small Logo" and "Di. Embroider Cap - Jacket - Big Logo" both contain "cap" in the string, causing `_isCapFromDescription()` to return `true` for garments.
**Root Cause:** `_isCapFromDescription()` did a simple `desc.includes('cap')` check with no awareness that "Di. Embroider Cap" is a ShopWorks service prefix, not a garment type. The actual garment type appears after the dash.
**Solution:** Added regex match for `^di\.\s*embroider\s+cap\s*[-–]\s*` prefix. When matched, parse the text after the prefix and check against a `nonCapGarments` list (t-shirt, jacket, hoodie, vest, etc.). If a non-cap garment is found after the prefix → `false`. If only location terms (Front, Back, Side) → `true` (actual cap). Also added explicit guard for "Di. Embroider Garms" → always `false`.
**Prevention:** When parsing ShopWorks descriptions for garment type detection, always account for the service name prefix which may contain misleading keywords. Test with real order data that has mixed cap/garment DECG items.

---

## Bug: `_4/5X` Combo Size Suffix Missing from Parser
**Date:** 2026-02-15
**Project:** [Pricing Index]
**Problem:** Order #136479 had `CSV102_4/5X` — a Cornerstone safety vest in combo size 4XL/5XL. Parser didn't extract this suffix, leaving `_4/5X` in the part number.
**Root Cause:** `SIZE_SUFFIXES` array and `SIZE_MAP` didn't include the `_4/5X` combo size pattern. Safety vests use combined sizes (one vest fits 4XL-5XL).
**Solution:** Added `'4/5X': '4XL/5XL'` to `SIZE_MAP` and `'_4/5X'` to `SIZE_SUFFIXES` (in the size-ranges section). No false-match risk since `CSV102_4/5X.endsWith('_5X')` is false (last chars are `/5X` not `_5X`), and `_4/5X` is checked before `_5X` in the suffixes array.
**Prevention:** When encountering new ShopWorks size suffixes in batch testing, add both to `SIZE_MAP` (for normalization) and `SIZE_SUFFIXES` (for extraction). Test that the new suffix doesn't create false matches with shorter existing suffixes.

---

## Gap: ShopWorks Parser Silently Dropped Paid To Date, Balance, and Note Sections
**Date:** 2026-02-12
**Project:** [Pricing Index]
**Problem:** Parser's section dispatcher didn't recognize the `Note` section (silently skipped). `_parseOrderSummary()` didn't match `Paid To Date:` or `Balance:` lines — they fell through to `unmatchedLines`. These 3 data points existed in every ShopWorks order but were never captured or saved to Caspio.
**Root Cause:** Parser was built incrementally — only the fields needed at the time were added. `Paid To Date`, `Balance`, and the `Note` section weren't needed for initial quoting, so they were never wired up even though the Caspio columns existed.
**Solution:** (1) Added `paidToDate`/`balance` to `orderSummary` init + two `else if` branches in `_parseOrderSummary()`. (2) Added `Note` section handler in main dispatcher → `result.orderNotes`. (3) `lastImportMetadata` and `customerData` pass through to service. (4) `saveQuote()`/`updateQuote()` write `PaidToDate`, `BalanceAmount`, `OrderNotes` to Caspio.
**Prevention:** When adding new Caspio columns for ShopWorks data, always check: does the parser already extract this field, or does it fall to `unmatchedLines`? Use `unmatchedLines` output as a checklist of unhandled data.

## Problem: ShopWorks Import Email Not Extracted for CRM Lookup
**Date:** 2026-01-31
**Project:** [Pricing Index]
**Symptoms:** ShopWorks import populated the ID Lookup field with email for CRM search, but the field was empty or had truncated email. CRM auto-lookup didn't trigger.
**Root Cause:** The parser's `_parseOrderInfo()` method only triggered when a section contained "Ordered by:" or "Order Information" header. If the pasted ShopWorks text used a different format or the customer email appeared in a different section, it wasn't extracted.
**Solution:** Added fallback email extraction in `_extractEmailFallback()` method:
1. Find all emails in the full text using regex
2. Filter out salesperson email and common system emails (noreply, support@, etc.)
3. Look for emails near customer-related keywords ("ordered by", "contact", "customer", "bill to", "ship to")
4. Return the first suitable candidate email
5. Added debug logging to console for troubleshooting: `[ShopWorksImportParser] Extracted customer email: xxx@example.com`
**Prevention:** When parsing structured text, always add fallback extraction methods. Don't rely solely on section headers that may vary between formats.
**Files:** `shared_components/js/shopworks-import-parser.js` v1.5.0 (lines 147-207)

---

## Problem: ShopWorks Import Showed 20 Pieces Instead of 24 After "Fix"
**Date:** 2026-01-31
**Project:** [Pricing Index]
**Symptoms:** ShopWorks import originally showed 22 pieces (missing 2). After v1.4.0 fix, it showed 20 pieces (missing 4) - worse than before.
**Root Cause:** `_normalizeSize()` was changed to return `null` for ANY size containing `(Other)`, which broke items without a part number size suffix. The `(Other)` placeholder is only relevant when a size suffix IS extracted (e.g., `ST253_2X` has suffix, so its `XXL (Other):1` in size section is a placeholder). For items WITHOUT a suffix (e.g., base `ST253`), the size section has the real sizes.
**Solution:**
1. `_normalizeSize()` now cleans `(Other)` text but doesn't filter - returns the base size
2. The `item.sizes = {}` clear in `_parseItemBlock()` only happens when a suffix IS extracted
3. Added `'XS': 'XS'` to SIZE_MAP for XS size recognition
**Prevention:** When fixing parser bugs, trace through BOTH code paths (with suffix AND without suffix) to ensure the fix doesn't break the other case. The `(Other)` filtering should be contextual, not unconditional.
**Files:** `shared_components/js/shopworks-import-parser.js` v1.4.1

---

## Problem: CRM YTD Total Doesn't Match Team Performance
**Date:** 2026-01-28
**Project:** [Pricing Index]
**Symptoms:** Team Performance widget shows higher sales ($152,610) than CRM dashboard YTD ($147,197) for same rep
**Root Cause:** Two different metrics measured:
- **Team Performance** = orders WRITTEN BY rep (`CustomerServiceRep` on ORDER)
- **CRM YTD_Sales_2026** = sales FOR ASSIGNED accounts (customer in rep's CRM list)
Plus, CRM sync may be stale if not run recently.
**Solution:**
1. Run diagnostic: `node tests/diagnostics/analyze-gap.js`
2. Trigger sync: `POST /api/[rep]-accounts/sync-sales` with `X-CRM-API-Secret` header
3. Check for customers not in CRM account list - reassign if needed
**Prevention:** Document the metric distinction clearly (done in CRM_DASHBOARD_RECONCILIATION.md). Consider auto-sync scheduling.
**Files:** `tests/diagnostics/analyze-gap.js`, `memory/CRM_DASHBOARD_RECONCILIATION.md`

---

## Problem: 3-Day Tees orders not processing correctly
**Date:** 2024-11
**Project:** Pricing Index + caspio-pricing-proxy
**Symptoms:** Hours spent debugging wrong code path
**Root cause:** Assumed order submission used `ThreeDayTeesOrderService` class - but that was DELETED. Actual path is `server.js:749-1050`
**Solution:** Document the actual code path clearly
**Prevention:** Added to CLAUDE.md:
- Frontend: `pages/3-day-tees-success.html` (line 884-937)
- Backend: `server.js` (line 749-1050) - EDIT HERE
- ManageOrders: `lib/manageorders-push-client.js`

---

## Problem: All sizes showing as Adult/S in ShopWorks
**Date:** 2025-12
**Project:** Python Inksoft
**Symptoms:** Imported orders show correct product but every item is Adult/S regardless of actual size
**Root cause:** Missing or zero `id_Integration` in store config - ShopWorks doesn't know which Size Translation Table to use
**Solution:** Get valid Integration ID from ShopWorks: Tools > Configuration > Order API Integrations
**Prevention:** Every new store config MUST have valid `id_Integration`. Check `/web/stores.py` for any `"id_Integration": 0` (those are broken!)

---

## Problem: Size modifiers not applying correctly
**Date:** 2025
**Project:** Python Inksoft
**Symptoms:** 2XL and 3XL items going to wrong SKUs
**Root cause:** ShopWorks uses `_2X` and `_3X` format, NOT `_2XL` and `_3XL`
**Solution:** Hardcoded size modifiers in `transform.py` (lines 19-74) because ShopWorks Size Translation Table is unreliable
**Prevention:** Always check SIZE_MODIFIERS dict before assuming size format

---

## Problem: Gift certificates disappearing or consolidating
**Date:** 2025
**Project:** Python Inksoft
**Symptoms:** Multiple gift certs on same order getting merged into one
**Root cause:** Gift certs were in Payments array - ShopWorks consolidates identical PartNumbers
**Solution:** Gift certs are now LINE ITEMS with unique PartNumbers: "Gift Code 1", "Gift Code 2", etc.
**Prevention:** See `transform.py` lines 475-506. Gift certs are NOT payments

---

## Problem: Tax calculation wrong after ShopWorks import
**Date:** 2025
**Project:** Python Inksoft
**Symptoms:** Tax amounts incorrect in ShopWorks
**Root cause:** ShopWorks API has a bug - doesn't set `sts_EnableTax01-04` flags on line items
**Solution:** Python tool hardcodes all 4 tax flags to 1, sets TaxTotal to 0, lets OnSite calculate
**Prevention:** See `transform.py` lines 1121. This is a workaround for ShopWorks API bug

---

## Problem: Orders landing on weekends/holidays
**Date:** 2025
**Project:** Python Inksoft
**Symptoms:** Ship dates on Saturdays, Sundays, Christmas
**Root cause:** No business day logic
**Solution:** Auto-adjust to next business day - skips weekends and 12+ US holidays
**Prevention:** `transform.py` lines 220-301 handles this automatically. Includes MLK Day, Presidents Day, Memorial Day, Labor Day, Thanksgiving, day after Thanksgiving, Dec 26, Jan 2, etc.

---

# Multi-SKU Products & Sizes

## Fix: XLR Regular-Fit Size Suffix Normalization (2026-02-22)
**Date:** 2026-02-22
**Project:** [Pricing Index]
**Problem:** ShopWorks uses `_XLR` suffix for "XL Regular fit" (e.g., `SP24_XLR`). Parser `SIZE_MAP` correctly strips this to `XL`, but `extended-sizes-config.js` had no equivalent normalization — `getSizeSuffix('XLR')` returned `'_XLR'` instead of `''` (empty = standard size).
**Root cause:** `SIZE_TO_SUFFIX` maps `'XL': ''` (standard, no suffix) but had no entry for `'XLR'`. Without normalization, XLR was treated as an unknown extended size.
**Solution:** Added `normalizeRegularFitSize()` to `extended-sizes-config.js`. Regex-based: `XLR→XL`, `2XLR→2XL`, `SR→S`, `MR→M`, `LR→L`. Called by `getSizeSuffix()`, `isExtendedSize()`, and `getSizeSortIndex()` before any lookup.
**Prevention:** Any new "fit variant" suffixes (e.g., Slim, Relaxed) should be added to `normalizeRegularFitSize()`, not to `SIZE_TO_SUFFIX`. Keep the mapping table clean — only actual distinct sizes belong there.

---

## Fix: getSizeSuffix() Falsy-Zero Bug — `||` vs `undefined` Check (2026-02-22)
**Date:** 2026-02-22
**Project:** [Pricing Index]
**Problem:** After adding `normalizeRegularFitSize()`, `getSizeSuffix('XLR')` still returned `'_XLR'`. The normalization worked (`XLR→XL`) and `SIZE_TO_SUFFIX['XL']` returned `''` (empty string = standard size, no suffix), but the code fell through to the fallback.
**Root cause:** Code used `||` operator: `SIZE_TO_SUFFIX[normalized] || SIZE_TO_SUFFIX[size]`. Empty string `''` is falsy in JavaScript, so `||` treated a valid lookup result as a miss and fell through to the original `'XLR'` lookup.
**Solution:** Changed to explicit `undefined` check: `if (normalizedSuffix !== undefined) return normalizedSuffix;`. Only falls through to original-size lookup when the normalized size truly has no mapping.
**Prevention:** **Never use `||` when `0`, `''`, or `false` are valid values.** Use `??` (nullish coalescing) or explicit `!== undefined` check. This is the same class of bug as the `taxRate || 0.101` falsy-zero issue (fixed 2026-02-11). Added to gotchas in MEMORY.md.

---

## DONE: Changed _2XL to _2X in ALL quote builders and shared components
**Date:** 2026-02-21
**Project:** [Pricing Index]
**Status:** DONE — all 12 files updated, verified via grep + 96 parser tests passing
**Problem:** SanMar's live API rejects `_2XL` but accepts `_2X` for 2XL products. This was discovered and fixed in the InkSoft Transform project (sanmar_converter.py, transform.py, app.js). The Pricing Index project still uses `_2XL` in many files.
**What needs changing:** Every `'2XL': '_2XL'` mapping needs to become `'2XL': '_2X'`. Only the 2XL→_2X mapping changes — all other sizes (_3XL, _4XL, _XXL, _2XLT, _2XLB, etc.) stay the same.
**Files that need the fix (code that GENERATES part numbers):**
1. `shared_components/js/extended-sizes-config.js` — line 89 (CENTRAL config, fix here first)
2. `shared_components/js/quote-builder-core.js` — line 355
3. `shared_components/js/embroidery-quote-pricing.js` — line 1304
4. `shared_components/js/embroidery-quote-invoice.js` — line 1389
5. `shared_components/js/shopworks-guide-generator.js` — line 27
6. `shared_components/js/sku-validation-service.js` — line 80
7. `quote-builders/embroidery-quote-builder.html` — line 2134
8. `quote-builders/dtg-quote-builder.html` — line 719
9. `quote-builders/screenprint-quote-builder.html` — line 849
10. `pages/js/quote-view.js` — line 1201
11. `pages/js/services/InventoryService.js` — line 108 (hardcoded PC54_2XL)
12. `tests/unit/csv-validation-report.js` — line 28
**Files to NOT change (suffix stripping — keep _2XL for backward compat):**
- `shared_components/js/shopworks-import-parser.js` — reads/strips suffixes, needs both _2X and _2XL
**Evidence:** PC61_2XL → ERROR, PC61_2X → ✅ $3.75 (tested in ShopWorks "Get Cost from SANMAR")
**Reference:** See `Python Inksoft/memories/LESSONS_LEARNED.md` for full details

---

## Bug: Shopworks_Integration Table Does Not Exist — Extended Sizes Broken
**Date:** 2026-02-06
**Project:** [caspio-proxy]
**Problem:** All 3 quote builders (embroidery, DTG, screenprint) couldn't load extended sizes (3XL, 4XL, etc.). The `/api/sanmar-shopworks/import-format` endpoint returned 500 for every product. Users saw "No extended sizes available" and couldn't add 2XL+ sizes.
**Root Cause:** The `sanmar-shopworks.js` route queried a Caspio table `Shopworks_Integration` that **does not exist**. Caspio returned `TableNotFound` error. The endpoint was built assuming this table existed, but it was never created.
**Solution:** Rewrote all helper functions (`detectSKUPattern`, `getShopWorksSizeMapping`, `mapSKUToFieldsEnhanced`) and the `import-format` endpoint to derive SKU patterns and size mappings from `Sanmar_Bulk_251816_Feb2024` instead. Also made the `color` parameter optional so the frontend fallback (no-color query) works. Deployed as caspio-proxy v339.
**Prevention:** Before writing code that queries a Caspio table, verify the table exists by testing the query first. Never assume a table exists just because a variable references it.
**File:** `caspio-pricing-proxy/src/routes/sanmar-shopworks.js`

---

## Bug: Tall-Only Products Missing from PDF and Quote Link
**Date:** 2026-02-01
**Project:** [Pricing Index]
**Symptoms:** Quote EMB-2026-036 with TLCS410 (tall-only product with 2XLT sizes):
- Pricing calculation showed correct $100.00 for 2 × $50
- PDF was missing the product row (or sizes not displayed)
- Quote link reload didn't show the sizes
**Root Causes:**
1. **PDF Invoice:** `embroidery-quote-invoice.js:1400` - The `extendedSizes` array only had `['XS', '3XL', '4XL', '5XL', '6XL', 'XXXL']` but was **missing tall sizes** (LT, XLT, 2XLT, etc.). When generating the PDF, tall sizes weren't recognized as extended sizes, causing the row to render with empty size cells.
2. **Quote Link Loading:** `embroidery-quote-builder.html:addProductFromQuote()` - Function only populated standard size inputs (`input[data-size="${size}"]`). For extended/tall sizes, no input existed in the parent row, so quantities were silently discarded instead of creating child rows.
**Solution:**
1. Updated `extendedSizes` array in `embroidery-quote-invoice.js` to include all non-standard sizes: tall, youth, toddler, big, combos, one-size
2. Modified `addProductFromQuote()` to call `createChildRow()` for extended sizes (matching ShopWorks import behavior)
**Prevention:**
- When adding new size types, check ALL places that handle sizes: invoice generation, quote loading, ShopWorks import
- Test tall-only products specifically (TLCS410 is a good test case)
- The `SIZE06_EXTENDED_SIZES` constant in the quote builder is the source of truth for extended sizes

---

## Problem: PC54 2XL size mapping wrong
**Date:** 2025
**Project:** All
**Symptoms:** 2XL orders going to wrong ShopWorks SKU
**Root cause:** PC54_2X uses Size05, not Size06 as expected
**Solution:** Check size field mapping for multi-SKU products
**Prevention:** Added Multi-SKU Product Pattern to CLAUDE.md:
| Product | ShopWorks SKUs | Size Fields |
|---------|----------------|-------------|
| PC54 | PC54, PC54_2X, PC54_3X | Size01-Size06 |
| PC54_2X uses **Size05** (NOT Size06!) |

---

## Problem: Multi-SKU products have inconsistent size field counts
**Date:** 2025
**Project:** All
**Symptoms:** Extended sizes (4XL, 5XL) not mapping correctly
**Root cause:** Each SKU variant (base, _2X, _3X) uses different number of size fields
**Solution:** Always verify size field mapping with actual ShopWorks data
**Prevention:** Document in `/memory/SHOPWORKS_SIZE_MAPPING.md`. Test with extended sizes specifically

---

## Problem: ShopWorks Size Translation Table unreliable
**Date:** 2025
**Project:** Python Inksoft
**Symptoms:** Sizes sometimes translate correctly, sometimes not
**Root cause:** ShopWorks Size Translation Table has inconsistent data
**Solution:** Bypass it - hardcode size modifiers in Python tool
**Prevention:** `SIZE_MODIFIERS` dict in `transform.py` is the source of truth, not ShopWorks

---

## Bug: "Fixing" Code With Non-Existent Fields Breaks Everything
**Date:** 2026-02-02
**Project:** [Pricing Index]
**Problem:** After attempting to fix tall size display in PDF/quote-view, the system broke completely. Console showed `Item 1: undefined x 2 @ $undefined = $100.00`. Sizes weren't saved to database.
**Root Cause:** Made incorrect assumption about data structure. Changed code to use `lineItem.size` which DOESN'T EXIST in the lineItems from `calculateProductPrice()`. There are TWO different lineItem formats in the codebase:
1. **`calculateProductPrice()`** (USED): `{ description: "2XLT(2)", quantity: 2 }` - NO `size` field
2. **`generateLineItems()`** (NEVER CALLED - dead code): `{ description: "Brand Style Color", size: "2XLT" }` - HAS `size` field
The "fix" changed code from parsing sizes from `description` (which worked) to reading `lineItem.size` (undefined).
**Solution:** Reverted to parsing sizes from `item.description` using `parseSizeBreakdown()` which correctly extracts "2XLT(2)" → `{"2XLT": 2}`.
**Prevention:**
1. **ALWAYS trace actual data flow** before making changes - don't assume field names based on dead code
2. **Search for where functions are CALLED**, not just where they're defined
3. **Check if code is actually used** - `generateLineItems()` was never called anywhere
4. **Test with actual data** before claiming a fix works
**Files:**
- `shared_components/js/embroidery-quote-invoice.js` - REVERTED to parse from description
- `shared_components/js/embroidery-quote-service.js` - REVERTED to parse from description
- `pages/js/quote-view.js` - Extended sizes array update was CORRECT (kept)

---

## Bug: Tall-Only Products (TLCS410) Not Saved to quote_items
**Date:** 2026-02-02
**Project:** [Pricing Index]
**Problem:** Quote EMB-2026-035 showed correct subtotal ($177) but TLCS410 product row was missing from PDF and database. The product was silently dropped.
**Root Cause:** `calculateProductPrice()` in `embroidery-quote-pricing.js` returns `null` when it can't find a base price. For tall-only products (no S/M/L/XL sizes), the function:
1. Tries standard sizes S/M/L/XL → all fail (tall-only has none)
2. Fallback looks for `price > 0` in `priceData.basePrices` → may fail if API doesn't have tall sizes
3. Returns `null`, product dropped from `pricingResults.products` array, never saved to database
**Solution:** Added two additional fallbacks in `embroidery-quote-pricing.js` (lines 880-905):
1. Try product's actual ordered sizes (e.g., '2XLT') from `product.sizeBreakdown`
2. Last resort: use highest available price from API response
Same fix applied to `calculateCapProductPrice()` (lines 646-667).
**Prevention:** When calculating prices for non-standard products:
1. Always have fallback for products without standard sizes
2. Check product's actual ordered sizes before returning null
3. Log warnings when using fallback pricing
**Files:** `shared_components/js/embroidery-quote-pricing.js`

---

# Code Organization

## Fix: Variable Scoping in Review Modal — embConfigOptions vs _sprEmbConfigOptions (2026-02-19)
**Date:** 2026-02-19
**Project:** [Pricing Index]
**Problem:** Clicking "Apply & Import" in the ShopWorks review modal threw `ReferenceError: embConfigOptions is not defined`, preventing products from loading into the table.
**Root cause:** `applyServicePricingReview()` referenced `embConfigOptions` (a local variable inside `showServicePricingReview()`) but runs in the module scope where only `_sprEmbConfigOptions` exists. The review modal stores its config copy in `_sprEmbConfigOptions` specifically so `applyServicePricingReview()` can access it after the modal closes.
**Solution:** Changed `embConfigOptions?.fbPriceTiers` to `_sprEmbConfigOptions?.fbPriceTiers` on the single affected line.
**Prevention:** In the embroidery builder's large single-file architecture, always verify which scope a function runs in before referencing variables. `showServicePricingReview()` owns `embConfigOptions` locally; everything outside uses `_sprEmbConfigOptions`.

## Fix: Console Spam from collectProductsFromTable Iterating Fee Rows (2026-02-11)
**Date:** 2026-02-11
**Project:** [Pricing Index]
**Problem:** After importing a ShopWorks order, console showed 12x `[collectProducts] Skipping row NaN: style="", color=""`. The 12 `.fee-row` elements (LTM, stitch fees, AL fees, etc.) and `#empty-state-row` in `#product-tbody` were being iterated by `collectProductsFromTable()` because the selector only excluded `.child-row` and `.al-config-row`.
**Solution:** Extended the selector to also exclude `.fee-row` and `#empty-state-row`:
`#product-tbody tr:not(.child-row):not(.al-config-row):not(.fee-row):not(#empty-state-row)`
Also fixed post-import validation selector from `#product-table-body` (wrong ID) to `#product-tbody`.
**Prevention:** When adding new non-product row types to `#product-tbody`, always add their class/ID to the exclusion list in `collectProductsFromTable()`.
**Files:** `quote-builders/embroidery-quote-builder.html` (lines ~6248, ~9521)

---

## Pattern: EMB_DEFAULTS Constants Block for Embroidery Magic Numbers
**Date:** 2026-02-10
**Project:** [Pricing Index]
**Problem:** `8000`, `5000`, `50` (stitch counts, patch setup fee) appeared 30+ times scattered across the embroidery quote builder with no named constants. Easy to change one and miss others.
**Solution:** Added `EMB_DEFAULTS` constants object at the top of the script section. Replaced 12 key instances in initialization, reset, and config code. Left HTML `value=` attributes and runtime `|| 8000` fallbacks as-is (they're safe defaults that don't need coordinated changes).
**Prevention:** New embroidery defaults should be added to `EMB_DEFAULTS`. The remaining `|| 8000` instances are safe runtime fallbacks — only update them if you're changing the actual default value.
**Files:** `quote-builders/embroidery-quote-builder.html` (line ~1321 `EMB_DEFAULTS`)

---

## Problem: Review Import Pricing modal had misaligned columns
**Date:** 2026-02-08
**Project:** [Pricing Index]
**Problem:** Products section showed only 2 price columns (ShopWorks, API) with radios detached in card header; Services section had left-aligned headers but center-aligned data cells.
**Root Cause:** Products used flex-based layout with radios in card header separate from size breakdown rows. Services table `th` inherited `text-align: left` while `.spr-radio-cell` used `text-align: center`.
**Solution:** (1) Products: Converted flex layout to `<table>` with 4 columns (Sizes/ShopWorks/API/Custom), moved radios inline with first size row. (2) Services: Added `.spr-table th:nth-child(n+4) { text-align: center }`. Removed ~50 lines of dead CSS.
**Prevention:** When building modal tables with radio+price columns, use `<table>` from the start — flex layouts drift when columns need alignment across header and data.
**Files:** `quote-builders/embroidery-quote-builder.html`

---

## Problem: 71+ orphaned files in codebase
**Date:** 2025
**Project:** Pricing Index
**Symptoms:** Duplicate files, backup versions, test files scattered everywhere
**Root cause:** Creating `-backup`, `-FIXED`, `-old` suffix files instead of using git
**Solution:** Massive cleanup, established Top 8 Never-Break Rules
**Prevention:** Rule #1: NO Version Suffix Files - use Git branches

---

## Problem: Test files scattered in root directory
**Date:** 2025
**Project:** Pricing Index
**Symptoms:** Confusion about which files are active vs test
**Root cause:** No enforced test file location
**Solution:** All test files must go in `/tests/` with subdirectories: `ui/`, `api/`, `unit/`
**Prevention:** Rule #2 in CLAUDE.md: NO Test Files in Root

---

## Problem: LTM fee logic inconsistent between calculator and quote builder
**Date:** 2025
**Project:** Pricing Index
**Symptoms:** Calculator shows one LTM fee, quote builder shows different amount
**Root cause:** LTM fee logic appears in THREE separate places that weren't synced
**Solution:** Must update all three when changing LTM logic:
- `/cart-price-recalculator.js` (lines 53-63)
- `/quote-builders/screenprint-quote-builder.html` (lines 3015-3044)
- `/shared_components/js/screenprint-pricing-v2.js` (lines 1587-1595)
**Prevention:** Document all locations. Consider consolidating into shared function

---

## Problem: Multiple config files causing confusion
**Date:** 2025
**Project:** Pricing Index
**Symptoms:** Changed config in one file, but app used different file
**Root cause:** Multiple config files exist:
- `/config/app.config.js` - PRIMARY (frozen)
- `/shared_components/js/app-config.js` - LEGACY (marked for deprecation)
- `/shared_components/js/dtf-config.js` - DTF-specific
- `/shared_components/js/dtg-config.js` - DTG-specific
**Solution:** Use `/config/app.config.js` for all new code
**Prevention:** ACTIVE_FILES.md marks legacy config as "Deprecate"

---

## Problem: Root directory JS files cause dependency issues
**Date:** 2025
**Project:** Pricing Index
**Symptoms:** Moving files breaks index.html and cart.html
**Root cause:** Historical JS files in root have hardcoded paths in HTML
**Solution:** Left files in root, documented the risk
**Prevention:** ACTIVE_FILES.md (line 10) warns: "DO NOT MOVE these files without updating all HTML references"
Files affected: `app-modern.js`, `cart.js`, `cart-ui.js`, `cart-price-recalculator.js`, `product-search-service.js`

---

# Calculator & Quote Builder Sync

## Verified: Cap Calculator ↔ Pricing Engine Sync (2026-02-14)
**Project:** [Pricing Index]
**Problem:** Cap calculator page used hardcoded `Math.ceil()` rounding — needed to verify it matches the pricing engine after switching to API-driven `roundCapPrice()`.
**Finding:** All 3 systems (pricing engine, calculator page, pricing service) produce identical prices. Verified with live API data for Richardson 112 — all 5 tiers match to the penny.
**Key facts:**
- Cap rounding method is `CeilDollar` (whole dollar ceiling, NOT `HalfDollarUp`). Returned by API `rulesR.RoundingMethod`.
- All cap tier margins are identical (0.57), so pricing engine's `tiersR[0]` shortcut and calculator's per-tier lookup produce the same result.
- LTM bake-in confirmed: `$29.00 + $50/1 = $79.00` for 1-piece qty.
- Verification script: `tests/verify-cap-calculator-sync.js` — runs against live API, compares all 5 tiers.
**Prevention:** If cap margins ever differ by tier in Caspio, the pricing engine's single-margin approach (`tiersR[0]`) would need updating to per-tier lookup.

## Bug: DECG-Only Quotes Blocked from Save/Print/Email/Copy (2026-02-08)
**Project:** [Pricing Index]
**Problem:** When a quote contains only DECG/DECC items (customer-supplied garments/caps, no SanMar products), clicking Save & Get Link, Print, Email, or Copy showed "Add products before saving" error and blocked the action.
**Root Cause:** All 4 action functions (`saveAndGetLink`, `printQuote`, `emailQuote`, `copyToClipboard`) filter out service items (`!p.isService`) then check `products.length === 0`. For DECG-only orders, ALL items are service items, so the guard always fails — even though `recalculatePricing()` already handles DECG-only quotes correctly.
**Solution:** Updated all 4 guards to also check `collectDECGItems().length === 0`. Added DECG-only pricing path in `saveAndGetLink` and `printQuote` that builds a minimal pricing object (skipping the pricing engine) when `products.length === 0` but DECG items exist.
**Prevention:** When adding guard checks for "no products", always consider service-only items (DECG/DECC). The pricing engine requires SanMar products — service-only quotes need a bypass path.
**Files:** `embroidery-quote-builder.html` (`saveAndGetLink()`, `printQuote()`, `emailQuote()`, `copyToClipboard()`)

## Bug: DECG Totals Excluded from Subtotal in PDF/Save/Copy (2026-02-09)
**Project:** [Pricing Index]
**Problem:** Quotes with customer-supplied garments (DECG) showed the DECG line items in the PDF and URL view, but the subtotal/grandTotal only summed SanMar product prices. EMB-2026-057 showed subtotal $230 instead of $370 (missing 5 × $28 = $140 DECG).
**Root Cause:** `recalculatePricing()` adds DECG totals to subtotal/grandTotal for UI display, but the 3 output functions (`printQuote()`, `saveAndGetLink()`, `copyToClipboard()`) never did the same aggregation — they passed the pricing engine result directly without DECG adjustment.
**Solution:** Added identical DECG aggregation block to all 3 output functions:
```js
if (decgItems.length > 0) {
    const decgServiceTotal = decgItems.reduce((sum, d) => sum + d.total, 0);
    pricing.subtotal += decgServiceTotal;
    pricing.grandTotal += decgServiceTotal;
}
```
**Prevention:** The embroidery quote builder has **4 code paths** that compute totals: `recalculatePricing()` (UI), `printQuote()` (PDF), `saveAndGetLink()` (URL), `copyToClipboard()` (text). ANY change to total aggregation in one must be mirrored in all 4. This is the third time this divergence caused a bug (see also 2026-02-08 entries above).
**Files:** `embroidery-quote-builder.html` (lines ~6435, ~6735, ~7471)

## Bug: PDF/URL Quote Pricing Divergence from UI (2026-02-08)
**Project:** [Pricing Index]
**Problem:** After recalculating pricing (changing stitch counts, toggling AL, overriding prices), the Print PDF and Save & Get Link outputs showed wrong/stale prices.
**Root Cause:** Each quote builder has 3 functions that build pricing calculator inputs: `recalculatePricing()`, `printQuote()`, and `saveAndGetLink()`. When `recalculatePricing()` was refactored (2026-02-06 AL simplification), the other two were not updated. Specifically: (1) service items (DECG/DECC) weren't filtered, inflating tier counts; (2) `saveAndGetLink()` used empty global arrays instead of `globalAL` state for AL configs; (3) `printQuote()` omitted cap logos from `allLogos`.
**Solution:** Made all 3 functions use identical patterns: filter `!p.isService`, build AL from `globalAL`, include both garment and cap logos.
**Prevention:** When modifying `recalculatePricing()`, always check `printQuote()` and `saveAndGetLink()` for the same change. Added reminder to CLAUDE.md sync rules.
**Files:** `embroidery-quote-builder.html` (`printQuote()`, `saveAndGetLink()`, `recalculatePricing()`)

## Bug: Per-Size Price Override Not Applied in PDF/URL Quotes (2026-02-08)
**Project:** [Pricing Index]
**Problem:** When a user manually overrides the unit price on a child row (e.g., changing BB18000_2X from $90 to $95), the UI correctly shows $95, but Print Quote PDF and Save & Get Link still show $90. The override is visually correct but lost in all outputs.
**Root Cause:** The pricing engine (`embroidery-quote-pricing.js`) completely ignores `product.sizeOverrides`. The data flows correctly through `collectProductsFromTable()` which builds `sizeOverrides: { '2XL': 95 }`, but `calculateProductPrice()` and `calculateCapProductPrice()` never check it when building line items. The UI only worked because `recalculatePricing()` has a DOM-level post-processing hack (lines ~5810-5843) that overwrites cell text after the pricing engine runs. `printQuote()` and `saveAndGetLink()` use pricing engine output directly with no such hack.
**Solution:** In both `calculateProductPrice()` and `calculateCapProductPrice()`, check `sizeOverrides[size]` before grouping. If override exists, create a standalone line item with the fixed price and `isOverride: true` flag, then `continue` (skip normal grouping). In LTM distribution, skip items with `isOverride: true` so LTM isn't added on top of a user-specified price.
**Prevention:** When the pricing engine builds line items, it must respect ALL data collected by `collectProductsFromTable()`. If the UI modifies a value post-engine, the engine should be fixed to handle it natively — DOM hacks are fragile.
**Files:** `shared_components/js/embroidery-quote-pricing.js` (`calculateProductPrice()`, `calculateCapProductPrice()`, LTM distribution)

## Bug: AL Fee Row Shows Wrong Quantity (First Product Row Only)
**Date:** 2026-02-06
**Project:** [Pricing Index]
**Problem:** AL fee row displayed qty=5 when there were 26 garments. Total dollar amount was correct ($208).
**Root Cause:** `pricing.additionalServices` contains **one entry per product row** (not aggregated). Display code read `garmentALServices[0].quantity` (first product = 5) instead of summing all entries (5+4+7+5+5 = 26). Same bug in 4 places: garment fee row, cap fee row, garment sidebar, cap sidebar.
**Solution:** Replace all `[0].quantity` and `[0].unitPrice` with `.reduce()` aggregation across all entries. Unit price = total / summed qty.
**Prevention:** When pricing engine returns per-product arrays, always aggregate for display. Never assume `[0]` represents the whole.
**Files:** `embroidery-quote-builder.html` (`updatePricingDisplay()`)

## Bug: Stitch Count Changes Don't Update Prices (3 Bugs)
**Date:** 2026-02-06
**Project:** [Pricing Index]
**Problem:** Changing primary logo stitch count from 8000 to 12000 showed no visible pricing change.
**Root Cause (3 bugs):**
1. **Missing fee display:** AS-GARM/AS-CAP fee table rows were removed in a refactor but replacement `createServiceProductRow()` was never called. Pricing engine calculated stitch fees correctly but nothing displayed them.
2. **No `input` event:** Stitch input only had `change` listener (fires on blur/Enter). No `input` event = no update while typing or using spinner arrows.
3. **Wrong property names in reset:** Clear/New Quote set `primaryLogo.stitches = 8000` and `primaryLogo.digitizing = false` — correct names are `stitchCount` and `needsDigitizing`.
**Solution:** Added AS-GARM/AS-CAP fee rows to HTML + display logic in `updatePricingDisplay()`. Added `input` event listeners. Fixed property names in reset function.
**Prevention:** When refactoring fee display (removing old → adding new), verify the new approach is actually implemented, not just commented as TODO.
**Files:** `embroidery-quote-builder.html`

## Bug: Cap Stitch Total Hardcoded to Zero
**Date:** 2026-02-06
**Project:** [Pricing Index]
**Problem:** Changing cap stitch count above 8000 never produced an AS-CAP fee.
**Root Cause:** `embroidery-quote-pricing.js` line 1666: `capStitchTotal = 0` with comment "Caps have fixed 8K stitches." But the UI has a cap stitch input (1000-50000) and `calculateCapProductPrice()` calculates excess stitch cost — it just never rolled up into `capStitchTotal`.
**Solution:** Calculate `capStitchTotal` using same architecture as garments: `(extraStitches/1000) * capAdditionalStitchRate * capQuantity`. Skip for `laser-patch` embellishment (no stitches).
**Prevention:** When adding UI inputs, verify the full data flow: UI → object property → pricing engine → display. A working input with a hardcoded-zero rollup is invisible to users.
**Files:** `embroidery-quote-pricing.js`

## Bug: AL Digitizing Not Included in Grand Total
**Date:** 2026-02-06
**Project:** [Pricing Index]
**Problem:** Enabling AL digitizing ($100) showed the fee in the table but grand total didn't increase.
**Root Cause:** `recalculatePricing()` passed `logoConfigs.garment.additional: additionalLogos` — but `additionalLogos` was an empty module-level array from dead per-logo card code (System B). The working global toggle (System A) stored AL state in `globalAL` object, which was never injected into `logoConfigs`. So the pricing engine counted 0 AL logos for digitizing.
**Solution:** Build AL entries from `globalAL` state and inject into `logoConfigs.garment.additional` / `logoConfigs.cap.additional`. Removed dead System B code entirely.
**Prevention:** Two competing systems for the same feature = bugs. When one system supersedes another, delete the old code immediately.
**Files:** `embroidery-quote-builder.html`

## Pattern: Bake LTM Fee Into Calculator 1-7 Column Prices (No Visible $50)
**Date:** 2026-02-06
**Project:** [Pricing Index]
**Context:** Calculator pages previously showed "$50 small order fee" messaging and a detailed breakdown calculator. This was confusing for customers and drew attention to the fee rather than the all-in price.
**Change:** Both calculator pages (embroidery + cap embroidery) now:
1. Show all-in prices in the 1-7 column: `basePrice + ($50 / selectedQty)`
2. Quantity picker (default 3) updates all 1-7 column cells dynamically
3. Base prices stored in `data-base-price` attributes on `<td>` cells
4. Column header updates to show "1-7 pieces (N pcs)"
5. All "$50" / "Less Than Minimum" / "LTM" text removed from customer-facing content
6. Additional Logo tables left showing base prices (LTM applies to primary product only)
**Key Technique:** `data-base-price` attribute on each 1-7 `<td>` cell, read by `updateLTMCalculator()` which adds `50/qty` to each base price
**Cap difference:** Cap calculator wraps prices in `<span class="price">` inside cells, so update targets `cell.querySelector('.price') || cell`
**Files:**
- `calculators/embroidery-pricing.html` — table generation + `updateLTMCalculator()`
- `calculators/cap-embroidery-pricing-integrated.html` — same pattern adapted for caps
**Prevention:**
- When modifying calculator pricing display, remember 1-7 prices are dynamic based on qty picker. Always store base price in `data-base-price` for recalculation.
- **SYNC RULE:** The embroidery quote builder, embroidery calculator, AND cap embroidery calculator must all use the same LTM logic and pricing formulas. If you change LTM handling in one, update all three. The quote builder bakes LTM into `FinalUnitPrice` via the pricing engine (`ltmDistributed: true`); the calculators bake LTM via `data-base-price + 50/qty` in `updateLTMCalculator()`. Both approaches produce the same all-in price — just verify with identical inputs.

## Problem: Programmatically Checking Checkbox Doesn't Trigger Line Items
**Date:** 2026-01-31
**Project:** [Pricing Index]
**Symptoms:** ShopWorks import feature checked the "Digitizing" and "Additional Logo" checkboxes visually, but line items never appeared in Quote Summary. No $100 digitizing fee or $50 additional location fee.
**Root Cause:** Setting `checkbox.checked = true` only updates the DOM, not the JavaScript state that drives pricing. Each checkbox has a change handler that:
1. Updates a global state variable (e.g., `primaryLogo.needsDigitizing = true`)
2. Calls a pricing recalculation function (e.g., `recalculatePricing()`)
When programmatically setting `checked = true`, neither action happens.
**Solution:** After setting checkbox.checked, replicate both actions from the native handler:
```javascript
// BAD - Only updates DOM, no line item appears
digitizingCheckbox.checked = true;
updateArtworkCharges();  // Wrong function!

// GOOD - Matches native change handler behavior
digitizingCheckbox.checked = true;
primaryLogo.needsDigitizing = true;  // State update
recalculatePricing();  // Pricing trigger
```
**Prevention:** Before setting ANY checkbox programmatically in quote builders:
1. Search for its `addEventListener('change'` handler
2. Replicate both the state update AND the pricing function call
**Files affected:** `quote-builders/embroidery-quote-builder.html` (lines 6500-6555)

---

## Problem: DTF Quote Builder PDF showed wrong prices and duplicate subtotals
**Date:** 2026-01
**Project:** Pricing Index
**Symptoms:**
1. PDF base price showed $5.26 instead of UI's $15.00
2. Extended size upcharges applied incorrectly
3. Two "Subtotal:" lines appeared in PDF

**Root causes:**
1. `calculateUnitPrice()` in dtf-quote-builder.js was missing `product.baseCost` in fallback formula
2. Size upcharge was added AFTER margin division instead of BEFORE
3. `embroidery-quote-invoice.js` had two subtotal rows - one using calculated subtotal, one using grandTotal

**Fixes applied:**
1. **Fixed calculateUnitPrice()** - Added baseCost and moved upcharge before margin division:
   ```javascript
   // BEFORE (wrong): unitPrice = (transferCost + laborCost + freightCost) / margin;
   // AFTER (correct): unitPrice = (baseCost + upcharge + transferCost + laborCost + freightCost) / margin;
   ```
2. **Fixed duplicate subtotal** - Made second subtotal conditional (only shows when there are additional fees)
3. **Fixed size naming** - Changed 'LG' to 'L', 'XXL' to '2XL' throughout for consistency

**Files modified:**
- `/shared_components/js/dtf-quote-builder.js` (lines 1699-1739)
- `/shared_components/js/embroidery-quote-invoice.js` (lines 1524-1552)

**Prevention:** When building PDF pricing data, always read displayed prices from DOM first. Fallback calculations must match the formula used in `updatePricing()`.

---

## Problem: Calculator and quote builder show different prices
**Date:** 2025
**Project:** Pricing Index
**Symptoms:** Sales rep quotes one price, customer sees different price
**Root cause:** Calculator and quote builder had independent pricing implementations
**Solution:** Must test BOTH with identical inputs whenever pricing logic changes
**Prevention:** Rule #8 in CLAUDE.md: SYNC CALCULATOR & QUOTE BUILDER PRICES
Test example: PC61 Forest Green x 37 pieces should show $29.85/piece in BOTH

---

## Problem: Embroidery PDF quote missing product descriptions
**Date:** 2026-01
**Project:** Pricing Index
**Symptoms:** Product Description column empty on embroidery quote PDFs (J790 jacket showed empty, 112 cap showed empty)
**Root cause:** Invoice generator expects `product.title` but embroidery builder only passed `productName`. Other builders (Screen Print, DTG, DTF) already had `title` field mapped correctly.
**Solution:** Added `title: row.dataset.productName || style` to `collectProductsFromTable()` in embroidery-quote-builder.html (line 3618)
**Prevention:** When building products for invoice PDFs, always include these required fields:
- `product.style` - Style number (e.g., "PC54")
- `product.title` - Product description (e.g., "Port & Company Core Cotton Tee")
- `product.color` - Display color name

---

## Pattern: Customer-Facing Quote View Page & PDF Generation
**Date:** 2026-01-13
**Project:** Pricing Index
**Description:** Building a professional quote view page and PDF that shows ALL data from the quote builder. Applies to all quote types (Embroidery, Screen Print, DTG, DTF).

### Problem Solved
Quote view pages and PDFs were missing critical data that sales reps entered in the quote builder (sales rep name, embroidery details, additional logos, etc.). PDF had column overlap and wasn't print-friendly.

### Quote View Page Structure (`pages/quote-view.html` + `pages/js/quote-view.js`)

**1. Header Section**
- Company logo + Quote ID + Status badge
- Status options: Open, Viewed, Accepted, Expired

**2. Quote Meta Section (two-column grid)**
- Left: Customer info (Name, Company, Email, Phone)
- Right: Quote Details (Type, Created Date, Valid Until, **Sales Rep**)

**3. Embroidery Info Section** (for embroidery quotes only)
- Location, Stitch Count, Digitizing Fee, Additional Logo info
- Uses `renderEmbroideryInfo()` method
- Light green background (#e8f5e9) with green border

**4. Product Table** (tabular format matching quote builder)
- Columns: Style | Color | S | M | LG | XL | XXL | XXXL | Qty | Unit $ | Total
- First row has clickable thumbnail → opens product modal
- Extended sizes (2XL+) on separate rows with orange highlighting
- Uses `groupItemsByProduct()` → `buildProductRows()` for deduplication

**5. Totals Section**
- Subtotal
- LTM Fee (if > 0)
- WA Sales Tax (10.1%)
- Grand Total

### PDF Generation Structure (`generatePdfContent()` in quote-view.js)

**1. Header (green banner)**
```javascript
pdf.setFillColor(76, 179, 84); // Green #4cb354
pdf.rect(0, 0, pageWidth, 42, 'F');
// Company name, address, phone, website on left
// Quote ID and status on right
```

**2. Customer Info + Quote Details** (two-column layout)
- PREPARED FOR section (left)
- QUOTE DETAILS section (right) - includes Sales Rep if available

**3. Embroidery Details Section** (if embroidery quote)
```javascript
// Dynamic height: 22mm base, 28mm if additional logo exists
const boxHeight = hasAddlLogo ? 28 : 22;
pdf.setFillColor(248, 250, 252); // Light blue-gray
// Row 1: Location + Stitch Count
// Row 2: Digitizing + Add'l Stitch Charge
// Row 3: Additional Logo (if present)
```

**4. Products Table**
- Light gray header (#f0f0f0) - prints well in B&W
- Column positions calculated carefully to prevent overlap:
```javascript
const colX = {
    styleDesc: margin,       // 20mm  - Style + truncated description
    color: margin + 55,      // 75mm
    s: margin + 80,          // Size columns start at 100mm
    m: margin + 88,
    lg: margin + 96,
    xl: margin + 104,
    xxl: margin + 112,       // 2XL column
    xxxl: margin + 122,      // 3XL+ column
    qty: margin + 132,
    price: margin + 144,
    total: margin + 160
};
```

**5. Totals Section**
- Right-aligned, includes LTM Fee if > 0
- Tax calculation: `grandTotal * 0.101`

**6. Footer**
- Terms: "Quote valid for 30 days. 50% deposit required."
- Contact info

### Key Data Fields to Map

| Quote Builder Field | Web Location | PDF Location |
|---------------------|--------------|--------------|
| `SalesRepName` / `SalesRep` | Quote Details card | Quote Details section |
| `PrintLocation` / `LogoLocation` | embroidery-info section | Embroidery Details |
| `StitchCount` / `Stitches` | embroidery-info section | Embroidery Details |
| `DigitizingFee` | embroidery-info section | Embroidery Details |
| `AdditionalLogoLocation` | embroidery-info section | Embroidery Details |
| `AdditionalStitchCount` | embroidery-info section | Embroidery Details |
| `LTMFeeTotal` | totals-card | Totals section |

### Critical Fixes Applied

1. **PDF Column Overlap**: Total column was positioned BEFORE price column. Fixed by proper sequential X positions.
2. **Print-Friendly Header**: Changed from dark blue to light gray (#f0f0f0) background.
3. **Data Deduplication**: Items with same StyleNumber+Color grouped together, duplicates removed via `groupItemsByProduct()`.
4. **Product Images**: API returns object not array - use `Object.values(data)` to convert.

### Files to Reuse
- `pages/quote-view.html` - Template HTML structure
- `pages/js/quote-view.js` - All rendering and PDF logic
- `pages/css/quote-view.css` - Styles including product table, modal

### Applying to Other Quote Builders
1. Copy the quote-view page structure
2. Update `quoteTypes` mapping for the quote prefix
3. Modify embroidery section for quote-type-specific details (e.g., DTF locations, Screen Print colors)
4. Ensure quote service saves all required fields (SalesRep, location, fees)

---

## Problem: Comprehensive 2XL/XXL handling issues across quote builders
**Date:** 2026-01
**Project:** Pricing Index
**Symptoms:** Multiple 2XL bugs: (1) 2XL showing in BOTH XXL and XXXL columns in UI, (2) 2XL unit price missing after column fix, (3) 2XL not separated into own line item on Screen Print PDF
**Root cause:** Inconsistent 2XL handling across codebase - some arrays included '2XL', some didn't. Key insight: `2XL` = `XXL` (same size, double extra-large).

**Fixes applied:**

1. **UI Column Display** - Removed '2XL' from `SIZE06_EXTENDED_SIZES` in:
   - `/quote-builders/dtg-quote-builder.html` (line ~474)
   - `/quote-builders/screenprint-quote-builder.html` (line ~602)

2. **UI Unit Price** - Added `|| size === '2XL' || size === 'XXL'` to `isExtendedSize` check in:
   - `/quote-builders/dtg-quote-builder.html` (line ~3389)
   - `/quote-builders/screenprint-quote-builder.html` (line ~3538)

3. **PDF Column Mapping** - In `/shared_components/js/embroidery-quote-invoice.js`:
   - Removed '2XL' from `extendedSizes` array (line 1366)
   - Added 2XL→XXL mapping: `if (!qty && col === 'XXL') qty = sizes['2XL'];`

4. **PDF Line Items** - In `/quote-builders/screenprint-quote-builder.html` `buildScreenprintPricingData()`:
   - Removed '2XL' from `baseSizes` (line ~3867)
   - Added '2XL' to `extendedSizes` (line ~3895)

**Prevention:** 2XL rules to remember:
- `2XL` = `XXL` → SAME SIZE (double extra-large)
- `2XL`/`XXL` go in **Size05 column** (XXL column in UI)
- `3XL`+ go in **Size06 column** (XXXL/Other column in UI)
- `SIZE06_EXTENDED_SIZES` should NOT include '2XL' (it's Size05, not Size06)
- `baseSizes` for PDF line items should NOT include '2XL' (it has upcharge)
- `extendedSizes` for PDF line items SHOULD include '2XL' (separate line with upcharge)
- `isExtendedSize` pricing check must include `size === '2XL'` for child row prices

---

## Problem: OSFA and Cap Sizes Not Rendering in Quote View
**Date:** 2026-01-13
**Project:** Pricing Index
**Symptoms:** Richardson 112 caps with OSFA sizing saved correctly to database, returned by API, but NOT displayed in quote view table or PDF. Total items count was correct (40 = 28 garments + 12 caps), but product table only showed garments.

**Root Cause:** `buildProductRows()` in quote-view.js only handled standard sizes (S, M, L, XL) and extended sizes (2XL-6XL). OSFA was not in either array, so caps generated zero rows.

**ShopWorks Size Column System:**
| Column | UI Header | Contains |
|--------|-----------|----------|
| Size01-04 | S, M, LG, XL | Standard sizes |
| Size05 | XXL | **2XL ONLY** |
| Size06 | XXXL | **CATCH-ALL: 3XL+, OSFA, S/M, L/XL, etc.** |

**Solution:**
1. Add OSFA and cap sizes to `extendedSizes` array: `['2XL', '3XL', '4XL', '5XL', '6XL', 'OSFA', 'S/M', 'M/L', 'L/XL', 'ONE SIZE', 'ADJ']`
2. Update `xxxlCol` in `renderProductRow()` to check for OSFA and combo sizes
3. Update style suffix logic for OSFA products (e.g., `112_OSFA`)

**Files Modified:** `pages/js/quote-view.js` lines 560-576, 605-608

**Prevention:** When building quote view pages for other quote types:
- Always include OSFA, S/M, M/L, L/XL in the extended sizes array
- Size06 (XXXL column) is the catch-all for ALL non-standard sizes
- Test with cap products that use OSFA sizing
- Reference `/memory/MANAGEORDERS_COMPLETE_REFERENCE.md` for complete size column mapping

---

## Problem: Rounding logic inconsistent
**Date:** 2025
**Project:** Pricing Index
**Symptoms:** Some prices round up, some round down
**Root cause:** Different files used different rounding (Math.round vs Math.ceil)
**Solution:** Standardized on half-dollar ceiling: `Math.ceil(price * 2) / 2`
**Prevention:** All pricing must use half-dollar ceiling. Documented in service files

---

## Problem: Manual pricing override via URL could be exploited
**Date:** 2025
**Project:** Pricing Index
**Symptoms:** Users could add `?manualCost=0.01` to URL and get low prices
**Root cause:** Manual override feature for testing had no validation
**Solution:** Added to security review - consider removing or restricting
**Prevention:** Only use for internal testing. Don't advertise this feature

---

# Development Environment

## Problem: WSL localhost doesn't connect to local server
**Date:** 2025
**Project:** caspio-pricing-proxy
**Symptoms:** `localhost:3002` works in Windows but not in WSL terminal
**Root cause:** WSL has different network namespace than Windows host
**Solution:** Use WSL IP address instead of localhost: run `hostname -I` to get IP
**Prevention:** Documented in `/memory/LOCAL_DEVELOPMENT.md`. Use WSL IP: 172.x.x.x

---

## Problem: Git subtree push fails with "non-fast-forward"
**Date:** 2025
**Project:** Python Inksoft
**Symptoms:** `git push heroku main` fails from web/ folder
**Root cause:** Trying to push from within web/ subfolder instead of repo root
**Solution:** Use `git subtree push --prefix web heroku main` from main repo root
**Prevention:** Documented in deploy command

---

## Problem: Flask 404 after adding new routes
**Date:** 2025
**Project:** Python Inksoft
**Symptoms:** New Flask routes return 404, existing routes work
**Root cause:** Old server process still running on port 5000
**Solution:** Kill existing server (`taskkill //F //PID <PID>` on Windows), restart fresh
**Prevention:** Always check for zombie Flask processes before debugging routes

---

## Problem: CORS allows all origins in production
**Date:** 2025
**Project:** caspio-pricing-proxy
**Symptoms:** Security audit flagged this
**Root cause:** Development config (`origin: '*'`) left in production
**Solution:** Restrict to specific origins in production
**Prevention:** Check `config.js` CORS settings before deploying. Should whitelist only known domains

---

# Security

## Problem: SQL injection possible in Caspio queries
**Date:** 2025
**Project:** caspio-pricing-proxy
**Symptoms:** Security audit found injectable parameters
**Root cause:** Caspio API doesn't support parameterized queries - must use string interpolation
**Solution:** Input sanitization functions that escape quotes, remove SQL keywords
**Prevention:** Always use `sanitizeFilterInput()` for any user input going to Caspio. See `quotes.js` lines 8-29

---

## Problem: Stripe webhook could be spoofed
**Date:** 2025
**Project:** Pricing Index
**Symptoms:** Security concern about fake webhook calls
**Root cause:** No signature verification
**Solution:** Verify Stripe webhook signature before processing
**Prevention:** `server.js` line 197 verifies signature. Never skip this check

---

## Problem: XSS possible when rendering external data
**Date:** 2025
**Project:** Pricing Index
**Symptoms:** Security audit flagged innerHTML usage
**Root cause:** User/external data rendered without escaping
**Solution:** Use `escapeHTML()` helper when rendering via innerHTML
**Prevention:** Documented in CLAUDE.md Security Checklist

---

## Fix: XSS in email HTML templates (embroidery-quote-service.js) (2026-02-12)
**Date:** 2026-02-12
**Project:** [Pricing Index]
**Symptom:** Pre-ship audit found customer data (name, company, phone, project, notes) and product data (style, color, title, description) rendered unescaped in `generateProfessionalQuoteHTML()` and `generateProductsTableHTML()`. Meanwhile `quote-view.js` already used `escapeHtml()` in 15+ locations — so the web view was safe but the email was not.
**Root cause:** Service class didn't have its own `_escapeHtml()` method, and the global `escapeHtml()` from `quote-builder-utils.js` wasn't available in the class context.
**Solution:** Added `_escapeHtml()` as a class method on `EmbroideryQuoteService`. Applied to all 10 user-input interpolation sites in email HTML generation.
**Prevention:** When generating HTML in ANY file (not just views), always escape user input. The `quote-view.js` file is a good reference — grep for `escapeHtml` to see all protected sites. **Rule: if a string came from a user or database and goes into innerHTML/template literal HTML, it MUST be escaped.**

---

## Fix: XSS in Embroidery Quote Builder — 4 Unescaped innerHTML Locations
**Date:** 2026-02-10
**Project:** [Pricing Index]
**Problem:** Product colors, quote IDs, and search suggestion values were inserted into `innerHTML` without escaping. A product color like `<img onerror=alert(1)>` would execute.
**Root Cause:** Template literals used `${variable}` directly inside innerHTML assignments. The `escapeHtml()` utility existed in `quote-builder-utils.js` but wasn't being used at these locations.
**Solution:** Applied `escapeHtml()` to: (1) product color in color cell, (2) quoteId/revision in edit mode header, (3) product.value and productName in search suggestions (both onclick attribute and display text).
**Prevention:** grep for `innerHTML.*\$\{` periodically. Any template literal inside innerHTML must use `escapeHtml()` unless the value is provably safe (numbers from `.toFixed()`, hardcoded strings).
**Files:** `quote-builders/embroidery-quote-builder.html` (lines ~2333, ~2438, ~3164-3166)

---

## Fix: Pricing API Fetches Missing response.ok Checks — Silent Bad Data
**Date:** 2026-02-10
**Project:** [Pricing Index]
**Problem:** 4 fetch calls in the pricing engine went straight to `.json()` without checking HTTP status. A 404 or 500 response would silently produce garbage/undefined pricing data — worse than showing an error.
**Root Cause:** Missing `if (!response.ok)` guard before `.json()`. The `fetch()` API doesn't throw on HTTP errors, only on network failures.
**Solution:** Added `if (!response.ok) throw new Error(...)` before each `.json()` call. The existing try/catch blocks already handle errors with console warnings and fallback defaults.
**Prevention:** Every `fetch()` call must check `response.ok` before `.json()`. Erik's #1 rule: wrong pricing data is WORSE than showing an error.
**Files:** `shared_components/js/embroidery-quote-pricing.js` (lines ~114, ~246, ~273, ~383)

---

# Best Practices

## Pattern: Multi-location store fallback resolution
**Date:** 2025
**Project:** Python Inksoft
**Description:** AMC, Hops n Drops have 100+ locations each
**Pattern:** 3-level fallback for location resolution:
1. Exact match on checkout field value
2. Case-insensitive match if #1 fails
3. ZIP code fallback from shipping address
**Files:** `stores.py` lines 335-376

---

## Pattern: OAuth token caching with expiry buffer
**Date:** 2025
**Project:** All
**Description:** Prevent auth failures during long requests
**Pattern:** Cache token with 60-second buffer before expiry
**Files:**
- caspio-pricing-proxy: `server.js` lines 45-79
- Python Inksoft: `caspio_api.py` lines 35-73

---

## Pattern: Prefixed console.log for debugging
**Date:** 2025
**Project:** Pricing Index
**Description:** Easy to filter logs by module
**Pattern:** `[ModuleName] Message` format
**Example:** `[DTFPricingService] Fetching complete pricing bundle from API...`
**Benefit:** grep-friendly, identifies source module

---

## Pattern: Quote ID format for phone reference
**Date:** 2025
**Project:** Pricing Index
**Description:** Sales reps need to reference quotes by phone
**Pattern:** `[PREFIX][MMDD]-[sequence]`
**Examples:** `DTG0107-1`, `EMB0107-2`, `RICH0107-1`
**Why:** Domain-aware IDs are easier to read over phone than UUIDs

---

## Pattern: Structured error responses
**Date:** 2025
**Project:** All
**Description:** Consistent error format across all APIs
**Pattern:**
```json
{"error": "Descriptive message", "code": "ERROR_CODE"}
```
**Prevention:** Never return generic 500 errors. Always include actionable message

---

## Pattern: Parallel batch operations for bulk API calls
**Date:** 2026-01-14
**Project:** Pricing Index
**Description:** Sequential API calls (one at a time) cause UI to hang when processing many items. Discovered when deleting 470 quote items took forever.
**Pattern:** Use `Promise.all()` with batched operations:
```javascript
const batchSize = 10;
for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    await Promise.all(
        batch.map(item =>
            fetch(`/api/items/${item.id}`, { method: 'DELETE' })
                .catch(err => console.warn(`Failed:`, err))
        )
    );
}
```
**Files:** `/shared_components/js/embroidery-quote-service.js` lines 107-120
**Benefit:** 470 items deleted in seconds instead of minutes. Batch size of 10 balances parallelism vs server load.

---

# Business Insights

## Insight: DECG Upsell Opportunity — Sell SanMar Product + Service Instead
**Date:** 2026-02-15
**Project:** [Pricing Index]
**Analysis:** Across 104 ShopWorks orders (13 batches, May 2025 data), 22 DECG (customer-supplied garment) instances were identified. In most cases, reps charged $15-25/piece flat instead of the 2026 tiered rates ($20-28/pc). Estimated $800-1,500 left on the table from underpricing alone.
**Bigger Opportunity:** Many DECG customers could have been sold equivalent SanMar products + embroidery, yielding higher margin on both product markup AND service. DECG captures only service revenue; selling the garment captures product margin too.
**When DECG is appropriate:** Customer insists on specific brand (Nike, Patagonia, lululemon), item not in SanMar catalog, corporate uniform requirements.
**Upsell script:** "We can source a comparable [product type] and handle the embroidery as a package — often at a better price than buying separately. Want me to pull some options?"
**Prevention:** Training document created at `/memory/REP_TRAINING_PRICING_GAP_ANALYSIS.md` with rep-specific coaching for Nika Lao and Taneisha Clark. DECG/AL tier cards should be printed for desk reference.

---

## Insight: LTM Fee Revenue Opportunity - $43K Annually
**Date:** 2026-02-02
**Project:** [Pricing Index]
**Analysis:** Ran LTM (Less Than Minimum) analysis on 2025 embroidery order data using `npm run test:emb-ltm`.

**Key Findings:**
| Metric | Value |
|--------|-------|
| Total 2025 Orders | 1,310 |
| LTM Orders (<24 pieces) | 862 (65.8%) |
| Non-LTM Orders (≥24 pieces) | 448 (34.2%) |

**LTM Order Breakdown:**
- 1-5 pieces: 382 orders (44.3% of LTM)
- 6-11 pieces: 241 orders (28.0% of LTM)
- 12-17 pieces: 156 orders (18.1% of LTM)
- 18-23 pieces: 83 orders (9.6% of LTM)

**Revenue Projection (if 100% collection):** $43,100/year ($50 × 862 orders)
**Conservative Estimate (70-80% collection):** $30,170 - $34,480/year

**Takeaway:** Nearly two-thirds of embroidery orders are under the 24-piece minimum. Consistent LTM fee enforcement could add $30K-$43K annually.

**Files:**
- Analysis script: `tests/validation/validate-2025-embroidery-pricing.js --ltm-analysis`
- Report: `tests/reports/ltm-analysis.json`

---

## Insight: ShopWorks Data Entry Quality — 98+ Parser Workarounds
**Date:** 2026-02-15
**Project:** [Pricing Index]
**Analysis:** After auditing 104 ShopWorks orders across 13 batches, the parser accumulated 98+ workarounds for messy data entry: 13 service code aliases, description-based service detection, separator/label suppression, address typo handling, combo size splitting, and legacy part number mapping. Messy data entry is the #1 source of parser complexity.
**Root causes:** Empty part numbers on priced items, "Transfer"/"EMB"/person names entered as line items, lowercase state abbreviations, mixed decoration types on one order, AL used when Full Back was intended, legacy/wrong service codes.
**Solution:** Created comprehensive data entry guide at `/memory/SHOPWORKS_DATA_ENTRY_GUIDE.md` with STOP/START/CHECKLIST structure. Added summary section to `/memory/REP_TRAINING_PRICING_GAP_ANALYSIS.md`. Target audience: Nika Lao, Taneisha Clark.
**Prevention:** Print the Pre-Submit Checklist and alias reference card for rep desks. Review with Service Price Cheat Sheet (`/calculators/service-price-cheat-sheet.html`).

---

## Bug: E2E Batch Runner Used Frontend-Only Route Against Backend Proxy (2026-02-13)
**Date:** 2026-02-13
**Project:** [Pricing Index]
**Symptoms:** E2E verify/cleanup calls to `/api/public/quote/:quoteId` returned 404 from the backend proxy.
**Root cause:** That route only exists on the frontend Express server (`server.js:2801`), not the backend Caspio proxy. The batch runner was calling the backend URL directly.
**Solution:** Changed verify/cleanup to fetch session and items separately via Caspio REST filter endpoints: `GET /api/quote_sessions?filter=QuoteID='...'` and `GET /api/quote_items?filter=QuoteID='...'`.
**Prevention:** Always check which server a route lives on. Frontend routes use `makeApiRequest()` (proxy to Caspio). Backend routes are direct Caspio REST. Also added 5s+ delay between orders to avoid 429 rate limits from rapid sequential API calls.
**Files:** `tests/e2e-batch-runner.js`, `tests/e2e-verify-order.js`

---

## Bug: Beanies Priced as Caps in Quote Builder but as Garments on Calculator Pages (2026-02-16)
**Date:** 2026-02-16
**Project:** [Pricing Index]
**Symptoms:** CP90 (Port & Company Knit Cap / beanie) showed different prices on the embroidery calculator page vs the embroidery quote builder. Calculator used garment/flat pricing; quote builder used cap pricing with CeilDollar rounding and cap tiers.
**Root cause:** Calculator pages used `ProductCategoryFilter.isFlatHeadwear()` to detect beanies and route them to flat embroidery. Quote builders had their own `isCapProduct()` function that caught beanies via SanMar `CATEGORY_NAME: 'Caps'`, style regex `/^C[P0-9]/`, and "BEANIE" title keyword — with no flat headwear exclusion.
**Solution:** Added `ProductCategoryFilter.isFlatHeadwear()` as priority check at top of `isCapProduct()` in all 4 quote builders (EMB, DTG, SP). Added `product-category-filter.js` script tag to each. Updated parser `_isCapFromDescription()` with flat headwear exclusion + new `_isFlatHeadwear()` helper. Refactored OSFA setup in ShopWorks import to be independent of `isCap` flag. Bonus: DTG builder no longer rejects beanies (was blocking them as "caps").
**Prevention:** Any product categorization must use `ProductCategoryFilter` as single source of truth. Never duplicate keyword lists across files. When adding new product type detection, check all 3 systems (calculators, quote builders, parser).
**Files:** `quote-builders/embroidery-quote-builder.html`, `quote-builders/dtg-quote-builder.html`, `quote-builders/screenprint-quote-builder.html`, `shared_components/js/shopworks-import-parser.js`, `shared_components/js/product-category-filter.js` (unchanged, already correct)

---

## Pattern: Caspio DataPage Host-Page Styling
**Date:** 2026-02
**Project:** [All]
**Description:** How to style/restructure Caspio DataPage results from the host page without modifying the DataPage in Caspio.
**Pattern:**
1. **Caspio `<script>` embeds inject HTML into the host DOM (NOT an iframe)** — host page CSS/JS can target all Caspio elements directly via `document.querySelector()`
2. **Key CSS class names**: `cbResultSetPanelDataContainer` (dl), `cbResultSetListViewDataLabel` (dt), `cbResultSetData` (dd), `cbResultSetDataLink` (links), `cbSearchButton`, `cbFormTextField`, `cbFormSelect`. Data attribute: `[data-cb-name="data-row"]` (result cards)
3. **Use `!important`** on CSS overrides — Caspio inlines its own styles
4. **MutationObserver pattern** for detecting async Caspio rendering: observe container for `{ childList: true, subtree: true }`, debounce 100ms. PLUS immediate call + `setTimeout(500)` + `setTimeout(2000)` fallbacks for content already rendered or slow search re-renders
5. **Caspio orphan `<dd>` quirk**: Image/file fields render as standalone `<dd>` with no preceding `<dt>`. Don't rely on dt→dd pair extraction for images — scan the `dl` element directly for `img` or `a` tags
6. **Workflow split**: Erik builds/deploys DataPage in Caspio (data fields, search criteria, HTML blocks). All visual styling, layout restructuring, modals, responsive design is done on the host page. No need to re-deploy the DataPage for CSS-only changes.
**Files:** `dashboards/digitized-designs.html` (reference implementation), 50 pages total use Caspio embeds

---

## Bug: Full Back Tier Pricing Only Applied to AL Path, Not Primary Logo (2026-02-18)
**Date:** 2026-02-18
**Project:** [Pricing Index]
**Symptoms:** After implementing FB tier pricing from Digitized Designs Master, batch 10 order #136257 (design #32446, 154K stitches, 2 pcs) still showed $192.75/pc (formula) instead of $186/pc (1-7 tier). Total unchanged at $656.74.
**Root cause:** The pricing engine has TWO separate Full Back code paths: (1) Primary logo at ~line 1414 where `primaryFullBackStitchCost` is calculated and later multiplied by `garmentQuantity`, and (2) AL Full Back at ~line 1556 which creates a separate `DECG-FB` fee item. Only the AL path was updated — the primary path still used the hardcoded `(stitchCount / 1000) * $1.25` formula.
**Solution:** Updated both code paths to check `logo.fbPriceTiers` before falling back to formula. Added `_getFBTierPrice(tiers, quantity)` helper method. Primary path uses `garmentQuantity` for tier lookup (total across all products); AL path uses per-product `quantity`. After fix: $641.88 (correct — $13.50 savings + $1.36 tax = $14.86 reduction).
**Prevention:** When modifying pricing behavior for any feature, search for ALL code paths that calculate that feature's price. The pricing engine has primary logo calculations (early in `calculatePricing()`) AND additional logo calculations (later loop) — both must be checked. Use grep for the specific variable/formula being changed.
**Files:** `shared_components/js/embroidery-quote-pricing.js` (lines ~1414 and ~1556)

---

## Bug: compare-pricing.html Had Broken Custom Cap Detection — Beanies Showed Cap Pricing (2026-02-19)
**Date:** 2026-02-19
**Project:** [Pricing Index]
**Symptoms:** Looking up CP90 (Port & Company Beanie) on the Compare Pricing page showed Cap Embroidery pricing only, instead of the 4 garment method cards (DTG, DTF, Embroidery, Screen Print).
**Root cause:** `compare-pricing.js` had its own inline `isCap` detection that checked `category.includes('beanie')` → `isCap = true`. This diverged from `ProductCategoryFilter.isStructuredCap()` (the single source of truth), which correctly returns `false` for flat headwear.
**Solution:** Added `product-category-filter.js` script tag to `compare-pricing.html`. Replaced inline detection with `ProductCategoryFilter.isStructuredCap(product)` with a safe fallback for cases where the script isn't loaded.
**Prevention:** Any page that distinguishes garment vs cap MUST load `product-category-filter.js` and call `isStructuredCap()`. Never duplicate the cap detection logic inline — it will inevitably diverge from the source of truth.
**Files:** `calculators/compare-pricing.html`, `calculators/compare-pricing.js`

---

# Template for New Entries

```markdown
## Problem: [Brief description]
**Date:** YYYY-MM
**Project:** [Pricing Index | caspio-pricing-proxy | Python Inksoft | All]
**Symptoms:** What the bug looked like to users/developers
**Root cause:** What was actually wrong
**Solution:** How we fixed it
**Prevention:** How to avoid this in future (rule added, pattern documented, etc.)
```

For best practices/patterns:
```markdown
## Pattern: [Name]
**Date:** YYYY-MM
**Project:** [Project name]
**Description:** What problem this solves
**Pattern:** How it works
**Files:** Where to find implementation
```
