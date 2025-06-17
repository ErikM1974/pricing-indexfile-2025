/**
 * DTG Pricing v3 - Visual Location Selector Implementation
 * Provides a 3-step interface with image-based location selection
 * Integrates with DTG Adapter for pricing data
 */

(function() {
    'use strict';

    console.log('[DTG-v3] Initializing DTG Pricing v3 with visual location selector');

    // Configuration
    const DTG_LOCATIONS = {
        'LC': {
            name: 'Left Chest',
            size: '4" × 4"',
            image: 'https://cdn.caspio.com/A0E15000/Safety%20Stripes/dtg-location-left-chest-png.png?ver=1',
            isCombo: false
        },
        'FF': {
            name: 'Full Front',
            size: '12" × 16"',
            image: 'https://cdn.caspio.com/A0E15000/Safety%20Stripes/dtg-location-full-front.png.png?ver=1',
            isCombo: false
        },
        'FB': {
            name: 'Full Back',
            size: '12" × 16"',
            image: 'https://c3eku948.caspio.com/dp/a0e150004df4984fb1ef4d30b01a/files/9037959',
            isCombo: false
        },
        'JF': {
            name: 'Jumbo Front',
            size: '16" × 20"',
            image: 'https://cdn.caspio.com/A0E15000/Safety%20Stripes/dtg-location-jumbo-front.png?ver=1',
            isCombo: false
        },
        'JB': {
            name: 'Jumbo Back',
            size: '16" × 20"',
            image: 'https://cdn.caspio.com/A0E15000/Safety%20Stripes/dtg-location-Jumbo-back.png.png?ver=1',
            isCombo: false
        },
        'LC_FB': {
            name: 'Left Chest + Full Back',
            size: '4"×4" + 12"×16"',
            image: 'https://cdn.caspio.com/A0E15000/Safety%20Stripes/dtg-location-combo-lc-fb.png?ver=1',
            isCombo: true,
            comboType: 'standard'
        },
        'LC_JB': {
            name: 'Left Chest + Jumbo Back',
            size: '4"×4" + 16"×20"',
            image: 'https://cdn.caspio.com/A0E15000/Safety%20Stripes/dtg-location-combo-lc-jb.png?ver=1',
            isCombo: true,
            comboType: 'standard'
        },
        'FF_FB': {
            name: 'Full Front + Full Back',
            size: '12"×16" + 12"×16"',
            image: 'https://c3eku948.caspio.com/dp/a0e150004df4984fb1ef4d30b01a/files/9037971',
            isCombo: true,
            comboType: 'standard'
        },
        'JF_JB': {
            name: 'Jumbo Front + Back',
            size: '16"×20" + 16"×20"',
            image: 'https://c3eku948.caspio.com/dp/a0e150004df4984fb1ef4d30b01a/files/9037968',
            isCombo: true,
            comboType: 'max'
        }
    };

    // State management
    let state = {
        selectedLocation: 'LC',
        quantity: 24,
        currentStep: 1,
        isInitialized: false
    };

    // Wait for DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        initialize();
    }

    function initialize() {
        console.log('[DTG-v3] DOM ready, initializing components');
        
        // Inject the 3-step UI structure
        injectUIStructure();
        
        // Setup event listeners
        setupEventListeners();
        
        // Initialize visual location selector
        initializeLocationSelector();
        
        // Update UI state
        updateStep(1);
        
        state.isInitialized = true;
        
        // Trigger initial location selection
        handleLocationSelection(state.selectedLocation);
    }

    function injectUIStructure() {
        const container = document.querySelector('.pricing-content-wrapper');
        if (!container) {
            console.error('[DTG-v3] Could not find .pricing-content-wrapper container');
            return;
        }

        // Hide existing elements that will be replaced
        const existingQuickQuote = document.getElementById('quick-quote-container');
        if (existingQuickQuote) {
            existingQuickQuote.style.display = 'none';
        }

        // Create new 3-step structure
        const stepsHTML = `
            <!-- DTG 3-Step Process -->
            <div class="dtg-steps-container">
                <!-- Progress Bar -->
                <div class="dtg-progress-bar">
                    <div class="progress-steps">
                        <div class="progress-line">
                            <div class="progress-line-fill"></div>
                        </div>
                        <div class="progress-step active" data-step="1">
                            <div class="step-number">1</div>
                            <div class="step-label">Select Location</div>
                        </div>
                        <div class="progress-step" data-step="2">
                            <div class="step-number">2</div>
                            <div class="step-label">Configure Quantity</div>
                        </div>
                        <div class="progress-step" data-step="3">
                            <div class="step-number">3</div>
                            <div class="step-label">View Pricing</div>
                        </div>
                    </div>
                </div>

                <!-- Step 1: Visual Location Selector -->
                <div class="step-section" id="dtg-step-1">
                    <div class="step-header">
                        <div class="step-number-large">1</div>
                        <h2 class="step-title">Select Your Print Location</h2>
                    </div>
                    
                    <div class="location-grid" id="location-grid">
                        <!-- Location cards will be inserted here -->
                    </div>
                </div>

                <!-- Step 2: Configure Quantity -->
                <div class="step-section inactive" id="dtg-step-2">
                    <div class="step-header">
                        <div class="step-number-large">2</div>
                        <h2 class="step-title">Configure Your Quantity</h2>
                    </div>
                    
                    <div class="quantity-section">
                        <div class="quantity-input-wrapper">
                            <button class="quantity-btn" id="dtg-decrease-btn">−</button>
                            <input type="number" class="quantity-input" id="dtg-quantity" value="24" min="1">
                            <button class="quantity-btn" id="dtg-increase-btn">+</button>
                            <span class="quantity-label">shirts</span>
                        </div>
                        
                        <!-- Quick select buttons -->
                        <div class="quick-select">
                            <span class="quick-select-label">Quick select:</span>
                            <div class="quick-select-grid">
                                <button class="quick-select-btn" data-quantity="12">1 Dozen</button>
                                <button class="quick-select-btn" data-quantity="24">2 Dozen</button>
                                <button class="quick-select-btn" data-quantity="36">3 Dozen</button>
                                <button class="quick-select-btn" data-quantity="48">4 Dozen</button>
                                <button class="quick-select-btn" data-quantity="72">6 Dozen</button>
                                <button class="quick-select-btn" data-quantity="144">12 Dozen</button>
                            </div>
                        </div>
                        
                        <!-- Instant Quote -->
                        <div class="instant-quote">
                            <div class="quote-header">Your Instant Quote</div>
                            <div class="pricing-display">
                                <div class="unit-price" id="dtg-unit-price">$0.00</div>
                                <div class="unit-label">per shirt (starting price)</div>
                                <div class="total-price" id="dtg-total-price">Total: $0.00</div>
                            </div>
                            
                            <div class="pricing-breakdown" id="dtg-pricing-breakdown">
                                <!-- Dynamic breakdown will be inserted here -->
                            </div>
                            
                            <div class="ltm-warning" id="dtg-ltm-warning" style="display: none;">
                                <span>⚠️</span>
                                <span>Orders under 24 shirts include a $50 setup fee</span>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Step 3: Pricing Grid -->
                <div class="step-section inactive" id="dtg-step-3">
                    <div class="step-header">
                        <div class="step-number-large">3</div>
                        <h2 class="step-title">Complete Price-Per-Unit Reference Grid</h2>
                    </div>
                    
                    <!-- Universal Pricing Grid will display here -->
                    <div id="pricing-grid-container">
                        <!-- Pricing grid populated by Universal Pricing Grid component -->
                    </div>
                </div>
            </div>
        `;

        // Insert before the pricing grid container
        const pricingGridContainer = document.getElementById('pricing-grid-container');
        if (pricingGridContainer) {
            pricingGridContainer.insertAdjacentHTML('beforebegin', stepsHTML);
        } else {
            container.insertAdjacentHTML('beforeend', stepsHTML);
        }

        // Add styles
        addStyles();
    }

    function addStyles() {
        const style = document.createElement('style');
        style.textContent = `
            /* DTG 3-Step Container */
            .dtg-steps-container {
                margin: 20px 0;
            }

            /* Progress Bar */
            .dtg-progress-bar {
                background: white;
                padding: 30px;
                border-radius: 12px;
                margin-bottom: 30px;
                box-shadow: 0 2px 10px rgba(0,0,0,0.08);
            }

            .progress-steps {
                display: flex;
                justify-content: space-between;
                position: relative;
                max-width: 600px;
                margin: 0 auto;
            }

            .progress-step {
                flex: 1;
                text-align: center;
                position: relative;
                z-index: 2;
            }

            .step-number {
                width: 40px;
                height: 40px;
                background: #e0e0e0;
                color: #999;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                margin: 0 auto 10px;
                font-weight: bold;
                font-size: 18px;
                transition: all 0.3s ease;
            }

            .progress-step.active .step-number {
                background: #2e5827;
                color: white;
                box-shadow: 0 0 0 4px rgba(46, 88, 39, 0.2);
            }

            .progress-step.completed .step-number {
                background: #2e5827;
                color: white;
            }

            .step-label {
                font-size: 14px;
                color: #666;
                font-weight: 500;
            }

            .progress-step.active .step-label {
                color: #2e5827;
                font-weight: 600;
            }

            /* Progress Line */
            .progress-line {
                position: absolute;
                top: 20px;
                left: 0;
                right: 0;
                height: 2px;
                background: #e0e0e0;
                z-index: 1;
            }

            .progress-line-fill {
                position: absolute;
                top: 0;
                left: 0;
                height: 100%;
                background: #2e5827;
                width: 0%;
                transition: width 0.5s ease;
            }

            /* Step Sections */
            .step-section {
                background: white;
                border-radius: 12px;
                padding: 40px;
                margin-bottom: 30px;
                box-shadow: 0 2px 10px rgba(0,0,0,0.08);
                transition: all 0.3s ease;
            }

            .step-section.inactive {
                opacity: 0.5;
                pointer-events: none;
            }

            .step-header {
                display: flex;
                align-items: center;
                gap: 15px;
                margin-bottom: 30px;
            }

            .step-number-large {
                width: 48px;
                height: 48px;
                background: #2e5827;
                color: white;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 24px;
                font-weight: bold;
            }

            .step-title {
                font-size: 28px;
                color: #333;
                margin: 0;
            }

            /* Location Grid */
            .location-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
                gap: 20px;
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
                border: 3px solid #e0e0e0;
                border-radius: 10px;
                padding: 0;
                transition: all 0.3s ease;
                overflow: hidden;
                background: white;
                height: 100%;
                display: flex;
                flex-direction: column;
            }

            .location-card:hover .location-content {
                border-color: #2e5827;
                transform: translateY(-2px);
                box-shadow: 0 6px 20px rgba(46, 88, 39, 0.15);
            }

            .location-card input[type="radio"]:checked + .location-content {
                border-color: #2e5827;
                background: #f8fcf9;
            }

            .location-card input[type="radio"]:checked + .location-content::before {
                content: '✓';
                position: absolute;
                top: 10px;
                right: 10px;
                width: 24px;
                height: 24px;
                background: #2e5827;
                color: white;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                font-weight: bold;
                z-index: 10;
                box-shadow: 0 2px 4px rgba(0,0,0,0.2);
            }

            .location-image {
                width: 100%;
                height: 180px;
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
                padding: 15px;
                text-align: center;
                background: white;
            }

            .location-name {
                font-weight: 600;
                margin-bottom: 5px;
                font-size: 16px;
            }

            .location-size {
                font-size: 14px;
                color: #666;
            }

            .combo-badge {
                position: absolute;
                top: 10px;
                left: 10px;
                background: #ff9800;
                color: white;
                padding: 4px 12px;
                border-radius: 20px;
                font-size: 11px;
                font-weight: 600;
                z-index: 5;
                text-transform: uppercase;
                letter-spacing: 0.5px;
                box-shadow: 0 2px 4px rgba(0,0,0,0.2);
            }

            .combo-badge.max {
                background: #e67e22;
            }

            /* Quantity Section */
            .quantity-section {
                text-align: center;
                max-width: 600px;
                margin: 0 auto;
            }

            .quantity-input-wrapper {
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 20px;
                margin: 30px 0;
            }

            .quantity-btn {
                width: 50px;
                height: 50px;
                border: 2px solid #2e5827;
                background: white;
                color: #2e5827;
                border-radius: 50%;
                font-size: 24px;
                cursor: pointer;
                transition: all 0.3s ease;
            }

            .quantity-btn:hover {
                background: #2e5827;
                color: white;
            }

            .quantity-input {
                width: 120px;
                height: 50px;
                text-align: center;
                font-size: 24px;
                border: 2px solid #e0e0e0;
                border-radius: 8px;
                font-weight: 600;
            }

            .quantity-input:focus {
                outline: none;
                border-color: #2e5827;
                box-shadow: 0 0 0 3px rgba(46, 88, 39, 0.1);
            }

            .quantity-label {
                font-size: 18px;
                color: #666;
                margin-left: 10px;
            }

            /* Quick Select */
            .quick-select {
                margin: 30px 0;
            }

            .quick-select-label {
                display: block;
                font-size: 14px;
                color: #666;
                margin-bottom: 10px;
            }

            .quick-select-grid {
                display: flex;
                gap: 10px;
                justify-content: center;
                flex-wrap: wrap;
            }

            .quick-select-btn {
                padding: 8px 16px;
                border: 1px solid #ddd;
                background: white;
                border-radius: 20px;
                font-size: 14px;
                cursor: pointer;
                transition: all 0.2s ease;
            }

            .quick-select-btn:hover {
                border-color: #2e5827;
                color: #2e5827;
            }

            .quick-select-btn.active {
                background: #2e5827;
                color: white;
                border-color: #2e5827;
            }

            /* Instant Quote */
            .instant-quote {
                background: #f8fcf9;
                border: 2px solid #2e5827;
                border-radius: 12px;
                padding: 30px;
                margin-top: 30px;
            }

            .quote-header {
                font-size: 20px;
                font-weight: 600;
                color: #2e5827;
                margin-bottom: 20px;
                text-align: center;
            }

            .pricing-display {
                text-align: center;
                margin-bottom: 20px;
            }

            .unit-price {
                font-size: 36px;
                font-weight: bold;
                color: #2e5827;
                margin-bottom: 5px;
            }

            .unit-label {
                font-size: 16px;
                color: #666;
                margin-bottom: 10px;
            }

            .total-price {
                font-size: 20px;
                font-weight: 600;
                color: #333;
            }

            .pricing-breakdown {
                border-top: 1px solid #e0e0e0;
                margin-top: 20px;
                padding-top: 20px;
            }

            .breakdown-item {
                display: flex;
                justify-content: space-between;
                padding: 8px 0;
                font-size: 14px;
            }

            .breakdown-label {
                color: #666;
            }

            .breakdown-value {
                font-weight: 600;
                color: #333;
            }

            .ltm-warning {
                background: #fff3cd;
                border: 1px solid #ffeaa7;
                border-radius: 8px;
                padding: 15px;
                margin-top: 20px;
                text-align: center;
                color: #856404;
                font-size: 14px;
            }

            /* Mobile Responsive */
            @media (max-width: 768px) {
                .location-grid {
                    grid-template-columns: repeat(2, 1fr);
                    gap: 15px;
                }

                .step-section {
                    padding: 20px;
                }

                .progress-steps {
                    font-size: 12px;
                }
            }

            @media (max-width: 480px) {
                .location-grid {
                    grid-template-columns: 1fr;
                }

                .quick-select-grid {
                    grid-template-columns: repeat(2, 1fr);
                }
            }
        `;
        document.head.appendChild(style);
    }

    function initializeLocationSelector() {
        const locationGrid = document.getElementById('location-grid');
        if (!locationGrid) return;

        // Clear existing content
        locationGrid.innerHTML = '';

        // Create location cards
        Object.entries(DTG_LOCATIONS).forEach(([code, location]) => {
            const card = createLocationCard(code, location);
            locationGrid.appendChild(card);
        });

        // Select first location by default
        const firstRadio = locationGrid.querySelector('input[type="radio"]');
        if (firstRadio) {
            firstRadio.checked = true;
        }
    }

    function createLocationCard(code, location) {
        const label = document.createElement('label');
        label.className = 'location-card';

        const badgeHTML = location.isCombo ? 
            `<span class="combo-badge ${location.comboType === 'max' ? 'max' : ''}">
                ${location.comboType === 'max' ? 'MAX COVERAGE' : 'COMBO'}
            </span>` : '';

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
                </div>
            </div>
        `;

        return label;
    }

    function setupEventListeners() {
        // Location selection
        document.addEventListener('change', (e) => {
            if (e.target.name === 'dtg-location') {
                handleLocationSelection(e.target.value);
            }
        });

        // Quantity controls
        const decreaseBtn = document.getElementById('dtg-decrease-btn');
        const increaseBtn = document.getElementById('dtg-increase-btn');
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

        // Quick select buttons
        document.querySelectorAll('.quick-select-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const qty = parseInt(e.target.dataset.quantity);
                if (quantityInput) {
                    quantityInput.value = qty;
                    handleQuantityChange(qty);
                }
                
                // Update active state
                document.querySelectorAll('.quick-select-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
            });
        });

        // Listen for pricing data updates
        window.addEventListener('pricingDataLoaded', handlePricingDataLoaded);
    }

    function handleLocationSelection(locationCode) {
        console.log('[DTG-v3] Location selected:', locationCode);
        state.selectedLocation = locationCode;

        // Trigger DTG adapter to load pricing
        if (window.DTGAdapter && window.DTGAdapter.displayPricingForSelectedLocation) {
            window.DTGAdapter.displayPricingForSelectedLocation(locationCode);
        }

        // Dispatch custom event for other components
        window.dispatchEvent(new CustomEvent('dtgLocationSelected', {
            detail: { 
                locationCode: locationCode,
                locationInfo: DTG_LOCATIONS[locationCode]
            }
        }));

        // Auto-advance to step 2
        if (state.currentStep === 1) {
            setTimeout(() => {
                updateStep(2);
                // Update pricing display when we reach step 2
                updatePricingDisplay();
            }, 500);
        }
    }

    function handleQuantityChange(quantity) {
        console.log('[DTG-v3] Quantity changed:', quantity);
        state.quantity = quantity;

        // Update pricing display immediately
        updatePricingDisplay();

        // Dispatch event for other components
        window.dispatchEvent(new CustomEvent('quantityChanged', {
            detail: { totalQuantity: quantity }
        }));

        // Check for LTM
        const ltmWarning = document.getElementById('dtg-ltm-warning');
        if (ltmWarning) {
            ltmWarning.style.display = quantity < 24 ? 'block' : 'none';
        }

        // Auto-advance to step 3 if not already there
        if (state.currentStep === 2) {
            setTimeout(() => updateStep(3), 500);
        }
    }

    function handlePricingDataLoaded(event) {
        console.log('[DTG-v3] Pricing data loaded:', event.detail);
        
        // Update pricing display with new data
        updatePricingDisplay();
        
        // Make sure pricing grid is visible
        const pricingGridContainer = document.getElementById('pricing-grid-container');
        if (pricingGridContainer) {
            pricingGridContainer.style.display = 'block';
        }
    }

    function updatePricingDisplay() {
        // This will be called when pricing data is available
        const unitPriceEl = document.getElementById('dtg-unit-price');
        const totalPriceEl = document.getElementById('dtg-total-price');
        const breakdownEl = document.getElementById('dtg-pricing-breakdown');

        if (!unitPriceEl || !totalPriceEl) return;

        // Check if we have pricing data from the window
        if (window.nwcaPricingData && window.nwcaPricingData.prices) {
            const prices = window.nwcaPricingData.prices;
            const tierData = window.nwcaPricingData.tierData || window.nwcaPricingData.tiers;
            
            // Find the appropriate tier for the quantity
            let currentTier = null;
            let basePrice = 0;
            
            // Find which tier the current quantity falls into
            for (const [tierKey, tier] of Object.entries(tierData || {})) {
                if (state.quantity >= tier.MinQuantity && state.quantity <= tier.MaxQuantity) {
                    currentTier = tierKey;
                    break;
                }
            }

            // Get the base price from S-XL group
            if (currentTier && prices['S-XL'] && prices['S-XL'][currentTier] !== undefined) {
                basePrice = parseFloat(prices['S-XL'][currentTier]);
            } else {
                // Fallback: try to find any valid price
                console.log('[DTG-v3] Current tier not found, looking for fallback price');
                const sxlPrices = prices['S-XL'] || {};
                const availableTiers = Object.keys(sxlPrices);
                if (availableTiers.length > 0) {
                    // Use the first available tier as fallback
                    currentTier = availableTiers[0];
                    basePrice = parseFloat(sxlPrices[currentTier]) || 0;
                }
            }

            if (basePrice > 0) {
                let totalPrice = basePrice * state.quantity;
                
                // Apply LTM fee if under 24
                let ltmFeePerUnit = 0;
                if (state.quantity < 24) {
                    ltmFeePerUnit = 50 / state.quantity;
                    totalPrice += 50;
                }

                unitPriceEl.textContent = `$${basePrice.toFixed(2)}`;
                totalPriceEl.textContent = `Total: $${totalPrice.toFixed(2)}`;

                // Update breakdown
                if (breakdownEl) {
                    const locationInfo = DTG_LOCATIONS[state.selectedLocation];
                    let breakdownHTML = `
                        <div class="breakdown-item">
                            <span class="breakdown-label">Price per shirt (S-XL):</span>
                            <span class="breakdown-value">$${basePrice.toFixed(2)}</span>
                        </div>
                        <div class="breakdown-item">
                            <span class="breakdown-label">${locationInfo.name} printing:</span>
                            <span class="breakdown-value">included</span>
                        </div>
                    `;
                    
                    // Show size upcharges if any
                    const upcharges = [];
                    ['2XL', '3XL', '4XL+'].forEach(size => {
                        if (prices[size] && prices[size][currentTier] !== undefined) {
                            const sizePrice = parseFloat(prices[size][currentTier]);
                            if (sizePrice > basePrice) {
                                upcharges.push({
                                    size: size,
                                    upcharge: sizePrice - basePrice
                                });
                            }
                        }
                    });
                    
                    if (upcharges.length > 0) {
                        breakdownHTML += `<div class="breakdown-item" style="margin-top: 8px;">
                            <span class="breakdown-label">Size upcharges:</span>
                        </div>`;
                        upcharges.forEach(({ size, upcharge }) => {
                            breakdownHTML += `
                                <div class="breakdown-item" style="padding-left: 20px;">
                                    <span class="breakdown-label">• ${size}:</span>
                                    <span class="breakdown-value">+$${upcharge.toFixed(2)}</span>
                                </div>
                            `;
                        });
                    }
                    
                    if (state.quantity < 24) {
                        breakdownHTML += `
                            <div class="breakdown-item" style="margin-top: 8px;">
                                <span class="breakdown-label">Setup fee (< 24 shirts):</span>
                                <span class="breakdown-value">+$${ltmFeePerUnit.toFixed(2)}</span>
                            </div>
                        `;
                    }
                    
                    breakdownEl.innerHTML = breakdownHTML;
                }
                
                console.log('[DTG-v3] Updated pricing display:', { basePrice, totalPrice, currentTier });
            } else {
                console.log('[DTG-v3] No valid price found, showing loading state');
                unitPriceEl.textContent = 'Loading...';
                totalPriceEl.textContent = '';
                if (breakdownEl) {
                    breakdownEl.innerHTML = '<div class="breakdown-item">Loading pricing data...</div>';
                }
            }
        } else {
            console.log('[DTG-v3] No pricing data available yet');
            unitPriceEl.textContent = 'Loading...';
            totalPriceEl.textContent = '';
            if (breakdownEl) {
                breakdownEl.innerHTML = '<div class="breakdown-item">Loading pricing data...</div>';
            }
        }
    }

    function updateStep(step) {
        state.currentStep = step;
        
        // Update progress bar
        const progressFill = document.querySelector('.progress-line-fill');
        if (progressFill) {
            progressFill.style.width = ((step - 1) / 2 * 100) + '%';
        }

        // Update step indicators
        const steps = document.querySelectorAll('.progress-step');
        steps.forEach((s, index) => {
            if (index < step - 1) {
                s.classList.add('completed');
                s.classList.remove('active');
            } else if (index === step - 1) {
                s.classList.add('active');
                s.classList.remove('completed');
            } else {
                s.classList.remove('active', 'completed');
            }
        });

        // Update section visibility
        const sections = document.querySelectorAll('.step-section');
        sections.forEach((section, index) => {
            if (index === step - 1) {
                section.classList.remove('inactive');
            } else {
                section.classList.add('inactive');
            }
        });

        // Show/hide pricing grid container based on step
        const pricingGridContainer = document.getElementById('pricing-grid-container');
        if (pricingGridContainer) {
            if (step === 3) {
                pricingGridContainer.style.display = 'block';
                // Move it inside step 3 if it's not already there
                const step3Section = document.getElementById('dtg-step-3');
                if (step3Section && !step3Section.contains(pricingGridContainer)) {
                    step3Section.appendChild(pricingGridContainer);
                }
            } else {
                pricingGridContainer.style.display = 'none';
            }
        }
    }

    // Expose API for external access
    window.DTGPricingV3 = {
        getState: () => state,
        updateStep: updateStep,
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
        }
    };

})();