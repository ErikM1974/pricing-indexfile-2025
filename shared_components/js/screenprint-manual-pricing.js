/**
 * Screen Print Manual Pricing - Based on V2
 * Modified for manual base cost input
 * Uses API for all pricing rules, margins, LTM fees
 *
 * ⚠️ CRITICAL: PRICING SYNCHRONIZATION REQUIRED
 *
 * This file MUST stay synchronized with the Screen Print pricing source of truth.
 *
 * Source of Truth: /shared_components/js/screenprint-pricing-v2.js
 *
 * Before modifying pricing logic, check if changes exist in source file.
 * After modifying source file, update this file to match.
 *
 * Key areas that must stay synchronized:
 * 1. Flash charge application (per color, to ALL colors)
 * 2. Dark garment toggle default (defaults to ON/true)
 * 3. Primary location pricing (flash + margin calculation)
 * 4. Additional location pricing (use BasePrintCost as-is, margin included)
 * 5. Order summary (currently disabled)
 * 6. Setup fee calculations
 * 7. LTM fee logic
 * 8. Safety stripes implementation
 *
 * Last synchronized: 2025-10-04
 */

class ScreenPrintManualPricing {
    constructor() {
        // Configuration
        this.config = {
            isManualMode: true, // FLAG: Manual calculator mode
            minimumQuantity: 24,
            standardQuantity: 37, // Updated to match tier 2 default
            // ltmThreshold and ltmFee removed - now comes from API tiers
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
            quantity: 37, // Default to tier 2 (37-72 pieces)
            frontColors: 1,
            frontHasSafetyStripes: false,
            additionalLocations: [], // [{location: 'back', colors: 2, hasSafetyStripes: false}, ...]
            isDarkGarment: true,  // Default to dark garment (most common use case)
            garmentColor: '',
            styleNumber: '',
            productTitle: '',
            pricingData: null,
            masterBundle: null,
            safetyStripeSurcharge: 2.00
        };

        // DOM elements cache
        this.elements = {};
        
        // Initialize pricing service
        this.pricingService = null;
        // Direct API mode only - Caspio removed
        
        // Initialize when DOM ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.init());
        } else {
            this.init();
        }
    }

    async init() {
        console.log('[ScreenPrintV2] Initializing...');

        // Initialize pricing service
        if (typeof ScreenPrintPricingService !== 'undefined') {
            this.pricingService = new ScreenPrintPricingService();
            console.log('[ScreenPrintV2] API service initialized');
        } else {
            console.error('[ScreenPrintV2] ScreenPrintPricingService not found!');
        }

        this.cacheElements();
        this.createUI();
        this.bindEvents();
        this.updateDarkGarmentToggleUI();  // Ensure toggle shows active state on load

        // MANUAL MODE: Load raw API data (bypass service calculation that needs sizes)
        if (this.config.isManualMode) {
            console.log('[Manual] Loading raw API pricing data...');
            try {
                const response = await fetch('https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/pricing-bundle?method=ScreenPrint');
                if (!response.ok) {
                    throw new Error(`API request failed: ${response.status}`);
                }

                const rawData = await response.json();

                // Validate required fields
                if (!rawData.tiersR || !rawData.allScreenprintCostsR || !rawData.rulesR) {
                    throw new Error('Invalid API response - missing required fields');
                }

                console.log('[Manual] Raw API data loaded:', {
                    tiers: rawData.tiersR?.length,
                    printCosts: rawData.allScreenprintCostsR?.length,
                    flashCharge: rawData.rulesR?.FlashCharge,
                    roundingMethod: rawData.rulesR?.RoundingMethod
                });

                // Transform raw data to expected calculator structure
                const transformedData = this.transformRawAPIData(rawData);

                // Store transformed data
                this.state.pricingData = transformedData;
                this.state.masterBundle = transformedData;

                // Make globally available
                window.screenPrintPricingData = transformedData;

                console.log('[Manual] Transformed data ready for calculations');

                // Dispatch event for compatibility
                window.dispatchEvent(new CustomEvent('screenPrintPricingLoaded', {
                    detail: transformedData
                }));

            } catch (error) {
                console.error('[Manual] Error loading API data:', error);
                alert('Failed to load pricing data. Please refresh the page or contact support.');
            }
        } else {
            this.checkUrlParams();
        }

        // Initialize UI with defaults
        this.updateColorToggles();  // Highlight default color (1)
        this.updateTierButtons();   // Highlight default tier (37-72)

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

        // NEW TOGGLE-BASED UI - PHASE 1
        container.innerHTML = `
            <div class="sp-calculator">
                <h3 class="sp-title">Screen Print Pricing Calculator</h3>

                <!-- Dark Garment Toggle - Positioned at Top -->
                <div class="sp-dark-garment-section-top${this.state.isDarkGarment ? ' active' : ''}">
                    <div class="sp-dark-garment-toggle${this.state.isDarkGarment ? ' active' : ''}" id="sp-dark-garment-toggle">
                        <div class="sp-dark-garment-label">
                            <span>Printing on dark garment?</span>
                            <i class="fas fa-info-circle sp-dark-info-icon" id="sp-dark-info-icon"></i>
                            <span class="sp-dark-garment-info">(White underbase required)</span>
                        </div>
                        <div class="sp-toggle-switch">
                            <div class="sp-toggle-switch-slider"></div>
                        </div>
                    </div>

                    <!-- Dark Garment Tooltip - Shows on hover/click -->
                    <div id="sp-dark-tooltip" class="sp-dark-tooltip" style="display: none;">
                        <div class="sp-dark-tooltip-content">
                            <div class="sp-dark-tooltip-header">
                                <i class="fas fa-tshirt"></i> Why Dark Garment Adds a Color
                            </div>
                            <div class="sp-dark-tooltip-body">
                                When printing on black or dark-colored shirts, we must print a <strong>white underbase layer first</strong> so your ink colors appear vibrant and true to their intended shade.
                                <br><br>
                                This underbase requires an additional screen setup and counts as one color in your total.
                                <br><br>
                                <strong>Example:</strong> Red + Green + Yellow design on a black shirt = <strong>4 colors total</strong> (3 design colors + 1 white underbase)
                                <br><br>
                                <em>The underbase is applied to ALL printed locations on the garment.</em>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Toggle Switch Pricing Interface -->
                <div class="sp-toggle-pricing-container">
                    <!-- Left Panel: Ink Colors -->
                    <div class="sp-toggle-section">
                        <div class="sp-workflow-step-label">Step 1: Select Colors</div>
                        <div class="sp-toggle-section-title">
                            <i class="fas fa-palette"></i>
                            Front Location Ink Colors
                        </div>
                        <div class="sp-toggle-section-subtitle">
                            Select the number of ink colors for your front design.
                        </div>

                        <div class="sp-color-grid">
                            ${[1, 2, 3, 4, 5, 6].map(colorCount => `
                                <div class="sp-toggle-item ${colorCount === 1 ? 'active' : ''}"
                                     id="sp-toggle-${colorCount}color"
                                     data-colors="${colorCount}">
                                    <div class="sp-toggle-item-label">
                                        <span>${colorCount} Color${colorCount > 1 ? 's' : ''}</span>
                                    </div>
                                    <div class="sp-toggle-switch">
                                        <div class="sp-toggle-switch-slider"></div>
                                    </div>
                                </div>
                            `).join('')}
                        </div>

                        <!-- Safety Stripes Toggle -->
                        <div class="sp-safety-stripes-toggle" id="sp-safety-stripes-toggle">
                            <div class="sp-safety-stripes-label">
                                <span>Safety Stripes Design</span>
                                <span class="sp-safety-stripes-info">4-color design: +$${this.state.safetyStripeSurcharge.toFixed(2)} per piece</span>
                            </div>
                            <div class="sp-toggle-switch">
                                <div class="sp-toggle-switch-slider"></div>
                            </div>
                        </div>
                    </div>

                    <!-- Right Panel: Quantity Tiers -->
                    <div class="sp-toggle-section">
                        <div class="sp-workflow-step-label">Step 2: Select Quantity</div>
                        <div class="sp-toggle-section-title">
                            <i class="fas fa-chart-bar"></i>
                            Quantity Tiers
                        </div>

                        <button class="sp-tier-button" id="sp-tier-24-36" data-tier="24-36">
                            24-36 pieces
                            <small>+ $75 Small Batch Fee</small>
                        </button>

                        <button class="sp-tier-button selected" id="sp-tier-37-72" data-tier="37-72">
                            37-72 pieces
                            <small>+ $50 Small Batch Fee</small>
                        </button>

                        <button class="sp-tier-button" id="sp-tier-73-144" data-tier="73-144">
                            73-144 pieces
                        </button>

                        <button class="sp-tier-button" id="sp-tier-145-576" data-tier="145-576">
                            145-576 pieces
                        </button>
                    </div>
                </div>

                <!-- Additional Locations Section - MOVED BEFORE STEP 3 FOR LOGICAL WORKFLOW -->
                <div class="sp-additional-locations-section" id="sp-additional-locations-section">
                    <div class="sp-additional-locations-header" id="sp-additional-locations-header">
                        <div class="sp-additional-locations-title">
                            <i class="fas fa-chevron-down"></i>
                            Additional Print Locations
                        </div>
                        <div class="sp-additional-locations-subtitle">Add up to 3 additional locations</div>
                    </div>
                    <div class="sp-additional-locations-content" id="sp-additional-locations-container">
                        <!-- Location slots will be inserted here -->
                    </div>
                    <!-- Add Location button (moved outside container to prevent deletion) -->
                    <button type="button" id="sp-add-location" class="sp-add-location-button">
                        <i class="fas fa-plus"></i>
                        Add Location
                    </button>
                </div>

                <!-- Enhanced Live Price Display - NOW CALCULATES WITH ALL INPUTS -->
                <div class="sp-live-price-display sp-live-price-prominent">
                    <div class="sp-live-price-workflow-label">Step 3: Your Price</div>

                    <!-- Pricing Tier Display -->
                    <div class="sp-pricing-tier-display" id="sp-pricing-tier-display" style="display: none;">
                        <i class="fas fa-layer-group"></i>
                        <span>Pricing Tier: <strong id="sp-pricing-tier-label">—</strong></span>
                    </div>

                    <!-- Primary Pricing Info -->
                    <div class="sp-pricing-primary">
                        <div class="sp-price-row sp-price-per-shirt">
                            <span class="sp-price-label">Price per shirt</span>
                            <div class="sp-price-amount-wrapper">
                                <span class="sp-live-price-amount" id="sp-live-price-amount">$0.00</span>
                                <i class="fas fa-info-circle sp-upcharge-info-icon" id="sp-upcharge-info-icon"></i>

                                <!-- Upcharge Tooltip - positioned relative to icon -->
                                <div id="sp-upcharge-tooltip" class="sp-upcharge-tooltip">
                                    <div class="sp-upcharge-tooltip-content">
                                        <div class="sp-upcharge-tooltip-header">Size Pricing</div>
                                        <div id="sp-upcharge-tooltip-body" class="sp-upcharge-tooltip-body">
                                            <!-- Populated by JavaScript -->
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div class="sp-price-row sp-price-quantity-calc" id="sp-price-quantity-calc" style="display: none;">
                            <span class="sp-price-calc-text">
                                <i class="fas fa-times"></i> <span id="sp-calc-quantity">37</span> pieces
                            </span>
                            <span class="sp-price-calc-result" id="sp-calc-subtotal">$0.00</span>
                        </div>
                    </div>

                    <!-- Setup Fees Section -->
                    <div class="sp-pricing-setup" id="sp-pricing-setup" style="display: none;">
                        <div class="sp-setup-header">
                            <i class="fas fa-palette"></i> Setup Fees
                        </div>
                        <div class="sp-setup-breakdown" id="sp-setup-breakdown-live">
                            <!-- Populated by JavaScript -->
                        </div>
                        <div class="sp-price-row sp-setup-total">
                            <span class="sp-price-label">Setup Total</span>
                            <span class="sp-price-amount" id="sp-setup-total-amount">$0.00</span>
                        </div>
                    </div>

                    <!-- LTM Fee Section -->
                    <div class="sp-pricing-ltm" id="sp-pricing-ltm" style="display: none;">
                        <div class="sp-price-row sp-ltm-fee">
                            <span class="sp-price-label">
                                <i class="fas fa-exclamation-triangle"></i> Small Batch Fee
                            </span>
                            <span class="sp-price-amount" id="sp-ltm-fee-amount">$0.00</span>
                        </div>
                    </div>

                    <!-- Order Total -->
                    <div class="sp-pricing-total" id="sp-pricing-total" style="display: none;">
                        <div class="sp-price-row sp-order-total">
                            <span class="sp-price-label">ORDER TOTAL</span>
                            <span class="sp-price-amount sp-total-highlight" id="sp-order-total-amount">$0.00</span>
                        </div>
                        <div class="sp-price-average" id="sp-price-average">
                            Avg <span id="sp-avg-per-shirt">$0.00</span>/shirt
                        </div>
                    </div>

                    <!-- Toggle Breakdown -->
                    <div class="sp-breakdown-toggle" id="sp-breakdown-toggle" style="display: none;">
                        <button type="button" class="sp-toggle-breakdown-btn" id="sp-toggle-breakdown-btn">
                            <i class="fas fa-chevron-down"></i>
                            <span id="sp-toggle-breakdown-text">Show Details</span>
                        </button>
                    </div>
                </div>

                <!-- Order Summary -->
                <div id="sp-order-summary" class="sp-order-summary" style="display: none;">
                    <h4>Order Summary</h4>
                    <div id="sp-summary-content"></div>
                </div>

                <!-- Hidden Fields for Compatibility -->
                <input type="hidden" id="sp-quantity" value="${this.state.quantity}">
                <input type="hidden" id="sp-front-colors" value="${this.state.frontColors}">
                <input type="hidden" id="sp-front-safety" ${this.state.frontHasSafetyStripes ? 'checked' : ''}>
                <div id="sp-additional-locations" style="display: none;"></div>
                <input type="hidden" id="sp-dark-garment" ${this.state.isDarkGarment ? 'checked' : ''}>
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
        // MANUAL MODE: Listen for base cost input changes
        if (this.config.isManualMode) {
            const manualCostInput = document.getElementById('manual-base-cost');
            if (manualCostInput) {
                manualCostInput.addEventListener('input', () => {
                    console.log('[Manual] Base cost changed:', manualCostInput.value);
                    this.updateDisplay();
                });
            }
        }

        // NEW: Color Toggle Switches (1-6 colors)
        for (let colorCount = 1; colorCount <= 6; colorCount++) {
            const toggle = document.getElementById(`sp-toggle-${colorCount}color`);
            toggle?.addEventListener('click', () => {
                this.selectColorCount(colorCount);
            });
        }

        // NEW: Tier Buttons (Ed Lacey's structure)
        const tierButtons = [
            { id: 'sp-tier-24-36', tier: '24-36', qty: 24 },
            { id: 'sp-tier-37-72', tier: '37-72', qty: 37 },
            { id: 'sp-tier-73-144', tier: '73-144', qty: 73 },
            { id: 'sp-tier-145-576', tier: '145-576', qty: 145 }
        ];

        tierButtons.forEach(({id, tier, qty}) => {
            document.getElementById(id)?.addEventListener('click', () => {
                this.selectQuantityTier(tier, qty);
            });
        });

        // NEW: Safety Stripes Toggle
        document.getElementById('sp-safety-stripes-toggle')?.addEventListener('click', () => {
            this.toggleSafetyStripes();
        });

        // NEW: Dark Garment Toggle
        document.getElementById('sp-dark-garment-toggle')?.addEventListener('click', () => {
            this.toggleDarkGarment();
        });

        // NEW: Dark Garment Info Icon - Desktop hover + Mobile click
        const darkInfoIcon = document.getElementById('sp-dark-info-icon');
        const darkTooltip = document.getElementById('sp-dark-tooltip');

        if (darkInfoIcon && darkTooltip) {
            // Desktop: Show on hover
            darkInfoIcon.addEventListener('mouseenter', () => {
                if (window.innerWidth > 768) {
                    darkTooltip.style.display = 'block';
                }
            });

            darkInfoIcon.addEventListener('mouseleave', () => {
                if (window.innerWidth > 768) {
                    darkTooltip.style.display = 'none';
                }
            });

            // Mobile: Toggle on click
            darkInfoIcon.addEventListener('click', (e) => {
                e.stopPropagation();
                const isVisible = darkTooltip.style.display === 'block';
                darkTooltip.style.display = isVisible ? 'none' : 'block';
            });

            // Close tooltip when clicking outside
            document.addEventListener('click', (e) => {
                if (!darkTooltip.contains(e.target) && e.target !== darkInfoIcon) {
                    darkTooltip.style.display = 'none';
                }
            });
        }

        // NEW: Additional Locations Header (Collapse/Expand)
        document.getElementById('sp-additional-locations-header')?.addEventListener('click', () => {
            this.toggleAdditionalLocationsSection();
        });

        // Add location button
        document.getElementById('sp-add-location')?.addEventListener('click', () => {
            this.addLocation();
        });

        // NEW: Upcharge Info Icon - Desktop hover + Mobile click
        const upchargeIcon = document.getElementById('sp-upcharge-info-icon');
        const upchargeTooltip = document.getElementById('sp-upcharge-tooltip');

        if (upchargeIcon && upchargeTooltip) {
            // Desktop: Show on hover
            upchargeIcon.addEventListener('mouseenter', () => {
                if (window.innerWidth > 768) {
                    this.updateUpchargeTooltipContent();
                    upchargeTooltip.classList.add('show');
                }
            });

            upchargeIcon.addEventListener('mouseleave', () => {
                if (window.innerWidth > 768) {
                    // Small delay to allow moving to tooltip
                    setTimeout(() => {
                        if (!upchargeTooltip.matches(':hover')) {
                            upchargeTooltip.classList.remove('show');
                        }
                    }, 100);
                }
            });

            upchargeTooltip.addEventListener('mouseleave', () => {
                if (window.innerWidth > 768) {
                    upchargeTooltip.classList.remove('show');
                }
            });

            // Mobile: Show on tap
            upchargeIcon.addEventListener('click', (e) => {
                e.stopPropagation();
                this.updateUpchargeTooltipContent();
                upchargeTooltip.classList.toggle('show');
            });

            // Close tooltip when clicking outside (mobile)
            document.addEventListener('click', (e) => {
                if (!upchargeTooltip.contains(e.target) && e.target !== upchargeIcon) {
                    upchargeTooltip.classList.remove('show');
                }
            });
        }

        // Accordion toggles
        document.querySelectorAll('.sp-accordion-trigger').forEach(trigger => {
            trigger.addEventListener('click', () => this.toggleAccordion(trigger));
        });

        // NEW: Breakdown toggle button
        document.getElementById('sp-toggle-breakdown-btn')?.addEventListener('click', () => {
            this.togglePriceBreakdown();
        });

        // NEW: Listen for additional location changes (delegated to container)
        const additionalLocationsContainer = document.getElementById('sp-additional-locations-container');
        if (additionalLocationsContainer) {
            // Handle select changes (location and color count)
            additionalLocationsContainer.addEventListener('change', (e) => {
                if (e.target.classList.contains('sp-location-slot-select')) {
                    this.updateLocations();
                }
                // Handle safety stripes checkbox for additional locations
                if (e.target.classList.contains('sp-location-safety')) {
                    const index = parseInt(e.target.dataset.index);
                    this.updateLocationSafetyStripes(index, e.target.checked);
                }
            });

            // Handle remove button clicks
            additionalLocationsContainer.addEventListener('click', (e) => {
                if (e.target.classList.contains('sp-location-slot-remove') ||
                    e.target.closest('.sp-location-slot-remove')) {
                    const button = e.target.closest('.sp-location-slot-remove') || e.target;
                    const index = parseInt(button.dataset.index);
                    if (!isNaN(index)) {
                        this.removeLocation(index);
                    }
                }
            });
        }

        // Caspio event listener removed - using direct API only

        // Listen for color changes from product display
        document.addEventListener('productColorChanged', (e) => {
            if (e.detail?.color) {
                this.updateGarmentColor(e.detail.color);
            }
        });
    }

    async checkUrlParams() {
        const params = new URLSearchParams(window.location.search);
        const color = params.get('COLOR') || params.get('color');
        const styleNumber = params.get('StyleNumber') || params.get('styleNumber');

        if (color) {
            this.updateGarmentColor(color);
        }

        if (styleNumber) {
            this.state.styleNumber = styleNumber;

            // Load pricing data via API if in API mode
            if (this.pricingService) {
                try {
                    console.log(`[ScreenPrintV2] Loading pricing data via API for ${styleNumber}`);
                    const data = await this.pricingService.fetchPricingData(styleNumber);

                    if (data) {
                        this.handleMasterBundle(data);
                    } else {
                        console.error('[ScreenPrintV2] API returned null - no pricing data available');
                    }
                } catch (error) {
                    console.error('[ScreenPrintV2] Error loading pricing data:', error);
                }
            } else {
                console.error('[ScreenPrintV2] Pricing service not initialized');
            }
        }
    }

    // ==================== NEW TOGGLE UI HANDLERS (Phase 2) ====================

    /**
     * Handle color count toggle selection
     */
    selectColorCount(count) {
        console.log(`[ScreenPrintV2] Color count selected: ${count}`);

        // Update state
        this.state.frontColors = count;

        // Update hidden field for compatibility
        const hiddenField = document.getElementById('sp-front-colors');
        if (hiddenField) hiddenField.value = count;

        // Update visual state of toggles
        this.updateColorToggles();

        // Trigger pricing update
        this.updateFrontColors(count);
    }

    /**
     * Handle quantity tier button selection
     */
    selectQuantityTier(tier, quantity) {
        console.log(`[ScreenPrintV2] Tier selected: ${tier}, quantity: ${quantity}`);

        // Update state - store tier only, NOT specific quantity
        // User has selected a RANGE (e.g., 73-144), not a specific number
        this.state.selectedTier = tier;

        // DO NOT set this.state.quantity - we don't know how many they actually want
        // The quantity parameter is just the tier minimum for pricing lookup

        // Update visual state of tier buttons
        this.updateTierButtons();

        // Trigger pricing update using tier minimum for price calculation only
        this.updateQuantity(quantity);
    }

    /**
     * Toggle safety stripes for front location
     */
    toggleSafetyStripes() {
        const toggle = document.getElementById('sp-safety-stripes-toggle');
        if (!toggle) return;

        // Toggle state
        this.state.frontHasSafetyStripes = !this.state.frontHasSafetyStripes;

        // Update visual state
        if (this.state.frontHasSafetyStripes) {
            toggle.classList.add('active');
        } else {
            toggle.classList.remove('active');
        }

        console.log(`[ScreenPrintV2] Safety stripes: ${this.state.frontHasSafetyStripes}`);

        // Trigger pricing update
        this.updateFrontSafetyStripes(this.state.frontHasSafetyStripes);
    }

    /**
     * Toggle dark garment (requires white underbase)
     */
    toggleDarkGarment() {
        const toggle = document.getElementById('sp-dark-garment-toggle');
        const section = document.querySelector('.sp-dark-garment-section-top');
        if (!toggle) return;

        // Toggle state
        this.state.isDarkGarment = !this.state.isDarkGarment;

        // Update visual state - apply 'active' to section (not toggle)
        if (this.state.isDarkGarment) {
            toggle.classList.add('active');
            section?.classList.add('active');
        } else {
            toggle.classList.remove('active');
            section?.classList.remove('active');
        }

        console.log(`[ScreenPrintV2] Dark garment: ${this.state.isDarkGarment}`);

        // Auto-reset frontColors if exceeds new limit (6 → 5 when dark garment ON)
        // Dark garments use white underbase screen, limiting design colors to 5
        const maxColors = this.state.isDarkGarment ? 5 : 6;
        if (this.state.frontColors > maxColors) {
            this.state.frontColors = maxColors;
            console.log(`[ScreenPrintV2] Auto-reset frontColors to ${maxColors} (dark garment limit)`);
        }

        // Update color button states (will disable/enable 6-color based on dark garment)
        this.updateColorToggles();

        // Trigger pricing update
        this.updateDarkGarment(this.state.isDarkGarment);
    }

    /**
     * Toggle additional locations section (expand/collapse)
     */
    toggleAdditionalLocationsSection() {
        const section = document.getElementById('sp-additional-locations-section');
        if (!section) return;

        section.classList.toggle('collapsed');

        console.log(`[ScreenPrintV2] Additional locations section ${section.classList.contains('collapsed') ? 'collapsed' : 'expanded'}`);
    }

    /**
     * Toggle price breakdown visibility (collapse/expand setup and LTM fees)
     */
    togglePriceBreakdown() {
        const setupSection = document.getElementById('sp-pricing-setup');
        const ltmSection = document.getElementById('sp-pricing-ltm');
        const detailsBreakdown = document.getElementById('sp-pricing-details-breakdown');
        const toggleBtn = document.getElementById('sp-toggle-breakdown-btn');
        const toggleText = document.getElementById('sp-toggle-breakdown-text');
        const toggleIcon = toggleBtn?.querySelector('.fas');

        if (!toggleBtn) return;

        // Check current visibility state (use details breakdown if it exists, otherwise setup)
        const checkElement = detailsBreakdown || setupSection;
        const isHidden = !checkElement || checkElement.style.display === 'none';

        // Get pricing to determine what should be shown
        const pricing = this.calculatePricing();

        if (isHidden) {
            // Expand - show pricing details breakdown
            if (detailsBreakdown) {
                detailsBreakdown.style.display = 'block';
            }
            // Also show setup/ltm sections if they have values
            if (setupSection && pricing.setupFee > 0) {
                setupSection.style.display = 'block';
            }
            if (ltmSection && pricing.ltmFee > 0) {
                ltmSection.style.display = 'block';
            }
            toggleText.textContent = 'Hide Details';
            toggleIcon?.classList.remove('fa-chevron-down');
            toggleIcon?.classList.add('fa-chevron-up');
        } else {
            // Collapse - hide all detail sections
            if (detailsBreakdown) {
                detailsBreakdown.style.display = 'none';
            }
            if (setupSection) {
                setupSection.style.display = 'none';
            }
            if (ltmSection) {
                ltmSection.style.display = 'none';
            }
            toggleText.textContent = 'Show Details';
            toggleIcon?.classList.remove('fa-chevron-up');
            toggleIcon?.classList.add('fa-chevron-down');
        }

        console.log(`[ScreenPrintV2] Price breakdown ${isHidden ? 'expanded' : 'collapsed'}`);
    }

    // ==================== UI UPDATE METHODS (Phase 3) ====================

    /**
     * Update visual state of color toggles
     */
    updateColorToggles() {
        // Calculate max allowed colors based on dark garment setting
        // Dark garments require white underbase (uses 1 screen), so only 5 design colors available
        const maxColors = this.state.isDarkGarment ? 5 : 6;

        for (let i = 1; i <= 6; i++) {
            const toggle = document.getElementById(`sp-toggle-${i}color`);
            if (!toggle) continue;

            // Check if this color count exceeds max allowed
            if (i > maxColors) {
                toggle.disabled = true;
                toggle.classList.add('disabled');
                toggle.setAttribute('title', 'Available only on light garments');
            } else {
                toggle.disabled = false;
                toggle.classList.remove('disabled');
                toggle.removeAttribute('title');
            }

            // Update active state
            if (i === this.state.frontColors) {
                toggle.classList.add('active');
            } else {
                toggle.classList.remove('active');
            }
        }
    }

    /**
     * Determine which tier a quantity falls into
     * @param {number} quantity - The quantity to check
     * @returns {string|null} Tier identifier (e.g., '24-36', '37-72') or null
     */
    isQuantityInTier(quantity) {
        const tiers = [
            { id: '24-36', min: 24, max: 36 },
            { id: '37-72', min: 37, max: 72 },
            { id: '73-144', min: 73, max: 144 },
            { id: '145-576', min: 145, max: 576 }
        ];

        const tier = tiers.find(t => quantity >= t.min && quantity <= t.max);
        return tier ? tier.id : null;
    }

    /**
     * Update visual state of tier buttons
     */
    updateTierButtons() {
        const currentTier = this.isQuantityInTier(this.state.quantity);
        const tierButtons = document.querySelectorAll('.sp-tier-button');

        tierButtons.forEach(btn => {
            const btnTier = btn.dataset.tier;
            if (btnTier === currentTier) {
                btn.classList.add('selected');
            } else {
                btn.classList.remove('selected');
            }
        });
    }

    /**
     * Update upcharge tooltip content
     */
    updateUpchargeTooltipContent() {
        const tooltip = document.getElementById('sp-upcharge-tooltip');
        if (!tooltip) return;

        // Get pricing data from screenPrintPricingData
        const screenPrintData = window.screenPrintPricingData;
        const pricingData = screenPrintData?.sellingPriceDisplayAddOns;
        const availableSizes = screenPrintData?.sizes?.map(s => s.size) || [];

        if (!pricingData || availableSizes.length === 0) {
            tooltip.innerHTML = `
                <div class="sp-upcharge-tooltip-header">Size Upcharges</div>
                <div class="sp-upcharge-tooltip-body">
                    <p>No size upcharge data available</p>
                </div>
            `;
            return;
        }

        // Filter upcharges to only show available sizes
        const filteredUpcharges = {};
        Object.entries(pricingData).forEach(([size, amount]) => {
            if (availableSizes.includes(size) && amount > 0) {
                filteredUpcharges[size] = amount;
            }
        });

        // Group by upcharge amount
        const groupedUpcharges = {};
        Object.entries(filteredUpcharges).forEach(([size, amount]) => {
            const key = amount.toFixed(2);
            if (!groupedUpcharges[key]) {
                groupedUpcharges[key] = [];
            }
            groupedUpcharges[key].push(size);
        });

        // Build tooltip HTML
        let html = '<div class="sp-upcharge-tooltip-header">Size Upcharges</div>';
        html += '<div class="sp-upcharge-tooltip-body">';

        const sortedAmounts = Object.keys(groupedUpcharges).sort((a, b) => parseFloat(a) - parseFloat(b));

        sortedAmounts.forEach(amount => {
            const sizes = groupedUpcharges[amount].join(', ');
            html += `
                <div class="sp-upcharge-tooltip-row">
                    <span class="sp-upcharge-tooltip-sizes">${sizes}:</span>
                    <span class="sp-upcharge-tooltip-amount">+$${amount}</span>
                </div>
            `;
        });

        html += '</div>';
        tooltip.innerHTML = html;
    }

    // REMOVED: populateTogglePrices() function
    // This was displaying misleading "preview prices" on color toggle buttons
    // that didn't account for additional locations, safety stripes, dark garments, etc.
    // The prominent "STEP 3: YOUR PRICE" display is now the single source of truth.

    /**
     * Update additional locations UI with current state
     */
    updateAdditionalLocationsUI() {
        const container = document.getElementById('sp-additional-locations-container');
        if (!container) return;

        // Clear existing location slots (but button is now outside container, so it's safe)
        container.innerHTML = '';

        // Render each additional location
        this.state.additionalLocations.forEach((location, index) => {
            const slot = document.createElement('div');
            slot.className = 'sp-location-slot';
            slot.dataset.index = index;

            slot.innerHTML = `
                <!-- Location Selector -->
                <div class="sp-location-slot-input-group">
                    <label class="sp-location-slot-label">Location</label>
                    <select class="sp-location-slot-select" data-index="${index}">
                        ${this.getAvailableLocationOptions(index).map(opt =>
                            `<option value="${opt.value}" ${opt.value === location.location ? 'selected' : ''}>${opt.label}</option>`
                        ).join('')}
                    </select>
                </div>

                <!-- Color Count Selector -->
                <div class="sp-location-slot-input-group">
                    <label class="sp-location-slot-label">Colors</label>
                    <select class="sp-location-slot-select" data-index="${index}">
                        ${this.config.colorOptions.slice(1).map(opt =>
                            `<option value="${opt.value}" ${opt.value === location.colors ? 'selected' : ''}>${opt.label}</option>`
                        ).join('')}
                    </select>
                </div>

                <!-- Safety Stripes Checkbox -->
                <div class="sp-location-slot-input-group">
                    <label class="sp-safety-checkbox">
                        <input type="checkbox" class="sp-location-safety" data-index="${index}" ${location.hasSafetyStripes ? 'checked' : ''}>
                        <span class="sp-safety-label">🦺 Safety (+$${this.state.safetyStripeSurcharge.toFixed(2)})</span>
                    </label>
                </div>

                <!-- Remove Button -->
                <button type="button" class="sp-location-slot-remove" data-index="${index}">
                    <i class="fas fa-times"></i>
                </button>
            `;

            container.appendChild(slot);
        });

        // Safeguard: Re-create Add Location button if it doesn't exist
        // (in case it somehow got deleted during initialization)
        if (!document.getElementById('sp-add-location')) {
            console.log('[ScreenPrintV2] Recreating Add Location button');
            const button = document.createElement('button');
            button.type = 'button';
            button.id = 'sp-add-location';
            button.className = 'sp-add-location-button';
            button.innerHTML = '<i class="fas fa-plus"></i> Add Location';
            button.addEventListener('click', () => this.addLocation());

            // Insert button after container
            container.parentElement.insertBefore(button, container.nextSibling);
        }

        // Update button visibility
        this.updateLocationButtonVisibility();
    }

    /**
     * Update enhanced live price display with setup fees and total
     */
    updateLivePricing() {
        const priceElement = document.getElementById('sp-live-price-amount');
        if (!priceElement) return;

        // Get comprehensive pricing data
        const pricing = this.calculatePricing();

        // Update pricing tier display
        const tierDisplay = document.getElementById('sp-pricing-tier-display');
        const tierLabel = document.getElementById('sp-pricing-tier-label');

        if (this.state.selectedTier && tierDisplay && tierLabel) {
            // selectedTier is a STRING like "24-36", "37-72", "73-144", "145-576"
            // Parse to get min and max values
            const [min, max] = this.state.selectedTier.split('-').map(Number);

            // Format tier label (e.g., "24-36 pieces" or "145+ pieces")
            const tierText = max >= 576
                ? `${min}+ pieces`
                : `${min}-${max} pieces`;

            tierLabel.textContent = tierText;
            tierDisplay.style.display = 'flex';
        } else if (tierDisplay) {
            tierDisplay.style.display = 'none';
        }

        // Update per-shirt price
        if (this.state.pricingData) {
            priceElement.textContent = `$${pricing.perShirtTotal.toFixed(2)}`;
        } else {
            priceElement.textContent = '$0.00';
        }

        // REMOVED: Quantity calculation row (fake "X pieces × price = subtotal")
        // Users select a tier RANGE, not a specific quantity
        // We cannot show accurate calculations without knowing exact quantity they want

        // Update setup fees section
        const setupSection = document.getElementById('sp-pricing-setup');
        const setupBreakdown = document.getElementById('sp-setup-breakdown-live');
        const setupTotal = document.getElementById('sp-setup-total-amount');

        if (pricing.setupFee > 0) {
            setupSection.style.display = 'block';

            // Build setup breakdown HTML
            let breakdownHTML = '';
            if (pricing.colorBreakdown.front > 0 && this.state.frontColors > 0) {
                const frontSetup = pricing.colorBreakdown.front * this.config.setupFeePerColor;
                const underbaseNote = (this.state.isDarkGarment && this.state.frontColors > 0)
                    ? ` <span style="color: #6c757d; font-size: 12px;">(${this.state.frontColors} design + 1 underbase)</span>`
                    : '';
                breakdownHTML += `
                    <div class="sp-setup-item">
                        <span class="sp-setup-location">Front (${pricing.colorBreakdown.front} color${pricing.colorBreakdown.front > 1 ? 's' : ''})${underbaseNote}</span>
                        <span class="sp-setup-cost">$${frontSetup.toFixed(2)}</span>
                    </div>
                `;
            }

            pricing.colorBreakdown.locations.forEach(loc => {
                if (loc.colors > 0) {
                    const label = this.config.locationOptions.find(opt => opt.value === loc.location)?.label || loc.location;
                    const underbaseNote = (this.state.isDarkGarment && loc.colors > 0)
                        ? ` <span style="color: #6c757d; font-size: 12px;">(${loc.colors} design + 1 underbase)</span>`
                        : '';
                    breakdownHTML += `
                        <div class="sp-setup-item">
                            <span class="sp-setup-location">${label} (${loc.totalColors} color${loc.totalColors > 1 ? 's' : ''})${underbaseNote}</span>
                            <span class="sp-setup-cost">$${loc.setupCost.toFixed(2)}</span>
                        </div>
                    `;
                }
            });

            setupBreakdown.innerHTML = breakdownHTML;
            setupTotal.textContent = `$${pricing.setupFee.toFixed(2)}`;
        } else {
            setupSection.style.display = 'none';
        }

        // Update LTM fee section
        const ltmSection = document.getElementById('sp-pricing-ltm');
        const ltmAmount = document.getElementById('sp-ltm-fee-amount');

        if (pricing.ltmFee > 0) {
            ltmSection.style.display = 'block';
            ltmAmount.textContent = `$${pricing.ltmFee.toFixed(2)}`;
        } else {
            ltmSection.style.display = 'none';
        }

        // REMOVED: Order total and average cost displays
        // Users select a tier range (e.g., 145-576), not a specific quantity
        // We cannot calculate an accurate total without knowing exact quantity
        // Keep only: price per shirt + setup fees (users calculate their own total)

        // Show/hide breakdown toggle button
        const breakdownToggle = document.getElementById('sp-breakdown-toggle');
        if (pricing.setupFee > 0 || pricing.ltmFee > 0) {
            breakdownToggle.style.display = 'block';
        } else {
            breakdownToggle.style.display = 'none';
        }

        // REMOVED: Header quantity display (user hasn't specified exact quantity)

        // Keep header price display (this is real - price per shirt for selected tier)
        const headerPrice = document.getElementById('header-unit-price');
        if (headerPrice && this.state.pricingData) {
            headerPrice.textContent = `$${pricing.perShirtTotal.toFixed(2)}`;
        }
    }

    /**
     * Calculate current price based on state
     * Uses the existing calculatePricing() method which already has all the logic
     */
    calculateCurrentPrice() {
        if (!this.state.pricingData) return 0;

        try {
            // Use the existing calculatePricing method (line 910)
            // which already does all the calculations correctly
            const pricing = this.calculatePricing();
            return pricing.perShirtTotal;
        } catch (error) {
            console.error('[ScreenPrintV2] Error calculating price:', error);
            return 0;
        }
    }

    updateQuantity(quantity) { // Renamed from previous to avoid confusion, now only updates state
        this.state.quantity = quantity;

        // Toggle prices removed - only "STEP 3: YOUR PRICE" display shows pricing

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
        // Simply store the color name without affecting dark garment state
        // Dark garment toggle always defaults to ON (user can manually change it)
        this.state.garmentColor = color;
        this.updateDisplay();
    }
    
    updateFrontSafetyStripes(enabled) {
        this.state.frontHasSafetyStripes = enabled;

        if (enabled) {
            // Safety stripes is a 4-color design (white base, white stripe, colored stripe, logo)
            this.elements.frontColorsSelect.value = '4';
            this.state.frontColors = 4;
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

    /**
     * Get available location options (excludes front variants and already-selected locations)
     * Front location selected in Step 1 - so Left Chest and Right Chest are excluded
     * Also excludes locations already selected in OTHER additional location slots
     * @param {number} currentIndex - Index of the current slot being edited
     */
    getAvailableLocationOptions(currentIndex) {
        // Front location already selected in Step 1 - exclude front variants
        const excludedLocations = ['left-chest', 'right-chest'];

        // ALSO exclude locations already selected in OTHER slots
        this.state.additionalLocations.forEach((loc, index) => {
            // Only exclude if it's a DIFFERENT slot and has a location selected
            if (index !== currentIndex && loc.location) {
                excludedLocations.push(loc.location);
            }
        });

        return this.config.locationOptions.filter(opt =>
            !excludedLocations.includes(opt.value)
        );
    }

    addLocation() {
        if (this.state.additionalLocations.length >= this.config.maxAdditionalLocations) {
            this.showError(`Maximum ${this.config.maxAdditionalLocations} additional locations`);
            return;
        }

        // Add to state
        this.state.additionalLocations.push({
            location: 'back',
            colors: 1,
            hasSafetyStripes: false
        });

        console.log(`[ScreenPrintV2] Added location. Total locations: ${this.state.additionalLocations.length}`);

        // Update the UI to reflect new state
        this.updateAdditionalLocationsUI();
        this.updateLocationButtonVisibility();
        this.updateDisplay();
    }

    removeLocation(index) {
        // Remove from state
        this.state.additionalLocations.splice(index, 1);

        console.log(`[ScreenPrintV2] Removed location ${index}. Remaining locations: ${this.state.additionalLocations.length}`);

        // Update UI to reflect new state
        this.updateAdditionalLocationsUI();
        this.updateLocationButtonVisibility();
        this.updateDisplay();
    }

    updateLocations() {
        // Handle changes to additional location inputs
        const locationSlots = document.querySelectorAll('.sp-location-slot');

        locationSlots.forEach((slot, index) => {
            const locationSelect = slot.querySelector('.sp-location-slot-select[data-index]');
            const colorSelect = slot.querySelectorAll('.sp-location-slot-select')[1]; // Second select is colors
            const safetyCheckbox = slot.querySelector('.sp-location-safety');

            if (this.state.additionalLocations[index]) {
                this.state.additionalLocations[index] = {
                    location: locationSelect?.value || 'back',
                    colors: parseInt(colorSelect?.value) || 1,
                    hasSafetyStripes: safetyCheckbox?.checked || false
                };
            }
        });

        console.log('[ScreenPrintV2] Updated locations from UI:', this.state.additionalLocations);
        this.updateDisplay();
    }

    reindexLocations() {
        // No longer needed with new state-driven UI
        // The updateAdditionalLocationsUI() method rebuilds from state
        console.log('[ScreenPrintV2] Reindexing not needed - UI is state-driven');
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

        // MANUAL MODE: Calculate price using manual base cost + API pricing rules
        if (this.config.isManualMode) {
            const manualBaseCost = parseFloat(document.getElementById('manual-base-cost')?.value) || 0;

            // Find the tier for this quantity from API
            const tier = this.findTierForQuantity(quantity, pricingData.tierData);

            if (tier && manualBaseCost > 0) {
                // Apply margin from API
                const garmentWithMargin = manualBaseCost / tier.MarginDenominator;

                // Get print cost from API
                let printCost = 0;
                if (frontColors > 0) {
                    printCost = this.getPrintCostFromAPI(pricingData, tier.TierLabel, effectiveFrontPrintColors, 'PrimaryLocation');
                }

                // Apply flash charge PER COLOR (applies to ALL colors, including 1-color)
                const flashChargePerColor = parseFloat(pricingData.rulesR?.FlashCharge || 0);
                const flashChargeTotal = flashChargePerColor * effectiveFrontPrintColors;

                // Apply margin to primary location print cost (matches pricing-v2.js logic)
                const printCostWithMargin = (printCost + flashChargeTotal) / tier.MarginDenominator;

                // Store separate components for detailed breakdown
                pricing.garmentCost = Math.ceil(garmentWithMargin * 2) / 2;  // Rounded garment cost
                pricing.frontPrintCost = Math.ceil(printCostWithMargin * 2) / 2;  // Rounded print cost

                // Calculate base price
                const subtotal = garmentWithMargin + printCostWithMargin;

                // Round using API rounding rule (HalfDollarCeil_Final)
                pricing.basePrice = Math.ceil(subtotal * 2) / 2;

                console.log('[Manual] Calculated:', {
                    baseCost: manualBaseCost,
                    margin: tier.MarginDenominator,
                    garmentWithMargin: garmentWithMargin.toFixed(2),
                    printCost,
                    flashChargeTotal,
                    printCostWithMargin: printCostWithMargin.toFixed(2),
                    subtotal: subtotal.toFixed(2),
                    garmentCost: pricing.garmentCost,
                    frontPrintCost: pricing.frontPrintCost,
                    finalPrice: pricing.basePrice
                });
            } else {
                pricing.basePrice = 0;
                pricing.garmentCost = 0;
                pricing.frontPrintCost = 0;
            }
        } else {
            // AUTOMATED MODE: Use product API prices
            // Get garment-only price (0 colors) for breakdown
            let garmentOnlyPrice = 0;
            const garmentOnlyPricingData = pricingData.primaryLocationPricing?.["0"];
            if (garmentOnlyPricingData?.tiers) {
                const tier = garmentOnlyPricingData.tiers.find(t => quantity >= t.minQty && (!t.maxQty || quantity <= t.maxQty));
                if (tier?.prices) {
                    const sizes = Object.keys(tier.prices);
                    if (sizes.length > 0) {
                        garmentOnlyPrice = parseFloat(tier.prices[sizes[0]]) || 0;
                    }
                }
            }

            if (frontColors > 0) {
                const frontPricingData = pricingData.primaryLocationPricing?.[effectiveFrontPrintColors.toString()];
                if (frontPricingData?.tiers) {
                    const tier = frontPricingData.tiers.find(t => quantity >= t.minQty && (!t.maxQty || quantity <= t.maxQty));
                    if (tier?.prices) {
                        const sizes = Object.keys(tier.prices);
                        if (sizes.length > 0) {
                            pricing.basePrice = parseFloat(tier.prices[sizes[0]]) || 0;
                            // Calculate breakdown: total - garment = print cost
                            pricing.garmentCost = garmentOnlyPrice;
                            pricing.frontPrintCost = pricing.basePrice - garmentOnlyPrice;
                        }
                    }
                }
            } else {
                // No print, just garment
                pricing.basePrice = garmentOnlyPrice;
                pricing.garmentCost = garmentOnlyPrice;
                pricing.frontPrintCost = 0;
            }
        }

        let totalSetupForAdditionalLocations = 0;

        // Process additional locations
        console.log('[Manual] Additional locations check:', {
            additionalLocations: additionalLocations,
            length: additionalLocations?.length,
            isManualMode: this.config.isManualMode
        });

        if (additionalLocations && additionalLocations.length > 0) {
            console.log('[Manual] Processing additional locations:', additionalLocations.length);

            additionalLocations.forEach(loc => {
                let costPerPieceForThisLoc = 0;
                let designColorsThisLoc = loc.colors;
                let effectiveColorsForThisLoc = designColorsThisLoc;

                if (designColorsThisLoc > 0) {
                    if (isDarkGarment) {
                        effectiveColorsForThisLoc += 1;
                    }

                    // MANUAL MODE: Calculate additional location cost using API BasePrintCost
                    if (this.config.isManualMode) {
                        const tier = this.findTierForQuantity(quantity, pricingData.tierData);
                        if (tier) {
                            // Get BasePrintCost for additional location from API
                            const additionalPrintCost = this.getPrintCostFromAPI(
                                pricingData,
                                tier.TierLabel,
                                effectiveColorsForThisLoc,
                                'AdditionalLocation'
                            );

                            // Additional locations already have margin built in (use as-is)
                            costPerPieceForThisLoc = additionalPrintCost;

                            console.log('[Manual] Additional Location:', {
                                location: loc.location,
                                designColors: designColorsThisLoc,
                                effectiveColors: effectiveColorsForThisLoc,
                                printCost: additionalPrintCost,
                                tierLabel: tier.TierLabel
                            });
                        }
                    } else {
                        // AUTOMATED MODE: Use pre-calculated prices
                        if (pricingData.additionalLocationPricing) {
                            const additionalPricingMaster = pricingData.additionalLocationPricing;

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

        // LTM Fee: Check if current tier has an LTM_Fee (API-driven, not threshold-based)
        if (quantity > 0 && pricingData.tierData) {
            // Find the current tier for this quantity
            const currentTier = this.findTierForQuantity(quantity, pricingData.tierData);

            if (currentTier && currentTier.LTM_Fee > 0) {
                pricing.ltmFee = parseFloat(currentTier.LTM_Fee);
                console.log(`[ScreenPrintV2] LTM Fee applied for tier ${currentTier.TierLabel}: $${pricing.ltmFee}`);
            }
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

        // Calculate final prices (works for both manual and automated modes)
        // Prices already include garment, print, and margin
        pricing.totalPerShirtPrintOnlyCost = pricing.basePrice + pricing.additionalCost + safetyStripesSurcharge;
        pricing.perShirtTotal = pricing.totalPerShirtPrintOnlyCost;

        // Setup and LTM are separate one-time fees
        pricing.subtotal = pricing.totalPerShirtPrintOnlyCost * quantity;
        pricing.grandTotal = pricing.subtotal + pricing.setupFee + pricing.ltmFee;
        pricing.setupPerShirt = quantity > 0 ? pricing.setupFee / quantity : 0;
        pricing.ltmImpactPerShirt = (pricing.ltmFee > 0 && quantity > 0) ? pricing.ltmFee / quantity : 0;

        return pricing;
    }

    updateDarkGarmentToggleUI() {
        const toggle = document.getElementById('sp-dark-garment-toggle');
        const section = document.querySelector('.sp-dark-garment-section-top');

        if (!toggle) return;

        if (this.state.isDarkGarment) {
            toggle.classList.add('active');
            section?.classList.add('active');
        } else {
            toggle.classList.remove('active');
            section?.classList.remove('active');
        }
    }

    updateDisplay() {
        const pricing = this.calculatePricing();

        // Update NEW toggle UI elements (Phase 3)
        this.updateColorToggles();
        this.updateTierButtons();
        this.updateAdditionalLocationsUI();
        this.updateLivePricing();

        // Update LEGACY display elements (for compatibility during transition)
        if (this.elements.basePrice) {
            this.elements.basePrice.textContent = pricing.perShirtTotal.toFixed(2);
        }

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

        // Debug: Log pricing breakdown
        console.log('[Manual] Pricing breakdown:', {
            additionalCost: pricing.additionalCost,
            locations: pricing.colorBreakdown.locations,
            locationsCount: pricing.colorBreakdown.locations.length
        });

        if (this.elements.ltmWarning && this.elements.ltmFee) {
            // Show LTM warning when fee exists (tier-based, no threshold check)
            this.elements.ltmWarning.style.display = pricing.ltmFee > 0 ? 'block' : 'none';
            this.elements.ltmFee.textContent = `$${pricing.ltmFee.toFixed(2)}`;
        }
        this.updateOrderSummary(pricing);
        this.updatePricingDetailsBreakdown(pricing);

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
    }

    /**
     * Order Summary - DISABLED
     * Users select tier ranges (e.g., 73-144 pieces), not specific quantities
     * Cannot show accurate totals without knowing exact quantity
     * Section kept permanently hidden - users calculate their own totals
     */
    updateOrderSummary(pricing) {
        // REMOVED: Order Summary displays fake quantities and totals
        // Keep permanently hidden - user selects tier range, not specific quantity
        if (this.elements.orderSummary) {
            this.elements.orderSummary.style.display = 'none';
        }
        return;
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

    /**
     * Update detailed pricing breakdown (shows under "Show Details")
     */
    updatePricingDetailsBreakdown(pricing) {
        // Find or create breakdown container
        let breakdownContainer = document.getElementById('sp-pricing-details-breakdown');
        let wasVisible = false; // Track if breakdown was open

        if (!breakdownContainer) {
            // Create the container if it doesn't exist
            const priceDisplay = document.querySelector('.sp-live-price-display');
            if (priceDisplay) {
                breakdownContainer = document.createElement('div');
                breakdownContainer.id = 'sp-pricing-details-breakdown';
                breakdownContainer.className = 'sp-pricing-details-breakdown';
                breakdownContainer.style.display = 'none'; // Hidden by default
                priceDisplay.appendChild(breakdownContainer);
            } else {
                return; // Can't find where to put it
            }
        } else {
            // Store current visibility state
            wasVisible = breakdownContainer.style.display !== 'none';
        }

        let html = '<div class="sp-breakdown-content">';

        // Front location breakdown
        if (this.state.frontColors > 0 && pricing.basePrice > 0) {
            const frontPrintCost = this.state.frontHasSafetyStripes ? pricing.basePrice : pricing.basePrice;

            html += '<div class="sp-breakdown-section">';
            html += '<div class="sp-breakdown-header">Front Location</div>';

            if (pricing.garmentCost && pricing.frontPrintCost) {
                html += `<div class="sp-breakdown-item">`;
                html += `<span>Shirt:</span><span>$${pricing.garmentCost.toFixed(2)}</span>`;
                html += `</div>`;

                // Determine print label - show design colors + underbase if dark garment
                let printLabel;
                if (this.state.isDarkGarment && this.state.frontColors > 0) {
                    printLabel = `Print (${this.state.frontColors} design + 1 underbase)`;
                } else {
                    printLabel = `Print (${pricing.colorBreakdown.front} color${pricing.colorBreakdown.front !== 1 ? 's' : ''})`;
                }

                html += `<div class="sp-breakdown-item">`;
                html += `<span>${printLabel}:</span><span>$${pricing.frontPrintCost.toFixed(2)}</span>`;
                html += `</div>`;
            }

            if (this.state.frontHasSafetyStripes) {
                html += `<div class="sp-breakdown-item sp-breakdown-addon">`;
                html += `<span>Safety Stripes:</span><span class="sp-breakdown-addon-price">+$${this.state.safetyStripeSurcharge.toFixed(2)}</span>`;
                html += `</div>`;
            }

            const frontTotal = this.state.frontHasSafetyStripes ?
                pricing.basePrice + this.state.safetyStripeSurcharge :
                pricing.basePrice;

            html += `<div class="sp-breakdown-item sp-breakdown-subtotal">`;
            html += `<span>Front Total:</span><span>$${frontTotal.toFixed(2)}</span>`;
            html += `</div>`;
            html += '</div>'; // Close section
        }

        // Additional locations breakdown
        if (pricing.colorBreakdown.locations && pricing.colorBreakdown.locations.length > 0) {
            pricing.colorBreakdown.locations.forEach(loc => {
                if (loc.colors > 0) {
                    const locLabel = this.config.locationOptions.find(opt => opt.value === loc.location)?.label || loc.location;

                    html += '<div class="sp-breakdown-section">';
                    html += `<div class="sp-breakdown-header">${locLabel}</div>`;

                    // Determine print label for additional location
                    let locPrintLabel;
                    if (this.state.isDarkGarment && loc.colors > 0) {
                        locPrintLabel = `Print (${loc.colors} design + 1 underbase)`;
                    } else {
                        locPrintLabel = `Print (${loc.totalColors} color${loc.totalColors !== 1 ? 's' : ''})`;
                    }

                    html += `<div class="sp-breakdown-item">`;
                    html += `<span>${locPrintLabel}:</span><span>$${loc.costPerPiece.toFixed(2)}</span>`;
                    html += `</div>`;

                    if (loc.hasSafetyStripes) {
                        html += `<div class="sp-breakdown-item sp-breakdown-addon">`;
                        html += `<span>Safety Stripes:</span><span class="sp-breakdown-addon-price">+$${this.state.safetyStripeSurcharge.toFixed(2)}</span>`;
                        html += `</div>`;
                    }

                    const locTotal = loc.hasSafetyStripes ?
                        loc.costPerPiece + this.state.safetyStripeSurcharge :
                        loc.costPerPiece;

                    html += `<div class="sp-breakdown-item sp-breakdown-subtotal">`;
                    html += `<span>${locLabel} Total:</span><span>$${locTotal.toFixed(2)}</span>`;
                    html += `</div>`;
                    html += '</div>'; // Close section
                }
            });
        }

        // Grand total per shirt
        html += '<div class="sp-breakdown-grand-total">';
        html += `<span>Price per Shirt:</span><span>$${pricing.perShirtTotal.toFixed(2)}</span>`;
        html += '</div>';

        html += '</div>'; // Close content

        breakdownContainer.innerHTML = html;

        // Restore visibility state if it was open
        if (wasVisible) {
            breakdownContainer.style.display = 'block';
        }
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

            if (this.state.isDarkGarment && this.state.frontColors > 0) {
                const totalColors = this.state.frontColors + 1;
                noteText = `Prices include garment + ${this.state.frontColors} design color${this.state.frontColors > 1 ? 's' : ''} + 1 white underbase (${totalColors} total colors) front print.`;
            } else {
                noteText = `Prices shown are per shirt for garment + ${colorText} front print.`;
            }
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

            // Show breakdown: Shirt + Print with individual costs
            if (pricing.garmentCost && pricing.frontPrintCost) {
                subtitleParts.push(
                    `Shirt + ${pricing.colorBreakdown.front} Color Front: $${displayPrice.toFixed(2)} ` +
                    `<span style="color: #666; font-size: 0.9em;">(Shirt: $${pricing.garmentCost.toFixed(2)} + Print: $${pricing.frontPrintCost.toFixed(2)})</span>`
                );
            } else {
                // Fallback if breakdown not available
                subtitleParts.push(`${pricing.colorBreakdown.front} Color Front $${displayPrice.toFixed(2)}`);
            }
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
        // Log the pricing data
        console.log('[ScreenPrintV2] Received pricing data from API:', data);

        this.state.masterBundle = data;
        this.state.pricingData = data;

        // Store pricing data globally for size upcharges display
        window.screenPrintPricingData = data;

        // Dispatch event for size upcharges display
        window.dispatchEvent(new CustomEvent('screenPrintPricingLoaded', {
            detail: data
        }));

        // Diagnostic: Check if 6-color pricing exists
        console.log('[ScreenPrintV2] Available color counts from bundle:', data.availableColorCounts);
        console.log('[ScreenPrintV2] Has 6-color pricing in finalPrices?',
            !!(data.finalPrices?.PrimaryLocation?.["37-72"]?.["6"]));
        console.log('[ScreenPrintV2] Has 6-color pricing in primaryLocationPricing?',
            !!(data.primaryLocationPricing?.["6"]));

        if (data.styleNumber) this.state.styleNumber = data.styleNumber;
        if (data.productTitle) this.state.productTitle = data.productTitle;

        // Toggle prices removed - only "STEP 3: YOUR PRICE" display shows pricing

        this.updateDisplay();

        if (this.tiersLoaded && document.getElementById('pricing-tiers')?.style.display !== 'none') {
            this.updatePricingTiers();
        }
        if (this.locationGuideLoaded && document.getElementById('location-pricing')?.style.display !== 'none') {
            this.updateAdditionalLocationPricingGuide();
        }
    }

    /**
     * MANUAL MODE: Transform raw API data to expected calculator structure
     * Raw API returns arrays (tiersR, allScreenprintCostsR)
     * Calculator expects objects (tierData, primaryLocationPricing)
     */
    transformRawAPIData(rawData) {
        console.log('[Manual] Transforming raw API data...');

        // Convert tiersR array to tierData object keyed by TierLabel
        const tierData = {};
        if (rawData.tiersR && Array.isArray(rawData.tiersR)) {
            rawData.tiersR.forEach(tier => {
                tierData[tier.TierLabel] = tier;
            });
        }

        // Determine available color counts from allScreenprintCostsR
        const colorCounts = new Set();
        if (rawData.allScreenprintCostsR && Array.isArray(rawData.allScreenprintCostsR)) {
            rawData.allScreenprintCostsR.forEach(cost => {
                if (cost.CostType === 'PrimaryLocation') {
                    colorCounts.add(cost.ColorCount);
                }
            });
        }
        const availableColorCounts = Array.from(colorCounts).sort((a, b) => a - b);

        // Create primaryLocationPricing structure for color detection
        const primaryLocationPricing = {};
        availableColorCounts.forEach(count => {
            primaryLocationPricing[count] = true;
        });

        console.log('[Manual] Transformation complete:', {
            tierCount: Object.keys(tierData).length,
            availableColors: availableColorCounts,
            maxColors: Math.max(...availableColorCounts)
        });

        // Return transformed data with both raw and processed structures
        return {
            ...rawData,
            tierData: tierData,
            availableColorCounts: availableColorCounts,
            primaryLocationPricing: primaryLocationPricing
        };
    }

    // MANUAL MODE HELPER: Find tier for given quantity
    findTierForQuantity(quantity, tierData) {
        // Handle both array (tiersR) and object (tierData) formats
        const tiers = Array.isArray(tierData) ? tierData : Object.values(tierData);

        for (const tier of tiers) {
            if (quantity >= tier.MinQuantity && quantity <= tier.MaxQuantity) {
                console.log(`[Manual] Found tier for qty ${quantity}:`, tier.TierLabel);
                return tier;
            }
        }
        console.warn(`[Manual] No tier found for quantity ${quantity}`);
        return null;
    }

    // MANUAL MODE HELPER: Get print cost from API data
    getPrintCostFromAPI(pricingData, tierLabel, colorCount, locationType) {
        // Find print cost from allScreenprintCostsR array
        const printCosts = pricingData.allScreenprintCostsR;
        if (!printCosts) {
            console.warn('[Manual] No print costs available in API data');
            return 0;
        }

        const cost = printCosts.find(c =>
            c.TierLabel === tierLabel &&
            c.ColorCount === colorCount &&
            c.CostType === locationType
        );

        if (cost) {
            console.log(`[Manual] Print cost for ${tierLabel}, ${colorCount} colors, ${locationType}:`, cost.BasePrintCost);
            return parseFloat(cost.BasePrintCost);
        } else {
            console.warn(`[Manual] No print cost found for ${tierLabel}, ${colorCount} colors, ${locationType}`);
            return 0;
        }
    }
}

// Class available globally, but NOT auto-instantiated
// Instantiation is handled in the HTML page for explicit control