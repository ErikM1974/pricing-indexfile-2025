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
    
    /**
     * Check if product is allowed (exclude caps, include beanies)
     */
    isAllowedProduct(product) {
        const title = (product.label || product.PRODUCT_TITLE || product.value || '').toLowerCase();
        const description = (product.PRODUCT_DESCRIPTION || '').toLowerCase();
        
        // Explicitly ALLOW beanies (flat embroidery)
        if (title.includes('beanie') || description.includes('beanie')) {
            return true;
        }
        
        // EXCLUDE structured caps (these go on cap machines)
        const capKeywords = ['cap', 'trucker', 'snapback', 'fitted', 
                            'flexfit', 'visor', 'mesh back', 'dad hat',
                            'baseball', '5-panel', '6-panel'];
        
        const isStructuredCap = capKeywords.some(keyword => 
            title.includes(keyword) || 
            description.includes(keyword)
        );
        
        if (isStructuredCap) {
            console.log('[ProductLineManager] Filtered out cap product:', title);
            return false;
        }
        
        // Allow everything else (shirts, polos, jackets, etc.)
        return true;
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
            // Use the working stylesearch endpoint like other pages
            const response = await fetch(`${this.baseURL}/api/stylesearch?term=${encodeURIComponent(query)}`);
            const suggestions = await response.json();
            
            if (suggestions && suggestions.length > 0) {
                // Filter out caps but keep beanies
                const filteredSuggestions = suggestions.filter(item => this.isAllowedProduct(item));
                
                if (filteredSuggestions.length > 0) {
                    // Add note about beanies if any are present
                    const hasBeanies = filteredSuggestions.some(item => 
                        (item.label || '').toLowerCase().includes('beanie')
                    );
                    
                    const noteHtml = hasBeanies 
                        ? '<div class="autocomplete-note" style="padding: 8px; background: #f0f9ff; color: #0369a1; font-size: 12px; border-bottom: 1px solid #e0e7ff;">Note: Beanies use flat embroidery pricing</div>' 
                        : '';
                    
                    suggestionsDiv.innerHTML = noteHtml + filteredSuggestions.map(item => `
                        <div class="suggestion-item" data-style="${item.value}">
                            <strong>${item.value}</strong> - ${item.label.split(' - ')[1] || item.label}
                        </div>
                    `).join('');
                    suggestionsDiv.style.display = 'block';
                    
                    // Bind click events to filtered suggestions
                    suggestionsDiv.querySelectorAll('.suggestion-item').forEach(item => {
                        item.addEventListener('click', () => {
                            const style = item.dataset.style;
                            console.log('[ProductLineManager] Autocomplete selection:', style);
                            document.getElementById('style-search').value = style;
                            suggestionsDiv.style.display = 'none';
                            this.loadProductDetails(style);
                        });
                    });
                } else {
                    suggestionsDiv.innerHTML = '<div class="no-results">No apparel products found (caps use separate calculator)</div>';
                    suggestionsDiv.style.display = 'block';
                }
            } else if (suggestions && suggestions.length > 0) {
                // Original code path as fallback
                suggestionsDiv.innerHTML = suggestions.map(item => `
                    <div class="suggestion-item" data-style="${item.value}">
                        <strong>${item.value}</strong> - ${item.label.split(' - ')[1] || item.label}
                    </div>
                `).join('');
                suggestionsDiv.style.display = 'block';
                
                // Bind click events to suggestions
                suggestionsDiv.querySelectorAll('.suggestion-item').forEach(item => {
                    item.addEventListener('click', () => {
                        const style = item.dataset.style;
                        console.log('[ProductLineManager] Autocomplete selection:', style);
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
        // Quick check if this might be a cap product
        if (styleNumber.toLowerCase().includes('cap') || styleNumber.toLowerCase().includes('hat')) {
            console.warn('[ProductLineManager] Warning: This might be a cap product. Verifying...');
        }
        console.log('[ProductLineManager] Loading product details for:', styleNumber);
        
        try {
            this.showLoading(true);
            
            // Get product details and colors
            console.log('[ProductLineManager] Fetching product data...');
            const [detailsResponse, colorsResponse] = await Promise.all([
                fetch(`${this.baseURL}/api/product-details?styleNumber=${styleNumber}`),
                fetch(`${this.baseURL}/api/product-colors?styleNumber=${styleNumber}`)
            ]);
            
            console.log('[ProductLineManager] API responses:', detailsResponse.status, colorsResponse.status);
            
            const details = await detailsResponse.json();
            const colors = await colorsResponse.json();
            
            console.log('[ProductLineManager] Product details:', details);
            console.log('[ProductLineManager] Available colors:', colors);
            
            if (details && details.length > 0) {
                // Extract brand from the BRAND_NAME field (from console: BRAND_NAME is available)
                const productTitle = details[0].PRODUCT_TITLE || details[0].ProductTitle || details[0].Title || colors.productTitle;
                let brand = details[0].BRAND_NAME || details[0].BRAND || details[0].Brand;
                
                // If no brand field, try to extract from title
                if (!brand && productTitle) {
                    // Common brand patterns: "Port Authority...", "District...", "Port & Company..."
                    const brandMatch = productTitle.match(/^([^.]+)/);
                    if (brandMatch) {
                        brand = brandMatch[1].trim();
                    }
                }
                
                this.currentProduct = {
                    style: styleNumber,
                    title: productTitle,
                    brand: brand || 'Unknown Brand',
                    description: colors.PRODUCT_DESCRIPTION || details[0].PRODUCT_DESCRIPTION || details[0].DESCRIPTION || details[0].Description || 'Product description not available'
                };
                
                console.log('[ProductLineManager] Current product set:', this.currentProduct);
                console.log('[ProductLineManager] Raw product details fields:', Object.keys(details[0] || {}));
                console.log('[ProductLineManager] Raw colors fields:', Object.keys(colors || {}));
                
                // Update color dropdown
                const colorSelect = document.getElementById('color-select');
                if (colors.colors && colors.colors.length > 0) {
                    console.log('[ProductLineManager] Populating color dropdown with', colors.colors.length, 'colors');
                    
                    // Store full color data for future use
                    this.currentProduct.colorData = colors.colors;
                    
                    console.log('[ProductLineManager] Sample color object:', colors.colors[0]);
                    
                    colorSelect.innerHTML = '<option value="">Select a color</option>' +
                        colors.colors.map(color => 
                            `<option value="${color.COLOR_NAME}" data-catalog="${color.CATALOG_COLOR || ''}">${color.COLOR_NAME}</option>`
                        ).join('');
                    colorSelect.disabled = false;
                } else {
                    console.log('[ProductLineManager] No colors available');
                    colorSelect.innerHTML = '<option value="">No colors available</option>';
                    colorSelect.disabled = true;
                }
                
                const loadBtn = document.getElementById('load-product-btn');
                loadBtn.disabled = false;
                console.log('[ProductLineManager] Load Product button enabled');
            } else {
                console.error('[ProductLineManager] No product data returned');
            }
        } catch (error) {
            console.error('[ProductLineManager] Load product error:', error);
            alert('Failed to load product details: ' + error.message);
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
        
        console.log('[ProductLineManager] Load Product clicked:', { styleNumber, color });
        
        if (!styleNumber || !color) {
            alert('Please select style and color');
            return;
        }
        
        // Try to find the catalog color code for API calls
        let catalogColor = color;
        if (this.currentProduct.colorData) {
            const colorObj = this.currentProduct.colorData.find(c => c.COLOR_NAME === color);
            if (colorObj && colorObj.CATALOG_COLOR) {
                catalogColor = colorObj.CATALOG_COLOR;
                console.log('[ProductLineManager] Using catalog color:', catalogColor, 'instead of display color:', color);
            } else {
                console.log('[ProductLineManager] No catalog color found, using display color:', color);
            }
        }
        
        try {
            this.showLoading(true);
            
            console.log('[ProductLineManager] Fetching sizes and swatches...');
            
            // Get available sizes and swatches (use catalog color for sizes API)
            const sizesUrl = `${this.baseURL}/api/sizes-by-style-color?styleNumber=${styleNumber}&color=${encodeURIComponent(catalogColor)}`;
            const swatchesUrl = `${this.baseURL}/api/color-swatches?styleNumber=${styleNumber}`;
            
            console.log('[ProductLineManager] Sizes URL:', sizesUrl);
            console.log('[ProductLineManager] Swatches URL:', swatchesUrl);
            
            const [sizesResponse, swatchesResponse] = await Promise.all([
                fetch(sizesUrl),
                fetch(swatchesUrl)
            ]);
            
            console.log('[ProductLineManager] API responses:', sizesResponse.status, swatchesResponse.status);
            
            if (!sizesResponse.ok) {
                console.warn(`[ProductLineManager] Sizes API failed: ${sizesResponse.status} ${sizesResponse.statusText}`);
                console.warn(`[ProductLineManager] Attempting fallback with display color name...`);
                
                // Try fallback with original display color name if catalog color failed
                if (catalogColor !== color) {
                    const fallbackUrl = `${this.baseURL}/api/sizes-by-style-color?styleNumber=${styleNumber}&color=${encodeURIComponent(color)}`;
                    console.log('[ProductLineManager] Fallback URL:', fallbackUrl);
                    
                    const fallbackResponse = await fetch(fallbackUrl);
                    if (fallbackResponse.ok) {
                        console.log('[ProductLineManager] Fallback successful with display color');
                        const fallbackSizes = await fallbackResponse.json();
                        return this.handleSizesResponse(fallbackSizes, swatches, color, styleNumber);
                    }
                }
                
                // If both attempts failed, provide graceful fallback
                console.error(`[ProductLineManager] Both sizes API attempts failed. Using default sizes.`);
                const defaultSizes = { sizes: ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL'] };
                alert(`Size information not available for ${styleNumber} in ${color}. Using standard sizes - please verify with customer.`);
                return this.handleSizesResponse(defaultSizes, swatches, color, styleNumber);
            }
            
            const sizes = await sizesResponse.json();
            const swatches = await swatchesResponse.json();
            
            return this.handleSizesResponse(sizes, swatches, color, styleNumber);
        } catch (error) {
            console.error('[ProductLineManager] Load product error:', error);
            alert('Failed to load product sizes: ' + error.message);
        } finally {
            this.showLoading(false);
        }
    }
    
    /**
     * Handle sizes response and display product
     */
    handleSizesResponse(sizes, swatches, color, styleNumber) {
        console.log('[ProductLineManager] Raw sizes response:', sizes);
        console.log('[ProductLineManager] Raw swatches response:', swatches);
        
        // Handle multiple possible response formats: {data: [...]} or {sizes: [...]} or direct array
        let sizesArray = sizes.data || sizes.sizes || sizes;
        if (Array.isArray(sizesArray)) {
            this.availableSizes = sizesArray;
            this.currentProduct.color = color;
            
            console.log('[ProductLineManager] Available sizes:', this.availableSizes);
            
            // Find image from swatches
            let colorSwatch = null;
            if (swatches.data && Array.isArray(swatches.data)) {
                colorSwatch = swatches.data.find(s => s.color === color || s.COLOR_NAME === color);
            } else if (Array.isArray(swatches)) {
                colorSwatch = swatches.find(s => s.color === color || s.COLOR_NAME === color);
            }
            
            this.currentProduct.imageUrl = colorSwatch?.swatchUrl || colorSwatch?.COLOR_SQUARE_IMAGE || '';
            
            console.log('[ProductLineManager] Color swatch found:', colorSwatch);
            console.log('[ProductLineManager] Product image URL:', this.currentProduct.imageUrl);
            
            this.displayProduct();
            return true;
        } else {
            console.error('[ProductLineManager] Invalid sizes response format:', sizes);
            alert('Invalid sizes data received from server');
            return false;
        }
    }
    
    /**
     * Display loaded product
     */
    displayProduct() {
        console.log('[ProductLineManager] Displaying product:', this.currentProduct);
        console.log('[ProductLineManager] Available sizes:', this.availableSizes);
        
        const display = document.getElementById('product-display');
        if (!display) {
            console.error('[ProductLineManager] Product display element not found!');
            return;
        }
        
        // Update product info
        const productImage = document.getElementById('product-image');
        const productName = document.getElementById('product-name');
        const productDescription = document.getElementById('product-description');
        
        if (productImage) {
            productImage.src = this.currentProduct.imageUrl || '/images/placeholder.png';
            console.log('[ProductLineManager] Set product image:', productImage.src);
        }
        
        if (productName) {
            productName.textContent = `${this.currentProduct.style} - ${this.currentProduct.title}`;
            console.log('[ProductLineManager] Set product name:', productName.textContent);
        }
        
        if (productDescription) {
            productDescription.textContent = `${this.currentProduct.brand} | ${this.currentProduct.color}`;
            console.log('[ProductLineManager] Set product description:', productDescription.textContent);
        }
        
        // Create size inputs
        const sizeInputsDiv = document.getElementById('size-inputs');
        if (sizeInputsDiv && this.availableSizes && this.availableSizes.length > 0) {
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
            console.log('[ProductLineManager] Created size inputs for:', this.availableSizes);
        } else {
            console.error('[ProductLineManager] Size inputs div not found or no sizes available');
        }
        
        display.style.display = 'block';
        console.log('[ProductLineManager] Product display shown');
        
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
                        <img src="${product.imageUrl || '/images/placeholder.png'}" alt="${product.style}" 
                             onerror="this.src='/images/placeholder.png'" class="product-item-image">
                        <div class="product-item-info">
                            <strong>${product.style} - ${product.title}</strong>
                            <span>${product.color} | ${product.totalQuantity} pieces</span>
                            <small>${sizesList}</small>
                        </div>
                        <div class="product-item-actions">
                            <button class="btn-edit" onclick="window.productLineManager.editProduct(${product.id})" title="Edit quantities">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="btn-delete" onclick="window.productLineManager.removeProduct(${product.id})" title="Remove product">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
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
     * Edit product quantities
     */
    editProduct(productId) {
        const product = this.products.find(p => p.id === productId);
        if (!product) return;
        
        // Create edit modal HTML
        const modalHtml = `
            <div id="edit-product-modal" class="modal active">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>Edit Product Quantities</h3>
                        <button class="modal-close" onclick="window.productLineManager.closeEditModal()">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    <div class="modal-body">
                        <div class="product-edit-info">
                            <img src="${product.imageUrl || '/images/placeholder.png'}" 
                                 alt="${product.style}" class="product-edit-image">
                            <div>
                                <strong>${product.style} - ${product.title}</strong>
                                <p>${product.color}</p>
                            </div>
                        </div>
                        <div class="size-inputs edit-size-inputs">
                            ${Object.entries(product.sizeBreakdown).map(([size, qty]) => `
                                <div class="size-input-group">
                                    <label>${size}</label>
                                    <input type="number" 
                                           class="edit-size-qty" 
                                           data-size="${size}" 
                                           min="0" 
                                           value="${qty}">
                                </div>
                            `).join('')}
                        </div>
                        <div class="edit-total">
                            Total: <span id="edit-total-qty">0</span> pieces
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-secondary" onclick="window.productLineManager.closeEditModal()">
                            Cancel
                        </button>
                        <button class="btn btn-primary" onclick="window.productLineManager.saveProductEdit(${productId})">
                            Save Changes
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        // Add modal to DOM
        const existingModal = document.getElementById('edit-product-modal');
        if (existingModal) {
            existingModal.remove();
        }
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        
        // Add event listeners for quantity changes
        document.querySelectorAll('.edit-size-qty').forEach(input => {
            input.addEventListener('input', () => this.updateEditTotal());
        });
        
        // Calculate initial total
        this.updateEditTotal();
    }
    
    /**
     * Update edit modal total
     */
    updateEditTotal() {
        const inputs = document.querySelectorAll('.edit-size-qty');
        let total = 0;
        inputs.forEach(input => {
            total += parseInt(input.value) || 0;
        });
        const totalElement = document.getElementById('edit-total-qty');
        if (totalElement) {
            totalElement.textContent = total;
        }
    }
    
    /**
     * Save product edit
     */
    saveProductEdit(productId) {
        const product = this.products.find(p => p.id === productId);
        if (!product) return;
        
        const newSizeBreakdown = {};
        let totalQty = 0;
        
        document.querySelectorAll('.edit-size-qty').forEach(input => {
            const qty = parseInt(input.value) || 0;
            if (qty > 0) {
                newSizeBreakdown[input.dataset.size] = qty;
                totalQty += qty;
            }
        });
        
        if (totalQty === 0) {
            if (confirm('All quantities are 0. Remove this product?')) {
                this.removeProduct(productId);
                this.closeEditModal();
            }
            return;
        }
        
        // Update product
        product.sizeBreakdown = newSizeBreakdown;
        product.totalQuantity = totalQty;
        
        // Re-render and update pricing
        this.renderProductsList();
        this.updateContinueButton();
        
        if (window.embroideryQuoteBuilder) {
            window.embroideryQuoteBuilder.updatePricing();
        }
        
        this.closeEditModal();
    }
    
    /**
     * Close edit modal
     */
    closeEditModal() {
        const modal = document.getElementById('edit-product-modal');
        if (modal) {
            modal.remove();
        }
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