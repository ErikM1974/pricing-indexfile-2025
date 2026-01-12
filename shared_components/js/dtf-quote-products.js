/**
 * DTF Quote Products Manager
 * Handles product search, selection, size management, and line items for DTF Quote Builder
 *
 * ⚠️ SHARED COMPONENT - USED BY DTF QUOTE BUILDER
 *
 * Key differences from DTG:
 * - Uses base garment costs (not DTG-specific pricing)
 * - Tracks size upcharges from SellingPriceDisplayAddOns
 * - Calculates pricing using DTFQuotePricing
 */

class DTFQuoteProducts {
    constructor() {
        this.apiBase = 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';
        this.products = [];
        this.currentProduct = null;
        this.pricingCalculator = new window.DTFQuotePricing();

        // Initialize exact match search (optimized for sales reps)
        this.exactMatchSearch = null;

        console.log('[DTFQuoteProducts] Products manager initialized');
    }

    /**
     * Initialize the exact match search module with callbacks
     * @param {Function} onExactMatch - Called when exact match found (auto-loads product)
     * @param {Function} onSuggestions - Called with suggestion list to display
     * @param {Object} options - Additional options for keyboard navigation
     * @param {Function} options.onNavigate - Called when selection changes (for visual highlight)
     * @param {Function} options.onSelect - Called when item selected via Enter key
     * @param {Function} options.onClose - Called when Escape pressed
     */
    initializeExactMatchSearch(onExactMatch, onSuggestions, options = {}) {
        if (!window.ExactMatchSearch) {
            console.error('[DTFQuoteProducts] ExactMatchSearch module not loaded!');
            return false;
        }

        this.exactMatchSearch = new window.ExactMatchSearch({
            apiBase: this.apiBase,
            onExactMatch: onExactMatch,
            onSuggestions: onSuggestions,
            // Keyboard navigation callbacks
            onNavigate: options.onNavigate || null,
            onSelect: options.onSelect || null,
            onClose: options.onClose || null,
            filterFunction: (item) => {
                // Filter out caps (caps can't have DTF transfers)
                const label = (item.label || '').toUpperCase();
                const isCap = label.includes('CAP') ||
                             label.includes('HAT') ||
                             label.includes('BEANIE');
                return !isCap;
            }
        });

        console.log('[DTFQuoteProducts] Exact match search initialized with keyboard navigation');
        return true;
    }

    /**
     * Get the ExactMatchSearch instance (for keydown handling)
     */
    getSearchInstance() {
        return this.exactMatchSearch;
    }

    /**
     * Search for products using exact match optimization
     */
    searchWithExactMatch(query) {
        if (!this.exactMatchSearch) {
            console.error('[DTFQuoteProducts] Exact match search not initialized.');
            return;
        }

        this.exactMatchSearch.search(query);
    }

    /**
     * Immediate search (for Enter key press)
     */
    searchImmediate(query) {
        if (!this.exactMatchSearch) {
            console.error('[DTFQuoteProducts] Exact match search not initialized.');
            return;
        }

        this.exactMatchSearch.searchImmediate(query);
    }

    /**
     * Search for products by style number (legacy method)
     */
    async searchProducts(query) {
        try {
            if (!query || query.length < 2) {
                return [];
            }

            const response = await fetch(`${this.apiBase}/api/stylesearch?term=${encodeURIComponent(query)}`);
            if (!response.ok) {
                throw new Error('Product search failed');
            }

            const suggestions = await response.json();

            // Filter out caps
            const filteredSuggestions = suggestions.filter(item => {
                const label = (item.label || '').toUpperCase();
                const isCap = label.includes('CAP') ||
                             label.includes('HAT') ||
                             label.includes('BEANIE');
                return !isCap;
            });

            // Transform to product format
            const products = filteredSuggestions.map(item => ({
                value: item.value,
                label: item.label,
                styleNumber: item.value,
                productName: item.label.split(' - ')[1] || item.label
            }));

            // Sort - exact matches first
            const queryUpper = query.toUpperCase();
            products.sort((a, b) => {
                const aUpper = a.value.toUpperCase();
                const bUpper = b.value.toUpperCase();

                const aExact = aUpper === queryUpper;
                const bExact = bUpper === queryUpper;
                if (aExact && !bExact) return -1;
                if (!aExact && bExact) return 1;

                const aStarts = aUpper.startsWith(queryUpper);
                const bStarts = bUpper.startsWith(queryUpper);
                if (aStarts && !bStarts) return -1;
                if (!aStarts && bStarts) return 1;

                return aUpper.localeCompare(bUpper);
            });

            console.log('[DTFQuoteProducts] Search results:', products.length);
            return products;

        } catch (error) {
            console.error('[DTFQuoteProducts] Search error:', error);
            return [];
        }
    }

    /**
     * Load product details with colors and base costs
     */
    async loadProductDetails(styleNumber) {
        try {
            console.log('[DTFQuoteProducts] Loading product:', styleNumber);

            // Fetch both DTF pricing bundle AND BLANK bundle for size upcharges
            // NOTE: DTF pricing-bundle returns empty sellingPriceDisplayAddOns
            // BLANK pricing-bundle returns the actual size upcharges
            const [bundleResponse, blankResponse, colorsResponse] = await Promise.all([
                fetch(`${this.apiBase}/api/pricing-bundle?method=DTF&styleNumber=${encodeURIComponent(styleNumber)}`),
                fetch(`${this.apiBase}/api/pricing-bundle?method=BLANK&styleNumber=${encodeURIComponent(styleNumber)}`),
                fetch(`${this.apiBase}/api/color-swatches?styleNumber=${encodeURIComponent(styleNumber)}`)
            ]);

            if (!bundleResponse.ok) {
                throw new Error(`Failed to load product bundle: ${bundleResponse.status}`);
            }

            const bundleData = await bundleResponse.json();
            const blankData = blankResponse.ok ? await blankResponse.json() : {};

            let colors = [];
            if (colorsResponse.ok) {
                const colorsData = await colorsResponse.json();
                colors = colorsData.colors || [];
            }

            // Extract product info
            // Get sizeUpcharges from BLANK bundle (has actual upcharge data)
            const product = {
                styleNumber: styleNumber,
                title: bundleData.product?.PRODUCT_TITLE || styleNumber,
                description: bundleData.product?.description || '',
                brand: bundleData.product?.brand || '',
                colors: colors,
                baseCost: bundleData.garmentCost || 0,
                sizeUpcharges: this.extractSizeUpcharges(blankData.sellingPriceDisplayAddOns),
                availableSizes: bundleData.sizes || [],
                pricingBundle: bundleData
            };

            this.currentProduct = product;
            console.log('[DTFQuoteProducts] Product loaded:', {
                styleNumber: product.styleNumber,
                baseCost: product.baseCost,
                colorCount: product.colors.length,
                sizeUpcharges: product.sizeUpcharges
            });

            return product;

        } catch (error) {
            console.error('[DTFQuoteProducts] Error loading product:', error);
            throw error;
        }
    }

    /**
     * Extract size upcharges from API response
     */
    extractSizeUpcharges(addOns) {
        const upcharges = {};

        if (!addOns) return upcharges;

        // Handle array format from API
        if (Array.isArray(addOns)) {
            addOns.forEach(addon => {
                if (addon.size && addon.addonAmount !== undefined) {
                    upcharges[addon.size] = parseFloat(addon.addonAmount) || 0;
                }
            });
        }
        // Handle object format
        else if (typeof addOns === 'object') {
            Object.entries(addOns).forEach(([size, amount]) => {
                upcharges[size] = parseFloat(amount) || 0;
            });
        }

        return upcharges;
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
                console.warn('[DTFQuoteProducts] Sizes API returned', response.status);
                return ['S', 'M', 'L', 'XL', '2XL', '3XL', '4XL'];
            }

            const data = await response.json();
            const sizes = data.sizes || [];
            console.log('[DTFQuoteProducts] Loaded sizes for', styleNumber, color, ':', sizes);
            return sizes.length > 0 ? sizes : ['S', 'M', 'L', 'XL', '2XL', '3XL', '4XL'];

        } catch (error) {
            console.warn('[DTFQuoteProducts] Using default sizes:', error.message);
            return ['S', 'M', 'L', 'XL', '2XL', '3XL', '4XL'];
        }
    }

    /**
     * Get base cost for a product
     */
    async getBaseCost(styleNumber) {
        try {
            const response = await fetch(
                `${this.apiBase}/api/base-item-costs?styleNumber=${encodeURIComponent(styleNumber)}`
            );

            if (!response.ok) {
                throw new Error(`Base cost API error: ${response.status}`);
            }

            const data = await response.json();
            // API returns CASE_PRICE as the base cost
            const baseCost = data.CASE_PRICE || data.baseCost || 0;
            console.log('[DTFQuoteProducts] Base cost for', styleNumber, ':', baseCost);
            return parseFloat(baseCost);

        } catch (error) {
            console.error('[DTFQuoteProducts] Error getting base cost:', error);
            throw error;
        }
    }

    /**
     * Add product to quote
     */
    async addProduct(productData) {
        try {
            // Ensure we have base cost
            let baseCost = productData.baseCost;
            if (!baseCost && productData.styleNumber) {
                baseCost = await this.getBaseCost(productData.styleNumber);
            }

            // Get size upcharges if not provided
            let sizeUpcharges = productData.sizeUpcharges || {};
            if (Object.keys(sizeUpcharges).length === 0 && this.currentProduct?.sizeUpcharges) {
                sizeUpcharges = this.currentProduct.sizeUpcharges;
            }

            // Create product entry
            const product = {
                id: Date.now(),
                styleNumber: productData.styleNumber,
                productName: productData.productName || productData.title || productData.styleNumber,
                color: productData.color,
                colorCode: productData.colorCode || productData.CATALOG_COLOR || '',
                imageUrl: productData.imageUrl || '',
                sizeQuantities: productData.sizeQuantities || {},
                baseCost: baseCost,
                sizeUpcharges: sizeUpcharges,
                totalQuantity: this.calculateProductQuantity(productData.sizeQuantities)
            };

            this.products.push(product);
            console.log('[DTFQuoteProducts] Product added:', {
                styleNumber: product.styleNumber,
                color: product.color,
                baseCost: product.baseCost,
                quantity: product.totalQuantity
            });

            return product;

        } catch (error) {
            console.error('[DTFQuoteProducts] Error adding product:', error);
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
            console.log('[DTFQuoteProducts] Product removed:', removed.styleNumber);
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
            console.log('[DTFQuoteProducts] Product updated:', product.styleNumber, product.totalQuantity);
            return product;
        }
        return null;
    }

    /**
     * Calculate total quantity for a product
     */
    calculateProductQuantity(sizeQuantities) {
        return Object.values(sizeQuantities || {}).reduce((sum, qty) => sum + (parseInt(qty) || 0), 0);
    }

    /**
     * Get total quantity across all products (aggregate)
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
        console.log('[DTFQuoteProducts] All products cleared');
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
        const sizeList = Object.entries(product.sizeQuantities || {})
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
     * Build product card HTML with Excel-style pricing breakdown
     * Shows per-size quantity, unit price, and line total like a spreadsheet
     */
    buildProductCard(product, pricingDetails = null) {
        const display = this.formatProductDisplay(product);

        // Build size breakdown rows for the pricing table
        let sizeRows = '';
        let productTotal = 0;

        // Get size entries sorted by standard order
        const sizeOrder = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL', '6XL'];
        const sortedSizes = Object.entries(product.sizeQuantities || {})
            .filter(([size, qty]) => qty > 0)
            .sort((a, b) => {
                const aIdx = sizeOrder.indexOf(a[0]);
                const bIdx = sizeOrder.indexOf(b[0]);
                return (aIdx === -1 ? 999 : aIdx) - (bIdx === -1 ? 999 : bIdx);
            });

        // If we have pricing details, use them for unit prices
        if (pricingDetails && pricingDetails.sizePricing) {
            sortedSizes.forEach(([size, qty]) => {
                const sizePrice = pricingDetails.sizePricing[size] || pricingDetails.unitPrice || 0;
                const lineTotal = sizePrice * qty;
                productTotal += lineTotal;

                sizeRows += `
                    <tr>
                        <td>${size}</td>
                        <td>${qty}</td>
                        <td>$${sizePrice.toFixed(2)}</td>
                        <td>$${lineTotal.toFixed(2)}</td>
                    </tr>
                `;
            });
        } else {
            // Fallback - just show quantities without unit prices
            sortedSizes.forEach(([size, qty]) => {
                sizeRows += `
                    <tr>
                        <td>${size}</td>
                        <td>${qty}</td>
                        <td>-</td>
                        <td>-</td>
                    </tr>
                `;
            });
        }

        return `
            <div class="product-card" data-product-id="${product.id}">
                <div class="product-card-header">
                    <div class="product-card-image">
                        ${product.imageUrl ?
                            `<img src="${product.imageUrl}" alt="${display.title}">` :
                            `<div class="no-image"><i class="fas fa-tshirt"></i></div>`
                        }
                    </div>
                    <div class="product-card-info">
                        <h4>${display.title}</h4>
                        <p class="product-color"><i class="fas fa-palette"></i> ${display.color}</p>
                    </div>
                </div>

                <table class="product-pricing-table">
                    <thead>
                        <tr>
                            <th>Size</th>
                            <th>Qty</th>
                            <th>Unit Price</th>
                            <th>Line Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${sizeRows}
                    </tbody>
                    <tfoot>
                        <tr>
                            <td colspan="3">Product Total (${display.quantity} pcs)</td>
                            <td>${productTotal > 0 ? '$' + productTotal.toFixed(2) : 'Pending'}</td>
                        </tr>
                    </tfoot>
                </table>

                <div class="product-card-actions">
                    <button class="btn-remove" onclick="window.dtfQuoteBuilder?.removeProduct(${product.id})">
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
            baseCost: product.baseCost,
            sizeUpcharges: product.sizeUpcharges,
            totalQuantity: product.totalQuantity
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

        console.log('[DTFQuoteProducts] Imported products:', this.products.length);
        return this.products;
    }

    /**
     * Get product count
     */
    getProductCount() {
        return this.products.length;
    }

    /**
     * Check if minimum quantity is met (DTF min = 10)
     */
    meetsMinimumQuantity() {
        const minQty = window.DTFConfig?.settings?.minQuantity || 10;
        return this.getTotalQuantity() >= minQty;
    }

    /**
     * Get remaining quantity needed for minimum
     */
    getQuantityNeededForMinimum() {
        const minQty = window.DTFConfig?.settings?.minQuantity || 10;
        const current = this.getTotalQuantity();
        return Math.max(0, minQty - current);
    }

    /**
     * Check if LTM fee applies (aggregate < 24)
     */
    hasLTMFee() {
        return this.getTotalQuantity() < 24;
    }
}

// Make available globally
window.DTFQuoteProducts = DTFQuoteProducts;
