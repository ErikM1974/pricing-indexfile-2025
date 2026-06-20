# Print-Method Margin & Screen-Print Pricing Strategy — 2026-06-19

> # ✅ SCP REVAMP DEPLOYED & LIVE — v2026.06.20.1 (2026-06-20)
>
> **DONE.** The full screen-print clean model is **live and verified**: `screenprint-pricing-service.js`
> reads `Ed_Cost ÷ 0.53` (front: +flash; back: same markup), engine reuses the service (one file = all 3
> surfaces), HalfDollarCeil rounding. Deployed JS confirmed reading `Ed_Cost` (BasePrintCost refs = 0).
> 111 SCP/parity tests green; full unit suite 1408 green; SCP fixtures re-captured to the live model.
> **One test-infra follow-up:** `tests/pricing-baselines/baselines.locked.json` still holds OLD SCP prices
> → the Puppeteer `pricing-baselines.test.js` (needs a :3000 server) will mismatch SCP until re-locked.
> Not in the deploy gate (`test:parser`), so it didn't block. Re-lock when convenient.
>
> **DO THIS, IN ORDER:**
> 1. **Verify the code edit** in `shared_components/js/screenprint-pricing-service.js` (2 edits, ~line 348-382):
>    now reads `Ed_Cost` (not `BasePrintCost`); front = `(Ed_Cost + 0.35×colors) ÷ marginDenom`,
>    back = `Ed_Cost ÷ marginDenom`. ONE file fixes all 3 surfaces (engine reuses the service via
>    `svc.fetchPricingData()`; `quote-cart-engine.js` needs NO change — confirmed).
> 2. **Compute a sanity price** (load the service in Node or compute by hand): PC61 24-47 1c front ≈
>    HalfDollarCeil((3.53 + 2.70 + 0.35)/0.53) = **$12.50/pc**; back 1c ≈ HalfDollarCeil(2.70/0.53) = **$5.50**.
> 3. **Fix the SCP tests** (they will be RED — fixtures hold the OLD model): re-capture
>    `tests/fixtures/pricing/scp-bundle-PC61.json` + `scp-bundle-PC54.json` from the live bundle (now
>    Ed_Cost-only, no BasePrintCost, tiers 24-47/48-71/72-144/145-576, margin 0.53, HalfDollarCeil) and
>    update assertions in `tests/unit/web-quote-cart-parity.test.js` (old: $13/$14.50 base, $75 LTM, '13-36'/'37-71').
>    Also legacy `tests/screenprint-*-test*.js` hardcode old tiers/BasePrintCost.
> 4. **`/deploy`** to restore SCP pricing live. Then re-verify all 3 surfaces price the new model.
>
> **THE LIVE CASPIO STATE (all done, verified in the API):**
> - `Screenprint_Costs`: **`BasePrintCost` DELETED**; single **`Ed_Cost` = Ed's 2026 cost + 15%** buffer
>   (Notes document it); **AdditionalLocation (back) `Ed_Cost` = SAME as front** (was inflated ~2.3×, corrected).
>   Tiers 24-47/48-71/72-144/145-576. Also `Screenprint_Costs_2` (unused) DELETED.
> - `Pricing_Tiers` ScreenPrint: **MarginDenominator = 0.53** (all tiers; garment + print uniform 47%);
>   min 24; LTM **$50 on 24-47, $0** above.
> - `Pricing_Rules` ScreenPrint: **RoundingMethod = `HalfDollarCeil_Final`** (we tried CeilDollar but it
>   collapsed tier discounts — see below); FlashCharge 0.35.
>
> **THE MODEL (final):** garment + print BOTH at 0.53. Front = `HalfDollarCeil((garment + Ed_Cost + 0.35×colors)/0.53)`.
> Back = `HalfDollarCeil(Ed_Cost/0.53)`. Flash always added per color (front). Rough order impact vs old:
> PC61 1c front-only ~$392 (was $428, −8%), front+back ~−5%, hoodie front −12%; **back now ~$5–9 (was the
> inflated $11–17)**. Front-only gives up the old hidden 64–81% double-markup for a clean 47%.
>
> **WHY HalfDollarCeil not CeilDollar (Erik's monotonicity catch — confirmed mathematically):** whole-dollar
> rounding collapses adjacent tiers (Ed's volume discount there is < $1), so a bigger order showed the SAME
> per-piece (e.g. 1c: $13/$12/$12/$12 — flat at 48→72 AND 72→145; ALL colors flat at 48-71→72-144). Half-dollar
> restores the discount at ~every break (only 1c has one residual flat spot, masked by setup/LTM amortization).
> Never inverts (bigger never costs more). Don't switch back to CeilDollar without monotonic enforcement.
>
> ---
> *(Older pickup notes below; the SCP revamp above supersedes the "Open decisions #3 / screen-print remap".)*

---

## TL;DR (the state in 6 lines)
1. **Old Caspio table `Screenprinting_Costs_6_color` (4 rows) is safe to DELETE** — the live system
   reads `Screenprint_Costs` (48 rows). Margin/flash/stripe all live in other tables. *(Erik to do in Caspio.)*
2. **Screen-print remap agreed in principle:** min **24**, breaks **24-47 / 48-71 / 72-144 / 145-576**,
   small-batch fee **$50** (like DTG), **keep the 145 break**, conservative cost (24-47 carries the
   13-36 small-batch cost). **Caspio checklist NOT yet written.**
3. **Keep screen print's margin (do NOT lower to match DTG/DTF).** SCP marks up garment **+ print** — your
   richest, most-verified margin. (Earlier "DTF is the leak" was WRONG — see #4.)
4. **DTF margin = ✅ RESOLVED, HEALTHY (47–63%), not a leak.** Live Supacolor data (342 joblines) showed
   `unit_price` ALREADY carries ~0.50–0.53 margin on the transfer. Only change: Medium 10-23 $10→$11.50.
   `DTF_Pricing` now has cost/margin transparency columns. Erik: cushion absorbs small Supacolor raises. CLOSED.
5. **DTG's ~47% is OVERSTATED** — in-house Kornit ink/pretreat/labor isn't in the cost model; on
   darks it could be thin. **Must verify before "push DTG on cotton" becomes policy.**
6. **Can't compute TRUE profit yet** — need real in-house costs (see "What Erik must supply").

---

## Decisions made (confirmed by Erik)
- Screen-print **minimum = 24**.
- Low-end breaks **match DTG**: 24-47 / 48-71.  High-end **keeps Ed's** breaks: 72-144 / 145-576.
- Small-batch (LTM) fee on 24-47 = **$50** (same as DTG; was $75).
- **Keep the 145-576 break** (big-order competitiveness).
- Conservative "use the higher Ed break" cost mapping: 24-47 ← 13-36 cost, 48-71 ← 37-71, 72+ ← 72-144.
- This remap is a **Caspio DATA change** (no code/deploy) → propagates to all 3 surfaces.

## Decisions REVISED by the cost model (was "uniform margins", now NOT)
- Erik originally leaned "screen print should use the same margins as DTG/DTF (0.53)."
- **Cost model flipped this:** SCP marks up garment **+ print** (~52% GM, best). DTG marks up
  garment + token print (~47%, **overstated**). DTF marks up **only the blank** (~21%, decoration at cost).
- **New recommendation:** keep SCP margin rich; the real lever is **raise DTF's decoration margin**
  (transfer is a purchased good and should carry markup) + **verify DTG's true in-house cost**.

---

## Verified data (so we don't re-derive it)

**Caspio tables (screen print):**
- ACTIVE = **`Screenprint_Costs`** (48 rows, long format: CostType, TierLabel, ColorCount,
  BasePrintCost, Ed_Cost). Read by proxy `src/routes/pricing.js:461` + `:833`. **EDIT THIS for the remap.**
- OLD = **`Screenprinting_Costs_6_color`** (4 rows, wide). **Zero code refs in either repo → DELETE.**
- Tier labels in the ACTIVE table: `13-36 / 37-71 / 72-144 / 145-576` (NOT 37-72/73-144 — old table was off by one).

**`BasePrintCost` vs `Ed_Cost`:** Ed_Cost = what Ed bills us (cost). BasePrintCost = Ed_Cost + cushion =
the sell basis. Customer print price = `(BasePrintCost + Flash×colors) / MarginDenominator`, front
divides by margin, **back/additional uses BasePrintCost as-is**, then HalfDollarCeil on the final total.

**Where the old table's other columns now live (all confirmed):**
- Margin → `Pricing_Tiers.MarginDenominator`.  Flash $0.35 → `Pricing_Rules.FlashCharge`.
- Safety stripe $2 → `Service_Codes` code `SP-STRIPE` (SellPrice 2, UnitCost 1).  Setup $30 → `SPSU` (SellPrice 30, **UnitCost 15**).

**Margins (MarginDenominator; lower = richer):** DTG/DTF **0.53** (0.55 small tier), ScreenPrint **0.45 / 0.48 / 0.50 / 0.50**.
LTM: DTG/DTF $50 under 24/10; SCP $75/$50/$0/$0 (→ $50 on 24-47 after remap).

**Ed cost table (style-independent), BasePrintCost / Ed_Cost, PRIMARY location:**
| Tier | 1c | 2c | 3c | 4c | 5c | 6c |
|---|---|---|---|---|---|---|
| 13-36 | 2.60/2.35 | 3.35/2.85 | 3.90/3.15 | 4.45/3.45 | 4.95/3.70 | 5.45/3.95 |
| 37-71 | 2.30/2.05 | 2.65/2.15 | 3.10/2.35 | 3.55/2.55 | 4.00/2.75 | 4.40/2.90 |
| 72-144 | 2.20/1.95 | 2.50/2.00 | 2.85/2.10 | 3.20/2.20 | 3.65/2.40 | 4.10/2.60 |
| 145-576 | 2.05/1.80 | 2.35/1.85 | 2.70/1.95 | 3.05/2.05 | 3.45/2.20 | 3.80/2.30 |
(Additional/back location is ~2× these; Flash $0.35/color; setup $30/screen; dark = +1 underbase screen.)

**PC61 blank (size M) = $3.53.**  DTG all-in (M, live pricer): LC $14.50→13.50→12.50 (24/48/72+); FF $17→14.50→13.50.
DTG prices darks = lights (no dark surcharge in the pricer).

**DTF formula (verified):** `HalfDollarCeil(garment/0.53 + transferUnitPrice + PressingLaborCost $2.50 + freight)`.
DTF transfer cost (Small): 10-23 $6.50, 24-47 $5.75, 48-71 $4.50, 72+ $3.75. Freight: 0.50/0.35/0.25/0.15. Sizes: Small ≤5×5, Medium ≤9×12, Large ≤12×16.5.

> ⚠️ **CORRECTION 2026-06-19 (live Supacolor data) — `unit_price` is NOT raw cost.** Earlier note said
> "unit_price = OUR Supacolor cost (added RAW, no margin)" and the ~21% DTF GM rested on that. **WRONG.**
> Pulled ACTUAL Supacolor per-transfer billing via `/api/supacolor-jobs/sync/{job}` → joblines.Unit_Price
> (8 real transfers, 5 closed jobs). Actuals: Small/LC ≈ **$3.07–$3.33** (DTF charges $6.50 @ 10-23 = **~+100%**);
> Large FB ≈ **$7.74–$7.97** (DTF charges $15.00 @ 10-23 = **~+90%**). The `+$0.50` archive script
> (`scripts/archive/update-dtf-pricing-2026.js`) was a sell-price bump, not a cost passthrough.
> **`unit_price` already = cost ÷ ~0.50–0.55** at low qty (implied denom rises to ~0.86–0.93 at 72+, where
> markup thins to ~8–16%). So DTF decoration ALREADY carries DTG-style margin in the DATA — the formula adds it
> at face *because* it's pre-marked-up. **DTF GM is materially higher than 21%; the "DTF leaks margin" premise
> needs re-grounding.** The real lever is the **thin 72+ tier**, not "DTF passes decoration at cost."
> Caveat: actuals exclude Supacolor's per-job ganging/setup overhead spread across small jobs; confirm
> `unit_price` was originally derived from Supacolor's rate card, not a separate markup.

### Crossover findings (PC61, all-in $/pc, current margins)
- **Screen print beats DTG ONLY for 1-color:** full-front 33+ (light) / 45+ (dark); left-chest only 145+.
- **2+ colors: screen print NEVER beats DTG** at any qty (each color = +$30/screen for SCP, $0 for DTG/DTF).
- SCP price is **size-independent** (priced by colors, not coverage) → wins **large** prints, loses **small** ones.
- **At a hypothetical uniform 0.53 margin:** 1-color wins clearly 30+; 2-color wins ~250+; 3-color very high; 4+ never.

### True gross margin (PC61 illustrative, from cost-model workflow)
- **Screen print ~52%** — marks up garment + print; **most verifiable** (Ed_Cost in the table).
- **DTG ~47% but OVERSTATED** — Kornit ink/pretreat/labor/machine NOT counted; could be thin on darks.
- **DTF ~21%** — decoration (transfer+labor+freight) passed at cost; **all profit = the blank markup**.
- Example 48 shirts, 2-color, full-front: DTG **$696** (cheapest, if cotton) < DTF $792 < Screen $836.
- Example 72 shirts, 1-color, dark, full-front: **Screen $960** (cheapest) < DTG $972 < DTF $1,116.

---

## Open decisions / pending tasks (pick up here)
1. **DTF margin — ✅ RESOLVED 2026-06-19 (NO leak; the "$0 margin on decoration" premise was FALSE).**
   Pulled 342 real Supacolor joblines (Apr–Jun 2026 = current rates): `DTF_Pricing.unit_price` ALREADY
   carries ~47–63% transfer margin (≈ cost ÷ 0.50–0.53). Actual cost/transfer: **Small ~$2** (low-qty $3.30),
   **Medium ~$3.60**, **Large ~$5.10**. **Freight BUMPED 2026-06-19 (live-verified): `Transfer_Freight`
   now 0.75 / 0.45 / 0.30 / 0.20 (was 0.50/0.35/0.25/0.15) + new `Date_Updated` col — each tier's smallest
   order now covers the ~$16 shipment; 10-23 orders backstopped by the $50 DTF LTM, so NO freight floor
   needed.** **DTF transfer change: Medium 10-23 `unit_price` $10→$11.50** (was 40%,
   now 48%). `DTF_Pricing` got transparency cols in Caspio: **`Supacolor_Cost`, `Margin_Pct` (formula
   `([unit_price]-[Supacolor_Cost])/[unit_price]`), `Decoration_Cost` (=cost+labor), `Cost_Updated`, `Notes`.**
   Costs entered are ESTIMATES (proxy throttled the exact per-tier pull) but **prices are proven** so it's safe.
   **Erik's call: enough margin cushion (47–63%) to absorb small Supacolor increases — NOT chasing exact costs;
   `Margin_Pct` column is the early-warning if a cell ever drifts thin.** DTF CLOSED. Supacolor cost source =
   proxy `/api/supacolor-jobs/:id/joblines` (Item_Code TRANSFER `Unit_Price` + SHIPPING line = freight).
   **3-SURFACE DTF AUDIT ✅ 2026-06-19:** Quote Builder + Quick Quote/Express + Catalog price DTF identically —
   ONE formula (`dtf-pricing-service.js:378 calculatePriceForQuantity`), ONE location→size lock (Small=chest/
   sleeve/neck · Medium=center-front/back · **Large=FULL-front/back**), ONE live bundle. **REP NOTE: "Full Front/
   Back" = LARGE (12×16.5), NOT Medium; Medium = "Center Front/Back."** New freight/transfer flow to all 3 via the
   live bundle (~5-min cache → in lockstep). 86 parity tests green. The location→size lock was hand-duplicated in
   `dtf-quote-pricing.js` (DTFConfig) + `quote-cart-engine.js` (DTF_LOCATIONS_FALLBACK) → now guarded by NEW
   `tests/unit/dtf-location-size-lock-parity.test.js` (asserts the 2 copies match + pins the mapping).
2. **Verify DTG true cost** before making "push DTG on cotton" a policy (could be near break-even on darks).
3. **Screen-print Caspio remap checklist** — NOT yet written (min 24, breaks, $50 LTM, conservative costs,
   both `Screenprint_Costs` + `Pricing_Tiers` in lockstep). I offered to write the exact row-by-row list.
4. **AE "which method when" one-page cheat-sheet** for `training/` — offered, not built. (Decision matrix +
   the 4 gates: Material → Colors → Qty×Size → Deadline. Material gate is NOT enforced in pricing/tools.)
5. **True-profit-by-method calculator** — blocked until Erik supplies real costs (below).
6. **Delete old Caspio table** `Screenprinting_Costs_6_color` (Erik to do; safe; CSV already exported).

## What Erik must supply to finish the true-profit picture
- **DTG:** Kornit loaded labor + machine cost / shirt; pretreatment cost / shirt; ink (by area if possible).
- **DTF:** confirm Supacolor `unit_price` = full landed transfer cost; is **$2.50 press labor** the real
  loaded rate (Joe & Bryan) or a placeholder?
- **Screen print:** confirm Ed's per-piece print = `Ed_Cost`; what Ed bills per **screen** (the $15?); extra
  dark-underbase screen cost.
- **All:** a per-order **overhead** figure (pack labor, waste/rework %) to amortize.
- Confirm blank cost basis = actual landed Sanmar cost (incl. inbound freight), not list.

## Strategy doc alignment (Erik supplied a print-method strategy)
Strategy logic is sound and the cost data CONFIRMS its core instinct ("DTF = sales-safe, not profit-default").
Pricing reflects it for DTG (cheapest for cotton/full-color) + DTF (safe, slight premium) but **NOT for screen
print** (priced too rich to win the 1-3 color volume jobs it should). ~~pricing gives away DTF's decoration
margin~~ **← RETRACTED 2026-06-19: DTF does NOT give away decoration margin — `unit_price` already carries
~47–63% (live Supacolor data). DTF is a healthy method, not the leak.** Material gate (DTG=cotton only) is
judgment/tooling, not priced. **All 3 formulas compared (verified):** DTF & DTG = `roundUp(garment÷margin +
decoration_at_face)` — DTG's PrintCost is a retail # (margin baked in), DTF's transfer unit_price is too;
ScreenPrint = `roundUp((garment+print)÷margin) + setup` (marks up BOTH).

## Next-session quick prompts
- "Model the DTF transfer-markup options."  → margin vs price-impact table.
- "Write the screen-print min-24 Caspio remap checklist."  → exact `Screenprint_Costs` + `Pricing_Tiers` edits.
- "Build the AE cheat-sheet."  → `training/` one-pager.
- "Here are the real costs: [DTG/DTF/Ed numbers]"  → I build the true-profit calculator.

**Related:** [DTF_SCP_PARITY_ROADMAP.md](DTF_SCP_PARITY_ROADMAP.md), [QUICK_QUOTE_TOOL_2026-06.md](QUICK_QUOTE_TOOL_2026-06.md),
[PRICING_AUDIT_2026-06-09.md](PRICING_AUDIT_2026-06-09.md). Cost-model workflow run: `wf_944058ca-0d4`.
