/**
 * DTG Quote Products Manager
 * Handles product search, selection, size management, and line items
 */

class DTGQuoteProducts {
    constructor() {
        this.apiBase = 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api';
        this.products = [];
        this.currentProduct = null;
        this.pricingCalculator = new window.DTGQuotePricing();
        
        console.log('[DTGQuoteProducts] Products manager initialized');
    }
    
    /**
     * Search for products by style number - uses stylesearch endpoint for autocomplete
     */
    async searchProducts(query) {
        try {
            if (!query || query.length < 2) {
                return [];
            }
            
            // Use the stylesearch endpoint like embroidery and cap quote builders
            const response = await fetch(`${this.apiBase}/stylesearch?term=${encodeURIComponent(query)}`);
            if (!response.ok) {
                throw new Error('Product search failed');
            }
            
            const suggestions = await response.json();
            
            // stylesearch returns a simple array of {value, label} objects
            // Transform to match what DTG quote builder expects
            const products = suggestions.map(item => ({
                value: item.value,
                label: item.label,
                styleNumber: item.value,
                productName: item.label.split(' - ')[1] || item.label
            }));
            
            // Sort suggestions by relevance - exact matches first, then "starts with", then contains
            const queryUpper = query.toUpperCase();
            products.sort((a, b) => {
                const aUpper = a.value.toUpperCase();
                const bUpper = b.value.toUpperCase();
                
                // Exact match gets highest priority (PC54 when searching for PC54)
                const aExact = aUpper === queryUpper;
                const bExact = bUpper === queryUpper;
                if (aExact && !bExact) return -1;
                if (!aExact && bExact) return 1;
                
                // "Starts with" gets second priority (PC54LS when searching for PC54)
                const aStarts = aUpper.startsWith(queryUpper);
                const bStarts = bUpper.startsWith(queryUpper);
                if (aStarts && !bStarts) return -1;
                if (!aStarts && bStarts) return 1;
                
                // Otherwise alphabetical order
                return aUpper.localeCompare(bUpper);
            });
            
            console.log('[DTGQuoteProducts] Search results:', products.length, 
                        products.length > 0 ? `First result: ${products[0].value}` : '');
            return products;
            
        } catch (error) {
            console.error('[DTGQuoteProducts] Search error:', error);
            return [];
        }
    }
    
    /**
     * Load product details and colors
     */
    async loadProductDetails(styleNumber) {
        try {
            console.log('[DTGQuoteProducts] Loading product:', styleNumber);
            
            // Fetch product bundle with DTG pricing
            const bundleResponse = await fetch(`${this.apiBase}/dtg/product-bundle?styleNumber=${encodeURIComponent(styleNumber)}`);
            if (!bundleResponse.ok) {
                throw new Error('Failed to load product bundle');
            }
            
            const bundleData = await bundleResponse.json();
            
            // Extract product info and pricing
            const product = {
                styleNumber: styleNumber,
                title: bundleData.product?.title || '',
                description: bundleData.product?.description || '',
                brand: bundleData.product?.brand || '',
                colors: bundleData.product?.colors || [],
                pricingData: bundleData.pricing || null,
                availableSizes: []
            };
            
            // Extract available sizes from pricing data
            if (bundleData.pricing && bundleData.pricing.sizes) {
                product.availableSizes = bundleData.pricing.sizes.map(s => s.size);
            }
            
            this.currentProduct = product;
            console.log('[DTGQuoteProducts] Product loaded:', product);
            
            return product;
            
        } catch (error) {
            console.error('[DTGQuoteProducts] Error loading product:', error);
            throw error;
        }
    }
    
    /**
     * Get available sizes for a style and color
     */
    async getAvailableSizes(styleNumber, color) {
        try {
            const response = await fetch(
                `${this.apiBase}/sizes-by-style-color?styleNumber=${encodeURIComponent(styleNumber)}&color=${encodeURIComponent(color)}`
            );
            
            if (!response.ok) {
                throw new Error('Failed to load sizes');
            }
            
            const data = await response.json();
            return data.sizes || [];
            
        } catch (error) {
            console.error('[DTGQuoteProducts] Error loading sizes:', error);
            // Return default sizes if API fails
            return ['S', 'M', 'L', 'XL', '2XL', '3XL', '4XL'];
        }
    }
    
    /**
     * Add product to quote
     */
    async addProduct(productData) {
        try {
            // Load pricing data if not already loaded
            if (!productData.pricingData) {
                const pricingData = await this.pricingCalculator.loadProductPricing(
                    productData.styleNumber,
                    productData.color
                );
                productData.pricingData = pricingData;
            }
            
            // Create product entry
            const product = {
                id: Date.now(), // Unique ID for tracking
                styleNumber: productData.styleNumber,
                productName: productData.productName || productData.title,
                color: productData.color,
                colorCode: productData.colorCode || '',
                imageUrl: productData.imageUrl || '',
                sizeQuantities: productData.sizeQuantities || {},
                pricingData: productData.pricingData,
                totalQuantity: this.calculateProductQuantity(productData.sizeQuantities)
            };
            
            this.products.push(product);
            console.log('[DTGQuoteProducts] Product added:', product);
            
            return product;
            
        } catch (error) {
            console.error('[DTGQuoteProducts] Error adding product:', error);
            throw error;
        }
    }
    
    /**
     * Remove product from quote
     */
    removeProduct(productId) {
        const index = this.products.findIndex(p => p.id === productId);
        if (index !== -1) {
            const removed = this.products.splice(index, 1)[0];
            console.log('[DTGQuoteProducts] Product removed:', removed);
            return true;
        }
        return false;
    }
    
    /**
     * Update product quantities
     */
    updateProductQuantities(productId, sizeQuantities) {
        const product = this.products.find(p => p.id === productId);
        if (product) {
            product.sizeQuantities = sizeQuantities;
            product.totalQuantity = this.calculateProductQuantity(sizeQuantities);
            console.log('[DTGQuoteProducts] Product updated:', product);
            return product;
        }
        return null;
    }
    
    /**
     * Calculate total quantity for a product
     */
    calculateProductQuantity(sizeQuantities) {
        return Object.values(sizeQuantities).reduce((sum, qty) => sum + (parseInt(qty) || 0), 0);
    }
    
    /**
     * Get total quantity across all products
     */
    getTotalQuantity() {
        return this.products.reduce((sum, product) => sum + product.totalQuantity, 0);
    }
    
    /**
     * Get all products
     */
    getAllProducts() {
        return this.products;
    }
    
    /**
     * Clear all products
     */
    clearProducts() {
        this.products = [];
        this.currentProduct = null;
        console.log('[DTGQuoteProducts] All products cleared');
    }
    
    /**
     * Validate product data
     */
    validateProduct(productData) {
        const errors = [];
        
        if (!productData.styleNumber) {
            errors.push('Style number is required');
        }
        
        if (!productData.color) {
            errors.push('Color selection is required');
        }
        
        const totalQty = this.calculateProductQuantity(productData.sizeQuantities);
        if (totalQty === 0) {
            errors.push('At least one size quantity is required');
        }
        
        return {
            valid: errors.length === 0,
            errors: errors
        };
    }
    
    /**
     * Format product for display
     */
    formatProductDisplay(product) {
        const sizeList = Object.entries(product.sizeQuantities)
            .filter(([size, qty]) => qty > 0)
            .map(([size, qty]) => `${size}(${qty})`)
            .join(' ');
        
        return {
            title: `${product.styleNumber} - ${product.productName}`,
            color: product.color,
            sizes: sizeList,
            quantity: product.totalQuantity,
            imageUrl: product.imageUrl
        };
    }
    
    /**
     * Build product card HTML
     */
    buildProductCard(product) {
        const display = this.formatProductDisplay(product);
        
        return `
            <div class="product-card" data-product-id="${product.id}">
                <div class="product-card-image">
                    ${product.imageUrl ? 
                        `<img src="${product.imageUrl}" alt="${display.title}">` :
                        `<div class="no-image"><i class="fas fa-tshirt"></i></div>`
                    }
                </div>
                <div class="product-card-details">
                    <h4>${display.title}</h4>
                    <p class="product-color">Color: ${display.color}</p>
                    <p class="product-sizes">${display.sizes}</p>
                    <p class="product-quantity">Total: ${display.quantity} pieces</p>
                </div>
                <div class="product-card-actions">
                    <button class="btn-remove" onclick="removeProductFromQuote(${product.id})">
                        <i class="fas fa-trash"></i> Remove
                    </button>
                </div>
            </div>
        `;
    }
    
    /**
     * Get product summary for quote
     */
    getProductSummary() {
        return this.products.map(product => ({
            id: product.id,
            styleNumber: product.styleNumber,
            productName: product.productName,
            color: product.color,
            colorCode: product.colorCode,
            imageUrl: product.imageUrl,
            sizeQuantities: product.sizeQuantities,
            totalQuantity: product.totalQuantity,
            pricingData: product.pricingData
        }));
    }
    
    /**
     * Import products (for loading saved quotes)
     */
    importProducts(products) {
        this.products = products.map(p => ({
            ...p,
            id: p.id || Date.now() + Math.random()
        }));
        
        console.log('[DTGQuoteProducts] Imported products:', this.products.length);
        return this.products;
    }
}

// Make available globally
window.DTGQuoteProducts = DTGQuoteProducts;