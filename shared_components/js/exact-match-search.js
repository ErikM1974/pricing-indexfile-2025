/**
 * Exact Match Search Module
 * Optimized for sales reps who know exact style numbers
 *
 * Features:
 * - Auto-loads exact matches instantly
 * - Smart sorting (exact → starts with → contains)
 * - Debounced API calls
 * - Case-insensitive matching
 *
 * Usage:
 *   const searcher = new ExactMatchSearch({
 *       apiBase: 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api',
 *       onExactMatch: (product) => { ... },
 *       onSuggestions: (products) => { ... }
 *   });
 *   searcher.search('PC61');
 */

class ExactMatchSearch {
    constructor(config = {}) {
        this.apiBase = config.apiBase || 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api';
        this.onExactMatch = config.onExactMatch || null; // Callback for exact matches
        this.onSuggestions = config.onSuggestions || null; // Callback for suggestion list
        this.onError = config.onError || null; // Callback for errors
        this.filterFunction = config.filterFunction || null; // Optional product filter

        // Cache recent searches (2 minutes)
        this.cache = new Map();
        this.cacheTimeout = 120000; // 2 minutes

        // Debounce timing
        this.debounceMs = config.debounceMs || 300;
        this.debounceTimer = null;

        console.log('[ExactMatchSearch] Initialized');
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

            // Apply optional filter (e.g., caps only, no caps)
            let filteredResults = results;
            if (this.filterFunction) {
                filteredResults = results.filter(this.filterFunction);
            }

            // Cache the results
            this.setCached(query, filteredResults);

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
        if (!results || results.length === 0) {
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

        // Limit to top 8 suggestions
        const topResults = sortedResults.slice(0, 8);

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
}

// Make available globally
if (typeof window !== 'undefined') {
    window.ExactMatchSearch = ExactMatchSearch;
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ExactMatchSearch;
}
