// cart-price-recalculator.js - Recalculates prices based on total quantity for embellishment type
console.log("[PRICE-RECALC:LOAD] Cart price recalculator loaded");

(function() {
    "use strict";
    
    // Constants
    const API_BASE_URL = '/api'; // Use relative URL to hit the local Express server instead of direct Caspio URL
    // const LTM_FEE = 50.00; // Less Than Minimum fee - Now from app-config.js
    // const LTM_THRESHOLD = 24; // Threshold for LTM fee - Now from app-config.js

    function getLtmConfig(embellishmentType) {
        const feesConfig = window.NWCA_APP_CONFIG?.FEES || {};
        if (embellishmentType === 'cap-embroidery') {
            return {
                threshold: feesConfig.LTM_CAP_MINIMUM_QUANTITY || 24,
                feeAmount: feesConfig.LTM_CAP_FEE_AMOUNT || 50.00
            };
        }
        return {
            threshold: feesConfig.LTM_GENERAL_THRESHOLD || 24,
            feeAmount: feesConfig.LTM_GENERAL_FEE_AMOUNT || 50.00
        };
    }
    
    /**
     * Get pricing tier description based on quantity
     * @param {number} quantity - The total quantity
     * @returns {string} - Pricing tier description
     */
    function getPricingTierForQuantity(quantity) {
        if (quantity <= 0) {
            return "N/A";
        } else if (quantity >= 1 && quantity <= 23) {
            return "1-23";
        } else if (quantity >= 24 && quantity <= 47) {
            return "24-47";
        } else if (quantity >= 48 && quantity <= 71) {
            return "48-71";
        } else if (quantity >= 72) {
            return "72+";
        } else {
            return "Unknown";
        }
    }
    
    /**
     * Calculate the Less Than Minimum (LTM) fee per item
     * @param {number} totalQuantity - Total quantity of items
     * @param {string} embellishmentType - The type of embellishment to determine specific LTM rules.
     * @returns {number} - LTM fee per item, or 0 if not applicable
     */
    function calculateLTMFeePerItem(totalQuantity, embellishmentType) {
        const ltmConfig = getLtmConfig(embellishmentType);

        if (totalQuantity < ltmConfig.threshold && totalQuantity > 0) {
            // Calculate the per-item LTM fee
            const ltmFeePerItem = ltmConfig.feeAmount / totalQuantity;
            console.log(`[PRICE-RECALC:LTM] Applying LTM fee for ${embellishmentType}: $${ltmConfig.feeAmount.toFixed(2)} ÷ ${totalQuantity} = $${ltmFeePerItem.toFixed(2)} per item`);
            return ltmFeePerItem;
        }
        return 0; // No LTM fee for quantities >= ltmConfig.threshold
    }
    
    /**
     * Check if LTM fee applies
     * @param {number} totalQuantity - Total quantity of items
     * @param {string} embellishmentType - The type of embellishment.
     * @returns {boolean} - True if LTM fee applies
     */
    function hasLTMFee(totalQuantity, embellishmentType) {
        const ltmConfig = getLtmConfig(embellishmentType);
        return totalQuantity > 0 && totalQuantity < ltmConfig.threshold;
    }
    
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
    // Accepts an optional second argument `itemsToProcess` to use a specific item list
    async function recalculatePricesForEmbellishmentType(embellishmentType, itemsToProcess = null) {
        console.log("[PRICE-RECALC:START] Recalculating prices for", embellishmentType, itemsToProcess ? "(using provided items)" : "(fetching items)");
        
        try {
            let cartItems;
            if (itemsToProcess && Array.isArray(itemsToProcess)) {
                 console.log("[PRICE-RECALC:INFO] Using provided item list:", itemsToProcess);
                 cartItems = itemsToProcess;
            } else {
                 // Check if NWCACart is available
                 if (!window.NWCACart) {
                     console.error("[PRICE-RECALC:ERROR] NWCACart not available and no items provided");
                     return false;
                 }
                 // Get all active cart items using the standard method
                 cartItems = window.NWCACart.getCartItems('Active');
                 console.log("[PRICE-RECALC:INFO] Fetched items using NWCACart.getCartItems:", cartItems);
            }
            
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
            
            // If total quantity is 0, nothing to recalculate
            if (totalQuantity === 0) {
                console.log("[PRICE-RECALC:INFO] Total quantity is 0, nothing to recalculate");
                return true;
            }
            
            // Determine pricing tier based on total quantity
            const pricingTier = getPricingTierForQuantity(totalQuantity);
            console.log(`[PRICE-RECALC:TIER] Using pricing tier ${pricingTier} for total quantity ${totalQuantity}`);
            
            // Log the items we're recalculating
            console.log("[PRICE-RECALC:ITEMS] Items to recalculate:", itemsOfType);
            
            // Log the items we're recalculating
            console.log("[PRICE-RECALC:ITEMS] Items to recalculate:", itemsOfType.map(item =>
                `${item.StyleNumber} ${item.Color} (${item.sizes?.length || 0} sizes)`));
            
            // Process all items with the same embellishment type together
            // This ensures quantity discounts apply across all styles with the same embellishment
            console.log(`[PRICE-RECALC:TOTAL] Processing all ${itemsOfType.length} items with embellishment type ${embellishmentType}`);
            console.log(`[PRICE-RECALC:TOTAL] Total quantity for ${embellishmentType}: ${totalQuantity}`);
            
            // Check if LTM fee applies
            const ltmConfig = getLtmConfig(embellishmentType);
            const ltmFeeApplies = hasLTMFee(totalQuantity, embellishmentType);
            const ltmFeePerItem = calculateLTMFeePerItem(totalQuantity, embellishmentType);
            
            if (ltmFeeApplies) {
                console.log(`[PRICE-RECALC:LTM] Less Than Minimum fee applies for ${embellishmentType}: $${ltmConfig.feeAmount.toFixed(2)} total, $${ltmFeePerItem.toFixed(2)} per item`);
            } else {
                console.log(`[PRICE-RECALC:LTM] No Less Than Minimum fee applies for ${embellishmentType} (quantity >= ${ltmConfig.threshold})`);
            }
            
            // For each item, update prices based on the total quantity across all items
            for (const item of itemsOfType) {
                console.log(`[PRICE-RECALC:ITEM] Processing item ${item.StyleNumber} ${item.Color}`);
                
                // Get pricing data for each item individually
                if (window.PricingMatrix && typeof window.PricingMatrix.getPricingData === 'function') {
                    try {
                        // Validate that the necessary components exist before proceeding
                        if (!item.StyleNumber || !item.Color || !item.ImprintType) {
                             console.error(`[PRICE-RECALC:ERROR] Missing StyleNumber, Color, or ImprintType for item. Cannot lookup pricing matrix.`, item);
                             continue; // Skip this item if key info is missing
                        }

                        // Get the session ID if available
                        const sessionID = window.NWCACart && typeof window.NWCACart.getSessionID === 'function'
                                        ? window.NWCACart.getSessionID()
                                        : null;
                        
                        // Construct the lookup URL with query parameters
                        let lookupUrl = `${API_BASE_URL}/pricing-matrix/lookup?styleNumber=${encodeURIComponent(item.StyleNumber)}&color=${encodeURIComponent(item.Color)}&embellishmentType=${encodeURIComponent(item.ImprintType)}`;
                        
                        // Add sessionID if available
                        if (sessionID) {
                            lookupUrl += `&sessionID=${encodeURIComponent(sessionID)}`;
                        }
                        
                        console.log(`[PRICE-RECALC:LOOKUP] Looking up numeric PricingMatrixID for ${item.StyleNumber} ${item.Color} ${item.ImprintType}`);
                        console.log(`[PRICE-RECALC:LOOKUP] Requesting URL: ${lookupUrl}`);
                        
                        // Fetch the numeric PricingMatrixID from the lookup endpoint
                        const lookupResponse = await fetch(lookupUrl);
                        
                        if (!lookupResponse.ok) {
                            console.error(`[PRICE-RECALC:LOOKUP-ERROR] Failed to lookup PricingMatrixID: ${lookupResponse.status} ${lookupResponse.statusText}`);
                            continue; // Skip this item if lookup fails
                        }
                        
                        const lookupData = await lookupResponse.json();
                        
                        if (!lookupData || !lookupData.pricingMatrixId) {
                            console.error(`[PRICE-RECALC:LOOKUP-ERROR] Invalid response from lookup endpoint:`, lookupData);
                            continue; // Skip this item if response is invalid
                        }
                        
                        const numericPricingMatrixId = lookupData.pricingMatrixId;
                        console.log(`[PRICE-RECALC:LOOKUP] Successfully retrieved numeric PricingMatrixID: ${numericPricingMatrixId}`);
                        
                        // Get pricing data using the numeric PricingMatrixID
                        console.log(`[PRICE-RECALC:FETCH] Fetching pricing matrix data using numeric ID: ${numericPricingMatrixId}`);
                        const pricingData = await window.PricingMatrixAPI.getPricingData(numericPricingMatrixId);
                                                
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
                                        
                                        // Check if tier.prices exists
                                        if (!tier.prices) {
                                            console.error(`[PRICE-RECALC:ERROR] tier.prices is undefined for tier ${tier.tier}`);
                                            continue;
                                        }
                                        
                                        // Handle size ranges (e.g., XS-XL)
                                        if (!tier.prices[size.Size]) {
                                            // Define size order for comparison
                                            const sizeOrder = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL', '6XL'];
                                            
                                            // Check if size.Size exists before calling toUpperCase()
                                            const sizeValue = size.Size || '';
                                            const sizeIdx = sizeOrder.indexOf(sizeValue.toString().toUpperCase());
                                            
                                            console.log(`[PRICE-RECALC:SIZE] Checking size: ${sizeValue}, index in sizeOrder: ${sizeIdx}`);
                                            
                                            if (sizeIdx !== -1) {
                                                for (const key in tier.prices) {
                                                    try {
                                                        if (key && key.includes && key.includes('-')) {
                                                            const parts = key.split('-');
                                                            if (parts.length === 2) {
                                                                const start = parts[0].trim().toUpperCase();
                                                                const end = parts[1].trim().toUpperCase();
                                                                const startIdx = sizeOrder.indexOf(start);
                                                                const endIdx = sizeOrder.indexOf(end);
                                                                
                                                                console.log(`[PRICE-RECALC:SIZE] Checking range ${key}: ${start}(${startIdx}) to ${end}(${endIdx}) for size ${sizeValue}(${sizeIdx})`);
                                                                
                                                                if (startIdx !== -1 && endIdx !== -1 &&
                                                                    sizeIdx >= startIdx && sizeIdx <= endIdx) {
                                                                    sizeKey = key;
                                                                    console.log(`[PRICE-RECALC:SIZE] Size ${sizeValue} matches range ${key}`);
                                                                    break;
                                                                }
                                                            }
                                                        }
                                                    } catch (rangeError) {
                                                        console.error(`[PRICE-RECALC:SIZE-ERROR] Error processing size range ${key}:`, rangeError);
                                                    }
                                                }
                                            }
                                        }
                                        
// Add detailed logging before price calculation
                                console.log(`[PRICE-RECALC:DEBUG] --- Processing Size: ${size.Size} for Item: ${item.StyleNumber} ${item.Color} ---`);
                                console.log(`[PRICE-RECALC:DEBUG] Retrieved Pricing Data:`, JSON.stringify(pricingData, null, 2));
                                console.log(`[PRICE-RECALC:DEBUG] Determined Tier Object:`, JSON.stringify(tier, null, 2));
                                console.log(`[PRICE-RECALC:DEBUG] Size Key for Lookup: ${sizeKey}`);
                                console.log(`[PRICE-RECALC:DEBUG] Raw Price from Tier Data (tier.prices[${sizeKey}]):`, tier.prices[sizeKey]);
                                console.log(`[PRICE-RECALC:DEBUG] LTM Applies: ${ltmFeeApplies}, LTM Fee Per Item: ${ltmFeePerItem}`);
                                        let price = tier.prices[sizeKey];
                                        
                                        // Log the price lookup result
                                        console.log(`[PRICE-RECALC:PRICE] Looking up price for size ${sizeKey}: ${price !== undefined ? '$' + price : 'not found'}`);
                                        
                                        if (price !== undefined && price !== null) {
                                            // Apply LTM fee if applicable
                                            // Ensure price is treated as a number for calculation
                                            let basePrice = parseFloat(price);
                                            if (isNaN(basePrice)) {
                                                console.error(`[PRICE-RECALC:ERROR] Price retrieved for size key '${sizeKey}' is not a valid number:`, price);
                                                continue; // Skip this size if price is invalid
                                            }
                                            
                                            let finalPrice = basePrice;
                                            let ltmFeeMessage = '';
                                            
                                            if (ltmFeeApplies) {
                                                finalPrice = basePrice + ltmFeePerItem;
                                                ltmFeeMessage = ` (base price $${basePrice.toFixed(2)} + LTM fee $${ltmFeePerItem.toFixed(2)})`;
                                            }
console.log(`[PRICE-RECALC:DEBUG] Calculated Base Price: ${basePrice.toFixed(2)}, Final Price: ${finalPrice.toFixed(2)}`); // Log calculated prices
                                            
                                            console.log(`[PRICE-RECALC:UPDATE] Updating price for ${item.StyleNumber}, ${item.Color}, ${size.Size} from $${size.UnitPrice} to $${finalPrice.toFixed(2)}${ltmFeeMessage}`);
                                            
                                            // Update price in cart and in the database
                                            size.UnitPrice = finalPrice; // Use the calculated finalPrice
                                            
                                            // Update the price in the database
                                            try {
                                                const updateUrl = `${API_BASE_URL}/cart-item-sizes/${size.SizeItemID}`;
                                                fetch(updateUrl, {
                                                    method: 'PUT',
                                                    headers: {
                                                        'Content-Type': 'application/json'
                                                    },
                                                    body: JSON.stringify({
                                                        UnitPrice: finalPrice
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