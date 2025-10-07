/**
 * DTF Pricing Calculator Component - Toggle Interface
 * Implements Location = Size model with iOS-style toggle switches
 * 100% API-driven pricing with HalfDollarCeil rounding
 */
class DTFPricingCalculator {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.pricingService = new DTFPricingService();
        this.apiDataLoaded = false;
        this.isRendered = false;
        this.pendingUpdates = [];
        this.apiData = null;

        this.currentData = {
            garmentCost: 0,
            quantity: DTFConfig.settings.defaultQuantity,
            selectedTier: '24-47', // Default tier
            selectedLocations: new Set(), // Set of location values
            autoCalculateLTM: true
        };

        this.init();
    }

    async init() {
        this.showLoadingState();

        try {
            await this.loadApiData();
            this.apiDataLoaded = true;
            console.log('[DTF Calculator] API data loaded successfully');
        } catch (error) {
            console.error('[DTF Calculator] Failed to load API data:', error);
            this.showError('Unable to load pricing data. Please call 253-922-5793');
            return;
        }

        this.render();
        this.attachEventListeners();
        this.checkStaffViewStatus();

        this.isRendered = true;
        this.processPendingUpdates();

        // Dispatch ready event
        window.dispatchEvent(new CustomEvent('dtfCalculatorReady', {
            detail: { calculator: this }
        }));
    }

    processPendingUpdates() {
        while (this.pendingUpdates.length > 0) {
            const update = this.pendingUpdates.shift();
            update();
        }
    }

    async loadApiData() {
        // Fetch from pricing-bundle endpoint
        const apiData = await this.pricingService.fetchPricingData();

        if (!apiData) {
            throw new Error('No API data received');
        }

        this.apiData = apiData;

        // Update DTFConfig with API data
        this.mergeApiDataIntoConfig(apiData);

        return apiData;
    }

    mergeApiDataIntoConfig(apiData) {
        // Update transfer sizes and pricing from API
        if (apiData.allDtfCostsR && Array.isArray(apiData.allDtfCostsR)) {
            // Build pricing tiers from allDtfCostsR
            const tierMap = {};

            apiData.allDtfCostsR.forEach(cost => {
                const priceType = cost.price_type; // 'Small', 'Medium', 'Large'
                const quantityRange = cost.quantity_range; // '10-23', '24-47', etc.
                const unitPrice = parseFloat(cost.unit_price);

                const sizeKey = priceType.toLowerCase();

                if (!tierMap[sizeKey]) {
                    tierMap[sizeKey] = [];
                }

                // Parse quantity range
                const [minQty, maxQty] = this.parseQuantityRange(quantityRange);

                tierMap[sizeKey].push({
                    minQty,
                    maxQty,
                    unitPrice,
                    range: quantityRange
                });
            });

            // Update DTFConfig with parsed tiers
            Object.keys(tierMap).forEach(sizeKey => {
                if (DTFConfig.transferSizes[sizeKey]) {
                    DTFConfig.transferSizes[sizeKey].pricingTiers = tierMap[sizeKey];
                }
            });
        }

        // Update freight costs from API
        if (apiData.freightR && Array.isArray(apiData.freightR)) {
            DTFConfig.freightCost.tiers = apiData.freightR.map(freight => {
                const [minQty, maxQty] = this.parseQuantityRange(freight.quantity_range);
                return {
                    minQty,
                    maxQty,
                    costPerTransfer: parseFloat(freight.cost_per_transfer)
                };
            });
        }

        console.log('[DTF Calculator] Config updated with API data');
    }

    parseQuantityRange(range) {
        // Parse "10-23", "24-47", "72+" etc.
        if (range.includes('+')) {
            return [parseInt(range), 999999];
        }
        const parts = range.split('-');
        return [parseInt(parts[0]), parseInt(parts[1] || parts[0])];
    }

    showLoadingState() {
        if (this.container) {
            this.container.innerHTML = `
                <div class="text-center p-5">
                    <div class="spinner-border text-primary" role="status">
                        <span class="visually-hidden">Loading pricing data...</span>
                    </div>
                    <p class="mt-3">Loading pricing data...</p>
                </div>
            `;
        }
    }

    showError(message) {
        if (this.container) {
            this.container.innerHTML = `
                <div class="alert alert-danger">
                    <h4><i class="fas fa-exclamation-triangle"></i> Error</h4>
                    <p>${message}</p>
                    <button class="btn btn-primary" onclick="window.location.href='tel:+12539225793'">
                        <i class="fas fa-phone"></i> Call Now
                    </button>
                </div>
            `;
        }
    }

    render() {
        this.container.innerHTML = `
            <div class="dtf-toggle-pricing-container">
                <!-- Left Column: Print Locations -->
                <div class="dtf-locations-column">
                    <h3 class="dtf-column-header">Print Locations</h3>
                    <div id="dtf-location-toggles"></div>
                    <div class="dtf-info-box mt-4">
                        <i class="fas fa-info-circle"></i>
                        Transfer sizes are automatically determined by location selection
                    </div>
                </div>

                <!-- Right Column: Quantity Tiers -->
                <div class="dtf-tiers-column">
                    <h3 class="dtf-column-header">Quantity Tiers</h3>
                    <div id="dtf-tier-buttons"></div>
                </div>
            </div>

            <!-- Live Price Display -->
            <div class="dtf-live-price-display">
                <div class="dtf-price-amount">$<span id="dtf-live-price">0.00</span></div>
                <div class="dtf-price-details" id="dtf-price-details">
                    <span id="dtf-quantity-display">0</span> pieces + <span id="dtf-locations-display">0</span> location(s)
                </div>
                <div id="dtf-ltm-warning" class="dtf-ltm-warning" style="display: none;">
                    <i class="fas fa-exclamation-triangle"></i>
                    Orders under 24 pieces include a $50.00 setup fee
                </div>
            </div>

            <!-- Accordions for additional info -->
            <div class="accordion-section mt-4">
                <div class="accordion" id="dtfAccordion">
                    <div class="accordion-item">
                        <h2 class="accordion-header">
                            <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse"
                                    data-bs-target="#collapseGuide">
                                <i class="fas fa-ruler"></i> Size Guide
                            </button>
                        </h2>
                        <div id="collapseGuide" class="accordion-collapse collapse">
                            <div class="accordion-body">
                                <p><strong>Small (Up to 5" x 5")</strong><br>
                                Perfect for logos, small designs, pocket prints, and sleeve designs.</p>

                                <p><strong>Medium (Up to 9" x 12")</strong><br>
                                Ideal for standard front/back designs and larger graphics.</p>

                                <p><strong>Large (Up to 12" x 16.5")</strong><br>
                                Maximum size for full coverage designs and oversized prints.</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Render toggles and tiers
        this.renderLocationToggles();
        this.renderTierButtons();
        this.updatePricingDisplay();
    }

    renderLocationToggles() {
        const container = document.getElementById('dtf-location-toggles');

        // Group locations by size
        const locationsBySize = {
            small: DTFConfig.helpers.getLocationsBySize('small'),
            medium: DTFConfig.helpers.getLocationsBySize('medium'),
            large: DTFConfig.helpers.getLocationsBySize('large')
        };

        let html = '';

        // Render each size category
        Object.entries(locationsBySize).forEach(([sizeKey, locations]) => {
            if (locations.length === 0) return;

            const sizeInfo = DTFConfig.transferSizes[sizeKey];

            html += `
                <div class="dtf-size-category">
                    <div class="dtf-size-category-header">
                        <span class="dtf-size-badge">${sizeInfo.name}</span>
                        ${sizeKey.charAt(0).toUpperCase() + sizeKey.slice(1)}
                    </div>
                    <div class="dtf-location-list">
            `;

            locations.forEach(location => {
                const isActive = this.currentData.selectedLocations.has(location.value);

                html += `
                    <div class="dtf-toggle-item ${isActive ? 'active' : ''}" data-location="${location.value}">
                        <span class="dtf-toggle-label">${location.label}</span>
                        <div class="dtf-toggle-switch">
                            <div class="dtf-toggle-switch-slider"></div>
                        </div>
                    </div>
                `;
            });

            html += `
                    </div>
                </div>
            `;
        });

        container.innerHTML = html;
    }

    renderTierButtons() {
        const container = document.getElementById('dtf-tier-buttons');

        const tiers = [
            { value: '10-23', label: '10-23 pieces' },
            { value: '24-47', label: '24-47 pieces' },
            { value: '48-71', label: '48-71 pieces' },
            { value: '72+', label: '72+ pieces' }
        ];

        let html = '';

        tiers.forEach(tier => {
            const isSelected = this.currentData.selectedTier === tier.value;

            html += `
                <button class="dtf-tier-button ${isSelected ? 'selected' : ''}" data-tier="${tier.value}">
                    ${tier.label}
                </button>
            `;
        });

        // Add conditional quantity input for 10-23 tier
        const showInput = this.currentData.selectedTier === '10-23';

        html += `
            <div class="dtf-quantity-input-container ${showInput ? 'show' : ''}">
                <label class="dtf-quantity-input-label">Enter Exact Quantity (10-23):</label>
                <input type="number" id="dtf-exact-quantity" class="dtf-quantity-input"
                       min="10" max="23" value="${this.currentData.quantity}" />
                <small class="dtf-quantity-hint">
                    <i class="fas fa-info-circle"></i> Required for accurate LTM fee calculation
                </small>
            </div>
        `;

        container.innerHTML = html;
    }

    handleToggleClick(locationValue) {
        const location = DTFConfig.transferLocations.find(l => l.value === locationValue);
        if (!location) return;

        // Check if location is currently active
        const wasActive = this.currentData.selectedLocations.has(locationValue);

        if (wasActive) {
            // Deactivate
            this.currentData.selectedLocations.delete(locationValue);
        } else {
            // Get conflicting locations and deactivate them
            const conflicts = DTFConfig.helpers.getConflictingLocations(locationValue);
            conflicts.forEach(conflictLoc => {
                this.currentData.selectedLocations.delete(conflictLoc);
            });

            // Activate this location
            this.currentData.selectedLocations.add(locationValue);
        }

        // Re-render toggles to update UI
        this.renderLocationToggles();
        this.updatePricingDisplay();
    }

    handleTierSelection(tierValue) {
        this.currentData.selectedTier = tierValue;

        // Set quantity based on tier
        if (tierValue === '10-23') {
            // Keep current quantity if in range, otherwise set to 10
            if (this.currentData.quantity < 10 || this.currentData.quantity > 23) {
                this.currentData.quantity = 10;
            }
        } else if (tierValue === '24-47') {
            this.currentData.quantity = 24;
        } else if (tierValue === '48-71') {
            this.currentData.quantity = 48;
        } else if (tierValue === '72+') {
            this.currentData.quantity = 72;
        }

        // Re-render tier buttons
        this.renderTierButtons();
        this.updatePricingDisplay();
    }

    calculatePricing() {
        const quantity = this.currentData.quantity;
        const garmentCost = this.currentData.garmentCost;

        // Check for missing garment cost
        if (!garmentCost || garmentCost === 0) {
            return {
                error: 'No garment cost',
                unitPrice: 0,
                totalOrder: 0
            };
        }

        // Step 1: Garment cost with margin
        const marginDenominator = DTFConfig.settings.garmentMargin; // 0.6
        const markedUpGarment = garmentCost / marginDenominator;

        // Step 2: Calculate transfer costs for all selected locations
        let totalTransferCost = 0;
        const transferDetails = [];

        this.currentData.selectedLocations.forEach(locationValue => {
            const location = DTFConfig.transferLocations.find(l => l.value === locationValue);
            if (!location) return;

            const sizeKey = location.size;
            const transferPrice = DTFConfig.helpers.getTransferPrice(sizeKey, quantity);

            totalTransferCost += transferPrice;
            transferDetails.push({
                location: location.label,
                size: sizeKey,
                price: transferPrice
            });
        });

        // Step 3: Labor cost ($2 per location)
        const locationCount = this.currentData.selectedLocations.size;
        const laborCost = locationCount * DTFConfig.laborCost.costPerLocation;

        // Step 4: Freight (cost per transfer × number of locations)
        const freightPerTransfer = DTFConfig.freightCost.getFreightPerTransfer(quantity);
        const freightCost = freightPerTransfer * locationCount;

        // Step 5: Subtotal (before LTM)
        const subtotal = markedUpGarment + totalTransferCost + laborCost + freightCost;

        // Step 6: LTM Fee (only for quantities under 24)
        let ltmFee = 0;
        let ltmFeePerUnit = 0;
        if (quantity < DTFConfig.settings.ltmFeeThreshold) {
            ltmFee = DTFConfig.settings.ltmFeeAmount; // $50
            ltmFeePerUnit = ltmFee / quantity;
        }

        // Step 7: Total per unit (subtotal + LTM fee per unit)
        const totalPerUnit = subtotal + ltmFeePerUnit;

        // Step 8: Round UP to nearest $0.50 (HalfDollarCeil)
        const finalUnitPrice = this.roundHalfDollarCeil(totalPerUnit);

        // Total order calculation
        const totalOrder = (finalUnitPrice * quantity);

        return {
            quantity,
            garmentCost: markedUpGarment,
            transferDetails,
            totalTransferCost,
            laborCost,
            locationCount,
            freightPerTransfer,
            freightCost,
            ltmFee,
            ltmFeePerUnit,
            subtotal,
            finalUnitPrice,
            totalOrder
        };
    }

    roundHalfDollarCeil(amount) {
        // Round UP to nearest $0.50
        return Math.ceil(amount * 2) / 2;
    }

    updatePricingDisplay() {
        const pricing = this.calculatePricing();

        // Update live price display
        const priceElement = document.getElementById('dtf-live-price');
        const quantityDisplay = document.getElementById('dtf-quantity-display');
        const locationsDisplay = document.getElementById('dtf-locations-display');
        const ltmWarning = document.getElementById('dtf-ltm-warning');

        if (pricing.error) {
            priceElement.textContent = '0.00';
            quantityDisplay.textContent = this.currentData.quantity;
            locationsDisplay.textContent = this.currentData.selectedLocations.size;
            return;
        }

        priceElement.textContent = pricing.finalUnitPrice.toFixed(2);
        quantityDisplay.textContent = pricing.quantity;
        locationsDisplay.textContent = pricing.locationCount;

        // Show/hide LTM warning
        if (pricing.ltmFee > 0) {
            ltmWarning.style.display = 'block';
        } else {
            ltmWarning.style.display = 'none';
        }

        // Update header pricing
        this.updateHeaderPricing(pricing.quantity, pricing.finalUnitPrice);

        // Dispatch pricing update event
        this.container.dispatchEvent(new CustomEvent('dtfPricingUpdated', {
            detail: pricing,
            bubbles: true
        }));
    }

    updateHeaderPricing(quantity, unitPrice) {
        const headerQty = document.getElementById('header-quantity');
        const headerPrice = document.getElementById('header-unit-price');

        if (headerQty) {
            headerQty.textContent = quantity;
        }

        if (headerPrice) {
            if (typeof unitPrice === 'number' && !isNaN(unitPrice) && unitPrice > 0) {
                headerPrice.textContent = `$${unitPrice.toFixed(2)}`;
            } else {
                headerPrice.textContent = '$0.00';
            }
        }
    }

    attachEventListeners() {
        // Toggle click handlers
        this.container.addEventListener('click', (e) => {
            const toggleItem = e.target.closest('.dtf-toggle-item');
            if (toggleItem) {
                const location = toggleItem.dataset.location;
                this.handleToggleClick(location);
                return;
            }

            // Tier button click handlers
            const tierButton = e.target.closest('.dtf-tier-button');
            if (tierButton) {
                const tier = tierButton.dataset.tier;
                this.handleTierSelection(tier);
                return;
            }
        });

        // Exact quantity input for 10-23 tier
        this.container.addEventListener('input', (e) => {
            if (e.target.id === 'dtf-exact-quantity') {
                const value = parseInt(e.target.value);
                if (!isNaN(value) && value >= 10 && value <= 23) {
                    this.currentData.quantity = value;
                    this.updatePricingDisplay();
                }
            }
        });

        // Blur validation for quantity input
        this.container.addEventListener('blur', (e) => {
            if (e.target.id === 'dtf-exact-quantity') {
                let value = parseInt(e.target.value);
                if (isNaN(value) || value < 10) {
                    value = 10;
                } else if (value > 23) {
                    value = 23;
                }
                e.target.value = value;
                this.currentData.quantity = value;
                this.updatePricingDisplay();
            }
        }, true);
    }

    // Public methods for external data updates
    updateGarmentCost(cost) {
        const previousCost = this.currentData.garmentCost;
        this.currentData.garmentCost = parseFloat(cost) || 0;

        if (!this.isRendered) {
            this.pendingUpdates.push(() => this.updatePricingDisplay());
            return;
        }

        if (Math.abs(previousCost - this.currentData.garmentCost) > 0.01) {
            console.log('[DTF Calculator] Garment cost updated:', this.currentData.garmentCost);
        }

        this.updatePricingDisplay();
    }

    updateQuantity(qty) {
        const previousQty = this.currentData.quantity;
        this.currentData.quantity = Math.max(parseInt(qty) || DTFConfig.settings.minQuantity, DTFConfig.settings.minQuantity);

        // Update input if it exists
        const quantityInput = document.getElementById('dtf-exact-quantity');
        if (quantityInput && this.currentData.selectedTier === '10-23') {
            quantityInput.value = this.currentData.quantity;
        }

        if (!this.isRendered) {
            this.pendingUpdates.push(() => this.updatePricingDisplay());
            return;
        }

        if (previousQty !== this.currentData.quantity) {
            console.log('[DTF Calculator] Quantity changed:', this.currentData.quantity);
        }

        this.updatePricingDisplay();
    }

    checkStaffViewStatus() {
        if (sessionStorage.getItem('dtfStaffView') === 'true') {
            document.body.classList.add('show-internal');
        }
    }
}

// Make calculator class available globally
window.DTFPricingCalculator = DTFPricingCalculator;
