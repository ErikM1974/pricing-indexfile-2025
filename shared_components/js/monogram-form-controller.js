/**
 * Monogram Form Controller
 * Handles UI logic, state management, and user interactions
 */

// Size sorting order (smallest to largest)
const SIZE_ORDER = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL', '6XL', 'LT', 'XLT', '2XLT', '3XLT', '4XLT', 'OSFA'];

class MonogramFormController {
    constructor() {
        this.service = new MonogramFormService();
        this.orderData = null;
        this.products = [];
        this.currentMonogramID = null;
        this.isDirty = false;
        this.orderLoaded = false;  // Track if order data is loaded (affects row mode)

        // Thread color state
        this.threadColors = [];           // All available thread colors from API
        this.selectedThreadColors = [];   // Currently selected thread color names

        // Location state
        this.locations = ['Right Chest', 'Right Sleeve', 'Left Sleeve', 'Below Logo', 'Other'];
        this.selectedLocations = [];      // Currently selected location names
        this.otherLocationText = '';      // Custom text for "Other" location

        // Imported names state (bulk paste feature)
        this.importedNames = [];          // All names parsed from paste
        this.usedNameIndices = new Set(); // Track which indices are used

        // Initialize when DOM is ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.init());
        } else {
            this.init();
        }
    }

    // ============================================
    // Initialization
    // ============================================

    init() {
        // Set current date
        this.setCurrentDate();

        // Initialize empty rows
        this.initializeEmptyRows(5);

        // Bind event listeners
        this.bindEventListeners();

        // Initialize thread color dropdown
        this.initThreadColorDropdown();

        // Initialize location dropdown
        this.initLocationDropdown();

        // Initialize paste names functionality
        this.initPasteNames();

        // Check for URL parameters
        this.checkURLParameters();
    }

    setCurrentDate() {
        const dateEl = document.getElementById('currentDate');
        if (dateEl) {
            dateEl.textContent = this.service.getCurrentDate();
        }
    }

    // ============================================
    // Event Listeners
    // ============================================

    bindEventListeners() {
        // Order lookup
        const lookupBtn = document.getElementById('lookupOrderBtn');
        if (lookupBtn) {
            lookupBtn.addEventListener('click', () => this.handleOrderLookup());
        }

        // Enter key on order number field
        const orderInput = document.getElementById('orderNumber');
        if (orderInput) {
            orderInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    this.handleOrderLookup();
                }
            });
        }

        // Add row buttons
        document.getElementById('addRowBtn')?.addEventListener('click', () => this.addRow());
        document.getElementById('addRowBtnBottom')?.addEventListener('click', () => this.addRow());
        document.getElementById('add5RowsBtn')?.addEventListener('click', () => this.addRows(5));

        // Form actions
        document.getElementById('clearFormBtn')?.addEventListener('click', () => this.clearForm());
        document.getElementById('saveDraftBtn')?.addEventListener('click', () => this.saveDraft());
        document.getElementById('printPdfBtn')?.addEventListener('click', () => this.printPDF());

        // Search functionality
        document.getElementById('searchBtn')?.addEventListener('click', () => this.toggleSearchPanel());
        document.getElementById('closeSearchBtn')?.addEventListener('click', () => this.toggleSearchPanel(false));
        document.getElementById('doSearchBtn')?.addEventListener('click', () => this.handleSearch());
        document.getElementById('newFormBtn')?.addEventListener('click', () => this.newForm());

        // Track form changes
        document.getElementById('monogramForm')?.addEventListener('input', () => {
            this.isDirty = true;
        });

        // Warn before navigating away with unsaved changes
        window.addEventListener('beforeunload', (e) => {
            if (this.isDirty) {
                e.preventDefault();
                e.returnValue = '';
            }
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey || e.metaKey) {
                if (e.key === 's') {
                    e.preventDefault();
                    this.saveDraft();
                } else if (e.key === 'p') {
                    e.preventDefault();
                    this.printPDF();
                }
            }
        });
    }

    checkURLParameters() {
        const params = new URLSearchParams(window.location.search);
        const orderNumber = params.get('order');
        const loadOrder = params.get('load');  // Load existing monogram by order number
        const autoPrint = params.get('print') === 'true';

        if (loadOrder) {
            // Load existing monogram from database
            this.loadExistingForm(loadOrder).then(() => {
                if (autoPrint) {
                    // Delay to allow form to render before triggering print
                    setTimeout(() => this.printPDF(), 500);
                }
            });
        } else if (orderNumber) {
            // Just populate order number field and do lookup
            document.getElementById('orderNumber').value = orderNumber;
            this.handleOrderLookup();
        }
    }

    // ============================================
    // Thread Color Dropdown
    // ============================================

    /**
     * Initialize thread color dropdown - fetch colors and bind events
     */
    async initThreadColorDropdown() {
        const toggleBtn = document.getElementById('threadColorBtn');
        const dropdown = document.getElementById('threadColorDropdown');
        const searchInput = document.getElementById('threadColorSearch');
        const doneBtn = document.getElementById('threadColorDoneBtn');

        if (!toggleBtn || !dropdown) return;

        // Bind toggle button
        toggleBtn.addEventListener('click', () => this.toggleThreadColorDropdown());

        // Bind Done button
        if (doneBtn) {
            doneBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                e.preventDefault();
                this.closeThreadColorDropdown();
                // Auto-fill rows if only one thread color selected
                this.autoFillThreadColorIfSingle();
            });
        }

        // Bind search input
        if (searchInput) {
            searchInput.addEventListener('input', (e) => this.filterThreadColors(e.target.value));
        }

        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.thread-color-group')) {
                this.closeThreadColorDropdown();
            }
        });

        // Load thread colors from API
        await this.loadThreadColors();
    }

    /**
     * Fetch thread colors from API
     */
    async loadThreadColors() {
        try {
            this.threadColors = await this.service.fetchThreadColors();
            this.renderThreadColorOptions();
        } catch (error) {
            console.error('[MonogramController] Failed to load thread colors:', error);
            this.showToast('Failed to load thread colors', 'error');
        }
    }

    /**
     * Toggle thread color dropdown visibility
     */
    toggleThreadColorDropdown() {
        const dropdown = document.getElementById('threadColorDropdown');
        const toggleBtn = document.getElementById('threadColorBtn');

        if (!dropdown) return;

        const isHidden = dropdown.hidden;
        dropdown.hidden = !isHidden;
        toggleBtn.classList.toggle('open', !isHidden);

        // Focus search input when opening
        if (!isHidden === false) {
            const searchInput = document.getElementById('threadColorSearch');
            if (searchInput) {
                searchInput.value = '';
                searchInput.focus();
                this.filterThreadColors('');  // Reset filter
            }
        }
    }

    /**
     * Close thread color dropdown
     */
    closeThreadColorDropdown() {
        const dropdown = document.getElementById('threadColorDropdown');
        const toggleBtn = document.getElementById('threadColorBtn');

        if (dropdown) dropdown.hidden = true;
        if (toggleBtn) toggleBtn.classList.remove('open');
    }

    /**
     * Render thread color options in dropdown
     */
    renderThreadColorOptions(filterText = '') {
        const listEl = document.getElementById('threadColorList');
        if (!listEl) return;

        const filter = filterText.toLowerCase();
        const filteredColors = this.threadColors.filter(color =>
            color.Thread_Color.toLowerCase().includes(filter)
        );

        if (filteredColors.length === 0) {
            listEl.innerHTML = '<div class="thread-color-option" style="color: var(--text-secondary);">No colors found</div>';
            return;
        }

        listEl.innerHTML = filteredColors.map(color => {
            const isSelected = this.selectedThreadColors.includes(color.Thread_Color);
            return `
                <div class="thread-color-option" data-color="${this.escapeHTML(color.Thread_Color)}">
                    <input type="checkbox" id="tc_${color.Thead_ID}" ${isSelected ? 'checked' : ''}>
                    <label for="tc_${color.Thead_ID}">${this.escapeHTML(color.Thread_Color)}</label>
                </div>
            `;
        }).join('');

        // Bind click events to options
        listEl.querySelectorAll('.thread-color-option').forEach(option => {
            option.addEventListener('click', (e) => {
                // Don't toggle if clicking directly on checkbox (it handles itself)
                if (e.target.type !== 'checkbox') {
                    const checkbox = option.querySelector('input[type="checkbox"]');
                    checkbox.checked = !checkbox.checked;
                }
                this.handleThreadColorToggle(option.dataset.color, option.querySelector('input').checked);
            });
        });
    }

    /**
     * Filter thread colors by search text
     */
    filterThreadColors(text) {
        this.renderThreadColorOptions(text);
    }

    /**
     * Handle thread color checkbox toggle
     */
    handleThreadColorToggle(colorName, isChecked) {
        if (isChecked) {
            if (!this.selectedThreadColors.includes(colorName)) {
                this.selectedThreadColors.push(colorName);
            }
        } else {
            this.selectedThreadColors = this.selectedThreadColors.filter(c => c !== colorName);
        }

        this.renderSelectedThreadColorTags();
        this.updateThreadColorButtonText();
        this.updateAllRowThreadColorDropdowns();  // Update row dropdowns
        this.isDirty = true;
    }

    /**
     * Render selected thread color tags
     */
    renderSelectedThreadColorTags() {
        const container = document.getElementById('selectedThreadColors');
        if (!container) return;

        container.innerHTML = this.selectedThreadColors.map(color => `
            <span class="thread-color-tag" data-color="${this.escapeHTML(color)}">
                ${this.escapeHTML(color)}
                <button type="button" class="remove-tag" title="Remove">&times;</button>
            </span>
        `).join('');

        // Bind remove buttons
        container.querySelectorAll('.remove-tag').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const tag = btn.closest('.thread-color-tag');
                const colorName = tag.dataset.color;
                this.handleThreadColorToggle(colorName, false);
                this.renderThreadColorOptions();  // Update checkboxes
            });
        });
    }

    /**
     * Update thread color button text
     */
    updateThreadColorButtonText() {
        const btnText = document.getElementById('threadColorBtnText');
        if (!btnText) return;

        if (this.selectedThreadColors.length === 0) {
            btnText.textContent = 'Select Thread Colors...';
        } else if (this.selectedThreadColors.length === 1) {
            btnText.textContent = this.selectedThreadColors[0];
        } else {
            btnText.textContent = `${this.selectedThreadColors.length} colors selected`;
        }
    }

    /**
     * Get comma-separated string of selected thread colors
     */
    getThreadColorString() {
        return this.selectedThreadColors.join(', ');
    }

    /**
     * Set selected thread colors from a comma-separated string
     */
    setThreadColorsFromString(colorString) {
        if (!colorString) {
            this.selectedThreadColors = [];
        } else {
            this.selectedThreadColors = colorString.split(',').map(c => c.trim()).filter(c => c);
        }
        this.renderSelectedThreadColorTags();
        this.updateThreadColorButtonText();
        this.renderThreadColorOptions();  // Update checkboxes
        this.updateAllRowThreadColorDropdowns();  // Update row dropdowns
    }

    // ============================================
    // Row Thread Color Dropdown
    // ============================================

    /**
     * Create options HTML for row-level thread color dropdown
     * Options come from the selected thread colors in the main selector
     */
    createRowThreadColorOptions() {
        if (this.selectedThreadColors.length === 0) {
            return '<option value="" disabled>Select colors above first</option>';
        }
        return this.selectedThreadColors.map(color =>
            `<option value="${this.escapeHTML(color)}">${this.escapeHTML(color)}</option>`
        ).join('');
    }

    /**
     * Update all row thread color dropdowns when main selection changes
     */
    updateAllRowThreadColorDropdowns() {
        const tbody = document.getElementById('namesTableBody');
        if (!tbody) return;

        const options = '<option value="">Select...</option>' + this.createRowThreadColorOptions();

        tbody.querySelectorAll('.row-thread-color').forEach(select => {
            const currentValue = select.value;
            select.innerHTML = options;
            // Restore value if still valid
            if (this.selectedThreadColors.includes(currentValue)) {
                select.value = currentValue;
            }
        });
    }

    /**
     * Auto-fill thread color for all empty row dropdowns if exactly one color selected
     */
    autoFillThreadColorIfSingle() {
        // Only auto-fill if exactly one thread color selected
        if (this.selectedThreadColors.length !== 1) return;

        const singleColor = this.selectedThreadColors[0];
        const tbody = document.getElementById('namesTableBody');
        if (!tbody) return;

        tbody.querySelectorAll('.row-thread-color').forEach(dropdown => {
            // Only fill if empty (default value)
            if (!dropdown.value || dropdown.value === '') {
                dropdown.value = singleColor;
            }
        });
    }

    // ============================================
    // Location Dropdown
    // ============================================

    /**
     * Initialize location dropdown and bind events
     */
    initLocationDropdown() {
        const toggleBtn = document.getElementById('locationBtn');
        const dropdown = document.getElementById('locationDropdown');
        const doneBtn = document.getElementById('locationDoneBtn');
        const otherInput = document.getElementById('locationOtherText');

        if (!toggleBtn || !dropdown) return;

        // Bind toggle button
        toggleBtn.addEventListener('click', () => this.toggleLocationDropdown());

        // Bind Done button
        if (doneBtn) {
            doneBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                e.preventDefault();
                this.closeLocationDropdown();
                // Auto-fill rows if only one location selected
                this.autoFillLocationIfSingle();
            });
        }

        // Bind Other text input
        if (otherInput) {
            otherInput.addEventListener('input', (e) => {
                this.otherLocationText = e.target.value;
                this.updateAllRowLocationDropdowns();
                this.isDirty = true;
            });
        }

        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.location-group')) {
                this.closeLocationDropdown();
            }
        });

        // Render initial options
        this.renderLocationOptions();
    }

    /**
     * Toggle location dropdown visibility
     */
    toggleLocationDropdown() {
        const dropdown = document.getElementById('locationDropdown');
        const toggleBtn = document.getElementById('locationBtn');

        if (!dropdown) return;

        const isHidden = dropdown.hidden;
        dropdown.hidden = !isHidden;
        toggleBtn.classList.toggle('open', !isHidden);
    }

    /**
     * Close location dropdown
     */
    closeLocationDropdown() {
        const dropdown = document.getElementById('locationDropdown');
        const toggleBtn = document.getElementById('locationBtn');

        if (dropdown) dropdown.hidden = true;
        if (toggleBtn) toggleBtn.classList.remove('open');
    }

    /**
     * Render location options in dropdown
     */
    renderLocationOptions() {
        const listEl = document.getElementById('locationList');
        if (!listEl) return;

        listEl.innerHTML = this.locations.map(location => {
            const isSelected = this.selectedLocations.includes(location);
            const id = 'loc_' + location.replace(/\s+/g, '_');
            return `
                <div class="location-option" data-location="${this.escapeHTML(location)}">
                    <input type="checkbox" id="${id}" ${isSelected ? 'checked' : ''}>
                    <label for="${id}">${this.escapeHTML(location)}</label>
                </div>
            `;
        }).join('');

        // Bind click events to options
        listEl.querySelectorAll('.location-option').forEach(option => {
            option.addEventListener('click', (e) => {
                if (e.target.type !== 'checkbox') {
                    const checkbox = option.querySelector('input[type="checkbox"]');
                    checkbox.checked = !checkbox.checked;
                }
                this.handleLocationToggle(option.dataset.location, option.querySelector('input').checked);
            });
        });
    }

    /**
     * Handle location checkbox toggle
     */
    handleLocationToggle(locationName, isChecked) {
        if (isChecked) {
            if (!this.selectedLocations.includes(locationName)) {
                this.selectedLocations.push(locationName);
            }
        } else {
            this.selectedLocations = this.selectedLocations.filter(l => l !== locationName);
        }

        // Show/hide Other input based on whether "Other" is selected
        const otherInputContainer = document.getElementById('locationOtherInput');
        if (otherInputContainer) {
            otherInputContainer.style.display = this.selectedLocations.includes('Other') ? 'block' : 'none';
        }

        this.renderSelectedLocationTags();
        this.updateLocationButtonText();
        this.updateAllRowLocationDropdowns();
        this.isDirty = true;
    }

    /**
     * Render selected location tags
     */
    renderSelectedLocationTags() {
        const container = document.getElementById('selectedLocations');
        if (!container) return;

        container.innerHTML = this.selectedLocations.map(location => {
            // For "Other", show the custom text if available
            const displayText = (location === 'Other' && this.otherLocationText)
                ? `Other: ${this.otherLocationText}`
                : location;
            return `
                <span class="location-tag" data-location="${this.escapeHTML(location)}">
                    ${this.escapeHTML(displayText)}
                    <button type="button" class="remove-tag" title="Remove">&times;</button>
                </span>
            `;
        }).join('');

        // Bind remove buttons
        container.querySelectorAll('.remove-tag').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const tag = btn.closest('.location-tag');
                const locationName = tag.dataset.location;
                this.handleLocationToggle(locationName, false);
                this.renderLocationOptions();
            });
        });
    }

    /**
     * Update location button text
     */
    updateLocationButtonText() {
        const btnText = document.getElementById('locationBtnText');
        if (!btnText) return;

        if (this.selectedLocations.length === 0) {
            btnText.textContent = 'Select Locations...';
        } else if (this.selectedLocations.length === 1) {
            const loc = this.selectedLocations[0];
            btnText.textContent = (loc === 'Other' && this.otherLocationText)
                ? `Other: ${this.otherLocationText}`
                : loc;
        } else {
            btnText.textContent = `${this.selectedLocations.length} locations selected`;
        }
    }

    /**
     * Get comma-separated string of selected locations (for saving)
     */
    getLocationString() {
        return this.selectedLocations.map(loc => {
            if (loc === 'Other' && this.otherLocationText) {
                return `Other: ${this.otherLocationText}`;
            }
            return loc;
        }).join(', ');
    }

    /**
     * Set selected locations from a comma-separated string
     */
    setLocationsFromString(locationString) {
        if (!locationString) {
            this.selectedLocations = [];
            this.otherLocationText = '';
        } else {
            const parts = locationString.split(',').map(l => l.trim()).filter(l => l);
            this.selectedLocations = [];
            this.otherLocationText = '';

            parts.forEach(part => {
                if (part.startsWith('Other:')) {
                    this.selectedLocations.push('Other');
                    this.otherLocationText = part.replace('Other:', '').trim();
                } else if (this.locations.includes(part)) {
                    this.selectedLocations.push(part);
                }
            });
        }

        // Update Other input field
        const otherInput = document.getElementById('locationOtherText');
        const otherInputContainer = document.getElementById('locationOtherInput');
        if (otherInput) otherInput.value = this.otherLocationText;
        if (otherInputContainer) {
            otherInputContainer.style.display = this.selectedLocations.includes('Other') ? 'block' : 'none';
        }

        this.renderSelectedLocationTags();
        this.updateLocationButtonText();
        this.renderLocationOptions();
        this.updateAllRowLocationDropdowns();
    }

    // ============================================
    // Row Location Dropdown
    // ============================================

    /**
     * Create options HTML for row-level location dropdown
     */
    createRowLocationOptions() {
        if (this.selectedLocations.length === 0) {
            return '<option value="" disabled>Select locations above first</option>';
        }
        return this.selectedLocations.map(location => {
            const displayText = (location === 'Other' && this.otherLocationText)
                ? `Other: ${this.otherLocationText}`
                : location;
            const value = (location === 'Other' && this.otherLocationText)
                ? `Other: ${this.otherLocationText}`
                : location;
            return `<option value="${this.escapeHTML(value)}">${this.escapeHTML(displayText)}</option>`;
        }).join('');
    }

    /**
     * Update all row location dropdowns when main selection changes
     */
    updateAllRowLocationDropdowns() {
        const tbody = document.getElementById('namesTableBody');
        if (!tbody) return;

        const options = '<option value="">Select...</option>' + this.createRowLocationOptions();

        tbody.querySelectorAll('.row-location').forEach(select => {
            const currentValue = select.value;
            select.innerHTML = options;
            // Restore value if still valid (check if any option matches)
            const validValues = this.selectedLocations.map(loc =>
                (loc === 'Other' && this.otherLocationText) ? `Other: ${this.otherLocationText}` : loc
            );
            if (validValues.includes(currentValue)) {
                select.value = currentValue;
            }
        });
    }

    /**
     * Auto-fill location for all empty row dropdowns if exactly one location selected
     */
    autoFillLocationIfSingle() {
        // Only auto-fill if exactly one location selected
        if (this.selectedLocations.length !== 1) return;

        // Get the single location value (handle "Other" case)
        let singleLocation = this.selectedLocations[0];
        if (singleLocation === 'Other' && this.otherLocationText) {
            singleLocation = `Other: ${this.otherLocationText}`;
        }

        const tbody = document.getElementById('namesTableBody');
        if (!tbody) return;

        tbody.querySelectorAll('.row-location').forEach(dropdown => {
            // Only fill if empty (default value)
            if (!dropdown.value || dropdown.value === '') {
                dropdown.value = singleLocation;
            }
        });
    }

    // ============================================
    // Paste Names (Bulk Import)
    // ============================================

    /**
     * Initialize paste names functionality
     */
    initPasteNames() {
        const importBtn = document.getElementById('importNamesBtn');
        const clearBtn = document.getElementById('clearNamesBtn');

        importBtn?.addEventListener('click', () => this.importNames());
        clearBtn?.addEventListener('click', () => this.clearImportedNames());
    }

    /**
     * Parse and import names from textarea
     */
    importNames() {
        const textarea = document.getElementById('pasteNamesInput');
        const text = textarea?.value?.trim() || '';

        if (!text) {
            this.showToast('Please paste names first', 'warning');
            return;
        }

        // Parse: split by newline, trim whitespace, filter empty
        this.importedNames = text
            .split('\n')
            .map(name => name.trim())
            .filter(name => name.length > 0);

        this.usedNameIndices.clear();

        // Update UI
        this.updateImportedCount();
        this.updateUnassignedList();
        this.updateAllRowNameDropdowns();

        this.showToast(`Imported ${this.importedNames.length} names`, 'success');
        this.isDirty = true;
    }

    /**
     * Clear all imported names
     */
    clearImportedNames() {
        this.importedNames = [];
        this.usedNameIndices.clear();
        const textarea = document.getElementById('pasteNamesInput');
        if (textarea) textarea.value = '';

        this.updateImportedCount();
        this.updateUnassignedList();
        this.updateAllRowNameDropdowns();
        this.isDirty = true;
    }

    /**
     * Update imported count display
     */
    updateImportedCount() {
        const countEl = document.getElementById('importedCount');
        if (countEl) {
            countEl.textContent = this.importedNames.length > 0
                ? `${this.importedNames.length} names imported`
                : '';
        }
    }

    /**
     * Get available (unused) names for dropdown
     */
    getAvailableNames() {
        return this.importedNames
            .map((name, index) => ({ name, index }))
            .filter(item => !this.usedNameIndices.has(item.index));
    }

    /**
     * Update unassigned names list panel
     */
    updateUnassignedList() {
        const panel = document.getElementById('unassignedNamesPanel');
        const listEl = document.getElementById('unassignedNamesList');
        const countEl = document.getElementById('unassignedCount');

        if (!panel || !listEl) return;

        const available = this.getAvailableNames();

        if (this.importedNames.length === 0) {
            panel.style.display = 'none';
            return;
        }

        panel.style.display = 'block';
        countEl.textContent = `(${available.length} remaining)`;

        if (available.length === 0) {
            listEl.innerHTML = '<span class="all-assigned">All names assigned!</span>';
        } else {
            listEl.innerHTML = available.map(item =>
                `<span class="unassigned-name-tag">${this.escapeHTML(item.name)}</span>`
            ).join('');
        }
    }

    /**
     * Create dropdown options for row name selection
     */
    createRowNameOptions() {
        const available = this.getAvailableNames();
        if (available.length === 0) {
            return '<option value="" disabled>No names available</option>';
        }
        return available.map(item =>
            `<option value="${item.index}">${this.escapeHTML(item.name)}</option>`
        ).join('');
    }

    /**
     * Update all row name dropdowns
     */
    updateAllRowNameDropdowns() {
        const tbody = document.getElementById('namesTableBody');
        if (!tbody) return;

        const hasImportedNames = this.importedNames.length > 0;

        tbody.querySelectorAll('tr').forEach(row => {
            const dropdown = row.querySelector('.name-dropdown');

            if (dropdown) {
                // Show/hide dropdown based on whether names are imported
                dropdown.style.display = hasImportedNames ? 'block' : 'none';

                // Rebuild options (excluding used names)
                const currentValue = dropdown.value;
                dropdown.innerHTML = '<option value="">Select name...</option>' + this.createRowNameOptions();

                // Restore selection if still valid
                if (currentValue && !this.usedNameIndices.has(parseInt(currentValue))) {
                    dropdown.value = currentValue;
                }
            }
        });
    }

    /**
     * Handle name dropdown selection
     */
    handleNameDropdownChange(dropdown, row) {
        const selectedIndex = dropdown.value ? parseInt(dropdown.value) : null;
        const input = row.querySelector('.name-input');
        const previousIndex = dropdown.dataset.previousIndex ? parseInt(dropdown.dataset.previousIndex) : null;

        // Release previous selection
        if (previousIndex !== null && !isNaN(previousIndex)) {
            this.usedNameIndices.delete(previousIndex);
        }

        // Mark new selection as used
        if (selectedIndex !== null && !isNaN(selectedIndex)) {
            this.usedNameIndices.add(selectedIndex);
            // Populate the text input with selected name
            if (input) {
                input.value = this.importedNames[selectedIndex];
            }
        }

        // Store current selection for future reference
        dropdown.dataset.previousIndex = selectedIndex !== null ? selectedIndex : '';

        this.updateUnassignedList();
        this.updateAllRowNameDropdowns();
        this.isDirty = true;
    }

    // ============================================
    // Order Lookup
    // ============================================

    async handleOrderLookup() {
        const orderNumber = document.getElementById('orderNumber').value.trim();

        if (!orderNumber) {
            this.showToast('Please enter an order number', 'warning');
            return;
        }

        this.showOrderStatus('loading', 'Looking up order...');
        this.showLoading('Looking up order in ShopWorks...');

        try {
            const result = await this.service.lookupOrder(orderNumber);

            if (result.success) {
                this.orderData = result.order;
                this.products = result.products;

                // Populate form fields
                document.getElementById('companyName').value = result.order.companyName || '';
                document.getElementById('salesRepEmail').value = result.order.salesRepEmail || '';

                // Check if we have actual garments (with sizes)
                if (result.products && result.products.length > 0) {
                    this.orderLoaded = true;  // Switch to order mode
                    this.showOrderStatus('success',
                        `Found: ${result.order.companyName} (${result.products.length} product${result.products.length !== 1 ? 's' : ''})`
                    );
                    this.showToast('Order loaded successfully', 'success');
                    // Auto-hide order status after brief display
                    setTimeout(() => this.hideOrderStatus(), 2000);
                } else {
                    // Order found but no garments - stay in manual mode
                    this.orderLoaded = false;
                    this.showOrderStatus('warning',
                        `Found: ${result.order.companyName} (no garments - manual entry enabled)`
                    );
                    this.showToast('Order found but no garments. Manual entry enabled.', 'warning');
                }

                // Refresh rows to switch between order mode and manual mode
                this.refreshAllRows();
            } else {
                // Order not found - enable manual mode
                this.orderLoaded = false;
                this.products = [];
                this.showOrderStatus('warning', result.error || 'Order not found');
                this.showToast(result.error || 'Order not found. You can enter details manually.', 'warning');
                this.refreshAllRows();  // Ensure manual mode
            }
        } catch (error) {
            console.error('[MonogramController] Lookup error:', error);
            this.orderLoaded = false;
            this.products = [];
            this.showOrderStatus('error', 'Failed to look up order');
            this.showToast('Failed to look up order. Please try again.', 'error');
            this.refreshAllRows();  // Ensure manual mode on error
        } finally {
            this.hideLoading();
        }
    }

    showOrderStatus(type, message) {
        const statusEl = document.getElementById('orderStatus');
        const badgeEl = document.getElementById('orderStatusBadge');
        const textEl = document.getElementById('orderStatusText');

        if (!statusEl || !badgeEl || !textEl) return;

        statusEl.style.display = 'block';
        badgeEl.className = `status-badge status-${type}`;

        // Set icon based on type
        const icons = {
            loading: '<i class="fas fa-spinner fa-spin"></i>',
            success: '<i class="fas fa-check-circle"></i>',
            warning: '<i class="fas fa-exclamation-triangle"></i>',
            error: '<i class="fas fa-times-circle"></i>'
        };

        badgeEl.innerHTML = `${icons[type] || ''} <span>${message}</span>`;
    }

    hideOrderStatus() {
        const statusEl = document.getElementById('orderStatus');
        if (statusEl) {
            statusEl.style.display = 'none';
        }
    }

    // ============================================
    // Names Table Management
    // ============================================

    initializeEmptyRows(count) {
        const tbody = document.getElementById('namesTableBody');
        if (!tbody) return;

        tbody.innerHTML = '';
        for (let i = 0; i < count; i++) {
            this.addRow();
        }
    }

    addRow() {
        const tbody = document.getElementById('namesTableBody');
        if (!tbody) return;

        const rowCount = tbody.children.length + 1;
        if (rowCount > 50) {
            this.showToast('Maximum 50 rows allowed', 'warning');
            return;
        }

        const row = document.createElement('tr');
        row.innerHTML = this.createRowHTML(rowCount);
        tbody.appendChild(row);

        // Bind events for new row
        this.bindRowEvents(row);

        // Update row count and size dropdowns
        this.updateNameCount();
        this.updateAllSizeDropdowns();

        // Show name dropdown if names are imported
        this.updateAllRowNameDropdowns();

        // Auto-fill thread color and location if single selection
        this.autoFillThreadColorIfSingle();
        this.autoFillLocationIfSingle();

        // Focus on style field
        const styleInput = row.querySelector('.style-input');
        if (styleInput) {
            styleInput.focus();
        }

        this.isDirty = true;
    }

    addRows(count) {
        for (let i = 0; i < count; i++) {
            this.addRow();
        }
    }

    createRowHTML(rowNum) {
        // Delegate to appropriate mode based on whether order is loaded
        if (this.orderLoaded && this.products.length > 0) {
            return this.createOrderModeRowHTML(rowNum);
        } else {
            return this.createManualModeRowHTML(rowNum);
        }
    }

    /**
     * Create row HTML for ORDER MODE (style dropdown with API options)
     */
    createOrderModeRowHTML(rowNum) {
        const styleOptions = this.createStyleOptions();
        const sizeOptions = this.createSizeOptions();
        const threadColorOptions = this.createRowThreadColorOptions();
        const locationOptions = this.createRowLocationOptions();

        return `
            <td class="row-number">${rowNum}</td>
            <td>
                <select class="style-input" data-row="${rowNum}">
                    <option value="">Select...</option>
                    ${styleOptions}
                    <option value="__custom__">Other (type below)</option>
                </select>
                <input type="text" class="style-custom" placeholder="Custom style"
                       style="display:none; margin-top:4px;">
            </td>
            <td>
                <input type="text" class="description-input input-readonly" readonly
                       placeholder="Auto-fills from style">
            </td>
            <td>
                <input type="text" class="color-input" data-row="${rowNum}"
                       placeholder="Shirt color">
            </td>
            <td>
                <select class="size-input" data-row="${rowNum}">
                    <option value="">Select...</option>
                    ${sizeOptions}
                </select>
            </td>
            <td class="cell-thread-location">
                <div class="cell-content">
                    <select class="row-thread-color" data-row="${rowNum}">
                        <option value="">Thread...</option>
                        ${threadColorOptions}
                    </select>
                    <select class="row-location" data-row="${rowNum}">
                        <option value="">Location...</option>
                        ${locationOptions}
                    </select>
                </div>
            </td>
            <td class="cell-name">
                <div class="cell-content">
                    <select class="name-dropdown" data-row="${rowNum}" style="display: none;">
                        <option value="">Select name...</option>
                    </select>
                    <input type="text" class="name-input" placeholder="Name to embroider">
                </div>
            </td>
            <td>
                <button type="button" class="btn-delete-row" title="Delete row">
                    <i class="fas fa-times"></i>
                </button>
            </td>
        `;
    }

    /**
     * Create row HTML for MANUAL MODE (all text inputs, no API data)
     */
    createManualModeRowHTML(rowNum) {
        const sizeOptions = this.createSizeOptions();
        const threadColorOptions = this.createRowThreadColorOptions();
        const locationOptions = this.createRowLocationOptions();

        return `
            <td class="row-number">${rowNum}</td>
            <td>
                <input type="text" class="style-input manual-entry" data-row="${rowNum}"
                       placeholder="Style #">
            </td>
            <td>
                <input type="text" class="description-input" placeholder="Description">
            </td>
            <td>
                <input type="text" class="color-input" data-row="${rowNum}"
                       placeholder="Shirt color">
            </td>
            <td>
                <select class="size-input" data-row="${rowNum}">
                    <option value="">Select...</option>
                    ${sizeOptions}
                </select>
            </td>
            <td class="cell-thread-location">
                <div class="cell-content">
                    <select class="row-thread-color" data-row="${rowNum}">
                        <option value="">Thread...</option>
                        ${threadColorOptions}
                    </select>
                    <select class="row-location" data-row="${rowNum}">
                        <option value="">Location...</option>
                        ${locationOptions}
                    </select>
                </div>
            </td>
            <td class="cell-name">
                <div class="cell-content">
                    <select class="name-dropdown" data-row="${rowNum}" style="display: none;">
                        <option value="">Select name...</option>
                    </select>
                    <input type="text" class="name-input" placeholder="Name to embroider">
                </div>
            </td>
            <td>
                <button type="button" class="btn-delete-row" title="Delete row">
                    <i class="fas fa-times"></i>
                </button>
            </td>
        `;
    }

    createStyleOptions() {
        if (!this.products || this.products.length === 0) {
            return '';
        }

        return this.products.map(product => {
            const label = `${product.partNumber} - ${product.color}`;
            return `<option value="${product.partNumber}|${product.color}"
                            data-description="${this.escapeHTML(product.description)}"
                            data-color="${this.escapeHTML(product.color)}"
                            data-sizes='${JSON.stringify(product.sizes)}'>${label}</option>`;
        }).join('');
    }

    createSizeOptions() {
        const sizes = this.service.getExtendedSizes();
        return sizes.map(size => `<option value="${size}">${size}</option>`).join('');
    }

    bindRowEvents(row) {
        // Style dropdown change
        const styleSelect = row.querySelector('.style-input');
        if (styleSelect) {
            styleSelect.addEventListener('change', (e) => this.handleStyleChange(row, e.target));
        }

        // Custom style toggle
        const customStyleInput = row.querySelector('.style-custom');
        if (customStyleInput) {
            customStyleInput.addEventListener('input', () => {
                this.isDirty = true;
            });
        }

        // Delete button
        const deleteBtn = row.querySelector('.btn-delete-row');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', () => this.deleteRow(row));
        }

        // Name input focus - auto-scroll into view
        const nameInput = row.querySelector('.name-input');
        if (nameInput) {
            nameInput.addEventListener('focus', () => {
                row.scrollIntoView({ behavior: 'smooth', block: 'center' });
            });
        }

        // Size change - update all dropdowns to refresh counts
        const sizeSelect = row.querySelector('.size-input');
        if (sizeSelect) {
            sizeSelect.addEventListener('change', () => {
                this.updateAllSizeDropdowns();
            });
        }

        // Name dropdown change - for bulk imported names
        const nameDropdown = row.querySelector('.name-dropdown');
        if (nameDropdown) {
            nameDropdown.addEventListener('change', () => {
                this.handleNameDropdownChange(nameDropdown, row);
            });
        }
    }

    handleStyleChange(row, selectEl) {
        const value = selectEl.value;
        const descInput = row.querySelector('.description-input');
        const colorSelect = row.querySelector('.color-input');
        const customInput = row.querySelector('.style-custom');
        const sizeSelect = row.querySelector('.size-input');

        // Handle "Other" option
        if (value === '__custom__') {
            customInput.style.display = 'block';
            customInput.focus();
            descInput.value = '';
            descInput.readOnly = false;
            descInput.classList.remove('input-readonly');
            colorSelect.value = '';  // Clear color for custom entry
            return;
        }

        // Hide custom input
        customInput.style.display = 'none';
        descInput.readOnly = true;
        descInput.classList.add('input-readonly');

        if (!value) {
            descInput.value = '';
            colorSelect.value = '';  // Clear color input
            return;
        }

        // Get selected option data
        const selectedOption = selectEl.selectedOptions[0];
        const description = selectedOption.dataset.description || '';
        const color = selectedOption.dataset.color || '';
        const sizes = JSON.parse(selectedOption.dataset.sizes || '[]');

        // Update description
        descInput.value = description;

        // Update color input (now a text field, auto-fill but editable)
        colorSelect.value = color || '';

        // Update size dropdown with quantities from order
        if (sizes.length > 0) {
            let sizeOptions = '<option value="">Select...</option>';

            // Standard sizes from Size01-Size05 slots (not from PartNumber suffix)
            const STANDARD_SIZES = ['S', 'M', 'L', 'XL', '2XL'];

            // Check if this is a single suffix-derived size (OSFA, 3X, 2XLT, LT, etc.)
            // These come from Size06 catch-all with PartNumber suffix detection
            const isSingleSuffixSize = sizes.length === 1 && !STANDARD_SIZES.includes(sizes[0].label);

            if (isSingleSuffixSize) {
                // Single suffix-derived size (OSFA, 3X, 2XLT, etc.):
                // Just show the size - no quantity, no "Other Sizes"
                sizeOptions += `<option value="${sizes[0].label}">${sizes[0].label}</option>`;
            } else {
                // Show only sizes from the order (no quantities, no "Other Sizes")
                sizes.forEach(s => {
                    sizeOptions += `<option value="${s.label}">${s.label}</option>`;
                });
            }

            sizeSelect.innerHTML = sizeOptions;
        }

        this.isDirty = true;

        // Update all size dropdowns to show current counts
        this.updateAllSizeDropdowns();
    }

    deleteRow(row) {
        const tbody = document.getElementById('namesTableBody');
        if (tbody.children.length <= 1) {
            this.showToast('Must have at least one row', 'warning');
            return;
        }

        row.remove();
        this.renumberRows();
        this.updateNameCount();
        this.updateAllSizeDropdowns();
        this.isDirty = true;
    }

    renumberRows() {
        const tbody = document.getElementById('namesTableBody');
        const rows = tbody.querySelectorAll('tr');

        rows.forEach((row, index) => {
            const numCell = row.querySelector('.row-number');
            if (numCell) {
                numCell.textContent = index + 1;
            }
        });
    }

    /**
     * Sort table rows by Style → Color → Size (smallest to largest)
     */
    sortTable() {
        const tbody = document.getElementById('namesTableBody');
        const rows = Array.from(tbody.querySelectorAll('tr'));

        // Collect row data with element references
        const rowData = rows.map(row => ({
            element: row,
            style: row.querySelector('.style-input')?.value || '',
            color: row.querySelector('.color-input')?.value || '',
            size: row.querySelector('.size-input')?.value || ''
        }));

        // Sort by Style → Color → Size
        rowData.sort((a, b) => {
            // Primary: Style (alphabetical)
            if (a.style !== b.style) return a.style.localeCompare(b.style);
            // Secondary: Color (alphabetical)
            if (a.color !== b.color) return a.color.localeCompare(b.color);
            // Tertiary: Size (by SIZE_ORDER)
            const aIndex = SIZE_ORDER.indexOf(a.size);
            const bIndex = SIZE_ORDER.indexOf(b.size);
            return (aIndex === -1 ? 999 : aIndex) - (bIndex === -1 ? 999 : bIndex);
        });

        // Reorder DOM elements
        rowData.forEach(item => tbody.appendChild(item.element));

        // Renumber rows
        this.renumberRows();
    }

    /**
     * Count how many of each size are currently used for a specific style/color
     */
    getSizeUsageCounts(styleValue, color) {
        const counts = {};
        const tbody = document.getElementById('namesTableBody');

        tbody.querySelectorAll('tr').forEach(row => {
            const rowStyle = row.querySelector('.style-input')?.value || '';
            const rowColor = row.querySelector('.color-input')?.value || '';
            const rowSize = row.querySelector('.size-input')?.value || '';

            // Match style and color
            if (rowStyle === styleValue && rowColor === color && rowSize) {
                counts[rowSize] = (counts[rowSize] || 0) + 1;
            }
        });

        return counts;  // e.g., { 'M': 1, 'L': 2 }
    }

    /**
     * Refresh all size dropdowns to show current counts
     */
    updateAllSizeDropdowns() {
        const tbody = document.getElementById('namesTableBody');
        tbody.querySelectorAll('tr').forEach(row => {
            this.updateSizeDropdownCounts(row);
        });
    }

    /**
     * Update a single row's size dropdown with usage counts
     */
    updateSizeDropdownCounts(row) {
        const styleSelect = row.querySelector('.style-input');
        const sizeSelect = row.querySelector('.size-input');
        if (!styleSelect || !sizeSelect) return;

        const styleValue = styleSelect.value;
        if (!styleValue) return;  // No style selected yet

        const color = row.querySelector('.color-input')?.value || '';
        const currentSize = sizeSelect.value;

        // Get available sizes from the style option's data
        const selectedOption = styleSelect.selectedOptions[0];
        if (!selectedOption || !selectedOption.dataset.sizes) return;

        const availableSizes = JSON.parse(selectedOption.dataset.sizes || '[]');
        if (availableSizes.length === 0) return;

        const usageCounts = this.getSizeUsageCounts(styleValue, color);

        // Rebuild options with counts
        let sizeOptions = '<option value="">Select...</option>';
        availableSizes.forEach(s => {
            const used = usageCounts[s.label] || 0;
            const available = s.qty;
            const isCurrent = s.label === currentSize;

            // Don't count current row's selection against itself
            const displayUsed = isCurrent ? Math.max(0, used - 1) : used;
            const isMaxed = displayUsed >= available;

            const label = `${s.label} (${displayUsed}/${available})${isMaxed && !isCurrent ? ' - FULL' : ''}`;
            const disabled = isMaxed && !isCurrent ? 'disabled' : '';

            sizeOptions += `<option value="${s.label}" ${disabled}>${label}</option>`;
        });

        sizeSelect.innerHTML = sizeOptions;
        sizeSelect.value = currentSize;  // Restore selection
    }

    updateNameCount() {
        const tbody = document.getElementById('namesTableBody');
        const countEl = document.getElementById('nameCount');

        if (!tbody || !countEl) return;

        const totalRows = tbody.querySelectorAll('tr').length;
        let actualCount = 0;

        tbody.querySelectorAll('.name-input').forEach(input => {
            if (input.value.trim()) actualCount++;
        });

        countEl.textContent = `(${actualCount} entries, ${totalRows}/50 rows)`;
    }

    updateStyleDropdowns() {
        const tbody = document.getElementById('namesTableBody');
        if (!tbody) return;

        const styleOptions = this.createStyleOptions();

        tbody.querySelectorAll('.style-input').forEach(select => {
            const currentValue = select.value;
            select.innerHTML = `
                <option value="">Select...</option>
                ${styleOptions}
                <option value="__custom__">Other (type below)</option>
            `;
            // Restore value if it still exists
            if (currentValue) {
                select.value = currentValue;
            }
        });
    }

    // ============================================
    // Row Mode Switching
    // ============================================

    /**
     * Collect current row data before refreshing rows
     * Used to preserve data when switching between order mode and manual mode
     */
    collectRowData() {
        const tbody = document.getElementById('namesTableBody');
        if (!tbody) return [];

        const rowData = [];
        tbody.querySelectorAll('tr').forEach(row => {
            const styleInput = row.querySelector('.style-input');
            const styleCustom = row.querySelector('.style-custom');
            const descInput = row.querySelector('.description-input');
            const colorInput = row.querySelector('.color-input');
            const sizeInput = row.querySelector('.size-input');
            const rowThreadColorSelect = row.querySelector('.row-thread-color');
            const nameInput = row.querySelector('.name-input');

            rowData.push({
                // Handle both select and text input for style
                style: styleInput?.tagName === 'SELECT'
                    ? (styleInput.value === '__custom__' ? styleCustom?.value : styleInput.value)
                    : styleInput?.value || '',
                description: descInput?.value || '',
                color: colorInput?.value || '',
                size: sizeInput?.value || '',
                rowThreadColor: rowThreadColorSelect?.value || '',
                name: nameInput?.value || ''
            });
        });

        return rowData;
    }

    /**
     * Populate a row with data (after row HTML has been created)
     */
    populateRow(rowIndex, data) {
        const tbody = document.getElementById('namesTableBody');
        if (!tbody || rowIndex >= tbody.children.length) return;

        const row = tbody.children[rowIndex];
        const styleInput = row.querySelector('.style-input');
        const descInput = row.querySelector('.description-input');
        const colorInput = row.querySelector('.color-input');
        const sizeInput = row.querySelector('.size-input');
        const rowThreadColorSelect = row.querySelector('.row-thread-color');
        const nameInput = row.querySelector('.name-input');

        // Set values
        if (styleInput) {
            // In manual mode, style is a text input
            if (styleInput.tagName === 'INPUT') {
                styleInput.value = data.style || '';
            } else {
                // In order mode, try to find matching option
                const matchingOption = Array.from(styleInput.options).find(
                    opt => opt.value === data.style
                );
                if (matchingOption) {
                    styleInput.value = data.style;
                } else if (data.style) {
                    // Style doesn't match dropdown - switch to custom
                    styleInput.value = '__custom__';
                    const customInput = row.querySelector('.style-custom');
                    if (customInput) {
                        customInput.style.display = 'block';
                        customInput.value = data.style;
                    }
                }
            }
        }
        if (descInput) descInput.value = data.description || '';
        if (colorInput) colorInput.value = data.color || '';
        if (sizeInput) sizeInput.value = data.size || '';
        if (rowThreadColorSelect) rowThreadColorSelect.value = data.rowThreadColor || '';
        if (nameInput) nameInput.value = data.name || '';
    }

    /**
     * Refresh all rows with new HTML structure (preserving data)
     * Called when switching between order mode and manual mode
     */
    refreshAllRows() {
        const tbody = document.getElementById('namesTableBody');
        if (!tbody) return;

        // Save current data
        const existingData = this.collectRowData();

        // Clear table
        tbody.innerHTML = '';

        // Determine row count (at least 5, or match existing data)
        const rowCount = Math.max(5, existingData.length);

        // Rebuild rows with new HTML structure
        for (let i = 0; i < rowCount; i++) {
            this.addRow();
            if (i < existingData.length) {
                this.populateRow(i, existingData[i]);
            }
        }

    }

    // ============================================
    // Form Data Collection
    // ============================================

    collectFormData() {
        const data = {
            orderNumber: document.getElementById('orderNumber').value.trim(),
            companyName: document.getElementById('companyName').value.trim(),
            salesRepEmail: document.getElementById('salesRepEmail').value.trim(),
            fontStyle: document.getElementById('fontStyle').value.trim(),
            threadColor: this.getThreadColorString(),  // Use multi-select values
            location: this.getLocationString(),  // Use multi-select values
            importedNames: this.importedNames.join('\n'),  // Bulk imported names
            notesToProduction: document.getElementById('notesToProduction').value.trim()
        };

        // Collect items
        const items = [];
        const tbody = document.getElementById('namesTableBody');

        tbody.querySelectorAll('tr').forEach((row, index) => {
            const styleSelect = row.querySelector('.style-input');
            const customStyle = row.querySelector('.style-custom');
            const descInput = row.querySelector('.description-input');
            const colorSelect = row.querySelector('.color-input');
            const sizeSelect = row.querySelector('.size-input');
            const rowThreadColorSelect = row.querySelector('.row-thread-color');
            const rowLocationSelect = row.querySelector('.row-location');
            const nameInput = row.querySelector('.name-input');

            const item = {
                lineNumber: index + 1,
                styleNumber: styleSelect.value === '__custom__'
                    ? customStyle.value.trim()
                    : (styleSelect.value.split('|')[0] || ''),
                description: descInput.value.trim(),
                shirtColor: colorSelect.value.trim(),
                size: sizeSelect.value.trim(),
                rowThreadColor: rowThreadColorSelect?.value?.trim() || '',
                rowLocation: rowLocationSelect?.value?.trim() || '',
                monogramName: nameInput.value.trim(),
                isCustomStyle: styleSelect.value === '__custom__'
            };

            items.push(item);
        });

        return { ...data, items };
    }

    // ============================================
    // Save & Load
    // ============================================

    async saveDraft() {
        const formData = this.collectFormData();

        if (!formData.orderNumber) {
            this.showToast('Please enter an order number', 'warning');
            document.getElementById('orderNumber').focus();
            return;
        }

        if (!formData.companyName) {
            this.showToast('Please enter a company name', 'warning');
            document.getElementById('companyName').focus();
            return;
        }

        this.showLoading('Saving...');

        try {
            const result = await this.service.saveMonogramSession(formData, formData.items);

            if (result.success) {
                this.currentMonogramID = result.monogramID;
                this.currentOrderNumber = result.orderNumber || formData.orderNumber;
                this.isDirty = false;
                this.showToast(`Saved! Order #${this.currentOrderNumber}`, 'success');

                // Update URL with order number for easy sharing/bookmarking
                const url = new URL(window.location);
                url.searchParams.delete('order');
                url.searchParams.set('load', this.currentOrderNumber);
                window.history.replaceState({}, '', url);
            } else {
                this.showToast(result.error || 'Failed to save', 'error');
            }
        } catch (error) {
            console.error('[MonogramController] Save error:', error);
            this.showToast('Failed to save. Please try again.', 'error');
        } finally {
            this.hideLoading();
        }
    }

    async loadExistingForm(orderNumber) {
        this.showLoading('Loading form...');

        try {
            const result = await this.service.loadMonogramSession(orderNumber);

            if (result.success) {
                this.populateForm(result.session, result.items);
                this.currentOrderNumber = orderNumber;
                this.currentMonogramID = result.session.id_monogram;
                this.isDirty = false;

                // CLAUDE.md Rule #4: Show warning if loaded from cache
                if (result.warning) {
                    console.warn('[MonogramController] Cache warning:', result.warning);
                    this.showCacheWarningBanner(result.warning);
                    this.showToast('Loaded from cache - see warning', 'warning');
                } else {
                    this.showToast('Form loaded', 'success');
                }
            } else {
                this.showToast(result.error || 'Form not found', 'error');
            }
        } catch (error) {
            console.error('[MonogramController] Load error:', error);
            this.showToast('Failed to load form', 'error');
        } finally {
            this.hideLoading();
        }
    }

    /**
     * Show a warning banner when data is loaded from cache
     * CLAUDE.md Rule #4: Never silently fall back to cached data
     */
    showCacheWarningBanner(message) {
        // Remove existing warning banner if present
        const existingBanner = document.getElementById('cacheWarningBanner');
        if (existingBanner) existingBanner.remove();

        // Create warning banner
        const banner = document.createElement('div');
        banner.id = 'cacheWarningBanner';
        banner.style.cssText = `
            background: #fef3c7;
            border: 1px solid #f59e0b;
            border-radius: 6px;
            padding: 12px 16px;
            margin: 16px 0;
            display: flex;
            align-items: center;
            gap: 12px;
            color: #92400e;
        `;
        banner.innerHTML = `
            <i class="fas fa-exclamation-triangle" style="font-size: 1.25rem;"></i>
            <div>
                <strong>Warning:</strong> ${this.escapeHTML(message)}
                <button onclick="this.parentElement.parentElement.remove()"
                        style="margin-left: 12px; background: none; border: none; color: #92400e; cursor: pointer; font-weight: bold;">
                    Dismiss
                </button>
            </div>
        `;

        // Insert after page header
        const pageHeader = document.querySelector('.page-header');
        if (pageHeader && pageHeader.nextSibling) {
            pageHeader.parentNode.insertBefore(banner, pageHeader.nextSibling);
        }
    }

    populateForm(session, items) {
        // Populate header fields (using camelCase from service)
        document.getElementById('orderNumber').value = session.orderNumber || '';
        document.getElementById('companyName').value = session.companyName || '';
        document.getElementById('salesRepEmail').value = session.salesRepEmail || '';
        document.getElementById('fontStyle').value = session.fontStyle || '';
        this.setThreadColorsFromString(session.threadColor || '');  // Use multi-select setter
        this.setLocationsFromString(session.location || '');  // Use multi-select setter
        document.getElementById('notesToProduction').value = session.notesToProduction || '';

        // Restore imported names if present
        if (session.importedNames) {
            const textarea = document.getElementById('pasteNamesInput');
            if (textarea) textarea.value = session.importedNames;
            this.importNames();
        }

        // Clear existing rows and add new ones
        const tbody = document.getElementById('namesTableBody');
        tbody.innerHTML = '';

        if (items && items.length > 0) {
            items.forEach(item => {
                this.addRow();
                const row = tbody.lastElementChild;

                // Populate row fields
                const customStyle = row.querySelector('.style-custom');
                const descInput = row.querySelector('.description-input');
                const colorSelect = row.querySelector('.color-input');
                const sizeSelect = row.querySelector('.size-input');
                const rowThreadColorSelect = row.querySelector('.row-thread-color');
                const rowLocationSelect = row.querySelector('.row-location');
                const nameInput = row.querySelector('.name-input');

                if (item.isCustomStyle) {
                    row.querySelector('.style-input').value = '__custom__';
                    customStyle.style.display = 'block';
                    customStyle.value = item.styleNumber || '';
                    descInput.readOnly = false;
                    descInput.classList.remove('input-readonly');
                }

                descInput.value = item.description || '';
                colorSelect.value = item.shirtColor || '';
                sizeSelect.value = item.size || '';
                if (rowThreadColorSelect) rowThreadColorSelect.value = item.rowThreadColor || '';
                if (rowLocationSelect) rowLocationSelect.value = item.rowLocation || '';
                nameInput.value = item.monogramName || '';
            });
        } else {
            // Add empty rows
            this.initializeEmptyRows(5);
        }

        this.updateNameCount();
    }

    // ============================================
    // Search
    // ============================================

    toggleSearchPanel(show) {
        const panel = document.getElementById('searchPanel');
        if (!panel) return;

        if (typeof show === 'boolean') {
            panel.style.display = show ? 'block' : 'none';
        } else {
            panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
        }
    }

    async handleSearch() {
        const orderNumber = document.getElementById('searchOrderNumber').value.trim();
        const companyName = document.getElementById('searchCompanyName').value.trim();

        if (!orderNumber && !companyName) {
            this.showToast('Please enter search criteria', 'warning');
            return;
        }

        this.showLoading('Searching...');

        try {
            const result = await this.service.searchMonogramSessions({ orderNumber, companyName });

            const resultsEl = document.getElementById('searchResults');
            if (!resultsEl) return;

            if (result.sessions.length === 0) {
                resultsEl.innerHTML = '<p class="no-results">No forms found</p>';
            } else {
                resultsEl.innerHTML = result.sessions.map(session => `
                    <div class="search-result-item">
                        <div class="search-result-info">
                            <span><strong>${session.monogramID || session.MonogramID}</strong></span>
                            <span>${session.companyName || session.CompanyName}</span>
                            <span>Order: ${session.orderNumber || session.OrderNumber}</span>
                            <span>${session.totalNames || session.TotalNames} names</span>
                        </div>
                        <div class="search-result-actions">
                            <button type="button" class="btn-secondary btn-sm"
                                    onclick="monogramController.loadExistingForm('${session.OrderNumber || session.orderNumber}')">
                                <i class="fas fa-edit"></i> Edit
                            </button>
                        </div>
                    </div>
                `).join('');
            }
        } catch (error) {
            console.error('[MonogramController] Search error:', error);
            this.showToast('Search failed', 'error');
        } finally {
            this.hideLoading();
        }
    }

    // ============================================
    // Clear & New
    // ============================================

    clearForm() {
        if (this.isDirty) {
            if (!confirm('You have unsaved changes. Clear form anyway?')) {
                return;
            }
        }

        document.getElementById('monogramForm').reset();

        // Reset thread colors and locations
        this.setThreadColorsFromString('');
        this.setLocationsFromString('');

        // Reset to manual mode
        this.orderData = null;
        this.products = [];
        this.orderLoaded = false;  // Switch back to manual mode
        this.currentMonogramID = null;
        this.isDirty = false;

        // Rebuild rows in manual mode
        this.initializeEmptyRows(5);

        document.getElementById('orderStatus').style.display = 'none';

        // Clear URL params
        window.history.replaceState({}, '', window.location.pathname);

        this.showToast('Form cleared (manual entry mode)', 'info');
    }

    newForm() {
        if (this.isDirty) {
            if (!confirm('You have unsaved changes. Start new form anyway?')) {
                return;
            }
        }

        this.clearForm();
        document.getElementById('orderNumber').focus();
    }

    // ============================================
    // Print PDF
    // ============================================

    printPDF() {
        const formData = this.collectFormData();

        // Sort items by Style → Color → Size for PDF output
        formData.items.sort((a, b) => {
            // Primary: Style (alphabetical)
            if (a.styleNumber !== b.styleNumber) return a.styleNumber.localeCompare(b.styleNumber);
            // Secondary: Color (alphabetical)
            if (a.shirtColor !== b.shirtColor) return a.shirtColor.localeCompare(b.shirtColor);
            // Tertiary: Size (by SIZE_ORDER)
            const aIndex = SIZE_ORDER.indexOf(a.size);
            const bIndex = SIZE_ORDER.indexOf(b.size);
            return (aIndex === -1 ? 999 : aIndex) - (bIndex === -1 ? 999 : bIndex);
        });

        // Validate
        const filledItems = formData.items.filter(item => item.monogramName);
        if (filledItems.length === 0) {
            this.showToast('Please add at least one name to print', 'warning');
            return;
        }

        // Populate print template
        document.getElementById('printDate').textContent = this.service.getCurrentDate();
        document.getElementById('printOrderNumber').textContent = formData.orderNumber || '-';
        document.getElementById('printCompanyName').textContent = formData.companyName || '-';
        document.getElementById('printSalesRepEmail').textContent = formData.salesRepEmail || '-';
        document.getElementById('printFontStyle').textContent = formData.fontStyle || '-';
        document.getElementById('printThreadColor').textContent = formData.threadColor || '-';
        document.getElementById('printLocation').textContent = formData.location || '-';
        document.getElementById('printNotes').textContent = formData.notesToProduction || '-';

        // Populate names table
        const printTbody = document.getElementById('printNamesTableBody');
        printTbody.innerHTML = filledItems.map((item, index) => {
            // Combine thread color and location for stacked display
            const threadLocationParts = [];
            if (item.rowThreadColor) threadLocationParts.push(item.rowThreadColor);
            if (item.rowLocation) threadLocationParts.push(item.rowLocation);
            const threadLocationDisplay = threadLocationParts.join(' / ') || '-';

            return `
                <tr>
                    <td>${index + 1}</td>
                    <td>${this.escapeHTML(item.styleNumber)}</td>
                    <td>${this.escapeHTML(item.description)}</td>
                    <td>${this.escapeHTML(item.shirtColor)}</td>
                    <td>${this.escapeHTML(item.size)}</td>
                    <td>${this.escapeHTML(threadLocationDisplay)}</td>
                    <td><strong>${this.escapeHTML(item.monogramName)}</strong></td>
                </tr>
            `;
        }).join('');

        // Trigger print
        window.print();
    }

    // ============================================
    // UI Helpers
    // ============================================

    showLoading(message = 'Loading...') {
        const overlay = document.getElementById('loadingOverlay');
        const text = document.getElementById('loadingText');

        if (overlay && text) {
            text.textContent = message;
            overlay.style.display = 'flex';
        }
    }

    hideLoading() {
        const overlay = document.getElementById('loadingOverlay');
        if (overlay) {
            overlay.style.display = 'none';
        }
    }

    showToast(message, type = 'info') {
        const container = document.getElementById('toastContainer');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;

        const icons = {
            success: 'fa-check-circle',
            error: 'fa-times-circle',
            warning: 'fa-exclamation-triangle',
            info: 'fa-info-circle'
        };

        toast.innerHTML = `
            <span class="toast-icon"><i class="fas ${icons[type] || icons.info}"></i></span>
            <span class="toast-message">${message}</span>
            <button type="button" class="toast-close">&times;</button>
        `;

        container.appendChild(toast);

        // Show animation
        setTimeout(() => toast.classList.add('show'), 10);

        // Close button
        toast.querySelector('.toast-close').addEventListener('click', () => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        });

        // Auto-remove after 5 seconds
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 5000);
    }

    escapeHTML(str) {
        if (!str) return '';
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }
}

// Initialize controller globally
const monogramController = new MonogramFormController();

// Make available globally
if (typeof window !== 'undefined') {
    window.monogramController = monogramController;
}
