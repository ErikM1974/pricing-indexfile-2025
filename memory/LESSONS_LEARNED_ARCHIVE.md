# Lessons Learned — Archive
> Historical entries moved from LESSONS_LEARNED.md on 2026-03-24.
> These are resolved issues unlikely to recur. Kept for reference.

---

## Bug: `sed` Line Deletion Breaks Multi-Line Statements — Orphaned Object Properties (2026-03-22)

**Problem:** [Pricing Index] Using `sed -i '/console\.log/d'` to bulk-remove debug logs broke DTG and Screenprint builders with `SyntaxError: Unexpected token ':'`. Product search completely stopped working.

**Root Cause:** A multi-line `console.log('[SKU Validation]...', {` call spanned 4 lines. `sed` only deleted the first line (containing `console.log`), leaving the object properties (`availableSizes,`, `catalogColor,`, `validatedAt: new Date()`) and closing `});` as orphaned JavaScript — invalid syntax outside any function call.

**Solution:** Manually found and removed the orphaned property lines from DTG (line ~2424) and Screenprint (line ~2545). Verified DTF and Embroidery were unaffected.

**Prevention:** Never use `sed -i '/pattern/d'` on JavaScript files — multi-line statements will break. Use targeted Edit tool replacements that read the full block first, or grep for lines ending with `{` or `,` to identify multi-line calls before deletion.

---

## Bug: Shared JS Module Causes SyntaxError — Duplicate `const` Declarations (2026-03-22)

**Problem:** [Pricing Index] Adding `extended-sizes-config.js` as a shared `<script>` tag to embroidery/DTG/screenprint builders caused `SyntaxError: Identifier 'STANDARD_SIZES' has already been declared`, completely breaking all 3 builders (couldn't type in search or do anything).

**Root Cause:** `extended-sizes-config.js` declares top-level `const` variables (`STANDARD_SIZES`, `SIZE_TO_SUFFIX`, `EXTENDED_SIZE_ORDER`). Each builder's inline `<script>` also declared identical `const` variables. JavaScript prohibits redeclaring `const` at the same scope level — the second declaration throws a `SyntaxError` that halts all script execution.

**Solution:** Removed the duplicate `const` declarations from all 3 builders' inline scripts (3 separate commits as issues were discovered one at a time). The shared module's versions are identical or superset — safe to use.

**Prevention:** Before adding a shared JS module via `<script>` tag, grep for ALL its top-level `const`/`let`/`class` declarations and verify none conflict with the target page's inline scripts. Use `grep -n "^const \|^let \|^class " shared-module.js` then check each name against the target HTML. Unlike `var` and `function`, `const`/`let` throw fatal errors on redeclaration.

---

## Bug: Find Order Modal — Clicks Intercepted by Overlay z-index (2026-03-21)

**Problem:** [Pricing Index] "Link This Order" button in the Find ShopWorks Order modal on mockup detail page did nothing — modal just closed instead of saving the order link.

**Root Cause:** The modal overlay (`.pmd-modal-overlay`) had `z-index: 9000` while the modal itself (`.pmd-fo-modal`) had `z-index: 1001`. The overlay sat on top of the modal, intercepting all click events. Since the overlay had `onclick = closeModal`, clicking any button inside the modal actually triggered the overlay's close handler.

**Solution:** Changed `.pmd-fo-modal` z-index from `1001` to `9001` (one above the overlay's 9000). Also added ±30 day date-window filtering to show only orders near the mockup's submission date, with a "Show all" toggle.

**Prevention:** When creating modal overlays, always ensure the modal container has a higher z-index than the overlay. Pattern: overlay = N, modal = N+1. Check with DevTools by clicking — if the wrong element receives focus, inspect z-index stacking.

---

## Bug: Claude API Multi-Image Request — 2000px Dimension Limit (2026-03-20)

**Problem:** Element identification (35 images: 1 mockup + 34 per-run thumbnails) failed with `image dimensions exceed max allowed size for many-image requests: 2000 pixels`.
**Root Cause:** `pyembroidery.write_png()` renders at native stitch resolution (can exceed 2000px). Claude API enforces stricter dimension limits when many images are sent in one request.
**Solution:** Added `_resize_image_b64()` helper using Pillow — shrinks mockup to max 1000px, thumbnails to max 500px before sending to vision API.
**Also discovered:** `pyembroidery.MOVE` doesn't exist (use `JUMP`). Claude model ID `claude-sonnet-4-5-20241022` doesn't exist — correct is `claude-sonnet-4-5-20250929`. Always verify model IDs via `GET /v1/models`.
**Prevention:** [Python Inksoft] When sending multiple images to Claude vision, always resize to well under 2000px. Use Anthropic `/v1/models` endpoint to verify model IDs exist before hardcoding.

---

## Bug: CSS `display: none` in Stylesheet Overrides JS `display = ''` — Popover Never Shows (2026-03-16)

**Problem:** Ruth's mockup upload popover (Upload File / Browse Box) never appeared when clicking empty mockup slots.
**Root Cause:** CSS rule `.pmd-slot-popover { display: none; }` in stylesheet. JS used `popover.style.display = ''` to show it, which only clears the inline style — falling back to the CSS rule which keeps it hidden. Steve's page didn't have this bug because his `.ard-slot-popover` CSS didn't include `display: none`.
**Solution:** Changed `popover.style.display = ''` to `popover.style.display = 'block'` in `showSlotPopover()`.
**Prevention:** When toggling visibility via JS, always use explicit values (`'block'`/`'none'`), never rely on clearing inline styles to reveal elements. The CSS may have its own `display: none` rule.
**Tags:** `[Pricing Index]` `[Art Hub]` `[CSS Gotcha]`

---

## Bug: MutationObserver Fires Multiple Times — Duplicate EmailJS Sends (2026-03-16)

**Problem:** Art Hub new submissions sent 2-4 duplicate "New Submission" emails to Steve. EmailJS flagged service as unstable due to rapid-fire sends.
**Root Cause:** `ae-submit-form.js` used a MutationObserver with `subtree: true` to detect Caspio form success. Caspio's DOM rebuild fires multiple mutations, each finding the same `.id-number` element and calling `notifyNewSubmission()` repeatedly.
**Solution:** Added `notifiedDesignIds = {}` guard — first call for each design ID sets the flag, subsequent calls return early.
**Prevention:** [Pricing Index] Any MutationObserver-based detection of Caspio form events needs a dedup guard. Caspio DOM updates are non-atomic and fire multiple mutation events.

---

## Fix: `<input type="submit">` Cannot Contain Child Elements (SVG Icons) (2026-03-11)

**Problem**: `enhanceSubmitButton()` tried to insert an SVG icon into an `<input type="submit">` element. The icon never rendered.
**Root Cause**: `<input>` is a void element in HTML — it cannot have child nodes. `innerHTML` on an `<input>` silently does nothing.
**Solution**: Replace the `<input type="submit">` with a `<button type="submit">` element. Copy over `className` and `name` attributes. Use `parentNode.replaceChild(button, input)`. The `<button>` can then contain the SVG + text via `innerHTML`.
**Prevention**: When adding icons/content inside form controls, check if the element is a void element (`<input>`, `<img>`, `<br>`, `<hr>`). Use `<button>` instead of `<input>` when the control needs to contain markup.

## Fix: `box-sizing: content-box` Causes Horizontal Overflow with Padding (2026-03-11)

**Problem**: Form labels were clipped on the left side — "Company" showed as "mpany". The entire form overflowed horizontally.
**Root Cause**: `.ae-form-section` had `width: 100%` + `padding: 28px` but default `box-sizing: content-box`. Total rendered width = container + 56px padding, overflowing the viewport.
**Solution**: Add `box-sizing: border-box !important` to the section. Also add a wildcard `*` rule for all children inside the Caspio form to prevent any child elements from having the same issue.
**Prevention**: Always set `box-sizing: border-box` on any element that has both `width: 100%` and `padding`. Consider adding it as a global reset for Caspio form containers.

## Pattern: Caspio Cascade Empty Detection — Custom Product Fallback (2026-03-11)

**Problem**: AE Submit Art form uses Caspio cascading lookups tied to `Sanmar_Bulk_251816_Feb2024`. Non-SanMar styles (stickers, mugs, promo items) return empty color `<select>` — AE is stuck with no way to enter a color.
**Solution**: `monitorGarmentCascade()` watches each garment row's style input. On blur, waits 1.5s for Caspio cascade, then checks if color `<select>` has real options. If empty: adds amber "Custom" badge, replaces `<select>` with `<input type="text">` (preserving `name` attr for form submission), hides swatch/image cells. Reversible — if AE re-enters a SanMar style and cascade populates, reverts to dropdown.
**Key details**: Save reference to original `<select>` in `_originalColorSelects[rowNum]` for restoration. Use `card.replaceChild()` for clean DOM swap. Each row tracks state independently. Field names: row 1 = `GarmentColor`, rows 2-4 = `Garm_Color_N`.

## Pattern: Caspio DataPage DOM Restructuring — External JS Enhancement Layer (2026-03-11)

**Problem**: Caspio DataPage forms render as flat `<table>` markup with no semantic grouping. Needed modern card-based layout with sections, field pairs, and garment row cards.
**Solution**: `restructureFormLayout()` runs on `DataPageReady`, wraps Caspio table rows into semantic sections (`ae-form-section`) with headers, pairs label+input rows into `field-pair` divs, and wraps garment rows into `garment-row-card` containers with row number badges. Guard flag `_aeRestructured` prevents re-wrapping on tab switches.
**Key patterns**:
- Use `MutationObserver` or `DataPageReady` event, NOT DOMContentLoaded (Caspio loads async via embed script)
- Field name conventions: row 1 = `GarmentStyle`/`GarmentColor`, rows 2-4 = `Garm_Style_N`/`Garm_Color_N`
- Swatch images: `Swatch_N` fields. Product images: `MAIN_IMAGE_URL_N` fields
- Caspio `InsertRecord` prefix on all input names in submission forms
- `cbFormFieldCell` class on cells containing Caspio-managed widgets (swatches, images) — hide these for custom products
- Tab switch fires `DataPageReady` again — guard with `_aeRestructured` flag to prevent double-wrapping

## Bug: Caspio Form Buttons Default to type="submit" — Modal Shows Wrong Card Data (2026-03-09)

**Problem**: Clicking "Time Log" button on card #2 always opened the modal showing card #1's design ID. All dynamically created buttons inside Caspio gallery cards showed incorrect data.

**Root Cause**: `document.createElement('button')` defaults to `type="submit"`. Caspio wraps gallery cards in `<form>` elements. Clicking the button triggered Caspio's form submission handlers despite `e.preventDefault()` and `e.stopPropagation()` — Caspio's own listeners fired first, causing a DataPage re-render that interfered with the modal.

**Solution**: Add `b.type = 'button'` to the `btn()` factory function in `injectQuickActions()`. Prevents the button from ever being treated as a submit trigger inside Caspio forms.

**Prevention**: Always set `type="button"` on dynamically created `<button>` elements inside Caspio DataPages. Never rely on `preventDefault()` alone — Caspio's own event system can intercept before your handler.

**Project**: [Pricing Index] — `shared_components/js/art-hub-steve.js`

---

## Bug: Caspio Semantic Markup — Deployment Suffixes Corrupt Field Name Extraction (2026-03-08)

**Problem:** `processDetailForm()` in `art-hub-steve.js` couldn't map Caspio fields correctly. Swatch/garment image thumbnails wouldn't render (0 images), KV pairs had 15 labels but only 1 value. The detail form looked unstyled.

**Root Cause 1 — Semantic markup vs table markup:** Caspio's `EnableSemanticMarkup="True"` renders `<div>` + `<section>` instead of `<table>`/`<tr>`/`<td>`. All existing JS/CSS selectors (`tr`, `td.cbFormLabelCell`, `table.cbFormTable tbody`) were dead code.

**Root Cause 2 — Deployment hex suffixes in `data-cb-cell-name`:** Attributes like `EditRecordSwatch_1_773016335370a6LabelCell` contain 14-char hex deployment suffixes. Input IDs (`EditRecordDue_Date`) are clean — no suffix. The old regex `/^EditRecord([A-Za-z_]+\d*)/` captured `Order_Num_SW_773016335370` instead of `Order_Num_SW`.

**Root Cause 3 — Missing sibling data cell lookup:** `data-cb-cell-name` path mapped label cells but set `dataSpan: null` because it never looked for the sibling data cell. The TEXT_TO_FIELD fallback path was then skipped since the field was already in `fieldBlockMap`.

**Solution:** (1) Rewrote all selectors: `tr` → `[data-cb-row-expanded]`, `.cbFormLabelCell`/`.cbFormDataCell` (no tag qualifier). (2) New regex strips suffix: `cleanCell.match(/^EditRecord([A-Za-z_\d]+?)(?:_[0-9a-f]{8,})?$/i)` — non-greedy match + ≥8 hex chars avoids matching `_1`, `_2` field suffixes. (3) Added `findDataSibling()` helper that walks siblings matching `data-cb-row-expanded` to find the paired data cell. (4) Added raw Caspio labels to TEXT_TO_FIELD map (e.g., `'GarmentStyle': 'GarmentStyle'` alongside `'Style': 'GarmentStyle'`).

**Prevention:** When working with Caspio semantic markup, always test regex patterns against real `data-cb-cell-name` values — they contain deployment-specific hex suffixes that change per DataPage build. Input IDs are clean. Always pair label cells with their data siblings via `data-cb-row-expanded` matching. [Pricing Index]

---

## Pattern: Caspio DataPage Button Consolidation — JS-Only Card Buttons (2026-03-07)

**Problem:** Art Hub cards had a cluttered two-row button layout: Caspio HTML Block 1 rendered `[Add Note] [View Notes] [View Details]` in `.card-footer`, then JS injected `[Working] [Done] [Send Back]` in a separate `.quick-actions` div below. Inconsistent styling, hard to maintain, and visually cramped.

**Solution:** Emptied Caspio's `.card-footer` contents (kept the empty div as a mount point) and rebuilt ALL 6 buttons in JS inside `.card-footer`. Status-aware: completed/cancelled cards show only `[View Notes]` + `[View Details]`. View Details works by finding Caspio's auto-generated hidden `a[data-cb-name="DetailsLink"]` via `card.closest('div[data-cb-name="data-row"]')` and clicking it programmatically — this link exists independently of HTML Block 1.

**Key Insight:** Caspio Gallery DataPages auto-generate a hidden DetailsLink anchor (`data-cb-name="DetailsLink"`) in each data-row container. This link is NOT part of the HTML Block template — it's generated by the DataPage engine. So removing all buttons from HTML Block 1 doesn't break detail navigation; JS can still find and click it.

**Also fixed:** "hrs hrs" double text bug — moved " hrs" suffix inside the `<span class="charge-hours">` element so the footer script's calculation doesn't produce "1.00 hrs hrs".

**Prevention:** When Caspio DataPage buttons need complex logic (status-aware show/hide, API calls), move ALL buttons to JS. Keep Caspio HTML Block minimal — just structural mount points.

**Tags:** `[Pricing Index]`

---

## Data Quality: Design_Lookup_2026 — ID_Unique is Empty, Use Design_Number for WHERE (2026-02-26)

**Problem:** Phase 4 of the 7-phase audit script (`audit-fix-design-lookup.js`) attempted to clean newlines from Art_Notes using `WHERE ID_Unique=${rec.ID_Unique}`. All 1,451 records failed — 104 with 400 errors, 1,347 with 0 records affected.

**Root Cause:** `ID_Unique` field is empty/null for ALL records in `Design_Lookup_2026`. The field exists in the schema but was never populated (likely an AutoNumber that doesn't export or a leftover from table creation). WHERE clause `ID_Unique=` → malformed SQL → 400. WHERE clause `ID_Unique=<empty>` → 0 matches.

**Solution:** Changed WHERE key to `Design_Number` (which IS populated for all records). Grouped records by Design_Number to avoid redundant updates (same design = same Art_Notes). Result: 1,351 records cleaned across 363 designs (26 residual errors from Art_Notes with special characters Caspio rejects).

**Prevention:** For `Design_Lookup_2026`, NEVER use `ID_Unique` in WHERE clauses — it's always empty. Use `Design_Number` (numeric, always populated) as the primary key for updates. When updating shared fields (Art_Notes, Company, etc.), group by Design_Number first since multiple DST variants share the same design. `[caspio-proxy]`

---

## Data Quality: Design_Lookup_2026 Full Audit Results (2026-02-26)

**Context:** After sync, backfill (94.8% Customer_ID fill), and fuzzy match (26 auto-fixes), ran comprehensive 7-phase audit on 159,009 rows.

**Script:** `caspio-pricing-proxy/scripts/audit-fix-design-lookup.js` (CLI: `--live`, `--phase=N`, `--verbose`)

**Results (109.7 min live run):**
- Phase 1: **7,941** DEAD records deactivated (Customer_Type='DEAD' → Is_Active='false')
- Phase 2: **321** empty ArtRequests shells deactivated (Design_Number >= 50000, zero metadata)
- Phase 3: **11** test entries deactivated, 22 flagged for review
- Phase 4: **1,351** Art_Notes cleaned (newlines → "; " separator), 26 errors (re-run after fix)
- Phase 5: **108,725** records enriched with Customer_Type (from CSV + Caspio tables)
- Phase 6: **27,672** records enriched with Sales_Rep (Taneisha/Nika account lists)
- Phase 7: **480** records matched Company + Customer_ID from Design_Name parsing (118 groups: 106 exact + 12 fuzzy)

**Total: ~146K records updated.** CSV report: `Downloads/design-lookup-audit-2026-02-26.csv` (2,144 entries).

**Key gotchas:**
- Phase 3 "DEMO" test detection caught real companies (Rhine Demolition, DeMolay) — fixed with `FALSE_POSITIVE_RE` and `\btest\b` standalone word match
- Phase 7 parser false positives with generic words ("Blank Golf Ball" → customer "blank") — fixed with `PARSED_BLACKLIST` and strict prefix matching (key ≥ 8 chars, key length ≥ 40% of candidate)
- Phase 7 found fewer orphans than expected (2,722 vs 16,600) because prior backfill/fuzzy scripts already fixed most
- Caspio API timeouts after ~6,500 sequential PUT calls — 40 timeouts in Phase 5, but non-fatal (errors caught, script continues)
`[caspio-proxy]`

---

## Algorithm: Fuzzy Match Scoring — Use MAX-of-Methods, Not Weighted Average (2026-02-26)

**Problem:** Fuzzy match script to fix misspelled company names in Design_Lookup_2026 only found 5 auto-fixes at ≥0.95 threshold. Known good matches like "Pro End Painting" → "ProEnd Painting" (Levenshtein 0.94) scored only 0.625 composite. "L&W Supply" → "L & W Supply" similarly under-scored.

**Root Cause:** Weighted-average composite scoring (`levNorm*0.45 + levRaw*0.15 + tokenScore*0.25 + bonuses`) penalized cases where one method was very strong but another was weak. "ProEnd" tokenizes differently than "Pro End" (token Jaccard = 0.25), diluting the strong Levenshtein signal. Punctuation differences ("L&W" vs "L & W") similarly hurt token scores.

**Solution:** Changed to MAX-of-methods approach: `Math.max(levNorm, levRaw, levStripped, tokenScore) + bonuses`. Added 4th method `levStripped` — removes ALL non-alphanumeric characters before Levenshtein comparison (catches "L&W" = "LW" = "L & W"). Lowered thresholds from 0.95/0.80 to 0.90/0.75 (scores are now more accurate). Results: 5 → 26 auto-fixes, all verified correct.

**Prevention:** When building composite similarity scores from multiple methods, prefer MAX (best individual signal) over weighted average (dilutes strong signals). Weighted average is appropriate when methods are complementary and you want agreement; MAX is better when any single strong match is sufficient evidence. `[caspio-proxy]`

---

## Optimization: Design Lookup Normalization — 4 Tables → 1 Unified Table (2026-02-24)

**Problem:** `digitized-designs.js` route was 1,317 lines with 4 parallel Caspio API calls per search (Master, ShopWorks_Designs, Thumbnail_Report, ArtRequests). Each endpoint had complex merge logic (`mergeDesignResults()` ~100 lines), timeout wrappers, and field name mapping across different table schemas. Slow searches (~2-3s) and fragile code.

**Root Cause:** Design data was spread across 4 Caspio tables with different schemas. Every API request required fetching from all 4 tables, merging results, deduplicating, and picking "best" field values (e.g., company name priority: Master → ArtRequests → ShopWorks).

**Solution:** Created `Design_Lookup_2026` unified table in Caspio (26 fields). Sync script (`scripts/sync-design-lookup.js`) reads all 4 source tables, merges with priority logic, and inserts ~38K records. Route refactored to query single table: 1,317 → 652 lines. Key findings:
- **Caspio REST v3 does NOT support batch/array POST** — each record must be sent individually. Array POST returns 400 "IncorrectBodyParameter".
- **Concurrency 10** (parallel individual POSTs with `Promise.allSettled`) achieves ~21 records/sec. Serial inserts only ~3/sec.
- **`Is_Active` is Text(255) in Caspio** (not Boolean) — must use `'true'`/`'false'` strings in WHERE clauses.
- Frontend only uses 4 of 11 endpoints: `/lookup`, `/fallback`, `/search-all`, `/by-customer`. 7 endpoints removed (CRUD, `/search`, single design lookup).

**Prevention:** For large Caspio data consolidations, always test single-record POST first, then determine if batch is supported. Use materialized view pattern (periodic sync script) rather than real-time multi-table joins. `[caspio-proxy]`

---

## Fix: Notes On Order Crammed Into Single Entry — Split Into Separate Notes (2026-02-24)

**Problem:** Notes On Order in ShopWorks showed one combined note with all info (Quote ID, Tax Account, Expected Tax) on separate lines within the same entry. Staff had to click the note to read all lines.

**Root Cause:** `buildNotes()` joined all `orderNoteParts[]` with `\n` into a single `{ Note, Type }` object. ShopWorks displays only the first line of multi-line notes in the list view.

**Solution:** Each piece of info is now its own separate `{ Note: "...", Type: "Notes On Order" }` entry — Quote ID, Tax Account, Expected Tax, PO, Carrier, Tracking, etc. are all individual note entries. Matches Python InkSoft (3-Day Tees) pattern (lines 1358-1381 of `json_transform_gui.py`). Other note types (Art, Production, Purchasing, Shipping) remain single grouped entries since their content is logically related.

**Prevention:** For ManageOrders notes, use separate note entries for distinct pieces of info that staff need to see at a glance. Only combine into one entry when content is logically grouped (like a list of line items in Notes To Purchasing). `[caspio-proxy]`

---

## Pattern: Fee Items Catch-All for Quote Display (2026-02-14)

**Problem:** Fee items saved as `quote_items` with `EmbellishmentType='fee'` (Monogram, NAME, WEIGHT, SEG, DT, etc.) were persisted correctly but never rendered in quote-view or PDF. Only session-level fees (tax, shipping, stitch surcharges) rendered because they had explicit rendering code.
**Root cause:** `renderFeeRows()` had hardcoded rendering for specific fee types (stitch surcharge, AL, digitizing, rush, etc.) but no catch-all for unknown/new fee types. Every new fee type required explicit rendering code.
**Solution:** Added a `handledFeeStyleNumbers` Set containing all explicitly rendered part numbers. After all explicit rendering, a catch-all loop processes remaining `EmbellishmentType='fee'` items not in the Set. Applied to both web view (`renderFeeRows()`) and PDF (`renderPdfFeeRows()`).
**Prevention:** When adding new fee types, they automatically appear via the catch-all. Only add explicit rendering if the fee needs special formatting (e.g., percentage display, clickable links).

---

## Pattern: Service Row Promotion from Notes to Product Table (2026-02-14)

**Problem:** During ShopWorks import, Weight and Sewing services were dumped into the notes textarea as text. They weren't visible in the product table and weren't saved as fee line items.
**Root cause:** `confirmShopWorksImport()` had handling for some services (digitizing, rush, art) but Weight/Sewing/DT/Contract fell through to a catch-all that appended to notes.
**Solution:** Added `createServiceProductRow()` calls for sewing, weight, DT, and contract items. Added their keys to `handledServiceKeys` array so they don't fall to the catch-all. Extended `SERVICE_META` with metadata for each new type (description, icon, isCap flag, default price).
**Prevention:** When the parser adds a new service type, always (1) add to `SERVICE_META`, (2) add import handling in `confirmShopWorksImport()`, (3) add to `handledServiceKeys`, (4) add to `SERVICE_STYLE_NUMBERS`.

---

## Pattern: DOM Decoupling for Reusable Functions (2026-02-14)

**Problem:** `generateProfessionalQuoteHTML()` and `sendQuoteEmail()` read `document.getElementById('shipping-fee')` and `document.getElementById('tax-rate-input')` directly. This couples them to the embroidery builder DOM, making them unusable from other contexts (e.g., quote-view resend, batch processing).
**Solution:** Added `options = {}` parameter with `options.shippingFee` and `options.taxRate`. Uses nullish coalescing `??` to fall back to DOM reads when options not provided. Backward-compatible — existing callers work unchanged.
**Prevention:** When a function reads from the DOM, consider whether it might be called from another context. If so, accept the values as parameters with DOM as fallback via `??`.

---

## Fix: resetQuote() crash + stale patch setup checkbox (2026-02-11)

**Symptom:** Clicking "New Quote" in embroidery builder crashed with `recalculateAllPricing is not defined`. Additionally, importing an order without leather patches after one that had them left the `cap-patch-setup` checkbox checked, causing incorrect GRT-50 fee.
**Root cause (two bugs):**
1. `resetQuote()` called `recalculateAllPricing()` — a function that doesn't exist. The correct name is `recalculatePricing()`. The crash at line 7528 prevented `updateAdditionalCharges()`, `markAsSaved()`, and focus from running.
2. `resetQuote()` never unchecked the `cap-patch-setup` checkbox. The import code re-checks it when `patchSetup: true`, but reset needs to clear it first so consecutive imports start clean.
**Solution:** Fixed function name to `recalculatePricing()`. Added checkbox reset (`.checked = false` + remove `.checked` class from wrapper) alongside the other logo config resets.
**Prevention:** After renaming/removing a function, search for all call sites. When adding a new checkbox/toggle to a builder, always add its reset to `resetQuote()`.

---

## Fix: Tax Lookup Crashes on Undeployed Backend + Import Loses Fallback Rate (2026-02-11)

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

## Bug: Embroidery Tier Ordering Wrong — API Returns Non-Sequential `tiersR`

**Problem:** Compare Pricing and Manual Pricing embroidery cards showed tiers in wrong order: 1-7, 24-47, 48-71, 72+, 8-23. The 8-23 tier appeared last.

**Root Cause:** `fetchPricingData()` returns `tiersR` from the API in whatever order the database returns them. Unlike `generateManualPricingData()` which constructs tiers in hardcoded order, the API path has no guaranteed sort.

**Solution:** Sort `tierData` by `MinQuantity` before rendering: `[...tierData].sort((a, b) => (a.MinQuantity || 0) - (b.MinQuantity || 0))`. Applied to `renderEmbroidery()` and `renderCapEmbroidery()` in both `compare-pricing.js` and `manual-pricing.js`.

**Prevention:** Always sort API-returned tier data by `MinQuantity` before display. Never assume API returns data in presentation order.

---

## Bug: LTM Fee Not Distributed in Manual/Compare Calculators — Price Mismatch

**Problem:** Compare Pricing showed J790 embroidery 1-7 tier at $78.00 (base price), while customer-facing calculator showed $94.67. $16.67 discrepancy.

**Root Cause:** Customer-facing embroidery calculator distributes $50 LTM across pieces via `updateLTMCalculator()` (default 3 pcs → $50/3 = $16.67 added per piece). The internal calculators rendered raw base prices without LTM distribution.

**Solution:** Added LTM qty picker dropdown (1-7 pcs, default 3) to embroidery and cap embroidery cards. `renderEmbroidery()` adds `$50/ltmQty` to 1-7 tier prices only. Footer note clarifies: "1-7 prices include $50 LTM fee (N pcs). Tiers 8+ are standard pricing (no LTM)."

**Prevention:** When building new pricing displays, always check how the customer-facing calculator handles LTM/fees.

---

## Bug: Embroidery/Cap Manual Pricing Crash — Double-Calculation of Already-Transformed Data

**Problem:** Unified manual pricing page crashed with `TypeError: sizes is not iterable` when rendering embroidery and cap embroidery cards.

**Root Cause:** `generateManualPricingData()` in both `embroidery-pricing-service.js` and `cap-embroidery-pricing-service.js` internally calls `calculatePricing()` + `transformToExistingFormat()`, returning FINAL transformed data. The manual pricing page then called `calculatePricing()` AGAIN on the already-transformed output. The transformed data uses `uniqueSizes`/`tierData` instead of `sizes`/`tiersR`, so destructuring `sizes` yields `undefined` → crash.

**Solution:** Removed redundant `calculatePricing()` call. Cached the returned data directly. Updated render methods to destructure `tierData` (array of tier objects) instead of `tiers`.

**Prevention:** Each pricing service's `generateManualPricingData()` has a different return contract. DTG returns raw data (needs manual calculation). DTF/Embroidery/Cap/ScreenPrint return fully transformed data. Always check what the service returns before adding calculation steps.

---

## Change: ShopWorks Part Number Alignment — 10 Fixes Across 3 Files

**Problem:** Frontend embroidery quote builder saved part numbers that didn't match what ShopWorks expects. 10 mismatches found: wrong casing (AS-GARM→AS-Garm, MONOGRAM→Monogram), wrong abbreviations (CSD→CS), non-standard formats (FB-30000→DECG-FB, AL-12000→AL), missing position-awareness for cap ALs (all saved as 'AL' instead of AL-CAP/CB/CS), and missing fee items (3D Puff and Laser Patch upcharges baked into per-piece price instead of separate line items).
**Solution:**
1. Position-aware AL: garment→`AL`, cap front→`AL-CAP`, cap back→`CB`, cap side→`CS` (pricing engine)
2. Full Back: `DECG-FB` instead of `FB-{stitchCount}` (pricing engine)
3. Casing fixes: `AS-Garm` (service file), `Monogram` (HTML builder)
4. Cap Side abbreviation: `CS` instead of `CSD` (pricing engine)
5. 3D Puff/Laser Patch extracted from per-piece cap price → separate fee items (`3D-EMB`, `Laser Patch`). `grandTotal` updated to include `puffUpchargeTotal + patchUpchargeTotal`
6. `cap-embellishment-fee-row` added to UI for 3D/patch display
7. SERVICE_STYLE_NUMBERS + SERVICE_META updated with new entries + legacy backward-compat entries
**Prevention:** Always cross-reference part numbers against ShopWorks' master list before adding new services.

---

## Change: Stitch Surcharges Switched from Linear to Flat Tiers

**Problem:** Additional stitch fees (AS-GARM/AS-CAP) used a linear per-1K rate formula: `(stitchCount - 8000) / 1000 × $1.25` for garments, `$1.00` for caps. This produced inconsistent prices (e.g., 12K stitches = $5.00, 18K = $12.50) that didn't match business intent.
**Solution:** Added `stitchSurchargeTiers` array and `getStitchSurcharge(stitchCount)` method — returns flat $0/$4/$10. Replaced 3 linear calculation sites with flat tier lookup. Added 4 new rows to Caspio `Embroidery_Costs` table.
**Prevention:** AL and Full Back stitch costs still use linear per-1K rates — do NOT change those. Only primary logo stitch surcharges use flat tiers.

---

## Pattern: Retry Wrapper for POST/PUT API Calls — `_fetchWithRetry()` (2026-02-10)

**Problem:** 9 POST/PUT fetch calls in the embroidery quote service had no retry logic. A transient network hiccup or 5xx error = lost data, no recovery.
**Solution:** Added `_fetchWithRetry(url, options, maxRetries = 2)` to `EmbroideryQuoteService`. Retries on network errors, 5xx, and 429 with exponential backoff (1s, 2s). Does NOT retry 4xx (client errors). Returns the Response object so existing `.ok` checks work unchanged.
**Prevention:** All new POST/PUT calls in quote services should use `_fetchWithRetry()` instead of raw `fetch()`. GET calls don't need it (already have fallbacks).

---

## Fix: Partial Quote Save Shown as Full Success (2026-02-10)

**Problem:** `saveQuote()` returned `{ success: true, partialSave: true, warning: "..." }` when some items failed to save, but the caller only checked `result.quoteID`. User saw "Quote saved successfully!" with missing items.
**Solution:** Added `if (result.partialSave && result.warning) showToast(result.warning, 'error')` before the success modal in the save handler.
**Prevention:** Any API response with a `partialSave` or `warning` field must be surfaced to the user, not silently swallowed.

---

## Fix: ShopWorks Import Duplicate Detection Dropping Rows ($366 Discrepancy) (2026-02-10)

**Problem:** Order #136706 showed $3,591 in the embroidery quote builder but should have been $3,957. Six product rows were silently dropped during ShopWorks import, losing $366.
**Root Cause:** `selectColor()` has duplicate detection that prevents adding the same style+color combination twice. During ShopWorks import, products with the same style and color but different prices (e.g., M=$61 vs 2XL=$63 due to size upcharges) were being rejected as duplicates.
**Solution:** Added `skipDuplicateCheck` parameter to `selectColor()`. When called from `importProductRow()`, passes `skipDuplicateCheck=true` to bypass the duplicate detection. Added post-import validation for row count verification.
**Prevention:** Import flows should always bypass interactive safety checks (duplicate detection, confirmation dialogs) since the data is already validated.

## Bug: Custom Price Override Lost During ShopWorks Import (Async Race Condition) (2026-02-06)

**Problem:** User selects "Custom" radio and enters $55.00 for NKDM3976. After import, product shows $67.50 (API price) instead of $55.00.
**Root Cause:** `importProductRow()` set `row.dataset.sellPrice` AFTER `selectColor()`. `selectColor()` fires `recalculatePricing()` asynchronously (fire-and-forget). Timeline: selectColor fires async pricing → code sets sellPrice → onSizeChange fires pricing → selectColor's async pricing resolves LAST and overwrites.
**Solution:** Move `row.dataset.sellPrice` assignment to immediately after row creation, BEFORE any pricing-related calls.
**Prevention:** When a function sets dataset attributes that affect pricing, always set them BEFORE any function that triggers `recalculatePricing()`. Async fire-and-forget calls are especially dangerous.

## Bug: SanMar Prices Lost + Empty-PN Items Show No Price After ShopWorks Import (2026-02-09)

**Problem:** Two ShopWorks import bugs: (A) SanMar products used API-calculated prices instead of ShopWorks invoiced prices. (B) Empty-PN items like "drinkware laser logo setup" showed "-" for price.
**Root Cause A:** `selectColor()` deletes `row.dataset.sellPrice` for SanMar products. During import, `sellPriceOverride` was applied before `selectColor()` which deleted it.
**Root Cause B:** Empty-PN handler set `row.dataset.style = ''` — `collectProductsFromTable()` skips rows with empty style.
**Solution A:** Re-apply `sellPriceOverride` immediately after `selectColor()` and its 300ms wait.
**Solution B:** Set `row.dataset.style = product.description || 'Custom Item'` instead of empty string.
**Prevention:** Any function that clears dataset attributes is dangerous during import flows. Always re-apply overrides AFTER every function that might clear them.

## Bug: "Unable to load size pricing for DECG" on ShopWorks DECG-Only Import (2026-02-06)

**Problem:** Pasting a ShopWorks order with only DECG/DECC items showed a red error banner. The import partially worked but the error was confusing.
**Root Cause:** `collectProductsFromTable()` pushes DECG service rows into `products[]` with `isService: true`. The pricing engine tried `fetchSizePricing('DECG')` which returned nothing.
**Solution:** Filter service items out before sending to pricing engine: `const productList = allItems.filter(p => !p.isService);`
**Prevention:** When a collection function returns mixed item types (products vs. services), always filter before passing to type-specific logic.

## Pattern: Non-SanMar Product "Add on the Fly" in Quote Builder (2026-02-06)

**Problem:** ShopWorks orders with non-SanMar products failed silently — showed "Not found" with no way to proceed.
**Solution:** Three-tier fallback in `onStyleChange()`: (1) SanMar API, (2) Non-SanMar Products API, (3) "Add" button with modal. Pricing engine supports `sellPriceOverride` — bypasses margin formula via `buildFixedPriceResult()`.
**Prevention:** When adding a new product source, always wire it into the existing product lookup chain rather than creating a parallel flow.

## Bug: /api/embroidery-costs Endpoint Always Returns 400 (2026-02-05)

**Problem:** `GET /api/embroidery-costs?itemType=Shirt&stitchCount=8000` always returned 400.
**Root Cause:** WHERE clause referenced `StitchCountRange` (non-existent field). The actual Caspio field is `StitchCount`. Also the value was quoted as a string but it's a numeric field.
**Solution:** Changed `StitchCountRange='${stitchCount}'` to `StitchCount=${stitchCountInt}`. Added itemType whitelist and integer validation.
**Prevention:** When writing Caspio WHERE clauses, always verify field names against the actual table schema.

## Discovery: Fee Items Not Saved as quote_items Line Items (2026-02-05)

**Problem:** Embroidery quote fees were stored ONLY as session-level fields on `quote_sessions`. ShopWorks order entry was incomplete because each fee has a specific part number.
**Solution:** Added `_saveFeeLineItems()` method. Saves 11 fee types as `quote_items` with `EmbellishmentType: 'fee'` and correct ShopWorks part numbers.
**Prevention:** When adding new charge types to quote builders, always consider: does this need its own line item for ShopWorks order entry?

## Bug: Garment Tracker Archive Silently Archiving 0 Records for 11 Days (2026-02-05)

**Problem:** The Heroku Scheduler ran archive daily since Jan 25, but archived 0 records every time. The script reported "SUCCESS" with exit code 0.
**Root Cause:** Two bugs: (1) Tried to read `Part01`-`Part10` fields on ManageOrders ORDER objects, but part numbers only exist on LINE ITEMS. (2) Used exact `===` matching for part numbers instead of `startsWith()`.
**Solution:** Changed daily script default from `archive-range` (broken) to `archive-from-live` (working). Rewrote `archive-range` to use `fetchLineItems()` per order. Added 0-record warnings to ALL 4 Heroku Scheduler scripts.
**Prevention:** Never assume ManageOrders order objects have part/line item data — always use `fetchLineItems(orderId)`. Use `startsWith(base + '_')` matching for part numbers.

## Bug: Manual Calculator Used Old 4-Tier Tiers While Quote Builder Used New 5-Tier (2026-02-02)

**Problem:** The embroidery manual pricing calculator still showed the old 4-tier structure (1-23, 24-47, 48-71, 72+) while the quote builder had been updated to the new 5-tier structure (1-7, 8-23, 24-47, 48-71, 72+).
**Root Cause:** When the Feb 2026 tier restructure was implemented, the manual calculator service was missed.
**Solution:** Updated `embroidery-manual-service.js` with new 5-tier boundaries, default tiers, fallback pricing, and LTM threshold from `< 24` to `<= 7`.
**Prevention:** When changing pricing tiers, search ALL files for tier-related strings: `'1-23'|"1-23"|< 24|getTier|getTierLabel|LTM`

---

## Embroidery Pricing Restructure 2026-02

**Change:** Updated embroidery pricing tier structure from 4 tiers to 5 tiers.
**Old Tiers:** 1-23 (LTM), 24-47, 48-71, 72+
**New Tiers:** 1-7 (LTM $50), 8-23 (no LTM, +$4 surcharge baked in), 24-47, 48-71, 72+
**Key Changes:**
1. LTM/Setup fee now only applies to 1-7 pieces (was 1-23)
2. 8-23 tier has no LTM but +$4/piece surcharge baked into EmbroideryCost
3. All boundary checks changed from `< 24` to `<= 7` for LTM
**Prevention:** When changing pricing tiers, search ALL files for tier-related strings and functions.

---

## Bug: Phone Field in Quote Builders Wasn't Stored Anywhere (2026-01-29)

**Problem:** All 4 quote builders had a Phone field in the customer info form, but it was never saved to the database.
**Solution:** Removed the Phone field from all 4 quote builder HTML forms.
**Prevention:** Before adding form fields to quote builders, verify the field exists in the Caspio table and the quote service includes it in save/update payloads.

---

## Bug: Chunk Boundary Overlap Causes Double-Counting (2026-01-25)

**Problem:** Sync-sales endpoints showed YTD totals ~10% higher than ManageOrders. Some accounts had exactly DOUBLE the correct amount.
**Root Cause:** Orders were fetched in 20-day chunks to avoid API timeouts, but chunk boundaries overlapped.
**Solution:** Added deduplication by `id_Order` before aggregation.
**Prevention:** When fetching data in chunks, ALWAYS deduplicate by unique ID before processing.

## Pattern: Rate Limit Handling with Exponential Backoff (2026-01-28)

**Problem:** Rep CRM dashboards failed to load when API returned 429 (rate limited).
**Solution:** Added linear exponential backoff (5s → 10s → 15s) on 429 responses.
**Prevention:** All API fetch functions should include retry logic for 429 responses.

---

## Bug: Quote URL Save/Load Lost Additional Fees (2026-01-28)

**Problem:** When user saved a quote with fees (art charge $50, rush fee $25, discount 10%) and shared the URL, loading that quote showed all fees as $0.
**Root Cause:** Only Embroidery quote service was saving fee fields. DTG, Screen Print, and DTF services didn't include these fields.
**Solution:** Updated all quote services to save fee fields. Added `populateAdditionalCharges()` function to all 4 builders.
**Prevention:** When adding new fee fields, add to ALL quote service `sessionData` objects (save AND update methods) and restore logic in all builders.

---

## Pattern: Two Embroidery Pricing Systems (Both Use Service_Codes API) (2026-02-01)

**Context:** Pricing audit revealed two independent pricing systems that must stay in sync.

**The Two Systems:**
| System | Purpose | File | API Source |
|--------|---------|------|------------|
| **Quote Builder** | Build new quotes from scratch | `embroidery-quote-pricing.js` | `/api/pricing-bundle`, `/api/service-codes` |
| **ShopWorks Import** | Import existing ShopWorks orders | `shopworks-import-parser.js` | `/api/service-codes` |

**Prevention:** When adding new pricing values, add to BOTH systems if applicable. Add to `Service_Codes` Caspio table first, then update the loader in each JS file.

---

## Problem: Quote items accumulate instead of being replaced on re-save (2026-01-14)

**Problem:** Quote View showed 470+ items including products never added. Prices completely wrong.
**Root cause:** `saveQuote()` only POSTed new items, never deleted existing ones first. Quote ID generation uses sessionStorage which resets on page refresh.
**Solution:** Added `deleteExistingItems(quoteID)` method that queries existing items by QuoteID and deletes them in parallel batches before inserting new ones.
**Prevention:** ANY quote save operation MUST delete existing items for that QuoteID before inserting.

---

## Decision: Additional Stitch Charges as Separate Line Item (Not Baked Into Unit Price) (2026-01-14)

**Context:** When embroidery logos exceed 8000 stitches, there's an additional charge. Previously, this was BOTH baked into the unit price AND shown as a separate sidebar line.
**Decision:** Display base price (8K stitches) in the table, with Additional Stitches as a SEPARATE line item that is ADDED to the total. This follows B2B industry standard for transparent, itemized quotes.

---

## Fee Line Item Naming Standardization (ShopWorks Alignment) (2026-01-14)

**Context:** Fee line item SKUs and descriptions were inconsistent with ShopWorks naming conventions.
**Naming Changes:** AS-GARM/AS-CAP for stitch charges, AL/CB/CS for additional logos, DD/DD-CAP for digitizing, GRT-50 for art charge, LTM/LTM-CAP for setup fees.
**Prevention:** When adding new fee types, check ShopWorks for standard naming conventions first.

---

## Problem: Digitizing fees combined into one row instead of separate garment/cap rows (2026-01-14)

**Problem:** Quote View showed one "DIGITIZE-G" row at $200 instead of two rows: "DIGITIZE-G" at $100 and "DIGITIZE-C" at $100.
**Root cause:** `saveAndGetLink()` called `calculateQuote()` WITHOUT the `logoConfigs` parameter. Without it, the pricing engine uses the legacy path that counts ALL logos as garment digitizing.
**Solution:** Added `logoConfigs` parameter to `saveAndGetLink()` to match `recalculatePricing()`.
**Prevention:** When calling pricing functions, always check if other callers pass additional parameters. The save function should use identical parameters to the live UI calculation function.

---

## Problem: Parent row quantity includes child row quantities (confusing UX) (2026-01-14)

**Problem:** PC61 parent row showed Qty: 16 but only had 14 pieces in the size columns. Child rows also showed their own quantities.
**Solution:** Removed the child row quantity addition from parent display. Parent shows ONLY its own sizes. Pricing calculator (`collectProductsFromTable()`) still correctly sums ALL quantities.
**Prevention:** When displaying quantities in tables with parent/child relationships, each row should show only its OWN quantity.

---

## Problem: Quote View Subtotal doesn't match visible line items (2026-01-14)

**Problem:** EMB0114-9 showed Subtotal $939 but visible rows summed to $1,189. Digitizing ($200) and Artwork ($50) were line items but not in Subtotal.
**Solution:** Changed Subtotal display to use `TotalAmount` instead of `SubtotalAmount + LTM`.
**Prevention:** For customer-facing displays, use `TotalAmount` (pre-tax grand total) not `SubtotalAmount` (products only).

---

## Problem: TotalAmount missing Art/Rush/Sample/Discount fees (2026-01-14)

**Problem:** TotalAmount was $1,484.50 but should have been $1,555.20. Art/Rush/Sample/Discount shown as line items but NOT in TotalAmount.
**Root cause:** TotalAmount was set to `pricingResults.grandTotal` which only includes subtotal + LTM + setup + AL. Art/Rush/Sample/Discount are from customerData, not the pricing engine.
**Solution:** Updated TotalAmount calculation to include all fees from customerData.
**Prevention:** When adding new fee fields to quote builders, ensure they are included in TotalAmount calculation.

---

## Problem: ADDL-STITCH fee row confused customers (2026-01-14)

**Problem:** Customers saw an "ADDL-STITCH" fee row in the quote products table, but math didn't add up because charges were already in unit prices.
**Solution:** Removed ADDL-STITCH fee row from both web display and PDF generation.
**Prevention:** When showing fee breakdowns, distinguish between informational values (already in prices) vs actual additional charges.

---

## Problem: LTM fee displayed twice in Quote View (2026-01-14)

**Problem:** Quote showed inflated unit prices ($25.78 instead of $23.00) AND a separate LTM-G fee row.
**Root cause:** Quote View displayed `FinalUnitPrice` (which includes LTM) but ALSO showed the LTM-G fee row separately.
**Solution:** Changed quote-view.js to prefer `BaseUnitPrice` over `FinalUnitPrice`.
**Prevention:** When items store both base and final prices, decide which to display based on whether fees are shown separately.

---

## Problem: 3 of 4 quote builders had ZERO mobile responsiveness (2026-01-13)

**Problem:** DTG, Embroidery, Screen Print quote builders unusable on tablets/phones.
**Solution:** Added comprehensive responsive breakpoints to all 3 CSS files: 1024px, 768px, 480px, plus print styles.
**Prevention:** All new quote builders must include responsive breakpoints.

---

## Problem: DTF Quote Builder shareable URL - colors not saving correctly (2026-01-13)

**Problem:** Four bugs: (1) All prices $0.00, (2) Color "N/A", (3) Images not loading, (4) Extended sizes all saved with parent's color.
**Solutions:** Fallback selectors for price, read from parentRow.dataset for color/image, each sizeGroup carries its own color/imageUrl.
**Prevention:** Always check where HTML stores data vs where JS expects it. Each line item should carry its own color/imageUrl.

---

## Problem: DTF Quote Builder internal size names vs display names (2026-01-13)

**Problem:** Child row lookup failing for 2XL and 3XL sizes.
**Root cause:** HTML creates child rows with internal names (XXL, XXXL) but display shows 2XL, 3XL.
**Solution:** Try both: `childMap[size] || childMap[internalSize]`
**Prevention:** Document size name mappings: 2XL=XXL, 3XL=XXXL. Always try both when looking up child rows.

---

## Problem: DTF Quote Builder extended size upcharges always used defaults (2026-01-12)

**Problem:** Extended sizes showed wrong upcharge prices, always falling back to hardcoded defaults.
**Root cause:** DTF Quote Builder fetched from `/api/pricing-bundle?method=DTF` which returns empty `sellingPriceDisplayAddOns: {}`.
**Solution:** Fetch from `/api/pricing-bundle?method=BLANK&styleNumber=XXX` instead. Fixed `getSizeUpcharge()` to use `??` instead of `||`.
**Prevention:** When DTF pricing-bundle returns empty arrays/objects, check BLANK or method-specific product bundles.

---

## Problem: Caspio ArtRequests file uploads stored wrong data pattern (2026-01)

**Problem:** Documentation incorrectly described storing ExternalKeys in File_Upload fields.
**Root cause:** Assumed REST API pattern without checking existing data — CSV export revealed 3000+ records use file PATH pattern, not ExternalKey UUIDs.
**Solution:** Store file paths (`/Artwork/${fileName}`) not ExternalKeys. CDN_Link formula auto-generates URLs from paths.
**Prevention:** Always check existing data patterns via CSV export before documenting API usage.

---

## Problem: OGIO brand products missing from search results (2025)

**Problem:** OGIO products never appeared in search, other brands worked fine.
**Root cause:** Using `makeCaspioRequest()` which doesn't handle pagination. OGIO has 100+ products on page 2.
**Solution:** Always use `fetchAllCaspioPages()` for any multi-record query.
**Prevention:** `makeCaspioRequest()` is now deprecated. Use `fetchAllCaspioPages()` everywhere.

---

## Problem: Caspio API quota exceeded (630K calls/month) (2025)

**Problem:** API throttling, requests failing with 429 errors.
**Solution:** Implemented caching with TTLs: 15min for pricing, 5min for searches, 1hr for Sanmar mappings.
**Prevention:** Always check if caching exists before adding new endpoints. Target: <500K calls/month.

---

## Problem: API requests failing mid-stream (2025)

**Problem:** Random auth failures even with valid token.
**Root cause:** Token expiring during request processing.
**Solution:** Check token expiry with 60-second buffer before making requests.
**Prevention:** `getCaspioAccessToken()` in server.js handles this automatically.

---

## Problem: API URL hardcoded, broke in different environments (2025)

**Problem:** API calls fail when deployed or URL changes.
**Solution:** Use `APP_CONFIG.API.BASE_URL` or config object.
**Prevention:** Rule #7 in CLAUDE.md: USE CONFIG FOR API URLs.

---

## Problem: Rate limiting not applied correctly (2025)

**Problem:** External APIs getting throttled.
**Solution:** Implemented three rate-limit tiers: ManageOrders 30 req/min, JDS 60 req/min, General 200 req/15min.
**Prevention:** Always add rate limiter when creating new external API endpoints.

---

## Bug: "Sew-on" Description with Empty PN Bypasses Alias System (2026-02-15)

**Problem:** Order has empty part number but Description "Sew-on". The alias system only checks non-empty PNs.
**Solution:** Added description-based reclassification when classification is 'comment' AND description matches `/^sew[\s-]?on/i`.
**Prevention:** When encountering service items with empty part numbers but recognizable descriptions, add description-based fallback detection.

---

## Bug: Lowercase State Abbreviation Fails Ship Address Parsing (2026-02-15)

**Problem:** "Sumner, Wa 98390" — the regex uses `[A-Z]{2}` (uppercase only).
**Solution:** Added `.toUpperCase()` to `stateZipStr` before the regex match.
**Prevention:** When parsing user-entered strings for pattern matching, always normalize case first.

---

## Bug: DECG "Di. Embroider Cap" Prefix Falsely Classifying Garments as Caps (2026-02-15)

**Problem:** ShopWorks uses "Di. Embroider Cap" as a service prefix even for non-cap garments.
**Solution:** Added regex match for prefix, then parse text after the prefix and check against `nonCapGarments` list.
**Prevention:** When parsing ShopWorks descriptions, always account for the service name prefix which may contain misleading keywords.

---

## Bug: `_4/5X` Combo Size Suffix Missing from Parser (2026-02-15)

**Problem:** `CSV102_4/5X` — a Cornerstone safety vest in combo size 4XL/5XL. Parser didn't extract this suffix.
**Solution:** Added `'4/5X': '4XL/5XL'` to `SIZE_MAP` and `'_4/5X'` to `SIZE_SUFFIXES`.
**Prevention:** When encountering new ShopWorks size suffixes, add both to `SIZE_MAP` and `SIZE_SUFFIXES`.

---

## Gap: ShopWorks Parser Silently Dropped Paid To Date, Balance, and Note Sections (2026-02-12)

**Problem:** Parser's section dispatcher didn't recognize the `Note` section. `_parseOrderSummary()` didn't match `Paid To Date:` or `Balance:` lines.
**Solution:** Added `paidToDate`/`balance` to `orderSummary`. Added `Note` section handler. Pass through to service and save to Caspio.
**Prevention:** When adding new Caspio columns for ShopWorks data, check if the parser already extracts this field or if it falls to `unmatchedLines`.

## Problem: ShopWorks Import Email Not Extracted for CRM Lookup (2026-01-31)

**Problem:** ShopWorks import populated the ID Lookup field with email for CRM search, but the field was empty or had truncated email.
**Solution:** Added fallback email extraction in `_extractEmailFallback()` method using regex and keyword proximity.
**Prevention:** When parsing structured text, always add fallback extraction methods.

---

## Problem: ShopWorks Import Showed 20 Pieces Instead of 24 After "Fix" (2026-01-31)

**Problem:** Import originally showed 22 pieces (missing 2). After fix, showed 20 (missing 4).
**Root Cause:** `_normalizeSize()` was changed to return `null` for ANY size containing `(Other)`, which broke items without a part number size suffix.
**Solution:** `_normalizeSize()` now cleans `(Other)` text but doesn't filter. The `item.sizes = {}` clear only happens when a suffix IS extracted.
**Prevention:** When fixing parser bugs, trace through BOTH code paths (with suffix AND without suffix).

---

## Problem: CRM YTD Total Doesn't Match Team Performance (2026-01-28)

**Problem:** Team Performance shows higher sales than CRM dashboard YTD for same rep.
**Root Cause:** Two different metrics: Team Performance = orders WRITTEN BY rep, CRM YTD = sales FOR ASSIGNED accounts.
**Solution:** Run diagnostic, trigger sync, check for customers not in CRM list.
**Prevention:** Document the metric distinction clearly.

---

## Problem: 3-Day Tees orders not processing correctly (2024-11)

**Problem:** Hours spent debugging wrong code path.
**Root cause:** Assumed order submission used `ThreeDayTeesOrderService` class — but that was DELETED. Actual path is `server.js:749-1050`.
**Prevention:** Added to CLAUDE.md.

---

## Problem: Gift certificates disappearing or consolidating (2025)

**Problem:** Multiple gift certs on same order getting merged into one.
**Root cause:** Gift certs were in Payments array — ShopWorks consolidates identical PartNumbers.
**Solution:** Gift certs are now LINE ITEMS with unique PartNumbers: "Gift Code 1", "Gift Code 2", etc.
**Prevention:** See `transform.py` lines 475-506. Gift certs are NOT payments.

---

## Problem: Tax calculation wrong after ShopWorks import (2025)

**Problem:** Tax amounts incorrect in ShopWorks.
**Root cause:** ShopWorks API has a bug — doesn't set `sts_EnableTax01-04` flags on line items.
**Solution:** Python tool hardcodes all 4 tax flags to 1, sets TaxTotal to 0, lets OnSite calculate.
**Prevention:** This is a workaround for ShopWorks API bug.

---

## Problem: Orders landing on weekends/holidays (2025)

**Problem:** Ship dates on Saturdays, Sundays, Christmas.
**Solution:** Auto-adjust to next business day — skips weekends and 12+ US holidays.
**Prevention:** `transform.py` lines 220-301 handles this automatically.

---

## Fix: XLR Regular-Fit Size Suffix Normalization (2026-02-22)

**Problem:** ShopWorks uses `_XLR` suffix for "XL Regular fit". Parser correctly strips this but `extended-sizes-config.js` had no equivalent normalization.
**Solution:** Added `normalizeRegularFitSize()` to `extended-sizes-config.js`. Regex-based: `XLR→XL`, `2XLR→2XL`, etc.
**Prevention:** Any new "fit variant" suffixes should be added to `normalizeRegularFitSize()`, not to `SIZE_TO_SUFFIX`.

---

## DONE: Changed _2XL to _2X in ALL quote builders and shared components (2026-02-21)

**Status:** DONE — all 12 files updated, verified via grep + 96 parser tests passing.
**Problem:** SanMar's live API rejects `_2XL` but accepts `_2X` for 2XL products.
**Solution:** Every `'2XL': '_2XL'` mapping changed to `'2XL': '_2X'` across 12 files.
**Evidence:** PC61_2XL → ERROR, PC61_2X → OK $3.75.

---

## Bug: Shopworks_Integration Table Does Not Exist — Extended Sizes Broken (2026-02-06)

**Problem:** All 3 quote builders couldn't load extended sizes. The `/api/sanmar-shopworks/import-format` endpoint returned 500.
**Root Cause:** The route queried a Caspio table `Shopworks_Integration` that does not exist.
**Solution:** Rewrote all helper functions to derive SKU patterns and size mappings from `Sanmar_Bulk_251816_Feb2024` instead.
**Prevention:** Before writing code that queries a Caspio table, verify the table exists by testing the query first.

---

## Bug: Tall-Only Products Missing from PDF and Quote Link (2026-02-01)

**Problem:** TLCS410 (tall-only product) correct in pricing calculation but missing from PDF and quote link reload.
**Root Causes:** PDF `extendedSizes` array missing tall sizes. Quote link loading function only populated standard size inputs.
**Solution:** Updated `extendedSizes` array to include all non-standard sizes. Modified `addProductFromQuote()` to call `createChildRow()` for extended sizes.
**Prevention:** When adding new size types, check ALL places that handle sizes: invoice generation, quote loading, ShopWorks import.

---

## Problem: Multi-SKU products have inconsistent size field counts (2025)

**Problem:** Extended sizes (4XL, 5XL) not mapping correctly.
**Solution:** Always verify size field mapping with actual ShopWorks data.
**Prevention:** Document in `/memory/SHOPWORKS_SIZE_MAPPING.md`.

---

## Problem: ShopWorks Size Translation Table unreliable (2025)

**Problem:** Sizes sometimes translate correctly, sometimes not.
**Solution:** Bypass it — hardcode size modifiers in Python tool.
**Prevention:** `SIZE_MODIFIERS` dict in `transform.py` is the source of truth, not ShopWorks.

---

## Bug: "Fixing" Code With Non-Existent Fields Breaks Everything (2026-02-02)

**Problem:** After attempting to fix tall size display, the system broke completely. Console showed `Item 1: undefined x 2 @ $undefined = $100.00`.
**Root Cause:** Changed code to use `lineItem.size` which DOESN'T EXIST. There are TWO different lineItem formats — one actually used, one dead code.
**Solution:** Reverted to parsing sizes from `item.description` using `parseSizeBreakdown()`.
**Prevention:** ALWAYS trace actual data flow before making changes — don't assume field names based on dead code.

---

## Bug: Tall-Only Products (TLCS410) Not Saved to quote_items (2026-02-02)

**Problem:** Product was silently dropped — `calculateProductPrice()` returned `null` for tall-only products with no standard sizes.
**Solution:** Added two additional fallbacks: try product's actual ordered sizes, then use highest available price.
**Prevention:** When calculating prices for non-standard products, always have fallback for products without standard sizes.

---

## CSS Consolidation: Quote Builder Shared Styles (2026-03-23)

**Problem:** All 4 quote builders had ~25 identical CSS sections duplicated across individual files (12,648 total lines).
**Solution:** Moved shared sections into `quote-builder-common.css`. Fixed CSS load order: common first, builder-specific second. Net: -3,354 lines.
**Prevention:** `quote-builder-common.css` loads FIRST — builder-specific CSS overrides via cascade.

## Fix: Variable Scoping in Review Modal — embConfigOptions vs _sprEmbConfigOptions (2026-02-19)

**Problem:** Clicking "Apply & Import" threw `ReferenceError: embConfigOptions is not defined`.
**Root cause:** `applyServicePricingReview()` referenced a local variable from `showServicePricingReview()` instead of the module-scope `_sprEmbConfigOptions`.
**Solution:** Changed `embConfigOptions?.fbPriceTiers` to `_sprEmbConfigOptions?.fbPriceTiers`.
**Prevention:** In single-file architecture, always verify which scope a function runs in.

## Fix: Console Spam from collectProductsFromTable Iterating Fee Rows (2026-02-11)

**Problem:** Console showed 12x `[collectProducts] Skipping row NaN` because `.fee-row` elements weren't excluded from the selector.
**Solution:** Extended selector to exclude `.fee-row` and `#empty-state-row`.
**Prevention:** When adding new non-product row types to `#product-tbody`, add their class/ID to the exclusion list.

---

## Pattern: EMB_DEFAULTS Constants Block for Embroidery Magic Numbers (2026-02-10)

**Problem:** `8000`, `5000`, `50` appeared 30+ times scattered across the embroidery quote builder.
**Solution:** Added `EMB_DEFAULTS` constants object at the top of the script section. Replaced 12 key instances.
**Prevention:** New embroidery defaults should be added to `EMB_DEFAULTS`.

---

## Problem: Review Import Pricing modal had misaligned columns (2026-02-08)

**Problem:** Products showed only 2 price columns with radios detached; Services had misaligned headers.
**Solution:** Converted flex layout to `<table>` with 4 columns. Added text-align fix for service radio cells.
**Prevention:** When building modal tables with radio+price columns, use `<table>` from the start.

---

## Problem: 71+ orphaned files in codebase (2025)

**Problem:** Duplicate files, backup versions, test files scattered everywhere.
**Solution:** Massive cleanup, established Top 8 Never-Break Rules.
**Prevention:** Rule #1: NO Version Suffix Files — use Git branches.

---

## Problem: Test files scattered in root directory (2025)

**Problem:** Confusion about which files are active vs test.
**Solution:** All test files must go in `/tests/`.
**Prevention:** Rule #2 in CLAUDE.md.

---

## Problem: LTM fee logic inconsistent between calculator and quote builder (2025)

**Problem:** Calculator shows one LTM fee, quote builder shows different amount.
**Root cause:** LTM fee logic appears in THREE separate places that weren't synced.
**Prevention:** Document all locations. Consider consolidating into shared function.

---

## Problem: Multiple config files causing confusion (2025)

**Problem:** Changed config in one file, but app used different file.
**Solution:** Use `/config/app.config.js` for all new code.
**Prevention:** ACTIVE_FILES.md marks legacy config as "Deprecate".

---

## Problem: Root directory JS files cause dependency issues (2025)

**Problem:** Moving files breaks index.html and cart.html.
**Solution:** Left files in root, documented the risk.
**Prevention:** ACTIVE_FILES.md warns: "DO NOT MOVE these files without updating all HTML references."

---

## Verified: Cap Calculator ↔ Pricing Engine Sync (2026-02-14)

**Finding:** All 3 systems (pricing engine, calculator page, pricing service) produce identical prices. Verified with live API data for Richardson 112 — all 5 tiers match.
**Key facts:** Cap rounding is `CeilDollar`. All cap tier margins identical (0.57). LTM bake-in confirmed.
**Prevention:** If cap margins ever differ by tier in Caspio, the pricing engine's single-margin approach would need updating.

## Bug: DECG-Only Quotes Blocked from Save/Print/Email/Copy (2026-02-08)

**Problem:** DECG-only quotes showed "Add products before saving" error because all items are service items and the filter removes them.
**Solution:** Updated all 4 guards to also check `collectDECGItems().length === 0`. Added DECG-only pricing path.
**Prevention:** When adding guard checks for "no products", always consider service-only items.

## Bug: DECG Totals Excluded from Subtotal in PDF/Save/Copy (2026-02-09)

**Problem:** Subtotal only summed SanMar products — missing DECG totals.
**Solution:** Added identical DECG aggregation block to all 3 output functions.
**Prevention:** The embroidery quote builder has 4 code paths that compute totals — changes must be mirrored in all 4.

## Bug: PDF/URL Quote Pricing Divergence from UI (2026-02-08)

**Problem:** Print PDF and Save & Get Link showed wrong/stale prices after refactoring.
**Solution:** Made all 3 functions (`recalculatePricing`, `printQuote`, `saveAndGetLink`) use identical patterns.
**Prevention:** When modifying `recalculatePricing()`, always check `printQuote()` and `saveAndGetLink()` for the same change.

## Bug: Per-Size Price Override Not Applied in PDF/URL Quotes (2026-02-08)

**Problem:** Manual price override works in UI but lost in PDF and Save outputs.
**Root Cause:** Pricing engine ignores `product.sizeOverrides`. UI works via a DOM post-processing hack.
**Solution:** Check `sizeOverrides[size]` in pricing engine before grouping. Skip LTM for overridden items.
**Prevention:** The pricing engine must respect ALL data collected by `collectProductsFromTable()`.

## Bug: AL Fee Row Shows Wrong Quantity (2026-02-06)

**Problem:** AL fee row displayed qty=5 when there were 26 garments. Total amount was correct.
**Root Cause:** Display code read `[0].quantity` instead of aggregating across all entries.
**Solution:** Replace all `[0].quantity` with `.reduce()` aggregation.
**Prevention:** When pricing engine returns per-product arrays, always aggregate for display.

## Bug: Stitch Count Changes Don't Update Prices (3 Bugs) (2026-02-06)

**Problem:** Changing primary logo stitch count showed no visible pricing change.
**Root Cause:** Missing fee display, no `input` event on stitch input, wrong property names in reset.
**Solution:** Added fee rows to HTML + display logic. Added `input` event listeners. Fixed property names.
**Prevention:** When refactoring fee display, verify the new approach is actually implemented.

## Bug: Cap Stitch Total Hardcoded to Zero (2026-02-06)

**Problem:** Cap stitch count above 8000 never produced an AS-CAP fee.
**Root Cause:** Line 1666: `capStitchTotal = 0` with comment "Caps have fixed 8K stitches." But UI has a cap stitch input.
**Solution:** Calculate `capStitchTotal` using same architecture as garments.
**Prevention:** When adding UI inputs, verify the full data flow: UI → object → pricing engine → display.

## Bug: AL Digitizing Not Included in Grand Total (2026-02-06)

**Problem:** Enabling AL digitizing ($100) showed fee in table but grand total didn't increase.
**Root Cause:** Two competing systems for AL state — dead code System B vs working System A. `logoConfigs` used dead code's empty array.
**Solution:** Build AL entries from `globalAL` state. Removed dead System B code.
**Prevention:** Two competing systems for the same feature = bugs. Delete the old code immediately when one supersedes another.

## Pattern: Bake LTM Fee Into Calculator 1-7 Column Prices (2026-02-06)

**Context:** Calculator pages previously showed "$50 small order fee" messaging. This was confusing.
**Change:** Both calculator pages now show all-in prices in the 1-7 column. Quantity picker updates cells dynamically. All LTM text removed from customer-facing content.
**Prevention:** When modifying calculator pricing display, remember 1-7 prices are dynamic based on qty picker.

## Problem: Programmatically Checking Checkbox Doesn't Trigger Line Items (2026-01-31)

**Problem:** ShopWorks import checked checkboxes visually, but line items never appeared.
**Root Cause:** Setting `checkbox.checked = true` only updates the DOM, not the JavaScript state that drives pricing.
**Solution:** After setting checkbox.checked, replicate both the state update AND the pricing function call from the native handler.
**Prevention:** Before setting ANY checkbox programmatically, search for its change handler and replicate both actions.

---

## Problem: DTF Quote Builder PDF showed wrong prices and duplicate subtotals (2026-01)

**Problem:** PDF base price showed $5.26 instead of $15.00. Extended size upcharges applied incorrectly. Two "Subtotal:" lines in PDF.
**Solution:** Fixed calculateUnitPrice() — added baseCost and moved upcharge before margin division. Made second subtotal conditional.
**Prevention:** When building PDF pricing data, always read displayed prices from DOM first.

---

## Problem: Calculator and quote builder show different prices (2025)

**Problem:** Sales rep quotes one price, customer sees different price.
**Solution:** Must test BOTH with identical inputs whenever pricing logic changes.
**Prevention:** Rule #8 in CLAUDE.md: SYNC CALCULATOR & QUOTE BUILDER PRICES.

---

## Problem: Embroidery PDF quote missing product descriptions (2026-01)

**Problem:** Product Description column empty on embroidery quote PDFs.
**Root cause:** Invoice generator expects `product.title` but embroidery builder only passed `productName`.
**Solution:** Added `title: row.dataset.productName || style` to `collectProductsFromTable()`.
**Prevention:** Always include `product.style`, `product.title`, `product.color` for invoice PDFs.

---

## Pattern: Customer-Facing Quote View Page & PDF Generation (2026-01-13)

Comprehensive pattern for building quote view pages and PDFs. Applies to all quote types.

**Key fixes applied:** PDF column overlap, print-friendly header, data deduplication, product image API returns object not array.

**When applying to other quote builders:** Copy structure, update quoteTypes mapping, modify type-specific details, ensure quote service saves all required fields.

---

## Problem: Comprehensive 2XL/XXL handling issues across quote builders (2026-01)

**Problem:** Multiple 2XL bugs: showing in wrong columns, unit price missing, not separated in PDF.
**2XL Rules:**
- `2XL` = `XXL` → SAME SIZE
- Goes in Size05 column (XXL)
- `SIZE06_EXTENDED_SIZES` should NOT include '2XL'
- `baseSizes` for PDF should NOT include '2XL' (it has upcharge)
- `extendedSizes` for PDF SHOULD include '2XL'

---

## Problem: OSFA and Cap Sizes Not Rendering in Quote View (2026-01-13)

**Problem:** Richardson 112 caps with OSFA sizing not displayed in quote view or PDF.
**Root Cause:** `buildProductRows()` only handled standard and extended sizes. OSFA wasn't in either array.
**Solution:** Added OSFA and cap sizes to `extendedSizes` array. Size06 (XXXL column) is the catch-all for ALL non-standard sizes.
**Prevention:** Always include OSFA, S/M, M/L, L/XL in the extended sizes array. Test with cap products.

---

## Problem: Rounding logic inconsistent (2025)

**Problem:** Different files used different rounding.
**Solution:** Standardized on half-dollar ceiling: `Math.ceil(price * 2) / 2`.
**Prevention:** All pricing must use half-dollar ceiling.

---

## Problem: Manual pricing override via URL could be exploited (2025)

**Problem:** Users could add `?manualCost=0.01` to URL and get low prices.
**Solution:** Added to security review.
**Prevention:** Only use for internal testing.

---

## Problem: WSL localhost doesn't connect to local server (2025)

**Problem:** `localhost:3002` works in Windows but not in WSL terminal.
**Solution:** Use WSL IP address instead of localhost.
**Prevention:** Documented in `/memory/LOCAL_DEVELOPMENT.md`.

---

## Problem: Git subtree push fails with "non-fast-forward" (2025)

**Problem:** `git push heroku main` fails from web/ folder.
**Solution:** Use `git subtree push --prefix web heroku main` from main repo root.

---

## Problem: Flask 404 after adding new routes (2025)

**Problem:** New Flask routes return 404, existing routes work.
**Root cause:** Old server process still running on port 5000.
**Solution:** Kill existing server, restart fresh.
**Prevention:** Always check for zombie Flask processes before debugging routes.

---

## Problem: CORS allows all origins in production (2025)

**Problem:** Security audit flagged this.
**Solution:** Restrict to specific origins in production.
**Prevention:** Check `config.js` CORS settings before deploying.

---

## Problem: SQL injection possible in Caspio queries (2025)

**Problem:** Security audit found injectable parameters.
**Solution:** Input sanitization functions that escape quotes, remove SQL keywords.
**Prevention:** Always use `sanitizeFilterInput()` for any user input going to Caspio.

---

## Problem: Stripe webhook could be spoofed (2025)

**Problem:** No signature verification.
**Solution:** Verify Stripe webhook signature before processing.
**Prevention:** `server.js` line 197 verifies signature. Never skip this check.

---

## Problem: XSS possible when rendering external data (2025)

**Problem:** User/external data rendered without escaping.
**Solution:** Use `escapeHTML()` helper when rendering via innerHTML.
**Prevention:** Documented in CLAUDE.md Security Checklist.

---

## Fix: XSS in email HTML templates (2026-02-12)

**Problem:** Customer data rendered unescaped in email HTML generation. Web view was safe but email was not.
**Solution:** Added `_escapeHtml()` as a class method. Applied to all 10 user-input interpolation sites.
**Prevention:** When generating HTML in ANY file, always escape user input.

---

## Fix: XSS in Embroidery Quote Builder — 4 Unescaped innerHTML Locations (2026-02-10)

**Problem:** Product colors, quote IDs, and search suggestions inserted into innerHTML without escaping.
**Solution:** Applied `escapeHtml()` to 4 locations.
**Prevention:** grep for `innerHTML.*\$\{` periodically.

---

## Fix: Pricing API Fetches Missing response.ok Checks — Silent Bad Data (2026-02-10)

**Problem:** 4 fetch calls went straight to `.json()` without checking HTTP status.
**Solution:** Added `if (!response.ok) throw new Error(...)` before each `.json()` call.
**Prevention:** Every `fetch()` call must check `response.ok` before `.json()`.

---

## Pattern: Multi-location store fallback resolution (2025)

**Description:** AMC, Hops n Drops have 100+ locations each.
**Pattern:** 3-level fallback: exact match, case-insensitive match, ZIP code fallback.

---

## Pattern: OAuth token caching with expiry buffer (2025)

**Pattern:** Cache token with 60-second buffer before expiry.

---

## Pattern: Prefixed console.log for debugging (2025)

**Pattern:** `[ModuleName] Message` format. grep-friendly, identifies source module.

---

## Pattern: Quote ID format for phone reference (2025)

**Pattern:** `[PREFIX][MMDD]-[sequence]`. Domain-aware IDs are easier to read over phone than UUIDs.

---

## Pattern: Structured error responses (2025)

**Pattern:** `{"error": "Descriptive message", "code": "ERROR_CODE"}`. Never return generic 500 errors.

---

## Pattern: Parallel batch operations for bulk API calls (2026-01-14)

**Description:** Sequential API calls cause UI to hang when processing many items.
**Pattern:** Use `Promise.all()` with batched operations (batch size 10).

---

## Insight: DECG Upsell Opportunity (2026-02-15)

**Analysis:** 22 DECG instances across 104 orders. Reps charged $15-25/piece flat instead of 2026 tiered rates. Estimated $800-1,500 left on the table.
**Bigger Opportunity:** Many DECG customers could have been sold SanMar products + embroidery for higher margin.

---

## Insight: LTM Fee Revenue Opportunity - $43K Annually (2026-02-02)

**Key Findings:** 862 of 1,310 orders (65.8%) are under 24-piece minimum. Revenue projection: $30K-$43K/year.
**Takeaway:** Consistent LTM fee enforcement could add significant revenue.

---

## Insight: ShopWorks Data Entry Quality — 98+ Parser Workarounds (2026-02-15)

**Analysis:** 98+ workarounds for messy data entry: 13 service code aliases, description-based detection, separator/label suppression, address typo handling.
**Root causes:** Empty part numbers, person names entered as line items, lowercase state abbreviations, mixed decoration types.
**Prevention:** Created data entry guide and training documents.

---

## Bug: E2E Batch Runner Used Frontend-Only Route Against Backend Proxy (2026-02-13)

**Problem:** E2E verify/cleanup calls to `/api/public/quote/:quoteId` returned 404 from the backend proxy.
**Solution:** Changed to fetch session and items separately via Caspio REST filter endpoints.
**Prevention:** Always check which server a route lives on.

---

## Bug: Full Back Tier Pricing Only Applied to AL Path, Not Primary Logo (2026-02-18)

**Problem:** Primary logo Full Back still used hardcoded formula instead of tier pricing.
**Root Cause:** TWO separate code paths: primary logo and AL Full Back. Only AL was updated.
**Solution:** Updated both code paths to check `fbPriceTiers`. Added `_getFBTierPrice()` helper.
**Prevention:** When modifying pricing behavior, search for ALL code paths that calculate that feature's price.

---

## Bug: compare-pricing.html Had Broken Custom Cap Detection (2026-02-19)

**Problem:** CP90 beanie showed Cap Embroidery pricing only instead of garment method cards.
**Root cause:** Inline `isCap` detection diverged from `ProductCategoryFilter.isStructuredCap()`.
**Solution:** Added `product-category-filter.js` and replaced inline detection.
**Prevention:** Any page that distinguishes garment vs cap MUST use `ProductCategoryFilter`.

---

## Pattern: Caspio DataPage Host-Page Styling (2026-02)

**Description:** How to style/restructure Caspio DataPage results from the host page.
**Key patterns:** Caspio embeds inject HTML into host DOM (NOT iframe). Use `!important` on CSS overrides. MutationObserver for async rendering. Caspio orphan `<dd>` quirk for file fields.

---

## Bug: Caspio FILE fields are read-only via REST API (2026-03-12)

**Problem:** PUT returned 400 "AlterReadOnlyData" when writing to `CDN_Link_Two`.
**Root cause:** CDN_Link fields are FILE type — read-only via REST API.
**Solution:** Changed to text URL fields for API writes.
**Prevention:** FILE fields can be read but never written to via API.

## Bug: Box Search API eventual consistency causes duplicate folder creation (2026-03-12)

**Problem:** `findCustomerFolder()` returned null for folder created minutes ago.
**Solution:** Added 409 conflict handler. Added in-memory `folderCache` Map.
**Prevention:** Always handle 409 on Box folder/file creation.

## Pattern: Box Client Credentials Grant for server-to-server uploads (2026-03-12)

**Pattern:** Client Credentials Grant with enterprise subject. Token cached with 60s buffer. Service Account must be Editor on target folders. Shared links use `access: 'open'`.

## Bug: Heroku H12 timeout on Box folder listing (2026-03-12)

**Problem:** Upload timed out after 30s — paginated ALL items instead of using search.
**Solution:** Replaced folder pagination with Box Search API.
**Prevention:** Never paginate large Box folders. Use Search API.

## Bug: `const` + `var` redeclaration SyntaxError crashes detail page (2026-03-13)

**Problem:** Art request detail page stuck on "Loading..." spinner.
**Root cause:** `const contactEmail` on line 224, then `var contactEmail` on line 266 — SyntaxError.
**Solution:** Removed the `var` redeclaration.
**Prevention:** Search for prior declarations before adding variables.

## Bug: Async function silently swallows null reference (2026-03-13)

**Problem:** "Send Mockup" button did nothing. No error in console.
**Root cause:** Async function's TypeError caught as unhandled promise rejection — never logged.
**Solution:** Added the missing HTML element.
**Prevention:** Always null-guard DOM lookups in async functions.

## Bug: renderNotes crashes on second call — innerHTML destroys child elements (2026-03-13)

**Problem:** Notes refresh failed after first render.
**Root cause:** `container.innerHTML = ''` destroyed a child element that `getElementById` later tried to find.
**Solution:** Generate empty message HTML dynamically instead of relying on persistent DOM element.
**Prevention:** Never use `getElementById` for children of a container you clear with `innerHTML = ''`.

## Bug: Email detail_link uses window.location.origin — breaks on custom domains (2026-03-13)

**Problem:** "View & Approve" links in emails 404'd because sender was on teamnwca.com custom domain.
**Solution:** Hardcoded production Heroku URL for all email links.
**Prevention:** Never use `window.location.origin` for links in emails.

## Bug: buildColumnMap() else-if chain — generic match overwrites specific column (2026-03-14)

**Problem:** Company name not showing on AE gallery cards.
**Root cause:** Generic `indexOf('company')` matched both "Company" and "Company Mockup" — specific match needed first.
**Solution:** Moved specific match BEFORE generic match.
**Prevention:** In else-if chains, always order matches from MOST SPECIFIC to LEAST SPECIFIC.

## Bug: Caspio thread-colors API response parsed incorrectly (2026-03-19)

**Problem:** Palette returned 0 colors. Iterating the response dict yielded keys not color objects.
**Solution:** Extract `data.get('colors', data)` from envelope. Don't cache empty results.
**Prevention:** When consuming APIs with envelope format, always extract the inner array.

## Bug: Variable scoping — referencing outer `notes` inside sub-render functions (2026-03-20)

**Problem:** Pages crashed with "notes is not defined" inside sub-functions.
**Solution:** Added `notes` as parameter to sub-functions.
**Prevention:** When adding code that references variables from a parent function, verify the variable is in scope.

## Bug: Non-image files (EPS, PDF) opened in image lightbox instead of downloading (2026-03-13)

**Problem:** EPS/PDF artwork cards opened broken lightbox.
**Solution:** Branch click handler by `isImage` flag: images → lightbox, non-images → `window.open()`.
**Prevention:** When building click handlers for mixed file types, check if the viewer supports the format.

---

## Cache Buster Versions — Stale JS Causes Invisible Bugs (2026-03-23)

**Problem:** DTF LTM control panel not appearing after code changes. Browser served cached old version.
**Root cause:** `<script src="file.js?v=20260321">` version stamp not updated.
**Solution:** Updated all `?v=` stamps. Restarted Express server.
**Prevention:** After modifying ANY shared JS/CSS file, update the `?v=` cache buster in ALL HTML files.

---

## 429 Rate Limit — Cache API Responses for Size Detection (2026-03-23)

**Problem:** Console showed 429 when adding products with extended sizes.
**Root cause:** `detectAndAdjustSizeUI()` fetched API on every color selection with ZERO caching.
**Solution:** Added `sizeDetectionCache` and `productColorsCache` Maps.
**Prevention:** Any API call triggered by user interaction should be cached if data doesn't change within a session.

---

## DTG/SCP Notes Field Overwrite (2026-03-23)

**Problem:** Saved DTG/SCP quotes lost print location, tier, and project name data.
**Root cause:** `Notes` field assigned twice — first as JSON, then overwritten by plain string.
**Solution:** Merged user notes INTO the JSON object as `userNotes` property. Added missing `TaxRate` and `SalesRepEmail` fields.
**Prevention:** Never assign the same property twice in an object literal.

---

### SanMar PO↔ShopWorks WO Number Correlation (archived 2026-04-08)
**Problem:** Style matching produced 39 false positives — repeat customers matched to older orders with same styles.
**Root Cause:** Single-style score:1 matches with no way to distinguish between 5+ orders for the same customer with the same style.
**Solution:** PO numbers correlate with WO numbers: `WO ≈ PO + 28856 (±200)`. Used as tiebreaker.
**Prevention:** When tiebreaking style matches, use PO↔WO proximity, not dates.

---

### Parent Row Qty Double-Counting — Second Code Path in 2XL Handler (archived 2026-04-14)
**Problem:** DTG/SCP parent Qty included child row quantities even after fixing `onSizeChange()`.
**Root Cause:** TWO code paths update parent Qty — the 2XL handler explicitly added child quantities back.
**Solution:** Removed child quantity addition from 2XL handler in each builder.
**Prevention:** Grep for ALL places that update the same DOM element. Multiple paths = inconsistency.

---

### SCP recalculatePricing() Crash — primaryPricing Out of Scope (archived 2026-04-13)
**Problem:** Screenprint sidebar showed Total Pieces: 0 and $0.00. `ReferenceError: primaryPricing is not defined`.
**Root Cause:** Nudge savings calc referenced loop-scoped `const` variables after the loop closed.
**Solution:** Capture needed values in outer-scope variables before the loop.
**Prevention:** Post-loop summaries must use outer-scope captures. Test with extended sizes (2XL+).

---

### DTF Garment Base Cost From Arbitrary Record — Pricing Inversion (archived 2026-04-19)
**Problem:** DTF showed Long Sleeve cheaper than Short Sleeve (prices inverted).
**Root Cause:** `firstDetail.CASE_PRICE` from `/api/product-details` returns unsorted per-color x size records.
**Solution:** Use `blankBundle.sizes` from BLANK pricing-bundle which aggregates correctly.
**Prevention:** Never use `firstDetail.CASE_PRICE` — use pricing-bundle or base-item-costs endpoints.

---

### DTF Parent Row Qty Double-Counts Child Rows (archived 2026-04-19)
**Problem:** Parent Qty=70 but Total=$585 didn't match. Standard qty was 45, child had 25.
**Root Cause:** `onSizeChange()` added child quantities to parent display, but pricing only uses standard sizes.
**Solution:** Removed child row aggregation. Parent shows standard sizes only; children display independently.
**Prevention:** Parent Qty = standard sizes only. `getTotalQuantity()` is truth for combined totals.

---

### Extra Stitch Charges Double-Counted in Unit Price AND Line Item (archived 2026-04-19)
**Problem:** J790 @ 9K stitches: $74.25 in matrix PLUS separate AS-GARM line item. Customer pays twice.
**Root Cause:** `calculateProductPrice()` included stitch cost AND pricing engine created separate fee.
**Solution:** Pass `0` for stitch cost — show ONLY as separate AS-GARM/AS-CAP line items.
**Prevention:** Extra charges NEVER embedded in unit price. Always separate fee line items.

---

### Wrong Pricing Displayed Silently (archived 2026-04-20)
**Problem:** Incorrect prices shown to customers with no error visible.
**Root Cause:** API failed but code used cached/fallback data silently.
**Prevention:** Rule #4: NO Silent API Failures. Wrong pricing is WORSE than showing an error.

---

### Send Mockup Button Missing in "Awaiting Approval" Status (archived 2026-04-20)
**Problem:** Steve couldn't re-send mockups after uploading new ones. The "Send Mockup" button was renamed to "Send Reminder" when status was "Awaiting Approval."
**Root Cause:** Single button element (`ard-btn-send-mockup`) was repurposed — label changed to "Send Reminder" and click handler switched to `sendMockupReminder()` instead of `showSendForApprovalModal()`.
**Solution:** Added separate `ard-btn-send-reminder` button. "Send Mockup" always opens the full approval modal. "Send Reminder" only appears alongside during "Awaiting Approval."
**Prevention:** Don't repurpose buttons by renaming — add separate elements when two distinct actions are needed.

---

### Mockup Detail — Replace Button Downloads File Instead of Opening Popover (archived 2026-04-23)
**Problem:** AE clicks the teal "Replace" button on the reference file slot, but instead of opening the upload popover, the file URL opens in a new tab (download behavior).
**Root Cause:** The slot's click handler (`slotEl.addEventListener('click', ...)`) calls `window.open(url, '_blank')` for non-image files and `openLightbox(url)` for images. The exclusion list (`e.target.closest(...)`) checked for `.pmd-slot-remove`, `.pmd-slot-download`, `.pmd-slot-version-badge`, and `.pmd-version-dropdown` — but NOT `.pmd-slot-replace`. So the Replace button's delegated click handler fired (opening popover), but the slot's direct click handler ALSO fired (opening URL).
**Solution:** Added `.pmd-slot-replace` to the exclusion list in both slot click handlers (image path line 1213, non-image path line 1253).
**Prevention:** When adding new interactive buttons inside gallery slots, ALWAYS add their class to the slot click handler's exclusion list. Both the image and non-image paths have separate exclusion lists that must stay in sync.
