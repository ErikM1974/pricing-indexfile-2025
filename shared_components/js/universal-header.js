// Universal Header - Cross-Page Navigation & Functionality
// Provides search, navigation, quote management, and utility functions
(function() {
    'use strict';

    console.log('[UNIVERSAL-HEADER] Universal Header System initializing...');

    // Configuration
    const HEADER_CONFIG = {
        styleSearchAPI: '/api/products/search', // Placeholder API endpoint
        sampleRequestAPI: '/api/samples/request',
        quoteRequestAPI: '/api/quotes/request',
        contactInfo: {
            phone: '253-922-5793',
            email: 'sales@nwcustomapparel.com',
            hours: '9AM-5PM'
        },
        searchDelay: 300, // Debounce delay for search
        maxSearchResults: 10
    };

    // State management
    const headerState = {
        currentProduct: null,
        searchTimeout: null,
        searchResults: [],
        isSearching: false,
        quickQuoteVisible: true
    };

    // Mock product data for demonstration (replace with actual API)
    const mockProducts = [
        { style: 'PC61', name: 'Port & Company Essential T-Shirt', category: 'T-Shirts' },
        { style: 'PC78', name: 'Port & Company Hoodie', category: 'Hoodies' },
        { style: 'C104', name: 'Flexfit Cotton Twill Cap', category: 'Caps' },
        { style: 'CP80', name: 'Flexfit Mesh Back Cap', category: 'Caps' },
        { style: 'LPC54LS', name: 'Port & Company Long Sleeve', category: 'Long Sleeve' },
        { style: 'DT6000', name: 'District Very Important Tee', category: 'T-Shirts' },
        { style: 'NE201', name: 'New Era Snapback Cap', category: 'Caps' },
        { style: 'F260', name: 'Hanes Ecosmart Hoodie', category: 'Hoodies' }
    ];

    // Main Universal Header Object
    const UniversalHeader = {
        
        /**
         * Initialize the universal header system
         */
        initialize() {
            console.log('[UNIVERSAL-HEADER] Initializing universal header system');
            
            this.removeLogoText();
            this.setupURLParameters();
            this.setupStyleSearch();
            this.setupBackToProduct();
            this.bindHeaderActions();
            
            console.log('[UNIVERSAL-HEADER] Universal header system ready');
        },

        /**
         * Remove logo text by replacing the logo image with text-free version
         */
        removeLogoText() {
            console.log('[UNIVERSAL-HEADER] Removing logo text globally');
            
            // Find the logo image element
            const logoImg = document.querySelector('.header-logo-img');
            
            if (logoImg) {
                // Replace with the text-free logo
                const textFreeLogoUrl = 'https://cdn.caspio.com/A0E15000/Safety%20Stripes/web%20northwest%20custom%20apparel%20logo.png?ver=1';
                logoImg.src = textFreeLogoUrl;
                logoImg.alt = 'NW Custom Apparel Logo';
                console.log('[UNIVERSAL-HEADER] Logo image replaced with text-free version');
            } else {
                // Try alternative selectors
                const altLogoImg = document.querySelector('.logo-image, img[alt*="Northwest Custom Apparel"]');
                if (altLogoImg) {
                    const textFreeLogoUrl = 'https://cdn.caspio.com/A0E15000/Safety%20Stripes/web%20northwest%20custom%20apparel%20logo.png?ver=1';
                    altLogoImg.src = textFreeLogoUrl;
                    altLogoImg.alt = 'NW Custom Apparel Logo';
                    console.log('[UNIVERSAL-HEADER] Logo image replaced with text-free version (alternative selector)');
                } else {
                    console.log('[UNIVERSAL-HEADER] Logo image element not found');
                }
            }
        },

        /**
         * Setup URL parameters and back to product functionality
         */
        setupURLParameters() {
            const urlParams = new URLSearchParams(window.location.search);
            const styleNumber = urlParams.get('StyleNumber');
            const colorCode = urlParams.get('COLOR');
            
            if (styleNumber && colorCode) {
                const productURL = `/product?StyleNumber=${encodeURIComponent(styleNumber)}&COLOR=${encodeURIComponent(colorCode)}`;
                
                // Update back to product button
                const backBtn = document.getElementById('back-to-product');
                if (backBtn) {
                    backBtn.href = productURL;
                    console.log('[UNIVERSAL-HEADER] Back to product URL set:', productURL);
                }
                
                // Update breadcrumb product link
                const breadcrumbProductLink = document.getElementById('breadcrumb-product-link');
                if (breadcrumbProductLink) {
                    breadcrumbProductLink.href = productURL;
                    breadcrumbProductLink.title = `Go back to ${styleNumber} - ${colorCode} product page`;
                    console.log('[UNIVERSAL-HEADER] Breadcrumb product link set:', productURL);
                }
                
                // Update product context
                this.updateProductContext(styleNumber, colorCode);
                
                // Store current product
                headerState.currentProduct = { styleNumber, colorCode };
            } else {
                // If no product context, disable the product link
                const breadcrumbProductLink = document.getElementById('breadcrumb-product-link');
                if (breadcrumbProductLink) {
                    breadcrumbProductLink.href = '#';
                    breadcrumbProductLink.style.cursor = 'default';
                    breadcrumbProductLink.style.opacity = '0.6';
                    breadcrumbProductLink.title = 'No product selected';
                    breadcrumbProductLink.onclick = (e) => e.preventDefault();
                }
            }
        },

        /**
         * Setup style search functionality with autocomplete
         */
        setupStyleSearch() {
            const searchInput = document.getElementById('style-search-input');
            const searchResults = document.getElementById('style-search-results');
            
            if (!searchInput || !searchResults) {
                console.warn('[UNIVERSAL-HEADER] Style search elements not found');
                return;
            }
            
            // Input event with debouncing
            searchInput.addEventListener('input', (e) => {
                const query = e.target.value.trim();
                
                // Clear previous timeout
                if (headerState.searchTimeout) {
                    clearTimeout(headerState.searchTimeout);
                }
                
                // Hide results if query is too short
                if (query.length < 2) {
                    this.hideSearchResults();
                    return;
                }
                
                // Debounced search
                headerState.searchTimeout = setTimeout(() => {
                    this.performSearch(query);
                }, HEADER_CONFIG.searchDelay);
            });
            
            // Handle focus events
            searchInput.addEventListener('focus', () => {
                if (searchInput.value.length >= 2) {
                    this.showSearchResults();
                }
            });

            // Handle keyboard navigation
            let selectedIndex = -1;
            searchInput.addEventListener('keydown', (e) => {
                console.log('[UNIVERSAL-HEADER] Keydown event detected, key:', e.key);
                
                const results = searchResults.querySelectorAll('.search-result-item');
                
                if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    selectedIndex = Math.min(selectedIndex + 1, results.length - 1);
                    this.highlightSearchResult(results, selectedIndex);
                } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    selectedIndex = Math.max(selectedIndex - 1, -1);
                    this.highlightSearchResult(results, selectedIndex);
                } else if (e.key === 'Enter') {
                    console.log('[UNIVERSAL-HEADER] Enter key detected');
                    e.preventDefault();
                    
                    if (selectedIndex >= 0 && results[selectedIndex]) {
                        // Select highlighted result
                        const selectedStyle = results[selectedIndex].dataset.style;
                        this.handleSearchSelection(selectedStyle, results[selectedIndex].textContent);
                    } else {
                        // Use input value directly
                        const styleNumber = searchInput.value.trim();
                        console.log('[UNIVERSAL-HEADER] Style number from input:', styleNumber);
                        
                        if (styleNumber) {
                            console.log('[UNIVERSAL-HEADER] Enter key pressed with valid value:', styleNumber);
                            this.hideSearchResults();
                            this.navigateToProduct(styleNumber);
                        } else {
                            console.warn('[UNIVERSAL-HEADER] Empty style number, not processing');
                        }
                    }
                } else if (e.key === 'Escape') {
                    this.hideSearchResults();
                    selectedIndex = -1;
                }
            });
            
            // Hide results when clicking outside
            document.addEventListener('click', (e) => {
                if (!e.target.closest('.style-search-container')) {
                    this.hideSearchResults();
                }
            });
            
            console.log('[UNIVERSAL-HEADER] Style search initialized');
        },

        /**
         * Perform product search using the same API as product page
         */
        async performSearch(query) {
            headerState.isSearching = true;
            console.log('[UNIVERSAL-HEADER] Searching for:', query);
            
            // Use the same API endpoint as the product page
            const API_PROXY_BASE_URL = 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';
            const searchUrl = `${API_PROXY_BASE_URL}/api/stylesearch?term=${encodeURIComponent(query)}`;
            
            try {
                console.log('[UNIVERSAL-HEADER] API URL:', searchUrl);
                const response = await fetch(searchUrl);
                
                if (!response.ok) {
                    const errorText = await response.text();
                    console.error('[UNIVERSAL-HEADER] API Response Text:', errorText);
                    throw new Error(`API Error ${response.status}: ${response.statusText}`);
                }
                
                const suggestions = await response.json();
                console.log('[UNIVERSAL-HEADER] Suggestions received from API:', suggestions);
                
                headerState.searchResults = suggestions;
                this.displaySearchResults(suggestions);
                
            } catch (error) {
                console.error('[UNIVERSAL-HEADER] Failed to fetch suggestions:', error);
                
                // Fallback to mock data if API fails
                console.log('[UNIVERSAL-HEADER] Using fallback mock data');
                const fallbackResults = mockProducts.filter(product => 
                    product.style.toLowerCase().includes(query.toLowerCase()) ||
                    product.name.toLowerCase().includes(query.toLowerCase())
                ).slice(0, HEADER_CONFIG.maxSearchResults);
                
                headerState.searchResults = fallbackResults.map(product => ({
                    label: `${product.style} - ${product.name}`,
                    value: product.style
                }));
                this.displaySearchResults(headerState.searchResults);
            }
            
            headerState.isSearching = false;
        },

        /**
         * Display search results in dropdown - matches product page format
         */
        displaySearchResults(results) {
            const searchResults = document.getElementById('style-search-results');
            if (!searchResults) return;
            
            if (results.length === 0) {
                searchResults.innerHTML = `
                    <div style="padding: 12px; color: #666; text-align: center; font-size: 0.9em;">
                        No products found. Try a different search term.
                    </div>
                `;
            } else {
                searchResults.innerHTML = results.map(suggestion => `
                    <div class="search-result-item" data-style="${suggestion.value}">
                        <div style="font-weight: bold; color: #2e5827; font-size: 0.95em;">${suggestion.label}</div>
                    </div>
                `).join('');
                
                // Add click handlers to search results
                searchResults.querySelectorAll('.search-result-item').forEach(item => {
                    item.addEventListener('click', () => {
                        const styleNumber = item.dataset.style;
                        this.handleSearchSelection(styleNumber, item.textContent);
                    });
                });
            }
            
            this.showSearchResults();
        },

        /**
         * Handle search selection - matches product page behavior
         */
        handleSearchSelection(selectedStyleNumber, selectedLabel) {
            console.log('[UNIVERSAL-HEADER] Style selected:', selectedStyleNumber);
            
            const searchInput = document.getElementById('style-search-input');
            if (searchInput) {
                searchInput.value = selectedStyleNumber;
            }
            
            this.hideSearchResults();
            this.navigateToProduct(selectedStyleNumber);
        },

        /**
         * Show search results dropdown
         */
        showSearchResults() {
            const searchResults = document.getElementById('style-search-results');
            if (searchResults) {
                searchResults.style.display = 'block';
            }
        },

        /**
         * Hide search results dropdown
         */
        hideSearchResults() {
            const searchResults = document.getElementById('style-search-results');
            if (searchResults) {
                searchResults.style.display = 'none';
            }
        },

        /**
         * Navigate to product - Universal method for all pricing pages
         */
        navigateToProduct(styleNumber, colorCode = null) {
            console.log('[UNIVERSAL-HEADER] Processing navigation request for:', styleNumber);
            
            // Determine current page type based on URL and context
            const currentPage = this.getCurrentPageType();
            console.log('[UNIVERSAL-HEADER] Current page type:', currentPage);
            
            if (currentPage === 'product' || currentPage === 'unknown') {
                // If we're on the product page or unknown page, go to product page
                const productURL = `/product?StyleNumber=${encodeURIComponent(styleNumber)}&COLOR=${encodeURIComponent(colorCode || 'default')}`;
                console.log('[UNIVERSAL-HEADER] Navigating to product page:', productURL);
                window.location.href = productURL;
            } else {
                // If we're on a pricing page, update the current page with new product
                this.updateCurrentPricingPage(styleNumber, colorCode);
            }
        },

        /**
         * Determine current page type based on URL and context
         */
        getCurrentPageType() {
            const url = window.location.href.toLowerCase();
            
            if (url.includes('cap-embroidery')) return 'cap-embroidery';
            if (url.includes('embroidery')) return 'embroidery';
            if (url.includes('screen-print')) return 'screen-print';
            if (url.includes('dtg')) return 'dtg';
            if (url.includes('dtf')) return 'dtf';
            if (url.includes('product.html') || url.includes('/product')) return 'product';
            
            // Check page title or other indicators
            const pageTitle = document.title.toLowerCase();
            if (pageTitle.includes('cap embroidery')) return 'cap-embroidery';
            if (pageTitle.includes('embroidery')) return 'embroidery';
            if (pageTitle.includes('screen print')) return 'screen-print';
            if (pageTitle.includes('dtg')) return 'dtg';
            if (pageTitle.includes('dtf')) return 'dtf';
            
            return 'unknown';
        },

        /**
         * Update current pricing page with new product - Universal for all pricing pages
         */
        async updateCurrentPricingPage(styleNumber, colorCode = null) {
            console.log('[UNIVERSAL-HEADER] Updating current pricing page with:', styleNumber, colorCode);
            
            try {
                // First, validate the product exists and get initial color if needed
                const productData = await this.fetchProductData(styleNumber);
                
                if (!productData || !productData.colors || productData.colors.length === 0) {
                    throw new Error('Product not found or has no color options');
                }
                
                // Use provided color or default to first available color
                const targetColor = colorCode || productData.colors[0].CATALOG_COLOR || productData.colors[0].COLOR_NAME;
                
                // Validate product suitability for current page (optional validation)
                const currentPageType = this.getCurrentPageType();
                const isProductSuitable = this.validateProductForPageType(productData, currentPageType);
                
                if (!isProductSuitable) {
                    // Show warning but proceed anyway
                    this.showNotification(`Note: ${styleNumber} may not be optimal for ${currentPageType} but loading anyway...`, 'warning');
                }
                
                // Update URL parameters
                const newUrl = new URL(window.location);
                newUrl.searchParams.set('StyleNumber', styleNumber);
                newUrl.searchParams.set('COLOR', targetColor);
                window.history.pushState({}, '', newUrl);
                
                // Update global variables that pricing systems depend on
                window.selectedStyleNumber = styleNumber;
                window.selectedCatalogColor = targetColor;
                window.selectedColorName = productData.colors.find(c => 
                    c.CATALOG_COLOR === targetColor || c.COLOR_NAME === targetColor
                )?.COLOR_NAME || targetColor;
                
                // Update header context display
                this.updateProductContext(styleNumber, targetColor);
                
                // Show loading notification
                this.showNotification(`Loading ${styleNumber} pricing...`, 'info');
                
                // Trigger page-specific refresh based on current page type
                this.triggerPageSpecificRefresh(styleNumber, targetColor, currentPageType);
                
                // Update product information display if available
                this.updateProductDisplay(productData, targetColor);
                
                console.log('[UNIVERSAL-HEADER] Successfully updated pricing page with new product');
                
            } catch (error) {
                console.error('[UNIVERSAL-HEADER] Failed to update pricing page:', error);
                this.showNotification(`Error loading ${styleNumber}: ${error.message}`, 'error');
                
                // Fallback: redirect to product page
                const productURL = `/product?StyleNumber=${encodeURIComponent(styleNumber)}`;
                console.log('[UNIVERSAL-HEADER] Falling back to product page:', productURL);
                window.location.href = productURL;
            }
        },

        /**
         * Fetch product data using the same API as other pages
         */
        async fetchProductData(styleNumber) {
            const API_PROXY_BASE_URL = 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';
            const productApiUrl = `${API_PROXY_BASE_URL}/api/product-colors?styleNumber=${encodeURIComponent(styleNumber)}`;
            
            console.log('[UNIVERSAL-HEADER] Fetching product data from:', productApiUrl);
            
            const response = await fetch(productApiUrl);
            if (!response.ok) {
                throw new Error(`Failed to fetch product data: ${response.statusText}`);
            }
            
            return await response.json();
        },

        /**
         * Validate if product is suitable for current page type
         */
        validateProductForPageType(productData, pageType) {
            if (!productData.productTitle) return true; // Can't validate without title
            
            const productTitle = productData.productTitle.toLowerCase();
            
            switch (pageType) {
                case 'cap-embroidery':
                    return productTitle.includes('cap') || productTitle.includes('hat') || 
                           productTitle.includes('beanie') || productTitle.includes('visor');
                
                case 'embroidery':
                    // Most apparel can be embroidered
                    return !productTitle.includes('electronic') && !productTitle.includes('accessory');
                
                case 'dtg':
                    // DTG works best on cotton garments
                    return productTitle.includes('shirt') || productTitle.includes('tee') || 
                           productTitle.includes('hoodie') || productTitle.includes('sweatshirt');
                
                case 'screen-print':
                    // Screen print works on most apparel
                    return !productTitle.includes('electronic') && !productTitle.includes('accessory');
                
                case 'dtf':
                    // DTF works on various materials
                    return true;
                
                default:
                    return true;
            }
        },

        /**
         * Trigger page-specific refresh functions
         */
        triggerPageSpecificRefresh(styleNumber, colorCode, pageType) {
            console.log('[UNIVERSAL-HEADER] Triggering refresh for page type:', pageType);
            
            // Universal triggers that work across all pricing pages
            if (typeof window.updatePageForStyle === 'function') {
                console.log('[UNIVERSAL-HEADER] Calling updatePageForStyle');
                window.updatePageForStyle(styleNumber);
            }
            
            if (typeof window.triggerPricingDataPageUpdates === 'function') {
                console.log('[UNIVERSAL-HEADER] Calling triggerPricingDataPageUpdates');
                window.triggerPricingDataPageUpdates(styleNumber, colorCode);
            }

            // Update URL parameters first for pricing-pages.js functions to read
            const url = new URL(window.location);
            url.searchParams.set('StyleNumber', styleNumber);
            url.searchParams.set('COLOR', colorCode);
            window.history.pushState({}, '', url);
            console.log('[UNIVERSAL-HEADER] URL updated for pricing-pages.js:', url.search);

            // Trigger pricing-pages.js update if available (for color swatches and product context)
            // The pricing-pages.js functions are in the global scope, not under a namespace
            if (typeof window.updateProductContext === 'function') {
                console.log('[UNIVERSAL-HEADER] Calling updateProductContext from pricing-pages.js');
                // This function reads URL parameters, so we don't need to pass them
                window.updateProductContext();
            }

            // Force refresh product details and colors (matches product page pattern)
            if (typeof window.fetchProductDetails === 'function') {
                console.log('[UNIVERSAL-HEADER] Calling fetchProductDetails from pricing-pages.js');
                window.fetchProductDetails(styleNumber);
            }

            // Call DP5Helper functions if available for color swatches
            if (window.DP5Helper) {
                if (typeof window.DP5Helper.refreshColorSwatches === 'function') {
                    console.log('[UNIVERSAL-HEADER] Calling DP5Helper.refreshColorSwatches');
                    window.DP5Helper.refreshColorSwatches();
                }
                if (typeof window.DP5Helper.fetchAndDisplayColors === 'function') {
                    console.log('[UNIVERSAL-HEADER] Calling DP5Helper.fetchAndDisplayColors');
                    window.DP5Helper.fetchAndDisplayColors(styleNumber);
                }
            }
            
            // Page-specific triggers based on common patterns
            switch (pageType) {
                case 'cap-embroidery':
                    if (typeof window.initDp7ApiFetch === 'function') {
                        console.log('[UNIVERSAL-HEADER] Triggering cap embroidery refresh');
                        window.initDp7ApiFetch(styleNumber);
                    }
                    break;
                
                case 'embroidery':
                    if (typeof window.initDp5ApiFetch === 'function') {
                        console.log('[UNIVERSAL-HEADER] Triggering embroidery refresh');
                        window.initDp5ApiFetch(styleNumber);
                    }
                    break;
                
                case 'dtg':
                    if (typeof window.initDp6ApiFetch === 'function') {
                        console.log('[UNIVERSAL-HEADER] Triggering DTG refresh');
                        window.initDp6ApiFetch(styleNumber);
                    }
                    break;
                
                case 'screen-print':
                    if (typeof window.initDp8ApiFetch === 'function') {
                        console.log('[UNIVERSAL-HEADER] Triggering screen print refresh');
                        window.initDp8ApiFetch(styleNumber);
                    }
                    break;
                
                case 'dtf':
                    if (typeof window.initDtfApiFetch === 'function') {
                        console.log('[UNIVERSAL-HEADER] Triggering DTF refresh');
                        window.initDtfApiFetch(styleNumber);
                    }
                    break;
            }
            
            // Generic fallback triggers
            if (typeof window.refreshPricingData === 'function') {
                window.refreshPricingData(styleNumber, colorCode);
            }
            
            if (typeof window.loadProductInfo === 'function') {
                window.loadProductInfo(styleNumber, colorCode);
            }
        },

        /**
         * Update product display elements if they exist on the page
         */
        updateProductDisplay(productData, colorCode) {
            // Update product title contexts
            const titleElements = document.querySelectorAll('#product-title-context, #product-title, .product-title');
            titleElements.forEach(el => {
                if (el) el.textContent = productData.productTitle || 'Product Title';
            });
            
            // Update style number contexts
            const styleElements = document.querySelectorAll('#product-style-context, .product-style');
            styleElements.forEach(el => {
                if (el) el.textContent = productData.styleNumber || window.selectedStyleNumber;
            });
            
            // Update product images if elements exist
            const selectedColor = productData.colors?.find(c => 
                c.CATALOG_COLOR === colorCode || c.COLOR_NAME === colorCode
            ) || productData.colors?.[0];
            
            if (selectedColor) {
                const mainImage = document.querySelector('#product-image-main, .product-image-main');
                if (mainImage && selectedColor.MAIN_IMAGE_URL) {
                    mainImage.src = selectedColor.MAIN_IMAGE_URL;
                    mainImage.alt = `${productData.productTitle} - ${selectedColor.COLOR_NAME}`;
                }
                
                // Update color swatch if exists
                const colorSwatch = document.querySelector('#pricing-color-swatch');
                const colorName = document.querySelector('#pricing-color-name');
                if (colorSwatch && selectedColor.COLOR_SQUARE_IMAGE) {
                    colorSwatch.style.backgroundImage = `url(${selectedColor.COLOR_SQUARE_IMAGE})`;
                }
                if (colorName) {
                    colorName.textContent = selectedColor.COLOR_NAME || colorCode;
                }
            }
            
            console.log('[UNIVERSAL-HEADER] Updated product display elements');
        },

        /**
         * Setup back to product button functionality
         */
        setupBackToProduct() {
            const backBtn = document.getElementById('back-to-product');
            if (backBtn) {
                backBtn.addEventListener('click', (e) => {
                    // Allow default navigation, but log the action
                    console.log('[UNIVERSAL-HEADER] Navigating back to product');
                });
            }
        },

        /**
         * Update product context display and breadcrumb navigation
         */
        updateProductContext(styleNumber, colorCode = null) {
            const contextElement = document.getElementById('current-product-context');
            const breadcrumbProductElement = document.getElementById('breadcrumb-product');
            const breadcrumbProductLink = document.getElementById('breadcrumb-product-link');
            
            if (contextElement) {
                const displayText = colorCode ? 
                    `${styleNumber} - ${colorCode}` : 
                    styleNumber;
                contextElement.textContent = displayText;
            }
            
            // Update breadcrumb product link to go to actual product page
            if (breadcrumbProductElement) {
                breadcrumbProductElement.textContent = styleNumber;
            }
            
            if (breadcrumbProductLink && styleNumber && colorCode) {
                const productURL = `/product?StyleNumber=${encodeURIComponent(styleNumber)}&COLOR=${encodeURIComponent(colorCode)}`;
                breadcrumbProductLink.href = productURL;
                breadcrumbProductLink.title = `Go back to ${styleNumber} - ${colorCode} product page`;
                console.log('[UNIVERSAL-HEADER] Breadcrumb product link updated:', productURL);
            }
            
            console.log('[UNIVERSAL-HEADER] Product context updated:', styleNumber, colorCode);
        },

        /**
         * Bind header action buttons
         */
        bindHeaderActions() {
            // Print quote functionality
            window.printQuote = () => {
                console.log('[UNIVERSAL-HEADER] Print quote requested');
                window.print();
            };
            
            // Share quote functionality
            window.shareQuote = () => {
                console.log('[UNIVERSAL-HEADER] Share quote requested');
                if (navigator.share) {
                    navigator.share({
                        title: 'Custom Apparel Quote - NW Custom Apparel',
                        text: 'Check out this custom apparel quote',
                        url: window.location.href
                    }).catch(err => console.log('Error sharing:', err));
                } else {
                    // Fallback: copy URL to clipboard
                    navigator.clipboard.writeText(window.location.href).then(() => {
                        this.showNotification('Quote URL copied to clipboard!', 'success');
                    }).catch(err => {
                        console.error('[UNIVERSAL-HEADER] Could not copy URL:', err);
                        this.showNotification('Could not copy URL', 'error');
                    });
                }
            };
            
            // Toggle help functionality
            window.toggleHelp = () => {
                console.log('[UNIVERSAL-HEADER] Help toggle requested');
                this.showHelpModal();
            };
            
            // Toggle quick quote
            window.toggleQuickQuote = () => {
                console.log('[UNIVERSAL-HEADER] Quick quote toggle requested');
                const quickQuote = document.querySelector('.quick-quote-banner');
                if (quickQuote) {
                    headerState.quickQuoteVisible = !headerState.quickQuoteVisible;
                    quickQuote.style.display = headerState.quickQuoteVisible ? 'flex' : 'none';
                    
                    // Update button text if we can find it
                    const button = document.querySelector('[onclick*="toggleQuickQuote"]');
                    if (button) {
                        button.textContent = headerState.quickQuoteVisible ? '📊 Quote' : '📊 Show Quote';
                    }
                } else {
                    this.showNotification('Quick Quote calculator not available on this page', 'info');
                }
            };
            
            // Request sample functionality
            window.requestSample = () => {
                console.log('[UNIVERSAL-HEADER] Sample request initiated');
                this.showSampleRequestModal();
            };
            
            // Contact for quote functionality
            window.contactForQuote = () => {
                console.log('[UNIVERSAL-HEADER] Contact for quote requested');
                this.initiateQuoteContact();
            };
            
            // Home navigation functionality
            window.goToHome = () => {
                console.log('[UNIVERSAL-HEADER] Navigating to home page');
                // Get the current URL origin and navigate to index.html
                const currentOrigin = window.location.origin;
                const homePath = currentOrigin.includes('localhost') ? 
                    `${currentOrigin}/index.html` : 
                    `${currentOrigin}/index.html`;
                window.location.href = homePath;
            };
        },

        /**
         * Highlight search result for keyboard navigation
         */
        highlightSearchResult(results, index) {
            results.forEach((result, i) => {
                if (i === index) {
                    result.style.backgroundColor = '#f8f9fa';
                    result.style.outline = '2px solid #2e5827';
                    result.style.outlineOffset = '-2px';
                } else {
                    result.style.backgroundColor = 'white';
                    result.style.outline = 'none';
                }
            });
        },

        /**
         * Show notification to user
         */
        showNotification(message, type = 'info') {
            const notification = document.createElement('div');
            
            let backgroundColor;
            switch (type) {
                case 'success': backgroundColor = '#28a745'; break;
                case 'error': backgroundColor = '#dc3545'; break;
                case 'warning': backgroundColor = '#ffc107'; break;
                case 'info': 
                default: backgroundColor = '#007bff'; break;
            }
            
            notification.style.cssText = `
                position: fixed; top: 20px; right: 20px; z-index: 10000;
                padding: 12px 20px; border-radius: 6px; color: ${type === 'warning' ? '#212529' : 'white'}; font-weight: bold;
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                transform: translateX(100%); transition: transform 0.3s ease;
                background: ${backgroundColor};
                max-width: 300px; word-wrap: break-word;
            `;
            notification.textContent = message;
            document.body.appendChild(notification);
            
            // Animate in
            setTimeout(() => notification.style.transform = 'translateX(0)', 100);
            
            // Auto remove (longer for warnings and errors)
            const duration = (type === 'warning' || type === 'error') ? 5000 : 3000;
            setTimeout(() => {
                notification.style.transform = 'translateX(100%)';
                setTimeout(() => {
                    if (document.body.contains(notification)) {
                        document.body.removeChild(notification);
                    }
                }, 300);
            }, duration);
        },

        /**
         * Show help modal
         */
        showHelpModal() {
            const modal = document.createElement('div');
            modal.style.cssText = `
                position: fixed; top: 0; left: 0; right: 0; bottom: 0;
                background: rgba(0,0,0,0.5); z-index: 10000;
                display: flex; align-items: center; justify-content: center;
                padding: 20px;
            `;
            
            modal.innerHTML = `
                <div style="
                    background: white; border-radius: 12px; padding: 30px;
                    max-width: 500px; width: 100%; max-height: 80vh; overflow-y: auto;
                    box-shadow: 0 8px 32px rgba(0,0,0,0.2);
                ">
                    <h3 style="margin: 0 0 20px 0; color: #2e5827; font-size: 1.4em;">Need Help?</h3>
                    
                    <div style="margin-bottom: 20px;">
                        <h4 style="margin: 0 0 10px 0; color: #333;">📞 Contact Us</h4>
                        <p style="margin: 0 0 5px 0;">Phone: ${HEADER_CONFIG.contactInfo.phone}</p>
                        <p style="margin: 0 0 5px 0;">Email: ${HEADER_CONFIG.contactInfo.email}</p>
                        <p style="margin: 0;">Hours: ${HEADER_CONFIG.contactInfo.hours}</p>
                    </div>
                    
                    <div style="margin-bottom: 20px;">
                        <h4 style="margin: 0 0 10px 0; color: #333;">🔍 Using Search</h4>
                        <p style="margin: 0 0 5px 0;">• Enter style number (e.g., PC61, C104)</p>
                        <p style="margin: 0 0 5px 0;">• Search by product name</p>
                        <p style="margin: 0;">• Click any result to view product</p>
                    </div>
                    
                    <div style="margin-bottom: 20px;">
                        <h4 style="margin: 0 0 10px 0; color: #333;">💰 Getting Quotes</h4>
                        <p style="margin: 0 0 5px 0;">• Use quick calculator for instant pricing</p>
                        <p style="margin: 0 0 5px 0;">• Adjust quantities and options</p>
                        <p style="margin: 0;">• Contact us for final quotes</p>
                    </div>
                    
                    <button onclick="this.closest('div[style*=\"position: fixed\"]').remove()" style="
                        background: #2e5827; color: white; border: none;
                        padding: 10px 20px; border-radius: 6px; cursor: pointer;
                        font-weight: bold; float: right;
                    ">Close</button>
                </div>
            `;
            
            document.body.appendChild(modal);
            
            // Close on background click
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    document.body.removeChild(modal);
                }
            });
        },

        /**
         * Show sample request modal
         */
        showSampleRequestModal() {
            const modal = document.createElement('div');
            modal.style.cssText = `
                position: fixed; top: 0; left: 0; right: 0; bottom: 0;
                background: rgba(0,0,0,0.5); z-index: 10000;
                display: flex; align-items: center; justify-content: center;
                padding: 20px;
            `;
            
            const currentProduct = headerState.currentProduct;
            const productInfo = currentProduct ? 
                `${currentProduct.styleNumber} - ${currentProduct.colorCode}` : 
                'No product selected';
            
            modal.innerHTML = `
                <div style="
                    background: white; border-radius: 12px; padding: 30px;
                    max-width: 400px; width: 100%;
                    box-shadow: 0 8px 32px rgba(0,0,0,0.2);
                ">
                    <h3 style="margin: 0 0 20px 0; color: #2e5827; font-size: 1.4em;">🧵 Request Sample</h3>
                    
                    <div style="margin-bottom: 15px;">
                        <label style="display: block; margin-bottom: 5px; font-weight: bold;">Product:</label>
                        <input type="text" value="${productInfo}" readonly style="
                            width: 100%; padding: 8px 12px; border: 2px solid #ddd;
                            border-radius: 6px; background: #f8f9fa;
                        ">
                    </div>
                    
                    <div style="margin-bottom: 15px;">
                        <label style="display: block; margin-bottom: 5px; font-weight: bold;">Your Email:</label>
                        <input type="email" placeholder="Enter your email" style="
                            width: 100%; padding: 8px 12px; border: 2px solid #ddd;
                            border-radius: 6px;
                        ">
                    </div>
                    
                    <div style="margin-bottom: 20px;">
                        <label style="display: block; margin-bottom: 5px; font-weight: bold;">Notes (optional):</label>
                        <textarea id="sample-notes" placeholder="Special requests or notes..." style="
                            width: 100%; padding: 8px 12px; border: 2px solid #ddd;
                            border-radius: 6px; height: 60px; resize: vertical;
                        "></textarea>
                    </div>
                    
                    <div style="display: flex; gap: 10px; justify-content: flex-end;">
                        <button onclick="this.closest('div[style*=\"position: fixed\"]').remove()" style="
                            background: #6c757d; color: white; border: none;
                            padding: 10px 20px; border-radius: 6px; cursor: pointer;
                        ">Cancel</button>
                        <button onclick="window.UniversalHeader.submitSampleRequest()" style="
                            background: #2e5827; color: white; border: none;
                            padding: 10px 20px; border-radius: 6px; cursor: pointer;
                            font-weight: bold;
                        ">Request Sample</button>
                    </div>
                </div>
            `;
            
            document.body.appendChild(modal);
            
            // Close on background click
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    document.body.removeChild(modal);
                }
            });
        },

        /**
         * Submit sample request
         */
        submitSampleRequest() {
            const emailInput = document.querySelector('input[type="email"]');
            const notesInput = document.getElementById('sample-notes');
            
            if (emailInput && emailInput.value) {
                const email = emailInput.value;
                const notes = notesInput ? notesInput.value : '';
                const product = headerState.currentProduct ?
                    `${headerState.currentProduct.styleNumber} - ${headerState.currentProduct.colorCode}` :
                    'No product selected';
                
                console.log('[UNIVERSAL-HEADER] Sample request submitted:', { email, product, notes });
                
                // In a real implementation, this would send to an API
                this.showNotification('Sample request submitted! We\'ll contact you soon.', 'success');
                
                // Close modal
                const modal = document.querySelector('div[style*="position: fixed"]');
                if (modal) modal.remove();
            } else {
                this.showNotification('Please enter your email address', 'warning');
            }
        },

        /**
         * Initiate quote contact
         */
        initiateQuoteContact() {
            const currentProduct = headerState.currentProduct;
            let subject = 'Quote Request - NW Custom Apparel';
            let body = 'Hi! I would like to request a quote for custom apparel.\n\n';
            
            if (currentProduct) {
                subject += ` - ${currentProduct.styleNumber}`;
                body += `Product: ${currentProduct.styleNumber} - ${currentProduct.colorCode}\n`;
                body += `Page: ${window.location.href}\n\n`;
            }
            
            body += 'Please provide pricing for:\n';
            body += '- Quantity: \n';
            body += '- Decoration: \n';
            body += '- Additional notes: \n\n';
            body += 'Thank you!';
            
            const emailLink = `mailto:${HEADER_CONFIG.contactInfo.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
            window.location.href = emailLink;
        }
    };

    // Expose to global scope
    window.UniversalHeader = UniversalHeader;

    // Auto-initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', UniversalHeader.initialize.bind(UniversalHeader));
    } else {
        UniversalHeader.initialize();
    }

    console.log('[UNIVERSAL-HEADER] Universal Header module loaded');

})();