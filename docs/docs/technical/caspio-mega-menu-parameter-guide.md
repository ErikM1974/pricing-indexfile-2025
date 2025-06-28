# Caspio Mega Menu Parameter Integration Guide

## Overview
This guide documents how to properly pass parameters from a JavaScript mega menu to a Caspio DataPage for product filtering.

## Key Discovery
Caspio DataPages expect parameters to use the **exact field names** as configured in the DataPage, NOT generic parameter names like `cbParamVirtual1`, `cbParamVirtual2`, etc.

## Caspio DataPage Configuration

### 1. Parameter Setup in Caspio
When configuring your DataPage in Caspio, you'll see a parameter configuration screen that lists:
```
Parameter name          Parameter value
CATEGORY               [input field]
SUBCATEGORY            [input field]
STYLE                  [input field]
BRAND_NAME             [input field]
IsTopSeller            [input field]
```

### 2. Search Logic Configuration
The recommended search logic structure in Caspio:
```
OR
├── AND
│   ├── CATEGORY_NAME Equal [@CATEGORY]
│   └── SUBCATEGORY_NAME Equal [@SUBCATEGORY]
├── STYLE Equal [@STYLE]
├── BRAND_NAME Equal [@BRAND_NAME]
└── IsTopSeller Equal [@IsTopSeller]
```

This structure allows:
- Category + Subcategory searches (both required when searching by category)
- OR individual style searches
- OR brand/top seller filters

## JavaScript Implementation

### 1. Correct Parameter Format
```javascript
// CORRECT - Use direct field names
const params = {
    CATEGORY: "Caps",
    SUBCATEGORY: "Visors"
};

// Build URL with parameters
const url = 'https://c3eku948.caspio.com/dp/YOUR_APP_KEY/emb?CATEGORY=Caps&SUBCATEGORY=Visors';
```

### 2. INCORRECT Parameter Format (What NOT to do)
```javascript
// INCORRECT - Don't use cbParamVirtual format
const url = 'https://c3eku948.caspio.com/dp/YOUR_APP_KEY/emb?cbParamVirtual1=Caps&cbParamVirtual2=Visors';
```

### 3. Complete Implementation Example
```javascript
function loadCaspio(params = {}) {
    // Create deploy script with parameters
    let deployScript = `<script type="text/javascript" src="https://c3eku948.caspio.com/dp/YOUR_APP_KEY/emb`;
    
    // Use direct parameter names as shown in Caspio configuration
    const paramString = Object.entries(params)
        .filter(([key, value]) => value !== '' && value !== null && value !== undefined)
        .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
        .join('&');
    
    if (paramString) {
        deployScript += '?' + paramString;
    }
    
    deployScript += `"></script>`;
    
    // Append script to load Caspio with parameters
}
```

## Common Use Cases

### 1. Category Browsing
```javascript
// User clicks on "Caps" category, "Visors" subcategory
const params = {
    CATEGORY: "Caps",
    SUBCATEGORY: "Visors"
};
loadCaspio(params);
// Results: All visors in the Caps category
```

### 2. Style Search
```javascript
// User searches for style "PC54"
const params = {
    STYLE: "PC54"
};
loadCaspio(params);
// Results: All products with style PC54
```

### 3. Category with Brand Filter
```javascript
// User browses T-Shirts from Port & Company
const params = {
    CATEGORY: "T-Shirts",
    SUBCATEGORY: "Ring Spun",
    BRAND_NAME: "Port & Company"
};
loadCaspio(params);
// Results: Products matching category OR brand (due to OR logic)
```

## Important: Parameter Caching Issue

### The Problem
Caspio caches parameters in the browser. Once a parameter is received, it will be remembered and reused in subsequent loads, even if you don't explicitly pass it. This causes:
- Old search criteria to persist
- Wrong products to be returned
- Category searches showing results from previous searches

### The Solution
Always include `cbResetParam=1` in your URL to reset all cached parameters except those being explicitly passed.

```javascript
// Always start with cbResetParam=1
let url = 'https://c3eku948.caspio.com/dp/YOUR_APP_KEY/emb?cbResetParam=1&CATEGORY=Caps&SUBCATEGORY=Visors';
```

## Troubleshooting

### Issue: Getting wrong products
**Cause 1**: Using incorrect parameter format (cbParamVirtual)
**Solution**: Use direct field names (CATEGORY, SUBCATEGORY, etc.)

**Cause 2**: Cached parameters from previous searches
**Solution**: Always include `cbResetParam=1` in your URL

### Issue: No results returned
**Cause**: Case sensitivity or exact match requirements
**Solution**: 
1. Ensure parameter values match exactly what's in the database
2. Consider enabling wildcards in Caspio for partial matching

### Issue: Too many results
**Cause**: OR logic in Caspio returns products matching ANY criteria
**Solution**: 
1. Send only the necessary parameters
2. Consider restructuring Caspio logic to use AND for filters

## Best Practices

1. **Always use exact field names** - Match the parameter names shown in Caspio configuration
2. **Handle empty values** - Don't send parameters with empty or null values
3. **URL encode values** - Use `encodeURIComponent()` for parameter values
4. **Case sensitivity** - Match the exact case of values in your database
5. **Debug mode** - Implement a debug panel to test parameter combinations

## Debug Implementation
```javascript
function debugSearch() {
    const params = {};
    
    // Get values from debug inputs
    const category = document.getElementById('debugCategory').value.trim();
    const subcategory = document.getElementById('debugSubcategory').value.trim();
    
    if (category) params.CATEGORY = category;
    if (subcategory) params.SUBCATEGORY = subcategory;
    
    console.log('Testing with params:', params);
    loadCaspio(params);
}
```

## Conclusion
The key to successful Caspio integration is understanding that the DataPage expects parameters with specific field names. Always refer to your Caspio DataPage configuration to see the exact parameter names expected, and use those names directly in your URL parameters.