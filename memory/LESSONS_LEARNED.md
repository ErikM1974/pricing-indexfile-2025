# Lessons Learned

Active reference of recurring bugs, critical patterns, and gotchas. For historical/resolved entries, see [LESSONS_LEARNED_ARCHIVE.md](./LESSONS_LEARNED_ARCHIVE.md).

**Target: <250 lines. If this file exceeds 300 lines, archive older resolved entries before adding new ones.**

---

### Regex member-access mangle in extraction rewrites (2026-07-09, tranche 2)
- **Problem**: SCP reprice threw `undefined.totalQty` — every product dropped, $0 quotes; jsdom suites all green, only the E2E money lane caught it.
- **Root Cause**: split-script rewrote closure vars with `totalQty → ctx.totalQty`; `` also matches AFTER a dot, so `product.totalQty` became `product.ctx.totalQty`.
- **Solution**: exclude member positions — rewrite with `(?<!\.)name` (or restore by hand); fixed 2 sites.
- **Prevention**: line-surgery protocol addition: never regex-rename a bare identifier into `ctx.X` without a negative-lookbehind for `.`; E2E money lanes are the ONLY net for live-DOM loop breaks — run them before calling a money-path split done.

## Security & Auth

### Staff dashboard "sealed" but 3 anonymous backdoors AROUND the gate (2026-06-30, ARCHIVED 2026-07-12): a path-prefix gate is not a file gate — gate by the resolved DECODED filename (`%2e` bypass), grep every sibling static mount + root sendFile alias serving the same file, page-gated ≠ data-gated (the proxy API behind it is its own surface), and repoint every caller with the secret BEFORE flipping a gate. Full entry in archive + [STAFF_DASHBOARD_SEAL_AUDIT_2026-06.md](./STAFF_DASHBOARD_SEAL_AUDIT_2026-06.md).

### `app.use('/api', requireCrmApiSecret, router)` 401s EVERY /api route after it — gate PATH-SPECIFIC (2026-06-30)
**Problem:** A generated plan proposed gating an endpoint by changing `app.use('/api', xRoutes)` → `app.use('/api', requireCrmApiSecret, xRoutes)`. That would have taken down a huge swath of the PUBLIC proxy API.
**Root Cause:** In Express, `app.use('/api', mw, router)` runs `mw` for EVERY request whose path starts `/api` that reaches that layer — not just the ones `router` handles. When `requireCrmApiSecret` 401s (no secret) it ENDS the request, so any public `/api/*` route mounted AFTER that line (pricing, jds, sanmar, tax-rates, designs/by-customer…) never runs → 401. The router argument does NOT scope the middleware to the router's own paths.
**Solution:** Gate with a PATH-SPECIFIC mount matching only the target routes: `app.use('/api/online-store-commissions', requireCrmApiSecret)` BEFORE `app.use('/api', xRoutes)` (the established pattern — `/api/orders`, `/api/gift-certificates`). Multi-path subset → path list `app.use(['/api/vendors','/api/purchase-orders'], requireCrmApiSecret)`; write-only → `gateWritesOnly` on the SPECIFIC path, never bare `/api`.
**Prevention:** Never put auth middleware on a bare `app.use('/api', mw, …)` — it's a chain-wide gate, not a per-router gate. Also verify each route's method+caller first: `gateWritesOnly` on a path with a browser-direct write (e.g. commissions approve/mark-paid) breaks the live tool — gate only the no-caller subset until the browser caller is routed through a secret-bearing proxy.

### Customer Supplied SCP calculator had 100% hardcoded pricing — 4th disconnected price surface (2026-07-01, ARCHIVED 2026-07-06): wired to `priceScpGroup({customerSuppliedGarment:true})` → `generateManualPricingData(0)` — reuse the manual-cost machinery for "no garment cost" pricing, never a parallel formula; verify formulas against the LIVE API, not memory comments. Full entry in archive.

### Same calculator follow-up (2026-07-01, ARCHIVED 2026-07-07): displayed quote ID != saved ID (generateQuoteID called twice — mint ONCE, thread it through) + email failure masked a successful save (track save/notify outcomes separately). Full entry in archive.

### Expert audit of EMB/SCP/DTF builders (2026-07-07): three DEFECT CLASSES, not one-off bugs (55 findings fixed — inventory: QUOTE_BUILDER_EXPERT_AUDIT_2026-07-07.md)

**(a) Computed-but-never-billed.** The DECG service RETURNED the $50 small-batch fee and the design lookup RETURNED the extra-color $/pc — the builder consumed only unitPrice, the UI even ANNOUNCED the fee, and nothing billed it. Same class: SCP back-location priced $0 on a missing Caspio row (`|| 0`), missing size prices silently substituted the M price (the engine REFUSES the same case). **Prevention:** when an API response carries a money field, grep every consumer — a fee the UI mentions but no total includes is a leak; and any `|| 0` on a price component is a bug by definition (pricing-services rule).

**(b) Rule 8 applies to FIXES, not just features.** SCP's Email dead end was the EXACT bug DTF fixed 2026-06-11; SCP's fabricated PDF quote # was EMB's 2026-06-04 fix; only EMB re-saved dirty quotes before emailing (SCP/DTF emailed stale revisions). **Prevention:** when you fix save/print/email/push in ONE builder, grep the other three for the same pattern the same day — the endgame functions are near-copies and drift silently.

**(c) Shipped-but-never-switched-on.** `body.qb-shell-body` — the ENTIRE 2026 PNW re-skin — had zero adopters for a month (trio rendered Segoe-on-gray; only the token aliases took); the guided bar pinned `top:66px` under a header that is not sticky; `--pnw-forest-tint` was referenced but defined nowhere (fallback always won). **Prevention:** an opt-in class/flag is NOT live until something opts in — the ship checklist ends with "grep for adopters"; and every `var(--x, fallback)` fallback must equal the token's real value or it lies wherever the sheet loads alone.


### Caspio Date/Time fields 400 on empty STRING — blank with null (live SCP save outage, 2026-07-07, CONDENSED 2026-07-15): Caspio REST rejects `''` for a Date/Time field (`ReqShipDate`/`DropDeadDate` 400 InvalidInputValue) — a blankable Date/Time is `value || null`, NEVER `|| ''`; when one builder's convention provably works in prod (EMB's `_toISODate()→null`), siblings copy it, not invent a third (Rule 8 applies to PAYLOADS too). Also in MEMORY gotchas.

## Art Hub

### Nightly mockup-recovery cron silently dead after PII gating — a cron is a "caller" too (2026-07-07, CONDENSED 2026-07-15): the app's own cron/one-off-dyno self-HTTP calls are "callers" — grep `scripts/` before flipping any gate; a recovery job must fail LOUD (exit 1 + Slack) when it can't fetch its work list ("nothing to do" ≠ "couldn't look"); Steve-gallery cards key on `Design_Num_SW` not `ID_Design`. Full detail (incl. 4 same-day follow-up fixes) → box-url-rules.md "2026-07-07 audit fixes".

**Garment art form: Caspio DataPage → custom REST form (2026-06-17, detail in [GARMENT_ART_FORM_REBUILD_2026-06.md](./GARMENT_ART_FORM_REBUILD_2026-06.md)) — reroutes notifications + a new column is a 4-surface change.** Replacing a Caspio DataPage with a custom form (`garment-submit-form.js`, like Sticker/Banner/JDS) changes behavior beyond the form: (1) **Notifications reroute** — the DataPage wrote straight to Caspio, *bypassing the proxy*, so it never fired backend Slack; the custom form POSTs `/api/artrequests`, so `notifyArtRequestSubmission`/`notifyRushArtRequest` now DO fire. EmailJS to Steve/AE is unchanged; the old `/api/art-notifications` toast + `sendRushConfirmation` rush-email are intentionally dropped (Erik keep-as-is — do NOT re-add as a "regression"). (2) `Order_Type` is REST-unwriteable (List-String) → write **`Order_Type_Source`** (dashboards coalesce both). (3) A new `ArtRequests` column must be wired in **4 places or it silently vanishes**: Caspio table + form payload + every gallery's PRIMARY `SELECT` (art-ae.js / art-hub-steve-gallery.js / art-hub-steve.js kanban — leave the legacy-fallback SELECT strings alone so they degrade gracefully when a column is missing) + each `buildCard`/detail renderer. (4) Repeating-group data (per-location placement/size) → ONE JSON column (`Artwork_Locations`) rendered as a table, not N columns. (5) Card status-string shorteners must be **dash-insensitive** (the form writes an em-dash; a Caspio hand-edit may use a hyphen) — normalize via `normStatusKey()`.

### AEs got NO email/Slack on art completion — 3 stacked bugs (2026-06-26, ARCHIVED 2026-07-06): notify-a-person = backend chokepoint on the write (never browser EmailJS / a channel they don't watch); fire-and-forget notify `try/catch` swallows `ReferenceError`s — invoke the path in a unit test; art/mockup status routes are **PUT only** (PATCH → 404); name→email maps must tolerate full-name `Sales_Rep` (or prefer `User_Email`). Full entry in archive.

## Quote Builders

### On-screen fee row in `#grand-total` but NOT emitted as a PDF line item → products table under-foots (2026-07-15)
Laser-patch EMB (EMB-2026-313) printed a $360 products table against a $420 Subtotal — the $5/cap "Laser Patch : Patch Upcharge" ($60) was in engine `grandTotal` (`embroidery-quote-pricing.js:1851`) AND the on-screen `#cap-embellishment-fee-row`, but `_appendEmbServiceInvoiceItems` (`builders/emb/output.js`) never read that row into `invoiceProducts`; the printed table is built ONLY from `invoiceProducts` while the printed Subtotal = `grandTotal−setupFees`, so the $60 sat in the total with no line. 3D-puff caps had the same latent gap (shares the fee row). NOT a double-count — the per-cap price EXCLUDES the upcharge (`decorationCost` stays `embCost`, `:658`; the `:775` comment claiming it's added is stale). **Fix:** read `#cap-embellishment-fee-{qty,unit,total,label}` and push a service line, splitting the "CODE : Desc" label; E2E-verified the table foots to $420 = Subtotal, piece count stays 12 (surcharge rows carry $ not pieces, matching AS-CAP).
**Prevention:** 3rd instance of this class (after the AS-Garm/AS-CAP stitch-surcharge fix, 2026-06-04, which patched the SAME function but skipped this row). Any on-screen fee row that feeds `#grand-total` MUST also be emitted in the builder's `_append*ServiceInvoiceItems` or the printed PDF silently under-foots — add it the same day you add the row, and re-diff the printed products TOTAL against the printed Subtotal.

### Reload paths quietly RENAMED or DROPPED extended sizes — XXL→2XL (wrong SKU) + SCP edit-load losing XS/3XL+ (2026-07-09)
**Problem/Root Cause:** EMB reload folded XXL into the parent 2XL input (name lost → push suffixes `_2X`; ~589 ladies styles are `_XXL`-only); SCP `addProductFromQuote` had an EMPTY else for every non-standard size, so edit-load silently dropped XS/XXL/3XL+/talls (only Quick Quote had grown a child-row fix — and even it deleted XXL right after creating it: unprimed parent input → `onSizeChange` removes the 2XL/XXL child at qty 0). **Solution:** one shared pattern in both builders — create the NAMED child FIRST, prime the parent 2XL input, ONE trailing `onSizeChange` (exactly what ShopWorks import does); `'XXL'` removed from EMB's SIZE06 list (2XL/XXL = Size05 column pair, ShopWorks Pattern 3) with recognition kept via explicit concat; rows targeted by minted id, never `.new-row`. Locks: `emb-edit-reload-roundtrip` (true jsdom XXL round-trip), `scp-xxl-reload`, `size-constants-drift` (lists now identical). **Prevention:** reload must route each size through the SAME machinery import uses; an empty else in a size loop is silent money loss; size NAMES are SKU-bearing — never normalize them at restore time.

### SCP draft-restore crashed on the first restored size — the eslint-flagged ghost call (2026-07-09)
**Problem/Root Cause:** `restoreScreenPrintDraft` called `updateRowQuantityTotal()` — defined NOWHERE (monolith-era ghost, carried verbatim in S1a with an eslint-disable marker) — so the first non-zero size THREW: half-restored, unpriced quote, no recalc/toast. Sibling ghost: `deleteRow` tail-called EMB-only `updateCapLogoSectionVisibility()` (console error on every SCP row delete). **Solution:** restore fires `onSizeChange(rowId)` once per row (the exact handler a manual size edit fires — rebuilds qty cell + 2XL child cascade); dead tail call deleted. Locked by `tests/dom/scp-draft-restore.test.js`. **Prevention:** every `eslint-disable no-undef -- pre-existing monolith bug` marker is a LIVE bug with a map — fix on first touch; when one builder grows a ghost call, grep the other 3 for same-name ghosts (Rule 8).

### DTF on-screen tax pipeline was a DUPLICATE of the class's — and drifted 10.1 vs 10.2 (2026-07-09)
**Problem/Root Cause:** `updateTaxCalculation()` (dtf-quote-page.js) re-implemented the whole fee/discount/tax pipeline its JSDoc claimed to "mirror exactly" — the empty-rate fallback drifted (page 10.1 vs class 10.2), so a cleared tax field priced differently on screen vs saved/printed. **Solution:** the page fn now ONLY renders `calculateFromState()→computeFeesAndTotals()` output (Rule 7/9: screen+save+print single-source from state math); capture proved identity (547 fields, 0 mismatch). Locks: `dtf-tax-single-source.test.js` (source ratchet: no math in the page fn) + `dtf-fees-fallback.test.js` (10.2 / explicit / 0-stays-0). **Prevention:** a "mirrors X exactly" comment IS the bug report — delegate, never duplicate. The 10.2 sweep is now FINISHED app-side and `tax-rate-ratchet.test.js` fails CI on any new 10.1/0.101 tax literal (ShopWorks GL identifiers `Tax_10.1`/`2200.101` allowlisted until Erik creates the 10.2 accounts — then flip sites + DELETE the allowlist).

### Color-picker dropdown clipped by the product-table card — position:absolute can't escape an overflow ancestor (2026-07-10)
**Problem:** Erik: color pull-down "hidden beneath the screen" — the EMB (and SCP/DTF) color list showed ~2.5 colors, the rest cut off at the card edge.
**Root Cause:** `.color-picker-dropdown` was `position:absolute` inside `.color-picker-wrapper`; any ancestor with overflow (the product-table card) CLIPS an absolutely-positioned descendant. `z-index:1000` can't fix clipping — stacking order ≠ overflow.
**Solution:** Shared `builders/shared/color-dropdown-position.js`: on open, pin the dropdown `position:fixed` from the trigger's `getBoundingClientRect()` (fixed coords escape ancestor clipping), flip UPWARD when viewport space below < menu height, re-pin on capture-phase scroll/resize (ignoring scrolls inside the list). Wired in all 3 trio `product-rows.js` `toggleColorPicker`s.
**Prevention:** A dropdown rendered inside a scrollable/overflow card must use fixed/portal positioning — raising z-index or max-height only changes how much gets clipped. Module-level `window.addEventListener` in a builders module needs a `typeof window.addEventListener === 'function'` guard (the bundled-module jest harnesses stub a bare `window`).

### EMB duplicate-row targeted the wrong row via `tr.new-row` (2026-07-06, ARCHIVED 2026-07-10): never select a DOM element by a transient highlight/animation class — target the structural fact you control (lastElementChild of the tbody you appended to / the id you minted); a Rule-8 port is also an audit of the flagship. Full entry in archive.

### Include-tax toggle parity (ARCHIVED): a control that changes the on-screen total (include-tax) MUST gate the SAVE/push path too, not just display — assert per-surface parity (screen/PDF/save/push); every output path (save+print+push) needs the same pricing-loaded guard (Rule-8 sibling miss). Full entry in archive.

### DTF print path priced from DOM + broken fallback (2026-06-11, ARCHIVED 2026-06-26): print/save/copy/email must consume the SAME state-math the screen uses — never re-derive money from DOM text or a hand-rolled fallback formula. Full entry in archive.
### DTF child rows JS-state model (2026-06-11, ARCHIVED 2026-06-26): give dynamically-created display rows a state entry at creation ("state first, then paint"); a test where querySelectorAll throws pins "never parses DOM". Full entry in archive.
### Rule-8 sweep — DTF/SCP hardcoded size-list dropped sizes from PDFs (2026-06-11, ARCHIVED 2026-06-26): a static size list iterating rows a dynamic popup creates silently drops sizes; grep all 4 builders for the same construct the same day (Rule 8). Full entry in archive.

### DTF combined/range sizes (S/M, 2/3X…) threw "No price" (2026-06-24, ARCHIVED 2026-07-11): size-keyed lookups must tolerate non-standard size NAMES — own-price==base → 0 upcharge; unknown EXTENDED sizes ERROR (never a derived positive, never silent 0); extended upcharges live in Caspio `Standard_Size_Upcharges`. `dtf-combined-size.test.js`. Full entry in archive.

### EMB $12/$9 decoration-cost fallback was INVISIBLE on customer surfaces (2026-07-06, ARCHIVED 2026-07-12): a "visible warning" gated on a staff-only global (`showToast`) is SILENT on customer pages — customer engine paths must ERROR (`costFallbackUsed` → `AUTHORITY_ERROR`), never warn-and-price; if the "No garment embroidery cost for tier" error recurs, check `Embroidery_Costs` ↔ `Pricing_Tiers` TierLabel alignment (`getTier()` labels are hardcoded). `web-quote-cart-parity.test.js`. Full entry in archive.

### quote-view.js carried a DEAD hardcoded extended-size upcharge map `{2XL:2,3XL:4,4XL:6,5XL:8,6XL:10}` (Rule-9 latent violation, 2026-07-06)
An audit flagged `this.sizeUpcharges` (pages/js/quote-view.js) as feeding customer Unit-Price cells with no visible-warning fallback. **Verification proved it DEAD:** the whole consumer subtree (`renderProductCard`->`renderSizeMatrix`/`calculateProductTotal`->`getUnitPriceForSize`/`getBaseSellingPrice`/`getEstimatedUnitPrice`, + `groupByPrice`/`renderPriceLegend`/`getSizeLabel`/`renderSimpleItemList`) was the OLD product-card renderer -- unreferenced since the compact-table path (`renderItems`->`buildProductRows`->`renderProductRow`) replaced it, and that live path reads ONLY stored `BaseUnitPrice`/`FinalUnitPrice`/`LineTotal` off the saved `quote_items`. Removed the map + all 440 dead lines (`node --check` clean, no test referenced them). **Prevention:** (a) quote-view + `embroidery-quote-invoice.js` are FROZEN-quote DISPLAY surfaces -- render the per-line prices the engine already saved and derive any upcharge as (extended - base); NEVER re-price via API at display time (that is Rule-9's forbidden 4th path, and the product/rate may have changed since save) and NEVER via a front-end constant. Upcharge authority upstream = API `sellingPriceDisplayAddOns` (`quote-cart-engine.js` HARD-ERRORS on a missing extended size, never a `{2XL:2...}` fallback). (b) Before "fixing" a hardcoded-pricing finding, trace the call graph -- an unreachable subtree is dead code to DELETE, not a live surface to re-wire or wrap in a warning.

### DTG unpriceable location combos FF_JB/JF_FB (2026-06-11, ARCHIVED 2026-06-30): any selector whose choices feed a pricing lookup MUST validate its options against the pricing layer's supported list (a combo `A_B` string-join needs an explicit whitelist); every state entry (click/restore/edit/chat) goes through one sanitizer. Full entry in archive.

### Cloned checkout flows carry channel hardcodes in PUSH notes (2026-06-10, ARCHIVED 2026-06-30): forking an order channel — grep the push-payload builder for EVERY literal the old channel assumed (rush banner, turnaround, part #s) + eyeball one real payload per channel; clean URLs also break relative asset paths (use absolute `/pages/...`). Full entry in archive.

### Falsy-zero `||10.1` tax bug recurred in EMB after the DTF/SCP fix (2026-06-10): when you fix a falsy-zero MONEY bug in one builder, grep the other 3 for the same literal (`\|\| 10\.1` / `\|\| 0\.101`) THAT DAY (Rule 8) — EMB was missed because each builder hand-rolls rate parsing. All rate inputs now go through shared `parseRatePercent` (quote-builder-utils.js, 0 valid via finite-check), locked by `parse-rate-percent.test.js`. See the Falsy-Zero rule below.

### PowerShell 5.1 Get-Content/Set-Content round-trip corrupts UTF-8 repo files (2026-06-10, ARCHIVED 2026-07-06): NEVER round-trip repo source through PS 5.1 Get-Content/Set-Content (BOM-less UTF-8 read as ANSI → mojibake file-wide) — use the Edit tool or node; after ANY scripted bulk edit, grep the diff for `â€|Ã|â†`. Full entry in archive.

### Order-form push: restart node to verify + fees need one source (2026-06-09, ARCHIVED 2026-06-30): Node does NOT hot-reload — restart `node server.js` to verify ANY server-side change (a stale process serves old API); a fee folded into a total must ALSO be an itemized line (one source screen+PDF+push read) and an unresolved/$0 fee must BLOCK the push, never drop silently. Full entry in archive.

### Two shipping-path pricing bugs (2026-06-08, ARCHIVED 2026-06-14): recalc must never read its own written-back display as base; if TotalAmount excludes a charge the mirror re-adds, persist the row the mirror reads; saved TaxAmount taxes (base+shipping). Full entry in archive.

### DTG save read the AI chat quote, not the form (2026-06-08, ARCHIVED 2026-06-14): save must serialize the object reflecting the on-screen total (two sources → save the LIVE one); every new tax/toggle flag re-seeds in reset (missing key → `!undefined===true` flips branches). Full entry in archive.

### Shared band module — alias globals + harness load order (2026-06-08, ARCHIVED 2026-06-14): a shared module aliasing globals loads BEFORE its consumer; add new shared deps to jsdom inject() lists IN ORDER; each reset/edit/draft path calls its own renderOrderRecap(). Full entry in archive.

### Duplicate `function NAME()` hoisting no-op'd the push button (SCP + DTF, 2026-06-14, ARCHIVED 2026-07-07): two `function NAME(){}` at one scope — the LAST wins at hoist time, both `window.X=X` bind to it; never alias with the same name; locked by `push-button-binding.test.js`. Full entry in archive.

### Push button stranded disabled (2026-06-07, ARCHIVED 2026-06-11): never replace a button's innerHTML when code reads a child by ID; gate the action button from the SAME function that renders its readiness checklist. Full entry in archive.

### OnSite DROPS the pushed order-level tax field — tax stays manual (2026-06-07): order-level tax fields (`coa_AccountSalesTax01`, `TaxPartNumber`, per-line `sts_EnableTax*`) do NOT survive the MO->OnSite conversion; LINE ITEMS do. Push `TaxTotal:0` + Notes-On-Order/Accounting tax block; rep applies tax from the ShopWorks dropdown. Full detail -> wa-sales-tax-rules.md (EMB section).

### To-100 readiness: adversarial-verify caught money gaps in the FIXES themselves (2026-06-06/07, ARCHIVED 2026-06-25): adversarially verify your OWN fixes; persisted UI state must be set BEFORE the first async consumer on EVERY entry path. Full entry in archive.

### Edit-reload audit — pickup tax overwrite + AL/OSFA mis-bills (2026-06-06, ARCHIVED 2026-06-25): any async call (tax/pricing/inventory) fired DURING a restore races the sync field-restore — gate on `_restoringQuote`; edit-reload is the #1 silent-data-loss surface (jsdom@22 round-trip test). Full entry in archive.

### Shared `pricingData` contract (2026-06-02, ARCHIVED 2026-06-11): all 4 builders wrap invoice input in `QuotePricingData.buildPricingData()` — never post-override after the normalizer; locked by `invoice-totals.test.js`. Full entry in archive.

### Deep review: systemic PDF-total bug + edit-reopen data loss, 4 builders (2026-06-01, ARCHIVED 2026-06-25): the shared invoice generator must tax the SAME on-screen pre-tax number; the 3 output paths (screen/saved/printed) must AGREE for a quote WITH fee+discount; edit-reopen must restore EVERY saved field. Full entry in archive.

### Push→import→sync-back loop (2026-06-01, ARCHIVED 2026-06-11 + 07-09): post-push `getorderno count:0` is EXPECTED ~15-30 min (FileMaker cycle, business hours); verify fresh writes by PK_ID never a cached list; sync-back cron = proxy `sync-quote-sessions-from-shopworks.js` + page-load auto-sync; `ShopWorks_Snapshot` MUST include `pushed` (Designs/Locations — quote-view reads `pushed.Designs[].id_DesignType`); salesperson = `snapshot.order.CustomerServiceRep`. Full entry in archive.

### Cron self-call 302'd to https://localhost by force-HTTPS middleware (2026-06-15, ARCHIVED 2026-07-09): loopback self-calls (`fetch('http://localhost:$PORT/…')`) behind a force-HTTPS redirect die at :443 — exempt loopback at the TOP of that middleware; `req.hostname` drops the port; a cron that only logs aggregate stats hides weeks of no-ops — **alert on errors>0/synced==0**; watchdog = `GET/POST /api/quote-sync-health` + proxy `check-quote-sync-health.js` → Slack. Full entry in archive.

### Quote Mgmt role-delete + tabs + inbound SanMar (2026-06-15, ARCHIVED 2026-07-09): master/owner delete enforced SERVER-side (session-gated DELETE via pricing-index); `StaffAuthHelper` is a bare const NOT on window; fetch rows by PATH param (`?q.where` ignored on that GET); completed = sts_Shipped&&Invoiced&&Paid; inbound column = batched `sanmar-orders/batch-status` (synced data, lags live OSN). Full entry in archive.

### APISource routing (2026-06-02/04, ARCHIVED 2026-06-15): OnSite integration's APISource and EVERY push path must be IDENTICAL (`ManageOrders`); order in MO but `/getorderno` count:0 ⇒ suspect this filter FIRST. Full entry in archive.

### Double size-suffix on push (2026-06-02, ARCHIVED 2026-06-15): push BASE part number + plain size — the integration's Size Translation Table appends modifiers; verify on the PROCESSED SW order. Design types: EMB→2, SCP→1, DTF→8, DTG→45, sticker→4, emblem→5. Full entry in archive.

### ExtDesignID collision (2026-06-02, ARCHIVED 2026-06-11): external dedupe keys (ExtDesignID/ExtOrderID) must be GLOBALLY unique — derive from the FULL QuoteID (date-packed sequences reset daily; SW silently merges). Full entry in archive.

### QuoteID prefix parsing + edit lock (2026-06-01, ARCHIVED 2026-06-11): prefix = LEADING LETTERS (`^[A-Za-z]+`), never `split('-')[0]`; lock edits on `PushedToShopWorks`, not Status. Full entry in archive.

---

## Order Processing & ShopWorks

### Uploaded logo "disappeared" in ShopWorks — OnSite silently drops >2MB design images and chokes on extension-less URLs (2026-07-10)
**Problem:** Erik's EMB test order 142409 pushed with `Designs[].Locations[].ImageURL` set (payload verified), yet the SW Design screen showed metadata but NO image; the uploaded file looked like it vanished. (It never did — uploads live in Caspio Files; the proxy `/api/files/<key>` URL in the payload streamed the 2.12MB PNG fine via curl.)
**Root Cause:** Two documented OnSite ingest limits (MANAGEORDERS_COMPLETE_REFERENCE §13) bit at once: images over ~2MB FAIL SILENTLY (no error anywhere), and our file URLs have no extension, so FileMaker can't derive a filename/type.
**Solution:** Proxy `GET /api/files/:key/sw.jpg` (files-simple.js) serves the stored file as a sharp-transcoded JPEG — EXIF-rotate, white-flatten, ≤1400px, q80 (q70/1000px retry to stay <1.9MB), immutable cache. `lib/sw-image-url.js swImageUrl()` rewrites OUR own-file URLs to that variant in ALL push transformers (emb/scp/dtf + push-client mediaUrl/caspioUrl); external URLs pass through. EMB also fills order-level `Attachments` from every uploaded file (`artworkAttachments`), so artwork shows in the Attachments tab even when the rep picked an existing design # (the Designs[] path skips hostedFiles then). Locked by `tests/jest/sw-image-url.test.js`; verified live on the real 2.12MB file → 219KB JPEG.
**Prevention:** Any image URL sent to OnSite must be <2MB WITH a real file extension — and "pushed but not visible" ≠ "not stored": check the payload URL directly before hunting the upload path. Silent-drop limits like §13 deserve a transcode chokepoint, not per-caller vigilance.

### EMB push-preview "demoted fee" warning silently died when the proxy note format changed (2026-06-10) — ARCHIVED 2026-06-15
Keep-alive: a frontend regex that pattern-matches a backend-generated note string is an UNDOCUMENTED cross-repo contract — when a transformer changes any note/label literal, grep BOTH repos for the old string. The EMB preview's under-billed-fee warning silently stopped firing when the proxy switched `Order notes:` → `UNBILLED FEE/ITEM …`; the matcher now accepts both (`embroidery-quote-builder.js` ~8505).

### EMB/SCP/DTF push parity hardening — dropped notes, blank SCP ship-to, daily-colliding ExtOrderIDs (2026-06-01) — ARCHIVED 2026-06-15
In [LESSONS_LEARNED_ARCHIVE.md](./LESSONS_LEARNED_ARCHIVE.md). Keep-alive: the field name a downstream API reads is part of the contract — MO `/onsite/order-push` reads `Notes` (NOT `NotesOnOrders`); diff a new transformer's output keys against the PROVEN path (`manageorders-push-client.js`). An ExtOrderID must contain the FULL date+seq PLUS a year (daily-reset seq with date stripped collides within 24h) — all 3 builders share `buildExtOrderID()` in `manageorders-emb-config.js`. SCP ship-to reads `ShipTo*` columns. Factor shared artifacts into ONE helper so the working method can't drift.

### ShopWorks ManageOrders integration ignores per-order TaxPartNumber (2026-05-20) — ARCHIVED 2026-06-11
Moved to [LESSONS_LEARNED_ARCHIVE.md](./LESSONS_LEARNED_ARCHIVE.md). Keep-alive: integration-level Tax Line Item/Account defaults stamp every `TaxTotal > 0` order and IGNORE payload tax fields — send `TaxTotal: 0` + Notes-On-Order tax block (current pattern; see the 2026-06-07 "OnSite DROPS the pushed order-level tax field" entry).

### Quote page froze the push-time design name + read ShopWorks status "8" as Shipped (2026-06-16, ARCHIVED 2026-07-10): the hourly sync writes a snapshot BLOB — render name/ship-status LIVE from JSON (`pushed.*` never reflects post-push edits); a `sts_*` is a multi-state code (8/222=N/A, .5=Partial), mirror the OnSite screen via ONE mapper, never collapse to Yes/No. Full entry in archive.

### A ShopWorks size-swap (S→M) with a constant line total didn't repaint the quote-view size table or fire the "edited" banner (2026-06-26, ARCHIVED 2026-07-10): a snapshot field is only as live as the surface that READS it (repaint `.size-col`/`.qty-col` from `snapshot.Size0N`, only when Σcols==ΣLineQuantity); a diff watching only a TOTAL is blind to a same-total redistribution — compare the breakdown. `quote-snapshot-diff.test.js`. Full entry in archive.

---

### A fast-completing SanMar order was NEVER ingested → invisible in all 3 inbound surfaces (2026-06-26, ARCHIVED 2026-07-10): never poll a status-filtered upstream without a catch-up covering TERMINAL states (use TWO feeds: status + invoices); any multi-step SanMar-SOAP-per-item sync MUST be async (202+poll) or it H12s; when "X isn't in 3 places", prove the DATA exists first. Full entry in archive.

### Portal product page fetched up to 25 orders' line items SEQUENTIALLY with no timeout → slow, sometimes never loaded (2026-07-02)
Keep-alive: `buildProductDetail` (server.js ~3588) awaited ManageOrders `/lineitems/:id` in a `for` loop, one order at a time (≤25 serial round-trips), and no call had a timeout — so a single slow/hung MO call blocked the whole `/portal/product/:style` page (Erik: "occasionally they never load"). Fix: `portalFetchJson(url, headers, ms)` (`Promise.race` of the fetch vs a timer → `null` on timeout/non-ok/network-error), fetch all line-items via `Promise.all` (6s each; orders list 8s), + a 120s `_productDetailCache` memo (errors NOT cached — deleted on catch). **Any portal server-side fan-out over a flaky upstream (ManageOrders especially) MUST parallelize AND hard-timeout each call, so one slow upstream degrades to partial data, never a hang** — same MO-is-slow class as the 2026-06-26 async/H12 lesson, on the read/display side. **RECURRED 2026-07-03 (v.25):** the SIBLING `buildMyProducts` (portal "Your Products" grid) still had the SAME sequential-loop pattern PLUS a silent `catch(_){}` → a flaky MO moment silently dropped orders and shrank the catalog to a partial set (Binford: 25 styles rendered as 1). Fixed the same way (parallel + `portalFetchJson` timeout + one retry; orders fetch throws→503 not hang). **PREVENTION: when you fix a sequential-await-in-loop over a flaky upstream, grep EVERY sibling function for the same shape (`for (…) { await fetch(…) }` + `catch {}`) THAT DAY — fixing one copy leaves the others to bite later. A silent `catch(_){}` around a data fetch = a silent partial result (Erik's #1 rule); return timeout-null + retry, don't swallow-and-continue.**

## UI Patterns

### Richardson CSS JS-class drift (2026-05-29) · combobox DOM-regen-on-hover (2026-05-20) — ARCHIVED 2026-06-11/12
In [LESSONS_LEARNED_ARCHIVE.md](./LESSONS_LEARNED_ARCHIVE.md). Keep-alive: when JS builds DOM the CSS contract IS the class string (grep `innerHTML`/`className` both sides before a refactor); never regenerate DOM nodes during hover/mid-click (toggle classes in place); `max-height` transitions don't advance headless — verify via computed `display`.

### Storefront orders stored cart in JSON blobs only — /quote+/invoice showed "No items" + mis-taxed (2026-06-12, ARCHIVED 2026-07-04): any customer-facing quote/invoice surface MUST write `quote_items` + obey the reader contract (`TotalAmount` PRE-tax, separate `TaxAmount`/`TaxRate`, shipping as a SHIP item) — JSON blobs are invisible to the readers. "Order didn't reach ShopWorks" → check Stripe payment_status FIRST. Full entry in archive.

### EMB save↔restore mismatches: dropped sizes, double-counted fees, DECG double-save (2026-06-04, ARCHIVED 2026-06-25): a fee BOTH auto-recomputed AND restored as a row double-counts (restore one copy); run the SAME change handler on a programmatic restore; make multi-collector rows mutually exclusive. Full entry in archive.

---

## Pricing

### Rate-change sweeps must grep the PUSHED tax-directive strings too, not just the rate constant (2026-07-06)
**Problem:** The Milton 10.1→10.2% sweep (3c87ef65) updated display defaults + calculators but missed `sample-order-service.js`, which hardcoded `salesTaxRate = 0.101` AND the ShopWorks directive `Tax_10.1` / "City of Milton Sales Tax 10.1%" — and taxed every paid sample at the Milton rate regardless of ship-to (destination-sourcing violation, WAC 458-20-145).
**Root Cause:** The sweep grep targeted rate constants/labels; the pushed-payload directive fields (`taxPartNumber`/`taxPartDescription`) are a SECOND copy of the same fact and didn't match the pattern.
**Solution:** Service now derives the rate from `POST /api/tax-rates/lookup` on the ship-to address (out-of-state → 0), emits `Tax_<pct>` per the storefront-push convention (server.js buildManageOrdersPayload), and on lookup failure falls back to Milton 10.2% flagged with a "TAX — VERIFY AT INVOICING" order note — never silent. Lock: `tests/unit/sample-order-tax.test.js`.
**Prevention:** On any rate change, grep the OLD rate in all 3 shapes — decimal (`0\.101`), percent (`10\.1`), part number (`Tax_10\.1`) — across shared_components/pages/config. Residual 10.1 hardcodes found this pass (chipped, not yet fixed): dtg-inline-form pickup-flat 0.101/2200.101, embroidery-quote-invoice + screenprint-quote-service defaults, order-form pricing/shared.js, shopworks-guide-generator, dtf-quote-builder.html static label.

### Pricing-baselines gate red — drift was Erik's own Caspio margin lift (2026-06-11, ARCHIVED 2026-07-04): when baselines drift by a uniform rounded half-dollar, suspect a Caspio `MarginDenominator` change (invisible to git) — trace the delta to a named upstream change BEFORE re-locking; never rubber-stamp; a passing scenario does NOT prove the margin didn't move (only a fingerprint like `garmentSellPerPiece` does). Full entry in archive.

### Richardson calculator drifted from the Embroidery Quote Builder — leatherette model, margin, tiers (2026-05-29) — ARCHIVED 2026-06-11
Moved to [LESSONS_LEARNED_ARCHIVE.md](./LESSONS_LEARNED_ARCHIVE.md). Keep-alive: a calculator that duplicates a quote-builder method MUST mirror its formula and pull margin/tiers/upcharges from the SAME Caspio endpoints (rule #7); validate tier-label strings against the live API — `lookup[key] || fallback` hides a key mismatch as a plausible price.

### DTG LTM fee/threshold lived in 4 different files (2026-05-18) — ARCHIVED 2026-06-11
Moved to [LESSONS_LEARNED_ARCHIVE.md](./LESSONS_LEARNED_ARCHIVE.md). Keep-alive: pricing constants with a Caspio column MUST be read from the column (`Pricing_Tiers.LTM_Fee`); when the LTM tier has no `DTG_Costs` rows, the canonical fallback is the lowest non-LTM tier's costs.

### ALWAYS pull pricing from Caspio API — never hardcode (fallback ONLY + visible warning; sales adjusts prices with no deploy). Full rule -> CLAUDE.md "Pricing = API" + MEMORY.md "Quote Builders — Sync Rules".

---

## Dashboard / UI

### Caspio Embed Script Overrides Host Page CSS (2026-05-13) — ARCHIVED 2026-06-11
Moved to [LESSONS_LEARNED_ARCHIVE.md](./LESSONS_LEARNED_ARCHIVE.md). Keep-alive: any page embedding a Caspio DataPage MUST load `caspio-isolation.js` early in `<head>` (Caspio injects its CSS after ours and wins the cascade). Pattern: [CASPIO_CSS_ISOLATION.md](./CASPIO_CSS_ISOLATION.md).

---

## Caspio API Gotchas

### Caspio DELETE answers 200 `{"RecordsAffected": 0}` on a no-match — and the proxy discarded the body, so EVERY quote delete reported `recordsAffected: 0` (2026-07-08)
**Problem:** Proxy `DELETE /api/quote_sessions/:id` returned 200 `recordsAffected: 0` for a row a direct GET confirmed (PK_ID 1727) — looked like delete-by-PK was broken (PK aliasing? numeric-vs-string `q.where`?).
**Root Cause:** Neither — a live create→delete-by-PK→verify round trip proved `q.where=PK_ID=<n>` deletes fine (quoted or unquoted; PK_ID is real and queryable even though Caspio HIDES it from `/tables/{t}/fields` metadata). The real bug: `makeCaspioRequest` returned `{success, status}` for DELETEs, dropping Caspio's `{"RecordsAffected": N}` body, so every handler's `result.RecordsAffected || 0` fabricated 0 — hit or miss. And since Caspio 200s a no-match delete, a miss was indistinguishable from a success even server-side.
**Solution:** Proxy `caspio.js` passes the DELETE body through; pure `deleteResponseFor()` (`src/utils/quote-delete-response.js`) maps 0-affected → 404 for quote_sessions/items/analytics, and a real sessions delete clears the 5-min `quoteSessionsCache` (no ghost reads). Main-app forwarders updated: ownership gate treats proxy-404 as idempotent `{success, alreadyGone}`; items/analytics pass the 404 through. Locks: `tests/jest/quote-delete-response.test.js` (pure) + hardened DELETE round trips in `quote-sessions/items.test.js` (recordsAffected 1, then 404 on repeat).
**Prevention:** (a) On any Caspio write-with-`q.where`, READ `RecordsAffected` — 0 on a by-PK delete means "row didn't exist" → 404, never "deleted successfully". (b) When a count looks wrong, suspect the wrapper util first: a swallowed response body + `result.X || 0` produces a *plausible fabricated* number downstream. (c) Don't trust `/fields` metadata for PK existence — Caspio omits the autonumber PK there.

### Caspio PUT can answer `{"RecordsAffected":1,"Result":[]}` — and `makeCaspioRequest` returns the empty-but-TRUTHY `Result` array, losing the count (2026-07-11)
**Problem:** Forms Inbox item check-in 404'd "Item not found" while the Caspio update actually SUCCEEDED (log: `RecordsAffected:1`).
**Root Cause:** `makeCaspioRequest`'s PUT path returns `response.data.Result || response.data` — when Caspio includes `Result: []` (table/shape-dependent; some tables omit it), `[] || data` yields the empty array (arrays are truthy), so `result.RecordsAffected` is undefined and success is indistinguishable from no-match. Sibling of the 2026-07-08 DELETE-body bug — same wrapper, different verb.
**Solution:** `putWithRecordsAffected(path, where, data)` in proxy `utils/caspio.js` (direct axios, returns the raw body); form-submissions + forms-library PUTs use it.
**Prevention:** Any Caspio PUT whose caller checks `RecordsAffected` MUST use `putWithRecordsAffected`, never `makeCaspioRequest('put', …)`. Pattern-match: `X || data` swallows falsy-shaped AND empty-truthy responses — return raw bodies from wrappers, let callers interpret.

### `/api/inventory` (SanMar product feed) keys on COLOR_NAME, NOT CATALOG_COLOR (2026-06-23): Quick Quote blank-stock came back empty for colors where the two differ (Athletic Maroon = COLOR_NAME "Athletic Maroon" vs CATALOG_COLOR "Ath. Maroon"); same-value colors (Deep Marine) masked it. The product feed matches the DISPLAY name — OPPOSITE the ordering/ShopWorks rule (CATALOG_COLOR). Fix: query by COLOR_NAME, fall back to CATALOG_COLOR (`quick-quote.js loadInventory` = name-first-then-catalog). The "CATALOG_COLOR for inventory" rule is the ORDERING path only.
### Stale Caspio-Compat Shims in Proxy Outlive the Data Fix (~2025-09) — ARCHIVED 2026-06-12
Moved to [LESSONS_LEARNED_ARCHIVE.md](./LESSONS_LEARNED_ARCHIVE.md). Keep-alive: when a proxy injects/backfills missing Caspio data, leave a `// REMOVE WHEN FIXED IN CASPIO` marker and re-audit on any table shape change; verify the response matches the table.

### Caspio v3 Pagination — NEVER `q.limit` with `q.pageNumber` (overlapping/partial-dup pages; returned 1000 of 2794 rows). Always `q.pageSize`; delete `q.limit` before paginating (`caspio.js:fetchAllCaspioPages`). Full rule -> MEMORY.md "Backend".

### Caspio Yes/No fields in `q.where` — use `=1`, never `=true` (2026-07-06): proxy `/api/products/search?isTopSeller=true` had ALWAYS 500'd because it built `IsTopSeller=true` (Caspio 400s it); the same file's `/products/top-sellers` endpoint used `IsTopSeller=1` and worked. The filter shipped in 2025 and was never once exercised until the catalog Top Sellers view — an API param isn't "supported" until something calls it (fixed proxy `src/routes/products.js:506`).

### Caspio multi-select List columns unwritable via REST/Triggered Actions (2026-05-09) — ARCHIVED 2026-06-16
In [LESSONS_LEARNED_ARCHIVE.md](./LESSONS_LEARNED_ARCHIVE.md). Keep-alive: NEVER put a Caspio `List - String` multi-select column in a REST POST/PUT — the whole submission 500s. Workaround = a parallel Text column (`Order_Type_Source`) + read-coalesce (`Order_Type || Order_Type_Source`).

### Proxy quote_sessions lookups cache 5 min — a pre-create existence check POISONS the key your webhook reads (2026-06-09, ARCHIVED 2026-07-06): a flow that READS a key it's ABOUT TO CREATE must bypass read caches (`&refresh=true`) — an existence check is a cache-poisoning write; status-polling reads (webhook idempotency, success pages) must always bypass the 5-min cache; a silently-caught HTTP call that never logs an error may be hitting a route that doesn't exist (`PUT /quote_sessions` routes by `/:id` only). Full entry in archive.

### Caspio pricing tiers without matching cost-table rows silently price at $0 — `?.PrintCost || 0` is a money trap (2026-06-09, ARCHIVED 2026-07-10): a missing price component must throw/error-banner, never `|| 0` (Erik #1 applies to lookup misses); when adding a tier row grep every TierLabel consumer, or reuse the shared service's lowest-non-LTM-tier fallback. `3dt-pricing.test.js`. Full entry in archive.

### `/api/company-contacts/*` 3-bug cascade (2026-05-07) — ARCHIVED 2026-06-11
Moved to [LESSONS_LEARNED_ARCHIVE.md](./LESSONS_LEARNED_ARCHIVE.md). Keep-alive gotchas: `q.sort` is invalid in Caspio v3 (use `q.orderBy`); `q.limit < 5` 400s; cron jobs need content-level asserts, not status codes.

### Caspio v3 paginates UNORDERED queries non-deterministically — every multi-page read needs `q.orderBy` (2026-07-12)
**Problem:** `/all-styles` returned 2,824 vs 2,649 styles on identical back-to-back runs (~5-10% of rows silently skipped, different rows each time) — PC54 itself missing from the sitemap. A proxy-wide sweep of all 417 `fetchAllCaspioPages` call sites found the same latent bug on 36 multi-page-capable queries in 10 routes, incl. money paths (commission new-business bonus read 7,534 ODBC rows across 8 unordered pages; BoA credit-card recon dup-guard; catalog brand/category/search; Supacolor sync — its table crossed 1,000 rows).
**Root Cause:** Without `q.orderBy`, Caspio v3 has no stable row order across `q.pageNumber` requests — page N of run 2 ≠ page N of run 1, so the union skips/duplicates rows. (Related: `q.distinct` is silently IGNORED on tables/records — the original "569 styles" was a distinct scan returning raw rows that hit the 20-page safety cap = styles from the first 8% of the 251k-row table; use `q.groupBy`, whose OUTPUT rows paginate too.) Drift shows while the table is being written (daily SanMar sync); quiet-hours runs can match by luck, so a clean spot-check proves nothing — run twice and diff.
**Solution:** Proxy commit `3ef35ee`: `q.orderBy` on a stable column at all 36 sites — `PK_ID` (most tables), `UNIQUE_KEY` (Sanmar_Bulk raw rows), the grouped column (e.g. `STYLE`) for groupBy. Verified live, two runs each, counts identical (ODBC 18-mo 7,534; thumbnails 12,080; MO_LineItems 6,610; all-brands 4,394 groups; categories 3,846; Supacolor 1,017). Param name is case-insensitive (`q.orderby` works).
**Prevention:** Any `fetchAllCaspioPages` query that CAN exceed one page (>1000 rows, incl. groupBy output) MUST pass `q.orderBy` — rule + canonical example in proxy `CLAUDE.md` + `memory/ENDPOINT_CREATION_GUIDE.md`. Single-page queries skip it (style-scoped Sanmar_Bulk maxes at 741 rows/style). Dead-table routes 404 and were left alone: `Orders`, `Art_Invoices`, `PricingMatrix`, `Inventory`.

---

### Sample program: "no inventory DATA" was read as "0 in stock" — every sample add silently blocked (2026-07-06, ARCHIVED 2026-07-10): an availability/eligibility gate must distinguish "source says 0" from "source has no data" (empty warehouses → noData → fail OPEN with a caveat toast; real zeros still block); blocking on structurally-empty data = a silent feature outage. Full entry in archive.

## JavaScript Patterns

### Falsy-Zero Bug (Use ?? Instead of ||) — `||` treats `0` as falsy (tax `0` -> `0.101` fallback). Use `??` when `0`/`""`/`false` are valid. Full rule -> MEMORY.md "Top Critical Gotchas" + common-gotchas.md.

### Proxy jest suites must NOT import route files / utils/caspio — api-tracker's timer keeps the event loop alive (2026-07-11): requiring `src/routes/*` pulls `utils/caspio` → `api-tracker`, whose interval makes jest hang (or exit 1) after green tests, and the repo config has no `forceExit` (correctly — it would mask real leaks). Pattern: pure logic under test lives in a dependency-free module (`utils/form-submission-helpers.js`) that BOTH the route and the test import; verify with `timeout 6 node -e "require('<module>')"` → must exit 0 on its own.

### `await` in a sync fn (2026-06-03, ARCHIVED 2026-06-12): `node --check <file>` BEFORE browser verify — one syntax error nukes the whole script ("nothing loaded"). In embroidery-quote-builder.js the `syncRushRow()`/`updateTaxCalculation()` block is the SYNC `updatePricingDisplay`, not `recalculatePricing`. Full entry in archive.

### PDP single-method reprice shared the GLOBAL staleness token → SCP preview last-writer-wins race (2026-07-06, ARCHIVED 2026-07-10): a per-item async preview needs a per-item staleness token, not one global counter (a global generation counter is safe only if every bump re-issues EVERY item it invalidates); key the guard by the thing being re-fetched. Full entry in archive.

---

## Data Integrity

### Quote Sequence Race — duplicate IDs (ARCHIVED 2026-06-12): Caspio has no atomic increment — any read-modify-write needs an app-level lock (mutex per prefix). Full entry in archive.

### Art-request notes notification fan-out (2026-05-29, ARCHIVED 2026-06-11, full entry in archive): notifications belong on the backend write chokepoint not the browser; audit/system note POSTs must send `notify:false` or they double-fire.

---

## Tax / Pricing

### Customer SCP calculator priced dark-garment underbase per-piece — builder says setup-screen only (2026-06-11, ARCHIVED 2026-06-23, full entry in archive): SCP underbase/flash = SETUP-SCREEN charges (per printed LOCATION), NEVER per-piece — per-piece lookups always use RAW design colors. When a pricing rule is fixed on one surface, grep ALL sibling surfaces THAT DAY.

### WA DOR tax-rate lookup discarded valid rates on ResultCode 2 (2026-06-03) — ARCHIVED 2026-06-11
Moved to [LESSONS_LEARNED_ARCHIVE.md](./LESSONS_LEARNED_ARCHIVE.md). Keep-alive gotchas: DOR ResultCode 2 still carries a VALID ZIP-level rate (only `Rate=-1` is a true miss); retry ZIP-only before any hardcoded default.

### Routes outlive files — 7 zombie sendFile routes (2026-06-11, ARCHIVED 2026-06-17, full entry in archive): on ANY page delete, grep the filename AND its `app.get`/`sendFile` route in server.js (route TOC) + check `scripts/safety-tools/validate-critical-paths.js` — routes outlive deleted files.

### Sample price rode in a customer-editable URL param into ShopWorks (2026-06-11, ARCHIVED 2026-07-04): anything that becomes MONEY in an order must be RE-DERIVED server/API-side at the trust boundary, NEVER parsed from a URL/storage the customer can edit; copy-pasted "shared" margins drift → point both at the API value. Full entry in archive.

### SCP ungated `?manualCost` override — 5th staff-backdoor copy (2026-06-11, ARCHIVED 2026-06-25): EVERY `*-pricing-service.js` gets the localhost/.herokuapp.com `getManualCostOverride()` gate from day one; lock it across ALL copies with one `test.each` enumeration (`web-quote-cart-parity.test.js`). Full entry in archive.

### Deploy `git add -u` swept a parallel session's work into a cache-bust commit (2026-06-11, ARCHIVED 2026-06-25): before ANY deploy run `git status` — every dirty file must be the release's own cache-bust bumps OR consciously committed first; unknown dirt = STOP (parallel chips share one checkout). Full entry in archive.

### Jest ran every suite 2-4x via stale `.claude/worktrees/` repo copies — and the "failures" wrote a trashed capture file (2026-07-07)
**Problem:** `npm test` reported 52-60 failures across 4-7 suites, all in `pricing-baselines`/`order-form-parity` — but 5 of the failing suites lived under `.claude/worktrees/<agent>/tests/...` (leftover agent worktrees = full repo copies), and the real-repo capture suite had run its Puppeteer capture against ANOTHER session's dev server on :3000, partially failed, and overwrote the checked-in `tests/pricing-baselines/baselines.captured.json`.
**Root Cause:** (a) `jest.config.js testMatch: '**/tests/unit/**'` matches nested repo copies; only `/node_modules/` was ignored. (b) The capture-diff integration tests auto-run a browser capture that ASSUMES :3000 is this repo's server — any process on that port gets captured against, and a partial capture dirties a committed fixture.
**Solution:** `testPathIgnorePatterns: ['/node_modules/', '<rootDir>/.claude/']` (real baseline: 1,494 unit tests green); restored `baselines.captured.json` from git. For pipeline verification, invoked `captureAll({baseUrl: 'http://localhost:3010'})` programmatically against this session's own server.
**Prevention:** Any tool that GLOBS the repo (jest testMatch, future eslint/tsc/coverage in CI task 0.6) must ignore `.claude/` — agent worktrees are full repo copies. Before trusting a red integration suite, check WHICH path failed (worktree copy vs real repo) and whether :3000 is even this session's server (`git status` showing a dirty captured.json is the tell). Stale worktrees under `.claude/worktrees/` should be pruned when their branches are merged/dead.

### `git push heroku main` can exit 0 WITHOUT deploying — verify the release actually landed (2026-07-03)
Keep-alive: an expired Heroku CLI/GCM token makes `git push heroku main` HANG on a Git Credential Manager prompt for `git.heroku.com` (the non-interactive Bash tool can't answer it → 5-min timeout kills the client mid-push); a **retry then reports "Everything up-to-date" and builds NOTHING**. Push exit-code ≠ deployed (fooled us twice in one session — the FE served the stale `?v=` asset while git claimed success). ALWAYS confirm a release truly landed: `curl -s https://sanmar-inventory-app-4cd7b252508d.herokuapp.com/pages/js/<changed-file>.js | grep -c <new-symbol>` must be NON-ZERO (+ `heroku releases -n 3` shows a NEW build). Fix when it prompts: **Erik** runs `heroku login` (browser) to refresh the token, or enters his Heroku **API key** (Account Settings → API Key — NOT the account password) as the git password. Claude never enters the credential.

### Two recurring code patterns from the post-Jun12 review (2026-07-04)
**(a) "Silent-empty on API failure" recurs in every portal loader.** `resp.ok ? resp.json() : {orders:[]}` + an empty `.catch` turns a 503/timeout into a reassuring empty table and a false "$0" balance — Erik's #1 rule violation, worst on the customer portal. **Prevention:** a loader must `throw` on `!resp.ok`, and the catch renders a VISIBLE retry state (never the empty-state copy); snapshot/money chips show "—" until loaded, never "$0" before data lands. Fixed in `customer-portal.js` (orders/invoices/products) + server rewards endpoint now 503s instead of `{balance:0}`.
**(b) One-click Push gated on a PERSISTENT quote id pushes a STALE revision.** SCP/DTF Push did `await saveAndGetLink()` (which swallows its own errors) then `if(!_pushQuoteId) return;` — but `_pushQuoteId` is already set from the edit-load, so a FAILED re-save still pushed the pre-edit numbers to ShopWorks. **Prevention:** `saveAndGetLink` must RETURN the freshly-saved id (falsy on failure); gate the push on THIS call's return value, never a module-level id that survives across saves.
**(c) DTF `baseUnit` is LTM-INCLUSIVE — ladder math must use `groupTotal`, not `baseUnit`.** Quick-Quote/Line-Sheet computed per-tier price from `lines[0].baseUnit` + a separate "+$50" row → DTF double-counted its baked-in small-batch fee (~$50 over). The mode-agnostic formula (already in `pdp-configurator.js`) is `(groupTotal − oneTimeFees − ltmFlat) / qty`; it's correct whether baseUnit is LTM-stripped (EMB/SCP/DTG) or baked (DTF). Never derive a displayed ladder from `baseUnit`.

### Don't headless-flip a PII gate to secret-only until EVERY browser caller is repointed AND browser-verified (2026-07-04)
**Problem:** Flipped the proxy `manageorders/orders|lineitems` gate from secret-or-origin to secret-ONLY (proxy v878) after repointing 5 art pages through the SAML-authed `/api/mo/*` forwarder and verifying the authed path returns data. A live browser test on the staff dashboard then showed `dashboard-fetch.js:75 DashboardApiError: 401` — the staff SALES dashboard (via `staff-dashboard/core/dashboard-endpoints.js` → `manageOrders()`), `monogram-form-service.js`, `work-order-picker.js`, and `staff-dashboard-service.js` all call `/api/manageorders/orders|lineitems` DIRECTLY and were never repointed → the flip 401'd them.
**Root Cause:** The caller inventory was built from a `grep` that found ~8 files, but the real caller set was larger AND used varied base-URL patterns (`API_BASE`, `API_CONFIG.baseURL`, `DEFAULT_BASE_URL`, `this.baseURL`, `${BASE}` in an endpoints map) so a single grep pattern missed some. "The authed path works" (verified via `/api/mo/orders?id_Customer=` returning JSON) proves the forwarder is correct — it does NOT prove you found every direct caller that the flip will break.
**Solution:** Reverted the gate to `guardReadsOnly(requireCrmSecretOrBrowserOrigin)` (proxy v880) — anon still 401s (the actual finding stays closed), all browser callers work again. Secret-only is now treated as a supervised effort: repoint EVERY caller through `/api/mo/*`, browser-verify each affected page shows no 401, THEN flip.
**Prevention:** (a) Before flipping any gate to secret-only, enumerate callers with MULTIPLE greps (each base-URL var name) AND load every candidate page in a real authenticated browser watching the Network tab for that path — a headless "authed path returns data" check is necessary but NOT sufficient. (b) Prefer keeping the fallback (secret-or-origin) as the steady state; a secret-only flip is the LAST step, done only after live per-page verification. (c) The origin-spoof residual on internal reads is lower-risk than a broken staff tool — don't trade a working dashboard for it without proof.

### Checkout-funnel audit (2026-07-06): a deleted `const` silently disabled a feature, and a perl bulk-edit stripped a template literal
Multi-agent adversarial audit of the customer checkout funnel found two live-in-prod regressions worth remembering:
**(a) An undeclared variable throws and aborts init() AFTER the visible render — so the page "works" but a later feature is dead.** `quote-view.js` referenced bare `urlParams` at two spots; commit a6ae37d1 (closing the `?staff=true` hole) had deleted its `const urlParams = ...` declaration. Because the ReferenceError fires at the `this.setupDepositUI(urlParams)` call — AFTER loadQuote/setupEventListeners — customers could still view+accept quotes, so it looked fine, but the deposit **PAY panel never rendered** on any real quote load for ~2 days. **Prevention:** when you delete a variable declaration, grep the whole file for every use before committing; and a feature that "worked in tests" via direct-method eval is NOT verified until it runs through the real `init()`/page-load path in a browser (console must be error-free).
**(b) A `perl -i` bulk find/replace inside a `bash -c "..."` double-quoted command can eat `${...}`.** Fixing `10.1%`→`10.2%` across files, one replacement collapsed `` `WA Sales Tax (${ratePercent}%)` `` to `` `WA Sales Tax (%)` `` because the `$` interpolation got mangled through the shell+perl quoting layers. **Prevention:** for replacements touching JS template literals, use single-quoted perl programs (`perl -i -pe '...'`) not double-quoted, and after ANY bulk rate/price edit, `grep` the changed lines to eyeball the result — a broken interpolation renders an empty `()` to the customer.
**Also confirmed + hardened (same audit):** deposit-checkout could leave multiple payable Stripe sessions (→ expire prior session + `expires_at`; webhook now per-KIND duplicate guard w/ refund-needed alert, not just per-session); Notes read-modify-write races could clobber `payments[]` (→ re-fetch+merge before every money-path PUT); accept endpoint used bare `JSON.parse` that destroyed plain-text EMB Notes (→ `parseNotesJson`). Deferred (spawned as chips): ~~SCP preview reprice race~~ (FIXED 2026-07-06 — per-method staleness token, see JavaScript Patterns), quote-view extended-size upcharge hardcode, cart mailto subtotal + multi-size updateQty, EMB $12 tier fallback surfacing.
