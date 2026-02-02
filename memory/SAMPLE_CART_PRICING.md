# Sample Cart Pricing Guide

**Last Updated:** 2026-02-02
**Purpose:** Comprehensive guide for blank sample product pricing

## Overview

The sample cart allows customers to request blank apparel samples (no decoration) with standard industry markup. Samples ship without logos or decoration.

### Key Differences from Quote Builders

| Feature | Quote Builders | Sample Cart |
|---------|----------------|-------------|
| **Products** | Decorated (with logo) | Blank (no decoration) |
| **Pricing** | Base + margin + decoration | Base + margin only |
| **Volume** | High (main business) | Low (occasional) |
| **Calculation** | Frontend + Backend | Frontend only |

## Pricing Formula

### Step 1: Get Base Garment Cost
```javascript
const baseCost = sizeData.price;  // From API: sizes array
```

### Step 2: Apply 43% Margin (2026)
```javascript
const priceWithMargin = baseCost / 0.57;
// 0.57 = 57% of retail price (43% margin)
// Example: $6.00 ÷ 0.57 = $10.53
```

### Step 3: Round to Half-Dollar
```javascript
const roundedPrice = Math.ceil(priceWithMargin * 2) / 2;
// Math.ceil ensures rounding UP
// Examples:
//   $10.23 → $10.50
//   $10.51 → $11.00
//   $10.00 → $10.00 (no change)
```

### Step 4: Add Size Upcharge
```javascript
const upcharge = upcharges[size] || 0;  // From API
const finalPrice = roundedPrice + upcharge;
```

## Rounding Rules

### Method: Half-Dollar Ceiling

**Formula:** `Math.ceil(price * 2) / 2`

**Why this method?**
- ✅ Consistent with DTG/Screen Print quote builders
- ✅ Prevents underpricing (always rounds up)
- ✅ Creates clean pricing ($5.00, $5.50, $6.00)
- ✅ Industry standard for custom apparel

**Examples:**
| Input | Calculation | Output |
|-------|-------------|--------|
| $5.00 | 5.00 × 2 = 10, ceil(10) = 10, 10 ÷ 2 = 5.00 | $5.00 |
| $5.23 | 5.23 × 2 = 10.46, ceil(10.46) = 11, 11 ÷ 2 = 5.50 | $5.50 |
| $5.50 | 5.50 × 2 = 11, ceil(11) = 11, 11 ÷ 2 = 5.50 | $5.50 |
| $5.51 | 5.51 × 2 = 11.02, ceil(11.02) = 12, 12 ÷ 2 = 6.00 | $6.00 |

## Size Handling

### Standard Sizes (No Upcharge)
- **Sizes:** S, M, L, XL
- **Upcharge:** $0
- **Example:** Base $10.00 → Final $10.00

### Oversized (API Upcharge)
- **Sizes:** 2XL, 3XL, 4XL, 5XL, 6XL
- **Typical Upcharges:** +$2.00, +$3.00, +$4.00, +$5.00, +$6.00
- **Example:** Base $10.00 + $2.00 → Final $12.00

### Tall Sizes (API Upcharge)
- **Sizes:** MT, LT, XLT, 2XLT, 3XLT
- **Typical Upcharges:** +$2.50, +$3.00, +$3.50
- **Example:** Base $10.00 + $2.50 → Final $12.50

### Youth Sizes (Usually No Upcharge)
- **Sizes:** YXS, YS, YM, YL, YXL
- **Typical Upcharges:** $0
- **Example:** Base $8.00 → Final $8.00

## Size Ordering

**Display Order:**
1. Youth (YXS → YXL)
2. Standard (XS → XL)
3. Tall (MT → XLT)
4. Oversized (2XL → 6XL)
5. Tall Oversized (2XLT → 3XLT)
6. One Size (OSFA)

**Implementation:** See `sortSizesByOrder()` function in sample-cart.html

## API Integration

### Endpoint Used
```
GET /api/pricing-bundle?method=BLANK&styleNumber={styleNumber}
```

### Response Fields Used
```json
{
  "sizes": [
    { "size": "S", "price": 5.50 },
    { "size": "2XL", "price": 7.50 },
    { "size": "LT", "price": 7.00 }
  ],
  "sellingPriceDisplayAddOns": {
    "S": 0,
    "2XL": 2.00,
    "LT": 2.50
  }
}
```

### Why Use pricing-bundle with BLANK method?
- ✅ Semantically correct for blank products (no decoration)
- ✅ Already includes all size variations
- ✅ Already includes all upcharges
- ✅ Uses correct pricing rules from Caspio (MarginDenominator: 0.57, HalfDollarCeil_Final)
- ✅ Consistent with quote builders architecture

## Complete Pricing Examples

### Example 1: Standard Size (Medium)
```
Product: Port & Company PC61
Size: Medium
Base Cost: $5.50
Margin: $5.50 ÷ 0.6 = $9.17
Round: ceil($9.17 × 2) ÷ 2 = ceil(18.34) ÷ 2 = 19 ÷ 2 = $9.50
Upcharge: $0
Final: $9.50
```

### Example 2: Oversized (2XL)
```
Product: Port & Company PC61
Size: 2XL
Base Cost: $7.50
Margin: $7.50 ÷ 0.6 = $12.50
Round: ceil($12.50 × 2) ÷ 2 = ceil(25) ÷ 2 = 25 ÷ 2 = $12.50
Upcharge: $2.00 (from API)
Final: $14.50
```

### Example 3: Tall Size (LT)
```
Product: Port & Company PC61
Size: Large Tall
Base Cost: $7.00
Margin: $7.00 ÷ 0.6 = $11.67
Round: ceil($11.67 × 2) ÷ 2 = ceil(23.34) ÷ 2 = 24 ÷ 2 = $12.00
Upcharge: $2.50 (from API)
Final: $14.50
```

### Example 4: Mixed Cart
```
Cart Contents (7 items):
- S (1):    $9.50 × 1 = $9.50
- M (1):    $9.50 × 1 = $9.50
- L (1):    $9.50 × 1 = $9.50
- XL (1):   $9.50 × 1 = $9.50
- LT (1):   $14.50 × 1 = $14.50  ← Tall upcharge
- 2XL (1):  $14.50 × 1 = $14.50  ← Oversized upcharge
- 3XL (1):  $15.50 × 1 = $15.50  ← 3XL upcharge

Cart Total: $92.50
```

## Testing Checklist

### Price Calculation
- [ ] Standard sizes (S-XL) round correctly to $X.00 or $X.50
- [ ] Oversized (2XL+) include API upcharges
- [ ] Tall sizes (LT, XLT) include API upcharges
- [ ] Youth sizes calculate correctly
- [ ] Edge cases: $0, very small, very large

### Size Ordering
- [ ] Sizes display in correct order
- [ ] Youth sizes appear first (if present)
- [ ] Standard sizes (S-XL) in order
- [ ] Tall sizes grouped correctly
- [ ] Oversized sizes at end

### Cart Functionality
- [ ] Multiple sizes show individual prices
- [ ] Cart total = Σ(qty × price_with_upcharge)
- [ ] Remove item works
- [ ] Empty cart displays correctly

### API Integration
- [ ] API call succeeds for valid style numbers
- [ ] Upcharges retrieved correctly
- [ ] API failure shows user-friendly error
- [ ] Console logs show pricing calculation

## Common Issues & Solutions

### Issue: Prices not ending in .00 or .50
**Cause:** Rounding not applied or applied incorrectly
**Solution:** Verify `Math.ceil(price * 2) / 2` formula

### Issue: All sizes showing same price
**Cause:** Upcharges not applied
**Solution:** Check `item.upcharges` is stored and accessed correctly

### Issue: Old cart items missing upcharges (backward compatibility)
**Cause:** Cart items added before upcharges feature was implemented don't have `upcharges` field
**Symptom:** All sizes show $0.00 upcharge even for 2XL/3XL/4XL
**Solution:** Implement migration function in sample-cart.html
```javascript
// Migration function to add missing upcharges to old cart items
async function migrateCartUpcharges(cart) {
    if (!cart || cart.length === 0) return cart;

    let updated = false;
    const apiBase = 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';

    for (let i = 0; i < cart.length; i++) {
        const item = cart[i];

        // Check if upcharges field is missing
        if (!item.upcharges || Object.keys(item.upcharges).length === 0) {
            try {
                const response = await fetch(`${apiBase}/api/pricing-bundle?method=BLANK&styleNumber=${item.style}`);
                if (response.ok) {
                    const data = await response.json();
                    cart[i].upcharges = data.sellingPriceDisplayAddOns || {};
                    updated = true;
                }
            } catch (error) {
                cart[i].upcharges = {};
            }
        }
    }

    // Save migrated cart back to sessionStorage
    if (updated) {
        sessionStorage.setItem('sampleCart', JSON.stringify({
            samples: cart,
            timestamp: new Date().toISOString()
        }));
    }

    return cart;
}

// Call during cart load (make loadCart async)
async function loadCart() {
    let cart = getCartSamples();
    cart = await migrateCartUpcharges(cart);
    // ... rest of load logic
}
```

### Issue: Sales tax not matching line item total
**Cause:** Tax calculated on base price × quantity instead of actual line item prices with upcharges
**Symptom:** Order note shows "$494.00 + $49.89 tax" but line items total $529.00
**Solution:** Calculate subtotal AFTER generating line items (sample-order-service.js lines 187-189)
```javascript
// Generate line items FIRST (with size-specific pricing)
const lineItems = samples.flatMap(sample => this.expandSampleIntoLineItems(sample));

// Calculate subtotal by summing actual line item prices
const subtotal = lineItems
    .filter(item => item.notes && item.notes.includes('PAID SAMPLE'))
    .reduce((sum, item) => sum + (item.quantity * item.price), 0);

// Tax now calculates correctly on $529 instead of $494
const salesTax = subtotal * 0.101;
```

### Issue: Sizes out of order
**Cause:** Size sorting not applied
**Solution:** Use `sortSizesByOrder()` before displaying

### Issue: Tall sizes not working
**Cause:** API doesn't have tall size data for this product
**Solution:** Verify product has tall sizes in Caspio database

## Related Documentation

- **API Documentation:** memory/api/cart-pricing-api.md
- **Sample Order Service:** /pages/sample-order-service.js
- **Top Sellers Showcase:** /pages/top-sellers-showcase.html

---

**Documentation Type:** Pricing Guide
**Related:** DOCS_INDEX.md, cart-pricing-api.md
