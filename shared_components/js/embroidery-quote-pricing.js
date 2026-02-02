/**
 * Embroidery Quote Pricing Calculator
 * Implements tier logic, LTM distribution, and totals
 */

class EmbroideryPricingCalculator {
    constructor() {
        this.baseURL = 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';
        
        // Default fallback values (will be replaced by API data)
        this.tiers = {
            '1-23': { embCost: 12.00, hasLTM: true },
            '24-47': { embCost: 12.00, hasLTM: false },
            '48-71': { embCost: 11.00, hasLTM: false },
            '72+': { embCost: 10.00, hasLTM: false }
        };
        
        this.marginDenominator = 0.57; // 2026 margin (43%) - synced with API Pricing_Tiers.MarginDenominator
        this.ltmFee = 50.00;
        this.digitizingFee = 100.00;
        this.additionalStitchRate = 1.25; // per 1000 stitches over 8000 (overridden by API)
        this.baseStitchCount = 8000; // base included stitches for standard positions (overridden by API)
        this.fbBaseStitchCount = 25000; // base included stitches for Full Back position (overridden by API)
        this.fbStitchRate = 1.25; // Full Back stitch rate per 1K (overridden by API)
        this.monogramPrice = 12.50; // Monogram/Name price (overridden by API)
        this.stitchIncrement = 1000; // rounding increment
        
        // Cache for size pricing data
        this.sizePricingCache = {};
        
        // Additional Logo (AL) tiers - will be fetched from API
        this.alTiers = {};

        // Rounding method - will be fetched from API
        this.roundingMethod = null;

        // =========================================
        // CAP EMBROIDERY PRICING (for unified builder)
        // =========================================
        this.capTiers = {};          // Cap pricing tiers (from CAP endpoint)
        this.capAlTiers = {};        // Cap AL pricing (from CAP-AL endpoint)
        this.capInitialized = false; // Track cap pricing loaded
        this.capStitchCount = 8000;  // Fixed 8000 for caps
        // Default cap rounding - will be overridden by API in initializeCapConfig()
        // See lines 388-391 where rulesR.RoundingMethod is loaded from CAP pricing bundle
        this.capRoundingMethod = 'HalfDollarUp'; // Fallback: Caps use half-dollar rounding
        this.capAdditionalStitchRate = 1.00; // Cap default: $1.00/1K (vs Shirt $1.25/1K)

        // =========================================
        // CAP EMBELLISHMENT PRICING (2026)
        // =========================================
        // 3D Puff embroidery upcharge - LOADED FROM API (see initializeCapPricing)
        // This default is a FALLBACK only - actual value comes from Caspio Embroidery_Costs table
        // ItemType='3D-Puff', fetched via /api/pricing-bundle?method=CAP-PUFF
        this.puffUpchargePerCap = 5.00; // Fallback if API fails

        // Laser leatherette patch upcharge - LOADED FROM API (see initializeCapPricing)
        // This default is a FALLBACK only - actual value comes from Caspio Embroidery_Costs table
        // ItemType='Patch', fetched via /api/pricing-bundle?method=PATCH
        // Works like 3D Puff: flat add-on per cap, quantity breaks come from base cap pricing
        this.patchUpchargePerCap = 5.00; // Fallback if API fails
        this.patchSetupFee = 50.00; // GRT-50 setup fee for patches

        // Track API status
        this.apiError = false;

        // Detailed API status tracking
        this.apiStatus = {
            mainPricing: false,      // Main embroidery pricing loaded
            alPricing: false,        // AL pricing loaded
            configuration: false,    // Config values loaded
            capPricing: false,       // Cap pricing loaded
            capAlPricing: false,     // Cap AL pricing loaded
            criticalFailures: [],    // List of critical failures
            warnings: []             // List of non-critical warnings
        };

        // Promise caching for deduplication - prevents multiple concurrent API calls
        this._initializePromise = null;
        this._capInitializePromise = null;

        // Fetch configuration from API
        this.initialized = false;
        this.initializeConfig();
    }
    
    /**
     * Initialize configuration from API
     * PERF FIX 2026-02-01: Added promise caching to prevent duplicate API calls
     * when initializeConfig() is called multiple times during page load
     */
    async initializeConfig() {
        // Return cached promise if already initializing (prevents duplicate calls)
        if (this._initializePromise) {
            return this._initializePromise;
        }

        // Create and cache the initialization promise
        this._initializePromise = this._doInitializeConfig();
        return this._initializePromise;
    }

    /**
     * Internal initialization implementation
     * @private
     */
    async _doInitializeConfig() {
        try {
            console.log('[EmbroideryPricingCalculator] Fetching configuration from API...');
            
            // Fetch embroidery pricing bundle (includes all config)
            const response = await fetch(`${this.baseURL}/api/pricing-bundle?method=EMB&styleNumber=PC54`);
            const data = await response.json();
            
            if (data) {
                // Extract configuration from tiersR
                if (data.tiersR && data.tiersR.length > 0) {
                    this.marginDenominator = data.tiersR[0].MarginDenominator || 0.57; // 2026 fallback
                    
                    // Build tiers object from API data
                    this.tiers = {};
                    data.tiersR.forEach(tier => {
                        this.tiers[tier.TierLabel] = {
                            embCost: 0, // Will be set from allEmbroideryCostsR
                            hasLTM: tier.LTM_Fee > 0
                        };
                        if (tier.LTM_Fee > 0) {
                            this.ltmFee = tier.LTM_Fee;
                        }
                    });
                }
                
                // Extract configuration from allEmbroideryCostsR
                if (data.allEmbroideryCostsR && data.allEmbroideryCostsR.length > 0) {
                    // Use first shirt record for configuration
                    const shirtConfig = data.allEmbroideryCostsR.find(c => c.ItemType === 'Shirt') || data.allEmbroideryCostsR[0];
                    
                    // Apply configuration values
                    this.digitizingFee = shirtConfig.DigitizingFee || 100;
                    this.additionalStitchRate = shirtConfig.AdditionalStitchRate || 1.25;
                    this.baseStitchCount = shirtConfig.BaseStitchCount || shirtConfig.StitchCount || 8000;
                    this.stitchIncrement = shirtConfig.StitchIncrement || 1000;
                    
                    // Update tier embroidery costs
                    data.allEmbroideryCostsR.forEach(cost => {
                        if (cost.ItemType === 'Shirt' && this.tiers[cost.TierLabel]) {
                            this.tiers[cost.TierLabel].embCost = cost.EmbroideryCost;
                        }
                    });
                    
                    console.log('[EmbroideryPricingCalculator] Configuration loaded from API:');
                    console.log('- Digitizing Fee:', this.digitizingFee);
                    console.log('- Additional Stitch Rate:', this.additionalStitchRate);
                    console.log('- Base Stitch Count:', this.baseStitchCount);
                    console.log('- Tiers:', this.tiers);
                    
                    // Mark main pricing as successfully loaded
                    this.apiStatus.mainPricing = true;
                    this.apiStatus.configuration = true;
                }
                
                // Extract rounding method
                if (data.rulesR && data.rulesR.RoundingMethod) {
                    this.roundingMethod = data.rulesR.RoundingMethod;
                    console.log('[EmbroideryPricingCalculator] Rounding method:', this.roundingMethod);
                } else {
                    // Fallback: fetch from pricing-rules endpoint
                    await this.fetchRoundingRules();
                }
            }
            
            // Fetch Additional Logo (AL) pricing from EMB-AL endpoint
            try {
                console.log('[EmbroideryPricingCalculator] Fetching AL pricing from EMB-AL endpoint...');
                const alResponse = await fetch(`${this.baseURL}/api/pricing-bundle?method=EMB-AL`);
                const alData = await alResponse.json();
                
                console.log('🔍 [DEBUG] Raw EMB-AL API Response:', alData);
                
                if (alData && alData.allEmbroideryCostsR && alData.allEmbroideryCostsR.length > 0) {
                    this.alTiers = {};
                    alData.allEmbroideryCostsR.forEach(cost => {
                        if (cost.ItemType === 'AL') {
                            console.log(`🔍 [DEBUG] AL Tier ${cost.TierLabel}: EmbroideryCost = $${cost.EmbroideryCost}, BaseStitchCount = ${cost.BaseStitchCount}, AdditionalStitchRate = $${cost.AdditionalStitchRate}`);
                            this.alTiers[cost.TierLabel] = {
                                embCost: cost.EmbroideryCost,
                                hasLTM: cost.TierLabel === '1-23',
                                baseStitchCount: cost.BaseStitchCount || 8000,
                                additionalStitchRate: cost.AdditionalStitchRate || 1.25
                            };
                        }
                    });
                    console.log('[EmbroideryPricingCalculator] AL pricing loaded from API:', this.alTiers);
                    this.apiStatus.alPricing = true;
                } else {
                    throw new Error('No AL data in response');
                }
            } catch (alError) {
                console.error('[EmbroideryPricingCalculator] CRITICAL: Failed to load AL pricing from API');
                console.error('[EmbroideryPricingCalculator] Error:', alError);
                
                // NO SILENT FALLBACK - Show error and track failure
                this.alTiers = {};
                this.apiStatus.alPricing = false;
                this.apiStatus.criticalFailures.push('Additional Logo (AL) pricing unavailable - API connection failed');
                
                // Show warning to user
                this.showAPIWarning(
                    'Additional Logo pricing is unavailable. ' +
                    'AL quotes cannot be calculated at this time. ' +
                    'Please contact IT support immediately.',
                    'al-pricing'
                );
            }
            
            // Load service codes from database (replaces hardcoded pricing values)
            await this.loadServiceCodes();

            this.initialized = true;
            console.log('[EmbroideryPricingCalculator] Initialization complete');
            
        } catch (error) {
            console.error('[EmbroideryPricingCalculator] CRITICAL ERROR: Failed to load pricing configuration');
            console.error('[EmbroideryPricingCalculator] Error:', error);
            
            // Mark API as failed
            this.apiError = true;
            this.apiStatus.mainPricing = false;
            this.apiStatus.configuration = false;
            this.apiStatus.criticalFailures.push('Main embroidery pricing configuration unavailable');
            
            // Show prominent warning to user - NO FALLBACK VALUES
            this.showAPIWarning(
                'CRITICAL ERROR: Unable to load pricing configuration from server. ' +
                'The quote calculator cannot function without pricing data. ' +
                'DO NOT attempt to create quotes. ' +
                'Please contact IT support immediately.',
                'main-pricing'
            );
            
            // DO NOT initialize with fallback values - system should not work without valid pricing
            this.initialized = false;
            
            // Disable quote functionality
            this.disableQuoteCreation();
        }
    }
    
    /**
     * Fetch rounding rules from API (fallback method)
     */
    async fetchRoundingRules() {
        try {
            const response = await fetch(`${this.baseURL}/api/pricing-rules?method=EmbroideryShirts`);
            const data = await response.json();

            if (data && data.length > 0) {
                const roundingRule = data.find(rule => rule.RuleName === 'RoundingMethod');
                if (roundingRule) {
                    this.roundingMethod = roundingRule.RuleValue;
                    console.log('[EmbroideryPricingCalculator] Rounding method from pricing-rules:', this.roundingMethod);
                }
            }
        } catch (error) {
            console.warn('[EmbroideryPricingCalculator] Could not fetch rounding rules, using default CeilDollar');
            this.roundingMethod = 'CeilDollar'; // Default for embroidery
        }
    }

    // =========================================
    // SERVICE CODES - Database-driven pricing values
    // =========================================

    /**
     * Load service codes from API (replaces hardcoded pricing values)
     * Service codes include: FB stitch settings, LTM fee, monogram price, stitch rates, etc.
     * This is called at the end of initialization to override default values with database values.
     */
    async loadServiceCodes() {
        try {
            console.log('[EmbroideryPricingCalculator] Loading service codes from API...');
            const response = await fetch(`${this.baseURL}/api/service-codes`);
            const data = await response.json();

            if (data.success && data.data) {
                const codes = data.data;
                console.log(`[EmbroideryPricingCalculator] Loaded ${codes.length} service codes from database`);

                // FB (Full Back) - stitch-based pricing
                // BUG FIX 2026-02-01: Removed PricingMethod filter - API may return null
                // FB pricing is determined by ServiceCode alone; PricingMethod is metadata only
                const fb = codes.find(c => c.ServiceCode === 'FB');
                if (fb) {
                    this.fbBaseStitchCount = fb.StitchBase || 25000;
                    // FB stitch rate from SellPrice (per 1K stitches)
                    if (fb.SellPrice) {
                        this.fbStitchRate = fb.SellPrice;
                    }
                    console.log(`  - FB: StitchBase=${this.fbBaseStitchCount}, Rate=$${fb.SellPrice}/1K`);
                }

                // LTM (Less Than Minimum) fee
                const ltm = codes.find(c => c.ServiceCode === 'LTM');
                if (ltm && ltm.SellPrice) {
                    this.ltmFee = ltm.SellPrice;
                    console.log(`  - LTM Fee: $${this.ltmFee}`);
                }

                // GRT-50 (Patch Setup Fee)
                const grt50 = codes.find(c => c.ServiceCode === 'GRT-50');
                if (grt50 && grt50.SellPrice) {
                    this.patchSetupFee = grt50.SellPrice;
                    console.log(`  - Patch Setup Fee (GRT-50): $${this.patchSetupFee}`);
                }

                // Monogram pricing
                const monogram = codes.find(c => c.ServiceCode === 'Monogram');
                if (monogram && monogram.SellPrice) {
                    this.monogramPrice = monogram.SellPrice;
                    console.log(`  - Monogram Price: $${this.monogramPrice}`);
                }

                // CONFIG: Garment stitch rate
                const stitchRate = codes.find(c => c.ServiceCode === 'STITCH-RATE');
                if (stitchRate) {
                    if (stitchRate.SellPrice) {
                        this.additionalStitchRate = stitchRate.SellPrice;
                    }
                    if (stitchRate.StitchBase) {
                        this.baseStitchCount = stitchRate.StitchBase;
                    }
                    console.log(`  - Garment Stitch Rate: $${this.additionalStitchRate}/1K, Base: ${this.baseStitchCount}`);
                }

                // CONFIG: Cap stitch rate
                const capStitchRate = codes.find(c => c.ServiceCode === 'CAP-STITCH-RATE');
                if (capStitchRate) {
                    if (capStitchRate.SellPrice) {
                        this.capAdditionalStitchRate = capStitchRate.SellPrice;
                    }
                    if (capStitchRate.StitchBase) {
                        this.capStitchCount = capStitchRate.StitchBase;
                    }
                    console.log(`  - Cap Stitch Rate: $${this.capAdditionalStitchRate}/1K, Base: ${this.capStitchCount}`);
                }

                // CONFIG: 3D Puff upcharge
                const puffUpcharge = codes.find(c => c.ServiceCode === 'PUFF-UPCHARGE');
                if (puffUpcharge && puffUpcharge.SellPrice) {
                    this.puffUpchargePerCap = puffUpcharge.SellPrice;
                    console.log(`  - Puff Upcharge: $${this.puffUpchargePerCap}/cap`);
                }

                // CONFIG: Patch upcharge
                const patchUpcharge = codes.find(c => c.ServiceCode === 'PATCH-UPCHARGE');
                if (patchUpcharge && patchUpcharge.SellPrice) {
                    this.patchUpchargePerCap = patchUpcharge.SellPrice;
                    console.log(`  - Patch Upcharge: $${this.patchUpchargePerCap}/cap`);
                }

                console.log('[EmbroideryPricingCalculator] Service codes applied successfully');
            }
        } catch (error) {
            console.warn('[EmbroideryPricingCalculator] Failed to load service codes, using defaults:', error.message);
            // Non-critical - continue with hardcoded defaults
        }
    }

    // =========================================
    // CAP EMBROIDERY PRICING METHODS
    // =========================================

    /**
     * Initialize cap pricing configuration from CAP API endpoint
     * Called on-demand when a cap product is detected
     * PERF FIX 2026-02-01: Added promise caching to prevent duplicate API calls
     */
    async initializeCapConfig() {
        if (this.capInitialized) {
            return; // Already loaded
        }

        // Return cached promise if already initializing (prevents duplicate calls)
        if (this._capInitializePromise) {
            return this._capInitializePromise;
        }

        // Create and cache the initialization promise
        this._capInitializePromise = this._doInitializeCapConfig();
        return this._capInitializePromise;
    }

    /**
     * Internal cap initialization implementation
     * @private
     */
    async _doInitializeCapConfig() {
        console.log('[EmbroideryPricingCalculator] Initializing cap pricing configuration...');

        try {
            // Fetch cap pricing bundle
            const response = await fetch(`${this.baseURL}/api/pricing-bundle?method=CAP&styleNumber=C112`);
            const data = await response.json();

            if (data && data.allEmbroideryCostsR) {
                // Build cap tiers from API data
                this.capTiers = {};
                data.allEmbroideryCostsR.forEach(cost => {
                    if (cost.StitchCount === 8000) {
                        this.capTiers[cost.TierLabel] = {
                            embCost: cost.EmbroideryCost,
                            hasLTM: cost.TierLabel === '1-23'
                        };
                        // Store cap-specific additional stitch rate (from first Cap record)
                        // Caps use $1.00/1K (NOT Shirt's $1.25/1K)
                        if (cost.AdditionalStitchRate && !this._capRateLoaded) {
                            this.capAdditionalStitchRate = cost.AdditionalStitchRate;
                            this._capRateLoaded = true;
                            console.log(`[EmbroideryPricingCalculator] Cap additional stitch rate: $${this.capAdditionalStitchRate}/1K`);
                        }
                    }
                });

                // Get margin denominator from tiers
                if (data.tiersR && data.tiersR.length > 0) {
                    this.capMarginDenominator = data.tiersR[0].MarginDenominator || 0.57;
                }

                // Get rounding method
                if (data.rulesR && data.rulesR.RoundingMethod) {
                    this.capRoundingMethod = data.rulesR.RoundingMethod;
                }

                console.log('[EmbroideryPricingCalculator] Cap pricing loaded:');
                console.log('- Cap Tiers:', this.capTiers);
                console.log('- Cap Margin:', this.capMarginDenominator);
                console.log('- Cap Rounding:', this.capRoundingMethod);

                this.apiStatus.capPricing = true;
            }

            // Fetch cap AL pricing
            try {
                const alResponse = await fetch(`${this.baseURL}/api/pricing-bundle?method=CAP-AL`);
                const alData = await alResponse.json();

                if (alData && alData.allEmbroideryCostsR) {
                    this.capAlTiers = {};
                    alData.allEmbroideryCostsR.forEach(cost => {
                        // BUG FIX 2026-02-01: Accept both 'AL-CAP' and 'AL' ItemTypes
                        // API may return either depending on how CAP-AL endpoint is configured
                        if (cost.ItemType === 'AL-CAP' || cost.ItemType === 'AL') {
                            this.capAlTiers[cost.TierLabel] = {
                                embCost: cost.EmbroideryCost,
                                baseStitchCount: cost.BaseStitchCount || 5000,
                                additionalStitchRate: cost.AdditionalStitchRate || 1.00
                            };
                        }
                    });
                    console.log('[EmbroideryPricingCalculator] Cap AL pricing loaded:', this.capAlTiers);
                    this.apiStatus.capAlPricing = true;
                }
            } catch (alError) {
                console.error('[EmbroideryPricingCalculator] Failed to load cap AL pricing:', alError);
                this.apiStatus.criticalFailures.push('Cap AL pricing unavailable');
            }

            // Fetch 3D Puff upcharge from CAP-PUFF endpoint
            // Rule: ALWAYS pull pricing from Caspio API - never hardcode
            try {
                const puffResponse = await fetch(`${this.baseURL}/api/pricing-bundle?method=CAP-PUFF`);
                const puffData = await puffResponse.json();

                if (puffData && puffData.allEmbroideryCostsR) {
                    // Find the 3D-Puff record
                    const puffRecord = puffData.allEmbroideryCostsR.find(cost => cost.ItemType === '3D-Puff');
                    if (puffRecord && puffRecord.EmbroideryCost) {
                        this.puffUpchargePerCap = puffRecord.EmbroideryCost;
                        console.log(`[EmbroideryPricingCalculator] 3D Puff upcharge loaded from API: $${this.puffUpchargePerCap}`);
                    } else {
                        console.warn('[EmbroideryPricingCalculator] 3D-Puff record not found in API, using default');
                    }
                }
            } catch (puffError) {
                console.error('[EmbroideryPricingCalculator] Failed to load 3D Puff pricing:', puffError);
                // Keep the hardcoded default as fallback
            }

            // Fetch Patch upcharge from PATCH endpoint
            // Rule: ALWAYS pull pricing from Caspio API - never hardcode
            try {
                const patchResponse = await fetch(`${this.baseURL}/api/pricing-bundle?method=PATCH`);
                const patchData = await patchResponse.json();

                if (patchData && patchData.allPatchCostsR) {
                    // Find the Patch record (TierLabel='ALL' for flat pricing)
                    const patchRecord = patchData.allPatchCostsR.find(cost => cost.ItemType === 'Patch');
                    if (patchRecord && patchRecord.EmbroideryCost) {
                        this.patchUpchargePerCap = patchRecord.EmbroideryCost;
                        console.log(`[EmbroideryPricingCalculator] Patch upcharge loaded from API: $${this.patchUpchargePerCap}`);
                    } else {
                        console.warn('[EmbroideryPricingCalculator] Patch record not found in API, using default');
                    }
                }
            } catch (patchError) {
                console.error('[EmbroideryPricingCalculator] Failed to load Patch pricing:', patchError);
                // Keep the hardcoded default as fallback
            }

            this.capInitialized = true;
            console.log('[EmbroideryPricingCalculator] Cap pricing initialization complete');

        } catch (error) {
            console.error('[EmbroideryPricingCalculator] Failed to load cap pricing:', error);
            this.apiStatus.criticalFailures.push('Cap pricing unavailable');
            throw error; // Re-throw to prevent silent failure
        }
    }

    /**
     * Get embellishment upcharges for UI display
     * Call after cap pricing is initialized to get current API values
     * Used to dynamically update dropdown labels with prices from Caspio
     */
    getEmbellishmentUpcharges() {
        return {
            puff: this.puffUpchargePerCap,
            patch: this.patchUpchargePerCap
        };
    }

    /**
     * Round price using cap-specific rounding (HalfDollarUp)
     */
    roundCapPrice(price) {
        if (isNaN(price)) return null;

        // Caps use HalfDollarUp rounding
        if (this.capRoundingMethod === 'CeilDollar') {
            return Math.ceil(price);
        }

        // Default HalfDollarUp - round UP to nearest $0.50
        if (price % 0.5 === 0) return price;
        return Math.ceil(price * 2) / 2;
    }

    /**
     * Get cap embroidery cost for tier
     */
    getCapEmbroideryCost(tier) {
        return this.capTiers[tier]?.embCost || 9.00; // Cap default if not loaded
    }

    /**
     * Calculate price for a cap product
     * Supports multiple embellishment types:
     * - 'embroidery' (default): Standard flat embroidery
     * - '3d-puff': 3D puff embroidery (+$5/cap upcharge)
     * - 'laser-patch': Laser leatherette patch (+$5/cap upcharge, no stitches)
     *
     * @param {Object} product - Product data
     * @param {number} totalQuantity - Total cap quantity for tier determination
     * @param {number} capStitchCount - Stitch count (for embroidery types)
     * @param {string} embellishmentType - Type of cap embellishment
     */
    async calculateCapProductPrice(product, totalQuantity, capStitchCount = 8000, embellishmentType = 'embroidery') {
        // Ensure cap pricing is initialized
        if (!this.capInitialized) {
            await this.initializeCapConfig();
        }

        const tier = this.getTier(totalQuantity);
        const marginDenom = this.capMarginDenominator || 0.57;

        // Determine decoration cost based on embellishment type
        let decorationCost = 0;
        let capExtraStitchCost = 0;
        let puffUpcharge = 0;
        let patchUpcharge = 0;

        // All embellishment types use embroidery pricing as the base
        // Patches and 3D Puff add a flat upcharge on top
        const embCost = this.getCapEmbroideryCost(tier);
        decorationCost = embCost;

        // Calculate extra stitch cost for caps (embroidery and 3D puff only, not patches)
        // Base is 8000 stitches, charge extra per 1000 above that
        // CRITICAL: Caps use $1.00/1K (NOT Shirt's $1.25/1K)
        const capBaseStitches = 8000;

        // Extra stitch cost only applies to embroidery and 3D puff (patches have no stitches)
        if (embellishmentType !== 'laser-patch') {
            const extraCapStitches = Math.max(0, capStitchCount - capBaseStitches);
            capExtraStitchCost = (extraCapStitches / 1000) * (this.capAdditionalStitchRate || 1.00);
        }

        // Add embellishment-specific upcharges
        if (embellishmentType === '3d-puff') {
            puffUpcharge = this.puffUpchargePerCap;
            console.log(`[EmbroideryPricingCalculator] Cap 3D PUFF ${product.style}: tier=${tier}, embCost=$${embCost}, puffUpcharge=$${puffUpcharge}, stitches=${capStitchCount}, extraStitchCost=$${capExtraStitchCost.toFixed(2)}`);
        } else if (embellishmentType === 'laser-patch') {
            patchUpcharge = this.patchUpchargePerCap;
            console.log(`[EmbroideryPricingCalculator] Cap LASER-PATCH ${product.style}: tier=${tier}, embCost=$${embCost}, patchUpcharge=$${patchUpcharge}`);
        } else {
            console.log(`[EmbroideryPricingCalculator] Cap EMBROIDERY ${product.style}: tier=${tier}, embCost=$${embCost}, stitches=${capStitchCount}, extraStitchCost=$${capExtraStitchCost.toFixed(2)}`);
        }

        // Fetch size pricing for this cap style
        const sizePricingData = await this.fetchSizePricing(product.style);

        if (!sizePricingData || sizePricingData.length === 0) {
            console.error('[CRITICAL] No size pricing data for cap', product.style);
            return null;
        }

        // Use first color's data
        const priceData = sizePricingData.find(d => d.color === product.color) || sizePricingData[0];

        const lineItems = [];
        let lineSubtotal = 0;

        // Get base price (caps typically use OSFA or first available size)
        let standardBasePrice = 0;
        const osfaSizes = ['OSFA', 'S/M', 'M/L', 'L/XL', 'OS'];

        // Try OSFA sizes first
        for (const size of osfaSizes) {
            if (priceData.basePrices[size] && priceData.basePrices[size] > 0) {
                standardBasePrice = priceData.basePrices[size];
                break;
            }
        }

        // Fallback to first available price
        if (standardBasePrice === 0) {
            const availablePrices = Object.entries(priceData.basePrices)
                .filter(([_, price]) => price > 0)
                .sort((a, b) => a[1] - b[1]);

            if (availablePrices.length > 0) {
                standardBasePrice = availablePrices[0][1];
            }
        }

        // FIX 2026-02-02: For caps without standard sizes, try product's actual sizes
        if (standardBasePrice === 0 && product.sizeBreakdown) {
            console.warn(`[EmbroideryPricingCalculator] Trying cap's ordered sizes for ${product.style}`);

            for (const orderedSize of Object.keys(product.sizeBreakdown)) {
                const sizePrice = priceData.basePrices[orderedSize];
                if (sizePrice && sizePrice > 0) {
                    standardBasePrice = sizePrice;
                    console.log(`[EmbroideryPricingCalculator] Found cap price from ordered size ${orderedSize}: $${standardBasePrice}`);
                    break;
                }
            }
        }

        // FIX 2026-02-02: Last resort - use highest available price
        if (standardBasePrice === 0 && priceData.basePrices) {
            const allSizes = Object.entries(priceData.basePrices);
            if (allSizes.length > 0) {
                allSizes.sort((a, b) => a[1] - b[1]);
                standardBasePrice = allSizes[allSizes.length - 1][1];
                console.warn(`[EmbroideryPricingCalculator] Cap last resort: using price $${standardBasePrice}`);
            }
        }

        if (standardBasePrice === 0) {
            console.error(`[EmbroideryPricingCalculator] No base price found for cap ${product.style}`);
            return null;
        }

        console.log(`[EmbroideryPricingCalculator] Cap ${product.style} base price: $${standardBasePrice}`);

        // Calculate decorated price for each size in the order
        for (const [size, qty] of Object.entries(product.sizeBreakdown)) {
            if (qty <= 0) continue;

            // Get size-specific base price and upcharge
            const sizeBasePrice = priceData.basePrices[size] || standardBasePrice;
            const upcharge = priceData.sizeUpcharges[size] || 0;

            // Calculate decorated price using bottom-up logic (same as garments)
            // Step 1: Calculate and ROUND the base price (garment + decoration cost)
            const garmentCost = sizeBasePrice / marginDenom;
            // For embroidery: decorationCost = embCost, no upcharge
            // For 3D puff: decorationCost = embCost + puffUpcharge (flat $5 add-on)
            // For patch: decorationCost = embCost + patchUpcharge (flat $5 add-on, no stitches)
            const baseDecoratedPrice = garmentCost + decorationCost + puffUpcharge + patchUpcharge;
            const roundedBase = this.roundCapPrice(baseDecoratedPrice);  // Round the base FIRST
            // Step 2: Extra stitch fees shown as separate AS-CAP line item (NOT added to unit price)
            const finalPrice = roundedBase + upcharge;

            console.log(`[CAP PRICING DEBUG] ${product.style} ${size} (${embellishmentType}):
                Base: $${sizeBasePrice}
                Margin: ${marginDenom}
                Garment: $${garmentCost.toFixed(2)}
                Decoration: $${decorationCost}
                Puff Upcharge: $${puffUpcharge}
                Patch Upcharge: $${patchUpcharge}
                Base Decorated: $${baseDecoratedPrice.toFixed(2)}
                Rounded Base: $${roundedBase}
                ExtraStitch: $${capExtraStitchCost.toFixed(2)} (shown as separate AS-CAP line)
                Upcharge: $${upcharge}
                Final: $${finalPrice}`);

            lineItems.push({
                description: `${size}(${qty})`,
                quantity: qty,
                unitPrice: finalPrice,
                basePrice: roundedBase,  // Store rounded base for display
                extraStitchCost: capExtraStitchCost,
                puffUpcharge: puffUpcharge,  // Track 3D puff upcharge for display
                patchUpcharge: patchUpcharge,  // Track patch upcharge for display
                embellishmentType: embellishmentType,  // Track embellishment type
                alCost: 0,
                total: roundedBase * qty,  // Use base price for line total (extra stitches shown separately)
                isCap: true
            });

            lineSubtotal += roundedBase * qty;  // CHANGED: Use base price for subtotal (extra stitches shown separately)
        }

        return {
            product: product,
            tier: tier,
            lineItems: lineItems,
            subtotal: lineSubtotal,
            isCap: true,
            embellishmentType: embellishmentType,  // Track for display/invoice
            puffUpcharge: puffUpcharge,  // 3D puff per-cap upcharge (if applicable)
            patchUpcharge: patchUpcharge,  // Patch per-cap upcharge (if applicable)
            // Patch-specific data
            isPatch: embellishmentType === 'laser-patch',
            patchSetupFee: embellishmentType === 'laser-patch' ? this.patchSetupFee : 0
        };
    }

    /**
     * Round price based on API rules
     */
    roundPrice(price) {
        if (isNaN(price)) return null;
        
        // Use API-specified rounding method
        if (this.roundingMethod === 'CeilDollar') {
            // Round up to nearest dollar
            return Math.ceil(price);
        }
        
        // Fallback to half-dollar rounding if different method specified
        if (price % 0.5 === 0) return price;
        return Math.ceil(price * 2) / 2;
    }
    
    /**
     * Detect item type based on style number
     */
    detectItemType(styleNumber) {
        const style = styleNumber.toUpperCase();

        // Jacket patterns
        if (style.startsWith('TLJ') || // Tall jacket
            style.startsWith('J') ||    // Jacket
            style.includes('JACKET') ||
            style.includes('JKT')) {
            return 'Jacket';
        }

        // Hoodie patterns
        if (style.includes('HOOD') ||
            style.startsWith('PC90H') ||
            style.startsWith('F') && style.includes('H')) {
            return 'Hoodie';
        }

        // Cap patterns - specific prefixes to avoid false positives on CAR, CAT, etc.
        if (style.includes('CAP') ||
            style.includes('HAT') ||
            /^C[P0-9]/.test(style) ||  // CP80, CP90, C112, C888, etc.
            style.startsWith('NE')) {   // New Era caps
            return 'Cap';
        }

        // Default to shirt
        return 'Shirt';
    }

    /**
     * Get tier based on total quantity
     */
    getTier(totalQuantity) {
        if (totalQuantity < 24) return '1-23';
        if (totalQuantity < 48) return '24-47';
        if (totalQuantity < 72) return '48-71';
        return '72+';
    }
    
    /**
     * Get embroidery cost for tier
     */
    getEmbroideryCost(tier) {
        return this.tiers[tier]?.embCost || 12.00;
    }
    
    /**
     * Fetch size pricing for a style
     */
    async fetchSizePricing(styleNumber) {
        // Check cache first
        if (this.sizePricingCache[styleNumber]) {
            return this.sizePricingCache[styleNumber];
        }
        
        try {
            const response = await fetch(`${this.baseURL}/api/size-pricing?styleNumber=${styleNumber}`);
            const data = await response.json();
            
            if (data && data.length > 0) {
                // Store in cache (data is array, we'll use first entry as default)
                this.sizePricingCache[styleNumber] = data;
                return data;
            }
        } catch (error) {
            console.error('Error fetching size pricing:', error);
        }
        
        return null;
    }
    
    /**
     * Calculate price for a product line
     */
    async calculateProductPrice(product, totalQuantity, additionalStitchCost) {
        const tier = this.getTier(totalQuantity);

        // Detect item type and log for debugging
        const itemType = this.detectItemType(product.style);
        console.log(`[EmbroideryPricingCalculator] Product ${product.style} detected as: ${itemType}`);

        // Get embroidery cost (currently API only returns Shirt costs)
        // TODO: When API supports different item types, use itemType to get correct cost
        const embCost = this.getEmbroideryCost(tier);
        console.log(`[EmbroideryPricingCalculator] Using embroidery cost: $${embCost} for tier ${tier}`);
        
        // Fetch size pricing for this style
        const sizePricingData = await this.fetchSizePricing(product.style);
        
        if (!sizePricingData || sizePricingData.length === 0) {
            console.error('[CRITICAL] No size pricing data for', product.style);
            console.error('[CRITICAL] API call failed - system will likely use hardcoded fallback values!');
            console.error('[CRITICAL] Check if /api/size-pricing endpoint is working');

            // Show error to user - per audit 2026-01-15
            if (!document.getElementById('pricing-api-warning')) {
                this.showAPIWarning(
                    `Unable to load size pricing for style ${product.style}. ` +
                    'Product pricing may be inaccurate. Please try refreshing the page or contact IT support.',
                    'size-pricing'
                );
            }
            return null;
        }
        
        // Use first color's data (or find specific color if needed)
        const priceData = sizePricingData.find(d => d.color === product.color) || sizePricingData[0];
        
        const lineItems = [];
        let lineSubtotal = 0;
        
        // Find the standard size base price (use S/M/L/XL prices)
        // For products without standard sizes, use the first available size as base
        const standardSizes = ['S', 'M', 'L', 'XL'];
        let standardBasePrice = 0;
        let baseSize = null;

        // First try standard sizes
        for (const size of standardSizes) {
            if (priceData.basePrices[size]) {
                standardBasePrice = priceData.basePrices[size];
                baseSize = size;
                break;
            }
        }

        // If no standard sizes found, use the first available size with valid price
        if (standardBasePrice === 0) {
            console.warn(`[EmbroideryPricingCalculator] No standard sizes found for ${product.style}, using alternative base`);

            // Find sizes with valid prices (filter out $0 discontinued sizes)
            const availableSizes = Object.entries(priceData.basePrices)
                .filter(([size, price]) => price > 0);  // Exclude $0 discontinued sizes

            if (availableSizes.length > 0) {
                // Sort by price to get the lowest valid base price
                availableSizes.sort((a, b) => a[1] - b[1]);
                baseSize = availableSizes[0][0];
                standardBasePrice = availableSizes[0][1];
                console.log(`[EmbroideryPricingCalculator] Using ${baseSize} as base size with price $${standardBasePrice}`);
            }
        }

        // FIX 2026-02-02: For tall-only products, try to find price from product's actual sizes
        // This handles cases where API returns pricing keyed by the ordered size (e.g., '2XLT')
        if (standardBasePrice === 0 && product.sizeBreakdown) {
            console.warn(`[EmbroideryPricingCalculator] Trying product's ordered sizes for ${product.style}`);

            for (const orderedSize of Object.keys(product.sizeBreakdown)) {
                const sizePrice = priceData.basePrices[orderedSize];
                if (sizePrice && sizePrice > 0) {
                    baseSize = orderedSize;
                    standardBasePrice = sizePrice;
                    console.log(`[EmbroideryPricingCalculator] Found price from ordered size ${orderedSize}: $${standardBasePrice}`);
                    break;
                }
            }
        }

        // FIX 2026-02-02: Last resort - use highest available price if all else fails
        // Better to use this than to drop the product entirely
        if (standardBasePrice === 0 && priceData.basePrices) {
            const allSizes = Object.entries(priceData.basePrices);
            if (allSizes.length > 0) {
                // Sort by price ascending
                allSizes.sort((a, b) => a[1] - b[1]);
                // Use the highest-priced size as base (more accurate for tall products)
                baseSize = allSizes[allSizes.length - 1][0];
                standardBasePrice = allSizes[allSizes.length - 1][1];
                console.warn(`[EmbroideryPricingCalculator] Last resort: using ${baseSize} with price $${standardBasePrice}`);
            }
        }

        // Critical error if still no base price
        if (standardBasePrice === 0) {
            console.error(`[EmbroideryPricingCalculator] CRITICAL: No base price found for ${product.style}`);
            return null;
        }
        
        // Group sizes by upcharge amount from API
        const standardSizeGroup = [];
        const upchargeSizeGroups = {};

        // For tall-only or non-standard products, calculate relative upcharges
        const baseSizeUpcharge = baseSize ? (priceData.sizeUpcharges[baseSize] || 0) : 0;

        for (const [size, qty] of Object.entries(product.sizeBreakdown)) {
            const apiUpcharge = priceData.sizeUpcharges[size] || 0;

            // Calculate relative upcharge from the base size
            const relativeUpcharge = apiUpcharge - baseSizeUpcharge;

            if (relativeUpcharge === 0) {
                // This is a base/standard size (no upcharge relative to base)
                standardSizeGroup.push({ size, qty, basePrice: standardBasePrice });
            } else {
                // This has an upcharge relative to the base
                if (!upchargeSizeGroups[relativeUpcharge]) {
                    upchargeSizeGroups[relativeUpcharge] = [];
                }
                upchargeSizeGroups[relativeUpcharge].push({ size, qty, basePrice: standardBasePrice, upcharge: relativeUpcharge });
            }
        }
        
        // Calculate standard sizes (S-XL typically)
        if (standardSizeGroup.length > 0) {
            let standardQty = 0;
            const sizeList = [];
            
            standardSizeGroup.forEach(item => {
                standardQty += item.qty;
                sizeList.push(`${item.size}(${item.qty})`);
            });
            
            // Calculate decorated price using bottom-up logic
            // Step 1: Calculate and ROUND the base price (garment cost + embroidery for 8k stitches)
            const garmentCost = standardBasePrice / this.marginDenominator;
            const baseDecoratedPrice = garmentCost + embCost;  // TRUE base with 8k stitches
            const roundedBase = this.roundPrice(baseDecoratedPrice);  // Round the base FIRST
            // Step 2: Add extra stitch fees on top (no more rounding)
            const finalPrice = roundedBase + additionalStitchCost;

            // Debug logging for pricing calculation
            console.log(`[PRICING DEBUG] ${product.style} Standard Sizes:
                Base Price: $${standardBasePrice}
                Margin Denominator: ${this.marginDenominator}
                Garment Cost: $${garmentCost.toFixed(2)}
                Embroidery Cost: $${embCost}
                Base Decorated: $${baseDecoratedPrice.toFixed(2)}
                Rounded Base: $${roundedBase}
                Additional Stitch: $${additionalStitchCost}
                Final Price: $${finalPrice}`);
            
            lineItems.push({
                description: sizeList.join(' '),
                quantity: standardQty,
                unitPrice: finalPrice,
                basePrice: roundedBase,  // Store the rounded base for display
                extraStitchCost: additionalStitchCost,  // Store extra stitch cost
                alCost: 0,  // Will be added later if AL exists
                total: roundedBase * standardQty  // CHANGED: Use base price for line total (extra stitches shown separately)
            });

            lineSubtotal += roundedBase * standardQty;  // CHANGED: Use base price for subtotal (extra stitches shown separately)
        }

        // Calculate upcharge sizes (2XL+) using API upcharge values
        for (const [apiUpcharge, items] of Object.entries(upchargeSizeGroups)) {
            let upchargeQty = 0;
            const sizeList = [];
            
            items.forEach(item => {
                upchargeQty += item.qty;
                sizeList.push(`${item.size}(${item.qty})`);
            });
            
            // Calculate decorated price using bottom-up logic with upcharge
            // Step 1: Calculate standard base price FIRST (same as S-XL)
            const garmentCost = standardBasePrice / this.marginDenominator;
            const baseDecoratedPrice = garmentCost + embCost;  // TRUE base with 8k stitches
            const standardRoundedBase = this.roundPrice(baseDecoratedPrice);  // Round the base FIRST

            // Step 2: Add the upcharge to the rounded base
            const upchargeAmount = parseFloat(apiUpcharge); // Use API upcharge value directly
            const roundedBase = standardRoundedBase + upchargeAmount;  // Add upcharge AFTER rounding

            // Step 3: Add extra stitch fees on top (no more rounding)
            const finalPrice = roundedBase + additionalStitchCost;

            // Debug logging for upcharge pricing calculation
            console.log(`[PRICING DEBUG] ${product.style} Upcharge Sizes (${sizeList.join(', ')}):
                Base Price: $${standardBasePrice}
                Margin Denominator: ${this.marginDenominator}
                Garment Cost: $${garmentCost.toFixed(2)}
                Embroidery Cost: $${embCost}
                Base Decorated: $${baseDecoratedPrice.toFixed(2)}
                Standard Rounded: $${standardRoundedBase}
                Upcharge Amount: $${upchargeAmount}
                Rounded Base w/Upcharge: $${roundedBase}
                Additional Stitch: $${additionalStitchCost}
                Final Price: $${finalPrice}`);
            
            lineItems.push({
                description: sizeList.join(' '),
                quantity: upchargeQty,
                unitPrice: finalPrice,
                basePrice: roundedBase,  // Store the rounded base for display
                extraStitchCost: additionalStitchCost,  // Store extra stitch cost
                alCost: 0,  // Will be added later if AL exists
                upcharge: upchargeAmount,  // Store the upcharge amount
                total: roundedBase * upchargeQty,  // CHANGED: Use base price for line total (extra stitches shown separately)
                hasUpcharge: true
            });

            lineSubtotal += roundedBase * upchargeQty;  // CHANGED: Use base price for subtotal (extra stitches shown separately)
        }

        return {
            product: product,
            tier: tier,
            lineItems: lineItems,
            subtotal: lineSubtotal
        };
    }

    /**
     * Generate line items in ShopWorks PUSH API format
     * One line item per size per color (proven pattern from 3-Day Tees)
     *
     * @param {Object} product - Product with sizeBreakdown, style, color, catalogColor
     * @param {Object} pricingData - Pricing data with basePrices, sizeUpcharges
     * @param {Object} logo - Logo with position, stitchCount
     * @param {string} tier - Pricing tier
     * @param {number} additionalStitchCost - Extra stitch fee to add to price
     * @returns {Array} Array of line items in ShopWorks format
     */
    async generateLineItems(product, pricingData, logo, tier, additionalStitchCost = 0) {
        const lineItems = [];
        const skuService = window.skuValidationService || (window.SKUValidationService ? new window.SKUValidationService() : null);
        const embCost = this.getEmbroideryCost(tier);

        // Get standard base price for calculating upcharges
        const standardSizes = ['S', 'M', 'L', 'XL'];
        let standardBasePrice = 0;
        let baseSize = null;

        for (const size of standardSizes) {
            if (pricingData.basePrices[size]) {
                standardBasePrice = pricingData.basePrices[size];
                baseSize = size;
                break;
            }
        }

        // Fallback if no standard sizes
        if (standardBasePrice === 0) {
            const availableSizes = Object.entries(pricingData.basePrices);
            if (availableSizes.length > 0) {
                availableSizes.sort((a, b) => a[1] - b[1]);
                baseSize = availableSizes[0][0];
                standardBasePrice = availableSizes[0][1];
            }
        }

        const baseSizeUpcharge = baseSize ? (pricingData.sizeUpcharges[baseSize] || 0) : 0;

        // Generate one line item per size
        for (const [size, quantity] of Object.entries(product.sizeBreakdown)) {
            if (quantity <= 0) continue;

            // Calculate pricing for this size
            const apiUpcharge = pricingData.sizeUpcharges[size] || 0;
            const relativeUpcharge = apiUpcharge - baseSizeUpcharge;

            // Calculate decorated price
            const garmentCost = standardBasePrice / this.marginDenominator;
            const baseDecoratedPrice = garmentCost + embCost;
            const roundedBase = this.roundPrice(baseDecoratedPrice);
            const finalPrice = roundedBase + relativeUpcharge + additionalStitchCost;

            // Build description: Brand Style Color | LogoPosition StitchK
            const description = this.buildLineItemDescription(product, logo);

            // Generate SKU using validation service
            const inventorySku = skuService
                ? skuService.sanmarToShopWorksSKU(product.style, size)
                : product.style + (this.getSizeSuffix(size) || '');

            lineItems.push({
                // ShopWorks PUSH API format (proven pattern)
                partNumber: product.style,              // BASE only - ShopWorks handles suffix via size field
                inventorySku: inventorySku,             // Full SKU for internal tracking
                description: description,
                color: product.catalogColor,            // CATALOG_COLOR for API
                displayColor: product.color,            // COLOR_NAME for display
                size: size,
                quantity: quantity,
                unitPrice: finalPrice,
                total: finalPrice * quantity,

                // Embroidery-specific metadata
                logoPosition: logo?.position || 'LC',
                stitchCount: logo?.stitchCount || 8000,
                hasUpcharge: relativeUpcharge > 0,
                upchargeAmount: relativeUpcharge,
                basePrice: roundedBase,
                extraStitchCost: additionalStitchCost
            });
        }

        return lineItems;
    }

    /**
     * Build description string for line item
     * Format: "Brand Style Color | Position StitchK"
     *
     * @param {Object} product - Product data
     * @param {Object} logo - Logo data
     * @returns {string} Formatted description
     */
    buildLineItemDescription(product, logo) {
        // Extract brand from title (first word or known brand)
        const brand = this.extractBrand(product.title || '');
        const logoAbbrev = this.abbreviatePosition(logo?.position || 'LC');
        const stitchK = Math.round((logo?.stitchCount || 8000) / 1000);

        return `${brand} ${product.style} ${product.color} | ${logoAbbrev} ${stitchK}K`;
    }

    /**
     * Extract brand name from product title
     *
     * @param {string} title - Full product title
     * @returns {string} Brand abbreviation
     */
    extractBrand(title) {
        const brandMap = {
            'Port & Company': 'P&C',
            'Port Authority': 'PA',
            'Sport-Tek': 'ST',
            'District': 'DT',
            'New Era': 'NE',
            'Nike': 'Nike',
            'OGIO': 'OGIO',
            'Carhartt': 'CTT',
            'CornerStone': 'CS',
            'Red Kap': 'RK'
        };

        for (const [full, abbrev] of Object.entries(brandMap)) {
            if (title.includes(full)) return abbrev;
        }

        // Return first word as fallback
        return title.split(' ')[0] || 'SanMar';
    }

    /**
     * Abbreviate logo position
     *
     * @param {string} position - Full position name
     * @returns {string} Abbreviated position
     */
    abbreviatePosition(position) {
        const positionMap = {
            'Left Chest': 'LC',
            'Right Chest': 'RC',
            'Full Front': 'FF',
            'Full Back': 'FB',
            'Left Sleeve': 'LS',
            'Right Sleeve': 'RS',
            'Left Cuff': 'LCF',
            'Right Cuff': 'RCF',
            'Front Center': 'FC',
            'Back Yoke': 'BY',
            'Cap Front': 'CF',
            'Cap Back': 'CB',
            'Cap Side': 'CSD'
        };

        return positionMap[position] || position.substring(0, 2).toUpperCase();
    }

    /**
     * Get size suffix for SKU (fallback if no SKU service)
     * @private
     */
    getSizeSuffix(size) {
        const suffixMap = {
            'S': '', 'M': '', 'L': '', 'XL': '',
            'XS': '_XS',
            '2XL': '_2X', '3XL': '_3X', '4XL': '_4X',
            '5XL': '_5X', '6XL': '_6X',
            'LT': '_LT', 'XLT': '_XLT',
            '2XLT': '_2XLT', '3XLT': '_3XLT',
            'OSFA': '_OSFA',
            'S/M': '_S/M', 'M/L': '_M/L', 'L/XL': '_L/XL'
        };
        return suffixMap[size] || `_${size}`;
    }

    /**
     * Calculate complete quote pricing
     * Supports mixed quotes with caps (CAP pricing) and garments (EMB pricing)
     * @param {Array} products - Products to price
     * @param {Array} logos - Legacy: all logos (garment logos for backward compat)
     * @param {Object} logoConfigs - NEW: Separate configs { garment: {primary, additional}, cap: {primary, additional} }
     */
    async calculateQuote(products, logos, logoConfigs = null) {
        if (!products || products.length === 0) {
            return null;
        }

        // Ensure configuration is loaded
        if (!this.initialized) {
            await this.initializeConfig();
        }

        // Prevent calculation if API has critical errors
        if (this.apiError) {
            console.error('[EmbroideryPricingCalculator] CRITICAL: Cannot calculate prices - API configuration unavailable');

            // Return error result instead of incorrect prices
            return {
                success: false,
                error: 'Pricing configuration unavailable',
                message: 'Cannot calculate prices due to API connection failure. Please refresh the page or contact support.',
                products: [],
                logos: [],
                additionalServices: [],
                setupFees: [],
                subtotal: 0,
                grandTotal: 0,
                tier: 'ERROR',
                totalQuantity: 0,
                hasLTM: false,
                ltmFeeTotal: 0,
                setupFeesTotal: 0
            };
        }

        // =========================================
        // DUAL PRICING: Separate caps from garments
        // =========================================
        const capProducts = products.filter(p => p.isCap === true);
        const garmentProducts = products.filter(p => p.isCap !== true);

        console.log(`[EmbroideryPricingCalculator] Mixed quote: ${capProducts.length} caps, ${garmentProducts.length} garments`);

        // Initialize cap pricing if any caps in the quote
        if (capProducts.length > 0 && !this.capInitialized) {
            await this.initializeCapConfig();
        }

        const totalQuantity = products.reduce((sum, p) => sum + p.totalQuantity, 0);
        const capQuantity = capProducts.reduce((sum, p) => sum + p.totalQuantity, 0);
        const garmentQuantity = garmentProducts.reduce((sum, p) => sum + p.totalQuantity, 0);

        // CRITICAL: Separate tiers for caps and garments
        // Caps and garments CANNOT be combined for quantity discounts
        const garmentTier = garmentQuantity > 0 ? this.getTier(garmentQuantity) : '1-23';
        const capTier = capQuantity > 0 ? this.getTier(capQuantity) : '1-23';
        const tierEmbCost = this.getEmbroideryCost(garmentTier);

        console.log(`[EmbroideryPricingCalculator] Separate tiers: garments=${garmentTier} (${garmentQuantity} pcs), caps=${capTier} (${capQuantity} pcs)`);

        // =========================================
        // USE SEPARATE LOGO CONFIGS IF PROVIDED
        // =========================================
        let garmentLogos, garmentPrimaryLogos, garmentAdditionalLogos;
        let capLogos, capPrimaryLogo, capAdditionalLogos;

        if (logoConfigs) {
            // New: Use separate configs for garments vs caps
            garmentPrimaryLogos = [logoConfigs.garment.primary].filter(Boolean);
            garmentAdditionalLogos = logoConfigs.garment.additional || [];
            garmentLogos = [...garmentPrimaryLogos, ...garmentAdditionalLogos];

            capPrimaryLogo = logoConfigs.cap.primary;
            capAdditionalLogos = logoConfigs.cap.additional || [];
            capLogos = [capPrimaryLogo, ...capAdditionalLogos].filter(Boolean);

            console.log(`[EmbroideryPricingCalculator] Using separate logo configs: ${garmentLogos.length} garment logos, ${capLogos.length} cap logos`);
        } else {
            // Legacy: All logos are garment logos
            garmentPrimaryLogos = logos.filter(l => l.isPrimary);
            garmentAdditionalLogos = logos.filter(l => !l.isPrimary);
            garmentLogos = logos;
            capPrimaryLogo = null;
            capAdditionalLogos = [];
            capLogos = [];
        }

        // For backward compat
        const primaryLogos = garmentPrimaryLogos;
        const additionalLogos = garmentAdditionalLogos;

        // Calculate additional stitch cost for PRIMARY logos only (GARMENTS ONLY)
        // Caps have fixed 8K stitches - no extra stitch charge
        // Full Back: ALL stitches charged at $1.25/1K (min 25K = $31.25)
        // Other positions: excess over 8K base charged at $1.25/1K
        let primaryAdditionalStitchCost = 0;
        let primaryFullBackStitchCost = 0; // Separate tracking for Full Back (ALL stitches)
        if (garmentProducts.length > 0) {
            garmentPrimaryLogos.forEach(logo => {
                if (logo.position === 'Full Back') {
                    // Full Back: charge for ALL stitches (min 25K)
                    const fbStitchCount = Math.max(logo.stitchCount, this.fbBaseStitchCount);
                    primaryFullBackStitchCost += (fbStitchCount / 1000) * this.additionalStitchRate;
                } else {
                    // Other positions: charge for excess over 8K base
                    const extraStitches = Math.max(0, logo.stitchCount - this.baseStitchCount);
                    primaryAdditionalStitchCost += (extraStitches / 1000) * this.additionalStitchRate;
                }
            });
        }

        // Calculate each product's pricing
        const productPricing = [];
        let subtotal = 0;
        let garmentSubtotal = 0;
        let capSubtotal = 0;

        // Calculate GARMENT products with standard EMB pricing
        // Uses garmentQuantity for tier determination (NOT combined total)
        // NOTE: Pass 0 for additionalStitchCost - extra stitches shown as separate AS-GARM line item
        for (const product of garmentProducts) {
            const pricing = await this.calculateProductPrice(product, garmentQuantity, 0);
            if (pricing) {
                pricing.isCap = false;
                productPricing.push(pricing);
                subtotal += pricing.subtotal;
                garmentSubtotal += pricing.subtotal;
            }
        }

        // Calculate CAP products with CAP pricing
        // Uses capQuantity for tier determination (NOT combined total)
        // Get cap stitch count and embellishment type from logo config
        const capStitchCount = capPrimaryLogo?.stitchCount || 8000;
        const capEmbellishmentType = capPrimaryLogo?.embellishmentType || 'embroidery';
        console.log(`[EmbroideryPricingCalculator] Cap config: stitches=${capStitchCount}, embellishmentType=${capEmbellishmentType}`);

        for (const product of capProducts) {
            const pricing = await this.calculateCapProductPrice(product, capQuantity, capStitchCount, capEmbellishmentType);
            if (pricing) {
                productPricing.push(pricing);
                subtotal += pricing.subtotal;
                capSubtotal += pricing.subtotal;
            }
        }
        
        // Apply LTM separately for caps and garments
        // Each product type has its own LTM if qty < 24
        let ltmTotal = 0;
        let garmentLtm = 0;
        let capLtm = 0;

        // Garment LTM: apply if garments exist and qty < 24
        if (garmentQuantity > 0 && garmentQuantity < 24) {
            garmentLtm = this.ltmFee;
            const garmentLtmPerUnit = garmentLtm / garmentQuantity;
            productPricing.filter(pp => !pp.isCap).forEach(pp => {
                pp.lineItems.forEach(item => {
                    item.ltmPerUnit = garmentLtmPerUnit;
                    item.unitPriceWithLTM = item.unitPrice + garmentLtmPerUnit;
                });
            });
        }

        // Cap LTM: apply if caps exist and qty < 24
        if (capQuantity > 0 && capQuantity < 24) {
            capLtm = this.ltmFee;
            const capLtmPerUnit = capLtm / capQuantity;
            productPricing.filter(pp => pp.isCap).forEach(pp => {
                pp.lineItems.forEach(item => {
                    item.ltmPerUnit = capLtmPerUnit;
                    item.unitPriceWithLTM = item.unitPrice + capLtmPerUnit;
                });
            });
        }

        ltmTotal = garmentLtm + capLtm;
        const ltmPerUnit = totalQuantity > 0 ? ltmTotal / totalQuantity : 0;

        console.log(`[EmbroideryPricingCalculator] LTM: garments=$${garmentLtm} (${garmentQuantity}<24), caps=$${capLtm} (${capQuantity}<24), total=$${ltmTotal}`);
        
        // Calculate additional logos pricing
        const additionalServices = [];
        let additionalServicesTotal = 0;
        
        // Process additional logos for each product
        // Supports both:
        // 1. Global AL (legacy): assignment has logoId referencing additionalLogos array
        // 2. Per-product AL (new): assignment has position/stitchCount embedded
        for (const product of products) {
            if (product.logoAssignments?.additional) {
                for (const assignment of product.logoAssignments.additional) {
                    // Per-product AL: data is embedded in assignment
                    // Global AL: data comes from additionalLogos array
                    let logo = null;
                    let isCap = product.isCap === true;

                    if (assignment.position && assignment.stitchCount) {
                        // Per-product AL - data is embedded
                        logo = {
                            id: assignment.id,
                            position: assignment.position,
                            stitchCount: assignment.stitchCount
                        };
                    } else if (assignment.logoId) {
                        // Global AL - find from additionalLogos array
                        logo = additionalLogos.find(l => l.id === assignment.logoId);
                    }

                    if (logo) {
                        const quantity = assignment.quantity || 0;
                        if (quantity > 0) {
                            const isFullBack = logo.position === 'Full Back';

                            // FULL BACK: Special pricing - $1.25 per 1,000 stitches (all stitches, min 25K)
                            // No tier cost, no base included - pure stitch-based pricing
                            if (isFullBack) {
                                const fbStitchRate = this.additionalStitchRate; // $1.25/1K
                                const fbStitchCount = Math.max(logo.stitchCount, this.fbBaseStitchCount); // Min 25K
                                const unitPrice = (fbStitchCount / 1000) * fbStitchRate;
                                const total = unitPrice * quantity;

                                console.log(`🔍 [DEBUG] Full Back Calculation:`);
                                console.log(`   - Stitch Count: ${fbStitchCount} (min 25K)`);
                                console.log(`   - Rate: $${fbStitchRate}/1K`);
                                console.log(`   - Unit Price: $${unitPrice.toFixed(2)}`);

                                const partNumber = `FB-${fbStitchCount}`;

                                additionalServices.push({
                                    type: 'additional_logo',
                                    description: `FB Full Back (${fbStitchCount/1000}K stitches)`,
                                    partNumber: partNumber,
                                    quantity: quantity,
                                    unitPrice: unitPrice,
                                    total: total,
                                    productStyle: product.style,
                                    logoPosition: logo.position,
                                    stitchCount: fbStitchCount,
                                    logoId: logo.id
                                });
                                continue; // Skip normal AL processing
                            }

                            // STANDARD AL: Calculate additional logo price (NO margin division)
                            // Use different base stitch count and rate for caps vs garments
                            const baseStitches = isCap ? 5000 : this.baseStitchCount;
                            const stitchRate = isCap ? this.capAdditionalStitchRate : this.additionalStitchRate;
                            const extraStitches = Math.max(0, logo.stitchCount - baseStitches);
                            const stitchCost = (extraStitches / 1000) * stitchRate;

                            // Use AL tier cost from API - ERROR if not available
                            // Use appropriate tier for caps vs garments
                            const alTier = isCap ? capTier : garmentTier;
                            const alTierData = isCap ? this.capAlTiers : this.alTiers;

                            if (!alTierData[alTier] || !alTierData[alTier].embCost) {
                                console.error('[EmbroideryPricingCalculator] AL pricing not available for tier:', alTier, 'isCap:', isCap);
                                // Show error to user if not already shown
                                if (!document.getElementById('pricing-api-warning')) {
                                    this.showAPIWarning(
                                        `Cannot calculate Additional Logo pricing. ${isCap ? 'Cap' : 'Garment'} AL pricing data is unavailable. ` +
                                        'Please contact IT support immediately.',
                                        'al-pricing'
                                    );
                                }
                                // Return zero price to prevent incorrect quotes
                                const unitPrice = 0;
                                const total = 0;

                                additionalServices.push({
                                    type: 'additional_logo',
                                    description: `⚠️ ERROR: ${logo.position} - PRICING UNAVAILABLE`,
                                    partNumber: 'ERROR',
                                    quantity: quantity,
                                    unitPrice: unitPrice,
                                    total: total,
                                    productStyle: product.style,
                                    logoId: logo.id,
                                    error: true
                                });
                                continue; // Skip to next logo
                            }

                            const alTierCost = alTierData[alTier].embCost;

                            // Debug logging for AL calculation
                            console.log(`🔍 [DEBUG] AL Calculation for ${logo.position} (${isCap ? 'Cap' : 'Garment'}):`);
                            console.log(`   - Tier: ${alTier}`);
                            console.log(`   - AL Tier Cost: $${alTierCost}`);
                            console.log(`   - Stitch Count: ${logo.stitchCount}`);
                            console.log(`   - Extra Stitches: ${extraStitches}`);
                            console.log(`   - Stitch Cost: $${stitchCost}`);
                            console.log(`   - Raw Total: $${alTierCost + stitchCost}`);

                            // Direct tier cost + stitch cost (NO subset upcharge - simplified pricing)
                            // AL pricing uses raw price - no rounding applied
                            const unitPrice = alTierCost + stitchCost;
                            console.log(`   - Final Unit Price: $${unitPrice} (AL pricing - no rounding)`);
                            const total = unitPrice * quantity;

                            // Generate part number
                            const partNumber = logo.stitchCount === 8000 ? 'AL' : `AL-${logo.stitchCount}`;
                            
                            additionalServices.push({
                                type: 'additional_logo',
                                description: `${partNumber} ${logo.position}`,
                                partNumber: partNumber,
                                quantity: quantity,
                                unitPrice: unitPrice,
                                total: total,
                                productStyle: product.style,
                                logoPosition: logo.position,
                                stitchCount: logo.stitchCount,
                                // For per-product AL UI updates
                                rowId: product.rowId,
                                alId: logo.id,
                                isCap: isCap
                            });
                            
                            additionalServicesTotal += total;
                        }
                    }
                }
            }
            
        }
        
        // Calculate setup fees separately for garments and caps
        let garmentDigitizingCount = 0;
        let capDigitizingCount = 0;
        if (logoConfigs) {
            // Count garment logos needing digitizing
            if (logoConfigs.garment.primary?.needsDigitizing) garmentDigitizingCount++;
            garmentDigitizingCount += (logoConfigs.garment.additional || []).filter(l => l.needsDigitizing).length;
            // Count cap logos needing digitizing (only for embroidery types, not patches)
            if (capEmbellishmentType !== 'laser-patch') {
                if (logoConfigs.cap.primary?.needsDigitizing) capDigitizingCount++;
                capDigitizingCount += (logoConfigs.cap.additional || []).filter(l => l.needsDigitizing).length;
            }
        } else {
            // Legacy: just count from logos array (all treated as garment)
            garmentDigitizingCount = logos.filter(l => l.needsDigitizing).length;
        }
        const garmentSetupFees = garmentDigitizingCount * this.digitizingFee;

        // Cap setup fees: use patch setup fee ($50 GRT-50) or digitizing fee ($100) based on embellishment type
        let capSetupFees = 0;
        let capPatchSetupFee = 0;
        if (capEmbellishmentType === 'laser-patch') {
            // Patches use $50 design setup fee (GRT-50) instead of $100 digitizing
            const needsPatchSetup = logoConfigs?.cap?.primary?.needsSetup !== false; // Default true
            capPatchSetupFee = needsPatchSetup ? this.patchSetupFee : 0;
            capSetupFees = capPatchSetupFee;
        } else {
            // Embroidery types use $100 digitizing fee
            capSetupFees = capDigitizingCount * this.digitizingFee;
        }

        const setupFees = garmentSetupFees + capSetupFees;
        const digitizingCount = garmentDigitizingCount + capDigitizingCount;

        // Calculate total additional stitch charge across all products
        // BUG FIX 2026-01-15: Previous loop was broken - it summed lineItem.extraStitchCost
        // but we pass 0 to calculateProductPrice(), so all extraStitchCost values were 0!
        // Fix: Use primaryAdditionalStitchCost (already calculated correctly) × garmentQuantity
        // Caps have fixed 8K stitches - no extra stitch charge for caps
        // Full Back: ALL stitches charged at $1.25/1K (separate from excess stitch charges)
        let garmentStitchTotal = (primaryAdditionalStitchCost + primaryFullBackStitchCost) * garmentQuantity;
        let capStitchTotal = 0;
        const additionalStitchTotal = garmentStitchTotal + capStitchTotal;
        console.log(`[EmbroideryPricingCalculator] Stitch charges - Garment: $${garmentStitchTotal.toFixed(2)}, Cap: $${capStitchTotal.toFixed(2)}, Total: $${additionalStitchTotal.toFixed(2)}`);

        // Final totals - NOW includes additionalStitchTotal as a separate line item (not baked into product prices)
        const grandTotal = subtotal + ltmTotal + setupFees + additionalStitchTotal + additionalServicesTotal;

        return {
            products: productPricing,
            totalQuantity: totalQuantity,
            tier: garmentTier,  // Primary tier for backward compat (garment-based)
            garmentTier: garmentTier,  // NEW: Separate garment tier
            capTier: capTier,  // NEW: Separate cap tier
            embroideryRate: tierEmbCost,
            additionalStitchCost: primaryAdditionalStitchCost + primaryFullBackStitchCost,
            fullBackStitchCost: primaryFullBackStitchCost, // Full Back: ALL stitches at $1.25/1K
            additionalStitchTotal: additionalStitchTotal,  // Total extra stitch charge across all items
            garmentStitchTotal: garmentStitchTotal,  // NEW: Garment-only stitch charges (AS-GARM)
            capStitchTotal: capStitchTotal,          // NEW: Cap-only stitch charges (AS-CAP)
            subtotal: subtotal,
            ltmFee: ltmTotal,
            garmentLtmFee: garmentLtm,  // NEW: Separate garment LTM
            capLtmFee: capLtm,          // NEW: Separate cap LTM
            ltmPerUnit: ltmPerUnit,
            setupFees: setupFees,
            garmentSetupFees: garmentSetupFees,  // Garment digitizing fees
            capSetupFees: capSetupFees,          // Cap digitizing fees
            setupFeesCount: digitizingCount,  // Number of logos needing digitizing
            additionalServices: additionalServices,
            additionalServicesTotal: additionalServicesTotal,
            grandTotal: grandTotal,
            logos: logos,
            logoConfigs: logoConfigs,  // NEW: Separate cap/garment logo configs
            // Mixed quote breakdown
            hasCaps: capProducts.length > 0,
            hasGarments: garmentProducts.length > 0,
            capQuantity: capQuantity,
            garmentQuantity: garmentQuantity,
            capSubtotal: capSubtotal,
            garmentSubtotal: garmentSubtotal,
            // Separate logo arrays for invoice/display
            garmentLogos: garmentLogos,
            capLogos: capLogos,
            // Cap embellishment type (2026)
            capEmbellishmentType: capEmbellishmentType,
            capPatchSetupFee: capPatchSetupFee,
            puffUpchargePerCap: capEmbellishmentType === '3d-puff' ? this.puffUpchargePerCap : 0
        };
    }
    
    /**
     * Show API warning to user with different severity levels
     */
    showAPIWarning(message, failureType = 'general') {
        // Determine severity based on failure type
        let severity = 'error';
        if (failureType === 'main-pricing') {
            severity = 'critical';
        } else if (failureType === 'al-pricing' || failureType === 'partial') {
            severity = 'warning';
        }
        
        // Remove any existing warning
        const existingWarning = document.getElementById('pricing-api-warning');
        if (existingWarning) {
            existingWarning.remove();
        }
        
        // Create warning banner
        const warningBanner = document.createElement('div');
        warningBanner.id = 'pricing-api-warning';
        warningBanner.className = 'api-warning-banner';
        
        // Color based on severity
        const bgColor = severity === 'critical' ? '#dc2626' : 
                       severity === 'warning' ? '#f59e0b' : '#ef4444';
        
        warningBanner.style.cssText = `
            background: ${bgColor};
            color: white;
            padding: 20px;
            margin: 20px;
            border-radius: 8px;
            font-weight: bold;
            text-align: center;
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            z-index: 9999;
            max-width: 600px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.3);
            animation: pulse 2s infinite;
        `;
        
        const icon = severity === 'critical' ? '🚫' : '⚠️';
        const title = severity === 'critical' ? 'CRITICAL ERROR' :
                     severity === 'warning' ? 'WARNING' : 'ERROR';
        
        warningBanner.innerHTML = `
            <div style="font-size: 24px; margin-bottom: 10px;">
                ${icon} ${title} ${icon}
            </div>
            <div style="font-size: 16px; line-height: 1.5;">
                ${message}
            </div>
            <div style="margin-top: 15px;">
                <button onclick="location.reload()" style="
                    background: white;
                    color: ${bgColor};
                    border: none;
                    padding: 10px 20px;
                    margin: 0 5px;
                    border-radius: 4px;
                    font-weight: bold;
                    cursor: pointer;
                ">Try Again</button>
                <button onclick="alert('Please contact IT support at erik@nwcustomapparel.com or call 253-922-5793.')" style="
                    background: white;
                    color: ${bgColor};
                    border: none;
                    padding: 10px 20px;
                    margin: 0 5px;
                    border-radius: 4px;
                    font-weight: bold;
                    cursor: pointer;
                ">Report Issue</button>
            </div>
        `;
        
        // Add CSS animation if not already present
        if (!document.getElementById('api-warning-styles')) {
            const style = document.createElement('style');
            style.id = 'api-warning-styles';
            style.textContent = `
                @keyframes pulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.85; }
                }
            `;
            document.head.appendChild(style);
        }
        
        // Add to page
        document.body.appendChild(warningBanner);
        
        // Handle quote creation based on severity
        if (severity === 'critical' || (severity === 'warning' && failureType === 'al-pricing')) {
            this.disableQuoteCreation(failureType);
        }
        
        // Log for debugging
        console.error(`[${severity.toUpperCase()}] API failure - Type: ${failureType}`, message);
    }
    
    /**
     * Disable quote creation when critical data is missing
     */
    disableQuoteCreation(reason = 'general') {
        // Disable all submit/save buttons
        const submitButtons = document.querySelectorAll(
            'button[type="submit"], ' +
            'button[id*="submit"], ' +
            'button[id*="save"], ' + 
            'button[id*="send"], ' +
            'button[id*="quote"], ' +
            '.btn-primary, ' +
            '.create-quote-btn'
        );
        
        submitButtons.forEach(btn => {
            btn.disabled = true;
            btn.style.opacity = '0.5';
            btn.style.cursor = 'not-allowed';
            
            // Set specific tooltip based on reason
            if (reason === 'al-pricing') {
                btn.title = 'Cannot create quotes with Additional Logos while AL pricing is unavailable';
                // Only disable if AL is being used
                if (window.embQuoteBuilder && window.embQuoteBuilder.hasAdditionalLogos && window.embQuoteBuilder.hasAdditionalLogos()) {
                    btn.disabled = true;
                } else {
                    btn.disabled = false; // Allow quotes without AL
                    btn.style.opacity = '1';
                    btn.style.cursor = 'pointer';
                    btn.title = '';
                }
            } else if (reason === 'main-pricing') {
                btn.title = 'Cannot create quotes while main pricing configuration is unavailable';
            } else {
                btn.title = 'Cannot submit quotes while pricing data is unavailable';
            }
            
            // Add visual indicator for disabled buttons
            if (btn.disabled) {
                const originalText = btn.textContent;
                if (!btn.dataset.originalText) {
                    btn.dataset.originalText = originalText;
                    btn.textContent = '⚠️ ' + originalText + ' (Disabled)';
                }
            }
        });
        
        // Also disable form submission
        const forms = document.querySelectorAll('form');
        forms.forEach(form => {
            if (!form.dataset.apiErrorHandler) {
                form.dataset.apiErrorHandler = 'true';
                form.addEventListener('submit', (e) => {
                    if (this.apiStatus && !this.apiStatus.isHealthy) {
                        e.preventDefault();
                        alert('Quote creation is disabled due to pricing data issues. Please refresh the page or contact support.');
                        return false;
                    }
                });
            }
        });
    }
    
    /**
     * Round stitch count to increment
     */
    roundStitchCount(stitches) {
        return Math.round(stitches / this.stitchIncrement) * this.stitchIncrement;
    }
    
    /**
     * Format currency
     */
    formatCurrency(amount) {
        return `$${amount.toFixed(2)}`;
    }
    
    /**
     * @deprecated Use roundPrice() instead which uses API-based rounding rules
     */
    roundUpToHalf(price) {
        return Math.ceil(price * 2) / 2;
    }
}

// Make available globally
window.EmbroideryPricingCalculator = EmbroideryPricingCalculator;