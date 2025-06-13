// Screen Print Calculator Module
// Handles pricing calculations for screen print orders

window.ScreenPrintCalculator = (function() {
    'use strict';
    
    const config = window.ScreenPrintConfig;
    
    // State management
    let state = {
        quantity: 48,
        frontColors: 0,
        additionalLocations: [], // Array of {location: 'back', colors: 2}
        isDarkGarment: false,
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
        recalculatePricing();
        return true;
    }
    
    // Update color counts
    function updateColors(location, count) {
        const colorCount = parseInt(count) || 0;
        
        if (location === 'front') {
            state.frontColors = colorCount;
            recalculatePricing();
        }
    }
    
    // Add additional location
    function addAdditionalLocation(location, colors) {
        if (state.additionalLocations.length >= config.maxAdditionalLocations) {
            showError(`Maximum ${config.maxAdditionalLocations} additional locations allowed`);
            return false;
        }
        
        state.additionalLocations.push({
            location: location,
            colors: parseInt(colors) || 1
        });
        
        recalculatePricing();
        return true;
    }
    
    // Update additional location
    function updateAdditionalLocation(index, location, colors) {
        if (index >= 0 && index < state.additionalLocations.length) {
            state.additionalLocations[index] = {
                location: location,
                colors: parseInt(colors) || 1
            };
            recalculatePricing();
        }
    }
    
    // Remove additional location
    function removeAdditionalLocation(index) {
        if (index >= 0 && index < state.additionalLocations.length) {
            state.additionalLocations.splice(index, 1);
            recalculatePricing();
        }
    }
    
    // Toggle dark garment
    function toggleDarkGarment(isDark) {
        state.isDarkGarment = isDark;
        recalculatePricing();
    }
    
    // Get state for external use
    function getState() {
        return { ...state };
    }
    
    // Calculate total colors including white base
    function calculateTotalColors() {
        let frontTotal = state.frontColors;
        let additionalTotal = 0;
        let locationDetails = [];
        
        // Add white base for front if dark garment
        if (state.isDarkGarment && frontTotal > 0) {
            frontTotal += 1;
        }
        
        // Process additional locations
        state.additionalLocations.forEach(loc => {
            let locationColors = loc.colors;
            if (state.isDarkGarment && locationColors > 0) {
                locationColors += 1; // Add white base
            }
            additionalTotal += locationColors;
            locationDetails.push({
                ...loc,
                totalColors: locationColors
            });
        });
        
        return { 
            front: frontTotal, 
            additionalTotal: additionalTotal,
            total: frontTotal + additionalTotal,
            locationDetails: locationDetails
        };
    }
    
    // Calculate pricing
    function calculatePricing() {
        const colors = calculateTotalColors();
        
        // Calculate setup fees
        let setupFee = colors.front * config.setupFeePerColor;
        colors.locationDetails.forEach(loc => {
            setupFee += loc.totalColors * config.setupFeePerColor;
        });
        
        // Get base price from pricing data
        let basePrice = 0;
        let tierInfo = null;
        let totalAdditionalLocationCost = 0;
        let additionalLocationBreakdown = [];
        
        if (state.pricingData && state.pricingData.tiers) {
            // Find appropriate tier based on quantity
            tierInfo = state.pricingData.tiers.find(tier => {
                return state.quantity >= tier.minQty && 
                       (tier.maxQty === null || tier.maxQty === undefined || state.quantity <= tier.maxQty);
            });
            
            console.log('[ScreenPrintCalculator] Found tier for quantity', state.quantity, ':', tierInfo);
            
            if (tierInfo && tierInfo.prices) {
                // Get price for the selected size or use first available
                const sizes = Object.keys(tierInfo.prices);
                if (sizes.length > 0) {
                    // Try to find a standard size (S, M, L, XL) first
                    const standardSizes = ['XL', 'L', 'M', 'S'];
                    let priceFound = false;
                    
                    for (const size of standardSizes) {
                        if (tierInfo.prices[size] !== undefined && tierInfo.prices[size] !== null) {
                            basePrice = parseFloat(tierInfo.prices[size]) || 0;
                            priceFound = true;
                            console.log('[ScreenPrintCalculator] Using price for size', size, ':', basePrice);
                            break;
                        }
                    }
                    
                    // If no standard size found, use first available
                    if (!priceFound && sizes[0]) {
                        basePrice = parseFloat(tierInfo.prices[sizes[0]]) || 0;
                        console.log('[ScreenPrintCalculator] Using price for first available size', sizes[0], ':', basePrice);
                    }
                } else {
                    console.warn('[ScreenPrintCalculator] No prices found in tier');
                }
            } else {
                console.warn('[ScreenPrintCalculator] No tier found for quantity', state.quantity);
            }
            
            // Get additional location pricing for each location
            if (state.additionalLocations.length > 0 && state.pricingData.additionalLocationPricing) {
                state.additionalLocations.forEach((loc, index) => {
                    const locationColors = colors.locationDetails[index].totalColors;
                    const colorCountStr = locationColors.toString();
                    const additionalPricing = state.pricingData.additionalLocationPricing;
                    
                    console.log(`[ScreenPrintCalculator] Looking for additional location pricing for ${loc.location} with ${colorCountStr} colors`);
                    
                    if (additionalPricing && additionalPricing.tiers) {
                        // Find the matching tier for additional location
                        const additionalTier = additionalPricing.tiers.find(tier => {
                            return state.quantity >= tier.minQty && 
                                   (tier.maxQty === null || tier.maxQty === undefined || state.quantity <= tier.maxQty);
                        });
                        
                        if (additionalTier && additionalTier.pricePerPiece !== null) {
                            const locationCost = parseFloat(additionalTier.pricePerPiece) || 0;
                            totalAdditionalLocationCost += locationCost;
                            
                            additionalLocationBreakdown.push({
                                location: loc.location,
                                colors: loc.colors,
                                totalColors: locationColors,
                                costPerPiece: locationCost,
                                setupCost: locationColors * config.setupFeePerColor
                            });
                            
                            console.log(`[ScreenPrintCalculator] ${loc.location} cost per piece: $${locationCost}`);
                        }
                    }
                });
            }
        }
        
        // Calculate totals including additional locations
        const basePriceWithAdditional = basePrice + totalAdditionalLocationCost;
        const subtotal = basePriceWithAdditional * state.quantity;
        const ltmFee = (state.quantity < config.ltmThreshold) ? config.ltmFee : 0;
        const totalSetup = setupFee;
        const grandTotal = subtotal + totalSetup + ltmFee;
        
        // Per shirt calculations  
        const setupPerShirt = totalSetup / state.quantity;
        const totalPerShirt = basePriceWithAdditional + setupPerShirt + (ltmFee / state.quantity);
        
        return {
            quantity: state.quantity,
            colors: colors,
            basePrice: basePrice,
            additionalLocationCost: totalAdditionalLocationCost,
            basePriceWithAdditional: basePriceWithAdditional,
            additionalLocationBreakdown: additionalLocationBreakdown,
            subtotal: subtotal,
            setupFee: totalSetup,
            setupPerShirt: setupPerShirt,
            ltmFee: ltmFee,
            grandTotal: grandTotal,
            totalPerShirt: totalPerShirt,
            tierInfo: tierInfo,
            hasAdditionalLocations: state.additionalLocations.length > 0
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
        
        // Update hero price display
        const basePriceLarge = document.getElementById('sp-base-price-large');
        if (basePriceLarge) {
            basePriceLarge.textContent = pricing.basePriceWithAdditional.toFixed(2);
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
            if (pricing.colors.front > 0) {
                breakdown += `Front (${pricing.colors.front} color${pricing.colors.front > 1 ? 's' : ''} × $30): ${config.formatCurrency(pricing.colors.front * config.setupFeePerColor)}`;
            }
            if (pricing.colors.back > 0) {
                if (breakdown) breakdown += '<br>';
                breakdown += `Back (${pricing.colors.back} color${pricing.colors.back > 1 ? 's' : ''} × $30): ${config.formatCurrency(pricing.colors.back * config.setupFeePerColor)}`;
            }
            setupBreakdown.innerHTML = breakdown;
        }
        
        // Update impact examples
        const impactExamples = document.getElementById('sp-impact-examples');
        if (impactExamples) {
            const examples = [
                { qty: 48, impact: pricing.setupFee / 48 },
                { qty: 96, impact: pricing.setupFee / 96 },
                { qty: 144, impact: pricing.setupFee / 144 }
            ];
            
            let examplesHTML = '';
            examples.forEach(ex => {
                const isCurrentQty = ex.qty === pricing.quantity;
                examplesHTML += `• ${ex.qty} shirts: +${config.formatCurrency(ex.impact)} per shirt`;
                if (isCurrentQty) examplesHTML += ' ← Your quantity';
                examplesHTML += '<br>';
            });
            impactExamples.innerHTML = examplesHTML;
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
        
        // Update hidden compatibility elements
        const elements = {
            quantity: document.getElementById('sp-quantity-display'),
            basePrice: document.getElementById('sp-base-price'),
            subtotal: document.getElementById('sp-subtotal')
        };
        
        if (elements.quantity) {
            elements.quantity.textContent = pricing.quantity;
        }
        if (elements.basePrice) {
            elements.basePrice.textContent = config.formatCurrency(pricing.basePrice);
        }
        if (elements.subtotal) {
            elements.subtotal.textContent = config.formatCurrency(pricing.subtotal);
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
        addAdditionalLocation,
        updateAdditionalLocation,
        removeAdditionalLocation,
        toggleDarkGarment,
        getCurrentPricing,
        recalculatePricing,
        getState
    };
})();

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => ScreenPrintCalculator.init());
} else {
    ScreenPrintCalculator.init();
}