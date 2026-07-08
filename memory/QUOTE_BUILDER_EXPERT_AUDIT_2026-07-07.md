# Quote Builder EXPERT Audit — 2026-07-07 (EMB / DTF / SCP)

> 5 parallel expert agents (embroidery / DTF / screenprint domain experts + workflow engineer +
> CSS architect), every finding code-verified with file:line. Complements the 2026-07-06 click
> audit ([QUOTE_BUILDER_UX_AUDIT_2026-07.md](QUOTE_BUILDER_UX_AUDIT_2026-07.md)) — nothing here
> re-reports it or the shipped v2026.07.07.x guided-quote work. Full narrative = session
> artifact 2026-07-07; this file = durable actionable core.
> Line numbers = 2026-07-07 (commit 5b12991e); re-grep before editing.
> Abbrev: emb/scp/dtf = shared_components/js/{method}-quote-builder.js · utils = quote-builder-utils.js.

## ✅ IMPLEMENTED same day (2026-07-07, commits 11c592fc → wave-6; ?v=2026.07.07.7; NOT yet deployed)

**~55 of 62 findings FIXED across 6 waves** — all money leaks, trust/copy, endgame,
guided-shell, and CSS/look items below are DONE unless listed here. Unit suite (5,881)
+ both parity suites green; browser-verified EMB/SCP/DTF (shell on, zero console errors).
Bonus fixes found while implementing (not in the audit): share-modal `show()` treated
SCP/DTF's "Updated to Rev N" note as a base URL → broken share link on every update-save;
SCP main service minted `SP{MMDD}-N` (not SPC) — both SCP services now server-sequenced;
DTF `--dtf-primary` fallback + save-path tax fallbacks were still lime/10.1.

**⏳ QUEUED (needs work I couldn't safely do client-side):**
- `emailedAt` stamp on email send — needs a proxy Notes-JSON-merge endpoint (client writes
  would clobber EMB's plain-text Notes; the /accept endpoint is the pattern to copy).
- DTF ship-to autofill from the MO customer record — needs an address field on the
  authed `/api/mo/*` forwarder (verify what the customer endpoint returns first).
- DTF/SCP "Rush +25%" chip — EMB's `getRushRate()` (`RUSH.UnitCost`) is the pattern;
  blocked on Erik defining the BASE the % applies to (EMB uses grand-minus-rush).
- SCP back-only jobs / blanks-in-run — pricing service already builds the 0-color tier
  set; needs engine front-0 contract extension + parity re-runs (deliberate, not quick).
- EMB inline-style extraction (137 attrs) + full invoice-template class pass — mechanical
  but large; drift-guard value only.
- SCP builtin-LTM floor drift (≤47¢) — WON'T FIX: floor matches the deliberate DTG/order-form
  convention (MEMORY.md); making modes foot identically would require reallocating saved
  item prices + push-transformer parity for pennies.

**🧑‍⚖️ POLICY — Erik DECIDED 2026-07-07 (do NOT re-propose):**
- Specialty-ink charges (SCP) + EMB applique chips — **DECLINED** ("we don't need
  specialty ink or applique"). Do not build; do not re-surface.
- DTF customer-supplied press fee (+ transfer-only sales path) — **ON HOLD** per Erik
  ("hold off for now"). Revisit only when he raises it; the DECG pattern + invoice
  customer-supplied tables remain the build plan when he does.
- DECG $50 fee + accepted-quote warn-banner — shipped as implemented; no objection raised.
- Deployed v2026.07.07.7 (Heroku, live-verified) same day.

## 💰 P1 money leaks (Rule 9: any fix → re-run web-quote-cart-parity + quick-quote-parity, verify 3 surfaces)

1. **DTF zero-location quotes save/print/push at garment-only prices** (~35–50% of real).
   `dtf:1554,1609-1614` prices at locationCount=0; save `:2369-2408` / print `:2751` / push gates
   (`utils:1122`) never check locations; only clipboard does (`:3178`). FIX: add
   `selectedLocations.length===0` to save/print alert chain + push checklist. **S**
2. **EMB DECG/DECC $50 LTM computed but never charged** (every ≤7-pc customer-supplied order).
   `embroidery-pricing-service.js:501` returns ltmFee; builder discards: `emb:6340-6351`
   (syncDECGRows), `:6534`, `:7901`, `:9346`. Public DECG calculator DOES charge it. FIX: surface
   as existing LTM fee row for DECG qty≤7 + include in save/push totals. **M**
3. **EMB extra-color surcharge warned, never billed** — badge renders "+$X/pc" (`emb:2530-2532`);
   `extraColorSurcharge` in zero pricing/save paths. FIX: actionable chip → API-priced service
   line (new Service_Codes code). **M**
4. **EMB cap 25K+ design silently downgrades to 8K** — `autoSetStitchTier` (`emb:2734-2744`) sets
   select to nonexistent '25000' → `''` → `parseInt||8000`. Lookup returns MAX across DST variants
   so jacket-back variants trigger routinely; $10/cap AS-CAP Large surcharge vanishes. FIX: clamp
   to '18000' + toast; same in edit-reload mapper (`emb:1346`). **S**
5. **SCP back-location silently $0 when add-location pricing missing** — `scp:3439-3446` `|| 0`
   no warning; sleeves loop `:3452-3469` got drop+toast fix, back didn't; engine hard-throws same
   case. FIX: mirror sleeve droppedProducts+continue. **S**
6. **SCP dark-garment underbase = CSR memory** — builder defaults light (`scp:66`), calculator
   defaults dark (`screenprint-pricing-v2.js:81`) + has unused `darkColors` list; rows know
   COLOR_NAME, nothing cross-checks. $30/location setup under-quote. FIX: non-blocking warn chip
   when dark color names present + toggle off. **M**

## 💰 P2/P3 money + integrity

- **SCP stale SPSU**: `loadServiceCodePrices().then()` calls bare `recalculatePricing()`
  (`scp:1051-1052`) but `printConfig.setupFee` only re-derives in `updatePrintConfig()` (`:156`) —
  label shows live rate, amount charges stale $30. FIX: call updatePrintConfig() there. **S/P2**
- **SCP missing size → M-price fallback** (`scp:3484-3488`); engine refuses same case → parity
  break; drops $2-7/pc ext-size upcharges. FIX: droppedProducts toast, kill `||0`. **S/P2**
- **SCP quote IDs from sessionStorage** — `screenprint-quote-service.js:17-31` + fast-quote
  service = 2 independent SPC counters; same-day cross-CSR collisions → wrong quote at shared
  link. DTF/EMB already on `GET /api/quote-sequence/{prefix}`. FIX: copy DTF impl. **S/P2**
- **DTF sub-minimum under-collects LTM** — clamped `50/10=$5/pc` × actual qty (`dtf:1615,
  1923-1925`): 6 pc collects $30 of $50; engine throws BELOW_MINIMUM. Min "10" hardcoded 3×
  (`:1557,1588,1854`) — derive from lowest tier. FIX: block save/push <10 (or ÷ actual qty). **S/P2**
- **DTF separate-LTM mode self-contradicts on screen** — parent unit stripped vs total inclusive
  (`:1712-1724`); child rows reverse (`:1787-1797`). Money saved OK, screen math visibly wrong.
  FIX: child totals from roundedPrice×qty + "(+$X/pc small-batch)" annotation. **S/P2**
- **SCP builtin-LTM floor drift** — `Math.floor(50/qty·100)/100` (`scp:3386,3500`): builtin
  $49.80 vs separate $50.00 at 30 pc; display toggle changes total. FIX: remainder into last
  line. **S/P3**
- **EMB cap size upcharge in unitPrice but dropped from total** (`embroidery-quote-pricing.js:779-796`). **S/P3**
- **EMB DECG rows tier per-row not pooled** (`emb:6340`) — 15+15 customer pieces price tier 8-23
  not 24-47 (over-charge vs shop reality). FIX: tier by summed same-category DECG qty. **S/P3**
- **DTF legacy discounts vanish on edit-resave** — UI removed 2026-03-23, edit-load writes to
  nonexistent fields (`dtf:526-540`) → 0, silent upward reprice. FIX: blocking toast when
  session.Discount>0 + delete dead code. **S/P3**
- **DTF dead divergent pricing exports** — `DTFQuotePricing.calculateProductPricing/
  calculateQuoteTotals` (`dtf-quote-pricing.js:317-398`) margin the upcharge (forbidden 2XL+
  overcharge), zero callers. FIX: delete + pointer comment. **S/P3**

## 🗣 Trust / copy (customer-facing lies)

- **SCP banner: "$50 fee disappears at 24+" — Caspio charges LTM through 47** (tier 24-47 has
  LTM_Fee:50, fixture-verified). Banner `screenprint-quote-builder.html:252-256`, gate `<24`
  `scp:3771`; stale engine comment `quote-cart-engine.js:685`. FIX: "under 48 pieces" + gate <48.
  SCP-only (DTG/DTF <24 genuinely different). **S/P1**
- **Fabricated PDF quote #s** — SCP reads nonexistent `#quote-id` → `SPC-<epoch>` ALWAYS
  (`scp:4304`); DTF omits lastSavedQuoteId (`dtf:2825`) → fake on fresh saves. EMB fixed same bug
  2026-06-04. FIX: real ID chains; pass null → shared generator prints "DRAFT". **S/P1**
- **Shared invoice pins 10.1%** — `embroidery-quote-invoice.js:8` `taxRate=0.101`; `:1625` labels
  "WA Sales Tax" only when rate==10.1 → correct 10.2 quotes print generic label. ALL 4 builders.
  → escalates the tracked 10.1→10.2 sweep to P1 (now 4+ files). **S/P1**
- DTF size labels read as exact dims (API tiers are "Up to …"); ext-size popup blames garment
  upcharge on "transfers" (`dtf-quote-builder.html:100-146`, `dtf:1429-1431`). **S/P3**
- SCP fallback tier labels pre-June (24-36/37-72/73-144) — `scp:3262-3267` + literals `:3783,4460`. **S/P3**

## 🔁 Endgame / workflow (sync discipline broke down — fixes landed in 1 builder, never propagated)

- **SCP Email = dead end on every NEW quote** — `spcEmailQuote()` reads only `editingQuoteId`
  (`scp:4746`), set only on ?edit= load. Save→Email→"Please save first" loop. DTF fixed same bug
  2026-06-11 (`dtf-quote-page.js:379-381`); EMB pattern = `embEmailQuote()` `emb:13274-13285`
  (save-if-dirty). DTG has own worse variant (`dtg-inline-form.js:4078-4087`). FIX: shared
  `ensureSavedThenEmail()` in utils. **S/P1**
- **SCP/DTF email stale revisions silently** — no dirty check before email (EMB re-saves).
  Customer inbox shows old prices while rep reads new ones. Same shared-helper fix. **S/P1**
- **Share modal has no Email button** (`quote-share-modal.js:36-61`) — save→email = 4
  interactions; shared `emailQuote()` (`utils:1580`) needs only the ID the modal displays. FIX:
  "Email to customer" primary button in modal = all 4 builders at once. **M/P2**
- **DTF/SCP customer lookup never fills ShopWorks Customer #** — DTF `applyContact` fills
  name/email/company only (`dtf:272-274`) yet uses `contact.id_Customer` at `:307`; EMB writes it
  (`emb:1936`). Gates Push; blank → placeholder 3739; typo → wrong customer's order. FIX: 1 line
  apply + clear (verify SCP same gap). **S/P2**
- **Accepted quotes freely editable under accepted URL** — `assertQuoteEditable()` locked set
  excludes 'Accepted' (`utils:950-956`); no builder reads session.Status on edit-load. With
  online deposits live = consent mismatch. FIX: warn banner (not hard-lock). **S-M/P2**
- **Method switch = total start-over** — QQ prefill schema (`utils:1774-1817`) already carries
  style/color/sizes through every builder's add-product path; carries no customer fields, nothing
  serializes rows back out. FIX: "Switch method" menu → prefill handoff (decoration re-entered by
  design). **M/P2**
- **quote-view push button EMB-only** — `quote-view.js:159-162` `startsWith('EMB')`; SCP/DTF push
  endpoints exist. FIX: extend to SPC/DTF. **M/P2**
- **DTF endgame validation = 5 sequential alert()s** (`dtf:2369-2398`, save `:2725`, print
  `:2753`) vs EMB/SCP toast+focus. **S/P2**
- **SCP saves malformed emails** — presence-check only (`scp:4529`); EMB `emb:7831-7835` + DTF
  `dtf:2382-2387` regex-validate; shared `emailQuote()` (`utils:1581`) also presence-only. FIX:
  shared `isValidEmail()`. **S/P2**
- **Invoice customerData drift** — ONE generator, 3 subsets: SCP passes only
  name/company/email/rep (`scp:4273-4278` — PO/phone/project/ship/addresses collected but never
  print) + prints without pre-print recalc (DOM scrape `:4320`); DTF passes `projectName` but
  generator reads `.project` (`embroidery-quote-invoice.js:518`) → never prints; EMB drops notes.
  FIX: shared `buildInvoiceCustomerData()` + SCP pre-print recalc + DTF key rename. **M/P3**
- **No emailedAt anywhere** — `emailQuote()` fire-and-forget; follow-up automation has no data.
  FIX: PATCH Notes JSON `{emailedAt, emailedTo}` (acceptance pattern, no new columns). **M/P3**
- **DTF ship-to 100% typed (~40 keystrokes)** — customer address reachable via existing authed
  `/api/mo/*` forwarder. FIX: "Use customer's address" + "Customer Pickup" chip (auto-fire ZIP tax
  lookup). **M/P3 (trio)**
- **Rush fee = CSR mental math** — typed $ consumed raw (`dtf:2000`); already on CLAUDE.md
  migration list. FIX: "Rush +25%" chip from `getServicePrice('RUSH-PCT',25)` recomputed each
  recalc, typed field = override. **M/P3 (trio)**

## 🧭 Guided shell follow-ups (shipped 2026-07-07 — being watched)

- **Validation focuses display:none fields** — save focuses `#customer-name` hidden on steps 1/2
  (silent no-op); push-checklist click-to-jump focuses BEFORE guided's step switcher
  (`utils:1066-1097` vs `quote-builder-guided.js:208-215`). FIX: export
  `window.guidedRevealField(id)`; call from both. **S-M/P2**
- **New Quote leaves shell on step 4** — `resetQuote()`/`confirmNewQuote()` (`utils:1178-1186`)
  never call `window.guidedGoToStep` (guided:251, no-ops when off). FIX: 1 line. **S/P2**
- **Sticky bar pins to phantom header** — `quote-builder-guided.css:22` `top:66px` but no builder
  header is sticky → 66px dead gap; thead pins 0, sidebar 8px. FIX: `top:8px`. **S/P2**
- **Guided CSS ships retired lime + phantoms** — done-state `#4cb354` (:65); step numbers
  white-on-#d5d9d2 ≈1.7:1 (:56); `--pnw-forest-tint` defined nowhere (:69); several fallbacks lie
  about token values; shell.css phantom `--qb-surface-1/--qb-text*` (:579-614). **S/P2**
- **stepDone under-reports** — always false for Decoration/Review; recomputed only in goToStep;
  step-2 "done" ignores Customer # that Push needs. FIX: per-builder doneFn + debounced refresh. **M/P3**
- **EMB services bar stranded in step 1** while step 2 = Logos (`quote-builder-guided.js:36-44`;
  bar = `#emb-services-bar` in `.product-grid-section`). FIX: `move:` entry into Logos step. **M/P3**
- **Panels change width guided↔workbench** — `.guided-moved max-width:560px` + `!important` vs
  inline negative-margin hacks (guided-css:137-158). **S-M/P3**

## 🎨 Look (CSS) — headline: PNW shell NEVER SWITCHED ON

- **`body.qb-shell-body` = ZERO adopters repo-wide** (delivers Inter + tnum + birch bg;
  `quote-builder-shell.css:142`); `.qb-card/.qb-button` zero usage; trio doesn't load Inter (DTG
  does, `dtg-quote-builder.html:9`). Only the token-alias layer took effect. FIX: Inter link +
  class on 3 bodies (+ eyeball hour; escape hatch: background-image:none). **S/P1**
- **Print artifacts = retired lime at 8-9px** — `quote-print.css` 100% raw hex, `#4cb354`×8;
  `embroidery-quote-invoice.js` 8 lime refs + td 9px + breakdowns 8px (backs printQuote all 4).
  FIX: forest ramp + 9→10.5px / 8→9px / grand 16→18px. **S-M/P1**
- **Color picker = 3 brands** — `color-picker-shared.css:95` falls to bootstrap blue;
  `--primary-color` only defined by sticker-pricing-page.css (lime) which EMB loads; theme
  overrides target STALE body classes (only DTF's matches). Net: EMB lime / SCP blue / DTF
  forest. FIX ~6 lines. **S/P1**
- **Money not privileged** — `.cell-price/.cell-total` 13px = description size; tabular-nums
  missing on all product-table money cells; qty cells on legacy BLUE; grand totals 20/18/17px
  (common:588-609, 2361-2378, 3673-3678). FIX: small common.css block. **S/P1**
- **4 focus-ring systems** — global forest; dead royal-blue (common:1932); EMB navy glow on
  forest border (emb-extracted:321-326) + sky :1569 + indigo :2339; 10× stale lime-tint rgba.
  FIX: standardize on `--pnw-glow-focus`. **M/P2**
- **Customer panel hero input = hardcoded lime** `!important` (common:678,685) + inline lime
  icons (dtf:524, scp:535) + EMB manual fields fully inline-styled #ddd/12px. **S/P2**
- **`.al-btn.has-al` blue in EMB, green in SCP** (emb-extracted:1025-1043 vs scp-extracted:
  383-409, byte-similar) — promote once into common.css w/ info-state tokens. **S/P2**
- **`page-break-inside:avoid` on WHOLE tables** (quote-print.css:794-805 + invoice:145,384) —
  12+ item quotes push entire table to p2. FIX: protect `tr` only. **S/P2**
- **DTF odds**: dead fee-row override → slate-on-amber (dtf:1778-1794 delete); `.extended-col`
  slate #374151 (:691); navy CTAs (:659,1557); location moss text ≈3.1:1 AA fail + lying blue
  fallbacks (:1612-1628). **S/P3**
- **Density**: trio cells 40px vs DTG 36px (common:504); pinned chrome at 0/8/66px. **S/P3**
- **Inline style attrs = why drift survives sweeps**: EMB 137 + SCP 79 + DTF 73 + invoice
  templates 99. Token-drift counts: common.css 455 raw hex / emb-extracted 397 / dtf 106 /
  scp 41 / print 72. Biggest single win = tokenize common.css. **M/P3**

## 🏭 Domain gaps (policy → build)

- **EMB digitizing invisible + dual source** — checkboxes permanently inline `display:none`
  (html:158,249, no unhide anywhere); no prompt when logo has no design # (=new logo); engine
  charges `Embroidery_Costs.DigitizingFee` (emb-quote-pricing:154) vs DD chip
  `Service_Codes['DD']` (emb:3694) — can diverge; static "$100" labels update from neither. **M/P2**
- **EMB FB design-tier pricing import-only** — `fbPriceTiers` set only in import flow
  (`emb:9636-9703,10305`); manual lookup never populates → formula fallback; same design, two
  prices by quote origin. **M/P2**
- **EMB monogram = no name capture** — names only via SW-import notes append (`emb:11902-11911`).
  FIX: textarea on chip-add → qty + notes + item description. **M/P2**
- **EMB primary-position missing sleeves/nape** — html:136-141 (engine already supports LS/RS/BY
  abbrevs). 3 `<option>`s, zero pricing risk. **S/P3**
- **DTF size location-locked** — `buildTransferSizes` hardcodes exactly 3 sizes + literal sizeMap
  (`dtf-pricing-service.js:218-262`) → new Caspio size rows silently dropped, no oversize, no
  per-location override. FIX: per-location dropdown + data-driven off distinct cost.size. **M/P2**
- **DTF no customer-supplied / transfer-only path** — hard block "No garment cost"
  (`dtf-quote-page.js:695-701`); only escape = hidden staff `?manualCost=`. EMB has DECG; invoice
  already renders customer-supplied table. Needs press-fee Service_Code from Erik. **M-L/P3**
- **DTF no heat-sensitive warn** — nylon/rain/packable keyword non-blocking toast (reuse
  cap-filter pattern `dtf-quote-products.js:49-58`). **S/P3**
- **SCP no back-only / blanks-in-run** — front forced ≥1 color (html:112-134) while service
  already builds `primaryLocationPricing['0']` (scp-pricing-service:447-469) UI can't reach;
  back-only faked as Full Front = wrong panel on paperwork. Engine rejects front 0
  (`quote-cart-engine.js:581-583`) — extend adapter + parity suites. **M/P2**
- **SCP specialty inks** — zero puff/metallic/discharge/poly path; only per-piece adder =
  SP-STRIPE. Erik decision: if charged → Service_Codes chips (SP-PUFF, SP-POLY…). Reorder/SPRESET
  deliberately excluded (Erik 2026-06-27) — do NOT re-add. **M/P3**
- **EMB dead code documented Active** — `embroidery-quote-logos.js` + `embroidery-quote-products.js`
  zero script refs, older ruleset, ACTIVE_FILES.md says ✅ Active. Flag for archive (house
  process), fix ACTIVE_FILES + GUIDE. **S/P3**

## 📋 Suggested order

**Week-1 punch list (S):** SCP email fix · PDF quote #s · SCP banner <48 · SCP $0-back guard ·
SPSU reprice · SCP server quote-sequence · DTF zero-location gate · DTF customer# autofill · DTF
child-row total · EMB cap clamp · EMB sleeve options · EMB digitizing unhide · shared
email-guard/validate · guided reset + sticky/colors · color-picker chrome · shell switch-on ·
print rebrand · invoice tax label (fold into 10.2 sweep → P1).
**Sprint 2 (M):** share-modal Email btn · DECG LTM + extra-color chip · dark-garment nudge ·
money typography + focus rings + al-btn/fee promotion · method-switch handoff · accepted banner +
quote-view SPC/DTF push · invoice data unification · DTF size dropdown.
**Erik decisions first:** specialty-ink/applique charging rates · DTF press-fee (customer-supplied
+ transfer-only) · accepted-quote warn vs lock · confirm DECG $50 applies ≤7.

## Doc corrections applied 2026-07-07 (this audit)

- `.claude/rules/quote-builders.md` + auto-memory MEMORY.md: SCP nudge tiers were stale
  24/37/73/145 → **24/48/72/145** (2026-06-19 remap, `utils:1631-1636`); LTM $50 applies through
  the 24-47 tier (not <24-only).
