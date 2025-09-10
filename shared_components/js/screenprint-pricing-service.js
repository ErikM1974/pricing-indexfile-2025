/**
 * Screen Print Pricing Service
 * Direct API implementation for screen print pricing
 * Implements exact pricing logic from XML specifications
 */

class ScreenPrintPricingService {
    constructor() {
        this.baseURL = 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';
        this.cachePrefix = 'screenprintPricingData';
        this.cacheDuration = 5 * 60 * 1000; // 5 minutes
        console.log('[ScreenPrintPricingService] Initialized');
    }

    /**
     * Main entry point - fetches and calculates pricing data
     */
    async fetchPricingData(styleNumber, options = {}) {
        console.log(`[ScreenPrintPricingService] Fetching pricing data for ${styleNumber}`);
        
        // Check cache first
        const cacheKey = `${this.cachePrefix}-${styleNumber}`;
        const cached = this.getFromCache(cacheKey);
        if (cached && !options.forceRefresh) {
            console.log('[ScreenPrintPricingService] Returning cached data');
            return cached;
        }

        try {
            // Fetch from API
            const apiData = await this.fetchFromAPI(styleNumber);
            
            // Calculate pricing using exact logic
            const calculatedData = this.calculatePricing(apiData);
            
            // Transform to match existing format expected by screenprint-pricing-v2.js
            const transformedData = this.transformToExistingFormat(calculatedData, apiData);
            
            // Cache the result
            this.saveToCache(cacheKey, transformedData);
            
            return transformedData;
        } catch (error) {
            console.error('[ScreenPrintPricingService] Error:', error);
            
            throw error;
        }
    }

    /**
     * Fetch raw data from API
     */
    async fetchFromAPI(styleNumber) {
        const url = `${this.baseURL}/api/pricing-bundle?method=ScreenPrint&styleNumber=${styleNumber}`;
        console.log(`[ScreenPrintPricingService] Fetching from: ${url}`);
        
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`API request failed: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('[ScreenPrintPricingService] API data received:', data);
        
        // Validate required fields
        if (!data.tiersR || !data.allScreenprintCostsR || !data.sizes) {
            throw new Error('Invalid API response - missing required fields');
        }
        
        return data;
    }

    /**
     * Calculate pricing using exact logic from specifications
     */
    calculatePricing(apiData) {
        console.log('[ScreenPrintPricingService] Starting price calculations...');
        
        const tiersR = apiData.tiersR;
        const rulesData = apiData.rulesR || apiData.rulesData;
        const allScreenprintCostsR = apiData.allScreenprintCostsR;
        const sizes = apiData.sizes;
        const sellingPriceDisplayAddOns = apiData.sellingPriceDisplayAddOns || {};
        
        // Rounding function based on rulesData
        const applyRounding = (price, method) => {
            if (method === 'HalfDollarCeil_Final' || method === 'HalfDollarUpAlways_Final') {
                // Always round UP to next $0.50
                if (price % 0.5 === 0) return price;
                return Math.ceil(price * 2) / 2;
            } else if (method === 'HalfDollarUp_Final') {
                // Standard rounding to nearest $0.50
                return Math.round(price * 2) / 2;
            }
            return price; // No rounding
        };
        
        // PART 1: Calculate the GARMENT selling price for each size
        const sortedSizes = [...sizes].sort((a, b) => (a.sortOrder || Infinity) - (b.sortOrder || Infinity));
        const standardGarment = sortedSizes.find(s => s.size.toUpperCase() === 'S') || sortedSizes[0];
        
        if (!standardGarment) throw new Error("No sizes found to determine standard garment cost.");
        
        const standardGarmentCost = parseFloat(standardGarment.price);
        console.log('[ScreenPrintPricingService] Standard garment cost:', standardGarmentCost);
        
        const garmentSellingPrices = {};
        
        tiersR.forEach(tier => {
            const tierLabel = tier.TierLabel;
            const marginDenom = parseFloat(tier.MarginDenominator);
            
            if (isNaN(marginDenom) || marginDenom === 0) {
                console.warn('[ScreenPrintPricingService] Skipping tier with invalid margin:', tier);
                return;
            }
            
            const markedUpStandardGarment = standardGarmentCost / marginDenom;
            
            sortedSizes.forEach(sizeInfo => {
                if (!garmentSellingPrices[tierLabel]) garmentSellingPrices[tierLabel] = {};
                const upcharge = parseFloat(sellingPriceDisplayAddOns[sizeInfo.size] || 0);
                garmentSellingPrices[tierLabel][sizeInfo.size] = markedUpStandardGarment + upcharge;
            });
        });
        
        // PART 2: Calculate PRINT costs with proper margins
        const flashCharge = rulesData.FlashCharge ? parseFloat(rulesData.FlashCharge) : 0;
        console.log('[ScreenPrintPricingService] Flash charge:', flashCharge);
        
        const printCosts = { PrimaryLocation: {}, AdditionalLocation: {} };
        
        allScreenprintCostsR.forEach(costEntry => {
            const costType = costEntry.CostType;
            const tierLabel = costEntry.TierLabel;
            const colorCount = costEntry.ColorCount;
            const basePrintCost = parseFloat(costEntry.BasePrintCost);
            
            if (!printCosts[costType]) {
                console.warn('[ScreenPrintPricingService] Unknown cost type:', costType);
                return;
            }
            
            if (!printCosts[costType][tierLabel]) {
                printCosts[costType][tierLabel] = {};
            }
            
            let finalPrintCost;
            
            if (costType === 'PrimaryLocation') {
                // Find the margin denominator for this tier
                const tier = tiersR.find(t => t.TierLabel === tierLabel);
                const marginDenom = tier ? parseFloat(tier.MarginDenominator) : 0.5;
                
                // Apply margin to primary location (cost + flash charge)
                const totalCost = basePrintCost + flashCharge;
                finalPrintCost = totalCost / marginDenom;
                
                console.log(`[ScreenPrintPricingService] Primary ${tierLabel} ${colorCount}-color: Cost $${totalCost.toFixed(2)} → Sell $${finalPrintCost.toFixed(2)}`);
            } else {
                // Additional locations already have margin built in - use as is
                finalPrintCost = basePrintCost;
            }
            
            printCosts[costType][tierLabel][colorCount] = finalPrintCost;
        });
        
        // PART 3: Calculate FINAL ROUNDED PRICES
        const finalPrices = { PrimaryLocation: {}, AdditionalLocation: {} };
        const roundingMethod = rulesData.RoundingMethod || 'HalfDollarCeil_Final';
        
        // Calculate final prices for each combination
        Object.keys(printCosts).forEach(locationType => {
            finalPrices[locationType] = {};
            
            Object.keys(printCosts[locationType]).forEach(tierLabel => {
                finalPrices[locationType][tierLabel] = {};
                
                Object.keys(printCosts[locationType][tierLabel]).forEach(colorCount => {
                    finalPrices[locationType][tierLabel][colorCount] = {};
                    
                    sortedSizes.forEach(sizeInfo => {
                        if (locationType === 'AdditionalLocation') {
                            // Additional locations: ONLY the print cost, no garment
                            const printPrice = printCosts[locationType][tierLabel][colorCount];
                            const roundedPrice = applyRounding(printPrice, roundingMethod);
                            finalPrices[locationType][tierLabel][colorCount][sizeInfo.size] = roundedPrice;
                        } else {
                            // Primary location: garment + print
                            const garmentPrice = garmentSellingPrices[tierLabel][sizeInfo.size];
                            const printPrice = printCosts[locationType][tierLabel][colorCount];
                            const rawTotal = garmentPrice + printPrice;
                            const roundedTotal = applyRounding(rawTotal, roundingMethod);
                            finalPrices[locationType][tierLabel][colorCount][sizeInfo.size] = roundedTotal;
                        }
                    });
                });
            });
        });
        
        console.log('[ScreenPrintPricingService] All pricing components calculated successfully.');
        
        return {
            garmentSellingPrices,
            printCosts,
            finalPrices,
            uniqueSizes: sortedSizes.map(s => s.size),
            availableColorCounts: [...new Set(allScreenprintCostsR.map(c => c.ColorCount))].sort((a,b)=>a-b)
        };
    }

    /**
     * Transform calculated data to match existing format
     */
    transformToExistingFormat(calculatedData, apiData) {
        // Build tier data structure
        const tierData = {};
        apiData.tiersR.forEach(tier => {
            tierData[tier.TierLabel] = {
                TierLabel: tier.TierLabel,
                MinQuantity: tier.MinQuantity,
                MaxQuantity: tier.MaxQuantity,
                MarginDenominator: tier.MarginDenominator,
                TargetMargin: tier.TargetMargin,
                LTM_Fee: tier.LTM_Fee || 0
            };
        });

        // Build primary location pricing structure
        const primaryLocationPricing = {};
        
        // Add garment-only pricing (0 colors)
        Object.keys(calculatedData.finalPrices.PrimaryLocation).forEach(tierLabel => {
            if (!primaryLocationPricing['0']) {
                primaryLocationPricing['0'] = { tiers: [] };
            }
            
            const tier = apiData.tiersR.find(t => t.TierLabel === tierLabel);
            if (tier) {
                const garmentPrices = {};
                Object.keys(calculatedData.garmentSellingPrices[tierLabel]).forEach(size => {
                    // Apply rounding to garment-only prices
                    const rawPrice = calculatedData.garmentSellingPrices[tierLabel][size];
                    garmentPrices[size] = Math.ceil(rawPrice * 2) / 2; // Round UP to $0.50
                });
                
                primaryLocationPricing['0'].tiers.push({
                    minQty: tier.MinQuantity,
                    maxQty: tier.MaxQuantity,
                    prices: garmentPrices,
                    ltmFee: tier.LTM_Fee || 0
                });
            }
        });

        // Add pricing for each color count
        calculatedData.availableColorCounts.forEach(colorCount => {
            primaryLocationPricing[colorCount.toString()] = { tiers: [] };
            
            Object.keys(calculatedData.finalPrices.PrimaryLocation).forEach(tierLabel => {
                const tier = apiData.tiersR.find(t => t.TierLabel === tierLabel);
                if (tier && calculatedData.finalPrices.PrimaryLocation[tierLabel][colorCount]) {
                    primaryLocationPricing[colorCount.toString()].tiers.push({
                        minQty: tier.MinQuantity,
                        maxQty: tier.MaxQuantity,
                        prices: calculatedData.finalPrices.PrimaryLocation[tierLabel][colorCount],
                        ltmFee: tier.LTM_Fee || 0
                    });
                }
            });
        });

        // Build additional location pricing structure
        const additionalLocationPricing = {};
        calculatedData.availableColorCounts.forEach(colorCount => {
            additionalLocationPricing[colorCount.toString()] = { tiers: [] };
            
            Object.keys(calculatedData.finalPrices.AdditionalLocation).forEach(tierLabel => {
                const tier = apiData.tiersR.find(t => t.TierLabel === tierLabel);
                if (tier && calculatedData.finalPrices.AdditionalLocation[tierLabel][colorCount]) {
                    // For additional locations, we need per-piece pricing (not by size)
                    const firstSize = Object.keys(calculatedData.finalPrices.AdditionalLocation[tierLabel][colorCount])[0];
                    const pricePerPiece = calculatedData.finalPrices.AdditionalLocation[tierLabel][colorCount][firstSize];
                    
                    additionalLocationPricing[colorCount.toString()].tiers.push({
                        minQty: tier.MinQuantity,
                        maxQty: tier.MaxQuantity,
                        pricePerPiece: pricePerPiece
                    });
                }
            });
        });

        // Build the final bundle structure matching existing format
        const bundle = {
            styleNumber: apiData.styleNumber || '',
            embellishmentType: 'screenprint',
            timestamp: new Date().toISOString(),
            
            // Raw data
            tierData: tierData,
            rulesData: apiData.rulesR || apiData.rulesData,
            sizes: apiData.sizes,
            sellingPriceDisplayAddOns: apiData.sellingPriceDisplayAddOns,
            printLocationMeta: apiData.locations || [],
            
            // Calculated data
            uniqueSizes: calculatedData.uniqueSizes,
            availableColorCounts: calculatedData.availableColorCounts,
            garmentSellingPrices: calculatedData.garmentSellingPrices,
            printCosts: calculatedData.printCosts,
            finalPrices: calculatedData.finalPrices,
            
            // Transformed for compatibility
            primaryLocationPricing: primaryLocationPricing,
            additionalLocationPricing: additionalLocationPricing
        };

        console.log('[ScreenPrintPricingService] Bundle transformed for compatibility');
        return bundle;
    }

    /**
     * Cache management
     */
    getFromCache(key) {
        try {
            const cached = sessionStorage.getItem(key);
            if (!cached) return null;
            
            const parsed = JSON.parse(cached);
            if (Date.now() - parsed.timestamp > this.cacheDuration) {
                sessionStorage.removeItem(key);
                return null;
            }
            
            return parsed.data;
        } catch (e) {
            console.error('[ScreenPrintPricingService] Cache read error:', e);
            return null;
        }
    }

    saveToCache(key, data) {
        try {
            sessionStorage.setItem(key, JSON.stringify({
                timestamp: Date.now(),
                data: data
            }));
        } catch (e) {
            console.error('[ScreenPrintPricingService] Cache write error:', e);
        }
    }

    clearCache() {
        const keys = Object.keys(sessionStorage);
        keys.forEach(key => {
            if (key.startsWith(this.cachePrefix)) {
                sessionStorage.removeItem(key);
            }
        });
        console.log('[ScreenPrintPricingService] Cache cleared');
    }

    /**
     * Get tier data for a specific quantity
     * Used by pricing calculator to get LTM fees
     */
    getTierData(quantity, pricingData) {
        const data = pricingData || this.cachedData;
        if (!data || !data.tierData) {
            console.warn('[ScreenPrintPricingService] No tier data available');
            return null;
        }
        
        // Find the tier that contains this quantity
        for (const tierKey in data.tierData) {
            const tier = data.tierData[tierKey];
            if (quantity >= tier.MinQuantity && 
                (!tier.MaxQuantity || quantity <= tier.MaxQuantity)) {
                console.log(`[ScreenPrintPricingService] Found tier for qty ${quantity}: ${tierKey}, LTM Fee: $${tier.LTM_Fee || 0}`);
                return tier;
            }
        }
        
        console.warn(`[ScreenPrintPricingService] No tier found for quantity: ${quantity}`);
        return null;
    }
    
    /**
     * Service status and control
     */
    getStatus() {
        return {
            service: 'ScreenPrintPricingService',
            apiEndpoint: `${this.baseURL}/api/pricing-bundle`,
            cacheEnabled: true,
            cacheDuration: this.cacheDuration
        };
    }
}

// Make service globally available
window.ScreenPrintPricingService = ScreenPrintPricingService;