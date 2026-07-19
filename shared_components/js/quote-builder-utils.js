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
// SERVICE_CODES (Caspio) — shared fee loader
// ============================================
// Service_Codes pricing (loadServiceCodePrices/getServicePrice) lives in
// builders/shared/service-codes.js — bundled + window-bridged by every builder
// entry point (Batch 3.5, 2026-07-09; the typeof-guarded copies that lived here
// had already drifted from the EMB module once). window._serviceCodes remains
// the cache contract; warnIfServiceCodeMissing below reads it.

// Shared "hardcoded fallback surfaced a warning" guard (Erik's #1 rule). A load
// FAILURE already toasts via loadServiceCodePrices(); this covers the SILENT case
// where codes loaded but a specific code (e.g. GRT-75 design rate) is absent, so a
// rep would bill the documented fallback price with no warning. Lifted out of the
// DTF builder (was window._dtfGrtFallbackWarned) so SCP + EMB warn identically.
// Once-per-page per code (guarded by a window flag). Returns true when it warned.
// (2026-07-04 — sync fix)
if (typeof window !== 'undefined' && typeof window.warnIfServiceCodeMissing !== 'function') {
    window.warnIfServiceCodeMissing = function warnIfServiceCodeMissing(code, fallback, label) {
        if (typeof window === 'undefined') return false;
        const key = String(code).toUpperCase();
        window._svcCodeFallbackWarned = window._svcCodeFallbackWarned || {};
        if (window._svcCodeFallbackWarned[key]) return false;
        // Only warn once codes have been fetched (map exists) but this one is missing.
        // Before the fetch resolves, getServicePrice() legitimately uses the fallback.
        if (!window._serviceCodes) return false;
        if (window._serviceCodes[key]) return false;
        window._svcCodeFallbackWarned[key] = true;
        const rate = (typeof fallback === 'number') ? fallback : parseFloat(fallback) || 0;
        const name = label || code;
        const m = `${name} rate is an estimate ($${rate.toFixed(2)}) — live pricing didn't return it. Verify before saving.`;
        if (typeof showToast === 'function') showToast(m, 'warning', 5000);
        // Persistent badge (roadmap 1.15) alongside the transient toast.
        if (typeof window.showFallbackPricingWarning === 'function') window.showFallbackPricingWarning(name);
        return true;
    };
}

// ============================================
// STAFF MARKER (customer-view analytics)
// ============================================
// Any browser that has opened a quote builder is a STAFF browser. The customer
// quote page (/quote/:id) checks this flag to avoid counting staff opens as
// "customer viewed" events. Best-effort telemetry, never load-bearing. (2026-06-10)
try { if (typeof localStorage !== 'undefined') localStorage.setItem('nwca_staff', '1'); } catch (_) { /* private mode */ }

// ============================================
// NUMBER PARSING
// ============================================

/**
 * Parse a tax/fee rate (percent) treating 0 as VALID — only falls back on
 * NaN/empty. The classic `parseFloat(v) || 10.1` coerces a legitimate 0%
 * (out-of-state, exempt) to 10.1%, silently taxing customers the screen
 * showed $0 tax for. Use this everywhere a rate input is read. (2026-06-10)
 * @param {*} value - raw input value
 * @param {number} fallback - rate to use when value is not a finite number
 * @returns {number}
 */
function parseRatePercent(value, fallback) {
    const n = parseFloat(value);
    return Number.isFinite(n) ? n : fallback;
}
if (typeof window !== 'undefined') window.parseRatePercent = parseRatePercent;

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
    // CSS rules are named .toast-success / .toast-error / etc — must prefix with "toast-".
    // Bug before 2026-05-25: was `toast ${type}` which created class "toast success" with
    // no matching CSS, so the toast rendered as an unstyled translucent box (white text on
    // no background) that briefly overlapped the floating AI chat button on page load.
    toast.className = `toast toast-${type}`;
    // Announce to assistive tech: errors interrupt (assertive), others are polite. (review C12)
    toast.setAttribute('role', type === 'error' ? 'alert' : 'status');
    toast.setAttribute('aria-atomic', 'true');

    // Select icon based on type
    const icons = {
        success: 'check',
        error: 'exclamation-circle',
        warning: 'exclamation-triangle',
        info: 'info-circle'
    };
    const icon = icons[type] || 'info-circle';

    toast.innerHTML = `<i class="fas fa-${escapeHtml(icon)}"></i> ${escapeHtml(message)}`;
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
 * Standard pattern: 10.2% tax rate
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
// PANEL TOGGLE FUNCTIONS
// ============================================

/**
 * Default the order dates for a NEW quote (2026-06-02, shared by EMB/SCP/DTF).
 * Date Placed → today; Req Ship Date → today + 14 days (2 weeks).
 * Only fills BLANK fields, so it never clobbers a loaded or typed-in value.
 * Element IDs: date-order-placed, req-ship-date (consistent across builders).
 */
function setQuoteDateDefaults() {
    // [2026-06-07] Format for the input's TYPE: native <input type=date> needs YYYY-MM-DD; legacy type=text
    // builders use MM/DD/YYYY. Setting MM/DD/YYYY on a type=date input is silently rejected → blank field.
    const fmt = (d, el) => {
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        return (el && el.type === 'date') ? `${yyyy}-${mm}-${dd}` : `${mm}/${dd}/${yyyy}`;
    };
    const today = new Date();
    const placed = document.getElementById('date-order-placed');
    if (placed && !placed.value.trim()) placed.value = fmt(today, placed);
    const reqShip = document.getElementById('req-ship-date');
    if (reqShip && !reqShip.value.trim()) {
        const d = new Date(today.getTime());
        d.setDate(d.getDate() + 14);
        reqShip.value = fmt(d, reqShip);
    }
}
if (typeof window !== 'undefined') window.setQuoteDateDefaults = setQuoteDateDefaults;

/**
 * Toggle Additional Charges panel expand/collapse
 * Element IDs: charges-content, charges-chevron (consistent across all builders)
 */
function toggleAdditionalCharges() {
    const content = document.getElementById('charges-content');
    const chevron = document.getElementById('charges-chevron');
    if (!content || !chevron) return;

    if (content.classList.contains('hidden')) {
        content.classList.remove('hidden');
        content.style.display = '';
        chevron.style.transform = 'rotate(180deg)';
    } else {
        content.classList.add('hidden');
        content.style.display = 'none';
        chevron.style.transform = 'rotate(0deg)';
    }
}

/**
 * Toggle merged Fees & Charges panel (replaces separate artwork + charges panels)
 * Element IDs: fees-charges-content, charges-chevron
 */
function toggleFeesCharges() {
    const content = document.getElementById('fees-charges-content');
    const chevron = document.getElementById('charges-chevron');
    if (!content || !chevron) return;

    if (content.classList.contains('hidden')) {
        content.classList.remove('hidden');
        content.style.display = '';
        chevron.style.transform = 'rotate(180deg)';
    } else {
        content.classList.add('hidden');
        content.style.display = 'none';
        chevron.style.transform = 'rotate(0deg)';
    }
}

/**
 * Toggle Artwork Services panel expand/collapse
 * Element IDs: artwork-content, artwork-chevron (consistent across all builders)
 */
function toggleArtworkServices() {
    const content = document.getElementById('artwork-content');
    const chevron = document.getElementById('artwork-chevron');
    if (!content || !chevron) return;

    if (content.classList.contains('hidden')) {
        content.classList.remove('hidden');
        content.style.display = '';
        chevron.style.transform = 'rotate(180deg)';
    } else {
        content.classList.add('hidden');
        content.style.display = 'none';
        chevron.style.transform = 'rotate(0deg)';
    }
}

/**
 * Toggle art charge checkbox and show/hide amount input
 * Handles the art-charge-toggle checkbox and art-charge input
 */
function toggleArtCharge() {
    const toggle = document.getElementById('art-charge-toggle');
    const input = document.getElementById('art-charge');
    const wrapper = document.getElementById('art-charge-wrapper');

    if (!toggle || !input) return;

    if (toggle.checked) {
        input.disabled = false;
        if (wrapper) wrapper.style.opacity = '1';
        input.style.opacity = '1';
        // Set default value if currently 0 — live Service_Codes GRT-50 price,
        // literal 50 is fallback-only (affects all 4 builders). (audit 2026-06-10)
        if (parseFloat(input.value) === 0) {
            const grt50 = (typeof window !== 'undefined' && typeof window.getServicePrice === 'function')
                ? window.getServicePrice('GRT-50', 50) : 50;
            input.value = Number(grt50).toFixed(2);
        }
    } else {
        input.disabled = true;
        if (wrapper) wrapper.style.opacity = '0.4';
        input.style.opacity = '0.5';
        input.value = '0';
    }

    updateArtworkCharges();
}

/**
 * Update artwork charges (art charge + design fee) - called on input change
 * Updates graphic design total display and artwork badge
 */
function updateArtworkCharges() {
    const artCharge = parseFloat(document.getElementById('art-charge')?.value || 0);
    const designHours = parseFloat(document.getElementById('graphic-design-hours')?.value || 0);
    // GRT-75 design rate from Caspio Service_Codes (fallback 75). (Pricing=API)
    const designTotal = designHours * (typeof getServicePrice === 'function' ? getServicePrice('GRT-75', 75) : 75);

    // Update graphic design total display (if element exists)
    const designTotalEl = document.getElementById('graphic-design-total');
    if (designTotalEl) {
        designTotalEl.textContent = designTotal.toFixed(2);
    }

    // Update artwork badge (if element exists)
    const badge = document.getElementById('artwork-badge');
    if (badge) {
        const totalArtwork = artCharge + designTotal;
        if (totalArtwork > 0) {
            badge.textContent = '+$' + totalArtwork.toFixed(2);
            badge.classList.remove('hidden');
            badge.style.display = 'inline'; // For embroidery compatibility
        } else {
            badge.classList.add('hidden');
            badge.style.display = 'none'; // For embroidery compatibility
        }
    }

    // Update fee table rows
    if (typeof updateFeeTableRows === 'function') {
        updateFeeTableRows();
    }

    // Recalculate tax (all builders do this)
    if (typeof updateTaxCalculation === 'function') {
        updateTaxCalculation();
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

// ============================================
// PRODUCT DISPLAY UTILITIES
// ============================================

/**
 * Remove style number prefix/suffix from product title
 * e.g., "PC54 - Port & Co Essential Tee" → "Port & Co Essential Tee"
 */
function cleanProductTitle(title, styleNumber) {
    if (!title || !styleNumber) return title || '';
    const escapedStyle = styleNumber.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    let cleaned = title.replace(new RegExp(`^${escapedStyle}\\s*[-.]\\s*`, 'i'), '');
    cleaned = cleaned.replace(new RegExp(`[.\\s]+${escapedStyle}\\s*$`, 'i'), '');
    return cleaned.trim() || title;
}

/**
 * Generate inline CSS style string for a color swatch
 * Uses COLOR_SQUARE_IMAGE if available, falls back to HEX_CODE
 */
function getSwatchStyle(color) {
    if (color.COLOR_SQUARE_IMAGE) {
        // Strip quotes/parens/backslashes/whitespace + require an http(s) URL so a crafted swatch value
        // can't break out of the style="" attribute or the url() (CSS/attribute injection). (review C32)
        const safe = String(color.COLOR_SQUARE_IMAGE).replace(/["'()\\\s]/g, '');
        if (/^https?:\/\//i.test(safe)) {
            return `background-image: url('${safe}'); background-size: cover; background-position: center;`;
        }
    }
    const hex = (color.HEX_CODE && /^#[0-9a-fA-F]{3,8}$/.test(color.HEX_CODE)) ? color.HEX_CODE : '#ccc';
    return `background-color: ${hex};`;
}

// ============================================
// LTM (LESS THAN MINIMUM) CONTROLS
// ============================================

/**
 * Render an LTM control panel with waive checkbox + display mode radio buttons.
 * @param {string} containerId - DOM id for the container div (must exist)
 * @param {object} options
 * @param {number} options.feeAmount - Current LTM fee dollar amount
 * @param {string} [options.feeLabel='Small Order Fee'] - Panel heading
 * @param {boolean} [options.defaultEnabled=true] - Whether LTM is applied by default
 * @param {string} [options.defaultMode='builtin'] - 'builtin' or 'separate'
 */
function renderLtmControlPanel(containerId, options = {}) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const feeAmount = options.feeAmount || 0;
    const feeLabel = options.feeLabel || 'Small Order Fee';
    const enabled = options.defaultEnabled !== false;
    const mode = options.defaultMode || 'builtin';
    const prefix = containerId; // unique prefix for radio name groups

    // eslint-disable-next-line no-unsanitized/property -- audited (1.4): feeLabel escapeHtml-wrapped; rest numeric/internal ids
    container.innerHTML = `
        <div class="ltm-control-panel">
            <div class="ltm-control-header">
                <i class="fas fa-exclamation-triangle"></i>
                <span>${escapeHtml(feeLabel)}</span>
            </div>
            <div class="ltm-control-body">
                <label class="ltm-checkbox-label" title="Also called the Less Than Minimum (LTM) fee — small orders carry a flat fee that disappears at the next price break">
                    <input type="checkbox" class="ltm-apply-checkbox" ${enabled ? 'checked' : ''}
                           data-ltm-container="${escapeHtml(containerId)}">
                    Apply small-batch fee (<span class="ltm-fee-display">$${feeAmount.toFixed(2)}</span>)
                    <span class="ltm-status-badge">${enabled ? 'Applied' : 'Waived'}</span>
                </label>
                <div class="ltm-mode-radios" ${!enabled ? 'style="opacity:0.4;pointer-events:none;"' : ''}>
                    <label class="ltm-radio-label">
                        <input type="radio" name="${prefix}-ltm-mode" value="builtin"
                               ${mode === 'builtin' ? 'checked' : ''} ${!enabled ? 'disabled' : ''}>
                        Built into price
                    </label>
                    <label class="ltm-radio-label">
                        <input type="radio" name="${prefix}-ltm-mode" value="separate"
                               ${mode === 'separate' ? 'checked' : ''} ${!enabled ? 'disabled' : ''}>
                        Show as separate line item
                    </label>
                </div>
            </div>
        </div>
    `;
}

/**
 * Read current LTM control state from a panel.
 * @param {string} containerId - The container id used in renderLtmControlPanel
 * @returns {{ enabled: boolean, displayMode: 'builtin'|'separate' }}
 */
function getLtmControlState(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return { enabled: true, displayMode: 'builtin' };

    const checkbox = container.querySelector('.ltm-apply-checkbox');
    const checkedRadio = container.querySelector(`input[name="${containerId}-ltm-mode"]:checked`);

    return {
        enabled: checkbox ? checkbox.checked : true,
        displayMode: checkedRadio ? checkedRadio.value : 'builtin'
    };
}

/**
 * Restore LTM control state (e.g., from a saved quote).
 * @param {string} containerId
 * @param {{ enabled?: boolean, displayMode?: string, feeAmount?: number }} state
 */
function setLtmControlState(containerId, state = {}) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const checkbox = container.querySelector('.ltm-apply-checkbox');
    const radios = container.querySelectorAll(`input[name="${containerId}-ltm-mode"]`);
    const modeWrapper = container.querySelector('.ltm-mode-radios');
    const badge = container.querySelector('.ltm-status-badge');

    if (checkbox && state.enabled !== undefined) {
        checkbox.checked = state.enabled;
        if (badge) badge.textContent = state.enabled ? 'Applied' : 'Waived';
        if (modeWrapper) {
            modeWrapper.style.opacity = state.enabled ? '' : '0.4';
            modeWrapper.style.pointerEvents = state.enabled ? '' : 'none';
        }
        radios.forEach(r => { r.disabled = !state.enabled; });
    }

    if (state.displayMode) {
        radios.forEach(r => { r.checked = (r.value === state.displayMode); });
    }

    if (state.feeAmount !== undefined) {
        const feeDisplay = container.querySelector('.ltm-fee-display');
        if (feeDisplay) feeDisplay.textContent = `$${state.feeAmount.toFixed(2)}`;
    }
}

/**
 * Wire up event listeners on an LTM control panel.
 * @param {string} containerId
 * @param {function} onChange - Called with { enabled: boolean, displayMode: string }
 */
function initLtmControlListeners(containerId, onChange) {
    const container = document.getElementById(containerId);
    if (!container) return;

    // Prevent double-binding if called multiple times
    if (container.dataset.ltmInitialized) return;
    container.dataset.ltmInitialized = 'true';

    const checkbox = container.querySelector('.ltm-apply-checkbox');
    const radios = container.querySelectorAll(`input[name="${containerId}-ltm-mode"]`);
    const modeWrapper = container.querySelector('.ltm-mode-radios');
    const badge = container.querySelector('.ltm-status-badge');

    function fireChange() {
        if (typeof onChange === 'function') {
            onChange(getLtmControlState(containerId));
        }
    }

    if (checkbox) {
        checkbox.addEventListener('change', () => {
            const enabled = checkbox.checked;
            if (badge) badge.textContent = enabled ? 'Applied' : 'Waived';
            if (modeWrapper) {
                modeWrapper.style.opacity = enabled ? '' : '0.4';
                modeWrapper.style.pointerEvents = enabled ? '' : 'none';
            }
            radios.forEach(r => { r.disabled = !enabled; });
            fireChange();
        });
    }

    radios.forEach(r => {
        r.addEventListener('change', fireChange);
    });
}

// ============================================
// SHARED BUILDER FUNCTIONS
// Extracted from DTG/Screenprint/Embroidery (identical across all)
// ============================================

/**
 * Populate customer info fields from a saved quote session.
 * @param {object} session - Caspio session object with CustomerName, CustomerEmail, etc.
 */
function populateCustomerInfo(session) {
    const fields = {
        'customer-name': session.CustomerName,
        'customer-email': session.CustomerEmail,
        'company-name': session.CompanyName,
        // Restore ShopWorks customer # for builders that have the field (SCP/EMB);
        // skipped harmlessly when the element is absent (loop checks `el`).
        'customer-number': session.CustomerNumber
    };
    for (const [id, value] of Object.entries(fields)) {
        const el = document.getElementById(id);
        if (el && value) el.value = value;
    }
    const salesRepSelect = document.getElementById('sales-rep');
    if (salesRepSelect && session.SalesRepEmail) {
        for (let i = 0; i < salesRepSelect.options.length; i++) {
            if (salesRepSelect.options[i].value === session.SalesRepEmail) {
                salesRepSelect.selectedIndex = i;
                break;
            }
        }
    }
}

/**
 * Check URL for ?edit=QUOTE_ID parameter.
 * @returns {string|null} Quote ID to edit, or null
 */
function checkForEditMode() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('edit');
}

/**
 * Phase 11.3.5 (Erik 2026-05-24): one-way ShopWorks sync — once a quote is
 * pushed to SW, ALL revisions happen there and flow back via the snapshot
 * sync. Editing in our app would silently diverge from SW.
 *
 * Call this from each builder's loadQuoteForEditing() RIGHT AFTER fetching
 * the session. Returns false when the quote is locked (caller should abort
 * load + bail). Default behavior on lock: alert the rep + redirect to the
 * read-only quote-view page. Pass { silent: true } to skip the alert/redirect
 * and just get the boolean (useful for tests or programmatic flows).
 *
 * @param {Object} session — quote_sessions row (must have .QuoteID + .Status)
 * @param {Object} [opts]
 * @param {boolean} [opts.silent=false] — skip alert + redirect on lock
 * @returns {boolean} true → safe to edit; false → locked, abort
 */
function assertQuoteEditable(session, opts = {}) {
    const lockedStatuses = new Set([
        'Processed',
        'Cancelled_in_ShopWorks',
        'Payment Confirmed',
        'Payment Confirmed - ShopWorks Failed',
        'Pending Payment',
    ]);
    const status = session && session.Status;
    // Lock if a locked status OR already pushed to ShopWorks. Once pushed,
    // ShopWorks is the source of truth, so edits here would diverge from the SW
    // order. The hourly sync flips Status to 'Processed' only AFTER ShopWorks
    // imports, so a freshly-pushed quote can still read 'Open' — PushedToShopWorks
    // catches that window. (2026-06-01)
    const isPushed = !!(session && session.PushedToShopWorks);

    // Customer-ACCEPTED quotes stay editable (legit fixups happen) but must not
    // mutate silently under the URL the customer approved — with online deposits
    // live, a re-saved revision is a consent mismatch. Persistent banner, never a
    // lock. (expert audit 2026-07-07)
    if (status === 'Accepted' && !isPushed && !opts.silent) {
        try {
            let banner = document.getElementById('accepted-quote-banner');
            if (!banner) {
                banner = document.createElement('div');
                banner.id = 'accepted-quote-banner';
                banner.className = 'accepted-quote-banner';
                const host = document.querySelector('.power-content') || document.body;
                host.insertBefore(banner, host.firstChild);
            }
            let acceptedOn = '';
            try {
                const notes = JSON.parse(session.Notes || '{}');   // EMB stores plain text here — parse failure is fine
                if (notes.acceptedAt) acceptedOn = ' on ' + new Date(notes.acceptedAt).toLocaleDateString();
                if (notes.acceptedByName) acceptedOn += ' by ' + notes.acceptedByName;
            } catch (_) { }
            const rev = session.RevisionNumber != null ? ` (Rev ${session.RevisionNumber})` : '';
            banner.innerHTML = '<i class="fas fa-file-signature"></i> ' +
                '<strong>Customer accepted this quote' + escapeHtml(acceptedOn) + escapeHtml(rev) + '.</strong> ' +
                'Saving creates a revision they have <u>not</u> re-approved — re-send for approval after any price change.';
        } catch (_) { /* banner is best-effort; never block the edit-load */ }
    }

    if (!lockedStatuses.has(status) && !isPushed) return true;

    if (opts.silent) return false;

    const quoteId = (session && session.QuoteID) || '(unknown)';
    const reason = lockedStatuses.has(status) ? `status: ${status}` : 'already pushed to ShopWorks';
    alert(
        `${quoteId} is in ShopWorks (${reason}).\n\n` +
        `Per the one-way sync rule, edits must happen in ShopWorks. ` +
        `Changes in this app would not sync back to the SW order.\n\n` +
        `Opening read-only quote view instead.`
    );
    try {
        window.location.href = `/quote/${encodeURIComponent(quoteId)}`;
    } catch (_) { /* navigation failed — swallow */ }
    return false;
}

/**
 * Update UI to show edit mode (header subtitle + save button text).
 * @param {string} quoteId
 * @param {number} revision
 */
function updateEditModeUI(quoteId, revision) {
    const headerSubtitle = document.querySelector('.power-header .power-header-subtitle');
    if (headerSubtitle) {
        headerSubtitle.innerHTML = `<span style="color: #fbbf24;">✏️ Editing: ${escapeHtml(String(quoteId))} • Rev ${escapeHtml(String(revision))}</span>`;
    }
    const saveBtn = document.querySelector('.btn-save-quote, [onclick*="saveAndGetLink"]');
    if (saveBtn) {
        saveBtn.innerHTML = '<i class="fas fa-save"></i> Save Revision';
    }
    // Phase A lookup-first panel: an edit-load restores customer fields inside the
    // collapsed "Enter details manually" section — reveal them so nothing loads hidden.
    if (typeof syncCustomerManualDetails === 'function') syncCustomerManualDetails();
}

// ============================================================
// Lookup-first customer panel (2026-07-07, guided-quote Phase A / P1 #4)
// ============================================================

/**
 * Open the "Enter details manually" <details> when any customer field holds a
 * value — so a lookup pick, an edit-load, a draft restore, or a duplicate can
 * never leave a filled name/email hidden behind the collapsed summary.
 * Idempotent; safe to call any time. The trio's manual grids are wrapped in
 * <details class="customer-manual"> (SCP/DTF/EMB builder HTML).
 */
function syncCustomerManualDetails() {
    const details = document.querySelector('details.customer-manual');
    if (!details || details.open) return;
    const hasValue = ['customer-name', 'customer-email', 'company-name', 'customer-number']
        .some(id => { const el = document.getElementById(id); return el && el.value && el.value.trim() !== ''; });
    if (hasValue) details.open = true;
}

// Safety net for async fill paths this file can't see (draft restore, duplicate
// mode): two delayed idempotent syncs after load. A no-op on pages without the
// details element (DTG, non-builder pages).
if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(syncCustomerManualDetails, 1200);
        setTimeout(syncCustomerManualDetails, 3500);
    });
}

/**
 * Auto-expand the (now default-collapsed) Services & Fees panel the FIRST time
 * a non-zero charge appears — an edit-load with saved fees must never leave a
 * billed amount hidden. Once only: a rep who then collapses it stays collapsed.
 */
function autoExpandFeesOnFirstCharge() {
    if (window._feesAutoExpandDone) return;
    const badge = document.getElementById('charges-badge');
    const content = document.getElementById('fees-charges-content');
    if (!badge || !content || badge.classList.contains('hidden')) return;
    window._feesAutoExpandDone = true;
    if (content.classList.contains('hidden')) toggleFeesCharges();
}

/**
 * Build the push-blockers list for the "Before you push" checklist (audit #8 checklist upgrade).
 * Returns [{ key, label, ok, focusId }] — one entry per push gate, each unmet ("blocker") entry
 * carrying the id of the field a click should focus. Shared by renderBuilderPushReadiness()
 * (SCP/DTF) and EMB's renderPushReadiness() so all 3 checklists behave identically.
 * @param {{hasCustomer:boolean, hasProducts:boolean, hasName:boolean, hasEmail:boolean}} r
 * @param {Object} [focus] — optional per-gate focus-target overrides
 */
function getPushBlockers(r, focus) {
    focus = focus || {};
    return [
        { key: 'customer', label: 'ShopWorks Customer #', ok: !!r.hasCustomer, focusId: focus.customer || 'customer-number' },
        { key: 'products', label: 'At least one item', ok: !!r.hasProducts, focusId: focus.products || 'product-search' },
        { key: 'name', label: 'Customer name', ok: !!r.hasName, focusId: focus.name || 'customer-name' },
        { key: 'email', label: 'Customer email', ok: !!r.hasEmail, focusId: focus.email || 'customer-email' },
    ];
}

/**
 * Focus + briefly highlight a push-blocker's field so the rep lands exactly where the
 * missing data goes. Scrolls the field into view; the outline flash self-clears.
 */
function focusPushBlockerField(focusId) {
    const target = focusId && document.getElementById(focusId);
    if (!target) return;
    // Guided mode: the field may live on ANOTHER step (display:none), where a bare
    // focus() is a silent no-op — navigate to its step first. guidedRevealField
    // returns false when guided is off/absent, and the classic scroll+focus below
    // then runs as before. (expert audit 2026-07-07)
    const revealed = (typeof window !== 'undefined' && typeof window.guidedRevealField === 'function')
        ? window.guidedRevealField(focusId)
        : false;
    if (!revealed) {
        try { target.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (_) { target.scrollIntoView(); }
        try { target.focus({ preventScroll: true }); } catch (_) { target.focus(); }
    }
    const prevOutline = target.style.outline;
    const prevOffset = target.style.outlineOffset;
    target.style.outline = '2px solid #f59e0b';
    target.style.outlineOffset = '2px';
    setTimeout(() => { target.style.outline = prevOutline; target.style.outlineOffset = prevOffset; }, 1600);
}

/**
 * Render the "Before you push" checklist into `el` from a blockers list (getPushBlockers()).
 * Unmet items render as CLICKABLE buttons — clicking focuses the field that clears the blocker
 * (delegated listener, wired once per element). Met items stay plain. Shared across EMB/SCP/DTF.
 */
function renderPushChecklist(el, blockers) {
    if (!el) return;
    const item = (b) => b.ok
        ? `<div class="pr-item pr-ok"><i class="fas fa-check-circle"></i>${b.label}</div>`
        : `<button type="button" class="pr-item pr-no" data-pr-focus="${escapeHtml(b.focusId)}"
             title="Click to jump to this field"
             style="background:none;border:none;font:inherit;color:inherit;cursor:pointer;width:100%;text-align:left;text-decoration:underline;text-decoration-style:dotted;text-underline-offset:2px;">
             <i class="fas fa-circle"></i>${b.label}</button>`;
    // Logo TBD = NON-blocking warning (2026-07-07): quoting on an assumption is
    // fine, but nobody should start a production order on art we've never seen
    // without a deliberate look at this line first.
    const tbdWarn = (typeof window !== 'undefined' && window._logoStatus === 'tbd')
        ? '<div class="pr-item pr-warn"><i class="fas fa-triangle-exclamation"></i> Artwork TBD — confirm the logo before pushing to production</div>'
        : '';
    // eslint-disable-next-line no-unsanitized/property -- audited (1.4): internal literal checklist labels only
    el.innerHTML = '<div class="pr-title">Before you push</div>' + blockers.map(item).join('') + tbdWarn;
    if (!el.dataset.prFocusWired) {
        el.dataset.prFocusWired = '1';
        el.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-pr-focus]');
            if (btn) focusPushBlockerField(btn.getAttribute('data-pr-focus'));
        });
    }
}

/**
 * Shared "Before you push" readiness checklist + Push-button gate for SCP/DTF — modeled on EMB's
 * getPushReadiness()/renderPushReadiness() (2026-06-14). The caller passes the push button id and a
 * hasProducts() check; this renders #push-readiness and enables/disables the button in lock-step.
 * Gates: ShopWorks Customer #, ≥1 item, customer name, customer email (mirrors the save validation).
 * Unmet checklist items are clickable → focus the field that clears the blocker (cfg.focus overrides
 * the per-gate target ids; default products target is #product-search).
 * Returns the 4 gate booleans so the caller can decide whether a click should proceed.
 */
function renderBuilderPushReadiness(cfg) {
    const btn = cfg && document.getElementById(cfg.btnId);
    const el = document.getElementById('push-readiness');
    // Already pushed this session — clear the checklist + leave the button in its "Sent ✓" locked state.
    // The push success path sets btn.dataset.pushed='1'; resetQuote()/New Quote clears it. (review fix 2026-06-14)
    if (btn && btn.dataset.pushed === '1') {
        if (el) el.innerHTML = '';
        return { hasCustomer: true, hasProducts: true, hasName: true, hasEmail: true };
    }
    const val = (id) => (document.getElementById(id)?.value || '').trim();
    let hasProducts = false;
    try { hasProducts = !!(cfg && typeof cfg.hasProducts === 'function' && cfg.hasProducts()); } catch (_) {}
    const r = { hasCustomer: !!val('customer-number'), hasProducts, hasName: !!val('customer-name'), hasEmail: !!val('customer-email') };
    if (el) {
        renderPushChecklist(el, getPushBlockers(r, cfg && cfg.focus));
    }
    if (btn) {
        const enabled = r.hasCustomer && r.hasProducts && r.hasName && r.hasEmail;
        btn.disabled = !enabled;
        btn.style.opacity = enabled ? '1' : '0.5';
        btn.style.cursor = enabled ? 'pointer' : 'not-allowed';
        btn.title = enabled
            ? 'Save + create this quote as a ShopWorks order (saves automatically)'
            : 'Complete the "Before you push" checklist (Customer #, a product, name + email) to enable push';
    }
    return r;
}
if (typeof window !== 'undefined') {
    window.renderBuilderPushReadiness = renderBuilderPushReadiness;
    window.getPushBlockers = getPushBlockers;
    window.renderPushChecklist = renderPushChecklist;
    window.focusPushBlockerField = focusPushBlockerField;
}

/**
 * Show/hide the loading overlay.
 * @param {boolean} show
 */
function showLoading(show) {
    const overlay = document.getElementById('loading-overlay');
    if (!overlay) return;
    if (show) {
        overlay.classList.add('show');
    } else {
        overlay.classList.remove('show');
    }
}

/**
 * Toggle Save & Share panel expand/collapse.
 */
function toggleSaveShare() {
    const content = document.getElementById('save-share-content');
    const chevron = document.getElementById('save-share-chevron');
    if (!content || !chevron) return;
    if (content.classList.contains('hidden')) {
        content.classList.remove('hidden');
        chevron.style.transform = 'rotate(180deg)';
    } else {
        content.classList.add('hidden');
        chevron.style.transform = 'rotate(0deg)';
    }
}

/**
 * Confirm starting a new quote (checks for unsaved changes).
 * Requires builder to define: hasUnsavedChanges(), resetQuote()
 */
function confirmNewQuote() {
    // Quoting happens in streaks: after Push/Email → New Quote, the guided shell
    // was left parked on "Review & send" with an EMPTY review — every call after
    // the first started one navigation behind. guidedGoToStep no-ops when the
    // shell is off or absent. (expert audit 2026-07-07)
    const _resetToFirstStep = () => { if (typeof window !== 'undefined' && typeof window.guidedGoToStep === 'function') window.guidedGoToStep(0); };
    if (typeof hasUnsavedChanges === 'function' && hasUnsavedChanges()) {
        if (confirm('You have unsaved changes. Start a new quote?')) {
            resetQuote();
            _resetToFirstStep();
        }
    } else {
        resetQuote();
        _resetToFirstStep();
    }
}

/**
 * Mark quote as having unsaved changes. Shows badge.
 * Requires `hasChanges` variable in builder scope.
 */
function markAsUnsaved() {
    hasChanges = true;
    const indicator = document.getElementById('unsaved-indicator');
    if (indicator) indicator.style.display = 'inline';
}

/**
 * Mark quote as saved. Hides badge.
 */
function markAsSaved() {
    hasChanges = false;
    const indicator = document.getElementById('unsaved-indicator');
    if (indicator) indicator.style.display = 'none';
}

/**
 * Check if there are unsaved changes.
 * @returns {boolean}
 */
function hasUnsavedChanges() {
    return hasChanges;
}

/**
 * Warn before leaving the page with unsaved changes (browser-native dialog).
 * Call once from builder init. The autosaved draft is best-effort recovery —
 * this gives the rep the chance to Save properly instead of silently losing
 * up to 30s of work to a back-button or Dashboard click. (2026-06-10)
 */
function setupBeforeUnloadGuard() {
    window.addEventListener('beforeunload', function (e) {
        try {
            if (typeof hasUnsavedChanges === 'function' && hasUnsavedChanges()) {
                e.preventDefault();
                e.returnValue = '';   // required by Chromium to show the dialog
            }
        } catch (_) { /* builder without hasChanges tracking — never block navigation */ }
    });
}
if (typeof window !== 'undefined') window.setupBeforeUnloadGuard = setupBeforeUnloadGuard;

/**
 * Setup global keyboard shortcuts (Ctrl+S save, Ctrl+P print, Escape close popups).
 * Requires builder to define: saveQuote(), printQuote(), closeExtendedSizePopup()
 */
function setupKeyboardShortcuts() {
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            const sizePopup = document.getElementById('extended-size-popup');
            if (sizePopup && !sizePopup.classList.contains('hidden')) {
                e.preventDefault();
                if (typeof closeExtendedSizePopup === 'function') closeExtendedSizePopup();
                return;
            }
        }
        if (e.ctrlKey && e.key === 's') {
            e.preventDefault();
            if (typeof saveQuote === 'function') saveQuote();
        }
        if (e.ctrlKey && e.key === 'p') {
            e.preventDefault();
            if (typeof printQuote === 'function') printQuote();
        }
    });
}

// ============================================
// ORDER, SHIPPING & TAX FIELDS
// ============================================

const US_STATES = 'AL,AK,AZ,AR,CA,CO,CT,DE,FL,GA,HI,ID,IL,IN,IA,KS,KY,LA,ME,MD,MA,MI,MN,MS,MO,MT,NE,NV,NH,NJ,NM,NY,NC,ND,OH,OK,OR,PA,RI,SC,SD,TN,TX,UT,VT,VA,WA,WV,WI,WY';

/**
 * Render order, shipping, and notes fields into a container.
 * @param {string} containerId - DOM id for the container div
 */
function renderOrderShippingFields(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const stateOptions = US_STATES.split(',').map(s =>
        `<option value="${s}"${s === 'WA' ? ' selected' : ''}>${s}</option>`
    ).join('');

    // eslint-disable-next-line no-unsanitized/property -- audited (1.4): US_STATES internal const only
    container.innerHTML = `
        <div class="order-shipping-panel">
            <div class="charges-header" onclick="toggleOrderShippingPanel('${containerId}')">
                <div class="d-flex align-items-center gap-2">
                    <i class="fas fa-truck"></i>
                    <span>Order & Shipping</span>
                    <span class="order-shipping-badge charges-badge hidden">!</span>
                </div>
                <i class="order-shipping-chevron fas fa-chevron-down collapsible-chevron"></i>
            </div>
            <div class="order-shipping-content charges-content hidden">
                <div class="d-flex flex-column gap-2" style="padding: 8px 0;">
                    <!-- Phone + Order # -->
                    <div class="d-flex gap-2">
                        <div class="customer-field" style="flex: 1;">
                            <label class="quote-label" style="font-size: 11px;">Phone</label>
                            <input type="tel" class="os-phone quote-input" placeholder="(253) 555-1234" style="font-size: 12px; padding: 6px 8px;">
                        </div>
                        <div class="customer-field" style="flex: 1;">
                            <label class="quote-label" style="font-size: 11px;">Order #</label>
                            <input type="text" class="os-order-number quote-input" placeholder="ShopWorks #" style="font-size: 12px; padding: 6px 8px;">
                        </div>
                    </div>
                    <!-- PO # + Shipping Fee -->
                    <div class="d-flex gap-2">
                        <div class="customer-field" style="flex: 1;">
                            <label class="quote-label" style="font-size: 11px;">PO #</label>
                            <input type="text" class="os-po-number quote-input" placeholder="Purchase Order" style="font-size: 12px; padding: 6px 8px;">
                        </div>
                        <div class="customer-field" style="flex: 1;">
                            <label class="quote-label" style="font-size: 11px;">Shipping Fee</label>
                            <div style="position: relative;">
                                <span style="position: absolute; left: 8px; top: 50%; transform: translateY(-50%); color: #666; font-size: 12px;">$</span>
                                <input type="number" class="os-shipping-fee quote-input" min="0" step="0.01" placeholder="0.00" value="0"
                                       style="font-size: 12px; padding: 6px 8px 6px 22px; width: 100%; box-sizing: border-box;">
                            </div>
                        </div>
                    </div>
                    <!-- Dates -->
                    <div class="d-flex gap-2">
                        <div class="customer-field" style="flex: 1;">
                            <label class="quote-label" style="font-size: 11px;">Ship Date</label>
                            <input type="date" class="os-req-ship-date quote-input" style="font-size: 12px; padding: 6px 8px;">
                        </div>
                        <div class="customer-field" style="flex: 1;">
                            <label class="quote-label" style="font-size: 11px;">Drop Dead Date</label>
                            <input type="date" class="os-drop-dead-date quote-input" style="font-size: 12px; padding: 6px 8px;">
                        </div>
                    </div>
                    <!-- Ship To Address -->
                    <div class="customer-field">
                        <label class="quote-label" style="font-size: 11px;">Ship To Address</label>
                        <input type="text" class="os-ship-address quote-input" placeholder="Street address" style="font-size: 12px; padding: 6px 8px;">
                    </div>
                    <div class="d-flex gap-2">
                        <div class="customer-field" style="flex: 2;">
                            <input type="text" class="os-ship-city quote-input" placeholder="City" style="font-size: 12px; padding: 6px 8px;">
                        </div>
                        <div class="customer-field" style="flex: 0 0 60px;">
                            <select class="os-ship-state quote-input" style="font-size: 12px; padding: 6px 4px;">
                                ${stateOptions}
                            </select>
                        </div>
                        <div class="customer-field" style="flex: 0 0 80px;">
                            <input type="text" class="os-ship-zip quote-input" placeholder="ZIP" maxlength="10"
                                   style="font-size: 12px; padding: 6px 8px;">
                        </div>
                        <button type="button" class="btn-tax-lookup" title="Look up tax rate">
                            <i class="fas fa-search"></i>
                        </button>
                    </div>
                    <div class="os-tax-status" style="font-size: 11px; color: #64748b; min-height: 14px;"></div>
                    <!-- Ship Method -->
                    <div class="customer-field">
                        <label class="quote-label" style="font-size: 11px;">Ship Method</label>
                        <select class="os-ship-method quote-input" style="font-size: 12px; padding: 6px 8px;">
                            <option value="">Select...</option>
                            <option value="Ground">Ground</option>
                            <option value="2-Day">2-Day</option>
                            <option value="Overnight">Overnight</option>
                            <option value="Customer Pickup">Customer Pickup</option>
                            <option value="Delivery">Local Delivery</option>
                        </select>
                    </div>
                    <!-- Notes -->
                    <div class="customer-field" style="margin-top: 4px;">
                        <label class="quote-label" style="font-size: 11px;"><i class="fas fa-sticky-note" style="color: #f9a825;"></i> Notes</label>
                        <textarea class="os-notes quote-input" placeholder="Special instructions, employee names, etc."
                                  style="font-size: 12px; padding: 6px 8px; min-height: 60px; resize: vertical; font-family: inherit;"></textarea>
                    </div>
                </div>
            </div>
        </div>
    `;
}

/**
 * Toggle the order/shipping panel visibility.
 */
function toggleOrderShippingPanel(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    const content = container.querySelector('.order-shipping-content');
    const chevron = container.querySelector('.order-shipping-chevron');
    if (content) content.classList.toggle('hidden');
    if (chevron) chevron.style.transform = content.classList.contains('hidden') ? '' : 'rotate(180deg)';
}

/**
 * Wire up event listeners for order/shipping fields.
 * @param {string} containerId
 * @param {object} options - { onShippingFeeChange, onTaxRateChange, apiBaseUrl }
 */
function initOrderShippingListeners(containerId, options = {}) {
    const container = document.getElementById(containerId);
    if (!container) return;
    if (container.dataset.osInitialized) return;
    container.dataset.osInitialized = 'true';

    const apiBase = options.apiBaseUrl || window.APP_CONFIG.API.BASE_URL;

    // State change → auto lookup or zero tax
    const stateSelect = container.querySelector('.os-ship-state');
    if (stateSelect) {
        stateSelect.addEventListener('change', () => {
            if (stateSelect.value !== 'WA') {
                if (options.onTaxRateChange) options.onTaxRateChange(0);
                _showTaxStatus(container, 'Out of State — No Tax', 'info');
            } else {
                const zip = container.querySelector('.os-ship-zip')?.value?.trim();
                if (zip && zip.length >= 5) {
                    _doTaxLookup(container, apiBase, options);
                } else {
                    if (options.onTaxRateChange) options.onTaxRateChange(10.2);
                    _showTaxStatus(container, '', '');
                }
            }
        });
    }

    // ZIP blur → auto lookup
    const zipInput = container.querySelector('.os-ship-zip');
    if (zipInput) {
        zipInput.addEventListener('blur', () => {
            const state = container.querySelector('.os-ship-state')?.value || 'WA';
            if (state === 'WA' && zipInput.value.trim().length >= 5) {
                _doTaxLookup(container, apiBase, options);
            }
        });
    }

    // Tax lookup button
    const lookupBtn = container.querySelector('.btn-tax-lookup');
    if (lookupBtn) {
        lookupBtn.addEventListener('click', () => _doTaxLookup(container, apiBase, options));
    }

    // Shipping fee change
    const shippingFee = container.querySelector('.os-shipping-fee');
    if (shippingFee) {
        shippingFee.addEventListener('change', () => {
            if (options.onShippingFeeChange) options.onShippingFeeChange(parseFloat(shippingFee.value) || 0);
        });
        shippingFee.addEventListener('input', () => {
            if (options.onShippingFeeChange) options.onShippingFeeChange(parseFloat(shippingFee.value) || 0);
        });
    }
}

/** Internal: perform ZIP-based tax lookup */
async function _doTaxLookup(container, apiBase, options) {
    const state = container.querySelector('.os-ship-state')?.value || 'WA';
    const zip = container.querySelector('.os-ship-zip')?.value?.trim() || '';
    const city = container.querySelector('.os-ship-city')?.value?.trim() || '';
    const address = container.querySelector('.os-ship-address')?.value?.trim() || '';

    if (state !== 'WA') {
        if (options.onTaxRateChange) options.onTaxRateChange(0);
        _showTaxStatus(container, 'Out of State — No Tax', 'info');
        return;
    }
    if (!zip || zip.length < 5) {
        _showTaxStatus(container, 'Enter ZIP code to look up rate', 'info');
        return;
    }

    try {
        _showTaxStatus(container, 'Looking up tax rate...', 'loading');
        const resp = await fetch(`${apiBase}/api/tax-rates/lookup`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ address, city, state, zip })
        });
        if (!resp.ok) throw new Error(`API returned ${resp.status}`);
        const data = await resp.json();

        if (!data.success) {
            _showTaxStatus(container, data.error || 'Lookup failed', 'error');
            return;
        }

        if (options.onTaxRateChange) options.onTaxRateChange(data.taxRate);

        if (data.outOfState) {
            _showTaxStatus(container, 'Out of State — No Tax', 'info');
        } else if (data.fallback) {
            _showTaxStatus(container, `Default rate ${data.taxRate}% (DOR unavailable)`, 'warning');
        } else {
            const loc = city || data.locationCode || 'WA';
            _showTaxStatus(container, `${loc} — ${data.taxRate}%`, 'success');
        }
    } catch (err) {
        _showTaxStatus(container, 'Lookup failed — using current rate', 'error');
    }
}

/** Internal: show tax lookup status message */
function _showTaxStatus(container, msg, type) {
    const el = container.querySelector('.os-tax-status');
    if (!el) return;
    el.textContent = msg;
    el.style.color = type === 'success' ? '#16a34a' : type === 'error' ? '#dc2626' : type === 'warning' ? '#d97706' : '#64748b';
}

/**
 * Read all order/shipping field values from the panel.
 * @param {string} containerId
 * @returns {object} Field values for saving
 */
function getOrderShippingData(containerId) {
    const c = document.getElementById(containerId);
    if (!c) return {};
    return {
        phone: c.querySelector('.os-phone')?.value?.trim() || '',
        orderNumber: c.querySelector('.os-order-number')?.value?.trim() || '',
        poNumber: c.querySelector('.os-po-number')?.value?.trim() || '',
        shippingFee: parseFloat(c.querySelector('.os-shipping-fee')?.value) || 0,
        reqShipDate: c.querySelector('.os-req-ship-date')?.value || '',
        dropDeadDate: c.querySelector('.os-drop-dead-date')?.value || '',
        shipAddress: c.querySelector('.os-ship-address')?.value?.trim() || '',
        shipCity: c.querySelector('.os-ship-city')?.value?.trim() || '',
        shipState: c.querySelector('.os-ship-state')?.value || 'WA',
        shipZip: c.querySelector('.os-ship-zip')?.value?.trim() || '',
        shipMethod: c.querySelector('.os-ship-method')?.value || '',
        notes: c.querySelector('.os-notes')?.value?.trim() || ''
    };
}

/**
 * Restore order/shipping field values (e.g., from a saved quote).
 * @param {string} containerId
 * @param {object} data - Field values to restore
 */
function setOrderShippingData(containerId, data) {
    const c = document.getElementById(containerId);
    if (!c || !data) return;
    const set = (sel, val) => { const el = c.querySelector(sel); if (el && val) el.value = val; };
    set('.os-phone', data.phone || data.Phone);
    set('.os-order-number', data.orderNumber || data.OrderNumber);
    set('.os-po-number', data.poNumber || data.PurchaseOrderNumber);
    set('.os-shipping-fee', data.shippingFee || data.ShippingFee);
    set('.os-req-ship-date', data.reqShipDate || data.ReqShipDate);
    set('.os-drop-dead-date', data.dropDeadDate || data.DropDeadDate);
    set('.os-ship-address', data.shipAddress || data.ShipToAddress);
    set('.os-ship-city', data.shipCity || data.ShipToCity);
    set('.os-ship-state', data.shipState || data.ShipToState);
    set('.os-ship-zip', data.shipZip || data.ShipToZip);
    set('.os-ship-method', data.shipMethod || data.ShipMethod);
    set('.os-notes', data.notes || data.Notes);
}

// ============================================
// PER-UNIT PRICE DISPLAY
// ============================================

/**
 * Update the per-unit price display in Quote Summary.
 * Shows "$X.XX/piece" when there are products, hides when empty.
 * Call this from recalculatePricing() or updatePricing() in each builder.
 * @param {number} productsSubtotal - The products-only subtotal (before fees/tax)
 * @param {number} totalPieces - Total quantity of all products
 */
function updatePerUnitPrice(productsSubtotal, totalPieces) {
    const row = document.getElementById('per-unit-price-row');
    const valueEl = document.getElementById('per-unit-price');
    if (!row || !valueEl) return;

    if (totalPieces > 0 && productsSubtotal > 0) {
        const perUnit = productsSubtotal / totalPieces;
        valueEl.textContent = '$' + perUnit.toFixed(2) + '/piece';
        row.style.display = '';
    } else {
        row.style.display = 'none';
    }
}

// ============================================
// EMAIL QUOTE
// ============================================

/**
 * Shared email format check (expert audit 2026-07-07). EMB/DTF validated at save
 * while SCP presence-checked only, and emailQuote() accepted any shape — EmailJS
 * "sends" to malformed addresses without error, so a typo surfaced days later as
 * a customer "I never got it" call. One regex, every surface (Rule 8).
 */
function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim());
}

/**
 * Send a quote email to the customer via EmailJS.
 * @param {object} options - { quoteId, customerEmail, customerName, salesRepEmail, quoteUrl }
 */
async function emailQuote(options = {}) {
    if (!options.customerEmail) {
        showToast('Please enter customer email before sending', 'error');
        return false;
    }
    if (!isValidEmail(options.customerEmail)) {
        showToast('Customer email looks invalid — please correct it before sending', 'error');
        return false;
    }
    if (!options.quoteId) {
        showToast('Please save the quote first', 'error');
        return false;
    }

    const siteOrigin = (typeof APP_CONFIG !== 'undefined' && APP_CONFIG.SITE_ORIGIN) || 'https://www.teamnwca.com';
    const quoteUrl = options.quoteUrl || `${siteOrigin}/quote/${options.quoteId}`;

    try {
        showToast('Sending email...', 'info');
        await emailjs.send(window.APP_CONFIG.EMAIL.SERVICE_ID, window.APP_CONFIG.EMAIL.TEMPLATES.QUOTE_SHARE, {
            to_email: options.customerEmail,
            customer_name: options.customerName || 'Customer',
            quote_id: options.quoteId,
            quote_link: quoteUrl,
            reply_to: options.salesRepEmail || 'sales@nwcustomapparel.com',
            company_name: 'Northwest Custom Apparel',
            company_phone: '253-922-5793'
        });
        showToast('Quote emailed to ' + options.customerEmail, 'success');
        return true;
    } catch (err) {
        console.error('[EmailQuote] Error:', err);
        showToast('Failed to send email. Please try again.', 'error');
        return false;
    }
}

// ============================================================
// QUANTITY BREAK NUDGE
// ============================================================

/**
 * Show a nudge message when the customer is close to the next pricing tier.
 * Call this from each builder's pricing update function after calculating total quantity.
 *
 * @param {number} totalQty - Current total pieces
 * @param {string} method - 'dtg' | 'dtf' | 'scp' | 'emb'
 * @param {number|null} [savingsPerPiece=null] - Per-piece savings at next tier (optional)
 * @param {string} [containerId='quantity-nudge'] - ID of the nudge container div
 */
function updateQuantityNudge(totalQty, method, savingsPerPiece = null, containerId = 'quantity-nudge', categoryLabel = '') {
    const container = document.getElementById(containerId);
    if (!container) return;

    // Tier breakpoints per method (lower bound of each tier)
    const tiers = {
        dtg: [12, 24, 48, 72],
        dtf: [10, 24, 48, 72],
        scp: [24, 48, 72, 145], // 2026-06-19 remap: min 24 + DTG-aligned breaks (was [24,37,73,145])
        emb: [8, 24, 48, 72]
    };

    const breaks = tiers[method];
    if (!breaks || totalQty <= 0) {
        container.style.display = 'none';
        return;
    }

    // Find the next tier the customer hasn't reached yet
    let nextBreak = null;
    for (const b of breaks) {
        if (totalQty < b) {
            nextBreak = b;
            break;
        }
    }

    if (!nextBreak) {
        // Already at highest tier
        container.style.display = 'none';
        return;
    }

    const needed = nextBreak - totalQty;
    const threshold = Math.ceil(nextBreak * 0.30); // Show nudge when within 30% of next tier

    if (needed <= threshold && needed > 0) {
        // Find the tier label (e.g., "24-47")
        const breakIndex = breaks.indexOf(nextBreak);
        const tierEnd = breakIndex < breaks.length - 1 ? breaks[breakIndex + 1] - 1 : '+';
        const tierLabel = tierEnd === '+' ? `${nextBreak}+` : `${nextBreak}-${tierEnd}`;

        // categoryLabel (e.g. "garment") matters when categories tier separately
        // (EMB: caps + garments) — a bare "pieces" implied adding ANY product moves
        // the tier, which is false for mixed orders.
        const pieceWord = categoryLabel ? `${categoryLabel} piece` : 'piece';
        let html = `<i class="fas fa-arrow-up" style="margin-right: 4px;"></i>Add <strong>${needed}</strong> more ${pieceWord}${needed === 1 ? '' : 's'} to reach <strong>${tierLabel}</strong> tier pricing`;
        if (savingsPerPiece && savingsPerPiece > 0.01) {
            html += ` — <strong style="color: #15803d;">save ~$${savingsPerPiece.toFixed(2)}/piece</strong>`;
        }
        // Clickable nudge (2026-07-06, UX audit P1 #3): one click adds the missing
        // pieces, scaled proportionally across the sizes already entered.
        html += ` <span class="nudge-apply-hint">· click to add</span>`;
        // eslint-disable-next-line no-unsanitized/property -- audited (1.4): numeric counts + internal tier label/piece word only
        container.innerHTML = html;
        container.style.display = 'block';
        container.classList.add('quantity-nudge-clickable');
        container.setAttribute('role', 'button');
        container.setAttribute('tabindex', '0');
        container.title = `Add ${needed} ${pieceWord}${needed === 1 ? '' : 's'}, spread proportionally across the sizes you've entered`;
        container.dataset.nudgeNeeded = String(needed);
        container.dataset.nudgeCategory = categoryLabel || '';
        container.onclick = () => {
            const n = parseInt(container.dataset.nudgeNeeded, 10) || 0;
            if (applyQuantityNudge(n, container.dataset.nudgeCategory || '')) {
                // Hide immediately so a double-click can't add twice with a stale
                // "needed" — the recalc the change events trigger re-renders it.
                container.style.display = 'none';
            }
        };
        container.onkeydown = (e) => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); container.onclick(); }
        };
    } else {
        container.style.display = 'none';
    }
}

/**
 * Split `delta` pieces across current quantities proportionally (largest-
 * remainder method, so the additions sum to EXACTLY delta and bigger sizes
 * absorb more). Pure — locked by tests/unit/distribute-proportionally.test.js.
 * quantities: array of current per-cell qtys (>0); returns array of additions.
 */
function distributeProportionally(quantities, delta) {
    const adds = quantities.map(() => 0);
    const total = quantities.reduce((s, q) => s + (q > 0 ? q : 0), 0);
    if (!(total > 0) || !(delta > 0)) return adds;
    const raw = quantities.map(q => (q > 0 ? (delta * q) / total : 0));
    let left = delta;
    raw.forEach((r, i) => { adds[i] = Math.floor(r); left -= adds[i]; });
    // Hand the remaining pieces to the largest fractional remainders (stable
    // index tie-break so the result is deterministic).
    const order = raw.map((r, i) => [r - Math.floor(r), i])
        .sort((a, b) => b[0] - a[0] || a[1] - b[1]);
    for (const [, i] of order) {
        if (left <= 0) break;
        if (quantities[i] > 0) { adds[i]++; left--; }
    }
    return adds;
}

/**
 * Apply a clicked quantity nudge: bump the trio's entered size cells by
 * `needed` pieces, proportional to what's already typed, firing each cell's
 * 'change' event so the builder's own onSizeChange/pricing runs as if typed
 * (same proven mechanism as bulk size paste above). categoryLabel filters
 * rows for EMB's separately-tiered mixed orders ('garment'/'cap' per
 * row.dataset.isCap); child rows are single-size line items and are skipped.
 */
function applyQuantityNudge(needed, categoryLabel, tbodyId) {
    const tbody = document.getElementById(tbodyId || 'product-tbody');
    if (!tbody || !(needed > 0)) return false;
    const cells = [];
    tbody.querySelectorAll('tr').forEach(row => {
        if (row.classList.contains('child-row')) return;
        if (categoryLabel === 'garment' && row.dataset.isCap === 'true') return;
        if (categoryLabel === 'cap' && row.dataset.isCap !== 'true') return;
        row.querySelectorAll('input.size-input[data-size]:not([readonly])').forEach(inp => {
            if (inp.disabled) return;
            const q = parseInt(inp.value, 10) || 0;
            if (q > 0) cells.push({ inp, q });
        });
    });
    if (!cells.length) {
        if (typeof showToast === 'function') showToast('Type at least one size quantity first — the nudge scales what you already entered.', 'info');
        return false;
    }
    const adds = distributeProportionally(cells.map(c => c.q), needed);
    let applied = 0;
    cells.forEach((c, i) => {
        if (adds[i] > 0) {
            c.inp.value = String(c.q + adds[i]);
            applied += adds[i];
            c.inp.dispatchEvent(new Event('change', { bubbles: true }));
        }
    });
    if (applied > 0 && typeof showToast === 'function') {
        showToast(`Added ${applied} ${categoryLabel ? categoryLabel + ' ' : ''}piece${applied === 1 ? '' : 's'} across your entered sizes.`, 'success');
    }
    return applied > 0;
}

// ============================================================
// Quick Quote → builder handoff (item #6, 2026-07-05)
// ============================================================
/**
 * Parse the Quick Quote "Open in quote builder" URL params (shared by all 4 builders).
 *
 * PARAM SCHEMA (?from=quickquote — written by calculators/quick-quote/quick-quote.js):
 *   from=quickquote        sentinel — prefill only runs when present
 *   style=PC54             style number
 *   color=BrillOrng        CATALOG_COLOR (API/ShopWorks-safe code — matches the row pickers'
 *                          data-catalog-color / data-color attributes)
 *   colorName=Brilliant%20Orange  COLOR_NAME (display name; DTG fuzzy-matches on it)
 *   qty=24                 total quantity (informational — sizes below is authoritative)
 *   sizes=S:10,M:14        per-size breakdown as size:qty CSV — EXACTLY what Quick Quote
 *                          priced (single-qty mode sends the standard size, e.g. S:24)
 *   location=LC_FB         DTG ONLY — engine print-location code (front[_back])
 *
 * Method-specific config that is NOT transferred (rep re-enters in the builder):
 * stitch counts / additional logos (EMB), ink colors + dark garment (SCP), transfer
 * locations (DTF). Prefill flows through each builder's EXISTING add-product path,
 * so pricing always comes from the same engine/services — never from these params.
 *
 * @returns {null | {style:string, color:string, colorName:string, qty:number,
 *                   sizeBreakdown:Object<string,number>, location:string}}
 */
function getQuickQuotePrefill() {
    let params;
    try { params = new URLSearchParams(window.location.search); } catch (_) { return null; }
    if (params.get('from') !== 'quickquote') return null;
    const style = (params.get('style') || '').trim().toUpperCase();
    if (!style) return null;
    const qty = Math.max(0, parseInt(params.get('qty'), 10) || 0);
    const sizeBreakdown = {};
    (params.get('sizes') || '').split(',').forEach((pair) => {
        if (!pair) return;
        const i = pair.lastIndexOf(':');
        const size = i > 0 ? pair.slice(0, i).trim() : '';
        const q = i > 0 ? parseInt(pair.slice(i + 1), 10) : NaN;
        if (size && q > 0) { sizeBreakdown[size] = (sizeBreakdown[size] || 0) + q; }
        else { console.warn('[QuickQuote] dropped malformed size pair (verify the builder qty):', pair); }
    });
    return {
        style,
        color: (params.get('color') || '').trim(),
        colorName: (params.get('colorName') || '').trim(),
        qty,
        sizeBreakdown,
        location: (params.get('location') || '').trim().toUpperCase(),
    };
}

/**
 * Strip the Quick Quote handoff params after a successful prefill so a page refresh
 * doesn't re-add the product (same pattern the builders use for ?edit=/?duplicate=).
 */
function clearQuickQuoteParams() {
    try {
        if (window.location.search.includes('from=quickquote')) {
            history.replaceState(null, '', window.location.pathname);
        }
    } catch (_) { /* history unavailable — harmless */ }
}

// ============================================================
// Mid-call METHOD SWITCH (expert audit 2026-07-07)
// ============================================================
// "Actually, at 36 pieces screen print is cheaper" used to mean re-typing the
// customer AND every product row into the other builder while the customer
// waited — reps avoided the correct method to avoid the re-entry. The switch
// serializes IDENTITY only (customer fields + style/color/size rows) through
// sessionStorage and replays it through each builder's EXISTING
// applyQuickQuotePrefill add-product path, so pricing always comes from the
// target's own engine/services (same guarantee as the Quick Quote handoff).
// Decoration config (stitches / ink colors / transfer locations) is method-
// specific and intentionally re-entered. DTG is a TARGET via the existing
// single-product Quick Quote URL schema (its own architecture; first product
// only, no customer fields — the menu says so).

const METHOD_SWITCH_KEY = 'nwca-method-switch';
const METHOD_SWITCH_TARGETS = {
    emb: { label: 'Embroidery', url: '/quote-builders/embroidery-quote-builder.html' },
    scp: { label: 'Screen Print', url: '/quote-builders/screenprint-quote-builder.html' },
    dtf: { label: 'DTF Transfers', url: '/quote-builders/dtf-quote-builder.html' },
    dtg: { label: 'DTG (1st product only)', url: '/quote-builders/dtg-quote-builder.html' }
};

/**
 * Render the compact "Switch method" menu into the builder header.
 * @param {Object} cfg
 *   current — 'emb' | 'scp' | 'dtf' (source method; excluded from the menu)
 *   collect — () => [{style, color, colorName, sizeBreakdown}] parent-row snapshot
 */
function initMethodSwitchMenu(cfg) {
    if (!cfg || !cfg.current || typeof cfg.collect !== 'function') return;
    const host = document.querySelector('.power-header');
    if (!host || document.getElementById('method-switch-menu')) return;

    const wrap = document.createElement('label');
    wrap.id = 'method-switch-menu';
    wrap.className = 'method-switch';
    wrap.title = 'Carry the customer + products into another quote builder (decoration details are re-entered there)';
    const options = Object.entries(METHOD_SWITCH_TARGETS)
        .filter(([key]) => key !== cfg.current)
        .map(([key, t]) => `<option value="${key}">${t.label}</option>`)
        .join('');
    // eslint-disable-next-line no-unsanitized/property -- audited (1.4): METHOD_SWITCH_TARGETS internal const labels only
    wrap.innerHTML = '<i class="fas fa-exchange-alt" aria-hidden="true"></i> Switch method' +
        `<select aria-label="Switch to another quote builder"><option value="">…</option>${options}</select>`;
    host.appendChild(wrap);

    wrap.querySelector('select').addEventListener('change', (e) => {
        const key = e.target.value;
        const target = METHOD_SWITCH_TARGETS[key];
        e.target.value = '';
        if (!target) return;
        let products = [];
        try { products = cfg.collect() || []; } catch (err) { console.warn('[MethodSwitch] collect failed', err); }
        const customer = {
            name: document.getElementById('customer-name')?.value?.trim() || '',
            email: document.getElementById('customer-email')?.value?.trim() || '',
            company: document.getElementById('company-name')?.value?.trim() || '',
            customerNumber: document.getElementById('customer-number')?.value?.trim() || '',
            phone: document.getElementById('customer-phone')?.value?.trim() || ''
        };
        if (key === 'dtg') {
            // DTG: reuse the proven single-product Quick Quote URL schema untouched
            const p = products[0];
            const params = new URLSearchParams({ from: 'quickquote' });
            if (p) {
                params.set('style', p.style || '');
                params.set('color', p.color || '');
                params.set('colorName', p.colorName || '');
                const sizes = Object.entries(p.sizeBreakdown || {}).map(([s, q]) => `${s}:${q}`).join(',');
                if (sizes) params.set('sizes', sizes);
                params.set('qty', String(Object.values(p.sizeBreakdown || {}).reduce((a, b) => a + (b || 0), 0)));
            }
            if (products.length > 1 && typeof showToast === 'function') {
                showToast('DTG handoff carries the FIRST product only — add the rest there.', 'info', 5000);
            }
            window.location.href = target.url + '?' + params.toString();
            return;
        }
        try {
            sessionStorage.setItem(METHOD_SWITCH_KEY, JSON.stringify({
                from: cfg.current,
                fromLabel: (METHOD_SWITCH_TARGETS[cfg.current] || {}).label || cfg.current,
                customer,
                products
            }));
        } catch (err) {
            console.error('[MethodSwitch] sessionStorage failed', err);
            if (typeof showToast === 'function') showToast('Could not carry the quote over — open the other builder manually.', 'error');
            return;
        }
        window.location.href = target.url + '?from=methodswitch';
    });
}

// Cross-tab handoffs (e.g. the Leads workspace opening a builder in a NEW tab
// with `noopener`) CANNOT use sessionStorage — a noopener tab starts a fresh
// browsing context with an EMPTY sessionStorage, so the same-tab "Switch method"
// menu's stash never arrives (this is exactly why the lead → builder prefill
// silently did nothing). Cross-tab callers stash into localStorage (shared
// across tabs) via stashMethodSwitchPrefill(); the reader drains sessionStorage
// first (same-tab switch) then localStorage (cross-tab), clearing both.
const METHOD_SWITCH_TTL_MS = 5 * 60 * 1000; // localStorage stash self-expires

/**
 * Stash a switch/prefill payload for a builder opened in ANOTHER tab. Stamps a
 * `ts` so a stash abandoned before the builder loads can't prefill a later,
 * unrelated open (the reader TTL-checks it).
 * @returns {boolean} true if the stash was written
 */
function stashMethodSwitchPrefill(payload) {
    try {
        localStorage.setItem(METHOD_SWITCH_KEY, JSON.stringify(
            Object.assign({ ts: Date.now() }, payload)));
        return true;
    } catch (err) {
        console.error('[MethodSwitch] localStorage stash failed', err);
        return false;
    }
}

/**
 * One-shot reader for the switch payload — only fires on ?from=methodswitch,
 * and always clears BOTH stores so a refresh can't double-add products and a
 * cross-tab stash can't linger.
 * @returns {null | {from, fromLabel, customer, products:[]}}
 */
function takeMethodSwitchPrefill() {
    try {
        if (!window.location.search.includes('from=methodswitch')) return null;
        let raw = sessionStorage.getItem(METHOD_SWITCH_KEY);
        sessionStorage.removeItem(METHOD_SWITCH_KEY);
        let fromLocal = false;
        if (!raw) { raw = localStorage.getItem(METHOD_SWITCH_KEY); fromLocal = true; }
        try { localStorage.removeItem(METHOD_SWITCH_KEY); } catch (_) { /* ignore */ }
        const p = JSON.parse(raw || 'null');
        if (!p || !Array.isArray(p.products)) return null;
        // A cross-tab (localStorage) stash older than the TTL is stale — ignore it.
        if (fromLocal && typeof p.ts === 'number' && Date.now() - p.ts > METHOD_SWITCH_TTL_MS) return null;
        return p;
    } catch (_) { return null; }
}

/**
 * Fill the shared customer fields from a switch payload (all builders use the
 * same ids) + reveal the manual panel + refresh recap/push state.
 */
function applyMethodSwitchCustomer(cust) {
    if (!cust) return;
    const set = (id, val) => {
        const el = document.getElementById(id);
        if (el && val) {
            el.value = val;
            el.dispatchEvent(new Event('input', { bubbles: true }));
        }
    };
    set('customer-name', cust.name);
    set('customer-email', cust.email);
    set('company-name', cust.company);
    set('customer-number', cust.customerNumber);
    set('customer-phone', cust.phone);
    if (typeof syncCustomerManualDetails === 'function') syncCustomerManualDetails();
    if (typeof window.renderOrderRecap === 'function') { try { window.renderOrderRecap(); } catch (_) { } }
}

if (typeof window !== 'undefined') {
    window.initMethodSwitchMenu = initMethodSwitchMenu;
    window.stashMethodSwitchPrefill = stashMethodSwitchPrefill;
    window.takeMethodSwitchPrefill = takeMethodSwitchPrefill;
    window.applyMethodSwitchCustomer = applyMethodSwitchCustomer;
}

// ============================================================
// In-flight reprice indicator (old-audit price-display #5, 2026-07-07)
// ============================================================
// During a slow /api/pricing-bundle refresh the table shows the PREVIOUS
// prices with no cue — a rep can read a stale number aloud. Saves were always
// safe (they re-run the recalc); this is purely the on-screen honesty pill.
// 300ms show-delay so fast recalcs never flicker; depth-counted so overlapping
// recalcs keep it up until the LAST one settles. Builders wrap their recalc
// entry points with wrapWithRepricingIndicator() at file end.

function setRepricingIndicator(on) {
    if (on) {
        if (window._repriceShowTimer || document.getElementById('repricing-indicator')) return;
        window._repriceShowTimer = setTimeout(() => {
            window._repriceShowTimer = null;
            if (document.getElementById('repricing-indicator')) return;
            const el = document.createElement('div');
            el.id = 'repricing-indicator';
            el.className = 'repricing-indicator';
            el.setAttribute('role', 'status');
            el.innerHTML = '<i class="fas fa-circle-notch fa-spin" aria-hidden="true"></i> Updating prices…';
            document.body.appendChild(el);
        }, 300);
    } else {
        if (window._repriceShowTimer) { clearTimeout(window._repriceShowTimer); window._repriceShowTimer = null; }
        const _pill = document.getElementById('repricing-indicator');
        if (_pill) {
            _pill.remove();
            // pill only appears for >300ms reprices — announce completion (1.8)
            if (typeof announce === 'function') announce('Prices updated');
        }
    }
}

/**
 * Wrap an async recalc function so the indicator shows while ANY call is in
 * flight (depth counter handles the overlapping-recalc case the EMB stale-seq
 * guard exists for). Returns the wrapped function.
 */
function wrapWithRepricingIndicator(fn) {
    return async function () {
        window._repriceDepth = (window._repriceDepth || 0) + 1;
        setRepricingIndicator(true);
        try {
            return await fn.apply(this, arguments);
        } finally {
            window._repriceDepth = Math.max(0, (window._repriceDepth || 1) - 1);
            if (window._repriceDepth === 0) setRepricingIndicator(false);
        }
    };
}

if (typeof window !== 'undefined') {
    window.setRepricingIndicator = setRepricingIndicator;
    window.wrapWithRepricingIndicator = wrapWithRepricingIndicator;
}

// ============================================
// A11Y: LIVE REGION + ACCESSIBLE MODALS (roadmap 1.8 stage 2)
// ============================================
// One polite live region per page; announce() routes dynamic updates
// (reprices, saves, copies) to screen readers without stealing focus.
function ensureLiveRegion() {
    let el = document.getElementById('qb-live');
    if (!el) {
        el = document.createElement('div');
        el.id = 'qb-live';
        el.className = 'sr-only';
        el.setAttribute('role', 'status');
        el.setAttribute('aria-live', 'polite');
        el.setAttribute('aria-atomic', 'true');
        document.body.appendChild(el);
    }
    return el;
}
function announce(message) {
    try {
        const el = ensureLiveRegion();
        el.textContent = '';
        setTimeout(() => { el.textContent = String(message); }, 30);
    } catch (_) { /* never load-bearing */ }
}

/**
 * openAccessibleModal(el, {label, onEsc}) — the ONE dialog behavior for all
 * builder modals: role/aria-modal, focus moves in (first focusable or
 * [data-autofocus]), Tab/Shift+Tab trapped, Esc calls onEsc (default: the
 * paired close), and closeAccessibleModal() restores focus to the opener.
 * Purely additive on top of each modal's existing show/hide code.
 */
function openAccessibleModal(el, opts) {
    if (!el || el._qbModalOpen) return;
    opts = opts || {};
    el._qbModalOpen = true;
    el._qbPrevFocus = document.activeElement;
    if (!el.getAttribute('role')) el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    if (opts.label && !el.getAttribute('aria-label') && !el.getAttribute('aria-labelledby')) {
        el.setAttribute('aria-label', opts.label);
    }
    const focusables = () => el.querySelectorAll(
        'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    el._qbKeydown = (e) => {
        if (e.key === 'Escape') {
            e.stopPropagation();
            if (typeof opts.onEsc === 'function') opts.onEsc();
            else closeAccessibleModal(el);
            return;
        }
        if (e.key !== 'Tab') return;
        const f = Array.prototype.filter.call(focusables(), (x) => x.offsetParent !== null || x === document.activeElement);
        if (!f.length) return;
        const first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    el.addEventListener('keydown', el._qbKeydown);
    const target = el.querySelector('[data-autofocus]') || focusables()[0] || el;
    if (target === el && !el.hasAttribute('tabindex')) el.setAttribute('tabindex', '-1');
    setTimeout(() => { try { target.focus(); } catch (_) {} }, 0);
}
function closeAccessibleModal(el) {
    if (!el || !el._qbModalOpen) return;
    el._qbModalOpen = false;
    if (el._qbKeydown) el.removeEventListener('keydown', el._qbKeydown);
    const prev = el._qbPrevFocus;
    el._qbPrevFocus = null;
    if (prev && typeof prev.focus === 'function' && document.contains(prev)) {
        setTimeout(() => { try { prev.focus(); } catch (_) {} }, 0);
    }
}
if (typeof window !== 'undefined') {
    window.announce = announce;
    window.openAccessibleModal = openAccessibleModal;
    window.closeAccessibleModal = closeAccessibleModal;
}

/**
 * Live rush rate for the SCP/DTF "auto %" chips (2026-07-07) — identical logic
 * to EMB's getRushRate(): Caspio Service_Codes RUSH carries the percent in
 * UnitCost (SellPrice is 0 for CALCULATED codes, so getServicePrice() can't be
 * reused). Falls back to 25% with a ONE-TIME visible warning (Erik's #1 rule).
 */
let _sharedRushWarned = false;
function getSharedRushRate() {
    const sc = window._serviceCodes && window._serviceCodes['RUSH'];
    const pct = sc ? parseFloat(sc.UnitCost) : NaN;
    if (!isNaN(pct) && pct > 0) return pct / 100;
    if (!_sharedRushWarned) {
        _sharedRushWarned = true;
        if (typeof showToast === 'function') showToast('Using default 25% rush — live rate not loaded from the pricing service', 'warning', 5000);
    }
    return 0.25;
}
if (typeof window !== 'undefined') window.getSharedRushRate = getSharedRushRate;

/**
 * "Save as PDF" (Erik 2026-07-07): reps asked for a plain PDF download of the
 * quote. The browser's print dialog IS the PDF engine (destination "Save as
 * PDF" — no extra library, identical output to Print, and Chrome remembers the
 * last destination so it's one click after the first use). This button exists
 * for DISCOVERABILITY: same shared invoice window as Print, plus a toast that
 * says which destination to pick. All three builders expose a global
 * printQuote() (DTF's page wrapper included).
 */
function saveQuotePdf() {
    if (typeof showToast === 'function') {
        showToast("In the print window, set the destination/printer to 'Save as PDF' — that downloads the quote as a PDF file.", 'info', 8000);
    }
    if (typeof window.printQuote === 'function') {
        window.printQuote();
    }
}
if (typeof window !== 'undefined') window.saveQuotePdf = saveQuotePdf;

// ============================================================
// Logo status — On file / New / TBD (Erik 2026-07-07)
// ============================================================
// Three real-world logo states a quote starts from: (1) design on file →
// design-# lookup; (2) new logo → upload + (EMB) auto new-logo setup; (3) TBD —
// the customer wants a number before we've seen the art. The expert rule for
// TBD: you can quote without art, but NEVER without a stated assumption. The
// assumption is written as an "ARTWORK TBD:" line into the builder's notes
// field, which already saves, prints on the PDF, rides the email, and restores
// on edit-load — zero schema changes. The push checklist adds a NON-blocking
// warning while TBD is active. Chips start neutral (no behavior change until a
// rep opts in); clicking the active chip again returns to neutral.

const LOGO_TBD_MARKER = 'ARTWORK TBD:';

function initLogoStatusChips(cfg) {
    const mountHost = document.querySelector(cfg.mountSel);
    if (!mountHost || document.getElementById('logo-status-chips')) return;

    const wrap = document.createElement('div');
    wrap.id = 'logo-status-chips';
    wrap.className = 'logo-status-chips';
    wrap.innerHTML =
        '<div class="lsc-row">' +
        '  <span class="lsc-label"><i class="fas fa-shapes" aria-hidden="true"></i> Logo</span>' +
        '  <div class="lsc-group" role="group" aria-label="Logo status">' +
        '    <button type="button" class="lsc-chip" data-status="onfile" title="We already have this design — link it by design #"><i class="fas fa-folder-open"></i> On file</button>' +
        '    <button type="button" class="lsc-chip" data-status="new" title="New logo — attach the customer&#39;s art file"><i class="fas fa-upload"></i> New — upload</button>' +
        '    <button type="button" class="lsc-chip" data-status="tbd" title="Haven&#39;t seen the logo yet — quote on a stated assumption"><i class="fas fa-circle-question"></i> TBD — quote first</button>' +
        '  </div>' +
        '</div>' +
        '<div class="lsc-assumption" id="logo-assumption-panel" style="display:none;"></div>';
    mountHost.insertAdjacentElement('afterbegin', wrap);

    const notesEl = () => document.querySelector(cfg.notesSel);
    const artworkMount = () => (cfg.artworkMountSel ? document.querySelector(cfg.artworkMountSel) : null);
    const designGroup = () => {
        if (!cfg.designFocusId) return null;
        const d = document.getElementById(cfg.designFocusId);
        return d ? (d.closest('.design-number-input-group') || null) : null;
    };

    function writeNotesLine(text) {
        const n = notesEl();
        if (!n) return;
        stripNotesLine();
        const line = LOGO_TBD_MARKER + ' ' + text;
        n.value = n.value.trim() ? (n.value.replace(/\s+$/, '') + '\n' + line) : line;
        n.dispatchEvent(new Event('input', { bubbles: true }));
    }
    function stripNotesLine() {
        const n = notesEl();
        if (!n || !n.value.includes(LOGO_TBD_MARKER)) return;
        n.value = n.value.split(/\r?\n/).filter(l => !l.trim().startsWith(LOGO_TBD_MARKER)).join('\n').replace(/\s+$/, '');
        n.dispatchEvent(new Event('input', { bubbles: true }));
    }
    function savedNotesLineText() {
        const n = notesEl();
        const line = n && n.value.split(/\r?\n/).find(l => l.trim().startsWith(LOGO_TBD_MARKER));
        return line ? line.trim().slice(LOGO_TBD_MARKER.length).trim() : null;
    }

    function renderPanel(text) {
        const panel = document.getElementById('logo-assumption-panel');
        panel.innerHTML =
            '<i class="fas fa-triangle-exclamation" aria-hidden="true"></i> ' +
            '<span><strong>Quoting before artwork.</strong> <span class="lsc-a-text"></span> ' +
            'This line prints on the quote and rides the email.</span> ' +
            '<button type="button" class="lsc-refresh" title="Rebuild the assumption from the selections currently on screen">Update from current selections</button>';
        panel.querySelector('.lsc-a-text').textContent = text;
        panel.querySelector('.lsc-refresh').onclick = () => {
            const fresh = cfg.assumption();
            writeNotesLine(fresh);
            panel.querySelector('.lsc-a-text').textContent = fresh;
            if (typeof showToast === 'function') showToast('Assumption updated on the quote notes.', 'success', 2500);
        };
        panel.style.display = '';
    }

    function setStatus(status, opts) {
        opts = opts || {};
        window._logoStatus = status;
        wrap.querySelectorAll('.lsc-chip').forEach(b => b.classList.toggle('active', b.dataset.status === status));
        const art = artworkMount();
        const dg = designGroup();
        const panel = document.getElementById('logo-assumption-panel');

        if (status === null) {
            if (art) art.style.display = '';
            if (dg) dg.style.display = '';
            panel.style.display = 'none';
            stripNotesLine();
            return;
        }
        // Artwork upload matters on "new"; the design # group is irrelevant on "tbd".
        if (art) art.style.display = (status === 'tbd') ? 'none' : '';
        if (dg) dg.style.display = (status === 'tbd') ? 'none' : '';

        if (status === 'tbd') {
            const text = (opts.restore && savedNotesLineText()) || cfg.assumption();
            if (!opts.restore) writeNotesLine(text);
            renderPanel(text);
        } else {
            panel.style.display = 'none';
            stripNotesLine();
        }
        if (status === 'onfile' && !opts.restore && cfg.designFocusId) {
            const d = document.getElementById(cfg.designFocusId);
            if (d) {
                try { d.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (_) { }
                d.focus();
            }
        }
        if (status === 'new' && !opts.restore && typeof cfg.onNew === 'function') {
            try { cfg.onNew(); } catch (e) { console.warn('[LogoStatus] onNew hook failed', e); }
        }
        if (!opts.restore && typeof markAsUnsaved === 'function') markAsUnsaved();
    }

    wrap.querySelector('.lsc-group').addEventListener('click', (e) => {
        const chip = e.target.closest('.lsc-chip');
        if (!chip) return;
        setStatus(window._logoStatus === chip.dataset.status ? null : chip.dataset.status);
    });

    // Edit-load restore: a saved "ARTWORK TBD:" line re-arms the chip. Delayed
    // twice because edit-load populates the notes field asynchronously.
    [1200, 3500].forEach(ms => setTimeout(() => {
        if (!window._logoStatus && savedNotesLineText() !== null) setStatus('tbd', { restore: true });
    }, ms));
}
if (typeof window !== 'undefined') window.initLogoStatusChips = initLogoStatusChips;

// ============================================================
// "Recent orders" panel after customer selection (item #13, 2026-07-05)
// ============================================================
// ADVISORY feature: shows the picked customer's 3 most recent ShopWorks orders
// (via the same-origin /api/mo/orders forwarder — PII-gated, staff-session-authed)
// with a [Reference] action that drops order # + design name into the notes/project
// field and prefills empty PO / design-name inputs. It NEVER reconstructs line items
// and NEVER touches pricing. Every failure path is a silent skip (console.warn) —
// a rep who can't see the panel has lost nothing.
let _recentOrdersToken = 0;

function removeRecentOrdersPanel() {
    const old = document.getElementById('qb-recent-orders');
    if (old) old.remove();
}

/**
 * Fetch + render the recent-orders panel for a ShopWorks customer.
 * @param {number|string} idCustomer — ShopWorks id_Customer (from the CRM contact pick)
 * @param {Object} cfg
 *   anchorId  — element the panel renders after (default 'customer-lookup')
 *   notesId   — textarea that [Reference] appends to (falls back to projectId input)
 *   projectId — project-name input (reference target fallback; only set when empty)
 *   poId      — PO input to prefill from CustomerPurchaseOrder (only when empty)
 *   designId  — design # / name input to prefill from DesignName (only when empty)
 */
function showRecentCustomerOrders(idCustomer, cfg) {
    cfg = cfg || {};
    removeRecentOrdersPanel();
    const idNum = parseInt(idCustomer, 10);
    if (!Number.isFinite(idNum) || idNum <= 0) return;
    const anchor = document.getElementById(cfg.anchorId || 'customer-lookup');
    if (!anchor) return;
    const token = ++_recentOrdersToken;

    const qs = 'orders?id_Customer=' + encodeURIComponent(idNum);
    const fetchOrders = (typeof window !== 'undefined' && typeof window.moFetch === 'function')
        ? window.moFetch(qs)
        : fetch('/api/mo/' + qs, { credentials: 'same-origin' });

    fetchOrders
        .then((r) => { if (!r.ok) throw new Error('mo/orders ' + r.status); return r.json(); })
        .then((data) => {
            if (token !== _recentOrdersToken) return;   // stale — a newer customer was picked
            const orders = ((data && data.result) || [])
                .slice()
                .sort((a, b) => new Date(b.date_Ordered || 0) - new Date(a.date_Ordered || 0))
                .slice(0, 3);
            if (!orders.length) return;                  // nothing to show — stay silent
            _renderRecentOrdersPanel(anchor, orders, cfg);
        })
        .catch((err) => {
            // Advisory only — NEVER surface an error for this panel (per spec: silent-skip).
            console.warn('[RecentOrders] skipped:', err && err.message);
        });
}

function _fmtOrderDate(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function _renderRecentOrdersPanel(anchor, orders, cfg) {
    removeRecentOrdersPanel();
    const host = anchor.closest('.form-group, .quote-form-group, .customer-info-grid, .section-body') || anchor.parentElement;
    if (!host) return;
    const panel = document.createElement('div');
    panel.id = 'qb-recent-orders';
    panel.style.cssText = 'margin-top:8px;padding:8px 10px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;font-size:12px;color:#334155;';
    const rows = orders.map((o, i) => {
        const design = o.DesignName ? String(o.DesignName) : '(no design name)';
        const date = _fmtOrderDate(o.date_Ordered);
        return '<div style="display:flex;align-items:center;gap:8px;padding:3px 0;">'
            + '<span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">'
            + '<strong>#' + escapeHtml(String(o.id_Order || '')) + '</strong> · ' + escapeHtml(design)
            + (date ? ' <span style="color:#94a3b8;">· ' + escapeHtml(date) + '</span>' : '')
            + '</span>'
            + '<button type="button" data-ro-ref="' + i + '" title="Insert this order # + design into the quote notes"'
            + ' style="background:#fff;border:1px solid #cbd5e1;border-radius:4px;padding:2px 8px;font-size:11px;color:#334155;cursor:pointer;">Reference</button>'
            + '</div>';
    }).join('');
    // eslint-disable-next-line no-unsanitized/property -- audited (1.4): recent-orders rows escapeHtml every ShopWorks value at build
    panel.innerHTML = '<div style="display:flex;align-items:center;margin-bottom:4px;">'
        + '<strong style="flex:1;font-size:11px;text-transform:uppercase;letter-spacing:.4px;color:#64748b;">'
        + '<i class="fas fa-history" style="margin-right:5px;"></i>Recent ShopWorks orders</strong>'
        + '<button type="button" data-ro-dismiss="1" aria-label="Dismiss recent orders"'
        + ' style="background:none;border:none;color:#94a3b8;font-size:14px;cursor:pointer;line-height:1;padding:0 2px;">&times;</button>'
        + '</div>' + rows;
    panel.addEventListener('click', (e) => {
        if (e.target.closest('[data-ro-dismiss]')) { removeRecentOrdersPanel(); return; }
        const refBtn = e.target.closest('[data-ro-ref]');
        if (!refBtn) return;
        const order = orders[parseInt(refBtn.getAttribute('data-ro-ref'), 10)];
        if (order) _applyOrderReference(order, cfg);
    });
    host.insertAdjacentElement('afterend', panel);
}

function _applyOrderReference(order, cfg) {
    const setVal = (id, value, appendLine) => {
        const el = id && document.getElementById(id);
        if (!el || !value) return false;
        if (appendLine) {
            // Idempotent: clicking [Reference] twice on the same order must not
            // append the ref line twice (would pollute the notes pushed to ShopWorks).
            if (el.value.indexOf(value) !== -1) return false;
            el.value = (el.value.trim() ? el.value.replace(/\s+$/, '') + '\n' : '') + value;
        } else {
            if (el.value.trim()) return false;   // light prefill — never clobber typed data
            el.value = value;
        }
        // Fire the same events a keyboard entry fires so dirty-tracking / comboboxes react.
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
    };
    const design = order.DesignName ? String(order.DesignName) : '';
    const date = _fmtOrderDate(order.date_Ordered);
    const refLine = 'Re-order ref: SW order #' + String(order.id_Order || '')
        + (design ? ' — ' + design : '') + (date ? ' (' + date + ')' : '');
    // order # + design → notes textarea (append) or, when the builder has none, the project field
    const wroteNotes = setVal(cfg.notesId, refLine, true);
    if (!wroteNotes) setVal(cfg.projectId, refLine, false);
    // light prefills — empty fields only
    setVal(cfg.poId, order.CustomerPurchaseOrder ? String(order.CustomerPurchaseOrder) : '', false);
    setVal(cfg.designId, design || (order.id_Design ? String(order.id_Design) : ''), false);
    if (typeof markAsUnsaved === 'function') { try { markAsUnsaved(); } catch (_) {} }
    if (typeof showToast === 'function') showToast('Referenced order #' + String(order.id_Order || ''), 'success');
}

// ============================================================
// Bulk size paste (2026-07-06, UX audit P1 #2)
// ============================================================

/**
 * Parse a bulk size string like "S:2 M:4 L:6 2XL:1" (also / - = separators,
 * commas/semicolons between tokens, XXL → 2XL alias) into { S:2, M:4, ... }.
 * Returns {} when the text doesn't look like a size list, so plain pastes
 * fall through untouched. Promoted from dtg-inline-form.js (C8) — DTG's
 * closure now delegates here so all 4 builders parse identically.
 */
function parseBulkSizes(text) {
    const result = {};
    const re = /\b(XS|S|M|L|XL|2XL|3XL|4XL|5XL|6XL|XXL)\s*[:\/\-=]\s*(\d{1,4})\b/gi;
    let m;
    while ((m = re.exec(String(text || ''))) !== null) {
        let key = m[1].toUpperCase();
        if (key === 'XXL') key = '2XL';
        const q = parseInt(m[2], 10);
        if (Number.isFinite(q) && q >= 0) result[key] = q;
    }
    return result;
}

/**
 * Delegated paste-to-fill on a trio product table. Pasting "S:2 M:4 L:6"
 * into any size cell fills each parsed size's input in the SAME row and
 * fires its 'change' event, so the builder's own onSizeChange (pricing
 * recalc, SCP/DTF 2XL child-row machinery) runs exactly as if typed.
 * Sizes with no editable cell in the row (3XL+/XS → extended popup, cap
 * OSFA rows) are reported in the toast instead of silently dropped.
 * Single values and non-size text keep the browser's default paste.
 */
function wireBulkSizePaste(tbodyId) {
    const tbody = document.getElementById(tbodyId || 'product-tbody');
    if (!tbody || tbody.dataset.bulkPasteWired === '1') return;
    tbody.dataset.bulkPasteWired = '1';
    tbody.addEventListener('paste', (e) => {
        const input = e.target;
        if (!input || !input.matches || !input.matches('input.size-input[data-size]:not([readonly])')) return;
        const clip = e.clipboardData || window.clipboardData;
        const parsed = parseBulkSizes(clip ? clip.getData('text') : '');
        const sizes = Object.keys(parsed);
        if (sizes.length < 2) return;
        const row = input.closest('tr');
        // Child rows are single-size line items (SCP/DTF 2XL+, EMB extended
        // sizes) — bulk-filling their sibling size cells would corrupt them.
        if (!row || row.classList.contains('child-row')) return;
        const targets = [];
        const skipped = [];
        for (const sz of sizes) {
            const cell = row.querySelector('input.size-input[data-size="' + sz + '"]:not([readonly])');
            if (cell && !cell.disabled) targets.push([cell, parsed[sz]]);
            else skipped.push(sz + ':' + parsed[sz]);
        }
        if (!targets.length) return;
        e.preventDefault();
        let pieces = 0;
        for (const [cell, qty] of targets) {
            cell.value = qty > 0 ? qty : '';
            pieces += qty;
            cell.dispatchEvent(new Event('change', { bubbles: true }));
        }
        if (typeof showToast === 'function') {
            let msg = 'Filled ' + targets.length + ' sizes (' + pieces + ' pieces) from paste';
            if (skipped.length) msg += ' — not auto-filled: ' + skipped.join(', ') + ' (use the + extended-sizes button)';
            showToast(msg, skipped.length ? 'warning' : 'success', skipped.length ? 6000 : 3000);
        }
    });
}

// Self-attach for the trio: EMB/SCP/DTF all render product rows inside
// #product-tbody with the same input.size-input[data-size] contract. DTG has
// no #product-tbody (card layout, own paste handler in dtg-inline-form.js),
// so this no-ops there. Delegated listener → rows added later are covered.
if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => wireBulkSizePaste('product-tbody'));
}

if (typeof window !== 'undefined') {
    window.getQuickQuotePrefill = getQuickQuotePrefill;
    window.clearQuickQuoteParams = clearQuickQuoteParams;
    window.showRecentCustomerOrders = showRecentCustomerOrders;
    window.removeRecentOrdersPanel = removeRecentOrdersPanel;
    window.parseBulkSizes = parseBulkSizes;
    window.wireBulkSizePaste = wireBulkSizePaste;
    window.syncCustomerManualDetails = syncCustomerManualDetails;
    window.autoExpandFeesOnFirstCharge = autoExpandFeesOnFirstCharge;
}

// Node.js export (testing) — pure functions only
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { escapeHtml, formatPrice, cleanProductTitle, getSwatchStyle, parseRatePercent, parseBulkSizes, distributeProportionally, stashMethodSwitchPrefill, takeMethodSwitchPrefill };
}

// QuoteBuilderUtils v3.1.0 loaded
