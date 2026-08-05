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

## Phase 3 (not built)

File-fingerprint reorder recognition ("Quoted before: EMBC-1234"), "Open in Embroidery Studio"
cross-link, staff-gated margin overlay (sew-time × $30.09/hr from `COST_ALLOCATION_MODEL.md` —
the data to finally settle cap 1-7, the only negative cell).
