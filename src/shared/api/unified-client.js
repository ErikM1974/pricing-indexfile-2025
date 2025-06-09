// Unified API Client
// Phase 5: API Consolidation

import { Logger } from '../../core/logger';
import { EventBus } from '../../core/event-bus';
import { CacheManager } from './cache-manager';
import { RequestQueue } from './request-queue';
import { InterceptorChain } from './interceptors';
import { API_ENDPOINTS } from './endpoints';

/**
 * UnifiedAPIClient - Centralized API communication with caching and offline support
 */
export class UnifiedAPIClient {
  constructor(options = {}) {
    this.baseURL = options.baseURL || '';
    this.timeout = options.timeout || 30000;
    this.logger = new Logger('UnifiedAPIClient');
    this.eventBus = options.eventBus || new EventBus();
    
    // Initialize subsystems
    this.cache = new CacheManager(options.cache);
    this.queue = new RequestQueue(options.queue);
    this.interceptors = new InterceptorChain();
    
    // Default headers
    this.defaultHeaders = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...options.headers
    };
    
    // Network status
    this.isOnline = navigator.onLine;
    this.setupNetworkListeners();
    
    // Request tracking
    this.activeRequests = new Map();
    this.requestIdCounter = 0;
  }
  
  /**
   * Make an API request
   * @param {Object} config - Request configuration
   * @returns {Promise} Response data
   */
  async request(config) {
    const requestId = ++this.requestIdCounter;
    const startTime = performance.now();
    
    // Build full configuration
    const fullConfig = this.buildConfig(config);
    
    // Create request context
    const context = {
      requestId,
      config: fullConfig,
      startTime,
      retryCount: 0,
      cached: false
    };
    
    try {
      // Check cache first
      if (this.shouldUseCache(fullConfig)) {
        const cachedResponse = await this.cache.get(fullConfig);
        if (cachedResponse) {
          this.logger.debug('Cache hit', { url: fullConfig.url });
          context.cached = true;
          return this.handleResponse(cachedResponse, context);
        }
      }
      
      // Check if offline
      if (!this.isOnline && !fullConfig.allowOffline) {
        return this.handleOfflineRequest(fullConfig, context);
      }
      
      // Apply request interceptors
      const interceptedConfig = await this.interceptors.applyRequestInterceptors(fullConfig);
      
      // Make the request
      const response = await this.executeRequest(interceptedConfig, context);
      
      // Handle successful response
      return this.handleResponse(response, context);
      
    } catch (error) {
      // Handle error
      return this.handleError(error, context);
    } finally {
      // Clean up
      this.activeRequests.delete(requestId);
      
      // Log performance
      const duration = performance.now() - startTime;
      this.logRequestMetrics(context, duration);
    }
  }
  
  /**
   * Execute the actual HTTP request
   * @private
   */
  async executeRequest(config, context) {
    const { url, method, headers, body, timeout } = config;
    
    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    // Store active request
    this.activeRequests.set(context.requestId, { config, controller });
    
    try {
      const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
        credentials: config.credentials || 'same-origin'
      });
      
      clearTimeout(timeoutId);
      
      // Parse response
      const data = await this.parseResponse(response);
      
      // Check response status
      if (!response.ok) {
        throw new APIError(response.status, response.statusText, data);
      }
      
      // Build response object
      const apiResponse = {
        data,
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        config
      };
      
      // Cache successful responses
      if (this.shouldCacheResponse(config, apiResponse)) {
        await this.cache.set(config, apiResponse);
      }
      
      return apiResponse;
      
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error.name === 'AbortError') {
        throw new APIError(408, 'Request Timeout', { message: 'Request timed out' });
      }
      
      throw error;
    }
  }
  
  /**
   * Parse response based on content type
   * @private
   */
  async parseResponse(response) {
    const contentType = response.headers.get('content-type') || '';
    
    if (contentType.includes('application/json')) {
      return response.json();
    } else if (contentType.includes('text/')) {
      return response.text();
    } else if (contentType.includes('application/octet-stream')) {
      return response.blob();
    } else {
      // Default to JSON
      try {
        return await response.json();
      } catch {
        return await response.text();
      }
    }
  }
  
  /**
   * Handle successful response
   * @private
   */
  async handleResponse(response, context) {
    // Apply response interceptors
    const interceptedResponse = await this.interceptors.applyResponseInterceptors(response);
    
    // Emit success event
    this.eventBus.emit('api:success', {
      config: context.config,
      response: interceptedResponse,
      cached: context.cached,
      duration: performance.now() - context.startTime
    });
    
    return interceptedResponse.data;
  }
  
  /**
   * Handle request error
   * @private
   */
  async handleError(error, context) {
    const { config, retryCount } = context;
    
    // Check if we should retry
    if (this.shouldRetry(error, context)) {
      context.retryCount++;
      this.logger.info('Retrying request', { 
        url: config.url, 
        attempt: context.retryCount 
      });
      
      // Exponential backoff
      const delay = Math.min(1000 * Math.pow(2, retryCount), 10000);
      await this.wait(delay);
      
      return this.request(config);
    }
    
    // Apply error interceptors
    const interceptedError = await this.interceptors.applyErrorInterceptors(error);
    
    // Emit error event
    this.eventBus.emit('api:error', {
      config: context.config,
      error: interceptedError,
      duration: performance.now() - context.startTime
    });
    
    throw interceptedError;
  }
  
  /**
   * Handle offline request
   * @private
   */
  async handleOfflineRequest(config, context) {
    if (config.queueOffline) {
      // Add to queue for later
      await this.queue.add(config);
      
      this.logger.info('Request queued for offline sync', { url: config.url });
      
      return {
        queued: true,
        message: 'Request queued for when connection is restored'
      };
    }
    
    throw new APIError(0, 'Network Offline', { 
      message: 'No internet connection' 
    });
  }
  
  /**
   * Build full request configuration
   * @private
   */
  buildConfig(config) {
    const url = this.buildURL(config.url, config.params);
    
    return {
      ...config,
      url,
      method: (config.method || 'GET').toUpperCase(),
      headers: {
        ...this.defaultHeaders,
        ...config.headers
      },
      timeout: config.timeout || this.timeout,
      cache: config.cache !== false,
      cacheTime: config.cacheTime || 300000, // 5 minutes default
      retry: config.retry !== false,
      maxRetries: config.maxRetries || 3,
      queueOffline: config.queueOffline !== false
    };
  }
  
  /**
   * Build full URL with parameters
   * @private
   */
  buildURL(url, params) {
    // Handle relative URLs
    const fullURL = url.startsWith('http') ? url : this.baseURL + url;
    
    if (!params || Object.keys(params).length === 0) {
      return fullURL;
    }
    
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== null && value !== undefined) {
        searchParams.append(key, value);
      }
    });
    
    return `${fullURL}?${searchParams.toString()}`;
  }
  
  /**
   * Check if request should use cache
   * @private
   */
  shouldUseCache(config) {
    return config.cache && 
           config.method === 'GET' && 
           !config.params?.nocache;
  }
  
  /**
   * Check if response should be cached
   * @private
   */
  shouldCacheResponse(config, response) {
    return config.cache && 
           config.method === 'GET' && 
           response.status >= 200 && 
           response.status < 300;
  }
  
  /**
   * Check if request should be retried
   * @private
   */
  shouldRetry(error, context) {
    const { config, retryCount } = context;
    
    if (!config.retry || retryCount >= config.maxRetries) {
      return false;
    }
    
    // Retry on network errors or 5xx errors
    if (error instanceof APIError) {
      return error.status >= 500 || error.status === 0;
    }
    
    return true;
  }
  
  /**
   * Setup network status listeners
   * @private
   */
  setupNetworkListeners() {
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.logger.info('Network online');
      this.eventBus.emit('network:online');
      
      // Process queued requests
      this.queue.processQueue();
    });
    
    window.addEventListener('offline', () => {
      this.isOnline = false;
      this.logger.info('Network offline');
      this.eventBus.emit('network:offline');
    });
  }
  
  /**
   * Log request metrics
   * @private
   */
  logRequestMetrics(context, duration) {
    const metrics = {
      url: context.config.url,
      method: context.config.method,
      duration: Math.round(duration),
      cached: context.cached,
      retries: context.retryCount
    };
    
    this.logger.debug('Request completed', metrics);
    
    // Emit metrics event
    this.eventBus.emit('api:metrics', metrics);
  }
  
  /**
   * Wait for specified milliseconds
   * @private
   */
  wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  // Convenience methods
  
  /**
   * GET request
   */
  get(url, config = {}) {
    return this.request({ ...config, url, method: 'GET' });
  }
  
  /**
   * POST request
   */
  post(url, data, config = {}) {
    return this.request({ ...config, url, method: 'POST', body: data });
  }
  
  /**
   * PUT request
   */
  put(url, data, config = {}) {
    return this.request({ ...config, url, method: 'PUT', body: data });
  }
  
  /**
   * PATCH request
   */
  patch(url, data, config = {}) {
    return this.request({ ...config, url, method: 'PATCH', body: data });
  }
  
  /**
   * DELETE request
   */
  delete(url, config = {}) {
    return this.request({ ...config, url, method: 'DELETE' });
  }
  
  /**
   * Cancel active requests
   */
  cancelAll() {
    this.activeRequests.forEach(({ controller }) => {
      controller.abort();
    });
    this.activeRequests.clear();
  }
  
  /**
   * Clear cache
   */
  clearCache() {
    return this.cache.clear();
  }
  
  /**
   * Get cache statistics
   */
  getCacheStats() {
    return this.cache.getStats();
  }
  
  /**
   * Get queue statistics
   */
  getQueueStats() {
    return this.queue.getStats();
  }
}

/**
 * Custom API Error class
 */
export class APIError extends Error {
  constructor(status, statusText, data = {}) {
    super(data.message || statusText);
    this.name = 'APIError';
    this.status = status;
    this.statusText = statusText;
    this.data = data;
  }
}

// Create singleton instance
let apiInstance = null;

/**
 * Get or create API client instance
 * @param {Object} options - Client options
 * @returns {UnifiedAPIClient} API client instance
 */
export function getAPIClient(options = {}) {
  if (!apiInstance) {
    apiInstance = new UnifiedAPIClient(options);
  }
  return apiInstance;
}

/**
 * Reset API client instance (for testing)
 */
export function resetAPIClient() {
  if (apiInstance) {
    apiInstance.cancelAll();
  }
  apiInstance = null;
}