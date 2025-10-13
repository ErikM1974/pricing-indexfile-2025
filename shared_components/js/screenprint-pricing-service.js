/**
 * Screen Print Pricing Service
 * Direct API implementation for screen print pricing
 * Implements exact pricing logic from XML specifications
 *
 * ⚠️ SHARED SERVICE - Used by Multiple Pages
 *
 * This service is used by BOTH:
 * - /calculators/screen-print-pricing.html (Source of Truth)
 * - /calculators/screenprint-manual-pricing.html (Manual Calculator)
 *
 * Changes to pricing calculations here affect both pages.
 *
 * Key pricing logic implemented here:
 * - Flash charge per color calculation (ALL colors)
 * - Primary location: base cost + flash, then apply margin
 * - Additional location: use BasePrintCost as-is (margin included)
 * - Rounding: HalfDollarCeil_Final (round UP to $0.50)
 *
 * ⚠️ CRITICAL: CALCULATOR SYNCHRONIZATION REQUIREMENTS
 *
 * Two calculators depend on Screen Print pricing logic:
 * 1. /calculators/screen-print-pricing.html - Single-product pricing calculator
 * 2. /quote-builders/screenprint-quote-builder.html - Multi-product quote builder
 *
 * ⚠️ THESE CALCULATORS MUST SHOW IDENTICAL PRICES FOR THE SAME INPUTS
 *
 * SHARED CODE (changes automatically sync):
 * - This file (screenprint-pricing-service.js) - API fetching, pricing formulas
 * - API tier data (LTM fees, margin denominators, print costs)
 *
 * INDEPENDENT CODE (must update manually in BOTH places):
 * - LTM fee calculation logic:
 *   • Quote Builder: quote-builders/screenprint-quote-builder.html lines 3015-3044
 *   • Pricing Calc: shared_components/js/screenprint-pricing-v2.js lines 1587-1595
 *
 * - LTM fee display text:
 *   • Quote Builder: line 2732 (per-product notice)
 *   • Pricing Calc: lines 227, 246 (tier button labels)
 *
 * - Rounding logic:
 *   • Quote Builder: line 2794 (Math.round subtotal calculation)
 *   • Pricing Calc: calculation methods in screenprint-pricing-v2.js
 *
 * BEFORE MAKING PRICING CHANGES:
 * 1. Test change in BOTH calculators with identical inputs
 * 2. Verify both calculators show same final price per piece
 * 3. Check LTM fee displays correctly in both UIs
 * 4. Update this comment if you add new independent logic
 *
 * TESTING COMMAND:
 * Open both calculators side-by-side with:
 * - Same product (e.g., PC61 Forest Green)
 * - Same quantity (e.g., 37 pieces)
 * - Same setup (e.g., 3 colors + underbase + safety stripes on front and back)
 * - Verify prices match exactly: $29.85/piece
 */

class ScreenPrintPricingService {
    constructor() {
        this.baseURL = 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';
        this.cachePrefix = 'screenprintPricingData';
        this.cacheDuration = 5 * 60 * 1000; // 5 minutes
        console.log('[ScreenPrintPricingService] Initialized');
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
            console.log('[ScreenPrintPricingService] Manual cost from URL:', cost);
            sessionStorage.setItem('manualCostOverride', cost.toString());
            return cost;
        }

        const storedCost = sessionStorage.getItem('manualCostOverride');
        if (storedCost && !isNaN(parseFloat(storedCost))) {
            const cost = parseFloat(storedCost);
            console.log('[ScreenPrintPricingService] Manual cost from storage:', cost);
            return cost;
        }

        return null;
    }

    /**
     * Clear manual cost override
     */
    clearManualCostOverride() {
        sessionStorage.removeItem('manualCostOverride');
        console.log('[ScreenPrintPricingService] Manual cost override cleared');
    }

    /**
     * Fetch Screen Print pricing bundle from API using reference product
     * @returns {Object} Complete pricing bundle from API
     * @throws {Error} If API request fails
     */
    async fetchPricingBundle() {
        const url = `${this.baseURL}/api/pricing-bundle?method=ScreenPrint&styleNumber=PC61`;
        console.log('[ScreenPrintPricingService] 📡 Fetching complete pricing bundle from API...');
        console.log('[ScreenPrintPricingService] 🔗 URL:', url);

        const response = await fetch(url);
        console.log('[ScreenPrintPricingService] 📊 API Response Status:', response.status, response.statusText);

        if (!response.ok) {
            const errorText = await response.text();
            console.error('[ScreenPrintPricingService] ❌ API Error Response:', errorText);
            throw new Error(`Failed to fetch Screen Print pricing bundle from API: ${response.status}`);
        }

        const data = await response.json();
        console.log('[ScreenPrintPricingService] 📦 API Data Structure:', {
            totalTiers: data.tiersR?.length,
            totalCosts: data.allScreenprintCostsR?.length,
            hasSizes: !!data.sizes,
            hasRules: !!data.rulesR
        });

        // Validate required fields
        if (!data.tiersR || !data.allScreenprintCostsR) {
            console.error('[ScreenPrintPricingService] ❌ Missing required fields:', {
                tiersR: !!data.tiersR,
                allScreenprintCostsR: !!data.allScreenprintCostsR
            });
            throw new Error('Invalid API response: missing required Screen Print pricing data');
        }

        // Log sample tier and cost data for debugging
        if (data.tiersR && data.tiersR.length > 0) {
            console.log('[ScreenPrintPricingService] 📊 Sample Tier:', data.tiersR[0]);
        }
        if (data.allScreenprintCostsR && data.allScreenprintCostsR.length > 0) {
            console.log('[ScreenPrintPricingService] 💰 Sample Cost:', data.allScreenprintCostsR[0]);
        }

        console.log('[ScreenPrintPricingService] ✅ Successfully fetched complete pricing bundle from API');
        return data;
    }

    /**
     * Generate pricing data using manual cost + API pricing rules
     * Fetches everything from API except garment base cost
     * @param {number} manualCost - Base garment cost
     * @returns {Object} Pricing data with API rules + manual garment cost
     */
    async generateManualPricingData(manualCost) {
        console.log('[ScreenPrintPricingService] 🔧 Generating manual pricing data with base cost:', manualCost);

        // Fetch complete pricing bundle from API (throws error if fails - no fallback)
        console.log('[ScreenPrintPricingService] 📡 Fetching pricing rules from API...');
        const apiBundle = await this.fetchPricingBundle();
        console.log('[ScreenPrintPricingService] ✅ API bundle received, building manual pricing data...');

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

        // Use API data with manual cost substituted into sizes
        const syntheticAPIData = {
            styleNumber: 'MANUAL',
            tiersR: apiBundle.tiersR,                          // From API
            allScreenprintCostsR: apiBundle.allScreenprintCostsR,  // From API
            sizes: manualSizes,                                 // Manual cost here
            sellingPriceDisplayAddOns: apiBundle.sellingPriceDisplayAddOns,  // From API
            rulesR: apiBundle.rulesR,                          // From API
            manualMode: true,
            manualCost: manualCost
        };

        // Use existing calculatePricing method
        const calculatedData = this.calculatePricing(syntheticAPIData);

        // Transform using existing method
        const transformedData = this.transformToExistingFormat(calculatedData, syntheticAPIData);

        // Mark as manual mode
        transformedData.manualMode = true;
        transformedData.manualCost = manualCost;
        transformedData.source = 'manual';

        console.log('[ScreenPrintPricingService] ✅ Manual pricing data generated:', {
            tierCount: Object.keys(transformedData.tierData || {}).length,
            locationCount: transformedData.printLocationMeta?.length || 0,
            colorCounts: transformedData.availableColorCounts || [],
            hasPrimaryPricing: !!transformedData.primaryLocationPricing,
            hasAdditionalPricing: !!transformedData.additionalLocationPricing,
            manualCost: manualCost
        });

        return transformedData;
    }

    /**
     * Main entry point - fetches and calculates pricing data
     */
    async fetchPricingData(styleNumber, options = {}) {
        // FIRST: Check for manual cost override
        const manualCost = this.getManualCostOverride();
        if (manualCost !== null) {
            console.log('[ScreenPrintPricingService] 🔧 MANUAL PRICING MODE - Base cost:', manualCost);
            return await this.generateManualPricingData(manualCost);
        }

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
        // FLASH CHARGE LOGIC:
        // Flash charge is applied PER COLOR for ALL garments (light or dark)
        // This simplifies pricing - no need to detect garment color
        // Formula: flashCharge × colorCount
        // Example: 3 colors × $0.35 = $1.05 flash charge
        const flashChargePerColor = rulesData.FlashCharge ? parseFloat(rulesData.FlashCharge) : 0;
        console.log('[ScreenPrintPricingService] Flash charge per color:', flashChargePerColor);

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

                // Apply flash charge per color, then margin
                const flashChargeTotal = flashChargePerColor * colorCount;
                const totalCost = basePrintCost + flashChargeTotal;
                finalPrintCost = totalCost / marginDenom;

                console.log(`[ScreenPrintPricingService] Primary ${tierLabel} ${colorCount}-color: Base $${basePrintCost.toFixed(2)} + Flash ($${flashChargePerColor} × ${colorCount}) = $${totalCost.toFixed(2)} → Sell $${finalPrintCost.toFixed(2)}`);
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

                            // 🔍 DETAILED TRACE: Log one complete example to verify full calculation
                            if (tierLabel === '37-72' && colorCount === '2' && sizeInfo.size === 'M') {
                                console.log('\n🔍 ═══════════════════════════════════════════════════════════');
                                console.log('🔍 COMPLETE CALCULATION TRACE (37-72 tier, 2 colors, size M):');
                                console.log('🔍 ═══════════════════════════════════════════════════════════');
                                console.log('🔍 Step 1 - Input Values:');
                                console.log('🔍   • Base garment cost: $' + standardGarmentCost.toFixed(2));
                                console.log('🔍   • Tier: ' + tierLabel);
                                console.log('🔍   • Colors: ' + colorCount);
                                console.log('🔍   • Size: ' + sizeInfo.size);

                                const tier = tiersR.find(t => t.TierLabel === tierLabel);
                                console.log('🔍\nStep 2 - Garment with Margin:');
                                console.log('🔍   • Margin denominator: ' + tier.MarginDenominator);
                                console.log('🔍   • Garment selling price: $' + standardGarmentCost.toFixed(2) + ' ÷ ' + tier.MarginDenominator + ' = $' + garmentPrice.toFixed(2));

                                console.log('🔍\nStep 3 - Print Cost Components:');
                                const costEntry = allScreenprintCostsR.find(c =>
                                    c.TierLabel === tierLabel && c.ColorCount === parseInt(colorCount) && c.CostType === 'PrimaryLocation'
                                );
                                if (costEntry) {
                                    const flashTotal = flashChargePerColor * parseInt(colorCount);
                                    console.log('🔍   • Base print cost (from API): $' + costEntry.BasePrintCost.toFixed(2));
                                    console.log('🔍   • Flash charge: $' + flashChargePerColor.toFixed(2) + ' × ' + colorCount + ' = $' + flashTotal.toFixed(2));
                                    console.log('🔍   • Total print cost: $' + costEntry.BasePrintCost.toFixed(2) + ' + $' + flashTotal.toFixed(2) + ' = $' + (costEntry.BasePrintCost + flashTotal).toFixed(2));
                                    console.log('🔍   • Print with margin: $' + (costEntry.BasePrintCost + flashTotal).toFixed(2) + ' ÷ ' + tier.MarginDenominator + ' = $' + printPrice.toFixed(2));
                                }

                                console.log('🔍\nStep 4 - Combine & Round:');
                                console.log('🔍   • Garment: $' + garmentPrice.toFixed(2));
                                console.log('🔍   • Print: $' + printPrice.toFixed(2));
                                console.log('🔍   • Raw total: $' + garmentPrice.toFixed(2) + ' + $' + printPrice.toFixed(2) + ' = $' + rawTotal.toFixed(2));
                                console.log('🔍   • Rounding method: ' + roundingMethod);
                                console.log('🔍   • FINAL PRICE (what customer sees): $' + roundedTotal.toFixed(2));
                                console.log('🔍 ═══════════════════════════════════════════════════════════\n');
                            }
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
            additionalLocationPricing: additionalLocationPricing,

            // Debug information - raw API values before calculations
            debug: {
                baseGarmentCost: apiData.sizes?.find(s => s.size.toUpperCase() === 'S')?.price || apiData.sizes?.[0]?.price || 0,
                basePrintCosts: apiData.allScreenprintCostsR || [],
                flashCharge: apiData.rulesR?.FlashCharge || apiData.rulesData?.FlashCharge || 0,
                roundingMethod: apiData.rulesR?.RoundingMethod || apiData.rulesData?.RoundingMethod || 'HalfDollarCeil_Final',
                marginDenominators: Object.fromEntries(
                    apiData.tiersR?.map(t => [t.TierLabel, t.MarginDenominator]) || []
                )
            }
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