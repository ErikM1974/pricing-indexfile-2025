/**
 * EMB draft-persistence + edit-load module — roadmap 0.4 extraction #4 (2026-07-07).
 *
 * Autosave wiring (initEmbroideryPersistence → QuotePersistence/QuoteSession),
 * draft snapshot/restore (getEmbroideryQuoteData / restoreEmbroideryDraft /
 * restoreDraftProducts), edit-mode loading (loadQuoteForEditing + populate*
 * builders for customer/logo/products/charges), and duplicateQuote (the QM
 * ?duplicate= flow).
 *
 * Moved verbatim from embroidery-quote-builder.js (~1,195-line contiguous
 * cluster, everything between the Service_Codes seam and the DOMContentLoaded
 * init listener). Imports design-search helpers directly; all other seams are
 * monolith globals reached through the global scope chain (they migrate with
 * their own clusters — see emb-decomposition-plan.md).
 */
// @ts-nocheck — MOVED legacy DOM code: pre-existing checkJs frictions; typing
// lands with this cluster's render/state split (see emb-decomposition-plan.md).
/* global
   updatePushButtonState, escapeHtml, showToast,
   QuotePersistence, QuoteSession, getLtmControlState, setLtmControlState,
   assertQuoteEditable, updateEditModeUI, setQuoteDateDefaults, markAsUnsaved,
   updateArtworkCharges, Event */
import { applyDesignFromCache, showDesignThumbnail, lookupDesignNumber } from './design-search.js';
import { collectProductsFromTable, onShipMethodChange, recalculatePricing, updateTaxCalculation } from './pricing-sync.js';
import { updateAdditionalCharges, updateDiscountType } from './quote-lifecycle.js';
import { _syncALArrays, handleCapEmbellishmentChange, mapStitchCountToTierValue, updateNotesBadge } from './logo-config.js';
import { addManualServiceRow, addNewRow, createChildRow, createServiceProductRow, dateFromInputValue, dateToInputValue, onSizeChange, onStyleChange, selectColor, updateCapLogoSectionVisibility, updateGarmentLogoSectionVisibility, updateLogoCardHeader } from './product-rows.js';
import { embState, EMB_DEFAULTS, SIZE06_EXTENDED_SIZES, API_BASE } from './state.js';

export function initEmbroideryPersistence() {
    if (typeof QuotePersistence !== 'undefined') {
        embState.embPersistence = new QuotePersistence({
            prefix: 'EMB',
            autoSaveInterval: 30000,
            debug: false
        });

        // Setup auto-save callback
        embState.embPersistence.onAutoSave = () => {
            const data = getEmbroideryQuoteData();
            if (data && (data.products.length > 0 || data.customerName)) {
                embState.embPersistence.save(data);
            }
        };
    }

    if (typeof QuoteSession !== 'undefined' && embState.embPersistence) {
        embState.embSession = new QuoteSession({
            prefix: 'EMB',
            persistence: embState.embPersistence,
            debug: false
        });
    }
}

export function getEmbroideryQuoteData() {
    return {
        products: collectProductsFromTable(),
        primaryLogo: { ...embState.primaryLogo },
        capPrimaryLogo: typeof embState.capPrimaryLogo !== 'undefined' ? { ...embState.capPrimaryLogo } : null,
        garmentAL: {
            enabled: embState.globalAL.garment.enabled,
            position: 'AL',
            stitches: embState.globalAL.garment.stitchCount,
            needsDigitizing: embState.globalAL.garment.needsDigitizing
        },
        capAL: {
            enabled: embState.globalAL.cap.enabled,
            position: 'AL-Cap',
            stitches: embState.globalAL.cap.stitchCount,
            needsDigitizing: embState.globalAL.cap.needsDigitizing
        },
        customerName: document.getElementById('customer-name')?.value || '',
        customerEmail: document.getElementById('customer-email')?.value || '',
        companyName: document.getElementById('company-name')?.value || '',
        salesRep: document.getElementById('sales-rep')?.value || '',
        notes: document.getElementById('notes')?.value || '',
        ltmEnabled: getLtmControlState('emb-ltm-panel').enabled,
        ltmDisplayMode: getLtmControlState('emb-ltm-panel').displayMode || 'builtin',
        taxRate: document.getElementById('tax-rate-input')?.value || '10.2',
        includeTax: document.getElementById('include-tax')?.checked ?? true,
        shippingFee: document.getElementById('shipping-fee')?.value || '0',
        shipAddress: document.getElementById('ship-address')?.value || '',
        shipCity: document.getElementById('ship-city')?.value || '',
        shipState: document.getElementById('ship-state')?.value || 'WA',
        shipZip: document.getElementById('ship-zip')?.value || '',
        // Order details
        customerPhone: document.getElementById('customer-phone')?.value || '',
        poNumber: document.getElementById('po-number')?.value || '',
        orderNumber: document.getElementById('order-number')?.value || '',
        customerNumber: document.getElementById('customer-number')?.value || '',
        shipMethod: document.getElementById('ship-method')?.value || '',
        shipMethodOther: document.getElementById('ship-method-other')?.value || '',
        dateOrderPlaced: dateFromInputValue(document.getElementById('date-order-placed')?.value),
        reqShipDate: dateFromInputValue(document.getElementById('req-ship-date')?.value),
        dropDeadDate: dateFromInputValue(document.getElementById('drop-dead-date')?.value),
        paymentTerms: document.getElementById('payment-terms')?.value || '',
        // Cached design data for instant restore (no API call needed)
        garmentDesignData: embState.primaryLogo._designData || null,
        capDesignData: (typeof embState.capPrimaryLogo !== 'undefined' && embState.capPrimaryLogo._designData) ? embState.capPrimaryLogo._designData : null,
        timestamp: Date.now()
    };
}

export function restoreEmbroideryDraft(draft) {
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
    if (draft.notes) {
        const notesEl = document.getElementById('notes');
        if (notesEl) {
            notesEl.value = draft.notes;
            // Show the notes section
            const section = document.getElementById('notes-section');
            if (section && section.classList.contains('collapsed')) {
                section.classList.remove('collapsed');
                const body = section.querySelector('.notes-body');
                const icon = section.querySelector('.notes-toggle-icon');
                if (body) body.style.display = 'block';
                if (icon) icon.style.transform = 'rotate(180deg)';
            }
            updateNotesBadge();
        }
    }

    // Restore primary logo configuration
    if (draft.primaryLogo) {
        embState.primaryLogo = { ...embState.primaryLogo, ...draft.primaryLogo };
        const positionEl = document.getElementById('primary-position');
        if (positionEl) positionEl.value = draft.primaryLogo.position || 'Left Chest';
        const stitchesEl = document.getElementById('primary-stitches');
        if (stitchesEl) stitchesEl.value = mapStitchCountToTierValue(
            draft.primaryLogo.stitchCount || 8000,
            draft.primaryLogo.position
        );
        const digitizingEl = document.getElementById('primary-digitizing');
        if (digitizingEl) digitizingEl.checked = draft.primaryLogo.needsDigitizing || false;
        // Sync position dropdown disabled state and FB stitch input for Full Back
        if (draft.primaryLogo.position === 'Full Back') {
            const posEl = document.getElementById('primary-position');
            if (posEl) posEl.disabled = true;
            const fbField = document.getElementById('fb-stitch-count-field');
            const fbInput = document.getElementById('fb-stitch-count');
            if (fbField) fbField.style.display = '';
            if (fbInput) fbInput.value = draft.primaryLogo.stitchCount || 25000;
        }
        // Restore design number label on card header + input field
        if (draft.primaryLogo.designNumber) {
            updateLogoCardHeader('garment', draft.primaryLogo.designNumber);
            const gDesignInput = document.getElementById('garment-design-number');
            if (gDesignInput) gDesignInput.value = draft.primaryLogo.designNumber;
            const gClearBtn = document.getElementById('garment-design-clear');
            if (gClearBtn) gClearBtn.style.display = 'inline-flex';
            // Use cached design data if available (no API call), fallback to lookup
            if (draft.garmentDesignData) {
                applyDesignFromCache('garment', draft.garmentDesignData);
            } else {
                if (draft.primaryLogo.thumbnailUrl) {
                    showDesignThumbnail('garment', draft.primaryLogo.thumbnailUrl);
                }
                lookupDesignNumber('garment');
            }
        }
    }

    // Restore cap primary logo if present
    if (draft.capPrimaryLogo && typeof embState.capPrimaryLogo !== 'undefined') {
        embState.capPrimaryLogo = { ...embState.capPrimaryLogo, ...draft.capPrimaryLogo };
        const capStitchesEl = document.getElementById('cap-primary-stitches');
        if (capStitchesEl) capStitchesEl.value = mapStitchCountToTierValue(
            draft.capPrimaryLogo.stitchCount || 8000,
            'CF'
        );
        const capDigitizingEl = document.getElementById('cap-primary-digitizing');
        if (capDigitizingEl) capDigitizingEl.checked = draft.capPrimaryLogo.needsDigitizing || false;
        // Restore design number label on card header + input field
        if (draft.capPrimaryLogo.designNumber) {
            updateLogoCardHeader('cap', draft.capPrimaryLogo.designNumber);
            const cDesignInput = document.getElementById('cap-design-number');
            if (cDesignInput) cDesignInput.value = draft.capPrimaryLogo.designNumber;
            const cClearBtn = document.getElementById('cap-design-clear');
            if (cClearBtn) cClearBtn.style.display = 'inline-flex';
            // Use cached design data if available (no API call), fallback to lookup
            if (draft.capDesignData) {
                applyDesignFromCache('cap', draft.capDesignData);
            } else {
                if (draft.capPrimaryLogo.thumbnailUrl) {
                    showDesignThumbnail('cap', draft.capPrimaryLogo.thumbnailUrl);
                }
                lookupDesignNumber('cap');
            }
        }
    }

    // Restore LTM override state
    if (draft.ltmEnabled === false || draft.ltmDisplayMode) {
        setLtmControlState('emb-ltm-panel', {
            enabled: draft.ltmEnabled !== false,
            displayMode: draft.ltmDisplayMode || 'builtin'
        });
    }

    // Restore tax rate and shipping
    if (draft.taxRate) {
        const rateInput = document.getElementById('tax-rate-input');
        if (rateInput) rateInput.value = draft.taxRate;
    }
    if (draft.includeTax === false) {
        document.getElementById('include-tax').checked = false;
    }
    if (draft.shippingFee && parseFloat(draft.shippingFee) > 0) {
        document.getElementById('shipping-fee').value = draft.shippingFee;
    }

    // Restore Ship To address
    if (draft.shipAddress) document.getElementById('ship-address').value = draft.shipAddress;
    if (draft.shipCity) document.getElementById('ship-city').value = draft.shipCity;
    if (draft.shipState) document.getElementById('ship-state').value = draft.shipState;
    if (draft.shipZip) document.getElementById('ship-zip').value = draft.shipZip;

    // Restore order details
    if (draft.customerPhone) document.getElementById('customer-phone').value = draft.customerPhone;
    if (draft.poNumber) document.getElementById('po-number').value = draft.poNumber;
    if (draft.orderNumber) document.getElementById('order-number').value = draft.orderNumber;
    if (draft.customerNumber) document.getElementById('customer-number').value = draft.customerNumber;
    if (draft.shipMethod) {
        document.getElementById('ship-method').value = draft.shipMethod;
        if (draft.shipMethod === 'Other' && draft.shipMethodOther) {
            document.getElementById('ship-method-other').value = draft.shipMethodOther;
        }
        onShipMethodChange();
    }
    if (draft.dateOrderPlaced) document.getElementById('date-order-placed').value = dateToInputValue(draft.dateOrderPlaced);
    if (draft.reqShipDate) document.getElementById('req-ship-date').value = dateToInputValue(draft.reqShipDate);
    if (draft.dropDeadDate) document.getElementById('drop-dead-date').value = dateToInputValue(draft.dropDeadDate);
    if (draft.paymentTerms) document.getElementById('payment-terms').value = draft.paymentTerms;
    // Auto-expand Order Details panel if any field restored
    if (draft.poNumber || draft.orderNumber || draft.shipMethod ||
        draft.dateOrderPlaced || draft.reqShipDate || draft.dropDeadDate || draft.paymentTerms) {
        const odContent = document.getElementById('order-details-content');
        const odChevron = document.getElementById('order-details-chevron');
        if (odContent) odContent.style.display = 'block';
        if (odChevron) odChevron.style.transform = 'rotate(180deg)';
    }

    updateTaxCalculation();

    // Restore garment AL configuration
    if (draft.garmentAL && draft.garmentAL.enabled) {
        embState.globalAL.garment.enabled = true;
        embState.globalAL.garment.position = 'AL';
        embState.globalAL.garment.stitchCount = parseInt(draft.garmentAL.stitches) || 8000;
        embState.globalAL.garment.needsDigitizing = draft.garmentAL.needsDigitizing || false;

        // Update UI toggle
        const garmentALSwitch = document.getElementById('garment-al-switch');
        const garmentALLabel = document.getElementById('garment-al-label');
        const garmentALConfig = document.getElementById('garment-al-config-new');
        const garmentALToggle = document.getElementById('garment-al-toggle');
        if (garmentALSwitch) garmentALSwitch.classList.add('active');
        if (garmentALLabel) garmentALLabel.classList.add('active');
        if (garmentALConfig) garmentALConfig.classList.add('visible');
        if (garmentALToggle) garmentALToggle.checked = true;

        const digitizingEl = document.getElementById('garment-al-digitizing-checkbox');
        if (digitizingEl) digitizingEl.checked = embState.globalAL.garment.needsDigitizing;
    }

    // Restore cap AL configuration
    if (draft.capAL && draft.capAL.enabled) {
        embState.globalAL.cap.enabled = true;
        embState.globalAL.cap.position = 'AL-Cap';
        embState.globalAL.cap.stitchCount = parseInt(draft.capAL.stitches) || 5000;
        embState.globalAL.cap.needsDigitizing = draft.capAL.needsDigitizing || false;

        // Update UI toggle
        const capALSwitch = document.getElementById('cap-al-switch');
        const capALLabel = document.getElementById('cap-al-label');
        const capALConfig = document.getElementById('cap-al-config-new');
        const capALToggle = document.getElementById('cap-al-toggle');
        if (capALSwitch) capALSwitch.classList.add('active');
        if (capALLabel) capALLabel.classList.add('active');
        if (capALConfig) capALConfig.classList.add('visible');
        if (capALToggle) capALToggle.checked = true;

        const digitizingEl = document.getElementById('cap-al-digitizing-checkbox');
        if (digitizingEl) digitizingEl.checked = embState.globalAL.cap.needsDigitizing;
    }

    _syncALArrays();

    // Restore products through the REAL add path (style lookup → color select →
    // size/child-row plumbing). The old hand-rolled restore read addNewRow()'s
    // return value before it returned anything, so EVERY product silently failed
    // to restore while the toast still said success. (audit 2026-06-10)
    restoreDraftProducts(draft);
}

async function restoreDraftProducts(draft) {
    const draftProducts = (draft && draft.products) || [];
    if (draftProducts.length === 0) {
        showToast('Draft restored successfully', 'success');
        return;
    }

    // Clear any existing rows first
    const tbody = document.getElementById('product-tbody');
    if (tbody) tbody.innerHTML = '';

    let restored = 0;
    for (const product of draftProducts) {
        if (!product || !product.style) continue;
        try {
            await addProductFromQuote({
                styleNumber: product.style,
                color: product.color || product.catalogColor || '',
                sizeBreakdown: product.sizes || product.sizeBreakdown || {},
                priceOverride: parseFloat(product.priceOverride) || 0,
                sizeOverrides: product.sizeOverrides || {}
            });
            restored++;
        } catch (e) {
            console.error('[Draft] Failed to restore product:', product.style, e);
        }
    }

    // Check for caps/garments to show appropriate logo sections
    updateCapLogoSectionVisibility();
    updateGarmentLogoSectionVisibility();

    // Recalculate pricing after restoring products
    recalculatePricing();

    if (restored === draftProducts.length) {
        showToast(`Draft restored — ${restored} product${restored === 1 ? '' : 's'} recovered`, 'success');
    } else {
        showToast(`Draft partially restored: ${restored} of ${draftProducts.length} products recovered — re-add the missing ones.`, 'warning', 8000);
    }
}

export function markEmbroideryDirty() {
    if (embState.embPersistence) {
        embState.embPersistence.markDirty();
    }
}

// ============================================================
// EDIT MODE (Quote Revisions)
// ============================================================

/**
 * Check URL for edit parameter
 * Returns quote ID if editing, null otherwise
 */
// checkForEditMode() → moved to quote-builder-utils.js

/**
 * Load existing quote for editing
 * Populates all form fields with quote data
 */
export async function loadQuoteForEditing(quoteId, opts = {}) {
    showToast('Loading quote...', 'info');
    // P0 guard (audit 2026-06-06): a pickup quote's restore re-fires the live Milton tax lookup async;
    // block lookupTaxRate() for the whole restore so it can't overwrite the saved rate. finally re-enables.
     
    window._restoringQuote = true;

    try {
        const result = await embState.quoteService.loadQuote(quoteId);
        if (!result.success) {
            throw new Error(result.error || 'Failed to load quote');
        }

        const session = result.session;
        const items = result.items;

        // Phase 11.3.5 (Erik 2026-05-24): one-way SW sync — bail if the quote
        // is already in ShopWorks. assertQuoteEditable() alerts the rep and
        // redirects to read-only quote-view.
        // EXCEPTION: duplicate mode never writes to the source quote, so locked/
        // pushed quotes (the classic reorder case) are fine to duplicate from.
        if (!opts.forDuplicate && typeof assertQuoteEditable === 'function' && !assertQuoteEditable(session)) {
            return;
        }

        // Store edit mode state
        embState.editingQuoteId = quoteId;
        embState.editingRevision = session.RevisionNumber || 1;

        // Update page header to show edit mode (duplicate mode sets its own banner)
        if (!opts.forDuplicate) updateEditModeUI(quoteId, embState.editingRevision);

        // Populate customer information
        populateCustomerInfo(session);

        // Restore the ORDER / SHIPPING / CUSTOMER-# block. populateCustomerInfo only
        // restores name/email/company/sales-rep/notes — so on edit-reopen the customer #,
        // PO #, full ship-to address, ship method, phone, order #, and dates all loaded
        // BLANK and were then WIPED on Save Revision (updateQuote writes '' for them),
        // and a subsequent Push to ShopWorks attached the order to fallback customer
        // 3739 with no ship-to address. Restore them from the saved session. (2026-06-01)
        (function restoreEmbOrderShipping() {
            const setVal = (id, v) => { const el = document.getElementById(id); if (el && v != null && v !== '') el.value = v; };
            // [2026-06-07] EMB date inputs are now native <input type=date> (YYYY-MM-DD); the column is stored ISO.
            const isoToInput = (v) => dateToInputValue(v);
            setVal('customer-number', session.CustomerNumber);
            setVal('project-name', session.ProjectName);   // P2-5 (audit 2026-06-06): restore Project Name on edit-reload
            setVal('customer-phone', session.Phone);
            setVal('order-number', session.OrderNumber);
            setVal('po-number', session.PurchaseOrderNumber);
            setVal('ship-address', session.ShipToAddress);
            setVal('ship-city', session.ShipToCity);
            setVal('ship-state', session.ShipToState);
            setVal('ship-zip', session.ShipToZip);
            setVal('payment-terms', session.PaymentTerms);
            setVal('date-order-placed', isoToInput(session.DateOrderPlaced));
            setVal('req-ship-date', isoToInput(session.ReqShipDate));
            setVal('drop-dead-date', isoToInput(session.DropDeadDate));
            // Ship method: the SAVE collapses an "Other" selection into the custom text,
            // so a stored value not in the <select> options IS an "Other" method. A bare
            // setVal would set selectedIndex=-1 (value '') -> the custom method displays
            // blank and gets WIPED on the next Save Revision. Detect + restore properly.
            const smEl = document.getElementById('ship-method');
            const sm = session.ShipMethod || '';
            if (smEl) {
                const known = Array.from(smEl.options).map(o => o.value);
                if (sm && known.indexOf(sm) === -1) {
                    smEl.value = 'Other';
                    const other = document.getElementById('ship-method-other');
                    if (other) other.value = sm;
                } else if (sm) {
                    smEl.value = sm;
                }
                // A programmatic .value change doesn't fire onchange — call the handler so
                // the conditional UI (pickup notice / Other text / address visibility)
                // matches the restored method.
                if (typeof onShipMethodChange === 'function') { try { onShipMethodChange(); } catch (_) {} }
            }
            // Expand the (default-collapsed) Order Details panel so the restored data is
            // visible — a collapsed header reads as "no data" and risks re-entry/blanking.
            if (session.CustomerNumber || session.PurchaseOrderNumber || session.OrderNumber || sm || session.ShipToAddress || session.ReqShipDate) {
                const c = document.getElementById('order-details-content');
                if (c) c.style.display = 'block';
                const ch = document.getElementById('order-details-chevron');
                if (ch) ch.style.transform = 'rotate(180deg)';
            }
            if (typeof updatePushButtonState === 'function') { try { updatePushButtonState(); } catch (_) {} }
        })();

        // Populate logo configuration
        populateLogoConfig(session, items);

        // Restore the rich-mode ARTWORK upload (files + design name) from ImportNotes. Without
        // this, reopening a quote shows an EMPTY widget, and the next Save Revision overwrites
        // ImportNotes with empty referenceArtwork/newDesignName → the uploaded art + design name
        // are PERMANENTLY wiped and a later push emits "NO DESIGN LINKED" for a job that had art.
        // (2026-06-04 audit B5)
        (function restoreEmbArtwork() {
            if (!window._embArtwork || !session.ImportNotes) return;
            try {
                const parsed = JSON.parse(session.ImportNotes);
                const art = Array.isArray(parsed.referenceArtwork) ? parsed.referenceArtwork : [];
                if (art.length && typeof window._embArtwork.setFiles === 'function') window._embArtwork.setFiles(art);
                if (parsed.newDesignName && typeof window._embArtwork.setDesignName === 'function') window._embArtwork.setDesignName(parsed.newDesignName);
            } catch (_) { /* legacy flat-array ImportNotes → no artwork object to restore */ }
        })();

        // Reconstruct lastImportMetadata from the saved session. The save path reads
        // designNumbers/digitizingFees/paidToDate/orderNotes/carrier/tracking/SW-audit
        // exclusively from lastImportMetadata — which is null after a reload — so a
        // Save Revision on an imported quote silently WIPED DesignNumbers, PaidToDate,
        // Carrier/TrackingNumber, OrderNotes, the SW price audit, and DELETED the
        // DGT/DDE/DDT digitizing fee items (they're only written from
        // parsedServices.digitizingFees). Rebuild it from what was persisted. (audit 2026-06-10)
        (function restoreImportMetadata() {
            let designNumbers = [];
            try { designNumbers = JSON.parse(session.DesignNumbers || '[]'); } catch (_) { /* legacy */ }
            const digitizingCodes = (session.DigitizingCodes || '').split(',').map(s => s.trim()).filter(Boolean);
            // Non-DD digitizing fee items only exist in the DB — recover them from the loaded items
            const DGT_CODES = /^(DGT-\d+|DDE|DDT)$/i;
            const digitizingFees = (items || [])
                .filter(it => it.EmbellishmentType === 'fee' && DGT_CODES.test(it.StyleNumber || ''))
                .map(it => ({ code: it.StyleNumber, description: it.ProductName, amount: parseFloat(it.BaseUnitPrice) || 0 }));
            // Saved ImportNotes round-trip back into warnings[] so the next save re-persists them.
            let savedNotes = [];
            try {
                const parsedIN = JSON.parse(session.ImportNotes || '[]');
                savedNotes = Array.isArray(parsedIN) ? parsedIN : (Array.isArray(parsedIN.importNotes) ? parsedIN.importNotes : []);
            } catch (_) { /* not JSON */ }
            const hasImportData = designNumbers.length || digitizingCodes.length || digitizingFees.length
                || parseFloat(session.PaidToDate) > 0 || session.OrderNotes || session.Carrier
                || session.TrackingNumber || parseFloat(session.SWTotal) > 0 || savedNotes.length;
            if (!hasImportData) return;   // nothing imported — keep null (save writes defaults)
            embState.lastImportMetadata = {
                designNumbers,
                digitizingCodes,
                parsedServices: { digitizingFees },
                warnings: savedNotes,
                unmatchedLines: [],
                reviewItems: [],
                paidToDate: parseFloat(session.PaidToDate) || 0,
                balanceAmount: parseFloat(session.BalanceAmount) || 0,
                orderNotes: session.OrderNotes || '',
                carrier: session.Carrier || '',
                trackingNumber: session.TrackingNumber || '',
                swTotal: parseFloat(session.SWTotal) || 0,
                swSubtotal: parseFloat(session.SWSubtotal) || 0,
                priceAuditJSONSnapshot: session.PriceAuditJSON || '',
                restoredFromSession: true   // marks reconstruction (not a fresh paste-import)
            };
        })();

        // Populate products from line items
        await populateProducts(items);

        // Populate additional charges
        populateAdditionalCharges(session);

        // Restore Services-bar fees (GRT-50 / GRT-75 / DD / RUSH) that were added as standalone
        // LINE ITEMS. They save as 'fee' quote_items but are NOT in SERVICE_STYLE_NUMBERS, so
        // populateProducts drops them → silent UNDER-CHARGE on reload (and Save Revision then
        // permanently deletes them). Restore ONLY the BAR-origin ones: the SIDEBAR inputs
        // (art-charge→GRT-50, graphic-design-hours→GRT-75, digitizing checkbox→DD, rush-fee→RUSH)
        // recompute from their saved SESSION field, so a non-zero session field means
        // "sidebar origin — already handled, don't add a duplicate row". RUSH self-prices (25% of
        // subtotal in syncRushRow); the others take their saved unit price. (cert audit 2026-06-04)
        (function restoreBarFees() {
            if (typeof addManualServiceRow !== 'function') return;
            const sidebarField = {
                'GRT-50': parseFloat(session.ArtCharge) || 0,
                'GRT-75': parseFloat(session.GraphicDesignHours) || 0,
                'DD': (parseFloat(session.DigitizingFee) || 0) + (parseFloat(session.CapDigitizingFee) || 0),
                'RUSH': parseFloat(session.RushFee) || 0
            };
            (items || []).forEach(it => {
                if (it.EmbellishmentType !== 'fee') return;
                const sn = it.StyleNumber;
                if (!(sn in sidebarField)) return;        // not a bar-fee code
                if (sidebarField[sn] > 0) return;         // sidebar origin → recomputed elsewhere
                addManualServiceRow(sn, sn === 'RUSH' ? undefined : (it.BaseUnitPrice || it.FinalUnitPrice || 0));
            });
        })();

        // Restore tax rate and shipping from fee items.
        // session.TaxRate (decimal, the frozen rate-of-record) wins; the TAX item's
        // BaseUnitPrice (percent) is the legacy source. 0 is a VALID rate — the old
        // `|| 10.1` restored WA tax onto out-of-state quotes saved at 0%, and the
        // next Save Revision baked it in.
        const taxFeeItem = items.find(i => i.EmbellishmentType === 'fee' && i.StyleNumber === 'TAX');
        if (taxFeeItem) {
            const rateInput = document.getElementById('tax-rate-input');
            if (rateInput) {
                const sessionRate = parseFloat(session.TaxRate);
                const itemRate = parseFloat(taxFeeItem.BaseUnitPrice);
                // EMB stores TaxRate as a decimal (0.101), but normalize a percent-shaped
                // legacy value (>1) instead of restoring "1010" into the input.
                const sessionPct = sessionRate > 1 ? sessionRate : sessionRate * 100;
                rateInput.value = Number.isFinite(sessionRate) ? Math.round(sessionPct * 1000) / 1000
                    : (Number.isFinite(itemRate) ? itemRate : 10.2);
            }
        }
        // Tax-exempt quotes save with NO TAX fee line + TaxRate 0; #include-tax defaults CHECKED in the
        // HTML, so without restoring it the reload re-applies WA tax to an exempt/out-of-state customer
        // and a Save Revision bakes the wrong total in. Restore the checkbox from the saved exemption
        // signal BEFORE recalculatePricing() reads it. (audit fix 2026-06-05 — Erik's #1 rule)
        const includeTaxEl = document.getElementById('include-tax');
        if (includeTaxEl) {
            const taxExempt = !taxFeeItem && !(parseFloat(session.TaxRate) > 0);
            includeTaxEl.checked = !taxExempt;
            // [B8-R2] (audit 2026-06-06): also persist the exemption so a later Pickup→Ship toggle on a
            // reloaded exempt quote doesn't re-apply WA tax (lookupTaxRate reads window._taxExempt). #1 rule.
             
            window._taxExempt = taxExempt;
        }
        // [2026-06-07] Restore the wholesale flag + checkbox so a reloaded wholesale order stays 0-tax / acct 2203.
         
        window._isWholesale = (session.IsWholesale === 'Yes' || session.IsWholesale === true || session.IsWholesale === 1);
        const _wholesaleEl = document.getElementById('wholesale-checkbox');
        if (_wholesaleEl) _wholesaleEl.checked = window._isWholesale;
        const shipFeeItem = items.find(i => i.EmbellishmentType === 'fee' && i.StyleNumber === 'SHIP');
        if (shipFeeItem && shipFeeItem.LineTotal > 0) {
            document.getElementById('shipping-fee').value = shipFeeItem.LineTotal;
        }

        // Restore LTM display preferences from saved quote
        if (session.LTM_Display_Mode || session.LTM_Waived) {
            // Ensure LTM panel is rendered before setting state
            // (recalculatePricing will render it, but we need state set first)
             
            window._pendingLtmState = {
                enabled: !session.LTM_Waived,
                displayMode: session.LTM_Display_Mode || 'builtin'
            };
        }

        // Recalculate pricing to update totals
        recalculatePricing();

        // Apply pending LTM state after panel is rendered
        if (window._pendingLtmState) {
            setLtmControlState('emb-ltm-panel', window._pendingLtmState);
            delete window._pendingLtmState;
            // Re-run pricing with the restored state
            recalculatePricing();
        }

        if (!opts.forDuplicate) showToast(`Editing ${quoteId} (Rev ${embState.editingRevision})`, 'success');

        // Enable the action-bar push button for this saved quote (gated on
        // Customer #). Reflect already-pushed state if applicable.
        // (Duplicate mode clears all of this right after — see duplicateQuote.)
        embState._pushQuoteId = quoteId;
        embState._pushAlreadyDone = !!session.PushedToShopWorks;
        updatePushButtonState();

        // "Customer viewed" badge (2026-06-10): /quote/:id records a customer_view
        // analytics event per open — surface it so the rep knows the quote landed.
        // Fire-and-forget; silence on failure (telemetry, not pricing).
        (async () => {
            try {
                const resp = await fetch(`${API_BASE}/api/quote_analytics?quoteID=${encodeURIComponent(quoteId)}&eventType=customer_view`);
                if (!resp.ok) return;
                const events = await resp.json();
                if (!Array.isArray(events) || events.length === 0) return;
                const dates = events
                    .map(ev => new Date(ev.Timestamp || ev.CreatedAt || ev.EventDate || ev.Date_Created || 0))
                    .filter(d => !isNaN(d.getTime()) && d.getTime() > 0)
                    .sort((a, b) => b - a);
                const lastTxt = dates.length ? ` — last ${dates[0].toLocaleDateString()} ${dates[0].toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}` : '';
                showToast(`👀 Customer viewed this quote ${events.length}×${lastTxt}`, 'info', 6000);
            } catch (_) { /* telemetry only */ }
        })();

    } catch (error) {
        console.error('[EditMode] Error loading quote:', error);
        showToast('Error loading quote: ' + error.message, 'error');
        // Clear edit mode and start fresh
        embState.editingQuoteId = null;
        embState.editingRevision = null;
        addNewRow();
    } finally {
         
        window._restoringQuote = false;  // restore complete — re-enable live tax lookups for the rep
    }
}

/**
 * Duplicate an existing quote as a brand-new one (repeat orders, 2026-06-10).
 * Loads through the REAL edit path — so the engine reprices everything from the
 * live API (last year's $19.00 polo correctly becomes today's price) — then
 * clears all edit/push state so the next Save creates a NEW QuoteID. Works on
 * pushed/locked quotes too (the classic reorder case): the source is never written.
 */
export async function duplicateQuote(sourceQuoteId) {
    await loadQuoteForEditing(sourceQuoteId, { forDuplicate: true });
    if (!document.querySelector('#product-tbody tr')) return;   // load failed — error already shown

    // Clear edit/push state (mirrors the resetQuote checklist) so save → NEW quote
    embState.editingQuoteId = null;
    embState.editingRevision = null;
    embState.lastImportMetadata = null;          // PaidToDate / SW audit / order # belong to the ORIGINAL order
    embState._pushAlreadyDone = false;
    embState._pushQuoteId = null;
    if (typeof updatePushButtonState === 'function') { try { updatePushButtonState(); } catch (_) {} }

    // Order-specific fields must not carry over
    const clearVal = (id) => { const el = document.getElementById(id); if (el) el.value = ''; };
    clearVal('order-number');
    clearVal('po-number');
    if (typeof setQuoteDateDefaults === 'function') { try { setQuoteDateDefaults(); } catch (_) {} }

    // Duplicate banner (updateEditModeUI was suppressed in duplicate mode)
    const headerSubtitle = document.querySelector('.power-header .power-header-subtitle');
    if (headerSubtitle) {
        headerSubtitle.innerHTML = `<span style="color: #34d399;">📋 Duplicated from ${escapeHtml(String(sourceQuoteId))} — saving creates a NEW quote at today's prices</span>`;
    }
    markAsUnsaved();
    showToast(`Duplicated ${sourceQuoteId} — prices refreshed to today's rates. Saving will create a new quote #.`, 'success', 7000);
}
// (window.duplicateQuote bridge moved to builders/emb/index.js)

// updateEditModeUI() → moved to quote-builder-utils.js

/**
 * Populate customer information fields (embroidery-specific with extra fields)
 */
function populateCustomerInfo(session) {
    const fields = {
        'customer-name': session.CustomerName,
        'customer-email': session.CustomerEmail,
        'company-name': session.CompanyName
    };

    for (const [id, value] of Object.entries(fields)) {
        const el = document.getElementById(id);
        if (el && value) el.value = value;
    }

    // Set sales rep dropdown
    const salesRepSelect = document.getElementById('sales-rep');
    if (salesRepSelect && session.SalesRepEmail) {
        for (let i = 0; i < salesRepSelect.options.length; i++) {
            if (salesRepSelect.options[i].value === session.SalesRepEmail) {
                salesRepSelect.selectedIndex = i;
                break;
            }
        }
    }

    // Restore notes (plain text — not JSON)
    if (session.Notes) {
        let notesText = session.Notes;
        // If Notes is structured JSON (DTG/DTF/SP config), skip. Only an OBJECT/ARRAY
        // counts — a bare number like "12345" parses as JSON too, and the old check
        // silently wiped such notes on every edit-reload.
        try {
            const parsed = JSON.parse(notesText);
            if (parsed !== null && typeof parsed === 'object') notesText = '';
        } catch (e) { /* plain text — use as-is */ }
        if (notesText) {
            const notesEl = document.getElementById('notes');
            if (notesEl) {
                notesEl.value = notesText;
                const section = document.getElementById('notes-section');
                if (section && section.classList.contains('collapsed')) {
                    section.classList.remove('collapsed');
                    const body = section.querySelector('.notes-body');
                    const icon = section.querySelector('.notes-toggle-icon');
                    if (body) body.style.display = 'block';
                    if (icon) icon.style.transform = 'rotate(180deg)';
                }
                updateNotesBadge();
            }
        }
    }
}

/**
 * Populate logo configuration from session data
 */
export function populateLogoConfig(session, items) {
    // Primary logo (garment)
    if (session.PrintLocation) {
        const posSelect = document.getElementById('primary-position');
        if (posSelect) posSelect.value = session.PrintLocation;
        embState.primaryLogo.position = session.PrintLocation;
    }
    if (session.StitchCount) {
        const stitchInput = document.getElementById('primary-stitches');
        if (stitchInput) stitchInput.value = mapStitchCountToTierValue(session.StitchCount, session.PrintLocation);
        embState.primaryLogo.stitchCount = session.StitchCount;
        // Sync position dropdown disabled state and FB stitch input for Full Back
        if (session.PrintLocation === 'Full Back') {
            const posEl = document.getElementById('primary-position');
            if (posEl) posEl.disabled = true;
            const fbField = document.getElementById('fb-stitch-count-field');
            const fbInput = document.getElementById('fb-stitch-count');
            if (fbField) fbField.style.display = '';
            if (fbInput) fbInput.value = session.StitchCount || 25000;
        }
    }
    if (session.DigitizingFee > 0) {
        const digitizingCb = document.getElementById('primary-digitizing');
        if (digitizingCb) {
            digitizingCb.checked = true;
            // Update visual indicator
            const container = digitizingCb.closest('.digitizing-checkbox');
            if (container) container.classList.add('checked');
        }
        embState.primaryLogo.needsDigitizing = true;
    }

    // Additional logo on garments — LEGACY globalAL path. The current row-based flow saves the AL as an
    // `embroidery-additional` line item (which restores its OWN row + price) AND sets AdditionalLogoLocation.
    // Enabling globalAL here when an AL row already exists double-charges (globalAL feeds the engine's
    // additionalServicesTotal AND the restored row bills again). Only enable for truly-legacy quotes: the
    // field is set but NO AL row exists to restore. (audit P1 2026-06-06)
    const hasALRow = items.some(i => i.EmbellishmentType === 'embroidery-additional' ||
        ['AL', 'AL-CAP', 'DECG-FB'].includes((i.StyleNumber || '').toUpperCase()));
    if (session.AdditionalLogoLocation && !hasALRow) {
        embState.globalAL.garment.enabled = true;
        embState.globalAL.garment.position = 'AL';
        embState.globalAL.garment.stitchCount = session.AdditionalStitchCount || EMB_DEFAULTS.AL_GARMENT_STITCH_COUNT;

        // Update UI
        const alSwitch = document.getElementById('garment-al-switch');
        if (alSwitch) alSwitch.classList.add('active');
        const alLabel = document.getElementById('garment-al-label');
        if (alLabel) alLabel.classList.add('active');
        const alConfig = document.getElementById('garment-al-config-new');
        if (alConfig) alConfig.classList.add('visible');
        const alToggle = document.getElementById('garment-al-toggle');
        if (alToggle) alToggle.checked = true;

        _syncALArrays();
    }

    // Cap primary logo
    if (session.CapPrintLocation) {
        const capPosSelect = document.getElementById('cap-primary-position');
        if (capPosSelect) capPosSelect.value = session.CapPrintLocation;
        embState.capPrimaryLogo.position = session.CapPrintLocation;
    }
    if (session.CapStitchCount) {
        const capStitchInput = document.getElementById('cap-primary-stitches');
        if (capStitchInput) capStitchInput.value = mapStitchCountToTierValue(session.CapStitchCount, 'CF');
        embState.capPrimaryLogo.stitchCount = session.CapStitchCount;
    }
    if (session.CapDigitizingFee > 0) {
        const capDigitizingCb = document.getElementById('cap-primary-digitizing');
        if (capDigitizingCb) {
            capDigitizingCb.checked = true;
            const container = capDigitizingCb.closest('.digitizing-checkbox');
            if (container) container.classList.add('checked');
        }
        embState.capPrimaryLogo.needsDigitizing = true;
    }

    // Cap embellishment type (flat embroidery / 3D puff / laser patch). RESTORING THIS IS
    // REQUIRED — it drives the fee engine's puff/patch upcharge recompute AND the cap-card UI.
    // Without it, a saved 3D-puff / laser-patch cap reloads as flat embroidery: the type is
    // lost AND a Save Revision DROPS the upcharge fee item (the save is gated on this type).
    // Set the dropdown + run the change handler (it must come AFTER the cap stitch/digitizing
    // restore above, which it reads). The matching 3D-EMB / Laser Patch fee items are then
    // skipped in populateProducts so the recomputed fee isn't double-counted. (cert audit 2026-06-04)
    if (session.CapEmbellishmentType && session.CapEmbellishmentType !== 'embroidery') {
        const capEmbSel = document.getElementById('cap-embellishment-type');
        if (capEmbSel) {
            capEmbSel.value = session.CapEmbellishmentType;
            embState.capPrimaryLogo.embellishmentType = session.CapEmbellishmentType;
            if (typeof handleCapEmbellishmentChange === 'function') {
                try { handleCapEmbellishmentChange(); } catch (_) {}
            }
        }
    }

    // Design number assignments (2026-02-19)
    if (session.GarmentDesignNumber) {
        embState.primaryLogo.designNumber = session.GarmentDesignNumber;
        updateLogoCardHeader('garment', session.GarmentDesignNumber);
        const gDesignInput = document.getElementById('garment-design-number');
        if (gDesignInput) gDesignInput.value = session.GarmentDesignNumber;
        const gClearBtn = document.getElementById('garment-design-clear');
        if (gClearBtn) gClearBtn.style.display = 'inline-flex';
        lookupDesignNumber('garment');
    }
    if (session.CapDesignNumber) {
        embState.capPrimaryLogo.designNumber = session.CapDesignNumber;
        updateLogoCardHeader('cap', session.CapDesignNumber);
        const cDesignInput = document.getElementById('cap-design-number');
        if (cDesignInput) cDesignInput.value = session.CapDesignNumber;
        const cClearBtn = document.getElementById('cap-design-clear');
        if (cClearBtn) cClearBtn.style.display = 'inline-flex';
        lookupDesignNumber('cap');
    }
}

/**
 * Populate products from line items
 * Handles regular products AND service items (DECG, DECC, MONOGRAM)
 */
async function populateProducts(items) {
    // Service items to create as service product rows (2026-02 refactor)
    const SERVICE_STYLE_NUMBERS = [
        'DECG', 'DECC', 'AL', 'AL-CAP', 'DECG-FB', 'CB', 'CS', 'Monogram', 'AS-Garm', 'AS-CAP',
        '3D-EMB', 'Laser Patch', 'Name/Number', 'WEIGHT', 'SEG', 'SECC', 'DT', 'CTR-GARMT', 'CTR-CAP',
        // Legacy backward-compat (old quotes):
        'FB', 'MONOGRAM', 'AS-GARM', 'NAME'
    ];

    // Separate service items from regular products
    const serviceItems = items.filter(item =>
        SERVICE_STYLE_NUMBERS.includes(item.StyleNumber) ||
        item.EmbellishmentType === 'customer-supplied' ||
        item.EmbellishmentType === 'monogram' ||
        item.EmbellishmentType === 'embroidery-additional'
    );

    // Filter to only regular product items
    const productItems = items.filter(item =>
        item.EmbellishmentType === 'embroidery' &&
        item.StyleNumber &&
        !item.StyleNumber.startsWith('AL-') &&
        !SERVICE_STYLE_NUMBERS.includes(item.StyleNumber)
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
                sizeBreakdown: {},
                priceOverride: 0,
                sizeOverrides: {}  // Per-size price overrides (child rows)
            };
        }
        // Check for price override stored in LogoSpecs
        if (item.LogoSpecs) {
            try {
                const specs = JSON.parse(item.LogoSpecs);
                if (specs.priceOverride && specs.overridePrice > 0) {
                    if (specs.sizeOverride) {
                        // Per-size override — map to specific sizes in this line item
                        const sizes = JSON.parse(item.SizeBreakdown || '{}');
                        for (const sz of Object.keys(sizes)) {
                            productGroups[key].sizeOverrides[sz] = specs.overridePrice;
                        }
                    } else {
                        // Parent row override
                        productGroups[key].priceOverride = specs.overridePrice;
                    }
                }
            } catch (e) { /* ignore parse errors */ }
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

    // Add each regular product to the table
    for (const product of Object.values(productGroups)) {
        await addProductFromQuote(product);
    }

    // Fees the price engine AUTO-recomputes from restored logo/cap config — they are NOT
    // standalone rows on a fresh order, so restoring them ALSO as service rows DOUBLE-COUNTS
    // them on edit-reload (e.g. saved AS-Garm $132 row + recomputed $132 fee). Skip the
    // standalone restore; the fee table re-derives each from the restored config:
    //   • AS-Garm / AS-CAP  -> primary garment/cap logo stitch overage
    //   • 3D-EMB / Laser Patch -> cap embellishment type (restored in populateLogoConfig above)
    // (cert audit 2026-06-04)
    const AUTO_RECOMPUTED_FEES = ['AS-Garm', 'AS-CAP', 'AS-GARM', '3D-EMB', 'Laser Patch'];

    // Add service items as service product rows (2026-02 refactor)
    for (const serviceItem of serviceItems) {
        if (AUTO_RECOMPUTED_FEES.includes(serviceItem.StyleNumber)) continue;
        const serviceType = serviceItem.StyleNumber;
        const isCap = serviceType === 'DECC' || serviceType === 'CB' || serviceType === 'CS' || serviceType === 'AS-CAP' || serviceType === 'AL-CAP' || serviceType === '3D-EMB' || serviceType === 'Laser Patch';

        // Parse metadata from SizeBreakdown if available
        let stitchCount = 8000;
        try {
            const meta = JSON.parse(serviceItem.SizeBreakdown || '{}');
            stitchCount = meta.stitchCount || 8000;
        } catch (e) { /* ignore */ }

        const serviceRow = createServiceProductRow(serviceType, {
            quantity: serviceItem.Quantity,
            unitPrice: serviceItem.BaseUnitPrice || serviceItem.FinalUnitPrice,
            total: serviceItem.LineTotal,
            stitchCount: stitchCount,
            position: serviceItem.PrintLocationName || '',
            isCap: isCap
        });

        // Re-flag bar Additional-Logo rows so they stay LIVE API-priced on revisions.
        // Placement + stitch are restored above (now persisted on save); without this flag
        // the row froze and lost its tier when the rep edited the qty. (2026-06-04 audit)
        if (serviceRow && ['AL', 'AL-CAP', 'DECG-FB'].includes(serviceType)) {
            serviceRow.dataset.alPriced = 'true';
            serviceRow.dataset.alItemType = serviceType === 'DECG-FB' ? 'fullback'
                : (serviceType === 'AL-CAP' ? 'cap' : 'garment');
            serviceRow.dataset.alQtyAuto = 'false';   // preserve the SAVED qty on reload — don't re-tally
        }

        // Re-flag bar Customer-Supplied (DECG/DECC) rows so they stay LIVE API-priced on revisions
        // (same as AL above) — without this the row freezes and loses its tier if the rep edits qty.
        if (serviceRow && ['DECG', 'DECC'].includes(serviceType)) {
            serviceRow.dataset.decgPriced = 'true';
            serviceRow.dataset.decgItemType = serviceType === 'DECC' ? 'cap' : 'garment';
            // Restore the Heavyweight (+$10/pc) flag from SizeBreakdown so the live re-price keeps it.
            try { serviceRow.dataset.decgHeavyweight = JSON.parse(serviceItem.SizeBreakdown || '{}').heavyweight ? 'true' : 'false'; } catch (e) { serviceRow.dataset.decgHeavyweight = 'false'; }
        }

        // Restore price override for DECG/DECC if saved
        if (serviceRow && serviceItem.LogoSpecs) {
            try {
                const specs = JSON.parse(serviceItem.LogoSpecs);
                if (specs.priceOverride && specs.overridePrice > 0) {
                    serviceRow.dataset.sellPrice = specs.overridePrice.toString();
                }
            } catch (e) { /* ignore */ }
        }

    }
}

/**
 * Add a product row from loaded quote data
 */
export async function addProductFromQuote(product) {
    // Add new row — target it by the id addNewRow() mints, never the transient
    // `.new-row` highlight class (LESSONS 2026-07-06: multi-product loads can leave
    // several rows highlighted; the first document-order match may be the wrong one).
    const newRowId = addNewRow();
    const row = document.getElementById(`row-${newRowId}`);
    if (!row) return;

    const rowId = row.dataset.rowId;
    const styleInput = row.querySelector('.style-input');

    // Set style number and trigger color loading
    styleInput.value = product.styleNumber;
    await onStyleChange(styleInput, parseInt(rowId));

    // Small delay to let colors load
    await new Promise(resolve => setTimeout(resolve, 100));

    // Select the color
    const pickerDropdown = row.querySelector('.color-picker-dropdown');
    if (pickerDropdown) {
        const colorOption = pickerDropdown.querySelector(
            `[data-color-name="${product.color}"], [data-catalog-color="${product.color}"]`
        );
        if (colorOption) {
            selectColor(parseInt(rowId), colorOption);
        }
    }

    // Small delay for color selection to process
    await new Promise(resolve => setTimeout(resolve, 50));

    // Set size quantities - handle both standard sizes and extended/tall sizes
    // Extended sizes need child rows (same as ShopWorks import)
    const rowIdNum = parseInt(rowId);

    for (const [size, qty] of Object.entries(product.sizeBreakdown)) {
        if (qty <= 0) continue;

        // Check if this is an extended/tall size that needs a child row
        // SIZE06_EXTENDED_SIZES is defined at module level and includes tall sizes
        const isExtendedSize = SIZE06_EXTENDED_SIZES.includes(size.toUpperCase()) ||
                               SIZE06_EXTENDED_SIZES.includes(size);

        // OSFA-only caps/beanies/bags hold qty on the PARENT (dataset.osfaQty + .osfa-qty-input), not a
        // child row. OSFA is in SIZE06_EXTENDED_SIZES, so without this special-case it routes to the generic
        // createChildRow branch and the trailing onSizeChange drops it → silent cap-qty loss on reload.
        // Mirror the ShopWorks-import OSFA handling (L11844). (audit P1 2026-06-06)
        if (size.toUpperCase() === 'OSFA' && row.dataset.sizeCategory === 'osfa-only') {
            row.dataset.osfaQty = qty;
            row.dataset.isOsfaOnly = 'true';
            const osfaInput = row.querySelector('.osfa-qty-input');
            if (osfaInput) osfaInput.value = qty;
            const qtyDisp = document.getElementById(`row-qty-${rowIdNum}`);
            if (qtyDisp) qtyDisp.textContent = qty;
            continue;
        }

        if (size === '2XL' || size === 'XXL') {
            // Both share the parent's Size05 column (the data-size="2XL" input drives the
            // child-row lifecycle), but XXL is a DISTINCT SanMar size (~589 ladies styles
            // use _XXL, never _2X) and must KEEP ITS NAME through reload — the ShopWorks
            // push suffixes off the size name, so renaming to "2XL" orders the wrong SKU.
            // Mirror the ShopWorks-import order: create the named child FIRST, then prime
            // the parent input; the trailing onSizeChange finds the existing child and
            // updates it in place (it only mints a "2XL" child when NONE exists) and
            // REMOVES the child when the parent input reads 0. (Batch 2.0, 2026-07-09;
            // supersedes the 2026-06-05 fold-to-2XL fix, which fixed the drop but lost
            // the XXL name.)
            if (size === 'XXL') {
                createChildRow(rowIdNum, 'XXL', qty);
            }
            const parent2x = row.querySelector(`input[data-size="2XL"]`);
            if (parent2x) {
                parent2x.value = qty;
            } else if (size === '2XL') {
                createChildRow(rowIdNum, '2XL', qty);
            }
        } else if (isExtendedSize) {
            // Create child row for extended size (same pattern as ShopWorks import)
            createChildRow(rowIdNum, size, qty);
        } else {
            // Standard size - find existing input
            const sizeInput = row.querySelector(`input[data-size="${size}"]`);
            if (sizeInput && !sizeInput.disabled) {
                sizeInput.value = qty;
                // Trigger change event to update totals
                sizeInput.dispatchEvent(new Event('change', { bubbles: true }));
            } else {
                console.warn(`[addProductFromQuote] No input found for size ${size}, creating child row`);
                createChildRow(rowIdNum, size, qty);
            }
        }
    }

    // Restore price override if saved
    if (product.priceOverride > 0) {
        row.dataset.sellPrice = product.priceOverride.toString();
    }

    // Restore per-size price overrides on child rows
    if (product.sizeOverrides && Object.keys(product.sizeOverrides).length > 0) {
        for (const [size, price] of Object.entries(product.sizeOverrides)) {
            const childRowId = embState.childRowMap[rowIdNum]?.[size];
            if (childRowId) {
                const childRow = document.getElementById(`row-${childRowId}`);
                if (childRow) childRow.dataset.sellPrice = price.toString();
            }
        }
    }

    // Trigger pricing recalculation after all sizes are set
    onSizeChange(rowIdNum);
}

/**
 * Populate additional charges from session data
 */
function populateAdditionalCharges(session) {
    const chargeFields = {
        'art-charge': session.ArtCharge,
        'graphic-design-hours': session.GraphicDesignHours,
        'rush-fee': session.RushFee,
        'sample-fee': session.SampleFee,
        'sample-qty': session.SampleQty
    };

    for (const [id, value] of Object.entries(chargeFields)) {
        const el = document.getElementById(id);
        if (el && value !== undefined && value !== null) {
            el.value = value;
        }
    }

    // Legacy sample fee: the sample inputs were removed from the EMB HTML, so a
    // saved SampleFee can't be restored — without this warning a Save Revision
    // silently drops the charge from the quote. (audit 2026-06-10)
    if (parseFloat(session.SampleFee) > 0 && !document.getElementById('sample-fee')) {
        showToast(`This quote has a saved $${session.SampleFee} sample fee that can't be restored (sample inputs were removed) — re-add it as a manual charge before saving a revision.`, 'warning', 10000);
    }

    // Restore art charge toggle state
    const artChargeToggle = document.getElementById('art-charge-toggle');
    if (artChargeToggle && session.ArtCharge > 0) {
        artChargeToggle.checked = true;
        const wrapper = document.getElementById('art-charge-wrapper');
        const input = document.getElementById('art-charge');
        if (wrapper) wrapper.style.opacity = '1';
        if (input) input.disabled = false;
    }

    // Update artwork charges display (badge and graphic design total)
    updateArtworkCharges();

    // Handle discount. The discount panel was removed from the EMB HTML, so these
    // elements usually don't exist — the old bare getElementById writes threw a
    // TypeError that ABORTED the whole edit-reload for any legacy discounted quote
    // (fees/tax/LTM never restored, "Error loading quote"). Guard everything and
    // tell the rep when a saved discount can't be represented. (audit 2026-06-10)
    if (session.Discount > 0 || session.DiscountPercent > 0) {
        const discountType = document.getElementById('discount-type');
        const discountAmount = document.getElementById('discount-amount');
        const discountPreset = document.getElementById('discount-preset');
        if (!discountType || !discountAmount) {
            const saved = session.DiscountPercent > 0 ? `${session.DiscountPercent}%` : `$${session.Discount}`;
            showToast(`This quote has a saved ${saved} discount, but the discount panel was removed — re-apply it via a price override before saving a revision.`, 'warning', 10000);
        } else {
            if (session.DiscountPercent > 0) {
                discountType.value = 'percent';
                discountAmount.value = session.DiscountPercent;
                // Set preset dropdown based on value
                if (discountPreset) {
                    const presetValues = ['5', '10', '15', '20', '25'];
                    const percentStr = String(session.DiscountPercent);
                    discountPreset.value = presetValues.includes(percentStr) ? percentStr : 'custom';
                }
            } else {
                discountType.value = 'fixed';
                discountAmount.value = session.Discount;
                const sym = document.getElementById('discount-symbol');
                if (sym) sym.textContent = '$';
            }
            // Update UI to show correct input/preset based on type
            if (typeof updateDiscountType === 'function') {
                updateDiscountType();
            }
            // If custom percentage, ensure input wrapper is visible
            if (session.DiscountPercent > 0 && discountPreset && discountPreset.value === 'custom') {
                const inputWrapper = document.getElementById('discount-input-wrapper');
                const symbol = document.getElementById('discount-symbol');
                if (inputWrapper) inputWrapper.style.display = 'block';
                if (symbol) symbol.textContent = '%';
            }
        }
    }

    // Restore discount reason with preset detection
    if (session.DiscountReason) {
        const reasonPreset = document.getElementById('discount-reason-preset');
        const reasonEl = document.getElementById('discount-reason');
        if (reasonPreset && reasonEl) {
            const presetValues = Array.from(reasonPreset.options)
                .map(opt => opt.value)
                .filter(v => v !== 'custom');
            if (presetValues.includes(session.DiscountReason)) {
                // Exact match to preset
                reasonPreset.value = session.DiscountReason;
                reasonEl.style.display = 'none';
                reasonEl.value = session.DiscountReason;
            } else {
                // Custom reason
                reasonPreset.value = 'custom';
                reasonEl.style.display = 'block';
                reasonEl.value = session.DiscountReason;
            }
        }
    }

    // Update the additional charges display
    updateAdditionalCharges();
}
