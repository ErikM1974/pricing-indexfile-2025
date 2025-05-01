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
        
        // Check if PricingMatrixAPI already exists
        if (!window.PricingMatrixAPI) {
            console.log("[PRICING-MATRIX-API:INIT] PricingMatrixAPI not found, creating it.");
            window.PricingMatrixAPI = {
                getPrice: getPrice, // Note: getPrice might need review based on new getPricingData logic
                getPricingData: getPricingData
            };
        } else {
             console.log("[PRICING-MATRIX-API:INIT] PricingMatrixAPI already exists.");
        }

        // Backward compatibility / alias (with warning)
        if (!window.PricingMatrix) {
             console.warn("[PRICING-MATRIX-API:INIT] Creating alias 'window.PricingMatrix'. Use 'window.PricingMatrixAPI' instead.");
             window.PricingMatrix = window.PricingMatrixAPI;
        }
    }
    
    // Get pricing data from the API using a specific matrix ID
    async function getPricingData(matrixId) {
        if (!matrixId) {
            console.error("[PRICING-MATRIX-API:GET] No matrixId provided.");
            return null;
        }

        const cacheKey = `nwca_pricing_matrix_${matrixId}`;
        let apiData = null;

        try {
            console.log(`[PRICING-MATRIX-API:GET] Getting pricing data for matrix ID: ${matrixId}`);
            
            // Construct the API URL with the specific matrix ID
            const apiUrl = `${API_BASE_URL}/pricing-matrix/${matrixId}`;
            console.log(`[PRICING-MATRIX-API:FETCH] Requesting URL: ${apiUrl}`);
            
            const response = await fetch(apiUrl);
            
            if (response.ok) {
                apiData = await response.json();
                console.log(`[PRICING-MATRIX-API:GET] Received data for matrix ID ${matrixId}:`, apiData);

                // Basic validation of received data
                if (!apiData || !apiData.PriceMatrix || !apiData.SizeGroups) {
                     console.error(`[PRICING-MATRIX-API:GET] Invalid data received from API for matrix ID ${matrixId}:`, apiData);
                     apiData = null; // Invalidate data
                } else {
                    // Cache the valid data in localStorage
                    try {
                        // Ensure data is stringified before storing
                        localStorage.setItem(cacheKey, JSON.stringify(apiData));
                        console.log(`[PRICING-MATRIX-API:CACHE] Cached data for matrix ID ${matrixId}`);
                    } catch (cacheError) {
                        console.error(`[PRICING-MATRIX-API:CACHE-ERROR] Error caching data for matrix ID ${matrixId}:`, cacheError);
                    }
                }

            } else {
                console.warn(`[PRICING-MATRIX-API:GET] Failed to get pricing data from API for matrix ID ${matrixId}: ${response.status} ${response.statusText}`);
                // Don't return here yet, try localStorage fallback
            }

        } catch (error) {
            console.error(`[PRICING-MATRIX-API:GET-ERROR] Error fetching pricing matrix ID ${matrixId}:`, error);
            // Don't return here yet, try localStorage fallback
        }

        // Fallback to localStorage if API failed or returned invalid data
        if (!apiData) {
            try {
                const localData = localStorage.getItem(cacheKey);
                if (localData) {
                    console.log(`[PRICING-MATRIX-API:GET] Found pricing data in localStorage for matrix ID ${matrixId} after API failure/error.`);
                    // Ensure localStorage data is parsed
                    apiData = JSON.parse(localData);
                } else {
                     console.warn(`[PRICING-MATRIX-API:GET] No pricing data found in localStorage for matrix ID ${matrixId} either.`);
                }
            } catch (e) {
                console.error(`[PRICING-MATRIX-API:GET-ERROR] Error getting pricing matrix from localStorage for ID ${matrixId}:`, e);
            }
        }

        // If we still don't have data, return null
        if (!apiData) {
             console.warn(`[PRICING-MATRIX-API:GET] No valid pricing data found for matrix ID ${matrixId} from API or localStorage.`);
             return null;
        }

        // Convert the API data format to our internal format
        try {
            // Ensure PriceMatrix and SizeGroups are parsed correctly
            const priceMatrix = typeof apiData.PriceMatrix === 'string' ? JSON.parse(apiData.PriceMatrix) : apiData.PriceMatrix;
            const sizeGroups = typeof apiData.SizeGroups === 'string' ? JSON.parse(apiData.SizeGroups) : apiData.SizeGroups;
            
            // Add validation after parsing
            if (!priceMatrix || typeof priceMatrix !== 'object' || !sizeGroups || !Array.isArray(sizeGroups)) {
                 console.error(`[PRICING-MATRIX-API:PARSE-ERROR] Invalid structure after parsing PriceMatrix or SizeGroups for ID ${matrixId}:`, apiData);
                 return null;
            }

            // Convert to our internal format
            const rows = [];
            
            // Get all tier keys from the first size group (assuming structure is consistent)
            const firstSizeGroupKey = Object.keys(priceMatrix)[0];
            if (!firstSizeGroupKey || !priceMatrix[firstSizeGroupKey] || typeof priceMatrix[firstSizeGroupKey] !== 'object') {
                 console.error(`[PRICING-MATRIX-API:PARSE-ERROR] Cannot determine tiers from PriceMatrix for ID ${matrixId}:`, priceMatrix);
                 return null; // Cannot proceed without tiers
            }
            const tiers = Object.keys(priceMatrix[firstSizeGroupKey]);
            
            // For each tier, create a row
            tiers.forEach(tier => {
                const prices = {};
                
                // For each size group, get the price for this tier
                sizeGroups.forEach(sizeGroup => {
                    // Handle potential missing price for a tier/size combo gracefully
                    prices[sizeGroup] = priceMatrix[sizeGroup]?.[tier] ?? null;
                    if (prices[sizeGroup] === null) {
                         console.warn(`[PRICING-MATRIX-API:PARSE] Missing price for size group '${sizeGroup}', tier '${tier}' in matrix ID ${matrixId}`);
                    }
                });
                
                rows.push({
                    tier: tier,
                    prices: prices
                });
            });
            
            const formattedData = {
                styleNumber: apiData.StyleNumber, // Keep original info for context
                color: apiData.Color,
                embellishmentType: apiData.EmbellishmentType,
                headers: sizeGroups,
                rows: rows,
                capturedAt: apiData.CaptureDate,
                matrixId: matrixId // Include the ID used
            };
            console.log(`[PRICING-MATRIX-API:GET] Successfully formatted data for matrix ID ${matrixId}:`, formattedData);
            return formattedData;

        } catch (parseError) {
             console.error(`[PRICING-MATRIX-API:PARSE-ERROR] Error parsing PriceMatrix or SizeGroups for matrix ID ${matrixId}:`, parseError, apiData);
             return null; // Return null if parsing fails
        }
    }
    
    // Get price for a specific size and quantity
    // NOTE: This function's logic might need review.
    // It currently calls getPricingData(style, color, type), which no longer exists in that form.
    // How should it get the correct matrixId to pass to the updated getPricingData(matrixId)?
    // This depends on where getPrice is called from. For now, it will likely fail or use default pricing.
    async function getPrice(styleNumber, color, embType, size, quantity) {
        try {
            console.warn(`[PRICING-MATRIX-API:PRICE] The 'getPrice' function may be outdated. It needs a matrixId but is called with style/color/type.`);
            console.log(`[PRICING-MATRIX-API:PRICE] Attempting to get price for ${styleNumber}, ${color}, ${embType}, ${size}, ${quantity} (will likely use default price without matrixId)`);
            
            // --- THIS PART NEEDS REVISION ---
            // How do we get the matrixId here?
            // Option 1: Pass matrixId into getPrice instead of style/color/type.
            // Option 2: Perform a lookup here (e.g., another API call) to find the matrixId.
            // For now, calling getPricingData without an ID will return null.
            const matrixId = null; // Placeholder - needs logic to determine the ID
            console.warn(`[PRICING-MATRIX-API:PRICE] Cannot determine matrixId for ${styleNumber}/${color}/${embType}. Fetching data will fail.`);
            const data = await getPricingData(matrixId); // This will return null
            // --- END REVISION NEEDED ---
            
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
    
    // Expose public API (already done during initialize, see lines 18-25)
})();