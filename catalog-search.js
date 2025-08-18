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
        
        this.init();
    }

    init() {
        console.log('[CatalogSearch] Initializing...');
        
        // Set up event listeners
        this.setupSearchInput();
        this.setupCategoryMenu();
        this.setupSortOptions();
        
        // Load initial content
        this.loadTopSellers();
        
        // Set up infinite scroll
        this.setupInfiniteScroll();
    }

    /**
     * Set up search input with debouncing
     */
    setupSearchInput() {
        const searchInput = document.getElementById('navSearchInput');
        const searchBtn = document.getElementById('navSearchBtn');
        
        if (!searchInput) return;
        
        // Replace autocomplete with new implementation
        searchInput.addEventListener('input', (e) => {
            const query = e.target.value.trim();
            
            // Clear existing timeout
            clearTimeout(this.searchTimeout);
            
            // Reset filters when searching
            if (query !== this.currentFilters.q) {
                this.currentFilters = {
                    ...this.currentFilters,
                    q: query,
                    category: null,
                    subcategory: null,
                    page: 1
                };
            }
            
            // Debounce search
            if (query.length >= 2) {
                this.searchTimeout = setTimeout(() => {
                    this.performSearch();
                }, 300);
            } else if (query.length === 0) {
                // Clear search
                this.clearSearch();
            }
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
            
            // If we have category/subcategory, use smart search
            if (this.currentFilters.category) {
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
                // Regular search (by query or other filters)
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
                    grid.innerHTML = notice.outerHTML;
                }
            }
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
        
        return `
            <div class="product-card" data-style="${product.styleNumber}">
                <a href="/product-detail.html?style=${product.styleNumber}" class="product-link">
                    <div class="product-image">
                        ${product.features?.isTopSeller ? '<div class="top-seller-badge">TOP SELLER</div>' : ''}
                        <img src="${imageUrl}" 
                             alt="${product.productName}" 
                             loading="lazy"
                             onerror="this.src='/placeholder.jpg'">
                    </div>
                    <div class="product-info">
                        <div class="product-style">${product.styleNumber}</div>
                        <div class="product-title">${product.productName}</div>
                        ${colorCount > 1 ? `
                            <div class="product-colors-count">${colorCount} Colors Available</div>
                        ` : ''}
                        <div class="product-price">${product.displayPrice}</div>
                    </div>
                </a>
                <div class="product-actions">
                    <button class="btn-compare" data-style="${product.styleNumber}">
                        <span class="compare-icon">⊞</span> Compare
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
        // For now, we'll add filters to the sidebar
        // In a full implementation, we'd create a dedicated filter panel
        
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
     */
    updateLoadMoreButton(results) {
        // Remove existing button/sentinel if any
        const existingButton = document.getElementById('loadMoreButton');
        const existingSentinel = document.getElementById('scroll-sentinel');
        
        if (existingButton) existingButton.remove();
        if (existingSentinel) existingSentinel.remove();
        
        // Check if there are more products to load
        if (results && results.pagination) {
            const { page, totalPages, total, limit } = results.pagination;
            const showingCount = Math.min(page * limit, total);
            
            if (page < totalPages) {
                // Create Load More button container
                const buttonContainer = document.createElement('div');
                buttonContainer.className = 'load-more-container';
                buttonContainer.id = 'loadMoreContainer';
                buttonContainer.innerHTML = `
                    <button id="loadMoreButton" class="load-more-btn" onclick="catalogSearch.loadMoreProducts()">
                        Load More Products
                        <span class="load-more-count">(Showing ${showingCount} of ${total})</span>
                    </button>
                    <div id="scroll-sentinel" style="height: 1px; margin-top: 100px;"></div>
                `;
                
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
        
        const { page, totalPages } = this.currentResults.pagination;
        
        if (page >= totalPages) return;
        
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