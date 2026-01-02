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

### Service Files with Updated Fallback Values
These files use API values when available but have fallback defaults that were updated:

6. **shared_components/js/dtg-pricing-service.js:443, 477**
   - Fallback tiers updated: `MarginDenominator: 0.57`
   - Comment: "2026 margin (43%)"

7. **shared_components/js/cap-embroidery-pricing-service.js:80-82**
   - Default tier array updated: `MarginDenominator: 0.57` for all tiers
   - Comment: "2026 margin (43%)"

8. **shared_components/js/dtf-pricing-service.js:319, 322**
   - Fallback returns updated: `return 0.57`
   - Comment: "2026 margin (43%)"

### Additional Files Updated (Session 2)

9. **calculators/cap-embroidery-pricing-integrated.html:1449**
   - Fixed hardcoded margin in `calculateCapPrice()` function
   - Now reads from API with 0.57 fallback

10. **shared_components/js/embroidery-quote-pricing.js:18**
    - Updated: `this.marginDenominator = 0.57`
    - Comment: "2026 margin (43%) - synced with API"

11. **shared_components/js/dtf-config.js:101**
    - Updated: `garmentMargin: 0.57`
    - Comment: "43% margin (2026) - synced with API"

12. **pages/top-sellers-showcase.html:177, 801**
    - Updated sample pricing calculations to use 0.57

### Test Files Updated
Test configuration and fallback values updated for consistency:

13. **tests/unit/test-profitability-analysis.js:28** - `marginDenominator: 0.57`
14. **tests/unit/test-premium-strategy.js:85, 90** - `this.marginDenominator = 0.57`
15. **tests/unit/test-optimal-profitability.js:81, 90** - `this.marginDenominator = 0.57`
16. **tests/unit/test-machine-utilization.js:74, 85** - `this.marginDenominator = 0.57`
17. **tests/unit/test-ltm-optimization.js:93, 102** - `this.marginDenominator = 0.57`
18. **tests/unit/test-full-overhead-analysis.js:142, 147** - `this.marginDenominator = 0.57`
19. **tests/unit/test-embroidery-price-optimization.js:40, 106** - `this.marginDenominator = 0.57`
20. **tests/unit/test-cap-profitability-analysis.js:47, 259** - `this.marginDenominator = 0.57`
21. **tests/unit/test-all-cap-styles.js** - Updated margin and embroidery costs for 2026

### Additional Files Updated (Session 3 - Audit)

22. **calculators/cap-embroidery-manual-pricing.html:798**
    - Updated: `garmentMargin: 0.57`
    - Comment: "43% margin (2026) - synced with API"

23. **shared_components/js/cap-quote-pricing.js:517, 532**
    - Fallback values updated: `return 0.57` and `|| 0.57`
    - Comment: "2026 margin fallback"

24. **shared_components/js/embroidery-pricing-service.js:82-84**
    - Default tiers updated: `MarginDenominator: 0.57`
    - Comment: "2026 margin (43%)"

25. **shared_components/js/embroidery-quote-pricing.js:65**
    - Fallback updated: `|| 0.57`
    - Comment: "2026 fallback"

## Files Using API Values Correctly (No Changes Needed)

These files properly use `tier.MarginDenominator` from API with no hardcoded fallbacks:
- `pages/js/3-day-tees.js`
- `calculators/dtg-pricing.html`
- `calculators/screen-print-pricing.html`

## Embroidery Cost Increase ($1.00)

In addition to the margin change, embroidery costs were increased by $1.00 across all tiers to ensure price increases on all products (including cheap items where rounding absorbed the margin change).

### Updated Embroidery Costs (Caspio `Embroidery_Costs` table)

| Tier | Item Type | 2025 Cost | 2026 Cost |
|------|-----------|-----------|-----------|
| 1-23 | Shirt | $15.00 | $16.00 |
| 24-47 | Shirt | $13.00 | $14.00 |
| 48-71 | Shirt | $12.00 | $13.00 |
| 72+ | Shirt | $11.00 | $12.00 |
| 1-23 | Cap | $12.00 | $13.00 |
| 24-47 | Cap | $12.00 | $13.00 |
| 48-71 | Cap | $10.00 | $11.00 |
| 72+ | Cap | $8.50 | $9.50 |

See `MESSAGE_TO_CASPIO_PROXY_EMBROIDERY_INCREASE.md` for full details including AL/AL-CAP tiers.

## Future Changes

If the margin changes again:
1. Update `Pricing_Tiers.MarginDenominator` in Caspio (backend)
2. Update fallback values in the 25 files listed above
3. Files using API values will automatically get the new margin

## Related Documentation

- Backend update: `caspio-pricing-proxy/MESSAGE_TO_CLAUDE_PRICING_2026_MARGINS.md`
- Pricing formulas: `memory/PRICING_MANUAL_CORE.md`
- API documentation: `memory/CASPIO_API_CORE.md`
