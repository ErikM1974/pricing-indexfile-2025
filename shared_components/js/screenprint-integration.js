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
                    
                    <div class="sp-pricing-summary">
                        <div class="pricing-line">
                            <span>Quantity:</span>
                            <span id="sp-quantity-display">${config.standardMinimum}</span>
                        </div>
                        
                        <div class="pricing-line">
                            <span>Base Price:</span>
                            <span><span id="sp-base-price">$0.00</span>/shirt × <span class="sp-qty-ref">${config.standardMinimum}</span> = <span id="sp-subtotal">$0.00</span></span>
                        </div>
                        
                        <div class="pricing-line setup-fee-line">
                            <span>Setup Fees:</span>
                            <span id="sp-setup-fee">$0.00</span>
                        </div>
                        
                        <div class="setup-breakdown" id="sp-setup-breakdown"></div>
                        
                        <div class="pricing-line ltm-fee-line" style="display: none;">
                            <span>Small Order Fee:</span>
                            <span id="sp-ltm-fee">$50.00</span>
                        </div>
                        
                        <div class="pricing-divider"></div>
                        
                        <div class="pricing-line pricing-total">
                            <span>TOTAL PRICE:</span>
                            <span id="sp-grand-total">$0.00</span>
                        </div>
                    </div>
                    
                    <!-- Setup Fee Calculator -->
                    <div class="sp-setup-calculator">
                        <label>
                            <input type="checkbox" id="sp-include-setup-toggle">
                            Spread setup cost across shirts
                        </label>
                        
                        <div id="sp-setup-spread-details" style="display: none;">
                            <div class="setup-calc-line">
                                Setup per shirt: $<span id="sp-setup-fee-total">0</span> ÷ 
                                <input type="number" 
                                       id="sp-setup-division-qty" 
                                       min="1" 
                                       value="${config.standardMinimum}" 
                                       style="width: 80px;"> 
                                shirts = <strong>$<span id="sp-setup-per-shirt">0.00</span></strong>
                            </div>
                            <div class="setup-calc-line">
                                Total per shirt: <strong>$<span id="sp-per-shirt-price">0.00</span></strong>
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
            
            .sp-pricing-summary {
                background: white;
                border-radius: var(--radius-sm, 4px);
                padding: 20px;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }
            
            .pricing-line {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 8px 0;
            }
            
            .pricing-line span:first-child {
                font-weight: 500;
            }
            
            .setup-breakdown {
                padding-left: 20px;
                font-size: 0.9em;
                color: #666;
                margin-bottom: 10px;
            }
            
            .pricing-divider {
                border-top: 2px solid var(--border-color, #ddd);
                margin: 15px 0;
            }
            
            .pricing-total {
                font-size: 1.3em;
                font-weight: bold;
                color: var(--primary-color, #2e5827);
            }
            
            .sp-setup-calculator {
                margin-top: 20px;
                padding: 15px;
                background: var(--primary-light, #e8f5e9);
                border-radius: var(--radius-sm, 4px);
            }
            
            .sp-setup-calculator label {
                display: flex;
                align-items: center;
                gap: 8px;
                font-weight: 500;
                cursor: pointer;
            }
            
            #sp-setup-spread-details {
                margin-top: 15px;
                padding: 10px;
                background: white;
                border-radius: var(--radius-sm, 4px);
            }
            
            .setup-calc-line {
                padding: 5px 0;
                display: flex;
                align-items: center;
                gap: 5px;
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
        
        // Setup inclusion toggle
        document.addEventListener('change', (e) => {
            if (e.target.id === 'sp-include-setup-toggle') {
                const details = document.getElementById('sp-setup-spread-details');
                details.style.display = e.target.checked ? 'block' : 'none';
                calculator.toggleSetupInPrice(e.target.checked);
            }
        });
        
        // Setup division quantity
        document.addEventListener('input', (e) => {
            if (e.target.id === 'sp-setup-division-qty') {
                calculator.updateSetupDivisionQuantity(e.target.value);
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