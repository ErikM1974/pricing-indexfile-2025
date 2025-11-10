# PC61 ShopWorks Setup Guide - Complete 6-SKU Implementation

**Last Updated:** 2025-11-09
**Purpose:** Complete guide for setting up PC61 (Port & Company Essential Tee) in ShopWorks with extended Multi-SKU pattern
**Status:** Production-ready implementation based on Best Sellers code analysis

---

## 🎯 Overview: PC61 Extended Multi-SKU Pattern

PC61 is unique - it goes up to 6XL, requiring 6 separate SKUs in ShopWorks due to field limitations.

### The Challenge
- ShopWorks OnSite only has Size01-06 fields (6 size fields total)
- PC61 has 9 sizes: S, M, L, XL, 2XL, 3XL, 4XL, 5XL, 6XL
- Solution: Multiple SKUs that **reuse the Size06 field position**

### The Solution: Size06 Field Reuse Pattern

```
PC61        → Size01(S), Size02(M), Size03(L), Size04(XL)
PC61_2X     → Size05(2XL) - field continuation
PC61_3X     → Size06(3XL) - field continuation
PC61_4X     → Size06(4XL) - REUSES Size06 field
PC61_5X     → Size06(5XL) - REUSES Size06 field
PC61_6X     → Size06(6XL) - REUSES Size06 field
```

---

## 📋 Complete SKU Setup

### Step 1: Create All 6 SKUs in ShopWorks

| SKU | Description | Sizes Tracked | Field Used | Notes |
|-----|-------------|---------------|------------|-------|
| PC61 | Port & Company Essential Tee | S, M, L, XL | Size01-04 | Base SKU |
| PC61_2X | Port & Company Essential Tee - 2XL | 2XL only | Size05 | Field continuation |
| PC61_3X | Port & Company Essential Tee - 3XL | 3XL only | Size06 | Field continuation |
| PC61_4X | Port & Company Essential Tee - 4XL | 4XL only | Size06 | Reuses Size06 |
| PC61_5X | Port & Company Essential Tee - 5XL | 5XL only | Size06 | Reuses Size06 |
| PC61_6X | Port & Company Essential Tee - 6XL | 6XL only | Size06 | Reuses Size06 |

### Step 2: Configure CATALOG_COLOR for Each SKU

**CRITICAL:** Every SKU must use the exact CATALOG_COLOR that matches ShopWorks inventory.

Example for "Forest Green":
```
Display Name: Forest Green
CATALOG_COLOR: Forest         ← Use this in ShopWorks
```

Each of the 6 SKUs needs the same color configuration:
- PC61 + Forest
- PC61_2X + Forest
- PC61_3X + Forest
- PC61_4X + Forest
- PC61_5X + Forest
- PC61_6X + Forest

---

## 🔄 API Query Pattern for 6-SKU System

### Fetching Complete Inventory

```javascript
async function getPC61Inventory(catalogColor) {
    // Query all 6 SKUs in parallel
    const [base, twoXL, threeXL, fourXL, fiveXL, sixXL] = await Promise.all([
        fetch(`/api/manageorders/inventorylevels?PartNumber=PC61&Color=${catalogColor}`),
        fetch(`/api/manageorders/inventorylevels?PartNumber=PC61_2X&Color=${catalogColor}`),
        fetch(`/api/manageorders/inventorylevels?PartNumber=PC61_3X&Color=${catalogColor}`),
        fetch(`/api/manageorders/inventorylevels?PartNumber=PC61_4X&Color=${catalogColor}`),
        fetch(`/api/manageorders/inventorylevels?PartNumber=PC61_5X&Color=${catalogColor}`),
        fetch(`/api/manageorders/inventorylevels?PartNumber=PC61_6X&Color=${catalogColor}`)
    ]);

    // Parse responses
    const inventory = {
        'S': base.Size01_OnHand || 0,
        'M': base.Size02_OnHand || 0,
        'L': base.Size03_OnHand || 0,
        'XL': base.Size04_OnHand || 0,
        '2XL': twoXL.Size05_OnHand || 0,
        '3XL': threeXL.Size06_OnHand || 0,
        '4XL': fourXL.Size06_OnHand || 0,  // Also Size06
        '5XL': fiveXL.Size06_OnHand || 0,  // Also Size06
        '6XL': sixXL.Size06_OnHand || 0   // Also Size06
    };

    return inventory;
}
```

### Understanding the Size06 Reuse

```javascript
// Each SKU is a SEPARATE record in ShopWorks
// PC61_3X record:
{
    PartNumber: "PC61_3X",
    Color: "Forest",
    Size06_OnHand: 15,     // This represents 3XL quantity
    // Other size fields empty
}

// PC61_4X record (different record, same field):
{
    PartNumber: "PC61_4X",
    Color: "Forest",
    Size06_OnHand: 12,     // This represents 4XL quantity
    // Other size fields empty
}

// PC61_5X record (different record, same field):
{
    PartNumber: "PC61_5X",
    Color: "Forest",
    Size06_OnHand: 8,      // This represents 5XL quantity
    // Other size fields empty
}
```

---

## 📦 Order Submission Pattern

### Transform for ManageOrders API

When submitting orders to ManageOrders/ShopWorks, use the base part number only:

```javascript
function createPC61LineItem(size, quantity, catalogColor) {
    // ALWAYS use base part number (no suffix)
    const partNumber = "PC61";  // Never "PC61_2X" or "PC61_4X"

    return {
        partNumber: partNumber,
        color: catalogColor,    // e.g., "Forest" not "Forest Green"
        size: size,             // e.g., "4XL" - separate field
        quantity: quantity,
        description: "Port & Company Essential Tee"
    };
}

// Example: Order with multiple sizes
const lineItems = [
    createPC61LineItem("M", 10, "Forest"),
    createPC61LineItem("L", 15, "Forest"),
    createPC61LineItem("XL", 12, "Forest"),
    createPC61LineItem("2XL", 8, "Forest"),
    createPC61LineItem("3XL", 5, "Forest"),
    createPC61LineItem("4XL", 3, "Forest"),
    createPC61LineItem("5XL", 2, "Forest"),
    createPC61LineItem("6XL", 1, "Forest")
];
```

---

## 💡 Implementation in Production Code

### From sample-order-service.js

```javascript
expandSampleIntoLineItems(sample) {
    const lineItems = [];
    const basePartNumber = sample.style.split('_')[0]; // PC61 from PC61_4X

    Object.entries(sample.sizes).forEach(([size, qty]) => {
        if (qty > 0) {
            const upcharge = sample.upcharges?.[size] || 0;
            const basePrice = sample.price || 10.00;

            lineItems.push({
                partNumber: basePartNumber,    // Always "PC61"
                description: sample.name,
                color: sample.catalogColor,    // CATALOG_COLOR format
                size: size,                    // Size as separate field
                quantity: parseInt(qty),
                price: basePrice + upcharge,
                notes: this.getNotes(sample)
            });
        }
    });

    return lineItems;
}
```

### From Best Sellers Code

```javascript
// Fetching product with CATALOG_COLOR
const fetchProductColors = async (styleNumber) => {
    const response = await fetch(`/api/color-swatches?styleNumber=${styleNumber}`);
    const swatches = await response.json();

    return swatches.map(swatch => ({
        name: swatch.COLOR_NAME,           // "Forest Green" - display
        catalogColor: swatch.CATALOG_COLOR, // "Forest" - ShopWorks
        imageUrl: swatch.COLOR_SWATCH_IMAGE,
        hex: swatch.COLOR_HEX_CODE
    }));
};
```

---

## 🎯 Complete Setup Checklist

### In ShopWorks OnSite

- [ ] Create PC61 (base SKU) with Size01-04 fields
- [ ] Create PC61_2X with Size05 field
- [ ] Create PC61_3X with Size06 field
- [ ] Create PC61_4X with Size06 field (reuse)
- [ ] Create PC61_5X with Size06 field (reuse)
- [ ] Create PC61_6X with Size06 field (reuse)
- [ ] Configure all colors using CATALOG_COLOR format
- [ ] Set up pricing for each SKU (including upcharges)
- [ ] Verify inventory imports correctly

### In Web Application

- [ ] Store both COLOR_NAME and CATALOG_COLOR
- [ ] Use CATALOG_COLOR for all API queries
- [ ] Query all 6 SKUs for complete inventory
- [ ] Use base part number (PC61) for orders
- [ ] Include size as separate field
- [ ] Apply upcharges based on size

### Testing

- [ ] Test inventory query for all 6 SKUs
- [ ] Verify Size06 shows correct quantity for 3XL, 4XL, 5XL, 6XL
- [ ] Test order submission with extended sizes
- [ ] Verify orders import correctly into ShopWorks
- [ ] Check inventory decrements properly

---

## ⚠️ Common Pitfalls

### 1. Using Wrong Color Format
❌ **Wrong:**
```javascript
fetch(`/api/manageorders/inventorylevels?PartNumber=PC61&Color=Forest Green`)
```

✅ **Correct:**
```javascript
fetch(`/api/manageorders/inventorylevels?PartNumber=PC61&Color=Forest`)
```

### 2. Including SKU Suffix in Orders
❌ **Wrong:**
```javascript
{ partNumber: "PC61_4X", size: "4XL" }  // Don't use suffix
```

✅ **Correct:**
```javascript
{ partNumber: "PC61", size: "4XL" }     // Base part only
```

### 3. Misunderstanding Size06 Field
❌ **Wrong Assumption:**
"PC61_4X, PC61_5X, PC61_6X don't track inventory"

✅ **Correct Understanding:**
Each SKU is a separate record that happens to use Size06 field position

### 4. Not Querying All SKUs
❌ **Wrong:**
```javascript
// Only querying first 3 SKUs
const inventory = await getInventory(['PC61', 'PC61_2X', 'PC61_3X']);
```

✅ **Correct:**
```javascript
// Query all 6 SKUs for complete inventory
const inventory = await getInventory(['PC61', 'PC61_2X', 'PC61_3X', 'PC61_4X', 'PC61_5X', 'PC61_6X']);
```

---

## 📊 Size Mapping Reference

| Display Size | SKU | Field | Query Pattern |
|-------------|-----|-------|---------------|
| Small | PC61 | Size01_OnHand | base.Size01_OnHand |
| Medium | PC61 | Size02_OnHand | base.Size02_OnHand |
| Large | PC61 | Size03_OnHand | base.Size03_OnHand |
| X-Large | PC61 | Size04_OnHand | base.Size04_OnHand |
| 2X-Large | PC61_2X | Size05_OnHand | twoXL.Size05_OnHand |
| 3X-Large | PC61_3X | Size06_OnHand | threeXL.Size06_OnHand |
| 4X-Large | PC61_4X | Size06_OnHand | fourXL.Size06_OnHand |
| 5X-Large | PC61_5X | Size06_OnHand | fiveXL.Size06_OnHand |
| 6X-Large | PC61_6X | Size06_OnHand | sixXL.Size06_OnHand |

---

## 🔍 Verification SQL Queries

To verify setup in ShopWorks database:

```sql
-- Check all PC61 SKUs exist
SELECT PartNumber, Description
FROM Products
WHERE PartNumber LIKE 'PC61%'
ORDER BY PartNumber;

-- Verify Size06 field usage
SELECT
    PartNumber,
    Color,
    Size06_OnHand,
    Size06_Label
FROM Inventory
WHERE PartNumber IN ('PC61_3X', 'PC61_4X', 'PC61_5X', 'PC61_6X')
AND Color = 'Forest';

-- Check inventory levels
SELECT
    PartNumber,
    Color,
    Size01_OnHand, Size02_OnHand, Size03_OnHand,
    Size04_OnHand, Size05_OnHand, Size06_OnHand
FROM Inventory
WHERE PartNumber LIKE 'PC61%'
AND Color = 'Forest';
```

---

## 📝 Summary

The PC61 6-SKU pattern with Size06 field reuse is a clever solution to ShopWorks' field limitations:

1. **Each SKU is a separate inventory record** in ShopWorks
2. **PC61_3X through PC61_6X all use Size06** but in different records
3. **CATALOG_COLOR is critical** for all inventory operations
4. **Orders use base part number only** (PC61) with size as separate field
5. **API queries must check all 6 SKUs** for complete inventory picture

This pattern allows tracking of products with up to 6XL (or beyond) while working within ShopWorks' Size01-06 field structure.

---

**Related Documentation:**
- [PRODUCT_SKU_PATTERNS.md](PRODUCT_SKU_PATTERNS.md) - General SKU pattern reference
- [SANMAR_TO_SHOPWORKS_GUIDE.md](SANMAR_TO_SHOPWORKS_GUIDE.md) - Complete transformation guide
- [3-day-tees-inventory-summary.md](../tests/3-day-tees-inventory-summary.md) - Working Multi-SKU example

**Last Updated:** 2025-11-09
**Version:** 1.0.0