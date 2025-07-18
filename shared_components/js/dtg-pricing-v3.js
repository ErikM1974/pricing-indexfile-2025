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
        
        // Trigger initial pricing load after a delay to ensure DTG adapter is ready
        setTimeout(() => {
            console.log('[DTG-v3] Triggering initial pricing load for default location:', state.selectedLocation);
            // This will load the pricing data needed for all steps
            if (window.DTGAdapter && window.DTGAdapter.displayPricingForSelectedLocation) {
                window.DTGAdapter.displayPricingForSelectedLocation(state.selectedLocation);
            }
        }, 1000); // Give time for DTG adapter to initialize
    }

    // Function to update header pricing display
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
                            <div class="step-label">Configure Quantity</div>
                        </div>
                        <div class="progress-step" data-step="2">
                            <div class="step-number">2</div>
                            <div class="step-label">Select Location</div>
                        </div>
                        <div class="progress-step" data-step="3">
                            <div class="step-number">3</div>
                            <div class="step-label">Your Quote</div>
                        </div>
                    </div>
                </div>

                <!-- Step 1: Configure Quantity -->
                <div class="step-section" id="dtg-step-1">
                    <div class="step-header">
                        <div class="step-number-large">1</div>
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
                        
                        <div class="quantity-tier-message" id="dtg-tier-message" style="display: none;">
                            <span class="tier-icon">🎯</span>
                            <span class="tier-text"></span>
                        </div>
                    </div>
                </div>

                <!-- Step 2: Visual Location Selector -->
                <div class="step-section inactive" id="dtg-step-2">
                    <div class="step-header">
                        <div class="step-number-large">2</div>
                        <h2 class="step-title">Select Your Print Location</h2>
                    </div>
                    
                    <div class="location-grid" id="location-grid">
                        <!-- Location cards will be inserted here -->
                    </div>
                </div>

                <!-- Step 3: Your Instant Quote -->
                <div class="step-section inactive" id="dtg-step-3">
                    <div class="step-header">
                        <div class="step-number-large">3</div>
                        <h2 class="step-title">Your Instant Quote</h2>
                    </div>
                    
                    <div class="instant-quote-final">
                        <div class="selected-configuration">
                            <div class="config-item">
                                <span class="config-label">Quantity:</span>
                                <span class="config-value" id="final-quantity">24 shirts</span>
                            </div>
                            <div class="config-item">
                                <span class="config-label">Print Location:</span>
                                <span class="config-value" id="final-location">Left Chest (4" × 4")</span>
                            </div>
                        </div>
                        
                        <div class="pricing-display-large">
                            <div class="unit-price-large" id="dtg-unit-price-final">$0.00</div>
                            <div class="unit-label">per shirt</div>
                            <div class="total-price-large" id="dtg-total-price-final">Total: $0.00</div>
                        </div>
                        
                        <div class="pricing-breakdown" id="dtg-pricing-breakdown-final">
                            <!-- Dynamic breakdown will be inserted here -->
                        </div>
                        
                        <div class="ltm-warning" id="dtg-ltm-warning-final" style="display: none;">
                            <span>⚠️</span>
                            <span>Orders under 24 shirts include a $50 setup fee</span>
                        </div>
                        
                        <div class="quote-actions">
                            <button class="btn-primary" onclick="window.proceedToOrder()">Proceed to Order</button>
                            <button class="btn-secondary" onclick="window.saveQuote()">Save Quote</button>
                        </div>
                        
                        <!-- Reference Grid -->
                        <div class="reference-grid-section">
                            <h3>Complete Pricing Reference</h3>
                            <div id="pricing-grid-container">
                                <!-- Pricing grid populated by Universal Pricing Grid component -->
                            </div>
                        </div>
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
                display: none;
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
            
            /* Tier Message */
            .quantity-tier-message {
                background: linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%);
                border: 2px solid #2e5827;
                border-radius: 8px;
                padding: 12px 20px;
                margin: 20px auto;
                max-width: 400px;
                text-align: center;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 10px;
                animation: slideIn 0.3s ease-out;
            }
            
            .tier-icon {
                font-size: 20px;
            }
            
            .tier-text {
                font-weight: 600;
                color: #2e5827;
            }
            
            /* Location Card Pricing */
            .location-price {
                background: #f0f8f0;
                padding: 10px;
                margin-top: 10px;
                border-radius: 6px;
                font-weight: 600;
                color: #2e5827;
                display: flex;
                justify-content: center;
                align-items: baseline;
                gap: 5px;
            }
            
            .location-price .price-value {
                font-size: 18px;
            }
            
            .location-price .price-label {
                font-size: 13px;
                color: #666;
            }
            
            /* Step 3 Final Quote Styles */
            .instant-quote-final {
                max-width: 800px;
                margin: 0 auto;
            }
            
            .selected-configuration {
                background: #f8faf9;
                border: 1px solid #e1e4e8;
                border-radius: 8px;
                padding: 20px;
                margin-bottom: 30px;
                display: flex;
                justify-content: space-around;
                flex-wrap: wrap;
                gap: 20px;
            }
            
            .config-item {
                text-align: center;
            }
            
            .config-label {
                display: block;
                font-size: 14px;
                color: #666;
                margin-bottom: 5px;
            }
            
            .config-value {
                font-size: 18px;
                font-weight: 600;
                color: #2c3e50;
            }
            
            .pricing-display-large {
                text-align: center;
                padding: 40px;
                background: linear-gradient(135deg, #f8fcf9 0%, #e8f5e9 100%);
                border-radius: 12px;
                margin-bottom: 30px;
            }
            
            .unit-price-large {
                font-size: 48px;
                font-weight: bold;
                color: #2e5827;
                margin-bottom: 10px;
            }
            
            .total-price-large {
                font-size: 24px;
                font-weight: 600;
                color: #333;
                margin-top: 20px;
            }
            
            .quote-actions {
                display: flex;
                gap: 20px;
                justify-content: center;
                margin: 30px 0;
            }
            
            .btn-primary, .btn-secondary {
                padding: 15px 30px;
                border-radius: 8px;
                font-size: 16px;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.3s ease;
                border: none;
            }
            
            .btn-primary {
                background: #2e5827;
                color: white;
            }
            
            .btn-primary:hover {
                background: #1e3a1e;
                transform: translateY(-2px);
                box-shadow: 0 4px 12px rgba(46, 88, 39, 0.3);
            }
            
            .btn-secondary {
                background: white;
                color: #2e5827;
                border: 2px solid #2e5827;
            }
            
            .btn-secondary:hover {
                background: #f0f8f0;
            }
            
            .reference-grid-section {
                margin-top: 50px;
                padding-top: 50px;
                border-top: 2px solid #e1e4e8;
            }
            
            .reference-grid-section h3 {
                text-align: center;
                color: #2c3e50;
                margin-bottom: 20px;
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
            
            /* Animations */
            @keyframes slideIn {
                from {
                    opacity: 0;
                    transform: translateY(-10px);
                }
                to {
                    opacity: 1;
                    transform: translateY(0);
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
        label.dataset.location = code;

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
                    <div class="location-price" id="price-${code}" style="display: none;">
                        <span class="price-value">$0.00</span>
                        <span class="price-label">per shirt</span>
                    </div>
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
        console.log('[DTG-v3] Previous location was:', state.selectedLocation);
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
        
        // Always update final quote display to keep it in sync
        updateFinalQuoteDisplay();

        // Auto-advance to step 3
        if (state.currentStep === 2) {
            setTimeout(() => {
                updateStep(3);
                // Update pricing display first to ensure we have the latest data
                updatePricingDisplay();
                // Update final quote display again after step transition
                updateFinalQuoteDisplay();
            }, 500);
        }
    }

    function handleQuantityChange(quantity) {
        console.log('[DTG-v3] Quantity changed:', quantity);
        state.quantity = quantity;

        // Dispatch event for other components
        window.dispatchEvent(new CustomEvent('quantityChanged', {
            detail: { totalQuantity: quantity }
        }));

        // Check for LTM
        const ltmWarning = document.getElementById('dtg-ltm-warning');
        if (ltmWarning) {
            ltmWarning.style.display = quantity < 24 ? 'block' : 'none';
        }

        // Always update pricing display when quantity changes
        updatePricingDisplay();
        
        // Update location cards if we're on step 2
        if (state.currentStep === 2) {
            updateLocationCardsWithPricing();
        }
        
        // Always update final quote display to keep it in sync
        updateFinalQuoteDisplay();

        // Auto-advance to step 2 if we're on step 1
        if (state.currentStep === 1 && quantity >= 1) {
            setTimeout(() => {
                updateStep(2);
                // Update location cards with pricing
                updateLocationCardsWithPricing();
            }, 500);
        }
        
        // Show tier message
        updateTierMessage(quantity);
    }

    function handlePricingDataLoaded(event) {
        console.log('[DTG-v3] Pricing data loaded:', event.detail);
        console.log('[DTG-v3] Price structure:', window.nwcaPricingData?.prices);
        console.log('[DTG-v3] Current state:', { 
            location: state.selectedLocation, 
            quantity: state.quantity,
            step: state.currentStep 
        });
        
        // Update pricing display with new data
        updatePricingDisplay();
        updateLocationCardsWithPricing();
        
        // Always update final quote display to keep it in sync
        updateFinalQuoteDisplay();
        
        // Make sure pricing grid is visible
        const pricingGridContainer = document.getElementById('pricing-grid-container');
        if (pricingGridContainer) {
            pricingGridContainer.style.display = 'block';
        }
    }

    function updatePricingDisplay() {
        // Update pricing in step 3 (final quote)
        const unitPriceEl = document.getElementById('dtg-unit-price-final');
        const totalPriceEl = document.getElementById('dtg-total-price-final');
        const breakdownEl = document.getElementById('dtg-pricing-breakdown-final');

        if (!unitPriceEl || !totalPriceEl) {
            console.log('[DTG-v3] Pricing elements not found, may not be on step 3 yet');
            return;
        }

        console.log('[DTG-v3] updatePricingDisplay called', {
            hasData: !!(window.nwcaPricingData && window.nwcaPricingData.prices),
            quantity: state.quantity,
            location: state.selectedLocation
        });

        // Check if we have pricing data from the window
        if (window.dtgMasterPriceBundle && window.dtgMasterPriceBundle.allLocationPrices) {
            const allLocationPrices = window.dtgMasterPriceBundle.allLocationPrices;
            
            // Get the appropriate tier for the quantity
            const tier = getPriceTier(state.quantity);
            console.log('[DTG-v3] Tier for quantity', state.quantity, 'is', tier);
            console.log('[DTG-v3] Looking for location', state.selectedLocation, 'in allLocationPrices');
            
            let basePrice = 0;
            
            // Get location-specific pricing directly from master bundle
            if (allLocationPrices[state.selectedLocation]) {
                const locationPrices = allLocationPrices[state.selectedLocation];
                console.log('[DTG-v3] Found location prices:', locationPrices);
                
                // Get price for S size (or any available size) at the current tier
                if (locationPrices['S'] && locationPrices['S'][tier] !== undefined) {
                    basePrice = parseFloat(locationPrices['S'][tier]);
                    console.log('[DTG-v3] Found base price:', basePrice, 'for location', state.selectedLocation, 'tier', tier);
                } else {
                    // Try other sizes if S is not available
                    const sizes = ['M', 'L', 'XL'];
                    for (const size of sizes) {
                        if (locationPrices[size] && locationPrices[size][tier] !== undefined) {
                            basePrice = parseFloat(locationPrices[size][tier]);
                            console.log('[DTG-v3] Found base price from size', size, ':', basePrice);
                            break;
                        }
                    }
                }
            } else {
                console.log('[DTG-v3] No pricing found for location:', state.selectedLocation);
            }

            if (basePrice > 0) {
                let totalPrice = basePrice * state.quantity;
                
                // Apply LTM fee if under 24
                let ltmFeePerUnit = 0;
                if (state.quantity < 24) {
                    ltmFeePerUnit = 50 / state.quantity;
                    totalPrice += 50;
                }

                const displayPrice = basePrice + ltmFeePerUnit;
                console.log('[DTG-v3] Calculated prices:', {
                    basePrice,
                    ltmFeePerUnit,
                    displayPrice,
                    totalPrice
                });
                
                unitPriceEl.textContent = `$${displayPrice.toFixed(2)}`;
                totalPriceEl.textContent = `Total: $${totalPrice.toFixed(2)}`;

                // Update header pricing display with the same price shown in instant quote
                if (typeof updateHeaderPricing === 'function') {
                    updateHeaderPricing(state.quantity, displayPrice);
                } else {
                    console.warn('[DTG-v3] updateHeaderPricing function not found');
                }

                // Update breakdown
                if (breakdownEl) {
                    const locationInfo = DTG_LOCATIONS[state.selectedLocation];
                    let breakdownHTML = `
                        <div class="breakdown-item">
                            <span class="breakdown-label">Base price (S-XL):</span>
                            <span class="breakdown-value">$${basePrice}</span>
                        </div>
                        <div class="breakdown-item">
                            <span class="breakdown-label">${locationInfo.name} printing:</span>
                            <span class="breakdown-value">included</span>
                        </div>
                    `;
                    
                    if (state.quantity < 24) {
                        breakdownHTML += `
                            <div class="breakdown-item" style="margin-top: 8px;">
                                <span class="breakdown-label">LTM (less than minimum) fee (under 24):</span>
                                <span class="breakdown-value">+$${ltmFeePerUnit.toFixed(2)}/shirt</span>
                            </div>
                        `;
                    }
                    
                    breakdownEl.innerHTML = breakdownHTML;
                }
                
                console.log('[DTG-v3] Updated pricing display:', { basePrice, totalPrice, tier });
            } else {
                console.log('[DTG-v3] No valid price found for location:', state.selectedLocation, 'tier:', tier);
                unitPriceEl.textContent = 'Loading...';
                totalPriceEl.textContent = '';
                if (breakdownEl) {
                    breakdownEl.innerHTML = '<div class="breakdown-item">Loading pricing data...</div>';
                }
                // Update header to show loading state
                updateHeaderPricing(state.quantity, 0);
            }
        } else if (window.dtgMasterPriceBundle && window.dtgMasterPriceBundle.allLocationPrices) {
            // Fallback to using master bundle directly if nwcaPricingData isn't set
            console.log('[DTG-v3] Using dtgMasterPriceBundle directly');
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
                
                if (state.quantity < 24) {
                    ltmFeePerUnit = 50 / state.quantity;
                    totalPrice += 50;
                }
                
                const displayPrice = basePrice + ltmFeePerUnit;
                unitPriceEl.textContent = `$${displayPrice.toFixed(2)}`;
                totalPriceEl.textContent = `Total: $${totalPrice.toFixed(2)}`;
                updateHeaderPricing(state.quantity, displayPrice);
                
                if (breakdownEl) {
                    const locationInfo = DTG_LOCATIONS[state.selectedLocation];
                    let breakdownHTML = `
                        <div class="breakdown-item">
                            <span class="breakdown-label">Base price (S-XL):</span>
                            <span class="breakdown-value">$${basePrice.toFixed(2)}</span>
                        </div>
                        <div class="breakdown-item">
                            <span class="breakdown-label">${locationInfo.name} printing:</span>
                            <span class="breakdown-value">included</span>
                        </div>
                    `;
                    
                    if (state.quantity < 24) {
                        breakdownHTML += `
                            <div class="breakdown-item" style="margin-top: 8px;">
                                <span class="breakdown-label">LTM (less than minimum) fee (under 24):</span>
                                <span class="breakdown-value">+$${ltmFeePerUnit.toFixed(2)}/shirt</span>
                            </div>
                        `;
                    }
                    
                    breakdownEl.innerHTML = breakdownHTML;
                }
            } else {
                // No pricing available
                unitPriceEl.textContent = '$0.00';
                totalPriceEl.textContent = 'Total: $0.00';
                updateHeaderPricing(state.quantity, 0);
            }
        } else {
            console.log('[DTG-v3] No pricing data available yet');
            // Show $0.00 instead of "Loading..." to match the visual
            unitPriceEl.textContent = '$0.00';
            totalPriceEl.textContent = 'Total: $0.00';
            if (breakdownEl) {
                breakdownEl.innerHTML = '<div class="breakdown-item">Select a location to view pricing</div>';
            }
            // Update header to show $0.00
            updateHeaderPricing(state.quantity, 0);
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

        // Ensure pricing grid container is moved to step 3 and always visible
        const pricingGridContainer = document.getElementById('pricing-grid-container');
        if (pricingGridContainer) {
            // Always show the pricing grid
            pricingGridContainer.style.display = 'block';
            
            // Move it inside step 3 if it's not already there
            const step3Section = document.getElementById('dtg-step-3');
            if (step3Section && !step3Section.contains(pricingGridContainer)) {
                step3Section.appendChild(pricingGridContainer);
            }
        }
    }

    function updateTierMessage(quantity) {
        const tierMessageEl = document.getElementById('dtg-tier-message');
        if (!tierMessageEl) return;
        
        const tierTextEl = tierMessageEl.querySelector('.tier-text');
        if (!tierTextEl) return;
        
        let message = '';
        // DTG has 3 tiers, not 4
        if (quantity >= 72) {
            message = 'Great choice! You qualify for our best Tier 3 pricing (72+)';
        } else if (quantity >= 48) {
            message = 'Nice! You qualify for Tier 2 pricing (48-71)';
        } else if (quantity >= 24) {
            message = 'You qualify for Tier 1 pricing (24-47)';
        } else {
            message = 'Minimum order is 24 shirts (setup fee applies)';
        }
        
        tierTextEl.textContent = message;
        tierMessageEl.style.display = 'block';
    }
    
    function updateLocationCardsWithPricing() {
        // Get current pricing data from master bundle
        if (!window.dtgMasterPriceBundle || !window.dtgMasterPriceBundle.allLocationPrices) {
            console.log('[DTG-v3] No master bundle data available for location cards');
            return;
        }
        
        const allLocationPrices = window.dtgMasterPriceBundle.allLocationPrices;
        const tier = getPriceTier(state.quantity);
        console.log('[DTG-v3] Updating location cards with tier', tier, 'for quantity', state.quantity);
        
        // Update each location card with its price
        Object.entries(DTG_LOCATIONS).forEach(([code, location]) => {
            const priceEl = document.getElementById(`price-${code}`);
            if (priceEl) {
                let basePrice = 0;
                
                // Get location-specific price from master bundle
                if (allLocationPrices[code]) {
                    const locationPrices = allLocationPrices[code];
                    // Get S size price for the current tier
                    if (locationPrices['S'] && locationPrices['S'][tier] !== undefined) {
                        basePrice = parseFloat(locationPrices['S'][tier]);
                        console.log('[DTG-v3] Location card', code, 'price:', basePrice);
                    }
                } else {
                    console.log('[DTG-v3] No price found for location', code);
                }
                
                // Add LTM fee if applicable
                if (state.quantity < 24 && basePrice > 0) {
                    basePrice += 50 / state.quantity;
                }
                
                const priceValueEl = priceEl.querySelector('.price-value');
                if (priceValueEl && basePrice > 0) {
                    priceValueEl.textContent = `$${basePrice.toFixed(2)}`;
                    priceEl.style.display = 'block';
                } else if (priceValueEl) {
                    priceValueEl.textContent = '$0.00';
                    priceEl.style.display = 'block';
                }
            }
        });
    }
    
    function updateFinalQuoteDisplay() {
        // Update final configuration display
        const finalQuantityEl = document.getElementById('final-quantity');
        const finalLocationEl = document.getElementById('final-location');
        const unitPriceFinalEl = document.getElementById('dtg-unit-price-final');
        const totalPriceFinalEl = document.getElementById('dtg-total-price-final');
        const breakdownFinalEl = document.getElementById('dtg-pricing-breakdown-final');
        const ltmWarningFinalEl = document.getElementById('dtg-ltm-warning-final');
        
        if (finalQuantityEl) {
            finalQuantityEl.textContent = `${state.quantity} shirts`;
        }
        
        if (finalLocationEl && DTG_LOCATIONS[state.selectedLocation]) {
            const location = DTG_LOCATIONS[state.selectedLocation];
            finalLocationEl.textContent = `${location.name} (${location.size})`;
        }
        
        // Calculate the pricing using master bundle data
        if (window.dtgMasterPriceBundle && window.dtgMasterPriceBundle.allLocationPrices) {
            const allLocationPrices = window.dtgMasterPriceBundle.allLocationPrices;
            const tier = getPriceTier(state.quantity);
            let basePrice = 0;
            
            // Get location-specific price from master bundle
            if (allLocationPrices[state.selectedLocation]) {
                const locationPrices = allLocationPrices[state.selectedLocation];
                // Get S size price for the current tier
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
                
                if (unitPriceFinalEl) {
                    unitPriceFinalEl.textContent = `$${displayPrice.toFixed(2)}`;
                }
                
                if (totalPriceFinalEl) {
                    totalPriceFinalEl.textContent = `Total: $${totalPrice.toFixed(2)}`;
                }
                
                // Update breakdown
                if (breakdownFinalEl) {
                    const locationInfo = DTG_LOCATIONS[state.selectedLocation];
                    let breakdownHTML = `
                        <div class="breakdown-item">
                            <span class="breakdown-label">Base price (S-XL):</span>
                            <span class="breakdown-value">$${basePrice.toFixed(2)}</span>
                        </div>
                        <div class="breakdown-item">
                            <span class="breakdown-label">${locationInfo.name} printing:</span>
                            <span class="breakdown-value">included</span>
                        </div>
                    `;
                    
                    if (state.quantity < 24) {
                        breakdownHTML += `
                            <div class="breakdown-item" style="margin-top: 8px;">
                                <span class="breakdown-label">LTM (less than minimum) fee (under 24):</span>
                                <span class="breakdown-value">+$${ltmFeePerUnit.toFixed(2)}/shirt</span>
                            </div>
                        `;
                    }
                    
                    breakdownFinalEl.innerHTML = breakdownHTML;
                }
                
                if (ltmWarningFinalEl) {
                    ltmWarningFinalEl.style.display = state.quantity < 24 ? 'block' : 'none';
                }
            }
        }
    }
    
    function getPriceTier(quantity) {
        // DTG uses tier range keys that match the Caspio data structure
        if (quantity < 24) return '24-47';  // Minimum order with LTM fee
        if (quantity <= 47) return '24-47';  // Tier 1
        if (quantity <= 71) return '48-71';  // Tier 2
        return '72+';  // Tier 3 (72 and above)
    }
    
    // Global functions for quote actions
    window.proceedToOrder = function() {
        // Implement order flow
        alert('Proceeding to order form...');
    };
    
    window.saveQuote = function() {
        // Implement quote saving
        alert('Saving quote...');
    };

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