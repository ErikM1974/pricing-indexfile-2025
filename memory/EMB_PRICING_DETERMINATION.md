# How the Embroidery Quote Builder Determines Every Price

**Single source of truth = Caspio (via the proxy). Nothing is hardcoded except the 10,000-stitch
"included" policy line + last-resort fallbacks.** Verified by **289 automated checks** in
`tests/emb-pricing-matrix-audit.js`, which drive the REAL engines across every boundary and diff
each result against the formula below — itself validated to the live customer pricing pages
(J790 $79, 112 $26). Owner edits a Caspio number → every builder reflects it, no deploy.

---

## 1. The one core formula — garment & cap base price (per piece)

```
unit = ⌈ blank ÷ margin[tier] + firstLogoEmbroidery[tier] ⌉ + sizeUpcharge[size]
```
- **blank** — the SanMar blank for that style **AND color** (`size-pricing`). Color matters: a white
  PC61 ($3.53) is cheaper than a specialty color.
- **margin[tier]** — the markup dial (`Pricing_Tiers.MarginDenominator`): **1-7 = 0.55**, **8+ = 0.53**.
  Lower dial = higher price. 1-7 is gentler because those orders also pay the $50 LTM.
- **firstLogoEmbroidery[tier]** — the included first logo (`Embroidery_Costs`):
  garment **$18/$18/$14/$13/$12**, cap **$17/$17/$13/$11/$10** (1-7/8-23/24-47/48-71/72+).
- **⌈ ⌉** — round **up** to the dollar (`pricing-rules` RoundingMethod = CeilDollar).
- **sizeUpcharge** — 2XL +$2, 3XL +$3, 4XL +$4 (`size-pricing.sizeUpcharges`).

> J790 (blank $34.19) @ 24-47: ⌈34.19/0.53 + 14⌉ = ⌈78.51⌉ = **$79**.  112 cap (blank $6.75) @ 24-47:
> ⌈6.75/0.53 + 13⌉ = ⌈25.74⌉ = **$26**.

## 2. First logo — **10,000 stitches included**
The base price covers one logo. **No surcharge until > 10,000 stitches.**

## 3. Additional stitches on the first logo (> 10K) — flat band
`≤10K = $0 · 10,001–15K = +$4 · 15,001–25K = +$10` (`Embroidery_Costs` AS-Garm / AS-CAP Mid/Large).
Same band for garments and caps. > 25K in a non-full-back spot caps at the Large fee.

## 4. Additional logos (sleeve, 2nd chest, back/nape) — never free
```
unit = base[tier] + max(0, stitches − baseStitches)/1000 × per1K        (al-pricing)
```
- Garment: base **$10/$9/$8/$7.50/$7**, baseStitches **8,000**, **$1.25/1K** over.
- Cap: base **$6.50/$5.50/$4.75/$4.50/$4.25**, baseStitches **5,000**, **$1.00/1K** over.
- Tiered by the **whole order's** piece count.

## 5. Full back
```
unit = max(stitches, 25,000)/1000 × $1.25        (al-pricing.fullBack — ALL stitches, min 25K)
```
> 50K back = 50 × $1.25 = **$62.50/pc**.

## 6. Customer-supplied garments / caps (DECG / DECC)
Customer brings their own blank → embroidery only, **higher tier** (no garment margin + defect risk).
```
unit = base[tier] + max(0, stitches − 8,000)/1000 × per1K + (heavyweight ? $10 : 0)   (decg-pricing)
```
- Garment base **$28/$26/$24/$22/$20** (+$1.25/1K); Cap base **$22.50/$21/$19/$17.50/$16** (+$1.00/1K).
- **Both base 8,000 stitches** (NOT 5K like the regular cap AL — different, higher scheme).
- **Heavyweight +$10/pc** (Carhartt/canvas/leather). Tiered by the DECG line's **own** quantity.

## 7. LTM (less-than-minimum)
`qty ≤ 7 → +$50 for the whole order, spread per piece`. **Garments and caps tier + LTM SEPARATELY** —
each side gets its own $50 if it's ≤7.

## 8. Mixed orders (garments + caps in one quote)
Each side tiers on **its own** piece count, independently. 30 garments + 10 caps → garments price at
**24-47**, caps at **8-23**; no LTM (each side is >7).

## 9. Flat service fees (from `Service_Codes`, owner-editable)
Digitizing $100 · Rush · Monogram · 3D-Puff +$5 · Laser Patch +$5 · Graphic Design $75/hr · Art/Setup.

---

## Caspio tables (the levers)
`Pricing_Tiers` (margins, LTM) · `Embroidery_Costs` (embroidery + stitch band) · `size-pricing`
(SanMar blanks by color) · `al-pricing` (additional logos + full back) · `decg-pricing`
(customer-supplied + heavyweight) · `Service_Codes` (rush/monogram/etc.).

## Verification (289 checks, all pass)
Base × every tier × 4 styles · extended sizes · stitch band · per-color blanks · additional logos
(garment/cap × tiers × stitch) · full back · DECG/DECC × tiers × stitch × heavyweight · LTM ·
mixed orders. Run: `node tests/emb-pricing-matrix-audit.js`.
