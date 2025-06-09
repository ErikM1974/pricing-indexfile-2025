// Cap Embroidery Calculator Component
// Phase 2: Component Architecture

import { PricingCalculator } from '../../shared/components/pricing-calculator';
import { Logger } from '../../core/logger';

export class CapEmbroideryCalculator extends PricingCalculator {
  constructor(options = {}) {
    super(options);
    
    this.logger = new Logger('CapEmbroideryCalculator');
    
    // Embroidery specific rates
    this.embroideryRates = {
      perThousandStitches: options.perThousandStitches || 1.50,
      minimumCharge: options.minimumCharge || 7.50,
      setupFeePerLocation: options.setupFeePerLocation || 40,
      ltmFee: options.ltmFee || 50,
      ltmThreshold: options.ltmThreshold || 24
    };
    
    // Volume discount tiers
    this.volumeDiscounts = [
      { min: 1, max: 23, discount: 0 },
      { min: 24, max: 47, discount: 0.05 },
      { min: 48, max: 71, discount: 0.10 },
      { min: 72, max: 143, discount: 0.15 },
      { min: 144, max: 287, discount: 0.20 },
      { min: 288, max: Infinity, discount: 0.25 }
    ];
  }
  
  /**
   * Calculate total price for cap embroidery
   * @param {number} quantity - Number of items
   * @param {Object} selections - User selections
   * @returns {Object} Pricing breakdown
   */
  calculate(quantity, selections = {}) {
    this.logger.debug('Calculating price', { quantity, selections });
    
    const {
      capType = 'structured',
      color = null,
      locations = [],
      stitchCounts = {}
    } = selections;
    
    // Get base cap price
    const baseCapPrice = this.getBaseCapPrice(capType, quantity);
    
    // Calculate embroidery charges
    const embroideryCharges = this.calculateEmbroideryCharges(locations, stitchCounts, quantity);
    
    // Calculate setup fees
    const setupFees = this.calculateSetupFees(locations, quantity);
    
    // Apply volume discounts
    const subtotal = (baseCapPrice + embroideryCharges.perUnit) * quantity;
    const discount = this.applyVolumeDiscount(subtotal, quantity);
    
    // Calculate final totals
    const totalBeforeFees = subtotal - discount;
    const total = totalBeforeFees + setupFees.total + embroideryCharges.total;
    
    const breakdown = {
      quantity,
      baseCapPrice,
      embroideryPerUnit: embroideryCharges.perUnit,
      unitPrice: baseCapPrice + embroideryCharges.perUnit,
      subtotal,
      discount,
      setupFees: setupFees.total,
      ltmFee: setupFees.ltmFee,
      total,
      locationCount: locations.length,
      totalStitches: embroideryCharges.totalStitches,
      savingsMessage: this.getSavingsMessage(quantity)
    };
    
    this.logger.info('Price calculated', breakdown);
    return breakdown;
  }
  
  /**
   * Get base cap price based on type and quantity
   * @private
   */
  getBaseCapPrice(capType, quantity) {
    // Base prices by cap type
    const basePrices = {
      structured: 8.50,
      unstructured: 7.50,
      trucker: 9.00,
      flexfit: 12.00,
      snapback: 10.00
    };
    
    let price = basePrices[capType] || basePrices.structured;
    
    // Apply quantity-based pricing if available from matrix
    if (this.pricingMatrix && this.pricingMatrix.caps) {
      const tierPrice = this.findPriceInMatrix(this.pricingMatrix.caps, quantity);
      if (tierPrice) {
        price = tierPrice;
      }
    }
    
    return price;
  }
  
  /**
   * Calculate embroidery charges
   * @private
   */
  calculateEmbroideryCharges(locations, stitchCounts, quantity) {
    let totalStitches = 0;
    let perUnitCharge = 0;
    
    locations.forEach(location => {
      const stitches = stitchCounts[location] || 0;
      totalStitches += stitches;
      
      // Calculate charge for this location
      const stitchCharge = (stitches / 1000) * this.embroideryRates.perThousandStitches;
      const locationCharge = Math.max(stitchCharge, this.embroideryRates.minimumCharge);
      
      perUnitCharge += locationCharge;
    });
    
    return {
      perUnit: perUnitCharge,
      total: perUnitCharge * quantity,
      totalStitches
    };
  }
  
  /**
   * Calculate setup fees
   * @private
   */
  calculateSetupFees(locations, quantity) {
    const locationSetupFee = locations.length * this.embroideryRates.setupFeePerLocation;
    const ltmFee = quantity < this.embroideryRates.ltmThreshold ? this.embroideryRates.ltmFee : 0;
    
    return {
      locationSetup: locationSetupFee,
      ltmFee,
      total: locationSetupFee + ltmFee
    };
  }
  
  /**
   * Apply volume discount based on quantity
   * @private
   */
  applyVolumeDiscount(subtotal, quantity) {
    const tier = this.volumeDiscounts.find(t => quantity >= t.min && quantity <= t.max);
    if (tier && tier.discount > 0) {
      return subtotal * tier.discount;
    }
    return 0;
  }
  
  /**
   * Get savings message for quantity optimization
   * @private
   */
  getSavingsMessage(quantity) {
    // Find next tier
    const currentTier = this.volumeDiscounts.find(t => quantity >= t.min && quantity <= t.max);
    const nextTier = this.volumeDiscounts.find(t => t.min > quantity);
    
    if (nextTier && currentTier) {
      const unitsToNext = nextTier.min - quantity;
      if (unitsToNext <= 10) {
        const discountDiff = (nextTier.discount - currentTier.discount) * 100;
        return `Add ${unitsToNext} more caps to save an additional ${discountDiff}%!`;
      }
    }
    
    // Check LTM threshold
    if (quantity < this.embroideryRates.ltmThreshold) {
      const unitsToAvoidLtm = this.embroideryRates.ltmThreshold - quantity;
      return `Add ${unitsToAvoidLtm} more caps to avoid the $${this.embroideryRates.ltmFee} less than minimum fee!`;
    }
    
    return null;
  }
  
  /**
   * Validate selections
   * @param {Object} selections - User selections
   * @returns {Object} Validation result
   */
  validateSelections(selections) {
    const errors = [];
    const warnings = [];
    
    if (!selections.locations || selections.locations.length === 0) {
      errors.push('Please select at least one embroidery location');
    }
    
    if (selections.locations) {
      selections.locations.forEach(location => {
        const stitchCount = selections.stitchCounts?.[location];
        if (!stitchCount || stitchCount === 0) {
          errors.push(`Please enter stitch count for ${location} location`);
        } else if (stitchCount > 15000) {
          warnings.push(`${location} location has high stitch count (${stitchCount}). Consider simplifying the design.`);
        }
      });
    }
    
    if (!selections.quantity || selections.quantity < 1) {
      errors.push('Quantity must be at least 1');
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }
}