# Pricing Page Implementation Guide

## Overview

This guide documents the architecture of the pricing system and common issues encountered during implementation. It was created after debugging the embroidery pricing page where the pricing table showed "N/A" values despite having valid data.

## Architecture

### Data Flow
1. **Caspio iframe** sends master bundle data via postMessage
2. **Master Bundle Integration** (`embroidery-master-bundle-integration.js`) receives and transforms data
3. **Pricing components** render the data in tables and calculators

### Master Bundle System: Architectural Template

The Master Bundle System follows a strict separation of concerns:

- **Caspio DataPage (Data Engine)**: Performs all calculations and provides complete JSON data. No UI.
- **Webpage (Presentation Layer)**: Receives data, transforms for display, and renders UI.

#### Consolidated API Endpoints

Each decoration type has a single API endpoint:

```
https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/pricing-bundle?method=[DECORATION_TYPE]&styleNumber=[STYLE_NUMBER]
```

Current endpoints:
- `.../api/pricing-bundle?method=EMB&styleNumber=PC61` (Embroidery)
- `.../api/pricing-bundle?method=DTG&styleNumber=PC61` (Direct to Garment)

Future endpoints:
- `.../api/pricing-bundle?method=CAP&styleNumber=C840` (Cap Embroidery)
- `.../api/pricing-bundle?method=DTF&styleNumber=PC54` (Direct to Film)
- `.../api/pricing-bundle?method=SCREENPRINT&styleNumber=PC54` (Screen Print)

#### Master Bundle JSON Structure

Required fields in the response:

| Key | Type | Description |
|-----|------|-------------|
| `embellishmentType` | String | Unique identifier (e.g., "embroidery", "dtg") |
| `styleNumber` | String | Product style number |
| `colorName` | String | Selected color name |
| `uniqueSizes` | Array | All available sizes (e.g., ["S", "M", "L"]) |
| `tierData` | Array/Object | Full data for each quantity tier |
| `rulesData` | Object | Business rules (e.g., RoundingMethod) |
| `sellingPriceDisplayAddOns` | Object | Size upcharge amounts |
| `printLocationMeta` | Array | Available print locations |
| `pricing` or `allLocationPrices` | Object | Calculated prices (see below) |

#### Pricing Structure Patterns

**Simple Pricing (Embroidery)**: `pricing[Tier][Size]`
```json
"pricing": {
    "1-23": { "S": 18.00, "M": 18.00, "2XL": 20.00 },
    "24-47": { "S": 17.00, "M": 17.00, "2XL": 19.00 }
}
```

**Complex Pricing (DTG)**: `allLocationPrices[Location][Size][Tier]`
```json
"allLocationPrices": {
    "LC": {
        "S": { "24-47": 10.15, "48-71": 9.65 }
    }
}
```

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

## Caspio DataPage Templates

When creating a new decoration type in Caspio, use these templates:

### Page Header Template
```html
<style>
/* Hide all Caspio default elements to make the datapage invisible */
body { background: transparent !important; }
dl, section, .cbNavBarCtnt, footer { display: none !important; }
</style>
```

### HTML Block 1 Template (Data Fetching)
```javascript
<script>
// [DECORATION_TYPE] Block 1: Data Fetching (v9.0 Template)
console.log('[DECORATION_TYPE B1] Initializing...');

async function getData(styleNo) {
    const cacheKey = `pricingData-${styleNo}-[DECORATION_TYPE]`;
    const cachedData = sessionStorage.getItem(cacheKey);
    if (cachedData) return JSON.parse(cachedData);
    
    const baseUrl = 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';
    const url = `${baseUrl}/api/pricing-bundle?method=[DECORATION_TYPE]&styleNumber=${styleNo}`;
    
    const response = await fetch(url);
    if (!response.ok) throw new Error(`API status: ${response.status}`);
    const allData = await response.json();
    sessionStorage.setItem(cacheKey, JSON.stringify(allData));
    return allData;
}

window.initPricing = async function() {
    const params = new URLSearchParams(window.location.search);
    const styleNo = params.get('StyleNumber');
    if (!styleNo) {
        document.dispatchEvent(new CustomEvent('dataFailed', { detail: { error: 'No StyleNumber' } }));
        return;
    }
    try {
        const apiData = await getData(styleNo);
        document.dispatchEvent(new CustomEvent('dataReady', {
            detail: {
                styleNumber: styleNo,
                colorName: params.get('COLOR') ? decodeURIComponent(params.get('COLOR').replace(/\+/g, ' ')) : '',
                apiData: apiData
            }
        }));
    } catch (error) {
        document.dispatchEvent(new CustomEvent('dataFailed', { detail: { error: `API Fetch Failed: ${error.message}` } }));
    }
};
</script>
```

### HTML Block 2 Template (Calculation Engine)
```javascript
<script>
// [DECORATION_TYPE] Block 2: Price Calculation Engine (v9.0 Template)
console.log('[DECORATION_TYPE B2] Initializing...');

window.calculatePrices = function(apiData) {
    console.log('[B2] Starting calculations...');
    const { /* Destructure all needed fields from apiData */ } = apiData;

    // --- START CUSTOM CALCULATION LOGIC ---
    // 1. Determine the standard garment cost.
    // 2. Loop through each pricing tier.
    // 3. For each tier, calculate the base decorated price.
    // 4. Loop through each size and add the appropriate upcharge.
    // 5. Store the final price in a `priceProfile` object.
    // --- END CUSTOM CALCULATION LOGIC ---

    return {
        pricing: priceProfile, // or allLocationPrices for DTG
        uniqueSizes: sortedSizes.map(s => s.size)
    };
};
</script>
```

### HTML Block 3 Template (Dispatcher)
```javascript
<script>
// [DECORATION_TYPE] Block 3: Bundle Builder & Dispatcher (v9.0 Template)
console.log('[DECORATION_TYPE B3] Initializing Listeners...');

(function() {
    'use strict';
    function assembleBundle(eventDetail, calculationResult) {
        const { styleNumber, colorName, apiData } = eventDetail;
        return {
            styleNumber, colorName,
            embellishmentType: "[DECORATION_TYPE]",
            timestamp: new Date().toISOString(),
            ...apiData, // Include all original data from the API
            ...calculationResult // Add the calculated pricing and unique sizes
        };
    }

    function dispatchToParent(payload) {
        console.log('[B3] Master Bundle Contents:\n', JSON.stringify(payload.detail, null, 2));
        if (window.parent && typeof window.parent.postMessage === 'function') {
            window.parent.postMessage(payload, '*');
        }
    }

    function handleDataSuccess(event) {
        try {
            const calcResult = window.calculatePrices(event.detail.apiData);
            const bundle = assembleBundle(event.detail, calcResult);
            dispatchToParent({ type: 'caspio[DECORATION_TYPE]MasterBundleReady', detail: bundle });
        } catch (error) {
            dispatchToParent({ type: 'caspio[DECORATION_TYPE]MasterBundleFailed', detail: { hasError: true, errorMessage: error.message } });
        }
    }

    if (!window.listenersAttached_[DECORATION_TYPE]) {
        document.addEventListener('dataReady', handleDataSuccess);
        document.addEventListener('dataFailed', (e) => dispatchToParent({ type: 'caspio[DECORATION_TYPE]MasterBundleFailed', detail: { hasError: true, errorMessage: e.detail.error }}));
        window.listenersAttached_[DECORATION_TYPE] = true;
    }
})();
</script>
```

### Page Footer Template
```javascript
<script>
(function() {
    'use strict';
    document.addEventListener('DataPageReady', () => {
        if (typeof window.initPricing === 'function') {
            window.initPricing();
        }
    });
})();
</script>
```

## Webpage Integration Template

Create a dedicated integration script (e.g., `screenprint-master-bundle-integration.js`):

```javascript
// [DECORATION_TYPE] Master Bundle Integration
(function() {
    'use strict';
    
    // Transform master bundle to UI format
    function transformMasterBundleForGrid(masterBundle) {
        // Transform data to match UI expectations
        // See embroidery-master-bundle-integration.js for example
    }
    
    // Listen for postMessage
    window.addEventListener('message', function(event) {
        if (event.data.type === 'caspio[DECORATION_TYPE]MasterBundleReady') {
            const masterBundle = event.data.detail;
            const transformedData = transformMasterBundleForGrid(masterBundle);
            
            // Store and dispatch
            window.nwcaMasterBundleData = masterBundle;
            window.nwcaTransformedData = transformedData;
            
            document.dispatchEvent(new CustomEvent('pricingDataLoaded', {
                detail: transformedData,
                bubbles: true
            }));
        }
    });
})();
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
- **2024-01-19**: Added Master Bundle System architecture and templates
  - Caspio DataPage templates for new decoration types
  - Webpage integration patterns
  - API endpoint documentation