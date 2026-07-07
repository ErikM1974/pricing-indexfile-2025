# Quote Builder Order-Entry UX Audit — 2026-07-06

> 4 parallel code-trace readers (EMB / DTG / SCP / DTF) + main-session verification of every
> HIGH claim. Scope: order-entry clicks, line-item speed, price-display correctness, skin.
> Full narrative delivered in-session 2026-07-06; this file = the durable, actionable core.

## Click scorecard (typical order: 1 style × 2 colors, ~48 pcs, 1 location, customer, save)

| Builder | Clicks | Keystrokes | Standout strength | Biggest drag |
|---|---|---|---|---|
| EMB | ~26–28 | ~22–28 | ShopWorks paste-import, duplicate-row btn, services bar | modal cascades, 5-field customer entry |
| DTG | ~13 | ~28 | **fastest entry**: catalog quick-add, clone-row, per-size live prices | bulk-size paste built but UNWIRED |
| SCP | ~22 | ~15 | dup style+color detection, safety-stripe recs | **no duplicate-row btn** (2nd color = full re-search) |
| DTF | ~10 | ~60–80 | leanest clicks, single money source | form-heavy (ship/order fields), no duplicate-row btn |

## Price-display findings (VERIFIED)

1. **10.1% tax residuals (Milton is 10.2 since 2026-07-06)** — `screenprint-quote-builder.js:3930`
   seeds the rate input `'10.1'` as the pre-DOR-lookup fallback; EMB HTML default 10.1%
   (`embroidery-quote-builder.html` ~line 624); DTF default 10.1%. A rep who never triggers the
   ZIP-blur DOR lookup bills the old rate. Fix like `sample-order-service.js` (destination DOR +
   flagged fallback). Part of the known-INCOMPLETE 10.2 sweep.
2. **Silent money fallbacks in SCP** — `getServicePrice('SPSU', 30)` (:156) and
   `getServicePrice('SP-STRIPE', 2.00)` (:3355) fall back with console-only warning. LTM ($50,
   :3319) and GRT-75 DO toast visibly. Fix: promote DTF's `_flagUpchargeFallback` warn-once
   pattern into `quote-builder-utils.js` and route ALL money fallbacks through it (Rule 8).
3. **EMB manual price override goes stale silently** — `row.dataset.sellPrice` survives later
   logo-config changes (stitch tier, digitizing) with no "override may be stale" warning
   (`embroidery-quote-builder.js` ~6040/6651).
4. **SCP LTM display mode not restored on edit-reload** — saved `separate` mode re-opens as
   `builtin` (control panel re-renders fresh in recalc, ~:3330); revised quote can present
   LTM differently than the original.
5. **No in-flight re-price indicator (trio)** — during a slow `/api/pricing-bundle` refresh the
   table shows the previous prices with no "updating…" state. Save is safe (re-runs recalc +
   uses `currentPricingData` snapshot) but the rep can read a stale number aloud.

Already tracked elsewhere (do NOT re-open): quote-view extended-size upcharge hardcode chip,
EMB $12 tier-fallback chip, cart mailto chip; SCP preview reprice race FIXED 2026-07-06.

## FALSE ALARMS (verified — don't chase)

- SCP `recalculateAllPrices()` "doesn't exist" → **it does**, defined at
  `screenprint-quote-builder.js:3221`; the :205 call is fine.
- SCP `resetQuote()` "calls missing updateGrandTotal/updateScreenConfig" → historical comment
  at :1019–1022 documenting the 2026-06-01 FIX; live code calls the right functions.
- "SCP LTM fallback is silent" → it toasts (:3319–3322).

## Prioritized recommendations

**P1 — line-entry speed (biggest bang):**
1. Duplicate-row parity: give SCP + DTF the EMB duplicate-row / DTG clone-row button
   (2nd color of same style = 1 click). One shared util per Rule 8.
2. Wire DTG's `parseBulkSizes()` (`dtg-inline-form.js:324` — built, never wired) to a
   "Paste sizes" affordance; promote to all 4 builders.
3. Make the quantity-nudge chip CLICKABLE (it already computes the target tier + savings);
   click auto-distributes the delta across entered sizes.
4. Lookup-first customer panel: one prominent lookup field, manual fields collapsed behind
   "enter manually" (EMB worst offender at 5 clicks + 5 fields).

**P2 — friction:**
5. SCP: auto-merge duplicate style+color into the existing row (toast SAYS "adding to existing
   row" but only focuses it, :2461).
6. Extended-size popup: add "Apply + next row" (today: re-open per row); longer-term inline popover.
7. Shared 5-sec "Row removed — Undo" toast (no builder confirms or restores deletes).
8. EMB import cascade (Import → Stitch counts → Pricing review = 3–4 modals) → single stepper modal.
9. EMB: "Retry pricing" button on AL/DECG `data-priceError` rows (today: full page refresh).

**P3 — polish:** tax-rate input width (52px), color-picker keyboard/arrow nav, mobile sticky
total bar for DTG (<1280px), discount fixed-vs-% mode made visible, order-details
discoverability (collapapsed footer card), extended-size + color-picker modal restyle to PNW shell.

## Skin verdict

**No new design system** (standing rule; PNW tokens exist, Phase 2a shell half-applied).
Instead: (a) FINISH the PNW shell pass — stragglers are the extended-size modal, color-picker
dropdown, fee rows, hardcoded `#ddd` borders / 12–14px label drift; (b) the real "new skin" =
Phase 3.4/3.5 shared renderers adopting **DTG's entry surface** (catalog rail + card-per-line +
per-size prices under cells) as the target line-entry pattern — DTG measured fastest of the 4.
EMB stays flagship for the chassis (invoice band, sidebar, action panel); DTG becomes the
reference for the LINE-ENTRY layer.
