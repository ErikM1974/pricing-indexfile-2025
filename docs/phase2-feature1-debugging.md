# Phase 2 Feature 1: Quantity Shortcuts - Debugging Pricing Updates

## Current Issue
When clicking a preset quantity button:
- ✅ The quantity value updates in the input field
- ❌ The pricing does not recalculate
- ✅ Manual typing in the field works correctly

## Root Cause Analysis
The hero calculator listens for 'input' events with this code:
```javascript
quantityInput.addEventListener('input', (e) => {
    let quantity = parseInt(e.target.value) || HERO_CONFIG.defaultQuantity;
    quantity = Math.max(HERO_CONFIG.minQuantity, Math.min(HERO_CONFIG.maxQuantity, quantity));
    this.setQuantity(quantity);
});
```

Programmatically dispatched events might not trigger the same way as real user input.

## Solutions Implemented

### 1. Multiple Update Methods
The quantity shortcuts now try 4 different methods in order:

1. **QuantityManager Update** (if available)
   ```javascript
   NWCA.controllers.capEmbroidery.QuantityManager.updateQuantity(quantity, 'quantity-shortcuts');
   ```

2. **Direct HeroQuantityCalculator Call**
   ```javascript
   window.HeroQuantityCalculator.setQuantity(quantity);
   ```

3. **Enhanced Event Dispatching**
   - Uses InputEvent for more realistic simulation
   - Includes inputType and data properties
   - Falls back to regular Event if needed

4. **Direct Method Call Fallback**
   - Attempts to call setQuantity even if not detected initially

### 2. Event Types
Now dispatches multiple event types:
- `InputEvent` (most realistic)
- `Event('input')` (fallback)
- `Event('change')` (additional compatibility)

## Debugging Steps

### 1. Check Console Logs
When clicking a preset, look for these logs:
```
[QUANTITY-SHORTCUTS] Using HeroQuantityCalculator.setQuantity
[QUANTITY-SHORTCUTS] Using fallback input update
[QUANTITY-SHORTCUTS] Attempting direct hero calculator update
```

### 2. Verify HeroQuantityCalculator Availability
In browser console:
```javascript
// Check if it exists
console.log(window.HeroQuantityCalculator);

// Check if setQuantity is available
console.log(typeof window.HeroQuantityCalculator?.setQuantity);

// Test direct call
window.HeroQuantityCalculator.setQuantity(48);
```

### 3. Test Event Handling
Use the debug test page to verify which event types work:
- `/test-quantity-shortcuts-debug.html`

## Potential Additional Solutions

### Option 1: Direct Integration
Modify hero calculator to expose a global update method:
```javascript
window.updateHeroQuantity = function(qty) {
    HeroQuantityCalculator.setQuantity(qty);
};
```

### Option 2: Custom Event
Have hero calculator listen for a custom event:
```javascript
window.addEventListener('updateQuantity', (e) => {
    HeroQuantityCalculator.setQuantity(e.detail.quantity);
});
```

### Option 3: Shared State
Use NWCA.state for shared quantity state that both components watch.

## Next Steps

1. **Test on live page** with console open to see which methods are being called
2. **Check timing** - HeroQuantityCalculator might not be initialized when shortcuts load
3. **Consider adding delay** - Wait for hero calculator to be fully ready
4. **Direct modification** - Modify hero calculator to better support programmatic updates

## Temporary Workaround

If the issue persists, users can:
1. Click the preset button (updates the value)
2. Click in the input field and press Enter (triggers update)

This is not ideal but ensures functionality while we debug the integration.