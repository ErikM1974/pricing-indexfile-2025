# Quick Quote — Screen-Print Section Review + Redesign Plan (2026-06-23)

> 11-agent deep dive (8 reviewers + skeptic + completeness + synthesis). Scope: the SCP section of
> `calculators/quick-quote/`. Verdict: **pricing-safe but UI-limited; one real over-quoting bug.**
> Everything below is UI-only on the shared engine (Rule 9) unless flagged [NEEDS BACKEND].
>
> ## ✅ BUILT 2026-06-23 (on preview port 3010, NOT yet deployed) — both MUSTs + all SHOULDs
> Files: `calculators/quick-quote/{quick-quote.js,index.html,quick-quote.css}` only. UI-only; no engine/Caspio change.
> - **MUST front/back ink split**: `state.frontInk`/`state.backInk` (was single `state.ink`); HTML two steppers (`#qqInkFront`/`#qqInkBack`, back-wrap shows only on back placement); groups send them independently. **PROVEN**: PC61 q24 front+back, 3-front+1-back = **$23.08/pc** vs 3-front+3-back = **$24.58/pc** (old UI forced 3+3 → overcharged $1.50/pc).
> - **MUST two-section breakdown**: `buildOneTime()` renders screen setup as its OWN "One-time setup · per order, not per piece" block below the parity-guarded per-piece rows (which get a "Per piece" header when one-time exists). Setup never enters the per-piece sum (would trip the guard).
> - **SHOULD** dark garment moved inline (`#qqScpOptsField`, out of the old `<details>`); config chip "Front 3c + Back 1c" when counts differ (collapses to "3-color · front+back" when equal); breakdown rows labelled "Left chest — 3 color"/"Full back — 1 color"; explainer note "each color = 1 screen ($30 setup); back prices on its own"; auto-suggest dark from color name (`isDarkGarment()`/`maybeSuggestDark()`, never forces — `state.scpDarkUserSet` locks a manual choice). **PROVEN**: Deep Marine→on, Natural→off, manual check survives color change.
> - **Verified**: 77 parity tests green (default equal-count path unchanged); no console parity-off; all 4 method cards render clean (only SCP two-section). New guard idea: front/back-ink scenario. **NEXT: deploy** (`/deploy`) — staff-only tool, lower risk; then MEMORY.md one-liner.

## The 3 real problems
1. **#1 (CORRECTNESS) — single shared front+back ink count.** `quick-quote.js:192-193` sends `frontColors: state.ink` and `backColors: scpLocCount()>=2 ? state.ink : 0` — so a front+back job forces BOTH locations to the same count. A **3-color front + 1-color back is quoted as 3+3 → over-priced.** The engine prices front (primaryLocation) + back (additionalLocation) INDEPENDENTLY; the full builder already has separate front/back. QQ is the only surface that can't. **MUST-fix, UI-only (engine already accepts separate counts).**
2. **#2 — dark-garment (underbase) buried + never auto-suggested.** Underbase checkbox is hidden in `<details>` Advanced (`index.html:146`) while the lower-impact stripes is inline (`:136`). Underbase = +1 screen/location (+$30 setup). And QQ knows the color name but never suggests underbase for Black/Navy → a rushed AE quoting a black tee gets a too-LOW (no-underbase) price. **SHOULD: inline + auto-suggest (suggest, never force).**
3. **#3 — breakdown doesn't teach SCP cost.** Rows reuse embroidery labels + never show the color count ("Front print — 3 color"). Screen setup can't be a per-piece row because the **parity guard `quick-quote.js:~1002` drops the whole breakdown if rows don't sum to per-piece** (setup is one-time). Fix = a **TWO-SECTION breakdown**: per-piece rows (parity-guarded) + a SEPARATE one-time block (screen setup + screen count). **MUST.**

## What already works (don't touch)
- Pricing correct by construction (same engine, `scp:design-1` group). Rule 9 honored.
- Safety-stripes inline upsell is good.
- Screen setup IS already shown as a one-time meta chip ("Screen setup — N screens × $30", engine `quote-cart-engine.js:~699`) — but it's a chip, not a breakdown row, so it reads as an afterthought.

## Answers to Erik's 6 questions
1. Easy? **Partly** — the front=back coupling is a real defect. 2. Pick actual ink COLORS? **Decline for QQ** — COUNTS (screens) drive price, not which inks; a PMS picker is a backend project with zero pricing value (colors locked at proof). 3. Simplest method? Current is too-simple-and-wrong; simplest CORRECT = front/back colors separate + dark + stripes (4 knobs). 4. Redesign? **Yes, cheap, UI-only.** 5. Satisfied? Speed yes, correctness/clarity no. 6. Add toggles/items? A few (front/back colors MUST, inline dark, setup display); **decline PMS picker + specialty inks (metallic/puff/glow)/oversize — backend, belong in the Quote Builder.**

## PRIORITIZED PLAN (all UI-only, zero pricing risk)
- **MUST**: split `#qqInk` → Front/Back steppers (back shows only on back placement), wire `state.frontInk`/`state.backInk` separately at `:192-193`. (S–M)
- **MUST**: two-section breakdown — per-piece rows (parity-guarded) + separate one-time screen-setup block. (M)
- **SHOULD**: move dark-garment inline next to stripes; config chip "Front 3c + Back 1c"; label breakdown rows with color count; one-line note "each color = 1 screen ($30 setup); back prices on its own"; auto-suggest dark from color name. (all S)
- **NICE**: SCP minimum-13 preset/matrix probe (presets 24/48/72/144 never show the floor tier); fix back-only placement (priced as front today); `:focus-visible` ring on `.qq-place-chip`; "Open in Quote Builder" hand-off pre-seeding colors/placement.

## SKIP (scope-creep / backend)
PMS/named-ink picker, specialty-ink toggles (metallic/puff/glow/discharge), PMS-match fee, screen-reset, oversize — all [NEEDS BACKEND] (new Caspio rows + engine input); setup/flash as per-piece rows (breaks the parity guard). Belong in the full Quote Builder, not the fast phone tool.

Full report: workflow run `wf_33b35355-149`. Core fix line: `quick-quote.js:192-193`.

---

## ✅ SCP SLEEVES as additional print locations — SHIPPED LIVE v2026.06.24.17 (2026-06-24)

Erik: "DTF sleeve = price like a left chest; DTG no sleeves; screen print = just another print location."
**This is the FIRST sleeve change that touched the SHARED ENGINE** (the SCP front+back model was hard-coded).

- **Engine** `quote-cart-engine.js priceScpGroup`: new opts `sleeveCount:0-2`, `sleeveColors:1-6`. Each
  checked sleeve = an additional location priced at `additionalLocationPricing[sleeveColors]` (SAME table
  as the back) × `sleeveCount`. Split `frontBackLocations` (drives safety stripes — sleeves get NO hi-vis
  stripe) from `printedLocations = frontBackLocations + sleeveCount` (drives dark underbase — sleeves DO
  get an underbase). Screens `+= sleeveCount*sleeveColors`. **`sleeveCount:0` ⇒ legacy front+back path
  byte-identical** (existing SCP parity a–d unchanged). 1-color add-location on PC61 @48-71 = $4.50.
- **QQ**: sleeve row now shows for DTF (≤5×5" transfer, no ink stepper) AND SCP ("screen print" label +
  an ink-color stepper `#qqSleeveInk` shown only when SCP + a sleeve checked). DTG/EMB no sleeve row.
  `state.sleeveInk` (default 1); SCP group sends `sleeveCount/sleeveColors`; cache key + `printAddlLabel`
  + `configParts` updated. Line Sheet (default mode) inherits via `def.groups()` — same builder.
- **Locked**: 4 new `web-quote-cart-parity` SCP-sleeve tests (1 sleeve $16.50/2 screens; 2 sleeves $21/3;
  dark+sleeve 4 screens $912; stripes NOT ×sleeve $18.50). 81 green. Live PC61 dark+1-sleeve = $912.00,
  cent-exact to the unit test.
- **DTF sleeve size label** (≤5×5") shipped the same day in v2026.06.24.16 alongside print-size-on-chips.
