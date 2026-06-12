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
        this.proxyBase = window.APP_CONFIG?.API?.BASE_URL || 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';
        this.baseURL = `${this.proxyBase}/api/jds`;
        this.cache = new Map();
        this.cacheDuration = 60 * 60 * 1000; // 1 hour

        // Pricing config — live values come from Caspio Service_Codes (JDS-MARGIN /
        // JDS-LABOR / JDS-SETUP / JDS-LOGO2 / JDS-LTM rows) via loadServicePrices().
        // The literals below apply only while those rows don't exist or the API is
        // unreachable (CLAUDE.md "Pricing = API, never hardcoded"). Once a row exists,
        // Erik edits it in Caspio and prices update with no deploy.
        this.MARGIN_DENOMINATOR = 0.53;     // JDS-MARGIN (SellPrice holds the denominator; Erik set 0.53 on 2026-06-11)
        this.ENGRAVING_LABOR_COST = 2.99;   // JDS-LABOR (Erik set 2.99 on 2026-06-11 — lands small-order tier at $19.50)
        this.SETUP_FEE = 75.00;             // JDS-SETUP
        this.SECOND_LOGO_PRICE = 3.16;      // JDS-LOGO2
        this.SMALL_ORDER_HANDLING_FEE = 50.00;  // JDS-LTM — handling fee for orders of 1-11 pieces

        // Resolves when live prices are loaded (or the fallback decision is made).
        // Callers that price products should `await jdsService.ready` first.
        this.ready = this.loadServicePrices();

        console.log('[JDSApiService] Initialized');
    }

    /**
     * Load live JDS pricing config from Caspio Service_Codes via the proxy.
     * Missing rows keep their documented fallback; a failed fetch keeps all
     * fallbacks and surfaces a visible warning (never a silent wrong price).
     */
    async loadServicePrices() {
        try {
            const resp = await fetch(`${this.proxyBase}/api/service-codes`);
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            const json = await resp.json();
            const map = {};
            (json.data || []).forEach(sc => { if (sc.ServiceCode) map[String(sc.ServiceCode).toUpperCase()] = sc; });

            const live = (code, current) => {
                const sc = map[code];
                if (!sc || sc.IsActive === false) return current;
                const sell = parseFloat(sc.SellPrice);
                return Number.isFinite(sell) && sell >= 0 ? sell : current;
            };

            this.MARGIN_DENOMINATOR = live('JDS-MARGIN', this.MARGIN_DENOMINATOR);
            this.ENGRAVING_LABOR_COST = live('JDS-LABOR', this.ENGRAVING_LABOR_COST);
            this.SETUP_FEE = live('JDS-SETUP', this.SETUP_FEE);
            this.SECOND_LOGO_PRICE = live('JDS-LOGO2', this.SECOND_LOGO_PRICE);
            this.SMALL_ORDER_HANDLING_FEE = live('JDS-LTM', this.SMALL_ORDER_HANDLING_FEE);
        } catch (error) {
            console.error('[JDSApiService] Could not load live JDS prices from /api/service-codes — using built-in fallbacks:', error);
            if (typeof showToast === 'function') {
                showToast("Couldn't reach the pricing service — using default JDS prices", 'warning', 5000);
            }
        }
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
     * Formula: (JDS Wholesale ÷ MARGIN_DENOMINATOR) + ENGRAVING_LABOR_COST
     * (both from Caspio Service_Codes JDS-MARGIN / JDS-LABOR when those rows exist)
     *
     * @param {number} jdsWholesale - JDS wholesale price
     * @returns {number} Final customer price per unit
     */
    calculatePrice(jdsWholesale) {
        const garmentWithMargin = jdsWholesale / this.MARGIN_DENOMINATOR;

        // Add engraving labor/overhead
        const finalPrice = garmentWithMargin + this.ENGRAVING_LABOR_COST;

        console.log(`[JDSApiService] Price calculation:
            JDS Wholesale: $${jdsWholesale.toFixed(2)}
            ÷ ${this.MARGIN_DENOMINATOR} (margin denominator) = $${garmentWithMargin.toFixed(2)}
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
     * Round UP to the nearest half dollar — NWCA's standard price rounding
     * (same HalfDollarUp rule as DTG/DTF).
     */
    halfDollarUp(price) {
        return Math.ceil(price * 2) / 2;
    }

    /**
     * Get all pricing tiers for display, COMPUTED from the product's live JDS
     * wholesale tiers: halfDollarUp(wholesale / MARGIN_DENOMINATOR + ENGRAVING_LABOR_COST).
     * Margin + labor live in Caspio Service_Codes (JDS-MARGIN / JDS-LABOR), wholesale
     * comes from the JDS API — no hardcoded customer prices (Erik, 2026-06-11).
     * Tier boundaries derive from the product's case quantity (12-piece LTM threshold
     * matches JDS-LTM "per order under 12 pieces").
     * @param {Object} product - Product from API (wholesale tiers + caseQuantity)
     * @returns {Array} Array of tier objects with quantity ranges and prices
     * @throws {Error} when wholesale data is missing — caller shows its error state
     *                 (never render a made-up price)
     */
    getPricingTiers(product) {
        const caseQty = parseInt(product?.caseQuantity, 10) || 24;
        const LTM_THRESHOLD = 12;

        const priceFor = (wholesale, label) => {
            const w = parseFloat(wholesale);
            if (!Number.isFinite(w) || w <= 0) {
                throw new Error(`JDS wholesale price missing for tier ${label} — cannot compute customer price`);
            }
            return this.halfDollarUp(this.calculatePrice(w));
        };

        return [
            {
                range: `1-${LTM_THRESHOLD - 1}`,
                quantity: LTM_THRESHOLD - 1,
                customerPrice: priceFor(product.lessThanCasePrice, 'less-than-case'),
                description: 'Small Order',
                handlingFee: this.SMALL_ORDER_HANDLING_FEE // JDS-LTM
            },
            {
                range: `${LTM_THRESHOLD}-${caseQty - 1}`,
                quantity: caseQty - 1,
                customerPrice: priceFor(product.lessThanCasePrice, 'less-than-case'),
                description: 'Small Order'
            },
            {
                range: `${caseQty}-${caseQty * 5 - 1}`,
                quantity: caseQty, // Use minimum for display (most popular)
                customerPrice: priceFor(product.oneCase, 'one-case'),
                description: 'Standard Order'
            },
            {
                range: `${caseQty * 5}-${caseQty * 10 - 1}`,
                quantity: caseQty * 5,
                customerPrice: priceFor(product.fiveCases, 'five-cases'),
                description: 'Volume Order'
            },
            {
                range: `${caseQty * 10}+`,
                quantity: caseQty * 10,
                customerPrice: priceFor(product.tenCases, 'ten-cases'),
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
