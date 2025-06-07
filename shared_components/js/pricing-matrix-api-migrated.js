// pricing-matrix-api-migrated.js - Migrated to use unified API client
console.log("[PRICING-MATRIX-API:LOAD] Pricing matrix API loaded (migrated version)");

import { getAPIClient, API_ENDPOINTS, buildUrl } from '../../src/shared/api/index.js';
import { Logger } from '../../src/core/logger.js';

(function() {
    "use strict";
    
    // Initialize logger and API client
    const logger = new Logger('PricingMatrixAPI');
    const api = getAPIClient();
    
    // Initialize when DOM is ready
    document.addEventListener('DOMContentLoaded', initialize);
    
    // Initialize the pricing matrix API
    function initialize() {
        logger.info("Initializing pricing matrix API");
        
        // Check if PricingMatrixAPI already exists
        if (!window.PricingMatrixAPI) {
            logger.info("Creating PricingMatrixAPI");
            window.PricingMatrixAPI = {
                getPrice: getPrice,
                getPricingData: getPricingData,
                getPricingDataByAttributes: getPricingDataByAttributes, // New method
                clearCache: clearCache // New method for cache management
            };
        } else {
            logger.warn("PricingMatrixAPI already exists");
        }

        // Backward compatibility / alias (with warning)
        if (!window.PricingMatrix) {
            logger.warn("Creating alias 'window.PricingMatrix'. Use 'window.PricingMatrixAPI' instead.");
            window.PricingMatrix = window.PricingMatrixAPI;
        }
    }
    
    // Get pricing data from the API using a specific matrix ID
    async function getPricingData(matrixId) {
        if (!matrixId) {
            logger.error("No matrixId provided");
            return null;
        }

        try {
            logger.info(`Getting pricing data for matrix ID: ${matrixId}`);
            
            // Use the unified API client with caching
            const apiData = await api.get(
                buildUrl(API_ENDPOINTS.PRICING.MATRIX_BY_ID, { matrixId }),
                {
                    cache: true,
                    cacheTime: 3600000, // 1 hour cache
                    cacheStrategy: 'NETWORK_FIRST' // Try network first, fall back to cache
                }
            );
            
            logger.debug(`Received data for matrix ID ${matrixId}:`, apiData);

            // Basic validation of received data
            if (!apiData || !apiData.PriceMatrix || !apiData.SizeGroups) {
                logger.error(`Invalid data received from API for matrix ID ${matrixId}:`, apiData);
                return null;
            }

            // Convert the API data format to our internal format
            return formatPricingData(apiData, matrixId);

        } catch (error) {
            logger.error(`Error fetching pricing matrix ID ${matrixId}:`, error);
            
            // The unified API client already handles caching and fallback
            // If we get here, it means both network and cache failed
            return null;
        }
    }
    
    // New method to get pricing data by attributes (style, color, embellishment type)
    async function getPricingDataByAttributes(styleNumber, color, embellishmentType) {
        try {
            logger.info(`Getting pricing data by attributes: ${styleNumber}, ${color}, ${embellishmentType}`);
            
            // First, try to find the matrix ID for these attributes
            const matrixInfo = await api.get(
                API_ENDPOINTS.PRICING.MATRIX_LOOKUP,
                {
                    params: {
                        style: styleNumber,
                        color: color,
                        type: embellishmentType
                    },
                    cache: true,
                    cacheTime: 3600000 // 1 hour
                }
            );
            
            if (matrixInfo && matrixInfo.matrixId) {
                // Now get the actual pricing data
                return await getPricingData(matrixInfo.matrixId);
            }
            
            logger.warn(`No matrix ID found for ${styleNumber}/${color}/${embellishmentType}`);
            return null;
            
        } catch (error) {
            logger.error(`Error looking up matrix by attributes:`, error);
            return null;
        }
    }
    
    // Format the API data into internal structure
    function formatPricingData(apiData, matrixId) {
        try {
            // Ensure PriceMatrix and SizeGroups are parsed correctly
            const priceMatrix = typeof apiData.PriceMatrix === 'string' ? 
                JSON.parse(apiData.PriceMatrix) : apiData.PriceMatrix;
            const sizeGroups = typeof apiData.SizeGroups === 'string' ? 
                JSON.parse(apiData.SizeGroups) : apiData.SizeGroups;
            
            // Validate parsed data
            if (!priceMatrix || typeof priceMatrix !== 'object' || 
                !sizeGroups || !Array.isArray(sizeGroups)) {
                logger.error(`Invalid structure after parsing for ID ${matrixId}:`, apiData);
                return null;
            }

            // Convert to our internal format
            const rows = [];
            
            // Get all tier keys from the first size group
            const firstSizeGroupKey = Object.keys(priceMatrix)[0];
            if (!firstSizeGroupKey || !priceMatrix[firstSizeGroupKey]) {
                logger.error(`Cannot determine tiers from PriceMatrix for ID ${matrixId}`);
                return null;
            }
            
            const tiers = Object.keys(priceMatrix[firstSizeGroupKey]);
            
            // For each tier, create a row
            tiers.forEach(tier => {
                const prices = {};
                
                // For each size group, get the price for this tier
                sizeGroups.forEach(sizeGroup => {
                    prices[sizeGroup] = priceMatrix[sizeGroup]?.[tier] ?? null;
                    if (prices[sizeGroup] === null) {
                        logger.warn(`Missing price for size '${sizeGroup}', tier '${tier}' in matrix ${matrixId}`);
                    }
                });
                
                rows.push({
                    tier: tier,
                    prices: prices
                });
            });
            
            const formattedData = {
                styleNumber: apiData.StyleNumber,
                color: apiData.Color,
                embellishmentType: apiData.EmbellishmentType,
                headers: sizeGroups,
                rows: rows,
                capturedAt: apiData.CaptureDate,
                matrixId: matrixId
            };
            
            logger.debug(`Successfully formatted data for matrix ID ${matrixId}:`, formattedData);
            return formattedData;

        } catch (parseError) {
            logger.error(`Error parsing data for matrix ID ${matrixId}:`, parseError);
            return null;
        }
    }
    
    // Get price for a specific size and quantity
    async function getPrice(styleNumber, color, embType, size, quantity) {
        try {
            logger.info(`Getting price for ${styleNumber}, ${color}, ${embType}, ${size}, qty: ${quantity}`);
            
            // Use the new method to get pricing data by attributes
            const data = await getPricingDataByAttributes(styleNumber, color, embType);
            
            if (data) {
                const price = findPriceInData(data, size, quantity);
                if (price !== null) {
                    return price;
                }
            }
            
            // Fallback to default pricing
            const defaultPrice = getDefaultPrice(size, quantity, embType);
            logger.info(`Using default price: $${defaultPrice}`);
            return defaultPrice;
            
        } catch (error) {
            logger.error("Error getting price:", error);
            const defaultPrice = getDefaultPrice(size, quantity, embType);
            logger.info(`Using default price after error: $${defaultPrice}`);
            return defaultPrice;
        }
    }
    
    // Find price in formatted data
    function findPriceInData(data, size, quantity) {
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
        
        // If no tier found, use the lowest tier
        if (!tier && data.rows.length > 0) {
            logger.debug(`No exact tier match found for quantity ${quantity}, using lowest tier`);
            
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
                logger.debug(`Using lowest tier: ${lowestTier.tier}`);
                tier = lowestTier;
            }
        }
        
        if (tier) {
            logger.debug(`Found tier:`, tier);
            
            // Find the price for this size
            let sizeKey = size;
            
            // Handle size ranges (e.g., XS-XL)
            if (!tier.prices[size]) {
                sizeKey = findSizeKey(tier.prices, size);
            }
            
            const price = tier.prices[sizeKey];
            
            if (price) {
                logger.info(`Found price for ${size} (using key ${sizeKey}): $${price}`);
                return price;
            } else {
                logger.debug(`No price found for ${size} (tried key ${sizeKey})`);
            }
        } else {
            logger.debug(`No tier found for quantity ${quantity}`);
        }
        
        return null;
    }
    
    // Find size key in price object
    function findSizeKey(prices, size) {
        // Define size order for comparison
        const sizeOrder = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL', '6XL'];
        const sizeIdx = sizeOrder.indexOf(size.toUpperCase());
        
        if (sizeIdx !== -1) {
            for (const key in prices) {
                if (key.includes('-')) {
                    const [start, end] = key.split('-').map(s => s.trim().toUpperCase());
                    const startIdx = sizeOrder.indexOf(start);
                    const endIdx = sizeOrder.indexOf(end);
                    
                    if (startIdx !== -1 && endIdx !== -1 && 
                        sizeIdx >= startIdx && sizeIdx <= endIdx) {
                        logger.debug(`Size ${size} matches range ${key}`);
                        return key;
                    }
                }
            }
        }
        
        return size; // Return original size if no range match
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
    
    // Clear cache for pricing matrix data
    async function clearCache(matrixId = null) {
        try {
            if (matrixId) {
                // Clear specific matrix cache
                const cacheKey = `pricing:matrix:${matrixId}`;
                await api.cache.delete(cacheKey);
                logger.info(`Cleared cache for matrix ${matrixId}`);
            } else {
                // Clear all pricing matrix cache
                const keys = await api.cache.keys('pricing:matrix:*');
                for (const key of keys) {
                    await api.cache.delete(key);
                }
                logger.info('Cleared all pricing matrix cache');
            }
        } catch (error) {
            logger.error('Error clearing cache:', error);
        }
    }
    
    // Initialize if document is already loaded
    if (document.readyState !== 'loading') {
        initialize();
    }
})();