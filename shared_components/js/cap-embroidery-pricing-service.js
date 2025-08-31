/**
 * Cap Embroidery Pricing Service
 * Direct API implementation for cap embroidery pricing
 * Implements exact pricing logic from XML specifications
 */

class CapEmbroideryPricingService {
    constructor() {
        this.baseURL = 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';
        this.cachePrefix = 'capEmbroideryPricingData';
        this.cacheDuration = 5 * 60 * 1000; // 5 minutes
        console.log('[CapEmbroideryPricingService] Initialized');
    }

    /**
     * Main entry point - fetches and calculates pricing data
     */
    async fetchPricingData(styleNumber, options = {}) {
        console.log(`[CapEmbroideryPricingService] Fetching pricing data for ${styleNumber}`);
        
        // Check cache first
        const cacheKey = `${this.cachePrefix}-${styleNumber}`;
        const cached = this.getFromCache(cacheKey);
        if (cached && !options.forceRefresh) {
            console.log('[CapEmbroideryPricingService] Returning cached data');
            return cached;
        }

        try {
            // Fetch from API
            const apiData = await this.fetchFromAPI(styleNumber);
            
            // Calculate pricing using exact logic
            const calculatedData = this.calculatePricing(apiData);
            
            // Transform to match existing format expected by cap-embroidery-pricing-v3.js
            const transformedData = this.transformToExistingFormat(calculatedData, apiData);
            
            // Cache the result
            this.saveToCache(cacheKey, transformedData);
            
            return transformedData;
        } catch (error) {
            console.error('[CapEmbroideryPricingService] Error:', error);
            throw error;
        }
    }

    /**
     * Fetch raw data from API
     */
    async fetchFromAPI(styleNumber) {
        const url = `${this.baseURL}/api/pricing-bundle?method=CAP&styleNumber=${styleNumber}`;
        console.log(`[CapEmbroideryPricingService] Fetching from: ${url}`);
        
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`API request failed: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('[CapEmbroideryPricingService] API data received:', data);
        
        // Validate required fields
        if (!data.tiersR || !data.allEmbroideryCostsR || !data.sizes) {
            throw new Error('Invalid API response - missing required fields');
        }
        
        return data;
    }

    /**
     * Calculate pricing using exact logic from specifications
     * Uses 8000 stitch count as specified
     */
    calculatePricing(apiData) {
        console.log('[CapEmbroideryPricingService] Starting price calculations...');
        
        const { tiersR, rulesR, allEmbroideryCostsR, sizes, sellingPriceDisplayAddOns } = apiData;
        
        // Sort sizes by order (caps often have OSFA or size ranges like S/M, L/XL)
        const sortedSizes = [...sizes].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
        const standardGarment = sortedSizes[0];
        
        if (!standardGarment) {
            throw new Error("No sizes found to determine standard garment cost");
        }
        
        const standardGarmentCost = parseFloat(standardGarment.price || standardGarment.maxCasePrice);
        console.log('[CapEmbroideryPricingService] Standard garment cost:', standardGarmentCost);
        
        // Rounding function based on rulesData
        const roundPrice = (price, roundingMethod) => {
            if (isNaN(price)) return null;
            if (roundingMethod === 'CeilDollar') {
                return Math.ceil(price);
            }
            // Default to HalfDollarUp - always round UP to nearest $0.50
            if (price % 0.5 === 0) return price;
            return Math.ceil(price * 2) / 2;
        };
        
        const priceProfile = {};
        
        // Process each tier
        tiersR.forEach(tier => {
            const tierLabel = tier.TierLabel;
            priceProfile[tierLabel] = {};
            
            // Find embroidery cost for 8000 stitches (as specified)
            const costEntry = allEmbroideryCostsR.find(c => 
                c.TierLabel === tierLabel && c.StitchCount === 8000
            );
            
            if (!costEntry) {
                console.warn(`[CapEmbroideryPricingService] No 8000 stitch cost found for tier ${tierLabel}`);
                sortedSizes.forEach(s => {
                    priceProfile[tierLabel][s.size] = null;
                });
                return;
            }
            
            const embCost = parseFloat(costEntry.EmbroideryCost);
            const marginDenom = parseFloat(tier.MarginDenominator);
            
            console.log(`[CapEmbroideryPricingService] Tier ${tierLabel}: EmbCost=$${embCost}, MarginDenom=${marginDenom}`);
            
            if (isNaN(marginDenom) || marginDenom === 0 || isNaN(embCost)) {
                sortedSizes.forEach(s => {
                    priceProfile[tierLabel][s.size] = null;
                });
                return;
            }
            
            // Calculate marked up garment price
            const markedUpGarment = standardGarmentCost / marginDenom;
            
            // Add embroidery cost to get decorated price
            const decoratedStandardPrice = markedUpGarment + embCost;
            
            // Apply rounding
            const roundedStandardPrice = roundPrice(decoratedStandardPrice, rulesR?.RoundingMethod);
            
            console.log(`[CapEmbroideryPricingService] Tier ${tierLabel}: Garment=$${markedUpGarment.toFixed(2)}, Decorated=$${decoratedStandardPrice.toFixed(2)}, Rounded=$${roundedStandardPrice}`);
            
            // Apply to each size (caps often have no upcharges for OSFA)
            sortedSizes.forEach(sizeInfo => {
                const upcharge = parseFloat(sellingPriceDisplayAddOns?.[sizeInfo.size] || 0);
                const finalPrice = roundedStandardPrice + upcharge;
                priceProfile[tierLabel][sizeInfo.size] = parseFloat(finalPrice.toFixed(2));
            });
        });
        
        console.log('[CapEmbroideryPricingService] All prices calculated successfully');
        
        return {
            pricing: priceProfile,
            uniqueSizes: sortedSizes.map(s => s.size),
            standardGarmentBaseCostUsed: standardGarmentCost,
            tiers: tiersR
        };
    }

    /**
     * Transform calculated data to match existing format
     */
    transformToExistingFormat(calculatedData, apiData) {
        const params = new URLSearchParams(window.location.search);
        const colorName = params.get('COLOR') ? decodeURIComponent(params.get('COLOR').replace(/\+/g, ' ')) : '';
        
        // Build the master bundle format expected by cap-embroidery-pricing-v3.js
        const masterBundle = {
            styleNumber: apiData.styleNumber || params.get('StyleNumber') || '',
            colorName: colorName,
            color: colorName,
            embellishmentType: 'cap_embroidery',
            timestamp: new Date().toISOString(),
            
            // Core pricing data
            tierData: apiData.tiersR,
            rulesData: apiData.rulesR,
            uniqueSizes: calculatedData.uniqueSizes,
            sellingPriceDisplayAddOns: apiData.sellingPriceDisplayAddOns || {},
            pricing: calculatedData.pricing,
            standardGarmentBaseCostUsed: calculatedData.standardGarmentBaseCostUsed,
            
            // Additional data for UI
            headers: calculatedData.uniqueSizes,
            prices: this.transformPricesToUIFormat(calculatedData),
            
            // Embroidery-specific data
            allEmbroideryCostsR: apiData.allEmbroideryCostsR,
            printLocationMeta: apiData.locations || [],
            
            // Raw API data for reference
            apiData: apiData
        };
        
        console.log('[CapEmbroideryPricingService] Bundle transformed for compatibility');
        return masterBundle;
    }

    /**
     * Transform prices to UI format (matches cap-master-bundle-integration.js format)
     */
    transformPricesToUIFormat(calculatedData) {
        const prices = {};
        
        // Initialize prices structure
        calculatedData.uniqueSizes.forEach(size => {
            prices[size] = {};
        });
        
        // Fill in prices for each tier
        calculatedData.tiers.forEach(tier => {
            const tierLabel = tier.TierLabel;
            calculatedData.uniqueSizes.forEach(size => {
                if (calculatedData.pricing[tierLabel] && calculatedData.pricing[tierLabel][size] !== undefined) {
                    prices[size][tierLabel] = calculatedData.pricing[tierLabel][size];
                } else {
                    prices[size][tierLabel] = null;
                }
            });
        });
        
        return prices;
    }

    /**
     * Cache management
     */
    getFromCache(key) {
        try {
            const cached = sessionStorage.getItem(key);
            if (!cached) return null;
            
            const data = JSON.parse(cached);
            const age = Date.now() - data.timestamp;
            
            if (age > this.cacheDuration) {
                sessionStorage.removeItem(key);
                return null;
            }
            
            return data.value;
        } catch (e) {
            return null;
        }
    }

    saveToCache(key, value) {
        try {
            sessionStorage.setItem(key, JSON.stringify({
                timestamp: Date.now(),
                value: value
            }));
        } catch (e) {
            console.warn('[CapEmbroideryPricingService] Cache save failed:', e);
        }
    }

    clearCache() {
        const keys = Object.keys(sessionStorage);
        keys.forEach(key => {
            if (key.startsWith(this.cachePrefix)) {
                sessionStorage.removeItem(key);
            }
        });
        console.log('[CapEmbroideryPricingService] Cache cleared');
    }

    /**
     * Get service status
     */
    getStatus() {
        return {
            service: 'CapEmbroideryPricingService',
            apiEndpoint: `${this.baseURL}/api/pricing-bundle?method=CAP`,
            cacheEnabled: true,
            cacheDuration: this.cacheDuration,
            stitchCount: 8000 // Fixed stitch count as specified
        };
    }
}

// Make service globally available
window.CapEmbroideryPricingService = CapEmbroideryPricingService;