# Pricing Page Implementation Guide

## Overview

This guide documents the architecture of the pricing system and common issues encountered during implementation. It was created after debugging the embroidery pricing page where the pricing table showed "N/A" values despite having valid data.

## Architecture

### Data Flow
1. **Caspio iframe** sends master bundle data via postMessage
2. **Master Bundle Integration** (`embroidery-master-bundle-integration.js`) receives and transforms data
3. **Pricing components** render the data in tables and calculators

### Component Systems

We have two competing pricing table systems:

1. **UniversalPricingGrid** (`universal-pricing-grid.js`)
   - Generic pricing table component
   - Works for most standard cases
   - Initialized in page JavaScript

2. **Page-Specific Implementations** 
   - `embroidery-pricing-v3.js` for embroidery
   - Custom logic for specific pricing needs
   - More control over rendering

**⚠️ CRITICAL**: Never use both systems on the same page - they will conflict!

## Common Issues and Solutions

### Issue 1: Pricing Table Shows "N/A" Values

**Symptoms:**
- Console shows data loaded successfully
- `window.nwcaMasterBundleData` contains valid pricing
- Table renders but all prices show "N/A"

**Common Causes:**
1. Missing HTML container element
2. Conflicting components trying to render in same container
3. Incorrect data access (wrong key structure)

**Solution:**
```javascript
// Check for container
const container = document.getElementById('your-pricing-table-container');
if (!container) {
    console.error('Container not found!');
}

// Access pricing correctly
const price = masterBundle.pricing[tierLabel][size];
```

### Issue 2: "Container not found" Errors

**Symptoms:**
- Console shows "[COMPONENT] Pricing table container not found"
- No table renders at all

**Solution:**
Add the required container to your HTML:
```html
<div id="pricing-grid-container">
    <!-- Add specific container for your implementation -->
    <div id="embroidery-pricing-table-container"></div>
</div>
```

### Issue 3: Component Conflicts

**Symptoms:**
- Table renders briefly then disappears
- Multiple "Initializing" messages in console
- Inconsistent behavior

**Solution:**
Choose one approach and disable the other:

```javascript
// Option 1: Use page-specific implementation
// Comment out UniversalPricingGrid initialization
// const pricingGrid = new UniversalPricingGrid({...}); // DISABLED

// Option 2: Use UniversalPricingGrid
// Don't load page-specific scripts
// Remove: <script src="embroidery-pricing-v3.js"></script>
```

## Implementation Checklist

When implementing pricing for a new page (cap embroidery, screenprint, DTF, etc.):

- [ ] **Choose your approach**
  - [ ] UniversalPricingGrid (simpler, less flexible)
  - [ ] Custom implementation (more control, more complex)

- [ ] **Set up HTML structure**
  ```html
  <!-- Step 1: Configuration -->
  <div id="customization-options-container"></div>
  
  <!-- Step 2: Quick Quote -->
  <div id="quick-quote-container"></div>
  
  <!-- Step 3: Pricing Grid -->
  <div id="pricing-grid-container">
      <!-- Add if using custom implementation -->
      <div id="[page-type]-pricing-table-container"></div>
  </div>
  ```

- [ ] **Configure scripts**
  - [ ] If using UniversalPricingGrid: Load and initialize it
  - [ ] If using custom: Comment out UniversalPricingGrid
  - [ ] Update master bundle integration if needed

- [ ] **Test the implementation**
  - [ ] Check console for errors
  - [ ] Verify `window.nwcaMasterBundleData` is populated
  - [ ] Confirm all sizes display (S through 6XL)
  - [ ] Test quantity changes update active tier

## Page-Specific Configuration

### Embroidery
- Uses: `embroidery-pricing-v3.js`
- Container: `embroidery-pricing-table-container`
- Special: Handles stitch count adjustments
- Note: UniversalPricingGrid must be disabled

### Cap Embroidery
- Uses: [To be determined]
- Container: `cap-embroidery-pricing-table-container`
- Special: Different size structure (OSFA)
- Note: [Add implementation notes]

### Screen Print
- Uses: [To be determined]
- Container: `screenprint-pricing-table-container`
- Special: Color count affects pricing
- Note: [Add implementation notes]

### DTG (Direct to Garment)
- Uses: [To be determined]
- Container: `dtg-pricing-table-container`
- Special: Print location pricing
- Note: [Add implementation notes]

### DTF (Direct to Film)
- Uses: [To be determined]
- Container: `dtf-pricing-table-container`
- Special: Size-based pricing
- Note: [Add implementation notes]

## Debugging Guide

### Quick Debug Steps

1. **Open Console and check for:**
   ```javascript
   // Data available?
   console.log(window.nwcaMasterBundleData);
   
   // Container exists?
   console.log(document.getElementById('your-container-id'));
   
   // What events fired?
   // Look for: pricingDataLoaded, masterBundleLoaded
   ```

2. **Common Console Messages:**
   - `"Container not found"` → Add missing HTML element
   - `"No master bundle data"` → Check Caspio iframe URL
   - `"Event already processed"` → Normal, ignore
   - Multiple initialization messages → Component conflict

3. **Verify Data Structure:**
   ```javascript
   // Should have this structure:
   masterBundle.pricing = {
       "1-23": { "S": 17, "M": 17, ... },
       "24-47": { "S": 16, "M": 16, ... },
       // etc.
   }
   ```

### Testing Master Bundle Integration

1. Check iframe is loading:
   ```javascript
   const iframe = document.getElementById('embroidery-master-bundle-iframe');
   console.log('Iframe URL:', iframe.src);
   ```

2. Monitor postMessage events:
   ```javascript
   window.addEventListener('message', (event) => {
       if (event.data.type?.includes('Bundle')) {
           console.log('Bundle message:', event.data);
       }
   });
   ```

## Best Practices

1. **Always check for containers** before rendering
2. **Choose one pricing system** per page
3. **Document your choice** in code comments
4. **Test with different products** to ensure compatibility
5. **Monitor console** during development

## Future Improvements

Consider creating a unified pricing component that:
- Detects page type automatically
- Handles all pricing scenarios
- Eliminates the need for multiple implementations
- Prevents component conflicts

## Related Files

- `/shared_components/js/universal-pricing-grid.js` - Generic pricing component
- `/shared_components/js/embroidery-pricing-v3.js` - Embroidery-specific implementation
- `/shared_components/js/embroidery-master-bundle-integration.js` - Data handler
- `/shared_components/js/pricing-pages.js` - Orchestrator
- `/shared_components/js/dp5-helper.js` - UI utilities

## Version History

- **2024-01-19**: Initial documentation created after embroidery pricing debug session
- Component conflict between UniversalPricingGrid and embroidery-pricing-v3.js resolved
- Missing container issue documented