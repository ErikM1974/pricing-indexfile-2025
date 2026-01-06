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

26. **shared_components/js/dtf-quote-adapter.js:16-17**
    - Updated: `targetMargin: 0.43` and `marginDivisor: 0.57`
    - Comment: "2026 margin (43%) - synced with API"

27. **shared_components/js/jds-api-service.js:17-18**
    - Updated: `MARGIN_DENOMINATOR: 0.57` (was 0.60)
    - Updated: `ENGRAVING_LABOR_COST: 3.00` (was 2.85)
    - Comment: "2026 margin (43%) and labor increase"

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

### Additional Logo (AL) Costs - Garments

| Tier | EmbroideryCost | BaseStitchCount | AdditionalStitchRate |
|------|----------------|-----------------|---------------------|
| 1-23 | $13.50 | 8000 | $1.25/1K |
| 24-47 | $12.50 | 8000 | $1.25/1K |
| 48-71 | $10.50 | 8000 | $1.25/1K |
| 72+ | $9.50 | 8000 | $1.25/1K |

### Additional Logo (AL-CAP) Costs - Caps

| Tier | EmbroideryCost | BaseStitchCount | AdditionalStitchRate |
|------|----------------|-----------------|---------------------|
| 1-23 | $6.75 | 5000 | $1.00/1K |
| 24-47 | $5.75 | 5000 | $1.00/1K |
| 48-71 | $5.50 | 5000 | $1.00/1K |
| 72+ | $5.25 | 5000 | $1.00/1K |

### Key Differences: AL vs AL-CAP

| Property | AL (Garment) | AL-CAP (Cap) |
|----------|--------------|--------------|
| API ItemType | `'AL'` | `'AL-CAP'` |
| BaseStitchCount | 8000 | **5000** |
| AdditionalStitchRate | $1.25/1K | **$1.00/1K** |
| Typical position | Right Chest, Sleeve | Cap Back, Cap Side |

**Formula:** `AL Price = EmbroideryCost + (ExtraStitches / 1000) × AdditionalStitchRate`
- ExtraStitches = max(0, logoStitchCount - BaseStitchCount)

## DTG Print Cost Increase ($0.50)

DTG print costs were increased by $0.50 across all locations and tiers to ensure consistent price increases (the margin change alone left many products with $0 increase due to HalfDollarUp rounding).

### Updated DTG Costs (Caspio `DTG_Costs` table)

#### Left Chest (LC)
| Tier | 2025 Cost | 2026 Cost |
|------|-----------|-----------|
| 12-23 | $8.00 | $8.50 |
| 24-47 | $7.00 | $7.50 |
| 48-71 | $6.00 | $6.50 |
| 72+ | $5.00 | $5.50 |

#### Full Front (FF) / Full Back (FB)
| Tier | 2025 Cost | 2026 Cost |
|------|-----------|-----------|
| 12-23 | $10.50 | $11.00 |
| 24-47 | $9.50 | $10.00 |
| 48-71 | $7.00 | $7.50 |
| 72+ | $6.25 | $6.75 |

#### Jumbo Front (JF) / Jumbo Back (JB)
| Tier | 2025 Cost | 2026 Cost |
|------|-----------|-----------|
| 12-23 | $12.50 | $13.00 |
| 24-47 | $11.50 | $12.00 |
| 48-71 | $9.00 | $9.50 |
| 72+ | $8.25 | $8.75 |

### DTG Pricing Formula
```
DTG Price = HalfDollarUp(garmentCost / MarginDenominator + PrintCost) + SizeUpcharge
HalfDollarUp = Math.ceil(price * 2) / 2  // Rounds UP to nearest $0.50
```

### DTG Frontend Files (No Changes Needed)
DTG pricing is fully API-driven. All 33 DTG-related files use the API endpoint:
```
/api/pricing-bundle?method=DTG&styleNumber=XXX → allDtgCostsR[].PrintCost
```

No hardcoded DTG print costs exist in the frontend - the Caspio update is automatically reflected.

## Future Changes

If pricing changes again:
1. **Margin**: Update `Pricing_Tiers.MarginDenominator` in Caspio, then update 25 frontend fallback files
2. **Embroidery costs**: Update `Embroidery_Costs` table in Caspio (auto-reflects in frontend)
3. **DTG print costs**: Update `DTG_Costs` table in Caspio (auto-reflects in frontend)

Files using API values will automatically get new values with no code changes.

## DTF Transfer Cost Increase (+$0.50) and Labor Increase ($2.00 → $2.50)

DTF pricing was updated to achieve 8-10% price increase (matching embroidery/DTG) and ensure DTF prices remain appropriately higher than DTG (since transfers are purchased externally from Supacolor).

### Updated DTF Costs (Caspio `DTF_Pricing` table)

#### Transfer Costs (unit_price)

| Size | 10-23 | 24-47 | 48-71 | 72+ |
|------|-------|-------|-------|-----|
| Small (≤5"×5") | $6.50 | $5.75 | $4.50 | $3.75 |
| Medium (≤9"×12") | $10.00 | $8.75 | $7.00 | $5.50 |
| Large (≤12"×16.5") | $15.00 | $13.00 | $10.50 | $8.50 |

#### Pressing Labor Cost

| 2025 | 2026 |
|------|------|
| $2.00 | $2.50 |

### Labor Cost Justification

| Employee | Rate | Transfers/hr | Cost/Transfer |
|----------|------|--------------|---------------|
| Brian | $27/hr | 30 | $0.90 |
| Joe | $21/hr | 30 | $0.70 |
| **Burdened avg** | | | **$1.08** |

$2.50 labor = 2.3× burdened cost (industry standard markup)

### DTF Pricing Formula
```
DTF Price = HalfDollarUp(garmentCost / MarginDenominator + TransferCost + Freight + Labor)
HalfDollarUp = Math.ceil(price * 2) / 2  // Rounds UP to nearest $0.50
```

### DTF Frontend Files (No Changes Needed)
DTF pricing is fully API-driven. The Caspio update is automatically reflected.

## JDS Laser Tumbler Labor Increase ($2.85 → $3.00)

JDS laser tumbler engraving labor was increased from $2.85 to $3.00 to match 2026 labor cost increases across other methods.

### Updated JDS Costs (Frontend hardcoded - no Caspio table)

| Fee | 2025 | 2026 |
|-----|------|------|
| Engraving Labor | $2.85 | $3.00 |
| Setup Fee | $75.00 | $75.00 (unchanged) |
| Second Logo | $3.16 | $3.16 (unchanged) |
| Small Order Fee | $50.00 | $50.00 (unchanged) |

### JDS Pricing Formula
```
JDS Price = (JDS Wholesale / MarginDenominator) + EngravingLabor + SetupFee/Qty + SecondLogoPrice
```

## Richardson Caps Calculator Refactor (Jan 2, 2026)

### Changes Made:
1. **Filter SanMar overlap** - Removed 23 Richardson styles that SanMar carries
2. **API embroidery costs** - Now fetches from `/api/pricing-bundle?method=CAP` instead of hardcoded
3. **Fallback values** - Updated to 2026 pricing as backup

### Files Modified:
- `calculators/richardson-caps-calculator.js` - API initialization, filtering logic
- `calculators/richardson-2025.html` - Async initialization call

### SanMar Richardson Styles Filtered Out (23 styles):
```
111, 112, 115, 168, 169, 173, 212, 220, 225, 256, 312, 326, 336, 355, 356,
112FP, 112FPR, 112PFP, 112PL, 112PT, 168P, 256P, 323FPC
```

### Cap Count:
- Before: 156 Richardson styles
- After: 133 Richardson-only styles (not available via SanMar)

### API Endpoints Used:
- `GET /api/decorated-cap-prices?brand=Richardson&tier=72+` - SanMar Richardson styles
- `GET /api/pricing-bundle?method=CAP&styleNumber=112` - Embroidery costs

---

## Related Documentation

- Backend update: `caspio-pricing-proxy/MESSAGE_TO_CLAUDE_PRICING_2026_MARGINS.md`
- Pricing formulas: `memory/PRICING_MANUAL_CORE.md`
- API documentation: `memory/CASPIO_API_CORE.md`
