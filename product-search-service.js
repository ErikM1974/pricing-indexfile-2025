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

        // Smart search - Brand name detection dictionary
        this.BRAND_KEYWORDS = {
            // Major brands (lowercase for matching)
            'nike': 'Nike',
            'carhartt': 'Carhartt',
            'ogio': 'OGIO',
            'port authority': 'Port Authority',
            'portauthority': 'Port Authority',
            'port & company': 'Port & Company',
            'port company': 'Port & Company',
            'gildan': 'Gildan',
            'champion': 'Champion',
            'hanes': 'Hanes',
            'adidas': 'adidas',
            'under armour': 'Under Armour',
            'underarmour': 'Under Armour',
            'new era': 'New Era',
            'newera': 'New Era',
            'richardson': 'Richardson',
            'columbia': 'Columbia',
            'patagonia': 'Patagonia',
            'the north face': 'The North Face',
            'northface': 'The North Face',
            'north face': 'The North Face',
            'allmade': 'AllMade',
            'all made': 'AllMade',
            'bella canvas': 'Bella+Canvas',
            'bella+canvas': 'Bella+Canvas',
            'bellacanvas': 'Bella+Canvas',
            'next level': 'Next Level Apparel',
            'nextlevel': 'Next Level Apparel',
            'american apparel': 'American Apparel',
            'yeti': 'YETI',
            'stanley': 'Stanley'
        };

        // Smart search - Category keyword mapping
        this.CATEGORY_KEYWORDS = {
            // Outerwear
            'jacket': 'Outerwear',
            'jackets': 'Outerwear',
            'coat': 'Outerwear',
            'coats': 'Outerwear',
            'vest': 'Outerwear',
            'vests': 'Outerwear',
            'hoodie': 'Fleece',
            'hoodies': 'Fleece',
            'sweatshirt': 'Fleece',
            'sweatshirts': 'Fleece',
            'fleece': 'Fleece',

            // Shirts
            'shirt': 'T-Shirts',
            'shirts': 'T-Shirts',
            'tee': 'T-Shirts',
            'tees': 'T-Shirts',
            't-shirt': 'T-Shirts',
            't-shirts': 'T-Shirts',
            'tshirt': 'T-Shirts',
            'tshirts': 'T-Shirts',
            'polo': 'Polos/Knits',
            'polos': 'Polos/Knits',
            'knit': 'Polos/Knits',
            'knits': 'Polos/Knits',

            // Headwear
            'hat': 'Headwear',
            'hats': 'Headwear',
            'cap': 'Headwear',
            'caps': 'Headwear',
            'beanie': 'Headwear',
            'beanies': 'Headwear',

            // Bags
            'bag': 'Bags',
            'bags': 'Bags',
            'backpack': 'Bags',
            'backpacks': 'Bags',
            'tote': 'Bags',
            'totes': 'Bags',

            // Accessories
            'glove': 'Accessories',
            'gloves': 'Accessories',
            'scarf': 'Accessories',
            'scarves': 'Accessories',
            'towel': 'Accessories',
            'towels': 'Accessories'
        };
    }

    /**
     * Build query string from parameters
     */
    buildQueryString(params) {
        const queryParams = new URLSearchParams();

        Object.entries(params).forEach(([key, value]) => {
            // Special handling for status - empty string means "all statuses"
            // Must be explicitly passed to API, otherwise API defaults to "Active" only
            if (key === 'status') {
                queryParams.append(key, value ?? '');
                return;
            }

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
            // Empty status shows all products (Active, New, Coming soon, etc.)
            const defaultParams = {
                status: '',
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
     * Detect if a search term looks like a style number
     * Style number = no spaces AND contains at least one digit
     * Examples: PC61, C112, 112, 112FP, ST-350
     * Text search = has spaces OR no digits (e.g., "blue hoodie", "Richardson")
     */
    isStyleNumber(term) {
        if (!term || term.length < 2) return false;

        const trimmed = term.trim();
        const hasNoSpaces = !/\s/.test(trimmed);
        const hasDigit = /\d/.test(trimmed);
        return hasNoSpaces && hasDigit;
    }

    /**
     * Search using the style autocomplete endpoint (more accurate for style numbers)
     */
    async searchByStyleAutocomplete(styleNumber) {
        try {
            const response = await fetch(`/api/stylesearch?term=${encodeURIComponent(styleNumber)}`);
            
            if (!response.ok) {
                throw new Error(`Style search failed: ${response.statusText}`);
            }
            
            const suggestions = await response.json();
            
            // Transform autocomplete results to match our standard format
            const products = suggestions.map(item => ({
                styleNumber: item.value,
                productName: item.label,
                displayPrice: 'View Details',
                images: {
                    thumbnail: '/placeholder.jpg'
                },
                features: {}
            }));
            
            return {
                products: products,
                pagination: {
                    page: 1,
                    limit: products.length,
                    total: products.length,
                    totalPages: 1
                }
            };
        } catch (error) {
            console.error('[ProductSearch] Style autocomplete error:', error);
            // Fall back to regular search
            return this.searchByStyle(styleNumber);
        }
    }

    /**
     * Parse query to detect brand names and category keywords
     * Returns: { detectedBrand, detectedCategory, cleanedQuery, appliedFilters }
     */
    parseSmartQuery(query) {
        const lowerQuery = query.toLowerCase().trim();
        let detectedBrand = null;
        let detectedCategory = null;
        let remainingWords = lowerQuery.split(/\s+/);
        const appliedFilters = [];

        // Check for brand keywords (try multi-word brands first)
        for (const [keyword, brandName] of Object.entries(this.BRAND_KEYWORDS)) {
            if (lowerQuery.includes(keyword)) {
                detectedBrand = brandName;
                appliedFilters.push({ type: 'brand', value: brandName, keyword });
                // Remove brand keyword from remaining words
                const keywordWords = keyword.split(/\s+/);
                remainingWords = remainingWords.filter(word => !keywordWords.includes(word));
                break; // Only detect one brand
            }
        }

        // Check for category keywords
        for (const [keyword, categoryName] of Object.entries(this.CATEGORY_KEYWORDS)) {
            if (remainingWords.includes(keyword)) {
                detectedCategory = categoryName;
                appliedFilters.push({ type: 'category', value: categoryName, keyword });
                // Remove category keyword from remaining words
                remainingWords = remainingWords.filter(word => word !== keyword);
                break; // Only detect one category
            }
        }

        // Build cleaned query from remaining words
        const cleanedQuery = remainingWords.join(' ').trim();

        console.log('[ProductSearch] Smart query parsed:', {
            original: query,
            detectedBrand,
            detectedCategory,
            cleanedQuery,
            appliedFilters
        });

        return {
            detectedBrand,
            detectedCategory,
            cleanedQuery,
            appliedFilters
        };
    }

    /**
     * Smart search that combines style search and text search
     * Now also detects brand names and category keywords
     */
    async smartSearch(query, params = {}) {
        if (!query || query.length < 2) {
            return { products: [], pagination: { page: 1, limit: 0, total: 0, totalPages: 0 } };
        }

        const trimmedQuery = query.trim();

        // Parse query for smart keyword detection
        const parsed = this.parseSmartQuery(trimmedQuery);

        // Build search parameters with detected filters
        const searchParams = { ...params };

        // Apply detected brand filter
        if (parsed.detectedBrand) {
            if (!searchParams.brand) {
                searchParams.brand = [];
            }
            if (Array.isArray(searchParams.brand)) {
                if (!searchParams.brand.includes(parsed.detectedBrand)) {
                    searchParams.brand.push(parsed.detectedBrand);
                }
            } else {
                searchParams.brand = [parsed.detectedBrand];
            }
        }

        // Apply detected category filter
        if (parsed.detectedCategory) {
            searchParams.category = parsed.detectedCategory;
        }

        // Use cleaned query if we detected filters, otherwise use original
        const searchQuery = parsed.appliedFilters.length > 0 && parsed.cleanedQuery
            ? parsed.cleanedQuery
            : trimmedQuery;

        const isStyle = this.isStyleNumber(searchQuery);

        console.log(`[ProductSearch] Smart search for "${trimmedQuery}"`, {
            isStyle,
            detectedBrand: parsed.detectedBrand,
            detectedCategory: parsed.detectedCategory,
            cleanedQuery: parsed.cleanedQuery,
            searchParams
        });

        if (isStyle) {
            // For style numbers, use full product search API but filter results
            // to only show exact style matches (e.g., "PC61" matches PC61, PC61LS, PC61M)
            // This gives us full product data (images, prices) unlike autocomplete API
            try {
                console.log('[ProductSearch] Style search - fetching full product data for filtering');

                // Use full product search to get complete data
                const results = await this.searchProducts({
                    ...searchParams,
                    q: searchQuery,
                    limit: 50  // Get enough results for filtering
                });

                if (!results.products || results.products.length === 0) {
                    return {
                        products: [],
                        pagination: { page: 1, total: 0, totalPages: 0 },
                        smartFilters: parsed.appliedFilters
                    };
                }

                // Filter to only exact style matches
                const queryLower = searchQuery.toLowerCase();
                const exactMatches = results.products.filter(product => {
                    const styleLower = (product.styleNumber || '').toLowerCase();

                    // Match if style equals query OR starts with query
                    // Examples: "pc61" matches "PC61", "PC61LS", "PC61M"
                    // But NOT "SPC61" or "DISC61"
                    return styleLower === queryLower || styleLower.startsWith(queryLower);
                });

                console.log(`[ProductSearch] Filtered ${results.products.length} results to ${exactMatches.length} exact matches`);

                return {
                    products: exactMatches,
                    pagination: {
                        page: 1,
                        limit: exactMatches.length,
                        total: exactMatches.length,
                        totalPages: 1
                    },
                    smartFilters: parsed.appliedFilters
                };

            } catch (error) {
                console.error('[ProductSearch] Style search error, falling back:', error);
                // Fall back to regular search only if style search fails
                return this.searchProducts({ ...searchParams, q: searchQuery });
            }
        } else {
            // For non-style searches, use the broad search WITH FACETS
            const result = await this.searchWithFacets({ ...searchParams, q: searchQuery });
            // Attach smart filters to result
            result.smartFilters = parsed.appliedFilters;
            return result;
        }
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