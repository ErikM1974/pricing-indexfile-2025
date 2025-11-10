/**
 * Laser Tumbler Simple Page
 * Product page for Polar Camel 16 oz Pint with color variant selector
 * Uses JDS API for all product data and pricing
 */

class LaserTumblerPage {
    constructor() {
        this.apiService = new JDSApiService();
        this.inventoryService = new ManageOrdersInventoryService();

        // Selected Polar Camel 16oz SKUs (3 color variants)
        this.POLAR_CAMEL_16OZ_SKUS = [
            'LTM752',  // Black
            'LTM763',  // Maroon
            'LTM765'   // Green
        ];

        // Product state
        this.allProducts = null;        // All color variants
        this.currentProduct = null;     // Currently selected color
        this.currentSKU = null;         // Currently selected SKU
        this.pricingTiers = null;       // Pricing tiers for current product
        this.localInventory = null;     // Local warehouse inventory

        console.log('[LaserTumblerPage] Initialized with multi-color support');
    }

    /**
     * Initialize the page
     */
    async init() {
        try {
            // Show loading state
            this.showLoading();

            // Load all color variants with batch API call
            await this.loadAllColorVariants();

            // Check URL parameter for color selection, or default to first available
            const urlColor = this.getColorFromURL();
            const defaultSKU = urlColor || this.allProducts[0]?.sku || 'LTM752';

            // Select the color (sets currentProduct and currentSKU)
            await this.selectColor(defaultSKU, true); // true = skip URL update on init

            // Load local warehouse inventory
            await this.loadLocalInventory();

            // Render color swatches
            this.renderColorSwatches();

            // Populate page content for selected product
            this.displayProductInfo();
            this.displayPricingTable();
            this.displayInventory();
            this.displayImages();

            // Hide loading state
            this.hideLoading();

            console.log('[LaserTumblerPage] Page loaded successfully with', this.allProducts.length, 'color variants');

        } catch (error) {
            console.error('[LaserTumblerPage] Error loading page:', error);
            this.showError('Unable to load product information. Please refresh the page or contact us at 253-922-5793.');
        }
    }

    /**
     * Load local warehouse inventory for current product
     */
    async loadLocalInventory() {
        if (!this.currentSKU) {
            console.warn('[LaserTumblerPage] No current SKU, skipping inventory check');
            return;
        }

        try {
            // Extract color name from current product (e.g., "Black" from "Polar Camel Black 16 oz Pint")
            const colorName = this.currentProduct ? this.extractColorFromName(this.currentProduct.name) : null;

            console.log('[LaserTumblerPage] Loading local inventory for', this.currentSKU, 'Color:', colorName);

            // Query ManageOrders API for local warehouse stock (filtered by color)
            const inventory = await this.inventoryService.checkInventory(this.currentSKU, colorName);

            // Store inventory data
            this.localInventory = inventory;

            console.log('[LaserTumblerPage] Local inventory loaded:',
                inventory.totalStock, 'units',
                inventory.available ? 'in stock' : 'out of stock'
            );

        } catch (error) {
            console.error('[LaserTumblerPage] Error loading local inventory:', error);
            // Set empty inventory on error (don't fail the page)
            this.localInventory = {
                available: false,
                totalStock: 0,
                message: 'Unable to check local inventory'
            };
        }
    }

    /**
     * Load all color variants using batch API call
     */
    async loadAllColorVariants() {
        console.log('[LaserTumblerPage] Loading all color variants...');

        try {
            // Check sessionStorage cache first
            const cacheKey = 'polar_camel_16oz_variants';
            const cached = sessionStorage.getItem(cacheKey);

            if (cached) {
                const cacheData = JSON.parse(cached);
                const cacheAge = Date.now() - cacheData.timestamp;
                const cacheMaxAge = 60 * 60 * 1000; // 1 hour

                if (cacheAge < cacheMaxAge) {
                    console.log('[LaserTumblerPage] Using cached color variants');
                    this.allProducts = cacheData.products;
                    return;
                }
            }

            // Make batch API call
            const response = await fetch('https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/jds/products', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    skus: this.POLAR_CAMEL_16OZ_SKUS
                })
            });

            if (!response.ok) {
                throw new Error(`Batch API request failed: ${response.status}`);
            }

            const data = await response.json();

            // Process products with pricing calculations
            this.allProducts = data.result.map(product => {
                const pricing = this.apiService.calculatePrice(product.oneCase);
                const tiers = this.apiService.getPricingTiers(product);

                return {
                    ...product,
                    customerPrice: pricing.customerPrice,
                    tiers: tiers
                };
            });

            // Cache the results
            sessionStorage.setItem(cacheKey, JSON.stringify({
                products: this.allProducts,
                timestamp: Date.now()
            }));

            console.log('[LaserTumblerPage] Loaded', this.allProducts.length, 'color variants');

        } catch (error) {
            console.error('[LaserTumblerPage] Error loading color variants:', error);
            throw error;
        }
    }

    /**
     * Render color swatch selector
     */
    renderColorSwatches() {
        const colorGrid = document.querySelector('.color-grid');
        if (!colorGrid) {
            console.warn('[LaserTumblerPage] Color grid element not found');
            return;
        }

        colorGrid.innerHTML = '';

        this.allProducts.forEach((product, index) => {
            const colorName = this.extractColorFromName(product.name);
            const colorSlug = this.createColorSlug(colorName);
            const isSelected = product.sku === this.currentSKU;

            const swatchContainer = document.createElement('div');
            swatchContainer.className = 'color-swatch-container';

            swatchContainer.innerHTML = `
                <input
                    type="radio"
                    id="color-${product.sku}"
                    name="tumbler-color"
                    value="${product.sku}"
                    class="color-swatch-input"
                    ${isSelected ? 'checked' : ''}
                    aria-label="${colorName} - ${product.sku}"
                >
                <label for="color-${product.sku}" class="color-swatch">
                    <div
                        class="color-preview"
                        style="background-image: url('${product.images.thumbnail}')"
                        role="img"
                        aria-label="${colorName} tumbler preview"
                    ></div>
                    <span class="color-name">${colorName}</span>
                </label>
            `;

            colorGrid.appendChild(swatchContainer);

            // Add click handler
            const input = swatchContainer.querySelector('input');
            input.addEventListener('change', () => {
                this.selectColor(product.sku);
            });
        });

        console.log('[LaserTumblerPage] Rendered', this.allProducts.length, 'color swatches');

        // Add keyboard navigation
        this.addKeyboardNavigation();
    }

    /**
     * Add keyboard navigation for color swatches
     */
    addKeyboardNavigation() {
        const colorGrid = document.querySelector('.color-grid');
        if (!colorGrid) return;

        const swatchInputs = Array.from(document.querySelectorAll('.color-swatch-input'));

        colorGrid.addEventListener('keydown', (e) => {
            const focusedInput = document.activeElement;

            // Only handle if a swatch input is focused
            if (!focusedInput || !focusedInput.classList.contains('color-swatch-input')) {
                return;
            }

            const currentIndex = swatchInputs.indexOf(focusedInput);
            let newIndex = currentIndex;

            switch(e.key) {
                case 'ArrowRight':
                case 'ArrowDown':
                    e.preventDefault();
                    newIndex = (currentIndex + 1) % swatchInputs.length;
                    break;

                case 'ArrowLeft':
                case 'ArrowUp':
                    e.preventDefault();
                    newIndex = (currentIndex - 1 + swatchInputs.length) % swatchInputs.length;
                    break;

                case 'Home':
                    e.preventDefault();
                    newIndex = 0;
                    break;

                case 'End':
                    e.preventDefault();
                    newIndex = swatchInputs.length - 1;
                    break;

                case 'Enter':
                case ' ':
                    e.preventDefault();
                    focusedInput.checked = true;
                    focusedInput.dispatchEvent(new Event('change', { bubbles: true }));
                    return;

                default:
                    return;
            }

            // Move focus to new swatch
            if (newIndex !== currentIndex) {
                swatchInputs[newIndex].focus();
            }
        });

        console.log('[LaserTumblerPage] Keyboard navigation enabled');
    }

    /**
     * Select a color variant
     */
    async selectColor(sku, skipURLUpdate = false) {
        console.log('[LaserTumblerPage] Selecting color:', sku);

        // Find product in allProducts array
        const product = this.allProducts.find(p => p.sku === sku);

        if (!product) {
            console.error('[LaserTumblerPage] Product not found for SKU:', sku);
            return;
        }

        // Update current selection
        this.currentProduct = product;
        this.currentSKU = sku;
        this.pricingTiers = product.tiers;

        // Update URL without reload (unless this is initial load)
        if (!skipURLUpdate) {
            const colorName = this.extractColorFromName(product.name);
            const colorSlug = this.createColorSlug(colorName);
            this.updateURL(colorSlug);

            // Update checked state on color swatches
            document.querySelectorAll('.color-swatch-input').forEach(input => {
                input.checked = (input.value === sku);
            });

            // Load local inventory for new color
            await this.loadLocalInventory();

            // Update page content
            this.displayProductInfo();
            this.displayPricingTable();
            this.displayInventory();
            this.displayImages();
            this.updateColorLegend();
            this.updateSKUDisplay();

            // Announce to screen readers
            this.announceColorChange(colorName);
        }

        console.log('[LaserTumblerPage] Color selected:', product.name);
    }

    /**
     * Get color from URL parameter
     */
    getColorFromURL() {
        const params = new URLSearchParams(window.location.search);
        const colorParam = params.get('color');

        if (!colorParam) return null;

        // Find product matching the color slug
        const product = this.allProducts.find(p => {
            const colorName = this.extractColorFromName(p.name);
            const colorSlug = this.createColorSlug(colorName);
            return colorSlug === colorParam;
        });

        return product ? product.sku : null;
    }

    /**
     * Update URL with color parameter
     */
    updateURL(colorSlug) {
        const url = new URL(window.location);
        url.searchParams.set('color', colorSlug);
        window.history.pushState({}, '', url);
    }

    /**
     * Extract color name from product name
     * Example: "Polar Camel Midnight Blue 16 oz. Pint" -> "Midnight Blue"
     */
    extractColorFromName(name) {
        // Remove "Polar Camel" prefix and "16 oz..." suffix
        const withoutPrefix = name.replace(/^Polar Camel\s+/i, '');
        const colorMatch = withoutPrefix.match(/^([\w\s]+?)\s+16\s+oz/i);

        return colorMatch ? colorMatch[1].trim() : withoutPrefix;
    }

    /**
     * Create URL-friendly color slug
     * Example: "Midnight Blue" -> "midnight-blue"
     */
    createColorSlug(colorName) {
        return colorName.toLowerCase().replace(/\s+/g, '-');
    }

    /**
     * Announce color change to screen readers
     */
    announceColorChange(colorName) {
        const announcer = document.getElementById('color-announcement');
        if (announcer) {
            announcer.textContent = `Selected color: ${colorName}`;

            // Clear announcement after 3 seconds
            setTimeout(() => {
                announcer.textContent = '';
            }, 3000);
        }
    }

    /**
     * Update color selector legend with selected color
     */
    updateColorLegend() {
        const legend = document.getElementById('color-selector-legend');
        if (!legend) return;

        const colorName = this.extractColorFromName(this.currentProduct.name);
        legend.innerHTML = `Choose Your Color: <span class="selected-color-name">${colorName}</span>`;
    }

    /**
     * Update SKU display with current product SKU
     */
    updateSKUDisplay() {
        const skuEl = document.getElementById('product-sku');
        if (!skuEl) return;

        skuEl.textContent = this.currentProduct.sku;
    }

    /**
     * Display product information
     */
    displayProductInfo() {
        const nameEl = document.getElementById('product-name');
        const descEl = document.getElementById('product-description');

        if (nameEl) {
            nameEl.textContent = 'Polar Camel 16 oz Pint';
        }

        if (descEl) {
            descEl.textContent = this.currentProduct.description;
        }

        this.updateSKUDisplay();
    }

    /**
     * Display pricing table
     */
    displayPricingTable() {
        const tableBody = document.getElementById('pricing-table-body');
        if (!tableBody) return;

        tableBody.innerHTML = '';

        // Check local inventory status
        const localStock = this.localInventory?.totalStock || 0;
        const hasLocalInventory = localStock > 0;

        this.pricingTiers.forEach((tier, index) => {
            const row = document.createElement('tr');

            // Check if this is a small order tier (1-11 or 12-23 pieces)
            const isVerySmallTier = index === 0; // 1-11 pieces
            const isSmallTier = index === 0 || index === 1; // 1-11 or 12-23 pieces
            const isUnavailable = isSmallTier && !hasLocalInventory;

            // Add appropriate classes
            if (isUnavailable) {
                row.classList.add('pricing-tier-unavailable');
            }

            // Add highlight class to third row (24-119: most common order size)
            if (index === 2) {
                row.classList.add('highlight-tier');
            }

            row.innerHTML = `
                <td class="tier-range">
                    <div class="tier-qty">${tier.range}</div>
                    <div class="tier-desc">${tier.description}${tier.handlingFee && hasLocalInventory ? ' + $50 LTM fee' : ''}</div>
                </td>
                <td class="tier-price">
                    <div class="price-large">$${tier.customerPrice.toFixed(2)}</div>
                    <div class="price-small">per unit</div>
                </td>
            `;

            tableBody.appendChild(row);

            // Add info row after 1-11 tier (when local inventory exists)
            if (isVerySmallTier && tier.handlingFee && hasLocalInventory) {
                const infoRow = document.createElement('tr');
                infoRow.classList.add('pricing-info-row');
                infoRow.innerHTML = `
                    <td colspan="2" class="pricing-info">
                        <i class="fas fa-info-circle"></i>
                        <span>Less than minimum (LTM) fee of $50.00 applies to orders under 12 pieces. This covers personalized service and setup time for very small orders.</span>
                    </td>
                `;
                tableBody.appendChild(infoRow);
            }

            // Add warning row after 12-23 tier when no local inventory
            if (index === 1 && !hasLocalInventory) {
                const warningRow = document.createElement('tr');
                warningRow.classList.add('pricing-warning-row');
                warningRow.innerHTML = `
                    <td colspan="2" class="pricing-warning">
                        <i class="fas fa-exclamation-triangle"></i>
                        <span>Unavailable - No local inventory. Minimum 24 pieces when ordering from supplier.</span>
                    </td>
                `;
                tableBody.appendChild(warningRow);
            }
        });
    }

    /**
     * Display inventory status (dual inventory: JDS supplier + local warehouse)
     */
    displayInventory() {
        const inventoryEl = document.getElementById('inventory-status');
        if (!inventoryEl) return;

        // JDS Supplier Inventory
        const jdsAvailable = this.currentProduct.availableQuantity;
        const jdsLocal = this.currentProduct.localQuantity;

        let jdsStatusClass = 'in-stock';
        let jdsStatusText = 'In Stock';
        let jdsStatusIcon = 'fa-check-circle';

        if (jdsAvailable < 100) {
            jdsStatusClass = 'low-stock';
            jdsStatusText = 'Low Stock';
            jdsStatusIcon = 'fa-exclamation-triangle';
        }

        if (jdsAvailable === 0) {
            jdsStatusClass = 'out-of-stock';
            jdsStatusText = 'Out of Stock';
            jdsStatusIcon = 'fa-times-circle';
        }

        // Local Warehouse Inventory (ManageOrders API)
        const localStock = this.localInventory?.totalStock || 0;
        const localAvailable = this.localInventory?.available || false;

        let localStatusClass = 'in-stock';
        let localStatusText = 'In Stock';
        let localStatusIcon = 'fa-check-circle';

        if (localStock < 10 && localStock > 0) {
            localStatusClass = 'low-stock';
            localStatusText = 'Low Stock';
            localStatusIcon = 'fa-exclamation-triangle';
        }

        if (localStock === 0 || !localAvailable) {
            localStatusClass = 'out-of-stock';
            localStatusText = 'Out of Stock';
            localStatusIcon = 'fa-times-circle';
        }

        inventoryEl.innerHTML = `
            <div class="inventory-grid">
                <!-- Local Warehouse (highlight first) -->
                <div class="inventory-section local-inventory">
                    <h4 class="inventory-section-title">
                        <i class="fas fa-warehouse"></i>
                        In Our Warehouse
                    </h4>
                    <div class="inventory-badge ${localStatusClass}">
                        <i class="fas ${localStatusIcon}"></i>
                        <span>${localStatusText}</span>
                    </div>
                    <div class="inventory-details">
                        <div class="inventory-item">
                            <span class="inventory-label">Available Now:</span>
                            <span class="inventory-value">${localStock.toLocaleString()} units</span>
                        </div>
                    </div>
                </div>

                <!-- Supplier Inventory -->
                <div class="inventory-section supplier-inventory">
                    <h4 class="inventory-section-title">
                        <i class="fas fa-truck"></i>
                        Supplier Inventory
                    </h4>
                    <div class="inventory-badge ${jdsStatusClass}">
                        <i class="fas ${jdsStatusIcon}"></i>
                        <span>${jdsStatusText}</span>
                    </div>
                    <div class="inventory-details">
                        <div class="inventory-item">
                            <span class="inventory-label">Available:</span>
                            <span class="inventory-value">${jdsAvailable.toLocaleString()} units</span>
                        </div>
                        <div class="inventory-item">
                            <span class="inventory-label">Nearby Stock:</span>
                            <span class="inventory-value">${jdsLocal.toLocaleString()} units</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Display product images from API
     */
    displayImages() {
        // Update main hero image
        const heroImage = document.querySelector('.hero-image img.product-image-main');
        if (heroImage) {
            heroImage.src = this.currentProduct.images.full;
            heroImage.alt = this.currentProduct.name;
        }

        // Update gallery section
        const galleryEl = document.getElementById('product-gallery');
        if (!galleryEl) return;

        const images = this.currentProduct.images;

        galleryEl.innerHTML = `
            <div class="gallery-item">
                <img src="${images.thumbnail}" alt="${this.currentProduct.name}" class="gallery-thumbnail">
            </div>
            <div class="gallery-item">
                <img src="${images.full}" alt="${this.currentProduct.name} - Full" class="gallery-thumbnail">
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
