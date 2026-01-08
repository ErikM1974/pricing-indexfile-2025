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
        console.log('[MonogramController] Initializing...');

        // Set current date
        this.setCurrentDate();

        // Initialize empty rows
        this.initializeEmptyRows(5);

        // Bind event listeners
        this.bindEventListeners();

        // Check for URL parameters
        this.checkURLParameters();

        console.log('[MonogramController] Initialization complete');
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
        const monogramID = params.get('id');

        if (monogramID) {
            this.loadExistingForm(monogramID);
        } else if (orderNumber) {
            document.getElementById('orderNumber').value = orderNumber;
            this.handleOrderLookup();
        }
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
            <td>
                <input type="text" class="note-input" placeholder="Note">
            </td>
            <td>
                <input type="text" class="name-input" placeholder="Name to embroider" required>
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
            <td>
                <input type="text" class="note-input" placeholder="Note">
            </td>
            <td>
                <input type="text" class="name-input" placeholder="Name to embroider" required>
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

            console.log('[MonogramController] Size dropdown update:', {
                sizes: sizes,
                isSingleSuffixSize: isSingleSuffixSize,
                sizeLabel: sizes[0]?.label
            });

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

        const filledRows = tbody.querySelectorAll('tr').length;
        const withNames = tbody.querySelectorAll('.name-input').length;
        let actualCount = 0;

        tbody.querySelectorAll('.name-input').forEach(input => {
            if (input.value.trim()) actualCount++;
        });

        countEl.textContent = `(${actualCount} entries)`;
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
            const noteInput = row.querySelector('.note-input');
            const nameInput = row.querySelector('.name-input');

            rowData.push({
                // Handle both select and text input for style
                style: styleInput?.tagName === 'SELECT'
                    ? (styleInput.value === '__custom__' ? styleCustom?.value : styleInput.value)
                    : styleInput?.value || '',
                description: descInput?.value || '',
                color: colorInput?.value || '',
                size: sizeInput?.value || '',
                note: noteInput?.value || '',
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
        const noteInput = row.querySelector('.note-input');
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
        if (noteInput) noteInput.value = data.note || '';
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

        console.log(`[MonogramController] Rows refreshed. Mode: ${this.orderLoaded ? 'Order' : 'Manual'}`);
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
            threadColor: document.getElementById('threadColor').value.trim(),
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
            const noteInput = row.querySelector('.note-input');
            const nameInput = row.querySelector('.name-input');

            const item = {
                lineNumber: index + 1,
                styleNumber: styleSelect.value === '__custom__'
                    ? customStyle.value.trim()
                    : (styleSelect.value.split('|')[0] || ''),
                description: descInput.value.trim(),
                shirtColor: colorSelect.value.trim(),
                size: sizeSelect.value.trim(),
                note: noteInput.value.trim(),
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
                this.isDirty = false;
                this.showToast(`Saved as ${result.monogramID}`, 'success');

                // Update URL without reload
                const url = new URL(window.location);
                url.searchParams.set('id', result.monogramID);
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

    async loadExistingForm(monogramID) {
        this.showLoading('Loading form...');

        try {
            const result = await this.service.loadMonogramSession(monogramID);

            if (result.success) {
                this.populateForm(result.session, result.items);
                this.currentMonogramID = monogramID;
                this.isDirty = false;
                this.showToast('Form loaded', 'success');
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

    populateForm(session, items) {
        // Populate header fields
        document.getElementById('orderNumber').value = session.OrderNumber || '';
        document.getElementById('companyName').value = session.CompanyName || '';
        document.getElementById('salesRepEmail').value = session.SalesRepEmail || '';
        document.getElementById('fontStyle').value = session.FontStyle || '';
        document.getElementById('threadColor').value = session.ThreadColor || '';
        document.getElementById('notesToProduction').value = session.NotesToProduction || '';

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
                const noteInput = row.querySelector('.note-input');
                const nameInput = row.querySelector('.name-input');

                if (item.IsCustomStyle) {
                    row.querySelector('.style-input').value = '__custom__';
                    customStyle.style.display = 'block';
                    customStyle.value = item.StyleNumber || '';
                    descInput.readOnly = false;
                    descInput.classList.remove('input-readonly');
                }

                descInput.value = item.Description || '';
                colorSelect.innerHTML = `<option value="${item.ShirtColor || ''}">${item.ShirtColor || 'Select...'}</option>`;
                sizeSelect.value = item.Size || '';
                noteInput.value = item.Note || '';
                nameInput.value = item.MonogramName || '';
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
                                    onclick="monogramController.loadExistingForm('${session.monogramID || session.MonogramID}')">
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
        document.getElementById('printNotes').textContent = formData.notesToProduction || '-';

        // Populate names table
        const printTbody = document.getElementById('printNamesTableBody');
        printTbody.innerHTML = filledItems.map((item, index) => `
            <tr>
                <td>${index + 1}</td>
                <td>${this.escapeHTML(item.styleNumber)}</td>
                <td>${this.escapeHTML(item.description)}</td>
                <td>${this.escapeHTML(item.shirtColor)}</td>
                <td>${this.escapeHTML(item.size)}</td>
                <td>${this.escapeHTML(item.note)}</td>
                <td><strong>${this.escapeHTML(item.monogramName)}</strong></td>
            </tr>
        `).join('');

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
