// API Module Index
// Phase 5: API Consolidation

// Export main API client
export { UnifiedAPIClient, getAPIClient, resetAPIClient, APIError } from './unified-client';

// Export cache manager
export { CacheManager, CacheStrategies, getCacheStrategy } from './cache-manager';

// Export request queue
export { RequestQueue, QueuePriorities, ConflictStrategies } from './request-queue';

// Export interceptors
export { InterceptorChain, commonInterceptors, setupDefaultInterceptors } from './interceptors';

// Export endpoints
export { API_ENDPOINTS, buildUrl, getEndpoint, getEndpointConfig, versionedEndpoint } from './endpoints';

// Export error handling
export * from './errors';

// Initialize API with default configuration
import { getAPIClient } from './unified-client';
import { setupDefaultInterceptors } from './interceptors';
import { Logger } from '../../core/logger';

const logger = new Logger('API');

/**
 * Initialize API module with configuration
 * @param {Object} config - API configuration
 * @returns {UnifiedAPIClient} Configured API client
 */
export function initializeAPI(config = {}) {
  logger.info('Initializing API module', config);
  
  // Get or create API client
  const api = getAPIClient({
    baseURL: config.baseURL || process.env.API_URL || '',
    timeout: config.timeout || 30000,
    headers: {
      'X-Application': 'pricing-calculator',
      'X-Version': '2.0.0',
      ...config.headers
    },
    cache: {
      maxSize: 200,
      defaultTTL: 5 * 60 * 1000, // 5 minutes
      persistent: true,
      ...config.cache
    },
    queue: {
      maxQueueSize: 100,
      syncInterval: 30000, // 30 seconds
      ...config.queue
    },
    ...config
  });
  
  // Setup default interceptors
  setupDefaultInterceptors(api.interceptors, config.interceptors);
  
  // Add custom interceptors if provided
  if (config.customInterceptors) {
    config.customInterceptors.forEach(interceptor => {
      if (interceptor.request) {
        api.interceptors.useRequest(interceptor.request.fulfilled, interceptor.request.rejected);
      }
      if (interceptor.response) {
        api.interceptors.useResponse(interceptor.response.fulfilled, interceptor.response.rejected);
      }
      if (interceptor.error) {
        api.interceptors.useError(interceptor.error);
      }
    });
  }
  
  // Log API ready
  logger.info('API module initialized', {
    baseURL: api.baseURL,
    cacheSize: api.cache.maxSize,
    queueSize: api.queue.maxQueueSize
  });
  
  return api;
}

// Create default instance
const defaultAPI = initializeAPI();

// Export convenience methods
export const { get, post, put, patch, delete: del } = defaultAPI;
export const request = defaultAPI.request.bind(defaultAPI);
export const clearCache = defaultAPI.clearCache.bind(defaultAPI);
export const getCacheStats = defaultAPI.getCacheStats.bind(defaultAPI);
export const getQueueStats = defaultAPI.getQueueStats.bind(defaultAPI);

// Export default instance
export default defaultAPI;