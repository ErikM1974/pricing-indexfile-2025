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
        
        // Feature flags for bundle endpoint
        this.useBundleEndpoint = true; // Try bundle first, fallback if fails
        this.bundleEndpointAttempted = false; // Track if we've tried the bundle endpoint
        this.bundleEndpointAvailable = null; // null=unknown, true=available, false=not available
        
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
        
        console.log('[DTGPricingService] Service initialized with bundle endpoint support');
    }

    /**
     * Fetch bundled DTG data from new optimized endpoint
     * @param {string} styleNumber - Product style number
     * @param {string} color - Optional color filter
     * @returns {Object|null} Bundle data or null if endpoint not available
     */
    async fetchBundledData(styleNumber, color = null) {
        const bundleUrl = `${this.apiBase}/dtg/product-bundle?styleNumber=${encodeURIComponent(styleNumber)}${color ? `&color=${encodeURIComponent(color)}` : ''}`;
        
        try {
            console.log('[DTGPricingService] Attempting to fetch from bundle endpoint:', bundleUrl);
            const response = await fetch(bundleUrl);
            
            if (response.status === 404) {
                console.log('[DTGPricingService] Bundle endpoint not available (404), will use fallback');
                this.bundleEndpointAvailable = false;
                return null;
            }
            
            if (!response.ok) {
                console.warn('[DTGPricingService] Bundle endpoint error:', response.status);
                return null;
            }
            
            const data = await response.json();
            console.log('[DTGPricingService] Bundle data received successfully');
            this.bundleEndpointAvailable = true;
            
            // Transform bundle data to match existing format
            return {
                tiers: data.pricing?.tiers || [],
                costs: data.pricing?.costs || [],
                sizes: data.pricing?.sizes || [],
                upcharges: data.pricing?.upcharges || {},
                styleNumber: data.product?.styleNumber || styleNumber,
                color: color,
                locations: data.pricing?.locations || this.locations,
                productInfo: data.product || {},
                timestamp: Date.now(),
                source: 'bundle'
            };
            
        } catch (error) {
            console.warn('[DTGPricingService] Bundle endpoint failed:', error.message);
            return null;
        }
    }

    /**
     * Fetch all pricing data from APIs (with bundle endpoint support)
     * @param {string} styleNumber - Product style number (e.g., 'PC61')
     * @param {string} color - Color name (optional, for inventory filtering)
     * @returns {Object} Combined pricing data
     */
    async fetchPricingData(styleNumber, color = null, forceRefresh = false) {
        const cacheKey = `${styleNumber}-${color || 'all'}`;
        
        // Special debug logging for problematic styles
        const debugStyles = ['PC78ZH', 'PC78', 'S700'];
        const isDebugStyle = debugStyles.some(style => styleNumber.startsWith(style));
        
        if (isDebugStyle || window.DTG_PERFORMANCE?.debug) {
            console.log(`[DTGPricingService DEBUG] ${styleNumber} pricing request:`, {
                styleNumber: styleNumber,
                color: color,
                cacheKey: cacheKey,
                forceRefresh: forceRefresh
            });
        }
        
        // Check cache first (unless force refresh)
        if (!forceRefresh && this.cache.has(cacheKey)) {
            const cached = this.cache.get(cacheKey);
            if (Date.now() - cached.timestamp < this.cacheTimeout) {
                // Validate cached data before returning
                if (cached.data && cached.data.sizes && cached.data.sizes.length > 0) {
                    console.log('[DTGPricingService] Returning cached data for:', cacheKey);
                    return cached.data;
                } else {
                    console.warn('[DTGPricingService] Invalid cached data detected, fetching fresh data for:', cacheKey);
                    this.cache.delete(cacheKey); // Remove bad cache entry
                }
            }
        }

        // Try bundle endpoint first if enabled and not known to be unavailable
        if (this.useBundleEndpoint && this.bundleEndpointAvailable !== false) {
            const bundleData = await this.fetchBundledData(styleNumber, color);
            if (bundleData) {
                console.log('[DTGPricingService] Using bundle endpoint data');
                // Cache the bundled data
                this.cache.set(cacheKey, { data: bundleData, timestamp: Date.now() });
                return bundleData;
            }
            // If bundle failed, fall through to existing implementation
            console.log('[DTGPricingService] Bundle endpoint failed or unavailable, using fallback');
        }

        console.log('[DTGPricingService] Fetching fresh data from individual endpoints for:', styleNumber, color);
        
        try {
            // Fetch all data in parallel for maximum performance
            const startTime = performance.now();
            
            // Removed inventory API call - using max-prices data instead for better reliability
            const [tiersRes, costsRes, maxPricesRes] = await Promise.all([
                fetch(`${this.apiBase}/pricing-tiers?method=DTG`),
                fetch(`${this.apiBase}/dtg-costs`),
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
            if (!maxPricesRes.ok) {
                const errorText = await maxPricesRes.text();
                throw new Error(`Max Prices API failed (${maxPricesRes.status}) for ${styleNumber}: ${errorText}`);
            }

            // Parse responses
            const [tiers, costs, maxPrices] = await Promise.all([
                tiersRes.json(),
                costsRes.json(),
                maxPricesRes.json()
            ]);

            const fetchTime = performance.now() - startTime;
            console.log(`[DTGPricingService] Data fetched in ${fetchTime.toFixed(0)}ms`);
            
            // Log max prices details for debugging
            if (isDebugStyle || window.DTG_PERFORMANCE?.debug) {
                console.log(`[DTGPricingService DEBUG] ${styleNumber} max prices:`, {
                    sizesCount: maxPrices.sizes?.length || 0,
                    firstSize: maxPrices.sizes?.[0],
                    upcharges: maxPrices.sellingPriceDisplayAddOns,
                    hasPrices: maxPrices.sizes?.length > 0
                });
            }
            
            // Validate max prices data
            if (!maxPrices.sizes || maxPrices.sizes.length === 0) {
                console.error(`[DTGPricingService] No pricing data found for ${styleNumber}`);
                throw new Error(`No pricing data available for ${styleNumber}`);
            }

            // Combine and structure the data
            const data = {
                tiers,
                costs,
                sizes: maxPrices.sizes || [],
                upcharges: maxPrices.sellingPriceDisplayAddOns || {},
                styleNumber,
                color,
                locations: this.locations,
                timestamp: Date.now()
            };

            // Cache valid results
            this.cache.set(cacheKey, { data, timestamp: Date.now() });
            console.log(`[DTGPricingService] Cached pricing data for:`, cacheKey);
            
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
        
        const { tiers, costs, sizes, upcharges } = data;
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
                sizes,
                upcharges
            );
        });
        
        return allLocationPrices;
    }

    /**
     * Calculate prices for a specific location
     * @private
     */
    calculateLocationPrices(locationCode, tier, costs, sizes, upcharges) {
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
        
        // Find the base garment cost (lowest valid price, excluding zeros)
        const validPrices = sizes
            .map(s => parseFloat(s.maxCasePrice))
            .filter(price => !isNaN(price) && price > 0);
        
        if (validPrices.length === 0) {
            console.error('[DTGPricingService] No valid garment costs found for any size');
            return prices;
        }
        
        const baseGarmentCost = Math.min(...validPrices);
        
        if (isNaN(baseGarmentCost) || baseGarmentCost <= 0) {
            console.error('[DTGPricingService] Invalid base garment cost:', baseGarmentCost);
            return prices;
        }
        
        // Calculate base price (same for all sizes before upcharges)
        const markedUpGarment = baseGarmentCost / tier.MarginDenominator;
        const basePrice = markedUpGarment + totalPrintCost;
        const roundedBasePrice = this.roundUpToHalfDollar(basePrice);
        
        // Apply size-specific upcharges
        sizes.forEach(sizeInfo => {
            const size = sizeInfo.size;
            const sizePrice = parseFloat(sizeInfo.maxCasePrice);
            
            // If this size has no valid price ($0), mark as unavailable
            if (isNaN(sizePrice) || sizePrice <= 0) {
                prices[size] = {};
                prices[size][tier.TierLabel] = 'N/A';  // Mark as not available
                console.warn(`[DTGPricingService] Size ${size} has invalid price, marking as N/A`);
            } else {
                const upcharge = upcharges[size] || 0;
                prices[size] = {};
                prices[size][tier.TierLabel] = parseFloat((roundedBasePrice + upcharge).toFixed(2));
            }
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
        if (!allPrices || !allPrices[locationCode]) {
            return 0;
        }
        
        // If the requested size doesn't exist, try to find a fallback
        if (!allPrices[locationCode][size]) {
            // Try standard sizes in order
            const fallbackSizes = ['M', 'L', 'S', 'XL'];
            for (const fallback of fallbackSizes) {
                if (allPrices[locationCode][fallback]) {
                    size = fallback;
                    break;
                }
            }
            // If still not found, use first available size
            if (!allPrices[locationCode][size]) {
                const availableSizes = Object.keys(allPrices[locationCode]);
                if (availableSizes.length > 0) {
                    size = availableSizes[0];
                } else {
                    return 0;
                }
            }
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
        
        // Get unique sizes from max prices data
        let uniqueSizes = data.sizes.map(s => s.size);
        if (uniqueSizes.length === 0) {
            uniqueSizes = ['S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL', '6XL'];
        }
        
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

    /**
     * Check if bundle endpoint is available
     * @returns {boolean|null} true if available, false if not, null if unknown
     */
    isBundleEndpointAvailable() {
        return this.bundleEndpointAvailable;
    }

    /**
     * Enable or disable bundle endpoint usage
     * @param {boolean} enable - Whether to use bundle endpoint
     */
    setBundleEndpointUsage(enable) {
        this.useBundleEndpoint = enable;
        console.log(`[DTGPricingService] Bundle endpoint usage ${enable ? 'enabled' : 'disabled'}`);
    }

    /**
     * Get service status and configuration
     */
    getServiceStatus() {
        return {
            bundleEndpointEnabled: this.useBundleEndpoint,
            bundleEndpointAvailable: this.bundleEndpointAvailable,
            cacheEntries: this.cache.size,
            apiBase: this.apiBase
        };
    }

    /**
     * Force a retry of the bundle endpoint (useful after API updates)
     */
    resetBundleEndpointStatus() {
        this.bundleEndpointAvailable = null;
        this.bundleEndpointAttempted = false;
        console.log('[DTGPricingService] Bundle endpoint status reset - will retry on next request');
    }
}

// Make available globally
window.DTGPricingService = DTGPricingService;

console.log('[DTGPricingService] Service loaded with bundle endpoint support (will fallback if unavailable)');