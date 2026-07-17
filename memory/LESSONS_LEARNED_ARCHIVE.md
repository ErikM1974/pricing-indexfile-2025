# Lessons Learned — Archive
> Historical entries moved from LESSONS_LEARNED.md on 2026-03-24.
> These are resolved issues unlikely to recur. Kept for reference.

---

## PowerShell 5.1 Get-Content/Set-Content round-trip corrupts UTF-8 repo files (2026-06-10) (archived 2026-07-06)
**Problem:** A `(Get-Content -Raw) -replace ... | Set-Content` one-liner on embroidery-quote-service.js turned every em-dash/arrow into mojibake (`â€”`, `â†’`) across the whole file.
**Root Cause:** PS 5.1 reads BOM-less UTF-8 as ANSI and `-Encoding utf8` writes UTF-16-adjacent BOM'd output — the decode/re-encode mangles multi-byte chars file-wide, not just on edited lines.
**Solution:** `git checkout --` the file and re-applied every change with the Edit tool (encoding-safe). Verified with `git diff | Select-String "â€"` → 0.
**Prevention:** NEVER round-trip repo source files through PS 5.1 Get-Content/Set-Content for find-replace — use the Edit tool (replace_all) or node. After ANY scripted bulk edit, grep the diff for `â€|Ã|â†` before continuing.

## Routes outlive files — 7 zombie sendFile routes + a live nav item pointed at deleted pages (2026-06-11) (archived 2026-06-17)
**Problem:** Customer-facing nav item "Marketing" (index.html + webstore-info footer) 404'd; server.js still had `app.get` → `sendFile` for 7 files that no longer exist (marketing, top-sellers-catalog, index-new, embroidery-pricing-standardized/-professional, test-api, test-catalog-layout). Legacy cart.html (Bootstrap 4) + pages/order-confirmation.html were orphaned (zero inbound links) but still served at `/cart` — an unmaintained checkout flow with stale pricing logic a customer could reach by URL.
**Root Cause:** Files were deleted over months without removing their server.js routes or grepping for inbound links (predates the file-lifecycle automation hook).
**Solution:** Removed the 7 zombie routes; `/cart` → 301 `/pages/sample-cart.html`; deleted cart.html + order-confirmation.html; flagged their now-dead root JS/CSS (cart*.js, order-form-pdf.js, root pricing-matrix-api.js, cart-styles.css) in ACTIVE_FILES.md; repointed webstore-info/inventory-details dead links to mailto.
**Prevention:** On ANY page delete: grep for the filename AND its route in server.js (route TOC at top), and check `scripts/safety-tools/validate-critical-paths.js` (it asserted cart.html as a critical path). Full customer-page inventory: memory/CUSTOMER_SITE_REDESIGN_2026-06_FINDINGS.md.

## Builder push→import→sync-back loop VERIFIED end-to-end + cache-masking phantom-bug (2026-06-01) (archived 2026-06-11)
**Problem:** Needed to prove the full DTG-parity loop for DTF/SCP: push a quote → it imports into ShopWorks → a change in ShopWorks flows back into the quote. Two scares along the way: (1) immediately after a successful push, `/api/manageorders/getorderno/{ExtOrderID}` returned `count:0` — looked like the OnSite NWCA-DTF/SCP integration wasn't importing the orders (suspected config gap). (2) After the sync ran and returned `success:true, status:"Imported", shopWorksOrderNumber:142001` with the full snapshot, reading the quote back via `/api/quote_sessions?QuoteID=...` showed `Status:Open`, `ShopWorks_Order_Number:None`, empty `ShopWorks_Snapshot` — looked like the snapshot PUT silently failed to persist.
**Root Cause:** Both were false alarms. (1) NOT a config gap — just **timing**: the OnSite→ManageOrders import (FileMaker MO-UPDATE, every 15 min, 7am-7pm Pacific) took ~24 min, after which `getorderno` returned `count:1, id_Order:142001` (DTF) / `142000` (SCP). (2) NOT a persistence bug — the proxy `GET /api/quote_sessions` is **CACHED** (in-memory, keyed on the filter). My read-backs via `?QuoteID=` hit the stale pre-sync cache. Reading by PK_ID via `GET /api/quote_sessions/:id` (uncached, `q.where=PK_ID=`) showed the truth: `ShopWorks_Status:Imported`, `ShopWorks_Order_Number:142001`, `ShopWorks_Snapshot:` 2270 bytes — the write had worked all along. The PUT route (`src/routes/quotes.js:487`) correctly updates by PK_ID with no field whitelist.
**Solution:** Loop confirmed working with zero code changes needed beyond the already-deployed `deriveExtOrderIdForSync` fix (server.js, frontend `f58dab42`): cloned+pushed DTF0601-9301→`DTF-2026-0601-9301`→WO#142001 and SP0601-9301→`SCP-2026-0601-9301`→WO#142000, both WITH artwork (`Designs[].Locations[].ImageURL` survived MO→SW conversion, `id_Artist:224` auto-assigned, `id_DesignType` 8/1, PC54_2X/29M_2X suffixes, SPSU+Art fee lines, both Notes, order types 18/13 honored). The hourly cron (`Status='Processed' OR PushedToShopWorks IS NOT NULL`) keeps them syncing automatically.
**Prevention:** (1) After a push, `getorderno count:0` is EXPECTED for ~15-30 min — the order converts in MO instantly but only appears in `/v1` after the next OnSite FileMaker import cycle (business hours only). Don't diagnose an "integration gap" until you've waited 2+ cycles. (2) The proxy `/quote_sessions` LIST GET is cached — to verify a just-written row, read by PK_ID (`/quote_sessions/:id`) or you'll see stale data and chase a non-existent write bug. The dashboard/`/full` read through the same cache, so a fresh sync has a brief (cache-TTL) staleness window before it shows — not data loss. (3) When a sync endpoint returns `synced:true` with a snapshot in the response body AND only returns success when the Caspio PUT doesn't throw (server.js:5107-5110), trust it over a cached LIST read.

---

## Richardson page CSS rewrite — JS-emitted class drift left the cap browser dead + unstyled (2026-05-29) (archived 2026-06-11)
**Problem:** On `/calculators/richardson-2025.html` the "Browse All Caps" accordion never opened, and even when forced open the cap cards were unstyled. Separately, ~75% of `richardson-2025-styles.css` (4148 lines) was dead code for a removed quote-builder (confetti, embroidery-needle loader, galleries), and the live header used a gradient-clipped title + an infinite floating background — the page looked juvenile.
**Root Cause:** Class-name drift between JS-generated DOM and CSS. The accordion JS toggled `.expanded` on `#capBrowserContent` but the CSS only revealed it via `.cap-browser-content.open`. The JS rendered cards with `.cap-style/.cap-category-badge/.cap-card-body/.cap-price` but the CSS targeted older names (`.cap-style-number/.cap-price-badge/...`). Both fail silently — no console error, the feature just sits dead.
**Solution:** Rewrote the CSS from scratch (~640 lines) against the LIVE HTML + the exact JS-emitted class names, token-based on the shared brand vars. Reveal keys off `.expanded`; cards styled by the real classes. Used a plain `display:none/block` accordion toggle — a `max-height` transition does NOT advance in the headless preview (no compositor ticks) and could also clip a tall grid for real users.
**Prevention:** When JS builds DOM, the CSS contract IS the JS class string — grep the JS `innerHTML`/`className` for exact names before and after any refactor; renaming one side silently dead-styles the other. After deleting a feature, gut its CSS too (CLAUDE.md dead-code rule). Verify show/hide with computed `display` + `getBoundingClientRect().height`, not screenshots. A11y: green text/white-on-green needs `#2f7d37` (5.1:1), never brand `#4cb354` (2.66:1, fails AA).

---

## DTF Quote Builder → ShopWorks push dropped all fees, ignored customer #, sent undefined note types + 1010% tax (2026-05-29) (archived 2026-06-07)
**Problem:** The DTF "Push to ShopWorks" button (Phase 8 scaffold) was live to reps but produced wrong orders: shipping/discount/rush/art/graphic-design charges were DROPPED ($0 in SW), the rep's customer # was ignored (orders landed on EMB fallback customer 3739), ship-to used the wrong output schema, every Note had an undefined `Type`, and the tax note read "1010%". DTG (the rep's reference point) was fine because it uses the mature `/api/submit-order-form` inline-form flow; only EMB had a correct quote-push. Shipped both repos: proxy Heroku v761, index Heroku v1196.
**Root Cause:** `dtf-push-transformer.js` was copied from EMB, which reads fees from `EmbellishmentType:'fee'` line items — but `dtf-quote-service.js` stores fees as SESSION columns and writes only `'dtf'` garment items, so item-based fee extraction always returned 0. The service never persisted CustomerNumber/ShipTo*/PO/dates; the revision (updateQuote) path also dropped charge fields; edit-load read wrong column names (`CustomerPhone`/`PONumber`/`ShipAddress` vs saved `Phone`/`PurchaseOrderNumber`/`ShipToAddress`). Transformer used `NOTE_TYPES.Order/Art/Production` (real keys are UPPERCASE `.ORDER/.ART/.PRODUCTION`) → undefined Type (aborts push per the 4-valid-types rule), and fed DTF's percentage tax rate (10.1) to a helper expecting a decimal (0.101).
**Fix:** Kept DTF's session-level fee model (NOT EMB's fee-items — that double-counts on the DTF invoice, which also reads session fees) and made the DTF-specific transformer read fees from the session: ShippingFee→cur_Shipping, Discount→TotalDiscounts, RushFee/ArtCharge/GraphicDesignCharge→LinesOE on `RUSH`/`Art` parts. Service persists CustomerNumber + ship-to + dates + PO + TaxAmount on BOTH save & revision paths via a shared `_orderEntryFields()`. Builder captures `#customer-number`; edit-load mappings corrected + restore customer#/shipping/special-notes; push button reveals on load of an editable quote. Transformer: EMB ShippingAddresses schema, uppercase `NOTE_TYPES.*`, `toRateDecimal()`, `id_DesignType` from config. Verified the whole payload with a throwaway Node harness.
**Prevention:** When copying a transformer from another method, confirm the SOURCE data model matches — EMB stores fees as items, DTF stores them on the session; identical transformer shape, opposite source. A "Send to ShopWorks" feature is NOT done when the button exists — trace the save→transform→push contract field-by-field; a preview/echo harness catches dropped money, undefined note Types, and 1010% tax in seconds. `NOTE_TYPES` keys are UPPERCASE; a bad/undefined Type aborts the push. DTF session tax rate is a PERCENTAGE (10.1), decimal elsewhere — normalize at the boundary. Still pending Erik: OnSite `id_OrderType`/`id_DesignType` placeholders (21=Custom Embroidery / 5) — orders functional + attached to the real customer, just labeled "Custom Embroidery" until set.

---

## Embroidered Emblem AI — save-path mis-pricing, auto-open token burn, OneDrive edit reverts (2026-05-29) (archived 2026-06-07)
**Problem:** Audit of `/calculators/embroidered-emblem/` found: (1) the save path hardcoded WA tax at 10.1% and silently added it to the saved `/quote/:id` total — but the emblem email is PRE-TAX, so the rep emailed $X and the saved quote showed $X+tax; (2) `quote_items` POST failures were swallowed with `console.warn`, yet the code still set `savedQuoteID` and handed out a share link → a customer-facing quote missing line items; (3) `digFee = Number(amount) || 100` forced a legit $0/waived fee back to $100; (4) the chat auto-opened on EVERY load and fired a Claude call + burned a PATCH sequence number before the rep typed anything, on an unthrottled endpoint; (5) `openChatPanel()` early-returned on `!pricingData`, so a failed grid fetch silently bricked the only CTA.
**Root Cause:** Save re-derived totals independently of the AI card/email; falsy-`||` on a money field; a cosmetic greeting was coupled to a backend call; the chat was gated on a reference-grid fetch it doesn't even use (it prices server-side).
**Solution:** Persist the PRE-TAX total the rep saw (tax is applied downstream at invoice, mirroring the MO push `TaxTotal:0`); collect line-item failures and refuse `savedQuoteID`/share-link on any failure, retry-safe via `sessionSaved` + `savedItemLines`; `?? `/null-check the fee; render a STATIC client-side greeting and only call Claude on the first real rep message; drop the `!pricingData` guard. Backend (`contract-emblem-ai.js`) now adds a 10-min cache TTL + surfaces `pricingSource:'inline'` when Caspio fell back, and a shared `aiChatLimiter` (120/min/IP) guards every `/api/*-ai` route. Deleted the 4 dead pre-AI files. A11y: `role=dialog`/`aria-modal`/background-`inert` focus trap + focus-return; streaming no longer floods `aria-live` (dedicated status node announced once/turn).
**Prevention:** Persist the numbers the customer was SHOWN — never re-derive a different total at save. Never `||`-default a money field where 0 is valid (use `??`/null-check). A cosmetic greeting must never cost a backend call. Don't gate an AI chat on a reference fetch it doesn't consume. **OneDrive gotcha (recurring):** this project lives under `OneDrive\`, so Edit-tool writes can apply-then-silently-revert on a sync cycle (passed `node --check`, then reverted) — for edit-heavy sessions, pause OneDrive syncing first (see `feedback_onedrive_edit_silent_fail`). Frontend on `develop` (not yet deployed); backend needs a separate caspio-pricing-proxy deploy.

---

## Company-name field on SCP/DTF/EMB had no autocomplete — sidebar also too narrow (2026-05-26) (archived 2026-06-07)
**Problem:** Reps typed "aaberg" in the COMPANY field on Screen Print/DTF/EMB expecting suggestions (the way DTG works) — nothing happened. Right sidebar also felt cramped at 300px on wide monitors; 2-col NAME/EMAIL/COMPANY/SALES-REP grid clipped long sales-rep names.
**Root Cause:** SCP/DTF/EMB share a Customer panel with a "FIND CUSTOMER" search box ABOVE plain manual-entry fields below. `CustomerLookupService.bindToInput()` was only wired to `#customer-lookup` (FIND CUSTOMER), not `#company-name`. DTG works because its `dtg-inline-form.js` renders ONE combobox (`#dtgCompanyInput`) — the company field IS the search field. So when reps switched between builders, the same keystrokes that worked on DTG produced nothing on the other 3.
**Fix:** (a) Added a second `customerLookup.bindToInput('company-name', { onSelect })` call per builder. Both bindings share an extracted `applyContact` helper, so selecting from EITHER input populates name/email/company/etc + surfaces CRM banners. The COMPANY-binding's onSelect also writes to `#customer-lookup` to keep the two boxes in sync. (b) `.power-sidebar { width: 300px }` → `width: clamp(360px, 26vw, 500px)` in `quote-builder-common.css`; dropped DTF's `width: 320px` override; EMB override updated to `min-width: 360px; max-width: 600px`. `sidebar-resize.js` `minWidth` 260→360, `maxWidth` 700→600, `resetWidth()` clears inline style (lets CSS clamp take over) instead of setting `300px`. (c) `#company-name-dropdown { right: auto; min-width: 280px; width: max-content; max-width: 360px }` in `customer-lookup.css` so the dropdown breaks out of its narrow 2-col grid cell — verified showing "Aaberg's Rentals" without clipping.
**Prevention:** When the Customer panel has both a dedicated search field AND a separate company input, BOTH need autocomplete bindings — reps don't pause to wonder which one is "the search box." If a future builder adopts the DTG-style single-combobox pattern, kill the FIND CUSTOMER field entirely rather than leaving both. `CustomerLookupService` instances are safe to bind to multiple inputs (independent dropdowns keyed by `${inputId}-dropdown`). For any per-builder CSS that overrode the shared `.power-sidebar` width with a hardcoded value, remove the override and inherit the clamp() baseline.

---

## EMB chat panel FOUC — white block flashed over Ask button on load (2026-05-25) (archived 2026-06-07)
**Problem:** EMB quote builder showed a white box overlaying the "✨ Ask" floating button for ~2-3 seconds on initial page load, then disappeared.
**Root Cause:** `sticker-pricing-page.css` (which holds `.ai-chat-panel` + `.floating-quote-btn` styles) was loaded at line 1419 — RIGHT NEXT TO the chat panel HTML — instead of in `<head>`. So the `<aside class="ai-chat-panel">` rendered as an unstyled white default block element for one repaint cycle before the CSS caught up. DTG didn't have this bug because its `<link>` for the same file is on line 13 (in `<head>`).
**Solution:** (a) Moved the `<link>` to `<head>` alongside the other stylesheets. (b) Added `hidden` HTML attribute to BOTH `<aside class="ai-chat-panel">` and `<div class="ai-chat-backdrop">` for belt-and-suspenders protection. (c) Updated `embroidery-chat.js` `openChatPanel()` to call `panel.removeAttribute('hidden')` (and same on backdrop) so the CSS slide-in transform can animate the panel into view. Without that, `hidden`'s `display: none` would block the transform from showing the panel.
**Prevention:** ALL stylesheets MUST load in `<head>` — never inline a `<link>` next to the HTML it styles, even if it feels co-located. For any element that's initially hidden via CSS (transforms, opacity, off-screen positioning), also add the HTML `hidden` attribute so it's invisible from byte zero. The JS that shows it must call `el.removeAttribute('hidden')` before adding the visible class. Pattern applies to all 4 builders — if/when DTF/SCP get chat panels, mirror this setup. Shipped: `d0f66dc5` (develop), `04417690` (main, Heroku v1175).

---

## Phase 11.3.5 + 11.4 + 11.5 + 11.6 — DTG parity + post-push edit lock (2026-05-24) (archived 2026-06-07)
**Problem:** DTG quote builder lagged the other 3 on basic UX features (no Print Quote button, no Email Quote button, no edit-reopen for pre-push revisions). Separately, no UI guard prevented reps from editing a quote that was already in ShopWorks — risking silent divergence between our app and SW.
**Root Cause:** DTG's architecture is fundamentally different from EMB/DTF/SCP: DTG uses a chat-panel-driven save flow (dtg-quote-page.js) that wraps the inline form (dtg-inline-form.js), while EMB/DTF/SCP are traditional form pages with save/print/email in a footer area. So shared patterns from EMB/DTF/SCP couldn't be copy-pasted — DTG needed its own implementation that fit the chat+inline-form architecture. For the edit-lock, the dashboard's Edit button + each builder's edit-mode loader needed coordinated guards to enforce the one-way SW sync rule at the UX layer.
**Solution:** (a) **11.3.5 Post-push edit lock**: New `assertQuoteEditable(session)` helper in `quote-builder-utils.js` returns false (after alert + redirect to `/quote/:id`) when session.Status is `Processed`, `Cancelled_in_ShopWorks`, `Payment Confirmed`, `Payment Confirmed - ShopWorks Failed`, or `Pending Payment`. Wired into all 4 builders' edit-load paths. Dashboard's Edit button replaced with a disabled lock icon for the same statuses + defense-in-depth check in `editQuote()`. (b) **11.4 DTG Print**: New `dtgPrintQuote()` in dtg-inline-form uses the shared `EmbroideryInvoiceGenerator` from `embroidery-quote-invoice.js`; works from current state without requiring a saved quote. (c) **11.5 DTG Email**: New `dtgEmailQuote()` calls shared `emailQuote()` helper; requires the chat panel's "Save & share link" to have set `aiState.savedQuoteID` first. (d) **11.6 DTG Edit-reopen**: New `loadSavedDtgQuoteForEdit(quoteId)` fetches `/api/quote-sessions/{id}/full`, runs the lock guard, parses Notes JSON for customer + designNumber, rebuilds rows from quote_items, stashes editing context on window globals so the save path (in dtg-quote-page.js) branches to a PUT-existing-session + replace-items revision flow when `window._dtgEditingQuoteId` is set.
**Prevention:** When a builder's architecture differs from the gold-standard pattern (DTG's chat-panel-driven save vs EMB/DTF/SCP's form-page save), copy the *intent* not the *code*. Each builder gets its own implementation that fits its architecture, but they all call the same shared helpers (`assertQuoteEditable`, `emailQuote`, `EmbroideryInvoiceGenerator`) for the cross-builder behavior. Document the architectural difference in code comments so future devs don't try to force one pattern onto the other. Lock guards belong at BOTH the dashboard entry (prevents the common case) AND the builder's edit-load (catches bookmarks / direct URLs). Shipped in commits: 26a6fb9d (lock), 8989748e (Print + Email), 71f0c308 (edit-reopen).

---

## Phase 11.3 — rich-mode artwork upload across EMB/DTF/SCP (2026-05-24) (archived 2026-06-07)
**Problem:** Quote builders for EMB/DTF/SCP let reps upload reference artwork (Phase 9), but the metadata stopped at "files only" — no design name, no per-file placement, no link to the ShopWorks Designs[] payload. DTG's order form inline section had the rich pattern; the three quote builders did not. Erik's unified-UX directive ("same features across all 4 builders") required closing the gap.
**Root Cause:** `shared_components/js/artwork-upload.js` was intentionally minimal at first (Phase 9 charter: "reference art the rep saw, no SW auto-creation"). DTG's pattern in `dtg-inline-form.js:2727+` had the richer fields. Builders that wanted rich UX needed to either (a) copy DTG's pattern locally (anti-pattern — violates unified-UX rule) or (b) the shared widget needed an opt-in rich mode.
**Solution:** Extended `artwork-upload.js` with backwards-compatible `opts.designName` + `opts.placements`. New API: `getDesignName()`, `setDesignName()`, `isValidForPush()`. Each builder passes its own placement list (DTF: 9, SCP: 7, EMB: 9). Push transformers in proxy now follow a 3-branch chain: existing id_Design # → new design with art (Designs[{name, Locations[]}]) → empty. EMB-specific twist: persistence schema decision was deferred — chose to repurpose `ImportNotes` column from `[]` to `{importNotes:[], referenceArtwork:[], newDesignName:''}`; proxy reader handles BOTH shapes for backwards compat with pre-Phase 11.3 quotes.
**Prevention:** When you find a feature where DTG has the gold standard and others have a stub, FIRST upgrade the shared module with opt-in args (don't fork). When you need to persist new fields in EMB's plain-text Notes column, the next-best slot is `ImportNotes` (existing JSON column with limited consumers) — but always extend the proxy parser to handle the legacy shape first to avoid breaking pre-migration quotes. Pattern shipped in commits 8056aeaa (DTF), 20c96945 (SCP), 488cb086 (EMB) + matching proxy commits 28fc1e6, e4db006, ba2b06a.

---

## Screen Print (SCP) ShopWorks push under-billed — dropped setup/LTM/art/rush, blank note types, 1010% tax (2026-05-29) (archived 2026-06-07)
**Problem:** `/api/scp-push/push-quote` created ShopWorks orders whose total was *lower* than the customer quote — only garment lines pushed. Note `Type` came through blank and the tax note read "1010.00%". Separately, saved SCP `quote_items` had empty sizes + $0 unit prices.
**Root Cause:** `lib/scp-push-transformer.js` was cloned from the DTF transformer, which assumes fees are `EmbellishmentType='fee'` quote_items AND that per-piece price is all-in. But the **SCP quote-service stores setup/LTM/art/design/rush as SESSION fields, not item rows**, and screen-print setup is a SEPARATE charge never folded into `FinalUnitPrice` — so the fee-routing branch never fired and every fee dropped. Also `NOTE_TYPES.Order` (correct key is `.ORDER`) → `undefined`, and `getTaxAccount`/the tax note expect a decimal while the SCP service stores `TaxRate` as a percent (10.1). And `saveAndGetLink()` mapped `product.qty/.sizes/.unitPrice` — fields `collectProductsFromTable()` never returns.
**Solution:** Transformer synthesizes fee `LinesOE` from session fields (SPSU=screens×$30, Art, GRT-75, RUSH), adds an LTM line **only** in `separate` display mode (builtin already bakes LTM into the unit price — adding it again double-bills), reads shipping/discount from the session, normalizes `TaxRate` to a decimal, and uses `NOTE_TYPES.ORDER/.ART/.PRODUCTION`. Service persists authoritative `setupFeeTotal` in Notes JSON. `recalculatePricing()` now stores a save-ready priced snapshot on `window.currentPricingData.products` and `saveAndGetLink()` consumes it instead of the broken DOM scrape. Pinned by 10 tests in `caspio-pricing-proxy/tests/jest/scp-push-transformer.test.js`.
**Prevention:** When cloning a push transformer between builders, verify the *source builder's persistence model* first — EMB writes fee rows, DTF bakes fees into per-piece, SCP keeps fees as session fields; never assume `FinalUnitPrice` is all-in. Always unit-test `pushed order total === quoted pre-tax total` (both LTM modes). `NOTE_TYPES` keys are UPPERCASE. SCP still pushes under EMB's OnSite integration (customer 3739 / order type 21) until Erik creates a dedicated SCP integration — see `manageorders-scp-config.js` TODOs.

---

## OF push hardcoded `TaxTotal: 0` + wrong `isPickup` check + missing DTG in id_Design whitelist (2026-05-20) (archived 2026-06-07)
**Problem:** Erik submitted OF-0040 (Edgemont Jr. High) and ShopWorks received `TaxTotal: 0` even though the live form preview showed correct tax. Customer was under-billed $19.08. Three separate bugs piled up: (1) `server.js:1838 const isPickup = ship && ship.method === 'willcall'` — frontend sends `'pickup'`, not `'willcall'`, so pickup-tax branch never fired; (2) the OF payload hardcoded `taxTotal: 0` instead of pushing the form's computed amount; (3) the id_Design push at `server.js:~2537` whitelisted `embroidery / screenprint / dtf` but NOT `dtg` — so every DTG order created an orphan placeholder design in ShopWorks even when the rep picked an existing design # from the customer-aware picker.
**Root Cause:** Three separate copy-paste-era artifacts compounded. The `'willcall'` hardcode dates from before the form added `'pickup'` as the canonical pickup code (the dropdown shows both — `willcall` for back-compat). The `taxTotal: 0` was a "let OnSite calculate" assumption that turned out to be wrong (ShopWorks does NOT auto-calc tax — it just shows whatever's pushed). The DTG omission from the design whitelist happened because DTG didn't have a customer-aware design picker until v14, so prior reps couldn't pick a design # for DTG, so the bug was invisible.
**Solution:** (a) Accept both `'pickup'` AND `'willcall'` in every isPickup check (server.js + frontend). (b) Compute tax in the frontend via `state.shipping.taxRate` (set by `recomputeTaxRate()` which calls `/api/tax-rates/lookup` for in-WA destinations OR hardcodes `0.101` for pickup OR `0` for out-of-state). Push `taxTotal` + `taxPartNumber` + `taxPartDescription` in the submit payload — server.js re-derives isPickup as defense-in-depth and zeros out tax for out-of-state-shipping regardless of what frontend sent. (c) Add `'dtg'` to the design-link whitelist in `server.js`'s `linkedIdDesigns` block.
**Prevention:** When a field accepts multiple coded values (pickup/willcall), every check site needs to accept ALL of them — make it a helper function (`isPickupShip(ship)`) not an inline comparison. Any "let downstream calculate X" assumption needs an end-to-end test on the actual downstream — ShopWorks tax in our case. When adding a new method (DTG had no design picker until v14), audit every existing method-specific code path (`if (method === 'embroidery' || ...)`) and add the new method explicitly.

---

## Order Form ShopWorks Push: Invented Note Type "Notes On Packing List" (2026-05-01) (archived 2026-06-07)
**Problem:** Every Order Form push to ShopWorks failed with `Invalid note type: "Notes On Packing List". Valid types: Notes On Order, Notes To Art, Notes To Purchasing, Notes To Subcontract, Notes To Production, Notes To Receiving, Notes To Shipping, Notes To Accounting, Notes On Customer`. Banner showed at the bottom of the form, no order landed.
**Root Cause:** [server.js:2164](server.js:2164) constructed a fifth notes block tagged `type: 'Notes On Packing List'` for a customer-visible thank-you string built by `buildPackingListNote()` ([server.js:1807](server.js:1807)). That string is **not** in ShopWorks's official 9-type taxonomy ([memory/MANAGEORDERS_API_GUIDE_OFFICIAL.md:153](memory/MANAGEORDERS_API_GUIDE_OFFICIAL.md:153)) — the developer treated it as a note type when it's actually a ShopWorks template-output concern. The proxy validates the WHOLE notes array; one invalid type aborts the entire push.
**Solution:** Deleted `buildPackingListNote()` and the corresponding `notesBlocks.push({ type: 'Notes On Packing List', ... })` entry. Updated the routing-comment block from "5-way split" to "4-way split" with explicit warning about the 9 valid types. Order Form now pushes Order / Production / Purchasing / Art notes only — same pattern 3-Day Tees uses successfully ([server.js:1580](server.js:1580)).
**Prevention:** When constructing a ManageOrders notes array, **the `type` value must be one of the 9 from `MANAGEORDERS_API_GUIDE_OFFICIAL.md` — verbatim**. There is no "Packing List", "Customer Receipt", "Hold Note", etc. type — those are ShopWorks UI/print-template concerns, not API note types. The proxy rejects unknown types with a banner that lists the valid set; treat that as the canonical source. Print-slip messages should be configured in ShopWorks's packing-slip template (or omitted), not pushed via the notes array.

---

## ShopWorks PO `Color` Field Must Be CATALOG_COLOR, Not COLOR_NAME (2026-05-02) (archived 2026-06-07)
**Problem:** SanMar rejected lines on POs that ShopWorks pushed for Richardson 112 caps. The hypothesis was that Caspio's `CATALOG_COLOR` codes had drifted from SanMar's current mainframe codes. Audit disproved that — all 112 Caspio CATALOG_COLOR values match SanMar's PromoStandards `colorName` 1:1 (verified live via `/api/sanmar/product-colors/112`: `Bk/Bk/LtGy`, `HotPink/Wh`, `Biscuit/TB`, etc.). So the data was correct; the **wrong field was being sent**.
**Root Cause:** Order form posts both `color` (display name like "Black/ Black/ Light Grey") and `catalogColor` (mainframe code like "Bk/Bk/LtGy") to the proxy ([server.js:2053-2061](server.js:2053)). The proxy's `transformLineItems()` ([caspio-pricing-proxy/lib/manageorders-push-client.js:279](../caspio-pricing-proxy/lib/manageorders-push-client.js:279)) forwarded **only `item.color`** as the ShopWorks `Color` field, dropping `item.catalogColor`. ShopWorks then had to translate display name → catalog code via its own internal product table — and any miss in that translation produced a bad SanMar PO that SanMar refused.
**Solution:** Changed `Color: item.color || ''` → `Color: item.catalogColor || item.color || ''`. ShopWorks now receives the abbreviated mainframe code directly, no translation step required. Backward compatible: clients that don't send catalogColor (3-Day Tees, embroidery push) keep working via the fallback. Deployed in proxy v606 on 2026-05-02.
**Prevention:** **SanMar PromoStandards `colorName` IS the catalog/mainframe code, not a friendly name** — same value as Caspio's `CATALOG_COLOR`. Anywhere we generate a SanMar-bound payload (PO push, inventory query, sellable check), use `CATALOG_COLOR` / `catalogColor`. Reserve `COLOR_NAME` strictly for UI display. The proxy's `transformLineItems()` is the single chokepoint for outbound ShopWorks color values — any future field-mapping change goes there. Audit a style with `curl /api/sanmar/product-colors/:style` and diff against the Caspio rows whenever a SanMar rejection mentions color.
**Follow-up #1 (2026-05-02, proxy v607):** Reading OF-0025's payload surfaced 3 more bugs in the same push path: (1) `transformDesigns()` defaulted `id_Design: 0` → orphan designs in ShopWorks; fix: conditional spread. Order form sent `linkedDesigns: [{id_Design: N}]` array but proxy reads singular `idDesign` — added `base.idDesign = linkedIdDesigns[0]`. (2) `ForProductColor` filter excluded rows whose `deco` defaulted to embroidery → only 3 of 11 colors listed; fix: `r => !r.deco || r.deco === method` + prefer `r.catalogColor`. (3) Auto-fill effect at paper-form.jsx:365 bailed when `row.desc` was non-empty — picking 111 then changing to 112FP kept the old description; fix: added `descSource: 'auto' | 'manual'` row field, only refresh when source is `'auto'`. **Pattern lesson:** when auditing a payload-shape bug, read the WHOLE payload — adjacent fields built by the same code path often have related bugs.
**Follow-up #2 (2026-05-02, proxy v608):** (1) **OrderType + DesignType IDs were ALL wrong** from the source CSV; OF-0027 displayed "Digital Printing" instead of "Custom Embroidery". Verified against live ShopWorks screenshot (correct: emb=21, sp=13, dtg=5, dtf=18, sticker=41, emblem=7, default=6). **Lesson:** verify customer-supplied mapping CSVs against the live system before deploying — column header pairings are often ambiguous. (2) **Caspio's `Design_Lookup_2026.Design_Number` IS ShopWorks's `id_Design`** — the 155K-row table holds the same integer; no secondary lookup needed. **Lesson:** before building a mapping endpoint, check whether the "external" key is already the same integer as the "internal" one. (3) **`/api/embroidery-designs/lookup` was silently 404'ing for months** — server.js was calling that path; the real route is `/api/digitized-designs/lookup`. Phase A's `Designs:[]` orphan-prevention masked the failure. **Lesson:** HTTP failures should not silently fall back — log the 404 OR fail the request.
**Follow-up #3 (2026-05-03, proxy v609 + Service Code Sync):** OF-0031 showed fee/service lines (DD, GRT-50, 3D-EMB) landing in ShopWorks **column 6 ("Other XXXL")** instead of column 1. Payload sent fee lines with empty `Size` → ShopWorks's Size Translation Table fell through to default (last column). Fix: stamp `Size: "S"` on every fee line in `transformLineItems()`, gated by `isKnownFeeCode(item.partNumber)`. The `S → Adult/column 1` rule now handles all 29 service codes for free. **Companion fix:** discovered the proxy's `KNOWN_FEE_PNS` had 6 dead codes and 2 mis-named ones. Picker, proxy whitelist, Caspio `Service_Codes` table now all carry the **same canonical 29 mixed-case codes**. **Prevention:** when ShopWorks's part configs constrain Size Restrictions, the payload's `Size` field is load-bearing. **Single source of truth audit before any service-code change:** picker constants → service-codes.js arrays → `KNOWN_FEE_PNS` proxy set → live Caspio rows → ShopWorks part list. All four must agree.
**Follow-up #4 (2026-05-03, AS vs AL conflation):** Auditing OF-0032 revealed [tiered-pricing.js:107](pages/order-form/components/tiered-pricing.js:107) was applying the **AL family per-1K formula** (Additional Logo: $1.00/1K above 5K cap, $1.25/1K above 8K garm) to **AS-Garm and AS-CAP**, which are actually **flat-tier surcharges** ($0 ≤10K, $4 ≤15K, $10 ≤25K, DECG-FB above 25K). OF-0032 overcharged $60. **Fix:** split AS off from AL family; new `asStitchSurcharge()` reads `Embroidery_Costs` rows where `ItemType='AS-Cap'`/`'AS-Garm'`+`TierLabel='ALL'`. **Lesson:** "stitch surcharge" looks like one concept but is TWO distinct Caspio services. When auditing a pricing parity claim, the audit must compare against the EXACT formula the target surface would invoke for that service code — pulling the wrong formula and calling it "the truth" misses the routing difference. Always verify the call site, not just the file.

---

## Two Caspio Tables for the Same YTD Metric → Two Different Totals on the Dashboard (2026-04-27) (archived 2026-06-07)
**Problem:** Staff dashboard's sales-goal banner read $872,889 (29.1% of goal) while Team Performance widget directly below it read $855,368. Same year, same metric, $17,521 apart. Both numbers were over the ShopWorks ground truth ($855,368.20).
**Root Cause:** Two independent Caspio archive tables backed the same metric with no enforced reconciliation. **`DailySalesArchive`** (company-wide daily totals) was queried by `loadYTDForSalesGoal` for the banner. **`NW_Daily_Sales_By_Rep`** (per-rep daily totals) was queried by `loadTeamPerformanceYTDHybrid` for the widget. Both had silent drift (voided/edited orders within 60 days never refreshed) and the per-rep table additionally had pre-60-day phantom rows. **Two separate drift accumulators, drifting in different directions**, with no cross-check.
**Solution:** (1) Hardened the per-rep table's daily cron to do **rolling 60-day re-archive + phantom-delete** so within-window drift self-heals nightly. (2) Built `scripts/reconcile-rep-baseline-from-csv.js` to one-shot fix the locked pre-window using a ShopWorks CSV. (3) **Re-pointed the sales-goal banner to read from the per-rep YTD endpoint plus a thin live ManageOrders top-up** — single source of truth for both widgets.
**Prevention:** When a metric appears in more than one place on the same screen, **all consumers must read from the same source — period**. Two tables holding "the same" data is a guarantee they'll drift; pick one canonical store. Quarterly truth-up against an external authoritative source (ShopWorks CSV) catches everything that aged past the auto-sync window. When a metric is "by definition correct" but obviously wrong, look for a parallel data path you forgot existed.
**Follow-up (2026-04-27):** Same divergence existed in `dashboards/js/rep-crm.js` (Taneisha/Nika CRM headlines summed `Accounts.YTD_Sales_2026` while the staff dashboard widget read `NW_Daily_Sales_By_Rep`). Fixed to read per-rep archive, show archive-through date, and print a reconciliation line. House Accounts page had the analogous "stat cards don't sum to headline" bug — API returned an "Other" assignee bucket the UI silently dropped (~$5K hidden); added the 6th card.

---

## EmailJS `template_art_note_added` requires `header_emoji` + `header_title` in every caller (2026-05-09) (archived 2026-06-07)
**Problem:** The shared EmailJS template was originally hardcoded with `📝 Note Added` in the blue header bar. Steve's brain registered "note added" even when the email was actually announcing a brand-new submission, customer approval, or status change — the visual didn't match the actual context.
**Solution:** Updated the template HTML to use `{{header_emoji}} {{header_title}}` instead of `📝 Note Added`, and prefixed the subject line with `{{header_emoji}}`. Then updated all **26** `emailjs.send()` calls across **9 files** to pass both variables — context-specific for new-submission flows (🎯 JDS, 🏷️ Sticker, 🎌 Banner, 🎨 Mockup, 👕 Garment, ✅ Confirmation, 📨 Sales-rep FYI), default `📝` for legacy note-added flows.
**Prevention:** **When adding a new caller of `template_art_note_added`, ALWAYS pass `header_emoji` and `header_title`** (not optional — EmailJS doesn't fall back gracefully and would render `{{header_emoji}} {{header_title}}` literally). Grep for `'template_art_note_added'` and verify every site passes both variables.

---

## Quote-management Amount column showed $0.00 for orders with null cur_TotalInvoice (2026-05-28) (archived 2026-06-06)
**Problem:** Quote Management dashboard showed `$0.00` in the Amount column for some Processed orders that had non-zero `TotalAmount` in `quote_sessions`.
**Root Cause:** `getEffectiveAmount()` did `const swTotal = Number(snap?.order?.cur_TotalInvoice); if (Number.isFinite(swTotal)) return swTotal;` — but `Number(null) === 0` and `Number.isFinite(0) === true`, so a null `cur_TotalInvoice` returned 0 instead of falling through to the `quote.TotalAmount` fallback.
**Fix:** Explicit `raw != null && raw !== ''` check BEFORE `Number()` coercion. Added `getAmountTooltip()` hover. Shipped `v2026.05.28.3`.
**Prevention:** Whenever wrapping a possibly-null API value in `Number()`, gate with `!= null` first. `Number.isFinite()` is NOT a null check.

## `resolveItemType` helper drift across 3 files — JDS records rendered as Garment on detail page (2026-05-08) (archived 2026-06-01)
**Problem:** New `Item_Type='JDS'` records correctly displayed JDS badge + SKU on Steve's gallery and the AE list, but the Art Request Detail page rendered them as Garment — Item Type badge hidden, JDS Specs card hidden, all the structured info packed into `Item_Specs_Notes` was invisible.
**Root Cause:** Three separate copies of `resolveItemType()` exist: [art-hub-steve-gallery.js:135](shared_components/js/art-hub-steve-gallery.js), [art-ae.js:26](shared_components/js/art-ae.js), and [pages/js/art-request-detail.js:4406](pages/js/art-request-detail.js). When JDS shipped, the first two were updated; the detail-page copy was missed. Steve gallery's comment claimed it was the "single source of truth … same fallback used in art-ae.js + mockup-detail" — but `art-request-detail.js` was never updated.
**Solution:** Updated all 3 to recognize `'JDS'`. Added a code comment in each file cross-referencing the others.
**Prevention:** When extending the item-type taxonomy (or any other shared enum/helper), grep for the helper name and update every copy. Better long-term: factor `resolveItemType` into a shared module — but that touches load order across multiple HTML host pages, so it's a separate cleanup task.

---

## JDS + Sticker/Banner intake 500: payload sent `Design_Name` to a column that doesn't exist on ArtRequests (2026-05-08) (archived 2026-05-29)
**Problem:** Every AE submission via the JDS intake form on the AE dashboard returned `Submission failed: Failed to create art request (500)`. Sticker/Banner intake (same 2026-05-06 deploy) had the same latent bug; just hadn't been exercised.
**Root Cause:** Both [jds-submit-form.js](shared_components/js/jds-submit-form.js) and [sticker-banner-submit-form.js](shared_components/js/sticker-banner-submit-form.js) POSTed `Design_Name: designName` to `/api/artrequests`. `Design_Name` exists on `Design_Lookup_2026` and `Digitizing_Mockups` — but **not on `ArtRequests`**. Caspio returned `404 FieldNotFound — Cannot perform operation because the following field(s) do not exist: 'Design_Name'`. The proxy's POST handler ([art.js:251-254](../caspio-pricing-proxy/src/routes/art.js#L251)) catches and re-emits as a generic 500, hiding Caspio's actual error from the browser.
**Solution:** Frontend-only fix — dropped `Design_Name` from both payloads and folded the design-name string into `Item_Specs_Notes` (prefixed `Design Name: …`) so Steve still sees it.
**Prevention:** (1) **The proxy's `POST /artrequests` handler MUST forward Caspio's `Code`/`Message`/`RequestId` in the 500 response body** (same pattern as `garment-tracker.js` adopted 2026-04-27) — generic "Failed to create art request" gave the frontend nothing actionable. (2) When adding a new intake form that writes to an existing Caspio table, **introspect the live table schema** (`GET /tables/X/fields`) and diff against the payload before the first deploy — Caspio's 95-column tables have plenty of similarly-named fields on neighboring tables that look like they should exist but don't.

---

## Screen Print Quote Reprices at WORST Tier When Qty Crosses 576 (2026-04-23) (archived 2026-05-29)
**Problem:** Nika's quote at 500 pcs showed PC68H=$22.00 / PC55=$14.50. Added 100 long-sleeve (600 total) — prices jumped to PC68H=$30.50 / PC55=$20.50 / PC55LS=$26.50. More qty → higher price.
**Root Cause:** Caspio `tiersR` for ScreenPrint only caps the top tier at `MaxQuantity=576` (DTG/DTF/EMB use 99999). At 600 pcs, the tier `find()` in `screenprint-quote-builder.js:2858` matched NO tier, then `|| primaryPricing.tiers[0]` fell back to the 13-36 tier (MarginDenom 0.45 — the HIGHEST margin). Same buggy `|| tiers[0]` fallback at line 2874 for additional location.
**Solution:** Added `findPricingTier(tiers, qty)` helper that clamps qty-above-all-maxes to the TOP tier (not tiers[0]). Applied to both primary and additional lookups. Also: update Caspio Tier 16 MaxQuantity=99999 to match other methods.
**Prevention:** Never write `find() || arr[0]` for a tier/range lookup — the failure mode is "use cheapest-for-us / worst-for-customer". Always clamp to the appropriate end of the range. Verify tier data (MinQty/MaxQty) across DTG/DTF/EMB/ScreenPrint is internally consistent — the ScreenPrint 576 cap was an isolated data outlier that silently over-charged every 577+ quote.

---

## Rate Limiter Mounted at /api Leaks Counter to Unrelated Routes (2026-04-19) (archived 2026-05-29)
**Problem:** Pasting a Supacolor screenshot into the new dashboard returned 429 "Too many requests to ManageOrders endpoints" — but the request was to `/api/vision/extract-supacolor-jobs-list`, nowhere near manageorders.
**Root Cause:** `app.use('/api', manageOrdersLimiter, manageOrdersRoutes)` runs the limiter middleware for EVERY `/api/*` request that falls through to that line, regardless of whether `manageOrdersRoutes` ends up handling it. The 30/min counter incremented on Bradley's transfer flow + dashboard polling + everything else, leaving no budget for the actual vision call.
**Solution:** Add `skip: (req) => !req.path.startsWith('/manageorders/')` to the limiter config so only true ManageOrders paths count against the budget.
**Prevention:** When mounting a rate limiter alongside a router via `app.use(prefix, limiter, router)`, scope the limiter with a `skip` filter that matches only the routes the router actually handles. Otherwise the counter bleeds into every later `/api/*` route. Apply the same pattern to other broad-mount limiters: `pc54InventoryLimiter`, `sanmarLimiter`, etc.

---

## Bug: Box Mockup Images Not Loading — Shared/Static URLs Return 404 (archived 2026-05-07, superseded by box-url-rules.md)
**Problem:** Mockup images across Art Hub (art request detail, mockup detail, AE/Ruth dashboards, approval modals) showed broken images or "JPG" badge placeholders.
**Root Cause:** Box `download_url` values using `/content/` or shared/static URLs intermittently return 404. The original `onerror` handler only showed a fallback badge, never retried via an alternate path.
**Solution:** Added proxy fallback in `renderFilledThumb()` onerror: when a Box URL fails, retry via backend `/api/box/shared-image` proxy endpoint. Applied across 6 files (art-request-detail.js, mockup-detail.js, art-actions-shared.js, art-ae.js, mockup-ae.js, mockup-ruth.js).
**Prevention:** Box download URLs are unreliable for direct browser loading. Always implement a proxy fallback for Box image URLs. The backend proxy can use authenticated API access which succeeds where public URLs fail.

---

## Bug: Box Proxy Thumbnail URLs — getFileExtension Returns Garbage, HTTP Mixed Content (archived 2026-05-07, superseded by box-url-rules.md)
**Problem:** Reference File images showed purple badge "COM/API/BOX/THUMBNAIL/2196733276592" instead of image. Downloads blocked as "can't be downloaded securely."
**Root Cause 1:** `getFileExtension()` returned everything after last `.` in proxy URLs — `com/api/box/thumbnail/...` is not a valid extension but code treated it as non-image.
**Root Cause 2:** Backend stored proxy URLs as HTTP (Heroku `req.protocol` behind LB). HTTPS page blocks HTTP resources.
**Solution:** Guard in `getFileExtension()` (reject ext with `/` or >10 chars). Added `normalizeBoxProxyUrl()` to rebuild with HTTPS API_BASE. Download redirects to `/api/box/download/:id` for full-res.
**Prevention:** Any `getFileExtension()` must guard against API endpoint URLs. Any URL stored by backend must use `config.app.publicUrl` or be normalized client-side.

---

## Bug: Cap Embroidery Manual-Cost Override Was Unauthenticated (archived 2026-05-03)
**Problem:** [shared_components/js/cap-embroidery-pricing-service.js:18-34](shared_components/js/cap-embroidery-pricing-service.js:18) read `?manualCost=...` from the URL without checking the host. A customer visiting `https://teamnwca.com/calculators/cap-embroidery-pricing-integrated.html?manualCost=0.01` saw fake $0.01 cap prices on the public calculator. Discovered during the Embroidery Pricing Audit while comparing the cap service to the flat service. The flat embroidery service ([embroidery-pricing-service.js:18-22](shared_components/js/embroidery-pricing-service.js:18)) had had this gate since launch — the cap service was a copy-paste miss.
**Root Cause:** When the cap service was forked from the flat service, the `getManualCostOverride()` method was copied without the `host === 'localhost' || host.endsWith('.herokuapp.com')` internal-only check. Two services with identical-looking signatures had different security postures.
**Solution:** Copied the 3-line host gate verbatim into `cap-embroidery-pricing-service.js`. Verified via local preview: localhost still allows override (staff use); teamnwca.com / nwcustomapparel.com return null. Deployed in main app v908 on 2026-05-03.
**Prevention:** When forking a public-facing pricing service to support a new product type, **diff the security/auth surface** of the source before stamping the copy. Look for: host-gate, sessionStorage validation, URL parameter sanitization. Add a pre-commit grep check or unit test that asserts every pricing service has `getManualCostOverride()` returning null on non-internal hosts.

---

## Bug: LTM Display Mode — Builtin vs Separate Math Must Match (archived 2026-05-03)
**Problem:** DTG/SCP builtin: row total != unit price x qty. DTF separate: LTM double-counted.
**Root Cause:** Subtotal calc didn't branch by display mode; fee row duplicated baked-in amount.
**Solution:** Branch subtotal by mode. Both modes must produce identical grand totals.
**Prevention:** Trace ALL paths: unit price, row total, subtotal, grand total, tax, discount.

---

## Bug: 1-Cent Tax Rounding Error in Quote PDF Totals (archived 2026-05-01)

**Problem:** PDF total off by $0.01. Components summed correctly but total didn't match.

**Root Cause:** Tax computed as raw float, displayed rounded, but added to total unrounded. IEEE 754 rounding.

**Solution:** `Math.round(subtotal * taxRate * 100) / 100` — round tax to cents BEFORE summing.

**Prevention:** Round each component to cents first, then sum. Never sum unrounded floats. (This rule still lives in CLAUDE.md "Top Critical Gotchas".)

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

---

### Caspio Rejects q.pageSize < 5 — fetchAllCaspioPages Broke All Small-Limit Endpoints (archived 2026-04-23)
**Problem:** Art Hub detail page, Daily Sales Archive, and any endpoint using `limit=1` thru `limit=4` returned 500 after pagination fix deploy.
**Root Cause:** Commit 30bbfba converted ALL `q.limit` to `q.pageSize` upfront. Caspio API rejects `q.pageSize < 5` with `IncorrectQueryParameter`.
**Solution:** Keep `q.limit` for page 1 (universally compatible). Only switch to `q.pageSize` + `q.pageNumber` for pages 2+ (where the v3 conflict exists).
**Prevention:** Never blindly replace `q.limit` with `q.pageSize`. Test with `limit=1` after any pagination changes. Caspio v2/v3 have different param support.

---

### AE Edit Save Broken — PK_ID vs ID_Design Mismatch in Backend (archived 2026-04-23)
**Problem:** AE edits art request fields via Edit modal, clicks Save, gets console error or changes don't persist.
**Root Cause:** Backend `PUT /api/art-requests/:designId/fields` (art.js:874) used `q.where=PK_ID=${designId}`, but the URL passes `ID_Design`. Every other endpoint in the file correctly uses `ID_Design`. Commit `cfcc1de` introduced the bug.
**Solution:** Changed `PK_ID` to `ID_Design` in the WHERE clause (commit `2ed4724`).
**Prevention:** ArtRequests endpoints ALWAYS use `ID_Design` for the WHERE clause. The URL param is the design ID, not the primary key. Check consistency across all endpoints in a route file.

---

### Mockup Approval Email Showed "Not specified" for Design Size (archived 2026-04-24)
**Problem:** Nika's mockup email for Button Veterinary #33672 showed `DESIGN SIZE: Not specified` to the customer. Record had `Design_Size=""`, `Logo_Width=""`, `Logo_Height=""` — all three blank.
**Root Cause:** `mockup-detail.js` sent `design_size: designSize || 'Not specified'` and the modal input only pre-filled from `Design_Size`, ignoring the separately-stored `Logo_Width`/`Logo_Height` on the same record.
**Solution:** Pre-fill chain in the Send-to-Customer modal: `Design_Size` → `Logo_Width × Logo_Height` → blank. Email fallback changed to `'N/A'` (short, fits the 50%-width cell).
**Prevention:** When a single email field has multiple possible sources on the record, walk the fallback chain in the code that populates it. Friendly fallback strings ("N/A") beat clinical ones ("Not specified") when customers see them.

---

### Quote Update Race Condition — DELETE-then-INSERT Risks Data Loss (archived 2026-04-27)
**Problem:** `updateQuote()` deleted ALL items then re-inserted. Browser crash mid-insert = permanent data loss.
**Solution:** Reversed to insert-then-delete. Only delete old items if ALL new inserts succeed.
**Prevention:** For replace-all operations, write new data first, verify, then remove old.

---

### Mockup Approve Button Unresponsive — Disabled Attribute Blocks Click Handler (archived 2026-04-27)
**Problem:** AE (Taneisha) clicks "Approve Mockup" button but nothing happens. No toast, no error, no feedback.
**Root Cause:** Button rendered with `disabled` HTML attribute (`mockup-detail.js:314`). Disabled buttons don't fire click events, so the existing guard toast ("Please click a mockup image to select it first") never ran.
**Solution:** Removed `disabled` from both AE (`:314`) and customer (`:267`) approve buttons. Click handlers already have proper guards for missing selection.
**Prevention:** Never use `disabled` to enforce a workflow step if the click handler already has guard logic with user feedback. Use the handler's toast/error message instead.

---

### All Sizes Showing as Adult/S (id_Integration Must Be Valid) (archived 2026-05-01)
**Problem:** Imported orders show correct product but every item is Adult/S.
**Root Cause:** Missing or zero `id_Integration` — ShopWorks doesn't know which Size Translation Table.
**Prevention:** Every store config MUST have valid `id_Integration`. Check for `"id_Integration": 0`.

---

### Heroku Dyno Serves Stale Slug After Successful Release (archived 2026-05-02, originally 2026-04-24)
**Problem:** After `git push heroku main` completed and Heroku reported `Released vN`, the live site kept serving the previous slug — `/art-request/:id` returned HTML with `?v=20260423b` even though the repo on Heroku had `?v=20260424a`. `Last-Modified` header showed the prior deploy time. Browser hard-reloads, cache-bust query params, and `Cache-Control: no-cache` all failed to fix it. Only `heroku ps:restart` cleared it (took ~15s after restart to serve fresh content).
**Root Cause:** Heroku builds a new slug and marks the release live in metadata, but the running dyno keeps serving the previous slug until either (a) a dyno cycle (~24h), (b) a dyno crash, or (c) a manual restart. Cause is suspected to be Node's in-process module cache + slug-file mtime caching in Express `sendFile`. Content-Length and Etag stayed identical across the old and new slug because the only change was a 1-char version string (same byte count).
**Solution:** Run `heroku ps:restart --app sanmar-inventory-app` immediately after deploy if served content doesn't match pushed content within 30 seconds.
**Prevention:** After every `/deploy`, verify live content with `curl -s <production-url> | grep '?v='` against the local file. If mismatched → `heroku ps:restart`. Can add this as a final automated step in the deploy skill. Do NOT chase this with browser cache-bust tricks — the issue is server-side.

---

### SanMar Sync Upsert Bug — `makeCaspioRequest` Returns Array, Code Checks `.Result` (archived 2026-05-02)
**Problem:** Caspio SanMar tables had only 7 orders (should be hundreds). Backfill processes hung indefinitely. Every sync created duplicates instead of updating existing records.
**Root Cause:** `makeCaspioRequest()` in `src/utils/caspio.js:100` returns `response.data.Result` (the array directly). But all 6 upsert locations in `sanmar-orders.js` and `sanmar-invoices.js` checked `existing.Result` — which is `undefined` on an array. Every existence check failed, causing INSERT instead of UPDATE.
**Solution:** Changed all 6 checks from `existing.Result.length` to `Array.isArray(existing) && existing.length > 0`. Also fixed backfill line item dedup (was blind POST with silent catch → proper GET/PUT/POST upsert).
**Prevention:** `makeCaspioRequest` unwraps `.Result` — never check `.Result` on its return value. When writing Caspio upsert logic, always test with `Array.isArray()`.

---

### SanMar→ShopWorks Style Normalization — _OSFA and _S/M Suffixes Not Stripped (archived 2026-05-03)
**Problem:** SanMar order matching failed for orders with `_OSFA`, `_S/M`, `_L/XL` part number suffixes. 36 orders had empty id_Order.
**Root Cause:** The regex `/_\d?[xXsSmMlL]+$/i` only handled `_2X`/`_3XL` style suffixes. `NE1020_S/M`, `BG517_OSFA` stayed un-normalized, never matching SanMar's base style `NE1020`/`BG517`.
**Solution:** Added `replace(/_(OSFA|S\/M|L\/XL|ONE SIZE)$/i, '')` before the existing regex. Also: backfill missing SanMar items via poSearch, paginate all Caspio queries, add live ManageOrders API fallback for orders missing from Caspio cache.
**Prevention:** When adding new size suffix patterns to ShopWorks, update the normalization regex in `sanmar-orders.js` (3 instances — search `baseStyle =`).

---

### Mixed Quote Tier Separation (Caps vs Garments) (archived 2026-05-21)
**Problem:** Caps and garments need SEPARATE tier calculations — cannot combine for quantity discounts.
**Root Cause:** Different methods, stitch counts, stitch rates, and industry standard.
**Solution:** `garmentTier = getTier(garmentQty)`, `capTier = getTier(capQty)` — never combine.
**Prevention:** Each type under threshold gets separate $50 LTM fee. (Rule encoded in MEMORY.md "LTM Sync" + CLAUDE.md.)

---

### Inventory Showing "Unable to Verify" (COLOR_NAME vs CATALOG_COLOR) (archived 2026-05-21)
**Problem:** Cart saves but inventory check shows "Unable to Verify."
**Root Cause:** Using `COLOR_NAME` ("Brilliant Orange") instead of `CATALOG_COLOR` ("BrillOrng") for API queries.
**Prevention:** `CATALOG_COLOR` for API calls, `COLOR_NAME` for display only. See CLAUDE.md Two Color Field System.

---

### Shipping Not Taxed in Quote View (WA State Requires It) (archived 2026-05-21)
**Problem:** Quote view/PDF taxed subtotal only. WA state requires tax on shipping too.
**Solution:** All 6 tax sites changed to `taxableAmount = subtotal + shipping`.
**Prevention:** WA state taxes shipping. All tax calculation sites must include shipping in taxable base. (Rule in CLAUDE.md "Top Critical Gotchas".)

---

### Beanies Priced as Caps (ProductCategoryFilter Is Truth) (archived 2026-05-21)
**Problem:** CP90 beanie: different prices on calculator vs quote builder.
**Root Cause:** Quote builder's `isCapProduct()` caught beanies via SanMar CATEGORY_NAME without flat headwear exclusion.
**Solution:** Added `ProductCategoryFilter.isFlatHeadwear()` check in all quote builders.
**Prevention:** Use `ProductCategoryFilter` as single source of truth. Never duplicate keyword lists. (Rule in MEMORY.md "Beanie = flat, NOT cap".)

---

### PC54 2XL Size Mapping Wrong (Size05 Not Size06) (archived 2026-05-21)
**Problem:** 2XL orders going to wrong ShopWorks SKU.
**Root Cause:** PC54_2X uses Size05, not Size06 as expected.
**Prevention:** PC54: base (Size01-06), PC54_2X uses **Size05** (NOT Size06!). Always verify with ShopWorks. (Rule in CLAUDE.md Multi-SKU Products.)

---

### Size Modifiers Not Applying Correctly (_2X Not _2XL) (archived 2026-05-21)
**Problem:** 2XL and 3XL items going to wrong SKUs.
**Root Cause:** ShopWorks uses `_2X`/`_3X`, NOT `_2XL`/`_3XL`. SanMar API also rejects `_2XL`.
**Prevention:** Always check SIZE_MODIFIERS dict. `_2XL` → `_2X` fix applied across all 12 files (2026-02-21). (Rule in MEMORY.md "SanMar-ShopWorks Size Mapping".)

---

### OnSite Size Translation Table Appends Suffixes — Send BASE PN (archived 2026-05-21, originally CORRECTED 2026-05-01)
**Problem:** Order Form's first real ShopWorks import showed double-suffixed PNs: `PC61Y_XS_XS`, `112_OSFA_OSFA`, `NE1000_S_M_S/M`. This entry previously said "Size Translation Table only assigns columns" — that was wrong.
**Root Cause:** OnSite's Size Translation Table has an "OnSite Part Number Modifier" column that **does append** the configured suffix (`_XS`, `_2X`, `_3XL`, …) to the incoming PN, in addition to mapping the size to Size01-06. Pre-suffixing on the client causes a double-stamp.
**Solution:** Push the BASE PN + plain size string (`PC61Y` + `XS`); OnSite produces `PC61Y_XS`. Fix landed in `server.js` `/api/submit-order-form` line-items builder.
**Prevention:**
  - For **MO push payloads**: send base PN, plain size — never pre-suffix.
  - For **frontend display + SanMar inventory API**: the suffixed PN is still correct (SanMar's catalog lists each extended size as its own SKU). `orderFormSizeSuffix()` is the right helper for those paths.
  - For other integrations using `getPartNumber()`: verify whether your push target's translation table also appends modifiers before pre-suffixing in code.
  (Rule in MEMORY.md "ManageOrders API → Size Translation".)

---

### OnSite Integrations All Share /onsite URL (archived 2026-05-21)
**Problem:** Embroidery PUSH health check returned 403 from `/embroidery/signin`.
**Root Cause:** All OnSite integrations share `/onsite`. Distinguished by `ExtSource`/`id_Customer`, not URL paths.
**Prevention:** Verify URL from ShopWorks admin. Don't infer paths from integration names. (Rule in MEMORY.md "Embroidery Push to ShopWorks".)

---

### TaxTotal > 0 Creates Unwanted Tax Line Item (archived 2026-05-21, superseded by 2026-05-20 entry)
**Problem:** Pushed orders had phantom tax line item auto-generated from `TaxTotal`.
**Solution:** Always send `TaxTotal: 0`. OnSite calculates tax from `sts_EnableTax` flags per line item.
**Prevention:** For ManageOrders integration type, ALWAYS `TaxTotal: 0`. Only InkSoft type supports `TaxTotal > 0`. (Superseded by 2026-05-20 "ShopWorks ManageOrders integration ignores per-order TaxPartNumber" entry which expands on this.)

---

### Push API Does NOT Support Tax Fields (archived 2026-05-21)
**Problem:** Tax fields (`Tax[]`, `coa_AccountSalesTax01`, `sts_EnableTax`) all stripped by OnSite.
**Root Cause:** ManageOrders Push API schema doesn't include these — they're InkSoft-specific.
**Solution:** Removed unsupported fields. Use Notes On Order for tax info.
**Prevention:** Only rely on fields in official Swagger spec. Non-Swagger fields silently stripped. (Related to TaxTotal=0 rule.)

---

### Simple Design Linking via {id_Design: N} (archived 2026-05-21)
**Problem:** Full design blocks caused ShopWorks to create duplicate designs.
**Solution:** Known design → `{id_Design: parseInt(number)}`. Unknown → `Designs: []` (empty, let humans handle).
**Prevention:** Always link by ID. Don't auto-create placeholder records. (Rule in MEMORY.md "Embroidery Push to ShopWorks → Design linking".)

---

### REST API AlterReadOnlyData (Formula Fields + Emojis) (archived 2026-05-21)
**Problem:** PUT returned 500 `AlterReadOnlyData`.
**Root Cause 1:** Caspio REST API rejects 4-byte UTF-8 (emojis) with misleading "read-only" error.
**Root Cause 2:** Formula fields (e.g., `Amount_Art_Billed`) are read-only — only source fields are writable.
**Prevention:** Never write to formula fields. Never include emojis in API payloads. Strip non-ASCII as defense. (Rule in MEMORY.md "Art Hub → Amount_Art_Billed is formula".)

---

### Dropdown Fields Return Objects, Not Strings (archived 2026-05-21)
**Problem:** Art Request showed `[object Object]` for Order Type.
**Root Cause:** Caspio dropdown fields return objects like `{'6': 'Transfer'}` via REST API.
**Solution:** `typeof === 'object'` → `Object.values(field).join(', ')`.
**Prevention:** Dropdowns → object, text → string, files → may be base CDN URL when empty. (Rule in MEMORY.md "Caspio ListFields: Return objects".)

---

### Triggered Actions Don't Fire on REST API Updates (archived 2026-05-21)
**Problem:** Expected Caspio triggered actions for email notifications on REST API updates.
**Root Cause:** Triggered actions ONLY fire on DataPage form submissions, NOT REST API updates.
**Solution:** Use EmailJS (client-side) or server-side notifications instead.
**Prevention:** REST API updates = no Caspio automation. Plan for external notifications. (Rule in MEMORY.md "Art Hub → Caspio triggered actions DON'T fire on REST API updates".)

---

### getSizeSuffix() Falsy-Zero Bug (|| vs undefined) (archived 2026-05-21)
**Problem:** `getSizeSuffix('XLR')` returned `'_XLR'` instead of `''`. Normalization worked but empty string `''` is falsy.
**Root Cause:** `SIZE_TO_SUFFIX[normalized] || SIZE_TO_SUFFIX[size]` — `''` treated as miss by `||`.
**Solution:** Explicit `if (normalizedSuffix !== undefined) return normalizedSuffix;`.
**Prevention:** Same class as taxRate bug. Use `??` or explicit `!== undefined` check. (Subsumed by the general Falsy-Zero rule above.)

---

### Art Hub Email Recipient Priority — Sales_Rep Before User_Email (archived 2026-05-21)
**Problem:** Steve reported mockups were being sent to him instead of the sales rep. AEs got wrong recipient on revision requests.
**Root Cause:** 7 locations in `art-request-detail.js` and 4 in `art-actions-shared.js` used `User_Email || Sales_Rep` — `User_Email` is often the artist's email, not the rep.
**Solution:** Swapped to `Sales_Rep || User_Email` everywhere. `Sales_Rep` is the correct field for routing emails to reps.
**Prevention:** Always use `Sales_Rep` as primary recipient for rep-facing emails. `User_Email` is a fallback only. (Rule in MEMORY.md "Art Hub → Email recipient order".)

---

### Box image-loading legacy fixes — now subsumed by box-url-rules.md (archived 2026-05-21, originally 2026-05-07)
Two pre-`resolveToProxyUrl` bugs: (1) Box `download_url` shared/static URLs returned 404 → fixed with `/api/box/shared-image` proxy fallback in `renderFilledThumb()` onerror across 6 files; (2) Reference File images rendered as `COM/API/BOX/THUMBNAIL/...` badge because `getFileExtension()` treated proxy paths as extensions, plus mixed-content blocks because backend stored HTTP URLs → fixed via guard (`/` or len > 10) + `normalizeBoxProxyUrl()`. **Both rules superseded** by the centralized box-url-rules.md discipline (always proxy-form URLs in Caspio, `checkUrlReachable()` over plain HEAD, slot-aware recovery, nightly auto-recover cron). Don't write code that retries Box CDN URLs directly — use the proxy.

---

### Box Mockup Files Deleted From Box UI — Defense in Depth (archived 2026-05-21, originally 2026-04-20 → 2026-04-22)
**Problem (recurring):** Mockup images break in art request gallery + customer approval view. Box returns 404 for fileIds still referenced by Caspio. Steve previously had to manually re-link 21 designs. Thumbnails show generic IMG badge; download alerts "This mockup file no longer exists in Box". **Secondary issue (same day):** the post-upload HEAD verify rejected legitimate uploads when Box's eventual-consistency window (0.5–3s) exceeded the retry ceiling — staff saw "Uploaded file could not be verified in Box. Please try again." on files that actually uploaded fine.
**Root Cause:** Upload flow is correct (stores proxy URL `/api/box/thumbnail/{fileId}` from Box's authoritative response). Files get deleted **after** upload via Box web UI cleanup — `BOX_ART_FOLDER_ID` ("Steve Art Box 2020") is a shared-access folder. Secondary path: `DELETE /api/box/file/:fileId` had no reference guard. Secondary verify-too-strict: single-attempt (later 3-attempt `[0,500,1500]`) HEAD didn't cover Box's index propagation tail.
**Solution (defense in depth, 2026-04-22):** (1) Frontend 404 detection — `handleImageError()` HEADs proxy URL on image error; flips slot to "File missing — Re-upload" card (customer view → soft "Mockup is being updated — contact your rep"). (2) Backend upload verify — `verifyBoxFileAccessible()` HEADs fileId with retry `[0,1000,3000,5000]` (~9s); **advisory only, returns boolean** — callers log `[BOX_VERIFY_SOFT_FAIL]` and save to Caspio regardless. (3) DELETE endpoint guard — `findBoxFileReferences()` scans ArtRequests (5 fields) + Digitizing_Mockups (7 fields); returns 409 `FILE_IN_USE` unless `?force=true`. (4) `/api/box/download/:fileId` 404 returns `code: 'BOX_FILE_NOT_FOUND'`. (5) Fixed `sharedUrl` → `proxyUrl` at box-upload.js:1383.
**Prevention:** Caspio-referenced Box files CAN still be deleted out-of-band. Defense in depth: detect broken files early (HEAD on img error), surface clearly, make repair one-click. **When adding belt-and-suspenders validation, pick ONE layer to own hard failures — duplicating blocks across upload-time AND display-time just multiplies user-facing false positives.** Display-time won (catches deletes too, not just phantoms). Long-term: Box retention policy on `BOX_ART_FOLDER_ID`. (Rules encoded in box-url-rules.md.)

### Supacolor sync silently lost every closure for 2+ weeks (2026-05-07)
**Problem:** Dashboard at [/dashboards/supacolor-orders.html](dashboards/supacolor-orders.html) showed 14 jobs stuck "Open" — including #640003/#640214 that Mikalah received Apr 29 (8+ days stale). No FedEx tracking, no `Date_Shipped`. Cron logs said `errored=0` every run. Looked totally fine.
**Root Cause:** [scripts/sync-supacolor.js](../caspio-pricing-proxy/scripts/sync-supacolor.js) POSTed `/api/supacolor-jobs/sync/all` with no query params, defaulting to `includeClosed=false`. The route then asked Supacolor for `/Jobs/active?includeClosedJobs=false`. **The moment Supacolor flips a job to Closed/Dispatched on their side, it vanishes from that endpoint and our cron never sees it again** — local mirror keeps it stuck on Open forever.
**Solution:** Cron now passes `?includeClosed=true`. Walking 959 stubs noops fast on the ~945 unchanged closed rows. Bumped `MAX_ENRICHMENTS_PER_RUN` 20→50 so a weekend backlog catches up in one tick. Added `GET /api/supacolor-jobs/health` + `POST /health/alert` watchdog + Heroku Scheduler task that DMs Erik when `lastSyncAgo > 25 min` OR `stuckOpenCount ≥ 5`.
**Prevention:** **A polling cron that filters by status leaks state when the upstream changes status independently.** Either include all states and rely on diff logic to noop, or pair it with a watchdog that detects "things we expected to update aren't updating." `errored=0` tells you nothing about whether the cron is doing the right thing — only "what we asked for didn't break." Always pair an external-data cron with a freshness watchdog: max(LastUpdatedAt) + a stuck-state count, alerting when either drifts.

### Garment Tracker Cron Silently Dropped Every Record for Weeks (2026-04-27)
**Problem:** Q2 2026 dashboard showed "0 of 0 orders processed" at day 27 of the quarter. Manual sync also produced nothing. Daily Heroku Scheduler `sync-garment-tracker` had been firing at 1 PM UTC the whole time — logs said `Status: SUCCESS` every run.
**Root Cause:** Three failures stacked. (1) Sync script POSTed `Quarter` and `Year` fields to `/api/garment-tracker`; the live `GarmentTracker` Caspio table only had those columns on the **archive** table — Caspio rejected with 500 `ColumnNotFound`. (2) The proxy POST handler ate the error as a generic "Failed to create/update record" so logs showed no detail. (3) The script's bottom line was a hard-coded `console.log('Status: SUCCESS')` — it never inspected `liveErrors`, so red was indistinguishable from green in scheduler logs.
**Solution:** (a) Added missing columns. (b) Whitelisted POST body fields at the route layer so unknown fields drop silently and known-bad ones can't repeat the schema mismatch. (c) Forwarded Caspio's `Code`/`Message`/`RequestId` in 500 responses. (d) Made the script's Status reflect actual error counts (`PARTIAL` if any `liveErrors`) and `process.exit(2)` on `liveErrors > 0` so Heroku Scheduler shows red.
**Prevention:** Never write a cron summary line that reports SUCCESS unconditionally — the SUCCESS line is the **only signal** the scheduler reads, so it must be tied to actual error counters and `process.exit` non-zero on real failures. When a backend route is a thin Caspio passthrough, **whitelist body fields and propagate Caspio's structured error in the response** so a future schema drift surfaces in one log line, not three layers of "Failed to create/update record". Watch for the pattern where a daily-sync architecture means *no individual user* sees the breakage — silent failures live longer there than anywhere else.

### Garment Tracker Stale Data — Missing Daily Sync (not a retention issue)
**Problem:** Dashboard showed wrong commission totals. 33 records missing, 46 InkSoft records shouldn't count. Original 2026-03-25 root-cause analysis incorrectly attributed the 33 missing records to "fell off ManageOrders 60-day window."
**Updated Root Cause (2026-05-20):** No automated daily sync from ManageOrders → Caspio. Relied on manual sync button. InkSoft orders (type 31) weren't excluded. **The "60-day retention" assumption was WRONG** — MO actually retains ~2 years (verified by pulling 469-day-old orders 2026-05-20). The 33 "missing" records weren't lost to retention — they were never synced because the manual button wasn't clicked.
**Solution:** Created `sync-garment-tracker.js` daily script (Heroku Scheduler 1PM UTC). Added exclusion filters for InkSoft (type 31) and per-quarter customers. Consolidated config into single file (`config/garment-tracker-config.js`).
**Prevention:** Any ManageOrders-dependent feature needs a daily sync script — never rely on manual button clicks. Cross-reference ShopWorks CSV exports before commission payouts. **Don't assume MO retention is short** — actual retention is ~2 years per `caspio-pricing-proxy/scripts/test-mo-retention.js`.

### Quote-management dashboard fell through to editable dropdown for unrecognized statuses (2026-05-21) [archived 2026-06-03]
**Problem:** quote-management dashboard fell through to editable status dropdown when row had a status the renderer didn't recognize (Pending Payment, Payment Confirmed, Payment Confirmed - ShopWorks Failed), making the row appear as "Open" and letting a rep accidentally change it.
**Root Cause:** `renderTable()` only branched on Cancelled/Processed/Push Failed; all other statuses fell to the dropdown default. New statuses added to server.js (Stripe-flow statuses written at server.js:497, 561, 617) had no corresponding dashboard handler.
**Fix:** Added explicit branches + amber/teal/red badges + CSS rules for all 3 Stripe-flow statuses. Verified via synthetic test rows (real DB had only 1 Pending Payment row).
**Prevention:** When adding a new status string anywhere in server.js, grep dashboards/ for the status-rendering files and add a matching branch. Better: the `else { dropdown }` fall-through should log a `console.warn('[QuoteManagement] Unhandled status:', quote.Status)` so future unknown statuses are visible in dev tools rather than silently appearing as "Open".

### Art Request Download "Failed to fetch" — CDN URLs Can't Be Fetched Cross-Origin (2026-04-23) [archived 2026-06-03]
**Problem:** Steve reported lightbox Download button on art-request-detail "Artwork 2" tile alerted `Download failed: Failed to fetch`. Recurring across multiple requests.
**Root Cause:** `downloadLightboxImage()` in `pages/js/art-request-detail.js` only routed Box URLs through the proxy. The "Artwork 1–4" tiles come from `READ_ONLY_FIELDS` (`CDN_Link`, `CDN_Link_Two/Three/Four`, `File_Upload`) which store **Cloudinary/Caspio CDN URLs**, not Box URLs. Those fell through to raw `fetch(url)` which hit cross-origin CORS → `TypeError: Failed to fetch`. Image `<img src>` rendered fine (CORS doesn't apply to image tags), so the lightbox image looked normal — only Download broke.
**Solution:** Added a third branch that detects non-Box URLs and uses an anchor-tag open (`<a href download target=_blank>`) instead of `fetch()`. Browsers bypass CORS for plain navigations.
**Prevention:** When proxying downloads, enumerate ALL URL shapes a field can hold — not just the current-generation one. Legacy fields (`CDN_Link_*`, `File_Upload`) predate the Box-proxy era. For cross-origin resources you can't `fetch()`, fall back to anchor-tag navigation rather than swallowing the error.

### "Defensive" Cleanup Selector Nuked Static Overlays — Mark Complete Silently Broke (2026-04-23) [archived 2026-06-04]
**Problem:** Steve reported "Mark Complete does nothing" on art-request-detail. After an initial fix-deploy, testing live found it *still* broken — page showed "Error Loading" banner and the whole render chain was crashing silently. Two other features (Find Order, Send for Approval, Share with Customer) were also dead.
**Root Cause:** To mitigate a theorized orphan-overlay scenario I added `document.querySelectorAll('.art-modal-overlay, #quick-action-overlay').forEach(el => el.remove())` on page boot. The selector matched FOUR legitimate static HTML overlays that share class `art-modal-overlay`: `#find-order-overlay`, `#approval-overlay` (×2), `#share-customer-overlay`. Cleanup wiped them. Then `initShareWithCustomer()` called `overlay.addEventListener('click', ...)` on the now-null share overlay → TypeError → outer `.catch` in render() painted the "Error Loading" banner, and `renderSteveActions()` (which wires up Mark Complete) never got to run.
**Solution:** Narrow the selector to ONLY the dynamically-created overlay: `var el = document.getElementById('quick-action-overlay'); if (el) el.remove();`. Static HTML overlays MUST be left alone.
**Prevention:** **Never use a shared CSS class as a DOM-cleanup selector when static HTML elements also carry that class.** Use specific IDs for dynamic cleanup. Before adding any `querySelectorAll('.shared-class').forEach(remove)`, run `grep -rn 'class="[^"]*shared-class' --include='*.html'` to see every pre-declared element that selector will delete. Bonus lesson: a "defensive" fix that hasn't been ruled out with data can make things worse — prefer a try/catch around the suspect caller over reaching into the DOM.

---

## PDF Generation (xhtml2pdf)

### Handbook PDF corporate polish — xhtml2pdf 0.2.17 limits (2026-05-28) [archived 2026-06-09]
**Problem:** Polishing `scripts/build-handbook-pdf.py` (embedded brand fonts, full-bleed "Employee Handbook" cover with NWCA logo, Contents with real page numbers, page-numbered footers) hit a stack of xhtml2pdf failures: fonts wouldn't embed, the cover wouldn't full-bleed (white strips / leaked onto every page), footer page numbers rendered blank, and frame/TOC styling surprised.
**Root Cause:** (1) **`@font-face` is broken on Windows** — custom fonts silently fall back to Helvetica. (2) **xhtml2pdf cannot full-bleed an image** — the `<img>` flowable hard-caps at ~580.9pt wide (top-left anchored, ~94.76% of 612pt) AND named-`@page` backgrounds are silently dropped in 0.2.17. Only the DEFAULT `@page` background renders, and it leaks onto every page (applied as a post-process watermark via `pisaBackgroundList` — one entry covers all pages). (3) **A table cell whose ONLY content is the self-closing `<pdf:pagenumber/>` renders empty** — the tag needs adjacent literal text to emit. (4) Frame content (`@frame footer_frame`) does NOT inherit `body` font-family. (5) `table.toc td {border:none}` outranks `.toc-dot`, and xhtml2pdf renders `dotted` borders as solid hairlines anyway.
**Solution:** (1) Pre-register TTFs with reportlab in `register_fonts()` — `registerFont(TTFont(...))` + `addMapping()` per variant + set `DEFAULT_FONT` from `xhtml2pdf.default`. Resolves by font-family name, no `@font-face`. (2) **Render the body cover-less via xhtml2pdf (default `@page` = content style with footer), then prepend the PIL cover PNG as a full-page image with PyMuPDF** — `prepend_cover()`: `page.insert_image(page.rect, filename=...)`, saved `deflate=True, garbage=4` (else the gradient embeds near-lossless → 25 MB; deflate → ~400 KB total). Cover is page 0 + **unnumbered**; body numbered 1..N from Contents; chapter outline bookmarks offset +1. (3) Footer cell = `Page <pdf:pagenumber/>` — the literal "Page " forces the number to emit. (4) Set `font-family:HBSans` on `#footer_content`. (5) Removed leader dots — clean 3-column TOC.
**Prevention:** On Windows never rely on xhtml2pdf `@font-face`. **xhtml2pdf CANNOT full-bleed — composite covers/backgrounds with PyMuPDF AFTER rendering, never in CSS** (the `<img>` cap and the default-only/leaking `@page` bg are both dead ends). Any `<pdf:pagenumber/>` / `<pdf:pagecount/>` needs adjacent literal text or it renders blank. After any PyMuPDF `insert_image`, always `save(deflate=True, garbage=4)` or the file balloons. Verify rendered output with `get_text("dict")` span extraction — NOT `get_fonts()` (lists unused Helvetica on every page). Deps: `pip install xhtml2pdf Pillow PyMuPDF`.

### Silent file-upload failures created orphaned art requests (2026-05-08) [archived 2026-06-09]
**Problem:** AE submitted a Sticker request with a reference image; the request landed in Caspio with empty `File_Upload_One`. The form showed "Submitted!" success despite the upload silently failing. Steve saw an art request with no artwork and no way to know files were ever attempted.
**Root Cause:** `uploadFilesSequentially()` in JDS / Sticker / Banner forms swallowed upload errors with `results.push(null)` and proceeded to create the ArtRequest. Failures came from things like 409 FILE_EXISTS (Caspio Artwork folder is global — generic filenames collide across customers) or transient network issues.
**Solution:** Track failed file names in `failedFiles[]` alongside `results[]`. After the upload phase, if `failedFiles.length > 0`, abort the submission with a clear `Could not upload "<filename>" — please retry` toast and re-enable the submit button. The AE's typed input is preserved (form view isn't re-rendered) so they can retry without losing work. The 409 case is also handled server-side now: `files-simple.js` retries once with a timestamp suffix on collisions.
**Prevention:** **Never silently swallow upload errors when the upload is the user's primary intent.** Hard-fail the whole submission, surface the failure, let the user retry. Same pattern applies to any "submit form with attachments" flow — abort before the create-record step if any attachment failed.

### Outbound UPS Ground estimator: rough linear model → real Daily grid + fixed zones (2026-06-07) [archived 2026-06-09]
**Problem:** The prepay freight estimator (`caspio-pricing-proxy/src/routes/shipping.js` + EMB builder `estimateShipping()`) was self-flagged ROUGH: coarse ZIP-prefix zone buckets + a linear `base+perLb*lb` rate + a `1.12` fuel multiplier. Defects: (a) fuel ~12% vs real UPS Ground ≈25% (weekly index); (b) zone buckets wrong for far destinations from origin 983 — LA 900xx returned **zone 4** (should be ~6), Chicago 606xx zone 6 (~7); (c) `perBoxForCategory` inferred category by weight only, so Outerwear density (15/box) was UNREACHABLE (heavy outerwear boxed at Jacket 17). Also the repo note "SanMar shipment API returns no carton weight (confirmed)" was true only for the PromoStandards ASN — it overlooked SanMar's License Plate Number / GetPackingSlip service, which DOES return per-box `Weight` + box# + contents.
**Root Cause:** Built fast (2026-06-04) as a placeholder pending real UPS data, which UPS gates behind bot-blocked media URLs (`/media/us/currentrates/zone-csv/983.xls`, `daily_rates.xlsx`) — only downloadable in a browser. Category was never read from `/api/inventory` (`CATEGORY_NAME` IS present per row). Caspio `Box_Density_Reference` table was never created so the endpoint served hardcoded defaults.
**Solution:** Rates/zones now DATA in `data/ups-ground-rates.json` (real UPS 2025 Ground Daily grid zones 2-8 × anchor weights, interpolated; fuel 0.255; residential 6.50; distance-banded 983 zone ranges biased high). `shipping.js` interpolates the grid + `zoneForZip` prefers an exact `zonePrefixMap` (load the real 983 chart via `scripts/build-ups-zone-map.js`) and marks `rough:true` until then. New optional `boxWeightsLb[]` prices each box at its real weight (heavy jacket box vs light tee box). Frontend reads `CATEGORY_NAME` + sends category + per-box weights; `perBoxForCategory` uses the real SanMar category (Outerwear reachable, split at ≥1.7lb). Caspio table created + seeded via `scripts/seed-box-density-caspio.js` → endpoint now `source:"caspio"` (tunable, no deploy). Worked example (12 caps+13 jackets+12 PC61→98390) = $55.33 commercial / $61.83 residential (node + jest `tests/jest/shipping-estimate.test.js`). List rates = UPPER BOUND; true cost needs UPS Rating API (deferred, "UPS API later").
**Prevention:** Keep external rate tables as editable DATA files, not hardcoded constants. UPS zone charts are ORIGIN-SPECIFIC — a generic online chart is the mirror image of a 983 origin (it'd put NYC at zone 2); only `983.xls` is correct for Milton WA. Infer product category from the real `/api/inventory` `CATEGORY_NAME`, not weight guesses. Caspio REST `/tables` create rejects an explicit AUTONUMBER PK from our token (400) — use a minimal column body. "API returns no X (confirmed)" must name WHICH service — SanMar ASN ≠ LPN. Detail: `memory/freight-estimator-details.md`.

### `/api/company-contacts/*` 3-bug cascade — autocomplete + nightly sync silently broken (2026-05-07) [archived 2026-06-11]
**Problem:** Customer autocomplete in 4 quote builders + Sticker/Banner intake + JDS intake silently returned "No customers found" for every query. Nightly contacts sync (Heroku Scheduler) errored on every contact upsert. Affected `/search`, `/by-company`, `/by-customer/:id`, `/by-email/:email`, `POST/PUT`, and `POST /sync`.
**Root Cause (3 stacked bugs, found in deploy order):**
1. **`q.sort` is invalid in Caspio v3** — should be `q.orderBy`. 29 routes used the correct param; 3 (`company-contacts.js`, `company-contacts-2026.js`, `art.js`) had stray `q.sort`. Caspio responded 400 IncorrectQueryParameter.
2. **Caspio v3 rejects `q.limit < 5`** — same constraint that's documented for `q.pageSize`. Frontend autocomplete asked for `limit=3-10`; values 1-4 hit the floor and returned 400.
3. **Legacy `Company_Contacts_Merge_ODBC` columns dropped from the schema** — `Customersts_Active`, `Customerdate_LastOrdered`, etc. no longer exist on that table. Caspio returned `SqlServerError: "Invalid column name 'Customersts_Active'"`. The newer `CompanyContactsMerge2026` table has equivalents.
**Solution:** Every endpoint in `company-contacts.js` now queries `CompanyContactsMerge2026`. Two helpers preserve back-compat — `mapRecordToLegacyShape()` adds legacy field-name aliases on read, `translateBodyToNewSchema()` converts incoming POST/PUT keys. **Frontend untouched.**
**Prevention:** Three patterns to avoid:
1. **Don't trust route-test status codes for cron-triggered jobs.** The sync's `try/catch` wrapped each contact and aggregated errors into `stats.errors` — when every contact failed the same way, the wrapper returned 200 with `errored=0`. Sync logs need **content-level** asserts (e.g., "expected at least 1 update if there were N orders"), not just "didn't crash."
2. **`q.sort` in Caspio is silently invalid.** Standardize on `q.orderBy` and grep for `q.sort` in CI. Same goes for `q.limit < 5`.
3. **When a Caspio table is migrated/renamed/columns dropped, search for references across all routes** — the proxy had 6 endpoints still pointing at the old table for months. A periodic `grep -rn "Company_Contacts_Merge_ODBC"` audit would have caught it earlier.

### Art-request notes never reached Steve; the "notify" checkbox emailed the rep "from Steve" and fired no Slack (2026-05-29) [archived 2026-06-11]
**Problem:** Adding a note in the Art Request "Notes & Activity" panel notified nobody useful. `POST /api/design-notes` was a pure Caspio write; the only alert was a frontend `emailjs.send` gated on a checkbox labeled "Notify sales rep" that emailed `Sales_Rep || User_Email` with `from_name:'Steve (Art Dept)'`. So an AE's note meant for Steve went to the rep (wrong direction), Steve got nothing, there was no Slack, and a stand-in covering an absent rep (Erik for Taneisha) was invisible in BOTH directions.
**Root Cause:** Notification lived in the browser, was hardcoded unidirectional (always → rep, always "from Steve"), and routed solely to the rep-of-record with no model of who actually needed the note or who was watching the thread.
**Solution:** Moved notification to the backend chokepoint `POST /api/design-notes`: direction-aware fan-out (AE note → Steve `art@`; artist note → rep via `resolveAEEmail`) on BOTH Slack (`slack-art-note-notify.js`, reuses `SLACK_ART_NOTIFICATIONS_WEBHOOK_URL`) and email (`send-art-note-email.js`, `@emailjs/nodejs`), plus WATCHERS = prior note authors resolved via `resolveAEEmailLoose` (full-name→first-token, internal-domain-guarded) minus poster/primary — so a stand-in receives replies with NO Caspio schema change. Fire-and-forget; the note always saves. Frontend sends `Posted_By_Role`/`Posted_By_Email`/`notify` and the old EmailJS was deleted. Proxy Heroku v767, frontend v2026.05.29.7, 32 jest tests.
**Prevention:** Put notifications on the backend write chokepoint, not the browser — one path covers every caller and fans out to multiple channels atomically. Never assume the "rep of record" is the only audience: route by who WROTE it + a watchers set so an absence never black-holes replies. **Mockup parity SHIPPED 2026-05-29** (proxy v768): the same fan-out now lives on `POST /api/mockup-notes` (`Digitizing_Mockup_Notes`) via NEW `slack-mockup-note-notify.js` (#mockup-notifications, `/mockup/` links) + REUSED `send-art-note-email.js` (additive optional `detailPath:'/mockup/'`/`linkId` — art callers unchanged). Direction = `Posted_By_Role` → `Note_Type` (`ae_instruction`/`artist_note`) → author heuristic; artist note → rep (`Sales_Rep||Submitted_By`), AE note → Ruth `ruth@`. **Gotcha:** once the backend fans out on EVERY `/api/mockup-notes` POST, the 8 audit/system note POSTs (status changes, reminders, file-adds, customer-approval-sent) MUST send `notify:false` or they double-fire alongside their existing dedicated emails — only the human note composer fans out.

## Caspio Embed Script Overrides Host Page CSS (2026-05-13) (archived 2026-06-11)
**Problem:** Staff Dashboard v3 rendered correctly for ~500ms then "reverted" to dim grey. Sidebar, sales-goal pace pill, body text all overridden after page load.
**Root Cause:** The Caspio auth DataPage embed (`<script src=".../emb">`) injects 4 stylesheets into `<head>` at runtime AFTER our dashboard CSS — `semantic.css`, `responsive576.css`, `responsive1024.css`, and a per-DataPage CSS. Cascade order: Caspio's CSS wins (later in source). Headless preview never reproduced it because Caspio's embed silently aborts with no live auth.
**Solution:** `staff-dashboard-v3/caspio-isolation.js` — non-module script in `<head>` BEFORE the Caspio embed runs. Sets up `MutationObserver` that catches every `<link>` Caspio injects with `caspio.com` in href, sets `disabled = true` + `media = "not all"`. Caspio JS still runs and populates auth fields; only its CSS is blocked.
**Prevention:** Any future page embedding a Caspio DataPage MUST include `caspio-isolation.js` (or equivalent) early in `<head>`. Full details + reusable pattern + test plan in [CASPIO_CSS_ISOLATION.md](./CASPIO_CSS_ISOLATION.md).

---

## DTG LTM fee/threshold lived in 4 different files (2026-05-18) (archived 2026-06-11)
**Problem:** Erik wanted to bump or remove the $50 DTG LTM fee. That single number was hardcoded in 4 places: backend `lib/dtg-canonical-pricing.js`, frontend `dtg-pricing-service.js`, `pages/order-form/pricing/methods/dtg.jsx`, `calculators/dtg-pricing.html`. The `qty < 24` threshold was also hardcoded across all 4. Changing the fee would have been a 4-PR + 4-deploy nightmare.
**Root Cause:** Caspio's `Pricing_Tiers` table already had an `LTM_Fee` column (queried by `/api/dtg/product-bundle`), but the value was `0` for all 3 DTG rows and no code read it — every consumer reimplemented "qty<24 → $50/qty floored" inline.
**Solution:** Added a 4th DTG row to `Pricing_Tiers`: `TierLabel='1-23' MinQty=1 MaxQty=23 MarginDenominator=0.57 LTM_Fee=50 DecorationMethod='DTG'`. Refactored all 4 files to (a) find the tier row by qty range (no special `<24` branch), (b) read `LTM_Fee` off the resolved row. The canonical module also got a "smart print-cost fallback": when the LTM tier has no `DTG_Costs` rows, it uses the lowest non-LTM tier's costs (preserves the historical "LTM uses 24-47 print cost + LTM fee" pattern).
**Prevention:** Any pricing constant that has a corresponding Caspio column MUST be read from the column, not duplicated in code. When adding a new pricing method, audit for hardcoded `$50` / `<24` / `<7` before shipping. The 19 jest scenarios in `caspio-pricing-proxy/tests/jest/dtg-canonical-pricing.test.js` pin the Caspio-driven contract — they include a `LTM_Fee=75` test that proves accounting can change the value with no code change.

---

### Richardson calculator drifted from the Embroidery Quote Builder — leatherette model, margin, tiers (2026-05-29) — ARCHIVED 2026-06-11
**Problem:** `calculators/richardson-2025.html` priced a leatherette/laser patch with its own `leatherettePricing + leatheretteLabor` table (~$11/cap, no setup), but the Embroidery Quote Builder prices the same patch as **cap embroidery base + $5/cap + $50 GRT-50 setup, no stitches**. Richardson also hardcoded `marginDenominator=0.57` (live API = 0.53) and used a `getTier()` returning `'1-23'` — a label the CAP API doesn't have (it uses `1-7`/`8-23`), so embroidery cost silently fell back to $12 instead of the real $17 at low qty. Net: leatherette under-quoted by ~$6/cap + the missing $50 setup; embroidery under-quoted at small qty.
**Root Cause:** A standalone calculator reimplemented the cap pricing model instead of mirroring the quote builder, and hardcoded values (margin, tiers, patch cost) that all have Caspio columns. The `'1-23'` tier key was never validated against the API's tier labels, so `embroideryCosts['8000'][tier] || 12` masked the miss as a plausible price.
**Solution:** Rewrote `richardson-factory-direct.js` to mirror the builder: `getTier()` → `1-7/8-23/24-47/48-71/72+`; margin from `tiersR[0].MarginDenominator`; patch upcharge from `method=PATCH` (ItemType `Patch`); $50 setup from `/api/service-codes` GRT-50; leatherette = embBase + $5/cap + $50 setup; LTM at qty ≤ 7 (not < 24). Deleted the leatherette+labor tables. Verified per-cap + totals match hand-calcs across embroidery/leatherette × small/large qty (e.g. $7.65 blank, leatherette @24 = $35.08/cap, $842 incl. $50 setup).
**Prevention:** Per Never-Break rule #7, a calculator that duplicates a quote-builder method MUST produce identical math — mirror its formula and pull margin/tiers/upcharges from the SAME Caspio endpoints, never hardcode. ALWAYS validate tier-label strings against the live API (`TierLabel`); a `find()/['key'] || fallback` silently hides a key mismatch as a wrong-but-plausible price.

### Phase 3.1 — shared `pricingData` contract locks the invoice generator's input (2026-06-02) — ARCHIVED 2026-06-11
**Problem:** Four builders (DTG inline-form + EMB/SCP/DTF) each constructed `pricingData` differently for the shared `EmbroideryInvoiceGenerator`. The 2026-06-01 PDF-totals fix had to be applied 4× because no contract existed: DTG used `pricingTier`/`combinedQuantity`, the trio used `tier`/`totalQuantity`; DTG sent tax as decimal, the trio as percent; SCP/DTF/EMB re-overrode `taxRate` (and SCP also `ltmDistributed`) AFTER the builder returned by re-reading the DOM in `printQuote`; DTF named the design fee `graphicDesignFee` while the other 3 used `graphicDesignCharge`. The generator also still read two vestigial fields — `garmentLtmFee` and `capLtmFee` — that no builder had set in this codebase.
**Root Cause:** No documented input shape. Each builder evolved independently; the generator absorbed drift via `||` unions (graphicDesignFee || graphicDesignCharge) and per-call normalization. Without a contract, the next change to the invoice has to be re-discovered per builder.
**Solution:** New `shared_components/js/quote-pricing-data.js` exposes `window.QuotePricingData.buildPricingData()` + `validatePricingData()`. All 4 builders now wrap their return value in `buildPricingData({ method: 'DTG'|'EMB'|'SCP'|'DTF', … })`. The contract derives `isDTG`/`isScreenprint`/`isDTF` from `method` (generator dispatch unchanged), normalizes percent→decimal tax, zero-fills 17 fee fields, and validates 10 required ones. Each builder's `printQuote` no longer post-overrides `taxRate`/`ltmDistributed` — the builder reads the DOM once. DTF's `graphicDesignFee` renamed to `graphicDesignCharge`. Dead `garmentLtmFee`/`capLtmFee` render blocks removed from `embroidery-quote-invoice.js`. Validator severity: throws on `localhost`/`*.herokuapp.com` (dev/staging surface bugs immediately), warns elsewhere (never breaks a live customer print). 11 new Jest tests in `tests/unit/invoice-totals.test.js` lock the contract; all 949 unit tests pass.
**Prevention:** When N call-sites build the same shape, write the shape down (in code, not a doc) — a builder function + validator stops drift cold and gives every future fix one place to land. For browser-global modules loaded via `<script>`, expose under a namespaced `window.*` object and require the `<script>` BEFORE the consumer's. Validator severity should be host-aware: dev hosts (localhost, herokuapp.com) THROW so problems surface during development; production WARNS so a bad input never blocks a customer-facing action. NEVER post-override fields in the caller AFTER calling a normalizer — the contract has no chance to validate them.

### Design ExtDesignID collision: transfer order showed an embroidery design (2026-06-02) — ARCHIVED 2026-06-11
**Problem:** A DTF Transfer order (WO#142003, `DTF-2026-0602-9402`) displayed the EMBROIDERY order's design in ShopWorks — "EMB TEST — NWCA Logo (Left Chest)", type EMB, 8000 stitches, code EMB-1 — instead of its own DTF transfer design. Wrong design → wrong production routing (transfer work would land in the embroidery queue).
**Root Cause:** All 3 push transformers built the design's `ExtDesignID` from only the TRAILING sequence — `G-${extractSequence(QuoteID)}` (EMB) / `G-${QuoteID.split('-').pop()}` (SCP/DTF). ShopWorks dedupes designs by `ExtDesignID`, so any orders sharing a trailing number got merged into ONE design (whichever imported first won — here the EMB one). The 3 test orders all ended in `9402` → all `G-9402` → merged. **It collides in production too:** cross-method (`EMB-2026-5` + `DTF0601-5` → both `G-5`) and cross-day for date-packed IDs (`DTF0601-1` + `DTF0602-1` → both `G-1`, since MMDD IDs reset the sequence daily).
**Solution:** Base the design `ExtDesignID` — and the SCP/DTF garment line `ExtDesignIDBlock` that links to it — on the FULL unique QuoteID: `G-${session.QuoteID}` → `G-SP0602-9402`, `G-DTF0602-9402`, `G-EMB-2026-9402`. EMB lines don't carry `ExtDesignIDBlock` (design attaches at order level), so only its design `ExtDesignID` changed. Regression test `push-size-suffix.test.js` (same-trailing-seq → different ids; line link matches). Shipped proxy **v780** (`1329465`). Verified live via preview endpoints: all 3 design ids distinct, each with its own correct DesignName. **Already-pushed 142002–142004 still share the merged EMB design (pushed pre-fix) → re-push with fresh QuoteIDs or fix in SW.**
**Prevention:** A ShopWorks `ExtDesignID` (and any external dedupe key) must be GLOBALLY unique — NEVER derive it from just a trailing sequence number. Date-packed QuoteIDs (`DTF0601-1`) reset the sequence daily and small sequences collide across methods. Use the full QuoteID or the year-safe ExtOrderID. SW merges designs that share an `ExtDesignID`, silently attaching the wrong design (and its type) to an order. Same root pattern as the 2026-06-01 ExtOrderID daily-collision fix (`buildExtOrderID`) — the design ID just didn't get the same treatment.

### DTG edit-reopen never fired + dashboard Edit opened the wrong builder (2026-06-01) — ARCHIVED 2026-06-11
**Problem:** Reopening a saved DTG quote to edit was broken two ways: (1) the DTG builder's `?edit=` handler never ran, so the form stayed blank; (2) the Quote-Management dashboard's Edit button opened DTG/DTF/SP quotes in the **embroidery** builder (and routed SCP to a 404 filename). DTG was meant to be the reference the other 3 builders mirror, yet its own edit-reopen (Phase 11.6) had never actually worked since it shipped.
**Root Cause:** Stale EMB-QuoteID-format assumptions leaking into DTG/DTF/SP code. EMB IDs are `EMB-2026-001` (hyphen after prefix); DTG/DTF/SP are date-packed `DTG0311-1`/`DTF0601-1`/`SP0601-9001` (NO hyphen). (1) `dtg-inline-form.js` guarded edit-load on `/^DTG-/` — never matches `DTG0311-1`, so `loadSavedDtgQuoteForEdit()` was never called. (2) `quote-management.html` derived the prefix via `quoteId.split('-')[0]` → `"DTG0311"` (≠ `"DTG"`), so every non-EMB quote fell through to the EMB builder default; the SCP branch pointed at a nonexistent `screen-print-quote-builder.html` (real file is `screenprint-quote-builder.html`), and there was no DTF branch. Both dashboard gates also locked edits only on `Status`, ignoring `PushedToShopWorks` — so a pushed-but-`Open` quote (the EMB/SCP/DTF post-push window) still showed an enabled Edit button.
**Solution:** (1) Guard on `/^DTG/i`. (2) Derive prefix from leading letters only — `(String(quoteId).match(/^[A-Za-z]+/)||[''])[0].toUpperCase()` — and map DTG/DTF/SP(+SPC/SSC) to their real builder filenames. (3) Lock the dashboard Edit button render + `editQuote()` guard on `PushedToShopWorks` too, mirroring shared `assertQuoteEditable()` (which already gates on it). Verified live: `DTG0311-1` (Adam's DJ Service · PC150/Jet Black) loads into the form with the Rev-1→Rev-2 edit banner; a synthetic pushed-but-`Open` session returns `false` from `assertQuoteEditable`.
**Prevention:** A QuoteID prefix is its LEADING LETTERS — never `split('-')[0]`, which only survives EMB's hyphenated format. When copying edit-load/routing logic from EMB to a date-packed-ID builder (DTG/DTF/SP), re-audit every prefix regex and split. Lock edits on `PushedToShopWorks`, not just `Status` — the hourly sync flips Status→`Processed` only AFTER ShopWorks imports, so a freshly-pushed quote reads `Open` for up to an hour.

### ShopWorks ManageOrders integration ignores per-order TaxPartNumber (2026-05-20) — ARCHIVED 2026-06-11
**Problem:** After fixing the prior tax bug (sending the right `TaxTotal` amount), OF-0042 still showed up in ShopWorks with `TaxPartNumber: "Tax_10.1"` and `TaxPartDescription: "City of Milton Sales Tax 10.1%"` — exactly what we configured at the integration level, NOT what we sent in the payload (we sent generic `"TAX"`). For Milton pickup orders this was correct by coincidence (both 10.1%). For a Seattle 10.35% order, ShopWorks would have applied the same Milton label — wrong GL account, wrong customer-facing description.
**Root Cause:** ShopWorks's ManageOrders integrations have hardcoded `Tax Line Item` + `Tax Account` defaults that stamp on every order with `TaxTotal > 0`. The payload's `TaxPartNumber` / `TaxPartDescription` are ignored. There's no per-order override mechanism.
**Solution:** Send `TaxTotal: 0` to suppress the auto-stamp entirely. Carry the destination rate, matched Caspio account number, and dollar amount in a structured `Notes On Order` block instead. Rep manually adds the correct tax line in ShopWorks using the Notes as a cheat sheet. The `buildOrderNote()` function in `server.js` generates 4 variants (pickup, in-WA ship, out-of-state ship, needs-review fallback).
**Prevention:** Don't assume payload fields override integration-level defaults — test by sending deliberately-wrong values and seeing what surfaces in OnSite. Document integration behavior in `memory/wa-sales-tax-rules.md`. If per-order override is ever needed, ask Bradley about cloning integrations per rate bucket and routing via `APISource`.

---

### WA DOR tax-rate lookup discarded valid rates on ResultCode 2 → wrong sales tax (2026-06-03)
**Problem:** The shipping-address tax lookup (`/api/tax-rates/lookup`, proxy `src/routes/tax-rate.js`) returned the WRONG rate for many WA addresses — it showed "Default rate 10.1% (DOR unavailable)" and billed 10.1% for Bellevue (actually 10.3%) and Tacoma streets (actually 10.4%). Wrong tax = Erik's #1 rule.
**Root Cause:** The WA DOR AddressRates API DOES return the correct LOCAL rate even when it can't match the exact street — it falls back to the ZIP-level rate and sets a non-zero ResultCode (observed: `Rate=.103 ResultCode=2`). `callDorApi()` treated `resultCode === 2` as an error and returned `null`, discarding a perfectly good rate; the endpoint then fell back to a HARDCODED 10.1% default — often itself the wrong rate. The code comment "2 = error" was simply wrong about DOR's semantics.
**Solution:** `callDorApi()` now accepts ANY positive rate regardless of ResultCode; only a non-positive rate (DOR returns `Rate=-1.0` when truly not found) counts as a miss. Added a ZIP-only retry: if the address-based call still yields nothing AND a street was supplied, retry without the street (ZIP-centroid) before defaulting. Verified live with cache cleared: Bellevue→10.3% (acct 2200.103), Seattle→10.5%, Tacoma→10.4% (2200.104), Milton→10.1%, OR→0% — all `source=dor`/static, zero bad fallbacks. Proxy Heroku v783.
**Prevention:** When a 3rd-party geocoding/rate API returns a status/result code, don't treat "not an exact match" as "no data" — inspect the actual payload (a valid rate came back with ResultCode 2). Only discard on the sentinel the API documents for failure (here `Rate=-1`). For address→rate lookups, always retry ZIP-only before a hardcoded default — a hardcoded fallback that's the WRONG number is worse than the lookup it replaces. The frontend correctly displayed the fallback as a visible amber warning (no-silent-failure rule held); the bug was the backend substituting a wrong number behind that warning.

_(Shipping/Freight: UPS Ground estimator lesson archived 2026-06-09 → LESSONS_LEARNED_ARCHIVE.md; detail in `memory/freight-estimator-details.md`.)_

---

### Push button stranded disabled — label-destroying spinner + checklist/button desync (2026-06-07)
**Problem:** EMB "Push to ShopWorks" button stayed greyed/disabled even with the readiness checklist ALL-GREEN (Customer #, ≥1 item, name, email). Rep couldn't push. Verified fixed live (Erik pushed EMB-2026-301).
**Root Cause:** TWO independent bugs. (1) The "Preparing preview…" loading spinner did `pushBtn.innerHTML = '<spinner>…'`, which DESTROYED the `#emb-push-shopworks-label` child element — and `updatePushButtonState()` bails `if (!btn || !label) return`, so once the label was gone it never re-enabled. (2) The REAL cause: a DIRECT `renderPushReadiness()` call (the product-change path ~line 6341) refreshed the CHECKLIST but never re-gated the BUTTON → they desynced (checklist green, button stale-disabled). Earlier orders worked only because the customer-lookup path happened to fire the full `updatePushButtonState()` last.
**Solution:** (1) spinner now updates the LABEL's content, not the button's `innerHTML`; `updatePushButtonState()` no longer bails on a missing label (guards each `label.textContent` write). (2) `renderPushReadiness()` now ALSO gates the button (`disabled = !(hasCustomer && hasProducts && hasName && hasEmail)`) from the same readiness object — checklist + button can't desync. Verified in Erik's live browser via Chrome MCP: forcing the button enabled then calling `renderPushReadiness()` re-gated it back to match the true 3/4 state (`restoredDisabled:true`) — proving the render now drives the button.
**Prevention:** (a) NEVER replace a button's `innerHTML` when it holds a child element other code reads by ID (the label) — mutate the child's content instead, and don't let a state-reader bail on a transiently-missing child. (b) When a "status checklist" and the "action button" it describes render from DIFFERENT code paths, they WILL desync — gate the button from the SAME function that draws the checklist (one source of truth), don't rely on a separate update call firing on every change. Self-verify UI-state bugs in the live browser (Chrome MCP `javascript_tool`) — reading the gate's behavior beats eyeballing.

### Don't regenerate combobox menu DOM on hover (2026-05-20) [archived 2026-06-12]
**Problem:** Customer search dropdown — Erik hovered a row, then mouse-clicked, but the click never selected. Keyboard ArrowDown+Enter worked fine. Took 4 deploys to find the real root cause.
**Root Cause:** On `mouseenter`, the handler called `paint()` which set `menu.innerHTML = ...` — destroying every DOM node and recreating them with the active class on the hovered one. Real mouse motion between mousedown and click had enough latency for the destroy-and-recreate to lose the click target intermittently. Synthetic `dispatchEvent(new MouseEvent('mousedown'))` smoke tests gave false positives because they're synchronous (no DOM churn between event dispatch and listener execution).
**Solution:** On hover, toggle the `.active` class via `classList.toggle()` on existing items — don't regenerate the HTML. Same fix applied to all 3 free-typing comboboxes in `shared_components/js/dtg-inline-form.js` (style, color, customer) that had the pattern.
**Prevention:** Never regenerate DOM nodes during user interactions (hover, mid-click). Update CSS classes / text content in-place. Smoke tests for interactive selection should use the full `mousedown + mouseup + click` sequence with proper `button: 0, buttons: 1` props — bare `dispatchEvent('mousedown')` is a false-positive trap.

### Stale Caspio-Compat Shims in Proxy Outlive the Data Fix (~2025-09) [archived 2026-06-12]
**Problem:** After deleting an orphan `1-23` tier from `Pricing_Tiers` (EmbroideryCaps), `/api/pricing-bundle?method=CAP` *still* returned the orphan.
**Root Cause:** A proxy shim `response.tiersR.unshift({TierLabel:'1-23',...})` (commit c160648) papered over a missing Caspio row; the later 5-tier migration split 1-23 into 1-7+8-23 but the shim was never removed, clobbering correct data on every CAP response.
**Solution:** Removed the shim (proxy v612).
**Prevention:** When backfilling missing data via proxy injection, leave a `// REMOVE WHEN <X> IS FIXED IN CASPIO` marker; audit such shims whenever the table changes shape. Verify the response matches the table, not just the table.

### Quote Sequence Race Condition — Concurrent Requests Get Duplicate IDs [archived 2026-06-12]
**Problem:** Two rapid saves could get the same sequence number. **Root Cause:** Caspio has no atomic increment; GET-then-PUT isn't atomic. **Solution:** In-memory mutex lock per prefix (promise queue). **Prevention:** Any read-modify-write on Caspio needs application-level locking.

### `await` in a sync fn that only looks like the async one — EMB recalc vs updatePricingDisplay (2026-06-03) [archived 2026-06-12]
**Problem:** Adding the Additional Logo bar line item, I put `await syncALRows()` beside `syncRushRow(); updateTaxCalculation();`, assuming that block ended `async recalculatePricing()`. It is actually the tail of `updatePricingDisplay(pricing)` — a SYNC fn. `SyntaxError: await is only valid in async functions` took the WHOLE embroidery-quote-builder.js down → every global undefined, Services bar blank.
**Root Cause:** `recalculatePricing()` (async) delegates rendering to `updatePricingDisplay()` (sync); `syncRushRow`/`updateTaxCalculation` live at the end of the SYNC one.
**Solution:** Keep the display fn sync; re-price a tier-priced line only on its own qty/stitch/type change.
**Prevention:** Run `node --check <file>` BEFORE browser verification — one syntax error nukes the whole script and reads as "nothing loaded."

### Two shipping-path pricing bugs the estimator exposed (2026-06-08) [archived 2026-06-14]
Adding the UPS-Ground estimator to DTF/SCP (shipping fees now routine) surfaced 2 pre-existing money bugs — found by adversarial cert review, NOT by 1000+ unit tests:
- **Non-idempotent recalc (double-count):** `updateTaxCalculation` read its base from the SAME `#pre-tax-subtotal` it writes → a 2nd DIRECT call (tax-rate / shipping-fee / include-tax change, not via the full recalc) re-added fees+shipping → inflated on-screen total + PDF. Fix: the recalc owns a stable `data-base` attr (= products `grandTotal`); tax-calc only READS it, textContent stays display-only. **Rule: a recalc must NEVER read its own written-back display as its base.** (EMB was immune — recomputes base from source each call.)
- **Saved-mirror SHIP-row gap (under-charge):** SCP saved `TotalAmount` EXCLUDING shipping (by design — `/quote`+`/invoice` mirror re-adds it via `getShippingFee`, which reads `EmbellishmentType='fee'` & `StyleNumber='SHIP'`) but never wrote that SHIP row → saved view silently dropped shipping + its tax. Fix: write the SHIP fee item in BOTH save paths (mirror EMB `embroidery-quote-service.js`). DTF dodged it by baking shipping into `TotalAmount` (right total, no Shipping row). **Rule: if `TotalAmount` excludes a charge the mirror re-adds, you MUST persist the row the mirror reads.**
- **Saved `TaxAmount` base must match the mirror (3rd bug, exposed by the SHIP-row fix):** `/invoice` (invoice.js:795) TRUSTS the saved `TaxAmount` verbatim — only `/quote` recomputes from rate — so the saved `TaxAmount` MUST tax `(base + shipping)` (WA taxes shipping). SCP taxed base-only → `/invoice` under-charged the shipping tax. Fixed both save sites + locked by `tests/unit/scp-tax-base.test.js`. **DTF stays correct via a two-fact cancellation (TotalAmount INCLUDES shipping AND no SHIP row → the mirror's `+getShippingFee` = 0); if DTF ever adopts SCP's SHIP-row write it MUST also drop shipping from TotalAmount in the SAME change, else shipping double-counts ($173 vs $143).** All 5 SCP tax surfaces audited to agree (wkyypsd3a).

### DTG save read the AI chat quote, NOT the manual form — decoupled-source desync (2026-06-08) [archived 2026-06-14]
**Problem:** DTG Phase 1 tax/wholesale parity. `handleSaveQuote` (dtg-quote-page.js) — the ONLY quote_session writer — read `aiState.currentPriceQuote`, set ONLY by the AI chat's PRICE_QUOTE block (`:997`). The manual inline-form (`state`) NEVER wrote it (`ENABLE_BOT_FORM_FILL=false`), so saving a manually-edited DTG quote persisted STALE AI data, and a purely-manual quote couldn't save at all (Save button gated on an AI quote). **Root cause:** two independent quote sources (AI blob vs form `state`), save bound to the wrong one. **Fix:** `handleSaveQuote` now PREFERS `window.DTGInlineForm.getSaveQuote()` (the live tax-bearing form quote), AI quote = fallback only; added a Save button to the form. Persist `TotalAmount` PRE-tax + explicit `TaxRate`(decimal)/`TaxAmount` so `/invoice` (reads TaxAmount verbatim) doesn't double-tax. **Prevention:** when adding tax/fees to a save, confirm WHICH object the save serializes actually reflects the on-screen total — don't graft a field onto a stale source. Locked by `tests/unit/dtg-tax-base.test.js`.
**Meta-lesson:** a 5-agent adversarial review OF THE DIFF caught 3 money-path majors that 1026 unit tests + manual live checks missed — incl. edit-reload not re-syncing the pickup-toggle DOM (one click reverted a shipped quote to 10.1%) and stale per-row `_priceBySize` leaking into the PDF on an invalidated row. **Run an adversarial diff review before deploying any money-path change**; when a row "fails to price", clear ALL its derived fields (not just `_perPiece`/`_lineTotal`). (Caspio serializes a saved Number `0` as numeric `0`, NOT `''` — verified across 71 quotes; `/quote`'s `TaxRate != null && !== ''` guard renders 0% correctly.)
**Reset-bleed (the recurring resetQuote rule, this time on DTG):** `resetForm()` rebuilt `state.shipping` WITHOUT the new `includeTax`/`taxRateOverride` flags → after a "New Quote" reset `includeTax===undefined` → `!includeTax` opt-out branch fired → **every post-reset quote silently went 0% tax** (under-charge), checkbox still checked. **Rule (already true for EMB/DTF): EVERY new tax/toggle flag MUST be re-seeded in the builder's reset path** — a missing key reads `undefined`, and `!undefined===true` flips the wrong branch.

### Extracting a shared band module — alias globals + test-harness load order (2026-06-08) [archived 2026-06-14]
**Pattern:** Phase 0 of the DTF/SCP parity moved EMB's `renderOrderRecap`/`renderShipToCard`/`reestimateShipFromCard` out of `embroidery-quote-builder.js` into a shared, selector-agnostic `quote-order-summary.js` (configured via `QuoteOrderSummary.configure({selectors, logos, estimate})`). The builder has ~6 BARE call sites (`renderOrderRecap()`) that would throw once the local defs are gone.
**Solution/Prevention:** (1) The module aliases `window.renderOrderRecap/renderShipToCard/reestimateShipFromCard`, so bare call sites resolve to the globals — but the module MUST load BEFORE the builder (`<script>` order: the builder's `configure()` runs at eval time and needs `QuoteOrderSummary` defined). (2) GOTCHA: the jsdom unit harness `emb-edit-reload-roundtrip.test.js` injects scripts MANUALLY (`inject(UTILS_SRC)`…`inject(BUILDER_SRC)`) — a new shared dep must be added to the inject list IN ORDER, else the moved functions are undefined in tests and unguarded calls throw. (3) Keep per-builder CONTENT (EMB's `primaryLogo`/`capPrimaryLogo`) as a `logos()` CALLBACK in the builder (closure over its module scope) — the shared module can't see the builder's `let`s. Byte-identical output verified live + locked by `tests/unit/quote-order-summary.test.js`. **DTF+SCP adoption (Phase 2/3, v2026.06.08.6):** (4) when a builder's ship fields are emitted by a SHARED renderer (SCP's `renderOrderShippingFields` → `.os-ship-*` inside `#spc-order-fields`), attach the band's render hooks as builder-LOCAL `addEventListener`s AFTER that render call — NEVER edit the shared util (`quote-builder-utils.js` also serves the Order Form). (5) `setOrderShippingData(container, {})` does NOT blank fields (its setter guards `if (el && val)`) → an always-visible card re-renders the PRIOR quote's address on reset; blank the scoped fields explicitly in resetQuote. (6) SCP selectors must be SCOPED (`#spc-order-fields .os-ship-zip`) since `.os-*` are generic shared classes (`getShipFields` uses single-match `querySelector`). (7) Each builder's reset/edit-reload/draft path needs its OWN `renderOrderRecap()` — adversarial review caught a stale band on BOTH DTF `restoreDraft` and SCP `resetQuote`.

### Double size-suffix: quote-builder push transformers pre-suffixed the PN (2026-06-02) [archived 2026-06-15]
**Problem:** SCP/DTF/EMB ShopWorks pushes double-stamped the size suffix on extended sizes — `PC54_2X_2X`, `29M_2X_2X`, OSFA caps `C112_OSFA_OSFA`. Only visible AFTER OnSite *processes* the API-intake order (the intake JSON shows a clean single suffix, so earlier conversion-only verification missed it — Erik caught it on the processed order).
**Root Cause:** The 3 quote-builder transformers (`lib/{scp,dtf,embroidery}-push-transformer.js`) built garment lines with `PartNumber: getPartNumber(StyleNumber, size)` → emitted a PRE-suffixed PN (`PC54_2X`) AND sent the plain `Size: "2XL"`. ShopWorks's **Size Translation Table** appends the modifier (`_2X`, `_3XL`, `_OSFA`, …) from the Size field on ingest → second suffix. The order-form path sends base PN + plain size by design; the quote-builder transformers violated that rule.
**Solution:** All 3 garment line-builders now send `PartNumber: item.StyleNumber` (base) + plain size. EMB's "Line Items" display NOTE keeps `getPartNumber` (human-readable SKU text only). Regression test `tests/jest/push-size-suffix.test.js`. Shipped proxy Heroku **v779**. Orders 142000–142004 pushed BEFORE the fix → still double-stamped.
**Prevention:** For any ShopWorks PUSH, send the BASE part number + plain size and let the Size Translation Table append the modifier — NEVER call `getPartNumber()`/pre-suffix for a pushed `PartNumber` (that's for FRONTEND display + SanMar inventory only). When verifying a push, check the **processed** SW order, not just the MO intake JSON. Design types CONFIRMED vs live SW dropdown: EMB→2, SCP→1, DTF→8, DTG→45, sticker→4, emblem→5 (cap designs stay 2 Embroidery, `6 CAP` unused).

### EMB/SCP/DTF push parity hardening — dropped notes, blank SCP ship-to, daily-colliding ExtOrderIDs (2026-06-01) [archived 2026-06-15]
**Problem:** Audit of the three quote-builder→ShopWorks pushes found three silent failures: (1) SCP+DTF order-level Notes (tax account, `** NO DESIGN LINKED **`, project, spec) never reached SW; (2) every SCP order imported with a BLANK ship-to; (3) SCP/DTF ExtOrderIDs collided DAILY. EMB was the only fully-correct push.
**Root Cause:** (1) SCP+DTF emitted notes under key `NotesOnOrders`, but the MO `/onsite/order-push` API reads `Notes` — wrong key → silently dropped. (2) SCP `buildShippingAddresses` used the wrong schema AND wrong source columns (SCP saves `ShipToAddress/ShipToCity/...`). (3) SCP+DTF `ExtOrderID` used trailing-seq only; their quote IDs are `Prefix{MMDD}-{seq}` with a daily-reset seq and no year → every day's first quote collapsed to `SCP-1`/`DTF-1`. EMB was safe only because its quote ID embeds the year.
**Solution:** (1) Renamed the key to `Notes` + regression test. (2) Rewrote SCP `buildShippingAddresses` to the EMB/DTF schema + `ShipTo*` columns. (3) One shared `buildExtOrderID(prefix, quoteId, isTest, year)` in `manageorders-emb-config.js` keeps full date+seq + prepends a 20xx year from the quote's persisted date. Added EMB's missing zero-line/$0-garment push guards + DTF review-before-push modal. 12 new jest tests.
**Prevention:** The field name a downstream API reads is part of the contract — diff a new transformer's output keys against the PROVEN path (`manageorders-push-client.js`), don't trust a plausible key name. An ExtOrderID must contain every distinguishing part of the quote ID PLUS a year. When several methods build the same artifact, factor it into ONE shared helper so the working method can't silently drift.

### ShopWorks ManageOrders integrations: APISource routing + consolidation to one (2026-06-02, REVERSED 2026-06-04 to all-"ManageOrders") [archived 2026-06-15]
**Problem:** Erik consolidated three OnSite "Order API Integrations" (Manage Orders / Embroidery Quote NWCA / Order Form — all pointed at the SAME `manageordersapi.com/onsite` endpoint) down to one ("Manage Orders") by DELETING the other two. Afterward NO test orders imported into ShopWorks (quote-builder, 3DT, and Inksoft pushes all went silent; DTG too).
**Root Cause:** Two directions are easy to conflate. (1) PUSH: every app POSTs orders to the ONE ManageOrders endpoint — orders all land in one MO queue. (2) PULL: each ShopWorks "integration" is a poller that imports orders FROM that queue, FILTERED by the order's `APISource` field. Per `caspio-pricing-proxy/lib/manageorders-push-client.js:96`: **a BLANK-APISource integration is the catch-all (pulls EVERY order); a SPECIFIC-APISource integration only pulls orders whose APISource exactly matches.** The two DELETED integrations had BLANK APISource (the catch-alls quietly pulling everything). The KEPT "Manage Orders" had APISource=`ManageOrders` (specific). Our pushes send: quote-builders/3DT/Inksoft = BLANK APISource; order-form/DTG = `OrderForm` (it had targeted the now-deleted "Order Form" integration). So after deletion, NOTHING matched: blank orders had no catch-all; `OrderForm` orders had no integration.
**Solution:** Two coordinated fixes. (a) CODE: order-form push `apiSource` `'OrderForm'`→`''` (blank) so it's uniform with every other push (frontend v1221, server.js ~3243). Audit confirmed order-form was the ONLY non-blank push path; EMB/SCP/DTF transformers + the shared push-client (3DT) + Inksoft `transform.py` all already send blank. (b) CONFIG (Erik, in OnSite): clear the "Manage Orders" integration's APISource field → blank → it becomes the catch-all that pulls every order regardless of tag. Endpoint stays one; integration stays named "Manage Orders".
**Prevention (REVISED 2026-06-04 — the 06/02 "all-blank" plan was REVERSED):** The 06/02 config fix (blank the integration's APISource) never stuck — the field stayed `ManageOrders`, so the all-blank pushes silently failed to import again right through 06/04 (re-discovered as a "receiving outage"). Final call (Erik): KEEP the integration's APISource=`ManageOrders` and stamp `APISource:"ManageOrders"` on EVERY push instead. Now uniform across ALL paths — proxy transformers (EMB/SCP/DTF), proxy `transformOrder` (order-form/3DT/DTG — FORCES it, overriding the old blank/`OrderForm`), `server.js` order-form (`apiSource:'ManageOrders'`), and Python Inksoft `transform.py` (`APISource:"ManageOrders"`). THE RULE: the integration's APISource value and EVERY push path's APISource must be IDENTICAL (today = `ManageOrders`). Proven by A/B push (blank order skipped, `ManageOrders` order imported). DIAGNOSTIC: order reaches MO (`/order-pull`/`/orders/verify` finds it) but `/getorderno` stays count:0 ⇒ suspect this filter mismatch FIRST, not the payload. Proxy deployed v787; `server.js` + Inksoft `transform.py` same-day. Also fixed same day: `getTaxAccount` 10.1%→`2200.101` (was generic 2200) + shared `buildSalesTaxNote` DTG-style tax block on EMB/SCP/DTF (proxy v782). And: extended-size breakout (2XL→`PC54_2X` as its own line vs dumped in the base XXL column) is governed by the integration's Size Translation Table modifiers + "Combine Line Items", NOT the push payload (we send base PN + plain size for all).

---

### Caspio multi-select List columns are unwritable via REST API + Triggered Actions (2026-05-09) — archived 2026-06-16
**Problem:** AE intake forms (JDS, Sticker, Banner) tried writing `Order_Type: 'Roland Stickers'` (or array `['Roland Stickers']`) to ArtRequests. Caspio returned `InvalidInputValue: ... Order_Type` (500). Even Caspio's visual Triggered Action builder hid multi-select fields from assignment-target dropdowns — the trigger workaround we tried also didn't work.
**Root Cause:** `Order_Type` is a `List - String` multi-select column. Caspio's REST API and Triggered Action builder both lack the internal encoding the DataPage UI uses for these columns. Reads return the dict shape `{'9': 'Roland Stickers'}`; writes need a wire format we can't produce externally.
**Solution:** Parallel-column workaround. Added `Order_Type_Source` (Text 255) to ArtRequests in Caspio admin. New REST forms write `Order_Type_Source`; legacy Garment DataPage continues writing `Order_Type`. Each record has exactly one populated; never both. Dashboards coalesce on read: `req.Order_Type || req.Order_Type_Source`.
**Prevention:** **Never include a Caspio `List - String` multi-select column in a REST POST payload — the entire submission will 500.** The same parallel-column + dashboard-coalesce pattern applies to any future multi-select that needs REST writes.


### Customer SCP calculator priced dark-garment underbase per-piece — builder says setup-screen only (2026-06-11)
**Problem:** `/calculators/screen-print-pricing.html` (screenprint-pricing-v2.js) overcharged every dark-garment quote vs the staff builder for identical inputs (Rule 7): 48× PC61 Jet Black 2c front = $15.50/pc vs builder $14.50 (+$48/order, worse on combos). Found by the 2026-06-11 customer-cart parity audit; the SAME bug was already fixed in the order form on 2026-06-09 (`screenprint.jsx:179-190`) but nobody swept the calculator.
**Root Cause:** The calculator bumped the color count +1 on darks for the PER-PIECE price lookup (front bucket `frontColors+1`, additional locations `loc.colors+1`, tier table, location guide) — but the builder's rule is: underbase = +1 SETUP screen per printed location (`screenprint-quote-builder.js:108-122`), per-piece lookups ALWAYS use raw design colors (`:3096-3097`). Setup totals coincidentally matched (colors+1 × $30 = screens × $30), masking that per-piece diverged.
**Solution:** Split "screens" (setup fee + setup display, keeps the dark +1) from "lookup colors" (raw, for every per-piece price read) in `calculatePricing()`, the tier table, and the additional-location guide; same fix synced into `screenprint-manual-pricing.js` (file-header sync mandate; both manual + automated modes — manual mode also charged flash × effective colors instead of × raw). Display labels/tooltips updated ("underbase is a setup screen, not per-shirt"). Verified live in preview vs builder ground truth: dark 2c front $14.50/pc + $90 setup ($836 grand), 2c+1c back $20.00/pc + $150 setup ($1160) — light per-piece identical. Locked by `tests/unit/scp-dark-garment-parity.test.js` (4 tests, both files, fixture buckets differ so a wrong lookup can't pass).
**Prevention:** Underbase/flash-class charges on SCP are SETUP-SCREEN charges, never per-piece — any new surface pricing darks must lookup by RAW colors. When a pricing rule is fixed on one surface (order form 06-09), grep ALL surfaces for the same pattern THAT DAY (`isDark.*\+\s*1|effectiveColors`) — this is the 2nd recurrence of "fixed in one place, missed the sibling" (falsy-zero tax was the 1st). A coincidentally-equal sub-total (setup) can hide a diverged component — assert parity per COMPONENT (per-piece, setup, LTM), not just grand total.


## Archived 2026-06-25 (memory-system maintenance pass)

Moved from LESSONS_LEARNED.md to keep the active log under its line cap. Every recurring rule these entries teach survives as a one-line stub in the active file and/or in retained sibling entries.

### Order-form parity: test vs the LIVE quote page, NOT a stored baseline (2026-06-09)
**Problem:** Building the order-form↔quote-page parity harness (`scripts/capture-order-form-baselines.js`, the redesign safety net), v1 diffed the order form's `priceForm()` against the signed `baselines.locked.json`. It reported DTG "over-charging" +$0.50–$1.50/pc at qty≥24 — a FALSE ALARM. The DTG `MarginDenominator` in Caspio changed to 0.53 since the 2026-05-23 lock, so the LIVE DTG quote page now returns the higher price too; the order form already matched it. The locked file was just stale.
**Root Cause:** A parity test ("does surface A match surface B today?") compared A against a months-old SNAPSHOT of B, so a legitimate Caspio price change in B looked like an A bug. Compounding: the order form BAKES LTM into the per-piece price while the quote page itemizes LTM as a separate fee → naive per-piece diffs over-report by exactly `ltmFee/qty`.
**Solution:** Rebuilt the harness LIVE-vs-LIVE — on the order-form page (which already loads every `*-pricing-service.js`), compute BOTH the quote-page price (reusing `capture-pricing-baselines.js` `PAGE_RUNNERS`) AND `priceForm()`, then diff them. Strip the order form's own `extras.ltmPerPiece` before comparing the base price. Result: SCP 5/5 + DTG 5/5 now confirm parity; the ONE real bug — SCP white underbase folded into the per-piece price (`screenprint.jsx:180`) — was fixed to price on RAW front colors (matching `screenprint-quote-builder.js:3093`) and locked by an adversarial scenario. DTG `priceForLocationCombo` also refactored to delegate to `DTGPricingService.calculateAllTierPricesForLocation` (one code path; was re-deriving with S/first garment base vs the service's `Math.min`).
**Prevention:** For "surface A must equal surface B", diff A and B computed at the SAME moment from the SAME live data — NEVER against a stored baseline (a locked baseline answers a different question: "has B drifted from sign-off?"). When one surface bakes a fee into the unit price and the other itemizes it, normalize (strip the baked fee) before comparing. Underbase/flash on SCP is a SETUP-SCREEN charge (flat), never a per-piece bump. The locked DTG baseline is now stale (Caspio margin 0.53) → re-capture + re-sign. Detail: `memory/ORDER_FORM_ARCHITECTURE_REVIEW_2026-06-09.md`.

### Order Form was a parallel pricing/tax codebase that diverged from the builders (2026-06-09)
**Problem:** A 17-agent adversarial audit of all 4 quote builders + the React Order Form + Quote Mgmt found 47 verified issues. The builders' on-screen totals + SW pushes were sound; **the Order Form (`pages/order-form/`) was the weak surface** — it re-implements tier/LTM/rounding/tax instead of reusing the shared engines, and that re-implementation had drifted into a **critical DTF under-charge** and a **critical tax bug**.
**Root Cause:** (1) **DTF under-charge was TWO compounding bugs** — a BACKEND index-shift (`pricing.js`: DTF's extra `Transfer_Freight` query shifted the style-query destructure → DTF `/api/pricing-bundle` returned `sizes:[]`, so no garment cost) AND a FRONTEND wrong-shape call (`dtf.jsx` passed ONE object to `calculatePriceForQuantity(garmentCost,data,sizeKeys,qty)` — 4 positional args → threw → a silent `catch` fallback that read non-existent `bundle.garmentCost`/`laborCost`/`freightCost` → all 0 → priced transfer-only, ~$8.75/pc vs correct $18.50). Neither alone was the whole bug. (2) Tax: `shared.js` hardcoded WA 10.1% for everyone (no exempt/wholesale/out-of-state path) even though `info.isTaxExempt` was captured for a chip. (3) LTM re-round: OF rounded `base+LTM` together (base was already service-rounded) → over-charged small batches up to ~$0.49/pc + total LTM exceeded $50.
**Solution:** Fixed both DTF bugs (proxy `styleQueryStart` offset + positional call sourcing garment cost from `bundle.raw.sizes` = min size price, mirroring `dtf-quote-page.js:644`; **NO silent fallback — surface an error if garment cost is unavailable**). New `resolveTaxContext(info,ship)` in `shared.js` mirrors `dtg-inline-form recomputeTaxRate` (wholesale→2203 / exempt→2204 / OOS→2202 / in-WA→rate), stamped on the breakdown + pushed via `shopworks.js`. LTM re-round: round base alone, add raw LTM (matches `embroidery-quote-pricing.js:1569`). Migrated SCP/DTF/EMB charged fees to Caspio Service_Codes (shared `getServicePrice` in `quote-builder-utils.js`). All verified LIVE in Preview: exempt order → $0 tax/$500 deposit (was $505/$2752); EMB 6pc → LTM exactly $50 (was ~$51); SCP stripe → +$2/loc; DTF live → fail-safe error (until proxy deploys), DTF manual → $22.50 correct.
**Prevention:** (1) **A silent `catch` that falls back to a home-grown price computation is a money trap** — when the primary pricing call throws, surface the error; never silently price with whatever keys happen to be on the object (they were 0). (2) An "empty `sizes:[]`" from one method but not others is a backend symptom — check positional destructures when one method appends an extra query. (3) The Service_Codes values all MATCHED the hardcodes (SPSU=30/GRT-75=75/DD=100/LTM=75/50) so that migration was future-proofing, not a live bug — distinguish "wrong now" from "will drift" when triaging a 47-finding audit (fix the money bugs first). (4) The Order Form must reuse the shared pricing/invoice engines, not re-implement them — every re-implementation drifts. Full audit + fix checklist: `memory/PRICING_AUDIT_2026-06-09.md`.

### DTG Phase 2 billable shipping — jest can't catch a Caspio save rejection; live-verify the save (2026-06-09)
**Problem:** DTG Phase 2 added a billable shipping fee (taxable in WA → folded into the tax base at all 4 sites via a single `effectiveShipFee()` helper, pickup→0). The front-end math was locked by jest (11 cases) + an adversarial diff-review (0 money bugs, all 4 sites foot). But the SAVE silently broke against REAL Caspio in two ways jest missed (jest MOCKS the quote_sessions POST): (1) I first followed the roadmap spec literally — bake the fee into `TotalAmount` (subtotal+fee), no SHIP line item — which footed but HID the shipping line + inflated the Subtotal on `/quote`+`/invoice` (the readers detect shipping ONLY via a `StyleNumber:'SHIP'` `EmbellishmentType:'fee'` item, NEVER a column); (2) the actual Caspio 400 was `LTMFeeTotal` — the `Quote_Sessions.LTMFeeTotal` column is INTEGER-typed and rejects a fractional value, so ANY LTM DTG quote (qty<24, amortized sum e.g. 49.92) failed to save; the trio masked it by writing the flat round tier fee ($50). FIXED 2026-06-09 — `Math.round()` LTMFeeTotal at both write sites (handleSaveQuote + server.js OF-route session); it's informational (LTM is in the per-unit line prices, not added to TotalAmount) so the nominal whole-dollar fee is correct. Verified live (qty-12 quote DTG-2026-049 saves, LTMFeeTotal 50, /quote foots $254.01). (I initially MISdiagnosed it as a phantom `ShippingFee` column.) **Schema-level fix (2026-06-09): the `LTMFeeTotal` column itself was changed INTEGER→CURRENCY** via Caspio REST `PUT /tables/Quote_Sessions/fields/LTMFeeTotal {Type:CURRENCY}`. It was the ONLY money column on Quote_Sessions typed INTEGER (Subtotal/Total = NUMBER; Tax/Shipping/LTM_Garment/LTM_Cap = CURRENCY) — the setup doc even specced "Currency/2-decimals" but it was created INTEGER. Now accepts decimals (verified: a 49.92 POST round-trips intact, then DELETE'd). The `Math.round` writes are KEPT (nominal whole-dollar = wanted reporting value + belt-and-suspenders). This is the ROBUST fix because `Math.round` covered only 2 of ~8 LTMFeeTotal writers — `server.js:693` (OF quote_sessions create), the 3 sibling builders (EMB/SCP/DTF), and the contract calculators still send `parseFloat(toFixed(2))` and would 400 on a fractional LTM; the column change protects them all.
**Root Cause:** Two independent quote-state sources + a reader contract the spec didn't account for. The roadmap author specced `TotalAmount = subtotal+fee` without checking the reader side; the adversarial review caught it (readers foot off the SHIP item, not the `ShippingFee` column). And a mocked-POST jest never exercises Caspio's column type/existence validation.
**Solution:** Mirror DTF/SCP exactly — `TotalAmount` = products-only PRE-tax, write a SHIP fee line item (`LineTotal`=fee), `TaxAmount` stays on `(subtotal+fee)` (shipping IS taxed), persist `Notes.shipping.fee` for edit-reload. Do NOT write a `ShippingFee` session column (it exists but DTF/SCP don't write it — dead weight). Verified LIVE: real save (DTG-2026-048, cleaned up) → screen=PDF=save=`/quote`=`/invoice`=edit-reload all foot ($600 + $25 ship + $62.50 tax = $687.50), shipping row shows on both readers, pickup zeroes a stale fee everywhere. Locked by `tests/unit/dtg-tax-base.test.js` (+4 cases incl. stale-pickup-fee guard).
**Prevention:** (1) **For any save change, verify against REAL Caspio in Preview, not just jest** — jest mocks the POST and won't catch a rejected/typed column. (2) When `TotalAmount` excludes a charge the `/quote`+`/invoice` mirror re-adds, you MUST write the line item the mirror reads (`getShippingFee` → SHIP item) — a column the readers ignore is invisible. (3) Caspio DELETE has read-replica lag: `recordsAffected:0` + a GET that still returns the row for several seconds is NOT a failed delete — re-query after a delay before concluding. (4) `effectiveShipFee()` as the SINGLE pickup-zeroing rule (read by all 4 sites + save) is the structural defense — mirrors `recomputeTaxRate` as the single tax authority.

### To-100 readiness: adversarial-verify workflows caught money gaps in the FIXES themselves (2026-06-06/07)
**Problem:** Driving the EMB ReQuote builder to a defensible 100%, two multi-agent adversarial-verification workflows (verify-deployed-fixes + spec-remaining + hunt-regressions) caught defects solo review missed — INCLUDING 2 money bugs inside my OWN tax-exempt fix (B8). Workflow #1 surfaced: a 2nd stored XSS (`discountReason` in the invoice totals), an unauth SQLi on the tax-account PUT/DELETE routes, an AL/DECG $0-save bypass on the API-down path, a half-fixed dup-QuoteID read-path, a re-push duplicate-order via a wiped lock. Workflow #2 (final) then found B8-R1/R2.
**Root Cause:** B8-R1 — `window._taxExempt` was set AFTER the ship-block already ran `lookupTaxRate()`, so a NEW non-exempt customer selected right after an exempt one saw the prior customer's stale `true` → forced 0% (under-charge). B8-R2 — edit-reload restored the include-tax checkbox but never set `window._taxExempt`, so a later Pickup→Ship toggle re-applied WA tax to a reloaded exempt quote. Both: persisted state must be set BEFORE any consumer reads it AND on every entry path (live-select + edit-reload).
**Solution:** Set `window._taxExempt` before the ship-block in `applyContact`, on edit-reload, and clear in `clearCustomerContextBanners`. Plus: `discountReason`→`this.esc()`; tax-account routes validate id via `sanitizeAccountNumber` before the WHERE; syncALRows/syncDECGRows flag `dataset.priceError` on `!cache` (DECG skips manual `sellPrice>0` overrides); proxy GET `q.orderBy=PK_ID DESC` + loadQuote reduce-to-max-PK_ID + sync prefer-pushed; `_pushAlreadyDone` only cleared for a NEW quote; push/files routes rate-limited; revived the inert al-pricing save-backstop (DOM-probe `[data-price-error]`). Shipped v2026.06.06.4→v2026.06.07.1 + proxy ca19fd3. 994 unit + 792 parser + XSS(8) + push-designs(6) + jsdom(10) green.
**Prevention:** (1) ADVERSARIALLY VERIFY YOUR OWN FIXES — a multi-agent re-verification of a 16-fix batch caught 2 money bugs the author missed; a wrong fix is worse than none. (2) Persisted UI state (tax-exempt, restore flags) must be assigned BEFORE the first async consumer reads it, on EVERY entry path — same class as the `_restoringQuote` race. (3) TRAPS the workflow stopped before they shipped: do NOT fold shipping into the saved `TotalAmount` — shipping is a separate `SHIP` line that `/invoice` + `/quote` ADD BACK → double-count (the saved total is shipping-EXCLUSIVE by design; the real gap is the dashboard reading bare `TotalAmount` pre-import — a display fix, not a charge fix). The `'monogram'` EmbellishmentType is LIVE (saved at `embroidery-quote-service.js` + re-classified on reload) — NOT dead code. Verified specs > assumed specs: the workflow corrected 5 wrong line numbers/patches before application. Full verdict: `memory/EMB_FINAL_VERDICT_2026-06-06.md`; action list: `memory/EMB_TO100_ACTIONLIST_2026-06-06.md`.

### Edit-reload audit (workflow wuvppqs2y) — pickup tax overwrite + AL/OSFA mis-bills (2026-06-06)
**Problem:** A 14-dimension multi-agent readiness audit (adversarially verified) found 3 confirmed edit-reload bugs in the EMB builder. P0 (Erik's #1 rule): reopening ANY Customer-Pickup quote (Pickup is the reset default) silently overwrote the saved tax rate. P1: legacy additional-logo quotes double-charged the AL; OSFA-only caps/beanies dropped their qty on reload.
**Root Cause:** P0 — `restoreEmbOrderShipping()` → `onShipMethodChange()` fires async `lookupTaxRate()` (Milton DOR) for pickup; the promise resolves AFTER the synchronous saved-rate restore (`#tax-rate-input` from the TAX line) and overwrites it → a Save Revision bakes in the wrong tax. P1 AL — `populateLogoConfig` unconditionally enabled `globalAL` from `AdditionalLogoLocation`, double-counting quotes that ALSO restore an `embroidery-additional` row (engine `additionalServicesTotal` + the restored row). P1 OSFA — `addProductFromQuote` special-cased only 2XL/XXL; OSFA (in `SIZE06_EXTENDED_SIZES`) fell to `createChildRow`, then the trailing `onSizeChange` pruned the OSFA-only parent's qty.
**Solution:** P0 — `window._restoringQuote` guard: `lookupTaxRate()` early-returns while set; `loadQuoteForEditing` arms it + clears in `finally`. P1 AL — gate `globalAL` on `!hasALRow` (no AL/AL-CAP/DECG-FB row). P1 OSFA — mirror the SW-import parent-OSFA path (`dataset.osfaQty`). Locked by `tests/unit/emb-edit-reload-roundtrip.test.js` — UPGRADED 2026-06-06 from logic-model/source-guards to a TRUE jsdom DOM round-trip (10 tests): loads the real builder+deps into a jsdom window from the real HTML, stubs the proxy fetch, builds quote_sessions+quote_items, calls the real `loadQuoteForEditing()`, asserts restored DOM (tax 8.8 + zero DOR fetch during restore; globalAL on/off; OSFA `osfaQty`=24). Shipped v2026.06.06.4.
**Prevention:** Any async API call fired DURING a quote restore (tax, pricing, inventory) races the synchronous field restore and can silently overwrite saved values — gate them on a `_restoringQuote` flag set for the whole load. When a reload path special-cases one size/type (2XL), check whether siblings in the same set (OSFA + other SIZE06 members) need it too. Edit-reload is the #1 silent-data-loss surface (~13 fixed bugs) — it now has CI guards. **Harness technique for the global-scope builder** (no module exports, top-level DOM init): `new JSDOM(html, {runScripts:'dangerously'})`, AWAIT the document's `load` first, THEN inject the builder via `<script>` — so its `DOMContentLoaded` init never fires and you drive functions directly. Cross-file `function`/`window.X=` decls auto-share the window global; the builder's module-level `let`s (globalAL, quoteService) aren't window props → append a `window.__embTest` accessor IN THE SAME injected script (it closes over them). Stub `pricingCalculator` (prices aren't asserted; restore runs before pricing). **GOTCHA: pin `jsdom@22` — jsdom ≥24 pulls an ESM-only CSS dep (`@asamuzakjp/css-color`) that throws `ERR_REQUIRE_ESM` under Node's CJS `require()`.** A timing-independent regression signal beats a racy one: assert the DOR-lookup fetch fired 0× during restore (deterministic) rather than only the final rate value (race-dependent).

### Deep review: systemic PDF-total bug + edit-reopen data loss across all 4 builders (2026-06-01)
**Problem:** A workflow review (9 reviewers + adversarial verify → 28 confirmed findings) of all 4 quote builders surfaced customer-facing PRICING bugs. Headline: the SHARED PDF/print invoice generator printed a WRONG GRAND TOTAL whenever a quote had a discount or any fee (art/graphic-design/rush/sample/shipping) — the fee rows showed but were never summed. Plus: SCP saved a tax-baked, fee-omitting TotalAmount that the report then double-taxed; DTF's PDF double-taxed (fed the tax-inclusive total back in); DTF saved LTM-stripped line items → every qty<24 DTF order pushed UNDER-priced to ShopWorks; the quote/invoice report taxed SCP/DTF at ~1010% (percent-vs-decimal); DTG "Print Quote" threw + printed $0; EMB edit-reopen wiped customer#/PO/ship-to/dates on Save Revision; SCP "New Quote" threw and left stale customer/fees; DTG live-pricing silently zeroed a row on an API error.
**Root Cause:** `embroidery-quote-invoice.js` taxed the bare `pricingData.grandTotal` and rendered fee/discount rows DISPLAY-ONLY, while the 4 builders fed it INCONSISTENT grandTotals — EMB/SCP passed products-only (omits fees), DTF passed the tax-INCLUSIVE total (double-tax), DTG built the wrong product shape (no `lineItems[]` → generator threw) from never-written fields (`aiState.lastPriceQuote`/`row.previewUnit`) → $0. Per-builder: SCP `saveQuote` stored `grandTotal*(1+tax)` (tax baked, fees dropped) while `updateQuote` stored base-only (no-op edit shifted the total); DTF `calculateFromState` saved `priceNoLTM` while the subtotal was LTM-in; `quote-view.js` read `TaxRate` with no percent→decimal normalize; EMB `loadQuoteForEditing` never restored the order/ship block; SCP `resetQuote` called `getElementById('front-colors')` (a radio NAME, not an id) + two functions that don't exist (`updateGrandTotal`/`updateScreenConfig`) — stacked throws.
**Solution:** Generator now taxes an authoritative `preTaxSubtotal` (the on-screen `#pre-tax-subtotal` = base + fees − discount) the builders pass, closing Subtotal shows it (falls back to grandTotal; respects `includeTax`). Each builder's print passes `preTaxSubtotal` (DTF also stopped reading the tax-inclusive element + passes `includeTax`); DTG print rebuilt to the canonical `{product, lineItems[]}` shape from `row._priceBySize`/`_perPiece`. SCP save stores a PRE-TAX fee-inclusive TotalAmount + `TaxAmount` (both paths identical); DTF saves LTM-INCLUSIVE unit prices; `quote-view` normalizes `rate>1?rate/100:rate`; EMB restores the full order/ship/customer# block on edit-reopen; SCP `resetQuote` selects radios by name + real ids + `recalculatePricing()`; DTG shows a red "pricing failed — total incomplete" banner instead of a silent $0. + reset-bleed clears (DTF customer#/shipping/artwork/design#, SCP artwork/design#) + blank-customer# push warning (SCP/DTF). Verified live: generator math (Node), DTG print $431.57 == on-screen, SCP reset (no throw), EMB edit-reopen (ship-to/PO restored).
**Prevention:** A shared invoice generator must tax the SAME number the rep sees — pass the on-screen pre-tax subtotal, never re-derive it from a partial grandTotal, and never render a fee row the total ignores. The 3 output paths (on-screen / saved / printed) must AGREE for a quote WITH a fee + discount — a no-fee quote hides every one of these. Save the all-in unit price (LTM included) — the push bills `FinalUnitPrice` verbatim. Normalize TaxRate at EVERY read (EMB decimal vs SCP/DTF percent). Edit-reopen must restore EVERY field the save writes, or a revision silently wipes it. Test resetQuote/edit-load LIVE — one masked throw hides the next (SCP had three stacked). Findings: workflow run wp2s2j3as. **A SELF-REVIEW workflow of the fix DIFF (run w1958xtoi) then caught 4 gaps the fix itself MISSED: `includeTax` was wired for DTF/DTG print but NOT EMB/SCP (tax-exempt quotes still printed tax); EMB edit-reopen didn't handle the 'Other' ship method (lost on Save Revision); the generator had no Shipping row so invoices didn't foot when shipping>0; DTG priced an unavailable size at the average. LESSON: when fanning ONE fix across N builders, verify EACH builder gets the WHOLE fix — and adversarially review your OWN diff. Jest regression test `tests/unit/invoice-totals.test.js` (8 cases) now locks the generator total math. Shipped v2026.06.01.9 (core), .10 (includeTax), .11 (hardening).** **ONEDRIVE GOTCHA (recurring, see `feedback_onedrive_edit_silent_fail`): this repo is under OneDrive, so during an EDIT-HEAVY session OneDrive's sync silently REVERTED a whole batch of un-committed Edit-tool writes (entire hardening round + the new test file vanished; `git status` went clean). WORKAROUND that beat it: apply the edit, `git commit` IMMEDIATELY, then `git show HEAD:file | grep` to VERIFY the commit captured it BEFORE pushing — committed objects are immune to the revert; push the commit straight to Heroku (`git push heroku develop:main`) to avoid a working-tree-dependent `git checkout main`. Better: have Erik PAUSE OneDrive syncing for edit-heavy work.**

### EMB save↔restore mismatches: dropped sizes, double-counted/lost fees, DECG double-save (2026-06-04)
**Problem:** Cert audit of the EMB builder found edit-reload (`?edit=EMB-…`) produced a DIFFERENT total than the saved quote on three archetypes: (1) a saved 2XL garment line vanished on reload (under-charge $88); (2) the AS-Garm primary-stitch surcharge counted twice — once as a restored row, once recomputed (over-charge $116); (3) a 3D-puff cap reloaded as flat embroidery, losing the cap type AND dropping the puff fee on the next Save Revision.
**Root Cause:** (1) `addProductFromQuote()` put 2XL straight into a child row, leaving the parent Size05 input empty; the end-of-function `onSizeChange()` read that empty input as qty 0 and DELETED the just-created 2XL child (the 2XL/XXL double-count guard backfiring on programmatic restore — 3XL/4XL aren't subject to it). (2)+(3) Fees the price engine AUTO-recomputes from restored logo/cap config (AS-Garm, AS-CAP, 3D-EMB, Laser Patch) were ALSO in `SERVICE_STYLE_NUMBERS` so `populateProducts()` restored them as standalone rows → double-count; and `populateLogoConfig()` never restored `session.CapEmbellishmentType`, so the cap reverted to embroidery and the save (gated on `capEmbType==='3d-puff'`) dropped the upcharge.
**Solution:** (1) For 2XL/XXL, set the parent Size05 input and let `onSizeChange` create+sync the child (the natural user-typed path). (2) Skip AS-Garm/AS-CAP/3D-EMB/Laser Patch in the `populateProducts` service-restore loop (`AUTO_RECOMPUTED_FEES`) — the fee engine re-derives them. (3) Restore `CapEmbellishmentType` + run `handleCapEmbellishmentChange()` in `populateLogoConfig`. Verified end-to-end: EMB-2026-276 reload+re-save → stable $3473.50 with all 4 size lines + single AS-Garm; EMB-2026-278 (C112 3D-puff) → capEmbType preserved, single $240 puff, stable $1104.
**Prevention:** A fee that is BOTH auto-recomputed by the price engine AND restored as a saved row WILL double-count on edit-reload — restore one copy, never both. When a restore writes a value programmatically, run the SAME change handler the UI fires (onSizeChange / handleCapEmbellishmentChange) so dependent state syncs; setting `.value` alone leaves guards/derived fees stale. Always certify edit-reload by re-fetching `quote_items` after Save Revision and reconciling to the original subtotal — the on-screen total can look plausible while line items silently drift. TWO more save↔restore traps found the same day: (4) a fee SAVED but whose StyleNumber isn't in the restore allow-list (`SERVICE_STYLE_NUMBERS`) is LOST on reload (Services-bar GRT-50/GRT-75/DD/RUSH) and the next Save Revision deletes it — distinguish bar-origin (restore the row) from sidebar-input origin (recompute from the session field) by checking whether that session field is non-zero. (5) a row collected by TWO collectors (`collectProductsFromTable`→manualServiceItems AND `collectDECGItems`) is SAVED TWICE → **2× over-charge on /invoice + push while the on-screen total (one collector) looks correct** (DECG/DECC) — exclude such rows from the manualServiceItems save. Whenever the same DOM row can reach the DB through more than one collector, make the collectors mutually exclusive.

### SCP pricing service shipped with an UNGATED ?manualCost override — the 5th copy of a staff backdoor, 3rd copy-paste gate miss (2026-06-11)
**Problem:** `ScreenPrintPricingService.getManualCostOverride()` (screenprint-pricing-service.js:73) honored `?manualCost=`/`?cost=` URL params AND persisted them in sessionStorage with NO host gate — any customer page instantiating the service could be repriced for a whole session by a crafted/shared link (`?cost=0.01`). EMB, cap-EMB, DTG, and DTF services all had the localhost/.herokuapp.com gate; SCP was the one miss (found by the customer quote-cart parity audit, same class as the just-fixed top-sellers URL-price hole above).
**Root Cause:** The manual-cost feature was copy-pasted across 5 pricing services and the host gate was retrofitted per service (EMB at launch, cap-EMB 2026-05-03, DTG/DTF later) instead of centralized — each copy could (and one did) miss it.
**Solution:** Mirrored the EMB gate verbatim into the SCP service (customer quote-cart Phase 0 P0 hotfix). `tests/unit/web-quote-cart-parity.test.js` now locks the gate across ALL FIVE services × 4 cases each: customer-host URL param ignored AND not persisted, stale sessionStorage blocked, localhost honored, .herokuapp.com honored.
**Prevention:** A staff-only override that exists in N copies needs a gate test that ENUMERATES all N (the new `test.each` does) — a per-service fix without the enumeration is how the 3rd miss happened. Any new `*-pricing-service.js` gets the host gate from day one; the quote-cart engine only runs these services on customer hosts where the gate returns null.

### Deploy cache-bust `git add -u` swept another session's uncommitted work into production (2026-06-11)
**Problem:** The v2026.06.11.9 deploy's cache-bust step (`git add -u`) silently absorbed a parallel session's uncommitted edits (product-search-service.js + product/components/info.js hardcoded-0.57-margin removal) into the Deploy commit — unreviewed code reached production inside a "cache-bust" commit.
**Root Cause:** Multiple concurrent sessions/chips share one checkout; the deploy skill stages ALL tracked modifications without checking provenance.
**Solution:** Audited post-ship: the swept code was the planned P2 margin cleanup, house-style (fail-visible, no fallback), live-verified healthy ($31.92+ API-margin prices, 0 errors); third file (catalog-search.js) committed deliberately to complete the set.
**Prevention:** Before ANY deploy: `git status` — every dirty file must be either (a) the release's own cache-bust bumps or (b) consciously committed first. Unknown dirt = STOP, identify the owning session, review, commit with a real message. Parallel chips + a shared checkout make this a standing risk.

## Archived 2026-06-26 (DTF/SCP one-time fixes — superseded by MEMORY DTF section + push-parity topic)

### DTF print path priced from DOM + broken fallback — PDF showed $493.50 lines under a $1,018.98 total (2026-06-11)
**Problem:** Bradley's customer PDF: product lines footed to $493.50 but tax ($93.48) + GRAND TOTAL ($1,018.98) were computed on the true $925.50 subtotal. Parent-row unit price printed $15.50 instead of $39.50 (reproduced exactly from live API data).
**Root Cause:** `buildPricingDataForInvoice` built line items from DOM text + a per-product fallback whose transfer lookup could never match (`transferBreakdown[loc]` against a `{breakdown:[], total}` shape; `.cost` vs `.unitCost`) — silently dropping ALL transfer costs + LTM — while the PDF's tax base came separately from on-screen `#pre-tax-subtotal`. Two sources, no reconciliation. A 14-dimension/133-finding audit (adversarially verified) confirmed siblings: save dropped non-2XL-6XL sizes from quote_items while charging them, edit-reload dropped 3XL+ (EMPTY else branch), ColorCode never persisted (push sent COLOR_NAME), 3XL popup `XXXL` key mismatch silently deleted rows on Apply, falsy-zero `|| subtotal` on save totals, resetQuote crashed mid-reset on undefined `updateSidebar()` (so the 2026-06-08 include-tax re-check never ran).
**Solution:** Single source: `calculateFromState()` + new `computeFeesAndTotals()` feed BOTH save and print (line items, fee math, percent-discount base products+fees, shared parseRatePercent). Deleted the broken print helpers. Save iterates actual child rows (any popup size persists); edit-reload rebuilds extended-size child rows + restores include-tax/LTM-waive/design#/dates; ColorCode chain `sizeGroup.catalogColor||product.catalogColor`; DTF+SCP push tax notes now pass shipping + emit the accounting cross-check note. Locked by `tests/unit/dtf-save-parity.test.js` + proxy `tests/jest/dtf-push-transformer.test.js` (first DTF transformer coverage). Live-verified: Bradley's exact quote — PDF lines now foot ($925.50 → $1,018.98).
**Prevention:** Print/save/copy/email must consume the SAME state-math the screen uses — never re-derive prices from DOM text or a hand-rolled "fallback formula" (every such fallback here had drifted into wrong money). When a producer returns `{breakdown, total}`, grep consumers for `[key]`-style indexing into it. A hardcoded size list (`['2XL'..'6XL']`) iterating data a dynamic popup creates = guaranteed silent drop — iterate the actual rows. OneDrive reverted a mid-session Edit batch AGAIN (see feedback_onedrive_edit_silent_fail): batch money-path edits via one Python write + grep-verify markers.

### DTF child rows got a JS-state model — the last DOM read in the money path is gone (2026-06-11)
**Problem:** After the 2026-06-11 single-source refactor, extended-size quantities STILL lived only in the DOM (`.cell-qty` text + `window.childRowMap`), so `calculateFromState()`/`getTotalQuantity()` had a documented "known exception" that parsed DOM — one stray DOM mutation away from wrong saved money.
**Solution:** `DTFQuoteBuilder.childRows` Map (`id → {parentId, size, qty, baseCost, sizeUpcharges}`) is now the money source; written ONLY via `registerChildRow`/`setChildRowQty`/`removeProduct` at the same chokepoints that mutate the DOM (`createChildRow`, `onChildSizeChange`, parent-2XL sync, `applyExtendedSizes` update branch; removal funnels through `removeProduct`; `resetQuote` clears it). All money readers (calculateFromState, getTotalQuantity, save×2, print, summary, popup prefill, draft auto-save) iterate state; DOM rows are paint-only. Locked by `tests/unit/dtf-childrow-state.test.js` — document stub THROWS on any query while child totals compute. Live-verified: deleted every DOM child row in the preview; subtotal/qty unchanged.
**Prevention:** When display rows are dynamically created, give them a state entry the moment the row is created — "state first, then paint" at every mutation chokepoint. A test where `document.querySelectorAll` throws is the cheapest way to pin "this function never parses DOM".

### Rule-8 sweep of the DTF hardcoded-size-list bug — SCP print path had it, save paths were clean (2026-06-11)
**Problem:** The DTF audit's `['2XL'..'6XL']` hardcoded-list bug class had to be swept across the sibling builders. SCP's PDF path (`buildScreenprintPricingData`) still had it: base list `['S','M','L','LG','XL','XXL']` + extended list `['2XL'..'6XL','OSFA']`, while the extended-size popup offers ~40 sizes (XS, talls, youth, toddler, combos, 7XL+, pants/shorts). XS/LT/7XL pieces vanished from PDF line items while staying in the grand total (mutation-verified: $327 of lines under a $426 total); XXL (Ladies Size05 child row) printed at the parent base price ignoring its upcharge; OSFA-only beanies printed at $0.00 (childRowMap lookup misses — OSFA qty lives on the PARENT row).
**Root Cause:** Same class as DTF: a static size list iterating rows a dynamic popup creates. EMB's PDF path got this exact fix 2026-06-04 (audit B3) but SCP was never synced — a Rule-8 miss.
**Solution:** SCP now mirrors EMB's fixed loop: OSFA-only via parent price; base group S/M/L/LG/XL; ALL other sizeBreakdown keys priced from their child row's price cell with parent-price fallback. Save paths verified clean in all 3 trio builders (SCP/EMB `collectProductsFromTable` iterate actual child rows; EMB engine groups `Object.entries(sizeBreakdown)` by API upcharge); DTG inline form has no child-row architecture. Locked by `tests/unit/scp-save-parity.test.js` (save + extracted print fn, mutation-verified) + `tests/unit/emb-save-parity.test.js` (modeled on dtf-save-parity).
**Prevention:** When a bug is found in one builder, grep ALL FOUR for the same construct the same day (Rule 8) — EMB had this fix for 7 months while SCP printed wrong PDFs. Grep target: `['2XL'` / `extendedSizes` literals near `lineItems`/`sizeGroups`. Builder print/save helpers are testable headlessly: extract the function by brace-count + stub document/childRowMap (see scp-save-parity.test.js Part 2).


## Archived 2026-06-30 (memory-maintain)

### DTG builder offered location combos the pricing data can't price — FF_JB / JF_FB (2026-06-11)
**Problem:** The staff DTG builder's front/back pills allowed any of 3 fronts × 2 backs = 6 combos, but the pricing layer (dtg-pricing-service.js `this.locations` + server `dtg-canonical-pricing.js` whitelist) only supports 4: LC_FB, FF_FB, JF_JB, LC_JB. Picking FF+JB or JF+FB priced rows blank/$0 in the live preview and POST `/api/dtg/quote-pricing` rejected the submit with `bad_input` (verified live 2026-06-11; found by the customer-cart parity audit).
**Root Cause:** The UI built the location code mechanically as `${front}_${back}` with no check against the combos the data layer actually backs. DTG_Costs only has rows for the 5 single locations; combo prices are synthesized from a fixed whitelist the UI never consulted.
**Solution:** `dtg-inline-form.js` now owns a `SUPPORTED_COMBOS` whitelist + `sanitizeLocationState()`: unpriceable back pills render disabled with an explanatory title; switching front auto-clears an invalid back with a toast; sessionStorage restore, `?edit=` load, chat `fillFromQuote`, and chat `setLocation` all sanitize/reject. Verified in preview: all 4 supported combos price identical to the authoritative endpoint (LC_FB $24.50 / FF_FB $27.00 / JF_JB $31.00 / LC_JB $26.50 on 24× PC61 M).
**Prevention:** Recurring pattern — UI offering options the data can't back (same family as "tiers without cost rows price at $0", below). Any selector whose choices feed a pricing lookup MUST derive or validate its options against the pricing layer's supported list, and every state entry point (click, restore, edit-load, chat fill) goes through one sanitizer. A combo selector built as `A_B` string-joins needs an explicit whitelist check.

### Cloned checkout flows carry channel hardcodes deep in the PUSH notes (2026-06-10)
**Problem:** Custom-Tees (3DT clone) E2E push test produced a ShopWorks order whose Notes opened with "3-DAY RUSH SERVICE - Ship within 72 hours" + `rushOrder:true` — on a STANDARD 7-10-day order. Production would have rushed it.
**Root Cause:** `/api/submit-3day-order` hardcoded the rush banner + flag (legacy 3DT is always-rush). The reprice/pricing layers were channel-aware, but the push-note copy was only audited visually, not by reading the actual ManageOrders payload.
**Solution:** Banner, art-review clock copy, and `rushOrder` now gate on `orderSettings.channel==='custom-tees' && !rush`. Verified with a second REAL push (DTG0610-5121: standard banner, rushOrder false).
**Prevention:** When forking an order channel, grep the push payload builder for EVERY literal the old channel assumed (service level, turnaround, part numbers) — and always eyeball one full real payload per channel before cutover. Clean URLs also break relative asset paths (`/custom-tees` resolved `js/...` to `/js/...` → all modules 404'd): pages served from clean URLs must use absolute `/pages/...` hrefs.

### Order-form push/PDF: server.js needs a RESTART to verify; fees need a single source (2026-06-09)
**Problem:** Verifying the order form's ShopWorks push + PDF end-to-end. Two gotchas: (a) a `server.js` edit (the tax-exempt "Tax Account: 2204" note) did NOT appear in a `dryRun` push payload — the running `node server.js` had the OLD code in memory; (b) add-on fees were baked into `breakdown.subtotal` but never recorded, so the PDF showed garment lines that didn't foot to the subtotal (a $100 fee was invisible) AND an unresolved/$0 fee was dropped silently (violates Erik's #1 rule).
**Root Cause:** (a) Node does NOT hot-reload — only the browser re-compiles the in-browser-Babel JSX per load, so frontend edits show live (parity gate/preview see them) but API/server.js changes are stale until the process restarts. (b) `applyAddOnsToBreakdown` (`pricing/shared.js`) added fee line totals to `subtotal` only — `breakdown.fees[]` stayed `[]`, and `if(!sc) continue` silently dropped unresolved fees.
**Solution:** (a) Restart the dev server (`Stop-Process` the :3000 listener, `npm start`) before testing any server.js change; verified the 2204 note appeared post-restart. Push verified via `POST /api/submit-order-form?dryRun=1` (builds the full ManageOrders payload, no live order) across taxable/exempt/wholesale. (b) `applyAddOnsToBreakdown` now records every fee in `breakdown.fees[]` (single source) and pushes a `breakdown.errors` entry for an unresolved Service_Code or a $0 cold-cache TIERED rate; `paper-form.jsx submit()` BLOCKS the push when `breakdown.errors` is non-empty. PrintSheet itemizes `breakdown.fees[]` (dim rows before Subtotal) so lines foot to the subtotal.
**Prevention:** Restart `node server.js` to verify ANY server-side change — a stale process silently serves old API behavior (the dry-run/test order won't reflect the edit). When a fee is folded into a total, ALSO record it as an itemized line (single source the screen + PDF + CAV + push all read) — an invisible fee makes the total look wrong and can hide a silent drop. Detail: `memory/ORDER_FORM_ARCHITECTURE_REVIEW_2026-06-09.md` Session 3.

## Archived 2026-07-04

### SCP saved full WA tax when "Include Tax" was unchecked; DTF could print a $0 PDF with pricing unloaded (2026-06-14)
**Problem:** Two silent-wrong-price gaps found by a 27-agent audit (ground for "are you 100% confident?"). (1) SCP: unchecking "Include Tax" showed $0 tax on screen + PDF, but `saveAndGetLink` passed the raw `#tax-rate-input` (still 10.1 — only wholesale/CRM-exempt zero it) and `screenprint-quote-service.js` has no include-tax gate, so the saved/mirrored/pushed quote billed full WA tax. (2) DTF: `printQuote()` guarded only product-count, not pricing-loaded, so if `/api/pricing-bundle` was down at page load (`init()` keeps the form interactive) Print emitted a $0.00 PDF — same class as the Bradley bug, which `saveAndGetLink` already guarded (L2332/L2342) but print didn't.
**Root Cause:** SCP was the lone builder missing the save-time include-tax gate (DTF gates `taxAmount = includeTax ? … : 0` dtf L1965; EMB gates `taxRate→0`); DTF's pricing-loaded guard was added to save (2026-06-11) but never copied to print.
**Solution:** SCP save now gates `taxRate: (!#include-tax.checked) ? 0 : parseFloat(rate||10.1)` (screenprint-quote-builder.js:4183). DTF `printQuote` got save's two guards (`!currentPricingData||!pricingCalculator` + `subtotal>0` → `showError`, no $0 PDF). Verified in-browser (unchecked→saves 0; guard passes when pricing loaded) + full suite 1,414 green incl. live pricing-baselines.
**Prevention:** A control that changes the on-screen total (include-tax checkbox) MUST gate the SAVE path too, not just display — assert per-surface parity (screen/PDF/save/push), not just grand total. Every pricing-output surface (save AND print AND push) needs the same pricing-loaded guard; copying it to one path only is a Rule-8 sibling miss. AUDIT META: 3 adversarial verifiers misread a guard *comment* (`// Do NOT re-declare… (regression fixed 2026-06-14)`) as a live duplicate `function` declaration and raised false "critical" alarms — always adjudicate contradictory agent verdicts against the actual file (`grep "function name"` = 1 decl).

### Storefront orders stored cart in JSON blobs only — /quote + /invoice showed "No items" + mis-taxed (2026-06-12)
**Problem:** A real test cap order (CAP0612-5539) viewed at /quote showed "No items in this quote" and double-taxed to $894.61; the proforma /invoice showed "$0 tax — Out of State." The order data was actually fine (captured in the JSON blobs).
**Root Cause:** The shared storefront save (`save3DTQuoteSession`, tees+caps) wrote the cart ONLY into JSON blobs and set `TotalAmount = grandTotal` (tax-INCL) with NO `TaxAmount`/no `quote_items`. But /quote + /invoice read line items from quote_items and treat `TotalAmount` as PRE-tax → /quote recomputed tax on the tax-incl figure (812.54×1.101=894.61), /invoice trusted absent TaxAmount as $0. (Separately: it never reached ShopWorks because it was UNPAID — Stripe `status:unpaid`; the webhook→push only runs on a completed charge = working as designed.)
**Solution:** `save3DTQuoteSession` now writes `TotalAmount`=pre-tax subtotal + `TaxAmount` + `TaxRate` AND synthesizes quote_items (new pure module `shared_components/js/storefront-quote-items.js`, jest-locked: row per color footing to subtotal + SHIP fee row when shipping>0) — fire-and-forget so a display-row write never blocks the sale. Backward-compat: Quote-Mgmt `getEffectiveAmount` + ShipStation `amountPaid` fallback read `TotalAmount+(TaxAmount||0)` (old rows TaxAmount 0 → unchanged). ShopWorks sync never writes quote_items (no dup). Live-verified both readers ($738+$74.54=$812.54).
**Prevention:** Any customer-facing quote/invoice surface MUST write quote_items + obey the reader contract (`TotalAmount` PRE-tax, separate `TaxAmount`/`TaxRate`, shipping as a SHIP item) — JSON blobs are invisible to the readers. Grep EVERY `.TotalAmount`/`.TaxAmount` reader before changing the tax convention. "Storefront order didn't reach ShopWorks" → check Stripe payment_status FIRST.

### Pricing-baselines gate red — drift was Erik's own Caspio margin lift, traced before re-lock (2026-06-11)
**Problem:** `npm run test:pricing-baselines` failed DTG-02/03/04 + DTF-04/05 with uniform +$0.50 (DTG-04 +$1.50) per-piece drift vs the 2026-05-24 lock. First hypothesis was a SanMar blank-cost increase — wrong.
**Root Cause:** Erik raised DTG+DTF margins in Caspio `Pricing_Tiers` on 2026-05-24, after the lock: `MarginDenominator` 0.57 → 0.53 (tiers 24-47/48-71/72+) and 0.57 → 0.55 (DTG 1-23 / DTF 10-23). Garment costs (PC54 $3.00, F260 $12.94) and print/transfer costs unchanged. The other 19 scenarios passed because rounding absorbed the bump — INCLUDING EMB/CAP, which are ALSO 0.55/0.53 live (a passing scenario does NOT prove the margin didn't move; only a recorded fingerprint like `garmentSellPerPiece` does). SCP was tightened pre-lock.
**Solution:** Traced every delta arithmetically — `ceilHalf(garmentCost/MD + printCost)` reconciles all 5 old AND new prices exactly — then confirmed the same prices render in the staff DTG calculator UI ($13.50 / $20.00 / $30.00). Erik confirmed intentional → re-locked `baselines.locked.json` with approval stamped in `_meta`. Gate green 24/24.
**Prevention:** The locked DTF baselines fingerprint the margin at lock time: `garmentSellPerPiece` (5.26 = 3/0.57 then; 5.66 = 3/0.53 now) — check that FIRST when baselines drift by uniform rounded half-dollar steps; MarginDenominator moves more often than garment costs. Caspio price changes are invisible to git — the baseline gate is the ONLY tripwire, so NEVER rubber-stamp a re-lock without tracing the delta to a named upstream change (intentional → re-lock with sign-off; otherwise → regression). Per ROADMAP Phase 6 workflow: after any Caspio `Pricing_Tiers` edit, re-capture + re-lock the SAME DAY so the gate doesn't cry wolf for weeks.

### Sample price rode in a customer-editable URL param into ShopWorks; sibling page's "same" margin had drifted from Caspio (2026-06-11)
**Problem:** `pages/top-sellers-product.html` built its sample-cart item with `price: parseFloat(params.price)` + `sampleType: params.get('sampleType')` straight from the URL — `sample-order-service.js` then wrote "PAID SAMPLE - Invoice customer $X" into ShopWorks notes from that value, so `?price=0.01&sampleType=free` bought any paid sample for pennies. Separately, the showcase page that GENERATES those URLs computed the price with a hardcoded `/0.57` margin while Caspio's BLANK Pricing_Tiers said 0.53 — customers were systematically underquoted vs the intended margin.
**Root Cause:** Price was treated as display data and round-tripped through a customer-controlled channel (URL) instead of being re-derived at the trust boundary; and a frontend margin literal ("2026 margin" comment) silently drifted from the Caspio source of truth.
**Solution:** New `resolveSamplePricing(style)` in top-sellers-product.html — at add-to-cart it re-derives free/paid + price from `GET /api/pricing-bundle?method=BLANK` (min blank cost <$10 → free; else minCost ÷ tier-1 MarginDenominator, half-dollar ceil), visible alert + no cart-add on API failure. Showcase margin now read from the same bundle (eligible:false on missing margin, never a hardcoded fallback). Verified in preview: URL claiming `price=99.99&sampleType=paid` for PC54 → cart stored free/$0; showcase buttons render API-margin prices ($192 CT104670 matches resolver exactly).
**Prevention:** Anything that becomes money in an order must be RE-DERIVED server-/API-side at the point of trust, never parsed from a URL/storage the customer can edit (same class as the `_FB` push-gating rule: key on server-stamped facts). When two pages "share" a pricing rule by copy-paste, the literal WILL drift — point both at the API value. Residual (P5): sessionStorage cart is still client-trusted until the sample-cart rebuild adds a server-side reprice. **Same-day 2nd instance (search):** product-search-service.js CATEGORY_KEYWORDS hardcoded 'Fleece'/'Headwear' but live categories are 'Sweatshirts/Fleece'/'Caps' → 11 common words (hoodie, hats, caps…) returned ZERO products in production. Fixed values + drift guard: when OUR inferred filter (not the user's) yields 0 results, retry without it and log a warn — an inference must never blank a search. Full taxonomy fix (API-driven categories) = redesign P2.

### Proxy quote_sessions lookups cache 5 min — a pre-create existence check POISONS the key your webhook reads (2026-06-09, archived 2026-07-06)
**Problem:** 3-Day Tees rebuild added a QuoteID-uniqueness check (`GET /api/quote_sessions?quoteID=X`) BEFORE creating the row. In live verification, every subsequent lookup of that QuoteID — webhook idempotency, success-page polling, SessionID stamping — returned `[]` even though the row existed (unfiltered GET showed it).
**Root Cause:** The proxy's GET `/quote_sessions` caches results for 5 min keyed by the WHERE conditions (`quotes.js:436-469`). The pre-create check cached `QuoteID='X' → []`; the row was created seconds later; the Stripe webhook (arriving within the TTL) would read the poisoned `[]` → "payment without order record" → paid order never pushed. Separately discovered: `PUT /api/quote_sessions?filter=QuoteID='X'` (legacy Stripe-session-ID stamp) **has no matching route** — the proxy PUT only supports `/:PK_ID` — so it 404'd silently for months and SessionID never updated (`3dt_*` instead of `stripe_*` on every historical 3DT row).
**Solution:** Every money-path quote_sessions read now passes `&refresh=true` (bypasses + re-warms the cache): the uniqueness check, the webhook lookup, the success-page poll. The SessionID stamp now resolves PK_ID via a refresh=true GET then PUTs `/quote_sessions/{PK_ID}`. Webhook also exact-matches `.find(s=>s.QuoteID===id)` and alerts loudly (`alert3DT` → Slack/console) on payment-without-record and push failures.
**Prevention:** (1) Any flow that READS a key it is ABOUT TO CREATE must bypass read caches — an existence check is a cache-poisoning write. (2) Status-polling reads (webhook idempotency, success pages) must always bypass the 5-min cache or they act on stale state. (3) A "non-fatal, silently caught" HTTP call that never errors in logs can be hitting a route that doesn't exist — verify the route signature (`PUT /quote_sessions` only routes by `/:id`), don't trust the absence of errors.

### Customer Supplied Screen Print calculator had 100% hardcoded pricing — a 4th, disconnected price surface (2026-07-01)
**Problem:** `calculators/screenprint-customer/` (customer-supplied-garment screen print quotes) computed every dollar from a local `RETAIL_PRINT_PRICING` object, a flat `$100` LTM fee at qty 24-71, and a `frontColors+1` bump on dark garments — completely disconnected from Caspio, `QuoteCartEngine`, or Quick Quote/staff builder. Live-verified drift: real 1-color 24-47 print is $6.00/pc (hardcoded said $6.25); real tier boundaries are 24-47/48-71/72-144/145-576 (hardcoded said 24-71/72-143/144-287/288-499/500+); real LTM is $50 only at 24-47 (hardcoded was $100 flat 24-71); dark garment inflated the per-piece price instead of only adding setup screens (the exact bug already fixed elsewhere for `screenprint-pricing-v2.js`/`screenprint-manual-pricing.js` in the 2026-06-11 dark-garment-parity fix — this standalone calculator was simply never migrated).
**Root Cause:** This calculator predates the 2026-06 customer-quote-cart unification and was never wired to `quote-cart-engine.js`'s `priceScpGroup` — it has no garment (customer supplies the blank), so it couldn't reuse the standard `fetchPricingData(styleNumber)` path, which always bakes in a real garment's blank cost.
**Solution:** Added a `customerSuppliedGarment:true` option to `priceScpGroup` (quote-cart-engine.js) that swaps the bundle fetch to `ScreenPrintPricingService.generateManualPricingData(0)` — the SAME manual-cost machinery already used by Order Form manual rows and `screen-print-pricing.html`'s manual calculator, just with the manual cost forced to $0 instead of an operator-entered value. Every downstream formula (tier lookup, LTM, screens/setup, back/sleeve pricing, safety stripes, below-minimum gate) is 100% unchanged/shared — a single conditional branch on which fetch to call. The calculator now calls `QuoteCartEngine.singleItemPreview()` — the exact function Quick Quote uses — with a synthetic `sizes:{S: qty}` item (S carries no garment-size upcharge, so the whole qty prices as one flat rate, matching the calculator's flat-quantity UI). Added a pre-submission tier ladder (probes the 4 live tier boundaries via the same engine call) and a visible error banner on API failure. Locked by `tests/unit/screenprint-customer-parity.test.js` (9 tests, live-API-cross-verified) + confirmed all 86 existing SCP tests / 1477 total unit tests still pass (purely additive engine change).
**Prevention:** When a calculator needs "no garment cost" pricing (customer-supplied blanks, cost-unknown scenarios), reuse `generateManualPricingData(0)` rather than inventing a new bundle field or a parallel formula — it's an existing, already-tested pattern used by 4 other pricing services + Order Form manual mode. Before trusting a project-memory code comment about a formula (e.g. "$50 at 48"), verify against the LIVE API — a terse comment can be ambiguous and a static test fixture can predate a recent Caspio rate change; live-fetching the actual `/api/pricing-bundle` response settled a real discrepancy here.


### AEs got NO email/Slack when Steve completed artwork — 3 stacked bugs (2026-06-26, archived 2026-07-06)
**Problem:** AEs (Nika/Taneisha) were never notified on art-request completion — no email, no Slack.
**Root Cause:** Three independent defects. (1) Gallery "Complete" silently failed: `art-hub-steve-gallery.js markComplete()` did `PATCH /api/art-requests/:id/status` but the proxy only registers **PUT** (PATCH → 404). (2) Completion email misrouted to `sales@`: it was a browser EmailJS send resolving the free-text `Sales_Rep` (live value is a FULL name, "Nika Lao") through a FIRST-NAME-keyed map (`REP_EMAIL_MAP`/`resolveRep`) → fell to the `sales@nwcustomapparel.com` fallback; the valid `User_Email` (nika@…) sat unused. (3) No AE Slack at all: the only completion Slack was a `#art-notifications` CHANNEL ping (Steve/Ruth-only, no AE @-mention/DM) — AND it was itself dead since 2026-05-10: `art.js` PUT-status referenced `current` (a `const` declared INSIDE the `if`) from the notify block OUTSIDE that block → `ReferenceError: current is not defined` swallowed by the notify `try/catch`, silently killing **all** art-status pings.
**Solution:** Moved AE completion alerts SERVER-SIDE. `PUT /status` (status `Completed`) → new `notify-art-completion.js`: resolve AE via `resolveAEEmailLoose(Sales_Rep) || resolveAEEmail(User_Email)` (full-name tolerant), email via `sendArtNoteEmail` (proven `template_art_note_added`), DM via new `slack-dm-notify.js` (`chat.postMessage`, `SLACK_BOT_TOKEN`, email→Slack-id map + `users.lookupByEmail` fallback, no-op if token unset). Hoisted `current` to function scope (restores every status ping). Gallery `markComplete` PATCH→PUT+actor; detail-page `showArtTimeModal` dropped the misrouted client email + sends actor; frontend `resolveRep` made full-name tolerant. Jest: `slack-dm-notify` + `notify-art-completion`.
**Prevention:** (a) An out-of-scope `const` referenced inside a swallow-all `try/catch` is invisible — fire-and-forget notify blocks hide `ReferenceError`s; unit-test the path by actually invoking it, and `(x && x.y)` does NOT guard a not-defined `x`. (b) A name→email map keyed by first name MUST tolerate the full-name `Sales_Rep` data (or prefer `User_Email`) — mirror backend `resolveAEEmailLoose`. (c) A frontend `fetch` verb must match a real route — art/mockup status is **PUT only**, no PATCH. (d) "Notify a person" = backend chokepoint on the write, NOT browser EmailJS or a shared channel they don't watch. Needs `SLACK_BOT_TOKEN` (chat:write) on the proxy or DMs no-op (email still works).


<!-- archived 2026-07-07 from LESSONS_LEARNED.md (resolved one-time fix) -->
### Same calculator, follow-up E2E test found 2 more bugs: displayed quote ID ≠ saved quote ID, and email failure masked a successful save (2026-07-01)
**Problem:** A real end-to-end submission test (fill form → submit → check the actual Caspio row) surfaced two bugs the pricing fix above didn't touch. (1) `screenprint-customer-quote-service.js`'s `saveQuote()` called `this.generateQuoteID()` a SECOND time internally, producing a different sequential ID than the one `handleQuoteSubmit()` already generated and displayed to the customer — so the ID shown on the success modal (e.g. `SPC0701-1`) never matched what was actually saved (`SPC0701-2`); a rep searching by the customer's quote ID would find nothing. (2) `handleQuoteSubmit()` wrapped the Caspio save AND the EmailJS send in one try/catch — if EmailJS failed for any reason (confirmed live: EmailJS rejects non-allowlisted origins, e.g. localhost), the customer saw "Failed to send quote. Please try again." even though their quote had already saved successfully with a valid ID.
**Root Cause:** (1) `BaseQuoteService.generateQuoteID()` increments a sessionStorage counter on every call — calling it twice per submission (once in the page, once inside the service) always produces two different values. (2) Caspio-save and email-send are independent operations that were never given independent success/failure tracking.
**Solution:** `saveQuote(quoteData)` now requires and uses the caller's `quoteData.quoteId` instead of minting a new one (throws if missing). `handleQuoteSubmit()` tracks `saved`/`emailed` as two separate booleans; shows success whenever EITHER produced a durable record (a Caspio row, or — if saving wasn't requested — the email itself), and only alerts failure when BOTH failed. A save-succeeded-but-email-failed case now `console.warn`s so it's still discoverable. Verified live: reproduced the exact save-succeeds/email-403-fails case (no alert, success shown) and confirmed a fresh submission's displayed ID exactly matches the Caspio row's `QuoteID`.
**Prevention:** Never call an ID-generating function more than once per logical request — generate it ONCE at the top and thread it through every downstream call. When a submit handler chains two independent side effects (save + notify), track their outcomes separately; a shared try/catch conflates "nothing happened" with "the important part happened, a notification didn't" — customers should never be told a request failed when a record of it already exists somewhere they (or a rep) can find it.

---

## Duplicate `function NAME()` alias hoisted over the async one-click push flow (SCP + DTF, 2026-06-14) (archived 2026-07-07)
**Problem:** The always-visible "Push to ShopWorks" buttons (Path 1, v2026.06.14.9) did NOTHING on a never-saved SCP/DTF quote — no save, no preview, no error. The one-click flow is `async function scpPushToShopWorks()` (auto-save via `saveAndGetLink({skipShareModal:true})` → open preview), but a 2nd `function scpPushToShopWorks() { return openScpPushPreview(); }` "back-compat alias" sat AFTER it at the same module scope. `openScpPushPreview()` early-returns when the button is disabled or `_scpPushQuoteId` is null (true on a never-saved quote), so the click did nothing. DTF had the identical pair (`dtf-quote-builder.js`).
**Root Cause:** Two `function NAME(){}` declarations at one module scope — function-declaration hoisting makes the LAST one win the identifier, and BOTH `window.NAME = NAME` assignments then resolve to it (all bindings settle at hoist time, before any line runs). The intended async fn was dead code; the source-order of the two `window.X=X` lines is irrelevant.
**Solution:** Deleted both back-compat aliases (left a comment where each was). The async (auto-save → preview) fn is now the SOLE declaration bound to `window.scpPushToShopWorks`/`window.dtfPushToShopWorks` + the HTML `onclick`. Locked by `tests/unit/push-button-binding.test.js` — per builder: exactly ONE declaration and it's `async`, plus the bound window fn returns a Promise (mutation-verified: re-adding the alias fails both assertions).
**Prevention:** Never keep two `function NAME(){}` at the same scope — the later silently wins regardless of where the `window.X=X` lines sit. An "alias" must use a DIFFERENT name (or `const X2 = X`). When wiring a button to an async one-click flow, assert the bound global returns a Promise. Rule-8: a duplicate-decl bug in one builder almost always exists in its siblings — grep all 4 the same day.

## Stubs condensed 2026-07-09 (bodies verbatim from LESSONS_LEARNED.md)

### Two shipping-path pricing bugs the estimator exposed (2026-06-08) — ARCHIVED 2026-06-14
Moved to [LESSONS_LEARNED_ARCHIVE.md](./LESSONS_LEARNED_ARCHIVE.md). Keep-alive rules: a recalc must NEVER read its own written-back display as its base (own a stable `data-base`); if `TotalAmount` excludes a charge the mirror re-adds, persist the row the mirror reads; saved `TaxAmount` must tax `(base + shipping)` because `/invoice` trusts it verbatim.

### DTG save read the AI chat quote, NOT the manual form — decoupled-source desync (2026-06-08) — ARCHIVED 2026-06-14
Moved to [LESSONS_LEARNED_ARCHIVE.md](./LESSONS_LEARNED_ARCHIVE.md). Keep-alive rules: when adding tax/fees to a save, confirm WHICH object the save serializes reflects the on-screen total (two sources → save the live one, not a stale AI blob); run an adversarial diff review before any money-path deploy; when a row "fails to price" clear ALL its derived fields; EVERY new tax/toggle flag MUST be re-seeded in the builder's reset path (missing key reads `undefined`, `!undefined===true` flips the wrong branch).

### Extracting a shared band module — alias globals + test-harness load order (2026-06-08) — ARCHIVED 2026-06-14
Moved to [LESSONS_LEARNED_ARCHIVE.md](./LESSONS_LEARNED_ARCHIVE.md). Keep-alive gotchas: a shared module aliasing globals MUST load BEFORE its consumer; add new shared deps to manual jsdom `inject()` harness lists IN ORDER; per-builder content stays a `logos()` callback (closure); each reset/edit-reload/draft path needs its own `renderOrderRecap()`.

### Push button stranded disabled — spinner destroyed the label; checklist/button desync (2026-06-07) — ARCHIVED 2026-06-11
Moved to [LESSONS_LEARNED_ARCHIVE.md](./LESSONS_LEARNED_ARCHIVE.md). Keep-alive gotchas: never replace a button's innerHTML when code reads a child by ID; gate the action button from the SAME function that renders its readiness checklist.

### Phase 3.1 — shared `pricingData` contract locks the invoice generator's input (2026-06-02) — ARCHIVED 2026-06-11
Moved to [LESSONS_LEARNED_ARCHIVE.md](./LESSONS_LEARNED_ARCHIVE.md). Keep-alive: all 4 builders MUST wrap invoice input in `QuotePricingData.buildPricingData()` (quote-pricing-data.js) — never post-override fields after the normalizer; validator throws on dev hosts, warns in prod; contract locked by `tests/unit/invoice-totals.test.js`.

### Design ExtDesignID collision: transfer order showed an embroidery design (2026-06-02) — ARCHIVED 2026-06-11
Moved to [LESSONS_LEARNED_ARCHIVE.md](./LESSONS_LEARNED_ARCHIVE.md). Keep-alive: any external dedupe key (`ExtDesignID`, ExtOrderID) must be GLOBALLY unique — derive from the FULL QuoteID, never a trailing sequence (date-packed IDs reset daily; SW silently merges designs sharing an id).

### DTG edit-reopen never fired + dashboard Edit opened the wrong builder (2026-06-01) — ARCHIVED 2026-06-11
Moved to [LESSONS_LEARNED_ARCHIVE.md](./LESSONS_LEARNED_ARCHIVE.md). Keep-alive: a QuoteID prefix is its LEADING LETTERS (regex `^[A-Za-z]+`) — never `split('-')[0]` (only survives EMB's hyphenated format); lock quote edits on `PushedToShopWorks`, not just `Status` (hourly sync flips Status only after SW imports).

### ShopWorks ManageOrders integrations: APISource routing (2026-06-02/04) — ARCHIVED 2026-06-15
In [LESSONS_LEARNED_ARCHIVE.md](./LESSONS_LEARNED_ARCHIVE.md). **THE RULE (load-bearing): the OnSite integration's APISource value and EVERY push path's APISource must be IDENTICAL — today both = `ManageOrders`.** A blank-APISource integration is the catch-all (pulls every order); a specific one only pulls exact matches. All push paths stamp `APISource:"ManageOrders"` (proxy transformers EMB/SCP/DTF, proxy `transformOrder` for order-form/3DT/DTG, server.js order-form, Inksoft `transform.py`). DIAGNOSTIC: order reaches MO (`/order-pull` finds it) but `/getorderno` stays count:0 ⇒ suspect this filter mismatch FIRST, not the payload.
### Double size-suffix: quote-builder push transformers pre-suffixed the PN (2026-06-02) — ARCHIVED 2026-06-15
In [LESSONS_LEARNED_ARCHIVE.md](./LESSONS_LEARNED_ARCHIVE.md). Keep-alive: for any ShopWorks PUSH send the BASE part number + plain size and let the integration's Size Translation Table append the modifier — NEVER `getPartNumber()`/pre-suffix a pushed `PartNumber` (that's for FRONTEND display + SanMar inventory only). Verify on the **processed** SW order, not the MO intake JSON. Design types: EMB→2, SCP→1, DTF→8, DTG→45, sticker→4, emblem→5 (cap designs stay 2; `6 CAP` unused).


## Stubs condensed 2026-07-09b (bodies verbatim)

### Builder push→import→sync-back loop VERIFIED (2026-06-01) — ARCHIVED 2026-06-11
Moved to [LESSONS_LEARNED_ARCHIVE.md](./LESSONS_LEARNED_ARCHIVE.md). Keep-alive gotchas: post-push `getorderno count:0` is EXPECTED ~15-30 min (FileMaker MO-UPDATE import cycle, business hours only — wait 2+ cycles before diagnosing); proxy `/quote_sessions` LIST GET is cached — verify fresh writes by PK_ID (`/quote_sessions/:id`), never a filtered list read. **The sync-BACK that fills `ShopWorks_*` (status/progress/snapshot/salesperson) runs via the proxy Heroku Scheduler cron `scripts/sync-quote-sessions-from-shopworks.js` → `POST /api/quote-sessions/bulk-sync-from-shopworks` PLUS per-quote page-load auto-sync — there is NO in-app interval. Salesperson column = `snapshot.order.CustomerServiceRep`.** **The stored `ShopWorks_Snapshot` MUST include `pushed` (Designs/Attachments/ShippingAddresses) — fixed 2026-06-15.** The quote-view Designs table reads `snapshot.pushed.Designs[].id_DesignType` (45→DTG) + `Locations[].Location` ("Full Front") for TYPE/LOCATION; the sync used to persist only `{order,lineItems,fetchedAt}`, so the page fell to its fallback branch → "Unknown" type (the /v1 order has NO id_DesignType) + a hardcoded "Left Chest" default, even though MO/ShopWorks said Full Front/DTG. Fix: add `pushed` to BOTH the `newSnap` written to Caspio AND the snapshot returned by `sync-from-shopworks` (server.js ~7091/7140). GOTCHAS: `/full` reads via `?filter=QuoteID=` (CACHED ~5min) so a fresh write only shows after expiry — BUT the quote-view Refresh button re-renders from the sync RESPONSE (`applyShopWorksOverlay(result.snapshot)`), bypassing the cache; quote-view fallback no longer hardcodes "Left Chest" (→"(unspecified)") and derives type from the QuoteID prefix so blank-`pushed` legacy quotes aren't mislabeled.


### Quote Mgmt role-based delete + edit-mode reminders (2026-06-15)
Role-based delete on `dashboards/quote-management.html`: master (`erik@nwcustomapparel.com`, `MASTER_DELETE_EMAILS` set) deletes ANY quote; every other rep deletes ONLY quotes they own; not-logged-in/unknown deletes none. Owner = `SalesRepEmail` → ShopWorks `snapshot.order.CustomerServiceRep` (name→email via `StaffAuthHelper.STAFF_EMAIL_MAP`) → `SalesRepName`. Non-owned rows get a disabled trash + disabled checkbox; `toggleSelectAll`/`updateCheckboxSelection` skip disabled so bulk-delete can't bypass; `deleteQuote()` re-checks. **GOTCHA: `StaffAuthHelper` is a top-level `const` → NOT on `window`; reference it bare (`typeof StaffAuthHelper`), `window.StaffAuthHelper` is undefined (caught in test: emptied the email map → nobody but master could delete own quotes).** **Server-side enforcement SHIPPED 2026-06-15**: dashboard delete now routes to pricing-index (relative URL, `credentials:'same-origin'`) which gates `DELETE /api/quote_sessions/:id` on `req.session.crmUser` (master = Erik firstName/email; else owner-match; no session → 401; mismatch → 403) — same auth as the CRM dashboards; the dashboard establishes the session on load via `POST /api/crm-session`. GOTCHA caught in test: fetch the row by PATH param `/quote_sessions/:pk` — `?q.where=PK_ID=N` is IGNORED on that proxy GET (returns ALL rows → row[0] wrong → rep blocked from their OWN quote). As secure as the CRM-session model (crm-session trusts the post-Caspio-auth client claim — hardening that is a separate app-wide item). EDIT (answer, no code): dashboard pencil → `{builder}?edit={QuoteID}` (prefix-routed) → `loadQuoteForEditing()` restores everything; the `#product-search` box + "Add Product" button stay live in edit mode, so adding NEW line items works. Editing is dashboard-only; locked once `PushedToShopWorks`/Status∈{Processed,…}. **Active/Completed/All TABS SHIPPED 2026-06-15**: `isCompletedQuote()` = snapshot `sts_Shipped && sts_Invoiced && sts_Paid`; Active tab hides completed (default, 30d), Completed widens date→All, All=everything. Stats + tab counts read `baseFilteredQuotes` (PRE-tab) so they're stable across tabs; the "Active Quotes" stat now excludes completed. No backend change — all client-side off the already-synced snapshot. **Inbound SanMar (blank-goods vendor→us) shipment SHIPPED 2026-06-15**: quote-view auto-loads `GET /api/quote-sessions/:id/vendor-shipment?woId=` (pricing-index composes proxy `sanmar-orders/lookup?woId=`→SanMar PO + LIVE `sanmar-shipments/po/:po` OSN) → PO/status/carrier+tracking; dashboard "Inbound" column = ONE batched `GET /api/sanmar-orders/batch-status?woIds=` (NEW proxy route; SYNCED Caspio data only, no per-row SOAP → lags the quote-view's live OSN by up to the daily sync). `mapSanmarState`: Shipped/Complete→shipped, Partially Shipped→partial, Confirmed/Received→confirmed; a non-empty Tracking_Number promotes a stale confirmed→shipped (never claims shipped without backing). Reuses existing proxy SanMar OSN — do NOT rebuild. Two-repo change (proxy + pricing-index).


### Hourly ManageOrders sync-back (+ ShipStation tracking) cron silently failed: localhost self-call 302'd to https://localhost by the force-HTTPS middleware (2026-06-15)
**Problem:** Quote-Mgmt dashboard never updated ShopWorks status/progress/salesperson. The Heroku Scheduler job WAS firing hourly (Heroku showed recent "Last Run"), but every active row's `ShopWorks_Last_Synced` was stuck ~24h+ (one NEVER synced), snapshots empty, Progress = "—". Rows only ever updated when a human OPENED a quote (page-load sync). Symptom mimicked "cron not running" — it was running, just no-op'ing.
**Root Cause:** `bulk-sync-from-shopworks` fans out to each quote via an internal self-call `fetch('http://localhost:$PORT/api/quote-sessions/:id/sync-from-shopworks')`. The force-HTTPS middleware (server.js ~407: `if (req.headers['x-forwarded-proto'] !== 'https') return res.redirect('https://' + req.hostname + req.url)`) caught it — the loopback request has no `x-forwarded-proto` header, and Express's `req.hostname` STRIPS the port → it 302'd to `https://localhost` (→ :443, no listener) → `ECONNREFUSED 127.0.0.1:443`. So bulk-sync returned `{synced:0, errors:N, errorDetails:[ECONNREFUSED https://localhost…]}` every hour. Page-load syncs survived only because the browser hits the real public HTTPS host. The ShipStation tracking-backfill cron self-call had the identical bug.
**Solution & Prevention:** Middleware now bypasses the redirect for loopback hosts (`req.hostname === 'localhost' || '127.0.0.1' → next()`) — loopback can't originate externally on Heroku and must never go to https://localhost; both cron self-calls also send `x-forwarded-proto: 'https'` (belt-and-suspenders). Proven prod-mode locally: loopback no longer redirects, external traffic STILL force-redirects (security intact), real bulk-sync went `errors:2 → errors:0`. Added a manual "Sync from ShopWorks" button to Quote Mgmt (v2026.06.15.1). RULES: any in-process self-call (`fetch('http://localhost:$PORT/…')`) BEHIND a force-HTTPS/host-redirect middleware gets redirected into oblivion — exempt loopback at the TOP of that middleware (or call the handler logic directly). `req.hostname` ≠ `req.headers.host` (it drops the port). A cron that POSTs to another app and only logs aggregate stats hid this for weeks: **alert on `errors>0`/`synced==0`, not just exit 0**. **WATCHDOG SHIPPED 2026-06-15** (mirrors supacolor-health): pricing-index records each bulk-sync run in-process + exposes `GET/POST /api/quote-sync-health[/alert]` (reasons: no-sync-since-boot / stale-cron / sync-errors / sync-noop; coldStart-safe); proxy cron `check-quote-sync-health.js` (`npm run check-quote-sync-health`) polls it → deduped Slack. SETUP Erik must do: add Heroku Scheduler job on caspio-pricing-proxy (hourly :30) + set `SLACK_QUOTE_SYNC_HEALTH_WEBHOOK_URL` on sanmar-inventory-app. Diagnose stale sync-back via `bulk-sync-from-shopworks {dryRun:true}` then a real run (watch `errorDetails`).


## Archived 2026-07-10 (memory-maintain — old resolved one-time fixes)

### Quote page froze the push-time design name + read ShopWorks N/A code "8" as "Shipped" (2026-06-16)
**Problem:** `/quote/:id` showed the generic pushed design name (`DTG…-Customer Logo`) not the operator-renamed ShopWorks name (`40th Birthday…`); a Customer-Pickup order read **Shipped: Yes** though nothing shipped (the on-screen UPS # was the INBOUND SanMar blanks, a separate feed).
**Root Cause:** The hourly sync writes the WHOLE snapshot into one Caspio column — `order` = live `/v1/orders`, `pushed` = `/order-pull` FROZEN at push. The Designs panel preferred `pushed.Designs[0].DesignName` (frozen) over live `order.DesignName`. The Shipped tile used any-nonzero `sts_Shipped`, but per MANAGEORDERS_CRM_CAPABILITY_REFERENCE the codes are 0=No/1=Yes/.5=Partial/**8=N/A**/222=N/A. Live MO `tracking`+`payments` were fetched then DROPPED before persist, so outbound tracking/ship-date never displayed.
**Solution:** Primary design (i===0) now prefers live `order.DesignName`. Status tiles + dashboard pills + `isCompletedQuote` now **MIRROR the ShopWorks state** via one shared `mapSwStatus()` (`0=No,1=Yes,.5=Partial,8/222=n/a,empty="—"`) instead of forcing Yes/No — so a pickup order reads `Produced: n/a`, `Shipped: n/a` exactly like the OnSite order screen, and Purchase-Received is a Purchased+Received composite. (An interim date/tracking gate + "Ready for Pickup" relabel was REVERTED — it didn't match ShopWorks; `isCompletedQuote` treats `Ship=n/a` as non-blocking so pickup orders can still complete on invoiced+paid.) Persist `tracking`+`payments` (slice 50) into ShopWorks_Snapshot. Inbound SanMar indicator → dolly icon + "Inbound blanks" (was a truck, same as Shipped).
**Prevention:** The ShopWorks sync writes a snapshot BLOB, not flat columns — name/ship status render LIVE from JSON, and `pushed.*` NEVER reflects post-push edits (only `order.*` does). A ShopWorks `sts_*` is a multi-state code (`8/222=N/A`, `.5=Partial`), NOT a boolean — mirror the OnSite screen's actual state, never collapse to Yes/No (verify against the real order screen, not a heuristic), and derive the SAME state everywhere (one mapper) so a tab can't disagree with a pill. Builder quotes (EMB/SCP/DTF/OF) link by **ExtOrderID, not PO==QuoteID** (storefront-only); `getorderno` is the ONLY ExtOrderID→WO# resolver (no ExtSource scoping) and is empty for builder ExtSources — fix is upstream OnSite config, not code. `scripts/dry-run-backfill-shopworks-wo.js` (read-only) audits the storefront class. SanMar INBOUND: the order-status feed (OSS) and shipment feed (OSN) are SEPARATE PromoStandards services that lag — an order can SHIP without its status leaving `confirmed`, so a status-only incremental sync misses the tracking (Quote-Mgmt Inbound dot stays stale while the live feed + /quote page are correct). Proxy daily sync now drains a bounded `POST /api/sanmar-orders/sync-shipments` catch-up (pull live shipments for open-no-tracking orders) + dashboard "Refresh Inbound" button gives the live view on demand; `mapSanmarState` promotes confirmed→shipped once a tracking row exists.

### A ShopWorks size-swap (S→M) never updated the quote-view size table OR the "edited" banner (2026-06-26)
**Problem:** Rep edited WO #142292 sizing in ShopWorks (removed S, added M → M=2/L=1/XL=1) — qty (4), unit ($31.75), total ($127) all unchanged. `/quote/:id` kept showing the old S=1/M=1/L=1/XL=1, and the banner only flagged "Purchasing status 0→1", never the size change.
**Root Cause:** TWO blind spots, both keyed on the swap leaving line total + price constant. (1) DISPLAY: the size cells render from the ORIGINAL `quote_items.SizeBreakdown` (sync never rewrites it); `_overlayQuoteFromShopWorks()` mirrored only the totals card + `.price-col`/`.total-col` from `snapshot.lineItems`, never the `.size-col`/`.qty-col` — so a fresh snapshot couldn't change the displayed distribution. (2) DETECTION: `diffSnapshots()` compared each line's `LineUnitPrice` + total `LineQuantity` but never `Size01..Size06` → zero change-log rows → no banner.
**Solution:** (1) `_overlayQuoteFromShopWorks` now also repaints the 6 `.size-col` cells + `.qty-col` from the snapshot's positional `Size0N` (Size01=S…Size05=2XL, Size06=catch-all), aggregating base + extended-SKU (`_2X`/`_3X`) lines and collapsing the group's stale extended-rows. SAFETY: only overlays sizes when `Σcols === ΣLineQuantity` (else leaves quote sizes + still fixes price/total — never paint a wrong/zero distribution, Erik #1). (2) `diffSnapshots` emits a `LineSizes[PN|color]` change row when the positional columns differ (frontend `_humanizeChange` renders it "PC54Y (White) sizes: S:1 M:1 L:1 XL:1 → M:2 L:1 XL:1"). Extracted the diff to `lib/quote-snapshot-diff.js` (server.js boots on require) + `tests/unit/quote-snapshot-diff.test.js`; overlay verified against the real method via jsdom.
**Prevention:** When "ShopWorks is source of truth", a snapshot field is only as live as the surface that READS it — a value the page renders from the original quote (not `snapshot.*`) will look stale no matter how well sync runs. A diff that only watches a TOTAL is blind to a same-total redistribution; compare the component breakdown too. MO `/lineitems` `Size0N` is positional (Size01=S … Size06=catch-all); extended SKUs land in the same column, so summing across all lines for a style rebuilds the distribution with no double-count.

### A fast-completing SanMar order was NEVER ingested → no inbound PO/tracking anywhere (2026-06-26)
**Problem:** WO #142292's blanks (SanMar PO 113470) shipped 6/25 with UPS tracking, yet the quote-view "Blank Goods — from SanMar" panel said "No SanMar PO linked," and it was absent from the dashboard inbound dot AND the daily shipments list. The daily sync had run fine that morning.
**Root Cause:** The SanMar order sync discovers ONLY via OSS `allOpen` (which EXCLUDES `Complete`) on Mondays + `lastUpdate since yesterday` (a 24h window) daily; `/sync-shipments` only re-touches orders ALREADY in the table. PO 113470 raced placed→shipped→`Complete` between sync windows, so it was never captured in a `lastUpdate` run — and once `Complete`, `allOpen` will never show it again. No `SanMar_Orders` row → invisible in all three surfaces (which all key on that table via `id_Order`). Proven: `lookup?woId`, `?company`, AND `?style=PC54Y` all returned 0 (the style lookup hits `SanMar_Order_Items`, so empty there means the order was never stored — not merely unlinked). NOT a PO↔WO offset/linking bug.
**Solution:** Manual `POST /api/sanmar-orders/link` (PO 113470↔WO 142292) made the quote-view panel pull LIVE OSN tracking immediately (it fetches `/sanmar-shipments/po/:po` by PO once a row exists). Systemic (proxy): `POST /api/sanmar-orders/sync-recent-completed` discovers missed orders TWO ways — a WIDE OSS `lastUpdate` window AND recently-INVOICED POs — and fully ingests any not yet synced (poSearch order+items → `pullAndStoreShipments` → `runQuickMatch`); in `sync-sanmar.js` daily + a manual Quote-Mgmt "Refresh Inbound" button. **It runs ASYNC (202 + background + `/sync-recent-completed-status` poll), NOT synchronous: invoice discovery + per-PO poSearch/shipment SOAP blows past Heroku's 30s WEB limit → H12 (the first synchronous, round-drained version H12'd for BOTH the button and the nightly script). Pattern = `/backfill` (return 202, run on the dyno, poll status).** Also fixed `/link` create branch dropping `id_Order` on INSERT (only UPDATE set it → first link saved an unfindable blank-`id_Order` row). Verified: one sweep ingested 24 missed orders, +32 tracking.
**Prevention:** Never poll a status-filtered upstream without a catch-up that covers TERMINAL states — `allOpen` can't resurface a Complete order, and an incremental window misses anything that transits the window in one hop. Use TWO discovery feeds (status + invoices) so one feed's lag/exclusion can't hide an order. **Any sync doing multi-step SanMar SOAP per item MUST be async (202+poll) — a Heroku WEB request that does live SOAP + Caspio writes per row will H12 at 30s; bounding the batch isn't enough.** Same class as the 2026-06-16 OSS/OSN fix, different leak: that re-pulled tracking for orders already stored; this was never stored at all. When "X isn't showing in 3 places," first prove the DATA exists (query the source by every key) before suspecting 3 display bugs.

### Caspio pricing tiers without matching cost-table rows silently price at $0 — `?.PrintCost || 0` is a money trap (2026-06-09)
**Problem:** The legacy 3-Day Tees page charged ~$7/shirt instead of ~$16.50 for every 1-23-piece cart, live in production. Verified against the live API: `pricing-bundle` tiersR gained a `1-23` row (2026-06 DTG-parity work) but `allDtgCostsR` only has labels `12-23/24-47/48-71/72+` — the lookup `find(c=>c.TierLabel===tier.TierLabel)?.PrintCost || 0` returned **$0 print cost** and the sale went through under-priced.
**Root Cause:** Two tables keyed by TierLabel drifted (a tier added without cost rows), and the consumer defaulted the miss to 0 instead of failing. The DTG flagship service already had the correct pattern (fall back to the lowest non-LTM tier's cost rows — `dtg-pricing-service.js:384-396`); the 3DT page predated it.
**Solution:** The rebuilt engine (`pages/js/3-day-tees-pricing.js`) resolves the cost label via the lowest-non-LTM-tier fallback and **THROWS** (`PricingError`, surfaced as a visible fatal banner) when a cost row is still missing after fallback — locked by `tests/unit/3dt-pricing.test.js` with the real bundle shape including the orphaned `12-23` label.
**Prevention:** A missing price component must throw/error-banner, never `|| 0` (Erik's #1 rule applies to lookup misses, not just fetch failures). When adding a tier row to Caspio, grep every consumer of TierLabel for hardcoded label joins — or better, reuse the shared pricing service that already handles the fallback.

### Sample program: "no inventory DATA" was read as "0 in stock" — every sample add silently blocked (2026-07-06)
**Problem:** During the top-sellers→catalog consolidation, E2E testing found the sample-cart inventory gate blocking EVERY add ("out of stock"), even PC54 Jet Black L. `/api/sizes-by-style-color` was returning `warehouses: []` + `sizeTotals` all 0 with `source: "sanmar-bulk"` (a fallback source that carries no stock numbers). `sample-inventory-service.js` summed the empty warehouses to qty 0 → `available: false` → block. This predates the consolidation — the old showcase used the same service, so the Free Sample Program was silently un-addable whenever the live-stock source degraded.
**Root Cause:** `parseCaspioInventory` only special-cased a MISSING `warehouses` key; an EMPTY warehouses array flowed through as structurally-valid zeros. Absence of data and presence of zero were indistinguishable downstream.
**Solution:** Empty/missing warehouse rows now set `noData: true`; `checkSizeAvailability` fails OPEN (`available: true, dataUnavailable: true`) and the cart shows an honest caveat toast ("Added — we'll confirm stock when we process your request"). Real zeros still block.
**Prevention:** Any availability/eligibility gate must distinguish "source says 0" from "source has no data" — blocking on structurally-empty data turns a degraded upstream into a silent feature outage (Rule 4's cousin: silent block is as bad as silent wrong data). Also found same session: drawer-added cart items saved `size`/`type` (singular) while sample-cart.html checkout requires `sizes` map + `sampleType` — the drawer add path had NEVER survived checkout; the shared `sample-cart-service.js` now writes both shapes.

### PDP single-method reprice shared the GLOBAL staleness token → SCP preview last-writer-wins race (2026-07-06)
**Problem:** In `product/js/pdp-configurator.js`, `repriceAll()` bumped the stale-result guard token (`state.seq`), but the single-method re-price paths — `setInk`, `setStripes`, `retryMethod` — called `priceMethod('scp', state.seq)` WITHOUT bumping it. Two rapidly-fired SCP previews (customer toggling ink colors / safety stripes) then shared one token, both passed the `token !== state.seq` guard, and the LAST resolver won `state.results.scp` regardless of dispatch order — so a slow earlier request could overwrite the newer config's price. Customer could see a price for the wrong ink/stripe config (flagged by the 2026-07-06 checkout-funnel audit as a deferred chip).
**Root Cause:** A single global `seq` counter conflated independent per-method preview lifecycles. It correctly invalidated ALL in-flight previews on a full reprice, but gave a single-method re-issue no way to supersede its own prior in-flight request. The naive fix (bump the global seq in `setInk`) would have introduced a NEW bug: an in-flight `emb`/`dtg`/`dtf` from a concurrent `repriceAll` would then fail the guard and hang forever in `loading`, because `setInk` only re-issues `scp`.
**Solution:** Made the token PER-METHOD — `state.seq` is now `{ id → counter }`; a `nextSeq(id)` helper bumps+returns one method's token; the 4 guards compare `token !== state.seq[id]`. Every re-issue path (`repriceAll`, `retryMethod`, `setInk`, `setStripes`) passes `nextSeq(id)`, so a single-method re-price invalidates only its own prior in-flight request and can never strand a sibling. Pricing math untouched (`ladder-numeric-parity` 24/24 still pass).
**Prevention:** A per-item async preview needs a per-item staleness token, not one global counter. A global "generation counter" is only safe when EVERY bump is paired with re-issuing EVERY item it invalidates — the moment one call bumps it but re-issues a subset, the un-reissued in-flight items are stranded. Key the guard by the thing being re-fetched.


### EMB duplicate-row targeted the wrong row via `tr.new-row` — transient UI classes are not selectors (2026-07-06, archived 2026-07-10)
**Problem:** While porting the duplicate-row button to SCP/DTF (Rule 8), browser verify showed EMB's own `duplicateRowNewColor()` could populate the WRONG row: a duplicate clicked within ~1s of the source row's creation left the new row empty and re-ran `onStyleChange` on the source instead.
**Root Cause:** It located the just-created row with `document.querySelector('tr.new-row')` — but `.new-row` is a 1-second HIGHLIGHT class on ANY recently added row, so the first document-order match could be the source row, not the one `addNewRow()` just appended.
**Solution:** All 3 builders' `duplicateRowNewColor()` now use `document.getElementById('product-tbody').lastElementChild` (`addNewRow()` appends synchronously, so last row = new row). SCP/DTF gained the button + shared `.btn-duplicate-row` CSS in `quote-builder-common.css`; EMB's inline button styles/enable-mutations were replaced by that class.
**Prevention:** Never select a DOM element by a transient highlight/animation class — target the structural fact you control (last child of the tbody you just appended to, or the id you just minted). A Rule-8 port is also an audit: re-verify the flagship's behavior while porting, not just the new copies.

### DTF combined/range sizes (vests/jackets S/M, L/XL, 2/3X, 4/5X) threw "No price for this method" (2026-06-24, archived 2026-07-11 from LESSONS_LEARNED)
`quote-cart-engine.js dtfSizeUpcharge` only knew standard S–6XL (`sellingPriceDisplayAddOns` + base list) and THREW on anything else; the Quick Quote prices the base size (`S/M`) → threw. Fix: a non-standard size whose OWN garment price == base cost → 0 upcharge (vests price); EXTENDED combined sizes (`2/3X` $13.50 > base) still ERROR — never derive a positive upcharge from the cost delta (under-charges vs the real selling upcharge). Extended-size upcharges → Caspio **`Standard_Size_Upcharges`** (`SizeDesignation`/`StandardAddOnAmount`, GLOBAL, live/no-deploy). Locked by `tests/unit/dtf-combined-size.test.js`. Lesson: size-keyed lookups must tolerate non-standard size NAMES (combined ranges, numeric pant waists `4436`) — derive base 0 from the garment's own prices; ERROR (never silently 0) on unknown extended sizes.

### EMB $12/$9 decoration-cost fallback was INVISIBLE on customer surfaces (PDP "tier 48-71" console error, 2026-07-06, archived 2026-07-12 from LESSONS_LEARNED)
**Problem:** PDP (product.html?style=PC61) reportedly logged repeated `[EmbroideryPricing] No garment embroidery cost for tier 48-71 — using $12.00 fallback`. Not reproducible against today's live API (both `tiersR` and the Shirt cost rows carry `48-71`/$13; full Node re-run of the PDP probe flow priced all 5 tiers correctly) — same incident class as the 3-Day Tees `1-23` bug (a `tiersR` row without a matching cost row → wrong price live), so the data was presumably broken transiently in Caspio and later fixed.
**Root Cause (of the exposure):** `calculateQuote`'s missing-tier-row warning fires only `if (typeof showToast === 'function')` — a staff-page global. Customer surfaces (PDP / Quick Quote / quote cart) define no `showToast`, so the $12 (garment) / $9 (cap) fallback priced SILENTLY there (console.error only) — Rule 4 violation. Aggravator: `getTier()` returns hardcoded labels (`'48-71'`), so relabeling a Caspio tier (e.g. to `48-72`) would put that ENTIRE tier on the fallback even though the bundle "looks populated".
**Solution:** `calculateQuote` now returns `costFallbackUsed`; `quote-cart-engine.js priceEmbGroup` throws `AUTHORITY_ERROR` when it's set — all 3 customer surfaces show their error state instead of a fallback-derived price. Staff builders keep the toast + human-verify path. Locked by `web-quote-cart-parity.test.js` ("missing Caspio Shirt/48-71 cost row → HARD ERROR").
**Prevention:** A "visible warning" gated on a staff-only global is SILENT on customer pages — customer engine paths must ERROR, never warn-and-price. If this console error recurs: check Caspio `Embroidery_Costs` ↔ `Pricing_Tiers` TierLabel alignment first, and remember `getTier()`'s labels are hardcoded.
### A "sealed" staff dashboard had 3 anonymous backdoors AROUND the gate (2026-06-30, archived 2026-07-12; detail → STAFF_DASHBOARD_SEAL_AUDIT_2026-06.md)
**Problem:** After shipping SAML login + the table-driven `/dashboards` gate, a 58-agent adversarial audit + live curl found staff pages still loaded for anonymous outsiders three ways, AND the proxy leaked 495 redeemable gift-cert codes + balances + a table-wipe DELETE.
**Root Cause:** **A path-prefix gate is not a file gate.** `app.use('/dashboards', gate)` only protected that one path-string. (1) `req.path` is NOT percent-decoded but `express.static` IS, so `/dashboards/access-admin%2ehtml` failed the gate's literal `.endsWith('.html')` test → fell through to static, which decoded `%2e`→`.` and served the page (200). (2) The same files were also mounted under sibling `express.static` dirs (`/admin`, `/vendor-portals`, `/tools`) with no gate. (3) ~8 root-level `app.get('/x.html', sendFile)` aliases served the same dashboards with no middleware. Separately, gift-certs/creditcard-atmos were the deferred "Inksoft round" — their only caller is the Python InkSoft Flask app, which sent NO auth to the proxy (it worked only because it hit ungated endpoints).
**Solution:** `gateStaffHtml` decodes+lowercases the path BEFORE the `.html` test (kills `%2e`/`%2E`/case); applied before `/admin`(exempt the public `c112-bogo-promo`)/`/vendor-portals`/`/tools` static mounts; `gateStaffPage` added to the 8 root aliases + decodes its filename. Gift-certs `requireCrmApiSecret` + creditcard-atmos `gateWritesOnly`; Flask now sends `X-CRM-API-Secret` server-side (`_proxy_headers()`), `CRM_API_SECRET` set on `inksoft-transform`. All verified live (anon → 302/401).
**Prevention:** (a) Gate by the **resolved, decoded filename**, never the raw `req.path` suffix. (b) When you gate a path, grep for EVERY other way the same file is served — sibling `express.static` mounts AND root `sendFile` aliases — and gate them too (or redirect to the one gated path). (c) A "page is gated" ≠ "its data is gated": the proxy API behind a gated page is a separate public surface (the side-door). (d) Before gating a proxy endpoint, identify the caller — server-side caller → add the secret header (Pattern A); browser-direct caller → route through a same-origin SAML proxy first (Pattern B) or you 401 a live staff tool. (e) Deploy the caller's secret header BEFORE flipping the proxy gate (no breakage window).

### `app.use('/api', requireCrmApiSecret, router)` 401s EVERY /api route after it — gate PATH-SPECIFIC (2026-06-30, archived 2026-07-16)
**Problem:** A generated plan proposed gating an endpoint by changing `app.use('/api', xRoutes)` → `app.use('/api', requireCrmApiSecret, xRoutes)`. That would have taken down a huge swath of the PUBLIC proxy API.
**Root Cause:** In Express, `app.use('/api', mw, router)` runs `mw` for EVERY request whose path starts `/api` that reaches that layer — not just the ones `router` handles. When `requireCrmApiSecret` 401s (no secret) it ENDS the request, so any public `/api/*` route mounted AFTER that line (pricing, jds, sanmar, tax-rates, designs/by-customer…) never runs → 401. The router argument does NOT scope the middleware to the router's own paths.
**Solution:** Gate with a PATH-SPECIFIC mount matching only the target routes: `app.use('/api/online-store-commissions', requireCrmApiSecret)` BEFORE `app.use('/api', xRoutes)` (the established pattern — `/api/orders`, `/api/gift-certificates`). Multi-path subset → path list `app.use(['/api/vendors','/api/purchase-orders'], requireCrmApiSecret)`; write-only → `gateWritesOnly` on the SPECIFIC path, never bare `/api`.
**Prevention:** Never put auth middleware on a bare `app.use('/api', mw, …)` — it's a chain-wide gate, not a per-router gate. Also verify each route's method+caller first: `gateWritesOnly` on a path with a browser-direct write (e.g. commissions approve/mark-paid) breaks the live tool — gate only the no-caller subset until the browser caller is routed through a secret-bearing proxy.

### Don't headless-flip a PII gate to secret-only until EVERY browser caller is repointed AND browser-verified (2026-07-04, archived 2026-07-16 — superseded by the 3rd-instance entry "PII-gated /api/manageorders reads starved the proxy's OWN crons")
**Problem:** Flipped the proxy `manageorders/orders|lineitems` gate from secret-or-origin to secret-ONLY (proxy v878) after repointing 5 art pages through the SAML-authed `/api/mo/*` forwarder and verifying the authed path returns data. A live browser test on the staff dashboard then showed `dashboard-fetch.js:75 DashboardApiError: 401` — the staff SALES dashboard (via `staff-dashboard/core/dashboard-endpoints.js` → `manageOrders()`), `monogram-form-service.js`, `work-order-picker.js`, and `staff-dashboard-service.js` all call `/api/manageorders/orders|lineitems` DIRECTLY and were never repointed → the flip 401'd them.
**Root Cause:** The caller inventory was built from a `grep` that found ~8 files, but the real caller set was larger AND used varied base-URL patterns (`API_BASE`, `API_CONFIG.baseURL`, `DEFAULT_BASE_URL`, `this.baseURL`, `${BASE}` in an endpoints map) so a single grep pattern missed some. "The authed path works" (verified via `/api/mo/orders?id_Customer=` returning JSON) proves the forwarder is correct — it does NOT prove you found every direct caller that the flip will break.
**Solution:** Reverted the gate to `guardReadsOnly(requireCrmSecretOrBrowserOrigin)` (proxy v880) — anon still 401s (the actual finding stays closed), all browser callers work again. Secret-only is now treated as a supervised effort: repoint EVERY caller through `/api/mo/*`, browser-verify each affected page shows no 401, THEN flip.
**Prevention:** (a) Before flipping any gate to secret-only, enumerate callers with MULTIPLE greps (each base-URL var name) AND load every candidate page in a real authenticated browser watching the Network tab for that path — a headless "authed path returns data" check is necessary but NOT sufficient. (b) Prefer keeping the fallback (secret-or-origin) as the steady state; a secret-only flip is the LAST step, done only after live per-page verification. (c) The origin-spoof residual on internal reads is lower-risk than a broken staff tool — don't trade a working dashboard for it without proof.

### Regex member-access mangle in extraction rewrites (2026-07-09, tranche 2 — archived 2026-07-17)
- **Problem**: SCP reprice threw `undefined.totalQty` — every product dropped, $0 quotes; jsdom suites all green, only the E2E money lane caught it.
- **Root Cause**: split-script rewrote closure vars with `totalQty → ctx.totalQty`; `` also matches AFTER a dot, so `product.totalQty` became `product.ctx.totalQty`.
- **Solution**: exclude member positions — rewrite with `(?<!\.)name` (or restore by hand); fixed 2 sites.
- **Prevention**: line-surgery protocol addition: never regex-rename a bare identifier into `ctx.X` without a negative-lookbehind for `.`; E2E money lanes are the ONLY net for live-DOM loop breaks — run them before calling a money-path split done.
