// Screen Print Calculator Module
// Handles pricing calculations for screen print orders

window.ScreenPrintCalculator = (function() {
    'use strict';
    
    const config = window.ScreenPrintConfig;
    
    // State management
    let state = {
        quantity: 48,
        frontColors: 0,
        backColors: 0,
        isDarkGarment: false,
        includeSetupInPrice: false,
        setupDivisionQuantity: 48,
        currentGarmentColor: '',
        basePrice: 0,
        pricingData: null
    };
    
    // Initialize calculator
    function init() {
        console.log('[ScreenPrintCalculator] Initializing');
        bindEventListeners();
        
        // Get initial garment color from URL
        const urlParams = new URLSearchParams(window.location.search);
        const color = urlParams.get('COLOR') || urlParams.get('color');
        if (color) {
            updateGarmentColor(color);
        }
    }
    
    // Bind event listeners
    function bindEventListeners() {
        // Listen for pricing data updates
        document.addEventListener('pricingDataLoaded', handlePricingDataUpdate);
        
        // Listen for color selection changes
        document.addEventListener('productColorChanged', (event) => {
            if (event.detail && event.detail.color) {
                updateGarmentColor(event.detail.color);
            }
        });
    }
    
    // Update garment color and check if dark
    function updateGarmentColor(color) {
        state.currentGarmentColor = color;
        state.isDarkGarment = config.isDarkGarment(color);
        
        // Auto-check dark garment checkbox if exists
        const darkGarmentCheckbox = document.getElementById('dark-garment-checkbox');
        if (darkGarmentCheckbox) {
            darkGarmentCheckbox.checked = state.isDarkGarment;
        }
        
        recalculatePricing();
    }
    
    // Handle pricing data updates
    function handlePricingDataUpdate(event) {
        if (event.detail && event.detail.embellishmentType === 'screen-print') {
            console.log('[ScreenPrintCalculator] Received pricing data', event.detail);
            state.pricingData = event.detail;
            recalculatePricing();
        }
    }
    
    // Update quantity
    function updateQuantity(qty) {
        const quantity = parseInt(qty) || 0;
        
        if (quantity < config.minimumQuantity) {
            showError(config.messages.minimumError);
            return false;
        }
        
        state.quantity = quantity;
        state.setupDivisionQuantity = quantity; // Default to same
        recalculatePricing();
        return true;
    }
    
    // Update color counts
    function updateColors(location, count) {
        const colorCount = parseInt(count) || 0;
        
        if (location === 'front') {
            state.frontColors = colorCount;
        } else if (location === 'back') {
            state.backColors = colorCount;
        }
        
        recalculatePricing();
    }
    
    // Toggle dark garment
    function toggleDarkGarment(isDark) {
        state.isDarkGarment = isDark;
        recalculatePricing();
    }
    
    // Toggle setup fee inclusion
    function toggleSetupInPrice(include) {
        state.includeSetupInPrice = include;
        updatePricingDisplay();
    }
    
    // Update setup division quantity
    function updateSetupDivisionQuantity(qty) {
        const quantity = parseInt(qty) || 1;
        state.setupDivisionQuantity = Math.max(1, quantity);
        updatePricingDisplay();
    }
    
    // Calculate total colors including white base
    function calculateTotalColors() {
        let frontTotal = state.frontColors;
        let backTotal = state.backColors;
        
        if (state.isDarkGarment && (frontTotal > 0 || backTotal > 0)) {
            if (frontTotal > 0) frontTotal += 1; // Add white base
            if (backTotal > 0) backTotal += 1; // Add white base
        }
        
        return { front: frontTotal, back: backTotal, total: frontTotal + backTotal };
    }
    
    // Calculate pricing
    function calculatePricing() {
        const colors = calculateTotalColors();
        const setupFee = config.calculateSetupFee(colors.front, colors.back);
        
        // Get base price from pricing data
        let basePrice = 0;
        let tierInfo = null;
        
        if (state.pricingData && state.pricingData.tiers) {
            // Find appropriate tier based on quantity
            tierInfo = state.pricingData.tiers.find(tier => {
                return state.quantity >= tier.minQty && 
                       (tier.maxQty === null || state.quantity <= tier.maxQty);
            });
            
            if (tierInfo && tierInfo.prices) {
                // Get price for the selected size or use first available
                const sizes = Object.keys(tierInfo.prices);
                basePrice = tierInfo.prices[sizes[0]] || 0;
            }
        }
        
        // Calculate totals
        const subtotal = basePrice * state.quantity;
        const ltmFee = (state.quantity < config.ltmThreshold) ? config.ltmFee : 0;
        const totalSetup = setupFee;
        const grandTotal = subtotal + totalSetup + ltmFee;
        
        // Per shirt calculations
        const setupPerShirt = totalSetup / state.setupDivisionQuantity;
        const totalPerShirt = state.includeSetupInPrice ? 
            (basePrice + setupPerShirt) : basePrice;
        
        return {
            quantity: state.quantity,
            colors: colors,
            basePrice: basePrice,
            subtotal: subtotal,
            setupFee: totalSetup,
            setupPerShirt: setupPerShirt,
            ltmFee: ltmFee,
            grandTotal: grandTotal,
            totalPerShirt: totalPerShirt,
            tierInfo: tierInfo,
            hasBackPrint: state.backColors > 0
        };
    }
    
    // Recalculate and update display
    function recalculatePricing() {
        const pricing = calculatePricing();
        updatePricingDisplay(pricing);
        
        // Dispatch event for other components
        document.dispatchEvent(new CustomEvent('screenPrintPricingCalculated', {
            detail: pricing
        }));
    }
    
    // Update pricing display
    function updatePricingDisplay(pricing = null) {
        if (!pricing) {
            pricing = calculatePricing();
        }
        
        // Update all pricing elements
        const elements = {
            quantity: document.getElementById('sp-quantity-display'),
            basePrice: document.getElementById('sp-base-price'),
            subtotal: document.getElementById('sp-subtotal'),
            setupFee: document.getElementById('sp-setup-fee'),
            setupBreakdown: document.getElementById('sp-setup-breakdown'),
            ltmFee: document.getElementById('sp-ltm-fee'),
            ltmWarning: document.getElementById('sp-ltm-warning'),
            grandTotal: document.getElementById('sp-grand-total'),
            perShirtPrice: document.getElementById('sp-per-shirt-price'),
            setupPerShirt: document.getElementById('sp-setup-per-shirt'),
            setupDivisionQty: document.getElementById('sp-setup-division-qty')
        };
        
        // Update quantity
        if (elements.quantity) {
            elements.quantity.textContent = pricing.quantity;
        }
        
        // Update base price and subtotal
        if (elements.basePrice) {
            elements.basePrice.textContent = config.formatCurrency(pricing.basePrice);
        }
        if (elements.subtotal) {
            elements.subtotal.textContent = config.formatCurrency(pricing.subtotal);
        }
        
        // Update setup fee with breakdown
        if (elements.setupFee) {
            elements.setupFee.textContent = config.formatCurrency(pricing.setupFee);
        }
        if (elements.setupBreakdown) {
            let breakdown = '';
            if (pricing.colors.front > 0) {
                breakdown += `Front (${pricing.colors.front} color${pricing.colors.front > 1 ? 's' : ''}): ${config.formatCurrency(pricing.colors.front * config.setupFeePerColor)}`;
            }
            if (pricing.colors.back > 0) {
                if (breakdown) breakdown += '<br>';
                breakdown += `Back (${pricing.colors.back} color${pricing.colors.back > 1 ? 's' : ''}): ${config.formatCurrency(pricing.colors.back * config.setupFeePerColor)}`;
            }
            elements.setupBreakdown.innerHTML = breakdown;
        }
        
        // Update LTM fee
        if (elements.ltmFee) {
            elements.ltmFee.textContent = config.formatCurrency(pricing.ltmFee);
            elements.ltmFee.parentElement.style.display = pricing.ltmFee > 0 ? 'flex' : 'none';
        }
        if (elements.ltmWarning) {
            elements.ltmWarning.style.display = pricing.ltmFee > 0 ? 'block' : 'none';
        }
        
        // Update grand total
        if (elements.grandTotal) {
            elements.grandTotal.textContent = config.formatCurrency(pricing.grandTotal);
        }
        
        // Update per shirt pricing
        if (elements.perShirtPrice) {
            elements.perShirtPrice.textContent = config.formatCurrency(pricing.totalPerShirt);
        }
        if (elements.setupPerShirt) {
            elements.setupPerShirt.textContent = config.formatCurrency(pricing.setupPerShirt);
        }
        if (elements.setupDivisionQty) {
            elements.setupDivisionQty.value = state.setupDivisionQuantity;
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
        } else {
            alert(message);
        }
    }
    
    // Get current pricing
    function getCurrentPricing() {
        return calculatePricing();
    }
    
    // Public API
    return {
        init,
        updateQuantity,
        updateColors,
        toggleDarkGarment,
        toggleSetupInPrice,
        updateSetupDivisionQuantity,
        getCurrentPricing,
        recalculatePricing
    };
})();

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => ScreenPrintCalculator.init());
} else {
    ScreenPrintCalculator.init();
}