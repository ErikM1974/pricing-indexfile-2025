// Cap Embroidery Cart Integration
// This file integrates cap-specific validation into the cart system
(function() {
    "use strict";
    
    console.log("[CAP-EMB-CART] Cap Embroidery Cart Integration loaded");
    
    // Wait for both cart and validation modules to be ready
    function waitForDependencies(callback) {
        let checkCount = 0;
        const maxChecks = 50; // 5 seconds max
        
        const checkInterval = setInterval(() => {
            checkCount++;
            
            if (window.NWCACart && window.CapEmbroideryValidation) {
                clearInterval(checkInterval);
                callback();
            } else if (checkCount >= maxChecks) {
                clearInterval(checkInterval);
                console.error("[CAP-EMB-CART] Dependencies not loaded after 5 seconds");
            }
        }, 100);
    }
    
    // Override or enhance the addToCart function
    function enhanceAddToCart() {
        const originalAddToCart = window.NWCACart.addToCart;
        
        window.NWCACart.addToCart = async function(productData) {
            console.log("[CAP-EMB-CART] Enhanced addToCart called", productData);
            
            // Check if this is a cap embroidery item
            if (productData.embellishmentType === 'cap-embroidery' || productData.embellishmentType === 'Cap Embroidery') {
                
                // 1. Validate product title contains "Cap"
                const productTitle = productData.PRODUCT_TITLE || productData.productTitle || '';
                if (!window.CapEmbroideryValidation.isValidCapProduct(productTitle)) {
                    console.warn("[CAP-EMB-CART] Non-cap product detected:", productTitle);
                    
                    const proceed = await window.CapEmbroideryValidation.showNonCapWarning(productTitle);
                    if (!proceed) {
                        console.log("[CAP-EMB-CART] User cancelled adding non-cap product");
                        return { success: false, error: 'User cancelled - non-cap product' };
                    }
                }
                
                // 2. Enhanced stitch count validation with modal
                const newItemStitchCount = productData.embellishmentOptions?.stitchCount || 
                                         productData.stitchCount || 
                                         '8000'; // Default if not specified
                
                const activeCartItems = this.getCartItems('Active');
                const capEmbroideryItemsInCart = activeCartItems.filter(item => 
                    item.ImprintType === 'cap-embroidery' || item.ImprintType === 'Cap Embroidery'
                );
                
                if (capEmbroideryItemsInCart.length > 0) {
                    // Get existing stitch count
                    let existingStitchCount;
                    const firstCapItem = capEmbroideryItemsInCart[0];
                    
                    if (firstCapItem.EmbellishmentOptions) {
                        try {
                            const opts = typeof firstCapItem.EmbellishmentOptions === 'string' 
                                ? JSON.parse(firstCapItem.EmbellishmentOptions) 
                                : firstCapItem.EmbellishmentOptions;
                            existingStitchCount = opts.stitchCount;
                        } catch (e) {
                            console.warn("[CAP-EMB-CART] Could not parse EmbellishmentOptions", e);
                        }
                    }
                    
                    existingStitchCount = existingStitchCount || firstCapItem.stitchCount || '8000';
                    
                    // Check if stitch counts match
                    if (newItemStitchCount.toString() !== existingStitchCount.toString()) {
                        console.log("[CAP-EMB-CART] Stitch count mismatch detected");
                        
                        const action = await window.CapEmbroideryValidation.showStitchCountMismatchModal(
                            existingStitchCount,
                            newItemStitchCount
                        );
                        
                        if (action === 'cancel') {
                            console.log("[CAP-EMB-CART] User cancelled due to stitch count mismatch");
                            return { success: false, error: 'User cancelled - stitch count mismatch' };
                        } else if (action === 'clear') {
                            console.log("[CAP-EMB-CART] User chose to clear cart");
                            // Clear all cap embroidery items from cart
                            const clearResult = await this.clearCart();
                            if (!clearResult.success) {
                                return { success: false, error: 'Failed to clear cart' };
                            }
                        }
                    }
                }
                
                // Ensure stitch count is in embellishmentOptions
                if (!productData.embellishmentOptions) {
                    productData.embellishmentOptions = {};
                }
                productData.embellishmentOptions.stitchCount = newItemStitchCount;
            }
            
            // Call original addToCart
            const result = await originalAddToCart.call(this, productData);
            
            // Update LTM display if successful
            if (result.success && productData.embellishmentType === 'cap-embroidery') {
                setTimeout(() => {
                    const cartState = this.getCartState();
                    window.CapEmbroideryValidation.updateCapLTMDisplay(
                        cartState.itemCount,
                        cartState.ltmFeeTotal || 0
                    );
                }, 100);
            }
            
            return result;
        };
        
        console.log("[CAP-EMB-CART] addToCart function enhanced");
    }
    
    // Enhance cart update events to update LTM display
    function enhanceCartUpdates() {
        if (window.NWCACart && window.NWCACart.addEventListener) {
            window.NWCACart.addEventListener('cartUpdated', function() {
                // Check if we're on cap embroidery page
                const isCapEmbroideryPage = window.location.href.includes('cap-embroidery') ||
                                          document.title.toLowerCase().includes('cap embroidery');
                
                if (isCapEmbroideryPage) {
                    const cartState = window.NWCACart.getCartState();
                    const activeItems = window.NWCACart.getCartItems('Active');
                    
                    // Count only cap embroidery items
                    let capItemCount = 0;
                    activeItems.forEach(item => {
                        if (item.ImprintType === 'cap-embroidery' || item.ImprintType === 'Cap Embroidery') {
                            if (item.sizes && Array.isArray(item.sizes)) {
                                item.sizes.forEach(size => {
                                    capItemCount += parseInt(size.Quantity || size.quantity || 0);
                                });
                            }
                        }
                    });
                    
                    // Calculate LTM fee if needed
                    let ltmFeeTotal = 0;
                    if (capItemCount > 0 && capItemCount < window.CapEmbroideryValidation.MINIMUM_CAP_QUANTITY) {
                        ltmFeeTotal = window.CapEmbroideryValidation.LTM_FEE;
                    }
                    
                    window.CapEmbroideryValidation.updateCapLTMDisplay(capItemCount, ltmFeeTotal);
                }
            });
        }
    }
    
    // Initialize when dependencies are ready
    waitForDependencies(() => {
        console.log("[CAP-EMB-CART] Dependencies loaded, initializing enhancements");
        enhanceAddToCart();
        enhanceCartUpdates();
        
        // Also enhance when cart is initialized
        if (window.NWCACart.isInitialized) {
            console.log("[CAP-EMB-CART] Cart already initialized, triggering initial update");
            window.NWCACart.triggerEvent && window.NWCACart.triggerEvent('cartUpdated');
        } else {
            document.addEventListener('nwcacartInitialized', () => {
                console.log("[CAP-EMB-CART] Cart initialized, triggering initial update");
                window.NWCACart.triggerEvent && window.NWCACart.triggerEvent('cartUpdated');
            });
        }
    });
    
})();