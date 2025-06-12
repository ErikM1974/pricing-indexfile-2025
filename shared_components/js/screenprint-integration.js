// Screen Print Integration Module
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
        
        console.log('[ScreenPrintIntegration] Initializing');
        
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
        isInitialized = true;
        
        console.log('[ScreenPrintIntegration] Initialization complete');
    }
    
    // Create the pricing interface
    function createPricingInterface() {
        const container = document.getElementById('add-to-cart-section');
        if (!container) {
            console.error('[ScreenPrintIntegration] Add to cart section not found');
            return;
        }
        
        container.innerHTML = `
            <div class="screenprint-pricing-interface">
                <!-- Color Selection -->
                <div class="sp-controls-section">
                    <h3 class="section-title">Configure Your Screen Print Order</h3>
                    
                    <div class="sp-color-controls">
                        <div class="sp-location-group">
                            <label for="sp-front-colors">Front Design Colors:</label>
                            <select id="sp-front-colors" class="sp-color-select">
                                <option value="0">No Front Print</option>
                                ${config.colorOptions.map(opt => 
                                    `<option value="${opt.value}">${opt.label}</option>`
                                ).join('')}
                            </select>
                        </div>
                        
                        <div class="sp-location-toggle">
                            <label>
                                <input type="checkbox" id="sp-add-back-print">
                                Add Back/Second Location Print
                            </label>
                        </div>
                        
                        <div class="sp-location-group" id="sp-back-colors-group" style="display: none;">
                            <label for="sp-back-colors">Back Design Colors:</label>
                            <select id="sp-back-colors" class="sp-color-select">
                                <option value="0">No Back Print</option>
                                ${config.colorOptions.map(opt => 
                                    `<option value="${opt.value}">${opt.label}</option>`
                                ).join('')}
                            </select>
                        </div>
                        
                        <div class="sp-dark-garment-toggle">
                            <label>
                                <input type="checkbox" id="dark-garment-checkbox">
                                Dark garment (needs white underbase)
                            </label>
                            <span class="help-text">${config.messages.darkGarmentNote}</span>
                        </div>
                    </div>
                    
                    <div class="sp-quantity-group">
                        <label for="sp-quantity-input">Quantity:</label>
                        <input type="number" 
                               id="sp-quantity-input" 
                               min="${config.minimumQuantity}" 
                               value="${config.standardMinimum}" 
                               step="1">
                        <span id="sp-ltm-warning" class="warning-text" style="display: none;">
                            ${config.messages.ltmWarning}
                        </span>
                    </div>
                </div>
                
                <!-- Pricing Display -->
                <div class="sp-pricing-display">
                    <h3 class="section-title">Your Pricing</h3>
                    
                    <!-- Main Price Display -->
                    <div class="sp-hero-price-box">
                        <div class="sp-base-price-display">
                            <span class="sp-currency-symbol">$</span>
                            <span id="sp-base-price-large">0.00</span>
                            <span class="sp-price-label">per shirt</span>
                        </div>
                        <div class="sp-price-subtitle">shirt + printing included</div>
                        
                        <div class="sp-all-in-price">
                            <span class="sp-all-in-label">with setup:</span>
                            <span id="sp-all-in-price">$0.00</span>
                            <span class="sp-all-in-suffix">/shirt</span>
                        </div>
                        
                        <div class="sp-total-order">
                            <span>Total order:</span>
                            <span id="sp-grand-total">$0.00</span>
                        </div>
                    </div>
                    
                    <!-- Setup Fee Details -->
                    <div class="sp-setup-details">
                        <div class="sp-setup-header">
                            <span class="sp-setup-title">One-time Setup Investment:</span>
                            <span id="sp-setup-fee" class="sp-setup-amount">$0.00</span>
                        </div>
                        <div class="setup-breakdown" id="sp-setup-breakdown"></div>
                        
                        <div class="sp-setup-impact">
                            <div class="sp-impact-icon">ℹ️</div>
                            <div class="sp-impact-message">
                                <div id="sp-setup-impact-text">Setup cost impact decreases with quantity:</div>
                                <div class="sp-impact-examples" id="sp-impact-examples">
                                    <!-- Dynamic examples will be inserted here -->
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Small Order Fee (if applicable) -->
                    <div class="sp-ltm-notice" id="sp-ltm-notice" style="display: none;">
                        <span class="sp-ltm-icon">⚠️</span>
                        <span>Small order fee applies:</span>
                        <span id="sp-ltm-fee">$50.00</span>
                    </div>
                    
                    <!-- Hidden elements for compatibility -->
                    <div style="display: none;">
                        <span id="sp-quantity-display">${config.standardMinimum}</span>
                        <span id="sp-base-price">$0.00</span>
                        <span id="sp-subtotal">$0.00</span>
                    </div>
                </div>
                    
                    <!-- Quantity Savings Calculator -->
                    <div class="sp-savings-calculator">
                        <button type="button" id="sp-toggle-savings" class="sp-savings-toggle">
                            💡 See how quantity affects your price
                        </button>
                        <div id="sp-savings-details" style="display: none;">
                            <div class="sp-savings-content">
                                <div class="sp-savings-header">Order more, save more:</div>
                                <div id="sp-quantity-savings">
                                    <!-- Dynamic savings calculations will be shown here -->
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Error Messages -->
                    <div id="sp-error-message" class="error-message" style="display: none;"></div>
                </div>
                
                <!-- Detailed Breakdown (Optional) -->
                <div class="sp-detailed-breakdown">
                    <button type="button" id="sp-toggle-breakdown" class="link-button">
                        ▼ View Detailed Pricing Breakdown
                    </button>
                    <div id="sp-breakdown-content" style="display: none;">
                        <!-- Pricing tiers table will be shown here -->
                    </div>
                </div>
            </div>
        `;
        
        // Add styles
        addStyles();
    }
    
    // Add component styles
    function addStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .screenprint-pricing-interface {
                max-width: 800px;
                margin: 0 auto;
                padding: 20px;
            }
            
            .sp-controls-section, .sp-pricing-display {
                background: var(--background-light, #f8f9fa);
                border-radius: var(--radius-md, 8px);
                padding: 20px;
                margin-bottom: 20px;
            }
            
            .sp-color-controls {
                display: flex;
                flex-direction: column;
                gap: 15px;
                margin-bottom: 20px;
            }
            
            .sp-location-group {
                display: flex;
                align-items: center;
                gap: 10px;
            }
            
            .sp-location-group label {
                min-width: 150px;
                font-weight: 500;
            }
            
            .sp-color-select {
                flex: 1;
                max-width: 200px;
                padding: 8px;
                border: 1px solid var(--border-color, #ddd);
                border-radius: var(--radius-sm, 4px);
            }
            
            .sp-location-toggle, .sp-dark-garment-toggle {
                display: flex;
                align-items: center;
                gap: 10px;
            }
            
            .sp-location-toggle label, .sp-dark-garment-toggle label {
                display: flex;
                align-items: center;
                gap: 8px;
                font-weight: 500;
                cursor: pointer;
            }
            
            .help-text {
                font-size: 0.85em;
                color: #666;
                font-style: italic;
            }
            
            .sp-quantity-group {
                display: flex;
                align-items: center;
                gap: 10px;
                margin-top: 20px;
            }
            
            .sp-quantity-group label {
                font-weight: 500;
            }
            
            #sp-quantity-input {
                width: 100px;
                padding: 8px;
                border: 1px solid var(--border-color, #ddd);
                border-radius: var(--radius-sm, 4px);
                font-size: 1.1em;
            }
            
            .warning-text {
                color: #ff6b6b;
                font-size: 0.9em;
            }
            
            /* Hero Price Display */
            .sp-hero-price-box {
                background: white;
                border-radius: var(--radius-md, 8px);
                padding: 30px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.1);
                text-align: center;
                margin-bottom: 20px;
                border: 2px solid var(--primary-color, #2e5827);
            }
            
            .sp-base-price-display {
                display: flex;
                align-items: baseline;
                justify-content: center;
                margin-bottom: 5px;
            }
            
            .sp-currency-symbol {
                font-size: 28px;
                font-weight: 600;
                color: var(--primary-color, #2e5827);
                margin-right: 2px;
            }
            
            #sp-base-price-large {
                font-size: 48px;
                font-weight: bold;
                color: var(--primary-color, #2e5827);
                line-height: 1;
            }
            
            .sp-price-label {
                font-size: 20px;
                font-weight: 500;
                margin-left: 8px;
                color: #333;
            }
            
            .sp-price-subtitle {
                font-size: 14px;
                color: #666;
                margin-bottom: 20px;
                font-style: italic;
            }
            
            .sp-all-in-price {
                font-size: 18px;
                color: #555;
                margin-bottom: 10px;
                padding: 10px;
                background: #f8f9fa;
                border-radius: var(--radius-sm, 4px);
                display: inline-block;
            }
            
            .sp-all-in-label {
                font-weight: 500;
                margin-right: 5px;
            }
            
            #sp-all-in-price {
                font-weight: bold;
                color: #333;
            }
            
            .sp-total-order {
                font-size: 16px;
                color: #666;
            }
            
            #sp-grand-total {
                font-weight: 600;
                color: #333;
            }
            
            /* Setup Details */
            .sp-setup-details {
                background: #f8f9fa;
                border-radius: var(--radius-sm, 4px);
                padding: 20px;
                margin-bottom: 20px;
            }
            
            .sp-setup-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 10px;
                font-weight: 600;
            }
            
            .sp-setup-title {
                color: #333;
            }
            
            .sp-setup-amount {
                font-size: 20px;
                color: var(--primary-color, #2e5827);
            }
            
            .setup-breakdown {
                padding-left: 20px;
                font-size: 0.9em;
                color: #666;
                margin-bottom: 15px;
                line-height: 1.6;
            }
            
            .sp-setup-impact {
                display: flex;
                gap: 10px;
                padding: 15px;
                background: white;
                border-radius: var(--radius-sm, 4px);
                border: 1px solid #e0e0e0;
            }
            
            .sp-impact-icon {
                font-size: 20px;
                flex-shrink: 0;
            }
            
            .sp-impact-message {
                flex: 1;
            }
            
            #sp-setup-impact-text {
                font-weight: 500;
                margin-bottom: 8px;
                color: #333;
            }
            
            .sp-impact-examples {
                font-size: 0.9em;
                color: #666;
                line-height: 1.5;
            }
            
            /* LTM Notice */
            .sp-ltm-notice {
                display: flex;
                align-items: center;
                gap: 10px;
                padding: 12px;
                background: #fff3cd;
                border: 1px solid #ffeeba;
                border-radius: var(--radius-sm, 4px);
                color: #856404;
                margin-bottom: 20px;
            }
            
            .sp-ltm-icon {
                font-size: 18px;
            }
            
            /* Savings Calculator */
            .sp-savings-calculator {
                text-align: center;
                margin-top: 20px;
            }
            
            .sp-savings-toggle {
                background: var(--primary-light, #e8f5e9);
                border: 1px solid var(--primary-color, #2e5827);
                color: var(--primary-color, #2e5827);
                padding: 10px 20px;
                border-radius: var(--radius-sm, 4px);
                cursor: pointer;
                font-size: 1em;
                font-weight: 500;
                transition: all 0.3s ease;
            }
            
            .sp-savings-toggle:hover {
                background: var(--primary-color, #2e5827);
                color: white;
            }
            
            .sp-savings-content {
                margin-top: 15px;
                padding: 20px;
                background: white;
                border-radius: var(--radius-sm, 4px);
                border: 1px solid #e0e0e0;
            }
            
            .sp-savings-header {
                font-weight: 600;
                margin-bottom: 15px;
                color: #333;
            }
            
            #sp-quantity-savings {
                text-align: left;
            }
            
            .sp-savings-row {
                display: flex;
                justify-content: space-between;
                padding: 8px 0;
                border-bottom: 1px solid #f0f0f0;
            }
            
            .sp-savings-row:last-child {
                border-bottom: none;
            }
            
            .sp-savings-qty {
                font-weight: 500;
            }
            
            .sp-savings-price {
                color: var(--primary-color, #2e5827);
                font-weight: 600;
            }
            
            .sp-savings-note {
                font-size: 0.85em;
                color: #666;
            }
            
            .sp-detailed-breakdown {
                text-align: center;
                margin-top: 20px;
            }
            
            .link-button {
                background: none;
                border: none;
                color: var(--primary-color, #2e5827);
                text-decoration: underline;
                cursor: pointer;
                font-size: 1em;
                padding: 5px;
            }
            
            .link-button:hover {
                opacity: 0.8;
            }
            
            .error-message {
                background: #ffebee;
                color: #c62828;
                padding: 10px;
                border-radius: var(--radius-sm, 4px);
                margin-top: 15px;
            }
            
            @media (max-width: 768px) {
                .sp-location-group {
                    flex-direction: column;
                    align-items: flex-start;
                }
                
                .sp-location-group label {
                    min-width: auto;
                }
                
                .sp-color-select {
                    max-width: 100%;
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
        
        // Savings calculator toggle
        document.addEventListener('click', (e) => {
            if (e.target.id === 'sp-toggle-savings') {
                toggleSavingsCalculator();
            }
        });
        
        // Breakdown toggle
        document.addEventListener('click', (e) => {
            if (e.target.id === 'sp-toggle-breakdown') {
                toggleBreakdown();
            }
        });
        
        // Listen for pricing updates
        document.addEventListener('screenPrintPricingCalculated', (e) => {
            updateSetupFeeDisplay(e.detail);
        });
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
    
    // Update setup fee display
    function updateSetupFeeDisplay(pricing) {
        const setupFeeTotal = document.getElementById('sp-setup-fee-total');
        if (setupFeeTotal) {
            setupFeeTotal.textContent = pricing.setupFee.toFixed(0);
        }
        
        // Update quantity references
        document.querySelectorAll('.sp-qty-ref').forEach(el => {
            el.textContent = pricing.quantity;
        });
    }
    
    // Toggle detailed breakdown
    function toggleBreakdown() {
        const button = document.getElementById('sp-toggle-breakdown');
        const content = document.getElementById('sp-breakdown-content');
        const pricingGrid = document.getElementById('custom-pricing-grid');
        
        if (content.style.display === 'none') {
            // Show breakdown
            if (pricingGrid) {
                content.innerHTML = pricingGrid.outerHTML;
            } else {
                content.innerHTML = '<p>Pricing breakdown not available</p>';
            }
            content.style.display = 'block';
            button.textContent = '▲ Hide Detailed Pricing Breakdown';
        } else {
            // Hide breakdown
            content.style.display = 'none';
            button.textContent = '▼ View Detailed Pricing Breakdown';
        }
    }
    
    // Toggle savings calculator
    function toggleSavingsCalculator() {
        const button = document.getElementById('sp-toggle-savings');
        const details = document.getElementById('sp-savings-details');
        
        if (details.style.display === 'none') {
            // Calculate and show savings
            showQuantitySavings();
            details.style.display = 'block';
            button.textContent = '🔼 Hide quantity savings';
        } else {
            // Hide savings
            details.style.display = 'none';
            button.textContent = '💡 See how quantity affects your price';
        }
    }
    
    // Show quantity savings
    function showQuantitySavings() {
        const savingsDiv = document.getElementById('sp-quantity-savings');
        if (!savingsDiv) return;
        
        const currentPricing = calculator.getCurrentPricing();
        const quantities = [48, 72, 96, 144, 200, 300];
        let savingsHTML = '';
        
        quantities.forEach(qty => {
            // Calculate pricing for this quantity
            const oldQty = currentPricing.quantity;
            calculator.updateQuantity(qty);
            const qtyPricing = calculator.getCurrentPricing();
            
            const allInPrice = qtyPricing.basePrice + (qtyPricing.setupFee / qty) + (qtyPricing.ltmFee / qty);
            const totalPrice = qtyPricing.grandTotal;
            
            savingsHTML += '<div class="sp-savings-row">';
            savingsHTML += `<span class="sp-savings-qty">${qty} shirts:</span>`;
            savingsHTML += `<span class="sp-savings-price">${config.formatCurrency(allInPrice)}/shirt</span>`;
            
            if (qty === currentPricing.quantity) {
                savingsHTML += '<span class="sp-savings-note"> (current)</span>';
            } else if (qty > currentPricing.quantity) {
                const currentAllIn = currentPricing.basePrice + (currentPricing.setupFee / currentPricing.quantity) + (currentPricing.ltmFee / currentPricing.quantity);
                const savings = currentAllIn - allInPrice;
                if (savings > 0) {
                    savingsHTML += `<span class="sp-savings-note"> Save ${config.formatCurrency(savings)}/shirt</span>`;
                }
            }
            
            savingsHTML += '</div>';
            
            // Restore original quantity
            calculator.updateQuantity(oldQty);
        });
        
        savingsDiv.innerHTML = savingsHTML;
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