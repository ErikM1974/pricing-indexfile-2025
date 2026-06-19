# Custom & Oversize Decal Pricing (square-foot) — shipped 2026-06-18

The standard `Sticker_Pricing` grid (2×2–6×6, qty 50+) can't price oversize logo
decals (12", 18", 24"+), odd/custom dimensions, mixed-size orders, or sub-50 runs.
This adds a **square-foot rate ladder** for exactly those, alongside (not replacing)
the banner rate card and the standard sticker grid. Origin: a real VCT / Veneer Chip
Transport quote (Dynamic Travel / Ratel Transport logo decals, 6"×6"/12"/18").

## The model (THE 4th pricing surface for stickers — keep all surfaces in sync)

```
totalSqFt = Σ (W" × H" ÷ 144) × qty          # WHOLE-ORDER, summed across sizes
material  = max( totalSqFt × rate(totalSqFt), tierFloor )
quote     = material + $50 GRT-50 setup (new art; waived if on file) + sales tax
```

**Rate ladder** (calibrated to the 6×6 grid column — matches within ~3%):

| Total finished sq ft | Rate | Cliff floor (never less than) |
|---|---|---|
| up to 50 | $12.00/sqft | $90 minimum |
| 50–125 | $9.50 | $600.00 (= 50 × $12) |
| 125–250 | $7.50 | $1,187.50 (= 125 × $9.50) |
| 250–500 | $6.00 | $1,875.00 (= 250 × $7.50) |
| 500–1000 | $5.25 | $3,000.00 (= 500 × $6) |
| over 1000 | $4.80 | $5,250.00 (= 1000 × $5.25) |

- **Cliff floors are AUTO-DERIVED** from the ladder (floor = prev tier MaxSqFt × prev rate),
  NOT stored — change a rate in Caspio and the floors recompute. They guarantee a bigger
  order can never cost less than a smaller one (Erik's spec §5). Verified by a 1→2000 sqft
  monotonic sweep test.
- **Whole-order banding** (not per-line): VCT 6×(6×6)+10×(12×12)+10×(18×18) = 34 sqft →
  34 × $12 = **$408** + $50 = $458 + 10.1% Milton tax = **$504.26**.
- Ganging/contour-cut/weeding/waste are baked into the rate (priced on finished decal size,
  NOT Roland roll layout). NEVER add a separate weeding charge.
- Odd shapes → bounding box (10" circle = 10×10). Roland safe width 52" (configurable via
  API `safeRollWidthIn`) — if BOTH dims > 52" → paneling/custom-review warning.

## Files (keep the inline ladder, frontend compute, and test IN SYNC)

- **Proxy route**: `caspio-pricing-proxy/src/routes/custom-decal-pricing.js` — `GET /api/custom-decal-pricing`
  (rate card + derived floors + safeRollWidthIn) and `/quote` (computeDecalQuote: single OR `items[]`).
  Inline fallback ladder = source of truth until Caspio table exists. Mounted in `server.js` (`app.use('/api', …)`).
- **AI bot**: `contract-sticker-ai.js` new `quote_custom_decal` tool (`items[]`, whole-order) + executor;
  `lib/contract-sticker-ai-prompt.js` routes oversize (>6×6) to sq-ft pricing instead of "manual quote".
  `quote_sticker_price` offGrid(oversize_dimension) now returns `useTool: quote_custom_decal`.
- **Frontend**: `calculators/sticker-manual-pricing.html` (`#decalAccordion` card), `sticker-pricing-page.js`
  (`loadAndRenderDecalPricing`/`wireDecalCalculator`/`recomputeDecal` — fetches the API, NO hardcoded prices),
  `sticker-pricing-page.css` (`.decal-*`). Cache-bust JS `?v=2026.06.18.6`, CSS `?v=20260618-decal`.
- **Test**: `caspio-pricing-proxy/tests/jest/custom-decal-pricing.test.js` — 12 tests, locks the ladder +
  Erik's 6 spec test cases + the monotonic sweep.
- **Caspio table** `Custom_Decal_Pricing` — **CREATED + CONNECTED 2026-06-18 (verified `source: caspio`).**
  Cols: PartNumber/Description/Notes=Text(255), MinSqFt/MaxSqFt/FlatAmount=Integer, RatePerSqFt=Number.
  6 tier rows (DECAL-SQFT-T1..T6) + DECAL-MIN (FlatAmount=90). Edit `RatePerSqFt`/`FlatAmount` in Caspio →
  live, no deploy (floors auto-derive). Import CSV (gitignored, on Erik's disk + Downloads):
  `caspio-pricing-proxy/scripts/custom-decal-pricing-caspio-import.csv`.

## Deploy

- Proxy: Heroku **v817** (2026-06-18), develop→heroku/main. Live verified: `/api/custom-decal-pricing` +
  `/quote` return correct ladder/floors; source `inline`.
- Frontend: shipped 2026-06-18 (calculator verified in preview against live proxy — VCT = $504.26, cliff,
  width warning, art-waive all correct, no console errors).
- **DONE 2026-06-18**: `Custom_Decal_Pricing` Caspio table created + CSV imported; endpoint verified
  serving `source: caspio`. Rates now editable in Caspio with no deploy.
