/**
 * Price Comparison View
 * Phase 2 Feature 6: Interactive price comparison across different stitch counts
 */

(function() {
    'use strict';

    console.log('[PRICE-COMPARISON] Initializing price comparison view...');

    // Ensure NWCA namespace
    window.NWCA = window.NWCA || {};
    NWCA.ui = NWCA.ui || {};

    NWCA.ui.PriceComparison = {
        // Configuration
        config: {
            stitchCounts: [5000, 8000, 10000],
            defaultQuantity: 24,
            animationDuration: 300
        },

        // State
        state: {
            isOpen: false,
            currentQuantity: 24,
            currentStitchCount: 8000,
            comparisonData: null,
            selectedRange: null
        },

        /**
         * Initialize price comparison feature
         */
        initialize() {
            console.log('[PRICE-COMPARISON] Setting up price comparison view...');
            
            // Create comparison UI
            this.createComparisonUI();
            
            // Set up event listeners
            this.setupEventListeners();
            
            // Listen for pricing updates
            this.listenForPricingUpdates();
        },

        /**
         * Create comparison UI elements
         */
        createComparisonUI() {
            // Find pricing details card
            const pricingCard = document.getElementById('pricing-details');
            if (!pricingCard) {
                console.warn('[PRICE-COMPARISON] Pricing details card not found');
                return;
            }

            // Create toggle button container
            const toggleContainer = document.createElement('div');
            toggleContainer.className = 'comparison-toggle-container';
            toggleContainer.innerHTML = `
                <button id="price-comparison-toggle" class="comparison-toggle-btn" 
                        aria-label="Toggle price comparison view"
                        aria-expanded="false"
                        aria-controls="price-comparison-view">
                    <span class="icon">📊</span>
                    <span>Compare Stitch Counts</span>
                </button>
            `;

            // Insert after card header
            const cardContent = pricingCard.querySelector('.card-content');
            if (cardContent) {
                cardContent.insertBefore(toggleContainer, cardContent.firstChild);
            }

            // Create comparison view container
            const comparisonView = document.createElement('div');
            comparisonView.id = 'price-comparison-view';
            comparisonView.className = 'price-comparison-view';
            comparisonView.setAttribute('role', 'region');
            comparisonView.setAttribute('aria-label', 'Price comparison across stitch counts');
            comparisonView.innerHTML = this.getComparisonViewHTML();

            // Insert after toggle container
            toggleContainer.after(comparisonView);

            console.log('[PRICE-COMPARISON] UI elements created');
        },

        /**
         * Get HTML for comparison view
         */
        getComparisonViewHTML() {
            return `
                <div class="comparison-header">
                    <h3 class="comparison-title">Price Comparison by Stitch Count</h3>
                    <p class="comparison-subtitle">Compare pricing across different logo sizes</p>
                </div>

                <div class="comparison-quantity-display">
                    <span class="icon">📦</span>
                    <span>Comparing prices for <strong id="comparison-quantity">24</strong> caps</span>
                </div>

                <div class="quick-switch-container" id="quick-switch-quantities">
                    <!-- Quick switch buttons will be added dynamically -->
                </div>

                <div class="comparison-table-wrapper">
                    <table class="comparison-table" role="table">
                        <thead>
                            <tr>
                                <th scope="col">Quantity Range</th>
                                <th scope="col" class="stitch-count-header">
                                    5,000 Stitches
                                    <span class="stitch-count-label">Small Logo</span>
                                </th>
                                <th scope="col" class="stitch-count-header">
                                    8,000 Stitches
                                    <span class="stitch-count-label">Standard Logo</span>
                                </th>
                                <th scope="col" class="stitch-count-header">
                                    10,000 Stitches
                                    <span class="stitch-count-label">Large Logo</span>
                                </th>
                            </tr>
                        </thead>
                        <tbody id="comparison-table-body">
                            <!-- Rows will be populated dynamically -->
                        </tbody>
                    </table>
                </div>

                <div class="savings-summary" id="savings-summary" style="display: none;">
                    <h4 class="savings-summary-title">💰 Potential Savings</h4>
                    <div class="savings-details">
                        <div class="savings-item">
                            <div class="savings-label">Best Price</div>
                            <div class="savings-value" id="best-price-value">$0.00</div>
                        </div>
                        <div class="savings-item">
                            <div class="savings-label">Max Savings</div>
                            <div class="savings-value" id="max-savings-value">$0.00</div>
                        </div>
                        <div class="savings-item">
                            <div class="savings-label">Recommended</div>
                            <div class="savings-value" id="recommended-option">8,000 stitches</div>
                        </div>
                    </div>
                </div>

                <div class="visual-comparison" id="visual-comparison">
                    <h4>Visual Price Comparison</h4>
                    <div id="comparison-bars">
                        <!-- Visual bars will be added dynamically -->
                    </div>
                </div>
            `;
        },

        /**
         * Set up event listeners
         */
        setupEventListeners() {
            // Toggle button
            const toggleBtn = document.getElementById('price-comparison-toggle');
            if (toggleBtn) {
                toggleBtn.addEventListener('click', () => this.toggleComparison());
            }

            // Listen for quantity changes
            const heroInput = document.getElementById('hero-quantity-input');
            if (heroInput) {
                heroInput.addEventListener('input', (e) => {
                    this.updateComparisonQuantity(parseInt(e.target.value) || 1);
                });
            }

            // Listen for escape key
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && this.state.isOpen) {
                    this.toggleComparison();
                }
            });
        },

        /**
         * Listen for pricing updates
         */
        listenForPricingUpdates() {
            // Listen for pricing data loaded
            document.addEventListener('pricingDataLoaded', () => {
                console.log('[PRICE-COMPARISON] Pricing data loaded, updating comparison...');
                this.updateComparisonData();
            });

            // Listen for quantity changes
            document.addEventListener('quantityChanged', (e) => {
                if (e.detail && e.detail.quantity) {
                    this.updateComparisonQuantity(e.detail.quantity);
                }
            });
        },

        /**
         * Toggle comparison view
         */
        toggleComparison() {
            const view = document.getElementById('price-comparison-view');
            const toggle = document.getElementById('price-comparison-toggle');
            
            if (!view || !toggle) return;

            this.state.isOpen = !this.state.isOpen;
            
            if (this.state.isOpen) {
                view.classList.add('show');
                toggle.classList.add('active');
                toggle.setAttribute('aria-expanded', 'true');
                
                // Update data and render
                this.updateComparisonData();
                this.renderComparison();
                
                // Focus on comparison view for accessibility
                view.focus();
                
                // Track event
                if (window.gtag) {
                    gtag('event', 'view_price_comparison', {
                        'event_category': 'engagement',
                        'event_label': 'cap_embroidery'
                    });
                }
            } else {
                view.classList.remove('show');
                toggle.classList.remove('active');
                toggle.setAttribute('aria-expanded', 'false');
            }
        },

        /**
         * Update comparison data from current pricing
         */
        updateComparisonData() {
            const quantity = parseInt(document.getElementById('hero-quantity-input')?.value) || this.config.defaultQuantity;
            this.state.currentQuantity = quantity;

            // Get pricing table data
            const pricingTable = document.getElementById('custom-pricing-grid');
            if (!pricingTable) return;

            const ranges = [];
            const rows = pricingTable.querySelectorAll('tbody tr');
            
            rows.forEach(row => {
                const cells = row.querySelectorAll('td');
                if (cells.length > 0) {
                    const rangeText = cells[0].textContent.trim();
                    const range = this.parseRange(rangeText);
                    
                    if (range) {
                        const priceData = {
                            range: rangeText,
                            min: range.min,
                            max: range.max,
                            prices: {}
                        };

                        // Assume cells correspond to stitch counts in order
                        if (cells.length > 1) priceData.prices[5000] = this.parsePrice(cells[1].textContent);
                        if (cells.length > 2) priceData.prices[8000] = this.parsePrice(cells[2].textContent);
                        if (cells.length > 3) priceData.prices[10000] = this.parsePrice(cells[3].textContent);

                        ranges.push(priceData);
                    }
                }
            });

            this.state.comparisonData = ranges;
            
            // Find current range
            this.state.selectedRange = ranges.find(r => 
                quantity >= r.min && quantity <= r.max
            ) || ranges[0];

            console.log('[PRICE-COMPARISON] Data updated:', this.state.comparisonData);
        },

        /**
         * Parse quantity range text
         */
        parseRange(text) {
            const match = text.match(/(\d+)\s*-\s*(\d+)/);
            if (match) {
                return {
                    min: parseInt(match[1]),
                    max: parseInt(match[2])
                };
            }
            return null;
        },

        /**
         * Parse price from text
         */
        parsePrice(text) {
            const cleanText = text.replace(/[^0-9.]/g, '');
            return parseFloat(cleanText) || 0;
        },

        /**
         * Render comparison view
         */
        renderComparison() {
            if (!this.state.comparisonData || this.state.comparisonData.length === 0) {
                this.renderLoading();
                return;
            }

            // Update quantity display
            const quantityDisplay = document.getElementById('comparison-quantity');
            if (quantityDisplay) {
                quantityDisplay.textContent = this.state.currentQuantity;
            }

            // Render quick switch buttons
            this.renderQuickSwitchButtons();

            // Render comparison table
            this.renderComparisonTable();

            // Render visual comparison
            this.renderVisualComparison();

            // Update savings summary
            this.updateSavingsSummary();
        },

        /**
         * Render loading state
         */
        renderLoading() {
            const tableBody = document.getElementById('comparison-table-body');
            if (tableBody) {
                tableBody.innerHTML = `
                    <tr>
                        <td colspan="4" class="comparison-loading">
                            <div class="comparison-loading-spinner"></div>
                            <span>Loading comparison data...</span>
                        </td>
                    </tr>
                `;
            }
        },

        /**
         * Render quick switch buttons
         */
        renderQuickSwitchButtons() {
            const container = document.getElementById('quick-switch-quantities');
            if (!container || !this.state.comparisonData) return;

            const quantities = [12, 24, 48, 144, 500];
            container.innerHTML = quantities.map(qty => `
                <button class="quick-switch-btn ${qty === this.state.currentQuantity ? 'active' : ''}"
                        data-quantity="${qty}"
                        aria-label="Compare prices for ${qty} caps">
                    ${qty} caps
                </button>
            `).join('');

            // Add click handlers
            container.querySelectorAll('.quick-switch-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const qty = parseInt(e.target.dataset.quantity);
                    document.getElementById('hero-quantity-input').value = qty;
                    document.getElementById('hero-quantity-input').dispatchEvent(new Event('input'));
                });
            });
        },

        /**
         * Render comparison table
         */
        renderComparisonTable() {
            const tbody = document.getElementById('comparison-table-body');
            if (!tbody || !this.state.comparisonData) return;

            tbody.innerHTML = this.state.comparisonData.map(range => {
                const isCurrentRange = this.state.selectedRange === range;
                const rowClass = isCurrentRange ? 'current-selection' : '';
                
                return `
                    <tr class="${rowClass}">
                        <td>${range.range}</td>
                        ${this.config.stitchCounts.map(count => {
                            const price = range.prices[count] || 0;
                            const isBest = this.isBestPrice(range, count);
                            const priceClass = isBest ? 'comparison-price best-value' : 'comparison-price';
                            
                            return `
                                <td>
                                    <div class="${priceClass}">$${price.toFixed(2)}</div>
                                    ${this.getPriceDifference(range, count)}
                                </td>
                            `;
                        }).join('')}
                    </tr>
                `;
            }).join('');
        },

        /**
         * Check if price is best in range
         */
        isBestPrice(range, stitchCount) {
            const prices = Object.values(range.prices);
            const currentPrice = range.prices[stitchCount];
            return currentPrice === Math.min(...prices);
        },

        /**
         * Get price difference display
         */
        getPriceDifference(range, stitchCount) {
            const basePrice = range.prices[8000]; // Use 8000 as baseline
            const currentPrice = range.prices[stitchCount];
            const diff = currentPrice - basePrice;
            
            if (Math.abs(diff) < 0.01) return '';
            
            if (diff < 0) {
                return `<span class="price-difference savings">Save $${Math.abs(diff).toFixed(2)}</span>`;
            } else {
                return `<span class="price-difference higher">+$${diff.toFixed(2)}</span>`;
            }
        },

        /**
         * Render visual comparison bars
         */
        renderVisualComparison() {
            const container = document.getElementById('comparison-bars');
            if (!container || !this.state.selectedRange) return;

            const range = this.state.selectedRange;
            const maxPrice = Math.max(...Object.values(range.prices));
            
            container.innerHTML = this.config.stitchCounts.map(count => {
                const price = range.prices[count] || 0;
                const percentage = (price / maxPrice) * 100;
                const isBest = this.isBestPrice(range, count);
                
                return `
                    <div class="comparison-bar-item">
                        <div class="comparison-bar-header">
                            <span class="comparison-bar-label">${count.toLocaleString()} stitches</span>
                            <span class="comparison-bar-value">$${price.toFixed(2)}</span>
                        </div>
                        <div class="comparison-bar-track">
                            <div class="comparison-bar-fill ${isBest ? 'best' : ''}" 
                                 style="width: ${percentage}%"></div>
                        </div>
                    </div>
                `;
            }).join('');
        },

        /**
         * Update savings summary
         */
        updateSavingsSummary() {
            if (!this.state.selectedRange) return;

            const range = this.state.selectedRange;
            const prices = Object.values(range.prices);
            const minPrice = Math.min(...prices);
            const maxPrice = Math.max(...prices);
            const savings = maxPrice - minPrice;

            // Find best option
            let bestOption = 8000;
            for (const [count, price] of Object.entries(range.prices)) {
                if (price === minPrice) {
                    bestOption = parseInt(count);
                    break;
                }
            }

            // Update display
            document.getElementById('best-price-value').textContent = `$${minPrice.toFixed(2)}`;
            document.getElementById('max-savings-value').textContent = `$${savings.toFixed(2)}`;
            document.getElementById('recommended-option').textContent = `${bestOption.toLocaleString()} stitches`;

            // Show summary
            document.getElementById('savings-summary').style.display = 'block';
        },

        /**
         * Update comparison for new quantity
         */
        updateComparisonQuantity(quantity) {
            this.state.currentQuantity = quantity;
            
            if (this.state.isOpen) {
                this.updateComparisonData();
                this.renderComparison();
            }
        }
    };

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            NWCA.ui.PriceComparison.initialize();
        });
    } else {
        setTimeout(() => NWCA.ui.PriceComparison.initialize(), 100);
    }

    console.log('[PRICE-COMPARISON] Module loaded');

})();