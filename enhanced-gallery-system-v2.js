// Enhanced Gallery System V2 - Improved Caspio Interception
// Optimized for internal sales tool with direct pricing display

console.log('[Enhanced Gallery V2] Loading...');

(function() {
    'use strict';
    
    // Configuration
    const CONFIG = {
        API_URL: 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/base-item-costs',
        CACHE_DURATION: 2 * 60 * 60 * 1000, // 2 hours
        PRICE_MARKUP: 0.60,
        PRICE_ADDON: 15.00,
        DEBOUNCE_DELAY: 300,
        MAX_RETRIES: 3
    };
    
    // State
    const state = {
        isInitialized: false,
        caspioForm: null,
        resultsContainer: null,
        priceCache: new Map(),
        loadingPrices: new Set(),
        observer: null,
        retryCount: 0
    };
    
    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
    
    function init() {
        console.log('[Enhanced Gallery V2] Initializing...');
        
        // Try to find Caspio immediately
        findCaspioForm();
        
        // If not found, wait for it
        if (!state.caspioForm) {
            waitForCaspio();
        }
    }
    
    function findCaspioForm() {
        // Look for various Caspio form selectors
        const selectors = [
            '.cbFormSection',
            '[id*="cbForm"]',
            'form[action*="caspio.com"]',
            '.cbFormTable'
        ];
        
        for (const selector of selectors) {
            const form = document.querySelector(selector);
            if (form) {
                state.caspioForm = form;
                console.log('[Enhanced Gallery V2] Found Caspio form:', selector);
                onCaspioReady();
                return true;
            }
        }
        return false;
    }
    
    function waitForCaspio() {
        const observer = new MutationObserver((mutations) => {
            if (findCaspioForm()) {
                observer.disconnect();
            }
        });
        
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
        
        // Timeout after 10 seconds
        setTimeout(() => {
            observer.disconnect();
            if (!state.caspioForm) {
                console.error('[Enhanced Gallery V2] Caspio form not found after 10s');
                // Try alternative initialization
                alternativeInit();
            }
        }, 10000);
    }
    
    function onCaspioReady() {
        if (state.isInitialized) return;
        state.isInitialized = true;
        
        console.log('[Enhanced Gallery V2] Caspio ready, setting up...');
        
        // Hide original form
        hideCaspioForm();
        
        // Create our interface
        createEnhancedInterface();
        
        // Intercept results
        interceptResults();
        
        // Setup search functionality
        setupSearch();
    }
    
    function hideCaspioForm() {
        if (!state.caspioForm) return;
        
        // Hide but keep functional
        state.caspioForm.style.position = 'absolute';
        state.caspioForm.style.left = '-9999px';
        state.caspioForm.style.height = '1px';
        state.caspioForm.style.overflow = 'hidden';
        
        console.log('[Enhanced Gallery V2] Caspio form hidden');
    }
    
    function createEnhancedInterface() {
        // Check if already exists
        if (document.querySelector('.eg-container')) return;
        
        const container = document.createElement('div');
        container.className = 'eg-container';
        container.innerHTML = `
            <div class="eg-search-panel">
                <div class="eg-search-header">
                    <h2>Quick Product Search</h2>
                    <button class="eg-clear-btn" onclick="window.egClearSearch()">Clear All</button>
                </div>
                
                <div class="eg-search-row">
                    <input type="text" 
                           id="egSearchInput" 
                           class="eg-search-input" 
                           placeholder="Enter style number, product name, or brand..."
                           autocomplete="off">
                    <button id="egSearchBtn" class="eg-search-btn">
                        <span>Search</span>
                    </button>
                </div>
                
                <div class="eg-quick-filters">
                    <button class="eg-quick-btn" data-search="PC54">PC54</button>
                    <button class="eg-quick-btn" data-search="G500">G500</button>
                    <button class="eg-quick-btn" data-search="DT6000">DT6000</button>
                    <button class="eg-quick-btn" data-search="ST350">ST350</button>
                    <button class="eg-quick-btn" data-search="Nike">Nike</button>
                    <button class="eg-quick-btn" data-search="Carhartt">Carhartt</button>
                    <button class="eg-quick-btn" data-search="Port Authority">Port Authority</button>
                </div>
                
                <div class="eg-advanced-filters">
                    <select id="egCategory" class="eg-select">
                        <option value="">All Categories</option>
                        <option value="T-Shirts">T-Shirts</option>
                        <option value="Polos/Knits">Polos/Knits</option>
                        <option value="Sweatshirts/Fleece">Sweatshirts/Fleece</option>
                        <option value="Caps">Caps</option>
                        <option value="Outerwear">Outerwear</option>
                        <option value="Bags">Bags</option>
                        <option value="Activewear">Activewear</option>
                        <option value="Ladies">Ladies</option>
                        <option value="Youth">Youth</option>
                    </select>
                    
                    <select id="egBrand" class="eg-select">
                        <option value="">All Brands</option>
                        <option value="Nike">Nike</option>
                        <option value="Carhartt">Carhartt</option>
                        <option value="Port Authority">Port Authority</option>
                        <option value="Sport-Tek">Sport-Tek</option>
                        <option value="District">District</option>
                        <option value="Gildan">Gildan</option>
                        <option value="Bella + Canvas">Bella + Canvas</option>
                    </select>
                    
                    <label class="eg-checkbox">
                        <input type="checkbox" id="egTopSeller">
                        <span>Top Sellers Only</span>
                    </label>
                </div>
            </div>
            
            <div class="eg-results-panel">
                <div class="eg-results-header">
                    <h3>Products</h3>
                    <span id="egResultCount" class="eg-count">0 items</span>
                </div>
                <div id="egResults" class="eg-results-grid">
                    <!-- Results will appear here -->
                </div>
            </div>
        `;
        
        // Insert after Caspio or at beginning of container
        const insertPoint = state.caspioForm?.parentElement || document.querySelector('.main-container') || document.body;
        insertPoint.insertBefore(container, insertPoint.firstChild);
        
        console.log('[Enhanced Gallery V2] Interface created');
    }
    
    function setupSearch() {
        // Search button
        document.getElementById('egSearchBtn')?.addEventListener('click', performSearch);
        
        // Enter key
        document.getElementById('egSearchInput')?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') performSearch();
        });
        
        // Quick search buttons
        document.querySelectorAll('.eg-quick-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.getElementById('egSearchInput').value = btn.dataset.search;
                performSearch();
            });
        });
        
        // Filters
        ['egCategory', 'egBrand', 'egTopSeller'].forEach(id => {
            document.getElementById(id)?.addEventListener('change', performSearch);
        });
        
        // Clear function
        window.egClearSearch = () => {
            document.getElementById('egSearchInput').value = '';
            document.getElementById('egCategory').value = '';
            document.getElementById('egBrand').value = '';
            document.getElementById('egTopSeller').checked = false;
            performSearch();
        };
    }
    
    function performSearch() {
        console.log('[Enhanced Gallery V2] Performing search...');
        
        const searchTerm = document.getElementById('egSearchInput')?.value || '';
        const category = document.getElementById('egCategory')?.value || '';
        const brand = document.getElementById('egBrand')?.value || '';
        const topSeller = document.getElementById('egTopSeller')?.checked;
        
        // Update Caspio form if available
        if (state.caspioForm) {
            // Find form fields
            const inputs = state.caspioForm.querySelectorAll('input, select');
            
            inputs.forEach(input => {
                const name = input.name || '';
                
                // Style/search field
                if (name.includes('Value1') && input.type === 'text') {
                    input.value = searchTerm;
                }
                // Category
                else if (name.includes('Value2') && input.tagName === 'SELECT') {
                    input.value = category;
                }
                // Brand
                else if (name.includes('Value4') && input.tagName === 'SELECT') {
                    input.value = brand;
                }
                // Top seller radio
                else if (name.includes('Value5') && input.type === 'radio') {
                    if ((topSeller && input.value === 'Y') || (!topSeller && input.value === 'A')) {
                        input.checked = true;
                    }
                }
            });
            
            // Submit form
            const searchBtn = state.caspioForm.querySelector('.cbSearchButton, [type="submit"]');
            if (searchBtn) {
                searchBtn.click();
            } else {
                // Try submitting form directly
                state.caspioForm.submit();
            }
        }
        
        // Show loading state
        const resultsDiv = document.getElementById('egResults');
        if (resultsDiv) {
            resultsDiv.innerHTML = '<div class="eg-loading">Searching products...</div>';
        }
    }
    
    function interceptResults() {
        // Watch for Caspio results
        state.observer = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                // Look for result containers
                if (mutation.type === 'childList') {
                    const results = findResults(mutation.target);
                    if (results.length > 0) {
                        processResults(results);
                    }
                }
            }
        });
        
        state.observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['class', 'style']
        });
    }
    
    function findResults(container) {
        // Various selectors for Caspio results
        const selectors = [
            '.cbResultSetListViewTable tr',
            '.cbResultSetListViewTableOddCell',
            '.cbResultSetListViewTableEvenCell',
            '.gallery-item',
            '[class*="cbResultSet"]'
        ];
        
        let results = [];
        for (const selector of selectors) {
            const found = container.querySelectorAll(selector);
            if (found.length > 0) {
                results = Array.from(found);
                break;
            }
        }
        
        return results;
    }
    
    function processResults(caspioResults) {
        console.log(`[Enhanced Gallery V2] Processing ${caspioResults.length} results`);
        
        const products = [];
        
        caspioResults.forEach(row => {
            // Hide original
            row.style.display = 'none';
            
            // Extract product data
            const product = extractProductData(row);
            if (product && product.styleNumber) {
                products.push(product);
            }
        });
        
        // Display in our gallery
        displayProducts(products);
        
        // Update count
        document.getElementById('egResultCount').textContent = `${products.length} items`;
    }
    
    function extractProductData(element) {
        // Try multiple extraction methods
        
        // Method 1: Look for gallery item structure
        const link = element.querySelector('a[href*="StyleNumber="], .gallery-item-link');
        if (link) {
            const href = link.href;
            const styleMatch = href.match(/StyleNumber=([^&]+)/);
            
            return {
                styleNumber: styleMatch ? styleMatch[1] : '',
                title: element.querySelector('.gallery-item-title, [class*="title"]')?.textContent?.trim() || '',
                brand: element.querySelector('.gallery-item-brand, [class*="brand"]')?.textContent?.trim() || '',
                image: element.querySelector('img')?.src || '',
                link: href
            };
        }
        
        // Method 2: Table row structure
        const cells = element.querySelectorAll('td');
        if (cells.length >= 3) {
            const linkCell = Array.from(cells).find(cell => cell.querySelector('a'));
            if (linkCell) {
                const link = linkCell.querySelector('a');
                const styleMatch = link.href.match(/StyleNumber=([^&]+)/);
                
                return {
                    styleNumber: styleMatch ? styleMatch[1] : '',
                    title: link.textContent?.trim() || '',
                    brand: cells[1]?.textContent?.trim() || '',
                    image: element.querySelector('img')?.src || '',
                    link: link.href
                };
            }
        }
        
        return null;
    }
    
    function displayProducts(products) {
        const container = document.getElementById('egResults');
        if (!container) return;
        
        container.innerHTML = products.map(product => `
            <div class="eg-product-card" data-style="${product.styleNumber}">
                <a href="${product.link}" class="eg-product-link">
                    <div class="eg-product-image">
                        <img src="${product.image}" alt="${product.title}" loading="lazy">
                    </div>
                    <div class="eg-product-info">
                        <h4 class="eg-product-title">${product.title}</h4>
                        <p class="eg-product-style">Style: ${product.styleNumber}</p>
                        <p class="eg-product-brand">${product.brand}</p>
                        <div class="eg-product-price" id="price-${product.styleNumber}">
                            <span class="eg-price-loading">Loading price...</span>
                        </div>
                    </div>
                </a>
            </div>
        `).join('');
        
        // Load prices for visible products
        loadVisiblePrices();
    }
    
    function loadVisiblePrices() {
        const priceElements = document.querySelectorAll('.eg-product-price');
        
        priceElements.forEach(element => {
            const card = element.closest('.eg-product-card');
            const styleNumber = card?.dataset.style;
            
            if (styleNumber && !state.loadingPrices.has(styleNumber)) {
                loadPrice(styleNumber, element);
            }
        });
    }
    
    async function loadPrice(styleNumber, element) {
        // Check cache first
        const cached = getCachedPrice(styleNumber);
        if (cached !== null) {
            displayPrice(element, cached);
            return;
        }
        
        // Mark as loading
        state.loadingPrices.add(styleNumber);
        
        try {
            const response = await fetch(`${CONFIG.API_URL}?styleNumber=${styleNumber}`);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            const data = await response.json();
            
            // Calculate price
            let lowestPrice = Infinity;
            if (data.prices && typeof data.prices === 'object') {
                Object.values(data.prices).forEach(price => {
                    if (price > 0 && price < lowestPrice) {
                        lowestPrice = price;
                    }
                });
            }
            
            if (lowestPrice === Infinity) {
                throw new Error('No valid prices found');
            }
            
            // Apply formula: (price / 0.60) + 15
            const finalPrice = (lowestPrice / CONFIG.PRICE_MARKUP) + CONFIG.PRICE_ADDON;
            
            // Cache and display
            setCachedPrice(styleNumber, finalPrice);
            displayPrice(element, finalPrice);
            
        } catch (error) {
            console.error(`[Enhanced Gallery V2] Price error for ${styleNumber}:`, error);
            element.innerHTML = '<span class="eg-price-error">Price unavailable</span>';
        } finally {
            state.loadingPrices.delete(styleNumber);
        }
    }
    
    function displayPrice(element, price) {
        element.innerHTML = `
            <span class="eg-price-label">From</span>
            <span class="eg-price-value">$${price.toFixed(2)}</span>
        `;
    }
    
    function getCachedPrice(styleNumber) {
        try {
            const cached = localStorage.getItem(`egPrice_${styleNumber}`);
            if (!cached) return null;
            
            const { price, timestamp } = JSON.parse(cached);
            
            // Check if still valid
            if (Date.now() - timestamp < CONFIG.CACHE_DURATION) {
                return price;
            }
            
            // Expired
            localStorage.removeItem(`egPrice_${styleNumber}`);
        } catch (e) {
            console.error('[Enhanced Gallery V2] Cache error:', e);
        }
        return null;
    }
    
    function setCachedPrice(styleNumber, price) {
        try {
            localStorage.setItem(`egPrice_${styleNumber}`, JSON.stringify({
                price,
                timestamp: Date.now()
            }));
        } catch (e) {
            console.error('[Enhanced Gallery V2] Cache set error:', e);
        }
    }
    
    // Alternative initialization if Caspio not found
    function alternativeInit() {
        console.log('[Enhanced Gallery V2] Using alternative initialization');
        
        // Create interface anyway
        createEnhancedInterface();
        setupSearch();
        
        // Create a mock search that shows a message
        window.performSearch = () => {
            const resultsDiv = document.getElementById('egResults');
            if (resultsDiv) {
                resultsDiv.innerHTML = `
                    <div class="eg-message">
                        <p>Unable to connect to product database.</p>
                        <p>Please refresh the page or contact support.</p>
                    </div>
                `;
            }
        };
    }
    
    // Expose some functions globally for debugging
    window.egDebug = {
        state,
        clearCache: () => {
            for (let key in localStorage) {
                if (key.startsWith('egPrice_')) {
                    localStorage.removeItem(key);
                }
            }
            console.log('[Enhanced Gallery V2] Cache cleared');
        },
        reloadPrices: loadVisiblePrices
    };
    
})();

console.log('[Enhanced Gallery V2] Script complete');