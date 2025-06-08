# Cap Embroidery Beta Technical Documentation

## Architecture Overview

The new cap embroidery page uses a simplified architecture that maintains compatibility with existing systems while fixing critical bugs.

## File Structure

```
cap-embroidery-pricing-integrated.html
├── HTML Structure
│   ├── Hidden Caspio container
│   ├── Header (existing universal-header)
│   ├── Hero section (product info + quick quote)
│   └── Main content (options + pricing table)
├── CSS (embedded)
│   └── Clean, maintainable styles
└── JavaScript
    ├── External dependencies (Caspio, existing scripts)
    └── Main implementation (embedded)
```

## Key Components

### 1. Caspio Integration

```javascript
// Hidden iframe loads Caspio data
const caspioSrc = `https://c3eku948.caspio.com/dp/a0e15000c5d8e1f2e9e94c3c9a5a/emb?StyleNumber=${styleNumber}`;
```

**Important**: The Caspio iframe is hidden but MUST load for pricing to work.

### 2. Global Variables

Must be set BEFORE scripts load:
```javascript
window.selectedStyleNumber = state.styleNumber;
window.selectedCatalogColor = state.selectedColor;
```

### 3. Pricing Calculation

```javascript
// Get base price from Caspio tier
const tier = pricingTiers.find(t => quantity >= t.min && quantity <= t.max);
const basePrice = tier.price;

// Add stitch count upcharge
if (stitchCount === 10000) additionalCosts += 1;

// Add back logo (per 1,000 stitches)
if (backLogoEnabled) {
    additionalCosts += Math.ceil(backLogoStitches / 1000);
}

// Add LTM fee if under 24
if (quantity < 24) {
    ltmFeePerUnit = 50 / quantity;
}

unitPrice = basePrice + additionalCosts + ltmFeePerUnit;
```

### 4. Event Listeners

```javascript
// Caspio data loaded
window.addEventListener('pricingDataLoaded', function(event) {
    // Extract pricing tiers from event.detail
    updatePricingTiers(event.detail);
});

// Color selected
document.addEventListener('colorSelected', function(event) {
    updateProductImage(event.detail.colorName);
});
```

## Data Sources

### 1. Pricing Data
- **Source**: Caspio database
- **Access**: Via `window.nwcaPricingData`
- **Format**: 
  ```javascript
  {
    prices: { 'OSFA': { '24-47': 24, '48-71': 23, '72+': 21 } },
    tierData: { '24-47': { min: 24, max: 47 } }
  }
  ```

### 2. Product Data
- **Style Number**: From URL parameter
- **Colors**: From inventory API via dp5-helper.js
- **Images**: `https://www.companycasuals.com/mmCOMPANYCASUALS/Images/[Style]/[Color].jpg`

## Critical Functions

### 1. `loadCaspioData()`
- Creates hidden iframe with style parameter
- Triggers pricing matrix capture
- Must complete before pricing works

### 2. `updatePricing()`
- Reads current quantity and options
- Calculates price using Caspio data
- Updates all display elements

### 3. `fixPricingTable()`
- Adds missing 24-47 tier if needed
- Ensures all tiers display correctly

## Troubleshooting

### Problem: No pricing data
**Solution**: Check Caspio iframe is loading. Look for:
```
[PRICING-MATRIX:CHECK] Pricing table found. Attempting capture.
```

### Problem: Wrong prices showing
**Solution**: Ensure `cap-embroidery-ltm-fix.js` is NOT overriding with hardcoded values.

### Problem: No color swatches
**Solution**: Check product exists in inventory. Try known good style like NE1000.

### Problem: $18 instead of $24
**Solution**: This is the bug we fixed! Make sure you're using the new page, not the old one.

## Maintenance

### To Update Pricing
1. Change in Caspio database
2. Page will automatically use new prices
3. No code changes needed

### To Add Stitch Count Options
1. Update dropdown HTML
2. Add pricing logic for new options
3. Test calculator updates correctly

### To Modify Back Logo Pricing
1. Find `Math.ceil(backLogoStitches / 1000)`
2. Adjust calculation as needed
3. Update display text to match

## Dependencies

**Required Scripts** (in order):
1. `debug-config.js`
2. `nwca-namespace.js`
3. `pricing-matrix-api.js`
4. `pricing-matrix-capture.js`
5. `dp5-helper.js`
6. `cap-embroidery-controller-v2.js`
7. `clean-color-adapter.js`

**DO NOT INCLUDE**: `cap-embroidery-ltm-fix.js` (has the $18 bug)

## Security Notes

- All pricing comes from Caspio (server-side)
- No sensitive data in client-side code
- URL parameters are sanitized
- No direct database access from browser