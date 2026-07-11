# Order Form — Architecture Review (2026-06-09)

> **RETIRED 2026-07-11** — the `pages/order-form/` app this review analyzed was DELETED (dashboard buttons + code + drafts/approve/share routes; git history has it all). `/api/submit-order-form` survives for the DTG builder push. Historical reference only.

> Multi-agent review (8 deep-readers + 6 expert lenses + synthesis, ~1.8M tokens) of the
> `pages/order-form/` React app. Workflow run `wf_0aaf97bb-508`. This is the durable plan;
> execute from the phased plan below. Verdict grade: **C** across every lens.

## Headline verdict

The order form is the **best-documented, worst-founded app in the repo**. It ticks every *surface*
rule (no inline code, kebab-case external files, ACTIVE_FILES.md current, fees from Caspio
Service_Codes) but violates the rules that actually prevent **money bugs**:

- **Pricing parity with the quote builders is asserted, not enforced** — ZERO order-form pricing
  tests exist (CLAUDE.md Rule #7 unmet), and the form **re-implements** the final per-piece
  assembly for EMB/SCP/DTG instead of calling the builder calculators. This has already produced a
  **confirmed live overcharge** + 2 more drifts.
- The product idea is RIGHT and the bones are good (shared pricing engines, one breakdown object,
  solid ShopWorks push). It's a prototype foundation that was never hardened.

## Scorecard

| Lens | Grade | One-line |
|---|---|---|
| UX & speed of entry | C | Drag-drop is the WRONG primary model; the spreadsheet grid (right model) is ~80% built |
| Frontend architecture & build | D | Ships React **dev** build + 3MB Babel, compiles ~9.4K lines of JSX in-browser every load |
| CSS architecture | C | Good OKLCH token base, but 4 different "greens", own design system separate from builders, ~400-500 dead lines |
| Calculation correctness & parity | C | 5/6 methods reuse the right engines, but re-implemented assembly → **confirmed SCP overcharge** + no parity test |
| Print/PDF & ShopWorks push | C | Push is the strongest part; PrintSheet **silently truncates orders >14 lines** |
| Maintainability & repo fit | C | Surface hygiene great; foundation (no build, no parity test, re-implemented math) is real debt |

## ✅ Phase 0 + initial Phase 1 — DONE & VERIFIED (2026-06-09)

`scripts/capture-order-form-baselines.js` (`npm run capture:order-form-parity`) is the redesign safety
net. **It compares the order form against the LIVE quote page, NOT a stored baseline.** It loads the
order-form page (which already loads every `{method}-pricing-service.js` the builders use) and, on the
same page at the same moment, computes BOTH (a) the live quote-page price via the builder's own
`PAGE_RUNNERS` (reused from `capture-pricing-baselines.js`) and (b) the order-form price via
`priceForm()`, then diffs them. Live-vs-live = a legitimate Caspio price change can NEVER cause a false
fail. The order form is driven via `formCtx.decoConfig` (same `priceRow` math as the drag-rail).

⚠️ **Why live-vs-live (lesson):** the FIRST version diffed against `baselines.locked.json` (signed
2026-05-23) and reported DTG "over-charging" +$0.50–$1.50/pc. **FALSE ALARM** — the DTG margin
denominator in Caspio changed to 0.53 since the lock, so the live DTG quote page now returns the
HIGHER price too; the order form already matched it. The locked file was just stale. A parity test
must compare the two surfaces against each other, not against a months-old snapshot. (The locked
baseline is for a *different* question — has the quote page drifted from Erik's signed prices — and is
itself now stale for DTG; flag for re-capture + re-sign.)

**FINAL verified verdict (order form ↔ LIVE quote page):**
- **SCP-01..05 → 5/5 PASS.** Standard screen print prices identically to the quote page.
- **DTG-01..05 → 5/5 PASS.** Order form matches the live DTG quote page. (NOT over-charging — the
  earlier "+$108" claim was the stale-baseline false alarm, now retracted.)
- **SCP underbase → FIXED + locked green** (was +$2.50/pc; adversarial `SCP-ADV-UB` flipped red→green).

**Fixes landed this session (local, harness-verified, NOT yet deployed):**
1. **SCP underbase per-piece overcharge — FIXED.** `screenprint.jsx:180` now prices the per-piece on
   RAW front colors (`frontEffective = loc.front`), matching the live builder (`:3093`). The old
   `front + underbase` folded a full color-step into the per-piece (× qty). ⚠️ **Follow-up:** the
   underbase's legitimate +1 *setup screen* (flat $30 in the builder) is NOT yet charged by the order
   form — SCP setup fees (SPSU) are a separate, manually-dragged add-on with no auto screen-count.
   Until SCP setup-fee parity lands, underbase has NO price effect in the order form (under by $30 flat
   vs the prior over by $2.50/pc — net better, per-piece now exact, but flagged).
2. **DTG re-implementation drift — FIXED (robustness).** `dtg.jsx priceForLocationCombo` now delegates
   to `DTGPricingService.calculateAllTierPricesForLocation` (Math.min garment base + same rounding +
   combo split + LTM-cost fallback) instead of re-deriving. Verified neutral (5/5) and removes the
   latent S/first-vs-Math.min base bug for products where S isn't the cheapest size. One code path now.

**Coverage extended to all 4 methods + CI-gated (2026-06-09):** harness now covers **SCP 5/5, DTG 5/5,
DTF 5/5, EMB standard 3/3 (EMB-01/02/07) + the underbase adversarial = 19 scenarios, 0 mismatches.**
DTF confirmed clean (delegates to `DTFPricingService`); EMB standard-garment locked. Wrapped in a jest
gate `tests/integration/order-form-parity.test.js` (`npm run test:order-form-parity`, PASS) that fails
the build on any divergence (soft-skips with no local server; CI=1 spawns its own). **EMB-03/04/05/06
SKIPPED with reasons** (order form has no AL / Full-Back-DECG / structured-cap / beanie path — real
coverage gaps to close in the redesign, not failures).

Pending coverage: wire the EMB AL/Full-Back/cap/beanie paths (then un-skip those scenarios); DTG
S-not-min adversarial scenario; re-capture+re-sign the stale DTG locked baseline.

## ✅ Session 2 — parallel work (2026-06-09), all verified

Ran 3 streams concurrently on disjoint files (2 background agents + my foreground), then re-ran the
parity gate (19/19 green — no pricing regression) + a live preview behavior test. All LOCAL, not deployed.

- **Print P0 (data loss) — FIXED.** `print-sheet.jsx` removed the `.slice(0,14)` truncation + hard
  14-row pad (now a computed `MIN_BLANK_ROWS` minimum that only pads UP); `print.css` gained real
  multi-page rules (`.ps-table thead{display:table-header-group}` repeats column headers per page;
  `break-inside:avoid` on rows + `.ps-totals`/`.ps-footer`/`.ps-design-row`/`.ps-sig*`). A 30-line
  order now prints every line across pages instead of silently dropping rows 15+.
- **Tax visibility — FIXED (partial).** `shared.js resolveTaxContext` now sets `rateIsDefault:true`
  when the in-WA 0.101 Milton fallback drove the rate; `registry.js` stamps `taxRateIsDefault`;
  `totals.jsx` shows a non-blocking "⚠ Using 10.1% Milton default rate — verify destination tax rate"
  (reuses existing `tp-note tp-note--err` classes, no styles.css touch). `server.js buildOrderNote`
  exempt branch now emits "Tax Account: 2204 — Tax Exempt". NO tax numbers/logic changed (parity gate
  still green). STILL OPEN: a live DOR/ZIP destination-rate lookup (warning is the interim), and the
  wholesale toggle UI (the 2203 branch is reachable in logic but nothing sets `info.isWholesale` yet).
- **UX redesign — keyboard-first grid nav (first feature).** `paper-form.jsx` `gridKeyNav` + the
  size-cell `data-cell-size`/`onKeyDown` wiring: ArrowDown/Enter move DOWN the same size column to the
  next product row, ArrowUp moves up (Tab still moves across) — spreadsheet-style fast entry, no mouse.
  Live preview behavior test PASSED (down/enter/up all move focus; top-row boundary is a safe no-op;
  zero console errors). Fail-safe progressive enhancement (rep can still Tab/click as before).

## ✅ Session 3 — push + PDF end-to-end, VERIFIED (2026-06-09)

Goal: "can push to ShopWorks + print a nice PDF." Both verified. All LOCAL, not deployed.

- **Money-safety $0-fee guard (P0) — DONE.** `shared.js applyAddOnsToBreakdown` now (a) records every
  resolved fee in `breakdown.fees[]` (single source: totals panel, PDF, CAV, push), and (b) pushes a
  `breakdown.errors` entry when a fee code doesn't resolve (missing Service_Code) or a TIERED rate is
  $0 on a cold cache — instead of silently `continue`. `paper-form.jsx submit()` now BLOCKS the push
  with the specific reason when `breakdown.errors` is non-empty. No more silent dropped/$0 fee.
- **PUSH verified LIVE 2026-06-09** — real submit (`window.nwOrderAPI.submitOrder`, no dryRun) created
  **OF-0058** in ManageOrders (`ok:true, mode:live`), persisted in quote_sessions (Company "ZZZ TEST -
  VOID", $580). Proves the order form sends an order to ShopWorks end-to-end (converts to SW on the
  next MO→SW sync; conversion path itself was verified OF-0057 prior). **Erik to void/delete OF-0058.**
  **Date-normalizer DEPLOYED v2026.06.09.7 / Heroku v1308** (`server.js toISODate` → orderDate/
  requestedShipDate always YYYY-MM-DD). OF-0058's `date_OrderPlaced "undefined/undefined/06/09/2026"`
  was a TEST-SCRIPT artifact (hardcoded MM/DD/YYYY; the real `<input type=date>` form emits YYYY-MM-DD
  → always correct). Fix proven live (dry-run MM/DD/YYYY→`2026-06-09`) + 2nd test order **OF-0059**
  (deployed build, MM/DD/YYYY input → clean date). **Erik to delete OF-0058 + OF-0059.** Deploy-skill
  `.jsx` cache-bust + basename-collision fix also shipped in v1308.
  Also **actual `@media print` PDF** rendered + viewed: clean, complete, fee itemized, totals foot,
  correct tier-split SW part numbers (single-page proven; multi-page = cap removed + `break-inside`
  CSS present, structurally guaranteed, not eyeballed). Safety-classifier note: a live push is gated
  as a production write — needs explicit per-action authorization.
- **PUSH payload also verified via dry-run** (`POST /api/submit-order-form?dryRun=1` — builds the full ManageOrders
  payload, no live order). Confirmed across THREE tax scenarios: **taxable in-WA** (4 garment lines w/
  base PN `PC54` + size for SW Size-Translation, fee LinesOE `DD $100` + `RUSH $136.50`=25%; Notes On
  Order "Tax Rate 10.10% / Tax Amount / Total / Tax Account 2200.101 / Apply Manually"; Production +
  Purchasing notes; idOrderType 21; extSource NWCA-OrderForm; terms Prepaid; TaxTotal 0 by design),
  **exempt** ("Tax Account: 2204 — Tax Exempt" ✓ — the Session-2 tax fix), **wholesale** ("2203" ✓).
- **PDF verified** (live preview render of a populated order: 24× PC54 @ $20 + $100 digitizing fee).
  PrintSheet now **itemizes `breakdown.fees[]`** (dim rows before Subtotal) so garment lines ($480) +
  fee ($100) = Subtotal ($580) → tax $58.58 → Total $638.58 → 50% deposit $319.29, all footing. Clean
  one-page paper layout (header/info/deco-checkboxes/table/totals/ship/design/signature) screenshot-
  confirmed. (Before: the $100 fee was invisible → subtotal looked $100 off.) Print P0 (multi-page,
  no truncation) from Session 2 still in place.
- ⚠️ GOTCHA (lesson): the running `node server.js` does NOT hot-reload — a `server.js` edit (the
  exempt-2204 note) only showed in the dry-run AFTER a server restart. Browser JSX re-compiles per
  load (so the parity gate/preview see frontend edits live), but API/server.js changes need a restart
  to verify. Restart the dev server before testing any server.js change.

STILL OPEN (next, parity gate + money-guard cover the redesign): wholesale toggle UI + live DOR tax
lookup (logic ready, warning is interim); SCP setup-fee parity (auto-SPSU incl. underbase $30);
year-safe `OF-YYYY-NNNN` ExtOrderID (risky cross-cutting rename — deferred); EMB AL/Full-Back/cap/
beanie pricing paths; build step (esbuild → kill in-browser Babel/dev-React); deeper UX (type-to-add
services, duplicate-last-order/templates, demote drag).

## 🚨 Confirmed money / data bugs (fix regardless of any redesign)

| # | Pri | Bug | Evidence | Fix |
|---|---|---|---|---|
| 1 | **✅ FIXED 2026-06-09** | **SCP dark-garment per-piece OVERCHARGE — FIXED + harness-locked** (`screenprint.jsx:180` now `frontEffective = loc.front`; adversarial `SCP-ADV-UB` green). Follow-up: underbase +1 setup screen ($30) via SCP setup-fee parity. ~~CONFIRMED AT SOURCE 2026-06-09.~~ White underbase folded into the per-piece PRICE; live SCP builder charges it only as a setup-fee screen. Every dark-garment screenprint order quotes higher than the calculator. **Verified:** builder `frontScreens = frontColors+1` feeds ONLY `totalScreens→setupFee` (`screenprint-quote-builder.js:109-122`); per-piece lookup uses RAW `printConfig.frontColors` (`:3093-3094`). Order form uses `front+underbase` for the per-piece `primaryLocationPricing[frontKey]` lookup (`screenprint.jsx:180`). The order-form comment "same convention as quote builder" is FALSE. | `screenprint.jsx:180` vs `screenprint-quote-builder.js:109-122,3093` | **Two halves:** (a) per-piece lookup uses RAW `loc.front`; (b) underbase adds +1 screen to the SPSU setup fee (today the order form charges NO underbase setup screen — removing it from per-piece without adding the setup screen would under-charge setup). Land WITH the parity test. |
| 2 | **P0** | **Silent $0 fees.** `/api/service-codes` down → `[]` → fee silently contributes $0, no banner, no `breakdown.errors`. TIERED cold-cache also resolves unit=0 silently. Violates Erik's #1 rule. | `service-codes.js:75`; `shared.js:279-280` (`if(!sc) continue`); `shared.js:221-224` | Push to `breakdown.errors` + block submit; never `continue` |
| 3 | **P0** | **PDF silently truncates orders > 14 lines.** Tier-splitting means ~5 multi-size styles exceed the cap; lines 15+ vanish from the printed sheet the floor produces from / customer is billed against. | `print-sheet.jsx:82-83,202` (`.slice(0,14)`) | Remove cap; add multi-page print CSS (`thead{display:table-header-group}`, `break-inside:avoid`) |
| 4 | **P0** | **No parity test (Rule #7 unmet).** Nothing references `window.OrderFormPricing`. Every drift above is what a parity test catches at commit time. | no `tests/unit/order-form*.js` | `tests/unit/order-form-parity.test.js` vs the 22 locked baselines |
| 5 | **P1** | **In-WA tax ALWAYS 10.1%.** Nothing ever populates `ship.taxRate`, so every in-WA order falls to hardcoded `WA_TAX_RATE=0.101` (Seattle/Tacoma/Spokane under/over-taxed on total + deposit). | `shared.js:137-138`; ship state lacks taxRate | DOR/ZIP rate lookup → `ship.taxRate`, or at minimum a visible "using 10.1% Milton default — verify" warning |
| 6 | **P1** | **Wholesale never untaxed.** `info.isWholesale` is read but never assigned anywhere — the 2203 branch is dead UI; wholesale customers taxed at 10.1%. | `shared.js:124`; `CompanyCombobox.onPick` maps only `isTaxExempt` | Map wholesale flag in `onPick` or add a manual toggle |
| 7 | **✅ NOT A BUG (refactored) 2026-06-09** | **DTG does NOT over-charge — earlier "+$108" was a STALE-BASELINE false alarm** (live-vs-live harness shows DTG 5/5 match the quote page). Still **refactored** `dtg.jsx priceForLocationCombo` → delegates to `DTGPricingService.calculateAllTierPricesForLocation` (one code path, removes future drift + the latent S/first-vs-Math.min base bug). Verified neutral (5/5 green). | `dtg.jsx:169-198` now calls `DTGPricingService.calculateAllTierPricesForLocation` | Done. (The locked DTG baseline is stale — Caspio margin 0.53 — re-capture+re-sign.) |
| 8 | **P1** | **ExtOrderID `OF-NNNN` not year-safe** — counter resets Jan 1, no year segment → `OF-0001` collides across years, corrupts quote_sessions / quote-view / AR joins. | `server.js:2293-2305` | Route through `buildExtOrderID` → `OF-2026-NNNN`; update `^OF-\d+$` matchers (`shopworks.js:198`, `server.js:2365/3454`) |

P2: EMB has NO Additional-Logo / 3D-puff / laser-patch path (can't match builder for multi-logo/specialty EMB — the ~80% method); emblem `$100`/`$50` hardcoded (not in Caspio); DTF reads `method=DTF` upcharges while builder uses `method=BLANK` (extended-size drift risk); SCP LTM not floored to cents + has a sleeve location the builder lacks; 3 duplicated add-on scope tables that already disagree; exempt note omits `Tax Account: 2204`; per-row add-on codes append with no dedupe (double-charge); customer Print renders the staff sheet not the approval card.

## What's genuinely good (keep)

- **5/6 methods call the same `{method}-pricing-service.js` engines** the calculators use (DTF is exemplary — fully delegates, errors loudly, no silent $0).
- **One `breakdown` object** is the money source of truth → screen, PrintSheet, and push read the identical object (order-level totals can't easily diverge).
- **Tax decision tree is structurally correct** (`resolveTaxContext` shared.js:119-146: wholesale→2203 / exempt→2204 / OOS→2202 / in-WA→rate, single-pass, no compounding).
- **ShopWorks push is the strongest part** — base part numbers (lets SW Size Translation Table append `_2X`/`_3XL`), hard-blocks $0 lines, tax account carried in order note (TaxTotal=0 by design), multiple non-silent guards.
- **The spreadsheet row grid** (`paper-form.jsx:1885`) is the correct fast-entry core — build v2 ON it.
- Repo hygiene (no inline, kebab-case, ACTIVE_FILES current, fees from Service_Codes). A **22-scenario signed pricing baseline already exists** (`tests/pricing-baselines/baselines.locked.json`) — raw material for the missing parity test.

## Direct answers to Erik's questions

- **Is drag-and-drop the right layout/model?** No. The rail framing ("Drag services →") pushes reps
  onto the *slower* path: it only adds fees/add-ons (never garment/color/sizes/logo), costs a drag
  PLUS 2 post-drop edits (slower than the old 3-click modal), and has silent double-charge/mis-scope
  failure modes. **v2 = keyboard-first spreadsheet grid + a single "type-to-add" service command that
  collects all params at add-time + "Duplicate last order for this customer"/templates** (the single
  biggest real-world speed win: ~2 min → ~15 s for repeat accounts). Drag demoted to optional.
- **Is there better CSS?** Yes, incremental not rewrite. The OKLCH token base is good — keep it. But:
  extract ONE shared `shared_components/css/nwca-tokens.css` (one brand green, ink ramp, `--z-*` scale)
  consumed by BOTH the order form AND the quote builders; fix/delete ~7 phantom tokens (3 no-fallback
  `--surface-2` uses = silent dead hovers at `styles.css:1678,2537,2619`); delete ~400-500 lines of
  self-admitted dead CSS; adopt the `--z-*` scale (three layers collide at z-index:1000). Keep
  screen/paper/print/approval as 4 separate LAYOUT files but make all 4 consume the shared tokens.
- **Is the build the right way?** No. Add `esbuild` precompile (one npm script) → committed external
  `.js`, swap CDN dev-React → `production.min`, delete `@babel/standalone`. Keeps the no-bundler
  Heroku/express.static model; removes the dominant perf liability; unblocks splitting the 2,662-line
  `paper-form.jsx`.

## Target architecture (5 axes)

1. **BUILD**: esbuild `build:order-form` → committed kebab-case `.js`; `react.production.min` (pin one version — resolve installed-19-vs-running-18); wire into deploy pre-flight as a syntax gate.
2. **PRICING SINGLE SOURCE**: stop re-implementing per-piece assembly in JSX — route EMB/SCP/DTG through the SAME assembly the live builders use (like DTF already does); migrate emblem to Caspio.
3. **CSS SINGLE SOURCE FOR LOOK**: one shared `nwca-tokens.css`; keep 4 layout files, all consuming it.
4. **PRINT/TOTAL SINGLE SOURCE**: extract `buildPrintLines` / one `usd()` / `orderGrandTotal(breakdown)` (itemizing fees) into `window.OrderFormPricingShared`; route screen + PrintSheet + CAV through them; add multi-page print CSS; remove the 14-row cap.
5. **NO SILENT FALLBACKS**: unresolved Service_Code / cold-cache $0 / tax-rate fallback all surface a visible warning (and fees block submit).

## Phased plan (each ships independently)

- **Phase 0 — Lock parity (1-2 d).** `order-form-parity.test.js` runs all 22 baselines through `priceForm()` + adversarial cases (SCP dark 4-color, SCP qty=7 LTM floor, DTG S-not-min, DTF 2XL/3XL) + tax-tree assertions. Wire into the pricing-baseline CI gate. **Makes every later fix safe; would have caught the SCP overcharge.**
- **Phase 1 — Money bugs + no-silent-failure (2-3 d, P0).** Fix SCP underbase; make unresolved Service_Codes / cold-cache $0 push to `breakdown.errors` + block submit. Each turns a baseline green. Deploy.
- **Phase 2 — Print correctness (1-2 d, P0).** Remove 14-row cap; multi-page print.css; `order-form-print.test.js` (>14-line order renders all lines; PrintSheet==CAV==screen on a fee order). Deploy.
- **Phase 3 — Tax + year-safe IDs (2-3 d, P1).** In-WA rate warning (+ DOR/ZIP lookup if feasible); wholesale flag in `onPick`; `Tax Account: 2204` in exempt note; OF IDs via `buildExtOrderID`. Deploy.
- **Phase 4 — Build step (2-3 d, P1).** esbuild + production-min React + delete Babel; wire into deploy pre-flight. Prereq for safe decomposition + big perf win. Deploy.
- **Phase 5 — Parity structural (~1 wk).** DTG→service, EMB/SCP→builder assembly, verify DTF `method=DTF` vs `BLANK`, emblem→Caspio, wire AL/3D-puff EMB + scenarios.
- **Phase 6 — UX speed v2 (1-2 wk).** Duplicate-order/templates, full keyboard grid nav, single type-to-add command; demote drag, drop "Drag services →", consolidate 3 scope tables, dedupe/ live-qty add-ons.
- **Phase 7 — Debt cleanup (ongoing).** Decompose `paper-form.jsx`; shared print/total helper; `nwca-tokens.css` + delete dead CSS + phantom tokens; ESM convert (drop window-setter leak); localStorage autosave (toolbar says "Auto-saves locally" but it does NOT — data-loss risk); decide tablet scope.

## Regression tests to add

- `tests/unit/order-form-parity.test.js` — 22 locked baselines through `window.OrderFormPricing.priceForm()`; assert tier, per-size `byRow.unitPriceBySize`, subtotal, ltmTotal == baselines. Adversarial: SCP dark 4-color (underbase), SCP qty=7 LTM (=7.14 floored), DTG S-not-min, DTF 2XL/3XL.
- Tax-context: `resolveTaxContext` → 2203 / 2204 / 2202 / in-WA for matching inputs (covers the dead 2203 branch).
- `tests/unit/order-form-print.test.js` — >14-line order renders all lines; PrintSheet==CAV==screen total on a fee order; `breakdown.fees[]` appear as printed rows.
- Push parity: server-read per-line price == on-screen per-size unit; $0 line hard-fails the submit guard.

## Decisions made (2026-06-09)

- **APPROACH (Q6) — Erik approved a FULL redesign** of the order form, with ONE hard constraint:
  **prices must come out correctly, matching the quote pages (builders).** Chosen strategy:
  **rebuild the experience (UX) + the build, KEEP the engine** (pricing services, ShopWorks push,
  tax tree, breakdown object, save/load) — and **lock parity with a test FIRST** so the redesign
  can't drift prices. Not a from-scratch rewrite (would re-introduce solved bugs).
- **SCP canonical (Q1) — RESOLVED by Erik's constraint + source verification.** Prices must match
  the quote pages → the **live SCP quote builder is canonical**. Confirmed at source that the order
  form over-charges dark-garment SCP. Fix the order form to match the builder (see P0 #1).

## Open questions for Erik (still need answers, but don't block Phase 0)
2. **Device** — do reps quote from an iPad/tablet on-site, or laptop/desktop only? Decides tablet reflow + touch-target + how hard we keep drag.
3. **Shipping fee** — should the order form ever charge freight (folded into the WA tax base like DTG/DTF/SCP), or is shipping intentionally never charged here? `ship.fee` is never populated today.
4. **Live tax lookup** — wire a DOR/ZIP destination-rate lookup, or accept 10.1% Milton default + a visible "verify destination rate" warning?
5. **Tax-exempt/wholesale without a CRM match** — can a rep mark a customer exempt/wholesale when there's no CRM record? Today exemption is set only from the CRM record; wholesale never.
6. **Priority** — money/tax/print correctness fixes first, or the v2 keyboard/templates UX redesign (biggest rep-time win) as a separate project?
7. **Customer print** — should an approving customer print the polished approval card (CAV), or is the dense staff PrintSheet the single canonical print for everyone?
