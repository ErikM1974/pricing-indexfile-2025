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
        this.logos = []; // Will be populated from LogoManager

        // Initialize exact match search (optimized for sales reps)
        this.exactMatchSearch = null; // Will be initialized when search is called

        this.initializeEvents();
    }

    /**
     * Initialize the exact match search module with callbacks
     */
    initializeExactMatchSearch(onExactMatch, onSuggestions) {
        if (!window.ExactMatchSearch) {
            console.error('[ProductLineManager] ExactMatchSearch module not loaded!');
            return false;
        }

        this.exactMatchSearch = new window.ExactMatchSearch({
            apiBase: this.baseURL,
            onExactMatch: onExactMatch,
            onSuggestions: onSuggestions,
            filterFunction: (item) => {
                // Embroidery works on apparel but not structured caps
                return this.isAllowedProduct(item);
            }
        });

        console.log('[ProductLineManager] Exact match search initialized');
        return true;
    }

    /**
     * Search for products using exact match optimization
     * This is the new method - auto-loads exact matches
     */
    searchWithExactMatch(query) {
        if (!this.exactMatchSearch) {
            console.error('[ProductLineManager] Exact match search not initialized. Call initializeExactMatchSearch() first.');
            return;
        }

        this.exactMatchSearch.search(query);
    }

    /**
     * Immediate search (for Enter key press)
     */
    searchImmediate(query) {
        if (!this.exactMatchSearch) {
            console.error('[ProductLineManager] Exact match search not initialized.');
            return;
        }

        this.exactMatchSearch.searchImmediate(query);
    }
    
    /**
     * Check if product is allowed (exclude caps, include beanies/watch caps)
     */
    isAllowedProduct(product) {
        const title = (product.label || product.PRODUCT_TITLE || product.value || '').toLowerCase();
        const description = (product.PRODUCT_DESCRIPTION || '').toLowerCase();

        // PRIORITY 1: Check for flat embroidery headwear using shared utility
        if (ProductCategoryFilter.isFlatHeadwear(product)) {
            console.log('[ProductLineManager] Allowed flat headwear product:', title);
            return true;  // ALLOW - flat embroidery works on these
        }

        // PRIORITY 2: Check for structured caps using shared utility
        if (ProductCategoryFilter.isStructuredCap(product)) {
            console.log('[ProductLineManager] Filtered out cap product:', title);
            return false;  // EXCLUDE - these go on cap machines
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

        // Load Product button removed (2025-10-17) - Auto-load on color selection now
        // Button was removed from HTML, functionality moved to handleColorChange()

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
     * LEGACY: Handle style number search
     * NOTE: This is kept for backwards compatibility but new code should use searchWithExactMatch()
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

                    // Fetch and display color swatches if available
                    this.fetchAndDisplayColorSwatches(styleNumber);
                } else {
                    console.log('[ProductLineManager] No colors available');
                    colorSelect.innerHTML = '<option value="">No colors available</option>';
                    colorSelect.disabled = true;
                }

                // Load Product button removed (2025-10-17) - Auto-load on color selection now
                console.log('[ProductLineManager] Product details loaded, ready for color selection');
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
     * Fetch and display color swatches from API
     */
    async fetchAndDisplayColorSwatches(styleNumber) {
        const swatchContainer = document.getElementById('color-swatches-container');
        const colorSelect = document.getElementById('color-select');

        if (!swatchContainer || !colorSelect) {
            console.warn('[ProductLineManager] Swatch container or select not found');
            return;
        }

        try {
            console.log('[ProductLineManager] Fetching color swatches for:', styleNumber);

            // Show loading state
            swatchContainer.innerHTML = '<div class="color-swatch-loading"><i class="fas fa-spinner fa-spin"></i> Loading colors...</div>';
            swatchContainer.style.display = 'grid';

            // Fetch swatches from API
            const response = await fetch(`${this.baseURL}/api/color-swatches?styleNumber=${styleNumber}`);

            if (!response.ok) {
                throw new Error(`Color swatches API failed: ${response.status}`);
            }

            const data = await response.json();
            console.log('[ProductLineManager] Color swatches received:', data);

            // API returns array directly, not wrapped in { swatches: [] }
            const swatches = Array.isArray(data) ? data : (data.swatches || []);

            if (swatches.length === 0) {
                // No swatches available, keep using dropdown
                console.log('[ProductLineManager] No swatches available, using dropdown');
                swatchContainer.style.display = 'none';
                colorSelect.classList.remove('swatch-mode');
                return;
            }

            // 🎯 UX IMPROVEMENT (2025-10-17): Smart "Show More" pattern - Simplified approach
            // Generate all swatches with "initially-hidden" class for colors beyond first 12
            const generateSwatchHTML = (swatch, index) => {
                const colorName = swatch.COLOR_NAME || swatch.name || 'Unknown';
                const imageUrl = swatch.COLOR_SQUARE_IMAGE || swatch.SWATCH_IMAGE_URL || swatch.swatchUrl || '';
                const catalogColor = swatch.CATALOG_COLOR || colorName;
                const isHidden = index >= 12; // Hide swatches beyond the first 12

                if (!imageUrl) {
                    console.warn('[ProductLineManager] No image URL for color:', colorName);
                    return '';
                }

                return `
                    <div class="color-swatch ${isHidden ? 'initially-hidden' : ''}"
                         data-color="${colorName}"
                         data-catalog="${catalogColor}"
                         title="${colorName}">
                        <img src="${imageUrl}"
                             alt="${colorName}"
                             class="color-swatch-image"
                             onerror="this.parentElement.style.display='none'">
                        <span class="color-swatch-name">${colorName}</span>
                    </div>
                `;
            };

            // Generate HTML for all swatches (no wrapper divs)
            const swatchesHTML = swatches
                .map((swatch, index) => generateSwatchHTML(swatch, index))
                .filter(html => html !== '')
                .join('');

            const hiddenCount = swatches.length - 12; // Count of hidden swatches

            if (swatchesHTML) {
                // Display swatches and hide dropdown
                swatchContainer.innerHTML = swatchesHTML;
                // Always use grid layout (no wrapper divs to complicate things)
                swatchContainer.style.display = 'grid';
                colorSelect.classList.add('swatch-mode');

                // Add "Show More" button if there are hidden swatches
                if (hiddenCount > 0) {
                    this.addShowMoreButton(swatchContainer, hiddenCount);
                }

                // Add click handlers to ALL swatches (visible and hidden)
                this.attachSwatchClickHandlers(swatchContainer, colorSelect);

                console.log('[ProductLineManager] ✅ Color swatches displayed:', swatches.length, '(showing', Math.min(12, swatches.length), 'initially)');

                // 🎨 MODERN STEP 2 UI INTEGRATION (2025-10-15)
                // Show the modern swatches section (progressive disclosure pattern)
                const swatchesSection = document.getElementById('qb-swatches-section');
                if (swatchesSection) {
                    swatchesSection.style.display = 'block';
                    console.log('[ProductLineManager] ✅ Modern swatches section shown');
                }
            } else {
                // No valid swatches with images, fall back to dropdown
                console.log('[ProductLineManager] No valid swatch images, using dropdown');
                swatchContainer.style.display = 'none';
                colorSelect.classList.remove('swatch-mode');
            }

        } catch (error) {
            console.warn('[ProductLineManager] Color swatches failed, falling back to dropdown:', error);

            // Hide swatches container and show dropdown
            swatchContainer.style.display = 'none';
            colorSelect.classList.remove('swatch-mode');

            // Don't show error to user - dropdown is perfectly fine fallback
        }
    }

    /**
     * Add "Show More Colors" button
     * 🎯 UX IMPROVEMENT (2025-10-17): Progressive disclosure pattern - Simplified with classes
     */
    addShowMoreButton(container, hiddenCount) {
        const button = document.createElement('button');
        button.id = 'show-more-colors-btn';
        button.className = 'qb-show-more-btn';
        button.innerHTML = `
            <span class="show-more-text">
                Show <span id="hidden-color-count">${hiddenCount}</span> More Colors
            </span>
            <i class="fas fa-chevron-down toggle-icon"></i>
        `;

        button.addEventListener('click', () => {
            // Toggle .show-more-active class on #product-phase
            const productPhase = document.getElementById('product-phase');
            const isExpanded = productPhase.classList.contains('show-more-active');

            if (isExpanded) {
                // Collapse - hide swatches with .initially-hidden class
                productPhase.classList.remove('show-more-active');
                button.classList.remove('expanded');
                button.querySelector('.show-more-text').innerHTML =
                    `Show <span id="hidden-color-count">${hiddenCount}</span> More Colors`;
            } else {
                // Expand - reveal swatches with .initially-hidden class
                productPhase.classList.add('show-more-active');
                button.classList.add('expanded');
                button.querySelector('.show-more-text').textContent = 'Show Less';
            }
        });

        container.appendChild(button);
        console.log('[ProductLineManager] ✅ "Show More" button added for', hiddenCount, 'hidden colors');
    }

    /**
     * Attach click handlers to all swatches (visible and hidden)
     * 🎯 UX IMPROVEMENT (2025-10-17): Universal swatch interaction
     */
    attachSwatchClickHandlers(container, colorSelect) {
        container.querySelectorAll('.color-swatch').forEach(swatch => {
            swatch.addEventListener('click', (e) => {
                const selectedColor = swatch.dataset.color;
                const catalogColor = swatch.dataset.catalog;

                // Remove selected class from all swatches
                container.querySelectorAll('.color-swatch').forEach(s => {
                    s.classList.remove('selected');
                });

                // Add selected class to clicked swatch
                swatch.classList.add('selected');

                // Update dropdown value
                colorSelect.value = selectedColor;

                // Update catalog color data attribute
                const selectedOption = Array.from(colorSelect.options).find(opt => opt.value === selectedColor);
                if (selectedOption) {
                    selectedOption.setAttribute('data-catalog', catalogColor);
                }

                // Trigger change event to auto-load product
                colorSelect.dispatchEvent(new Event('change', { bubbles: true }));

                console.log('[ProductLineManager] ✅ Color swatch selected:', selectedColor, catalogColor);
            });
        });

        console.log('[ProductLineManager] ✅ Click handlers attached to', container.querySelectorAll('.color-swatch').length, 'swatches');
    }

    /**
     * Handle color change - AUTO-LOAD product like Cap Embroidery builder (2025-10-17)
     */
    handleColorChange(color) {
        if (!color || !this.currentProduct) return;

        console.log('[ProductLineManager] Color selected:', color);

        // 🎯 AUTO-LOAD IMPROVEMENT (2025-10-17): Match Cap builder behavior
        // Automatically load product when color is selected (no button click needed)
        this.loadProduct();
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
            
            console.log('[ProductLineManager] Fetching sizes and product colors...');
            
            // Get available sizes and product colors with images (use catalog color for sizes API)
            const sizesUrl = `${this.baseURL}/api/sizes-by-style-color?styleNumber=${styleNumber}&color=${encodeURIComponent(catalogColor)}`;
            const colorsUrl = `${this.baseURL}/api/product-colors?styleNumber=${styleNumber}`;
            
            console.log('[ProductLineManager] Sizes URL:', sizesUrl);
            console.log('[ProductLineManager] Colors URL:', colorsUrl);
            
            const [sizesResponse, colorsResponse] = await Promise.all([
                fetch(sizesUrl),
                fetch(colorsUrl)
            ]);
            
            console.log('[ProductLineManager] API responses:', sizesResponse.status, colorsResponse.status);
            
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
                        const colors = await colorsResponse.json();
                        return this.handleSizesResponse(fallbackSizes, colors, color, styleNumber);
                    }
                }
                
                // If both attempts failed, provide graceful fallback
                console.error(`[ProductLineManager] Both sizes API attempts failed. Using default sizes.`);
                const defaultSizes = { sizes: ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL'] };
                const colors = await colorsResponse.json();
                alert(`Size information not available for ${styleNumber} in ${color}. Using standard sizes - please verify with customer.`);
                return this.handleSizesResponse(defaultSizes, colors, color, styleNumber);
            }
            
            const sizes = await sizesResponse.json();
            const colors = await colorsResponse.json();
            
            return this.handleSizesResponse(sizes, colors, color, styleNumber);
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
    handleSizesResponse(sizes, colors, color, styleNumber) {
        console.log('[ProductLineManager] Raw sizes response:', sizes);
        console.log('[ProductLineManager] Raw colors response:', colors);
        
        // Handle multiple possible response formats: {data: [...]} or {sizes: [...]} or direct array
        let sizesArray = sizes.data || sizes.sizes || sizes;
        if (Array.isArray(sizesArray)) {
            this.availableSizes = sizesArray;
            this.currentProduct.color = color;
            
            console.log('[ProductLineManager] Available sizes:', this.availableSizes);
            
            // Find image from colors data (product-colors API returns colors array)
            let colorData = null;
            if (colors.colors && Array.isArray(colors.colors)) {
                colorData = colors.colors.find(c => c.COLOR_NAME === color);
                console.log('[ProductLineManager] Found color data by COLOR_NAME:', color, colorData);
            }
            
            // If not found by exact match, try fuzzy matching
            if (!colorData && colors.colors && Array.isArray(colors.colors)) {
                colorData = colors.colors.find(c => 
                    c.COLOR_NAME?.toLowerCase() === color.toLowerCase() ||
                    c.CATALOG_COLOR?.toLowerCase() === color.toLowerCase()
                );
                console.log('[ProductLineManager] Found color data by fuzzy match:', color, colorData);
            }
            
            // Extract the model image URL (prioritize MAIN_IMAGE_URL or FRONT_MODEL)
            if (colorData) {
                this.currentProduct.imageUrl = colorData.MAIN_IMAGE_URL || colorData.FRONT_MODEL || colorData.FRONT_FLAT || '';
                console.log('[ProductLineManager] Using product model image:', this.currentProduct.imageUrl);
            } else {
                console.warn('[ProductLineManager] No color data found for:', color);
                this.currentProduct.imageUrl = '';
            }
            
            console.log('[ProductLineManager] Color data found:', colorData);
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
            // Use actual product image or generate a placeholder with style number
            productImage.src = this.currentProduct.imageUrl || 
                `https://via.placeholder.com/150x150/f0f0f0/666?text=${encodeURIComponent(this.currentProduct.style)}`;
            productImage.onerror = () => {
                productImage.src = `https://via.placeholder.com/150x150/f0f0f0/666?text=${encodeURIComponent(this.currentProduct.style)}`;
            };
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

        // 🎯 UX IMPROVEMENT (2025-10-15): Show success toast
        if (window.ToastNotifications) {
            ToastNotifications.success(`${product.style} ${product.color} added to quote (${totalQty} pieces)`);
        }

        // Trigger quote indicator update
        document.dispatchEvent(new CustomEvent('productAdded', {
            detail: { product, source: 'ProductLineManager' }
        }));
    }
    
    /**
     * Render products list
     * 🎨 PHASE 2 (2025-10-15): Modern compact card design
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

            // FIX (2025-12-19): LogoManager has primaryLogo (object) and additionalLogos (array), NOT a combined logos array
            const logoManager = window.embroideryQuoteBuilder?.logoManager;
            const primaryLogo = logoManager?.primaryLogo?.position ? {
                id: 'primary',
                isPrimary: true,
                position: logoManager.primaryLogo.position,
                stitchCount: logoManager.primaryLogo.stitchCount,
                needsDigitizing: logoManager.primaryLogo.needsDigitizing
            } : null;
            const additionalLogos = logoManager?.additionalLogos || [];
            if (!product.logoAssignments) {
                // AUTO-SELECT additional logos by default (2025-12-19 UX IMPROVEMENT)
                // 95% of orders include additional logos on ALL pieces
                const autoSelectedAdditional = additionalLogos.map(logo => ({
                    logoId: logo.id,
                    quantity: product.totalQuantity
                }));

                product.logoAssignments = {
                    primary: primaryLogo ? { logoId: primaryLogo.id, quantity: product.totalQuantity } : null,
                    additional: autoSelectedAdditional,  // Auto-select instead of empty array
                    monogram: null  // To be removed in next commit
                };
            }

            // Build size breakdown - SMART FILTERING (2025-10-17 POLISH)
            // Only show sizes with qty >= 1 to reduce visual clutter (hide empty sizes only)
            // If no meaningful quantities, show top 3 sizes
            const sizeEntries = Object.entries(product.sizeBreakdown);
            const significantSizes = sizeEntries.filter(([size, qty]) => qty >= 1);
            const displaySizes = significantSizes.length > 0 ? significantSizes : sizeEntries.slice(0, 3);
            const sizeBadges = displaySizes.map(([size, qty]) =>
                `<span class="size-badge">${size} <strong>×${qty}</strong></span>`
            ).join('');
            const sizesTooltip = sizeEntries.map(([size, qty]) => `${size}: ${qty}`).join(', ');

            return `
                <div class="product-card-modern" data-product-id="${product.id}">
                    <!-- Product Thumbnail (80px) -->
                    <img src="${product.imageUrl || 'https://via.placeholder.com/80x80/f0f0f0/666?text=' + encodeURIComponent(product.style)}"
                         alt="${product.style}"
                         onerror="this.src='https://via.placeholder.com/80x80/f0f0f0/666?text=' + encodeURIComponent('${product.style}')"
                         class="product-card-image">

                    <!-- Product Info (flexible width) -->
                    <div class="product-card-info">
                        <h4 class="product-card-title">${product.style}</h4>
                        <p class="product-card-subtitle">${product.title}</p>
                        <div class="product-card-meta">
                            <span class="color-badge">${product.color}</span>
                            <span class="qty-badge">${product.totalQuantity} pcs</span>
                        </div>
                        <!-- Size Breakdown (all sizes visible) -->
                        <div class="product-card-sizes" title="${sizesTooltip}">
                            ${sizeBadges}
                        </div>
                        <!-- Logo Selection (Collapsible) -->
                        ${this.renderLogoSelectionCollapsible(product, primaryLogo, additionalLogos)}
                    </div>

                    <!-- Actions (120px) -->
                    <div class="product-card-actions">
                        <button class="btn-icon btn-danger" onclick="window.productLineManager.removeProduct(${product.id})" title="Remove">
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

            // Trigger quote indicator update
            document.dispatchEvent(new CustomEvent('productRemoved', {
                detail: { productId, source: 'ProductLineManager' }
            }));
        }
    }
    
    /**
     * Reset product form
     * CRITICAL: Hides ALL elements to return to clean search state (2025 UX)
     */
    resetProductForm() {
        // Clear search input
        document.getElementById('style-search').value = '';
        document.getElementById('style-suggestions').style.display = 'none';

        // Reset color dropdown
        document.getElementById('color-select').innerHTML = '<option value="">Select style first</option>';
        document.getElementById('color-select').disabled = true;

        // 🎯 CRITICAL FIX (2025-10-15): Hide swatches section after adding product
        // This returns the interface to a clean search state (progressive disclosure pattern)
        const swatchesSection = document.getElementById('qb-swatches-section');
        if (swatchesSection) {
            swatchesSection.style.display = 'none';
            console.log('[ProductLineManager] ✅ Swatches section hidden (clean state)');
        }

        // Clear swatches container
        const swatchContainer = document.getElementById('color-swatches-container');
        if (swatchContainer) {
            swatchContainer.innerHTML = '';
        }

        // Hide product display
        document.getElementById('product-display').style.display = 'none';

        // Load Product button removed (2025-10-17) - No longer needed with auto-load

        console.log('[ProductLineManager] ✅ Form reset to clean search state');
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
     * Render logo selection with collapsible <details> element
     * 🎨 PHASE 2 (2025-10-15): Modern collapsible design
     */
    renderLogoSelectionCollapsible(product, primaryLogo, additionalLogos) {
        if (!primaryLogo && additionalLogos.length === 0) {
            return ''; // No logos defined yet
        }

        // Build preview cards for collapsed state
        let previewCards = '';

        // Primary logo preview
        if (primaryLogo) {
            previewCards += `
                <div class="logo-preview-card primary">
                    <i class="fas fa-check-circle"></i>
                    <div class="logo-preview-info">
                        <div class="logo-preview-name">${primaryLogo.position}</div>
                        <div class="logo-preview-meta">${primaryLogo.stitchCount.toLocaleString()} stitches</div>
                    </div>
                    <span class="badge badge-primary">PRIMARY</span>
                    <div class="logo-preview-qty">${product.totalQuantity} pcs</div>
                </div>
            `;
        }

        // Additional logo previews
        if (product.logoAssignments?.additional) {
            product.logoAssignments.additional.forEach(assignment => {
                const logo = additionalLogos.find(l => l.id === assignment.logoId);
                if (logo) {
                    previewCards += `
                        <div class="logo-preview-card additional">
                            <i class="fas fa-check-circle"></i>
                            <div class="logo-preview-info">
                                <div class="logo-preview-name">${logo.position}</div>
                                <div class="logo-preview-meta">${logo.stitchCount.toLocaleString()} stitches</div>
                            </div>
                            <span class="badge badge-additional">ADDITIONAL</span>
                            <div class="logo-preview-qty">${assignment.quantity} pcs</div>
                        </div>
                    `;
                }
            });
        }

        // Count selected logos for header
        let logoCount = primaryLogo ? 1 : 0;
        logoCount += product.logoAssignments?.additional?.length || 0;

        return `
            <details class="logo-details">
                <summary class="logo-summary">
                    <div class="logo-summary-header">
                        <i class="fas fa-image"></i>
                        <span>Logo Options</span>
                        <span class="logo-count">${logoCount} selected</span>
                    </div>
                    <i class="fas fa-chevron-down toggle-icon"></i>
                </summary>
                <div class="logo-preview-section">
                    ${previewCards}
                </div>
                <div class="logo-content">
                    ${this.renderLogoSelection(product, primaryLogo, additionalLogos)}
                </div>
            </details>
        `;
    }

    /**
     * Render logo selection checkboxes for a product (internal helper)
     * 🎨 PHASE 3 (2025-12-19): Modern card-based design with custom controls
     */
    renderLogoSelection(product, primaryLogo, additionalLogos) {
        if (!primaryLogo && additionalLogos.length === 0) {
            return ''; // No logos defined yet
        }

        let html = '<div class="logo-selection-section">';
        html += '<div class="logo-selection-header">Configure Logo Assignments</div>';
        html += '<div class="logo-selection-grid">';

        // Primary logo (always checked, disabled) - MODERN CARD
        if (primaryLogo) {
            html += `
                <div class="logo-card primary">
                    <div class="logo-card-checkbox-wrapper">
                        <div class="custom-checkbox checked disabled">
                            <i class="fas fa-check"></i>
                        </div>
                    </div>
                    <div class="logo-card-content">
                        <div class="logo-card-header">
                            <span class="logo-card-title">${primaryLogo.position}</span>
                            <span class="badge badge-primary">PRIMARY</span>
                        </div>
                        <div class="logo-card-meta">${primaryLogo.stitchCount.toLocaleString()} stitches</div>
                    </div>
                    <div class="logo-card-qty">
                        <div class="qty-display primary">
                            <span class="qty-number">${product.totalQuantity}</span>
                            <span class="qty-label">pieces</span>
                        </div>
                    </div>
                </div>
            `;
        }

        // Additional logos (optional with quantity controls) - MODERN CARDS
        additionalLogos.forEach(logo => {
            const assignment = product.logoAssignments?.additional?.find(a => a.logoId === logo.id);
            const isChecked = assignment ? true : false;
            const quantity = assignment?.quantity || product.totalQuantity;

            html += `
                <div class="logo-card additional ${isChecked ? 'checked' : ''}">
                    <div class="logo-card-checkbox-wrapper">
                        <div class="custom-checkbox ${isChecked ? 'checked' : ''}"
                             data-logo-id="${logo.id}"
                             data-product-id="${product.id}"
                             onclick="window.productLineManager.toggleAdditionalLogoModern(${product.id}, ${logo.id})">
                            <i class="fas fa-check"></i>
                        </div>
                    </div>
                    <div class="logo-card-content">
                        <div class="logo-card-header">
                            <span class="logo-card-title">${logo.position}</span>
                            <span class="badge badge-additional">ADDITIONAL</span>
                        </div>
                        <div class="logo-card-meta">${logo.stitchCount.toLocaleString()} stitches</div>
                    </div>
                    <div class="logo-card-qty">
                        <div class="qty-controls ${!isChecked ? 'disabled' : ''}">
                            <button type="button"
                                    class="qty-btn qty-minus"
                                    onclick="window.productLineManager.decrementLogoQty(${product.id}, ${logo.id})"
                                    ${!isChecked ? 'disabled' : ''}>
                                <i class="fas fa-minus"></i>
                            </button>
                            <input type="number"
                                   class="qty-input"
                                   min="1"
                                   max="${product.totalQuantity}"
                                   value="${quantity}"
                                   ${!isChecked ? 'disabled' : ''}
                                   data-logo-id="${logo.id}"
                                   data-product-id="${product.id}"
                                   onchange="window.productLineManager.updateAdditionalLogoQty(${product.id}, ${logo.id}, this.value)">
                            <button type="button"
                                    class="qty-btn qty-plus"
                                    onclick="window.productLineManager.incrementLogoQty(${product.id}, ${logo.id})"
                                    ${!isChecked ? 'disabled' : ''}>
                                <i class="fas fa-plus"></i>
                            </button>
                        </div>
                        <div class="qty-of-total">of ${product.totalQuantity}</div>
                    </div>
                </div>
            `;
        });

        html += '</div>';
        html += '</div>';

        return html;
    }
    
    /**
     * Get aggregate total
     */
    getAggregateTotal() {
        return this.products.reduce((sum, p) => sum + p.totalQuantity, 0);
    }
    
    /**
     * Toggle additional logo for a product
     */
    toggleAdditionalLogo(productId, logoId, isChecked) {
        const product = this.products.find(p => p.id === productId);
        if (!product) return;
        
        if (!product.logoAssignments) {
            product.logoAssignments = { primary: null, additional: [], monogram: null };
        }
        
        if (isChecked) {
            // Add the logo assignment with full quantity by default
            if (!product.logoAssignments.additional) {
                product.logoAssignments.additional = [];
            }
            product.logoAssignments.additional.push({
                logoId: logoId,
                quantity: product.totalQuantity
            });
            
            // Enable the quantity input
            const qtyInput = document.querySelector(`input.logo-qty-input[data-product-id="${productId}"][data-logo-id="${logoId}"]`);
            if (qtyInput) {
                qtyInput.disabled = false;
                qtyInput.value = product.totalQuantity;
            }
        } else {
            // Remove the logo assignment
            product.logoAssignments.additional = product.logoAssignments.additional.filter(a => a.logoId !== logoId);
            
            // Disable and clear the quantity input
            const qtyInput = document.querySelector(`input.logo-qty-input[data-product-id="${productId}"][data-logo-id="${logoId}"]`);
            if (qtyInput) {
                qtyInput.disabled = true;
                qtyInput.value = '';
            }
        }
        
        // Trigger pricing update
        if (window.embroideryQuoteBuilder) {
            window.embroideryQuoteBuilder.updatePricing();
        }
    }
    
    /**
     * Update additional logo quantity
     */
    updateAdditionalLogoQty(productId, logoId, quantity) {
        const product = this.products.find(p => p.id === productId);
        if (!product || !product.logoAssignments) return;

        const assignment = product.logoAssignments.additional?.find(a => a.logoId === logoId);
        if (assignment) {
            assignment.quantity = Math.min(parseInt(quantity) || 0, product.totalQuantity);
        }

        // Trigger pricing update
        if (window.embroideryQuoteBuilder) {
            window.embroideryQuoteBuilder.updatePricing();
        }
    }

    /**
     * Modern checkbox toggle (for custom checkboxes)
     * 🎨 PHASE 3 (2025-12-19): New helper for modern UI
     */
    toggleAdditionalLogoModern(productId, logoId) {
        const product = this.products.find(p => p.id === productId);
        if (!product) return;

        if (!product.logoAssignments) {
            product.logoAssignments = { primary: null, additional: [], monogram: null };
        }

        // Check if logo is currently assigned
        const assignment = product.logoAssignments.additional?.find(a => a.logoId === logoId);
        const isCurrentlyChecked = !!assignment;

        if (isCurrentlyChecked) {
            // Remove assignment
            product.logoAssignments.additional = product.logoAssignments.additional.filter(a => a.logoId !== logoId);
        } else {
            // Add assignment
            if (!product.logoAssignments.additional) {
                product.logoAssignments.additional = [];
            }
            product.logoAssignments.additional.push({
                logoId: logoId,
                quantity: product.totalQuantity
            });
        }

        // Update UI
        this.renderAllProducts();

        // Trigger pricing update
        if (window.embroideryQuoteBuilder) {
            window.embroideryQuoteBuilder.updatePricing();
        }
    }

    /**
     * Increment logo quantity
     * 🎨 PHASE 3 (2025-12-19): New helper for +/- buttons
     */
    incrementLogoQty(productId, logoId) {
        const product = this.products.find(p => p.id === productId);
        if (!product || !product.logoAssignments) return;

        const assignment = product.logoAssignments.additional?.find(a => a.logoId === logoId);
        if (assignment && assignment.quantity < product.totalQuantity) {
            assignment.quantity++;

            // Update input value
            const input = document.querySelector(`input.qty-input[data-product-id="${productId}"][data-logo-id="${logoId}"]`);
            if (input) input.value = assignment.quantity;

            // Trigger pricing update
            if (window.embroideryQuoteBuilder) {
                window.embroideryQuoteBuilder.updatePricing();
            }
        }
    }

    /**
     * Decrement logo quantity
     * 🎨 PHASE 3 (2025-12-19): New helper for +/- buttons
     */
    decrementLogoQty(productId, logoId) {
        const product = this.products.find(p => p.id === productId);
        if (!product || !product.logoAssignments) return;

        const assignment = product.logoAssignments.additional?.find(a => a.logoId === logoId);
        if (assignment && assignment.quantity > 1) {
            assignment.quantity--;

            // Update input value
            const input = document.querySelector(`input.qty-input[data-product-id="${productId}"][data-logo-id="${logoId}"]`);
            if (input) input.value = assignment.quantity;

            // Trigger pricing update
            if (window.embroideryQuoteBuilder) {
                window.embroideryQuoteBuilder.updatePricing();
            }
        }
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