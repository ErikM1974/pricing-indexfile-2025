# Cap Embroidery Beta Implementation Guide

## Overview

This document describes the complete implementation of the new cap embroidery pricing page that fixes all issues with the original page while maintaining full functionality.

## Problems with Original Page

1. **Pricing Bug**: Shows $18 for 24-47 caps when Caspio data says $24
2. **Code Complexity**: 20+ JavaScript files with conflicting logic
3. **Hardcoded Override**: `cap-embroidery-ltm-fix.js` overrides Caspio data with wrong values
4. **Maintenance Nightmare**: Too many files, unclear data flow

## New Implementation Features

### 1. Dynamic Pricing from Caspio
- Loads pricing tiers directly from Caspio database
- No hardcoded price overrides
- Updates automatically when database changes

### 2. Quick Quote Calculator
- **Quantity Input**: +/- buttons, manual entry (1-10,000)
- **Instant Updates**: Price changes immediately
- **Pricing Formula**:
  ```
  Base Price (from Caspio tier)
  + Stitch Count Upcharge (10k: +$1, 15k: +$2)
  + Back Logo ($1 per 1,000 stitches)
  + LTM Fee (if < 24: $50 ÷ quantity)
  = Unit Price
  ```

### 3. Stitch Count Options
- **Dropdown**: 5,000 / 8,000 / 10,000 stitches
- **Pricing Impact**:
  - 5,000: May be cheaper (depends on Caspio)
  - 8,000: Standard price
  - 10,000: +$1.00 per cap

### 4. Back Logo Feature
- **Checkbox**: Enable/disable back logo
- **Stitch Counter**: 5,000-15,000 (increment by 1,000)
- **Pricing**: $1 per 1,000 stitches
  - 5,000 stitches = $5
  - 10,000 stitches = $10
  - 15,000 stitches = $15

### 5. Color Selection
- **Color Swatches**: Click to change product color
- **Updates**: Product image changes with color
- **Selected Display**: Shows current color name

### 6. Pricing Table
- **Dynamic**: Populated from Caspio
- **All Tiers**: Shows 24-47, 48-71, 72+
- **Responsive**: Works on mobile

### 7. Quick Select Buttons
- 1 Dozen (12)
- 2 Dozen (24)
- 3 Dozen (36)
- 4 Dozen (48)
- 6 Dozen (72)
- 12 Dozen (144)

## Data Flow

1. **Page Load**:
   - Parse URL parameters (StyleNumber, COLOR)
   - Set global variables for other scripts
   - Load Caspio iframe (hidden)

2. **Caspio Data Loading**:
   - Caspio iframe loads pricing matrix
   - `pricing-matrix-capture.js` extracts data
   - Data stored in `window.nwcaPricingData`
   - 'pricingDataLoaded' event fired

3. **Component Initialization**:
   - Quick Quote Calculator reads pricing data
   - Color swatches load from inventory
   - Pricing table populates

4. **User Interactions**:
   - Change quantity → recalculate price
   - Change stitch count → update pricing
   - Toggle back logo → add/remove cost
   - Select color → update image

## Key Differences from Original

1. **No Hardcoded Prices**: Everything from Caspio
2. **Clean Code**: Single file instead of 20+
3. **Fixed Pricing**: Shows correct $24 for 24-47
4. **Better UX**: Instant feedback, clear layout
5. **Maintainable**: Easy to understand and modify

## Testing Checklist

- [ ] Pricing shows $24 for 24-47 caps (not $18)
- [ ] Stitch count dropdown works (5k/8k/10k)
- [ ] Back logo adds correct price
- [ ] Color swatches appear and work
- [ ] Product image updates with color
- [ ] Pricing table shows all tiers
- [ ] Quick select buttons work
- [ ] LTM fee applies under 24 caps
- [ ] Mobile responsive
- [ ] No console errors

## Future Enhancements

1. Quote system integration (when ready)
2. Multiple color selection
3. Save/load quotes
4. PDF generation
5. Add to cart functionality