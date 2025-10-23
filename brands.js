/**
 * Brands Browse Page
 * Displays all available brands in an alphabetical grid
 * @version 2.0.0
 *
 * Update 2.0.0: Added brand logo support from API, fixed property access for new API format
 */

class BrandsPage {
    constructor() {
        this.apiBase = 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api';
        this.allBrands = [];
        this.filteredBrands = [];

        this.init();
    }

    async init() {
        console.log('[BrandsPage] Initializing...');

        // Set up search input
        this.setupSearch();

        // Load brands
        await this.loadBrands();

        // Set up mobile menu if it exists
        this.setupMobileMenu();
    }

    setupSearch() {
        const searchInput = document.getElementById('brandSearchInput');
        if (!searchInput) return;

        let searchTimeout;
        searchInput.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                this.filterBrands(e.target.value);
            }, 300);
        });
    }

    async loadBrands() {
        const loadingState = document.getElementById('loadingState');
        const errorState = document.getElementById('errorState');
        const container = document.getElementById('brandsContainer');

        try {
            console.log('[BrandsPage] Fetching brands from API...');

            const response = await fetch(`${this.apiBase}/all-brands`);

            if (!response.ok) {
                throw new Error(`API error: ${response.status}`);
            }

            const data = await response.json();
            console.log('[BrandsPage] API response:', data);

            // Extract brands array from response
            this.allBrands = data.brands || data.data?.brands || data;

            // If brands is not an array, try to convert
            if (!Array.isArray(this.allBrands)) {
                console.error('[BrandsPage] Brands data is not an array:', this.allBrands);
                throw new Error('Invalid brands data format');
            }

            // Get product counts for each brand
            await this.enrichBrandsWithCounts();

            // Sort alphabetically
            this.allBrands.sort((a, b) => {
                const nameA = (a.brand || a.name || a).toString().toUpperCase();
                const nameB = (b.brand || b.name || b).toString().toUpperCase();
                return nameA.localeCompare(nameB);
            });

            console.log(`[BrandsPage] Loaded ${this.allBrands.length} brands`);

            this.filteredBrands = [...this.allBrands];
            this.displayBrands();

            // Hide loading, show container
            loadingState.style.display = 'none';
            container.style.display = 'block';

        } catch (error) {
            console.error('[BrandsPage] Error loading brands:', error);
            loadingState.style.display = 'none';
            errorState.style.display = 'block';
        }
    }

    async enrichBrandsWithCounts() {
        // For each brand, try to get product count from a quick search
        console.log('[BrandsPage] Enriching brands with product counts...');

        const enrichPromises = this.allBrands.map(async (brand) => {
            const brandName = brand.brand || brand.name || brand;

            try {
                // Quick search to get count
                const response = await fetch(`${this.apiBase}/products/search?brand=${encodeURIComponent(brandName)}&limit=1&includeFacets=true`);
                const data = await response.json();

                if (data.success && data.data) {
                    const count = data.data.pagination?.total || 0;

                    // Update brand object
                    if (typeof brand === 'string') {
                        // Convert string to object
                        return { name: brand, productCount: count };
                    } else {
                        brand.productCount = count;
                        return brand;
                    }
                }
            } catch (error) {
                console.warn(`[BrandsPage] Could not get count for ${brandName}`);
            }

            // Return as-is if enrichment failed
            return typeof brand === 'string' ? { name: brand, productCount: 0 } : brand;
        });

        this.allBrands = await Promise.all(enrichPromises);
    }

    filterBrands(searchTerm) {
        const term = searchTerm.toLowerCase().trim();

        if (!term) {
            this.filteredBrands = [...this.allBrands];
        } else {
            this.filteredBrands = this.allBrands.filter(brand => {
                const name = (brand.brand || brand.name || brand).toString().toLowerCase();
                return name.includes(term);
            });
        }

        this.displayBrands();
    }

    displayBrands() {
        const container = document.getElementById('brandsContainer');
        if (!container) return;

        if (this.filteredBrands.length === 0) {
            container.innerHTML = `
                <div class="no-brands">
                    <p>No brands found matching your search.</p>
                </div>
            `;
            return;
        }

        // Group brands alphabetically
        const grouped = this.groupByLetter(this.filteredBrands);

        let html = '';

        Object.keys(grouped).sort().forEach(letter => {
            const brands = grouped[letter];

            html += `
                <div class="brand-letter-section">
                    <h2 class="brand-letter-header">${letter}</h2>
                    <div class="brand-grid">
                        ${brands.map(brand => this.createBrandCard(brand)).join('')}
                    </div>
                </div>
            `;
        });

        container.innerHTML = html;

        // Add click handlers
        this.attachClickHandlers();
    }

    groupByLetter(brands) {
        const grouped = {};

        brands.forEach(brand => {
            const name = (brand.brand || brand.name || brand).toString();
            const firstLetter = name.charAt(0).toUpperCase();

            if (!grouped[firstLetter]) {
                grouped[firstLetter] = [];
            }

            grouped[firstLetter].push(brand);
        });

        return grouped;
    }

    createBrandCard(brand) {
        const name = brand.brand || brand.name || brand;
        const logo = brand.logo || '';
        const count = brand.productCount || 0;
        const encodedName = encodeURIComponent(name);

        // Create logo HTML with fallback
        let logoHtml = '';
        if (logo) {
            logoHtml = `
                <img src="${this.escapeHtml(logo)}"
                     alt="${this.escapeHtml(name)} logo"
                     class="brand-card-logo"
                     onerror="this.style.display='none';">
            `;
        }

        return `
            <div class="brand-card" data-brand="${encodedName}">
                ${logoHtml}
                <div class="brand-card-content">
                    <h3 class="brand-name">${this.escapeHtml(name)}</h3>
                    ${count > 0 ? `<p class="brand-count">${count} ${count === 1 ? 'product' : 'products'}</p>` : ''}
                </div>
                <div class="brand-card-arrow">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M5 12h14M12 5l7 7-7 7"/>
                    </svg>
                </div>
            </div>
        `;
    }

    attachClickHandlers() {
        document.querySelectorAll('.brand-card').forEach(card => {
            card.addEventListener('click', () => {
                const brandName = decodeURIComponent(card.dataset.brand);
                this.navigateToBrand(brandName);
            });
        });
    }

    navigateToBrand(brandName) {
        console.log('[BrandsPage] Navigating to brand:', brandName);
        // Navigate to main catalog with brand filter applied
        window.location.href = `/?brand=${encodeURIComponent(brandName)}`;
    }

    setupMobileMenu() {
        const mobileBtn = document.getElementById('mobileMenuBtn');
        if (!mobileBtn) return;

        mobileBtn.addEventListener('click', () => {
            // Toggle mobile menu if it exists
            const nav = document.querySelector('.top-navigation');
            if (nav) {
                nav.classList.toggle('active');
            }
        });
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.brandsPage = new BrandsPage();
});
