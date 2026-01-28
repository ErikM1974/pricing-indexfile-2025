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

---

## Related Documentation

**For comprehensive ManageOrders API documentation, see:**
- **[MANAGEORDERS_COMPLETE_REFERENCE.md](./MANAGEORDERS_COMPLETE_REFERENCE.md)** - Complete API reference covering all PULL/PUSH endpoints, every field, patterns, gotchas, and usage across all three projects (1000+ lines)

---

# API & Data Flow

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

# Code Organization

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
