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

### Testing Cap Products
- **C112** - Port & Company Trucker Cap (triggers cap warning)
- **112** - Richardson Trucker (triggers cap warning)
- **CP80** - Port Authority Cap (triggers cap warning)
- **NE1000** - New Era Cap (triggers cap warning)

---

## Additional Known Issues / Fixes Applied

### 9. Cap Products Warning (FIXED - Jan 2026)
- **Problem**: Caps (C112, CP80, NE1000) allowed without warning in garment builder
- **Solution**: Added `isCapProduct()` detection with warning toast
- **Behavior**: Warning shown but entry allowed (user may need to quote cap embroidery)
- **Patterns**: `/^C[P0-9]/`, `NE*` prefix, title keywords (CAP, HAT, BEANIE, SNAPBACK)
- **File**: `quote-builders/embroidery-quote-builder-new.html:2322-2325`

### 10. Extended Sizes Fallback Fixed (FIXED - Jan 2026)
- **Problem**: API failure/no data returned ALL 47 sizes instead of empty
- **Root Cause**: Fallback at lines 1581, 1635 returned `SIZE06_EXTENDED_SIZES`
- **Solution**: Changed fallback to `return []` to trigger "No sizes available" UI
- **File**: `quote-builders/embroidery-quote-builder-new.html:1581,1635`

### 11. Search Box Improvements (FIXED - Jan 2026)
- **Problem**: Typing "J790" showed stale results from "J7" search
- **Solution**: Reduced debounce (200ms → 150ms), added result ranking, keyboard navigation
- **Features**: Text highlighting, 10 result limit, Arrow key navigation
- **File**: `quote-builders/embroidery-quote-builder-new.html:2038-2170`

### 12. Child Row Description Format (FIXED - Jan 2026)
- **Problem**: Child rows showed "2XL upcharge" instead of product name
- **Solution**: Changed to "Product Name - Size" format with bold size
- **File**: `quote-builders/embroidery-quote-builder-new.html:2899`

### 13. Duplicate Style in Description (FIXED - Jan 2026)
- **Problem**: Style appeared 3 times in description (API returns embedded style)
- **Solution**: Added `cleanProductTitle()` to strip style from API title
- **File**: `quote-builders/embroidery-quote-builder-new.html:2384-2397`

### 14. OSFA & Dynamic Size Columns (FIXED - Jan 2026)
- **Problem**: OSFA products (caps, bags, beanies) showed irrelevant S/M/L/XL/2XL columns
- **Solution**: Added size category detection and dynamic column UI after color selection
- **Size Categories**:
  | Category | Products | UI Treatment |
  |----------|----------|--------------|
  | `osfa-only` | Caps, bags, beanies | Single Qty input, size columns disabled |
  | `combo-only` | Fitted caps (NE1000) | Columns show S/M, L/XL |
  | `youth-only` | Youth products (PC61Y) | Columns show YS, YM, YL, YXL |
  | `toddler-only` | Toddler items (CAR54T) | Columns show 2T, 3T, 4T, 5T |
  | `tall-only` | Tall shirts (PC54T) | Columns show LT, XLT, 2XLT |
  | `standard` | Regular garments | Normal S/M/L/XL/2XL + extended popup |
- **Key Functions**:
  - `analyzeSizeCategory()` - Classifies product into category
  - `updateRowForSizeCategory()` - Updates UI based on category
  - `detectAndAdjustSizeUI()` - Main detection called after color selection
  - `extractAllSizes()` - Gets all sizes from Size01-06 fields
- **Pricing**: No change needed - relative upcharge model already handles non-standard base sizes
- **File**: `quote-builders/embroidery-quote-builder-new.html:2436-2716`

---

## Testing OSFA & Dynamic Size Products

### OSFA-Only Products (Single Qty Input)
- **CP90, CP91** - Port & Company Beanies
- **C112, 112** - Richardson Trucker Caps
- **BG100** - Port Authority Tote Bag

### Combo Size Products (S/M, L/XL Columns)
- **NE1000** - New Era Fitted Cap

### Youth-Only Products (YS, YM, YL, YXL Columns)
- **PC61Y** - Youth Essential Tee

### Toddler-Only Products (2T-6T Columns)
- **CAR54T** - Toddler Core Cotton Tee

### Tall-Only Products (LT, XLT Columns)
- **PC54T** - Tall Essential Tee

---

## SKU Validation Service (Added Jan 2026)

### Overview
New service for validating SKUs against ShopWorks and transforming SanMar sizes to ShopWorks format.

**File**: `shared_components/js/sku-validation-service.js`

### Key Features
1. **SanMar → ShopWorks SKU Transformation**
   - Standard sizes (S, M, L, XL) use BASE SKU only
   - Extended sizes get suffix: `_2X`, `_3X`, `_4X`, etc.
   - **CRITICAL**: ShopWorks uses `_2X` NOT `_2XL`

2. **SKU Validation After Color Selection**
   - Validates which sizes exist for style+color combination
   - Disables unavailable size inputs with "N/A" placeholder
   - Shows visual indicators for valid/invalid sizes

3. **Caching**
   - 5-minute cache duration
   - Reduces API calls for repeated products

### ShopWorks Suffix Format (Verified from shopworksparts.csv)

| SanMar Size | ShopWorks Suffix | Example |
|-------------|------------------|---------|
| S, M, L, XL | (none) | PC54 |
| XS | _XS | PC54_XS |
| 2XL | **_2X** | PC54_2X |
| 3XL | **_3X** | PC54_3X |
| 4XL | _4X | PC54_4X |
| OSFA | _OSFA | C950_OSFA |
| S/M, M/L, L/XL | _S/M, etc. | C808_S/M |
| LT, XLT | _LT, _XLT | PC54T_LT |

### Usage Example
```javascript
const skuService = new SKUValidationService();

// Transform size to SKU
const sku = skuService.sanmarToShopWorksSKU('PC54', '2XL');
// Returns: 'PC54_2X'

// Get valid sizes for product/color
const { validSizes, skuMap } = await skuService.getValidSKUs('PC54', 'Ash');
// validSizes: ['S', 'M', 'L', 'XL', '2XL', '3XL']
```

---

## Per-Size Line Items (Added Jan 2026)

### Overview
New method for generating line items in ShopWorks PUSH API format - one line item per size per color.

**File**: `shared_components/js/embroidery-quote-pricing.js` - `generateLineItems()` method

### Line Item Format (ShopWorks PUSH API Pattern)

```javascript
{
    partNumber: 'PC54',           // BASE only - no suffix
    inventorySku: 'PC54_2X',      // Full SKU with suffix
    description: 'P&C PC54 Ash | LC 8K',
    color: 'Ash',                 // CATALOG_COLOR for API
    displayColor: 'Athletic Heather',  // COLOR_NAME for display
    size: '2XL',
    quantity: 3,
    unitPrice: 28.00,
    total: 84.00,
    logoPosition: 'LC',
    stitchCount: 8000,
    hasUpcharge: true,
    upchargeAmount: 2.00
}
```

### Key Principles (from 3-Day Tees Pattern)
1. **partNumber = BASE only** - ShopWorks handles suffix via size field
2. **One line item per size** - Not grouped by upcharge amount
3. **Use CATALOG_COLOR** - Not COLOR_NAME for API queries
4. **Description format**: `Brand Style Color | LogoPosition StitchK`

### Integration Verification (Jan 2026)

The complete code path for line item generation:

| Step | File | Line | Code |
|------|------|------|------|
| 1 | embroidery-quote-builder-new.html | 1621 | `<script src="/shared_components/js/sku-validation-service.js">` |
| 2 | embroidery-quote-pricing.js | 512 | `skuService = window.skuValidationService` |
| 3 | embroidery-quote-pricing.js | 558-560 | `skuService.sanmarToShopWorksSKU(style, size)` |
| 4 | sku-validation-service.js | 206-223 | Returns suffix from 190+ SIZE_TO_SUFFIX mapping |

**Verified:** All 4,249 styles and 242 sizes generate correct ShopWorks SKUs.

### Invoice Generator Support
**File**: `shared_components/js/embroidery-quote-invoice.js` - `generatePerSizeProductsTable()` method

- Groups line items by product (partNumber + color)
- Sorts sizes in logical order
- Shows upcharge indicators for extended sizes
- Subtotal per product group

---

## Visual Grouping CSS (Added Jan 2026)

### Parent/Child Row Styling
```css
/* Parent row styling */
.product-table tr.parent-row {
    border-left: 4px solid var(--nwca-blue);
}

/* Child row styling */
.product-table tr.child-row {
    border-left: 4px solid var(--nwca-blue);
}

/* Tree structure indicator */
.product-table tr.child-row td:first-child::before {
    content: "└";
    color: #999;
    margin-right: 6px;
}

/* Size availability states */
.size-input.size-available { border-color: #22c55e; }
.size-input.size-unavailable { background: #f0f0f0; }

/* Inventory indicators */
.size-input.inventory-ok { border-left: 3px solid #22c55e; }
.size-input.inventory-low { border-left: 3px solid #f59e0b; }
.size-input.inventory-out { border-left: 3px solid #ef4444; }
```

---

## Pants & Shorts Products - Updated Jan 2026

### Overview
Industrial work pants and shorts use specialized sizing instead of standard S/M/L/XL. The quote builder now supports all 16 PT* styles with three different size patterns:

### PT* Styles Supported (16 Total)
| Style | Size Pattern | Example Sizes |
|-------|-------------|---------------|
| **PT20, PT26, PT60, PT88** | 4-digit waist+inseam | 3032 (30x32) |
| **PT66** | Waist-only (W*) | W30, W32, W34 |
| **PT333, LPT333** | Standard extended | S-4XL, XS, XXL |
| **PT38, PT390, PT400, PT42-PT49** | OSFA only | One size |

### Size Format - 4-Digit (Pants)
- **Format**: First 2 digits = waist, last 2 = inseam
- Example: `3032` = waist 30, inseam 32
- Display format: `30x32` (human readable)
- SKU format: `PT20_3032` (base + underscore + code)

### Size Format - Waist-Only (Shorts)
- **Format**: W + 2-digit waist (e.g., W30, W32)
- Display format: `Waist 30` (human readable)
- SKU format: `PT66_W30` (base + underscore + size)
- Category: `shorts` (detected when >50% of sizes match W##)

### Available Sizes (PT20 Example)
| Waist | Inseams Available |
|-------|-------------------|
| 28, 29 | 28, 30 |
| 30-36 | 28, 30, 32, 34, 37 |
| 38-42 | 30, 32, 34 |
| 44-60 | 30, 32, 34 (varies) |

### UI Implementation
1. **Size Category**: `pants` (detected when >50% of sizes are 4-digit)
2. **Column Treatment**: All S/M/L/XL/2XL columns disabled (show N/A)
3. **Size Picker**: Click "+" in XXXL column opens popup
4. **Grouped by Waist**: Collapsible sections for each waist size
5. **Common Waists Expanded**: 30, 32, 34, 36 open by default

### Key Functions
- `analyzeSizeCategory()` - Returns `pants` category for waist/inseam products
- `updateRowForSizeCategory()` - Disables columns, sets up picker button
- `openExtendedSizePopup()` - Renders grouped waist/inseam picker
- `toggleWaistGroup()` - Expands/collapses waist sections
- `createChildRow()` - Handles pants size display format (30x32)
- `getPartNumber()` - Generates SKU with pants suffix

### Pricing Flow
1. API returns prices keyed by 4-digit code (e.g., `3032: 19.00`)
2. Filter out $0 discontinued sizes before finding base price
3. Standard embroidery upcharge applied on top

### Testing
```
Style: PT20
Color: Black
Available sizes: 70+ waist/inseam combinations
```

---

## Known Issues / Fixes Applied (continued)

### 15. Tall Product Column Headers (FIXED - Jan 2026)
- **Problem**: PC90HT showed "LT" and "XLT" text in parent row columns
- **Root Cause**: `updateColumnLabel()` was being called for tall-only products
- **Solution**: Disabled all columns for tall products like OSFA, no label updates
- **File**: `quote-builders/embroidery-quote-builder-new.html:2768-2795`

### 16. PT20 Pants Support (ADDED - Jan 2026)
- **Problem**: PT20 Industrial Work Pant was blocked, showed blank
- **Solution**: Added full pants support with waist/inseam picker UI
- **Features**: Grouped by waist, 3-column layout, collapsible sections
- **File**: `quote-builders/embroidery-quote-builder-new.html:2718-2746`

### 17. Pants Pricing Using $0 Sizes (FIXED - Jan 2026)
- **Problem**: Calculator picked $0 discontinued sizes as base price
- **Solution**: Filter `price > 0` before finding lowest base price
- **File**: `shared_components/js/embroidery-quote-pricing.js:354-364`

### 18. Pants Child Row Prices Missing (FIXED - Jan 2026)
- **Problem**: PT20 child rows showed "-" instead of unit prices
- **Root Cause**: Regex didn't include 4-digit pants pattern
- **Solution**: Added `\\d{4}` to extended size regex
- **File**: `quote-builders/embroidery-quote-builder-new.html:4104`

### 19. Pants Modal Too Narrow (FIXED - Jan 2026)
- **Problem**: 3rd column of waist/inseam sizes cut off in popup
- **Solution**: Increased `.size-popup` width from 340px to 480px
- **File**: `quote-builders/embroidery-quote-builder-new.html:1105-1106`

### 20. PT66 Shorts Support (ADDED - Jan 2026)
- **Problem**: PT66 cargo shorts used waist-only sizing (W30, W32) not handled
- **Solution**: Added `shorts` category detection and UI handling
- **Features**: Detects W## pattern, displays as "Waist 30", simple flat list UI
- **File**: `quote-builders/embroidery-quote-builder-new.html:2752-2764`

### 21. SIZE_TO_SUFFIX Expansion (ADDED - Jan 2026)
- **Problem**: 97 size values from SanMar CSV were unmapped
- **Solution**: Added comprehensive size mappings to sku-validation-service.js
- **Added**: 7XL-10XL, W30-W50 (waist), XXL/XXXL (aliases), MT/ST/XST (tall),
  Regular/Long/Short/Petite variants (SR, ML, XLS, LP, etc.), 6T, 06M, 5/6T,
  Numeric belt/shoe sizes, and more
- **File**: `shared_components/js/sku-validation-service.js:26-192`
- **Validation**: All 169,041 CSV rows now have mapped sizes
