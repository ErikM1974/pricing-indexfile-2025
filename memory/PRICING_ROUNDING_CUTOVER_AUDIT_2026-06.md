# Pricing Rounding Cutover Audit — Component-Rounded Model (2026-06-22)

> Deep 13-agent code audit (10 readers + completeness sweep + adversarial skeptic + synthesis;
> ~1.03M tokens, 204 tool-uses) answering Erik's question: "Are we confident we can cut the
> component-rounded model over to ALL the different pricing?" Every claim cited to file:line.
> **Verdict: NO to one cutover. GO-WITH-CARE, method-by-method.**

## ⚠️ RECONSIDER THE PREMISE FIRST (Erik, end of 2026-06-22 — before writing ANY code)
Erik, stopping the session: **"I don't think you need to break the costs down on the shirt — the customer just wants to know the TOTAL price."** This may collapse the whole project. Scoping `custom-tees-pricing.js` found the component-rounded model is a **price NO-OP** for DTG/DTF/stores: print costs are already $0.50 multiples, so `hdc(garment+print) === hdc(garment) + print` — it changes only the *presentation* (line items), not the total. The ONLY methods whose TOTAL changes are **EMB/SCP** (multiple non-$0.50 parts round up a little). So before building, settle the GOAL:
- If the goal is **line-item transparency** → **MOOT** if customers only ever see the total → the cutover is unnecessary for DTG/DTF/stores.
- If the goal is a **small price increase on EMB/SCP** → that's achievable far more simply by nudging margins/fees in Caspio — NOT a multi-week, multi-surface rounding-model overhaul.
**Decision needed next session:** is this project even worth doing, or did "customer just wants the total" just retire it? Nothing was built — clean to drop or pivot.

## Headline findings that overturned the easy story
1. **"SCP is already the target model" is FALSE.** `screenprint-pricing-service.js:407-409` sums
   `garmentPrice + printPrice` then rounds ONCE (round-the-total). SCP is a full 4-surface lockstep change.
2. **EMB garments + ALL caps round to WHOLE DOLLARS today** (`embroidery-quote-pricing.js:315`
   `CeilDollar`; `cap-embroidery-pricing-service.js:224`; storefront `custom-caps-pricing.js:179`).
   Moving them to $0.50 component-rounding is a **PRICING-POLICY decision for Erik**, not a refactor.
3. **DTG spans 2 repos** (Pricing Index client + caspio-pricing-proxy server) — can't ship atomically;
   server sums combo print-codes (`LC_FB`→`LC`+`FB`) before one round (`dtg-canonical-pricing.js:164-171`).
4. **Scope ~2× bigger than the first pass**: there's a 4th staff surface (Order Form), caps have THREE
   formulas, DTF has ~8 rounding sites (incl. child rows), ~174 hardcoded `toBe()` in web-quote-cart-parity.

## SCORECARD (rounding model TODAY + cutover difficulty)
| Path | Rounds at (file:line) | Model today | Difficulty | Risk |
|---|---|---|---|---|
| DTG | client `dtg-pricing-service.js:432/505/724`; server `dtg-canonical-pricing.js:171` | round-total $0.50 | Hard | High (2-repo) |
| EMB garment | `embroidery-quote-pricing.js:1162/1194`; `embroidery-pricing-service.js:277` | round-total, **whole-$** (`:315`) | Hard | High (policy) |
| EMB cap | `cap-embroidery-pricing-service.js:267`; storefront `custom-caps-pricing.js:179` | round-total, **whole-$** | Moderate (policy-gated) | Med |
| SCP | `screenprint-pricing-service.js:407-409` | round-total $0.50 | Hard | High (4 surfaces) |
| DTF | `dtf-pricing-service.js:349/442`; `dtf-quote-pricing.js:269`; engine `:838`; builder `dtf-quote-builder.js:1677/1736/1888/1923` | round-total $0.50 | Hard | High (~8 sites) |
| Catalog matrix | EMB `pdp-configurator.js:319`; SCP `:447` (DTG `:405`/DTF `:501` display-only — DON'T touch) | inherits service | Hard | High |
| Custom-Tees store (LIVE) | `custom-tees-pricing.js:160`; upcharge POST-round `:170` | round-total $0.50 | Moderate | Med (customer-charged) |
| 3-Day Tees | `3-day-tees-pricing.js:115/118/122`; flat LTM `:198` | round-total $0.50 | Moderate | Med |
| Shared engine | assembles pre-rounded values; owns ZERO formulas | n/a alone | — | — (can't fix rounding alone) |

Reference spec (NOT a change target): `dtf-prints-prototype.js:74` `hdc(x)=Math.ceil(x*2-1e-9)/2`, per-part assembly `:184/190`, LTM floor `:189`.

## Surfaces the first pass MISSED (completeness sweep)
- **Order Form = 4th staff surface**: `pages/order-form/pricing/shared.js:17`, methods `embroidery.jsx:165`, `dtf.jsx:194/204`, `screenprint.jsx:233`. **No parity test ties it to the builders — thinnest evidence; build one first.**
- **custom-caps-pricing.js:179** — 3rd cap formula (storefront, whole-$, feeds real Stripe charges via `server.js:1296`).
- **JDS laser** `jds-api-service.js:190/214`; **laser-patch/emblem** `embroidery-pricing-all.js:1239/1370/1525/1749`; **SCP manual** `screenprint-manual-pricing.js:1417`.
- **Proxy routes**: `decorated-cap-prices.js:91`, `catalog-display-price.js:50` (server-rendered catalog price before JS loads).
- **EXCLUDE**: `contract-webstore-ai.js:326` rounds to nearest **$5** (intentional banding — do NOT standardize). Sticker `sticker-pricing-service.js:118-130` = grid lookup, no rounding (out of scope).

## RECOMMENDED SEQUENCE (one method at a time; never all at once)
1. **Custom-Tees → 3DT** — cleanest corner (single engine, no matrix, no shared engine). Small–Med. Lock: `custom-tees-pricing.test.js`, `3dt-pricing.test.js`, live Stripe-amount check, deploy client+server together (price-mismatch 409 gate `server.js:~3038`).
2. **DTF** — best-understood; flushes the child-row + Order-Form dance. Large. Lock: `web-quote-cart-parity` (~38 groupTotals), `dtf-childrow-state.test.js`, `dtf-save-parity.test.js`, Order-Form `dtf.jsx`.
3. **SCP** — repeat the 4-surface dance. Large.
4. **DTG** — defer (cross-repo deploy + combo-code algorithm change). Large.
5. **EMB garment + caps** — LAST, **gated on Erik's whole-$→$0.50 policy decision**. Hardest (engine refactor + 3 cap formulas). Large.
**Stop-the-line:** after each method re-run `web-quote-cart-parity` + `quick-quote-parity`, verify all 3 surfaces (Rule 9).

## DECISIONS ONLY ERIK CAN MAKE (gates)
- **✅ DECIDED 2026-06-22 (Erik): YES — EMB garments + caps move whole-$ → $0.50 component-rounded** (all methods land on the $0.50 model). EMB/caps no longer "blocked"; they're still LAST in the sequence only because they're the hardest code (engine refactor + 3 cap formulas).
- **✅ DECIDED 2026-06-22 (Erik): SCP breaks out the LOCATIONS** — garment + EACH print location rounded separately to $0.50 (hdc(garment) + Σ hdc(each location)), exactly like DTG (combo codes `LC_FB`→`LC`+`FB`) and DTF (per-transfer-size). Restructures `screenprint-pricing-service.js:407` which currently lumps garment+primary-print into ONE round. Setup ($30/screen) + flash stay separate one-time/line-item fees; small-batch fee becomes the per-shirt line. Net: DTG/DTF/SCP become structurally identical.
- **STILL OPEN**: Does JDS laser / Order Form / laser-patches participate, or stay as-is? + bless the per-shirt LTM rule (floor-to-cents) + the store upcharge-snap delta (~$0.07–0.17/shirt) before locking.

## Open / thin evidence
- Order Form has NO parity test linking it to builders — build one before its cutover.
- What the live API returns for cap `RoundingMethod` is UNCONFIRMED — the whole EMB/cap track hinges on it.

Full report: workflow run `wf_6c4b481b-0fa` transcript. Key files for next session: `screenprint-pricing-service.js:407`, `embroidery-quote-pricing.js:315`, `custom-caps-pricing.js:179`, `pages/order-form/pricing/shared.js:17`, `dtf-prints-prototype.js:74`, `tests/unit/web-quote-cart-parity.test.js`.
