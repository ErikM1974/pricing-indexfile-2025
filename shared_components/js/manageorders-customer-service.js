/**
 * ManageOrders Customer Service
 *
 * Browser-side service that fetches customer data from caspio-pricing-proxy server
 * and provides instant client-side search for autocomplete functionality.
 *
 * Features:
 * - Fetches customers from proxy server (NOT ShopWorks directly)
 * - Caches in sessionStorage with daily refresh
 * - Client-side search for instant autocomplete
 * - Handles edge cases (empty phones, email newlines, etc.)
 * - No credentials stored in browser (security best practice)
 *
 * Usage:
 *   const service = new ManageOrdersCustomerService();
 *   await service.initialize();
 *   const results = service.searchCustomers('acme');
 */

class ManageOrdersCustomerService {
    constructor() {
        this.baseURL = 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';
        this.customers = [];
        this.cacheKey = 'manageorders_customers_cache';
        this.cacheDuration = 24 * 60 * 60 * 1000; // 1 day in milliseconds

        console.log('[ManageOrdersService] Service initialized');
    }

    /**
     * Initialize the service by loading customer data from cache or server
     * @returns {Promise<void>}
     */
    async initialize() {
        console.log('[ManageOrdersService] Initializing...');

        // Try to load from cache first
        const cached = this.loadCache();

        if (cached && this.isCacheValid(cached)) {
            this.customers = cached.data;
            console.log('[ManageOrdersService] ✓ Loaded from cache:', this.customers.length, 'customers');
            return;
        }

        // Cache invalid or missing - fetch from server
        console.log('[ManageOrdersService] Cache expired, fetching from server...');

        try {
            const response = await fetch(`${this.baseURL}/api/manageorders/customers`);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();

            if (!data.customers || !Array.isArray(data.customers)) {
                throw new Error('Invalid response format from server');
            }

            this.customers = data.customers;
            console.log('[ManageOrdersService] ✓ Fetched from server:', this.customers.length, 'customers');

            // Save to cache
            this.saveCache(this.customers);

        } catch (error) {
            console.error('[ManageOrdersService] ✗ Failed to fetch customers:', error);

            // Try to use expired cache as fallback
            if (cached && cached.data) {
                console.warn('[ManageOrdersService] Using expired cache as fallback');
                this.customers = cached.data;
            } else {
                throw error; // No fallback available
            }
        }
    }

    /**
     * Search customers by company name (case-insensitive)
     * @param {string} query - Search query
     * @returns {Array} - Array of matching customers (max 10)
     */
    searchCustomers(query) {
        if (!query || query.length < 2) {
            return [];
        }

        const searchTerm = query.toLowerCase().trim();

        const results = this.customers.filter(customer => {
            return customer.CustomerName &&
                   customer.CustomerName.toLowerCase().includes(searchTerm);
        });

        // Sort by relevance (exact match first, then starts with, then contains)
        results.sort((a, b) => {
            const aName = a.CustomerName.toLowerCase();
            const bName = b.CustomerName.toLowerCase();

            // Exact match
            if (aName === searchTerm) return -1;
            if (bName === searchTerm) return 1;

            // Starts with
            const aStarts = aName.startsWith(searchTerm);
            const bStarts = bName.startsWith(searchTerm);
            if (aStarts && !bStarts) return -1;
            if (bStarts && !aStarts) return 1;

            // Alphabetical
            return aName.localeCompare(bName);
        });

        return results.slice(0, 10); // Limit to 10 results
    }

    /**
     * Get customer by ID
     * @param {number} id - Customer ID
     * @returns {Object|null} - Customer object or null
     */
    getCustomerById(id) {
        return this.customers.find(c => c.id_Customer === id) || null;
    }

    /**
     * Load cache from sessionStorage
     * @returns {Object|null} - Cached data or null
     */
    loadCache() {
        try {
            const cached = sessionStorage.getItem(this.cacheKey);
            if (!cached) return null;

            return JSON.parse(cached);
        } catch (error) {
            console.error('[ManageOrdersService] Failed to load cache:', error);
            return null;
        }
    }

    /**
     * Save customers to sessionStorage cache
     * @param {Array} customers - Customer data to cache
     */
    saveCache(customers) {
        try {
            const cacheData = {
                data: customers,
                timestamp: Date.now(),
                count: customers.length
            };

            sessionStorage.setItem(this.cacheKey, JSON.stringify(cacheData));
            console.log('[ManageOrdersService] ✓ Saved to cache:', customers.length, 'customers');
        } catch (error) {
            console.error('[ManageOrdersService] Failed to save cache:', error);
        }
    }

    /**
     * Check if cache is still valid (< 24 hours old)
     * @param {Object} cached - Cached data object
     * @returns {boolean} - True if cache is valid
     */
    isCacheValid(cached) {
        if (!cached || !cached.timestamp) return false;

        const age = Date.now() - cached.timestamp;
        const isValid = age < this.cacheDuration;

        if (!isValid) {
            console.log('[ManageOrdersService] Cache expired (age:', Math.round(age / 1000 / 60 / 60), 'hours)');
        }

        return isValid;
    }

    /**
     * Force refresh cache from server
     * @returns {Promise<void>}
     */
    async refreshCache() {
        console.log('[ManageOrdersService] Force refreshing cache...');

        try {
            const response = await fetch(`${this.baseURL}/api/manageorders/customers?refresh=true`);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            this.customers = data.customers;
            this.saveCache(this.customers);

            console.log('[ManageOrdersService] ✓ Cache refreshed:', this.customers.length, 'customers');
        } catch (error) {
            console.error('[ManageOrdersService] ✗ Failed to refresh cache:', error);
            throw error;
        }
    }

    /**
     * Get service status
     * @returns {Object} - Status information
     */
    getStatus() {
        const cached = this.loadCache();

        return {
            customersLoaded: this.customers.length,
            cacheAge: cached ? Math.round((Date.now() - cached.timestamp) / 1000 / 60) : null,
            cacheValid: cached ? this.isCacheValid(cached) : false,
            endpoint: `${this.baseURL}/api/manageorders/customers`
        };
    }
}

// Make service available globally
window.ManageOrdersCustomerService = ManageOrdersCustomerService;

console.log('[ManageOrdersService] ✓ Service class loaded');
