# Lessons Learned

Active reference of recurring bugs, critical patterns, and gotchas. For historical/resolved entries, see [LESSONS_LEARNED_ARCHIVE.md](./LESSONS_LEARNED_ARCHIVE.md).

**Target: <300 lines. If this file exceeds 300 lines, archive older resolved entries before adding new ones.**

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

### OnSite Size Translation Table Appends Suffixes — Send BASE PN (CORRECTED 2026-05-01)
**Problem:** Order Form's first real ShopWorks import showed double-suffixed PNs: `PC61Y_XS_XS`, `112_OSFA_OSFA`, `NE1000_S_M_S/M`. This entry previously said "Size Translation Table only assigns columns" — that was wrong.
**Root Cause:** OnSite's Size Translation Table has an "OnSite Part Number Modifier" column that **does append** the configured suffix (`_XS`, `_2X`, `_3XL`, …) to the incoming PN, in addition to mapping the size to Size01-06. Pre-suffixing on the client causes a double-stamp.
**Solution:** Push the BASE PN + plain size string (`PC61Y` + `XS`); OnSite produces `PC61Y_XS`. Fix landed in `server.js` `/api/submit-order-form` line-items builder.
**Prevention:**
  - For **MO push payloads**: send base PN, plain size — never pre-suffix.
  - For **frontend display + SanMar inventory API**: the suffixed PN is still correct (SanMar's catalog lists each extended size as its own SKU). `orderFormSizeSuffix()` is the right helper for those paths.
  - For other integrations using `getPartNumber()`: verify whether your push target's translation table also appends modifiers before pre-suffixing in code.

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

### Screen Print Quote Reprices at WORST Tier When Qty Crosses 576 (2026-04-23)
**Problem:** Nika's quote at 500 pcs showed PC68H=$22.00 / PC55=$14.50. Added 100 long-sleeve (600 total) — prices jumped to PC68H=$30.50 / PC55=$20.50 / PC55LS=$26.50. More qty → higher price.
**Root Cause:** Caspio `tiersR` for ScreenPrint only caps the top tier at `MaxQuantity=576` (DTG/DTF/EMB use 99999). At 600 pcs, the tier `find()` in `screenprint-quote-builder.js:2858` matched NO tier, then `|| primaryPricing.tiers[0]` fell back to the 13-36 tier (MarginDenom 0.45 — the HIGHEST margin). Same buggy `|| tiers[0]` fallback at line 2874 for additional location.
**Solution:** Added `findPricingTier(tiers, qty)` helper that clamps qty-above-all-maxes to the TOP tier (not tiers[0]). Applied to both primary and additional lookups. Also: update Caspio Tier 16 MaxQuantity=99999 to match other methods.
**Prevention:** Never write `find() || arr[0]` for a tier/range lookup — the failure mode is "use cheapest-for-us / worst-for-customer". Always clamp to the appropriate end of the range. Verify tier data (MinQty/MaxQty) across DTG/DTF/EMB/ScreenPrint is internally consistent — the ScreenPrint 576 cap was an isolated data outlier that silently over-charged every 577+ quote.

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

### Box Mockup Files Deleted From Box UI — Defense in Depth (2026-04-20 → 2026-04-22)
**Problem (recurring):** Mockup images break in art request gallery + customer approval view. Box returns 404 for fileIds still referenced by Caspio. Steve previously had to manually re-link 21 designs. Thumbnails show generic IMG badge; download alerts "This mockup file no longer exists in Box". **Secondary issue (same day):** the post-upload HEAD verify rejected legitimate uploads when Box's eventual-consistency window (0.5–3s) exceeded the retry ceiling — staff saw "Uploaded file could not be verified in Box. Please try again." on files that actually uploaded fine.
**Root Cause:** Upload flow is correct (stores proxy URL `/api/box/thumbnail/{fileId}` from Box's authoritative response). Files get deleted **after** upload via Box web UI cleanup — `BOX_ART_FOLDER_ID` ("Steve Art Box 2020") is a shared-access folder. Secondary path: `DELETE /api/box/file/:fileId` had no reference guard. Secondary verify-too-strict: single-attempt (later 3-attempt `[0,500,1500]`) HEAD didn't cover Box's index propagation tail.
**Solution (defense in depth, 2026-04-22):** (1) Frontend 404 detection — `handleImageError()` HEADs proxy URL on image error; flips slot to "File missing — Re-upload" card (customer view → soft "Mockup is being updated — contact your rep"). (2) Backend upload verify — `verifyBoxFileAccessible()` HEADs fileId with retry `[0,1000,3000,5000]` (~9s); **advisory only, returns boolean** — callers log `[BOX_VERIFY_SOFT_FAIL]` and save to Caspio regardless. (3) DELETE endpoint guard — `findBoxFileReferences()` scans ArtRequests (5 fields) + Digitizing_Mockups (7 fields); returns 409 `FILE_IN_USE` unless `?force=true`. (4) `/api/box/download/:fileId` 404 returns `code: 'BOX_FILE_NOT_FOUND'`. (5) Fixed `sharedUrl` → `proxyUrl` at box-upload.js:1383.
**Prevention:** Caspio-referenced Box files CAN still be deleted out-of-band. Defense in depth: detect broken files early (HEAD on img error), surface clearly, make repair one-click. **When adding belt-and-suspenders validation, pick ONE layer to own hard failures — duplicating blocks across upload-time AND display-time just multiplies user-facing false positives.** Display-time won (catches deletes too, not just phantoms). Long-term: Box retention policy on `BOX_ART_FOLDER_ID`.

---

### Art Request Download "Failed to fetch" — CDN URLs Can't Be Fetched Cross-Origin (2026-04-23)
**Problem:** Steve reported lightbox Download button on art-request-detail "Artwork 2" tile alerted `Download failed: Failed to fetch`. Recurring across multiple requests.
**Root Cause:** `downloadLightboxImage()` in `pages/js/art-request-detail.js` only routed Box URLs through the proxy (`/api/box/thumbnail/NNN` → `/api/box/download/NNN`, or `.box.com/shared/static/` → `/api/box/shared-image`). The "Artwork 1–4" tiles come from `READ_ONLY_FIELDS` (`CDN_Link`, `CDN_Link_Two/Three/Four`, `File_Upload`) which store **Cloudinary/Caspio CDN URLs**, not Box URLs. Those fell through to raw `fetch(url)` which hit cross-origin CORS → `TypeError: Failed to fetch`. Image `<img src>` rendered fine (CORS doesn't apply to image tags), so the lightbox image looked normal — only Download broke.
**Solution:** Added a third branch that detects non-Box URLs and uses an anchor-tag open (`<a href download target=_blank>`) instead of `fetch()`. Browsers bypass CORS for plain navigations, so the image opens in a new tab and the user saves it natively.
**Prevention:** When proxying downloads, enumerate ALL URL shapes a field can hold — not just the current-generation one. Legacy fields (`CDN_Link_*`, `File_Upload`) predate the Box-proxy era. For cross-origin resources you can't `fetch()`, fall back to anchor-tag navigation rather than swallowing the error.

---

### "Defensive" Cleanup Selector Nuked Static Overlays — Mark Complete Silently Broke (2026-04-23)
**Problem:** Steve reported "Mark Complete does nothing" on art-request-detail. After an initial fix-deploy, testing live found it *still* broken — page showed "Error Loading" banner and the whole render chain was crashing silently. Two other features (Find Order, Send for Approval, Share with Customer) were also dead.
**Root Cause:** To mitigate a theorized orphan-overlay scenario I added `document.querySelectorAll('.art-modal-overlay, #quick-action-overlay').forEach(el => el.remove())` on page boot. The selector matched FOUR legitimate static HTML overlays that share class `art-modal-overlay`: `#find-order-overlay`, `#approval-overlay` (×2), `#share-customer-overlay`. Cleanup wiped them. Then `initShareWithCustomer()` at art-request-detail.js:2794 called `overlay.addEventListener('click', ...)` on the now-null share overlay → TypeError → outer `.catch` in render() painted the "Error Loading" banner, and `renderSteveActions()` (which wires up Mark Complete) never got to run.
**Solution:** Narrow the selector to ONLY the dynamically-created overlay: `var el = document.getElementById('quick-action-overlay'); if (el) el.remove();`. That's the single overlay created by `art-actions-shared.js createOverlay()` that can be orphaned. Static HTML overlays MUST be left alone.
**Prevention:** **Never use a shared CSS class as a DOM-cleanup selector when static HTML elements also carry that class.** Use specific IDs for dynamic cleanup. Before adding any `querySelectorAll('.shared-class').forEach(remove)`, run `grep -rn 'class="[^"]*shared-class' --include='*.html'` to see every pre-declared element that selector will delete. Bonus lesson: a "defensive" fix that hasn't been ruled out with data can make things worse — prefer a try/catch around the suspect caller over reaching into the DOM.

---

### Garment Tracker Cron Silently Dropped Every Record for Weeks (2026-04-27)
**Problem:** Q2 2026 dashboard showed "0 of 0 orders processed" at day 27 of the quarter. Manual sync also produced nothing. Daily Heroku Scheduler `sync-garment-tracker` had been firing at 1 PM UTC the whole time — logs said `Status: SUCCESS` every run.
**Root Cause:** Three failures stacked. (1) Sync script POSTed `Quarter` and `Year` fields to `/api/garment-tracker`; the live `GarmentTracker` Caspio table only had those columns on the **archive** table — Caspio rejected with 500 `ColumnNotFound`. (2) The proxy POST handler ate the error as a generic "Failed to create/update record" so logs showed no detail. (3) The script's bottom line was a hard-coded `console.log('Status: SUCCESS')` — it never inspected `liveErrors`, so red was indistinguishable from green in scheduler logs. The dashboard's Sync button had a separate-but-related TypeError bug (referenced `GARMENT_TRACKER_CONFIG.orderTypeIds` which doesn't exist) so the operator escape hatch was also broken. Result: cron writes 100% failed, no observable signal, no user-fixable path.
**Solution:** (a) Added `Quarter` Text(255) + `Year` Number columns to the live `GarmentTracker` table. (b) Whitelisted POST body fields at the route layer (`ALLOWED_LIVE_FIELDS` in `garment-tracker.js`) so unknown fields drop silently and known-bad ones can't repeat the schema mismatch. (c) Forwarded Caspio's `Code`/`Message`/`RequestId` in 500 responses for diagnosability. (d) Made the script's Status reflect actual error counts (`PARTIAL` if any `liveErrors` or failed orders) and `process.exit(2)` on `liveErrors > 0` so Heroku Scheduler shows red. (e) Bumped retry cap 3→5 and max backoff 8s→32s for ManageOrders 429 clusters. (f) Fixed the frontend Sync button filter to use `excludedOrderTypeIds` + `excludedCustomerIds` (the legacy load and backend script were already correct).
**Prevention:** Never write a cron summary line that reports SUCCESS unconditionally — the SUCCESS line is the **only signal** the scheduler reads, so it must be tied to actual error counters and `process.exit` non-zero on real failures. When a backend route is a thin Caspio passthrough, **whitelist body fields and propagate Caspio's structured error in the response** so a future schema drift surfaces in one log line, not three layers of "Failed to create/update record". Watch for the pattern where a daily-sync architecture means *no individual user* sees the breakage — silent failures live longer there than anywhere else.

---

### Two Caspio Tables for the Same YTD Metric → Two Different Totals on the Dashboard (2026-04-27)
**Problem:** Staff dashboard's sales-goal banner read $872,889 (29.1% of goal) while Team Performance widget directly below it read $855,368. Same year, same metric, $17,521 apart. Confusing and undermined trust in both numbers. Also, both numbers were over the ShopWorks ground truth ($855,368.20 from a fresh "Sales by Sales Rep" CSV) — so the dashboard was over-reporting in two different ways at once.
**Root Cause:** Two independent Caspio archive tables backed the same metric with no enforced reconciliation. **`DailySalesArchive`** (company-wide daily totals, fed by `archiveSoonToExpireDaysAll` background sync) was queried by `loadYTDForSalesGoal` for the banner. **`NW_Daily_Sales_By_Rep`** (per-rep daily totals, fed by the daily `archive-daily-sales` cron) was queried by `loadTeamPerformanceYTDHybrid` for the widget. Both had silent drift (voided/edited orders within 60 days were never refreshed) and the per-rep table additionally had pre-60-day-window phantom rows from voids that occurred after the original archive ran. Critically: these were **two separate drift accumulators, drifting in different directions**, with no cross-check between them.
**Solution:** (1) Hardened the per-rep table's daily cron to do **rolling 60-day re-archive + phantom-delete** so within-window drift self-heals nightly. (2) Built `scripts/reconcile-rep-baseline-from-csv.js` to one-shot fix the locked pre-window using a ShopWorks CSV (parses with latin-1 to handle 0xFF bytes, trims rep names so `House` and `House ` collapse, dry-run by default, deletes Jan 1 → Feb 25 rows then upserts one CSV-derived baseline per rep dated Feb 25). After this NW_Daily_Sales_By_Rep matched CSV exactly to the dollar. (3) **Re-pointed the sales-goal banner to read from the per-rep YTD endpoint plus a thin live ManageOrders top-up for unarchived days** — single source of truth for both widgets. The legacy `DailySalesArchive` is no longer read by the staff dashboard (background writes still run as a safety net but nothing consumes them).
**Prevention:** When a metric appears in more than one place on the same screen, **all consumers must read from the same source — period**. Two tables holding "the same" data is a guarantee they'll drift; pick one canonical store. Quarterly truth-up against an external authoritative source (in our case, the ShopWorks CSV via `npm run reconcile-rep-baseline -- --csv "<path>" --apply`) catches everything that aged past the auto-sync window. When a metric is "by definition correct" but obviously wrong, look for a parallel data path you forgot existed.
**Follow-up (2026-04-27, commit `e35eba65`):** Same divergence existed off-dashboard too — Taneisha/Nika CRM headlines summed `Accounts.YTD_Sales_2026` (refreshed by `sync_sales`) while the staff dashboard widget read `NW_Daily_Sales_By_Rep`, leaving Erik with two reconciled-but-different totals per rep. `dashboards/js/rep-crm.js` now reads the per-rep archive for the headline (background fetch on init), shows the archive-through date, and prints a reconciliation line when the tier sum diverges in either direction. House Accounts page had the analogous "stat cards don't sum to headline" bug — the API returned an "Other" assignee bucket the UI silently dropped (~$5K hidden); added the 6th card. Same lesson, three more surfaces: pick one source per metric, surface the gap when the breakdown can't fully reconcile.

---

### Order Form ShopWorks Push: Invented Note Type "Notes On Packing List" (2026-05-01)
**Problem:** Every Order Form push to ShopWorks failed with `Invalid note type: "Notes On Packing List". Valid types: Notes On Order, Notes To Art, Notes To Purchasing, Notes To Subcontract, Notes To Production, Notes To Receiving, Notes To Shipping, Notes To Accounting, Notes On Customer`. Banner showed at the bottom of the form, no order landed.
**Root Cause:** [server.js:2164](server.js:2164) constructed a fifth notes block tagged `type: 'Notes On Packing List'` for a customer-visible thank-you string built by `buildPackingListNote()` ([server.js:1807](server.js:1807)). That string is **not** in ShopWorks's official 9-type taxonomy ([memory/MANAGEORDERS_API_GUIDE_OFFICIAL.md:153](memory/MANAGEORDERS_API_GUIDE_OFFICIAL.md:153)) — the developer treated it as a note type when it's actually a ShopWorks template-output concern. The proxy validates the WHOLE notes array; one invalid type aborts the entire push.
**Solution:** Deleted `buildPackingListNote()` and the corresponding `notesBlocks.push({ type: 'Notes On Packing List', ... })` entry. Updated the routing-comment block from "5-way split" to "4-way split" with explicit warning about the 9 valid types. Order Form now pushes Order / Production / Purchasing / Art notes only — same pattern 3-Day Tees uses successfully ([server.js:1580](server.js:1580)).
**Prevention:** When constructing a ManageOrders notes array, **the `type` value must be one of the 9 from `MANAGEORDERS_API_GUIDE_OFFICIAL.md` — verbatim**. There is no "Packing List", "Customer Receipt", "Hold Note", etc. type — those are ShopWorks UI/print-template concerns, not API note types. The proxy rejects unknown types with a banner that lists the valid set; treat that as the canonical source. Print-slip messages should be configured in ShopWorks's packing-slip template (or omitted), not pushed via the notes array.

---

### ShopWorks PO `Color` Field Must Be CATALOG_COLOR, Not COLOR_NAME (2026-05-02)
**Problem:** SanMar rejected lines on POs that ShopWorks pushed for Richardson 112 caps. The hypothesis was that Caspio's `CATALOG_COLOR` codes had drifted from SanMar's current mainframe codes. Audit disproved that — all 112 Caspio CATALOG_COLOR values match SanMar's PromoStandards `colorName` 1:1 (verified live via `/api/sanmar/product-colors/112`: `Bk/Bk/LtGy`, `HotPink/Wh`, `Biscuit/TB`, etc.). So the data was correct; the **wrong field was being sent**.
**Root Cause:** Order form posts both `color` (display name like "Black/ Black/ Light Grey") and `catalogColor` (mainframe code like "Bk/Bk/LtGy") to the proxy ([server.js:2053-2061](server.js:2053)). The proxy's `transformLineItems()` ([caspio-pricing-proxy/lib/manageorders-push-client.js:279](../caspio-pricing-proxy/lib/manageorders-push-client.js:279)) forwarded **only `item.color`** as the ShopWorks `Color` field, dropping `item.catalogColor`. ShopWorks then had to translate display name → catalog code via its own internal product table — and any miss in that translation produced a bad SanMar PO that SanMar refused.
**Solution:** Changed `Color: item.color || ''` → `Color: item.catalogColor || item.color || ''`. ShopWorks now receives the abbreviated mainframe code directly, no translation step required. Backward compatible: clients that don't send catalogColor (3-Day Tees, embroidery push) keep working via the fallback. Deployed in proxy v606 on 2026-05-02.
**Prevention:** **SanMar PromoStandards `colorName` IS the catalog/mainframe code, not a friendly name** — same value as Caspio's `CATALOG_COLOR`. Anywhere we generate a SanMar-bound payload (PO push, inventory query, sellable check), use `CATALOG_COLOR` / `catalogColor`. Reserve `COLOR_NAME` strictly for UI display. The proxy's `transformLineItems()` is the single chokepoint for outbound ShopWorks color values — any future field-mapping change goes there. Audit a style with `curl /api/sanmar/product-colors/:style` and diff against the Caspio rows whenever a SanMar rejection mentions color.
**Follow-up (2026-05-02, proxy v607 + Pricing Index frontend):** Reading order **OF-0025**'s ShopWorks payload after v606 surfaced three more bugs in the same push path, all unrelated to the rejection but fixed in the same session:
1. **Orphan designs** — `transformDesigns()` ([proxy:372](../../caspio-pricing-proxy/lib/manageorders-push-client.js:372)) defaulted `id_Design: 0` when the caller didn't resolve a real ID. ShopWorks then attached lines to a sentinel orphan-design row instead of creating a fresh design from `DesignName + ExtDesignID`. Per [MANAGEORDERS_COMPLETE_REFERENCE.md](MANAGEORDERS_COMPLETE_REFERENCE.md) the field is optional. Fix: conditional spread `...(resolvedDesignId ? { id_Design: resolvedDesignId } : {})`. Also: order form sent `linkedDesigns: [{id_Design: N}]` (array) but proxy only reads `idDesign`/`id_Design` (singular) — added `base.idDesign = linkedIdDesigns[0]` at [server.js:2113](server.js:2113) when one design# resolves so the proxy actually picks it up.
2. **`ForProductColor` truncated + friendly names** — [server.js:2099](server.js:2099) filtered `r.deco === method` (excluding rows whose deco wasn't explicitly set, even though they default to embroidery) and used `r.colorName || r.color`. OF-0025 had 11 unique colors but the Design's ForProductColor listed only 3 friendly names. Fix: `r => !r.deco || r.deco === method` + prefer `r.catalogColor` to match the v606 `Color` field rule.
3. **Stale description on style change** — [paper-form.jsx:365](pages/order-form/components/paper-form.jsx:365) auto-fill effect bailed when `row.desc` was non-empty, so picking 111 then changing to 112FP kept "Richardson Garment Washed Trucker 111" under PartNumber 112FP. Fix: added `descSource: 'auto' | 'manual'` row field. Auto-fill only refreshes when source is `'auto'`; the textarea onChange flips to `'manual'` when rep types and back to `'auto'` when they clear it. Same gate added to ProductCombobox `onPick` in both `paper-form.jsx` and `line-items.jsx`.

**Pattern lesson:** When auditing a payload-shape bug, read the WHOLE payload — adjacent fields built by the same code path often have related bugs. The Color/CATALOG_COLOR fix would have shipped clean if I'd stopped there, but `id_Design`, `ForProductColor`, and `Description` were all silently wrong on the same OF-0025 push.

**Follow-up #2 (2026-05-02 evening, proxy v608 + main v903→v907):** Three more findings while wiring the Order Form's dedicated ShopWorks integration:
1. **OrderType + DesignType IDs were ALL wrong from the source CSV.** OF-0027 displayed "Digital Printing" instead of expected "Custom Embroidery" because Erik's CSV mapped `Embroidery → 5` but in the live ShopWorks Order Types table ID 5 is "Digital Printing". Verified all 7 IDs against a screenshot of ShopWorks's actual Order Types list (correct: emb=21, sp=13, dtg=5, dtf=18, sticker=41, emblem=7, default=6). **Lesson:** when given a "mapping CSV" by the customer, verify against the live system before deploying — column header pairings can be ambiguous and the live system is the source of truth, not the spreadsheet.
2. **Caspio's `Design_Lookup_2026.Design_Number` IS ShopWorks's `id_Design`.** The 155K-row table holds the same integer ShopWorks uses internally, just under a different column name (`ID_Unique` is empty). So when the rep picks design 9449 from the autocomplete, server.js can pass `idDesign: 9449` directly to ManageOrders — no secondary lookup table or ManageOrders historical pull needed. Saved ~half day. **Lesson:** before building a mapping/lookup endpoint, check whether the "external" key is already the same integer as the "internal" one.
3. **`/api/embroidery-designs/lookup` had been silently 404'ing on every order push for months.** server.js was calling that path; the real route is `/api/digitized-designs/lookup`. Phase A's `Designs:[]` orphan-prevention masked the failure. **Lesson:** HTTP failures should not silently fall back to a "default" path — log the 404 OR fail the request. A typo'd URL with a quiet catch hid the bug for the entire form's lifetime.

---

### Cap Embroidery Manual-Cost Override Was Unauthenticated (2026-05-03)
**Problem:** [shared_components/js/cap-embroidery-pricing-service.js:18-34](shared_components/js/cap-embroidery-pricing-service.js:18) read `?manualCost=...` from the URL without checking the host. A customer visiting `https://teamnwca.com/calculators/cap-embroidery-pricing-integrated.html?manualCost=0.01` saw fake $0.01 cap prices on the public calculator. Discovered during the Embroidery Pricing Audit while comparing the cap service to the flat service. The flat embroidery service ([embroidery-pricing-service.js:18-22](shared_components/js/embroidery-pricing-service.js:18)) had had this gate since launch — the cap service was a copy-paste miss.
**Root Cause:** When the cap service was forked from the flat service, the `getManualCostOverride()` method was copied without the `host === 'localhost' || host.endsWith('.herokuapp.com')` internal-only check. Two services with identical-looking signatures had different security postures.
**Solution:** Copied the 3-line host gate verbatim into `cap-embroidery-pricing-service.js`. Verified via local preview: localhost still allows override (staff use); teamnwca.com / nwcustomapparel.com return null. Deployed in main app v908 on 2026-05-03.
**Prevention:** When forking a public-facing pricing service to support a new product type, **diff the security/auth surface** of the source before stamping the copy. Look for: host-gate, sessionStorage validation, URL parameter sanitization. Add a pre-commit grep check or unit test that asserts every pricing service has `getManualCostOverride()` returning null on non-internal hosts. Also: **stitch-surcharge formulas differ by category** (caps use $1.00/1K above 5K base; flats use $1.25/1K above 8K base; the cap bundle's `allEmbroideryCostsR` has NO surcharge brackets while the flat bundle has 'ALL' tier deltas at 10K/15K/25K) — when porting variable-stitch pricing to a new surface, verify against the Quote Builder's `embroidery-quote-pricing.js:2099` formula. Both rates are bigger lessons about copy-paste-with-modification: assume the source has invariants you might not notice.
