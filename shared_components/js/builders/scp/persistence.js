/**
 * SCP draft-persistence + edit-load module — SCP decomposition S1a (2026-07-08).
 * Autosave wiring, draft snapshot/restore, edit/duplicate loading, prefill
 * appliers (Quick Quote + method switch), populate* builders, and resetQuote
 * (the Rule-7 reset checklist). Moved verbatim.
 */
// @ts-nocheck — MOVED legacy DOM code (pre-existing checkJs frictions; typing lands with the render/state split).
/* global QuotePersistence, QuoteSession, screenPrintPersistence, Event, history,
   addNewRow, collectProductsFromTable, createChildRow, onSizeChange, onStyleChange,
   selectColor, recalculatePricing, showScpPushButton, updateAdditionalCharges,
   updateDiscountType, updateFeeTableRows, updatePrintConfig, updateScpPushButtonState,
   escapeHtml, showToast, markAsSaved, markAsUnsaved, assertQuoteEditable,
   updateEditModeUI, setLtmControlState, getServicePrice, applyMethodSwitchCustomer,
   clearQuickQuoteParams, populateCustomerInfo, setOrderShippingData */
import { scpState } from './state.js';

export function initScreenPrintPersistence() {
    if (typeof QuotePersistence !== 'undefined') {
        scpState.spPersistence = new QuotePersistence({
            prefix: 'SPC',
            autoSaveInterval: 30000,
            debug: false
        });

        // Setup auto-save callback
        scpState.spPersistence.onAutoSave = () => {
            const data = getScreenPrintQuoteData();
            if (data && (data.products.length > 0 || data.customerName)) {
                scpState.spPersistence.save(data);
            }
        };
    }

    if (typeof QuoteSession !== 'undefined' && scpState.spPersistence) {
        scpState.spSession = new QuoteSession({
            prefix: 'SPC',
            persistence: scpState.spPersistence,
            debug: false
        });
    }
}

function getScreenPrintQuoteData() {
    return {
        products: collectProductsFromTable(),
        printConfig: { ...scpState.printConfig },
        customerName: document.getElementById('customer-name')?.value || '',
        customerEmail: document.getElementById('customer-email')?.value || '',
        companyName: document.getElementById('company-name')?.value || '',
        salesRep: document.getElementById('sales-rep')?.value || '',
        timestamp: Date.now()
    };
}

export function restoreScreenPrintDraft(draft) {
    if (!draft) return;


    // Restore customer info
    if (draft.customerName) {
        const nameEl = document.getElementById('customer-name');
        if (nameEl) nameEl.value = draft.customerName;
    }
    if (draft.customerEmail) {
        const emailEl = document.getElementById('customer-email');
        if (emailEl) emailEl.value = draft.customerEmail;
    }
    if (draft.companyName) {
        const companyEl = document.getElementById('company-name');
        if (companyEl) companyEl.value = draft.companyName;
    }
    if (draft.salesRep) {
        const salesRepEl = document.getElementById('sales-rep');
        if (salesRepEl) salesRepEl.value = draft.salesRep;
    }

    // Restore print configuration
    if (draft.printConfig) {
        // Restore front location
        const frontRadio = document.querySelector(`input[name="front-location"][value="${draft.printConfig.frontLocation}"]`);
        if (frontRadio) frontRadio.checked = true;

        // Restore front colors
        const frontColorsRadio = document.querySelector(`input[name="front-colors"][value="${draft.printConfig.frontColors}"]`);
        if (frontColorsRadio) frontColorsRadio.checked = true;

        // Restore back location
        const backRadio = document.querySelector(`input[name="back-location"][value="${draft.printConfig.backLocation || ''}"]`);
        if (backRadio) backRadio.checked = true;

        // Restore back colors
        if (draft.printConfig.backLocation) {
            const backColorsRadio = document.querySelector(`input[name="back-colors"][value="${draft.printConfig.backColors}"]`);
            if (backColorsRadio) backColorsRadio.checked = true;
        }

        // Restore sleeves (toggle + per-sleeve colors). Radios don't re-check from data alone — without
        // this an edit-reload silently drops sleeves and re-saves a cheaper quote (Rule 4).
        const draftLeftSleeve = draft.printConfig.leftSleeveColors || 0;
        const draftRightSleeve = draft.printConfig.rightSleeveColors || 0;
        const leftSleeveToggleEl = document.getElementById('left-sleeve-toggle');
        if (leftSleeveToggleEl) leftSleeveToggleEl.checked = draftLeftSleeve > 0;
        if (draftLeftSleeve > 0) {
            const lsRadio = document.querySelector(`input[name="left-sleeve-colors"][value="${draftLeftSleeve}"]`);
            if (lsRadio) lsRadio.checked = true;
        }
        const rightSleeveToggleEl = document.getElementById('right-sleeve-toggle');
        if (rightSleeveToggleEl) rightSleeveToggleEl.checked = draftRightSleeve > 0;
        if (draftRightSleeve > 0) {
            const rsRadio = document.querySelector(`input[name="right-sleeve-colors"][value="${draftRightSleeve}"]`);
            if (rsRadio) rsRadio.checked = true;
        }

        // Restore dark garment toggle
        const darkGarmentToggle = document.getElementById('dark-garment-toggle');
        if (darkGarmentToggle) darkGarmentToggle.checked = draft.printConfig.isDarkGarment || false;

        // Restore safety stripes toggle
        const safetyStripesToggle = document.getElementById('safety-stripes-toggle');
        if (safetyStripesToggle) safetyStripesToggle.checked = draft.printConfig.isSafetyStripes || false;

        // Update config state
        updatePrintConfig();
    }

    // Restore products
    if (draft.products && draft.products.length > 0) {
        // Clear any existing rows first
        const tbody = document.getElementById('product-tbody');
        if (tbody) tbody.innerHTML = '';

        draft.products.forEach(product => {
            // Add product row with saved data
            const rowId = addNewRow();
            const row = document.getElementById(`row-${rowId}`);
            if (!row) return;

            // Set product data
            row.dataset.style = product.style || '';
            row.dataset.catalogColor = product.catalogColor || '';
            row.dataset.colorName = product.color || '';
            row.dataset.description = product.description || '';
            row.dataset.imageUrl = product.imageUrl || '';

            // Update display cells
            const styleCell = row.querySelector('.cell-style');
            if (styleCell) styleCell.textContent = product.style || '';

            const descCell = row.querySelector('.cell-desc');
            if (descCell) descCell.textContent = product.description || '';

            const colorCell = row.querySelector('.cell-color');
            if (colorCell) {
                colorCell.innerHTML = `<span class="color-swatch" style="background: #ccc;"></span>${escapeHtml(product.color || '')}`;
            }

            // Restore size quantities
            if (product.sizes || product.sizeBreakdown) {
                const sizes = product.sizes || product.sizeBreakdown;
                let restoredAny = false;
                Object.entries(sizes).forEach(([size, qty]) => {
                    if (qty > 0) {
                        const sizeInput = row.querySelector(`input[data-size="${size}"]`);
                        if (sizeInput) {
                            sizeInput.value = qty;
                            restoredAny = true;
                        }
                    }
                });
                // Same handler a manual size edit fires: rebuilds row qty cell + 2XL child-row cascade
                if (restoredAny) onSizeChange(rowId);
            }
        });

        // Recalculate pricing after restoring products
        recalculatePricing();
    }

    showToast('Draft restored successfully', 'success');
    if (typeof window.renderOrderRecap === 'function') window.renderOrderRecap();  // [2026-06-08] draft carries company/name → show them in the band
}

export function markScreenPrintDirty() {
    if (scpState.spPersistence) {
        scpState.spPersistence.markDirty();
    }
}

// ============================================================
// EDIT MODE FUNCTIONS
// ============================================================

/**
 * Check URL for edit parameter
 * Returns quote ID if editing, null otherwise
 */
// checkForEditMode(), updateEditModeUI(), populateCustomerInfo() → moved to quote-builder-utils.js

/**
 * Populate additional charges from saved session (2026 fee refactor)
 */
function populateAdditionalCharges(session) {
    // Art charge
    const artChargeToggle = document.getElementById('art-charge-toggle');
    const artChargeInput = document.getElementById('art-charge');
    const artChargeWrapper = document.getElementById('art-charge-wrapper');
    if (session.ArtCharge > 0 && artChargeToggle && artChargeInput) {
        artChargeToggle.checked = true;
        artChargeInput.disabled = false;
        artChargeInput.value = session.ArtCharge;
        if (artChargeWrapper) artChargeWrapper.style.opacity = '1';
    }

    // Graphic design hours
    const designHoursInput = document.getElementById('graphic-design-hours');
    if (session.GraphicDesignHours > 0 && designHoursInput) {
        designHoursInput.value = session.GraphicDesignHours;
        // Update the calculated total display
        const designTotalEl = document.getElementById('graphic-design-total');
        if (designTotalEl) {
            designTotalEl.textContent = (session.GraphicDesignHours * getServicePrice('GRT-75', 75)).toFixed(2);
        }
    }

    // Rush fee
    const rushFeeInput = document.getElementById('rush-fee');
    if (session.RushFee > 0 && rushFeeInput) {
        rushFeeInput.value = session.RushFee;
    }

    // Screen-print setup parts (Erik's official list, 2026-06-27) — these live in
    // the Notes JSON (not session columns), so parse them out to restore the controls.
    let _scpNotes = {};
    try { _scpNotes = typeof session.Notes === 'string' ? JSON.parse(session.Notes || '{}') : (session.Notes || {}); } catch (_) { _scpNotes = {}; }
    const vellumQtyInput = document.getElementById('vellum-qty');
    if (vellumQtyInput && parseInt(_scpNotes.vellumQty, 10) > 0) {
        vellumQtyInput.value = parseInt(_scpNotes.vellumQty, 10);
    }
    const colorChangeQtyInput = document.getElementById('color-change-qty');
    if (colorChangeQtyInput && parseInt(_scpNotes.colorChangeQty, 10) > 0) {
        colorChangeQtyInput.value = parseInt(_scpNotes.colorChangeQty, 10);
    }

    // Discount
    const discountAmountInput = document.getElementById('discount-amount');
    const discountTypeSelect = document.getElementById('discount-type');
    const discountReasonInput = document.getElementById('discount-reason');
    const discountPreset = document.getElementById('discount-preset');
    if ((session.Discount > 0 || session.DiscountPercent > 0) && discountAmountInput) {
        if (session.DiscountPercent > 0) {
            if (discountTypeSelect) discountTypeSelect.value = 'percent';
            discountAmountInput.value = session.DiscountPercent;
            // Set preset dropdown based on value
            if (discountPreset) {
                const presetValues = ['5', '10', '15', '20', '25'];
                const percentStr = String(session.DiscountPercent);
                if (presetValues.includes(percentStr)) {
                    discountPreset.value = percentStr;
                } else {
                    discountPreset.value = 'custom';
                }
            }
        } else {
            if (discountTypeSelect) discountTypeSelect.value = 'fixed';
            discountAmountInput.value = session.Discount;
        }
        // Restore discount reason with preset detection
        if (session.DiscountReason) {
            const reasonPreset = document.getElementById('discount-reason-preset');
            if (reasonPreset && discountReasonInput) {
                const presetValues = Array.from(reasonPreset.options)
                    .map(opt => opt.value)
                    .filter(v => v !== 'custom');
                if (presetValues.includes(session.DiscountReason)) {
                    // Exact match to preset
                    reasonPreset.value = session.DiscountReason;
                    discountReasonInput.style.display = 'none';
                    discountReasonInput.value = session.DiscountReason;
                } else {
                    // Custom reason
                    reasonPreset.value = 'custom';
                    discountReasonInput.style.display = 'block';
                    discountReasonInput.value = session.DiscountReason;
                }
            }
        }
        // Update UI to show correct input/preset based on type
        if (typeof updateDiscountType === 'function') {
            updateDiscountType();
        }
        // If custom percentage, ensure input wrapper is visible
        if (session.DiscountPercent > 0 && discountPreset && discountPreset.value === 'custom') {
            const inputWrapper = document.getElementById('discount-input-wrapper');
            const prefix = document.getElementById('discount-prefix');
            if (inputWrapper) inputWrapper.style.display = 'flex';
            if (prefix) prefix.textContent = '%';
        }
    }

    // Update UI displays
    if (typeof updateAdditionalCharges === 'function') {
        updateAdditionalCharges();
    }
    if (typeof updateFeeTableRows === 'function') {
        updateFeeTableRows();
    }
}

/**
 * Populate print configuration from session Notes
 */
function populatePrintConfigFromSession(session) {
    try {
        const notes = JSON.parse(session.Notes || '{}');

        // Set front location
        if (notes.frontLocation) {
            const frontRadio = document.querySelector(`input[name="front-location"][value="${notes.frontLocation}"]`);
            if (frontRadio) frontRadio.checked = true;
        }

        // Set front colors
        if (notes.frontColors) {
            const frontColorsRadio = document.querySelector(`input[name="front-colors"][value="${notes.frontColors}"]`);
            if (frontColorsRadio) frontColorsRadio.checked = true;
        }

        // Set back location
        if (notes.backLocation) {
            const backRadio = document.querySelector(`input[name="back-location"][value="${notes.backLocation}"]`);
            if (backRadio) backRadio.checked = true;
        }

        // Set back colors
        if (notes.backColors) {
            const backColorsRadio = document.querySelector(`input[name="back-colors"][value="${notes.backColors}"]`);
            if (backColorsRadio) backColorsRadio.checked = true;
        }

        // Set sleeves (toggle + per-sleeve colors). Without this, edit-reload drops sleeves and
        // re-saves a cheaper quote (Rule 4).
        const noteLeftSleeve = notes.leftSleeveColors || 0;
        const noteRightSleeve = notes.rightSleeveColors || 0;
        if (noteLeftSleeve > 0) {
            const lst = document.getElementById('left-sleeve-toggle'); if (lst) lst.checked = true;
            const lsr = document.querySelector(`input[name="left-sleeve-colors"][value="${noteLeftSleeve}"]`);
            if (lsr) lsr.checked = true;
        }
        if (noteRightSleeve > 0) {
            const rst = document.getElementById('right-sleeve-toggle'); if (rst) rst.checked = true;
            const rsr = document.querySelector(`input[name="right-sleeve-colors"][value="${noteRightSleeve}"]`);
            if (rsr) rsr.checked = true;
        }

        // Set dark garment toggle
        if (notes.isDarkGarment) {
            document.getElementById('dark-garment-toggle').checked = true;
        }

        // Set safety stripes toggle
        if (notes.hasSafetyStripes) {
            document.getElementById('safety-stripes-toggle').checked = true;
        }

        // Trigger update to recalculate screens and fees
        updatePrintConfig();
    } catch (e) {
        console.warn('[EditMode] Could not parse print config from notes:', e);
    }
}

/**
 * Populate products from line items
 */
async function populateProducts(items) {
    // Filter to only screen print product items
    const productItems = items.filter(item =>
        item.EmbellishmentType === 'screenprint' &&
        item.StyleNumber
    );

    // Group items by StyleNumber + Color to consolidate size quantities
    const productGroups = {};
    for (const item of productItems) {
        const key = `${item.StyleNumber}|${item.Color}`;
        if (!productGroups[key]) {
            productGroups[key] = {
                styleNumber: item.StyleNumber,
                color: item.Color,
                productName: item.ProductName,
                imageUrl: item.ImageURL || '',
                sizeBreakdown: {}
            };
        }
        // Merge size breakdowns
        try {
            const sizes = JSON.parse(item.SizeBreakdown || '{}');
            for (const [size, qty] of Object.entries(sizes)) {
                productGroups[key].sizeBreakdown[size] =
                    (productGroups[key].sizeBreakdown[size] || 0) + qty;
            }
        } catch (e) {
            console.warn('[EditMode] Could not parse SizeBreakdown:', item.SizeBreakdown);
        }
    }

    // Add each product to the table
    for (const product of Object.values(productGroups)) {
        await addProductFromQuote(product);
    }
}

/**
 * Add a product row from loaded quote data
 */
export async function addProductFromQuote(product) {
    // Add new row — target it by the id addNewRow() mints, never the transient
    // `.new-row` highlight class (LESSONS 2026-07-06: first document-order match
    // can be an OLDER still-highlighted row when products load in a loop).
    const newRowId = addNewRow();
    const row = document.getElementById(`row-${newRowId}`);
    if (!row) return;

    const rowId = row.dataset.rowId;
    const styleInput = row.querySelector('.style-input');

    // Set style number and trigger product loading
    styleInput.value = product.styleNumber;
    await onStyleChange(styleInput, parseInt(rowId));

    // Small delay to let colors load
    await new Promise(resolve => setTimeout(resolve, 150));

    // Select the color
    const pickerDropdown = row.querySelector('.color-picker-dropdown');
    if (pickerDropdown) {
        const colorOption = pickerDropdown.querySelector(
            `[data-color-name="${product.color}"], [data-catalog-color="${product.color}"]`
        ) || Array.from(pickerDropdown.querySelectorAll('.color-option')).find(opt =>
            opt.textContent.includes(product.color)
        );
        if (colorOption) {
            selectColor(parseInt(rowId), colorOption);
        }
    }

    // Small delay for color selection to process
    await new Promise(resolve => setTimeout(resolve, 100));

    // Set size quantities (Batch 2.0, 2026-07-09 — the monolith's empty else silently
    // DROPPED every non-standard size here, so an edited quote re-saved without its
    // XS/XXL/3XL+/tall pieces; only the Quick-Quote path had grown the child-row fix.)
    const rowIdNum = parseInt(rowId);
    let touchedSizes = false;
    for (const [size, qty] of Object.entries(product.sizeBreakdown)) {
        if (qty > 0) {
            if (['S', 'M', 'L', 'XL', '2XL'].includes(size)) {
                const sizeInput = row.querySelector(`input[data-size="${size}"]`);
                if (sizeInput) {
                    sizeInput.value = qty;
                    sizeInput.dispatchEvent(new Event('change', { bubbles: true }));
                    touchedSizes = true;
                }
            } else if (size === 'XXL') {
                // XXL = ladies 2XL: shares the Size05 column but is a DISTINCT SanMar size
                // (~589 ladies styles use _XXL, never _2X) — the NAME must survive reload or
                // the push re-suffixes it _2X (wrong SKU). Create the named child FIRST, then
                // prime the parent 2XL input: onSizeChange updates an existing 2XL/XXL child
                // in place, but REMOVES it when the parent input reads 0.
                createChildRow(rowIdNum, 'XXL', qty);
                const parent2x = row.querySelector('input[data-size="2XL"]');
                if (parent2x) parent2x.value = qty;
                touchedSizes = true;
            } else {
                // Extended sizes (XS, 3XL+, talls): child rows — mirrors the Quick-Quote
                // fix (item #6, 2026-07-05), now shared by edit-load and method-switch too.
                createChildRow(rowIdNum, size, qty);
                touchedSizes = true;
            }
        }
    }
    if (touchedSizes) onSizeChange(rowIdNum);   // refresh qty display + recalculatePricing
}

/**
 * Quick Quote handoff (?from=quickquote — param schema + parser: getQuickQuotePrefill()
 * in quote-builder-utils.js). Routes through the SAME addProductFromQuote() path the
 * edit-loader uses, so color/size handling + pricing are identical to a hand-added row.
 * Extended sizes (XS, 3XL+, talls) get their child rows created here, because
 * addProductFromQuote() only fills the standard S–2XL parent inputs — without this,
 * Quick Quote pieces would be silently dropped. (item #6, 2026-07-05)
 */
/**
 * Mid-call method switch (expert audit 2026-07-07): fill the customer, then replay
 * every carried product through the SAME add path Quick Quote uses.
 */
export async function applyMethodSwitchPrefillScp(ms) {
    if (typeof applyMethodSwitchCustomer === 'function') applyMethodSwitchCustomer(ms.customer);
    let added = 0;
    for (const p of (ms.products || [])) {
        try {
            await applyQuickQuotePrefillScp({
                style: p.style, color: p.color, colorName: p.colorName,
                qty: 0, sizeBreakdown: p.sizeBreakdown || {}, location: ''
            });
            added++;
        } catch (e) {
            console.error('[MethodSwitch] product prefill failed', p.style, e);
            showToast(`Could not carry ${p.style} over — add it manually`, 'warning');
        }
    }
    showToast(`Switched from ${ms.fromLabel || 'another builder'} — customer + ${added} product${added === 1 ? '' : 's'} carried over. Set the print colors.`, 'success');
    try { history.replaceState(null, '', window.location.pathname); } catch (_) { }
}

export async function applyQuickQuotePrefillScp(qq) {
    try {
        await addProductFromQuote({
            styleNumber: qq.style,
            color: qq.color || qq.colorName,
            sizeBreakdown: qq.sizeBreakdown
        });
        // Extended/XXL child rows now come from addProductFromQuote itself (Batch 2.0) —
        // the loop that used to live here would double-create them.
        showToast('Loaded ' + qq.style + ' from Quick Quote — verify color, quantities & pricing', 'info', 6000);
    } catch (e) {
        console.error('[QuickQuote prefill] failed:', e);
        showToast('Could not prefill ' + qq.style + ' from Quick Quote — add it manually', 'warning', 6000);
    }
    if (typeof clearQuickQuoteParams === 'function') clearQuickQuoteParams();
}

/**
 * Load existing quote for editing
 * Populates all form fields with quote data.
 * Returns true on success so duplicateQuote() can bail on a failed load.
 */
export async function loadQuoteForEditing(quoteId, opts = {}) {
    showToast('Loading quote...', 'info');

    try {
        const result = await scpState.quoteService.loadQuote(quoteId);
        if (!result.success) {
            throw new Error(result.error || 'Failed to load quote');
        }

        const session = result.session;
        const items = result.items;

        // Phase 11.3.5 (Erik 2026-05-24): one-way SW sync — bail if the
        // quote is already in ShopWorks. assertQuoteEditable() alerts +
        // redirects to read-only quote-view.
        // EXCEPTION: duplicate mode never writes to the source quote, so locked/
        // pushed quotes (the classic reorder case) are fine to duplicate from.
        if (!opts.forDuplicate && typeof assertQuoteEditable === 'function' && !assertQuoteEditable(session)) {
            return false;
        }

        // Store edit mode state (duplicate mode clears it right after — see duplicateQuote)
        scpState.editingQuoteId = quoteId;
        scpState.editingRevision = session.RevisionNumber || 1;

        // Update page header to show edit mode (duplicate mode sets its own banner)
        if (!opts.forDuplicate) updateEditModeUI(quoteId, scpState.editingRevision);

        // Populate customer information
        populateCustomerInfo(session);

        // Populate additional charges (2026 fee refactor)
        populateAdditionalCharges(session);

        // Populate print configuration
        populatePrintConfigFromSession(session);

        // Populate products from line items
        await populateProducts(items);

        // Restore order & shipping fields from saved session
        setOrderShippingData('spc-order-fields', session);
        // [2026-06-08] P0 (#1 rule): restore the saved tax rate — setOrderShippingData does NOT touch #tax-rate-input,
        // so a reopened exempt/out-of-state quote (saved TaxRate 0) defaulted to 10.1% and re-taxed on Save Revision.
        var _savedRate = parseFloat(session.TaxRate);
        if (Number.isFinite(_savedRate)) { var _rateEl = document.getElementById('tax-rate-input'); if (_rateEl) _rateEl.value = _savedRate; }
        // [2026-06-08] restore the per-order wholesale flag + checkbox on edit-reload (mirror EMB)
        window._isWholesale = (session.IsWholesale === 'Yes' || session.IsWholesale === true || session.IsWholesale === 1);
        { var _wcb = document.getElementById('wholesale-checkbox'); if (_wcb) _wcb.checked = window._isWholesale; }
        if (window._isWholesale) { var _it = document.getElementById('include-tax'); if (_it) _it.checked = false; }
        // setOrderShippingData reads data.notes||data.Notes into .os-notes, but the SCP
        // session has NO flat `notes` — only the structured `Notes` JSON blob
        // (locations/colors/userNotes). So the raw JSON dumped into the notes textarea
        // and the rep's real note was lost (then re-nested into userNotes on re-save).
        // Extract just the human note. (2026-06-01)
        try {
            const _scpNotes = JSON.parse(session.Notes || '{}');
            const _noteEl = document.querySelector('#spc-order-fields .os-notes');
            if (_noteEl) _noteEl.value = _scpNotes.userNotes || '';
        } catch (_) { /* Notes wasn't JSON — leave whatever setOrderShippingData set */ }

        // Recalculate pricing to update totals
        recalculatePricing();

        // [2026-06-08] reflect the loaded customer + ship-to in the order-summary band (belt-and-suspenders vs the
        // recalc, which can short-circuit on zero qty)
        if (typeof window.renderOrderRecap === 'function') window.renderOrderRecap();

        // Record the loaded quote id + gate the always-visible Push button (parity with DTF's edit-load).
        // Duplicate mode: pushing the SOURCE id would re-order the original —
        // _scpPushQuoteId stays null until the new quote is saved (saveAndGetLink
        // calls showScpPushButton with the FRESH id).
        if (!opts.forDuplicate && typeof showScpPushButton === 'function') showScpPushButton(quoteId);

        if (!opts.forDuplicate) showToast(`Editing ${quoteId} (Rev ${scpState.editingRevision})`, 'success');

        return true;

    } catch (error) {
        console.error('[EditMode] Error loading quote:', error);
        showToast('Error loading quote: ' + error.message, 'error');
        // Clear edit mode and start fresh
        scpState.editingQuoteId = null;
        scpState.editingRevision = null;
        addNewRow();
        return false;
    }
}

/**
 * Duplicate an existing quote as a brand-new one (repeat orders — EMB/DTF parity 2026-07-05).
 * Loads through the REAL edit path — so the engine reprices everything from the
 * live API (last year's tee correctly becomes today's price) — then clears
 * all edit/push state so the next Save creates a NEW QuoteID. Works on
 * pushed/locked quotes too (the classic reorder case): the source is never written.
 */
export async function duplicateQuote(sourceQuoteId) {
    const loaded = await loadQuoteForEditing(sourceQuoteId, { forDuplicate: true });
    if (!loaded) return;   // load failed — error already shown

    // Clear edit/push state (mirrors the resetQuote checklist) so save → NEW quote
    scpState.editingQuoteId = null;
    scpState.editingRevision = null;
    scpState._scpPushQuoteId = null;   // belt-and-suspenders: never let a push target the SOURCE id
    if (typeof updateScpPushButtonState === 'function') { try { updateScpPushButtonState(); } catch (_) {} }

    // Order-specific fields must not carry over — order #/PO/dates belong to the ORIGINAL order
    ['.os-order-number', '.os-po-number', '.os-req-ship-date', '.os-drop-dead-date'].forEach(sel => {
        const el = document.querySelector('#spc-order-fields ' + sel);
        if (el) el.value = '';
    });

    // Duplicate banner (updateEditModeUI was suppressed in duplicate mode)
    const headerSubtitle = document.querySelector('.power-header .power-header-subtitle');
    if (headerSubtitle) {
        headerSubtitle.innerHTML = `<span class="qb-ok-icon">📋 Duplicated from ${escapeHtml(String(sourceQuoteId))} — saving creates a NEW quote at today's prices</span>`;
    }
    markAsUnsaved();
    showToast(`Duplicated ${sourceQuoteId} — prices refreshed to today's rates. Saving will create a new quote #.`, 'success', 7000);
}
// (window bridge moved to builders/scp/index.js)

// ============================================
// Unsaved Changes Tracking (UX Improvement)
// ============================================

// markAsUnsaved(), markAsSaved(), hasUnsavedChanges() → moved to quote-builder-utils.js

// ============================================
// New Quote Functionality (UX Improvement)
// ============================================

// confirmNewQuote() → moved to quote-builder-utils.js

// D3 split (2026-07-09): the DOM form-field resets moved VERBATIM out of
// resetQuote (state/edit/draft cleanup stays in the orchestrator).
function _resetScpFormFields() {
    // Reset customer form fields
    document.getElementById('customer-name').value = '';
    document.getElementById('customer-email').value = '';
    document.getElementById('company-name').value = '';
    const _cnReset = document.getElementById('customer-number');
    if (_cnReset) _cnReset.value = '';
    document.getElementById('customer-lookup').value = '';
    // Clear design # + uploaded-artwork widget so the prior quote's design link +
    // hosted logo/new-design name don't bleed into the next push. (2026-06-01)
    const _dnReset = document.getElementById('design-number');
    if (_dnReset) _dnReset.value = '';
    try { if (window._scpArtwork && typeof window._scpArtwork.clear === 'function') window._scpArtwork.clear(); } catch (_) {}
    try { if (window._scpDesignCombobox && typeof window._scpDesignCombobox.refresh === 'function') window._scpDesignCombobox.refresh(); } catch (_) {}

    // Reset order & shipping fields
    setOrderShippingData('spc-order-fields', {});
    // [2026-06-08] setOrderShippingData({}) is a NO-OP for BLANKING (the shared util's setter guards `if (el && val)`),
    // so explicitly clear the scoped .os-ship-* fields here — else the always-visible Ship-To card (Phase 3 band) would
    // re-render the PRIOR quote's address on a new quote. SCP-local; does NOT touch the shared util. (adversarial-review gap)
    ['.os-ship-address', '.os-ship-city', '.os-ship-zip', '.os-ship-method'].forEach(function (s) {
        var el = document.querySelector('#spc-order-fields ' + s);
        if (el) el.value = '';
    });
    var _shipStateReset = document.querySelector('#spc-order-fields .os-ship-state');
    if (_shipStateReset) _shipStateReset.value = 'WA';
    var _shipFeeReset = document.querySelector('#spc-order-fields .os-shipping-fee');
    if (_shipFeeReset) _shipFeeReset.value = '0';
    const taxRateReset = document.getElementById('tax-rate-input');
    if (taxRateReset) taxRateReset.value = '10.2';

    // Reset additional charges
    const rushFee = document.getElementById('rush-fee');
    const discountAmount = document.getElementById('discount-amount');
    const discountReason = document.getElementById('discount-reason');
    if (rushFee) rushFee.value = '';
    if (discountAmount) discountAmount.value = '';
    if (discountReason) discountReason.value = '';
    // Reset screen-print setup parts (Erik's official list, 2026-06-27)
    const vellumQtyReset = document.getElementById('vellum-qty');
    const colorChangeQtyReset = document.getElementById('color-change-qty');
    if (vellumQtyReset) vellumQtyReset.value = '';
    if (colorChangeQtyReset) colorChangeQtyReset.value = '';

    // Reset artwork services
    const artChargeToggle = document.getElementById('art-charge-toggle');
    const artCharge = document.getElementById('art-charge');
    const artChargeWrapper = document.getElementById('art-charge-wrapper');
    const graphicDesignHours = document.getElementById('graphic-design-hours');
    if (artChargeToggle) artChargeToggle.checked = false;
    if (artCharge) {
        artCharge.value = '0';
        artCharge.disabled = true;
    }
    if (artChargeWrapper) artChargeWrapper.style.opacity = '0.4';
    if (graphicDesignHours) graphicDesignHours.value = '';
}

export function resetQuote() {
    // Clear the "already pushed" lock + reset the Push button so the fresh quote is pushable. (review fix 2026-06-14)
    scpState._scpPushQuoteId = null;
    scpState._darkNudgeDismissed = false;   // re-arm the dark-garment underbase nudge for the next quote
    document.getElementById('dark-garment-nudge')?.remove();
    const _scpPush = document.getElementById('scp-push-shopworks-btn');
    if (_scpPush) {
        delete _scpPush.dataset.pushed;
        _scpPush.style.background = '';
        const _l = document.getElementById('scp-push-shopworks-label'); if (_l) _l.textContent = 'Push to ShopWorks';
    }
    if (typeof updateScpPushButtonState === 'function') updateScpPushButtonState();
    // Clear all product rows and re-add empty state
    const tbody = document.getElementById('product-tbody');
    tbody.innerHTML = `
        <tr id="empty-state-row">
            <td colspan="13" class="qb-empty-state">
                <div class="qb-empty-state-emoji">&#128085;</div>
                <div class="qb-empty-state-title">Enter a style number to get started</div>
                <div class="qb-note-13">Type a style # in the search bar above (e.g., PC54, G500, C112)</div>
            </td>
        </tr>
    `;

    // Reset row counter and product cache
    scpState.rowCounter = 0;
    scpState.products = [];
    scpState.productCache = {};
    scpState.childRowMap = {};

    // Reset print config to defaults
    scpState.printConfig = {
        frontLocation: 'LC',
        frontColors: 1,
        backLocation: '',
        backColors: 1,
        leftSleeveColors: 0,
        rightSleeveColors: 0,
        sleeveColorsList: [],
        isDarkGarment: false,
        isSafetyStripes: false,
        totalScreens: 1,
        setupFee: 30.00
    };

    // Reset LTM control panel
    setLtmControlState('spc-ltm-panel', { enabled: true, displayMode: 'builtin' });
    const ltmWrapperReset = document.getElementById('spc-ltm-wrapper');
    if (ltmWrapperReset) ltmWrapperReset.style.display = 'none';

    // Reset UI controls. NOTE: front-colors/back-colors are radio NAMES (no element
    // has id="front-colors"), so the old getElementById('front-colors').value threw a
    // TypeError that ABORTED the whole reset — leaving the prior customer, fees, and
    // tax rate in the next "New Quote" (wrong-customer/price risk). Select radios by
    // name, and use the real toggle ids (…-toggle). (2026-06-01)
    const frontLocLC = document.querySelector('input[name="front-location"][value="LC"]');
    if (frontLocLC) frontLocLC.checked = true;
    document.querySelectorAll('input[name="back-location"]').forEach(r => r.checked = false);
    const frontColors1 = document.querySelector('input[name="front-colors"][value="1"]');
    if (frontColors1) frontColors1.checked = true;
    const backColors1 = document.querySelector('input[name="back-colors"][value="1"]');
    if (backColors1) backColors1.checked = true;
    // Clear sleeves (toggles off + colors back to 1) so they don't bleed into the next quote
    ['left-sleeve-toggle', 'right-sleeve-toggle'].forEach(id => { const t = document.getElementById(id); if (t) t.checked = false; });
    ['left-sleeve-colors', 'right-sleeve-colors'].forEach(name => { const r = document.querySelector(`input[name="${name}"][value="1"]`); if (r) r.checked = true; });
    const darkGarmentToggle = document.getElementById('dark-garment-toggle');
    const safetyToggle = document.getElementById('safety-stripes-toggle');
    if (darkGarmentToggle) darkGarmentToggle.checked = false;
    if (safetyToggle) safetyToggle.checked = false;

    _resetScpFormFields();

    // Clear edit mode
    scpState.editingQuoteId = null;
    scpState.editingRevision = null;

    // Reset the edit/duplicate banner + strip ?edit=/?duplicate= from the URL so a
    // refresh after "New Quote" doesn't reload/re-duplicate the old quote (DTF parity 2026-07-05)
    const headerSubtitleReset = document.querySelector('.power-header .power-header-subtitle');
    if (headerSubtitleReset) headerSubtitleReset.textContent = 'Screen Printing';
    if (window.location.search.includes('edit=') || window.location.search.includes('duplicate=')) {
        try { history.replaceState(null, '', window.location.pathname); } catch (_) {}
    }

    // Clear draft storage
    if (typeof screenPrintPersistence !== 'undefined' && screenPrintPersistence) {
        screenPrintPersistence.clearDraft();
    }

    // Mark as saved (no unsaved changes)
    markAsSaved();

    // Refresh print config + sidebar totals for the now-empty quote. The original
    // code called updateGrandTotal() and updateScreenConfig() here — NEITHER function
    // exists, so both threw ReferenceError (previously masked by the front-colors
    // throw above). The real entry points are updatePrintConfig() + recalculatePricing(). (2026-06-01)
    updatePrintConfig();
    try { const _r = recalculatePricing(); if (_r && typeof _r.catch === 'function') _r.catch(() => {}); } catch (_) {}

    // [2026-06-08] P0: clear tax-exempt/wholesale flags on New Quote (else they bleed into the next quote)
    window._taxExempt = false; window._isWholesale = false; { const _wcb = document.getElementById('wholesale-checkbox'); if (_wcb) _wcb.checked = false; const _it = document.getElementById('include-tax'); if (_it) _it.checked = true; }  // [2026-06-08] P0: re-check include-tax on New Quote (else next quote after a wholesale/exempt one bills $0 tax)
    { const _r = document.getElementById('ship-residential'); if (_r) _r.checked = false; const _er = document.getElementById('estimate-ship-result'); if (_er) _er.innerHTML = ''; window._lastShipEstimate = null; }  // [2026-06-08] clear estimator state on New Quote (residential flag + result text + last estimate shouldn't bleed)
    // [2026-06-08] clear the order-summary band on Reset / New Quote (recalc may short-circuit on the empty quote)
    if (typeof window.renderOrderRecap === 'function') window.renderOrderRecap();

    // Focus search bar for immediate typing
    const searchInput = document.getElementById('product-search');
    if (searchInput) {
        searchInput.focus();
    }

    showToast('Started new quote', 'success');
}
