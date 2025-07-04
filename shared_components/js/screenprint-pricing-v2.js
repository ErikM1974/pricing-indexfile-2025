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
            frontHasSafetyStripes: false,
            additionalLocations: [], // [{location: 'back', colors: 2, hasSafetyStripes: false}, ...]
            isDarkGarment: false,
            garmentColor: '',
            styleNumber: '',
            productTitle: '',
            pricingData: null,
            masterBundle: null,
            safetyStripeSurcharge: 2.00
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
                            <div class="sp-color-row">
                                <select id="sp-front-colors" class="sp-select">
                                    ${this.config.colorOptions.map(opt => 
                                        `<option value="${opt.value}" ${opt.value === 1 ? 'selected' : ''}>${opt.label}</option>`
                                    ).join('')}
                                </select>
                                <label class="sp-safety-checkbox sp-front-safety">
                                    <input type="checkbox" id="sp-front-safety">
                                    <span>Safety Stripes</span> <span class="sp-safety-price">(+$${this.state.safetyStripeSurcharge.toFixed(2)})</span>
                                    <span class="sp-safety-tooltip">4-color design: White base + 2 stripe colors + company logo</span>
                                </label>
                            </div>
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
        this.elements.frontSafetyCheckbox = document.getElementById('sp-front-safety');
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
        
        // Diagnostic: Check DOM after creation
        const frontColorOptions = document.querySelectorAll('#sp-front-colors option');
        console.log('[ScreenPrintV2] Front color options in DOM:', frontColorOptions.length);
        frontColorOptions.forEach((opt, i) => {
            console.log(`[ScreenPrintV2] Option ${i}: value="${opt.value}", text="${opt.text}"`);
        });
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
        
        // Front safety stripes toggle
        this.elements.frontSafetyCheckbox?.addEventListener('change', (e) => {
            this.updateFrontSafetyStripes(e.target.checked);
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
            // Handle safety stripes checkbox for additional locations
            if (e.target.classList.contains('sp-location-safety')) {
                const index = parseInt(e.target.dataset.index);
                this.updateLocationSafetyStripes(index, e.target.checked);
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
    
    updateFrontSafetyStripes(enabled) {
        this.state.frontHasSafetyStripes = enabled;
        
        if (enabled) {
            // Set to 3 colors (which becomes 4 with underbase)
            this.elements.frontColorsSelect.value = '3';
            this.state.frontColors = 3;
        }
        
        this.updateDisplay();
    }
    
    updateLocationSafetyStripes(index, enabled) {
        if (this.state.additionalLocations[index]) {
            this.state.additionalLocations[index].hasSafetyStripes = enabled;
            
            if (enabled) {
                // Set to 3 colors for safety stripes
                const locationRow = this.elements.locationsContainer.querySelectorAll('.sp-location-row')[index];
                const colorsSelect = locationRow?.querySelector('.sp-location-colors');
                if (colorsSelect) {
                    colorsSelect.value = '3';
                    this.state.additionalLocations[index].colors = 3;
                }
            }
            
            this.updateDisplay();
        }
    }
    
    showSafetyStripesModal() {
        // Create modal if it doesn't exist
        let modal = document.querySelector('.sp-safety-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.className = 'sp-safety-modal';
            modal.innerHTML = `
                <div class="sp-safety-modal-content">
                    <span class="sp-safety-modal-close">&times;</span>
                    <img src="https://cdn.caspio.com/A0E15000/Safety%20Stripes/Safety%20Stripes.jpg?ver=1" 
                         alt="Safety Stripes Example">
                    <h3>Safety Stripes</h3>
                    <p>High-visibility safety stripe design with company logo. Uses 4 colors: white base, 
                       white stripe, colored stripe, and company logo color. Perfect for construction, 
                       road work, and industrial applications. Adds $2.00 per location for specialty inks.</p>
                </div>
            `;
            document.body.appendChild(modal);
            
            // Add close handler
            modal.querySelector('.sp-safety-modal-close')?.addEventListener('click', () => {
                modal.classList.remove('show');
            });
            
            // Close on outside click
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.classList.remove('show');
                }
            });
        }
        
        modal.classList.add('show');
    }

    addLocation() {
        if (this.state.additionalLocations.length >= this.config.maxAdditionalLocations) {
            this.showError(`Maximum ${this.config.maxAdditionalLocations} additional locations`);
            return;
        }

        const index = this.state.additionalLocations.length;
        this.state.additionalLocations.push({
            location: 'back', 
            colors: 1,
            hasSafetyStripes: false
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
            <div class="sp-color-row">
                <select class="sp-location-colors sp-select" data-index="${index}">
                    ${this.config.colorOptions.slice(1).map(opt => 
                        `<option value="${opt.value}" ${opt.value === 1 ? 'selected' : ''}>${opt.label}</option>`
                    ).join('')}
                </select>
                <label class="sp-safety-checkbox">
                    <input type="checkbox" class="sp-location-safety" data-index="${index}">
                    <span class="sp-safety-label">🦺 Safety</span>
                    <span class="sp-safety-tooltip">High-visibility stripes with logo +$${this.state.safetyStripeSurcharge.toFixed(2)}</span>
                </label>
            </div>
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

        // Cap effective colors at the maximum available in pricing data
        const maxAvailableColors = Math.max(...Object.keys(pricingData.primaryLocationPricing || {})
            .filter(key => !isNaN(parseInt(key)))
            .map(key => parseInt(key)));
        
        if (effectiveFrontPrintColors > maxAvailableColors) {
            console.log(`[ScreenPrintV2] Capping effective colors from ${effectiveFrontPrintColors} to ${maxAvailableColors} (max available in pricing data)`);
            effectiveFrontPrintColors = maxAvailableColors;
        }

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
                    
                    // Cap effective colors at the maximum available in additional location pricing data
                    const maxAvailableAddlColors = Math.max(...Object.keys(additionalPricingMaster || {})
                        .filter(key => !isNaN(parseInt(key)))
                        .map(key => parseInt(key)));
                    
                    if (effectiveColorsForThisLoc > maxAvailableAddlColors) {
                        console.log(`[ScreenPrintV2] Capping additional location effective colors from ${effectiveColorsForThisLoc} to ${maxAvailableAddlColors} (max available in pricing data)`);
                        effectiveColorsForThisLoc = maxAvailableAddlColors;
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

        // Add safety stripes surcharge per location
        let safetyStripesSurcharge = 0;
        
        // Add surcharge for front if has safety stripes and printing
        if (this.state.frontHasSafetyStripes && frontColors > 0) {
            safetyStripesSurcharge += this.state.safetyStripeSurcharge;
        }
        
        // Add surcharge for each additional location with safety stripes and printing
        additionalLocations.forEach(loc => {
            if (loc.hasSafetyStripes && loc.colors > 0) {
                safetyStripesSurcharge += this.state.safetyStripeSurcharge;
            }
        });
        
        // Store safety stripes info
        pricing.safetyStripesSurcharge = safetyStripesSurcharge;
        
        // Prices are always pre-calculated in the new format
        if (pricingData.embellishmentType === 'screenprint') {
            // Prices already include garment, print, and margin
            pricing.totalPerShirtPrintOnlyCost = pricing.basePrice + pricing.additionalCost + safetyStripesSurcharge;
            pricing.perShirtTotal = pricing.totalPerShirtPrintOnlyCost;
            
            // Setup and LTM are separate one-time fees
            pricing.subtotal = pricing.totalPerShirtPrintOnlyCost * quantity;
            pricing.grandTotal = pricing.subtotal + pricing.setupFee + pricing.ltmFee;
            pricing.setupPerShirt = quantity > 0 ? pricing.setupFee / quantity : 0;
            pricing.ltmImpactPerShirt = (pricing.ltmFee > 0 && quantity > 0) ? pricing.ltmFee / quantity : 0;
        } else {
            // Legacy calculation where basePrice needs margin applied
            pricing.totalPerShirtPrintOnlyCost = pricing.basePrice + pricing.additionalCost;
            pricing.subtotal = pricing.totalPerShirtPrintOnlyCost * quantity;
            pricing.grandTotal = pricing.subtotal + pricing.setupFee + pricing.ltmFee;
            pricing.setupPerShirt = quantity > 0 ? pricing.setupFee / quantity : 0;
            pricing.ltmImpactPerShirt = (pricing.ltmFee > 0 && quantity > 0) ? pricing.ltmFee / quantity : 0;
            pricing.perShirtTotal = quantity > 0 ? pricing.totalPerShirtPrintOnlyCost + pricing.setupPerShirt + pricing.ltmImpactPerShirt : 0;
        }
        
        return pricing;
    }

    updateDisplay() {
        const pricing = this.calculatePricing();
        
        this.elements.basePrice.textContent = pricing.perShirtTotal.toFixed(2); 
        this.updateDynamicSubtitle(pricing); // Pass the whole pricing object
        
        // Update header pricing
        this.updateHeaderPricing(this.state.quantity, pricing.perShirtTotal);

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
            // Hide the dark garment indicator - underbase is already included in pricing
            darkIndicator.style.display = 'none';
        }
        
        if (this.elements.setupFee) this.elements.setupFee.textContent = `$${pricing.setupFee.toFixed(2)}`; 
        
        this.updateSetupBreakdown(pricing);

        if (this.elements.ltmWarning && this.elements.ltmFee) {
            this.elements.ltmWarning.style.display = pricing.ltmFee > 0 && pricing.quantity < this.config.ltmThreshold ? 'block' : 'none';
            this.elements.ltmFee.textContent = `$${pricing.ltmFee.toFixed(2)}`;
        }
        this.updateOrderSummary(pricing);
        
        // Update pricing tiers if accordion is open
        if (this.tiersLoaded && document.getElementById('pricing-tiers')?.style.display !== 'none') {
            this.updatePricingTiers();
        }
        
        // Update additional location guide if open
        if (this.locationGuideLoaded && document.getElementById('location-pricing')?.style.display !== 'none') {
            this.updateAdditionalLocationPricingGuide();
        }
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
        
        // Prevent dp5-helper interference
        window.directFixApplied = true;
        console.log('[ScreenPrintV2] Set directFixApplied = true to prevent dp5-helper interference');
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
            if (this.state.frontHasSafetyStripes) {
                // Calculate the per-shirt price with safety surcharge for front
                const basePrice = pricing.basePrice;
                const totalWithSafety = basePrice + this.state.safetyStripeSurcharge;
                html += `
                    <tr>
                        <td>${pricing.quantity} × ${this.state.styleNumber || 'Shirts'} (Front: ${pricing.colorBreakdown.front}c)</td>
                        <td>$${basePrice.toFixed(2)} + $${this.state.safetyStripeSurcharge.toFixed(2)} safety = $${totalWithSafety.toFixed(2)} ea</td>
                        <td class="sp-summary-total">$${(totalWithSafety * pricing.quantity).toFixed(2)}</td>
                    </tr>
                `;
            } else {
                html += `
                    <tr>
                        <td>${pricing.quantity} × ${this.state.styleNumber || 'Shirts'} (Front: ${pricing.colorBreakdown.front}c)</td>
                        <td>@ $${pricing.basePrice.toFixed(2)} ea</td>
                        <td class="sp-summary-total">$${(pricing.basePrice * pricing.quantity).toFixed(2)}</td>
                    </tr>
                `;
            }
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
                    if (loc.hasSafetyStripes) {
                        // Calculate the per-shirt price with safety surcharge for additional location
                        const baseCost = loc.costPerPiece;
                        const totalWithSafety = baseCost + this.state.safetyStripeSurcharge;
                        additionalLocationsHtml += `
                            <tr class="sp-summary-indent">
                                <td>${label} (${loc.totalColors}c)</td>
                                <td>$${baseCost.toFixed(2)} + $${this.state.safetyStripeSurcharge.toFixed(2)} safety = $${totalWithSafety.toFixed(2)} ea</td>
                                <td class="sp-summary-total">$${(totalWithSafety * pricing.quantity).toFixed(2)}</td>
                            </tr>
                        `;
                    } else {
                        additionalLocationsHtml += `
                            <tr class="sp-summary-indent">
                                <td>${label} (${loc.totalColors}c)</td>
                                <td>@ $${loc.costPerPiece.toFixed(2)} ea</td>
                                <td class="sp-summary-total">$${(loc.costPerPiece * pricing.quantity).toFixed(2)}</td>
                            </tr>
                        `;
                    }
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

        // Calculate effective colors for current selection
        let effectiveFrontColors = this.state.frontColors;
        if (this.state.isDarkGarment && this.state.frontColors > 0) {
            effectiveFrontColors += 1;
        }
        
        // Cap effective colors at maximum available
        const maxAvailableColors = Math.max(...Object.keys(this.state.pricingData.primaryLocationPricing || {})
            .filter(key => !isNaN(parseInt(key)))
            .map(key => parseInt(key)));
        
        if (effectiveFrontColors > maxAvailableColors) {
            effectiveFrontColors = maxAvailableColors;
        }

        // Get pricing data for current color selection
        const selectedColorPricing = this.state.pricingData.primaryLocationPricing[effectiveFrontColors.toString()];
        if (!selectedColorPricing?.tiers?.[0]?.prices) {
            this.elements.tiersContent.innerHTML = '<p>Pricing tiers not available for selected options.</p>';
            return;
        }

        // Wrap table in responsive wrapper
        let html = '<div class="sp-tiers-table-wrapper">';
        html += '<table class="sp-tiers-table"><thead><tr><th>Quantity Range</th>';
        
        const sizes = Object.keys(selectedColorPricing.tiers[0].prices);
        sizes.forEach(size => {
            html += `<th>${size}</th>`;
        });
        html += '</tr></thead><tbody>';

        selectedColorPricing.tiers.forEach((tier, index) => {
            // Adjust display for first tier if it starts below 24
            let displayMinQty = tier.minQty;
            if (tier.minQty < 24 && tier.maxQty >= 24) {
                displayMinQty = 24; // Change to 24 for display only
            }
            
            const isCurrentTier = this.state.quantity >= tier.minQty && 
                                  (!tier.maxQty || this.state.quantity <= tier.maxQty);
            
            html += `<tr class="${isCurrentTier ? 'sp-current-tier' : ''}">`;
            html += `<td class="sp-tier-range">${displayMinQty}${tier.maxQty ? '-' + tier.maxQty : '+'}</td>`;
            
            sizes.forEach(size => {
                const price = tier.prices[size];
                html += `<td>${(price !== null && price !== undefined) ? `$${parseFloat(price).toFixed(2)}` : '-'}</td>`;
            });
            
            html += '</tr>';
        });

        html += '</tbody></table>';
        html += '</div>'; // Close wrapper
        
        // Dynamic note based on current selection
        let noteText = '';
        if (this.state.frontColors === 0) {
            noteText = 'Prices shown are per shirt for garment only (no printing).';
        } else {
            const colorText = this.state.frontColors === 1 ? '1 color' : `${this.state.frontColors} colors`;
            const underbaseNote = (this.state.isDarkGarment && this.state.frontColors > 0) ? ' (includes white underbase)' : '';
            noteText = `Prices shown are per shirt for garment + ${colorText} front print${underbaseNote}.`;
        }
        html += `<p class="sp-tiers-note">${noteText}</p>`;
        html += '<p class="sp-tiers-note" style="margin-top: 8px;">Minimum order quantity: 24 pieces</p>';
        
        // Add mobile card view for small screens
        html += '<div class="sp-tiers-table-mobile" style="display: none;">';
        selectedColorPricing.tiers.forEach((tier) => {
            const isCurrentTier = this.state.quantity >= tier.minQty && 
                                  (!tier.maxQty || this.state.quantity <= tier.maxQty);
            
            html += `<div class="sp-tier-card ${isCurrentTier ? 'sp-current-tier-card' : ''}">`;
            html += `<div class="sp-tier-card-header">${tier.minQty}${tier.maxQty ? '-' + tier.maxQty : '+'} items</div>`;
            
            sizes.forEach(size => {
                const price = tier.prices[size];
                if (price !== null && price !== undefined) {
                    html += `<div class="sp-tier-size-row">`;
                    html += `<span class="sp-tier-size-label">Size ${size}:</span>`;
                    html += `<span class="sp-tier-size-price">$${parseFloat(price).toFixed(2)}</span>`;
                    html += `</div>`;
                }
            });
            
            html += '</div>';
        });
        html += '</div>';
        
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
        
        // Check if we have any safety stripes
        const hasSafetyStripes = this.state.frontHasSafetyStripes || 
            pricing.colorBreakdown.locations.some(loc => loc.hasSafetyStripes);
        
        // Front print part - uses effective colors for label
        if (this.state.frontColors > 0 && pricing.basePrice >= 0) { 
            // pricing.basePrice is garment + front print (incl. its underbase)
            const displayPrice = this.state.frontHasSafetyStripes ? 
                pricing.basePrice + this.state.safetyStripeSurcharge : 
                pricing.basePrice;
            subtitleParts.push(`${pricing.colorBreakdown.front} Color Front $${displayPrice.toFixed(2)}`);
        }
    
        // Additional locations part - uses effective colors for label
        pricing.colorBreakdown.locations.forEach(loc => {
            // loc.costPerPiece is already calculated with underbase if applicable
            if (loc.colors > 0 ) { // Only add if design colors > 0 for this location
                const locLabel = this.config.locationOptions.find(opt => opt.value === loc.location)?.label || loc.location;
                const displayPrice = loc.hasSafetyStripes ? 
                    loc.costPerPiece + this.state.safetyStripeSurcharge : 
                    loc.costPerPiece;
                subtitleParts.push(`${loc.totalColors} Color ${locLabel} $${displayPrice.toFixed(2)}`);
            }
        });
    
        let subtitleText = "";
        if (subtitleParts.length > 0) {
            subtitleText = `${styleName} - ${subtitleParts.join(' + ')}`;
            subtitleText += ` = <span class="sp-print-only-total">$${pricing.totalPerShirtPrintOnlyCost.toFixed(2)}</span>`; // Sum of print-only costs
            
            // Add safety stripes note if applicable
            if (hasSafetyStripes) {
                subtitleText += `<br/><span style="font-size: 0.85em; color: #ff6b35;">(Includes safety stripe surcharges)</span>`;
            }

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
        if (!this.state.masterBundle || !this.state.masterBundle.additionalLocationPricing || !this.state.masterBundle.tiers) {
            this.elements.additionalLocationGuideContent.innerHTML = '<p>Additional location pricing data not yet available.</p>';
            return;
        }

        const additionalPricing = this.state.masterBundle.additionalLocationPricing;
        // Handle both array format (new) and object format (legacy)
        let tierLabels;
        if (Array.isArray(this.state.masterBundle.tiers)) {
            tierLabels = this.state.masterBundle.tiers
                .sort((a, b) => a.MinQuantity - b.MinQuantity)
                .map(tier => tier.TierLabel);
        } else {
            tierLabels = Object.keys(this.state.masterBundle.tierData || this.state.masterBundle.tiers).sort((a, b) =>
                this.state.masterBundle.tierData[a].MinQuantity - this.state.masterBundle.tierData[b].MinQuantity
            );
        }

        let html = `
            <div class="sp-location-guide-header">
                <p>The table below shows the <strong>per-piece cost</strong> for adding a print to an additional location (includes underbase cost if dark garment selected). Setup fees also apply per color, per location.</p>
            </div>
            <div class="sp-tiers-table-wrapper">
                <table class="sp-tiers-table">
                    <thead>
                        <tr>
                            <th>Quantity Range</th>
                            <th>1 Color</th>
                            <th>2 Colors</th>
                            <th>3 Colors</th>
                            <th>4 Colors</th>
                            <th>5 Colors</th>
                            <th>6 Colors</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        tierLabels.forEach(tierLabel => {
            // Parse and adjust tier label if needed for minimum 24
            let displayLabel = tierLabel;
            const match = tierLabel.match(/(\d+)-(\d+)/);
            if (match) {
                const min = parseInt(match[1]);
                const max = parseInt(match[2]);
                if (min < 24 && max >= 24) {
                    displayLabel = `24-${max}`;
                }
            }
            
            html += `<tr><td class="sp-tier-range">${displayLabel}</td>`;
            for (let i = 1; i <= 6; i++) { // Show up to 6 colors
                let pricePerPiece = '-';
                // Check for pricing with underbase if needed
                const maxColors = 6;
                const effectiveColors = Math.min(i + (this.state.isDarkGarment ? 1 : 0), maxColors);
                const colorData = additionalPricing[effectiveColors.toString()];
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
            </div>
            <p class="sp-tiers-note">Prices include white underbase for dark garments if applicable. Setup fee per color, per additional location: $${this.config.setupFeePerColor.toFixed(2)}.</p>
            <p class="sp-tiers-note" style="margin-top: 8px;">Minimum order quantity: 24 pieces</p>
        `;
        this.elements.additionalLocationGuideContent.innerHTML = html;
    }

    showError(message) {
        alert(message);
    }

    updateHeaderPricing(quantity, unitPrice) {
        const headerQty = document.getElementById('header-quantity');
        const headerPrice = document.getElementById('header-unit-price');
        
        if (headerQty) {
            headerQty.textContent = quantity;
        }
        
        if (headerPrice) {
            if (typeof unitPrice === 'number' && !isNaN(unitPrice)) {
                headerPrice.textContent = `$${unitPrice.toFixed(2)}`;
            } else {
                headerPrice.textContent = '$0.00';
            }
        }
    }

    handleMasterBundle(data) {
        console.log('[ScreenPrintV2] Received master bundle:', data);
        this.state.masterBundle = data;
        this.state.pricingData = data;
        
        // Diagnostic: Check if 6-color pricing exists
        console.log('[ScreenPrintV2] Available color counts from bundle:', data.availableColorCounts);
        console.log('[ScreenPrintV2] Has 6-color pricing in finalPrices?', 
            !!(data.finalPrices?.PrimaryLocation?.["37-72"]?.["6"]));
        console.log('[ScreenPrintV2] Has 6-color pricing in primaryLocationPricing?', 
            !!(data.primaryLocationPricing?.["6"]));
        
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