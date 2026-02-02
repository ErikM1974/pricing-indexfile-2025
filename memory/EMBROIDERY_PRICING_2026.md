# Embroidery Pricing Structure 2026

## Overview
**Effective:** February 2026
**Status:** IMPLEMENTED

This document describes the updated embroidery pricing tier structure implemented in February 2026.

## Tier Structure

| Tier | Qty Range | LTM/Setup Fee | Surcharge | Notes |
|------|-----------|---------------|-----------|-------|
| **1-7** | 1-7 | $50 | — | Setup fee shown separately |
| **8-23** | 8-23 | $0 | +$4/piece | Surcharge baked into EmbroideryCost |
| **24-47** | 24-47 | $0 | — | Standard pricing |
| **48-71** | 48-71 | $0 | — | Volume pricing |
| **72+** | 72+ | $0 | — | Best pricing |

### Key Changes from Previous Structure

**OLD (pre-Feb 2026):**
- 1-23: $50 LTM fee
- 24-47: Standard pricing
- 48-71: Volume pricing
- 72+: Best pricing

**NEW (Feb 2026+):**
- 1-7: $50 setup fee (small orders)
- 8-23: No setup fee, $4 surcharge baked into unit price
- 24-47+: Unchanged

### Business Rationale

1. **Small Orders (1-7):** Higher setup overhead justifies $50 fee
2. **Mid-Tier (8-23):** Competitive pricing removes friction while +$4 surcharge covers additional handling
3. **Volume (24+):** Unchanged - proven pricing structure

## Technical Implementation

### Database Changes (Caspio)

**`Pricing_Tiers` table:**
- Added rows for `1-7` and `8-23` tiers
- `1-7`: LTM_Fee = 50
- `8-23`: LTM_Fee = 0

**`Embroidery_Costs` table:**
- Added costs for new tiers
- `8-23` costs include $4 surcharge (baked into EmbroideryCost)

### Frontend Files Modified

1. **`shared_components/js/embroidery-quote-pricing.js`**
   - `getTier()`: Updated quantity boundaries
   - `this.tiers`: Updated default fallback values
   - LTM logic: Changed from `< 24` to `<= 7`

2. **`shared_components/js/cap-quote-pricing.js`**
   - `getTierLabel()`: Updated quantity boundaries
   - `hasLTM`: Changed from `< 24` to `<= 7`

3. **`shared_components/js/embroidery-pricing-service.js`**
   - `defaultTiers`: Added 1-7 and 8-23 tiers

4. **`shared_components/js/additional-logo-embroidery-simple.js`**
   - `FALLBACK_PRICING`: Added new tier prices
   - `updateCell()` calls: Added new tier cell IDs

5. **`quote-builders/embroidery-quote-builder.html`**
   - Default tier badges: Changed from `1-23` to `1-7`
   - JavaScript fallbacks: Updated all tier references

6. **`calculators/embroidery-pricing.html`**
   - Table headers: Added 1-7 and 8-23 columns
   - Info boxes: Updated text about setup fees
   - Cell IDs: Added `emb-al-1-7` and `emb-al-8-23`

## Pricing Formulas

### Standard Embroidery (8K stitches)

```
DecoratedPrice = (GarmentCost / MarginDenominator) + EmbroideryCost
RoundedPrice = CeilDollar(DecoratedPrice)
```

Where:
- `MarginDenominator` = 0.57 (43% margin)
- `EmbroideryCost` = tier-specific cost from API

### Additional Stitch Charges

```
ExtraStitchCost = ((StitchCount - 8000) / 1000) * $1.25
```

### Full Back Position

```
FullBackCost = (StitchCount / 1000) * $1.25  // All stitches, min 25K
```

## Sales Rep Scripts

### For 1-7 piece orders:
> "For small orders of 1-7 pieces, there's a $50 setup fee to cover the machine setup and digitizing preparation. This ensures quality embroidery even on smaller runs."

### For 8-23 piece orders:
> "Great news! Orders of 8 or more pieces have setup included in the price. No additional fees."

### For upgrades:
> "If you can get your order to 8 pieces, you'll save the $50 setup fee. That often makes it worthwhile to add a few extra items."

## Testing Checklist

- [x] 5 pieces: Verify tier "1-7" + $50 setup fee shown
- [x] 12 pieces: Verify tier "8-23" + NO setup fee
- [x] 30 pieces: Verify tier "24-47" standard pricing
- [x] Cap-only 3 pieces: Verify tier "1-7" + $50 LTM
- [x] Cap-only 15 pieces: Verify tier "8-23" + NO LTM
- [x] Mixed quote: Verify separate tiers for caps/garments

## Related Files

- `/shared_components/js/embroidery-quote-pricing.js` - Core pricing calculator
- `/shared_components/js/cap-quote-pricing.js` - Cap-specific pricing
- `/quote-builders/embroidery-quote-builder.html` - Quote builder UI
- `/calculators/embroidery-pricing.html` - Pricing calculator page
- `/memory/INDEX.md` - Documentation index

## Changelog

- **2026-02-02:** Initial implementation
  - Updated frontend code for new tier structure
  - Caspio tables already updated via script
  - Documentation created
