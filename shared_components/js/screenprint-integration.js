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
                        
                        <!-- Add Back Print -->
                        <div class="control-group checkbox-group">
                            <label>
                                <input type="checkbox" id="sp-add-back-print">
                                <span>Add Back/Second Location Print</span>
                            </label>
                        </div>
                        
                        <!-- Back Colors (hidden by default) -->
                        <div class="control-group" id="sp-back-colors-group" style="display: none;">
                            <label for="sp-back-colors">Back Design Colors:</label>
                            <select id="sp-back-colors" class="control-select">
                                <option value="0">No Back Print</option>
                                ${config.colorOptions.map(opt => 
                                    `<option value="${opt.value}">${opt.label}</option>`
                                ).join('')}
                            </select>
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
                            <div class="price-subtitle">shirt + printing included</div>
                            
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
            } else if (e.target.id === 'sp-back-colors') {
                calculator.updateColors('back', e.target.value);
            }
        });
        
        // Back print toggle
        document.addEventListener('change', (e) => {
            if (e.target.id === 'sp-add-back-print') {
                const backGroup = document.getElementById('sp-back-colors-group');
                const backColors = document.getElementById('sp-back-colors');
                
                if (e.target.checked) {
                    backGroup.style.display = 'flex';
                } else {
                    backGroup.style.display = 'none';
                    backColors.value = '0';
                    calculator.updateColors('back', 0);
                }
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
    
    // Update pricing display
    function updatePricingDisplay(pricing) {
        // Update base price
        const basePriceLarge = document.getElementById('sp-base-price-large');
        if (basePriceLarge) {
            basePriceLarge.textContent = pricing.basePrice.toFixed(2);
        }
        
        // Update setup impact
        const setupImpact = document.getElementById('sp-setup-impact');
        if (setupImpact) {
            setupImpact.textContent = '+' + config.formatCurrency(pricing.setupPerShirt);
        }
        
        // Update all-in price
        const allInPrice = document.getElementById('sp-all-in-price');
        if (allInPrice) {
            const allInValue = pricing.basePrice + pricing.setupPerShirt + (pricing.ltmFee / pricing.quantity);
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
            if (pricing.colors.front > 0) {
                breakdown += `• Front (${pricing.colors.front} color${pricing.colors.front > 1 ? 's' : ''} × $30): ${config.formatCurrency(pricing.colors.front * config.setupFeePerColor)}<br>`;
            }
            if (pricing.colors.back > 0) {
                breakdown += `• Back (${pricing.colors.back} color${pricing.colors.back > 1 ? 's' : ''} × $30): ${config.formatCurrency(pricing.colors.back * config.setupFeePerColor)}`;
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
    }
    
    // Setup initial state
    function setupInitialState() {
        // Set initial quantity
        calculator.updateQuantity(config.standardMinimum);
        
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
        init
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