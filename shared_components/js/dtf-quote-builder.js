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

class DTFQuoteBuilder {
    constructor() {
        // State
        this.selectedLocations = [];
        this.products = [];
        this.pricingData = null;
        this.productIndex = 0;

        // Edit mode state
        this.editingQuoteId = null;
        this.editingRevision = null;

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
                    console.log('[DTFQuoteBuilder] Auto-saved draft');
                }
            };

            console.log('[DTFQuoteBuilder] Persistence initialized');
        } else {
            console.warn('[DTFQuoteBuilder] QuotePersistence not available');
        }

        if (typeof QuoteSession !== 'undefined' && this.persistence) {
            this.session = new QuoteSession({
                prefix: 'DTF',
                persistence: this.persistence,
                debug: false
            });
            console.log('[DTFQuoteBuilder] Session initialized');
        }
    }

    /**
     * Get current quote data for auto-save
     */
    getCurrentQuoteData() {
        return {
            selectedLocations: this.selectedLocations,
            products: this.products.map(p => ({
                id: p.id,
                style: p.style,
                name: p.name,
                color: p.color,
                catalogColor: p.catalogColor,
                baseCost: p.baseCost,
                quantities: { ...p.quantities },
                imageUrl: p.imageUrl
            })),
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
        console.log('[DTFQuoteBuilder] Restoring draft...', draft);

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

        // Restore products
        if (draft.products && draft.products.length > 0) {
            // Update productIndex to avoid ID collisions
            if (draft.productIndex) {
                this.productIndex = draft.productIndex;
            }

            // Restore each product
            draft.products.forEach(product => {
                this.products.push(product);
                // Re-add the product row to the table
                if (typeof addProductRowFromData === 'function') {
                    addProductRowFromData(product);
                }
            });

            // Update pricing after all products are restored
            this.updatePricing();
        }

        console.log('[DTFQuoteBuilder] Draft restored successfully');
    }

    /**
     * Get the next row ID - shared between parent rows and child rows
     * This prevents ID collisions between addProductRow() and createChildRow()
     */
    getNextRowId() {
        return ++this.productIndex;
    }

    async init() {
        console.log('[DTFQuoteBuilder] Initializing Excel-style layout...');

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
        if (editQuoteId) {
            console.log('[DTFQuoteBuilder] Edit mode detected:', editQuoteId);
            // Skip draft recovery and load the existing quote instead
            await this.loadQuoteForEditing(editQuoteId);
        } else {
            // Check for draft recovery (after DOM is ready)
            if (this.session && this.session.shouldShowRecovery()) {
                this.session.showRecoveryDialog(
                    (draft) => this.restoreDraft(draft),
                    () => {
                        console.log('[DTFQuoteBuilder] User chose to start fresh');
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
            customerLookup.bindToInput('customer-lookup', {
                onSelect: (contact) => {
                    document.getElementById('customer-name').value = contact.ct_NameFull || '';
                    document.getElementById('customer-email').value = contact.ContactNumbersEmail || '';
                    document.getElementById('company-name').value = contact.CustomerCompanyName || '';
                    this.showToast('Customer info loaded', 'success');
                },
                onClear: () => {
                    document.getElementById('customer-name').value = '';
                    document.getElementById('customer-email').value = '';
                    document.getElementById('company-name').value = '';
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

        console.log('[DTFQuoteBuilder] Ready');
    }

    async loadPricingData() {
        try {
            const response = await fetch('https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/pricing-bundle?method=DTF');
            if (!response.ok) {
                throw new Error(`API returned ${response.status}`);
            }
            this.pricingData = await response.json();
            console.log('[DTFQuoteBuilder] Pricing data loaded');
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
        const headerSubtitle = document.querySelector('.power-header div[style*="text-align: center"] div:last-child, .dtf-header div[style*="text-align: center"] div:last-child');
        if (headerSubtitle) {
            headerSubtitle.innerHTML = `<span style="color: #fbbf24;">✏️ Editing: ${quoteId} • Rev ${revision}</span>`;
        }

        // Update save button text
        const saveBtn = document.querySelector('.btn-save-quote');
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
                designTotalEl.textContent = (session.GraphicDesignHours * 75).toFixed(2);
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

        // Select the color
        const pickerDropdown = row.querySelector('.color-picker-dropdown');
        if (pickerDropdown) {
            const colorOption = pickerDropdown.querySelector(
                `[data-color-name="${product.color}"], [data-catalog-color="${product.color}"]`
            ) || Array.from(pickerDropdown.querySelectorAll('.color-option')).find(opt =>
                opt.textContent.includes(product.color)
            );
            if (colorOption && typeof selectColor === 'function') {
                selectColor(parseInt(rowId), colorOption);
            }
        }

        // Small delay for color selection to process
        await new Promise(resolve => setTimeout(resolve, 100));

        // Set size quantities
        for (const [size, qty] of Object.entries(product.sizeBreakdown)) {
            if (qty > 0) {
                const normalizedSize = size === 'XXL' ? '2XL' : size;

                if (['S', 'M', 'L', 'XL', '2XL'].includes(normalizedSize)) {
                    const sizeInput = row.querySelector(`input[data-size="${normalizedSize}"]`) ||
                                     row.querySelector(`input[data-size="${size}"]`);
                    if (sizeInput) {
                        sizeInput.value = qty;
                        sizeInput.dispatchEvent(new Event('change', { bubbles: true }));
                    }
                } else {
                    console.log(`[EditMode] Extended size ${normalizedSize}: ${qty} - user needs to re-enter in popup`);
                }
            }
        }
    }

    /**
     * Load existing quote for editing
     * Populates all form fields with quote data
     */
    async loadQuoteForEditing(quoteId) {
        console.log('[EditMode] Loading quote for editing:', quoteId);

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

            // Store edit mode state
            this.editingQuoteId = quoteId;
            this.editingRevision = session.RevisionNumber || 1;

            // Update page header to show edit mode
            this.updateEditModeUI(quoteId, this.editingRevision);

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

            console.log('[EditMode] Quote loaded successfully');
            if (typeof showToast === 'function') {
                showToast(`Editing ${quoteId} (Rev ${this.editingRevision})`, 'success');
            }

        } catch (error) {
            console.error('[EditMode] Error loading quote:', error);
            if (typeof showToast === 'function') {
                showToast('Error loading quote: ' + error.message, 'error');
            }
            // Clear edit mode
            this.editingQuoteId = null;
            this.editingRevision = null;
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

        console.log('[Location] Selected:', this.selectedLocations);

        // Update UI
        this.updateLocationSummary();
        this.updateSearchState();
        this.updatePricing();

        // Mark dirty for auto-save
        if (this.persistence) {
            this.persistence.markDirty();
        }
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
                console.log('[DTFQuoteBuilder] Exact match found:', product.value);
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
                    console.log('[DTFQuoteBuilder] Keyboard selected:', product.value);
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
        console.log('[DTFQuoteBuilder] Product selected:', styleNumber);

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

    /**
     * @deprecated This method creates rows with different event handlers than addNewRow().
     * Use selectProduct() which now calls addNewRow() + onStyleChange() instead.
     * This ensures child rows are properly created for extended sizes (2XL, 3XL, etc.).
     * Keeping for backward compatibility but should not be called directly.
     */
    addProductRow(product) {
        const tbody = document.getElementById('product-tbody');
        const emptyMessage = document.getElementById('empty-table-message');

        if (emptyMessage) emptyMessage.style.display = 'none';

        // Build color options HTML - compact list pattern matching Embroidery/Screen Print
        const colorOptionsHTML = product.colors.length > 0
            ? product.colors.map((c) => {
                const colorName = c.COLOR_NAME || c.colorName || c;
                const catalogColor = c.CATALOG_COLOR || c.catalogColor || colorName;
                const imageUrl = c.COLOR_SQUARE_IMAGE || c.colorImage || '';
                return `
                    <div class="color-picker-option"
                         data-color="${catalogColor}"
                         data-display="${colorName}"
                         data-image="${imageUrl}">
                        <span class="color-swatch" style="background-image: url('${imageUrl}'); background-color: #e5e7eb;"></span>
                        <span class="color-name">${colorName}</span>
                    </div>
                `;
            }).join('')
            : '<div class="color-picker-option disabled"><span class="color-name">No colors available</span></div>';

        const row = document.createElement('tr');
        row.id = `row-${product.id}`;
        row.dataset.productId = product.id;
        row.dataset.style = product.styleNumber;
        row.dataset.baseCost = product.baseCost;
        // Store additional data for child row inheritance
        row.dataset.colors = JSON.stringify(product.colors || []);
        row.dataset.sizeUpcharges = JSON.stringify(product.sizeUpcharges || {});
        row.dataset.productName = product.description || '';
        row.innerHTML = `
            <td>
                <input type="text" class="cell-input style-input"
                       placeholder="Style #"
                       data-field="style"
                       value="${product.styleNumber}"
                       readonly>
            </td>
            <td class="desc-cell">
                <div class="desc-row">
                    <input type="text" class="cell-input desc-input"
                           value="${product.description}"
                           title="${product.description}"
                           placeholder="(auto)"
                           data-field="description"
                           readonly>
                </div>
                <div class="pricing-breakdown" id="breakdown-${product.id}"></div>
            </td>
            <td class="color-col">
                <div class="color-picker-wrapper" data-product-id="${product.id}">
                    <div class="color-picker-selected" tabindex="0">
                        <span class="color-swatch empty"></span>
                        <span class="color-name placeholder">Select color...</span>
                        <i class="fas fa-chevron-down picker-arrow"></i>
                    </div>
                    <div class="color-picker-dropdown hidden" id="color-dropdown-${product.id}">
                        ${colorOptionsHTML}
                    </div>
                </div>
            </td>
            <td class="size-col"><input type="number" class="cell-input size-input" data-size="S" min="0" value="" placeholder="0" disabled onchange="onSizeChange(${product.id})" onkeydown="handleCellKeydown(event, this)"></td>
            <td class="size-col"><input type="number" class="cell-input size-input" data-size="M" min="0" value="" placeholder="0" disabled onchange="onSizeChange(${product.id})" onkeydown="handleCellKeydown(event, this)"></td>
            <td class="size-col"><input type="number" class="cell-input size-input" data-size="L" min="0" value="" placeholder="0" disabled onchange="onSizeChange(${product.id})" onkeydown="handleCellKeydown(event, this)"></td>
            <td class="size-col"><input type="number" class="cell-input size-input" data-size="XL" min="0" value="" placeholder="0" disabled onchange="onSizeChange(${product.id})" onkeydown="handleCellKeydown(event, this)"></td>
            <td class="size-col"><input type="number" class="cell-input size-input" data-size="2XL" min="0" value="" placeholder="0" disabled onchange="onSizeChange(${product.id})" onkeydown="handleCellKeydown(event, this)"></td>
            <td class="size-col extended-picker-cell">
                <button type="button" class="btn-extended-picker" data-product-id="${product.id}" title="Click for XS, 3XL, 4XL, 5XL, 6XL" onclick="openExtendedSizePopup(${product.id})" disabled>
                    <span class="ext-qty-badge" id="ext-badge-${product.id}">+</span>
                </button>
            </td>
            <td class="qty-col"><span class="row-qty">0</span></td>
            <td class="price-col"><span class="row-price">$0.00</span></td>
            <td class="actions-col">
                <button class="btn-remove-row" onclick="dtfQuoteBuilder.removeProductRow(${product.id})">
                    <i class="fas fa-times"></i>
                </button>
            </td>
        `;

        tbody.appendChild(row);

        // Add to products array with extended sizes stored
        this.products.push({
            id: product.id,
            styleNumber: product.styleNumber,
            description: product.description,
            baseCost: product.baseCost,
            sizeUpcharges: product.sizeUpcharges,
            color: '',           // Display name for UI
            catalogColor: '',    // CATALOG_COLOR for API/ShopWorks
            quantities: { XS: 0, S: 0, M: 0, L: 0, XL: 0, '2XL': 0, '3XL': 0, '4XL': 0, '5XL': 0, '6XL': 0 }
        });

        // Mark dirty for auto-save
        if (this.persistence) {
            this.persistence.markDirty();
        }

        // Setup input listeners for main row
        row.querySelectorAll('.size-input').forEach(input => {
            input.addEventListener('input', () => this.handleSizeInputChange(product.id));
            input.addEventListener('keydown', (e) => this.handleCellKeydown(e, input));
        });

        // Setup color picker handlers
        this.setupColorPicker(row, product.id);

        console.log('[DTFQuoteBuilder] Product row added:', product.styleNumber);
    }

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

                console.log(`[DTFQuoteBuilder] Color selected: ${colorName} (${catalogColor})`);
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

        console.log(`[DTFQuoteBuilder] Size inputs enabled for product ${productId}`);
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
        try {
            if (!window.ExtendedSizesConfig?.getAvailableExtendedSizes) {
                throw new Error('ExtendedSizesConfig module not loaded');
            }
            const allExtended = await window.ExtendedSizesConfig.getAvailableExtendedSizes(styleNumber, catalogColor);
            // Filter out 2XL/XXL since DTF has a dedicated column for it
            extendedSizes = allExtended.filter(size => !['2XL', 'XXL'].includes(size));
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
            // Handle 3XL/XXXL mapping - API returns '3XL', internal may use 'XXXL'
            const lookupSize = size === '3XL' ? 'XXXL' : size;
            quantities[size] = window.getExtendedSizeQty ? window.getExtendedSizeQty(productId, lookupSize) : 0;
        });

        // Render the size inputs
        body.innerHTML = `
            <div class="extended-sizes-grid">
                ${extendedSizes.map(size => {
                    // Use consistent display (3XL) but store internal key (XXXL for backwards compat)
                    const internalSize = size === '3XL' ? 'XXXL' : size;
                    const currentQty = quantities[size] || '';
                    return `
                        <div class="ext-size-input-group">
                            <label>${size}</label>
                            <input type="number" class="ext-size-input" data-size="${internalSize}"
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
            const size = input.dataset.size;
            const qty = parseInt(input.value) || 0;

            // Access global childRowMap (defined in HTML)
            const existingChildRowId = window.childRowMap?.[productId]?.[size];

            if (qty > 0 && !existingChildRowId) {
                // CREATE NEW CHILD ROW using global function
                if (typeof createChildRow === 'function') {
                    createChildRow(productId, size, qty);
                }
            } else if (qty > 0 && existingChildRowId) {
                // UPDATE EXISTING CHILD ROW
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

    /**
     * @deprecated This method was used by the deprecated addProductRow() and does NOT create child rows.
     * Rows created via selectProduct() now use addNewRow() which uses onchange="onSizeChange()"
     * handlers that properly create child rows for extended sizes (2XL, 3XL, etc.).
     */
    handleSizeInputChange(productId) {
        const row = document.querySelector(`tr[data-product-id="${productId}"]`);
        if (!row) return;

        const productData = this.products.find(p => p.id === productId);
        if (!productData) return;

        // Collect quantities from main row (S, M, L, XL, 2XL)
        let rowTotal = 0;
        row.querySelectorAll('.size-input').forEach(input => {
            const size = input.dataset.size;
            const qty = parseInt(input.value) || 0;
            productData.quantities[size] = qty;
            rowTotal += qty;
        });

        // Add extended sizes from stored data (XS, XXXL, 4XL, 5XL, 6XL)
        const extendedSizes = ['XS', 'XXXL', '4XL', '5XL', '6XL'];
        let extTotal = 0;
        extendedSizes.forEach(size => {
            const qty = productData.quantities[size] || 0;
            rowTotal += qty;
            extTotal += qty;
        });

        // Update row quantity display
        const qtySpan = row.querySelector('.row-qty');
        if (qtySpan) qtySpan.textContent = rowTotal;

        // Update extended badge
        this.updateExtendedBadge(productId, extTotal);

        // Update pricing
        this.updatePricing();

        // Mark dirty for auto-save
        if (this.persistence) {
            this.persistence.markDirty();
        }
    }

    removeProductRow(productId) {
        const row = document.querySelector(`tr[data-product-id="${productId}"]`);
        if (row) row.remove();

        // Remove from products array
        const index = this.products.findIndex(p => p.id === productId);
        if (index > -1) this.products.splice(index, 1);

        // Show empty message if no products
        if (this.products.length === 0) {
            const emptyMessage = document.getElementById('empty-table-message');
            if (emptyMessage) emptyMessage.style.display = 'block';
        }

        this.updatePricing();

        // Mark dirty for auto-save
        if (this.persistence) {
            this.persistence.markDirty();
        }
    }

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
        const marginDenom = this.pricingCalculator.getMarginDenominator(pricingQty);

        // Store for quote save
        this.currentPricingData = {
            transferBreakdown,
            laborCostPerLoc,
            freightPerTransfer,
            ltmPerUnit,
            totalLtmFee,
            marginDenom,
            tier
        };

        // LTM display - DTF only uses table row (no sidebar ltm-row/ltm-fee elements)
        const ltmTableRow = document.getElementById('ltm-fee-row');
        const ltmTableUnit = document.getElementById('ltm-row-unit');
        const ltmTableTotal = document.getElementById('ltm-row-total');

        if (totalLtmFee > 0 && totalQty > 0) {
            // Show LTM in product table
            if (ltmTableRow) {
                ltmTableRow.style.display = 'table-row';
                if (ltmTableUnit) ltmTableUnit.textContent = `$${totalLtmFee.toFixed(2)}`;
                if (ltmTableTotal) ltmTableTotal.textContent = `$${totalLtmFee.toFixed(2)}`;
            }
        } else {
            // Hide LTM row
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
                    // Use margin from API (not hardcoded 0.57)
                    // Upcharge is a selling price add-on, add AFTER margin calculation
                    const garmentCost = product.baseCost / marginDenom + upcharge;
                    // Full unit price always includes LTM for calculation
                    const unitPrice = garmentCost + transferCost + laborCost + freightCost + ltmPerUnit;
                    // Use rounding from API
                    const roundedPrice = this.pricingCalculator.applyRounding(unitPrice);
                    productTotal += roundedPrice * qty;

                    // Track base unit price (S/M/LG size - no upcharge) for display
                    if (baseUnitPrice === 0 && ['S', 'M', 'L'].includes(size)) {
                        baseUnitPrice = roundedPrice;
                        // Display price without LTM (LTM shown as separate line item)
                        if (ltmPerUnit === 0) {
                            baseDisplayPrice = roundedPrice;
                        } else {
                            const priceWithoutLTM = garmentCost + transferCost + laborCost + freightCost;
                            baseDisplayPrice = this.pricingCalculator.applyRounding(priceWithoutLTM);
                        }
                    }
                }
            });

            // If no base price yet, calculate it for display
            if (baseUnitPrice === 0 && totalQty > 0) {
                const garmentCost = product.baseCost / marginDenom;
                const unitPrice = garmentCost + transferCost + laborCost + freightCost + ltmPerUnit;
                baseUnitPrice = this.pricingCalculator.applyRounding(unitPrice);
                // Display price without LTM (LTM shown as separate line item)
                if (ltmPerUnit === 0) {
                    baseDisplayPrice = baseUnitPrice;
                } else {
                    const priceWithoutLTM = garmentCost + transferCost + laborCost + freightCost;
                    baseDisplayPrice = this.pricingCalculator.applyRounding(priceWithoutLTM);
                }
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

        // Process child rows (extended sizes) - they have different unit prices with upcharges
        const childRows = document.querySelectorAll('#product-tbody .child-row');
        childRows.forEach(childRow => {
            const extendedSize = childRow.dataset.extendedSize;
            const baseCost = parseFloat(childRow.dataset.baseCost) || 0;
            const sizeUpcharges = childRow.dataset.sizeUpcharges ? JSON.parse(childRow.dataset.sizeUpcharges) : {};
            const qtyDisplay = childRow.querySelector('.cell-qty');
            const qty = parseInt(qtyDisplay?.textContent) || 0;

            if (qty > 0) {
                // Get size upcharge for this extended size (XXL/2XL, 3XL/XXXL, 4XL, 5XL, 6XL)
                const upcharge = this.getSizeUpcharge(extendedSize, sizeUpcharges);

                // Calculate unit price with upcharge (add AFTER margin, not before)
                const garmentCost = baseCost / marginDenom + upcharge;
                const unitPrice = garmentCost + transferCost + laborCost + freightCost + ltmPerUnit;
                const roundedPrice = this.pricingCalculator.applyRounding(unitPrice);

                // Calculate display price without LTM (LTM shown as separate line item)
                let displayPrice;
                if (ltmPerUnit === 0) {
                    displayPrice = roundedPrice;
                } else {
                    const priceWithoutLTM = garmentCost + transferCost + laborCost + freightCost;
                    displayPrice = this.pricingCalculator.applyRounding(priceWithoutLTM);
                }

                // Display unit price on child row (use querySelector for robustness)
                const priceCell = childRow.querySelector('.cell-price');
                if (priceCell) priceCell.textContent = `$${displayPrice.toFixed(2)}`;

                // Update child row total (qty × price)
                const childTotalCell = childRow.querySelector('.cell-total');
                if (childTotalCell) {
                    const childTotal = displayPrice * qty;
                    childTotalCell.textContent = qty > 0 ? `$${childTotal.toFixed(2)}` : '-';
                }

                // Add to grand total
                grandTotal += roundedPrice * qty;
            }
        });

        // Update subtotal and grand total
        document.getElementById('subtotal').textContent = `$${grandTotal.toFixed(2)}`;

        // Update pre-tax subtotal for tax calculation
        const preTaxSubtotal = document.getElementById('pre-tax-subtotal');
        if (preTaxSubtotal) {
            preTaxSubtotal.textContent = `$${grandTotal.toFixed(2)}`;
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

        // Add child row quantities (extended sizes)
        const childRows = document.querySelectorAll('#product-tbody .child-row');
        childRows.forEach(childRow => {
            const qtyDisplay = childRow.querySelector('.cell-qty');
            total += parseInt(qtyDisplay?.textContent) || 0;
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
        if (!upcharges || Object.keys(upcharges).length === 0) {
            console.log(`[DTF] No upcharges provided for size ${size}, using defaults`);
            // Fallback defaults if no API data
            const defaults = { '2XL': 2.00, '3XL': 3.00, '4XL': 4.00, '5XL': 5.00, '6XL': 6.00 };
            const normalizedSize = size === 'XXL' ? '2XL' : (size === 'XXXL' ? '3XL' : size);
            return defaults[normalizedSize] || 0;
        }

        // Normalize size aliases (XXL -> 2XL, XXXL -> 3XL)
        const sizeAliases = {
            'XXL': '2XL',
            'XXXL': '3XL'
        };
        const normalizedSize = sizeAliases[size] || size;

        // Helper to get value (uses nullish coalescing to handle 0 values correctly)
        const getValue = (...keys) => {
            for (const key of keys) {
                if (upcharges[key] !== undefined && upcharges[key] !== null) {
                    return upcharges[key];
                }
            }
            return null;
        };

        // Defaults if API doesn't have the size
        const defaults = { '2XL': 2.00, '3XL': 3.00, '4XL': 4.00, '5XL': 5.00, '6XL': 6.00 };

        // Try API values first, then fall back to defaults
        const upchargeMap = {
            '2XL': getValue('2XL', '2X', 'XXL') ?? defaults['2XL'],
            '3XL': getValue('3XL', '3X', 'XXXL') ?? defaults['3XL'],
            '4XL': getValue('4XL', '4X') ?? defaults['4XL'],
            '5XL': getValue('5XL', '5X') ?? defaults['5XL'],
            '6XL': getValue('6XL', '6X') ?? defaults['6XL']
        };

        const result = upchargeMap[normalizedSize] ?? 0;
        console.log(`[DTF] getSizeUpcharge(${size}): API value=${getValue(normalizedSize)}, result=${result}`);
        return result;
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
        }
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

        // Generate quote ID
        const quoteId = this.generateQuoteId();
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

            // Add child row quantities
            const childMap = window.childRowMap?.[p.id] || {};
            Object.entries(childMap).forEach(([size, childRowId]) => {
                const childRow = document.getElementById(`row-${childRowId}`);
                if (childRow) {
                    const qtyDisplay = childRow.querySelector('.cell-qty');
                    const qty = parseInt(qtyDisplay?.textContent) || 0;
                    if (qty > 0) {
                        // Normalize display size (XXL->2XL, XXXL->3XL)
                        const displaySize = size === 'XXL' ? '2XL' : (size === 'XXXL' ? '3XL' : size);
                        allQuantities[displaySize] = qty;
                        totalQty += qty;
                    }
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
        const grandTotal = parseFloat(document.getElementById('grand-total-with-tax')?.textContent?.replace('$', '') || '0');

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

    generateQuoteId() {
        const now = new Date();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const seq = String(Math.floor(Math.random() * 9999)).padStart(4, '0');
        return `DTF${month}${day}-${seq}`;
    }

    async saveQuote() {
        const customerName = document.getElementById('customer-name').value.trim();
        const customerEmail = document.getElementById('customer-email').value.trim();
        const notes = document.getElementById('quote-notes').value.trim();

        if (!customerName || !customerEmail) {
            alert('Please enter customer name and email');
            return;
        }

        const totalQty = this.getTotalQuantity();
        // DTF uses grand-total-with-tax (not grand-total)
        const grandTotal = parseFloat(document.getElementById('grand-total-with-tax')?.textContent?.replace('$', '') || '0');

        // Build complete quote data with all pricing metadata
        const quoteData = {
            quoteId: document.getElementById('quote-id').textContent,
            customerName,
            customerEmail,
            notes,
            // Location data
            selectedLocations: this.selectedLocations,
            locationDetails: this.selectedLocations.map(loc => ({
                code: loc,
                label: this.locationConfig[loc]?.label,
                size: this.locationConfig[loc]?.size
            })),
            // Product data with catalogColor for inventory API
            // Includes child row quantities for extended sizes
            products: this.products.map(p => {
                // Start with standard sizes from products array
                const standardSizes = ['S', 'M', 'L', 'XL'];
                const allQuantities = {};
                standardSizes.forEach(size => {
                    allQuantities[size] = p.quantities[size] || 0;
                });

                // Add child row quantities (extended sizes)
                const childMap = window.childRowMap?.[p.id] || {};
                Object.entries(childMap).forEach(([size, childRowId]) => {
                    const childRow = document.getElementById(`row-${childRowId}`);
                    if (childRow) {
                        const qtyDisplay = childRow.querySelector('.cell-qty');
                        const qty = parseInt(qtyDisplay?.textContent) || 0;
                        // Normalize size names (XXL->2XL, XXXL->3XL)
                        const normalizedSize = size === 'XXL' ? '2XL' : (size === 'XXXL' ? '3XL' : size);
                        allQuantities[normalizedSize] = qty;
                    }
                });

                return {
                    styleNumber: p.styleNumber,
                    description: p.description,
                    color: p.color,              // Display name
                    catalogColor: p.catalogColor, // CATALOG_COLOR for API/ShopWorks
                    baseCost: p.baseCost,
                    sizeUpcharges: p.sizeUpcharges,
                    quantities: allQuantities
                };
            }),
            // Quantity and pricing
            totalQuantity: totalQty,
            grandTotal: grandTotal,
            // Pricing metadata from API (for audit/verification)
            pricingMetadata: this.currentPricingData ? {
                tier: this.currentPricingData.tier,
                marginDenominator: this.currentPricingData.marginDenom,
                laborCostPerLocation: this.currentPricingData.laborCostPerLoc,
                freightPerTransfer: this.currentPricingData.freightPerTransfer,
                ltmPerUnit: this.currentPricingData.ltmPerUnit,
                totalLtmFee: this.currentPricingData.totalLtmFee,
                transferBreakdown: this.currentPricingData.transferBreakdown
            } : null,
            // Metadata
            createdAt: new Date().toISOString(),
            builderVersion: '2026.01'
        };

        try {
            const result = await this.quoteService.saveQuote(quoteData);
            if (result.success) {
                alert(`Quote saved successfully!\nQuote ID: ${quoteData.quoteId}`);
            }
        } catch (error) {
            console.error('[DTFQuoteBuilder] Save error:', error);
            alert('Error saving quote. Please try again.');
        }
    }

    /**
     * Save quote and show shareable link modal
     * Called from "Save & Get Shareable Link" button
     */
    async saveAndGetLink() {
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

        // Generate quote ID
        const quoteId = this.generateQuoteId();
        // DTF uses grand-total-with-tax (not grand-total), and ltm-row-total (not ltm-fee)
        const grandTotal = parseFloat(document.getElementById('grand-total-with-tax')?.textContent?.replace('$', '')) || 0;
        const subtotal = parseFloat(document.getElementById('subtotal')?.textContent?.replace('$', '')) || grandTotal;
        const ltmFee = parseFloat(document.getElementById('ltm-row-total')?.textContent?.replace('$', '')) || 0;

        // Build quote data
        const quoteData = {
            quoteId: quoteId,
            customerName,
            customerEmail,
            companyName,
            salesRep,
            notes: '',
            selectedLocations: this.selectedLocations,
            locationDetails: this.selectedLocations.map(loc => ({
                code: loc,
                label: this.locationConfig[loc]?.label,
                size: this.locationConfig[loc]?.size
            })),
            products: this.products.map(p => {
                const standardSizes = ['S', 'M', 'L', 'XL'];
                const extendedSizes = ['2XL', '3XL', '4XL', '5XL', '6XL'];
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

                // Add child row quantities (extended sizes)
                const childMap = window.childRowMap?.[p.id] || {};
                Object.entries(childMap).forEach(([size, childRowId]) => {
                    const childRow = document.getElementById(`row-${childRowId}`);
                    if (childRow) {
                        const qtyDisplay = childRow.querySelector('.cell-qty');
                        const qty = parseInt(qtyDisplay?.textContent) || 0;
                        const normalizedSize = size === 'XXL' ? '2XL' : (size === 'XXXL' ? '3XL' : size);
                        allQuantities[normalizedSize] = qty;
                    }
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
                    // Get unit price - try class selector first, then ID fallback (HTML uses ID)
                    const unitPriceCell = parentRow?.querySelector('.row-price') || document.getElementById(`row-price-${rowId}`);
                    const unitPrice = parseFloat(unitPriceCell?.textContent?.replace('$', '').replace(',', '')) || 0;

                    sizeGroups.push({
                        sizes: stdQtys,
                        quantity: stdTotalQty,
                        unitPrice: unitPrice,
                        total: stdTotalQty * unitPrice,
                        effectiveCost: p.baseCost,
                        color: color,            // Include parent row color
                        catalogColor: catalogColor,
                        imageUrl: imageUrl
                    });
                }

                // Extended sizes - each as separate group with their own unit price and color
                extendedSizes.forEach(size => {
                    const qty = allQuantities[size] || 0;
                    if (qty > 0) {
                        // Get unit price from child row's displayed "Unit $" cell
                        // Try display size first, then internal size name (XXL=2XL, XXXL=3XL)
                        const internalSize = size === '2XL' ? 'XXL' : (size === '3XL' ? 'XXXL' : size);
                        const childRowId = childMap[size] || childMap[internalSize];
                        const childRow = document.getElementById(`row-${childRowId}`);

                        // Read color from CHILD row (may differ from parent if user changed it)
                        const childColor = childRow?.dataset?.color || color;
                        const childCatalogColor = childRow?.dataset?.catalogColor || catalogColor;
                        const childImageUrl = childRow?.dataset?.swatchUrl || imageUrl;

                        const unitPriceCell = childRow?.querySelector('.cell-price');  // HTML child rows use .cell-price
                        const unitPrice = parseFloat(unitPriceCell?.textContent?.replace('$', '').replace(',', '')) || 0;

                        sizeGroups.push({
                            sizes: { [size]: qty },
                            quantity: qty,
                            unitPrice: unitPrice,
                            total: qty * unitPrice,
                            effectiveCost: p.baseCost + (p.sizeUpcharges?.[size] || 0),
                            color: childColor,       // Use child row color (or parent fallback)
                            catalogColor: childCatalogColor,
                            imageUrl: childImageUrl
                        });
                    }
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
            pricingMetadata: this.currentPricingData ? {
                tier: this.currentPricingData.tier,
                marginDenominator: this.currentPricingData.marginDenom,
                laborCostPerLocation: this.currentPricingData.laborCostPerLoc,
                freightPerTransfer: this.currentPricingData.freightPerTransfer,
                ltmPerUnit: this.currentPricingData.ltmPerUnit,
                totalLtmFee: this.currentPricingData.totalLtmFee,
                transferBreakdown: this.currentPricingData.transferBreakdown
            } : null,
            createdAt: new Date().toISOString(),
            builderVersion: '2026.01',
            // Additional charges (2026 fee refactor)
            artCharge: document.getElementById('art-charge-toggle')?.checked
                ? parseFloat(document.getElementById('art-charge')?.value || 0) : 0,
            graphicDesignHours: parseFloat(document.getElementById('graphic-design-hours')?.value || 0),
            graphicDesignCharge: parseFloat(document.getElementById('graphic-design-hours')?.value || 0) * 75,
            rushFee: parseFloat(document.getElementById('rush-fee')?.value || 0),
            discount: (() => {
                const amount = parseFloat(document.getElementById('discount-amount')?.value || 0);
                const type = document.getElementById('discount-type')?.value || 'fixed';
                if (type === 'percent') {
                    return (subtotal * amount / 100);
                }
                return amount;
            })(),
            discountPercent: document.getElementById('discount-type')?.value === 'percent'
                ? parseFloat(document.getElementById('discount-amount')?.value || 0) : 0,
            discountReason: document.getElementById('discount-reason')?.value || ''
        };

        // Show saving state on button
        const saveBtn = document.querySelector('.btn-save-quote');
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
                console.log('[DTFQuoteBuilder] Updating existing quote:', this.editingQuoteId);
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
                console.log('[DTFQuoteBuilder] Quote saved successfully:', finalQuoteId);

                // Clear draft after successful save
                if (this.persistence) {
                    this.persistence.clearDraft();
                    console.log('[DTFQuoteBuilder] Draft cleared after successful save');
                }

                // Show success modal with shareable link
                // Prefer shared QuoteShareModal module (2026 consolidation)
                if (typeof QuoteShareModal !== 'undefined' && QuoteShareModal.show) {
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

        try {
            // Build pricing data in format expected by EmbroideryInvoiceGenerator
            const pricingData = this.buildPricingDataForInvoice();

            // Customer data from form
            const customerData = {
                name: document.getElementById('customer-name')?.value || 'Customer',
                company: document.getElementById('company-name')?.value || '',
                email: document.getElementById('customer-email')?.value || '',
                salesRepEmail: document.getElementById('sales-rep')?.value || 'sales@nwcustomapparel.com'
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
        // DTF uses grand-total-with-tax (not grand-total)
        const grandTotal = parseFloat(document.getElementById('grand-total-with-tax')?.textContent?.replace('$', '') || '0');
        const quoteId = document.getElementById('quote-id')?.textContent || `DTF-${Date.now()}`;

        // Build products array with line items
        const products = [];

        // Get pricing tier info
        const tier = this.currentPricingData?.tier || this.getTierForQuantity(totalQty);

        // Iterate through each product row
        this.products.forEach(product => {
            // Skip products with no quantities
            const productQty = Object.values(product.quantities || {}).reduce((sum, q) => sum + (parseInt(q) || 0), 0);
            if (productQty === 0) return;

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

                // Calculate unit price for base sizes
                const unitPrice = this.calculateUnitPrice(product, 'S'); // Base price

                lineItems.push({
                    description: desc,
                    quantity: baseQty,
                    unitPrice: unitPrice,
                    total: baseQty * unitPrice
                });
            }

            // Extended sizes - query child rows from DOM using window.childRowMap
            // Child rows are created by createChildRow() when user adds extended sizes
            const childMap = window.childRowMap?.[product.id] || {};
            const extendedItems = [];  // Collect extended items for sorting
            Object.entries(childMap).forEach(([size, childRowId]) => {
                const childRow = document.getElementById(`row-${childRowId}`);
                if (childRow) {
                    const qtyDisplay = childRow.querySelector('.cell-qty');
                    const priceCell = childRow.querySelector('.cell-price');
                    const qty = parseInt(qtyDisplay?.textContent) || 0;
                    const unitPrice = parseFloat(priceCell?.textContent?.replace('$', '')) || 0;

                    if (qty > 0) {
                        // Normalize size display (XXL→2XL, XXXL→3XL for consistency)
                        const displaySize = size === 'XXL' ? '2XL' : (size === 'XXXL' ? '3XL' : size);
                        extendedItems.push({
                            description: `${displaySize}(${qty})`,
                            quantity: qty,
                            unitPrice: unitPrice,
                            total: qty * unitPrice,
                            hasUpcharge: true,
                            _sortKey: size  // Keep original size for sorting
                        });
                    }
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

        // Calculate subtotal from line items
        let subtotal = 0;
        products.forEach(p => {
            p.lineItems.forEach(item => {
                subtotal += item.total;
            });
        });

        // Get art charge if enabled
        const artChargeToggle = document.getElementById('art-charge-toggle');
        const artCharge = artChargeToggle?.checked ? parseFloat(document.getElementById('art-charge')?.value || 0) : 0;

        // Get graphic design fee
        const designHours = parseFloat(document.getElementById('graphic-design-hours')?.value || 0);
        const graphicDesignFee = designHours * 75;

        // Get rush fee
        const rushFee = parseFloat(document.getElementById('rush-fee')?.value || 0);

        // Get discount
        const discountAmount = parseFloat(document.getElementById('discount-amount')?.value || 0);
        const discountType = document.getElementById('discount-type')?.value || 'fixed';
        const discountReason = document.getElementById('discount-reason')?.value || '';
        let discount = 0;
        if (discountType === 'percent') {
            discount = subtotal * (discountAmount / 100);
        } else {
            discount = discountAmount;
        }

        return {
            quoteId: quoteId,
            tier: tier,
            products: products,
            subtotal: subtotal,
            grandTotal: grandTotal,
            setupFees: 0,
            additionalServicesTotal: 0,
            // Empty logos means embroidery specs section will be skipped
            logos: [],
            // DTF-specific info (could be used for future DTF specs section)
            isDTF: true,
            selectedLocations: this.selectedLocations,
            ltmFee: this.currentPricingData?.totalLtmFee || 0,
            ltmDistributed: false,  // LTM always shown as separate line item
            // Artwork services
            artCharge: artCharge,
            graphicDesignFee: graphicDesignFee,
            graphicDesignHours: designHours,
            // Rush and discount
            rushFee: rushFee,
            discount: discount,
            discountType: discountType,
            discountReason: discountReason
        };
    }

    /**
     * Calculate unit price for a product at a given size
     * Includes LTM distribution if enabled
     */
    calculateUnitPrice(product, size) {
        // First try: Read displayed price from parent row DOM
        const row = document.querySelector(`tr[data-product-id="${product.id}"]`);
        if (row) {
            // Read from DOM: .row-price and .row-qty spans (see HTML template ~line 967-968)
            const priceSpan = row.querySelector('.row-price');
            const qtySpan = row.querySelector('.row-qty');
            if (priceSpan && qtySpan) {
                // The price cell shows UNIT price (not total), so no need to divide by qty
                const displayedUnitPrice = parseFloat(priceSpan.textContent.replace('$', '')) || 0;
                const qty = parseInt(qtySpan.textContent) || 0;
                if (qty > 0 && displayedUnitPrice > 0) {
                    // For base sizes (S, M, L, XL), return the displayed unit price directly
                    // For extended sizes, the child row already has its own price with upcharge applied
                    const standardSizes = ['S', 'M', 'L', 'XL'];
                    if (standardSizes.includes(size)) {
                        return displayedUnitPrice;
                    }
                    // For extended sizes called on parent row (shouldn't happen normally)
                    // add the upcharge to base price
                    const upcharge = this.getSizeUpcharge(size, product.sizeUpcharges || {});
                    return Math.round((displayedUnitPrice + upcharge) * 100) / 100;
                }
            }
        }

        // Fallback: Calculate using CORRECT formula (matches updatePricing)
        if (this.currentPricingData) {
            const baseCost = parseFloat(product.baseCost) || 0;
            const upcharge = product.sizeUpcharges?.[size] || 0;
            const transferCost = this.getTransferCostForProduct(product);
            const laborCostPerLoc = this.currentPricingData.laborCostPerLoc || 0;
            const freightPerTransfer = this.currentPricingData.freightPerTransfer || 0;
            const marginDenom = this.currentPricingData.marginDenom || 0.6;
            const locationCount = this.selectedLocations.length || 1;

            // Labor and freight are per-location (matches updatePricing)
            const laborCost = laborCostPerLoc * locationCount;
            const freightCost = freightPerTransfer * locationCount;

            // Upcharge is a selling price add-on, add AFTER margin calculation
            const garmentCost = baseCost / marginDenom + upcharge;
            const unitPrice = garmentCost + transferCost + laborCost + freightCost;
            // Note: LTM is always shown as separate line item, not added to unit price

            // Apply rounding
            return this.pricingCalculator?.applyRounding(unitPrice) || Math.ceil(unitPrice * 2) / 2;
        }

        return 0;
    }

    /**
     * Get transfer cost for a product based on selected locations
     */
    getTransferCostForProduct(product) {
        if (!this.currentPricingData?.transferBreakdown) return 0;

        let totalTransferCost = 0;
        // selectedLocations contains strings like "left-chest", not objects
        this.selectedLocations.forEach(loc => {
            const locBreakdown = this.currentPricingData.transferBreakdown[loc];
            if (locBreakdown) {
                totalTransferCost += locBreakdown.cost || 0;
            }
        });

        return totalTransferCost;
    }

    async emailQuote() {
        const customerName = document.getElementById('customer-name').value.trim();
        const customerEmail = document.getElementById('customer-email').value.trim();

        if (!customerEmail) {
            alert('Please enter customer email');
            return;
        }

        if (!customerName) {
            alert('Please enter customer name');
            return;
        }

        const totalQty = this.getTotalQuantity();
        // DTF uses grand-total-with-tax (not grand-total)
        const grandTotal = parseFloat(document.getElementById('grand-total-with-tax')?.textContent?.replace('$', '') || '0');

        // Build email data
        const emailData = {
            quoteID: document.getElementById('quote-id').textContent,
            customerName,
            customerEmail,
            selectedLocations: this.selectedLocations,
            products: this.products,
            totalQuantity: totalQty,
            total: grandTotal,
            tierLabel: this.currentPricingData?.tier || this.getTierForQuantity(totalQty),
            specialNotes: document.getElementById('quote-notes')?.value || ''
        };

        try {
            const result = await this.quoteService.sendQuoteEmail(emailData);
            if (result.success) {
                if (result.message?.includes('pending')) {
                    // Template not ready yet
                    alert('Email template not yet configured. Please use Print to share the quote.');
                } else {
                    alert(`Quote emailed successfully to ${customerEmail}`);
                }
            } else {
                alert('Error sending email: ' + (result.error || 'Unknown error'));
            }
        } catch (error) {
            console.error('[DTFQuoteBuilder] Email error:', error);
            alert('Error sending email. Please try again or use Print.');
        }
    }

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
        const totalQty = this.getTotalQuantity();
        // DTF uses grand-total-with-tax (not grand-total)
        const grandTotal = parseFloat(document.getElementById('grand-total-with-tax')?.textContent?.replace('$', '') || '0');
        const tier = this.currentPricingData?.tier || this.getTierForQuantity(totalQty);

        let text = '';

        // Header
        text += `NORTHWEST CUSTOM APPAREL\n`;
        text += `2025 Freeman Road East, Milton, WA 98354\n`;
        text += `Phone: (253) 922-5793 | Email: sales@nwcustomapparel.com\n\n`;

        // Quote Header
        text += `DTF TRANSFER QUOTE\n`;
        text += `Date: ${new Date().toLocaleDateString()}\n`;
        text += `Valid for: 30 days\n\n`;

        // Locations
        text += `TRANSFER LOCATIONS:\n`;
        this.selectedLocations.forEach(loc => {
            const config = this.locationConfig[loc];
            text += `  - ${config.label} (${config.size})\n`;
        });
        text += `\n`;

        // Products
        text += `PRODUCTS:\n`;
        this.products.forEach(product => {
            const totalProductQty = Object.values(product.quantities).reduce((s, q) => s + (q || 0), 0);
            if (totalProductQty === 0) return;

            text += `${product.styleNumber} - ${product.description}\n`;
            text += `  Color: ${product.color || 'Not selected'}\n`;

            // Size breakdown
            const sizeStr = Object.entries(product.quantities)
                .filter(([_, qty]) => qty > 0)
                .map(([size, qty]) => `${size}(${qty})`)
                .join(' ');
            text += `  Sizes: ${sizeStr}\n`;
            text += `  Quantity: ${totalProductQty} pieces\n\n`;
        });

        // Pricing
        text += `PRICING SUMMARY:\n`;
        text += `  Total Quantity: ${totalQty} pieces\n`;
        text += `  Pricing Tier: ${tier}\n`;
        if (this.currentPricingData?.totalLtmFee > 0) {
            text += `  Small Batch Fee: $${this.currentPricingData.totalLtmFee.toFixed(2)} (included in pricing)\n`;
        }
        text += `  GRAND TOTAL: $${grandTotal.toFixed(2)}\n\n`;

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
        const indicator = document.getElementById('unsaved-indicator');
        if (indicator) {
            indicator.style.display = 'inline';
        }
    }

    markAsSaved() {
        this.hasChanges = false;
        const indicator = document.getElementById('unsaved-indicator');
        if (indicator) {
            indicator.style.display = 'none';
        }
    }

    hasUnsavedChanges() {
        return this.hasChanges;
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
        // Clear all product rows and re-add empty state
        const tbody = document.getElementById('product-tbody');
        tbody.innerHTML = `
            <tr id="empty-state-row">
                <td colspan="12" style="text-align: center; padding: 40px 20px; color: #64748b; background: #f8fafc;">
                    <div style="font-size: 32px; margin-bottom: 12px;">&#128085;</div>
                    <div style="font-size: 16px; font-weight: 500; margin-bottom: 8px;">Enter a style number to get started</div>
                    <div style="font-size: 13px; color: #94a3b8;">Type a style # in the search bar above (e.g., PC54, G500)</div>
                </td>
            </tr>
        `;

        // Reset state
        this.products = [];
        this.productIndex = 0;
        this.selectedLocations = [];
        this.editingQuoteId = null;
        this.editingRevision = null;

        // Reset location checkboxes
        document.querySelectorAll('.location-checkbox').forEach(cb => {
            cb.checked = false;
        });

        // Reset customer form fields
        const customerName = document.getElementById('customer-name');
        const customerEmail = document.getElementById('customer-email');
        const companyName = document.getElementById('company-name');
        const customerLookup = document.getElementById('customer-lookup');
        if (customerName) customerName.value = '';
        if (customerEmail) customerEmail.value = '';
        if (companyName) companyName.value = '';
        if (customerLookup) customerLookup.value = '';

        // Reset additional charges
        const rushFee = document.getElementById('rush-fee');
        const discountAmount = document.getElementById('discount-amount');
        const discountReason = document.getElementById('discount-reason');
        if (rushFee) rushFee.value = '';
        if (discountAmount) discountAmount.value = '';
        if (discountReason) discountReason.value = '';

        // Clear draft storage
        if (this.persistence) {
            this.persistence.clearDraft();
        }

        // Mark as saved (no unsaved changes)
        this.markAsSaved();

        // Update sidebar
        this.updateSearchState();
        this.updateSidebar();

        // Focus search bar for immediate typing
        const searchInput = document.getElementById('product-search');
        if (searchInput) {
            searchInput.focus();
        }

        this.showToast('Started new quote', 'success');
    }
}

// Global instance
let dtfQuoteBuilder;

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    dtfQuoteBuilder = new DTFQuoteBuilder();
    window.dtfQuoteBuilder = dtfQuoteBuilder;
});

// Global function wrappers for HTML onclick handlers
function copyQuoteToClipboard() {
    if (dtfQuoteBuilder) {
        dtfQuoteBuilder.copyQuoteToClipboard();
    }
}

function printQuote() {
    if (dtfQuoteBuilder) {
        dtfQuoteBuilder.printQuote();
    }
}
