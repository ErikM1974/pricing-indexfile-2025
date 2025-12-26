/**
 * Product Search Module
 * Handles all API interactions with the new /api/products/search endpoint
 * Provides search, filtering, and pagination functionality
 */

class ProductSearch {
    constructor() {
        this.baseURL = 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/products/search';
        this.cache = new Map();
        this.cacheTimeout = 120000; // 2 minutes
        this.currentRequest = null;
        
        // Current search state
        this.state = {
            query: '',
            filters: {
                category: [],
                subcategory: [],
                brand: [],
                color: [],
                size: [],
                minPrice: null,
                maxPrice: null,
                status: '',
                isTopSeller: null
            },
            sort: 'name_asc',
            page: 1,
            limit: 24,
            includeFacets: true
        };
        
        // Results
        this.lastResults = null;
        this.facets = null;
    }
    
    /**
     * Build query string from current state
     */
    buildQueryString() {
        const params = new URLSearchParams();
        
        // Add search query
        if (this.state.query) {
            params.append('q', this.state.query);
        }
        
        // Add filters
        Object.entries(this.state.filters).forEach(([key, value]) => {
            if (value !== null && value !== undefined) {
                if (Array.isArray(value) && value.length > 0) {
                    params.append(key, value.join(','));
                } else if (!Array.isArray(value) && value !== '') {
                    params.append(key, value);
                }
            }
        });
        
        // Add pagination and sorting
        params.append('sort', this.state.sort);
        params.append('page', this.state.page);
        params.append('limit', this.state.limit);
        params.append('includeFacets', this.state.includeFacets);
        
        return params.toString();
    }
    
    /**
     * Execute search with current state
     */
    async search() {
        const queryString = this.buildQueryString();
        const cacheKey = queryString;
        
        // Check cache
        if (this.cache.has(cacheKey)) {
            const cached = this.cache.get(cacheKey);
            if (Date.now() - cached.timestamp < this.cacheTimeout) {
                this.lastResults = cached.data;
                this.facets = cached.data.facets;
                return cached.data;
            }
        }
        
        // Cancel previous request if still pending
        if (this.currentRequest) {
            this.currentRequest.abort();
        }
        
        // Create new request
        const controller = new AbortController();
        this.currentRequest = controller;
        
        try {
            const response = await fetch(`${this.baseURL}?${queryString}`, {
                signal: controller.signal
            });
            
            if (!response.ok) {
                throw new Error(`Search failed: ${response.statusText}`);
            }
            
            const result = await response.json();
            
            if (result.success) {
                // Cache the results
                this.cache.set(cacheKey, {
                    data: result.data,
                    timestamp: Date.now()
                });
                
                this.lastResults = result.data;
                this.facets = result.data.facets;
                return result.data;
            } else {
                throw new Error(result.error?.message || 'Search failed');
            }
            
        } catch (error) {
            if (error.name === 'AbortError') {
                console.log('Search request cancelled');
                return null;
            }
            console.error('Search error:', error);
            throw error;
        } finally {
            this.currentRequest = null;
        }
    }
    
    /**
     * Quick search (for autocomplete)
     */
    async quickSearch(query, limit = 5) {
        if (!query || query.length < 2) return { products: [] };
        
        const params = new URLSearchParams({
            q: query,
            limit: limit,
            includeFacets: false,
            status: ''
        });
        
        try {
            const response = await fetch(`${this.baseURL}?${params}`);
            const result = await response.json();
            
            if (result.success) {
                return result.data;
            }
            return { products: [] };
        } catch (error) {
            console.error('Quick search error:', error);
            return { products: [] };
        }
    }
    
    /**
     * Get products by category
     */
    async getByCategory(category, page = 1, limit = 24) {
        this.resetFilters();
        this.state.filters.category = [category];
        this.state.page = page;
        this.state.limit = limit;
        return this.search();
    }
    
    /**
     * Get featured products
     */
    async getFeatured(limit = 12) {
        this.resetFilters();
        this.state.sort = 'newest';
        this.state.limit = limit;
        this.state.includeFacets = false;
        return this.search();
    }
    
    /**
     * Get top sellers
     */
    async getTopSellers(limit = 8) {
        this.resetFilters();
        this.state.filters.isTopSeller = true;
        this.state.limit = limit;
        this.state.includeFacets = false;
        return this.search();
    }
    
    /**
     * Update search query
     */
    setQuery(query) {
        this.state.query = query;
        this.state.page = 1; // Reset to first page
    }
    
    /**
     * Update filter
     */
    setFilter(filterName, value) {
        if (this.state.filters.hasOwnProperty(filterName)) {
            this.state.filters[filterName] = value;
            this.state.page = 1; // Reset to first page
        }
    }
    
    /**
     * Toggle array filter value
     */
    toggleFilterValue(filterName, value) {
        if (!this.state.filters.hasOwnProperty(filterName)) return;
        
        const filter = this.state.filters[filterName];
        if (!Array.isArray(filter)) {
            this.state.filters[filterName] = [value];
        } else {
            const index = filter.indexOf(value);
            if (index > -1) {
                filter.splice(index, 1);
            } else {
                filter.push(value);
            }
        }
        this.state.page = 1; // Reset to first page
    }
    
    /**
     * Set price range
     */
    setPriceRange(min, max) {
        this.state.filters.minPrice = min;
        this.state.filters.maxPrice = max;
        this.state.page = 1;
    }
    
    /**
     * Set sort order
     */
    setSort(sortOrder) {
        this.state.sort = sortOrder;
        this.state.page = 1;
    }
    
    /**
     * Navigate to page
     */
    setPage(page) {
        this.state.page = page;
    }
    
    /**
     * Set page size
     */
    setLimit(limit) {
        this.state.limit = Math.min(limit, 100); // Max 100
        this.state.page = 1;
    }
    
    /**
     * Reset all filters
     */
    resetFilters() {
        this.state = {
            query: '',
            filters: {
                category: [],
                subcategory: [],
                brand: [],
                color: [],
                size: [],
                minPrice: null,
                maxPrice: null,
                status: '',
                isTopSeller: null
            },
            sort: 'name_asc',
            page: 1,
            limit: 24,
            includeFacets: true
        };
    }
    
    /**
     * Get active filter count
     */
    getActiveFilterCount() {
        let count = 0;
        
        Object.entries(this.state.filters).forEach(([key, value]) => {
            if (key === 'status' && value === 'Active') return; // Default value
            
            if (Array.isArray(value) && value.length > 0) {
                count += value.length;
            } else if (value !== null && value !== undefined && value !== '') {
                count++;
            }
        });
        
        return count;
    }
    
    /**
     * Get current state for URL
     */
    getStateForURL() {
        const params = new URLSearchParams();
        
        if (this.state.query) params.set('q', this.state.query);
        
        Object.entries(this.state.filters).forEach(([key, value]) => {
            if (value !== null && value !== undefined) {
                if (Array.isArray(value) && value.length > 0) {
                    params.set(key, value.join(','));
                } else if (!Array.isArray(value) && value !== '' && !(key === 'status' && value === 'Active')) {
                    params.set(key, value);
                }
            }
        });
        
        if (this.state.sort !== 'name_asc') params.set('sort', this.state.sort);
        if (this.state.page > 1) params.set('page', this.state.page);
        if (this.state.limit !== 24) params.set('limit', this.state.limit);
        
        return params.toString();
    }
    
    /**
     * Load state from URL
     */
    loadStateFromURL(queryString) {
        const params = new URLSearchParams(queryString);
        
        // Reset first
        this.resetFilters();
        
        // Load query
        if (params.has('q')) {
            this.state.query = params.get('q');
        }
        
        // Load filters
        const arrayFilters = ['category', 'subcategory', 'brand', 'color', 'size'];
        
        arrayFilters.forEach(filter => {
            if (params.has(filter)) {
                this.state.filters[filter] = params.get(filter).split(',');
            }
        });
        
        // Load other filters
        if (params.has('minPrice')) this.state.filters.minPrice = parseFloat(params.get('minPrice'));
        if (params.has('maxPrice')) this.state.filters.maxPrice = parseFloat(params.get('maxPrice'));
        if (params.has('status')) this.state.filters.status = params.get('status');
        if (params.has('isTopSeller')) this.state.filters.isTopSeller = params.get('isTopSeller') === 'true';
        
        // Load pagination and sorting
        if (params.has('sort')) this.state.sort = params.get('sort');
        if (params.has('page')) this.state.page = parseInt(params.get('page'));
        if (params.has('limit')) this.state.limit = parseInt(params.get('limit'));
    }
    
    /**
     * Clear cache
     */
    clearCache() {
        this.cache.clear();
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ProductSearch;
}