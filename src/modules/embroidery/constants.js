// Embroidery Constants
// Phase 4: Cap Embroidery Modules

/**
 * Central configuration for all embroidery calculations
 */
export const EMBROIDERY_CONSTANTS = {
  // Stitch count limits
  MIN_STITCHES_PER_LOCATION: 500,
  MAX_STITCHES_PER_LOCATION: 15000,
  OPTIMAL_STITCH_RANGE: { min: 3000, max: 8000 },
  
  // Pricing thresholds
  LTM_THRESHOLD: 24, // Less than minimum
  LTM_FEE: 50,
  
  // Thread and color charges
  THREAD_CHANGE_CHARGE: 0.50, // Per color change
  MAX_THREAD_COLORS: 15,
  
  // Rush order
  RUSH_CHARGE_PERCENTAGE: 0.25, // 25% rush charge
  
  // Digitization
  DIGITIZATION_FEE: 0, // Often waived or charged separately
  DIGITIZATION_RUSH_FEE: 75,
  
  // Production rates
  STITCHES_PER_MINUTE: 800,
  ITEMS_PER_HOUR: 12,
  
  // Size estimates (in inches)
  SIZE_ESTIMATES: {
    TINY: { max: 2000, width: 2, height: 2 },
    SMALL: { max: 5000, width: 3, height: 3 },
    MEDIUM: { max: 10000, width: 4, height: 4 },
    LARGE: { max: 15000, width: 5, height: 5 },
    XLARGE: { max: Infinity, width: 6, height: 6 }
  },
  
  // Common locations
  LOCATIONS: {
    CAPS: ['front', 'back', 'left-side', 'right-side'],
    APPAREL: [
      'left-chest', 'right-chest', 'center-chest',
      'back', 'left-sleeve', 'right-sleeve'
    ],
    BAGS: ['front', 'side', 'flap']
  },
  
  // Design complexity factors
  COMPLEXITY_FACTORS: {
    TEXT_ONLY: 0.8,
    SIMPLE_LOGO: 1.0,
    DETAILED_LOGO: 1.3,
    PHOTOREALISTIC: 1.8
  },
  
  // Special techniques
  SPECIAL_TECHNIQUES: {
    '3D_PUFF': { multiplier: 1.5, setupFee: 25 },
    'METALLIC_THREAD': { multiplier: 1.3, setupFee: 15 },
    'APPLIQUE': { multiplier: 0.7, setupFee: 30 },
    'CHENILLE': { multiplier: 2.0, setupFee: 50 }
  }
};

/**
 * Location display names
 */
export const LOCATION_NAMES = {
  // Caps
  'front': 'Front Center',
  'back': 'Back',
  'left-side': 'Left Side',
  'right-side': 'Right Side',
  
  // Apparel
  'left-chest': 'Left Chest',
  'right-chest': 'Right Chest',
  'center-chest': 'Center Chest',
  'full-chest': 'Full Chest',
  'left-sleeve': 'Left Sleeve',
  'right-sleeve': 'Right Sleeve',
  'upper-back': 'Upper Back',
  'lower-back': 'Lower Back',
  'full-back': 'Full Back',
  
  // Specialty
  'collar': 'Collar',
  'cuff': 'Cuff',
  'pocket': 'Pocket',
  'hem': 'Hem'
};

/**
 * Stitch density recommendations
 */
export const STITCH_DENSITY = {
  LIGHT: {
    name: 'Light Fill',
    stitchesPerSquareInch: 800,
    description: 'For delicate fabrics or subtle designs'
  },
  STANDARD: {
    name: 'Standard Fill',
    stitchesPerSquareInch: 1200,
    description: 'Recommended for most applications'
  },
  HEAVY: {
    name: 'Heavy Fill',
    stitchesPerSquareInch: 1600,
    description: 'For bold, high-impact designs'
  }
};

/**
 * Thread types and properties
 */
export const THREAD_TYPES = {
  POLYESTER: {
    name: 'Polyester',
    sheen: 'High',
    durability: 'Excellent',
    costMultiplier: 1.0
  },
  RAYON: {
    name: 'Rayon',
    sheen: 'Very High',
    durability: 'Good',
    costMultiplier: 1.1
  },
  COTTON: {
    name: 'Cotton',
    sheen: 'Matte',
    durability: 'Good',
    costMultiplier: 1.2
  },
  METALLIC: {
    name: 'Metallic',
    sheen: 'Metallic',
    durability: 'Fair',
    costMultiplier: 1.5
  }
};

/**
 * Common cap types and their properties
 */
export const CAP_TYPES = {
  STRUCTURED: {
    name: 'Structured',
    difficulty: 1.0,
    maxFrontStitches: 12000,
    maxBackStitches: 8000,
    maxSideStitches: 5000
  },
  UNSTRUCTURED: {
    name: 'Unstructured',
    difficulty: 1.2,
    maxFrontStitches: 10000,
    maxBackStitches: 6000,
    maxSideStitches: 4000
  },
  TRUCKER: {
    name: 'Trucker',
    difficulty: 1.1,
    maxFrontStitches: 10000,
    maxBackStitches: 0, // Mesh back
    maxSideStitches: 4000
  },
  BEANIE: {
    name: 'Beanie',
    difficulty: 1.3,
    maxFrontStitches: 8000,
    maxBackStitches: 8000,
    maxSideStitches: 6000
  }
};

/**
 * Quality control standards
 */
export const QUALITY_STANDARDS = {
  REGISTRATION_TOLERANCE: 0.125, // inches
  THREAD_TRIM_LENGTH: 0.25, // inches
  BACKING_OVERLAP: 0.5, // inches
  MIN_STITCH_LENGTH: 2.0, // mm
  MAX_STITCH_LENGTH: 12.0, // mm
  PULL_COMPENSATION: 0.2 // percentage
};