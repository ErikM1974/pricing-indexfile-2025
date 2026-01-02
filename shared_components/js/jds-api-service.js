/**
 * JDS Industries API Service
 * Handles product data and pricing from JDS API for laser tumblers
 *
 * Base URL: https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/jds
 * Cache: 1 hour parameter-aware caching
 * Rate Limit: 60 requests per minute per IP
 */

class JDSApiService {
    constructor() {
        this.baseURL = 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/jds';
        this.cache = new Map();
        this.cacheDuration = 60 * 60 * 1000; // 1 hour

        // Business logic constants (not from API)
        this.MARGIN_DENOMINATOR = 0.57;     // 2026 margin (43%) - synced with API Pricing_Tiers.MarginDenominator
        this.ENGRAVING_LABOR_COST = 3.00;   // 2026 labor cost (increased from $2.85)
        this.SETUP_FEE = 75.00;
        this.SECOND_LOGO_PRICE = 3.16;
        this.SMALL_ORDER_HANDLING_FEE = 50.00;  // Handling fee for orders of 1-11 pieces

        console.log('[JDSApiService] Initialized');
    }

    /**
     * Get product details from API
     * @param {string} sku - Product SKU (e.g., 'LTM752')
     * @param {boolean} forceRefresh - Bypass cache
     * @returns {Promise<Object>} Product data
     */
    async getProduct(sku, forceRefresh = false) {
        const cacheKey = `product_${sku}`;

        // Check cache first
        if (!forceRefresh && this.cache.has(cacheKey)) {
            const cached = this.cache.get(cacheKey);
            if (Date.now() - cached.timestamp < this.cacheDuration) {
                console.log(`[JDSApiService] Using cached data for ${sku}`);
                return cached.data;
            }
        }

        try {
            console.log(`[JDSApiService] Fetching product ${sku} from API`);
            const url = `${this.baseURL}/products/${sku}${forceRefresh ? '?refresh=true' : ''}`;
            const response = await fetch(url);

            if (!response.ok) {
                throw new Error(`API request failed: ${response.status}`);
            }

            const data = await response.json();
            const product = data.result;

            // Cache the result
            this.cache.set(cacheKey, {
                data: product,
                timestamp: Date.now()
            });

            console.log(`[JDSApiService] ✓ Product ${sku} fetched successfully`);
            return product;

        } catch (error) {
            console.error(`[JDSApiService] Error fetching product ${sku}:`, error);
            throw error;
        }
    }

    /**
     * Get inventory only (faster, lightweight)
     * @param {string} sku - Product SKU
     * @returns {Promise<Object>} Inventory data
     */
    async getInventory(sku) {
        try {
            console.log(`[JDSApiService] Fetching inventory for ${sku}`);
            const url = `${this.baseURL}/inventory/${sku}`;
            const response = await fetch(url);

            if (!response.ok) {
                throw new Error(`Inventory request failed: ${response.status}`);
            }

            const data = await response.json();
            return data.result;

        } catch (error) {
            console.error(`[JDSApiService] Error fetching inventory ${sku}:`, error);
            throw error;
        }
    }

    /**
     * Calculate customer-facing price from JDS wholesale pricing
     * Formula: (JDS Wholesale ÷ 0.60) + $2.85
     *
     * This gives us 40% margin on the blank, plus labor/overhead/engraving
     *
     * @param {number} jdsWholesale - JDS wholesale price
     * @returns {number} Final customer price per unit
     */
    calculatePrice(jdsWholesale) {
        // Apply 40% margin: divide by 0.60
        const garmentWithMargin = jdsWholesale / this.MARGIN_DENOMINATOR;

        // Add engraving labor/overhead
        const finalPrice = garmentWithMargin + this.ENGRAVING_LABOR_COST;

        console.log(`[JDSApiService] Price calculation:
            JDS Wholesale: $${jdsWholesale.toFixed(2)}
            ÷ ${this.MARGIN_DENOMINATOR} (40% margin) = $${garmentWithMargin.toFixed(2)}
            + $${this.ENGRAVING_LABOR_COST.toFixed(2)} (engraving) = $${finalPrice.toFixed(2)}`);

        return parseFloat(finalPrice.toFixed(2));
    }

    /**
     * Get JDS wholesale price for given quantity
     * Uses JDS tier structure from API
     *
     * @param {Object} product - Product from API
     * @param {number} quantity - Order quantity
     * @returns {number} Wholesale price per unit
     */
    getWholesalePriceForQuantity(product, quantity) {
        const caseQty = product.caseQuantity;

        if (quantity < caseQty) {
            return product.lessThanCasePrice;
        } else if (quantity < caseQty * 5) {
            return product.oneCase;
        } else if (quantity < caseQty * 10) {
            return product.fiveCases;
        } else if (quantity < caseQty * 20) {
            return product.tenCases;
        } else if (quantity < caseQty * 40) {
            return product.twentyCases;
        } else {
            return product.fortyCases;
        }
    }

    /**
     * Get all pricing tiers for display with fixed pricing structure
     * @param {Object} product - Product from API (not currently used for pricing)
     * @returns {Array} Array of tier objects with quantity ranges and prices
     */
    getPricingTiers(product) {
        return [
            {
                range: '1-11',
                quantity: 11, // Example quantity for display
                customerPrice: 19.00,
                description: 'Small Order',
                handlingFee: this.SMALL_ORDER_HANDLING_FEE, // $50 handling fee
                totalWithFee: (19.00 * 11) + this.SMALL_ORDER_HANDLING_FEE // Example total with fee
            },
            {
                range: '12-23',
                quantity: 23, // Example quantity for display
                customerPrice: 19.00,
                description: 'Small Order'
            },
            {
                range: '24-119',
                quantity: 24, // Use minimum for display (most popular)
                customerPrice: 17.00,
                description: 'Standard Order'
            },
            {
                range: '120-239',
                quantity: 120, // Use minimum for display
                customerPrice: 16.50,
                description: 'Volume Order'
            },
            {
                range: '240+',
                quantity: 240, // Use minimum for display
                customerPrice: 16.00,
                description: 'Bulk Order'
            }
        ];
    }

    /**
     * Get status of API service
     * @returns {Promise<Object>} Health check data
     */
    async getHealth() {
        try {
            const url = `${this.baseURL}/health`;
            const response = await fetch(url);
            const data = await response.json();
            return data;
        } catch (error) {
            console.error('[JDSApiService] Health check failed:', error);
            return { status: 'error', error: error.message };
        }
    }

    /**
     * Clear cache (useful for testing)
     */
    clearCache() {
        this.cache.clear();
        console.log('[JDSApiService] Cache cleared');
    }

    /**
     * Get cache statistics
     */
    getCacheStats() {
        return {
            size: this.cache.size,
            keys: Array.from(this.cache.keys())
        };
    }
}

// Make service globally available
window.JDSApiService = JDSApiService;
