# Quote Builder Best Practices

Copy-paste ready code patterns for building new quote builders. Based on DTF Quote Builder (the most recent and comprehensive implementation).

---

## Quick Reference

| Pattern | Section |
|---------|---------|
| Color Picker | [Section 1](#1-color-picker-implementation) |
| Product Search | [Section 2](#2-product-search-with-exactmatchsearch) |
| Size Upcharges | [Section 3](#3-size-upcharge-lookup) |
| LTM Toggle | [Section 4](#4-ltm-distribution-toggle) |
| Small Qty Handling | [Section 5](#5-small-quantity-handling) |
| API Error Handling | [Section 6](#6-api-error-handling) |
| Keyboard Navigation | [Section 7](#7-keyboard-navigation) |
| Common Bugs | [Section 8](#8-common-bugs-prevention) |

---

## 1. Color Picker Implementation

### HTML Structure (in row template)

```html
<td class="color-col">
    <div class="color-picker-wrapper" data-product-id="${product.id}">
        <div class="color-picker-selected" tabindex="0">
            <span class="color-swatch empty"></span>
            <span class="color-name placeholder">Select color...</span>
            <i class="fas fa-chevron-down picker-arrow"></i>
        </div>
        <div class="color-picker-dropdown hidden" id="color-dropdown-${product.id}">
            ${colorOptionsHTML}
        </div>
    </div>
</td>
```

### Generate Color Options HTML

```javascript
/**
 * Generate color picker options from API color data
 * @param {Array} colors - Array of color objects from API
 * @returns {string} HTML string of color options
 */
generateColorOptionsHTML(colors) {
    if (!colors || colors.length === 0) {
        return '<div class="color-option disabled">No colors available</div>';
    }

    return colors.map(color => {
        // Use COLOR_SQUARE_IMAGE if available, fall back to HEX_CODE
        const imageUrl = color.COLOR_SQUARE_IMAGE || '';
        const hexCode = color.HEX_CODE || '#cccccc';
        const swatchStyle = imageUrl
            ? `background-image: url(${imageUrl})`
            : `background-color: ${hexCode}`;

        return `
            <div class="color-option"
                 data-color="${color.CATALOG_COLOR}"
                 data-display="${color.COLOR_NAME}"
                 data-image="${imageUrl}"
                 data-hex="${hexCode}">
                <span class="option-swatch" style="${swatchStyle}"></span>
                <span class="option-name">${color.COLOR_NAME}</span>
            </div>
        `;
    }).join('');
}
```

### Setup Color Picker Event Handlers

```javascript
/**
 * Initialize color picker functionality for a product row
 * @param {HTMLElement} row - The table row element
 * @param {number} productId - Product ID for this row
 */
setupColorPicker(row, productId) {
    const wrapper = row.querySelector('.color-picker-wrapper');
    if (!wrapper) return;

    const trigger = wrapper.querySelector('.color-picker-selected');
    const dropdown = wrapper.querySelector('.color-picker-dropdown');
    const options = dropdown.querySelectorAll('.color-option');

    // Toggle dropdown on click
    trigger.addEventListener('click', (e) => {
        e.stopPropagation();

        // Close any other open dropdowns first
        document.querySelectorAll('.color-picker-dropdown:not(.hidden)').forEach(d => {
            if (d !== dropdown) d.classList.add('hidden');
        });

        dropdown.classList.toggle('hidden');
    });

    // Keyboard accessibility (Enter/Space to toggle, Escape to close)
    trigger.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            dropdown.classList.toggle('hidden');
        } else if (e.key === 'Escape') {
            dropdown.classList.add('hidden');
        }
    });

    // Handle option selection
    options.forEach(option => {
        option.addEventListener('click', (e) => {
            e.stopPropagation();

            const colorName = option.dataset.display;      // Display name
            const catalogColor = option.dataset.color;     // CATALOG_COLOR for API
            const imageUrl = option.dataset.image;

            // Update trigger display
            const triggerSwatch = trigger.querySelector('.color-swatch');
            const triggerText = trigger.querySelector('.color-name');

            if (imageUrl) {
                triggerSwatch.style.backgroundImage = `url(${imageUrl})`;
            }
            triggerSwatch.classList.remove('empty');
            triggerText.textContent = colorName;
            triggerText.classList.remove('placeholder');

            // Mark this option as selected
            options.forEach(o => o.classList.remove('selected'));
            option.classList.add('selected');

            // Update product data in products array
            const productData = this.products.find(p => p.id === productId);
            if (productData) {
                productData.catalogColor = catalogColor;  // CATALOG_COLOR for API
                productData.color = colorName;            // Display name
            }

            // Update row dataset for child row inheritance
            row.dataset.color = colorName;
            row.dataset.catalogColor = catalogColor;
            row.dataset.swatchUrl = imageUrl || '';

            // Close dropdown
            dropdown.classList.add('hidden');

            // Enable size inputs now that color is selected
            this.enableSizeInputs(productId);
        });
    });
}

/**
 * Enable size inputs after color is selected
 */
enableSizeInputs(productId) {
    const row = document.querySelector(`tr[data-product-id="${productId}"]`);
    if (!row) return;

    row.querySelectorAll('.size-input').forEach(input => {
        input.disabled = false;
    });

    // Also enable extended picker button if present
    const extButton = row.querySelector('.btn-extended-picker');
    if (extButton) extButton.disabled = false;
}
```

### Close Dropdowns on Outside Click

```javascript
// Add this in your init() method
document.addEventListener('click', () => {
    document.querySelectorAll('.color-picker-dropdown:not(.hidden)').forEach(d => {
        d.classList.add('hidden');
    });
});
```

---

## 2. Product Search with ExactMatchSearch

### Initialize Search

```javascript
/**
 * Setup product search with ExactMatchSearch module
 * Provides: debouncing, exact match detection, keyboard navigation
 */
setupSearchListeners() {
    const searchInput = document.getElementById('product-search');
    const suggestionsContainer = document.getElementById('search-suggestions');

    if (!searchInput) return;

    // Initialize ExactMatchSearch with callbacks
    this.productsManager.initializeExactMatchSearch(
        // Exact match callback - auto-load product immediately
        (product) => {
            console.log('[QuoteBuilder] Exact match found:', product.value);
            searchInput.value = product.value;
            this.selectProduct(product.value);
            if (suggestionsContainer) suggestionsContainer.style.display = 'none';
        },
        // Suggestions callback - show dropdown
        (products) => {
            this.showSearchSuggestions(products);
        },
        // Keyboard navigation options
        {
            onNavigate: (selectedIndex, products) => {
                this.updateSearchSelectionHighlight(selectedIndex);
            },
            onSelect: (product) => {
                searchInput.value = '';
                this.selectProduct(product.value);
                if (suggestionsContainer) suggestionsContainer.style.display = 'none';
            },
            onClose: () => {
                if (suggestionsContainer) suggestionsContainer.style.display = 'none';
            }
        }
    );

    // Wire up search input
    searchInput.addEventListener('input', (e) => {
        const query = e.target.value.trim();

        if (query.length < 2) {
            if (suggestionsContainer) suggestionsContainer.style.display = 'none';
            return;
        }

        this.productsManager.searchWithExactMatch(query);
    });
}
```

### Show Search Suggestions

```javascript
/**
 * Display search suggestions dropdown
 * @param {Array} products - Array of matching products
 */
showSearchSuggestions(products) {
    const container = document.getElementById('search-suggestions');
    if (!container) return;

    if (!products || products.length === 0) {
        container.style.display = 'none';
        return;
    }

    container.innerHTML = products.map((product, index) => `
        <div class="search-suggestion"
             data-index="${index}"
             data-style="${product.value}"
             onclick="dtfQuoteBuilder.selectProduct('${product.value}')">
            <span class="suggestion-style">${product.value}</span>
            <span class="suggestion-desc">${product.label}</span>
        </div>
    `).join('');

    container.style.display = 'block';
}

/**
 * Update keyboard selection highlight in suggestions
 */
updateSearchSelectionHighlight(selectedIndex) {
    const container = document.getElementById('search-suggestions');
    if (!container) return;

    container.querySelectorAll('.search-suggestion').forEach((item, i) => {
        item.classList.toggle('selected', i === selectedIndex);
    });
}
```

---

## 3. Size Upcharge Lookup

```javascript
/**
 * Get size upcharge for extended sizes
 * Handles size aliases (XXL -> 2XL, XXXL -> 3XL)
 *
 * @param {string} size - Size code (XXL, 2XL, 3XL, 4XL, 5XL, 6XL)
 * @param {Object} upcharges - Size upcharge object from API
 * @returns {number} Upcharge amount or 0
 */
getSizeUpcharge(size, upcharges) {
    if (!upcharges) return 0;

    // Normalize size aliases
    const sizeAliases = {
        'XXL': '2XL',
        'XXXL': '3XL'
    };
    const normalizedSize = sizeAliases[size] || size;

    // Default upcharges if not in API data
    const defaults = {
        '2XL': 2.00,
        '3XL': 3.00,
        '4XL': 4.00,
        '5XL': 5.00,
        '6XL': 6.00
    };

    // Try multiple key formats (API may use different naming)
    const upchargeMap = {
        '2XL': upcharges['2XL'] || upcharges['2X'] || upcharges['XXL'] || defaults['2XL'],
        '3XL': upcharges['3XL'] || upcharges['3X'] || upcharges['XXXL'] || defaults['3XL'],
        '4XL': upcharges['4XL'] || upcharges['4X'] || defaults['4XL'],
        '5XL': upcharges['5XL'] || upcharges['5X'] || defaults['5XL'],
        '6XL': upcharges['6XL'] || upcharges['6X'] || defaults['6XL']
    };

    return upchargeMap[normalizedSize] || 0;
}
```

### Size to Part Number Suffix Mapping

```javascript
const SIZE_TO_SUFFIX = {
    'XS': '_XS',
    'XXL': '_2X', '2XL': '_2X',
    'XXXL': '_3X', '3XL': '_3X',
    '4XL': '_4X',
    '5XL': '_5X',
    '6XL': '_6X'
};

// Example: PC54 + '3XL' = PC54_3X
function getPartNumber(styleNumber, size) {
    const suffix = SIZE_TO_SUFFIX[size] || '';
    return styleNumber + suffix;
}
```

---

## 4. LTM Distribution Toggle

LTM (Less Than Minimum) fee can be shown two ways:
1. **Separate line**: $50.00 shown below pricing
2. **Distributed**: Built into unit prices ($50 / qty per piece)

### HTML for LTM Row

```html
<div class="pricing-row ltm-row" id="ltm-row" style="display: none;">
    <span class="label">LTM Fee (< 24 pcs):</span>
    <span class="ltm-value-group">
        <button class="ltm-distribute-btn" id="ltm-distribute-btn"
                title="Click to hide/show LTM as separate line">
            <span class="btn-text">Hide LTM</span>
        </button>
        <span class="value" id="ltm-fee">$50.00</span>
    </span>
</div>
```

### JavaScript Toggle Implementation

```javascript
/**
 * Setup LTM distribution toggle
 * When distributed, LTM is built into unit prices instead of separate line
 */
setupLTMToggle() {
    const btn = document.getElementById('ltm-distribute-btn');
    if (!btn) return;

    btn.addEventListener('click', () => {
        this.ltmDistributed = !this.ltmDistributed;

        if (this.ltmDistributed) {
            this.showToast('LTM fee distributed into unit prices', 'success');
        } else {
            this.showToast('LTM fee shown as separate line', 'info');
        }

        // Re-render pricing with new distribution state
        this.updatePricing();
    });
}
```

### Using LTM in Price Calculation

```javascript
// In updatePricing():
const ltmPerUnit = this.pricingCalculator.calculateLTMPerUnit(pricingQty);
const totalLtmFee = tierData.ltmFee || 0;

// Full unit price (always includes LTM for calculation)
const unitPrice = garmentCost + transferCost + laborCost + freightCost + ltmPerUnit;

// Display price depends on distribution state
let displayPrice;
if (this.ltmDistributed || ltmPerUnit === 0) {
    displayPrice = roundedPrice;  // LTM included
} else {
    // LTM shown separately - exclude from display price
    const priceWithoutLTM = garmentCost + transferCost + laborCost + freightCost;
    displayPrice = this.pricingCalculator.applyRounding(priceWithoutLTM);
}
```

---

## 5. Small Quantity Handling

When quantity is below minimum (e.g., < 10 for DTF), show pricing with warning instead of dashes.

### Implementation

```javascript
async updatePricing() {
    const totalQty = this.getTotalQuantity();

    // Track if under minimum quantity
    const isUnderMinimum = totalQty > 0 && totalQty < 10; // Adjust threshold per builder

    // Show/hide minimum order warning
    const minOrderWarning = document.getElementById('min-order-warning');
    if (minOrderWarning) {
        minOrderWarning.style.display = isUnderMinimum ? 'block' : 'none';
    }

    // Handle zero quantity
    if (totalQty === 0) {
        this.showDashes();
        return;
    }

    // For quantities under minimum, use minimum tier for pricing
    // This shows estimated pricing so users understand costs
    const pricingQty = isUnderMinimum ? 10 : totalQty;

    // Get tier using pricingQty (ensures valid tier lookup)
    const tier = this.pricingCalculator.getTierForQuantity(pricingQty);

    // Show tier with indicator if under minimum
    const tierDisplay = isUnderMinimum ? `${totalQty} (Min 10)` : tier;
    document.getElementById('pricing-tier').textContent = tierDisplay;

    // Calculate costs using pricingQty
    // ... rest of pricing calculations
}
```

### Warning Banner HTML

```html
<div id="min-order-warning" class="min-order-warning" style="display: none;">
    <i class="fas fa-exclamation-triangle"></i>
    <span>Minimum order: 10 pieces. Pricing shown based on 10-23 tier.</span>
</div>
```

### Warning Banner CSS

```css
.min-order-warning {
    background: #fef3c7;
    border: 1px solid #f59e0b;
    border-radius: 6px;
    padding: 8px 12px;
    margin: 8px 12px;
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
    color: #92400e;
}

.min-order-warning i {
    color: #f59e0b;
    font-size: 14px;
}
```

---

## 6. API Error Handling

**CRITICAL: Never fall back to cached/hardcoded data on API failure. Show error to user.**

### Pattern

```javascript
async loadProductData(styleNumber) {
    try {
        const [pricingRes, detailsRes, colorsRes] = await Promise.all([
            fetch(`/api/pricing-bundle?method=DTF&styleNumber=${styleNumber}`),
            fetch(`/api/sanmar-products/details?style=${styleNumber}`),
            fetch(`/api/sanmar-products/colors?style=${styleNumber}`)
        ]);

        // Check each response
        if (!pricingRes.ok) throw new Error(`Pricing API failed: ${pricingRes.status}`);
        if (!detailsRes.ok) throw new Error(`Details API failed: ${detailsRes.status}`);

        const pricing = await pricingRes.json();
        const details = await detailsRes.json();
        const colors = await colorsRes.json();

        return { pricing, details, colors };

    } catch (error) {
        console.error('[QuoteBuilder] API Error:', error);

        // Show error banner - NEVER silently fall back
        this.showError('Unable to load pricing data. Please refresh the page.');

        // Disable continue button
        const continueBtn = document.getElementById('continue-btn');
        if (continueBtn) continueBtn.disabled = true;

        throw error; // Re-throw to stop execution
    }
}
```

### Error Banner HTML

```html
<div id="error-banner" class="error-banner" style="display: none;"></div>
```

### Show Error Method

```javascript
showError(message) {
    const banner = document.getElementById('error-banner');
    if (banner) {
        banner.textContent = message;
        banner.style.display = 'block';
    }
}

clearError() {
    const banner = document.getElementById('error-banner');
    if (banner) {
        banner.textContent = '';
        banner.style.display = 'none';
    }
}
```

---

## 7. Keyboard Navigation

### Size Input Navigation (Tab, Enter, Arrows)

```javascript
/**
 * Handle keyboard navigation in size input cells
 * Tab: Move to next cell (right), create new row on last cell
 * Enter: Move to same column in next row
 * Arrow keys: Navigate between cells
 */
handleCellKeydown(event, input) {
    const row = input.closest('tr');
    const tbody = document.getElementById('product-tbody');
    const rows = Array.from(tbody.querySelectorAll('tr'));
    const currentRowIndex = rows.indexOf(row);

    // Get all size inputs in current row
    const rowInputs = Array.from(row.querySelectorAll('.size-input:not(:disabled)'));
    const currentInputIndex = rowInputs.indexOf(input);

    switch (event.key) {
        case 'Tab':
            if (!event.shiftKey && currentInputIndex === rowInputs.length - 1) {
                // Last input in row - let default Tab behavior work
                // Or auto-create new row if desired
            }
            break;

        case 'Enter':
            event.preventDefault();
            // Move to same column in next row
            if (currentRowIndex < rows.length - 1) {
                const nextRow = rows[currentRowIndex + 1];
                const nextRowInputs = nextRow.querySelectorAll('.size-input:not(:disabled)');
                if (nextRowInputs[currentInputIndex]) {
                    nextRowInputs[currentInputIndex].focus();
                }
            }
            break;

        case 'ArrowUp':
            event.preventDefault();
            if (currentRowIndex > 0) {
                const prevRow = rows[currentRowIndex - 1];
                const prevRowInputs = prevRow.querySelectorAll('.size-input:not(:disabled)');
                if (prevRowInputs[currentInputIndex]) {
                    prevRowInputs[currentInputIndex].focus();
                }
            }
            break;

        case 'ArrowDown':
            event.preventDefault();
            if (currentRowIndex < rows.length - 1) {
                const nextRow = rows[currentRowIndex + 1];
                const nextRowInputs = nextRow.querySelectorAll('.size-input:not(:disabled)');
                if (nextRowInputs[currentInputIndex]) {
                    nextRowInputs[currentInputIndex].focus();
                }
            }
            break;

        case 'ArrowLeft':
            if (input.selectionStart === 0 && currentInputIndex > 0) {
                event.preventDefault();
                rowInputs[currentInputIndex - 1].focus();
            }
            break;

        case 'ArrowRight':
            if (input.selectionStart === input.value.length && currentInputIndex < rowInputs.length - 1) {
                event.preventDefault();
                rowInputs[currentInputIndex + 1].focus();
            }
            break;
    }
}
```

---

## 8. Common Bugs Prevention

### Bug 1: Extended Sizes Lost After Product Created

**Cause**: Storing extended sizes only in `row.dataset`, not creating child rows.

**Solution**: Create actual child rows in DOM for each extended size.

```javascript
// WRONG - sizes lost on page navigation
row.dataset.extendedSizes = JSON.stringify({ '3XL': 5 });

// CORRECT - create child row
createChildRow(parentRowId, '3XL', 5);
```

### Bug 2: Color Changes Don't Cascade to Child Rows

**Cause**: No sync mechanism between parent and child colors.

**Solution**: Implement `cascadeColorToChildRows()` with manual override flag.

```javascript
cascadeColorToChildRows(parentRowId, colorName, catalogColor, swatchUrl) {
    const childRows = document.querySelectorAll(`[data-parent-row-id="${parentRowId}"]`);

    childRows.forEach(childRow => {
        // Skip if user manually changed this child's color
        if (childRow.dataset.colorManuallySet === 'true') return;

        // Update child color to match parent
        childRow.dataset.color = colorName;
        childRow.dataset.catalogColor = catalogColor;
        // Update visual display...
    });
}
```

### Bug 3: XXL Input State Confusion

**Cause**: XXL can exist in parent input OR child row, causing double-counting.

**Solution**: Disable parent XXL input when child row is created.

```javascript
// When creating XXL child row:
const parentXXLInput = parentRow.querySelector('[data-size="XXL"]');
if (parentXXLInput) {
    parentXXLInput.disabled = true;
    parentXXLInput.style.background = '#f5f5f5';
    parentXXLInput.value = ''; // Clear parent value
}
```

### Bug 4: Small Quantity Shows No Pricing

**Cause**: Blocking all pricing when qty < minimum.

**Solution**: Show pricing using minimum tier with warning banner.

```javascript
// Instead of showing dashes:
if (totalQty < 10) {
    const pricingQty = 10; // Use minimum tier
    // Calculate and show pricing
    // Display warning banner
}
```

### Bug 5: Child Row null Error on Style Change

**Cause**: `onStyleChange()` tries to update inputs that don't exist on child rows.

**Solution**: Add early return for child rows.

```javascript
async function onStyleChange(input, rowId) {
    const row = document.getElementById(`row-${rowId}`);
    if (!row) return;

    // Child rows don't have editable style/description inputs
    if (row.classList.contains('child-row')) return;

    // ... rest of function
}
```

---

## Data Flow Reference

```
User Input → DOM Event → products[] Array → updatePricing() → Display

products[] is the single source of truth for quantities.
DOM dataset stores metadata for child row inheritance.
childRowMap tracks parent-child relationships.
```

---

## Required Row Dataset Attributes

```javascript
row.dataset.productId = productId;
row.dataset.styleNumber = styleNumber;
row.dataset.baseCost = baseCost;
row.dataset.colors = JSON.stringify(colors);        // For child row color picker
row.dataset.sizeUpcharges = JSON.stringify(upcharges);
row.dataset.productName = description;
row.dataset.color = '';           // Set on color selection
row.dataset.catalogColor = '';    // CATALOG_COLOR for API
row.dataset.swatchUrl = '';       // Color swatch image
```

---

## Checklist for New Quote Builders

- [ ] API endpoints configured for this method type
- [ ] Color picker renders from API data
- [ ] Product search with ExactMatchSearch
- [ ] Size inputs disabled until color selected
- [ ] Extended sizes create child rows (not just dataset)
- [ ] Size upcharge lookup handles aliases (XXL→2XL)
- [ ] LTM toggle implemented (if applicable)
- [ ] Small quantity shows pricing with warning
- [ ] API errors show banner (no silent fallbacks)
- [ ] Keyboard navigation works (Tab, Enter, arrows)
- [ ] Continue button disabled on error/zero qty
- [ ] Child rows cascade parent color changes
- [ ] Part numbers use correct suffixes (_2X, _3X, etc.)
