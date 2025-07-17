/**
 * Adriyella Performance Utilities
 * Optimizations for better performance and user experience
 */

class AdriyellaPerfUtils {
    constructor() {
        this.earningsCache = new Map();
        this.domCache = new Map();
        this.pendingUpdates = new Set();
        this.updateQueue = [];
        this.isProcessingQueue = false;
        
        // Performance tracking
        this.perfMetrics = {
            apiCalls: 0,
            cacheHits: 0,
            domUpdates: 0,
            lastUpdateTime: Date.now()
        };
        
        // Initialize performance monitoring
        this.initPerformanceMonitoring();
    }

    /**
     * Initialize performance monitoring
     */
    initPerformanceMonitoring() {
        if (typeof window !== 'undefined' && window.performance) {
            this.observer = new PerformanceObserver((list) => {
                for (const entry of list.getEntries()) {
                    if (entry.name.includes('adriyella-api')) {
                        console.log(`[PerfUtils] API call ${entry.name} took ${entry.duration.toFixed(2)}ms`);
                    }
                }
            });
            
            try {
                this.observer.observe({ entryTypes: ['measure'] });
            } catch (e) {
                console.log('[PerfUtils] Performance Observer not supported');
            }
        }
    }

    /**
     * Debounced function wrapper with smart caching
     */
    debounce(func, delay = 300, key = null) {
        let timeoutId;
        const cacheKey = key || func.name;
        
        return (...args) => {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(async () => {
                const startTime = performance.now();
                try {
                    const result = await func.apply(this, args);
                    const endTime = performance.now();
                    
                    if (window.performance) {
                        performance.mark(`adriyella-api-${cacheKey}-start`);
                        performance.mark(`adriyella-api-${cacheKey}-end`);
                        performance.measure(`adriyella-api-${cacheKey}`, 
                            `adriyella-api-${cacheKey}-start`, 
                            `adriyella-api-${cacheKey}-end`);
                    }
                    
                    console.log(`[PerfUtils] ${cacheKey} completed in ${(endTime - startTime).toFixed(2)}ms`);
                    return result;
                } catch (error) {
                    console.error(`[PerfUtils] ${cacheKey} failed:`, error);
                    throw error;
                }
            }, delay);
        };
    }

    /**
     * Batch DOM updates using requestAnimationFrame
     */
    batchDOMUpdate(updateFunction, priority = 'normal') {
        return new Promise((resolve) => {
            this.updateQueue.push({ updateFunction, resolve, priority });
            
            if (!this.isProcessingQueue) {
                this.processUpdateQueue();
            }
        });
    }

    /**
     * Process the DOM update queue
     */
    processUpdateQueue() {
        this.isProcessingQueue = true;
        
        requestAnimationFrame(() => {
            const updates = this.updateQueue.splice(0);
            
            // Sort by priority (high priority first)
            updates.sort((a, b) => {
                const priorityOrder = { 'high': 0, 'normal': 1, 'low': 2 };
                return priorityOrder[a.priority] - priorityOrder[b.priority];
            });
            
            const startTime = performance.now();
            
            // Execute all updates in a single frame
            updates.forEach(({ updateFunction, resolve }) => {
                try {
                    updateFunction();
                    this.perfMetrics.domUpdates++;
                    resolve();
                } catch (error) {
                    console.error('[PerfUtils] DOM update failed:', error);
                    resolve(); // Don't block other updates
                }
            });
            
            const endTime = performance.now();
            console.log(`[PerfUtils] Batched ${updates.length} DOM updates in ${(endTime - startTime).toFixed(2)}ms`);
            
            this.isProcessingQueue = false;
            
            // Process any new updates that came in
            if (this.updateQueue.length > 0) {
                this.processUpdateQueue();
            }
        });
    }

    /**
     * Smart cache with TTL and background refresh
     */
    setCacheWithTTL(key, data, ttlMs = 30000) {
        const expiry = Date.now() + ttlMs;
        this.earningsCache.set(key, {
            data: data,
            expiry: expiry,
            created: Date.now()
        });
        
        // Schedule background refresh at 80% of TTL
        setTimeout(() => {
            this.backgroundRefresh(key);
        }, ttlMs * 0.8);
    }

    /**
     * Get cached data with automatic expiry
     */
    getCacheWithTTL(key) {
        const cached = this.earningsCache.get(key);
        if (!cached) {
            return null;
        }
        
        if (Date.now() > cached.expiry) {
            this.earningsCache.delete(key);
            return null;
        }
        
        this.perfMetrics.cacheHits++;
        return cached.data;
    }

    /**
     * Background cache refresh (non-blocking)
     */
    async backgroundRefresh(key) {
        try {
            const cached = this.earningsCache.get(key);
            if (!cached || Date.now() > cached.expiry) {
                return; // Cache already expired or removed
            }
            
            // This would trigger a refresh in the background
            // The specific implementation depends on what's being cached
            console.log(`[PerfUtils] Background refresh triggered for ${key}`);
            
        } catch (error) {
            console.error('[PerfUtils] Background refresh failed:', error);
        }
    }

    /**
     * Optimized DOM element caching
     */
    getElement(id) {
        if (!this.domCache.has(id)) {
            const element = document.getElementById(id);
            if (element) {
                this.domCache.set(id, element);
            }
            return element;
        }
        return this.domCache.get(id);
    }

    /**
     * Clear DOM cache (useful for dynamic content)
     */
    clearDOMCache() {
        this.domCache.clear();
        console.log('[PerfUtils] DOM cache cleared');
    }

    /**
     * Batch API calls with smart retry logic
     */
    async batchApiCall(apiCalls, options = {}) {
        const {
            maxRetries = 3,
            retryDelay = 1000,
            concurrent = 3,
            fallback = null
        } = options;

        this.perfMetrics.apiCalls += apiCalls.length;
        const startTime = performance.now();
        
        try {
            // Process API calls in chunks to avoid overwhelming the server
            const results = [];
            for (let i = 0; i < apiCalls.length; i += concurrent) {
                const chunk = apiCalls.slice(i, i + concurrent);
                const chunkResults = await Promise.allSettled(
                    chunk.map(apiCall => this.retryApiCall(apiCall, maxRetries, retryDelay))
                );
                results.push(...chunkResults);
            }
            
            const endTime = performance.now();
            console.log(`[PerfUtils] Batch API completed ${apiCalls.length} calls in ${(endTime - startTime).toFixed(2)}ms`);
            
            // Process results
            const successful = results.filter(r => r.status === 'fulfilled').map(r => r.value);
            const failed = results.filter(r => r.status === 'rejected').map(r => r.reason);
            
            if (failed.length > 0) {
                console.warn(`[PerfUtils] ${failed.length} API calls failed:`, failed);
                if (fallback && typeof fallback === 'function') {
                    return fallback(successful, failed);
                }
            }
            
            return successful;
            
        } catch (error) {
            console.error('[PerfUtils] Batch API call failed:', error);
            throw error;
        }
    }

    /**
     * Retry logic for individual API calls
     */
    async retryApiCall(apiCall, maxRetries, retryDelay) {
        let lastError;
        
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                return await apiCall();
            } catch (error) {
                lastError = error;
                console.warn(`[PerfUtils] API call attempt ${attempt} failed:`, error.message);
                
                if (attempt < maxRetries) {
                    // Exponential backoff
                    const delay = retryDelay * Math.pow(2, attempt - 1);
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
        }
        
        throw lastError;
    }

    /**
     * Optimistic UI updates
     */
    optimisticUpdate(element, newValue, rollbackValue, savePromise) {
        // Immediately update UI
        this.batchDOMUpdate(() => {
            if (typeof newValue === 'function') {
                newValue(element);
            } else {
                element.textContent = newValue;
            }
        }, 'high');
        
        // Handle the save operation
        savePromise
            .then(() => {
                console.log('[PerfUtils] Optimistic update confirmed');
            })
            .catch((error) => {
                console.error('[PerfUtils] Optimistic update failed, rolling back:', error);
                
                // Rollback UI change
                this.batchDOMUpdate(() => {
                    if (typeof rollbackValue === 'function') {
                        rollbackValue(element);
                    } else {
                        element.textContent = rollbackValue;
                    }
                }, 'high');
            });
    }

    /**
     * Performance metrics
     */
    getMetrics() {
        const uptime = Date.now() - this.perfMetrics.lastUpdateTime;
        return {
            ...this.perfMetrics,
            uptime: uptime,
            cacheHitRatio: this.perfMetrics.cacheHits / Math.max(1, this.perfMetrics.apiCalls),
            averageApiCallsPerMinute: (this.perfMetrics.apiCalls / (uptime / 60000)).toFixed(2)
        };
    }

    /**
     * Reset performance metrics
     */
    resetMetrics() {
        this.perfMetrics = {
            apiCalls: 0,
            cacheHits: 0,
            domUpdates: 0,
            lastUpdateTime: Date.now()
        };
    }
}

// Create global instance
if (typeof window !== 'undefined') {
    window.adriyellaPerfUtils = new AdriyellaPerfUtils();
    console.log('[PerfUtils] Performance utilities loaded');
}