/**
 * DTF Quote Builder - Excel-Style Layout
 * Two-column layout with sidebar location selection and product table
 *
 * Features:
 * - 9 transfer locations with conflict zone enforcement
 * - Excel-style product table with inline editing
 * - Real-time pricing in sidebar
 * - 100% API-driven pricing
 */

// API response cache (prevent 429 rate limit errors on extended size lookups)
const sizeDetectionCache = new Map(); // key: "style-color" → extended sizes array

// Unsaved-changes flag read by the shared hasUnsavedChanges()/setupBeforeUnloadGuard()
// in quote-builder-utils.js (EMB/SCP pattern — top-level `let` so the shared functions
// see the same binding). Mirrored by DTFQuoteBuilder.markAsUnsaved/markAsSaved. (2026-06-10)
let hasChanges = false;

class DTFQuoteBuilder {
    constructor() {
        // State
        this.selectedLocations = [];
        this.products = [];
        this.pricingData = null;
        this.productIndex = 0;

        // Extended-size child-row state — the SINGLE money source for
        // calculateFromState()/getTotalQuantity()/save/print. DOM child rows are
        // display-only. dtf-quote-page.js mirrors every DOM mutation here at the
        // same chokepoints (createChildRow / onChildSizeChange / removeChildRow /
        // parent-2XL sync). Keyed by numeric childRowId. (2026-06-11 P2 closure)
        this.childRows = new Map(); // childRowId → { parentId, size, qty, baseCost, sizeUpcharges }

        // Edit mode state
        this.editingQuoteId = null;
        this.editingRevision = null;
        // Duplicate mode (?duplicate=DTF-...): source quote id — keeps the loaded
        // Notes meta (design link / artwork refs) flowing into the NEW quote's save
        this._duplicatedFromQuoteId = null;

        // Unsaved changes tracking
        this.hasChanges = false;

        // Auto-save & Draft Recovery (2026 consolidation)
        this.persistence = null;
        this.session = null;
        this.initPersistence();

        // Location configuration
        this.locationConfig = {
            'left-chest': { label: 'Left Chest', size: 'Small', zone: 'front' },
            'right-chest': { label: 'Right Chest', size: 'Small', zone: 'front' },
            'left-sleeve': { label: 'Left Sleeve', size: 'Small', zone: 'sleeves' },
            'right-sleeve': { label: 'Right Sleeve', size: 'Small', zone: 'sleeves' },
            'back-of-neck': { label: 'Back of Neck', size: 'Small', zone: 'back' },
            'center-front': { label: 'Center Front', size: 'Medium', zone: 'front' },
            'center-back': { label: 'Center Back', size: 'Medium', zone: 'back' },
            'full-front': { label: 'Full Front', size: 'Large', zone: 'front' },
            'full-back': { label: 'Full Back', size: 'Large', zone: 'back' }
        };

        // Conflict zones - front and back are mutually exclusive within zone
        this.conflictZones = {
            front: ['left-chest', 'right-chest', 'center-front', 'full-front'],
            back: ['back-of-neck', 'center-back', 'full-back'],
            sleeves: ['left-sleeve', 'right-sleeve'] // Independent - both allowed
        };

        // Services
        this.quoteService = new window.DTFQuoteService();
        this.pricingCalculator = new window.DTFQuotePricing();
        this.productsManager = new window.DTFQuoteProducts();

        // Initialize EmailJS
        if (typeof emailjs !== 'undefined') {
            emailjs.init('4qSbDO-SQs19TbP80');
        }

        // Initialize
        this.init();
    }

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
    }

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
    }

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
    }

    /**
     * Get the next row ID - shared between parent rows and child rows
     * This prevents ID collisions between addProductRow() and createChildRow()
     */
    getNextRowId() {
        return ++this.productIndex;
    }

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

        // Check for edit mode (loading existing quote for revision)
        const editQuoteId = this.checkForEditMode();
        // Duplicate mode (?duplicate=DTF-...): load a copy as a NEW quote (EMB parity 2026-06-11)
        const duplicateQuoteId = new URLSearchParams(window.location.search).get('duplicate');
        if (duplicateQuoteId) {
            await this.duplicateQuote(duplicateQuoteId);
        } else if (editQuoteId) {
            // Skip draft recovery and load the existing quote instead
            await this.loadQuoteForEditing(editQuoteId);
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

                // [2026-06-08] P0 (Erik's #1 rule): honor tax-exempt customers — the CRM "TAX EXEMPT" chip was
                // cosmetic; the quote/PDF/push still billed WA tax. Mirror EMB. Also restore tax for a taxable
                // customer selected right after an exempt one (else the prior 0% bleeds → under-charge).
                var _wasExempt = !!window._taxExempt;
                window._taxExempt = (contact.Is_Tax_Exempt === true || contact.Is_Tax_Exempt === 1 || contact.Is_Tax_Exempt === '1');
                var _incTax = document.getElementById('include-tax');
                var _rateEl = document.getElementById('tax-rate-input');
                if (window._taxExempt) {
                    if (_incTax) _incTax.checked = false;
                    if (_rateEl) _rateEl.value = '0';
                    if (typeof updateTaxCalculation === 'function') updateTaxCalculation();
                } else if (_wasExempt) {
                    if (_incTax) _incTax.checked = true;
                    if (_rateEl && _rateEl.value === '0') _rateEl.value = '10.1';
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
            };

            customerLookup.bindToInput('customer-lookup', {
                onSelect: applyContact,
                onClear: () => {
                    document.getElementById('customer-name').value = '';
                    document.getElementById('customer-email').value = '';
                    document.getElementById('company-name').value = '';
                    window._taxExempt = false;  // [2026-06-08] P0: customer cleared → no longer exempt
                    if (typeof window.renderOrderRecap === 'function') window.renderOrderRecap();  // [2026-06-08] empty the recap when the lookup is cleared
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
    }

    async loadPricingData() {
        try {
            const response = await fetch('https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/pricing-bundle?method=DTF');
            if (!response.ok) {
                throw new Error(`API returned ${response.status}`);
            }
            this.pricingData = await response.json();
            this.hideError(); // Clear any previous errors
        } catch (error) {
            console.error('[DTFQuoteBuilder] Failed to load pricing:', error);
            this.showError('Unable to load pricing data. Please refresh the page or try again later.');
            throw error; // Re-throw to prevent silently continuing
        }
    }

    // ==================== EDIT MODE FUNCTIONS ====================

    /**
     * Check URL for edit parameter
     * Returns quote ID if editing, null otherwise
     */
    checkForEditMode() {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get('edit');
    }

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
    }

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
    }

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

        // Discount
        const discountAmountInput = document.getElementById('discount-amount');
        const discountTypeSelect = document.getElementById('discount-type');
        const discountReasonInput = document.getElementById('discount-reason');
        if ((session.Discount > 0 || session.DiscountPercent > 0) && discountAmountInput) {
            if (session.DiscountPercent > 0) {
                if (discountTypeSelect) discountTypeSelect.value = 'percent';
                discountAmountInput.value = session.DiscountPercent;
            } else {
                if (discountTypeSelect) discountTypeSelect.value = 'fixed';
                discountAmountInput.value = session.Discount;
            }
            if (discountReasonInput && session.DiscountReason) {
                discountReasonInput.value = session.DiscountReason;
            }
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
    }

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
    }

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
    }

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
    }

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
    }

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
    }

    // ==================== LOCATION MANAGEMENT ====================

    setupLocationListeners() {
        // Front radio buttons
        document.querySelectorAll('input[name="front-location"]').forEach(radio => {
            radio.addEventListener('change', () => this.updateSelectedLocations());
        });

        // Back radio buttons
        document.querySelectorAll('input[name="back-location"]').forEach(radio => {
            radio.addEventListener('change', () => this.updateSelectedLocations());
        });

        // Sleeve checkboxes
        document.querySelectorAll('input[name="sleeve-location"]').forEach(checkbox => {
            checkbox.addEventListener('change', () => this.updateSelectedLocations());
        });
    }

    updateSelectedLocations() {
        this.selectedLocations = [];

        // Get front selection (radio)
        const frontRadio = document.querySelector('input[name="front-location"]:checked');
        if (frontRadio && frontRadio.value) {
            this.selectedLocations.push(frontRadio.value);
        }

        // Get back selection (radio)
        const backRadio = document.querySelector('input[name="back-location"]:checked');
        if (backRadio && backRadio.value) {
            this.selectedLocations.push(backRadio.value);
        }

        // Get sleeve selections (checkboxes)
        document.querySelectorAll('input[name="sleeve-location"]:checked').forEach(checkbox => {
            this.selectedLocations.push(checkbox.value);
        });


        // Update UI
        this.updateLocationSummary();
        this.updateSearchState();
        this.updatePricing();

        // Mark dirty for auto-save
        if (this.persistence) {
            this.persistence.markDirty();
        }
        this.markAsUnsaved();
    }

    updateLocationSummary() {
        const locationDisplay = document.getElementById('location-display');
        const sidebarLocation = document.getElementById('sidebar-location');

        if (this.selectedLocations.length === 0) {
            if (locationDisplay) locationDisplay.textContent = 'None selected';
            if (sidebarLocation) sidebarLocation.textContent = '-';
            return;
        }

        // Build location names list
        const locationNames = this.selectedLocations.map(loc => {
            const config = this.locationConfig[loc];
            return config ? config.label : loc;
        });

        const displayText = locationNames.join(' + ');

        if (locationDisplay) locationDisplay.textContent = displayText;
        if (sidebarLocation) sidebarLocation.textContent = displayText;
    }

    updateSearchState() {
        const searchHint = document.getElementById('search-hint');

        // Search is always enabled - user can add products before selecting locations
        // Pricing will show "-" until locations are selected
        if (this.selectedLocations.length > 0) {
            if (searchHint) searchHint.textContent = 'Type to search (e.g., PC54, G500)';
        } else {
            if (searchHint) searchHint.textContent = 'Select locations above to see pricing (products can be added now)';
        }
    }

    // ==================== PRODUCT SEARCH ====================

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
    }

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
    }

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
    }

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
            <div class="suggestion-item" data-style="${p.value}">
                <span class="style-number">${p.value}</span>
                <span class="style-name">${p.label ? p.label.split(' - ')[1] || p.label : ''}</span>
            </div>
        `).join('');

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
    }

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
    }

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
    }

    // ==================== PRODUCT TABLE ====================

    // addProductRow() REMOVED 2026-06-11 (deprecated, zero callers). It built
    // rows with .row-price/.row-qty markup + its own handlers, conflicting with
    // the live addNewRow()/onSizeChange() path — its 2XL input wrote quantities
    // into a bucket every money path ignored. setupColorPicker() below is now
    // unreferenced and kept only for the EMB-pattern reference.

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
    }

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

    }

    /**
     * Handle keyboard navigation in size input cells (Tab, Enter, Arrow keys)
     * Matches Embroidery/Screen Print/DTG keyboard navigation pattern
     */
    handleCellKeydown(event, input) {
        const row = input.closest('tr');
        const tbody = document.getElementById('product-tbody');
        const rows = Array.from(tbody.querySelectorAll('tr'));
        const currentRowIndex = rows.indexOf(row);

        if (event.key === 'Enter' || event.key === 'ArrowDown') {
            event.preventDefault();
            // Move to same column in next row
            if (currentRowIndex < rows.length - 1) {
                const nextRow = rows[currentRowIndex + 1];
                const size = input.dataset.size;
                const nextInput = nextRow.querySelector(`[data-size="${size}"]:not([disabled])`);
                if (nextInput) {
                    nextInput.focus();
                    nextInput.select();
                }
            }
        } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            // Move to same column in previous row
            if (currentRowIndex > 0) {
                const prevRow = rows[currentRowIndex - 1];
                const size = input.dataset.size;
                const prevInput = prevRow.querySelector(`[data-size="${size}"]:not([disabled])`);
                if (prevInput) {
                    prevInput.focus();
                    prevInput.select();
                }
            }
        } else if (event.key === 'ArrowRight' && input.selectionStart === input.value.length) {
            // Move to next size column in same row
            const cells = Array.from(row.querySelectorAll('.size-input:not([disabled])'));
            const currentIndex = cells.indexOf(input);
            if (currentIndex < cells.length - 1) {
                event.preventDefault();
                cells[currentIndex + 1].focus();
                cells[currentIndex + 1].select();
            }
        } else if (event.key === 'ArrowLeft' && input.selectionStart === 0) {
            // Move to previous size column in same row
            const cells = Array.from(row.querySelectorAll('.size-input:not([disabled])'));
            const currentIndex = cells.indexOf(input);
            if (currentIndex > 0) {
                event.preventDefault();
                cells[currentIndex - 1].focus();
                cells[currentIndex - 1].select();
            }
        }
    }

    // ==================== EXTENDED SIZE POPUP ====================

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
                    <p>${message}</p>
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
                    ? 'Extended sizes available for this product. Additional upcharges may apply.'
                    : 'These sizes have additional upcharges for transfers.'}
            </div>
        `;

        // Focus first input
        const firstInput = body.querySelector('.ext-size-input');
        if (firstInput) firstInput.focus();
    }

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
    }

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
    }

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
    }

    // handleSizeInputChange() REMOVED 2026-06-11 (deprecated, only wired by the
    // removed addProductRow()).

    // removeProductRow() REMOVED 2026-06-11 (deprecated, only referenced by the
    // removed addProductRow() template; live rows use deleteRow()/removeChildRow()).

    // ==================== PRICING CALCULATIONS ====================

    async updatePricing() {
        const totalQty = this.getTotalQuantity();
        const locationCount = this.selectedLocations.length;

        // Track if under minimum quantity (10 pieces)
        const isUnderMinimum = totalQty > 0 && totalQty < 10;

        // Show/hide minimum order warning
        const minOrderWarning = document.getElementById('min-order-warning');
        if (minOrderWarning) {
            minOrderWarning.style.display = isUnderMinimum ? 'block' : 'none';
        }

        // Handle zero quantity case
        if (totalQty === 0) {
            document.getElementById('total-qty').textContent = '0';
            document.getElementById('pricing-tier').textContent = '--';
            // Hide LTM table row (sidebar ltm-row doesn't exist in DTF)
            const ltmTableRow = document.getElementById('ltm-fee-row');
            if (ltmTableRow) ltmTableRow.style.display = 'none';
            document.getElementById('subtotal').textContent = '--';
            // DTF uses grand-total-with-tax instead of grand-total
            const grandTotalEl = document.getElementById('grand-total-with-tax');
            if (grandTotalEl) grandTotalEl.textContent = '--';
            // Clear all price and total cells
            document.querySelectorAll('.cell-price').forEach(cell => {
                cell.textContent = '-';
            });
            document.querySelectorAll('.cell-total').forEach(cell => {
                cell.textContent = '-';
            });
            return;
        }

        // For quantities under 10, use minimum tier (10) for pricing calculation
        // This shows estimated pricing so users understand costs
        const pricingQty = isUnderMinimum ? 10 : totalQty;

        // Ensure pricing data is loaded from API
        try {
            await this.pricingCalculator.ensureLoaded();
        } catch (error) {
            console.error('[DTFQuoteBuilder] Failed to load pricing data:', error);
            this.showError('Unable to load pricing data. Please refresh the page.');
            return;
        }

        // Get tier label from API (use pricingQty for tier lookup)
        const tier = this.pricingCalculator.getTierForQuantity(pricingQty);

        // Update sidebar displays
        document.getElementById('total-qty').textContent = totalQty;
        // Show tier with warning if under minimum
        const tierDisplay = isUnderMinimum ? `${totalQty} (Min 10)` : tier;
        document.getElementById('pricing-tier').textContent = tierDisplay;

        // Calculate costs from API using pricingQty (ensures valid tier pricing)
        const transferBreakdown = this.pricingCalculator.calculateTransferCosts(this.selectedLocations, pricingQty);
        const transferCost = transferBreakdown.total;
        const laborCostPerLoc = this.pricingCalculator.getLaborCostPerLocation();
        const laborCost = laborCostPerLoc * locationCount;
        const freightPerTransfer = this.pricingCalculator.getFreightPerTransfer(pricingQty);
        const freightCost = freightPerTransfer * locationCount;
        const ltmPerUnit = this.pricingCalculator.calculateLTMPerUnit(pricingQty);
        // Get original LTM fee from API (not ltmPerUnit * qty which causes precision loss: $4.16 × 12 = $49.92)
        const tierData = this.pricingCalculator.getTierData(pricingQty);
        const totalLtmFee = tierData.ltmFee || 0;
        // [2026-06-11] keep the static "$50 LTM" banner in sync with the API fee
        const ltmBannerAmt = document.getElementById('ltm-fee-banner-amount');
        if (ltmBannerAmt && totalLtmFee > 0) ltmBannerAmt.textContent = totalLtmFee.toFixed(0);
        const marginDenom = this.pricingCalculator.getMarginDenominator(pricingQty);

        // LTM control panel — show/hide based on whether LTM applies
        const wouldHaveLTM = totalLtmFee > 0 && totalQty > 0;
        const ltmWrapper = document.getElementById('dtf-ltm-wrapper');
        if (ltmWrapper) {
            if (wouldHaveLTM) {
                ltmWrapper.style.display = '';
                if (!document.querySelector('#dtf-ltm-panel .ltm-control-panel')) {
                    renderLtmControlPanel('dtf-ltm-panel', { feeAmount: totalLtmFee });
                    initLtmControlListeners('dtf-ltm-panel', () => {
                        this.updatePricing();
                    });
                } else {
                    setLtmControlState('dtf-ltm-panel', { feeAmount: totalLtmFee });
                }
            } else {
                ltmWrapper.style.display = 'none';
                setLtmControlState('dtf-ltm-panel', { enabled: true, displayMode: 'builtin' });
            }
        }

        // Read LTM control state
        const ltmCtrlState = getLtmControlState('dtf-ltm-panel');
        const ltmEnabled = wouldHaveLTM ? ltmCtrlState.enabled : true;
        const ltmDisplayMode = ltmCtrlState.displayMode || 'builtin';
        const effectiveLtmPerUnit = ltmEnabled ? ltmPerUnit : 0;
        const effectiveLtmFee = ltmEnabled ? totalLtmFee : 0;

        // Store for quote save
        this.currentPricingData = {
            transferBreakdown,
            laborCostPerLoc,
            freightPerTransfer,
            ltmPerUnit: effectiveLtmPerUnit,
            totalLtmFee: effectiveLtmFee,
            marginDenom,
            tier,
            ltmDisplayMode
        };
        // Mirror on window for inline HTML tax/discount functions
        window.currentPricingData = window.currentPricingData || {};
        window.currentPricingData.ltmFee = effectiveLtmFee;
        window.currentPricingData.ltmDisplayMode = ltmDisplayMode;

        // LTM display — show table row in "separate" mode as informational (included in price)
        // DTF's pricing engine bakes LTM into the rounded unit price, so the fee row shows
        // the LTM amount but it's already in the subtotal — not added separately
        const ltmTableRow = document.getElementById('ltm-fee-row');
        const ltmTableUnit = document.getElementById('ltm-row-unit');
        const ltmTableTotal = document.getElementById('ltm-row-total');

        if (effectiveLtmFee > 0 && ltmDisplayMode === 'separate') {
            if (ltmTableRow) {
                ltmTableRow.style.display = 'table-row';
                const ltmQtyCell = ltmTableRow.querySelector('.cell-qty');
                if (ltmQtyCell) ltmQtyCell.textContent = totalQty;
                if (ltmTableUnit) ltmTableUnit.textContent = `$${effectiveLtmPerUnit.toFixed(2)}`;
                if (ltmTableTotal) ltmTableTotal.textContent = `(included)`;
                // Update fee label to clarify it's informational
                const feeLabel = ltmTableRow.querySelector('.fee-label');
                if (feeLabel) feeLabel.innerHTML = '<i class="fas fa-info-circle"></i> LTM Fee ($' + effectiveLtmFee.toFixed(2) + ' included in unit prices)';
            }
        } else {
            // builtin mode or LTM waived — hide fee row
            if (ltmTableRow) ltmTableRow.style.display = 'none';
        }

        // Calculate subtotal and grand total
        let grandTotal = 0;

        // Process products from the products array (parent rows)
        this.products.forEach(product => {
            const row = document.querySelector(`tr[data-product-id="${product.id}"]`);
            if (!row) return;

            // Skip child rows here - they're processed separately below
            if (row.classList.contains('child-row')) return;

            let productTotal = 0;
            let baseUnitPrice = 0; // For display in style column
            let baseDisplayPrice = 0; // Price shown in unit preview (may or may not include LTM)

            // Only count non-extended sizes (S, M, LG, XL) - extended sizes are in child rows
            const standardSizes = ['S', 'M', 'L', 'XL'];
            Object.entries(product.quantities).forEach(([size, qty]) => {
                if (qty > 0 && standardSizes.includes(size)) {
                    const upcharge = this.getSizeUpcharge(size, product.sizeUpcharges);
                    const garmentCost = product.baseCost / marginDenom + upcharge;
                    // Full unit price includes LTM (unless waived) — rounding absorbs LTM
                    const unitPrice = garmentCost + transferCost + laborCost + freightCost + effectiveLtmPerUnit;
                    const roundedPrice = this.pricingCalculator.applyRounding(unitPrice);
                    // Price without LTM for separate mode display only
                    const priceWithoutLTM = this.pricingCalculator.applyRounding(garmentCost + transferCost + laborCost + freightCost);
                    // Always use roundedPrice for totals (LTM is baked in by pricing engine rounding)
                    // Separate mode fee row is informational — it shows how much LTM is included
                    productTotal += roundedPrice * qty;

                    // Track base unit price for display
                    if (baseUnitPrice === 0 && ['S', 'M', 'L'].includes(size)) {
                        baseUnitPrice = roundedPrice;
                        // Display price: builtin shows full price, separate shows base only
                        const displayPrice = (effectiveLtmPerUnit === 0 || ltmDisplayMode === 'builtin') ? roundedPrice : priceWithoutLTM;
                        baseDisplayPrice = displayPrice;
                    }
                }
            });

            // If no base price yet, calculate it for display
            if (baseUnitPrice === 0 && totalQty > 0) {
                const garmentCost = product.baseCost / marginDenom;
                const unitPrice = garmentCost + transferCost + laborCost + freightCost + effectiveLtmPerUnit;
                baseUnitPrice = this.pricingCalculator.applyRounding(unitPrice);
                const priceNoLTM = this.pricingCalculator.applyRounding(garmentCost + transferCost + laborCost + freightCost);
                baseDisplayPrice = (effectiveLtmPerUnit === 0 || ltmDisplayMode === 'builtin') ? baseUnitPrice : priceNoLTM;
            }

            // Update row price (per-unit, not line total)
            // Support both class-based (.row-price) and ID-based (#row-price-{id}) selectors
            const rowId = row.dataset.rowId || row.dataset.productId || product.id;
            const priceSpan = row.querySelector('.row-price') || document.getElementById(`row-price-${rowId}`);
            if (priceSpan) priceSpan.textContent = `$${baseDisplayPrice.toFixed(2)}`;

            // Update row total (all standard sizes for this product)
            const totalCell = row.querySelector('.cell-total') || document.getElementById(`row-total-${rowId}`);
            if (totalCell) {
                // productTotal includes all standard sizes for this product with rounded prices
                const rowQty = Object.entries(product.quantities)
                    .filter(([size]) => ['S', 'M', 'L', 'XL'].includes(size))
                    .reduce((sum, [, qty]) => sum + (qty || 0), 0);
                totalCell.textContent = rowQty > 0 ? `$${productTotal.toFixed(2)}` : '-';
            }

            grandTotal += productTotal;
        });

        // Process child rows (extended sizes) - they have different unit prices with upcharges.
        // Money fields (qty/baseCost/upcharges/size) come from this.childRows JS
        // state; the DOM row is located only to PAINT its price/total cells —
        // display-only, mirroring the parent-row loop above. (2026-06-11 P2 closure)
        this.childRows.forEach((child, childRowId) => {
            const qty = child.qty || 0;

            if (qty > 0) {
                // Get size upcharge for this extended size (XXL/2XL, 3XL/XXXL, 4XL, 5XL, 6XL)
                const upcharge = this.getSizeUpcharge(child.size, child.sizeUpcharges);

                // Calculate unit price with upcharge (add AFTER margin, not before)
                const garmentCost = child.baseCost / marginDenom + upcharge;
                const unitPrice = garmentCost + transferCost + laborCost + freightCost + effectiveLtmPerUnit;
                const roundedPrice = this.pricingCalculator.applyRounding(unitPrice);

                // Display mode: builtin shows LTM in price, separate shows base only
                let displayPrice;
                if (effectiveLtmPerUnit === 0 || ltmDisplayMode === 'builtin') {
                    displayPrice = roundedPrice;
                } else {
                    const priceWithoutLTM = garmentCost + transferCost + laborCost + freightCost;
                    displayPrice = this.pricingCalculator.applyRounding(priceWithoutLTM);
                }

                // Paint the display row (if present — pricing math doesn't need it)
                const childRow = document.getElementById(`row-${childRowId}`);
                if (childRow) {
                    const priceCell = childRow.querySelector('.cell-price');
                    if (priceCell) priceCell.textContent = `$${displayPrice.toFixed(2)}`;

                    // Update child row total (qty × price)
                    const childTotalCell = childRow.querySelector('.cell-total');
                    if (childTotalCell) {
                        childTotalCell.textContent = `$${(displayPrice * qty).toFixed(2)}`;
                    }
                }

                // Always use roundedPrice for grand total (LTM baked in by pricing engine rounding)
                grandTotal += roundedPrice * qty;
            }
        });

        // Update subtotal and grand total
        document.getElementById('subtotal').textContent = `$${grandTotal.toFixed(2)}`;
        updatePerUnitPrice(grandTotal, totalQty);

        // Compute per-piece savings for next tier nudge
        let nextTierSavings = null;
        try {
            const nextBreaks = [10, 24, 48, 72];
            const nextBreak = nextBreaks.find(b => totalQty < b);
            if (nextBreak && totalQty > 0) {
                const nextTierData = this.pricingCalculator.getTierData(nextBreak);
                const curMargin = marginDenom;
                const nextMargin = this.pricingCalculator.getMarginDenominator(nextBreak);
                if (curMargin && nextMargin && curMargin !== nextMargin) {
                    // Approximate: lower margin denom = higher price. Savings ≈ garment * (1/curMargin - 1/nextMargin)
                    // Use a typical $5 garment cost as reference
                    const typicalGarment = 5.0;
                    const curMarkup = typicalGarment / curMargin;
                    const nextMarkup = typicalGarment / nextMargin;
                    if (curMarkup > nextMarkup) nextTierSavings = curMarkup - nextMarkup;
                }
                // Also factor in transfer cost changes
                const nextTransfer = this.pricingCalculator.calculateTransferCosts(this.selectedLocations, nextBreak);
                if (nextTransfer && transferBreakdown) {
                    const transferSavings = (transferCost - nextTransfer.total);
                    nextTierSavings = (nextTierSavings || 0) + transferSavings;
                }
                // Factor in freight savings
                const nextFreight = this.pricingCalculator.getFreightPerTransfer(nextBreak) * locationCount;
                const freightSavings = freightCost - nextFreight;
                if (freightSavings > 0) nextTierSavings = (nextTierSavings || 0) + freightSavings;
                // Ensure positive
                if (nextTierSavings <= 0) nextTierSavings = null;
            }
        } catch (e) { /* graceful fallback */ }
        window.currentPricingData.nextTierSavings = nextTierSavings;
        updateQuantityNudge(totalQty, 'dtf', nextTierSavings);

        // Update pre-tax subtotal for tax calculation
        const preTaxSubtotal = document.getElementById('pre-tax-subtotal');
        if (preTaxSubtotal) {
            preTaxSubtotal.textContent = `$${grandTotal.toFixed(2)}`;
            preTaxSubtotal.dataset.base = grandTotal;  // [2026-06-08] P1: stable base for updateTaxCalculation (must NOT re-read its own fee-inflated textContent → double-count on a 2nd direct call)
        }

        // Update tax calculation if the function exists
        if (typeof updateTaxCalculation === 'function') {
            updateTaxCalculation();
        }

        // Enable/disable continue button
        const continueBtn = document.getElementById('continue-btn');
        if (continueBtn) {
            continueBtn.disabled = totalQty < 10 || this.selectedLocations.length === 0;
        }
    }

    getTotalQuantity() {
        // Count quantities from products array (only standard sizes - extended in child rows)
        const standardSizes = ['S', 'M', 'L', 'XL'];
        let total = this.products.reduce((sum, p) => {
            // Only count standard sizes to avoid double-counting child rows
            return sum + Object.entries(p.quantities)
                .filter(([size]) => standardSizes.includes(size))
                .reduce((s, [, q]) => s + (q || 0), 0);
        }, 0);

        // Add child row quantities (extended sizes) — from this.childRows JS
        // state, never the DOM (2026-06-11 P2 closure)
        this.childRows.forEach(child => {
            total += child.qty || 0;
        });

        return total;
    }

    getTierForQuantity(qty) {
        if (qty < 10) return 'Min 10';
        if (qty <= 23) return '10-23';
        if (qty <= 47) return '24-47';
        if (qty <= 71) return '48-71';
        return '72+';
    }

    /**
     * Calculate subtotal from internal state (not DOM).
     * Mirrors updatePricing() math but returns numbers for save/print.
     * @returns {{ subtotal: number, productTotals: Map<id, { standardTotal: number, standardUnitPrice: number }>, childTotals: Map<childRowId, { total: number, unitPrice: number }> }}
     */
    calculateFromState() {
        if (!this.currentPricingData || !this.pricingCalculator) {
            return { subtotal: 0, productTotals: new Map(), childTotals: new Map() };
        }

        // Reset the per-run fallback tracker; getSizeUpcharge() repopulates it and
        // _surfaceUpchargeFallbackWarning() (below) surfaces any hardcoded upcharge actually used.
        this._upchargeFallbackSizes = new Set();

        const totalQty = this.getTotalQuantity();
        const locationCount = this.selectedLocations.length;
        const isUnderMinimum = totalQty > 0 && totalQty < 10;
        const pricingQty = isUnderMinimum ? 10 : totalQty;

        const { marginDenom, ltmPerUnit, transferBreakdown, laborCostPerLoc, freightPerTransfer } = this.currentPricingData;
        const transferCost = transferBreakdown?.total ?? 0;
        const laborCost = (laborCostPerLoc ?? 0) * locationCount;
        const freightCost = (freightPerTransfer ?? 0) * locationCount;

        let subtotal = 0;
        const productTotals = new Map();
        const childTotals = new Map();

        // Standard sizes per product (same as updatePricing lines 1524-1595)
        const standardSizes = ['S', 'M', 'L', 'XL'];
        this.products.forEach(product => {
            let productTotal = 0;
            let baseDisplayPrice = 0;

            Object.entries(product.quantities).forEach(([size, qty]) => {
                if (qty > 0 && standardSizes.includes(size)) {
                    const upcharge = this.getSizeUpcharge(size, product.sizeUpcharges);
                    const garmentCost = product.baseCost / marginDenom + upcharge;
                    const unitPrice = garmentCost + transferCost + laborCost + freightCost + ltmPerUnit;
                    const roundedPrice = this.pricingCalculator.applyRounding(unitPrice);
                    productTotal += roundedPrice * qty;

                    if (baseDisplayPrice === 0 && ['S', 'M', 'L'].includes(size)) {
                        // Persist the LTM-INCLUSIVE rounded price. This is the SAVE/PRINT
                        // path: the stored FinalUnitPrice is what the ShopWorks push bills
                        // and must reconcile with the LTM-in SubtotalAmount. Stripping LTM
                        // here (priceNoLTM) under-priced every qty<24 DTF order pushed to
                        // ShopWorks by the full LTM fee. (LTM's separate-line presentation
                        // is an on-screen-only concern handled by updatePricing.) (2026-06-01)
                        baseDisplayPrice = roundedPrice;
                    }
                }
            });

            if (baseDisplayPrice === 0 && totalQty > 0) {
                const garmentCost = product.baseCost / marginDenom;
                const unitPrice = garmentCost + transferCost + laborCost + freightCost + ltmPerUnit;
                // LTM-inclusive (see standard-size note above) — persisted price bills the full amount.
                baseDisplayPrice = this.pricingCalculator.applyRounding(unitPrice);
            }

            productTotals.set(product.id, { standardTotal: productTotal, standardUnitPrice: baseDisplayPrice });
            subtotal += productTotal;
        });

        // Child rows (extended sizes) — from this.childRows JS state, NEVER the
        // DOM (2026-06-11 P2 closure: this was the last DOM read in the money
        // path). Keys stay `row-${id}` so save/print lookups are unchanged.
        this.childRows.forEach((child, childRowId) => {
            const qty = child.qty || 0;
            if (qty > 0) {
                const upcharge = this.getSizeUpcharge(child.size, child.sizeUpcharges);
                const garmentCost = child.baseCost / marginDenom + upcharge;
                const unitPrice = garmentCost + transferCost + laborCost + freightCost + ltmPerUnit;
                const roundedPrice = this.pricingCalculator.applyRounding(unitPrice);

                // LTM-inclusive (see standard-size note) — persisted child unit price bills the full amount.
                const displayPrice = roundedPrice;

                const childTotal = roundedPrice * qty;
                childTotals.set(`row-${childRowId}`, { total: childTotal, unitPrice: displayPrice });
                subtotal += childTotal;
            }
        });

        this._surfaceUpchargeFallbackWarning();
        return { subtotal, productTotals, childTotals };
    }

    /**
     * Compute the adjusted pre-tax subtotal, tax, and grand total from state +
     * fee inputs, mirroring updateTaxCalculation() (dtf-quote-page.js) exactly:
     * percent discount applies to products + art + design + rush; discount is
     * clamped at $0; shipping is added AFTER the discount (not discountable,
     * taxable in WA); tax is rounded to cents before summing.
     * SINGLE SOURCE for saveAndGetLink() and buildPricingDataForInvoice() so the
     * saved quote and the printed PDF always foot to the on-screen totals.
     * (2026-06-11 — the PDF previously taxed the screen's pre-tax subtotal while
     * footing line items from a divergent DOM/fallback path: $493.50 lines under
     * a $1,018.98 grand total on a real customer quote.)
     */
    computeFeesAndTotals(stateCalc) {
        const subtotal = stateCalc.subtotal;
        const artCharge = document.getElementById('art-charge-toggle')?.checked
            ? (parseFloat(document.getElementById('art-charge')?.value) || 0) : 0;
        const designHours = parseFloat(document.getElementById('graphic-design-hours')?.value) || 0;
        const grtRate = getServicePrice('GRT-75', 75);
        // A load FAILURE already toasts via loadServiceCodePrices(); this covers the silent case
        // where codes loaded but GRT-75 is missing, so a rep never bills the $75 default unwarned.
        if (designHours > 0 && !(window._serviceCodes && window._serviceCodes['GRT-75']) && !window._dtfGrtFallbackWarned) {
            window._dtfGrtFallbackWarned = true;
            const m = 'Graphic-design rate is an estimate ($' + grtRate.toFixed(2) + '/hr) — live pricing didn\'t return it. Verify before saving.';
            if (typeof this.showToast === 'function') this.showToast(m, 'warning'); else if (typeof showToast === 'function') showToast(m, 'warning');
        }
        const graphicDesignCharge = designHours * grtRate;
        const rushFee = parseFloat(document.getElementById('rush-fee')?.value) || 0;
        const discountAmount = parseFloat(document.getElementById('discount-amount')?.value) || 0;
        const discountType = document.getElementById('discount-type')?.value || 'fixed';
        // Percent base = products + fees (same as updateTaxCalculation, NOT products-only)
        const discountBase = subtotal + artCharge + graphicDesignCharge + rushFee;
        const discount = discountType === 'percent' ? discountBase * (discountAmount / 100) : discountAmount;
        const shippingFee = parseFloat(document.getElementById('dtf-shipping-fee')?.value) || 0;
        const preTaxSubtotal = Math.max(0, discountBase - discount) + shippingFee;
        const includeTax = document.getElementById('include-tax') ? !!document.getElementById('include-tax').checked : true;
        // Shared parseRatePercent: 0 is a VALID rate; only NaN/empty falls back (2026-06-10 EMB fix, synced)
        const taxRatePct = (typeof parseRatePercent === 'function')
            ? parseRatePercent(document.getElementById('tax-rate-input')?.value, 10.1)
            : (Number.isFinite(parseFloat(document.getElementById('tax-rate-input')?.value))
                ? parseFloat(document.getElementById('tax-rate-input')?.value) : 10.1);
        const taxAmount = includeTax ? Math.round(preTaxSubtotal * (taxRatePct / 100) * 100) / 100 : 0;
        const grandTotal = preTaxSubtotal + taxAmount;
        return {
            subtotal, artCharge, designHours, graphicDesignCharge, rushFee,
            discountAmount, discountType, discount, shippingFee,
            preTaxSubtotal, includeTax, taxRatePct, taxAmount, grandTotal
        };
    }

    showError(message) {
        const banner = document.getElementById('error-banner');
        if (banner) {
            banner.textContent = message;
            banner.style.display = 'block';
        } else {
            // Fallback to alert if no error banner element
            console.error('[DTFQuoteBuilder] Error:', message);
            alert(message);
        }
    }

    hideError() {
        const banner = document.getElementById('error-banner');
        if (banner) {
            banner.style.display = 'none';
        }
    }

    getSizeUpcharge(size, upcharges) {
        // Documented extended-size fallbacks. Per Erik's #1 rule a hardcoded price is allowed
        // ONLY as a fallback AND must surface a visible warning — so whenever we actually USE
        // one (the API didn't return that size) we flag it via _flagUpchargeFallback();
        // calculateFromState() then shows a toast so a rep never saves/bills a silent estimated
        // upcharge. (The customer engine THROWS PRICE_UNAVAILABLE in the same situation —
        // quote-cart-engine.js dtfSizeUpcharge.)
        const defaults = { '2XL': 2.00, '3XL': 3.00, '4XL': 4.00, '5XL': 5.00, '6XL': 6.00 };
        const sizeAliases = { 'XXL': '2XL', 'XXXL': '3XL' };
        const normalizedSize = sizeAliases[size] || size;

        if (!upcharges || Object.keys(upcharges).length === 0) {
            // No API upcharge data at all.
            if (defaults[normalizedSize] != null) this._flagUpchargeFallback(normalizedSize);
            return defaults[normalizedSize] || 0;
        }

        // Helper to get value (uses nullish coalescing to handle 0 values correctly)
        const getValue = (...keys) => {
            for (const key of keys) {
                if (upcharges[key] !== undefined && upcharges[key] !== null) {
                    return upcharges[key];
                }
            }
            return null;
        };

        const apiByKeys = {
            '2XL': getValue('2XL', '2X', 'XXL'),
            '3XL': getValue('3XL', '3X', 'XXXL'),
            '4XL': getValue('4XL', '4X'),
            '5XL': getValue('5XL', '5X'),
            '6XL': getValue('6XL', '6X')
        };

        if (defaults[normalizedSize] != null) {
            // Extended size: prefer the live API upcharge; fall back (flagged) if absent.
            if (apiByKeys[normalizedSize] != null) return apiByKeys[normalizedSize];
            this._flagUpchargeFallback(normalizedSize);
            return defaults[normalizedSize];
        }

        // Sizes outside 2XL-6XL (XS, talls LT/XLT/2XLT…, youth) have no hardcoded default —
        // use the API upcharge directly when present, else 0. (2026-06-11)
        return getValue(normalizedSize) ?? 0;
    }

    /** Record that a hardcoded extended-size upcharge was substituted because live pricing
     *  lacked it. Surfaced as a visible warning by calculateFromState() (Erik's #1 rule). */
    _flagUpchargeFallback(size) {
        if (!this._upchargeFallbackSizes) this._upchargeFallbackSizes = new Set();
        this._upchargeFallbackSizes.add(size);
    }

    /** Show ONE visible warning (de-duped per fallback set) when calculateFromState used any
     *  hardcoded extended-size upcharge fallback this run. */
    _surfaceUpchargeFallbackWarning() {
        const fb = this._upchargeFallbackSizes;
        const key = fb && fb.size > 0 ? [...fb].sort().join(', ') : '';
        if (!key) { this._upchargeWarnShownFor = ''; return; }
        if (key === this._upchargeWarnShownFor) return; // already warned for this exact set
        this._upchargeWarnShownFor = key;
        const msg = 'Size upcharge for ' + key + ' is an ESTIMATE — live pricing didn\'t return it. Verify before saving/printing.';
        if (typeof this.showToast === 'function') this.showToast(msg, 'warning');
        else if (typeof showToast === 'function') showToast(msg, 'warning');
        console.warn('[DTF] ' + msg + ' (sellingPriceDisplayAddOns missing these sizes)');
    }

    // ==================== BRIDGE METHODS FOR ROW-BASED INPUT ====================

    /**
     * Recalculate pricing - wrapper for updatePricing()
     * Called from global deleteRow() function
     */
    recalculatePricing() {
        this.updatePricing();
    }

    /**
     * Update pricing from a specific row's DOM data
     * Called from global onSizeChange() function
     * @param {number} rowId - The row ID
     * @param {HTMLElement} row - The row element
     */
    updatePricingFromRow(rowId, row) {
        // [2026-06-11] child rows are priced via their parent + childRowMap —
        // creating a this.products entry for them made phantom products (blank
        // style/desc) that leaked into clipboard text and the email payload,
        // and every money path had to know to filter them.
        if (row && row.classList && row.classList.contains('child-row')) {
            this.updatePricing();
            return;
        }
        // Find or create the product entry in this.products array
        let product = this.products.find(p => p.id === rowId);

        if (!product) {
            // Create new product entry if doesn't exist
            const styleInput = row.querySelector('.style-input');
            const descInput = row.querySelector('.desc-input');
            const baseCost = parseFloat(row.dataset.baseCost) || 0;
            const sizeUpcharges = row.dataset.sizeUpcharges ? JSON.parse(row.dataset.sizeUpcharges) : {};

            product = {
                id: rowId,
                styleNumber: styleInput ? styleInput.value : '',
                description: descInput ? descInput.value : '',
                baseCost: baseCost,
                sizeUpcharges: sizeUpcharges,
                color: row.dataset.colorName || '',
                catalogColor: row.dataset.catalogColor || '',
                quantities: { XS: 0, S: 0, M: 0, L: 0, XL: 0, '2XL': 0, '3XL': 0, '4XL': 0, '5XL': 0, '6XL': 0 }
            };
            this.products.push(product);
        }

        // Update quantities from row inputs (standard sizes)
        row.querySelectorAll('.size-input:not(.xxxl-picker-btn)').forEach(input => {
            const size = input.dataset.size;
            const qty = parseInt(input.value) || 0;
            if (size && product.quantities.hasOwnProperty(size)) {
                product.quantities[size] = qty;
            }
        });

        // Update extended sizes from row data attribute (set by applyExtendedSizes)
        if (row.dataset.extendedSizes) {
            try {
                const extendedQtys = JSON.parse(row.dataset.extendedSizes);
                Object.entries(extendedQtys).forEach(([size, qty]) => {
                    if (product.quantities.hasOwnProperty(size)) {
                        product.quantities[size] = qty;
                    }
                });
            } catch (e) {
                console.warn('[DTFQuoteBuilder] Failed to parse extended sizes:', e);
            }
        }

        // Recalculate pricing
        this.updatePricing();
    }

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
    }

    // ==================== CHILD ROW STATE (extended sizes) ====================
    // DOM child rows are display-only; these three methods are the ONLY writers
    // of this.childRows. dtf-quote-page.js calls them at the exact chokepoints
    // that mutate the DOM (createChildRow / onChildSizeChange / parent-2XL sync);
    // removal funnels through removeProduct(). (2026-06-11 P2 closure)

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
    }

    /**
     * Update a child row's quantity in JS state.
     */
    setChildRowQty(childRowId, qty) {
        const child = this.childRows.get(Number(childRowId));
        if (child) child.qty = parseInt(qty) || 0;
    }

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
    }

    /**
     * Get location codes string for display (e.g., "LC+CB" for Left Chest + Center Back)
     */
    getLocationCodesString() {
        if (this.selectedLocations.length === 0) return '--';

        const codeMap = {
            'left-chest': 'LC',
            'right-chest': 'RC',
            'left-sleeve': 'LS',
            'right-sleeve': 'RS',
            'back-of-neck': 'BN',
            'center-front': 'CF',
            'center-back': 'CB',
            'full-front': 'FF',
            'full-back': 'FB'
        };

        return this.selectedLocations.map(loc => codeMap[loc] || loc).join('+');
    }

    // ==================== SUMMARY & SAVE ====================

    showSummary() {
        const modal = document.getElementById('summary-modal');
        if (!modal) return;

        // [2026-06-11] real id when one exists; never a random provisional id
        // (it leaked onto #quote-id, which the printed PDF reads as the quote #)
        const quoteId = this.editingQuoteId || this.lastSavedQuoteId || 'Pending save';
        document.getElementById('quote-id').textContent = quoteId;

        // Build locations summary
        const locationsHTML = this.selectedLocations.map(loc => {
            const config = this.locationConfig[loc];
            return `<span class="summary-badge">${config.label} (${config.size})</span>`;
        }).join('');
        document.getElementById('summary-locations').innerHTML = locationsHTML;

        // Build products summary (including child row quantities)
        const productsHTML = this.products.map(p => {
            // Get standard sizes from products array (S, M, LG, XL only)
            const standardSizes = ['S', 'M', 'L', 'XL'];
            const allQuantities = {};
            let totalQty = 0;

            standardSizes.forEach(size => {
                const qty = p.quantities[size] || 0;
                if (qty > 0) {
                    allQuantities[size] = qty;
                    totalQty += qty;
                }
            });

            // Add child row quantities — from JS state, not the DOM (2026-06-11 P2)
            this.getChildRowsForParent(p.id).forEach(child => {
                const qty = child.qty || 0;
                if (qty > 0) {
                    // Normalize display size (XXL->2XL, XXXL->3XL)
                    const displaySize = child.size === 'XXL' ? '2XL' : (child.size === 'XXXL' ? '3XL' : child.size);
                    allQuantities[displaySize] = qty;
                    totalQty += qty;
                }
            });

            if (totalQty === 0) return '';

            const sizesStr = Object.entries(allQuantities)
                .map(([size, qty]) => `${size}: ${qty}`)
                .join(', ');

            return `
                <div class="summary-product">
                    <strong>${p.styleNumber}</strong> - ${p.description}
                    <br><small>Color: ${p.color || 'Not selected'} | ${sizesStr}</small>
                </div>
            `;
        }).filter(Boolean).join('');
        document.getElementById('summary-products').innerHTML = productsHTML || '<div>No products</div>';

        // Build pricing summary
        const totalQty = this.getTotalQuantity();
        const tier = this.getTierForQuantity(totalQty);
        // DTF uses grand-total-with-tax (not grand-total)
        const grandTotal = parseFloat(document.getElementById('grand-total-with-tax')?.textContent?.replace(/[$,]/g, '') || '0');

        document.getElementById('summary-pricing').innerHTML = `
            <div class="summary-pricing-row">
                <span>Total Quantity:</span>
                <span>${totalQty} pieces</span>
            </div>
            <div class="summary-pricing-row">
                <span>Pricing Tier:</span>
                <span>${tier}</span>
            </div>
            <div class="summary-pricing-row grand">
                <span>Grand Total:</span>
                <span>$${grandTotal.toFixed(2)}</span>
            </div>
        `;

        modal.style.display = 'flex';
    }

    // generateQuoteId() REMOVED 2026-06-11 — Math.random() 4-digit/day was
    // collision-prone across reps/tabs. saveAndGetLink() now mints ids from the
    // Caspio-backed /api/quote-sequence/DTF via quoteService.generateQuoteID().

    // Legacy saveQuote() REMOVED 2026-06-11 (dead: Ctrl+S now routes to
    // saveAndGetLink(); this path read #quote-notes — an element this page
    // doesn't have — and threw, and its payload lacked subtotal/taxRate/
    // includeTax so the service priced items at wholesale baseCost).

    /**
     * Save quote and show shareable link modal
     * Called from "Save & Get Shareable Link" button
     */
    async saveAndGetLink(opts = {}) {
        const customerName = document.getElementById('customer-name')?.value?.trim() || '';
        const customerEmail = document.getElementById('customer-email')?.value?.trim() || '';
        const companyName = document.getElementById('company-name')?.value?.trim() || '';
        const salesRep = document.getElementById('sales-rep')?.value || 'sales@nwcustomapparel.com';

        // Validate required fields
        if (!customerName) {
            alert('Please enter customer name');
            document.getElementById('customer-name')?.focus();
            return;
        }

        if (!customerEmail) {
            alert('Please enter customer email');
            document.getElementById('customer-email')?.focus();
            return;
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(customerEmail)) {
            alert('Please enter a valid email address');
            document.getElementById('customer-email')?.focus();
            return;
        }

        // Check if there are products
        if (!this.products || this.products.length === 0) {
            alert('Please add at least one product to the quote');
            return;
        }

        const totalQty = this.getTotalQuantity();
        if (totalQty === 0) {
            alert('Please add quantities to your products');
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
            } else {
                throw new Error(result.error || 'Failed to save quote');
            }
        } catch (error) {
            console.error('[DTFQuoteBuilder] Save error:', error);
            alert('Error saving quote: ' + (error.message || 'Please try again.'));
        } finally {
            // Restore button state
            if (saveBtn) {
                saveBtn.innerHTML = originalText;
                saveBtn.disabled = false;
            }
        }
    }

    saveDraft() {
        const draftData = {
            locations: this.selectedLocations,
            products: this.products,
            timestamp: new Date().toISOString()
        };

        localStorage.setItem('dtf-quote-draft', JSON.stringify(draftData));
        alert('Draft saved to browser storage');
    }

    /**
     * Print professional PDF quote using EmbroideryInvoiceGenerator
     * Transforms DTF product data into the format expected by the invoice generator
     */
    printQuote() {
        // Validate we have products
        if (this.products.length === 0 || this.getTotalQuantity() === 0) {
            alert('Add products before printing');
            return;
        }

        // Pricing-loaded guard (parity with saveAndGetLink L2332/L2342): if the pricing snapshot is
        // missing (API down at page load — init() keeps the form interactive), calculateFromState()
        // returns all zeros, so Print would emit a $0.00 customer PDF with no error. Erik's #1 rule:
        // visible failure, never a silent wrong price. (2026-06-14)
        if (!this.currentPricingData || !this.pricingCalculator) {
            this.showError('Pricing data is not loaded — cannot print. Please refresh and try again.');
            return;
        }
        if (!(this.calculateFromState().subtotal > 0)) {
            this.showError('Quote totals computed to $0 — pricing may not have loaded. Please re-enter a quantity or refresh before printing.');
            return;
        }

        try {
            // Build pricing data in format expected by EmbroideryInvoiceGenerator
            const pricingData = this.buildPricingDataForInvoice();

            // Customer data from form (includes order fields for PDF header)
            const customerData = {
                name: document.getElementById('customer-name')?.value || 'Customer',
                company: document.getElementById('company-name')?.value || '',
                email: document.getElementById('customer-email')?.value || '',
                phone: document.getElementById('customer-phone')?.value || '',
                salesRepEmail: document.getElementById('sales-rep')?.value || 'sales@nwcustomapparel.com',
                projectName: document.getElementById('project-name')?.value || '',
                orderNumber: document.getElementById('order-number')?.value || '',
                poNumber: document.getElementById('po-number')?.value || '',
                reqShipDate: document.getElementById('req-ship-date')?.value || '',
                // SPECIAL NOTES footer on the PDF (shared generator supports it;
                // EMB passes it — DTF never did, so rep notes silently vanished)
                notes: document.getElementById('dtf-notes')?.value?.trim() || ''
            };

            // Generate and open print window
            const invoiceGenerator = new EmbroideryInvoiceGenerator();
            const invoiceHTML = invoiceGenerator.generateInvoiceHTML(pricingData, customerData);

            const printWindow = window.open('', '_blank');
            printWindow.document.write(invoiceHTML);
            printWindow.document.close();

            setTimeout(() => {
                printWindow.print();
            }, 300);

        } catch (error) {
            console.error('Print error:', error);
            alert('Error generating PDF. Please try again.');
        }
    }

    /**
     * Build pricing data structure for EmbroideryInvoiceGenerator
     * Transforms DTF products into line items with size breakdowns
     */
    buildPricingDataForInvoice() {
        const totalQty = this.getTotalQuantity();
        // SINGLE SOURCE (2026-06-11): line items, subtotal, fees, tax base ALL come
        // from calculateFromState() + computeFeesAndTotals() — the same math the
        // save path uses. The old code computed line items from DOM-displayed
        // prices + a broken per-product fallback (transferBreakdown[loc] never
        // matched the {breakdown:[],total} shape, so the fallback silently dropped
        // ALL transfer costs and LTM) while taxing the screen's pre-tax subtotal:
        // a real customer PDF printed $15.50/unit lines footing to $493.50 under a
        // $1,018.98 GRAND TOTAL (true unit price $39.50, true subtotal $925.50).
        const stateCalc = this.calculateFromState();
        const totals = this.computeFeesAndTotals(stateCalc);
        const quoteId = document.getElementById('quote-id')?.textContent || this.editingQuoteId || `DTF-${Date.now()}`;

        // Build products array with line items
        const products = [];

        // Get pricing tier info
        const tier = this.currentPricingData?.tier || this.getTierForQuantity(totalQty);

        // Iterate through each product row. NO early qty-skip here: a product whose
        // only pieces are extended sizes has all-zero standard quantities, and the
        // old skip dropped it from the PDF entirely — the empty-lineItems guard at
        // the bottom handles truly empty products. (2026-06-11)
        this.products.forEach(product => {
            // Build line items - separate base sizes from extended sizes
            const lineItems = [];

            // Base sizes (S, M, L, XL) - 2XL is handled as child row to prevent double-counting
            const baseSizes = ['S', 'M', 'L', 'XL'];
            const baseSizeQtys = {};
            let baseQty = 0;

            baseSizes.forEach(size => {
                const qty = parseInt(product.quantities[size]) || 0;
                if (qty > 0) {
                    baseSizeQtys[size] = qty;
                    baseQty += qty;
                }
            });

            if (baseQty > 0) {
                // Build description string like "S(2) M(3) LG(1)"
                const desc = Object.entries(baseSizeQtys)
                    .map(([size, qty]) => `${size}(${qty})`)
                    .join(' ');

                // Unit price + line total from state math (same source as save) —
                // total uses standardTotal (per-size rounded sum), so lines always
                // foot to stateCalc.subtotal even if per-size prices ever differ
                const calcData = stateCalc.productTotals.get(product.id);
                lineItems.push({
                    description: desc,
                    quantity: baseQty,
                    unitPrice: calcData?.standardUnitPrice || 0,
                    total: calcData?.standardTotal || 0
                });
            }

            // Extended sizes — from this.childRows JS state (2026-06-11 P2:
            // the print path never reads the DOM). Qty from state; price/total
            // from the same stateCalc the save path uses — in separate-LTM
            // display mode the on-screen cell shows the LTM-stripped price
            // while the tax base is LTM-inclusive (rows under-footed).
            const extendedItems = [];  // Collect extended items for sorting
            this.getChildRowsForParent(product.id).forEach(child => {
                const qty = child.qty || 0;
                if (qty > 0) {
                    const childCalcData = stateCalc.childTotals.get(`row-${child.id}`);
                    const unitPrice = childCalcData?.unitPrice || 0;

                    // Normalize size display (XXL→2XL, XXXL→3XL for consistency)
                    const displaySize = child.size === 'XXL' ? '2XL' : (child.size === 'XXXL' ? '3XL' : child.size);
                    extendedItems.push({
                        description: `${displaySize}(${qty})`,
                        quantity: qty,
                        unitPrice: unitPrice,
                        total: childCalcData?.total ?? (qty * unitPrice),
                        hasUpcharge: true,
                        _sortKey: child.size  // Keep original size for sorting
                    });
                }
            });

            // Sort extended items by size order (2XL before 3XL, etc.)
            if (window.ExtendedSizesConfig?.getSizeSortIndex) {
                extendedItems.sort((a, b) =>
                    window.ExtendedSizesConfig.getSizeSortIndex(a._sortKey) -
                    window.ExtendedSizesConfig.getSizeSortIndex(b._sortKey)
                );
            }
            // Add sorted extended items to line items
            extendedItems.forEach(item => {
                delete item._sortKey;  // Remove sort key before adding
                lineItems.push(item);
            });

            if (lineItems.length > 0) {
                products.push({
                    product: {
                        style: product.styleNumber,
                        title: product.description,
                        color: product.color || ''
                    },
                    lineItems: lineItems
                });
            }
        });

        // Subtotal/fees/discount/tax all from the shared state math (computed above).
        // Line items were built from the SAME stateCalc, so the printed product rows
        // foot exactly to totals.subtotal and the fee rows foot to preTaxSubtotal.
        const discountReason = document.getElementById('discount-reason')?.value || '';

        return window.QuotePricingData.buildPricingData({
            method: 'DTF',
            quoteId: quoteId,
            tier: tier,
            products: products,
            subtotal: totals.subtotal,
            grandTotal: totals.subtotal,
            // Authoritative pre-tax adjusted subtotal drives the PDF tax + GRAND TOTAL
            // so the printed total matches the on-screen #grand-total-with-tax.
            preTaxSubtotal: totals.preTaxSubtotal,
            includeTax: totals.includeTax,
            // Numeric percent via shared parseRatePercent — the old `value || '10.1'`
            // silently printed 10.1% for a cleared field, and the generator treats
            // values ≤1 as decimals (typing '1' printed 100% tax). String of a
            // finite percent keeps the generator's >1 branch deterministic.
            taxRate: String(totals.taxRatePct),
            setupFees: 0,
            additionalServicesTotal: 0,
            // Empty logos means embroidery specs section will be skipped
            logos: [],
            // DTF-specific info
            selectedLocations: this.selectedLocations,
            locationDetails: this.selectedLocations.map(loc => ({
                code: loc,
                label: this.locationConfig[loc]?.label || loc,
                size: this.locationConfig[loc]?.size || ''
            })),
            ltmFee: this.currentPricingData?.totalLtmFee || 0,
            // ALWAYS true for DTF: the pricing engine bakes LTM into every unit
            // price (both display modes), so a separate $50 fee row would double-
            // display it and the PDF rows would over-foot by the LTM. The screen's
            // "separate" mode row is informational-only ("included"). (2026-06-11)
            ltmDistributed: true,
            totalQuantity: totalQty,
            // Artwork services
            artCharge: totals.artCharge,
            graphicDesignCharge: totals.graphicDesignCharge,
            graphicDesignHours: totals.designHours,
            // Itemized on the PDF so the rows foot to the total (already inside preTaxSubtotal).
            shippingFee: totals.shippingFee,
            // Rush and discount
            rushFee: totals.rushFee,
            discount: totals.discount,
            discountType: totals.discountType,
            discountReason: discountReason
        });
    }

    // calculateUnitPrice() and getTransferCostForProduct() REMOVED 2026-06-11.
    // They were the print path's per-product price source: a DOM read with a
    // provably broken fallback (transferBreakdown[loc] never matched the
    // {breakdown: [...], total} shape and read .cost where the field is
    // .unitCost, so fallback prices silently dropped ALL transfer costs and
    // LTM — a real customer PDF printed $15.50 for a $39.50 unit). The PDF now
    // sources every number from calculateFromState()/computeFeesAndTotals().

    // emailQuote() REMOVED 2026-06-11 (dead: zero callers — the live email path
    // is dtf-quote-page.js dtfEmailQuote() → shared emailQuote() in
    // quote-builder-utils.js, which emails the SAVED quote link).

    // ==================== UTILITY FUNCTIONS ====================

    /**
     * Focus the product search input (called by Add Product button)
     */
    focusProductSearch() {
        const searchInput = document.getElementById('product-search');
        if (searchInput && !searchInput.disabled) {
            searchInput.focus();
            searchInput.select();
        } else if (searchInput && searchInput.disabled) {
            this.showToast('Select a location first', 'warning');
        }
    }

    /**
     * Copy Quote ID to clipboard
     */
    copyQuoteId() {
        const quoteId = document.getElementById('quote-id').textContent;
        if (!quoteId || quoteId === 'DTF----') {
            this.showToast('No quote ID to copy', 'warning');
            return;
        }

        navigator.clipboard.writeText(quoteId).then(() => {
            this.showToast('Quote ID copied!', 'success');
        }).catch(err => {
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = quoteId;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            this.showToast('Quote ID copied!', 'success');
        });
    }

    /**
     * Clear all products from the quote
     */
    clearAllProducts() {
        if (this.products.length === 0) {
            this.showToast('No products to clear', 'info');
            return;
        }

        if (!confirm('Remove all products from this quote?')) return;

        // Clear products array
        this.products = [];
        this.productIndex = 0;

        // Clear table
        const tbody = document.getElementById('product-tbody');
        if (tbody) tbody.innerHTML = '';

        // Show empty state
        const emptyMessage = document.getElementById('empty-table-message');
        if (emptyMessage) emptyMessage.style.display = 'block';

        // Update pricing
        this.updatePricing();

        this.showToast('All products cleared', 'success');
    }

    /**
     * Show a toast notification
     * @param {string} message - Message to display
     * @param {string} type - 'success', 'error', 'warning', 'info'
     */
    showToast(message, type = 'info') {
        // Remove existing toast if any
        const existingToast = document.querySelector('.dtf-toast');
        if (existingToast) existingToast.remove();

        // Create toast element
        const toast = document.createElement('div');
        toast.className = `dtf-toast dtf-toast-${type}`;
        toast.innerHTML = `
            <i class="fas ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : type === 'warning' ? 'fa-exclamation-triangle' : 'fa-info-circle'}"></i>
            <span>${message}</span>
        `;

        document.body.appendChild(toast);

        // Trigger animation
        requestAnimationFrame(() => {
            toast.classList.add('show');
        });

        // Remove after delay
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 2500);
    }

    /**
     * Generate plain text quote for clipboard
     */
    generateQuoteText() {
        // [2026-06-11] rebuilt from state math (calculateFromState +
        // computeFeesAndTotals): the old text read the DOM grand total, dropped
        // ALL extended sizes (2XL+), could print blank phantom product lines, and
        // showed a tax-inclusive GRAND TOTAL with no subtotal/fees/tax disclosure.
        const totalQty = this.getTotalQuantity();
        const stateCalc = this.calculateFromState();
        const totals = this.computeFeesAndTotals(stateCalc);
        const tier = this.currentPricingData?.tier || this.getTierForQuantity(totalQty);

        let text = '';
        text += `NORTHWEST CUSTOM APPAREL\n`;
        text += `2025 Freeman Road East, Milton, WA 98354\n`;
        text += `Phone: (253) 922-5793 | Email: sales@nwcustomapparel.com\n\n`;

        text += `DTF TRANSFER QUOTE\n`;
        const quoteRef = this.editingQuoteId || this.lastSavedQuoteId;
        if (quoteRef) text += `Quote ID: ${quoteRef}\n`;
        text += `Date: ${new Date().toLocaleDateString()}\n`;
        text += `Valid for: 30 days\n\n`;

        text += `TRANSFER LOCATIONS:\n`;
        this.selectedLocations.forEach(loc => {
            const config = this.locationConfig[loc];
            text += `  - ${config.label} (${config.size})\n`;
        });
        text += `\n`;

        text += `PRODUCTS:\n`;
        const standardSizes = ['S', 'M', 'L', 'XL'];
        this.products.forEach(product => {
            const calcData = stateCalc.productTotals.get(product.id);
            const stdParts = standardSizes
                .filter(s => (product.quantities[s] || 0) > 0)
                .map(s => `${s}(${product.quantities[s]})`);
            const stdQty = standardSizes.reduce((s, sz) => s + (product.quantities[sz] || 0), 0);
            const childLines = [];
            this.childRows.forEach((child, childRowId) => {
                if (Number(child.parentId) === Number(product.id) && child.qty > 0) {
                    const childCalc = stateCalc.childTotals.get(`row-${childRowId}`);
                    childLines.push(`  ${child.size}(${child.qty}) @ $${(childCalc?.unitPrice || 0).toFixed(2)} = $${(childCalc?.total || 0).toFixed(2)}`);
                }
            });
            if (stdQty === 0 && childLines.length === 0) return; // nothing quotable (incl. phantom rows)
            text += `${product.styleNumber} - ${product.description}\n`;
            text += `  Color: ${product.color || 'Not selected'}\n`;
            if (stdQty > 0) {
                text += `  ${stdParts.join(' ')} @ $${(calcData?.standardUnitPrice || 0).toFixed(2)} = $${(calcData?.standardTotal || 0).toFixed(2)}\n`;
            }
            childLines.forEach(l => { text += l + `\n`; });
            text += `\n`;
        });

        text += `PRICING SUMMARY:\n`;
        text += `  Total Quantity: ${totalQty} pieces\n`;
        text += `  Pricing Tier: ${tier}\n`;
        if (this.currentPricingData?.totalLtmFee > 0) {
            text += `  Small Batch Fee: $${this.currentPricingData.totalLtmFee.toFixed(2)} (included in pricing)\n`;
        }
        text += `  Products Subtotal: $${totals.subtotal.toFixed(2)}\n`;
        if (totals.artCharge > 0) text += `  Art/Logo Charge: $${totals.artCharge.toFixed(2)}\n`;
        if (totals.graphicDesignCharge > 0) text += `  Graphic Design: $${totals.graphicDesignCharge.toFixed(2)}\n`;
        if (totals.rushFee > 0) text += `  Rush Fee: $${totals.rushFee.toFixed(2)}\n`;
        if (totals.discount > 0) text += `  Discount: -$${totals.discount.toFixed(2)}\n`;
        if (totals.shippingFee > 0) text += `  Shipping: $${totals.shippingFee.toFixed(2)}\n`;
        text += `  Subtotal: $${totals.preTaxSubtotal.toFixed(2)}\n`;
        if (totals.includeTax) {
            text += `  Sales Tax (${totals.taxRatePct}%): $${totals.taxAmount.toFixed(2)}\n`;
        } else {
            text += `  Sales tax not included\n`;
        }
        text += `  GRAND TOTAL: $${totals.grandTotal.toFixed(2)}\n\n`;

        text += `Thank you for your business!\n`;
        text += `Northwest Custom Apparel | Since 1977\n`;

        return text;
    }

    /**
     * Copy quote to clipboard
     */
    copyQuoteToClipboard() {
        if (this.products.length === 0 || this.getTotalQuantity() === 0) {
            this.showToast('Add products before copying quote', 'warning');
            return;
        }

        if (this.selectedLocations.length === 0) {
            this.showToast('Select locations before copying quote', 'warning');
            return;
        }

        const quoteText = this.generateQuoteText();

        navigator.clipboard.writeText(quoteText).then(() => {
            // Update button feedback
            const copyBtn = document.getElementById('copy-quote-btn');
            if (copyBtn) {
                const originalHTML = copyBtn.innerHTML;
                copyBtn.innerHTML = '<i class="fas fa-check"></i> Copied!';
                copyBtn.classList.add('success');

                setTimeout(() => {
                    copyBtn.innerHTML = originalHTML;
                    copyBtn.classList.remove('success');
                }, 2000);
            }

            this.showToast('Quote copied to clipboard!', 'success');
        }).catch(err => {
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = quoteText;
            textArea.style.position = 'fixed';
            textArea.style.left = '-999999px';
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            this.showToast('Quote copied to clipboard!', 'success');
        });
    }

    // ============================================
    // Unsaved Changes Tracking (UX Improvement)
    // ============================================

    markAsUnsaved() {
        this.hasChanges = true;
        hasChanges = true;  // module-level mirror read by the shared beforeunload guard
        const indicator = document.getElementById('unsaved-indicator');
        if (indicator) {
            indicator.style.display = 'inline';
        }
    }

    markAsSaved() {
        this.hasChanges = false;
        hasChanges = false;  // module-level mirror read by the shared beforeunload guard
        const indicator = document.getElementById('unsaved-indicator');
        if (indicator) {
            indicator.style.display = 'none';
        }
    }

    hasUnsavedChanges() {
        return this.hasChanges || hasChanges;
    }

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
    }

    // ============================================
    // New Quote Functionality (UX Improvement)
    // ============================================

    confirmNewQuote() {
        if (this.hasUnsavedChanges()) {
            if (confirm('You have unsaved changes. Start a new quote?')) {
                this.resetQuote();
            }
        } else {
            this.resetQuote();
        }
    }

    resetQuote() {
        // Clear the "already pushed" lock + reset the Push button so the fresh quote is pushable. (review fix 2026-06-14)
        _dtfPushQuoteId = null;
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
        if (taxRateInput) taxRateInput.value = '10.1';

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
        window.childRowMap = {};
        this._loadedNotesMeta = null;
        const dtfNotesEl = document.getElementById('dtf-notes');
        if (dtfNotesEl) dtfNotesEl.value = '';
        const pushBtnReset = document.getElementById('dtf-push-shopworks-btn');
        if (pushBtnReset) pushBtnReset.style.display = 'none';
        if (typeof _dtfPushQuoteId !== 'undefined') _dtfPushQuoteId = null;
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

        window._taxExempt = false; window._isWholesale = false; { const _wcb = document.getElementById('wholesale-checkbox'); if (_wcb) _wcb.checked = false; const _it = document.getElementById('include-tax'); if (_it) _it.checked = true; }  // [2026-06-08] P0: clear tax-exempt/wholesale flags, uncheck box, RE-CHECK include-tax on New Quote (else next quote bills $0 tax)
        { const _r = document.getElementById('ship-residential'); if (_r) _r.checked = false; const _er = document.getElementById('estimate-ship-result'); if (_er) _er.innerHTML = ''; window._lastShipEstimate = null; }  // [2026-06-08] clear estimator state on New Quote (residential flag + result text + last estimate shouldn't bleed)
        // [2026-06-11] repaint totals — the zero-qty branch blanks subtotal/grand
        // (they previously kept the old quote's numbers until the next interaction)
        this.updatePricing();
        this.showToast('Started new quote', 'success');
        if (typeof window.renderOrderRecap === 'function') window.renderOrderRecap();  // [2026-06-08] clear the order-summary band on New Quote (reset doesn't recalc)
    }
}

// [2026-06-08] Shared order-summary band (Order Recap + Ship-To card) — DTF/SCP parity Phase 2.
// DTF selector map: fee is #dtf-shipping-fee (not #shipping-fee); no #ship-residential; no #it-shipping-amt
// (recap drops the Shipping row); no logo model (logos omitted). Estimator IS wired (estimateHooks below → the
// module auto-sets _cfg.estimate → Re-estimate shows); no modal → editOnclick omitted → no Edit button. quote-order-summary.js loads before this file.
if (typeof QuoteOrderSummary !== 'undefined') {
    QuoteOrderSummary.configure({
        orderRecap: '#order-recap',
        shipToCard: '#ship-to-card',
        ship: {
            address: '#ship-address',
            city: '#ship-city',
            state: '#ship-state',
            zip: '#ship-zip',
            method: '#ship-method',
            fee: '#dtf-shipping-fee',
            residential: '#ship-residential',
        },
        recap: {
            company: '#company-name',
            name: '#customer-name',
            custNum: '#customer-number',
        },
        // [2026-06-08] Commit 5: DTF adopts the shared UPS-Ground estimator. configure() auto-points _cfg.estimate
        // at the module estimator when estimateHooks is present, so the ship-to card's Re-estimate button auto-lights.
        // DTF products are {styleNumber, quantities} → remap to the estimator's {style, sizeBreakdown}.
        estimateHooks: {
            collectProducts: function () {
                return (window.dtfQuoteBuilder && dtfQuoteBuilder.products ? dtfQuoteBuilder.products : [])
                    .map(function (p) { return { style: p.styleNumber, sizeBreakdown: p.quantities }; })
                    .filter(function (p) { return p.style && Object.values(p.sizeBreakdown || {}).some(function (q) { return (parseInt(q) || 0) > 0; }); });
            },
            onApplied: function () {
                if (typeof updateAdditionalCharges === 'function') updateAdditionalCharges();
                if (typeof updateTaxCalculation === 'function') updateTaxCalculation();
            },
            btn: '#estimate-ship-btn',
            result: '#estimate-ship-result',
        },
    });
}

// Global instance
let dtfQuoteBuilder;

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    dtfQuoteBuilder = new DTFQuoteBuilder();
    window.dtfQuoteBuilder = dtfQuoteBuilder;

    // Load Caspio Service_Codes (GRT-75 design rate) so fees come from the API,
    // not a hardcoded 75 (Erik's Pricing=API rule). Fire-and-forget — getServicePrice()
    // returns the documented fallback until it resolves, then we re-price. (2026-06-09)
    if (typeof loadServiceCodePrices === 'function') {
        loadServiceCodePrices().then(() => {
            try { dtfQuoteBuilder.updatePricing(); } catch (_) {}
            // [2026-06-11] sync the static "$75/hr" labels with the live GRT-75
            // rate — the math was already API-driven, but a Caspio rate change
            // left the on-screen labels contradicting the charged totals
            try {
                const rate = getServicePrice('GRT-75', 75);
                const rateLabel = document.getElementById('design-rate-label');
                if (rateLabel) rateLabel.textContent = String(rate);
                const rateLabelSidebar = document.getElementById('design-rate-label-sidebar');
                if (rateLabelSidebar) rateLabelSidebar.textContent = String(rate);
            } catch (_) {}
        });
    }

    // Phase 9 (2026-05-23) → Phase 11.3 (2026-05-24) — rich-mode artwork upload.
    // Adds design name input + per-file placement dropdown so the push payload
    // can carry Designs[{name, Locations[{Location, ImageURL}]}] when the rep
    // is creating a brand-new design (no existing #). Mirrors DTG's pattern
    // in dtg-inline-form.js:2814-2864.
    if (typeof ArtworkUpload !== 'undefined') {
        try {
            window._dtfArtwork = ArtworkUpload.attach({
                mountSelector: '#dtf-artwork-mount',
                designName: {
                    enabled: true,
                    label: 'Design name (required when uploading new artwork)',
                    placeholder: 'e.g. Acme Corp Logo',
                },
                placements: [
                    { code: 'Left Chest',   label: 'Left Chest' },
                    { code: 'Right Chest',  label: 'Right Chest' },
                    { code: 'Full Front',   label: 'Full Front' },
                    { code: 'Full Back',    label: 'Full Back' },
                    { code: 'Center Front', label: 'Center Front' },
                    { code: 'Center Back',  label: 'Center Back' },
                    { code: 'Back of Neck', label: 'Back of Neck' },
                    { code: 'Left Sleeve',  label: 'Left Sleeve' },
                    { code: 'Right Sleeve', label: 'Right Sleeve' },
                ],
                defaultPlacement: 'Left Chest',
            });
            console.log('[DTF] Artwork upload widget mounted (rich mode)');
        } catch (e) {
            console.error('[DTF] Artwork widget mount failed:', e);
        }
    }

    // Phase 11.1 (2026-05-24) — customer-aware design lookup.
    // Wraps #design-number input with autocomplete fetching from
    // proxy /api/designs/by-customer?method=dtf.
    if (typeof CustomerDesignCombobox !== 'undefined') {
        try {
            const designInput = document.getElementById('design-number');
            if (designInput) {
                window._dtfDesignCombobox = CustomerDesignCombobox.attach(designInput, {
                    method: 'dtf',
                    getCustomerId: () => {
                        const v = document.getElementById('customer-number')?.value?.trim();
                        const n = parseInt(v, 10);
                        return Number.isFinite(n) && n > 0 ? n : null;
                    },
                    onPick: (design) => {
                        console.log('[DTF] Design picked:', design.idDesign, design.designName);
                    },
                });
                // Refresh combobox when customer number changes
                const custInput = document.getElementById('customer-number');
                if (custInput) {
                    custInput.addEventListener('change', () => {
                        if (window._dtfDesignCombobox) window._dtfDesignCombobox.refresh();
                    });
                }
                console.log('[DTF] Design combobox mounted');
            }
        } catch (e) {
            console.error('[DTF] Design combobox mount failed:', e);
        }
    }
});

// Global function wrappers for HTML onclick handlers
function copyToClipboard() {
    if (dtfQuoteBuilder) {
        dtfQuoteBuilder.copyQuoteToClipboard();
    }
}
// Legacy alias
function copyQuoteToClipboard() { copyToClipboard(); }

function printQuote() {
    if (dtfQuoteBuilder) {
        dtfQuoteBuilder.printQuote();
    }
}

// =====================================================
// Push to ShopWorks (Phase 8 — 2026-05-23)
// =====================================================
// Mirrors the EMB pushToShopWorks() pattern. The saved quote is transformed
// server-side (caspio-pricing-proxy/lib/dtf-push-transformer.js) into a
// ManageOrders order: garment lines + ship-to + shipping/discount/rush/art
// charges, linked to the real ShopWorks customer (from the quote's customer #).
//
// OnSite integration IDs (id_OrderType / id_DesignType) live in
// caspio-pricing-proxy/config/manageorders-dtf-config.js.

let _dtfPushQuoteId = null;

function showDtfPushButton(quoteId) {
    _dtfPushQuoteId = quoteId;
    // The Push button is ALWAYS visible now (disabled-until-ready, EMB parity 2026-06-14); this just
    // records the saved quote id (the /preview endpoint needs it) and re-gates the button.
    if (typeof updateDtfPushButtonState === 'function') updateDtfPushButtonState();
}

// Always-visible Push button + "Before you push" readiness checklist gate (EMB parity 2026-06-14).
// Shared renderBuilderPushReadiness() (quote-builder-utils.js) — gates: Customer #, ≥1 item, name, email.
function updateDtfPushButtonState() {
    if (typeof renderBuilderPushReadiness !== 'function') return;
    renderBuilderPushReadiness({
        btnId: 'dtf-push-shopworks-btn',
        hasProducts: () => { try { return !!(window.dtfQuoteBuilder && dtfQuoteBuilder.getTotalQuantity() > 0); } catch (_) { return false; } }
    });
}
window.updateDtfPushButtonState = updateDtfPushButtonState;

// One-click Push: auto-SAVE first (silent — no share modal), then open the review/confirm preview.
// Button is gated by the checklist; proxy PushedToShopWorks 409 guards against a duplicate order.
let _dtfPushInFlight = false;
async function dtfPushToShopWorks() {
    if (_dtfPushInFlight) return;
    _dtfPushInFlight = true;
    const label = document.getElementById('dtf-push-shopworks-label');
    if (label) label.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Preparing preview…';
    try {
        // Do NOT disable the button — openDtfPushPreview() bails if the button is disabled.
        await dtfQuoteBuilder.saveAndGetLink({ skipShareModal: true });   // → showDtfPushButton sets _dtfPushQuoteId + re-gates
        if (!_dtfPushQuoteId) return;
        await openDtfPushPreview();
    } finally {
        _dtfPushInFlight = false;
        const _b = document.getElementById('dtf-push-shopworks-btn');
        // Don't clobber the "Pushed ✓" success label once the push completed.
        if (label && (!_b || _b.dataset.pushed !== '1')) label.textContent = 'Push to ShopWorks';
        updateDtfPushButtonState();   // renderBuilderPushReadiness skips re-gating when dataset.pushed==='1'
    }
}
window.dtfPushToShopWorks = dtfPushToShopWorks;

// Minimal HTML escaper for preview output (self-contained — no util dependency).
function _dtfEsc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => (
        { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));
}

// Open the preview-and-confirm modal — parity with EMB/SCP's openScpPushPreview().
// Fetches the exact ExternalOrderJson the backend would push (read-only /preview
// endpoint) so the rep reviews line items, order type and total before the order
// is created. If the modal or preview can't load, falls back to a direct
// confirm()-push so the rep is never blocked.
async function openDtfPushPreview() {
    const btn = document.getElementById('dtf-push-shopworks-btn');
    if (!btn || btn.disabled || !_dtfPushQuoteId) return;
    // Warn before pushing with no ShopWorks Customer # — the order would silently
    // attach to placeholder customer 3739 instead of the real customer. EMB gates its
    // button on this; SCP/DTF warn at push time for parity. (2026-06-01)
    const _dtfCust = document.getElementById('customer-number')?.value?.trim();
    if (!_dtfCust && !confirm('No ShopWorks Customer # is set.\n\nThis order will attach to the placeholder customer (3739) instead of the real customer. Continue anyway?')) {
        return;
    }

    const modal = document.getElementById('dtf-push-modal');
    const statusEl = document.getElementById('dtf-push-status');
    const previewEl = document.getElementById('dtf-push-preview');
    const confirmBtn = document.getElementById('dtf-push-confirm');
    if (!modal || !previewEl || !confirmBtn) {
        return confirmDtfPush(true); // modal markup missing → legacy direct push
    }

    if (statusEl) statusEl.innerHTML = '';
    previewEl.innerHTML = '<div style="padding:24px; text-align:center; color:#64748b;">' +
        '<i class="fas fa-spinner fa-spin"></i> Loading preview…</div>';
    confirmBtn.disabled = true;
    confirmBtn.style.opacity = '0.6';
    confirmBtn.innerHTML = '<i class="fas fa-upload"></i> Push to ShopWorks';
    modal.classList.add('show');

    try {
        const apiBase = (typeof APP_CONFIG !== 'undefined' && APP_CONFIG.API?.BASE_URL)
            ? APP_CONFIG.API.BASE_URL
            : 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';
        const resp = await fetch(`${apiBase}/api/dtf-push/preview/${encodeURIComponent(_dtfPushQuoteId)}`);
        const data = await resp.json();
        if (!resp.ok) throw new Error(data.error || data.details || `HTTP ${resp.status}`);
        renderDtfPushPreview(data.orderJson || {});
        confirmBtn.disabled = false;
        confirmBtn.style.opacity = '1';
    } catch (err) {
        console.error('[DTF Push] Preview error:', err);
        previewEl.innerHTML = '<div style="padding:16px; color:#b91c1c;">' +
            '<i class="fas fa-exclamation-triangle"></i> Could not load preview: ' + _dtfEsc(err.message) +
            '<br><span style="color:#64748b;">You can still push below.</span></div>';
        confirmBtn.disabled = false;
        confirmBtn.style.opacity = '1';
    }
}

// Render the modal body from the /preview orderJson.
function renderDtfPushPreview(o) {
    const previewEl = document.getElementById('dtf-push-preview');
    if (!previewEl) return;
    const lines = Array.isArray(o.LinesOE) ? o.LinesOE : [];
    const designs = Array.isArray(o.Designs) ? o.Designs : [];
    const shipping = parseFloat(o.cur_Shipping) || 0;
    const discount = parseFloat(o.TotalDiscounts) || 0;
    const lineSum = lines.reduce((s, l) => s + (parseFloat(l.Price) || 0) * (parseFloat(l.Qty) || 0), 0);
    const preTax = lineSum + shipping - discount;

    let html = '<div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:12px; font-size:13px;">';
    html += '<div><span style="color:#64748b;">ShopWorks Order:</span> <strong>' + _dtfEsc(o.ExtOrderID || '') + '</strong></div>';
    html += '<div><span style="color:#64748b;">Order type:</span> <strong>' + _dtfEsc(String(o.id_OrderType || '')) + '</strong> <span style="color:#64748b;">(18 = Transfers)</span></div>';
    html += '<div><span style="color:#64748b;">Customer #:</span> ' + _dtfEsc(String(o.id_Customer || '')) + '</div>';
    html += '<div><span style="color:#64748b;">Designs:</span> ' + designs.length + '</div>';
    html += '</div>';

    html += '<table style="width:100%; border-collapse:collapse; font-size:13px;">';
    html += '<thead><tr style="text-align:left; border-bottom:1px solid #e5e7eb; color:#64748b;">' +
        '<th style="padding:4px;">Part</th><th style="padding:4px;">Description</th>' +
        '<th style="padding:4px; text-align:center;">Size</th><th style="padding:4px; text-align:right;">Qty</th>' +
        '<th style="padding:4px; text-align:right;">Price</th></tr></thead><tbody>';
    if (lines.length === 0) {
        html += '<tr><td colspan="5" style="padding:8px; color:#b91c1c;">No line items</td></tr>';
    } else {
        for (const l of lines) {
            html += '<tr style="border-bottom:1px solid #f1f5f9;">' +
                '<td style="padding:4px; font-weight:600;">' + _dtfEsc(l.PartNumber || '') + '</td>' +
                '<td style="padding:4px;">' + _dtfEsc(l.Description || '') + '</td>' +
                '<td style="padding:4px; text-align:center;">' + _dtfEsc(l.Size || '') + '</td>' +
                '<td style="padding:4px; text-align:right;">' + _dtfEsc(String(l.Qty || '')) + '</td>' +
                '<td style="padding:4px; text-align:right;">$' + (parseFloat(l.Price) || 0).toFixed(2) + '</td></tr>';
        }
    }
    html += '</tbody></table>';
    html += '<div style="text-align:right; margin-top:10px; font-size:14px; font-weight:700;">' +
        'Order total (pre-tax): $' + preTax.toFixed(2) + '</div>';
    if (designs.length === 0) {
        html += '<div style="margin-top:10px; padding:8px 10px; background:#fffbeb; border:1px solid #fde68a; border-radius:6px; font-size:12px; color:#92400e;">' +
            '<i class="fas fa-exclamation-triangle"></i> No design linked — a rep must assign the design in ShopWorks.</div>';
    }
    previewEl.innerHTML = html;
}

// Perform the actual push (POST /push-quote). directFallback=true is the legacy
// path used when the modal couldn't open.
async function confirmDtfPush(directFallback) {
    const mainBtn = document.getElementById('dtf-push-shopworks-btn');
    const mainLabel = document.getElementById('dtf-push-shopworks-label');
    const confirmBtn = document.getElementById('dtf-push-confirm');
    const statusEl = document.getElementById('dtf-push-status');
    if (!_dtfPushQuoteId) return;

    if (directFallback) {
        const customerName = document.getElementById('customer-name')?.value?.trim() || '';
        const companyName = document.getElementById('company-name')?.value?.trim() || '';
        const displayName = companyName || customerName || 'N/A';
        if (!confirm(
            `Push to ShopWorks?\n\nQuote: ${_dtfPushQuoteId}\nCustomer: ${displayName}\n\n` +
            `This creates a new DTF order in ShopWorks OnSite with the products, sizes, charges, and ship-to from this quote.`
        )) return;
        if (mainBtn) { mainBtn.disabled = true; mainBtn.style.opacity = '0.6'; }
        if (mainLabel) mainLabel.textContent = 'Pushing...';
    } else if (confirmBtn) {
        confirmBtn.disabled = true;
        confirmBtn.style.opacity = '0.6';
        confirmBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Pushing…';
    }

    const notifyToast = (msg, type) => {
        if (typeof showToast === 'function') showToast(msg, type);
        else if (dtfQuoteBuilder?.showToast) dtfQuoteBuilder.showToast(msg, type);
    };

    try {
        const apiBase = (typeof APP_CONFIG !== 'undefined' && APP_CONFIG.API?.BASE_URL)
            ? APP_CONFIG.API.BASE_URL
            : 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';
        const response = await fetch(`${apiBase}/api/dtf-push/push-quote`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ quoteId: _dtfPushQuoteId, isTest: false, force: false }),
        });
        const data = await response.json();

        if (!response.ok) {
            if (response.status === 409) {
                if (statusEl) statusEl.innerHTML = '<div style="padding:8px; color:#92400e; background:#fffbeb; border:1px solid #fde68a; border-radius:6px;">Already pushed to ShopWorks.</div>';
                if (mainLabel) mainLabel.textContent = 'Already Pushed';
                if (mainBtn) mainBtn.style.background = '#28a745';
                notifyToast('Already pushed to ShopWorks', 'info');
                closeDtfPushPreview();
                return;
            }
            throw new Error(data.error || data.details || `HTTP ${response.status}`);
        }

        // Success
        if (mainLabel) mainLabel.textContent = `Pushed ✓ (${data.extOrderId})`;
        if (mainBtn) { mainBtn.style.background = '#28a745'; mainBtn.disabled = true; mainBtn.dataset.pushed = '1'; }
        notifyToast(`Pushed to ShopWorks as ${data.extOrderId}`, 'success');
        console.log('[DTF Push] Success:', data);
        closeDtfPushPreview();

    } catch (error) {
        console.error('[DTF Push] Push error:', error);
        if (statusEl) statusEl.innerHTML = '<div style="padding:8px; color:#b91c1c;">Push failed: ' + _dtfEsc(error.message) + '</div>';
        if (confirmBtn) { confirmBtn.disabled = false; confirmBtn.style.opacity = '1'; confirmBtn.innerHTML = '<i class="fas fa-upload"></i> Push to ShopWorks'; }
        if (mainBtn) { mainBtn.disabled = false; mainBtn.style.opacity = '1'; }
        if (mainLabel) mainLabel.textContent = 'Push to ShopWorks';
        notifyToast(`Push failed: ${error.message}`, 'error');
    }
}

function closeDtfPushPreview() {
    const modal = document.getElementById('dtf-push-modal');
    if (modal) modal.classList.remove('show');
}

// NOTE: dtfPushToShopWorks (async, auto-save → preview) is declared above near the
// button-state helper and is the ONE bound to window.dtfPushToShopWorks + the HTML
// onclick. Do NOT re-declare a back-compat alias here — a second `function
// dtfPushToShopWorks()` at module scope hoists OVER the async version, so the button
// would call openDtfPushPreview() WITHOUT the auto-save and silently no-op on a
// never-saved quote (_dtfPushQuoteId === null). Call openDtfPushPreview() directly if
// you need the bare preview. (regression fixed 2026-06-14)

// Expose for HTML onclick + cross-file callers
window.openDtfPushPreview = openDtfPushPreview;
window.renderDtfPushPreview = renderDtfPushPreview;
window.confirmDtfPush = confirmDtfPush;
window.closeDtfPushPreview = closeDtfPushPreview;
window.showDtfPushButton = showDtfPushButton;
