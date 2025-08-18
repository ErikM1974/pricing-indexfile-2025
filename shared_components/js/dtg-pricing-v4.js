/**
 * DTG Pricing v4 - Simplified Single-Page Experience
 * Instant pricing with popular locations and expandable options
 */

(function() {
    'use strict';

    console.log('[DTG-v4] Initializing simplified DTG pricing interface');

    // Configuration
    const DTG_LOCATIONS = {
        'LC': {
            name: 'Left Chest',
            size: '4" × 4"',
            image: 'https://cdn.caspio.com/A0E15000/Safety%20Stripes/dtg-location-left-chest-png.png?ver=1',
            isPopular: true,
            displayOrder: 1
        },
        'FF': {
            name: 'Full Front',
            size: '12" × 16"',
            image: 'https://cdn.caspio.com/A0E15000/Safety%20Stripes/dtg-location-full-front.png.png?ver=1',
            isPopular: true,
            displayOrder: 2
        },
        'LC_FB': {
            name: 'Left Chest + Full Back',
            size: '4"×4" + 12"×16"',
            image: 'https://cdn.caspio.com/A0E15000/Safety%20Stripes/dtg-location-combo-lc-fb.png?ver=1',
            isPopular: true,
            displayOrder: 3,
            isCombo: true
        },
        'FB': {
            name: 'Full Back',
            size: '12" × 16"',
            image: 'https://c3eku948.caspio.com/dp/a0e150004df4984fb1ef4d30b01a/files/9037959',
            isPopular: false,
            displayOrder: 4
        },
        'JF': {
            name: 'Jumbo Front',
            size: '16" × 20"',
            image: 'https://cdn.caspio.com/A0E15000/Safety%20Stripes/dtg-location-jumbo-front.png?ver=1',
            isPopular: false,
            displayOrder: 5
        },
        'JB': {
            name: 'Jumbo Back',
            size: '16" × 20"',
            image: 'https://cdn.caspio.com/A0E15000/Safety%20Stripes/dtg-location-Jumbo-back.png.png?ver=1',
            isPopular: false,
            displayOrder: 6
        },
        'LC_JB': {
            name: 'Left Chest + Jumbo Back',
            size: '4"×4" + 16"×20"',
            image: 'https://cdn.caspio.com/A0E15000/Safety%20Stripes/dtg-location-combo-lc-jb.png?ver=1',
            isPopular: false,
            displayOrder: 7,
            isCombo: true
        },
        'FF_FB': {
            name: 'Full Front + Full Back',
            size: '12"×16" + 12"×16"',
            image: 'https://c3eku948.caspio.com/dp/a0e150004df4984fb1ef4d30b01a/files/9037971',
            isPopular: false,
            displayOrder: 8,
            isCombo: true
        },
        'JF_JB': {
            name: 'Jumbo Front + Back',
            size: '16"×20" + 16"×20"',
            image: 'https://c3eku948.caspio.com/dp/a0e150004df4984fb1ef4d30b01a/files/9037968',
            isPopular: false,
            displayOrder: 9,
            isCombo: true
        }
    };

    // State management
    let state = {
        selectedLocation: 'LC',
        quantity: 24,
        showAllLocations: false,
        isInitialized: false
    };
    
    // New Direct API Service instance (for migration)
    let directAPIService = null;
    let directAPIData = null;

    // Wait for DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        initialize();
    }

    function initialize() {
        console.log('[DTG-v4] DOM ready, initializing components');
        
        // Check if we should use the new Direct API system
        if (window.USE_DIRECT_API) {
            console.log('[DTG-v4] 🚀 Using NEW Direct API System');
            initializeDirectAPI();
        } else {
            console.log('[DTG-v4] Using OLD Master Bundle System');
        }
        
        // Inject the simplified UI structure
        injectUIStructure();
        
        // Setup event listeners
        setupEventListeners();
        
        // Initialize with default values
        updatePricing();
        
        state.isInitialized = true;
        
        // Trigger initial pricing load
        setTimeout(() => {
            if (window.USE_DIRECT_API) {
                // New system: Load pricing directly
                loadDirectAPIPricing();
            } else {
                // Old system: Use adapter
                if (window.DTGAdapter && window.DTGAdapter.displayPricingForSelectedLocation) {
                    window.DTGAdapter.displayPricingForSelectedLocation(state.selectedLocation);
                }
            }
            
            // Trigger initial quantity change event for tier highlighting after pricing data loads
            setTimeout(() => {
                console.log('[DTG-v4] Dispatching initial quantityChanged event with default quantity:', state.quantity);
                window.dispatchEvent(new CustomEvent('quantityChanged', {
                    detail: { totalQuantity: state.quantity }
                }));
            }, 2000); // Wait for pricing data to load
        }, 500);
    }

    function injectUIStructure() {
        const container = document.querySelector('.pricing-content-wrapper');
        if (!container) {
            console.error('[DTG-v4] Could not find .pricing-content-wrapper container');
            return;
        }

        // Hide existing elements
        const existingElements = container.querySelectorAll('.dtg-steps-container, #quick-quote-container');
        existingElements.forEach(el => el.style.display = 'none');

        // Create new simplified structure
        const html = `
            <div class="dtg-v4-container">
                <!-- Quantity and Price Section -->
                <div class="dtg-pricing-header">
                    <div class="quantity-section">
                        <label class="quantity-label">Quantity:</label>
                        <div class="quantity-controls">
                            <button class="quantity-btn" id="dtg-decrease">−</button>
                            <input type="number" class="quantity-input" id="dtg-quantity" value="24" min="1">
                            <button class="quantity-btn" id="dtg-increase">+</button>
                        </div>
                    </div>
                    
                    <div class="price-display-section">
                        <div class="price-per-unit">
                            <span class="price-value" id="dtg-unit-price">$0.00</span>
                            <span class="price-label">per shirt</span>
                        </div>
                        <div class="total-price" id="dtg-total-price">Total: $0.00</div>
                    </div>
                </div>

                <!-- Location Selection -->
                <div class="location-selection-section">
                    <h3 class="section-title">Select Print Location</h3>
                    
                    <!-- Popular Locations -->
                    <div class="popular-locations" id="popular-locations">
                        <!-- Popular location cards will be inserted here -->
                    </div>
                    
                    <!-- Show More Button -->
                    <button class="show-more-btn" id="show-more-locations">
                        <span class="show-text">Show More Locations</span>
                        <span class="hide-text" style="display: none;">Show Less</span>
                        <i class="fas fa-chevron-down"></i>
                    </button>
                    
                    <!-- Additional Locations -->
                    <div class="additional-locations" id="additional-locations" style="display: none;">
                        <!-- Additional location cards will be inserted here -->
                    </div>
                </div>

                <!-- Pricing Breakdown -->
                <div class="pricing-breakdown-section" id="pricing-breakdown">
                    <div class="breakdown-content">
                        <div class="breakdown-item">
                            <span class="breakdown-label">Base price:</span>
                            <span class="breakdown-value" id="base-price-display">$0.00</span>
                        </div>
                        <div class="breakdown-item">
                            <span class="breakdown-label">Print location:</span>
                            <span class="breakdown-value" id="location-display">Left Chest</span>
                        </div>
                        <div class="ltm-fee-item" id="ltm-fee-display" style="display: none;">
                            <span class="breakdown-label">LTM (less than minimum) fee (under 24):</span>
                            <span class="breakdown-value" id="ltm-fee-value">+$0.00</span>
                        </div>
                    </div>
                </div>

                <!-- Product Recommendations (Collapsible) -->
                <div class="product-recommendations-toggle">
                    <button class="recommendations-btn" id="toggle-recommendations">
                        <i class="fas fa-info-circle"></i>
                        <span>View DTG Product Recommendations</span>
                    </button>
                </div>

                <!-- Full Pricing Table -->
                <div class="pricing-table-section">
                    <h3>Complete Pricing Reference</h3>
                    <div id="pricing-grid-container">
                        <!-- Universal pricing grid will populate this -->
                    </div>
                </div>
            </div>
        `;

        // Insert the new structure
        const pricingGrid = document.getElementById('pricing-grid-container');
        if (pricingGrid) {
            pricingGrid.insertAdjacentHTML('beforebegin', html);
        } else {
            container.insertAdjacentHTML('beforeend', html);
        }

        // Add styles
        addStyles();
        
        // Populate location cards
        populateLocationCards();
    }

    function addStyles() {
        const style = document.createElement('style');
        style.textContent = `
            /* DTG v4 Container */
            .dtg-v4-container {
                max-width: 1200px;
                margin: 0 auto;
            }

            /* Pricing Header */
            .dtg-pricing-header {
                background: white;
                border-radius: 12px;
                padding: 24px;
                margin-bottom: 24px;
                box-shadow: 0 2px 8px rgba(0,0,0,0.08);
                display: flex;
                justify-content: space-between;
                align-items: center;
                flex-wrap: wrap;
                gap: 24px;
            }

            /* Quantity Section */
            .quantity-section {
                display: flex;
                align-items: center;
                gap: 16px;
                flex-wrap: wrap;
            }

            .quantity-label {
                font-size: 16px;
                font-weight: 600;
                color: #333;
            }

            .quantity-controls {
                display: flex;
                align-items: center;
                gap: 0;
                background: #f5f5f5;
                border-radius: 8px;
                overflow: hidden;
            }

            .quantity-btn {
                width: 40px;
                height: 40px;
                border: none;
                background: transparent;
                font-size: 20px;
                cursor: pointer;
                transition: all 0.2s;
                color: #2e5827;
            }

            .quantity-btn:hover {
                background: #e8f5e9;
            }

            .quantity-input {
                width: 80px;
                height: 40px;
                border: none;
                text-align: center;
                font-size: 18px;
                font-weight: 600;
                background: transparent;
            }

            .quantity-input:focus {
                outline: none;
            }

            /* Quick select buttons removed - cleaner interface */

            /* Price Display */
            .price-display-section {
                text-align: right;
            }

            .price-per-unit {
                display: flex;
                align-items: baseline;
                gap: 8px;
                justify-content: flex-end;
            }

            .price-value {
                font-size: 36px;
                font-weight: bold;
                color: #2e5827;
            }

            .price-label {
                font-size: 16px;
                color: #666;
            }

            .total-price {
                font-size: 18px;
                color: #333;
                margin-top: 4px;
            }

            /* Location Selection */
            .location-selection-section {
                background: white;
                border-radius: 12px;
                padding: 24px;
                margin-bottom: 24px;
                box-shadow: 0 2px 8px rgba(0,0,0,0.08);
            }

            .section-title {
                font-size: 20px;
                font-weight: 600;
                color: #333;
                margin-bottom: 20px;
            }

            .popular-locations,
            .additional-locations {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                gap: 16px;
                margin-bottom: 20px;
            }

            .location-card {
                position: relative;
                cursor: pointer;
            }

            .location-card input[type="radio"] {
                position: absolute;
                opacity: 0;
            }

            .location-content {
                border: 2px solid #e0e0e0;
                border-radius: 10px;
                padding: 0;
                transition: all 0.3s ease;
                overflow: hidden;
                background: white;
            }

            .location-card:hover .location-content {
                border-color: #2e5827;
                transform: translateY(-2px);
                box-shadow: 0 4px 12px rgba(46, 88, 39, 0.15);
            }

            .location-card input[type="radio"]:checked + .location-content {
                border-color: #2e5827;
                background: #f8fcf9;
            }

            .location-card input[type="radio"]:checked + .location-content::after {
                content: '✓';
                position: absolute;
                top: 8px;
                right: 8px;
                width: 24px;
                height: 24px;
                background: #2e5827;
                color: white;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                font-weight: bold;
            }

            .location-image {
                width: 100%;
                height: 140px;
                background: #fafafa;
                display: flex;
                align-items: center;
                justify-content: center;
                overflow: hidden;
            }

            .location-image img {
                width: 100%;
                height: 100%;
                object-fit: contain;
                padding: 10px;
            }

            .location-info {
                padding: 12px;
                text-align: center;
            }

            .location-name {
                font-weight: 600;
                font-size: 14px;
                margin-bottom: 4px;
            }

            .location-size {
                font-size: 12px;
                color: #666;
                margin-bottom: 8px;
            }

            .location-price {
                font-size: 18px;
                font-weight: bold;
                color: #2e5827;
            }

            /* Show More Button */
            .show-more-btn {
                width: 100%;
                padding: 12px;
                border: 1px solid #e0e0e0;
                background: white;
                border-radius: 8px;
                font-size: 14px;
                color: #666;
                cursor: pointer;
                transition: all 0.2s;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 8px;
            }

            .show-more-btn:hover {
                background: #f8f9fa;
                border-color: #2e5827;
                color: #2e5827;
            }

            .show-more-btn i {
                transition: transform 0.3s;
            }

            .show-more-btn.expanded i {
                transform: rotate(180deg);
            }

            /* Pricing Breakdown */
            .pricing-breakdown-section {
                background: #f8fcf9;
                border: 1px solid #e1ece2;
                border-radius: 8px;
                padding: 16px 20px;
                margin-bottom: 24px;
            }

            .breakdown-content {
                display: flex;
                flex-wrap: wrap;
                gap: 24px;
                justify-content: space-between;
            }

            .breakdown-item,
            .ltm-fee-item {
                display: flex;
                align-items: center;
                gap: 8px;
            }

            .breakdown-label {
                font-size: 14px;
                color: #666;
            }

            .breakdown-value {
                font-size: 14px;
                font-weight: 600;
                color: #333;
            }

            .ltm-fee-item .breakdown-value {
                color: #e67e22;
            }

            /* Product Recommendations Toggle */
            .product-recommendations-toggle {
                margin-bottom: 24px;
            }

            .recommendations-btn {
                padding: 10px 16px;
                border: 1px solid #e0e0e0;
                background: white;
                border-radius: 8px;
                font-size: 14px;
                color: #666;
                cursor: pointer;
                transition: all 0.2s;
                display: flex;
                align-items: center;
                gap: 8px;
            }

            .recommendations-btn:hover {
                background: #f8f9fa;
                border-color: #2e5827;
                color: #2e5827;
            }

            /* Pricing Table Section */
            .pricing-table-section {
                background: white;
                border-radius: 12px;
                padding: 24px;
                box-shadow: 0 2px 8px rgba(0,0,0,0.08);
            }

            .pricing-table-section h3 {
                font-size: 20px;
                font-weight: 600;
                color: #333;
                margin-bottom: 20px;
                text-align: center;
            }

            /* Combo Badge */
            .combo-badge {
                position: absolute;
                top: 8px;
                left: 8px;
                background: #ff9800;
                color: white;
                padding: 4px 10px;
                border-radius: 16px;
                font-size: 10px;
                font-weight: 600;
                text-transform: uppercase;
                letter-spacing: 0.5px;
                z-index: 1;
            }

            /* Mobile Responsive */
            @media (max-width: 768px) {
                .dtg-pricing-header {
                    flex-direction: column;
                    text-align: center;
                }

                .price-display-section {
                    text-align: center;
                }

                .price-per-unit {
                    justify-content: center;
                }

                .popular-locations,
                .additional-locations {
                    grid-template-columns: 1fr;
                }

                .breakdown-content {
                    flex-direction: column;
                    gap: 12px;
                }
            }
        `;
        document.head.appendChild(style);
    }

    function populateLocationCards() {
        const popularContainer = document.getElementById('popular-locations');
        const additionalContainer = document.getElementById('additional-locations');
        
        if (!popularContainer || !additionalContainer) return;

        // Sort locations by display order
        const sortedLocations = Object.entries(DTG_LOCATIONS).sort((a, b) => 
            a[1].displayOrder - b[1].displayOrder
        );

        sortedLocations.forEach(([code, location]) => {
            const card = createLocationCard(code, location);
            if (location.isPopular) {
                popularContainer.appendChild(card);
            } else {
                additionalContainer.appendChild(card);
            }
        });

        // Select first location by default
        const firstRadio = popularContainer.querySelector('input[type="radio"]');
        if (firstRadio) {
            firstRadio.checked = true;
        }
    }

    function createLocationCard(code, location) {
        const label = document.createElement('label');
        label.className = 'location-card';
        label.dataset.location = code;

        const badgeHTML = location.isCombo ? 
            '<span class="combo-badge">COMBO</span>' : '';

        label.innerHTML = `
            <input type="radio" name="dtg-location" value="${code}" ${code === state.selectedLocation ? 'checked' : ''}>
            <div class="location-content">
                ${badgeHTML}
                <div class="location-image">
                    <img src="${location.image}" alt="${location.name}">
                </div>
                <div class="location-info">
                    <div class="location-name">${location.name}</div>
                    <div class="location-size">${location.size}</div>
                    <div class="location-price" id="price-${code}">$0.00</div>
                </div>
            </div>
        `;

        return label;
    }

    function setupEventListeners() {
        // Quantity controls
        const decreaseBtn = document.getElementById('dtg-decrease');
        const increaseBtn = document.getElementById('dtg-increase');
        const quantityInput = document.getElementById('dtg-quantity');

        if (decreaseBtn) {
            decreaseBtn.addEventListener('click', () => {
                const current = parseInt(quantityInput.value) || 1;
                if (current > 1) {
                    quantityInput.value = current - 1;
                    handleQuantityChange(current - 1);
                }
            });
        }

        if (increaseBtn) {
            increaseBtn.addEventListener('click', () => {
                const current = parseInt(quantityInput.value) || 1;
                quantityInput.value = current + 1;
                handleQuantityChange(current + 1);
            });
        }

        if (quantityInput) {
            quantityInput.addEventListener('change', (e) => {
                const value = parseInt(e.target.value) || 1;
                if (value < 1) {
                    e.target.value = 1;
                    handleQuantityChange(1);
                } else {
                    handleQuantityChange(value);
                }
            });
        }

        // Quick quantity buttons removed - no longer needed

        // Location selection
        document.addEventListener('change', (e) => {
            if (e.target.name === 'dtg-location') {
                handleLocationSelection(e.target.value);
            }
        });

        // Show more locations
        const showMoreBtn = document.getElementById('show-more-locations');
        if (showMoreBtn) {
            showMoreBtn.addEventListener('click', () => {
                state.showAllLocations = !state.showAllLocations;
                const additionalLocations = document.getElementById('additional-locations');
                const showText = showMoreBtn.querySelector('.show-text');
                const hideText = showMoreBtn.querySelector('.hide-text');
                
                if (state.showAllLocations) {
                    additionalLocations.style.display = 'grid';
                    showText.style.display = 'none';
                    hideText.style.display = 'inline';
                    showMoreBtn.classList.add('expanded');
                } else {
                    additionalLocations.style.display = 'none';
                    showText.style.display = 'inline';
                    hideText.style.display = 'none';
                    showMoreBtn.classList.remove('expanded');
                }
            });
        }

        // Product recommendations toggle
        const toggleRecommendations = document.getElementById('toggle-recommendations');
        if (toggleRecommendations) {
            toggleRecommendations.addEventListener('click', () => {
                // This will be handled by the existing recommendations component
                const event = new CustomEvent('toggleDTGRecommendations');
                window.dispatchEvent(event);
            });
        }

        // Listen for pricing data updates
        window.addEventListener('pricingDataLoaded', handlePricingDataLoaded);
        
        // Also listen for master bundle ready event from BaseAdapter
        window.addEventListener('dtgMasterBundleReady', (event) => {
            console.log('[DTG-v4] Master bundle ready event received');
            // Give a small delay to ensure window.dtgMasterPriceBundle is set
            setTimeout(() => {
                updatePricing();
                updateLocationPrices();
            }, 100);
        });
    }

    function handleQuantityChange(quantity) {
        console.log('[DTG-v4] Quantity changed:', quantity);
        state.quantity = quantity;

        // Update quick select active state
        document.querySelectorAll('.quick-qty').forEach(btn => {
            btn.classList.toggle('active', parseInt(btn.dataset.qty) === quantity);
        });

        // Dispatch event for other components
        window.dispatchEvent(new CustomEvent('quantityChanged', {
            detail: { totalQuantity: quantity }
        }));

        // Update pricing
        updatePricing();
        updateLocationPrices();
    }

    function handleLocationSelection(locationCode) {
        console.log('[DTG-v4] Location selected:', locationCode);
        state.selectedLocation = locationCode;

        // Trigger DTG adapter to load pricing
        if (window.DTGAdapter && window.DTGAdapter.displayPricingForSelectedLocation) {
            window.DTGAdapter.displayPricingForSelectedLocation(locationCode);
        }

        // Update pricing display
        updatePricing();
    }

    function handlePricingDataLoaded(event) {
        console.log('[DTG-v4] Pricing data loaded:', event.detail);
        
        // Update all pricing displays
        updatePricing();
        updateLocationPrices();
    }

    function updatePricing() {
        const unitPriceEl = document.getElementById('dtg-unit-price');
        const totalPriceEl = document.getElementById('dtg-total-price');
        const basePriceEl = document.getElementById('base-price-display');
        const locationEl = document.getElementById('location-display');
        const ltmFeeEl = document.getElementById('ltm-fee-display');
        const ltmValueEl = document.getElementById('ltm-fee-value');

        if (!unitPriceEl || !totalPriceEl) return;

        // Get pricing from master bundle
        if (window.dtgMasterPriceBundle && window.dtgMasterPriceBundle.allLocationPrices) {
            console.log('[DTG-v4] Master bundle found, updating pricing display');
            const allLocationPrices = window.dtgMasterPriceBundle.allLocationPrices;
            const tier = getPriceTier(state.quantity);
            let basePrice = 0;
            
            if (allLocationPrices[state.selectedLocation]) {
                const locationPrices = allLocationPrices[state.selectedLocation];
                if (locationPrices['S'] && locationPrices['S'][tier] !== undefined) {
                    basePrice = parseFloat(locationPrices['S'][tier]);
                }
            }
            
            if (basePrice > 0) {
                let totalPrice = basePrice * state.quantity;
                let ltmFeePerUnit = 0;
                
                // Apply LTM fee if under 24
                if (state.quantity < 24) {
                    ltmFeePerUnit = 50 / state.quantity;
                    totalPrice += 50;
                }
                
                const displayPrice = basePrice + ltmFeePerUnit;
                
                // Update displays
                unitPriceEl.textContent = `$${displayPrice.toFixed(2)}`;
                totalPriceEl.textContent = `Total: $${totalPrice.toFixed(2)}`;
                
                if (basePriceEl) {
                    basePriceEl.textContent = `$${basePrice.toFixed(2)}`;
                }
                
                if (locationEl && DTG_LOCATIONS[state.selectedLocation]) {
                    locationEl.textContent = DTG_LOCATIONS[state.selectedLocation].name;
                }
                
                if (ltmFeeEl && ltmValueEl) {
                    if (state.quantity < 24) {
                        ltmFeeEl.style.display = 'flex';
                        ltmValueEl.textContent = `+$${ltmFeePerUnit.toFixed(2)}/shirt`;
                    } else {
                        ltmFeeEl.style.display = 'none';
                    }
                }
                
                // Update header if function exists
                if (typeof updateHeaderPricing === 'function') {
                    updateHeaderPricing(state.quantity, displayPrice);
                }
            } else {
                // No pricing available yet
                unitPriceEl.textContent = '$0.00';
                totalPriceEl.textContent = 'Total: $0.00';
            }
        } else {
            // No pricing data yet
            console.log('[DTG-v4] Master bundle not yet available, keeping Loading state');
            unitPriceEl.textContent = 'Loading...';
            totalPriceEl.textContent = '';
        }
    }

    function updateLocationPrices() {
        if (!window.dtgMasterPriceBundle || !window.dtgMasterPriceBundle.allLocationPrices) {
            return;
        }
        
        const allLocationPrices = window.dtgMasterPriceBundle.allLocationPrices;
        const tier = getPriceTier(state.quantity);
        
        Object.entries(DTG_LOCATIONS).forEach(([code, location]) => {
            const priceEl = document.getElementById(`price-${code}`);
            if (priceEl) {
                let basePrice = 0;
                
                if (allLocationPrices[code]) {
                    const locationPrices = allLocationPrices[code];
                    if (locationPrices['S'] && locationPrices['S'][tier] !== undefined) {
                        basePrice = parseFloat(locationPrices['S'][tier]);
                    }
                }
                
                // Add LTM fee if applicable
                if (state.quantity < 24 && basePrice > 0) {
                    basePrice += 50 / state.quantity;
                }
                
                if (basePrice > 0) {
                    priceEl.textContent = `$${basePrice.toFixed(2)}`;
                } else {
                    priceEl.textContent = '$0.00';
                }
            }
        });
    }

    function getPriceTier(quantity) {
        if (quantity < 24) return '24-47';
        if (quantity <= 47) return '24-47';
        if (quantity <= 71) return '48-71';
        return '72+';
    }

    // Update header pricing function
    function updateHeaderPricing(quantity, unitPrice) {
        const headerQty = document.getElementById('header-quantity');
        const headerPrice = document.getElementById('header-unit-price');
        
        if (headerQty) {
            headerQty.textContent = quantity;
        }
        
        if (headerPrice) {
            if (typeof unitPrice === 'number' && !isNaN(unitPrice)) {
                headerPrice.textContent = `$${unitPrice.toFixed(2)}`;
            } else {
                headerPrice.textContent = '$0.00';
            }
        }
    }

    // =================================================================
    // NEW DIRECT API SYSTEM FUNCTIONS (Phase 1 Migration)
    // =================================================================
    
    function initializeDirectAPI() {
        console.log('[DTG-v4 Direct API] Initializing Direct API Service');
        
        // Create service instance
        directAPIService = new window.DTGPricingService();
        
        // Get style and color from URL
        const params = new URLSearchParams(window.location.search);
        const styleNumber = params.get('StyleNumber');
        const color = params.get('COLOR') ? decodeURIComponent(params.get('COLOR').replace(/\+/g, ' ')) : null;
        
        console.log('[DTG-v4 Direct API] Product:', styleNumber, color);
        
        // Store in state for later use
        state.styleNumber = styleNumber;
        state.color = color;
    }
    
    async function loadDirectAPIPricing() {
        if (!directAPIService || !state.styleNumber) {
            console.error('[DTG-v4 Direct API] Service not initialized or no style number');
            return;
        }
        
        console.log('[DTG-v4 Direct API] Loading pricing data...');
        const startTime = performance.now();
        
        try {
            // Fetch all pricing data
            directAPIData = await directAPIService.fetchPricingData(state.styleNumber, state.color);
            
            const fetchTime = performance.now() - startTime;
            console.log(`[DTG-v4 Direct API] ✅ Data loaded in ${fetchTime.toFixed(0)}ms`);
            
            // Track performance metrics
            if (window.DTG_PERFORMANCE) {
                window.DTG_PERFORMANCE.metrics.apiLoadTime = fetchTime;
                window.DTG_PERFORMANCE.metrics.totalLoadTime = performance.now() - window.DTG_PERFORMANCE.loadStartTime;
                
                // Log performance summary
                console.log('📊 PERFORMANCE METRICS:');
                console.log(`  System: ${window.DTG_PERFORMANCE.systemUsed}`);
                console.log(`  API Load: ${fetchTime.toFixed(0)}ms`);
                console.log(`  Total Time: ${window.DTG_PERFORMANCE.metrics.totalLoadTime.toFixed(0)}ms`);
                
                // Compare to expected old system time
                const expectedOldTime = 2000; // Based on documentation
                const improvement = ((expectedOldTime - fetchTime) / expectedOldTime * 100).toFixed(1);
                console.log(`  Improvement: ${improvement}% faster than old system`);
            }
            
            // Build compatibility bundle for seamless integration
            const compatBundle = directAPIService.buildCompatibilityBundle(directAPIData, state.quantity);
            
            // Store it where the old system expects it
            window.dtgMasterPriceBundle = compatBundle;
            console.log('[DTG-v4 Direct API] Compatibility bundle stored in window.dtgMasterPriceBundle');
            
            // Compare with old system if both are loaded
            if (window.USE_DIRECT_API && window.dtgAdapter && window.dtgAdapter.masterBundle) {
                comparePricingSystems(compatBundle, window.dtgAdapter.masterBundle);
            }
            
            // Update pricing displays
            updatePricing();
            updateLocationPrices();
            
            // Dispatch event for other components
            window.dispatchEvent(new CustomEvent('directAPIPricingLoaded', {
                detail: compatBundle
            }));
            
        } catch (error) {
            console.error('[DTG-v4 Direct API] Failed to load pricing:', error);
            // Fall back to old system if available
            if (window.DTGAdapter && window.DTGAdapter.displayPricingForSelectedLocation) {
                console.log('[DTG-v4 Direct API] Falling back to old system');
                window.USE_DIRECT_API = false;
                window.DTGAdapter.displayPricingForSelectedLocation(state.selectedLocation);
            }
        }
    }
    
    function comparePricingSystems(newBundle, oldBundle) {
        console.log('=== PRICING COMPARISON ===');
        console.log('NEW System:', newBundle);
        console.log('OLD System:', oldBundle);
        
        // Compare specific location prices
        if (newBundle.allLocationPrices && oldBundle.allLocationPrices) {
            const location = 'LC';
            const size = 'M';
            const tier = '24-47';
            
            const newPrice = newBundle.allLocationPrices[location]?.[size]?.[tier];
            const oldPrice = oldBundle.allLocationPrices[location]?.[size]?.[tier];
            
            console.log(`Price for ${location}/${size}/${tier}:`);
            console.log(`  NEW: $${newPrice}`);
            console.log(`  OLD: $${oldPrice}`);
            
            if (newPrice !== oldPrice) {
                console.warn('⚠️ PRICE MISMATCH DETECTED!');
            } else {
                console.log('✅ Prices match!');
            }
        }
        
        console.log('=========================');
    }
    
    // Expose API for external access
    window.DTGPricingV4 = {
        getState: () => state,
        setLocation: (code) => {
            const radio = document.querySelector(`input[name="dtg-location"][value="${code}"]`);
            if (radio) {
                radio.checked = true;
                handleLocationSelection(code);
            }
        },
        setQuantity: (qty) => {
            const input = document.getElementById('dtg-quantity');
            if (input) {
                input.value = qty;
                handleQuantityChange(qty);
            }
        },
        // New Direct API methods for testing
        toggleSystem: () => {
            window.USE_DIRECT_API = !window.USE_DIRECT_API;
            console.log(`Switched to: ${window.USE_DIRECT_API ? 'NEW Direct API' : 'OLD Master Bundle'}`);
            console.log('Reload page to apply change');
            return window.USE_DIRECT_API;
        },
        getService: () => directAPIService,
        getData: () => directAPIData,
        reloadPricing: () => loadDirectAPIPricing()
    };

})();