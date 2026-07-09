# Builder A-Grade Plan — EMB · SCP · DTF · DTG

**Written 2026-07-08** from five parallel read-only code audits (one per builder + one cross-cutting).
Companion to `A_PLUS_ROADMAP_FOR_FABLE.md` — that roadmap graded the *app* (security, testing, observability → done through Phase 1); **this plan grades the *code inside the 4 builders* and takes each from its current grade to an A.** It does NOT touch the deferred Phase 2 (multi-tenant/resale) and does not re-propose anything Erik has declined.

## Grades today → what blocks the A

| Builder | Today | The blockers (all verified, file:line below) |
|---|---|---|
| **EMB** | B | 16 functions >150 lines (worst ~1,000); ~80 dead window bridges of 168; 71 lint/type suppressions; helper duplication |
| **SCP** | B− | 2 live latent bugs (draft-restore crash; delete-row error); drifted shared constants; zero money-math unit tests; zero E2E; worst form labeling |
| **DTF** | B | **LIVE tax drift 10.2 vs 10.1 in duplicated money pipeline**; 1,473-line classic script outside the bundle; 3,713-line class; zero tier/LTM unit tests |
| **DTG** | C+ | 5,497-line monolith (99 fns, single `state` object); pricing formula duplicated across 2 repos, locked by a comment only; zero E2E, no adapter, no money unit tests |

### Definition of "A" (the rubric every batch drives toward)
1. **No wrong-number risks**: 10.2 tax sweep finished; DTF single money pipeline; DTG formula locked cross-repo; SCP bugs fixed; size-slot constants un-drifted.
2. **Every builder has**: money-math unit tests (tier/LTM/margin), a positive E2E money lane (on-screen total == saved money), and fully-wired capture scenarios.
3. **No function >150 lines** (small justified allowlist OK, e.g. one render template).
4. **Window surface = documented API only** — dead bridges deleted, internal `window._*` flags become module state.
5. **Type/lint checking active** — no file-level `@ts-nocheck` left in builders/.
6. DTG modular like the trio (strangler playbook), behind the same verification battery.
7. A11y: color pickers get listbox semantics; form controls labeled (SCP worst today).

---

## ⚠️ P0 findings surfaced by this research (fix before/with anything else)

1. **DTF live tax drift** — the tax/fee pipeline is implemented TWICE: `builders/dtf/quote-builder-class.js:2133` (`computeFeesAndTotals`, empty-field fallback **10.2** at :2158) vs `dtf-quote-page.js:65` (`updateTaxCalculation`, fallback **10.1** at :119). A cleared tax field prices differently on-screen vs saved/printed **today**.
2. **10.1→10.2 sweep ~60% done** (Milton changed 2026-07-06). Still live at 10.1: DTF `dtf-quote-page.js:119/284/303`, `dtf-quote-service.js:162/226/512/574`, `dtf-quote-builder.html:500` + **static label ":514 Sales Tax (10.1%)"**; EMB `embroidery-quote-service.js:869`; SCP `screenprint-quote-builder.html:511`; shared `quote-builder-utils.js:1466`; DTG pickup-flat `dtg-inline-form.js:256/2478/4641` (0.101 + `Wash:10.1%` labels); order-form `pages/order-form/pricing/shared.js:106/148` + label sites; `calculators/sticker-manual-pricing.html:149`; samples `sample-order-service.js:201/220/251` + `shopworks-guide-generator.js:310`. **⚠ `Tax_10.1`/GL `2200.101` are ShopWorks account identifiers — flip those only after Erik creates `Tax_10.2`/`2200.102` in ShopWorks (already on his list), never blind find-replace.**
3. **SCP latent bugs confirmed** — A: `builders/scp/persistence.js:166` calls undefined `updateRowQuantityTotal` → draft-restore throws on first size, leaving a half-restored, **unpriced** quote (no recalc, no toast). Fix: call existing `onSizeChange(rowId)` (product-rows.js:1551), hoisted once per row. B: `builders/scp/product-rows.js:1896` tail-calls EMB-only `updateCapLogoSectionVisibility` → console error on every row delete. Fix: delete the call.
4. **`SIZE06_EXTENDED_SIZES` drifted** — EMB copy (`builders/emb/state.js:54`) includes `'XXL'`; SCP copy (`builders/scp/state.js:70`) does not. EMB including XXL in Size06 contradicts the 2XL→Size05 ShopWorks rule (PC54 lesson) → possible mis-slotted line items. **Investigate which is correct before unifying** (ShopWorks-facing).
5. **DTG two-repo formula** — client `dtg-pricing-service.js:431-449` and proxy `lib/dtg-canonical-pricing.js:171/183/291` re-implement the ENTIRE engine (margin, combo print-cost, LTM-tier fallback, ceil-to-half-dollar, upcharge-after-rounding, LTM amortization). Algorithm-identical today (0.53 fallback reconciled 2026-06-20) but **nothing locks them** — only a "DO NOT diverge" comment. One edit to either side silently desyncs catalog price from builder price.

---

## Batch 1 — Correctness sweep `[P0 · ~1 session]` — ✅ SHIPPED v2026.07.09.1 (2026-07-09)

> 1.1/1.2/1.3/1.4/1.6 done (battery: 1,664 jest incl. 15 new locks · 7/7 E2E · capture 547 fields **0 mismatches** — the DTF collapse is proven byte-identical).
> **1.5 verdict — CORRECTED per Erik + SHOPWORKS_SIZE_MAPPING.md (2026-07-09):** XXL and 2XL share the **Size05 column** (Pattern 3 enables Size05 for BOTH `_2X` and `_XXL`; Size06 is 3XL+/XS/OSFA) — XXL's distinctness is the **SKU suffix only** (~589 ladies styles use `_XXL`, never `_2X`). So **SCP's list is correct and EMB's `'XXL'`-in-Size06 entry is the wrong one**. The real residual bug: both reload paths RENAME XXL→2XL (EMB `persistence.js:1074`, SCP equivalent) — a reloaded ladies-XXL quote re-saves/pushes as "2XL" → OnSite appends `_2X` → wrong SKU. Fix (awaiting Erik go): preserve the XXL NAME through reload (child row, like the import path already does) + drop `'XXL'` from EMB's Size06 list + locks. `size-constants-drift.test.js` pins the delta meanwhile.
> ~~ShopWorks GL identifiers~~ **DONE v2026.07.09.2**: Erik created Tax_10.2/2200.102 → all identifier sites flipped (DTG pickup, samples, order-form fallback), ratchet allowlist DELETED (gate now absolute). Old saved quotes keep 2200.101 in Notes — data, historically accurate.

Smallest possible diffs; each fix ships with a regression test. Full parity battery after (see Standing Rules).

- **1.1** Fix SCP bug A (`persistence.js:166` → `onSizeChange(rowId)` once per row, after the size loop) + jest lock on draft-restore completing (toast + recalc reached).
- **1.2** Fix SCP bug B (delete `product-rows.js:1894-1896`).
- **1.3** Collapse DTF tax math to ONE function: `updateTaxCalculation` (page) delegates to the class's `computeFeesAndTotals` (or exports one shared fn) — kills the 10.1/10.2 drift *class of bug*, not just the instance. Jest lock: page path and class path produce identical totals for same inputs.
- **1.4** Finish the app-side 10.2 sweep (every file:line in P0-2 above except ShopWorks GL identifiers). DTG pickup-flat: rate → 0.102 + label text; GL strings only flip when Erik confirms the ShopWorks accounts exist. Add a **ratchet test**: grep-based jest that fails on any new `10.1`/`0.101` tax literal in live code (excluding archives/comments) so the next DOR change is a 1-file edit.
- **1.5** Investigate SIZE06 `'XXL'` drift (P0-4): trace where EMB's Size06 list feeds ShopWorks slots; determine correct list; unify in ONE shared constant; jest lock. Present verdict to Erik before changing push behavior.
- **1.6** EMB dead computation `shopworks-import.js:1684-1687` (sanMarProductCount) — delete.

Grade movement: SCP B− → B+, DTF B → B+ (drift dead), the "wrong number" class is closed.

## Batch 2 — Safety net `[P0 · ~1 session]` (prerequisite for Batches 3-6) — ✅ SHIPPED v2026.07.09.3 (2026-07-09)

> **2.0 (the Erik-gated XXL fix, folded in):** both builders' reload paths now preserve size NAMES — EMB stopped renaming XXL→2XL; SCP's edit-load stopped DROPPING every non-standard size (empty monolith else) and its QQ path stopped deleting the XXL child it created. One shared pattern (named child first → prime parent input → one onSizeChange), 'XXL' out of EMB's Size06 list, lists locked identical. True jsdom round-trip lock (harness gained `extended-sizes-config.js` — child-row restores used to throw invisibly there).
> **2.1** E2E lanes: SCP + DTG positive money lanes + DTF positive lane (6 money tests total; DTF lesson: `window.dtfQuoteBuilder` exists BEFORE async init binds location listeners — click after pricing proves init, assert the summary).
> **2.2** Money-math units: SCP tier suite (fallback remap + Caspio matcher + top-tier clamp), DTF tier/minimum boundaries, and an all-22-scenario invariants suite over the LOCKED baselines (a bad re-lock can't smuggle inconsistent goldens).
> **2.4** Cross-repo DTG golden vectors: client ↔ proxy formula locked equal across the tier×location matrix + frozen goldens (Batch 6 becomes provable).
> **2.3** was already done — the 4 "stubbed" EMB capture runners were wired in a prior session; README corrected (all 22 wired).

- **2.1** E2E money lanes: SCP + DTG get the EMB-style positive lane (build → reprice → save mints id + posts REAL money); DTF's block-guard gets a positive money assertion too. (`tests/e2e/money-path.spec.js` — today: EMB 2, DTF 1 guard, SCP 0, DTG 0.)
- **2.2** Money-math unit suites for SCP/DTF/DTG (tier lookup, LTM, margin application) — golden numbers lifted from `baselines.locked.json` so they can't drift from the capture gate. (EMB already has `tests/unit/pricing/*` — the only builder that does.)
- **2.3** Wire the 4 stubbed EMB capture scenarios (EMB-03/04/05/06 need AL/DECG/cap runners — `tests/pricing-baselines/README.md:100-111`); locked field count grows past 552.
- **2.4** **Cross-repo DTG golden-vector parity test**: feed identical product-bundles to `dtg-pricing-service.js` AND `caspio-pricing-proxy/lib/dtg-canonical-pricing.js`, assert equal per-size numbers across the full tier×location matrix. This is the interim lock until Batch 6 collapses the duplication; it also makes Batch 6 provable.

Grade movement: every builder's money is now triple-locked (unit + E2E + capture). SCP → A−, DTF → A−, DTG → B−, EMB → B+.

## Batch 3 — EMB structure `[P1 · 1-2 sessions]`

EMB is 14,372 lines / 14 modules; 4 files hold 58%. Verbatim-move discipline throughout; capture parity after every extraction.

- **3.1** Split `confirmShopWorksImport` (shopworks-import.js:729, ~1,000 lines) along its own numbered steps into 8 functions + thin orchestrator: `applyCustomerSalesRepAndOrderMeta` (759-988) · `buildReviewPayload` (990-1199) · `applyEmbConfig` (1218-1303) · `mergeExtendedSizeProducts` (1305-1346, pure) · `importAllProducts` (1348-1366, 1461-1470) · `applyServiceResults` (1368-1456, 1484-1542) · `writeImportNotes` (+`appendImportNote()` helper — same idiom pasted 5×) · `finalizeImport` (1617-1714). Then same treatment for `importProductRow` (:1745, ~310).
- **3.2** Split the next tier: `showServicePricingReview` (spr-modal.js:41, ~622), `_saveAndGetLinkInner` (save-push.js:50, ~453), `_recalculatePricingImpl` (pricing-sync.js:527, ~354), `updatePricingDisplay` (pricing-sync.js:1047, ~353). Remaining >150 list (10 more) opportunistically as files are touched.
- **3.3** Bridge diet: of 168 function bridges, ~80 have no external consumer (~53 static-HTML + ~25 generated-onclick + ~6 classic-JS callers must stay). **Deletion protocol**: before removing any bridge, grep it as a *bare word* across the 5 real classic consumers (quote-builder-utils, embroidery-quote-pricing, embroidery-quote-service, embroidery-quote-invoice, quote-services-bar) + generated markup — several index.js "callers:" comments are stale. Delete in clusters with the full battery between clusters.
- **3.4** Convert intra-module `window._*` to module state: `_embSaveInFlight`, `_pushModalOpener`, `_pendingLtmState`, `_alPricingCache`, `_decgPricingCache`, `_alPricingSvc`, `_decgLtmState`, `_embRecalcSeq`, `_ddFeeMismatchWarned`. KEEP the 7 genuine cross-file contracts (`_serviceCodes`, `_restoringQuote`, `_taxExempt`, `_isWholesale`, `_lastCustomerShipTo`, `_embArtwork`, `_msPrefillEmb`) but document each at its set-site.
- **3.5** De-dup: `getServicePrice`/`loadServiceCodePrices` (emb/pricing.js:27-55 vs quote-builder-utils.js:22-49 — byte-identical) → one shared helper; size-normalization pasted at shopworks-import.js:382 + :1989 → one fn; DECG/DECC twin blocks (1054-1104) and service-row blocks (1484-1532) → table-driven.
- **3.6** Suppression burn-down: 71 `@ts-nocheck`/`eslint-disable` across EMB — remove file-level `@ts-nocheck` as each file is cleaned (product-rows 18, shopworks-import 12, save-push 9, spr-modal 9…). CI keeps them from coming back.

Grade movement: EMB → A.

## Batch 4 — DTF structure `[P1 · ~1 session]`

- **4.1** Promote the 3 cross-cluster fields (`currentPricingData`, `childRows`, `selectedLocations`) from the class onto the already-present-but-inert `quoteState` (builders/dtf/state.js) — the audit-confirmed blocker to any split.
- **4.2** Split `quote-builder-class.js` (3,713) along the 5 mapped clusters: A pricing / B rows-search-color / C locations / D save-lifecycle / E output. Big functions get the >150 treatment: `saveAndGetLink` (:2514, 399), `updatePricing` (:1663, 329), `init` (:226, 196), `buildPricingDataForInvoice` (:3009, 185), `resetQuote` (:3496, ~170).
- **4.3** Migrate `dtf-quote-page.js` (1,473, classic) → `builders/dtf/product-rows.js` + friends, mirroring SCP's shape. Gotchas from audit: page functions must exist before class instantiation (runtime-only circularity — ESM handles it); `window.childRowMap` becomes a module export; the DOMContentLoaded shortcuts fold into `DtfAdapter.setupPage` (currently a no-op). After migration `updateDtfPushButtonState` + `showDtfPushButton` become imports.
- **4.4** Drop 3 dead window exports now (`openDtfPushPreview`, `renderDtfPushPreview`, `copyQuoteToClipboard` — index.js:39/49/50); delete the dead class copy of `handleCellKeydown` (:1357) after verifying the page copy is the only bound one; hardcoded `API_BASE` fallback (page:475) → config-only.
- **4.5** XXL/XXXL alias normalization (~16 inline sites across class+page) → one shared helper (feeds Batch-1.5's unified constants).

Grade movement: DTF → A.

## Batch 5 — DTG decomposition `[P1 · 2-3 sessions]` (REQUIRES Batch 2 first — DTG currently has zero safety net)

Strangler the 5,497-line IIFE (99 fns) per the proven playbook, **leaf-first**:

- **5.1** Extraction order: 1 `utils.js` (pure helpers) → 2 `artwork.js` (8 fns) → 3 `crm.js` (7) → 4 `tax-shipping.js` → 5 `catalog-search.js` (fetchers + comboboxes + 4 caches) → 6 `pricing.js` (`updateLivePrices`, `computePriceQuoteFromState`, tier helpers — the money path, extract behind Batch-2 tests) → 7 `output.js` (submit/print/email) → 8 `persistence.js` (session/edit-load/banners) → 9 `state.js` + composition root (`state` object, `render` :735 ~383 lines, `wireGlobalHandlers` :2113 ~292, `init`).
- **5.2** Audit-flagged risks to honor: the single module-scoped `state` object promotes to `state.js` exactly like the trio; **bare `hasChanges` at line 32 lives OUTSIDE the IIFE** because quote-builder-utils reads it unqualified — needs a window-backed accessor shim (same trick as scp/state.js:139) or the leave-guard silently breaks; the 13-method `window.DTGInlineForm` surface stays byte-stable (dtg-catalog + dtg-quote-page consume it); `window.aiState` (owned by dtg-quote-page.js) read at :4079; keep `render`+handlers in the same cluster (DOM-id coupling).
- **5.3** `dtg-quote-page.js` (1,711, AI-chat controller + `dtgSaveQuote`) and `dtg-catalog.js` (714, clean one-directional seam) stay as-is this batch — they're separate, coherent files; page-controller migration is a later nice-to-have.
- **5.4** Optional finale (stretch): a thin `DtgAdapter` + `QuoteBuilderBase` boot so DTG joins `adapter-contract.test.js`. Worth it for the shared lifecycle + loud-pricing-failure path; DTG keeps its inline-form UX (this changes wiring, not design).
- **5.5** Split the remaining >150 fns as their clusters move: `submitToShopWorks` (:4113, 267), `loadSavedDtgQuoteForEdit` (:4837, 239), `computeReadiness` (:1443, 193), `attachCompanyCombobox` (:2808, ~181), `attachDesignCombobox`/`fillFromQuote` (151 each). `render` (383) may stay whole on the allowlist (one template).

Grade movement: DTG → A− (A after Batch 6).

## Batch 6 — DTG formula collapse `[P1 · ~1 session]` (after Batch 2's parity vectors exist)

- **6.1** The proxy's `lib/dtg-canonical-pricing.js` (pure, 392 lines, already the designed source of truth) becomes the ONE formula: publish it dual-format (CommonJS for the proxy + browser-loadable copy vendored into this repo by a build step, or ESM re-export), and `dtg-pricing-service.js` **delegates** its base-unit + LTM math to it — deleting the duplicated blocks (:431-454, :505-518, :388-398 incl. the tricky LTM-tier print-cost fallback).
- **6.2** Server `/api/dtg/quote-pricing` stays the authoritative save-path check. Batch-2.4's golden-vector test now proves the collapse changed nothing; the capture battery + catalog-matrix locks re-run as always.
- **6.3** Retire the "DO NOT diverge" comment pair; `dtg-canonical-fallback-parity.test.js` upgrades from constant-lock to full-formula import-lock.

This closes the single scariest structural risk in the system. Grade movement: DTG → A.

## Batch 7 — Polish to A across the board `[P2 · ~1 session]`

- **7.1** JS-template inline styles (166 non-toggle across 16 builder modules — spr-modal 32, scp/push 24, dtf/push 24, emb/product-rows 23, shopworks-import 18…) → `qb-*` utilities, finishing what 1.7 started (HTML pages are done; DTG page already at 0). Aligns with roadmap 3.7.
- **7.2** Color-picker listbox semantics (`role="listbox"`/`option`, `aria-activedescendant`, `aria-selected`) — zero exist today anywhere; keyboard nav already works, so this is markup-only. One shared fix in the row templates hits EMB/SCP/DTF; DTG's comboboxes separately.
- **7.3** Label sweep: SCP worst (54 controls, ~48 unlabeled upper-bound), DTF ~30, EMB ~14. Pairs with the axe zero-ratchets already in CI.
- **7.4** Invoice engine (`embroidery-quote-invoice.js`, 1,671 lines, ALL 4 builders — highest blast radius file): the `$100` digitizing/AL and `$30`/screen fallback labels (:722-725, :892, :929) become Service_Codes-driven with visible-warning fallback (Erik's pricing=API rule). No rename — a header comment + GUIDE.md row documents that it serves all four.
- **7.5** SCP/EMB shared-constant graduation finishes (EXTENDED_SIZES, SIZE_TO_SLOT, window-backed contract block → `builders/shared/size-constants.js`), and SCP's 18 consumer-less bridges + EMB leftovers get the same deletion protocol as 3.3.

---

## Sequencing, effort, grade movement

| Order | Batch | Effort | EMB | SCP | DTF | DTG |
|---|---|---|---|---|---|---|
| 1 | Correctness sweep | 1 session | B | **B+** | **B+** | C+ |
| 2 | Safety net | 1 session | B+ | **A−** | **A−** | B− |
| 3 | EMB structure | 1-2 sessions | **A** | | | |
| 4 | DTF structure | 1 session | | | **A** | |
| 5 | DTG decomposition | 2-3 sessions | | | | **A−** |
| 6 | DTG formula collapse | 1 session | | | | **A** |
| 7 | Polish | 1 session | A+ | **A** | A+ | A+ |

**Total: ~8-10 sessions.** Batches 1+2 are the cheap, high-value half — they close every wrong-number risk and triple-lock the money in ~2 sessions. Batches 3-6 are structure; they're safe *because* of Batch 2. Batch order 3↔4 and 5↔6 can swap; 5 must follow 2; 6 should follow 2.4.

## Standing rules for every batch (non-negotiable)

- **Verbatim-move discipline** for all extractions; behavior changes only in explicitly-flagged fixes.
- **Full battery after every meaningful step**: build → lint (exit code) → typecheck → jest (node+jsdom) → Playwright E2E → capture vs `baselines.locked.json` (0 mismatches) → restore captured.json. ANY price-adjacent change also re-runs `web-quote-cart-parity` + `quick-quote-parity` (Rule 9: 3 surfaces, one engine).
- Never a hardcoded price without API-first + visible-warning fallback. Never a 4th pricing path.
- Docs on every file event (ACTIVE_FILES.md, GUIDE.md); LESSONS entry per bug actually fixed; deploy only via /deploy.

## Erik decisions / coordination needed

1. **ShopWorks `Tax_10.2` / GL `2200.102` accounts** (already on your list) — blocks flipping the `Tax_10.1`/`2200.101` identifiers in samples/order-form/DTG-GL strings (Batch 1.4 does the *rates* now, identifiers when you confirm).
2. **SIZE06 `'XXL'` verdict** (Batch 1.5) — I investigate and bring you the answer before changing anything ShopWorks-facing.
3. **Batch approval** — say "go" for the recommended order, or cherry-pick (each batch is independently shippable; 1 and 2 are the ones I'd argue hardest for).
