/**
 * ManageOrders Inventory Service
 * Fetches local warehouse inventory from ShopWorks ManageOrders API
 *
 * Purpose: Check Northwest Custom Apparel's physical warehouse stock
 * Endpoint: /api/manageorders/inventorylevels
 * Cache: 5 minutes (browser + server)
 *
 * Usage:
 *   const service = new ManageOrdersInventoryService();
 *   const inventory = await service.checkInventory('LTM752', 'Black');
 *   console.log(`Local stock: ${inventory.totalStock} units`);
 */

class ManageOrdersInventoryService {
    constructor() {
        this.baseURL = 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';
        this.cache = new Map();
        this.cacheDuration = 5 * 60 * 1000; // 5 minutes

    }

    /**
     * Check inventory for a part number
     * @param {string} partNumber - Style/part number (e.g., 'LTM752')
     * @param {string|null} color - Optional color filter
     * @returns {Promise<Object>} Inventory data with availability
     */
    async checkInventory(partNumber, color = null) {
        const cacheKey = color ? `${partNumber}:${color}` : partNumber;

        // Check browser cache first
        if (this.cache.has(cacheKey)) {
            const cached = this.cache.get(cacheKey);
            if (Date.now() - cached.timestamp < this.cacheDuration) {
                console.log(`[ManageOrdersInventory] Using cached data for ${partNumber}`, cached.data.totalStock, 'units');
                return cached.data;
            }
        }

        try {
            // Build query URL
            let url = `${this.baseURL}/api/manageorders/inventorylevels?PartNumber=${partNumber}`;
            if (color) {
                url += `&PartColor=${encodeURIComponent(color)}`;
            }

            console.log(`[ManageOrdersInventory] Fetching from API:`, partNumber, color || '(all colors)');

            const response = await fetch(url);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();

            if (!data.result || data.result.length === 0) {
                console.warn(`[ManageOrdersInventory] No inventory found for ${partNumber}`);
                return {
                    available: false,
                    message: 'Product not found in local inventory',
                    totalStock: 0
                };
            }

            const inventory = data.result[0];

            // Calculate total stock across all sizes
            const totalStock =
                (inventory.Size01 || 0) +
                (inventory.Size02 || 0) +
                (inventory.Size03 || 0) +
                (inventory.Size04 || 0) +
                (inventory.Size05 || 0) +
                (inventory.Size06 || 0);

            const result = {
                available: totalStock > 0,
                totalStock: totalStock,
                sizeBreakdown: {
                    'XS': inventory.Size01 || 0,
                    'S': inventory.Size02 || 0,
                    'M': inventory.Size03 || 0,
                    'L': inventory.Size04 || 0,
                    'XL': inventory.Size05 || 0,
                    '2XL': inventory.Size06 || 0
                },
                vendorName: inventory.VendorName || '',
                description: inventory.Description || '',
                partNumber: inventory.PartNumber,
                color: inventory.Color || '',
                sku: inventory.SKU || '',
                cacheAge: data.cacheAge || 'fresh'
            };

            // Cache in browser
            this.cache.set(cacheKey, {
                data: result,
                timestamp: Date.now()
            });

            console.log(`[ManageOrdersInventory] ✓ Fetched from server:`, partNumber, totalStock, 'units in stock');
            return result;

        } catch (error) {
            console.error('[ManageOrdersInventory] Error checking inventory:', error);
            return {
                available: false,
                message: 'Unable to check inventory. Please contact us.',
                totalStock: 0,
                error: error.message
            };
        }
    }

    /**
     * Force refresh inventory (bypass cache)
     * @param {string} partNumber - Style/part number
     * @param {string|null} color - Optional color filter
     * @returns {Promise<Object>} Fresh inventory data
     */
    async refreshInventory(partNumber, color = null) {
        const cacheKey = color ? `${partNumber}:${color}` : partNumber;

        // Clear browser cache
        this.cache.delete(cacheKey);

        // Build URL with refresh parameter
        let url = `${this.baseURL}/api/manageorders/inventorylevels?PartNumber=${partNumber}&refresh=true`;
        if (color) {
            url += `&Color=${encodeURIComponent(color)}`;
        }

        console.log(`[ManageOrdersInventory] Force refresh:`, partNumber);

        // Pre-fetch to force server cache refresh
        await fetch(url);

        // Now get fresh data
        return this.checkInventory(partNumber, color);
    }

    /**
     * Get cache status
     * @returns {Object} Cache statistics
     */
    getCacheStatus() {
        return {
            service: 'ManageOrdersInventory',
            cacheSize: this.cache.size,
            cacheDuration: this.cacheDuration / 1000 + ' seconds',
            cachedItems: Array.from(this.cache.keys())
        };
    }

    /**
     * Clear all cached inventory
     */
    clearCache() {
        this.cache.clear();
        console.log('[ManageOrdersInventory] Cache cleared');
    }
}

// Make service globally available
window.ManageOrdersInventoryService = ManageOrdersInventoryService;
