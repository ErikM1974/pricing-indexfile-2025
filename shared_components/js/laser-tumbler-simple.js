/**
 * Laser Tumbler Simple Page
 * Simplified product page for Polar Camel Black 16 oz Pint (LTM752)
 * Uses JDS API for all product data and pricing
 */

class LaserTumblerPage {
    constructor() {
        this.apiService = new JDSApiService();
        this.productSKU = 'LTM752'; // Black 16 oz Polar Camel Pint
        this.product = null;
        this.pricingTiers = null;

        console.log('[LaserTumblerPage] Initialized');
    }

    /**
     * Initialize the page
     */
    async init() {
        try {
            // Show loading state
            this.showLoading();

            // Fetch product data from API
            this.product = await this.apiService.getProduct(this.productSKU);

            // Get pricing tiers
            this.pricingTiers = this.apiService.getPricingTiers(this.product);

            // Populate page content
            this.displayProductInfo();
            this.displayPricingTable();
            this.displayInventory();
            this.displayImages();

            // Hide loading state
            this.hideLoading();

            console.log('[LaserTumblerPage] Page loaded successfully');

        } catch (error) {
            console.error('[LaserTumblerPage] Error loading page:', error);
            this.showError('Unable to load product information. Please refresh the page or contact us at 253-922-5793.');
        }
    }

    /**
     * Display product information
     */
    displayProductInfo() {
        const nameEl = document.getElementById('product-name');
        const descEl = document.getElementById('product-description');

        if (nameEl) {
            nameEl.textContent = this.product.name;
        }

        if (descEl) {
            descEl.textContent = this.product.description;
        }
    }

    /**
     * Display pricing table
     */
    displayPricingTable() {
        const tableBody = document.getElementById('pricing-table-body');
        if (!tableBody) return;

        tableBody.innerHTML = '';

        this.pricingTiers.forEach((tier, index) => {
            const row = document.createElement('tr');

            // Add highlight class to first row (most common order size)
            if (index === 1) {
                row.classList.add('highlight-tier');
            }

            row.innerHTML = `
                <td class="tier-range">
                    <div class="tier-qty">${tier.range}</div>
                    <div class="tier-desc">${tier.description}</div>
                </td>
                <td class="tier-price">
                    <div class="price-large">$${tier.customerPrice.toFixed(2)}</div>
                    <div class="price-small">per unit</div>
                </td>
                <td class="tier-total">
                    <div class="total-price">$${(tier.customerPrice * tier.quantity).toFixed(2)}</div>
                    <div class="total-qty">(${tier.quantity} units)</div>
                </td>
            `;

            tableBody.appendChild(row);
        });
    }

    /**
     * Display inventory status
     */
    displayInventory() {
        const inventoryEl = document.getElementById('inventory-status');
        if (!inventoryEl) return;

        const available = this.product.availableQuantity;
        const local = this.product.localQuantity;

        let statusClass = 'in-stock';
        let statusText = 'In Stock';
        let statusIcon = 'fa-check-circle';

        if (available < 100) {
            statusClass = 'low-stock';
            statusText = 'Low Stock';
            statusIcon = 'fa-exclamation-triangle';
        }

        if (available === 0) {
            statusClass = 'out-of-stock';
            statusText = 'Out of Stock';
            statusIcon = 'fa-times-circle';
        }

        inventoryEl.innerHTML = `
            <div class="inventory-badge ${statusClass}">
                <i class="fas ${statusIcon}"></i>
                <span>${statusText}</span>
            </div>
            <div class="inventory-details">
                <div class="inventory-item">
                    <span class="inventory-label">Available:</span>
                    <span class="inventory-value">${available.toLocaleString()} units</span>
                </div>
                <div class="inventory-item">
                    <span class="inventory-label">Local Stock:</span>
                    <span class="inventory-value">${local.toLocaleString()} units</span>
                </div>
            </div>
        `;
    }

    /**
     * Display product images from API
     */
    displayImages() {
        const galleryEl = document.getElementById('product-gallery');
        if (!galleryEl) return;

        const images = this.product.images;

        galleryEl.innerHTML = `
            <div class="gallery-item">
                <img src="${images.thumbnail}" alt="${this.product.name}" class="gallery-thumbnail">
            </div>
            <div class="gallery-item">
                <img src="${images.full}" alt="${this.product.name} - Full" class="gallery-thumbnail">
            </div>
        `;

        // Add click handlers for lightbox (simple version)
        galleryEl.querySelectorAll('.gallery-thumbnail').forEach(img => {
            img.addEventListener('click', () => {
                this.openLightbox(img.src);
            });
        });
    }

    /**
     * Open image lightbox
     */
    openLightbox(imageSrc) {
        const lightbox = document.createElement('div');
        lightbox.className = 'lightbox';
        lightbox.innerHTML = `
            <div class="lightbox-content">
                <span class="lightbox-close">&times;</span>
                <img src="${imageSrc}" alt="Product Image">
            </div>
        `;

        document.body.appendChild(lightbox);

        // Close on click
        lightbox.addEventListener('click', (e) => {
            if (e.target === lightbox || e.target.classList.contains('lightbox-close')) {
                lightbox.remove();
            }
        });
    }

    /**
     * Show loading state
     */
    showLoading() {
        const contentEl = document.getElementById('page-content');
        if (contentEl) {
            contentEl.classList.add('loading');
        }

        // Show loading spinner
        const loadingEl = document.getElementById('loading-spinner');
        if (loadingEl) {
            loadingEl.style.display = 'flex';
        }
    }

    /**
     * Hide loading state
     */
    hideLoading() {
        const contentEl = document.getElementById('page-content');
        if (contentEl) {
            contentEl.classList.remove('loading');
        }

        // Hide loading spinner
        const loadingEl = document.getElementById('loading-spinner');
        if (loadingEl) {
            loadingEl.style.display = 'none';
        }
    }

    /**
     * Show error message
     */
    showError(message) {
        const errorEl = document.getElementById('error-message');
        if (errorEl) {
            errorEl.textContent = message;
            errorEl.style.display = 'block';
        }

        this.hideLoading();
    }

    /**
     * Refresh product data
     */
    async refresh() {
        console.log('[LaserTumblerPage] Refreshing product data...');
        await this.init();
    }
}

// Initialize page when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    window.laserTumblerPage = new LaserTumblerPage();
    window.laserTumblerPage.init();
});

// Expose refresh method for testing
window.refreshProduct = function() {
    if (window.laserTumblerPage) {
        window.laserTumblerPage.refresh();
    }
};
