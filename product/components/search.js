/**
 * Product Search Component
 * Lightning-fast search with instant results
 */

import { API } from '../services/api.js';

export class ProductSearch {
    constructor(container, onProductSelect) {
        this.container = container;
        this.onProductSelect = onProductSelect;
        this.api = new API();
        
        console.log('[ProductSearch] Initializing with container:', container);
        
        // Elements - support both header and page search
        this.input = document.getElementById('header-style-search') || (container ? container.querySelector('#style-search') : null);
        
        console.log('[ProductSearch] Found input:', this.input);
        
        // Handle results container based on which input we're using
        if (this.input && this.input.id === 'header-style-search') {
            // For header search, create results container in header
            const headerSearch = this.input.closest('.header-search');
            console.log('[ProductSearch] Header search container:', headerSearch);
            
            if (headerSearch) {
                this.resultsContainer = headerSearch.querySelector('#header-search-results');
                if (!this.resultsContainer) {
                    this.resultsContainer = document.createElement('div');
                    this.resultsContainer.id = 'header-search-results';
                    this.resultsContainer.className = 'search-results hidden';
                    headerSearch.appendChild(this.resultsContainer);
                    console.log('[ProductSearch] Created results container');
                }
            }
        } else if (container) {
            // For page search, use existing container
            this.resultsContainer = container.querySelector('#search-results');
        }
        
        console.log('[ProductSearch] Final setup - Input:', this.input?.id, 'Results container:', this.resultsContainer);
        
        // State
        this.searchTimeout = null;
        this.selectedIndex = -1;
        this.results = [];
        this.recentSearches = this.loadRecentSearches();
        
        // Initialize
        this.init();
    }

    init() {
        // Check if input element exists
        if (!this.input) {
            console.error('[ProductSearch] No search input found');
            return;
        }
        
        console.log('[ProductSearch] Initializing with input:', this.input.id);
        
        // Set up event listeners
        this.input.addEventListener('input', this.handleInput.bind(this));
        this.input.addEventListener('keydown', this.handleKeydown.bind(this));
        this.input.addEventListener('focus', this.handleFocus.bind(this));
        
        // Click outside to close
        document.addEventListener('click', (e) => {
            const searchParent = this.input ? this.input.closest('.header-search') : null;
            if ((!this.container || !this.container.contains(e.target)) && 
                (!searchParent || !searchParent.contains(e.target))) {
                this.hideResults();
            }
        });
    }

    handleInput(e) {
        const value = e.target.value.trim();
        console.log('[ProductSearch] Input value:', value);
        
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
        console.log('[ProductSearch] Searching for:', term);
        
        try {
            // Show loading state
            this.showLoading();
            
            // Perform search
            const results = await this.api.searchProducts(term);
            console.log('[ProductSearch] Search results:', results);
            this.results = results;
            
            if (results.length > 0) {
                this.showResults(results);
            } else {
                this.showNoResults();
            }
        } catch (error) {
            console.error('[ProductSearch] Search error:', error);
            this.showError();
        }
    }

    showResults(results) {
        if (!this.resultsContainer) {
            console.error('[ProductSearch] No results container available');
            return;
        }
        
        let html = '<div class="search-results-list">';
        
        results.forEach((result, index) => {
            const isSelected = index === this.selectedIndex;
            html += `
                <div class="search-result-item ${isSelected ? 'selected' : ''}" 
                     data-index="${index}"
                     data-style="${result.value}">
                    <div class="result-style">${result.value}</div>
                    <div class="result-name">${result.label}</div>
                </div>
            `;
        });
        
        html += '</div>';
        
        this.resultsContainer.innerHTML = html;
        this.resultsContainer.classList.remove('hidden');
        
        // Add click handlers
        this.resultsContainer.querySelectorAll('.search-result-item').forEach(item => {
            item.addEventListener('click', () => {
                const styleNumber = item.dataset.style;
                this.selectProduct(styleNumber);
            });
            
            item.addEventListener('mouseenter', () => {
                this.selectedIndex = parseInt(item.dataset.index);
                this.updateSelection();
            });
        });
    }

    showRecentSearches() {
        if (this.recentSearches.length === 0 || !this.resultsContainer) return;
        
        let html = '<div class="search-results-list">';
        html += '<div class="recent-searches-header">Recent Searches</div>';
        
        this.recentSearches.forEach((style, index) => {
            html += `
                <div class="search-result-item recent" 
                     data-style="${style}">
                    <div class="result-style">${style}</div>
                    <div class="result-name">Recent</div>
                </div>
            `;
        });
        
        html += '</div>';
        
        this.resultsContainer.innerHTML = html;
        this.resultsContainer.classList.remove('hidden');
        
        // Add click handlers
        this.resultsContainer.querySelectorAll('.search-result-item').forEach(item => {
            item.addEventListener('click', () => {
                const styleNumber = item.dataset.style;
                this.input.value = styleNumber;
                this.search(styleNumber);
            });
        });
    }

    showLoading() {
        if (!this.resultsContainer) {
            console.error('[ProductSearch] No results container available');
            return;
        }
        
        this.resultsContainer.innerHTML = `
            <div class="search-loading">
                <div class="mini-spinner"></div>
                <span>Searching...</span>
            </div>
        `;
        this.resultsContainer.classList.remove('hidden');
    }

    showNoResults() {
        if (!this.resultsContainer) {
            console.error('[ProductSearch] No results container available');
            return;
        }
        
        this.resultsContainer.innerHTML = `
            <div class="search-no-results">
                No products found
            </div>
        `;
        this.resultsContainer.classList.remove('hidden');
    }

    showError() {
        if (!this.resultsContainer) {
            console.error('[ProductSearch] No results container available');
            return;
        }
        
        this.resultsContainer.innerHTML = `
            <div class="search-error">
                Search failed. Please try again.
            </div>
        `;
        this.resultsContainer.classList.remove('hidden');
    }

    hideResults() {
        if (!this.resultsContainer) {
            return;
        }
        
        this.resultsContainer.classList.add('hidden');
        this.results = [];
        this.selectedIndex = -1;
    }

    navigateResults(direction) {
        if (this.results.length === 0) return;
        
        this.selectedIndex += direction;
        
        // Wrap around
        if (this.selectedIndex < 0) {
            this.selectedIndex = this.results.length - 1;
        } else if (this.selectedIndex >= this.results.length) {
            this.selectedIndex = 0;
        }
        
        this.updateSelection();
    }

    updateSelection() {
        if (!this.resultsContainer) return;
        
        const items = this.resultsContainer.querySelectorAll('.search-result-item');
        items.forEach((item, index) => {
            item.classList.toggle('selected', index === this.selectedIndex);
        });
    }

    selectResult() {
        if (this.selectedIndex >= 0 && this.selectedIndex < this.results.length) {
            const result = this.results[this.selectedIndex];
            this.selectProduct(result.value);
        } else if (this.input.value.trim()) {
            // Try to select exact match
            this.selectProduct(this.input.value.trim());
        }
    }

    selectProduct(styleNumber) {
        // Update input
        this.input.value = styleNumber;
        
        // Hide results
        this.hideResults();
        
        // Save to recent searches
        this.saveRecentSearch(styleNumber);
        
        // Trigger callback
        if (this.onProductSelect) {
            this.onProductSelect(styleNumber);
        }
    }

    saveRecentSearch(styleNumber) {
        // Remove if already exists
        this.recentSearches = this.recentSearches.filter(s => s !== styleNumber);
        
        // Add to beginning
        this.recentSearches.unshift(styleNumber);
        
        // Keep only last 5
        this.recentSearches = this.recentSearches.slice(0, 5);
        
        // Save to localStorage
        try {
            localStorage.setItem('recentProductSearches', JSON.stringify(this.recentSearches));
        } catch (e) {
            console.error('Failed to save recent searches:', e);
        }
    }

    loadRecentSearches() {
        try {
            const saved = localStorage.getItem('recentProductSearches');
            return saved ? JSON.parse(saved) : [];
        } catch (e) {
            return [];
        }
    }
}