# Contract Embroidery — stitch-file quoting ("drop the file, not the number")

`/calculators/embroidery-contract/` · shipped in two phases, 2026-08-04 and 2026-08-05.

**The idea.** Contract partners supply their own blanks *and* their own digitized files, so
they are the one customer segment that always has the production DST in hand. Dropping it on
the calculator prices the quote from the file's ACTUAL stitch count instead of a typed guess.
This attacks the realization gap directly (`EMBROIDERY_PRICING_REALIZATION.md`): nominal counts
off a digitizer's spec sheet round down, and the file cannot be argued with.

## Architecture

| Piece | Where |
|---|---|
| Tajima DST parser (shared with Embroidery Studio) | `pages/js/dst-parser.js` — 12 jest |
| Risk / machine-time / multi-location math | `shared_components/js/dst-quote-math.js` — 25 jest |
| Calculator UI + state | `calculators/embroidery-contract/embroidery-contract.js` |
| AI context sanitiser + prompt | **proxy** `src/routes/contract-embroidery-ai.js` + `lib/contract-embroidery-ai-prompt.js` |

**Parsing is 100% client-side — the file never uploads.**

🔑 **There is exactly ONE pricing path.** `computeUnit()` in the calculator is the only thing
that turns (rate, stitches) into dollars; `dst-quote-math.combineLines()` takes ALREADY-priced
lines and only sums them + picks the LTM. Never let the math module learn about rates.

## State model (deliberately additive)

```
state.product / state.stitches / state.dst   → LOCATION 1 (top picker + stitch input)
state.extraLines[]                           → locations 2+ (own product + stitches)
```
With `extraLines` empty the behaviour is bit-for-bit what Phase 1 shipped — verified against
live values ($7.20 no-file, $8.47 single file).

`effectiveStitches(line)` clamps to the contract minimum at PRICING time, not in the input.
Clamping the input on each keystroke makes any count whose prefix is below the minimum
impossible to type ("26000" dies at "2").

## Business rules

- **Rate card + fees changed 2026-09-02** (Erik, from `EMBROIDERY_STITCH_COST_2026-09.md`): garments
  $1.25 / 1.10 / **1.10 / 0.95** / 0.85 per 1K (24-47 and 48-71 raised a second time the same day to close
  the mid-tier dip the Break-Even grid showed), caps $1.10 / 1.00 / **1.00 / 0.85** / 0.75 (mid tiers raised the same way), **NO small-order fee**
  (Embroidery_Costs.LTM = 0 on every CTR row; proxy `/contract-pricing` default fee is 0 since
  v2026.09.02.10), and a **$250 order minimum** = Service_Codes `CTR-MIN-ORDER`, applied once in
  `priceAllLines()` after `combineLines` (unit price becomes minimum ÷ qty; every surface reads the
  mutated combo; the AI email gets `orderMinimum` + `minimumApplied`). Erik's same-day revision from
  "$100 fee + $150 min": two rules were confusing and made 23 pcs cost MORE than 24. 🔑 Contract full
  back follows the CONTRACT fee (0), not the DECG-FB ladder fee — that ladder ($100 on 1-7) still
  serves the CUSTOM builder. Script: proxy `scripts/update-contract-card-2026-09.js`
  (dry-run default, `--live`). ⚠️ Laser-patch price on the reference page = cap 8K rate × 8 + $5,
  so it rose $0.80 with the cap rate.
- **Printable price list = `pages/embroidery-contract-pricing.html`** (garments + caps 8K–20K, full-back line,
  terms strip, laser patches; landscape print → Save as PDF). Linked from the calculator's table card
  ("Print price list (PDF)"). Each calculator table tab also states min stitches · fee + band · $150.
- 🔴 Until 2026-09-02 the calculator read `data.ltmFee || 50` — a top-level field the proxy never
  sends — so the garment/cap fee was a hardcoded $50 regardless of Caspio. Now per product from
  `garments.ltmFee` / `caps.ltmFee`.

- **LTM is ONE fee per ORDER at the HIGHEST applicable rate** (Erik, 2026-08-04). A left-chest
  + full-back combo under 24 pcs is **$100**, never $150, never $50.
- **Turnaround is single-head MACHINE-HOURS only** (Erik, 2026-08-04) — no head-count
  assumption, explicitly not a delivery date. The prompt forbids the model converting it.
- **Risk flags are ADVISORY** and never change a price. Thresholds: satin > 12.7 mm, ≥25
  density hotspots at 18 penetrations/mm² (same threshold the Studio ships), > 2.0 trims per
  1K stitches, ≥ 8 colour changes.
- Contract minimums come from the API via `minStitchesFor()`; `PRODUCT_META` is the offline
  fallback only.

## Hard-won gotchas

- 🔴 **DST has no magic bytes.** Any 3-byte record decodes into *some* stitch, so garbage
  "parses" into a plausible count — a silent wrong price. The calculator cross-checks the
  `ST:` header count against the decoded record total (25% tolerance) and refuses loudly.
- 🔴 **The proxy WHITELISTS `calcContext` fields.** Phase 1's `dstFile` was sent for a full day
  and silently dropped — it never reached the model. **Adding a frontend context field is a
  TWO-repo change.**
- 🔴 **Deploy PROXY FIRST.** With an old proxy, a 2-location quote emails as "9,412 stitches,
  $31.87/pc" — pricing one location at the combined rate. New-proxy-with-old-app is safe.
- 🔴 **`Number(null) === 0` and 0 is finite.** An `isFinite` guard turned "no file here" into
  the FACT "0 stitches / 0.0 in / 0 colours" while the prompt said to quote them verbatim.
  Reject empty BEFORE coercing; omit null members so absent ≠ zero.
- 🔴 **Σ LineTotal MUST equal session TotalAmount.** `quote-view.js` sums LineTotal for the
  products table but prints and taxes TotalAmount. Per-line rounding drifts (23¢ at qty 288),
  so the LAST saved line absorbs the residual. The LTM rolls into line 1 only.
- 🔴 **`blur` fires on MOUSEDOWN**, before the click it belongs to — rebuilding cards on blur
  removed the ✕/chip being pressed, so every one needed two clicks. Update in place instead.
- 🔴 **`[hidden]` is a UA rule** and loses to any author `display:` — every hideable element
  here needs `.thing[hidden]{display:none}`. Assert `getComputedStyle().display`, never the
  `.hidden` property (asserting the input you just set proves nothing).
- Thumbnails are rasterised at load and the `points` array released — six locations would
  otherwise pin millions of objects.

## Phase 3 (shipped 2026-08-05)

**Reorder recall.** Every dropped file is fingerprinted (`DSTQuoteMath.fingerprint` —
SHA-256 via `crypto.subtle`, FNV-1a fallback off a secure context) and, on a successful
quote save, bound to `{quoteID, qty, unit, product, at}` in `localStorage`
(`nwca.contractEmb.fileHistory.v1`, newest-first, capped at 60). A re-drop shows
"Quoted before · CEMB-2026-014 · 48 pcs · $8.47/pc · Jul 2". Erik chose localStorage over a
shared store: exact matches, no false positives, no schema change.

**Staff margin overlay.** 🔴 **This calculator is a PUBLIC page** — `app.use('/calculators',
express.static(...))` with no auth, used by outside ASI distributors as well as Ruthie. So
**no cost figure may ever ship in its bundle.** Rates come from
`GET /api/contract-embroidery/cost-model` behind `requireStaff` (app `server.js`), the same
treatment `/pricing/decals` gets "because it exposes cost-side rate bands". `requireStaff`
answers `/api/*` with 401, which doubles as the page's am-I-staff probe, so for everyone else
the panel never renders. Also hidden from `@media print`, and absent from `copyQuoteText`,
`buildCalcContext` (the AI) and the saved quote.

Rates are env-overridable (`EMB_PRODUCTION_HOUR_RATE`, `EMB_ORDER_POOL`,
`EMB_COST_MODEL_AS_OF`) and returned with an `asOf` date so a stale model shows on screen
instead of being silently trusted. Defaults are the settled 2026-07-30 model: $30.09
fully-loaded production hour (art included) + $70 flat order pool.

⚠️ **First real reading: 24 garments × 9,412 stitches quoted −$41.82 (−20.6%)** — revenue
$203.30 against $245.12 of modelled cost (5.8 machine-hours). Worth checking against
`COST_ALLOCATION_MODEL.md` before acting: the biggest levers in the estimate are the
parser's default 750 spm and its 60 s/piece hooping allowance.

**Not built:** the "Open in Embroidery Studio" cross-link — the Studio is fully client-side,
so handing it the file would mean writing its private `localStorage` recents format from
another page. Skipped rather than coupling to another page's internals.
