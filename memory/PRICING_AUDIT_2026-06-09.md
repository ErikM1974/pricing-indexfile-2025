# Pricing-Surface Audit — 2026-06-09 (all 4 builders + Order Form + Quote Mgmt)

> Multi-agent audit (17 agents, every finding adversarially re-verified against source). 47 confirmed, 1 rejected.
> Lens: Erik's rules — (1) Pricing = API never hardcoded, (2) all surfaces calc the SAME price, (3) no silent API fallback, (4) tax respects exempt/out-of-state/destination.
> Status legend per item: ☐ open · ☑ fixed · ⏸ deferred.

## ✅ FIX STATUS (2026-06-09) — FIXED + DEPLOYED LIVE + VERIFIED (incl. safety-stripe API + dead-code cleanup)
**Critical/High/Medium ALL fixed + deployed; LOW dead-code cleanup ALSO shipped. Done.**
**DEPLOYED:** proxy **v803** (DTF `sizes` index-shift fix) + frontend **`v2026.06.09.4`** (latest). LIVE end-to-end: DTF order form prices **$18.50** (was ~$8.75) with 2XL +$2; exempt order **$0 tax/$500 deposit** (was $505/$2752).
**Safety-stripe NOW API-driven (v2026.06.09.4):** created Caspio Service_Code **`SP-STRIPE`** (PK_ID 234, SellPrice $2, ServiceType SCREENPRINT, RailGroup 'SP Extras') via proxy POST `/api/service-codes`. SCP builder reads `getServicePrice('SP-STRIPE',2)`; Order Form retired the virtual card → reads the live Caspio row (verified "CASPIO (good)", +$2/loc). Change the rate in Caspio → both reflect it, no deploy.
**Dead-code cleanup SHIPPED (v2026.06.09.4):** DELETED `cap-quote-builder.js`/`cap-quote-pricing.js`/`cap-quote-service.js` + `dtf-quote-adapter.js` + `dtg-quote-pricing.js` + legacy EMB `sendQuoteEmail`/`generateProfessionalQuoteHTML` (verified: no live script refs, EMB Theme F + live save fns intact, live cap engine `cap-embroidery-pricing-service.js` untouched, 404 in prod, 1076/1076 tests). ACTIVE_FILES.md/GUIDE.md updated. **Still orphaned (flagged, not deleted): `cap-quote-logos.js`, `cap-quote-products.js`** — delete next pass.

DONE (committed): **C1** DTF arg+backend bug (proxy `pricing.js` styleQueryStart + `dtf.jsx` positional call, no silent fallback) · **C2** OF tax `resolveTaxContext` (shared.js+registry) · **G** OF push rate/account (shopworks.js) · **H** OF 3 tax labels · **A** OF EMB+SCP LTM re-round · **B** OF DTG margin 0.6→0.57 + EMB/DTF LTM from API · **I** OF SCP safety-stripe · **J** quote-mgmt OF edit route + APP_CONFIG URL · **C/D/F** SCP/DTF/EMB fees → Service_Codes (shared `getServicePrice` in quote-builder-utils) · MEDIUM: EMB puff key, invoice tax label, DTG/DTF manual-cost host gate, EMB digitizing/GRT-75 metadata · DTG cleanLines invalid-color filter.
LIVE-VERIFIED (Preview, zero console errors): tax resolver (exempt/wholesale/OOS→0, in-WA 10.1%, lookup rate); EMB 6pc LTM exactly $50 (re-round fix); exempt order $0 tax/$500 deposit (was $505/$2752); SCP stripe +$2/loc; DTF manual $22.50; DTF live fail-safe error; SCP/DTF/EMB builders load Service_Codes (SPSU=30/GRT-75=75/DD=100); quote-mgmt APP_CONFIG + OF branch present. 1076/1076 unit tests pass.

**v2026.06.09.5 — SCP/sticker Pricing=API completed (the 5 garment calculators are now FULLY API):** SCP builder LTM ($75/$50 bands → Caspio `Pricing_Tiers.LTM_Fee` off the bundle); SCP calculator `screenprint-pricing-v2.js` setup/stripe ($30/$2 → Caspio SPSU/SP-STRIPE via new `loadServiceFees()`); sticker setup (created Caspio `STK-NEW-ART` PK_ID 235 $50, retired the OF virtual card). Live-verified: ltmFee 75/50, calc $30/$2 from Caspio, sticker +$50 from CASPIO. **Caspio codes created this session: `SP-STRIPE` (234, $2), `STK-NEW-ART` (235, $50).**

DEFERRED (LOW, no current money impact — own follow-up pass):
- DELETE dead files **DONE v2026.06.09.4** (cap-quote-builder/pricing/service, dtf-quote-adapter, dtg-quote-pricing, legacy EMB sendQuoteEmail). Still orphaned: `cap-quote-logos.js`, `cap-quote-products.js`.
- **Emblem (specialty, NOT one of the 5 garment calculators):** `emblem-pricing-service.js` has a HARDCODED base price grid + `Digitizing_Fee 100`/`Metallic_Pct 0.25`/etc. (Caspio-overridable via `rules` with hardcoded fallbacks). Consistent across emblem calculator + OF (same service), but not Caspio-sourced. Order-form `EMB-NEW-DESIGN $100` still a virtual card. Specialty pricing model — separate effort if Erik wants it API.
- SCP LTM `Math.floor` (~$0.12 under-collect — intentional anti-overcharge per MEMORY).
- DTF `getTransferCostForProduct()` returns 0 (unreachable DOM-fallback) · DTF size-upcharge silent fallback warning · DTG `getTierForQuantity` throw-on-bad-data · EMB rounding fallback CeilDollar→HalfDollarUp (API-failure only) · SCP displayed tier-label source · DTF separate-LTM-mode PDF footing (known P3).


## Executive summary
The **four quote builders' on-screen totals + ShopWorks pushes are sound** — every confirmed money bug there is a *display/footing* divergence, not a wrong charged total (grand total is driven by `#pre-tax-subtotal`, which shields it). The **Order Form (`pages/order-form/`) is the weakest surface**: it re-implements tier/LTM/rounding/tax math instead of reusing the shared services, and that re-implementation has drifted into one **critical under-charge (DTF)** and a **critical tax bug (flat WA 10.1%, no exempt/out-of-state path)**. Second theme across every surface: **Pricing=API violations** — charged fees ($30/screen, $2/stripe, $75/hr design, $50 LTM, $100 digitizing, margin denominators) hardcoded instead of read from Caspio, so a Caspio price edit silently fails to propagate.

## CRITICAL — wrong number charged or pushed
- ☐ **C1 — DTF Order Form arg bug drops garment markup+labor+freight (~$3+/pc, ~$72+/24pc under-charge, pushed low).** `pages/order-form/pricing/methods/dtf.jsx:156-181` calls `calculatePriceForQuantity({bundle,sizeKey,quantity,locationCount})` with ONE object, but `dtf-pricing-service.js:361` is `calculatePriceForQuantity(garmentCost, data, sizeKeys, quantity)` (4 positional). Body throws → catch swallows → fallback at 165-180 ALWAYS runs, and the fallback reads bundle keys that don't exist (`garmentCost`/`laborCost`/`freightCost`) → all 0, margin→0.6 → `raw = transferCost only`. Fix: call positionally with real bundle fields; delete the silent fallback (or throw + visible banner). Add DTF builder-vs-OF parity test.
- ☐ **C2 — Order Form tax hardcoded WA 10.1% + 50% deposit, no exempt/out-of-state/destination path.** `pages/order-form/pricing/shared.js:105-112`, sole caller `registry.js:96`. `info.isTaxExempt` is captured (`paper-form.jsx:2114/2156`, shows a chip) but never passed to the tax math; no `/api/tax-rates/lookup`. Over-taxes exempt/OOS on the customer-facing approval doc (tax-exempt $5k order shows ~$505 tax + inflated $2,752.50 deposit). Money pushed to SW is correct (server zeroes tax), so harm is wrong DISPLAY. Fix: thread `computeTaxAndDeposit(subtotal, {isTaxExempt,isWholesale,shipState,taxRate})`, mirror `dtg-inline-form.js recomputeTaxRate`; deposit% from config.

## HIGH — parity gaps / hardcoded-price / cross-surface divergence
- ☐ **Theme A — OF LTM re-round (over-charge small batches).** `embroidery.jsx:133,153` re-rounds base+LTM together (builder rounds base first, adds raw LTM, no re-round — `embroidery-quote-pricing.js:1569`); over-charges qty 1-7 up to ~$0.49/pc. `screenprint.jsx:197-198` same (`Math.ceil(unit*2)/2` after LTM); over-charges qty<24 up to ~$0.49/pc. Fix: `roundPrice(base,rule)+ltmPP`; keep LTM exact. Parity tests qty 1-7 / <24.
- ☐ **Theme B — OF hardcodes LTM/margin instead of reading Caspio.** `dtf.jsx:178,267` ($50 LTM), `embroidery.jsx:133,280-281` ($50 LTM baked), `dtg.jsx:176` (`MarginDenominator||0.6` should be 0.57 to match `dtg-pricing-service.js:528`). Fix: read `LTM_Fee`/`MarginDenominator` from the resolved tier row (cf. `dtg.jsx:177` does it right for LTM); share one `FALLBACK_MARGIN_DENOM`; warn on fallback.
- ☐ **Theme C — SCP charged fees hardcoded (zero Service_Codes usage).** $30/screen (`screenprint-quote-builder.js:66,69,121` +4 more files), LTM $75/$50 bands (`:3010-3012`, diverges from calculator which reads `currentTier.LTM_Fee`), $75/hr design (`:385,3476,3559,3681,3904,4040`). Fix: load Service_Codes (EMB `loadServiceCodePrices()`/`getServicePrice()` pattern); literals = warned fallback only.
- ☐ **Theme D — $75/hr design hardcoded in DTF too** (`dtf-quote-page.js:81,389,428`, `dtf-quote-builder.js:452,2534,2812`). EMB does it right (`getServicePrice('GRT-75',75)`). Also `quote-builder-utils.js:359`.
- ☐ **Theme E — cap-embroidery SAVE path recomputes fees from hardcoded 50/100** (`cap-quote-service.js:136-138`) instead of reusing API-resolved `cap-quote-pricing.js` values → saved TotalAmount diverges from screen.
- ☐ **Theme F — EMB print/save hardcoded $100 digitizing / $75 GRT-75.** `embroidery-quote-builder.js:12564` (PDF setup/subtotal + spec `:842`); `embroidery-quote-service.js:759-767` (saved GRT-75 line unit=75 while LineTotal API-derived → unit×qty≠LineTotal). Grand total stays correct.
- ☐ **Theme G — OF push omits tax rate/GL account.** `app.jsx:57-59` ship state lacks taxRate/taxAccount; `info.isWholesale` never captured → `server.js buildOrderNote` emits "Tax: NEEDS REVIEW", resellers never book GL 2203. Couples with C2.
- ☐ **Theme H — OF tax UI wrong rate/total in 3 components.** `totals.jsx:154`, `print-sheet.jsx:231`, `customer-approval-view.jsx:330` hardcode "Estimated tax (10.1%)" + `subtotal*0.101` + 50% deposit. Drive from C2 breakdown.
- ☐ **Theme I — SCP $2/loc safety-stripe hardcoded AND missing from OF.** Hardcoded charged `screenprint-quote-builder.js:3043,3897`; OF `screenprint.jsx:189-203` has NO stripe term → under-charges $2/loc/pc on OF.
- ☐ **Theme J — quote-management.html.** Hardcoded API URL `:183` (no `app.config.js` load, Never-Break #6); OF edit misroute `:909-922` (no `prefix==='OF'` branch → opens EMB builder `?edit=OF-NNNN`; OF expects `?draftId=`) → whole OF quote class non-editable from dashboard.

## MEDIUM — save/load + UI correctness
- ☑ `dtf-quote-builder.js:1709,2799-2804` — separate-LTM-mode PDF doesn't foot (line items LTM-stripped, grand total LTM-inclusive; total correct). Derive PDF unit prices from `calculateFromState()`. (MEMORY known-deferred P3.) **DONE 2026-06-11**: print path single-sourced from `calculateFromState()` (LTM-inclusive prices, `ltmDistributed: true`).
- ☑ `dtf-quote-builder.js:2756,2876-2899` — print path reads `.row-price`/`.cell-price` DOM instead of `calculateFromState()`. **DONE 2026-06-11**: print/save fully state-sourced; child-row qtys too (`DTFQuoteBuilder.childRows` state model, locked by `dtf-childrow-state.test.js`).
- ☐ `dtg-pricing-service.js:106-127` (+ `dtf-pricing-service.js:23`) — `getManualCostOverride()` not host-gated (EMB/cap gate on localhost/herokuapp). Add `isInternal` gate.
- ☐ `embroidery-quote-builder.js:12582-12584` — 3D-puff read with key `['3d-puff']` but method returns `{puff,patch}` → always 0 → PDF omits puff line (charge still in total). Use `.puff`.
- ☐ `embroidery-quote-invoice.js:1551-1554` — PDF label "WA Sales Tax (X%)" hardcoded even for OOS (amount correct). Mirror email path "Sales Tax/Out of State" (`embroidery-quote-service.js:980`).
- ☐ `embroidery-quote-service.js:268,277,1405,1413` — DigitizingFee/CapDigitizingFee metadata cols literal 100 (line items API-correct; metadata latent-stale).
- ☐ `cap-quote-pricing.js:492,516-521,529-530,545` — LTM/digitizing/margin fallbacks (50/100/0.57) warn console-only, not a visible rep banner.
- ☐ `screenprint-quote-builder.js:2945-2959` — sidebar tier label ≠ saved PricingTier ≠ API band (price correct via `findPricingTier`). Derive label from matched API tier.
- ☐ `sticker.jsx:23-39` — STK-NEW-ART virtual card hardcodes SellPrice:50 and virtual wins over Caspio (`service-codes.js:94`).

## LOW — cleanup / dead code
- ☐ DELETE `shared_components/js/dtf-quote-adapter.js` (orphaned, full hardcoded DTF price grid — re-wire trap; zero script refs).
- ☐ `dtg-quote-pricing.js:27-49` — hardcodes sub-24→"24-47" vs Caspio 1-23; DEAD (only `dtg-inline-form.js` loaded). Delete or fix.
- ☐ `embroidery-quote-service.js:925-932,1085-1092` — legacy `sendQuoteEmail`/`generateProfessionalQuoteHTML` tax base omits stitch/puff/rush/art/discount; DEAD. Delete or rebuild base.
- ☐ `screenprint-quote-builder.js:3039` — `Math.floor` LTM per-unit under-collects ~$0.12 vs un-floored calculator.
- ☐ `dtf-quote-builder.js:2930-2943` — `getTransferCostForProduct()` indexes `{breakdown,total}` by location string → always 0 (only on unreadable-DOM fallback).
- ☐ `dtf-quote-builder.js:1981,2004` — size-upcharge `{2XL:2..6XL:6}` silent fallback when API upcharges empty; add visible warning.
- ☐ `dtg-inline-form.js:4077-4079` — `cleanLines` push filter omits `!isRowColorInvalid(r)` the 4 other consumers apply (gated upstream by Submit-disable).
- ☐ `dtg-pricing-service.js:519-532` — fabricates `{24-47,0.57,LTM 0}` tier on invalid data (silent misprice). Throw/return null.
- ☐ `embroidery-quote-pricing.js:314-316` — builder rounding fallback `CeilDollar` vs OF/service `HalfDollarUp` → ~$0.50-1/pc divergence ON API FAILURE ONLY. Unify to HalfDollarUp.

## Cross-surface consistency matrix (normal Caspio data unless noted)
| Method | Tier boundaries | LTM | Rounding | Tax source |
|---|---|---|---|---|
| EMB | MATCH (API) | DIVERGE: OF re-rounds base+LTM & hardcodes $50; builder exact $50 separate, no re-round → OF +~$0.49/pc qty1-7 | DIVERGE on API-failure only (builder CeilDollar vs OF HalfDollarUp) | MATCH amt; builder PDF label "WA Sales Tax" hardcoded for OOS |
| SCP | 3 label sets diverge (cosmetic); price MATCH via findPricingTier | DIVERGE: builder hardcodes $75/$50 bands vs calc reads LTM_Fee; OF re-rounds; builder floors ~$0.12 | DIVERGE: OF ceil*2/2 after LTM vs builder no post-LTM round → ~$0.49/pc | OF hardcoded 10.1% no exempt; builder/calc context-aware |
| DTF | DIVERGE(OF): hardcoded bands + arg bug forces this path (C1) | DIVERGE: OF hardcodes $50; stripe missing from OF | DIVERGE(OF) on stripped inputs (C1); builder PDF reads DOM | OF hardcoded 10.1% no exempt |
| DTG | MATCH live (legacy dtg-quote-pricing.js dead) | MATCH live (reads LTM_Fee); OF reads LTM_Fee correctly | MATCH | OF hardcoded 10.1%; inline-form recomputeTaxRate context-aware |

Margin-denominator fallback (degraded data only): OF DTF & DTG fall to **0.6** (`dtf.jsx:170`, `dtg.jsx:176`) — only surfaces using 0.6; DTF's fires always (C1).

## Recommended fix order (money first, smallest blast radius)
1. C1 DTF arg bug (5-line, 1 file) + parity test.
2. C2 OF tax exempt/destination path (`shared.js`+`registry.js`).
3. Theme G+H — OF push rate/account + 3 tax labels/totals (same data as C2).
4. Theme A — OF EMB+SCP LTM re-round (one line each) + parity tests.
5. Theme B + DTG margin 0.6→0.57 — read tier LTM_Fee/MarginDenominator; share fallback const; warn.
6. Theme I — add safety-stripe to OF SCP.
7. Theme C/D/E/F — migrate charged fees → Service_Codes (largest blast radius, all-4 sync, needs Caspio rows). Coordinated pass after money bugs; literals = warned fallback.
8. Theme J — quote-mgmt OF edit branch + app.config.js URL.
9. Theme F + MEDIUM correctness items.
10. LOW cleanup (delete dead files, fix latent fallbacks).

Full per-finding evidence + verify reasons: workflow `wf_6f9329c3-59a` output (task `w5w8q0h84`).
