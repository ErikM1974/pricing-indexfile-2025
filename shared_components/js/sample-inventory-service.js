/**
 * Sample Inventory Service
 *
 * Integrates with Caspio API to check real-time Sanmar vendor inventory levels
 * for sample products before allowing customers to order.
 *
 * Key Features:
 * - Real-time inventory checks via Caspio API (Sanmar vendor inventory)
 * - 5-minute client-side cache (matches API cache)
 * - Size-specific availability validation
 * - Graceful error handling
 *
 * @author Claude & Erik
 * @created 2025-01-30
 * @updated 2025-01-30 - Switched to Caspio Sanmar inventory
 */

class SampleInventoryService {
    constructor() {
        this.apiBase = 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';
        this.cacheKey = 'sample_inventory_cache';
        this.cacheDuration = 5 * 60 * 1000; // 5 minutes (matches API cache)
        this.cache = new Map();

        // Load cache from sessionStorage
        this.loadCache();

        console.log('[SampleInventory] Service initialized (Sanmar vendor inventory)');
    }

    /**
     * Load cache from sessionStorage
     */
    loadCache() {
        try {
            const cached = sessionStorage.getItem(this.cacheKey);
            if (cached) {
                const data = JSON.parse(cached);

                // Check if cache is still valid
                if (Date.now() - data.timestamp < this.cacheDuration) {
                    this.cache = new Map(data.entries);
                    console.log(`[SampleInventory] ✓ Loaded cache: ${this.cache.size} products`);
                } else {
                    console.log('[SampleInventory] Cache expired, will fetch fresh data');
                    sessionStorage.removeItem(this.cacheKey);
                }
            }
        } catch (error) {
            console.error('[SampleInventory] Error loading cache:', error);
        }
    }

    /**
     * Save cache to sessionStorage
     */
    saveCache() {
        try {
            const data = {
                entries: Array.from(this.cache.entries()),
                timestamp: Date.now()
            };
            sessionStorage.setItem(this.cacheKey, JSON.stringify(data));
        } catch (error) {
            console.error('[SampleInventory] Error saving cache:', error);
        }
    }

    /**
     * Fetch inventory levels from Caspio API (Sanmar vendor inventory)
     *
     * @param {string} styleNumber - Product style number (e.g., "PC450")
     * @param {string} colorName - Color name from Caspio (e.g., "Light Blue")
     * @returns {Promise<Object>} Inventory data with sizes and quantities
     */
    async fetchInventoryLevels(styleNumber, colorName) {
        const cacheKey = `${styleNumber}_${colorName}`;

        // Check cache first
        if (this.cache.has(cacheKey)) {
            console.log(`[SampleInventory] ✓ Using cached data for ${cacheKey}`);
            return this.cache.get(cacheKey);
        }

        try {
            console.log(`[SampleInventory] Fetching Sanmar inventory for ${styleNumber} ${colorName}...`);

            const url = `${this.apiBase}/api/sizes-by-style-color?styleNumber=${encodeURIComponent(styleNumber)}&color=${encodeURIComponent(colorName)}`;
            const response = await fetch(url);

            if (!response.ok) {
                throw new Error(`API error: ${response.status}`);
            }

            const data = await response.json();

            // Parse Caspio response structure
            const inventory = this.parseCaspioInventory(data);

            console.log(`[SampleInventory] ✓ Fetched inventory for ${inventory.sizes.length} sizes`);

            // Cache the result
            this.cache.set(cacheKey, inventory);
            this.saveCache();

            return inventory;

        } catch (error) {
            console.error('[SampleInventory] Error fetching inventory:', error);

            // Return empty inventory on error (graceful degradation)
            return {
                style: styleNumber,
                color: colorName,
                sizes: [],
                totalStock: 0
            };
        }
    }

    /**
     * Parse Caspio inventory response
     *
     * Caspio structure:
     * {
     *   style: "PC450",
     *   color: "Light Blue",
     *   sizes: ["S", "M", "L", "XL", "2XL", ...],
     *   warehouses: [
     *     { name: "Seattle, WA", inventory: [452, 663, 803, ...], total: 2808 },
     *     { name: "Reno, NV", inventory: [108, 42, 423, ...], total: 1854 }
     *   ]
     * }
     *
     * @param {Object} data - Caspio API response
     * @returns {Object} Parsed inventory with size-level quantities
     */
    parseCaspioInventory(data) {
        // Handle array response (API sometimes returns array)
        const inventoryData = Array.isArray(data) ? data[0] : data;

        if (!inventoryData || !inventoryData.sizes || !inventoryData.warehouses) {
            return {
                style: inventoryData?.style || '',
                color: inventoryData?.color || '',
                sizes: [],
                totalStock: 0
            };
        }

        const sizes = inventoryData.sizes;
        const warehouses = inventoryData.warehouses;

        // Sum inventory across all warehouses for each size
        const sizeInventory = {};

        sizes.forEach((size, index) => {
            let totalForSize = 0;

            warehouses.forEach(warehouse => {
                if (warehouse.inventory && warehouse.inventory[index] !== undefined) {
                    totalForSize += warehouse.inventory[index];
                }
            });

            sizeInventory[size] = totalForSize;
        });

        // Calculate total stock across all sizes
        const totalStock = Object.values(sizeInventory).reduce((sum, qty) => sum + qty, 0);

        return {
            style: inventoryData.style,
            color: inventoryData.color,
            sizes: sizes,
            inventory: sizeInventory,
            totalStock: totalStock
        };
    }

    /**
     * Check if a specific size has enough inventory
     *
     * @param {string} styleNumber - Product style number
     * @param {string} colorName - Color name
     * @param {string} size - Size code (e.g., "S", "M", "L", "XL", "2XL")
     * @param {number} requestedQty - Quantity requested
     * @returns {Promise<Object>} Availability status
     */
    async checkSizeAvailability(styleNumber, colorName, size, requestedQty = 1) {
        const inventory = await this.fetchInventoryLevels(styleNumber, colorName);

        // Check if size exists in inventory
        const qtyAvailable = inventory.inventory?.[size] || 0;
        const available = qtyAvailable >= requestedQty;

        return {
            available: available,
            qtyInStock: qtyAvailable,
            hasRecord: inventory.sizes.includes(size),
            isLowStock: qtyAvailable > 0 && qtyAvailable < 24,
            warehouse: 'Sanmar (Multiple Warehouses)'
        };
    }

    /**
     * Get overall stock status for a product/color
     *
     * @param {string} styleNumber - Product style number
     * @param {string} colorName - Color name
     * @param {Object} sizes - Size breakdown {S: 1, M: 2, L: 1, ...}
     * @returns {Promise<Object>} Stock status and size availability
     */
    async getStockStatus(styleNumber, colorName, sizes = {}) {
        const inventory = await this.fetchInventoryLevels(styleNumber, colorName);

        if (!inventory.sizes || inventory.sizes.length === 0) {
            return {
                status: 'unknown',
                message: 'Unable to verify inventory',
                sizeAvailability: {},
                allAvailable: false,
                hasWarnings: true
            };
        }

        // Check availability for each requested size
        const sizeAvailability = {};
        let totalAvailable = 0;
        let totalOutOfStock = 0;
        let totalLowStock = 0;

        for (const [size, qty] of Object.entries(sizes)) {
            if (qty === 0) continue; // Skip sizes with 0 quantity

            const qtyInStock = inventory.inventory[size] || 0;
            const available = qtyInStock >= qty;
            const isLowStock = qtyInStock > 0 && qtyInStock < 24;

            sizeAvailability[size] = {
                available: available,
                qtyInStock: qtyInStock,
                hasRecord: inventory.sizes.includes(size),
                isLowStock: isLowStock
            };

            if (available) {
                totalAvailable++;
                if (isLowStock) {
                    totalLowStock++;
                }
            } else {
                totalOutOfStock++;
            }
        }

        // Determine overall status
        let status, message;
        const requestedSizeCount = Object.values(sizes).filter(q => q > 0).length;

        if (totalOutOfStock > 0) {
            status = 'out_of_stock';
            message = totalOutOfStock === requestedSizeCount
                ? 'All sizes out of stock'
                : `${totalOutOfStock} size(s) out of stock`;
        } else if (totalLowStock > 0) {
            status = 'low_stock';
            message = `${totalLowStock} size(s) low in stock`;
        } else if (totalAvailable === requestedSizeCount) {
            status = 'in_stock';
            message: 'All sizes in stock';
        } else {
            status = 'unknown';
            message = 'Unable to verify all sizes';
        }

        return {
            status: status,
            message: message,
            sizeAvailability: sizeAvailability,
            allAvailable: totalAvailable === requestedSizeCount && totalOutOfStock === 0,
            hasWarnings: totalOutOfStock > 0 || totalLowStock > 0
        };
    }

    /**
     * Check inventory for multiple samples in cart
     *
     * @param {Array} samples - Array of sample objects from cart
     * @returns {Promise<Array>} Samples with inventory status added
     */
    async checkCartInventory(samples) {
        console.log(`[SampleInventory] Checking inventory for ${samples.length} samples...`);
        console.log(`[SampleInventory] Input samples:`, samples);

        // Validate input
        if (!Array.isArray(samples)) {
            console.error(`[SampleInventory] ❌ Invalid input: not an array`, typeof samples);
            return [];
        }

        const results = [];

        for (let i = 0; i < samples.length; i++) {
            const sample = samples[i];
            console.log(`[SampleInventory] Processing sample ${i}:`, {
                style: sample.style,
                catalogColor: sample.catalogColor,
                sizes: sample.sizes
            });

            try {
                const stockStatus = await this.getStockStatus(
                    sample.style,
                    sample.catalogColor,
                    sample.sizes
                );

                results.push({
                    ...sample,
                    inventoryStatus: stockStatus.status,
                    inventoryMessage: stockStatus.message,
                    sizeAvailability: stockStatus.sizeAvailability,
                    allAvailable: stockStatus.allAvailable,
                    hasWarnings: stockStatus.hasWarnings,
                    lastInventoryCheck: new Date().toISOString()
                });

                console.log(`[SampleInventory] ✓ Processed sample ${i}, status: ${stockStatus.status}`);

            } catch (error) {
                console.error(`[SampleInventory] ❌ Error checking ${sample.style}:`, error);
                // Still push item even if check fails - don't lose the item!
                results.push({
                    ...sample,
                    inventoryStatus: 'unknown',
                    inventoryMessage: 'Unable to check inventory',
                    sizeAvailability: {},
                    allAvailable: false,
                    hasWarnings: true,
                    lastInventoryCheck: new Date().toISOString()
                });
            }
        }

        console.log(`[SampleInventory] ✓ Check complete. Processed ${samples.length} samples, returning ${results.length} results`);
        console.log(`[SampleInventory] Results array:`, results);
        return results;
    }

    /**
     * Validate cart before checkout
     *
     * @param {Array} samples - Array of samples with inventory status
     * @returns {Object} Validation result
     */
    validateCheckout(samples) {
        const outOfStockItems = samples.filter(s =>
            s.inventoryStatus === 'out_of_stock' || !s.allAvailable
        );

        const lowStockItems = samples.filter(s =>
            s.inventoryStatus === 'low_stock'
        );

        if (outOfStockItems.length > 0) {
            return {
                valid: false,
                canProceed: false,
                message: `${outOfStockItems.length} item(s) are out of stock. Please remove them to continue.`,
                outOfStockItems: outOfStockItems,
                warnings: []
            };
        }

        if (lowStockItems.length > 0) {
            return {
                valid: true,
                canProceed: true,
                message: 'All items available',
                outOfStockItems: [],
                warnings: lowStockItems.map(item =>
                    `${item.name} (${item.color}): Some sizes are low in stock`
                )
            };
        }

        return {
            valid: true,
            canProceed: true,
            message: 'All items in stock',
            outOfStockItems: [],
            warnings: []
        };
    }

    /**
     * Clear cache (force refresh)
     */
    clearCache() {
        this.cache.clear();
        sessionStorage.removeItem(this.cacheKey);
        console.log('[SampleInventory] Cache cleared');
    }

    /**
     * Force re-check inventory for all cart items (clears cache and re-fetches)
     */
    async forceRefreshCartInventory() {
        console.log('[SampleInventory] 🔄 Forcing inventory refresh...');

        // Clear all cached inventory
        this.clearCache();

        // Get current cart
        const cartData = sessionStorage.getItem('sampleCart');
        if (!cartData) {
            console.log('[SampleInventory] No cart found');
            return;
        }

        let cart;
        try {
            const parsed = JSON.parse(cartData);
            cart = parsed.samples || parsed;
        } catch (e) {
            console.error('[SampleInventory] Error parsing cart:', e);
            return;
        }

        // Re-check inventory for all items
        const updatedCart = await this.checkCartInventory(cart);

        // Save back to session storage
        sessionStorage.setItem('sampleCart', JSON.stringify({
            samples: updatedCart,
            timestamp: new Date().toISOString()
        }));

        console.log('[SampleInventory] ✓ Inventory refreshed, reload page to see changes');
        return updatedCart;
    }

    /**
     * Get service status
     */
    getStatus() {
        return {
            service: 'SampleInventoryService',
            apiEndpoint: `${this.apiBase}/api/sizes-by-style-color`,
            inventorySource: 'Sanmar Vendor Inventory (via Caspio)',
            cacheSize: this.cache.size,
            cacheDuration: `${this.cacheDuration / 1000 / 60} minutes`
        };
    }
}

// Initialize service when script loads
if (typeof window !== 'undefined') {
    window.SampleInventoryService = SampleInventoryService;
    window.sampleInventoryService = new SampleInventoryService();
    console.log('[SampleInventory] Service ready - Using Sanmar vendor inventory');
}
