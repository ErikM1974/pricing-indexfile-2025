// pricing-matrix-api.js - Simple API for accessing pricing matrix data
console.log("[PRICING-MATRIX-API:LOAD] Pricing matrix API loaded");

(function() {
    "use strict";
    
    // Configuration
    const API_BASE_URL = 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api';
    
    // Initialize when DOM is ready
    document.addEventListener('DOMContentLoaded', initialize);
    
    // Initialize the pricing matrix API
    function initialize() {
        console.log("[PRICING-MATRIX-API:INIT] Initializing pricing matrix API");
        
        // Check if PricingMatrix already exists
        if (!window.PricingMatrix) {
            console.warn("[PRICING-MATRIX-API:INIT] PricingMatrix not found, creating minimal implementation");
            window.PricingMatrix = {
                getPrice: getPrice,
                getPricingData: getPricingData
            };
        }
    }
    
    // Get pricing data from the API
    async function getPricingData(styleNumber, color, embType) {
        try {
            console.log(`[PRICING-MATRIX-API:GET] Getting pricing data for ${styleNumber}, ${color}, ${embType}`);
            
            // First try to get from the specific endpoint we know works
            const response = await fetch(`${API_BASE_URL}/pricing-matrix/5`);
            
            if (response.ok) {
                const data = await response.json();
                
                // Check if this data matches our style/color/embType
                if (data && 
                    data.StyleNumber === styleNumber && 
                    data.Color === color && 
                    data.EmbellishmentType === embType) {
                    
                    console.log(`[PRICING-MATRIX-API:GET] Found matching pricing data:`, data);
                    
                    // Convert the API data format to our internal format
                    const priceMatrix = JSON.parse(data.PriceMatrix);
                    const sizeGroups = JSON.parse(data.SizeGroups);
                    
                    // Convert to our internal format
                    const rows = [];
                    
                    // Get all tier keys from the first size group
                    const firstSizeGroup = Object.keys(priceMatrix)[0];
                    const tiers = Object.keys(priceMatrix[firstSizeGroup]);
                    
                    // For each tier, create a row
                    tiers.forEach(tier => {
                        const prices = {};
                        
                        // For each size group, get the price for this tier
                        sizeGroups.forEach(sizeGroup => {
                            prices[sizeGroup] = priceMatrix[sizeGroup][tier];
                        });
                        
                        rows.push({
                            tier: tier,
                            prices: prices
                        });
                    });
                    
                    return {
                        styleNumber: data.StyleNumber,
                        color: data.Color,
                        embellishmentType: data.EmbellishmentType,
                        headers: sizeGroups,
                        rows: rows,
                        capturedAt: data.CaptureDate
                    };
                } else {
                    console.log(`[PRICING-MATRIX-API:GET] Found pricing data but it doesn't match our criteria`);
                }
            } else {
                console.warn(`[PRICING-MATRIX-API:GET] Failed to get pricing data from API: ${response.status}`);
            }
            
            // If not found or doesn't match, try to get from localStorage
            const localData = localStorage.getItem('nwca_pricing_matrix_' + styleNumber + '_' + color + '_' + embType);
            if (localData) {
                console.log(`[PRICING-MATRIX-API:GET] Found pricing data in localStorage`);
                return JSON.parse(localData);
            }
            
            console.warn(`[PRICING-MATRIX-API:GET] No pricing data found for ${styleNumber}, ${color}, ${embType}`);
            return null;
        } catch (error) {
            console.error("[PRICING-MATRIX-API:GET-ERROR] Error getting pricing matrix:", error);
            
            // Try to get from localStorage as fallback
            try {
                const localData = localStorage.getItem('nwca_pricing_matrix_' + styleNumber + '_' + color + '_' + embType);
                if (localData) {
                    console.log(`[PRICING-MATRIX-API:GET] Found pricing data in localStorage after error`);
                    return JSON.parse(localData);
                }
            } catch (e) {
                console.error("[PRICING-MATRIX-API:GET-ERROR] Error getting pricing matrix from localStorage:", e);
            }
            
            return null;
        }
    }
    
    // Get price for a specific size and quantity
    async function getPrice(styleNumber, color, embType, size, quantity) {
        try {
            console.log(`[PRICING-MATRIX-API:PRICE] Getting price for ${styleNumber}, ${color}, ${embType}, ${size}, ${quantity}`);
            
            // Try to get pricing data from the API
            const data = await getPricingData(styleNumber, color, embType);
            
            if (data) {
                // Find the appropriate quantity tier
                let tier = null;
                
                // First, try to find an exact match for the tier
                for (const row of data.rows) {
                    const tierText = row.tier;
                    
                    // Parse tier ranges
                    if (tierText.includes('-')) {
                        const [min, max] = tierText.split('-').map(t => parseInt(t.trim()));
                        
                        if (quantity >= min && quantity <= max) {
                            tier = row;
                            break;
                        }
                    } else if (tierText.includes('+')) {
                        const min = parseInt(tierText.replace('+', '').trim());
                        
                        if (quantity >= min) {
                            tier = row;
                            break;
                        }
                    } else {
                        // Single number or other format
                        const min = parseInt(tierText.trim());
                        
                        if (!isNaN(min) && quantity >= min) {
                            tier = row;
                            break;
                        }
                    }
                }
                
                // If no tier found, use the lowest tier (usually 1-23)
                if (!tier && data.rows.length > 0) {
                    console.log(`[PRICING-MATRIX-API:PRICE] No exact tier match found for quantity ${quantity}, using lowest tier`);
                    
                    // Find the tier with the lowest minimum quantity
                    let lowestMin = Number.MAX_SAFE_INTEGER;
                    let lowestTier = null;
                    
                    for (const row of data.rows) {
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
                        console.log(`[PRICING-MATRIX-API:PRICE] Using lowest tier: ${lowestTier.tier}`);
                        tier = lowestTier;
                    }
                }
                
                if (tier) {
                    console.log(`[PRICING-MATRIX-API:PRICE] Found tier:`, tier);
                    
                    // Find the price for this size
                    let sizeKey = size;
                    
                    // Handle size ranges (e.g., XS-XL)
                    if (!tier.prices[size]) {
                        // Define size order for comparison
                        const sizeOrder = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL', '6XL'];
                        const sizeIdx = sizeOrder.indexOf(size.toUpperCase());
                        
                        if (sizeIdx !== -1) {
                            for (const key in tier.prices) {
                                if (key.includes('-')) {
                                    const [start, end] = key.split('-').map(s => s.trim().toUpperCase());
                                    const startIdx = sizeOrder.indexOf(start);
                                    const endIdx = sizeOrder.indexOf(end);
                                    
                                    if (startIdx !== -1 && endIdx !== -1 && 
                                        sizeIdx >= startIdx && sizeIdx <= endIdx) {
                                        sizeKey = key;
                                        console.log(`[PRICING-MATRIX-API:PRICE] Size ${size} matches range ${key}`);
                                        break;
                                    }
                                }
                            }
                        }
                    }
                    
                    const price = tier.prices[sizeKey];
                    
                    if (price) {
                        console.log(`[PRICING-MATRIX-API:PRICE] Found price for ${size} (using key ${sizeKey}): $${price}`);
                        return price;
                    } else {
                        console.log(`[PRICING-MATRIX-API:PRICE] No price found for ${size} (tried key ${sizeKey})`);
                    }
                } else {
                    console.log(`[PRICING-MATRIX-API:PRICE] No tier found for quantity ${quantity}`);
                }
            } else {
                console.log(`[PRICING-MATRIX-API:PRICE] No pricing data found for ${styleNumber}, ${color}, ${embType}`);
            }
            
            // Fallback to default pricing
            const defaultPrice = getDefaultPrice(size, quantity, embType);
            console.log(`[PRICING-MATRIX-API:PRICE] Using default price: $${defaultPrice}`);
            return defaultPrice;
        } catch (error) {
            console.error("[PRICING-MATRIX-API:PRICE-ERROR] Error getting price:", error);
            const defaultPrice = getDefaultPrice(size, quantity, embType);
            console.log(`[PRICING-MATRIX-API:PRICE] Using default price after error: $${defaultPrice}`);
            return defaultPrice;
        }
    }
    
    // Get default price when pricing data is not available
    function getDefaultPrice(size, quantity, embType) {
        // Base price by size
        let basePrice = 18.00; // Default for S-XL
        const upperSize = size.toUpperCase();
        
        if (upperSize === '2XL' || upperSize === 'XXL') {
            basePrice = 22.00;
        } else if (upperSize === '3XL') {
            basePrice = 23.00;
        } else if (upperSize === '4XL') {
            basePrice = 25.00;
        }
        
        // Apply quantity discount
        if (quantity >= 72) {
            basePrice -= 2.00;
        } else if (quantity >= 48) {
            basePrice -= 1.00;
        }
        
        // Add embellishment cost
        let embCost = 0;
        
        if (embType === 'embroidery' || embType === 'cap-embroidery') {
            embCost = 3.50;
        } else if (embType === 'dtg' || embType === 'dtf') {
            embCost = 4.00;
        } else if (embType === 'screen-print') {
            embCost = 2.50;
        }
        
        return basePrice + embCost;
    }
    
    // Initialize if document is already loaded
    if (document.readyState !== 'loading') {
        initialize();
    }
    
    // Expose public API
    window.PricingMatrixAPI = {
        getPrice: getPrice,
        getPricingData: getPricingData
    };
})();