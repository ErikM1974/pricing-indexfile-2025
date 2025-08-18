/**
 * Advanced Autocomplete Module
 * Updated to use the new products/search API endpoint
 */

class AdvancedAutocomplete {
    constructor(inputId, listId, onSelect) {
        this.input = document.getElementById(inputId);
        this.resultsList = document.getElementById(listId);
        this.onSelect = onSelect;
        
        // State
        this.searchTimeout = null;
        this.selectedIndex = -1;
        this.results = [];
        this.recentSearches = this.loadRecentSearches();
        
        // API endpoint - now using products/search
        this.API_URL = 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/products/search';
        
        // Initialize
        this.init();
    }
    
    init() {
        if (!this.input || !this.resultsList) return;
        
        // Set up event listeners
        this.input.addEventListener('input', this.handleInput.bind(this));
        this.input.addEventListener('keydown', this.handleKeydown.bind(this));
        this.input.addEventListener('focus', this.handleFocus.bind(this));
        
        // Click outside to close
        document.addEventListener('click', (e) => {
            if (!this.input.contains(e.target) && !this.resultsList.contains(e.target)) {
                this.hideResults();
            }
        });
    }
    
    handleInput(e) {
        const value = e.target.value.trim();
        
        // Clear previous timeout
        clearTimeout(this.searchTimeout);
        
        // Reset selection
        this.selectedIndex = -1;
        
        if (value.length < 2) {
            this.hideResults();
            return;
        }
        
        // Debounce search
        this.searchTimeout = setTimeout(() => {
            this.search(value);
        }, 200);
    }
    
    handleKeydown(e) {
        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                this.navigateResults(1);
                break;
            case 'ArrowUp':
                e.preventDefault();
                this.navigateResults(-1);
                break;
            case 'Enter':
                e.preventDefault();
                this.selectResult();
                break;
            case 'Escape':
                this.hideResults();
                this.input.blur();
                break;
        }
    }
    
    handleFocus() {
        const value = this.input.value.trim();
        
        if (value.length >= 2) {
            // Re-show results if available
            if (this.results.length > 0) {
                this.showResults(this.results);
            }
        } else if (this.recentSearches.length > 0) {
            // Show recent searches
            this.showRecentSearches();
        }
    }
    
    async search(term) {
        try {
            // Show loading state
            this.showLoading();
            
            // Use the new products/search endpoint
            const params = new URLSearchParams({
                q: term,
                limit: 8,  // Limit results for autocomplete
                includeFacets: false,  // Don't need facets for autocomplete
                status: 'Active'  // Only show active products
            });
            
            const response = await fetch(`${this.API_URL}?${params}`);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const result = await response.json();
            
            if (result.success && result.data && result.data.products) {
                this.results = result.data.products;
                this.showResults(this.results);
            } else {
                this.showNoResults();
            }
            
        } catch (error) {
            console.error('Autocomplete search error:', error);
            this.showError();
        }
    }
    
    showResults(products) {
        if (!products || products.length === 0) {
            this.showNoResults();
            return;
        }
        
        const html = products.map((product, index) => {
            const thumbnail = product.images?.thumbnail || '';
            const price = product.pricing?.current ? `$${product.pricing.current.toFixed(2)}` : '';
            const colorCount = product.colors ? product.colors.length : 0;
            
            return `
                <div class="autocomplete-item ${index === this.selectedIndex ? 'selected' : ''}" 
                     data-index="${index}"
                     data-style="${product.styleNumber}">
                    ${thumbnail ? `<img src="${thumbnail}" alt="${product.productName}" class="autocomplete-img">` : ''}
                    <div class="autocomplete-content">
                        <div class="autocomplete-title">${this.highlightMatch(product.productName, this.input.value)}</div>
                        <div class="autocomplete-meta">
                            <span class="autocomplete-style">Style: ${product.styleNumber}</span>
                            ${price ? `<span class="autocomplete-price">${price}</span>` : ''}
                            ${colorCount > 0 ? `<span class="autocomplete-colors">${colorCount} colors</span>` : ''}
                        </div>
                    </div>
                </div>
            `;
        }).join('');
        
        this.resultsList.innerHTML = html;
        this.resultsList.style.display = 'block';
        
        // Add click handlers
        this.resultsList.querySelectorAll('.autocomplete-item').forEach(item => {
            item.addEventListener('click', () => {
                const index = parseInt(item.dataset.index);
                this.selectedIndex = index;
                this.selectResult();
            });
        });
    }
    
    showRecentSearches() {
        if (this.recentSearches.length === 0) return;
        
        const html = `
            <div class="autocomplete-section">
                <div class="autocomplete-section-title">Recent Searches</div>
                ${this.recentSearches.map((search, index) => `
                    <div class="autocomplete-item recent-search" data-search="${search}">
                        <svg class="icon-history" width="16" height="16" viewBox="0 0 16 16">
                            <path d="M8 2a6 6 0 110 12A6 6 0 018 2zm0 1a5 5 0 100 10A5 5 0 008 3zm.5 2v3.5H11v1H7.5V5h1z"/>
                        </svg>
                        <span>${search}</span>
                    </div>
                `).join('')}
            </div>
        `;
        
        this.resultsList.innerHTML = html;
        this.resultsList.style.display = 'block';
        
        // Add click handlers for recent searches
        this.resultsList.querySelectorAll('.recent-search').forEach(item => {
            item.addEventListener('click', () => {
                const search = item.dataset.search;
                this.input.value = search;
                this.search(search);
            });
        });
    }
    
    showLoading() {
        this.resultsList.innerHTML = `
            <div class="autocomplete-loading">
                <div class="loading-spinner"></div>
                <span>Searching...</span>
            </div>
        `;
        this.resultsList.style.display = 'block';
    }
    
    showNoResults() {
        this.resultsList.innerHTML = `
            <div class="autocomplete-no-results">
                No products found for "${this.input.value}"
            </div>
        `;
        this.resultsList.style.display = 'block';
    }
    
    showError() {
        this.resultsList.innerHTML = `
            <div class="autocomplete-error">
                Search failed. Please try again.
            </div>
        `;
        this.resultsList.style.display = 'block';
    }
    
    hideResults() {
        this.resultsList.style.display = 'none';
        this.selectedIndex = -1;
    }
    
    navigateResults(direction) {
        const items = this.resultsList.querySelectorAll('.autocomplete-item:not(.recent-search)');
        if (items.length === 0) return;
        
        // Update selected index
        this.selectedIndex += direction;
        
        // Wrap around
        if (this.selectedIndex < 0) {
            this.selectedIndex = items.length - 1;
        } else if (this.selectedIndex >= items.length) {
            this.selectedIndex = 0;
        }
        
        // Update UI
        items.forEach((item, index) => {
            item.classList.toggle('selected', index === this.selectedIndex);
        });
        
        // Update input with selected item's text
        if (this.selectedIndex >= 0 && this.results[this.selectedIndex]) {
            this.input.value = this.results[this.selectedIndex].productName;
        }
    }
    
    selectResult() {
        if (this.selectedIndex >= 0 && this.results[this.selectedIndex]) {
            const product = this.results[this.selectedIndex];
            
            // Save to recent searches
            this.saveRecentSearch(product.productName);
            
            // Update input
            this.input.value = product.productName;
            
            // Hide results
            this.hideResults();
            
            // Call callback
            if (this.onSelect) {
                this.onSelect(product);
            }
        } else if (this.input.value.trim()) {
            // If no item selected but there's text, perform search
            this.saveRecentSearch(this.input.value.trim());
            
            if (this.onSelect) {
                this.onSelect({ query: this.input.value.trim() });
            }
            
            this.hideResults();
        }
    }
    
    highlightMatch(text, query) {
        if (!query) return text;
        
        const regex = new RegExp(`(${this.escapeRegex(query)})`, 'gi');
        return text.replace(regex, '<strong>$1</strong>');
    }
    
    escapeRegex(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
    
    loadRecentSearches() {
        try {
            const searches = localStorage.getItem('nwca_recent_searches');
            return searches ? JSON.parse(searches) : [];
        } catch {
            return [];
        }
    }
    
    saveRecentSearch(search) {
        // Remove if already exists
        this.recentSearches = this.recentSearches.filter(s => s !== search);
        
        // Add to beginning
        this.recentSearches.unshift(search);
        
        // Keep only last 5
        this.recentSearches = this.recentSearches.slice(0, 5);
        
        // Save to localStorage
        try {
            localStorage.setItem('nwca_recent_searches', JSON.stringify(this.recentSearches));
        } catch (e) {
            console.error('Failed to save recent searches:', e);
        }
    }
}

// Initialize autocomplete when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // Initialize for navigation search
    const navAutocomplete = new AdvancedAutocomplete(
        'navSearchInput',
        'navAutocompleteList',
        (result) => {
            // Handle selection
            if (result.styleNumber) {
                // Navigate to product page or trigger search
                if (window.catalogApp && window.catalogApp.performSearch) {
                    window.catalogApp.performSearch(result.styleNumber);
                } else {
                    window.location.href = `/product/${result.styleNumber}`;
                }
            } else if (result.query) {
                // Perform general search
                if (window.catalogApp && window.catalogApp.performSearch) {
                    window.catalogApp.performSearch(result.query);
                }
            }
        }
    );
    
    window.navAutocomplete = navAutocomplete;
});