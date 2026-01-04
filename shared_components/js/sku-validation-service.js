/**
 * SKU Validation Service
 *
 * Validates SKUs against ShopWorks inventory and provides
 * SanMar to ShopWorks SKU transformation.
 *
 * CRITICAL: ShopWorks uses _2X/_3X suffix format (NOT _2XL/_3XL)
 * Verified from actual shopworksparts.csv file from ShopWorks.
 *
 * @author Claude Code
 * @version 1.0.0
 */

class SKUValidationService {
    constructor() {
        this.baseURL = 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';
        this.cache = new Map();
        this.cacheDuration = 5 * 60 * 1000; // 5 minutes
    }

    /**
     * Standard sizes that use the BASE SKU (no suffix)
     */
    static STANDARD_SIZES = ['S', 'M', 'L', 'XL'];

    /**
     * Size to ShopWorks suffix mapping
     * VERIFIED from shopworksparts.csv - ShopWorks uses _2X NOT _2XL
     */
    static SIZE_TO_SUFFIX = {
        // Standard sizes - no suffix (use base SKU)
        'S': '',
        'M': '',
        'L': '',
        'XL': '',

        // Extended sizes - ShopWorks format
        'XS': '_XS',
        '2XL': '_2X',      // CORRECT: ShopWorks uses _2X
        '3XL': '_3X',      // CORRECT: ShopWorks uses _3X
        '4XL': '_4X',
        '5XL': '_5X',
        '6XL': '_6X',

        // Tall sizes
        'LT': '_LT',
        'XLT': '_XLT',
        '2XLT': '_2XLT',
        '3XLT': '_3XLT',
        '4XLT': '_4XLT',

        // One-size / combination sizes
        'OSFA': '_OSFA',
        'S/M': '_S/M',
        'M/L': '_M/L',
        'L/XL': '_L/XL',

        // Youth sizes
        'YXS': '_YXS',
        'YS': '_YS',
        'YM': '_YM',
        'YL': '_YL',
        'YXL': '_YXL',

        // Toddler sizes
        '2T': '_2T',
        '3T': '_3T',
        '4T': '_4T',
        '5T': '_5T',
        '5/6': '_5/6',

        // Infant sizes
        'NB': '_NB',
        '6M': '_6M',
        '12M': '_12M',
        '18M': '_18M',
        '24M': '_24M'
    };

    /**
     * Convert SanMar style + size to ShopWorks SKU format
     *
     * @param {string} style - Base style number (e.g., 'PC54')
     * @param {string} size - Size (e.g., '2XL', 'S', 'OSFA')
     * @returns {string} ShopWorks SKU (e.g., 'PC54_2X', 'PC54', 'C950_OSFA')
     *
     * @example
     * sanmarToShopWorksSKU('PC54', 'M')   // Returns 'PC54'
     * sanmarToShopWorksSKU('PC54', '2XL') // Returns 'PC54_2X'
     * sanmarToShopWorksSKU('C950', 'OSFA') // Returns 'C950_OSFA'
     */
    sanmarToShopWorksSKU(style, size) {
        if (!style || !size) {
            console.warn('[SKUValidationService] Missing style or size:', { style, size });
            return style || '';
        }

        const normalizedSize = size.toUpperCase().trim();
        const suffix = SKUValidationService.SIZE_TO_SUFFIX[normalizedSize];

        // Known size with explicit mapping
        if (suffix !== undefined) {
            return suffix ? `${style}${suffix}` : style;
        }

        // Unknown size - construct suffix from size value
        console.warn(`[SKUValidationService] Unknown size "${size}", using fallback suffix`);
        return `${style}_${normalizedSize}`;
    }

    /**
     * Check if a size is a standard size (uses base SKU)
     *
     * @param {string} size - Size to check
     * @returns {boolean} True if standard size (S, M, L, XL)
     */
    isStandardSize(size) {
        return SKUValidationService.STANDARD_SIZES.includes(size.toUpperCase().trim());
    }

    /**
     * Get cache key for a style/color combination
     * @private
     */
    _getCacheKey(styleNumber, catalogColor) {
        return `${styleNumber}:${catalogColor}`.toLowerCase();
    }

    /**
     * Check if cached data is still valid
     * @private
     */
    _isCacheValid(cacheEntry) {
        if (!cacheEntry) return false;
        return (Date.now() - cacheEntry.timestamp) < this.cacheDuration;
    }

    /**
     * Get valid SKUs for a product/color combination from ShopWorks
     *
     * @param {string} styleNumber - Product style (e.g., 'PC54')
     * @param {string} catalogColor - CATALOG_COLOR (e.g., 'BrillOrng')
     * @returns {Promise<Object>} Object with validSizes array and skuMap
     *
     * @example
     * const { validSizes, skuMap } = await getValidSKUs('PC54', 'Ash');
     * // validSizes: ['S', 'M', 'L', 'XL', '2XL', '3XL']
     * // skuMap: { 'S': 'PC54', '2XL': 'PC54_2X', ... }
     */
    async getValidSKUs(styleNumber, catalogColor) {
        const cacheKey = this._getCacheKey(styleNumber, catalogColor);

        // Check cache first
        const cached = this.cache.get(cacheKey);
        if (this._isCacheValid(cached)) {
            console.log('[SKUValidationService] Cache hit for', cacheKey);
            return cached.data;
        }

        try {
            // Query the sanmar-shopworks import format endpoint
            const url = `${this.baseURL}/api/sanmar-shopworks/import-format?style=${encodeURIComponent(styleNumber)}&color=${encodeURIComponent(catalogColor)}`;

            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`API returned ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();

            // Process response to extract valid sizes
            const validSizes = [];
            const skuMap = {};

            if (data && data.products) {
                for (const product of data.products) {
                    // Check Size01-Size10 fields for available sizes
                    for (let i = 1; i <= 10; i++) {
                        const sizeField = `Size0${i}`.replace('Size010', 'Size10');
                        const actualField = i < 10 ? `Size0${i}` : `Size${i}`;

                        if (product[actualField] && product[actualField] !== '0' && product[actualField] !== '') {
                            const size = this._normalizeSize(actualField, product);
                            if (size && !validSizes.includes(size)) {
                                validSizes.push(size);
                                skuMap[size] = this.sanmarToShopWorksSKU(styleNumber, size);
                            }
                        }
                    }
                }
            }

            // If no data from API, provide defaults for common products
            if (validSizes.length === 0) {
                console.warn('[SKUValidationService] No sizes found from API, using defaults');
                const defaults = ['S', 'M', 'L', 'XL', '2XL', '3XL'];
                defaults.forEach(size => {
                    validSizes.push(size);
                    skuMap[size] = this.sanmarToShopWorksSKU(styleNumber, size);
                });
            }

            const result = { validSizes, skuMap, styleNumber, catalogColor };

            // Cache the result
            this.cache.set(cacheKey, {
                data: result,
                timestamp: Date.now()
            });

            console.log('[SKUValidationService] Fetched valid sizes:', result);
            return result;

        } catch (error) {
            console.error('[SKUValidationService] Failed to fetch valid SKUs:', error);

            // Return default sizes on error (allow manual entry)
            const defaults = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL'];
            const skuMap = {};
            defaults.forEach(size => {
                skuMap[size] = this.sanmarToShopWorksSKU(styleNumber, size);
            });

            return {
                validSizes: defaults,
                skuMap,
                styleNumber,
                catalogColor,
                error: error.message,
                isDefault: true
            };
        }
    }

    /**
     * Get inventory status for a specific size
     *
     * @param {string} styleNumber - Product style
     * @param {string} catalogColor - CATALOG_COLOR (NOT COLOR_NAME!)
     * @param {string} size - Size to check
     * @returns {Promise<Object>} Inventory status { available, stock, sku, status }
     */
    async getInventoryForSize(styleNumber, catalogColor, size) {
        const sku = this.sanmarToShopWorksSKU(styleNumber, size);

        try {
            const url = `${this.baseURL}/api/inventory?sku=${encodeURIComponent(sku)}&color=${encodeURIComponent(catalogColor)}`;

            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`Inventory API returned ${response.status}`);
            }

            const data = await response.json();

            // Determine inventory status
            const stock = data.quantity || data.stock || 0;
            let status = 'out';
            if (stock > 50) status = 'ok';
            else if (stock > 0) status = 'low';

            return {
                available: stock > 0,
                stock: stock,
                sku: sku,
                status: status,
                size: size
            };

        } catch (error) {
            console.error('[SKUValidationService] Inventory check failed:', error);
            return {
                available: null,
                stock: null,
                sku: sku,
                status: 'unknown',
                size: size,
                error: error.message
            };
        }
    }

    /**
     * Batch check inventory for multiple sizes
     *
     * @param {string} styleNumber - Product style
     * @param {string} catalogColor - CATALOG_COLOR
     * @param {string[]} sizes - Array of sizes to check
     * @returns {Promise<Object>} Map of size -> inventory status
     */
    async getInventoryBatch(styleNumber, catalogColor, sizes) {
        const results = {};

        // Run inventory checks in parallel
        const promises = sizes.map(async (size) => {
            const inventory = await this.getInventoryForSize(styleNumber, catalogColor, size);
            results[size] = inventory;
        });

        await Promise.all(promises);
        return results;
    }

    /**
     * Normalize size field name to display size
     * @private
     */
    _normalizeSize(sizeField, product) {
        // Map Size01-Size10 to actual size values based on product data
        // This would need to be enhanced based on actual API response structure
        const sizeMap = {
            'Size01': 'XS',
            'Size02': 'S',
            'Size03': 'M',
            'Size04': 'L',
            'Size05': 'XL',
            'Size06': '2XL',
            'Size07': '3XL',
            'Size08': '4XL',
            'Size09': '5XL',
            'Size10': '6XL'
        };
        return sizeMap[sizeField] || null;
    }

    /**
     * Clear the cache (useful for testing or forced refresh)
     */
    clearCache() {
        this.cache.clear();
        console.log('[SKUValidationService] Cache cleared');
    }

    /**
     * Get cache statistics
     * @returns {Object} Cache stats
     */
    getCacheStats() {
        const now = Date.now();
        let valid = 0;
        let expired = 0;

        this.cache.forEach((entry) => {
            if ((now - entry.timestamp) < this.cacheDuration) {
                valid++;
            } else {
                expired++;
            }
        });

        return {
            total: this.cache.size,
            valid,
            expired,
            cacheDuration: this.cacheDuration
        };
    }
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SKUValidationService;
}

// Make available globally for browser usage
if (typeof window !== 'undefined') {
    window.SKUValidationService = SKUValidationService;
}
