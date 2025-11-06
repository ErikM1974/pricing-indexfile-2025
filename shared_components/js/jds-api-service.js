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
        this.MARGIN_DENOMINATOR = 0.60;     // 40% margin on blank
        this.ENGRAVING_LABOR_COST = 2.85;   // Labor + overhead + engraving
        this.SETUP_FEE = 75.00;
        this.SECOND_LOGO_PRICE = 3.16;

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
     * Get all pricing tiers for display
     * @param {Object} product - Product from API
     * @returns {Array} Array of tier objects with quantity ranges and prices
     */
    getPricingTiers(product) {
        const caseQty = product.caseQuantity;

        return [
            {
                range: `1-${caseQty - 1}`,
                quantity: Math.floor((caseQty - 1) / 2), // Mid-point for display
                wholesale: product.lessThanCasePrice,
                customerPrice: this.calculatePrice(product.lessThanCasePrice),
                description: 'Small Orders'
            },
            {
                range: `${caseQty}-${caseQty * 5 - 1}`,
                quantity: caseQty, // Use minimum for display
                wholesale: product.oneCase,
                customerPrice: this.calculatePrice(product.oneCase),
                description: '1-4 Cases'
            },
            {
                range: `${caseQty * 5}-${caseQty * 10 - 1}`,
                quantity: caseQty * 5, // Use minimum for display
                wholesale: product.fiveCases,
                customerPrice: this.calculatePrice(product.fiveCases),
                description: '5-9 Cases'
            },
            {
                range: `${caseQty * 10}+`,
                quantity: caseQty * 10, // Use minimum for display
                wholesale: product.tenCases,
                customerPrice: this.calculatePrice(product.tenCases),
                description: '10+ Cases'
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
