/**
 * Laser Tumbler Simple Page
 * Product page for Polar Camel 16 oz Pint with color variant selector
 * Uses JDS API for all product data and pricing
 */
var LASETUMBSIMP_LOG_ON = (typeof window !== 'undefined' && !!window.location && (window.location.hostname === 'localhost' || new URLSearchParams(window.location.search).has('debug')));
var lasetumbsimpLog = LASETUMBSIMP_LOG_ON ? console.log.bind(console) : function () {}; // debug logging: localhost or ?debug=1 only (2026-09-06 console sweep)
var LASER_API_BASE = (typeof window !== 'undefined' && window.APP_CONFIG && window.APP_CONFIG.API && window.APP_CONFIG.API.BASE_URL) || '';
if (!LASER_API_BASE) console.error('[laser-tumbler-simple] APP_CONFIG.API.BASE_URL missing — the proxy host is not configured');

class LaserTumblerPage {
    constructor() {
        this.apiService = new JDSApiService();
        this.inventoryService = new ManageOrdersInventoryService();

        // Selected Polar Camel 16oz SKUs (4 color variants)
        this.POLAR_CAMEL_16OZ_SKUS = [
            'LTM752',  // Black
            'LTM763',  // Maroon
            'LTM765',  // Green
            'LTM761'   // Navy
        ];

        // Product state
        this.allProducts = null;        // All color variants
        this.currentProduct = null;     // Currently selected color
        this.currentSKU = null;         // Currently selected SKU
        this.pricingTiers = null;       // Pricing tiers for current product
        this.localInventory = null;     // Local warehouse inventory
        this.selectionVersion = 0;
        this.inventoryPending = false;

        lasetumbsimpLog('[LaserTumblerPage] Initialized with multi-color support');
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
            this.updateColorLegend();
            this.displayPricingTable();
            this.displayInventory();
            this.displayImages();

            // Hide loading state
            this.hideLoading();

            // Reveal the customer logo-mockup + instant-quote section (optional
            // progressive enhancement — no-op if its script didn't load)
            window.laserTumblerMockup?.onPageReady(this);

            lasetumbsimpLog('[LaserTumblerPage] Page loaded successfully with', this.allProducts.length, 'color variants');

        } catch (error) {
            console.error('[LaserTumblerPage] Error loading page:', error);
            this.showError('Unable to load product information. Please refresh the page or contact us at 253-922-5793.');
        }
    }

    /**
     * Load local warehouse inventory for current product
     */
    async loadLocalInventory() {
        if (!this.currentSKU) return;
        const version = this.selectionVersion;
        const sku = this.currentSKU;
        const color = this.extractColorFromName(this.currentProduct.name);
        this.inventoryPending = true;
        this.localInventory = null;
        this.showWarning('tumblerInventoryWarning', 'Checking warehouse stock for ' + color + '…');
        try {
            const inventory = await this.inventoryService.checkInventory(sku, color);
            if (version !== this.selectionVersion) return;
            this.localInventory = inventory;
        } catch (error) {
            if (version !== this.selectionVersion) return;
            console.error('[LaserTumblerPage] Error loading local inventory:', error);
            this.localInventory = { available: false, totalStock: 0, error: true };
        } finally {
            if (version === this.selectionVersion) {
                this.inventoryPending = false;
                this.showWarning('tumblerInventoryWarning', this.localInventory?.error
                    ? 'Unable to verify warehouse stock for ' + color + '. Small orders need confirmation. Refresh to retry, or call 253-922-5793.' : '');
            }
        }
    }

    /**
     * Load all color variants using batch API call
     */
    async loadAllColorVariants() {
        const cacheKey = 'polar_camel_16oz_variants_v2';
        let products;
        let timestamp = Date.now();
        try {
            const cached = sessionStorage.getItem(cacheKey);
            if (cached) {
                const data = JSON.parse(cached);
                const age = Date.now() - data.timestamp;
                if (age >= 0 && age < 60 * 60 * 1000 && Array.isArray(data.products) && data.products.length) { products = data.products; timestamp = data.timestamp; }
            }
        } catch (error) {
            console.warn('[LaserTumblerPage] Product cache unavailable:', error);
            this.showWarning('tumblerCacheWarning', 'Saved product data could not be read. Fetching fresh product information.');
        }
        if (!products) {
            const response = await fetch(LASER_API_BASE + '/api/jds/products', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ skus: this.POLAR_CAMEL_16OZ_SKUS })
            });
            if (!response.ok) throw new Error('Batch API request failed: ' + response.status);
            const data = await response.json();
            products = data.result;
        }
        if (!Array.isArray(products) || !products.length) throw new Error('No tumbler products returned');
        // Cached wholesale records still use today's live policy; never reuse cached tiers.
        await this.apiService.ready;
        this.showWarning('tumblerPolicyWarning', this.apiService.pricingWarnings?.length
            ? 'Some live pricing settings are unavailable. Displayed estimates use default settings. Please confirm pricing with us before ordering; refresh to retry.' : '');
        this.allProducts = products.map(product => ({ ...product, tiers: this.apiService.getPricingTiers(product) }));
        try {
            sessionStorage.setItem(cacheKey, JSON.stringify({ products, timestamp }));
        } catch (error) {
            console.warn('[LaserTumblerPage] Product cache could not be saved:', error);
            this.showWarning('tumblerCacheWarning', 'Product information loaded, but could not be saved in this browser. Refreshing will fetch it again.');
        }
    }

    showWarning(id, message) {
        const element = document.getElementById(id);
        if (!element) return;
        element.textContent = message;
        element.hidden = !message;
    }

    /**
     * Render color swatch selector
     */
    renderColorSwatches() {
        const grid = document.querySelector('.color-grid');
        if (!grid) return;
        grid.replaceChildren();
        this.allProducts.forEach(product => {
            const color = this.extractColorFromName(product.name);
            const container = document.createElement('div');
            container.className = 'color-swatch-container';
            const input = document.createElement('input');
            input.type = 'radio'; input.id = 'color-' + product.sku;
            input.name = 'tumbler-color'; input.value = product.sku;
            input.className = 'color-swatch-input'; input.checked = product.sku === this.currentSKU;
            input.setAttribute('aria-label', color + ' - ' + product.sku);
            const label = document.createElement('label');
            label.htmlFor = input.id; label.className = 'color-swatch';
            const image = document.createElement('img');
            image.className = 'color-preview'; image.src = product.images.thumbnail; image.alt = '';
            const name = document.createElement('span');
            name.className = 'color-name'; name.textContent = color;
            label.append(image, name); container.append(input, label); grid.append(container);
            input.addEventListener('change', () => { this.selectColor(product.sku); });
        });
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
                swatchInputs[newIndex].checked = true;
                swatchInputs[newIndex].dispatchEvent(new Event('change', { bubbles: true }));
            }
        });

        lasetumbsimpLog('[LaserTumblerPage] Keyboard navigation enabled');
    }

    /**
     * Select a color variant
     */
    async selectColor(sku, skipURLUpdate = false) {
        const product = this.allProducts.find(p => p.sku === sku);
        if (!product) return;
        const version = ++this.selectionVersion;
        this.currentProduct = product;
        this.currentSKU = sku;
        this.pricingTiers = product.tiers;
        if (skipURLUpdate) return;
        const color = this.extractColorFromName(product.name);
        this.updateURL(this.createColorSlug(color));
        document.querySelectorAll('.color-swatch-input').forEach(input => { input.checked = input.value === sku; });
        const inventory = this.loadLocalInventory();
        this.displayProductInfo(); this.updateColorLegend(); this.displayImages();
        this.displayPricingTable(); this.displayInventory();
        window.laserTumblerMockup?.onColorChanged();
        await inventory;
        if (version !== this.selectionVersion) return;
        this.displayPricingTable(); this.displayInventory();
        this.announceColorChange(color);
        window.laserTumblerMockup?.updateQuote();
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
        legend.textContent = 'Choose Your Color: ' + colorName;
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
                    <div class="tier-desc">${tier.description}${tier.handlingFee && hasLocalInventory ? ` + $${tier.handlingFee.toFixed(0)} LTM fee` : ''}</div>
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
                        <i class="fas fa-info-circle" aria-hidden="true"></i>
                        <span>Less than minimum (LTM) fee of $${tier.handlingFee.toFixed(2)} applies to orders under 12 pieces. This covers personalized service and setup time for very small orders.</span>
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
                        <i class="fas fa-exclamation-triangle" aria-hidden="true"></i>
                        <span>${this.inventoryPending ? 'Checking local inventory…' : this.localInventory?.error ? 'Unable to verify local inventory. Please confirm availability for orders under 24 pieces.' : 'Unavailable - No local inventory. Minimum 24 pieces when ordering from supplier.'}</span>
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

        const unknown = this.inventoryPending || this.localInventory?.error;
        if (unknown) {
            localStatusClass = 'stock-unknown';
            localStatusText = this.inventoryPending ? 'Checking stock…' : 'Unable to verify';
            localStatusIcon = 'fa-exclamation-triangle';
        }
        inventoryEl.innerHTML = `
            <div class="inventory-grid">
                <!-- Local Warehouse (highlight first) -->
                <div class="inventory-section local-inventory">
                    <h4 class="inventory-section-title">
                        <i class="fas fa-warehouse" aria-hidden="true"></i>
                        In Our Warehouse
                    </h4>
                    <div class="inventory-badge ${localStatusClass}">
                        <i class="fas ${localStatusIcon}" aria-hidden="true"></i>
                        <span>${localStatusText}</span>
                    </div>
                    <div class="inventory-details">
                        <div class="inventory-item">
                            <span class="inventory-label">Available Now:</span>
                            <span class="inventory-value">${unknown ? (this.inventoryPending ? 'Checking…' : 'Unknown') : localStock.toLocaleString() + ' units'}</span>
                        </div>
                    </div>
                </div>

                <!-- Supplier Inventory -->
                <div class="inventory-section supplier-inventory">
                    <h4 class="inventory-section-title">
                        <i class="fas fa-truck" aria-hidden="true"></i>
                        Supplier Inventory
                    </h4>
                    <div class="inventory-badge ${jdsStatusClass}">
                        <i class="fas ${jdsStatusIcon}" aria-hidden="true"></i>
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
        const hero = document.querySelector('.hero-image img.product-image-main');
        if (hero) { hero.src = this.currentProduct.images.full; hero.alt = this.currentProduct.name; }
        const gallery = document.getElementById('product-gallery');
        if (!gallery) return;
        gallery.replaceChildren();
        ['thumbnail', 'full'].forEach((size, index) => {
            const button = document.createElement('button');
            button.type = 'button'; button.className = 'gallery-item';
            button.setAttribute('aria-label', 'View ' + this.currentProduct.name + (index ? ' full image' : ' thumbnail'));
            const image = document.createElement('img');
            image.src = this.currentProduct.images[size];
            image.alt = this.currentProduct.name + (index ? ' - Full' : '');
            image.className = 'gallery-thumbnail';
            button.append(image); gallery.append(button);
            button.addEventListener('click', () => { this.openLightbox(image.src); });
        });
    }

    /**
     * Open image lightbox
     */
    openLightbox(imageSrc) {
        const lightbox = document.createElement('dialog');
        lightbox.className = 'lightbox'; lightbox.setAttribute('aria-label', 'Product image');
        const content = document.createElement('div'); content.className = 'lightbox-content';
        const close = document.createElement('button');
        close.type = 'button'; close.className = 'btn btn-secondary lightbox-close'; close.textContent = 'Close';
        close.setAttribute('aria-label', 'Close product image');
        const image = document.createElement('img'); image.src = imageSrc; image.alt = 'Product Image';
        content.append(close, image); lightbox.append(content); document.body.append(lightbox);
        close.addEventListener('click', () => lightbox.close());
        lightbox.addEventListener('close', () => lightbox.remove());
        lightbox.addEventListener('keydown', event => { if (event.key === 'Tab') { event.preventDefault(); close.focus(); } });
        lightbox.addEventListener('click', event => {
            if (event.target !== lightbox) return;
            const box = lightbox.getBoundingClientRect();
            if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) lightbox.close();
        });
        lightbox.showModal();
    }

    /**
     * Show loading state
     */
    showLoading() {
        const contentEl = document.getElementById('page-content');
        if (contentEl) {
            contentEl.classList.add('loading');
            contentEl.hidden = true;
        }

        // Show loading spinner
        const loadingEl = document.getElementById('loading-spinner');
        if (loadingEl) {
            loadingEl.hidden = false;
        }
    }

    /**
     * Hide loading state
     */
    hideLoading() {
        const contentEl = document.getElementById('page-content');
        if (contentEl) {
            contentEl.classList.remove('loading');
            contentEl.hidden = false;
        }

        // Hide loading spinner
        const loadingEl = document.getElementById('loading-spinner');
        if (loadingEl) {
            loadingEl.hidden = true;
        }
    }

    /**
     * Show error message
     */
    showError(message) {
        const errorEl = document.getElementById('error-message');
        if (errorEl) {
            errorEl.textContent = message;
            errorEl.hidden = false;
        }

        this.hideLoading();
        document.getElementById('page-content').hidden = true;
        document.getElementById('tumblerErrorPanel').hidden = false;
    }

    /**
     * Refresh product data
     */
    async refresh() {
        lasetumbsimpLog('[LaserTumblerPage] Refreshing product data...');
        await this.init();
    }
}

// Standard 2026 chrome: drawer + masthead search (same pattern as product-2026.js)
function wireChrome() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    const openBtn = document.getElementById('mobileMenuBtn');
    const closeBtn = document.getElementById('drawerClose');

    function setDrawer(open) {
        if (!sidebar || !overlay) return;
        sidebar.classList.toggle('show', open);
        overlay.classList.toggle('show', open);
        document.body.classList.toggle('drawer-open', open);
    }
    if (openBtn) openBtn.addEventListener('click', function () { setDrawer(true); });
    if (closeBtn) closeBtn.addEventListener('click', function () { setDrawer(false); });
    if (overlay) overlay.addEventListener('click', function () { setDrawer(false); });
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') setDrawer(false);
    });

    const input = document.getElementById('navSearchInput');
    const btn = document.getElementById('navSearchBtn');
    function goSearch() {
        const term = (input && input.value || '').trim();
        if (term) window.location.href = '/catalog?q=' + encodeURIComponent(term);
    }
    if (btn) btn.addEventListener('click', goSearch);
    if (input) input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') goSearch();
    });
}

// Initialize page when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    wireChrome();
    document.getElementById('tumblerRetry')?.addEventListener('click', () => window.location.reload());
    window.laserTumblerPage = new LaserTumblerPage();
    window.laserTumblerPage.init();
});

// Expose refresh method for testing
window.refreshProduct = function() {
    if (window.laserTumblerPage) {
        window.laserTumblerPage.refresh();
    }
};
