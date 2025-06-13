// Screen Print Integration Module - DTG Layout Style
// Connects universal components with screen print specific functionality

window.ScreenPrintIntegration = (function() {
    'use strict';
    
    const config = window.ScreenPrintConfig;
    const calculator = window.ScreenPrintCalculator;
    
    // Track initialization state
    let isInitialized = false;
    
    // Initialize integration
    function init() {
        if (isInitialized) return;
        
        console.log('[ScreenPrintIntegration] Initializing with DTG-style layout');
        
        // Wait for DOM and components
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initialize);
        } else {
            initialize();
        }
    }
    
    function initialize() {
        createPricingInterface();
        bindEventHandlers();
        setupInitialState();
        setupCollapsibleSections();
        isInitialized = true;
        
        console.log('[ScreenPrintIntegration] Initialization complete');
    }
    
    // Create the pricing interface (DTG style)
    function createPricingInterface() {
        const container = document.getElementById('add-to-cart-section');
        if (!container) {
            console.error('[ScreenPrintIntegration] Add to cart section not found');
            return;
        }
        
        container.innerHTML = `
            <!-- Quick Quote Calculator (DTG Style) -->
            <div class="quick-quote-calculator">
                <h3 class="calculator-title">Quick Quote Calculator</h3>
                
                <div class="calculator-content">
                    <!-- Left side: Controls -->
                    <div class="calculator-controls">
                        <!-- Color Selection -->
                        <div class="control-group">
                            <label for="sp-front-colors">Front Design Colors:</label>
                            <select id="sp-front-colors" class="control-select">
                                <option value="0">No Front Print</option>
                                ${config.colorOptions.map(opt => 
                                    `<option value="${opt.value}">${opt.label}</option>`
                                ).join('')}
                            </select>
                        </div>
                        
                        <!-- Additional Locations -->
                        <div class="control-group">
                            <label>Additional Print Locations:</label>
                            <div id="sp-additional-locations-container">
                                <!-- Dynamic location controls will be added here -->
                            </div>
                            <button type="button" id="sp-add-location-btn" class="add-location-btn">
                                <span class="btn-icon">+</span> Add Print Location
                            </button>
                            <div class="help-text">Up to ${config.maxAdditionalLocations} additional locations</div>
                        </div>
                        
                        <!-- Quantity -->
                        <div class="control-group">
                            <label for="sp-quantity-input">Quantity:</label>
                            <input type="number" 
                                   id="sp-quantity-input" 
                                   class="control-input"
                                   min="${config.minimumQuantity}" 
                                   value="${config.standardMinimum}" 
                                   step="1">
                            <span id="sp-ltm-warning" class="ltm-warning" style="display: none;">
                                ${config.messages.ltmWarning}
                            </span>
                        </div>
                        
                        <!-- Dark Garment -->
                        <div class="control-group checkbox-group">
                            <label>
                                <input type="checkbox" id="dark-garment-checkbox">
                                <span>Dark garment (needs white underbase)</span>
                            </label>
                            <div class="help-text">${config.messages.darkGarmentNote}</div>
                        </div>
                    </div>
                    
                    <!-- Right side: Price Display -->
                    <div class="calculator-results">
                        <!-- Price Display Box -->
                        <div class="price-display-box">
                            <!-- Base Price -->
                            <div class="price-main">
                                <span class="currency">$</span>
                                <span id="sp-base-price-large">0.00</span>
                                <span class="price-suffix">per shirt</span>
                            </div>
                            <div class="price-subtitle" id="sp-price-subtitle">shirt + printing included</div>
                            
                            <!-- Divider -->
                            <div class="price-divider"></div>
                            
                            <!-- Setup Impact -->
                            <div class="price-breakdown">
                                <div class="breakdown-line">
                                    <span>Setup impact:</span>
                                    <span id="sp-setup-impact">+$0.00</span>
                                </div>
                                <div class="breakdown-line total-line">
                                    <span>All-in price:</span>
                                    <span id="sp-all-in-price">$0.00</span>
                                </div>
                            </div>
                            
                            <!-- Total Order -->
                            <div class="order-total">
                                <span>Total order:</span>
                                <span id="sp-grand-total">$0.00</span>
                            </div>
                        </div>
                        
                        <!-- Setup Details -->
                        <div class="setup-details-box">
                            <div class="setup-header">
                                <span>One-time Setup:</span>
                                <span id="sp-setup-fee">$0.00</span>
                            </div>
                            <div id="sp-setup-breakdown" class="setup-breakdown"></div>
                        </div>
                        
                        <!-- LTM Notice -->
                        <div class="ltm-notice-box" id="sp-ltm-notice" style="display: none;">
                            <span class="ltm-icon">⚠️</span>
                            <span>Small order fee applies: <strong id="sp-ltm-fee">$50.00</strong></span>
                        </div>
                    </div>
                </div>
                
                <!-- Error Messages -->
                <div id="sp-error-message" class="error-message" style="display: none;"></div>
            </div>
            
            <!-- Detailed Order Summary -->
            <div class="order-summary-section" id="sp-order-summary" style="display: none;">
                <h4 class="summary-title">Detailed Order Summary</h4>
                <div class="summary-content">
                    <div class="summary-items" id="sp-summary-items">
                        <!-- Dynamic content will be inserted here -->
                    </div>
                </div>
            </div>
            
            <!-- Detailed Pricing Tiers Accordion -->
            <div class="pricing-tiers-section">
                <button type="button" class="collapsible-trigger" id="toggle-pricing-tiers">
                    <span class="trigger-icon">▶</span> View All Pricing Tiers
                </button>
                <div class="collapsible-content" style="display: none;">
                    <div id="sp-pricing-tiers-content">
                        <!-- Dynamic pricing tiers will be inserted here -->
                    </div>
                </div>
            </div>
        `;
        
        // Add styles
        addStyles();
    }
    
    // Add component styles (DTG-matching)
    function addStyles() {
        const style = document.createElement('style');
        style.textContent = `
            /* Quick Quote Calculator - DTG Style */
            .quick-quote-calculator {
                background: var(--background-light, #f8f9fa);
                border-radius: var(--radius-md, 8px);
                padding: 25px;
                margin-bottom: 30px;
                box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            }
            
            .calculator-title {
                color: var(--primary-color, #2e5827);
                font-size: 1.5em;
                margin: 0 0 20px 0;
                font-weight: 600;
            }
            
            .calculator-content {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 30px;
                align-items: start;
            }
            
            /* Controls Side */
            .calculator-controls {
                display: flex;
                flex-direction: column;
                gap: 15px;
            }
            
            .control-group {
                display: flex;
                flex-direction: column;
                gap: 8px;
            }
            
            .control-group label {
                font-weight: 600;
                color: #333;
                font-size: 0.95em;
            }
            
            .control-select, .control-input {
                padding: 10px;
                border: 2px solid var(--border-color, #ddd);
                border-radius: var(--radius-sm, 4px);
                font-size: 1em;
                transition: border-color 0.3s ease;
            }
            
            .control-select:focus, .control-input:focus {
                outline: none;
                border-color: var(--primary-color, #2e5827);
            }
            
            .checkbox-group label {
                display: flex;
                align-items: center;
                gap: 8px;
                cursor: pointer;
                font-weight: 600;
            }
            
            .checkbox-group input[type="checkbox"] {
                width: 18px;
                height: 18px;
                cursor: pointer;
            }
            
            .help-text {
                font-size: 0.85em;
                color: #666;
                font-style: italic;
                margin-left: 26px;
            }
            
            .ltm-warning {
                font-size: 0.85em;
                color: #ff6b6b;
                display: block;
                margin-top: 5px;
            }
            
            /* Additional Locations */
            #sp-additional-locations-container {
                display: flex;
                flex-direction: column;
                gap: 10px;
                margin-bottom: 10px;
            }
            
            .location-control {
                animation: slideIn 0.3s ease;
            }
            
            .location-row {
                display: grid;
                grid-template-columns: 1fr 120px 40px;
                gap: 8px;
                align-items: center;
            }
            
            .add-location-btn {
                background: var(--primary-color, #2e5827);
                color: white;
                border: none;
                padding: 10px 16px;
                border-radius: var(--radius-sm, 4px);
                cursor: pointer;
                font-size: 0.95em;
                font-weight: 600;
                display: flex;
                align-items: center;
                gap: 6px;
                transition: background-color 0.3s ease;
            }
            
            .add-location-btn:hover {
                background: #234520;
            }
            
            .add-location-btn .btn-icon {
                font-size: 1.2em;
                font-weight: bold;
            }
            
            .remove-location-btn {
                background: #dc3545;
                color: white;
                border: none;
                padding: 8px;
                border-radius: var(--radius-sm, 4px);
                cursor: pointer;
                font-size: 1.2em;
                line-height: 1;
                transition: background-color 0.3s ease;
                width: 36px;
                height: 36px;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            
            .remove-location-btn:hover {
                background: #c82333;
            }
            
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
            
            /* Results Side */
            .calculator-results {
                display: flex;
                flex-direction: column;
                gap: 15px;
            }
            
            .price-display-box {
                background: white;
                border: 2px solid var(--primary-color, #2e5827);
                border-radius: var(--radius-md, 8px);
                padding: 25px;
                text-align: center;
                box-shadow: 0 4px 12px rgba(0,0,0,0.1);
            }
            
            .price-main {
                display: flex;
                align-items: baseline;
                justify-content: center;
                gap: 2px;
                margin-bottom: 5px;
            }
            
            .currency {
                font-size: 28px;
                font-weight: 600;
                color: var(--primary-color, #2e5827);
            }
            
            #sp-base-price-large {
                font-size: 42px;
                font-weight: bold;
                color: var(--primary-color, #2e5827);
                line-height: 1;
            }
            
            .price-suffix {
                font-size: 18px;
                font-weight: 500;
                color: #333;
                margin-left: 5px;
            }
            
            .price-subtitle {
                font-size: 14px;
                color: #666;
                font-style: italic;
                margin-bottom: 15px;
            }
            
            .price-divider {
                height: 1px;
                background: #e0e0e0;
                margin: 15px 0;
            }
            
            .price-breakdown {
                text-align: left;
                margin-bottom: 15px;
            }
            
            .breakdown-line {
                display: flex;
                justify-content: space-between;
                padding: 5px 0;
                font-size: 0.95em;
            }
            
            .breakdown-line span:first-child {
                color: #666;
            }
            
            .breakdown-line span:last-child {
                font-weight: 600;
                color: #333;
            }
            
            .total-line {
                border-top: 1px solid #e0e0e0;
                padding-top: 10px;
                margin-top: 5px;
                font-size: 1.1em;
            }
            
            .total-line span:last-child {
                color: var(--primary-color, #2e5827);
            }
            
            .order-total {
                display: flex;
                justify-content: space-between;
                font-size: 0.9em;
                color: #666;
                padding-top: 10px;
                border-top: 1px solid #f0f0f0;
            }
            
            .order-total span:last-child {
                font-weight: 600;
                color: #333;
            }
            
            /* Setup Details Box */
            .setup-details-box {
                background: #f8f9fa;
                border-radius: var(--radius-sm, 4px);
                padding: 15px;
                font-size: 0.9em;
            }
            
            .setup-header {
                display: flex;
                justify-content: space-between;
                font-weight: 600;
                margin-bottom: 8px;
            }
            
            .setup-breakdown {
                font-size: 0.85em;
                color: #666;
                line-height: 1.6;
                padding-left: 10px;
            }
            
            /* LTM Notice */
            .ltm-notice-box {
                background: #fff3cd;
                border: 1px solid #ffeeba;
                color: #856404;
                padding: 12px;
                border-radius: var(--radius-sm, 4px);
                display: flex;
                align-items: center;
                gap: 10px;
                font-size: 0.9em;
            }
            
            .ltm-icon {
                font-size: 1.2em;
            }
            
            /* Error Message */
            .error-message {
                background: #ffebee;
                color: #c62828;
                padding: 12px;
                border-radius: var(--radius-sm, 4px);
                margin-top: 15px;
                text-align: center;
            }
            
            /* Order Summary Section */
            .order-summary-section {
                background: white;
                border: 1px solid var(--border-color, #ddd);
                border-radius: var(--radius-md, 8px);
                padding: 20px;
                margin: 20px 0;
                box-shadow: 0 2px 8px rgba(0,0,0,0.05);
            }
            
            .summary-title {
                color: var(--primary-color, #2e5827);
                font-size: 1.2em;
                margin: 0 0 15px 0;
                font-weight: 600;
            }
            
            .summary-table {
                font-size: 0.95em;
            }
            
            .summary-row {
                display: grid;
                grid-template-columns: 1fr auto auto;
                gap: 15px;
                padding: 8px 0;
                align-items: center;
            }
            
            .summary-row.indent {
                padding-left: 20px;
            }
            
            .summary-label {
                font-weight: 500;
            }
            
            .summary-value {
                text-align: right;
                color: #666;
            }
            
            .summary-total {
                text-align: right;
                font-weight: 600;
                min-width: 80px;
            }
            
            .summary-section-divider {
                border-top: 1px solid #eee;
                margin: 10px 0;
            }
            
            .summary-section-title {
                font-weight: 600;
                color: #555;
                margin: 10px 0 5px 0;
                font-size: 0.9em;
            }
            
            .subtotal-row {
                border-top: 1px solid #eee;
                padding-top: 12px;
                margin-top: 8px;
            }
            
            .grand-total-row {
                border-top: 2px solid var(--primary-color, #2e5827);
                padding-top: 12px;
                margin-top: 12px;
                font-size: 1.1em;
            }
            
            .grand-total-row .summary-total {
                color: var(--primary-color, #2e5827);
                font-size: 1.2em;
            }
            
            .per-item-row {
                background: #f8f9fa;
                padding: 10px 8px;
                margin: 10px -8px -8px;
                border-radius: 4px;
            }
            
            /* Pricing Tiers Section */
            .pricing-tiers-section {
                margin: 20px 0;
            }
            
            .collapsible-trigger {
                background: var(--background-light, #f8f9fa);
                border: 1px solid var(--border-color, #ddd);
                border-radius: var(--radius-sm, 4px);
                padding: 12px 16px;
                cursor: pointer;
                width: 100%;
                text-align: left;
                font-size: 1em;
                font-weight: 600;
                color: var(--primary-color, #2e5827);
                display: flex;
                align-items: center;
                gap: 8px;
                transition: background-color 0.3s ease;
            }
            
            .collapsible-trigger:hover {
                background: #e9ecef;
            }
            
            .collapsible-trigger.active .trigger-icon {
                transform: rotate(90deg);
            }
            
            .trigger-icon {
                transition: transform 0.3s ease;
            }
            
            .collapsible-content {
                margin-top: 10px;
                animation: slideDown 0.3s ease;
            }
            
            @keyframes slideDown {
                from {
                    opacity: 0;
                    max-height: 0;
                }
                to {
                    opacity: 1;
                    max-height: 1000px;
                }
            }
            
            .tiers-table {
                width: 100%;
                border-collapse: collapse;
                margin-top: 10px;
            }
            
            .tiers-table th,
            .tiers-table td {
                padding: 10px;
                text-align: center;
                border: 1px solid #ddd;
            }
            
            .tiers-table th {
                background: var(--background-light, #f8f9fa);
                font-weight: 600;
                color: #333;
            }
            
            .tiers-table tr.current-tier {
                background: #e7f5e7;
                font-weight: 600;
            }
            
            .tier-range {
                text-align: left !important;
                font-weight: 600;
            }
            
            .savings {
                color: var(--primary-color, #2e5827);
                font-weight: 600;
            }
            
            .tiers-note {
                font-size: 0.85em;
                color: #666;
                text-align: center;
                margin-top: 10px;
                font-style: italic;
            }
            
            /* Responsive */
            @media (max-width: 768px) {
                .calculator-content {
                    grid-template-columns: 1fr;
                    gap: 20px;
                }
                
                #sp-base-price-large {
                    font-size: 36px;
                }
                
                .currency {
                    font-size: 24px;
                }
            }
        `;
        document.head.appendChild(style);
    }
    
    // Bind event handlers
    function bindEventHandlers() {
        // Quantity input
        document.addEventListener('input', (e) => {
            if (e.target.id === 'sp-quantity-input') {
                calculator.updateQuantity(e.target.value);
            }
        });
        
        // Color selections
        document.addEventListener('change', (e) => {
            if (e.target.id === 'sp-front-colors') {
                calculator.updateColors('front', e.target.value);
            }
        });
        
        // Add location button
        document.addEventListener('click', (e) => {
            if (e.target.id === 'sp-add-location-btn' || e.target.closest('#sp-add-location-btn')) {
                addLocationControl();
            }
            
            // Remove location button
            if (e.target.classList.contains('remove-location-btn') || e.target.closest('.remove-location-btn')) {
                const btn = e.target.closest('.remove-location-btn');
                const index = parseInt(btn.dataset.index);
                removeLocationControl(index);
            }
        });
        
        // Location and color changes
        document.addEventListener('change', (e) => {
            if (e.target.classList.contains('location-select') || e.target.classList.contains('location-colors-select')) {
                updateLocationFromUI();
            }
        });
        
        // Dark garment toggle
        document.addEventListener('change', (e) => {
            if (e.target.id === 'dark-garment-checkbox') {
                calculator.toggleDarkGarment(e.target.checked);
            }
        });
        
        // Listen for pricing updates
        document.addEventListener('screenPrintPricingCalculated', (e) => {
            updatePricingDisplay(e.detail);
        });
        
        // Listen for adapter ready
        document.addEventListener('screenPrintAdapterReady', (e) => {
            console.log('[ScreenPrintIntegration] Adapter ready, triggering initial calculation');
            // Trigger recalculation with current values
            const frontColors = document.getElementById('sp-front-colors');
            if (frontColors && frontColors.value !== '0') {
                calculator.updateColors('front', frontColors.value);
            }
        });
    }
    
    // Setup collapsible sections for pricing tables
    function setupCollapsibleSections() {
        document.addEventListener('click', (e) => {
            if (e.target.closest('.collapsible-trigger')) {
                const trigger = e.target.closest('.collapsible-trigger');
                const content = trigger.nextElementSibling;
                
                if (content.style.display === 'none') {
                    content.style.display = 'block';
                    trigger.classList.add('active');
                    
                    // Load pricing grid if needed
                    if (trigger.id === 'toggle-pricing-tiers') {
                        const grid = document.getElementById('custom-pricing-grid');
                        if (grid) grid.style.display = 'table';
                    }
                } else {
                    content.style.display = 'none';
                    trigger.classList.remove('active');
                }
            }
        });
    }
    
    // Add location control
    function addLocationControl() {
        const container = document.getElementById('sp-additional-locations-container');
        const currentCount = container.querySelectorAll('.location-control').length;
        
        if (currentCount >= config.maxAdditionalLocations) {
            return;
        }
        
        const index = currentCount;
        const locationControl = document.createElement('div');
        locationControl.className = 'location-control';
        locationControl.dataset.index = index;
        
        locationControl.innerHTML = `
            <div class="location-row">
                <select class="location-select control-select" data-index="${index}">
                    ${config.locationOptions.map(opt => 
                        `<option value="${opt.value}" ${opt.value === 'back' ? 'selected' : ''}>${opt.label}</option>`
                    ).join('')}
                </select>
                <select class="location-colors-select control-select" data-index="${index}">
                    ${config.colorOptions.map(opt => 
                        `<option value="${opt.value}" ${opt.value === '1' ? 'selected' : ''}>${opt.label}</option>`
                    ).join('')}
                </select>
                <button type="button" class="remove-location-btn" data-index="${index}">
                    <span class="btn-icon">×</span>
                </button>
            </div>
        `;
        
        container.appendChild(locationControl);
        
        // Add to calculator state with default values
        calculator.addAdditionalLocation('back', 1);
        
        // Update button visibility
        updateAddLocationButton();
    }
    
    // Remove location control
    function removeLocationControl(index) {
        const container = document.getElementById('sp-additional-locations-container');
        const control = container.querySelector(`[data-index="${index}"]`);
        
        if (control) {
            control.remove();
            calculator.removeAdditionalLocation(index);
            
            // Re-index remaining controls
            const controls = container.querySelectorAll('.location-control');
            controls.forEach((ctrl, i) => {
                ctrl.dataset.index = i;
                ctrl.querySelector('.location-select').dataset.index = i;
                ctrl.querySelector('.location-colors-select').dataset.index = i;
                ctrl.querySelector('.remove-location-btn').dataset.index = i;
            });
            
            updateAddLocationButton();
        }
    }
    
    // Update location from UI
    function updateLocationFromUI() {
        const container = document.getElementById('sp-additional-locations-container');
        const controls = container.querySelectorAll('.location-control');
        
        console.log('[ScreenPrintIntegration] Updating locations from UI, found', controls.length, 'controls');
        
        controls.forEach((control, index) => {
            const locationSelect = control.querySelector('.location-select');
            const colorsSelect = control.querySelector('.location-colors-select');
            
            if (locationSelect && locationSelect.value) {
                console.log(`[ScreenPrintIntegration] Updating location ${index}: ${locationSelect.value} with ${colorsSelect.value} colors`);
                calculator.updateAdditionalLocation(
                    index,
                    locationSelect.value,
                    colorsSelect.value
                );
            }
        });
    }
    
    // Update add location button visibility
    function updateAddLocationButton() {
        const btn = document.getElementById('sp-add-location-btn');
        const container = document.getElementById('sp-additional-locations-container');
        const currentCount = container.querySelectorAll('.location-control').length;
        
        if (currentCount >= config.maxAdditionalLocations) {
            btn.style.display = 'none';
        } else {
            btn.style.display = 'block';
        }
    }
    
    // Update pricing display
    function updatePricingDisplay(pricing) {
        // Update base price
        const basePriceLarge = document.getElementById('sp-base-price-large');
        if (basePriceLarge) {
            basePriceLarge.textContent = pricing.basePriceWithAdditional.toFixed(2);
        }
        
        // Update price subtitle
        const priceSubtitle = document.getElementById('sp-price-subtitle');
        if (priceSubtitle) {
            if (pricing.hasAdditionalLocations && pricing.additionalLocationCost > 0) {
                const totalLocations = 1 + pricing.additionalLocationBreakdown.length;
                priceSubtitle.textContent = `shirt + printing (${totalLocations} locations)`;
            } else {
                priceSubtitle.textContent = 'shirt + printing included';
            }
        }
        
        // Update setup impact
        const setupImpact = document.getElementById('sp-setup-impact');
        if (setupImpact) {
            setupImpact.textContent = '+' + config.formatCurrency(pricing.setupPerShirt);
        }
        
        // Update all-in price
        const allInPrice = document.getElementById('sp-all-in-price');
        if (allInPrice) {
            const allInValue = pricing.basePriceWithAdditional + pricing.setupPerShirt + (pricing.ltmFee / pricing.quantity);
            allInPrice.textContent = config.formatCurrency(allInValue);
        }
        
        // Update grand total
        const grandTotal = document.getElementById('sp-grand-total');
        if (grandTotal) {
            grandTotal.textContent = config.formatCurrency(pricing.grandTotal);
        }
        
        // Update setup fee
        const setupFee = document.getElementById('sp-setup-fee');
        if (setupFee) {
            setupFee.textContent = config.formatCurrency(pricing.setupFee);
        }
        
        // Update setup breakdown
        const setupBreakdown = document.getElementById('sp-setup-breakdown');
        if (setupBreakdown) {
            let breakdown = '';
            
            // Front location
            if (pricing.colors.front > 0) {
                breakdown += `• Front (${pricing.colors.front} color${pricing.colors.front > 1 ? 's' : ''} × $30): ${config.formatCurrency(pricing.colors.front * config.setupFeePerColor)}<br>`;
            }
            
            // Additional locations
            if (pricing.additionalLocationBreakdown && pricing.additionalLocationBreakdown.length > 0) {
                pricing.additionalLocationBreakdown.forEach(loc => {
                    const locationLabel = config.locationOptions.find(opt => opt.value === loc.location)?.label || loc.location;
                    breakdown += `• ${locationLabel} (${loc.totalColors} color${loc.totalColors > 1 ? 's' : ''} × $30): ${config.formatCurrency(loc.setupCost)}<br>`;
                });
                
                // Show per-piece costs for additional locations
                breakdown += '<div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #ddd;">';
                breakdown += '<small style="color: #666;"><strong>Additional Location Costs:</strong><br>';
                pricing.additionalLocationBreakdown.forEach(loc => {
                    const locationLabel = config.locationOptions.find(opt => opt.value === loc.location)?.label || loc.location;
                    breakdown += `• ${locationLabel}: +${config.formatCurrency(loc.costPerPiece)}/shirt<br>`;
                });
                breakdown += '</small></div>';
            }
            
            setupBreakdown.innerHTML = breakdown;
        }
        
        // Update LTM notice
        const ltmNotice = document.getElementById('sp-ltm-notice');
        if (ltmNotice) {
            ltmNotice.style.display = pricing.ltmFee > 0 ? 'flex' : 'none';
        }
        const ltmFee = document.getElementById('sp-ltm-fee');
        if (ltmFee) {
            ltmFee.textContent = config.formatCurrency(pricing.ltmFee);
        }
        
        // Update LTM warning
        const ltmWarning = document.getElementById('sp-ltm-warning');
        if (ltmWarning) {
            ltmWarning.style.display = pricing.ltmFee > 0 ? 'inline' : 'none';
        }
        
        // Update detailed order summary
        updateOrderSummary(pricing);
        
        // Update pricing tiers
        updatePricingTiers(pricing);
    }
    
    // Update order summary
    function updateOrderSummary(pricing) {
        const summarySection = document.getElementById('sp-order-summary');
        const summaryItems = document.getElementById('sp-summary-items');
        
        if (!summaryItems || !pricing.quantity || pricing.quantity === 0) {
            if (summarySection) summarySection.style.display = 'none';
            return;
        }
        
        // Get current state from calculator
        const calcState = calculator.getState();
        
        // Show summary section
        summarySection.style.display = 'block';
        
        let summaryHTML = `
            <div class="summary-table">
                <div class="summary-row">
                    <div class="summary-label">${pricing.quantity} × ${calcState.pricingData?.styleNumber || 'Shirts'}</div>
                    <div class="summary-value">@ ${config.formatCurrency(pricing.basePrice)} ea</div>
                    <div class="summary-total">${config.formatCurrency(pricing.basePrice * pricing.quantity)}</div>
                </div>
        `;
        
        // Add additional locations
        if (pricing.additionalLocationBreakdown && pricing.additionalLocationBreakdown.length > 0) {
            summaryHTML += '<div class="summary-section-divider"></div>';
            summaryHTML += '<div class="summary-section-title">Additional Print Locations:</div>';
            
            pricing.additionalLocationBreakdown.forEach(loc => {
                const locationLabel = config.locationOptions.find(opt => opt.value === loc.location)?.label || loc.location;
                summaryHTML += `
                    <div class="summary-row indent">
                        <div class="summary-label">${locationLabel} (${loc.colors} color${loc.colors > 1 ? 's' : ''})</div>
                        <div class="summary-value">@ ${config.formatCurrency(loc.costPerPiece)} ea</div>
                        <div class="summary-total">${config.formatCurrency(loc.costPerPiece * pricing.quantity)}</div>
                    </div>
                `;
            });
        }
        
        // Subtotal
        summaryHTML += `
            <div class="summary-row subtotal-row">
                <div class="summary-label">Subtotal:</div>
                <div class="summary-value"></div>
                <div class="summary-total">${config.formatCurrency(pricing.subtotal)}</div>
            </div>
        `;
        
        // Setup fees
        summaryHTML += '<div class="summary-section-divider"></div>';
        summaryHTML += '<div class="summary-section-title">One-Time Setup Fees:</div>';
        
        if (pricing.colors.front > 0) {
            summaryHTML += `
                <div class="summary-row indent">
                    <div class="summary-label">Front: ${pricing.colors.front} color${pricing.colors.front > 1 ? 's' : ''} × $30</div>
                    <div class="summary-value"></div>
                    <div class="summary-total">${config.formatCurrency(pricing.colors.front * config.setupFeePerColor)}</div>
                </div>
            `;
        }
        
        if (pricing.additionalLocationBreakdown) {
            pricing.additionalLocationBreakdown.forEach(loc => {
                const locationLabel = config.locationOptions.find(opt => opt.value === loc.location)?.label || loc.location;
                summaryHTML += `
                    <div class="summary-row indent">
                        <div class="summary-label">${locationLabel}: ${loc.totalColors} color${loc.totalColors > 1 ? 's' : ''} × $30</div>
                        <div class="summary-value"></div>
                        <div class="summary-total">${config.formatCurrency(loc.setupCost)}</div>
                    </div>
                `;
            });
        }
        
        summaryHTML += `
            <div class="summary-row">
                <div class="summary-label">Total Setup:</div>
                <div class="summary-value"></div>
                <div class="summary-total">${config.formatCurrency(pricing.setupFee)}</div>
            </div>
        `;
        
        // LTM fee if applicable
        if (pricing.ltmFee > 0) {
            summaryHTML += `
                <div class="summary-row">
                    <div class="summary-label">Small Order Fee:</div>
                    <div class="summary-value"></div>
                    <div class="summary-total">${config.formatCurrency(pricing.ltmFee)}</div>
                </div>
            `;
        }
        
        // Grand total
        summaryHTML += `
            <div class="summary-row grand-total-row">
                <div class="summary-label">TOTAL:</div>
                <div class="summary-value"></div>
                <div class="summary-total">${config.formatCurrency(pricing.grandTotal)}</div>
            </div>
            <div class="summary-row per-item-row">
                <div class="summary-label">Per Shirt Cost:</div>
                <div class="summary-value"></div>
                <div class="summary-total">${config.formatCurrency(pricing.totalPerShirt)}</div>
            </div>
        `;
        
        summaryHTML += '</div>';
        summaryItems.innerHTML = summaryHTML;
    }
    
    // Update pricing tiers
    function updatePricingTiers(pricing) {
        const tiersContent = document.getElementById('sp-pricing-tiers-content');
        const calcState = calculator.getState();
        
        if (!tiersContent || !pricing.tierInfo || !calcState.pricingData) return;
        
        let tiersHTML = '<div class="pricing-tiers-table">';
        
        // Header
        tiersHTML += '<table class="tiers-table"><thead><tr><th>Quantity</th>';
        
        // Add size headers
        const sizes = calcState.pricingData.uniqueSizes || [];
        sizes.forEach(size => {
            tiersHTML += `<th>${size}</th>`;
        });
        
        tiersHTML += '<th>Your Savings</th></tr></thead><tbody>';
        
        // Add tier rows
        let baseTierPrice = null;
        calcState.pricingData.tiers.forEach((tier, index) => {
            const isCurrentTier = pricing.quantity >= tier.minQty && 
                                  (tier.maxQty === null || pricing.quantity <= tier.maxQty);
            
            tiersHTML += `<tr class="${isCurrentTier ? 'current-tier' : ''}">`;
            tiersHTML += `<td class="tier-range">${tier.minQty}-${tier.maxQty || '576+'}</td>`;
            
            // Add prices for each size
            sizes.forEach(size => {
                const price = tier.prices[size];
                tiersHTML += `<td>${price ? config.formatCurrency(price) : '-'}</td>`;
            });
            
            // Calculate savings
            if (index === 0) {
                baseTierPrice = tier.prices[sizes[0]] || 0;
                tiersHTML += '<td>-</td>';
            } else {
                const currentPrice = tier.prices[sizes[0]] || 0;
                const savings = baseTierPrice - currentPrice;
                const savingsPercent = baseTierPrice > 0 ? (savings / baseTierPrice * 100).toFixed(0) : 0;
                tiersHTML += `<td class="savings">${savingsPercent}% off</td>`;
            }
            
            tiersHTML += '</tr>';
        });
        
        tiersHTML += '</tbody></table>';
        tiersHTML += '<div class="tiers-note">Prices shown are per shirt and include 1 color print on front location.</div>';
        tiersHTML += '</div>';
        
        tiersContent.innerHTML = tiersHTML;
    }
    
    // Setup initial state
    function setupInitialState() {
        // Set initial quantity
        calculator.updateQuantity(config.standardMinimum);
        
        // Set default front colors to 1 if not set
        const frontColors = document.getElementById('sp-front-colors');
        if (frontColors && frontColors.value === '0') {
            frontColors.value = '1';
            calculator.updateColors('front', 1);
        }
        
        // Check for dark garment
        const urlParams = new URLSearchParams(window.location.search);
        const color = urlParams.get('COLOR') || urlParams.get('color');
        if (color && config.isDarkGarment(color)) {
            const checkbox = document.getElementById('dark-garment-checkbox');
            if (checkbox) {
                checkbox.checked = true;
                calculator.toggleDarkGarment(true);
            }
        }
    }
    
    // Show error message
    function showError(message) {
        const errorElement = document.getElementById('sp-error-message');
        if (errorElement) {
            errorElement.textContent = message;
            errorElement.style.display = 'block';
            setTimeout(() => {
                errorElement.style.display = 'none';
            }, 5000);
        }
    }
    
    // Public API
    return {
        init,
        addLocationControl,
        removeLocationControl,
        updateLocationFromUI
    };
})();

// Initialize when ready
(function() {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => ScreenPrintIntegration.init());
    } else {
        ScreenPrintIntegration.init();
    }
})();