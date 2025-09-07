/**
 * Cap Quote Pricing Calculator
 * Handles pricing for cap embroidery with CAP and CAP-AL endpoints
 * Front logo (CAP) + Additional logos (CAP-AL)
 */

class CapQuotePricingCalculator {
    constructor() {
        this.baseURL = 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';
        this.pricingData = {
            primary: null,    // CAP endpoint data
            additional: null  // CAP-AL endpoint data
        };
        this.cacheExpiry = 5 * 60 * 1000; // 5 minutes
        
        this.loadPricingData();
        console.log('[CapQuotePricingCalculator] Initialized');
    }
    
    /**
     * Load pricing data from both CAP endpoints
     */
    async loadPricingData() {
        console.log('[CapQuotePricingCalculator] Loading pricing data...');
        
        try {
            // Load both endpoints in parallel
            const [primaryResponse, additionalResponse] = await Promise.all([
                fetch(`${this.baseURL}/api/pricing-bundle?method=CAP`),
                fetch(`${this.baseURL}/api/pricing-bundle?method=CAP-AL`)
            ]);
            
            if (!primaryResponse.ok) {
                throw new Error(`CAP endpoint failed: ${primaryResponse.status}`);
            }
            
            if (!additionalResponse.ok) {
                throw new Error(`CAP-AL endpoint failed: ${additionalResponse.status}`);
            }
            
            const primaryData = await primaryResponse.json();
            const additionalData = await additionalResponse.json();
            
            // Validate required data
            this.validatePricingData(primaryData, 'CAP');
            this.validatePricingData(additionalData, 'CAP-AL');
            
            this.pricingData = {
                primary: primaryData,
                additional: additionalData,
                loadedAt: Date.now()
            };
            
            console.log('[CapQuotePricingCalculator] ✅ Pricing data loaded successfully');
            console.log('[CapQuotePricingCalculator] Primary tiers:', primaryData.tiersR?.length || 0);
            console.log('[CapQuotePricingCalculator] Additional tiers:', additionalData.tiersR?.length || 0);
            
            return true;
            
        } catch (error) {
            console.error('[CapQuotePricingCalculator] ❌ Failed to load pricing data:', error);
            
            // Show visible error - NO FALLBACKS
            if (typeof window !== 'undefined' && window.showErrorBanner) {
                window.showErrorBanner(`CAP PRICING DATA UNAVAILABLE: ${error.message}`);
            }
            
            throw error;
        }
    }
    
    /**
     * Validate pricing data structure
     */
    validatePricingData(data, endpoint) {
        const required = ['tiersR', 'allEmbroideryCostsR', 'rulesR'];
        
        for (const field of required) {
            if (!data[field]) {
                throw new Error(`${endpoint} endpoint missing required field: ${field}`);
            }
        }
        
        if (!Array.isArray(data.tiersR) || data.tiersR.length === 0) {
            throw new Error(`${endpoint} endpoint has no pricing tiers`);
        }
        
        if (!Array.isArray(data.allEmbroideryCostsR) || data.allEmbroideryCostsR.length === 0) {
            throw new Error(`${endpoint} endpoint has no embroidery costs`);
        }
    }
    
    /**
     * Calculate complete cap pricing for a quote
     */
    async calculateCapQuotePricing(products, logos) {
        console.log('[CapQuotePricingCalculator] Calculating pricing...');
        console.log('[CapQuotePricingCalculator] Products:', products.length);
        console.log('[CapQuotePricingCalculator] Logos:', logos.length);
        
        // Ensure pricing data is loaded and fresh
        if (!this.isPricingDataValid()) {
            console.log('[CapQuotePricingCalculator] Reloading expired pricing data...');
            await this.loadPricingData();
        }
        
        try {
            const totalQuantity = products.reduce((sum, p) => sum + p.totalQuantity, 0);
            const pricedProducts = [];
            let subtotal = 0;
            let frontEmbroideryTotal = 0;
            let additionalEmbroideryTotal = 0;
            let capTotal = 0;
            
            // Calculate pricing for each product
            for (const product of products) {
                const pricedProduct = await this.calculateProductPricing(product, logos, totalQuantity);
                pricedProducts.push(pricedProduct);
                subtotal += pricedProduct.lineTotal;
                
                // Calculate proportional embroidery costs based on quantity
                const productQuantity = product.totalQuantity;
                frontEmbroideryTotal += (pricedProduct.pricingBreakdown.frontEmbroideryPrice * productQuantity);
                additionalEmbroideryTotal += (pricedProduct.pricingBreakdown.additionalEmbroideryPrice * productQuantity);
                capTotal += (pricedProduct.pricingBreakdown.capPrice * productQuantity);
            }
            
            // Calculate fees
            const ltmFeeTotal = totalQuantity < 24 ? 50.00 : 0;
            const setupFees = logos.reduce((sum, logo) => sum + (logo.needsDigitizing ? 100 : 0), 0);
            const grandTotal = subtotal + ltmFeeTotal + setupFees;
            
            const pricingResult = {
                products: pricedProducts,
                totalQuantity: totalQuantity,
                subtotal: subtotal,
                capTotal: capTotal,
                frontEmbroideryTotal: frontEmbroideryTotal,
                additionalEmbroideryTotal: additionalEmbroideryTotal,
                ltmFeeTotal: ltmFeeTotal,
                setupFees: setupFees,
                grandTotal: grandTotal,
                tier: this.getTierLabel(totalQuantity),
                hasLTM: totalQuantity < 24
            };
            
            console.log('[CapQuotePricingCalculator] ✅ Pricing calculation complete');
            console.log('[CapQuotePricingCalculator] Cap total:', capTotal.toFixed(2));
            console.log('[CapQuotePricingCalculator] Front embroidery total:', frontEmbroideryTotal.toFixed(2));
            console.log('[CapQuotePricingCalculator] Additional embroidery total:', additionalEmbroideryTotal.toFixed(2));
            console.log('[CapQuotePricingCalculator] Grand total:', grandTotal);
            
            return pricingResult;
            
        } catch (error) {
            console.error('[CapQuotePricingCalculator] ❌ Pricing calculation failed:', error);
            throw new Error(`Pricing calculation failed: ${error.message}`);
        }
    }
    
    /**
     * Calculate pricing for a single product
     */
    async calculateProductPricing(product, logos, totalQuantity) {
        console.log('[CapQuotePricingCalculator] Pricing product:', product.styleNumber);
        
        try {
            // Get base cap price
            const baseCapPrice = await this.getBaseCapPrice(product.styleNumber);
            
            // Calculate decorated price per cap (returns detailed breakdown)
            const pricingBreakdown = this.calculateDecoratedPrice(baseCapPrice, logos, totalQuantity);
            
            // Apply size-based pricing using total price
            const sizePricedItems = this.applySizePricing(product, pricingBreakdown.totalPrice);
            
            const lineTotal = sizePricedItems.reduce((sum, item) => sum + item.total, 0);
            
            const pricedProduct = {
                ...product,
                basePrice: pricingBreakdown.totalPrice,
                sizePricedItems: sizePricedItems,
                lineTotal: lineTotal,
                pricingBreakdown: pricingBreakdown  // Store detailed breakdown
            };
            
            console.log('[CapQuotePricingCalculator] Product priced:', product.styleNumber, '$' + lineTotal.toFixed(2));
            
            return pricedProduct;
            
        } catch (error) {
            console.error('[CapQuotePricingCalculator] Product pricing failed:', product.styleNumber, error);
            throw error;
        }
    }
    
    /**
     * Get base cap price from API
     */
    async getBaseCapPrice(styleNumber) {
        try {
            console.log('[CapQuotePricingCalculator] Getting base price for:', styleNumber);
            
            const response = await fetch(`${this.baseURL}/api/size-pricing?styleNumber=${styleNumber}`);
            
            if (!response.ok) {
                throw new Error(`Size pricing API failed: ${response.status}`);
            }
            
            const data = await response.json();
            
            // Get the base price (typically from Small size or first available)
            const sizes = data.basePrices || {};
            const basePrice = sizes['S'] || sizes['One Size'] || Object.values(sizes)[0];
            
            if (!basePrice) {
                throw new Error(`No base price found for ${styleNumber}`);
            }
            
            console.log('[CapQuotePricingCalculator] Base cap price:', basePrice);
            return parseFloat(basePrice);
            
        } catch (error) {
            console.warn('[CapQuotePricingCalculator] Base price lookup failed, using default:', error.message);
            // Use a reasonable default for caps
            return 15.00;
        }
    }
    
    /**
     * Calculate decorated price (cap + all embroidery)
     */
    calculateDecoratedPrice(baseCapPrice, logos, totalQuantity) {
        console.log('[CapQuotePricingCalculator] Calculating decorated price...');
        
        // Apply margin to cap price
        const marginDenominator = this.pricingData.primary.tiersR[0]?.MarginDenominator || 0.6;
        const capSellingPrice = baseCapPrice / marginDenominator;
        
        // Get front logo pricing (from CAP endpoint)
        const frontLogo = logos.find(logo => logo.isRequired) || logos[0];
        const frontEmbroideryPrice = this.calculateLogoPrice(frontLogo, totalQuantity, 'primary');
        
        // Get additional logos pricing (from CAP-AL endpoint)
        const additionalLogos = logos.filter(logo => !logo.isRequired);
        const additionalEmbroideryPrice = additionalLogos.reduce((sum, logo) => {
            return sum + this.calculateLogoPrice(logo, totalQuantity, 'additional');
        }, 0);
        
        const totalEmbroideryPrice = frontEmbroideryPrice + additionalEmbroideryPrice;
        const decoratedPrice = capSellingPrice + totalEmbroideryPrice;
        
        // Round UP to nearest dollar (CeilDollar)
        const roundedPrice = Math.ceil(decoratedPrice);
        
        console.log('[CapQuotePricingCalculator] Price breakdown:');
        console.log('  Cap selling price:', capSellingPrice.toFixed(2));
        console.log('  Front embroidery:', frontEmbroideryPrice.toFixed(2));
        console.log('  Additional embroidery:', additionalEmbroideryPrice.toFixed(2));
        console.log('  Total decorated:', decoratedPrice.toFixed(2));
        console.log('  Rounded final:', roundedPrice.toFixed(2));
        
        // Return detailed breakdown for separate display
        return {
            totalPrice: roundedPrice,
            capPrice: capSellingPrice,
            frontEmbroideryPrice: frontEmbroideryPrice,
            additionalEmbroideryPrice: additionalEmbroideryPrice
        };
    }
    
    /**
     * Calculate price for a single logo
     */
    calculateLogoPrice(logo, totalQuantity, pricingType) {
        if (!logo) return 0;
        
        const pricingSource = this.pricingData[pricingType];
        if (!pricingSource) {
            throw new Error(`Pricing source not available: ${pricingType}`);
        }
        
        // Get the tier for this quantity
        const tierData = this.getTierData(totalQuantity, pricingSource);
        const embroideryData = this.getEmbroideryData(totalQuantity, pricingSource);
        
        if (!tierData || !embroideryData) {
            throw new Error(`Pricing data not found for quantity ${totalQuantity} in ${pricingType}`);
        }
        
        // Base embroidery cost
        let logoPrice = embroideryData.EmbroideryCost;
        
        // Add cost for additional stitches
        const baseStitchCount = embroideryData.BaseStitchCount || (pricingType === 'primary' ? 8000 : 5000);
        const additionalStitchRate = embroideryData.AdditionalStitchRate || 1.0;
        
        if (logo.stitchCount > baseStitchCount) {
            const additionalStitches = logo.stitchCount - baseStitchCount;
            const additionalStitchCost = Math.ceil(additionalStitches / 1000) * additionalStitchRate;
            logoPrice += additionalStitchCost;
            
            console.log(`[CapQuotePricingCalculator] ${logo.position} extra stitches:`, 
                       additionalStitches, '@ $' + additionalStitchRate, '= $' + additionalStitchCost.toFixed(2));
        }
        
        // Add LTM fee if applicable (from embroidery data, not tier data)
        const ltmFee = embroideryData.LTM || 0;
        if (totalQuantity < 24 && ltmFee > 0) {
            const ltmPerUnit = ltmFee / totalQuantity;
            logoPrice += ltmPerUnit;
            
            console.log(`[CapQuotePricingCalculator] ${logo.position} LTM:`, 
                       '$' + ltmFee, '÷', totalQuantity, '= $' + ltmPerUnit.toFixed(2));
        }
        
        console.log(`[CapQuotePricingCalculator] ${logo.position} (${pricingType}):`, 
                   '$' + logoPrice.toFixed(2));
        
        return logoPrice;
    }
    
    /**
     * Apply size-specific pricing and upcharges
     */
    applySizePricing(product, baseDecoratedPrice) {
        const sizePricedItems = [];
        
        for (const [size, quantity] of Object.entries(product.sizeBreakdown)) {
            if (quantity <= 0) continue;
            
            let unitPrice = baseDecoratedPrice;
            
            // Apply size upcharge if any
            const sizeUpcharge = product.sizeUpcharges?.[size] || 0;
            if (sizeUpcharge > 0) {
                unitPrice += sizeUpcharge;
                // Round UP to nearest dollar after upcharge
                unitPrice = Math.ceil(unitPrice);
            }
            
            const total = unitPrice * quantity;
            
            sizePricedItems.push({
                size: size,
                quantity: quantity,
                unitPrice: unitPrice,
                sizeUpcharge: sizeUpcharge,
                total: total
            });
        }
        
        return sizePricedItems;
    }
    
    /**
     * Get tier data for quantity
     */
    getTierData(quantity, pricingSource) {
        return pricingSource.tiersR.find(tier => 
            quantity >= tier.MinQuantity && quantity <= tier.MaxQuantity
        );
    }
    
    /**
     * Get embroidery data for quantity
     */
    getEmbroideryData(quantity, pricingSource) {
        return pricingSource.allEmbroideryCostsR.find(cost => {
            const tierLabel = this.getTierLabel(quantity);
            return cost.TierLabel === tierLabel;
        });
    }
    
    /**
     * Get tier label for quantity
     */
    getTierLabel(quantity) {
        if (quantity < 24) return '1-23';
        if (quantity < 48) return '24-47';
        if (quantity < 72) return '48-71';
        return '72+';
    }
    
    /**
     * Check if pricing data is valid and fresh
     */
    isPricingDataValid() {
        if (!this.pricingData.primary || !this.pricingData.additional) {
            return false;
        }
        
        const age = Date.now() - (this.pricingData.loadedAt || 0);
        return age < this.cacheExpiry;
    }
    
    /**
     * Get pricing summary for display
     */
    getPricingSummary(pricingResult) {
        if (!pricingResult) return null;
        
        return {
            totalQuantity: pricingResult.totalQuantity,
            subtotal: pricingResult.subtotal,
            ltmFee: pricingResult.ltmFeeTotal,
            setupFees: pricingResult.setupFees,
            grandTotal: pricingResult.grandTotal,
            tier: pricingResult.tier,
            hasLTM: pricingResult.hasLTM,
            breakdown: pricingResult.products.map(product => ({
                style: product.styleNumber,
                quantity: product.totalQuantity,
                total: product.lineTotal
            }))
        };
    }
    
    /**
     * Debug method to test pricing calculations
     */
    async testPricing(quantity, frontStitches, additionalLogos = []) {
        console.log('🧪 [CapPricingTest] Testing pricing calculation...');
        console.log('📊 Parameters:', { quantity, frontStitches, additionalLogos });
        
        try {
            // Create test logos
            const testLogos = [
                {
                    id: 'front',
                    position: 'Cap Front',
                    stitchCount: frontStitches,
                    needsDigitizing: false,
                    isRequired: true
                },
                ...additionalLogos.map((logo, index) => ({
                    id: `additional-${index}`,
                    position: logo.position,
                    stitchCount: logo.stitches,
                    needsDigitizing: false,
                    isRequired: false
                }))
            ];
            
            // Create test product
            const testProduct = {
                styleNumber: 'C112',
                title: 'Test Cap',
                totalQuantity: quantity,
                sizeBreakdown: { 'One Size': quantity },
                sizeUpcharges: {}
            };
            
            const result = await this.calculateCapQuotePricing([testProduct], testLogos);
            
            console.log('✅ [CapPricingTest] Results:');
            console.log('💰 Grand Total:', '$' + result.grandTotal.toFixed(2));
            console.log('📈 Tier:', result.tier);
            console.log('🏷️ LTM Fee:', result.hasLTM ? '$50.00' : 'None');
            console.log('🎨 Setup Fees:', '$' + result.setupFees.toFixed(2));
            
            return result;
            
        } catch (error) {
            console.error('❌ [CapPricingTest] Failed:', error);
            throw error;
        }
    }
}

// Export for use in other modules
if (typeof window !== 'undefined') {
    window.CapQuotePricingCalculator = CapQuotePricingCalculator;
}