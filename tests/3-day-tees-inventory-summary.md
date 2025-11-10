# 3-Day Tees Multi-SKU Inventory Implementation Summary

## Overview
Successfully switched the 3-Day Tees page from Sanmar vendor inventory (showing 25,000+ units) to ManageOrders local warehouse inventory (showing realistic 10-140 units per color).

## Key Implementation Details

### Multi-SKU Pattern
PC54 products are stored across 3 different SKUs in ManageOrders:
- **PC54**: Standard sizes (S, M, L, XL)
- **PC54_2X**: 2XL size only
- **PC54_3X**: 3XL size only

### Field Mapping Discovery
Critical finding - the field mapping is NOT sequential:
- **PC54**: Size01=S, Size02=M, Size03=L, Size04=XL
- **PC54_2X**: Size05=2XL (NOT Size01!)
- **PC54_3X**: Size06=3XL (NOT Size01!)

### API Queries
All three SKUs must be queried in parallel for each color:
```javascript
const [standardRes, twoXLRes, threeXLRes] = await Promise.all([
    fetch(`/api/manageorders/inventorylevels?PartNumber=PC54&Color=${color}`),
    fetch(`/api/manageorders/inventorylevels?PartNumber=PC54_2X&Color=${color}`),
    fetch(`/api/manageorders/inventorylevels?PartNumber=PC54_3X&Color=${color}`)
]);
```

### Color Naming Architecture (Critical for API Integration)

**Sanmar provides TWO separate color fields:**

1. **COLOR_NAME** (Full Display Format)
   - Purpose: Customer-facing display on website
   - Format: Full, professional spelling with proper spacing
   - Examples: "Athletic Heather", "Dark Heather Grey", "Brilliant Orange"
   - Where to use: Website color badges, product displays, customer quotes

2. **CATALOG_COLOR** (Internal System Format)
   - Purpose: Database queries and API communication
   - Format: Abbreviated, condensed format (no extra words)
   - Examples: "Ath Heather", "Dk Hthr Grey", "BrillOrng"
   - Where to use: ShopWorks inventory entries, ManageOrders API queries

**Critical Implementation Pattern:**

```javascript
// In colors array:
{
    name: 'Athletic Heather',        // COLOR_NAME - shown to users
    catalogColor: 'Ath Heather',     // CATALOG_COLOR - used in API calls
    hex: '#9ca3af'
}

// In API calls:
fetch(`/api/manageorders/inventorylevels?PartNumber=PC54&Color=${catalogColor}`)
// Uses catalogColor field (abbreviated format)
```

**Why This Matters:**
- ManageOrders API **ONLY accepts CATALOG_COLOR format**
- Testing proved: "Athletic Heather" returns empty (`count:0`)
- Testing proved: "Ath Heather" returns correct data (`count:1`)
- Page must display COLOR_NAME to users while using CATALOG_COLOR for API queries

**Workflow for Adding New Colors:**

1. Query Sanmar API: `/api/color-swatches?styleNumber=PC54`
2. Extract both fields from response:
   ```json
   {
     "COLOR_NAME": "Dark Heather Grey",
     "CATALOG_COLOR": "Dk Hthr Grey"
   }
   ```
3. Add to ShopWorks inventory using **CATALOG_COLOR** format
4. Add to website colors array:
   ```javascript
   {
       name: 'Dark Heather Grey',     // Display to users
       catalogColor: 'Dk Hthr Grey',  // API queries
       hex: '#6b7280'
   }
   ```

## Verified Inventory Levels

### Jet Black
- S: 4 units
- M: 10 units
- L: 11 units
- XL: 79 units
- 2XL: 27 units
- 3XL: 6 units
- **Total: 137 units**

### White
- Standard sizes (S-XL): 140 units
- 2XL: 3 units
- 3XL: 1 unit
- **Total: 144 units**

### Navy
- Total: ~28 units (Low Stock)

### Athletic Heather
- Total: ~32 units (Low Stock)

### Dark Heather Grey
- Total: ~32 units (Low Stock)

## Files Modified

1. **pages/3-day-tees.html**
   - Updated `colors` array (lines 983-989) - Changed to use full display names (COLOR_NAME format)
   - Removed `colorMapping` object from `loadInventory()` function (lines 1107-1116) - Now uses catalogColor directly
   - Removed `colorMapping` object from `loadSizeInventory()` function (lines 1170-1179) - Now uses catalogColor directly
   - `loadInventory()` function - Queries all 3 SKUs using CATALOG_COLOR format, sums total inventory
   - `loadSizeInventory()` function - Shows size-specific inventory with correct field mapping

2. **tests/test-3day-multisku.js**
   - Comprehensive test script for multi-SKU implementation
   - Tests all colors and verifies field mappings
   - Updated to reflect current color naming architecture

3. **tests/3-day-tees-inventory-summary.md** (this file)
   - Added "Color Naming Architecture" section
   - Documented CATALOG_COLOR vs COLOR_NAME difference
   - Added workflow for adding new colors/products

## Testing Instructions

1. Open the 3-Day Tees page
2. Check that color badges show realistic totals (10-140 range)
3. Select a color and verify size-specific inventory displays
4. Verify 2XL and 3XL show actual inventory (not 0)
5. Run test script in browser console:
   ```javascript
   testMultiSKU.runTest()  // Test all colors
   testMultiSKU.testColor("Jet Black")  // Test specific color
   testMultiSKU.checkPage()  // Check current page display
   ```

## Problem Solved

✅ **Before**: Page showed vendor inventory (25,000+ units) from Sanmar API
✅ **After**: Page shows local warehouse inventory (10-140 units) from ManageOrders API
✅ **2XL/3XL**: Now properly showing inventory from PC54_2X and PC54_3X SKUs

## Notes

- The field mapping (Size05 for 2XL, Size06 for 3XL) is specific to how ShopWorks OnSite stores multi-SKU products
- This pattern may apply to other products that have size variants stored as separate SKUs
- Inventory updates in real-time from the ManageOrders system

## Commits

1. Initial switch from Sanmar to ManageOrders API
2. Added multi-SKU support (PC54, PC54_2X, PC54_3X)
3. Fixed field mapping (Size05 for 2XL, Size06 for 3XL)

This completes the inventory integration for the 3-Day Tees rush service page.