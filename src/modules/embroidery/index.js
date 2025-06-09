// Embroidery Module Index
// Phase 4: Cap Embroidery Modules

// Export calculator
export { EmbroideryCalculator } from './calculator';

// Export components
export { DesignUploader } from './components/design-uploader';

// Export utilities
export { StitchCountEstimator, convertMeasurement } from './stitch-counter';

// Export constants
export * from './constants';

// Export validation utilities
export { validateEmbroideryDesign } from './validators';

// Module initialization
import { Logger } from '../../core/logger';

const logger = new Logger('EmbroideryModule');

/**
 * Initialize embroidery module
 * @param {Object} options - Module options
 */
export function initializeEmbroideryModule(options = {}) {
  logger.info('Initializing embroidery module', options);
  
  // Module initialization logic here
  // Could set up global handlers, register components, etc.
  
  return {
    calculator: new EmbroideryCalculator(options.calculator),
    estimator: new StitchCountEstimator(),
    constants: EMBROIDERY_CONSTANTS
  };
}

export default initializeEmbroideryModule;