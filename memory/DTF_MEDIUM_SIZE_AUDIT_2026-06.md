# DTF Medium (≤9×12") — App-Wide Audit + Permanent-Fix Plan (2026-06-23)

> **✅ BUILT 2026-06-23 (on preview, NOT deployed).** Both collapsed surfaces fixed UI-only:
> - **Quick Quote** (`quick-quote.js`): added CF/CB to FRONT_OPTS/BACK_OPTS + DTF_FRONT(CF→center-front)/DTF_BACK(CB→center-back) + labels + DTF_SIZE_BAND(≤9×12). DTG has no medium → `DTG_FRONT_FROM={CF:'FF'}`/`DTG_BACK_FROM={CB:'FB'}` translate in `dtgCode()` + `frontOnlyGroups()` so DTG prices CF as full-front (not unavailable). SCP/EMB unaffected.
> - **Catalog PDP** (`pdp-configurator.js`): added centerFront/centerBack to GARMENT_LOCATIONS + DTF_KEYS (sizeKeys:['medium']) + DTF `supports`. Chips render for all methods (existing PDP pattern); picking CF/CB auto-switches to DTF (`:627-628`).
> - **Guard test** `tests/unit/dtf-medium-resolver.test.js` locks center-front/center-back→medium (DTFConfig + engine fallback agree). **VERIFIED**: PC61 qty24 DTF center-front = $19.00/pc (garment $7 + medium $12) IDENTICAL on Quick Quote AND catalog; monotonic Small$9 < Med$12 < Large$16. Full suite 1448 pass (only pre-existing pricing-baselines server-suite fails). Ships WITH the quick-quote breakdown build.


> 12-agent audit (9 surface readers + completeness sweep + location-vs-size crux + synthesis) on:
> "expose DTF Medium consistently across the whole app." **Verdict: UI-only fix, 2 files, NO engine/
> service/proxy/Caspio change.** DTF Medium is ALREADY priced in Caspio + fully engine-supported.

## The key facts (verified by reading code)
- **DTF data has 3 sizes, all priced**: `allDtfCostsR` rows `Up to 5x5` (Small), **`Up to 9x12` (Medium)**, `Up to 12x16.5` (Large), per qty tier (confirmed live via `/api/pricing-bundle?method=DTF`).
- **The engine prices by `sizeKey` (small/medium/large), NOT by location.** A location only *resolves to* a sizeKey via a lock table. `center-front`/`center-back` already → `medium` in FOUR places: `dtf-quote-pricing.js:64-65` (DTFConfig authority), `dtf-quote-builder.js:57-58`, `quote-cart-engine.js:86-87` (+ resolver `dtfLocationInfo:740-748` → `sizeKeys.push(info.size):789`), `quote-view.js:62-63`.
- **Medium is reachable on 6 of 8 surfaces TODAY** — DTF builder + Order Form expose it; save/PDF/ShopWorks push (`dtf-quote-service.js:81-82` center-front→CF) + saved-quote viewer all carry it.
- **Only 2 surfaces collapse DTF to Small+Large**: Quick Quote (`quick-quote.js:86-93` — `DTF_FRONT` has no CF/CB) and Catalog PDP (`pdp-configurator.js:127-144` — `GARMENT_LOCATIONS`/`DTF_KEYS` only small/large).

## THE MODEL = location-based (add a Medium LOCATION, NOT a size-picker)
Add `center-front`/`center-back` chips to the 2 collapsed surfaces → the engine prices Medium with ZERO new code. The size-picker model (Order Form / manual-pricing / compare-pricing / prototype) is the outlier — do NOT convert the location-locked surfaces to it (high regression risk, zero benefit).

## DTG safety = automatic
DTG has no center-front/CB location + no `centerFront` chip key. PDP gates chips via per-method `supports` maps (`:178/199/221/235`) — set `centerFront/centerBack=true` ONLY on DTF. DTG keeps Small/Large/Jumbo; DTF correctly has no Jumbo (`JF→full-front`, asserted `quick-quote-parity.test.js:76`).

## ⚠️ Structural gap the audit caught
The parity baselines price DTF by an explicit `l.size` (`capture-pricing-baselines.js:455`) and NEVER call the location→size resolver — so `web-quote-cart-parity` will NOT catch a regression in the CF/CB→Medium wiring. **Must add a dedicated resolver test FIRST.**

## SEQUENCE (UI-only, low risk)
- **Step 0 (FIRST, ~30min)**: add `tests/unit/dtf-medium-resolver.test.js` — assert `getSizeForLocation('center-front')==='medium'` + engine `dtfLocationInfo(...,'center-front').size==='medium'` + the 4 literal maps agree. Closes the harness gap.
- **Step 1 (Quick Quote, trivial ~1hr)**: `quick-quote.js` add CF/CB to `FRONT_OPTS:66`/`BACK_OPTS:72`, `DTF_FRONT:86`(CF→center-front)/`DTF_BACK:87`(CB→center-back), `FRONT_LABELS/BACK_LABELS:88-89`, `DTF_SIZE_BAND:93` (CF/CB → `≤9×12"`). Existing `quick-quote-parity.test.js:70-79` uses `toContain` → stays green.
- **Step 2 (Catalog PDP, moderate ~2-3hr, CUSTOMER-FACING)**: `pdp-configurator.js` add centerFront/centerBack to `GARMENT_LOCATIONS:127` + `DTF_KEYS:139` (`locations:['center-front'], sizeKeys:['medium']`) + DTF `supports.centerFront/centerBack=true` only. Mobile chip layout (5 vs 4) needs visual QA.
- **Step 3**: regression sweep `dtf-save-parity` / `dtf-childrow-state` / `dtf-size-upcharge-fallback`; verify all 3 price surfaces (Rule 9).

## Keep-in-sync (no edit now, 4 independent CF/CB↔Medium literals)
`dtf-quote-pricing.js` · `quote-cart-engine.js` · `dtf-quote-service.js` · `quote-view.js`.

Full report: workflow run `wf_fbec5260-6d7`.
