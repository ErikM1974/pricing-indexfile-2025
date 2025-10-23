/**
 * Catalog Search Component
 * Modern search implementation with faceted filtering
 * @version 1.0.0
 */

class CatalogSearch {
    constructor() {
        this.searchService = new ProductSearchService();
        this.currentFilters = {
            q: '',
            category: null,
            subcategory: null,
            brand: [],
            color: [],
            size: [],
            minPrice: null,
            maxPrice: null,
            sort: null,
            page: 1
        };
        this.currentResults = null;
        this.isLoading = false;
        this.searchTimeout = null;
        this.compareList = new Set(); // Track products in compare list
        this.maxCompareItems = 4; // Maximum items to compare
        
        this.init();
    }

    init() {
        console.log('[CatalogSearch] Initializing...');

        // Set up event listeners
        this.setupSearchInput();
        this.setupCategoryMenu();
        this.setupSortOptions();

        // Check URL parameters and apply filters if present
        this.checkUrlParameters();

        // Load initial content (only if no URL parameters)
        if (!window.location.search) {
            this.loadTopSellers();
        }

        // Set up infinite scroll
        this.setupInfiniteScroll();
    }

    /**
     * Check URL parameters and apply filters on page load
     */
    checkUrlParameters() {
        const params = new URLSearchParams(window.location.search);

        let hasFilters = false;

        // Check for search query parameter
        if (params.has('q')) {
            this.currentFilters.q = params.get('q');
            const searchInput = document.getElementById('navSearchInput');
            if (searchInput) {
                searchInput.value = this.currentFilters.q;
            }
            hasFilters = true;
        }

        // Check for brand parameter
        if (params.has('brand')) {
            const brandName = params.get('brand');
            this.currentFilters.brand = [brandName];
            console.log('[CatalogSearch] Brand filter from URL:', brandName);
            hasFilters = true;
        }

        // Check for category parameter
        if (params.has('category')) {
            this.currentFilters.category = params.get('category');
            hasFilters = true;
        }

        // Check for subcategory parameter
        if (params.has('subcategory')) {
            this.currentFilters.subcategory = params.get('subcategory');
            hasFilters = true;
        }

        // If any filters were found in URL, trigger search
        if (hasFilters) {
            console.log('[CatalogSearch] Filters found in URL, performing search:', this.currentFilters);
            this.performSearch();
        }
    }

    /**
     * Set up search input with debouncing
     */
    setupSearchInput() {
        const searchInput = document.getElementById('navSearchInput');
        const searchBtn = document.getElementById('navSearchBtn');
        
        if (!searchInput) return;
        
        // Replace autocomplete with new implementation
        // NOTE: Only update filter value, don't trigger automatic search
        // Search only executes when user presses Enter or clicks search button
        // This prevents premature searches while typing (e.g., "pc" instead of "pc90h")
        searchInput.addEventListener('input', (e) => {
            const query = e.target.value.trim();

            // Update the current filter value
            if (query !== this.currentFilters.q) {
                this.currentFilters = {
                    ...this.currentFilters,
                    q: query,
                    category: null,
                    subcategory: null,
                    page: 1
                };
            }

            // Only clear search if input is empty
            if (query.length === 0) {
                this.clearSearch();
            }

            // NOTE: No automatic performSearch() here!
            // Autocomplete dropdown still works (handled by autocomplete-new.js)
            // User must press Enter or click search button to see full results
        });
        
        // Search button
        if (searchBtn) {
            searchBtn.addEventListener('click', () => {
                if (searchInput.value.trim()) {
                    this.performSearch();
                }
            });
        }
        
        // Enter key to search
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && searchInput.value.trim()) {
                e.preventDefault();
                this.performSearch();
            }
        });
    }

    /**
     * Set up category menu handlers
     */
    setupCategoryMenu() {
        // Main category links
        document.querySelectorAll('.category-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const category = link.dataset.category;
                
                // Clear search and set category
                this.currentFilters = {
                    ...this.currentFilters,
                    q: '',
                    category: category,
                    subcategory: null,
                    page: 1
                };
                
                // Update UI
                this.setActiveCategory(link);
                
                // Perform search
                this.performSearch();
            });
        });
        
        // Subcategory links in flyout
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('flyout-item')) {
                e.preventDefault();
                const category = e.target.dataset.category;
                const subcategory = e.target.dataset.subcategory;
                
                this.currentFilters = {
                    ...this.currentFilters,
                    q: '',
                    category: category,
                    subcategory: subcategory,
                    page: 1
                };
                
                this.performSearch();
            }
        });
        
        // Top nav subcategory links
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('nav-subcategory-link')) {
                e.preventDefault();
                const category = e.target.dataset.category;
                const subcategory = e.target.dataset.subcategory;
                
                this.currentFilters = {
                    ...this.currentFilters,
                    q: '',
                    category: category,
                    subcategory: subcategory,
                    page: 1
                };
                
                this.performSearch();
            }
        });
    }

    /**
     * Set up sort options
     */
    setupSortOptions() {
        // We'll add sort dropdown dynamically when showing results
    }

    /**
     * Perform search with current filters
     */
    async performSearch() {
        if (this.isLoading) return;
        
        this.isLoading = true;
        this.showLoadingState();
        
        try {
            let results;
            
            // If we have a search query, use smart search
            if (this.currentFilters.q) {
                console.log('[CatalogSearch] Using smart search for query:', this.currentFilters.q);
                
                // Extract other filters for additional params
                const { q, category, subcategory, ...otherFilters } = this.currentFilters;
                
                // Use the new smart search method
                results = await this.searchService.smartSearch(q, otherFilters);
                
            } else if (this.currentFilters.category) {
                // If we have category/subcategory, use category search
                console.log('[CatalogSearch] Using smart category search');
                
                // Extract other filters
                const { category, subcategory, ...otherFilters } = this.currentFilters;
                
                // Remove empty values from otherFilters
                const additionalFilters = {};
                Object.entries(otherFilters).forEach(([key, value]) => {
                    if (value !== null && value !== undefined && value !== '') {
                        if (!Array.isArray(value) || value.length > 0) {
                            additionalFilters[key] = value;
                        }
                    }
                });
                
                results = await this.searchService.searchByCategory(
                    category,
                    subcategory,
                    additionalFilters
                );
            } else {
                // Regular search (by other filters)
                const params = this.buildSearchParams();
                console.log('[CatalogSearch] Searching with params:', params);
                results = await this.searchService.searchWithFacets(params);
            }
            
            console.log('[CatalogSearch] Search results:', results);
            
            this.currentResults = results;
            
            // Update UI
            this.displayResults(results);
            this.updateFilters(results.facets);
            this.showResultsSection();
            
        } catch (error) {
            console.error('[CatalogSearch] Search error:', error);
            this.showError('Search failed. Please try again.');
        } finally {
            this.isLoading = false;
        }
    }

    /**
     * Build search parameters from current filters
     */
    buildSearchParams() {
        const params = {};
        
        // Add non-empty filters
        Object.entries(this.currentFilters).forEach(([key, value]) => {
            if (value !== null && value !== undefined) {
                if (Array.isArray(value) && value.length > 0) {
                    params[key] = value;
                } else if (!Array.isArray(value) && value !== '') {
                    params[key] = value;
                }
            }
        });
        
        return params;
    }

    /**
     * Display search results
     */
    displayResults(results) {
        const grid = document.getElementById('resultsGrid');
        const countElement = document.getElementById('resultsCount');
        
        if (!results || !results.products || results.products.length === 0) {
            // More helpful no results message based on current filters
            let message = 'Try adjusting your filters or search terms';
            if (this.currentFilters.subcategory) {
                message = `No products found in this subcategory. Showing all ${this.currentFilters.category || 'products'} instead might help.`;
            }
            
            grid.innerHTML = `
                <div class="no-results">
                    <div class="no-results-icon">🔍</div>
                    <h3>No products found</h3>
                    <p>${message}</p>
                    ${this.currentFilters.category ? `
                        <button class="btn-show-all" onclick="catalogSearch.showAllInCategory()">
                            Show all ${this.currentFilters.category}
                        </button>
                    ` : ''}
                </div>
            `;
            countElement.textContent = '0 products';
            return;
        }
        
        // Update count with showing X of Y format
        const totalCount = results.pagination ? results.pagination.total : results.products.length;
        const currentPage = results.pagination ? results.pagination.page : 1;
        const pageSize = results.pagination ? results.pagination.limit : results.products.length;
        const showingCount = Math.min(currentPage * pageSize, totalCount);
        
        if (totalCount > showingCount) {
            countElement.textContent = `Showing ${showingCount} of ${totalCount} products`;
        } else {
            countElement.textContent = `${totalCount} product${totalCount !== 1 ? 's' : ''}`;
        }
        
        // Display smart filter badges if detected
        let smartFilterBadges = '';
        if (results.smartFilters && results.smartFilters.length > 0) {
            const badges = results.smartFilters.map(filter => {
                const icon = filter.type === 'brand' ? '🏷️' : '📂';
                return `
                    <div class="smart-filter-badge" data-filter-type="${filter.type}" data-filter-value="${filter.value}">
                        <span class="badge-icon">${icon}</span>
                        <span class="badge-label">${filter.type}: ${filter.value}</span>
                        <button class="badge-remove" onclick="catalogSearch.removeSmartFilter('${filter.type}', '${filter.value}')" title="Remove filter">×</button>
                    </div>
                `;
            }).join('');

            smartFilterBadges = `
                <div class="smart-filters-notice">
                    <span class="notice-icon">✨</span>
                    <span class="notice-text">Smart filters detected:</span>
                    <div class="smart-filter-badges">
                        ${badges}
                    </div>
                </div>
            `;
        }

        // Check if we used a fallback search (metadata would tell us)
        if (results.metadata && results.metadata.searchStrategy) {
            const strategy = results.metadata.searchStrategy;
            if (strategy === 'subcategory-only' || strategy === 'category-only') {
                const notice = document.createElement('div');
                notice.className = 'search-notice';
                notice.innerHTML = `
                    <span class="notice-icon">ℹ️</span>
                    <span>Showing broader results for better selection</span>
                `;

                // Insert notice before products
                if (this.currentFilters.page === 1) {
                    grid.innerHTML = smartFilterBadges + notice.outerHTML;
                }
            } else if (smartFilterBadges && this.currentFilters.page === 1) {
                grid.innerHTML = smartFilterBadges;
            }
        } else if (smartFilterBadges && this.currentFilters.page === 1) {
            grid.innerHTML = smartFilterBadges;
        }
        
        // Build product cards
        const productsHTML = results.products.map(product => this.buildProductCard(product)).join('');
        
        // Remove any loading indicators
        const loadingIndicator = grid.querySelector('.loading-more-indicator');
        if (loadingIndicator) {
            loadingIndicator.remove();
        }
        
        // Add or replace products based on page
        if (this.currentFilters.page === 1 && !grid.querySelector('.search-notice')) {
            grid.innerHTML = productsHTML;
        } else if (this.currentFilters.page === 1) {
            // Keep notice, replace products
            grid.innerHTML = grid.querySelector('.search-notice').outerHTML + productsHTML;
        } else {
            // Append for pagination
            grid.insertAdjacentHTML('beforeend', productsHTML);
        }

        // Add sort dropdown if not exists
        this.addSortDropdown();

        // Create client-side pagination tracking if API didn't provide it
        // This handles brand filtering where API doesn't return pagination metadata
        if (!results.pagination) {
            // If we got a full page (48 products), assume there might be more
            // If we got fewer than 48, we've reached the end
            const hasMore = results.products.length >= 48;

            this.currentResults.pagination = {
                page: this.currentFilters.page || 1,
                hasMore: hasMore,
                limit: 48,
                clientSide: true // Flag to indicate this is client-side tracking
            };

            console.log('[CatalogSearch] Client-side pagination:', {
                page: this.currentResults.pagination.page,
                productsReturned: results.products.length,
                hasMore: hasMore
            });
        } else if (results.pagination) {
            // Mark server-side pagination
            this.currentResults.pagination.clientSide = false;
        }

        // Add Load More button if there are more products
        this.updateLoadMoreButton(results);
        
        // Set up lazy loading for images
        this.setupLazyLoading();
    }
    
    /**
     * Show all products in current category (remove subcategory filter)
     */
    showAllInCategory() {
        if (this.currentFilters.category) {
            this.currentFilters.subcategory = null;
            this.currentFilters.page = 1;
            this.performSearch();
        }
    }

    /**
     * Build product card HTML
     */
    buildProductCard(product) {
        // Get the best image
        const imageUrl = product.images?.display || 
                        product.images?.main || 
                        product.images?.thumbnail || 
                        '/placeholder.jpg';
        
        // Get color count for display
        const colorCount = product.colors ? product.colors.length : 0;
        
        // Check if product is in compare list
        const isInCompare = this.compareList.has(product.styleNumber);
        
        return `
            <div class="product-card" data-style="${product.styleNumber}">
                <div class="product-image-container">
                    <a href="/product.html?style=${product.styleNumber}" class="product-link">
                        <div class="product-image">
                            ${product.features?.isTopSeller ? '<div class="top-seller-badge">TOP SELLER</div>' : ''}
                            <img src="${imageUrl}" 
                                 alt="${product.productName}" 
                                 loading="lazy"
                                 onerror="this.src='/placeholder.jpg'">
                        </div>
                    </a>
                    <button class="btn-quick-view" onclick="catalogSearch.showQuickView('${product.styleNumber}')" data-style="${product.styleNumber}">
                        <span class="eye-icon">👁</span> Quick View
                    </button>
                </div>
                <div class="product-info">
                    <div class="product-style">${product.styleNumber}</div>
                    <div class="product-title">${product.productName}</div>
                    ${colorCount > 1 ? `
                        <div class="product-colors-count">${colorCount} Colors Available</div>
                    ` : ''}
                    <div class="product-price">${product.displayPrice}</div>
                </div>
                <div class="product-actions">
                    <button class="btn-compare ${isInCompare ? 'active' : ''}" 
                            onclick="catalogSearch.toggleCompare('${product.styleNumber}')"
                            data-style="${product.styleNumber}">
                        <span class="compare-icon">${isInCompare ? '✓' : '⊞'}</span> ${isInCompare ? 'Added' : 'Compare'}
                    </button>
                </div>
            </div>
        `;
    }

    /**
     * Update filter UI with facets
     */
    updateFilters(facets) {
        if (!facets) return;
        
        // Build and display filters
        const filters = this.searchService.buildFilterDisplay(facets);
        this.displayFilters(filters);
    }

    /**
     * Display filter options
     */
    displayFilters(filters) {
        // Add filter counts to categories
        const categoryFilter = filters.find(f => f.type === 'category');
        if (categoryFilter) {
            document.querySelectorAll('.category-link').forEach(link => {
                const category = link.dataset.category;
                const option = categoryFilter.options.find(o => o.value === category);
                if (option) {
                    // Add count badge
                    let badge = link.querySelector('.category-count');
                    if (!badge) {
                        badge = document.createElement('span');
                        badge.className = 'category-count';
                        link.appendChild(badge);
                    }
                    badge.textContent = option.count;
                }
            });
        }

        // Display brand filters
        const brandFilter = filters.find(f => f.type === 'brand');
        if (brandFilter && brandFilter.options.length > 0) {
            this.displayBrandFilters(brandFilter.options);
        }
    }

    /**
     * Display brand filter checkboxes
     */
    displayBrandFilters(brands) {
        const filtersSection = document.getElementById('filtersSection');
        const brandOptions = document.getElementById('brandFilterOptions');
        const clearBtn = document.getElementById('clearFiltersBtn');

        if (!filtersSection || !brandOptions) return;

        // Show filters section
        filtersSection.style.display = 'block';

        // Clear existing options
        brandOptions.innerHTML = '';

        // Limit to top 15 brands by count
        const topBrands = brands.slice(0, 15);

        // Create checkbox for each brand
        topBrands.forEach((brand) => {
            const option = document.createElement('label');
            option.className = 'filter-option';
            option.innerHTML = `
                <input
                    type="checkbox"
                    value="${brand.value}"
                    class="brand-checkbox"
                    ${this.currentFilters.brand && this.currentFilters.brand.includes(brand.value) ? 'checked' : ''}
                >
                <span class="filter-label">${brand.label}</span>
                <span class="filter-count">${brand.count}</span>
            `;
            brandOptions.appendChild(option);
        });

        // Add event listeners to checkboxes
        document.querySelectorAll('.brand-checkbox').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                this.handleBrandFilterChange(e.target.value, e.target.checked);
            });
        });

        // Setup toggle button
        const toggleBtn = document.getElementById('brandFilterToggle');
        if (toggleBtn) {
            toggleBtn.onclick = () => {
                brandOptions.classList.toggle('collapsed');
                toggleBtn.classList.toggle('collapsed');
            };
        }

        // Setup clear filters button
        if (clearBtn) {
            clearBtn.style.display = this.hasActiveFilters() ? 'flex' : 'none';
            clearBtn.onclick = () => this.clearAllFilters();
        }
    }

    /**
     * Handle brand filter checkbox change
     */
    handleBrandFilterChange(brandValue, isChecked) {
        console.log('[CatalogSearch] Brand filter changed:', brandValue, isChecked);

        // Initialize brand filter array if needed
        if (!this.currentFilters.brand) {
            this.currentFilters.brand = [];
        }

        if (isChecked) {
            // Add brand to filters
            if (!this.currentFilters.brand.includes(brandValue)) {
                this.currentFilters.brand.push(brandValue);
            }
        } else {
            // Remove brand from filters
            this.currentFilters.brand = this.currentFilters.brand.filter(b => b !== brandValue);
        }

        // Update clear button visibility
        const clearBtn = document.getElementById('clearFiltersBtn');
        if (clearBtn) {
            clearBtn.style.display = this.hasActiveFilters() ? 'flex' : 'none';
        }

        // Perform search with updated filters
        this.currentFilters.page = 1; // Reset to first page
        this.performSearch();
    }

    /**
     * Check if any filters are active
     */
    hasActiveFilters() {
        return (this.currentFilters.brand && this.currentFilters.brand.length > 0) ||
               (this.currentFilters.color && this.currentFilters.color.length > 0) ||
               (this.currentFilters.size && this.currentFilters.size.length > 0);
    }

    /**
     * Clear all active filters
     */
    clearAllFilters() {
        console.log('[CatalogSearch] Clearing all filters');

        // Reset filter arrays
        this.currentFilters.brand = [];
        this.currentFilters.color = [];
        this.currentFilters.size = [];

        // Uncheck all checkboxes
        document.querySelectorAll('.brand-checkbox').forEach(checkbox => {
            checkbox.checked = false;
        });

        // Hide clear button
        const clearBtn = document.getElementById('clearFiltersBtn');
        if (clearBtn) {
            clearBtn.style.display = 'none';
        }

        // Perform search without filters
        this.currentFilters.page = 1;
        this.performSearch();
    }

    /**
     * Add sort dropdown to results header
     */
    addSortDropdown() {
        const resultsHeader = document.querySelector('.results-header');
        if (!resultsHeader || resultsHeader.querySelector('.sort-dropdown')) return;
        
        const sortHTML = `
            <div class="sort-dropdown">
                <select id="sortSelect" class="sort-select">
                    <option value="">Best Match</option>
                    <option value="name_asc">Name: A to Z</option>
                    <option value="name_desc">Name: Z to A</option>
                    <option value="price_asc">Price: Low to High</option>
                    <option value="price_desc">Price: High to Low</option>
                    <option value="newest">Newest First</option>
                </select>
            </div>
        `;
        
        resultsHeader.insertAdjacentHTML('beforeend', sortHTML);
        
        // Add event listener
        const sortSelect = document.getElementById('sortSelect');
        sortSelect.addEventListener('change', (e) => {
            this.currentFilters.sort = e.target.value || null;
            this.currentFilters.page = 1;
            this.performSearch();
        });
    }

    /**
     * Load top sellers for homepage
     */
    async loadTopSellers() {
        try {
            const topSellers = await this.searchService.getTopSellers(6);
            this.displayTopSellers(topSellers);
        } catch (error) {
            console.error('[CatalogSearch] Error loading top sellers:', error);
        }
    }

    /**
     * Display top sellers
     */
    displayTopSellers(products) {
        const container = document.querySelector('.quick-buttons');
        if (!container) return;
        
        if (products.length === 0) {
            // Show hardcoded popular products as fallback
            const popularHTML = `
                <button class="quick-btn" onclick="catalogSearch.searchByStyle('PC54')">
                    <span class="btn-style">PC54</span>
                    <span class="btn-title">Core Cotton Tee</span>
                </button>
                <button class="quick-btn" onclick="catalogSearch.searchByStyle('PC450')">
                    <span class="btn-style">PC450</span>
                    <span class="btn-title">Fan Favorite Tee</span>
                </button>
                <button class="quick-btn" onclick="catalogSearch.searchByStyle('C112')">
                    <span class="btn-style">C112</span>
                    <span class="btn-title">Snapback Trucker Cap</span>
                </button>
                <button class="quick-btn" onclick="catalogSearch.searchByStyle('CP90')">
                    <span class="btn-style">CP90</span>
                    <span class="btn-title">Knit Cap</span>
                </button>
                <button class="quick-btn" onclick="catalogSearch.searchByStyle('PC90H')">
                    <span class="btn-style">PC90H</span>
                    <span class="btn-title">Essential Fleece Hoodie</span>
                </button>
                <button class="quick-btn" onclick="catalogSearch.searchByStyle('PC78H')">
                    <span class="btn-style">PC78H</span>
                    <span class="btn-title">Core Fleece Hoodie</span>
                </button>
            `;
            container.innerHTML = popularHTML;
        } else {
            const topSellerHTML = products.map(product => `
                <button class="quick-btn" onclick="catalogSearch.searchByStyle('${product.styleNumber}')">
                    <span class="btn-style">${product.styleNumber}</span>
                    <span class="btn-title">${this.truncateTitle(product.productName)}</span>
                </button>
            `).join('');
            
            container.innerHTML = topSellerHTML;
        }
    }

    /**
     * Search by brand name
     */
    async searchByBrand(brandName) {
        console.log('[CatalogSearch] Searching by brand:', brandName);
        
        // Hide homepage sections
        document.querySelector('.hero-section').style.display = 'none';
        document.querySelector('.homepage-sections').style.display = 'none';
        
        // Show results section
        const resultsSection = document.querySelector('.results-section');
        if (resultsSection) {
            resultsSection.style.display = 'block';
        }
        
        // Update title
        const resultsTitle = document.getElementById('resultsTitle');
        if (resultsTitle) {
            resultsTitle.textContent = `${brandName} Products`;
        }
        
        // Clear breadcrumb
        const breadcrumb = document.getElementById('categoryBreadcrumb');
        if (breadcrumb) {
            breadcrumb.textContent = '';
        }
        
        // Set filters and search
        this.currentFilters = {
            q: '',
            category: null,
            subcategory: null,
            brand: [brandName],
            color: [],
            size: [],
            minPrice: null,
            maxPrice: null,
            sort: null,
            page: 1
        };
        
        await this.performSearch();
    }

    /**
     * Search by style number (for quick buttons)
     */
    async searchByStyle(styleNumber) {
        this.currentFilters = {
            ...this.currentFilters,
            q: styleNumber,
            category: null,
            subcategory: null,
            page: 1
        };
        
        await this.performSearch();
    }

    /**
     * Update or create Load More button
     *
     * NOTE: Client-side pagination tracking was added on 2025-01-27 as a defensive fallback
     * when API pagination bugs were causing incomplete results. Server-side pagination bugs
     * were fixed on 2025-10-23, but this fallback remains as a safety mechanism in case
     * API pagination metadata is ever unavailable.
     */
    updateLoadMoreButton(results) {
        // Remove existing button/sentinel if any
        const existingButton = document.getElementById('loadMoreButton');
        const existingSentinel = document.getElementById('scroll-sentinel');

        if (existingButton) existingButton.remove();
        if (existingSentinel) existingSentinel.remove();

        // Check if there are more products to load
        // Handle both server-side pagination (with totalPages) and client-side (without)
        if (results && results.pagination) {
            const { page, totalPages, total, limit, clientSide, hasMore } = results.pagination;

            // Determine if we should show the Load More button
            let shouldShowButton = false;
            let buttonHTML = '';

            if (clientSide) {
                // Client-side pagination (brand filtering without API pagination)
                // Show button if we got a full page (48 products), suggesting more exist
                shouldShowButton = hasMore && results.products.length >= 48;

                if (shouldShowButton) {
                    const showingCount = page * limit;
                    buttonHTML = `
                        <button id="loadMoreButton" class="load-more-btn" onclick="catalogSearch.loadMoreProducts()">
                            Load More Products
                            <span class="load-more-count">(Showing ${showingCount})</span>
                        </button>
                        <div id="scroll-sentinel" style="height: 1px; margin-top: 100px;"></div>
                    `;
                }
            } else {
                // Server-side pagination (normal search with API pagination metadata)
                shouldShowButton = totalPages && page < totalPages;

                if (shouldShowButton) {
                    const showingCount = Math.min(page * limit, total);
                    buttonHTML = `
                        <button id="loadMoreButton" class="load-more-btn" onclick="catalogSearch.loadMoreProducts()">
                            Load More Products
                            <span class="load-more-count">(Showing ${showingCount} of ${total})</span>
                        </button>
                        <div id="scroll-sentinel" style="height: 1px; margin-top: 100px;"></div>
                    `;
                }
            }

            if (shouldShowButton) {
                // Create Load More button container
                const buttonContainer = document.createElement('div');
                buttonContainer.className = 'load-more-container';
                buttonContainer.id = 'loadMoreContainer';
                buttonContainer.innerHTML = buttonHTML;
                
                // Add after results grid
                const resultsGrid = document.getElementById('resultsGrid');
                if (resultsGrid && resultsGrid.parentElement) {
                    resultsGrid.parentElement.appendChild(buttonContainer);
                    
                    // Re-setup infinite scroll observer for the new sentinel
                    this.setupInfiniteScrollObserver();
                }
            }
        }
    }
    
    /**
     * Setup infinite scroll for pagination
     */
    setupInfiniteScroll() {
        // Initial setup is done in updateLoadMoreButton
        // This method is called once during initialization
    }
    
    /**
     * Setup infinite scroll observer for the sentinel element
     */
    setupInfiniteScrollObserver() {
        const sentinel = document.getElementById('scroll-sentinel');
        if (!sentinel) return;
        
        // Create observer with more sensitive trigger
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting && !this.isLoading) {
                    // Auto-load more when sentinel is visible
                    this.loadMoreProducts();
                }
            });
        }, {
            rootMargin: '200px' // Trigger earlier for smoother experience
        });
        
        observer.observe(sentinel);
    }

    /**
     * Load more products (pagination)
     */
    async loadMoreProducts() {
        if (!this.currentResults || !this.currentResults.pagination) return;

        const { page, totalPages, clientSide } = this.currentResults.pagination;

        // For server-side pagination, check if we've reached the end
        if (!clientSide && totalPages && page >= totalPages) return;

        // For client-side pagination, just continue loading until we get < 48 products
        // (The check for hasMore happens in displayResults when next page loads)

        // Remove existing Load More button container before loading
        const container = document.getElementById('loadMoreContainer');
        if (container) {
            container.remove();
        }

        this.currentFilters.page = page + 1;
        await this.performSearch();
    }

    /**
     * Show loading state
     */
    showLoadingState() {
        const grid = document.getElementById('resultsGrid');
        const count = document.getElementById('resultsCount');
        
        if (this.currentFilters.page === 1) {
            grid.innerHTML = '<div class="loading">Searching products...</div>';
            count.textContent = 'Searching...';
        } else {
            // Add loading indicator for pagination at the end of grid
            const loadingHTML = `
                <div class="loading-more-indicator" style="grid-column: 1 / -1;">
                    <div class="spinner"></div>
                    <div>Loading more products...</div>
                </div>
            `;
            grid.insertAdjacentHTML('beforeend', loadingHTML);
        }
    }

    /**
     * Show results section
     */
    showResultsSection() {
        const resultsSection = document.querySelector('.results-section');
        const heroSection = document.querySelector('.hero-section');
        const homepageSections = document.querySelector('.homepage-sections');
        
        if (heroSection) heroSection.classList.add('hidden');
        if (homepageSections) homepageSections.style.display = 'none';
        if (resultsSection) resultsSection.style.display = 'block';
        
        // Update breadcrumb
        this.updateBreadcrumb();
    }

    /**
     * Update breadcrumb
     */
    updateBreadcrumb() {
        const breadcrumb = document.getElementById('categoryBreadcrumb');
        if (!breadcrumb) return;
        
        if (this.currentFilters.q) {
            breadcrumb.textContent = `> Search: "${this.currentFilters.q}"`;
        } else if (this.currentFilters.category) {
            let text = `> ${this.currentFilters.category}`;
            if (this.currentFilters.subcategory) {
                text += ` > ${this.currentFilters.subcategory}`;
            }
            breadcrumb.textContent = text;
        } else {
            breadcrumb.textContent = '';
        }
    }

    /**
     * Remove a smart filter and re-run search
     */
    removeSmartFilter(filterType, filterValue) {
        if (filterType === 'brand') {
            // Remove brand from filters
            if (Array.isArray(this.currentFilters.brand)) {
                this.currentFilters.brand = this.currentFilters.brand.filter(b => b !== filterValue);
            }
            // Uncheck the brand checkbox if visible
            const checkbox = document.querySelector(`input.brand-checkbox[value="${filterValue}"]`);
            if (checkbox) {
                checkbox.checked = false;
            }
        } else if (filterType === 'category') {
            // Remove category from filters
            this.currentFilters.category = null;
            this.currentFilters.subcategory = null;
        }

        // Re-run search
        this.currentFilters.page = 1;
        this.performSearch();
    }

    /**
     * Clear search and return to homepage
     */
    clearSearch() {
        this.currentFilters = {
            q: '',
            category: null,
            subcategory: null,
            brand: [],
            color: [],
            size: [],
            minPrice: null,
            maxPrice: null,
            sort: null,
            page: 1
        };
        
        // Clear active states
        document.querySelectorAll('.category-link').forEach(link => {
            link.classList.remove('active');
        });
        
        // Show homepage
        const resultsSection = document.querySelector('.results-section');
        const heroSection = document.querySelector('.hero-section');
        const homepageSections = document.querySelector('.homepage-sections');
        
        if (heroSection) heroSection.classList.remove('hidden');
        if (homepageSections) homepageSections.style.display = 'block';
        if (resultsSection) resultsSection.style.display = 'none';
        
        // Clear search input
        const searchInput = document.getElementById('navSearchInput');
        if (searchInput) searchInput.value = '';
    }

    /**
     * Set active category in sidebar
     */
    setActiveCategory(link) {
        document.querySelectorAll('.category-link').forEach(l => {
            l.classList.remove('active');
        });
        link.classList.add('active');
    }

    /**
     * Setup lazy loading for images
     */
    setupLazyLoading() {
        if ('loading' in HTMLImageElement.prototype) {
            // Browser supports lazy loading natively
            return;
        }
        
        // Fallback for older browsers
        const images = document.querySelectorAll('img[loading="lazy"]');
        const imageObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    img.src = img.dataset.src || img.src;
                    imageObserver.unobserve(img);
                }
            });
        });
        
        images.forEach(img => imageObserver.observe(img));
    }

    /**
     * Show error message
     */
    showError(message) {
        const grid = document.getElementById('resultsGrid');
        grid.innerHTML = `
            <div class="error-message">
                <div class="error-icon">⚠️</div>
                <p>${message}</p>
            </div>
        `;
    }

    /**
     * Truncate long product titles
     */
    truncateTitle(title, maxLength = 30) {
        if (title.length <= maxLength) return title;
        return title.substring(0, maxLength) + '...';
    }

    /**
     * Toggle product in compare list
     */
    toggleCompare(styleNumber) {
        if (this.compareList.has(styleNumber)) {
            this.compareList.delete(styleNumber);
            this.updateCompareButton(styleNumber, false);
            this.updateCompareBar();
        } else {
            if (this.compareList.size >= this.maxCompareItems) {
                alert(`You can only compare up to ${this.maxCompareItems} products at a time.`);
                return;
            }
            this.compareList.add(styleNumber);
            this.updateCompareButton(styleNumber, true);
            this.updateCompareBar();
        }
    }

    /**
     * Update compare button state
     */
    updateCompareButton(styleNumber, isActive) {
        const button = document.querySelector(`.btn-compare[data-style="${styleNumber}"]`);
        if (button) {
            if (isActive) {
                button.classList.add('active');
                button.innerHTML = '<span class="compare-icon">✓</span> Added';
            } else {
                button.classList.remove('active');
                button.innerHTML = '<span class="compare-icon">⊞</span> Compare';
            }
        }
    }

    /**
     * Update compare bar at bottom of page
     */
    updateCompareBar() {
        let compareBar = document.getElementById('compareBar');
        
        if (this.compareList.size === 0) {
            if (compareBar) {
                compareBar.remove();
            }
            return;
        }

        if (!compareBar) {
            compareBar = document.createElement('div');
            compareBar.id = 'compareBar';
            compareBar.className = 'compare-bar';
            document.body.appendChild(compareBar);
        }

        compareBar.innerHTML = `
            <div class="compare-bar-content">
                <div class="compare-count">
                    Comparing ${this.compareList.size} of ${this.maxCompareItems} products
                </div>
                <div class="compare-items">
                    ${Array.from(this.compareList).map(style => `
                        <span class="compare-item">
                            ${style}
                            <button onclick="catalogSearch.toggleCompare('${style}')" class="remove-compare">×</button>
                        </span>
                    `).join('')}
                </div>
                <div class="compare-actions">
                    <button onclick="catalogSearch.showCompareModal()" class="btn-view-compare">Compare Now</button>
                    <button onclick="catalogSearch.clearCompare()" class="btn-clear-compare">Clear All</button>
                </div>
            </div>
        `;
    }

    /**
     * Clear all compare items
     */
    clearCompare() {
        this.compareList.forEach(style => {
            this.updateCompareButton(style, false);
        });
        this.compareList.clear();
        this.updateCompareBar();
    }

    /**
     * Show compare modal
     */
    async showCompareModal() {
        if (this.compareList.size < 2) {
            alert('Please select at least 2 products to compare.');
            return;
        }

        // Create modal HTML
        const modal = document.createElement('div');
        modal.className = 'compare-modal';
        modal.id = 'compareModal';
        
        modal.innerHTML = `
            <div class="compare-modal-content">
                <div class="compare-modal-header">
                    <h2>Product Comparison</h2>
                    <button onclick="catalogSearch.closeCompareModal()" class="modal-close">×</button>
                </div>
                <div class="compare-modal-body">
                    <div class="compare-loading">Loading product details...</div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Load product details for comparison
        const products = [];
        for (const styleNumber of this.compareList) {
            const result = await this.searchService.searchByStyle(styleNumber);
            if (result.products && result.products.length > 0) {
                products.push(result.products[0]);
            }
        }

        // Build comparison table
        const compareHTML = this.buildCompareTable(products);
        modal.querySelector('.compare-modal-body').innerHTML = compareHTML;
    }

    /**
     * Build comparison table HTML
     */
    buildCompareTable(products) {
        if (products.length === 0) {
            return '<div class="no-products">No products to compare</div>';
        }

        return `
            <div class="compare-table">
                <div class="compare-row compare-header">
                    <div class="compare-cell compare-label">Product</div>
                    ${products.map(p => `
                        <div class="compare-cell">
                            <img src="${p.images?.thumbnail || '/placeholder.jpg'}" alt="${p.productName}">
                            <div class="compare-product-title">${p.productName}</div>
                            <div class="compare-product-style">${p.styleNumber}</div>
                        </div>
                    `).join('')}
                </div>
                <div class="compare-row">
                    <div class="compare-cell compare-label">Price</div>
                    ${products.map(p => `<div class="compare-cell">${p.displayPrice}</div>`).join('')}
                </div>
                <div class="compare-row">
                    <div class="compare-cell compare-label">Colors</div>
                    ${products.map(p => `<div class="compare-cell">${p.colors ? p.colors.length : 0} Available</div>`).join('')}
                </div>
                <div class="compare-row">
                    <div class="compare-cell compare-label">Sizes</div>
                    ${products.map(p => `<div class="compare-cell">${p.sizes ? p.sizes.join(', ') : 'N/A'}</div>`).join('')}
                </div>
                <div class="compare-row">
                    <div class="compare-cell compare-label">Brand</div>
                    ${products.map(p => `<div class="compare-cell">${p.brand || 'N/A'}</div>`).join('')}
                </div>
                <div class="compare-row">
                    <div class="compare-cell compare-label">Actions</div>
                    ${products.map(p => `
                        <div class="compare-cell">
                            <button onclick="catalogSearch.showQuickView('${p.styleNumber}')" class="btn-view-details">View Details</button>
                            <button onclick="catalogSearch.toggleCompare('${p.styleNumber}')" class="btn-remove-from-compare">Remove</button>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    /**
     * Close compare modal
     */
    closeCompareModal() {
        const modal = document.getElementById('compareModal');
        if (modal) {
            modal.remove();
        }
    }

    /**
     * Show quick view modal for a product
     */
    async showQuickView(styleNumber) {
        // Store product data if we need it later
        let productData = null;
        
        // Find product in current results first
        if (this.currentResults && this.currentResults.products) {
            productData = this.currentResults.products.find(p => p.styleNumber === styleNumber);
        }
        
        // If not found, fetch it
        if (!productData) {
            const result = await this.searchService.searchByStyle(styleNumber);
            if (result.products && result.products.length > 0) {
                productData = result.products[0];
            }
        }
        
        if (!productData) {
            alert('Product not found');
            return;
        }

        // Store product data for color switching
        this.currentQuickViewProduct = productData;
        
        // Get initial selected color (first one)
        const selectedColor = productData.colors && productData.colors.length > 0 ? productData.colors[0] : null;

        // Create quick view modal
        const modal = document.createElement('div');
        modal.className = 'quick-view-modal';
        modal.id = 'quickViewModal';
        
        modal.innerHTML = `
            <div class="quick-view-content">
                <div class="quick-view-header">
                    <h2>Quick View</h2>
                    <button onclick="catalogSearch.closeQuickView()" class="modal-close">×</button>
                </div>
                <div class="quick-view-body">
                    <div class="quick-view-images">
                        <a href="/product.html?style=${productData.styleNumber}" 
                           id="quickViewImageLink"
                           class="quick-view-image-link">
                            <img id="quickViewMainImage" 
                                 src="${selectedColor?.productImageUrl || productData.images?.display || productData.images?.main || '/placeholder.jpg'}" 
                                 alt="${productData.productName}">
                        </a>
                    </div>
                    <div class="quick-view-details">
                        <h1 class="quick-view-style">${productData.styleNumber}</h1>
                        <h2 class="quick-view-title">${productData.productName}</h2>
                        
                        <div class="quick-view-price">${productData.displayPrice}</div>
                        
                        ${productData.sizes ? `
                            <div class="quick-view-section">
                                <h3>Available Sizes:</h3>
                                <div class="size-list">${productData.sizes.join(' – ')}</div>
                            </div>
                        ` : ''}
                        
                        ${productData.colors && productData.colors.length > 0 ? `
                            <div class="quick-view-section">
                                <h3>Color selected: <span id="selectedColorName" class="selected-color">${selectedColor.name}</span></h3>
                                <div class="color-swatches">
                                    ${productData.colors.map((color, index) => `
                                        <div class="color-swatch ${index === 0 ? 'selected' : ''}" 
                                             data-color-index="${index}"
                                             data-color-name="${color.name}"
                                             data-product-image="${color.productImageUrl || ''}"
                                             onclick="catalogSearch.selectQuickViewColor(${index})"
                                             title="${color.name}">
                                            ${color.swatchUrl ? 
                                                `<img src="${color.swatchUrl}" alt="${color.name}" />` :
                                                `<div class="color-swatch-fallback" style="background: ${color.hex || '#ccc'}"></div>`
                                            }
                                        </div>
                                    `).join('')}
                                </div>
                            </div>
                        ` : ''}
                        
                        ${productData.description ? `
                            <div class="quick-view-section">
                                <h3>Description:</h3>
                                <p class="product-description">${productData.description}</p>
                            </div>
                        ` : ''}
                        
                        <div class="quick-view-actions">
                            <button onclick="catalogSearch.toggleCompare('${productData.styleNumber}')" 
                                    class="btn-add-compare ${this.compareList.has(productData.styleNumber) ? 'active' : ''}">
                                ${this.compareList.has(productData.styleNumber) ? '✓ Added to Compare' : 'Add To Compare'}
                            </button>
                            <a href="/product.html?style=${productData.styleNumber}" class="btn-full-details">
                                View full Product Details
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        document.body.style.overflow = 'hidden'; // Prevent background scrolling
    }

    /**
     * Handle color swatch selection in quick view
     */
    selectQuickViewColor(colorIndex) {
        if (!this.currentQuickViewProduct || !this.currentQuickViewProduct.colors) return;
        
        const color = this.currentQuickViewProduct.colors[colorIndex];
        if (!color) return;
        
        // Update selected color name
        const colorNameElement = document.getElementById('selectedColorName');
        if (colorNameElement) {
            colorNameElement.textContent = color.name;
        }
        
        // Update main image if color has a product image
        if (color.productImageUrl) {
            const mainImage = document.getElementById('quickViewMainImage');
            if (mainImage) {
                mainImage.src = color.productImageUrl;
            }
        }
        
        // Update selected state on swatches
        document.querySelectorAll('.color-swatch').forEach((swatch, index) => {
            if (index === colorIndex) {
                swatch.classList.add('selected');
            } else {
                swatch.classList.remove('selected');
            }
        });
        
        // Update the product link to include the selected color
        const imageLink = document.getElementById('quickViewImageLink');
        if (imageLink && this.currentQuickViewProduct) {
            imageLink.href = `/product.html?style=${this.currentQuickViewProduct.styleNumber}&color=${encodeURIComponent(color.name)}`;
        }
    }

    /**
     * Close quick view modal
     */
    closeQuickView() {
        const modal = document.getElementById('quickViewModal');
        if (modal) {
            modal.remove();
            document.body.style.overflow = ''; // Restore scrolling
        }
    }
}

// Initialize when ready
let catalogSearch;
document.addEventListener('DOMContentLoaded', () => {
    // Only initialize if ProductSearchService is available
    if (window.ProductSearchService) {
        catalogSearch = new CatalogSearch();
        window.catalogSearch = catalogSearch; // Make globally available
    }
});