# 2026 Pricing Margin Update

## Overview

On January 2, 2026, the pricing margin was updated from 40% to 43% across the system.

## Technical Details

| Value | Old (2025) | New (2026) |
|-------|------------|------------|
| MarginDenominator | 0.60 | 0.57 |
| Effective Margin | 40% | 43% |

**Formula:** `sellingPrice = cost / MarginDenominator`

## API Source

The authoritative margin value comes from the Caspio `Pricing_Tiers` table via the API:
```
/api/pricing-bundle → tiersR[].MarginDenominator
```

Backend updated `Pricing_Tiers.MarginDenominator` from 0.6 to 0.57 for all tiers.

## Frontend Files Updated

### Files Refactored to Use API Value
These files now dynamically get the margin from the API response:

1. **catalog-search.js:1688-1697**
   - `calculateCapPrice()` now accepts `tiersR` parameter
   - Gets `MarginDenominator` from matching tier
   - Fallback: `0.57`

### Files with Updated Hardcoded Values
These files don't have API access, so hardcoded values were updated with comments:

2. **calculators/cap-embroidery-manual-service.js:344**
   - Fallback updated: `quoteData.marginDenominator || 0.57`

3. **calculators/richardson-caps-calculator.js:597-598**
   - Updated: `const marginDenominator = 0.57;`
   - Comment: "2026 margin (43%) - matches API Pricing_Tiers.MarginDenominator"

4. **product-search-service.js:15-16**
   - Updated: `this.MARGIN = 0.57;`
   - Comment: "43% margin (2026) - synced with API Pricing_Tiers.MarginDenominator"

5. **product/components/info.js:90-91**
   - Updated: `const priceWithMargin = lowestCost / 0.57;`
   - Comment: "43% margin (2026) - synced with API MarginDenominator"

## Files Already Using API Values Correctly

These files were already properly using `tier.MarginDenominator` from API:
- `pages/js/3-day-tees.js`
- `calculators/dtg-pricing.html`
- `calculators/screen-print-pricing.html`
- `shared_components/js/cap-embroidery-pricing-service.js`
- `shared_components/js/cap-quote-pricing.js`
- `shared_components/js/dtf-pricing-calculator.js`

## Future Changes

If the margin changes again:
1. Update `Pricing_Tiers.MarginDenominator` in Caspio (backend)
2. Update fallback values in the 5 files listed above
3. Files using API values will automatically get the new margin

## Related Documentation

- Backend update: `caspio-pricing-proxy/MESSAGE_TO_CLAUDE_PRICING_2026_MARGINS.md`
- Pricing formulas: `memory/PRICING_MANUAL_CORE.md`
- API documentation: `memory/CASPIO_API_CORE.md`
