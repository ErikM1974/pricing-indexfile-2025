# DTF Pricing System Documentation

## Overview
Two pages share the same DTF pricing formula and must produce identical prices:
1. **DTF Calculator** (`/pricing/dtf`) - Customer-facing pricing page
2. **DTF Quote Builder** (`/dashboards/dtf-quote-builder.html`) - Staff quote builder

Both use 100% API-driven pricing with NO hardcoded fallbacks.

## Files

| Component | File Path |
|-----------|-----------|
| Calculator UI | `shared_components/js/dtf-pricing-calculator.js` |
| Calculator Service | `shared_components/js/dtf-pricing-service.js` |
| Calculator Integration | `shared_components/js/dtf-integration.js` |
| Quote Builder | `shared_components/js/dtf-quote-pricing.js` |
| Config (locations only) | `shared_components/js/dtf-config.js` |
| CSS | `shared_components/css/dtf-toggle-pricing.css` |

## Pricing Formula

```
PRICE = HalfDollarCeil(
    (GarmentCost / MarginDenominator)      // From API: Pricing_Tiers.MarginDenominator
    + TransferCosts                         // From API: DTF_Pricing.unit_price per location
    + (LaborCost × LocationCount)           // From API: DTF_Pricing.PressingLaborCost
    + (FreightCost × LocationCount)         // From API: Transfer_Freight.cost_per_transfer
    + Math.floor((LTM_Fee / Quantity) × 100) / 100  // From API: Pricing_Tiers.LTM_Fee
)
```

### Rounding
```javascript
// HalfDollarCeil - Round UP to nearest $0.50
function roundHalfDollarCeil(price) {
    return Math.ceil(price * 2) / 2;
}
```

### LTM Fee Distribution
```javascript
// Floor to cents to avoid over-charging
const ltmPerUnit = Math.floor((ltmFee / quantity) * 100) / 100;
```

## API Endpoint

```
GET /api/pricing-bundle?method=DTF&styleNumber={STYLE}
```

### Response Fields Used

| Field | Purpose |
|-------|---------|
| `tiersR` | Pricing tiers with MarginDenominator and LTM_Fee |
| `allDtfCostsR` | Transfer prices by size and PressingLaborCost |
| `freightR` | Freight tiers by quantity range |

### Current API Values (as of Jan 2026)

**Pricing Tiers:**
| Tier | MarginDenominator | LTM_Fee |
|------|-------------------|---------|
| 10-23 | 0.57 | $50 |
| 24-47 | 0.57 | $0 |
| 48-71 | 0.57 | $0 |
| 72+ | 0.57 | $0 |

**Labor Cost:** $2.50 per location

**Freight:**
| Qty Range | Cost Per Transfer |
|-----------|-------------------|
| 10-49 | $0.50 |
| 50-99 | $0.35 |
| 100-199 | $0.25 |
| 200+ | $0.15 |

**Transfer Prices (24-47 qty):**
| Size | Dimensions | Price |
|------|------------|-------|
| Small | Up to 5" x 5" | $5.75 |
| Medium | Up to 9" x 12" | $8.75 |
| Large | Up to 12" x 16.5" | $13.00 |

## Location = Size Model

Each print location is locked to a specific transfer size:

**Small Locations:**
- Left Chest, Right Chest
- Left Sleeve, Right Sleeve
- Back of Neck

**Medium Locations:**
- Center Front, Center Back

**Large Locations:**
- Full Front, Full Back

## Price Example

PC61 ($3.53 base) + Left Chest + 24 qty:
```
Garment w/ margin: $3.53 ÷ 0.57 = $6.19
Transfer (small):  $5.75
Labor:             $2.50 × 1 = $2.50
Freight:           $0.50 × 1 = $0.50
LTM:               $0 (24+ qty)
─────────────────────────────────
Subtotal:          $14.94
Rounded:           $15.00
```

## Data Flow

### DTF Calculator
```
1. dtf-pricing-service.js fetches /api/pricing-bundle?method=DTF
2. Service transforms raw API data to: { pricingTiers, transferSizes, freightTiers, laborCostPerLocation }
3. dtf-pricing-calculator.js receives transformed data via mergeApiDataIntoConfig()
4. Calculator detects pre-transformed format and uses it directly
5. dtf-adapter.js sends garment cost via 'dtfAdapterDataReceived' event
6. dtf-integration.js passes garment cost to calculator.updateGarmentCost()
7. Calculator recalculates pricing on location/tier selection
```

### DTF Quote Builder
```
1. DTFPricingService (embedded in dtf-quote-pricing.js) fetches API
2. DTFQuotePricing class uses service methods for pricing lookups
3. calculateUnitPrice() applies the same formula
4. Products with size upcharges use effective cost = baseCost + upcharge
```

## Bug Fix History

### Jan 2026 - Data Format Mismatch Fix

**Problem:** Calculator showed $0.00 even with locations selected.

**Root Cause:** `dtf-pricing-service.js` transforms API data to a different format before passing to calculator:
- Service outputs: `{ pricingTiers, transferSizes, freightTiers }`
- Calculator expected: `{ tiersR, allDtfCostsR, freightR }` (raw format)

**Fix:** Updated `mergeApiDataIntoConfig()` in dtf-pricing-calculator.js to detect pre-transformed data and use it directly:

```javascript
mergeApiDataIntoConfig(apiData) {
    // Check if data is already transformed by dtf-pricing-service.js
    if (apiData.pricingTiers && Array.isArray(apiData.pricingTiers) &&
        apiData.transferSizes && apiData.freightTiers) {

        // Use pre-transformed data directly
        this.pricingTiers = apiData.pricingTiers;
        this.transferPricingTiers = {}; // Extract from transferSizes
        this.freightTiers = apiData.freightTiers;
        this.laborCostPerLocation = apiData.laborCostPerLocation;
        return;
    }

    // Fallback: Process raw API data
    // ...
}
```

**Also fixed:** Removed non-existent `updateFreight()` call from dtf-integration.js. Freight is handled internally via API data.

## Testing Checklist

1. Navigate to `/pricing/dtf?StyleNumber=PC61&COLOR=Rich%20Red`
2. Verify console shows:
   - `[DTF Calculator] Using pre-transformed API data from service`
   - `[DTF Calculator] Transfer pricing tiers loaded: ['small', 'medium', 'large']`
   - `[DTF Calculator] Freight tiers loaded: 4 tiers`
   - `[DTF Calculator] Labor cost from API: 2.5`
   - `[DTF Calculator] Margin denominator from API: 0.57`
3. Select "Left Chest" toggle
4. Verify price displays (NOT $0.00)
5. Test 10-23 tier - verify LTM warning appears
6. Compare with Quote Builder for same inputs

## Critical Rules

1. **NO FALLBACK VALUES** - If API fails, show error (not wrong prices)
2. **Both pages must match** - Any formula change must update both files
3. **API is source of truth** - All pricing values come from Caspio tables
4. **Rounding is FINAL** - HalfDollarCeil applied once at end, not per component
