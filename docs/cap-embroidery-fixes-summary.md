# Cap Embroidery Pricing Display Fixes

## Issues Fixed

### 1. Less Than Minimum (LTM) Fee Display
**Problem**: The LTM fee was being calculated correctly but not displaying in the price breakdown cards.

**Solution**: Modified the `updatePriceDisplayForSize` function in `pricing-pages.js` to ensure the LTM fee row is always displayed when `ltmFeePerItem > 0`.

### 2. Back Logo Pricing Display
**Problem**: The back logo pricing ($6 per item) was being calculated and added to the total correctly, but wasn't showing as a separate line item in the price breakdown cards.

**Root Cause**: The `updatePriceDisplayForSize` function was checking for `window.CapEmbroideryBackLogo` which might not be available when the function is called due to timing issues.

**Solution**: 
1. Modified `add-to-cart.js` to pass back logo information as parameters to `updatePriceDisplayForSize` instead of relying on the global object.
2. Updated `updatePriceDisplayForSize` in `pricing-pages.js` to accept `hasBackLogo` and `backLogoPerItem` as parameters.
3. Added fallback logic to check the global object if parameters aren't provided (for backward compatibility).

## Files Modified

### 1. `shared_components/js/add-to-cart.js`
- Added logic to check for back logo before calling `updatePriceDisplayForSize` (lines 243-250)
- Pass `hasBackLogo` and `backLogoPerItem` as additional parameters to the function

### 2. `shared_components/js/pricing-pages.js`
- Updated function signature to accept back logo parameters (line 723)
- Added fallback logic to check global object if parameters not provided (lines 727-736)
- Modified price breakdown card HTML to always show LTM fee when it applies (line 764)
- Improved the display logic for both LTM and standard pricing cards
- Fixed grid price display to show back logo pricing when enabled (lines 805-865)
  - Shows "+BL: $X.00" in the price breakdown for items with back logo
  - Properly styled with green background for items with back logo
- **Latest Fix**: Fixed bug where non-LTM items with back logo were not showing the correct total price
  - Added `actualDisplayPrice` calculation that includes back logo price (line 842)
  - Fixed line 847 to use `actualDisplayPrice` instead of `displayPrice` for the total
  - Ensures both the breakdown and total price are correct for back logo items

## How It Works Now

1. When updating prices, `add-to-cart.js` checks if back logo is enabled
2. It passes this information directly to `updatePriceDisplayForSize`
3. The function displays:
   - Base price
   - LTM fee (if applicable)
   - Back logo fee (if enabled)
   - Unit price (total)
   - Total for quantity
4. The grid price display also shows back logo pricing:
   - For items with back logo, displays "Base: $X.00" and "+BL: $X.00"
   - Shows the total price prominently
   - Styled with green background to indicate active pricing

## Testing

To verify the fixes work:
1. Go to the cap embroidery pricing page
2. Select the "Add Back Logo" option
3. Enter quantities for different sizes
4. Check that the price breakdown cards show:
   - "Back Logo: +$6.00" line item
   - Correct unit price including back logo
   - Correct total price
5. For orders under 24 pieces, verify LTM fee is displayed correctly

## Notes

- The pricing calculator (`pricing-calculator.js`) was already correctly including back logo prices in calculations
- The issue was purely display-related, not calculation-related
- The fix ensures data is passed reliably without depending on global object availability timing

## Status: All Issues Resolved ✅

All back logo pricing display issues have been fixed:
1. ✅ Back logo pricing shows correctly in price breakdown cards
2. ✅ Back logo pricing shows correctly in the quantity grid
3. ✅ LTM fees display properly when applicable
4. ✅ All pricing calculations include back logo when enabled
5. ✅ Cart integration properly saves back logo data

The cap embroidery pricing page now fully supports back logo pricing with proper display at all levels.