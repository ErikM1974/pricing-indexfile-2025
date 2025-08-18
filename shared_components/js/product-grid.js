/**
 * Product Grid Component
 * Displays product search results in a responsive grid layout
 * Handles product cards, loading states, and pagination
 */

class ProductGrid {
    constructor(containerElement, productSearch) {
        this.container = containerElement;
        this.productSearch = productSearch;
        this.viewMode = 'grid'; // grid or list
        this.isLoading = false;
        this.infiniteScrollEnabled = false;
        this.observer = null;
        
        this.init();
    }
    
    init() {
        this.render();
        this.setupInfiniteScroll();
    }
    
    /**
     * Render the grid container structure
     */
    render() {
        this.container.innerHTML = `
            <div class="product-grid-container">
                <!-- Results Header -->
                <div class="results-header">
                    <div class="results-info">
                        <h2 class="results-title">Products</h2>
                        <span class="results-count"></span>
                    </div>
                    <div class="results-controls">
                        <div class="sort-control">
                            <label for="sortSelect">Sort by:</label>
                            <select id="sortSelect" class="sort-select">
                                <option value="name_asc">Name: A to Z</option>
                                <option value="name_desc">Name: Z to A</option>
                                <option value="price_asc">Price: Low to High</option>
                                <option value="price_desc">Price: High to Low</option>
                                <option value="newest">Newest First</option>
                                <option value="style">Style Number</option>
                            </select>
                        </div>
                        <div class="view-controls">
                            <button class="view-btn grid-view active" data-view="grid" title="Grid view">
                                <svg width="16" height="16" viewBox="0 0 16 16">
                                    <rect x="1" y="1" width="5" height="5"/>
                                    <rect x="10" y="1" width="5" height="5"/>
                                    <rect x="1" y="10" width="5" height="5"/>
                                    <rect x="10" y="10" width="5" height="5"/>
                                </svg>
                            </button>
                            <button class="view-btn list-view" data-view="list" title="List view">
                                <svg width="16" height="16" viewBox="0 0 16 16">
                                    <rect x="1" y="2" width="14" height="2"/>
                                    <rect x="1" y="7" width="14" height="2"/>
                                    <rect x="1" y="12" width="14" height="2"/>
                                </svg>
                            </button>
                        </div>
                    </div>
                </div>
                
                <!-- Loading State -->
                <div class="loading-overlay" style="display: none;">
                    <div class="loading-spinner"></div>
                    <p>Loading products...</p>
                </div>
                
                <!-- Products Grid -->
                <div class="products-grid" data-view="grid"></div>
                
                <!-- Pagination -->
                <div class="pagination-container"></div>
                
                <!-- No Results -->
                <div class="no-results" style="display: none;">
                    <svg class="no-results-icon" width="64" height="64" viewBox="0 0 64 64">
                        <circle cx="32" cy="32" r="30" fill="none" stroke="currentColor" stroke-width="2"/>
                        <path d="M20 20 L44 44 M44 20 L20 44" stroke="currentColor" stroke-width="2"/>
                    </svg>
                    <h3>No products found</h3>
                    <p>Try adjusting your filters or search terms</p>
                </div>
                
                <!-- Infinite Scroll Loading -->
                <div class="infinite-scroll-loader" style="display: none;">
                    <div class="loading-spinner"></div>
                </div>
            </div>
        `;
        
        this.bindEvents();
    }
    
    /**
     * Display products in the grid
     */
    displayProducts(data) {
        if (!data) return;
        
        const { products, pagination, metadata } = data;
        const grid = this.container.querySelector('.products-grid');
        const noResults = this.container.querySelector('.no-results');
        
        // Update results count
        this.updateResultsCount(pagination);
        
        // Show/hide appropriate sections
        if (!products || products.length === 0) {
            grid.style.display = 'none';
            noResults.style.display = 'block';
            this.container.querySelector('.pagination-container').style.display = 'none';
            return;
        }
        
        grid.style.display = '';
        noResults.style.display = 'none';
        
        // Render products
        if (this.infiniteScrollEnabled && pagination.page > 1) {
            // Append for infinite scroll
            grid.innerHTML += this.renderProducts(products);
        } else {
            // Replace content
            grid.innerHTML = this.renderProducts(products);
        }
        
        // Update pagination
        if (!this.infiniteScrollEnabled) {
            this.renderPagination(pagination);
        }
        
        // Setup lazy loading for images
        this.setupLazyLoading();
    }
    
    /**
     * Render product cards
     */
    renderProducts(products) {
        return products.map(product => this.renderProductCard(product)).join('');
    }
    
    /**
     * Render a single product card
     */
    renderProductCard(product) {
        const price = this.formatPrice(product.pricing);
        const colorCount = product.colors ? product.colors.length : 0;
        const sizeRange = this.formatSizeRange(product.sizes);
        const primaryImage = product.images?.display || product.images?.thumbnail || '';
        
        if (this.viewMode === 'list') {
            return this.renderListItem(product);
        }
        
        return `
            <div class="product-card" data-style="${product.styleNumber}">
                <div class="product-image-container">
                    <img class="product-image lazy" 
                         data-src="${primaryImage}" 
                         alt="${this.escapeHtml(product.productName)}"
                         loading="lazy">
                    ${product.features?.isTopSeller ? '<span class="badge top-seller">Top Seller</span>' : ''}
                    ${this.isOnSale(product) ? '<span class="badge sale">Sale</span>' : ''}
                    <div class="product-quick-actions">
                        <button class="quick-view-btn" data-style="${product.styleNumber}" title="Quick view">
                            <svg width="20" height="20" viewBox="0 0 20 20">
                                <path d="M10 4.5C5 4.5 1 10 1 10s4 5.5 9 5.5 9-5.5 9-5.5-4-5.5-9-5.5z"/>
                                <circle cx="10" cy="10" r="3"/>
                            </svg>
                        </button>
                    </div>
                </div>
                <div class="product-info">
                    <div class="product-brand">${this.escapeHtml(product.brand || '')}</div>
                    <h3 class="product-name">
                        <a href="/product/${product.styleNumber}" class="product-link">
                            ${this.escapeHtml(product.productName)}
                        </a>
                    </h3>
                    <div class="product-style">Style: ${product.styleNumber}</div>
                    <div class="product-price">${price}</div>
                    <div class="product-meta">
                        ${colorCount > 0 ? `<span class="color-count">${colorCount} colors</span>` : ''}
                        ${sizeRange ? `<span class="size-range">${sizeRange}</span>` : ''}
                    </div>
                    ${this.renderColorSwatches(product.colors)}
                </div>
            </div>
        `;
    }
    
    /**
     * Render product as list item
     */
    renderListItem(product) {
        const price = this.formatPrice(product.pricing);
        const primaryImage = product.images?.thumbnail || '';
        
        return `
            <div class="product-list-item" data-style="${product.styleNumber}">
                <div class="product-image-container">
                    <img class="product-image lazy" 
                         data-src="${primaryImage}" 
                         alt="${this.escapeHtml(product.productName)}"
                         loading="lazy">
                </div>
                <div class="product-details">
                    <div class="product-header">
                        <h3 class="product-name">
                            <a href="/product/${product.styleNumber}" class="product-link">
                                ${this.escapeHtml(product.productName)}
                            </a>
                        </h3>
                        <span class="product-style">Style: ${product.styleNumber}</span>
                    </div>
                    <p class="product-description">${this.truncateText(product.description, 150)}</p>
                    <div class="product-specs">
                        <span class="product-brand">${this.escapeHtml(product.brand || '')}</span>
                        <span class="product-category">${this.escapeHtml(product.category || '')}</span>
                    </div>
                </div>
                <div class="product-pricing">
                    <div class="product-price">${price}</div>
                    ${this.renderColorSwatches(product.colors, 5)}
                    <button class="view-product-btn" data-style="${product.styleNumber}">
                        View Details
                    </button>
                </div>
            </div>
        `;
    }
    
    /**
     * Render color swatches
     */
    renderColorSwatches(colors, limit = 8) {
        if (!colors || colors.length === 0) return '';
        
        const displayColors = colors.slice(0, limit);
        const moreCount = colors.length - limit;
        
        const swatches = displayColors.map(color => {
            const colorClass = this.getColorClass(color.name);
            return `
                <div class="color-swatch ${colorClass}" 
                     title="${this.escapeHtml(color.name)}"
                     style="${color.swatchUrl ? `background-image: url(${color.swatchUrl})` : ''}">
                </div>
            `;
        }).join('');
        
        const more = moreCount > 0 ? `<span class="more-colors">+${moreCount}</span>` : '';
        
        return `<div class="product-colors">${swatches}${more}</div>`;
    }
    
    /**
     * Render pagination controls
     */
    renderPagination(pagination) {
        const container = this.container.querySelector('.pagination-container');
        if (!container) return;
        
        if (pagination.totalPages <= 1) {
            container.style.display = 'none';
            return;
        }
        
        container.style.display = '';
        
        const pages = this.generatePageNumbers(pagination.page, pagination.totalPages);
        
        container.innerHTML = `
            <div class="pagination">
                <button class="page-btn prev" ${!pagination.hasPrev ? 'disabled' : ''} data-page="${pagination.page - 1}">
                    ← Previous
                </button>
                <div class="page-numbers">
                    ${pages.map(page => {
                        if (page === '...') {
                            return '<span class="page-ellipsis">...</span>';
                        }
                        return `
                            <button class="page-btn ${page === pagination.page ? 'active' : ''}" 
                                    data-page="${page}">
                                ${page}
                            </button>
                        `;
                    }).join('')}
                </div>
                <button class="page-btn next" ${!pagination.hasNext ? 'disabled' : ''} data-page="${pagination.page + 1}">
                    Next →
                </button>
            </div>
            <div class="page-info">
                Page ${pagination.page} of ${pagination.totalPages} (${pagination.total} products)
            </div>
        `;
    }
    
    /**
     * Generate page numbers for pagination
     */
    generatePageNumbers(current, total) {
        const pages = [];
        const maxVisible = 7;
        
        if (total <= maxVisible) {
            for (let i = 1; i <= total; i++) {
                pages.push(i);
            }
        } else {
            pages.push(1);
            
            if (current > 3) {
                pages.push('...');
            }
            
            for (let i = Math.max(2, current - 1); i <= Math.min(current + 1, total - 1); i++) {
                pages.push(i);
            }
            
            if (current < total - 2) {
                pages.push('...');
            }
            
            pages.push(total);
        }
        
        return pages;
    }
    
    /**
     * Update results count display
     */
    updateResultsCount(pagination) {
        const countElement = this.container.querySelector('.results-count');
        if (countElement && pagination) {
            const start = (pagination.page - 1) * pagination.limit + 1;
            const end = Math.min(pagination.page * pagination.limit, pagination.total);
            countElement.textContent = `Showing ${start}-${end} of ${pagination.total} products`;
        }
    }
    
    /**
     * Setup infinite scroll
     */
    setupInfiniteScroll() {
        if ('IntersectionObserver' in window) {
            const sentinel = this.container.querySelector('.infinite-scroll-loader');
            if (!sentinel) return;
            
            this.observer = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting && !this.isLoading && this.productSearch.lastResults?.pagination?.hasNext) {
                        this.loadMore();
                    }
                });
            }, {
                rootMargin: '100px'
            });
        }
    }
    
    /**
     * Enable/disable infinite scroll
     */
    setInfiniteScroll(enabled) {
        this.infiniteScrollEnabled = enabled;
        const sentinel = this.container.querySelector('.infinite-scroll-loader');
        
        if (enabled && this.observer && sentinel) {
            this.observer.observe(sentinel);
            sentinel.style.display = '';
        } else if (this.observer && sentinel) {
            this.observer.unobserve(sentinel);
            sentinel.style.display = 'none';
        }
    }
    
    /**
     * Load more products (infinite scroll)
     */
    async loadMore() {
        if (this.isLoading) return;
        
        const pagination = this.productSearch.lastResults?.pagination;
        if (!pagination || !pagination.hasNext) return;
        
        this.productSearch.setPage(pagination.page + 1);
        
        const event = new CustomEvent('loadMore');
        this.container.dispatchEvent(event);
    }
    
    /**
     * Setup lazy loading for images
     */
    setupLazyLoading() {
        const images = this.container.querySelectorAll('img.lazy');
        
        if ('IntersectionObserver' in window) {
            const imageObserver = new IntersectionObserver((entries, observer) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const img = entry.target;
                        img.src = img.dataset.src;
                        img.classList.remove('lazy');
                        observer.unobserve(img);
                    }
                });
            });
            
            images.forEach(img => imageObserver.observe(img));
        } else {
            // Fallback for older browsers
            images.forEach(img => {
                img.src = img.dataset.src;
                img.classList.remove('lazy');
            });
        }
    }
    
    /**
     * Show loading state
     */
    showLoading() {
        this.isLoading = true;
        const overlay = this.container.querySelector('.loading-overlay');
        if (overlay) {
            overlay.style.display = 'flex';
        }
    }
    
    /**
     * Hide loading state
     */
    hideLoading() {
        this.isLoading = false;
        const overlay = this.container.querySelector('.loading-overlay');
        if (overlay) {
            overlay.style.display = 'none';
        }
    }
    
    /**
     * Bind event listeners
     */
    bindEvents() {
        // Sort change
        const sortSelect = this.container.querySelector('#sortSelect');
        if (sortSelect) {
            sortSelect.addEventListener('change', (e) => {
                this.productSearch.setSort(e.target.value);
                const event = new CustomEvent('sortChanged', { detail: e.target.value });
                this.container.dispatchEvent(event);
            });
        }
        
        // View mode toggle
        this.container.addEventListener('click', (e) => {
            const viewBtn = e.target.closest('.view-btn');
            if (viewBtn) {
                this.setViewMode(viewBtn.dataset.view);
            }
            
            const pageBtn = e.target.closest('.page-btn');
            if (pageBtn && !pageBtn.disabled) {
                const page = parseInt(pageBtn.dataset.page);
                this.productSearch.setPage(page);
                const event = new CustomEvent('pageChanged', { detail: page });
                this.container.dispatchEvent(event);
            }
            
            const quickViewBtn = e.target.closest('.quick-view-btn');
            if (quickViewBtn) {
                const event = new CustomEvent('quickView', { detail: quickViewBtn.dataset.style });
                this.container.dispatchEvent(event);
            }
            
            const viewProductBtn = e.target.closest('.view-product-btn');
            if (viewProductBtn) {
                window.location.href = `/product/${viewProductBtn.dataset.style}`;
            }
        });
    }
    
    /**
     * Set view mode (grid or list)
     */
    setViewMode(mode) {
        this.viewMode = mode;
        const grid = this.container.querySelector('.products-grid');
        
        grid.dataset.view = mode;
        
        // Update button states
        this.container.querySelectorAll('.view-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.view === mode);
        });
        
        // Re-render if we have products
        if (this.productSearch.lastResults) {
            this.displayProducts(this.productSearch.lastResults);
        }
    }
    
    /**
     * Helper functions
     */
    formatPrice(pricing) {
        if (!pricing) return '';
        
        if (pricing.sale && pricing.sale < pricing.current) {
            return `
                <span class="price-sale">$${pricing.sale.toFixed(2)}</span>
                <span class="price-original">$${pricing.current.toFixed(2)}</span>
            `;
        }
        
        if (pricing.minPrice && pricing.maxPrice && pricing.minPrice !== pricing.maxPrice) {
            return `<span class="price-range">$${pricing.minPrice.toFixed(2)} - $${pricing.maxPrice.toFixed(2)}</span>`;
        }
        
        return `<span class="price">$${(pricing.current || pricing.minPrice || 0).toFixed(2)}</span>`;
    }
    
    formatSizeRange(sizes) {
        if (!sizes || sizes.length === 0) return '';
        if (sizes.length === 1) return sizes[0];
        return `${sizes[0]} - ${sizes[sizes.length - 1]}`;
    }
    
    isOnSale(product) {
        return product.pricing?.sale && product.pricing.sale < product.pricing.current;
    }
    
    truncateText(text, maxLength) {
        if (!text || text.length <= maxLength) return text || '';
        return text.substr(0, maxLength).trim() + '...';
    }
    
    getColorClass(colorName) {
        const colorMap = {
            'black': 'bg-black',
            'white': 'bg-white',
            'grey': 'bg-grey',
            'gray': 'bg-grey',
            'navy': 'bg-navy',
            'blue': 'bg-blue',
            'red': 'bg-red',
            'green': 'bg-green'
        };
        
        const lowerName = colorName.toLowerCase();
        for (const [key, value] of Object.entries(colorMap)) {
            if (lowerName.includes(key)) {
                return value;
            }
        }
        return 'bg-default';
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ProductGrid;
}