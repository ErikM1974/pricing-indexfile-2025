# EMB Quote Builder ↔ Pricing Pages — Sync Reference (2026-06-06)

**The embroidery quote builder now prices identically to the customer pricing pages.** Single source of truth = Caspio (via the proxy). Nothing hardcoded except last-resort fallbacks + the 10K "included" policy boundary.

## The two customer pricing pages (the source of truth for "what we publish")
- **Garment:** `teamnwca.com/pricing/embroidery?StyleNumber=XXX` → `calculators/embroidery-pricing.html`
- **Cap:** `teamnwca.com/pricing/cap-embroidery?StyleNumber=XXX` → `calculators/cap-embroidery-pricing-integrated.html` (+ shared render in `catalog-search.js`)

## Verified parity (live, from Caspio)
| | Blank | 8-23 | 24-47 | 48-71 | 72+ |
|---|---|---|---|---|---|
| **J790 garment** | $34.19 | $83 | **$79** | $78 | $77 |
| **112 cap** | $6.75 | $30 | **$26** | $24 | $23 |

Builder == page on every tier. Locked by `tests/unit/emb-margin-stitch-band.test.js` (976-test suite green).

## The pricing model (every charge → Caspio source)
- **Garment/cap base** = `size-pricing` blank ÷ **per-tier `MarginDenominator`** (`Pricing_Tiers`), then **+ first-logo embroidery** (`Embroidery_Costs`, Shirt/Cap by tier), **rounded UP to the dollar** (`pricing-rules` RoundingMethod=CeilDollar).
- **Margin per tier (N2):** 1-7 = **0.55** (lower margin to offset the $50 LTM on small orders — Erik's call), 8+ = **0.53**. Helpers `getMarginDenominator(tier)` / `getCapMarginDenominator(tier)` read the tier's own value.
- **First logo = 10,000 stitches included** everywhere (page wording + surcharge threshold). Built on an 8K cost basis internally; customer gets up to 10K free.
- **Additional stitches (first logo >10K):** flat band **$0 / +$4 (10-15K) / +$10 (15-25K)** from `Embroidery_Costs` AS-Garm **Mid/Large rows by `TierLabel`**; >25K caps at the Large fee (from Caspio). Same band for caps (AS-CAP, identical values).
- **Additional logo:** **base by tier + per-1K over base** — garment $10/$9/$8/$7.50/$7 + **$1.25/1K over 8K**; cap $6.50/$5.50/$4.75/$4.50/$4.25 + **$1.00/1K over 5K** (`al-pricing`). NOT a flat band — kept per-1K to match the customer pages. Never free.
- **LTM:** $50 **per ORDER** (not per piece) at qty ≤7, spread across pieces (`Pricing_Tiers.LTM_Fee`).
- **Full Back (>25K):** `Service_Codes` FB rate + base.

## The bug that was fixed (2026-06-06)
**N2 margin flatten:** code read `tiersR[0].MarginDenominator` and applied it to ALL tiers. Garment `tiersR[0]` = 1-7 = 0.55 → every 8+ garment order was marked up at 0.55 instead of 0.53 → **under-charged ~$2-3/pc** (J790 24-47 showed $77 vs the page's $79). Cap got lucky (capTiersR[0] = 24-47 = 0.53, already correct). Fix = per-tier lookup. The customer pages already used 0.53 — they were right; only the builder was wrong.

**Stitch band fragility (D1):** parse used positional `[0]/[1]` over duplicate `ALL` + `Mid/Large` rows — correct only by luck, and it read the legacy `ALL` rows, so editing the Mid/Large price in Caspio did nothing. Now reads Mid/Large by label → Caspio edits take effect.

## Customer-Supplied (DECG / DECC) — `teamnwca.com/pricing/...` customer-supplied tab
Customer brings their OWN blank (e.g., 24 J790s from us + 2 of their own jackets); we charge embroidery ONLY at a HIGHER tier (no garment margin + defect risk). Source `/api/decg-pricing` (`Embroidery_Costs` DECG-Garmt / DECG-Cap), garment vs cap by chip.
- **DECG garment:** $28/$26/$24/$22/$20 · **DECC cap:** $22.50/$21/$19/$17.50/$16 · **base 8,000 for BOTH** · +$1.25/1K garment, +$1.00/1K cap · +$50 LTM at qty ≤7.
- **Tiered by the DECG line's OWN quantity** (2 customer pieces → 1-7 tier), not the order total.
- **DECC cap base = 8,000** (NOT 5,000 like the regular additional-logo cap — customer-supplied is a different scheme). The API returns `baseStitches: null`, so the code's `|| 8000` fallback is operative. (A 2026-06-06 edit briefly set it to 5,000 → over-charged ~$3/pc on 8K caps; fixed same session, never deployed.)
- **Heavyweight toggle — DONE 2026-06-06:** DECG/DECC chips now have a "Heavyweight +$10" checkbox → `addDECGLineItem(itemType, stitches, heavyweight)` → `calculateDECGPrice(…, heavyweight)` adds `heavyweightSurcharge` ($10 from `/api/decg-pricing`, NOT hardcoded). Persists via `SizeBreakdown` (also fixed a pre-existing bug: DECG stitchCount wasn't being saved → restored to 8K). Added a reusable `type:'checkbox'` field to the shared services bar (`quote-services-bar.js`) + `.sci-check` CSS. Verified: garment 8K→$34, cap 8K→$29, stacks with stitches (13K heavy garment = $40.25).

## Pending
- **Caspio cleanup:** delete the 8 legacy `ALL` AS rows from `Embroidery_Costs` (PK 235/236/237/238 + the now-redundant duplicates) via the proxy, AFTER the code deploys. Mid/Large rows (241-244) stay.
- **Deploy: DONE 2026-06-06** — v2026.06.06.3 (Heroku release v1250). Verified live: cache-bust `?v=2026.06.06.3`, deployed pricing JS has `getMarginDenominator`, service has `heavyweightSurcharge`, both pages read "10,000 stitches." GitHub synced (main+develop+tag). Includes N2 + band re-source + AL/DECG fallbacks + DECC 8K-base + heavyweight toggle + 10K wording.
- **Staff calc nits (`embroidery-pricing-all`):** first-logo note says "$1.25/1K" (should be the flat band); cap AL note says "8,000" (should be 5,000). Non-customer-facing.

## Files
- `shared_components/js/embroidery-quote-pricing.js` — margin helpers (L862/L889 area), band parse (L166-210), `getStitchSurcharge` (L859)
- `shared_components/js/embroidery-pricing-service.js` — `calculateALPrice` / `calculateDECGPrice` (category-aware fallbacks)
- `calculators/embroidery-pricing.html`, `calculators/cap-embroidery-pricing-integrated.html`, `catalog-search.js` — "10,000 stitches" wording
- `tests/unit/emb-margin-stitch-band.test.js` — locks J790/112 + band edges
