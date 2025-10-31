/**
 * Product Category Filter - Shared Utility
 *
 * Centralized logic for filtering products by category (flat headwear vs structured caps).
 * Used by all quote builders and pricing calculators.
 *
 * Single source of truth for product categorization keywords.
 * To add new keywords, update the arrays below - all calculators will automatically use them.
 *
 * @version 1.0.0
 * @created 2025-10-31
 */

window.ProductCategoryFilter = {
    /**
     * Flat embroidery headwear keywords
     * These products use flat embroidery (not cap embroidery machines)
     */
    flatHeadwearKeywords: [
        'beanie',
        'knit',
        'knit cap',
        'watch cap',
        'winter hat',
        'toboggan'
    ],

    /**
     * Structured cap keywords
     * These products use cap embroidery machines
     */
    structuredCapKeywords: [
        'cap',
        'trucker',
        'snapback',
        'fitted',
        'flexfit',
        'visor',
        'mesh back',
        'dad hat',
        'baseball',
        '5-panel',
        '6-panel'
    ],

    /**
     * Check if product is flat embroidery headwear
     * PRIORITY CHECK - should be checked BEFORE isStructuredCap()
     *
     * @param {Object} product - Product object with label/title/description
     * @returns {boolean} True if flat headwear, false otherwise
     */
    isFlatHeadwear(product) {
        const label = (product.label || product.PRODUCT_TITLE || product.value || '').toLowerCase();
        const description = (product.PRODUCT_DESCRIPTION || product.Description || '').toLowerCase();

        return this.flatHeadwearKeywords.some(keyword =>
            label.includes(keyword) || description.includes(keyword)
        );
    },

    /**
     * Check if product is a structured cap
     * Should be checked AFTER isFlatHeadwear() to avoid false positives
     *
     * @param {Object} product - Product object with label/title/description
     * @returns {boolean} True if structured cap, false otherwise
     */
    isStructuredCap(product) {
        // Priority check: exclude flat headwear first
        if (this.isFlatHeadwear(product)) {
            return false;
        }

        const label = (product.label || product.PRODUCT_TITLE || product.value || '').toLowerCase();
        const description = (product.PRODUCT_DESCRIPTION || product.Description || '').toLowerCase();

        return this.structuredCapKeywords.some(keyword =>
            label.includes(keyword) || description.includes(keyword)
        );
    },

    /**
     * Get product category
     * @param {Object} product - Product object
     * @returns {string} 'flat_headwear', 'structured_cap', or 'other'
     */
    getCategory(product) {
        if (this.isFlatHeadwear(product)) {
            return 'flat_headwear';
        }
        if (this.isStructuredCap(product)) {
            return 'structured_cap';
        }
        return 'other';
    },

    /**
     * Get all keywords for debugging
     * @returns {Object} All keyword arrays
     */
    getKeywords() {
        return {
            flatHeadwear: this.flatHeadwearKeywords,
            structuredCap: this.structuredCapKeywords
        };
    }
};

console.log('[ProductCategoryFilter] Utility loaded - Single source of truth for product filtering');
