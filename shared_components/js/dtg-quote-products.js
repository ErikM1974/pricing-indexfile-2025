/**
 * DTG Quote Products Manager
 * Handles product search, selection, size management, and line items
 */

class DTGQuoteProducts {
    constructor() {
        this.apiBase = 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';
        this.products = [];
        this.currentProduct = null;
        this.pricingCalculator = new window.DTGQuotePricing();

        // Initialize exact match search (optimized for sales reps)
        this.exactMatchSearch = null; // Will be initialized when search is called

        console.log('[DTGQuoteProducts] Products manager initialized');
    }

    /**
     * Initialize the exact match search module with callbacks
     */
    initializeExactMatchSearch(onExactMatch, onSuggestions) {
        if (!window.ExactMatchSearch) {
            console.error('[DTGQuoteProducts] ExactMatchSearch module not loaded!');
            return false;
        }

        this.exactMatchSearch = new window.ExactMatchSearch({
            apiBase: this.apiBase,
            onExactMatch: onExactMatch,
            onSuggestions: onSuggestions,
            filterFunction: (item) => {
                // Filter out caps for DTG (caps can't be DTG printed)
                const label = (item.label || '').toUpperCase();
                const isCap = label.includes('CAP') ||
                             label.includes('HAT') ||
                             label.includes('BEANIE');
                return !isCap;
            }
        });

        console.log('[DTGQuoteProducts] Exact match search initialized');
        return true;
    }

    /**
     * Search for products using exact match optimization
     * This is the new method - auto-loads exact matches
     */
    searchWithExactMatch(query) {
        if (!this.exactMatchSearch) {
            console.error('[DTGQuoteProducts] Exact match search not initialized. Call initializeExactMatchSearch() first.');
            return;
        }

        this.exactMatchSearch.search(query);
    }

    /**
     * Immediate search (for Enter key press)
     */
    searchImmediate(query) {
        if (!this.exactMatchSearch) {
            console.error('[DTGQuoteProducts] Exact match search not initialized.');
            return;
        }

        this.exactMatchSearch.searchImmediate(query);
    }

    /**
     * LEGACY: Search for products by style number - uses stylesearch endpoint for autocomplete
     * NOTE: This is kept for backwards compatibility but new code should use searchWithExactMatch()
     */
    async searchProducts(query) {
        try {
            if (!query || query.length < 2) {
                return [];
            }

            // Use the stylesearch endpoint like embroidery and cap quote builders
            const response = await fetch(`${this.apiBase}/api/stylesearch?term=${encodeURIComponent(query)}`);
            if (!response.ok) {
                throw new Error('Product search failed');
            }

            const suggestions = await response.json();

            // Filter out caps (caps can't be DTG printed)
            const filteredSuggestions = suggestions.filter(item => {
                const label = (item.label || '').toUpperCase();
                const isCap = label.includes('CAP') ||
                             label.includes('HAT') ||
                             label.includes('BEANIE');
                return !isCap;
            });

            // stylesearch returns a simple array of {value, label} objects
            // Transform to match what DTG quote builder expects
            const products = filteredSuggestions.map(item => ({
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
            const bundleResponse = await fetch(`${this.apiBase}/api/dtg/product-bundle?styleNumber=${encodeURIComponent(styleNumber)}`);
            if (!bundleResponse.ok) {
                throw new Error('Failed to load product bundle');
            }
            
            const bundleData = await bundleResponse.json();
            
            // Extract product info and pricing
            // Note: Bundle API returns pricing data at top level, not nested
            const product = {
                styleNumber: styleNumber,
                title: bundleData.product?.title || '',
                description: bundleData.product?.description || '',
                brand: bundleData.product?.brand || '',
                colors: bundleData.product?.colors || [],
                pricingData: bundleData || null,  // Bundle data IS the pricing data
                availableSizes: []
            };

            // Extract available sizes from pricing data
            if (bundleData && bundleData.sizes) {
                product.availableSizes = bundleData.sizes.map(s => s.size);
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
                `${this.apiBase}/api/sizes-by-style-color?styleNumber=${encodeURIComponent(styleNumber)}&color=${encodeURIComponent(color)}`
            );

            if (!response.ok) {
                console.warn('[DTGQuoteProducts] Sizes API returned', response.status, '- using default sizes');
                return ['S', 'M', 'L', 'XL', '2XL', '3XL', '4XL'];
            }

            const data = await response.json();
            const sizes = data.sizes || [];
            console.log('[DTGQuoteProducts] Loaded sizes for', styleNumber, color, ':', sizes);
            return sizes.length > 0 ? sizes : ['S', 'M', 'L', 'XL', '2XL', '3XL', '4XL'];

        } catch (error) {
            console.warn('[DTGQuoteProducts] Using default sizes due to API error:', error.message);
            // Return default sizes if API fails - don't throw error
            return ['S', 'M', 'L', 'XL', '2XL', '3XL', '4XL'];
        }
    }
    
    /**
     * Add product to quote
     */
    async addProduct(productData) {
        try {
            // ALWAYS reload pricing data to ensure correct structure for calculations
            // The bundleData from loadProductDetails() has different structure than what calculations expect
            console.log('[DTGQuoteProducts] Loading transformed pricing data for calculations...');
            const pricingData = await this.pricingCalculator.loadProductPricing(
                productData.styleNumber,
                productData.color
            );
            
            // Create product entry
            const product = {
                id: Date.now(), // Unique ID for tracking
                styleNumber: productData.styleNumber,
                productName: productData.productName || productData.title,
                color: productData.color,
                colorCode: productData.colorCode || '',
                imageUrl: productData.imageUrl || '',
                sizeQuantities: productData.sizeQuantities || {},
                pricingData: pricingData, // Use transformed data for calculations
                totalQuantity: this.calculateProductQuantity(productData.sizeQuantities)
            };
            
            this.products.push(product);
            console.log('[DTGQuoteProducts] Product added with transformed pricing data:', {
                styleNumber: product.styleNumber,
                color: product.color,
                hasTiers: !!product.pricingData?.tiers,
                hasCosts: !!product.pricingData?.costs,
                hasSizes: !!product.pricingData?.sizes
            });

            // 🔍 DETAILED DEBUG: Log exact pricing data structure
            console.log('🔍 [DTGQuoteProducts] DETAILED pricingData structure:', {
                tiersType: typeof product.pricingData?.tiers,
                tiersIsArray: Array.isArray(product.pricingData?.tiers),
                tiersLength: product.pricingData?.tiers?.length,
                tiersFirstItem: product.pricingData?.tiers?.[0],
                costsType: typeof product.pricingData?.costs,
                costsIsArray: Array.isArray(product.pricingData?.costs),
                costsLength: product.pricingData?.costs?.length,
                sizesType: typeof product.pricingData?.sizes,
                sizesIsArray: Array.isArray(product.pricingData?.sizes),
                sizesLength: product.pricingData?.sizes?.length,
                sizesFirstItem: product.pricingData?.sizes?.[0],
                allKeys: Object.keys(product.pricingData || {})
            });

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