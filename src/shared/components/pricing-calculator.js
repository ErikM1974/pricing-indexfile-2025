// PricingCalculator - Reusable pricing calculation component
// Handles all pricing logic for different embellishment types

import { Logger } from '../utils/logger';
import { EventBus } from '../utils/event-bus';

export class PricingCalculator {
  constructor(options = {}) {
    this.logger = new Logger('PricingCalculator');
    this.eventBus = options.eventBus || new EventBus();
    this.embellishmentType = options.embellishmentType || 'generic';
    this.config = this.loadConfig(options.config);
    
    // Pricing data cache
    this.pricingData = null;
    this.tierDefinitions = null;
    this.ltmRules = null;
  }
  
  loadConfig(customConfig = {}) {
    const defaultConfig = {
      ltmThreshold: 24,
      ltmFee: 50.00,
      roundingMethod: 'nearest', // 'up', 'down', 'nearest'
      taxRate: 0,
      currency: 'USD',
      locale: 'en-US'
    };
    
    return { ...defaultConfig, ...customConfig };
  }
  
  // Set pricing data
  setPricingData(data) {
    this.logger.debug('Setting pricing data:', data);
    
    this.pricingData = data.prices || data;
    this.tierDefinitions = data.tierDefinitions || this.extractTierDefinitions(data);
    this.ltmRules = data.ltmRules || this.config;
    
    this.eventBus.emit('pricing:dataLoaded', {
      embellishmentType: this.embellishmentType,
      tiers: this.tierDefinitions
    });
  }
  
  // Extract tier definitions from pricing data
  extractTierDefinitions(data) {
    const tiers = {};
    
    if (data.tierData) {
      return data.tierData;
    }
    
    // Try to extract from price structure
    if (data.prices) {
      const firstSize = Object.keys(data.prices)[0];
      if (firstSize && typeof data.prices[firstSize] === 'object') {
        Object.keys(data.prices[firstSize]).forEach(tierKey => {
          tiers[tierKey] = this.parseTierKey(tierKey);
        });
      }
    }
    
    return tiers;
  }
  
  // Parse tier key (e.g., "24-47" or "72+")
  parseTierKey(tierKey) {
    const rangeMatch = tierKey.match(/^(\d+)\s*-\s*(\d+)$/);
    const plusMatch = tierKey.match(/^(\d+)\s*\+$/);
    
    if (rangeMatch) {
      return {
        key: tierKey,
        minQuantity: parseInt(rangeMatch[1]),
        maxQuantity: parseInt(rangeMatch[2])
      };
    } else if (plusMatch) {
      return {
        key: tierKey,
        minQuantity: parseInt(plusMatch[1]),
        maxQuantity: Infinity
      };
    }
    
    // Default single quantity
    const qty = parseInt(tierKey) || 1;
    return {
      key: tierKey,
      minQuantity: qty,
      maxQuantity: qty
    };
  }
  
  // Calculate pricing for given parameters
  calculate(options = {}) {
    const {
      quantity = 0,
      sizeBreakdown = {},
      additionalOptions = {},
      existingQuantity = 0,
      cumulativePricing = false
    } = options;
    
    this.logger.debug('Calculating price:', options);
    
    if (!this.pricingData) {
      throw new Error('No pricing data loaded');
    }
    
    // Calculate total quantity
    const totalNewQuantity = quantity || Object.values(sizeBreakdown).reduce((sum, qty) => sum + qty, 0);
    const totalQuantity = cumulativePricing ? (totalNewQuantity + existingQuantity) : totalNewQuantity;
    
    // Determine pricing tier
    const tier = this.determineTier(totalQuantity);
    
    // Calculate base pricing
    const pricing = this.calculateBasePricing(sizeBreakdown, tier);
    
    // Apply LTM if needed
    const ltmFee = this.calculateLTMFee(totalQuantity, totalNewQuantity);
    
    // Apply additional options (like back logo, rush, etc.)
    const addOns = this.calculateAddOns(additionalOptions, totalNewQuantity);
    
    // Build result
    const result = {
      quantity: totalNewQuantity,
      totalQuantity: totalQuantity,
      tier: tier,
      basePrice: pricing.total,
      baseUnitPrice: pricing.unitPrice,
      ltmFee: ltmFee,
      ltmPerUnit: totalNewQuantity > 0 ? ltmFee / totalNewQuantity : 0,
      addOns: addOns,
      addOnsTotal: Object.values(addOns).reduce((sum, addon) => sum + addon.total, 0),
      sizePricing: pricing.breakdown,
      subtotal: pricing.total + ltmFee,
      total: pricing.total + ltmFee + Object.values(addOns).reduce((sum, addon) => sum + addon.total, 0)
    };
    
    // Emit pricing calculated event
    this.eventBus.emit('pricing:calculated', result);
    
    return result;
  }
  
  // Determine pricing tier based on quantity
  determineTier(quantity) {
    if (!this.tierDefinitions) {
      return null;
    }
    
    // Find matching tier
    for (const [tierKey, tierDef] of Object.entries(this.tierDefinitions)) {
      if (quantity >= tierDef.minQuantity && 
          (tierDef.maxQuantity === undefined || quantity <= tierDef.maxQuantity)) {
        return tierKey;
      }
    }
    
    // Default to first tier if no match
    return Object.keys(this.tierDefinitions)[0];
  }
  
  // Calculate base pricing for sizes
  calculateBasePricing(sizeBreakdown, tier) {
    const breakdown = {};
    let total = 0;
    let totalQuantity = 0;
    
    Object.entries(sizeBreakdown).forEach(([size, qty]) => {
      if (qty > 0) {
        const price = this.getPriceForSize(size, tier);
        const lineTotal = price * qty;
        
        breakdown[size] = {
          quantity: qty,
          unitPrice: price,
          total: lineTotal
        };
        
        total += lineTotal;
        totalQuantity += qty;
      }
    });
    
    return {
      breakdown,
      total,
      unitPrice: totalQuantity > 0 ? total / totalQuantity : 0
    };
  }
  
  // Get price for specific size and tier
  getPriceForSize(size, tier) {
    if (!this.pricingData) return 0;
    
    // Check direct size pricing
    if (this.pricingData[size] && this.pricingData[size][tier] !== undefined) {
      return parseFloat(this.pricingData[size][tier]);
    }
    
    // Check for "One Size" or "OS"
    if (size === 'OS' || size === 'One Size') {
      const osPrice = this.pricingData['OS'] || this.pricingData['One Size'];
      if (osPrice && osPrice[tier] !== undefined) {
        return parseFloat(osPrice[tier]);
      }
    }
    
    // Check for stitch count + size format (cap embroidery specific)
    const stitchSizeKeys = Object.keys(this.pricingData).filter(key => key.includes('_'));
    for (const key of stitchSizeKeys) {
      if (key.endsWith(`_${size}`)) {
        return parseFloat(this.pricingData[key]) || 0;
      }
    }
    
    this.logger.warn(`No price found for size: ${size}, tier: ${tier}`);
    return 0;
  }
  
  // Calculate LTM fee
  calculateLTMFee(totalQuantity, newQuantity) {
    if (totalQuantity >= this.config.ltmThreshold) {
      return 0; // No LTM fee for quantities at or above threshold
    }
    
    return this.config.ltmFee;
  }
  
  // Calculate add-on pricing
  calculateAddOns(additionalOptions, quantity) {
    const addOns = {};
    
    // Process each add-on
    Object.entries(additionalOptions).forEach(([key, value]) => {
      if (value && this[`calculate${this.capitalize(key)}`]) {
        addOns[key] = this[`calculate${this.capitalize(key)}`](value, quantity);
      }
    });
    
    return addOns;
  }
  
  // Helper to capitalize first letter
  capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
  
  // Format currency
  formatCurrency(amount) {
    return new Intl.NumberFormat(this.config.locale, {
      style: 'currency',
      currency: this.config.currency
    }).format(amount);
  }
  
  // Get next tier information
  getNextTierInfo(currentQuantity) {
    const currentTier = this.determineTier(currentQuantity);
    const tiers = Object.entries(this.tierDefinitions).sort((a, b) => 
      a[1].minQuantity - b[1].minQuantity
    );
    
    const currentIndex = tiers.findIndex(([key]) => key === currentTier);
    if (currentIndex < tiers.length - 1) {
      const nextTier = tiers[currentIndex + 1];
      return {
        tier: nextTier[0],
        minQuantity: nextTier[1].minQuantity,
        quantityNeeded: nextTier[1].minQuantity - currentQuantity
      };
    }
    
    return null;
  }
  
  // Get savings at different quantities
  getQuantitySavings(baseQuantity, targetQuantity, sizeBreakdown) {
    const basePricing = this.calculate({
      quantity: baseQuantity,
      sizeBreakdown
    });
    
    const targetPricing = this.calculate({
      quantity: targetQuantity,
      sizeBreakdown
    });
    
    const savings = (basePricing.total / baseQuantity * targetQuantity) - targetPricing.total;
    const percentSavings = (savings / (basePricing.total / baseQuantity * targetQuantity)) * 100;
    
    return {
      baseUnitPrice: basePricing.total / baseQuantity,
      targetUnitPrice: targetPricing.total / targetQuantity,
      totalSavings: savings,
      percentSavings: percentSavings,
      savingsPerUnit: savings / targetQuantity
    };
  }
}