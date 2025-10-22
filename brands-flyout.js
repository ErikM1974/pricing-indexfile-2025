/**
 * Brands Flyout Menu
 * Displays top brands in navigation dropdown with links to brand-filtered search
 * @version 1.0.0
 */

class BrandsFlyout {
    constructor() {
        this.apiBase = 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';
        this.brandsContainer = document.getElementById('navBrandsGrid');
        this.allBrands = [];
        this.maxBrandsToShow = 30;

        console.log('[BrandsFlyout] Initializing brands flyout menu...');
        this.init();
    }

    init() {
        if (!this.brandsContainer) {
            console.warn('[BrandsFlyout] Brands container not found, skipping initialization');
            return;
        }

        // Load brands on page load
        this.loadBrands();
    }

    /**
     * Fetch brands from API
     */
    async loadBrands() {
        try {
            console.log('[BrandsFlyout] Fetching brands from API...');

            const response = await fetch(`${this.apiBase}/api/all-brands`);

            if (!response.ok) {
                throw new Error(`API request failed: ${response.status}`);
            }

            const data = await response.json();
            console.log('[BrandsFlyout] API response:', data);

            // Handle different response formats
            this.allBrands = data.brands || data.data?.brands || data;

            if (!Array.isArray(this.allBrands)) {
                throw new Error('Invalid brands data format');
            }

            // Sort brands alphabetically
            this.allBrands.sort((a, b) => {
                // Extract brand name using same defensive logic
                const getNameString = (brand) => {
                    if (typeof brand === 'string') return brand;
                    if (typeof brand === 'object' && brand !== null) {
                        return brand.name || brand.BrandName || brand.brand || brand.Brand || JSON.stringify(brand);
                    }
                    return String(brand);
                };

                const nameA = getNameString(a).toString().toUpperCase();
                const nameB = getNameString(b).toString().toUpperCase();
                return nameA.localeCompare(nameB);
            });

            console.log(`[BrandsFlyout] Loaded ${this.allBrands.length} brands`);

            // Display brands in flyout
            this.displayBrands();

        } catch (error) {
            console.error('[BrandsFlyout] Error loading brands:', error);
            this.showError();
        }
    }

    /**
     * Display brands in the flyout menu
     */
    displayBrands() {
        if (!this.allBrands || this.allBrands.length === 0) {
            this.showError('No brands available');
            return;
        }

        // Take top N brands
        const brandsToShow = this.allBrands.slice(0, this.maxBrandsToShow);

        // Generate brand links HTML
        const brandsHTML = brandsToShow.map(brand => {
            // Handle multiple API response formats defensively
            let brandName;

            if (typeof brand === 'string') {
                // Simple string format: "Carhartt"
                brandName = brand;
            } else if (typeof brand === 'object' && brand !== null) {
                // Object format: try multiple possible property names
                brandName = brand.name || brand.BrandName || brand.brand || brand.Brand;

                // If still an object, convert to string (shouldn't happen but defensive)
                if (typeof brandName === 'object') {
                    brandName = JSON.stringify(brand);
                    console.warn('[BrandsFlyout] Unexpected brand object format:', brand);
                }
            } else {
                // Fallback for unexpected types
                brandName = String(brand);
            }

            return this.createBrandLink(brandName);
        }).join('');

        // Update container
        this.brandsContainer.innerHTML = brandsHTML;

        console.log(`[BrandsFlyout] Displayed ${brandsToShow.length} brands in flyout`);
    }

    /**
     * Create a brand link element
     */
    createBrandLink(brandName) {
        const encodedBrand = encodeURIComponent(brandName);

        return `
            <a href="/?brand=${encodedBrand}" class="brand-link">
                <span class="brand-link-icon">🏷️</span>
                <span class="brand-link-name">${this.escapeHtml(brandName)}</span>
            </a>
        `;
    }

    /**
     * Show error state
     */
    showError(message = 'Unable to load brands') {
        this.brandsContainer.innerHTML = `
            <div class="brands-error">
                <p>${this.escapeHtml(message)}</p>
                <a href="/brands.html" class="brands-error-link">View all brands →</a>
            </div>
        `;
    }

    /**
     * Escape HTML to prevent XSS
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.brandsFlyout = new BrandsFlyout();
});
