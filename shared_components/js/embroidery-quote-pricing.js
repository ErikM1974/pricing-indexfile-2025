/**
 * Embroidery Quote Pricing Calculator
 * Implements tier logic, LTM distribution, and totals
 */

class EmbroideryPricingCalculator {
    constructor() {
        this.baseURL = 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';
        
        // Tier structure from API verification
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
        
        // Cache for size pricing data
        this.sizePricingCache = {};
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
            console.error('No size pricing data for', product.style);
            return null;
        }
        
        // Use first color's data (or find specific color if needed)
        const priceData = sizePricingData.find(d => d.color === product.color) || sizePricingData[0];
        
        const lineItems = [];
        let lineSubtotal = 0;
        
        // Group sizes by upcharge amount for cleaner display
        const standardSizes = [];
        const upchargeSizes = {};
        
        for (const [size, qty] of Object.entries(product.sizeBreakdown)) {
            const basePrice = priceData.basePrices[size] || 0;
            const upcharge = priceData.sizeUpcharges[size] || 0;
            
            if (upcharge === 0) {
                standardSizes.push({ size, qty, basePrice });
            } else {
                if (!upchargeSizes[upcharge]) {
                    upchargeSizes[upcharge] = [];
                }
                upchargeSizes[upcharge].push({ size, qty, basePrice, upcharge });
            }
        }
        
        // Calculate standard sizes (S-XL typically)
        if (standardSizes.length > 0) {
            let standardQty = 0;
            let avgBasePrice = 0;
            const sizeList = [];
            
            standardSizes.forEach(item => {
                standardQty += item.qty;
                avgBasePrice += item.basePrice * item.qty;
                sizeList.push(`${item.size}(${item.qty})`);
            });
            
            avgBasePrice = avgBasePrice / standardQty;
            
            // Calculate decorated price
            const garmentPrice = avgBasePrice / this.marginDenominator;
            const decoratedPrice = garmentPrice + embCost + additionalStitchCost;
            const finalPrice = Math.ceil(decoratedPrice * 2) / 2; // Round UP to $0.50
            
            lineItems.push({
                description: sizeList.join(' '),
                quantity: standardQty,
                unitPrice: finalPrice,
                total: finalPrice * standardQty
            });
            
            lineSubtotal += finalPrice * standardQty;
        }
        
        // Calculate upcharge sizes (2XL+)
        for (const [upcharge, items] of Object.entries(upchargeSizes)) {
            let upchargeQty = 0;
            let avgBasePrice = 0;
            const sizeList = [];
            
            items.forEach(item => {
                upchargeQty += item.qty;
                avgBasePrice += item.basePrice * item.qty;
                sizeList.push(`${item.size}(${item.qty})`);
            });
            
            avgBasePrice = avgBasePrice / upchargeQty;
            
            // Calculate decorated price with upcharge
            const garmentPrice = avgBasePrice / this.marginDenominator;
            const decoratedPrice = garmentPrice + embCost + additionalStitchCost;
            const upchargeAmount = parseFloat(upcharge);
            const finalPrice = Math.ceil((decoratedPrice + upchargeAmount) * 2) / 2;
            
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
        
        const totalQuantity = products.reduce((sum, p) => sum + p.totalQuantity, 0);
        const tier = this.getTier(totalQuantity);
        
        // Calculate additional stitch cost per piece
        let additionalStitchCost = 0;
        logos.forEach(logo => {
            const extraStitches = Math.max(0, logo.stitchCount - 8000);
            additionalStitchCost += (extraStitches / 1000) * this.additionalStitchRate;
        });
        
        // Calculate each product's pricing
        const productPricing = [];
        let subtotal = 0;
        
        for (const product of products) {
            const pricing = await this.calculateProductPrice(product, totalQuantity, additionalStitchCost);
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
        
        // Calculate setup fees
        const setupFees = logos.filter(l => l.needsDigitizing).length * this.digitizingFee;
        
        // Final totals
        const grandTotal = subtotal + ltmTotal + setupFees;
        
        return {
            products: productPricing,
            totalQuantity: totalQuantity,
            tier: tier,
            embroideryRate: this.getEmbroideryCost(tier),
            additionalStitchCost: additionalStitchCost,
            subtotal: subtotal,
            ltmFee: ltmTotal,
            ltmPerUnit: ltmPerUnit,
            setupFees: setupFees,
            grandTotal: grandTotal,
            logos: logos
        };
    }
    
    /**
     * Format currency
     */
    formatCurrency(amount) {
        return `$${amount.toFixed(2)}`;
    }
    
    /**
     * Round price up to nearest $0.50
     */
    roundUpToHalf(price) {
        return Math.ceil(price * 2) / 2;
    }
}

// Make available globally
window.EmbroideryPricingCalculator = EmbroideryPricingCalculator;