/**
 * DTF Pricing Service (100% API-DRIVEN)
 * Direct API implementation for DTF (Direct-to-Film) transfer pricing
 * Fetches pricing data from Caspio API and transforms for calculator use
 *
 * ⚠️ NO FALLBACK VALUES - If API fails, errors are thrown
 * This prevents wrong pricing from being shown to users.
 */

class DTFPricingService {
    constructor() {
        this.baseURL = 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';
        this.cachePrefix = 'dtfPricingData';
        this.cacheDuration = 5 * 60 * 1000; // 5 minutes
        this.apiData = null;
        console.log('[DTFPricingService] Initialized');
    }

    /**
     * Check for manual cost override from URL parameter or sessionStorage
     * @returns {number|null} Manual cost or null if not set
     */
    getManualCostOverride() {
        const urlParams = new URLSearchParams(window.location.search);
        const urlCost = urlParams.get('manualCost') || urlParams.get('cost');
        if (urlCost && !isNaN(parseFloat(urlCost))) {
            const cost = parseFloat(urlCost);
            console.log('[DTFPricingService] Manual cost from URL:', cost);
            sessionStorage.setItem('manualCostOverride', cost.toString());
            return cost;
        }

        const storedCost = sessionStorage.getItem('manualCostOverride');
        if (storedCost && !isNaN(parseFloat(storedCost))) {
            const cost = parseFloat(storedCost);
            console.log('[DTFPricingService] Manual cost from storage:', cost);
            return cost;
        }

        return null;
    }

    /**
     * Clear manual cost override
     */
    clearManualCostOverride() {
        sessionStorage.removeItem('manualCostOverride');
        console.log('[DTFPricingService] Manual cost override cleared');
    }

    /**
     * Fetch DTF pricing bundle from API using reference product
     * @returns {Object} Complete pricing bundle from API
     * @throws {Error} If API request fails
     */
    async fetchPricingBundle() {
        const url = `${this.baseURL}/api/pricing-bundle?method=DTF&styleNumber=PC61`;
        console.log('[DTFPricingService] Fetching complete pricing bundle from API...');

        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to fetch DTF pricing bundle from API: ${response.status}`);
        }

        const data = await response.json();

        // Validate required fields
        if (!data.tiersR || !data.allDtfCostsR || !data.freightR) {
            throw new Error('Invalid API response: missing required DTF pricing data');
        }

        console.log('[DTFPricingService] Successfully fetched complete pricing bundle from API');
        return data;
    }

    /**
     * Generate pricing data using manual cost + API pricing rules
     * Fetches everything from API except garment base cost
     * DTF uses garment cost + transfer cost + labor + freight
     * @param {number} manualCost - Base garment cost
     * @returns {Object} Pricing data with API rules + manual garment cost
     */
    async generateManualPricingData(manualCost) {
        console.log('[DTFPricingService] Generating manual pricing data with base cost:', manualCost);

        // Fetch complete pricing bundle from API (throws error if fails - no fallback)
        const apiBundle = await this.fetchPricingBundle();

        // Use API data with manual cost
        const syntheticAPIData = {
            styleNumber: 'MANUAL',
            tiersR: apiBundle.tiersR,          // From API
            allDtfCostsR: apiBundle.allDtfCostsR,  // From API
            freightR: apiBundle.freightR,      // From API
            rulesR: apiBundle.rulesR,          // From API
            locations: apiBundle.locations || [{ code: 'FRONT', name: 'Front' }, { code: 'BACK', name: 'Back' }],
            manualMode: true,
            manualCost: manualCost
        };

        // Transform using existing method
        const transformedData = this.transformApiData(syntheticAPIData);

        // Mark as manual mode
        transformedData.manualMode = true;
        transformedData.manualCost = manualCost;
        transformedData.source = 'manual';

        return transformedData;
    }

    /**
     * Main entry point - fetches DTF pricing data from API
     */
    async fetchPricingData(styleNumber = null, options = {}) {
        // FIRST: Check for manual cost override
        const manualCost = this.getManualCostOverride();
        if (manualCost !== null) {
            console.log('[DTFPricingService] 🔧 MANUAL PRICING MODE - Base cost:', manualCost);
            const manualData = await this.generateManualPricingData(manualCost);
            this.apiData = manualData;
            return manualData;
        }

        console.log('[DTFPricingService] Fetching DTF pricing data', styleNumber ? `for style: ${styleNumber}` : '(generic)');

        // Build cache key based on style number
        const cacheKey = styleNumber ? `${this.cachePrefix}-${styleNumber}` : `${this.cachePrefix}-bundle`;
        const cached = this.getFromCache(cacheKey);
        if (cached && !options.forceRefresh) {
            console.log('[DTFPricingService] Returning cached data');
            this.apiData = cached;
            return cached;
        }

        try {
            // Build API URL with optional style number
            let apiUrl = `${this.baseURL}/api/pricing-bundle?method=DTF`;
            if (styleNumber) {
                apiUrl += `&styleNumber=${encodeURIComponent(styleNumber)}`;
            }

            // Fetch from API
            const response = await fetch(apiUrl);

            if (!response.ok) {
                throw new Error(`API request failed: ${response.status}`);
            }

            const data = await response.json();
            console.log('[DTFPricingService] API data received:', data);

            // Validate required fields
            if (!data.tiersR || !data.allDtfCostsR || !data.freightR) {
                throw new Error('Invalid API response - missing required fields');
            }

            // Transform to usable format
            const transformedData = this.transformApiData(data);

            // Cache the result
            this.saveToCache(cacheKey, transformedData);
            this.apiData = transformedData;

            return transformedData;
        } catch (error) {
            console.error('[DTFPricingService] Error:', error);
            throw error;
        }
    }

    /**
     * Transform API data to match existing DTFConfig structure
     */
    transformApiData(apiData) {
        console.log('[DTFPricingService] Transforming API data');
        
        // Group transfer costs by size
        const transferSizes = this.buildTransferSizes(apiData.allDtfCostsR);
        
        // Extract freight tiers
        const freightTiers = this.buildFreightTiers(apiData.freightR);
        
        // Extract pricing tiers for margins and LTM
        const pricingTiers = this.buildPricingTiers(apiData.tiersR);
        
        // Get labor cost from API - NO FALLBACK
        const laborCostPerLocation = apiData.allDtfCostsR[0]?.PressingLaborCost;
        if (laborCostPerLocation === undefined) {
            throw new Error('API response missing PressingLaborCost');
        }
        
        // Get rounding method
        const roundingMethod = apiData.rulesR?.RoundingMethod || 'HalfDollarCeil_Final';
        
        return {
            transferSizes,
            freightTiers,
            pricingTiers,
            laborCostPerLocation,
            roundingMethod,
            locations: apiData.locations || [],
            raw: apiData // Keep raw data for reference
        };
    }

    /**
     * Build transfer sizes structure from API data
     */
    buildTransferSizes(dtfCosts) {
        const sizes = {
            'small': {
                name: 'Up to 5" x 5"',
                displayName: 'Small (Up to 5" x 5")',
                maxWidth: 5,
                maxHeight: 5,
                pricingTiers: []
            },
            'medium': {
                name: 'Up to 9" x 12"',
                displayName: 'Medium (Up to 9" x 12")',
                maxWidth: 9,
                maxHeight: 12,
                pricingTiers: []
            },
            'large': {
                name: 'Up to 12" x 16.5"',
                displayName: 'Large (Up to 12" x 16.5")',
                maxWidth: 12,
                maxHeight: 16.5,
                pricingTiers: []
            }
        };

        // Map API sizes to our size keys
        const sizeMap = {
            'Up to 5" x 5"': 'small',
            'Up to 9" x 12"': 'medium',
            'Up to 12" x 16.5"': 'large'
        };

        // Process each cost record
        dtfCosts.forEach(cost => {
            const sizeKey = sizeMap[cost.size];
            if (sizeKey && sizes[sizeKey]) {
                sizes[sizeKey].pricingTiers.push({
                    minQty: cost.min_quantity,
                    maxQty: cost.max_quantity,
                    unitPrice: cost.unit_price,
                    range: cost.quantity_range,
                    laborCost: cost.PressingLaborCost
                });
            }
        });

        // Sort pricing tiers by minQty
        Object.values(sizes).forEach(size => {
            size.pricingTiers.sort((a, b) => a.minQty - b.minQty);
        });

        return sizes;
    }

    /**
     * Build freight tiers from API data
     */
    buildFreightTiers(freightData) {
        return freightData.map(tier => ({
            minQty: tier.min_quantity,
            maxQty: tier.max_quantity,
            costPerTransfer: tier.cost_per_transfer
        })).sort((a, b) => a.minQty - b.minQty);
    }

    /**
     * Build pricing tiers for margins and fees
     */
    buildPricingTiers(tiersData) {
        return tiersData.map(tier => ({
            tierLabel: tier.TierLabel,
            minQuantity: tier.MinQuantity,
            maxQuantity: tier.MaxQuantity,
            marginDenominator: tier.MarginDenominator,
            ltmFee: tier.LTM_Fee || 0
        })).sort((a, b) => a.minQuantity - b.minQuantity);
    }

    /**
     * Calculate per-tier base price for DTF transfers (single or dual location).
     * Does NOT include LTM distribution — consumers add (ltmFee / userSelectedQty).
     *
     * @param {number} garmentCost - Base garment cost (before margin markup)
     * @param {Object} data - From fetchPricingData()
     * @param {string} primarySizeKey - 'small' | 'medium' | 'large'
     * @param {string|null} secondarySizeKey - Optional 2nd-location size key
     * @returns {Array<{ label, isLTM, ltmFee, basePrice }>}
     */
    calculateAllTierPrices(garmentCost, data, primarySizeKey, secondarySizeKey = null) {
        const transferSize = data.transferSizes[primarySizeKey];
        if (!transferSize) return [];

        return transferSize.pricingTiers.map(transferTier => {
            const repQty = transferTier.minQty;

            const marginTier = data.pricingTiers.find(t =>
                repQty >= t.minQuantity && repQty <= t.maxQuantity
            );
            const marginDenom = marginTier ? marginTier.marginDenominator : 0.57;

            const freightTier = data.freightTiers.find(t =>
                repQty >= t.minQty && repQty <= t.maxQty
            );
            const freight = freightTier ? freightTier.costPerTransfer : 0;

            let secondTransferPrice = 0;
            if (secondarySizeKey && data.transferSizes[secondarySizeKey]) {
                const secondTier = data.transferSizes[secondarySizeKey].pricingTiers.find(t =>
                    repQty >= t.minQty && repQty <= t.maxQty
                );
                secondTransferPrice = secondTier ? secondTier.unitPrice : 0;
            }
            const locationCount = secondarySizeKey ? 2 : 1;

            const rawTotal = (garmentCost / marginDenom)
                + transferTier.unitPrice
                + secondTransferPrice
                + data.laborCostPerLocation * locationCount
                + freight * locationCount;

            return {
                label: transferTier.range || `${transferTier.minQty}-${transferTier.maxQty}`,
                isLTM: !!(marginTier && marginTier.ltmFee > 0),
                ltmFee: marginTier ? (marginTier.ltmFee || 0) : 0,
                basePrice: Math.ceil(rawTotal * 2) / 2
            };
        });
    }

    /**
     * Calculate the final unit price for a DTF order given garment cost, data, size keys, and quantity.
     * This is the single authoritative formula so rounding/order-of-operations changes
     * only need to happen here — dtf-pricing-calculator.js delegates to this method.
     *
     * Formula (matches dtf-pricing-calculator.js calculatePricing):
     *   PRICE = HalfDollarCeil(
     *     (garmentCost / marginDenominator)
     *     + SUM(transferCost per sizeKey)
     *     + (laborCostPerLocation × locationCount)
     *     + (freightPerTransfer × locationCount)
     *     + Math.floor((ltmFee / quantity) * 100) / 100
     *   )
     *
     * @param {number} garmentCost - Base garment cost (before margin markup)
     * @param {Object} data - Transformed data from fetchPricingData() (pricingTiers, transferSizes, freightTiers, laborCostPerLocation)
     * @param {string[]} sizeKeys - Array of transfer size keys, one per selected location (e.g. ['medium', 'large'])
     * @param {number} quantity - Order quantity
     * @returns {Object} { finalUnitPrice, garmentWithMargin, marginDenominator, totalTransferCost,
     *                     totalLaborCost, freightPerTransfer, totalFreightCost, locationCount,
     *                     ltmFee, ltmFeePerUnit, subtotalBeforeRounding, tierLabel }
     */
    calculatePriceForQuantity(garmentCost, data, sizeKeys, quantity) {
        const locationCount = sizeKeys.length;

        // Find margin tier
        const marginTier = (data.pricingTiers || []).find(t =>
            quantity >= t.minQuantity && quantity <= t.maxQuantity
        );
        if (!marginTier) {
            throw new Error(`No pricing tier found for quantity ${quantity}`);
        }

        const marginDenominator = marginTier.marginDenominator;
        const garmentWithMargin = garmentCost / marginDenominator;

        // Sum transfer costs for each selected location size
        let totalTransferCost = 0;
        sizeKeys.forEach(sizeKey => {
            const sizeData = data.transferSizes?.[sizeKey];
            if (!sizeData) {
                throw new Error(`Unknown transfer size key: ${sizeKey}`);
            }
            const transferTier = sizeData.pricingTiers.find(t =>
                quantity >= t.minQty && quantity <= t.maxQty
            );
            if (!transferTier) {
                throw new Error(`No transfer pricing tier for size '${sizeKey}' at quantity ${quantity}`);
            }
            totalTransferCost += transferTier.unitPrice;
        });

        // Labor cost (one per location)
        const laborCostPerLocation = data.laborCostPerLocation || 0;
        const totalLaborCost = laborCostPerLocation * locationCount;

        // Freight cost (one per location)
        const freightTier = (data.freightTiers || []).find(t =>
            quantity >= t.minQty && quantity <= t.maxQty
        );
        const freightPerTransfer = freightTier ? freightTier.costPerTransfer : 0;
        const totalFreightCost = freightPerTransfer * locationCount;

        // LTM fee distributed per unit (floor to cents, matching dtf-pricing-calculator.js)
        const ltmFee = marginTier.ltmFee || 0;
        const ltmFeePerUnit = (ltmFee > 0 && quantity > 0)
            ? Math.floor((ltmFee / quantity) * 100) / 100
            : 0;

        const subtotalBeforeRounding =
            garmentWithMargin +
            totalTransferCost +
            totalLaborCost +
            totalFreightCost +
            ltmFeePerUnit;

        const finalUnitPrice = Math.ceil(subtotalBeforeRounding * 2) / 2;

        return {
            finalUnitPrice,
            garmentWithMargin,
            marginDenominator,
            totalTransferCost,
            totalLaborCost,
            freightPerTransfer,
            totalFreightCost,
            locationCount,
            ltmFee,
            ltmFeePerUnit,
            subtotalBeforeRounding,
            tierLabel: marginTier.tierLabel
        };
    }

    /**
     * Get transfer price for a specific size and quantity - REQUIRES API DATA
     * @throws {Error} if API data not loaded
     */
    getTransferPrice(sizeKey, quantity) {
        if (!this.apiData?.transferSizes) {
            throw new Error('API data not loaded - cannot get transfer price');
        }

        const size = this.apiData.transferSizes[sizeKey];
        if (!size) {
            throw new Error(`Unknown transfer size: ${sizeKey}`);
        }

        const tier = size.pricingTiers.find(t => quantity >= t.minQty && quantity <= t.maxQty);
        if (!tier) {
            throw new Error(`No pricing tier found for quantity ${quantity}`);
        }
        return tier.unitPrice;
    }

    /**
     * Get freight cost per transfer for a quantity - REQUIRES API DATA
     * @throws {Error} if API data not loaded
     */
    getFreightPerTransfer(quantity) {
        if (!this.apiData?.freightTiers) {
            throw new Error('API data not loaded - cannot get freight cost');
        }

        const tier = this.apiData.freightTiers.find(t => quantity >= t.minQty && quantity <= t.maxQty);
        if (!tier) {
            throw new Error(`No freight tier found for quantity ${quantity}`);
        }
        return tier.costPerTransfer;
    }

    /**
     * Get LTM fee for a quantity - REQUIRES API DATA
     * @throws {Error} if API data not loaded
     */
    getLTMFee(quantity) {
        if (!this.apiData?.pricingTiers) {
            throw new Error('API data not loaded - cannot get LTM fee');
        }

        const tier = this.apiData.pricingTiers.find(t => quantity >= t.minQuantity && quantity <= t.maxQuantity);
        return tier ? tier.ltmFee : 0;
    }

    /**
     * Get margin denominator for a quantity - REQUIRES API DATA
     * @throws {Error} if API data not loaded
     */
    getMarginDenominator(quantity) {
        if (!this.apiData?.pricingTiers) {
            throw new Error('API data not loaded - cannot get margin');
        }

        const tier = this.apiData.pricingTiers.find(t => quantity >= t.minQuantity && quantity <= t.maxQuantity);
        if (!tier) {
            throw new Error(`No pricing tier found for quantity ${quantity}`);
        }
        return tier.marginDenominator;
    }

    /**
     * Get labor cost per location - REQUIRES API DATA
     * @throws {Error} if API data not loaded
     */
    getLaborCostPerLocation() {
        if (!this.apiData?.laborCostPerLocation) {
            throw new Error('API data not loaded - cannot get labor cost');
        }
        return this.apiData.laborCostPerLocation;
    }

    /**
     * Apply rounding based on API rules - REQUIRES API DATA
     * @throws {Error} if API data not loaded
     */
    applyRounding(price) {
        if (!this.apiData) {
            throw new Error('API data not loaded - cannot apply rounding');
        }

        const method = this.apiData.roundingMethod;

        // HalfDollarCeil_Final - always round UP to nearest $0.50
        if (method === 'HalfDollarCeil_Final' || method === 'HalfDollarUp_Final') {
            return this.roundUpToHalfDollar(price);
        }

        return price; // No rounding if method unknown
    }

    /**
     * Check if API data is loaded and valid
     */
    isLoaded() {
        return !!(this.apiData?.transferSizes && this.apiData?.freightTiers && this.apiData?.pricingTiers);
    }

    /**
     * Round up to nearest $0.50
     */
    roundUpToHalfDollar(price) {
        if (price % 0.5 === 0) return price;
        return Math.ceil(price * 2) / 2;
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
            console.warn('[DTFPricingService] Cache save failed:', e);
        }
    }

    clearCache() {
        const keys = Object.keys(sessionStorage);
        keys.forEach(key => {
            if (key.startsWith(this.cachePrefix)) {
                sessionStorage.removeItem(key);
            }
        });
        console.log('[DTFPricingService] Cache cleared');
    }

    /**
     * Get service status
     */
    getStatus() {
        return {
            service: 'DTFPricingService',
            apiEndpoint: `${this.baseURL}/api/pricing-bundle?method=DTF`,
            cacheEnabled: true,
            cacheDuration: this.cacheDuration,
            dataLoaded: !!this.apiData,
            hasTransferSizes: !!(this.apiData?.transferSizes),
            hasFreightTiers: !!(this.apiData?.freightTiers),
            hasPricingTiers: !!(this.apiData?.pricingTiers)
        };
    }
}

// Make service globally available
window.DTFPricingService = DTFPricingService;