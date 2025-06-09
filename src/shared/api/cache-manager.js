// Cache Manager
// Phase 5: API Consolidation

import { Logger } from '../../core/logger';

/**
 * CacheManager - LRU cache with TTL support
 */
export class CacheManager {
  constructor(options = {}) {
    this.maxSize = options.maxSize || 100;
    this.defaultTTL = options.defaultTTL || 5 * 60 * 1000; // 5 minutes
    this.logger = new Logger('CacheManager');
    
    // Cache storage
    this.cache = new Map();
    this.accessOrder = [];
    
    // Statistics
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
      size: 0
    };
    
    // Persistence
    this.persistent = options.persistent || false;
    this.storageKey = options.storageKey || 'api-cache';
    
    // Clean up expired entries periodically
    this.cleanupInterval = setInterval(() => this.cleanup(), 60000); // Every minute
    
    // Load from storage if persistent
    if (this.persistent) {
      this.loadFromStorage();
    }
  }
  
  /**
   * Get cached value
   * @param {Object} config - Request config used as cache key
   * @returns {Promise<any>} Cached value or null
   */
  async get(config) {
    const key = this.generateKey(config);
    const entry = this.cache.get(key);
    
    if (!entry) {
      this.stats.misses++;
      return null;
    }
    
    // Check if expired
    if (this.isExpired(entry)) {
      this.delete(key);
      this.stats.misses++;
      return null;
    }
    
    // Update access order (LRU)
    this.updateAccessOrder(key);
    
    this.stats.hits++;
    this.logger.debug('Cache hit', { key, age: Date.now() - entry.timestamp });
    
    return entry.value;
  }
  
  /**
   * Set cached value
   * @param {Object} config - Request config used as cache key
   * @param {any} value - Value to cache
   * @param {number} ttl - Time to live in milliseconds
   */
  async set(config, value, ttl = null) {
    const key = this.generateKey(config);
    const expiresAt = Date.now() + (ttl || config.cacheTime || this.defaultTTL);
    
    // Check cache size and evict if necessary
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      this.evictLRU();
    }
    
    const entry = {
      key,
      value,
      timestamp: Date.now(),
      expiresAt,
      size: this.estimateSize(value)
    };
    
    this.cache.set(key, entry);
    this.updateAccessOrder(key);
    this.stats.size = this.cache.size;
    
    this.logger.debug('Cache set', { key, ttl: expiresAt - Date.now() });
    
    // Save to storage if persistent
    if (this.persistent) {
      this.saveToStorage();
    }
  }
  
  /**
   * Delete cached value
   * @param {string} key - Cache key
   */
  delete(key) {
    const deleted = this.cache.delete(key);
    
    if (deleted) {
      this.accessOrder = this.accessOrder.filter(k => k !== key);
      this.stats.size = this.cache.size;
      
      if (this.persistent) {
        this.saveToStorage();
      }
    }
    
    return deleted;
  }
  
  /**
   * Clear all cached values
   */
  async clear() {
    this.cache.clear();
    this.accessOrder = [];
    this.stats.size = 0;
    
    if (this.persistent) {
      try {
        localStorage.removeItem(this.storageKey);
      } catch (error) {
        this.logger.error('Failed to clear storage', error);
      }
    }
    
    this.logger.info('Cache cleared');
  }
  
  /**
   * Generate cache key from config
   * @private
   */
  generateKey(config) {
    const keyParts = [
      config.method,
      config.url,
      JSON.stringify(config.params || {}),
      JSON.stringify(config.body || {})
    ];
    
    return keyParts.join('|');
  }
  
  /**
   * Check if cache entry is expired
   * @private
   */
  isExpired(entry) {
    return Date.now() > entry.expiresAt;
  }
  
  /**
   * Update access order for LRU
   * @private
   */
  updateAccessOrder(key) {
    const index = this.accessOrder.indexOf(key);
    if (index > -1) {
      this.accessOrder.splice(index, 1);
    }
    this.accessOrder.push(key);
  }
  
  /**
   * Evict least recently used entry
   * @private
   */
  evictLRU() {
    if (this.accessOrder.length === 0) return;
    
    const keyToEvict = this.accessOrder.shift();
    this.cache.delete(keyToEvict);
    this.stats.evictions++;
    
    this.logger.debug('Evicted LRU entry', { key: keyToEvict });
  }
  
  /**
   * Clean up expired entries
   * @private
   */
  cleanup() {
    let removed = 0;
    
    for (const [key, entry] of this.cache.entries()) {
      if (this.isExpired(entry)) {
        this.delete(key);
        removed++;
      }
    }
    
    if (removed > 0) {
      this.logger.debug('Cleaned up expired entries', { count: removed });
    }
  }
  
  /**
   * Estimate size of cached value
   * @private
   */
  estimateSize(value) {
    // Rough estimation
    const str = JSON.stringify(value);
    return str.length * 2; // 2 bytes per character
  }
  
  /**
   * Save cache to localStorage
   * @private
   */
  saveToStorage() {
    if (!this.persistent) return;
    
    try {
      const data = {
        entries: Array.from(this.cache.entries()),
        accessOrder: this.accessOrder,
        stats: this.stats
      };
      
      localStorage.setItem(this.storageKey, JSON.stringify(data));
    } catch (error) {
      this.logger.error('Failed to save cache to storage', error);
      
      // If quota exceeded, clear old entries
      if (error.name === 'QuotaExceededError') {
        this.evictLRU();
        this.saveToStorage(); // Retry
      }
    }
  }
  
  /**
   * Load cache from localStorage
   * @private
   */
  loadFromStorage() {
    if (!this.persistent) return;
    
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (!stored) return;
      
      const data = JSON.parse(stored);
      
      // Restore cache entries
      this.cache = new Map(data.entries);
      this.accessOrder = data.accessOrder || [];
      this.stats = { ...this.stats, ...data.stats };
      
      // Clean up expired entries
      this.cleanup();
      
      this.logger.info('Cache loaded from storage', { 
        entries: this.cache.size 
      });
    } catch (error) {
      this.logger.error('Failed to load cache from storage', error);
      this.clear();
    }
  }
  
  /**
   * Get cache statistics
   * @returns {Object} Cache statistics
   */
  getStats() {
    const totalRequests = this.stats.hits + this.stats.misses;
    const hitRate = totalRequests > 0 ? 
      (this.stats.hits / totalRequests * 100).toFixed(2) : 0;
    
    return {
      ...this.stats,
      hitRate: `${hitRate}%`,
      totalSize: this.getTotalSize(),
      oldestEntry: this.getOldestEntry(),
      newestEntry: this.getNewestEntry()
    };
  }
  
  /**
   * Get total cache size in bytes
   * @private
   */
  getTotalSize() {
    let totalSize = 0;
    
    for (const entry of this.cache.values()) {
      totalSize += entry.size || 0;
    }
    
    return totalSize;
  }
  
  /**
   * Get oldest cache entry
   * @private
   */
  getOldestEntry() {
    let oldest = null;
    
    for (const entry of this.cache.values()) {
      if (!oldest || entry.timestamp < oldest.timestamp) {
        oldest = entry;
      }
    }
    
    return oldest ? {
      key: oldest.key,
      age: Date.now() - oldest.timestamp,
      expiresIn: oldest.expiresAt - Date.now()
    } : null;
  }
  
  /**
   * Get newest cache entry
   * @private
   */
  getNewestEntry() {
    let newest = null;
    
    for (const entry of this.cache.values()) {
      if (!newest || entry.timestamp > newest.timestamp) {
        newest = entry;
      }
    }
    
    return newest ? {
      key: newest.key,
      age: Date.now() - newest.timestamp,
      expiresIn: newest.expiresAt - Date.now()
    } : null;
  }
  
  /**
   * Destroy cache manager
   */
  destroy() {
    clearInterval(this.cleanupInterval);
    this.clear();
  }
}

/**
 * Cache strategies
 */
export const CacheStrategies = {
  /**
   * Network first, fallback to cache
   */
  NETWORK_FIRST: {
    name: 'network-first',
    ttl: 5 * 60 * 1000, // 5 minutes
    staleWhileRevalidate: true
  },
  
  /**
   * Cache first, fallback to network
   */
  CACHE_FIRST: {
    name: 'cache-first',
    ttl: 60 * 60 * 1000, // 1 hour
    staleWhileRevalidate: false
  },
  
  /**
   * Network only, no caching
   */
  NETWORK_ONLY: {
    name: 'network-only',
    ttl: 0,
    cache: false
  },
  
  /**
   * Cache only, no network
   */
  CACHE_ONLY: {
    name: 'cache-only',
    ttl: Infinity,
    allowOffline: true
  },
  
  /**
   * Stale while revalidate
   */
  STALE_WHILE_REVALIDATE: {
    name: 'stale-while-revalidate',
    ttl: 30 * 60 * 1000, // 30 minutes
    staleWhileRevalidate: true,
    backgroundRefresh: true
  }
};

/**
 * Get cache strategy by endpoint type
 */
export function getCacheStrategy(endpoint) {
  const strategies = {
    '/api/pricing/matrix': CacheStrategies.CACHE_FIRST,
    '/api/products': CacheStrategies.STALE_WHILE_REVALIDATE,
    '/api/inventory': CacheStrategies.NETWORK_FIRST,
    '/api/quotes': CacheStrategies.NETWORK_ONLY,
    '/api/orders': CacheStrategies.NETWORK_ONLY
  };
  
  // Match by pattern
  for (const [pattern, strategy] of Object.entries(strategies)) {
    if (endpoint.includes(pattern)) {
      return strategy;
    }
  }
  
  // Default strategy
  return CacheStrategies.NETWORK_FIRST;
}