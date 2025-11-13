# 3-Day Tees - Pricing Formula Reference

**Last Updated:** 2025-11-08
**Purpose:** Complete pricing calculation logic including 7-step formula, rush fee, and LTM handling
**Status:** Implementation Ready

---

## 📋 Quick Navigation

**Related Documentation:**
- **[Main PRD](../../3-DAY-TEES-PROJECT-REQUIREMENTS.md)** - Executive summary
- **[Overview](OVERVIEW.md)** - Architecture and reusable components
- **[Inventory Integration](INVENTORY-INTEGRATION.md)** - Multi-SKU architecture
- **[API Patterns](API-PATTERNS.md)** - API integration specs
- **[Implementation Timeline](IMPLEMENTATION-TIMELINE.md)** - Development plan
- **[Business Logic](BUSINESS-LOGIC.md)** - Terms and fees

---

## 🧮 Complete 7-Step Pricing Formula

**Based on:** `/shared_components/js/dtg-pricing-service.js`
**Verified:** Working in `/calculators/dtg-pricing.html`

### Full Calculation Function

```javascript
/**
 * Complete DTG + 25% Rush Fee Pricing Calculation
 * This formula applies to ALL 3-Day Tees orders
 */
async function calculate3DayTeesPrice(quantity, location, size) {
    // STEP 1: Get base garment cost (lowest size price from API)
    const pricingData = await fetch('/api/pricing-bundle?method=DTG&styleNumber=PC54');
    const baseCost = Math.min(...pricingData.sizes
        .map(s => parseFloat(s.price))
        .filter(p => p > 0)
    );
    // Example: $4.50 for S-XL, $6.50 for 2XL, $7.50 for 3XL

    // STEP 2: Get quantity tier and margin
    const tier = pricingData.tiers.find(t =>
        quantity >= t.MinQuantity && quantity <= t.MaxQuantity
    );
    const markedUpGarment = baseCost / tier.MarginDenominator;
    // Example: $4.50 / 0.6 = $7.50

    // STEP 3: Get print cost for location and tier
    const printCost = pricingData.costs.find(c =>
        c.PrintLocationCode === location &&
        c.TierLabel === tier.TierLabel
    ).PrintCost;
    // Example: Left Chest (LC) at 24-47 tier = $5.00

    // STEP 4: Calculate base DTG price
    const baseDTGPrice = markedUpGarment + printCost;
    // Example: $7.50 + $5.00 = $12.50

    // STEP 5: Round base price to half dollar (ceiling)
    const roundedBase = Math.ceil(baseDTGPrice * 2) / 2;
    // Example: ceil($12.50 * 2) / 2 = ceil(25) / 2 = $12.50

    // STEP 6: Apply 25% rush fee
    const rushFee = roundedBase * 0.25;
    const priceWithRush = roundedBase + rushFee;
    // Example: $12.50 + ($12.50 * 0.25) = $12.50 + $3.13 = $15.63

    // STEP 7: Final rounding to half dollar (ceiling)
    const finalPrice = Math.ceil(priceWithRush * 2) / 2;
    // Example: ceil($15.63 * 2) / 2 = ceil(31.26) / 2 = 32 / 2 = $16.00

    // STEP 8: Apply size upcharges (from API)
    const upcharge = pricingData.upcharges[size] || 0;
    const sizeSpecificPrice = finalPrice + upcharge;
    // Example: $16.00 + $2.00 (for 2XL) = $18.00

    return {
        baseCost: baseCost,              // $4.50
        markedUpGarment: markedUpGarment, // $7.50
        printCost: printCost,            // $5.00
        baseDTGPrice: baseDTGPrice,      // $12.50
        roundedBase: roundedBase,        // $12.50
        rushFee: rushFee,                // $3.13
        priceWithRush: priceWithRush,    // $15.63
        finalPrice: finalPrice,          // $16.00
        upcharge: upcharge,              // $2.00 (for 2XL)
        sizeSpecificPrice: sizeSpecificPrice // $18.00 (final price for 2XL)
    };
}
```

### Step-by-Step Breakdown

#### Step 1: Get Base Garment Cost
**Purpose:** Find the lowest price from API pricing data (excludes upcharge sizes)

**Code:**
```javascript
const baseCost = Math.min(...pricingData.sizes
    .map(s => parseFloat(s.price))
    .filter(p => p > 0)
);
```

**Example Values:**
- S-XL: $4.50
- 2XL: $6.50
- 3XL: $7.50

**Result:** Always use S-XL base cost ($4.50) for calculation

---

#### Step 2: Apply Margin Denominator
**Purpose:** Calculate marked-up garment cost based on quantity tier

**Code:**
```javascript
const tier = pricingData.tiers.find(t =>
    quantity >= t.MinQuantity && quantity <= t.MaxQuantity
);
const markedUpGarment = baseCost / tier.MarginDenominator;
```

**Example Tiers:**
| Tier | Quantity Range | Margin Denominator | Markup % |
|------|----------------|-------------------|----------|
| 24-47 | 24-47 | 0.60 | 67% |
| 48-71 | 48-71 | 0.60 | 67% |
| 72+ | 72+ | 0.60 | 67% |

**Example:** $4.50 ÷ 0.60 = $7.50

---

#### Step 3: Get Print Cost
**Purpose:** Retrieve decoration cost for selected location and quantity tier

**Code:**
```javascript
const printCost = pricingData.costs.find(c =>
    c.PrintLocationCode === location &&
    c.TierLabel === tier.TierLabel
).PrintCost;
```

**Example Print Costs (24-47 tier):**
| Location Code | Location Name | Cost |
|---------------|--------------|------|
| LC | Left Chest | $5.00 |
| FF | Full Front | $7.00 |
| FB | Full Back | $8.00 |

**Example:** Left Chest at 24-47 tier = $5.00

---

#### Step 4: Calculate Base DTG Price
**Purpose:** Sum marked-up garment + print cost

**Code:**
```javascript
const baseDTGPrice = markedUpGarment + printCost;
```

**Example:** $7.50 + $5.00 = $12.50

---

#### Step 5: Round Base Price (Half-Dollar Ceiling)
**Purpose:** Round to nearest $0.50, always rounding UP

**Code:**
```javascript
const roundedBase = Math.ceil(baseDTGPrice * 2) / 2;
```

**Examples:**
| Input | Calculation | Output |
|-------|-------------|--------|
| $12.00 | ceil(24.00) ÷ 2 = $12.00 | $12.00 |
| $12.25 | ceil(24.50) ÷ 2 = $12.50 | $12.50 |
| $12.50 | ceil(25.00) ÷ 2 = $12.50 | $12.50 |
| $12.75 | ceil(25.50) ÷ 2 = $13.00 | $13.00 |

**Example:** ceil($12.50 × 2) ÷ 2 = ceil(25) ÷ 2 = $12.50

---

#### Step 6: Apply 25% Rush Fee
**Purpose:** Add 3-day turnaround premium to base price

**Code:**
```javascript
const rushFee = roundedBase * 0.25;
const priceWithRush = roundedBase + rushFee;
```

**Example:** $12.50 + ($12.50 × 0.25) = $12.50 + $3.13 = $15.63

**Rush Fee Percentages:**
- Standard DTG: 0% (no rush)
- 3-Day Tees: 25% (rush fee)

---

#### Step 7: Final Rounding (Half-Dollar Ceiling)
**Purpose:** Round final price to nearest $0.50, always rounding UP

**Code:**
```javascript
const finalPrice = Math.ceil(priceWithRush * 2) / 2;
```

**Examples:**
| Input | Calculation | Output |
|-------|-------------|--------|
| $15.00 | ceil(30.00) ÷ 2 = $15.00 | $15.00 |
| $15.25 | ceil(30.50) ÷ 2 = $15.50 | $15.50 |
| $15.50 | ceil(31.00) ÷ 2 = $15.50 | $15.50 |
| $15.63 | ceil(31.26) ÷ 2 = $16.00 | $16.00 |
| $15.75 | ceil(31.50) ÷ 2 = $16.00 | $16.00 |

**Example:** ceil($15.63 × 2) ÷ 2 = ceil(31.26) ÷ 2 = 32 ÷ 2 = $16.00

---

#### Step 8: Apply Size Upcharges
**Purpose:** Add upcharge for oversized (2XL, 3XL, 4XL)

**Code:**
```javascript
const upcharge = pricingData.upcharges[size] || 0;
const sizeSpecificPrice = finalPrice + upcharge;
```

**Size Upcharges:**
| Size | Upcharge |
|------|----------|
| S-XL | $0.00 |
| 2XL | +$2.00 |
| 3XL | +$3.00 |
| 4XL | +$4.00 |

**Example:** $16.00 + $2.00 (2XL) = $18.00

---

## 💰 LTM Fee Calculation

**Applies to:** Orders with < 12 total pieces
**Fee Amount:** $75.00 (higher than standard $50 DTG due to rush)

### LTM Fee Formula

```javascript
// Calculate LTM fee distribution
const LTM_FEE = 75.00; // $75 for 3-Day Tees (vs. $50 for standard DTG)
const ltmPerPiece = quantity < 12 ? LTM_FEE / quantity : 0;

// Example: 8 pieces order
// $75 / 8 = $9.38 per piece LTM fee
// Add to each line item's unit price
```

### LTM Fee Examples

| Total Pieces | LTM Fee | Per Piece | Applies? |
|--------------|---------|-----------|----------|
| 6 | $75.00 | $12.50 | ✅ Yes |
| 8 | $75.00 | $9.38 | ✅ Yes |
| 10 | $75.00 | $7.50 | ✅ Yes |
| 11 | $75.00 | $6.82 | ✅ Yes |
| 12 | $0.00 | $0.00 | ❌ No |
| 24 | $0.00 | $0.00 | ❌ No |

---

## 📊 Price Display Components

### User-Facing Price Breakdown

Display these components in the order summary:

1. **Base DTG Price**: Original price before rush fee
   - Example: "$12.50"
   - Label: "Standard DTG Price"

2. **Rush Fee (25%)**: Rush premium shown separately
   - Example: "+$3.13"
   - Label: "3-Day Rush Fee (25%)"

3. **Final Price Per Size**: Price after rush fee + upcharge
   - Example: "$18.00 (2XL)"
   - Label: "Your Price"

4. **Subtotal Per Size**: Quantity × Final Price
   - Example: "2 × $18.00 = $36.00"

5. **LTM Fee** (if applicable): Fee distributed across pieces
   - Example: "$75.00 distributed across 8 pieces"
   - Label: "Less Than Minimum Fee"

6. **Subtotal**: Sum of all line items
   - Example: "$388.00"

7. **Sales Tax**: 10.1% × Subtotal
   - Example: "$39.19"

8. **Shipping**: Flat rate
   - Example: "$30.00"

9. **Grand Total**: Subtotal + LTM + Tax + Shipping
   - Example: "$457.19"

---

## ⚠️ Order Summary Calculation Pattern (Critical)

**Purpose:** Prevent rush fee double-counting in order summaries

### The Problem

Rush fee is calculated in two stages:
1. **Per-piece calculation:** Base price → Rush fee applied → Final price per piece
2. **Order summary calculation:** Sum of all pieces → Rush fee as line item → Grand total

**Common Mistake:** Using `finalPrice` (which already includes rush fee) when calculating subtotal.

### ❌ INCORRECT Pattern (Double-Counts Rush Fee)

```javascript
// WRONG: Using finalPrice that already includes rush fee
let subtotal = 0;
selectedColors.forEach(color => {
    config.sizeBreakdown.forEach(([size, qty]) => {
        const upcharge = upcharges[size] || 0;
        const pricePerPiece = finalPrice + upcharge;  // ❌ finalPrice includes rush fee
        subtotal += pricePerPiece * qty;
    });
});

const rushFee = subtotal * 0.25;  // ❌ Adds rush fee AGAIN
const total = subtotal + rushFee;
```

**Result:** Order shows inflated subtotal because rush fee is included in both `finalPrice` and as separate line item.

### ✅ CORRECT Pattern (Separate Rush Fee)

```javascript
// CORRECT: Use basePrice (before rush fee) for subtotal
let subtotal = 0;
selectedColors.forEach(color => {
    config.sizeBreakdown.forEach(([size, qty]) => {
        const upcharge = upcharges[size] || 0;
        const pricePerPiece = basePrice + upcharge;  // ✅ basePrice = before rush fee
        subtotal += pricePerPiece * qty;
    });
});

const rushFee = subtotal * 0.25;  // ✅ Rush fee calculated once on subtotal
const total = subtotal + rushFee;
```

**Result:** Order Summary correctly shows:
- Subtotal: Sum of (basePrice + upcharge) × quantity
- Rush Fee (25%): Calculated once on subtotal
- Total: Subtotal + Rush Fee

### Price Component Definitions

| Component | Definition | Includes Rush Fee? |
|-----------|------------|-------------------|
| `baseCost` | Lowest garment price from API | ❌ No |
| `markedUpGarment` | baseCost ÷ MarginDenominator | ❌ No |
| `printCost` | Decoration cost | ❌ No |
| `baseDTGPrice` | markedUpGarment + printCost | ❌ No |
| `roundedBase` | Half-dollar ceiling of baseDTGPrice | ❌ No |
| `rushFee` | roundedBase × 0.25 | N/A |
| `priceWithRush` | roundedBase + rushFee | ✅ Yes |
| `finalPrice` | Half-dollar ceiling of priceWithRush | ✅ Yes |
| `upcharge` | Size-specific upcharge | ❌ No |
| `sizeSpecificPrice` | finalPrice + upcharge | ✅ Yes |

**Key Insight:** Use `roundedBase` (not `finalPrice`) when building Order Summary subtotals.

### Implementation Examples

**Payment Modal (Stripe Integration):**
```javascript
// File: 3-day-tees.html, lines 3190-3203
const pricePerPiece = roundedBase + upcharge;  // ✅ Uses roundedBase
subtotal += pricePerPiece * sizeData.quantity;
const rushFee = subtotal * 0.25;  // ✅ Separate rush fee
```

**Order Summary Display:**
```javascript
// File: 3-day-tees.html, lines 2507-2514
const priceWithoutRush = priceBreakdown.basePrice + priceBreakdown.upcharge;
colorSubtotal += qty * priceWithoutRush;  // ✅ Uses basePrice
const rushFee = subtotal * 0.25;  // ✅ Separate rush fee
```

### Testing Verification

**Test Case:** 24 pieces, Left Chest, all standard sizes (S-XL)

```javascript
// Expected calculations:
roundedBase = $12.50      // Before rush fee applied
rushFee = $3.13           // $12.50 × 0.25
priceWithRush = $15.63    // $12.50 + $3.13
finalPrice = $16.00       // ceil($15.63 × 2) ÷ 2

// Order Summary (24 pieces):
subtotal = 24 × $12.50 = $300.00  // ✅ Using roundedBase
rushFee = $300.00 × 0.25 = $75.00 // ✅ Separate line item
total = $300.00 + $75.00 = $375.00

// WRONG if using finalPrice:
subtotal = 24 × $16.00 = $384.00  // ❌ Rush fee already included
rushFee = $384.00 × 0.25 = $96.00 // ❌ Double-counting
total = $384.00 + $96.00 = $480.00 // ❌ Inflated by $105.00
```

---

## 🧾 Complete Price Breakdown Example

**Order Details:**
- Quantity: 24 pieces
- Location: Left Chest (LC)
- Sizes: Mixed (S, M, L, XL, 2XL)

### Size-by-Size Calculation

```
Size Breakdown:
- S (4 pieces)  × $16.00 = $64.00
- M (8 pieces)  × $16.00 = $128.00
- L (8 pieces)  × $16.00 = $128.00
- XL (2 pieces) × $16.00 = $32.00
- 2XL (2 pieces) × $18.00 = $36.00    ← +$2 upcharge

Subtotal: $388.00
LTM Fee: $0.00                         ← No fee (24 pieces ≥ 12)
Sales Tax (10.1%): $39.19
Shipping: $30.00
───────────────────
Grand Total: $457.19
```

### Price per Piece Breakdown (2XL)

```
Step 1: Base Garment Cost         = $4.50
Step 2: Marked Up Garment          = $7.50   ($4.50 ÷ 0.6)
Step 3: Print Cost (LC, 24-47)     = $5.00
Step 4: Base DTG Price             = $12.50  ($7.50 + $5.00)
Step 5: Rounded Base               = $12.50  (ceil $12.50)
Step 6: Rush Fee (25%)             = $3.13   ($12.50 × 0.25)
        Price with Rush            = $15.63  ($12.50 + $3.13)
Step 7: Final Price (rounded)      = $16.00  (ceil $15.63)
Step 8: Size Upcharge (2XL)        = $2.00
        Size-Specific Price        = $18.00  ($16.00 + $2.00)
```

---

## 🎯 Size Breakdown UI

**Reuse Component:** Size selector from `top-sellers-product.html`

### Size Grid Features

- **Available Sizes:** S, M, L, XL, 2XL, 3XL, 4XL
- **Input Type:** Quantity input per size
- **Real-Time Updates:**
  - Total quantity across all sizes
  - Price per size (with upcharges)
  - Subtotal per size (qty × price)
  - Grand total

### Size Upcharges (from API)

| Size | Upcharge | Notes |
|------|----------|-------|
| S | $0.00 | Standard size |
| M | $0.00 | Standard size |
| L | $0.00 | Standard size |
| XL | $0.00 | Standard size |
| 2XL | +$2.00 | Oversized |
| 3XL | +$3.00 | Oversized |
| 4XL | +$4.00 | Oversized |

---

## 🔧 Implementation Notes

### Backward Compatibility

To add rush fee to existing DTG service without breaking current calculators:

```javascript
// In dtg-pricing-service.js
calculateLocationPrices(styleNumber, location, rushMultiplier = 0) {
    // ... existing calculation steps 1-5 ...

    // Add rush fee if specified (default 0 = no rush)
    if (rushMultiplier > 0) {
        const rushFee = roundedBase * rushMultiplier;
        const priceWithRush = roundedBase + rushFee;
        const finalPrice = Math.ceil(priceWithRush * 2) / 2;
        return finalPrice;
    }

    // Standard DTG (no rush)
    return roundedBase;
}
```

**Usage:**
```javascript
// Standard DTG (existing calculators)
calculateLocationPrices('PC54', 'LC');  // No rush fee

// 3-Day Tees (new page)
calculateLocationPrices('PC54', 'LC', 0.25);  // 25% rush fee
```

---

**Documentation Type:** Pricing Calculation Reference
**Parent Document:** [3-DAY-TEES-PROJECT-REQUIREMENTS.md](../../3-DAY-TEES-PROJECT-REQUIREMENTS.md)
**Related Docs:** All files in [/memory/3-day-tees/](.)
