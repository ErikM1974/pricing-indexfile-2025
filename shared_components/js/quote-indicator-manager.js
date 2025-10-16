/**
 * Quote Indicator Manager
 * Created: 2025-10-15
 * Purpose: Manages the persistent quote indicator widget that shows current quote contents
 * Features: Real-time updates, collapsible UI, product management, mobile responsive
 */

class QuoteIndicatorManager {
    constructor(productManager) {
        this.productManager = productManager;
        this.widget = null;
        this.isCollapsed = false;
        this.isInitialized = false;

        // Bind methods
        this.updateIndicator = this.updateIndicator.bind(this);
        this.toggleWidget = this.toggleWidget.bind(this);
        this.removeProduct = this.removeProduct.bind(this);

        // Initialize when DOM is ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.init());
        } else {
            this.init();
        }
    }

    /**
     * Initialize the quote indicator widget
     */
    init() {
        if (this.isInitialized) return;

        // Create widget HTML
        this.createWidget();

        // Set up event listeners
        this.setupEventListeners();

        // Restore collapsed state from localStorage
        const savedState = localStorage.getItem('quote-widget-collapsed');
        if (savedState === 'false') {
            this.isCollapsed = false;
            this.widget.classList.remove('collapsed');
        }

        // Initial update
        this.updateIndicator();

        this.isInitialized = true;

        console.log('[QuoteIndicator] Initialized with productManager:', this.productManager);
    }

    /**
     * Create the widget HTML structure
     */
    createWidget() {
        // Check if widget already exists
        if (document.getElementById('quote-indicator-widget')) {
            this.widget = document.getElementById('quote-indicator-widget');
            return;
        }

        // Create widget container
        const widget = document.createElement('div');
        widget.id = 'quote-indicator-widget';
        widget.className = 'quote-indicator-widget'; // Start expanded by default for better UX

        widget.innerHTML = `
            <!-- Widget Header (Always Visible) -->
            <div class="quote-widget-header" id="quote-widget-header">
                <div class="quote-widget-title">
                    <i class="fas fa-shopping-cart"></i>
                    <span>Quote Summary</span>
                    <span class="quote-count-badge" id="quote-count-badge">0</span>
                </div>
                <div class="quote-widget-toggle">
                    <i class="fas fa-chevron-up"></i>
                </div>
            </div>

            <!-- Widget Content (Product List) -->
            <div class="quote-widget-content">
                <div class="quote-product-list" id="quote-product-list">
                    <!-- Products will be inserted here -->
                </div>

                <!-- Empty State -->
                <div class="quote-empty-state" id="quote-empty-state" style="display: none;">
                    <div class="quote-empty-icon">
                        <i class="far fa-clipboard"></i>
                    </div>
                    <div>No products in quote yet</div>
                </div>
            </div>

            <!-- Widget Footer (Simplified) -->
            <div class="quote-widget-footer" id="quote-widget-footer">
                <div class="quote-summary-row">
                    <span class="quote-summary-label">Products Added:</span>
                    <span class="quote-summary-value" id="quote-product-count">0</span>
                </div>
                <button class="quote-continue-btn btn-success" id="quote-continue-btn">
                    Continue to Summary →
                </button>
            </div>
        `;

        // Add widget to page
        document.body.appendChild(widget);
        this.widget = widget;
    }

    /**
     * Set up event listeners
     */
    setupEventListeners() {
        // Toggle widget on header click
        const header = document.getElementById('quote-widget-header');
        if (header) {
            header.addEventListener('click', this.toggleWidget);
        }

        // Continue button - properly navigate to summary phase
        const continueBtn = document.getElementById('quote-continue-btn');
        if (continueBtn) {
            continueBtn.addEventListener('click', () => {
                // Check which quote builder we're in and call the appropriate method
                if (window.capQuoteBuilder && typeof window.capQuoteBuilder.continueToSummaryPhase === 'function') {
                    // Cap embroidery quote builder
                    window.capQuoteBuilder.continueToSummaryPhase();
                } else if (window.embroideryQuoteBuilder && typeof window.embroideryQuoteBuilder.goToPhase === 'function') {
                    // Embroidery quote builder
                    window.embroideryQuoteBuilder.goToPhase(3);
                } else {
                    // Fallback: try clicking the actual continue button if it exists
                    const reviewBtn = document.getElementById('continue-to-summary');
                    if (reviewBtn && !reviewBtn.disabled) {
                        reviewBtn.click();
                    } else {
                        console.warn('[QuoteIndicator] Could not find a way to navigate to summary');
                    }
                }
            });
        }

        // Listen for product changes if productManager exists
        if (this.productManager) {
            // Listen for custom events
            document.addEventListener('productAdded', () => this.updateIndicator());
            document.addEventListener('productRemoved', () => this.updateIndicator());
            document.addEventListener('productUpdated', () => this.updateIndicator());
        }

        // Listen for phase changes
        document.addEventListener('phaseChanged', (e) => {
            this.handlePhaseChange(e.detail);
        });
    }

    /**
     * Toggle widget collapsed/expanded state
     */
    toggleWidget(e) {
        if (e) {
            e.stopPropagation();
        }

        this.isCollapsed = !this.isCollapsed;

        if (this.isCollapsed) {
            this.widget.classList.add('collapsed');
        } else {
            this.widget.classList.remove('collapsed');
        }

        // Save preference
        localStorage.setItem('quote-widget-collapsed', this.isCollapsed);
    }

    /**
     * Update the indicator with current products
     */
    updateIndicator() {
        console.log('[QuoteIndicator] Updating indicator...');

        if (!this.productManager) {
            console.log('[QuoteIndicator] No productManager available');
            return;
        }

        if (!this.widget) {
            console.log('[QuoteIndicator] Widget not created yet');
            return;
        }

        const products = this.productManager.products || [];
        const hasProducts = products.length > 0;

        console.log('[QuoteIndicator] Products count:', products.length, 'Has products:', hasProducts);

        // Show/hide widget based on products
        if (hasProducts) {
            this.widget.classList.add('has-products');
            // Also ensure it's expanded on first product add if currently collapsed
            if (products.length === 1 && this.isCollapsed) {
                this.isCollapsed = false;
                this.widget.classList.remove('collapsed');
            }
        } else {
            this.widget.classList.remove('has-products');
        }

        // Update count badge
        const countBadge = document.getElementById('quote-count-badge');
        if (countBadge) {
            countBadge.textContent = products.length;
            countBadge.classList.add('updating');
            setTimeout(() => countBadge.classList.remove('updating'), 300);
        }

        // Update product list
        this.updateProductList(products);

        // Update summary
        this.updateSummary(products);

        // Flash success animation when products added
        if (hasProducts) {
            const header = document.getElementById('quote-widget-header');
            if (header) {
                header.classList.add('success');
                setTimeout(() => header.classList.remove('success'), 600);
            }
        }
    }

    /**
     * Update the product list display
     */
    updateProductList(products) {
        const listContainer = document.getElementById('quote-product-list');
        const emptyState = document.getElementById('quote-empty-state');

        if (!listContainer || !emptyState) return;

        if (products.length === 0) {
            listContainer.innerHTML = '';
            emptyState.style.display = 'block';
            return;
        }

        emptyState.style.display = 'none';

        // Build simplified product HTML with thumbnails
        const productsHTML = products.map((product, index) => {
            const totalQty = this.calculateProductQuantity(product);

            // Build size breakdown text
            let sizeText = '';
            if (product.sizeBreakdown && typeof product.sizeBreakdown === 'object') {
                const sizeEntries = Object.entries(product.sizeBreakdown);
                sizeText = sizeEntries.map(([size, qty]) => `${size}: ${qty}`).join(', ');
            } else if (product.sizes && typeof product.sizes === 'object') {
                const sizeEntries = Object.entries(product.sizes);
                sizeText = sizeEntries.map(([size, qty]) => `${size}: ${qty}`).join(', ');
            }

            // Get product image URL with fallback
            const styleNum = product.styleNumber || product.style || 'CAP';
            const imageUrl = product.imageUrl ||
                            `https://via.placeholder.com/40x40/4cb354/white?text=${encodeURIComponent(styleNum.substring(0, 3))}`;

            return `
                <div class="quote-product-item" data-product-index="${index}">
                    <img class="quote-product-thumb"
                         src="${imageUrl}"
                         alt="${styleNum}"
                         onerror="this.src='https://via.placeholder.com/40x40/4cb354/white?text=${encodeURIComponent(styleNum.substring(0, 3))}'">
                    <div class="quote-product-info">
                        <div class="quote-product-name">
                            ${styleNum} - ${product.color || ''}
                        </div>
                        <div class="quote-product-meta">
                            <span class="quote-qty-badge">${totalQty} pieces</span>
                            ${sizeText ? `<span class="quote-size-text">(${sizeText})</span>` : ''}
                        </div>
                    </div>
                    <button class="quote-remove-btn" onclick="window.quoteIndicator.removeProduct(${index})" title="Remove">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            `;
        }).join('');

        listContainer.innerHTML = productsHTML;
    }

    /**
     * Update the summary section
     */
    updateSummary(products) {
        const productCount = document.getElementById('quote-product-count');
        const totalQty = document.getElementById('quote-total-qty');
        const totalPrice = document.getElementById('quote-total-price');

        if (productCount) {
            productCount.textContent = products.length;
        }

        if (totalQty) {
            const qty = products.reduce((total, product) => {
                return total + this.calculateProductQuantity(product);
            }, 0);
            totalQty.textContent = qty;
        }

        if (totalPrice) {
            const price = products.reduce((total, product) => {
                const qty = this.calculateProductQuantity(product);
                const unitPrice = product.unitPrice || product.price || 0;
                return total + (qty * unitPrice);
            }, 0);
            totalPrice.textContent = price > 0 ? `$${price.toFixed(2)}` : 'Calculating...';
        }
    }

    /**
     * Calculate total quantity for a product
     */
    calculateProductQuantity(product) {
        if (product.totalQuantity) {
            return product.totalQuantity;
        }

        if (product.sizes) {
            // Sum up all size quantities
            return Object.values(product.sizes).reduce((sum, qty) => sum + (parseInt(qty) || 0), 0);
        }

        return product.quantity || 0;
    }

    /**
     * Remove a product from the quote
     */
    removeProduct(index) {
        if (!this.productManager || !this.productManager.products) return;

        // Animate removal
        const productElement = document.querySelector(`[data-product-index="${index}"]`);
        if (productElement) {
            productElement.classList.add('removing');

            setTimeout(() => {
                // Remove from product manager
                if (this.productManager.removeProduct) {
                    this.productManager.removeProduct(index);
                } else if (this.productManager.products) {
                    this.productManager.products.splice(index, 1);
                }

                // Update display
                this.updateIndicator();

                // Dispatch event
                document.dispatchEvent(new CustomEvent('productRemoved', {
                    detail: { index, source: 'quoteIndicator' }
                }));
            }, 300);
        }
    }

    /**
     * Handle phase changes
     */
    handlePhaseChange(phase) {
        // Widget should only be visible in Phase 2
        if (phase === 'product-phase' || phase === 2) {
            // Widget visibility is controlled by CSS and has-products class
            this.updateIndicator();
        }
    }

    /**
     * Get current quote data
     */
    getQuoteData() {
        if (!this.productManager || !this.productManager.products) {
            return { products: [], totalQuantity: 0, totalPrice: 0 };
        }

        const products = this.productManager.products;
        const totalQuantity = products.reduce((total, product) => {
            return total + this.calculateProductQuantity(product);
        }, 0);

        const totalPrice = products.reduce((total, product) => {
            const qty = this.calculateProductQuantity(product);
            const unitPrice = product.unitPrice || product.price || 0;
            return total + (qty * unitPrice);
        }, 0);

        return {
            products,
            totalQuantity,
            totalPrice
        };
    }

    /**
     * Clear all products
     */
    clearAll() {
        if (this.productManager && this.productManager.clearAll) {
            this.productManager.clearAll();
        } else if (this.productManager && this.productManager.products) {
            this.productManager.products = [];
        }

        this.updateIndicator();
    }

    /**
     * Destroy the widget
     */
    destroy() {
        if (this.widget) {
            this.widget.remove();
            this.widget = null;
        }

        this.isInitialized = false;
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = QuoteIndicatorManager;
}

// Make available globally
window.QuoteIndicatorManager = QuoteIndicatorManager;