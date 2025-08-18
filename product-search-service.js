/**
 * Product Search Service
 * Handles all product search API interactions with caching and optimization
 * @version 1.0.0
 */

class ProductSearchService {
    constructor() {
        this.baseURL = 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api';
        this.cache = new Map();
        this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
        this.requestCache = new Map(); // Prevent duplicate concurrent requests
        
        // Price calculation constants
        this.MARGIN = 0.60;
        this.FIXED_ADDITION = 15.00;
    }

    /**
     * Build query string from parameters
     */
    buildQueryString(params) {
        const queryParams = new URLSearchParams();
        
        Object.entries(params).forEach(([key, value]) => {
            if (value !== null && value !== undefined && value !== '') {
                if (Array.isArray(value)) {
                    // Handle arrays for multi-select filters
                    value.forEach(v => queryParams.append(key, v));
                } else {
                    queryParams.append(key, value);
                }
            }
        });
        
        return queryParams.toString();
    }

    /**
     * Get cache key from parameters
     */
    getCacheKey(endpoint, params) {
        return `${endpoint}:${JSON.stringify(params)}`;
    }

    /**
     * Check if cached data is still valid
     */
    isCacheValid(timestamp) {
        return Date.now() - timestamp < this.cacheTimeout;
    }

    /**
     * Main search method with caching
     */
    async searchProducts(params = {}) {
        const cacheKey = this.getCacheKey('products/search', params);
        
        // Check cache first
        const cached = this.cache.get(cacheKey);
        if (cached && this.isCacheValid(cached.timestamp)) {
            console.log('[ProductSearch] Returning cached results');
            return cached.data;
        }
        
        // Check if request is already in flight
        if (this.requestCache.has(cacheKey)) {
            console.log('[ProductSearch] Request already in flight, waiting...');
            return this.requestCache.get(cacheKey);
        }
        
        // Create the request promise
        const requestPromise = this.performSearch(params);
        this.requestCache.set(cacheKey, requestPromise);
        
        try {
            const result = await requestPromise;
            
            // Cache the result
            this.cache.set(cacheKey, {
                data: result,
                timestamp: Date.now()
            });
            
            return result;
        } finally {
            // Clear request cache
            this.requestCache.delete(cacheKey);
        }
    }

    /**
     * Perform the actual API search
     */
    async performSearch(params) {
        try {
            // Default parameters - increased to 48 for better initial display
            const defaultParams = {
                status: 'Active',
                limit: 48,
                page: 1
            };
            
            const finalParams = { ...defaultParams, ...params };
            const queryString = this.buildQueryString(finalParams);
            const url = `${this.baseURL}/products/search?${queryString}`;
            
            console.log('[ProductSearch] Fetching:', url);
            
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error(`Search failed: ${response.statusText}`);
            }
            
            const result = await response.json();
            
            if (result.success && result.data) {
                // Process products to add calculated prices
                if (result.data.products) {
                    result.data.products = this.processProducts(result.data.products);
                }
                return result.data;
            }
            
            throw new Error('Invalid API response format');
            
        } catch (error) {
            console.error('[ProductSearch] Search error:', error);
            throw error;
        }
    }

    /**
     * Process products to add calculated display prices
     */
    processProducts(products) {
        return products.map(product => {
            // Calculate display price using the formula
            let displayPrice = null;
            
            if (product.pricing) {
                // Use the current price if available
                const basePrice = product.pricing.current || product.pricing.minPrice;
                
                if (basePrice && basePrice > 0) {
                    // Apply formula: (price / 0.60) + 15
                    displayPrice = (basePrice / this.MARGIN) + this.FIXED_ADDITION;
                }
            }
            
            return {
                ...product,
                displayPrice: displayPrice ? `$${displayPrice.toFixed(2)}+` : 'QUOTE'
            };
        });
    }

    /**
     * Search with facets for building filter UI
     */
    async searchWithFacets(params = {}) {
        return this.searchProducts({
            ...params,
            includeFacets: true
        });
    }

    /**
     * Get product suggestions for autocomplete
     */
    async getSuggestions(query, limit = 5) {
        if (!query || query.length < 2) {
            return [];
        }
        
        try {
            const result = await this.searchProducts({
                q: query,
                limit: limit,
                includeFacets: false
            });
            
            return result.products || [];
        } catch (error) {
            console.error('[ProductSearch] Suggestion error:', error);
            return [];
        }
    }

    /**
     * Search by style number
     */
    async searchByStyle(styleNumber) {
        return this.searchProducts({
            q: styleNumber,
            limit: 10
        });
    }

    /**
     * Search by category with optional subcategory - with smart fallback
     */
    async searchByCategory(category, subcategory = null, additionalFilters = {}) {
        // First, try with both category and subcategory if provided
        if (subcategory) {
            console.log(`[ProductSearch] Trying search with category="${category}" AND subcategory="${subcategory}"`);
            
            const params = {
                category: category,
                subcategory: subcategory,
                ...additionalFilters
            };
            
            let result = await this.searchWithFacets(params);
            
            // If we got results, return them
            if (result.products && result.products.length > 0) {
                console.log(`[ProductSearch] Found ${result.products.length} products with both category and subcategory`);
                // Add metadata about search strategy
                if (!result.metadata) result.metadata = {};
                result.metadata.searchStrategy = 'category-and-subcategory';
                return result;
            }
            
            // No results with both - try just subcategory
            console.log(`[ProductSearch] No results with both, trying subcategory="${subcategory}" only`);
            const subcatParams = {
                subcategory: subcategory,
                ...additionalFilters
            };
            
            result = await this.searchWithFacets(subcatParams);
            
            if (result.products && result.products.length > 0) {
                console.log(`[ProductSearch] Found ${result.products.length} products with subcategory only`);
                // Add metadata about search strategy
                if (!result.metadata) result.metadata = {};
                result.metadata.searchStrategy = 'subcategory-only';
                return result;
            }
            
            // Still no results - fall back to category only
            console.log(`[ProductSearch] No results with subcategory, falling back to category="${category}" only`);
        }
        
        // Search with just category
        const categoryParams = {
            category: category,
            ...additionalFilters
        };
        
        const result = await this.searchWithFacets(categoryParams);
        console.log(`[ProductSearch] Found ${result.products ? result.products.length : 0} products with category only`);
        
        // Add metadata about search strategy
        if (!result.metadata) result.metadata = {};
        result.metadata.searchStrategy = subcategory ? 'category-only' : 'category';
        
        return result;
    }
    
    /**
     * Smart search that tries multiple strategies
     */
    async smartSearch(category, subcategory = null, additionalFilters = {}) {
        // This is an alias for searchByCategory with enhanced logging
        return this.searchByCategory(category, subcategory, additionalFilters);
    }

    /**
     * Get top sellers
     */
    async getTopSellers(limit = 6) {
        // Since the API might not have isTopSeller properly populated,
        // we'll use a curated list of known top sellers
        const topSellerStyles = ['PC54', 'PC450', 'C112', 'CP90', 'PC90H', 'PC78H'];
        
        try {
            const promises = topSellerStyles.map(style => 
                this.searchByStyle(style).catch(() => null)
            );
            
            const results = await Promise.all(promises);
            const products = [];
            
            results.forEach(result => {
                if (result && result.products && result.products.length > 0) {
                    products.push(result.products[0]);
                }
            });
            
            return products.slice(0, limit);
        } catch (error) {
            console.error('[ProductSearch] Error loading top sellers:', error);
            return [];
        }
    }

    /**
     * Load next page of results
     */
    async loadNextPage(currentParams, currentPage) {
        return this.searchProducts({
            ...currentParams,
            page: currentPage + 1
        });
    }

    /**
     * Clear cache
     */
    clearCache() {
        this.cache.clear();
        this.requestCache.clear();
        console.log('[ProductSearch] Cache cleared');
    }

    /**
     * Get available filters from facets
     */
    extractAvailableFilters(facets) {
        if (!facets) return null;
        
        return {
            categories: facets.categories || [],
            subcategories: facets.subcategories || [],
            brands: facets.brands || [],
            colors: facets.colors || [],
            sizes: facets.sizes || [],
            priceRanges: facets.priceRanges || []
        };
    }

    /**
     * Build filter display data
     */
    buildFilterDisplay(facets) {
        if (!facets) return [];
        
        const filters = [];
        
        // Categories
        if (facets.categories && facets.categories.length > 0) {
            filters.push({
                type: 'category',
                label: 'Categories',
                options: facets.categories.map(cat => ({
                    value: cat.name,
                    label: cat.name,
                    count: cat.count
                }))
            });
        }
        
        // Brands
        if (facets.brands && facets.brands.length > 0) {
            filters.push({
                type: 'brand',
                label: 'Brands',
                multiSelect: true,
                options: facets.brands.map(brand => ({
                    value: brand.name,
                    label: brand.name,
                    count: brand.count
                }))
            });
        }
        
        // Colors
        if (facets.colors && facets.colors.length > 0) {
            filters.push({
                type: 'color',
                label: 'Colors',
                multiSelect: true,
                collapsed: true,
                options: facets.colors.slice(0, 20).map(color => ({
                    value: color.name,
                    label: color.name,
                    count: color.count
                }))
            });
        }
        
        // Sizes
        if (facets.sizes && facets.sizes.length > 0) {
            filters.push({
                type: 'size',
                label: 'Sizes',
                multiSelect: true,
                collapsed: true,
                options: facets.sizes.map(size => ({
                    value: size.name,
                    label: size.name,
                    count: size.count
                }))
            });
        }
        
        // Price ranges
        if (facets.priceRanges && facets.priceRanges.length > 0) {
            filters.push({
                type: 'priceRange',
                label: 'Price Range',
                options: facets.priceRanges.map(range => ({
                    value: range.key,
                    label: range.label,
                    count: range.count
                }))
            });
        }
        
        return filters;
    }
}

// Export for use
window.ProductSearchService = ProductSearchService;