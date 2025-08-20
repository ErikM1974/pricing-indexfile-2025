/**
 * Enhanced Smart Autocomplete Module
 * Clean text-based dropdown with direct navigation to product pages
 * @version 3.1.0
 */

class SmartAutocomplete {
    constructor() {
        this.searchInput = document.getElementById('navSearchInput');
        this.autocompleteContainer = document.getElementById('navAutocompleteList');
        this.searchService = window.ProductSearchService ? new ProductSearchService() : null;
        
        this.currentQuery = '';
        this.selectedIndex = -1;
        this.suggestions = [];
        this.searchTimeout = null;
        this.isLoading = false;
        this.preventHide = false; // Prevent dropdown from disappearing
        
        if (this.searchInput && this.searchService) {
            this.init();
        }
    }
    
    init() {
        console.log('[SmartAutocomplete] Initializing v3.0...');
        
        // Set up event listeners
        this.searchInput.addEventListener('input', this.handleInput.bind(this));
        this.searchInput.addEventListener('keydown', this.handleKeydown.bind(this));
        this.searchInput.addEventListener('focus', this.handleFocus.bind(this));
        this.searchInput.addEventListener('blur', this.handleBlur.bind(this));
        
        // Click outside to close
        document.addEventListener('click', (e) => {
            if (!this.searchInput.contains(e.target) && 
                !this.autocompleteContainer.contains(e.target)) {
                this.hideAutocomplete();
            }
        });
    }
    
    handleInput(e) {
        const query = e.target.value.trim();
        
        // Clear previous timeout
        clearTimeout(this.searchTimeout);
        
        // Reset selection
        this.selectedIndex = -1;
        this.currentQuery = query;
        
        if (query.length < 2) {
            this.hideAutocomplete();
            return;
        }
        
        // Show loading immediately
        this.showLoading();
        
        // Debounce the actual search (increased to prevent flashing)
        this.searchTimeout = setTimeout(() => {
            this.fetchSuggestions(query);
        }, 300); // Increased debounce time
    }
    
    handleKeydown(e) {
        if (!this.autocompleteContainer.classList.contains('active')) {
            // Only process Enter key if dropdown is not visible
            if (e.key === 'Enter' && this.currentQuery.length >= 2) {
                // Perform full search when Enter is pressed without dropdown
                e.preventDefault();
                this.performFullSearch();
            }
            return;
        }
        
        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                this.navigateSuggestions(1);
                break;
            case 'ArrowUp':
                e.preventDefault();
                this.navigateSuggestions(-1);
                break;
            case 'Enter':
                e.preventDefault();
                if (this.selectedIndex >= 0) {
                    this.selectSuggestion(this.selectedIndex);
                } else {
                    // Perform full search if no suggestion selected
                    this.performFullSearch();
                }
                break;
            case 'Escape':
                this.hideAutocomplete();
                break;
        }
    }
    
    handleFocus() {
        if (this.currentQuery.length >= 2 && this.suggestions.length > 0) {
            this.showAutocomplete();
        }
    }
    
    handleBlur() {
        // Only hide if we're not preventing it (e.g., during click)
        if (!this.preventHide) {
            setTimeout(() => {
                if (!this.preventHide) {
                    this.hideAutocomplete();
                }
            }, 200);
        }
    }
    
    async fetchSuggestions(query) {
        // Don't fetch if query changed during loading
        if (this.currentQuery !== query) {
            return;
        }
        
        this.isLoading = true;
        
        try {
            // Check if it looks like a style number
            const isStyle = this.searchService.isStyleNumber(query);
            console.log(`[SmartAutocomplete] Fetching suggestions for "${query}" - isStyle: ${isStyle}`);
            
            let suggestions = [];
            const seenStyles = new Set(); // Track styles we've already added
            
            // Store the query we're searching for (in case it changes during async operations)
            const searchQuery = query;
            
            // If it's a style search, FIRST try the autocomplete endpoint for exact matches
            if (isStyle) {
                try {
                    const response = await fetch(`/api/stylesearch?term=${encodeURIComponent(query)}`);
                    if (response.ok) {
                        const autocompleteSuggestions = await response.json();
                        
                        // Add style search results first with highest priority
                        autocompleteSuggestions.forEach(item => {
                            const upperValue = item.value.toUpperCase();
                            const upperQuery = query.toUpperCase();
                            
                            // Check if this is an exact match
                            const isExactMatch = upperValue === upperQuery;
                            const startsWithQuery = upperValue.startsWith(upperQuery);
                            const containsQuery = upperValue.includes(upperQuery);
                            
                            // Priority system:
                            // 0 = Exact match (PC61 === PC61)
                            // 1 = Starts with query (PC61LS starts with PC61)
                            // 2 = Contains query but doesn't start with it (LPC61 contains PC61)
                            // 3 = Other matches
                            let priority;
                            if (isExactMatch) {
                                priority = 0; // PC61 when searching for PC61
                            } else if (startsWithQuery) {
                                priority = 1; // PC61LS, PC61P when searching for PC61
                            } else if (containsQuery) {
                                priority = 2; // LPC61 when searching for PC61
                            } else {
                                priority = 3; // Other fuzzy matches
                            }
                            
                            suggestions.push({
                                type: 'style',
                                styleNumber: item.value,
                                productName: item.label,
                                displayPrice: 'View Details',
                                colors: [],
                                priority: priority
                            });
                            seenStyles.add(upperValue);
                        });
                    }
                } catch (error) {
                    console.error('[SmartAutocomplete] Style search error:', error);
                }
            }
            
            // Then get product data with images (but don't let it overwrite our exact matches)
            try {
                const results = await this.searchService.searchProducts({
                    q: query,
                    limit: 10,
                    status: 'Active'
                });
                
                if (results.products) {
                    results.products.forEach(product => {
                        const upperStyle = product.styleNumber.toUpperCase();
                        
                        // Check if we already have this style from the style search
                        const existingIndex = suggestions.findIndex(s => 
                            s.styleNumber.toUpperCase() === upperStyle
                        );
                        
                        if (existingIndex >= 0) {
                            // Update the existing entry with better data
                            suggestions[existingIndex].colors = product.colors || [];
                            suggestions[existingIndex].displayPrice = product.displayPrice || 'View Details';
                            // Keep the original priority if it's better
                            if (suggestions[existingIndex].priority > 2) {
                                suggestions[existingIndex].priority = 
                                    upperStyle === query.toUpperCase() ? 0 :
                                    upperStyle.startsWith(query.toUpperCase()) ? 1 : 2;
                            }
                        } else if (!seenStyles.has(upperStyle)) {
                            // Add new product if we haven't seen it
                            const isExactMatch = upperStyle === query.toUpperCase();
                            const startsWithQuery = upperStyle.startsWith(query.toUpperCase());
                            
                            suggestions.push({
                                type: isStyle && (isExactMatch || startsWithQuery) ? 'style' : 'product',
                                styleNumber: product.styleNumber,
                                productName: product.productName,
                                displayPrice: product.displayPrice || 'View Details',
                                colors: product.colors || [],
                                priority: isExactMatch ? 0 : startsWithQuery ? 1 : 3
                            });
                            seenStyles.add(upperStyle);
                        }
                    });
                }
            } catch (error) {
                console.error('[SmartAutocomplete] Product search error:', error);
            }
            
            // Sort by priority (lower number = higher priority)
            // PC61 exact match should always be first
            suggestions.sort((a, b) => {
                // First sort by priority
                if (a.priority !== b.priority) {
                    return a.priority - b.priority;
                }
                // Then alphabetically by style number
                return a.styleNumber.localeCompare(b.styleNumber);
            });
            
            // Limit to top 8 results
            this.suggestions = suggestions.slice(0, 8);
            
            // Only update display if the query hasn't changed (double-check with searchQuery)
            if (this.currentQuery === query && this.currentQuery === searchQuery) {
                console.log(`[SmartAutocomplete] Displaying ${this.suggestions.length} suggestions for "${query}"`);
                // Log if PC61 is in the results when searching for PC61
                if (query.toUpperCase() === 'PC61') {
                    const pc61Index = this.suggestions.findIndex(s => s.styleNumber === 'PC61');
                    if (pc61Index >= 0) {
                        console.log(`[SmartAutocomplete] ✅ PC61 found at position ${pc61Index + 1} with priority ${this.suggestions[pc61Index].priority}`);
                    }
                }
                this.displaySuggestions();
            } else {
                console.log(`[SmartAutocomplete] Query changed, not updating display (was: "${searchQuery}", now: "${this.currentQuery}")`);
            }
            
        } catch (error) {
            console.error('[SmartAutocomplete] Error fetching suggestions:', error);
            this.showError();
        } finally {
            this.isLoading = false;
        }
    }
    
    displaySuggestions() {
        if (this.suggestions.length === 0) {
            this.showNoResults();
            return;
        }
        
        let html = '<div class="autocomplete-suggestions">';
        
        this.suggestions.forEach((suggestion, index) => {
            const isSelected = index === this.selectedIndex;
            const typeClass = suggestion.type === 'style' ? 'suggestion-style' : 'suggestion-product';
            const colorCount = suggestion.colors.length;
            
            html += `
                <div class="autocomplete-item no-image ${typeClass} ${isSelected ? 'selected' : ''}" 
                     data-index="${index}"
                     data-style="${suggestion.styleNumber}">
                    <div class="suggestion-details-full">
                        <div class="suggestion-style-number">${suggestion.styleNumber}
                            ${suggestion.type === 'style' && suggestion.priority === 0 ? '<span class="suggestion-badge">EXACT MATCH</span>' : ''}
                        </div>
                        <div class="suggestion-product-name">${suggestion.productName}</div>
                        ${colorCount > 1 ? `<div class="suggestion-colors">${colorCount} colors available</div>` : ''}
                    </div>
                    <div class="suggestion-price">${suggestion.displayPrice}</div>
                </div>
            `;
        });
        
        html += '</div>';
        
        // Add "Press Enter for all results" hint
        html += `
            <div class="autocomplete-footer">
                Press <kbd>Enter</kbd> to see all results or <kbd>Esc</kbd> to close
            </div>
        `;
        
        this.autocompleteContainer.innerHTML = html;
        this.showAutocomplete();
        
        // Add click handlers
        this.autocompleteContainer.querySelectorAll('.autocomplete-item').forEach((item, index) => {
            item.addEventListener('mousedown', (e) => {
                // Use mousedown instead of click to fire before blur
                e.preventDefault(); // Prevent blur
                this.preventHide = true;
                this.selectSuggestion(index);
            });
            
            item.addEventListener('mouseenter', () => {
                this.selectedIndex = index;
                this.updateSelection();
            });
        });
    }
    
    navigateSuggestions(direction) {
        if (this.suggestions.length === 0) return;
        
        this.selectedIndex += direction;
        
        // Wrap around
        if (this.selectedIndex < 0) {
            this.selectedIndex = this.suggestions.length - 1;
        } else if (this.selectedIndex >= this.suggestions.length) {
            this.selectedIndex = 0;
        }
        
        this.updateSelection();
    }
    
    updateSelection() {
        const items = this.autocompleteContainer.querySelectorAll('.autocomplete-item');
        items.forEach((item, index) => {
            item.classList.toggle('selected', index === this.selectedIndex);
        });
    }
    
    selectSuggestion(index) {
        if (index < 0 || index >= this.suggestions.length) return;
        
        const suggestion = this.suggestions[index];
        
        // Hide autocomplete
        this.hideAutocomplete();
        
        // Clear the search input
        this.searchInput.value = '';
        
        // Navigate DIRECTLY to product page - no intermediate search!
        window.location.href = `/product.html?style=${encodeURIComponent(suggestion.styleNumber)}`;
    }
    
    performFullSearch() {
        // This is when user presses Enter to see all search results
        if (this.currentQuery && window.catalogSearch) {
            this.hideAutocomplete();
            window.catalogSearch.currentFilters.q = this.currentQuery;
            window.catalogSearch.currentFilters.page = 1;
            window.catalogSearch.performSearch();
        }
    }
    
    showLoading() {
        this.autocompleteContainer.innerHTML = `
            <div class="autocomplete-loading">
                <span class="loading-spinner"></span>
                <span>Searching...</span>
            </div>
        `;
        this.showAutocomplete();
    }
    
    showNoResults() {
        this.autocompleteContainer.innerHTML = `
            <div class="autocomplete-no-results">
                No products found for "${this.currentQuery}"
                <div class="autocomplete-footer">
                    Press <kbd>Enter</kbd> to search anyway
                </div>
            </div>
        `;
        this.showAutocomplete();
    }
    
    showError() {
        this.autocompleteContainer.innerHTML = `
            <div class="autocomplete-error">
                Search error. Please try again.
            </div>
        `;
        this.showAutocomplete();
    }
    
    showAutocomplete() {
        this.autocompleteContainer.classList.add('active');
    }
    
    hideAutocomplete() {
        this.autocompleteContainer.classList.remove('active');
        this.selectedIndex = -1;
        this.preventHide = false; // Reset the flag
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // Only initialize if ProductSearchService is available
    if (window.ProductSearchService) {
        window.smartAutocomplete = new SmartAutocomplete();
        console.log('[SmartAutocomplete] v3.1 Initialized - Clean text dropdown with direct navigation');
    }
});