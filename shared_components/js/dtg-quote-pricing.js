/**
 * DTG Quote Pricing Calculator
 * Wrapper around DTGPricingService for quote-specific calculations
 * Handles aggregate pricing, LTM distribution, and quote totals
 *
 * ⚠️ SHARED COMPONENT - USED BY DTG QUOTE BUILDER
 * This file contains critical LTM (Less Than Minimum) fee logic used by:
 * - DTG Quote Builder (/quote-builders/dtg-quote-builder.html)
 *
 * CRITICAL LTM CALCULATION (Lines 41-48):
 * Uses Math.floor() to round DOWN and prevent over-charging customers.
 * Example: $50 ÷ 18 = 2.777... → $2.77 (not $2.78)
 * Result: 18 × $2.77 = $49.86 (14¢ under $50, customer-friendly)
 *
 * NEVER change Math.floor() to Math.round() or Math.ceil() in LTM calculation.
 * This ensures we never accidentally overcharge customers.
 *
 * See CLAUDE.md "DTG Calculator Synchronization" section for testing requirements.
 */

class DTGQuotePricing {
    constructor() {
        // Use existing DTGPricingService for core calculations
        this.pricingService = new window.DTGPricingService();
        
        // Pricing constants
        this.LTM_FEE = 50.00;
        this.LTM_THRESHOLD = 24;
        
        // Cache for loaded pricing data
        this.pricingCache = new Map();
        
        console.log('[DTGQuotePricing] Pricing calculator initialized');
    }
    
    /**
     * Get pricing tier based on aggregate quantity
     */
    getTierForQuantity(quantity) {
        if (quantity < 24) {
            return '24-47'; // Use 24-47 tier with LTM fee
        } else if (quantity < 48) {
            return '24-47';
        } else if (quantity < 72) {
            return '48-71';
        } else {
            return '72+';
        }
    }
    
    /**
     * Calculate LTM fee per unit if applicable
     * IMPORTANT: Round DOWN to prevent over-charging customers
     */
    calculateLTMPerUnit(totalQuantity) {
        if (totalQuantity < this.LTM_THRESHOLD) {
            // Use Math.floor to round DOWN - better to under-charge slightly than over-charge
            // Example: $50 ÷ 11 = $4.545... → $4.54 (not $4.55)
            return Math.floor((this.LTM_FEE / totalQuantity) * 100) / 100;
        }
        return 0;
    }
    
    /**
     * Load pricing data for a product
     */
    async loadProductPricing(styleNumber, color = null) {
        const cacheKey = `${styleNumber}-${color || 'all'}`;
        
        // Check cache first
        if (this.pricingCache.has(cacheKey)) {
            const cached = this.pricingCache.get(cacheKey);
            if (Date.now() - cached.timestamp < 5 * 60 * 1000) { // 5 minute cache
                return cached.data;
            }
        }
        
        try {
            // Fetch pricing data using DTGPricingService
            const data = await this.pricingService.fetchPricingData(styleNumber, color);
            
            // Cache the result
            this.pricingCache.set(cacheKey, {
                data: data,
                timestamp: Date.now()
            });
            
            console.log('[DTGQuotePricing] Loaded pricing for:', styleNumber, color);
            return data;
            
        } catch (error) {
            console.error('[DTGQuotePricing] Error loading pricing:', error);
            throw error;
        }
    }
    
    /**
     * Calculate prices for a product with given quantity and location
     * @param {Object} product - Product data with pricing info
     * @param {string} location - Print location code (e.g., 'LC')
     * @param {Object} sizeQuantities - Object with size quantities {S: 10, M: 10, ...}
     * @param {number} aggregateQuantity - Total quantity across ALL products
     * @returns {Object} Pricing breakdown
     */
    calculateProductPricing(product, location, sizeQuantities, aggregateQuantity) {
        try {
            // Get tier based on aggregate quantity
            const tier = this.getTierForQuantity(aggregateQuantity);
            const ltmPerUnit = this.calculateLTMPerUnit(aggregateQuantity);
// 🔍 DEBUG: Log pricingData structure BEFORE passing to service            console.log('🔍 [DTGQuotePricing] BEFORE calculateAllLocationPrices:', {                productStyleNumber: product.styleNumber,                hasPricingData: !!product.pricingData,                pricingDataType: typeof product.pricingData,                pricingDataKeys: product.pricingData ? Object.keys(product.pricingData) : [],                tiersType: typeof product.pricingData?.tiers,                tiersIsArray: Array.isArray(product.pricingData?.tiers),                tiersLength: product.pricingData?.tiers?.length,                costsLength: product.pricingData?.costs?.length,                sizesLength: product.pricingData?.sizes?.length            });
            
            // Calculate all location prices using DTGPricingService
            const allPrices = this.pricingService.calculateAllLocationPrices(
                product.pricingData,
                aggregateQuantity // Use aggregate for tier determination
            );
            
            // Get prices for selected location
            console.log('[DTGQuotePricing] Looking for location:', location, 'Available:', Object.keys(allPrices));
            const locationPrices = allPrices[location];
            if (!locationPrices) {
                console.error('[DTGQuotePricing] Pricing data structure:', {
                    requestedLocation: location,
                    availableLocations: Object.keys(allPrices),
                    allPricesStructure: allPrices
                });
                throw new Error(`No pricing found for location: ${location}. Available locations: ${Object.keys(allPrices).join(', ')}`);
            }
            
            // Group sizes by price (standard vs upcharge sizes)
            const sizeGroups = this.groupSizesByPrice(sizeQuantities, locationPrices, tier, ltmPerUnit);
            
            // Calculate totals
            let subtotal = 0;
            let totalQuantity = 0;

            console.log(`[DTGQuotePricing] Processing ${sizeGroups.length} size groups for product`);
            sizeGroups.forEach((group, index) => {
                console.log(`  Size Group ${index + 1}:`, {
                    quantity: group.quantity,
                    total: group.total,
                    basePrice: group.basePrice,
                    unitPrice: group.unitPrice
                });
                subtotal += group.total;
                totalQuantity += group.quantity;
            });

            const result = {
                sizeGroups: sizeGroups,
                subtotal: subtotal,
                totalQuantity: totalQuantity,
                tier: tier,
                ltmPerUnit: ltmPerUnit,
                hasLTM: aggregateQuantity < this.LTM_THRESHOLD
            };

            console.log(`[DTGQuotePricing] Product pricing result:`, {
                subtotal: result.subtotal,
                totalQuantity: result.totalQuantity,
                tier: result.tier,
                sizeGroupsCount: result.sizeGroups.length
            });

            return result;
            
        } catch (error) {
            console.error('[DTGQuotePricing] Error calculating product pricing:', error);
            throw error;
        }
    }
    
    /**
     * Group sizes by price for display
     */
    groupSizesByPrice(sizeQuantities, locationPrices, tier, ltmPerUnit) {
        const groups = new Map();

        Object.entries(sizeQuantities).forEach(([size, quantity]) => {
            if (quantity > 0) {
                // Get base price for this size
                // DTGPricingService returns prices nested by tier label
                const tierLabel = typeof tier === 'string' ? tier : tier.TierLabel || tier;
                const basePrice = locationPrices[size]?.[tierLabel] || 0;

                if (basePrice === 'N/A' || basePrice === 0) {
                    console.warn(`[DTGQuotePricing] No price for size ${size}, tier ${tierLabel}`);
                    return;
                }
                
                // Calculate final price with LTM if applicable
                const finalPrice = basePrice + ltmPerUnit;
                
                // Create group key (price determines grouping)
                const groupKey = `${basePrice.toFixed(2)}-${ltmPerUnit.toFixed(2)}`;
                
                if (!groups.has(groupKey)) {
                    groups.set(groupKey, {
                        sizes: {},
                        quantity: 0,
                        basePrice: basePrice,
                        ltmPerUnit: ltmPerUnit,
                        unitPrice: finalPrice,
                        total: 0,
                        sizeRange: this.determineSizeRange(size)
                    });
                }
                
                const group = groups.get(groupKey);
                group.sizes[size] = quantity;
                group.quantity += quantity;
                // Round to 2 decimal places to prevent floating point errors
                group.total = Math.round((group.quantity * finalPrice) * 100) / 100;
            }
        });
        
        // Convert map to array and sort by size range
        const groupArray = Array.from(groups.values());
        groupArray.sort((a, b) => {
            // Sort standard sizes first, then extended sizes
            if (a.sizeRange === 'standard' && b.sizeRange !== 'standard') return -1;
            if (a.sizeRange !== 'standard' && b.sizeRange === 'standard') return 1;
            return a.basePrice - b.basePrice;
        });
        
        return groupArray;
    }
    
    /**
     * Determine if size is standard or extended
     */
    determineSizeRange(size) {
        const standardSizes = ['XS', 'S', 'M', 'L', 'XL'];
        const extendedSizes = ['2XL', 'XXL', '3XL', '4XL', '5XL', '6XL', '2XLT', '3XLT', '4XLT', 'LT', 'XLT'];
        
        if (standardSizes.includes(size)) {
            return 'standard';
        } else if (extendedSizes.includes(size)) {
            return 'extended';
        } else {
            return 'other';
        }
    }
    
    /**
     * Format size group for display
     */
    formatSizeGroup(group) {
        console.log('[DTGQuotePricing] Formatting size group:', {
            sizes: group.sizes,
            quantity: group.quantity,
            basePrice: group.basePrice,
            unitPrice: group.unitPrice,
            total: group.total
        });

        const sizeList = Object.entries(group.sizes)
            .map(([size, qty]) => `${size}(${qty})`)
            .join(' ');

        // Determine display label
        let label = '';
        if (group.sizeRange === 'standard') {
            // Find range of standard sizes
            const sizes = Object.keys(group.sizes);
            const hasSOnly = sizes.length === 1 && sizes[0] === 'S';
            const hasXLOnly = sizes.length === 1 && sizes[0] === 'XL';
            
            if (hasSOnly) {
                label = 'S';
            } else if (hasXLOnly) {
                label = 'XL';
            } else {
                // Find min and max standard sizes
                const standardOrder = ['XS', 'S', 'M', 'L', 'XL'];
                const includedSizes = sizes.filter(s => standardOrder.includes(s));
                if (includedSizes.length > 0) {
                    const minIndex = Math.min(...includedSizes.map(s => standardOrder.indexOf(s)));
                    const maxIndex = Math.max(...includedSizes.map(s => standardOrder.indexOf(s)));
                    label = `${standardOrder[minIndex]}-${standardOrder[maxIndex]}`;
                } else {
                    label = sizeList;
                }
            }
        } else {
            // Extended sizes - list them individually
            label = Object.keys(group.sizes).join(', ');
        }
        
        const formatted = {
            label: label,
            details: sizeList,
            sizes: group.sizes,  // Include original sizes object for detailed breakdown
            quantity: group.quantity,
            basePrice: group.basePrice,
            ltmPerUnit: group.ltmPerUnit,
            unitPrice: group.unitPrice,
            total: group.total
        };

        console.log('[DTGQuotePricing] Formatted size group result:', {
            hasSizes: !!formatted.sizes,
            sizesKeys: formatted.sizes ? Object.keys(formatted.sizes) : [],
            label: formatted.label,
            quantity: formatted.quantity
        });

        return formatted;
    }
    
    /**
     * Calculate quote totals from all products
     */
    calculateQuoteTotals(products, location, aggregateQuantity) {
        let subtotal = 0;
        let totalQuantity = 0;
        const tier = this.getTierForQuantity(aggregateQuantity);
        const ltmPerUnit = this.calculateLTMPerUnit(aggregateQuantity);
        
        // Process each product
        const processedProducts = products.map((product, index) => {
            console.log(`[DTGQuotePricing] Processing product ${index + 1}:`, product.styleNumber);

            const pricing = this.calculateProductPricing(
                product,
                location,
                product.sizeQuantities,
                aggregateQuantity
            );

            console.log(`[DTGQuotePricing] Pricing calculated for ${product.styleNumber}:`, {
                subtotal: pricing.subtotal,
                totalQuantity: pricing.totalQuantity,
                sizeGroupsCount: pricing.sizeGroups?.length
            });

            subtotal += pricing.subtotal;
            totalQuantity += pricing.totalQuantity;

            // Format the product for display - include subtotal at top level
            const formatted = {
                ...product,
                pricing: pricing,
                subtotal: pricing.subtotal,  // Add subtotal at top level for easy access
                quantity: pricing.totalQuantity,
                sizeGroups: pricing.sizeGroups.map(g => this.formatSizeGroup(g))
            };

            console.log(`[DTGQuotePricing] Formatted product ${product.styleNumber}:`, {
                hasSubtotal: formatted.subtotal !== undefined,
                subtotalValue: formatted.subtotal,
                hasSizeGroups: !!formatted.sizeGroups,
                sizeGroupsCount: formatted.sizeGroups?.length
            });

            return formatted;
        });
        
        // Calculate LTM fee if applicable
        const ltmFee = aggregateQuantity < this.LTM_THRESHOLD ? this.LTM_FEE : 0;

        const result = {
            products: processedProducts,
            subtotal: subtotal,
            ltmFee: ltmFee,
            total: subtotal, // LTM is already included in unit prices
            totalQuantity: totalQuantity,
            tier: tier,
            hasLTM: aggregateQuantity < this.LTM_THRESHOLD
        };

        console.log('📊 [DTGQuotePricing] Quote Totals Summary:', {
            productCount: processedProducts.length,
            subtotal: subtotal,
            ltmFee: ltmFee,
            total: result.total,
            totalQuantity: totalQuantity,
            tier: tier,
            hasLTM: result.hasLTM
        });

        // Verify each product has required fields
        processedProducts.forEach((p, i) => {
            if (!p.subtotal) {
                console.error(`❌ Product ${i} missing subtotal:`, p);
            }
            if (!p.sizeGroups || p.sizeGroups.length === 0) {
                console.error(`❌ Product ${i} missing sizeGroups:`, p);
            }
        });

        // 🔍 PRICING VERIFICATION TABLE
        console.log('\n' + '='.repeat(80));
        console.log('💰 DTG PRICING VERIFICATION - Compare with Pricing Page');
        console.log('='.repeat(80));
        processedProducts.forEach((product, index) => {
            console.log(`\n📦 Product ${index + 1}: ${product.styleNumber} - ${product.color}`);
            console.log(`   Location: ${location}`);
            console.log(`   Total Quantity: ${totalQuantity} pieces (Tier: ${tier})`);
            console.log(`   Product Subtotal: $${product.subtotal.toFixed(2)}`);
            console.log('\n   📏 Size Breakdown:');

            // Create verification table
            const verificationData = product.sizeGroups.map(sg => ({
                'Sizes': Object.entries(sg.sizes || {}).map(([s, q]) => `${s}(${q})`).join(', '),
                'Qty': sg.quantity,
                'Base $': sg.basePrice?.toFixed(2) || 'N/A',
                'LTM $': sg.ltmPerUnit > 0 ? sg.ltmPerUnit.toFixed(2) : '-',
                'Unit $': sg.unitPrice?.toFixed(2) || 'N/A',
                'Total $': sg.total?.toFixed(2) || 'N/A'
            }));
            console.table(verificationData);

            console.log(`\n   ✅ Verify on pricing page:`);
            console.log(`      /calculators/dtg-pricing.html?styleNumber=${product.styleNumber}`);
            console.log(`      Select location: ${location}, enter same quantities above`);
        });
        console.log('\n' + '='.repeat(80) + '\n');

        return result;
    }
    
    /**
     * Get location name from code
     */
    getLocationName(locationCode) {
        const locations = {
            'LC': 'Left Chest',
            'FF': 'Full Front',
            'FB': 'Full Back',
            'JF': 'Jumbo Front',
            'JB': 'Jumbo Back',
            'LC_FB': 'Left Chest & Full Back',
            'FF_FB': 'Full Front & Full Back',
            'JF_JB': 'Jumbo Front & Jumbo Back',
            'LC_JB': 'Left Chest & Jumbo Back'
        };
        
        return locations[locationCode] || locationCode;
    }
    
    /**
     * Validate pricing data
     */
    validatePricingData(data) {
        if (!data || !data.tiers || !data.costs || !data.sizes) {
            throw new Error('Invalid pricing data structure');
        }
        
        if (data.tiers.length === 0) {
            throw new Error('No pricing tiers available');
        }
        
        if (data.costs.length === 0) {
            throw new Error('No print costs available');
        }
        
        return true;
    }
    
    /**
     * Clear pricing cache
     */
    clearCache() {
        this.pricingCache.clear();
        this.pricingService.clearCache();
        console.log('[DTGQuotePricing] Cache cleared');
    }
}

// Make available globally
window.DTGQuotePricing = DTGQuotePricing;