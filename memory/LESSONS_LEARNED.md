# Lessons Learned

Active reference of recurring bugs, critical patterns, and gotchas. For historical/resolved entries, see [LESSONS_LEARNED_ARCHIVE.md](./LESSONS_LEARNED_ARCHIVE.md).

**Target: <300 lines. If this file exceeds 300 lines, archive older resolved entries before adding new ones.**

---

## Quote Builder Calculations

### SCP recalculatePricing() Crash — primaryPricing Out of Scope
**Problem:** Screenprint sidebar showed Total Pieces: 0 and $0.00. `ReferenceError: primaryPricing is not defined`.
**Root Cause:** Nudge savings calc referenced loop-scoped `const` variables after the loop closed.
**Solution:** Capture needed values in outer-scope variables before the loop.
**Prevention:** Post-loop summaries must use outer-scope captures. Test with extended sizes (2XL+).

---

### Parent Row Qty Double-Counting — Second Code Path in 2XL Handler
**Problem:** DTG/SCP parent Qty included child row quantities even after fixing `onSizeChange()`.
**Root Cause:** TWO code paths update parent Qty — the 2XL handler explicitly added child quantities back.
**Solution:** Removed child quantity addition from 2XL handler in each builder.
**Prevention:** Grep for ALL places that update the same DOM element. Multiple paths = inconsistency.

---

### DTF Garment Base Cost From Arbitrary Record — Pricing Inversion
**Problem:** DTF showed Long Sleeve cheaper than Short Sleeve (prices inverted).
**Root Cause:** `firstDetail.CASE_PRICE` from `/api/product-details` returns unsorted per-color x size records.
**Solution:** Use `blankBundle.sizes` from BLANK pricing-bundle which aggregates correctly.
**Prevention:** Never use `firstDetail.CASE_PRICE` — use pricing-bundle or base-item-costs endpoints.

---

### DTF Parent Row Qty Double-Counts Child Rows
**Problem:** Parent Qty=70 but Total=$585 didn't match. Standard qty was 45, child had 25.
**Root Cause:** `onSizeChange()` added child quantities to parent display, but pricing only uses standard sizes.
**Solution:** Removed child row aggregation. Parent shows standard sizes only; children display independently.
**Prevention:** Parent Qty = standard sizes only. `getTotalQuantity()` is truth for combined totals.

---

### Extra Stitch Charges Double-Counted in Unit Price AND Line Item
**Problem:** J790 @ 9K stitches: $74.25 in matrix PLUS separate AS-GARM line item. Customer pays twice.
**Root Cause:** `calculateProductPrice()` included stitch cost AND pricing engine created separate fee.
**Solution:** Pass `0` for stitch cost — show ONLY as separate AS-GARM/AS-CAP line items.
**Prevention:** Extra charges NEVER embedded in unit price. Always separate fee line items.

---

### 1-Cent Tax Rounding Error in Quote PDF Totals
**Problem:** PDF total off by $0.01. Components summed correctly but total didn't match.
**Root Cause:** Tax computed as raw float, displayed rounded, but added to total unrounded. IEEE 754 rounding.
**Solution:** `Math.round(subtotal * taxRate * 100) / 100` — round tax to cents BEFORE summing.
**Prevention:** Round each component to cents first, then sum. Never sum unrounded floats.

---

## Pricing Architecture

### ALWAYS Pull Pricing From Caspio API — Never Hardcode
**Problem:** Hardcoded 3D Puff upcharge ($5/cap) in JavaScript.
**Solution:** ALL pricing values from Caspio tables, fetched via API. No code deploys for price changes.
**Prevention:** Single source of truth in Caspio. Sales team adjusts without developer involvement.

---

### Mixed Quote Tier Separation (Caps vs Garments)
**Problem:** Caps and garments need SEPARATE tier calculations — cannot combine for quantity discounts.
**Root Cause:** Different methods, stitch counts, stitch rates, and industry standard.
**Solution:** `garmentTier = getTier(garmentQty)`, `capTier = getTier(capQty)` — never combine.
**Prevention:** Each type under threshold gets separate $50 LTM fee.

---

### Wrong Pricing Displayed Silently
**Problem:** Incorrect prices shown to customers with no error visible.
**Root Cause:** API failed but code used cached/fallback data silently.
**Prevention:** Rule #4: NO Silent API Failures. Wrong pricing is WORSE than showing an error.

---

### Inventory Showing "Unable to Verify" (COLOR_NAME vs CATALOG_COLOR)
**Problem:** Cart saves but inventory check shows "Unable to Verify."
**Root Cause:** Using `COLOR_NAME` ("Brilliant Orange") instead of `CATALOG_COLOR` ("BrillOrng") for API queries.
**Prevention:** `CATALOG_COLOR` for API calls, `COLOR_NAME` for display only. See CLAUDE.md Two Color Field System.

---

### Shipping Not Taxed in Quote View (WA State Requires It)
**Problem:** Quote view/PDF taxed subtotal only. WA state requires tax on shipping too.
**Solution:** All 6 tax sites changed to `taxableAmount = subtotal + shipping`.
**Prevention:** WA state taxes shipping. All tax calculation sites must include shipping in taxable base.

---

### Beanies Priced as Caps (ProductCategoryFilter Is Truth)
**Problem:** CP90 beanie: different prices on calculator vs quote builder.
**Root Cause:** Quote builder's `isCapProduct()` caught beanies via SanMar CATEGORY_NAME without flat headwear exclusion.
**Solution:** Added `ProductCategoryFilter.isFlatHeadwear()` check in all quote builders.
**Prevention:** Use `ProductCategoryFilter` as single source of truth. Never duplicate keyword lists.

---

### LTM Display Mode — Builtin vs Separate Math Must Match
**Problem:** DTG/SCP builtin: row total != unit price x qty. DTF separate: LTM double-counted.
**Root Cause:** Subtotal calc didn't branch by display mode; fee row duplicated baked-in amount.
**Solution:** Branch subtotal by mode. Both modes must produce identical grand totals.
**Prevention:** Trace ALL paths: unit price, row total, subtotal, grand total, tax, discount.

---

## Multi-SKU & Extended Sizes

### PC54 2XL Size Mapping Wrong (Size05 Not Size06)
**Problem:** 2XL orders going to wrong ShopWorks SKU.
**Root Cause:** PC54_2X uses Size05, not Size06 as expected.
**Prevention:** PC54: base (Size01-06), PC54_2X uses **Size05** (NOT Size06!). Always verify with ShopWorks.

---

### Size Modifiers Not Applying Correctly (_2X Not _2XL)
**Problem:** 2XL and 3XL items going to wrong SKUs.
**Root Cause:** ShopWorks uses `_2X`/`_3X`, NOT `_2XL`/`_3XL`. SanMar API also rejects `_2XL`.
**Prevention:** Always check SIZE_MODIFIERS dict. `_2XL` → `_2X` fix applied across all 12 files (2026-02-21).

---

### OnSite Needs Pre-Suffixed PNs for Extended Sizes
**Problem:** Extended sizes lost suffix — J790 should be J790_2X for 2XL.
**Root Cause:** OnSite's Size Translation Table only assigns columns, never modifies PN.
**Solution:** Use `getPartNumber(item.StyleNumber, size)` for all LinesOE entries.
**Prevention:** Always use `getPartNumber()` from `size-suffix-config.js`.

---

## ManageOrders & ShopWorks

### OnSite Integrations All Share /onsite URL
**Problem:** Embroidery PUSH health check returned 403 from `/embroidery/signin`.
**Root Cause:** All OnSite integrations share `/onsite`. Distinguished by `ExtSource`/`id_Customer`, not URL paths.
**Prevention:** Verify URL from ShopWorks admin. Don't infer paths from integration names.

---

### TaxTotal > 0 Creates Unwanted Tax Line Item
**Problem:** Pushed orders had phantom tax line item auto-generated from `TaxTotal`.
**Solution:** Always send `TaxTotal: 0`. OnSite calculates tax from `sts_EnableTax` flags per line item.
**Prevention:** For ManageOrders integration type, ALWAYS `TaxTotal: 0`. Only InkSoft type supports `TaxTotal > 0`.

---

### Push API Does NOT Support Tax Fields
**Problem:** Tax fields (`Tax[]`, `coa_AccountSalesTax01`, `sts_EnableTax`) all stripped by OnSite.
**Root Cause:** ManageOrders Push API schema doesn't include these — they're InkSoft-specific.
**Solution:** Removed unsupported fields. Use Notes On Order for tax info.
**Prevention:** Only rely on fields in official Swagger spec. Non-Swagger fields silently stripped.

---

### Simple Design Linking via {id_Design: N}
**Problem:** Full design blocks caused ShopWorks to create duplicate designs.
**Solution:** Known design → `{id_Design: parseInt(number)}`. Unknown → `Designs: []` (empty, let humans handle).
**Prevention:** Always link by ID. Don't auto-create placeholder records.

---

### All Sizes Showing as Adult/S (id_Integration Must Be Valid)
**Problem:** Imported orders show correct product but every item is Adult/S.
**Root Cause:** Missing or zero `id_Integration` — ShopWorks doesn't know which Size Translation Table.
**Prevention:** Every store config MUST have valid `id_Integration`. Check for `"id_Integration": 0`.

---

## Caspio API Gotchas

### REST API AlterReadOnlyData (Formula Fields + Emojis)
**Problem:** PUT returned 500 `AlterReadOnlyData`.
**Root Cause 1:** Caspio REST API rejects 4-byte UTF-8 (emojis) with misleading "read-only" error.
**Root Cause 2:** Formula fields (e.g., `Amount_Art_Billed`) are read-only — only source fields are writable.
**Prevention:** Never write to formula fields. Never include emojis in API payloads. Strip non-ASCII as defense.

---

### Dropdown Fields Return Objects, Not Strings
**Problem:** Art Request showed `[object Object]` for Order Type.
**Root Cause:** Caspio dropdown fields return objects like `{'6': 'Transfer'}` via REST API.
**Solution:** `typeof === 'object'` → `Object.values(field).join(', ')`.
**Prevention:** Dropdowns → object, text → string, files → may be base CDN URL when empty.

---

### Triggered Actions Don't Fire on REST API Updates
**Problem:** Expected Caspio triggered actions for email notifications on REST API updates.
**Root Cause:** Triggered actions ONLY fire on DataPage form submissions, NOT REST API updates.
**Solution:** Use EmailJS (client-side) or server-side notifications instead.
**Prevention:** REST API updates = no Caspio automation. Plan for external notifications.

---

## JavaScript Patterns

### Falsy-Zero Bug (Use ?? Instead of ||)
**Problem:** Tax rate showed 10.1% for out-of-state quotes where `taxRate` was `0`.
**Root Cause:** `this.taxRate || 0.101` — JS `||` treats `0` as falsy.
**Solution:** `this.taxRate ?? 0.101` — nullish coalescing only falls through on `null`/`undefined`.
**Prevention:** Always `??` when `0`, `""`, or `false` are valid values. Reserve `||` for all-falsy defaults.

---

### getSizeSuffix() Falsy-Zero Bug (|| vs undefined)
**Problem:** `getSizeSuffix('XLR')` returned `'_XLR'` instead of `''`. Normalization worked but empty string `''` is falsy.
**Root Cause:** `SIZE_TO_SUFFIX[normalized] || SIZE_TO_SUFFIX[size]` — `''` treated as miss by `||`.
**Solution:** Explicit `if (normalizedSuffix !== undefined) return normalizedSuffix;`.
**Prevention:** Same class as taxRate bug. Use `??` or explicit `!== undefined` check.

---

## Data Integrity

### Quote Update Race Condition — DELETE-then-INSERT Risks Data Loss
**Problem:** `updateQuote()` deleted ALL items then re-inserted. Browser crash mid-insert = permanent data loss.
**Solution:** Reversed to insert-then-delete. Only delete old items if ALL new inserts succeed.
**Prevention:** For replace-all operations, write new data first, verify, then remove old.

---

### Quote Sequence Race Condition — Concurrent Requests Get Duplicate IDs
**Problem:** Two rapid saves could get the same sequence number.
**Root Cause:** Caspio doesn't support atomic increment. GET-then-PUT isn't atomic.
**Solution:** In-memory mutex lock per prefix. Concurrent requests serialized via promise queue.
**Prevention:** Any read-modify-write on Caspio needs application-level locking.

---

### Garment Tracker Stale Data — ManageOrders 60-Day Limit + No Daily Sync
**Problem:** Dashboard showed wrong commission totals. 33 records missing, 46 InkSoft records shouldn't count.
**Root Cause:** No automated daily sync from ManageOrders → Caspio. Relied on manual sync button. Orders older than 60 days fell off ManageOrders permanently. InkSoft orders (type 31) weren't excluded.
**Solution:** Created `sync-garment-tracker.js` daily script (Heroku Scheduler 1PM UTC). Added exclusion filters for InkSoft (type 31) and per-quarter customers. Consolidated config into single file (`config/garment-tracker-config.js`).
**Prevention:** Any ManageOrders-dependent feature needs a daily sync script — never rely on manual button clicks. Cross-reference ShopWorks CSV exports before commission payouts.

---

### Mockup Approve Button Unresponsive — Disabled Attribute Blocks Click Handler
**Problem:** AE (Taneisha) clicks "Approve Mockup" button but nothing happens. No toast, no error, no feedback.
**Root Cause:** Button rendered with `disabled` HTML attribute (`mockup-detail.js:314`). Disabled buttons don't fire click events, so the existing guard toast ("Please click a mockup image to select it first") never ran.
**Solution:** Removed `disabled` from both AE (`:314`) and customer (`:267`) approve buttons. Click handlers already have proper guards for missing selection.
**Prevention:** Never use `disabled` to enforce a workflow step if the click handler already has guard logic with user feedback. Use the handler's toast/error message instead.

---

### AE Edit Save Broken — PK_ID vs ID_Design Mismatch in Backend
**Problem:** AE edits art request fields via Edit modal, clicks Save, gets console error or changes don't persist.
**Root Cause:** Backend `PUT /api/art-requests/:designId/fields` (art.js:874) used `q.where=PK_ID=${designId}`, but the URL passes `ID_Design`. Every other endpoint in the file correctly uses `ID_Design`. Commit `cfcc1de` introduced the bug.
**Solution:** Changed `PK_ID` to `ID_Design` in the WHERE clause (commit `2ed4724`).
**Prevention:** ArtRequests endpoints ALWAYS use `ID_Design` for the WHERE clause. The URL param is the design ID, not the primary key. Check consistency across all endpoints in a route file.

---

### SanMar Sync Upsert Bug — `makeCaspioRequest` Returns Array, Code Checks `.Result`
**Problem:** Caspio SanMar tables had only 7 orders (should be hundreds). Backfill processes hung indefinitely. Every sync created duplicates instead of updating existing records.
**Root Cause:** `makeCaspioRequest()` in `src/utils/caspio.js:100` returns `response.data.Result` (the array directly). But all 6 upsert locations in `sanmar-orders.js` and `sanmar-invoices.js` checked `existing.Result` — which is `undefined` on an array. Every existence check failed, causing INSERT instead of UPDATE.
**Solution:** Changed all 6 checks from `existing.Result.length` to `Array.isArray(existing) && existing.length > 0`. Also fixed backfill line item dedup (was blind POST with silent catch → proper GET/PUT/POST upsert).
**Prevention:** `makeCaspioRequest` unwraps `.Result` — never check `.Result` on its return value. When writing Caspio upsert logic, always test with `Array.isArray()`. Add this to common-gotchas.md.

---

### Mockup Detail — Replace Button Downloads File Instead of Opening Popover
**Problem:** AE clicks the teal "Replace" button on the reference file slot, but instead of opening the upload popover, the file URL opens in a new tab (download behavior).
**Root Cause:** The slot's click handler (`slotEl.addEventListener('click', ...)`) calls `window.open(url, '_blank')` for non-image files and `openLightbox(url)` for images. The exclusion list (`e.target.closest(...)`) checked for `.pmd-slot-remove`, `.pmd-slot-download`, `.pmd-slot-version-badge`, and `.pmd-version-dropdown` — but NOT `.pmd-slot-replace`. So the Replace button's delegated click handler fired (opening popover), but the slot's direct click handler ALSO fired (opening URL).
**Solution:** Added `.pmd-slot-replace` to the exclusion list in both slot click handlers (image path line 1213, non-image path line 1253).
**Prevention:** When adding new interactive buttons inside gallery slots, ALWAYS add their class to the slot click handler's exclusion list. Both the image and non-image paths have separate exclusion lists that must stay in sync.

---

### Caspio Rejects q.pageSize < 5 — fetchAllCaspioPages Broke All Small-Limit Endpoints
**Problem:** Art Hub detail page, Daily Sales Archive, and any endpoint using `limit=1` thru `limit=4` returned 500 after pagination fix deploy.
**Root Cause:** Commit 30bbfba converted ALL `q.limit` to `q.pageSize` upfront. Caspio API rejects `q.pageSize < 5` with `IncorrectQueryParameter`.
**Solution:** Keep `q.limit` for page 1 (universally compatible). Only switch to `q.pageSize` + `q.pageNumber` for pages 2+ (where the v3 conflict exists).
**Prevention:** Never blindly replace `q.limit` with `q.pageSize`. Test with `limit=1` after any pagination changes. Caspio v2/v3 have different param support.

---

### SanMar→ShopWorks Style Normalization — _OSFA and _S/M Suffixes Not Stripped
**Problem:** SanMar order matching failed for orders with `_OSFA`, `_S/M`, `_L/XL` part number suffixes. 36 orders had empty id_Order.
**Root Cause:** The regex `/_\d?[xXsSmMlL]+$/i` only handled `_2X`/`_3XL` style suffixes. `NE1020_S/M`, `BG517_OSFA` stayed un-normalized, never matching SanMar's base style `NE1020`/`BG517`.
**Solution:** Added `replace(/_(OSFA|S\/M|L\/XL|ONE SIZE)$/i, '')` before the existing regex. Also: backfill missing SanMar items via poSearch, paginate all Caspio queries, add live ManageOrders API fallback for orders missing from Caspio cache.
**Prevention:** When adding new size suffix patterns to ShopWorks, update the normalization regex in `sanmar-orders.js` (3 instances — search `baseStyle =`).
