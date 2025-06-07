// Stitch Count Estimator
// Phase 4: Cap Embroidery Modules

import { EMBROIDERY_CONSTANTS, STITCH_DENSITY } from './constants';
import { Logger } from '../../core/logger';

/**
 * StitchCountEstimator - Estimates stitch counts based on design properties
 */
export class StitchCountEstimator {
  constructor() {
    this.logger = new Logger('StitchCountEstimator');
  }
  
  /**
   * Estimate stitch count from design dimensions
   * @param {Object} design - Design properties
   * @returns {number} Estimated stitch count
   */
  estimateFromDimensions(design) {
    const {
      width = 0,
      height = 0,
      fillPercentage = 50,
      density = 'STANDARD',
      hasOutline = true,
      outlineThickness = 2
    } = design;
    
    // Calculate area in square inches
    const area = width * height;
    
    // Get density settings
    const densityConfig = STITCH_DENSITY[density] || STITCH_DENSITY.STANDARD;
    const stitchesPerSquareInch = densityConfig.stitchesPerSquareInch;
    
    // Calculate fill stitches
    const fillArea = area * (fillPercentage / 100);
    const fillStitches = fillArea * stitchesPerSquareInch;
    
    // Calculate outline stitches
    let outlineStitches = 0;
    if (hasOutline) {
      const perimeter = 2 * (width + height);
      // Satin stitch outline typically has 100-150 stitches per inch
      outlineStitches = perimeter * 125 * (outlineThickness / 2);
    }
    
    // Total estimate
    const totalStitches = Math.round(fillStitches + outlineStitches);
    
    this.logger.debug('Stitch count estimated from dimensions', {
      design,
      area,
      fillStitches,
      outlineStitches,
      totalStitches
    });
    
    return totalStitches;
  }
  
  /**
   * Estimate stitch count from text
   * @param {Object} textDesign - Text design properties
   * @returns {number} Estimated stitch count
   */
  estimateFromText(textDesign) {
    const {
      text = '',
      fontSize = 0.5, // inches
      fontStyle = 'block',
      isBold = false
    } = textDesign;
    
    // Remove spaces for character count
    const characterCount = text.replace(/\s/g, '').length;
    
    // Base stitches per character by font style
    const baseStitches = {
      block: 200,
      script: 150,
      serif: 180,
      sansSerif: 160
    };
    
    let stitchesPerChar = baseStitches[fontStyle] || baseStitches.block;
    
    // Adjust for font size (0.5" is baseline)
    const sizeMultiplier = fontSize / 0.5;
    stitchesPerChar *= sizeMultiplier;
    
    // Adjust for bold
    if (isBold) {
      stitchesPerChar *= 1.3;
    }
    
    const totalStitches = Math.round(characterCount * stitchesPerChar);
    
    this.logger.debug('Stitch count estimated from text', {
      textDesign,
      characterCount,
      stitchesPerChar,
      totalStitches
    });
    
    return totalStitches;
  }
  
  /**
   * Estimate stitch count from image complexity
   * @param {Object} imageDesign - Image design properties
   * @returns {number} Estimated stitch count
   */
  estimateFromImage(imageDesign) {
    const {
      width = 3,
      height = 3,
      complexity = 'medium',
      colorCount = 3
    } = imageDesign;
    
    // Base calculation from dimensions
    const baseStitches = this.estimateFromDimensions({
      width,
      height,
      fillPercentage: 70,
      density: 'STANDARD'
    });
    
    // Complexity multipliers
    const complexityMultipliers = {
      simple: 0.7,    // Simple shapes, minimal detail
      medium: 1.0,    // Standard logos
      complex: 1.4,   // Detailed designs
      photorealistic: 2.0  // Photo-quality
    };
    
    // Color transition overhead (more colors = more trims and starts)
    const colorOverhead = (colorCount - 1) * 200;
    
    const totalStitches = Math.round(
      (baseStitches * (complexityMultipliers[complexity] || 1.0)) + colorOverhead
    );
    
    this.logger.debug('Stitch count estimated from image', {
      imageDesign,
      baseStitches,
      colorOverhead,
      totalStitches
    });
    
    return totalStitches;
  }
  
  /**
   * Estimate design size from stitch count
   * @param {number} stitchCount - Number of stitches
   * @returns {Object} Estimated dimensions
   */
  estimateSize(stitchCount) {
    // Find appropriate size category
    let sizeCategory = 'MEDIUM';
    
    for (const [category, config] of Object.entries(EMBROIDERY_CONSTANTS.SIZE_ESTIMATES)) {
      if (stitchCount <= config.max) {
        sizeCategory = category;
        break;
      }
    }
    
    const size = EMBROIDERY_CONSTANTS.SIZE_ESTIMATES[sizeCategory];
    
    return {
      category: sizeCategory,
      width: size.width,
      height: size.height,
      displaySize: `${size.width}" × ${size.height}"`
    };
  }
  
  /**
   * Validate stitch count for specific product and location
   * @param {number} stitchCount - Number of stitches
   * @param {string} productType - Type of product
   * @param {string} location - Embroidery location
   * @returns {Object} Validation result
   */
  validateStitchCount(stitchCount, productType, location) {
    const warnings = [];
    const errors = [];
    
    // Check absolute limits
    if (stitchCount < EMBROIDERY_CONSTANTS.MIN_STITCHES_PER_LOCATION) {
      warnings.push(`Stitch count is very low. Minimum charge will apply.`);
    }
    
    if (stitchCount > EMBROIDERY_CONSTANTS.MAX_STITCHES_PER_LOCATION) {
      errors.push(`Stitch count exceeds maximum of ${EMBROIDERY_CONSTANTS.MAX_STITCHES_PER_LOCATION}`);
    }
    
    // Check optimal range
    const { min, max } = EMBROIDERY_CONSTANTS.OPTIMAL_STITCH_RANGE;
    if (stitchCount < min || stitchCount > max) {
      warnings.push(`Stitch count outside optimal range (${min}-${max}). Consider design adjustments.`);
    }
    
    // Product-specific validation
    if (productType === 'cap') {
      const capLimits = {
        front: 12000,
        back: 8000,
        'left-side': 5000,
        'right-side': 5000
      };
      
      const limit = capLimits[location];
      if (limit && stitchCount > limit) {
        warnings.push(`High stitch count for cap ${location}. May affect quality.`);
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }
  
  /**
   * Get production time estimate
   * @param {number} stitchCount - Number of stitches
   * @param {number} quantity - Number of items
   * @returns {Object} Time estimates
   */
  estimateProductionTime(stitchCount, quantity) {
    const stitchesPerMinute = EMBROIDERY_CONSTANTS.STITCHES_PER_MINUTE;
    
    // Time per item
    const stitchTimeMinutes = stitchCount / stitchesPerMinute;
    const setupTimeMinutes = 2; // Hooping and positioning
    const trimTimeMinutes = 1; // Trimming and quality check
    
    const totalTimePerItem = stitchTimeMinutes + setupTimeMinutes + trimTimeMinutes;
    
    // Total production time
    const totalMinutes = totalTimePerItem * quantity;
    const totalHours = totalMinutes / 60;
    
    // Machine capacity (assuming multiple heads)
    const headsPerMachine = 6;
    const machineHours = totalHours / headsPerMachine;
    
    return {
      perItem: {
        stitchTime: stitchTimeMinutes,
        setupTime: setupTimeMinutes,
        totalMinutes: totalTimePerItem
      },
      total: {
        minutes: totalMinutes,
        hours: totalHours,
        machineHours: machineHours,
        businessDays: Math.ceil(machineHours / 8)
      }
    };
  }
  
  /**
   * Suggest optimizations for high stitch counts
   * @param {number} stitchCount - Current stitch count
   * @param {Object} design - Design properties
   * @returns {Array} Optimization suggestions
   */
  suggestOptimizations(stitchCount, design = {}) {
    const suggestions = [];
    
    if (stitchCount > 10000) {
      suggestions.push({
        type: 'reduce-density',
        description: 'Reduce fill density to 80% for similar appearance with fewer stitches',
        potentialReduction: '20%'
      });
      
      suggestions.push({
        type: 'use-applique',
        description: 'Use applique for large filled areas',
        potentialReduction: '40-60%'
      });
    }
    
    if (stitchCount > 8000 && design.hasGradients) {
      suggestions.push({
        type: 'simplify-gradients',
        description: 'Simplify color gradients to reduce color changes',
        potentialReduction: '15%'
      });
    }
    
    if (design.hasSmallText && stitchCount > 5000) {
      suggestions.push({
        type: 'increase-text-size',
        description: 'Increase minimum text size to 0.25" for better quality and fewer stitches',
        potentialReduction: '10%'
      });
    }
    
    if (design.colorCount > 8) {
      suggestions.push({
        type: 'reduce-colors',
        description: 'Reduce color count to minimize thread changes',
        potentialReduction: '5-10%'
      });
    }
    
    return suggestions;
  }
}

/**
 * Utility function to convert between measurement units
 */
export function convertMeasurement(value, fromUnit, toUnit) {
  const conversions = {
    'mm-to-inch': value / 25.4,
    'inch-to-mm': value * 25.4,
    'cm-to-inch': value / 2.54,
    'inch-to-cm': value * 2.54
  };
  
  const key = `${fromUnit}-to-${toUnit}`;
  return conversions[key] || value;
}