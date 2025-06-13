/**
 * Screen Print Pricing V2 - Complete Refactor
 * Single file handling all UI and calculations
 * Clear, maintainable, no legacy code
 */

class ScreenPrintPricing {
    constructor() {
        // Configuration
        this.config = {
            minimumQuantity: 24,
            standardQuantity: 48,
            ltmThreshold: 48,
            ltmFee: 50,
            setupFeePerColor: 30,
            maxAdditionalLocations: 3,
            darkColors: ['black', 'navy', 'charcoal', 'forest', 'maroon', 'purple', 'brown', 'dark'],
            colorOptions: [
                { value: 0, label: 'No Print' },
                { value: 1, label: '1 Color' },
                { value: 2, label: '2 Colors' },
                { value: 3, label: '3 Colors' },
                { value: 4, label: '4 Colors' },
                { value: 5, label: '5 Colors' },
                { value: 6, label: '6 Colors' }
            ],
            locationOptions: [
                { value: 'back', label: 'Back' },
                { value: 'left-chest', label: 'Left Chest' },
                { value: 'right-chest', label: 'Right Chest' },
                { value: 'left-sleeve', label: 'Left Sleeve' },
                { value: 'right-sleeve', label: 'Right Sleeve' },
                { value: 'custom', label: 'Other Location' }
            ]
        };

        // State - single source of truth
        this.state = {
            quantity: 48,
            frontColors: 1,
            additionalLocations: [], // [{location: 'back', colors: 2}, ...]
            isDarkGarment: false,
            garmentColor: '',
            styleNumber: '',
            productTitle: '',
            pricingData: null,
            masterBundle: null
        };

        // DOM elements cache
        this.elements = {};
        
        // Initialize when DOM ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.init());
        } else {
            this.init();
        }
    }

    init() {
        console.log('[ScreenPrintV2] Initializing...');
        this.cacheElements();
        this.createUI();
        this.bindEvents();
        this.checkUrlParams();
        this.updateDisplay();
    }

    cacheElements() {
        // Cache commonly used elements
        this.elements = {
            container: document.getElementById('screenprint-calculator-v2'),
            quantityInput: null, // Will be set after UI creation
            frontColorsSelect: null,
            locationsContainer: null,
            darkGarmentCheckbox: null,
            // Pricing display elements
            basePrice: null,
            allInPrice: null,
            grandTotal: null,
            setupFee: null,
            // Accordions
            tiersAccordion: null,
            tiersContent: null
        };
    }

    createUI() {
        const container = this.elements.container;
        if (!container) {
            console.error('[ScreenPrintV2] Container not found');
            return;
        }

        container.innerHTML = `
            <div class="sp-calculator">
                <h3 class="sp-title">Screen Print Pricing Calculator</h3>
                
                <div class="sp-layout">
                    <!-- Controls -->
                    <div class="sp-controls">
                        <!-- Quantity -->
                        <div class="sp-control-group">
                            <label for="sp-quantity">Quantity:</label>
                            <input type="number" id="sp-quantity" min="${this.config.minimumQuantity}" 
                                   value="${this.state.quantity}" step="1" class="sp-input">
                            <span class="sp-help-text">Minimum ${this.config.minimumQuantity} pieces</span>
                        </div>

                        <!-- Front Colors -->
                        <div class="sp-control-group">
                            <label for="sp-front-colors">Front Design Colors:</label>
                            <select id="sp-front-colors" class="sp-select">
                                ${this.config.colorOptions.map(opt => 
                                    `<option value="${opt.value}" ${opt.value === 1 ? 'selected' : ''}>${opt.label}</option>`
                                ).join('')}
                            </select>
                        </div>

                        <!-- Additional Locations -->
                        <div class="sp-control-group">
                            <label>Additional Print Locations:</label>
                            <div id="sp-additional-locations"></div>
                            <button type="button" id="sp-add-location" class="sp-btn sp-btn-add">
                                + Add Location
                            </button>
                        </div>

                        <!-- Dark Garment -->
                        <div class="sp-control-group">
                            <label class="sp-checkbox-label">
                                <input type="checkbox" id="sp-dark-garment">
                                Dark garment (needs white underbase)
                            </label>
                            <span class="sp-help-text">Adds 1 color per location</span>
                        </div>
                    </div>

                    <!-- Pricing Display -->
                    <div class="sp-pricing">
                        <div class="sp-price-box">
                            <div class="sp-price-main">
                                <span class="sp-currency">$</span>
                                <span id="sp-base-price" class="sp-price-value">0.00</span>
                                <span class="sp-price-label">per shirt</span>
                            </div>
                            <div class="sp-price-subtitle">shirt + printing</div>

                            <div class="sp-divider"></div>

                            <div class="sp-breakdown">
                                <div class="sp-breakdown-row">
                                    <span>Setup impact:</span>
                                    <span id="sp-setup-impact">+$0.00</span>
                                </div>
                                <div class="sp-breakdown-row sp-total">
                                    <span>All-in price:</span>
                                    <span id="sp-all-in-price">$0.00</span>
                                </div>
                            </div>

                            <div class="sp-order-total">
                                <span>Total order:</span>
                                <span id="sp-grand-total">$0.00</span>
                            </div>
                        </div>

                        <!-- Setup Details -->
                        <div class="sp-setup-details">
                            <div class="sp-setup-header">
                                <span>One-time Setup:</span>
                                <span id="sp-setup-fee">$0.00</span>
                            </div>
                            <div id="sp-setup-breakdown" class="sp-setup-breakdown"></div>
                        </div>

                        <!-- LTM Warning -->
                        <div id="sp-ltm-warning" class="sp-ltm-warning" style="display: none;">
                            <span>⚠️ Small order fee applies: <strong id="sp-ltm-fee">$50.00</strong></span>
                        </div>
                    </div>
                </div>

                <!-- Order Summary -->
                <div id="sp-order-summary" class="sp-order-summary" style="display: none;">
                    <h4>Order Summary</h4>
                    <div id="sp-summary-content"></div>
                </div>

                <!-- Accordions -->
                <div class="sp-accordions">
                    <button type="button" class="sp-accordion-trigger" data-target="pricing-tiers">
                        <span class="sp-accordion-icon">▶</span>
                        View All Pricing Tiers
                    </button>
                    <div id="pricing-tiers" class="sp-accordion-content" style="display: none;">
                        <div id="sp-tiers-content">Loading pricing tiers...</div>
                    </div>

                    <button type="button" class="sp-accordion-trigger" data-target="location-pricing">
                        <span class="sp-accordion-icon">▶</span>
                        Additional Location Pricing Guide
                    </button>
                    <div id="location-pricing" class="sp-accordion-content" style="display: none;">
                        <div id="sp-location-guide">
                            <p>Additional print locations are charged per piece based on the number of colors.</p>
                            <p>Setup fees apply to each location and color.</p>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Update element references
        this.elements.quantityInput = document.getElementById('sp-quantity');
        this.elements.frontColorsSelect = document.getElementById('sp-front-colors');
        this.elements.locationsContainer = document.getElementById('sp-additional-locations');
        this.elements.darkGarmentCheckbox = document.getElementById('sp-dark-garment');
        this.elements.basePrice = document.getElementById('sp-base-price');
        this.elements.allInPrice = document.getElementById('sp-all-in-price');
        this.elements.grandTotal = document.getElementById('sp-grand-total');
        this.elements.setupFee = document.getElementById('sp-setup-fee');
        this.elements.setupImpact = document.getElementById('sp-setup-impact');
        this.elements.ltmWarning = document.getElementById('sp-ltm-warning');
        this.elements.ltmFee = document.getElementById('sp-ltm-fee');
        this.elements.setupBreakdown = document.getElementById('sp-setup-breakdown');
        this.elements.orderSummary = document.getElementById('sp-order-summary');
        this.elements.summaryContent = document.getElementById('sp-summary-content');
        this.elements.tiersContent = document.getElementById('sp-tiers-content');
    }

    bindEvents() {
        // Quantity changes
        this.elements.quantityInput?.addEventListener('input', (e) => {
            this.updateQuantity(parseInt(e.target.value) || 0);
        });

        // Front colors changes
        this.elements.frontColorsSelect?.addEventListener('change', (e) => {
            this.updateFrontColors(parseInt(e.target.value) || 0);
        });

        // Add location button
        document.getElementById('sp-add-location')?.addEventListener('click', () => {
            this.addLocation();
        });

        // Dark garment toggle
        this.elements.darkGarmentCheckbox?.addEventListener('change', (e) => {
            this.updateDarkGarment(e.target.checked);
        });

        // Accordion toggles
        document.querySelectorAll('.sp-accordion-trigger').forEach(trigger => {
            trigger.addEventListener('click', () => this.toggleAccordion(trigger));
        });

        // Listen for location changes (delegated)
        this.elements.locationsContainer?.addEventListener('change', (e) => {
            if (e.target.classList.contains('sp-location-select') || 
                e.target.classList.contains('sp-location-colors')) {
                this.updateLocations();
            }
        });

        // Remove location buttons (delegated)
        this.elements.locationsContainer?.addEventListener('click', (e) => {
            if (e.target.classList.contains('sp-remove-location')) {
                const index = parseInt(e.target.dataset.index);
                this.removeLocation(index);
            }
        });

        // Listen for pricing data from adapter
        document.addEventListener('screenPrintMasterBundleReady', (e) => {
            this.handleMasterBundle(e.detail);
        });

        // Listen for color changes from product display
        document.addEventListener('productColorChanged', (e) => {
            if (e.detail?.color) {
                this.updateGarmentColor(e.detail.color);
            }
        });
    }

    checkUrlParams() {
        const params = new URLSearchParams(window.location.search);
        const color = params.get('COLOR') || params.get('color');
        if (color) {
            this.updateGarmentColor(color);
        }
    }

    // State update methods
    updateQuantity(quantity) {
        if (quantity < this.config.minimumQuantity) {
            this.showError(`Minimum quantity is ${this.config.minimumQuantity}`);
            this.elements.quantityInput.value = this.config.minimumQuantity;
            quantity = this.config.minimumQuantity;
        }
        this.state.quantity = quantity;
        this.updateDisplay();
    }

    updateFrontColors(colors) {
        this.state.frontColors = colors;
        this.updateDisplay();
    }

    updateDarkGarment(isDark) {
        this.state.isDarkGarment = isDark;
        this.updateDisplay();
    }

    updateGarmentColor(color) {
        this.state.garmentColor = color;
        // Auto-detect dark garment
        const isDark = this.config.darkColors.some(dark => 
            color.toLowerCase().includes(dark.toLowerCase())
        );
        this.state.isDarkGarment = isDark;
        if (this.elements.darkGarmentCheckbox) {
            this.elements.darkGarmentCheckbox.checked = isDark;
        }
        this.updateDisplay();
    }

    addLocation() {
        if (this.state.additionalLocations.length >= this.config.maxAdditionalLocations) {
            this.showError(`Maximum ${this.config.maxAdditionalLocations} additional locations`);
            return;
        }

        const index = this.state.additionalLocations.length;
        this.state.additionalLocations.push({
            location: 'back',
            colors: 1
        });

        // Add UI element
        const locationDiv = document.createElement('div');
        locationDiv.className = 'sp-location-row';
        locationDiv.dataset.index = index;
        locationDiv.innerHTML = `
            <select class="sp-location-select sp-select" data-index="${index}">
                ${this.config.locationOptions.map(opt => 
                    `<option value="${opt.value}">${opt.label}</option>`
                ).join('')}
            </select>
            <select class="sp-location-colors sp-select" data-index="${index}">
                ${this.config.colorOptions.slice(1).map(opt => 
                    `<option value="${opt.value}">${opt.label}</option>`
                ).join('')}
            </select>
            <button type="button" class="sp-remove-location sp-btn-remove" data-index="${index}">×</button>
        `;

        this.elements.locationsContainer.appendChild(locationDiv);
        this.updateLocationButtonVisibility();
        this.updateDisplay();
    }

    removeLocation(index) {
        this.state.additionalLocations.splice(index, 1);
        
        // Remove UI element
        const locationRow = this.elements.locationsContainer.querySelector(`[data-index="${index}"]`);
        if (locationRow) {
            locationRow.remove();
        }

        // Re-index remaining locations
        this.reindexLocations();
        this.updateLocationButtonVisibility();
        this.updateDisplay();
    }

    updateLocations() {
        // Rebuild locations array from UI
        const locationRows = this.elements.locationsContainer.querySelectorAll('.sp-location-row');
        this.state.additionalLocations = Array.from(locationRows).map(row => {
            const locationSelect = row.querySelector('.sp-location-select');
            const colorsSelect = row.querySelector('.sp-location-colors');
            return {
                location: locationSelect.value,
                colors: parseInt(colorsSelect.value) || 1
            };
        });
        this.updateDisplay();
    }

    reindexLocations() {
        const locationRows = this.elements.locationsContainer.querySelectorAll('.sp-location-row');
        locationRows.forEach((row, index) => {
            row.dataset.index = index;
            row.querySelector('.sp-location-select').dataset.index = index;
            row.querySelector('.sp-location-colors').dataset.index = index;
            row.querySelector('.sp-remove-location').dataset.index = index;
        });
    }

    updateLocationButtonVisibility() {
        const addButton = document.getElementById('sp-add-location');
        if (addButton) {
            addButton.style.display = 
                this.state.additionalLocations.length >= this.config.maxAdditionalLocations ? 'none' : 'block';
        }
    }

    // Pricing calculations
    calculatePricing() {
        const pricing = {
            quantity: this.state.quantity,
            frontColors: this.state.frontColors,
            additionalLocations: this.state.additionalLocations,
            isDarkGarment: this.state.isDarkGarment,
            basePrice: 0,
            additionalCost: 0,
            setupFee: 0,
            ltmFee: 0,
            subtotal: 0,
            grandTotal: 0,
            perShirtTotal: 0,
            setupPerShirt: 0,
            colorBreakdown: {
                front: 0,
                locations: []
            }
        };

        // Calculate actual colors (including white base if needed)
        pricing.colorBreakdown.front = this.state.frontColors;
        if (this.state.isDarkGarment && this.state.frontColors > 0) {
            pricing.colorBreakdown.front += 1;
        }

        // Calculate setup for front
        pricing.setupFee = pricing.colorBreakdown.front * this.config.setupFeePerColor;

        // Calculate additional locations
        this.state.additionalLocations.forEach(loc => {
            let locationColors = loc.colors;
            if (this.state.isDarkGarment && locationColors > 0) {
                locationColors += 1;
            }
            
            pricing.colorBreakdown.locations.push({
                ...loc,
                totalColors: locationColors,
                setupCost: locationColors * this.config.setupFeePerColor
            });

            pricing.setupFee += locationColors * this.config.setupFeePerColor;
        });

        // Get base price from pricing data
        if (this.state.pricingData) {
            const tier = this.findPricingTier(this.state.quantity);
            if (tier) {
                // Get base price for front colors
                const frontPricing = this.state.pricingData.primaryLocationPricing?.[this.state.frontColors];
                if (frontPricing?.tiers) {
                    const frontTier = frontPricing.tiers.find(t => 
                        this.state.quantity >= t.minQty && 
                        (!t.maxQty || this.state.quantity <= t.maxQty)
                    );
                    if (frontTier?.prices) {
                        // Use first available size price
                        const sizes = Object.keys(frontTier.prices);
                        if (sizes.length > 0) {
                            pricing.basePrice = parseFloat(frontTier.prices[sizes[0]]) || 0;
                        }
                    }
                }

                // Calculate additional location costs
                if (this.state.pricingData.additionalLocationPricing) {
                    pricing.colorBreakdown.locations.forEach((loc, index) => {
                        const addlPricing = this.state.pricingData.additionalLocationPricing;
                        if (addlPricing?.tiers) {
                            const addlTier = addlPricing.tiers.find(t => 
                                this.state.quantity >= t.minQty && 
                                (!t.maxQty || this.state.quantity <= t.maxQty)
                            );
                            if (addlTier?.pricePerPiece) {
                                loc.costPerPiece = parseFloat(addlTier.pricePerPiece) || 0;
                                pricing.additionalCost += loc.costPerPiece;
                            }
                        }
                    });
                }
            }
        }

        // Calculate totals
        const pricePerShirt = pricing.basePrice + pricing.additionalCost;
        pricing.subtotal = pricePerShirt * this.state.quantity;
        
        // LTM fee
        if (this.state.quantity < this.config.ltmThreshold) {
            pricing.ltmFee = this.config.ltmFee;
        }

        // Final calculations
        pricing.grandTotal = pricing.subtotal + pricing.setupFee + pricing.ltmFee;
        pricing.setupPerShirt = pricing.setupFee / this.state.quantity;
        pricing.perShirtTotal = pricePerShirt + pricing.setupPerShirt + (pricing.ltmFee / this.state.quantity);

        return pricing;
    }

    findPricingTier(quantity) {
        if (!this.state.pricingData?.primaryLocationPricing) return null;
        
        const colorPricing = this.state.pricingData.primaryLocationPricing[this.state.frontColors];
        if (!colorPricing?.tiers) return null;

        return colorPricing.tiers.find(tier => 
            quantity >= tier.minQty && (!tier.maxQty || quantity <= tier.maxQty)
        );
    }

    // Display updates
    updateDisplay() {
        const pricing = this.calculatePricing();
        
        // Update main price display
        this.elements.basePrice.textContent = (pricing.basePrice + pricing.additionalCost).toFixed(2);
        this.elements.setupImpact.textContent = `+$${pricing.setupPerShirt.toFixed(2)}`;
        this.elements.allInPrice.textContent = `$${pricing.perShirtTotal.toFixed(2)}`;
        this.elements.grandTotal.textContent = `$${pricing.grandTotal.toFixed(2)}`;
        this.elements.setupFee.textContent = `$${pricing.setupFee.toFixed(2)}`;

        // Update setup breakdown
        this.updateSetupBreakdown(pricing);

        // Update LTM warning
        this.elements.ltmWarning.style.display = pricing.ltmFee > 0 ? 'block' : 'none';
        this.elements.ltmFee.textContent = `$${pricing.ltmFee.toFixed(2)}`;

        // Update order summary
        this.updateOrderSummary(pricing);
    }

    updateSetupBreakdown(pricing) {
        let html = '';
        
        if (pricing.colorBreakdown.front > 0) {
            html += `• Front (${pricing.colorBreakdown.front} color${pricing.colorBreakdown.front > 1 ? 's' : ''}): $${(pricing.colorBreakdown.front * this.config.setupFeePerColor).toFixed(2)}<br>`;
        }

        pricing.colorBreakdown.locations.forEach(loc => {
            const label = this.config.locationOptions.find(opt => opt.value === loc.location)?.label || loc.location;
            html += `• ${label} (${loc.totalColors} color${loc.totalColors > 1 ? 's' : ''}): $${loc.setupCost.toFixed(2)}<br>`;
        });

        this.elements.setupBreakdown.innerHTML = html;
    }

    updateOrderSummary(pricing) {
        if (pricing.quantity === 0 || pricing.basePrice === 0) {
            this.elements.orderSummary.style.display = 'none';
            return;
        }

        this.elements.orderSummary.style.display = 'block';
        
        let html = '<table class="sp-summary-table">';
        
        // Base shirts
        html += `
            <tr>
                <td>${pricing.quantity} × ${this.state.styleNumber || 'Shirts'}</td>
                <td>@ $${pricing.basePrice.toFixed(2)} ea</td>
                <td class="sp-summary-total">$${(pricing.basePrice * pricing.quantity).toFixed(2)}</td>
            </tr>
        `;

        // Additional locations
        if (pricing.colorBreakdown.locations.length > 0) {
            html += '<tr><td colspan="3" class="sp-summary-divider"></td></tr>';
            html += '<tr><td colspan="3" class="sp-summary-section">Additional Locations:</td></tr>';
            
            pricing.colorBreakdown.locations.forEach(loc => {
                if (loc.costPerPiece > 0) {
                    const label = this.config.locationOptions.find(opt => opt.value === loc.location)?.label || loc.location;
                    html += `
                        <tr class="sp-summary-indent">
                            <td>${label} (${loc.colors} color${loc.colors > 1 ? 's' : ''})</td>
                            <td>@ $${loc.costPerPiece.toFixed(2)} ea</td>
                            <td class="sp-summary-total">$${(loc.costPerPiece * pricing.quantity).toFixed(2)}</td>
                        </tr>
                    `;
                }
            });
        }

        // Subtotal
        html += `
            <tr class="sp-summary-subtotal">
                <td colspan="2">Subtotal:</td>
                <td class="sp-summary-total">$${pricing.subtotal.toFixed(2)}</td>
            </tr>
        `;

        // Setup fees
        html += '<tr><td colspan="3" class="sp-summary-divider"></td></tr>';
        html += `
            <tr>
                <td colspan="2">Setup Fees:</td>
                <td class="sp-summary-total">$${pricing.setupFee.toFixed(2)}</td>
            </tr>
        `;

        // LTM fee if applicable
        if (pricing.ltmFee > 0) {
            html += `
                <tr>
                    <td colspan="2">Small Order Fee:</td>
                    <td class="sp-summary-total">$${pricing.ltmFee.toFixed(2)}</td>
                </tr>
            `;
        }

        // Grand total
        html += `
            <tr class="sp-summary-grand-total">
                <td colspan="2">TOTAL:</td>
                <td class="sp-summary-total">$${pricing.grandTotal.toFixed(2)}</td>
            </tr>
            <tr class="sp-summary-per-item">
                <td colspan="2">Per Shirt Cost:</td>
                <td class="sp-summary-total">$${pricing.perShirtTotal.toFixed(2)}</td>
            </tr>
        `;

        html += '</table>';
        this.elements.summaryContent.innerHTML = html;
    }

    updatePricingTiers() {
        if (!this.state.pricingData?.primaryLocationPricing) {
            this.elements.tiersContent.innerHTML = '<p>Pricing tiers not available</p>';
            return;
        }

        let html = '<table class="sp-tiers-table"><thead><tr><th>Quantity</th>';
        
        // Get sizes from first tier
        const firstColorPricing = this.state.pricingData.primaryLocationPricing['1'];
        if (!firstColorPricing?.tiers?.[0]?.prices) {
            this.elements.tiersContent.innerHTML = '<p>Pricing tiers not available</p>';
            return;
        }

        const sizes = Object.keys(firstColorPricing.tiers[0].prices);
        sizes.forEach(size => {
            html += `<th>${size}</th>`;
        });
        html += '<th>Savings</th></tr></thead><tbody>';

        // Add rows for each tier
        let basePriceForSavings = null;
        firstColorPricing.tiers.forEach((tier, index) => {
            const isCurrentTier = this.state.quantity >= tier.minQty && 
                                  (!tier.maxQty || this.state.quantity <= tier.maxQty);
            
            html += `<tr class="${isCurrentTier ? 'sp-current-tier' : ''}">`;
            html += `<td class="sp-tier-range">${tier.minQty}-${tier.maxQty || '576+'}</td>`;
            
            // Add prices for each size
            let firstPrice = null;
            sizes.forEach(size => {
                const price = tier.prices[size];
                if (price && !firstPrice) firstPrice = price;
                html += `<td>${price ? `$${parseFloat(price).toFixed(2)}` : '-'}</td>`;
            });
            
            // Calculate savings
            if (index === 0) {
                basePriceForSavings = firstPrice;
                html += '<td>-</td>';
            } else if (basePriceForSavings && firstPrice) {
                const savings = ((basePriceForSavings - firstPrice) / basePriceForSavings * 100).toFixed(0);
                html += `<td class="sp-savings">${savings}% off</td>`;
            } else {
                html += '<td>-</td>';
            }
            
            html += '</tr>';
        });

        html += '</tbody></table>';
        html += '<p class="sp-tiers-note">Prices shown are per shirt for 1 color front print.</p>';
        
        this.elements.tiersContent.innerHTML = html;
    }

    // UI helpers
    toggleAccordion(trigger) {
        const targetId = trigger.dataset.target;
        const content = document.getElementById(targetId);
        const icon = trigger.querySelector('.sp-accordion-icon');
        
        if (content.style.display === 'none') {
            content.style.display = 'block';
            icon.style.transform = 'rotate(90deg)';
            
            // Load content if needed
            if (targetId === 'pricing-tiers' && !this.tiersLoaded) {
                this.updatePricingTiers();
                this.tiersLoaded = true;
            }
        } else {
            content.style.display = 'none';
            icon.style.transform = 'rotate(0deg)';
        }
    }

    showError(message) {
        // Simple alert for now, can be enhanced later
        alert(message);
    }

    // Handle master bundle data
    handleMasterBundle(data) {
        console.log('[ScreenPrintV2] Received master bundle:', data);
        this.state.masterBundle = data;
        this.state.pricingData = data;
        
        // Extract product info
        if (data.styleNumber) this.state.styleNumber = data.styleNumber;
        if (data.productTitle) this.state.productTitle = data.productTitle;
        
        // Update display with new pricing
        this.updateDisplay();
        
        // Update tiers if accordion is open
        const tiersContent = document.getElementById('pricing-tiers');
        if (tiersContent && tiersContent.style.display !== 'none') {
            this.updatePricingTiers();
        }
    }
}

// Initialize when script loads
window.ScreenPrintPricingV2 = new ScreenPrintPricing();