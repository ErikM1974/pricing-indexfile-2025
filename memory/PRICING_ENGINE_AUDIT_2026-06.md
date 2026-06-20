# Pricing Engine Audit — 4 Methods × 3 Surfaces (2026-06-20)

**17-agent, adversarially-verified audit** of EMB/DTG/SCP/DTF across the 3 price surfaces
(Customer Catalog · Quick Quote · Staff Quote Builder). Every finding the auditors rated
"high" was **verified DOWN to med/low** by an independent skeptic. **Bottom line: no active
wrong-price bug today.** Every HEADLINE price (the number a customer/rep actually quotes) is
single-source and Caspio-driven on all 4 methods. The findings are latent drift-risk, a few
console-only fallback warnings, and 2 cosmetic display bugs.

## Architecture — who prices what

| Method | Headline (Catalog + Quick Quote) | Catalog MATRIX | Staff Builder | Verdict |
|---|---|---|---|---|
| **EMB** | engine → `EmbroideryPricingCalculator.calculateQuote` | **2nd copy** `EmbroideryPricingService.calculatePricing` | same calculator | headlines single-source; matrix is a 2nd formula |
| **SCP** | engine → `ScreenPrintPricingService` | **2nd copy** `pdp buildMatrix` re-assembles ladder | same service | headlines single-source; matrix + tier-label re-derived |
| **DTF** | engine → `DTFPricingService.calculatePriceForQuantity` | **2nd copy** `calculateAllTierPrices` | **3rd copy** inline `calculateFromState` | one ladder, THREE assemblers |
| **DTG** | engine → server `/api/dtg/quote-pricing` (`dtg-canonical-pricing.js`) | **client copy** `dtg-pricing-service.js` | client preview / server push | TWO copies in TWO repos |

Quick Quote's matrix is the exception: it **probes the engine itself** (`PROBE_QTYS`,
`quick-quote.js:633`), so it **cannot drift** from its headline. That's the pattern to copy.

## ⭐ Root-cause theme: the catalog "see every quantity" MATRIX is a SECOND formula
`pdp-configurator buildMatrix` re-implements the price ladder SEPARATELY from the engine
headline for EMB/SCP/DTF (and uses the client copy for DTG). They agree today only *by
construction* (same Caspio bundle) — nothing locks them. **This unlocked second path is
exactly what let the safety-stripe matrix gap ship** (matrix omitted the +$2 the headline
charged). **RULE: any pricing change must verify the catalog MATRIX, not just the headline.**
Fix pattern: make catalog matrices engine-probed like Quick Quote, OR add matrix==engine
parity tests. EMB's two rounders ALREADY differ on the unknown-`RoundingMethod` default
(matrix ceils, headline half-dollar-up) — a real latent desync.

## DTG: two copies in two repos, kept in sync by a comment only
`dtg-canonical-pricing.js` (proxy, server-authoritative — catalog headline/QQ/builder-save) vs
`dtg-pricing-service.js` (FE client — catalog matrix/builder-preview/PDF). No cross-repo
equality test. Evidence they already drifted: empty-tiers fallback margin is **0.57 server vs
0.53 client** (`dtg-canonical-pricing.js:34` vs `dtg-pricing-service.js:536`), both silent.

## Prioritized backlog (verified findings)
**✅ BATCH 1 SHIPPED v2026.06.20.5 (2026-06-20):** SCP-2 (builder tier label now from the matched
Caspio bundle, not the static SCREENPRINT_TIERS map) · SCP-3 (catalog below-min message is now
method-aware — "Screen Print starts at 24 pieces", verified live) · DTF-1 (builder `getSizeUpcharge`
flags + fires a de-duped VISIBLE warning on any hardcoded extended-size fallback; price unchanged;
locked by `tests/unit/dtf-size-upcharge-fallback.test.js`). REMAINING below.

**✅ #1 SHIPPED v2026.06.20.6 (2026-06-20):** Catalog matrices are now ENGINE-PROBED (EMB-1 / SCP-1 /
DTF-2 / DTF-3 / DTG-2 closed). `pdp-configurator.js` `probeLadder()` prices a representative qty per
tier through the SAME `singleItemPreview()` the headline uses, so the "see every quantity" matrix
IS the engine — it can't drift (transitively locked by `web-quote-cart-parity`). Universal extraction
`(groupTotal − oneTimeFees − ltmFlat)/qty` + LTM on its own row reconciles EXACTLY to the headline
all-in per-piece for every method (itemized SCP/EMB AND baked DTG/DTF, whose `baseUnit` semantics
differ). `buildMatrix` kept for note/foot + as a fallback ladder. Verified all 4 in preview: SCP $12
(48-71), DTF $16.17+$50→$19.50, DTG $13.99+$50→$18.16, EMB $21 LC / $29 FB-incl-AL — all = headline.

**HIGH leverage (follow-up)**
- **DTG**: add a server↔client equality regression test + reconcile the 0.53/0.57 fallback
  drift (DTG-1 / DTG-4). Long-term: client delegates to the canonical module (one formula).
- **SCP-2** (quick fix): staff builder shows/saves a STALE hardcoded tier label
  (`SCREENPRINT_TIERS` 24-36/37-72/...) — at qty 48 it labels "37-72" while pricing Caspio's
  "48-71". Price right, label wrong. Derive label from the bundle (`screenprint-quote-builder.js:2967`).
- **SCP-3** (quick fix): catalog below-min total message hardcodes "DTF transfers start at 10
  pieces" for ALL methods — screen print shows the DTF/10 message instead of "Screen print
  starts at N." Use `def.label` + `res.minQuantity` (`pdp-configurator.js:853`).
- **DTF-1**: staff builder save/print has a SILENT hardcoded size-upcharge fallback
  `{2XL:2..6XL:6}` (`dtf-quote-builder.js:1996`) — the engine THROWS on a missing upcharge.
  The one true Pricing=API violation; API-source it + warn/block. (Latent — defaults match live.)

**MED / LOW (hygiene)**
- Visible-warning hygiene (console→visible banner) for staff-builder fallbacks: SCP LTM band
  $75/$50 (SCP-5, also pre-overhaul amounts), SCP per-screen "× $30" display string vs API SPSU
  (SCP-4), DTF GRT-75 design rate (DTF-6), EMB `calculateALPrice` partial-API fallback (EMB-4).
- Parity coverage gaps: EMB >10K-stitch AS-GARM/AS-CAP (EMB-2), DTG 23→24 LTM boundary (DTG-5),
  DTF-4 builder-inline vs engine, DTF-5 QQ jumbo→full collapse.
- SCP-7: stale `BasePrintCost` comments in the live service after the Ed_Cost overhaul (cosmetic).

**None of the above changes a price a customer pays today.** Headlines are correct + single-source.
