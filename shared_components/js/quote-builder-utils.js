/**
 * Quote Builder Shared Utilities
 *
 * Common utility functions shared across all quote builders (DTG, DTF, Screenprint, Embroidery).
 * These functions are IDENTICAL across all builders and should be maintained in one place.
 *
 * Usage: Include this script BEFORE the quote builder's inline script.
 *
 * @version 1.0.0
 * @date 2026-01-30
 */

// ============================================
// STRING UTILITIES
// ============================================

/**
 * Escape HTML special characters to prevent XSS
 * @param {string} str - The string to escape
 * @returns {string} - The escaped string
 */
function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

/**
 * Format a price for display (removes trailing zeros for whole numbers)
 * @param {number} price - The price to format
 * @returns {string} - Formatted price string
 */
function formatPrice(price) {
    if (price % 1 === 0) return price.toFixed(0);
    return price.toFixed(2);
}

// ============================================
// TOAST NOTIFICATIONS
// ============================================

/**
 * Show a toast notification
 * @param {string} message - The message to display
 * @param {string} type - The type of toast: 'info', 'success', 'warning', 'error'
 * @param {number} duration - How long to show the toast (ms)
 */
function showToast(message, type = 'info', duration = 3000) {
    const container = document.getElementById('toast-container');
    if (!container) {
        console.warn('[showToast] No toast-container found in DOM');
        // Fallback for pages without toast container
        if (type === 'error') {
            console.error(`[${type}] ${message}`);
        }
        return;
    }

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    // Select icon based on type
    const icons = {
        success: 'check',
        error: 'exclamation-circle',
        warning: 'exclamation-triangle',
        info: 'info-circle'
    };
    const icon = icons[type] || 'info-circle';

    toast.innerHTML = `<i class="fas fa-${icon}"></i> ${escapeHtml(message)}`;
    container.appendChild(toast);

    // Add 'show' class after brief delay for CSS transition (required by quote-builder-common.css)
    // This is compatible with both animation-based and transition-based CSS
    setTimeout(() => toast.classList.add('show'), 10);

    setTimeout(() => {
        toast.classList.remove('show');
        // Wait for fade-out transition before removing
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

// ============================================
// DISCOUNT HANDLING
// ============================================

/**
 * Update discount type display (percent vs fixed)
 * Handles showing/hiding preset dropdown vs custom input
 */
function updateDiscountType() {
    const discountType = document.getElementById('discount-type')?.value;
    const prefix = document.getElementById('discount-prefix');
    const inputWrapper = document.getElementById('discount-input-wrapper');
    const presetDropdown = document.getElementById('discount-preset');
    const amountInput = document.getElementById('discount-amount');

    if (discountType === 'percent') {
        // Show preset dropdown, hide number input
        if (inputWrapper) inputWrapper.style.display = 'none';
        if (presetDropdown) presetDropdown.style.display = 'block';
        if (prefix) prefix.textContent = '%';
        // Reset to first preset option
        if (presetDropdown && presetDropdown.value === '') {
            presetDropdown.selectedIndex = 0;
        }
        handleDiscountPresetChange();
    } else {
        // Fixed dollar - show number input, hide preset dropdown
        if (presetDropdown) presetDropdown.style.display = 'none';
        if (inputWrapper) inputWrapper.style.display = 'flex';
        if (prefix) prefix.textContent = '$';
        if (amountInput) amountInput.value = '';
    }

    // Trigger recalculation
    if (typeof updateFeeTableRows === 'function') {
        updateFeeTableRows();
    }
}

/**
 * Handle discount preset dropdown change
 * Shows custom input when 'custom' is selected
 */
function handleDiscountPresetChange() {
    const preset = document.getElementById('discount-preset')?.value;
    const inputWrapper = document.getElementById('discount-input-wrapper');
    const amountInput = document.getElementById('discount-amount');
    const prefix = document.getElementById('discount-prefix');

    if (preset === 'custom') {
        // Show number input for custom entry
        if (inputWrapper) inputWrapper.style.display = 'flex';
        if (prefix) prefix.textContent = '%';
        if (amountInput) amountInput.focus();
    } else {
        // Use preset value
        if (inputWrapper) inputWrapper.style.display = 'none';
        if (amountInput) amountInput.value = preset;
    }

    // Trigger recalculation
    if (typeof updateFeeTableRows === 'function') {
        updateFeeTableRows();
    }
}

/**
 * Handle discount reason preset dropdown change
 * Shows custom input when 'custom' is selected
 */
function handleDiscountReasonPresetChange() {
    const preset = document.getElementById('discount-reason-preset')?.value;
    const customInput = document.getElementById('discount-reason');

    if (preset === 'custom') {
        // Show custom input and focus it
        if (customInput) {
            customInput.style.display = 'block';
            customInput.value = '';
            customInput.focus();
        }
    } else {
        // Hide custom input and use preset value
        if (customInput) {
            customInput.style.display = 'none';
            customInput.value = preset;
        }
    }

    // Trigger recalculation if needed
    if (typeof updateFeeTableRows === 'function') {
        updateFeeTableRows();
    }
}

// ============================================
// TAX CALCULATION
// ============================================

/**
 * Update tax calculation based on checkbox state
 * Standard pattern: 10.1% tax rate
 */
function updateTaxCalculation() {
    const taxCheckbox = document.getElementById('apply-tax');
    const taxRow = document.getElementById('tax-row');

    if (taxCheckbox && taxRow) {
        if (taxCheckbox.checked) {
            taxRow.style.display = '';
        } else {
            taxRow.style.display = 'none';
        }
    }

    // Trigger recalculation
    if (typeof updateFeeTableRows === 'function') {
        updateFeeTableRows();
    }
}

// ============================================
// ADDITIONAL CHARGES
// ============================================

/**
 * Update additional charges display
 * Parses the custom input and adds to fee calculations
 */
function updateAdditionalCharges() {
    // This triggers recalculation - the actual parsing happens in updateFeeTableRows
    if (typeof updateFeeTableRows === 'function') {
        updateFeeTableRows();
    }
}

// ============================================
// URL SHARING
// ============================================

/**
 * Copy shareable URL to clipboard
 * Used by the share modal in all quote builders
 */
function copyShareableUrl() {
    const urlInput = document.getElementById('shareable-url');
    if (!urlInput) return;

    urlInput.select();
    urlInput.setSelectionRange(0, 99999); // For mobile

    try {
        navigator.clipboard.writeText(urlInput.value).then(() => {
            showToast('URL copied to clipboard!', 'success');
        }).catch(() => {
            // Fallback for older browsers
            document.execCommand('copy');
            showToast('URL copied to clipboard!', 'success');
        });
    } catch (err) {
        // Final fallback
        document.execCommand('copy');
        showToast('URL copied to clipboard!', 'success');
    }
}

/**
 * Close the save success modal
 */
function closeSaveModal() {
    const modal = document.getElementById('save-success-modal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// ============================================
// KEYBOARD NAVIGATION
// ============================================

/**
 * Handle keyboard navigation in table cells
 * Supports Tab, Shift+Tab, Enter, Arrow keys
 * @param {KeyboardEvent} event - The keyboard event
 * @param {HTMLElement} input - The input element
 */
function handleCellKeydown(event, input) {
    const key = event.key;
    const row = input.closest('tr');
    const cell = input.closest('td');

    if (!row || !cell) return;

    // Get all editable inputs in the current row
    const rowInputs = Array.from(row.querySelectorAll('input:not([type="hidden"]), select'));
    const currentIndex = rowInputs.indexOf(input);

    // Get all rows in the table body
    const tbody = row.closest('tbody');
    if (!tbody) return;

    const allRows = Array.from(tbody.querySelectorAll('tr:not(.child-row)'));
    const currentRowIndex = allRows.indexOf(row);

    switch (key) {
        case 'Tab':
            // Let default Tab behavior work, but we could enhance it here
            break;

        case 'Enter':
            // Move to the same cell in the next row
            event.preventDefault();
            if (currentRowIndex < allRows.length - 1) {
                const nextRow = allRows[currentRowIndex + 1];
                const nextRowInputs = Array.from(nextRow.querySelectorAll('input:not([type="hidden"]), select'));
                if (nextRowInputs[currentIndex]) {
                    nextRowInputs[currentIndex].focus();
                    nextRowInputs[currentIndex].select();
                }
            }
            break;

        case 'ArrowDown':
            // Move down to same cell in next row
            if (currentRowIndex < allRows.length - 1) {
                event.preventDefault();
                const nextRow = allRows[currentRowIndex + 1];
                const nextRowInputs = Array.from(nextRow.querySelectorAll('input:not([type="hidden"]), select'));
                if (nextRowInputs[currentIndex]) {
                    nextRowInputs[currentIndex].focus();
                    nextRowInputs[currentIndex].select();
                }
            }
            break;

        case 'ArrowUp':
            // Move up to same cell in previous row
            if (currentRowIndex > 0) {
                event.preventDefault();
                const prevRow = allRows[currentRowIndex - 1];
                const prevRowInputs = Array.from(prevRow.querySelectorAll('input:not([type="hidden"]), select'));
                if (prevRowInputs[currentIndex]) {
                    prevRowInputs[currentIndex].focus();
                    prevRowInputs[currentIndex].select();
                }
            }
            break;
    }
}

// ============================================
// PRODUCT THUMBNAIL UTILITIES
// ============================================

/**
 * Update product thumbnail in a table row
 * @param {string} rowId - The row ID
 * @param {string} imageUrl - The image URL
 * @param {string} productName - The product name
 * @param {string} styleNumber - The style number
 * @param {string} colorName - The color name
 */
function updateProductThumbnail(rowId, imageUrl, productName, styleNumber, colorName) {
    const thumbContainer = document.getElementById(`thumb-${rowId}`);
    if (!thumbContainer) return;

    if (imageUrl) {
        thumbContainer.innerHTML = `
            <img src="${escapeHtml(imageUrl)}"
                 alt="${escapeHtml(productName || 'Product')}"
                 class="product-thumbnail"
                 onerror="this.parentElement.innerHTML='<div class=\\'thumb-placeholder\\'><i class=\\'fas fa-image\\'></i></div>'"
                 onclick="openThumbnailModal('${escapeHtml(imageUrl)}', '${escapeHtml(productName || '')}', '${escapeHtml(styleNumber || '')}', '${escapeHtml(colorName || '')}')">
        `;
    } else {
        thumbContainer.innerHTML = '<div class="thumb-placeholder"><i class="fas fa-image"></i></div>';
    }
}

// ============================================
// FORM UTILITIES
// ============================================

/**
 * Parse a number from an input, returning 0 if invalid
 * @param {string|number} value - The value to parse
 * @returns {number} - The parsed number or 0
 */
function parseInputNumber(value) {
    const num = parseFloat(value);
    return isNaN(num) ? 0 : num;
}

/**
 * Parse an integer from an input, returning 0 if invalid
 * @param {string|number} value - The value to parse
 * @returns {number} - The parsed integer or 0
 */
function parseInputInt(value) {
    const num = parseInt(value, 10);
    return isNaN(num) ? 0 : num;
}

/**
 * Get the current discount value based on type and inputs
 * @returns {object} - { type: 'percent'|'fixed', value: number, reason: string }
 */
function getDiscountValues() {
    const discountType = document.getElementById('discount-type')?.value || 'percent';
    const discountPreset = document.getElementById('discount-preset')?.value;
    const discountAmount = document.getElementById('discount-amount')?.value;
    const discountReasonPreset = document.getElementById('discount-reason-preset')?.value;
    const discountReasonCustom = document.getElementById('discount-reason')?.value;

    let value = 0;
    if (discountType === 'percent') {
        if (discountPreset === 'custom') {
            value = parseInputNumber(discountAmount);
        } else {
            value = parseInputNumber(discountPreset);
        }
    } else {
        value = parseInputNumber(discountAmount);
    }

    let reason = '';
    if (discountReasonPreset === 'custom') {
        reason = discountReasonCustom || '';
    } else {
        reason = discountReasonPreset || '';
    }

    return {
        type: discountType,
        value: value,
        reason: reason
    };
}

// ============================================
// INITIALIZATION HELPER
// ============================================

/**
 * Initialize discount controls with proper display states
 * Call this on page load after DOM is ready
 */
function initializeDiscountControls() {
    // Set initial state based on current values
    const discountType = document.getElementById('discount-type');
    if (discountType) {
        updateDiscountType();
    }

    // Set up reason preset
    const reasonPreset = document.getElementById('discount-reason-preset');
    if (reasonPreset) {
        handleDiscountReasonPresetChange();
    }
}

// Log that utilities are loaded
console.log('[QuoteBuilderUtils] Shared utilities loaded v1.0.0');
