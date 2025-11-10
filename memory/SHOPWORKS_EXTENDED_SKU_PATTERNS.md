# ShopWorks Extended SKU Patterns - Advanced Implementation

**Last Updated:** 2025-11-09
**Purpose:** Advanced patterns for products exceeding ShopWorks' 6-size field limitation
**Status:** Production-ready based on PC61 implementation

---

## 🚨 The Size06 Field Limitation Challenge

### ShopWorks OnSite Field Structure
- **Available Fields:** Size01, Size02, Size03, Size04, Size05, Size06
- **NO Fields for:** Size07, Size08, Size09 (they don't exist)
- **Problem:** Many products have 7+ sizes (4XL, 5XL, 6XL, etc.)

### The Solution: Size06 Field Reuse Pattern
Multiple SKUs can each have their own record, all reusing the Size06 field position for different sizes.

---

## 📊 Pattern Categories

### Pattern 1: Standard Multi-SKU (3 SKUs Max)
**Example:** PC54 (S-3XL)
```
PC54    → Size01(S), Size02(M), Size03(L), Size04(XL)
PC54_2X → Size05(2XL)
PC54_3X → Size06(3XL)
```
**Query Pattern:** 3 parallel API calls

### Pattern 2: Extended Multi-SKU with Size06 Reuse (6 SKUs)
**Example:** PC61 (S-6XL)
```
PC61    → Size01(S), Size02(M), Size03(L), Size04(XL)
PC61_2X → Size05(2XL)
PC61_3X → Size06(3XL) ← First use of Size06
PC61_4X → Size06(4XL) ← Reuses Size06 (different record)
PC61_5X → Size06(5XL) ← Reuses Size06 (different record)
PC61_6X → Size06(6XL) ← Reuses Size06 (different record)
```
**Query Pattern:** 6 parallel API calls

### Pattern 3: Single-SKU (All Sizes in One)
**Example:** PC90H (S-4XL)
```
PC90H → Size01(S), Size02(M), Size03(L), Size04(XL), Size05(2XL), Size06(3XL), Size07(4XL)
```
**Note:** Size07 exists for single-SKU products (not for multi-SKU)
**Query Pattern:** 1 API call

---

## 🔧 Implementation Examples

### PC61 Complete 6-SKU Implementation

```javascript
class PC61InventoryManager {
    async fetchCompleteInventory(catalogColor) {
        // All 6 SKUs must be queried
        const skus = ['PC61', 'PC61_2X', 'PC61_3X', 'PC61_4X', 'PC61_5X', 'PC61_6X'];

        const responses = await Promise.all(
            skus.map(sku =>
                fetch(`/api/manageorders/inventorylevels?PartNumber=${sku}&Color=${catalogColor}`)
                    .then(r => r.json())
                    .catch(() => ({ result: [{}], count: 0 }))
            )
        );

        // Map responses to sizes
        const [base, twoXL, threeXL, fourXL, fiveXL, sixXL] = responses.map(r =>
            r.result?.[0] || {}
        );

        return {
            'S':   base.Size01_OnHand || 0,
            'M':   base.Size02_OnHand || 0,
            'L':   base.Size03_OnHand || 0,
            'XL':  base.Size04_OnHand || 0,
            '2XL': twoXL.Size05_OnHand || 0,
            '3XL': threeXL.Size06_OnHand || 0,  // Size06 first use
            '4XL': fourXL.Size06_OnHand || 0,  // Size06 reuse
            '5XL': fiveXL.Size06_OnHand || 0,  // Size06 reuse
            '6XL': sixXL.Size06_OnHand || 0    // Size06 reuse
        };
    }
}
```

---

## 📊 Universal Suffix-to-Column Mapping Rules

### Complete Suffix Mapping Table (From CSV Analysis)

| SKU Suffix | ShopWorks Field | Column # | Notes |
|------------|-----------------|----------|-------|
| Base SKU (no suffix) | Size01-04 | 1-4 | S, M, L, XL in base SKU |
| **_2XL** | **Size05** | **5** | **ONLY suffix using Size05** |
| _3XL | Size06 | 6 | Standard reuse of Size06 |
| _4XL | Size06 | 6 | Size06 reuse pattern |
| _5XL | Size06 | 6 | Size06 reuse pattern |
| _6XL | Size06 | 6 | Size06 reuse pattern |
| **_XXL** | **Size06** | **6** | **Ladies/women's apparel 2X-Large (NOT _2XL)** |
| _OSFA | Size06 | 6 | One-size products |
| _XS | Size06 | 6 | Extra small sizes |
| _LT | Size06 | 6 | Tall sizes (Large Tall) |
| _XLT | Size06 | 6 | Tall sizes (XL Tall) |
| _2XLT | Size06 | 6 | Tall sizes (2XL Tall) |
| _3XLT | Size06 | 6 | Tall sizes (3XL Tall) |
| _4XLT | Size06 | 6 | Tall sizes (4XL Tall) |
| _YXS | Size06 | 6 | Youth sizes |
| _YS | Size06 | 6 | Youth sizes |
| _YM | Size06 | 6 | Youth sizes |
| _YL | Size06 | 6 | Youth sizes |
| _YXL | Size06 | 6 | Youth sizes |

### Key Discovery: The _2XL vs _XXL Distinction

**Critical Pattern:** _2XL is the ONLY suffix that uses Size05. All other suffixes (including _XXL) use Size06.

**Important Note:** Despite both representing 2X-Large sizing:
- **_2XL** → Size05 (standard multi-SKU products)
- **_XXL** → Size06 (primarily ladies'/women's apparel)

These are DIFFERENT suffixes in Sanmar's system with different field mappings.

```javascript
// Universal mapping function
function getSizeFieldForSuffix(suffix) {
    if (suffix === '_2XL' || suffix === '_2X') {
        return 'Size05';  // ONLY exception
    }
    if (suffix && suffix.startsWith('_')) {
        return 'Size06';  // Everything else
    }
    return null; // Base SKU uses Size01-04
}
```

### CSV Pattern Interpretation

In the Sanmar CSV file:
- **"1"** = Field is BLOCKED/LIMITED (cannot use)
- **Blank** = Field is AVAILABLE (can use)

Example CSV patterns:
```
PC61_2XL:     1,1,1,1,,1    → Size05 available (column 5 blank)
PC61_3XL:     1,1,1,1,1,    → Size06 available (column 6 blank)
PC61_4XL:     1,1,1,1,1,    → Size06 available (column 6 blank)
J790_2XL:     1,1,1,1,,1    → Size05 available
J790_3XL:     1,1,1,1,1,    → Size06 available
CS403_XXL:    1,1,1,1,1,    → Size06 available (ladies' apparel, NOT _2XL)
DM104L_XXL:   1,1,1,1,1,    → Size06 available (ladies' apparel, NOT _2XL)
DT607_OSFA:   1,1,1,1,1,    → Size06 available (not Size01!)
```

## 🎯 How to Identify Pattern Type

### Method 1: Check ShopWorks Database
```sql
SELECT DISTINCT PartNumber
FROM Products
WHERE PartNumber LIKE 'PC61%'
ORDER BY PartNumber;

-- Results determine pattern:
-- PC61, PC61_2X, PC61_3X → Standard Multi-SKU
-- PC61, PC61_2X, PC61_3X, PC61_4X, PC61_5X, PC61_6X → Extended Multi-SKU
-- PC90H only → Single-SKU
```

### Method 2: Test API Queries
```javascript
async function detectPattern(baseStyle) {
    const suffixes = ['', '_2X', '_3X', '_4X', '_5X', '_6X'];
    const results = [];

    for (const suffix of suffixes) {
        const response = await fetch(
            `/api/manageorders/inventorylevels?PartNumber=${baseStyle}${suffix}&Color=Black`
        );
        const data = await response.json();
        if (data.count > 0) {
            results.push(`${baseStyle}${suffix}`);
        }
    }

    console.log(`Pattern for ${baseStyle}:`, results);
    return results;
}

// Usage:
await detectPattern('PC61');  // ['PC61', 'PC61_2X', 'PC61_3X', 'PC61_4X', 'PC61_5X', 'PC61_6X']
await detectPattern('PC54');  // ['PC54', 'PC54_2X', 'PC54_3X']
await detectPattern('PC90H'); // ['PC90H']
```

---

## 📋 Known Products Using Extended Patterns

| Style | Product | Pattern | Max Size | SKU Count | Size06 Usage |
|-------|---------|---------|----------|-----------|--------------|
| PC61 | Essential Tee | Extended Multi | 6XL | 6 | Reused 4 times |
| G500 | Gildan Heavy Cotton | Extended Multi* | 5XL | 5 | Reused 3 times |
| G200 | Gildan Ultra Cotton | Extended Multi* | 5XL | 5 | Reused 3 times |
| PC54 | Core Cotton Tee | Standard Multi | 3XL | 3 | Used once |
| PC90H | Essential Hoodie | Single | 4XL | 1 | Used once |

*Unverified but likely based on size range

---

## ⚠️ Critical Implementation Rules

### Rule 1: Each SKU is a Separate Record
```javascript
// PC61_4X is its own database record:
{
    PartNumber: "PC61_4X",
    Color: "Forest",
    Size06_OnHand: 12  // This is 4XL quantity
}

// PC61_5X is a different record:
{
    PartNumber: "PC61_5X",
    Color: "Forest",
    Size06_OnHand: 8   // This is 5XL quantity
}
```

### Rule 2: Always Query ALL SKUs
```javascript
// ❌ WRONG - Missing extended SKUs
const inventory = await getInventory(['PC61', 'PC61_2X', 'PC61_3X']);

// ✅ CORRECT - Query all 6 SKUs
const inventory = await getInventory(['PC61', 'PC61_2X', 'PC61_3X', 'PC61_4X', 'PC61_5X', 'PC61_6X']);
```

### Rule 3: Order Submission Uses Base SKU Only
```javascript
// ❌ WRONG
{ partNumber: "PC61_4X", size: "4XL" }

// ✅ CORRECT
{ partNumber: "PC61", size: "4XL" }  // ShopWorks routes internally
```

### Rule 4: CATALOG_COLOR is Critical
```javascript
// ❌ WRONG
fetch(`/api/manageorders/inventorylevels?PartNumber=PC61_4X&Color=Forest Green`)

// ✅ CORRECT
fetch(`/api/manageorders/inventorylevels?PartNumber=PC61_4X&Color=Forest`)
```

---

## 📊 Sanmar CSV Interpretation Guide

### Understanding the CSV Field Mapping

The Sanmar Integration CSV file (`Sanmar Integration Only Pricelist - 11-3-25.csv`) shows which ShopWorks fields are available for each SKU.

**CSV Column Mapping:**
- Column 1 → Size01 field
- Column 2 → Size02 field
- Column 3 → Size03 field
- Column 4 → Size04 field
- Column 5 → Size05 field
- Column 6 → Size06 field

**Value Interpretation:**
- **"1"** = Field is BLOCKED/LIMITED (cannot use this field)
- **Blank** = Field is AVAILABLE (can put size data here)

### Reading CSV Patterns

**Example 1: PC61_2XL**
```
CSV shows: 1,1,1,1,,1
Meaning:   ✗,✗,✗,✗,✓,✗
           Size01-04 blocked, Size05 available, Size06 blocked
Result:    2XL goes in Size05 field
```

**Example 2: PC61_4XL**
```
CSV shows: 1,1,1,1,1,
Meaning:   ✗,✗,✗,✗,✗,✓
           Size01-05 blocked, Size06 available
Result:    4XL goes in Size06 field
```

**Example 3: DT607_OSFA**
```
CSV shows: 1,1,1,1,1,
Meaning:   ✗,✗,✗,✗,✗,✓
           Size01-05 blocked, Size06 available
Result:    OSFA goes in Size06 field (NOT Size01!)
```

### Common CSV Patterns

| Pattern | Meaning | SKU Suffix | Example |
|---------|---------|------------|---------|
| `,,,,1,1` | Base SKU (S-XL) | None | PC61 |
| `1,1,1,1,,1` | Size05 available | _2XL | PC61_2XL |
| `1,1,1,1,1,` | Size06 available | _3XL through _6XL | PC61_4XL |
| `1,1,1,1,1,` | Size06 for one-size | _OSFA | C112_OSFA |
| `1,1,1,1,1,` | Size06 for youth | _YS, _YM, _YL | PC54Y_YM |
| `1,1,1,1,1,` | Size06 for tall | _LT, _XLT, _2XLT | PC61T_LT |

### Step-by-Step CSV Analysis Process

1. **Find the SKU** in the CSV file
2. **Look at the 6 columns** after the product information
3. **Identify blank columns** (available fields)
4. **Map size to available field**:
   - Base SKU → Uses Size01-04 (columns 1-4)
   - _2XL suffix → ALWAYS uses Size05 (column 5)
   - All other suffixes → Use Size06 (column 6)

### Quick Reference Algorithm

```javascript
function getFieldFromCSV(csvPattern, sizeToMap) {
    // Split CSV pattern into array
    const fields = csvPattern.split(',');

    // Find available field (blank = available)
    for (let i = 0; i < fields.length; i++) {
        if (fields[i] === '') {  // Blank means available
            return `Size${String(i + 1).padStart(2, '0')}`;
        }
    }

    return null;  // No available field found
}

// Examples
getFieldFromCSV('1,1,1,1,,1', '2XL');  // Returns: Size05
getFieldFromCSV('1,1,1,1,1,', '4XL');  // Returns: Size06
getFieldFromCSV('1,1,1,1,1,', 'OSFA'); // Returns: Size06
```

---

## 🔄 Migration Strategy for Extended Products

### Step 1: Audit Current Setup
```sql
-- Find products that might need extended SKUs
SELECT PartNumber, MAX(
    CASE
        WHEN Size07_Label IS NOT NULL THEN 7
        WHEN Size06_Label IS NOT NULL THEN 6
        WHEN Size05_Label IS NOT NULL THEN 5
        ELSE 4
    END
) as MaxSizeField
FROM Products
GROUP BY PartNumber
HAVING MaxSizeField > 6;
```

### Step 2: Create Extended SKUs
```javascript
const createExtendedSKUs = (baseStyle, maxSize) => {
    const skus = [baseStyle];

    if (maxSize >= '2XL') skus.push(`${baseStyle}_2X`);
    if (maxSize >= '3XL') skus.push(`${baseStyle}_3X`);
    if (maxSize >= '4XL') skus.push(`${baseStyle}_4X`);
    if (maxSize >= '5XL') skus.push(`${baseStyle}_5X`);
    if (maxSize >= '6XL') skus.push(`${baseStyle}_6X`);

    return skus;
};
```

### Step 3: Update API Integration
```javascript
// Generic inventory fetcher for any extended product
async function fetchExtendedInventory(baseStyle, catalogColor) {
    // Detect pattern first
    const skus = await detectPattern(baseStyle);

    // Fetch all SKUs
    const inventories = await Promise.all(
        skus.map(sku => fetchSKUInventory(sku, catalogColor))
    );

    // Merge into single inventory object
    return mergeInventories(inventories, skus);
}
```

---

## 📈 Performance Considerations

### Parallel Query Optimization
```javascript
// Good: Parallel queries (faster)
const results = await Promise.all([...queries]);

// Bad: Sequential queries (slower)
for (const query of queries) {
    await fetch(query);
}
```

### Caching Strategy
```javascript
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

class InventoryCache {
    constructor() {
        this.cache = new Map();
    }

    getCacheKey(style, color) {
        return `${style}:${color}`;
    }

    async getInventory(style, color) {
        const key = this.getCacheKey(style, color);
        const cached = this.cache.get(key);

        if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
            return cached.data;
        }

        const fresh = await this.fetchFreshInventory(style, color);
        this.cache.set(key, {
            data: fresh,
            timestamp: Date.now()
        });

        return fresh;
    }
}
```

---

## 🎯 Quick Decision Guide

```
Does product go beyond 3XL?
├── NO → Use standard Multi-SKU pattern (3 SKUs max)
└── YES → Does it go beyond 4XL?
    ├── NO → Check if hoodie/sweatshirt
    │   ├── YES → Use Single-SKU pattern (if Size07 available)
    │   └── NO → Use extended Multi-SKU with PC61_4X
    └── YES → Must use Extended Multi-SKU with Size06 reuse
        └── Create PC61_4X, PC61_5X, PC61_6X (all use Size06)
```

---

## 📚 Related Documentation

- [PC61_SHOPWORKS_SETUP_GUIDE.md](PC61_SHOPWORKS_SETUP_GUIDE.md) - Complete PC61 implementation
- [PRODUCT_SKU_PATTERNS.md](PRODUCT_SKU_PATTERNS.md) - General SKU patterns
- [SANMAR_TO_SHOPWORKS_GUIDE.md](SANMAR_TO_SHOPWORKS_GUIDE.md) - Complete transformation guide

---

**Key Takeaway:** The Size06 field reuse pattern allows ShopWorks to track products with unlimited sizes by creating multiple SKUs that each reuse the Size06 field position in their own database records.

---

## 🧪 Pattern Testing Examples

### Test Case 1: PC61 (6 SKUs with Size06 Reuse)

**API Data:**
- Sizes: S, M, L, XL, 2XL, 3XL, 4XL, 5XL, 6XL

**ShopWorks Setup:**
```javascript
// SKU mapping based on patterns
PC61        → Size01(S), Size02(M), Size03(L), Size04(XL)
PC61_2XL    → Size05(2XL)  // _2XL uses Size05
PC61_3XL    → Size06(3XL)  // First use of Size06
PC61_4XL    → Size06(4XL)  // Reuse of Size06
PC61_5XL    → Size06(5XL)  // Reuse of Size06
PC61_6XL    → Size06(6XL)  // Reuse of Size06

// Inventory API calls
GET /api/manageorders/inventorylevels?PartNumber=PC61&Color=Forest
GET /api/manageorders/inventorylevels?PartNumber=PC61_2XL&Color=Forest
GET /api/manageorders/inventorylevels?PartNumber=PC61_3XL&Color=Forest
GET /api/manageorders/inventorylevels?PartNumber=PC61_4XL&Color=Forest
GET /api/manageorders/inventorylevels?PartNumber=PC61_5XL&Color=Forest
GET /api/manageorders/inventorylevels?PartNumber=PC61_6XL&Color=Forest
```

### Test Case 2: J790 (5 SKUs with Mixed Sizes)

**API Data:**
- Sizes: XS, S, M, L, XL, 2XL, 3XL, 4XL

**ShopWorks Setup:**
```javascript
J790        → Size01(S), Size02(M), Size03(L), Size04(XL)
J790_XS     → Size06(XS)   // Special size uses Size06
J790_2XL    → Size05(2XL)  // _2XL uses Size05
J790_3XL    → Size06(3XL)  // Size06 reuse
J790_4XL    → Size06(4XL)  // Size06 reuse
```

### Test Case 3: DT607 (OSFA Product)

**API Data:**
- Size: OSFA

**ShopWorks Setup:**
```javascript
DT607_OSFA  → Size06(OSFA)  // OSFA uses Size06 (NOT Size01!)

// CSV verification: 1,1,1,1,1, (Size06 available)
// Inventory API call
GET /api/manageorders/inventorylevels?PartNumber=DT607_OSFA&Color=ChocBrown/Wht
```

### Test Case 4: 108084 (Tall Sizes)

**API Data:**
- Sizes: S, M, L, XL, 2XL, 3XL, LT, XLT, 2XLT

**ShopWorks Setup:**
```javascript
108084      → Size01(S), Size02(M), Size03(L), Size04(XL)
108084_2XL  → Size05(2XL)   // _2XL uses Size05
108084_3XL  → Size06(3XL)   // Size06 first use
108084_LT   → Size06(LT)    // Tall sizes use Size06
108084_XLT  → Size06(XLT)   // Tall sizes use Size06
108084_2XLT → Size06(2XLT)  // Tall sizes use Size06
```

### Test Case 5: Youth Product (PC54Y)

**API Data:**
- Sizes: YXS, YS, YM, YL, YXL

**ShopWorks Setup:**
```javascript
PC54Y       → Size01(YS), Size02(YM), Size03(YL), Size04(YXL)
PC54Y_YXS   → Size06(YXS)   // Youth XS uses Size06
```

### Validation Checklist

- [ ] Base SKU always uses Size01-04 for standard sizes
- [ ] _2XL suffix ALWAYS uses Size05 (only exception)
- [ ] ALL other suffixes use Size06
- [ ] OSFA products use Size06 (not Size01)
- [ ] Order submission uses base SKU only (no suffixes)
- [ ] CATALOG_COLOR format used for API queries

### Quick Test Script

```javascript
// Test function to verify pattern rules
function testSuffixPattern(sku) {
    const parts = sku.split('_');
    if (parts.length === 1) {
        return 'Base SKU: Uses Size01-04';
    }

    const suffix = '_' + parts[1];
    switch(suffix) {
        case '_2XL':
        case '_2X':
            return 'Size05 (ONLY suffix using Size05)';
        default:
            return 'Size06 (reuse pattern)';
    }
}

// Test examples
console.log('PC61:', testSuffixPattern('PC61'));          // Base SKU: Uses Size01-04
console.log('PC61_2XL:', testSuffixPattern('PC61_2XL'));  // Size05 (ONLY suffix using Size05)
console.log('PC61_4XL:', testSuffixPattern('PC61_4XL'));  // Size06 (reuse pattern)
console.log('DT607_OSFA:', testSuffixPattern('DT607_OSFA')); // Size06 (reuse pattern)
console.log('J790_LT:', testSuffixPattern('J790_LT'));    // Size06 (reuse pattern)
```

---

**Last Updated:** 2025-11-09
**Version:** 1.1.0 - Added complete suffix mapping, CSV interpretation guide, and testing examples