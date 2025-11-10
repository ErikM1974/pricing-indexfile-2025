/**
 * DTG Quote Builder Main Controller
 * Orchestrates all modules for the DTG quote builder application
 *
 * ⚠️ CRITICAL PRICING CONSISTENCY REQUIREMENT:
 * This quote builder MUST produce identical prices as the DTG Pricing Calculator
 * (/calculators/dtg-pricing.html) for the same inputs.
 *
 * SHARED DEPENDENCIES (auto-sync):
 * - /shared_components/js/dtg-pricing-service.js (core pricing logic)
 * - /shared_components/js/dtg-quote-pricing.js (LTM calculations)
 *
 * NOT SHARED (manual sync required):
 * - LTM display logic (lines 949-959)
 * - Size breakdown HTML generation (lines 897-934)
 * - Green button styling (line 928)
 *
 * Before committing changes that affect pricing display or calculations:
 * 1. Test this quote builder with PC61, 17 pieces, LC+FB
 * 2. Test pricing calculator with same inputs
 * 3. Verify all per-piece prices match exactly
 *
 * See CLAUDE.md "DTG Calculator Synchronization" section for full details.
 */

class DTGQuoteBuilder {
    constructor() {
        // Initialize services
        this.quoteService = new window.DTGQuoteService();
        this.pricingCalculator = new window.DTGQuotePricing();
        this.productsManager = new window.DTGQuoteProducts();
        
        // Initialize EmailJS
        emailjs.init('4qSbDO-SQs19TbP80');
        
        // State management
        this.currentPhase = 1;
        this.highestPhaseReached = 1; // Track highest phase user has reached
        this.selectedLocations = []; // Array to track multiple selected locations
        this.selectedLocation = null; // Legacy - will be computed from selectedLocations
        this.selectedLocationName = null;
        this.currentQuoteData = null;
        
        // Initialize elements
        this.initializeElements();
        this.bindEvents();
        
        // Set initial state
        this.updatePhaseNavigation();
        
        console.log('[DTGQuoteBuilder] Initialized');
    }
    
    /**
     * Initialize DOM element references
     */
    initializeElements() {
        // Phase sections
        this.locationPhase = document.getElementById('location-phase');
        this.productPhase = document.getElementById('product-phase');
        this.reviewPhase = document.getElementById('review-phase');
        
        // Phase navigation
        this.phase1Nav = document.getElementById('phase-1-nav');
        this.phase2Nav = document.getElementById('phase-2-nav');
        this.phase3Nav = document.getElementById('phase-3-nav');
        this.connector1 = document.getElementById('connector-1');
        this.connector2 = document.getElementById('connector-2');
        
        // Location selection (toggle-based, no separate display element)
        this.locationRadios = document.querySelectorAll('input[name="print-location"]'); // Legacy, kept for compatibility
        this.continueToProductsBtn = document.getElementById('continue-to-products');
        
        // Product phase
        this.phase2Location = document.getElementById('phase2-location');
        this.styleSearch = document.getElementById('style-search');
        this.styleSuggestions = document.getElementById('style-suggestions');
        // Note: No color-select or load-product-btn - using color swatches instead
        this.productDisplay = document.getElementById('product-display');
        this.productImage = document.getElementById('product-image');
        this.productName = document.getElementById('product-name');
        this.productDescription = document.getElementById('product-description');
        this.productStyle = document.getElementById('product-style');
        this.productColor = document.getElementById('product-color');
        this.sizeInputsContainer = document.getElementById('size-inputs');
        this.productTotalQty = document.getElementById('product-total-qty');
        this.addToQuoteBtn = document.getElementById('add-to-quote-btn');
        this.productsContainer = document.getElementById('products-container');
        this.aggregateQuantity = document.getElementById('aggregate-quantity');
        this.tierDisplay = document.getElementById('tier-display');
        this.currentTier = document.getElementById('current-tier');
        this.ltmWarning = document.getElementById('ltm-warning');
        this.backToLocationBtn = document.getElementById('back-to-location');
        this.continueToReviewBtn = document.getElementById('continue-to-review');
        
        // Review phase
        this.customerName = document.getElementById('customer-name');
        this.customerEmail = document.getElementById('customer-email');
        this.companyName = document.getElementById('company-name');
        this.customerPhone = document.getElementById('customer-phone');
        this.projectName = document.getElementById('project-name');
        this.salesRep = document.getElementById('sales-rep');
        this.specialNotes = document.getElementById('special-notes');
        this.previewQuoteId = document.getElementById('preview-quote-id');
        this.expiryDate = document.getElementById('expiry-date');
        this.summaryLocation = document.getElementById('summary-location');
        this.quoteItemsSummary = document.getElementById('quote-items-summary');
        this.summaryQuantity = document.getElementById('summary-quantity');
        this.summaryTier = document.getElementById('summary-tier');
        this.summaryTotal = document.getElementById('summary-total');
        this.summaryLtmNote = document.getElementById('summary-ltm-note');
        this.backToProductsBtn = document.getElementById('back-to-products');
        this.saveQuoteBtn = document.getElementById('save-quote-btn');
        this.printQuoteBtn = document.getElementById('print-quote-btn');
        
        // Modals
        this.successModal = document.getElementById('success-modal');
        this.modalQuoteId = document.getElementById('modal-quote-id');
        this.modalCustomer = document.getElementById('modal-customer');
        this.modalTotal = document.getElementById('modal-total');
        this.loadingOverlay = document.getElementById('loading-overlay');

        // 🔍 Enhanced Debugging: Log critical element status
        console.log('🔍 [DTGQuoteBuilder] Element Initialization Status:');
        console.log('✅ Phase sections:', {
            location: !!this.locationPhase,
            product: !!this.productPhase,
            review: !!this.reviewPhase
        });
        console.log('✅ Navigation:', {
            phase1Nav: !!this.phase1Nav,
            phase2Nav: !!this.phase2Nav,
            phase3Nav: !!this.phase3Nav
        });
        console.log('✅ Toggle switches found:', document.querySelectorAll('.toggle-item').length);
        console.log('✅ Continue button:', !!this.continueToProductsBtn);
        console.log('✅ Product elements:', {
            styleSearch: !!this.styleSearch,
            productDisplay: !!this.productDisplay,
            addToQuoteBtn: !!this.addToQuoteBtn
        });
        console.log('✅ Review elements:', {
            customerName: !!this.customerName,
            saveQuoteBtn: !!this.saveQuoteBtn
        });
    }
    
    /**
     * Bind event listeners
     */
    bindEvents() {
        // Phase navigation - make steps clickable
        this.phase1Nav.addEventListener('click', () => this.navigateToPhase(1));
        this.phase2Nav.addEventListener('click', () => this.navigateToPhase(2));
        this.phase3Nav.addEventListener('click', () => this.navigateToPhase(3));

        // Location selection - toggle switches
        const toggleItems = document.querySelectorAll('.toggle-item');
        toggleItems.forEach(toggle => {
            toggle.addEventListener('click', () => {
                const locationCode = toggle.dataset.location;
                this.handleToggleLocation(locationCode, toggle);
            });
        });

        this.continueToProductsBtn.addEventListener('click', () => this.moveToPhase(2));

        // Initialize exact match search for sales reps
        this.productsManager.initializeExactMatchSearch(
            // Callback for exact matches - auto-load product
            (product) => {
                console.log('[DTGQuoteBuilder] Exact match found, auto-loading:', product.value);
                this.styleSearch.value = product.value;
                this.loadProductColors(product.value);
            },
            // Callback for suggestions list
            (products) => {
                if (products.length === 0) {
                    this.styleSuggestions.innerHTML = '';
                    this.styleSuggestions.style.display = 'none';
                    return;
                }

                this.styleSuggestions.innerHTML = products.map(product => `
                    <div class="suggestion-item" data-style="${product.value}">
                        <strong>${product.value}</strong> - ${product.label.split(' - ')[1] || product.label}
                    </div>
                `).join('');

                // Add click handlers
                this.styleSuggestions.querySelectorAll('.suggestion-item').forEach(item => {
                    item.addEventListener('click', () => {
                        this.styleSearch.value = item.dataset.style;
                        this.styleSuggestions.style.display = 'none';
                        this.loadProductColors(item.dataset.style);
                    });
                });

                this.styleSuggestions.style.display = 'block';
            }
        );

        // Product phase - use exact match search
        this.styleSearch.addEventListener('input', (e) => this.handleStyleSearch(e));
        this.styleSearch.addEventListener('keydown', (e) => {
            // Enter key = immediate search (no debounce)
            if (e.key === 'Enter') {
                e.preventDefault();
                const query = e.target.value.trim();
                if (query.length >= 2) {
                    this.productsManager.searchImmediate(query);
                }
            }
        });

        // Hide suggestions when clicking outside
        document.addEventListener('click', (e) => {
            if (!this.styleSearch.contains(e.target) && !this.styleSuggestions.contains(e.target)) {
                this.styleSuggestions.style.display = 'none';
            }
        });

        // Note: loadProductBtn removed - color swatches auto-load product
        this.addToQuoteBtn.addEventListener('click', () => this.addProductToQuote());
        this.backToLocationBtn.addEventListener('click', () => this.moveToPhase(1));
        this.continueToReviewBtn.addEventListener('click', () => this.moveToPhase(3));

        // Review phase
        this.backToProductsBtn.addEventListener('click', () => this.moveToPhase(2));
        this.saveQuoteBtn.addEventListener('click', () => this.saveQuote());
        this.printQuoteBtn.addEventListener('click', () => this.printQuote());

        // Customer info auto-save
        [this.customerName, this.customerEmail, this.companyName,
         this.customerPhone, this.projectName, this.specialNotes].forEach(input => {
            input.addEventListener('change', () => this.updateQuoteSummary());
        });
    }
    
    /**
     * Handle toggle location selection - Supports multiple locations (DTG Pricing Page Pattern)
     */
    handleToggleLocation(locationCode, toggleElement) {
        console.log(`🎯 [handleToggleLocation] Called with code: ${locationCode}`);

        // Location names map
        const locationNames = {
            'LC': 'Left Chest',
            'BON': 'Back of Neck',
            'FF': 'Full Front',
            'FB': 'Full Back',
            'JF': 'Jumbo Front',
            'JB': 'Jumbo Back'
        };

        const index = this.selectedLocations.indexOf(locationCode);
        const isCurrentlyOn = index !== -1;
        console.log(`   Current state: ${isCurrentlyOn ? 'ON' : 'OFF'}, Array before:`, [...this.selectedLocations]);

        // Define front and back locations (BON is a front location)
        const frontLocations = ['LC', 'BON', 'FF', 'JF'];
        const backLocations = ['FB', 'JB'];
        const isFront = frontLocations.includes(locationCode);
        const isBack = backLocations.includes(locationCode);
        console.log(`   Location type: ${isFront ? 'FRONT' : isBack ? 'BACK' : 'UNKNOWN'}`);

        if (isCurrentlyOn) {
            // Turn OFF: Remove from selected locations
            this.selectedLocations.splice(index, 1);
            this.updateToggleUI(locationCode, false);
            console.log(`🔴 Toggled OFF: ${locationCode}, Array after:`, [...this.selectedLocations]);
        } else {
            // Turn ON: Check constraints
            const currentFrontCount = this.selectedLocations.filter(loc => frontLocations.includes(loc)).length;
            const currentBackCount = this.selectedLocations.filter(loc => backLocations.includes(loc)).length;
            console.log(`   Constraint check: ${currentFrontCount} front, ${currentBackCount} back`);

            // Validation: Max 1 front + Max 1 back = Max 2 total
            if (isFront && currentFrontCount >= 1) {
                // Already have a front location - turn off the old one first
                const oldFrontLocation = this.selectedLocations.find(loc => frontLocations.includes(loc));
                this.selectedLocations = this.selectedLocations.filter(loc => loc !== oldFrontLocation);
                this.updateToggleUI(oldFrontLocation, false);
                console.log(`🔄 Replacing front location ${oldFrontLocation} with ${locationCode}`);
            }

            if (isBack && currentBackCount >= 1) {
                // Already have a back location - turn off the old one first
                const oldBackLocation = this.selectedLocations.find(loc => backLocations.includes(loc));
                this.selectedLocations = this.selectedLocations.filter(loc => loc !== oldBackLocation);
                this.updateToggleUI(oldBackLocation, false);
                console.log(`🔄 Replacing back location ${oldBackLocation} with ${locationCode}`);
            }

            // Add the new location
            this.selectedLocations.push(locationCode);
            this.updateToggleUI(locationCode, true);
            console.log(`🟢 Toggled ON: ${locationCode}, Array after:`, [...this.selectedLocations]);
        }

        // Update display and compute legacy values
        this.updateLocationDisplay();
    }

    /**
     * Update toggle UI visual state
     */
    updateToggleUI(locationCode, isOn) {
        const toggleElement = document.getElementById(`toggle-${locationCode}`);
        if (!toggleElement) return;

        const toggleSwitch = toggleElement.querySelector('.toggle-switch');
        if (isOn) {
            toggleElement.classList.add('active');
            toggleSwitch.classList.add('on');
        } else {
            toggleElement.classList.remove('active');
            toggleSwitch.classList.remove('on');
        }
    }

    /**
     * Update location display and compute combined location code
     */
    updateLocationDisplay() {
        const locationNames = {
            'LC': 'Left Chest',
            'BON': 'Back of Neck',
            'FF': 'Full Front',
            'FB': 'Full Back',
            'JF': 'Jumbo Front',
            'JB': 'Jumbo Back'
        };

        if (this.selectedLocations.length === 0) {
            // No locations selected
            this.continueToProductsBtn.disabled = true;
            this.selectedLocation = null;
            this.selectedLocationName = null;
            console.log('📍 [DTGQuoteBuilder] No locations selected - button disabled');
        } else if (this.selectedLocations.length === 1) {
            // Single location
            const locationCode = this.selectedLocations[0];
            this.selectedLocation = locationCode;
            this.selectedLocationName = locationNames[locationCode];
            this.continueToProductsBtn.disabled = false;
            console.log('📍 [DTGQuoteBuilder] Single location selected:', {
                code: this.selectedLocation,
                display: this.selectedLocationName
            });
        } else if (this.selectedLocations.length === 2) {
            // Combo location: Build combo code
            // Map BON to LC for pricing
            const pricingLocations = this.selectedLocations.map(loc => loc === 'BON' ? 'LC' : loc);

            // Sort by type: FRONT locations first, then BACK locations
            // This ensures LC_FB (not FB_LC), FF_FB, JF_JB, LC_JB
            const frontLocations = ['LC', 'FF', 'JF'];
            const backLocations = ['FB', 'JB'];

            const sorted = pricingLocations.sort((a, b) => {
                const aIsFront = frontLocations.includes(a);
                const bIsFront = frontLocations.includes(b);
                if (aIsFront && !bIsFront) return -1; // a (front) comes before b (back)
                if (!aIsFront && bIsFront) return 1;  // b (front) comes before a (back)
                return a.localeCompare(b); // Same type, sort alphabetically
            });

            const [loc1, loc2] = sorted;
            this.selectedLocation = `${loc1}_${loc2}`;

            const loc1Name = locationNames[this.selectedLocations[0]];
            const loc2Name = locationNames[this.selectedLocations[1]];
            this.selectedLocationName = `${loc1Name} + ${loc2Name}`;
            this.continueToProductsBtn.disabled = false;
            console.log('📍 [DTGQuoteBuilder] Combo location selected:', {
                codes: this.selectedLocations,
                pricingCode: this.selectedLocation,
                display: this.selectedLocationName
            });
        }

        console.log('[DTGQuoteBuilder] Location state:', {
            selectedLocations: this.selectedLocations,
            computedCode: this.selectedLocation,
            displayName: this.selectedLocationName,
            buttonDisabled: this.continueToProductsBtn.disabled
        });
    }

    /**
     * Handle location selection (legacy method for compatibility)
     */
    handleLocationSelection() {
        // This method is kept for backward compatibility but no longer used
        // Toggle switches now use handleToggleLocation instead
        const selected = document.querySelector('input[name="print-location"]:checked');
        if (selected) {
            this.selectedLocation = selected.value;

            // Map location codes to display names
            const locationNames = {
                'LC': 'Left Chest',
                'FF': 'Full Front',
                'FB': 'Full Back',
                'JF': 'Jumbo Front',
                'JB': 'Jumbo Back',
                'LC_FB': 'Left Chest & Full Back',
                'FF_FB': 'Full Front & Full Back',
                'JF_JB': 'Jumbo Front & Jumbo Back',
                'LC_JB': 'Left Chest & Jumbo Back'
            };

            this.selectedLocationName = locationNames[this.selectedLocation];

            // Update display
            this.selectedLocationText.textContent = this.selectedLocationName;
            this.selectedLocationDisplay.style.display = 'block';
            this.continueToProductsBtn.disabled = false;

            console.log('[DTGQuoteBuilder] Location selected:', this.selectedLocation, this.selectedLocationName);
        }
    }
    
    /**
     * Handle style search - uses exact match search for sales reps
     */
    async handleStyleSearch(event) {
        const query = event.target.value.trim();

        if (query.length < 2) {
            this.styleSuggestions.innerHTML = '';
            this.styleSuggestions.style.display = 'none';
            return;
        }

        // Use the exact match search module (initialized in bindEvents)
        // This will auto-load exact matches and show suggestions for partial matches
        this.productsManager.searchWithExactMatch(query);
    }
    
    /**
     * Load product colors and display swatches
     */
    async loadProductColors(styleNumber) {
        try {
            // Fetch color swatches from API
            const swatchesResponse = await fetch(`https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/color-swatches?styleNumber=${styleNumber}`);
            const swatches = await swatchesResponse.json();

            // Also load product details
            const product = await this.productsManager.loadProductDetails(styleNumber);

            if (swatches && swatches.length > 0) {
                // Show color selection container
                const colorContainer = document.getElementById('color-selection-container');
                const colorSwatchesGrid = document.getElementById('color-swatches');

                colorSwatchesGrid.innerHTML = '';

                swatches.forEach(swatch => {
                    const swatchEl = document.createElement('div');
                    swatchEl.className = 'color-swatch';
                    swatchEl.dataset.colorName = swatch.COLOR_NAME;
                    swatchEl.dataset.colorImage = swatch.COLOR_SQUARE_IMAGE;

                    swatchEl.innerHTML = `
                        <img class="color-swatch-image" src="${swatch.COLOR_SQUARE_IMAGE}" alt="${swatch.COLOR_NAME}">
                        <div class="color-swatch-name">${swatch.COLOR_NAME}</div>
                    `;

                    swatchEl.addEventListener('click', () => this.selectColor(swatch.COLOR_NAME, swatchEl));

                    colorSwatchesGrid.appendChild(swatchEl);
                });

                colorContainer.style.display = 'block';

                // Store current product data
                this.currentProductData = product;
            } else {
                console.error('[DTGQuoteBuilder] No color swatches found for', styleNumber);
            }
        } catch (error) {
            console.error('[DTGQuoteBuilder] Error loading colors:', error);
        }
    }

    /**
     * Select a color swatch
     */
    async selectColor(colorName, swatchElement) {
        // Update visual selection
        document.querySelectorAll('.color-swatch').forEach(el => el.classList.remove('selected'));
        swatchElement.classList.add('selected');

        // Store selected color
        document.getElementById('selected-color').value = colorName;

        console.log('[DTGQuoteBuilder] Color selected:', colorName);

        // Auto-load the product with this color
        await this.loadProduct(this.styleSearch.value, colorName);
    }
    
    /**
     * Load product details and display
     */
    async loadProduct(styleNumberParam, colorParam) {
        const styleNumber = styleNumberParam || this.styleSearch.value.trim();
        const color = colorParam || document.getElementById('selected-color').value;

        if (!styleNumber || !color) {
            alert('Please select both style and color');
            return;
        }
        
        this.showLoading();
        
        try {
            // Get available sizes for this style/color combo
            const sizes = await this.productsManager.getAvailableSizes(styleNumber, color);
            
            // Update product display
            this.productName.textContent = this.currentProductData.title || styleNumber;
            this.productDescription.textContent = this.currentProductData.description || '';
            this.productStyle.textContent = styleNumber;
            this.productColor.textContent = color;
            
            // Set product image
            console.log('[DTGQuoteBuilder] Looking for color:', color);
            console.log('[DTGQuoteBuilder] Available colors:', this.currentProductData?.colors);
            console.log('[DTGQuoteBuilder] Colors type:', typeof this.currentProductData?.colors);
            console.log('[DTGQuoteBuilder] First color sample:', this.currentProductData?.colors?.[0]);

            // Handle multiple color data formats
            let colorData = null;
            if (this.currentProductData?.colors) {
                const colors = this.currentProductData.colors;
                
                // Try different matching strategies
                colorData = colors.find(c => {
                    if (typeof c === 'string') return c === color;
                    return (c.COLOR_NAME === color || 
                            c.colorName === color || 
                            c.name === color ||
                            c.color === color);
                });
            }

            console.log('[DTGQuoteBuilder] Found color data:', colorData);

            if (colorData) {
                // Try multiple possible image field names
                const imageUrl = (typeof colorData === 'object') ? (
                    colorData.MAIN_IMAGE_URL ||
                    colorData.mainImageUrl ||
                    colorData.imageUrl ||
                    colorData.image_url ||
                    colorData.image
                ) : null;

                console.log('[DTGQuoteBuilder] Image URL extracted:', imageUrl);

                if (imageUrl) {
                    this.productImage.src = imageUrl;
                    this.productImage.style.display = 'block';

                    // Add error handler for failed image loads
                    this.productImage.onerror = () => {
                        console.warn('[DTGQuoteBuilder] Image failed to load, using placeholder:', imageUrl);
                        this.productImage.src = 'https://via.placeholder.com/120x120/f9fafb/4b5563?text=No+Image';
                        this.productImage.onerror = null; // Prevent infinite loop
                    };

                    console.log('[DTGQuoteBuilder] ✅ Image set successfully:', imageUrl);
                } else {
                    console.warn('[DTGQuoteBuilder] No image URL found in color data, using placeholder');
                    this.productImage.src = 'https://via.placeholder.com/120x120/f9fafb/4b5563?text=No+Image';
                    this.productImage.style.display = 'block';
                }
            } else {
                console.warn('[DTGQuoteBuilder] Color not found:', color, '- using placeholder');
                this.productImage.src = 'https://via.placeholder.com/120x120/f9fafb/4b5563?text=No+Image';
                this.productImage.style.display = 'block';
            }
            
            // Build size inputs
            this.buildSizeInputs(sizes);
            
            // Show product display
            this.productDisplay.style.display = 'block';
            
        } catch (error) {
            console.error('[DTGQuoteBuilder] Error loading product:', error);
            alert('Error loading product details. Please try again.');
        } finally {
            this.hideLoading();
        }
    }
    
    /**
     * Build size input fields
     */
    buildSizeInputs(sizes) {
        this.sizeInputsContainer.innerHTML = '';
        
        sizes.forEach(size => {
            const sizeInput = document.createElement('div');
            sizeInput.className = 'size-input';
            sizeInput.innerHTML = `
                <label>${size}</label>
                <input type="number" 
                       class="size-qty" 
                       data-size="${size}" 
                       min="0" 
                       value="0" 
                       placeholder="0">
            `;
            this.sizeInputsContainer.appendChild(sizeInput);
        });
        
        // Add quantity change listeners
        this.sizeInputsContainer.querySelectorAll('.size-qty').forEach(input => {
            input.addEventListener('input', () => this.updateProductTotal());
        });
        
        this.updateProductTotal();
    }
    
    /**
     * Update product total quantity
     */
    updateProductTotal() {
        let total = 0;
        this.sizeInputsContainer.querySelectorAll('.size-qty').forEach(input => {
            total += parseInt(input.value) || 0;
        });
        
        this.productTotalQty.textContent = total;
        this.addToQuoteBtn.disabled = total === 0;
    }
    
    /**
     * Add product to quote
     */
    async addProductToQuote() {
        const styleNumber = this.styleSearch.value.trim();
        const color = document.getElementById('selected-color').value;
        
        // Collect size quantities
        const sizeQuantities = {};
        this.sizeInputsContainer.querySelectorAll('.size-qty').forEach(input => {
            const qty = parseInt(input.value) || 0;
            if (qty > 0) {
                sizeQuantities[input.dataset.size] = qty;
            }
        });
        
        if (Object.keys(sizeQuantities).length === 0) {
            alert('Please enter at least one quantity');
            return;
        }
        
        // Get product image
        const colorData = this.currentProductData.colors.find(c => 
            (c.COLOR_NAME || c) === color
        );
        
        // Add product
        const productData = {
            styleNumber: styleNumber,
            productName: this.currentProductData.title || styleNumber,
            color: color,
            colorCode: colorData?.COLOR_CODE || '',
            imageUrl: colorData?.MAIN_IMAGE_URL || '',
            sizeQuantities: sizeQuantities,
            pricingData: this.currentProductData.pricingData
        };
        
        await this.productsManager.addProduct(productData);
        
        // Update display
        this.updateProductsList();
        
        // Reset form
        this.resetProductForm();
        
        console.log('[DTGQuoteBuilder] Product added to quote');
    }
    
    /**
     * Update products list display
     */
    updateProductsList() {
        const products = this.productsManager.getAllProducts();
        
        if (products.length === 0) {
            this.productsContainer.innerHTML = '<p class="empty-message">No products added yet</p>';
            this.continueToReviewBtn.disabled = true;
        } else {
            this.productsContainer.innerHTML = products.map(product => 
                this.productsManager.buildProductCard(product)
            ).join('');
            this.continueToReviewBtn.disabled = false;
        }
        
        // Update aggregate quantity
        const totalQty = this.productsManager.getTotalQuantity();
        this.aggregateQuantity.textContent = totalQty;
        
        // Update tier display
        const tier = this.pricingCalculator.getTierForQuantity(totalQty);
        this.currentTier.textContent = tier;
        this.tierDisplay.style.display = 'block';
        
        // Show LTM warning if applicable
        if (totalQty < 24) {
            this.ltmWarning.style.display = 'block';
        } else {
            this.ltmWarning.style.display = 'none';
        }
    }
    
    /**
     * Reset product form
     */
    resetProductForm() {
        this.styleSearch.value = '';

        // Reset color selection (swatches-based, not a select element)
        const colorContainer = document.getElementById('color-selection-container');
        const colorSwatchesGrid = document.getElementById('color-swatches');
        const selectedColorInput = document.getElementById('selected-color');

        if (colorContainer) colorContainer.style.display = 'none';
        if (colorSwatchesGrid) colorSwatchesGrid.innerHTML = '';
        if (selectedColorInput) selectedColorInput.value = '';

        if (this.loadProductBtn) this.loadProductBtn.disabled = true;
        this.productDisplay.style.display = 'none';
    }
    
    /**
     * Navigate to phase via clicking step indicators
     * Only allows navigation to phases that have been visited
     */
    navigateToPhase(phase) {
        // Only allow navigation to phases that have been reached
        if (phase <= this.highestPhaseReached) {
            this.moveToPhase(phase);
        }
    }

    /**
     * Move to specific phase
     */
    moveToPhase(phase) {
        this.currentPhase = phase;

        // Track highest phase reached
        if (phase > this.highestPhaseReached) {
            this.highestPhaseReached = phase;
        }

        // Hide all phases
        [this.locationPhase, this.productPhase, this.reviewPhase].forEach(p => {
            p.style.display = 'none';
        });

        // Show current phase
        switch (phase) {
            case 1:
                this.locationPhase.style.display = 'block';
                break;
            case 2:
                this.productPhase.style.display = 'block';
                this.phase2Location.textContent = this.selectedLocationName;
                break;
            case 3:
                this.reviewPhase.style.display = 'block';
                this.prepareQuoteSummary();
                break;
        }

        // Update navigation
        this.updatePhaseNavigation();

        // Scroll to top
        window.scrollTo(0, 0);
    }
    
    /**
     * Update phase navigation indicators
     */
    updatePhaseNavigation() {
        // Reset all phases
        [this.phase1Nav, this.phase2Nav, this.phase3Nav].forEach((nav, index) => {
            const phaseNumber = index + 1;
            nav.classList.remove('active', 'completed', 'clickable', 'disabled');

            if (phaseNumber < this.currentPhase) {
                nav.classList.add('completed', 'clickable');
            } else if (phaseNumber === this.currentPhase) {
                nav.classList.add('active');
            } else if (phaseNumber <= this.highestPhaseReached) {
                nav.classList.add('clickable');
            } else {
                nav.classList.add('disabled');
            }
        });

        // Update connectors
        this.connector1.classList.toggle('active', this.currentPhase > 1);
        this.connector2.classList.toggle('active', this.currentPhase > 2);
    }
    
    /**
     * Prepare quote summary for review (Detailed Breakdown)
     */
    async prepareQuoteSummary() {
        const products = this.productsManager.getAllProducts();
        const totalQuantity = this.productsManager.getTotalQuantity();

        // Generate quote ID preview
        const quoteId = this.quoteService.generateQuoteID();
        this.previewQuoteId.textContent = quoteId;

        // Set expiry date
        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + 30);
        this.expiryDate.textContent = expiryDate.toLocaleDateString();

        // Set location (with fallback and debug)
        const locationToDisplay = this.selectedLocationName || 'Not Set';
        this.summaryLocation.textContent = locationToDisplay;
        console.log('[DTGQuoteBuilder] Setting summary location:', locationToDisplay, 'from:', this.selectedLocationName);

        // Calculate pricing for all products
        const quoteTotals = await this.pricingCalculator.calculateQuoteTotals(
            products,
            this.selectedLocation,
            totalQuantity
        );

        console.log('[DTGQuoteBuilder] Quote totals calculated:', quoteTotals);

        // Debug: Log each product's structure in detail
        console.log('🔍 [DTGQuoteBuilder] Detailed Product Analysis:');
        quoteTotals.products.forEach((product, index) => {
            console.log(`📦 Product ${index + 1}/${quoteTotals.products.length}:`, {
                styleNumber: product.styleNumber,
                productName: product.productName,
                color: product.color,
                quantity: product.quantity,
                subtotal: product.subtotal,
                sizeGroups: product.sizeGroups,
                sizeGroupCount: product.sizeGroups?.length || 0
            });

            // Log each size group
            if (product.sizeGroups) {
                product.sizeGroups.forEach((group, gIndex) => {
                    console.log(`  📏 Size Group ${gIndex + 1}:`, {
                        sizes: group.sizes,
                        basePrice: group.basePrice,
                        ltmPerUnit: group.ltmPerUnit,
                        unitPrice: group.unitPrice,
                        total: group.total
                    });
                });
            } else {
                console.error('  ❌ NO SIZE GROUPS FOUND for product:', product.styleNumber);
            }
        });

        // Build detailed product summary HTML (like screenprint with location header)
        let summaryHTML = '';

        // Add location header section at the top
        summaryHTML += `
            <div class="summary-section" style="background: #f0f9ff; border: 1px solid #0284c7; border-radius: 8px; padding: 1rem; margin-bottom: 1.5rem;">
                <h3 style="color: #0369a1; margin-bottom: 0.75rem; font-size: 1.1rem;">
                    <i class="fas fa-map-marker-alt"></i> Print Location
                </h3>
                <div class="summary-row">
                    <span style="font-weight: 600; color: #334155;">${this.selectedLocationName || 'Not Set'}</span>
                </div>
            </div>
        `;

        quoteTotals.products.forEach((product, productIndex) => {
            console.log(`[DTGQuoteBuilder] Building HTML for product ${productIndex}:`, product.styleNumber);

            // Safety check for required fields
            if (!product.sizeGroups || !Array.isArray(product.sizeGroups)) {
                console.error(`❌ Product ${product.styleNumber} has no sizeGroups array!`, product);
                return; // Skip this product
            }

            if (product.subtotal === undefined || product.subtotal === null) {
                console.error(`❌ Product ${product.styleNumber} has undefined subtotal!`, product);
                // Try to calculate it from size groups
                product.subtotal = product.sizeGroups.reduce((sum, g) => sum + (g.total || 0), 0);
                console.log(`  ✅ Calculated subtotal: $${product.subtotal.toFixed(2)}`);
            }

            // Get product image with fallback
            const productImageUrl = product.imageUrl || product.MAIN_IMAGE_URL || '/assets/placeholder-product.png';

            // Check if any size group has LTM
            const hasLTM = quoteTotals.hasLTM;
            const ltmImpactPerShirt = hasLTM ? (quoteTotals.ltmFee / totalQuantity) : 0;

            summaryHTML += `
                <div class="product-summary-item">
                    <div class="product-image-container">
                        <img src="${productImageUrl}" alt="${product.styleNumber}" class="product-summary-image">
                    </div>
                    <div class="product-content">
                        <div class="product-header">
                            <div class="product-title">
                                <strong>${product.styleNumber} - ${product.productName}</strong>
                                <span class="product-color">${product.color}</span>
                            </div>
                            <span class="product-qty-badge">${product.quantity} pcs</span>
                        </div>

                        ${hasLTM ? `
                        <div class="ltm-notice" style="background: #fff9e6; border: 1px solid #ffc107; padding: 0.875rem; border-radius: 6px; margin: 1rem 0;">
                            <div style="display: flex; align-items: center; gap: 0.5rem; color: #856404; font-size: 0.95rem;">
                                <i class="fas fa-info-circle" style="font-size: 1.1rem;"></i>
                                <span style="font-weight: 600;">Small Batch Fee Applied:</span>
                                <span>$${quoteTotals.ltmFee.toFixed(2)} ÷ ${totalQuantity} total pieces = $${ltmImpactPerShirt.toFixed(2)} per piece</span>
                            </div>
                        </div>
                        ` : ''}

                        <div style="margin-top: 1rem; padding: 0.875rem; background: #f8fafc; border-radius: 6px;">
                            <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.75rem;">
                                <h4 style="margin: 0; font-size: 0.95rem; font-weight: 600; color: #1e293b;">Size & Pricing Breakdown</h4>
                                <i class="fas fa-info-circle" style="color: #94a3b8; font-size: 0.85rem;" title="Base price + fees = final price per piece"></i>
                            </div>
                            <div class="size-breakdown-transparent">
                            ${product.sizeGroups.map((group, gIndex) => {
                                // Safety check
                                if (!group.sizes || typeof group.sizes !== 'object') {
                                    console.error(`❌ Size group ${gIndex} has invalid sizes property!`, group);
                                    return '';
                                }

                                const sizeList = Object.entries(group.sizes || {})
                                    .map(([size, qty]) => `${size}:${qty}`)
                                    .join(', ');

                                const totalQty = Object.values(group.sizes || {}).reduce((sum, q) => sum + q, 0);

                                return `
                                    <div class="size-pricing-detail" style="padding: 0.75rem 0; border-bottom: 1px solid #e2e8f0;">
                                        <div class="size-label" style="font-weight: 600; margin-bottom: 4px; color: #334155;">
                                            ${sizeList} <span style="color: #64748b; font-weight: 400;">(${totalQty} total)</span>
                                        </div>
                                        <div class="price-calculation" style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; font-size: 0.95rem;">
                                            <span class="base-price" style="color: #0f172a; font-weight: 500;">$${group.basePrice.toFixed(2)}</span>
                                            ${hasLTM ? `
                                                <span class="price-plus" style="color: #94a3b8;">+</span>
                                                <span class="small-batch-fee" style="color: #f97316; font-weight: 500;">$${group.ltmPerUnit.toFixed(2)} Small Batch Fee</span>
                                            ` : ''}
                                            <span class="price-equals" style="color: #94a3b8;">=</span>
                                            <span class="unit-total" style="font-weight: 700; color: white; background: #059669; padding: 0.375rem 1rem; border-radius: 8px; font-size: 0.95rem; box-shadow: 0 1px 3px rgba(5, 150, 105, 0.3);">$${group.unitPrice.toFixed(2)}/pc</span>
                                            <span class="size-subtotal" style="color: #4cb354; font-weight: 600; margin-left: auto;">→ $${group.total.toFixed(2)} total</span>
                                        </div>
                                    </div>
                                `;
                            }).join('')}
                            </div>
                        </div>
                    </div>
                </div>
            `;
        });

        this.quoteItemsSummary.innerHTML = summaryHTML;

        // Update totals section
        this.summaryQuantity.textContent = `${totalQuantity} pieces`;
        this.summaryTier.textContent = quoteTotals.tier || 'Calculating...';
        this.summaryTotal.textContent = `$${quoteTotals.total.toFixed(2)}`;

        // Show LTM note if applicable
        if (quoteTotals.hasLTM) {
            this.summaryLtmNote.style.display = 'block';
            // Populate dynamic breakdown text using the actual ltmPerUnit from pricing calculations
            const ltmBreakdownText = document.getElementById('ltm-breakdown-text');
            if (ltmBreakdownText) {
                // Use the actual ltmPerUnit from pricing calculations (already rounded with Math.floor)
                const firstProduct = quoteTotals.products[0];
                const ltmPerPiece = firstProduct?.pricing?.ltmPerUnit || 0;
                ltmBreakdownText.textContent = `$${quoteTotals.ltmFee.toFixed(2)} total fee ÷ ${totalQuantity} ${totalQuantity === 1 ? 'shirt' : 'shirts'} = $${ltmPerPiece.toFixed(2)} per shirt`;
            }
        } else {
            this.summaryLtmNote.style.display = 'none';
        }
        
        // Store current quote data
        this.currentQuoteData = {
            quoteId: quoteId,
            products: quoteTotals.products,
            totalQuantity: totalQuantity,
            subtotal: quoteTotals.subtotal,
            ltmFee: quoteTotals.ltmFee,
            total: quoteTotals.total,
            tier: quoteTotals.tier,
            hasLTM: quoteTotals.hasLTM,
            location: this.selectedLocation,
            locationName: this.selectedLocationName,
            expiryDate: expiryDate
        };
    }
    
    /**
     * Update quote summary when customer info changes
     */
    updateQuoteSummary() {
        // This is called when customer info changes
        // Could be used to update display in real-time
    }
    
    /**
     * Save quote
     */
    async saveQuote() {
        // Validate required fields
        if (!this.validateForm()) {
            return;
        }

        this.showLoading();

        try {
            // Build complete quote data
            // Use products from currentQuoteData which have the sizeGroups from pricing calculation
            const quoteData = {
                ...this.currentQuoteData,
                customerName: this.customerName.value.trim(),
                customerEmail: this.customerEmail.value.trim(),
                companyName: this.companyName.value.trim(),
                customerPhone: this.customerPhone.value.trim(),
                projectName: this.projectName.value.trim(),
                specialNotes: this.specialNotes.value.trim(),
                salesRep: this.salesRep.value,
                salesRepName: this.getSalesRepName(this.salesRep.value)
                // Don't override products - use the ones from currentQuoteData which have sizeGroups
            };

            // Save to database
            const saveResult = await this.quoteService.saveQuote(quoteData);

            if (saveResult.success) {
                console.log('[DTGQuoteBuilder] ✅ Quote saved successfully:', saveResult.quoteID);

                // Show success modal with real quote ID
                this.showSuccessModal(saveResult.quoteID, quoteData);

                // Store for print functionality
                this.lastSavedQuote = quoteData;
                this.lastSavedQuote.quoteId = saveResult.quoteID;
            } else {
                throw new Error(saveResult.error || 'Failed to save quote');
            }

        } catch (error) {
            console.error('[DTGQuoteBuilder] Error saving quote:', error);
            alert('Error saving quote: ' + (error.message || 'Please try again.'));
        } finally {
            this.hideLoading();
        }
    }
    
    /**
     * Validate form
     */
    validateForm() {
        const errors = [];
        
        if (!this.customerName.value.trim()) {
            errors.push('Customer name is required');
        }
        
        if (!this.customerEmail.value.trim()) {
            errors.push('Customer email is required');
        } else if (!this.validateEmail(this.customerEmail.value)) {
            errors.push('Please enter a valid email address');
        }
        
        if (!this.salesRep.value) {
            errors.push('Please select a sales representative');
        }
        
        if (errors.length > 0) {
            alert(errors.join('\n'));
            return false;
        }
        
        return true;
    }
    
    /**
     * Validate email format
     */
    validateEmail(email) {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    }
    
    /**
     * Get sales rep name from email
     */
    getSalesRepName(email) {
        const reps = {
            'sales@nwcustomapparel.com': 'Northwest Custom Apparel Sales Team',
            'ruth@nwcustomapparel.com': 'Ruth Nhong',
            'taylar@nwcustomapparel.com': 'Taylar Hanson',
            'nika@nwcustomapparel.com': 'Nika Lao',
            'taneisha@nwcustomapparel.com': 'Taneisha Clark',
            'erik@nwcustomapparel.com': 'Erik Mickelson',
            'adriyella@nwcustomapparel.com': 'Adriyella',
            'bradley@nwcustomapparel.com': 'Bradley Wright',
            'jim@nwcustomapparel.com': 'Jim Mickelson',
            'art@nwcustomapparel.com': 'Steve Deland'
        };
        
        return reps[email] || 'Sales Team';
    }
    
    /**
     * Show success modal
     */
    showSuccessModal(quoteId, quoteData) {
        this.modalQuoteId.textContent = quoteId;
        this.modalCustomer.textContent = quoteData.customerName;
        this.modalTotal.textContent = `$${quoteData.total.toFixed(2)}`;
        
        this.successModal.style.display = 'flex';
        this.printQuoteBtn.style.display = 'inline-block';
    }
    
    /**
     * Print quote
     */
    printQuote() {
        if (!this.lastSavedQuote) {
            alert('No quote available to print');
            return;
        }
        
        const printWindow = window.open('', '_blank');
        const quoteHTML = this.generatePrintHTML(this.lastSavedQuote);
        
        printWindow.document.write(quoteHTML);
        printWindow.document.close();
    }
    
    /**
     * Generate print HTML
     */
    generatePrintHTML(quoteData) {
        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + 30);
        
        let itemsHTML = '';
        quoteData.products.forEach(product => {
            const display = this.productsManager.formatProductDisplay(product);
            
            itemsHTML += `
                <div class="print-item">
                    <h4>${display.title}</h4>
                    <p>Color: ${display.color}</p>
                    <p>Sizes: ${display.sizes}</p>
                    <p>Quantity: ${display.quantity} pieces</p>
                </div>
            `;
        });
        
        return `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Quote ${quoteData.quoteId}</title>
                <style>
                    body {
                        font-family: Arial, sans-serif;
                        max-width: 800px;
                        margin: 0 auto;
                        padding: 20px;
                    }
                    .header {
                        text-align: center;
                        margin-bottom: 30px;
                    }
                    .logo {
                        max-width: 200px;
                        margin-bottom: 20px;
                    }
                    .quote-info {
                        margin-bottom: 30px;
                    }
                    .quote-info h2 {
                        color: #4cb354;
                        margin-bottom: 10px;
                    }
                    .customer-info {
                        background: #f5f5f5;
                        padding: 15px;
                        margin-bottom: 20px;
                    }
                    .print-location {
                        background: #e8f5e9;
                        padding: 10px;
                        margin-bottom: 20px;
                        border-left: 4px solid #4cb354;
                    }
                    .print-item {
                        border-bottom: 1px solid #ddd;
                        padding: 15px 0;
                    }
                    .totals {
                        margin-top: 20px;
                        text-align: right;
                    }
                    .grand-total {
                        font-size: 1.2em;
                        font-weight: bold;
                        color: #4cb354;
                    }
                    .ltm-note {
                        font-style: italic;
                        color: #666;
                        margin-top: 10px;
                    }
                    .footer {
                        margin-top: 40px;
                        padding-top: 20px;
                        border-top: 2px solid #4cb354;
                        text-align: center;
                    }
                    @media print {
                        body { margin: 0; }
                        .no-print { display: none; }
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <img src="https://cdn.caspio.com/A0E15000/Safety%20Stripes/web%20northwest%20custom%20apparel%20logo.png?ver=1" 
                         alt="Northwest Custom Apparel" class="logo">
                    <h1>DTG Print Quote</h1>
                </div>
                
                <div class="quote-info">
                    <h2>Quote #${quoteData.quoteId}</h2>
                    <p>Date: ${new Date().toLocaleDateString()}</p>
                    <p>Valid Until: ${expiryDate.toLocaleDateString()}</p>
                </div>
                
                <div class="customer-info">
                    <h3>Customer Information</h3>
                    <p><strong>Name:</strong> ${quoteData.customerName}</p>
                    <p><strong>Email:</strong> ${quoteData.customerEmail}</p>
                    ${quoteData.companyName ? `<p><strong>Company:</strong> ${quoteData.companyName}</p>` : ''}
                    ${quoteData.customerPhone ? `<p><strong>Phone:</strong> ${quoteData.customerPhone}</p>` : ''}
                    ${quoteData.projectName ? `<p><strong>Project:</strong> ${quoteData.projectName}</p>` : ''}
                </div>
                
                <div class="print-location">
                    <strong>Print Location:</strong> ${quoteData.locationName}
                </div>
                
                <h3>Products</h3>
                ${itemsHTML}
                
                <div class="totals">
                    <p>Total Quantity: ${quoteData.totalQuantity} pieces</p>
                    <p>Pricing Tier: ${quoteData.tier}</p>
                    <p class="grand-total">Grand Total: $${quoteData.total.toFixed(2)}</p>
                    ${quoteData.hasLTM ? '<p class="ltm-note">*Orders under 24 pieces include a small batch fee</p>' : ''}
                </div>
                
                ${quoteData.specialNotes ? `
                    <div class="notes">
                        <h3>Special Notes</h3>
                        <p>${quoteData.specialNotes}</p>
                    </div>
                ` : ''}
                
                <div class="footer">
                    <p><strong>Sales Representative:</strong> ${quoteData.salesRepName}</p>
                    <p>Email: ${quoteData.salesRep} | Phone: 253-922-5793</p>
                    <p>Northwest Custom Apparel | Established 1977</p>
                </div>
                
                <script>
                    window.onload = () => {
                        window.print();
                        setTimeout(() => window.close(), 500);
                    };
                <\/script>
            </body>
            </html>
        `;
    }
    
    /**
     * Show loading overlay
     */
    showLoading() {
        this.loadingOverlay.style.display = 'flex';
    }
    
    /**
     * Hide loading overlay
     */
    hideLoading() {
        this.loadingOverlay.style.display = 'none';
    }
}

// Global functions for HTML onclick handlers
function copyQuoteId() {
    const quoteId = document.getElementById('modal-quote-id').textContent;
    navigator.clipboard.writeText(quoteId).then(() => {
        alert('Quote ID copied to clipboard!');
    });
}

function printQuote() {
    if (window.dtgQuoteBuilder) {
        window.dtgQuoteBuilder.printQuote();
    }
}

function createNewQuote() {
    // Reload page to start fresh
    window.location.reload();
}

function removeProductFromQuote(productId) {
    if (window.dtgQuoteBuilder) {
        window.dtgQuoteBuilder.productsManager.removeProduct(productId);
        window.dtgQuoteBuilder.updateProductsList();
    }
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    window.dtgQuoteBuilder = new DTGQuoteBuilder();
    console.log('===================================');
    console.log('🚀 DTG Quote Builder Initialized');
    console.log('📦 Ready to create DTG quotes');
    console.log('===================================');
});