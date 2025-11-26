# Debugging Communication Guide

**Last Updated:** 2025-01-28
**Purpose:** Effective communication patterns for debugging issues with Claude

## 🎯 Overview

This guide documents best practices for reporting issues and debugging problems efficiently based on lessons learned from real debugging sessions.

## 📝 How to Report Issues Effectively

### Provide Working Examples
```
❌ Bad: "The DTG page works but DTF doesn't"
✅ Good: "DTG uses endpoint /api/dtg/product-bundle which returns {sizes: [...], upcharges: {...}}"
```

### Share API Information
```
❌ Bad: "The tooltip shows 'loading' forever"
✅ Good: "The endpoint /api/pricing-bundle?method=DTF returns empty sizes array. Try /api/max-prices-by-style"
```

### Include Data Flow Details
```
❌ Bad: "The modal isn't showing upcharges"
✅ Good: "The tooltip should get upcharges from the sellingPriceDisplayAddOns field in the API response"
```

### Show Network Activity
```
❌ Bad: "It's not loading the data"
✅ Good: "Network tab shows GET /api/pricing-bundle returns 200 but sizes array is empty: {sizes: [], upcharges: {}}"
```

## 🔍 API Troubleshooting Checklist

When debugging API-related issues:

1. **Test endpoints first** - Use curl/Postman to verify what data is returned
2. **Compare working vs broken** - Check what endpoints similar working features use
3. **Look for the data source** - The issue is often wrong endpoint, not wrong UI code
4. **Check network tab** - Browser DevTools Network tab shows actual API calls and responses
5. **Verify data structure** - Ensure the response has the expected fields and values

## 🌐 Common API Endpoints Reference

### Product Data Endpoints
```javascript
// Product data with sizes and upcharges (ALL products)
'/api/max-prices-by-style?styleNumber=PC61'
// Returns: {sizes: [...], sellingPriceDisplayAddOns: {...}}

// DTG-specific bundle (complete pricing data)
'/api/dtg/product-bundle?styleNumber=PC61'
// Returns: {pricing: {tiers, costs, sizes, upcharges}, product: {...}}

// Generic pricing bundle (check if data is populated for method)
'/api/pricing-bundle?method=DTF&styleNumber=PC61'
// Returns: May have empty sizes/upcharges for some methods

// Base item costs (raw cost data)
'/api/base-item-costs?styleNumber=PC61'
// Returns: [{Size: "S", ItemCost: 3.53}, ...]

// Product colors and details
'/api/product-colors?styleNumber=PC61'
// Returns: {productTitle, colors: [...], selectedColor: {...}}
```

## 🐛 Quick Debug Pattern

When a feature works on one page but not another:

```javascript
// 1. Check what endpoint the working page uses
console.log('Working page API call:', [check Network tab]);

// 2. Check what data structure it receives
console.log('Working data structure:', response);

// 3. Compare with broken page
console.log('Broken page API call:', [check Network tab]);
console.log('Broken data structure:', response);

// 4. The difference usually reveals the issue
```

## 💡 Real-World Example: DTF Tooltip Issue

### The Problem
DTF pricing page tooltip showed "Size information loading..." indefinitely while DTG page worked correctly.

### What Slowed Down Resolution
1. **Wrong assumptions** - Assumed the event contained data (it didn't)
2. **Wrong layer focus** - Fixed event handling instead of data source
3. **Missing API info** - Didn't know about `/api/max-prices-by-style` endpoint

### What Would Have Helped
```
User: "DTF tooltip stuck on 'loading'. DTG works using /api/dtg/product-bundle.
       Here's DTG response: {sizes: [...], upcharges: {...}}
       DTF calls /api/pricing-bundle?method=DTF which returns: {sizes: [], upcharges: {}}"

Claude: [Immediately recognizes DTF endpoint returns empty data, asks for alternative endpoint]
```

### The Solution
Used `/api/max-prices-by-style` endpoint which returns proper size and upcharge data for all products.

## 🎯 Key Debugging Principles

### For Users Reporting Issues

1. **Start with what works** - Show working examples with technical details
2. **Include API calls** - Share endpoints and response data
3. **Be specific about data** - Show actual JSON responses, not just descriptions
4. **Provide console errors** - Include full error messages and stack traces
5. **Share network activity** - Screenshot or list Network tab API calls

### For Claude Debugging

1. **Test assumptions immediately** - Don't assume, verify with actual API calls
2. **Compare implementations** - Look at working features using similar patterns
3. **Add comprehensive logging** - Log at every step to track data flow
4. **Check the data layer first** - Many "UI issues" are actually data issues
5. **Ask for API documentation** - When endpoints don't return expected data

## 📊 Common Issue Patterns

### Pattern: Feature Works on Page A but Not Page B

**Likely Causes:**
- Different API endpoints
- Different data structures
- Missing event listeners
- Wrong global variables

**Debug Approach:**
1. Compare API calls between pages
2. Check data structures returned
3. Verify event listeners are attached
4. Check for namespace conflicts

### Pattern: Data Loads but UI Doesn't Update

**Likely Causes:**
- Data structure mismatch
- Missing UI update trigger
- Timing issue (UI renders before data)
- Wrong element selectors

**Debug Approach:**
1. Log data at point of receipt
2. Verify UI update function is called
3. Check element exists when updating
4. Verify data format matches UI expectations

### Pattern: "Loading..." Shown Indefinitely

**Likely Causes:**
- API returns empty/wrong data
- Error in data processing
- Missing error handling
- Wrong endpoint

**Debug Approach:**
1. Check Network tab for API response
2. Verify response has expected fields
3. Check console for JavaScript errors
4. Test API endpoint directly with curl/Postman

## 🚀 Quick Start Debugging Commands

```javascript
// Check if API endpoint works
fetch('/api/endpoint').then(r => r.json()).then(console.log);

// Compare data structures
console.log('Page A data:', pageAData);
console.log('Page B data:', pageBData);

// Trace event flow
window.addEventListener('eventName', (e) => {
    console.log('Event fired:', e.detail);
});

// Check global variables
console.log('Available globals:', Object.keys(window).filter(k => k.includes('Calculator')));

// Verify element exists
console.log('Element found:', document.getElementById('element-id'));
```

## 📚 Related Documentation

- [API Documentation](CASPIO_API_CORE.md) - Complete API endpoint reference
- [Architecture Patterns](ARCHITECTURE.md) - System design patterns
- [Common Patterns](PATTERNS.md) - Reusable code patterns
- [Main Guide](../docs/DOCS_INDEX.md) - Primary development guidelines

---

**Remember:** Most "UI bugs" are actually data/API issues. Always check the data layer first!