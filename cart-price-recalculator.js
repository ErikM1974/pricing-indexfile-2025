// cart-price-recalculator.js - Recalculates prices based on total quantity for embellishment type
console.log("[PRICE-RECALC:LOAD] Cart price recalculator loaded");

(function() {
    "use strict";
    
    // Initialize when DOM is ready
    document.addEventListener('DOMContentLoaded', initialize);
    
    // Initialize the price recalculator
    function initialize() {
        console.log("[PRICE-RECALC:INIT] Initializing price recalculator");
        
        // Listen for cart item added event
        window.addEventListener('cartItemAdded', handleCartItemAdded);
        
        // Expose the recalculate function globally
        window.recalculatePricesForEmbellishmentType = recalculatePricesForEmbellishmentType;
    }
    
    // Handle cart item added event
    function handleCartItemAdded(event) {
        if (event.detail && event.detail.embellishmentType) {
            console.log("[PRICE-RECALC:EVENT] Cart item added event detected for", event.detail.embellishmentType);
            recalculatePricesForEmbellishmentType(event.detail.embellishmentType);
        }
    }
    
    // Recalculate prices for a specific embellishment type
    async function recalculatePricesForEmbellishmentType(embellishmentType) {
        console.log("[PRICE-RECALC:START] Recalculating prices for", embellishmentType);
        
        try {
            // Check if NWCACart is available
            if (!window.NWCACart) {
                console.error("[PRICE-RECALC:ERROR] NWCACart not available");
                return false;
            }
            
            // Get all active cart items
            const cartItems = window.NWCACart.getCartItems('Active');
            
            // Filter items by embellishment type
            const itemsOfType = cartItems.filter(item => item.ImprintType === embellishmentType);
            
            if (itemsOfType.length === 0) {
                console.log("[PRICE-RECALC:INFO] No items found for embellishment type", embellishmentType);
                return true;
            }
            
            // Calculate total quantity for this embellishment type
            let totalQuantity = 0;
            itemsOfType.forEach(item => {
                if (item.sizes && Array.isArray(item.sizes)) {
                    item.sizes.forEach(size => {
                        totalQuantity += parseInt(size.Quantity) || 0;
                    });
                }
            });
            
            console.log("[PRICE-RECALC:CALC] Total quantity for", embellishmentType, ":", totalQuantity);
            
            // If total quantity is 0, nothing to recalculate
            if (totalQuantity === 0) {
                console.log("[PRICE-RECALC:INFO] Total quantity is 0, nothing to recalculate");
                return true;
            }
            
            // For each item, update prices based on total quantity
            for (const item of itemsOfType) {
                if (!item.sizes || !Array.isArray(item.sizes) || item.sizes.length === 0) {
                    continue;
                }
                
                // Get pricing data from PricingMatrix if available
                if (window.PricingMatrix && typeof window.PricingMatrix.getPricingData === 'function') {
                    try {
                        const pricingData = await window.PricingMatrix.getPricingData(
                            item.StyleNumber,
                            item.Color,
                            item.ImprintType
                        );
                        
                        if (pricingData) {
                            // Find the appropriate quantity tier
                            let tier = null;
                            
                            for (const row of pricingData.rows) {
                                const tierText = row.tier;
                                
                                // Parse tier ranges
                                if (tierText.includes('-')) {
                                    const [min, max] = tierText.split('-').map(t => parseInt(t.trim()));
                                    
                                    if (totalQuantity >= min && totalQuantity <= max) {
                                        tier = row;
                                        break;
                                    }
                                } else if (tierText.includes('+')) {
                                    const min = parseInt(tierText.replace('+', '').trim());
                                    
                                    if (totalQuantity >= min) {
                                        tier = row;
                                        break;
                                    }
                                } else {
                                    // Single number or other format
                                    const min = parseInt(tierText.trim());
                                    
                                    if (!isNaN(min) && totalQuantity >= min) {
                                        tier = row;
                                        break;
                                    }
                                }
                            }
                            
                            if (tier) {
                                // Update prices for each size
                                for (const size of item.sizes) {
                                    // Find the price for this size
                                    let sizeKey = size.Size;
                                    
                                    // Handle size ranges (e.g., XS-XL)
                                    if (!tier.prices[size.Size]) {
                                        for (const key in tier.prices) {
                                            if (key.includes('-')) {
                                                const [start, end] = key.split('-').map(s => s.trim());
                                                
                                                if (size.Size >= start && size.Size <= end) {
                                                    sizeKey = key;
                                                    break;
                                                }
                                            }
                                        }
                                    }
                                    
                                    const price = tier.prices[sizeKey];
                                    
                                    if (price && price !== size.UnitPrice) {
                                        console.log(`[PRICE-RECALC:UPDATE] Updating price for ${item.StyleNumber}, ${item.Color}, ${size.Size} from $${size.UnitPrice} to $${price}`);
                                        
                                        // Update price in cart
                                        size.UnitPrice = price;
                                    }
                                }
                            }
                        }
                    } catch (error) {
                        console.error("[PRICE-RECALC:ERROR] Error getting pricing data:", error);
                    }
                }
            }
            
            // Trigger cart updated event
            if (typeof window.NWCACart.triggerCartUpdated === 'function') {
                window.NWCACart.triggerCartUpdated();
            }
            
            console.log("[PRICE-RECALC:SUCCESS] Prices recalculated successfully for", embellishmentType);
            return true;
        } catch (error) {
            console.error("[PRICE-RECALC:ERROR] Error recalculating prices:", error);
            return false;
        }
    }
    
    // Initialize
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        initialize();
    }
})();