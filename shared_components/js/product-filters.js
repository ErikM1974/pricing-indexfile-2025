/**
 * Product Filters Component
 * Manages faceted filtering UI for product search
 * Works with ProductSearch module to filter results
 */

class ProductFilters {
    constructor(containerElement, productSearch) {
        this.container = containerElement;
        this.productSearch = productSearch;
        this.facets = null;
        this.isOpen = window.innerWidth > 768; // Open by default on desktop
        
        this.init();
    }
    
    init() {
        this.render();
        this.bindEvents();
    }
    
    /**
     * Render the filter sidebar structure
     */
    render() {
        this.container.innerHTML = `
            <div class="filters-container">
                <div class="filters-header">
                    <h3>Filters</h3>
                    <button class="clear-filters-btn" style="display: none;">
                        Clear All (<span class="filter-count">0</span>)
                    </button>
                </div>
                
                <div class="filters-content">
                    <!-- Price Range -->
                    <div class="filter-section price-filter">
                        <h4 class="filter-title">Price Range</h4>
                        <div class="price-inputs">
                            <input type="number" class="price-min" placeholder="Min" min="0" step="0.01">
                            <span>–</span>
                            <input type="number" class="price-max" placeholder="Max" min="0" step="0.01">
                            <button class="price-apply-btn">Apply</button>
                        </div>
                        <div class="price-ranges"></div>
                    </div>
                    
                    <!-- Categories -->
                    <div class="filter-section category-filter">
                        <h4 class="filter-title">Categories</h4>
                        <div class="filter-options" data-filter="category"></div>
                    </div>
                    
                    <!-- Brands -->
                    <div class="filter-section brand-filter">
                        <h4 class="filter-title">Brands</h4>
                        <div class="filter-search">
                            <input type="text" class="brand-search" placeholder="Search brands...">
                        </div>
                        <div class="filter-options scrollable" data-filter="brand"></div>
                    </div>
                    
                    <!-- Colors -->
                    <div class="filter-section color-filter">
                        <h4 class="filter-title">Colors</h4>
                        <div class="filter-options color-grid" data-filter="color"></div>
                    </div>
                    
                    <!-- Sizes -->
                    <div class="filter-section size-filter">
                        <h4 class="filter-title">Sizes</h4>
                        <div class="filter-options size-grid" data-filter="size"></div>
                    </div>
                    
                    <!-- Additional Filters -->
                    <div class="filter-section additional-filters">
                        <label class="checkbox-option">
                            <input type="checkbox" id="topSellerFilter">
                            <span>Top Sellers Only</span>
                        </label>
                        <label class="checkbox-option">
                            <input type="checkbox" id="onSaleFilter">
                            <span>On Sale</span>
                        </label>
                    </div>
                </div>
                
                <button class="filters-toggle mobile-only">
                    <span class="toggle-icon">☰</span>
                    Filters
                </button>
            </div>
        `;
    }
    
    /**
     * Update filters with facet data
     */
    updateFacets(facets) {
        if (!facets) return;
        
        this.facets = facets;
        
        // Update categories
        this.updateFilterOptions('category', facets.categories || []);
        
        // Update brands
        this.updateFilterOptions('brand', facets.brands || []);
        
        // Update colors
        this.updateColorOptions(facets.colors || []);
        
        // Update sizes
        this.updateSizeOptions(facets.sizes || []);
        
        // Update price ranges
        this.updatePriceRanges(facets.priceRanges || []);
        
        // Update filter count
        this.updateFilterCount();
    }
    
    /**
     * Update filter options for a specific filter type
     */
    updateFilterOptions(filterType, options) {
        const container = this.container.querySelector(`[data-filter="${filterType}"]`);
        if (!container) return;
        
        const currentFilters = this.productSearch.state.filters[filterType] || [];
        
        container.innerHTML = options.map(option => {
            const isChecked = currentFilters.includes(option.name);
            const isDisabled = option.count === 0 && !isChecked;
            
            return `
                <label class="filter-option ${isDisabled ? 'disabled' : ''}">
                    <input type="checkbox" 
                           value="${this.escapeHtml(option.name)}" 
                           ${isChecked ? 'checked' : ''}
                           ${isDisabled ? 'disabled' : ''}
                           data-filter="${filterType}">
                    <span class="option-name">${this.escapeHtml(option.name)}</span>
                    <span class="option-count">(${option.count})</span>
                </label>
            `;
        }).join('');
    }
    
    /**
     * Update color filter options with color swatches
     */
    updateColorOptions(colors) {
        const container = this.container.querySelector('[data-filter="color"]');
        if (!container) return;
        
        const currentFilters = this.productSearch.state.filters.color || [];
        
        // Group similar colors if needed
        const topColors = colors.slice(0, 20); // Show top 20 colors
        
        container.innerHTML = topColors.map(color => {
            const isChecked = currentFilters.includes(color.name);
            const colorClass = this.getColorClass(color.name);
            
            return `
                <div class="color-option ${isChecked ? 'selected' : ''}" 
                     data-color="${this.escapeHtml(color.name)}"
                     title="${this.escapeHtml(color.name)} (${color.count})">
                    <div class="color-swatch ${colorClass}"></div>
                    <span class="color-count">${color.count}</span>
                </div>
            `;
        }).join('');
    }
    
    /**
     * Update size filter options
     */
    updateSizeOptions(sizes) {
        const container = this.container.querySelector('[data-filter="size"]');
        if (!container) return;
        
        const currentFilters = this.productSearch.state.filters.size || [];
        
        // Define size order
        const sizeOrder = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL', '6XL'];
        
        // Sort sizes according to order
        const sortedSizes = sizes.sort((a, b) => {
            const aIndex = sizeOrder.indexOf(a.name);
            const bIndex = sizeOrder.indexOf(b.name);
            if (aIndex === -1 && bIndex === -1) return a.name.localeCompare(b.name);
            if (aIndex === -1) return 1;
            if (bIndex === -1) return -1;
            return aIndex - bIndex;
        });
        
        container.innerHTML = sortedSizes.map(size => {
            const isChecked = currentFilters.includes(size.name);
            const isDisabled = size.count === 0 && !isChecked;
            
            return `
                <button class="size-option ${isChecked ? 'selected' : ''} ${isDisabled ? 'disabled' : ''}"
                        data-size="${this.escapeHtml(size.name)}"
                        ${isDisabled ? 'disabled' : ''}>
                    ${this.escapeHtml(size.name)}
                    <span class="size-count">${size.count}</span>
                </button>
            `;
        }).join('');
    }
    
    /**
     * Update price range quick filters
     */
    updatePriceRanges(ranges) {
        const container = this.container.querySelector('.price-ranges');
        if (!container) return;
        
        container.innerHTML = ranges.map(range => {
            return `
                <button class="price-range-btn" 
                        data-min="${range.min || ''}" 
                        data-max="${range.max || ''}">
                    ${range.label} <span>(${range.count})</span>
                </button>
            `;
        }).join('');
    }
    
    /**
     * Bind event listeners
     */
    bindEvents() {
        // Checkbox filters
        this.container.addEventListener('change', (e) => {
            if (e.target.type === 'checkbox' && e.target.dataset.filter) {
                this.handleFilterChange(e.target);
            }
        });
        
        // Color filter clicks
        this.container.addEventListener('click', (e) => {
            const colorOption = e.target.closest('.color-option');
            if (colorOption) {
                this.handleColorSelect(colorOption);
            }
            
            const sizeOption = e.target.closest('.size-option');
            if (sizeOption && !sizeOption.disabled) {
                this.handleSizeSelect(sizeOption);
            }
            
            const priceRange = e.target.closest('.price-range-btn');
            if (priceRange) {
                this.handlePriceRangeSelect(priceRange);
            }
        });
        
        // Price range inputs
        const priceApplyBtn = this.container.querySelector('.price-apply-btn');
        if (priceApplyBtn) {
            priceApplyBtn.addEventListener('click', () => this.applyPriceFilter());
        }
        
        // Clear filters button
        const clearBtn = this.container.querySelector('.clear-filters-btn');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => this.clearAllFilters());
        }
        
        // Brand search
        const brandSearch = this.container.querySelector('.brand-search');
        if (brandSearch) {
            brandSearch.addEventListener('input', (e) => this.filterBrands(e.target.value));
        }
        
        // Special filters
        const topSellerFilter = this.container.querySelector('#topSellerFilter');
        if (topSellerFilter) {
            topSellerFilter.addEventListener('change', (e) => {
                this.productSearch.setFilter('isTopSeller', e.target.checked ? true : null);
                this.onFilterChange();
            });
        }
        
        // Mobile toggle
        const toggleBtn = this.container.querySelector('.filters-toggle');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', () => this.toggleFilters());
        }
    }
    
    /**
     * Handle checkbox filter change
     */
    handleFilterChange(checkbox) {
        const filterType = checkbox.dataset.filter;
        const value = checkbox.value;
        
        this.productSearch.toggleFilterValue(filterType, value);
        this.onFilterChange();
    }
    
    /**
     * Handle color selection
     */
    handleColorSelect(colorOption) {
        const color = colorOption.dataset.color;
        colorOption.classList.toggle('selected');
        
        this.productSearch.toggleFilterValue('color', color);
        this.onFilterChange();
    }
    
    /**
     * Handle size selection
     */
    handleSizeSelect(sizeOption) {
        const size = sizeOption.dataset.size;
        sizeOption.classList.toggle('selected');
        
        this.productSearch.toggleFilterValue('size', size);
        this.onFilterChange();
    }
    
    /**
     * Handle price range selection
     */
    handlePriceRangeSelect(rangeBtn) {
        const min = rangeBtn.dataset.min ? parseFloat(rangeBtn.dataset.min) : null;
        const max = rangeBtn.dataset.max ? parseFloat(rangeBtn.dataset.max) : null;
        
        this.container.querySelector('.price-min').value = min || '';
        this.container.querySelector('.price-max').value = max || '';
        
        this.productSearch.setPriceRange(min, max);
        this.onFilterChange();
    }
    
    /**
     * Apply custom price filter
     */
    applyPriceFilter() {
        const min = parseFloat(this.container.querySelector('.price-min').value) || null;
        const max = parseFloat(this.container.querySelector('.price-max').value) || null;
        
        this.productSearch.setPriceRange(min, max);
        this.onFilterChange();
    }
    
    /**
     * Clear all filters
     */
    clearAllFilters() {
        this.productSearch.resetFilters();
        this.render();
        this.bindEvents();
        this.onFilterChange();
    }
    
    /**
     * Filter brands in the list
     */
    filterBrands(searchTerm) {
        const brandOptions = this.container.querySelectorAll('.brand-filter .filter-option');
        const term = searchTerm.toLowerCase();
        
        brandOptions.forEach(option => {
            const brandName = option.querySelector('.option-name').textContent.toLowerCase();
            option.style.display = brandName.includes(term) ? '' : 'none';
        });
    }
    
    /**
     * Toggle mobile filters
     */
    toggleFilters() {
        this.isOpen = !this.isOpen;
        this.container.classList.toggle('filters-open', this.isOpen);
    }
    
    /**
     * Update filter count display
     */
    updateFilterCount() {
        const count = this.productSearch.getActiveFilterCount();
        const clearBtn = this.container.querySelector('.clear-filters-btn');
        const countSpan = this.container.querySelector('.filter-count');
        
        if (clearBtn && countSpan) {
            clearBtn.style.display = count > 0 ? '' : 'none';
            countSpan.textContent = count;
        }
    }
    
    /**
     * Called when filters change
     */
    onFilterChange() {
        this.updateFilterCount();
        
        // Dispatch custom event
        const event = new CustomEvent('filtersChanged', {
            detail: {
                filters: this.productSearch.state.filters,
                query: this.productSearch.state.query
            }
        });
        this.container.dispatchEvent(event);
    }
    
    /**
     * Get color class for CSS styling
     */
    getColorClass(colorName) {
        const colorMap = {
            'black': 'bg-black',
            'white': 'bg-white',
            'grey': 'bg-grey',
            'gray': 'bg-grey',
            'navy': 'bg-navy',
            'blue': 'bg-blue',
            'red': 'bg-red',
            'green': 'bg-green',
            'yellow': 'bg-yellow',
            'orange': 'bg-orange',
            'purple': 'bg-purple',
            'pink': 'bg-pink',
            'brown': 'bg-brown'
        };
        
        const lowerName = colorName.toLowerCase();
        for (const [key, value] of Object.entries(colorMap)) {
            if (lowerName.includes(key)) {
                return value;
            }
        }
        return 'bg-default';
    }
    
    /**
     * Escape HTML for security
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ProductFilters;
}