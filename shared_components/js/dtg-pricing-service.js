/**
 * DTG Pricing Service - Direct API Implementation
 * Replaces the complex Caspio master bundle approach with direct API calls
 *
 * ⚠️ SHARED SERVICE - AFFECTS MULTIPLE CALCULATORS
 * This service is used by BOTH:
 * - DTG Quote Builder (/quote-builders/dtg-quote-builder.html)
 * - DTG Pricing Calculator (/calculators/dtg-pricing.html)
 *
 * CRITICAL: Any changes to pricing formulas here will affect both calculators.
 * Always test BOTH calculators after making changes to ensure pricing remains synchronized.
 *
 * Key Pricing Formulas (MUST NOT CHANGE):
 * - Base garment cost: Math.min(...sizes.map(s => s.price))  [Use 'price' NOT 'maxCasePrice']
 * - Margin denominator: From API tier data (tiersR[].MarginDenominator)
 * - Rounding: Math.ceil(basePrice * 2) / 2 (round UP to half dollar)
 *
 * See CLAUDE.md "DTG Calculator Synchronization" section for testing requirements.
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
        
        console.log('[DTGPricingService] Service initialized - API bundle endpoint only (no fallback)');
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
                console.error('[DTGPricingService] Bundle endpoint not available (404) - no fallback available');
                throw new Error('DTG pricing bundle endpoint not found. Please contact support.');
            }
            
            if (!response.ok) {
                console.warn('[DTGPricingService] Bundle endpoint error:', response.status);
                return null;
            }
            
            const data = await response.json();
            console.log('[DTGPricingService] Bundle data received successfully');

            // Transform bundle data to match existing format
            // NEW API structure (Oct 2025): { product: {...}, pricing: { tiers, costs, sizes, upcharges } }
            const pricing = data.pricing || data; // Try new structure first, fallback to old

            // Transform sizes array to use 'price' field name (code expects 'price' not 'maxCasePrice')
            const transformedSizes = (pricing.sizes || data.sizes || []).map(s => ({
                ...s,
                price: s.price || s.maxCasePrice // Support both field names
            }));

            return {
                tiers: pricing.tiers || data.tiersR || [],
                costs: pricing.costs || data.allDtgCostsR || [],
                sizes: transformedSizes,
                upcharges: pricing.upcharges || data.sellingPriceDisplayAddOns || {},
                styleNumber: data.product?.styleNumber || data.styleNumber || styleNumber,
                color: color,
                locations: pricing.locations || data.locations || this.locations,
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
     * Check for manual cost override from URL parameter or sessionStorage
     * @returns {number|null} Manual cost or null if not set
     */
    getManualCostOverride() {
        // Check URL parameter first (priority)
        const urlParams = new URLSearchParams(window.location.search);
        const urlCost = urlParams.get('manualCost') || urlParams.get('cost');
        if (urlCost && !isNaN(parseFloat(urlCost))) {
            const cost = parseFloat(urlCost);
            console.log('[DTGPricingService] Manual cost from URL:', cost);
            // Store in sessionStorage for persistence during navigation
            sessionStorage.setItem('manualCostOverride', cost.toString());
            return cost;
        }

        // Check sessionStorage (persistent within session)
        const storedCost = sessionStorage.getItem('manualCostOverride');
        if (storedCost && !isNaN(parseFloat(storedCost))) {
            const cost = parseFloat(storedCost);
            console.log('[DTGPricingService] Manual cost from storage:', cost);
            return cost;
        }

        return null;
    }

    /**
     * Clear manual cost override
     */
    clearManualCostOverride() {
        sessionStorage.removeItem('manualCostOverride');
        console.log('[DTGPricingService] Manual cost override cleared');
    }

    /**
     * Fetch DTG pricing bundle from API using reference product
     * @returns {Object} Complete pricing bundle from API
     * @throws {Error} If API request fails
     */
    async fetchPricingBundle() {
        const url = `${this.apiBase}/pricing-bundle?method=DTG&styleNumber=PC61`;
        console.log('[DTGPricingService] Fetching complete pricing bundle from API...');

        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to fetch DTG pricing bundle from API: ${response.status}`);
        }

        const data = await response.json();

        // Validate required fields
        if (!data.tiersR || !data.allDtgCostsR) {
            throw new Error('Invalid API response: missing required DTG pricing data');
        }

        // DEBUG: Log complete API response to investigate tier-specific costs
        console.log('[DTGPricingService] 🔍 DEBUG: Complete API response:', {
            totalTiers: data.tiersR?.length,
            totalCosts: data.allDtgCostsR?.length,
            tiers: data.tiersR,
            allCosts: data.allDtgCostsR
        });

        // DEBUG: Show LC costs specifically
        const lcCosts = data.allDtgCostsR?.filter(c => c.PrintLocationCode === 'LC');
        console.log('[DTGPricingService] 🔍 DEBUG: LC costs from API:', lcCosts);

        console.log('[DTGPricingService] Successfully fetched complete pricing bundle from API');
        return data;
    }

    /**
     * Generate pricing data using manual cost + API pricing rules
     * Fetches everything from API except garment base cost
     * @param {number} manualCost - Base garment cost
     * @returns {Object} Pricing data with API rules + manual garment cost
     */
    async generateManualPricingData(manualCost) {
        console.log('[DTGPricingService] Generating manual pricing data with base cost:', manualCost);

        // CRITICAL: Clear cache to ensure fresh API data for manual mode
        console.log('[DTGPricingService] Clearing cache for fresh API data...');
        this.cache.clear();

        // Fetch complete pricing bundle from API (throws error if fails - no fallback)
        const apiBundle = await this.fetchPricingBundle();

        // VALIDATION: Ensure API data is complete and correct
        console.log('[Manual Pricing] 🔍 API Data Validation:', {
            totalTiers: apiBundle.tiersR?.length,
            totalCosts: apiBundle.allDtgCostsR?.length,
            tierLabels: apiBundle.tiersR?.map(t => t.TierLabel),
        });

        // VALIDATION: Check LC costs specifically
        const lcCosts = apiBundle.allDtgCostsR?.filter(c => c.PrintLocationCode === 'LC');
        console.log('[Manual Pricing] 🔍 LC Costs from API:', lcCosts?.map(c => ({
            tier: c.TierLabel,
            cost: c.PrintCost,
            fullData: c
        })));

        if (!apiBundle.allDtgCostsR || apiBundle.allDtgCostsR.length === 0) {
            console.error('[Manual Pricing] ❌ No cost data received from API!');
            throw new Error('API returned no cost data');
        }

        // Build sizes array using manual cost
        const manualSizes = [
            { size: 'S', price: manualCost, sortOrder: 1 },
            { size: 'M', price: manualCost, sortOrder: 2 },
            { size: 'L', price: manualCost, sortOrder: 3 },
            { size: 'XL', price: manualCost, sortOrder: 4 },
            { size: '2XL', price: manualCost, sortOrder: 5 },
            { size: '3XL', price: manualCost, sortOrder: 6 },
            { size: '4XL', price: manualCost, sortOrder: 7 }
        ];

        // Return API data with manual cost substituted into sizes
        // Wrapped in 'pricing' object to match regular DTG product-bundle API structure
        const manualPricingData = {
            pricing: {
                tiers: apiBundle.tiersR,                          // From API
                costs: apiBundle.allDtgCostsR,                   // From API
                upcharges: apiBundle.sellingPriceDisplayAddOns,   // From API
                sizes: manualSizes,                               // Manual cost here
                locations: apiBundle.locations || this.locations  // From API with fallback
            },
            styleNumber: 'MANUAL',
            color: null,
            productInfo: {
                name: 'Manual Pricing (Non-SanMar Product)',
                styleNumber: 'MANUAL',
                brand: 'Various'
            },
            timestamp: Date.now(),
            source: 'manual',
            manualMode: true,
            manualCost: manualCost
        };

        // FINAL VALIDATION: Verify costs array is complete
        console.log('[Manual Pricing] 🔍 Final data structure validation:', {
            totalCosts: manualPricingData.pricing.costs?.length,
            lcCostsCount: manualPricingData.pricing.costs?.filter(c => c.PrintLocationCode === 'LC').length,
            firstFewLcCosts: manualPricingData.pricing.costs
                ?.filter(c => c.PrintLocationCode === 'LC')
                ?.slice(0, 4)
                ?.map(c => `${c.TierLabel}: $${c.PrintCost}`)
        });

        return manualPricingData;
    }

    /**
     * Fetch all pricing data from APIs (with bundle endpoint support)
     * @param {string} styleNumber - Product style number (e.g., 'PC61')
     * @param {string} color - Color name (optional, for inventory filtering)
     * @returns {Object} Combined pricing data
     */
    async fetchPricingData(styleNumber, color = null, forceRefresh = false) {
        // FIRST: Check for manual cost override
        const manualCost = this.getManualCostOverride();
        if (manualCost !== null) {
            console.log('[DTGPricingService] 🔧 MANUAL PRICING MODE - Base cost:', manualCost);
            return await this.generateManualPricingData(manualCost);
        }

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

        // Use bundle endpoint only - no fallback to individual endpoints
        console.log('[DTGPricingService] Fetching data from bundle endpoint for:', styleNumber, color);

        try {
            const bundleData = await this.fetchBundledData(styleNumber, color);

            // Bundle endpoint is required - no fallback
            if (!bundleData) {
                throw new Error(`Failed to fetch DTG pricing data for ${styleNumber}. API bundle endpoint is required.`);
            }

            console.log('[DTGPricingService] Bundle endpoint data received successfully');

            // Cache the bundled data
            this.cache.set(cacheKey, { data: bundleData, timestamp: Date.now() });
            console.log(`[DTGPricingService] Cached pricing data for:`, cacheKey);

            return bundleData;

        } catch (error) {
            console.error('[DTGPricingService] Error fetching bundle data:', error);
            // Clear cache on error to prevent stale data
            this.cache.delete(cacheKey);
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
// 🔍 DEBUG: Log what data parameter looks like when received        console.log('🔍 [DTGPricingService] calculateAllLocationPrices RECEIVED:', {            dataType: typeof data,            dataKeys: data ? Object.keys(data) : [],            tiersType: typeof data?.tiers,            tiersIsArray: Array.isArray(data?.tiers),            tiersLength: data?.tiers?.length,            costsLength: data?.costs?.length,            sizesLength: data?.sizes?.length,            upchargesLength: data?.upcharges ? Object.keys(data.upcharges).length : 0        });
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
        // CRITICAL: Use 'price' field not 'maxCasePrice' (fixed 2025-10-05)
        const validPrices = sizes
            .map(s => parseFloat(s.price))
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
            // CRITICAL: Use 'price' field not 'maxCasePrice' (fixed 2025-10-05)
            const sizePrice = parseFloat(sizeInfo.price);

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
        // Defensive null checking - prevent crash if tiers is undefined
        if (!tiers || !Array.isArray(tiers) || tiers.length === 0) {
            console.error('[DTGPricingService] ERROR: Invalid tiers parameter:', tiers);
            // Return a safe fallback tier
            return {
                TierLabel: '24-47',
                MinQuantity: 1,
                MaxQuantity: 47,
                MarginDenominator: 0.6,
                Note: 'Fallback tier - tiers parameter was invalid'
            };
        }

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
     * Get service status and configuration
     */
    getServiceStatus() {
        return {
            bundleEndpointEnabled: true,
            cacheEntries: this.cache.size,
            apiBase: this.apiBase
        };
    }
}

// Make available globally
window.DTGPricingService = DTGPricingService;

console.log('[DTGPricingService] Service loaded with API bundle endpoint (required for operation)');