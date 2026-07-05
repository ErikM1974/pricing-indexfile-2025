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
// Single source of truth for service fees = the Caspio Service_Codes table via
// GET /api/service-codes. `getServicePrice(code, fallback)` returns the live
// SellPrice, or the documented fallback WITH a visible warning if the API was
// unreachable — never a silent wrong price (Erik's #1 rule). Shared by SCP/DTF
// (EMB defines its own copy in embroidery-quote-builder.js — these guards yield
// to it so there's no double-definition). (2026-06-09)
if (typeof window !== 'undefined' && typeof window.loadServiceCodePrices !== 'function') {
    window.loadServiceCodePrices = async function loadServiceCodePrices() {
        try {
            const base = (window.APP_CONFIG && window.APP_CONFIG.API && window.APP_CONFIG.API.BASE_URL)
                || 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';
            const resp = await fetch(`${base}/api/service-codes`);
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            const json = await resp.json();
            const map = {};
            (json.data || []).forEach(sc => { if (sc.ServiceCode) map[String(sc.ServiceCode).toUpperCase()] = sc; });
            window._serviceCodes = map;
            return map;
        } catch (e) {
            console.error('[ServiceCodes] Could not load live prices from /api/service-codes:', e);
            if (typeof showToast === 'function') showToast("Couldn't reach the pricing service — using default service prices", 'warning', 5000);
            return null;
        }
    };
}
if (typeof window !== 'undefined' && typeof window.getServicePrice !== 'function') {
    window.getServicePrice = function getServicePrice(code, fallback) {
        const sc = window._serviceCodes && window._serviceCodes[String(code).toUpperCase()];
        if (!sc) return fallback;
        const sell = parseFloat(sc.SellPrice);
        return isNaN(sell) ? fallback : sell;
    };
}

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

    container.innerHTML = `
        <div class="ltm-control-panel">
            <div class="ltm-control-header">
                <i class="fas fa-exclamation-triangle"></i>
                <span>${escapeHtml(feeLabel)}</span>
            </div>
            <div class="ltm-control-body">
                <label class="ltm-checkbox-label">
                    <input type="checkbox" class="ltm-apply-checkbox" ${enabled ? 'checked' : ''}
                           data-ltm-container="${escapeHtml(containerId)}">
                    Apply LTM Fee (<span class="ltm-fee-display">$${feeAmount.toFixed(2)}</span>)
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
    try { target.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (_) { target.scrollIntoView(); }
    try { target.focus({ preventScroll: true }); } catch (_) { target.focus(); }
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
    el.innerHTML = '<div class="pr-title">Before you push</div>' + blockers.map(item).join('');
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
    if (typeof hasUnsavedChanges === 'function' && hasUnsavedChanges()) {
        if (confirm('You have unsaved changes. Start a new quote?')) {
            resetQuote();
        }
    } else {
        resetQuote();
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

    const apiBase = options.apiBaseUrl || (typeof APP_CONFIG !== 'undefined' ? APP_CONFIG.API.BASE_URL : 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com');

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
                    if (options.onTaxRateChange) options.onTaxRateChange(10.1);
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
 * Send a quote email to the customer via EmailJS.
 * @param {object} options - { quoteId, customerEmail, customerName, salesRepEmail, quoteUrl }
 */
async function emailQuote(options = {}) {
    if (!options.customerEmail) {
        showToast('Please enter customer email before sending', 'error');
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
        await emailjs.send('service_jgrave3', 'template_quote_email', {
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
        container.innerHTML = html;
        container.style.display = 'block';
    } else {
        container.style.display = 'none';
    }
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

if (typeof window !== 'undefined') {
    window.getQuickQuotePrefill = getQuickQuotePrefill;
    window.clearQuickQuoteParams = clearQuickQuoteParams;
    window.showRecentCustomerOrders = showRecentCustomerOrders;
    window.removeRecentOrdersPanel = removeRecentOrdersPanel;
}

// Node.js export (testing) — pure functions only
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { escapeHtml, formatPrice, cleanProductTitle, getSwatchStyle, parseRatePercent };
}

// QuoteBuilderUtils v3.1.0 loaded
