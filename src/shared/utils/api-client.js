// ApiClient - Centralized API communication with caching and retry logic
// Consolidates multiple API implementations into one robust client

import { Logger } from './logger';

export class ApiClient {
  constructor(options = {}) {
    this.baseUrl = options.baseUrl || 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api';
    this.timeout = options.timeout || 30000;
    this.retries = options.retries || 3;
    this.cache = new Map();
    this.logger = new Logger('ApiClient');
    
    // Request queue to prevent duplicate requests
    this.requestQueue = new Map();
  }
  
  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const cacheKey = this.getCacheKey(url, options);
    
    // Check cache first
    if (options.cache !== false && this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (cached.expires > Date.now()) {
        this.logger.debug('Returning cached response for:', endpoint);
        return cached.data;
      }
      this.cache.delete(cacheKey);
    }
    
    // Check if request is already in progress
    if (this.requestQueue.has(cacheKey)) {
      this.logger.debug('Request already in progress, waiting:', endpoint);
      return this.requestQueue.get(cacheKey);
    }
    
    // Create request promise
    const requestPromise = this.makeRequest(url, options);
    this.requestQueue.set(cacheKey, requestPromise);
    
    try {
      const result = await requestPromise;
      
      // Cache successful responses
      if (options.cache !== false) {
        const cacheDuration = options.cacheDuration || 300000; // 5 minutes default
        this.cache.set(cacheKey, {
          data: result,
          expires: Date.now() + cacheDuration
        });
      }
      
      return result;
    } finally {
      this.requestQueue.delete(cacheKey);
    }
  }
  
  async makeRequest(url, options = {}) {
    const { method = 'GET', data, headers = {}, ...otherOptions } = options;
    
    const requestOptions = {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      },
      ...otherOptions
    };
    
    if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
      requestOptions.body = JSON.stringify(data);
    }
    
    let lastError;
    
    for (let attempt = 1; attempt <= this.retries; attempt++) {
      try {
        this.logger.debug(`Request attempt ${attempt}:`, method, url);
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);
        
        const response = await fetch(url, {
          ...requestOptions,
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          return await response.json();
        }
        
        return await response.text();
        
      } catch (error) {
        lastError = error;
        this.logger.warn(`Request failed (attempt ${attempt}/${this.retries}):`, error.message);
        
        if (attempt < this.retries) {
          // Exponential backoff
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    this.logger.error('All request attempts failed:', lastError);
    throw lastError;
  }
  
  getCacheKey(url, options) {
    const { method = 'GET', data } = options;
    const key = `${method}:${url}`;
    return data ? `${key}:${JSON.stringify(data)}` : key;
  }
  
  // Convenience methods
  async get(endpoint, options = {}) {
    return this.request(endpoint, { ...options, method: 'GET' });
  }
  
  async post(endpoint, data, options = {}) {
    return this.request(endpoint, { ...options, method: 'POST', data });
  }
  
  async put(endpoint, data, options = {}) {
    return this.request(endpoint, { ...options, method: 'PUT', data });
  }
  
  async delete(endpoint, options = {}) {
    return this.request(endpoint, { ...options, method: 'DELETE' });
  }
  
  // Clear cache
  clearCache(pattern = null) {
    if (pattern) {
      for (const key of this.cache.keys()) {
        if (key.includes(pattern)) {
          this.cache.delete(key);
        }
      }
    } else {
      this.cache.clear();
    }
  }
  
  // Preload endpoints
  async preload(endpoints) {
    const promises = endpoints.map(endpoint => 
      this.get(endpoint).catch(error => {
        this.logger.warn('Preload failed for:', endpoint, error);
        return null;
      })
    );
    
    await Promise.all(promises);
  }
}