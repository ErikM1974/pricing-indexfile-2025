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
            
            // Calculate fees - get LTM fee from API data
            const ltmFee = this.getLTMFeeFromAPI(totalQuantity);
            const ltmFeeTotal = ltmFee;
            const digitizingFee = this.getDigitizingFeeFromAPI();
            const setupFees = logos.reduce((sum, logo) => sum + (logo.needsDigitizing ? digitizingFee : 0), 0);
            // Don't add ltmFeeTotal to grandTotal since it's already included in subtotal per-piece pricing
            const grandTotal = subtotal + additionalEmbroideryTotal + setupFees;
            
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
            // Get base cap price for the specific color
            const baseCapPrice = await this.getBaseCapPrice(product.styleNumber, product.color);
            
            // Calculate decorated price per cap (returns detailed breakdown)
            const pricingBreakdown = this.calculateDecoratedPrice(baseCapPrice, logos, totalQuantity);
            
            // Add LTM fee to base price if applicable
            let adjustedPrice = pricingBreakdown.totalPrice;
            const ltmFee = this.getLTMFeeFromAPI(totalQuantity);
            const ltmPerUnit = ltmFee > 0 ? ltmFee / totalQuantity : 0; // Store for size items
            if (ltmPerUnit > 0) {
                adjustedPrice += ltmPerUnit;
                console.log('[CapQuotePricingCalculator] 🔍 Adding LTM per piece:', '$' + ltmPerUnit.toFixed(2));
                console.log('[CapQuotePricingCalculator] 🔍 Adjusted price with LTM:', '$' + adjustedPrice.toFixed(2));
            }

            // Apply size-based pricing using LTM-adjusted price, pass ltmPerUnit for display
            const sizePricedItems = this.applySizePricing(product, adjustedPrice, ltmPerUnit);
            
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
    async getBaseCapPrice(styleNumber, color) {
        try {
            console.log('[CapQuotePricingCalculator] Getting base price for:', styleNumber, color);
            
            const response = await fetch(`${this.baseURL}/api/size-pricing?styleNumber=${styleNumber}`);
            
            if (!response.ok) {
                throw new Error(`Size pricing API failed: ${response.status}`);
            }
            
            const data = await response.json();
            console.log('[CapQuotePricingCalculator] 🔍 API Response for', styleNumber, ':', data.length, 'colors');
            
            // First, try to find the specific color
            let targetPrice = null;
            let fallbackPrice = null;
            
            for (const colorData of Array.isArray(data) ? data : [data]) {
                const colorName = colorData.color || 'Unknown';
                const sizes = colorData.basePrices || {};
                const prices = Object.values(sizes).filter(p => p && p > 0); // Remove zero/null prices
                
                if (prices.length > 0) {
                    const colorPrice = Math.max(...prices);
                    
                    // If this is our target color, use it
                    if (colorName === color) {
                        targetPrice = colorPrice;
                        console.log('[CapQuotePricingCalculator] 🔍 Found exact color match:', color, '$' + colorPrice.toFixed(2));
                        break;
                    }
                    
                    // Keep the first valid price as fallback
                    if (fallbackPrice === null) {
                        fallbackPrice = colorPrice;
                    }
                }
            }
            
            const finalPrice = targetPrice || fallbackPrice;
            
            if (!finalPrice) {
                throw new Error(`No valid (non-zero) prices found for ${styleNumber}`);
            }
            
            if (targetPrice) {
                console.log('[CapQuotePricingCalculator] 🔍 Using exact color price:', color, '$' + finalPrice.toFixed(2));
            } else {
                console.log('[CapQuotePricingCalculator] 🔍 Color not found, using fallback price: $' + finalPrice.toFixed(2));
            }
            
            return parseFloat(finalPrice);
            
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
        console.log('[CapQuotePricingCalculator] 🔍 Calculating decorated price...');
        console.log('[CapQuotePricingCalculator] 🔍 Input baseCapPrice:', baseCapPrice);
        console.log('[CapQuotePricingCalculator] 🔍 Input totalQuantity:', totalQuantity);
        console.log('[CapQuotePricingCalculator] 🔍 Input logos:', logos.length);
        
        // Apply margin to cap price - get from API
        const marginDenominator = this.getMarginDenominatorFromAPI(totalQuantity);
        const capSellingPrice = baseCapPrice / marginDenominator;
        console.log('[CapQuotePricingCalculator] 🔍 Margin denominator:', marginDenominator);
        console.log('[CapQuotePricingCalculator] 🔍 Cap selling price:', capSellingPrice);
        
        // Get front logo pricing (from CAP endpoint)
        const frontLogo = logos.find(logo => logo.isRequired) || logos[0];
        console.log('[CapQuotePricingCalculator] 🔍 Front logo:', frontLogo?.position, frontLogo?.stitchCount);
        const frontLogoPricing = this.calculateLogoPrice(frontLogo, totalQuantity, 'primary');
        const frontEmbroideryPrice = frontLogoPricing.totalPrice;
        console.log('[CapQuotePricingCalculator] 🔍 Front embroidery price:', frontEmbroideryPrice);
        
        // Get additional logos pricing (from CAP-AL endpoint)
        const additionalLogos = logos.filter(logo => !logo.isRequired);
        console.log('[CapQuotePricingCalculator] 🔍 Additional logos count:', additionalLogos.length);
        
        // Calculate individual logo prices and store details
        const additionalLogoPrices = [];
        const additionalEmbroideryPrice = additionalLogos.reduce((sum, logo) => {
            const logoPricing = this.calculateLogoPrice(logo, totalQuantity, 'additional');
            const logoPrice = logoPricing.totalPrice;
            console.log('[CapQuotePricingCalculator] 🔍 Additional logo price:', logo.position, logoPrice);
            
            // Store individual logo pricing details
            additionalLogoPrices.push({
                position: logo.position,
                stitchCount: logo.stitchCount,
                pricePerPiece: logoPrice,
                needsDigitizing: logo.needsDigitizing,
                breakdown: logoPricing.breakdown
            });
            
            return sum + logoPrice;
        }, 0);
        console.log('[CapQuotePricingCalculator] 🔍 Total additional embroidery price:', additionalEmbroideryPrice);
        
        // ONLY include front embroidery in the base decorated price
        // Additional embroidery is tracked separately and not added to base price
        const decoratedPrice = capSellingPrice + frontEmbroideryPrice;
        
        // Round UP to nearest dollar (CeilDollar)
        const roundedPrice = Math.ceil(decoratedPrice);
        
        console.log('[CapQuotePricingCalculator] 🔍 DETAILED BREAKDOWN:');
        console.log('  🔍 Base cap cost: $' + baseCapPrice.toFixed(2));
        console.log('  🔍 Cap selling price (÷margin): $' + capSellingPrice.toFixed(2));
        console.log('  🔍 Front embroidery: $' + frontEmbroideryPrice.toFixed(2));
        console.log('  🔍 Additional embroidery: $' + additionalEmbroideryPrice.toFixed(2) + ' (NOT included in base price)');
        console.log('  🔍 Base decorated price (cap + front only): $' + decoratedPrice.toFixed(2));
        console.log('  🔍 Final rounded base price: $' + roundedPrice.toFixed(2));
        
        // Return detailed breakdown for separate display
        return {
            totalPrice: roundedPrice,
            capPrice: capSellingPrice,
            frontEmbroideryPrice: frontEmbroideryPrice,
            frontLogoBreakdown: frontLogoPricing.breakdown,
            additionalEmbroideryPrice: additionalEmbroideryPrice,
            additionalLogoPrices: additionalLogoPrices // Individual logo pricing details with breakdown
        };
    }
    
    /**
     * Calculate price for a single logo with detailed breakdown
     */
    calculateLogoPrice(logo, totalQuantity, pricingType) {
        if (!logo) return { totalPrice: 0, breakdown: null };
        
        console.log(`[CapQuotePricingCalculator] 🔍 Calculating ${pricingType} logo price for:`, logo.position);
        console.log(`[CapQuotePricingCalculator] 🔍 Logo stitches:`, logo.stitchCount);
        
        const pricingSource = this.pricingData[pricingType];
        if (!pricingSource) {
            throw new Error(`Pricing source not available: ${pricingType}`);
        }
        
        // Get the tier for this quantity
        const tierData = this.getTierData(totalQuantity, pricingSource);
        const embroideryData = this.getEmbroideryData(totalQuantity, pricingSource);
        
        console.log(`[CapQuotePricingCalculator] 🔍 Tier data:`, tierData);
        console.log(`[CapQuotePricingCalculator] 🔍 Embroidery data:`, embroideryData);
        
        if (!tierData || !embroideryData) {
            throw new Error(`Pricing data not found for quantity ${totalQuantity} in ${pricingType}`);
        }
        
        // Base embroidery cost (this is already a selling price)
        const baseEmbroideryPrice = embroideryData.EmbroideryCost;
        console.log(`[CapQuotePricingCalculator] 🔍 Base embroidery cost (selling price):`, baseEmbroideryPrice);
        
        // Calculate cost for additional stitches
        const baseStitchCount = embroideryData.BaseStitchCount || (pricingType === 'primary' ? 8000 : 5000);
        const additionalStitchRate = embroideryData.AdditionalStitchRate || 1.0;
        
        console.log(`[CapQuotePricingCalculator] 🔍 Base stitch count:`, baseStitchCount);
        console.log(`[CapQuotePricingCalculator] 🔍 Additional stitch rate:`, additionalStitchRate);
        
        let additionalStitchCost = 0;
        let extraStitches = 0;
        
        if (logo.stitchCount > baseStitchCount) {
            extraStitches = logo.stitchCount - baseStitchCount;
            additionalStitchCost = Math.ceil(extraStitches / 1000) * additionalStitchRate;
            
            console.log(`[CapQuotePricingCalculator] 🔍 ${logo.position} extra stitches:`, 
                       extraStitches, '@ $' + additionalStitchRate, '= $' + additionalStitchCost.toFixed(2));
        }
        
        const logoPrice = baseEmbroideryPrice + additionalStitchCost;
        
        // Note: LTM fee is handled separately as a line item, not per logo
        // This prevents double-charging the LTM fee
        
        console.log(`[CapQuotePricingCalculator] 🔍 FINAL ${logo.position} (${pricingType}) price:`, 
                   '$' + logoPrice.toFixed(2));
        
        // Return detailed breakdown
        const breakdown = {
            basePrice: baseEmbroideryPrice,
            extraStitchCost: additionalStitchCost,
            extraStitches: extraStitches,
            baseStitchCount: baseStitchCount,
            hasExtraStitches: extraStitches > 0
        };
        
        return {
            totalPrice: logoPrice,
            breakdown: breakdown
        };
    }
    
    /**
     * Apply size-specific pricing and upcharges
     */
    applySizePricing(product, baseDecoratedPrice, ltmPerUnit = 0) {
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
                ltmPerUnit: ltmPerUnit, // NEW: Store for summary display
                total: total
            });
        }

        return sizePricedItems;
    }
    
    /**
     * Get tier data for quantity
     */
    getTierData(quantity, pricingSource) {
        const tier = pricingSource.tiersR.find(tier => 
            quantity >= tier.MinQuantity && quantity <= tier.MaxQuantity
        );
        
        // Handle missing 1-23 tier by creating synthetic tier data (should not be needed after API fix)
        if (!tier && quantity < 24) {
            console.log('[CapQuotePricingCalculator] Creating synthetic 1-23 tier (API should provide this now)');
            return {
                TierLabel: '1-23',
                MinQuantity: 1,
                MaxQuantity: 23,
                MarginDenominator: this.getMarginDenominatorFromAPI(quantity),
                TargetMargin: 0,
                LTM_Fee: this.getLTMFeeFromAPI(quantity)
            };
        }
        
        return tier;
    }
    
    /**
     * Get LTM fee from API data based on quantity
     */
    getLTMFeeFromAPI(quantity) {
        if (!this.pricingData.primary?.tiersR) {
            console.warn('[CapQuotePricingCalculator] No tier data available for LTM fee');
            return quantity < 24 ? 50 : 0; // Fallback
        }
        
        const tier = this.pricingData.primary.tiersR.find(t => {
            // Parse tier label (e.g., "1-23", "24-47", "72+")
            if (t.TierLabel.includes('+')) {
                const min = parseInt(t.TierLabel.replace('+', ''));
                return quantity >= min;
            } else if (t.TierLabel.includes('-')) {
                const [min, max] = t.TierLabel.split('-').map(n => parseInt(n));
                return quantity >= min && quantity <= max;
            }
            return false;
        });
        
        return tier?.LTM_Fee || 0;
    }
    
    /**
     * Get digitizing fee from API data
     */
    getDigitizingFeeFromAPI() {
        if (!this.pricingData.primary?.allEmbroideryCostsR) {
            console.warn('[CapQuotePricingCalculator] No embroidery cost data available for digitizing fee');
            return 100; // Fallback
        }
        
        // Get digitizing fee from first embroidery cost record
        const embroideryData = this.pricingData.primary.allEmbroideryCostsR[0];
        return embroideryData?.DigitizingFee || 100;
    }
    
    /**
     * Get margin denominator from API data based on quantity
     */
    getMarginDenominatorFromAPI(quantity) {
        if (!this.pricingData.primary?.tiersR) {
            console.warn('[CapQuotePricingCalculator] No tier data available for margin denominator');
            return 0.57; // 2026 margin fallback
        }
        
        const tier = this.pricingData.primary.tiersR.find(t => {
            // Parse tier label (e.g., "1-23", "24-47", "72+")
            if (t.TierLabel.includes('+')) {
                const min = parseInt(t.TierLabel.replace('+', ''));
                return quantity >= min;
            } else if (t.TierLabel.includes('-')) {
                const [min, max] = t.TierLabel.split('-').map(n => parseInt(n));
                return quantity >= min && quantity <= max;
            }
            return false;
        });
        
        return tier?.MarginDenominator || 0.57; // 2026 margin fallback
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
            const ltmAmount = this.getLTMFeeFromAPI(result.totalQuantity);
            console.log('🏷️ LTM Fee:', ltmAmount > 0 ? '$' + ltmAmount.toFixed(2) : 'None');
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