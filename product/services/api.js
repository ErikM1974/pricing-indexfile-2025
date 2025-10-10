/**
 * API Service
 * Centralized API communication with error handling and caching
 */

export class API {
    constructor() {
        this.baseUrl = '/api'; // Use local server proxy
        this.caspioUrl = 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api'; // Direct Caspio URL for new endpoints
        this.cache = new Map();
        this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
    }

    /**
     * Search for products by style number
     */
    async searchProducts(searchTerm) {
        if (!searchTerm || searchTerm.length < 2) {
            return [];
        }

        try {
            const response = await fetch(`${this.baseUrl}/stylesearch?term=${encodeURIComponent(searchTerm)}`);
            
            if (!response.ok) {
                throw new Error(`Search failed: ${response.statusText}`);
            }

            const data = await response.json();
            console.log('[API] Search response:', data);
            return data || [];
        } catch (error) {
            console.error('Search API error:', error);
            throw error;
        }
    }

    /**
     * Get product details including colors
     */
    async getProduct(styleNumber) {
        const cacheKey = `product_${styleNumber}`;

        // Check cache first
        const cached = this.getFromCache(cacheKey);
        if (cached) {
            return cached;
        }

        try {
            // Use direct Caspio API endpoint for product-details (has all 4 image types)
            const response = await fetch(`${this.caspioUrl}/product-details?styleNumber=${encodeURIComponent(styleNumber)}`);
            
            if (!response.ok) {
                throw new Error(`Failed to load product: ${response.statusText}`);
            }

            const data = await response.json();

            // product-details endpoint returns array of products (one per color)
            // Transform to the format expected by the app
            if (!Array.isArray(data) || data.length === 0) {
                throw new Error('No product data found');
            }

            // Use first item for product-level data, but collect all colors
            const firstProduct = data[0];

            const product = {
                styleNumber: styleNumber,
                title: firstProduct.PRODUCT_TITLE || '',
                description: firstProduct.PRODUCT_DESCRIPTION || '',
                // Transform array of products into colors array
                colors: data.map(item => ({
                    COLOR_NAME: item.COLOR_NAME,
                    colorName: item.COLOR_NAME,
                    color_name: item.COLOR_NAME,
                    CATALOG_COLOR: item.CATALOG_COLOR,
                    catalogColor: item.CATALOG_COLOR,
                    catalog_color: item.CATALOG_COLOR,
                    COLOR_SQUARE_IMAGE: item.COLOR_SQUARE_IMAGE,
                    colorSquareImage: item.COLOR_SQUARE_IMAGE,
                    // All 4 image types from product-details endpoint
                    FRONT_MODEL: item.FRONT_MODEL,
                    frontModel: item.FRONT_MODEL,
                    front_model: item.FRONT_MODEL,
                    BACK_MODEL: item.BACK_MODEL,
                    backModel: item.BACK_MODEL,
                    back_model: item.BACK_MODEL,
                    FRONT_FLAT: item.FRONT_FLAT,
                    frontFlat: item.FRONT_FLAT,
                    front_flat: item.FRONT_FLAT,
                    BACK_FLAT: item.BACK_FLAT,
                    backFlat: item.BACK_FLAT,
                    back_flat: item.BACK_FLAT,
                    // Main image fallback
                    MAIN_IMAGE_URL: item.FRONT_MODEL || item.FRONT_FLAT || item.MAIN_IMAGE_URL,
                    mainImageUrl: item.FRONT_MODEL || item.FRONT_FLAT || item.MAIN_IMAGE_URL,
                    main_image_url: item.FRONT_MODEL || item.FRONT_FLAT || item.MAIN_IMAGE_URL,
                    // Brand logo
                    BRAND_LOGO_IMAGE: item.BRAND_LOGO_IMAGE,
                    brandLogoImage: item.BRAND_LOGO_IMAGE,
                    BRAND_NAME: item.BRAND_NAME
                })),
                // Include all the product-level fields from the API
                AVAILABLE_SIZES: firstProduct.AVAILABLE_SIZES || '',
                BRAND_NAME: firstProduct.BRAND_NAME || '',
                CATEGORY_NAME: firstProduct.CATEGORY_NAME || '',
                SUBCATEGORY_NAME: firstProduct.SUBCATEGORY_NAME || '',
                PRODUCT_STATUS: firstProduct.PRODUCT_STATUS || '',
                basePriceRange: firstProduct.BASE_PRICE || '',
                MSRP: firstProduct.MSRP || null,
                // Also preserve the original fields in case they're needed
                productTitle: firstProduct.PRODUCT_TITLE || '',
                PRODUCT_DESCRIPTION: firstProduct.PRODUCT_DESCRIPTION || ''
            };

            // Cache the result
            this.setCache(cacheKey, product);

            return product;
        } catch (error) {
            console.error('Product API error:', error);
            throw error;
        }
    }

    /**
     * Get inventory for a specific style and color
     */
    async getInventory(styleNumber, colorCode) {
        const cacheKey = `inventory_${styleNumber}_${colorCode}`;
        
        // Check cache first
        const cached = this.getFromCache(cacheKey);
        if (cached) {
            return cached;
        }

        try {
            const response = await fetch(
                `${this.baseUrl}/sizes-by-style-color?styleNumber=${encodeURIComponent(styleNumber)}&color=${encodeURIComponent(colorCode)}`
            );
            
            if (!response.ok) {
                throw new Error(`Failed to load inventory: ${response.statusText}`);
            }

            const data = await response.json();
            
            // Cache the result
            this.setCache(cacheKey, data);
            
            return data;
        } catch (error) {
            console.error('Inventory API error:', error);
            throw error;
        }
    }

    /**
     * Get base item costs for a specific style
     */
    async getBaseItemCosts(styleNumber) {
        const cacheKey = `base_costs_${styleNumber}`;
        
        // Check cache first
        const cached = this.getFromCache(cacheKey);
        if (cached) {
            return cached;
        }

        try {
            // Use direct Caspio URL for base-item-costs
            const response = await fetch(`${this.caspioUrl}/base-item-costs?styleNumber=${encodeURIComponent(styleNumber)}`);
            
            if (!response.ok) {
                throw new Error(`Failed to load base costs: ${response.statusText}`);
            }

            const data = await response.json();
            
            // Cache the result
            this.setCache(cacheKey, data);
            
            return data;
        } catch (error) {
            console.error('Base costs API error:', error);
            throw error;
        }
    }

    /**
     * Cache management
     */
    getFromCache(key) {
        const cached = this.cache.get(key);
        if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
            return cached.data;
        }
        this.cache.delete(key);
        return null;
    }

    setCache(key, data) {
        this.cache.set(key, {
            data: data,
            timestamp: Date.now()
        });
    }

    clearCache() {
        this.cache.clear();
    }
}