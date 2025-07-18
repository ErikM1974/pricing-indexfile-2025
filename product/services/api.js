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
            const response = await fetch(`${this.baseUrl}/product-colors?styleNumber=${encodeURIComponent(styleNumber)}`);
            
            if (!response.ok) {
                throw new Error(`Failed to load product: ${response.statusText}`);
            }

            const data = await response.json();
            
            // Transform data to consistent format, including all new fields
            const product = {
                styleNumber: styleNumber,
                title: data.productTitle || '',
                description: data.PRODUCT_DESCRIPTION || '',
                colors: data.colors || [],
                // Include all the new fields from the API
                AVAILABLE_SIZES: data.AVAILABLE_SIZES || '',
                BRAND_NAME: data.BRAND_NAME || '',
                CATEGORY_NAME: data.CATEGORY_NAME || '',
                SUBCATEGORY_NAME: data.SUBCATEGORY_NAME || '',
                PRODUCT_STATUS: data.PRODUCT_STATUS || '',
                basePriceRange: data.basePriceRange || '',
                MSRP: data.MSRP || null,
                // Also preserve the original fields in case they're needed
                productTitle: data.productTitle || '',
                PRODUCT_DESCRIPTION: data.PRODUCT_DESCRIPTION || ''
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