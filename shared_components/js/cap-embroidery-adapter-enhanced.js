// Enhanced Cap Embroidery Adapter with back logo support
(function() {
    'use strict';

    console.log('[CAP-EMB-ADAPTER-ENHANCED] Initializing enhanced adapter');

    // Store original calculatePricing function
    const originalCalculatePricing = window.NWCAPricingCalculator ? window.NWCAPricingCalculator.calculatePricing : null;

    // Override calculatePricing to include back logo
    if (window.NWCAPricingCalculator) {
        window.NWCAPricingCalculator.calculatePricingWithBackLogo = function(sizeQuantities, existingCartQuantity, pricingData) {
            console.log('[CAP-EMB-ADAPTER-ENHANCED] Calculating pricing with back logo support');
            
            // Get base pricing
            const basePricing = originalCalculatePricing.call(this, sizeQuantities, existingCartQuantity, pricingData);
            
            // Check if back logo is enabled
            const isBackLogoEnabled = window.CapEmbroideryBackLogoAddon && window.CapEmbroideryBackLogoAddon.isEnabled();
            
            if (!isBackLogoEnabled) {
                return basePricing;
            }
            
            // Get back logo stitch count and price from the add-on system
            const backLogoStitchCount = window.CapEmbroideryBackLogoAddon ? window.CapEmbroideryBackLogoAddon.getStitchCount() : 5000;
            const pricePerItem = window.CapEmbroideryBackLogoAddon ? window.CapEmbroideryBackLogoAddon.getPrice() : 5.00;
            
            const backLogoDetails = {
                enabled: true,
                stitchCount: backLogoStitchCount,
                pricePerItem: pricePerItem
            };
            
            console.log('[CAP-EMB-ADAPTER-ENHANCED] Adding back logo pricing:', backLogoDetails);
            
            // Add back logo price to each item
            const enhancedPricing = { ...basePricing };
            enhancedPricing.backLogoDetails = backLogoDetails;
            
            // Update items with back logo pricing
            if (enhancedPricing.items) {
                Object.keys(enhancedPricing.items).forEach(size => {
                    const item = enhancedPricing.items[size];
                    if (item.quantity > 0) {
                        // Add back logo price per item
                        item.backLogoPrice = backLogoDetails.pricePerItem;
                        item.displayUnitPrice += backLogoDetails.pricePerItem;
                        item.itemTotal = item.displayUnitPrice * item.quantity;
                    }
                });
            }
            
            // Calculate back logo total
            const totalQuantity = Object.values(enhancedPricing.items || {}).reduce((sum, item) => sum + (item.quantity || 0), 0);
            enhancedPricing.backLogoTotal = backLogoDetails.pricePerItem * totalQuantity;
            
            // Recalculate total price to include back logo
            let newTotalPrice = 0;
            Object.values(enhancedPricing.items || {}).forEach(item => {
                newTotalPrice += item.itemTotal || 0;
            });
            
            // Add any fees that were in the original calculation (like setup fee)
            // The LTM fee is already distributed into the itemTotals via ltmFeePerItem in displayUnitPrice,
            // so newTotalPrice (sum of itemTotals) already includes it.
            // We only need to add fees that are truly order-level and not per-item distributed.
            newTotalPrice += enhancedPricing.setupFee || 0;
            
            // DO NOT re-add enhancedPricing.ltmFeeTotal here, as it's already accounted for
            // in the itemTotal sum that forms newTotalPrice.
            // if (enhancedPricing.ltmFeeApplies && enhancedPricing.ltmFeeTotal) {
            //     console.log('[CAP-EMB-ADAPTER-ENHANCED] LTM fee already included in item totals. Not adding flat fee again.');
            // }
            
            enhancedPricing.totalPrice = newTotalPrice;
            enhancedPricing.totalQuantity = totalQuantity;
            
            console.log('[CAP-EMB-ADAPTER-ENHANCED] Enhanced pricing with back logo:', enhancedPricing);
            
            return enhancedPricing;
        };
        
        // Replace the original function
        window.NWCAPricingCalculator.calculatePricing = window.NWCAPricingCalculator.calculatePricingWithBackLogo;
    }

    // Enhance the add to cart data
    const originalHandleAddToCart = window.handleAddToCart;
    
    window.handleAddToCartEnhanced = async function() {
        console.log('[CAP-EMB-ADAPTER-ENHANCED] Enhancing add to cart data');
        
        // Check if back logo is enabled
        const isBackLogoEnabled = window.CapEmbroideryBackLogoAddon && window.CapEmbroideryBackLogoAddon.isEnabled();
        
        if (isBackLogoEnabled) {
            // Get back logo stitch count and price from the add-on system
            const backLogoStitchCount = window.CapEmbroideryBackLogoAddon ? window.CapEmbroideryBackLogoAddon.getStitchCount() : 5000;
            const pricePerItem = window.CapEmbroideryBackLogoAddon ? window.CapEmbroideryBackLogoAddon.getPrice() : 5.00;
            
            const backLogoDetails = {
                enabled: true,
                stitchCount: backLogoStitchCount,
                pricePerItem: pricePerItem
            };
            
            // Store back logo details for the cart
            window.capEmbroideryBackLogoDetails = backLogoDetails;
        }
        
        // Call the validation version which will call the original
        if (window.handleAddToCartWithValidation) {
            return window.handleAddToCartWithValidation.call(this);
        } else if (originalHandleAddToCart) {
            return originalHandleAddToCart.call(this);
        }
    };

    // Wait for DOM and replace handlers
    function setupHandlers() {
        setTimeout(() => {
            const addToCartBtn = document.getElementById('add-to-cart-button');
            if (addToCartBtn) {
                // Remove existing listeners
                const newBtn = addToCartBtn.cloneNode(true);
                addToCartBtn.parentNode.replaceChild(newBtn, addToCartBtn);
                
                // Add enhanced listener
                newBtn.addEventListener('click', window.handleAddToCartEnhanced);
                console.log('[CAP-EMB-ADAPTER-ENHANCED] Installed enhanced add to cart handler');
            }
        }, 2000); // Wait a bit longer to ensure other scripts have loaded
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', setupHandlers);
    } else {
        setupHandlers();
    }
})();