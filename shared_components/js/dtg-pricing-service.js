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

            // Check for errors
            if (!tiersRes.ok) throw new Error(`Tiers API failed: ${tiersRes.status}`);
            if (!costsRes.ok) throw new Error(`Costs API failed: ${costsRes.status}`);
            if (!inventoryRes.ok) throw new Error(`Inventory API failed: ${inventoryRes.status}`);
            if (!maxPricesRes.ok) throw new Error(`Max Prices API failed: ${maxPricesRes.status}`);

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
        
        // Get print cost for this location and tier
        let totalPrintCost = 0;
        locationCodes.forEach(code => {
            const costEntry = costs.find(c => 
                c.PrintLocationCode === code && 
                c.TierLabel === tier.TierLabel
            );
            if (costEntry) {
                totalPrintCost += parseFloat(costEntry.PrintCost);
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
        return tiers.find(t => 
            quantity >= t.MinQuantity && quantity <= t.MaxQuantity
        );
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
    buildCompatibilityBundle(data, quantity) {
        console.log('[DTGPricingService] Building compatibility bundle');
        
        const allLocationPrices = this.calculateAllLocationPrices(data, quantity);
        const tier = this.getTierForQuantity(data.tiers, quantity);
        
        // Format tier data for compatibility
        const tierData = {};
        data.tiers.forEach(t => {
            tierData[t.TierLabel] = t;
        });
        
        // Get unique sizes from inventory
        const uniqueSizes = [...new Set(data.inventory.map(item => item.SIZE))].filter(Boolean);
        uniqueSizes.sort((a, b) => {
            const sizeOrder = ['S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL', '6XL'];
            return sizeOrder.indexOf(a) - sizeOrder.indexOf(b);
        });
        
        return {
            styleNumber: data.styleNumber,
            color: data.color,
            embellishmentType: 'dtg',
            tierData,
            allLocationPrices,
            printLocationMeta: this.locations,
            sellingPriceDisplayAddOns: data.upcharges,
            uniqueSizes,
            currentTier: tier?.TierLabel,
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