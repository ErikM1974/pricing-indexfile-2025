/**
 * Product Line Manager
 * Manages product additions, size matrices, and line items
 */

class ProductLineManager {
    constructor() {
        this.baseURL = 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';
        this.products = [];
        this.nextProductId = 1;
        this.currentProduct = null;
        this.availableSizes = [];
        
        this.initializeEvents();
    }
    
    initializeEvents() {
        // Style search
        const styleSearch = document.getElementById('style-search');
        if (styleSearch) {
            styleSearch.addEventListener('input', (e) => this.handleStyleSearch(e.target.value));
            styleSearch.addEventListener('focus', (e) => this.handleStyleSearch(e.target.value));
        }
        
        // Color select
        const colorSelect = document.getElementById('color-select');
        if (colorSelect) {
            colorSelect.addEventListener('change', (e) => this.handleColorChange(e.target.value));
        }
        
        // Load product button
        const loadBtn = document.getElementById('load-product-btn');
        if (loadBtn) {
            loadBtn.addEventListener('click', () => this.loadProduct());
        }
        
        // Add to quote button
        const addBtn = document.getElementById('add-to-quote-btn');
        if (addBtn) {
            addBtn.addEventListener('click', () => this.addProductToQuote());
        }
        
        // Size inputs delegation
        document.addEventListener('input', (e) => {
            if (e.target.classList.contains('size-qty-input')) {
                this.updateProductTotal();
            }
        });
    }
    
    /**
     * Handle style number search
     */
    async handleStyleSearch(query) {
        const suggestionsDiv = document.getElementById('style-suggestions');
        
        if (query.length < 2) {
            suggestionsDiv.innerHTML = '';
            suggestionsDiv.style.display = 'none';
            return;
        }
        
        try {
            const response = await fetch(`${this.baseURL}/api/products/search?q=${encodeURIComponent(query)}&limit=10`);
            const data = await response.json();
            
            if (data.products && data.products.length > 0) {
                suggestionsDiv.innerHTML = data.products.map(product => `
                    <div class="suggestion-item" data-style="${product.style}">
                        <strong>${product.style}</strong> - ${product.title}
                    </div>
                `).join('');
                suggestionsDiv.style.display = 'block';
                
                // Bind click events to suggestions
                suggestionsDiv.querySelectorAll('.suggestion-item').forEach(item => {
                    item.addEventListener('click', () => {
                        const style = item.dataset.style;
                        document.getElementById('style-search').value = style;
                        suggestionsDiv.style.display = 'none';
                        this.loadProductDetails(style);
                    });
                });
            } else {
                suggestionsDiv.innerHTML = '<div class="no-results">No products found</div>';
                suggestionsDiv.style.display = 'block';
            }
        } catch (error) {
            console.error('Search error:', error);
            suggestionsDiv.innerHTML = '<div class="error">Search failed</div>';
            suggestionsDiv.style.display = 'block';
        }
    }
    
    /**
     * Load product details
     */
    async loadProductDetails(styleNumber) {
        try {
            this.showLoading(true);
            
            // Get product details and colors
            const [detailsResponse, colorsResponse] = await Promise.all([
                fetch(`${this.baseURL}/api/product-details?styleNumber=${styleNumber}`),
                fetch(`${this.baseURL}/api/product-colors?styleNumber=${styleNumber}`)
            ]);
            
            const details = await detailsResponse.json();
            const colors = await colorsResponse.json();
            
            if (details.data) {
                this.currentProduct = {
                    style: styleNumber,
                    title: details.data.ProductTitle || details.data.Title,
                    brand: details.data.Brand,
                    description: details.data.Description
                };
                
                // Update color dropdown
                const colorSelect = document.getElementById('color-select');
                if (colors.data && colors.data.length > 0) {
                    colorSelect.innerHTML = '<option value="">Select a color</option>' +
                        colors.data.map(color => `<option value="${color}">${color}</option>`).join('');
                    colorSelect.disabled = false;
                } else {
                    colorSelect.innerHTML = '<option value="">No colors available</option>';
                    colorSelect.disabled = true;
                }
                
                document.getElementById('load-product-btn').disabled = false;
            }
        } catch (error) {
            console.error('Load product error:', error);
            alert('Failed to load product details');
        } finally {
            this.showLoading(false);
        }
    }
    
    /**
     * Handle color change
     */
    handleColorChange(color) {
        if (color) {
            document.getElementById('load-product-btn').disabled = false;
        }
    }
    
    /**
     * Load full product with sizes
     */
    async loadProduct() {
        const styleNumber = document.getElementById('style-search').value;
        const color = document.getElementById('color-select').value;
        
        if (!styleNumber || !color) {
            alert('Please select style and color');
            return;
        }
        
        try {
            this.showLoading(true);
            
            // Get available sizes and swatches
            const [sizesResponse, swatchesResponse] = await Promise.all([
                fetch(`${this.baseURL}/api/sizes-by-style-color?styleNumber=${styleNumber}&color=${encodeURIComponent(color)}`),
                fetch(`${this.baseURL}/api/color-swatches?styleNumber=${styleNumber}`)
            ]);
            
            const sizes = await sizesResponse.json();
            const swatches = await swatchesResponse.json();
            
            if (sizes.data) {
                this.availableSizes = sizes.data;
                this.currentProduct.color = color;
                
                // Find image from swatches
                const colorSwatch = swatches.data?.find(s => s.color === color);
                this.currentProduct.imageUrl = colorSwatch?.swatchUrl || '';
                
                this.displayProduct();
            }
        } catch (error) {
            console.error('Load product error:', error);
            alert('Failed to load product sizes');
        } finally {
            this.showLoading(false);
        }
    }
    
    /**
     * Display loaded product
     */
    displayProduct() {
        const display = document.getElementById('product-display');
        
        // Update product info
        document.getElementById('product-image').src = this.currentProduct.imageUrl || '/images/placeholder.png';
        document.getElementById('product-name').textContent = 
            `${this.currentProduct.style} - ${this.currentProduct.title}`;
        document.getElementById('product-description').textContent = 
            `${this.currentProduct.brand} | ${this.currentProduct.color}`;
        
        // Create size inputs
        const sizeInputsDiv = document.getElementById('size-inputs');
        sizeInputsDiv.innerHTML = this.availableSizes.map(size => `
            <div class="size-input-group">
                <label>${size}</label>
                <input type="number" 
                       class="size-qty-input" 
                       data-size="${size}" 
                       min="0" 
                       value="0">
            </div>
        `).join('');
        
        display.style.display = 'block';
        this.updateProductTotal();
    }
    
    /**
     * Update product total quantity
     */
    updateProductTotal() {
        const inputs = document.querySelectorAll('.size-qty-input');
        let total = 0;
        
        inputs.forEach(input => {
            total += parseInt(input.value) || 0;
        });
        
        document.getElementById('product-total-qty').textContent = total;
        document.getElementById('add-to-quote-btn').disabled = total === 0;
    }
    
    /**
     * Add product to quote
     */
    addProductToQuote() {
        const sizeBreakdown = {};
        let totalQty = 0;
        
        document.querySelectorAll('.size-qty-input').forEach(input => {
            const qty = parseInt(input.value) || 0;
            if (qty > 0) {
                sizeBreakdown[input.dataset.size] = qty;
                totalQty += qty;
            }
        });
        
        if (totalQty === 0) {
            alert('Please enter quantities');
            return;
        }
        
        const product = {
            id: this.nextProductId++,
            style: this.currentProduct.style,
            title: this.currentProduct.title,
            brand: this.currentProduct.brand,
            color: this.currentProduct.color,
            imageUrl: this.currentProduct.imageUrl,
            sizeBreakdown: sizeBreakdown,
            totalQuantity: totalQty
        };
        
        this.products.push(product);
        this.renderProductsList();
        this.resetProductForm();
        this.updateContinueButton();
        
        // Trigger pricing update
        if (window.embroideryQuoteBuilder) {
            window.embroideryQuoteBuilder.updatePricing();
        }
    }
    
    /**
     * Render products list
     */
    renderProductsList() {
        const container = document.getElementById('products-container');
        
        if (this.products.length === 0) {
            container.innerHTML = '<p class="empty-message">No products added yet</p>';
            document.getElementById('aggregate-total').textContent = '0';
            return;
        }
        
        let aggregateTotal = 0;
        
        container.innerHTML = this.products.map(product => {
            aggregateTotal += product.totalQuantity;
            
            const sizesList = Object.entries(product.sizeBreakdown)
                .map(([size, qty]) => `${size}(${qty})`)
                .join(', ');
            
            return `
                <div class="product-item" data-product-id="${product.id}">
                    <div class="product-item-header">
                        <img src="${product.imageUrl || '/images/placeholder.png'}" alt="${product.style}">
                        <div class="product-item-info">
                            <strong>${product.style} - ${product.title}</strong>
                            <span>${product.color} | ${product.totalQuantity} pieces</span>
                            <small>${sizesList}</small>
                        </div>
                        <button class="btn-delete" onclick="window.productLineManager.removeProduct(${product.id})">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            `;
        }).join('');
        
        document.getElementById('aggregate-total').textContent = aggregateTotal;
        
        // Update tier indicator
        this.updateTierIndicator(aggregateTotal);
    }
    
    /**
     * Update tier indicator
     */
    updateTierIndicator(total) {
        const indicator = document.getElementById('tier-indicator');
        if (!indicator) return;
        
        let tier = '';
        if (total < 24) tier = '1-23 (LTM applies)';
        else if (total < 48) tier = '24-47';
        else if (total < 72) tier = '48-71';
        else tier = '72+';
        
        indicator.textContent = `Tier: ${tier}`;
    }
    
    /**
     * Remove product
     */
    removeProduct(productId) {
        if (confirm('Remove this product from the quote?')) {
            this.products = this.products.filter(p => p.id !== productId);
            this.renderProductsList();
            this.updateContinueButton();
            
            // Trigger pricing update
            if (window.embroideryQuoteBuilder) {
                window.embroideryQuoteBuilder.updatePricing();
            }
        }
    }
    
    /**
     * Reset product form
     */
    resetProductForm() {
        document.getElementById('style-search').value = '';
        document.getElementById('color-select').innerHTML = '<option value="">Select style first</option>';
        document.getElementById('color-select').disabled = true;
        document.getElementById('load-product-btn').disabled = true;
        document.getElementById('product-display').style.display = 'none';
        document.getElementById('style-suggestions').style.display = 'none';
    }
    
    /**
     * Update continue button
     */
    updateContinueButton() {
        const btn = document.getElementById('continue-to-summary');
        if (btn) {
            btn.disabled = this.products.length === 0;
        }
    }
    
    /**
     * Get aggregate total
     */
    getAggregateTotal() {
        return this.products.reduce((sum, p) => sum + p.totalQuantity, 0);
    }
    
    /**
     * Export products data
     */
    exportProducts() {
        return this.products;
    }
    
    /**
     * Show/hide loading
     */
    showLoading(show) {
        const overlay = document.getElementById('loading-overlay');
        if (overlay) {
            overlay.style.display = show ? 'flex' : 'none';
        }
    }
}

// Make available globally
window.ProductLineManager = ProductLineManager;
window.productLineManager = null; // Will be initialized by main builder