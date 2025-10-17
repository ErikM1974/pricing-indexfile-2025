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
     * Populate color dropdown and fetch color swatches
     */
    async populateColorDropdown(colors) {
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

        // Fetch and display color swatches if available
        if (this.currentProduct && this.currentProduct.style) {
            await this.fetchAndDisplayColorSwatches(this.currentProduct.style);
        }
    }

    /**
     * Fetch and display color swatches from API
     */
    async fetchAndDisplayColorSwatches(styleNumber) {
        const swatchContainer = document.getElementById('color-swatches-container');
        const colorSelect = document.getElementById('color-select');

        if (!swatchContainer || !colorSelect) {
            console.warn('[CapProductLineManager] Swatch container or select not found');
            return;
        }

        try {
            console.log('[CapProductLineManager] Fetching color swatches for:', styleNumber);

            // Show loading state
            swatchContainer.innerHTML = '<div class="color-swatch-loading"><i class="fas fa-spinner fa-spin"></i> Loading colors...</div>';
            swatchContainer.style.display = 'block';

            // Fetch swatches from API
            const response = await fetch(`${this.baseURL}/api/color-swatches?styleNumber=${styleNumber}`);

            if (!response.ok) {
                throw new Error(`Color swatches API failed: ${response.status}`);
            }

            const data = await response.json();
            console.log('[CapProductLineManager] Color swatches received:', data);

            // API returns array directly, not wrapped in { swatches: [] }
            const swatches = Array.isArray(data) ? data : (data.swatches || []);

            if (swatches.length === 0) {
                // No swatches available, keep using dropdown
                console.log('[CapProductLineManager] No swatches available, using dropdown');
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
                    console.warn('[CapProductLineManager] No image URL for color:', colorName);
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

                console.log('[CapProductLineManager] ✅ Color swatches displayed:', swatches.length, '(showing', Math.min(12, swatches.length), 'initially)');

                // 🎨 MODERN STEP 2 UI INTEGRATION (2025-10-15)
                // Show the modern swatches section (progressive disclosure pattern)
                const swatchesSection = document.getElementById('qb-swatches-section');
                if (swatchesSection) {
                    swatchesSection.style.display = 'block';
                    console.log('[CapProductLineManager] ✅ Modern swatches section shown');
                }
            } else {
                // No valid swatches with images, fall back to dropdown
                console.log('[CapProductLineManager] No valid swatch images, using dropdown');
                swatchContainer.style.display = 'none';
                colorSelect.classList.remove('swatch-mode');
            }

        } catch (error) {
            console.warn('[CapProductLineManager] Color swatches failed, falling back to dropdown:', error);

            // Hide swatches container and show dropdown
            swatchContainer.style.display = 'none';
            colorSelect.classList.remove('swatch-mode');

            // Don't show error to user - dropdown is perfectly fine fallback
        }
    }
    
    /**
     * Add "Show More Colors" button
     * 🎯 UX IMPROVEMENT (2025-10-17): Progressive disclosure pattern
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
            // 🎯 SIMPLIFIED APPROACH (2025-10-17): Toggle .show-more-active class on #product-phase
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
        console.log('[CapProductLineManager] ✅ "Show More" button added for', hiddenCount, 'hidden colors');
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

                console.log('[CapProductLineManager] ✅ Color swatch selected:', selectedColor, catalogColor);
            });
        });

        console.log('[CapProductLineManager] ✅ Click handlers attached to', container.querySelectorAll('.color-swatch').length, 'swatches');
    }

    /**
     * Handle color selection - AUTO-LOAD product (2025-10-17)
     */
    handleColorChange(color) {
        if (!color || !this.currentProduct) return;

        console.log('[CapProductLineManager] Color selected:', color);

        // 🎯 AUTO-LOAD IMPROVEMENT (2025-10-17): Match Embroidery builder behavior
        // Automatically load product when color is selected (no button click needed)
        this.loadProduct();
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
    displayProduct() {
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
        
        // Create size inputs
        this.createSizeInputs();
        
        display.style.display = 'block';
        this.updateProductTotal();
    }
    
    /**
     * Create size input controls
     */
    createSizeInputs() {
        const sizeInputsDiv = document.getElementById('size-inputs');
        if (!sizeInputsDiv || !this.availableSizes.length) return;
        
        // Simple, clean layout matching embroidery builder
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
        
        console.log('[CapProductLineManager] Size inputs created for:', this.availableSizes);
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

            // 🎯 UX IMPROVEMENT (2025-10-15): Show success toast
            if (window.ToastNotifications) {
                ToastNotifications.success(`${product.style} ${product.color} added to quote (${totalQty} pieces)`);
            }

            // Trigger quote indicator update
            document.dispatchEvent(new CustomEvent('productAdded', {
                detail: { product, source: 'CapProductLineManager' }
            }))
            
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
     * 🎨 PHASE 2 (2025-10-15): Modern compact card design
     */
    renderProductsList() {
        const container = document.getElementById('products-container');
        if (!container) return;

        if (this.products.length === 0) {
            container.innerHTML = '<p class="empty-message">No caps added yet</p>';
            document.getElementById('aggregate-total').textContent = '0';
            return;
        }

        let aggregateTotal = 0;

        container.innerHTML = this.products.map(product => {
            aggregateTotal += product.totalQuantity;

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
                    <img src="${product.imageUrl || 'https://via.placeholder.com/80x80/4cb354/white?text=' + encodeURIComponent(product.style)}"
                         alt="${product.style}"
                         onerror="this.src='https://via.placeholder.com/80x80/4cb354/white?text=' + encodeURIComponent('${product.style}')"
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
                    </div>

                    <!-- Actions (120px) -->
                    <div class="product-card-actions">
                        <button class="btn-icon btn-danger" onclick="window.capProductLineManager.removeProduct(${product.id})" title="Remove">
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
     * Update tier indicator based on aggregate quantity
     * 🎨 PHASE 2 (2025-10-15): Helper for tier display
     */
    updateTierIndicator(totalQty) {
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
    }
    
    /**
     * Remove product from quote
     */
    removeProduct(productId) {
        const index = this.products.findIndex(p => p.id === productId);
        if (index > -1) {
            const removedProduct = this.products[index];
            this.products.splice(index, 1);
            console.log('[CapProductLineManager] Product removed:', productId);

            this.renderProductsList();
            this.updateAggregateTotal();
            this.updateContinueButton();

            // Trigger quote indicator update
            document.dispatchEvent(new CustomEvent('productRemoved', {
                detail: { productId, product: removedProduct, source: 'CapProductLineManager' }
            }));
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

        // Update tier indicator using dedicated function
        this.updateTierIndicator(totalQty);

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
     * CRITICAL: Hides ALL elements to return to clean search state (2025 UX)
     */
    resetProductForm() {
        // Clear search input
        document.getElementById('style-search').value = '';

        // Reset color dropdown
        document.getElementById('color-select').innerHTML = '<option value="">Select style first</option>';
        document.getElementById('color-select').disabled = true;

        // 🎯 CRITICAL FIX (2025-10-15): Hide swatches section after adding product
        // This returns the interface to a clean search state (progressive disclosure pattern)
        const swatchesSection = document.getElementById('qb-swatches-section');
        if (swatchesSection) {
            swatchesSection.style.display = 'none';
            console.log('[CapProductLineManager] ✅ Swatches section hidden (clean state)');
        }

        // Clear swatches container
        const swatchContainer = document.getElementById('color-swatches-container');
        if (swatchContainer) {
            swatchContainer.innerHTML = '';
        }

        // Hide product display
        const display = document.getElementById('product-display');
        if (display) {
            display.style.display = 'none';
        }

        // Load Product button removed (2025-10-17) - No longer needed with auto-load

        // Reset state
        this.currentProduct = null;
        this.availableSizes = [];

        console.log('[CapProductLineManager] ✅ Form reset to clean search state');
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