// Embroidery Calculator Module
// Phase 4: Cap Embroidery Modules

import { PricingCalculator } from '../../shared/components/pricing-calculator';
import { Logger } from '../../core/logger';
import { EMBROIDERY_CONSTANTS } from './constants';
import { StitchCountEstimator } from './stitch-counter';

/**
 * EmbroideryCalculator - Specialized calculator for all embroidery pricing
 * Handles caps, apparel, and other embroidered items
 */
export class EmbroideryCalculator extends PricingCalculator {
  constructor(options = {}) {
    super(options);
    
    this.logger = new Logger('EmbroideryCalculator');
    this.stitchEstimator = new StitchCountEstimator();
    
    // Embroidery specific configuration
    this.config = {
      ...EMBROIDERY_CONSTANTS,
      ...options.config
    };
    
    // Product-specific rates
    this.productRates = {
      cap: {
        setupFee: 40,
        minimumCharge: 7.50,
        perThousandStitches: 1.50,
        maxLocations: 4
      },
      apparel: {
        setupFee: 50,
        minimumCharge: 10.00,
        perThousandStitches: 1.25,
        maxLocations: 6
      },
      bag: {
        setupFee: 45,
        minimumCharge: 8.50,
        perThousandStitches: 1.40,
        maxLocations: 3
      }
    };
    
    // Volume discount tiers
    this.volumeTiers = [
      { min: 1, max: 23, discount: 0, name: 'Standard' },
      { min: 24, max: 47, discount: 0.05, name: 'Small Volume' },
      { min: 48, max: 71, discount: 0.10, name: 'Medium Volume' },
      { min: 72, max: 143, discount: 0.15, name: 'Large Volume' },
      { min: 144, max: 287, discount: 0.20, name: 'Bulk Order' },
      { min: 288, max: Infinity, discount: 0.25, name: 'Wholesale' }
    ];
  }
  
  /**
   * Calculate embroidery pricing
   * @param {number} quantity - Number of items
   * @param {Object} selections - User selections
   * @returns {Object} Detailed pricing breakdown
   */
  calculate(quantity, selections = {}) {
    this.logger.debug('Calculating embroidery price', { quantity, selections });
    
    const {
      productType = 'cap',
      locations = [],
      stitchCounts = {},
      designComplexity = 'standard',
      threadColors = {},
      rushOrder = false
    } = selections;
    
    // Get product-specific rates
    const rates = this.productRates[productType] || this.productRates.cap;
    
    // Calculate base product price
    const basePrice = this.getBaseProductPrice(productType, quantity, selections);
    
    // Calculate embroidery charges
    const embroideryDetails = this.calculateEmbroideryCharges(
      locations,
      stitchCounts,
      threadColors,
      designComplexity,
      rates
    );
    
    // Calculate setup fees
    const setupDetails = this.calculateSetupFees(
      locations,
      quantity,
      designComplexity,
      rates
    );
    
    // Calculate unit price
    const unitPrice = basePrice + embroideryDetails.perUnit;
    
    // Apply volume discounts
    const subtotal = unitPrice * quantity;
    const volumeDiscount = this.calculateVolumeDiscount(subtotal, quantity);
    
    // Apply rush charges if applicable
    const rushCharge = rushOrder ? this.calculateRushCharge(subtotal) : 0;
    
    // Calculate final total
    const totalBeforeFees = subtotal - volumeDiscount.amount + rushCharge;
    const total = totalBeforeFees + setupDetails.total;
    
    // Build comprehensive breakdown
    const breakdown = {
      // Basic info
      quantity,
      productType,
      
      // Base pricing
      basePrice,
      embroideryPerUnit: embroideryDetails.perUnit,
      unitPrice,
      subtotal,
      
      // Discounts and charges
      volumeDiscount,
      rushCharge,
      
      // Setup fees
      setupFees: setupDetails,
      
      // Totals
      totalBeforeFees,
      total,
      
      // Embroidery details
      embroideryDetails: {
        ...embroideryDetails,
        locations: this.getLocationDetails(locations, stitchCounts, threadColors)
      },
      
      // Recommendations
      savingsOpportunity: this.calculateSavingsOpportunity(quantity, total),
      estimatedProductionTime: this.estimateProductionTime(quantity, embroideryDetails.totalStitches)
    };
    
    this.logger.info('Embroidery pricing calculated', breakdown);
    return breakdown;
  }
  
  /**
   * Calculate embroidery charges for all locations
   * @private
   */
  calculateEmbroideryCharges(locations, stitchCounts, threadColors, complexity, rates) {
    let totalStitches = 0;
    let totalThreadChanges = 0;
    let perUnitCharge = 0;
    const locationCharges = {};
    
    locations.forEach(location => {
      const stitches = stitchCounts[location] || 0;
      const colors = threadColors[location] || 1;
      
      totalStitches += stitches;
      totalThreadChanges += Math.max(0, colors - 1);
      
      // Calculate base stitch charge
      let stitchCharge = (stitches / 1000) * rates.perThousandStitches;
      
      // Apply complexity multiplier
      const complexityMultiplier = this.getComplexityMultiplier(complexity);
      stitchCharge *= complexityMultiplier;
      
      // Add thread change charges
      const threadChangeCharge = (colors - 1) * this.config.THREAD_CHANGE_CHARGE;
      
      // Apply minimum charge
      const locationCharge = Math.max(
        stitchCharge + threadChangeCharge,
        rates.minimumCharge
      );
      
      locationCharges[location] = {
        stitches,
        colors,
        stitchCharge,
        threadChangeCharge,
        total: locationCharge
      };
      
      perUnitCharge += locationCharge;
    });
    
    return {
      perUnit: perUnitCharge,
      totalStitches,
      totalThreadChanges,
      locationCharges,
      averageStitchesPerLocation: locations.length > 0 ? Math.round(totalStitches / locations.length) : 0
    };
  }
  
  /**
   * Calculate setup fees
   * @private
   */
  calculateSetupFees(locations, quantity, complexity, rates) {
    const locationSetupFee = locations.length * rates.setupFee;
    
    // Apply complexity surcharge for difficult designs
    const complexitySurcharge = complexity === 'complex' ? 
      locationSetupFee * 0.5 : 
      complexity === 'very-complex' ? 
        locationSetupFee * 1.0 : 
        0;
    
    // Less than minimum fee
    const ltmFee = quantity < this.config.LTM_THRESHOLD ? this.config.LTM_FEE : 0;
    
    // Digitization fee for new designs
    const digitizationFee = this.config.DIGITIZATION_FEE;
    
    return {
      locationSetup: locationSetupFee,
      complexitySurcharge,
      ltmFee,
      digitizationFee,
      total: locationSetupFee + complexitySurcharge + ltmFee + digitizationFee
    };
  }
  
  /**
   * Calculate volume discount
   * @private
   */
  calculateVolumeDiscount(subtotal, quantity) {
    const tier = this.volumeTiers.find(t => quantity >= t.min && quantity <= t.max);
    
    if (!tier || tier.discount === 0) {
      return { amount: 0, percentage: 0, tier: 'Standard' };
    }
    
    return {
      amount: subtotal * tier.discount,
      percentage: tier.discount * 100,
      tier: tier.name
    };
  }
  
  /**
   * Calculate rush charge
   * @private
   */
  calculateRushCharge(subtotal) {
    return subtotal * this.config.RUSH_CHARGE_PERCENTAGE;
  }
  
  /**
   * Get complexity multiplier
   * @private
   */
  getComplexityMultiplier(complexity) {
    const multipliers = {
      simple: 0.9,
      standard: 1.0,
      complex: 1.3,
      'very-complex': 1.6
    };
    
    return multipliers[complexity] || 1.0;
  }
  
  /**
   * Get detailed location information
   * @private
   */
  getLocationDetails(locations, stitchCounts, threadColors) {
    return locations.map(location => ({
      id: location,
      name: this.formatLocationName(location),
      stitchCount: stitchCounts[location] || 0,
      threadColors: threadColors[location] || 1,
      estimatedSize: this.stitchEstimator.estimateSize(stitchCounts[location] || 0)
    }));
  }
  
  /**
   * Format location name for display
   * @private
   */
  formatLocationName(location) {
    const names = {
      front: 'Front Center',
      back: 'Back',
      'left-chest': 'Left Chest',
      'right-chest': 'Right Chest',
      'left-sleeve': 'Left Sleeve',
      'right-sleeve': 'Right Sleeve',
      'left-side': 'Left Side',
      'right-side': 'Right Side'
    };
    
    return names[location] || location;
  }
  
  /**
   * Calculate savings opportunity
   * @private
   */
  calculateSavingsOpportunity(quantity, currentTotal) {
    // Find next volume tier
    const currentTier = this.volumeTiers.find(t => quantity >= t.min && quantity <= t.max);
    const nextTier = this.volumeTiers.find(t => t.min > quantity);
    
    if (!nextTier || !currentTier) {
      return null;
    }
    
    const unitsToNext = nextTier.min - quantity;
    const potentialDiscount = nextTier.discount - currentTier.discount;
    const estimatedSavings = currentTotal * potentialDiscount;
    
    if (unitsToNext <= 20 && estimatedSavings > 10) {
      return {
        message: `Add ${unitsToNext} more items to save ${(potentialDiscount * 100).toFixed(0)}% (approximately $${estimatedSavings.toFixed(2)})`,
        unitsToNext,
        nextTier: nextTier.name,
        estimatedSavings
      };
    }
    
    return null;
  }
  
  /**
   * Estimate production time
   * @private
   */
  estimateProductionTime(quantity, totalStitches) {
    // Base production rates
    const stitchesPerMinute = 800;
    const itemsPerHour = 12; // Including setup/teardown
    
    // Calculate embroidery time
    const embroideryMinutes = (quantity * totalStitches) / stitchesPerMinute;
    const embroideryHours = embroideryMinutes / 60;
    
    // Calculate total production time
    const productionHours = Math.max(embroideryHours, quantity / itemsPerHour);
    
    // Add setup and quality control time
    const totalHours = productionHours + 2; // 2 hours for setup/QC
    
    // Convert to business days (8 hour days)
    const businessDays = Math.ceil(totalHours / 8);
    
    return {
      businessDays,
      rushAvailable: businessDays <= 3,
      standardDelivery: businessDays + 2, // Add shipping
      rushDelivery: Math.ceil(businessDays / 2) + 1
    };
  }
  
  /**
   * Validate embroidery selections
   * @param {Object} selections - User selections
   * @returns {Object} Validation result
   */
  validateSelections(selections) {
    const errors = [];
    const warnings = [];
    const suggestions = [];
    
    const { locations = [], stitchCounts = {}, productType = 'cap' } = selections;
    const rates = this.productRates[productType];
    
    // Check locations
    if (locations.length === 0) {
      errors.push('Please select at least one embroidery location');
    } else if (locations.length > rates.maxLocations) {
      errors.push(`Maximum ${rates.maxLocations} locations allowed for ${productType}`);
    }
    
    // Validate stitch counts
    locations.forEach(location => {
      const stitchCount = stitchCounts[location];
      
      if (!stitchCount || stitchCount === 0) {
        errors.push(`Please enter stitch count for ${this.formatLocationName(location)}`);
      } else if (stitchCount > this.config.MAX_STITCHES_PER_LOCATION) {
        warnings.push(`${this.formatLocationName(location)}: ${stitchCount} stitches is very high. Consider simplifying the design.`);
      } else if (stitchCount < this.config.MIN_STITCHES_PER_LOCATION) {
        warnings.push(`${this.formatLocationName(location)}: ${stitchCount} stitches is very low. Minimum charge will apply.`);
      }
      
      // Provide suggestions based on stitch count
      if (stitchCount > 10000) {
        suggestions.push(`Consider using applique for ${this.formatLocationName(location)} to reduce stitch count and cost`);
      }
    });
    
    // Check quantity
    if (!selections.quantity || selections.quantity < 1) {
      errors.push('Quantity must be at least 1');
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      suggestions
    };
  }
}