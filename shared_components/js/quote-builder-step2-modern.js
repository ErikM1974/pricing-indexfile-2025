/**
 * Modern Quote Builder Step 2 JavaScript (2025)
 *
 * Purpose: Handle modern UI interactions for product selection in embroidery quote builders
 * Used by: embroidery-quote-builder.html, cap-embroidery-quote-builder.html
 *
 * Features:
 * - Progressive disclosure of color swatches
 * - Modern empty state management
 * - Product card creation with animations
 * - Smooth transitions and loading states
 */

(function() {
    'use strict';

    /**
     * Modern Quote Builder Step 2 UI Manager
     */
    window.ModernQuoteBuilderStep2 = class {
        constructor() {
            this.swatchesSection = document.getElementById('qb-swatches-section');
            this.swatchesContainer = document.getElementById('color-swatches-container');
            this.productsContainer = document.getElementById('products-container');
            this.emptyState = document.getElementById('qb-empty-products');
            this.styleSearch = document.getElementById('style-search');
            this.suggestionsDropdown = document.getElementById('style-suggestions');

            console.log('[ModernStep2] Initialized');
            this.init();
        }

        init() {
            // Ensure empty state shows initially
            if (this.emptyState && this.productsContainer) {
                this.showEmptyState();
            }

            // Set up event listeners
            this.setupEventListeners();
        }

        setupEventListeners() {
            // Handle style search focus
            if (this.styleSearch) {
                this.styleSearch.addEventListener('focus', () => {
                    this.styleSearch.parentElement.classList.add('focused');
                });

                this.styleSearch.addEventListener('blur', () => {
                    setTimeout(() => {
                        this.styleSearch.parentElement.classList.remove('focused');
                    }, 200);
                });
            }

            // Listen for custom events from the main builder
            document.addEventListener('embProductLoaded', (e) => {
                console.log('[ModernStep2] Product loaded event received:', e.detail);
            });

            document.addEventListener('embProductAdded', (e) => {
                console.log('[ModernStep2] Product added event received:', e.detail);
                this.hideEmptyState();
            });

            document.addEventListener('embProductsCleared', () => {
                console.log('[ModernStep2] Products cleared event received');
                this.showEmptyState();
            });
        }

        /**
         * Show color swatches section when product is selected
         * @param {Array} swatches - Array of swatch objects from API
         */
        showSwatches(swatches) {
            if (!this.swatchesSection || !this.swatchesContainer) {
                console.warn('[ModernStep2] Swatches section not found');
                return;
            }

            console.log('[ModernStep2] Showing swatches:', swatches.length);

            // Clear existing swatches
            this.swatchesContainer.innerHTML = '';

            // Create swatch elements
            swatches.forEach(swatch => {
                const swatchEl = this.createSwatchElement(swatch);
                this.swatchesContainer.appendChild(swatchEl);
            });

            // Show the swatches section with animation
            this.swatchesSection.style.display = 'block';

            // Trigger animation
            requestAnimationFrame(() => {
                this.swatchesSection.style.opacity = '1';
            });
        }

        /**
         * Hide color swatches section
         */
        hideSwatches() {
            if (!this.swatchesSection) return;

            this.swatchesSection.style.display = 'none';
            this.swatchesSection.style.opacity = '0';

            if (this.swatchesContainer) {
                this.swatchesContainer.innerHTML = '';
            }

            console.log('[ModernStep2] Swatches hidden');
        }

        /**
         * Create a modern swatch element
         * @param {Object} swatch - Swatch data from API
         * @returns {HTMLElement}
         */
        createSwatchElement(swatch) {
            const swatchDiv = document.createElement('div');
            swatchDiv.className = 'qb-color-swatch';
            swatchDiv.dataset.colorCode = swatch.code || '';
            swatchDiv.dataset.colorName = swatch.name || '';

            // Set background color or image
            if (swatch.image) {
                swatchDiv.style.backgroundImage = `url(${swatch.image})`;
                swatchDiv.style.backgroundSize = 'cover';
                swatchDiv.style.backgroundPosition = 'center';
            } else if (swatch.hex) {
                swatchDiv.style.backgroundColor = swatch.hex;
            } else {
                swatchDiv.style.backgroundColor = '#e5e7eb'; // Fallback gray
            }

            // Add color name label
            const nameLabel = document.createElement('div');
            nameLabel.className = 'qb-swatch-name';
            nameLabel.textContent = swatch.name || 'Unknown';
            swatchDiv.appendChild(nameLabel);

            // Click handler
            swatchDiv.addEventListener('click', () => {
                this.selectSwatch(swatchDiv, swatch);
            });

            return swatchDiv;
        }

        /**
         * Handle swatch selection
         * @param {HTMLElement} swatchEl - The swatch element clicked
         * @param {Object} swatch - The swatch data
         */
        selectSwatch(swatchEl, swatch) {
            // Remove 'selected' from all swatches
            const allSwatches = this.swatchesContainer.querySelectorAll('.qb-color-swatch');
            allSwatches.forEach(s => s.classList.remove('selected'));

            // Add 'selected' to clicked swatch
            swatchEl.classList.add('selected');

            console.log('[ModernStep2] Swatch selected:', swatch.name);

            // Trigger custom event for the main builder to handle
            const event = new CustomEvent('colorSwatchSelected', {
                detail: {
                    colorCode: swatch.code,
                    colorName: swatch.name,
                    hex: swatch.hex,
                    image: swatch.image
                },
                bubbles: true
            });
            document.dispatchEvent(event);
        }

        /**
         * Show the empty state
         */
        showEmptyState() {
            if (!this.emptyState) return;

            // Remove any product cards
            const productCards = this.productsContainer.querySelectorAll('.qb-product-card');
            productCards.forEach(card => card.remove());

            // Show empty state
            this.emptyState.style.display = 'block';

            console.log('[ModernStep2] Empty state shown');
        }

        /**
         * Hide the empty state
         */
        hideEmptyState() {
            if (!this.emptyState) return;

            this.emptyState.style.display = 'none';

            console.log('[ModernStep2] Empty state hidden');
        }

        /**
         * Create a modern product card
         * @param {Object} product - Product data
         * @returns {HTMLElement}
         */
        createProductCard(product) {
            const card = document.createElement('div');
            card.className = 'qb-product-card';
            card.dataset.productId = product.id || Date.now();

            card.innerHTML = `
                <div class="qb-product-header">
                    <div class="qb-product-info">
                        <h4 class="qb-product-title">${product.name || 'Product'}</h4>
                        <p class="qb-product-subtitle">
                            ${product.styleNumber ? `Style: ${product.styleNumber}` : ''}
                            ${product.colorName ? ` • ${product.colorName}` : ''}
                        </p>
                    </div>
                    ${product.colorHex ? `
                        <span class="qb-product-color-badge">
                            <span class="qb-product-color-dot" style="background-color: ${product.colorHex};"></span>
                            ${product.colorName || 'Color'}
                        </span>
                    ` : ''}
                    <button class="qb-product-remove" title="Remove product" data-product-id="${product.id || ''}">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="qb-product-body">
                    <div class="qb-product-pricing">
                        <div>
                            <span class="qb-product-price">$${(product.unitPrice || 0).toFixed(2)}</span>
                            <span class="qb-product-price-label">per piece</span>
                        </div>
                        ${product.quantity ? `
                            <div>
                                <span class="qb-product-price-label">Quantity:</span>
                                <span class="qb-product-price">${product.quantity}</span>
                            </div>
                        ` : ''}
                        ${product.total ? `
                            <div>
                                <span class="qb-product-price-label">Total:</span>
                                <span class="qb-product-price">$${(product.total || 0).toFixed(2)}</span>
                            </div>
                        ` : ''}
                    </div>
                </div>
            `;

            // Add remove button click handler
            const removeBtn = card.querySelector('.qb-product-remove');
            if (removeBtn) {
                removeBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.removeProductCard(card, product);
                });
            }

            return card;
        }

        /**
         * Add a product card to the container
         * @param {Object} product - Product data
         */
        addProductCard(product) {
            if (!this.productsContainer) return;

            // Hide empty state
            this.hideEmptyState();

            // Create and add card
            const card = this.createProductCard(product);
            this.productsContainer.appendChild(card);

            console.log('[ModernStep2] Product card added:', product.name);
        }

        /**
         * Remove a product card
         * @param {HTMLElement} card - The card element
         * @param {Object} product - Product data
         */
        removeProductCard(card, product) {
            // Fade out animation
            card.style.opacity = '0';
            card.style.transform = 'translateY(16px)';

            setTimeout(() => {
                card.remove();

                // Check if we should show empty state
                const remainingCards = this.productsContainer.querySelectorAll('.qb-product-card');
                if (remainingCards.length === 0) {
                    this.showEmptyState();
                }

                // Dispatch event for main builder
                const event = new CustomEvent('productCardRemoved', {
                    detail: { product },
                    bubbles: true
                });
                document.dispatchEvent(event);

                console.log('[ModernStep2] Product card removed:', product.name);
            }, 300);
        }

        /**
         * Show loading state in suggestions dropdown
         */
        showSuggestionsLoading() {
            if (!this.suggestionsDropdown) return;

            this.suggestionsDropdown.innerHTML = `
                <div class="qb-suggestion-item" style="text-align: center; color: #6b7280;">
                    <i class="fas fa-spinner fa-spin"></i> Searching...
                </div>
            `;
            this.suggestionsDropdown.classList.add('active');
        }

        /**
         * Show suggestions in dropdown
         * @param {Array} suggestions - Array of suggestion objects
         */
        showSuggestions(suggestions) {
            if (!this.suggestionsDropdown) return;

            if (!suggestions || suggestions.length === 0) {
                this.suggestionsDropdown.classList.remove('active');
                return;
            }

            this.suggestionsDropdown.innerHTML = '';

            suggestions.forEach(suggestion => {
                const item = document.createElement('div');
                item.className = 'qb-suggestion-item';
                item.innerHTML = `
                    <div class="qb-suggestion-style">${suggestion.style || suggestion.styleNumber}</div>
                    ${suggestion.description ? `<div class="qb-suggestion-description">${suggestion.description}</div>` : ''}
                `;

                item.addEventListener('click', () => {
                    this.selectSuggestion(suggestion);
                });

                this.suggestionsDropdown.appendChild(item);
            });

            this.suggestionsDropdown.classList.add('active');
        }

        /**
         * Handle suggestion selection
         * @param {Object} suggestion - The selected suggestion
         */
        selectSuggestion(suggestion) {
            if (this.styleSearch) {
                this.styleSearch.value = suggestion.style || suggestion.styleNumber || '';
            }

            this.suggestionsDropdown.classList.remove('active');

            // Dispatch event for main builder
            const event = new CustomEvent('suggestionSelected', {
                detail: { suggestion },
                bubbles: true
            });
            document.dispatchEvent(event);

            console.log('[ModernStep2] Suggestion selected:', suggestion);
        }

        /**
         * Show skeleton loading state
         */
        showSkeletonLoading() {
            if (!this.productsContainer) return;

            this.hideEmptyState();

            const skeleton = document.createElement('div');
            skeleton.className = 'qb-skeleton qb-skeleton-card';
            skeleton.id = 'qb-skeleton-loading';
            this.productsContainer.appendChild(skeleton);
        }

        /**
         * Hide skeleton loading state
         */
        hideSkeletonLoading() {
            const skeleton = document.getElementById('qb-skeleton-loading');
            if (skeleton) {
                skeleton.remove();
            }
        }
    };

    // Auto-initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            window.modernStep2UI = new ModernQuoteBuilderStep2();
            console.log('[ModernStep2] Auto-initialized on DOMContentLoaded');
        });
    } else {
        window.modernStep2UI = new ModernQuoteBuilderStep2();
        console.log('[ModernStep2] Auto-initialized immediately');
    }

})();
