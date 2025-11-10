# Sanmar to ShopWorks Import Guide

**Last Updated:** 2025-11-09
**Purpose:** Get ShopWorks-ready product data from Sanmar using the import-format API
**Status:** Production-ready

---

## 🎯 Overview

### The Simple Way to Import Sanmar Products

Use the `/import-format` endpoint to get **ShopWorks-ready JSON** for any Sanmar product. No manual transformation needed.

**Key Benefits:**
- ✅ Returns only exact style matches (PC850 returns 5 SKUs, not 22)
- ✅ Size fields pre-mapped (Size01-Size06 already assigned)
- ✅ Current CASE_PRICE from Sanmar_Bulk table
- ✅ Handles all extended sizes (5XL, 6XL, LT, XLT, etc.)
- ✅ Sorted by price (lowest to highest)
- ✅ One API call gets everything you need

---

## 📡 The Main Endpoint

```
GET /api/sanmar-shopworks/import-format
```

**Production URL:**
```
https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/sanmar-shopworks/import-format
```

**Required Parameters:**
- `styleNumber` - Sanmar style (e.g., PC850, PC61, J790)
- `color` - Color name (e.g., Cardinal, Navy, Black)

**Example:**
```
https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/sanmar-shopworks/import-format?styleNumber=PC850&color=Cardinal
```

---

## 📊 Response Format

An array of SKU entries with complete size/price data:

```json
[
  {
    "ID_Product": "PC850_XS",
    "CATALOG_COLOR": "Team Cardinal",
    "COLOR_NAME": "Team Cardinal",
    "Description": "Port & Co Fan Favorite Fleece Crewneck Sweatshirt",
    "Brand": "Port & Company",
    "CASE_PRICE": 10.51,
    "Size01": null,
    "Size02": null,
    "Size03": null,
    "Size04": null,
    "Size05": null,
    "Size06": "XS"
  },
  {
    "ID_Product": "PC850",
    "CATALOG_COLOR": "Team Cardinal",
    "COLOR_NAME": "Team Cardinal",
    "Description": "Port & Co Fan Favorite Fleece Crewneck Sweatshirt",
    "Brand": "Port & Company",
    "CASE_PRICE": 10.51,
    "Size01": "S",
    "Size02": "M",
    "Size03": "L",
    "Size04": "XL",
    "Size05": null,
    "Size06": null
  },
  {
    "ID_Product": "PC850_2XL",
    "CATALOG_COLOR": "Team Cardinal",
    "COLOR_NAME": "Team Cardinal",
    "Description": "Port & Co Fan Favorite Fleece Crewneck Sweatshirt",
    "Brand": "Port & Company",
    "CASE_PRICE": 12.51,
    "Size01": null,
    "Size02": null,
    "Size03": null,
    "Size04": null,
    "Size05": "2XL",
    "Size06": null
  }
]
```

---

## 🔑 Understanding the Response

### Size Field Mapping

ShopWorks uses 6 size fields. Each SKU enables only the sizes it handles:

| Size Field | Standard Mapping | Notes |
|------------|------------------|-------|
| **Size01** | S (Small) | Base SKUs only |
| **Size02** | M (Medium) | Base SKUs only |
| **Size03** | L (Large) | Base SKUs only |
| **Size04** | XL (Extra Large) | Base SKUs only |
| **Size05** | 2XL (2X Large) | Extended SKUs only |
| **Size06** | XS/3XL/4XL/5XL/6XL/LT/XLT | Catch-all for extended sizes |

**Important:**
- `null` = This size field is DISABLED for this SKU
- `"S"`, `"M"`, `"L"`, etc. = This size field is ENABLED

### Color Fields

- **CATALOG_COLOR** ← **USE THIS for ShopWorks imports**
- **COLOR_NAME** ← Display name (usually same as CATALOG_COLOR)

ShopWorks expects `CATALOG_COLOR` for proper color matching.

### Pricing

- **CASE_PRICE** ← Current Sanmar case price from Sanmar_Bulk table
- Price is size-specific (PC850_2XL gets 2XL price, PC850 gets S price)

### Size06 Field

- **Catch-all field** for extended sizes
- Handles: XS, 3XL, 4XL, 5XL, 6XL, 7XL, LT, XLT, 2XLT, 3XLT, 4XLT
- Value comes from SKU suffix (PC61_5XL → Size06="5XL")

---

## 💡 Quick Examples

### Example 1: PC850 (Standard Adult Sweatshirt)

```bash
GET /api/sanmar-shopworks/import-format?styleNumber=PC850&color=Cardinal
```

**Returns:** 5 SKUs
- PC850_XS (Size06="XS")
- PC850 (Size01="S", Size02="M", Size03="L", Size04="XL")
- PC850_2XL (Size05="2XL")
- PC850_3XL (Size06="3XL")
- PC850_4XL (Size06="4XL")

### Example 2: PC61 (T-Shirt with Extended Sizes)

```bash
GET /api/sanmar-shopworks/import-format?styleNumber=PC61&color=Dark%20Heather%20Grey
```

**Returns:** 6 SKUs including PC61_5XL and PC61_6XL (all using Size06 for extended sizes)

### Example 3: BC3001Y (Youth Bella+Canvas)

```bash
GET /api/sanmar-shopworks/import-format?styleNumber=BC3001Y&color=Solid%20Athletic%20Grey
```

**Returns:** Youth sizes mapped to ShopWorks size fields

---

## 🚀 Common Use Cases

### Use Case 1: Import Product into ShopWorks

```javascript
const response = await fetch(
  'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/sanmar-shopworks/import-format?styleNumber=PC850&color=Cardinal'
);
const skus = await response.json();

// Process each SKU
skus.forEach(sku => {
  console.log(`Import SKU: ${sku.ID_Product}`);
  console.log(`Color: ${sku.CATALOG_COLOR}`);
  console.log(`Price: $${sku.CASE_PRICE}`);

  // Get enabled sizes
  const enabledSizes = [];
  if (sku.Size01) enabledSizes.push(sku.Size01);
  if (sku.Size02) enabledSizes.push(sku.Size02);
  if (sku.Size03) enabledSizes.push(sku.Size03);
  if (sku.Size04) enabledSizes.push(sku.Size04);
  if (sku.Size05) enabledSizes.push(sku.Size05);
  if (sku.Size06) enabledSizes.push(sku.Size06);

  console.log(`Sizes: ${enabledSizes.join(', ')}`);
});
```

### Use Case 2: Get Pricing for Quote

```javascript
const response = await fetch(
  'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/sanmar-shopworks/import-format?styleNumber=PC54&color=Black'
);
const skus = await response.json();

// Find 2XL pricing
const twoXL = skus.find(sku => sku.Size05 === '2XL');
console.log(`2XL Price: $${twoXL.CASE_PRICE}`);
```

### Use Case 3: Check Available Sizes

```javascript
const response = await fetch(
  'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/sanmar-shopworks/import-format?styleNumber=J790&color=Navy'
);
const skus = await response.json();

const allSizes = new Set();
skus.forEach(sku => {
  if (sku.Size01) allSizes.add(sku.Size01);
  if (sku.Size02) allSizes.add(sku.Size02);
  if (sku.Size03) allSizes.add(sku.Size03);
  if (sku.Size04) allSizes.add(sku.Size04);
  if (sku.Size05) allSizes.add(sku.Size05);
  if (sku.Size06) allSizes.add(sku.Size06);
});

console.log(`Available sizes: ${Array.from(allSizes).join(', ')}`);
```

---

## ⚠️ Important Notes

### 1. Exact Style Matching
- Query `PC850` returns ONLY PC850 and its size variants (PC850_2XL, PC850_3XL, etc.)
- Does NOT return product family (PC850H, PC850Q, PC850YH, etc.)
- Query each style individually: PC850, PC850H, PC850Q are separate requests

### 2. Color Matching
- Color parameter is case-insensitive
- Searches both CATALOG_COLOR and COLOR_NAME
- Partial matches work: "Cardinal" matches "Team Cardinal"

### 3. Data Freshness
- CASE_PRICE comes from Sanmar_Bulk table
- Pricing is current Sanmar pricing (updated from monthly dumps)
- Size field mappings from Shopworks_Integration table

### 4. Sorting
- Results sorted by CASE_PRICE (lowest to highest)
- Helps you see the most affordable SKUs first

### 5. Error Handling
- 400 Bad Request = Missing required parameter (styleNumber or color)
- 404 Not Found = Product or color not found
- 404 includes list of available colors for the style

---

## 🎯 Integration Tips

### For ShopWorks Import
1. Query the endpoint with style + color
2. For each SKU in response:
   - Create product with `ID_Product` as SKU
   - Set color to `CATALOG_COLOR` value
   - Populate Size01-06 fields where value is not null
   - Use `CASE_PRICE` for pricing

### For Pricing Calculators
1. Query once per style + color
2. Cache the response (pricing doesn't change frequently)
3. Look up size-specific pricing from CASE_PRICE field

### For Product Discovery
1. Use other endpoints to get available styles/colors first
2. Then query this endpoint for specific style + color combination
3. This endpoint requires both parameters (no browsing by style only)

---

## 📋 Quick Reference

### Checklist for New Product

- [ ] Get style number from Sanmar catalog
- [ ] Get exact color name (case-insensitive, partial match OK)
- [ ] Query `/import-format` endpoint
- [ ] Review returned SKUs and size mappings
- [ ] Create ShopWorks entries using CATALOG_COLOR
- [ ] Populate Size01-06 fields where not null
- [ ] Use CASE_PRICE for pricing
- [ ] Test with ManageOrders API query
- [ ] Verify inventory returns correctly

### Common Products Quick Reference

| Product | Type | API Call Example |
|---------|------|------------------|
| PC54 | T-Shirt | `/import-format?styleNumber=PC54&color=Black` |
| PC61 | T-Shirt | `/import-format?styleNumber=PC61&color=Forest%20Green` |
| PC90H | Hoodie | `/import-format?styleNumber=PC90H&color=Navy` |
| PC850 | Sweatshirt | `/import-format?styleNumber=PC850&color=Cardinal` |
| G500 | T-Shirt | `/import-format?styleNumber=G500&color=Royal` |
| G185 | Hoodie | `/import-format?styleNumber=G185&color=Black` |

### API Endpoints

```bash
# Main import endpoint
GET /api/sanmar-shopworks/import-format?styleNumber={STYLE}&color={COLOR}

# Verify in ManageOrders after setup
GET /api/manageorders/inventorylevels?PartNumber={SKU}&Color={CATALOG_COLOR}
```

---

## 🔗 Related Documentation

- **Complete API Documentation:** See `caspio-pricing-proxy/memory/SANMAR_SHOPWORKS_API.md` for full technical details
- **Quick Start Guide:** See `caspio-pricing-proxy/memory/SANMAR_SHOPWORKS_QUICKSTART.md` for condensed reference
- **ManageOrders Integration:** See `MANAGEORDERS_INTEGRATION.md` for inventory API usage

---

**Documentation Type:** Import Guide
**Related:** CLAUDE.md, INDEX.md, MANAGEORDERS_INTEGRATION.md
