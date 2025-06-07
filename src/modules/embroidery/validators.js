// Embroidery Validators
// Phase 4: Cap Embroidery Modules

import { EMBROIDERY_CONSTANTS, CAP_TYPES } from './constants';

/**
 * Validate embroidery design for production
 * @param {Object} design - Design specifications
 * @returns {Object} Validation result with errors and warnings
 */
export function validateEmbroideryDesign(design) {
  const errors = [];
  const warnings = [];
  const suggestions = [];
  
  const {
    productType = 'cap',
    locations = [],
    stitchCounts = {},
    dimensions = {},
    threadColors = {},
    specialTechniques = []
  } = design;
  
  // Validate locations
  if (locations.length === 0) {
    errors.push('At least one embroidery location must be selected');
  }
  
  // Validate each location
  locations.forEach(location => {
    const locationErrors = validateLocation(location, productType, stitchCounts, dimensions, threadColors);
    errors.push(...locationErrors.errors);
    warnings.push(...locationErrors.warnings);
    suggestions.push(...locationErrors.suggestions);
  });
  
  // Validate special techniques
  specialTechniques.forEach(technique => {
    const techniqueValidation = validateSpecialTechnique(technique, productType);
    warnings.push(...techniqueValidation.warnings);
  });
  
  // Check for design optimization opportunities
  const optimizations = checkOptimizationOpportunities(design);
  suggestions.push(...optimizations);
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    suggestions,
    summary: generateValidationSummary(errors, warnings, suggestions)
  };
}

/**
 * Validate individual location
 * @private
 */
function validateLocation(location, productType, stitchCounts, dimensions, threadColors) {
  const errors = [];
  const warnings = [];
  const suggestions = [];
  
  const stitchCount = stitchCounts[location] || 0;
  const colorCount = threadColors[location] || 1;
  const dimension = dimensions[location] || {};
  
  // Check stitch count
  if (stitchCount === 0) {
    errors.push(`Stitch count required for ${location}`);
  } else if (stitchCount < EMBROIDERY_CONSTANTS.MIN_STITCHES_PER_LOCATION) {
    warnings.push(`${location}: Low stitch count (${stitchCount}). Minimum charge will apply.`);
  } else if (stitchCount > EMBROIDERY_CONSTANTS.MAX_STITCHES_PER_LOCATION) {
    errors.push(`${location}: Stitch count (${stitchCount}) exceeds maximum of ${EMBROIDERY_CONSTANTS.MAX_STITCHES_PER_LOCATION}`);
  }
  
  // Product-specific validation
  if (productType === 'cap') {
    const capValidation = validateCapLocation(location, stitchCount, dimension);
    errors.push(...capValidation.errors);
    warnings.push(...capValidation.warnings);
  }
  
  // Color count validation
  if (colorCount > EMBROIDERY_CONSTANTS.MAX_THREAD_COLORS) {
    errors.push(`${location}: Too many colors (${colorCount}). Maximum is ${EMBROIDERY_CONSTANTS.MAX_THREAD_COLORS}`);
  } else if (colorCount > 8) {
    warnings.push(`${location}: High color count (${colorCount}) will increase production time and cost`);
  }
  
  // Dimension validation
  if (dimension.width && dimension.height) {
    const area = dimension.width * dimension.height;
    if (area > 25) { // 5"x5" max
      warnings.push(`${location}: Large design area may affect quality on curved surfaces`);
    }
  }
  
  return { errors, warnings, suggestions };
}

/**
 * Validate cap-specific location
 * @private
 */
function validateCapLocation(location, stitchCount, dimension) {
  const errors = [];
  const warnings = [];
  
  // Default to structured cap if not specified
  const capType = CAP_TYPES.STRUCTURED;
  
  switch (location) {
    case 'front':
      if (stitchCount > capType.maxFrontStitches) {
        warnings.push(`Front embroidery: ${stitchCount} stitches may cause puckering on cap`);
      }
      if (dimension.height > 2.5) {
        warnings.push('Front embroidery height exceeds recommended 2.5" for caps');
      }
      break;
      
    case 'back':
      if (stitchCount > capType.maxBackStitches) {
        errors.push(`Back embroidery not recommended above ${capType.maxBackStitches} stitches`);
      }
      if (dimension.width > 4) {
        warnings.push('Back embroidery width should not exceed 4" due to cap closure');
      }
      break;
      
    case 'left-side':
    case 'right-side':
      if (stitchCount > capType.maxSideStitches) {
        warnings.push(`Side embroidery: ${stitchCount} stitches may distort cap shape`);
      }
      if (dimension.width > 2 || dimension.height > 2) {
        warnings.push('Side embroidery should stay within 2"x2" for best results');
      }
      break;
  }
  
  return { errors, warnings };
}

/**
 * Validate special embroidery techniques
 * @private
 */
function validateSpecialTechnique(technique, productType) {
  const warnings = [];
  
  const techniqueConfig = EMBROIDERY_CONSTANTS.SPECIAL_TECHNIQUES[technique];
  if (!techniqueConfig) {
    warnings.push(`Unknown special technique: ${technique}`);
    return { warnings };
  }
  
  // Technique-specific validations
  switch (technique) {
    case '3D_PUFF':
      if (productType !== 'cap') {
        warnings.push('3D puff embroidery works best on structured caps');
      }
      break;
      
    case 'METALLIC_THREAD':
      warnings.push('Metallic thread may require slower production and special handling');
      break;
      
    case 'APPLIQUE':
      warnings.push('Applique requires additional materials and setup time');
      break;
  }
  
  return { warnings };
}

/**
 * Check for optimization opportunities
 * @private
 */
function checkOptimizationOpportunities(design) {
  const suggestions = [];
  const { locations, stitchCounts, threadColors } = design;
  
  // Check total stitch count
  const totalStitches = Object.values(stitchCounts).reduce((sum, count) => sum + count, 0);
  if (totalStitches > 20000) {
    suggestions.push('Consider splitting design across multiple items to reduce total stitch count');
  }
  
  // Check for similar locations that could be combined
  if (locations.includes('left-chest') && locations.includes('right-chest')) {
    const leftStitches = stitchCounts['left-chest'] || 0;
    const rightStitches = stitchCounts['right-chest'] || 0;
    
    if (Math.abs(leftStitches - rightStitches) < 500) {
      suggestions.push('Consider using same design for left and right chest to reduce setup time');
    }
  }
  
  // Check for high color counts
  const highColorLocations = Object.entries(threadColors)
    .filter(([location, colors]) => colors > 6)
    .map(([location]) => location);
  
  if (highColorLocations.length > 0) {
    suggestions.push(`Reduce colors in ${highColorLocations.join(', ')} to improve production efficiency`);
  }
  
  return suggestions;
}

/**
 * Generate validation summary
 * @private
 */
function generateValidationSummary(errors, warnings, suggestions) {
  if (errors.length === 0 && warnings.length === 0) {
    return 'Design validated successfully. Ready for production.';
  }
  
  const parts = [];
  
  if (errors.length > 0) {
    parts.push(`${errors.length} error${errors.length > 1 ? 's' : ''} must be fixed`);
  }
  
  if (warnings.length > 0) {
    parts.push(`${warnings.length} warning${warnings.length > 1 ? 's' : ''} to review`);
  }
  
  if (suggestions.length > 0) {
    parts.push(`${suggestions.length} optimization${suggestions.length > 1 ? 's' : ''} available`);
  }
  
  return parts.join(', ');
}

/**
 * Validate file format for embroidery
 * @param {string} filename - Name of the file
 * @param {ArrayBuffer} content - File content
 * @returns {Object} Format validation result
 */
export function validateEmbroideryFile(filename, content) {
  const extension = filename.split('.').pop().toLowerCase();
  const supportedFormats = ['dst', 'pes', 'exp', 'jef', 'vp3', 'xxx', 'sew'];
  
  if (!supportedFormats.includes(extension)) {
    return {
      isValid: false,
      error: `Unsupported file format: .${extension}`,
      suggestion: `Convert to one of: ${supportedFormats.map(f => `.${f}`).join(', ')}`
    };
  }
  
  // Basic file size validation
  if (content.byteLength === 0) {
    return {
      isValid: false,
      error: 'File is empty'
    };
  }
  
  if (content.byteLength > 50 * 1024 * 1024) { // 50MB
    return {
      isValid: false,
      error: 'File too large (max 50MB)',
      suggestion: 'Large files may indicate overly complex designs'
    };
  }
  
  // Format-specific validation could go here
  // For now, just return success
  return {
    isValid: true,
    format: extension.toUpperCase(),
    fileSize: content.byteLength
  };
}