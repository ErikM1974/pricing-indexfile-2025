Both spot-checks confirm the findings: the pickup branch (`:7145`) unconditionally wipes `ship-address` with no `_restoringQuote` guard, and the invoice generator (`:523-527`) interpolates customer fields with zero escaping. The traces hold. Here is the master punch-list.

# EMBROIDERY QUOTE BUILDER — MASTER PUNCH-LIST (72% → 100%)

## 1. READINESS SCORECARD

| Dimension | Score | Status |
|---|---|---|
| security | 55 | 🔴 BLOCKED — stored XSS in PDF + SQL injection on public endpoint |
| customer | 70 | 🔴 BLOCKED — 2 wrong-money/wrong-account HIGHs |
| lifecycle | 74 | 🟠 AT RISK — pushed order still status-editable; dup-order paths |
| ux | 74 | 🟠 AT RISK — tax-exempt wrong total + a11y gaps |
| freight | 78 | 🟠 AT RISK — pickup phantom-freight CRITICAL |
| tax | 80 | 🟡 NEARLY — DOR rate truncation mis-bills hundredths jurisdictions |
| pdf | 82 | 🟡 NEARLY — /invoice pre-import drops discount + shipping |
| errors | 86 | 🟡 NEARLY — AL/DECG $0 silent save |
| artwork | 86 | 🟡 NEARLY — dual-design duplicate push |
| shipping | 88 | 🟢 SOLID — edit-reload address wipe (narrow) |
| save | 90 | 🟢 SOLID — only latent precision issues |
| push | 90 | 🟢 SOLID — edge/import/failure-mode only |

**Overall: ~78% production-ready.** Gated by 6 blockers (security ×2, customer ×2, freight ×1, errors ×1) that cause wrong money, wrong account, data loss, or code execution on the default live path.

---

## 2. MASTER PUNCH-LIST

### 🔴 P0 — BLOCKS SHIP (security / arbitrary execution / public data leak)

**P0-1** `[security]` Stored XSS in invoice/PDF generator — all customer fields rendered unescaped, executed via `document.write` — `shared_components/js/embroidery-quote-invoice.js:523-527,499,533,1016-1017,1266-1267,1563` (emitted at `embroidery-quote-builder.js:12605`) — Add a private `esc()` (copy `quote-builder-utils.js:22` impl) to `EmbroideryInvoiceGenerator`; wrap every `${customerData.*}`, `${serviceType}`, `${description}`, `${partNumber}`, `${displayColor}`, `${position}` before interpolation. Leave numeric/`toFixed` values raw. This generator backs all 4 builders, so the fix protects DTG/DTF/SCP too.

**P0-2** `[security]` SQL/predicate injection on public, unauthenticated endpoint via `styleNumber` — `caspio-pricing-proxy/src/routes/quotes.js:201` — Escape before interpolating: `whereConditions.push(`StyleNumber='${String(req.query.styleNumber).replace(/'/g,"''")}'`)` (mirror the `QuoteID` hardening two lines up at `:192-198`), or 400 on non-`[A-Za-z0-9_-]`. Router is mounted with no auth and `cors.origin:'*'`, so this leaks all Quote_Items cross-customer.

**P0-3** `[security]` Numeric/ID injection in EMB-design routes, including destructive `DELETE … OR 1=1` (deletes every `EMB_Design_Files` row) — `caspio-pricing-proxy/src/routes/emb-design-routes.js:36,93,123,232,268` — Validate PKs: `const pk=parseInt(id,10); if(!Number.isInteger(pk)||pk<=0||String(pk)!==String(id)) return res.status(400)…;` then interpolate `pk` (reuse `quotes.js parsePkId`); same for `mockupId`. Not reachable from the builder UI but is a data-loss hole in the same proxy.

### 🔴 P1 — REAL MIS-BILL OR DATA LOSS (default live path)

**P1-1** `[freight]` Estimated freight not cleared when rep switches back to Pickup → phantom freight billed + taxed + saved as `SHIP` line + pushed to `cur_Shipping`, while UI shows "Customer Pickup" — `embroidery-quote-builder.js:7141-7156` — In the `isPickup` branch set `document.getElementById('shipping-fee').value='0';` before `lookupTaxRate()`, then call `updateAdditionalCharges()`/`updateTaxCalculation()`. Defense-in-depth: gate the save's SHIP line (`embroidery-quote-service.js:826`) and `calculateDiscountableSubtotal()`'s shippingFee on `ship-method!=='Customer Pickup'`. (Fixing the source value also closes the PDF symptom at `:12449` / `embroidery-quote-invoice.js:1519`.)

**P1-2** `[customer]` Tax-exempt customer still charged WA sales tax (wrong total on quote, PDF, and push) — `embroidery-quote-builder.js:1703` (`applyContact` calls `lookupTaxRate()`, no exemption awareness at `:7026`) + `customer-context-banners.js:137-151` (chip is cosmetic) — In `applyContact`, when `contact.Is_Tax_Exempt` is truthy: uncheck `#include-tax`, set `#tax-rate-input=0` (skip/override `lookupTaxRate()`), call `updateTaxCalculation()`, toast. Optionally extend `surfaceCustomerContext` to take an `includeTaxId` and clear+dispatch it.

**P1-3** `[customer]` Design-lookup auto-fill attaches the order to the WRONG ShopWorks customer on a fuzzy match — `embroidery-quote-builder.js:2309` (`contacts[0]` fallback) + `:2314` (substring `isCloseMatch`), auto-triggered from `:2212` with no rep confirmation — Require an exact case-insensitive, apostrophe-normalized `CustomerCompanyName` match; drop the `contacts[0]` fallback and the substring match; if no exact match, leave `#customer-number` blank.

**P1-4** `[errors]` AL / Customer-Supplied (DECG/DECC) per-row pricing throw silently bills $0 and saves it — `embroidery-quote-builder.js:5920` (AL) and `:5973` (DECG); zero-price save gate at `:7375` only checks non-SanMar products — In both catch blocks set `row.dataset.priceError='true'` + error toast ("Couldn't price the Additional Logo / Customer-Supplied row — refresh; not saved at $0"); extend the `saveAndGetLink` gate at `:7375` to block when any service row has `dataset.priceError==='true'` (or AL/DECG `unitPrice<=0`). Violates Erik's #1 rule.

**P1-5** `[tax]` WA DOR rate truncated to 1 decimal → hundredths-digit jurisdictions billed the wrong rate; dedicated GL accounts (`2200.302`/`.303`) unreachable — `caspio-pricing-proxy/src/routes/tax-rate.js:468,480,516,529` (each returns `parseFloat((rate*100).toFixed(1))`) — Change the four sites to `.toFixed(2)` (or send raw `rate*100`); the front-end `parseFloat(value)/100` already handles 2 decimals. Better: persist + reuse the proxy-computed `data.account` instead of re-deriving from the truncated decimal.

**P1-6** `[tax]` `getTaxAccount` rounds `.x5` rates to 1 decimal → 10.25%/10.35% GL accounts are dead, true half-percent rates misroute — `caspio-pricing-proxy/config/manageorders-emb-config.js:153` — Change to `const taxPct = Math.round(taxRate*10000)/100;` (existing tenth/integer keys still match). Independent of P1-5.

**P1-7** `[pdf]` `/invoice` pre-import drops the discount → invoice does not foot (line items exceed displayed subtotal by the discount, disagrees with `/quote`) — `pages/js/invoice.js:786-810` + missing row in `pages/invoice.html:156-181` — In the pre-import branch of `renderTotals`, pull the DISCOUNT fee item from `data.quoteItems` (negative `LineTotal`), add a "Discount" row to `invoice.html`, and reconcile the subtotal label since `TotalAmount` is already net of discount. Confined to `/invoice/:quoteId` before hourly sync; does not affect builder PDF or `/quote`.

**P1-8** `[pdf]` `/invoice` pre-import omits shipping dollars from the grand total while still taxing shipping — `pages/js/invoice.js:796` — In the pre-import branch, fall back to the SHIP fee item's `LineTotal`: `const shipItem=(data.quoteItems||[]).find(i=>String(i.EmbellishmentType).toLowerCase()==='fee' && (i.StyleNumber==='SHIP'||i.StyleNumber==='SHIPPING')); const shipping = fromOrder ? Number(order.cur_Shipping) : Number(orig?.totals?.shipping ?? (shipItem?shipItem.LineTotal:0));` (mirrors `quote-view.js getShippingFee()`). Fix together with P1-7 — same `renderTotals` block.

**P1-9** `[artwork]` Design # + uploaded artwork = duplicate design pushed to ShopWorks, with no guard at any layer (card auto-collapse hides the still-populated widget) — `caspio-pricing-proxy/lib/embroidery-push-transformer.js:457-499` (Branch 1 + Branch 2 non-exclusive) + `embroidery-quote-builder.js:2363-2371,2414-2429,7536-7549` — In `buildDesigns`, make branches mutually exclusive: when `garmentDesignNumber` (resp. `capDesignNumber`) is valid, skip Branch-2 new-design Locations for the corresponding surfaces. Frontend belt-and-suspenders: when a Design # is applied for a surface, clear/disable the artwork widget for that surface in `applyDesignToCard`/`setDesignNumberOnLogo`, and vice-versa (the HTML at `:124-126` already declares them alternatives).

### 🟠 P2 — CORRECTNESS / ROBUSTNESS (edge, import, or failure-mode paths)

**P2-1** `[lifecycle]` Pushed EMB order's Status still editable from the dashboard dropdown (Edit is locked, Status is not) — rep can mark a live ShopWorks order "Lost" — `dashboards/quote-management.html:662,797` — Add an `else if (quote.PushedToShopWorks)` branch before `:662` rendering a read-only "In ShopWorks" badge; add `|| !!quote.PushedToShopWorks` guard at the top of `updateQuoteStatus` (`:797`).

**P2-2** `[lifecycle]` Duplicate-QuoteID rows bypass the edit lock — builder/sync read the unordered (oldest, unpushed) row while push stamps the newest → can create a duplicate ShopWorks order — `caspio-pricing-proxy/src/routes/quotes.js:434-440` (no `q.orderBy`) feeding `embroidery-quote-service.js:1316` + `server.js:4995-4999` — Add `q.orderBy=PK_ID DESC` support to the proxy `/api/quote_sessions` route (or select max-PK_ID match in `loadQuote`/`sync-from-shopworks`); treat `PushedToShopWorks` set on any row sharing the QuoteID as locked.

**P2-3** `[push]` Failed `PushedToShopWorks` write silently disarms the 409 dup-guard → duplicate ShopWorks order on later push — `caspio-pricing-proxy/src/routes/embroidery-push.js:157-166` — On PUT failure, retry once; if still failing, return `success:false, warning:'pushed but dedup flag not set — do not re-push'` so the frontend surfaces it. Optionally check MO-side ExtOrderID before pushing.

**P2-4** `[push]` Imported `DGT-001/002/003` digitizing fees demoted to a note (ShopWorks under-bills) and never shown in push preview — `shared_components/js/shopworks-import-parser.js:1166,1171-1175` (raw code bypasses `CODE_MAP` at `:199-201`) + preview at `embroidery-quote-builder.js:7954-7975` — Normalize `DGT-00x→DD/DDE/DDT` before storing in `digitizingFees`; AND surface `skippedFeeNotes` as an explicit preview warning ("These charges will NOT be billed as line items: …").

**P2-5** `[customer]` Project Name captured nowhere — silent data loss (field exists, never read/saved/restored; DTF/DTG persist it) — HTML `embroidery-quote-builder.html:669`; service expects `customerData.project` at `embroidery-quote-service.js:946,1126` — Read `#project-name` into `customerData.project` + draft, add `ProjectName` to save (`:246-369`) and update (`:1381-1480`), restore in `loadQuoteForEditing`/draft-restore, clear in `resetQuote`.

**P2-6** `[customer]` Typed Customer # never verified against CRM → transposed-but-valid number pushes to a real-but-wrong account — `embroidery-quote-builder.html:647` (free text); `customer-lookup-service.js:89` `getById()` never called by builder — When the rep types/edits `#customer-number` without a selected contact, resolve via `getById()` and display the resolved company name in the preview (so a wrong number is obvious) or warn if it doesn't resolve.

**P2-7** `[shipping]` Edit-reload of a saved Pickup-method quote holding a real OOS ship-to silently wipes the address to Milton/WA; next Save Revision + push persists it — `embroidery-quote-builder.js:888` → `:7145-7148` (the `_restoringQuote` guard only protects the tax lookup at `:7149`, not the address clobber) — Guard the clobber during restore: in `restoreEmbOrderShipping`, call `onShipMethodChange()` only when method is genuinely pickup AND no real address exists, e.g. `if (sm!=='Customer Pickup' || (!session.ShipToAddress && (!session.ShipToState||session.ShipToState==='WA'))) onShipMethodChange();`.

**P2-8** `[customer/ux]` Stale CRM context banners bleed onto the next/blank customer after Start-New or manual re-entry — `embroidery-quote-builder.js:1712-1722` (only paint site); not cleared in `resetQuote` (`:8360-8398`) or lookup `onClear` (`:1731-1739`) — In both, hide+empty `#customer-warning-banner`, `#customer-tax-chip`, `#customer-tier-badge`, `#customer-terms-note`.

**P2-9** `[push]` Typed-but-unverified all-digit design number pushed as existing `id_Design` while UI promised a NEW design — `embroidery-quote-builder.js:2131-2134` (badge says "will be created" but still sets the number) → transformer `embroidery-push-transformer.js:457-462` — Carry a `verified` flag from the lookup through save; only emit `{id_Design}` when verified, otherwise emit a Branch-2 new-design entry (DesignName + ExtDesignID).

**P2-10** `[push]` Same `id_Design` linked twice when one design is on both garments and caps — `caspio-pricing-proxy/lib/embroidery-push-transformer.js:457-462` (`buildDesigns` Branch 1 no dedup; both fields set to same # at `embroidery-quote-builder.js:9682-9696`) — Collect numeric design IDs into a `Set` before emitting `{id_Design}`. Money-safe but double-links.

**P2-11** `[artwork]` Push preview never shows artwork/Designs, so a rep can't verify the logo or catch the duplicate — `shared_components/js/embroidery-quote-builder.js:7910-7977` (renders only LinesOE; designs shown as a bare count) — Iterate `o.Designs`; render each `DesignName` + per-`Location` thumbnail (`<img src=Location.ImageURL>`) and label; warn when both an `{id_Design}` and a `{DesignName}` entry are present (the duplicate signature).

**P2-12** `[artwork]` No server-side backstop for "artwork present + blank design name" (silent art drop, stamps "NO DESIGN LINKED") — `caspio-pricing-proxy/src/routes/embroidery-push.js` (after customer-# guard `:71-80`); transformer `:729-731` — After the customer-# guard run `parseImportNotes(session)`; if `referenceArtwork.some(f=>f&&f.hostedUrl)` and `!newDesignName.trim()`, return 400 ("Artwork uploaded but design unnamed — name it before pushing").

**P2-13** `[errors]` `disableQuoteCreation` selectors no longer match the real Save/Push buttons → the AL-pricing-failure backstop is inert — `embroidery-quote-pricing.js:1957-1965` (Save has no id/matching class at HTML `:895`; Push is `#emb-push-shopworks-btn` at `:888`) — Add real selectors `[onclick*="saveAndGetLink"], #emb-push-shopworks-btn` (or expose `window.embQuoteBuilder.setQuoteCreationEnabled(false)` and call it).

**P2-14** `[errors]` `loadServiceCodes` silently uses hardcoded fees on a `200 {success:false}` (or shape without `.data`) — `embroidery-quote-pricing.js:334` (no `else` on the `if (data.success && data.data)`, warning lives only in `catch`) — Add an `else` that pushes the same `apiStatus.warnings` entry and `showAPIWarning('Could not load current service fees … using default amounts. Verify before sending.','partial')`.

**P2-15** `[ux]` Push button doesn't re-enable when Email is the last field typed (manual entry) — `embroidery-quote-builder.js:1662-1664` (`customer-email` has no input listener) — Add `document.getElementById('customer-email')?.addEventListener('input', updatePushButtonState);`.

**P2-16** `[ux]` Push-preview modal (primary-action confirm step) strands keyboard focus — no focus move, no Escape, no trap, no `role="dialog"` — `embroidery-quote-builder.js:7887` + `embroidery-quote-builder.html:954` — On open move focus to Cancel/first control + remember opener; add a modal-scoped keydown that closes on Escape and traps Tab; restore focus on close; add `role="dialog" aria-modal="true" aria-labelledby` to `#emb-sw-push-modal` (other modals share the gap but this is the load-bearing one).

### 🟡 P3 — POLISH (latent, mitigated, dormant, or a11y-only)

**P3-1** `[ux]` Form-field labels not associated (0/48 have `for=`) — money-form inputs have no accessible name — `embroidery-quote-builder.html:634,638,642,646` (+ order/shipping fields) — Add `for="<input-id>"` to each label (ids already exist).

**P3-2** `[freight]` Residential delivery never surcharged → ~$6.50 under-estimate on home shipments — `embroidery-quote-builder.js:6099-6102` (POST omits `residential`; endpoint supports it at `caspio-pricing-proxy/src/routes/shipping.js:60,78`) — Pass `residential:true` when ship-to is a residence (or default true to match prepay bias).

**P3-3** `[freight]` Freight rate grid hardcoded in proxy, not Caspio-sourced (drifts on UPS hikes, no deploy-free knob) — `caspio-pricing-proxy/src/routes/shipping.js:35-60` — Move `ZONE_MODEL`+fuel+residential into a Caspio reference table read like `box-density`. Mitigated by visible "rough estimate" label + rep override.

**P3-4** `[save]` Divided-fee unit re-rounded 4dp→2dp can mis-bill ShopWorks (Qty×Price ≠ invoice LineTotal) — latent, unreachable today — `embroidery-quote-service.js:885-888` (SW bills Qty×Price at `embroidery-push-transformer.js:359-360`) — Keep the 4dp unit already computed at `:676/:690` (don't down-round in the generic loop), or push `LineTotal/Quantity`. Only bites on a sub-cent third-decimal per-piece cost (none in 374 prod rows).

**P3-5** `[save]` Fractional GRT-75 `Quantity` (half-hours) may truncate if `Quote_Items.Quantity` is an Integer column — premise real, column type unconfirmed — `embroidery-quote-service.js:761`; input allows halves at HTML `:777` — Confirm the column type; if Integer, store hours as `LineTotal` with `Quantity:1` (or a decimal field), or constrain the input to whole hours.

**P3-6** `[lifecycle]` Dashboard renders both duplicate-QuoteID rows → non-pushed duplicate shows an enabled Edit; `editQuote` re-finds a possibly-different row — `dashboards/quote-management.html:884` — Dedup `allQuotes` by QuoteID (keep max-PK_ID) before render; in `editQuote` treat as locked if any row with that QuoteID has `PushedToShopWorks` or a locked Status. (Same root as P2-2.)

**P3-7** `[lifecycle]` In-app "Sent ✓" lock is client-only and reset by any later save — `shared_components/js/embroidery-quote-builder.js:7834` (`showPushButton` unconditionally sets `_pushAlreadyDone=false`, called after every save at `:7718`) — Preserve `_pushAlreadyDone` when re-saving the same `_pushQuoteId` (reset only for a genuinely new quote), or re-read `PushedToShopWorks` after save. Backend 409 still prevents a silent duplicate.

**P3-8** `[push]` Legacy/imported `EmbellishmentType:'monogram'` row vanishes on push (charge lost, not even noted) — dormant — `caspio-pricing-proxy/lib/embroidery-push-transformer.js:189-223`; written at `embroidery-quote-service.js:520,1633` — Drop the dead `'monogram'` discriminator at save (always `'embroidery-additional'`/`'fee'`), or add a `'monogram'` branch routing through `buildServiceLine` (PN `Monogram` is a known fee code).

**P3-9** `[push]` Dead SAMPLE-fee save block would under-bill if re-enabled (`SAMPLE` not in `KNOWN_FEE_PNS`) — dormant — `embroidery-quote-service.js:781-790` (+ orphaned reads at `embroidery-quote-builder.js:8707-8708`) — Delete the dead block + orphaned `sampleFee`/`sampleQty` reads, or map to a real configured SW part. (Also resolves the latent extended-vs-flat sample divergence noted in `save`.)

**P3-10** `[tax]` `/invoice` trusts frozen `TaxAmount` but `/quote` recomputes it → links can disagree by rounding cents (architecturally fragile) — `pages/js/invoice.js:795` vs `pages/js/quote-view.js:2025,2039` — Make `/quote` prefer the frozen amount when present: `const taxAmount=(this.quoteData.TaxAmount!=null && this.quoteData.TaxAmount!=='')?Number(this.quoteData.TaxAmount):Math.round(taxableAmount*this.taxRate*100)/100;`.

**P3-11** `[shipping]` Import writes a real OOS ship-to into hidden fields and lets it drive tax + save when the imported order has no ship method — `embroidery-quote-builder.js:10804-10819` — When `data.shipping.street`/`zip` is present, switch the toggle to ship and call `onShipMethodChange()` before populating so the address isn't silently hidden. (Seed-state for P2-7.)

**P3-12** `[shipping]` Invoice/PDF hands literal `"Other"` as ship method instead of the entered carrier (latent — generator doesn't render it yet) — `embroidery-quote-builder.js:12600` — Resolve like the save path: `method:(shipMethod==='Other'?(document.getElementById('ship-method-other')?.value?.trim()||'Other'):shipMethod)`.

**P3-13** `[ux]` Services-bar category menus expose no `aria-expanded`/`aria-haspopup` and don't close on Escape — `quote-services-bar.js:108,118-125,171-176` — Render with `aria-haspopup="true" aria-expanded="false"`, flip on toggle, add Escape-to-close returning focus to the category button.

**P3-14** `[ux]` Loading overlay gives assistive tech no status — `embroidery-quote-builder.html:57-59` — Add `role="status"` + visually-hidden "Loading…" (and/or `aria-busy` on the container).

**P3-15** `[customer]` Customer email presence-checked but not format-validated (`"n/a"` saves and the confirmation email bounces) — `embroidery-quote-builder.js:7344-7352` — Validate with a regex or `emailEl.checkValidity()` before save; surface an error on failure.

**P3-16** `[customer]` Edit-reload doesn't re-surface CRM context for the loaded customer — `embroidery-quote-builder.js:1712` only; `loadQuoteForEditing`/`populateCustomerInfo` never re-run it — After restoring `#customer-number`, look up by id and call `surfaceCustomerContext` to repaint banners (without overwriting restored tax fields). Lower impact — saved tax fields are restored at `:951-964`.

**P3-17** `[security]` No rate-limiting on builder-reachable write/abuse endpoints (`force=true` bypasses dup-guard; 20MB uploads) — `caspio-pricing-proxy/server.js:837,394` — Apply `strictLimiter` to `/api/embroidery-push` and a tighter limiter to `/api/files/upload`.

**P3-18** `[security]` Inline `onclick` builds a JS string literal via HTML-escaping (wrong context; non-exploitable today since values are alphanumeric SanMar style #s) — `shared_components/js/embroidery-quote-builder.js:3020` — Drop the inline handler: render `data-style="${escapeHtml(product.value)}"` + delegated click listener, or JSON-encode for the JS context.

---

## 3. CLEAN DIMENSIONS

None of the 12 dimensions came back with **zero** confirmed issues. The three closest to clean — and effectively production-solid on the **default live path** — are:

- **save (90)** — both save paths reconciled field-by-field against real `EMB-2026-293`; `updateQuote` is insert-then-delete gated on `failedItems===0` (no silent loss); partial saves surfaced; ColorCode inventory-correct. Only latent precision issues (P3-4, P3-5) remain.
- **push (90)** — all live-path money flows (customer linking, line pricing, order-level fees, tax, artwork round-trip) traced clean; every surviving defect is edge/import/failure-mode (P2-3, P2-4, P2-9, P2-10, P3-8, P3-9).
- **shipping (88)** — the legitimate Ship-order round-trip into `cur_Shipping`, per-size SanMar weights, Caspio-tunable box density with visible fallback, and 400-on-zero-weight all traced clean; the one real bug (P2-7) needs a narrow seed-state.

Also confirmed solid within otherwise-flagged dimensions: the EMB transformer correctly handles decimal `TaxRate` (the `toRateDecimal` "gap" is refuted), per-line `sts_EnableTax*` constants are inert (MO strips them), and the builder's on-screen/save/PDF tax math is internally consistent for exempt/out-of-state.

---

## 4. PATH TO 100%

**Honest blocker count: 9 real ship-blockers (3 P0 + 6 P1 wrong-money/data-loss/account). Everything below P1 is correctness-hardening or polish — ~31 items, none of which block a careful mouse-driven rep on the happy path.**

Shortest ordered sequence:

1. **P0-1, P0-2, P0-3** (security) — stored XSS, public SQLi, destructive DELETE injection. ~½ day total; all are small, surgical edits with an existing `esc()`/`parsePkId` to reuse. Do these first — they are exploitable and one is destructive.
2. **P1-1 (freight pickup), P1-2 (tax-exempt), P1-4 (AL/DECG $0)** — the three frontend wrong-money bugs on the default path. Each is a few lines in `embroidery-quote-builder.js`. ~½ day.
3. **P1-3 (wrong-customer auto-fill)** — drop the fuzzy fallback. ~1 hour.
4. **P1-5 + P1-6 (tax rate truncation + account rounding)** — both are one-line `.toFixed`/`Math.round` precision fixes in the proxy; ship together. ~1 hour.
5. **P1-7 + P1-8 (/invoice discount + shipping)** — same `renderTotals` block + one new HTML row. ~½ day.
6. **P1-9 (dual-design push)** — transformer mutual-exclusion + frontend widget disable. ~½ day; add the preview render (P2-11) and server backstop (P2-12) in the same pass since they're the same feature.

After step 6 the builder is **genuinely shippable** (no wrong money, no wrong account, no data loss, no code execution on the live path) — call it **~93%**.

**To reach a true 100%**, clear P2 (lifecycle dup-order locks, push import under-bill, project-name data loss, customer-# verification, ship-address wipe, stale banners, the inert AL backstop, modal focus) — ~3-4 days — then P3 polish (a11y labels/focus/aria, residential surcharge, Caspio-sourced freight grid, the dormant SAMPLE/monogram dead code) — ~2-3 days. **Total to 100%: roughly 8-10 focused engineering days, of which only the first ~2.5 days are real ship-blockers; the remaining ~6 are correctness-hardening and polish.**

Key file hotspots for the blockers: `shared_components/js/embroidery-quote-builder.js`, `shared_components/js/embroidery-quote-invoice.js`, `caspio-pricing-proxy/src/routes/{quotes,tax-rate,embroidery-push,emb-design-routes}.js`, `caspio-pricing-proxy/lib/embroidery-push-transformer.js`, `caspio-pricing-proxy/config/manageorders-emb-config.js`, and `pages/js/invoice.js`.