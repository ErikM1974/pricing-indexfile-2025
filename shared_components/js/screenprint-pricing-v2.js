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
        this.elements = {
            container: document.getElementById('screenprint-calculator-v2'),
            quantityInput: null, 
            frontColorsSelect: null,
            locationsContainer: null,
            darkGarmentCheckbox: null,
            basePrice: document.getElementById('sp-base-price'), // Main displayed price (all-in)
            priceSubtitle: document.getElementById('sp-price-subtitle-dynamic'),
            darkGarmentIndicator: document.getElementById('sp-dark-garment-indicator'),
            // Removed setupImpactContainer, setupImpactDisplay, ltmImpactContainer, ltmImpactDisplay from direct caching here
            // as their display is now part of the dynamic subtitle logic or removed from this specific box.
            // However, their values will be used in updateDynamicSubtitle.
            // The actual HTML elements for these might be removed or repurposed in createUI.
            setupFee: document.getElementById('sp-setup-fee'), // For the "One-time Setup" box
            ltmWarning: document.getElementById('sp-ltm-warning'),
            ltmFee: document.getElementById('sp-ltm-fee'), // For the LTM warning box value
            tiersAccordion: null, // Assuming these are still needed for accordions
            tiersContent: document.getElementById('sp-tiers-content'),
            additionalLocationGuideContent: document.getElementById('sp-location-guide'),
            orderSummary: document.getElementById('sp-order-summary'),
            summaryContent: document.getElementById('sp-summary-content'),
            setupBreakdown: document.getElementById('sp-setup-breakdown')
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
                            <div id="sp-price-subtitle-dynamic" class="sp-price-subtitle" style="font-size: 0.8em; line-height: 1.3; margin-top: 5px; text-align: center;"></div>
                            <div id="sp-dark-garment-indicator" class="sp-help-text" style="font-size: 0.75em; text-align: center; display: none; margin-top: 3px;"></div>
                            
                            <!-- Setup and LTM impact lines are removed from here, will be part of subtitle -->
                        </div>
                        <!-- Setup Details (Separate Box) -->
                        <div class="sp-setup-details">
                            <div class="sp-setup-header">
                                <span>One-time Setup:</span>
                                <span id="sp-setup-fee">$0.00</span>
                            </div>
                            <div id="sp-setup-breakdown" class="sp-setup-breakdown"></div>
                        </div>

                        <!-- LTM Warning (Separate Box) -->
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
        // Re-cache elements that are created inside container.innerHTML
        this.elements.quantityInput = document.getElementById('sp-quantity');
        this.elements.frontColorsSelect = document.getElementById('sp-front-colors');
        this.elements.locationsContainer = document.getElementById('sp-additional-locations');
        this.elements.darkGarmentCheckbox = document.getElementById('sp-dark-garment');
        this.elements.basePrice = document.getElementById('sp-base-price');
        this.elements.priceSubtitle = document.getElementById('sp-price-subtitle-dynamic');
        this.elements.darkGarmentIndicator = document.getElementById('sp-dark-garment-indicator');
        this.elements.setupFee = document.getElementById('sp-setup-fee');
        this.elements.ltmWarning = document.getElementById('sp-ltm-warning');
        this.elements.ltmFee = document.getElementById('sp-ltm-fee');
        this.elements.setupBreakdown = document.getElementById('sp-setup-breakdown');
        this.elements.orderSummary = document.getElementById('sp-order-summary');
        this.elements.summaryContent = document.getElementById('sp-summary-content');
        this.elements.tiersContent = document.getElementById('sp-tiers-content');
        this.elements.additionalLocationGuideContent = document.getElementById('sp-location-guide');
        // No longer need to cache setupImpactContainer/Display and ltmImpactContainer/Display as separate items for this box
    }

    bindEvents() {
        // Quantity changes
        this.elements.quantityInput?.addEventListener('input', (e) => {
            const rawValue = e.target.value;
            const parsedValue = rawValue === "" ? 0 : parseInt(rawValue); 
            const quantityToUpdate = isNaN(parsedValue) ? 0 : parsedValue;
            console.log(`[ScreenPrintV2_Debug] Quantity input event. Raw: "${rawValue}", Parsed: ${parsedValue}, To Update: ${quantityToUpdate}`);
            this.state.quantity = quantityToUpdate; 
            this.updateDisplay(); 
        });
        
        this.elements.quantityInput?.addEventListener('blur', (e) => {
            let currentVal = parseInt(e.target.value);
            console.log(`[ScreenPrintV2_Debug] Quantity blur event. CurrentVal: ${currentVal}`);

            if (isNaN(currentVal) || (currentVal < this.config.minimumQuantity && currentVal !== 0) || currentVal === 0 ) {
                 if (currentVal !== 0 || isNaN(currentVal)) { // Avoid alert if user just typed 0 and intends to type more
                    this.showError(`Minimum quantity is ${this.config.minimumQuantity}. Resetting.`);
                 }
                currentVal = this.config.minimumQuantity;
            }
            
            this.elements.quantityInput.value = currentVal; 
            this.state.quantity = currentVal; 
            this.updateDisplay(); 
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

    updateQuantity(quantity) { // Renamed from previous to avoid confusion, now only updates state
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

        const locationDiv = document.createElement('div');
        locationDiv.className = 'sp-location-row';
        locationDiv.dataset.index = index;
        locationDiv.innerHTML = `
            <select class="sp-location-select sp-select" data-index="${index}">
                ${this.config.locationOptions.map(opt => 
                    `<option value="${opt.value}" ${opt.value === 'back' ? 'selected' : ''}>${opt.label}</option>`
                ).join('')}
            </select>
            <select class="sp-location-colors sp-select" data-index="${index}">
                ${this.config.colorOptions.slice(1).map(opt => 
                    `<option value="${opt.value}" ${opt.value === 1 ? 'selected' : ''}>${opt.label}</option>`
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
        
        const locationRows = this.elements.locationsContainer.querySelectorAll('.sp-location-row');
        locationRows.forEach(row => {
            if (parseInt(row.dataset.index) === index) {
                row.remove();
            }
        });

        this.reindexLocations();
        this.updateLocationButtonVisibility();
        this.updateDisplay();
    }

    updateLocations() {
        console.log('[ScreenPrintV2_Debug] updateLocations() called.');
        const locationRows = this.elements.locationsContainer.querySelectorAll('.sp-location-row');
        this.state.additionalLocations = Array.from(locationRows).map(row => {
            const locationSelect = row.querySelector('.sp-location-select');
            const colorsSelect = row.querySelector('.sp-location-colors');
            return {
                location: locationSelect.value,
                colors: parseInt(colorsSelect.value) || 0 
            };
        });
        this.updateDisplay();
    }

    reindexLocations() {
        const locationRows = this.elements.locationsContainer.querySelectorAll('.sp-location-row');
        locationRows.forEach((row, newIndex) => {
            row.dataset.index = newIndex;
            row.querySelector('.sp-location-select').dataset.index = newIndex;
            row.querySelector('.sp-location-colors').dataset.index = newIndex;
            row.querySelector('.sp-remove-location').dataset.index = newIndex;
        });
    }

    updateLocationButtonVisibility() {
        const addButton = document.getElementById('sp-add-location');
        if (addButton) {
            addButton.style.display = 
                this.state.additionalLocations.length >= this.config.maxAdditionalLocations ? 'none' : 'block';
        }
    }

    calculatePricing() {
        const { quantity, frontColors, additionalLocations, isDarkGarment, pricingData } = this.state;

        const pricing = {
            quantity: quantity,
            frontColors: frontColors, 
            additionalLocations: additionalLocations, 
            isDarkGarment: isDarkGarment,
            basePrice: 0,           
            additionalCost: 0,      
            totalPerShirtPrintOnlyCost: 0, 
            setupFee: 0,
            ltmFee: 0,
            ltmImpactPerShirt: 0, 
            subtotal: 0,            
            grandTotal: 0,          
            perShirtTotal: 0,       
            setupPerShirt: 0,
            colorBreakdown: {       
                front: 0,           
                locations: []       
            }
        };

        if (!pricingData || quantity === 0) return pricing;

        let effectiveFrontPrintColors = frontColors;
        if (isDarkGarment && frontColors > 0) {
            effectiveFrontPrintColors += 1;
        }
        pricing.colorBreakdown.front = effectiveFrontPrintColors;

        if (frontColors > 0) {
            const frontPricingData = pricingData.primaryLocationPricing?.[effectiveFrontPrintColors.toString()];
            if (frontPricingData?.tiers) {
                const tier = frontPricingData.tiers.find(t => quantity >= t.minQty && (!t.maxQty || quantity <= t.maxQty));
                if (tier?.prices) {
                    const sizes = Object.keys(tier.prices);
                    if (sizes.length > 0) {
                        pricing.basePrice = parseFloat(tier.prices[sizes[0]]) || 0;
                    }
                }
            }
        } else {
            const garmentOnlyPricingData = pricingData.primaryLocationPricing?.["0"];
            if (garmentOnlyPricingData?.tiers) {
                 const tier = garmentOnlyPricingData.tiers.find(t => quantity >= t.minQty && (!t.maxQty || quantity <= t.maxQty));
                 if (tier?.prices) {
                     const sizes = Object.keys(tier.prices);
                     if (sizes.length > 0) {
                         pricing.basePrice = parseFloat(tier.prices[sizes[0]]) || 0;
                     }
                 }
            } else {
                pricing.basePrice = 0; 
            }
        }

        let totalSetupForAdditionalLocations = 0;
        if (pricingData.additionalLocationPricing) {
            const additionalPricingMaster = pricingData.additionalLocationPricing;
            additionalLocations.forEach(loc => {
                let costPerPieceForThisLoc = 0;
                let designColorsThisLoc = loc.colors;
                let effectiveColorsForThisLoc = designColorsThisLoc;

                if (designColorsThisLoc > 0) {
                    if (isDarkGarment) {
                        effectiveColorsForThisLoc += 1;
                    }
                    const locPricingData = additionalPricingMaster[effectiveColorsForThisLoc.toString()];
                    if (locPricingData?.tiers) {
                        const tier = locPricingData.tiers.find(t => quantity >= t.minQty && (!t.maxQty || quantity <= t.maxQty));
                        if (tier?.pricePerPiece !== undefined) {
                            costPerPieceForThisLoc = parseFloat(tier.pricePerPiece) || 0;
                        }
                    }
                }
                pricing.additionalCost += costPerPieceForThisLoc;
                const setupForThisLoc = effectiveColorsForThisLoc * this.config.setupFeePerColor;
                totalSetupForAdditionalLocations += setupForThisLoc;
                pricing.colorBreakdown.locations.push({
                    ...loc, 
                    totalColors: effectiveColorsForThisLoc, 
                    setupCost: setupForThisLoc,
                    costPerPiece: costPerPieceForThisLoc 
                });
            });
        }

        const setupForFront = (frontColors > 0 ? pricing.colorBreakdown.front : 0) * this.config.setupFeePerColor;
        pricing.setupFee = setupForFront + totalSetupForAdditionalLocations;

        if (quantity < this.config.ltmThreshold && quantity > 0) {
            let tierBasedLtmFee = null;
            const relevantPricingTierKey = (frontColors > 0) ? effectiveFrontPrintColors.toString() : "0";
            const primaryPricingForLTM = pricingData.primaryLocationPricing?.[relevantPricingTierKey];
            if (primaryPricingForLTM?.tiers) {
                const tier = primaryPricingForLTM.tiers.find(t => quantity >= t.minQty && (!t.maxQty || quantity <= t.maxQty));
                if (tier && tier.ltmFee !== undefined && tier.ltmFee > 0) {
                    tierBasedLtmFee = parseFloat(tier.ltmFee);
                }
            } else if (pricingData.tierData) {
                 const generalTierKey = Object.keys(pricingData.tierData).find(key => {
                    const tier = pricingData.tierData[key];
                    return quantity >= tier.MinQuantity && (!tier.MaxQuantity || quantity <= tier.MaxQuantity);
                });
                if (generalTierKey && pricingData.tierData[generalTierKey].LTM_Fee > 0) {
                    tierBasedLtmFee = parseFloat(pricingData.tierData[generalTierKey].LTM_Fee);
                }
            }
            pricing.ltmFee = tierBasedLtmFee !== null ? tierBasedLtmFee : this.config.ltmFee;
        }

        pricing.totalPerShirtPrintOnlyCost = pricing.basePrice + pricing.additionalCost;
        pricing.subtotal = pricing.totalPerShirtPrintOnlyCost * quantity;
        pricing.grandTotal = pricing.subtotal + pricing.setupFee + pricing.ltmFee;
        pricing.setupPerShirt = quantity > 0 ? pricing.setupFee / quantity : 0;
        pricing.ltmImpactPerShirt = (pricing.ltmFee > 0 && quantity > 0) ? pricing.ltmFee / quantity : 0;
        pricing.perShirtTotal = quantity > 0 ? pricing.totalPerShirtPrintOnlyCost + pricing.setupPerShirt + pricing.ltmImpactPerShirt : 0;
        
        return pricing;
    }

    updateDisplay() {
        const pricing = this.calculatePricing();
        
        this.elements.basePrice.textContent = pricing.perShirtTotal.toFixed(2); 
        this.updateDynamicSubtitle(pricing); // Pass the whole pricing object

        const setupImpactContainer = document.getElementById('sp-setup-impact-container');
        const setupImpactDisplay = document.getElementById('sp-setup-impact-display');
        if (setupImpactContainer && setupImpactDisplay) {
            if (pricing.setupPerShirt > 0 && pricing.quantity > 0) {
                setupImpactContainer.style.display = 'flex';
                setupImpactDisplay.textContent = `+$${pricing.setupPerShirt.toFixed(2)}`;
            } else {
                setupImpactContainer.style.display = 'none';
            }
        }

        const ltmImpactContainer = document.getElementById('sp-ltm-impact-container');
        const ltmImpactDisplay = document.getElementById('sp-ltm-impact-display');
        if (ltmImpactContainer && ltmImpactDisplay) {
            if (pricing.ltmImpactPerShirt > 0 && pricing.quantity > 0) {
                ltmImpactContainer.style.display = 'flex';
                ltmImpactDisplay.textContent = `+$${pricing.ltmImpactPerShirt.toFixed(2)}`;
            } else {
                ltmImpactContainer.style.display = 'none';
            }
        }
        
        const darkIndicator = this.elements.darkGarmentIndicator;
        if (darkIndicator) {
            const hasFrontPrint = this.state.frontColors > 0;
            const hasAdditionalPrints = this.state.additionalLocations.some(loc => loc.colors > 0);
            if (this.state.isDarkGarment && (hasFrontPrint || hasAdditionalPrints)) {
                darkIndicator.textContent = '(Includes underbase for dark garment)';
                darkIndicator.style.display = 'block';
            } else {
                darkIndicator.style.display = 'none';
            }
        }
        
        if (this.elements.setupFee) this.elements.setupFee.textContent = `$${pricing.setupFee.toFixed(2)}`; 
        
        this.updateSetupBreakdown(pricing);

        if (this.elements.ltmWarning && this.elements.ltmFee) {
            this.elements.ltmWarning.style.display = pricing.ltmFee > 0 && pricing.quantity < this.config.ltmThreshold ? 'block' : 'none';
            this.elements.ltmFee.textContent = `$${pricing.ltmFee.toFixed(2)}`;
        }
        this.updateOrderSummary(pricing);
    }

    updateSetupBreakdown(pricing) {
        if (!this.elements.setupBreakdown) return;
        let html = '';
        if (pricing.colorBreakdown.front > 0 && this.state.frontColors > 0) {
            html += `• Front (${pricing.colorBreakdown.front} color${pricing.colorBreakdown.front > 1 ? 's' : ''}): $${(pricing.colorBreakdown.front * this.config.setupFeePerColor).toFixed(2)}<br>`;
        }
        pricing.colorBreakdown.locations.forEach(loc => {
            if (loc.colors > 0) { 
                const label = this.config.locationOptions.find(opt => opt.value === loc.location)?.label || loc.location;
                html += `• ${label} (${loc.totalColors} color${loc.totalColors > 1 ? 's' : ''}): $${loc.setupCost.toFixed(2)}<br>`;
            }
        });
        this.elements.setupBreakdown.innerHTML = html;
    }

    updateOrderSummary(pricing) {
        if (!this.elements.orderSummary || !this.elements.summaryContent) return;
        const hasPrintCosts = pricing.basePrice > 0 || pricing.additionalCost > 0;
        if (pricing.quantity === 0 || !hasPrintCosts && !(this.state.frontColors === 0 && pricing.basePrice > 0) ) { 
            this.elements.orderSummary.style.display = 'none';
            return;
        }

        this.elements.orderSummary.style.display = 'block';
        let html = '<table class="sp-summary-table">';
        
        let garmentLineDisplayed = false;
        if (this.state.frontColors > 0 && pricing.basePrice > 0) {
            html += `
                <tr>
                    <td>${pricing.quantity} × ${this.state.styleNumber || 'Shirts'} (Front: ${pricing.colorBreakdown.front}c)</td>
                    <td>@ $${pricing.basePrice.toFixed(2)} ea</td>
                    <td class="sp-summary-total">$${(pricing.basePrice * pricing.quantity).toFixed(2)}</td>
                </tr>
            `;
            garmentLineDisplayed = true;
        } else if (this.state.frontColors === 0 && pricing.basePrice > 0) { 
             html += `
                <tr>
                    <td>${pricing.quantity} × ${this.state.styleNumber || 'Shirts'} (Garment)</td>
                    <td>@ $${pricing.basePrice.toFixed(2)} ea</td>
                    <td class="sp-summary-total">$${(pricing.basePrice * pricing.quantity).toFixed(2)}</td>
                </tr>
            `;
            garmentLineDisplayed = true;
        }

        if (pricing.colorBreakdown.locations.length > 0) {
            let hasAdditionalCosts = false;
            let additionalLocationsHtml = '';
            pricing.colorBreakdown.locations.forEach(loc => {
                if (loc.colors > 0) { 
                    const label = this.config.locationOptions.find(opt => opt.value === loc.location)?.label || loc.location;
                    additionalLocationsHtml += `
                        <tr class="sp-summary-indent">
                            <td>${label} (${loc.totalColors}c)</td>
                            <td>@ $${loc.costPerPiece.toFixed(2)} ea</td>
                            <td class="sp-summary-total">$${(loc.costPerPiece * pricing.quantity).toFixed(2)}</td>
                        </tr>
                    `;
                    hasAdditionalCosts = true;
                }
            });
            if (hasAdditionalCosts) {
                if (garmentLineDisplayed || this.state.frontColors > 0) { // Add divider if garment/front print was shown
                     html += '<tr><td colspan="3" class="sp-summary-divider"></td></tr>';
                }
                html += '<tr><td colspan="3" class="sp-summary-section">Additional Locations:</td></tr>';
                html += additionalLocationsHtml;
            }
        }

        html += `
            <tr class="sp-summary-subtotal">
                <td colspan="2">Subtotal (Prints & Garment):</td>
                <td class="sp-summary-total">$${pricing.subtotal.toFixed(2)}</td>
            </tr>
        `;

        if (pricing.setupFee > 0) {
            html += '<tr><td colspan="3" class="sp-summary-divider"></td></tr>';
            html += `
                <tr>
                    <td colspan="2">Setup Fees:</td>
                    <td class="sp-summary-total">$${pricing.setupFee.toFixed(2)}</td>
                </tr>
            `;
        }

        if (pricing.ltmFee > 0) {
            html += `
                <tr>
                    <td colspan="2">Small Order Fee:</td>
                    <td class="sp-summary-total">$${pricing.ltmFee.toFixed(2)}</td>
                </tr>
            `;
        }

        html += `
            <tr class="sp-summary-grand-total">
                <td colspan="2">TOTAL:</td>
                <td class="sp-summary-total">$${pricing.grandTotal.toFixed(2)}</td>
            </tr>
            <tr class="sp-summary-per-item">
                <td colspan="2">Per Shirt Cost (All-in):</td>
                <td class="sp-summary-total">$${pricing.perShirtTotal.toFixed(2)}</td>
            </tr>
        `;

        html += '</table>';
        this.elements.summaryContent.innerHTML = html;
    }

    updatePricingTiers() {
        if (!this.elements.tiersContent) return;
        if (!this.state.pricingData?.primaryLocationPricing) {
            this.elements.tiersContent.innerHTML = '<p>Pricing tiers not available</p>';
            return;
        }

        let html = '<table class="sp-tiers-table"><thead><tr><th>Quantity</th>';
        
        const firstColorPricing = this.state.pricingData.primaryLocationPricing['1'];
        if (!firstColorPricing?.tiers?.[0]?.prices) {
            this.elements.tiersContent.innerHTML = '<p>Pricing tiers not available (No base data for 1-color front).</p>';
            return;
        }

        const sizes = Object.keys(firstColorPricing.tiers[0].prices);
        sizes.forEach(size => {
            html += `<th>${size}</th>`;
        });
        html += '<th>Savings</th></tr></thead><tbody>';

        let basePriceForSavings = null;
        firstColorPricing.tiers.forEach((tier, index) => {
            const isCurrentTier = this.state.quantity >= tier.minQty && 
                                  (!tier.maxQty || this.state.quantity <= tier.maxQty);
            
            html += `<tr class="${isCurrentTier ? 'sp-current-tier' : ''}">`;
            html += `<td class="sp-tier-range">${tier.minQty}-${tier.maxQty || 'Max'}</td>`;
            
            let firstPriceInTier = null;
            sizes.forEach(size => {
                const price = tier.prices[size];
                if (price !== null && price !== undefined && !firstPriceInTier) firstPriceInTier = parseFloat(price);
                html += `<td>${(price !== null && price !== undefined) ? `$${parseFloat(price).toFixed(2)}` : '-'}</td>`;
            });
            
            if (index === 0) {
                basePriceForSavings = firstPriceInTier;
                html += '<td>-</td>';
            } else if (basePriceForSavings && firstPriceInTier !== null) {
                const savings = ((basePriceForSavings - firstPriceInTier) / basePriceForSavings * 100);
                html += `<td class="sp-savings">${savings > 0 ? savings.toFixed(0) + '% off' : '-'}</td>`;
            } else {
                html += '<td>-</td>';
            }
            
            html += '</tr>';
        });

        html += '</tbody></table>';
        html += '<p class="sp-tiers-note">Prices shown are per shirt for garment + 1 color front print.</p>';
        
        this.elements.tiersContent.innerHTML = html;
    }

    toggleAccordion(trigger) {
        const targetId = trigger.dataset.target;
        const content = document.getElementById(targetId);
        const icon = trigger.querySelector('.sp-accordion-icon');
        
        if (content.style.display === 'none') {
            content.style.display = 'block';
            icon.style.transform = 'rotate(90deg)';
            
            if (targetId === 'pricing-tiers' && !this.tiersLoaded) {
                this.updatePricingTiers();
                this.tiersLoaded = true;
            } else if (targetId === 'location-pricing' && !this.locationGuideLoaded) {
                this.updateAdditionalLocationPricingGuide();
                this.locationGuideLoaded = true;
            }
        } else {
            content.style.display = 'none';
            icon.style.transform = 'rotate(0deg)';
        }
    }

    updateDynamicSubtitle(pricing) { // Removed sumForSubtitle as it's now part of pricing object
        if (!this.elements.priceSubtitle) return;
    
        let subtitleParts = [];
        const styleName = this.state.styleNumber || "Item";
        
        // Front print part - uses effective colors for label
        if (this.state.frontColors > 0 && pricing.basePrice >= 0) { 
            // pricing.basePrice is garment + front print (incl. its underbase)
            subtitleParts.push(`${pricing.colorBreakdown.front} Color Front $${pricing.basePrice.toFixed(2)}`);
        }
    
        // Additional locations part - uses effective colors for label
        pricing.colorBreakdown.locations.forEach(loc => {
            // loc.costPerPiece is already calculated with underbase if applicable
            if (loc.colors > 0 ) { // Only add if design colors > 0 for this location
                const locLabel = this.config.locationOptions.find(opt => opt.value === loc.location)?.label || loc.location;
                subtitleParts.push(`${loc.totalColors} Color ${locLabel} $${loc.costPerPiece.toFixed(2)}`);
            }
        });
    
        let subtitleText = "";
        if (subtitleParts.length > 0) {
            subtitleText = `${styleName} - ${subtitleParts.join(' + ')}`;
            subtitleText += ` = <span class="sp-print-only-total">$${pricing.totalPerShirtPrintOnlyCost.toFixed(2)}</span>`; // Sum of print-only costs
            
            // Append setup and LTM impact if they apply
            if (pricing.setupPerShirt > 0 && pricing.quantity > 0) {
                subtitleText += `<br/>+ Setup $${pricing.setupPerShirt.toFixed(2)}`;
            }
            if (pricing.ltmImpactPerShirt > 0 && pricing.quantity > 0) {
                subtitleText += `<br/>+ LTM $${pricing.ltmImpactPerShirt.toFixed(2)}`;
            }
            // The main price (pricing.perShirtTotal) is the sum of these.
            // No need to add another "= $TOTAL_ALL_IN" here as the main price shows it.

        } else if (pricing.basePrice > 0 && this.state.frontColors === 0 && pricing.additionalCost === 0) { 
            // This case implies pricing.basePrice might be garment-only if no prints are selected.
            subtitleText = `${styleName} $${pricing.basePrice.toFixed(2)}`; // Garment only
        } else if (pricing.quantity > 0) { // If quantity but no price yet (e.g. data loading)
             subtitleText = `${styleName}`;
        } else { // Default if no quantity or price (e.g. initial load before quantity)
            subtitleText = ""; // Or some placeholder like "Select options"
        }
        
        this.elements.priceSubtitle.innerHTML = subtitleText;
    }    

    updateAdditionalLocationPricingGuide() {
        if (!this.elements.additionalLocationGuideContent) return;
        if (!this.state.masterBundle || !this.state.masterBundle.additionalLocationPricing || !this.state.masterBundle.tierData) {
            this.elements.additionalLocationGuideContent.innerHTML = '<p>Additional location pricing data not yet available.</p>';
            return;
        }

        const additionalPricing = this.state.masterBundle.additionalLocationPricing;
        const tierLabels = Object.keys(this.state.masterBundle.tierData).sort((a, b) =>
            this.state.masterBundle.tierData[a].MinQuantity - this.state.masterBundle.tierData[b].MinQuantity
        );

        let html = `
            <p>The table below shows the <strong>per-piece cost</strong> for adding a print to an additional location (includes underbase cost if dark garment selected). Setup fees also apply per color, per location.</p>
            <table class="sp-tiers-table">
                <thead>
                    <tr>
                        <th>Quantity Tier</th>
                        <th>1 Eff.Color</th>
                        <th>2 Eff.Colors</th>
                        <th>3 Eff.Colors</th>
                        <th>4 Eff.Colors</th>
                        <th>5 Eff.Colors</th>
                        <th>6 Eff.Colors</th>
                        <th>7 Eff.Colors</th> 
                    </tr>
                </thead>
                <tbody>
        `;

        tierLabels.forEach(tierLabel => {
            html += `<tr><td class="sp-tier-range">${tierLabel}</td>`;
            for (let i = 1; i <= 7; i++) { // Iterate up to 7 for 6 colors + underbase
                let pricePerPiece = '-';
                const colorData = additionalPricing[i.toString()];
                if (colorData && colorData.tiers) {
                    const tierInfo = colorData.tiers.find(t => t.label === tierLabel);
                    if (tierInfo && tierInfo.pricePerPiece !== null && tierInfo.pricePerPiece !== undefined) {
                        pricePerPiece = `$${parseFloat(tierInfo.pricePerPiece).toFixed(2)}`;
                    }
                }
                html += `<td>${pricePerPiece}</td>`;
            }
            html += `</tr>`;
        });

        html += `
                </tbody>
            </table>
            <p class="sp-tiers-note">"Eff.Color" means effective colors, including a white underbase for dark garments if applicable. Setup fee per effective color, per additional location: $${this.config.setupFeePerColor.toFixed(2)}.</p>
        `;
        this.elements.additionalLocationGuideContent.innerHTML = html;
    }

    showError(message) {
        alert(message);
    }

    handleMasterBundle(data) {
        console.log('[ScreenPrintV2] Received master bundle:', data);
        this.state.masterBundle = data;
        this.state.pricingData = data;
        
        if (data.styleNumber) this.state.styleNumber = data.styleNumber;
        if (data.productTitle) this.state.productTitle = data.productTitle;
        
        this.updateDisplay();
        
        if (this.tiersLoaded && document.getElementById('pricing-tiers')?.style.display !== 'none') {
            this.updatePricingTiers();
        }
        if (this.locationGuideLoaded && document.getElementById('location-pricing')?.style.display !== 'none') {
            this.updateAdditionalLocationPricingGuide();
        }
    }
}

// Initialize when script loads
window.ScreenPrintPricingV2 = new ScreenPrintPricing();