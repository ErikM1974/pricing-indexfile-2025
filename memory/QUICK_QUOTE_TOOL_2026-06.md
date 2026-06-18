# Quick Quote tool (staff rapid all-method price) — 2026-06-18

## Why
Reps on the phone / mid-order in ShopWorks need a fast price ("how much for 25 PC61
front+back? 25 caps with a 12K-stitch logo?") without the full Quote Builder ceremony
(customer name, shipping, save) and with MORE detail than the customer catalog (which
hardcodes an 8K-stitch logo, bundles locations, hides 2XL+ upcharges). Origin: Taneisha
confusion that the catalog and Quote Builder "showed different prices" — they don't; the
catalog is just a simplified estimator. (Pricing was verified penny-identical first; this
tool fills the rapid-quote gap between the two.)

## What
`/calculators/quick-quote/` — `index.html` + `quick-quote.js` + `quick-quote.css`.
Type style → qty → placement → every eligible method priced at once. Linked from the staff
dashboard "Quote Builders" section (first tile, `fa-bolt`; count 7→8 in
`staff-dashboard-v3/index.html`, served at `/staff-dashboard.html`).

## Consistency guarantee (the whole point)
Calls **`QuoteCartEngine.singleItemPreview()`** — the SAME engine the customer catalog
(`pdp-configurator.js`) and the staff Quote Builders use. Zero local price math. So Quick
Quote ↔ catalog ↔ Quote Builder cannot drift. The engine is penny-locked by
`tests/unit/web-quote-cart-parity.test.js`; the tool's own engine-wiring (group shapes,
placement→code maps, all-in per-piece) is canary-locked by
`tests/unit/quick-quote-parity.test.js` (7 tests).

## More-detail-than-catalog features
- **Cap-aware placements** — detects caps (`/api/product-details` CATEGORY/title), shows
  "Cap front / Front+back" not "Full front/back"; caps → cap embroidery only.
- **Color swatches + product thumbnail** (polish 2026-06-18) — swatch picker (COLOR_SQUARE_IMAGE
  from `/api/product-details`) like the builders + a thumbnail that swaps per color
  (MAIN_IMAGE_URL/FRONT_MODEL). Color change re-prices (EMB cost varies by color).
- **Real per-style sizes** (polish 2026-06-18) — size run pulled from
  **`/api/pricing-bundle?method=BLANK&styleNumber=`** `.sizes[]` (PC61 = S…6XL, caps = OSFA);
  single-size products hide the "Add sizes" toggle. ⚠️ GOTCHA: `/api/sizes-by-style-color`
  (what the quote builders call) is currently **500ing upstream for every style/color** — the
  builders fall back to a hardcoded S–4XL list too. The BLANK bundle is the reliable source
  AND is already cached (engine fetches it for DTF/SCP). Sizes are style-level in that feed
  (not per-color), which is fine.
- **Per-size breakdown** ("Add sizes") — engine applies real 2XL…6XL upcharges per size
  (catalog quotes the standard size only and hides them). Verified: PC61 20 S + 4 5XL → EMB
  $22.00/pc wtd (5XL +$6).
- **Advanced panel** — exact stitch count (EMB primary + back), digitizing toggle, SCP
  front/back ink + dark-garment + safety-stripes. The engine already accepts arbitrary
  values; only the customer configurator hardcoded them.

## Verified live 2026-06-18 (localhost, prices == web-quote-cart-parity fixtures)
PC61 24× LC → EMB $504 / DTG $348 / SCP $453 ($14.50 base + $75 LTM + $30 setup) / DTF $372.
PC61 24× front+back → $696 / $588 / $627 / $756. C112 8K cap 24× → $480. 25 caps stitch
8K=10K=$20/cap, 12K=$24/cap (AS-CAP flat-tier surcharge). PC61 20 S + 5 2XL → 2XL +$2 on
every method (EMB $21.40 wtd, etc.).

## Not done / deferred
- Not deployed (built on develop, verified local). Deploy is Erik's call.
- DTG/DTF exact-location override + sleeves/names/3D-puff left to the full builder (advanced
  panel notes this). No "copy price to clipboard" button yet (possible follow-up).
