# Cap Embroidery Cart Implementation Guide

## Overview
This document describes the implementation of the cap embroidery shopping cart system with specific validation rules and pricing calculations.

## Key Requirements Implemented

### 1. Stitch Count Validation
- **Requirement**: All caps in the cart must have the same stitch count (5,000, 8,000, or 10,000)
- **Implementation**: 
  - Validation occurs in `cart.js` (lines 765-807)
  - Enhanced with modal dialogs in `cap-embroidery-validation.js`
  - When a user tries to add caps with a different stitch count, they see a modal with options to:
    - Cancel the addition
    - Clear the cart and add the new item

### 2. Product Title Validation
- **Requirement**: Only products with "Cap" in the title should use cap embroidery pricing
- **Implementation**:
  - `isValidCapProduct()` function checks for "cap" or "caps" (case-insensitive)
  - Shows a warning modal if non-cap products are selected
  - User can choose to proceed anyway or cancel

### 3. Less Than Minimum (LTM) Fee
- **Requirement**: $50 fee for orders under 24 caps
- **Implementation**:
  - Minimum quantity: 24 caps
  - LTM fee: $50.00
  - Enhanced display shows:
    - Current quantity vs minimum required
    - Total LTM fee and per-item breakdown
    - Number of additional caps needed to avoid fee

## File Structure

### Core Files
1. **`shared_components/js/cap-embroidery-validation.js`**
   - Product title validation
   - Modal dialogs for warnings
   - LTM fee display updates

2. **`shared_components/js/cap-embroidery-cart-integration.js`**
   - Integrates validation into the cart system
   - Enhances the `addToCart` function
   - Updates LTM display on cart changes

3. **`shared_components/js/cap-embroidery-adapter.js`**
   - Handles pricing display based on stitch count
   - Updates pricing grid when stitch count changes

4. **`shared_components/js/cart.js`**
   - Core cart functionality with stitch count validation
   - Prevents mixing different embellishment types

5. **`shared_components/js/add-to-cart.js`**
   - Captures stitch count from UI
   - Passes embellishment options to cart

## User Experience Flow

### Adding Items to Cart
1. User selects a cap product and stitch count
2. User enters quantities for sizes
3. User clicks "Add to Cart"
4. System validates:
   - Is it a cap product? If not, show warning
   - Does stitch count match existing cart items? If not, show options
   - Calculate pricing including LTM fee if applicable

### Validation Scenarios

#### Scenario 1: Non-Cap Product
```
User selects: "Port Authority Polo Shirt"
System shows: Warning modal - "This pricing calculator is for caps only"
Options: Cancel or Proceed Anyway
```

#### Scenario 2: Stitch Count Mismatch
```
Cart contains: Caps with 8,000 stitches
User adds: Caps with 5,000 stitches
System shows: Modal explaining mismatch
Options: Cancel or Clear Cart & Add
```

#### Scenario 3: Less Than Minimum
```
Cart contains: 15 caps
System shows: LTM fee notice
Message: "Add 9 more caps to eliminate $50 fee"
Per-item fee: $3.33 ($50 ÷ 15)
```

## Technical Implementation Details

### Stitch Count Storage
- Stored in `embellishmentOptions.stitchCount`
- Passed through the cart system
- Validated on each addition

### Modal System
- Custom modal implementation (no external dependencies)
- Promise-based for async user interaction
- Styled to match the site design

### Cart State Management
- Uses event-driven updates
- Listens for 'cartUpdated' events
- Recalculates LTM fees on changes

## Testing Checklist

- [ ] Add cap with 8,000 stitches
- [ ] Try to add cap with 5,000 stitches (should show modal)
- [ ] Try to add non-cap product (should show warning)
- [ ] Add less than 24 caps (should show LTM fee)
- [ ] Add exactly 24 caps (LTM fee should disappear)
- [ ] Clear cart and start fresh
- [ ] Test all three stitch count options

## Future Enhancements

1. **Bulk Stitch Count Change**: Allow changing stitch count for all items in cart
2. **Save Stitch Count Preference**: Remember user's preferred stitch count
3. **API Integration**: Validate stitch count options against product capabilities
4. **Enhanced Reporting**: Show stitch count in cart summary and order forms

## Troubleshooting

### Common Issues

1. **Stitch count not saving**
   - Check that `embellishmentOptions` is properly formatted
   - Verify `stitchCount` is included in cart data

2. **Modal not appearing**
   - Ensure validation scripts are loaded
   - Check browser console for errors

3. **LTM fee not calculating**
   - Verify minimum quantity constant (24)
   - Check that only cap items are counted

### Debug Mode
Add `?debug=true` to URL to enable console logging for:
- Cart operations
- Validation checks
- Pricing calculations

## Configuration

### Constants (in `cap-embroidery-validation.js`)
```javascript
const MINIMUM_CAP_QUANTITY = 24;
const LTM_FEE = 50.00;
```

### Stitch Count Options (in HTML)
```html
<select id="client-stitch-count-select">
    <option value="5000">5,000</option>
    <option value="8000" selected>8,000</option>
    <option value="10000">10,000</option>
</select>
```

## Support
For issues or questions:
1. Check browser console for error messages
2. Verify all scripts are loaded in correct order
3. Ensure product data includes required fields