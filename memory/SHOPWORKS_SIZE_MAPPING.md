# SanMar to ShopWorks - Complete Data Transformation Reference

> **Source Data:** SanMar Pricing CSV (169,041 records) → ShopWorks Import (15,682 records)
> **Created:** January 2026
> **Purpose:** Reference for data flow, size mapping, color fields, and quote builder integration

---

## Table of Contents

1. [SanMar Source Data Structure](#sanmar-source-data-structure)
2. [Transformation Rules](#transformation-rules)
3. [Color Field Mapping](#color-field-mapping)
4. [Data Aggregation Pattern](#data-aggregation-pattern)
5. [ShopWorks Import Format](#shopworks-import-format)
6. [Size Suffix Categories](#complete-size-suffix-categories)
7. [JavaScript Implementation](#javascript-implementation-reference)
8. [Quote Builder Application](#application-to-quote-builder)
9. [CSV Validation Script Reference](#csv-validation-script-reference)
10. [PT* Pants Styles Analysis](#pt-pants-styles-complete-analysis)
11. [Expanded SIZE_TO_SUFFIX Mapping](#expanded-size_to_suffix-mapping-97-sizes)
12. [Validation Troubleshooting](#validation-troubleshooting)
13. [ShopWorks Parts Validation](#shopworks-parts-validation-jan-2026)

---

## SanMar Source Data Structure

**File:** `Sanmar New Pricing 1-4-26.csv` (169,041 records)
**Format:** One row per SIZE + COLOR combination

### Key Source Columns

| Column | Purpose | Example |
|--------|---------|---------|
| STYLE | Product code | `LOE721`, `PC61`, `2000` |
| SIZE | Individual size | `S`, `M`, `L`, `XL`, `2XL`, `3XL` |
| COLOR_NAME | Display color (UI) | `"Blacktop/ Gear Grey"` |
| CATALOG_COLOR | API/ShopWorks color | `"Blktp/Gear Gry"` |
| PIECE_PRICE | Per-unit price | `62.89` |
| CATEGORY_NAME | Product category | `Outerwear`, `T-Shirts` |
| BRAND_NAME | Manufacturer | `OGIO`, `Gildan`, `Port Authority` |
| PRODUCT_STATUS | Availability | `Active`, `Discontinued`, `New` |

### SanMar Data Statistics

| Metric | Count |
|--------|-------|
| Total Records | 169,041 |
| Unique Styles | 4,249 (validated Jan 2026) |
| Unique Colors | 3,746 (COLOR_NAME) / 4,842 (CATALOG_COLOR) |
| Unique Sizes | 242 (validated Jan 2026) |
| Active Products | 127,115 (75.2%) |
| Discontinued | 39,581 (23.4%) |

### SanMar SIZE Values by Category

| Category | Sizes | Records |
|----------|-------|---------|
| Standard Adult | S, M, L, XL, 2XL-6XL | 121,748 (72%) |
| OSFA | OSFA | 3,806 (2.3%) |
| Tall | LT, XLT, 2XLT-4XLT | 3,758 (2.2%) |
| Combo | S/M, M/L, L/XL | 1,134 (0.7%) |
| Pants | 3030, 3232, W30-W50 | 1,260 (0.7%) |
| Toddler | 2T, 3T, 4T, 5T, 6T | 543 (0.3%) |
| Infant | NB, 06M, 12M, 18M, 24M | 319 (0.2%) |

### SanMar Categories (16 Total)

| Category | Records | % |
|----------|---------|---|
| T-Shirts | 38,770 | 22.9% |
| Sweatshirts/Fleece | 19,810 | 11.7% |
| Polos/Knits | 19,472 | 11.5% |
| Ladies | 9,882 | 5.8% |
| Outerwear | 9,289 | 5.5% |
| Woven Shirts | 6,630 | 3.9% |
| Activewear | 5,889 | 3.5% |
| Workwear | 3,940 | 2.3% |
| Caps | 2,093 | 1.2% |
| Youth | 1,705 | 1.0% |
| Bags | 917 | 0.5% |
| Tall | 850 | 0.5% |

### Top 10 Brands

| Brand | Records | % |
|-------|---------|---|
| Port Authority | 28,731 | 17.0% |
| Sport-Tek | 28,711 | 17.0% |
| Port & Company | 18,075 | 10.7% |
| District | 15,303 | 9.1% |
| Gildan | 9,377 | 5.5% |
| Bella + Canvas | 7,703 | 4.6% |
| Nike | 6,340 | 3.8% |
| OGIO | 5,122 | 3.0% |
| Jerzees | 4,935 | 2.9% |
| New Era | 4,438 | 2.6% |

---

## Transformation Rules

### SanMar SIZE → ShopWorks ID_Product Suffix

| SanMar SIZE | ShopWorks Suffix | Rule |
|-------------|------------------|------|
| S, M, L, XL | (none - base) | No suffix for standard sizes |
| XS | `_XS` | Add underscore prefix |
| 2XL | `_2XL` | Add underscore prefix |
| 3XL | `_3XL` | Add underscore prefix |
| 4XL-6XL | `_4XL` to `_6XL` | Add underscore prefix |
| LT, XLT | `_LT`, `_XLT` | Add underscore prefix |
| 2XLT-4XLT | `_2XLT` to `_4XLT` | Add underscore prefix |
| OSFA | `_OSFA` | Add underscore prefix |
| S/M, M/L, L/XL | `_S/M`, `_M/L`, `_L/XL` | Add underscore prefix |
| 2T-6T | `_2T` to `_6T` | Add underscore prefix |
| NB, 06M, 12M | `_NB`, `_06M`, `_12M` | Add underscore prefix |
| 3030, 3232 | `_3030`, `_3232` | Add underscore prefix (pants) |

### Transformation JavaScript

```javascript
function sanmarToShopWorksId(style, size) {
    const STANDARD_SIZES = ['S', 'M', 'L', 'XL'];

    // Standard sizes have no suffix
    if (STANDARD_SIZES.includes(size.toUpperCase())) {
        return style;
    }

    // All other sizes get underscore suffix
    return `${style}_${size}`;
}

// Example usage:
sanmarToShopWorksId('PC61', 'M')    // Returns: 'PC61'
sanmarToShopWorksId('PC61', '2XL')  // Returns: 'PC61_2XL'
sanmarToShopWorksId('PC61', '3XL')  // Returns: 'PC61_3XL'
sanmarToShopWorksId('C950', 'OSFA') // Returns: 'C950_OSFA'
```

---

## Color Field Mapping

### CRITICAL: Use CATALOG_COLOR, not COLOR_NAME

| Field | Purpose | Example | Length |
|-------|---------|---------|--------|
| **COLOR_NAME** | UI display to users | `"Blacktop/ Gear Grey"` | ~15.3 chars avg |
| **CATALOG_COLOR** | API queries, ShopWorks, Inventory | `"Blktp/Gear Gry"` | ~10.4 chars avg |

The CATALOG_COLOR field is abbreviated for database compatibility and API matching.

### Color Field Usage in Code

```javascript
// CORRECT - for API/inventory queries
const inventoryColor = product.CATALOG_COLOR;  // "Blktp/Gear Gry"

// CORRECT - for UI display
const displayColor = product.COLOR_NAME;       // "Blacktop/ Gear Grey"

// WRONG - will fail in ShopWorks/inventory lookups
const inventoryColor = product.COLOR_NAME;     // Too long, has spaces
```

### Color Statistics

| Metric | COLOR_NAME | CATALOG_COLOR |
|--------|------------|---------------|
| Unique Values | 3,746 | 4,842 |
| Avg Length | 15.3 chars | 10.4 chars |
| Max Length | ~35 chars | ~20 chars |

**Note:** CATALOG_COLOR has more unique values because some colors have slight abbreviation variations across brands.

---

## Data Aggregation Pattern

SanMar has **one row per SIZE/COLOR**. ShopWorks groups by **SIZE only**.

### Example: PC61 Transformation

**SanMar Source (multiple rows):**
```
PC61, S, White, $4.62
PC61, M, White, $4.62
PC61, L, White, $4.62
PC61, XL, White, $4.62
PC61, 2XL, White, $5.43
PC61, 3XL, White, $6.06
PC61, S, Navy, $4.62
PC61, M, Navy, $4.62
... (hundreds of rows for all color/size combos)
```

**ShopWorks Import (grouped by size):**
```
ID_Product: PC61        → Base (S/M/L/XL) at $4.62
ID_Product: PC61_2XL    → 2XL variant at $5.43
ID_Product: PC61_3XL    → 3XL variant at $6.06
ID_Product: PC61_4XL    → 4XL variant at $6.06
ID_Product: PC61_XS     → XS variant at $4.62
```

### Record Count Reduction

| Source | Records | Format |
|--------|---------|--------|
| SanMar CSV | 169,041 | One row per SIZE + COLOR |
| ShopWorks Import | 15,682 | One row per SIZE only |
| **Reduction** | ~90.7% | Colors aggregated |

---

## ShopWorks Import Format

**File:** `Shopworks_Import_Converted.csv` (15,682 records)
**Format:** One row per STYLE + SIZE_SUFFIX (grouped by base size)

### ID_Product Format: `STYLECODE_SIZE`

The `ID_Product` column uses underscore to separate style code from size suffix.

### Key Discovery: Base Products Have NO Suffix

| ID_Product | Type | Represents |
|------------|------|------------|
| `PC61` | Base (no suffix) | S, M, L, XL sizes |
| `PC61_2XL` | Variant | 2XL only |
| `PC61_3XL` | Variant | 3XL only |
| `PC61_XS` | Variant | XS only |

**IMPORTANT: S, M, L, XL are NEVER explicit suffixes** - they're represented by the base product code (no underscore).

---

## sts_LimitSize Column Mapping

### The Three Patterns

| Pattern | CSV Format | Count | Product Type |
|---------|-----------|-------|--------------|
| **Pattern 1** | `1,1,1,1,1,` | 10,222 | Size variants (_3XL, _XS, _OSFA, etc.) |
| **Pattern 2** | `,,,,1,1` | 3,147 | **BASE products** (no suffix) |
| **Pattern 3** | `1,1,1,1,,1` | 2,313 | **_2XL variants ONLY** |

### Column Mapping

| Column | Maps To | Used By Base | Used By Variants |
|--------|---------|--------------|------------------|
| sts_LimitSize01 | XS | No | Yes |
| sts_LimitSize02 | S | No | Yes |
| sts_LimitSize03 | M | No | Yes |
| sts_LimitSize04 | L | No | Yes |
| sts_LimitSize05 | XL | Yes | Yes (except _2XL) |
| sts_LimitSize06 | 2XL | Yes | Yes (_2XL only) |

### Why _2XL Skips Size05

The `_2XL` variant uses Pattern 3 (`1,1,1,1,,1`) which **disables Size05** to avoid conflicts with the base product's XL representation.

---

## Complete Size Suffix Categories

### 1. Standard Adult Sizes (10,197 products)

| Suffix | Count | Notes |
|--------|-------|-------|
| `_3XL` | 2,502 | Most common variant |
| `_XS` | 2,396 | Second most common |
| `_2XL` | 2,199 | Uses special Pattern 3 |
| `_4XL` | 2,176 | |
| `_XXL` | 594 | Alternative 2XL notation |
| `_5XL` | 185 | |
| `_6XL` | 105 | |
| `_XXXL` | 6 | Rare |
| `_XXS` | 18 | |
| `_2XS` | 15 | |

### 2. Tall Sizes (507 products)

| Suffix | Count | Example Products |
|--------|-------|-----------------|
| `_LT` | 103 | TST254_LT, 2000T_LT |
| `_XLT` | 102 | TLJ754_XLT |
| `_2XLT` | 101 | TST350LS_2XLT |
| `_3XLT` | 98 | TLJ317_3XLT |
| `_4XLT` | 86 | TLJ705_4XLT |

**Note:** Tall products have style codes starting with `T` (TST254, TLJ754) or ending with `T` (2000T, PC54T).

### 3. Long Sizes (17 products)

| Suffix | Count | Example |
|--------|-------|---------|
| `_LL` | 4 | CS20LONG_LL |
| `_XLL` | 4 | CS20LONG_XLL |
| `_2XLL` | 4 | CS20LONG_2XLL |
| `_3XLL` | 5 | CS20LONG_3XLL |

### 4. Combo/Fitted Cap Sizes (193 products)

| Suffix | Count | Example Products |
|--------|-------|-----------------|
| `_S/M` | 71 | C808_S/M, 333115_S/M |
| `_L/XL` | 70 | C938_L/XL, NE703_L/XL |
| `_M/L` | 37 | NE1000_M/L |
| `_2/3X` | 11 | |
| `_4/5X` | 8 | |
| `_XS/S` | 1 | |
| `_X/2X` | 1 | |

### 5. OSFA - One Size Fits All (848 products)

| Suffix | Example Products |
|--------|-----------------|
| `_OSFA` | C950_OSFA, C951_OSFA, B050_OSFA |

Used for: Caps, beanies, bags, totes, travel bags, golf bags, accessories

### 6. Youth Sizes

**Youth products use B suffix in the STYLE CODE, not the size:**

| Style Code | Variants | Product |
|------------|----------|---------|
| `18500B` | 18500B, 18500B_XS | Gildan Youth Heavy Blend Hoodie |
| `2000B` | 2000B, 2000B_XS | Gildan Youth Ultra Cotton Tee |
| `42000B` | 42000B, 42000B_XS | Gildan Youth Performance Tee |

**Youth products with Y prefix:**

| Style Code | Example | Product |
|------------|---------|---------|
| `YST254` | YST254, YST254_XS | Sport-Tek Youth Pullover Hoodie |
| `YT565` | YT565, YT565_XS | Sport-Tek Youth Mesh Short |
| `Y500LS` | Y500LS, Y500LS_XS | Port Authority Youth Long Sleeve Polo |

### 7. Toddler Sizes (41 products)

| Suffix | Count | Example |
|--------|-------|---------|
| `_2T` | 12 | 5100P_2T, CAR54T_2T |
| `_3T` | 12 | 5100P_3T |
| `_4T` | 12 | CAR78TH_4T |
| `_5T` | 4 | 5100P_5T |
| `_6T` | 1 | |

### 8. Infant Sizes (35 products)

| Suffix | Count | Example |
|--------|-------|---------|
| `_06M` | 9 | CAR54I_06M |
| `_12M` | 9 | RS4400_12M |
| `_18M` | 9 | RS4411_18M |
| `_24M` | 5 | |
| `_NB` | 3 | RS4400_NB (Newborn) |

### 9. Pants - Waist/Inseam (547 products)

**4-digit format: `_WWII` (Waist + Inseam)**

| Suffix | Meaning | Example Products |
|--------|---------|-----------------|
| `_3030` | 30" waist x 30" inseam | CTB151_3030 |
| `_3232` | 32" waist x 32" inseam | CT102808_3232 |
| `_3634` | 36" waist x 34" inseam | CT103574_3634 |
| `_4032` | 40" waist x 32" inseam | CTB11_4032 |

**Waist-only format: `_WNN`**

| Suffix | Example |
|--------|---------|
| `_W30` | PT66_W30 |
| `_W32` | PT66_W32 |
| `_W48` | PT66_W48 |

---

## Product Code Patterns

### Prefixes Indicating Product Type

| Prefix | Product Type | Example |
|--------|-------------|---------|
| `T` | Tall products | TST254, TLJ754, TLK500 |
| `Y` | Youth products | YST254, YT565, Y500LS |
| `L` | Ladies/Women's | LPC54, LST380, LNEA104 |
| `C` | Caps/Hats | C112, C808, C950 |
| `B` | Bags | BG970, B050 |
| `CT` | Carhartt | CTB151, CT102808 |
| `PT` | Pants (Red Kap) | PT20, PT66 |
| `RS` | Rabbit Skins (infant) | RS4400, RS4411 |
| `CAR` | Port & Company Kids | CAR54T, CAR54I |

### Suffixes in Style Code

| Suffix | Meaning | Example |
|--------|---------|---------|
| `B` | Youth/Boy | 2000B, 18500B |
| `T` | Tall | 2000T, PC54T |
| `L` | Long Sleeve | Y500LS, TST350LS |
| `I` | Infant | CAR54I |
| `P` | Toddler/Preschool | 5100P |

---

## JavaScript Implementation Reference

### Parse ShopWorks ID

```javascript
function parseShopWorksId(idProduct) {
    const parts = idProduct.split('_');
    const styleCode = parts[0];
    const sizeSuffix = parts.length > 1 ? parts.slice(1).join('_') : null;

    return {
        styleCode,
        sizeSuffix,
        isBase: sizeSuffix === null,
        isOSFA: sizeSuffix === 'OSFA',
        isTall: /^(LT|XLT|[2-6]XLT)$/.test(sizeSuffix),
        isCombo: sizeSuffix?.includes('/'),
        isPants: /^\d{4}$/.test(sizeSuffix) || /^W\d{2}$/.test(sizeSuffix),
        isToddler: /^[2-6]T$/.test(sizeSuffix),
        isInfant: /^(NB|\d{2}M)$/.test(sizeSuffix)
    };
}
```

### Classify Product Type from Style Code

```javascript
function classifyProductType(styleCode) {
    const code = styleCode.toUpperCase();

    // Youth products
    if (code.startsWith('Y') || code.endsWith('B')) return 'youth';

    // Tall products
    if (code.startsWith('T') && /^T[A-Z]{2}/.test(code)) return 'tall';
    if (code.endsWith('T') && !code.startsWith('RS')) return 'tall';

    // Ladies products
    if (code.startsWith('L') && /^L[A-Z]{2}/.test(code)) return 'ladies';

    // Caps/Hats
    if (code.startsWith('C') && /^C\d{2,3}/.test(code)) return 'cap';

    // Bags
    if (code.startsWith('B') && /^B[A-Z]?\d{2,3}/.test(code)) return 'bag';

    // Pants
    if (code.startsWith('PT') || code.startsWith('CT')) return 'workwear';

    // Infant/Toddler
    if (code.startsWith('RS') || code.startsWith('CAR')) return 'kids';

    return 'standard';
}
```

### Get sts_LimitSize Pattern

```javascript
function getLimitSizePattern(sizeSuffix) {
    if (!sizeSuffix) {
        // Base product: Size05 and Size06 only
        return [0, 0, 0, 0, 1, 1];
    }

    if (sizeSuffix === '2XL' || sizeSuffix === 'XXL') {
        // 2XL variant: Skip Size05
        return [1, 1, 1, 1, 0, 1];
    }

    // All other variants: Size01-05
    return [1, 1, 1, 1, 1, 0];
}
```

### Size Detection from SanMar API

```javascript
async function detectProductSizes(styleNumber) {
    // Fetch all SKUs for style from SanMar API
    const response = await fetch(
        `${API_BASE}/api/sanmar-shopworks/import-format?styleNumber=${styleNumber}`
    );
    const skus = await response.json();

    // Extract unique sizes
    const sizes = [...new Set(skus.map(sku => sku.SIZE))];

    // Classify size category
    return analyzeSizeCategory(sizes);
}
```

---

## Summary Statistics

### ShopWorks Import Breakdown

| Category | Records | Percentage |
|----------|---------|------------|
| Base products (S/M/L/XL) | 3,147 | 20.1% |
| Extended sizes (2XL-6XL, XS) | 7,984 | 50.9% |
| OSFA | 848 | 5.4% |
| Tall | 507 | 3.2% |
| Combo (S/M, M/L, L/XL) | 193 | 1.2% |
| Pants (waist/inseam) | 569 | 3.6% |
| Youth/Toddler/Infant | 76 | 0.5% |
| Other variants | 2,358 | 15.1% |
| **Total** | **15,682** | **100%** |

---

## Application to Quote Builder

This mapping enables proper size detection in quote builders:

1. **Standard products**: Base SKU + _2XL, _3XL, _4XL, _XS variants
2. **OSFA products**: Single `_OSFA` SKU -> Show qty-only input
3. **Combo sizes**: `_S/M`, `_M/L`, `_L/XL` -> Show combo columns
4. **Tall products**: `_LT`, `_XLT`, `_2XLT`+ -> Show tall columns
5. **Youth products**: Style code with Y prefix or B suffix
6. **Pants**: 4-digit waist/inseam -> Block or show waist selector

### Quote Builder Size Detection Flow

```
1. User enters style number (e.g., PC61)
2. Fetch from SanMar API → Get all SIZE values
3. Analyze sizes:
   - Contains S/M/L/XL? → Show standard grid
   - Only OSFA? → Show qty-only input
   - Contains S/M, M/L? → Show combo columns
   - Contains LT, XLT? → Show tall columns
4. Use CATALOG_COLOR for inventory lookup
5. Use COLOR_NAME for display
```

---

## Related Documentation

- `/memory/MANAGEORDERS_INTEGRATION.md` - ShopWorks PULL API integration
- `/memory/CASPIO_API_CORE.md` - API endpoints including sanmar-shopworks
- `/memory/EMBROIDERY_QUOTE_BUILDER.md` - Quote builder implementation

---

## CSV Validation Script Reference

**Script:** `tests/unit/csv-validation-report.js`
**Purpose:** Validates all SanMar CSV products against SIZE_TO_SUFFIX mapping
**Created:** January 2026

### How to Run

```bash
node tests/unit/csv-validation-report.js [path-to-csv]
```

### Latest Validation Results (Jan 2026)

| Metric | Value |
|--------|-------|
| Total Rows Parsed | 169,041 |
| Unique Styles | 4,249 |
| Unique Sizes | 242 |
| Unmapped Sizes | 0 (all mapped!) |
| Empty CATALOG_COLOR | 127 rows |

### What the Script Validates

1. **Size Mapping Coverage**: Ensures every size value in the CSV has a corresponding entry in `SIZE_TO_SUFFIX`
2. **PT* Pants Detection**: Identifies all pants products and their size patterns
3. **OSFA Detection**: Counts one-size-fits-all products
4. **Data Quality**: Flags rows with empty CATALOG_COLOR

### Validation Output

```
=== CSV VALIDATION REPORT ===
Total rows parsed: 169,041
Unique styles: 4,249
Unique sizes: 242

=== SIZE MAPPING STATUS ===
✓ All sizes are properly mapped!

=== PT* PANTS STYLES ANALYSIS ===
Found 16 PT* styles with 3 distinct patterns
```

---

## PT* Pants Styles Complete Analysis

All 16 PT* (Red Kap Industrial) pants styles in the SanMar catalog have been validated.

### Size Pattern Classification

| Pattern | Styles | Size Format | Example Sizes |
|---------|--------|-------------|---------------|
| 4-digit waist+inseam | PT20, PT26, PT60, PT88 | `WWII` | 2830, 3030, 3232, 4634, 5432 |
| Waist-only (shorts) | PT66 | `W30-W50` | W30, W32, W34, W36, W38, W40, W42, W44, W46, W48, W50 |
| Standard extended | PT333, LPT333 | `S-3XL` | S, M, L, XL, 2XL, 3XL |
| OSFA | PT38-PT49, PT390, PT400 | `OSFA` | OSFA only |

### Detailed Style Breakdown

| Style | Product | Size Pattern | Size Count |
|-------|---------|--------------|------------|
| PT20 | Work Pant | 4-digit | 78 |
| PT26 | Work Short | 4-digit | 78 |
| PT60 | Cargo Pant | 4-digit | 78 |
| PT88 | Cell Phone Pant | 4-digit | 78 |
| PT66 | Cargo Short | Waist-only | 11 |
| PT333 | Performance Pant | Standard | 8 |
| LPT333 | Ladies Perf Pant | Standard | 8 |
| PT38 | Shop Coat | OSFA | 1 |
| PT39 | Lab Coat | OSFA | 1 |
| PT42-PT49 | Coveralls/Coats | OSFA | 1 each |
| PT390 | Chef Coat | OSFA | 1 |
| PT400 | Work Smock | OSFA | 1 |

### Quote Builder Handling

The embroidery quote builder detects pants products automatically:

```javascript
// 4-digit pattern for pants with inseam (PT20, PT26, PT60, PT88)
const PANTS_SIZE_PATTERN = /^\d{4}$/;

// Waist-only pattern for shorts (PT66)
const WAIST_ONLY_PATTERN = /^W\d{2}$/;
```

**Pants Display:**
- 4-digit sizes → Formatted as "30×30", "32×32", etc.
- Waist-only → Formatted as "Waist 30", "Waist 32", etc.

---

## Expanded SIZE_TO_SUFFIX Mapping (97+ Sizes)

The validation script identified 97 unique size values requiring explicit mapping.
The complete mapping is in `shared_components/js/sku-validation-service.js`.

### Size Categories Covered

| Category | Sizes | Suffix Format |
|----------|-------|---------------|
| **Standard** | S, M, L, XL | (no suffix - base product) |
| **Extra-small** | XS, XXS, 2XS | `_XS`, `_XXS`, `_2XS` |
| **Extended** | 2XL-6XL | `_2X`, `_3X`, `_4X`, `_5X`, `_6X` |
| **Extra-extended** | 7XL-10XL | `_7X`, `_8X`, `_9X`, `_10X` |
| **Aliases** | XXL, XXXL | → `_2X`, `_3X` |
| **Tall** | LT, XLT, 2XLT-4XLT, MT, ST, XST | `_LT`, `_XLT`, etc. |
| **Long** | LL, ML, XLL, 2XLL, 3XLL | `_LL`, `_ML`, etc. |
| **Short** | LS, MS, XLS, 2XLS, 3XLS | `_LS`, `_MS`, etc. |
| **Regular** | SR, MR, LR, XLR, 2XLR-6XLR | `_SR`, `_MR`, etc. |
| **Petite** | SP, MP, LP, XLP, 2XLP | `_SP`, `_MP`, etc. |
| **Youth** | YXS, YS, YM, YL, YXL | `_YXS`, `_YS`, etc. |
| **Toddler** | 2T-6T, 5/6T | `_2T`, `_3T`, `_6T`, `_5/6T` |
| **Infant** | NB, 06M, 12M, 18M, 24M, 306, 612, 1824 | `_NB`, `_06M`, etc. |
| **Combo** | S/M, M/L, L/XL, 2/3X, 4/5X | `_S/M`, `_M/L`, etc. |
| **OSFA** | OSFA | `_OSFA` |
| **Waist-only** | W30-W50 | `_W30`, `_W32`, etc. |
| **Numeric** | 0-42 (belts/shoes) | `_0`, `_8`, `_42` |
| **4-digit pants** | 2830-5434 | `_2830`, `_3232`, etc. |

### Key Additions (Jan 2026)

These sizes were missing from the original mapping and have been added:

```javascript
// Extra-extended (large workwear)
'7XL': '_7X', '8XL': '_8X', '9XL': '_9X', '10XL': '_10X',

// Waist-only shorts (PT66, CT103542)
'W30': '_W30', 'W31': '_W31', 'W32': '_W32', 'W33': '_W33',
'W34': '_W34', 'W35': '_W35', 'W36': '_W36', 'W38': '_W38',
'W40': '_W40', 'W42': '_W42', 'W44': '_W44', 'W46': '_W46',
'W48': '_W48', 'W50': '_W50',

// Regular/Long/Short/Petite variants (dress shirts/pants)
'SR': '_SR', 'MR': '_MR', 'LR': '_LR', 'XLR': '_XLR',
'2XLR': '_2XLR', '3XLR': '_3XLR', '4XLR': '_4XLR', '5XLR': '_5XLR', '6XLR': '_6XLR',
'ML': '_ML', 'LL': '_LL', 'XLL': '_XLL', '2XLL': '_2XLL', '3XLL': '_3XLL',
'MS': '_MS', 'LS': '_LS', 'XLS': '_XLS', '2XLS': '_2XLS', '3XLS': '_3XLS',
'SP': '_SP', 'MP': '_MP', 'LP': '_LP', 'XLP': '_XLP', '2XLP': '_2XLP',

// Missing tall variants
'MT': '_MT', 'ST': '_ST', 'XST': '_XST',

// Aliases
'XXL': '_2X', 'XXXL': '_3X', 'XXS': '_XXS',

// Missing infant
'1824': '_1824', '306': '_306', '612': '_612'
```

---

## Validation Troubleshooting

### Running the Validation Script

```bash
# Default: uses sample path
node tests/unit/csv-validation-report.js

# Specify custom CSV path
node tests/unit/csv-validation-report.js "/path/to/Sanmar New Pricing.csv"
```

### Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| "File not found" | CSV path incorrect | Use absolute path with quotes |
| Unmapped size errors | New size in SanMar data | Add to SIZE_TO_SUFFIX in sku-validation-service.js |
| Empty CATALOG_COLOR | Data quality issue | 127 rows affected, API should have clean data |

### Re-running After Updates

If you update `SIZE_TO_SUFFIX` in sku-validation-service.js, also update the mapping in the validation script to keep them in sync.

---

## ShopWorks Parts Validation (Jan 2026)

**Source:** `shopworksparts.csv` (15,160 products)
**Purpose:** Ensure generated inventorySku values match ShopWorks exactly
**Validated:** 2026-01-04

### Critical Discovery: XXL Suffix Mismatch

ShopWorks uses **THREE different suffixes** for extended sizes:

| Suffix | Count | Used By |
|--------|-------|---------|
| `_2X` | 2,094 | Most unisex/men's products |
| `_XXL` | 586 | Ladies products, District, Cornerstone |
| `_2XL` | 35 | Newer brands (Mercer+Mettle, TravisMathew) |

**Problem:** The original mapping had `'XXL': '_2X'` which is **WRONG** for 586 products.

### XXL_STYLES Set (442 Active Styles)

Styles that require `_XXL` suffix instead of `_2X`:

```javascript
static XXL_STYLES = new Set([
    // Cornerstone
    'CS411', 'CS413', 'CS419', 'CS451',

    // District Made (Ladies)
    'DM104L', 'DM106L', 'DM107L', 'DM108L', 'DM1170L', 'DM1190L', ...

    // District (various)
    'DT110', 'DT1104', 'DT5001', 'DT5002', 'DT6001', 'DT6002', ...

    // Ladies (L*)
    'L100', 'L110', 'L500', 'L500LS', 'L508', 'L510', ...

    // Ladies Port Authority (LK*)
    'LK110', 'LK110SV', 'LK111', 'LK200', 'LK200LS', ...

    // Ladies Port & Company (LPC*)
    'LPC54', 'LPC54LS', 'LPC380', 'LPC61', ...

    // Ladies Sport-Tek (LST*)
    'LST104', 'LST225', 'LST235', 'LST350', 'LST353', ...

    // Ladies Wicking (LSW*)
    'LSW285', 'LSW2850', 'LSW287', ...

    // Ladies (LW*)
    'LW100', 'LW102', 'LW380', 'LW400', ...

    // Outdoor Research
    'OR322218', 'OR322225', 'OR322226', 'OR322227', 'OR322228', ...

    // Red House, TravisMathew
    'RH79', 'TTCM3914', 'TTCM4367', 'TTCW5646', 'TTCW5647', ...
]);
```

### Lowercase Suffix Styles

Some products use lowercase suffixes in ShopWorks:

| Style | Size | ShopWorks SKU |
|-------|------|---------------|
| WW3150S | SS | `WW3150S_ss` |
| OR322226 | XXXL | `OR322226_xxxl` |
| OR322227 | XXXL | `OR322227_xxxl` |
| OR322228 | XXXL | `OR322228_xxxl` |
| OR322264 | XXXL | `OR322264_xxxl` |
| OR322267 | XXXL | `OR322267_xxxl` |
| OR322269 | XXXL | `OR322269_xxxl` |

### Additional Infant Sizes

4-digit infant sizes with leading zeros:

| Size | Meaning | ShopWorks Suffix |
|------|---------|------------------|
| `0003` | 0-3 months | `_0003` |
| `0306` | 3-6 months | `_0306` |
| `0612` | 6-12 months | `_0612` |
| `1218` | 12-18 months | `_1218` |
| `1824` | 18-24 months | `_1824` |

**Note:** These are distinct from the 3-digit versions (`306`, `612`).

### Updated sanmarToShopWorksSKU Logic

```javascript
sanmarToShopWorksSKU(style, size) {
    const normalizedSize = size.toUpperCase().trim();

    // Special handling: XXL → _XXL for Ladies/District products
    if (normalizedSize === 'XXL' && SKUValidationService.XXL_STYLES.has(style)) {
        return `${style}_XXL`;
    }

    // Special handling: SS → _ss for styles with lowercase suffix
    if (normalizedSize === 'SS' && SKUValidationService.LOWERCASE_SS_STYLES.has(style)) {
        return `${style}_ss`;
    }

    // Special handling: XXXL → _xxxl for styles with lowercase suffix
    if (normalizedSize === 'XXXL' && SKUValidationService.LOWERCASE_XXXL_STYLES.has(style)) {
        return `${style}_xxxl`;
    }

    // Standard lookup
    const suffix = SKUValidationService.SIZE_TO_SUFFIX[normalizedSize];
    if (suffix !== undefined) {
        return suffix ? `${style}${suffix}` : style;
    }

    // Fallback
    return `${style}_${normalizedSize}`;
}
```

### Test Script

**File:** `tests/unit/test-sku-validation-fixes.js`

```bash
node tests/unit/test-sku-validation-fixes.js
```

Validates all special cases:
- 32 test cases covering XXL_STYLES, lowercase suffixes, infant sizes
- ✓ All tests pass
