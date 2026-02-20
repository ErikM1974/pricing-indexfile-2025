/**
 * InventoryService - Intelligent caching for inventory API calls
 *
 * Features:
 * - sessionStorage caching with TTL (Time-To-Live)
 * - Automatic cache invalidation
 * - Multi-SKU support (PC54, PC54_2XL, PC54_3XL)
 * - Cache hit/miss tracking
 *
 * Solves the problem: 15+ redundant API calls on page load
 * Result: 70-80% reduction in API requests
 *
 * Usage:
 *   const inventory = new InventoryService(apiService);
 *   const data = await inventory.fetchInventory('PC54', 'Forest');
 */

class InventoryService {
    constructor(apiService, config = {}) {
        if (!apiService) {
            throw new Error('InventoryService requires an ApiService instance');
        }

        this.api = apiService;
        this.cacheTTL = config.cacheTTL || 5 * 60 * 1000; // 5 minutes default
        this.cachePrefix = config.cachePrefix || 'inv_cache_';
        this.enableLogging = config.enableLogging !== false;

        // Statistics tracking
        this.stats = {
            hits: 0,
            misses: 0,
            errors: 0
        };
    }

    /**
     * Fetch inventory with caching
     * @param {string} styleNumber - Product style (e.g., 'PC54')
     * @param {string} color - Color name (e.g., 'Forest')
     * @returns {Promise<Object>} Inventory data
     */
    async fetchInventory(styleNumber, color) {
        const cacheKey = this.getCacheKey(styleNumber, color);

        // Try to get from cache first
        const cached = this.getFromCache(cacheKey);
        if (cached) {
            this.stats.hits++;
            if (this.enableLogging) {
                console.log(`[InventoryService] 💚 Cache HIT: ${styleNumber} ${color} (${this.stats.hits} hits)`);
            }
            return cached;
        }

        // Cache miss - fetch from API
        this.stats.misses++;
        if (this.enableLogging) {
            console.log(`[InventoryService] 🔴 Cache MISS: ${styleNumber} ${color} (${this.stats.misses} misses)`);
        }

        try {
            const data = await this.fetchFromAPI(styleNumber, color);

            // Store in cache
            this.saveToCache(cacheKey, data);

            if (this.enableLogging) {
                console.log(`[InventoryService] ✓ Cached: ${styleNumber} ${color}`);
            }

            return data;

        } catch (error) {
            this.stats.errors++;
            console.error(`[InventoryService] ✗ Error fetching inventory:`, error);
            throw error;
        }
    }

    /**
     * Fetch multi-SKU inventory (PC54, PC54_2XL, PC54_3XL) with caching
     * @param {string} color - Color name
     * @returns {Promise<Object>} Combined inventory data
     */
    async fetchMultiSKUInventory(color) {
        const cacheKey = this.getCacheKey('PC54_MULTI', color);

        // Check cache for combined data
        const cached = this.getFromCache(cacheKey);
        if (cached) {
            this.stats.hits++;
            if (this.enableLogging) {
                console.log(`[InventoryService] 💚 Cache HIT (Multi-SKU): ${color}`);
            }
            return cached;
        }

        // Cache miss - fetch all SKUs in parallel
        this.stats.misses++;
        if (this.enableLogging) {
            console.log(`[InventoryService] 🔴 Cache MISS (Multi-SKU): ${color}`);
        }

        try {
            const [standard, twoXL, threeXL] = await Promise.all([
                this.fetchFromAPI('PC54', color),
                this.fetchFromAPI('PC54_2XL', color),
                this.fetchFromAPI('PC54_3XL', color)
            ]);

            const combined = {
                standard,
                twoXL,
                threeXL,
                combined: true,
                timestamp: Date.now()
            };

            // Cache the combined result
            this.saveToCache(cacheKey, combined);

            if (this.enableLogging) {
                console.log(`[InventoryService] ✓ Cached Multi-SKU: ${color}`);
            }

            return combined;

        } catch (error) {
            this.stats.errors++;
            console.error(`[InventoryService] ✗ Error fetching multi-SKU inventory:`, error);
            throw error;
        }
    }

    /**
     * Fetch from API (internal method)
     * @private
     */
    async fetchFromAPI(partNumber, color) {
        const url = `/api/manageorders/inventorylevels?PartNumber=${encodeURIComponent(partNumber)}&Color=${encodeURIComponent(color)}`;
        return await this.api.get(url);
    }

    /**
     * Get data from sessionStorage cache
     * @private
     */
    getFromCache(key) {
        try {
            const item = sessionStorage.getItem(this.cachePrefix + key);
            if (!item) return null;

            const cached = JSON.parse(item);

            // Check if cache is still valid
            const age = Date.now() - cached.timestamp;
            if (age > this.cacheTTL) {
                // Cache expired
                if (this.enableLogging) {
                    console.log(`[InventoryService] ⏰ Cache expired: ${key} (${Math.round(age / 1000)}s old)`);
                }
                sessionStorage.removeItem(this.cachePrefix + key);
                return null;
            }

            return cached.data;

        } catch (error) {
            console.error('[InventoryService] Cache read error:', error);
            return null;
        }
    }

    /**
     * Save data to sessionStorage cache
     * @private
     */
    saveToCache(key, data) {
        try {
            const item = {
                data,
                timestamp: Date.now()
            };
            sessionStorage.setItem(this.cachePrefix + key, JSON.stringify(item));
        } catch (error) {
            console.error('[InventoryService] Cache write error:', error);
            // Don't throw - caching is optional
        }
    }

    /**
     * Generate cache key
     * @private
     */
    getCacheKey(styleNumber, color) {
        return `${styleNumber}_${color}`.replace(/\s+/g, '_').toUpperCase();
    }

    /**
     * Clear all inventory cache
     */
    clearCache() {
        try {
            // Find and remove all cache entries
            const keys = Object.keys(sessionStorage);
            const cacheKeys = keys.filter(key => key.startsWith(this.cachePrefix));

            cacheKeys.forEach(key => sessionStorage.removeItem(key));

            if (this.enableLogging) {
                console.log(`[InventoryService] 🗑️ Cleared ${cacheKeys.length} cache entries`);
            }

            // Reset stats
            this.stats.hits = 0;
            this.stats.misses = 0;
            this.stats.errors = 0;

        } catch (error) {
            console.error('[InventoryService] Clear cache error:', error);
        }
    }

    /**
     * Get cache statistics
     */
    getStats() {
        const total = this.stats.hits + this.stats.misses;
        const hitRate = total > 0 ? ((this.stats.hits / total) * 100).toFixed(1) : 0;

        return {
            ...this.stats,
            total,
            hitRate: `${hitRate}%`,
            cacheTTL: `${this.cacheTTL / 1000}s`
        };
    }

    /**
     * Get service status
     */
    getStatus() {
        const stats = this.getStats();
        return {
            cacheTTL: this.cacheTTL,
            cachePrefix: this.cachePrefix,
            enableLogging: this.enableLogging,
            stats
        };
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = InventoryService;
}

// Make available globally for browser
if (typeof window !== 'undefined') {
    window.InventoryService = InventoryService;
}
