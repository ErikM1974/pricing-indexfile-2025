/**
 * Quote Builder Core - Shared Base Module for All Quote Builders
 *
 * Used by: DTG, Screen Print, DTF, and Embroidery Quote Builders
 *
 * This module provides core functionality that is common across all
 * quote builders, including:
 * - Row management (add, delete, clone)
 * - Child row management for extended sizes
 * - Size input handling
 * - Extended size popup management
 * - Quote ID generation
 * - Copy to clipboard functionality
 *
 * Each quote builder should:
 * 1. Include this script before their builder-specific code
 * 2. Initialize QuoteBuilderCore with builder-specific config
 * 3. Override methods as needed for decoration-specific behavior
 *
 * @version 1.0.0
 * @created 2026-01-07
 */

class QuoteBuilderCore {
    constructor(config = {}) {
        // Builder identification
        this.prefix = config.prefix || 'QUOTE';  // DTG, SP, DTF, EMB
        this.builderName = config.builderName || 'Quote Builder';

        // DOM selectors
        this.tableBodyId = config.tableBodyId || 'product-tbody';
        this.totalQtyId = config.totalQtyId || 'total-quantity';
        this.pricingTierId = config.pricingTierId || 'pricing-tier';

        // State tracking
        this.rowCounter = 0;
        this.childRowMap = {};  // { parentRowId: { size: childRowId } }

        // Feature flags
        this.enableDuplicateCheck = config.enableDuplicateCheck ?? true;
        this.enableAutoFocus = config.enableAutoFocus ?? true;

        // Callbacks
        this.onRowAdded = config.onRowAdded || null;
        this.onRowDeleted = config.onRowDeleted || null;
        this.onSizeChange = config.onSizeChange || null;
        this.onPricingRecalc = config.onPricingRecalc || null;

        // API configuration
        this.apiBase = config.apiBase || 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';

        // Import extended sizes config if available
        this.extendedSizesConfig = window.ExtendedSizesConfig || null;

        console.log(`[QuoteBuilderCore] Initialized for ${this.builderName} (prefix: ${this.prefix})`);
    }

    // ═══════════════════════════════════════════════════════════════
    // ROW MANAGEMENT
    // ═══════════════════════════════════════════════════════════════

    /**
     * Generate a new unique row ID
     * @returns {number} New row ID
     */
    generateRowId() {
        return ++this.rowCounter;
    }

    /**
     * Get the table body element
     * @returns {HTMLElement|null}
     */
    getTableBody() {
        return document.getElementById(this.tableBodyId);
    }

    /**
     * Get a row element by ID
     * @param {number} rowId - The row ID
     * @returns {HTMLElement|null}
     */
    getRow(rowId) {
        return document.getElementById(`row-${rowId}`);
    }

    /**
     * Delete a row and all its child rows
     * @param {number} rowId - The row ID to delete
     */
    deleteRow(rowId) {
        const row = this.getRow(rowId);
        if (!row) return;

        // If this is a parent row, delete all child rows first
        if (!row.classList.contains('child-row') && this.childRowMap[rowId]) {
            Object.keys(this.childRowMap[rowId]).forEach(size => {
                const childRowId = this.childRowMap[rowId][size];
                const childRow = this.getRow(childRowId);
                if (childRow) childRow.remove();
            });
            delete this.childRowMap[rowId];
        }

        // Remove the row
        row.remove();

        // Callback
        if (this.onRowDeleted) {
            this.onRowDeleted(rowId);
        }

        // Trigger pricing recalculation
        this.triggerPricingRecalc();
    }

    /**
     * Check if a style + color combination already exists
     * @param {string} style - Style number
     * @param {string} catalogColor - Catalog color code
     * @param {number} excludeRowId - Row ID to exclude from check
     * @returns {number|null} Existing row ID or null
     */
    findExistingRow(style, catalogColor, excludeRowId = null) {
        if (!this.enableDuplicateCheck) return null;

        const tbody = this.getTableBody();
        if (!tbody) return null;

        const rows = tbody.querySelectorAll('tr:not(.child-row)');
        for (const row of rows) {
            const rowId = parseInt(row.dataset.rowId);
            if (excludeRowId && rowId === excludeRowId) continue;

            if (row.dataset.style === style && row.dataset.catalogColor === catalogColor) {
                return rowId;
            }
        }
        return null;
    }

    // ═══════════════════════════════════════════════════════════════
    // CHILD ROW MANAGEMENT
    // ═══════════════════════════════════════════════════════════════

    /**
     * Create a child row for an extended size
     * @param {number} parentRowId - Parent row ID
     * @param {string} size - Extended size (e.g., '3XL')
     * @param {number} qty - Quantity
     * @returns {number} New child row ID
     */
    createChildRow(parentRowId, size, qty) {
        const parentRow = this.getRow(parentRowId);
        if (!parentRow) {
            console.error(`[QuoteBuilderCore] Parent row not found: ${parentRowId}`);
            return null;
        }

        const childRowId = this.generateRowId();
        const baseStyle = parentRow.dataset.style;
        const partNumber = this.getPartNumber(baseStyle, size);

        // Get parent's color data
        const colorData = {
            colorName: parentRow.dataset.color,
            catalogColor: parentRow.dataset.catalogColor,
            swatchUrl: parentRow.dataset.swatchUrl,
            hex: parentRow.dataset.hex
        };

        // Determine which column this size goes to
        const isSize05 = this.isSize05(size);

        // Create child row element
        const childRow = document.createElement('tr');
        childRow.id = `row-${childRowId}`;
        childRow.className = 'child-row';
        childRow.dataset.rowId = childRowId;
        childRow.dataset.parentRowId = parentRowId;
        childRow.dataset.extendedSize = size;
        childRow.dataset.style = partNumber;
        childRow.dataset.baseStyle = baseStyle;
        childRow.dataset.color = colorData.colorName;
        childRow.dataset.catalogColor = colorData.catalogColor;
        if (colorData.swatchUrl) childRow.dataset.swatchUrl = colorData.swatchUrl;
        if (colorData.hex) childRow.dataset.hex = colorData.hex;

        // Build child row HTML (to be customized by each builder)
        childRow.innerHTML = this.buildChildRowHTML(childRowId, parentRowId, size, qty, partNumber, colorData);

        // Track in childRowMap
        if (!this.childRowMap[parentRowId]) {
            this.childRowMap[parentRowId] = {};
        }
        this.childRowMap[parentRowId][size] = childRowId;

        // Insert in correct position (sorted by extended size order)
        this.insertChildRowSorted(parentRow, childRow, size);

        return childRowId;
    }

    /**
     * Build HTML for a child row (override in each builder)
     * @param {number} childRowId
     * @param {number} parentRowId
     * @param {string} size
     * @param {number} qty
     * @param {string} partNumber
     * @param {Object} colorData
     * @returns {string} HTML string
     */
    buildChildRowHTML(childRowId, parentRowId, size, qty, partNumber, colorData) {
        // Default implementation - builders should override this
        return `
            <td><span class="child-indicator">└</span><span class="style-display">${partNumber}</span></td>
            <td class="desc-cell"><span class="desc-display">${size}</span></td>
            <td><!-- color picker --></td>
            <td colspan="5"></td>
            <td class="cell-qty" id="row-qty-${childRowId}">${qty}</td>
            <td class="cell-price" id="row-price-${childRowId}">-</td>
            <td><button class="btn-delete-row" onclick="quoteBuilderCore.removeChildRow(${parentRowId}, '${size}')">×</button></td>
        `;
    }

    /**
     * Insert child row in sorted position based on EXTENDED_SIZE_ORDER
     * @param {HTMLElement} parentRow
     * @param {HTMLElement} childRow
     * @param {string} size
     */
    insertChildRowSorted(parentRow, childRow, size) {
        const newSizeIndex = this.getSizeSortIndex(size);

        // Find existing child rows for this parent
        const existingChildren = Array.from(
            document.querySelectorAll(`tr[data-parent-row-id="${parentRow.dataset.rowId}"]`)
        );

        // Find the right position to insert
        let insertAfter = parentRow;

        for (const existing of existingChildren) {
            const existingSize = existing.dataset.extendedSize;
            const existingSizeIndex = this.getSizeSortIndex(existingSize);

            if (existingSizeIndex < newSizeIndex) {
                insertAfter = existing;
            } else {
                break;
            }
        }

        // Insert after the determined element
        insertAfter.after(childRow);
    }

    /**
     * Update quantity in an existing child row
     * @param {number} childRowId - Child row ID
     * @param {number} qty - New quantity
     */
    updateChildRow(childRowId, qty) {
        const childRow = this.getRow(childRowId);
        if (!childRow) return;

        // Update quantity display
        const qtyDisplay = document.getElementById(`row-qty-${childRowId}`);
        if (qtyDisplay) qtyDisplay.textContent = qty;

        // Update any quantity input
        const qtyInput = childRow.querySelector('.extended-size-qty, .size-input');
        if (qtyInput) qtyInput.value = qty;

        // Trigger pricing recalculation
        this.triggerPricingRecalc();
    }

    /**
     * Remove a child row for an extended size
     * @param {number} parentRowId - Parent row ID
     * @param {string} size - Extended size to remove
     */
    removeChildRow(parentRowId, size) {
        const childRowId = this.childRowMap[parentRowId]?.[size];
        if (!childRowId) return;

        // Remove from DOM
        const childRow = this.getRow(childRowId);
        if (childRow) childRow.remove();

        // Remove from tracking map
        delete this.childRowMap[parentRowId][size];

        // Re-enable parent's input for this size if applicable
        if (size === '2XL' || size === 'XXL') {
            const parentRow = this.getRow(parentRowId);
            if (parentRow) {
                const xxlInput = parentRow.querySelector('[data-size="2XL"], [data-size="XXL"]');
                if (xxlInput) {
                    xxlInput.disabled = false;
                    xxlInput.style.background = '';
                    xxlInput.style.color = '';
                    xxlInput.value = '';
                }
            }
        }

        // Update extended size button badge
        this.updateExtendedSizeButtonBadge(parentRowId);

        // Trigger pricing recalculation
        this.triggerPricingRecalc();
    }

    /**
     * Update the extended size button badge showing count of extended sizes
     * @param {number} parentRowId
     */
    updateExtendedSizeButtonBadge(parentRowId) {
        const parentRow = this.getRow(parentRowId);
        if (!parentRow) return;

        const btn = parentRow.querySelector('.xxxl-picker-btn, .extended-size-btn');
        if (!btn) return;

        // Count extended sizes (excluding 2XL which has its own column)
        const childSizes = this.childRowMap[parentRowId] || {};
        const count = Object.keys(childSizes).filter(s => s !== '2XL' && s !== 'XXL').length;

        if (count > 0) {
            btn.value = `+${count}`;
            btn.classList.add('has-sizes');
        } else {
            btn.value = '+';
            btn.classList.remove('has-sizes');
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // SIZE UTILITIES (using ExtendedSizesConfig if available)
    // ═══════════════════════════════════════════════════════════════

    /**
     * Get part number suffix for a size
     * @param {string} size
     * @returns {string}
     */
    getSizeSuffix(size) {
        if (this.extendedSizesConfig) {
            return this.extendedSizesConfig.getSizeSuffix(size);
        }
        // Fallback
        const suffixes = { '2XL': '_2X', 'XXL': '_2X', '3XL': '_3X', '4XL': '_4X', '5XL': '_5X', '6XL': '_6X', 'XS': '_XS' };
        return suffixes[size] || '';
    }

    /**
     * Get full part number (style + suffix)
     * @param {string} baseStyle
     * @param {string} size
     * @returns {string}
     */
    getPartNumber(baseStyle, size) {
        if (this.extendedSizesConfig) {
            return this.extendedSizesConfig.getPartNumber(baseStyle, size);
        }
        const suffix = this.getSizeSuffix(size);
        return suffix ? `${baseStyle}${suffix}` : baseStyle;
    }

    /**
     * Check if size goes in Size05 column
     * @param {string} size
     * @returns {boolean}
     */
    isSize05(size) {
        if (this.extendedSizesConfig) {
            return this.extendedSizesConfig.isSize05(size);
        }
        return size === '2XL' || size === 'XXL';
    }

    /**
     * Get sort index for size ordering
     * @param {string} size
     * @returns {number}
     */
    getSizeSortIndex(size) {
        if (this.extendedSizesConfig) {
            return this.extendedSizesConfig.getSizeSortIndex(size);
        }
        const order = ['XS', '2XL', 'XXL', '3XL', '4XL', '5XL', '6XL'];
        const index = order.indexOf(size);
        return index !== -1 ? index : 999;
    }

    // ═══════════════════════════════════════════════════════════════
    // QUOTE ID GENERATION
    // ═══════════════════════════════════════════════════════════════

    /**
     * Generate a unique quote ID
     * Format: PREFIX + MMDD + - + sequence
     * Example: DTG0107-3 (3rd DTG quote on Jan 7)
     * @returns {string}
     */
    generateQuoteId() {
        const now = new Date();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const dateKey = `${month}${day}`;

        // Get or create daily sequence counter
        const storageKey = `${this.prefix}_quote_sequence_${dateKey}`;
        let sequence = parseInt(sessionStorage.getItem(storageKey) || '0') + 1;
        sessionStorage.setItem(storageKey, sequence.toString());

        return `${this.prefix}${dateKey}-${sequence}`;
    }

    // ═══════════════════════════════════════════════════════════════
    // QUANTITY CALCULATIONS
    // ═══════════════════════════════════════════════════════════════

    /**
     * Calculate total quantity from a parent row (including child rows)
     * @param {number} rowId
     * @returns {number}
     */
    getRowTotalQuantity(rowId) {
        const row = this.getRow(rowId);
        if (!row) return 0;

        let total = 0;

        // Sum standard size inputs (S, M, L, XL)
        row.querySelectorAll('.size-input:not(.xxxl-picker-btn):not(:disabled)').forEach(input => {
            total += parseInt(input.value) || 0;
        });

        // Add child row quantities
        const childSizes = this.childRowMap[rowId] || {};
        Object.values(childSizes).forEach(childRowId => {
            const qtyEl = document.getElementById(`row-qty-${childRowId}`);
            if (qtyEl) {
                total += parseInt(qtyEl.textContent) || 0;
            }
        });

        return total;
    }

    /**
     * Calculate total quantity across all products
     * @returns {number}
     */
    getTotalQuantity() {
        const tbody = this.getTableBody();
        if (!tbody) return 0;

        let total = 0;
        const parentRows = tbody.querySelectorAll('tr:not(.child-row)');

        parentRows.forEach(row => {
            const rowId = parseInt(row.dataset.rowId);
            if (rowId) {
                total += this.getRowTotalQuantity(rowId);
            }
        });

        return total;
    }

    /**
     * Update the total quantity display
     */
    updateTotalQuantityDisplay() {
        const total = this.getTotalQuantity();
        const display = document.getElementById(this.totalQtyId);
        if (display) {
            display.textContent = total;
        }
        return total;
    }

    // ═══════════════════════════════════════════════════════════════
    // PRICING TIER
    // ═══════════════════════════════════════════════════════════════

    /**
     * Get pricing tier label based on quantity (override per builder)
     * @param {number} quantity
     * @returns {string}
     */
    getTierLabel(quantity) {
        // Default tiers - builders should override this
        // 2026-02 RESTRUCTURE: New tiers 1-7 (LTM) and 8-23 (no LTM)
        if (quantity >= 72) return '72+';
        if (quantity >= 48) return '48-71';
        if (quantity >= 24) return '24-47';
        if (quantity >= 8) return '8-23';
        return '1-7';
    }

    /**
     * Update the pricing tier display
     * @param {number} quantity
     */
    updateTierDisplay(quantity = null) {
        if (quantity === null) {
            quantity = this.getTotalQuantity();
        }
        const tierLabel = this.getTierLabel(quantity);
        const display = document.getElementById(this.pricingTierId);
        if (display) {
            display.textContent = tierLabel;
        }
        return tierLabel;
    }

    // ═══════════════════════════════════════════════════════════════
    // COPY TO CLIPBOARD
    // ═══════════════════════════════════════════════════════════════

    /**
     * Copy quote summary to clipboard as plain text
     * Override this method in each builder for custom formatting
     * @returns {Promise<boolean>}
     */
    async copyToClipboard() {
        const text = this.formatQuoteForClipboard();

        try {
            await navigator.clipboard.writeText(text);
            this.showToast('Quote copied to clipboard!', 'success');
            return true;
        } catch (err) {
            console.error('[QuoteBuilderCore] Clipboard copy failed:', err);
            this.showToast('Failed to copy to clipboard', 'error');
            return false;
        }
    }

    /**
     * Format quote data for clipboard (override per builder)
     * @returns {string}
     */
    formatQuoteForClipboard() {
        // Default implementation - builders should override
        const lines = [];
        lines.push(`=== ${this.builderName} Quote ===`);
        lines.push(`Date: ${new Date().toLocaleDateString()}`);
        lines.push(`Total Quantity: ${this.getTotalQuantity()}`);
        lines.push(`Pricing Tier: ${this.getTierLabel(this.getTotalQuantity())}`);
        lines.push('');
        lines.push('Products:');

        const tbody = this.getTableBody();
        if (tbody) {
            const parentRows = tbody.querySelectorAll('tr:not(.child-row)');
            parentRows.forEach(row => {
                const style = row.dataset.style || '-';
                const color = row.dataset.color || '-';
                const qty = this.getRowTotalQuantity(parseInt(row.dataset.rowId));
                lines.push(`  ${style} - ${color}: ${qty} pcs`);
            });
        }

        return lines.join('\n');
    }

    // ═══════════════════════════════════════════════════════════════
    // UTILITIES
    // ═══════════════════════════════════════════════════════════════

    /**
     * Trigger pricing recalculation
     */
    triggerPricingRecalc() {
        if (this.onPricingRecalc) {
            this.onPricingRecalc();
        } else if (typeof recalculatePricing === 'function') {
            recalculatePricing();
        }
    }

    /**
     * Show a toast notification
     * @param {string} message
     * @param {string} type - 'success', 'error', 'warning', 'info'
     */
    showToast(message, type = 'info') {
        // Check for existing toast function
        if (typeof showToast === 'function') {
            showToast(message, type);
            return;
        }

        // Fallback: simple console log
        console.log(`[Toast ${type}] ${message}`);
    }

    /**
     * Close all open dropdowns (color pickers, etc.)
     */
    closeAllDropdowns() {
        document.querySelectorAll('.color-picker-dropdown').forEach(d => {
            d.classList.add('hidden');
        });
    }

    /**
     * Collect all products from table for pricing calculation
     * @returns {Array}
     */
    collectProductsFromTable() {
        const products = [];
        const tbody = this.getTableBody();
        if (!tbody) return products;

        const parentRows = tbody.querySelectorAll('tr:not(.child-row)');

        parentRows.forEach(row => {
            const rowId = parseInt(row.dataset.rowId);
            const style = row.dataset.style;
            const color = row.dataset.color;
            const catalogColor = row.dataset.catalogColor;

            if (!style) return; // Skip empty rows

            // Build size breakdown
            const sizeBreakdown = {};

            // Standard sizes from parent row
            row.querySelectorAll('.size-input:not(.xxxl-picker-btn):not(:disabled)').forEach(input => {
                const size = input.dataset.size;
                const qty = parseInt(input.value) || 0;
                if (qty > 0) {
                    sizeBreakdown[size] = qty;
                }
            });

            // Extended sizes from child rows
            const childSizes = this.childRowMap[rowId] || {};
            Object.entries(childSizes).forEach(([size, childRowId]) => {
                const qtyEl = document.getElementById(`row-qty-${childRowId}`);
                const qty = parseInt(qtyEl?.textContent) || 0;
                if (qty > 0) {
                    sizeBreakdown[size] = qty;
                }
            });

            // Calculate total
            const totalQty = Object.values(sizeBreakdown).reduce((a, b) => a + b, 0);

            if (totalQty > 0) {
                products.push({
                    rowId,
                    style,
                    color,
                    catalogColor,
                    productName: row.dataset.productName,
                    sizeBreakdown,
                    totalQty,
                    isCap: row.dataset.isCap === 'true'
                });
            }
        });

        return products;
    }
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = QuoteBuilderCore;
}

// Make available globally
window.QuoteBuilderCore = QuoteBuilderCore;

console.log('[QuoteBuilderCore] Module loaded');
