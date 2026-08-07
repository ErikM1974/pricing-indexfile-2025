# DTG art charges — GRT-50 / GRT-75 (built 2026-08-06)

Erik asked for "the art setup fees" on the quote builder he opens from the Leads dashboard.
The Leads workspace only *links out* to the four builders (`dashboards/js/lead-workspace.js`
`QUOTE_BUILDERS`) — the builder in question is **DTG**, the one method that had no art charges
at all. EMB/SCP/DTF have had GRT-50 + GRT-75 since the 2026 fee refactor.

**Status: LIVE — `v2026.08.06.7` / Heroku release v1829, deployed 2026-08-06.** Verified in
production (backend SHA `b8a25d5`): the section renders, Service_Codes loads live (54 codes,
GRT-50 $50 / GRT-75 $75), and 24 × PC54 Full Front goes $423.17 → $657.34 with 2 setups +
1.5 hrs, footing exactly as it does locally. ⏭️ Erik/Taneisha have NOT run a real customer
quote through it yet — that is the remaining gap, same shape as the Contract Embroidery tool.

## What was added

| Code | Charge | Entry | Rate source |
|---|---|---|---|
| `GRT-50` | Art setup / logo mockup & review | checkbox + count | Caspio `Service_Codes.SellPrice` |
| `GRT-75` | Graphic design | hours (0.5 steps) | Caspio `Service_Codes.SellPrice` (per hour) |

`shared_components/js/builders/dtg/fees.js` is THE authority — the `effectiveShipFee()`
pattern. `artFeeTotals()` is read by all five money sites (renderSummary · computePriceQuote
FromState · dtgPrintQuote · submitToShopWorks · handleSaveQuote via getSaveQuote), none of
which touch `state.fees` or the DOM directly. Art is **taxable** — it enters the tax base with
products + shipping, matching the trio (both sit inside their `preTaxSubtotal`).

## 🔑 Counts × live rate, NOT a typed dollar amount — this is the load-bearing decision

The trio gives the rep a free-text `$` box. DTG can't copy that, because DTG is the only
builder that pushes to ShopWorks itself: `server.js` `/api/submit-order-form` prices
`body.addOns` by looking each code up in Service_Codes (`GRT-50`/`GRT-75` are both
`PricingMethod: FLAT` → LinesOE price = `qty × SellPrice`). **There is no field that carries a
rep-typed amount into the push.** A typed $75 art charge would print on the customer's quote
and ShopWorks would bill $50 — or nothing. Counts push losslessly, so quoted == billed by
construction. Erik chose this over trio-parity when asked (2026-08-06).

- Both codes were already in the proxy's `KNOWN_FEE_PNS`
  (`caspio-pricing-proxy/config/manageorders-emb-config.js:71`) — **no proxy change needed**,
  which is unusual for a DTG payload field. Verify before assuming for the next code.
- DTG previously sent `addOns: []`, so this is the first thing it has ever pushed there.

## 🔴 Session COLUMNS, never fee line items — the readers double-bill

`quote-view.js` renders GRT-50/GRT-75 from the `ArtCharge` / `GraphicDesignCharge` session
columns, and its fee-item catch-all (`~:1367` `handledFeeStyleNumbers` + `suppressIf`)
suppresses those codes **only when the column is non-zero**. Write BOTH a column and a fee item
and you get one rendered row and one un-suppressed row — the customer is billed twice.

Consequence for `TotalAmount`: shipping and art are stored **differently**.

| | Where it lives | In `TotalAmount`? |
|---|---|---|
| Shipping | `SHIP` fee line item (`EmbellishmentType: 'fee'`) | ❌ readers ADD it on top |
| Art charges | `ArtCharge` / `GraphicDesignCharge` columns | ✅ readers do NOT re-add |

So `TotalAmount = subtotal + artFees` (pre-tax, excludes shipping) and the readers foot
`TotalAmount + SHIP + TaxAmount`. With no art charge that expression is byte-identical to the
old `TotalAmount = subtotal`, which is what the regression test in `dtg-art-fees.test.js`
pins.

## 🔑 DTG had no Service_Codes bridge at all

`builders/dtg/index.js` was the only builder entry point that never did
`window.getServicePrice = …` / `loadServiceCodePrices` (EMB/DTF/SCP have since Batch 3.5),
because DTG had no Caspio-priced fee until now. `GUIDE.md` claimed "bundled + window-bridged by
ALL FOUR builder entry points" — it was wrong. The fetch is kicked from `DtgAdapter.setupPage()`
(previously a documented no-op), SCP-style: fire-and-forget, then `renderSummary()` repaints the
rates when it lands. `warnIfServiceCodeMissing` reads `window._serviceCodes`, so the bridge is
what makes the fallback warning work at all.

## Counts are canonical, dollars are derived

`Notes.fees = { artSetupQty, designHours }` round-trips through edit-reopen; the dollars are
re-derived from the live rate. A Caspio price change therefore flows into a revision the same
way every other price does. `restoreEditArtFees()` falls back to the columns for any record
written before `Notes.fees` existed (recovering the GRT-50 count by dividing by the live rate,
divide-guarded).

## Verified live on localhost:3000 (2026-08-06), 24 × PC54 Full Front

24 pcs = $384.00 products, 2 art setups + 1.5 design hrs, pickup 10.2%:

| Site | Result |
|---|---|
| Screen | Subtotal 384.00 · Art setup (2 × $50) 100.00 · Graphic design (1.5 hrs × $75/hr) 112.50 · Tax 60.84 · **657.34** |
| Print PDF | Subtotal 384.00 · Logo Mockup & Review 100.00 · Graphic Design (1.5 hrs × $75.00/hr) 112.50 · Subtotal 596.50 · Sales Tax (10.2%) 60.84 · **GRAND TOTAL 657.34** |
| `getSaveQuote()` | grandTotal **657.34** |
| Push payload | `addOns: [{GRT-50, qty 2}, {GRT-75, qty 1.5}]` · breakdown.grandTotal **657.34** |

Service_Codes fetched live (54 codes, GRT-50 = 50, GRT-75 = 75). Session-draft round-trip and
`resetForm()` clearing both counts also verified in the browser.

## Files

`builders/dtg/{fees,state,form-core,pricing,output,persistence,adapter,index}.js` ·
`dtg-quote-page.js` (save) · `css/dtg-inline-form.css` · `tests/unit/dtg-art-fees.test.js`
(15 tests) · `tests/unit/builders-function-length.test.js` (render ratchet 383 → 384; the
~40 lines of markup live in the extracted `renderArtFeeSection()`).

Full jest: 119 suites / 2414 tests pass. `tests/integration/pricing-baselines.test.js` needs a
dev server and is unrelated. **No product-price path was touched** — the 5 pricing services and
`QuoteCartEngine` are untouched, and a no-art-charge DTG quote prices to the cent as before, so
this did not warrant a ~5,600-call baseline recapture.
