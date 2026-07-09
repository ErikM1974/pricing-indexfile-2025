/**
 * DTF product-rows module — Batch 4.3 (2026-07-09): the classic
 * dtf-quote-page.js row machinery migrated into the bundle — search/style
 * change, color pickers, size inputs, extended-size child rows (childRowMap
 * now lives on dtfState with a window-backed accessor for the class), row
 * delete/duplicate, thumbnails. Moved verbatim; cross-module calls stay bare
 * globals resolved via the index.js bridges (SCP pattern).
 */
// @ts-nocheck — MOVED legacy DOM code (pre-existing checkJs frictions; typing lands with the render/state split).
/* global dtfQuoteBuilder, showToast, escapeHtml, getSwatchStyle, productThumbnailModal,
   cleanProductTitle */
import { dtfState, API_BASE } from './state.js';

// Shared ExtendedSizesConfig module is REQUIRED — no fallback (classic script
// loads before the bundle; hard-fail loudly if the include went missing).
if (!window.ExtendedSizesConfig) {
    console.error('❌ ExtendedSizesConfig module not loaded! Check script includes.');
    document.body.innerHTML = `
        <div style="padding: 40px; text-align: center; color: #c00;">
            <h2>Configuration Error</h2>
            <p>Extended sizes module failed to load. Please refresh the page.</p>
            <p style="font-size: 12px; color: #666;">If this persists, contact support.</p>
        </div>
    `;
    throw new Error('ExtendedSizesConfig module required but not loaded');
}

/**
 * Add a new empty row for user to type style number
 * Matches pattern from DTG/Embroidery/Screen Print quote builders
 */
export function addNewRow() {
    const tbody = document.getElementById('product-tbody');
    // Use shared counter from JS class to prevent ID collisions with child rows
    const rowId = dtfQuoteBuilder.getNextRowId();

    // Hide empty state message when adding first row
    const emptyStateRow = document.getElementById('empty-state-row');
    if (emptyStateRow) emptyStateRow.style.display = 'none';

    const row = document.createElement('tr');
    row.id = `row-${rowId}`;
    row.className = 'new-row';
    row.dataset.rowId = rowId;
    row.dataset.productId = rowId;  // Match what updatePricing() expects

    // eslint-disable-next-line no-unsanitized/property -- audited (Batch 4.3): rowId numeric via getNextRowId; template is static markup
    row.innerHTML = `
        <td>
            <input type="text" class="cell-input style-input"
                   placeholder="Style #"
                   data-field="style"
                   onchange="onStyleChange(this, ${rowId})"
                   onkeydown="handleCellKeydown(event, this)">
        </td>
        <td class="thumbnail-col">
            <div class="product-thumbnail no-image qb-thumb-box" id="thumb-${rowId}"
                 title="Select a color to see product image"></div>
        </td>
        <td class="desc-cell">
            <div class="desc-row">
                <input type="text" class="cell-input desc-input"
                       placeholder="(auto)"
                       data-field="description"
                       readonly>
            </div>
            <div class="pricing-breakdown" id="breakdown-${rowId}"></div>
        </td>
        <td>
            <div class="color-picker-wrapper" data-row-id="${rowId}">
                <div class="color-picker-selected disabled" onclick="toggleColorPicker(${rowId})" tabindex="0" role="combobox" aria-haspopup="listbox" aria-expanded="false" aria-label="Garment color" onkeydown="handleColorPickerKeydown(event, ${rowId})">
                    <span class="color-swatch empty"></span>
                    <span class="color-name placeholder">Select color...</span>
                    <i class="fas fa-chevron-down picker-arrow"></i>
                </div>
                <div class="color-picker-dropdown hidden" role="listbox" aria-label="Colors" id="color-dropdown-${rowId}"></div>
            </div>
        </td>
        <td><input type="number" class="cell-input size-input" data-size="S" min="0" value="" placeholder="0" onchange="onSizeChange(${rowId})" onkeydown="handleCellKeydown(event, this)" disabled aria-label="Quantity for size Small"></td>
        <td><input type="number" class="cell-input size-input" data-size="M" min="0" value="" placeholder="0" onchange="onSizeChange(${rowId})" onkeydown="handleCellKeydown(event, this)" disabled aria-label="Quantity for size Medium"></td>
        <td><input type="number" class="cell-input size-input" data-size="L" min="0" value="" placeholder="0" onchange="onSizeChange(${rowId})" onkeydown="handleCellKeydown(event, this)" disabled aria-label="Quantity for size Large"></td>
        <td><input type="number" class="cell-input size-input" data-size="XL" min="0" value="" placeholder="0" onchange="onSizeChange(${rowId})" onkeydown="handleCellKeydown(event, this)" disabled aria-label="Quantity for size Extra Large"></td>
        <td><input type="number" class="cell-input size-input" data-size="2XL" min="0" value="" placeholder="0" onchange="onSizeChange(${rowId})" onkeydown="handleCellKeydown(event, this)" disabled aria-label="Quantity for size 2XL"></td>
        <td><input type="text" class="cell-input size-input xxxl-picker-btn" data-size="3XL" value="" placeholder="+" readonly onclick="openExtendedSizePopup(${rowId})" onkeydown="if(event.key==='Enter'){openExtendedSizePopup(${rowId})}" disabled title="Click to add extended sizes (3XL, 4XL, 5XL, XS, etc.)" aria-label="Open extended sizes picker for 3XL and larger"></td>
        <td class="cell-qty" id="row-qty-${rowId}">0</td>
        <td class="cell-price" id="row-price-${rowId}">-</td>
        <td class="cell-total" id="row-total-${rowId}">-</td>
        <td class="cell-actions">
            <button class="btn-duplicate-row" onclick="duplicateRowNewColor(${rowId})" title="Add another color of this style" aria-label="Duplicate row with a new color" disabled>
                <i class="fas fa-copy"></i>
            </button>
            <button class="btn-delete-row" onclick="deleteRow(${rowId})" title="Delete row" aria-label="Delete product row">
                <i class="fas fa-times"></i>
            </button>
        </td>
    `;

    tbody.appendChild(row);

    // Focus on the style input
    setTimeout(() => {
        row.querySelector('.style-input').focus();
    }, 50);

    // Remove the "new-row" highlight after a moment
    setTimeout(() => {
        row.classList.remove('new-row');
    }, 1000);
}
// Expose to window for JS class access

/**
 * Handle style number change - fetch product data
 */
export async function onStyleChange(input, rowId) {
    const styleNumber = input.value.trim().toUpperCase();
    if (!styleNumber) return;

    const row = document.getElementById(`row-${rowId}`);
    if (!row) return;

    // Skip if this is a child row (child rows don't have editable style/description inputs)
    if (row.classList.contains('child-row')) return;

    const descInput = row.querySelector('[data-field="description"]');
    const pickerSelected = row.querySelector('.color-picker-selected');
    const pickerDropdown = row.querySelector('.color-picker-dropdown');

    try {
        // Fetch product details, colors, AND pricing bundle
        // NOTE: Use method=BLANK (not DTF) to get sellingPriceDisplayAddOns for size upcharges
        // DTF pricing-bundle returns empty sellingPriceDisplayAddOns because garment data is separate
        // NOTE: Changed to /api/product-colors (same as DTG/Screen Print/Embroidery) which returns MAIN_IMAGE_URL
        const [detailsResponse, colorsResponse, blankBundleResponse] = await Promise.all([
            fetch(`${API_BASE}/api/product-details?styleNumber=${styleNumber}`),
            fetch(`${API_BASE}/api/product-colors?styleNumber=${styleNumber}`),
            fetch(`${API_BASE}/api/pricing-bundle?method=BLANK&styleNumber=${styleNumber}`)
        ]);

        const details = await detailsResponse.json();
        const colorsData = await colorsResponse.json();
        const blankBundle = await blankBundleResponse.json();

        // product-colors returns { colors: [...] } wrapper
        const colors = colorsData.colors || [];

        const firstDetail = Array.isArray(details) ? details[0] : details;

        if (firstDetail) {
            // Clean product title
            const cleanTitle = cleanProductTitle(firstDetail.PRODUCT_TITLE, styleNumber);
            if (descInput) descInput.value = cleanTitle || styleNumber;

            // Store data on row
            row.dataset.style = styleNumber;
            row.dataset.productName = cleanTitle || styleNumber;
            // Use min size price from BLANK bundle (base S/M/L/XL cost, max across all colors)
            // Avoids bug where firstDetail.CASE_PRICE is from an arbitrary color/size record
            const blankSizes = blankBundle.sizes || [];
            const baseSizePrice = blankSizes.length > 0
                ? Math.min(...blankSizes.map(s => s.price))
                : 0;
            const resolvedBaseCost = baseSizePrice || firstDetail.CASE_PRICE || 0;
            // [2026-06-11] $0 garment guard (Erik's #1 rule — never a silent wrong
            // price): a BLANK bundle with no priced sizes (null CASE_PRICE rows or a
            // transient sub-query failure 200s with sizes:[]) used to load the row
            // normally and every surface priced the garment at $0 — decoration-only.
            // Block the row visibly instead.
            if (!(resolvedBaseCost > 0)) {
                if (descInput) descInput.value = 'No garment cost — cannot quote';
                if (typeof showToast === 'function') {
                    showToast(`No garment cost available for ${styleNumber} — cannot price this style. Check the style number or re-add it after a refresh.`, 'error');
                }
                return;
            }
            row.dataset.baseCost = resolvedBaseCost;
            // Store sizeUpcharges from BLANK bundle (has actual upcharge data)
            // sellingPriceDisplayAddOns format: { "2XL": 2.00, "3XL": 3.00, "4XL": 4.00, ... }
            const upcharges = blankBundle.sellingPriceDisplayAddOns || {};
            row.dataset.sizeUpcharges = JSON.stringify(upcharges);

            // Enable "duplicate row" button — style loaded AND garment cost passed the
            // $0 guard above (covers fresh entry, edit-load, quick-quote prefill)
            const dupBtn = row.querySelector('.btn-duplicate-row');
            if (dupBtn) dupBtn.disabled = false;

            // Populate color picker (now includes MAIN_IMAGE_URL from product-colors API)
            if (colors && colors.length > 0) {
                // eslint-disable-next-line no-unsanitized/property -- audited (Batch 4.3): every color field escapeHtml-wrapped; swatch via hardened getSwatchStyle
                pickerDropdown.innerHTML = colors.map(c => `
                    <div class="color-picker-option"
                         data-color-name="${escapeHtml(c.COLOR_NAME)}"
                         data-catalog-color="${escapeHtml(c.CATALOG_COLOR || c.COLOR_NAME)}"
                         data-swatch-url="${escapeHtml(c.COLOR_SQUARE_IMAGE || '')}"
                         data-hex="${escapeHtml(c.HEX_CODE || '#ccc')}"
                         data-image-url="${escapeHtml(c.MAIN_IMAGE_URL || c.FRONT_MODEL || c.FRONT_FLAT || '')}"
                         onclick="selectColor(${rowId}, this)">
                        <span class="color-swatch" style="${getSwatchStyle(c)}"></span>
                        <span class="color-name">${escapeHtml(c.COLOR_NAME)}</span>
                    </div>
                `).join('');

                pickerSelected.classList.remove('disabled');
                row.dataset.colors = JSON.stringify(colors);
            }
        } else {
            if (descInput) descInput.value = 'Not found';
            showToast(`Style ${styleNumber} not found`, 'error');
        }
    } catch (error) {
        console.error('Error loading product:', error);
        showToast('Error loading product', 'error');
    }
}
// Expose to window for JS class access

/**
 * Duplicate a product row for a different color of the same style (Rule 8:
 * mirrors EMB's duplicateRowNewColor). Pre-fills the style number and runs
 * onStyleChange() so the color picker loads — the rep just picks the new color.
 */
export async function duplicateRowNewColor(sourceRowId) {
    const sourceRow = document.getElementById(`row-${sourceRowId}`);
    if (!sourceRow) return;

    const style = sourceRow.dataset.style;
    if (!style) {
        showToast('No style loaded on this row', 'error');
        return;
    }

    addNewRow();
    // addNewRow() appends to product-tbody synchronously — the new row is the last one
    const newRow = document.getElementById('product-tbody').lastElementChild;
    if (!newRow || !newRow.dataset.rowId) return;

    const styleInput = newRow.querySelector('.style-input');
    if (styleInput) {
        styleInput.value = style;
        await onStyleChange(styleInput, parseInt(newRow.dataset.rowId));
        showToast(`Select a new color for ${style}`, 'info', 3000);
    }
}

/**
 * Handle keyboard navigation in cells
 */
export function handleCellKeydown(event, input) {
    const row = input.closest('tr');
    const cells = Array.from(row.querySelectorAll('input:not([readonly]):not(:disabled)'));
    const currentIndex = cells.indexOf(input);

    if (event.key === 'Tab' && !event.shiftKey) {
        // Tab to next cell
        if (currentIndex === cells.length - 1) {
            // Last cell in row - add new row
            event.preventDefault();
            addNewRow();
        }
    } else if (event.key === 'Enter') {
        event.preventDefault();
        const tbody = document.getElementById('product-tbody');
        const rows = Array.from(tbody.querySelectorAll('tr'));
        const currentRowIndex = rows.indexOf(row);

        if (currentRowIndex === rows.length - 1) {
            addNewRow();
        } else {
            // Focus same column in next row
            const nextRow = rows[currentRowIndex + 1];
            const nextCells = Array.from(nextRow.querySelectorAll('input:not([readonly]):not(:disabled)'));
            if (nextCells[currentIndex]) {
                nextCells[currentIndex].focus();
            }
        }
    }
}

/**
 * Handle size input changes
 */
export function onSizeChange(rowId) {
    const row = document.getElementById(`row-${rowId}`);
    if (!row) {
        return;
    }

    // Skip if this is a child row (child rows use onChildSizeChange)
    if (row.classList.contains('child-row')) {
        if (dtfQuoteBuilder) dtfQuoteBuilder.recalculatePricing();
        return;
    }

    // Handle 2XL - auto-create child row when quantity entered
    const xxlInput = row.querySelector('[data-size="2XL"]');
    if (xxlInput && !xxlInput.disabled) {
        const qty = parseInt(xxlInput.value) || 0;
        // Check for both 2XL and XXL child rows (XXL is distinct for Ladies/Womens products)
        const existingChildId = dtfState.childRowMap[rowId]?.['2XL'] || dtfState.childRowMap[rowId]?.['XXL'];

        if (qty > 0 && !existingChildId) {
            // CREATE CHILD ROW for 2XL
            createChildRow(rowId, '2XL', qty);
            // Disable parent's 2XL input and CLEAR the value
            xxlInput.disabled = true;
            xxlInput.style.background = '#f5f5f5';
            xxlInput.style.color = '#999';
            xxlInput.value = '';  // Clear value so grayed input shows empty
        } else if (qty > 0 && existingChildId) {
            // Update existing child row — JS state first (money source), then
            // the display row (2026-06-11 P2)
            if (dtfQuoteBuilder) dtfQuoteBuilder.setChildRowQty(existingChildId, qty);
            const childRow = document.getElementById(`row-${existingChildId}`);
            if (childRow) {
                const childInput = childRow.querySelector('.extended-size-qty');
                if (childInput) childInput.value = qty;
                document.getElementById(`row-qty-${existingChildId}`).textContent = qty;
            }
        }
    }

    // Calculate total quantity from standard sizes (S, M, L, XL)
    let total = 0;
    row.querySelectorAll('.size-input:not(.xxxl-picker-btn):not(:disabled)').forEach(input => {
        const size = input.dataset.size;
        // Skip 2XL - it's handled separately via child rows
        if (size !== '2XL') {
            total += parseInt(input.value) || 0;
        }
    });

    // Parent Qty shows only its own standard sizes.
    // Child rows display their own Qty and Total independently.
    // Sidebar "Total Pieces" aggregates both via getTotalQuantity().

    // Update quantity display
    const qtyCell = document.getElementById(`row-qty-${rowId}`);
    if (qtyCell) qtyCell.textContent = total;

    // Trigger pricing recalculation via dtfQuoteBuilder
    if (dtfQuoteBuilder) {
        dtfQuoteBuilder.updatePricingFromRow(rowId, row);
    }
}

/**
 * Select a color from the picker (parent row)
 */
export function selectColor(rowId, optionEl) {
    const row = document.getElementById(`row-${rowId}`);
    const colorName = optionEl.dataset.colorName;
    const catalogColor = optionEl.dataset.catalogColor;
    const swatchUrl = optionEl.dataset.swatchUrl || '';
    const hex = optionEl.dataset.hex || '#ccc';
    const imageUrl = optionEl.dataset.imageUrl || '';
    const style = row.dataset.style;

    // Update display
    const pickerSelected = row.querySelector('.color-picker-selected');
    const swatch = pickerSelected.querySelector('.color-swatch');
    const nameSpan = pickerSelected.querySelector('.color-name');

    if (swatchUrl) {
        swatch.style.backgroundImage = `url('${swatchUrl}')`;
        swatch.style.backgroundColor = '';
        swatch.style.backgroundSize = 'cover';
    } else {
        swatch.style.backgroundImage = '';
        swatch.style.backgroundColor = hex;
    }
    swatch.classList.remove('empty');
    nameSpan.textContent = colorName;
    nameSpan.classList.remove('placeholder');

    // Store data on row
    row.dataset.color = colorName;
    row.dataset.catalogColor = catalogColor;
    row.dataset.swatchUrl = swatchUrl;
    row.dataset.hex = hex;
    row.dataset.imageUrl = imageUrl;

    // Update product thumbnail
    updateProductThumbnail(rowId, imageUrl, row.dataset.productName, style, colorName);

    // Close dropdown
    row.querySelector('.color-picker-dropdown').classList.add('hidden');

    // Cascade color to child rows (unless they have manually set colors)
    cascadeColorToChildRows(rowId, colorName, catalogColor, swatchUrl, hex);

    // Enable size inputs
    row.querySelectorAll('.size-input').forEach(input => input.disabled = false);

    // Phase 10.1 (2026-05-23) — fire SanMar inventory check + render badges
    // next to each size input. Uses shared InventoryBadges wrapper around
    // OrderFormInventory module. Graceful: silently no-ops if scripts missing.
    if (window.InventoryBadges && typeof window.InventoryBadges.attach === 'function') {
        window.InventoryBadges.attach(row, {
            style: style,
            catalogColor: catalogColor,
            sizeCellSelector: 'input.size-input',
        });
    }

    // Focus first size
    const firstSize = row.querySelector('.size-input:not(.xxxl-picker-btn)');
    if (firstSize) firstSize.focus();

    // Color pick is a click — no input/change event for the tbody dirty-tracking
    // delegation to catch. Edit-load also calls this, but loadQuoteForEditing()
    // clears the flag with its trailing markAsSaved(). (2026-06-10)
    if (window.dtfQuoteBuilder) window.dtfQuoteBuilder.markAsUnsaved();
}

/**
 * Toggle color picker dropdown
 */
export function toggleColorPicker(rowId) {
    const row = document.getElementById(`row-${rowId}`);
    const dropdown = row.querySelector('.color-picker-dropdown');
    const selected = row.querySelector('.color-picker-selected');

    if (selected.classList.contains('disabled')) return;

    // Close all other dropdowns
    document.querySelectorAll('.color-picker-dropdown').forEach(d => {
        if (d !== dropdown) d.classList.add('hidden');
    });

    dropdown.classList.toggle('hidden');
    // 7.2 a11y: listbox semantics. Options are populated dynamically, so stamp
    // role/id/aria-selected lazily on open; keep aria-expanded truthful.
    const nowOpen = !dropdown.classList.contains('hidden');
    selected.setAttribute('aria-expanded', String(nowOpen));
    if (nowOpen) {
        dropdown.querySelectorAll('.color-picker-option').forEach((opt, oi) => {
            opt.setAttribute('role', 'option');
            if (!opt.id) opt.id = `${dropdown.id || 'color-dropdown'}-opt-${oi}`;
            opt.setAttribute('aria-selected', String(opt.classList.contains('selected')));
        });
    }
}

/**
 * Handle keyboard events on color picker
 */
export function handleColorPickerKeydown(event, rowId) {
    if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        toggleColorPicker(rowId);
    } else if (event.key === 'Escape') {
        const row = document.getElementById(`row-${rowId}`);
        row.querySelector('.color-picker-dropdown').classList.add('hidden');
    }
}

/**
 * Delete a row
 */
export function deleteRow(rowId) {
    const row = document.getElementById(`row-${rowId}`);
    if (row) {
        // Also delete any child rows
        const childRows = document.querySelectorAll(`tr[data-parent-row-id="${rowId}"]`);
        childRows.forEach(childRow => {
            const childId = parseInt(childRow.dataset.rowId);
            childRow.remove();
            if (dtfQuoteBuilder) {
                dtfQuoteBuilder.removeProduct(childId);
            }
        });
        // Clear child row tracking
        delete dtfState.childRowMap[rowId];

        row.remove();
        if (dtfQuoteBuilder) {
            dtfQuoteBuilder.removeProduct(rowId);
            dtfQuoteBuilder.recalculatePricing();
        }
    }
}

// ============================================================
// CHILD ROW FUNCTIONS (Extended Sizes - Like Embroidery/DTG)
// ============================================================

/**
 * Create a child row for an extended size (XXL, 3XL, 4XL, etc.)
 * @param {number} parentRowId - ID of the parent row
 * @param {string} size - Size name (XXL, 3XL, 4XL, 5XL, 6XL, XS)
 * @param {number} qty - Quantity for this size
 */
// D2 split (2026-07-09): the child-row color-option template, moved VERBATIM
// out of createChildRow.
function buildChildColorOptionsHtml(parentColors, parentColor, childRowId, parentRowId) {
    // Build color options HTML for child row picker
    return parentColors.map(c =>
        `<div class="color-picker-option ${c.COLOR_NAME === parentColor ? 'selected' : ''}"
             data-color-name="${escapeHtml(c.COLOR_NAME)}"
             data-catalog-color="${escapeHtml(c.CATALOG_COLOR || c.COLOR_NAME)}"
             data-swatch-url="${escapeHtml(c.COLOR_SQUARE_IMAGE || '')}"
             data-hex="${escapeHtml(c.HEX_CODE || '#ccc')}"
             onclick="selectChildColor(${childRowId}, ${parentRowId}, this)">
            <span class="color-swatch" style="${getSwatchStyle(c)}"></span>
            <span class="color-name">${escapeHtml(c.COLOR_NAME)}</span>
        </div>`
    ).join('');
}

export function createChildRow(parentRowId, size, qty) {
    const parentRow = document.getElementById(`row-${parentRowId}`);
    if (!parentRow) {
        console.error('[DTF] Cannot create child row: parent not found', parentRowId);
        return null;
    }

    // Use shared counter from JS class to prevent ID collisions with parent rows
    const childRowId = dtfQuoteBuilder.getNextRowId();
    const baseStyle = parentRow.dataset.style || '';
    const suffix = window.ExtendedSizesConfig.SIZE_TO_SUFFIX[size] || '';
    const partNumber = baseStyle + suffix;  // e.g., PC61_2XL

    // Get parent's color info
    const parentColor = parentRow.dataset.color || '';
    const parentCatalogColor = parentRow.dataset.catalogColor || '';
    const parentSwatchUrl = parentRow.dataset.swatchUrl || '';
    const parentHex = parentRow.dataset.hex || '#ccc';
    const parentColors = parentRow.dataset.colors ? JSON.parse(parentRow.dataset.colors) : [];


    const colorOptionsHtml = buildChildColorOptionsHtml(parentColors, parentColor, childRowId, parentRowId);

    // Build current color display style
    const currentSwatchStyle = parentSwatchUrl
        ? `background-image: url('${parentSwatchUrl}'); background-size: cover; background-position: center;`
        : `background-color: ${parentHex};`;

    const childRow = document.createElement('tr');
    childRow.id = `row-${childRowId}`;
    childRow.className = 'child-row';
    childRow.dataset.rowId = childRowId;
    childRow.dataset.productId = childRowId;
    childRow.dataset.parentRowId = parentRowId;
    childRow.dataset.extendedSize = size;
    childRow.dataset.style = partNumber;
    childRow.dataset.baseStyle = baseStyle;
    childRow.dataset.baseCost = parentRow.dataset.baseCost || '0';
    childRow.dataset.sizeUpcharges = parentRow.dataset.sizeUpcharges || '{}';
    childRow.dataset.color = parentColor;
    childRow.dataset.catalogColor = parentCatalogColor;
    childRow.dataset.swatchUrl = parentSwatchUrl;
    childRow.dataset.hex = parentHex;
    childRow.dataset.productName = parentRow.dataset.productName || '';
    childRow.dataset.colorManuallySet = 'false';  // Track if user manually changed color

    const displaySize = size === 'XXXL' ? '3XL' : size;  // 2XL is already correct
    const productName = parentRow.dataset.productName || '';

    // Determine which column gets the qty (matching DTG/Embroidery pattern)
    // 2XL/XXL goes in Size05 column, other extended sizes go in Size06 column
    const SIZE05_SIZES = ['2XL', 'XXL'];  // Both map to same suffix
    const isSize05 = SIZE05_SIZES.includes(size);
    const isSize06 = !isSize05;

    // eslint-disable-next-line no-unsanitized/property -- audited (Batch 4.3, mirrors emb/product-rows C32): childRowId numeric (getNextRowId), partNumber/size internal codes, colors escapeHtml-wrapped, swatch via hardened getSwatchStyle
    childRow.innerHTML = `
        <td>
            <span class="style-display">${escapeHtml(partNumber)}</span>
        </td>
        <td class="thumbnail-col">
            <div class="product-thumbnail qb-thumb-box" id="thumb-${childRowId}">
                <img src="${parentRow.dataset.imageUrl || ''}"
                     alt="${escapeHtml(productName)}"
                     style="max-width: 100%; max-height: 100%; object-fit: contain;"
                     onerror="this.parentElement.classList.add('no-image'); this.style.display='none';">
            </div>
        </td>
        <td class="desc-cell">
            <span class="desc-display">${escapeHtml(productName)} - ${displaySize}</span>
        </td>
        <td>
            <div class="color-picker-wrapper child-color-picker" data-row-id="${childRowId}">
                <div class="color-picker-selected" onclick="toggleColorPicker(${childRowId})" tabindex="0" role="combobox" aria-haspopup="listbox" aria-expanded="false" aria-label="Garment color" onkeydown="handleColorPickerKeydown(event, ${childRowId})">
                    <span class="color-swatch" style="${currentSwatchStyle}"></span>
                    <span class="color-name">${escapeHtml(parentColor)}</span>
                    <i class="fas fa-chevron-down picker-arrow"></i>
                </div>
                <div class="color-picker-dropdown hidden" role="listbox" aria-label="Colors" id="color-dropdown-${childRowId}">
                    ${colorOptionsHtml}
                </div>
            </div>
        </td>
        <td><input type="number" class="cell-input size-input qb-bg-gray" disabled></td>
        <td><input type="number" class="cell-input size-input qb-bg-gray" disabled></td>
        <td><input type="number" class="cell-input size-input qb-bg-gray" disabled></td>
        <td><input type="number" class="cell-input size-input qb-bg-gray" disabled></td>
        <td><input type="number" class="cell-input size-input extended-size-qty qb-bg-gray" data-size="2XL" aria-label="Quantity 2XL"
                   ${isSize05 ? `value="${qty}" min="0" placeholder="${qty}" onchange="onChildSizeChange(${childRowId}, ${parentRowId}, '2XL')" onkeydown="handleCellKeydown(event, this)"` : 'disabled'}></td>
        <td><input type="number" class="cell-input size-input extended-size-qty qb-bg-gray" data-size="${size}" aria-label="Quantity ${size}"
                   ${isSize06 ? `value="${qty}" min="0" placeholder="${qty}" onchange="onChildSizeChange(${childRowId}, ${parentRowId}, '${size}')" onkeydown="handleCellKeydown(event, this)"` : 'disabled'}></td>
        <td class="cell-qty" id="row-qty-${childRowId}">${qty}</td>
        <td class="cell-price" id="row-price-${childRowId}">-</td>
        <td class="cell-total" id="row-total-${childRowId}">-</td>
        <td class="cell-actions">
            <button class="btn-delete-row" onclick="removeChildRow(${parentRowId}, '${size}')" title="Remove ${displaySize}" aria-label="Remove extended size ${displaySize}">
                <i class="fas fa-times"></i>
            </button>
        </td>
    `;

    // Insert in correct position (maintain size order)
    const existingChildren = Array.from(
        document.querySelectorAll(`tr[data-parent-row-id="${parentRowId}"]`)
    );
    // Normalize XXXL to 3XL for sorting lookup (XXXL is internal alias not in EXTENDED_SIZE_ORDER)
    const normalizedSize = size === 'XXXL' ? '3XL' : size;
    const newSizeIndex = window.ExtendedSizesConfig.EXTENDED_SIZE_ORDER.indexOf(normalizedSize);
    let insertAfter = parentRow;

    for (const existingChild of existingChildren) {
        const existingSize = existingChild.dataset.extendedSize;
        // Normalize existing size too for consistent comparison
        const normalizedExisting = existingSize === 'XXXL' ? '3XL' : existingSize;
        const existingSizeIndex = window.ExtendedSizesConfig.EXTENDED_SIZE_ORDER.indexOf(normalizedExisting);
        if (existingSizeIndex < newSizeIndex) {
            insertAfter = existingChild;
        }
    }

    insertAfter.after(childRow);

    // Track in dtfState.childRowMap
    if (!dtfState.childRowMap[parentRowId]) dtfState.childRowMap[parentRowId] = {};
    dtfState.childRowMap[parentRowId][size] = childRowId;

    // Mirror into JS state — calculateFromState()/getTotalQuantity()/save/print
    // read THIS, never the DOM row, which is display-only (2026-06-11 P2)
    let parsedUpcharges = {};
    try { parsedUpcharges = JSON.parse(childRow.dataset.sizeUpcharges || '{}'); } catch (e) { /* keep {} */ }
    dtfQuoteBuilder.registerChildRow(childRowId, {
        parentId: parentRowId,
        size: size,
        qty: qty,
        baseCost: childRow.dataset.baseCost,
        sizeUpcharges: parsedUpcharges
    });

    // Trigger pricing recalculation
    if (dtfQuoteBuilder) {
        dtfQuoteBuilder.updatePricingFromRow(childRowId, childRow);
    }

    return childRowId;
}

/**
 * Remove a child row
 * @param {number} parentRowId - ID of the parent row
 * @param {string} size - Size to remove (XXL, 3XL, etc.)
 */
export function removeChildRow(parentRowId, size) {
    const childRowId = dtfState.childRowMap[parentRowId]?.[size];
    if (childRowId) {
        const childRow = document.getElementById(`row-${childRowId}`);
        if (childRow) childRow.remove();
        delete dtfState.childRowMap[parentRowId][size];

        // If removing XXL, re-enable parent's XXL input
        if (size === 'XXL' || size === '2XL') {
            const parentRow = document.getElementById(`row-${parentRowId}`);
            if (parentRow) {
                const xxlInput = parentRow.querySelector('[data-size="2XL"]');
                if (xxlInput) {
                    xxlInput.disabled = false;
                    xxlInput.value = '';
                    xxlInput.style.background = '';
                    xxlInput.style.color = '';
                }
            }
        }

        // Update parent's XXXL button display
        updateExtendedSizeDisplay(parentRowId);

        // Recalculate pricing
        if (dtfQuoteBuilder) {
            dtfQuoteBuilder.removeProduct(childRowId);
            dtfQuoteBuilder.recalculatePricing();
            // [2026-06-11] explicit dirty-flag: updatePricingFromRow no longer
            // creates phantom this.products entries for child rows, so the
            // removeProduct side effect can't be relied on to mark unsaved
            if (typeof dtfQuoteBuilder.markAsUnsaved === 'function') dtfQuoteBuilder.markAsUnsaved();
        }

    }
}

/**
 * Handle size change in a child row
 */
export function onChildSizeChange(childRowId, parentRowId, size) {
    const childRow = document.getElementById(`row-${childRowId}`);
    if (!childRow) return;

    const input = childRow.querySelector('.extended-size-qty');
    const qty = parseInt(input?.value) || 0;

    // JS state first (money source), then the display cell (2026-06-11 P2)
    if (dtfQuoteBuilder) dtfQuoteBuilder.setChildRowQty(childRowId, qty);

    // Update qty display
    const qtyCell = document.getElementById(`row-qty-${childRowId}`);
    if (qtyCell) qtyCell.textContent = qty;

    // If quantity is 0, remove the child row
    if (qty === 0) {
        removeChildRow(parentRowId, size);
        return;
    }

    // Update extended size display on parent
    updateExtendedSizeDisplay(parentRowId);

    // Trigger pricing recalculation
    if (dtfQuoteBuilder) {
        dtfQuoteBuilder.updatePricingFromRow(childRowId, childRow);
    }
}

/**
 * Update the parent row's XXXL button display to show count of extended sizes
 */
export function updateExtendedSizeDisplay(parentRowId) {
    const parentRow = document.getElementById(`row-${parentRowId}`);
    if (!parentRow) return;

    const xxxlBtn = parentRow.querySelector('.xxxl-picker-btn');
    if (!xxxlBtn) return;

    // Count total extended size quantities from child rows
    const childRows = document.querySelectorAll(`tr[data-parent-row-id="${parentRowId}"]`);
    let totalExtQty = 0;
    childRows.forEach(childRow => {
        // Skip XXL child rows for this count (they have their own column)
        const size = childRow.dataset.extendedSize;
        if (size !== 'XXL' && size !== '2XL') {
            const qtyDisplay = childRow.querySelector('.cell-qty');
            totalExtQty += parseInt(qtyDisplay?.textContent) || 0;
        }
    });

    // Update display
    if (totalExtQty > 0) {
        xxxlBtn.value = totalExtQty;
        xxxlBtn.placeholder = '';
    } else {
        xxxlBtn.value = '';
        xxxlBtn.placeholder = '+';
    }
}

/**
 * Get the current quantity for an extended size
 * Checks child rows first, falls back to parent row input
 * This fixes the "can't add extended sizes after the fact" bug
 * @param {number} parentRowId - ID of the parent row
 * @param {string} size - Size name (XS, XXL, 3XL, 4XL, 5XL, 6XL)
 */
export function getExtendedSizeQty(parentRowId, size) {
    // Normalize size aliases
    const normalizedSize = size === 'XXXL' ? '3XL' : size;

    // Check if there's a child row for this size. Dual-alias lookup (2026-06-11):
    // rows created before the XXXL→3XL key fix are stored under 'XXXL' — the old
    // single-key lookup missed them, the popup prefilled 3XL as blank, and Apply
    // then deleted the existing row (qty 0 + existing ⇒ remove).
    const ids = dtfState.childRowMap[parentRowId];
    const childKey = ids && (ids[normalizedSize] != null ? normalizedSize
        : (ids[size] != null ? size
        : (normalizedSize === '3XL' && ids['XXXL'] != null ? 'XXXL'
        : (normalizedSize === '2XL' && ids['XXL'] != null ? 'XXL' : null))));
    if (ids && childKey) {
        const childRowId = ids[childKey];
        // Money source: JS state (2026-06-11 P2). The popup prefill drives the
        // delete-on-Apply behavior (qty 0 + existing row ⇒ remove), so it must
        // read the same source the totals bill from. DOM .cell-qty is a
        // display-only fallback for rows that predate the state mirror.
        const stateChild = window.dtfQuoteBuilder?.childRows?.get(Number(childRowId));
        if (stateChild) return stateChild.qty || 0;
        const childRow = document.getElementById(`row-${childRowId}`);
        if (childRow) {
            const qtyCell = childRow.querySelector('.cell-qty');
            if (qtyCell) {
                const qty = parseInt(qtyCell.textContent) || 0;
                return qty;
            }
        }
    }

    // Fallback: check parent row's input for this size (if not yet converted to child row)
    // Note: 3XL, 4XL, 5XL, 6XL have NO parent input - they only exist in popup/child rows
    const parentRow = document.getElementById(`row-${parentRowId}`);
    if (parentRow) {
        // Map size to input data-size attribute (only XXL/2XL has parent input)
        let inputSize = normalizedSize;
        if (normalizedSize === '2XL') inputSize = '2XL';
        // 3XL+ only exist in popup/child rows, no parent input to check

        const sizeInput = parentRow.querySelector(`[data-size="${inputSize}"]`);
        if (sizeInput && !sizeInput.disabled && !sizeInput.classList.contains('xxxl-picker-btn')) {
            const val = parseInt(sizeInput.value) || 0;
            if (val > 0) {
                return val;
            }
        }
    }

    return 0;
}
// Expose to global scope for JS class to use

/**
 * Select a color for a child row (called from child row color picker)
 * @param {number} childRowId - ID of the child row
 * @param {number} parentRowId - ID of the parent row
 * @param {Element} optionEl - The clicked option element
 */
export function selectChildColor(childRowId, parentRowId, optionEl) {
    const childRow = document.getElementById(`row-${childRowId}`);
    if (!childRow) return;

    const colorName = optionEl.dataset.colorName;
    const catalogColor = optionEl.dataset.catalogColor;
    const swatchUrl = optionEl.dataset.swatchUrl;
    const hex = optionEl.dataset.hex || '#ccc';

    // Update child row data attributes
    childRow.dataset.color = colorName;
    childRow.dataset.catalogColor = catalogColor;
    childRow.dataset.swatchUrl = swatchUrl;
    childRow.dataset.hex = hex;
    childRow.dataset.colorManuallySet = 'true';  // Prevent cascade override

    // Update display
    const swatch = childRow.querySelector('.color-picker-selected .color-swatch');
    const nameSpan = childRow.querySelector('.color-picker-selected .color-name');

    if (swatch) {
        if (swatchUrl) {
            swatch.style.backgroundImage = `url('${swatchUrl}')`;
            swatch.style.backgroundColor = '';
            swatch.style.backgroundSize = 'cover';
            swatch.style.backgroundPosition = 'center';
        } else {
            swatch.style.backgroundImage = '';
            swatch.style.backgroundColor = hex;
        }
    }
    if (nameSpan) nameSpan.textContent = colorName;

    // Close dropdown
    const dropdown = childRow.querySelector('.color-picker-dropdown');
    if (dropdown) dropdown.classList.add('hidden');

    // Update visual indicator for different color
    updateChildRowColorIndicators(parentRowId);

    // Recalculate pricing
    if (dtfQuoteBuilder) {
        dtfQuoteBuilder.recalculatePricing();
    }

}

/**
 * Cascade parent's color change to child rows (unless manually overridden)
 * @param {number} parentRowId - ID of the parent row
 * @param {string} colorName - Display color name
 * @param {string} catalogColor - Catalog color code
 * @param {string} swatchUrl - URL to color swatch image
 * @param {string} hex - Hex color code
 */
export function cascadeColorToChildRows(parentRowId, colorName, catalogColor, swatchUrl, hex) {
    if (!dtfState.childRowMap[parentRowId]) return;

    Object.values(dtfState.childRowMap[parentRowId]).forEach(childRowId => {
        const childRow = document.getElementById(`row-${childRowId}`);
        if (!childRow) return;

        // Skip if user manually set this child's color
        if (childRow.dataset.colorManuallySet === 'true') return;

        // Update child row color data
        childRow.dataset.color = colorName;
        childRow.dataset.catalogColor = catalogColor;
        childRow.dataset.swatchUrl = swatchUrl || '';
        childRow.dataset.hex = hex || '#ccc';

        // Update color picker display
        const swatch = childRow.querySelector('.color-picker-selected .color-swatch');
        const nameSpan = childRow.querySelector('.color-picker-selected .color-name');

        if (swatch) {
            if (swatchUrl) {
                swatch.style.backgroundImage = `url('${swatchUrl}')`;
                swatch.style.backgroundColor = '';
                swatch.style.backgroundSize = 'cover';
                swatch.style.backgroundPosition = 'center';
            } else {
                swatch.style.backgroundImage = '';
                swatch.style.backgroundColor = hex || '#ccc';
            }
        }
        if (nameSpan) nameSpan.textContent = colorName;
    });

    // Update visual indicators
    updateChildRowColorIndicators(parentRowId);
}

/**
 * Update visual styling for child rows based on color match with parent
 * @param {number} parentRowId - ID of the parent row
 */
export function updateChildRowColorIndicators(parentRowId) {
    const parentRow = document.getElementById(`row-${parentRowId}`);
    if (!parentRow || !dtfState.childRowMap[parentRowId]) return;

    const parentCatalogColor = parentRow.dataset.catalogColor;

    Object.values(dtfState.childRowMap[parentRowId]).forEach(childRowId => {
        const childRow = document.getElementById(`row-${childRowId}`);
        if (!childRow) return;

        const childCatalogColor = childRow.dataset.catalogColor;

        // Add/remove visual indicator for different color
        if (childCatalogColor !== parentCatalogColor) {
            childRow.classList.add('different-color');
        } else {
            childRow.classList.remove('different-color');
        }
    });
}

// cleanProductTitle() — now provided by quote-builder-utils.js

// escapeHtml() is now provided by quote-builder-utils.js

export function updateProductThumbnail(rowId, imageUrl, productName, styleNumber, colorName) {
    const thumbContainer = document.getElementById(`thumb-${rowId}`);
    if (!thumbContainer) return;

    if (imageUrl) {
        const img = document.createElement('img');
        img.src = imageUrl;
        img.alt = productName || styleNumber;
        img.className = 'product-thumbnail';
        img.id = `thumb-${rowId}`;
        img.onclick = () => {
            if (window.productThumbnailModal) {
                productThumbnailModal.open(imageUrl, productName, styleNumber, colorName);
            }
        };
        img.onerror = () => {
            img.classList.add('no-image');
            img.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
        };
        thumbContainer.replaceWith(img);
    }
}

// getSwatchStyle() — now provided by quote-builder-utils.js

// showToast() is now provided by quote-builder-utils.js (fixed - no longer uses alert())

// Note: No auto-row on page load - users add products via search box
// The addProductRow() method handles row creation when selecting from search


// Save modal functions (from second inline block)
// Save modal functions
