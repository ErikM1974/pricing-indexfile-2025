/**
 * DTFQuoteBuilder prototype mixin — search/select, color picker, size inputs, extended-size popup, child-row registry (childRows Map = single money source).
 * Batch 4.2 (2026-07-09): methods moved VERBATIM from quote-builder-class.js
 * (`this.` state intact — the class assembles via Object.assign(prototype, ...)).
 */
// @ts-nocheck — MOVED legacy DOM code (pre-existing checkJs frictions).
/* global escapeHtml, Event, addNewRow, onStyleChange, selectColor, createChildRow,
   removeChildRow, updateExtendedSizeDisplay */
import { sizeDetectionCache } from './state.js';

export const rowsMethods = {

    /**
     * Get the next row ID - shared between parent rows and child rows
     * This prevents ID collisions between addProductRow() and createChildRow()
     */
    getNextRowId() {
        return ++this.productIndex;
    },

    /**
     * Add a product row from loaded quote data
     */
    async addProductFromQuote(product) {
        // Add new row using the global function from the HTML
        if (typeof addNewRow === 'function') {
            addNewRow();
        } else {
            console.error('[EditMode] addNewRow function not found');
            return;
        }

        const row = document.querySelector('tr.new-row');
        if (!row) return;

        const rowId = row.dataset.rowId || row.dataset.productId;
        const styleInput = row.querySelector('.style-input');

        // Set style number and trigger product loading
        styleInput.value = product.styleNumber;

        // Trigger the style change handler from the HTML
        if (typeof onStyleChange === 'function') {
            await onStyleChange(styleInput, parseInt(rowId));
        }

        // Small delay to let colors load
        await new Promise(resolve => setTimeout(resolve, 150));

        // Select the color. [2026-06-11] the parent-row picker renders
        // .color-picker-option with data-color (CATALOG_COLOR) / data-display
        // (COLOR_NAME) — the old query used .color-option + data-color-name /
        // data-catalog-color, which match NOTHING here, so the saved color never
        // restored, the size inputs stayed disabled, and quantities were dropped.
        const pickerDropdown = row.querySelector('.color-picker-dropdown');
        if (pickerDropdown) {
            const options = Array.from(pickerDropdown.querySelectorAll('.color-picker-option, .color-option'));
            const colorOption = options.find(opt =>
                opt.dataset.display === product.color ||
                opt.dataset.color === product.color ||
                opt.dataset.colorName === product.color ||
                opt.dataset.catalogColor === product.color
            ) || options.find(opt => opt.textContent.includes(product.color));
            if (colorOption && typeof selectColor === 'function') {
                selectColor(parseInt(rowId), colorOption);
            }
        }

        // Small delay for color selection to process
        await new Promise(resolve => setTimeout(resolve, 100));

        // Set size quantities
        for (const [size, qty] of Object.entries(product.sizeBreakdown)) {
            if (qty > 0) {
                const normalizedSize = size === 'XXL' ? '2XL' : (size === 'XXXL' ? '3XL' : size);

                if (['S', 'M', 'L', 'XL', '2XL'].includes(normalizedSize)) {
                    const sizeInput = row.querySelector(`input[data-size="${normalizedSize}"]`) ||
                                     row.querySelector(`input[data-size="${size}"]`);
                    if (sizeInput && !sizeInput.disabled) {
                        sizeInput.value = qty;
                        sizeInput.dispatchEvent(new Event('change', { bubbles: true }));
                    } else if (normalizedSize === '2XL' && typeof createChildRow === 'function') {
                        // [2026-06-11] color-match failure used to leave the 2XL input
                        // disabled (change event dead) — pieces silently dropped
                        createChildRow(parseInt(rowId), '2XL', qty);
                    }
                } else if (typeof createChildRow === 'function') {
                    // [2026-06-11] extended sizes (3XL+, XS, talls): this branch was
                    // EMPTY — edit-loading a quote silently dropped these pieces and
                    // Save Revision then permanently deleted them.
                    createChildRow(parseInt(rowId), normalizedSize, qty);
                }
            }
        }
    },

    updateSearchState() {
        const searchHint = document.getElementById('search-hint');

        // Search is always enabled - user can add products before selecting locations
        // Pricing will show "-" until locations are selected
        if (this.selectedLocations.length > 0) {
            if (searchHint) searchHint.textContent = 'Type to search (e.g., PC54, G500)';
        } else {
            if (searchHint) searchHint.textContent = 'Select locations above to see pricing (products can be added now)';
        }
    },

    setupSearchListeners() {
        const searchInput = document.getElementById('product-search');
        const suggestionsContainer = document.getElementById('search-suggestions');

        if (!searchInput) return;

        // Initialize ExactMatchSearch with callbacks including keyboard navigation
        this.productsManager.initializeExactMatchSearch(
            // Exact match callback - auto-load product immediately
            (product) => {
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
                // Called when arrow keys change selection
                // eslint-disable-next-line no-unused-vars -- verbatim (D1): callback signature from ExactMatchSearch
                onNavigate: (selectedIndex, products) => {
                    this.updateSearchSelectionHighlight(selectedIndex);
                },
                // Called when Enter selects an item
                onSelect: (product) => {
                    searchInput.value = '';
                    this.selectProduct(product.value);
                    if (suggestionsContainer) suggestionsContainer.style.display = 'none';
                },
                // Called when Escape closes dropdown
                onClose: () => {
                    if (suggestionsContainer) suggestionsContainer.style.display = 'none';
                }
            }
        );

        // Wire up search input to use exact match search
        searchInput.addEventListener('input', (e) => {
            const query = e.target.value.trim();

            if (query.length < 2) {
                if (suggestionsContainer) suggestionsContainer.style.display = 'none';
                return;
            }

            this.productsManager.searchWithExactMatch(query);
        });

        // Handle keyboard navigation (Arrow Up/Down/Enter/Escape)
        searchInput.addEventListener('keydown', (e) => {
            const searcher = this.productsManager.getSearchInstance();

            // Let ExactMatchSearch handle navigation keys
            if (searcher && searcher.handleKeyDown(e)) {
                return; // Event was handled
            }

            // Handle Enter for immediate search when nothing is selected
            if (e.key === 'Enter') {
                e.preventDefault();
                const query = searchInput.value.trim();
                if (query.length >= 2) {
                    this.productsManager.searchImmediate(query);
                }
            }
        });

        // Close suggestions when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.search-input-wrapper')) {
                if (suggestionsContainer) suggestionsContainer.style.display = 'none';
                // Reset navigation state when closing
                const searcher = this.productsManager.getSearchInstance();
                if (searcher) searcher.resetNavigation();
            }
        });
    },

    /**
     * Update visual highlight on selected suggestion item
     */
    updateSearchSelectionHighlight(selectedIndex) {
        const suggestionsContainer = document.getElementById('search-suggestions');
        if (!suggestionsContainer) return;

        // Remove existing selection
        suggestionsContainer.querySelectorAll('.suggestion-item').forEach((item, index) => {
            if (index === selectedIndex) {
                item.classList.add('selected');
                // Scroll into view if needed
                item.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
            } else {
                item.classList.remove('selected');
            }
        });
    },

    /**
     * Setup global event listeners (click-outside handlers, etc.)
     */
    setupGlobalListeners() {
        // Close color dropdowns when clicking outside
        document.addEventListener('click', (e) => {
            // If click is not inside a color picker, close all dropdowns
            if (!e.target.closest('.color-picker-wrapper')) {
                document.querySelectorAll('.color-picker-dropdown:not(.hidden)').forEach(dropdown => {
                    dropdown.classList.add('hidden');
                });
            }
        });

        // Close dropdowns on Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                document.querySelectorAll('.color-picker-dropdown:not(.hidden)').forEach(dropdown => {
                    dropdown.classList.add('hidden');
                });
            }
        });
    },

    showSearchSuggestions(products) {
        const suggestionsContainer = document.getElementById('search-suggestions');
        const searchInput = document.getElementById('product-search');
        if (!suggestionsContainer) return;

        if (!products || products.length === 0) {
            suggestionsContainer.innerHTML = '<div class="no-results">No products found</div>';
            suggestionsContainer.style.display = 'block';
            return;
        }

        const html = products.slice(0, 10).map(p => `
            <div class="suggestion-item" data-style="${escapeHtml(p.value)}">
                <span class="style-number">${escapeHtml(p.value)}</span>
                <span class="style-name">${escapeHtml(p.label ? p.label.split(' - ')[1] || p.label : '')}</span>
            </div>
        `).join('');

        // eslint-disable-next-line no-unsanitized/property -- audited (1.4): suggestion rows escapeHtml p.value/p.label at build (stage-1 fix)
        suggestionsContainer.innerHTML = html;
        suggestionsContainer.style.display = 'block';

        // Add click handlers
        suggestionsContainer.querySelectorAll('.suggestion-item').forEach(item => {
            item.addEventListener('click', () => {
                this.selectProduct(item.dataset.style);
                suggestionsContainer.style.display = 'none';
                if (searchInput) searchInput.value = '';
            });
        });
    },

    /**
     * Clean product title by removing duplicate style numbers
     * Matches pattern used by Embroidery/Screen Print/DTG quote builders
     */
    cleanProductTitle(title, styleNumber) {
        if (!title || !styleNumber) return title || '';

        // Escape special regex characters in style number
        const escapedStyle = styleNumber.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

        // Remove style number prefix pattern: "STYLE - " or "STYLE. "
        let cleaned = title.replace(new RegExp(`^${escapedStyle}\\s*[-.]\\s*`, 'i'), '');

        // Remove trailing style number: ". STYLE" or " STYLE" at end
        cleaned = cleaned.replace(new RegExp(`[.\\s]+${escapedStyle}\\s*$`, 'i'), '');

        return cleaned.trim();
    },

    async selectProduct(styleNumber) {

        // Use the SAME row creation path as the Add button (matches DTG pattern)
        // This ensures proper event handlers for child row creation
        window.addNewRow();  // Global function from HTML - creates row with proper onchange handlers

        // Find the new row and populate it
        const targetRow = document.querySelector('tr.new-row');
        if (!targetRow) {
            console.error('[DTFQuoteBuilder] Failed to create new row');
            return;
        }

        const rowId = parseInt(targetRow.dataset.rowId);
        const styleInput = targetRow.querySelector('.style-input');
        if (styleInput) {
            styleInput.value = styleNumber;
        }

        // Trigger the standard product loading flow (same as typing in style field)
        // This calls onStyleChange() which loads product data, colors, and enables size inputs
        await window.onStyleChange(styleInput, rowId);  // Global function from HTML

        // Clear search input
        const searchInput = document.getElementById('product-search');
        if (searchInput) searchInput.value = '';
    },

    /**
     * Setup color picker dropdown functionality - MATCHES Embroidery/Screen Print pattern
     */
    setupColorPicker(row, productId) {
        const picker = row.querySelector('.color-picker-wrapper');
        if (!picker) return;

        const trigger = picker.querySelector('.color-picker-selected');
        const dropdown = picker.querySelector('.color-picker-dropdown');
        const options = picker.querySelectorAll('.color-picker-option:not(.disabled)');

        // Toggle dropdown on trigger click
        trigger.addEventListener('click', (e) => {
            e.stopPropagation();

            // Close any other open dropdowns first
            document.querySelectorAll('.color-picker-dropdown:not(.hidden)').forEach(d => {
                if (d !== dropdown) {
                    d.classList.add('hidden');
                }
            });

            // Toggle this dropdown
            dropdown.classList.toggle('hidden');
        });

        // Handle keyboard on color picker (Enter/Space to toggle)
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

                const colorName = option.dataset.display;
                const catalogColor = option.dataset.color;
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

                // Update product data
                const productData = this.products.find(p => p.id === productId);
                if (productData) {
                    productData.catalogColor = catalogColor;  // CATALOG_COLOR for API
                    productData.color = colorName;            // Display name
                }

                // Also update row dataset attributes for child row inheritance
                const row = document.querySelector(`tr[data-product-id="${productId}"]`);
                if (row) {
                    row.dataset.color = colorName;
                    row.dataset.catalogColor = catalogColor;
                    row.dataset.swatchUrl = imageUrl || '';
                }

                // Close dropdown
                dropdown.classList.add('hidden');

                // Enable size inputs now that color is selected
                this.enableSizeInputs(productId);

            });
        });
    },

    /**
     * Enable size inputs after color is selected
     */
    enableSizeInputs(productId) {
        const row = document.querySelector(`tr[data-product-id="${productId}"]`);
        if (!row) return;

        row.querySelectorAll('.size-input').forEach(input => {
            input.disabled = false;
        });

        // Also enable extended picker button
        const extButton = row.querySelector('.btn-extended-picker');
        if (extButton) {
            extButton.disabled = false;
        }

    },

    /**
     * Open extended size popup for a product
     * Uses API-driven dynamic sizes from ExtendedSizesConfig (2026 consolidation)
     * Reads existing quantities from child rows (not row dataset anymore)
     */
    async openExtendedSizePopup(productId) {
        this.currentPopupProductId = productId;

        // Store reference to parent row
        this.currentPopupRow = document.getElementById(`row-${productId}`);
        const styleNumber = this.currentPopupRow?.dataset?.style || '';
        const catalogColor = this.currentPopupRow?.dataset?.catalogColor || '';

        const popup = document.getElementById('extended-size-popup');
        const backdrop = document.getElementById('size-popup-backdrop');
        const body = document.getElementById('size-popup-body');

        // Show popup with loading state
        popup.classList.remove('hidden');
        backdrop.classList.remove('hidden');
        body.innerHTML = `
            <div class="ext-popup-loading">
                <i class="fas fa-spinner fa-spin"></i>
                Loading available sizes...
            </div>
        `;

        // Fetch available extended sizes from API (excluding 2XL/XXL which has its own column)
        let extendedSizes = [];
        let apiError = false;

        let rateLimited = false;
        const cacheKey = `${styleNumber}-${catalogColor || ''}`;
        try {
            if (sizeDetectionCache.has(cacheKey)) {
                const cached = sizeDetectionCache.get(cacheKey);
                extendedSizes = cached.filter(size => !['2XL', 'XXL'].includes(size));
            } else {
                if (!window.ExtendedSizesConfig?.getAvailableExtendedSizes) {
                    throw new Error('ExtendedSizesConfig module not loaded');
                }
                const allExtended = await window.ExtendedSizesConfig.getAvailableExtendedSizes(styleNumber, catalogColor);
                sizeDetectionCache.set(cacheKey, allExtended);
                // Filter out 2XL/XXL since DTF has a dedicated column for it
                extendedSizes = allExtended.filter(size => !['2XL', 'XXL'].includes(size));
            }
        } catch (error) {
            console.error('[DTFQuoteBuilder] Failed to fetch extended sizes:', error);
            if (error.message === 'RATE_LIMITED') {
                rateLimited = true;
            }
            apiError = true;
        }

        // Show appropriate message based on result
        if (apiError) {
            const message = rateLimited
                ? 'Too many requests. Please wait a moment and try again.'
                : 'Unable to load extended sizes. Please try again.';
            body.innerHTML = `
                <div class="ext-popup-error" style="padding: 20px; text-align: center; color: #c00;">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p>${escapeHtml(message)}</p>
                </div>
            `;
            return;
        }

        if (extendedSizes.length === 0) {
            body.innerHTML = `
                <div class="ext-popup-empty" style="padding: 20px; text-align: center; color: #666;">
                    <i class="fas fa-info-circle"></i>
                    <p>No extended sizes available for this product.</p>
                </div>
            `;
            return;
        }

        // Build quantities using fallback function that checks BOTH child rows AND parent inputs
        const quantities = {};
        extendedSizes.forEach(size => {
            // [2026-06-11] use the API size directly — the old 3XL→'XXXL' alias made
            // the prefill look up a key the map never... actually the REVERSE: rows
            // were stored under 'XXXL' but getExtendedSizeQty normalized to '3XL'
            // before its lookup, so an existing 3XL row prefilled as BLANK and the
            // next Apply silently deleted it (qty 0 + existing row ⇒ remove).
            quantities[size] = window.getExtendedSizeQty ? window.getExtendedSizeQty(productId, size) : 0;
        });

        // Render the size inputs
        // eslint-disable-next-line no-unsanitized/property -- audited (1.4): size codes from internal extended-sizes config; qty numeric
        body.innerHTML = `
            <div class="extended-sizes-grid">
                ${extendedSizes.map(size => {
                    // [2026-06-11] data-size = the API size ('3XL'), no 'XXXL' alias.
                    // The alias made childRowMap keys, part-number suffixes (_XXXL
                    // instead of _3XL), and the prefill lookup all disagree.
                    const currentQty = quantities[size] || '';
                    return `
                        <div class="ext-size-input-group">
                            <label>${size}</label>
                            <input type="number" class="ext-size-input" data-size="${size}"
                                   min="0" value="${currentQty}"
                                   placeholder="0">
                        </div>
                    `;
                }).join('')}
            </div>
            <div class="ext-popup-note">
                <i class="fas fa-info-circle"></i>
                ${extendedSizes.length > 5
                    ? 'Extended sizes available for this product. Garment size upcharges may apply.'
                    : 'Larger garment sizes carry a garment upcharge — the transfer price is the same for every size.'}
            </div>
        `;

        // Focus first input
        const firstInput = body.querySelector('.ext-size-input');
        if (firstInput) firstInput.focus();
    },

    /**
     * Close extended size popup
     */
    closeExtendedSizePopup() {
        const popup = document.getElementById('extended-size-popup');
        const backdrop = document.getElementById('size-popup-backdrop');

        popup.classList.add('hidden');
        backdrop.classList.add('hidden');
        this.currentPopupProductId = null;
        this.currentPopupRow = null;  // Clear row reference
    },

    /**
     * Apply extended sizes from popup - CREATES CHILD ROWS (like Embroidery/DTG pattern)
     */
    applyExtendedSizes() {
        const productId = this.currentPopupProductId;
        if (!productId) return;

        const body = document.getElementById('size-popup-body');
        const inputs = body.querySelectorAll('.ext-size-input');

        // Process each extended size input from popup
        inputs.forEach(input => {
            const rawSize = input.dataset.size;
            const qty = parseInt(input.value) || 0;

            // Access global childRowMap. Legacy alias guard (2026-06-11): rows
            // created before the XXXL→3XL key fix (restored drafts, open tabs)
            // may still be keyed 'XXXL'/'XXL' — resolve to whichever key the map
            // actually holds so update/remove hit the existing row instead of
            // creating a duplicate.
            const mapForProduct = window.childRowMap?.[productId] || {};
            const aliasKey = rawSize === '3XL' ? 'XXXL' : (rawSize === '2XL' ? 'XXL' : null);
            const size = (mapForProduct[rawSize] == null && aliasKey && mapForProduct[aliasKey] != null)
                ? aliasKey : rawSize;
            const existingChildRowId = mapForProduct[size];

            if (qty > 0 && !existingChildRowId) {
                // CREATE NEW CHILD ROW using global function
                if (typeof createChildRow === 'function') {
                    createChildRow(productId, size, qty);
                }
            } else if (qty > 0 && existingChildRowId) {
                // UPDATE EXISTING CHILD ROW — JS state first (money source),
                // then the display row (2026-06-11 P2 closure)
                this.setChildRowQty(existingChildRowId, qty);
                const childRow = document.getElementById(`row-${existingChildRowId}`);
                if (childRow) {
                    const qtyInput = childRow.querySelector('.extended-size-qty');
                    if (qtyInput) qtyInput.value = qty;
                    const qtyDisplay = document.getElementById(`row-qty-${existingChildRowId}`);
                    if (qtyDisplay) qtyDisplay.textContent = qty;
                }
            } else if (qty === 0 && existingChildRowId) {
                // REMOVE CHILD ROW using global function
                if (typeof removeChildRow === 'function') {
                    removeChildRow(productId, size);
                }
            }
        });

        // Update parent's XXXL button display using global function
        if (typeof updateExtendedSizeDisplay === 'function') {
            updateExtendedSizeDisplay(productId);
        }

        // Update badge in main table (for addProductRow-created rows)
        const childRows = document.querySelectorAll(`tr[data-parent-row-id="${productId}"]`);
        let extTotal = 0;
        childRows.forEach(childRow => {
            // Count only non-XXL sizes (XXL has its own column in header)
            const size = childRow.dataset.extendedSize;
            if (size !== 'XXL' && size !== '2XL') {
                const qtyDisplay = childRow.querySelector('.cell-qty');
                extTotal += parseInt(qtyDisplay?.textContent) || 0;
            }
        });
        this.updateExtendedBadge(productId, extTotal);

        // Recalculate all pricing
        this.recalculatePricing();

        // Close popup
        this.closeExtendedSizePopup();
    },

    /**
     * Update extended quantity badge in XXXL(Other) cell
     */
    updateExtendedBadge(productId, extTotal) {
        const badge = document.getElementById(`ext-badge-${productId}`);
        if (!badge) return;

        if (extTotal > 0) {
            badge.textContent = extTotal;
            badge.classList.add('has-qty');
        } else {
            badge.textContent = '+';
            badge.classList.remove('has-qty');
        }
    },

    /**
     * Remove a product from the products array
     * Called from global deleteRow() function
     * @param {number} rowId - The row ID to remove
     */
    removeProduct(rowId) {
        const index = this.products.findIndex(p => p.id === rowId);
        if (index !== -1) {
            this.products.splice(index, 1);
            this.markAsUnsaved();
        }
        // Child rows live in this.childRows, not this.products — both
        // removeChildRow() and deleteRow() funnel through here with the
        // child's rowId, so this is the single state-removal chokepoint.
        if (this.childRows.delete(Number(rowId))) {
            this.markAsUnsaved();
        }
    },

    /**
     * Register a newly created child row in JS state.
     * @param {number} childRowId - row id from getNextRowId()
     * @param {{parentId: number, size: string, qty: number, baseCost: number, sizeUpcharges: object}} data
     */
    registerChildRow(childRowId, data) {
        this.childRows.set(Number(childRowId), {
            parentId: Number(data.parentId),
            size: data.size,
            qty: parseInt(data.qty) || 0,
            baseCost: parseFloat(data.baseCost) || 0,
            sizeUpcharges: data.sizeUpcharges || {}
        });
    },

    /**
     * Update a child row's quantity in JS state.
     */
    setChildRowQty(childRowId, qty) {
        const child = this.childRows.get(Number(childRowId));
        if (child) child.qty = parseInt(qty) || 0;
    },

    /**
     * All child rows belonging to a parent product, as [{id, ...entry}] in
     * insertion order (matches the legacy childRowMap iteration order).
     */
    getChildRowsForParent(parentId) {
        const result = [];
        this.childRows.forEach((child, id) => {
            if (child.parentId === Number(parentId)) result.push({ id, ...child });
        });
        return result;
    },
};
