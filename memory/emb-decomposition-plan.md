# EMB Decomposition Plan — roadmap 0.4 working map

> Working document for the strangler extraction of `embroidery-quote-builder.js`
> (13,703 lines → `shared_components/js/builders/emb/*`). Update the checklist as
> clusters land. Mechanics proven by extraction #0 (2026-07-07). Raw function
> inventory: regenerate with the mapper (see "Tooling" below) — don't trust stale
> line numbers after edits.

## The proven mechanics (follow EXACTLY per cluster)

1. Move the cluster's functions verbatim into an ES module under `builders/emb/`
   (JSDoc-typed; no behavior edits in the same commit as the move).
2. Re-export each moved function onto `window` from `builders/emb/index.js` —
   the ONE sanctioned re-export surface (eslint enforces). Bare-identifier
   callers in the monolith resolve through the global object, and the bundle
   executes at parse time (body-end tag) — strictly before `DOMContentLoaded`,
   so init-time callers always find the bridges.
3. Delete the monolith copy, leave a one-line MOVED pointer comment.
4. Cross-module state stays where its READERS are: a `window.*` location that
   other files read (e.g. `_serviceCodes`) is a CONTRACT — keep it until the
   last reader migrates (eslint-disable with the WHY inline).
5. Verify before commit: module unit test (esbuild `transformSync` → CJS →
   `new Function` — see `tests/unit/builders/emb-pricing-module.test.js`) ·
   `npm run build` · lint · typecheck · full `test:unit` · browser (bridges
   resolve, zero console errors, live behavior) · pricing capture vs locked
   (`captureAll({baseUrl})` against this session's server) · parity locks.
6. A cluster = one commit. Never mix a move with a behavior change.

## Cluster map (from the 2026-07-07 inventory: 224 top-level fns, 46 vars, 59 HTML handlers)

| # | Cluster (monolith lines, 2026-07-07) | ≈Lines | Target module | Status |
|---|---|---|---|---|
| 0 | Service_Codes fees (`loadServiceCodePrices`/`getServicePrice`, was 8-36) | 30 | `pricing.js` | ✅ 2026-07-07 |
| 1 | Design-search modal (`openDesignSearchModal`, gallery, filters, `lookupDesignNumber`, `applyDesignToCard`, thumbnails) — 986-line contiguous cut, 15 bridges (incl. 3 GENERATED-markup handlers static grep missed), 2 reset accessors for the monolith's outside touch points, `window._designSearchCache` → module-private | ~980 | `design-search.js` (events+render domain) | ✅ 2026-07-07 |
| 2 | Stitch estimators + logo-config UI (126-570: stitch tiers, logo cards, AL toggles, embellishment dropdowns) | ~440 | `logo-config.js` | ⬜ |
| 3 | Draft/persistence + edit-load (`getEmbroideryQuoteData`, `restoreEmbroideryDraft`, `loadQuoteForEditing`, `duplicateQuote`, `populate*`) — 1,195-line cut (region up to the DOMContentLoaded init listener; logo-config UI + date helpers ride with cluster 2), 8 bridges, imports design-search directly; state seams moved to eslint-config-level writable globals; roundtrip harness now injects the emb bundle after the monolith (like the page) | ~1,195 | `persistence.js` | ✅ 2026-07-07 (extraction #4) |
| 4 | Product search + rows + sizes + colors (3304-6378: `addNewRow`, `onStyleChange`, size-category, color picker, child rows, price override) | ~3,000 | `state.js` + `render.js` + `events.js` (split during move) | ⬜ biggest |
| 5 | Pricing recalc + display + AL/DECG/rush sync (`recalculatePricing` 353L, `collectProductsFromTable`, `updatePricingDisplay` 351L, tax/shipping UI) — THE hot pricing path. ⚠️ Mechanic: the monolith tail REASSIGNS `recalculatePricing = wrapWithRepricingIndicator(...)` — in the module this becomes `async function _recalculatePricingImpl(){...verbatim...}` + `export let recalculatePricing = _recalculatePricingImpl` + module-tail rewrap, so internal callers + live-binding importers + the window bridge ALL get the wrapped fn (assign bridge AFTER module eval) | ~1,800 | `pricing-sync.js` | ⬜ NEXT |
| 6 | Save + link + push (`saveAndGetLink`, `_saveAndGetLinkInner` 450L, push readiness/preview/confirm/verify) — 918-line cut to its own `save-push.js`; the 3 push-state vars HOISTED BACK to the monolith (persistence/output modules read them via scope chain) | ~915 | `save-push.js` | ✅ 2026-07-07 (extraction #6) |
| 7 | Quote-level UI: reset/fees/discounts (`resetQuote` 243L, discounts, fee table, tracking, collectors) — 643-line cut to `quote-lifecycle.js`; persistence/output/save-push now REAL-import its collectors (getAdditionalCharges/collectDECGItems/update*) | ~640 | `quote-lifecycle.js` | ✅ 2026-07-07 (extraction #7) |
| 8 | Service-pricing-review modal (`showServicePricingReview` 615L + `onSpr*`) — 941-line cut, 12 bridges (ALL 5 onSpr row handlers live in generated template-literal markup — python scan, shell grep quoting lies), `getSprEmbConfigOptions()` accessor for the import cluster's read | ~940 | `spr-modal.js` (domain) | ✅ 2026-07-07 (extraction #2) |
| 9 | DECG stitch modal — audit found it DEAD (openDECGStitchModal: zero callers repo-wide incl. generated markup + DOM-id manipulation; superseded by the SPR modal which owns DECG/DECC during import). Block + static HTML markup DELETED, not extracted | ~200 | (deleted) | ✅ 2026-07-07 (deleted) |
| 10 | ShopWorks import (import modal, `renderImportPreview`, `confirmShopWorksImport` 999L, `importProductRow`, non-SanMar modal, summary banner) — 2,012-line cut, 11 bridges, FIRST real inter-module imports (spr-modal + design-search); `pendingShopWorksImport`+`lastImportMetadata` stay monolith-declared (26 outside readers → clusters 6/11) | ~2,010 | `shopworks-import.js` (domain) | ✅ 2026-07-07 (extraction #3) |
| 11 | Output/diagnostics (`diagnoseQuote`, `buildEmbroideryPricingData`, print/email/copy) — 780-line tail cut to its own `output.js` (cleaner than folding into persistence.js); the wrapWithRepricingIndicator tail statement STAYS in the monolith (rewraps recalculatePricing, cluster 5) | ~780 | `output.js` | ✅ 2026-07-07 (extraction #5) |

Order rationale: cohesive low-coupling domains first (1, 8, 9, 10 are modals with
their own state), then persistence (3, 6, 11), then the entangled heart (4, 5, 7)
last — by then the bridges + tests make the big moves routine. `QuoteBuilderBase`
+ `EmbAdapter` (`getPricingService/getTierConfig/getLocationModel/getNudgeTiers/
renderMethodSpecificRow`) crystallize out of clusters 4-7; the shared quote-item
model is task 0.5 and lands with cluster 4.

## Top-level state (46 vars) — future `state.js` inventory

Groups: services (`pricingCalculator`, `quoteService`, `embPersistence`, `embSession`) ·
edit session (`editingQuoteId`, `editingRevision`, `hasChanges`) · logos
(`primaryLogo`, `additionalLogos`, `capPrimaryLogo`, `capAdditionalLogos`, `globalAL`) ·
rows (`products`, `rowCounter`, `productCache`, `childRowMap`) · design search
(`_designSearch*`, `_customerDesignGallery`, `_galleryFilterTimeout`) · push
(`_pushQuoteId`, `_pushAlreadyDone`, `_pushInFlight`) · import (`pendingShopWorksImport`,
`lastImportMetadata`, `pendingDECGItems`, `_spr*`) · caches/constants
(`sizeDetectionCache`, `productColorsCache`, `EMB_DEFAULTS`, `EXTENDED_SIZES`,
`SIZE_TO_SLOT`, `STITCH_DENSITY`, `SIZE06_EXTENDED_SIZES`, `POSITION_*`).

⚠️ Monolith top-level `let`/`const` are LEXICAL globals — visible to other classic
scripts but NOT on `window`, and NOT writable from the bundle. Moving a VARIABLE
therefore means migrating every monolith reference in the same commit (unlike
functions, which bridge via `window`). That's why state moves ride WITH their
cluster, never ahead of it.

## Extraction-#1 learnings + debt (2026-07-07)

- **Generated-markup scan is STEP ONE per cluster, in python** (shell grep quoting mangles the pattern): `re.findall(r'on[a-z]+="([A-Za-z_$][\w$]*)\(', body)` over the cut body — extraction #2's five onSpr handlers were ALL generated-only.
- **Generated-markup handlers**: static caller grep MISSES `onclick="fn()"` built
  inside template strings — scan the extracted body for `on(click|error|…)="` and
  bridge those too (`selectDesignFromSearch`, `showMoreDesignSearchResults`,
  `filterDesignSearchByCompany` were caught only by eslint no-unused-vars).
- **Debt to burn down when this cluster gets typed** (render/state split):
  `design-search.js` carries `// @ts-nocheck` (~45 legacy DOM frictions) and an
  eslint `no-unsanitized/property` file override (13 innerHTML sinks, hand-audited:
  escapeHtml-wrapped or static). Roadmap 1.4 removes the override.
- **For the 1.4 sink audit**: company-chip `onclick` escapes `'` but not `"` inside
  a double-quoted attribute (company names from the design DB) — attribute-injection
  nuance, pre-existing, low severity; fix during 1.4 with proper attr encoding.
- `renderDesignGallery` (dead 1-line alias, zero callers incl. generated markup)
  deleted during the move.

## Tooling

Function/var/handler inventory script (regenerate the map after each cluster):
scratch `emb-map.js` pattern — top-level decl scan + HTML `on*=` handler scan;
flags per fn: window-exported / html-handler / async. Keep runs in the session
scratchpad, only conclusions here.

## After EMB

Repeat SCP (5,409 lines) → DTF (4,086) using the same cluster shapes; shared
behavior graduates from `builders/emb/` into `quote-builder-base.js` (the kept
base) + `builders/shared/` as the second consumer appears (rule of two).
