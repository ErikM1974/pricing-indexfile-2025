// API Error Handling Utilities
// Phase 5: API Consolidation

import { Logger } from '../../core/logger';

const logger = new Logger('APIErrors');

/**
 * Enhanced API Error class with additional context
 */
export class APIError extends Error {
  constructor(status, statusText, data = {}, config = {}) {
    const message = data.message || statusText || 'API Error';
    super(message);
    
    this.name = 'APIError';
    this.status = status;
    this.statusText = statusText;
    this.data = data;
    this.config = config;
    this.timestamp = new Date();
    
    // Capture stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, APIError);
    }
  }
  
  /**
   * Check if error is network-related
   */
  isNetworkError() {
    return this.status === 0 || !this.status;
  }
  
  /**
   * Check if error is client error (4xx)
   */
  isClientError() {
    return this.status >= 400 && this.status < 500;
  }
  
  /**
   * Check if error is server error (5xx)
   */
  isServerError() {
    return this.status >= 500 && this.status < 600;
  }
  
  /**
   * Check if error is retryable
   */
  isRetryable() {
    return this.isNetworkError() || this.isServerError() || this.status === 429;
  }
  
  /**
   * Get user-friendly error message
   */
  getUserMessage() {
    // Custom user messages for common errors
    const userMessages = {
      0: 'Unable to connect. Please check your internet connection.',
      400: 'Invalid request. Please check your input.',
      401: 'Please log in to continue.',
      403: 'You don\'t have permission to perform this action.',
      404: 'The requested resource was not found.',
      409: 'This action conflicts with existing data.',
      422: 'The provided data is invalid.',
      429: 'Too many requests. Please slow down.',
      500: 'Server error. Please try again later.',
      502: 'Server is temporarily unavailable.',
      503: 'Service is currently unavailable.',
      504: 'Request timed out. Please try again.'
    };
    
    return userMessages[this.status] || this.message;
  }
  
  /**
   * Convert to plain object
   */
  toObject() {
    return {
      name: this.name,
      message: this.message,
      status: this.status,
      statusText: this.statusText,
      data: this.data,
      timestamp: this.timestamp,
      stack: this.stack
    };
  }
}

/**
 * Validation Error for form/data validation
 */
export class ValidationError extends APIError {
  constructor(errors = {}, message = 'Validation failed') {
    super(422, 'Validation Error', { message, errors });
    this.name = 'ValidationError';
    this.errors = errors;
  }
  
  /**
   * Get error for specific field
   */
  getFieldError(field) {
    return this.errors[field] || null;
  }
  
  /**
   * Get all field errors as array
   */
  getFieldErrors() {
    return Object.entries(this.errors).map(([field, error]) => ({
      field,
      message: Array.isArray(error) ? error[0] : error
    }));
  }
}

/**
 * Network Error for connection issues
 */
export class NetworkError extends APIError {
  constructor(message = 'Network connection failed') {
    super(0, 'Network Error', { message });
    this.name = 'NetworkError';
  }
}

/**
 * Timeout Error for request timeouts
 */
export class TimeoutError extends APIError {
  constructor(timeout, url) {
    const message = `Request timed out after ${timeout}ms`;
    super(408, 'Request Timeout', { message, timeout, url });
    this.name = 'TimeoutError';
    this.timeout = timeout;
  }
}

/**
 * Rate Limit Error
 */
export class RateLimitError extends APIError {
  constructor(retryAfter, limit, remaining) {
    const message = `Rate limit exceeded. Retry after ${retryAfter} seconds.`;
    super(429, 'Too Many Requests', { message, retryAfter, limit, remaining });
    this.name = 'RateLimitError';
    this.retryAfter = retryAfter;
    this.limit = limit;
    this.remaining = remaining;
  }
}

/**
 * Error handler factory
 */
export const errorHandlers = {
  /**
   * Global error handler
   */
  global: (error) => {
    logger.error('Global API error', error.toObject ? error.toObject() : error);
    
    // Show user notification
    if (window.showNotification) {
      window.showNotification({
        type: 'error',
        message: error.getUserMessage ? error.getUserMessage() : error.message,
        duration: 5000
      });
    }
    
    // Report to error tracking service
    if (window.Sentry) {
      window.Sentry.captureException(error);
    }
  },
  
  /**
   * Validation error handler
   */
  validation: (error) => {
    if (!(error instanceof ValidationError)) return;
    
    const fieldErrors = error.getFieldErrors();
    
    // Highlight form fields with errors
    fieldErrors.forEach(({ field, message }) => {
      const element = document.querySelector(`[name="${field}"]`);
      if (element) {
        element.classList.add('error');
        
        // Show field-specific error
        const errorElement = element.parentElement.querySelector('.field-error');
        if (errorElement) {
          errorElement.textContent = message;
          errorElement.style.display = 'block';
        }
      }
    });
  },
  
  /**
   * Network error handler
   */
  network: (error) => {
    if (!error.isNetworkError()) return;
    
    // Show offline indicator
    const indicator = document.getElementById('offline-indicator');
    if (indicator) {
      indicator.style.display = 'block';
    }
    
    // Queue for retry if configured
    if (error.config?.queueOffline) {
      logger.info('Request queued for offline retry', {
        url: error.config.url
      });
    }
  },
  
  /**
   * Auth error handler
   */
  auth: (error) => {
    if (error.status !== 401) return;
    
    // Clear auth state
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user');
    
    // Redirect to login with return URL
    const returnUrl = encodeURIComponent(window.location.pathname + window.location.search);
    window.location.href = `/login?return=${returnUrl}`;
  }
};

/**
 * Create error from response
 * @param {Response} response - Fetch response
 * @param {Object} config - Request config
 * @returns {Promise<APIError>} API error
 */
export async function createErrorFromResponse(response, config = {}) {
  let data = {};
  
  try {
    // Try to parse error response
    const contentType = response.headers.get('content-type') || '';
    
    if (contentType.includes('application/json')) {
      data = await response.json();
    } else if (contentType.includes('text/')) {
      data = { message: await response.text() };
    }
  } catch (e) {
    // Failed to parse error response
    logger.warn('Failed to parse error response', e);
  }
  
  // Create appropriate error type
  if (response.status === 422 && data.errors) {
    return new ValidationError(data.errors, data.message);
  }
  
  if (response.status === 429) {
    const retryAfter = response.headers.get('retry-after');
    const limit = response.headers.get('x-ratelimit-limit');
    const remaining = response.headers.get('x-ratelimit-remaining');
    
    return new RateLimitError(
      retryAfter ? parseInt(retryAfter) : 60,
      limit ? parseInt(limit) : null,
      remaining ? parseInt(remaining) : 0
    );
  }
  
  return new APIError(response.status, response.statusText, data, config);
}

/**
 * Handle error with appropriate handler
 * @param {Error} error - Error to handle
 */
export function handleAPIError(error) {
  // Apply specific handlers
  errorHandlers.validation(error);
  errorHandlers.network(error);
  errorHandlers.auth(error);
  
  // Apply global handler
  errorHandlers.global(error);
  
  // Re-throw for caller to handle
  throw error;
}

/**
 * Retry helper with exponential backoff
 * @param {Function} fn - Function to retry
 * @param {Object} options - Retry options
 * @returns {Promise} Result of function
 */
export async function retryWithBackoff(fn, options = {}) {
  const {
    maxRetries = 3,
    initialDelay = 1000,
    maxDelay = 10000,
    factor = 2,
    shouldRetry = (error) => error.isRetryable && error.isRetryable()
  } = options;
  
  let lastError;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      if (attempt === maxRetries || !shouldRetry(error)) {
        throw error;
      }
      
      const delay = Math.min(initialDelay * Math.pow(factor, attempt), maxDelay);
      
      logger.info(`Retrying after ${delay}ms (attempt ${attempt + 1}/${maxRetries})`);
      
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
}