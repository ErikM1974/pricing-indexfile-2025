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
        
        this.marginDenominator = 0.6;
        this.ltmFee = 50.00;
        this.digitizingFee = 100.00;
        this.additionalStitchRate = 1.25; // per 1000 stitches over 8000
        this.baseStitchCount = 8000; // base included stitches
        this.stitchIncrement = 1000; // rounding increment
        
        // Cache for size pricing data
        this.sizePricingCache = {};
        
        // Additional Logo (AL) tiers - will be fetched from API
        this.alTiers = {};
        
        // Rounding method - will be fetched from API
        this.roundingMethod = null;
        
        // Track API status
        this.apiError = false;
        
        // Detailed API status tracking
        this.apiStatus = {
            mainPricing: false,      // Main embroidery pricing loaded
            alPricing: false,        // AL pricing loaded
            configuration: false,    // Config values loaded
            criticalFailures: [],    // List of critical failures
            warnings: []             // List of non-critical warnings
        };
        
        // Fetch configuration from API
        this.initialized = false;
        this.initializeConfig();
    }
    
    /**
     * Initialize configuration from API
     */
    async initializeConfig() {
        try {
            console.log('[EmbroideryPricingCalculator] Fetching configuration from API...');
            
            // Fetch embroidery pricing bundle (includes all config)
            const response = await fetch(`${this.baseURL}/api/pricing-bundle?method=EMB&styleNumber=PC54`);
            const data = await response.json();
            
            if (data) {
                // Extract configuration from tiersR
                if (data.tiersR && data.tiersR.length > 0) {
                    this.marginDenominator = data.tiersR[0].MarginDenominator || 0.6;
                    
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
                            console.log(`🔍 [DEBUG] AL Tier ${cost.TierLabel}: EmbroideryCost = $${cost.EmbroideryCost}`);
                            this.alTiers[cost.TierLabel] = {
                                embCost: cost.EmbroideryCost,
                                hasLTM: cost.TierLabel === '1-23'
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
        const embCost = this.getEmbroideryCost(tier);
        
        // Fetch size pricing for this style
        const sizePricingData = await this.fetchSizePricing(product.style);
        
        if (!sizePricingData || sizePricingData.length === 0) {
            console.error('[CRITICAL] No size pricing data for', product.style);
            console.error('[CRITICAL] API call failed - system will likely use hardcoded fallback values!');
            console.error('[CRITICAL] Check if /api/size-pricing endpoint is working');
            return null;
        }
        
        // Use first color's data (or find specific color if needed)
        const priceData = sizePricingData.find(d => d.color === product.color) || sizePricingData[0];
        
        const lineItems = [];
        let lineSubtotal = 0;
        
        // Find the standard size base price (use S/M/L/XL prices)
        const standardSizes = ['S', 'M', 'L', 'XL'];
        let standardBasePrice = 0;
        for (const size of standardSizes) {
            if (priceData.basePrices[size]) {
                standardBasePrice = priceData.basePrices[size];
                break;
            }
        }
        
        // Group sizes by upcharge amount from API
        const standardSizeGroup = [];
        const upchargeSizeGroups = {};
        
        for (const [size, qty] of Object.entries(product.sizeBreakdown)) {
            const apiUpcharge = priceData.sizeUpcharges[size] || 0; // Use API upcharge values directly
            
            if (apiUpcharge === 0) {
                // Standard sizes (S, M, L, XL)
                standardSizeGroup.push({ size, qty, basePrice: standardBasePrice });
            } else {
                // Upcharge sizes (2XL, 3XL, 4XL)
                if (!upchargeSizeGroups[apiUpcharge]) {
                    upchargeSizeGroups[apiUpcharge] = [];
                }
                upchargeSizeGroups[apiUpcharge].push({ size, qty, basePrice: standardBasePrice, upcharge: apiUpcharge });
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
            
            lineItems.push({
                description: sizeList.join(' '),
                quantity: standardQty,
                unitPrice: finalPrice,
                basePrice: roundedBase,  // Store the rounded base for display
                total: finalPrice * standardQty
            });
            
            lineSubtotal += finalPrice * standardQty;
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
            // Step 1: Calculate and ROUND the base price with upcharge
            const upchargeAmount = parseFloat(apiUpcharge); // Use API upcharge value directly
            const garmentCost = (standardBasePrice + upchargeAmount) / this.marginDenominator;
            const baseDecoratedPrice = garmentCost + embCost;  // TRUE base with 8k stitches
            const roundedBase = this.roundPrice(baseDecoratedPrice);  // Round the base FIRST
            // Step 2: Add extra stitch fees on top (no more rounding)
            const finalPrice = roundedBase + additionalStitchCost;
            
            lineItems.push({
                description: sizeList.join(' '),
                quantity: upchargeQty,
                unitPrice: finalPrice,
                basePrice: roundedBase,  // Store the rounded base for display
                total: finalPrice * upchargeQty,
                hasUpcharge: true
            });
            
            lineSubtotal += finalPrice * upchargeQty;
        }
        
        return {
            product: product,
            tier: tier,
            lineItems: lineItems,
            subtotal: lineSubtotal
        };
    }
    
    /**
     * Calculate complete quote pricing
     */
    async calculateQuote(products, logos) {
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
        
        const totalQuantity = products.reduce((sum, p) => sum + p.totalQuantity, 0);
        const tier = this.getTier(totalQuantity);
        const tierEmbCost = this.getEmbroideryCost(tier);
        
        // Separate primary and additional logos
        const primaryLogos = logos.filter(l => l.isPrimary);
        const additionalLogos = logos.filter(l => !l.isPrimary);
        
        // Calculate additional stitch cost for PRIMARY logos only (included in base price)
        let primaryAdditionalStitchCost = 0;
        primaryLogos.forEach(logo => {
            const extraStitches = Math.max(0, logo.stitchCount - this.baseStitchCount);
            primaryAdditionalStitchCost += (extraStitches / 1000) * this.additionalStitchRate;
        });
        
        // Calculate each product's pricing (with primary logo)
        const productPricing = [];
        let subtotal = 0;
        
        for (const product of products) {
            const pricing = await this.calculateProductPrice(product, totalQuantity, primaryAdditionalStitchCost);
            if (pricing) {
                productPricing.push(pricing);
                subtotal += pricing.subtotal;
            }
        }
        
        // Apply LTM if needed
        let ltmTotal = 0;
        let ltmPerUnit = 0;
        if (totalQuantity < 24) {
            ltmTotal = this.ltmFee;
            ltmPerUnit = ltmTotal / totalQuantity;
            
            // Add LTM to each line item
            productPricing.forEach(pp => {
                pp.lineItems.forEach(item => {
                    item.ltmPerUnit = ltmPerUnit;
                    item.unitPriceWithLTM = item.unitPrice + ltmPerUnit;
                });
            });
        }
        
        // Calculate additional logos pricing
        const additionalServices = [];
        let additionalServicesTotal = 0;
        
        // Process additional logos for each product
        for (const product of products) {
            if (product.logoAssignments?.additional) {
                for (const assignment of product.logoAssignments.additional) {
                    const logo = additionalLogos.find(l => l.id === assignment.logoId);
                    if (logo) {
                        const quantity = assignment.quantity || 0;
                        if (quantity > 0) {
                            // Calculate additional logo price (NO margin division)
                            const extraStitches = Math.max(0, logo.stitchCount - this.baseStitchCount);
                            const stitchCost = (extraStitches / 1000) * this.additionalStitchRate;
                            
                            // Use AL tier cost from API - ERROR if not available
                            if (!this.alTiers[tier] || !this.alTiers[tier].embCost) {
                                console.error('[EmbroideryPricingCalculator] AL pricing not available for tier:', tier);
                                // Show error to user if not already shown
                                if (!document.getElementById('pricing-api-warning')) {
                                    this.showAPIWarning(
                                        'Cannot calculate Additional Logo pricing. AL pricing data is unavailable. ' +
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
                            
                            const alTierCost = this.alTiers[tier].embCost;
                            
                            // Debug logging for AL calculation
                            console.log(`🔍 [DEBUG] AL Calculation for ${logo.position}:`);
                            console.log(`   - Tier: ${tier}`);
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
                                stitchCount: logo.stitchCount
                            });
                            
                            additionalServicesTotal += total;
                        }
                    }
                }
            }
            
            // Process monograms
            if (product.logoAssignments?.monogram) {
                const monogram = product.logoAssignments.monogram;
                if (monogram.quantity > 0) {
                    const total = monogram.quantity * 12.50;
                    
                    additionalServices.push({
                        type: 'monogram',
                        description: 'Monogram',
                        partNumber: 'Monogram',
                        quantity: monogram.quantity,
                        unitPrice: 12.50,
                        total: total,
                        productStyle: product.style,
                        mode: monogram.mode,
                        names: monogram.names || []
                    });
                    
                    additionalServicesTotal += total;
                }
            }
        }
        
        // Calculate setup fees
        const setupFees = logos.filter(l => l.needsDigitizing).length * this.digitizingFee;
        
        // Final totals
        const grandTotal = subtotal + ltmTotal + setupFees + additionalServicesTotal;
        
        return {
            products: productPricing,
            totalQuantity: totalQuantity,
            tier: tier,
            embroideryRate: tierEmbCost,
            additionalStitchCost: primaryAdditionalStitchCost,
            subtotal: subtotal,
            ltmFee: ltmTotal,
            ltmPerUnit: ltmPerUnit,
            setupFees: setupFees,
            additionalServices: additionalServices,
            additionalServicesTotal: additionalServicesTotal,
            grandTotal: grandTotal,
            logos: logos
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