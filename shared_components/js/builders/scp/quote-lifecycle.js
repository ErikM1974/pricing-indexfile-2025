/**
 * SCP quote-lifecycle module — SCP decomposition S1b (2026-07-08).
 * Additional charges (art/rush/fees), discount controls + presets, and the
 * fee-table renderer. Moved verbatim.
 */
// @ts-nocheck — MOVED legacy DOM code (pre-existing checkJs frictions; typing lands with the render/state split).
/* global recalculatePricing, updateTaxCalculation, markScreenPrintDirty,
   escapeHtml, formatPrice, getServicePrice, autoExpandFeesOnFirstCharge,
   printConfig, SCREEN_FEE */

export function updateAdditionalCharges() {
    const artChargeToggle = document.getElementById('art-charge-toggle');
    const artCharge = artChargeToggle?.checked ? parseFloat(document.getElementById('art-charge')?.value || 0) : 0;
    const designHours = parseFloat(document.getElementById('graphic-design-hours')?.value || 0);
    const grtRate = getServicePrice('GRT-75', 75);
    // Missing-service-code visible warning — shared helper (quote-builder-utils.js),
    // synced with DTF/EMB (2026-07-04, Erik's #1 rule). Covers the silent case where
    // codes loaded but GRT-75 is absent, so a rep never bills the $75 fallback unwarned.
    if (designHours > 0 && typeof window.warnIfServiceCodeMissing === 'function') {
        window.warnIfServiceCodeMissing('GRT-75', grtRate, 'Graphic-design');
    }
    const designFee = designHours * grtRate;
    const rushFee = parseFloat(document.getElementById('rush-fee')?.value || 0);
    const discountAmount = parseFloat(document.getElementById('discount-amount')?.value || 0);
    const badge = document.getElementById('charges-badge');

    // Vellum + Color Change (Erik's official setup parts, 2026-06-27)
    const _xf = getScpExtraFees();
    const vellumTotalEl = document.getElementById('vellum-charge-total');
    if (vellumTotalEl) vellumTotalEl.textContent = _xf.vellumFee.toFixed(2);
    const colorChangeTotalEl = document.getElementById('color-change-charge-total');
    if (colorChangeTotalEl) colorChangeTotalEl.textContent = _xf.colorChangeFee.toFixed(2);

    const netCharges = artCharge + designFee + rushFee + _xf.vellumFee + _xf.colorChangeFee - discountAmount;
    if (netCharges !== 0) {
        badge.textContent = (netCharges >= 0 ? '+' : '') + '$' + netCharges.toFixed(2);
        badge.classList.remove('hidden');
        // Phase A: panel is collapsed by default — the first non-zero charge
        // (edit-load, draft restore) pops it open ONCE so fees never load hidden.
        if (typeof autoExpandFeesOnFirstCharge === 'function') autoExpandFeesOnFirstCharge();
    } else {
        badge.classList.add('hidden');
    }

    // Update fee table rows
    updateFeeTableRows();

    // Recalculate tax with new charges
    updateTaxCalculation();
}

export function updateDiscountType() {
    const discountType = document.getElementById('discount-type')?.value;
    const prefix = document.getElementById('discount-prefix');
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
        if (inputWrapper) inputWrapper.style.display = 'flex';
        if (presetDropdown) presetDropdown.style.display = 'none';
        if (prefix) prefix.textContent = '$';
    }

    updateAdditionalCharges();
}

// eslint-disable-next-line no-unused-vars -- dead in the monolith too (zero callers repo-wide, incl. generated markup); kept verbatim (S1b).
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
    updateFeeTableRows();
}

// eslint-disable-next-line no-unused-vars -- dead in the monolith too (zero callers repo-wide, incl. generated markup); kept verbatim (S1b).
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
    updateFeeTableRows();
}

// ============================================================
// ARTWORK SERVICES FUNCTIONS
// toggleArtworkServices(), toggleArtCharge(), updateArtworkCharges()
// moved to quote-builder-utils.js
// ============================================================

// Vellum + Color Change — Erik's official screen-print setup parts (2026-06-27).
// Prices come from Caspio Service_Codes via getServicePrice so a Caspio price
// change needs no deploy (Pricing=API rule). One source for the tax calc,
// fee-table rows, badge, and save path so they can't disagree.
export function getScpExtraFees() {
    const vellumQty = Math.max(0, parseInt(document.getElementById('vellum-qty')?.value || 0, 10) || 0);
    const vellumPrice = getServicePrice('Vellum', 10);
    const colorChangeQty = Math.max(0, parseInt(document.getElementById('color-change-qty')?.value || 0, 10) || 0);
    const colorChangePrice = getServicePrice('Color Chg', 15);
    return {
        vellumQty, vellumPrice, vellumFee: vellumQty * vellumPrice,
        colorChangeQty, colorChangePrice, colorChangeFee: colorChangeQty * colorChangePrice,
    };
}

export function updateFeeTableRows() {
    // Setup fee row (always shown for screen print)
    const setupFeeRow = document.getElementById('setup-fee-table-row');
    const setupScreensLabel = document.getElementById('setup-screens-label');
    const setupFeeUnit = document.getElementById('setup-fee-unit');
    const setupFeeTotal = document.getElementById('setup-fee-total');
    if (setupFeeRow && printConfig) {
        const screens = printConfig.totalScreens || 1;
        // Use the already-computed API-driven setup fee so the displayed row
        // (read back into discountableSubtotal) matches the charged value.
        const fee = (printConfig.setupFee != null) ? printConfig.setupFee : screens * SCREEN_FEE;
        // SPSU "Screen Print Set Up Charge" — per-screen price from Caspio (Pricing=API).
        const perScreen = getServicePrice('SPSU', SCREEN_FEE);
        const perEl = document.getElementById('setup-per-screen-label');
        if (perEl) perEl.textContent = '$' + (Number.isInteger(perScreen) ? perScreen : perScreen.toFixed(2));
        setupScreensLabel.textContent = screens + ' screen' + (screens > 1 ? 's' : '');
        setupFeeUnit.textContent = '$' + fee.toFixed(2);
        setupFeeTotal.textContent = '$' + fee.toFixed(2);
    }

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
    const designTotal = designHours * getServicePrice('GRT-75', 75);
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

    // Vellum + Color Change rows (Erik's official setup parts, 2026-06-27)
    const _xf = getScpExtraFees();
    const vellumRow = document.getElementById('vellum-fee-row');
    if (vellumRow) {
        if (_xf.vellumQty > 0) {
            vellumRow.style.display = 'table-row';
            const vql = document.getElementById('vellum-qty-label'); if (vql) vql.textContent = _xf.vellumQty;
            const vpl = document.getElementById('vellum-per-label'); if (vpl) vpl.textContent = '$' + (Number.isInteger(_xf.vellumPrice) ? _xf.vellumPrice : _xf.vellumPrice.toFixed(2));
            const vqc = document.getElementById('vellum-qty-cell'); if (vqc) vqc.textContent = _xf.vellumQty;
            const vu = document.getElementById('vellum-fee-unit'); if (vu) vu.textContent = '$' + _xf.vellumPrice.toFixed(2);
            const vt = document.getElementById('vellum-fee-total'); if (vt) vt.textContent = '$' + _xf.vellumFee.toFixed(2);
        } else {
            vellumRow.style.display = 'none';
        }
    }
    const colorChangeRow = document.getElementById('color-change-fee-row');
    if (colorChangeRow) {
        if (_xf.colorChangeQty > 0) {
            colorChangeRow.style.display = 'table-row';
            const cql = document.getElementById('color-change-qty-label'); if (cql) cql.textContent = _xf.colorChangeQty;
            const cpl = document.getElementById('color-change-per-label'); if (cpl) cpl.textContent = '$' + (Number.isInteger(_xf.colorChangePrice) ? _xf.colorChangePrice : _xf.colorChangePrice.toFixed(2));
            const cqc = document.getElementById('color-change-qty-cell'); if (cqc) cqc.textContent = _xf.colorChangeQty;
            const cu = document.getElementById('color-change-fee-unit'); if (cu) cu.textContent = '$' + _xf.colorChangePrice.toFixed(2);
            const ct = document.getElementById('color-change-fee-total'); if (ct) ct.textContent = '$' + _xf.colorChangeFee.toFixed(2);
        } else {
            colorChangeRow.style.display = 'none';
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
            // Calculate actual discount
            let actualDiscount = discountAmount;
            if (discountType === 'percent') {
                // Calculate discountable subtotal (products + additional services + setup fees)
                const productsSubtotal = parseFloat(document.getElementById('subtotal')?.textContent?.replace(/[$,]/g, '') || 0);
                const artCharge = document.getElementById('art-charge-toggle')?.checked
                    ? parseFloat(document.getElementById('art-charge')?.value || 0) : 0;
                const designFee = parseFloat(document.getElementById('graphic-design-hours')?.value || 0) * getServicePrice('GRT-75', 75);
                const rushFee = parseFloat(document.getElementById('rush-fee')?.value || 0);
                const setupFee = parseFloat(document.getElementById('setup-fee-total')?.textContent?.replace(/[$,]/g, '') || 0);
                const ltmFee = window.currentPricingData?.ltmFee || 0;

                const discountableSubtotal = productsSubtotal + artCharge + designFee + rushFee + setupFee + ltmFee
                    + _xf.vellumFee + _xf.colorChangeFee;
                actualDiscount = discountableSubtotal * (discountAmount / 100);
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
