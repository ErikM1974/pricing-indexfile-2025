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
            
            // Log the total quantity for debugging
            console.log(`[PRICE-RECALC:CALC] Total quantity for ${embellishmentType} across all items: ${totalQuantity}`);
            
            console.log("[PRICE-RECALC:CALC] Total quantity for", embellishmentType, ":", totalQuantity);
            
            // If total quantity is 0, nothing to recalculate
            if (totalQuantity === 0) {
                console.log("[PRICE-RECALC:INFO] Total quantity is 0, nothing to recalculate");
                return true;
            }
            
            // Log the items we're recalculating
            console.log("[PRICE-RECALC:ITEMS] Items to recalculate:", itemsOfType);
            
            // Log the items we're recalculating
            console.log("[PRICE-RECALC:ITEMS] Items to recalculate:", itemsOfType.map(item =>
                `${item.StyleNumber} ${item.Color} (${item.sizes?.length || 0} sizes)`));
            
            // Process all items with the same embellishment type together
            // This ensures quantity discounts apply across all styles with the same embellishment
            console.log(`[PRICE-RECALC:TOTAL] Processing all ${itemsOfType.length} items with embellishment type ${embellishmentType}`);
            console.log(`[PRICE-RECALC:TOTAL] Total quantity for ${embellishmentType}: ${totalQuantity}`);
            
            // For each item, update prices based on the total quantity across all items
            for (const item of itemsOfType) {
                console.log(`[PRICE-RECALC:ITEM] Processing item ${item.StyleNumber} ${item.Color}`);
                
                // Get pricing data for each item individually
                if (window.PricingMatrix && typeof window.PricingMatrix.getPricingData === 'function') {
                    try {
                        // Get pricing data for this specific item
                        const pricingData = await window.PricingMatrix.getPricingData(
                            item.StyleNumber,
                            item.Color,
                            item.ImprintType
                        );
                        
                        if (pricingData) {
                            // Find the appropriate quantity tier
                            let tier = null;
                            
                            // First, try to find an exact match for the tier
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
                            
                            // If no tier found, use the lowest tier (usually 1-23)
                            if (!tier && pricingData.rows.length > 0) {
                                console.log(`[PRICE-RECALC:INFO] No exact tier match found for quantity ${totalQuantity}, using lowest tier`);
                                
                                // Find the tier with the lowest minimum quantity
                                let lowestMin = Number.MAX_SAFE_INTEGER;
                                let lowestTier = null;
                                
                                for (const row of pricingData.rows) {
                                    const tierText = row.tier;
                                    let min = Number.MAX_SAFE_INTEGER;
                                    
                                    if (tierText.includes('-')) {
                                        min = parseInt(tierText.split('-')[0].trim());
                                    } else if (tierText.includes('+')) {
                                        min = parseInt(tierText.replace('+', '').trim());
                                    } else {
                                        min = parseInt(tierText.trim());
                                    }
                                    
                                    if (!isNaN(min) && min < lowestMin) {
                                        lowestMin = min;
                                        lowestTier = row;
                                    }
                                }
                                
                                if (lowestTier) {
                                    console.log(`[PRICE-RECALC:INFO] Using lowest tier: ${lowestTier.tier}`);
                                    tier = lowestTier;
                                }
                            }
                            
                            if (tier) {
                                console.log(`[PRICE-RECALC:TIER] Using tier ${tier.tier} for total quantity ${totalQuantity}`);
                                
                                // Update prices for this item
                                if (!item.sizes || !Array.isArray(item.sizes) || item.sizes.length === 0) {
                                    continue;
                                }
                                
                                // Update prices for each size
                                for (const size of item.sizes) {
                                        // Find the price for this size
                                        let sizeKey = size.Size;
                                        
                                        // Handle size ranges (e.g., XS-XL)
                                        if (!tier.prices[size.Size]) {
                                            // Define size order for comparison
                                            const sizeOrder = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL', '6XL'];
                                            const sizeIdx = sizeOrder.indexOf(size.Size.toUpperCase());
                                            
                                            if (sizeIdx !== -1) {
                                                for (const key in tier.prices) {
                                                    if (key.includes('-')) {
                                                        const [start, end] = key.split('-').map(s => s.trim().toUpperCase());
                                                        const startIdx = sizeOrder.indexOf(start);
                                                        const endIdx = sizeOrder.indexOf(end);
                                                        
                                                        if (startIdx !== -1 && endIdx !== -1 &&
                                                            sizeIdx >= startIdx && sizeIdx <= endIdx) {
                                                            sizeKey = key;
                                                            console.log(`[PRICE-RECALC:SIZE] Size ${size.Size} matches range ${key}`);
                                                            break;
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                        
                                        const price = tier.prices[sizeKey];
                                        
                                        if (price) {
                                            console.log(`[PRICE-RECALC:UPDATE] Updating price for ${item.StyleNumber}, ${item.Color}, ${size.Size} from $${size.UnitPrice} to $${price}`);
                                            
                                            // Update price in cart and in the database
                                            size.UnitPrice = price;
                                            
                                            // Update the price in the database
                                            try {
                                                const updateUrl = `https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/cart-item-sizes/${size.SizeItemID}`;
                                                fetch(updateUrl, {
                                                    method: 'PUT',
                                                    headers: {
                                                        'Content-Type': 'application/json'
                                                    },
                                                    body: JSON.stringify({
                                                        UnitPrice: price
                                                    })
                                                })
                                                .then(response => {
                                                    if (response.ok) {
                                                        console.log(`[PRICE-RECALC:DB-UPDATE] Successfully updated price in database for size ${size.Size}`);
                                                    } else {
                                                        console.error(`[PRICE-RECALC:DB-UPDATE] Failed to update price in database for size ${size.Size}: ${response.status}`);
                                                    }
                                                })
                                                .catch(error => {
                                                    console.error(`[PRICE-RECALC:DB-UPDATE] Error updating price in database:`, error);
                                                });
                                            } catch (dbError) {
                                                console.error(`[PRICE-RECALC:DB-UPDATE] Error updating price in database:`, dbError);
                                            }
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