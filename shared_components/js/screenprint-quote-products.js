/**
 * Screen Print Quote Products Manager
 * Handles product search, selection, and management for screen print quotes
 */

class ScreenPrintProductManager {
    constructor() {
        this.baseURL = 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';
        this.selectedProducts = [];
        this.productCache = new Map();
        console.log('[ScreenPrintProductManager] Initialized');
    }

    /**
     * Search for products by style number or keyword
     */
    async searchProducts(searchTerm) {
        try {
            if (!searchTerm || searchTerm.length < 2) {
                return [];
            }
            
            // Check cache first
            const cacheKey = `search_${searchTerm.toLowerCase()}`;
            if (this.productCache.has(cacheKey)) {
                console.log('[ScreenPrintProductManager] Returning cached search results');
                return this.productCache.get(cacheKey);
            }
            
            // Search API
            const response = await fetch(`${this.baseURL}/api/products/search?q=${encodeURIComponent(searchTerm)}&limit=10`);
            if (!response.ok) {
                throw new Error('Product search failed');
            }
            
            const data = await response.json();
            const products = data.products || [];
            
            // Cache results
            this.productCache.set(cacheKey, products);
            
            console.log(`[ScreenPrintProductManager] Found ${products.length} products`);
            return products;
            
        } catch (error) {
            console.error('[ScreenPrintProductManager] Search error:', error);
            return [];
        }
    }

    /**
     * Get product details including colors and sizes
     */
    async getProductDetails(styleNumber) {
        try {
            // Check cache
            const cacheKey = `details_${styleNumber}`;
            if (this.productCache.has(cacheKey)) {
                return this.productCache.get(cacheKey);
            }
            
            // Fetch product details
            const [detailsResponse, colorsResponse] = await Promise.all([
                fetch(`${this.baseURL}/api/product-details?styleNumber=${styleNumber}`),
                fetch(`${this.baseURL}/api/product-colors?styleNumber=${styleNumber}`)
            ]);
            
            if (!detailsResponse.ok || !colorsResponse.ok) {
                throw new Error('Failed to fetch product details');
            }
            
            const details = await detailsResponse.json();
            const colors = await colorsResponse.json();
            
            const productData = {
                ...details.data,
                availableColors: colors.data || []
            };
            
            // Cache result
            this.productCache.set(cacheKey, productData);
            
            return productData;
            
        } catch (error) {
            console.error('[ScreenPrintProductManager] Error fetching product details:', error);
            return null;
        }
    }

    /**
     * Get available sizes for a specific style and color
     */
    async getAvailableSizes(styleNumber, color) {
        try {
            const cacheKey = `sizes_${styleNumber}_${color}`;
            if (this.productCache.has(cacheKey)) {
                return this.productCache.get(cacheKey);
            }
            
            const response = await fetch(
                `${this.baseURL}/api/sizes-by-style-color?styleNumber=${styleNumber}&color=${encodeURIComponent(color)}`
            );
            
            if (!response.ok) {
                throw new Error('Failed to fetch sizes');
            }
            
            const data = await response.json();
            const sizes = data.data || [];
            
            // Cache result
            this.productCache.set(cacheKey, sizes);
            
            return sizes;
            
        } catch (error) {
            console.error('[ScreenPrintProductManager] Error fetching sizes:', error);
            return ['S', 'M', 'L', 'XL', '2XL', '3XL']; // Default sizes as fallback
        }
    }

    /**
     * Get color swatches for visual display
     */
    async getColorSwatches(styleNumber) {
        try {
            const cacheKey = `swatches_${styleNumber}`;
            if (this.productCache.has(cacheKey)) {
                return this.productCache.get(cacheKey);
            }
            
            const response = await fetch(`${this.baseURL}/api/color-swatches?styleNumber=${styleNumber}`);
            if (!response.ok) {
                return [];
            }
            
            const data = await response.json();
            const swatches = data.data || [];
            
            // Cache result
            this.productCache.set(cacheKey, swatches);
            
            return swatches;
            
        } catch (error) {
            console.error('[ScreenPrintProductManager] Error fetching swatches:', error);
            return [];
        }
    }

    /**
     * Add product to quote
     */
    addProduct(productData) {
        const product = {
            id: `product_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            styleNumber: productData.styleNumber,
            productName: productData.productName,
            brand: productData.brand,
            color: productData.color,
            colorCode: productData.colorCode || '',
            imageUrl: productData.imageUrl || '',
            sizeBreakdown: productData.sizeBreakdown || {},
            quantity: this.calculateTotalQuantity(productData.sizeBreakdown),
            locations: productData.locations || [],
            basePrice: 0, // Will be calculated by pricing service
            unitPrice: 0, // Will be calculated by pricing service
            lineTotal: 0  // Will be calculated by pricing service
        };
        
        this.selectedProducts.push(product);
        console.log('[ScreenPrintProductManager] Product added:', product);
        
        return product;
    }

    /**
     * Update product in quote
     */
    updateProduct(productId, updates) {
        const index = this.selectedProducts.findIndex(p => p.id === productId);
        if (index !== -1) {
            this.selectedProducts[index] = {
                ...this.selectedProducts[index],
                ...updates
            };
            
            // Recalculate quantity if size breakdown changed
            if (updates.sizeBreakdown) {
                this.selectedProducts[index].quantity = this.calculateTotalQuantity(updates.sizeBreakdown);
            }
            
            console.log('[ScreenPrintProductManager] Product updated:', this.selectedProducts[index]);
            return this.selectedProducts[index];
        }
        
        return null;
    }

    /**
     * Remove product from quote
     */
    removeProduct(productId) {
        const index = this.selectedProducts.findIndex(p => p.id === productId);
        if (index !== -1) {
            const removed = this.selectedProducts.splice(index, 1)[0];
            console.log('[ScreenPrintProductManager] Product removed:', removed);
            return true;
        }
        return false;
    }

    /**
     * Get all selected products
     */
    getSelectedProducts() {
        return this.selectedProducts;
    }

    /**
     * Get total quantity across all products
     */
    getTotalQuantity() {
        return this.selectedProducts.reduce((total, product) => total + product.quantity, 0);
    }

    /**
     * Calculate total quantity from size breakdown
     */
    calculateTotalQuantity(sizeBreakdown) {
        if (!sizeBreakdown || typeof sizeBreakdown !== 'object') {
            return 0;
        }
        
        return Object.values(sizeBreakdown).reduce((sum, qty) => sum + (parseInt(qty) || 0), 0);
    }

    /**
     * Clear all selected products
     */
    clearProducts() {
        this.selectedProducts = [];
        console.log('[ScreenPrintProductManager] All products cleared');
    }

    /**
     * Format product display name
     */
    formatProductDisplay(product) {
        const parts = [];
        
        if (product.styleNumber) {
            parts.push(product.styleNumber);
        }
        
        if (product.productName) {
            parts.push(product.productName);
        }
        
        if (product.color) {
            parts.push(product.color);
        }
        
        return parts.join(' - ');
    }

    /**
     * Format size breakdown display
     */
    formatSizeBreakdown(sizeBreakdown) {
        if (!sizeBreakdown || Object.keys(sizeBreakdown).length === 0) {
            return 'No sizes selected';
        }
        
        const sizes = [];
        Object.entries(sizeBreakdown).forEach(([size, qty]) => {
            if (qty > 0) {
                sizes.push(`${size}(${qty})`);
            }
        });
        
        return sizes.join(' ');
    }

    /**
     * Validate product data before adding
     */
    validateProduct(productData) {
        const errors = [];
        
        if (!productData.styleNumber) {
            errors.push('Style number is required');
        }
        
        if (!productData.color) {
            errors.push('Color selection is required');
        }
        
        if (!productData.sizeBreakdown || this.calculateTotalQuantity(productData.sizeBreakdown) === 0) {
            errors.push('At least one size quantity is required');
        }
        
        return {
            isValid: errors.length === 0,
            errors: errors
        };
    }

    /**
     * Group products by style for display
     */
    groupProductsByStyle() {
        const grouped = {};
        
        this.selectedProducts.forEach(product => {
            const key = product.styleNumber;
            if (!grouped[key]) {
                grouped[key] = {
                    styleNumber: product.styleNumber,
                    productName: product.productName,
                    brand: product.brand,
                    items: []
                };
            }
            grouped[key].items.push(product);
        });
        
        return grouped;
    }

    /**
     * Export products for quote generation
     */
    exportForQuote() {
        return this.selectedProducts.map(product => ({
            styleNumber: product.styleNumber,
            productName: product.productName,
            color: product.color,
            colorCode: product.colorCode,
            quantity: product.quantity,
            sizeBreakdown: product.sizeBreakdown,
            locations: product.locations,
            imageUrl: product.imageUrl,
            basePrice: product.basePrice,
            unitPrice: product.unitPrice,
            lineTotal: product.lineTotal
        }));
    }

    /**
     * Import products from saved quote
     */
    importFromQuote(items) {
        this.clearProducts();
        
        items.forEach(item => {
            // Parse size breakdown if it's a string
            let sizeBreakdown = item.SizeBreakdown;
            if (typeof sizeBreakdown === 'string') {
                try {
                    sizeBreakdown = JSON.parse(sizeBreakdown);
                } catch (e) {
                    sizeBreakdown = {};
                }
            }
            
            this.addProduct({
                styleNumber: item.StyleNumber,
                productName: item.ProductName,
                color: item.Color,
                colorCode: item.ColorCode,
                sizeBreakdown: sizeBreakdown,
                locations: item.PrintLocation ? item.PrintLocation.split(', ') : [],
                imageUrl: item.ImageURL
            });
        });
        
        console.log(`[ScreenPrintProductManager] Imported ${items.length} products from quote`);
    }

    /**
     * Clear cache
     */
    clearCache() {
        this.productCache.clear();
        console.log('[ScreenPrintProductManager] Cache cleared');
    }
}

// Make manager globally available
window.ScreenPrintProductManager = ScreenPrintProductManager;