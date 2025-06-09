// Cap Embroidery API Integration Example
// Phase 5: API Consolidation

import { getAPIClient, API_ENDPOINTS, buildUrl } from '../../shared/api';
import { Logger } from '../../core/logger';
import { EventBus } from '../../core/event-bus';

const logger = new Logger('CapEmbroideryAPI');
const eventBus = new EventBus();
const api = getAPIClient();

/**
 * Cap Embroidery API Service
 */
export class CapEmbroideryAPIService {
  constructor() {
    this.setupInterceptors();
    this.setupEventListeners();
  }
  
  /**
   * Setup custom interceptors for cap embroidery
   * @private
   */
  setupInterceptors() {
    // Add embroidery-specific headers
    this.requestInterceptorId = api.interceptors.useRequest((config) => {
      if (config.url.includes('/embellishments/embroidery')) {
        config.headers = {
          ...config.headers,
          'X-Embellishment-Type': 'embroidery',
          'X-Product-Type': 'cap'
        };
      }
      return config;
    });
    
    // Transform embroidery response data
    this.responseInterceptorId = api.interceptors.useResponse((response) => {
      if (response.config.url.includes('/embellishments/embroidery')) {
        // Add calculated fields
        if (response.data.pricing) {
          response.data.pricing.formattedTotal = this.formatCurrency(response.data.pricing.total);
          response.data.pricing.pricePerUnit = response.data.pricing.total / response.data.quantity;
        }
      }
      return response;
    });
  }
  
  /**
   * Setup event listeners
   * @private
   */
  setupEventListeners() {
    // Listen for offline/online events
    eventBus.on('network:offline', () => {
      logger.info('Network offline - embroidery calculations will be queued');
    });
    
    eventBus.on('network:online', () => {
      logger.info('Network online - processing queued embroidery calculations');
    });
    
    // Listen for API events
    eventBus.on('api:success', ({ config, response }) => {
      if (config.url.includes('/embellishments/embroidery')) {
        logger.debug('Embroidery API success', { 
          endpoint: config.url,
          cached: response.cached 
        });
      }
    });
  }
  
  /**
   * Calculate embroidery pricing
   * @param {Object} options - Calculation options
   * @returns {Promise<Object>} Pricing data
   */
  async calculatePricing(options) {
    const {
      productId,
      quantity,
      locations,
      stitchCounts,
      threadColors,
      specialTechniques = []
    } = options;
    
    try {
      const response = await api.post(
        API_ENDPOINTS.EMBELLISHMENTS.EMBROIDERY.CALCULATE,
        {
          productId,
          quantity,
          locations: locations.map(location => ({
            position: location,
            stitchCount: stitchCounts[location] || 0,
            colors: threadColors[location] || 1
          })),
          specialTechniques,
          productType: 'cap'
        },
        {
          cache: true,
          cacheTime: 300000, // 5 minutes
          queueOffline: true
        }
      );
      
      // Emit pricing calculated event
      eventBus.emit('embroidery:pricing-calculated', {
        options,
        pricing: response
      });
      
      return response;
      
    } catch (error) {
      logger.error('Failed to calculate embroidery pricing', error);
      
      // Check if we have cached pricing
      const cacheKey = this.buildCacheKey('pricing', options);
      const cachedPricing = this.getCachedPricing(cacheKey);
      
      if (cachedPricing) {
        logger.info('Using cached pricing due to error');
        return cachedPricing;
      }
      
      throw error;
    }
  }
  
  /**
   * Validate embroidery design
   * @param {Object} design - Design specifications
   * @returns {Promise<Object>} Validation result
   */
  async validateDesign(design) {
    try {
      const response = await api.post(
        API_ENDPOINTS.EMBELLISHMENTS.EMBROIDERY.VALIDATE,
        {
          ...design,
          productType: 'cap'
        },
        {
          cache: false, // Don't cache validation results
          retry: false
        }
      );
      
      return response;
      
    } catch (error) {
      // Perform client-side validation as fallback
      logger.warn('Server validation failed, using client-side validation');
      
      const { validateEmbroideryDesign } = await import('../../modules/embroidery/validators');
      return validateEmbroideryDesign(design);
    }
  }
  
  /**
   * Estimate stitch count from image
   * @param {File} file - Image file
   * @param {Object} options - Estimation options
   * @returns {Promise<Object>} Stitch count estimate
   */
  async estimateStitchCount(file, options = {}) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('width', options.width || 4);
    formData.append('height', options.height || 2.5);
    formData.append('density', options.density || 'medium');
    
    try {
      const response = await api.post(
        API_ENDPOINTS.EMBELLISHMENTS.EMBROIDERY.ESTIMATE_STITCHES,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data'
          },
          cache: true,
          cacheTime: 3600000, // 1 hour
          timeout: 60000 // 1 minute for file processing
        }
      );
      
      return response;
      
    } catch (error) {
      // Fallback to client-side estimation
      logger.warn('Server estimation failed, using client-side estimation');
      
      const { StitchCountEstimator } = await import('../../modules/embroidery/stitch-counter');
      const estimator = new StitchCountEstimator();
      
      // Read file as image
      const img = await this.loadImage(file);
      return estimator.estimateFromImage(img, options);
    }
  }
  
  /**
   * Get pricing matrix for embroidery
   * @returns {Promise<Object>} Pricing matrix
   */
  async getPricingMatrix() {
    try {
      const response = await api.get(
        `${API_ENDPOINTS.PRICING.MATRIX}?type=embroidery&product=cap`,
        {
          cache: true,
          cacheTime: 3600000 // 1 hour
        }
      );
      
      return response;
      
    } catch (error) {
      logger.error('Failed to load pricing matrix', error);
      
      // Return default matrix as fallback
      return this.getDefaultPricingMatrix();
    }
  }
  
  /**
   * Save quote with embroidery details
   * @param {Object} quoteData - Quote data
   * @returns {Promise<Object>} Saved quote
   */
  async saveQuote(quoteData) {
    const quote = {
      ...quoteData,
      type: 'embroidery',
      productType: 'cap',
      embellishmentDetails: {
        locations: quoteData.locations,
        stitchCounts: quoteData.stitchCounts,
        threadColors: quoteData.threadColors,
        specialTechniques: quoteData.specialTechniques,
        designFiles: quoteData.designFiles
      }
    };
    
    try {
      const response = await api.post(
        API_ENDPOINTS.QUOTES.CREATE,
        quote,
        {
          queueOffline: true,
          priority: 'high'
        }
      );
      
      // Emit quote saved event
      eventBus.emit('embroidery:quote-saved', response);
      
      return response;
      
    } catch (error) {
      if (error.status === 0) {
        // Offline - quote was queued
        logger.info('Quote queued for saving when online');
        return {
          queued: true,
          temporaryId: `temp-${Date.now()}`,
          ...quote
        };
      }
      
      throw error;
    }
  }
  
  /**
   * Load saved quotes
   * @param {Object} filters - Query filters
   * @returns {Promise<Array>} List of quotes
   */
  async loadQuotes(filters = {}) {
    const params = {
      type: 'embroidery',
      productType: 'cap',
      ...filters
    };
    
    try {
      const response = await api.get(
        API_ENDPOINTS.QUOTES.LIST,
        {
          params,
          cache: true,
          cacheTime: 60000 // 1 minute
        }
      );
      
      return response.quotes || [];
      
    } catch (error) {
      logger.error('Failed to load quotes', error);
      
      // Return cached quotes if available
      const cachedQuotes = this.getCachedQuotes();
      if (cachedQuotes.length > 0) {
        logger.info('Using cached quotes');
        return cachedQuotes;
      }
      
      return [];
    }
  }
  
  /**
   * Batch calculate pricing for multiple options
   * @param {Array} optionsList - List of pricing options
   * @returns {Promise<Array>} List of pricing results
   */
  async batchCalculatePricing(optionsList) {
    try {
      const response = await api.post(
        API_ENDPOINTS.PRICING.BULK_CALCULATE,
        {
          type: 'embroidery',
          productType: 'cap',
          calculations: optionsList
        },
        {
          cache: true,
          cacheTime: 300000,
          timeout: 60000 // Longer timeout for batch operations
        }
      );
      
      return response.results || [];
      
    } catch (error) {
      // Fall back to individual calculations
      logger.warn('Batch calculation failed, falling back to individual calculations');
      
      const results = [];
      for (const options of optionsList) {
        try {
          const result = await this.calculatePricing(options);
          results.push({ success: true, data: result });
        } catch (calcError) {
          results.push({ success: false, error: calcError.message });
        }
      }
      
      return results;
    }
  }
  
  // Helper methods
  
  /**
   * Format currency
   * @private
   */
  formatCurrency(amount) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  }
  
  /**
   * Build cache key
   * @private
   */
  buildCacheKey(type, data) {
    return `embroidery:${type}:${JSON.stringify(data)}`;
  }
  
  /**
   * Get cached pricing
   * @private
   */
  getCachedPricing(key) {
    try {
      const cached = localStorage.getItem(key);
      if (cached) {
        const data = JSON.parse(cached);
        if (data.expires > Date.now()) {
          return data.pricing;
        }
      }
    } catch (error) {
      logger.error('Failed to get cached pricing', error);
    }
    return null;
  }
  
  /**
   * Get cached quotes
   * @private
   */
  getCachedQuotes() {
    try {
      const cached = localStorage.getItem('embroidery:quotes:cache');
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (error) {
      logger.error('Failed to get cached quotes', error);
    }
    return [];
  }
  
  /**
   * Load image from file
   * @private
   */
  loadImage(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = e.target.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }
  
  /**
   * Get default pricing matrix
   * @private
   */
  getDefaultPricingMatrix() {
    return {
      stitchRanges: [
        { min: 0, max: 7500, price: 5.00 },
        { min: 7501, max: 15000, price: 7.50 },
        { min: 15001, max: 25000, price: 10.00 },
        { min: 25001, max: 50000, price: 15.00 }
      ],
      colorCharges: [
        { colors: 1, charge: 0 },
        { colors: 2, charge: 0.50 },
        { colors: 3, charge: 1.00 },
        { colors: 4, charge: 1.50 }
      ],
      locationMultipliers: {
        front: 1.0,
        back: 1.1,
        'left-side': 1.2,
        'right-side': 1.2
      }
    };
  }
  
  /**
   * Cleanup service
   */
  destroy() {
    // Remove interceptors
    if (this.requestInterceptorId) {
      api.interceptors.ejectRequest(this.requestInterceptorId);
    }
    if (this.responseInterceptorId) {
      api.interceptors.ejectResponse(this.responseInterceptorId);
    }
    
    // Remove event listeners
    eventBus.off('network:offline');
    eventBus.off('network:online');
    eventBus.off('api:success');
  }
}

// Create singleton instance
let serviceInstance = null;

/**
 * Get or create service instance
 * @returns {CapEmbroideryAPIService} Service instance
 */
export function getCapEmbroideryAPIService() {
  if (!serviceInstance) {
    serviceInstance = new CapEmbroideryAPIService();
  }
  return serviceInstance;
}

// Export convenience methods
const service = getCapEmbroideryAPIService();

export const calculatePricing = service.calculatePricing.bind(service);
export const validateDesign = service.validateDesign.bind(service);
export const estimateStitchCount = service.estimateStitchCount.bind(service);
export const saveQuote = service.saveQuote.bind(service);
export const loadQuotes = service.loadQuotes.bind(service);