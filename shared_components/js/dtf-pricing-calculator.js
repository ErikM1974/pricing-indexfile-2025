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

        // Product upcharge data (populated from productColorsReady event)
        this.productUpcharges = {};
        this.productSizes = [];

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

            // The DTF pricing bundle API should include sizes and upcharges
            if (this.apiData) {
                // Extract sizes
                if (this.apiData.sizes && Array.isArray(this.apiData.sizes)) {
                    this.productSizes = this.apiData.sizes.map(s => s.size);
                    console.log('✅ [DTF Calculator] Sizes loaded from API:', this.productSizes);
                }

                // Extract upcharges
                if (this.apiData.sellingPriceDisplayAddOns) {
                    this.productUpcharges = this.apiData.sellingPriceDisplayAddOns;
                    console.log('✅ [DTF Calculator] Upcharges loaded from API:', this.productUpcharges);
                }

                // If we don't have upcharges yet, we'll get them later from product event
                if (!this.productUpcharges || Object.keys(this.productUpcharges).length === 0) {
                    console.log('⏳ [DTF Calculator] No upcharges in initial load, waiting for product data...');
                }
            }
        } catch (error) {
            console.error('[DTF Calculator] Failed to load API data:', error);
            this.showError('Unable to load pricing data. Please call 253-922-5793');
            return;
        }

        this.render();
        this.attachEventListeners();
        this.setupProductDataListener();

        // Also try to fetch upcharge data immediately if we have a style number
        const urlParams = new URLSearchParams(window.location.search);
        const styleNumber = urlParams.get('StyleNumber') || urlParams.get('styleNumber');
        if (styleNumber) {
            console.log('🚀 [DTF Calculator] Style number found in URL, fetching upcharge data immediately:', styleNumber);
            this.fetchUpchargeData(styleNumber);
        }

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
        // Get style number from URL if available
        const urlParams = new URLSearchParams(window.location.search);
        const styleNumber = urlParams.get('StyleNumber') || urlParams.get('styleNumber');

        // Fetch from pricing-bundle endpoint with style number
        const apiData = await this.pricingService.fetchPricingData(styleNumber);

        if (!apiData) {
            throw new Error('No API data received');
        }

        this.apiData = apiData;

        // Update DTFConfig with API data
        this.mergeApiDataIntoConfig(apiData);

        return apiData;
    }

    /**
     * Store API data in instance for pricing calculations
     * DTFConfig no longer contains pricing - all from API
     */
    mergeApiDataIntoConfig(apiData) {
        // Store transfer pricing tiers in instance (NOT in DTFConfig)
        this.transferPricingTiers = {};
        if (apiData.allDtfCostsR && Array.isArray(apiData.allDtfCostsR)) {
            apiData.allDtfCostsR.forEach(cost => {
                const priceType = cost.price_type;
                const quantityRange = cost.quantity_range;
                const unitPrice = parseFloat(cost.unit_price);
                const sizeKey = priceType.toLowerCase();

                if (!this.transferPricingTiers[sizeKey]) {
                    this.transferPricingTiers[sizeKey] = [];
                }

                const [minQty, maxQty] = this.parseQuantityRange(quantityRange);
                this.transferPricingTiers[sizeKey].push({
                    minQty,
                    maxQty,
                    unitPrice,
                    range: quantityRange
                });
            });
        }

        // Store freight tiers in instance (NOT in DTFConfig)
        this.freightTiers = [];
        if (apiData.freightR && Array.isArray(apiData.freightR)) {
            this.freightTiers = apiData.freightR.map(freight => {
                const [minQty, maxQty] = this.parseQuantityRange(freight.quantity_range);
                return {
                    minQty,
                    maxQty,
                    costPerTransfer: parseFloat(freight.cost_per_transfer)
                };
            }).sort((a, b) => a.minQty - b.minQty);
        }

        // Store labor cost in instance (NOT in DTFConfig)
        this.laborCostPerLocation = 0;
        if (apiData.allDtfCostsR && apiData.allDtfCostsR[0] && apiData.allDtfCostsR[0].PressingLaborCost) {
            this.laborCostPerLocation = parseFloat(apiData.allDtfCostsR[0].PressingLaborCost);
            console.log('[DTF Calculator] Labor cost from API:', this.laborCostPerLocation);
        }

        // Store margin and LTM data from pricing tiers
        this.pricingTiers = [];
        this.ltmFeeAmount = 0;
        this.ltmFeeThreshold = 24;
        if (apiData.tiersR && Array.isArray(apiData.tiersR)) {
            this.pricingTiers = apiData.tiersR.map(tier => ({
                tierLabel: tier.TierLabel,
                minQuantity: tier.MinQuantity,
                maxQuantity: tier.MaxQuantity,
                marginDenominator: tier.MarginDenominator,
                ltmFee: tier.LTM_Fee || 0
            })).sort((a, b) => a.minQuantity - b.minQuantity);

            // Find LTM fee from first tier (10-23)
            const ltmTier = this.pricingTiers.find(t => t.ltmFee > 0);
            if (ltmTier) {
                this.ltmFeeAmount = ltmTier.ltmFee;
                this.ltmFeeThreshold = ltmTier.maxQuantity + 1; // LTM applies below this
            }

            // Get margin from first tier
            if (this.pricingTiers[0]) {
                this.marginDenominator = this.pricingTiers[0].marginDenominator;
                console.log('[DTF Calculator] Margin denominator from API:', this.marginDenominator);
            }
        }

        console.log('[DTF Calculator] API data stored in instance - no hardcoded fallbacks');

        // Update dynamic LTM fee displays now that we have API data
        this.updateLTMFeeDisplays();
    }

    /**
     * Update all LTM fee display elements with API value
     */
    updateLTMFeeDisplays() {
        const ltmFee = this.ltmFeeAmount || 0;
        const formattedFee = `$${ltmFee.toFixed(2)}`;

        // Update warning text
        const warningAmount = document.getElementById('dtf-ltm-warning-amount');
        if (warningAmount) {
            warningAmount.textContent = formattedFee;
        }

        // Update tooltip fee display
        const setupFeeAmount = document.getElementById('dtf-setup-fee-amount');
        if (setupFeeAmount) {
            setupFeeAmount.textContent = `${formattedFee} (GRT-50)`;
        }
    }

    /**
     * Get transfer price for size and quantity from API data
     */
    getTransferPrice(sizeKey, quantity) {
        if (!this.transferPricingTiers || !this.transferPricingTiers[sizeKey]) {
            console.error(`[DTF Calculator] No pricing data for size: ${sizeKey}`);
            return 0;
        }
        const tier = this.transferPricingTiers[sizeKey].find(t => quantity >= t.minQty && quantity <= t.maxQty);
        return tier ? tier.unitPrice : 0;
    }

    /**
     * Get freight per transfer from API data
     */
    getFreightPerTransfer(quantity) {
        if (!this.freightTiers || this.freightTiers.length === 0) {
            console.error('[DTF Calculator] No freight tier data');
            return 0;
        }
        const tier = this.freightTiers.find(t => quantity >= t.minQty && quantity <= t.maxQty);
        return tier ? tier.costPerTransfer : 0;
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
            <!-- DTF Pricing Matrix Header Section -->
            <div class="dtf-pricing-matrix-header">
                <h2 class="dtf-matrix-title">DTF Pricing Matrix</h2>
                <p class="dtf-matrix-subtitle">All locations and quantity tiers for Direct-to-Film transfers.</p>
            </div>

            <div class="dtf-toggle-pricing-container">
                <!-- Left Column: Print Locations -->
                <div class="dtf-locations-column">
                    <div class="dtf-section-header">
                        <i class="fas fa-layer-group dtf-section-icon"></i>
                        <div>
                            <h3 class="dtf-column-header">Print Locations</h3>
                            <p class="dtf-column-subtitle">Select a maximum of two locations.</p>
                        </div>
                    </div>
                    <div id="dtf-location-toggles"></div>
                    <div class="dtf-info-box mt-4">
                        <i class="fas fa-info-circle"></i>
                        Transfer sizes are automatically determined by location selection
                    </div>
                </div>

                <!-- Right Column: Quantity Tiers -->
                <div class="dtf-tiers-column">
                    <div class="dtf-section-header">
                        <i class="fas fa-list-ol dtf-section-icon"></i>
                        <div>
                            <h3 class="dtf-column-header">Quantity Tiers</h3>
                            <p class="dtf-column-subtitle">Choose your order quantity.</p>
                        </div>
                    </div>
                    <div id="dtf-tier-buttons"></div>
                </div>
            </div>

            <!-- Live Price Display -->
            <div class="dtf-live-price-display">
                <div class="dtf-price-label">Price per transfer</div>
                <div class="dtf-price-amount">
                    $<span id="dtf-live-price">0.00</span>
                    <i class="fas fa-info-circle dtf-upcharge-info-icon" id="dtf-upcharge-info-icon"></i>
                    <i class="fas fa-palette setup-fee-badge" id="dtf-setup-fee-badge" style="font-size: 20px; color: white; opacity: 0.85; cursor: pointer;"></i>
                </div>
                <div class="dtf-price-details" id="dtf-price-details">
                    <span id="dtf-quantity-display">0</span> pieces + <span id="dtf-locations-display">0</span> location(s)
                </div>
                <div id="dtf-ltm-warning" class="dtf-ltm-warning" style="display: none;">
                    <i class="fas fa-exclamation-triangle"></i>
                    Orders under 24 pieces include a <span id="dtf-ltm-warning-amount">setup</span> fee
                </div>

                <!-- Setup Fee Tooltip -->
                <div id="dtf-setup-fee-tooltip" class="setup-fee-tooltip" style="display: none; position: absolute; bottom: calc(100% + 15px); left: 50%; transform: translateX(-50%); background: white; border: 2px solid #f59e0b; border-radius: 12px; box-shadow: 0 8px 24px rgba(245, 158, 11, 0.25); padding: 20px; min-width: 300px; z-index: 1000;">
                    <div style="font-size: 16px; font-weight: 700; color: #92400e; margin-bottom: 12px; padding-bottom: 10px; border-bottom: 2px solid #fef3c7; display: flex; align-items: center; gap: 8px;">
                        <i class="fas fa-palette"></i>
                        Art Setup Fee
                    </div>
                    <div style="font-size: 14px; color: #78350f; line-height: 1.6;">
                        <div style="font-size: 18px; font-weight: 700; color: #f59e0b; margin: 8px 0;" id="dtf-setup-fee-amount">Loading...</div>
                        <p><strong>This one-time fee covers:</strong></p>
                        <ul style="margin: 8px 0; padding-left: 20px;">
                            <li>Custom logo mockup on your products</li>
                            <li>Print readiness check for clarity & sizing</li>
                            <li>Up to 2 rounds of revisions</li>
                        </ul>
                        <div style="font-size: 13px; color: #92400e; margin-top: 8px; padding-top: 8px; border-top: 1px solid #fef3c7;">
                            <i class="fas fa-check-circle" style="color: #f59e0b;"></i>
                            One-time charge for new artwork
                        </div>
                        <div style="font-size: 13px; color: #92400e; margin-top: 4px;">
                            <i class="fas fa-check-circle" style="color: #f59e0b;"></i>
                            Applies to all new logos or designs
                        </div>
                    </div>
                    <!-- Tooltip arrow -->
                    <div style="content: ''; position: absolute; top: 100%; left: 50%; transform: translateX(-50%); border: 10px solid transparent; border-top-color: #f59e0b;"></div>
                </div>

                <!-- Size Upcharge Tooltip -->
                <div id="dtf-upcharge-tooltip" class="dtf-upcharge-tooltip" style="display: none;">
                    <div class="dtf-upcharge-tooltip-content">
                        <div class="dtf-upcharge-tooltip-header">Size Pricing</div>
                        <div id="dtf-upcharge-tooltip-body" class="dtf-upcharge-tooltip-body">
                            <!-- Populated by JavaScript -->
                        </div>
                    </div>
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

        // Get LTM fee from API data (stored in instance)
        const ltmFee = this.ltmFeeAmount || 0;
        const ltmLabel = ltmFee > 0 ? `+ $${ltmFee.toFixed(0)} Small Batch Fee` : '';

        const tiers = [
            {
                value: '10-23',
                label: '10-23 pieces',
                isLTM: ltmFee > 0,
                ltmFee: ltmFee,
                ltmLabel: ltmLabel
            },
            { value: '24-47', label: '24-47 pieces' },
            { value: '48-71', label: '48-71 pieces' },
            { value: '72+', label: '72+ pieces' }
        ];

        let html = '';

        tiers.forEach(tier => {
            const isSelected = this.currentData.selectedTier === tier.value;

            html += `
                <button class="dtf-tier-button universal-tier-button ${isSelected ? 'selected' : ''}" data-tier="${tier.value}">
                    ${tier.label}
                    ${tier.isLTM ? `<br><small style="font-size: 11px; opacity: 0.9; margin-top: 4px; font-weight: 600;">${tier.ltmLabel}</small>` : ''}
                </button>
            `;
        });

        // Add conditional quantity input for 10-23 tier
        const showInput = this.currentData.selectedTier === '10-23';
        const currentQty = this.currentData.quantity || 10;
        const ltmFeePerPiece = ltmFee > 0 ? (ltmFee / currentQty).toFixed(2) : '0.00';

        html += `
            <div class="dtf-quantity-input-container universal-quantity-input-container ${showInput ? 'show' : ''}">
                <label class="dtf-quantity-input-label universal-quantity-input-label">
                    <i class="fas fa-calculator"></i> Enter Exact Quantity (10-23 pieces):
                </label>
                <input type="number" id="dtf-exact-quantity" class="dtf-quantity-input universal-quantity-input"
                       min="10" max="23" value="${currentQty}" placeholder="Enter 10-23" />
                <small class="dtf-quantity-hint universal-quantity-hint">
                    <i class="fas fa-info-circle"></i>
                    Required for accurate fee distribution:
                    <strong id="dtf-ltm-fee-calc">$${ltmFee.toFixed(0)} ÷ ${currentQty} = $${ltmFeePerPiece}/piece</strong>
                </small>
            </div>
        `;

        container.innerHTML = html;
    }

    updateDTFLTMFeeDisplay() {
        const feeCalcElement = document.getElementById('dtf-ltm-fee-calc');
        if (feeCalcElement && this.currentData.selectedTier === '10-23') {
            const qty = this.currentData.quantity || 10;
            const ltmFee = this.ltmFeeAmount || 0;
            const feePerPiece = ltmFee > 0 ? (ltmFee / qty).toFixed(2) : '0.00';
            feeCalcElement.textContent = `$${ltmFee.toFixed(0)} ÷ ${qty} = $${feePerPiece}/piece`;
        }
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

        // Check if any locations are selected - must select at least one location
        if (this.currentData.selectedLocations.size === 0) {
            return {
                error: 'No locations selected',
                unitPrice: 0,
                totalOrder: 0,
                quantity: quantity,
                locationCount: 0
            };
        }

        // Check for missing garment cost
        if (!garmentCost || garmentCost === 0) {
            return {
                error: 'No garment cost',
                unitPrice: 0,
                totalOrder: 0
            };
        }

        // Step 1: Garment cost with margin
        // Margin from API (stored in instance) - not hardcoded
        const marginDenominator = this.marginDenominator || 0.57;
        const markedUpGarment = garmentCost / marginDenominator;

        // Step 2: Calculate transfer costs for all selected locations
        let totalTransferCost = 0;
        const transferDetails = [];

        this.currentData.selectedLocations.forEach(locationValue => {
            const location = DTFConfig.transferLocations.find(l => l.value === locationValue);
            if (!location) return;

            const sizeKey = location.size;
            const transferPrice = this.getTransferPrice(sizeKey, quantity);

            totalTransferCost += transferPrice;
            transferDetails.push({
                location: location.label,
                size: sizeKey,
                price: transferPrice
            });
        });

        // Step 3: Labor cost from API (stored in instance)
        const locationCount = this.currentData.selectedLocations.size;
        const laborCost = locationCount * (this.laborCostPerLocation || 0);

        // Step 4: Freight from API (stored in instance)
        const freightPerTransfer = this.getFreightPerTransfer(quantity);
        const freightCost = freightPerTransfer * locationCount;

        // Step 5: Subtotal (before LTM)
        const subtotal = markedUpGarment + totalTransferCost + laborCost + freightCost;

        // Step 6: LTM Fee from API (only for quantities under threshold)
        let ltmFee = 0;
        let ltmFeePerUnit = 0;
        const ltmThreshold = this.ltmFeeThreshold || 24;
        if (quantity < ltmThreshold) {
            ltmFee = this.ltmFeeAmount || 0;
            ltmFeePerUnit = ltmFee > 0 ? ltmFee / quantity : 0;
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
                    this.updateDTFLTMFeeDisplay();
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

        // Setup Fee Tooltip - Similar to DTG implementation
        const dtfSetupFeeBadge = document.getElementById('dtf-setup-fee-badge');
        const dtfSetupFeeTooltip = document.getElementById('dtf-setup-fee-tooltip');

        if (dtfSetupFeeBadge && dtfSetupFeeTooltip) {
            console.log('✅ [DTF Calculator] Initializing setup fee tooltip');

            // Desktop: Show on hover
            dtfSetupFeeBadge.addEventListener('mouseenter', () => {
                if (window.innerWidth > 768) {
                    dtfSetupFeeTooltip.style.display = 'block';
                }
            });

            dtfSetupFeeBadge.addEventListener('mouseleave', () => {
                if (window.innerWidth > 768) {
                    setTimeout(() => {
                        if (!dtfSetupFeeTooltip.matches(':hover')) {
                            dtfSetupFeeTooltip.style.display = 'none';
                        }
                    }, 100);
                }
            });

            dtfSetupFeeTooltip.addEventListener('mouseleave', () => {
                if (window.innerWidth > 768) {
                    dtfSetupFeeTooltip.style.display = 'none';
                }
            });

            // Mobile: Show on tap
            dtfSetupFeeBadge.addEventListener('click', (e) => {
                e.stopPropagation();
                dtfSetupFeeTooltip.style.display = dtfSetupFeeTooltip.style.display === 'block' ? 'none' : 'block';
            });

            // Close when clicking outside
            document.addEventListener('click', (e) => {
                if (!dtfSetupFeeTooltip.contains(e.target) && e.target !== dtfSetupFeeBadge) {
                    dtfSetupFeeTooltip.style.display = 'none';
                }
            });
        }

        // Size Upcharge Tooltip - Add event listeners for upcharge tooltip
        const dtfUpchargeIcon = document.getElementById('dtf-upcharge-info-icon');
        const dtfUpchargeTooltip = document.getElementById('dtf-upcharge-tooltip');

        if (dtfUpchargeIcon && dtfUpchargeTooltip) {
            console.log('✅ [DTF Calculator] Initializing size upcharge tooltip');

            // Desktop: Show on hover
            dtfUpchargeIcon.addEventListener('mouseenter', () => {
                if (window.innerWidth > 768) {
                    this.updateUpchargeTooltipContent();
                    dtfUpchargeTooltip.style.display = 'block';
                }
            });

            dtfUpchargeIcon.addEventListener('mouseleave', () => {
                if (window.innerWidth > 768) {
                    setTimeout(() => {
                        if (!dtfUpchargeTooltip.matches(':hover')) {
                            dtfUpchargeTooltip.style.display = 'none';
                        }
                    }, 100);
                }
            });

            dtfUpchargeTooltip.addEventListener('mouseleave', () => {
                if (window.innerWidth > 768) {
                    dtfUpchargeTooltip.style.display = 'none';
                }
            });

            // Mobile: Show on tap, hide on outside click
            dtfUpchargeIcon.addEventListener('click', (e) => {
                e.stopPropagation();
                this.updateUpchargeTooltipContent();
                dtfUpchargeTooltip.style.display = dtfUpchargeTooltip.style.display === 'block' ? 'none' : 'block';
            });

            // Close tooltip when clicking outside
            document.addEventListener('click', (e) => {
                if (!dtfUpchargeTooltip.contains(e.target) && e.target !== dtfUpchargeIcon) {
                    dtfUpchargeTooltip.style.display = 'none';
                }
            });
        }
    }

    async fetchUpchargeData(styleNumber) {
        try {
            // Fetch max prices and upcharges data
            console.log('📡 [DTF Calculator] Fetching max prices for style:', styleNumber);
            const response = await fetch(`https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/max-prices-by-style?styleNumber=${styleNumber}`);

            if (!response.ok) {
                throw new Error(`Failed to fetch max prices: ${response.status}`);
            }

            const data = await response.json();
            console.log('✅ [DTF Calculator] Max prices data received:', data);

            // Extract sizes from the response
            if (data.sizes && Array.isArray(data.sizes)) {
                this.productSizes = data.sizes.map(s => s.size);
                console.log('✅ [DTF Calculator] Sizes loaded:', this.productSizes);
            }

            // Extract upcharges directly from sellingPriceDisplayAddOns
            if (data.sellingPriceDisplayAddOns) {
                this.productUpcharges = data.sellingPriceDisplayAddOns;
                console.log('✅ [DTF Calculator] Upcharges loaded:', this.productUpcharges);
            }

            // Update tooltip content immediately
            this.updateUpchargeTooltipContent();

            // Update tooltip if it's currently visible
            const tooltip = document.getElementById('dtf-upcharge-tooltip');
            if (tooltip && tooltip.style.display === 'block') {
                this.updateUpchargeTooltipContent();
            }

            console.log('📊 [DTF Calculator] Tooltip data updated:', {
                sizes: this.productSizes,
                upcharges: this.productUpcharges
            });

        } catch (error) {
            console.error('❌ [DTF Calculator] Failed to fetch max prices:', error);

            // No fallback needed - this endpoint should work for all styles
            console.warn('⚠️ [DTF Calculator] Unable to load size upcharge data');
        }
    }

    setupProductDataListener() {
        console.log('🔧 [DTF Calculator] Setting up product data listener...');

        // Listen for productColorsReady event - but we need to fetch our own sizing data
        document.addEventListener('productColorsReady', async (e) => {
            console.log('🎯 [DTF Calculator] Product colors event received, fetching size/upcharge data...');
            console.log('📦 [DTF Calculator] Event detail:', e.detail);

            // Try to get style number from multiple possible locations
            const styleNumber = e.detail?.styleNumber ||
                               e.detail?.style ||
                               window.selectedStyleNumber ||
                               new URLSearchParams(window.location.search).get('StyleNumber');

            console.log('🏷️ [DTF Calculator] Style number resolved to:', styleNumber);

            if (!styleNumber) {
                console.warn('⚠️ [DTF Calculator] No style number found in event or globals');
                return;
            }

            // Call the shared method
            await this.fetchUpchargeData(styleNumber);
        });
    }

    updateUpchargeTooltipContent() {
        const tooltipBody = document.getElementById('dtf-upcharge-tooltip-body');
        if (!tooltipBody) return;

        console.log('🎯 [DTF Calculator] Updating upcharge tooltip with:', {
            sizes: this.productSizes,
            upcharges: this.productUpcharges
        });

        // Filter to only show upcharges for sizes that exist for this product
        const upcharges = {};
        Object.entries(this.productUpcharges).forEach(([size, amount]) => {
            if (this.productSizes.includes(size) && amount > 0) {
                upcharges[size] = amount;
            }
        });

        // Build tooltip content
        let html = '';

        // Base price info - show only sizes without upcharges
        const baseSizes = this.productSizes.filter(size => !upcharges[size]);
        if (baseSizes.length > 0) {
            html += '<div class="dtf-upcharge-base">';
            html += '<div class="dtf-upcharge-item">';
            html += `<span class="dtf-upcharge-item-size">${baseSizes.join(', ')}</span>`;
            html += '<span class="dtf-upcharge-item-price">Base Price</span>';
            html += '</div>';
            html += '</div>';
        }

        // Sort upcharge sizes for display
        const upchargeSizes = Object.keys(upcharges).sort((a, b) => {
            // Custom sort: 2XL, 3XL, 4XL, 5XL, 6XL, then others
            const sizeOrder = ['2XL', '3XL', '4XL', '5XL', '6XL'];
            const aIndex = sizeOrder.indexOf(a);
            const bIndex = sizeOrder.indexOf(b);

            if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
            if (aIndex !== -1) return -1;
            if (bIndex !== -1) return 1;
            return a.localeCompare(b);
        });

        // Add upcharge items
        upchargeSizes.forEach(size => {
            const upcharge = upcharges[size];
            if (upcharge > 0) {
                html += '<div class="dtf-upcharge-item">';
                html += `<span class="dtf-upcharge-item-size">${size}</span>`;
                html += `<span class="dtf-upcharge-item-price">+$${upcharge.toFixed(2)}</span>`;
                html += '</div>';
            }
        });

        // If no upcharges found
        if (upchargeSizes.length === 0 && baseSizes.length === 0) {
            html += '<div style="text-align: center; color: #6b7280; padding: 10px;">';
            html += 'Size information loading...';
            html += '</div>';
        } else if (upchargeSizes.length === 0) {
            html += '<div style="text-align: center; color: #6b7280; padding: 10px;">';
            html += 'No size upcharges for this style';
            html += '</div>';
        }

        tooltipBody.innerHTML = html;
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
