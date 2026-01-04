# Embroidery Quote Builder Development

## Overview
The embroidery quote builder (`quote-builders/embroidery-quote-builder-new.html`) is an Excel-style interface for creating embroidery quotes with multiple products, colors, and size breakdowns.

## Key Features Implemented
1. **Product Table** - Add rows with style number, color, sizes, pricing
2. **Logo Presets** - Quick select for common logo configurations
3. **Custom Color Picker** - Full color names with swatch images from SanMar API
4. **Extended Size Popup** - Click "+" in XXXL column to add XS, 3XL-6XL, OSFA, etc.
5. **Child Row System** - Extended sizes create child rows with upcharge pricing
6. **Real-time Pricing** - Updates as quantities change
7. **Quote Saving** - Save to Caspio database with quote ID

---

## Complete ShopWorks Size Translation System

### Size Column Mapping (6 Slots)

| Column | Name | Sizes | Suffix | Notes |
|--------|------|-------|--------|-------|
| Size01 | S | S, SM, SMALL | (none) | Standard |
| Size02 | M | M, MD, MED, MEDIUM | (none) | Standard |
| Size03 | L | L, LG, LARGE | (none) | Standard |
| Size04 | XL | XL, X-LARGE, XLARGE | (none) | Standard |
| Size05 | 2XL | 2XL, XXL, 2X | `_2X` | Extended |
| Size06 | Other | **Everything else** | Various | Catch-all |

### Complete SIZE_TO_SUFFIX Mapping (47 Sizes)

```javascript
const SIZE_TO_SUFFIX = {
    // Standard sizes (no suffix) - Size01-04
    'S': '', 'M': '', 'L': '', 'XL': '',

    // 2XL - Size05
    '2XL': '_2X',

    // Extended large - Size06
    '3XL': '_3X', '4XL': '_4X', '5XL': '_5X', '6XL': '_6X',
    '7XL': '_7XL', '8XL': '_8XL', '9XL': '_9XL', '10XL': '_10XL',

    // Extra small - Size06
    'XS': '_XS', 'XXS': '_XXS', '2XS': '_2XS', 'XXL': '_XXL',

    // One-size options - Size06
    'OSFA': '_OSFA',  // One Size Fits All (beanies, caps, bags)
    'OSFM': '_OSFM',  // One Size Fits Most

    // Size combinations - Size06
    'S/M': '_S/M', 'M/L': '_M/L', 'L/XL': '_L/XL',
    'XS/S': '_XS/S', 'X/2X': '_X/2X', 'S/XL': '_S/XL',

    // Tall sizes - Size06
    'LT': '_LT', 'XLT': '_XLT', '2XLT': '_2XLT', '3XLT': '_3XLT',
    '4XLT': '_4XLT', '5XLT': '_5XLT', '6XLT': '_6XLT',
    'ST': '_ST', 'MT': '_MT', 'XST': '_XST',

    // Youth sizes - Size06
    'YXS': '_YXS', 'YS': '_YS', 'YM': '_YM', 'YL': '_YL', 'YXL': '_YXL',

    // Toddler sizes - Size06
    '2T': '_2T', '3T': '_3T', '4T': '_4T', '5T': '_5T', '5/6T': '_5/6T', '6T': '_6T',

    // Big sizes - Size06
    'LB': '_LB', 'XLB': '_XLB', '2XLB': '_2XLB'
};
```

### Size Categories Summary

| Category | Sizes | Column | Count |
|----------|-------|--------|-------|
| **Standard** | S, M, L, XL | 01-04 | 4 |
| **Extended Large** | 2XL, 3XL, 4XL, 5XL, 6XL, 7XL, 8XL, 9XL, 10XL | 05-06 | 9 |
| **Extra Small** | XS, XXS, 2XS, XXL | 06 | 4 |
| **One-Size** | OSFA, OSFM | 06 | 2 |
| **Combos** | S/M, M/L, L/XL, XS/S, X/2X, S/XL | 06 | 6 |
| **Tall** | LT, XLT, 2XLT, 3XLT, 4XLT, 5XLT, 6XLT, ST, MT, XST | 06 | 10 |
| **Youth** | YXS, YS, YM, YL, YXL | 06 | 5 |
| **Toddler** | 2T, 3T, 4T, 5T, 5/6T, 6T | 06 | 6 |
| **Big** | LB, XLB, 2XLB | 06 | 3 |

**Total: 49 sizes**

---

## OSFA-Only Products (CRITICAL)

### The Problem
For products with ONLY OSFA available (beanies, caps, bags, some accessories):
- OSFA is the **BASE size**, not an upcharge
- Should NOT create a child row
- Quantity goes directly in the parent row

### Examples
| Product | Type | Available Sizes | OSFA Treatment |
|---------|------|-----------------|----------------|
| CP90 | Beanie | OSFA only | Parent row, no child |
| CP91 | Beanie | OSFA only | Parent row, no child |
| CP80 | Cap | OSFA only | Parent row, no child |
| NE1000 | Cap | S/M, L/XL | Creates child rows |
| PC61 | T-Shirt | S-XL, 2XL, 3XL, 4XL | Child row if 3XL+ used |
| J790 | Jacket | S-XL, 2XL, 3XL, 4XL | Child row if 3XL+ used |

### Detection Logic (Implemented)
```javascript
// Check if OSFA-only product
const availableSizes = JSON.parse(popup.dataset.availableSizes || '[]');
const isOSFAOnly = availableSizes.length === 1 && availableSizes[0] === 'OSFA';

if (isOSFAOnly) {
    // Put qty in parent row, don't create child
    parentRow.dataset.osfaQty = qty;
    parentRow.dataset.isOsfaOnly = 'true';
    document.getElementById(`row-qty-${rowId}`).textContent = qty;
} else {
    // Normal extended size handling with child rows
    createOrUpdateExtendedChildRow(rowId, size, qty);
}
```

---

## Child Row System

### When to Create Child Rows
Child rows are created for sizes that have **upcharges** relative to the base product:
- 3XL, 4XL, 5XL, 6XL+ (larger sizes cost more)
- XS (sometimes has upcharge)
- Combo sizes (S/M, L/XL) for structured caps

### When NOT to Create Child Rows
- Standard sizes (S-XL) go in parent row size inputs
- 2XL goes in parent row (Size05 column)
- **OSFA for OSFA-only products** - it's the base size

### Child Row Structure
```javascript
childRowMap = {
    parentRowId: {
        '3XL': childRowId1,
        '4XL': childRowId2,
        'S/M': childRowId3,  // For combo size caps
        // ...
    }
}
```

---

## Color Handling (Two-Field System)

### Fields from SanMar API
| Field | Purpose | Example | Used For |
|-------|---------|---------|----------|
| `COLOR_NAME` | Display | "Brilliant Orange" | UI, customer quotes |
| `CATALOG_COLOR` | API | "BrillOrng" | Inventory, ShopWorks |
| `COLOR_SQUARE_IMAGE` | Swatch URL | https://... | Visual display |
| `HEX_CODE` | Fallback | "#FF6600" | When no swatch image |

### Custom Color Picker
Replaced standard `<select>` with custom dropdown showing:
- Full color names (no truncation)
- Swatch images from `COLOR_SQUARE_IMAGE`
- Fallback to `HEX_CODE` background

---

## Pricing Flow

1. **Base Price**: From embroidery pricing matrix
2. **Size Upcharges**: Extended sizes (3XL+) have additional costs
3. **Stitch Count**: Affects per-piece price
4. **Location Count**: Multiple logo locations increase price
5. **Quantity Breaks**: Volume discounts applied

---

## Known Issues / Fixes Applied

### 1. Truncated Color Names (FIXED)
- **Problem**: Standard `<select>` truncated long color names
- **Solution**: Custom color picker with full names and swatches

### 2. Duplicate Style Pricing (FIXED)
- **Problem**: Same style in multiple colors - only first row got pricing
- **Solution**: Changed selector to match by BOTH style AND catalogColor

### 3. OSFA Not Recognized (FIXED)
- **Problem**: OSFA wasn't in the extended size arrays
- **Solution**: Added 'OSFA' to `SIZE06_EXTENDED_SIZES` and suffix mapping

### 4. OSFA Creating Child Rows (FIXED)
- **Problem**: OSFA-only products incorrectly create child rows
- **Solution**: Detect OSFA-only and put qty in parent row

### 5. Non-Standard Sizes Not Displaying Prices (FIXED - Jan 2026)
- **Problem**: Toddler (2T-6T), youth (YXS-YXL), tall (LT-6XLT) sizes showed "-" for price
- **Root Cause**: Regex at line 3126 only matched `/(\dXL|XS)/g` - missing toddler, youth, tall, etc.
- **Solution**: Build regex dynamically from `SIZE06_EXTENDED_SIZES` array
- **Affected Products**: CAR54T (toddler), PC61Y (youth), tall shirts, etc.
- **File**: `quote-builders/embroidery-quote-builder-new.html:3126`

### 6. Cap Type False Positive (FIXED - Jan 2026)
- **Problem**: CAR54T detected as "Cap" because it starts with "C"
- **Root Cause**: `style.startsWith('C')` was too broad in detectItemType()
- **Solution**: Changed to `/^C[P0-9]/` to match only CP and C+digit cap prefixes
- **File**: `shared_components/js/embroidery-quote-pricing.js:253`

### 7. Tall/Youth/Toddler Part Number Suffix Missing (FIXED - Jan 2026)
- **Problem**: PC54T child rows showed `PC54T` instead of `PC54T_LT`, `PC54T_XLT`, etc.
- **Root Cause**: `getPartNumber()` used incomplete `SIZE_MODIFIERS` (only had XL sizes)
- **Solution**: Changed to use `SIZE_TO_SUFFIX` which has ALL 47 size suffixes
- **Affected Products**: PC54T (tall), CAR54T (toddler), PC61Y (youth), etc.
- **File**: `quote-builders/embroidery-quote-builder-new.html:2743`

### 8. Tall/Youth/Toddler Products Show Irrelevant Size Columns (FIXED - Jan 2026)
- **Problem**: PC54T showed S, M, L, XL columns with 0s - confusing since sizes don't exist
- **Solution**: Added `detectProductTypeAndAdjustUI()` function that:
  - Fetches available sizes from API after color selection
  - Detects tall-only, youth-only, or toddler-only products
  - Grays out unavailable S/M/L/XL columns with "N/A" placeholder
  - Focuses cursor on extended size picker instead
- **File**: `quote-builders/embroidery-quote-builder-new.html:2341` (function), `:2453` (call)

---

## API Endpoints Used

| Endpoint | Purpose |
|----------|---------|
| `/api/sanmar-products/styles` | Get product details |
| `/api/sanmar-products/colors` | Get available colors |
| `/api/sanmar-shopworks/import-format` | Get available sizes (Size01-06) |
| `/api/embroidery-pricing` | Get stitch-based pricing |
| `/api/quote_sessions` | Save/load quotes |
| `/api/quote_items` | Save/load quote line items |

---

## File References

| File | Purpose |
|------|---------|
| `quote-builders/embroidery-quote-builder-new.html` | Main quote builder |
| `shared_components/js/embroidery-pricing-service.js` | Pricing calculations |
| `Python Inksoft/Inksoft_Size_Translation_Import.csv` | Size mapping reference |
| `Python Inksoft/web/transform.py` | SIZE_MODIFIERS dictionary |
| `Python Inksoft/json_transform_gui.py` | get_size_column() function |
| `memory/EMBROIDERY_QUOTE_BUILDER.md` | This documentation |

---

## Development Notes

### Testing OSFA Products
Use these styles for testing OSFA behavior:
- **CP90** - Port & Company Beanie (OSFA only) ✅
- **CP91** - Port & Company Beanie (OSFA only) ✅
- **CP80** - Port Authority Cap (OSFA only)
- **BG100** - Port Authority Tote (OSFA only)

### Testing Combo Size Products
Use these styles for testing S/M, L/XL combo sizes:
- **NE1000** - New Era Structured Cap (S/M, L/XL)
- Other structured/fitted caps with combo sizes

### Testing Extended Sizes
Use these styles for testing child row behavior:
- **PC61** - Essential Tee (has 3XL, 4XL)
- **J790** - Glacier Jacket (has 3XL, 4XL)
- **18500** - Gildan Hoodie (has 3XL, 4XL, 5XL)

### Testing Youth/Toddler/Tall Sizes
- **PC61Y** - Youth Tee (YS, YM, YL, YXL)
- **Tall shirts** - LT, XLT, 2XLT sizes
- **Toddler items** - 3T, 4T, 5T sizes
