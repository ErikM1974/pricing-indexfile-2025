/**
 * Universal Pricing Grid Component
 * Displays size upcharges dynamically based on available sizes from API
 */

(function() {
    'use strict';

    class UniversalPricingGrid {
        constructor() {
            this.upchargeContainer = null;
            this.availableSizes = [];
            this.upcharges = {};
            this.styleNumber = null;
            this.init();
        }

        init() {
            // Wait for DOM to be ready
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', () => this.setup());
            } else {
                this.setup();
            }
        }

        setup() {
            this.upchargeContainer = document.querySelector('.upcharge-info');

            // Listen for pricing data updates from adapters
            document.addEventListener('dtgPricingDataLoaded', (event) => this.handlePricingData(event.detail));
            document.addEventListener('dtfPricingDataLoaded', (event) => this.handlePricingData(event.detail));
            document.addEventListener('embroideryPricingDataLoaded', (event) => this.handlePricingData(event.detail));
            document.addEventListener('screenPrintPricingDataLoaded', (event) => this.handlePricingData(event.detail));

            // Also listen for generic pricing updates
            document.addEventListener('pricingDataLoaded', (event) => this.handlePricingData(event.detail));

            console.log('[UniversalPricingGrid] Initialized and listening for pricing data');
        }

        handlePricingData(data) {
            console.log('[UniversalPricingGrid] Received pricing data:', data);

            // Extract available sizes and upcharges from the data
            if (data && data.bundle) {
                const bundle = data.bundle;

                // Get available sizes from the sizes array
                if (bundle.sizes && Array.isArray(bundle.sizes)) {
                    this.availableSizes = bundle.sizes.map(sizeInfo => sizeInfo.size);
                    console.log('[UniversalPricingGrid] Available sizes:', this.availableSizes);
                }

                // Get upcharges
                if (bundle.sellingPriceDisplayAddOns) {
                    this.upcharges = bundle.sellingPriceDisplayAddOns;
                    console.log('[UniversalPricingGrid] All upcharges:', this.upcharges);
                }

                // Update the display
                this.updateUpchargeDisplay();
            }
        }

        updateUpchargeDisplay() {
            if (!this.upchargeContainer) {
                console.warn('[UniversalPricingGrid] Upcharge container not found');
                return;
            }

            // Preserve the title if it exists
            const existingTitle = this.upchargeContainer.querySelector('h3');

            // Clear existing content but preserve the title
            if (existingTitle) {
                // Remove all elements except the title
                const elementsToRemove = Array.from(this.upchargeContainer.children).filter(child => child !== existingTitle);
                elementsToRemove.forEach(element => element.remove());
            } else {
                // Clear everything if no title
                this.upchargeContainer.innerHTML = '';
            }

            // Filter upcharges to only show sizes that exist for this product
            const filteredUpcharges = this.filterUpchargesByAvailableSizes();

            if (Object.keys(filteredUpcharges).length === 0) {
                this.upchargeContainer.innerHTML = '<p class="text-muted">No size upcharges available</p>';
                return;
            }

            // Group sizes by upcharge amount
            const upchargeGroups = this.groupUpchargesByAmount(filteredUpcharges);

            // Create the display HTML
            const html = this.generateUpchargeHTML(upchargeGroups);
            this.upchargeContainer.innerHTML = html;

            console.log('[UniversalPricingGrid] Updated upcharge display with filtered sizes');
        }

        filterUpchargesByAvailableSizes() {
            const filtered = {};

            // Only include upcharges for sizes that actually exist for this product
            Object.entries(this.upcharges).forEach(([size, upchargeAmount]) => {
                if (this.availableSizes.includes(size) && upchargeAmount > 0) {
                    filtered[size] = upchargeAmount;
                }
            });

            console.log('[UniversalPricingGrid] Filtered upcharges:', filtered);
            return filtered;
        }

        groupUpchargesByAmount(upcharges) {
            const groups = {};

            Object.entries(upcharges).forEach(([size, amount]) => {
                const key = amount.toFixed(2);
                if (!groups[key]) {
                    groups[key] = [];
                }
                groups[key].push(size);
            });

            // Sort sizes within each group
            Object.keys(groups).forEach(key => {
                groups[key].sort((a, b) => {
                    // Custom sort to handle sizes properly
                    const sizeOrder = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL', '6XL',
                                      'LT', 'XLT', '2XLT', '3XLT', '4XLT', '5XLT', '6XLT'];
                    return sizeOrder.indexOf(a) - sizeOrder.indexOf(b);
                });
            });

            return groups;
        }

        generateUpchargeHTML(upchargeGroups) {
            let html = '<div class="upcharge-grid">';

            // Sort by upcharge amount
            const sortedAmounts = Object.keys(upchargeGroups).sort((a, b) => parseFloat(a) - parseFloat(b));

            sortedAmounts.forEach(amount => {
                const sizes = upchargeGroups[amount];
                const formattedAmount = parseFloat(amount) === 0 ? 'No upcharge' : `+$${amount}`;
                const sizesText = sizes.join(', ');

                html += `
                    <div class="upcharge-row">
                        <span class="upcharge-sizes">${sizesText}:</span>
                        <span class="upcharge-amount">${formattedAmount}</span>
                    </div>
                `;
            });

            html += '</div>';

            // Add some basic styling if not already present
            if (!document.querySelector('#universal-pricing-grid-styles')) {
                const styleElement = document.createElement('style');
                styleElement.id = 'universal-pricing-grid-styles';
                styleElement.textContent = `
                    .upcharge-grid {
                        display: flex;
                        flex-direction: column;
                        gap: 0.5rem;
                    }
                    .upcharge-row {
                        display: flex;
                        justify-content: space-between;
                        padding: 0.5rem;
                        background: #f8f9fa;
                        border-radius: 4px;
                    }
                    .upcharge-sizes {
                        font-weight: 500;
                        color: #495057;
                    }
                    .upcharge-amount {
                        font-weight: 600;
                        color: #28a745;
                    }
                `;
                document.head.appendChild(styleElement);
            }

            return html;
        }

        // Public method to manually update with data
        updateWithData(sizes, upcharges) {
            if (sizes && Array.isArray(sizes)) {
                this.availableSizes = sizes.map(s => typeof s === 'string' ? s : s.size);
            }
            if (upcharges) {
                this.upcharges = upcharges;
            }
            this.updateUpchargeDisplay();
        }

        // Public method to load size pricing from API
        async loadSizePricing(styleNumber) {
            if (!styleNumber) return;

            this.styleNumber = styleNumber;
            console.log(`[UniversalPricingGrid] Loading size pricing for ${styleNumber}`);

            try {
                const response = await fetch(`https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/size-pricing?styleNumber=${styleNumber}`);
                if (!response.ok) {
                    throw new Error(`Failed to fetch size pricing: ${response.status}`);
                }

                const data = await response.json();
                console.log('[UniversalPricingGrid] Size pricing data received:', data);

                if (data && data.length > 0) {
                    // Use the first color's data (they should all have the same sizes and upcharges)
                    const firstColor = data[0];

                    // Extract available sizes from basePrices keys
                    this.availableSizes = Object.keys(firstColor.basePrices);
                    console.log('[UniversalPricingGrid] Available sizes from API:', this.availableSizes);

                    // Use the sizeUpcharges directly - it's already filtered!
                    this.upcharges = firstColor.sizeUpcharges || {};
                    console.log('[UniversalPricingGrid] Size upcharges from API:', this.upcharges);

                    // Update the display
                    this.updateUpchargeDisplay();
                }
            } catch (error) {
                console.error('[UniversalPricingGrid] Error loading size pricing:', error);
                // Fall back to event-based data if API fails
            }
        }
    }

    // Create and expose the instance
    window.UniversalPricingGrid = new UniversalPricingGrid();

    // Also expose the class for potential custom instances
    window.UniversalPricingGridClass = UniversalPricingGrid;

    console.log('[UniversalPricingGrid] Component loaded and initialized');
})();