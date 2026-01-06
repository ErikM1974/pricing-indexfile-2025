# Quote Builder Template - Line Item Consistency Guide

Use this template when creating any new quote builder to ensure consistency across Embroidery, Screen Print, DTG, and DTF builders.

## Line Item Row Structure

```html
<tr id="row-${rowId}" data-row-id="${rowId}" data-style="${style}"
    data-color="${color}" data-catalog-color="${catalogColor}">

    <!-- Style Column -->
    <td>
        <input type="text" class="cell-input style-input"
               placeholder="Style #" data-field="style"
               onchange="onStyleChange(this, ${rowId})"
               onkeydown="handleCellKeydown(event, this)">
    </td>

    <!-- Description Column -->
    <td class="desc-cell">
        <div class="desc-row">
            <input type="text" class="cell-input desc-input"
                   placeholder="(auto)" data-field="description" readonly>
        </div>
        <div class="pricing-breakdown" id="breakdown-${rowId}"></div>
    </td>

    <!-- Color Picker Column -->
    <td>
        <div class="color-picker-wrapper" data-row-id="${rowId}">
            <div class="color-picker-selected disabled"
                 onclick="toggleColorPicker(${rowId})"
                 tabindex="0"
                 onkeydown="handleColorPickerKeydown(event, ${rowId})">
                <span class="color-swatch empty"></span>
                <span class="color-name placeholder">Select color...</span>
                <i class="fas fa-chevron-down picker-arrow"></i>
            </div>
            <div class="color-picker-dropdown hidden" id="color-dropdown-${rowId}"></div>
        </div>
    </td>

    <!-- Size Columns (S, M, L, XL, 2XL) -->
    <td><input type="number" class="cell-input size-input" data-size="S"
               min="0" placeholder="0" onchange="onSizeChange(${rowId})"
               onkeydown="handleCellKeydown(event, this)" disabled></td>
    <td><input type="number" class="cell-input size-input" data-size="M"
               min="0" placeholder="0" onchange="onSizeChange(${rowId})"
               onkeydown="handleCellKeydown(event, this)" disabled></td>
    <td><input type="number" class="cell-input size-input" data-size="L"
               min="0" placeholder="0" onchange="onSizeChange(${rowId})"
               onkeydown="handleCellKeydown(event, this)" disabled></td>
    <td><input type="number" class="cell-input size-input" data-size="XL"
               min="0" placeholder="0" onchange="onSizeChange(${rowId})"
               onkeydown="handleCellKeydown(event, this)" disabled></td>
    <td><input type="number" class="cell-input size-input" data-size="2XL"
               min="0" placeholder="0" onchange="onSizeChange(${rowId})"
               onkeydown="handleCellKeydown(event, this)" disabled></td>

    <!-- Extended Sizes Column -->
    <td><input type="text" class="cell-input size-input xxxl-picker-btn"
               data-size="3XL" placeholder="+" readonly
               onclick="openExtendedSizePopup(${rowId})"
               onkeydown="if(event.key==='Enter'){openExtendedSizePopup(${rowId})}"
               disabled></td>

    <!-- Quantity Display -->
    <td class="cell-qty" id="row-qty-${rowId}">0</td>

    <!-- Price Display -->
    <td class="cell-price" id="row-price-${rowId}">-</td>

    <!-- Delete Button -->
    <td class="cell-actions">
        <button class="btn-delete-row" onclick="deleteRow(${rowId})">
            <i class="fas fa-times"></i>
        </button>
    </td>
</tr>
```

## Required CSS Classes

```css
/* Cell Inputs */
.cell-input {
    height: 36px;
    border: none;
    background: transparent;
    font-size: 13px;
    padding: 6px 10px;
}

.style-input {
    text-transform: uppercase;
    font-weight: 600;
}

.desc-input {
    color: #6b7280;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.size-input {
    text-align: center;
    width: 100%;
}

/* Hide number spinners */
.size-input::-webkit-inner-spin-button,
.size-input::-webkit-outer-spin-button {
    -webkit-appearance: none;
    margin: 0;
}
.size-input {
    -moz-appearance: textfield;
}

/* Disabled state */
.size-input:disabled {
    background: #f3f4f6;
    color: #999;
    cursor: not-allowed;
}

/* Description wrapper */
.desc-row {
    display: flex;
    align-items: center;
    gap: 8px;
}

.pricing-breakdown {
    font-size: 11px;
    color: #666;
    margin-top: 4px;
    display: none;
}

.pricing-breakdown.show {
    display: block;
}

/* Quantity/Price cells */
.cell-qty {
    background: #eff6ff;
    color: #1e40af;
    font-weight: 600;
    text-align: center;
}

.cell-price {
    background: #d1fae5;
    color: #065f46;
    font-weight: 600;
    text-align: center;
}
```

## Required JavaScript Functions

### Keyboard Navigation

```javascript
function handleCellKeydown(event, input) {
    const row = input.closest('tr');
    const tbody = document.getElementById('product-tbody');
    const rows = Array.from(tbody.querySelectorAll('tr'));
    const currentRowIndex = rows.indexOf(row);

    if (event.key === 'Enter' || event.key === 'ArrowDown') {
        event.preventDefault();
        // Move to same column in next row
        if (currentRowIndex < rows.length - 1) {
            const nextRow = rows[currentRowIndex + 1];
            const size = input.dataset.size;
            const nextInput = nextRow.querySelector(`[data-size="${size}"]:not([disabled])`);
            if (nextInput) {
                nextInput.focus();
                nextInput.select();
            }
        }
    } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        // Move to same column in previous row
        if (currentRowIndex > 0) {
            const prevRow = rows[currentRowIndex - 1];
            const size = input.dataset.size;
            const prevInput = prevRow.querySelector(`[data-size="${size}"]:not([disabled])`);
            if (prevInput) {
                prevInput.focus();
                prevInput.select();
            }
        }
    } else if (event.key === 'ArrowRight' && input.selectionStart === input.value.length) {
        // Move to next size column in same row
        const cells = Array.from(row.querySelectorAll('.size-input:not([disabled])'));
        const currentIndex = cells.indexOf(input);
        if (currentIndex < cells.length - 1) {
            event.preventDefault();
            cells[currentIndex + 1].focus();
            cells[currentIndex + 1].select();
        }
    } else if (event.key === 'ArrowLeft' && input.selectionStart === 0) {
        // Move to previous size column in same row
        const cells = Array.from(row.querySelectorAll('.size-input:not([disabled])'));
        const currentIndex = cells.indexOf(input);
        if (currentIndex > 0) {
            event.preventDefault();
            cells[currentIndex - 1].focus();
            cells[currentIndex - 1].select();
        }
    }
}
```

### Color Picker Keyboard

```javascript
function handleColorPickerKeydown(event, rowId) {
    const row = document.getElementById(`row-${rowId}`);
    const dropdown = row.querySelector('.color-picker-dropdown');
    const isOpen = !dropdown.classList.contains('hidden');

    if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        toggleColorPicker(rowId);
    } else if (event.key === 'Escape' && isOpen) {
        event.preventDefault();
        dropdown.classList.add('hidden');
    } else if (event.key === 'ArrowDown' && isOpen) {
        event.preventDefault();
        navigateOptions(dropdown, 1);
    } else if (event.key === 'ArrowUp' && isOpen) {
        event.preventDefault();
        navigateOptions(dropdown, -1);
    } else if (event.key === 'Tab') {
        dropdown.classList.add('hidden');
    }
}
```

### Size Change Handler

```javascript
function onSizeChange(rowId) {
    // Collect quantities from all size inputs
    // Update quantity display
    // Recalculate pricing
}
```

### Color Selection

```javascript
function selectColor(rowId, optionEl) {
    // 1. Get color data from option element
    const colorName = optionEl.dataset.colorName;
    const catalogColor = optionEl.dataset.catalogColor;

    // 2. Update picker display
    // 3. Store in row.dataset
    row.dataset.color = colorName;
    row.dataset.catalogColor = catalogColor;

    // 4. Enable size inputs
    row.querySelectorAll('.size-input').forEach(input => input.disabled = false);

    // 5. Close dropdown
    // 6. Focus first size input
    // 7. Recalculate pricing
}
```

## Required Data Attributes

| Attribute | Purpose | Example |
|-----------|---------|---------|
| `id` | Row element ID | `row-1` |
| `data-row-id` | Unique row identifier | `1` |
| `data-product-id` | Product identifier | `1` |
| `data-style` | Style number | `PC54` |
| `data-color` | Display color name | `Brilliant Orange` |
| `data-catalog-color` | API color code for ShopWorks | `BrillOrng` |
| `data-field` | Field identifier | `style`, `description` |
| `data-size` | Size code | `S`, `M`, `L`, `XL`, `2XL`, `3XL` |

## Checklist for New Quote Builders

- [ ] Row has `id="row-${rowId}"` attribute
- [ ] Row has `data-row-id`, `data-style`, `data-color`, `data-catalog-color`
- [ ] Description field has `.desc-row` wrapper
- [ ] Description field has `placeholder="(auto)"` and `data-field="description"`
- [ ] Description field has `readonly` attribute
- [ ] Pricing breakdown div exists with `id="breakdown-${rowId}"`
- [ ] Color picker has `tabindex="0"` on trigger
- [ ] Color picker has `onkeydown` handler for Enter/Space/Escape
- [ ] Size inputs have `class="cell-input size-input"`
- [ ] Size inputs have `data-size` attribute
- [ ] Size inputs start `disabled`
- [ ] Size inputs enable after color selection
- [ ] Size inputs have `onchange` handler
- [ ] Size inputs have `onkeydown` handler for navigation
- [ ] CSS hides number spinners on size inputs
- [ ] Extended size picker has `xxxl-picker-btn` class
- [ ] Extended size picker responds to Enter key
- [ ] Quantity cell has `cell-qty` class
- [ ] Price cell has `cell-price` class
- [ ] Delete button has `btn-delete-row` class

## Keyboard Navigation Summary

| Key | In Size Input | In Color Picker |
|-----|---------------|-----------------|
| Tab | Next cell | Close dropdown |
| Enter | Next row (same column) | Toggle dropdown |
| Space | (normal input) | Toggle dropdown |
| Escape | (normal input) | Close dropdown |
| Arrow Down | Next row (same column) | Navigate options |
| Arrow Up | Previous row (same column) | Navigate options |
| Arrow Right | Next size column (at end of value) | - |
| Arrow Left | Previous size column (at start of value) | - |

---

**Created:** 2026-01-06
**Based on:** Embroidery, Screen Print, DTG, DTF Quote Builders
