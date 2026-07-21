# Lessons Learned

Active reference of recurring bugs, critical patterns, and gotchas. For historical/resolved entries, see [LESSONS_LEARNED_ARCHIVE.md](./LESSONS_LEARNED_ARCHIVE.md).

**Target: <250 lines. If this file exceeds 300 lines, archive older resolved entries before adding new ones.**

---

### Caspio quota blown by uncached per-style endpoints + a dead-table probe (2026-07-18)
- **Problem**: 507K/500K Integrations at day 22. Recurring baseline (~18K/day ≈ 545K/mo) exceeded the cap by itself — only ~100K was July's one-off backfills.
- **Root Cause**: (a) every PDP view cost ~13 Caspio calls — the 8 per-style siblings of pricing-bundle (size-pricing, max-prices, inventory, colors, swatches, details…) had zero server cache while the data changes only nightly; (b) `/api/sizes-by-style-color` probed the dead `/tables/Inventory` (404 since 2026-06-18) on EVERY call; (c) `Standard_Size_Upcharges`/`Size_Display_Order` re-fetched in full per request; (d) dashboard pollers ran 24/7 in hidden tabs (~2,880 calls/day/tab); (e) hourly quote bulk-sync re-synced every 30-day quote every hour — and re-syncing cancelled quotes re-stamped `ShopWorks_Last_Synced`, resetting their 30-day purge countdown daily.
- **Solution**: proxy v2026.07.18.1 shared `ttl-cache.js` (never serves expired — Rule 4; degraded payloads never cached) + 1h static-table cache + probe removal + `GET /api/product-cache/clear`; pollers pause on `visibilitychange`; bulk-sync excludes cancelled + age-backoff on `CreatedAt_Quote` (NOT Last_Synced — every sync branch re-stamps it, so it can never age; and `Imported` is NOT terminal — hourly re-sync of Imported is what detects SW deletions → ShipStation cancel-cascade).
- **Prevention**: new hot read endpoint → cache it at birth (copy ttl-cache pattern; key = ALL response-shaping params incl. `includeDiscontinued`); never leave a known-dead upstream probe "for when it comes back" — one 404 × every request is real quota; every `setInterval` fetch ships with the visibility-pause guard; verify quota impact in `GET /api/admin/metrics` `callsByTable`, not vibes; `sanitize(x) || x` = no sanitization at all — fail closed.
### Box shared-static `<img>` links 301 = dead (2026-07-17, ARCHIVED 2026-07-19): never use `box.com/shared/static` as an img src — Caspio CDN logo or proxy-served asset; `onerror → hide` is a silent failure. Full entry in archive.

## Security & Auth

### Staff dashboard "sealed" but 3 anonymous backdoors AROUND the gate (2026-06-30, ARCHIVED 2026-07-12): a path-prefix gate is not a file gate — gate by the resolved DECODED filename (`%2e` bypass), grep every sibling static mount + root sendFile alias serving the same file, page-gated ≠ data-gated (the proxy API behind it is its own surface), and repoint every caller with the secret BEFORE flipping a gate. Full entry in archive + [STAFF_DASHBOARD_SEAL_AUDIT_2026-06.md](./STAFF_DASHBOARD_SEAL_AUDIT_2026-06.md).

### `app.use('/api', requireCrmApiSecret, router)` 401s EVERY /api route after it (2026-06-30, ARCHIVED 2026-07-16): the router arg does NOT scope the middleware — gate PATH-SPECIFIC mounts (`app.use('/api/x', gate)` or a path list) before the bare `/api` mount, never bare `/api`. Full entry in archive.

### The INVERSE miss: a prefix gate covers ONE mount, not the router — `/api/order-odbc` + `/api/order-dashboard` + `/api/customers` stayed anonymous 3 weeks after the `/api/orders` "full-gate" (2026-07-18, proxy v951)
The 6/29 flip `app.use('/api/orders', requireCrmApiSecret)` matched only that path segment, but `src/routes/orders.js` (mounted at bare `/api`) ALSO registers `/order-odbc` (ORDER_ODBC customer contact + invoice financials, raw `q.where` passthrough), `/order-dashboard`, and `/customers` (anonymous Customer_Info enumeration + anon POST/PUT/DELETE) — all still public. Fix: gate each sibling mount; bare create `POST /api/customers` stays public-hardened (BOGO promo browser form — PROXY_SIDE_DOOR_AUDIT decision #6 still open). Caller sweep (both repos + Python Inksoft + proxy `scripts/`) found ONE live caller — FE portal `buildProductDetail` — already sending the secret, so zero repoints.
**Prevention:** gating a multi-route router at a mount prefix requires enumerating EVERY `router.<verb>('/path')` in the file and gating each distinct first segment — the mount prefix is all a gate sees (pair this with the over-gate lesson above). And "the router is gated" claims must be proven by curling each ROUTE, not the mount.

### Customer Supplied SCP calculator had 100% hardcoded pricing — 4th disconnected price surface (2026-07-01, ARCHIVED 2026-07-06): wired to `priceScpGroup({customerSuppliedGarment:true})` → `generateManualPricingData(0)` — reuse the manual-cost machinery for "no garment cost" pricing, never a parallel formula; verify formulas against the LIVE API, not memory comments. Full entry in archive.

### Same calculator follow-up (2026-07-01, ARCHIVED 2026-07-07): displayed quote ID != saved ID (generateQuoteID called twice — mint ONCE, thread it through) + email failure masked a successful save (track save/notify outcomes separately). Full entry in archive.

### Expert audit of EMB/SCP/DTF builders — three DEFECT CLASSES (2026-07-07, ARCHIVED 2026-07-19): (a) computed-but-never-billed — an API money field with no consumer / any `|| 0` on a price component is a leak; (b) Rule 8 applies to FIXES — when you fix save/print/email/push in one builder, grep the other 3 the same day; (c) shipped-but-never-switched-on — an opt-in class/flag is NOT live until something opts in ("grep for adopters"), and every `var(--x, fallback)` fallback must equal the token's real value. 55 findings — inventory: QUOTE_BUILDER_EXPERT_AUDIT_2026-07-07.md; full entry in archive.


### Caspio Date/Time fields 400 on empty STRING — blank with null (live SCP save outage, 2026-07-07, CONDENSED 2026-07-15): Caspio REST rejects `''` for a Date/Time field (`ReqShipDate`/`DropDeadDate` 400 InvalidInputValue) — a blankable Date/Time is `value || null`, NEVER `|| ''`; when one builder's convention provably works in prod (EMB's `_toISODate()→null`), siblings copy it, not invent a third (Rule 8 applies to PAYLOADS too). Also in MEMORY gotchas.

## Art Hub

### Nightly mockup-recovery cron silently dead after PII gating — a cron is a "caller" too (2026-07-07, CONDENSED 2026-07-15): the app's own cron/one-off-dyno self-HTTP calls are "callers" — grep `scripts/` before flipping any gate; a recovery job must fail LOUD (exit 1 + Slack) when it can't fetch its work list ("nothing to do" ≠ "couldn't look"); Steve-gallery cards key on `Design_Num_SW` not `ID_Design`. Full detail (incl. 4 same-day follow-up fixes) → box-url-rules.md "2026-07-07 audit fixes".

**Garment art form: Caspio DataPage → custom REST form (2026-06-17, detail in [GARMENT_ART_FORM_REBUILD_2026-06.md](./GARMENT_ART_FORM_REBUILD_2026-06.md)) — reroutes notifications + a new column is a 4-surface change.** Replacing a Caspio DataPage with a custom form (`garment-submit-form.js`, like Sticker/Banner/JDS) changes behavior beyond the form: (1) **Notifications reroute** — the DataPage wrote straight to Caspio, *bypassing the proxy*, so it never fired backend Slack; the custom form POSTs `/api/artrequests`, so `notifyArtRequestSubmission`/`notifyRushArtRequest` now DO fire. EmailJS to Steve/AE is unchanged; the old `/api/art-notifications` toast + `sendRushConfirmation` rush-email are intentionally dropped (Erik keep-as-is — do NOT re-add as a "regression"). (2) `Order_Type` is REST-unwriteable (List-String) → write **`Order_Type_Source`** (dashboards coalesce both). (3) A new `ArtRequests` column must be wired in **4 places or it silently vanishes**: Caspio table + form payload + every gallery's PRIMARY `SELECT` (art-ae.js / art-hub-steve-gallery.js / art-hub-steve.js kanban — leave the legacy-fallback SELECT strings alone so they degrade gracefully when a column is missing) + each `buildCard`/detail renderer. (4) Repeating-group data (per-location placement/size) → ONE JSON column (`Artwork_Locations`) rendered as a table, not N columns. (5) Card status-string shorteners must be **dash-insensitive** (the form writes an em-dash; a Caspio hand-edit may use a hyphen) — normalize via `normStatusKey()`.

### AEs got NO email/Slack on art completion — 3 stacked bugs (2026-06-26, ARCHIVED 2026-07-06): notify-a-person = backend chokepoint on the write (never browser EmailJS / a channel they don't watch); fire-and-forget notify `try/catch` swallows `ReferenceError`s — invoke the path in a unit test; art/mockup status routes are **PUT only** (PATCH → 404); name→email maps must tolerate full-name `Sales_Rep` (or prefer `User_Email`). Full entry in archive.

## Quote Builders

### On-screen fee row in `#grand-total` but NOT emitted as a PDF line item → products table under-foots (2026-07-15)
Laser-patch EMB (EMB-2026-313) printed a $360 products table against a $420 Subtotal — the $5/cap "Laser Patch : Patch Upcharge" ($60) was in engine `grandTotal` (`embroidery-quote-pricing.js:1851`) AND the on-screen `#cap-embellishment-fee-row`, but `_appendEmbServiceInvoiceItems` (`builders/emb/output.js`) never read that row into `invoiceProducts`; the printed table is built ONLY from `invoiceProducts` while the printed Subtotal = `grandTotal−setupFees`, so the $60 sat in the total with no line. 3D-puff caps had the same latent gap (shares the fee row). NOT a double-count — the per-cap price EXCLUDES the upcharge (`decorationCost` stays `embCost`, `:658`; the `:775` comment claiming it's added is stale). **Fix:** read `#cap-embellishment-fee-{qty,unit,total,label}` and push a service line, splitting the "CODE : Desc" label; E2E-verified the table foots to $420 = Subtotal, piece count stays 12 (surcharge rows carry $ not pieces, matching AS-CAP).
**Prevention:** 3rd instance of this class (after the AS-Garm/AS-CAP stitch-surcharge fix, 2026-06-04, which patched the SAME function but skipped this row). Any on-screen fee row that feeds `#grand-total` MUST also be emitted in the builder's `_append*ServiceInvoiceItems` or the printed PDF silently under-foots — add it the same day you add the row, and re-diff the printed products TOTAL against the printed Subtotal.

### Reload paths RENAMED/DROPPED extended sizes — XXL→2XL wrong SKU + SCP edit-load losing XS/3XL+ (2026-07-09, ARCHIVED 2026-07-21): reload must route each size through the SAME machinery import uses (create NAMED child first, prime parent 2XL input, ONE trailing `onSizeChange`); an empty else in a size loop is silent money loss; size NAMES are SKU-bearing — never normalize at restore. Full entry in archive.

### SCP draft-restore threw on an eslint-flagged ghost call `updateRowQuantityTotal` (defined nowhere) (2026-07-09, ARCHIVED 2026-07-21): every `eslint-disable no-undef -- pre-existing monolith bug` marker is a LIVE bug — fix on first touch; restore fires `onSizeChange(rowId)` per row (the real handler); grep the other 3 builders for same-name ghosts (Rule 8). Full entry in archive.

### DTF on-screen tax pipeline DUPLICATED the class math + drifted 10.1 vs 10.2 (2026-07-09, ARCHIVED 2026-07-21): a 'mirrors X exactly' comment IS the bug report — delegate to `calculateFromState()→computeFeesAndTotals()`, never duplicate (screen+save+print single-source, Rule 7/9); `tax-rate-ratchet.test.js` fails CI on any new 10.1 literal (ShopWorks GL `Tax_10.1`/`2200.101` allowlisted until Erik makes the 10.2 accounts). Full entry in archive.

### Color-picker dropdown clipped by an overflow ancestor (2026-07-10, ARCHIVED 2026-07-21): a dropdown inside a scrollable/overflow card must use fixed/portal positioning (pin from `getBoundingClientRect()`, flip up when space below is short) — raising z-index or max-height only changes how much gets clipped; shared `builders/shared/color-dropdown-position.js`. Full entry in archive.

### EMB duplicate-row targeted the wrong row via `tr.new-row` (2026-07-06, ARCHIVED 2026-07-10): never select a DOM element by a transient highlight/animation class — target the structural fact you control (lastElementChild of the tbody you appended to / the id you minted); a Rule-8 port is also an audit of the flagship. Full entry in archive.

### Include-tax toggle parity (ARCHIVED): a control that changes the on-screen total (include-tax) MUST gate the SAVE/push path too, not just display — assert per-surface parity (screen/PDF/save/push); every output path (save+print+push) needs the same pricing-loaded guard (Rule-8 sibling miss). Full entry in archive.

### DTF print path priced from DOM + broken fallback (2026-06-11, ARCHIVED 2026-06-26): print/save/copy/email must consume the SAME state-math the screen uses — never re-derive money from DOM text or a hand-rolled fallback formula. Full entry in archive.
### DTF child rows JS-state model (2026-06-11, ARCHIVED 2026-06-26): give dynamically-created display rows a state entry at creation ("state first, then paint"); a test where querySelectorAll throws pins "never parses DOM". Full entry in archive.
### Rule-8 sweep — DTF/SCP hardcoded size-list dropped sizes from PDFs (2026-06-11, ARCHIVED 2026-06-26): a static size list iterating rows a dynamic popup creates silently drops sizes; grep all 4 builders for the same construct the same day (Rule 8). Full entry in archive.

### DTF combined/range sizes (S/M, 2/3X…) threw "No price" (2026-06-24, ARCHIVED 2026-07-11): size-keyed lookups must tolerate non-standard size NAMES — own-price==base → 0 upcharge; unknown EXTENDED sizes ERROR (never a derived positive, never silent 0); extended upcharges live in Caspio `Standard_Size_Upcharges`. `dtf-combined-size.test.js`. Full entry in archive.

### EMB $12/$9 decoration-cost fallback was INVISIBLE on customer surfaces (2026-07-06, ARCHIVED 2026-07-12): a "visible warning" gated on a staff-only global (`showToast`) is SILENT on customer pages — customer engine paths must ERROR (`costFallbackUsed` → `AUTHORITY_ERROR`), never warn-and-price; if the "No garment embroidery cost for tier" error recurs, check `Embroidery_Costs` ↔ `Pricing_Tiers` TierLabel alignment (`getTier()` labels are hardcoded). `web-quote-cart-parity.test.js`. Full entry in archive.

### quote-view.js DEAD hardcoded upcharge map (2026-07-06, ARCHIVED 2026-07-19): quote-view + `embroidery-quote-invoice.js` are FROZEN-quote DISPLAY surfaces — render saved per-line prices, derive upcharge as (extended − base), NEVER re-price via API or front-end constant at display time (Rule-9 forbidden 4th path); before "fixing" a hardcoded-pricing finding, trace the call graph — an unreachable subtree is dead code to DELETE, not a surface to re-wire. Full entry in archive.

### Falsy-zero `||10.1` tax bug recurred in EMB after the DTF/SCP fix (2026-06-10): when you fix a falsy-zero MONEY bug in one builder, grep the other 3 for the same literal (`\|\| 10\.1` / `\|\| 0\.101`) THAT DAY (Rule 8) — EMB was missed because each builder hand-rolls rate parsing. All rate inputs now go through shared `parseRatePercent` (quote-builder-utils.js, 0 valid via finite-check), locked by `parse-rate-percent.test.js`. See the Falsy-Zero rule below.

### PowerShell 5.1 Get-Content/Set-Content round-trip corrupts UTF-8 repo files (2026-06-10, ARCHIVED 2026-07-06): NEVER round-trip repo source through PS 5.1 Get-Content/Set-Content (BOM-less UTF-8 read as ANSI → mojibake file-wide) — use the Edit tool or node; after ANY scripted bulk edit, grep the diff for `â€|Ã|â†`. Full entry in archive.

### Order-form push: restart node to verify + fees need one source (2026-06-09, ARCHIVED 2026-06-30): Node does NOT hot-reload — restart `node server.js` to verify ANY server-side change (a stale process serves old API); a fee folded into a total must ALSO be an itemized line (one source screen+PDF+push read) and an unresolved/$0 fee must BLOCK the push, never drop silently. Full entry in archive.

### Duplicate `function NAME()` hoisting no-op'd the push button (SCP + DTF, 2026-06-14, ARCHIVED 2026-07-07): two `function NAME(){}` at one scope — the LAST wins at hoist time, both `window.X=X` bind to it; never alias with the same name; locked by `push-button-binding.test.js`. Full entry in archive.

### Push button stranded disabled (2026-06-07, ARCHIVED 2026-06-11): never replace a button's innerHTML when code reads a child by ID; gate the action button from the SAME function that renders its readiness checklist. Full entry in archive.

### OnSite DROPS the pushed order-level tax field — tax stays manual (2026-06-07): order-level tax fields (`coa_AccountSalesTax01`, `TaxPartNumber`, per-line `sts_EnableTax*`) do NOT survive the MO->OnSite conversion; LINE ITEMS do. Push `TaxTotal:0` + Notes-On-Order/Accounting tax block; rep applies tax from the ShopWorks dropdown. Full detail -> wa-sales-tax-rules.md (EMB section).

### To-100 readiness: adversarial-verify caught money gaps in the FIXES themselves (2026-06-06/07, ARCHIVED 2026-06-25): adversarially verify your OWN fixes; persisted UI state must be set BEFORE the first async consumer on EVERY entry path. Full entry in archive.

### Edit-reload audit — pickup tax overwrite + AL/OSFA mis-bills (2026-06-06, ARCHIVED 2026-06-25): any async call (tax/pricing/inventory) fired DURING a restore races the sync field-restore — gate on `_restoringQuote`; edit-reload is the #1 silent-data-loss surface (jsdom@22 round-trip test). Full entry in archive.

### Deep review: systemic PDF-total bug + edit-reopen data loss, 4 builders (2026-06-01, ARCHIVED 2026-06-25): the shared invoice generator must tax the SAME on-screen pre-tax number; the 3 output paths (screen/saved/printed) must AGREE for a quote WITH fee+discount; edit-reopen must restore EVERY saved field. Full entry in archive.

### Push→import→sync-back loop (2026-06-01, ARCHIVED 2026-06-11 + 07-09): post-push `getorderno count:0` is EXPECTED ~15-30 min (FileMaker cycle, business hours); verify fresh writes by PK_ID never a cached list; sync-back cron = proxy `sync-quote-sessions-from-shopworks.js` + page-load auto-sync; `ShopWorks_Snapshot` MUST include `pushed` (Designs/Locations — quote-view reads `pushed.Designs[].id_DesignType`); salesperson = `snapshot.order.CustomerServiceRep`. Full entry in archive.

### Cron self-call 302'd to https://localhost by force-HTTPS middleware (2026-06-15, ARCHIVED 2026-07-09): loopback self-calls (`fetch('http://localhost:$PORT/…')`) behind a force-HTTPS redirect die at :443 — exempt loopback at the TOP of that middleware; `req.hostname` drops the port; a cron that only logs aggregate stats hides weeks of no-ops — **alert on errors>0/synced==0**; watchdog = `GET/POST /api/quote-sync-health` + proxy `check-quote-sync-health.js` → Slack. Full entry in archive.

### Quote Mgmt role-delete + tabs + inbound SanMar (2026-06-15, ARCHIVED 2026-07-09): master/owner delete enforced SERVER-side (session-gated DELETE via pricing-index); `StaffAuthHelper` is a bare const NOT on window; fetch rows by PATH param (`?q.where` ignored on that GET); completed = sts_Shipped&&Invoiced&&Paid; inbound column = batched `sanmar-orders/batch-status` (synced data, lags live OSN). Full entry in archive.

### APISource routing (2026-06-02/04, ARCHIVED 2026-06-15): OnSite integration's APISource and EVERY push path must be IDENTICAL (`ManageOrders`); order in MO but `/getorderno` count:0 ⇒ suspect this filter FIRST. Full entry in archive.

### Double size-suffix on push (2026-06-02, ARCHIVED 2026-06-15): push BASE part number + plain size — the integration's Size Translation Table appends modifiers; verify on the PROCESSED SW order. Design types: EMB→2, SCP→1, DTF→8, DTG→45, sticker→4, emblem→5. Full entry in archive.

---

## Order Processing & ShopWorks

### ManageOrders_Orders mirror silently FROZEN 12 days — the v878 PII gate starved the proxy's OWN nightly sync (2026-07-16, ARCHIVED 2026-07-21): 3rd PII-gate-flip instance — when a gate flips, sweep `scripts/` for `${BASE_URL}/api/...` self-calls missing `x-crm-api-secret` AND re-sweep gates flipped in the PAST; a mirror-fed 'Other'/unmatched fallback masks a dead upstream, so every mirror-sync cron needs a freshness watchdog (alert when MAX(Last_Sync) ages past ~26h). Full entry in archive.

### OnSite silently drops >2MB design images + chokes on extension-less URLs (2026-07-10, ARCHIVED 2026-07-21): any image URL sent to OnSite must be <2MB WITH a real extension — proxy `GET /api/files/:key/sw.jpg` (sharp-transcode ≤1400px q80) via `lib/sw-image-url.js swImageUrl()` in all push transformers; 'pushed but not visible' ≠ 'not stored' (curl the payload URL directly before hunting the upload path). Full entry in archive.

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

### Portal server-side fan-out over a flaky upstream (2026-07-02/03, CONDENSED 2026-07-19): any portal fan-out over ManageOrders MUST parallelize (`Promise.all`) AND hard-timeout each call (`portalFetchJson` = `Promise.race` fetch-vs-timer → null), so one slow upstream degrades to partial data, never a hang; a silent `catch(_){}` around a data fetch = a silent partial result — when you fix a sequential-`await`-in-loop, grep every sibling (`buildProductDetail`/`buildMyProducts`) for the same shape THAT DAY. Errors NOT cached (deleted on catch).

## UI Patterns

### Leads Board/List toggle looked dead — author CSS `display` always beats the UA `[hidden]` rule (2026-07-19)
**Problem/Root Cause:** Clicking List highlighted the button (aria-pressed synced) but the kanban stayed on screen: `.ld-board { display: grid }` overrides the browser's built-in `[hidden] { display: none }` (author origin wins the cascade regardless of specificity), so `board.hidden = true` in `renderView()` did nothing. 4th+ recurrence of this class — dtg-catalog.css:631, sticker-pricing-page.css:1312, dtg-quote-page.css:579, form-submissions.css:209 all carry the same fix-comment; leads.css just never got the guard. **Solution:** file-wide `[hidden] { display: none !important; }` at the top of leads.css (same as finished-photos.css:283 / nwca-2026-core.css:91) + `?v=` bump. Verified: toggle flips `display` grid⇄none both directions, buttons hit-testable (no overlay).
**Prevention:** Any element JS toggles via `.hidden`/`hidden` attr that ALSO has an author `display` rule silently never hides — start every NEW page/dashboard stylesheet with the file-wide `[hidden]` guard (safe unless a rule intentionally styles a `[hidden]` element, e.g. opacity transitions). Symptom fingerprint: "button does nothing" while aria/state updates fine → check computed `display` vs the `hidden` attr FIRST, before debugging JS. **Recurrence #5 (2026-07-20):** `finished-photos-library.css` shipped WITHOUT the guard → the `.fpl-lightbox{display:flex}` overlay rendered from page load, dimming the library over a broken empty `<img>` (looked like a modal stuck open). Fixed file-wide (v2026.07.20.6). Lesson within the lesson: a brand-new dashboard stylesheet is the highest-risk place to forget this — the `/dash-page` scaffold should emit the guard by default.

### Richardson CSS JS-class drift (2026-05-29) · combobox DOM-regen-on-hover (2026-05-20) — ARCHIVED 2026-06-11/12
In [LESSONS_LEARNED_ARCHIVE.md](./LESSONS_LEARNED_ARCHIVE.md). Keep-alive: when JS builds DOM the CSS contract IS the class string (grep `innerHTML`/`className` both sides before a refactor); never regenerate DOM nodes during hover/mid-click (toggle classes in place); `max-height` transitions don't advance headless — verify via computed `display`.

### Leads CRM hardening batch — 4 reusable patterns (2026-07-19, ARCHIVED 2026-07-21): (1) a rebuilt `<select>` must write its effective value back to state (else it filters by an invisible value); (2) never announce a write before the promise resolves (gate all success-UI on it); (3) a create-retry on ANY error duplicates the row (read back before retrying); (4) a 15s client timeout ≠ server didn't act (say 'may have sent', verify before resend). Stamp `Updated_By`/`Created_By` server-side; `.value=` not innerHTML for lead prefill; CSV `=+-@` hardening. Full entry in archive.

### Cross-tab prefill died — a `noopener` tab starts with EMPTY sessionStorage (2026-07-19, ARCHIVED 2026-07-21): any cross-tab handoff (`window.open` to a new tab, esp. `noopener`/`noreferrer`) must use `localStorage` (ts-stamped, take-once, TTL), never sessionStorage (per-tab); verify by reading the target fields in the NEW tab, not that the stash was written. Full entry in archive.

### Storefront orders stored cart in JSON blobs only — /quote+/invoice showed "No items" + mis-taxed (2026-06-12, ARCHIVED 2026-07-04): any customer-facing quote/invoice surface MUST write `quote_items` + obey the reader contract (`TotalAmount` PRE-tax, separate `TaxAmount`/`TaxRate`, shipping as a SHIP item) — JSON blobs are invisible to the readers. "Order didn't reach ShopWorks" → check Stripe payment_status FIRST. Full entry in archive.

### EMB save↔restore mismatches: dropped sizes, double-counted fees, DECG double-save (2026-06-04, ARCHIVED 2026-06-25): a fee BOTH auto-recomputed AND restored as a row double-counts (restore one copy); run the SAME change handler on a programmatic restore; make multi-collector rows mutually exclusive. Full entry in archive.

---

## Pricing

### Rate-change sweeps must grep tax-directive strings, not just the rate constant (2026-07-06, ARCHIVED 2026-07-21): grep the OLD rate in all 3 shapes — decimal (0.101), percent (10.1), part number (Tax_10.1) — the pushed-payload taxPartNumber/taxPartDescription are a 2nd copy of the fact; derive rate from /api/tax-rates/lookup on ship-to, never a hardcoded default. Full entry in archive.

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

### Caspio DELETE/PUT-with-q.where returns 200 `RecordsAffected:0` on no-match — READ the count (2026-07-08, ARCHIVED 2026-07-21): a by-PK delete answering 0 means 'row did not exist' → map to 404, never 'deleted OK'; the proxy wrapper swallowed Caspio's body so every quote delete fabricated 0 (`deleteResponseFor()` maps 0→404). `/fields` metadata omits the autonumber PK — it is still queryable. Full entry in archive.

### Caspio PUT can answer `RecordsAffected:1, Result:[]` — `X || data` returns the empty-but-truthy array, losing the count (2026-07-11, ARCHIVED 2026-07-21): any Caspio PUT whose caller checks `RecordsAffected` must use `putWithRecordsAffected` (raw body), never `makeCaspioRequest('put')`; sibling of the DELETE-body bug. Full entry in archive.

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

### Caspio v3 paginates UNORDERED queries non-deterministically — every multi-page read needs `q.orderBy` on a stable col (2026-07-12, ARCHIVED 2026-07-21): without it page N differs across runs → 5-10% of rows silently skipped/duped (hit 36 sites incl. money paths); `q.distinct` is silently ignored (use `q.groupBy`). Rule + example in MEMORY.md Backend + proxy CLAUDE.md. Full entry in archive.

---

### Sample program: "no inventory DATA" was read as "0 in stock" — every sample add silently blocked (2026-07-06, ARCHIVED 2026-07-10): an availability/eligibility gate must distinguish "source says 0" from "source has no data" (empty warehouses → noData → fail OPEN with a caveat toast; real zeros still block); blocking on structurally-empty data = a silent feature outage. Full entry in archive.

## JavaScript Patterns

### Falsy-Zero Bug (Use ?? Instead of ||) — `||` treats `0` as falsy (tax `0` -> `0.101` fallback). Use `??` when `0`/`""`/`false` are valid. Full rule -> MEMORY.md "Top Critical Gotchas" + common-gotchas.md.

### Proxy jest suites must NOT import route files / utils/caspio — api-tracker's timer keeps the event loop alive (2026-07-11): requiring `src/routes/*` pulls `utils/caspio` → `api-tracker`, whose interval makes jest hang (or exit 1) after green tests, and the repo config has no `forceExit` (correctly — it would mask real leaks). Pattern: pure logic under test lives in a dependency-free module (`utils/form-submission-helpers.js`) that BOTH the route and the test import; verify with `timeout 6 node -e "require('<module>')"` → must exit 0 on its own.

### `await` in a sync fn (2026-06-03, ARCHIVED 2026-06-12): `node --check <file>` BEFORE browser verify — one syntax error nukes the whole script ("nothing loaded"). In embroidery-quote-builder.js the `syncRushRow()`/`updateTaxCalculation()` block is the SYNC `updatePricingDisplay`, not `recalculatePricing`. Full entry in archive.

### PDP single-method reprice shared the GLOBAL staleness token → SCP preview last-writer-wins race (2026-07-06, ARCHIVED 2026-07-10): a per-item async preview needs a per-item staleness token, not one global counter (a global generation counter is safe only if every bump re-issues EVERY item it invalidates); key the guard by the thing being re-fetched. Full entry in archive.

---

## Data Integrity

### One rep, FOUR name shapes across tables — and one is a trap (2026-07-19, AE Mission Control build)
Per-rep filters hit different shapes: `Form_Submissions.Sales_Rep`/`ORDER_ODBC.CustomerServiceRep`/`NW_Daily_Sales_By_Rep.RepName` = full name ("Taneisha Clark"); `Quote_Sessions` = `SalesRepEmail/Name`; **ArtRequests.Sales_Rep is free-text and CHANGED shape** — recent rows full names, older bare first names (`rep-email-map.js` comment stale) → first-name-only filter silently returned 0 rows. And `SALES_REP_MAP` (manageorders-emb-config) said taneisha@ → **"Taneisha Jones"** — a real BUG (Erik-confirmed Clark; every EMB/SCP/DTF push stamped a CSR name no report joins on) — FIXED to "Taneisha Clark" same day. **Fix/Prevention:** proxy `ae-dashboard.js AE_REGISTRY` = the one email→{fullName,firstName} map (sync w/ FE `leads-common.js EMAIL_TO_REP`); ArtRequests filter ORs both forms; verify a rep column's live shape with one query before filtering — never trust map comments; any rep-name map entry that matches nothing in Sales_Reps_2026 is a bug, not a variant.

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

### Jest ran suites 2-4x via stale `.claude/worktrees/` copies + trashed a capture fixture (2026-07-07, ARCHIVED 2026-07-21): any repo-globbing tool (jest testMatch, eslint/tsc) must ignore `.claude/` (agent worktrees are full repo copies) — `testPathIgnorePatterns: ['/node_modules/','<rootDir>/.claude/']`; a browser-capture test assuming :3000 is THIS session's server can overwrite a committed fixture. Full entry in archive.

### `git push heroku main` can exit 0 WITHOUT deploying (2026-07-03, ARCHIVED 2026-07-21): an expired Heroku/GCM token makes the push HANG on a credential prompt the non-interactive shell can't answer → timeout kills it mid-push, and a retry reports 'Everything up-to-date' and builds NOTHING. Push exit-code ≠ deployed — confirm the release landed (`curl` the changed asset for the new symbol + `heroku releases`); Erik refreshes the token (never Claude). Full entry in archive.

### Three recurring code patterns, post-Jun12 review (2026-07-04, ARCHIVED 2026-07-21): (a) `resp.ok ? json : {orders:[]}` + empty catch = silent-empty on API failure (throw + visible retry; money chips show '—' not '$0'); (b) one-click Push gated on a PERSISTENT quote id pushes a STALE revision (gate on THIS save's returned id, falsy on failure); (c) DTF `baseUnit` is LTM-INCLUSIVE — ladder math uses `(groupTotal−oneTimeFees−ltmFlat)/qty`, never `baseUnit`. Full entry in archive.

### PII gate flips break callers in waves — browser pages (2026-07-04, ARCHIVED 2026-07-16), crons (2026-07-07), then the proxy's OWN sync scripts (2026-07-16): full 07-04 entry (multi-grep caller enumeration + live browser verify before any secret-only flip) in archive; 3rd instance below under Order Processing & ShopWorks.

### Checkout-funnel audit (2026-07-06, ARCHIVED 2026-07-21): (a) deleting a `var` declaration throws a ReferenceError that aborts init() AFTER the visible render — a later feature (deposit PAY panel) dies silently; grep every use before deleting, and verify through the real page-load path, not direct-method eval; (b) a `perl -i` inside a double-quoted `bash -c` eats `${...}` template literals — use single-quoted perl and grep changed lines after any bulk rate edit. Full entry in archive.

### Referer-gated file endpoint 401'd staff clicks (2026-07-18, ARCHIVED 2026-07-19): never gate a browser-NAVIGATED download on Origin/Referer presence (`rel="noreferrer"`/privacy browsers strip it) — sessions/secrets via forwarders, or unguessable allow-listed paths. Full entry in archive.

### `git add -u` in a SHARED checkout deployed another session's half-done work → prod 503 outage (2026-07-19, ARCHIVED 2026-07-21): now deploy-skill Step 3.6 — after staging, `git diff --cached --name-only` and unstage any foreign hunk (`git restore --staged`, never `checkout --`); BOOT-PROBE server.js before every push (`node --check` can't catch a missing `require`). Full entry in archive.
