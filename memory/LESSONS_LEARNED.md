# Lessons Learned

Active reference of recurring bugs, critical patterns, and gotchas. For historical/resolved entries, see [LESSONS_LEARNED_ARCHIVE.md](./LESSONS_LEARNED_ARCHIVE.md).

**Target: <300 lines. If this file exceeds 300 lines, archive older resolved entries before adding new ones.**

---

## Quote Builder Calculations

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

### Screen Print Quote Reprices at WORST Tier When Qty Crosses 576 (2026-04-23)
**Problem:** Nika's quote at 500 pcs showed PC68H=$22.00 / PC55=$14.50. Added 100 long-sleeve (600 total) — prices jumped to PC68H=$30.50 / PC55=$20.50 / PC55LS=$26.50. More qty → higher price.
**Root Cause:** Caspio `tiersR` for ScreenPrint only caps the top tier at `MaxQuantity=576` (DTG/DTF/EMB use 99999). At 600 pcs, the tier `find()` in `screenprint-quote-builder.js:2858` matched NO tier, then `|| primaryPricing.tiers[0]` fell back to the 13-36 tier (MarginDenom 0.45 — the HIGHEST margin). Same buggy `|| tiers[0]` fallback at line 2874 for additional location.
**Solution:** Added `findPricingTier(tiers, qty)` helper that clamps qty-above-all-maxes to the TOP tier (not tiers[0]). Applied to both primary and additional lookups. Also: update Caspio Tier 16 MaxQuantity=99999 to match other methods.
**Prevention:** Never write `find() || arr[0]` for a tier/range lookup — the failure mode is "use cheapest-for-us / worst-for-customer". Always clamp to the appropriate end of the range. Verify tier data (MinQty/MaxQty) across DTG/DTF/EMB/ScreenPrint is internally consistent — the ScreenPrint 576 cap was an isolated data outlier that silently over-charged every 577+ quote.

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

---

### Caspio v3 Pagination: q.limit + q.pageNumber = Overlapping Pages
**Problem:** `fetchAllCaspioPages` returned only 1000 of 2794 ManageOrders_LineItems. Style index had 634 styles instead of 715.
**Root Cause:** Caspio v3 API: `q.limit` + `q.pageNumber` causes overlapping pages. Pages 2+ return partial duplicates of page 1.
**Solution:** Use `q.pageSize` (not `q.limit`) for pagination. Delete `q.limit` before paginating. Fixed in `caspio.js:fetchAllCaspioPages`.
**Prevention:** Never use `q.limit` with `q.pageNumber` on Caspio v3. Always `q.pageSize`.

---

### Art Hub Email Recipient Priority — Sales_Rep Before User_Email
**Problem:** Steve reported mockups were being sent to him instead of the sales rep. AEs got wrong recipient on revision requests.
**Root Cause:** 7 locations in `art-request-detail.js` and 4 in `art-actions-shared.js` used `User_Email || Sales_Rep` — `User_Email` is often the artist's email, not the rep.
**Solution:** Swapped to `Sales_Rep || User_Email` everywhere. `Sales_Rep` is the correct field for routing emails to reps.
**Prevention:** Always use `Sales_Rep` as primary recipient for rep-facing emails. `User_Email` is a fallback only.

---

### Box Mockup Images Not Loading — Shared/Static URLs Return 404
**Problem:** Mockup images across Art Hub (art request detail, mockup detail, AE/Ruth dashboards, approval modals) showed broken images or "JPG" badge placeholders.
**Root Cause:** Box `download_url` values using `/content/` or shared/static URLs intermittently return 404. The original `onerror` handler only showed a fallback badge, never retried via an alternate path.
**Solution:** Added proxy fallback in `renderFilledThumb()` onerror: when a Box URL fails, retry via backend `/api/box/shared-image` proxy endpoint. Applied across 6 files (art-request-detail.js, mockup-detail.js, art-actions-shared.js, art-ae.js, mockup-ae.js, mockup-ruth.js).
**Prevention:** Box download URLs are unreliable for direct browser loading. Always implement a proxy fallback for Box image URLs. The backend proxy can use authenticated API access which succeeds where public URLs fail.

---

### Box Proxy Thumbnail URLs — getFileExtension Returns Garbage, HTTP Mixed Content
**Problem:** Reference File images showed purple badge "COM/API/BOX/THUMBNAIL/2196733276592" instead of image. Downloads blocked as "can't be downloaded securely."
**Root Cause 1:** `getFileExtension()` returned everything after last `.` in proxy URLs — `com/api/box/thumbnail/...` is not a valid extension but code treated it as non-image.
**Root Cause 2:** Backend stored proxy URLs as HTTP (Heroku `req.protocol` behind LB). HTTPS page blocks HTTP resources.
**Solution:** Guard in `getFileExtension()` (reject ext with `/` or >10 chars). Added `normalizeBoxProxyUrl()` to rebuild with HTTPS API_BASE. Download redirects to `/api/box/download/:id` for full-res.
**Prevention:** Any `getFileExtension()` must guard against API endpoint URLs. Any URL stored by backend must use `config.app.publicUrl` or be normalized client-side.

---

### Rate Limiter Mounted at /api Leaks Counter to Unrelated Routes (2026-04-19)
**Problem:** Pasting a Supacolor screenshot into the new dashboard returned 429 "Too many requests to ManageOrders endpoints" — but the request was to `/api/vision/extract-supacolor-jobs-list`, nowhere near manageorders.
**Root Cause:** `app.use('/api', manageOrdersLimiter, manageOrdersRoutes)` runs the limiter middleware for EVERY `/api/*` request that falls through to that line, regardless of whether `manageOrdersRoutes` ends up handling it. The 30/min counter incremented on Bradley's transfer flow + dashboard polling + everything else, leaving no budget for the actual vision call.
**Solution:** Add `skip: (req) => !req.path.startsWith('/manageorders/')` to the limiter config so only true ManageOrders paths count against the budget. (Inside `app.use('/api', ...)`, `req.path` is the post-mount path, e.g. `/vision/extract-...`.)
**Prevention:** When mounting a rate limiter alongside a router via `app.use(prefix, limiter, router)`, scope the limiter with a `skip` filter that matches only the routes the router actually handles. Otherwise the counter bleeds into every later `/api/*` route. Apply the same pattern to other broad-mount limiters: `pc54InventoryLimiter`, `sanmarLimiter`, etc.

---

### Mockup Approval Email Showed "Not specified" for Design Size (2026-04-20)
**Problem:** Nika's mockup email for Button Veterinary #33672 showed `DESIGN SIZE: Not specified` to the customer. Record had `Design_Size=""`, `Logo_Width=""`, `Logo_Height=""` — all three blank.
**Root Cause:** `mockup-detail.js` sent `design_size: designSize || 'Not specified'` and the modal input only pre-filled from `Design_Size`, ignoring the separately-stored `Logo_Width`/`Logo_Height` on the same record.
**Solution:** Pre-fill chain in the Send-to-Customer modal: `Design_Size` → `Logo_Width × Logo_Height` → blank. Email fallback changed to `'N/A'` (short, fits the 50%-width cell). No validation block — Ruth fills design size during digitizing, not the AE at send-time.
**Prevention:** When a single email field has multiple possible sources on the record, walk the fallback chain in the code that populates it. Friendly fallback strings ("N/A") beat clinical ones ("Not specified") when customers see them.

---

### Box Mockup Files Deleted From Box UI — Defense in Depth (2026-04-20 → 2026-04-22)
**Problem (recurring):** Mockup images break in art request gallery + customer approval view. Box returns 404 for fileIds still referenced by Caspio. Steve previously had to manually re-link 21 designs. Thumbnails show generic IMG badge; download alerts "This mockup file no longer exists in Box". **Secondary issue (same day):** the post-upload HEAD verify rejected legitimate uploads when Box's eventual-consistency window (0.5–3s) exceeded the retry ceiling — staff saw "Uploaded file could not be verified in Box. Please try again." on files that actually uploaded fine.
**Root Cause:** Upload flow is correct (stores proxy URL `/api/box/thumbnail/{fileId}` from Box's authoritative response). Files get deleted **after** upload via Box web UI cleanup — `BOX_ART_FOLDER_ID` ("Steve Art Box 2020") is a shared-access folder. Secondary path: `DELETE /api/box/file/:fileId` had no reference guard. Secondary verify-too-strict: single-attempt (later 3-attempt `[0,500,1500]`) HEAD didn't cover Box's index propagation tail.
**Solution (defense in depth, 2026-04-22):** (1) Frontend 404 detection — `handleImageError()` HEADs proxy URL on image error; flips slot to "File missing — Re-upload" card (customer view → soft "Mockup is being updated — contact your rep"). (2) Backend upload verify — `verifyBoxFileAccessible()` HEADs fileId with retry `[0,1000,3000,5000]` (~9s); **advisory only, returns boolean** — callers log `[BOX_VERIFY_SOFT_FAIL]` and save to Caspio regardless. (3) DELETE endpoint guard — `findBoxFileReferences()` scans ArtRequests (5 fields) + Digitizing_Mockups (7 fields); returns 409 `FILE_IN_USE` unless `?force=true`. (4) `/api/box/download/:fileId` 404 returns `code: 'BOX_FILE_NOT_FOUND'`. (5) Fixed `sharedUrl` → `proxyUrl` at box-upload.js:1383.
**Prevention:** Caspio-referenced Box files CAN still be deleted out-of-band. Defense in depth: detect broken files early (HEAD on img error), surface clearly, make repair one-click. **When adding belt-and-suspenders validation, pick ONE layer to own hard failures — duplicating blocks across upload-time AND display-time just multiplies user-facing false positives.** Display-time won (catches deletes too, not just phantoms). Long-term: Box retention policy on `BOX_ART_FOLDER_ID`.
