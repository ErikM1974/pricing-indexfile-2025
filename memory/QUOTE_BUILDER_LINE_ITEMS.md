# Quote Builder Line Items Pattern

This document defines the standard pattern for handling line items (parent/child rows) in quote builders (Embroidery, DTG, DTF, etc.).

## Parent vs Child Row Pattern

### Parent Rows
- Created when user adds a product to the quote
- Contains standard sizes: **S, M, L/LG, XL**
- Has its own color selector
- Displays aggregated qty and base unit price
- Stores all product data in `dataset` attributes

### Child Rows
- Created automatically when user enters qty for **extended sizes**
- Extended sizes with surcharges: **XS, XXL/2XL, 3XL, 4XL, 5XL, 6XL**
- Has its own color selector (inherits parent color initially)
- Displays individual qty and size-specific unit price
- Linked to parent via `data-parent-row-id` attribute

### Why Separate Rows?
Extended sizes have **different pricing** due to surcharges. Separate rows allow:
1. Clear price visibility per size
2. Individual color selection per size
3. Proper line items for orders/invoices
4. Accurate inventory tracking per SKU

---

## Size Column Mapping

Parent row columns: `[Style] [Description] [Color] [S] [M] [LG] [XL] [XXL] [XXXL/Other] [Qty] [Price]`

| Child Size | Column Position | Column Name |
|------------|-----------------|-------------|
| XXL/2XL    | 5th size column | XXL column  |
| XS         | 6th size column | XXXL/Other  |
| 3XL        | 6th size column | XXXL/Other  |
| 4XL        | 6th size column | XXXL/Other  |
| 5XL        | 6th size column | XXXL/Other  |
| 6XL        | 6th size column | XXXL/Other  |

### Implementation
```javascript
// In createChildRow():
const isXXL = size === 'XXL';

// XXL column (5th) - enabled only for XXL
<td><input ... ${isXXL ? 'enabled with qty' : 'disabled'}></td>

// XXXL/Other column (6th) - enabled for all other extended sizes
<td><input ... ${!isXXL ? 'enabled with qty' : 'disabled'}></td>
```

---

## Part Number Suffixes

| Size | Suffix | Example |
|------|--------|---------|
| XS   | `_XS`  | PC54_XS |
| XXL/2XL | `_2X` | PC54_2X |
| 3XL  | `_3X`  | PC54_3X |
| 4XL  | `_4X`  | PC54_4X |
| 5XL  | `_5X`  | PC54_5X |
| 6XL  | `_6X`  | PC54_6X |

### Mapping Constant
```javascript
const SIZE_TO_SUFFIX = {
    'XS': '_XS',
    'XXL': '_2X',
    '2XL': '_2X',
    'XXXL': '_3X',
    '3XL': '_3X',
    '4XL': '_4X',
    '5XL': '_5X',
    '6XL': '_6X'
};
```

---

## Required Event Handlers

**ALL size inputs must have:**

```javascript
// Parent row size inputs (in addProductRow)
<input type="number" class="cell-input size-input"
       data-size="XXL"
       onchange="onSizeChange(${rowId})"
       onkeydown="handleCellKeydown(event, this)"
       disabled>  // Disabled until color selected

// Child row size inputs (in createChildRow)
<input type="number" class="cell-input size-input extended-size-qty"
       data-size="${size}"
       value="${qty}"
       onchange="onChildSizeChange(${childRowId}, ${parentRowId}, '${size}')"
       onkeydown="handleCellKeydown(event, this)">
```

### Key Functions
- `onSizeChange(rowId)` - Handles parent row qty changes, auto-creates child rows for XXL
- `onChildSizeChange(childRowId, parentRowId, size)` - Handles child row qty changes
- `handleCellKeydown(event, input)` - Keyboard navigation (Tab, Enter, arrows)

---

## Color Inheritance

### On Child Row Creation
1. Child inherits parent's current color
2. Child gets its own color picker populated with same options as parent
3. `dataset.colorManuallySet = 'false'` initially

### Color Cascade Behavior
- When parent color changes AND child has `colorManuallySet = 'false'`
  - Child color updates to match parent
- When user manually changes child color:
  - Set `colorManuallySet = 'true'`
  - Child keeps its color even if parent changes

### Required Color Data
```javascript
// Parent row must store:
row.dataset.color = 'Kelly';           // Display name
row.dataset.catalogColor = 'Kelly';     // API/inventory lookup
row.dataset.swatchUrl = 'https://...';  // Swatch image
row.dataset.hex = '#00FF00';            // Fallback color
row.dataset.colors = JSON.stringify([...]); // All available colors
```

---

## Dataset Attributes Required on Parent Row

| Attribute | Purpose | Example |
|-----------|---------|---------|
| `dataset.styleNumber` | Base style for part number | `'PC54'` |
| `dataset.productName` | Product description | `'Port & Co Core Cotton Tee'` |
| `dataset.baseCost` | Base cost for pricing | `'5.50'` |
| `dataset.sizeUpcharges` | JSON object of surcharges | `'{"XXL": 2.00, "3XL": 4.00}'` |
| `dataset.colors` | JSON array of color options | `'[{COLOR_NAME, CATALOG_COLOR, ...}]'` |
| `dataset.color` | Current display color | `'Kelly'` |
| `dataset.catalogColor` | Current API color | `'Kelly'` |
| `dataset.swatchUrl` | Current swatch image | `'https://...'` |
| `dataset.hex` | Fallback hex color | `'#00FF00'` |

---

## Auto-Create Child Row for XXL

When user enters qty in parent's XXL column:

```javascript
function onSizeChange(rowId) {
    const xxlInput = row.querySelector('[data-size="XXL"]');
    const qty = parseInt(xxlInput.value) || 0;

    if (qty > 0 && !childRowMap[rowId]?.['XXL']) {
        // Create child row for XXL
        createChildRow(rowId, 'XXL', qty);

        // Disable parent's XXL input (child now owns it)
        xxlInput.disabled = true;
        xxlInput.style.background = '#f5f5f5';
    }
}
```

---

## Checklist for New Quote Builders

- [ ] All size inputs have `onchange` handlers
- [ ] All size inputs have `onkeydown` for keyboard navigation
- [ ] `addProductRow()` stores all required dataset attributes
- [ ] Color selection updates `row.dataset.*` attributes
- [ ] XXL auto-creates child row when qty entered
- [ ] Child row column layout is conditional (XXL vs other sizes)
- [ ] Part numbers use correct suffixes
- [ ] Child rows inherit parent color
- [ ] Child color picker supports independent selection
- [ ] Row ID counter is shared between parent/child creation

---

## Reference Implementations

| Calculator | File Location |
|------------|---------------|
| Embroidery | `/quote-builders/embroidery-quote-builder.html` |
| DTG | `/quote-builders/dtg-quote-builder.html` |
| DTF | `/quote-builders/dtf-quote-builder.html` |
