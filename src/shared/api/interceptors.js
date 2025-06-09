// API Interceptors
// Phase 5: API Consolidation

import { Logger } from '../../core/logger';

/**
 * InterceptorChain - Manages request/response interceptors
 */
export class InterceptorChain {
  constructor() {
    this.logger = new Logger('InterceptorChain');
    this.requestInterceptors = [];
    this.responseInterceptors = [];
    this.errorInterceptors = [];
  }
  
  /**
   * Add request interceptor
   * @param {Function} fulfilled - Success handler
   * @param {Function} rejected - Error handler
   * @returns {number} Interceptor ID for removal
   */
  useRequest(fulfilled, rejected) {
    const interceptor = {
      id: Date.now() + Math.random(),
      fulfilled,
      rejected
    };
    
    this.requestInterceptors.push(interceptor);
    return interceptor.id;
  }
  
  /**
   * Add response interceptor
   * @param {Function} fulfilled - Success handler
   * @param {Function} rejected - Error handler
   * @returns {number} Interceptor ID for removal
   */
  useResponse(fulfilled, rejected) {
    const interceptor = {
      id: Date.now() + Math.random(),
      fulfilled,
      rejected
    };
    
    this.responseInterceptors.push(interceptor);
    return interceptor.id;
  }
  
  /**
   * Add error interceptor
   * @param {Function} handler - Error handler
   * @returns {number} Interceptor ID for removal
   */
  useError(handler) {
    const interceptor = {
      id: Date.now() + Math.random(),
      handler
    };
    
    this.errorInterceptors.push(interceptor);
    return interceptor.id;
  }
  
  /**
   * Remove request interceptor
   * @param {number} id - Interceptor ID
   */
  ejectRequest(id) {
    this.requestInterceptors = this.requestInterceptors.filter(i => i.id !== id);
  }
  
  /**
   * Remove response interceptor
   * @param {number} id - Interceptor ID
   */
  ejectResponse(id) {
    this.responseInterceptors = this.responseInterceptors.filter(i => i.id !== id);
  }
  
  /**
   * Remove error interceptor
   * @param {number} id - Interceptor ID
   */
  ejectError(id) {
    this.errorInterceptors = this.errorInterceptors.filter(i => i.id !== id);
  }
  
  /**
   * Apply request interceptors
   * @param {Object} config - Request config
   * @returns {Promise<Object>} Modified config
   */
  async applyRequestInterceptors(config) {
    let currentConfig = config;
    
    for (const interceptor of this.requestInterceptors) {
      try {
        if (interceptor.fulfilled) {
          currentConfig = await interceptor.fulfilled(currentConfig);
        }
      } catch (error) {
        if (interceptor.rejected) {
          currentConfig = await interceptor.rejected(error);
        } else {
          throw error;
        }
      }
    }
    
    return currentConfig;
  }
  
  /**
   * Apply response interceptors
   * @param {Object} response - Response object
   * @returns {Promise<Object>} Modified response
   */
  async applyResponseInterceptors(response) {
    let currentResponse = response;
    
    for (const interceptor of this.responseInterceptors) {
      try {
        if (interceptor.fulfilled) {
          currentResponse = await interceptor.fulfilled(currentResponse);
        }
      } catch (error) {
        if (interceptor.rejected) {
          currentResponse = await interceptor.rejected(error);
        } else {
          throw error;
        }
      }
    }
    
    return currentResponse;
  }
  
  /**
   * Apply error interceptors
   * @param {Error} error - Error object
   * @returns {Promise<Error>} Modified error
   */
  async applyErrorInterceptors(error) {
    let currentError = error;
    
    for (const interceptor of this.errorInterceptors) {
      try {
        currentError = await interceptor.handler(currentError);
      } catch (e) {
        // If error handler fails, use the new error
        currentError = e;
      }
    }
    
    return currentError;
  }
}

/**
 * Common interceptors
 */
export const commonInterceptors = {
  /**
   * Add authentication headers
   */
  auth: {
    request: (config) => {
      const token = localStorage.getItem('auth_token');
      if (token) {
        config.headers = {
          ...config.headers,
          'Authorization': `Bearer ${token}`
        };
      }
      return config;
    }
  },
  
  /**
   * Add CSRF token
   */
  csrf: {
    request: (config) => {
      if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(config.method)) {
        const csrfToken = document.querySelector('meta[name="csrf-token"]')?.content;
        if (csrfToken) {
          config.headers = {
            ...config.headers,
            'X-CSRF-Token': csrfToken
          };
        }
      }
      return config;
    }
  },
  
  /**
   * Log requests in development
   */
  logger: {
    request: (config) => {
      if (process.env.NODE_ENV === 'development') {
        console.log('API Request:', {
          method: config.method,
          url: config.url,
          data: config.body
        });
      }
      return config;
    },
    response: (response) => {
      if (process.env.NODE_ENV === 'development') {
        console.log('API Response:', {
          status: response.status,
          url: response.config.url,
          data: response.data
        });
      }
      return response;
    }
  },
  
  /**
   * Handle 401 errors globally
   */
  authError: {
    error: (error) => {
      if (error.status === 401) {
        // Clear auth token
        localStorage.removeItem('auth_token');
        
        // Redirect to login
        window.location.href = '/login?return=' + encodeURIComponent(window.location.pathname);
      }
      return Promise.reject(error);
    }
  },
  
  /**
   * Retry failed requests
   */
  retry: {
    error: async (error) => {
      const config = error.config;
      
      // Only retry on network errors or 5xx
      if (!config || !config.retry || config.__retryCount >= (config.maxRetries || 3)) {
        return Promise.reject(error);
      }
      
      config.__retryCount = (config.__retryCount || 0) + 1;
      
      // Exponential backoff
      const delay = Math.min(1000 * Math.pow(2, config.__retryCount - 1), 10000);
      await new Promise(resolve => setTimeout(resolve, delay));
      
      // Retry the request
      const { getAPIClient } = await import('./unified-client');
      const api = getAPIClient();
      return api.request(config);
    }
  },
  
  /**
   * Transform snake_case to camelCase
   */
  camelCase: {
    response: (response) => {
      if (response.data && typeof response.data === 'object') {
        response.data = transformKeys(response.data, snakeToCamel);
      }
      return response;
    },
    request: (config) => {
      if (config.body && typeof config.body === 'object') {
        config.body = transformKeys(config.body, camelToSnake);
      }
      return config;
    }
  },
  
  /**
   * Add request timing
   */
  timing: {
    request: (config) => {
      config.__startTime = performance.now();
      return config;
    },
    response: (response) => {
      if (response.config.__startTime) {
        const duration = performance.now() - response.config.__startTime;
        response.timing = {
          duration: Math.round(duration),
          slow: duration > 1000
        };
      }
      return response;
    }
  },
  
  /**
   * Handle rate limiting
   */
  rateLimit: {
    response: (response) => {
      // Check for rate limit headers
      const remaining = response.headers['x-ratelimit-remaining'];
      const reset = response.headers['x-ratelimit-reset'];
      
      if (remaining !== undefined && parseInt(remaining) < 10) {
        console.warn('API rate limit approaching:', {
          remaining,
          reset: reset ? new Date(parseInt(reset) * 1000) : null
        });
      }
      
      return response;
    },
    error: async (error) => {
      if (error.status === 429) {
        const retryAfter = error.headers?.['retry-after'];
        const delay = retryAfter ? parseInt(retryAfter) * 1000 : 60000;
        
        console.warn(`Rate limited. Retrying after ${delay}ms`);
        
        await new Promise(resolve => setTimeout(resolve, delay));
        
        // Retry the request
        const { getAPIClient } = await import('./unified-client');
        const api = getAPIClient();
        return api.request(error.config);
      }
      
      return Promise.reject(error);
    }
  }
};

/**
 * Helper function to transform object keys
 * @private
 */
function transformKeys(obj, transformer) {
  if (Array.isArray(obj)) {
    return obj.map(item => transformKeys(item, transformer));
  }
  
  if (obj !== null && typeof obj === 'object' && obj.constructor === Object) {
    return Object.keys(obj).reduce((acc, key) => {
      const transformedKey = transformer(key);
      acc[transformedKey] = transformKeys(obj[key], transformer);
      return acc;
    }, {});
  }
  
  return obj;
}

/**
 * Convert snake_case to camelCase
 * @private
 */
function snakeToCamel(str) {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

/**
 * Convert camelCase to snake_case
 * @private
 */
function camelToSnake(str) {
  return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
}

/**
 * Setup default interceptors
 * @param {InterceptorChain} interceptors - Interceptor chain instance
 * @param {Object} options - Configuration options
 */
export function setupDefaultInterceptors(interceptors, options = {}) {
  const defaults = {
    auth: true,
    csrf: true,
    logger: process.env.NODE_ENV === 'development',
    authError: true,
    timing: true,
    rateLimit: true,
    ...options
  };
  
  // Add enabled interceptors
  Object.entries(defaults).forEach(([name, enabled]) => {
    if (enabled && commonInterceptors[name]) {
      const interceptor = commonInterceptors[name];
      
      if (interceptor.request) {
        interceptors.useRequest(interceptor.request);
      }
      
      if (interceptor.response) {
        interceptors.useResponse(interceptor.response);
      }
      
      if (interceptor.error) {
        interceptors.useError(interceptor.error);
      }
    }
  });
}