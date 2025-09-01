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
        
        // Rounding method - will be fetched from API
        this.roundingMethod = null;
        
        // Track API status
        this.apiError = false;
        
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
            
            this.initialized = true;
            console.log('[EmbroideryPricingCalculator] Initialization complete');
            
        } catch (error) {
            console.error('[EmbroideryPricingCalculator] Error fetching configuration:', error);
            console.log('[EmbroideryPricingCalculator] Using fallback values - PRICES MAY BE INCORRECT!');
            
            // Mark API as failed
            this.apiError = true;
            
            // Show prominent warning to user
            this.showAPIWarning(
                'Unable to load current pricing configuration from server. ' +
                'DO NOT send quotes to customers until this is resolved. ' +
                'Please contact IT support immediately.'
            );
            
            // Still initialize with fallback but user is warned
            this.roundingMethod = 'CeilDollar';
            this.initialized = true;
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
            
            // Calculate decorated price using standard base price
            const garmentPrice = standardBasePrice / this.marginDenominator;
            const decoratedPrice = garmentPrice + embCost + additionalStitchCost;
            const finalPrice = this.roundPrice(decoratedPrice);
            
            lineItems.push({
                description: sizeList.join(' '),
                quantity: standardQty,
                unitPrice: finalPrice,
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
            
            // Calculate decorated price using same standard base price + API upcharge
            const garmentPrice = standardBasePrice / this.marginDenominator;
            const decoratedPrice = garmentPrice + embCost + additionalStitchCost;
            const upchargeAmount = parseFloat(apiUpcharge); // Use API upcharge value directly
            const finalPrice = this.roundPrice(decoratedPrice + upchargeAmount);
            
            lineItems.push({
                description: sizeList.join(' '),
                quantity: upchargeQty,
                unitPrice: finalPrice,
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
        
        // Warn if using fallback values
        if (this.apiError) {
            console.warn('[EmbroideryPricingCalculator] WARNING: Calculating with fallback values - prices may be incorrect!');
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
                            const isSubset = quantity < totalQuantity;
                            const subsetUpcharge = isSubset ? 3.00 : 0;
                            
                            // Direct tier cost + stitch cost + subset upcharge
                            const unitPrice = this.roundPrice(tierEmbCost + stitchCost + subsetUpcharge);
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
                                hasSubsetUpcharge: isSubset,
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
     * Show API warning to user
     */
    showAPIWarning(message) {
        // Create warning banner
        const warningBanner = document.createElement('div');
        warningBanner.id = 'pricing-api-warning';
        warningBanner.className = 'api-warning-banner';
        warningBanner.style.cssText = `
            background: #dc2626;
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
        
        warningBanner.innerHTML = `
            <div style="font-size: 24px; margin-bottom: 10px;">
                ⚠️ CRITICAL ERROR ⚠️
            </div>
            <div style="font-size: 16px; line-height: 1.5;">
                ${message}
            </div>
            <div style="margin-top: 15px;">
                <button onclick="location.reload()" style="
                    background: white;
                    color: #dc2626;
                    border: none;
                    padding: 10px 20px;
                    margin: 0 5px;
                    border-radius: 4px;
                    font-weight: bold;
                    cursor: pointer;
                ">Try Again</button>
                <button onclick="alert('Please email IT support or call the help desk immediately.')" style="
                    background: white;
                    color: #dc2626;
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
        
        // Also disable quote submission if possible
        const submitButtons = document.querySelectorAll('[id*="submit"], [id*="save"], [id*="send"]');
        submitButtons.forEach(btn => {
            btn.disabled = true;
            btn.style.opacity = '0.5';
            btn.title = 'Cannot submit quotes while pricing configuration is unavailable';
        });
        
        // Log for debugging
        console.error('[CRITICAL] API configuration failed - fallback prices in use!');
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