/**
 * Enhanced Loading Animations
 * Phase 2 Feature 3: Skeleton screens, progressive loading, and pricing table enhancements
 */

(function() {
    'use strict';

    console.log('[LOADING-ANIMATIONS] Initializing enhanced loading animations...');

    // Ensure NWCA namespace
    window.NWCA = window.NWCA || {};
    NWCA.ui = NWCA.ui || {};

    NWCA.ui.LoadingAnimations = {
        config: {
            imageLoadDelay: 100,
            skeletonDuration: 1000,
            staggerDelay: 100
        },

        /**
         * Initialize loading animations
         */
        initialize() {
            console.log('[LOADING-ANIMATIONS] Setting up skeleton screens...');
            
            // Add skeleton screens immediately
            this.addSkeletonScreens();
            
            // Set up progressive image loading
            this.setupProgressiveImages();
            
            // Enhance pricing table when loaded
            this.enhancePricingTable();
            
            // Listen for content ready events
            this.listenForContentReady();
        },

        /**
         * Add skeleton screens for loading states
         */
        addSkeletonScreens() {
            // Product image skeleton
            const imageContainer = document.getElementById('main-image-container');
            if (imageContainer && !imageContainer.querySelector('img[src]')) {
                this.addImageSkeleton(imageContainer);
            }

            // Color swatches skeleton
            const colorGrid = document.getElementById('color-swatches');
            if (colorGrid && colorGrid.children.length === 0) {
                this.addColorSkeleton(colorGrid);
            }

            // Pricing table skeleton
            const pricingTable = document.getElementById('custom-pricing-grid');
            if (pricingTable && !pricingTable.querySelector('tbody tr')) {
                this.addPricingSkeleton(pricingTable);
            }

            // Quote summary skeleton
            const quoteSection = document.getElementById('add-to-cart-section');
            if (quoteSection && quoteSection.children.length === 0) {
                this.addQuoteSkeleton(quoteSection);
            }
        },

        /**
         * Add image skeleton
         */
        addImageSkeleton(container) {
            const skeleton = document.createElement('div');
            skeleton.className = 'image-skeleton skeleton';
            skeleton.id = 'image-skeleton';
            container.appendChild(skeleton);
        },

        /**
         * Add color swatches skeleton
         */
        addColorSkeleton(container) {
            const skeleton = document.createElement('div');
            skeleton.className = 'color-skeleton';
            skeleton.id = 'color-skeleton';
            
            // Add 8 skeleton swatches
            for (let i = 0; i < 8; i++) {
                const item = document.createElement('div');
                item.className = 'color-skeleton-item';
                item.innerHTML = `
                    <div class="color-skeleton-swatch skeleton"></div>
                    <div class="color-skeleton-text skeleton"></div>
                `;
                skeleton.appendChild(item);
            }
            
            container.appendChild(skeleton);
        },

        /**
         * Add pricing table skeleton
         */
        addPricingSkeleton(table) {
            const skeleton = document.createElement('div');
            skeleton.className = 'pricing-skeleton';
            skeleton.id = 'pricing-skeleton';
            
            // Add skeleton rows
            for (let i = 0; i < 3; i++) {
                const row = document.createElement('div');
                row.className = 'pricing-skeleton-row';
                
                // Add cells
                for (let j = 0; j < 2; j++) {
                    const cell = document.createElement('div');
                    cell.className = 'pricing-skeleton-cell skeleton';
                    row.appendChild(cell);
                }
                
                skeleton.appendChild(row);
            }
            
            // Hide actual table temporarily
            table.style.display = 'none';
            table.parentNode.insertBefore(skeleton, table);
        },

        /**
         * Add quote section skeleton
         */
        addQuoteSkeleton(container) {
            const skeleton = document.createElement('div');
            skeleton.className = 'quote-skeleton';
            skeleton.id = 'quote-skeleton';
            skeleton.innerHTML = `
                <div class="quote-skeleton-line title skeleton"></div>
                <div class="quote-skeleton-line skeleton"></div>
                <div class="quote-skeleton-line short skeleton"></div>
                <div class="quote-skeleton-line skeleton"></div>
                <div class="quote-skeleton-line price skeleton"></div>
            `;
            container.appendChild(skeleton);
        },

        /**
         * Set up progressive image loading
         */
        setupProgressiveImages() {
            const mainImage = document.getElementById('product-image-main');
            if (mainImage) {
                // Add loading class
                mainImage.classList.add('loading-hidden');
                
                // Create progressive loader
                const container = mainImage.parentElement;
                container.classList.add('progressive-image');
                
                // When image loads
                if (mainImage.complete) {
                    this.imageLoaded(mainImage);
                } else {
                    mainImage.addEventListener('load', () => this.imageLoaded(mainImage));
                }
            }
        },

        /**
         * Handle image load completion
         */
        imageLoaded(img) {
            setTimeout(() => {
                // Remove skeleton
                const skeleton = document.getElementById('image-skeleton');
                if (skeleton) {
                    skeleton.style.opacity = '0';
                    setTimeout(() => skeleton.remove(), 300);
                }
                
                // Show image
                img.classList.remove('loading-hidden');
                img.classList.add('loading-complete');
                img.parentElement.classList.add('loaded');
            }, this.config.imageLoadDelay);
        },

        /**
         * Listen for content ready events
         */
        listenForContentReady() {
            // Listen for pricing data
            document.addEventListener('pricingDataLoaded', () => {
                this.removePricingSkeleton();
                this.enhancePricingTable();
            });

            // Listen for colors ready
            document.addEventListener('productColorsReady', () => {
                setTimeout(() => this.removeColorSkeleton(), 500);
            });

            // Listen for quote ready
            document.addEventListener('quoteUIReady', () => {
                this.removeQuoteSkeleton();
            });

            // Also check periodically
            this.checkContentReady();
        },

        /**
         * Check if content is ready
         */
        checkContentReady() {
            const checkInterval = setInterval(() => {
                // Check colors
                if (document.querySelectorAll('#color-swatches .clean-swatch-item').length > 0) {
                    this.removeColorSkeleton();
                }

                // Check pricing
                if (document.querySelectorAll('#custom-pricing-grid tbody tr').length > 0) {
                    this.removePricingSkeleton();
                    this.enhancePricingTable();
                }

                // Check quote
                if (document.querySelector('.quote-container')) {
                    this.removeQuoteSkeleton();
                }

                // Stop checking after 10 seconds
                setTimeout(() => clearInterval(checkInterval), 10000);
            }, 500);
        },

        /**
         * Remove color skeleton
         */
        removeColorSkeleton() {
            const skeleton = document.getElementById('color-skeleton');
            if (skeleton) {
                skeleton.style.opacity = '0';
                setTimeout(() => skeleton.remove(), 300);
            }
        },

        /**
         * Remove pricing skeleton
         */
        removePricingSkeleton() {
            const skeleton = document.getElementById('pricing-skeleton');
            const table = document.getElementById('custom-pricing-grid');
            
            if (skeleton && table) {
                skeleton.style.opacity = '0';
                table.style.display = '';
                setTimeout(() => skeleton.remove(), 300);
                
                // Add stagger animation to rows
                const rows = table.querySelectorAll('tbody tr');
                rows.forEach((row, index) => {
                    row.classList.add('stagger-animation');
                    row.style.animationDelay = `${index * this.config.staggerDelay}ms`;
                });
            }
        },

        /**
         * Remove quote skeleton
         */
        removeQuoteSkeleton() {
            const skeleton = document.getElementById('quote-skeleton');
            if (skeleton) {
                skeleton.style.opacity = '0';
                setTimeout(() => skeleton.remove(), 300);
            }
        },

        /**
         * Enhance pricing table with modern design
         */
        enhancePricingTable() {
            const table = document.getElementById('custom-pricing-grid');
            if (!table || table.dataset.enhanced) return;
            
            console.log('[LOADING-ANIMATIONS] Enhancing pricing table...');
            table.dataset.enhanced = 'true';

            // Add price formatting
            const priceCells = table.querySelectorAll('td:not(:first-child)');
            priceCells.forEach(cell => {
                const text = cell.textContent.trim();
                if (text.match(/^\$?\d+(\\.?\d+)?$/)) {
                    cell.classList.add('price-cell');
                    // Keep the dollar sign as-is since CSS no longer adds it
                    // cell.textContent = text.replace('$', '');
                }
            });

            // Find and mark best prices
            this.markBestPrices(table);

            // Add tier badges
            this.addTierBadges(table);

            // Add inventory indicators if available
            this.addInventoryIndicators(table);
        },

        /**
         * Mark best prices in each row
         */
        markBestPrices(table) {
            const rows = table.querySelectorAll('tbody tr');
            rows.forEach(row => {
                const priceCells = row.querySelectorAll('.price-cell');
                let lowestPrice = Infinity;
                let bestCell = null;

                priceCells.forEach(cell => {
                    const price = parseFloat(cell.textContent);
                    if (price < lowestPrice) {
                        lowestPrice = price;
                        bestCell = cell;
                    }
                });

                if (bestCell) {
                    bestCell.classList.add('best-price');
                }
            });
        },

        /**
         * Add tier badges to quantity ranges
         */
        addTierBadges(table) {
            const rows = table.querySelectorAll('tbody tr');
            rows.forEach((row, index) => {
                const firstCell = row.querySelector('td:first-child');
                if (firstCell) {
                    // Add badges based on tier
                    if (index === 0) {
                        const badge = document.createElement('span');
                        badge.className = 'tier-badge popular';
                        badge.textContent = 'Popular';
                        firstCell.appendChild(badge);
                    } else if (index === rows.length - 1) {
                        const badge = document.createElement('span');
                        badge.className = 'tier-badge best-value';
                        badge.textContent = 'Best Value';
                        firstCell.appendChild(badge);
                    }
                }
            });
        },

        /**
         * Add inventory indicators
         */
        addInventoryIndicators(table) {
            // Check if inventory data exists
            if (!window.inventoryData) return;

            const cells = table.querySelectorAll('.price-cell');
            cells.forEach(cell => {
                const indicator = cell.querySelector('.inventory-indicator');
                if (indicator) {
                    // Enhance existing indicator
                    const tooltip = document.createElement('span');
                    tooltip.className = 'inventory-tooltip';
                    tooltip.textContent = indicator.title || 'Stock status';
                    indicator.appendChild(tooltip);
                }
            });
        }
    };

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            NWCA.ui.LoadingAnimations.initialize();
        });
    } else {
        setTimeout(() => NWCA.ui.LoadingAnimations.initialize(), 100);
    }

    console.log('[LOADING-ANIMATIONS] Module loaded');

})();