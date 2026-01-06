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

        // Hide loading overlay
        const loadingOverlay = document.getElementById('loading-overlay');
        if (loadingOverlay) {
            loadingOverlay.style.display = 'none';
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

    // ==================== LOCATION MANAGEMENT ====================

    setupLocationListeners() {
        const checkboxes = document.querySelectorAll('input[name="location"]');
        checkboxes.forEach(checkbox => {
            checkbox.addEventListener('change', (e) => this.handleLocationChange(e));
        });
    }

    handleLocationChange(event) {
        const checkbox = event.target;
        const locationCode = checkbox.value;
        const zone = checkbox.dataset.zone;
        const isChecked = checkbox.checked;

        console.log(`[Location] ${locationCode} ${isChecked ? 'checked' : 'unchecked'} (zone: ${zone})`);

        if (isChecked) {
            // For front and back zones, uncheck others in same zone
            if (zone === 'front' || zone === 'back') {
                const sameZoneLocations = this.conflictZones[zone];
                sameZoneLocations.forEach(loc => {
                    if (loc !== locationCode) {
                        const otherCheckbox = document.querySelector(`input[value="${loc}"]`);
                        if (otherCheckbox && otherCheckbox.checked) {
                            otherCheckbox.checked = false;
                            // Remove from selected locations
                            const index = this.selectedLocations.indexOf(loc);
                            if (index > -1) {
                                this.selectedLocations.splice(index, 1);
                            }
                        }
                    }
                });
            }

            // Add to selected locations
            if (!this.selectedLocations.includes(locationCode)) {
                this.selectedLocations.push(locationCode);
            }
        } else {
            // Remove from selected locations
            const index = this.selectedLocations.indexOf(locationCode);
            if (index > -1) {
                this.selectedLocations.splice(index, 1);
            }
        }

        // Update UI
        this.updateLocationSummary();
        this.updateSearchState();
        this.updatePricing();
    }

    updateLocationSummary() {
        const summaryContainer = document.getElementById('selected-locations-summary');
        const badgesContainer = document.getElementById('selected-badges');
        const sidebarList = document.getElementById('sidebar-locations-list');

        if (this.selectedLocations.length === 0) {
            if (summaryContainer) summaryContainer.style.display = 'none';
            if (sidebarList) {
                sidebarList.innerHTML = '<div class="no-locations">No locations selected</div>';
            }
            return;
        }

        // Build badges for top summary
        const badges = this.selectedLocations.map(loc => {
            const config = this.locationConfig[loc];
            return `<span class="selected-badge size-${config.size.toLowerCase()}">${config.label}</span>`;
        }).join('');

        if (badgesContainer) badgesContainer.innerHTML = badges;
        if (summaryContainer) summaryContainer.style.display = 'flex';

        // Build sidebar list
        if (sidebarList) {
            const listItems = this.selectedLocations.map(loc => {
                const config = this.locationConfig[loc];
                return `
                    <div class="location-item">
                        <span class="location-name">${config.label}</span>
                        <span class="location-size size-${config.size.toLowerCase()}">${config.size}</span>
                    </div>
                `;
            }).join('');
            sidebarList.innerHTML = listItems;
        }
    }

    updateSearchState() {
        const searchInput = document.getElementById('product-search');
        const searchHint = document.getElementById('search-hint');

        if (this.selectedLocations.length > 0) {
            if (searchInput) searchInput.disabled = false;
            if (searchHint) searchHint.textContent = 'Type to search (e.g., PC54, G500)';
        } else {
            if (searchInput) searchInput.disabled = true;
            if (searchHint) searchHint.textContent = 'Select at least one location to add products';
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

    async selectProduct(styleNumber) {
        console.log('[DTFQuoteBuilder] Product selected:', styleNumber);

        try {
            // Get pricing bundle (includes product info)
            const bundleResponse = await fetch(`https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/pricing-bundle?method=DTF&styleNumber=${styleNumber}`);
            const bundleData = await bundleResponse.json();

            // Get color swatches
            const swatchResponse = await fetch(`https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/color-swatches?styleNumber=${styleNumber}`);
            const swatches = await swatchResponse.json();

            // Extract product info from bundle - try multiple field patterns
            const productName = bundleData.product?.PRODUCT_TITLE ||
                               bundleData.product?.title ||
                               bundleData.product?.description ||
                               bundleData.product?.STYLE_NAME ||
                               bundleData.styleName ||
                               bundleData.productTitle ||
                               styleNumber;

            console.log('[DTFQuoteBuilder] Product bundle data:', {
                styleNumber,
                productName,
                bundleProduct: bundleData.product,
                fields: bundleData.product ? Object.keys(bundleData.product) : []
            });
            const baseCost = bundleData.garmentCost || bundleData.product?.CASE_PRICE || 0;

            // Add product row to table
            this.addProductRow({
                id: ++this.productIndex,
                styleNumber: styleNumber,
                description: productName,
                colors: swatches || [],
                baseCost: baseCost,
                sizeUpcharges: bundleData.sizeUpcharges || {}
            });

        } catch (error) {
            console.error('[DTFQuoteBuilder] Error loading product:', error);
            alert('Error loading product. Please try again.');
        }
    }

    // ==================== PRODUCT TABLE ====================

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
        row.dataset.productId = product.id;
        row.dataset.styleNumber = product.styleNumber;
        row.dataset.baseCost = product.baseCost;
        row.innerHTML = `
            <td class="style-col">
                <strong>${product.styleNumber}</strong>
                <div class="sku-pattern" title="ShopWorks SKUs: ${product.styleNumber}, ${product.styleNumber}_2X, ${product.styleNumber}_3X, etc.">
                    <small>2XL+: _2X, _3X...</small>
                </div>
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
            <td class="size-col"><input type="number" class="cell-input size-input" data-size="S" min="0" value="" placeholder="0" disabled></td>
            <td class="size-col"><input type="number" class="cell-input size-input" data-size="M" min="0" value="" placeholder="0" disabled></td>
            <td class="size-col"><input type="number" class="cell-input size-input" data-size="LG" min="0" value="" placeholder="0" disabled></td>
            <td class="size-col"><input type="number" class="cell-input size-input" data-size="XL" min="0" value="" placeholder="0" disabled></td>
            <td class="size-col"><input type="number" class="cell-input size-input" data-size="XXL" min="0" value="" placeholder="0" disabled></td>
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
            quantities: { XS: 0, S: 0, M: 0, LG: 0, XL: 0, XXL: 0, XXXL: 0, '4XL': 0, '5XL': 0, '6XL': 0 }
        });

        // Setup input listeners for main row
        row.querySelectorAll('.size-input').forEach(input => {
            input.addEventListener('input', () => this.handleSizeInputChange(product.id));
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

    // ==================== EXTENDED SIZE POPUP ====================

    /**
     * Open extended size popup for a product
     */
    openExtendedSizePopup(productId) {
        this.currentPopupProductId = productId;
        const productData = this.products.find(p => p.id === productId);
        if (!productData) return;

        const popup = document.getElementById('extended-size-popup');
        const backdrop = document.getElementById('size-popup-backdrop');
        const body = document.getElementById('size-popup-body');

        // Extended sizes: XS, XXXL (3XL), 4XL, 5XL, 6XL
        const extendedSizes = ['XS', 'XXXL', '4XL', '5XL', '6XL'];

        body.innerHTML = `
            <div class="extended-sizes-grid">
                ${extendedSizes.map(size => {
                    const displaySize = size === 'XXXL' ? '3XL' : size;
                    return `
                        <div class="ext-size-input-group">
                            <label>${displaySize}</label>
                            <input type="number" class="ext-size-input" data-size="${size}"
                                   min="0" value="${productData.quantities[size] || ''}"
                                   placeholder="0">
                        </div>
                    `;
                }).join('')}
            </div>
            <div class="ext-popup-note">
                <i class="fas fa-info-circle"></i>
                These sizes have additional upcharges for transfers.
            </div>
        `;

        popup.classList.remove('hidden');
        backdrop.classList.remove('hidden');

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
    }

    /**
     * Apply extended sizes from popup
     */
    applyExtendedSizes() {
        const productId = this.currentPopupProductId;
        if (!productId) return;

        const productData = this.products.find(p => p.id === productId);
        if (!productData) return;

        const body = document.getElementById('size-popup-body');
        const inputs = body.querySelectorAll('.ext-size-input');

        let extTotal = 0;
        inputs.forEach(input => {
            const size = input.dataset.size;
            const qty = parseInt(input.value) || 0;
            productData.quantities[size] = qty;
            extTotal += qty;
        });

        // Update badge in main table
        this.updateExtendedBadge(productId, extTotal);

        // Update pricing
        this.handleSizeInputChange(productId);

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

    handleSizeInputChange(productId) {
        const row = document.querySelector(`tr[data-product-id="${productId}"]`);
        if (!row) return;

        const productData = this.products.find(p => p.id === productId);
        if (!productData) return;

        // Collect quantities from main row (S, M, LG, XL, XXL)
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
    }

    // ==================== PRICING CALCULATIONS ====================

    async updatePricing() {
        const totalQty = this.getTotalQuantity();
        const locationCount = this.selectedLocations.length;

        // Ensure pricing data is loaded from API
        try {
            await this.pricingCalculator.ensureLoaded();
        } catch (error) {
            console.error('[DTFQuoteBuilder] Failed to load pricing data:', error);
            this.showError('Unable to load pricing data. Please refresh the page.');
            return;
        }

        // Get tier label from API
        const tier = totalQty < 10 ? 'Min 10' : this.pricingCalculator.getTierForQuantity(totalQty);

        // Update sidebar displays
        document.getElementById('total-qty').textContent = totalQty;
        document.getElementById('pricing-tier').textContent = tier;

        // Calculate costs from API (not hardcoded)
        const transferBreakdown = this.pricingCalculator.calculateTransferCosts(this.selectedLocations, totalQty);
        const transferCost = transferBreakdown.total;
        const laborCostPerLoc = this.pricingCalculator.getLaborCostPerLocation();
        const laborCost = laborCostPerLoc * locationCount;
        const freightPerTransfer = this.pricingCalculator.getFreightPerTransfer(totalQty);
        const freightCost = freightPerTransfer * locationCount;
        const ltmPerUnit = this.pricingCalculator.calculateLTMPerUnit(totalQty);
        const totalLtmFee = ltmPerUnit * totalQty;
        const marginDenom = this.pricingCalculator.getMarginDenominator(totalQty);

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

        // Update sidebar cost displays
        document.getElementById('transfer-cost').textContent = `$${transferCost.toFixed(2)}/pc`;
        document.getElementById('labor-cost').textContent = `$${laborCost.toFixed(2)}/pc`;
        document.getElementById('freight-cost').textContent = `$${freightCost.toFixed(2)}/pc`;

        // LTM row
        const ltmRow = document.getElementById('ltm-row');
        const ltmFeeEl = document.getElementById('ltm-fee');
        if (totalLtmFee > 0 && totalQty > 0) {
            ltmRow.style.display = 'flex';
            ltmFeeEl.textContent = `$${ltmPerUnit.toFixed(2)}/pc`;
        } else {
            ltmRow.style.display = 'none';
        }

        // Calculate subtotal and grand total
        let grandTotal = 0;

        this.products.forEach(product => {
            const row = document.querySelector(`tr[data-product-id="${product.id}"]`);
            if (!row) return;

            let productTotal = 0;
            Object.entries(product.quantities).forEach(([size, qty]) => {
                if (qty > 0) {
                    const upcharge = this.getSizeUpcharge(size, product.sizeUpcharges);
                    // Use margin from API (not hardcoded 0.57)
                    const garmentCost = (product.baseCost + upcharge) / marginDenom;
                    const unitPrice = garmentCost + transferCost + laborCost + freightCost + ltmPerUnit;
                    // Use rounding from API
                    const roundedPrice = this.pricingCalculator.applyRounding(unitPrice);
                    productTotal += roundedPrice * qty;
                }
            });

            // Update row price
            const priceSpan = row.querySelector('.row-price');
            if (priceSpan) priceSpan.textContent = `$${productTotal.toFixed(2)}`;

            grandTotal += productTotal;
        });

        // Update subtotal and grand total
        document.getElementById('subtotal').textContent = `$${grandTotal.toFixed(2)}`;
        document.getElementById('grand-total').textContent = `$${grandTotal.toFixed(2)}`;

        // Enable/disable continue button
        const continueBtn = document.getElementById('continue-btn');
        if (continueBtn) {
            continueBtn.disabled = totalQty < 10 || this.selectedLocations.length === 0;
        }
    }

    getTotalQuantity() {
        return this.products.reduce((sum, p) => {
            return sum + Object.values(p.quantities).reduce((s, q) => s + q, 0);
        }, 0);
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
        if (!upcharges) return 0;
        // Common size upcharge patterns - default values if not in upcharges
        const defaults = { '2XL': 2.00, '3XL': 3.00, '4XL': 4.00, '5XL': 5.00, '6XL': 6.00 };
        const upchargeMap = {
            '2XL': upcharges['2XL'] || upcharges['2X'] || defaults['2XL'],
            '3XL': upcharges['3XL'] || upcharges['3X'] || defaults['3XL'],
            '4XL': upcharges['4XL'] || upcharges['4X'] || defaults['4XL'],
            '5XL': upcharges['5XL'] || upcharges['5X'] || defaults['5XL'],
            '6XL': upcharges['6XL'] || upcharges['6X'] || defaults['6XL']
        };
        return upchargeMap[size] || 0;
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

        // Build products summary
        const productsHTML = this.products.map(p => {
            const totalQty = Object.values(p.quantities).reduce((s, q) => s + q, 0);
            if (totalQty === 0) return '';

            const sizesStr = Object.entries(p.quantities)
                .filter(([_, qty]) => qty > 0)
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
        const grandTotal = parseFloat(document.getElementById('grand-total').textContent.replace('$', ''));

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
        const grandTotal = parseFloat(document.getElementById('grand-total').textContent.replace('$', ''));

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
            products: this.products.map(p => ({
                styleNumber: p.styleNumber,
                description: p.description,
                color: p.color,              // Display name
                catalogColor: p.catalogColor, // CATALOG_COLOR for API/ShopWorks
                baseCost: p.baseCost,
                sizeUpcharges: p.sizeUpcharges,
                quantities: p.quantities
            })),
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

    saveDraft() {
        const draftData = {
            locations: this.selectedLocations,
            products: this.products,
            timestamp: new Date().toISOString()
        };

        localStorage.setItem('dtf-quote-draft', JSON.stringify(draftData));
        alert('Draft saved to browser storage');
    }

    printQuote() {
        window.print();
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
        const grandTotal = parseFloat(document.getElementById('grand-total').textContent.replace('$', ''));

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
        const grandTotal = parseFloat(document.getElementById('grand-total').textContent.replace('$', ''));
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
}

// Global instance
let dtfQuoteBuilder;

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    dtfQuoteBuilder = new DTFQuoteBuilder();
    window.dtfQuoteBuilder = dtfQuoteBuilder;
});
