# ShopWorks EDP - Product Block Field Reference

**File Path:** `memory/edp/PRODUCT_BLOCK.md`
**Purpose:** Complete Product Block field specifications for ShopWorks OnSite 7 EDP integration
**Parent Guide:** [SHOPWORKS_EDP_INTEGRATION.md](../SHOPWORKS_EDP_INTEGRATION.md)

---

## Overview

**Status:** FULLY DOCUMENTED (41 fields in 5 SubBlocks) - CRITICAL FOR PRODUCTION

**🎯 Strategic Importance:** Product Block is the **core production data structure** in ShopWorks EDP. It contains all product details, size distribution, pricing, and production flags needed for accurate fulfillment. This is one of the most complex blocks with 5 distinct SubBlocks.

**OnSite Version:** OnSite 7 (upgraded from OnSite 6.1)

**Total Fields:** 41 fields organized into 5 SubBlocks

**Shared Across:** All quote builders (Screen Print, DTG, Embroidery, Cap)

---

## Product Block Structure (41 Total Fields)

The Product Block uses a 5-SubBlock architecture to organize product specifications, size distribution, pricing, and behavior.

**SubBlock Overview:**
1. **Product SubBlock** (6 fields) - Core product identification and pricing
2. **Size Distribution SubBlock** (6 fields) - Quantity breakdown by size
3. **Sales Tax Override SubBlock** (8 fields) - Tax calculation overrides
4. **Secondary Units SubBlock** (10 fields) - Alternate unit measurements
5. **Behavior SubBlock** (11 fields) - Product sourcing and workflow flags

---

## SubBlock 1: Product (6 fields)

**Purpose:** Core product identification, pricing, and production instructions

| OnSite 7 Field Name | Type | Required | Purpose | Critical Notes |
|---------------------|------|----------|---------|----------------|
| `PartNumber` | String | ✅ Yes | Product style number | From `StyleNumber` field (e.g., "PC61") |
| `PartColorRange` | String | No | Color range identifier | Leave blank for most orders |
| `PartColor` | String | ✅ Yes | **Catalog color name** | ⚠️ **MUST use `CATALOG_COLOR`** (see critical section below) |
| `PartDescription` | String | ✅ Yes | Product full name | From `ProductName` field |
| `cur_UnitPriceUserEntered` | Currency | ✅ Yes | Final per-piece price | ⭐ **NEW in OnSite 7** - From `FinalUnitPrice` |
| `OrderInstructions` | Text | No | Print/embroidery details | ⭐ **NEW in OnSite 7** - Location, colors, stitches |

**Key Highlights:**
- **`cur_UnitPriceUserEntered`** - NEW in OnSite 7, replaces calculated pricing with user-entered quote price
- **`OrderInstructions`** - NEW in OnSite 7, critical for production team (print locations, color counts, stitch counts)
- **`PartColor`** - MUST match ShopWorks catalog exactly (see CATALOG_COLOR section)

---

## SubBlock 2: Size Distribution (6 fields) - ALL REQUIRED

**Purpose:** Quantity breakdown by size column

| OnSite 7 Field Name | OnSite 6.1 Field Name | Purpose | ShopWorks Column Mapping |
|---------------------|----------------------|---------|--------------------------|
| `Size01_Req` | `Size01_Req` | Quantity for column 1 | Small (S) |
| `Size02_Req` | `Size02_Req` | Quantity for column 2 | Medium (M) |
| `Size03_Req` | `Size03_Req` | Quantity for column 3 | Large (LG) |
| `Size04_Req` | `Size04_Req` | Quantity for column 4 | Extra Large (XL) |
| `Size05_Req` | `Size05_Req` | Quantity for column 5 | 2X Large (XXL / 2XL) |
| `Size06_Req` | `Size06_Req` | Quantity for column 6 | 3X+ Large (XXXL+ / 3XL+) |

**Important Size Distribution Rules:**
- **ALL 6 FIELDS REQUIRED** - Even if 0 quantity for some sizes
- **Fixed Column Mapping** - ShopWorks expects specific size order (cannot customize)
- **No Validation** - ShopWorks accepts any quantities (including 0)
- **Sum Must Match Order Qty** - Total should equal Order Block `TotalQty`

**Size Mapping Examples:**
```javascript
// Standard apparel (uses all 6 sizes)
Size01_Req: 12  // S
Size02_Req: 24  // M
Size03_Req: 24  // L
Size04_Req: 12  // XL
Size05_Req: 0   // 2XL (none ordered)
Size06_Req: 0   // 3XL+ (none ordered)

// Youth sizes (map to first 3 columns)
Size01_Req: 10  // YS
Size02_Req: 15  // YM
Size03_Req: 15  // YL
Size04_Req: 0   // (not applicable)
Size05_Req: 0
Size06_Req: 0

// One-size items (use Size03_Req for total)
Size01_Req: 0
Size02_Req: 0
Size03_Req: 50  // Total quantity
Size04_Req: 0
Size05_Req: 0
Size06_Req: 0
```

---

## SubBlock 3: Sales Tax Override (8 fields)

**Purpose:** Tax calculation and product classification overrides

| OnSite 7 Field Name | OnSite 6.1 Field Name | Type | Purpose | Typical Value |
|---------------------|----------------------|------|---------|---------------|
| `sts_Prod_SalesTax_Override` | `sts_Prod_SalesTax_Override` | Boolean | Enable tax override | "No" |
| `sts_EnableTax01` | `sts_EnableTax01` | Boolean | Enable Tax 1 | "No" |
| `sts_EnableTax02` | `sts_EnableTax02` | Boolean | Enable Tax 2 | "No" |
| `sts_EnableTax03` | `sts_EnableTax03` | Boolean | Enable Tax 3 | "No" |
| `sts_EnableTax04` | `sts_EnableTax04` | Boolean | Enable Tax 4 | "No" |
| `sts_EnableCommission` | `sts_EnableCommission` | Boolean | Enable commission | "No" |
| `id_ProductClass` | `id_ProductClass` | Number | Product classification ID | Leave blank |
| `sts_Prod_Product_Override` | *(part of Behavior in 6.1)* | Boolean | General product override | "No" |

**Tax Override Notes:**
- **Quote Mode:** All tax fields typically "No" (quotes don't calculate final tax)
- **Order Mode:** May enable specific tax flags based on customer location
- **Product Classification:** Used for grouping products in ShopWorks reports

---

## SubBlock 4: Secondary Units (10 fields)

**Purpose:** Alternate unit measurements (advanced feature)

| OnSite 7 Field Name | OnSite 6.1 Field Name | Type | Purpose | Typical Value |
|---------------------|----------------------|------|---------|---------------|
| `sts_Prod_SecondaryUnits_Override` | `sts_Prod_SecondaryUnits_Override` | Boolean | Enable units override | "No" |
| `sts_UseSecondaryUnits` | `sts_UseSecondaryUnits` | Boolean | Use secondary units | "No" |
| `Units_Qty` | `Units_Qty` | Number | Quantity per unit | Leave blank |
| `Units_Type` | `Units_Type` | String | Unit type | Leave blank |
| `Units_Area1` | `Units_Area1` | Number | Area dimension 1 | Leave blank |
| `Units_Area2` | `Units_Area2` | Number | Area dimension 2 | Leave blank |
| `Units_UnitsPricing` | `Units_UnitsPricing` | String | Pricing units | Leave blank |
| `Units_UnitsPurchasing` | `Units_UnitsPurchasing` | String | Purchasing units | Leave blank |
| `Units_UnitsPurchasingExtraPercent` | `Units_UnitsPurchasingExtraPercent` | Number | Extra % for purchasing | Leave blank |
| `Units_UnitsPurchasingExtraRound` | `Units_UnitsPurchasingExtraRound` | String | Rounding method | Leave blank |

**Secondary Units Purpose:**
- **Advanced Feature:** Used for products sold in alternate units (e.g., square footage for vinyl)
- **Quote Mode:** Typically not used (leave all fields blank or "No")
- **Future Use:** Available if NWCA expands to products requiring unit conversions

---

## SubBlock 5: Behavior (11 fields)

**Purpose:** Product sourcing and workflow control flags

| OnSite 7 Field Name | OnSite 6.1 Field Name | Type | Purpose | Quote Value |
|---------------------|----------------------|------|---------|-------------|
| `sts_Prod_Behavior_Override` | `sts_Prod_Behavior_Override` | Boolean | Enable behavior override | "No" |
| `sts_ProductSource_Supplied` | `sts_ProductSource_Supplied` | Boolean | Customer-supplied product | "No" |
| `sts_ProductSource_Purchase` | `sts_ProductSource_Purchase` | Boolean | Purchase from vendor | **"Yes"** |
| `sts_ProductSource_Inventory` | `sts_ProductSource_Inventory` | Boolean | Pull from inventory | "No" |
| `sts_Production_Designs` | `sts_Production_Designs` | Boolean | Requires design work | **"Yes"** |
| `sts_Production_Subcontract` | `sts_Production_Subcontract` | Boolean | Subcontract production | "No" |
| `sts_Production_Components` | `sts_Production_Components` | Boolean | Has components | "No" |
| `sts_Storage_Ship` | `sts_Storage_Ship` | Boolean | Ship to customer | **"Yes"** |
| `sts_Storage_Inventory` | `sts_Storage_Inventory` | Boolean | Store in inventory | "No" |
| `sts_Invoicing_Invoice` | `sts_Invoicing_Invoice` | Boolean | Invoice customer | **"Yes"** |
| `cur_UnitCost` | `cur_UnitCost` | Currency | Unit cost (internal) | "0.00" |

**Behavior Field Strategy for Quotes:**

**Standard Quote Settings:**
- `sts_ProductSource_Purchase` = **"Yes"** - Products purchased from vendors (SanMar, AlphaBroder, etc.)
- `sts_Production_Designs` = **"Yes"** - Most orders require design/decoration
- `sts_Storage_Ship` = **"Yes"** - Ship directly to customer
- `sts_Invoicing_Invoice` = **"Yes"** - Generate invoice
- All other behavior flags = **"No"**

**Customer-Supplied Product Variation:**
- `sts_ProductSource_Supplied` = "Yes"
- `sts_ProductSource_Purchase` = "No"
- All other flags same as standard

---

## OnSite 6.1 → OnSite 7 Field Mapping

### Product SubBlock

| OnSite 6.1 Field Name | OnSite 7 Field Name | Migration Notes |
|----------------------|---------------------|-----------------|
| `PartNumber` | `PartNumber` | No change |
| `PartColorRange` | `PartColorRange` | No change |
| `PartColor` | `PartColor` | No change |
| `PartDescription` | `PartDescription` | No change |
| *(Not available)* | `cur_UnitPriceUserEntered` | ⭐ **NEW in OnSite 7** - Replaces calculated pricing |
| *(Not available)* | `OrderInstructions` | ⭐ **NEW in OnSite 7** - Production instructions field |

### Size Distribution

| OnSite 6.1 Field Name | OnSite 7 Field Name | Migration Notes |
|----------------------|---------------------|-----------------|
| `Size01_Req` | `Size01_Req` | No change |
| `Size02_Req` | `Size02_Req` | No change |
| `Size03_Req` | `Size03_Req` | No change |
| `Size04_Req` | `Size04_Req` | No change |
| `Size05_Req` | `Size05_Req` | No change |
| `Size06_Req` | `Size06_Req` | No change |

**Size Mapping Unchanged:** All 6 size fields maintained exact same names and behavior in OnSite 7.

---

## Deprecated Fields (No Longer Used in OnSite 7)

The following fields existed in OnSite 6.1 but are **deprecated in OnSite 7** (do NOT include in EDP):

| Deprecated Field | Status | Replacement |
|------------------|--------|-------------|
| `sts_Lookup` | ❌ Not used anymore | Product lookup handled differently in OnSite 7 |
| `sts_UseCalcPrice` | ❌ Not used anymore | Replaced by `cur_UnitPriceUserEntered` |
| *(Various others from screenshot)* | ❌ No longer used | Removed in OnSite 7 architecture |

**Important:** Do NOT include deprecated fields in your EDP export. ShopWorks OnSite 7 will ignore them.

---

## 🚨 CRITICAL: CATALOG_COLOR Implementation

**⚠️ THE MOST IMPORTANT FIELD IN PRODUCT BLOCK ⚠️**

The `PartColor` field **MUST** use the exact catalog color name from ShopWorks' product database. This is the **primary key** that links your quote to ShopWorks' pricing and inventory systems.

### Why CATALOG_COLOR is Critical

**Problem without CATALOG_COLOR:**
```javascript
// ❌ WRONG - Using display color or customer description
PartColor>> Forest Green         // Display name from vendor
PartColor>> Dark Green          // Customer description
PartColor>> Green (Heather)     // Marketing name
```

**What happens:**
- ✅ Quote imports successfully (no error)
- ❌ ShopWorks shows "Product not found in catalog"
- ❌ Pricing doesn't sync from ShopWorks pricing tables
- ❌ Inventory doesn't decrement properly
- ❌ Production team sees incorrect color
- ❌ Purchasing can't auto-order from vendor

**Solution with CATALOG_COLOR:**
```javascript
// ✅ CORRECT - Using exact ShopWorks catalog name
PartColor>> Forest                // Exact match to ShopWorks PC54 color "Forest"
```

**What happens:**
- ✅ Quote imports successfully
- ✅ ShopWorks finds product in catalog instantly
- ✅ Pricing syncs with vendor cost updates
- ✅ Inventory tracking works correctly
- ✅ Production sees correct Pantone codes
- ✅ Purchasing auto-generates PO with correct vendor codes

---

### How to Implement CATALOG_COLOR in Quote Builders

**Step 1: Add `catalogColor` field to product data structure**

```javascript
// In screenprint-quote-builder.js (or dtg-quote-builder.js, etc.)
const productData = {
    StyleNumber: 'PC54',
    ProductName: 'Port & Company Core Cotton Tee',
    Color: 'Forest Green',              // Display color (for customer)
    ColorCode: 'FG',                     // Vendor color code
    CatalogColor: 'Forest',              // ⭐ ShopWorks catalog color
    Quantity: 48,
    FinalUnitPrice: 11.54
};
```

**Step 2: Populate `catalogColor` during product auto-load**

```javascript
// When fetching product details from API
async function loadProductDetails(styleNumber, colorCode) {
    const response = await fetch(
        `${API_BASE}/api/products/color-details?styleNumber=${styleNumber}&colorCode=${colorCode}`
    );
    const productInfo = await response.json();

    return {
        StyleNumber: styleNumber,
        ProductName: productInfo.productName,
        Color: productInfo.colorName,           // "Forest Green" (display)
        ColorCode: colorCode,                    // "FG"
        CatalogColor: productInfo.catalogColor,  // ⭐ "Forest" (ShopWorks key)
        ImageURL: productInfo.imageUrl
    };
}
```

**Step 3: Use `catalogColor` in EDP Product Block**

```javascript
// In generateEDP() function
edp += `PartColor>> ${product.CatalogColor}\n`;  // ⚠️ Use CatalogColor, NOT Color
```

**Complete Example:**
```javascript
// Product object in quote
{
    StyleNumber: 'PC61',
    ProductName: 'Essential Tee',
    Color: 'Kelly Green',        // Customer-facing display name
    ColorCode: 'KG',
    CatalogColor: 'Kelly',       // ⭐ ShopWorks catalog name
    Quantity: 72
}

// EDP Product Block
edp += `PartNumber>> PC61\n`;
edp += `PartColor>> Kelly\n`;              // ✅ Uses CatalogColor
edp += `PartDescription>> Essential Tee\n`;
```

---

### Catalog Color Mapping Reference

**Common Display Names → Catalog Names:**

| Display Color | Catalog Color (Use This) | Style Examples |
|---------------|-------------------------|----------------|
| Forest Green | Forest | PC54, PC61 |
| Kelly Green | Kelly | PC54, PC61 |
| Navy Blue | Navy | PC54, PC61 |
| Dark Heather Gray | Dark Heather | PC54 |
| Royal Blue | Royal | PC54, PC61 |

**How to Find Catalog Colors:**
1. Check ShopWorks product catalog for exact color names
2. Reference vendor spec sheets (SanMar, AlphaBroder)
3. Test EDP import - ShopWorks will show "unknown color" if wrong

---

### CATALOG_COLOR Verification Checklist

Before deploying EDP integration:

- [ ] `catalogColor` field added to product data structure
- [ ] API endpoint returns `catalogColor` for all products
- [ ] `loadProductDetails()` populates `catalogColor` during auto-load
- [ ] EDP uses `product.CatalogColor` (NOT `product.Color`)
- [ ] Tested EDP import in ShopWorks (no "product not found" errors)
- [ ] Verified pricing syncs correctly after import
- [ ] Tested with multiple color variations

**Common Mistake:**
```javascript
// ❌ WRONG
edp += `PartColor>> ${product.Color}\n`;  // Uses display name

// ✅ CORRECT
edp += `PartColor>> ${product.CatalogColor}\n`;  // Uses catalog name
```

---

## Complete Product Block Implementation Example

```javascript
/**
 * Generate complete Product Block with all 5 SubBlocks
 * For Screen Print Quote Builder
 */
function generateProductBlock(product, quoteData) {
    let edp = '';

    edp += '---- Start Product ----\n';

    // ===== SubBlock 1: Product =====
    edp += `PartNumber>> ${product.StyleNumber}\n`;
    edp += `PartColorRange>> \n`;  // Leave blank
    edp += `PartColor>> ${product.CatalogColor}\n`;  // ⚠️ CRITICAL: Use CatalogColor
    edp += `PartDescription>> ${product.ProductName}\n`;
    edp += `cur_UnitPriceUserEntered>> ${product.FinalUnitPrice.toFixed(2)}\n`;

    // Build OrderInstructions with print details
    const instructions = buildOrderInstructions(product, quoteData);
    edp += `OrderInstructions>> ${instructions}\n`;

    // ===== SubBlock 2: Size Distribution =====
    const sizeBreakdown = product.SizeBreakdown || {};
    edp += `Size01_Req>> ${sizeBreakdown.S || 0}\n`;
    edp += `Size02_Req>> ${sizeBreakdown.M || 0}\n`;
    edp += `Size03_Req>> ${sizeBreakdown.L || 0}\n`;
    edp += `Size04_Req>> ${sizeBreakdown.XL || 0}\n`;
    edp += `Size05_Req>> ${sizeBreakdown['2XL'] || 0}\n`;
    edp += `Size06_Req>> ${sizeBreakdown['3XL'] || sizeBreakdown['3XL+'] || 0}\n`;

    // ===== SubBlock 3: Sales Tax Override =====
    edp += `sts_Prod_SalesTax_Override>> No\n`;
    edp += `sts_EnableTax01>> No\n`;
    edp += `sts_EnableTax02>> No\n`;
    edp += `sts_EnableTax03>> No\n`;
    edp += `sts_EnableTax04>> No\n`;
    edp += `sts_EnableCommission>> No\n`;
    edp += `id_ProductClass>> \n`;  // Leave blank
    edp += `sts_Prod_Product_Override>> No\n`;

    // ===== SubBlock 4: Secondary Units =====
    edp += `sts_Prod_SecondaryUnits_Override>> No\n`;
    edp += `sts_UseSecondaryUnits>> No\n`;
    edp += `Units_Qty>> \n`;
    edp += `Units_Type>> \n`;
    edp += `Units_Area1>> \n`;
    edp += `Units_Area2>> \n`;
    edp += `Units_UnitsPricing>> \n`;
    edp += `Units_UnitsPurchasing>> \n`;
    edp += `Units_UnitsPurchasingExtraPercent>> \n`;
    edp += `Units_UnitsPurchasingExtraRound>> \n`;

    // ===== SubBlock 5: Behavior =====
    edp += `sts_Prod_Behavior_Override>> No\n`;
    edp += `sts_ProductSource_Supplied>> No\n`;
    edp += `sts_ProductSource_Purchase>> Yes\n`;  // Standard: purchase from vendor
    edp += `sts_ProductSource_Inventory>> No\n`;
    edp += `sts_Production_Designs>> Yes\n`;      // Standard: requires decoration
    edp += `sts_Production_Subcontract>> No\n`;
    edp += `sts_Production_Components>> No\n`;
    edp += `sts_Storage_Ship>> Yes\n`;            // Standard: ship to customer
    edp += `sts_Storage_Inventory>> No\n`;
    edp += `sts_Invoicing_Invoice>> Yes\n`;       // Standard: invoice customer
    edp += `cur_UnitCost>> 0.00\n`;               // Quote mode: cost not revealed

    edp += '---- End Product ----\n\n';

    return edp;
}

/**
 * Build OrderInstructions field content
 * Format varies by decoration method
 */
function buildOrderInstructions(product, quoteData) {
    const method = quoteData.DecorationMethod;

    if (method === 'Screen Print') {
        // Include print locations and color counts
        const locations = quoteData.PrintLocations || [];
        const instructions = locations.map(loc =>
            `${loc.Location}: ${loc.Colors} colors${loc.HasFlash ? ' + underbase' : ''}`
        ).join('; ');

        return instructions || 'See design details';

    } else if (method === 'Embroidery') {
        // Include stitch count and thread colors
        return `${product.StitchCount || 0} stitches, ${product.ThreadColors || 0} colors`;

    } else if (method === 'DTG') {
        // Include print location
        return `DTG Print - ${product.PrintLocation || 'Full Front'}`;

    } else {
        return 'See quote details';
    }
}
```

---

## Method-Specific Product Block Patterns

### Screen Print: Multiple Products with Color Variations

**Challenge:** Screen print quotes often have multiple products (different styles or colors) with varying print setups.

**Solution:** Generate separate Product Block for each product + color combination.

```javascript
// Screen Print Quote with 2 products
const products = [
    {
        StyleNumber: 'PC54',
        CatalogColor: 'Black',
        ProductName: 'Essential Tee',
        Quantity: 48,
        FinalUnitPrice: 11.54,
        SizeBreakdown: { S: 12, M: 12, L: 12, XL: 12 }
    },
    {
        StyleNumber: 'PC54',
        CatalogColor: 'Navy',
        ProductName: 'Essential Tee',
        Quantity: 24,
        FinalUnitPrice: 11.54,
        SizeBreakdown: { S: 6, M: 6, L: 6, XL: 6 }
    }
];

// Generate Product Block for each
products.forEach(product => {
    edp += generateProductBlock(product, quoteData);
});
```

**OrderInstructions Example:**
```
Front: 4 colors + underbase; Back: 2 colors
```

---

### Embroidery: Stitch Count and Thread Colors

**Challenge:** Embroidery pricing depends on stitch count, need to communicate to production.

**Solution:** Include stitch details in OrderInstructions.

```javascript
const product = {
    StyleNumber: 'PC61',
    CatalogColor: 'Black',
    ProductName: 'Essential Tee',
    StitchCount: 8500,
    ThreadColors: 4,
    PrintLocation: 'Left Chest',
    Quantity: 48,
    FinalUnitPrice: 9.25
};

// OrderInstructions
edp += `OrderInstructions>> Left Chest - 8,500 stitches, 4 thread colors\n`;
```

---

### DTG: Simplified Product Block

**Challenge:** DTG has fewer variables (full-color printing, simpler setup).

**Solution:** Minimal OrderInstructions, focus on print location.

```javascript
const product = {
    StyleNumber: 'PC61',
    CatalogColor: 'Black',
    ProductName: 'Essential Tee',
    PrintLocation: 'Full Front',
    Quantity: 72,
    FinalUnitPrice: 11.00
};

// OrderInstructions
edp += `OrderInstructions>> DTG Full Front Print\n`;
```

---

### Cap Embroidery: Different Size Distribution Pattern

**Challenge:** Caps have different size categories (OSFA, S/M, L/XL, etc.).

**Solution:** Map cap sizes to ShopWorks size columns logically.

```javascript
// Richardson 112 caps
const product = {
    StyleNumber: '112',
    CatalogColor: 'Black/White',
    ProductName: 'Richardson Trucker Cap',
    SizeBreakdown: {
        'OSFA': 48  // One Size Fits All
    },
    Quantity: 48,
    FinalUnitPrice: 15.50
};

// Size Distribution: Put total in Size03_Req (middle column)
edp += `Size01_Req>> 0\n`;
edp += `Size02_Req>> 0\n`;
edp += `Size03_Req>> 48\n`;  // OSFA total
edp += `Size04_Req>> 0\n`;
edp += `Size05_Req>> 0\n`;
edp += `Size06_Req>> 0\n`;
```

---

## Size Distribution Best Practices

### Mapping Size Names to Columns

**Standard Adult Apparel:**
```javascript
const sizeMapping = {
    'S': 'Size01_Req',      // Small
    'M': 'Size02_Req',      // Medium
    'L': 'Size03_Req',      // Large
    'XL': 'Size04_Req',     // Extra Large
    '2XL': 'Size05_Req',    // 2X Large
    '3XL': 'Size06_Req'     // 3X+ Large (combine 3XL, 4XL, 5XL)
};
```

**Youth Apparel:**
```javascript
const youthSizeMapping = {
    'YS': 'Size01_Req',     // Youth Small
    'YM': 'Size02_Req',     // Youth Medium
    'YL': 'Size03_Req',     // Youth Large
    'YXL': 'Size04_Req'     // Youth XL (if available)
    // Size05_Req and Size06_Req = 0
};
```

**One-Size Items (caps, beanies, bags):**
```javascript
// Use Size03_Req for total quantity
edp += `Size01_Req>> 0\n`;
edp += `Size02_Req>> 0\n`;
edp += `Size03_Req>> ${totalQuantity}\n`;  // All quantity here
edp += `Size04_Req>> 0\n`;
edp += `Size05_Req>> 0\n`;
edp += `Size06_Req>> 0\n`;
```

---

### Handling Non-Standard Sizes

**Problem:** What if product has 4XL, 5XL, 6XL sizes?

**Solution:** Combine extended sizes into Size06_Req column.

```javascript
const sizeBreakdown = {
    'S': 5,
    'M': 10,
    'L': 15,
    'XL': 10,
    '2XL': 5,
    '3XL': 3,
    '4XL': 2,
    '5XL': 1
};

// Combine 3XL+ into Size06_Req
const size06Total = (sizeBreakdown['3XL'] || 0) +
                    (sizeBreakdown['4XL'] || 0) +
                    (sizeBreakdown['5XL'] || 0);

edp += `Size01_Req>> ${sizeBreakdown.S || 0}\n`;
edp += `Size02_Req>> ${sizeBreakdown.M || 0}\n`;
edp += `Size03_Req>> ${sizeBreakdown.L || 0}\n`;
edp += `Size04_Req>> ${sizeBreakdown.XL || 0}\n`;
edp += `Size05_Req>> ${sizeBreakdown['2XL'] || 0}\n`;
edp += `Size06_Req>> ${size06Total}\n`;  // Combined 3XL+
```

---

### Size Distribution Validation

**Before EDP Export:**

```javascript
function validateSizeDistribution(product) {
    const sizeFields = [
        product.Size01_Req || 0,
        product.Size02_Req || 0,
        product.Size03_Req || 0,
        product.Size04_Req || 0,
        product.Size05_Req || 0,
        product.Size06_Req || 0
    ];

    const sizeTotal = sizeFields.reduce((sum, qty) => sum + qty, 0);

    // Validate total matches product quantity
    if (sizeTotal !== product.Quantity) {
        console.error(`Size distribution error for ${product.StyleNumber}:
            Size total: ${sizeTotal}
            Product quantity: ${product.Quantity}
            Difference: ${product.Quantity - sizeTotal}
        `);
        return false;
    }

    // Validate no negative quantities
    if (sizeFields.some(qty => qty < 0)) {
        console.error(`Negative size quantity detected for ${product.StyleNumber}`);
        return false;
    }

    return true;
}
```

---

## Benefits Breakdown by Department

### Production Team
- **✅ Accurate Size Breakdown** - Knows exactly how many of each size to produce
- **✅ Print/Embroidery Details** - OrderInstructions provides clear production specs
- **✅ Pricing Verification** - Can cross-check unit price against quote

### Purchasing Team
- **✅ Vendor Integration** - CatalogColor enables auto-matching to vendor SKUs
- **✅ Correct Quantities** - Size distribution ensures ordering right amounts
- **✅ Cost Tracking** - Can compare quote price to vendor costs

### Accounting Team
- **✅ Revenue Recognition** - Accurate per-unit pricing for financial reporting
- **✅ Product Classification** - id_ProductClass for categorizing sales
- **✅ Tax Compliance** - Tax override fields available if needed

### Sales Team
- **✅ Order Accuracy** - Product details match customer expectations
- **✅ Quick Lookup** - PartNumber and CatalogColor enable fast order searches
- **✅ Professional Presentation** - Clean, detailed product specifications

---

## Quote Builder Integration Examples

### Screen Print Quote Builder

```javascript
// In screenprint-quote-builder.js
function addProductToQuote(productData) {
    const product = {
        StyleNumber: productData.styleNumber,
        ProductName: productData.productName,
        Color: productData.colorName,
        ColorCode: productData.colorCode,
        CatalogColor: productData.catalogColor,  // ⭐ From API
        Quantity: calculateTotalQuantity(productData.sizes),
        FinalUnitPrice: calculateFinalPrice(productData),
        SizeBreakdown: productData.sizes,
        PrintLocations: productData.printSetup
    };

    quoteProducts.push(product);
    updateQuoteDisplay();
}
```

### DTG Quote Builder

```javascript
// In dtg-quote-builder.js
function addProductToQuote(productData) {
    const product = {
        StyleNumber: productData.styleNumber,
        ProductName: productData.productName,
        Color: productData.colorName,
        CatalogColor: productData.catalogColor,  // ⭐ From API
        Quantity: productData.quantity,
        FinalUnitPrice: productData.unitPrice,
        SizeBreakdown: productData.sizeBreakdown,
        PrintLocation: productData.selectedLocation  // e.g., "Full Front"
    };

    quoteProducts.push(product);
}
```

---

## Related Files

- **Overview & Navigation:** [SHOPWORKS_EDP_INTEGRATION.md](../SHOPWORKS_EDP_INTEGRATION.md)
- **Order Block:** [ORDER_BLOCK.md](ORDER_BLOCK.md)
- **Customer Block:** [CUSTOMER_BLOCK.md](CUSTOMER_BLOCK.md)
- **Contact Block:** [CONTACT_BLOCK.md](CONTACT_BLOCK.md)
- **Design Block:** [DESIGN_BLOCK.md](DESIGN_BLOCK.md)
- **Payment Block:** [PAYMENT_BLOCK.md](PAYMENT_BLOCK.md)
- **Pricing Sync Guide:** [PRICING_SYNC_GUIDE.md](PRICING_SYNC_GUIDE.md) - Three-system synchronization

---

**Product Block Documentation Complete** ✅

All 41 fields across 5 SubBlocks fully documented with:
- Complete field specifications
- OnSite 6.1 → 7 migration mapping
- Critical CATALOG_COLOR implementation guide
- Size distribution best practices
- Method-specific patterns
- Complete working examples
- Department-specific benefits

---

**Last Updated:** 2025-10-26
**Version:** OnSite 7
**Status:** Ready for implementation
