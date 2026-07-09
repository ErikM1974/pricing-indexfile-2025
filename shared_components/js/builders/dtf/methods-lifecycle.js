/**
 * DTFQuoteBuilder prototype mixin — init/edit-load/prefills/draft/save/reset lifecycle.
 * Batch 4.2 (2026-07-09): methods moved VERBATIM from quote-builder-class.js
 * (`this.` state intact — the class assembles via Object.assign(prototype, ...)).
 */
// @ts-nocheck — MOVED legacy DOM code (pre-existing checkJs frictions).
/* global escapeHtml, showToast, Event, QuotePersistence, QuoteSession, initLogoStatusChips,
   initMethodSwitchMenu, getQuickQuotePrefill, takeMethodSwitchPrefill, StaffAuthHelper,
   CustomerLookupService, updateTaxCalculation, showRecentCustomerOrders,
   removeRecentOrdersPanel, setupBeforeUnloadGuard, getServicePrice, updateAdditionalCharges,
   updateFeeTableRows, applyMethodSwitchCustomer, history, clearQuickQuoteParams,
   assertQuoteEditable, setLtmControlState, getLtmControlState, alert, isValidEmail,
   QuoteShareModal, showSaveModal, confirm, showDtfPushButton, updateDtfPushButtonState */
import { dtfState } from './state.js';

export const lifecycleMethods = {

    /**
     * Initialize auto-save persistence and session management
     */
    initPersistence() {
        if (typeof QuotePersistence !== 'undefined') {
            this.persistence = new QuotePersistence({
                prefix: 'DTF',
                autoSaveInterval: 30000, // 30 seconds
                debug: false
            });

            // Set up auto-save callback
            this.persistence.onAutoSave = () => {
                const data = this.getCurrentQuoteData();
                if (data && (data.products.length > 0 || data.selectedLocations.length > 0)) {
                    this.persistence.save(data);
                }
            };

        } else {
            console.warn('[DTFQuoteBuilder] QuotePersistence not available');
        }

        if (typeof QuoteSession !== 'undefined' && this.persistence) {
            this.session = new QuoteSession({
                prefix: 'DTF',
                persistence: this.persistence,
                debug: false
            });
        }
    },

    /**
     * Get current quote data for auto-save
     */
    getCurrentQuoteData() {
        return {
            selectedLocations: this.selectedLocations,
            products: this.products.map(p => {
                // Merge extended-size child rows from JS state so the auto-saved
                // draft carries them — restoreDraft() rebuilds them through
                // addProductFromQuote → createChildRow. (2026-06-11 P2)
                const quantities = { ...p.quantities };
                this.getChildRowsForParent(p.id).forEach(child => {
                    const size = child.size === 'XXL' ? '2XL' : (child.size === 'XXXL' ? '3XL' : child.size);
                    if (child.qty > 0) quantities[size] = child.qty;
                });
                return {
                    id: p.id,
                    style: p.style,
                    name: p.name,
                    color: p.color,
                    catalogColor: p.catalogColor,
                    baseCost: p.baseCost,
                    quantities,
                    imageUrl: p.imageUrl
                };
            }),
            customerName: document.getElementById('customer-name')?.value || '',
            customerEmail: document.getElementById('customer-email')?.value || '',
            companyName: document.getElementById('company-name')?.value || '',
            productIndex: this.productIndex
        };
    },

    /**
     * Restore draft data to the form
     */
    restoreDraft(draft) {

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

        // Restore selected locations (radio buttons for front/back, checkboxes for sleeves)
        if (draft.selectedLocations && draft.selectedLocations.length > 0) {
            draft.selectedLocations.forEach(loc => {
                // Find the input (works for both radio and checkbox)
                const input = document.querySelector(`input[value="${loc}"]`);
                if (input) {
                    input.checked = true;
                }
            });
            // Sync state from UI (handles both radio and checkbox inputs)
            this.updateSelectedLocations();
        }

        // Restore products. [2026-06-11] the old code pushed raw product objects
        // into this.products and called addProductRowFromData() — a function that
        // has NEVER existed — so recovered drafts kept S-XL money in state with no
        // visible rows and silently lost all extended-size pieces. Rebuild through
        // the same path edit-reload uses (style load → color select → size events
        // → child rows).
        if (draft.products && draft.products.length > 0) {
            (async () => {
                for (const product of draft.products) {
                    const sizeBreakdown = {};
                    Object.entries(product.quantities || {}).forEach(([sz, q]) => {
                        if (q > 0) sizeBreakdown[sz] = q;
                    });
                    if (Object.keys(sizeBreakdown).length === 0 && !product.styleNumber) continue;
                    await this.addProductFromQuote({
                        styleNumber: product.styleNumber,
                        description: product.description,
                        color: product.color,
                        sizeBreakdown
                    });
                }
                this.updatePricing();
                if (typeof window.renderOrderRecap === 'function') window.renderOrderRecap();
            })();
        }

        // [2026-06-08] Repaint the order-summary band after a draft recovery — restoreDraft writes #customer-name /
        // #company-name, but updatePricing() above is gated on products + short-circuits on zero qty, so the recap
        // could otherwise stay empty until the next field edit. (Adversarial-review gap, DTF Phase 2.)
        if (typeof window.renderOrderRecap === 'function') window.renderOrderRecap();
    },

    async init() {

        try {
            // Load pricing data
            await this.loadPricingData();
        } catch (error) {
            // Error already shown by loadPricingData, continue initialization
            console.warn('[DTFQuoteBuilder] Continuing without pricing data');
        }

        // Setup event listeners
        this.setupLocationListeners();
        this.setupSearchListeners();
        this.setupGlobalListeners();

        // Logo status chips — On file / New / TBD (Erik 2026-07-07). DTF's TBD
        // assumption is the TRANSFER SIZE, already implied by the location picks.
        if (typeof initLogoStatusChips === 'function') {
            initLogoStatusChips({
                mountSel: '.location-config-section.reference-artwork-section',
                artworkMountSel: '#dtf-artwork-mount',
                designFocusId: 'design-number',
                notesSel: '#dtf-notes',
                assumption: () => {
                    const loc = document.getElementById('location-display')?.textContent?.trim();
                    const locText = (loc && loc !== 'None selected') ? loc : 'the selected print locations';
                    return `Pricing assumes transfers at: ${locText}. Final transfer sizes are confirmed after artwork review.`;
                }
            });
        }

        // Mid-call method-switch menu (expert audit 2026-07-07) — serializes
        // IDENTITY only (customer + style/color/sizes); target reprices natively.
        if (typeof initMethodSwitchMenu === 'function') {
            initMethodSwitchMenu({
                current: 'dtf',
                collect: () => {
                    const items = new Map();
                    (this.products || []).forEach(p => {
                        const sizes = {};
                        ['XS', 'S', 'M', 'L', 'XL'].forEach(s => {
                            const q = parseInt(p.quantities?.[s], 10) || 0;
                            if (q > 0) sizes[s] = q;
                        });
                        items.set(Number(p.id), { style: p.styleNumber, color: p.catalogColor || '', colorName: p.color || '', sizeBreakdown: sizes });
                    });
                    // Extended sizes live in childRows (single source of truth) —
                    // reading them from parent quantities too would double-count.
                    (this.childRows || new Map()).forEach(ch => {
                        const it = items.get(Number(ch.parentId));
                        if (it && ch.qty > 0 && ch.size) it.sizeBreakdown[ch.size] = (it.sizeBreakdown[ch.size] || 0) + ch.qty;
                    });
                    return Array.from(items.values()).filter(i => i.style && Object.keys(i.sizeBreakdown).length);
                }
            });
        }

        // Check for edit mode (loading existing quote for revision)
        const editQuoteId = this.checkForEditMode();
        // Duplicate mode (?duplicate=DTF-...): load a copy as a NEW quote (EMB parity 2026-06-11)
        const duplicateQuoteId = new URLSearchParams(window.location.search).get('duplicate');
        // Quick Quote handoff (?from=quickquote — param schema + parser: getQuickQuotePrefill()
        // in quote-builder-utils.js). Prefill wins over draft recovery for this visit,
        // same as ?edit=/?duplicate=. (item #6, 2026-07-05)
        const qqPrefill = (typeof getQuickQuotePrefill === 'function') ? getQuickQuotePrefill() : null;
        // Mid-call method switch (?from=methodswitch — expert audit 2026-07-07):
        // customer + product rows carried over from another builder.
        const msPrefill = (typeof takeMethodSwitchPrefill === 'function') ? takeMethodSwitchPrefill() : null;
        if (duplicateQuoteId) {
            await this.duplicateQuote(duplicateQuoteId);
        } else if (editQuoteId) {
            // Skip draft recovery and load the existing quote instead
            await this.loadQuoteForEditing(editQuoteId);
        } else if (qqPrefill) {
            await this.applyQuickQuotePrefill(qqPrefill);
        } else if (msPrefill) {
            await this.applyMethodSwitchPrefill(msPrefill);
        } else {
            // Check for draft recovery (after DOM is ready)
            if (this.session && this.session.shouldShowRecovery()) {
                this.session.showRecoveryDialog(
                    (draft) => this.restoreDraft(draft),
                    () => {
                    }
                );
            }
        }

        // Auto-select sales rep based on logged-in staff (2026 consolidation)
        if (typeof StaffAuthHelper !== 'undefined') {
            StaffAuthHelper.autoSelectSalesRep('sales-rep');
        }

        // Initialize customer lookup autocomplete
        if (typeof CustomerLookupService !== 'undefined') {
            const customerLookup = new CustomerLookupService();

            const applyContact = (contact) => {
                document.getElementById('customer-name').value = contact.ct_NameFull || '';
                document.getElementById('customer-email').value = contact.ContactNumbersEmail || '';
                document.getElementById('company-name').value = contact.CustomerCompanyName || '';

                // ShopWorks Customer # — the lookup already holds it, yet DTF made the
                // rep re-type it (it gates Push, filters the design combobox, and a typo
                // attaches the pushed order to the wrong customer; blank falls to the
                // 3739 placeholder). EMB has auto-filled since June. (expert audit 2026-07-07)
                const custNumEl = document.getElementById('customer-number');
                if (custNumEl) {
                    custNumEl.value = contact.id_Customer || '';
                    custNumEl.dispatchEvent(new Event('input', { bubbles: true }));  // refresh recap + push-button state
                }

                // [2026-06-08] P0 (Erik's #1 rule): honor tax-exempt customers — the CRM "TAX EXEMPT" chip was
                // cosmetic; the quote/PDF/push still billed WA tax. Mirror EMB. Also restore tax for a taxable
                // customer selected right after an exempt one (else the prior 0% bleeds → under-charge).
                var _wasExempt = !!window._taxExempt;
                // eslint-disable-next-line no-restricted-syntax -- pre-existing window contract (verbatim mixin move, Batch 4.2)
                window._taxExempt = (contact.Is_Tax_Exempt === true || contact.Is_Tax_Exempt === 1 || contact.Is_Tax_Exempt === '1');
                var _incTax = document.getElementById('include-tax');
                var _rateEl = document.getElementById('tax-rate-input');
                if (window._taxExempt) {
                    if (_incTax) _incTax.checked = false;
                    if (_rateEl) _rateEl.value = '0';
                    if (typeof updateTaxCalculation === 'function') updateTaxCalculation();
                } else if (_wasExempt) {
                    if (_incTax) _incTax.checked = true;
                    if (_rateEl && _rateEl.value === '0') _rateEl.value = '10.2';
                    if (typeof updateTaxCalculation === 'function') updateTaxCalculation();
                }

                if (typeof window.surfaceCustomerContext === 'function') {
                    window.surfaceCustomerContext(contact, {
                        warningContainerId: 'customer-warning-banner',
                        taxChipContainerId: 'customer-tax-chip',
                        tierBadgeContainerId: 'customer-tier-badge',
                        phoneInputId: 'customer-phone',
                    });
                }

                this.showToast('Customer info loaded', 'success');
                if (typeof window.renderOrderRecap === 'function') window.renderOrderRecap();  // [2026-06-08] refresh recap on customer pick

                // Recent ShopWorks orders panel (advisory re-order aid; silent-skip on failure) —
                // shared showRecentCustomerOrders() in quote-builder-utils.js. (item #13, 2026-07-05)
                if (typeof showRecentCustomerOrders === 'function' && contact.id_Customer) {
                    showRecentCustomerOrders(contact.id_Customer, {
                        notesId: 'dtf-notes', projectId: 'project-name', poId: 'po-number', designId: 'design-number'
                    });
                }
            };

            customerLookup.bindToInput('customer-lookup', {
                onSelect: applyContact,
                onClear: () => {
                    document.getElementById('customer-name').value = '';
                    document.getElementById('customer-email').value = '';
                    document.getElementById('company-name').value = '';
                    const _custNumClear = document.getElementById('customer-number');
                    if (_custNumClear) {
                        _custNumClear.value = '';   // never leave the PREVIOUS customer's ShopWorks # armed for Push
                        _custNumClear.dispatchEvent(new Event('input', { bubbles: true }));
                    }
                    // eslint-disable-next-line no-restricted-syntax -- pre-existing window contract (verbatim mixin move, Batch 4.2)
                    window._taxExempt = false;  // [2026-06-08] P0: customer cleared → no longer exempt
                    if (typeof window.renderOrderRecap === 'function') window.renderOrderRecap();  // [2026-06-08] empty the recap when the lookup is cleared
                    if (typeof removeRecentOrdersPanel === 'function') removeRecentOrdersPanel();  // item #13: no stale orders for the next customer
                }
            });

            // Erik 2026-05-26: COMPANY field also triggers autocomplete (DTG parity).
            customerLookup.bindToInput('company-name', {
                onSelect: (contact) => {
                    const lookupInput = document.getElementById('customer-lookup');
                    if (lookupInput) lookupInput.value = contact.CustomerCompanyName || '';
                    applyContact(contact);
                }
            });
        }

        // Hide loading overlay
        const loadingOverlay = document.getElementById('loading-overlay');
        if (loadingOverlay) {
            loadingOverlay.style.display = 'none';
        }

        // Auto-focus search bar for immediate typing (UX improvement)
        const searchInput = document.getElementById('product-search');
        if (searchInput) {
            searchInput.focus();
        }

        // Unsaved-changes tracking + leave-page guard (EMB parity, 2026-06-10).
        // Attached at the END of init so edit-load / draft recovery / sales-rep
        // auto-select above never false-mark a pristine page as dirty.
        this.setupUnsavedChangesTracking();
        if (typeof setupBeforeUnloadGuard === 'function') setupBeforeUnloadGuard();
    },

    /**
     * Check URL for edit parameter
     * Returns quote ID if editing, null otherwise
     */
    checkForEditMode() {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get('edit');
    },

    /**
     * Update UI to show edit mode
     */
    updateEditModeUI(quoteId, revision) {
        // Update header subtitle
        const headerSubtitle = document.querySelector('.power-header .power-header-subtitle');
        if (headerSubtitle) {
            headerSubtitle.innerHTML = `<span style="color: #fbbf24;">✏️ Editing: ${escapeHtml(String(quoteId))} • Rev ${escapeHtml(String(revision))}</span>`;
        }

        // Update save button text
        const saveBtn = document.querySelector('.btn-save-quote, [onclick*="saveAndGetLink"]');
        if (saveBtn) {
            saveBtn.innerHTML = '<i class="fas fa-save"></i> Save Revision';
        }
    },

    /**
     * Populate customer information fields
     */
    populateCustomerInfo(session) {
        const fields = {
            'customer-name': session.CustomerName,
            'customer-email': session.CustomerEmail,
            'company-name': session.CompanyName,
            'customer-phone': session.Phone,
            'customer-number': session.CustomerNumber
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

        // Populate order & shipping fields (2026.03 overhaul)
        // [2026-06-11] shipToName lives in the Notes JSON (Quote_Sessions has no
        // ShipToName column — the old session.ShipToName read was always undefined,
        // so the recipient name was wiped on every Save Revision).
        let notesMeta = {};
        try { notesMeta = JSON.parse(session.Notes || '{}') || {}; } catch (e) { /* legacy free-text notes */ }
        // Caspio returns datetimes ('2026-06-15T00:00:00') — <input type=date>
        // rejects them, so saved dates loaded blank and were wiped on resave.
        const toDateInput = (v) => (typeof v === 'string' && v.length >= 10) ? v.slice(0, 10) : (v || '');
        const orderFields = {
            'order-number': session.OrderNumber,
            'po-number': session.PurchaseOrderNumber,
            'req-ship-date': toDateInput(session.ReqShipDate),
            'drop-dead-date': toDateInput(session.DropDeadDate),
            'ship-to-name': notesMeta.shipToName || '',
            'ship-address': session.ShipToAddress,
            'ship-city': session.ShipToCity,
            'ship-zip': session.ShipToZip,
            'ship-method': session.ShipMethod
        };

        let hasOrderData = false;
        for (const [id, value] of Object.entries(orderFields)) {
            const el = document.getElementById(id);
            if (el && value) {
                el.value = value;
                hasOrderData = true;
            }
        }

        // Set state dropdown
        const stateSelect = document.getElementById('ship-state');
        if (stateSelect && session.ShipToState) {
            stateSelect.value = session.ShipToState;
        }

        // Set tax rate from saved quote
        const taxRateInput = document.getElementById('tax-rate-input');
        if (taxRateInput && session.TaxRate != null && session.TaxRate !== '') {  // [2026-06-08] P2: != null so a saved numeric 0 (exempt/wholesale/out-of-state) restores, not the 10.1 HTML default
            taxRateInput.value = session.TaxRate;
        }
        // [2026-06-08] restore the per-order wholesale flag + checkbox on edit-reload (mirror EMB)
        // eslint-disable-next-line no-restricted-syntax -- pre-existing window contract (verbatim mixin move, Batch 4.2)
        window._isWholesale = (session.IsWholesale === 'Yes' || session.IsWholesale === true || session.IsWholesale === 1);
        { const _wcb = document.getElementById('wholesale-checkbox'); if (_wcb) _wcb.checked = window._isWholesale; }
        if (window._isWholesale) { const _it = document.getElementById('include-tax'); if (_it) _it.checked = false; }

        // Auto-expand order details panel if data exists
        if (hasOrderData) {
            const content = document.getElementById('order-details-content');
            const chevron = document.getElementById('order-details-chevron');
            if (content) content.classList.remove('hidden');
            if (chevron) chevron.style.transform = 'rotate(0)';
        }

        // Restore project name + special instructions from the Notes JSON blob
        try {
            const blob = JSON.parse(session.Notes || '{}');
            const projEl = document.getElementById('project-name');
            if (projEl && blob.projectName) projEl.value = blob.projectName;
            const notesEl = document.getElementById('dtf-notes');
            if (notesEl && blob.specialNotes) notesEl.value = blob.specialNotes;
        } catch (_) { /* Notes not JSON — skip */ }
        // [2026-06-08] reflect the loaded customer + ship-to in the order-summary band on edit-reload
        // (belt-and-suspenders vs the recalc hook, which can short-circuit when qty is 0)
        if (typeof window.renderOrderRecap === 'function') window.renderOrderRecap();
    },

    /**
     * Populate additional charges from saved session (2026 fee refactor)
     */
    populateAdditionalCharges(session) {
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

        // Discount — the DTF discount UI was REMOVED 2026-03-23, so a legacy saved
        // discount can no longer be applied: the old code wrote to nonexistent
        // #discount-amount/#discount-type fields, computeFeesAndTotals() read them
        // as 0, and a Save Revision silently repriced the quote UPWARD (the exact
        // silent-price-change class Erik's #1 rule targets). Surface it loudly and
        // persistently instead. (expert audit 2026-07-07)
        if (session.Discount > 0 || session.DiscountPercent > 0) {
            const amt = session.DiscountPercent > 0
                ? `${session.DiscountPercent}%`
                : `$${Number(session.Discount).toFixed(2)}`;
            const reason = session.DiscountReason ? ` (${session.DiscountReason})` : '';
            this.showError(`Heads up: this quote was saved with a ${amt} discount${reason} that this builder no longer supports. Saving a revision will REMOVE the discount and raise the total — re-quote or adjust before sending.`);
        }

        // Shipping fee
        const shippingFeeInput = document.getElementById('dtf-shipping-fee');
        if (shippingFeeInput && session.ShippingFee > 0) {
            shippingFeeInput.value = session.ShippingFee;
        }

        // Update UI displays
        if (typeof updateAdditionalCharges === 'function') {
            updateAdditionalCharges();
        }
        if (typeof updateFeeTableRows === 'function') {
            updateFeeTableRows();
        }
    },

    /**
     * Populate selected locations from session Notes
     */
    populateLocationsFromSession(session) {
        try {
            const notes = JSON.parse(session.Notes || '{}');
            if (notes.locations && Array.isArray(notes.locations)) {
                notes.locations.forEach(loc => {
                    // Find the input (works for both radio and checkbox)
                    const input = document.querySelector(`input[value="${loc}"]`);
                    if (input) {
                        input.checked = true;
                    }
                });
                // Sync state from UI
                this.updateSelectedLocations();
            }
        } catch (e) {
            console.warn('[EditMode] Could not parse locations from notes:', e);
        }
    },

    /**
     * Populate products from line items
     */
    async populateProductsFromItems(items) {
        // Filter to only DTF product items
        const productItems = items.filter(item =>
            item.EmbellishmentType === 'dtf' &&
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
            await this.addProductFromQuote(product);
        }
    },

    /**
     * Quick Quote handoff (?from=quickquote — param schema + parser: getQuickQuotePrefill()
     * in quote-builder-utils.js). Routes through the SAME addProductFromQuote() path the
     * edit-loader uses (parent row + createChildRow for extended sizes), so color/size
     * handling + pricing are identical to a hand-added row. (item #6, 2026-07-05)
     */
    /**
     * Mid-call method switch (expert audit 2026-07-07): fill the customer, then
     * replay every carried product through the SAME add path Quick Quote uses —
     * pricing comes from THIS builder's engine, never from the payload.
     */
    async applyMethodSwitchPrefill(ms) {
        if (typeof applyMethodSwitchCustomer === 'function') applyMethodSwitchCustomer(ms.customer);
        let added = 0;
        for (const p of (ms.products || [])) {
            try {
                await this.applyQuickQuotePrefill({
                    style: p.style, color: p.color, colorName: p.colorName,
                    qty: 0, sizeBreakdown: p.sizeBreakdown || {}, location: ''
                });
                added++;
            } catch (e) {
                console.error('[MethodSwitch] product prefill failed', p.style, e);
                this.showToast(`Could not carry ${p.style} over — add it manually`, 'warning');
            }
        }
        this.showToast(`Switched from ${ms.fromLabel || 'another builder'} — customer + ${added} product${added === 1 ? '' : 's'} carried over. Pick the transfer locations.`, 'success');
        try { history.replaceState(null, '', window.location.pathname); } catch (_) { }
    },

    async applyQuickQuotePrefill(qq) {
        try {
            await this.addProductFromQuote({
                styleNumber: qq.style,
                color: qq.color || qq.colorName,
                sizeBreakdown: qq.sizeBreakdown
            });
            this.showToast('Loaded ' + qq.style + ' from Quick Quote — verify color, quantities & pricing', 'info');
        } catch (e) {
            console.error('[QuickQuote prefill] failed:', e);
            this.showToast('Could not prefill ' + qq.style + ' from Quick Quote — add it manually', 'error');
        }
        if (typeof clearQuickQuoteParams === 'function') clearQuickQuoteParams();
    },

    /**
     * Load existing quote for editing
     * Populates all form fields with quote data.
     * Returns true on success so duplicateQuote() can bail on a failed load.
     */
    async loadQuoteForEditing(quoteId, opts = {}) {

        // Show loading toast
        if (typeof showToast === 'function') {
            showToast('Loading quote...', 'info');
        }

        try {
            const result = await this.quoteService.loadQuote(quoteId);
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
            this.editingQuoteId = quoteId;
            this.editingRevision = session.RevisionNumber || 1;

            // Update page header to show edit mode (duplicate mode sets its own banner)
            if (!opts.forDuplicate) this.updateEditModeUI(quoteId, this.editingRevision);

            // Populate customer information
            this.populateCustomerInfo(session);

            // Populate additional charges (2026 fee refactor)
            this.populateAdditionalCharges(session);

            // Populate selected locations
            this.populateLocationsFromSession(session);

            // Populate products from line items
            await this.populateProductsFromItems(items);

            // Recalculate pricing to update totals
            this.updatePricing();

            // [2026-06-11] restore state that previously didn't round-trip —
            // include-tax, LTM waive/display, design #, special notes. Without
            // these a no-tax quote re-billed 10.1% on the next save, a waived
            // LTM silently resurrected, and Save Revision wiped the design link.
            let notesMeta = {};
            try { notesMeta = JSON.parse(session.Notes || '{}') || {}; } catch (e) { /* legacy free-text notes */ }
            this._loadedNotesMeta = notesMeta;
            const designInput = document.getElementById('design-number');
            if (designInput && notesMeta.designNumber) designInput.value = notesMeta.designNumber;
            const notesInput = document.getElementById('dtf-notes');
            if (notesInput && notesMeta.specialNotes) notesInput.value = notesMeta.specialNotes;
            const includeTaxEl = document.getElementById('include-tax');
            if (includeTaxEl) {
                includeTaxEl.checked = (typeof notesMeta.includeTax === 'boolean')
                    ? notesMeta.includeTax
                    // legacy quotes: TaxAmount 0 with a non-zero rate ⇒ tax was off
                    : !(Number(session.TaxAmount) === 0 && Number(session.TaxRate) > 0);
            }
            if (typeof setLtmControlState === 'function') {
                const waived = session.LTM_Waived === true || session.LTM_Waived === 'true' || session.LTM_Waived === 'Yes';
                setLtmControlState('dtf-ltm-panel', {
                    enabled: !waived,
                    displayMode: session.LTM_Display_Mode || 'builtin'
                });
            }
            // Re-run pricing so the restored toggles flow into totals/tax
            this.updatePricing();

            // Reveal Push-to-ShopWorks for this loaded (still-editable) quote so
            // the rep can push without re-saving. Already-pushed quotes never
            // reach here — assertQuoteEditable() sends them to read-only view.
            // Duplicate mode: pushing the SOURCE id would re-order the original —
            // the button stays hidden until the new quote is saved.
            if (!opts.forDuplicate && typeof showDtfPushButton === 'function') {
                showDtfPushButton(quoteId);
            }

            // Populating the form above runs the same mutation paths a user would
            // (updateSelectedLocations, synthetic size-input change events) — a
            // freshly loaded quote has no unsaved work, so clear the dirty flag.
            this.markAsSaved();

            if (!opts.forDuplicate && typeof showToast === 'function') {
                showToast(`Editing ${quoteId} (Rev ${this.editingRevision})`, 'success');
            }

            return true;

        } catch (error) {
            console.error('[EditMode] Error loading quote:', error);
            if (typeof showToast === 'function') {
                showToast('Error loading quote: ' + error.message, 'error');
            }
            // Clear edit mode
            this.editingQuoteId = null;
            this.editingRevision = null;
            return false;
        }
    },

    /**
     * Duplicate an existing quote as a brand-new one (repeat orders — EMB parity 2026-06-11).
     * Loads through the REAL edit path — so the engine reprices everything from the
     * live API (last year's transfers correctly become today's price) — then clears
     * all edit/push state so the next Save creates a NEW QuoteID. Works on
     * pushed/locked quotes too (the classic reorder case): the source is never written.
     */
    async duplicateQuote(sourceQuoteId) {
        const loaded = await this.loadQuoteForEditing(sourceQuoteId, { forDuplicate: true });
        if (!loaded) return;   // load failed — error already shown

        // Clear edit/push state (mirrors the resetQuote checklist) so save → NEW quote
        this.editingQuoteId = null;
        this.editingRevision = null;
        this._duplicatedFromQuoteId = sourceQuoteId;   // saveAndGetLink: carry design link/artwork meta forward

        // Order-specific fields must not carry over — order #/PO/dates belong to the ORIGINAL order
        ['order-number', 'po-number', 'req-ship-date', 'drop-dead-date'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = '';
        });

        // Duplicate banner (updateEditModeUI was suppressed in duplicate mode)
        const headerSubtitle = document.querySelector('.power-header .power-header-subtitle');
        if (headerSubtitle) {
            headerSubtitle.innerHTML = `<span style="color: #34d399;">📋 Duplicated from ${escapeHtml(String(sourceQuoteId))} — saving creates a NEW quote at today's prices</span>`;
        }
        this.markAsUnsaved();
        if (typeof showToast === 'function') {
            showToast(`Duplicated ${sourceQuoteId} — prices refreshed to today's rates. Saving will create a new quote #.`, 'success', 7000);
        }
    },

    /**
     * Save quote and show shareable link modal
     * Called from "Save & Get Shareable Link" button
     */
    async saveAndGetLink(opts = {}) {
        const customerName = document.getElementById('customer-name')?.value?.trim() || '';
        const customerEmail = document.getElementById('customer-email')?.value?.trim() || '';
        const companyName = document.getElementById('company-name')?.value?.trim() || '';
        const salesRep = document.getElementById('sales-rep')?.value || 'sales@nwcustomapparel.com';

        // Validate required fields — toast + focus like EMB/SCP; the old alert()
        // cascade stole keyboard focus mid-call and had to be dismissed one dialog
        // at a time. (expert audit 2026-07-07)
        if (!customerName) {
            this.showError('Please enter customer name');
            document.getElementById('customer-name')?.focus();
            return;
        }

        if (!customerEmail) {
            this.showError('Please enter customer email');
            document.getElementById('customer-email')?.focus();
            return;
        }

        // Validate email format (shared isValidEmail, Rule 8; local regex fallback)
        const emailOk = (typeof isValidEmail === 'function')
            ? isValidEmail(customerEmail)
            : /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail);
        if (!emailOk) {
            this.showError('Please enter a valid email address');
            document.getElementById('customer-email')?.focus();
            return;
        }

        // Check if there are products
        if (!this.products || this.products.length === 0) {
            this.showError('Please add at least one product to the quote');
            return;
        }

        const totalQty = this.getTotalQuantity();
        if (totalQty === 0) {
            this.showError('Please add quantities to your products');
            return;
        }

        // A quote with ZERO transfer locations prices garment-only (no transfer,
        // labor, or freight — roughly half the real price) and would save/print/
        // push that way. Only the clipboard path blocked it. (expert audit 2026-07-07)
        if (!this.selectedLocations || this.selectedLocations.length === 0) {
            this.showError('Select at least one transfer location — the quote is garment-only right now.');
            return;
        }

        // DTF's hard minimum (banner + the customer engine's BELOW_MINIMUM both say
        // 10): save/push previously accepted 6-pc quotes that also under-collected
        // the small-batch fee (fee computed at the clamped 10, billed × actual 6 =
        // $30 of $50). Block at the boundary the engine enforces. (expert audit 2026-07-07)
        const minQty = this.getMinimumQuantity();
        if (totalQty < minQty) {
            this.showError(`DTF minimum is ${minQty} pieces — add ${minQty - totalQty} more piece${(minQty - totalQty) === 1 ? '' : 's'} to save this quote.`);
            return;
        }

        // Pricing-loaded guard: calculateFromState() returns all zeros when the
        // pricing snapshot is missing (API failed / save raced edit-load). Saving
        // would persist a $0 quote with a success modal — Erik's #1 rule: visible
        // failure, never a silent wrong price. (2026-06-11)
        if (!this.currentPricingData || !this.pricingCalculator) {
            this.showError('Pricing data is not loaded — cannot save. Please refresh and try again.');
            return;
        }

        // Quote ID: keep the id when editing; otherwise mint from the Caspio-backed
        // sequence (collision-safe across reps/tabs — the old Math.random() id was not)
        const quoteId = this.editingQuoteId || await this.quoteService.generateQuoteID();
        // Calculate from internal state (not DOM text) to avoid stale/drift issues
        const stateCalc = this.calculateFromState();
        if (!(stateCalc.subtotal > 0)) {
            this.showError('Quote totals computed to $0 — pricing may not have loaded. Please re-enter a quantity or refresh before saving.');
            return;
        }
        const subtotal = stateCalc.subtotal;
        const ltmFee = this.currentPricingData?.totalLtmFee || 0;
        // Fees/tax/grand total from the SAME state math the screen uses — never
        // scraped from DOM text (the old `parseFloat(...) || subtotal` silently
        // saved a products-only total whenever the DOM read failed, and treated a
        // legitimate $0.00 grand total as falsy). (2026-06-11)
        const totals = this.computeFeesAndTotals(stateCalc);
        const grandTotal = totals.grandTotal;

        // Build quote data
        // Phase 9 — include uploaded reference artwork file refs (if any)
        // Phase 11.3 (2026-05-24) — also pull newDesignName + per-file .placement
        // from the rich-mode widget, so the proxy can emit Designs[{name, Locations[]}]
        // for new-artwork pushes (creates a fresh design record in ShopWorks).
        let referenceArtwork = (window._dtfArtwork && typeof window._dtfArtwork.getFiles === 'function')
            ? window._dtfArtwork.getFiles()
            : [];
        let newDesignName = (window._dtfArtwork && typeof window._dtfArtwork.getDesignName === 'function')
            ? (window._dtfArtwork.getDesignName() || '').trim()
            : '';
        // [2026-06-11] Save Revision: the artwork widget starts empty on edit-load
        // (no restore API), so revisions silently wiped referenceArtwork/newDesignName
        // from Notes and the push lost its design link. Carry the loaded values
        // forward unless the rep uploaded replacements. Duplicate mode too: a reorder
        // keeps the same design files, just under a new quote #.
        if ((this.editingQuoteId || this._duplicatedFromQuoteId) && this._loadedNotesMeta) {
            if ((!referenceArtwork || referenceArtwork.length === 0) && Array.isArray(this._loadedNotesMeta.referenceArtwork)) {
                referenceArtwork = this._loadedNotesMeta.referenceArtwork;
            }
            if (!newDesignName && this._loadedNotesMeta.newDesignName) {
                newDesignName = this._loadedNotesMeta.newDesignName;
            }
        }

        // Phase 11.1 — include design # if rep picked one from the combobox
        const designNumber = document.getElementById('design-number')?.value?.trim() || '';

        const quoteData = {
            quoteId: quoteId,
            customerName,
            customerEmail,
            companyName,
            salesRep,
            // ShopWorks customer ID (#customer-number) — used as id_Customer on push
            customerNumber: document.getElementById('customer-number')?.value?.trim() || '',
            // [2026-06-11] was hardcoded '' — the rep's special instructions never
            // persisted to Notes.specialNotes on the Save & Get Link path
            notes: document.getElementById('dtf-notes')?.value?.trim() || '',
            referenceArtwork, // → quote-service writes to quote_sessions.Notes JSON
            newDesignName,    // → Notes.newDesignName; proxy reads this for Designs[0].name
            designNumber,     // → quote-service writes to quote_sessions.Notes.designNumber
            selectedLocations: this.selectedLocations,
            locationDetails: this.selectedLocations.map(loc => ({
                code: loc,
                label: this.locationConfig[loc]?.label,
                size: this.locationConfig[loc]?.size
            })),
            products: this.products.map(p => {
                const standardSizes = ['S', 'M', 'L', 'XL'];
                const allQuantities = {};
                const sizeGroups = [];

                // Get parent row early - we need it for both price and color/image data
                const parentRow = document.getElementById(`row-${p.id}`);
                // eslint-disable-next-line no-unused-vars -- verbatim (D1): unused in monolith
                const rowId = parentRow?.dataset?.rowId || parentRow?.dataset?.productId || p.id;

                // Read color from row dataset (HTML stores here) or product object (JS stores here)
                const color = parentRow?.dataset?.color || p.color || '';
                const catalogColor = parentRow?.dataset?.catalogColor || p.catalogColor || '';
                // Read image from row dataset (swatchUrl) or product object
                const imageUrl = parentRow?.dataset?.swatchUrl || p.imageUrl || '';

                // Collect standard size quantities
                standardSizes.forEach(size => {
                    allQuantities[size] = p.quantities[size] || 0;
                });

                // Add child row quantities (extended sizes) — from JS state,
                // not the DOM (2026-06-11 P2). One entry per actual child row.
                const stateChildren = this.getChildRowsForParent(p.id);
                stateChildren.forEach(child => {
                    const normalizedSize = child.size === 'XXL' ? '2XL' : (child.size === 'XXXL' ? '3XL' : child.size);
                    allQuantities[normalizedSize] = child.qty || 0;
                });

                // Build sizeGroups with calculated unit prices from displayed table
                // Standard sizes (S-XL) as one group
                const stdQtys = {};
                let stdTotalQty = 0;
                standardSizes.forEach(size => {
                    if (allQuantities[size] > 0) {
                        stdQtys[size] = allQuantities[size];
                        stdTotalQty += allQuantities[size];
                    }
                });

                if (stdTotalQty > 0) {
                    // Get unit price from calculated state (not DOM text)
                    const calcData = stateCalc.productTotals.get(p.id);
                    const unitPrice = calcData?.standardUnitPrice || 0;

                    sizeGroups.push({
                        sizes: stdQtys,
                        quantity: stdTotalQty,
                        unitPrice: unitPrice,
                        total: stdTotalQty * unitPrice,
                        // [2026-06-11] LTM component for quote_items metadata
                        pricing: { ltmPerUnit: this.currentPricingData?.ltmPerUnit || 0 },
                        effectiveCost: p.baseCost,
                        color: color,            // Include parent row color
                        catalogColor: catalogColor,
                        imageUrl: imageUrl
                    });
                }

                // Extended sizes — one group per ACTUAL child row, from JS state
                // (2026-06-11 P2: qty/price never read from the DOM). The old loop
                // iterated a hardcoded ['2XL'..'6XL'] list, so any other popup
                // size (XS, XXS, talls, youth, 7XL+) was charged in the totals
                // but silently dropped from quote_items — quote-view didn't foot
                // and the ShopWorks push under-billed those pieces. (2026-06-11)
                stateChildren.forEach(child => {
                    const qty = child.qty || 0;
                    if (qty <= 0) return;
                    // Normalize aliases the same way allQuantities does, so saved
                    // SizeBreakdown keys match the push's SIZE_TO_SUFFIX lookups
                    const size = child.size === 'XXL' ? '2XL' : (child.size === 'XXXL' ? '3XL' : child.size);

                    // Color may differ from parent if the rep changed it on the
                    // child row — color is display metadata that lives on the DOM
                    // row (state holds money fields only), parent fallback if gone
                    const childRow = document.getElementById(`row-${child.id}`);
                    const childColor = childRow?.dataset?.color || color;
                    const childCatalogColor = childRow?.dataset?.catalogColor || catalogColor;
                    const childImageUrl = childRow?.dataset?.swatchUrl || imageUrl;

                    // Get unit price from calculated state (not DOM text)
                    const childCalcData = stateCalc.childTotals.get(`row-${child.id}`);
                    const unitPrice = childCalcData?.unitPrice || 0;

                    sizeGroups.push({
                        sizes: { [size]: qty },
                        quantity: qty,
                        unitPrice: unitPrice,
                        total: qty * unitPrice,
                        // [2026-06-11] LTM component for quote_items metadata
                        pricing: { ltmPerUnit: this.currentPricingData?.ltmPerUnit || 0 },
                        effectiveCost: p.baseCost + (p.sizeUpcharges?.[size] || 0),
                        color: childColor,       // Use child row color (or parent fallback)
                        catalogColor: childCatalogColor,
                        imageUrl: childImageUrl
                    });
                });

                return {
                    styleNumber: p.styleNumber,
                    productName: p.description,
                    description: p.description,
                    color: color,               // Use row dataset value
                    catalogColor: catalogColor, // Use row dataset value
                    baseCost: p.baseCost,
                    sizeUpcharges: p.sizeUpcharges,
                    quantities: allQuantities,
                    sizeGroups: sizeGroups,
                    imageUrl: imageUrl          // Use row dataset value
                };
            }),
            totalQuantity: totalQty,
            subtotal: subtotal,
            ltmFee: ltmFee,
            total: grandTotal,
            grandTotal: grandTotal,
            // [2026-06-08] P0: pre-tax all-in (products + fees − discount + shipping) for the SAVE path — the
            // service stores SubtotalAmount=TotalAmount=this (mirror EMB) instead of double-taxing `total`.
            // [2026-06-11] from computeFeesAndTotals (state math), not DOM text — the old
            // `parseFloat(textContent) || subtotal` lost fees on any DOM hiccup and broke $0 quotes.
            preTaxSubtotal: totals.preTaxSubtotal,
            includeTax: document.getElementById('include-tax') ? !!document.getElementById('include-tax').checked : true,
            isWholesale: document.getElementById('wholesale-checkbox')?.checked || false,  // [2026-06-08] → IsWholesale; push routes to GL 2203
            pricingMetadata: this.currentPricingData ? {
                tier: this.currentPricingData.tier,
                marginDenominator: this.currentPricingData.marginDenom,
                laborCostPerLocation: this.currentPricingData.laborCostPerLoc,
                freightPerTransfer: this.currentPricingData.freightPerTransfer,
                ltmPerUnit: this.currentPricingData.ltmPerUnit,
                totalLtmFee: this.currentPricingData.totalLtmFee,
                transferBreakdown: this.currentPricingData.transferBreakdown
            } : null,
            // Order & shipping fields (2026.03 overhaul)
            customerPhone: document.getElementById('customer-phone')?.value?.trim() || '',
            projectName: document.getElementById('project-name')?.value?.trim() || '',
            orderNumber: document.getElementById('order-number')?.value?.trim() || '',
            poNumber: document.getElementById('po-number')?.value?.trim() || '',
            reqShipDate: document.getElementById('req-ship-date')?.value || '',
            dropDeadDate: document.getElementById('drop-dead-date')?.value || '',
            shipToName: document.getElementById('ship-to-name')?.value?.trim() || '',
            shipAddress: document.getElementById('ship-address')?.value?.trim() || '',
            shipCity: document.getElementById('ship-city')?.value?.trim() || '',
            shipState: document.getElementById('ship-state')?.value || 'WA',
            shipZip: document.getElementById('ship-zip')?.value?.trim() || '',
            shipMethod: document.getElementById('ship-method')?.value || '',
            // [2026-06-11] all fee/tax fields from computeFeesAndTotals — single source with the
            // screen. The old inline discount IIFE used a products-only percent base while the
            // screen discounts products+art+design+rush, so saved Discount disagreed with the
            // tax base; taxRate's `|| '10.1'` also overwrote a legitimate cleared/0 rate.
            taxRate: totals.taxRatePct,
            createdAt: new Date().toISOString(),
            builderVersion: '2026.03',
            // Additional charges (2026 fee refactor)
            artCharge: totals.artCharge,
            graphicDesignHours: totals.designHours,
            graphicDesignCharge: totals.graphicDesignCharge,
            rushFee: totals.rushFee,
            discount: totals.discount,
            discountPercent: totals.discountType === 'percent' ? totals.discountAmount : 0,
            discountReason: document.getElementById('discount-reason')?.value || '',
            // LTM display preferences (2026-03-22)
            ltmDisplayMode: getLtmControlState('dtf-ltm-panel').displayMode || 'builtin',
            ltmWaived: !getLtmControlState('dtf-ltm-panel').enabled,
            // Shipping fee + notes (2026-03-22)
            shippingFee: parseFloat(document.getElementById('dtf-shipping-fee')?.value) || 0,
            // eslint-disable-next-line no-dupe-keys -- pre-existing monolith bug: 'notes' appears twice in this literal (identical expressions; last-wins). Kept verbatim (D1).
            notes: document.getElementById('dtf-notes')?.value?.trim() || ''
        };

        // Show saving state on button
        const saveBtn = document.querySelector('.btn-save-quote, [onclick*="saveAndGetLink"]');
        const originalText = saveBtn?.innerHTML;
        if (saveBtn) {
            saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
            saveBtn.disabled = true;
        }

        try {
            let result;
            let finalQuoteId = quoteId;

            if (this.editingQuoteId) {
                // Update existing quote
                quoteData.quoteId = this.editingQuoteId;
                finalQuoteId = this.editingQuoteId;
                result = await this.quoteService.updateQuote(this.editingQuoteId, quoteData);
                if (result && result.success) {
                    // Update revision number
                    this.editingRevision = result.revision;
                    this.updateEditModeUI(this.editingQuoteId, this.editingRevision);
                }
            } else {
                // Create new quote
                result = await this.quoteService.saveQuote(quoteData);
            }

            if (result.success) {

                // [2026-06-11] remember the id so Email Quote works on a fresh
                // save (editingQuoteId is only set by the ?edit= path)
                this.lastSavedQuoteId = finalQuoteId;

                // [2026-06-11] surface partial saves — some quote_items POSTs
                // failed but the old code showed the clean success modal anyway
                // (an under-billing quote went out looking verified)
                if (result.partialSave) {
                    this.showError(result.warning || 'Some line items FAILED to save — open the quote link and verify every line before sending.');
                    this.showToast('Quote saved INCOMPLETE — verify line items', 'error');
                }

                // Clear draft after successful save
                if (this.persistence) {
                    this.persistence.clearDraft();
                }
                this.markAsSaved();

                // Reveal the Push-to-ShopWorks button after a successful save.
                // Clicking it opens openDtfPushPreview() — a review-before-push
                // modal (parity with EMB/SCP) that shows the exact ShopWorks
                // payload before the rep confirms. (Order/design type IDs live in
                // caspio-pricing-proxy/config/manageorders-dtf-config.js: 18/8.)
                if (typeof showDtfPushButton === 'function') {
                    showDtfPushButton(finalQuoteId);
                }

                // Show success modal with shareable link — SKIPPED on the silent auto-save before a Push
                // (dtfPushToShopWorks passes skipShareModal:true; the push preview opens instead).
                if (opts.skipShareModal) {
                    /* auto-saved for Push to ShopWorks — no share modal */
                } else if (typeof QuoteShareModal !== 'undefined' && QuoteShareModal.show) {
                    QuoteShareModal.show(finalQuoteId, this.editingQuoteId ? `Updated to Rev ${this.editingRevision}` : null);
                } else if (typeof showSaveModal === 'function') {
                    // Fallback to inline modal if shared module not loaded
                    showSaveModal(finalQuoteId);
                } else {
                    // Last resort fallback
                    const url = `${window.location.origin}/quote/${finalQuoteId}`;
                    const message = this.editingQuoteId
                        ? `Quote updated!\n\nQuote ID: ${finalQuoteId}\nRevision: ${this.editingRevision}\n\nShareable Link:\n${url}`
                        : `Quote saved!\n\nQuote ID: ${finalQuoteId}\n\nShareable Link:\n${url}`;
                    alert(message);
                }
                // Return the freshly-saved ID so Push can confirm THIS save succeeded
                // instead of trusting a persistent _dtfPushQuoteId (which would push a
                // stale revision if this re-save just failed).
                return finalQuoteId;
            } else {
                throw new Error(result.error || 'Failed to save quote');
            }
        } catch (error) {
            console.error('[DTFQuoteBuilder] Save error:', error);
            alert('Error saving quote: ' + (error.message || 'Please try again.'));
            return null; // signal failure to callers (Push must not proceed)
        } finally {
            // Restore button state
            if (saveBtn) {
                // eslint-disable-next-line no-unsanitized/property -- self-restore of markup captured from this element
                saveBtn.innerHTML = originalText;
                saveBtn.disabled = false;
            }
        }
    },

    saveDraft() {
        const draftData = {
            locations: this.selectedLocations,
            products: this.products,
            timestamp: new Date().toISOString()
        };

        localStorage.setItem('dtf-quote-draft', JSON.stringify(draftData));
        this.showToast('Draft saved to browser storage', 'success');
    },

    markAsUnsaved() {
        this.hasChanges = true;
        dtfState.hasChanges = true;  // module-level mirror read by the shared beforeunload guard
        const indicator = document.getElementById('unsaved-indicator');
        if (indicator) {
            indicator.style.display = 'inline';
        }
    },

    markAsSaved() {
        this.hasChanges = false;
        dtfState.hasChanges = false;  // module-level mirror read by the shared beforeunload guard
        const indicator = document.getElementById('unsaved-indicator');
        if (indicator) {
            indicator.style.display = 'none';
        }
    },

    hasUnsavedChanges() {
        return this.hasChanges || dtfState.hasChanges;
    },

    /**
     * Attach dirty-flag listeners to every field that saveAndGetLink() persists
     * (mirrors EMB's setupUnsavedChangesTracking). input/change only fire on real
     * user interaction — programmatic .value sets during edit-load/draft restore
     * don't trip them. Product-table edits are caught by delegation on the tbody;
     * the synthetic change events loadQuoteForEditing() dispatches are cleared by
     * its trailing markAsSaved(). (2026-06-10)
     */
    setupUnsavedChangesTracking() {
        const fieldIds = [
            // Customer info
            'customer-name', 'customer-email', 'company-name', 'customer-lookup',
            'sales-rep', 'customer-phone', 'project-name', 'customer-number', 'design-number',
            // Additional charges
            'rush-fee', 'discount-amount', 'discount-reason', 'discount-type',
            'art-charge', 'art-charge-toggle', 'graphic-design-hours',
            // Order & shipping
            'order-number', 'po-number', 'req-ship-date', 'drop-dead-date',
            'ship-to-name', 'ship-address', 'ship-city', 'ship-state', 'ship-zip',
            'ship-method', 'dtf-shipping-fee',
            // Tax
            'tax-rate-input', 'include-tax', 'wholesale-checkbox'
        ];
        fieldIds.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.addEventListener('input', () => this.markAsUnsaved());
                el.addEventListener('change', () => this.markAsUnsaved());
            }
        });

        // Product table: size quantities, style typing, color picks all bubble here
        const tbody = document.getElementById('product-tbody');
        if (tbody) {
            tbody.addEventListener('input', () => this.markAsUnsaved());
            tbody.addEventListener('change', () => this.markAsUnsaved());
        }
    },

    confirmNewQuote() {
        if (this.hasUnsavedChanges()) {
            if (confirm('You have unsaved changes. Start a new quote?')) {
                this.resetQuote();
            }
        } else {
            this.resetQuote();
        }
    },

    resetQuote() {
        // Clear the "already pushed" lock + reset the Push button so the fresh quote is pushable. (review fix 2026-06-14)
        dtfState._dtfPushQuoteId = null;
        const _dtfPush = document.getElementById('dtf-push-shopworks-btn');
        if (_dtfPush) {
            delete _dtfPush.dataset.pushed;
            _dtfPush.style.background = '';
            const _l = document.getElementById('dtf-push-shopworks-label'); if (_l) _l.textContent = 'Push to ShopWorks';
        }
        if (typeof updateDtfPushButtonState === 'function') updateDtfPushButtonState();
        // Clear all product rows and re-add empty state
        const tbody = document.getElementById('product-tbody');
        tbody.innerHTML = `
            <tr id="empty-state-row">
                <td colspan="14" style="text-align: center; padding: 40px 20px; color: #64748b; background: #f8fafc;">
                    <div style="font-size: 32px; margin-bottom: 12px;">&#128085;</div>
                    <div style="font-size: 16px; font-weight: 500; margin-bottom: 8px;">Getting Started</div>
                    <div style="font-size: 13px; color: #94a3b8; line-height: 1.8;">
                        <span class="step-badge step-1">1</span> Select transfer locations above
                        &nbsp;&bull;&nbsp;
                        <span class="step-badge step-2">2</span> Type a style # (e.g., PC54, G500)
                        &nbsp;&bull;&nbsp;
                        <span class="step-badge step-3">3</span> Enter sizes and quantities
                    </div>
                </td>
            </tr>
        `;
        // Also clear fee rows
        const feesTbody = document.getElementById('fees-tbody');
        if (feesTbody) {
            feesTbody.querySelectorAll('.fee-row').forEach(row => {
                row.style.display = 'none';
            });
        }

        // Reset LTM control panel
        setLtmControlState('dtf-ltm-panel', { enabled: true, displayMode: 'builtin' });
        const ltmWrapperReset = document.getElementById('dtf-ltm-wrapper');
        if (ltmWrapperReset) ltmWrapperReset.style.display = 'none';

        // Reset state
        this.products = [];
        this.childRows.clear();  // extended-size state — paired with window.childRowMap = {} below (2026-06-11 P2)
        this.productIndex = 0;
        this.selectedLocations = [];
        this.editingQuoteId = null;
        this.editingRevision = null;
        this._duplicatedFromQuoteId = null;

        // Reset location radios to None
        document.querySelectorAll('input[name="front-location"]').forEach(r => {
            r.checked = (r.value === '');
        });
        document.querySelectorAll('input[name="back-location"]').forEach(r => {
            r.checked = (r.value === '');
        });
        document.querySelectorAll('input[name="sleeve-location"]').forEach(cb => {
            cb.checked = false;
        });
        this.updateLocationSummary();

        // Reset customer form fields. customer-number + design-number were OMITTED,
        // so a "New Quote" kept the PREVIOUS customer's ShopWorks # and design link —
        // the next pushed order silently attached to the wrong customer/design. (2026-06-01)
        ['customer-name', 'customer-email', 'company-name', 'customer-lookup',
         'customer-phone', 'project-name', 'customer-number', 'design-number'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = '';
        });
        // Clear the uploaded-artwork widget + design autocomplete so the prior quote's
        // hosted logo + new-design name don't ride along on the next push. (2026-06-01)
        try { if (window._dtfArtwork && typeof window._dtfArtwork.clear === 'function') window._dtfArtwork.clear(); } catch (_) {}
        try { if (window._dtfDesignCombobox && typeof window._dtfDesignCombobox.refresh === 'function') window._dtfDesignCombobox.refresh(); } catch (_) {}

        // Reset order & shipping fields
        ['order-number', 'po-number', 'req-ship-date', 'drop-dead-date',
         'ship-to-name', 'ship-address', 'ship-city', 'ship-zip', 'ship-method'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = '';
        });
        const stateSelect = document.getElementById('ship-state');
        if (stateSelect) stateSelect.value = 'WA';

        // Reset tax rate to default
        const taxRateInput = document.getElementById('tax-rate-input');
        if (taxRateInput) taxRateInput.value = '10.2';

        // Collapse order details panel
        const orderContent = document.getElementById('order-details-content');
        const orderChevron = document.getElementById('order-details-chevron');
        if (orderContent) orderContent.classList.add('hidden');
        if (orderChevron) orderChevron.style.transform = 'rotate(-90deg)';

        // Reset additional charges
        ['rush-fee', 'discount-amount', 'discount-reason', 'graphic-design-hours'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = '';
        });

        // Reset art charge toggle
        const artToggle = document.getElementById('art-charge-toggle');
        const artInput = document.getElementById('art-charge');
        const artWrapper = document.getElementById('art-charge-wrapper');
        if (artToggle) artToggle.checked = false;
        if (artInput) { artInput.value = ''; artInput.disabled = true; }
        if (artWrapper) artWrapper.style.opacity = '0.4';

        // Reset graphic design total display
        const designTotal = document.getElementById('graphic-design-total');
        if (designTotal) designTotal.textContent = '0.00';

        // Reset shipping fee + discount type — the shipping fee bled into the next
        // quote's taxable total after "New Quote" (inflating the price); discount-type
        // kept a prior 'percent' mode. (2026-06-01)
        const shipFeeInput = document.getElementById('dtf-shipping-fee');
        if (shipFeeInput) shipFeeInput.value = '0';
        const discTypeSel = document.getElementById('discount-type');
        if (discTypeSel) discTypeSel.value = 'fixed';

        // [2026-06-11] New Quote cleanup that was missing: stale childRowMap entries
        // collided with the next quote's row IDs (phantom extended-size line items),
        // #dtf-notes bled into the next quote's saved Notes, and the Push button +
        // editing banner stayed bound to the previous quote.
        // eslint-disable-next-line no-restricted-syntax -- pre-existing window contract (verbatim mixin move, Batch 4.2)
        window.childRowMap = {};
        this._loadedNotesMeta = null;
        const dtfNotesEl = document.getElementById('dtf-notes');
        if (dtfNotesEl) dtfNotesEl.value = '';
        const pushBtnReset = document.getElementById('dtf-push-shopworks-btn');
        if (pushBtnReset) pushBtnReset.style.display = 'none';
        if (typeof dtfState._dtfPushQuoteId !== 'undefined') dtfState._dtfPushQuoteId = null;
        // Hide + zero the sidebar TOTAL bar (re-shown on first recalc — EMB parity)
        const _stb = document.getElementById('sidebar-total-bar');
        if (_stb) _stb.hidden = true;
        const _stg = document.getElementById('sidebar-grand-total');
        if (_stg) _stg.textContent = '$0.00';
        const headerSubtitleReset = document.querySelector('.power-header .power-header-subtitle');
        if (headerSubtitleReset) headerSubtitleReset.textContent = 'Direct-to-Film Transfers';
        const saveBtnReset = document.querySelector('.btn-save-quote, [onclick*="saveAndGetLink"]');
        if (saveBtnReset) saveBtnReset.innerHTML = '<i class="fas fa-link"></i> Save & Get Shareable Link';
        if (window.location.search.includes('edit=') || window.location.search.includes('duplicate=')) {
            try { history.replaceState(null, '', window.location.pathname); } catch (_) {}
        }

        // Clear draft storage
        if (this.persistence) {
            this.persistence.clearDraft();
        }

        // Mark as saved (no unsaved changes)
        this.markAsSaved();

        // Update sidebar. [2026-06-11] updateSidebar() is defined NOWHERE — the
        // call threw on every New Quote, aborting the reset midway (everything
        // after this line, including the 2026-06-08 include-tax re-check, never
        // ran — the source of several state-bleed bugs).
        this.updateSearchState();

        // Focus search bar for immediate typing
        const searchInput = document.getElementById('product-search');
        if (searchInput) {
            searchInput.focus();
        }

        // eslint-disable-next-line no-restricted-syntax -- pre-existing window contract (verbatim mixin move, Batch 4.2)
        window._taxExempt = false; window._isWholesale = false; { const _wcb = document.getElementById('wholesale-checkbox'); if (_wcb) _wcb.checked = false; const _it = document.getElementById('include-tax'); if (_it) _it.checked = true; }  // [2026-06-08] P0: clear tax-exempt/wholesale flags, uncheck box, RE-CHECK include-tax on New Quote (else next quote bills $0 tax)
        // eslint-disable-next-line no-restricted-syntax -- pre-existing window contract (verbatim mixin move, Batch 4.2)
        { const _r = document.getElementById('ship-residential'); if (_r) _r.checked = false; const _er = document.getElementById('estimate-ship-result'); if (_er) _er.innerHTML = ''; window._lastShipEstimate = null; }  // [2026-06-08] clear estimator state on New Quote (residential flag + result text + last estimate shouldn't bleed)
        // [2026-06-11] repaint totals — the zero-qty branch blanks subtotal/grand
        // (they previously kept the old quote's numbers until the next interaction)
        this.updatePricing();
        this.showToast('Started new quote', 'success');
        if (typeof window.renderOrderRecap === 'function') window.renderOrderRecap();  // [2026-06-08] clear the order-summary band on New Quote (reset doesn't recalc)
    },
};
