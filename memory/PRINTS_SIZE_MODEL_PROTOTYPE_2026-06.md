# Prints "size + position" pricing model — PROTOTYPE (2026-06-21)

> **STATUS: PROTOTYPE ONLY. The live Quick Quote / quote builders / customer catalog are UNCHANGED
> and still use the current "round-the-final-total" formula. The decision to adopt this new model
> live is PENDING (Erik's call). Nothing here has shipped to a real pricing surface.**

## Where it lives
- **Live URL (noindex, unlinked, changes no real tool):**
  `/calculators/quick-quote/dtf-prints-prototype.html` — currently `v2026.06.22.7` (**ALL 4 methods + caps + 2XL + inventory**).

## ✅ PRODUCTION-COMPLETENESS FEATURES (2026-06-22, v2026.06.22.5-7)
- **Cap embroidery (`.5`):** auto-detect cap vs garment by style (`isCapStyle`: ^CP/^NE/^C\d/^\d{2,3}) + **Garment/Cap override toggle**.
  Cap → CAP + CAP-AL bundles (ItemType Cap/AL-CAP): cap base $17/$17/$13/$11/$9.50, cap-back AL $6.50→$4.25 (5K base @ $1/1K),
  AS-Cap surcharge ($4/$10, = AS-Garm), cap blank (OSFA, C112 $3.61). Labels "Cap front"/"Cap back". Verified C112 @24 = $28.
- **2XL+ upcharges (`.6`):** `+ 2XL+ sizes` expander → allocate extended-size counts; each adds its blank upcharge (`sellingPriceDisplayAddOns`:
  2XL+$2/3XL+$3/4XL+$4/5XL+$6/6XL+$7) to the per-shirt; blended order total + "Order by size" breakdown. Suppressed for caps (OSFA).
- **Inventory check (`.7`):** color picker (`/api/product-colors`, **CATALOG_COLOR** — the inventory key, not COLOR_NAME) + per-size stock
  from `/api/inventory?styleNumber&color=` (rows have **SIZE/QTY** uppercase, no warehouse split) with good(≥50)/low(<50)/out(0) badges + total;
  "Unable to verify" fallback. Default first color; updates on color change.

## ✅ SCREEN PRINT ADDED (2026-06-22, v2026.06.22.4) — 4th method, model now complete
SCP = LOCATIONS by **ink-color count** (not size/stitches). Unified `parts` model holds. Tiers
**24-47 / 48-71 / 72-144 / 145-576** (all denom 0.53; **min qty 24**; LTM $50 only in 24-47). Formula:
`perShirt = hdc(garment/0.53) + hdc((Ed_Cost_front(tier,colors) + $0.35×colors)/0.53) + Σ hdc(Ed_Cost_back/0.53) + per-shirt LTM`.
- **Front = primary** (Screenprint_Costs CostType=PrimaryLocation) **+ flash $0.35 × colors on EVERY color** (not just dark);
  **Back = additional** (CostType=AdditionalLocation, **same Ed_Cost as front now**, NO flash).
- Ed_Cost is a RAW cost marked up by ÷0.53 (unlike DTF/DTG/EMB which add pre-margined selling prices).
- Color input live (1-6); below-24 shows a clean "starts at 24" guard; matrix skips qty<24. Verified: PC61 @24 front 1c+back 1c
  = $7+$6+$5.50+$2.08 LTM = **$20.58**; front 3c = $9 (flash×3). Rate card still DTF+DTG (size grid) only.

**All four methods now share: blank + decoration line items, each rounded to $0.50, per-shirt LTM. REMAINING: 2XL upcharges, then the live cutover.**

## ✅ EMBROIDERY ADDED (2026-06-22, v2026.06.22.2-3) — 3rd method in the prototype
Method toggle now DTF / DTG / **Embroidery**. EMB = LOGOS by **stitch count** (not size). Unified `parts`
model: each method returns `{blank, parts:[{label,short,sub,rate}], ltmPerShirt, perPiece, ...}` → one
renderResult/matrix. EMB formula (verified live, all tiers **denom 0.53**; tiers 1-7/8-23/24-47/48-71/72+):
`perShirt = hdc(garment/0.53) + hdc(primaryBase + stitchSurcharge) + Σ hdc(AL) + per-shirt LTM`.
- **Primary base** (Embroidery_Costs ItemType=Shirt, ≤10K incl): $18/$18/$14/$13/$12 by tier.
- **Stitch surcharge** (AS-Garm): ≤10K $0 · ≤15K +$4 · ≤25K +$10 (>25K caps at $10 — known gap).
- **Additional logo** (EMB-AL ItemType=AL): base $10/$9/$8/$7.50/$7 + $1.25 per 1K over 8K.
- **LTM** $50 at **qty ≤7** (tier 1-7 only), per-shirt line. Live EMB rounds **whole-dollar (CeilDollar)**;
  prototype rounds parts to $0.50 to match DTF/DTG (flagged in the result note). Verified: PC61 @24 primary 8K
  +AL 8K = $7+$14+$8 = **$29**; primary 20K = +$10 surcharge → $24. Stitch input is live (no focus loss).
- Rate card still DTF+DTG only (EMB stitch-based rate card = future). **REMAINING: Screen Print + 2XL upcharges**, then the live cutover.
- **Files:** `calculators/quick-quote/dtf-prints-prototype.{html,js,css}` (in ACTIVE_FILES.md as 🧪 Prototype).
- Reachable only by URL (crumb links back to Quick Quote); not in any nav.
- Self-contained: loads `app.config.js` + `dtf-pricing-service.js` only; DTF via the live service,
  DTG via a hand-rolled replica of the server pricer's rates (see below).

## What it is
A rethink of how prints are quoted, driven by Erik across a long 2026-06-21 session. Core idea:
**a print = a SIZE. The price comes from the size, not the position.** Built as a standalone DTF+DTG
pricer to evaluate the model BEFORE touching any live pricing.

## The model decisions (all built into the prototype)
1. **Size-only, NO location.** A print is just a size; it can go anywhere on the shirt and the spot
   doesn't change the cost. Placement is a PRODUCTION detail → stays in the Quote Builder (PDF +
   ShopWorks), out of a rapid quote. (Position picker removed in `.8`.)
2. **ONE shared 4-name size ladder** across DTF+DTG: **Small / Medium / Large / Jumbo.**
   - Small + Large are the SAME size in both (~4–5" left-chest; ~12×16" full). Medium is **DTF-only**
     (9×12"; DTG has no 9×12 rate). Jumbo is **DTG-only** (16×20"; DTF's biggest transfer is 12×16.5").
   - The rung a method can't do is shown greyed + tagged ("DTF only" / "DTG only").
   - Dims: DTF from Caspio `DTF_Pricing.size` (≤5×5 / ≤9×12 / ≤12×16.5); DTG from config
     (LC 4×4, FF/FB 12×16, JF/JB **16×20** — note: NOT 14×18, corrected from an earlier wrong guess).
3. **Component-rounded ("round each part"), NOT round-the-total:**
   `perShirt = HalfDollarCeil(blank÷margin) + Σ HalfDollarCeil(each print) + smallBatchPerShirt`.
   Every part rounds UP to $0.50, so the lines **add up by hand — no rounding line.** Publishable as a
   rate card. (Driven by Erik wanting a hand-computable price.)
4. **Small-batch (LTM) = per-SHIRT line item** (`floor($50 ÷ qty)`), baked into the all-in per-shirt
   price (Erik: per-shirt, NOT per-order). It's the only line with odd cents (because $50 ÷ odd qty isn't round).
5. **Price-break matrix** (`.9`): rows 12/24/48/72 (+ the active qty), columns
   `Qty | Blank | <each selected print> | Small-batch | Per shirt | Order`. Adjusts to the selected
   prints; each row adds across; click a row to set the quantity.

## Pricing specifics (all verified live 2026-06-21)
- **DTF raw rate / print** = `transfer(size) + PressingLaborCost $2.50 + freight` (from `DTFPricingService`
  bundle: `transferSizes`, `freightTiers`, `laborCostPerLocation`), then → $0.50.
- **DTG raw rate / print** = `DTG_Costs.PrintCost`: Small=`LC`, Large=`FF`(=`FB`), Jumbo=`JF`(=`JB`).
  qty<24 uses the **24-47** print costs (the `1-23` margin LTM tier has no matching cost rows; the
  `12-23` cost rows are DEAD/never used). Then → $0.50.
- **Blank** = `min(garment size price) ÷ MarginDenominator` (Pricing_Tiers: 0.55 at 1-23/10-23, 0.53 at
  24+), → $0.50.
- DTG replica verified **penny-match to the server canonical pricer** (`POST /api/dtg/quote-pricing`) for
  the supported cases — but the prototype deliberately uses the NEW round-each-part formula, so its
  totals differ slightly from the live (round-the-total) tools by design.
- **PC61 rate card @24:** DTF blank $7 · S +$9 · M +$12 · L +$16.50. DTG blank $7 · S +$7.50 · L +$10 · J +$12.
  @72: DTF blank $7 · S +$7 · M +$8.50 · L +$11.50. DTG blank $7 · S +$5.50 · L +$7 · J +$9.

## Price impact of the new model vs the current formula (round-the-total)
**$0.00 to +$0.50/pc, NEVER down.** $0 wherever the raw rates already land on a $0.50 (most of DTG, since
its print rates are clean); +$0.25/$0.50 only where a raw rate has odd cents (e.g. DTF Large $16.25→$16.50).
Protects margin. (Modeled directly against the live bundles for PC61 @ 24 and 72.)

## ⛔ OPEN — RESUME HERE (the decision Erik keeps circling)
The model is **prototype-only.** To take it live (Erik decides when):
1. Change the canonical engine rounding (the DTF service + the DTG server pricer) from round-the-total to
   **round-each-part + per-shirt flat-$50 LTM**.
2. **Re-baseline ALL parity tests** (`web-quote-cart-parity`, `quick-quote-parity`) — prices shift +$0–0.50.
3. Roll out **surface-by-surface: Quick Quote first** (no PDF/push/customer risk) → quote builders (PDF +
   ShopWorks, careful — Rule 8 sync) → customer catalog (optional / lite — it doesn't expose sizes today).
4. Decide screen-print + embroidery fit: **SCP prices by location COUNT, not size** (a size label would be
   cosmetic there); **EMB is already logo + stitch-count** (this model's cousin). Only DTF + DTG are size-tiered.

## ROLLOUT SCOPE — how to take it live (verified 2026-06-22, 3-agent audit)
**The rounding lives in the 4 per-method SERVICES, which are the shared chokepoint** — the Quote Builders
call the service directly; the catalog + Quick Quote call it through `QuoteCartEngine.singleItemPreview`
(engine owns NO formulas, just orchestration). So changing ONE method's service rounding propagates to that
method's **builder + catalog + Quick Quote at once.** The catalog price MATRIX re-probes `singleItemPreview`
(`pdp-configurator.js` probeLadder), so it **auto-inherits — no separate edit.** → unit of work = **4 services, not 12 surfaces.**

**All 4 methods currently ROUND-THE-TOTAL (same as DTF/DTG pre-prototype):**
- **SCP** (`screenprint-pricing-service.js:296-300,407-408`): `applyRounding(garment+print)` once; addl locations rounded separately; LTM per-piece after. SCP prices by **colors × locations, not size** (size cosmetic) — additive unit = blank + each location's print cost (by colors) + LTM.
- **EMB** (`embroidery-quote-pricing.js:1160-1164`): `HalfDollarUp(garment+emb)` once into `roundedBase`, upcharges/stitch fees added on top unrounded; **LTM split per-piece** (÷qty) when qty≤7 (`:1586,1611`). EMB does NOT go through the engine in the BUILDER (uses `EmbroideryPricingCalculator` directly) but the catalog/Quick Quote DO via `priceEmbGroup`→same Calculator → Calculator is the shared chokepoint.
- **DTF/DTG**: as documented above (round-the-total in their services / DTG server pricer).

**To publish the prototype model, per method change: (a) round-each-part** (round blank + each decoration component to $0.50, sum) **and (b) flat per-shirt LTM line** (stop the ÷qty spread). Files: the 4 `*-pricing-service.js` / `embroidery-quote-pricing.js` (+ their `*-manual-pricing.js` / `*-quote-pricing.js` variants), then re-baseline `web-quote-cart-parity` + `quick-quote-parity` + the per-method `*-save-parity` tests. Builders inherit IF the service changes; catalog matrix auto-inherits.

## Why the model is sound (facts established this session)
- **EMB, DTF, and DTG all price by SIZE; only Screen Print prices by location count.** DTG proven size-based:
  `FF==FB` and `JF==JB` exactly; combos are sums of size rates (`LC_FB = LC+FB`). See
  `PRINT_METHOD_MARGIN_STRATEGY_2026-06.md`.
- **DTF live price reads `DTF_Pricing.unit_price` (+ PressingLaborCost) only**; Supacolor_Cost / Margin_Pct /
  Decoration_Cost are reference columns the code ignores. Same file.

## Related memory
- `PRINT_METHOD_MARGIN_STRATEGY_2026-06.md` — DTG-size-based + DTF unit_price facts, the 4 hand-calc formulas.
- `QUICK_QUOTE_TOOL_2026-06.md` — the live Quick Quote tool (the eventual home for this model).
- CLAUDE.md Rule #9 — the 3-surface engine rule (Quick Quote / catalog / builders share one engine).
