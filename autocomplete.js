/**
 * Advanced Autocomplete Module
 * Based on the product page autocomplete functionality
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
        
        // API endpoint
        this.API_URL = 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/stylesearch';
        
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
            
            // Call the API endpoint
            const response = await fetch(`${this.API_URL}?term=${encodeURIComponent(term)}`);
            
            if (!response.ok) {
                throw new Error(`Search failed: ${response.statusText}`);
            }
            
            const results = await response.json();
            this.results = results || [];
            
            if (results.length > 0) {
                this.showResults(results);
            } else {
                this.showNoResults();
            }
        } catch (error) {
            console.error('Search error:', error);
            this.showError();
        }
    }
    
    // Keep this method for potential future use, but it's not needed with the API
    searchLoadedProducts(term) {
        // This method is no longer used since we're using the API
        return [];
    }
    
    showResults(results) {
        let html = '<div class="autocomplete-results-list">';
        
        results.forEach((result, index) => {
            const isSelected = index === this.selectedIndex;
            // Extract style and description from label
            const parts = result.label.split(' - ');
            const styleNumber = result.value;
            const description = parts.length > 1 ? parts.slice(1).join(' - ') : result.label;
            
            html += `
                <div class="autocomplete-result-item ${isSelected ? 'selected' : ''}" 
                     data-index="${index}"
                     data-style="${styleNumber}">
                    <div class="result-content">
                        <div class="result-style">${styleNumber}</div>
                        <div class="result-name">${description}</div>
                    </div>
                </div>
            `;
        });
        
        html += '</div>';
        
        this.resultsList.innerHTML = html;
        this.resultsList.classList.add('show');
        
        // Add click handlers
        this.resultsList.querySelectorAll('.autocomplete-result-item').forEach(item => {
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
        if (this.recentSearches.length === 0) return;
        
        let html = '<div class="autocomplete-results-list">';
        html += '<div class="recent-searches-header">Recent Searches</div>';
        
        this.recentSearches.forEach((style) => {
            html += `
                <div class="autocomplete-result-item recent" 
                     data-style="${style}">
                    <div class="result-style">${style}</div>
                    <div class="result-name">Recent search</div>
                </div>
            `;
        });
        
        html += '</div>';
        
        this.resultsList.innerHTML = html;
        this.resultsList.classList.add('show');
        
        // Add click handlers
        this.resultsList.querySelectorAll('.autocomplete-result-item').forEach(item => {
            item.addEventListener('click', () => {
                const styleNumber = item.dataset.style;
                this.input.value = styleNumber;
                this.search(styleNumber);
            });
        });
    }
    
    showLoading() {
        this.resultsList.innerHTML = `
            <div class="autocomplete-loading">
                Searching products...
            </div>
        `;
        this.resultsList.classList.add('show');
    }
    
    showNoResults() {
        this.resultsList.innerHTML = `
            <div class="autocomplete-no-results">
                <div style="font-size: 1.5rem; margin-bottom: 0.5rem;">🔍</div>
                <div>No products found</div>
                <div style="font-size: 0.8rem; color: #999; margin-top: 0.25rem;">Try a different search term</div>
            </div>
        `;
        this.resultsList.classList.add('show');
    }
    
    showError() {
        this.resultsList.innerHTML = `
            <div class="autocomplete-error">
                Search failed. Please try again.
            </div>
        `;
        this.resultsList.classList.add('show');
    }
    
    hideResults() {
        this.resultsList.classList.remove('show');
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
        const items = this.resultsList.querySelectorAll('.autocomplete-result-item');
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
        if (this.onSelect) {
            this.onSelect(styleNumber);
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

// Export for use
window.AdvancedAutocomplete = AdvancedAutocomplete;