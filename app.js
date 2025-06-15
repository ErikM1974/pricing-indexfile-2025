/**
 * Northwest Custom Apparel - Homepage Product Catalog
 * 
 * This application integrates with Caspio DataPages to display product catalogs.
 * 
 * CASPIO INTEGRATION NOTES:
 * - Caspio loads via script tags and tries to replace the entire page content
 * - We intercept document.write to capture Caspio's HTML output
 * - MutationObservers watch for when Caspio adds/modifies DOM elements
 * - Products are hidden in a 1px container and extracted to our custom display
 * 
 * API DOCUMENTATION:
 * - Caspio DataPage: Embedded via script tag with URL parameters
 * - Pricing API: GET https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/base-item-costs
 * 
 * REFACTORING NOTES (v2.0):
 * - Consolidated global variables into appState object
 * - Broke down large processResults function into smaller functions
 * - Added comprehensive documentation for Caspio integration
 * - Added DEBUG_MODE flag to control console logging
 * - Improved code organization and maintainability
 * 
 * @author Northwest Custom Apparel
 * @version 2.0
 */

// Configuration
        const API_URL = 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/base-item-costs';
        const CACHE_DURATION = 2 * 60 * 60 * 1000; // 2 hours
        const DEBUG_MODE = false; // Set to true to enable console logging
        
        // Debug logging wrapper
        const debugLog = (...args) => {
            if (DEBUG_MODE) {
                console.log(...args);
            }
        };
        
        /* TOP SELLERS LIST (hardcoded as Caspio IsTopSeller field is not populated)
         * Full list for reference:
         * 18500    Gildan - Heavy Blend Hooded Sweatshirt. 18500
         * 5186     Hanes Beefy-T - 100% Cotton Long Sleeve T-Shirt. 5186
         * 8000     Gildan DryBlend 50 Cotton/50 Poly T-Shirt. 8000
         * 996M     Jerzees NuBlend Pullover Hooded Sweatshirt. 996M
         * C114     Port Authority Digi Camo Snapback Trucker Cap C114
         * C112     Port Authority Snapback Trucker Cap. C112
         * CP90     Port & Company Knit Cap. CP90
         * CSF300   CornerStone A107 Class 3 Heavy-Duty Fleece Full-Zip Hoodie CSF300
         * CTK121   Carhartt Midweight Hooded Sweatshirt. CTK121
         * NKDC1963 Nike Dri-FIT Micro Pique 2.0 Polo NKDC1963
         * CT104670 Carhartt Storm Defender Shoreline Jacket CT104670
         * PC450    Port & Company Fan Favorite Tee. PC450
         * CT105534 Carhartt Super Dux Soft Shell Jacket CT105534
         * CT102286 Carhartt Gilliam Vest CT102286
         * P170     Hanes EcoSmart - Pullover Hooded Sweatshirt. P170
         * CT100617 Carhartt Rain Defender Paxton Heavyweight Hooded Zip Mock Sweatshirt. CT100617
         * CTK87    Carhartt Workwear Pocket Short Sleeve T-Shirt. CTK87
         * CT103828 Carhartt Duck Detroit Jacket CT103828
         * CT104050 Carhartt Washed Duck Active Jac. CT104050
         * PC54LS   Port & Company - Long Sleeve Core Cotton Tee. PC54LS
         * PC54     Port & Company - Core Cotton Tee. PC54
         * PC61LS   Port & Company Long Sleeve Essential Tee. PC61LS
         * PC78H    Port & Company - Core Fleece Pullover Hooded Sweatshirt. PC78H
         * PC61     Port & Company - Essential Tee. PC61
         */

        /* IMPORTANT: Caspio Search Configuration
         * Caspio is configured with this logic structure:
         * OR
         * ├── AND
         * │   ├── CATEGORY_NAME Equal [@CATEGORY]
         * │   └── SUBCATEGORY_NAME Equal [@SUBCATEGORY]
         * ├── STYLE Equal [@STYLE]
         * ├── BRAND_NAME Equal [@BRAND_NAME]
         * └── IsTopSeller Equal [@IsTopSeller]
         * 
         * This allows category+subcategory searches OR style searches OR brand/top seller filters.
         * Note: Brand and TopSeller are OR conditions, not AND filters.
         */

        // Hardcoded category structure from database - ordered for display
        const CATEGORY_DATA = {
            "T-Shirts": ["Ring Spun", "100% Cotton", "6-6.1 100% Cotton", "Long Sleeve", "Fashion", "5-5.6 100% Cotton", "Performance", "Ladies", "Youth", "Tanks", "Specialty", "Tall", "50/50 Blend", "Eco-Friendly", "Workwear", "Juniors & Young Men"],
            "Polos/Knits": ["Ladies", "Performance", "Easy Care", "Fashion", "Tall", "Cotton", "Youth", "Workwear", "Sweaters", "Mock & Turtlenecks", "Silk Touch™", "Basic Knits"],
            "Sweatshirts/Fleece": ["Ladies", "Performance", "Crewnecks", "Hoodie", "Youth", "Fleece", "Heavyweight", "1/2 & 1/4 Zip", "Full Zip", "Tall", "Sweatpants", "Juniors & Young Men"],
            "Caps": ["Performance/ Athletic", "Visors", "Stretch-to-Fit", "Youth", "Fashion", "Fleece/Beanies", "Twill", "Full Brim", "Pigment/Garment Dyed", "Flexfit", "Mesh Back", "Camouflage", "Safety", "Recycled", "Scarves/Gloves", "Canvas", "Racing", "Fitted"],
            "Activewear": ["Ladies", "Youth", "Performance", "Basketball", "Pants & Shorts", "Jerseys", "Tanks", "Athletic/Warm-Ups", "Baseball"],
            "Outerwear": ["Ladies", "Athletic/Warm-Ups", "Corporate Jackets", "Tall", "Insulated Jackets", "Youth", "Polyester Fleece", "Golf Outerwear", "Rainwear", "Work Jackets", "Soft Shells", "Vests", "3-in-1", "Parkas/ Shells/ Systems", "Camouflage"],
            "Bags": ["Golf Bags", "Travel Bags", "Rolling Bags", "Backpacks", "Totes", "Briefcases/ Messengers", "Specialty Bags", "Coolers & Lunch Bags", "Duffels", "Cinch Packs", "Grocery Totes", "Eco-Friendly"],
            "Accessories": ["Other", "Aprons", "Blankets", "Scarves/Gloves", "Robes/Towels", "Golf Towels"],
            "Workwear": ["Medical/Scrubs", "Stain/Soil Resistant", "Aprons", "T-Shirts", "Industrial Work Shirts", "Polos", "Safety", "Industrial Work Pants/Shorts", "Work Jackets"],
            "Woven Shirts": ["Ladies", "Premium Wovens", "Workwear", "Denim", "Cotton", "Easy Care", "Cotton/Poly Blend", "Oxfords", "Camp Shirts", "100% Cotton", "Fishing", "Tall"],
            "Ladies": ["Polos/Knits", "Outerwear", "Activewear", "Fashion", "T-Shirts", "Sweatshirts/Fleece", "Bottoms", "Woven Shirts", "Dresses", "Caps"],
            "Youth": ["Sweatshirts/Fleece", "T-Shirts", "Bottoms", "Activewear", "Outerwear", "Caps", "Polos/Knits"],
            "Infant & Toddler": ["Tops & Bottoms", "Accessories & Caps"],
            "Tall": ["Sweatshirts/Fleece", "Outerwear", "Woven Shirts", "Polos/Knits", "T-Shirts"],
            "Juniors & Young Men": ["T-Shirts", "Pants & Shorts", "Lounge", "Sweatshirts", "Caps"],
            "Personal Protection": ["Medical/Scrubs", "Face Coverings"]
        };

        // Caspio selectors - dynamically find them
        const CASPIO_SELECTORS = {
            styleField: '',
            categoryField: '',
            subcategoryField: '',
            brandField: '',
            searchButton: '',
            topSellerField: ''
        };

        /**
         * Application State Management
         * Consolidates all state variables into a single object for better organization
         */
        const appState = {
            // Search state
            search: {
                isSearching: false,
                isStyleSearch: false,
                currentCategory: '',
                currentSubcategory: '',
                expectedSearchCategory: '',
                expectedSearchSubcategory: '',
                searchRetryCount: 0
            },
            
            // Processing state
            processing: {
                isProcessingResults: false,
                processedStyleNumbers: new Set(),
                lastProcessedCount: 0,
                lastDisplayedProducts: ''
            },
            
            // UI state
            ui: {
                topSellers: [],
                observer: null,
                bodyObserver: null
            }
        };
        
        // Constants
        const MAX_SEARCH_RETRIES = 3;

        /**
         * State helper functions
         */
        const resetSearchState = () => {
            appState.search.isSearching = false;
            appState.search.isStyleSearch = false;
            appState.search.currentCategory = '';
            appState.search.currentSubcategory = '';
            appState.search.searchRetryCount = 0;
            appState.processing.processedStyleNumbers.clear();
            appState.processing.lastProcessedCount = 0;
            appState.processing.lastDisplayedProducts = '';
        };

        const setSearchCategory = (category, subcategory = '') => {
            appState.search.currentCategory = category;
            appState.search.currentSubcategory = subcategory;
            appState.search.expectedSearchCategory = category;
            appState.search.expectedSearchSubcategory = subcategory;
        };

        /**
         * CASPIO INTEGRATION EXPLANATION:
         * 
         * Caspio DataPages are designed to be standalone pages. When embedded,
         * they try to replace the entire page content using document.write.
         * 
         * Our solution:
         * 1. Override document.write to capture Caspio's output
         * 2. Place Caspio content in a hidden container
         * 3. Use MutationObservers to watch for when Caspio adds products
         * 4. Extract product data and display in our custom UI
         * 
         * This allows us to use Caspio's search/filter functionality
         * while maintaining our custom design.
         */
        (function() {
            // Store original document.write
            const originalWrite = document.write;
            const originalWriteln = document.writeln;

            // Override document.write to capture Caspio content
            document.write = function(content) {
                if (content && content.includes('caspio')) {
                    debugLog('[Sales Tool] Intercepted Caspio write');
                    const container = document.getElementById('caspioContainer');
                    if (container) {
                        container.insertAdjacentHTML('beforeend', content);
                    }
                } else {
                    originalWrite.call(document, content);
                }
            };

            document.writeln = function(content) {
                document.write(content + '\n');
            };
        })();

        // Initialize
        document.addEventListener('DOMContentLoaded', function() {
            debugLog('[Sales Tool] Initializing...');

            // Build category menu from hardcoded data
            buildCategoryMenu();
            
            // Build top navigation categories
            buildTopNavCategories();
            enhanceDropdownInteraction();

            // Setup mobile menu
            setupMobileMenu();

            // Setup search - now using advanced autocomplete
            setupAdvancedSearch();

            // Setup category navigation (flyout menus)
            setupCategoryNavigation();

            // Setup result observer
            setupResultObserver();

            // Load Caspio to get all products for top sellers and autocomplete
            // but don't show results section
            loadCaspio();
            
            // Show loading message for top sellers
            updateTopSellersDisplay();
            
            // Also check for results after a delay in case observer misses them
            setTimeout(() => {
                debugLog('[Sales Tool] Checking for results after 5 seconds...');
                const container = document.getElementById('caspioContainer');
                if (container) {
                    const results = container.querySelectorAll('.gallery-item-link, a[href*="StyleNumber="]');
                    debugLog(`[Sales Tool] Manual check found ${results.length} results`);
                    if (results.length > 0) {
                        debugLog('[Sales Tool] Processing results from manual check');
                        processResults(results);
                    }
                }
            }, 5000);
        });

        function buildTopNavCategories() {
            const navCategories = document.getElementById('navCategories');
            if (!navCategories) return;
            
            // Create category grid for dropdown
            let html = '';
            Object.keys(CATEGORY_DATA).forEach(categoryName => {
                html += `
                    <div class="nav-category-item">
                        <h4 class="nav-category-title">${categoryName}</h4>
                        <ul class="nav-subcategory-list">
                            ${CATEGORY_DATA[categoryName].slice(0, 4).map(subcat => 
                                `<li><a href="#" data-category="${categoryName}" data-subcategory="${subcat}" class="nav-subcategory-link">${subcat}</a></li>`
                            ).join('')}
                            ${CATEGORY_DATA[categoryName].length > 4 ? 
                                `<li><a href="#" data-category="${categoryName}" class="nav-view-all">View all ${CATEGORY_DATA[categoryName].length} subcategories</a></li>` : ''}
                        </ul>
                    </div>
                `;
            });
            
            navCategories.innerHTML = html;
            
            // Add click handlers with proper event handling
            navCategories.querySelectorAll('.nav-subcategory-link').forEach(link => {
                link.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    
                    const category = link.dataset.category;
                    const subcategory = link.dataset.subcategory;
                    
                    // Close dropdown smoothly
                    const dropdown = link.closest('.nav-dropdown');
                    const navLink = document.querySelector('.nav-products');
                    if (dropdown && navLink) {
                        navLink.setAttribute('aria-expanded', 'false');
                        dropdown.style.opacity = '0';
                        dropdown.style.visibility = 'hidden';
                        dropdown.style.transform = 'translateY(-10px)';
                        dropdown.style.pointerEvents = 'none';
                    }
                    
                    // Perform search after a short delay to ensure smooth transition
                    setTimeout(() => {
                        performCategorySearch(category, subcategory);
                    }, 300);
                });
            });
            
            navCategories.querySelectorAll('.nav-view-all').forEach(link => {
                link.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    
                    const category = link.dataset.category;
                    
                    // Close dropdown smoothly
                    const dropdown = link.closest('.nav-dropdown');
                    const navLink = document.querySelector('.nav-products');
                    if (dropdown && navLink) {
                        navLink.setAttribute('aria-expanded', 'false');
                        dropdown.style.opacity = '0';
                        dropdown.style.visibility = 'hidden';
                        dropdown.style.transform = 'translateY(-10px)';
                        dropdown.style.pointerEvents = 'none';
                    }
                    
                    // Click the sidebar category after a short delay
                    setTimeout(() => {
                        const sidebarCategory = document.querySelector(`[data-category="${category}"]`);
                        if (sidebarCategory) {
                            sidebarCategory.click();
                        }
                    }, 300);
                });
            });
        }

        function enhanceDropdownInteraction() {
            const productsNavItem = document.querySelector('.nav-products').parentElement;
            const dropdown = productsNavItem.querySelector('.nav-dropdown');
            let closeTimeout;
            let isDropdownOpen = false;

            // Prevent dropdown from closing when hovering between trigger and dropdown
            productsNavItem.addEventListener('mouseenter', () => {
                clearTimeout(closeTimeout);
                dropdown.style.pointerEvents = 'auto';
                isDropdownOpen = true;
            });

            productsNavItem.addEventListener('mouseleave', () => {
                closeTimeout = setTimeout(() => {
                    if (!isDropdownOpen) {
                        dropdown.style.pointerEvents = 'none';
                    }
                }, 200);
            });

            dropdown.addEventListener('mouseenter', () => {
                clearTimeout(closeTimeout);
                isDropdownOpen = true;
            });

            dropdown.addEventListener('mouseleave', () => {
                closeTimeout = setTimeout(() => {
                    dropdown.style.pointerEvents = 'none';
                    isDropdownOpen = false;
                }, 200);
            });

            // Add keyboard navigation support
            const navLink = productsNavItem.querySelector('.nav-link');
            navLink.setAttribute('aria-haspopup', 'true');
            navLink.setAttribute('aria-expanded', 'false');

            navLink.addEventListener('click', (e) => {
                e.preventDefault();
                const isExpanded = navLink.getAttribute('aria-expanded') === 'true';
                navLink.setAttribute('aria-expanded', !isExpanded);
                
                if (!isExpanded) {
                    dropdown.style.opacity = '1';
                    dropdown.style.visibility = 'visible';
                    dropdown.style.transform = 'translateY(0)';
                    dropdown.style.pointerEvents = 'auto';
                } else {
                    dropdown.style.opacity = '0';
                    dropdown.style.visibility = 'hidden';
                    dropdown.style.transform = 'translateY(-10px)';
                    dropdown.style.pointerEvents = 'none';
                }
            });

            // Close dropdown when clicking outside
            document.addEventListener('click', (e) => {
                if (!productsNavItem.contains(e.target)) {
                    navLink.setAttribute('aria-expanded', 'false');
                    dropdown.style.opacity = '0';
                    dropdown.style.visibility = 'hidden';
                    dropdown.style.transform = 'translateY(-10px)';
                    dropdown.style.pointerEvents = 'none';
                }
            });
        }

        function setupAdvancedSearch() {
            // Setup main navigation search with advanced autocomplete
            if (window.AdvancedAutocomplete) {
                const navAutocomplete = new AdvancedAutocomplete(
                    'navSearchInput',
                    'navAutocompleteList',
                    (styleNumber) => {
                        // Clear any category selection
                        document.querySelectorAll('.category-link').forEach(link => {
                            link.classList.remove('active');
                        });
                        appState.search.currentCategory = '';
                        appState.search.currentSubcategory = '';
                        
                        // Perform search
                        performStyleSearch(styleNumber);
                    }
                );
            }
            
            // Setup search button
            const navSearchBtn = document.getElementById('navSearchBtn');
            if (navSearchBtn) {
                navSearchBtn.addEventListener('click', () => {
                    const searchInput = document.getElementById('navSearchInput');
                    if (searchInput && searchInput.value.trim()) {
                        performStyleSearch(searchInput.value.trim());
                    }
                });
            }
            
            // Quick buttons will be populated dynamically with top sellers
        }
        
        function performStyleSearch(styleNumber) {
            debugLog(`[Sales Tool] Style search: ${styleNumber}`);
            
            // Reset state
            appState.search.currentCategory = '';
            appState.search.currentSubcategory = '';
            appState.processing.isProcessingResults = false;
            appState.processing.processedStyleNumbers.clear();
            appState.processing.lastProcessedCount = 0;
            appState.search.isStyleSearch = true; // Set style search flag
            appState.processing.lastDisplayedProducts = ''; // Reset to allow fresh display
            
            // Show results section
            const resultsSection = document.querySelector('.results-section');
            const homepageSections = document.querySelector('.homepage-sections');
            const heroSection = document.querySelector('.hero-section');
            
            if (heroSection) heroSection.classList.add('hidden');
            if (homepageSections) homepageSections.style.display = 'none';
            if (resultsSection) resultsSection.style.display = 'block';
            
            // Clear breadcrumb
            const breadcrumb = document.getElementById('categoryBreadcrumb');
            if (breadcrumb) {
                breadcrumb.textContent = '';
            }
            
            // Update UI
            document.getElementById('resultsGrid').innerHTML = '<div class="loading">Searching...</div>';
            document.getElementById('resultsCount').textContent = 'Searching...';
            
            // Build parameters
            const params = {
                STYLE: styleNumber
            };
            
            // Reload Caspio with parameters
            loadCaspio(params);
        }

        function buildCategoryMenu() {
            const categoryList = document.getElementById('categoryList');

            // Build menu from CATEGORY_DATA
            Object.keys(CATEGORY_DATA).forEach(categoryName => {
                const li = document.createElement('li');
                li.className = 'category-item';

                const link = document.createElement('a');
                link.className = 'category-link';
                link.href = '#';
                link.dataset.category = categoryName;
                link.textContent = categoryName;

                // Add arrow indicator if has subcategories
                if (CATEGORY_DATA[categoryName].length > 0) {
                    link.classList.add('has-subcategories');
                }

                li.appendChild(link);
                categoryList.appendChild(li);
            });
        }

        function loadCaspio(params = {}) {
            debugLog('[Sales Tool] Loading Caspio with params:', JSON.stringify(params));

            // Clear existing Caspio content
            const container = document.getElementById('caspioContainer');
            if (container) {
                container.innerHTML = '';
            }

            // Remove any existing Caspio elements from body
            document.querySelectorAll('[id*="cbOuterAjaxCtnr"], [id*="caspioform"], script[src*="caspio"]').forEach(el => el.remove());

            // Create deploy script with parameters
            let deployScript = `<script type="text/javascript" src="https://c3eku948.caspio.com/dp/a0e15000f1348807501f41ef9d03/emb`;

            // Always include cbResetParam=1 to clear cached parameters
            let paramString = 'cbResetParam=1';

            // Add direct parameter names as shown in Caspio configuration
            const additionalParams = Object.entries(params)
                .filter(([key, value]) => value !== '' && value !== null && value !== undefined)
                .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
                .join('&');

            if (additionalParams) {
                paramString += '&' + additionalParams;
            }

            deployScript += '?' + paramString;

            deployScript += `"><\/script>`;

            debugLog('[Sales Tool] Loading with params:', params);

            // Use a different approach - create a temporary div and use innerHTML
            if (container) {
                // Create a wrapper div
                const wrapper = document.createElement('div');
                wrapper.innerHTML = deployScript;

                // Get the script element
                const script = wrapper.querySelector('script');
                if (script) {
                    // Create a new script element with the same src
                    const newScript = document.createElement('script');
                    newScript.type = 'text/javascript';
                    newScript.src = script.src;
                    newScript.async = true;

                    // Add load event listener
                    newScript.onload = function() {
                        debugLog('[Sales Tool] Caspio script loaded successfully');
                        // Wait a bit for Caspio to initialize
                        setTimeout(() => {
                            // Re-setup observer for new results
                            if (appState.ui.observer) {
                                appState.ui.observer.disconnect();
                            }
                            setupResultObserver();

                            // Also check immediately for any existing results
                            const existingResults = document.querySelectorAll('.gallery-item-link, [data-cb-name="data-row"], a[href*="StyleNumber="]');
                            if (existingResults.length > 0) {
                                console.log(`[Sales Tool] Found ${existingResults.length} existing results immediately after load`);
                                processResults(existingResults);
                            }
                        }, 1000);
                    };

                    newScript.onerror = function() {
                        if (DEBUG_MODE) console.error('[Sales Tool] Failed to load Caspio script');
                    };

                    // Append to container
                    container.appendChild(newScript);
                }
            }

            // Monitor for Caspio elements appearing outside container
            if (!appState.ui.bodyObserver) {
                appState.ui.bodyObserver = new MutationObserver(function(mutations) {
                mutations.forEach(function(mutation) {
                    mutation.addedNodes.forEach(function(node) {
                        if (node.nodeType === 1) {
                            // Check for Caspio elements
                            if ((node.id && (node.id.includes('caspioform') || node.id.includes('cbOuterAjaxCtnr'))) ||
                                (node.className && node.className.includes && node.className.includes('cbFormSection'))) {
                                debugLog('[Sales Tool] Moving Caspio element to container:', node.id || node.className);
                                const container = document.getElementById('caspioContainer');
                                if (container && !container.contains(node)) {
                                    container.appendChild(node);
                                }
                            }

                            // Check for iframes that might contain Caspio
                            if (node.tagName === 'IFRAME' && node.src && node.src.includes('caspio')) {
                                debugLog('[Sales Tool] Found Caspio iframe:', node.src);
                                // Try to access iframe content if same-origin
                                node.onload = function() {
                                    try {
                                        const iframeDoc = node.contentDocument || node.contentWindow.document;
                                        debugLog('[Sales Tool] Iframe loaded, checking for results...');
                                        // Set up observer for iframe content
                                        setupIframeObserver(iframeDoc);
                                    } catch (e) {
                                        debugLog('[Sales Tool] Cannot access iframe content (cross-origin)');
                                    }
                                };
                            }
                        }
                    });
                });
                });

                appState.ui.bodyObserver.observe(document.body, { childList: true, subtree: true });
            }
        }

        function setupIframeObserver(iframeDoc) {
            const iframeObserver = new MutationObserver((mutations) => {
                debugLog('[Sales Tool] Iframe content changed, checking for results...');
                const resultItems = iframeDoc.querySelectorAll('.gallery-item-link, [data-cb-name="data-row"], a[href*="StyleNumber="]');
                if (resultItems.length > 0) {
                    debugLog(`[Sales Tool] Found ${resultItems.length} results in iframe`);
                    processResults(resultItems);
                }
            });

            iframeObserver.observe(iframeDoc.body, {
                childList: true,
                subtree: true
            });
        }

        function setupMobileMenu() {
            const menuBtn = document.getElementById('mobileMenuBtn');
            const sidebar = document.getElementById('sidebar');
            const overlay = document.getElementById('sidebarOverlay');

            menuBtn.addEventListener('click', () => {
                sidebar.classList.toggle('show');
                overlay.classList.toggle('show');
            });

            overlay.addEventListener('click', () => {
                sidebar.classList.remove('show');
                overlay.classList.remove('show');
            });
        }

        function setupCategoryNavigation() {
            // Create flyout menu container
            const flyoutMenu = document.createElement('div');
            flyoutMenu.className = 'category-flyout';
            flyoutMenu.id = 'categoryFlyout';
            document.body.appendChild(flyoutMenu);

            const categoryLinks = document.querySelectorAll('.category-link');
            let hoverTimer = null;
            let activeLink = null;

            categoryLinks.forEach(link => {
                const categoryItem = link.closest('.category-item');
                const categoryName = link.dataset.category;

                // Hover to show flyout menu
                categoryItem.addEventListener('mouseenter', () => {
                    clearTimeout(hoverTimer);
                    
                    const subcategories = CATEGORY_DATA[categoryName];
                    
                    // Update active link
                    if (activeLink) {
                        activeLink.classList.remove('hovering');
                    }
                    activeLink = link;
                    link.classList.add('hovering');
                    
                    if (subcategories && subcategories.length > 0) {
                        // Update flyout content
                        updateFlyoutMenu(categoryName, subcategories);
                        
                        // Position flyout next to the category
                        const rect = categoryItem.getBoundingClientRect();
                        const sidebar = document.querySelector('.sidebar');
                        const sidebarRect = sidebar.getBoundingClientRect();
                        
                        flyoutMenu.style.top = rect.top + 'px';
                        flyoutMenu.style.left = sidebarRect.right + 'px';
                        flyoutMenu.classList.add('show');
                    }
                });

                // Mouse leave - hide flyout after delay
                categoryItem.addEventListener('mouseleave', () => {
                    hoverTimer = setTimeout(() => {
                        flyoutMenu.classList.remove('show');
                        link.classList.remove('hovering');
                        if (activeLink === link) {
                            activeLink = null;
                        }
                    }, 200);
                });

                // Click handler for main category
                link.addEventListener('click', (e) => {
                    e.preventDefault();
                    const category = link.dataset.category;

                    debugLog(`[Sales Tool] Main category clicked: ${category}`);

                    // Remove active states
                    document.querySelectorAll('.category-link').forEach(l => {
                        l.classList.remove('active');
                    });

                    // Set active category
                    link.classList.add('active');
                    appState.search.currentCategory = category;
                    appState.search.currentSubcategory = '';

                    // Hide flyout
                    flyoutMenu.classList.remove('show');

                    // Perform search with category only (no subcategory)
                    performCategorySearch(category, '');
                });
            });
            
            // Handle flyout menu hover
            flyoutMenu.addEventListener('mouseenter', () => {
                clearTimeout(hoverTimer);
            });
            
            flyoutMenu.addEventListener('mouseleave', () => {
                hoverTimer = setTimeout(() => {
                    flyoutMenu.classList.remove('show');
                    if (activeLink) {
                        activeLink.classList.remove('hovering');
                        activeLink = null;
                    }
                }, 200);
            });
        }
        
        function updateFlyoutMenu(category, subcategories) {
            const flyout = document.getElementById('categoryFlyout');
            
            let html = `
                <div class="flyout-header">${category}</div>
                <div class="flyout-content">
            `;
            
            subcategories.forEach(subcat => {
                html += `<a href="#" class="flyout-item" data-category="${category}" data-subcategory="${subcat}">${subcat}</a>`;
            });
            
            html += '</div>';
            flyout.innerHTML = html;
            
            // Add click handlers to subcategory items
            flyout.querySelectorAll('.flyout-item').forEach(item => {
                item.addEventListener('click', function(e) {
                    e.preventDefault();
                    const category = this.dataset.category;
                    const subcategory = this.dataset.subcategory;
                    
                    debugLog(`[Sales Tool] Subcategory clicked: ${subcategory}`);
                    debugLog(`[Sales Tool] Parent category: ${category}`);
                    
                    // Set active states
                    document.querySelectorAll('.category-link').forEach(l => {
                        l.classList.remove('active');
                    });
                    const categoryLink = document.querySelector(`[data-category="${category}"]`);
                    if (categoryLink) {
                        categoryLink.classList.add('active');
                    }
                    
                    appState.search.currentCategory = category;
                    appState.search.currentSubcategory = subcategory;
                    
                    // Hide flyout
                    flyout.classList.remove('show');
                    
                    // Perform search
                    performCategorySearch(category, subcategory);
                });
            });
        }


        function setupBrandDropdown() {
            // Since we're using URL parameters, we'll populate brands from our known list
            const brandSelect = document.getElementById('brandSelect');
            if (!brandSelect) return;

            // Common brands - you can expand this list based on your data
            const commonBrands = [
                'Port Authority',
                'Port & Company',
                'Sport-Tek',
                'District',
                'Gildan',
                'Hanes',
                'Nike',
                'New Era',
                'OGIO',
                'Eddie Bauer',
                'Carhartt',
                'CornerStone'
            ];

            // Clear existing options
            brandSelect.innerHTML = '<option value="">All Brands</option>';

            // Add brands
            commonBrands.sort().forEach(brand => {
                const option = document.createElement('option');
                option.value = brand;
                option.textContent = brand;
                brandSelect.appendChild(option);
            });
        }




        function performCategorySearch(category, subcategory) {
            debugLog(`[Sales Tool] Category search - Category: ${category}, Subcategory: ${subcategory}`);

            // Set current category and subcategory for filtering
            appState.search.currentCategory = category;
            appState.search.currentSubcategory = subcategory || '';

            // Reset processing state
            appState.processing.isProcessingResults = false;
            appState.processing.processedStyleNumbers.clear();
            appState.processing.lastProcessedCount = 0;
            appState.search.isStyleSearch = false; // Clear style search flag when doing category search
            appState.processing.lastDisplayedProducts = ''; // Reset to allow fresh display

            // Update UI
            document.getElementById('resultsGrid').innerHTML = '<div class="loading">Loading products...</div>';
            document.getElementById('resultsCount').textContent = 'Loading...';

            // Show results section
            const resultsSection = document.querySelector('.results-section');
            const homepageSections = document.querySelector('.homepage-sections');
            const heroSection = document.querySelector('.hero-section');
            
            if (heroSection) heroSection.classList.add('hidden');
            if (homepageSections) homepageSections.style.display = 'none';
            if (resultsSection) resultsSection.style.display = 'block';
            
            // Update breadcrumb
            const breadcrumb = document.getElementById('categoryBreadcrumb');
            if (breadcrumb) {
                if (subcategory) {
                    breadcrumb.textContent = `> ${category} > ${subcategory}`;
                } else {
                    breadcrumb.textContent = `> ${category}`;
                }
            }

            // Build parameters
            const params = {};

            // For category searches, always include both category and subcategory
            params.CATEGORY = category;

            if (subcategory) {
                params.SUBCATEGORY = subcategory;
            }

            // Reload Caspio with parameters
            loadCaspio(params);
        }

        /**
         * MUTATION OBSERVER EXPLANATION:
         * 
         * We use MutationObservers to detect when Caspio adds products to the DOM.
         * This is necessary because:
         * 1. Caspio loads asynchronously after page load
         * 2. Caspio updates the DOM when filters/searches are applied
         * 3. We need to extract the data before our custom display
         * 
         * The observer watches for:
         * - New product elements being added
         * - Changes to the Caspio container
         * - "No results" messages
         */
        function setupResultObserver() {
            let debounceTimer = null;
            debugLog('[Sales Tool] Setting up result observer...');

            appState.ui.observer = new MutationObserver((mutations) => {
                // Check if we should skip processing
                if (appState.processing.isProcessingResults) {
                    return;
                }

                // Check if mutations are in our results grid (ignore our own changes)
                const isOurChange = mutations.some(mutation => {
                    const target = mutation.target;
                    return target.id === 'resultsGrid' || 
                           target.closest && target.closest('#resultsGrid') ||
                           target.classList && target.classList.contains('product-card');
                });

                if (isOurChange) {
                    return;
                }

                // Clear any existing timer
                if (debounceTimer) clearTimeout(debounceTimer);

                // Debounce to avoid processing multiple times
                debounceTimer = setTimeout(() => {
                    // Only look in the Caspio container
                    const caspioContainer = document.getElementById('caspioContainer');
                    if (!caspioContainer) {
                        debugLog('[Sales Tool] Caspio container not found');
                        return;
                    }

                    // Check for Caspio results - also look for gallery items
                    const resultItems = caspioContainer.querySelectorAll('[data-cb-name="data-row"], .cbResultSetDataRow, a[href*="StyleNumber="], .gallery-item-link');
                    
                    debugLog(`[Sales Tool] Mutation detected, checking for results...`);
                    debugLog(`[Sales Tool] Found ${resultItems.length} potential result items`);

                    if (resultItems.length > 0 && resultItems.length !== appState.processing.lastProcessedCount) {
                        debugLog(`[Sales Tool] Processing ${resultItems.length} new results`);
                        appState.processing.lastProcessedCount = resultItems.length;
                        processResults(resultItems);

                        // Disconnect observer after processing to prevent loops
                        appState.ui.observer.disconnect();

                        // Reconnect after a delay
                        setTimeout(() => {
                            appState.ui.observer.observe(document.body, {
                                childList: true,
                                subtree: true
                            });
                        }, 2000);
                    } else if (resultItems.length === 0) {
                        // Check for no results message
                        const noResults = caspioContainer.querySelector('.cbResultSetInfoMessage');
                        if (noResults && noResults.textContent.includes('No records')) {
                            debugLog('[Sales Tool] No results found message detected');
                            document.getElementById('resultsGrid').innerHTML = '<div class="loading">No products found</div>';
                            document.getElementById('resultsCount').textContent = '0 items found';
                            appState.processing.lastProcessedCount = 0;
                        } else {
                            debugLog('[Sales Tool] No items found yet, waiting...');
                        }
                    }
                }, 1500); // Wait 1.5 seconds to ensure all results are loaded
            });

            appState.ui.observer.observe(document.body, {
                childList: true,
                subtree: true
            });
        }

        /**
         * Extract product data from a Caspio result item
         * @param {HTMLElement} item - The DOM element containing product data
         * @param {number} index - Index for debugging
         * @returns {Object|null} Product data or null if extraction fails
         */
        function extractProductData(item, index) {
            // Try multiple selectors to find the product link
            let link = item.querySelector('a.gallery-item-link');
            if (!link && item.tagName === 'A' && item.href && item.href.includes('StyleNumber=')) {
                link = item;
            }
            if (!link) return null;

            // Debug first few items
            if (index < 3 && DEBUG_MODE) {
                debugLog(`[Sales Tool] ===== Item ${index} Debug =====`);
                debugLog(`[Sales Tool] Tag name:`, item.tagName);
                debugLog(`[Sales Tool] Item classes:`, item.className);
                debugLog(`[Sales Tool] Link classes:`, link.className);
            }

            // Extract URL and parse parameters
            const url = new URL(link.href);
            const styleNumber = url.searchParams.get('StyleNumber');
            if (!styleNumber) return null;

            // Extract product details
            const img = link.querySelector('img') || item.querySelector('img');
            const titleElement = link.querySelector('.gallery-item-title') || 
                               item.querySelector('.gallery-item-title') ||
                               link.querySelector('[data-cb-name="StyleName"]') ||
                               item.querySelector('[data-cb-name="StyleName"]');

            // Check if it's a top seller
            const linkClasses = link.className || '';
            const itemClasses = item.className || '';
            const isTopSeller = linkClasses.includes('IsTopSeller-Yes') || 
                               itemClasses.includes('IsTopSeller-Yes');

            return {
                styleNumber,
                title: titleElement ? titleElement.textContent.trim() : styleNumber,
                image: img ? img.src : '/placeholder.jpg',
                url: link.href,
                isTopSeller
            };
        }

        /**
         * Display "no results" message
         */
        function displayNoResults() {
            document.getElementById('resultsGrid').innerHTML = '<div class="loading">No products found</div>';
            document.getElementById('resultsCount').textContent = '0 items found';
            appState.processing.lastProcessedCount = 0;
        }

        /**
         * Main function to process Caspio results
         * Extracts product data and updates the display
         */
        function processResults(resultItems) {
            // Prevent multiple simultaneous processing
            if (appState.processing.isProcessingResults) {
                debugLog('[Sales Tool] Already processing results, skipping...');
                return;
            }

            appState.processing.isProcessingResults = true;
            debugLog(`[Sales Tool] Processing ${resultItems.length} result items...`);
            debugLog(`[Sales Tool] Current category: "${appState.search.currentCategory}", subcategory: "${appState.search.currentSubcategory}"`);

            const products = [];
            const styleNumbers = [];
            const currentProcessedStyles = new Set();

            // Process each result item
            resultItems.forEach((item, index) => {
                // Hide original Caspio element
                item.style.display = 'none';

                // Extract product data
                const productData = extractProductData(item, index);
                if (!productData) return;

                // Skip if we've already processed this style in this batch
                if (currentProcessedStyles.has(productData.styleNumber)) {
                    debugLog(`[Sales Tool] Skipping duplicate style: ${productData.styleNumber}`);
                    return;
                }

                currentProcessedStyles.add(productData.styleNumber);

                // Debug top seller detection
                if (productData.isTopSeller) {
                    debugLog(`[Sales Tool] *** FOUND TOP SELLER: ${productData.styleNumber} - ${productData.title}`);
                }

                products.push(productData);
                styleNumbers.push(productData.styleNumber);
            });

            debugLog(`[Sales Tool] Found ${products.length} unique products`);
            
            // Cache all products for autocomplete (only on initial load, not style searches)
            if (!appState.search.currentCategory && !appState.search.currentSubcategory && !appState.search.isStyleSearch) {
                window.allProductsCache = products;
                debugLog(`[Sales Tool] Cached ${products.length} products for autocomplete`);
            }

            // Collect top sellers if this is the initial load (not a style search)
            if (!appState.search.currentCategory && !appState.search.currentSubcategory && !appState.search.isStyleSearch) {
                console.log(`[Sales Tool] Initial load detected - looking for top sellers`);
                const allTopSellers = products.filter(p => p.isTopSeller);
                console.log(`[Sales Tool] Total products: ${products.length}`);
                console.log(`[Sales Tool] Products with isTopSeller=true: ${allTopSellers.length}`);
                
                if (allTopSellers.length > 0) {
                    appState.ui.topSellers = allTopSellers.slice(0, 6);
                    console.log(`[Sales Tool] Top sellers to display:`, appState.ui.topSellers);
                } else {
                    console.log(`[Sales Tool] No top sellers found in initial load`);
                }
                updateTopSellersDisplay();
            } else {
                console.log(`[Sales Tool] Not initial load - category: ${appState.search.currentCategory}, subcategory: ${appState.search.currentSubcategory}, isStyleSearch: ${appState.search.isStyleSearch}`);
            }

            // Update autocomplete cache
            if (window.updateStyleCache) {
                window.updateStyleCache(styleNumbers);
            }

            // Show results if a category is selected OR if this is a style search
            if (appState.search.currentCategory || appState.search.currentSubcategory || appState.search.isStyleSearch) {
                // Create a simple string representation of products for comparison
                const productsKey = products.map(p => p.styleNumber).join(',');
                
                // Only update display if products have changed
                if (productsKey !== appState.processing.lastDisplayedProducts) {
                    // Show/hide sections based on whether we're viewing products
                    const heroSection = document.querySelector('.hero-section');
                    const resultsSection = document.querySelector('.results-section');
                    const homepageSections = document.querySelector('.homepage-sections');
                    
                    // Show results, hide homepage content
                    if (heroSection) heroSection.classList.add('hidden');
                    if (homepageSections) homepageSections.style.display = 'none';
                    if (resultsSection) resultsSection.style.display = 'block';
                    
                    // Clear and display products
                    displayProducts(products);
                    document.getElementById('resultsCount').textContent = `${products.length} items found`;
                    
                    // Update last displayed products
                    appState.processing.lastDisplayedProducts = productsKey;
                }
            }
            // If no category selected, this is just the initial load for caching/top sellers
            // Don't show any products, keep homepage visible

            // Reset processing flag after a delay
            setTimeout(() => {
                appState.processing.isProcessingResults = false;
                // Don't reset isStyleSearch here - it should only be reset when starting a new search
            }, 500);
        }

        function displayProducts(products) {
            const grid = document.getElementById('resultsGrid');
            const heroSection = document.querySelector('.hero-section');

            if (products.length === 0) {
                grid.innerHTML = '<div class="loading" data-empty="true">No products found</div>';
                // Show hero section when no products
                if (heroSection) {
                    heroSection.classList.remove('hidden');
                }
                return;
            }

            grid.innerHTML = products.map(product => `
                <div class="product-card ${product.isTopSeller ? 'top-seller' : ''}">
                    <a href="${product.url}" class="product-link">
                        <div class="product-image">
                            ${product.isTopSeller ? '<div class="top-seller-indicator">🔥 TOP SELLER</div>' : ''}
                            <img src="${product.image}" alt="${product.title}">
                        </div>
                        <div class="product-info">
                            <div class="product-style">${product.styleNumber}</div>
                            <div class="product-title">${product.title}</div>
                            <div class="product-price" data-style="${product.styleNumber}">
                                Loading...
                            </div>
                        </div>
                    </a>
                </div>
            `).join('');

            // Load prices
            loadPrices();
        }

        function loadPrices() {
            document.querySelectorAll('.product-price[data-style]').forEach(element => {
                const styleNumber = element.dataset.style;
                loadPrice(styleNumber, element);
            });
        }

        async function loadPrice(styleNumber, element) {
            // Check cache
            const cached = getCachedPrice(styleNumber);
            if (cached !== null) {
                element.textContent = `$${cached.toFixed(2)}+`;
                return;
            }

            try {
                const response = await fetch(`${API_URL}?styleNumber=${styleNumber}`);
                if (!response.ok) throw new Error('API error');

                const data = await response.json();

                // Find lowest price
                let lowestPrice = Infinity;

                // The API returns prices per size, so we need to find the lowest
                if (data.prices && typeof data.prices === 'object') {
                    const allPrices = Object.values(data.prices);
                    if (allPrices.length > 0) {
                        // Filter out any non-numeric values and find the minimum
                        const validPrices = allPrices.filter(price => typeof price === 'number' && price > 0);
                        if (validPrices.length > 0) {
                            lowestPrice = Math.min(...validPrices);
                        }
                    }
                }

                if (lowestPrice === Infinity || lowestPrice <= 0) {
                    // No price found - this is expected for some products
                    element.textContent = 'QUOTE';
                    return;
                }

                // Apply formula: (price / 0.60) + 15
                const finalPrice = (lowestPrice / 0.60) + 15.00;

                // Cache and display
                setCachedPrice(styleNumber, finalPrice);
                element.textContent = `$${finalPrice.toFixed(2)}+`;

            } catch (error) {
                // API error or no pricing - show QUOTE
                element.textContent = 'QUOTE';
            }
        }


        function setupBodyObserver() {
            appState.ui.bodyObserver = new MutationObserver(function(mutations) {
                mutations.forEach(function(mutation) {
                    mutation.addedNodes.forEach(function(node) {
                        if (node.nodeType === 1) {
                            if ((node.id && (node.id.includes('caspioform') || node.id.includes('cbOuterAjaxCtnr'))) ||
                                (node.className && node.className.includes && node.className.includes('cbFormSection'))) {
                                debugLog('[Sales Tool] Moving Caspio element to container:', node.id || node.className);
                                const container = document.getElementById('caspioContainer');
                                if (container && !container.contains(node)) {
                                    container.appendChild(node);
                                }
                            }

                            if (node.tagName === 'IFRAME' && node.src && node.src.includes('caspio')) {
                                debugLog('[Sales Tool] Found Caspio iframe:', node.src);
                                node.onload = function() {
                                    try {
                                        const iframeDoc = node.contentDocument || node.contentWindow.document;
                                        debugLog('[Sales Tool] Iframe loaded, checking for results...');
                                        setupIframeObserver(iframeDoc);
                                    } catch (e) {
                                        debugLog('[Sales Tool] Cannot access iframe content (cross-origin)');
                                    }
                                };
                            }
                        }
                    });
                });
            });

            appState.ui.bodyObserver.observe(document.body, { childList: true, subtree: true });
        }

        function updateTopSellersDisplay() {
            const quickButtons = document.querySelector('.quick-buttons');
            if (!quickButtons) return;
            
            // Clear existing content
            quickButtons.innerHTML = '';
            
            if (appState.ui.topSellers.length === 0) {
                // No top sellers found - show hardcoded popular products
                console.log('[Sales Tool] No top sellers found - showing popular products');
                
                // Hardcoded top sellers from actual sales data
                const popularProducts = [
                    { style: 'PC54', title: 'Port & Company - Core Cotton Tee' },
                    { style: 'PC450', title: 'Port & Company Fan Favorite Tee' },
                    { style: 'C112', title: 'Port Authority Snapback Trucker Cap' },
                    { style: 'CP90', title: 'Port & Company Knit Cap' },
                    { style: 'PC90H', title: 'Port & Company Essential Fleece Pullover Hooded Sweatshirt' },
                    { style: 'PC78H', title: 'Port & Company - Core Fleece Pullover Hooded Sweatshirt' }
                ];
                
                popularProducts.forEach(product => {
                    const button = document.createElement('button');
                    button.className = 'quick-btn top-seller-btn';
                    button.dataset.style = product.style;
                    button.innerHTML = `
                        <span class="btn-style">${product.style}</span>
                        <span class="btn-title">${product.title}</span>
                    `;
                    button.addEventListener('click', function() {
                        performStyleSearch(product.style);
                    });
                    quickButtons.appendChild(button);
                });
            } else {
                // Add top seller buttons
                console.log(`[Sales Tool] Displaying ${appState.ui.topSellers.length} top sellers`);
                appState.ui.topSellers.forEach(product => {
                    const button = document.createElement('button');
                    button.className = 'quick-btn top-seller-btn';
                    // Note: Using product.style or product.styleNumber depending on what's available
                    const styleNum = product.styleNumber || product.style;
                    button.dataset.style = styleNum;
                    button.innerHTML = `
                        <span class="btn-style">${styleNum}</span>
                        <span class="btn-title">${product.title || 'Top Seller'}</span>
                    `;
                    button.addEventListener('click', function() {
                        performStyleSearch(styleNum);
                    });
                    quickButtons.appendChild(button);
                });
            }
        }

        function getCachedPrice(styleNumber) {
            try {
                const cached = localStorage.getItem(`price_${styleNumber}`);
                if (!cached) return null;

                const { price, timestamp } = JSON.parse(cached);
                if (Date.now() - timestamp < CACHE_DURATION) {
                    return price;
                }

                localStorage.removeItem(`price_${styleNumber}`);
            } catch (e) {
                if (DEBUG_MODE) console.error('[Sales Tool] Cache error:', e);
            }
            return null;
        }

        function setCachedPrice(styleNumber, price) {
            try {
                localStorage.setItem(`price_${styleNumber}`, JSON.stringify({
                    price,
                    timestamp: Date.now()
                }));
            } catch (e) {
                if (DEBUG_MODE) console.error('[Sales Tool] Cache set error:', e);
            }
        }