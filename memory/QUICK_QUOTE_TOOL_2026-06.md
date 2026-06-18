# Quick Quote tool (staff rapid all-method price) — 2026-06-18

**DEPLOYED LIVE** `/calculators/quick-quote/` (first v2026.06.18.3; embroidery rework +
price-breaks matrix + catalog copy fix in a later release). Staff dashboard → **"Quoting"**
group → 2nd tile **"Quick Quote"** (green `NEW` badge), under Quote Management.

## THE 3 PRICE SURFACES — all identical, by construction (Erik: keep them in sync)
Exactly three places a price is shown; they MUST always match:
1. **Customer Catalog** — `/catalog` + `product.html` (`pdp-configurator.js`). Customer
   self-serve, simplified (standard size, preset locations, embroidery "up to 10K").
2. **Quick Quote** — `/calculators/quick-quote/`. Staff rapid all-method estimate; more detail
   than the catalog, less ceremony than the builder.
3. **Full Quote Builder** — `/quote-builders/{emb,dtg,screenprint,dtf}-quote-builder.html`. Tool
   of record: customer, sizes, shipping, save, ShopWorks push.
All three price through the SAME path → Caspio via the proxy
(`QuoteCartEngine.singleItemPreview` → the staff `*-pricing-service` classes /
`EmbroideryPricingCalculator` / DTG endpoint). Change a price in Caspio → all three update, no
deploy. Penny-locked by `web-quote-cart-parity.test.js`. NEVER add a 4th pricing path or a
hardcoded number.

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
Type style → qty → placement → every eligible method priced at once. Dashboard **"Quoting"**
group (regrouped from "Quote Builders" into sub-headers: Quick price / Full quote→ShopWorks /
Existing quotes / Customer self-serve) in `staff-dashboard-v3/index.html`, served
`/staff-dashboard.html`. Tee Print-Box Calibration moved to Art & Design (BETA).

## Consistency guarantee (the whole point)
Calls **`QuoteCartEngine.singleItemPreview()`** — the SAME engine the customer catalog
(`pdp-configurator.js`) and the staff Quote Builders use. Zero local price math. So Quick
Quote ↔ catalog ↔ Quote Builder cannot drift. The engine is penny-locked by
`tests/unit/web-quote-cart-parity.test.js`; the tool's own engine-wiring (group shapes,
placement→code maps, all-in per-piece) is canary-locked by
`tests/unit/quick-quote-parity.test.js` (8 tests). **CONFIRMED 2026-06-18 after the placement
rework: web-quote-cart-parity 63/63 + quick-quote-parity 8/8 green → all 3 surfaces still
identical.** RULE: any pricing-related change here → re-run both + re-confirm this memory.

## More-detail-than-catalog features
- **Print placement = independent Front + Back + DTF sleeves** (rework 2026-06-18, Taneisha's
  ask): Front (None / Left chest / Full front / Jumbo) × Back (None / Full back / Jumbo) + DTF
  sleeve checkboxes. Drives **DTG / SCP / DTF only** — embroidery is logo-based and IGNORES it;
  caps hide the print placement entirely (`$('qqPlacementField').hidden = isCap`). Per-method
  mapping: DTG → `dtgCode()` front_back combo (FF_JB / JF_FB have no DTG_Costs data → that card
  shows "unavailable" while SCP/DTF still price); SCP → frontColors + backColors (location SIZE
  is cosmetic — left-chest front == full-front front; sleeves ignored, builder can't either);
  DTF → `dtfLocations()` array, **jumbo → the largest (full) transfer** (DTF has no jumbo),
  sleeves add transfers. `state.front/back/sleeves`. Consistency LOCKED: Quick Quote's
  `DTG_LOCATION_CODES` == the engine's whitelist; DTF maps to the builder's location strings.
  Verified per-pc FF+FB (PC61 24): EMB $21 / DTG $27 / SCP $23.63 / DTF $39; +L sleeve → DTF only.
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
- **Embroidery = LOGO-based, not placement-based** (rework 2026-06-18): EMB/CAP cards IGNORE
  the print-placement chips. "Embroidery logos" panel = primary logo (Left chest / Cap front,
  default 8K) + **"+ Add another logo"** → additional logos each with its own stitch, priced at
  the **AL** rate (garment, $8/pc @ 8K) / **cap-back CB** rate (cap, $4.75/cap) — same services
  as the EMB quote builder (`state.embAddl[]`). Caps: front + **max 1 cap back**, print-placement
  chips HIDDEN. EMB base covers **up to 10,000 stitches** (≤10k = base tier; >10k adds
  AS-GARM/AS-CAP +$4/pc). VERIFIED the engine applies the AS-GARM garment-stitch surcharge as a
  service line → Quick Quote/catalog match the builder (8k=$504, 11k=$600), NO gap. Customer
  catalog copy fixed "8K"→"10K" (6 spots, `pdp-configurator.js`). Matrix per-pc = baseUnit +
  serviceLines/qty so it folds in the stitch/AL/CB surcharge; `ladderKey` includes `embAddl`.
- **Advanced panel** — now just SCP options (front/back ink, dark-garment, safety-stripes);
  embroidery stitch counts moved to the logo panel. Engine accepts arbitrary values; only the
  customer configurator hardcodes them.
- **Price-breaks matrix** (2026-06-18) — under the price, a quantity-tier table for the
  SELECTED method (click a method card; caps auto-select the one method). Engine-authoritative:
  prices a representative qty in each tier through the SAME `singleItemPreview()` the cards use
  (PROBE_QTYS per method), so the ladder can't disagree with the quote. Highlights the current
  qty's tier; small-batch (LTM) fee on its own row. `selectedMethod` auto-follows best value
  until the rep pins one (`methodPinned`); ladders cached by `ladderKey` (style+method+placement
  +ink+stitch+digit+dark+stripe+color). GOTCHA fixed same day: copied `parseRange()` usage from
  the configurator but didn't port the helper → ReferenceError swallowed by the async probe loop
  made it look like a hang (no console error). Lesson: give async build loops a real `catch`.
- **Cache-bust:** quick-quote.{js,css} are referenced with ABSOLUTE paths (`/calculators/quick-quote/…`)
  so the deploy's 2-segment `?v=` bump matches; relative refs (`quick-quote.js?v=`) silently skip
  the bump → returning reps get stale JS.

## Verified live 2026-06-18 (localhost, prices == web-quote-cart-parity fixtures)
PC61 24× LC → EMB $504 / DTG $348 / SCP $453 ($14.50 base + $75 LTM + $30 setup) / DTF $372.
PC61 24× front+back → $696 / $588 / $627 / $756. C112 8K cap 24× → $480. 25 caps stitch
8K=10K=$20/cap, 12K=$24/cap (AS-CAP flat-tier surcharge). PC61 20 S + 5 2XL → 2XL +$2 on
every method (EMB $21.40 wtd, etc.).

## Deferred (post-deploy)
- DTG/DTF exact-location override + sleeves/names/3D-puff left to the full builder. No "copy
  price to clipboard" button yet (possible follow-up). `/api/sizes-by-style-color` 500 still
  open upstream (builders + Quick Quote both fall back to the BLANK-bundle size list).
