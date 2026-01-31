/**
 * Exact Match Search Module
 * Optimized for sales reps who know exact style numbers
 *
 * Features:
 * - Auto-loads exact matches instantly
 * - Smart sorting (exact → starts with → contains)
 * - Debounced API calls
 * - Case-insensitive matching
 * - Full keyboard navigation (↑↓⏎⎚)
 *
 * Usage:
 *   const searcher = new ExactMatchSearch({
 *       apiBase: 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api',
 *       onExactMatch: (product) => { ... },
 *       onSuggestions: (products) => { ... },
 *       onSelect: (product) => { ... },           // Called when item is selected via keyboard
 *       onNavigate: (index, products) => { ... }, // Called when selection changes
 *       onClose: () => { ... }                    // Called when dropdown should close
 *   });
 *   searcher.search('PC61');
 *
 *   // Keyboard handling (wire to keydown event):
 *   searchInput.addEventListener('keydown', (e) => searcher.handleKeyDown(e));
 */

class ExactMatchSearch {
    constructor(config = {}) {
        this.apiBase = config.apiBase || 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';
        this.onExactMatch = config.onExactMatch || null; // Callback for exact matches
        this.onSuggestions = config.onSuggestions || null; // Callback for suggestion list
        this.onError = config.onError || null; // Callback for errors
        this.filterFunction = config.filterFunction || null; // Optional product filter
        this.onFilteredOut = config.onFilteredOut || null; // Callback for filtered items (e.g., wrong product type)

        // NEW: Keyboard navigation callbacks
        this.onSelect = config.onSelect || null; // Called when item selected via Enter key
        this.onNavigate = config.onNavigate || null; // Called when selection changes (for visual highlight)
        this.onClose = config.onClose || null; // Called when Escape pressed

        // Keyboard navigation state
        this.selectedIndex = -1;
        this.currentResults = [];

        // Cache recent searches (2 minutes)
        this.cache = new Map();
        this.cacheTimeout = 120000; // 2 minutes

        // Debounce timing
        this.debounceMs = config.debounceMs || 300;
        this.debounceTimer = null;

        console.log('[ExactMatchSearch] Initialized with keyboard navigation');
    }

    /**
     * Main search function with debouncing
     */
    search(query) {
        // Clear previous timer
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }

        // Normalize query
        query = this.normalizeQuery(query);

        // Require at least 2 characters
        if (!query || query.length < 2) {
            if (this.onSuggestions) {
                this.onSuggestions([]);
            }
            return;
        }

        // Debounce the search
        this.debounceTimer = setTimeout(() => {
            this.executeSearch(query);
        }, this.debounceMs);
    }

    /**
     * Immediate search (no debounce) - use for Enter key, etc.
     */
    searchImmediate(query) {
        query = this.normalizeQuery(query);
        if (!query || query.length < 2) return;

        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }

        this.executeSearch(query);
    }

    /**
     * Execute the actual search
     */
    async executeSearch(query) {
        try {
            console.log('[ExactMatchSearch] Searching for:', query);

            // Check cache first
            const cached = this.getCached(query);
            if (cached) {
                console.log('[ExactMatchSearch] Using cached results');
                this.processResults(cached, query);
                return;
            }

            // Fetch from API
            const results = await this.fetchFromAPI(query);

            // Apply optional filter AND track what was filtered out
            let filteredResults = results;
            let filteredOutItems = [];

            if (this.filterFunction) {
                filteredOutItems = results.filter(item => !this.filterFunction(item));
                filteredResults = results.filter(this.filterFunction);
            }

            // Cache the results
            this.setCached(query, filteredResults);

            // Notify about filtered items BEFORE showing dropdown
            if (this.onFilteredOut && filteredOutItems.length > 0 && filteredResults.length === 0) {
                console.log('[ExactMatchSearch] Calling onFilteredOut with', filteredOutItems.length, 'filtered items');
                this.onFilteredOut(filteredOutItems, query);
            }

            // Process and callback
            this.processResults(filteredResults, query);

        } catch (error) {
            console.error('[ExactMatchSearch] Search error:', error);
            if (this.onError) {
                this.onError(error);
            }
        }
    }

    /**
     * Fetch results from API
     */
    async fetchFromAPI(query) {
        const response = await fetch(`${this.apiBase}/api/stylesearch?term=${encodeURIComponent(query)}`);

        if (!response.ok) {
            throw new Error(`Search API failed: ${response.status}`);
        }

        const results = await response.json();
        return Array.isArray(results) ? results : [];
    }

    /**
     * Process results: Check for exact match, then sort suggestions
     */
    processResults(results, query) {
        // Reset keyboard navigation state
        this.selectedIndex = -1;

        if (!results || results.length === 0) {
            this.currentResults = [];
            if (this.onSuggestions) {
                this.onSuggestions([]);
            }
            return;
        }

        const queryUpper = query.toUpperCase();

        // Check for EXACT match
        const exactMatch = results.find(item => {
            const styleNumber = (item.value || '').toUpperCase();
            return styleNumber === queryUpper;
        });

        if (exactMatch) {
            console.log('[ExactMatchSearch] Exact match found:', exactMatch.value);
            this.currentResults = [];

            // Call exact match callback (auto-load product)
            if (this.onExactMatch) {
                this.onExactMatch(exactMatch);
            }

            // Don't show suggestions dropdown for exact matches
            if (this.onSuggestions) {
                this.onSuggestions([]);
            }

            return;
        }

        // No exact match - show sorted suggestions
        const sortedResults = this.sortByRelevance(results, query);

        // Limit to top 10 suggestions (increased from 8)
        const topResults = sortedResults.slice(0, 10);

        // Store for keyboard navigation
        this.currentResults = topResults;

        console.log('[ExactMatchSearch] Showing', topResults.length, 'suggestions');

        if (this.onSuggestions) {
            this.onSuggestions(topResults);
        }
    }

    /**
     * Sort results by relevance
     * Priority: Exact (handled above) → Starts With → Contains
     */
    sortByRelevance(results, query) {
        const queryUpper = query.toUpperCase();

        return results.sort((a, b) => {
            const aValue = (a.value || '').toUpperCase();
            const bValue = (b.value || '').toUpperCase();
            const aLabel = (a.label || '').toUpperCase();
            const bLabel = (b.label || '').toUpperCase();

            // Check if style number starts with query
            const aStartsWith = aValue.startsWith(queryUpper);
            const bStartsWith = bValue.startsWith(queryUpper);

            if (aStartsWith && !bStartsWith) return -1;
            if (!aStartsWith && bStartsWith) return 1;

            // Both start with or neither starts with - sort alphabetically by style number
            if (aStartsWith === bStartsWith) {
                return aValue.localeCompare(bValue);
            }

            // Fallback: Check if query is in the label
            const aContains = aLabel.includes(queryUpper);
            const bContains = bLabel.includes(queryUpper);

            if (aContains && !bContains) return -1;
            if (!aContains && bContains) return 1;

            // Final fallback: alphabetical
            return aValue.localeCompare(bValue);
        });
    }

    /**
     * Normalize search query
     * - Trim whitespace
     * - Convert to uppercase for comparison
     * - Remove extra spaces
     */
    normalizeQuery(query) {
        if (!query) return '';

        return query
            .trim()
            .replace(/\s+/g, '') // Remove all spaces (PC 61 → PC61)
            .toUpperCase();
    }

    /**
     * Cache management
     */
    getCached(query) {
        const cached = this.cache.get(query);
        if (!cached) return null;

        // Check if cache is still valid
        if (Date.now() - cached.timestamp > this.cacheTimeout) {
            this.cache.delete(query);
            return null;
        }

        return cached.results;
    }

    setCached(query, results) {
        this.cache.set(query, {
            results: results,
            timestamp: Date.now()
        });

        // Limit cache size to 50 entries
        if (this.cache.size > 50) {
            const firstKey = this.cache.keys().next().value;
            this.cache.delete(firstKey);
        }
    }

    /**
     * Clear all cached searches
     */
    clearCache() {
        this.cache.clear();
        console.log('[ExactMatchSearch] Cache cleared');
    }

    /**
     * Get cache statistics
     */
    getCacheStats() {
        return {
            size: this.cache.size,
            entries: Array.from(this.cache.keys())
        };
    }

    // ==================== KEYBOARD NAVIGATION ====================

    /**
     * Handle keyboard events for navigation
     * Wire this to your input's keydown event:
     *   searchInput.addEventListener('keydown', (e) => searcher.handleKeyDown(e));
     *
     * @param {KeyboardEvent} event - The keyboard event
     * @returns {boolean} - True if event was handled (caller should preventDefault)
     */
    handleKeyDown(event) {
        const key = event.key;

        // Only handle navigation keys when we have results
        if (this.currentResults.length === 0) {
            // Allow Escape to still trigger close callback
            if (key === 'Escape' && this.onClose) {
                this.onClose();
                return true;
            }
            return false;
        }

        switch (key) {
            case 'ArrowDown':
                event.preventDefault();
                this.navigateDown();
                return true;

            case 'ArrowUp':
                event.preventDefault();
                this.navigateUp();
                return true;

            case 'Enter':
                if (this.selectedIndex >= 0) {
                    event.preventDefault();
                    this.selectCurrent();
                    return true;
                }
                // If nothing selected, let Enter trigger immediate search
                return false;

            case 'Escape':
                event.preventDefault();
                this.closeDropdown();
                return true;

            default:
                // Reset selection on other keys (user is typing)
                if (key.length === 1 || key === 'Backspace' || key === 'Delete') {
                    this.selectedIndex = -1;
                }
                return false;
        }
    }

    /**
     * Navigate selection down (or wrap to top)
     */
    navigateDown() {
        if (this.currentResults.length === 0) return;

        this.selectedIndex++;
        if (this.selectedIndex >= this.currentResults.length) {
            this.selectedIndex = 0; // Wrap to top
        }

        this.notifyNavigate();
    }

    /**
     * Navigate selection up (or wrap to bottom)
     */
    navigateUp() {
        if (this.currentResults.length === 0) return;

        this.selectedIndex--;
        if (this.selectedIndex < 0) {
            this.selectedIndex = this.currentResults.length - 1; // Wrap to bottom
        }

        this.notifyNavigate();
    }

    /**
     * Select the currently highlighted item
     */
    selectCurrent() {
        if (this.selectedIndex < 0 || this.selectedIndex >= this.currentResults.length) {
            return;
        }

        const selectedProduct = this.currentResults[this.selectedIndex];
        console.log('[ExactMatchSearch] Selected via keyboard:', selectedProduct.value);

        // Clear state
        this.currentResults = [];
        this.selectedIndex = -1;

        // Notify selection
        if (this.onSelect) {
            this.onSelect(selectedProduct);
        }
    }

    /**
     * Close the dropdown
     */
    closeDropdown() {
        this.currentResults = [];
        this.selectedIndex = -1;

        if (this.onClose) {
            this.onClose();
        }
    }

    /**
     * Notify about navigation change (for visual highlight update)
     */
    notifyNavigate() {
        if (this.onNavigate) {
            this.onNavigate(this.selectedIndex, this.currentResults);
        }
    }

    /**
     * Get current selection index
     */
    getSelectedIndex() {
        return this.selectedIndex;
    }

    /**
     * Set selection index programmatically
     */
    setSelectedIndex(index) {
        if (index >= -1 && index < this.currentResults.length) {
            this.selectedIndex = index;
            this.notifyNavigate();
        }
    }

    /**
     * Get currently selected product (or null)
     */
    getSelectedProduct() {
        if (this.selectedIndex >= 0 && this.selectedIndex < this.currentResults.length) {
            return this.currentResults[this.selectedIndex];
        }
        return null;
    }

    /**
     * Check if dropdown has results
     */
    hasResults() {
        return this.currentResults.length > 0;
    }

    /**
     * Reset navigation state (call when dropdown is hidden)
     */
    resetNavigation() {
        this.selectedIndex = -1;
        this.currentResults = [];
    }
}

// Make available globally
if (typeof window !== 'undefined') {
    window.ExactMatchSearch = ExactMatchSearch;
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ExactMatchSearch;
}
