/**
 * EMB quote-lifecycle module — roadmap 0.4 extraction #7 (2026-07-07).
 *
 * Quote-level state transitions and the fees panel: resetQuote (the 243-line
 * new-quote reset — every toggle/flag MUST reset here, Rule 7), discount
 * type/preset handling, additional-charges + fee-table rendering,
 * getAdditionalCharges/collectDECGItems (state collectors the save/output
 * modules consume), unsaved-changes tracking, and panel toggles.
 *
 * Moved verbatim from embroidery-quote-builder.js (~640-line contiguous
 * cluster). Consumed via REAL imports by persistence/output/save-push.
 */
// @ts-nocheck — MOVED legacy DOM code: pre-existing checkJs frictions; typing
// lands with this cluster's render/state split (see emb-decomposition-plan.md).
/* global EMB_DEFAULTS, showToast, markAsUnsaved,
   DesignThumbnailService, setLtmControlState, setQuoteDateDefaults,
   markAsSaved */
import { resetDesignSearchState, showDesignThumbnail } from './design-search.js';
import { getServicePrice } from './pricing.js';
import { calculateDiscountableSubtotal, onShipMethodChange, recalculatePricing } from './pricing-sync.js';
import { updatePushButtonState } from './save-push.js';
import { _syncALArrays, handleCapEmbellishmentChange, updateNotesBadge } from './logo-config.js';
import { updateLogoCardHeader } from './product-rows.js';

/**
 * Toggle Additional Charges panel visibility
 * Panel is COLLAPSED by default to reduce visual clutter
 */
export function toggleAdditionalCharges() {
    const content = document.getElementById('charges-content');
    const chevron = document.getElementById('charges-chevron');
    if (content.style.display === 'none') {
        // Expanding - show content, chevron points UP
        content.style.display = 'block';
        chevron.style.transform = 'rotate(0deg)';
    } else {
        // Collapsing - hide content, chevron points DOWN
        content.style.display = 'none';
        chevron.style.transform = 'rotate(180deg)';
    }
}

// toggleSaveShare() — EMB-local copy removed 2026-06-07 (dead: the EMB UI has no
// #save-share-content panel). The live copy is the shared one in quote-builder-utils.js,
// which DTF/SCP/legacy-DTG still use.

export function toggleOrderDetails() {
    const content = document.getElementById('order-details-content');
    const chevron = document.getElementById('order-details-chevron');
    if (content.style.display === 'none') {
        content.style.display = 'block';
        chevron.style.transform = 'rotate(180deg)';
    } else {
        content.style.display = 'none';
        chevron.style.transform = '';
    }
}

// ============================================
// Unsaved Changes Tracking (UX Improvement)
// ============================================

/**
 * Mark quote as having unsaved changes
 * Shows pulsing "Unsaved" badge in header
 */
// markAsUnsaved(), markAsSaved(), hasUnsavedChanges() → moved to quote-builder-utils.js

/**
 * Setup event listeners for tracking unsaved changes
 * Adds listeners to customer fields and additional charges
 */
export function setupUnsavedChangesTracking() {
    // Customer fields
    const customerFields = [
        'customer-name', 'customer-email', 'company-name', 'customer-lookup', 'sales-rep'
    ];
    customerFields.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('input', markAsUnsaved);
            el.addEventListener('change', markAsUnsaved);
        }
    });

    // Additional charges fields
    const chargeFields = [
        'rush-fee', 'discount-amount', 'discount-reason', 'art-charge', 'graphic-design-hours'
    ];
    chargeFields.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('input', markAsUnsaved);
            el.addEventListener('change', markAsUnsaved);
        }
    });

    // Logo configuration fields
    const logoFields = [
        'primary-position', 'primary-stitches', 'primary-digitizing',
        'fb-stitch-count',
        'garment-al-digitizing-checkbox',
        'cap-primary-stitches', 'cap-al-digitizing-checkbox',
        'cap-embellishment-type'
    ];
    logoFields.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('input', markAsUnsaved);
            el.addEventListener('change', markAsUnsaved);
        }
    });
}

// ============================================
// New Quote Functionality (UX Improvement)
// ============================================

/**
 * Confirm and start a new quote
 * Prompts user if there are unsaved changes
 */
// confirmNewQuote() → moved to quote-builder-utils.js

/**
 * Reset all quote data and start fresh
 */
// P2-8 (audit 2026-06-06): the CRM context banners (warning / tax-exempt chip / tier badge / terms note)
// are painted by surfaceCustomerContext on customer select but were never cleared — so they bled onto the
// next/blank customer after Start-New or a manual re-entry. Clear them on reset + lookup-clear.
export function clearCustomerContextBanners() {
    ['customer-warning-banner', 'customer-tax-chip', 'customer-tier-badge', 'customer-terms-note'].forEach(id => {
        const el = document.getElementById(id);
        if (el) { el.innerHTML = ''; el.style.display = 'none'; }
    });
    // [B8] (audit 2026-06-06): clear the persisted tax-exemption so it can't leak into the next quote and
    // suppress a legitimate tax lookup.
     
    window._taxExempt = false;
}

export function resetQuote() {
    clearCustomerContextBanners();  // P2-8: don't bleed the prior customer's CRM banners into a new quote
    // Hide + zero the sidebar TOTAL bar (re-shown on first recalc)
    const _stb = document.getElementById('sidebar-total-bar');
    if (_stb) _stb.hidden = true;
    const _stg = document.getElementById('sidebar-grand-total');
    if (_stg) _stg.textContent = '$0.00';
    // Clear all product rows and re-add empty state
    const tbody = document.getElementById('product-tbody');
    tbody.innerHTML = `
        <tr id="empty-state-row">
            <td colspan="14" style="text-align: center; padding: 40px 20px; color: #64748b; background: #f8fafc;">
                <div style="font-size: 32px; margin-bottom: 12px;">&#128085;</div>
                <div style="font-size: 16px; font-weight: 500; margin-bottom: 8px;">Enter a style number to get started</div>
                <div style="font-size: 13px; color: #94a3b8;">Type a style # in the search bar above (e.g., PC54, G500, C112)</div>
            </td>
        </tr>
    `;

    // Reset row counter + the child-row map (module-level) — else a previous quote's 2XL/3XL child-row
    // references leak into the next quote and can mis-map size overrides on save. (audit #13c 2026-06-05)
    rowCounter = 0;
    childRowMap = {};
    // [2026-06-07] Clear the wholesale flag + checkbox so it doesn't leak into the next quote.
     
    window._isWholesale = false;
    const _wholesaleReset = document.getElementById('wholesale-checkbox');
    if (_wholesaleReset) _wholesaleReset.checked = false;

    // Reset logo cards visibility
    const garmentCard = document.getElementById('garment-logo-card');
    const capCard = document.getElementById('cap-logo-card');
    if (garmentCard) garmentCard.style.display = 'none';
    if (capCard) capCard.style.display = 'none';
    // Clear the artwork UPLOAD widget (files + design name). Without this, a logo uploaded on
    // the previous quote BLEEDS into the next quote and gets saved + pushed to ShopWorks — the
    // wrong logo embroidered on a real order. (The old comment here confused the removed charge
    // panel with this widget.) DTF does the same via _dtfArtwork.clear(). (2026-06-04 audit B1)
    try { window._embArtwork?.clear?.(); } catch (_) {}

    // Reset logo configurations to defaults
    primaryLogo.position = 'Left Chest';
    primaryLogo.stitchCount = EMB_DEFAULTS.GARMENT_STITCH_COUNT;
    primaryLogo.needsDigitizing = false;
    primaryLogo.designNumber = null;
    primaryLogo.designName = null;
    primaryLogo.thumbnailUrl = null;
    updateLogoCardHeader('garment', null);
    // Clear design number inputs
    const gDesignInput = document.getElementById('garment-design-number');
    if (gDesignInput) gDesignInput.value = '';
    const gDesignInfo = document.getElementById('garment-design-info');
    if (gDesignInfo) { gDesignInfo.style.display = 'none'; gDesignInfo.innerHTML = ''; }
    const gDesignClear = document.getElementById('garment-design-clear');
    if (gDesignClear) gDesignClear.style.display = 'none';
    showDesignThumbnail('garment', null);
    if (typeof capPrimaryLogo !== 'undefined') {
        capPrimaryLogo.designNumber = null;
        capPrimaryLogo.designName = null;
        capPrimaryLogo.thumbnailUrl = null;
        capPrimaryLogo.embellishmentType = 'embroidery';  // else a prior quote's 3D-puff / laser-patch bleeds into the next (audit #13c 2026-06-05)
        const cEmbSel = document.getElementById('cap-embellishment-type');
        if (cEmbSel) { cEmbSel.value = 'embroidery'; if (typeof handleCapEmbellishmentChange === 'function') handleCapEmbellishmentChange(); }
        updateLogoCardHeader('cap', null);
        const cDesignInput = document.getElementById('cap-design-number');
        if (cDesignInput) cDesignInput.value = '';
        const cDesignInfo = document.getElementById('cap-design-info');
        if (cDesignInfo) { cDesignInfo.style.display = 'none'; cDesignInfo.innerHTML = ''; }
        const cDesignClear = document.getElementById('cap-design-clear');
        if (cDesignClear) cDesignClear.style.display = 'none';
        showDesignThumbnail('cap', null);
    }
    // Clear thumbnail and gallery caches
    if (typeof DesignThumbnailService !== 'undefined') DesignThumbnailService.clearCache();
    resetDesignSearchState(); // gallery cache + search state live in builders/emb/design-search.js
    // Clear cached design data from logo objects
    primaryLogo._designData = null;
    if (typeof capPrimaryLogo !== 'undefined') capPrimaryLogo._designData = null;
    document.getElementById('primary-position').value = 'Left Chest';
    document.getElementById('primary-stitches').value = EMB_DEFAULTS.GARMENT_STITCH_COUNT;
    document.getElementById('primary-digitizing').checked = false;
    // Reset patch setup checkbox
    const patchSetupCheckbox = document.getElementById('cap-patch-setup');
    if (patchSetupCheckbox) {
        patchSetupCheckbox.checked = false;
        const wrapper = patchSetupCheckbox.closest('.digitizing-checkbox');
        if (wrapper) wrapper.classList.remove('checked');
    }
    // Re-enable position dropdown in case it was disabled by Full Back
    document.getElementById('primary-position').disabled = false;
    // Hide and reset Full Back stitch count input
    const fbField = document.getElementById('fb-stitch-count-field');
    if (fbField) fbField.style.display = 'none';
    const fbInput = document.getElementById('fb-stitch-count');
    if (fbInput) fbInput.value = 25000;
    // Reset cap tier dropdown
    const capTierEl = document.getElementById('cap-primary-stitches');
    if (capTierEl) capTierEl.value = '8000';

    // Reset additional logo toggles and globalAL state
    globalAL.garment = { enabled: false, position: 'AL', stitchCount: EMB_DEFAULTS.AL_GARMENT_STITCH_COUNT, needsDigitizing: false };
    globalAL.cap = { enabled: false, position: 'AL-Cap', stitchCount: EMB_DEFAULTS.CAP_STITCH_COUNT, needsDigitizing: false };
    _syncALArrays();

    const garmentALSwitch = document.getElementById('garment-al-switch');
    const garmentALLabel = document.getElementById('garment-al-label');
    const garmentALConfig = document.getElementById('garment-al-config-new');
    const capALSwitch = document.getElementById('cap-al-switch');
    const capALLabel = document.getElementById('cap-al-label');
    const capALConfig = document.getElementById('cap-al-config-new');
    if (garmentALSwitch) garmentALSwitch.classList.remove('active');
    if (garmentALLabel) garmentALLabel.classList.remove('active');
    if (garmentALConfig) garmentALConfig.classList.remove('visible');
    if (capALSwitch) capALSwitch.classList.remove('active');
    if (capALLabel) capALLabel.classList.remove('active');
    if (capALConfig) capALConfig.classList.remove('visible');
    document.getElementById('garment-al-toggle').checked = false;
    document.getElementById('cap-al-toggle').checked = false;

    // Reset customer form fields
    document.getElementById('customer-name').value = '';
    document.getElementById('customer-email').value = '';
    document.getElementById('company-name').value = '';
    document.getElementById('customer-phone').value = '';
    document.getElementById('customer-lookup').value = '';
    { const pn = document.getElementById('project-name'); if (pn) pn.value = ''; }  // P2-5 (audit 2026-06-06)

    // Reset notes
    const notesEl = document.getElementById('notes');
    if (notesEl) notesEl.value = '';
    const notesSection = document.getElementById('notes-section');
    if (notesSection) {
        notesSection.classList.add('collapsed');
        const notesBody = notesSection.querySelector('.notes-body');
        const notesIcon = notesSection.querySelector('.notes-toggle-icon');
        if (notesBody) notesBody.style.display = 'none';
        if (notesIcon) notesIcon.style.transform = '';
    }
    updateNotesBadge();

    // Reset LTM control panel
    setLtmControlState('emb-ltm-panel', { enabled: true, displayMode: 'builtin' });
    document.getElementById('emb-ltm-wrapper').style.display = 'none';

    // Reset additional charges
    document.getElementById('shipping-fee').value = '0';
    const taxRateInput = document.getElementById('tax-rate-input');
    if (taxRateInput) taxRateInput.value = '10.2';
    document.getElementById('include-tax').checked = true;
    document.getElementById('rush-fee').value = '';

    // Reset Ship To fields
    document.getElementById('ship-address').value = '';
    document.getElementById('ship-city').value = '';
    document.getElementById('ship-state').value = 'WA';
    document.getElementById('ship-zip').value = '';
    const taxStatus = document.getElementById('tax-lookup-status');
    if (taxStatus) taxStatus.innerHTML = '';

    // Reset Order Details fields
    document.getElementById('po-number').value = '';
    document.getElementById('order-number').value = '';
    document.getElementById('customer-number').value = '';
    document.getElementById('ship-method').value = 'Customer Pickup';
    document.getElementById('ship-method-other').value = '';
     
    window._lastCustomerShipTo = null;
    onShipMethodChange();
    document.getElementById('date-order-placed').value = '';
    document.getElementById('req-ship-date').value = '';
    document.getElementById('drop-dead-date').value = '';
    document.getElementById('payment-terms').value = '';
    // New-quote date defaults (today / +2 weeks) — refills the just-cleared blanks
    if (typeof setQuoteDateDefaults === 'function') setQuoteDateDefaults();
    const odContent = document.getElementById('order-details-content');
    const odChevron = document.getElementById('order-details-chevron');
    const odBadge = document.getElementById('order-details-badge');
    if (odContent) odContent.style.display = '';   // always-visible flow-step body now
    if (odChevron) odChevron.style.transform = '';
    if (odBadge) odBadge.style.display = 'none';
    // NOTE: discount-amount / discount-reason / art-charge were removed when the
    // discount + artwork-services panels were replaced. Bare getElementById().value
    // here threw and ABORTED resetQuote → the builder stayed in edit mode and the next
    // save silently overwrote the previous quote. Guard every access. (2026-06-04)
    const discAmt = document.getElementById('discount-amount'); if (discAmt) discAmt.value = '';
    const reasonPreset = document.getElementById('discount-reason-preset');
    if (reasonPreset) reasonPreset.value = '';
    const reasonInput = document.getElementById('discount-reason');
    if (reasonInput) { reasonInput.value = ''; reasonInput.style.display = 'none'; }
    const artCharge = document.getElementById('art-charge'); if (artCharge) { artCharge.value = 0; artCharge.disabled = true; }
    const artToggle = document.getElementById('art-charge-toggle'); if (artToggle) artToggle.checked = false;
    const artChargeWrapper = document.getElementById('art-charge-wrapper');
    if (artChargeWrapper) artChargeWrapper.style.opacity = '0.4';
    const gdh = document.getElementById('graphic-design-hours'); if (gdh) gdh.value = '';
    // Reset artwork badge
    const artworkBadge = document.getElementById('artwork-badge');
    if (artworkBadge) {
        artworkBadge.classList.add('hidden');
        artworkBadge.style.display = 'none';
    }

    // Clear edit mode and import metadata
    editingQuoteId = null;
    editingRevision = null;
    lastImportMetadata = null;

    // Clear ShopWorks push state — else a brand-new quote inherits the PREVIOUS quote's _pushQuoteId
    // (could preview/push the OLD order from a blank form — wrong order to production) and its
    // _pushAlreadyDone "Sent ✓" state (stuck disabled button + blank readiness checklist). showPushButton
    // only resets these on save, which New-Quote-without-save never reaches. (review C3/C7 2026-06-05)
    _pushAlreadyDone = false;
    _pushQuoteId = null;
    if (typeof updatePushButtonState === 'function') { try { updatePushButtonState(); } catch (_) {} }

    // Clear draft storage
    if (embPersistence) {
        embPersistence.clearDraft();
    }

    // Recalculate pricing (will show zeros)
    recalculatePricing();
    updateAdditionalCharges();

    // Mark as saved (no unsaved changes)
    markAsSaved();

    // Focus search bar for immediate typing
    const searchInput = document.getElementById('product-search');
    if (searchInput) {
        searchInput.focus();
    }

    showToast('Ready for new quote', 'success');
}

/**
 * Update discount symbol when type changes ($ vs %)
 */
export function updateDiscountType() {
    const discountType = document.getElementById('discount-type')?.value;
    const symbol = document.getElementById('discount-symbol');
    const inputWrapper = document.getElementById('discount-input-wrapper');
    const presetDropdown = document.getElementById('discount-preset');
    const amountInput = document.getElementById('discount-amount');

    if (discountType === 'percent') {
        // Show preset dropdown, hide number input
        if (inputWrapper) inputWrapper.style.display = 'none';
        if (presetDropdown) presetDropdown.style.display = 'block';
        // Set amount from preset (unless custom is selected)
        if (presetDropdown && presetDropdown.value !== 'custom') {
            if (amountInput) amountInput.value = presetDropdown.value;
        }
    } else {
        // Show number input, hide preset dropdown
        if (inputWrapper) inputWrapper.style.display = 'block';
        if (presetDropdown) presetDropdown.style.display = 'none';
        if (symbol) symbol.textContent = '$';
    }

    updateAdditionalCharges();
}

export function handleDiscountPresetChange() {
    const preset = document.getElementById('discount-preset')?.value;
    const inputWrapper = document.getElementById('discount-input-wrapper');
    const amountInput = document.getElementById('discount-amount');
    const symbol = document.getElementById('discount-symbol');

    if (preset === 'custom') {
        // Show number input for custom entry
        if (inputWrapper) inputWrapper.style.display = 'block';
        if (symbol) symbol.textContent = '%';
        if (amountInput) amountInput.focus();
    } else {
        // Use preset value
        if (inputWrapper) inputWrapper.style.display = 'none';
        if (amountInput) amountInput.value = preset;
    }
    updateFeeTableRows();
}

export function handleDiscountReasonPresetChange() {
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
    updateFeeTableRows();
}

/**
 * Calculate and update additional charges display badge
 */
export function onLtmOverrideChange() {
    // Now handled by initLtmControlListeners callback — kept for backward compat
    recalculatePricing();
    markAsUnsaved();
}

export function updateAdditionalCharges() {
    const artCharge = parseFloat(document.getElementById('art-charge')?.value) || 0;
    const graphicDesignHours = parseFloat(document.getElementById('graphic-design-hours')?.value) || 0;
    const grtRate = getServicePrice('GRT-75', 75); // GRT-75 rate from Service_Codes API (review C8)
    // Missing-service-code visible warning — shared helper (quote-builder-utils.js),
    // synced with DTF/SCP (2026-07-04, Erik's #1 rule). Covers the silent case where
    // codes loaded but GRT-75 is absent, so a rep never bills the $75 fallback unwarned.
    if (graphicDesignHours > 0 && typeof window.warnIfServiceCodeMissing === 'function') {
        window.warnIfServiceCodeMissing('GRT-75', grtRate, 'Graphic-design');
    }
    const graphicDesignCharge = graphicDesignHours * grtRate;
    const rushFee = parseFloat(document.getElementById('rush-fee')?.value) || 0;
    const sampleFee = parseFloat(document.getElementById('sample-fee')?.value) || 0;
    const discountAmount = parseFloat(document.getElementById('discount-amount')?.value) || 0;
    const discountType = document.getElementById('discount-type')?.value || 'fixed';

    // Update graphic design total display
    const graphicDesignTotalEl = document.getElementById('graphic-design-total');
    if (graphicDesignTotalEl) {
        graphicDesignTotalEl.textContent = graphicDesignCharge.toFixed(2);
    }

    const shippingFeeVal = parseFloat(document.getElementById('shipping-fee')?.value) || 0;

    // Calculate total additional charges (before discount)
    const totalCharges = artCharge + graphicDesignCharge + rushFee + sampleFee + shippingFeeVal;

    // Calculate discount value
    let discountValue = 0;
    if (discountType === 'percent') {
        // Get current subtotal from pricing summary for percentage calculation
        const subtotalText = document.getElementById('subtotal')?.textContent || '$0.00';
        const subtotal = parseFloat(subtotalText.replace(/[$,]/g, '')) || 0;
        discountValue = subtotal * (discountAmount / 100);
    } else {
        discountValue = discountAmount;
    }

    // Net additional = charges - discount
    const netAdditional = totalCharges - discountValue;

    // Update badge
    const badge = document.getElementById('charges-badge');
    if (netAdditional !== 0) {
        badge.style.display = 'inline';
        badge.textContent = netAdditional >= 0
            ? `+$${netAdditional.toFixed(2)}`
            : `-$${Math.abs(netAdditional).toFixed(2)}`;
        badge.style.background = netAdditional >= 0 ? '#22c55e' : '#dc2626';
    } else {
        badge.style.display = 'none';
    }

    // Update fee table rows (2026 refactor)
    updateFeeTableRows();
}

/**
 * Update fee table rows based on current input values
 * Shows/hides rows in the products table based on fee values
 */
export function updateFeeTableRows() {
    // Art charge row
    const artChargeRow = document.getElementById('art-charge-row');
    const artChargeToggle = document.getElementById('art-charge-toggle');
    const artCharge = parseFloat(document.getElementById('art-charge')?.value || 0);
    if (artChargeRow) {
        if (artChargeToggle?.checked && artCharge > 0) {
            artChargeRow.style.display = 'table-row';
            document.getElementById('art-charge-unit').textContent = '$' + artCharge.toFixed(2);
            document.getElementById('art-charge-total').textContent = '$' + artCharge.toFixed(2);
        } else {
            artChargeRow.style.display = 'none';
        }
    }

    // Graphic design row
    const graphicDesignRow = document.getElementById('graphic-design-row');
    const designHours = parseFloat(document.getElementById('graphic-design-hours')?.value || 0);
    const designTotal = designHours * getServicePrice('GRT-75', 75);  // GRT-75 rate from Service_Codes API (review C8)
    if (graphicDesignRow) {
        if (designHours > 0) {
            graphicDesignRow.style.display = 'table-row';
            document.getElementById('design-hours-label').textContent = designHours;
            document.getElementById('graphic-design-unit').textContent = '$' + designTotal.toFixed(2);
            document.getElementById('graphic-design-total-row').textContent = '$' + designTotal.toFixed(2);
        } else {
            graphicDesignRow.style.display = 'none';
        }
    }

    // Rush fee row
    const rushFeeRow = document.getElementById('rush-fee-row');
    const rushFee = parseFloat(document.getElementById('rush-fee')?.value || 0);
    if (rushFeeRow) {
        if (rushFee > 0) {
            rushFeeRow.style.display = 'table-row';
            document.getElementById('rush-fee-unit').textContent = '$' + rushFee.toFixed(2);
            document.getElementById('rush-fee-total').textContent = '$' + rushFee.toFixed(2);
        } else {
            rushFeeRow.style.display = 'none';
        }
    }

    // Discount row
    const discountRow = document.getElementById('discount-row');
    const discountAmount = parseFloat(document.getElementById('discount-amount')?.value || 0);
    const discountType = document.getElementById('discount-type')?.value || 'fixed';
    const discountReason = document.getElementById('discount-reason')?.value || '';
    if (discountRow) {
        if (discountAmount > 0) {
            discountRow.style.display = 'table-row';
            let actualDiscount = discountAmount;
            if (discountType === 'percent') {
                const { discount } = calculateDiscountableSubtotal();
                actualDiscount = discount;
            }
            const reasonLabel = document.getElementById('discount-reason-label');
            if (reasonLabel) {
                let labelParts = [];
                if (discountType === 'percent') {
                    labelParts.push(`${discountAmount}%`);
                }
                if (discountReason) {
                    labelParts.push(discountReason);
                }
                reasonLabel.textContent = labelParts.length > 0 ? `(${labelParts.join(' - ')})` : '';
            }
            document.getElementById('discount-unit').textContent = '-$' + actualDiscount.toFixed(2);
            document.getElementById('discount-total').textContent = '-$' + actualDiscount.toFixed(2);
        } else {
            discountRow.style.display = 'none';
        }
    }
}

/**
 * Get additional charges data for saving to database
 * @returns {Object} Additional charges object
 */
export function getAdditionalCharges() {
    const discountAmount = parseFloat(document.getElementById('discount-amount')?.value) || 0;
    const discountType = document.getElementById('discount-type')?.value || 'fixed';

    // Use shared helper for consistent discount calculation
    const { discount: discountValue } = calculateDiscountableSubtotal();
    const discountPercent = discountType === 'percent' ? discountAmount : 0;

    // Graphic Design Services (GRT-75) @ $75/hr
    const graphicDesignHours = parseFloat(document.getElementById('graphic-design-hours')?.value) || 0;
    const graphicDesignCharge = graphicDesignHours * getServicePrice('GRT-75', 75);  // GRT-75 rate from Service_Codes API (review C8)

    // DECG/DECC data now collected from service product rows (not fee rows)
    // Use collectDECGItems() which reads from product table
    const decgItems = collectDECGItems();
    const decgItem = decgItems.find(i => i.type === 'DECG');
    const deccItem = decgItems.find(i => i.type === 'DECC');

    return {
        artCharge: parseFloat(document.getElementById('art-charge')?.value) || 0,
        graphicDesignHours: graphicDesignHours,
        graphicDesignCharge: graphicDesignCharge,
        rushFee: parseFloat(document.getElementById('rush-fee')?.value) || 0,
        sampleFee: parseFloat(document.getElementById('sample-fee')?.value) || 0,
        sampleQty: parseInt(document.getElementById('sample-qty')?.value) || 1,
        discount: discountValue,
        discountPercent: discountPercent,
        discountReason: document.getElementById('discount-reason')?.value?.trim() || '',
        // DECG/DECC (Customer-Supplied items) for PDF and shareable URLs - from service product rows
        decgQty: decgItem?.quantity || 0,
        decgUnit: decgItem?.unitPrice || 0,
        decgTotal: decgItem?.total || 0,
        deccQty: deccItem?.quantity || 0,
        deccUnit: deccItem?.unitPrice || 0,
        deccTotal: deccItem?.total || 0
    };
}

/**
 * Collect DECG (Customer-Supplied Garments) and DECC (Customer-Supplied Caps) data
 * Now reads from service product rows in the product table
 * Used for shareable URLs and PDF generation
 * @returns {Array} Array of DECG/DECC items with type, quantity, unitPrice, total, stitchCount
 */
export function collectDECGItems() {
    const items = [];

    // Find service product rows for DECG and DECC
    const serviceRows = document.querySelectorAll('#product-tbody tr.service-product-row');
    serviceRows.forEach(row => {
        const serviceType = row.dataset.serviceType?.toUpperCase();
        if (serviceType === 'DECG' || serviceType === 'DECC') {
            const qtyInput = row.querySelector('.service-qty');
            const qty = parseInt(qtyInput?.value) || 0;
            // Use sell price override if set, otherwise original unit price
            const overridePrice = parseFloat(row.dataset.sellPrice) || 0;
            const unitPrice = overridePrice > 0 ? overridePrice : (parseFloat(row.dataset.unitPrice) || 0);
            const stitchCount = parseInt(row.dataset.stitchCount) || 8000;
            const heavyweight = row.dataset.decgHeavyweight === 'true';

            if (qty > 0) {
                items.push({
                    type: serviceType,
                    quantity: qty,
                    unitPrice: unitPrice,
                    total: qty * unitPrice,
                    stitchCount: stitchCount,
                    heavyweight: heavyweight,
                    rowId: row.dataset.rowId,
                    hasPriceOverride: overridePrice > 0
                });
            }
        }
    });

    return items;
}
