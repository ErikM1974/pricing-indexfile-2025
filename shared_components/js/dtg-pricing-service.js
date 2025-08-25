/**
 * DTG Pricing Service - Direct API Implementation
 * Replaces the complex Caspio master bundle approach with direct API calls
 * 
 * @author Claude & Erik
 * @date 2025-08-18
 * @version 1.0.0
 */

class DTGPricingService {
    constructor() {
        this.apiBase = 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api';
        this.cache = new Map();
        this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
        
        // Location definitions (matching current system)
        this.locations = [
            { code: 'LC', name: 'Left Chest' },
            { code: 'FF', name: 'Full Front' },
            { code: 'FB', name: 'Full Back' },
            { code: 'JF', name: 'Jumbo Front' },
            { code: 'JB', name: 'Jumbo Back' },
            { code: 'LC_FB', name: 'LC & FB' },
            { code: 'FF_FB', name: 'FF & FB' },
            { code: 'JF_JB', name: 'JF & JB' },
            { code: 'LC_JB', name: 'Left Chest & Jumbo Back' }
        ];
        
        console.log('[DTGPricingService] Service initialized');
    }

    /**
     * Fetch all pricing data from APIs
     * @param {string} styleNumber - Product style number (e.g., 'PC61')
     * @param {string} color - Color name (optional, for inventory filtering)
     * @returns {Object} Combined pricing data
     */
    async fetchPricingData(styleNumber, color = null) {
        const cacheKey = `${styleNumber}-${color || 'all'}`;
        
        // Special debug logging for PC78ZH
        if (styleNumber === 'PC78ZH' && window.DTG_PERFORMANCE?.debug) {
            console.log('[DTGPricingService DEBUG] PC78ZH pricing request:', {
                styleNumber: styleNumber,
                color: color,
                cacheKey: cacheKey
            });
        }
        
        // Check cache first
        if (this.cache.has(cacheKey)) {
            const cached = this.cache.get(cacheKey);
            if (Date.now() - cached.timestamp < this.cacheTimeout) {
                console.log('[DTGPricingService] Returning cached data for:', cacheKey);
                return cached.data;
            }
        }

        console.log('[DTGPricingService] Fetching fresh data for:', styleNumber, color);
        
        try {
            // Fetch all data in parallel for maximum performance
            const startTime = performance.now();
            
            const [tiersRes, costsRes, inventoryRes, maxPricesRes] = await Promise.all([
                fetch(`${this.apiBase}/pricing-tiers?method=DTG`),
                fetch(`${this.apiBase}/dtg-costs`),
                fetch(`${this.apiBase}/inventory?styleNumber=${styleNumber}${color ? `&color=${encodeURIComponent(color)}` : ''}`),
                fetch(`${this.apiBase}/max-prices-by-style?styleNumber=${styleNumber}`)
            ]);

            // Check for errors with detailed messages
            if (!tiersRes.ok) {
                const errorText = await tiersRes.text();
                throw new Error(`Tiers API failed (${tiersRes.status}): ${errorText}`);
            }
            if (!costsRes.ok) {
                const errorText = await costsRes.text();
                throw new Error(`Costs API failed (${costsRes.status}): ${errorText}`);
            }
            if (!inventoryRes.ok) {
                const errorText = await inventoryRes.text();
                // Special handling for PC78ZH inventory issues
                if (styleNumber === 'PC78ZH') {
                    console.error('[DTGPricingService] PC78ZH inventory API error:', errorText);
                }
                throw new Error(`Inventory API failed (${inventoryRes.status}) for ${styleNumber}: ${errorText}`);
            }
            if (!maxPricesRes.ok) {
                const errorText = await maxPricesRes.text();
                throw new Error(`Max Prices API failed (${maxPricesRes.status}) for ${styleNumber}: ${errorText}`);
            }

            // Parse responses
            const [tiers, costs, inventory, maxPrices] = await Promise.all([
                tiersRes.json(),
                costsRes.json(),
                inventoryRes.json(),
                maxPricesRes.json()
            ]);

            const fetchTime = performance.now() - startTime;
            console.log(`[DTGPricingService] Data fetched in ${fetchTime.toFixed(0)}ms`);

            // Combine and structure the data
            const data = {
                tiers,
                costs,
                inventory,
                upcharges: maxPrices.sellingPriceDisplayAddOns || {},
                maxPrices: maxPrices.sizes || [],
                styleNumber,
                color,
                locations: this.locations,
                timestamp: Date.now()
            };

            // Cache the result
            this.cache.set(cacheKey, { data, timestamp: Date.now() });
            
            return data;
            
        } catch (error) {
            console.error('[DTGPricingService] Error fetching data:', error);
            throw error;
        }
    }

    /**
     * Calculate prices for all locations and sizes
     * @param {Object} data - Pricing data from fetchPricingData
     * @param {number} quantity - Order quantity
     * @returns {Object} Price matrix for all locations and sizes
     */
    calculateAllLocationPrices(data, quantity) {
        console.log('[DTGPricingService] Calculating prices for quantity:', quantity);
        
        const { tiers, costs, inventory, upcharges } = data;
        const allLocationPrices = {};
        
        // Find the appropriate tier for the quantity
        const tier = this.getTierForQuantity(tiers, quantity);
        if (!tier) {
            console.error('[DTGPricingService] No tier found for quantity:', quantity);
            return null;
        }
        
        console.log('[DTGPricingService] Using tier:', tier.TierLabel);
        
        // Calculate prices for each location
        this.locations.forEach(location => {
            allLocationPrices[location.code] = this.calculateLocationPrices(
                location.code,
                tier,
                costs,
                inventory,
                upcharges
            );
        });
        
        return allLocationPrices;
    }

    /**
     * Calculate prices for a specific location
     * @private
     */
    calculateLocationPrices(locationCode, tier, costs, inventory, upcharges) {
        const prices = {};
        
        // Handle combined locations (e.g., 'LC_FB')
        const locationCodes = locationCode.split('_');
        
        // Special debug for PC78ZH with left chest + full back
        const isPC78ZH = inventory.some(item => item.STYLE === 'PC78ZH');
        if (isPC78ZH && locationCode === 'LC_FB' && window.DTG_PERFORMANCE?.debug) {
            console.log('[DTGPricingService DEBUG] PC78ZH LC_FB calculation:', {
                locationCode: locationCode,
                locationCodes: locationCodes,
                tier: tier.TierLabel,
                costsAvailable: costs.length
            });
        }
        
        // Get print cost for this location and tier
        let totalPrintCost = 0;
        locationCodes.forEach(code => {
            const costEntry = costs.find(c => 
                c.PrintLocationCode === code && 
                c.TierLabel === tier.TierLabel
            );
            if (costEntry) {
                totalPrintCost += parseFloat(costEntry.PrintCost);
                if (isPC78ZH && locationCode === 'LC_FB' && window.DTG_PERFORMANCE?.debug) {
                    console.log(`[DTGPricingService DEBUG] PC78ZH print cost for ${code}:`, costEntry.PrintCost);
                }
            }
        });
        
        // Group inventory by size and calculate prices
        const garmentsBySize = this.groupInventoryBySize(inventory);
        
        // Get standard garment cost (size S or first available)
        const standardGarment = garmentsBySize['S'] || garmentsBySize['M'] || Object.values(garmentsBySize)[0];
        if (!standardGarment) {
            console.error('[DTGPricingService] No garments found in inventory');
            return prices;
        }
        
        const standardGarmentCost = this.getGarmentCost(standardGarment);
        
        // Calculate base price (same for all sizes before upcharges)
        const markedUpGarment = standardGarmentCost / tier.MarginDenominator;
        const basePrice = markedUpGarment + totalPrintCost;
        const roundedBasePrice = this.roundUpToHalfDollar(basePrice);
        
        // Apply size-specific upcharges
        Object.keys(garmentsBySize).forEach(size => {
            const upcharge = upcharges[size] || 0;
            prices[size] = {};
            prices[size][tier.TierLabel] = parseFloat((roundedBasePrice + upcharge).toFixed(2));
        });
        
        return prices;
    }

    /**
     * Get the appropriate tier for a quantity
     * @private
     */
    getTierForQuantity(tiers, quantity) {
        // Debug logging for specific problematic cases
        if ((quantity === 166 || quantity < 24) && window.DTG_PERFORMANCE?.debug) {
            console.log('[DTGPricingService DEBUG] Finding tier for quantity ' + quantity + ':', {
                quantity: quantity,
                availableTiers: tiers.map(t => ({
                    label: t.TierLabel,
                    min: t.MinQuantity,
                    max: t.MaxQuantity
                }))
            });
        }
        
        // For quantities under 24, use the 24-47 tier (with LTM fee applied elsewhere)
        if (quantity < 24) {
            const tier2447 = tiers.find(t => t.TierLabel === '24-47');
            if (tier2447) {
                // Return a modified tier that includes the lower quantities
                return {
                    ...tier2447,
                    MinQuantity: 1,  // Allow quantities from 1
                    TierLabel: '24-47',
                    Note: 'Using 24-47 tier for quantities under 24 with LTM fee'
                };
            }
            // Fallback if somehow 24-47 tier doesn't exist
            return {
                TierLabel: '24-47',
                MinQuantity: 1,
                MaxQuantity: 47,
                MarginDenominator: 0.6,
                Note: 'Fallback tier for quantities under 24'
            };
        }
        
        const tier = tiers.find(t => 
            quantity >= t.MinQuantity && quantity <= t.MaxQuantity
        );
        
        if (quantity === 166 && window.DTG_PERFORMANCE?.debug) {
            console.log('[DTGPricingService DEBUG] Selected tier for 166:', tier?.TierLabel);
        }
        
        return tier;
    }

    /**
     * Group inventory items by size
     * @private
     */
    groupInventoryBySize(inventory) {
        const grouped = {};
        inventory.forEach(item => {
            if (item.SIZE) {
                grouped[item.SIZE] = item;
            }
        });
        return grouped;
    }

    /**
     * Get garment cost from inventory item
     * @private
     */
    getGarmentCost(garmentData) {
        // Prefer CASE_PRICE, fall back to PIECE_PRICE
        return parseFloat(garmentData.CASE_PRICE || garmentData.PIECE_PRICE || 0);
    }

    /**
     * Round up to nearest half dollar
     * @private
     */
    roundUpToHalfDollar(amount) {
        return Math.ceil(amount * 2) / 2;
    }

    /**
     * Calculate single price (for quick quote display)
     * @param {Object} data - Pricing data
     * @param {number} quantity - Order quantity
     * @param {string} locationCode - Location code (e.g., 'LC')
     * @param {string} size - Size (e.g., 'M')
     * @returns {number} Calculated price
     */
    calculateSinglePrice(data, quantity, locationCode, size = 'M') {
        const allPrices = this.calculateAllLocationPrices(data, quantity);
        if (!allPrices || !allPrices[locationCode] || !allPrices[locationCode][size]) {
            return 0;
        }
        
        const tier = this.getTierForQuantity(data.tiers, quantity);
        if (!tier) return 0;
        
        return allPrices[locationCode][size][tier.TierLabel] || 0;
    }

    /**
     * Build a master bundle format (for compatibility with old system)
     * This allows gradual migration
     */
    buildCompatibilityBundle(data, quantity, selectedLocation = 'LC') {
        console.log('[DTGPricingService] Building compatibility bundle for location:', selectedLocation);
        
        const allLocationPrices = this.calculateAllLocationPrices(data, quantity);
        const tier = this.getTierForQuantity(data.tiers, quantity);
        
        // Format tier data for compatibility - ensure all tiers are included
        const tierData = {
            '24-47': { MinQuantity: 24, MaxQuantity: 47, TierLabel: '24-47' },
            '48-71': { MinQuantity: 48, MaxQuantity: 71, TierLabel: '48-71' },
            '72+': { MinQuantity: 72, MaxQuantity: 99999, TierLabel: '72+' }
        };
        
        // Override with actual tier data if available
        data.tiers.forEach(t => {
            tierData[t.TierLabel] = {
                ...t,
                MinQuantity: t.MinQuantity,
                MaxQuantity: t.MaxQuantity,
                TierLabel: t.TierLabel
            };
        });
        
        // Get unique sizes from inventory or use standard sizes
        let uniqueSizes = [...new Set(data.inventory.map(item => item.SIZE))].filter(Boolean);
        if (uniqueSizes.length === 0) {
            uniqueSizes = ['S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL', '6XL'];
        }
        uniqueSizes.sort((a, b) => {
            const sizeOrder = ['S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL', '6XL'];
            return sizeOrder.indexOf(a) - sizeOrder.indexOf(b);
        });
        
        // Build size-based prices for the selected location (for DP5-Helper compatibility)
        const prices = {};
        const headers = uniqueSizes; // Headers are the sizes
        
        if (allLocationPrices && allLocationPrices[selectedLocation]) {
            const locationPrices = allLocationPrices[selectedLocation];
            uniqueSizes.forEach(size => {
                if (locationPrices[size]) {
                    prices[size] = locationPrices[size];
                } else {
                    // Provide empty price structure if size not available
                    prices[size] = {
                        '24-47': 0,
                        '48-71': 0,
                        '72+': 0
                    };
                }
            });
        }
        
        return {
            styleNumber: data.styleNumber,
            color: data.color,
            embellishmentType: 'dtg',
            selectedLocationValue: selectedLocation,
            
            // Critical fields for DP5-Helper validation
            headers: headers,  // Array of sizes
            prices: prices,    // Size-based pricing for selected location
            tierData: tierData,
            tiers: tierData,   // Duplicate for compatibility
            
            // Additional data
            allLocationPrices,
            printLocationMeta: this.locations,
            sellingPriceDisplayAddOns: data.upcharges || {},
            uniqueSizes,
            currentTier: tier?.TierLabel,
            
            // Metadata
            capturedAt: new Date().toISOString(),
            hasError: false,
            errorMessage: '',
            source: 'DTGPricingService' // Identify the source
        };
    }

    /**
     * Clear cache (useful for testing)
     */
    clearCache() {
        this.cache.clear();
        console.log('[DTGPricingService] Cache cleared');
    }

    /**
     * Get cache statistics
     */
    getCacheStats() {
        return {
            entries: this.cache.size,
            keys: Array.from(this.cache.keys()),
            timeout: this.cacheTimeout
        };
    }
}

// Make available globally
window.DTGPricingService = DTGPricingService;

console.log('[DTGPricingService] Service loaded and ready');