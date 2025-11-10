# Sanmar to ShopWorks Product Transformation Guide

**Last Updated:** 2025-11-09
**Purpose:** Complete reference for transforming Sanmar products for ShopWorks/ManageOrders inventory
**Status:** Production-ready based on PC54 and PC90H implementations

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Two SKU Patterns](#two-sku-patterns)
3. [Color Transformation (CRITICAL)](#color-transformation)
4. [Size Field Mapping](#size-field-mapping)
5. [Product Pattern Matrix](#product-pattern-matrix)
6. [Setup Workflow](#setup-workflow)
7. [API Verification](#api-verification)
8. [Order Submission Rules](#order-submission-rules)
9. [Common Pitfalls](#common-pitfalls)
10. [Quick Reference](#quick-reference)

---

## 🎯 Overview {#overview}

### The Challenge

Sanmar products must be correctly transformed for ShopWorks/ManageOrders inventory system. This involves:
1. **SKU Pattern Decision** - Single-SKU vs Multi-SKU architecture
2. **Color Format Transformation** - COLOR_NAME → CATALOG_COLOR
3. **Size Field Mapping** - Correct Size01-07 assignments
4. **Part Number Format** - Base SKU vs extended SKU suffixes

### Key Systems

**Data Flow:**
```
Sanmar Catalog → ShopWorks Setup → ManageOrders API → Website/Orders
     ↓               ↓                    ↓                ↓
  Product Info    Inventory Entry    API Queries    Customer Orders
```

---

## 🔀 Two SKU Patterns {#two-sku-patterns}

### Pattern A: Multi-SKU (T-Shirts, Polos)

**Example: PC54 (Port & Company Core Cotton Tee)**

```
PC54 (Base SKU)
├── Sizes: S, M, L, XL
├── Fields: Size01, Size02, Size03, Size04
└── Standard pricing

PC54_2X (Extended SKU)
├── Size: 2XL only
├── Field: Size05 (field continuation)
└── Upcharge pricing (+$2.00)

PC54_3X (Extended SKU)
├── Size: 3XL only
├── Field: Size06 (field continuation)
└── Upcharge pricing (+$3.00)

⚠️ **Important:** _2XL vs _XXL Distinction
├── _2X suffix → Size05 (standard multi-SKU products)
└── _XXL suffix → Size06 (primarily ladies'/women's apparel)
    Examples: CS403_XXL, DM104L_XXL
    Despite both representing 2X-Large, they use DIFFERENT fields!
```

### Pattern A-Extended: Multi-SKU with Size06 Reuse (PC61)

**Example: PC61 (Essential Tee) - Goes up to 6XL**

```
PC61 (Base SKU)
├── Sizes: S, M, L, XL
├── Fields: Size01, Size02, Size03, Size04
└── Standard pricing

PC61_2X (Extended SKU)
├── Size: 2XL only
├── Field: Size05 (field continuation)
└── Upcharge pricing (+$2.00)

PC61_3X through PC61_6X (Size06 Field Reuse Pattern)
├── PC61_3X: 3XL → Size06
├── PC61_4X: 4XL → Size06 (REUSES field position)
├── PC61_5X: 5XL → Size06 (REUSES field position)
├── PC61_6X: 6XL → Size06 (REUSES field position)
└── Each is a SEPARATE record, all using Size06
```

**🔄 Critical Size06 Field Reuse Discovery:**
- ShopWorks OnSite only has Size01-06 fields (no Size07-09)
- Multiple SKUs (PC61_3X through PC61_6X) each have separate records
- All these records use Size06 field position for their inventory
- This allows tracking 4XL-6XL despite field limitations

**📘 Complete Implementation Guide:** See [PC61_SHOPWORKS_SETUP_GUIDE.md](PC61_SHOPWORKS_SETUP_GUIDE.md) for:
- Step-by-step setup instructions for all 6 SKUs
- API query patterns for complete inventory
- Field mapping verification
- Common pitfalls and solutions

**Inventory Query Pattern for PC61 (6-SKU System):**
```javascript
// Must query all 6 SKUs in parallel for PC61
const [base, twoXL, threeXL, fourXL, fiveXL, sixXL] = await Promise.all([
    fetch(`/api/manageorders/inventorylevels?PartNumber=PC61&Color=${color}`),
    fetch(`/api/manageorders/inventorylevels?PartNumber=PC61_2X&Color=${color}`),
    fetch(`/api/manageorders/inventorylevels?PartNumber=PC61_3X&Color=${color}`),
    fetch(`/api/manageorders/inventorylevels?PartNumber=PC61_4X&Color=${color}`),
    fetch(`/api/manageorders/inventorylevels?PartNumber=PC61_5X&Color=${color}`),
    fetch(`/api/manageorders/inventorylevels?PartNumber=PC61_6X&Color=${color}`)
]);

// Map to human-readable sizes
const inventory = {
    'S': base.Size01,
    'M': base.Size02,
    'L': base.Size03,
    'XL': base.Size04,
    '2XL': twoXL.Size05,        // Field continuation
    '3XL': threeXL.Size06,      // Field continuation
    '4XL': fourXL.Size06,       // Also Size06 (different record)
    '5XL': fiveXL.Size06,       // Also Size06 (different record)
    '6XL': sixXL.Size06         // Also Size06 (different record)
};
```

### Pattern B: Single-SKU (Hoodies, Sweatshirts)

**Example: PC90H (Port & Company Essential Fleece Pullover Hoodie)**

```
PC90H (Single SKU for ALL sizes)
├── Sizes: S, M, L, XL, 2XL, 3XL, 4XL
├── Fields: Size01-07 (all in one record)
└── Size-based upcharge pricing
```

**Simple Field Mapping:**
| Size | Field | Typical Upcharge |
|------|-------|-----------------|
| S | Size01 | Base price |
| M | Size02 | Base price |
| L | Size03 | Base price |
| XL | Size04 | Base price |
| 2XL | Size05 | +$2.00 |
| 3XL | Size06 | +$3.00 |
| 4XL | Size07 | +$4.00 |

**Inventory Query Pattern:**
```javascript
// Single query gets all sizes
const response = await fetch(
    `/api/manageorders/inventorylevels?PartNumber=PC90H&Color=${color}`
);

// Direct mapping
const inventory = {
    'S': response.Size01,
    'M': response.Size02,
    'L': response.Size03,
    'XL': response.Size04,
    '2XL': response.Size05,
    '3XL': response.Size06,
    '4XL': response.Size07
};
```

---

## 🎨 Color Transformation (CRITICAL) {#color-transformation}

### Two-Field System

**Every Sanmar product has TWO color fields:**

| Field | Purpose | Example | Used For |
|-------|---------|---------|----------|
| **COLOR_NAME** | Customer Display | "Safety Green" | Website UI, quotes, emails |
| **CATALOG_COLOR** | System/API | "Safety Green" or "SafetyGrn" | ShopWorks entry, API queries |

### Common Color Transformations

**⚠️ CRITICAL:** These are REAL examples from Sanmar API - always verify for your specific product!

| Product | COLOR_NAME (Display) | CATALOG_COLOR (System) | Notes |
|---------|---------------------|------------------------|-------|
| **PC54** | Athletic Heather | Ath Heather | Different abbreviation |
| PC54 | Dark Heather Grey | Dk Hthr Grey | Multiple abbreviations |
| PC54 | Kelly Green | Kelly | Shortened version |
| PC54 | Jet Black | Jet Black | No change |
| **PC61** | Forest Green | Forest | Shortened |
| PC61 | Carolina Blue | Car Blue | Abbreviated |
| PC61 | Dark Chocolate | Dk Chocolate | Abbreviated |
| **PC78H** | Heather Sangria | Hthr Sangria | Abbreviated |
| PC78H | Team Purple | Tm Purple | Abbreviated |
| PC78H | Dark Heather Grey | Dk Hthr Grey | Multiple abbreviations |
| **PC90H** | Safety Green | Safety Green | **No change** |
| PC90H | Safety Orange | Safety Orange | **No change** |
| PC90H | Silver | Silver | No change |
| **NKDC1963** | Brilliant Orange | BrillOrng | No spaces |
| NKDC1963 | Cool Grey | CoolGrey | No spaces |
| NKDC1963 | Anthracite | Anthracite | No change |

### Verification Process

```bash
# Get exact CATALOG_COLOR from Sanmar
curl "https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/color-swatches?styleNumber=PC90H"

# Response shows both fields:
{
    "COLOR_NAME": "Safety Green",
    "CATALOG_COLOR": "Safety Green"  # Use this for ShopWorks
}
```

**⚠️ CRITICAL:** Using wrong color format causes:
- ✅ Item saves in ShopWorks (no error shown)
- ❌ API queries return `count:0` (inventory check fails)
- ❌ "Unable to Verify" badges in cart
- ❌ Customer can't complete orders

### Real-World Example: Adding PC78H Heather Sangria

**Step 1: Query Sanmar for exact color format**
```bash
curl "https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/color-swatches?styleNumber=PC78H"
```

**Response shows:**
```json
{
    "COLOR_NAME": "Heather Sangria",    // What customers see
    "CATALOG_COLOR": "Hthr Sangria"      // What ShopWorks needs
}
```

**Step 2: ShopWorks Entry (Multi-SKU pattern)**

❌ **WRONG - Using COLOR_NAME:**
- Part Number: PC78H
- Color: **Heather Sangria** ← Will fail inventory checks!

✅ **CORRECT - Using CATALOG_COLOR:**
- Part Number: PC78H
- Color: **Hthr Sangria** ← Works with ManageOrders API!

Then create _2X and _3X entries:
- Part Number: PC78H_2X
- Color: **Hthr Sangria** ← Same CATALOG_COLOR

- Part Number: PC78H_3X
- Color: **Hthr Sangria** ← Same CATALOG_COLOR

---

## 📏 Size Field Mapping {#size-field-mapping}

### Multi-SKU Products (PC54 Pattern)

**⚠️ CRITICAL LIMITATION: ShopWorks OnSite only has Size01-06 fields**
- This means PC54_4X (or any _4X SKU) cannot be tracked
- PC78H max trackable size is 3XL (no PC78H_4X entry possible)
- Products with 4XL must handle it manually outside the system

```
ShopWorks Entry Required:
1. PC54: Enter quantities for S, M, L, XL (Size01-04)
2. PC54_2X: Enter quantity for 2XL (Size05 conceptually, Size01 in record)
3. PC54_3X: Enter quantity for 3XL (Size06 conceptually, Size01 in record)
```

**Field Mapping Table:**

| Human Size | PC54 Field | PC54_2X Field | PC54_3X Field |
|------------|------------|---------------|---------------|
| S | Size01 | - | - |
| M | Size02 | - | - |
| L | Size03 | - | - |
| XL | Size04 | - | - |
| 2XL | - | Size05* | - |
| 3XL | - | - | Size06* |

*Note: These are continuation fields, not restart at Size01

### Single-SKU Products (PC90H Pattern)

```
ShopWorks Entry Required:
1. PC90H: Enter all quantities in one record (Size01-07)
```

**Field Mapping Table:**

| Human Size | PC90H Field | Available? |
|------------|-------------|------------|
| S | Size01 | ✅ |
| M | Size02 | ✅ |
| L | Size03 | ✅ |
| XL | Size04 | ✅ |
| 2XL | Size05 | ✅ |
| 3XL | Size06 | ✅ |
| 4XL | Size07 | ✅ |
| 5XL | Size08 | ❌ (if exists) |
| 6XL | Size09 | ❌ (if exists) |

---

## 📊 Product Pattern Matrix {#product-pattern-matrix}

### Known Products and Their Patterns

| Style | Product Name | Pattern | Max Size | Notes |
|-------|-------------|---------|----------|-------|
| **PC54** | Core Cotton Tee | Multi-SKU | 3XL | PC54, PC54_2X, PC54_3X |
| **PC61** | Core Blend Tee | Multi-SKU | 3XL | PC61, PC61_2X, PC61_3X |
| **PC90H** | Essential Fleece Hoodie | Single-SKU | 4XL | All sizes in PC90H |
| **PC78H** | Core Fleece Hoodie | Multi-SKU | 3XL* | PC78H, PC78H_2X, PC78H_3X |
| **G500** | Gildan Heavy Cotton | Multi-SKU* | 5XL | *Likely multi |
| **G185** | Gildan Heavy Blend Hood | Single-SKU* | 5XL | *Likely single |

*Unverified but follows category pattern

### Pattern Rules (General Guidelines)

**Multi-SKU Pattern (Typically):**
- T-Shirts
- Polos
- Tank Tops
- Products with simple construction
- **NOTE:** Some hoodies like PC78H use Multi-SKU pattern - always verify!

**Single-SKU Pattern (Typically):**
- Hoodies (but not all - PC78H is Multi-SKU!)
- Sweatshirts
- Jackets
- Products with complex construction

**Why the Difference?**
- Multi-SKU allows separate inventory management for upcharge sizes
- Single-SKU simplifies complex products with many size options

---

## 🔄 Setup Workflow {#setup-workflow}

### Step 1: Identify Product Pattern

```bash
# Check Sanmar inventory structure
curl "https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/sizes-by-style-color?styleNumber=PC90H&color=Safety%20Green"

# If response includes all sizes (S-4XL): Single-SKU
# If response only shows S-XL: Multi-SKU (need to check _2X, _3X)
```

### Step 2: Get CATALOG_COLOR Format

```bash
# Query color swatches
curl "https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/color-swatches?styleNumber=PC90H"

# Find your color and note CATALOG_COLOR field
```

### Step 3: Create ShopWorks Entry

**For Multi-SKU (PC54 example):**
```
1. Create PC54
   - Color: "Athletic Hthr" (CATALOG_COLOR)
   - Size01-04: Enter S-XL quantities

2. Create PC54_2X
   - Color: "Athletic Hthr" (same CATALOG_COLOR)
   - Size05: Enter 2XL quantity

3. Create PC54_3X
   - Color: "Athletic Hthr" (same CATALOG_COLOR)
   - Size06: Enter 3XL quantity
```

**For Single-SKU (PC90H example):**
```
1. Create PC90H
   - Color: "Safety Green" (CATALOG_COLOR)
   - Size01-07: Enter all size quantities
```

### Step 4: Verify API Access

```bash
# Test ManageOrders query
curl "https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/manageorders/inventorylevels?PartNumber=PC90H&Color=Safety%20Green"

# Should return your entered quantities
```

---

## 🧪 API Verification {#api-verification}

### Test Commands

**Multi-SKU Product Test:**
```bash
# Test all three SKUs
curl "https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/manageorders/inventorylevels?PartNumber=PC54&Color=Athletic%20Hthr"
curl "https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/manageorders/inventorylevels?PartNumber=PC54_2X&Color=Athletic%20Hthr"
curl "https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/manageorders/inventorylevels?PartNumber=PC54_3X&Color=Athletic%20Hthr"
```

**Single-SKU Product Test:**
```bash
# Single query gets all sizes
curl "https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/manageorders/inventorylevels?PartNumber=PC90H&Color=Safety%20Green"
```

### Expected Responses

**Multi-SKU (PC54):**
```json
// PC54 response
{
  "result": [{
    "PartNumber": "PC54",
    "Color": "Athletic Hthr",
    "Size01": 10,  // S
    "Size02": 20,  // M
    "Size03": 20,  // L
    "Size04": 10   // XL
  }],
  "count": 1
}

// PC54_2X response
{
  "result": [{
    "PartNumber": "PC54_2X",
    "Color": "Athletic Hthr",
    "Size05": 5    // 2XL
  }],
  "count": 1
}
```

**Single-SKU (PC90H):**
```json
{
  "result": [{
    "PartNumber": "PC90H",
    "Color": "Safety Green",
    "Size01": 10,  // S
    "Size02": 20,  // M
    "Size03": 30,  // L
    "Size04": 25,  // XL
    "Size05": 15,  // 2XL
    "Size06": 10,  // 3XL
    "Size07": 5    // 4XL
  }],
  "count": 1
}
```

---

## 🔧 ManageOrders/ShopWorks Transformation Patterns {#transformation-patterns}

### Based on Production Code Analysis (Best Sellers & Sample Order Service)

**Key Discovery:** The system uses specific transformation patterns to ensure ShopWorks compatibility:

### Pattern 1: CATALOG_COLOR is Fetched and Stored

```javascript
// From top-sellers-showcase.html
// System fetches CATALOG_COLOR from Sanmar API
const swatches = await fetch(`/api/color-swatches?styleNumber=${style}`);
const colors = swatches.map(swatch => ({
    name: swatch.COLOR_NAME,           // Display name for UI
    catalogColor: swatch.CATALOG_COLOR, // ShopWorks internal name (CRITICAL!)
    swatchUrl: swatch.COLOR_SQUARE_IMAGE
}));

// When adding to cart, BOTH fields are stored
const cartItem = {
    color: product.COLOR_NAME,        // "Brilliant Orange" - for display
    catalogColor: product.CATALOG_COLOR, // "BrillOrng" - for ShopWorks API
    // ... other fields
};
```

### Pattern 2: Line Item Expansion with Size Separation

```javascript
// From sample-order-service.js
// Each size becomes a SEPARATE line item
expandSampleIntoLineItems(sample) {
    const lineItems = [];

    Object.entries(sample.sizes).forEach(([size, qty]) => {
        if (!qty || qty === 0) return;

        const lineItem = {
            partNumber: basePartNumber,      // Just "PC54" - NO suffix
            color: sample.catalogColor,      // "BrillOrng" - CATALOG_COLOR
            size: size,                      // "2XL" - separate field
            quantity: parseInt(qty),
            price: basePrice + upcharges[size] // Size-specific pricing
        };

        lineItems.push(lineItem);
    });

    return lineItems;
}
```

**Critical Points:**
- Part number NEVER includes size suffix (no PC54_2X)
- Size is a SEPARATE field in the order
- ShopWorks handles internal routing to correct SKU

### Pattern 3: OSFA (One Size Fits All) Handling

```javascript
// From cap-embroidery-pricing-service.js
// Caps and accessories use "OSFA" as size value
const defaultSizes = [
    { size: 'OSFA', price: manualCost, sortOrder: 1 }
];

// In orders, OSFA is just another size value
const lineItem = {
    partNumber: 'C112',    // Port Authority Trucker Cap
    color: 'Flame Red/Blk', // CATALOG_COLOR format
    size: 'OSFA',          // One Size Fits All
    quantity: 1
};
```

### Pattern 4: Size Upcharge Application

```javascript
// From sample-order-service.js
// Size upcharges are applied at line item level
const upcharges = sample.upcharges || {}; // {'2XL': 2.00, '3XL': 3.00}

Object.entries(sample.sizes).forEach(([size, qty]) => {
    const upcharge = parseFloat(upcharges[size] || 0);
    const sizePrice = parseFloat(sample.price) + upcharge;

    const lineItem = {
        partNumber: basePartNumber,
        color: sample.catalogColor,
        size: size,
        quantity: qty,
        price: sizePrice  // Base + size-specific upcharge
    };
});
```

### Complete Transformation Flow

```
1. Fetch Product Data
   ├── Get COLOR_NAME and CATALOG_COLOR from Sanmar API
   ├── Store both in product object
   └── Display COLOR_NAME to users

2. Add to Cart
   ├── Store CATALOG_COLOR for ShopWorks compatibility
   ├── Track size distribution (e.g., {S:2, M:3, L:1})
   └── Include size upcharges

3. Submit Order
   ├── Expand into line items (one per size)
   ├── Use base part number only (PC54, not PC54_2X)
   ├── Include CATALOG_COLOR (not COLOR_NAME)
   └── Apply size-specific pricing

4. ShopWorks Processing
   ├── Receives base part number + size
   ├── Routes to correct internal SKU (PC54_2X if size="2XL")
   └── Decrements inventory from correct location
```

## 📦 Order Submission Rules {#order-submission-rules}

### Critical Rule: Always Use BASE Part Number

**✅ CORRECT:**
```javascript
const lineItem = {
    partNumber: "PC54",        // BASE SKU only
    color: "Athletic Hthr",    // CATALOG_COLOR
    size: "2XL",              // ShopWorks routes internally
    quantity: 5
};
```

**❌ WRONG:**
```javascript
const lineItem = {
    partNumber: "PC54_2X",    // DON'T use suffix
    color: "Athletic Heather", // DON'T use COLOR_NAME
    size: "2XL",
    quantity: 5
};
```

### Why Base Part Number Only?

ShopWorks' internal routing system:
1. Receives order with base part number (PC54)
2. Checks size field value (2XL)
3. Automatically routes to correct SKU (PC54_2X)
4. Decrements inventory from correct location

**This applies to ALL products, both Multi-SKU and Single-SKU patterns**

---

## ⚠️ Common Pitfalls {#common-pitfalls}

### Pitfall 1: Wrong Color Format

**Problem:** Using COLOR_NAME instead of CATALOG_COLOR
```javascript
// ❌ WRONG
color: "Athletic Heather"  // COLOR_NAME

// ✅ CORRECT
color: "Athletic Hthr"     // CATALOG_COLOR
```

**Impact:** Inventory checks fail silently

### Pitfall 2: Using SKU Suffixes in Orders

**Problem:** Including _2X, _3X in part numbers
```javascript
// ❌ WRONG
partNumber: "PC54_2X"

// ✅ CORRECT
partNumber: "PC54"
```

**Impact:** Order routing may fail

### Pitfall 3: Assuming All Products Use Same Pattern

**Problem:** Treating hoodies like t-shirts
```javascript
// ❌ WRONG - Assuming PC90H has PC90H_2X
await fetch(`/api/manageorders/inventorylevels?PartNumber=PC90H_2X&Color=Safety%20Green`)

// ✅ CORRECT - PC90H is single SKU
await fetch(`/api/manageorders/inventorylevels?PartNumber=PC90H&Color=Safety%20Green`)
```

**Impact:** Missing inventory data

### Pitfall 4: Field Mapping Confusion

**Problem:** Misunderstanding Size field continuations
```javascript
// ❌ WRONG - Assuming PC54_2X uses Size01 for 2XL
const twoXL_inventory = pc54_2x_data.Size01;

// ✅ CORRECT - PC54_2X uses Size05 (field continuation)
const twoXL_inventory = pc54_2x_data.Size05;
```

**Impact:** Wrong size inventory displayed

---

## 📋 Quick Reference {#quick-reference}

### Decision Tree

```
Is it a hoodie/sweatshirt?
├── YES → Single-SKU pattern (PC90H style)
│   └── All sizes in one SKU (Size01-07+)
└── NO → Is it a t-shirt/polo?
    └── YES → Multi-SKU pattern (PC54 style)
        └── Base + _2X + _3X SKUs
```

### Checklist for New Product

- [ ] Query Sanmar API for product structure
- [ ] Identify SKU pattern (Single vs Multi)
- [ ] Get CATALOG_COLOR format from color swatches API
- [ ] Create ShopWorks entries with correct part numbers
- [ ] Use CATALOG_COLOR (not COLOR_NAME)
- [ ] Map sizes to correct fields
- [ ] Test with ManageOrders API query
- [ ] Verify inventory returns correctly
- [ ] Document pattern for future reference

### API Endpoints Reference

```bash
# Get product colors with both formats
/api/color-swatches?styleNumber={STYLE}

# Check Sanmar inventory structure
/api/sizes-by-style-color?styleNumber={STYLE}&color={COLOR}

# Query ManageOrders inventory
/api/manageorders/inventorylevels?PartNumber={PART}&Color={CATALOG_COLOR}
```

### Common Products Quick Reference

| Product | Type | Pattern | SKUs Needed |
|---------|------|---------|-------------|
| PC54 | T-Shirt | Multi | PC54, PC54_2X, PC54_3X |
| PC61 | T-Shirt | Multi | PC61, PC61_2X, PC61_3X |
| PC90H | Hoodie | Single | PC90H only |
| PC78H | Hoodie | Multi | PC78H, PC78H_2X, PC78H_3X |
| G500 | T-Shirt | Multi* | G500, G500_2X, G500_3X |
| G185 | Hoodie | Single* | G185 only |

*Assumed based on product category

---

**Documentation Type:** Transformation Guide
**Related:** CLAUDE.md, INDEX.md, PRODUCT_SKU_PATTERNS.md
**Last Updated:** 2025-11-09