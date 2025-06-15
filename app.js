// Configuration
        const API_URL = 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/base-item-costs';
        const CACHE_DURATION = 2 * 60 * 60 * 1000; // 2 hours

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

        // State
        let isSearching = false;
        let observer = null;
        let bodyObserver = null;
        let currentCategory = '';
        let currentSubcategory = '';
        let expectedSearchCategory = '';
        let expectedSearchSubcategory = '';
        let searchRetryCount = 0;
        const MAX_SEARCH_RETRIES = 3;
        let isProcessingResults = false;
        let processedStyleNumbers = new Set();
        let lastProcessedCount = 0;
        let topSellers = []; // Store top seller products

        // Prevent Caspio from overriding our page
        (function() {
            // Store original document.write
            const originalWrite = document.write;
            const originalWriteln = document.writeln;

            // Override document.write to capture Caspio content
            document.write = function(content) {
                if (content && content.includes('caspio')) {
                    console.log('[Sales Tool] Intercepted Caspio write');
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
            console.log('[Sales Tool] Initializing...');

            // Build category menu from hardcoded data
            buildCategoryMenu();
            
            // Build top navigation categories
            buildTopNavCategories();

            // Setup mobile menu
            setupMobileMenu();

            // Setup search - now using advanced autocomplete
            setupAdvancedSearch();

            // Setup category navigation (mega menus)
            setupCategoryNavigation();

            // Setup result observer
            setupResultObserver();

            // Load Caspio dynamically
            loadCaspio();
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
                            ${CATEGORY_DATA[categoryName].slice(0, 5).map(subcat => 
                                `<li><a href="#" data-category="${categoryName}" data-subcategory="${subcat}" class="nav-subcategory-link">${subcat}</a></li>`
                            ).join('')}
                            ${CATEGORY_DATA[categoryName].length > 5 ? 
                                `<li><a href="#" data-category="${categoryName}" class="nav-view-all">View all ${CATEGORY_DATA[categoryName].length} subcategories →</a></li>` : ''}
                        </ul>
                    </div>
                `;
            });
            
            navCategories.innerHTML = html;
            
            // Add click handlers
            navCategories.querySelectorAll('.nav-subcategory-link').forEach(link => {
                link.addEventListener('click', (e) => {
                    e.preventDefault();
                    const category = link.dataset.category;
                    const subcategory = link.dataset.subcategory;
                    performCategorySearch(category, subcategory);
                });
            });
            
            navCategories.querySelectorAll('.nav-view-all').forEach(link => {
                link.addEventListener('click', (e) => {
                    e.preventDefault();
                    const category = link.dataset.category;
                    // Click the sidebar category to show all subcategories
                    document.querySelector(`[data-category="${category}"]`).click();
                });
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
                        currentCategory = '';
                        currentSubcategory = '';
                        
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
            
            // Setup quick buttons
            document.querySelectorAll('.quick-btn').forEach(btn => {
                btn.addEventListener('click', function() {
                    const style = this.dataset.style.split(' ')[0]; // Get just the style number
                    performStyleSearch(style);
                });
            });
        }
        
        function performStyleSearch(styleNumber) {
            console.log(`[Sales Tool] Style search: ${styleNumber}`);
            
            // Reset processing state
            isProcessingResults = false;
            processedStyleNumbers.clear();
            lastProcessedCount = 0;
            
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
            console.log('[Sales Tool] Loading Caspio...', params);

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

            console.log('[Sales Tool] Loading with params:', params);

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
                        console.log('[Sales Tool] Caspio script loaded successfully');
                        // Wait a bit for Caspio to initialize
                        setTimeout(() => {
                            // Re-setup observer for new results
                            if (observer) {
                                observer.disconnect();
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
                        console.error('[Sales Tool] Failed to load Caspio script');
                    };

                    // Append to container
                    container.appendChild(newScript);
                }
            }

            // Monitor for Caspio elements appearing outside container
            if (!bodyObserver) {
                bodyObserver = new MutationObserver(function(mutations) {
                mutations.forEach(function(mutation) {
                    mutation.addedNodes.forEach(function(node) {
                        if (node.nodeType === 1) {
                            // Check for Caspio elements
                            if ((node.id && (node.id.includes('caspioform') || node.id.includes('cbOuterAjaxCtnr'))) ||
                                (node.className && node.className.includes && node.className.includes('cbFormSection'))) {
                                console.log('[Sales Tool] Moving Caspio element to container:', node.id || node.className);
                                const container = document.getElementById('caspioContainer');
                                if (container && !container.contains(node)) {
                                    container.appendChild(node);
                                }
                            }

                            // Check for iframes that might contain Caspio
                            if (node.tagName === 'IFRAME' && node.src && node.src.includes('caspio')) {
                                console.log('[Sales Tool] Found Caspio iframe:', node.src);
                                // Try to access iframe content if same-origin
                                node.onload = function() {
                                    try {
                                        const iframeDoc = node.contentDocument || node.contentWindow.document;
                                        console.log('[Sales Tool] Iframe loaded, checking for results...');
                                        // Set up observer for iframe content
                                        setupIframeObserver(iframeDoc);
                                    } catch (e) {
                                        console.log('[Sales Tool] Cannot access iframe content (cross-origin)');
                                    }
                                };
                            }
                        }
                    });
                });
                });

                bodyObserver.observe(document.body, { childList: true, subtree: true });
            }
        }

        function setupIframeObserver(iframeDoc) {
            const iframeObserver = new MutationObserver((mutations) => {
                console.log('[Sales Tool] Iframe content changed, checking for results...');
                const resultItems = iframeDoc.querySelectorAll('.gallery-item-link, [data-cb-name="data-row"], a[href*="StyleNumber="]');
                if (resultItems.length > 0) {
                    console.log(`[Sales Tool] Found ${resultItems.length} results in iframe`);
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
            const categoryLinks = document.querySelectorAll('.category-link');
            let currentMegaMenu = null;
            let hoverTimer = null;

            categoryLinks.forEach(link => {
                const categoryItem = link.closest('.category-item');
                const categoryName = link.dataset.category;
                let megaMenu = null;

                // Create mega menu for this category
                function createMegaMenu() {
                    const menu = document.createElement('div');
                    menu.className = 'mega-menu';

                    const subcategories = CATEGORY_DATA[categoryName] || [];

                    menu.innerHTML = `
                        <div class="mega-menu-header">${categoryName} Categories</div>
                        <div class="mega-menu-grid">
                            ${subcategories.length > 0 ? 
                                subcategories.map(subcat => `
                                    <a class="mega-menu-item" href="#" data-category="${categoryName}" data-subcategory="${subcat}">
                                        ${subcat}
                                    </a>
                                `).join('') 
                                : '<div style="padding: 1rem; color: #666;">No subcategories available</div>'
                            }
                        </div>
                    `;
                    document.body.appendChild(menu);

                    // Add click handlers to subcategory links
                    menu.querySelectorAll('.mega-menu-item').forEach(item => {
                        item.addEventListener('click', (e) => {
                            e.preventDefault();
                            e.stopPropagation();

                            const subcategory = item.dataset.subcategory;
                            const category = item.dataset.category;
                            console.log(`[Sales Tool] Subcategory clicked: ${subcategory}`);
                            console.log(`[Sales Tool] Parent category: ${category}`);

                            // Set active states
                            document.querySelectorAll('.category-link').forEach(l => {
                                l.classList.remove('active');
                            });
                            link.classList.add('active');

                            currentCategory = categoryName;
                            currentSubcategory = subcategory;

                            // Hide all mega menus
                            document.querySelectorAll('.mega-menu').forEach(m => {
                                m.classList.remove('show');
                            });

                            // Perform search
                            console.log(`[Sales Tool] About to call performCategorySearch with: ${categoryName}, ${subcategory}`);
                            performCategorySearch(categoryName, subcategory);
                        });
                    });

                    // Add hover listeners to mega menu itself
                    menu.addEventListener('mouseenter', () => {
                        clearTimeout(hoverTimer);
                    });

                    menu.addEventListener('mouseleave', () => {
                        hoverTimer = setTimeout(() => {
                            menu.classList.remove('show');
                            if (currentMegaMenu === menu) {
                                currentMegaMenu = null;
                            }
                        }, 300);
                    });

                    return menu;
                }

                // Position mega menu
                function positionMegaMenu() {
                    if (!megaMenu) return;

                    const rect = categoryItem.getBoundingClientRect();
                    const sidebarRect = document.querySelector('.sidebar').getBoundingClientRect();

                    megaMenu.style.left = (sidebarRect.right + 10) + 'px';
                    megaMenu.style.top = rect.top + 'px';
                }

                // Mouse enter - show mega menu
                categoryItem.addEventListener('mouseenter', () => {
                    clearTimeout(hoverTimer);

                    // Hide any other open mega menu
                    if (currentMegaMenu && currentMegaMenu !== megaMenu) {
                        currentMegaMenu.classList.remove('show');
                    }

                    if (!megaMenu) {
                        megaMenu = createMegaMenu();
                    }

                    positionMegaMenu();

                    // Show with animation
                    setTimeout(() => {
                        megaMenu.classList.add('show');
                        currentMegaMenu = megaMenu;
                    }, 10);
                });

                // Mouse leave - hide mega menu after delay
                categoryItem.addEventListener('mouseleave', () => {
                    hoverTimer = setTimeout(() => {
                        if (megaMenu) {
                            megaMenu.classList.remove('show');
                            if (currentMegaMenu === megaMenu) {
                                currentMegaMenu = null;
                            }
                        }
                    }, 300);
                });

                // Click handler for main category
                link.addEventListener('click', (e) => {
                    e.preventDefault();
                    const category = link.dataset.category;

                    console.log(`[Sales Tool] Main category clicked: ${category}`);

                    // Remove active states
                    document.querySelectorAll('.category-link').forEach(l => {
                        l.classList.remove('active');
                    });

                    // Set active category
                    link.classList.add('active');
                    currentCategory = category;
                    currentSubcategory = '';

                    // Hide all mega menus
                    document.querySelectorAll('.mega-menu').forEach(menu => {
                        menu.classList.remove('show');
                    });

                    // Perform search with category only (no subcategory)
                    performCategorySearch(category, '');
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
            console.log(`[Sales Tool] Category search - Category: ${category}, Subcategory: ${subcategory}`);

            // Reset processing state
            isProcessingResults = false;
            processedStyleNumbers.clear();
            lastProcessedCount = 0;

            // Update UI
            document.getElementById('resultsGrid').innerHTML = '<div class="loading">Loading products...</div>';
            document.getElementById('resultsCount').textContent = 'Loading...';

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

        function setupResultObserver() {
            let debounceTimer = null;
            console.log('[Sales Tool] Setting up result observer...');

            observer = new MutationObserver((mutations) => {
                // Check if we should skip processing
                if (isProcessingResults) {
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
                    if (!caspioContainer) return;

                    // Check for Caspio results
                    const resultItems = caspioContainer.querySelectorAll('[data-cb-name="data-row"], .cbResultSetDataRow, a[href*="StyleNumber="]');

                    if (resultItems.length > 0 && resultItems.length !== lastProcessedCount) {
                        console.log(`[Sales Tool] Found ${resultItems.length} new results`);
                        lastProcessedCount = resultItems.length;
                        processResults(resultItems);

                        // Disconnect observer after processing to prevent loops
                        observer.disconnect();

                        // Reconnect after a delay
                        setTimeout(() => {
                            observer.observe(document.body, {
                                childList: true,
                                subtree: true
                            });
                        }, 2000);
                    } else if (resultItems.length === 0) {
                        // Check for no results message
                        const noResults = caspioContainer.querySelector('.cbResultSetInfoMessage');
                        if (noResults && noResults.textContent.includes('No records')) {
                            console.log('[Sales Tool] No results found message detected');
                            document.getElementById('resultsGrid').innerHTML = '<div class="loading">No products found</div>';
                            document.getElementById('resultsCount').textContent = '0 items found';
                            lastProcessedCount = 0;
                        }
                    }
                }, 750); // Wait 0.75 seconds to ensure all results are loaded
            });

            observer.observe(document.body, {
                childList: true,
                subtree: true
            });
        }

        function processResults(resultItems) {
            // Prevent multiple simultaneous processing
            if (isProcessingResults) {
                console.log('[Sales Tool] Already processing results, skipping...');
                return;
            }

            isProcessingResults = true;
            console.log(`[Sales Tool] Processing ${resultItems.length} result items...`);

            const products = [];
            const styleNumbers = [];
            const currentProcessedStyles = new Set();

            resultItems.forEach(item => {
                // Hide original
                item.style.display = 'none';

                // Extract data - try multiple selectors
                let link = item.querySelector('a.gallery-item-link');
                if (!link && item.tagName === 'A' && item.href && item.href.includes('StyleNumber=')) {
                    link = item;
                }
                if (!link) return;

                const styleMatch = link.href.match(/StyleNumber=([^&]+)/);
                const styleNumber = styleMatch ? styleMatch[1] : '';

                // Skip if we've already processed this style in this batch
                if (!styleNumber || currentProcessedStyles.has(styleNumber)) {
                    console.log(`[Sales Tool] Skipping duplicate style: ${styleNumber}`);
                    return;
                }

                currentProcessedStyles.add(styleNumber);

                const product = {
                    url: link.href,
                    styleNumber: styleNumber,
                    title: link.querySelector('.gallery-item-title')?.textContent?.trim() || '',
                    sizes: link.querySelector('.gallery-item-sizes')?.textContent?.replace('Sizes: ', '').trim() || '',
                    brand: link.querySelector('.gallery-item-brand')?.textContent?.trim() || '',
                    image: link.querySelector('.gallery-product-image')?.src || '',
                    isTopSeller: link.classList.contains('IsTopSeller-Yes')
                };

                products.push(product);
                styleNumbers.push(styleNumber);
            });

            console.log(`[Sales Tool] Found ${products.length} unique products`);

            // Update autocomplete cache
            if (window.updateStyleCache) {
                window.updateStyleCache(styleNumbers);
            }

            // Hide hero section when we have results
            const heroSection = document.querySelector('.hero-section');
            if (heroSection && products.length > 0) {
                heroSection.classList.add('hidden');
            }

            // Clear and display products
            displayProducts(products);
            document.getElementById('resultsCount').textContent = `${products.length} items found`;

            // Reset processing flag after a delay
            setTimeout(() => {
                isProcessingResults = false;
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
            bodyObserver = new MutationObserver(function(mutations) {
                mutations.forEach(function(mutation) {
                    mutation.addedNodes.forEach(function(node) {
                        if (node.nodeType === 1) {
                            if ((node.id && (node.id.includes('caspioform') || node.id.includes('cbOuterAjaxCtnr'))) ||
                                (node.className && node.className.includes && node.className.includes('cbFormSection'))) {
                                console.log('[Sales Tool] Moving Caspio element to container:', node.id || node.className);
                                const container = document.getElementById('caspioContainer');
                                if (container && !container.contains(node)) {
                                    container.appendChild(node);
                                }
                            }

                            if (node.tagName === 'IFRAME' && node.src && node.src.includes('caspio')) {
                                console.log('[Sales Tool] Found Caspio iframe:', node.src);
                                node.onload = function() {
                                    try {
                                        const iframeDoc = node.contentDocument || node.contentWindow.document;
                                        console.log('[Sales Tool] Iframe loaded, checking for results...');
                                        setupIframeObserver(iframeDoc);
                                    } catch (e) {
                                        console.log('[Sales Tool] Cannot access iframe content (cross-origin)');
                                    }
                                };
                            }
                        }
                    });
                });
            });

            bodyObserver.observe(document.body, { childList: true, subtree: true });
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
                console.error('[Sales Tool] Cache error:', e);
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
                console.error('[Sales Tool] Cache set error:', e);
            }
        }