/**
 * Cap Product Line Manager
 * Manages product additions with cap-specific filtering
 * CAPS ONLY - excludes beanies and knit products
 */

class CapProductLineManager {
    constructor() {
        this.baseURL = 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';
        this.products = [];
        this.nextProductId = 1;
        this.currentProduct = null;
        this.availableSizes = [];
        this.logos = []; // Will be populated from LogoManager
        
        this.initializeEvents();
        console.log('[CapProductLineManager] Initialized');
    }
    
    /**
     * Check if product is a structured cap (NOT beanie or knit)
     */
    isStructuredCap(product) {
        const title = (product.label || product.PRODUCT_TITLE || product.value || '').toLowerCase();
        const description = (product.PRODUCT_DESCRIPTION || '').toLowerCase();
        
        // EXCLUDE beanies and knits (these use flat embroidery)
        if (title.includes('beanie') || description.includes('beanie') ||
            title.includes('knit') || description.includes('knit')) {
            console.log('[CapProductLineManager] Filtered out knit/beanie product:', title);
            return false;
        }
        
        // INCLUDE structured caps only
        const capKeywords = ['cap', 'trucker', 'snapback', 'fitted', 
                            'flexfit', 'visor', 'mesh back', 'dad hat',
                            'baseball', '5-panel', '6-panel', 'bucket'];
        
        const isStructuredCap = capKeywords.some(keyword => 
            title.includes(keyword) || 
            description.includes(keyword)
        );
        
        if (!isStructuredCap) {
            console.log('[CapProductLineManager] Filtered out non-cap product:', title);
        }
        
        return isStructuredCap;
    }
    
    /**
     * Initialize event handlers
     */
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
        
        // Listen for logo changes
        window.addEventListener('capLogosChanged', (e) => {
            this.logos = e.detail.logos || [];
        });
    }
    
    /**
     * Handle style number search with cap filtering
     */
    async handleStyleSearch(query) {
        const suggestionsDiv = document.getElementById('style-suggestions');
        
        if (query.length < 2) {
            suggestionsDiv.innerHTML = '';
            suggestionsDiv.style.display = 'none';
            return;
        }
        
        try {
            console.log('[CapProductLineManager] Searching for caps:', query);
            
            // Search for products using the stylesearch endpoint
            const response = await fetch(`${this.baseURL}/api/stylesearch?term=${encodeURIComponent(query)}`);
            
            if (!response.ok) {
                throw new Error(`Search API failed: ${response.status}`);
            }
            
            const suggestions = await response.json();
            console.log('[CapProductLineManager] Raw search results:', suggestions?.length || 0);
            
            if (suggestions && suggestions.length > 0) {
                // Filter to show only structured caps
                const capSuggestions = suggestions.filter(item => this.isStructuredCap(item));
                console.log('[CapProductLineManager] Filtered cap results:', capSuggestions.length);
                
                if (capSuggestions.length > 0) {
                    // Show cap products with helpful note
                    const noteHtml = `
                        <div class="autocomplete-note" style="padding: 8px; background: #f0f9ff; color: #0369a1; font-size: 12px; border-bottom: 1px solid #e0e7ff;">
                            <i class="fas fa-hat-cowboy"></i> Structured caps only (beanies/knits use embroidery calculator)
                        </div>
                    `;
                    
                    suggestionsDiv.innerHTML = noteHtml + capSuggestions.map(item => `
                        <div class="suggestion-item" data-style="${item.value}">
                            <strong>${item.value}</strong> - ${item.label.split(' - ')[1] || item.label}
                        </div>
                    `).join('');
                    suggestionsDiv.style.display = 'block';
                    
                    // Bind click events
                    suggestionsDiv.querySelectorAll('.suggestion-item').forEach(item => {
                        item.addEventListener('click', () => {
                            const style = item.dataset.style;
                            console.log('[CapProductLineManager] Cap selected:', style);
                            document.getElementById('style-search').value = style;
                            suggestionsDiv.style.display = 'none';
                            this.loadProductDetails(style);
                        });
                    });
                } else {
                    // No caps found
                    suggestionsDiv.innerHTML = `
                        <div class="no-results" style="padding: 12px; color: #dc2626;">
                            <i class="fas fa-info-circle"></i> No caps found matching "${query}"
                            <br><small>Looking for beanies or knits? Use the <a href="/embroidery-quote-builder.html">Embroidery Quote Builder</a></small>
                        </div>
                    `;
                    suggestionsDiv.style.display = 'block';
                }
            } else {
                // No results at all
                suggestionsDiv.innerHTML = `
                    <div class="no-results" style="padding: 12px;">
                        No products found matching "${query}"
                    </div>
                `;
                suggestionsDiv.style.display = 'block';
            }
        } catch (error) {
            console.error('[CapProductLineManager] ❌ Search error:', error);
            
            // Show visible error - NO FALLBACKS
            if (typeof window !== 'undefined' && window.showErrorBanner) {
                window.showErrorBanner('PRODUCT SEARCH UNAVAILABLE - Cannot search for caps');
            }
            
            suggestionsDiv.innerHTML = `
                <div class="error" style="padding: 12px; color: #dc2626;">
                    <i class="fas fa-exclamation-triangle"></i> Search failed: ${error.message}
                </div>
            `;
            suggestionsDiv.style.display = 'block';
        }
    }
    
    /**
     * Load product details for selected cap
     */
    async loadProductDetails(styleNumber) {
        console.log('[CapProductLineManager] Loading cap details:', styleNumber);
        
        try {
            this.showLoading(true);
            
            // Get product details and colors
            const [detailsResponse, colorsResponse] = await Promise.all([
                fetch(`${this.baseURL}/api/product-details?styleNumber=${styleNumber}`),
                fetch(`${this.baseURL}/api/product-colors?styleNumber=${styleNumber}`)
            ]);
            
            if (!detailsResponse.ok) {
                throw new Error(`Product details failed: ${detailsResponse.status}`);
            }
            
            if (!colorsResponse.ok) {
                throw new Error(`Product colors failed: ${colorsResponse.status}`);
            }
            
            const details = await detailsResponse.json();
            const colors = await colorsResponse.json();
            
            console.log('[CapProductLineManager] Product details:', details);
            console.log('[CapProductLineManager] Available colors:', colors);
            
            if (!details || details.length === 0) {
                throw new Error('No product details found');
            }
            
            // Extract product information
            const productData = details[0];
            const productTitle = productData.PRODUCT_TITLE || productData.ProductTitle || productData.Title;
            const brand = productData.BRAND_NAME || productData.BRAND || productData.Brand || 'Unknown Brand';
            
            // Verify this is actually a cap
            if (!this.isStructuredCap({ label: productTitle, PRODUCT_DESCRIPTION: productData.description })) {
                throw new Error('Selected product is not a structured cap. Please use the Embroidery Quote Builder for beanies/knits.');
            }
            
            // Store current product
            this.currentProduct = {
                style: styleNumber,
                title: productTitle,
                brand: brand,
                colorData: colors.colors || []
            };
            
            // Populate color dropdown
            this.populateColorDropdown(colors.colors || []);
            
        } catch (error) {
            console.error('[CapProductLineManager] ❌ Product load error:', error);
            
            // Show visible error
            if (typeof window !== 'undefined' && window.showErrorBanner) {
                window.showErrorBanner(`PRODUCT LOAD FAILED: ${error.message}`);
            }
            
            alert(`Failed to load product: ${error.message}`);
        } finally {
            this.showLoading(false);
        }
    }
    
    /**
     * Populate color dropdown
     */
    populateColorDropdown(colors) {
        const colorSelect = document.getElementById('color-select');
        if (!colorSelect) return;
        
        if (colors.length === 0) {
            colorSelect.innerHTML = '<option value="">No colors available</option>';
            colorSelect.disabled = true;
            return;
        }
        
        // Sort colors alphabetically
        const sortedColors = colors.sort((a, b) => 
            (a.COLOR_NAME || a.name || '').localeCompare(b.COLOR_NAME || b.name || '')
        );
        
        colorSelect.innerHTML = '<option value="">Select color...</option>' + 
            sortedColors.map(color => {
                const colorName = color.COLOR_NAME || color.name || 'Unknown';
                const catalogColor = color.CATALOG_COLOR || colorName;
                return `<option value="${colorName}" data-catalog="${catalogColor}">${colorName}</option>`;
            }).join('');
        
        colorSelect.disabled = false;
        console.log('[CapProductLineManager] Colors populated:', sortedColors.length);
    }
    
    /**
     * Handle color selection
     */
    handleColorChange(color) {
        if (!color || !this.currentProduct) return;
        
        console.log('[CapProductLineManager] Color selected:', color);
        
        // Enable load button
        const loadBtn = document.getElementById('load-product-btn');
        if (loadBtn) {
            loadBtn.disabled = false;
        }
    }
    
    /**
     * Check if a cap style is likely fitted based on style number or title
     */
    isLikelyFitted(styleNumber, title = '') {
        const fittedPatterns = [
            'PTS20', 'PTS30', 'PTS40',  // Richardson fitted styles
            '110', '115',                // Richardson flex-fit models
            'FITTED', 'FLEXFIT', 'R-FLEX', 'FLEX FIT',
            'S/M', 'M/L', 'L/XL'
        ];
        
        const searchText = `${styleNumber} ${title}`.toUpperCase();
        return fittedPatterns.some(pattern => searchText.includes(pattern));
    }
    
    /**
     * Get default sizes based on cap type
     */
    getDefaultSizes(styleNumber, title = '') {
        if (this.isLikelyFitted(styleNumber, title)) {
            // Common fitted cap sizes
            return ['S/M', 'M/L', 'L/XL', 'XL/2XL'];
        } else {
            // Standard one-size-fits-all
            return ['OSFA'];
        }
    }
    
    /**
     * Load complete product with sizes
     */
    async loadProduct() {
        const colorSelect = document.getElementById('color-select');
        const color = colorSelect.value;
        
        if (!color || !this.currentProduct) {
            alert('Please select a color first');
            return;
        }
        
        // Get catalog color from the selected option (like embroidery quote builder)
        const selectedOption = colorSelect.options[colorSelect.selectedIndex];
        const catalogColor = selectedOption.getAttribute('data-catalog') || color;
        
        const styleNumber = this.currentProduct.style;
        const title = this.currentProduct.title || '';
        
        console.log('[CapProductLineManager] Loading sizes for:', styleNumber, color);
        console.log('[CapProductLineManager] Using catalog color for API:', catalogColor);
        
        try {
            this.showLoading(true);
            
            // Get sizes for this style/color combination using catalog color
            const sizesResponse = await fetch(`${this.baseURL}/api/sizes-by-style-color?styleNumber=${styleNumber}&color=${encodeURIComponent(catalogColor)}`);
            
            let sizesArray = [];
            
            if (!sizesResponse.ok) {
                console.warn(`[CapProductLineManager] Sizes API failed for catalog color: ${catalogColor} (${sizesResponse.status})`);
                // Use appropriate default sizes based on cap type
                console.log('[CapProductLineManager] Using default cap sizes as fallback');
                sizesArray = this.getDefaultSizes(styleNumber, title);
            } else {
                const sizesData = await sizesResponse.json();
                console.log('[CapProductLineManager] Sizes data:', sizesData);
                
                // Handle different response formats
                sizesArray = sizesData.data || sizesData.sizes || sizesData;
                if (!Array.isArray(sizesArray)) {
                    console.warn('[CapProductLineManager] Invalid sizes data format, using default');
                    sizesArray = this.getDefaultSizes(styleNumber, title);
                }
                
                if (sizesArray.length === 0) {
                    console.warn('[CapProductLineManager] No sizes available, using default');
                    sizesArray = this.getDefaultSizes(styleNumber, title);
                }
            }
            
            this.availableSizes = sizesArray;
            this.currentProduct.color = color;
            
            // Find product image
            const colorData = this.currentProduct.colorData.find(c => 
                c.COLOR_NAME === color || c.name === color
            );
            
            this.currentProduct.imageUrl = colorData?.MAIN_IMAGE_URL || 
                                          colorData?.FRONT_MODEL || 
                                          colorData?.FRONT_FLAT || '';
            
            console.log('[CapProductLineManager] Product ready:', this.currentProduct);
            console.log('[CapProductLineManager] Available sizes:', this.availableSizes);
            
            this.displayProduct();
            
        } catch (error) {
            console.error('[CapProductLineManager] ❌ Product load failed:', error);
            
            // Show visible error
            if (typeof window !== 'undefined' && window.showErrorBanner) {
                window.showErrorBanner(`CAP LOAD FAILED: ${error.message}`);
            }
            
            alert(`Failed to load cap: ${error.message}`);
        } finally {
            this.showLoading(false);
        }
    }
    
    /**
     * Display loaded product
     */
    async displayProduct() {
        console.log('[CapProductLineManager] Displaying product:', this.currentProduct);
        
        const display = document.getElementById('product-display');
        if (!display) {
            console.error('[CapProductLineManager] Product display element not found!');
            return;
        }
        
        // Update product info
        const productImage = document.getElementById('product-image');
        const productName = document.getElementById('product-name');
        const productDescription = document.getElementById('product-description');
        
        if (productImage) {
            productImage.src = this.currentProduct.imageUrl || 
                `https://via.placeholder.com/150x150/4cb354/white?text=${encodeURIComponent(this.currentProduct.style)}`;
            productImage.onerror = () => {
                productImage.src = `https://via.placeholder.com/150x150/4cb354/white?text=${encodeURIComponent(this.currentProduct.style)}`;
            };
        }
        
        if (productName) {
            productName.textContent = `${this.currentProduct.style} - ${this.currentProduct.title}`;
        }
        
        if (productDescription) {
            productDescription.textContent = `${this.currentProduct.brand} | ${this.currentProduct.color}`;
        }
        
        // Create size inputs (now async to fetch upcharges)
        await this.createSizeInputs();
        
        display.style.display = 'block';
        this.updateProductTotal();
    }
    
    /**
     * Get size description for display
     */
    getSizeDescription(size) {
        const sizeDescriptions = {
            'S/M': 'Small/Medium (6½"-7")',
            'M/L': 'Medium/Large (7"-7¼")',
            'L/XL': 'Large/X-Large (7¼"-7½")',
            'XL/2XL': 'X-Large/2X-Large (7½"-8")',
            'OSFA': 'One Size Fits All',
            'SM': 'Small',
            'MD': 'Medium', 
            'LG': 'Large',
            'XL': 'X-Large',
            '2XL': '2X-Large',
            '3XL': '3X-Large'
        };
        
        return sizeDescriptions[size] || size;
    }
    
    /**
     * Create size input controls
     */
    async createSizeInputs() {
        const sizeInputsDiv = document.getElementById('size-inputs');
        if (!sizeInputsDiv || !this.availableSizes.length) return;
        
        // Get size upcharges for this style
        let sizeUpcharges = {};
        try {
            sizeUpcharges = await this.getSizeUpcharges(this.currentProduct.style);
        } catch (error) {
            console.log('[CapProductLineManager] Could not fetch size upcharges:', error);
        }
        
        // Check if these are fitted sizes
        const isFitted = this.availableSizes.some(size => 
            size.includes('/') || ['S/M', 'M/L', 'L/XL'].includes(size)
        );
        
        // Create grouped layout for fitted caps
        if (isFitted) {
            sizeInputsDiv.innerHTML = `
                <div class="size-group-header">
                    <i class="fas fa-ruler"></i> Fitted Cap Sizes
                </div>
                <div class="fitted-sizes-grid">
                    ${this.availableSizes.map(size => {
                        const upcharge = sizeUpcharges[size];
                        const hasUpcharge = upcharge && upcharge > 0;
                        return `
                        <div class="size-input-group fitted ${hasUpcharge ? 'has-upcharge' : ''}">
                            <label class="size-label">
                                <strong>${size}</strong>
                                <small>${this.getSizeDescription(size)}</small>
                                ${hasUpcharge ? `<span class="upcharge-badge">+$${upcharge.toFixed(2)}</span>` : ''}
                            </label>
                            <input type="number" 
                                   class="size-qty-input" 
                                   data-size="${size}" 
                                   min="0" 
                                   value="0"
                                   placeholder="Qty">
                        </div>
                    `}).join('')}
                </div>
            `;
        } else {
            // Standard layout for OSFA or simple sizes
            sizeInputsDiv.innerHTML = this.availableSizes.map(size => {
                const upcharge = sizeUpcharges[size];
                const hasUpcharge = upcharge && upcharge > 0;
                return `
                <div class="size-input-group ${hasUpcharge ? 'has-upcharge' : ''}">
                    <label>
                        ${this.getSizeDescription(size)}
                        ${hasUpcharge ? `<span class="upcharge-badge">+$${upcharge.toFixed(2)}</span>` : ''}
                    </label>
                    <input type="number" 
                           class="size-qty-input" 
                           data-size="${size}" 
                           min="0" 
                           value="0"
                           placeholder="Quantity">
                </div>
            `}).join('');
        }
        
        console.log('[CapProductLineManager] Size inputs created for:', this.availableSizes);
        console.log('[CapProductLineManager] Size upcharges:', sizeUpcharges);
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
        
        const totalSpan = document.getElementById('product-total-qty');
        if (totalSpan) {
            totalSpan.textContent = total;
        }
        
        const addBtn = document.getElementById('add-to-quote-btn');
        if (addBtn) {
            addBtn.disabled = total === 0;
        }
    }
    
    /**
     * Add product to quote
     */
    async addProductToQuote() {
        if (!this.currentProduct) return;
        
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
            alert('Please enter quantities for at least one size');
            return;
        }
        
        console.log('[CapProductLineManager] Adding cap to quote:', this.currentProduct.style, sizeBreakdown);
        
        try {
            // Get size upcharges if any
            const sizeUpcharges = await this.getSizeUpcharges(this.currentProduct.style);
            
            const product = {
                id: this.nextProductId++,
                style: this.currentProduct.style,
                styleNumber: this.currentProduct.style,
                title: this.currentProduct.title,
                brand: this.currentProduct.brand,
                color: this.currentProduct.color,
                sizeBreakdown: sizeBreakdown,
                totalQuantity: totalQty,
                sizeUpcharges: sizeUpcharges,
                imageUrl: this.currentProduct.imageUrl
            };
            
            this.products.push(product);
            console.log('[CapProductLineManager] ✅ Cap added to quote');
            
            // Update UI
            this.renderProductsList();
            this.updateAggregateTotal();
            this.resetProductForm();
            
            // Check if we can continue to summary
            this.updateContinueButton();
            
        } catch (error) {
            console.error('[CapProductLineManager] ❌ Failed to add cap:', error);
            alert(`Failed to add cap: ${error.message}`);
        }
    }
    
    /**
     * Get size upcharges for a style
     */
    async getSizeUpcharges(styleNumber) {
        try {
            console.log('[CapProductLineManager] Checking size upcharges for:', styleNumber);
            
            const response = await fetch(`${this.baseURL}/api/size-pricing?styleNumber=${styleNumber}`);
            
            if (!response.ok) {
                console.log('[CapProductLineManager] Size pricing not available, assuming no upcharges');
                return {};
            }
            
            const data = await response.json();
            const upcharges = data.sizeUpcharges || {};
            
            console.log('[CapProductLineManager] Size upcharges:', upcharges);
            return upcharges;
            
        } catch (error) {
            console.warn('[CapProductLineManager] Size upcharge check failed (assuming none):', error.message);
            return {};
        }
    }
    
    /**
     * Render products list
     */
    renderProductsList() {
        const container = document.getElementById('products-container');
        if (!container) return;
        
        if (this.products.length === 0) {
            container.innerHTML = '<p class="empty-message">No caps added yet</p>';
            return;
        }
        
        container.innerHTML = this.products.map(product => {
            const sizesList = Object.entries(product.sizeBreakdown)
                .filter(([size, qty]) => qty > 0)
                .map(([size, qty]) => `${size}(${qty})`)
                .join(' ');
            
            return `
                <div class="product-item" data-product-id="${product.id}">
                    <div class="product-item-image">
                        <img src="${product.imageUrl || `https://via.placeholder.com/60x60/4cb354/white?text=${product.style}`}" alt="${product.style}">
                    </div>
                    <div class="product-item-info">
                        <h4>${product.style} - ${product.title}</h4>
                        <p>${product.brand} | ${product.color}</p>
                        <p class="sizes">${sizesList}</p>
                        <p class="quantity"><strong>Total: ${product.totalQuantity} caps</strong></p>
                    </div>
                    <div class="product-item-actions">
                        <button class="btn-sm btn-danger" onclick="window.capProductLineManager.removeProduct(${product.id})">
                            <i class="fas fa-trash"></i> Remove
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    }
    
    /**
     * Remove product from quote
     */
    removeProduct(productId) {
        const index = this.products.findIndex(p => p.id === productId);
        if (index > -1) {
            this.products.splice(index, 1);
            console.log('[CapProductLineManager] Product removed:', productId);
            
            this.renderProductsList();
            this.updateAggregateTotal();
            this.updateContinueButton();
        }
    }
    
    /**
     * Update aggregate total and tier indicator
     */
    updateAggregateTotal() {
        const totalQty = this.products.reduce((sum, p) => sum + p.totalQuantity, 0);
        
        const totalSpan = document.getElementById('aggregate-total');
        if (totalSpan) {
            totalSpan.textContent = totalQty;
        }
        
        // Update tier indicator
        const tierIndicator = document.getElementById('tier-indicator');
        if (tierIndicator) {
            let tierText = '';
            if (totalQty > 0) {
                if (totalQty < 24) tierText = '(1-23 tier + LTM fee)';
                else if (totalQty < 48) tierText = '(24-47 tier)';
                else if (totalQty < 72) tierText = '(48-71 tier)';
                else tierText = '(72+ tier)';
            }
            tierIndicator.textContent = tierText;
        }
        
        // Dispatch event for pricing updates
        window.dispatchEvent(new CustomEvent('capProductsChanged', {
            detail: { products: this.products, totalQuantity: totalQty }
        }));
    }
    
    /**
     * Update continue button state
     */
    updateContinueButton() {
        const continueBtn = document.getElementById('continue-to-summary');
        if (continueBtn) {
            continueBtn.disabled = this.products.length === 0;
        }
    }
    
    /**
     * Reset product form
     */
    resetProductForm() {
        const display = document.getElementById('product-display');
        if (display) {
            display.style.display = 'none';
        }
        
        document.getElementById('style-search').value = '';
        document.getElementById('color-select').innerHTML = '<option value="">Select style first</option>';
        document.getElementById('color-select').disabled = true;
        document.getElementById('load-product-btn').disabled = true;
        
        this.currentProduct = null;
        this.availableSizes = [];
    }
    
    /**
     * Show/hide loading overlay
     */
    showLoading(show) {
        const overlay = document.getElementById('loading-overlay');
        if (overlay) {
            overlay.style.display = show ? 'flex' : 'none';
        }
    }
    
    /**
     * Get current products data
     */
    getProducts() {
        return [...this.products];
    }
    
    /**
     * Get total quantity across all products
     */
    getTotalQuantity() {
        return this.products.reduce((sum, p) => sum + p.totalQuantity, 0);
    }
}

// Export for use in other modules
if (typeof window !== 'undefined') {
    window.CapProductLineManager = CapProductLineManager;
}