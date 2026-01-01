/**
 * Smart Product Recommendation Service
 * Provides API-driven, fresh product recommendations with variety and relevance
 *
 * Features:
 * - Hybrid algorithm (related products → category-based fallback)
 * - Best seller prioritization
 * - Variety through shuffling
 * - Session tracking (prevents showing same products repeatedly)
 * - Zero hardcoding (all data from API)
 */

class ProductRecommendationService {
    constructor() {
        this.apiBase = window.location.origin;
        this.maxRecommendations = 4;
        this.recentlyViewedKey = 'product_recently_viewed';

        console.log('[ProductRecommendations] Service initialized');
    }

    /**
     * Get smart product recommendations for a given product
     *
     * @param {Object} currentProduct - Current product object
     * @param {string} currentProduct.style - Product style number (e.g., "PC54")
     * @param {string} currentProduct.category - Product category (e.g., "T-Shirts")
     * @param {string} currentProduct.brand - Product brand (e.g., "Port & Company")
     * @returns {Promise<Array>} Array of recommended products
     */
    async getRecommendations(currentProduct) {
        try {
            console.log('[ProductRecommendations] Getting recommendations for:', currentProduct.style);

            // Track current product as viewed
            this.trackViewed(currentProduct.style);

            // Try related products endpoint first (pre-calculated relationships)
            try {
                const relatedProducts = await this.getRelatedProducts(currentProduct.style);
                if (relatedProducts && relatedProducts.length >= this.maxRecommendations) {
                    console.log('[ProductRecommendations] Using related products:', relatedProducts.length);
                    return this.filterAndLimit(relatedProducts, currentProduct.style);
                }
            } catch (error) {
                console.warn('[ProductRecommendations] Related products failed:', error.message);
            }

            // Fallback to category-based recommendations
            console.log('[ProductRecommendations] Falling back to category-based recommendations');
            return await this.getCategoryBasedRecommendations(currentProduct);

        } catch (error) {
            console.error('[ProductRecommendations] Error getting recommendations:', error);
            // Return empty array on complete failure
            return [];
        }
    }

    /**
     * Get related products from API (if endpoint exists and has data)
     *
     * @param {string} styleNumber - Product style number
     * @returns {Promise<Array>} Related products
     */
    async getRelatedProducts(styleNumber) {
        const url = `${this.apiBase}/api/related-products?styleNumber=${encodeURIComponent(styleNumber)}`;
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`Related products API returned ${response.status}`);
        }

        const data = await response.json();
        return Array.isArray(data) ? data : [];
    }

    /**
     * Get category-based recommendations with best seller priority
     *
     * @param {Object} currentProduct - Current product
     * @returns {Promise<Array>} Recommended products
     */
    async getCategoryBasedRecommendations(currentProduct) {
        // Fetch products from same category
        const url = `${this.apiBase}/api/products/search?` + new URLSearchParams({
            category: currentProduct.category,
            status: '',
            limit: 20  // Get more than needed for variety
        });

        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Category search returned ${response.status}`);
        }

        const data = await response.json();
        let candidates = data.products || data || [];

        // Filter out current product
        candidates = candidates.filter(p => p.style !== currentProduct.style);

        // Filter out recently viewed products (for variety)
        const recentlyViewed = this.getRecentlyViewed();
        candidates = candidates.filter(p => !recentlyViewed.includes(p.style));

        if (candidates.length === 0) {
            console.warn('[ProductRecommendations] No candidates found after filtering');
            return [];
        }

        // Split into best sellers and others
        const bestSellers = candidates.filter(p => p.isBestSeller === true || p.isBestSeller === 'true');
        const others = candidates.filter(p => p.isBestSeller !== true && p.isBestSeller !== 'true');

        // Shuffle for variety
        const shuffledBestSellers = this.shuffleArray(bestSellers);
        const shuffledOthers = this.shuffleArray(others);

        // Mix: 2 best sellers + 2 others (or best available mix)
        const recommendations = [];

        // Add up to 2 best sellers
        recommendations.push(...shuffledBestSellers.slice(0, 2));

        // Fill remaining slots with others
        const remaining = this.maxRecommendations - recommendations.length;
        recommendations.push(...shuffledOthers.slice(0, remaining));

        // If still not enough, add more best sellers
        if (recommendations.length < this.maxRecommendations) {
            const needed = this.maxRecommendations - recommendations.length;
            recommendations.push(...shuffledBestSellers.slice(2, 2 + needed));
        }

        console.log('[ProductRecommendations] Category-based:', {
            total: candidates.length,
            bestSellers: bestSellers.length,
            others: others.length,
            selected: recommendations.length
        });

        return recommendations.slice(0, this.maxRecommendations);
    }

    /**
     * Filter and limit recommendations
     *
     * @param {Array} products - Product array
     * @param {string} currentStyle - Current product style to exclude
     * @returns {Array} Filtered and limited products
     */
    filterAndLimit(products, currentStyle) {
        const recentlyViewed = this.getRecentlyViewed();

        return products
            .filter(p => p.style !== currentStyle)
            .filter(p => !recentlyViewed.includes(p.style))
            .slice(0, this.maxRecommendations);
    }

    /**
     * Shuffle array for variety
     *
     * @param {Array} array - Array to shuffle
     * @returns {Array} Shuffled array
     */
    shuffleArray(array) {
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }

    /**
     * Track viewed product in session storage
     *
     * @param {string} styleNumber - Product style number
     */
    trackViewed(styleNumber) {
        const viewed = this.getRecentlyViewed();

        // Add to beginning of array
        viewed.unshift(styleNumber);

        // Keep only last 10 viewed products
        const limited = viewed.slice(0, 10);

        sessionStorage.setItem(this.recentlyViewedKey, JSON.stringify(limited));
    }

    /**
     * Get recently viewed products from session storage
     *
     * @returns {Array<string>} Array of style numbers
     */
    getRecentlyViewed() {
        try {
            const data = sessionStorage.getItem(this.recentlyViewedKey);
            return data ? JSON.parse(data) : [];
        } catch (error) {
            console.warn('[ProductRecommendations] Error reading recently viewed:', error);
            return [];
        }
    }

    /**
     * Clear recently viewed products (for testing)
     */
    clearRecentlyViewed() {
        sessionStorage.removeItem(this.recentlyViewedKey);
        console.log('[ProductRecommendations] Recently viewed cleared');
    }

    /**
     * Get service status (for debugging)
     *
     * @returns {Object} Service status
     */
    getStatus() {
        return {
            service: 'ProductRecommendationService',
            maxRecommendations: this.maxRecommendations,
            recentlyViewed: this.getRecentlyViewed(),
            apiBase: this.apiBase
        };
    }
}

// Initialize global instance
if (typeof window !== 'undefined') {
    window.productRecommendations = new ProductRecommendationService();
    console.log('[ProductRecommendations] Service globally available as window.productRecommendations');
}
