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

### Stale Caspio-Compat Shims in Proxy Outlive the Data Fix
**Problem:** After deleting an orphan `1-23` tier from `Pricing_Tiers` (EmbroideryCaps), `/api/pricing-bundle?method=CAP` *still* returned the orphan, and `[CapEmbroideryPricingService] No 8000 stitch cost found for tier 1-23` kept firing on the order form.
**Root Cause:** Sept 2025 commit `c160648` ("fix: add missing 1-23 tier") added a `response.tiersR.unshift({ TierLabel: '1-23', ... })` shim in `caspio-pricing-proxy/src/routes/pricing.js` to paper over a missing Caspio row. The 5-tier migration later split `1-23` into `1-7` + `8-23` and the shim was never removed — so even after the data was correct, the proxy clobbered it with the orphan on every CAP/CAP-AL response. Heroku log confirmed `Total records fetched: 5` from Caspio, but response had 6.
**Solution:** Removed the shim block (proxy v612). Bundle now returns Caspio reality.
**Prevention:** When backfilling missing data via proxy injection, leave a `// REMOVE WHEN <X> IS FIXED IN CASPIO` marker. Audit such shims any time the underlying table changes shape (tier migration, schema rename, etc.). Verify the *response* matches the *table* — not just the table.

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

### Box image-loading legacy fixes (now subsumed by [box-url-rules.md](memory/box-url-rules.md))
Two pre-`resolveToProxyUrl` bugs archived 2026-05-07: (1) Box `download_url` shared/static URLs returned 404 → fixed with `/api/box/shared-image` proxy fallback in `renderFilledThumb()` onerror across 6 files; (2) Reference File images rendered as `COM/API/BOX/THUMBNAIL/...` badge because `getFileExtension()` treated proxy paths as extensions, plus mixed-content blocks because backend stored HTTP URLs → fixed via guard (`/` or len > 10) + `normalizeBoxProxyUrl()`. **Both rules superseded** by the centralized box-url-rules.md discipline (always proxy-form URLs in Caspio, `checkUrlReachable()` over plain HEAD, slot-aware recovery, nightly auto-recover cron). Don't write code that retries Box CDN URLs directly — use the proxy.

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

**Follow-up #3 (2026-05-03 — proxy v609 + main v912, Service Code Sync + Size:"S" fix):** OF-0031 visualization in ShopWorks revealed fee/service lines (DD, GRT-50, 3D-EMB) landing in **column 6 ("Other XXXL")** instead of column 1 ("Adult/S") where the parts are configured to accept qty. The DD part has Size Restriction `S` only, so the qty was visibly off-position on the work order.
- **Root cause:** payload sent fee lines with empty `Size` and qty in `Size01`. ShopWorks's Size Translation Table looks up `Size`, finds nothing for blank, falls through to default (last column / column 6). Garment lines (`Size: "2XL"`) work because they hit a translation rule.
- **Fix:** stamp `Size: "S"` on every fee line in `transformLineItems()` ([proxy:285](../caspio-pricing-proxy/lib/manageorders-push-client.js:285)), gated by `isKnownFeeCode(item.partNumber)`. The existing `S → Adult/column 1` rule in ShopWorks's Size Translation Table now handles all 29 service codes for free — no per-code translation entries needed. New service codes work automatically once added to the whitelist.
- **Companion fix (3-layer service code sync):** discovered the proxy's `KNOWN_FEE_PNS` had 6 dead codes (SAMPLE, CB, CS, DGT-001/2/3) and 2 mis-named ones (`WEIGHT` for HW-SURCHG, `NAME` for Name/Number). Erik's ShopWorks screenshots are the source of truth — 27 confirmed services + 2 (Laser Patch, SECC). HW-SURCHG and Name/Number didn't exist in ShopWorks at all → hard-deleted from Caspio Service_Codes (PK 222 + 142). Picker, proxy whitelist, Caspio table now all carry the **same canonical 29 mixed-case codes**. Proxy comparison normalized via `isKnownFeeCode()` (case-insensitive helper exported from `manageorders-emb-config.js`) so pickers can send any case.
- **Prevention:** when ShopWorks's part configs constrain Size Restrictions, the payload's `Size` field is load-bearing — blank ≠ "ignore translation" but rather "fall through to last column", which then mismatches the part's allowed columns. Whenever you add a new fee/service code: (1) confirm the SW part exists with the canonical mixed-case spelling, (2) add to `KNOWN_FEE_PNS` in `manageorders-emb-config.js`, (3) ensure the Caspio `Service_Codes` row exists. The Size:"S" stamp is automatic via `isKnownFeeCode()`. **Single source of truth audit before any service-code change**: compare picker's `add-on-picker.jsx` constants → `service-codes.js` `capOnly`/`flatOnly` arrays → `KNOWN_FEE_PNS` proxy set → live Caspio rows → ShopWorks part list. All four must agree.

**Follow-up #2 (2026-05-02 evening, proxy v608 + main v903→v907):** Three more findings while wiring the Order Form's dedicated ShopWorks integration:
1. **OrderType + DesignType IDs were ALL wrong from the source CSV.** OF-0027 displayed "Digital Printing" instead of expected "Custom Embroidery" because Erik's CSV mapped `Embroidery → 5` but in the live ShopWorks Order Types table ID 5 is "Digital Printing". Verified all 7 IDs against a screenshot of ShopWorks's actual Order Types list (correct: emb=21, sp=13, dtg=5, dtf=18, sticker=41, emblem=7, default=6). **Lesson:** when given a "mapping CSV" by the customer, verify against the live system before deploying — column header pairings can be ambiguous and the live system is the source of truth, not the spreadsheet.
2. **Caspio's `Design_Lookup_2026.Design_Number` IS ShopWorks's `id_Design`.** The 155K-row table holds the same integer ShopWorks uses internally, just under a different column name (`ID_Unique` is empty). So when the rep picks design 9449 from the autocomplete, server.js can pass `idDesign: 9449` directly to ManageOrders — no secondary lookup table or ManageOrders historical pull needed. Saved ~half day. **Lesson:** before building a mapping/lookup endpoint, check whether the "external" key is already the same integer as the "internal" one.
3. **`/api/embroidery-designs/lookup` had been silently 404'ing on every order push for months.** server.js was calling that path; the real route is `/api/digitized-designs/lookup`. Phase A's `Designs:[]` orphan-prevention masked the failure. **Lesson:** HTTP failures should not silently fall back to a "default" path — log the 404 OR fail the request. A typo'd URL with a quiet catch hid the bug for the entire form's lifetime.

**Follow-up #4 (2026-05-03 afternoon, main v913 — AS vs AL conflation):** Auditing OF-0032 revealed [tiered-pricing.js:107](pages/order-form/components/tiered-pricing.js:107) was applying the **AL family per-1K formula** (Additional Logo: $1.00/1K above 5K cap, $1.25/1K above 8K garm) to **AS-Garm and AS-CAP** services, which are actually **flat-tier surcharges** ($0 ≤10K, $4 ≤15K, $10 ≤25K, then DECG-FB above 25K). Two distinct services in Caspio `Embroidery_Costs` with completely different rows (`ItemType='AL'/'AL-CAP'` vs `'AS-Garm'/'AS-Cap'` with `TierLabel='ALL'`) — the Order Form was reading the wrong rows from the wrong endpoint (`/api/al-pricing` instead of `/api/pricing-bundle?method=EMB`). OF-0032 was overcharged $60 (12 caps × $5 buggy vs $0 correct at 10K stitches = Standard). **Fix:** split AS-Garm/AS-CAP off from AL family in `resolveSync()`; new `asStitchSurcharge()` reads `Embroidery_Costs` rows where `ItemType='AS-Cap'`/`'AS-Garm'`+`TierLabel='ALL'` and applies the same flat-tier lookup as Quote Builder's `getStitchSurcharge()` ([embroidery-quote-pricing.js:814](shared_components/js/embroidery-quote-pricing.js:814)). **Retracts** the earlier "13/13 parity" claim — that audit compared OF resolveSync against the Quote Builder's *primary-logo per-1K* path (line 1601, which is AL formula, not AS), not the AS-specific *flat-tier* path. **Canonical NWCA AS policy (Erik confirmed):** $0 ≤10K → $4 ≤15K → $10 ≤25K → DECG-FB above 25K. Same scale for caps and garments. **Lesson:** "stitch surcharge" looks like one concept but is TWO distinct Caspio services. When auditing a pricing parity claim, the audit must compare against the EXACT formula the target surface would invoke for that service code — pulling the Quote Builder's primary-logo formula and calling it "the truth" misses that AS-Garm/AS-CAP route through a different method (`getStitchSurcharge` flat-tier vs `(extra/1000)*rate` per-1K). Always verify the call site, not just the file.

---

### Supacolor sync silently lost every closure for 2+ weeks (2026-05-07)
**Problem:** Dashboard at [/dashboards/supacolor-orders.html](dashboards/supacolor-orders.html) showed 14 jobs stuck "Open" — including #640003/#640214 that Mikalah received Apr 29 (8+ days stale). No FedEx tracking, no `Date_Shipped`. Cron logs said `errored=0` every run. Looked totally fine.
**Root Cause:** [scripts/sync-supacolor.js](../caspio-pricing-proxy/scripts/sync-supacolor.js) POSTed `/api/supacolor-jobs/sync/all` with no query params, defaulting to `includeClosed=false`. The route then asked Supacolor for `/Jobs/active?includeClosedJobs=false`. **The moment Supacolor flips a job to Closed/Dispatched on their side, it vanishes from that endpoint and our cron never sees it again** — local mirror keeps it stuck on Open forever, the per-job tracking enrichment loop ([supacolor-jobs.js:1410](../caspio-pricing-proxy/src/routes/supacolor-jobs.js:1410)) is gated on shipped-signal in the stub, so no detail-fetch ever fires.
**Solution:** Cron now passes `?includeClosed=true` ([scripts/sync-supacolor.js](../caspio-pricing-proxy/scripts/sync-supacolor.js)). Walking 959 stubs noops fast on the ~945 unchanged closed rows (existing diff logic at supacolor-jobs.js:1356-1373), so the extra fetch costs ~3s. Bumped `MAX_ENRICHMENTS_PER_RUN` 20→50 so a weekend backlog catches up in one tick. Added `GET /api/supacolor-jobs/health` + `POST /health/alert` watchdog endpoints + new `scripts/check-supacolor-health.js` Heroku Scheduler task that DMs Erik via Zapier when `lastSyncAgo > 25 min` OR `stuckOpenCount ≥ 5` (4-hour dedup TTL).
**Prevention:** **A polling cron that filters by status leaks state when the upstream changes status independently.** Either include all states and rely on diff logic to noop, or pair it with a watchdog that detects "things we expected to update aren't updating." `errored=0` tells you nothing about whether the cron is doing the right thing — only "what we asked for didn't break." Always pair an external-data cron with a freshness watchdog: max(LastUpdatedAt) + a stuck-state count, alerting when either drifts.

---

### `/api/company-contacts/*` 3-bug cascade — autocomplete + nightly sync silently broken (2026-05-07, proxy v623→v626)
**Problem:** Customer autocomplete in 4 quote builders + Sticker/Banner intake + JDS intake silently returned "No customers found" for every query. Nightly contacts sync (Heroku Scheduler) errored on every contact upsert. Affected `/search`, `/by-company`, `/by-customer/:id`, `/by-email/:email`, `POST/PUT`, and `POST /sync`.
**Root Cause (3 stacked bugs, found in deploy order):**
1. **`q.sort` is invalid in Caspio v3** — should be `q.orderBy`. 29 routes used the correct param; 3 (`company-contacts.js`, `company-contacts-2026.js`, `art.js`) had stray `q.sort`. Caspio responded 400 IncorrectQueryParameter.
2. **Caspio v3 rejects `q.limit < 5`** — same constraint that's documented for `q.pageSize`. Frontend autocomplete asked for `limit=3-10`; values 1-4 hit the floor and returned 400.
3. **Legacy `Company_Contacts_Merge_ODBC` columns dropped from the schema** — `Customersts_Active`, `Customerdate_LastOrdered`, `CustomerCompanyName`, `ContactNumbersEmail`, `CustomerCustomerServiceRep` no longer exist on that table. Caspio returned `SqlServerError: "Invalid column name 'Customersts_Active'"`. The newer `CompanyContactsMerge2026` table has equivalents under `Is_Active`, `Last_Order_Date`, `Company_Name`, `Email`, `Sales_Rep`.
**Solution:** Fixed in 4 progressive deploys (proxy v623, v624, v625, v626). Final shape: every endpoint in `company-contacts.js` now queries `CompanyContactsMerge2026`. Two helpers preserve back-compat — `mapRecordToLegacyShape()` adds legacy field-name aliases on every read response, `translateBodyToNewSchema()` converts incoming POST/PUT keys to new schema. **Frontend untouched.** Verified live: `?q=wesley` returns Wesley Cobb / Wesley Homes; `POST /sync?hours=24` upserted 2 contacts with 0 errors.
**Prevention:** Three patterns to avoid:
1. **Don't trust route-test status codes for cron-triggered jobs.** The sync's `try/catch` wrapped each contact and aggregated errors into `stats.errors` — when every contact failed the same way, the wrapper returned 200 with `errored=0` because the outer catch never fired. Sync logs need **content-level** asserts (e.g., "expected at least 1 update if there were N orders"), not just "didn't crash."
2. **`q.sort` in Caspio is silently invalid.** Standardize on `q.orderBy` and grep for `q.sort` in CI. Same goes for `q.limit < 5`.
3. **When a Caspio table is migrated/renamed/columns dropped, search for references across all routes** — the proxy had 6 endpoints still pointing at the old table for months. A periodic `grep -rn "Company_Contacts_Merge_ODBC"` audit would have caught it earlier.

---

### JDS + Sticker/Banner intake 500: payload sent `Design_Name` to a column that doesn't exist on ArtRequests (2026-05-08)
**Problem:** Every AE submission via the JDS intake form on the AE dashboard returned `Submission failed: Failed to create art request (500)`. Sticker/Banner intake (same 2026-05-06 deploy) had the same latent bug; just hadn't been exercised.
**Root Cause:** Both [jds-submit-form.js](shared_components/js/jds-submit-form.js) and [sticker-banner-submit-form.js](shared_components/js/sticker-banner-submit-form.js) POSTed `Design_Name: designName` to `/api/artrequests`. `Design_Name` exists on `Design_Lookup_2026` and `Digitizing_Mockups` — but **not on `ArtRequests`**. Caspio returned `404 FieldNotFound — Cannot perform operation because the following field(s) do not exist: 'Design_Name'`. The proxy's POST handler ([art.js:251-254](../caspio-pricing-proxy/src/routes/art.js#L251)) catches and re-emits as a generic 500, hiding Caspio's actual error from the browser. False lead burned an hour: a hypothesis based on missing-`JDS_SKU` was wrong; that column is present.
**Solution:** Frontend-only fix — dropped `Design_Name` from both payloads and folded the design-name string into `Item_Specs_Notes` (prefixed `Design Name: …`) so Steve still sees it. Cache-bust bumped `?v=4→5` (JDS) and `?v=2→3` (sticker/banner) in [ae-dashboard.html:604,607](dashboards/ae-dashboard.html#L604).
**Prevention:** (1) **The proxy's `POST /artrequests` handler MUST forward Caspio's `Code`/`Message`/`RequestId` in the 500 response body** (same pattern as `garment-tracker.js` adopted 2026-04-27) — generic "Failed to create art request" gave the frontend nothing actionable and disguised this as an unrelated config issue for over a day. (2) When adding a new intake form that writes to an existing Caspio table, **introspect the live table schema** (`GET /tables/X/fields`) and diff against the payload before the first deploy — Caspio's 95-column tables have plenty of similarly-named fields on neighboring tables that look like they should exist but don't.
