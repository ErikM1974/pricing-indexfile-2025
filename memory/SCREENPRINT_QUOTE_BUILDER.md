# Screen Print Quote Builder 2026

**Status:** Production Ready
**Audit Date:** 2026-01-06
**Branch:** `screenprint`

---

## Overview

The Screen Print Quote Builder 2026 is an Excel-style spreadsheet quote builder that replaced the legacy 3-phase wizard layout. It matches the UI pattern established in the DTG and Embroidery Quote Builders for consistent user experience across all quote types.

### Key Features
- Excel-style product table with S/M/L/XL/2XL columns
- Child rows for extended sizes (3XL, 4XL, youth, tall)
- Per-location ink color selection (1-6 colors)
- Dark garment toggle (adds white underbase)
- Safety stripes toggle (+$2/piece/location)
- Real-time setup fee calculation
- Real-time pricing sidebar
- Quote saving with SPC prefix

---

## Key Files

| File | Purpose |
|------|---------|
| `/quote-builders/screenprint-quote-builder-new.html` | Main quote builder (~6000 lines) |
| `/shared_components/js/screenprint-pricing-service.js` | Core pricing engine (656 lines) |
| `/shared_components/js/screenprint-quote-service.js` | Quote save/load operations |
| `/shared_components/js/screenprint-quote-pricing.js` | Pricing calculations |
| `/shared_components/js/exact-match-search.js` | Style search autocomplete |

---

## Print Configuration State

```javascript
const printConfig = {
    isDarkGarment: false,      // Adds +1 underbase screen per location
    safetyStripes: false,      // Adds +$2/piece per location
    locations: [
        {
            id: 'front',
            type: 'LC',        // LC, FF, JF
            colorCount: 1,     // 1-6 ink colors
            enabled: true
        },
        {
            id: 'back',
            type: 'FB',        // FB, JB
            colorCount: 2,     // 1-6 ink colors
            enabled: true
        }
    ],
    totalScreens: 0,           // Calculated
    setupFee: 0                // Calculated: screens × $30
};
```

---

## Setup Fee Calculation

### Formula
```
Setup Fee = (colorCount + underbase) × $30 × numberOfLocations
```

### Examples
| Scenario | Calculation | Total |
|----------|-------------|-------|
| 1-color front, light garment | 1 × $30 | $30 |
| 3-color front, light garment | 3 × $30 | $90 |
| 3-color front, dark garment | (3 + 1) × $30 | $120 |
| 2-color front + 2-color back, dark | (3 + 3) × $30 | $180 |

### Implementation
```javascript
function calculateSetupFees(printConfig) {
    let totalScreens = 0;

    printConfig.locations.forEach(loc => {
        if (loc.enabled && loc.colorCount > 0) {
            let screens = loc.colorCount;

            // Add underbase for dark garments
            if (printConfig.isDarkGarment) {
                screens += 1;
            }

            totalScreens += screens;
        }
    });

    return {
        screens: totalScreens,
        fee: totalScreens * 30
    };
}
```

---

## Safety Stripes

- **Cost:** $2.00 per piece per location
- **Use Case:** Hi-Vis garments requiring reflective stripe printing
- **Calculation:** If 2 locations enabled, add $4.00 per piece

```javascript
const safetyStripeCost = printConfig.safetyStripes
    ? enabledLocationCount * 2.00
    : 0;
```

---

## Dark Garment Underbase

When `isDarkGarment` is checked:
- Adds +1 screen to each enabled location
- Represents white underbase required for color vibrancy on dark fabrics
- Applied globally to all locations

---

## Pricing Tiers

Screen Print uses different tiers than DTG:

| Tier | Quantity Range | Notes |
|------|----------------|-------|
| 24-36 | 24-36 pieces | Base tier |
| 37-72 | 37-72 pieces | Better pricing |
| 73-144 | 73-144 pieces | Volume pricing |
| 145+ | 145+ pieces | Best pricing |

**LTM (Less Than Minimum):** Orders under 24 pieces use 24-36 tier pricing + $50 LTM fee.

---

## Price Calculation Formula

```javascript
// Per-piece price calculation
unitPrice = HalfDollarUp(
    (garmentCost / marginDenominator) +
    printCost +
    flashCharge +
    sizeUpcharge +
    safetyStripeCost
);

// HalfDollarUp rounding
function halfDollarUp(price) {
    return Math.ceil(price * 2) / 2;
}
```

### Components
| Factor | Source | Notes |
|--------|--------|-------|
| Garment Cost | API `sizes[].price` | Base cost from SanMar |
| Margin Denominator | API `tiersR[].MarginDenominator` | Typically 0.57-0.65 |
| Print Cost | API based on location + colors + tier | Varies by configuration |
| Flash Charge | Per-color charge | Applied per ink color |
| Size Upcharge | API `sellingPriceDisplayAddOns` | 2XL: +$2, 3XL: +$3, etc. |
| Safety Stripes | $2/location if enabled | Optional add-on |

---

## API Integration

### Endpoint
```
/api/pricing-bundle?method=ScreenPrint&styleNumber=PC54
```

### Service Class
```javascript
import ScreenPrintPricingService from './screenprint-pricing-service.js';

const service = new ScreenPrintPricingService();
const pricingData = await service.fetchPricingData(styleNumber);
```

### Key Methods
- `fetchPricingData(styleNumber)` - Get pricing data from API
- `calculatePricing(config)` - Calculate prices based on configuration
- `transformToExistingFormat(data)` - Normalize API response

---

## Print Locations

### Front Locations (Pick One)
| Code | Name | Size |
|------|------|------|
| LC | Left Chest | 4" × 4" |
| FF | Full Front | 12" × 16" |
| JF | Jumbo Front | 16" × 20" |

### Back Locations (Optional)
| Code | Name | Size |
|------|------|------|
| FB | Full Back | 12" × 16" |
| JB | Jumbo Back | 16" × 20" |

---

## UI Components

### Sidebar Updates
The `updateSidebarPrintConfig()` function refreshes:
- Location display with color counts
- Screen count per location
- Total screens and setup fee
- Safety stripes indicator
- Grand total including setup

### State Management
- `updatePrintConfig()` reads all UI inputs
- Triggers `recalculatePricing()` for all products
- Updates sidebar display in real-time

---

## Quote ID Format

```
SPC[MMDD]-[sequence]

Example: SPC0106-001
```

---

## Testing Checklist

### Setup Fee Verification
- [ ] 1-color front, light garment = 1 screen × $30 = $30
- [ ] 3-color front, light garment = 3 screens × $30 = $90
- [ ] 3-color front, dark garment = 4 screens × $30 = $120
- [ ] 2-color front + 2-color back, dark = 6 screens × $30 = $180

### Pricing Verification
- [ ] Prices match screen print calculator
- [ ] 2XL shows +$2 upcharge
- [ ] 3XL shows +$3 upcharge
- [ ] Safety stripes adds $2/piece/location
- [ ] LTM applies for <24 pieces

### UI Verification
- [ ] Dark garment toggle updates screen counts
- [ ] Ink color selectors work (1-6 per location)
- [ ] Safety stripes toggle updates pricing
- [ ] Sidebar reflects all configuration changes
- [ ] Copy to clipboard includes print config

---

## Related Documentation

- `/docs/SCREENPRINT_QUOTE_BUILDER_NEW_PR.md` - Original PR/spec document
- `/memory/QUOTE_BUILDER_GUIDE.md` - General quote builder patterns
- `/memory/DTG_QUOTE_BUILDER.md` - DTG builder (similar pattern)

---

**Created:** 2026-01-06
**Last Audit:** 2026-01-06 (PASSED)
