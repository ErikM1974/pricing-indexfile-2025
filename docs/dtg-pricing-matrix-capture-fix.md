# DTG Pricing Matrix Capture Fix Documentation

## Issue Summary

The DTG pricing page was experiencing an infinite retry loop in the console, with the pricing matrix capture system repeatedly attempting to capture pricing data from the DOM table every 2 seconds for up to 80 seconds (40 attempts).

### Console Error Pattern
```
[PRICING-MATRIX:CAPTURE] DTG pricing missing expected tiers: 24-47. Table may not be fully loaded yet.
[PRICING-MATRIX:CHECK] Table found, but capture failed. Will retry.
```

This error repeated hundreds of times, creating console spam and potentially impacting performance.

## Root Cause Analysis

### 1. **Timing Mismatch**
- The DTG adapter successfully receives pricing data from Caspio and dispatches a `pricingDataLoaded` event
- The pricing matrix capture system independently tries to capture the same data from the DOM
- The DOM table doesn't contain the exact tier labels the capture system expects

### 2. **Duplicate Event Systems**
- DTG adapter: Processes master bundle → dispatches `pricingDataLoaded` event with complete data
- Pricing matrix capture: Tries to scrape DOM → dispatches its own `pricingDataLoaded` event
- This creates redundancy and potential conflicts

### 3. **Tier Label Mismatch**
- The capture system expects specific tier labels: '24-47', '48-71', '72+'
- The actual DOM table may have different formatting or labels
- Since the check fails, it retries indefinitely

### 4. **Missing UI Elements**
- Cart integration looks for elements that don't exist:
  - `#size-quantity-grid-container`
  - `table.matrix-price-table`
- This prevents proper cart functionality

## Solution Implementation

### Fix File: `/shared_components/js/pricing-matrix-capture-fix.js`

The fix implements several strategies:

1. **DTG Detection and Early Exit**
   - Detects when on a DTG page
   - Monitors for DTG adapter data availability
   - Stops capture attempts when DTG data is already available

2. **Event Listener for DTG Data**
   - Listens for `pricingDataLoaded` events from the DTG adapter
   - Marks DTG data as processed when received
   - Clears any running capture intervals

3. **Function Override**
   - Overrides `checkForPricingData` to skip capture when DTG data exists
   - Limits capture attempts to 5 for DTG pages (instead of 40)
   - Provides flexible tier mapping for DTG if capture is necessary

4. **UI Element Creation**
   - Creates missing elements required by cart integration
   - Adds `matrix-price-table` class to pricing grid
   - Creates `size-quantity-grid-container` if missing

## Implementation Details

### Key Functions

```javascript
// Monitor for DTG data
window.addEventListener('pricingDataLoaded', function(event) {
    if (event.detail && event.detail.embellishmentType === 'dtg') {
        dtgDataProcessed = true;
        // Stop capture interval
        if (window.captureInterval) {
            clearInterval(window.captureInterval);
            window.captureInterval = null;
        }
    }
});

// Override capture check for DTG
window.checkForPricingData = function() {
    if (dtgDataProcessed || window.dtgMasterPriceBundle) {
        // Skip capture - DTG data already available
        return;
    }
    // Limit attempts for DTG
    if (window.captureAttempts > 5) {
        clearInterval(window.captureInterval);
        return;
    }
    // Call original function
    return originalCheck.apply(this, arguments);
};
```

### Flexible Tier Mapping

If capture from DOM is necessary, the fix provides flexible tier mapping:

```javascript
// Map any tier format to expected DTG tiers
if (tierText.includes('24') || tierText.includes('Tier 1')) {
    mappedTier = '24-47';
} else if (tierText.includes('48') || tierText.includes('Tier 2')) {
    mappedTier = '48-71';
} else if (tierText.includes('72') || tierText.includes('Tier 3') || tierText.includes('+')) {
    mappedTier = '72+';
}
```

## Testing

### Test Page: `test-dtg-fix.html`

The test page includes:
- Console monitoring to track capture attempts
- Simulated DTG master bundle data
- Visual status indicators
- Pass/fail criteria display

### Expected Behavior After Fix

1. ✅ DTG adapter loads pricing data successfully
2. ✅ Pricing matrix capture stops after DTG data is received
3. ✅ No infinite retry loop occurs
4. ✅ Cart UI elements are created properly
5. ✅ Console shows minimal capture attempts (≤5 instead of 40)

## Integration

Add the fix to DTG pricing pages after the pricing matrix capture script:

```html
<script src="/shared_components/js/pricing-matrix-capture.js"></script>
<script src="/shared_components/js/pricing-matrix-capture-fix.js"></script>
```

## Benefits

1. **Performance**: Eliminates unnecessary DOM polling and retry attempts
2. **Console Clarity**: Reduces console spam from hundreds of messages to <10
3. **Reliability**: Uses DTG adapter data directly instead of unreliable DOM scraping
4. **User Experience**: Faster page load and smoother interactions
5. **Cart Functionality**: Ensures required UI elements exist for cart integration

## Future Improvements

1. Consider refactoring pricing matrix capture to be adapter-aware
2. Implement a unified event system instead of duplicate capture methods
3. Add configuration to disable DOM capture for specific embellishment types
4. Create a more robust UI element initialization system

## Related Files

- `/shared_components/js/pricing-matrix-capture.js` - Original capture system
- `/shared_components/js/dtg-adapter.js` - DTG pricing adapter
- `/shared_components/js/cart-integration.js` - Cart system requiring UI elements
- `/dtg-pricing.html` - DTG pricing page