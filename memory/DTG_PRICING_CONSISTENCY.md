# DTG Pricing Consistency - Technical Reference Guide

**Last Updated:** 2025-10-13
**Purpose:** Detailed technical reference for maintaining pricing consistency between DTG Quote Builder and DTG Pricing Calculator

## Overview

The DTG pricing system has TWO independent calculators that must produce identical prices for the same inputs:

1. **DTG Quote Builder** - Multi-product quotes with database persistence
2. **DTG Pricing Calculator** - Single product pricing for customers

This document provides technical details, formulas, test cases, and troubleshooting for maintaining pricing consistency.

## Critical Requirements

### ⚠️ PRIMARY RULE
**These calculators MUST produce identical prices for the same inputs:**
- Same product (style number, color)
- Same quantity
- Same print location(s)
- Same size distribution

**If prices differ by even 1 cent, it's a bug that must be fixed immediately.**

## Architecture: What's Shared vs. What's Not

### ✅ Shared Components (Automatic Synchronization)

These files are used by BOTH calculators. Changes here affect both automatically:

#### 1. `/shared_components/js/dtg-pricing-service.js`

**What it does:**
- Fetches pricing data from API
- Contains core pricing formulas
- Calculates base garment costs
- Applies margin denominators
- Calculates print costs by location
- Rounds to half-dollar increments

**Key Methods:**
```javascript
// Fetch pricing bundle from API
async fetchPricingData(styleNumber, color)

// Calculate prices for all locations
calculateAllLocationPrices(data, quantity)

// Get tier for quantity
getTierForQuantity(tiers, quantity)

// Round to nearest half dollar (UP)
roundUpToHalfDollar(amount)
```

**Critical Formulas:**
```javascript
// Base garment cost (line 374)
const baseCost = Math.min(...sizes.map(s => s.price).filter(p => p > 0));

// Apply margin (line 390)
const markedUpGarment = baseCost / tier.MarginDenominator;

// Add print cost (line 391)
const basePrice = markedUpGarment + totalPrintCost;

// Round UP to half dollar (line 392)
const roundedBasePrice = Math.ceil(basePrice * 2) / 2;

// Add size upcharge (line 408)
const finalPrice = roundedBasePrice + upcharge;
```

#### 2. `/shared_components/js/dtg-quote-pricing.js`

**What it does:**
- Wraps DTGPricingService for quote-specific logic
- Handles aggregate quantity calculations
- Calculates LTM (Less Than Minimum) fees
- Groups sizes by price for display

**Key Methods:**
```javascript
// Get tier based on aggregate quantity
getTierForQuantity(quantity)

// Calculate LTM fee per unit
calculateLTMPerUnit(totalQuantity)

// Calculate product pricing with LTM
calculateProductPricing(product, location, sizeQuantities, aggregateQuantity)

// Calculate totals for entire quote
calculateQuoteTotals(products, location, aggregateQuantity)
```

**Critical LTM Formula (Lines 41-48):**
```javascript
calculateLTMPerUnit(totalQuantity) {
    if (totalQuantity < 24) {
        // Math.floor ensures we ROUND DOWN
        // Example: $50 ÷ 18 = 2.777... → $2.77 (not $2.78)
        return Math.floor((this.LTM_FEE / totalQuantity) * 100) / 100;
    }
    return 0;
}
```

**Why Math.floor():**
- Prevents over-charging customers
- 18 pieces: $2.77 × 18 = $49.86 (14¢ under $50) ✓
- If we used Math.round(): $2.78 × 18 = $50.04 (4¢ over $50) ✗

### ❌ NOT Shared (Manual Synchronization Required)

These components are duplicated and must be manually kept in sync:

#### 1. LTM Fee Display Logic

**Quote Builder** (`dtg-quote-builder.js` lines 949-959):
```javascript
if (quoteTotals.hasLTM) {
    this.summaryLtmNote.style.display = 'block';
    const ltmBreakdownText = document.getElementById('ltm-breakdown-text');
    if (ltmBreakdownText) {
        // Use actual ltmPerUnit from pricing calculation
        const firstProduct = quoteTotals.products[0];
        const ltmPerPiece = firstProduct?.pricing?.ltmPerUnit || 0;
        ltmBreakdownText.textContent = `$${quoteTotals.ltmFee.toFixed(2)} total fee ÷ ${totalQuantity} shirts = $${ltmPerPiece.toFixed(2)} per shirt`;
    }
}
```

**Pricing Calculator** (`dtg-pricing.html`):
- Check for equivalent LTM display
- Verify uses same Math.floor() calculation
- Ensure breakdown text format matches

**Testing:** Both should show identical LTM per-piece amounts.

#### 2. Size Breakdown Display

**Quote Builder** (`dtg-quote-builder.js` lines 897-934):
```javascript
<div class="size-breakdown-transparent">
    ${product.sizeGroups.map((group) => {
        const sizeList = Object.entries(group.sizes)
            .map(([size, qty]) => `${size}:${qty}`)
            .join(', ');

        return `
            <div class="size-pricing-detail">
                <div class="size-label">${sizeList} (${totalQty} total)</div>
                <div class="price-calculation">
                    <span class="base-price">$${group.basePrice.toFixed(2)}</span>
                    ${hasLTM ? `
                        <span class="price-plus">+</span>
                        <span class="small-batch-fee">$${group.ltmPerUnit.toFixed(2)} Small Batch Fee</span>
                    ` : ''}
                    <span class="price-equals">=</span>
                    <span class="unit-total">$${group.unitPrice.toFixed(2)}/pc</span>
                </div>
            </div>
        `;
    }).join('')}
</div>
```

**Pricing Calculator:**
- Should use identical HTML structure
- Same CSS classes for styling
- Same calculation display format

#### 3. Green Button Styling (Added 2025-10-13)

**Quote Builder** (`dtg-quote-builder.js` line 928):
```javascript
<span class="unit-total" style="font-weight: 700; color: white; background: #059669; padding: 0.375rem 1rem; border-radius: 8px; font-size: 0.95rem; box-shadow: 0 1px 3px rgba(5, 150, 105, 0.3);">
    $${group.unitPrice.toFixed(2)}/pc
</span>
```

**Pricing Calculator:**
- Must have matching green button style
- Same background color: `#059669`
- Same padding, border-radius, shadow

## Detailed Pricing Formulas

### Base Price Calculation

```
Step 1: Get base garment cost
    baseCost = Math.min(...sizes.map(s => s.price).filter(p => p > 0))

    Example: PC61 has sizes:
    - S: $5.50
    - M: $5.50
    - L: $5.50
    - XL: $5.50
    - 2XL: $7.50
    - 3XL: $8.50

    baseCost = $5.50 (minimum)

Step 2: Apply margin denominator
    markedUpPrice = baseCost / tier.MarginDenominator

    Example at 48 qty (tier 48-71):
    - MarginDenominator: 0.60 (from API)
    - markedUpPrice = $5.50 / 0.60 = $9.166...

Step 3: Add print cost
    basePrice = markedUpPrice + printCost

    Example for Left Chest:
    - printCost: $5.00 (from API for tier 48-71)
    - basePrice = $9.166... + $5.00 = $14.166...

Step 4: Round UP to half dollar
    roundedPrice = Math.ceil(basePrice * 2) / 2

    Example:
    - $14.166... * 2 = 28.333...
    - Math.ceil(28.333...) = 29
    - 29 / 2 = $14.50

Step 5: Add size upcharge
    finalPrice = roundedPrice + upcharge

    Example for 2XL:
    - upcharge: $2.00 (from API)
    - finalPrice = $14.50 + $2.00 = $16.50
```

### LTM Fee Calculation

```
For orders under 24 pieces:

Step 1: Calculate per-unit LTM
    ltmPerUnit = Math.floor((50.00 / totalQuantity) * 100) / 100

    Example with 18 pieces:
    - 50.00 / 18 = 2.777...
    - 2.777... * 100 = 277.777...
    - Math.floor(277.777...) = 277
    - 277 / 100 = $2.77

Step 2: Add to unit price
    finalUnitPrice = basePrice + ltmPerUnit

    Example:
    - basePrice: $14.50
    - ltmPerUnit: $2.77
    - finalUnitPrice: $17.27

Step 3: Verify total LTM collected
    totalLTM = ltmPerUnit * quantity

    Example:
    - $2.77 * 18 = $49.86
    - This is $0.14 under $50 (acceptable, customer-friendly)
```

### Combo Location Pricing

For combo locations (e.g., LC_FB = Left Chest + Full Back):

```
Step 1: Get print cost for each location
    lcCost = $5.00 (from API for tier)
    fbCost = $7.00 (from API for tier)

Step 2: Sum the costs
    totalPrintCost = lcCost + fbCost = $12.00

Step 3: Continue with standard formula
    markedUpPrice = baseCost / marginDenominator
    basePrice = markedUpPrice + totalPrintCost
    roundedPrice = Math.ceil(basePrice * 2) / 2
```

## Testing Protocol

### Standard Test Case

Use this test case to verify both calculators produce identical results:

**Test Inputs:**
- Product: PC61 Orange
- Quantity: 17 pieces (tests LTM)
- Location: Left Chest + Full Back (tests combo)
- Sizes: S:1, M:1, L:2, XL:1, 2XL:1, 3XL:1

**Expected Results:**
1. Both calculators show same base price for standard sizes (S-XL)
2. Both show correct upcharges for 2XL, 3XL
3. Both calculate LTM as $2.94 per piece ($50 ÷ 17)
4. Both show breakdown: "Base + $2.94 Small Batch Fee = Total"
5. Grand totals match exactly

**Testing Steps:**

1. Open Quote Builder in one tab
2. Open Pricing Calculator in another tab
3. Enter test inputs in both
4. Compare line by line:
   - Base prices for each size
   - LTM per-piece amount
   - Final unit prices
   - Subtotals
   - Grand total

**Verification Checklist:**
- [ ] Standard sizes (S-XL) show same price
- [ ] Upcharged sizes (2XL+) show same price with same upcharge
- [ ] LTM per-piece matches: $2.94
- [ ] LTM breakdown text matches format
- [ ] Grand total matches
- [ ] Green button styling matches

### Additional Test Cases

**Test Case 2: No LTM (24+ pieces)**
- Product: PC61 Black
- Quantity: 24 pieces
- Location: Full Front
- Verify: No LTM fee shown, prices identical

**Test Case 3: Large Order**
- Product: PC54 Navy
- Quantity: 150 pieces
- Location: Full Back
- Verify: Uses tier 145+ pricing, no LTM

**Test Case 4: Extended Sizes**
- Product: PC61 White
- Quantity: 48 pieces
- Location: Left Chest
- Sizes: All 2XL, 3XL, 4XL, 5XL
- Verify: Upcharges apply correctly

## Common Discrepancies & Fixes

### Issue 1: Prices Differ by $0.01

**Symptom:** Quote Builder shows $14.51, Pricing Calculator shows $14.50

**Cause:** Rounding inconsistency

**Check:**
```javascript
// Both should use:
Math.ceil(basePrice * 2) / 2

// NOT:
Math.round(basePrice * 2) / 2  // Wrong
basePrice.toFixed(2)            // Wrong
```

**Fix:** Ensure both use `Math.ceil()` for half-dollar rounding.

### Issue 2: LTM Display Shows Wrong Amount

**Symptom:** Breakdown shows $2.78 but calculations use $2.77

**Cause:** Display recalculates division instead of using stored value

**Check:**
```javascript
// WRONG - recalculates:
const ltmPerPiece = (ltmFee / quantity).toFixed(2);

// CORRECT - uses calculated value:
const ltmPerPiece = firstProduct.pricing.ltmPerUnit;
```

**Fix:** Always extract `ltmPerUnit` from pricing calculation result, don't recalculate.

### Issue 3: Combo Location Prices Wrong

**Symptom:** LC_FB shows different price than LC + FB summed

**Cause:** Not summing print costs correctly

**Check:**
```javascript
// Verify both use:
const locationCodes = locationCode.split('_');
let totalPrintCost = 0;
locationCodes.forEach(code => {
    const costEntry = costs.find(c =>
        c.PrintLocationCode === code &&
        c.TierLabel === tier.TierLabel
    );
    totalPrintCost += parseFloat(costEntry.PrintCost);
});
```

**Fix:** Ensure both split combo codes and sum costs.

### Issue 4: Size Upcharges Not Applied

**Symptom:** 2XL shows same price as XL

**Cause:** Not adding upcharge from API data

**Check:**
```javascript
// Both should use:
const upcharge = upcharges[size] || 0;
const finalPrice = roundedBasePrice + upcharge;
```

**Fix:** Ensure upcharges from API are applied after base price calculation.

## API Data Structure

### Expected API Response Format

```javascript
{
    "tiers": [
        {
            "TierLabel": "24-47",
            "MinQuantity": 24,
            "MaxQuantity": 47,
            "MarginDenominator": 0.60
        },
        {
            "TierLabel": "48-71",
            "MinQuantity": 48,
            "MaxQuantity": 71,
            "MarginDenominator": 0.60
        },
        {
            "TierLabel": "72+",
            "MinQuantity": 72,
            "MaxQuantity": 9999,
            "MarginDenominator": 0.65
        }
    ],
    "costs": [
        {
            "PrintLocationCode": "LC",
            "TierLabel": "24-47",
            "PrintCost": 5.50
        },
        {
            "PrintLocationCode": "LC",
            "TierLabel": "48-71",
            "PrintCost": 5.00
        },
        // ... more print costs
    ],
    "sizes": [
        { "size": "S", "price": 5.50, "sortOrder": 1 },
        { "size": "M", "price": 5.50, "sortOrder": 2 },
        { "size": "L", "price": 5.50, "sortOrder": 3 },
        { "size": "XL", "price": 5.50, "sortOrder": 4 },
        { "size": "2XL", "price": 7.50, "sortOrder": 5 }
    ],
    "upcharges": {
        "S": 0,
        "M": 0,
        "L": 0,
        "XL": 0,
        "2XL": 2.00,
        "3XL": 3.00,
        "4XL": 4.00
    }
}
```

### Critical Field Names

**IMPORTANT:** Use `price` NOT `maxCasePrice`

```javascript
// CORRECT:
const baseCost = Math.min(...sizes.map(s => s.price).filter(p => p > 0));

// WRONG (old code, caused $1 discrepancy):
const baseCost = Math.min(...sizes.map(s => s.maxCasePrice).filter(p => p > 0));
```

This was fixed 2025-10-05 in `dtg-pricing-service.js` lines 374 and 398.

## Debugging Tools

### Console Commands for Verification

```javascript
// 1. Check if services are loaded
console.log('Quote Service:', window.DTGQuoteService);
console.log('Pricing Service:', window.DTGPricingService);
console.log('Quote Pricing:', window.DTGQuotePricing);

// 2. Test LTM calculation
const quotePricing = new window.DTGQuotePricing();
console.log('LTM for 18 pieces:', quotePricing.calculateLTMPerUnit(18));
// Should show: 2.77

// 3. Test tier selection
console.log('Tier for 17 pieces:', quotePricing.getTierForQuantity(17));
// Should show: "24-47"

// 4. Compare pricing services
const service1 = new DTGPricingService();
const service2 = new DTGPricingService();
// Fetch same data from both and compare

// 5. Check rounding
const testPrices = [14.166, 14.25, 14.333, 14.50, 14.666];
testPrices.forEach(price => {
    const rounded = Math.ceil(price * 2) / 2;
    console.log(`${price} → ${rounded}`);
});
// 14.166 → 14.50
// 14.25 → 14.50
// 14.333 → 14.50
// 14.50 → 14.50
// 14.666 → 15.00
```

### Browser DevTools Verification

1. Open both calculators in separate tabs
2. Open DevTools Console in each
3. Monitor network requests:
   - Both should fetch from same API endpoint
   - Both should receive identical tier/cost data
4. Check localStorage/sessionStorage:
   - Should not interfere with pricing calculations
   - Cache keys should be style-specific

### Performance Monitoring

```javascript
// Add to both calculators for load time comparison
window.DTG_PERFORMANCE = {
    startTime: performance.now(),

    track(event) {
        const elapsed = performance.now() - this.startTime;
        console.log(`[${event}] ${elapsed.toFixed(2)}ms`);
    }
};

// Use throughout:
DTG_PERFORMANCE.track('API_FETCH_START');
// ... fetch code
DTG_PERFORMANCE.track('API_FETCH_COMPLETE');
DTG_PERFORMANCE.track('PRICING_CALCULATED');
DTG_PERFORMANCE.track('UI_RENDERED');
```

## Change Log

### 2025-10-13
- **Added:** Green button styling requirement for final per-piece prices
- **Style:** `background: #059669`, white text, pill shape with shadow
- **Files:** Quote Builder line 928, Pricing Calculator (needs sync)

### 2025-10-05
- **Fixed:** Field name consistency in dtg-pricing-service.js
- **Changed:** Lines 374, 398 from `maxCasePrice` to `price`
- **Impact:** Resolved ~$1 price discrepancy between calculators

### 2025-01-29 (Estimated)
- **Fixed:** LTM display inconsistency in Quote Builder
- **Changed:** Lines 954-957 to use actual ltmPerUnit instead of recalculating
- **Impact:** Display now shows $2.77 instead of $2.78 for 18-piece orders

## Future Improvements

### Potential Enhancements

1. **Extract Display Logic to Shared Component**
   - Create `/shared_components/js/dtg-pricing-display.js`
   - Move HTML generation for size breakdowns
   - Move LTM breakdown text generation
   - Both calculators import and use same display functions

2. **Automated Testing**
   - Create test suite that runs against both calculators
   - Verify prices match for predefined test cases
   - Alert if discrepancies detected

3. **Unified Configuration**
   - Single source for styling (green button, etc.)
   - Shared CSS classes for pricing display
   - Configuration file for constants (LTM fee, threshold, etc.)

4. **Visual Comparison Tool**
   - Dashboard that shows both calculators side-by-side
   - Highlights any differences in real-time
   - Useful for QA testing

## Summary

**Key Takeaways:**

1. **Two calculators, one pricing system** - Must always match
2. **Shared services handle formulas** - Changes affect both automatically
3. **Display logic is separate** - Requires manual synchronization
4. **Math.floor() for LTM** - Never change this, prevents over-charging
5. **Test with 17 pieces** - Best test case (LTM + combo location)
6. **Green button styling** - Must match across both calculators

**When in doubt:**
1. Check CLAUDE.md synchronization section
2. Run the standard test case (17 pieces, PC61, LC+FB)
3. Compare line-by-line in DevTools console
4. Fix shared services first, then update display logic

**Remember:** Wrong pricing is worse than no pricing. If prices don't match, stop and fix immediately.

---

**Documentation Type:** Technical Reference & Troubleshooting Guide
**Parent Document:** [CLAUDE.md](/CLAUDE.md) "DTG Calculator Synchronization" section
**Related Files:**
- `/shared_components/js/dtg-pricing-service.js` (shared formulas)
- `/shared_components/js/dtg-quote-pricing.js` (shared LTM logic)
- `/shared_components/js/dtg-quote-builder.js` (quote builder display)
- `/calculators/dtg-pricing.html` (pricing calculator display)
