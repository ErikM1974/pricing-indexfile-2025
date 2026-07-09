/**
 * SCP product-rows module — SCP decomposition S1a (2026-07-08).
 * Search/autocomplete, addNewRow/onStyleChange, size-category engine,
 * color picker + child rows (incl. the SCP duplicate-row auto-merge),
 * keyboard nav, and the page-level click-away listener. Moved verbatim.
 */
// @ts-nocheck — MOVED legacy DOM code (pre-existing checkJs frictions; typing lands with the render/state split).
/* global SIZE_TO_SUFFIX, EXTENDED_SIZE_ORDER, getAvailableExtendedSizes,
   markScreenPrintDirty, recalculatePricing, escapeHtml, showToast,
   SKUValidationService, ProductCategoryFilter, cleanProductTitle,
   getSwatchStyle, productThumbnailModal, Event */
import { scpState, API_BASE, SIZE06_EXTENDED_SIZES } from './state.js';

export function setupSearchAutocomplete() {
    const searchInput = document.getElementById('product-search');
    const suggestions = document.getElementById('search-suggestions');

    if (!searchInput || !window.ExactMatchSearch) {
        console.error('[ScreenPrint] Search input or ExactMatchSearch module not found');
        return;
    }

    // Initialize ExactMatchSearch with full keyboard navigation
    scpState.exactMatchSearcher = new window.ExactMatchSearch({
        apiBase: API_BASE,
        debounceMs: 300,  // Standardized debounce

        // Auto-load exact matches immediately
        onExactMatch: (product) => {
            searchInput.value = '';
            selectProduct(product.value);
        },

        // Show suggestions dropdown
        onSuggestions: (products) => {
            showSearchSuggestions(products);
        },

        // Keyboard navigation: update visual highlight
        // eslint-disable-next-line no-unused-vars -- verbatim (S1a): callback signature from ExactMatchSearch
        onNavigate: (selectedIndex, products) => {
            updateSearchSelectionHighlight(selectedIndex);
        },

        // Keyboard navigation: select item via Enter
        onSelect: (product) => {
            searchInput.value = '';
            selectProduct(product.value);
        },

        // Keyboard navigation: close dropdown via Escape
        onClose: () => {
            suggestions.classList.remove('show');
        }
    });

    // Wire up search input
    searchInput.addEventListener('input', function() {
        const query = this.value.trim();

        if (query.length < 2) {
            suggestions.classList.remove('show');
            return;
        }

        scpState.exactMatchSearcher.search(query);
    });

    // Handle keyboard navigation
    searchInput.addEventListener('keydown', function(e) {
        // Let ExactMatchSearch handle navigation keys
        if (scpState.exactMatchSearcher && scpState.exactMatchSearcher.handleKeyDown(e)) {
            return; // Event was handled
        }

        // Handle Enter for immediate search when nothing is selected
        if (e.key === 'Enter') {
            e.preventDefault();
            const query = searchInput.value.trim();
            if (query.length >= 2) {
                scpState.exactMatchSearcher.searchImmediate(query);
            }
        }
    });

    // Close suggestions when clicking outside
    document.addEventListener('click', function(e) {
        if (!e.target.closest('.search-input-wrapper')) {
            suggestions.classList.remove('show');
            if (scpState.exactMatchSearcher) scpState.exactMatchSearcher.resetNavigation();
        }
    });

}

/**
 * Show search suggestions dropdown
 */
function showSearchSuggestions(products) {
    const suggestions = document.getElementById('search-suggestions');

    if (!products || products.length === 0) {
        suggestions.innerHTML = '<div class="suggestion-item"><span>No products found</span></div>';
        suggestions.classList.add('show');
        return;
    }

    // eslint-disable-next-line no-unsanitized/property -- audited (1.4): map rows escapeHtml every value (stage-1 fix; rule cannot trace map/join chains)
    suggestions.innerHTML = products.map(product => {
        // Extract product name (remove style prefix from label)
        const productName = (product.label || '').split(' - ').slice(1).join(' - ') || '';
        return `
            <div class="suggestion-item" onclick="selectProduct('${escapeHtml(product.value)}')">
                <span class="style">${escapeHtml(product.value)}</span>
                <span class="name">${escapeHtml(productName)}</span>
            </div>
        `;
    }).join('');
    suggestions.classList.add('show');

    // Cache product data (convert to expected format)
    products.forEach(p => {
        scpState.productCache[p.value] = {
            STYLE: p.value,
            PRODUCT_TITLE: p.label
        };
    });
}

/**
 * Update visual highlight on selected suggestion item
 */
function updateSearchSelectionHighlight(selectedIndex) {
    const suggestions = document.getElementById('search-suggestions');
    if (!suggestions) return;

    suggestions.querySelectorAll('.suggestion-item').forEach((item, index) => {
        if (index === selectedIndex) {
            item.classList.add('selected');
            item.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        } else {
            item.classList.remove('selected');
        }
    });
}

export async function selectProduct(styleNumber) {
    const searchInput = document.getElementById('product-search');
    const suggestions = document.getElementById('search-suggestions');

    searchInput.value = '';
    suggestions.classList.remove('show');

    // Add product to table
    await addProductRow(styleNumber);
}

// ============================================================
// PRODUCT TABLE MANAGEMENT
// ============================================================

export function addNewRow() {
    const tbody = document.getElementById('product-tbody');
    const rowId = ++scpState.rowCounter;

    // Hide empty state message when adding first row
    const emptyStateRow = document.getElementById('empty-state-row');
    if (emptyStateRow) emptyStateRow.style.display = 'none';

    const row = document.createElement('tr');
    row.id = `row-${rowId}`;
    row.className = 'new-row';
    row.dataset.rowId = rowId;

    // eslint-disable-next-line no-unsanitized/property -- audited (1.4): interpolations escapeHtml-wrapped or numeric at build
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
        <td><input type="number" class="cell-input size-input" data-size="S" aria-label="Quantity S" min="0" value="" placeholder="0" onchange="onSizeChange(${rowId})" onkeydown="handleCellKeydown(event, this)" disabled></td>
        <td><input type="number" class="cell-input size-input" data-size="M" aria-label="Quantity M" min="0" value="" placeholder="0" onchange="onSizeChange(${rowId})" onkeydown="handleCellKeydown(event, this)" disabled></td>
        <td><input type="number" class="cell-input size-input" data-size="L" aria-label="Quantity L" min="0" value="" placeholder="0" onchange="onSizeChange(${rowId})" onkeydown="handleCellKeydown(event, this)" disabled></td>
        <td><input type="number" class="cell-input size-input" data-size="XL" aria-label="Quantity XL" min="0" value="" placeholder="0" onchange="onSizeChange(${rowId})" onkeydown="handleCellKeydown(event, this)" disabled></td>
        <td><input type="number" class="cell-input size-input" data-size="2XL" aria-label="Quantity 2XL" min="0" value="" placeholder="0" onchange="onSizeChange(${rowId})" onkeydown="handleCellKeydown(event, this)" disabled></td>
        <td><input type="text" class="cell-input size-input xxxl-picker-btn" data-size="3XL" aria-label="Quantity 3XL" value="" placeholder="+" readonly onclick="openExtendedSizePopup(${rowId})" onkeydown="if(event.key==='Enter'){openExtendedSizePopup(${rowId})}" disabled title="Click to add extended sizes (3XL, 4XL, 5XL, XS, etc.)"></td>
        <td class="cell-qty" id="row-qty-${rowId}">0</td>
        <td class="cell-price" id="row-price-${rowId}">-</td>
        <td class="cell-total" id="row-total-${rowId}">-</td>
        <td class="cell-actions">
            <button class="btn-duplicate-row" onclick="duplicateRowNewColor(${rowId})" title="Add another color of this style" disabled>
                <i class="fas fa-copy"></i>
            </button>
            <button class="btn-delete-row" onclick="deleteRow(${rowId})" title="Delete row">
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

async function addProductRow(styleNumber) {
    // Find or create empty row
    let targetRow = document.querySelector('tr.new-row');
    if (!targetRow) {
        addNewRow();
        targetRow = document.querySelector('tr.new-row');
    }

    const rowId = targetRow.dataset.rowId;
    const styleInput = targetRow.querySelector('.style-input');
    styleInput.value = styleNumber;

    await onStyleChange(styleInput, parseInt(rowId));
}

export async function onStyleChange(input, rowId) {
    const styleNumber = input.value.trim().toUpperCase();
    if (!styleNumber) return;

    const row = document.getElementById(`row-${rowId}`);
    const descInput = row.querySelector('[data-field="description"]');
    // eslint-disable-next-line no-unused-vars -- verbatim (S1a): unused in monolith
    const pickerWrapper = row.querySelector('.color-picker-wrapper');
    const pickerSelected = row.querySelector('.color-picker-selected');
    const pickerDropdown = row.querySelector('.color-picker-dropdown');

    try {
        // Fetch product data using stylesearch API
        let product = scpState.productCache[styleNumber];
        if (!product) {
            const response = await fetch(`${API_BASE}/api/stylesearch?term=${styleNumber}`);
            const data = await response.json();
            if (data && data.length > 0) {
                // Find exact match or use first result
                const exactMatch = data.find(p => p.value.toUpperCase() === styleNumber);
                const result = exactMatch || data[0];
                product = {
                    STYLE: result.value,
                    PRODUCT_TITLE: result.label
                };
                scpState.productCache[styleNumber] = product;
            }
        }

        if (product) {
            // Pants products (PT20, etc.) are now supported via size picker popup
            // Size category detection will handle waist/inseam sizing

            // Clean product title (remove duplicate style numbers from API response)
            const cleanTitle = cleanProductTitle(product.PRODUCT_TITLE, styleNumber);

            // Update description with clean title
            descInput.value = cleanTitle || styleNumber;

            // Fetch colors using product-colors API (also returns CATEGORY_NAME)
            const colorsResponse = await fetch(`${API_BASE}/api/product-colors?styleNumber=${styleNumber}`);
            const colorsData = await colorsResponse.json();
            const colors = colorsData.colors || [];

            // Store product category from API
            const categoryName = colorsData.CATEGORY_NAME || '';
            row.dataset.category = categoryName;

            // Screen Print can print both garments and caps
            const isCap = isCapProduct(styleNumber, product.PRODUCT_TITLE, categoryName);
            row.dataset.isCap = isCap ? 'true' : 'false';

            if (colors && colors.length > 0) {
                // Populate custom color picker dropdown with swatches
                // eslint-disable-next-line no-unsanitized/property -- audited (1.4): COLOR_NAME/CATALOG_COLOR escapeHtml-wrapped; swatch via hardened getSwatchStyle (C32)
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

                // Enable the picker
                pickerSelected.classList.remove('disabled');

                // Store colors for later (child rows, etc.)
                row.dataset.colors = JSON.stringify(colors);
            }

            // Store product info
            row.dataset.style = styleNumber;
            row.dataset.productName = cleanTitle || styleNumber;

            // Enable "duplicate row" button now that style is loaded (covers fresh
            // entry, edit-load, quick-quote prefill — every path runs onStyleChange)
            const dupBtn = row.querySelector('.btn-duplicate-row');
            if (dupBtn) dupBtn.disabled = false;

        } else {
            descInput.value = 'Not found';
            showToast(`Style ${styleNumber} not found`, 'error');
        }
    } catch (error) {
        console.error('Error loading product:', error);
        showToast('Error loading product', 'error');
    }
}

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

// escapeHtml() is now provided by quote-builder-utils.js

/**
 * Update product thumbnail when color is selected
 */
function updateProductThumbnail(rowId, imageUrl, productName, styleNumber, colorName) {
    const thumbContainer = document.getElementById(`thumb-${rowId}`);
    if (!thumbContainer) return;

    if (imageUrl) {
        // Replace placeholder with actual thumbnail
        const img = document.createElement('img');
        img.src = imageUrl;
        img.alt = productName || styleNumber;
        img.className = 'product-thumbnail';
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
        img.id = `thumb-${rowId}`;
    }
}

/**
 * cleanProductTitle() — now provided by quote-builder-utils.js
 */

// Position abbreviation mapping for compact breakdown display
// eslint-disable-next-line no-unused-vars -- dead in the monolith too (zero callers repo-wide, incl. generated markup); kept verbatim (S1a).
const POSITION_ABBREV = {
    'Left Chest': 'LC', 'Right Chest': 'RC', 'Center Chest': 'CC',
    'Full Front': 'FF', 'Full Back': 'FB', 'Upper Back': 'UB',
    'Left Sleeve': 'LS', 'Right Sleeve': 'RS',
    'CF': 'CF', 'CB': 'CB', 'CL': 'CL', 'CR': 'CR',
    'Cap Front': 'CF', 'Cap Back': 'CB'
};

// Full names for tooltip display
// eslint-disable-next-line no-unused-vars -- dead in the monolith too (zero callers repo-wide, incl. generated markup); kept verbatim (S1a).
const POSITION_FULL_NAMES = {
    'LC': 'Left Chest', 'RC': 'Right Chest', 'CC': 'Center Chest',
    'FF': 'Full Front', 'FB': 'Full Back', 'UB': 'Upper Back',
    'LS': 'Left Sleeve', 'RS': 'Right Sleeve',
    'CF': 'Cap Front', 'CB': 'Cap Back', 'CL': 'Cap Left Side', 'CR': 'Cap Right Side'
};

// formatPrice() is now provided by quote-builder-utils.js

/**
 * Build pricing breakdown HTML for a product row
 * Shows compact format: └─ LC 10K | Base $23 + Extra $2.50 = $25.50/ea
 * Includes hover tooltip with full calculation details
 *
 * @param {Object} product - Product data with isCap flag
 * @param {Object} lineItem - Line item from pricing calculator
 * @param {Object} logoConfig - Logo configuration (position, stitchCount)
 * @returns {string} HTML string for breakdown
 */
// buildPricingBreakdown() and updateRowBreakdown() removed — dead code (embroidery-specific, never called in screenprint)

/**
 * Check if a style number is a cap/hat product
 * @param {string} style - Style number
 * @param {string} productTitle - Product title/description
 * @param {string} categoryName - CATEGORY_NAME from SanMar API (most reliable)
 * @returns {boolean} True if cap/hat
 */
function isCapProduct(style, productTitle = '', categoryName = '') {
    // PRIORITY: Flat headwear (beanies, knit caps) use garment pricing, NOT cap pricing
    if (typeof ProductCategoryFilter !== 'undefined' && productTitle) {
        if (ProductCategoryFilter.isFlatHeadwear({ PRODUCT_TITLE: productTitle })) {
            return false;
        }
    }

    // BEST METHOD: Check CATEGORY_NAME from SanMar API
    // SanMar categorizes all caps/hats under "Caps" category
    if (categoryName && categoryName.toLowerCase() === 'caps') {
        return true;
    }

    // FALLBACK: Pattern matching for cases where category isn't available
    if (!style) return false;
    const styleUpper = style.toUpperCase();
    const titleUpper = (productTitle || '').toUpperCase();

    // Check style patterns:
    // CP* caps (CP80, CP90, etc)
    // NE* caps (NE1000, NE400)
    // C+digit (C112, C118)
    // Richardson styles (112, 110, 115, etc) - numeric only
    if (/^C[P0-9]/.test(styleUpper) || styleUpper.startsWith('NE')) {
        return true;
    }

    // Richardson caps - 2-3 digit numeric styles (100-999)
    if (/^\d{2,3}$/.test(styleUpper)) {
        return true;
    }

    // Check title keywords
    if (titleUpper.includes('CAP') || titleUpper.includes('HAT') ||
        titleUpper.includes('BEANIE') || titleUpper.includes('SNAPBACK') ||
        titleUpper.includes('TRUCKER') || titleUpper.includes('RICHARDSON')) {
        return true;
    }

    return false;
}

/**
 * Check if product is pants (waist/inseam sizing not supported)
 * @param {string} style - Style number
 * @param {string} productTitle - Product title/description
 * @returns {boolean} True if pants
 */
// eslint-disable-next-line no-unused-vars -- dead in the monolith too (zero callers repo-wide, incl. generated markup); kept verbatim (S1a).
function isPantsProduct(style, productTitle = '') {
    if (!style) return false;
    const styleUpper = style.toUpperCase();
    const titleUpper = (productTitle || '').toUpperCase();

    // Red Kap work pants (PT prefix)
    if (styleUpper.startsWith('PT') && /^PT\d/.test(styleUpper)) return true;

    // Title keywords for pants
    if (titleUpper.includes('PANT') || titleUpper.includes('WORK PANT') ||
        titleUpper.includes('CARGO') || titleUpper.includes('TROUSER') ||
        titleUpper.includes('INDUSTRIAL PANT')) {
        return true;
    }

    return false;
}

/**
 * Analyze available sizes and determine the product's size category
 * Handles OSFA, combo sizes, youth, toddler, tall, and standard products
 * @param {string[]} availableSizes - Array of available sizes from API
 * @returns {Object} Category info with display configuration
 */
function analyzeSizeCategory(availableSizes) {
    if (!availableSizes || availableSizes.length === 0) {
        return { category: 'unknown', columns: [], useQtyOnly: false };
    }

    const sizes = availableSizes.map(s => s.toUpperCase());
    const STANDARD = ['S', 'M', 'L', 'XL'];
    const COMBO = ['S/M', 'M/L', 'L/XL', 'XS/S', 'X/2X'];
    const YOUTH = ['YXS', 'YS', 'YM', 'YL', 'YXL'];
    const TODDLER = ['2T', '3T', '4T', '5T', '5/6T', '6T'];
    const TALL = ['LT', 'XLT', '2XLT', '3XLT', '4XLT', '5XLT', '6XLT', 'ST', 'MT'];
    const ONE_SIZE = ['OSFA', 'OSFM'];
    const PANTS_PATTERN = /^\d{4}$/;  // 4-digit waist/inseam codes like 2737, 2830
    const WAIST_ONLY_PATTERN = /^W\d{2}$/;  // Waist-only codes like W30, W32 (PT66 shorts)

    // Count sizes in each category for dominant detection
    const youthCount = sizes.filter(s => YOUTH.includes(s)).length;
    const toddlerCount = sizes.filter(s => TODDLER.includes(s)).length;
    const tallCount = sizes.filter(s => TALL.includes(s)).length;
    const comboCount = sizes.filter(s => COMBO.includes(s)).length;
    const osfaCount = sizes.filter(s => ONE_SIZE.includes(s)).length;
    const standardCount = sizes.filter(s => STANDARD.includes(s)).length;
    const pantsCount = sizes.filter(s => PANTS_PATTERN.test(s)).length;
    const waistOnlyCount = sizes.filter(s => WAIST_ONLY_PATTERN.test(s)).length;

    // Priority 1a: Waist-only shorts (W30, W32, etc. - PT66, CT103542)
    if (waistOnlyCount > 0 && waistOnlyCount >= sizes.length / 2) {
        // Extract all valid waist-only sizes
        const waistSizes = sizes.filter(s => WAIST_ONLY_PATTERN.test(s));
        return {
            category: 'shorts',
            columns: [],
            useQtyOnly: false,
            shortsSizes: waistSizes,
            baseSize: waistSizes[0],
            message: 'Select waist sizes'
        };
    }

    // Priority 1b: Pants (waist/inseam sizes like 3032 for 30x32)
    if (pantsCount > 0 && pantsCount >= sizes.length / 2) {
        // Extract all valid pants sizes (4-digit codes)
        const pantsSizes = sizes.filter(s => PANTS_PATTERN.test(s));
        return {
            category: 'pants',
            columns: [],
            useQtyOnly: false,
            pantsSizes: pantsSizes,
            baseSize: pantsSizes[0],
            message: 'Select waist/inseam sizes'
        };
    }

    // Priority 2: OSFA-only (caps, bags, beanies)
    if (osfaCount > 0 && osfaCount === sizes.length) {
        return {
            category: 'osfa-only',
            columns: [],
            useQtyOnly: true,
            baseSize: sizes[0],
            message: 'One Size Fits All'
        };
    }

    // Priority 3: Combo-only (fitted caps like NE1000)
    if (comboCount > 0 && comboCount === sizes.length) {
        return {
            category: 'combo-only',
            columns: sizes,
            useQtyOnly: false,
            baseSize: sizes[0]
        };
    }

    // Priority 4: Youth-dominant (has youth sizes AND more youth than standard)
    // PC61Y returns both S,M,L,XL AND YS,YM,YL,YXL - youth should win
    if (youthCount > 0 && youthCount >= standardCount) {
        return {
            category: 'youth-only',
            columns: YOUTH.filter(y => sizes.includes(y)),
            useQtyOnly: false,
            baseSize: sizes.find(s => YOUTH.includes(s)) || sizes[0]
        };
    }

    // Priority 5: Toddler-dominant
    if (toddlerCount > 0 && toddlerCount >= standardCount) {
        return {
            category: 'toddler-only',
            columns: TODDLER.filter(t => sizes.includes(t)),
            useQtyOnly: false,
            baseSize: sizes.find(s => TODDLER.includes(s)) || sizes[0]
        };
    }

    // Priority 6: Tall-dominant (LT, XLT without S, M, L, XL)
    if (tallCount > 0 && standardCount === 0) {
        return {
            category: 'tall-only',
            columns: sizes.filter(s => TALL.includes(s) || s === '2XL'),
            useQtyOnly: false,
            baseSize: sizes.find(s => TALL.includes(s)) || sizes[0]
        };
    }

    // Priority 7: Standard (has S, M, L, XL as dominant)
    if (standardCount > 0) {
        return {
            category: 'standard',
            columns: ['S', 'M', 'L', 'XL', '2XL'],
            useQtyOnly: false,
            baseSize: 'S',
            extendedSizes: sizes.filter(s => !STANDARD.includes(s) && s !== '2XL')
        };
    }

    // Fallback for unknown patterns
    return {
        category: 'other',
        columns: sizes.slice(0, 5),
        useQtyOnly: false,
        baseSize: sizes[0]
    };
}

/**
 * Update row UI based on size category
 * Handles OSFA (single qty input), combo sizes, and other non-standard layouts
 * @param {HTMLElement} row - The product row element
 * @param {Object} sizeInfo - Result from analyzeSizeCategory()
 */
function updateRowForSizeCategory(row, sizeInfo) {
    const rowId = row.dataset.rowId;
    const sizeInputs = row.querySelectorAll('.size-input:not(.xxxl-picker-btn)');
    const xxxlCell = row.querySelector('.xxxl-picker-btn');

    // Store category info for later use
    row.dataset.sizeCategory = sizeInfo.category;
    row.dataset.baseSize = sizeInfo.baseSize || '';

    // Handle PANTS (waist/inseam sizes) - use size picker popup
    if (sizeInfo.category === 'pants') {
        // Disable all size columns (parent row doesn't take quantities)
        sizeInputs.forEach(input => {
            input.disabled = true;
            input.value = '';
            input.placeholder = '-';
            input.closest('td').classList.add('size-disabled');
        });

        // Enable XXXL cell as "Select Sizes" picker button
        if (xxxlCell && sizeInfo.pantsSizes && sizeInfo.pantsSizes.length > 0) {
            row.dataset.pantsSizes = JSON.stringify(sizeInfo.pantsSizes);
            row.dataset.extendedSizes = JSON.stringify(sizeInfo.pantsSizes); // For compatibility
            xxxlCell.classList.add('pants-picker-btn');
            xxxlCell.disabled = false;
            xxxlCell.placeholder = '+';
            xxxlCell.closest('td').classList.remove('size-disabled');
        } else if (xxxlCell) {
            xxxlCell.disabled = true;
            xxxlCell.placeholder = '-';
            xxxlCell.closest('td').classList.add('size-disabled');
        }

        row.classList.add('pants-row');
        row.classList.add('non-standard-sizes');
        showToast('Pants product - click + to select waist/inseam sizes', 'info', 4000);
        return;
    }

    // Handle SHORTS (waist-only sizes like W30, W32) - use size picker popup
    if (sizeInfo.category === 'shorts') {
        // Disable all size columns (parent row doesn't take quantities)
        sizeInputs.forEach(input => {
            input.disabled = true;
            input.value = '';
            input.placeholder = '-';
            input.closest('td').classList.add('size-disabled');
        });

        // Enable XXXL cell as "Select Sizes" picker button
        if (xxxlCell && sizeInfo.shortsSizes && sizeInfo.shortsSizes.length > 0) {
            row.dataset.shortsSizes = JSON.stringify(sizeInfo.shortsSizes);
            row.dataset.extendedSizes = JSON.stringify(sizeInfo.shortsSizes); // For compatibility
            row.dataset.sizeCategory = 'shorts'; // Ensure category is set
            xxxlCell.classList.add('shorts-picker-btn');
            xxxlCell.disabled = false;
            xxxlCell.placeholder = '+';
            xxxlCell.closest('td').classList.remove('size-disabled');
        } else if (xxxlCell) {
            xxxlCell.disabled = true;
            xxxlCell.placeholder = '-';
            xxxlCell.closest('td').classList.add('size-disabled');
        }

        row.classList.add('shorts-row');
        row.classList.add('non-standard-sizes');
        showToast('Shorts product - click + to select waist sizes', 'info', 4000);
        return;
    }

    if (sizeInfo.useQtyOnly) {
        // OSFA-only: Hide all size columns, convert to single qty input
        sizeInputs.forEach(input => {
            input.disabled = true;
            input.value = '';
            input.placeholder = '-';
            input.closest('td').classList.add('size-disabled');
        });

        // Convert XXXL cell to qty input for OSFA
        if (xxxlCell) {
            xxxlCell.classList.remove('xxxl-picker-btn');
            xxxlCell.classList.add('osfa-qty-input');
            xxxlCell.removeAttribute('readonly');
            xxxlCell.type = 'number';
            xxxlCell.min = '0';
            xxxlCell.placeholder = 'Qty';
            xxxlCell.value = '';
            xxxlCell.disabled = false;
            xxxlCell.onclick = null;
            xxxlCell.onkeydown = null;
            xxxlCell.onchange = () => onOSFAQtyChange(rowId);
            xxxlCell.closest('td').classList.remove('size-disabled');
        }

        // Update header for this row (visual indicator)
        row.classList.add('osfa-only-row');

    } else if (sizeInfo.category === 'tall-only') {
        // TALL products: All sizes via extended size popup (like OSFA but with size picker)
        // Parent row has disabled columns; child rows handle each tall size
        const ALL_TALL = ['LT', 'XLT', '2XLT', '3XLT', '4XLT', '5XLT', '6XLT'];
        const availableTallSizes = ALL_TALL.filter(s => sizeInfo.columns.includes(s));

        // Disable ALL size columns (parent row doesn't take quantities)
        // eslint-disable-next-line no-unused-vars -- verbatim (S1a): unused forEach index in monolith
        sizeInputs.forEach((input, index) => {
            input.disabled = true;
            input.value = '';
            input.placeholder = '-';
            input.closest('td').classList.add('size-disabled');
        });

        // Enable XXXL picker for ALL tall sizes
        if (availableTallSizes.length > 0 && xxxlCell) {
            row.dataset.extendedSizes = JSON.stringify(availableTallSizes);
            xxxlCell.disabled = false;
            xxxlCell.placeholder = '+';
            xxxlCell.closest('td').classList.remove('size-disabled');
        } else if (xxxlCell) {
            xxxlCell.disabled = true;
            xxxlCell.placeholder = '-';
            xxxlCell.closest('td').classList.add('size-disabled');
        }

        row.classList.add('non-standard-sizes');
        row.classList.add('tall-only-row');

    } else if (sizeInfo.category !== 'standard' && sizeInfo.category !== 'unknown') {
        // Non-standard columns (combo, youth, toddler)
        const columns = sizeInfo.columns;

        sizeInputs.forEach((input, index) => {
            if (index < columns.length) {
                // Remap this column to new size
                const newSize = columns[index];
                input.dataset.size = newSize;
                input.disabled = false;
                input.placeholder = '0';
                input.closest('td').classList.remove('size-disabled');

                // Update column header visually
                updateColumnLabel(row, index, newSize);
            } else {
                // Hide extra columns
                input.disabled = true;
                input.value = '';
                input.placeholder = '-';
                input.closest('td').classList.add('size-disabled');
            }
        });

        // Handle XXXL picker based on extended sizes
        if (!sizeInfo.extendedSizes || sizeInfo.extendedSizes.length === 0) {
            if (xxxlCell) {
                xxxlCell.disabled = true;
                xxxlCell.placeholder = '-';
                xxxlCell.closest('td').classList.add('size-disabled');
            }
        }

        // Add visual indicator class
        row.classList.add('non-standard-sizes');
    }
    // Standard category keeps default UI
}

/**
 * Update column label for a specific row's size input
 * Creates inline label overlay showing the actual size name
 */
function updateColumnLabel(row, colIndex, newLabel) {
    const sizeInputs = row.querySelectorAll('.size-input:not(.xxxl-picker-btn)');
    const input = sizeInputs[colIndex];
    if (!input) return;

    const td = input.closest('td');

    // Add a label overlay showing the size
    let label = td.querySelector('.size-label-override');
    if (!label) {
        label = document.createElement('span');
        label.className = 'size-label-override';
        td.insertBefore(label, input);
    }
    label.textContent = newLabel;
}

/**
 * Handle quantity change for OSFA-only products
 * Updates dataset, qty display, and triggers pricing recalculation
 */
function onOSFAQtyChange(rowId) {
    const row = document.getElementById(`row-${rowId}`);
    if (!row) return;

    const osfaInput = row.querySelector('.osfa-qty-input');
    const qty = parseInt(osfaInput?.value) || 0;

    // Store OSFA qty in dataset
    row.dataset.osfaQty = qty;
    row.dataset.isOsfaOnly = 'true';

    // Update qty display
    const qtyDisplay = document.getElementById(`row-qty-${rowId}`);
    if (qtyDisplay) qtyDisplay.textContent = qty;

    // Trigger pricing recalculation
    recalculatePricing();
}

/**
 * Fetch available sizes and adjust UI based on product type
 * Called after color selection to determine proper size columns
 */
async function detectAndAdjustSizeUI(rowId) {
    const row = document.getElementById(`row-${rowId}`);
    if (!row) return;

    const styleNumber = row.dataset.style;
    const catalogColor = row.dataset.catalogColor;

    if (!styleNumber || !catalogColor) return;

    // =========================================
    // CAP SPECIAL HANDLING
    // Caps use /api/sizes-by-style-color endpoint
    // =========================================
    if (row.dataset.isCap === 'true') {
        try {
            const capUrl = `${API_BASE}/api/sizes-by-style-color?styleNumber=${encodeURIComponent(styleNumber)}&color=${encodeURIComponent(catalogColor)}`;
            const capResponse = await fetch(capUrl);

            let capSizes = ['OSFA']; // Default fallback
            if (capResponse.ok) {
                const capData = await capResponse.json();
                const sizes = capData.data || capData.sizes || capData;
                if (Array.isArray(sizes) && sizes.length > 0) {
                    capSizes = sizes;
                }
            } else {
                console.warn(`[Cap Sizes] API failed for ${styleNumber}, using OSFA fallback`);
            }


            // Analyze cap sizes and update UI
            const sizeInfo = analyzeSizeCategory(capSizes);

            updateRowForSizeCategory(row, sizeInfo);
            row.dataset.availableSizes = JSON.stringify(capSizes);
            row.dataset.capSizes = JSON.stringify(capSizes);
            return; // Exit - cap handling complete
        } catch (capError) {
            console.error('[Cap Sizes] Error fetching cap sizes:', capError);
            // Fall through to use OSFA
            const osfaInfo = { category: 'osfa-only', columns: [], useQtyOnly: true, baseSize: 'OSFA', message: 'One Size Fits All' };
            updateRowForSizeCategory(row, osfaInfo);
            row.dataset.availableSizes = JSON.stringify(['OSFA']);
            row.dataset.capSizes = JSON.stringify(['OSFA']);
            return;
        }
    }

    // =========================================
    // STANDARD GARMENT HANDLING
    // =========================================
    try {
        // Fetch all available sizes for this style+color
        const url = `${API_BASE}/api/sanmar-shopworks/import-format?styleNumber=${encodeURIComponent(styleNumber)}&color=${encodeURIComponent(catalogColor)}`;
        const response = await fetch(url);

        if (!response.ok) {
            console.error(`[Size Detection] API failed for ${styleNumber}:`);
            console.error(`  Status: ${response.status} ${response.statusText}`);
            console.error(`  URL: ${url}`);
            console.error(`  CatalogColor: ${catalogColor}`);

            // Try fallback: fetch without color filter to at least get size info
            try {
                const altUrl = `${API_BASE}/api/sanmar-shopworks/import-format?styleNumber=${encodeURIComponent(styleNumber)}`;
                const altResponse = await fetch(altUrl);

                if (altResponse.ok) {
                    const skus = await altResponse.json();
                    if (skus && skus.length > 0) {
                        const allSizes = extractAllSizes(skus);
                        const sizeInfo = analyzeSizeCategory(allSizes);
                        updateRowForSizeCategory(row, sizeInfo);
                        row.dataset.availableSizes = JSON.stringify(allSizes);
                        return;
                    }
                }
            } catch (fallbackError) {
                console.error('[Size Detection] Fallback also failed:', fallbackError);
            }
            return;
        }

        const skus = await response.json();

        // Extract ALL available sizes (not just Size06)
        const allSizes = extractAllSizes(skus);

        // Analyze and update UI
        const sizeInfo = analyzeSizeCategory(allSizes);

        updateRowForSizeCategory(row, sizeInfo);

        // Store for pricing calculations
        row.dataset.availableSizes = JSON.stringify(allSizes);

        // Validate size availability using SKU service
        validateSizeAvailability(row, allSizes);

    } catch (error) {
        console.error('Error detecting size category:', error);
    }
}

/**
 * Validate size availability and update UI indicators
 * Uses SKUValidationService to check which sizes exist in ShopWorks
 *
 * @param {HTMLElement} row - Product row element
 * @param {string[]} availableSizes - Sizes available for this product/color
 */
function validateSizeAvailability(row, availableSizes) {
    if (!row || !availableSizes) return;

    const styleNumber = row.dataset.style;
    // eslint-disable-next-line no-unused-vars -- verbatim (S1a): unused in monolith
    const catalogColor = row.dataset.catalogColor;
    const skuService = window.skuValidationService || new SKUValidationService();
    window.skuValidationService = skuService; // Cache for reuse

    // Get all size inputs in this row
    const sizeInputs = row.querySelectorAll('.size-input:not(.xxxl-picker-btn)');
    const xxxlCell = row.querySelector('.xxxl-picker-btn');

    // Standard size columns (S, M, L, XL, XXL)
    const columnSizes = ['S', 'M', 'L', 'XL', '2XL'];

    sizeInputs.forEach((input, index) => {
        const size = columnSizes[index];
        if (!size) return;

        const isAvailable = availableSizes.includes(size);
        const sku = skuService.sanmarToShopWorksSKU(styleNumber, size);

        // Update input state based on availability
        if (isAvailable) {
            input.classList.add('size-available');
            input.classList.remove('size-unavailable');
            input.disabled = false;
            input.placeholder = '0';
            input.title = `${size} (SKU: ${sku})`;
        } else {
            input.classList.add('size-unavailable');
            input.classList.remove('size-available');
            input.disabled = true;
            input.value = '';
            input.placeholder = 'N/A';
            input.title = `${size} not available for this style/color`;
            input.closest('td')?.classList.add('size-disabled');
        }

        // Store SKU on input for reference
        input.dataset.sku = sku;
    });

    // Update extended size picker (XXXL column) if present
    if (xxxlCell && !xxxlCell.classList.contains('osfa-qty-input')) {
        const extendedSizes = availableSizes.filter(s =>
            !columnSizes.includes(s) && s !== 'OSFA'
        );
        const hasExtended = extendedSizes.length > 0;

        if (hasExtended) {
            xxxlCell.classList.remove('size-unavailable');
            xxxlCell.disabled = false;
            xxxlCell.title = `Extended sizes: ${extendedSizes.join(', ')}`;
            row.dataset.extendedSizes = JSON.stringify(extendedSizes);
        } else {
            xxxlCell.classList.add('size-unavailable');
            xxxlCell.disabled = true;
            xxxlCell.placeholder = '-';
            xxxlCell.title = 'No extended sizes available';
        }
    }

}

/**
 * Extract ALL sizes from SKU data (Size01-06 fields)
 * Returns sizes in logical display order
 */
function extractAllSizes(skus) {
    const sizes = new Set();

    skus.forEach(sku => {
        ['Size01', 'Size02', 'Size03', 'Size04', 'Size05', 'Size06'].forEach(field => {
            if (sku[field] && typeof sku[field] === 'string' && sku[field].trim()) {
                sizes.add(sku[field].trim());
            }
        });
    });

    // Return in logical order
    const ORDER = ['S', 'M', 'L', 'XL', '2XL', 'XS', 'S/M', 'M/L', 'L/XL',
                   'YXS', 'YS', 'YM', 'YL', 'YXL', '2T', '3T', '4T', '5T', '6T',
                   'LT', 'XLT', '2XLT', '3XLT', 'OSFA', 'OSFM'];
    return [...sizes].sort((a, b) => {
        const ai = ORDER.indexOf(a);
        const bi = ORDER.indexOf(b);
        if (ai === -1 && bi === -1) return a.localeCompare(b);
        if (ai === -1) return 1;
        if (bi === -1) return -1;
        return ai - bi;
    });
}

// getSwatchStyle() — now provided by quote-builder-utils.js

// ============================================================
// COLOR PICKER FUNCTIONS
// ============================================================

/**
 * Toggle color picker dropdown open/closed
 */
export function toggleColorPicker(rowId) {
    const row = document.getElementById(`row-${rowId}`);
    const pickerSelected = row.querySelector('.color-picker-selected');
    const dropdown = row.querySelector('.color-picker-dropdown');

    // Don't open if disabled
    if (pickerSelected.classList.contains('disabled')) return;

    // Close all other open dropdowns first
    document.querySelectorAll('.color-picker-dropdown').forEach(d => {
        if (d !== dropdown) d.classList.add('hidden');
    });

    // Toggle this dropdown
    dropdown.classList.toggle('hidden');

    // 7.2 a11y: listbox semantics. Options are populated dynamically, so stamp
    // role/id/aria-selected lazily on open; keep aria-expanded truthful.
    const nowOpen = !dropdown.classList.contains('hidden');
    pickerSelected.setAttribute('aria-expanded', String(nowOpen));
    if (nowOpen) {
        dropdown.querySelectorAll('.color-picker-option').forEach((opt, oi) => {
            opt.setAttribute('role', 'option');
            if (!opt.id) opt.id = `${dropdown.id || 'color-dropdown'}-opt-${oi}`;
            opt.setAttribute('aria-selected', String(opt.classList.contains('selected')));
        });
    } else {
        pickerSelected.removeAttribute('aria-activedescendant');
    }

    // Scroll selected option into view if open
    if (!dropdown.classList.contains('hidden')) {
        const selectedOption = dropdown.querySelector('.color-picker-option.selected');
        if (selectedOption) {
            selectedOption.scrollIntoView({ block: 'nearest' });
        }
    }
}

/**
 * Detect if product is tall/youth/toddler-only and gray out unavailable size columns
 * This improves UX by showing users which sizes actually exist for the product
 */
// eslint-disable-next-line no-unused-vars -- dead in the monolith too (zero callers repo-wide, incl. generated markup); kept verbatim (S1a).
async function detectProductTypeAndAdjustUI(rowId) {
    const row = document.getElementById(`row-${rowId}`);
    if (!row) return;

    const style = row.dataset.style;
    const catalogColor = row.dataset.catalogColor;
    if (!style || !catalogColor) return;

    try {
        // Fetch available sizes from API
        const availableSizes = await getAvailableExtendedSizes(style, catalogColor);

        // Check for standard sizes (S, M, L, XL)
        const standardSizeLabels = ['S', 'M', 'L', 'XL'];
        const hasStandardSizes = standardSizeLabels.some(s => availableSizes.includes(s));

        // Detect tall/youth/toddler-only products
        const tallSizes = ['LT', 'XLT', '2XLT', '3XLT', '4XLT', '5XLT', '6XLT', 'ST', 'MT', 'XST'];
        const youthSizes = ['YXS', 'YS', 'YM', 'YL', 'YXL'];
        const toddlerSizes = ['2T', '3T', '4T', '5T', '5/6T', '6T'];

        const hasTallOnly = !hasStandardSizes && availableSizes.some(s => tallSizes.includes(s));
        const hasYouthOnly = !hasStandardSizes && availableSizes.some(s => youthSizes.includes(s));
        const hasToddlerOnly = !hasStandardSizes && availableSizes.some(s => toddlerSizes.includes(s));

        if (hasTallOnly || hasYouthOnly || hasToddlerOnly) {
            // Gray out standard size columns - they don't exist for this product
            standardSizeLabels.forEach(size => {
                const input = row.querySelector(`input[data-size="${size}"]`);
                if (input) {
                    input.disabled = true;
                    input.value = '';
                    input.placeholder = 'N/A';
                    input.style.backgroundColor = '#f0f0f0';
                    input.style.color = '#999';
                    input.title = 'Size not available for this product';
                }
            });

            // Store product type for reference
            row.dataset.productType = hasTallOnly ? 'tall-only' :
                                       hasYouthOnly ? 'youth-only' : 'toddler-only';

            // Focus on the extended size picker instead
            const xxxlInput = row.querySelector('input[data-size="3XL"]');
            if (xxxlInput) xxxlInput.focus();
        }
    } catch (error) {
        console.warn('Could not detect product type for UI adjustment:', error);
    }
}

/**
 * Select a color from the dropdown
 */
export function selectColor(rowId, optionEl) {
    const row = document.getElementById(`row-${rowId}`);
    const colorName = optionEl.dataset.colorName;
    const catalogColor = optionEl.dataset.catalogColor;
    const swatchUrl = optionEl.dataset.swatchUrl;
    const hex = optionEl.dataset.hex;
    const imageUrl = optionEl.dataset.imageUrl;
    const style = row.dataset.style;

    // Check for duplicate row (same style + color) — MERGE, don't just focus
    const existingRow = findExistingRow(style, catalogColor, rowId);
    if (existingRow) {
        row.querySelector('.color-picker-dropdown').classList.add('hidden');
        const moved = mergeDuplicateRowInto(existingRow, rowId);
        showToast(`${style} in ${colorName} is already on the quote — ${moved > 0 ? `merged ${moved} pc into` : 'jumped to'} that row.`, 'info');
        if (typeof markScreenPrintDirty === 'function') markScreenPrintDirty();
        return;
    }

    // Update selected display with swatch and full color name
    const pickerSelected = row.querySelector('.color-picker-selected');
    const swatch = pickerSelected.querySelector('.color-swatch');
    const nameSpan = pickerSelected.querySelector('.color-name');

    // Set swatch style (image or hex fallback)
    if (swatchUrl) {
        swatch.style.backgroundImage = `url('${swatchUrl}')`;
        swatch.style.backgroundColor = '';
        swatch.style.backgroundSize = 'cover';
        swatch.style.backgroundPosition = 'center';
    } else {
        swatch.style.backgroundImage = '';
        swatch.style.backgroundColor = hex || '#ccc';
    }
    swatch.classList.remove('empty');

    // Set full color name
    nameSpan.textContent = colorName;
    nameSpan.classList.remove('placeholder');

    // Mark selected option in dropdown
    row.querySelectorAll('.color-picker-option').forEach(opt => opt.classList.remove('selected'));
    optionEl.classList.add('selected');
    // 7.2 a11y: mirror the selection into aria-selected
    optionEl.setAttribute('aria-selected', 'true');
    if (optionEl.parentElement) {
        optionEl.parentElement.querySelectorAll('.color-picker-option').forEach((o) => { if (o !== optionEl) o.setAttribute('aria-selected', 'false'); });
    }

    // Store data on row
    row.dataset.color = colorName;
    row.dataset.catalogColor = catalogColor;
    row.dataset.swatchUrl = swatchUrl || '';
    row.dataset.hex = hex || '';
    row.dataset.imageUrl = imageUrl || '';

    // Update product thumbnail
    updateProductThumbnail(rowId, imageUrl, row.dataset.productName, style, colorName);

    // Close dropdown
    row.querySelector('.color-picker-dropdown').classList.add('hidden');

    // Enable size inputs initially (may be disabled by detectAndAdjustSizeUI for special products)
    row.querySelectorAll('.size-input').forEach(input => input.disabled = false);

    // Detect size category and adjust UI (OSFA, combo, youth, toddler, tall, standard)
    // This runs async but doesn't block - will update UI when API returns
    detectAndAdjustSizeUI(rowId);

    // Phase 10.1 (2026-05-23) — fire SanMar inventory check + render badges
    // next to each size input. Uses shared InventoryBadges wrapper.
    // Graceful: silently no-ops if scripts missing.
    if (window.InventoryBadges && typeof window.InventoryBadges.attach === 'function') {
        window.InventoryBadges.attach(row, {
            style: style,
            catalogColor: catalogColor,
            sizeCellSelector: 'input.size-input',
        });
    }

    // Focus first size input (may be overridden by detectAndAdjustSizeUI for special products)
    const firstSize = row.querySelector('.size-input');
    if (firstSize) firstSize.focus();

    // Cascade to child rows if any
    cascadeColorToChildRows(rowId, colorName, catalogColor, swatchUrl, hex);

    recalculatePricing();
}

/**
 * Cascade color selection to child rows (for extended sizes)
 */
function cascadeColorToChildRows(parentRowId, colorName, catalogColor, swatchUrl, hex) {
    if (!scpState.childRowMap[parentRowId]) return;

    Object.values(scpState.childRowMap[parentRowId]).forEach(childRowId => {
        const childRow = document.getElementById(`row-${childRowId}`);
        if (childRow && childRow.dataset.colorManuallySet !== 'true') {
            childRow.dataset.color = colorName;
            childRow.dataset.catalogColor = catalogColor;

            // Update child row's color picker display if it has one
            const childPicker = childRow.querySelector('.color-picker-selected');
            if (childPicker) {
                const childSwatch = childPicker.querySelector('.color-swatch');
                const childName = childPicker.querySelector('.color-name');
                if (childSwatch && childName) {
                    if (swatchUrl) {
                        childSwatch.style.backgroundImage = `url('${swatchUrl}')`;
                        childSwatch.style.backgroundColor = '';
                    } else {
                        childSwatch.style.backgroundImage = '';
                        childSwatch.style.backgroundColor = hex || '#ccc';
                    }
                    childSwatch.classList.remove('empty');
                    childName.textContent = colorName;
                    childName.classList.remove('placeholder');
                }
            }
        }
    });
    updateChildRowColorIndicators(parentRowId);
}

/**
 * Handle keyboard navigation in color picker
 */
export function handleColorPickerKeydown(event, rowId) {
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
        // Close dropdown on tab
        dropdown.classList.add('hidden');
    }
}

/**
 * Navigate through dropdown options with arrow keys
 */
function navigateOptions(dropdown, direction) {
    const options = dropdown.querySelectorAll('.color-picker-option');
    if (options.length === 0) return;

    let currentIndex = -1;
    options.forEach((opt, i) => {
        if (opt.classList.contains('focused')) currentIndex = i;
    });

    // Remove current focus
    options.forEach(opt => opt.classList.remove('focused'));

    // Calculate new index
    let newIndex = currentIndex + direction;
    if (newIndex < 0) newIndex = options.length - 1;
    if (newIndex >= options.length) newIndex = 0;

    // Add focus to new option
    options[newIndex].classList.add('focused');
    // 7.2 a11y: point the combobox at the visually-focused option
    const navTrigger = dropdown.closest('.color-picker-wrapper') && dropdown.closest('.color-picker-wrapper').querySelector('.color-picker-selected');
    if (navTrigger && options[newIndex].id) navTrigger.setAttribute('aria-activedescendant', options[newIndex].id);
    options[newIndex].scrollIntoView({ block: 'nearest' });
}

// Click outside handler to close all dropdowns
document.addEventListener('click', function(e) {
    if (!e.target.closest('.color-picker-wrapper')) {
        document.querySelectorAll('.color-picker-dropdown').forEach(d => d.classList.add('hidden'));
        document.querySelectorAll('.color-picker-selected[aria-expanded="true"]').forEach((el) => el.setAttribute('aria-expanded', 'false'));
    }
});

/**
 * Select a color for a child row (extended size)
 * Similar to selectColor but marks color as manually set
 */
export function selectChildColor(childRowId, parentRowId, optionEl) {
    const childRow = document.getElementById(`row-${childRowId}`);
    const colorName = optionEl.dataset.colorName;
    const catalogColor = optionEl.dataset.catalogColor;
    const swatchUrl = optionEl.dataset.swatchUrl;
    const hex = optionEl.dataset.hex;

    // Update selected display with swatch and full color name
    const pickerSelected = childRow.querySelector('.color-picker-selected');
    const swatch = pickerSelected.querySelector('.color-swatch');
    const nameSpan = pickerSelected.querySelector('.color-name');

    // Set swatch style (image or hex fallback)
    if (swatchUrl) {
        swatch.style.backgroundImage = `url('${swatchUrl}')`;
        swatch.style.backgroundColor = '';
        swatch.style.backgroundSize = 'cover';
        swatch.style.backgroundPosition = 'center';
    } else {
        swatch.style.backgroundImage = '';
        swatch.style.backgroundColor = hex || '#ccc';
    }
    swatch.classList.remove('empty');

    // Set full color name
    nameSpan.textContent = colorName;
    nameSpan.classList.remove('placeholder');

    // Mark selected option in dropdown
    childRow.querySelectorAll('.color-picker-option').forEach(opt => opt.classList.remove('selected'));
    optionEl.classList.add('selected');
    // 7.2 a11y: mirror the selection into aria-selected
    optionEl.setAttribute('aria-selected', 'true');
    if (optionEl.parentElement) {
        optionEl.parentElement.querySelectorAll('.color-picker-option').forEach((o) => { if (o !== optionEl) o.setAttribute('aria-selected', 'false'); });
    }

    // Store data on row
    childRow.dataset.color = colorName;
    childRow.dataset.catalogColor = catalogColor;
    childRow.dataset.swatchUrl = swatchUrl || '';
    childRow.dataset.hex = hex || '';
    childRow.dataset.colorManuallySet = 'true';  // Mark as manually changed

    // Close dropdown
    childRow.querySelector('.color-picker-dropdown').classList.add('hidden');

    // Update visual indicator for different color
    updateChildRowColorIndicators(parentRowId);

    recalculatePricing();
}

// eslint-disable-next-line no-unused-vars -- dead in the monolith too (zero callers repo-wide, incl. generated markup); kept verbatim (S1a).
async function onColorChange(select, rowId) {
    const row = document.getElementById(`row-${rowId}`);
    const color = select.value;

    if (!color) return;

    const selectedOption = select.options[select.selectedIndex];
    const catalogColor = selectedOption.dataset.catalog || '';
    const style = row.dataset.style;

    // Check for duplicate row (same style + color) — MERGE, don't just focus
    const existingRow = findExistingRow(style, catalogColor, rowId);
    if (existingRow) {
        const moved = mergeDuplicateRowInto(existingRow, rowId);
        showToast(`${style} in ${color} is already on the quote — ${moved > 0 ? `merged ${moved} pc into` : 'jumped to'} that row.`, 'info');
        if (typeof markScreenPrintDirty === 'function') markScreenPrintDirty();
        return;
    }

    row.dataset.color = color;
    row.dataset.catalogColor = catalogColor;

    // Enable size inputs
    row.querySelectorAll('.size-input').forEach(input => {
        input.disabled = false;
    });

    // Cascade color change to child rows that haven't been manually edited
    if (scpState.childRowMap[rowId]) {
        // eslint-disable-next-line no-unused-vars -- verbatim (S1a): destructured size key unused in monolith
        Object.entries(scpState.childRowMap[rowId]).forEach(([size, childRowId]) => {
            const childRow = document.getElementById(`row-${childRowId}`);
            if (childRow && childRow.dataset.colorManuallySet !== 'true') {
                // Update child row color
                childRow.dataset.color = color;
                childRow.dataset.catalogColor = catalogColor;

                // Update child row's color dropdown selection
                const childColorSelect = childRow.querySelector('.child-color-select');
                if (childColorSelect) {
                    childColorSelect.value = color;
                }

            }
        });
        updateChildRowColorIndicators(rowId);
    }

    // Focus first size input
    const firstSize = row.querySelector('.size-input');
    if (firstSize) firstSize.focus();
}

/**
 * Handle color change in a child row
 * Updates child row's color and marks it as manually set
 */
// eslint-disable-next-line no-unused-vars -- dead in the monolith too (zero callers repo-wide, incl. generated markup); kept verbatim (S1a).
function onChildColorChange(select, childRowId, parentRowId) {
    const childRow = document.getElementById(`row-${childRowId}`);
    if (!childRow) return;

    const color = select.value;
    const selectedOption = select.options[select.selectedIndex];
    const catalogColor = selectedOption.dataset.catalog || '';

    // Update child row data attributes
    childRow.dataset.color = color;
    childRow.dataset.catalogColor = catalogColor;
    childRow.dataset.colorManuallySet = 'true';  // Mark as manually edited

    // Update visual indicator
    updateChildRowColorIndicators(parentRowId);


    // Recalculate pricing
    recalculatePricing();
}

/**
 * Update visual styling for child rows based on color match with parent
 */
function updateChildRowColorIndicators(parentRowId) {
    const parentRow = document.getElementById(`row-${parentRowId}`);
    if (!parentRow) return;

    const parentCatalogColor = parentRow.dataset.catalogColor;

    if (scpState.childRowMap[parentRowId]) {
        Object.values(scpState.childRowMap[parentRowId]).forEach(childRowId => {
            const childRow = document.getElementById(`row-${childRowId}`);
            if (childRow) {
                if (childRow.dataset.catalogColor !== parentCatalogColor) {
                    childRow.classList.add('different-color');
                } else {
                    childRow.classList.remove('different-color');
                }
            }
        });
    }
}

/**
 * Find an existing row with the same style and catalogColor (excluding current row)
 */
/**
 * Auto-merge a duplicate style+color row into the existing one (old-audit P2 #5,
 * shipped 2026-07-07): the toast SAID "Adding to existing row" but only focused
 * it — the half-configured duplicate stayed behind and could double-bill once
 * quantities landed in both. Standard-size quantities already typed on the
 * duplicate SUM into the existing row's inputs (real change events, so pricing
 * and child-row machinery run); the duplicate then deletes via the normal
 * deleteRow() path. Extended-size CHILD rows can't exist on a row that hasn't
 * picked a color yet, so standard sizes cover every reachable case.
 * @returns {number} pieces moved
 */
function mergeDuplicateRowInto(existingRow, dupRowId) {
    const dupRow = document.getElementById(`row-${dupRowId}`);
    if (!dupRow || !existingRow) return 0;
    let moved = 0;
    dupRow.querySelectorAll('.size-input:not(.xxxl-picker-btn)').forEach(inp => {
        const qty = parseInt(inp.value, 10) || 0;
        if (qty <= 0) return;
        const size = inp.dataset.size;
        const target = existingRow.querySelector(`.size-input[data-size="${size}"]:not(.xxxl-picker-btn)`);
        if (target && !target.disabled) {
            target.value = String((parseInt(target.value, 10) || 0) + qty);
            target.dispatchEvent(new Event('change', { bubbles: true }));
            moved += qty;
        }
    });
    deleteRow(dupRowId);
    const firstSize = existingRow.querySelector('.size-input:not([disabled])');
    if (firstSize) firstSize.focus();
    return moved;
}

function findExistingRow(style, catalogColor, excludeRowId) {
    const rows = document.querySelectorAll('#product-tbody tr:not(.child-row)');
    for (const row of rows) {
        const rowNumericId = parseInt(row.id.replace('row-', ''));
        if (rowNumericId === excludeRowId) continue;
        if (row.dataset.style === style && row.dataset.catalogColor === catalogColor) {
            return row;
        }
    }
    return null;
}

export function onSizeChange(rowId) {
    const row = document.getElementById(`row-${rowId}`);
    if (!row) return;

    // Skip if this is a child row (child rows don't trigger size changes)
    if (row.classList.contains('child-row')) {
        recalculatePricing();
        return;
    }

    const sizeCategory = row.dataset.sizeCategory;

    // OSFA-only products are handled separately by onOSFAQtyChange()
    if (sizeCategory === 'osfa-only') {
        recalculatePricing();
        return;
    }

    // Calculate total from ONLY parent row's enabled size inputs (excludes disabled 2XL, XXXL picker, OSFA)
    // Child row quantities display separately — don't double-count in parent
    let standardTotal = 0;
    row.querySelectorAll('.size-input:not(.xxxl-picker-btn):not(.osfa-qty-input):not(:disabled)').forEach(input => {
        standardTotal += parseInt(input.value) || 0;
    });

    if (standardTotal > 0) {
        document.getElementById(`row-qty-${rowId}`).textContent = standardTotal;
    } else {
        // Variant-only: show child row total so parent doesn't display "0"
        let childTotal = 0;
        const childRows = document.querySelectorAll(`tr[data-parent-row-id="${rowId}"]`);
        childRows.forEach(childRow => {
            const qtyDisplay = childRow.querySelector('.qty-display');
            childTotal += parseInt(qtyDisplay?.textContent) || 0;
        });
        document.getElementById(`row-qty-${rowId}`).textContent = childTotal;
    }

    // Handle 2XL/XXL size (has direct input) - create/update/remove child rows
    // Note: Size06 sizes (XS, 3XL, 4XL, 5XL, 6XL) are handled by the Extended Size Picker popup
    const xxlInput = row.querySelector('[data-size="2XL"]');
    if (xxlInput) {
        const qty = parseInt(xxlInput.value) || 0;
        // Check for both 2XL and XXL child rows (XXL is distinct for Ladies/Womens products)
        const existingChildId = scpState.childRowMap[rowId]?.['2XL'] || scpState.childRowMap[rowId]?.['XXL'];
        const existingChildSize = scpState.childRowMap[rowId]?.['2XL'] ? '2XL' : (scpState.childRowMap[rowId]?.['XXL'] ? 'XXL' : '2XL');

        if (qty > 0) {
            // Need a child row for 2XL (or XXL if that's what exists)
            if (existingChildId) {
                updateChildRow(existingChildId, qty);
            } else {
                createChildRow(rowId, '2XL', qty);
            }
            // Disable the 2XL input in parent and clear value
            xxlInput.disabled = true;
            xxlInput.value = '';  // Clear to prevent visual confusion
            xxlInput.style.background = '#f5f5f5';
            xxlInput.style.color = '#999';

            // Recalculate parent row qty display (standard sizes only — child rows display separately)
            let newTotal = 0;
            row.querySelectorAll('.size-input:not(.xxxl-picker-btn):not(.osfa-qty-input):not(:disabled)').forEach(input => {
                newTotal += parseInt(input.value) || 0;
            });
            document.getElementById(`row-qty-${rowId}`).textContent = newTotal;
        } else {
            // Remove child row if it exists (could be 2XL or XXL)
            if (existingChildId) {
                removeChildRow(rowId, existingChildSize);
            }
            // Re-enable 2XL input in parent
            xxlInput.disabled = false;
            xxlInput.style.background = '';
            xxlInput.style.color = '';
        }
    }

    // Recalculate pricing
    recalculatePricing();
}

/**
 * Generate ShopWorks-compatible part number
 * Uses SIZE_TO_SUFFIX which contains ALL size suffixes (tall, youth, toddler, etc.)
 */
function getPartNumber(baseStyle, size) {
    // For pants sizes (4-digit codes like 3032), append directly with underscore
    if (/^\d{4}$/.test(size)) {
        return `${baseStyle}_${size}`;
    }
    return baseStyle + (SIZE_TO_SUFFIX[size] || '');
}

/**
 * Create a child row for an extended size
 */
export function createChildRow(parentRowId, size, qty) {
    const parentRow = document.getElementById(`row-${parentRowId}`);
    if (!parentRow) return;

    const childRowId = ++scpState.rowCounter;
    const baseStyle = parentRow.dataset.style;
    const partNumber = getPartNumber(baseStyle, size);

    // Get parent's available colors for the dropdown
    const parentColors = parentRow.dataset.colors ? JSON.parse(parentRow.dataset.colors) : [];
    const parentColor = parentRow.dataset.color || '';
    // eslint-disable-next-line no-unused-vars -- verbatim (S1a): unused in monolith
    const parentCatalogColor = parentRow.dataset.catalogColor || '';
    const parentSwatchUrl = parentRow.dataset.swatchUrl || '';
    const parentHex = parentRow.dataset.hex || '#ccc';

    // Build color picker options HTML with swatches
    const colorOptionsHtml = parentColors.map(c =>
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

    // Build current color display — sanitize before interpolating into (CSS/attribute
    // breakout); ports EMB's hardened block (review C32) that never synced here (1.4 audit).
    const _swUrl = String(parentSwatchUrl || '').replace(/["'()\\\s]/g, '');
    const _swHex = (parentHex && /^#[0-9a-fA-F]{3,8}$/.test(parentHex)) ? parentHex : '#ccc';
    const currentSwatchStyle = /^https?:\/\//i.test(_swUrl)
        ? `background-image: url('${_swUrl}'); background-size: cover; background-position: center;`
        : `background-color: ${_swHex};`;

    const childRow = document.createElement('tr');
    childRow.id = `row-${childRowId}`;
    childRow.className = 'child-row';
    childRow.dataset.rowId = childRowId;
    childRow.dataset.parentRowId = parentRowId;
    childRow.dataset.extendedSize = size;
    childRow.dataset.style = partNumber;
    childRow.dataset.baseStyle = baseStyle;
    childRow.dataset.color = parentRow.dataset.color;
    childRow.dataset.catalogColor = parentRow.dataset.catalogColor;
    childRow.dataset.swatchUrl = parentSwatchUrl;
    childRow.dataset.hex = parentHex;
    childRow.dataset.productName = parentRow.dataset.productName;
    childRow.dataset.colorManuallySet = 'false';  // Track if user manually changed color

    // Determine which column this size goes to:
    // - Size05 (XXL column): 2XL and XXL (both map to Size05 in ShopWorks)
    // - Size06 (XXXL column): XS, 3XL, 4XL, 5XL, 6XL, pants sizes, shorts sizes
    const isSize05 = size === '2XL' || size === 'XXL';
    const isPantsSize = /^\d{4}$/.test(size);  // 4-digit pants sizes like 3032
    const isShortsSize = /^W\d{2}$/.test(size);  // Waist-only shorts sizes like W30
    const isSize06 = SIZE06_EXTENDED_SIZES.includes(size) || isPantsSize || isShortsSize;

    // Format display size (pants: "3032" -> "30x32", shorts: "W30" -> "Waist 30", others: keep as-is)
    let displaySize = size;
    if (isPantsSize) {
        const waist = size.substring(0, 2);
        const inseam = size.substring(2, 4);
        displaySize = `${waist}x${inseam}`;
    } else if (isShortsSize) {
        const waist = size.replace('W', '');
        displaySize = `Waist ${waist}`;
    }

    // Create cell content - only the specific size column is editable
    // eslint-disable-next-line no-unsanitized/property -- audited (1.4): colorOptionsHtml escapes colors (C32); sanitized swatch (C32 port); size codes internal; qty numeric
    childRow.innerHTML = `
        <td>
            <span class="child-indicator">└</span>
            <span class="style-display">${partNumber}</span>
        </td>
        <td class="thumbnail-col"></td>
        <td>
            <span class="desc-display qb-muted-12">${escapeHtml(parentRow.dataset.productName)} - <strong>${displaySize}</strong></span>
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
        <td><input type="number" class="cell-input size-input qb-bg-gray" data-size="S" aria-label="Quantity S" disabled value=""></td>
        <td><input type="number" class="cell-input size-input qb-bg-gray" data-size="M" aria-label="Quantity M" disabled value=""></td>
        <td><input type="number" class="cell-input size-input qb-bg-gray" data-size="L" aria-label="Quantity L" disabled value=""></td>
        <td><input type="number" class="cell-input size-input qb-bg-gray" data-size="XL" aria-label="Quantity XL" disabled value=""></td>
        <td><input type="number" class="cell-input size-input" data-size="2XL" aria-label="Quantity 2XL" ${isSize05 ? '' : 'disabled'} value="${isSize05 ? qty : ''}" placeholder="${isSize05 ? qty : ''}" style="${isSize05 ? '' : 'background: #f5f5f5;'}" onchange="onChildSizeChange(${childRowId}, ${parentRowId}, '${size}')" onkeydown="handleCellKeydown(event, this)"></td>
        <td><input type="number" class="cell-input size-input" data-size="${size}" ${isSize06 ? '' : 'disabled'} value="${isSize06 ? qty : ''}" placeholder="${isSize06 ? qty : ''}" style="${isSize06 ? '' : 'background: #f5f5f5;'}" onchange="onChildSizeChange(${childRowId}, ${parentRowId}, '${size}')" onkeydown="handleCellKeydown(event, this)"></td>
        <td class="cell-qty qty-display" id="row-qty-${childRowId}">${qty}</td>
        <td class="cell-price unit-price-display" id="row-price-${childRowId}">-</td>
        <td class="cell-total" id="row-total-${childRowId}">-</td>
        <td class="cell-actions">
            <button class="btn-delete-row" onclick="clearExtendedSize(${parentRowId}, '${size}')" title="Remove ${displaySize}">
                <i class="fas fa-times"></i>
            </button>
        </td>
    `;

    // Insert in correct size order: XS, 2XL, 3XL, 4XL, 5XL, 6XL
    const existingChildren = Array.from(document.querySelectorAll(`tr[data-parent-row-id="${parentRowId}"]`));

    if (existingChildren.length === 0) {
        // No children yet, insert after parent
        parentRow.after(childRow);
    } else {
        // Find correct position based on size order (XS first, then 2XL, 3XL, etc.)
        const newSizeIndex = EXTENDED_SIZE_ORDER.indexOf(size);
        let insertAfter = parentRow;  // Default: after parent (for XS or first size)

        for (const existingChild of existingChildren) {
            const existingSize = existingChild.dataset.extendedSize;
            const existingSizeIndex = EXTENDED_SIZE_ORDER.indexOf(existingSize);

            // If existing size comes before new size in order, insert after this child
            if (existingSizeIndex < newSizeIndex) {
                insertAfter = existingChild;
            } else {
                // Found a size that should come after us, stop here
                break;
            }
        }

        insertAfter.after(childRow);
    }

    // Track child row
    if (!scpState.childRowMap[parentRowId]) {
        scpState.childRowMap[parentRowId] = {};
    }
    scpState.childRowMap[parentRowId][size] = childRowId;

}

/**
 * Update an existing child row quantity
 */
function updateChildRow(childRowId, qty) {
    const childRow = document.getElementById(`row-${childRowId}`);
    if (!childRow) return;

    const size = childRow.dataset.extendedSize;
    const sizeInput = childRow.querySelector(`[data-size="${size}"]`);
    if (sizeInput) {
        sizeInput.value = qty;
    }
    document.getElementById(`row-qty-${childRowId}`).textContent = qty;
}

/**
 * Remove a child row
 */
function removeChildRow(parentRowId, size) {
    const childRowId = scpState.childRowMap[parentRowId]?.[size];
    if (childRowId) {
        const childRow = document.getElementById(`row-${childRowId}`);
        if (childRow) {
            childRow.remove();
        }
        delete scpState.childRowMap[parentRowId][size];
    }
}

/**
 * Handle size change in child row - sync back to parent
 */
export function onChildSizeChange(childRowId, parentRowId, size) {
    const childRow = document.getElementById(`row-${childRowId}`);
    const parentRow = document.getElementById(`row-${parentRowId}`);
    if (!childRow || !parentRow) return;

    const sizeInput = childRow.querySelector(`[data-size="${size}"]`);
    const qty = parseInt(sizeInput?.value) || 0;

    // Update child row quantity display
    document.getElementById(`row-qty-${childRowId}`).textContent = qty;

    // Sync back to parent row's hidden input
    const parentInput = parentRow.querySelector(`[data-size="${size}"]`);
    if (parentInput) {
        parentInput.value = qty;
    }

    // If qty is 0, remove the child row
    if (qty === 0) {
        clearExtendedSize(parentRowId, size);
    }

    recalculatePricing();
}

/**
 * Clear an extended size (remove child row, enable parent input)
 */
export function clearExtendedSize(parentRowId, size) {
    const parentRow = document.getElementById(`row-${parentRowId}`);
    if (!parentRow) return;

    // Clear parent input
    const parentInput = parentRow.querySelector(`[data-size="${size}"]`);
    if (parentInput) {
        parentInput.value = '';
        parentInput.disabled = false;
        parentInput.style.background = '';
        parentInput.style.color = '';
    }

    // Remove child row
    removeChildRow(parentRowId, size);

    recalculatePricing();
}

// reorderRowByProductType() removed — dead code (never called)

export function deleteRow(rowId) {
    const row = document.getElementById(`row-${rowId}`);
    if (!row) return;

    // If this is a parent row, also remove all child rows
    if (!row.classList.contains('child-row') && scpState.childRowMap[rowId]) {
        Object.keys(scpState.childRowMap[rowId]).forEach(size => {
            const childRowId = scpState.childRowMap[rowId][size];
            const childRow = document.getElementById(`row-${childRowId}`);
            if (childRow) {
                childRow.remove();
            }
        });
        delete scpState.childRowMap[rowId];
    }


    row.remove();
    recalculatePricing();
}

// ============================================================
// KEYBOARD NAVIGATION (Excel-style)
// ============================================================

// setupKeyboardShortcuts() → moved to quote-builder-utils.js

export function handleCellKeydown(event, input) {
    const row = input.closest('tr');
    const cells = Array.from(row.querySelectorAll('input:not([readonly]), select:not(:disabled)'));
    const currentIndex = cells.indexOf(input);

    if (event.key === 'Tab' && !event.shiftKey) {
        // Tab to next cell
        if (currentIndex === cells.length - 1) {
            // Last cell in row - add new row
            event.preventDefault();
            addNewRow();
        }
    } else if (event.key === 'Enter') {
        // Enter = next row
        event.preventDefault();

        const tbody = document.getElementById('product-tbody');
        const rows = Array.from(tbody.querySelectorAll('tr'));
        const currentRowIndex = rows.indexOf(row);

        if (currentRowIndex === rows.length - 1) {
            // Last row - add new
            addNewRow();
        } else {
            // Focus same column in next row
            const nextRow = rows[currentRowIndex + 1];
            const nextCells = Array.from(nextRow.querySelectorAll('input:not([readonly]), select:not(:disabled)'));
            if (nextCells[currentIndex]) {
                nextCells[currentIndex].focus();
            } else if (nextCells[0]) {
                nextCells[0].focus();
            }
        }
    } else if (event.key === 'ArrowDown') {
        // Arrow down
        event.preventDefault();
        const tbody = document.getElementById('product-tbody');
        const rows = Array.from(tbody.querySelectorAll('tr'));
        const currentRowIndex = rows.indexOf(row);

        if (currentRowIndex < rows.length - 1) {
            const nextRow = rows[currentRowIndex + 1];
            const field = input.dataset.field || input.dataset.size;
            const nextInput = nextRow.querySelector(`[data-field="${field}"], [data-size="${field}"]`);
            if (nextInput && !nextInput.disabled) {
                nextInput.focus();
            }
        }
    } else if (event.key === 'ArrowUp') {
        // Arrow up
        event.preventDefault();
        const tbody = document.getElementById('product-tbody');
        const rows = Array.from(tbody.querySelectorAll('tr'));
        const currentRowIndex = rows.indexOf(row);

        if (currentRowIndex > 0) {
            const prevRow = rows[currentRowIndex - 1];
            const field = input.dataset.field || input.dataset.size;
            const prevInput = prevRow.querySelector(`[data-field="${field}"], [data-size="${field}"]`);
            if (prevInput && !prevInput.disabled) {
                prevInput.focus();
            }
        }
    }
}
