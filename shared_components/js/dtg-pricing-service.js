/**
 * DTG Pricing Service - Direct API Implementation
 * Replaces the complex Caspio master bundle approach with direct API calls
 *
 * ⚠️ SHARED SERVICE - AFFECTS MULTIPLE CALCULATORS
 * This service is used by BOTH:
 * - DTG Quote Builder (/quote-builders/dtg-quote-builder.html)
 * - DTG Pricing Calculator (/calculators/dtg-pricing.html)
 *
 * THE PRICING MATH DOES NOT LIVE HERE (Batch 6, 2026-07-09): every formula
 * (base garment cost, margin, half-dollar rounding, upcharges, LTM, tier
 * resolution) delegates to window.DTGCanonicalPricing — the vendored
 * dtg-canonical-pricing.js, byte-locked to the proxy's canonical engine.
 * This class is fetch/cache/shape-adaptation only. Any formula change happens
 * in the proxy file, gets re-copied, and is proven by the golden-vector +
 * vendored-parity suites.
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
        
        // Batch 6: the canonical engine is REQUIRED (vendored dtg-canonical-pricing.js
        // loads before this service on every page) - fail LOUDLY, never a silent wrong price.
        if (typeof window.DTGCanonicalPricing === 'undefined') {
            console.error('[DTGPricingService] dtg-canonical-pricing.js is missing - DTG pricing cannot compute.');
            if (typeof window.showToast === 'function') window.showToast('DTG pricing engine failed to load - refresh the page.', 'error', 8000);
        }
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
        // Staff-only feature — never resolve a manual cost override on a public
        // (customer-facing) host, matching EMB/cap-EMB (embroidery-pricing-service.js:18).
        // Prevents a ?manualCost= URL param or stale sessionStorage from substituting
        // an arbitrary (too-low) base cost into a live DTG quote on production.
        const host = window.location.hostname;
        const isInternal = host === 'localhost' || host === '127.0.0.1' || host.endsWith('.herokuapp.com');
        if (!isInternal) return null;

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
        
        // Calculate prices for each location (passing all tiers so the LTM
        // print-cost fallback can find the lowest non-LTM tier label).
        this.locations.forEach(location => {
            allLocationPrices[location.code] = this.calculateLocationPrices(
                location.code,
                tier,
                costs,
                sizes,
                upcharges,
                tiers
            );
        });
        
        return allLocationPrices;
    }

    /**
     * Calculate prices for a specific location
     * @private
     */
    calculateLocationPrices(locationCode, tier, costs, sizes, upcharges, allTiers) {
        // Batch 6 (2026-07-09): ALL math delegates to the canonical engine
        // (window.DTGCanonicalPricing - vendored byte-identical from the proxy's
        // lib/dtg-canonical-pricing.js; equality CI-enforced). This wrapper only
        // adapts shapes: N/A marking + the builder's {size: {tierLabel: price}}.
        const prices = {};
        const tiersForResolve = (Array.isArray(allTiers) && allTiers.length) ? allTiers : [tier];
        const r = window.DTGCanonicalPricing.priceForLocationCombo({
            bundle: { pricing: { tiers: tiersForResolve, costs, sizes, upcharges } },
            locationCode,
            tierLabel: tier.TierLabel,
        });
        if (r.error) {
            console.error('[DTGPricingService] No valid garment costs found for any size');
            return prices;
        }
        sizes.forEach(sizeInfo => {
            const size = sizeInfo.size;
            prices[size] = {};
            if (r.perSize[size] == null) {
                prices[size][tier.TierLabel] = 'N/A';
                console.warn(`[DTGPricingService] Size ${size} has invalid price, marking as N/A`);
            } else {
                prices[size][tier.TierLabel] = parseFloat(r.perSize[size].toFixed(2));
            }
        });
        return prices;
    }

    /**
     * Calculate per-tier, per-size base prices for a given print location.
     * Handles combined locations (e.g. "LC_FB" → splits by "_" and sums costs).
     * Does NOT include LTM distribution — consumers add `Math.floor(tier.LTM_Fee / qty * 100) / 100` themselves.
     *
     * Tiers come straight from Caspio's Pricing_Tiers table (filtered by
     * DecorationMethod='DTG'). The LTM tier (1-23) is a real row in Caspio
     * with LTM_Fee > 0; this method no longer synthesizes it client-side.
     *
     * If DTG_Costs has no print-cost rows for the LTM tier (current production
     * reality), we fall back to the lowest non-LTM tier's print costs —
     * preserves the historical "LTM uses 24-47 print cost + LTM fee" pattern.
     *
     * @param {Object} data - From fetchPricingData(): { tiers, costs, sizes, upcharges }
     * @param {string} locationCode - e.g. 'LC', 'FF', 'LC_FB'
     * @returns {Array<{ label, isLTM, ltmFee, basePrices: {size: price} }>}
     */
    calculateAllTierPricesForLocation(data, locationCode) {
        // Batch 6: per-tier delegation to the canonical engine (incl. its LTM-tier
        // print-cost fallback). The matrix historically prices EVERY size label -
        // availability is the caller's concern - so unavailable sizes fall back to
        // baseUnit + upcharge exactly as before.
        const { tiers, costs, sizes, upcharges } = data;
        const sizeLabels = sizes.map(s => s.size);
        const sortedTiers = [...tiers].sort(
            (a, b) => parseInt(a.MinQuantity, 10) - parseInt(b.MinQuantity, 10)
        );
        return sortedTiers.map(tier => {
            const r = window.DTGCanonicalPricing.priceForLocationCombo({
                bundle: { pricing: { tiers, costs, sizes, upcharges } },
                locationCode: locationCode || 'LC',
                tierLabel: tier.TierLabel,
            });
            const basePrices = {};
            sizeLabels.forEach(size => {
                basePrices[size] = r.perSize[size] != null
                    ? r.perSize[size]
                    : r.baseUnit + parseFloat(upcharges[size] || 0);
            });
            return {
                label: tier.TierLabel,
                isLTM: parseFloat(tier.LTM_Fee || 0) > 0,
                ltmFee: parseFloat(tier.LTM_Fee || 0),
                basePrices
            };
        });
    }

    /**
     * Get the appropriate tier for a quantity.
     * Caspio's Pricing_Tiers table is the source of truth — including the
     * 1-23 LTM tier. Just `find()` by range, no special-case branches.
     * @private
     */
    getTierForQuantity(tiers, quantity) {
        if (!tiers || !Array.isArray(tiers) || tiers.length === 0) {
            console.error('[DTGPricingService] ERROR: Invalid tiers parameter:', tiers);
        }
        // Batch 6: canonical resolution (identical range find + the same 0.53 no-LTM
        // fallback shape; adds a top-tier clamp above MaxQuantity - unreachable with
        // the real open-ended 72+ row, locked equal by dtg-cross-repo-formula-parity).
        return window.DTGCanonicalPricing.tierForCombinedQty(tiers, quantity);
    }

    /**
     * Round up to nearest half dollar
     * @private
     */
    roundUpToHalfDollar(amount) {
        return window.DTGCanonicalPricing.roundUpToHalfDollar(amount); // Batch 6: ONE rounding rule
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
     * Calculate price from raw pricing data object (as returned by the DTG product bundle endpoint).
     * Accepts the inner "pricing" sub-object (with tiers, costs, sizes fields).
     * Handles both single locations (e.g. 'LC') and combo locations (e.g. 'LC_FB').
     *
     * Used by dtg-pricing.html to delegate its inline formula so rounding
     * changes only need to happen in one place.
     *
     * @param {Object} rawPricing - The pricingData.pricing object from the page ({ tiers, costs, sizes })
     * @param {string} locationCode - e.g. 'LC', 'FF', 'LC_FB'
     * @param {string} tierLabel - e.g. '24-47', '48-71', '72+'
     * @returns {number} Final price rounded up to nearest $0.50
     */
    calculatePriceFromRawData(rawPricing, locationCode, tierLabel) {
        const { tiers, costs, sizes } = rawPricing;

        // Find the tier data
        const tier = (tiers || []).find(t => t.TierLabel === tierLabel);
        if (!tier) {
            throw new Error(`Tier data not available for ${tierLabel}`);
        }

        // Get valid garment prices — support both 'price' and 'maxCasePrice' field names
        const validPrices = (sizes || [])
            .filter(s => (s.price > 0 || s.maxCasePrice > 0))
            .map(s => s.price || s.maxCasePrice);

        if (validPrices.length === 0) {
            throw new Error('No valid garment prices in API data');
        }

        // Strict pre-validation stays HERE (a missing cost row must THROW, never price
        // low - canonical treats absent rows as $0); composition + rounding then
        // delegate to the canonical engine (Batch 6).
        const locationCodes = locationCode.split('_');
        locationCodes.forEach(code => {
            const costEntry = (costs || []).find(c =>
                c.PrintLocationCode === code && c.TierLabel === tierLabel
            );
            if (!costEntry || !costEntry.PrintCost) {
                throw new Error(`Print cost data missing for ${code} at tier ${tierLabel}`);
            }
        });
        return window.DTGCanonicalPricing.priceForLocationCombo({
            bundle: { pricing: { tiers, costs, sizes, upcharges: {} } },
            locationCode,
            tierLabel,
        }).baseUnit;
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