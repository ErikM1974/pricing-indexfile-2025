/**
 * Screen Print Pricing V2 - Complete Refactor
 * Single file handling all UI and calculations
 * Clear, maintainable, no legacy code
 *
 * ⚠️ CRITICAL: PRICING SYNCHRONIZATION REQUIRED
 *
 * This file is the SOURCE OF TRUTH for Screen Print pricing calculations.
 *
 * If you modify pricing logic here, you MUST update:
 * - the retired manual screen-print calculator script (archive-only, pending deletion)
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
 * ⚠️ INTENTIONAL DESIGN DIFFERENCE: SIZE UPCHARGE HANDLING
 *
 * This Pricing Calculator uses SIMPLIFIED pricing model:
 * - Uses BASE size price (smallest size, typically S/M) for ALL pieces
 * - Does NOT account for 2XL/3XL/4XL upcharges
 * - Purpose: Quick estimates for customers (standard sizing assumed)
 *
 * The Quote Builder (/quote-builders/screenprint-quote-builder.html) uses ACCURATE model:
 * - Calculates each size individually with proper upcharges
 * - Purpose: Precise quotes for sales team with actual size breakdown
 *
 * Expected Difference: ~$0.10-0.15 per piece when upcharge sizes are present
 * Example: 37 pieces with 2 pieces of 2XL = ~$4.00 difference in subtotal
 *
 * This is INTENTIONAL and ACCEPTABLE design:
 * - Pricing Calculator = Simple tool for ballpark estimates
 * - Quote Builder = Accurate tool for final quotes
 *
 * DO NOT "fix" this difference - it's by design for different use cases.
 *
 * Last synchronized: 2025-10-04
 */

/* Logging gate (2026-09-06): screenprint-pricing-v2 chatter only on localhost or ?debug=1; console.error/warn stay live. */
var SPV2_LOG_ON = (typeof window !== 'undefined' && !!window.location && (window.location.hostname === 'localhost' || new URLSearchParams(window.location.search).has('debug')));
var spv2Log = SPV2_LOG_ON ? console.log.bind(console) : function () {};
class ScreenPrintPricing {
    constructor() {
        // Configuration
        this.config = {
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
            quantity: 37, // pricing quantity until a tier is picked; the strip itself comes from the API tiers
            frontColors: 1,
            frontHasSafetyStripes: false,
            additionalLocations: [], // [{location: 'back', colors: 2, hasSafetyStripes: false}, ...]
            isDarkGarment: true,  // Default to dark garment (most common use case)
            garmentColor: '',
            styleNumber: '',
            productTitle: '',
            pricingData: null,
            masterBundle: null,
            safetyStripeSurcharge: 2.00,
            expandedLTMTier: null  // TierLabel of the LTM tier whose exact-quantity input is open
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

    init() {
        // Initialize pricing service
        if (typeof ScreenPrintPricingService !== 'undefined') {
            this.pricingService = new ScreenPrintPricingService();
        } else {
            console.error('[ScreenPrintV2] ScreenPrintPricingService not found!');
        }

        this.cacheElements();
        this.createUI();
        this.bindEvents();
        this.checkUrlParams();

        // Initialize UI with defaults
        this.updateColorToggles();  // Highlight default color (1)
        this.updateTierButtons();   // Highlight default tier (37-72)
        this.updateDarkGarmentToggleUI();  // Set initial dark garment toggle state

        this.updateDisplay();

        // Pricing=API (2026-06-09): load per-screen setup (SPSU) + safety-stripe
        // (SP-STRIPE) fees from Caspio Service_Codes so they match the SCP quote
        // builder and a Caspio change needs no deploy. Fire-and-forget — the
        // defaults stand (and act as the fallback) until it resolves, then re-render.
        this.loadServiceFees().then(() => this.updateDisplay());
    }

    // Fetch the per-screen setup + safety-stripe sell prices from Caspio
    // Service_Codes (inline — this calculator page doesn't load getServicePrice).
    // Leaves the hardcoded defaults in place as a warned fallback on failure.
    async loadServiceFees() {
        try {
            const base = (window.APP_CONFIG && window.APP_CONFIG.API && window.APP_CONFIG.API.BASE_URL) || '';
            if (!base) console.error('[ScreenPrintV2] APP_CONFIG.API.BASE_URL missing — service codes cannot load');
            const resp = await fetch(`${base}/api/service-codes`);
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            const json = await resp.json();
            const map = {};
            (json.data || []).forEach(sc => { if (sc.ServiceCode) map[String(sc.ServiceCode).toUpperCase()] = sc; });
            const spsu = parseFloat(map['SPSU'] && map['SPSU'].SellPrice);
            const stripe = parseFloat(map['SP-STRIPE'] && map['SP-STRIPE'].SellPrice);
            if (Number.isFinite(spsu) && spsu > 0) this.config.setupFeePerColor = spsu;
            if (Number.isFinite(stripe) && stripe > 0) this.state.safetyStripeSurcharge = stripe;
            // Art setup tooltip amount (GRT-50) — the typed "$50.00" is only the pre-API placeholder.
            const grt50 = parseFloat(map['GRT-50'] && map['GRT-50'].SellPrice);
            if (Number.isFinite(grt50) && grt50 > 0) { this.state.artSetupFee = grt50; this.renderArtSetupFee(); }
        } catch (e) {
            console.warn('[ScreenPrintV2] Service_Codes fetch failed — using default setup/stripe fees:', e.message);
        }
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
                            <i class="fas fa-info-circle sp-dark-info-icon" aria-hidden="true" id="sp-dark-info-icon"></i>
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
                                <i class="fas fa-tshirt" aria-hidden="true"></i> Why Dark Garments Add a Setup Screen
                            </div>
                            <div class="sp-dark-tooltip-body">
                                When printing on black or dark-colored shirts, we must print a <strong>white underbase layer first</strong> so your ink colors appear vibrant and true to their intended shade.
                                <br><br>
                                The underbase requires one additional screen, added to the one-time setup fee per printed location. It does not change your per-shirt print price.
                                <br><br>
                                <strong>Example:</strong> Red + Green + Yellow design on a black shirt = 3-color per-shirt pricing + <strong>4 setup screens</strong> (3 design colors + 1 white underbase)
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
                            <i class="fas fa-palette" aria-hidden="true"></i>
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
                            <i class="fas fa-chart-bar" aria-hidden="true"></i>
                            Quantity Tiers
                        </div>

                        <!-- Tier buttons + exact-quantity inputs are rendered from the API tiers (renderTierButtons). -->
                        <div id="sp-tier-list" class="sp-tier-list"></div>
                    </div>
                </div>

                <!-- Additional Locations Section - MOVED BEFORE STEP 3 FOR LOGICAL WORKFLOW -->
                <div class="sp-additional-locations-section" id="sp-additional-locations-section">
                    <div class="sp-additional-locations-header" id="sp-additional-locations-header">
                        <div class="sp-additional-locations-title">
                            <i class="fas fa-chevron-down" aria-hidden="true"></i>
                            Additional Print Locations
                        </div>
                        <div class="sp-additional-locations-subtitle">Add up to 3 additional locations</div>
                    </div>
                    <div class="sp-additional-locations-content" id="sp-additional-locations-container">
                        <!-- Location slots will be inserted here -->
                    </div>
                    <!-- Add Location button (moved outside container to prevent deletion) -->
                    <button type="button" id="sp-add-location" class="sp-add-location-button">
                        <i class="fas fa-plus-circle" aria-hidden="true"></i>
                        Add Location
                    </button>
                </div>

                <!-- Enhanced Live Price Display - NOW CALCULATES WITH ALL INPUTS -->
                <div class="sp-live-price-display sp-live-price-prominent">
                    <div class="sp-live-price-workflow-label">Step 3: Your Price</div>

                    <!-- Pricing Tier Display -->
                    <div class="sp-pricing-tier-display" id="sp-pricing-tier-display" style="display: none;">
                        <i class="fas fa-layer-group" aria-hidden="true"></i>
                        <span>Pricing Tier: <strong id="sp-pricing-tier-label">—</strong></span>
                    </div>

                    <!-- Primary Pricing Info -->
                    <div class="sp-pricing-primary">
                        <div class="sp-price-row sp-price-per-shirt">
                            <span class="sp-price-label">Price per shirt</span>
                            <div class="sp-price-amount-wrapper">
                                <span class="sp-live-price-amount" id="sp-live-price-amount">$0.00</span>
                                <i class="fas fa-info-circle sp-upcharge-info-icon" aria-hidden="true" id="sp-upcharge-info-icon"></i>
                                <i class="fas fa-palette sp-setup-fee-badge" aria-hidden="true" id="sp-setup-fee-badge"></i>

                                <!-- Upcharge Tooltip - positioned relative to icon -->
                                <div id="sp-upcharge-tooltip" class="sp-upcharge-tooltip">
                                    <div class="sp-upcharge-tooltip-content">
                                        <div class="sp-upcharge-tooltip-header">Size Pricing</div>
                                        <div id="sp-upcharge-tooltip-body" class="sp-upcharge-tooltip-body">
                                            <!-- Populated by JavaScript -->
                                        </div>
                                    </div>
                                </div>

                                <!-- Setup Fee Tooltip -->
                                <div id="sp-setup-fee-tooltip" class="sp-setup-fee-tooltip" style="display: none;">
                                    <div class="sp-setup-fee-tooltip-content">
                                        <div class="sp-setup-fee-tooltip-header">
                                            <i class="fas fa-palette" aria-hidden="true"></i>
                                            Art Setup Fee
                                        </div>
                                        <div class="sp-setup-fee-tooltip-body">
                                            <div class="sp-setup-fee-amount">$50.00 (GRT-50)</div>
                                            <p><strong>This one-time fee covers:</strong></p>
                                            <ul class="sp-tooltip-list">
                                                <li>Custom logo mockup on your products</li>
                                                <li>Print readiness check for clarity & sizing</li>
                                                <li>Up to 2 rounds of revisions</li>
                                            </ul>
                                            <div class="sp-setup-fee-details">
                                                <i class="fas fa-check-circle" aria-hidden="true"></i>
                                                One-time charge for new artwork
                                            </div>
                                            <div class="sp-setup-fee-details">
                                                <i class="fas fa-check-circle" aria-hidden="true"></i>
                                                Applies to all new logos or designs
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div class="sp-price-row sp-price-quantity-calc" id="sp-price-quantity-calc" style="display: none;">
                            <span class="sp-price-calc-text">
                                <i class="fas fa-times" aria-hidden="true"></i> <span id="sp-calc-quantity">37</span> pieces
                            </span>
                            <span class="sp-price-calc-result" id="sp-calc-subtotal">$0.00</span>
                        </div>
                    </div>

                    <!-- Setup Fees Section - REMOVED: Now shown only in detailed breakdown -->
                    <!-- LTM Fee Section - REMOVED: Already included in per-shirt price -->

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
                            <i class="fas fa-chevron-down" aria-hidden="true"></i>
                            <span id="sp-toggle-breakdown-text">View Detailed Breakdown</span>
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
    }

    bindEvents() {
        // NEW: Color Toggle Switches (1-6 colors)
        for (let colorCount = 1; colorCount <= 6; colorCount++) {
            const toggle = document.getElementById(`sp-toggle-${colorCount}color`);
            toggle?.addEventListener('click', () => {
                this.selectColorCount(colorCount);
            });
        }

        // Tier buttons + exact-quantity inputs: wired in renderTierButtons() once the API tiers arrive.

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

        // Setup Fee Tooltip - Similar interaction pattern
        const setupFeeBadge = document.getElementById('sp-setup-fee-badge');
        const setupFeeTooltip = document.getElementById('sp-setup-fee-tooltip');

        if (setupFeeBadge && setupFeeTooltip) {
            spv2Log('✅ Initializing setup fee tooltip for Screen Print');

            // Desktop: Show on hover
            setupFeeBadge.addEventListener('mouseenter', () => {
                if (window.innerWidth > 768) {
                    setupFeeTooltip.style.display = 'block';
                }
            });

            setupFeeBadge.addEventListener('mouseleave', () => {
                if (window.innerWidth > 768) {
                    setTimeout(() => {
                        if (!setupFeeTooltip.matches(':hover')) {
                            setupFeeTooltip.style.display = 'none';
                        }
                    }, 100);
                }
            });

            setupFeeTooltip.addEventListener('mouseleave', () => {
                if (window.innerWidth > 768) {
                    setupFeeTooltip.style.display = 'none';
                }
            });

            // Mobile: Toggle on tap
            setupFeeBadge.addEventListener('click', (e) => {
                e.stopPropagation();
                setupFeeTooltip.style.display = setupFeeTooltip.style.display === 'block' ? 'none' : 'block';
            });

            // Close when clicking outside
            document.addEventListener('click', (e) => {
                if (!setupFeeTooltip.contains(e.target) && e.target !== setupFeeBadge) {
                    setupFeeTooltip.style.display = 'none';
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
                    // Show loading state
                    this.showLoading();

                    const data = await this.pricingService.fetchPricingData(styleNumber);

                    if (data) {
                        this.handleMasterBundle(data);
                    } else {
                        this.showError('No pricing data available for this product');
                        console.error('[ScreenPrintV2] API returned null - no pricing data available');
                    }
                } catch (error) {
                    this.showError('Failed to load pricing data. Please refresh the page.');
                    console.error('[ScreenPrintV2] Error loading pricing data:', error);
                } finally {
                    // Hide loading state
                    this.hideLoading();
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


        // Auto-reset frontColors if exceeds new limit (6 → 5 when dark garment ON)
        // Dark garments use white underbase screen, limiting design colors to 5
        const maxColors = this.state.isDarkGarment ? 5 : 6;
        if (this.state.frontColors > maxColors) {
            this.state.frontColors = maxColors;
        }

        // Update color button states (will disable/enable 6-color based on dark garment)
        this.updateColorToggles();

        // Trigger pricing update
        this.updateDarkGarment(this.state.isDarkGarment);
    }

    /**
     * Collapse all LTM tier input fields
     */
    collapseLTMTiers() {
        document.querySelectorAll('[data-tier-container]').forEach((c) => c.classList.remove('show'));
        this.state.expandedLTMTier = null;
    }

    /**
     * Expand the exact-quantity input of an LTM tier (rendered by renderTierButtons)
     */
    expandLTMTier(tier, defaultQty) {
        const container = document.querySelector(`[data-tier-container="${tier}"]`);
        if (!container) return;
        container.classList.add('show');
        const input = document.getElementById(`sp-qty-${tier}`);
        if (input && !input.value) input.value = defaultQty;
        setTimeout(() => { if (input) { input.focus(); input.select(); } }, 100);
        this.state.expandedLTMTier = tier;
    }

    /**
     * Toggle additional locations section (expand/collapse)
     */
    toggleAdditionalLocationsSection() {
        const section = document.getElementById('sp-additional-locations-section');
        if (!section) return;

        section.classList.toggle('collapsed');

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

        const checkElement = detailsBreakdown || setupSection;
        const isHidden = !checkElement || checkElement.style.display === 'none';

        // Get pricing to determine what should be shown
        const pricing = this.calculatePricing();

        if (isHidden) {
            // Expand - show pricing details breakdown
            if (detailsBreakdown) {
                detailsBreakdown.style.display = 'block';
            }
            if (setupSection && pricing.setupFee > 0) {
                setupSection.style.display = 'block';
            }
            if (ltmSection && pricing.ltmFee > 0) {
                ltmSection.style.display = 'block';
            }
            toggleText.textContent = 'Hide Breakdown';
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
            toggleText.textContent = 'View Detailed Breakdown';
            toggleIcon?.classList.remove('fa-chevron-up');
            toggleIcon?.classList.add('fa-chevron-down');
        }

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
     * Update dark garment toggle UI to match state
     * Called on initialization to set correct visual state
     */
    updateDarkGarmentToggleUI() {
        const toggle = document.getElementById('sp-dark-garment-toggle');
        const section = document.querySelector('.sp-dark-garment-section-top');

        if (!toggle) return;

        // Set visual state based on current isDarkGarment state
        if (this.state.isDarkGarment) {
            toggle.classList.add('active');
            section?.classList.add('active');
        } else {
            toggle.classList.remove('active');
            section?.classList.remove('active');
        }
    }

    /**
     * Determine which tier a quantity falls into
     * @param {number} quantity - The quantity to check
     * @returns {string|null} API TierLabel (e.g. '24-47') or null
     */
    isQuantityInTier(quantity) {
        const tier = this.apiTiers().find(t => quantity >= t.MinQuantity && quantity <= t.MaxQuantity);
        return tier ? tier.TierLabel : null;
    }

    /** API tiers (masterBundle.tierData | tiersR | tiers) as a sorted array — the ONLY tier structure this UI knows. */
    apiTiers() {
        const bundle = this.state.masterBundle || {};
        const raw = bundle.tierData || bundle.tiersR || bundle.tiers;
        if (!raw) return [];
        const arr = Array.isArray(raw) ? raw : Object.values(raw);
        return arr.filter(t => t && Number.isFinite(Number(t.MinQuantity)))
            .map(t => ({ ...t, MinQuantity: Number(t.MinQuantity), MaxQuantity: Number(t.MaxQuantity), LTM_Fee: parseFloat(t.LTM_Fee) || 0 }))
            .sort((a, b) => a.MinQuantity - b.MinQuantity);
    }
    isLtmTier(label) { const t = this.apiTiers().find(x => x.TierLabel === label); return !!(t && t.LTM_Fee > 0); }
    fmtFee(fee) { return Number.isInteger(fee) ? String(fee) : fee.toFixed(2); }

    /**
     * Render the tier strip from the API tiers (2026-09-06). Erik's rule: every dollar amount a customer sees
     * comes from Caspio. The strip used to be typed as 24-36 (+$75) / 37-71 (+$50) while Caspio had moved to
     * 24-47 (+$50) / 48-71 ($0) — the price was right and the labels were wrong.
     */
    renderTierButtons() {
        const list = document.getElementById('sp-tier-list');
        const tiers = this.apiTiers();
        if (!list || !tiers.length) return;
        const esc = (v) => String(v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
        list.innerHTML = tiers.map((t) => {
            const label = esc(t.TierLabel);
            const range = t.MaxQuantity >= 576 ? `${t.MinQuantity}+ pieces` : `${t.MinQuantity}-${t.MaxQuantity} pieces`;
            const fee = t.LTM_Fee;
            let html = `<button type="button" class="sp-tier-button universal-tier-button" id="sp-tier-${label}" data-tier="${label}">${range}` +
                (fee > 0 ? `<br><small class="sp-fee-note">+ $${this.fmtFee(fee)} Small Batch Fee</small>` : '') + `</button>`;
            if (fee > 0) {
                html += `<div class="sp-quantity-input-container universal-quantity-input-container" data-tier-container="${label}">
                    <label for="sp-qty-${label}" class="sp-quantity-input-label universal-quantity-input-label">
                        <i class="fas fa-calculator" aria-hidden="true"></i> Enter Exact Quantity (${t.MinQuantity}-${t.MaxQuantity} pieces):
                    </label>
                    <input type="number" id="sp-qty-${label}" class="sp-quantity-input universal-quantity-input"
                           min="${t.MinQuantity}" max="${t.MaxQuantity}" value="${t.MinQuantity}" placeholder="Enter ${t.MinQuantity}-${t.MaxQuantity}">
                    <small class="sp-quantity-hint universal-quantity-hint">
                        <i class="fas fa-info-circle" aria-hidden="true"></i>
                        Required for accurate $${this.fmtFee(fee)} fee distribution:
                        <strong id="sp-ltm-calc-${label}">$${this.fmtFee(fee)} ÷ ${t.MinQuantity} = $${(fee / t.MinQuantity).toFixed(2)}/piece</strong>
                    </small>
                </div>`;
            }
            return html;
        }).join('');

        tiers.forEach((t) => {
            const btn = document.getElementById(`sp-tier-${t.TierLabel}`);
            btn?.addEventListener('click', (e) => {
                if (e.target.tagName === 'INPUT') return;
                this.collapseLTMTiers();
                this.selectQuantityTier(t.TierLabel, t.MinQuantity);
                if (t.LTM_Fee > 0) this.expandLTMTier(t.TierLabel, t.MinQuantity);
            });
            const input = document.getElementById(`sp-qty-${t.TierLabel}`);
            if (!input) return;
            const clampTo = (v) => Math.max(t.MinQuantity, Math.min(t.MaxQuantity, parseInt(v, 10) || t.MinQuantity));
            input.addEventListener('input', (e) => {
                const clamped = clampTo(e.target.value);
                if (String(clamped) !== e.target.value) e.target.value = clamped;
                this.renderLtmCalc(t.TierLabel, clamped, t.LTM_Fee);
                this.state.quantity = clamped;
                this.updateDisplay();
            });
            input.addEventListener('change', (e) => { e.target.value = clampTo(e.target.value); });
        });

        // keep the current selection coherent with the new strip
        const current = this.isQuantityInTier(this.state.quantity) || tiers[0].TierLabel;
        const tier = tiers.find(x => x.TierLabel === current);
        this.state.selectedTier = current;
        this.updateTierButtons();
        if (tier && tier.LTM_Fee > 0) {
            this.expandLTMTier(current, tier.MinQuantity);
            const input = document.getElementById(`sp-qty-${current}`);
            if (input) { input.value = this.state.quantity; this.renderLtmCalc(current, this.state.quantity, tier.LTM_Fee); }
        }
        this.renderArtSetupFee();
    }

    renderLtmCalc(label, qty, fee) {
        const el = document.getElementById(`sp-ltm-calc-${label}`);
        if (!el || !(fee > 0) || !(qty > 0)) return;
        el.textContent = `$${this.fmtFee(fee)} ÷ ${qty} = $${(fee / qty).toFixed(2)}/piece`;
    }

    renderArtSetupFee() {
        const el = document.querySelector('.sp-setup-fee-amount');
        const fee = this.state.artSetupFee;
        if (el && fee > 0) el.textContent = `$${fee.toFixed(2)} (GRT-50)`;
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
                    <i class="fas fa-times" aria-hidden="true"></i>
                </button>
            `;

            container.appendChild(slot);
        });

        // Safeguard: Re-create Add Location button if it doesn't exist
        // (in case it somehow got deleted during initialization)
        if (!document.getElementById('sp-add-location')) {
            const button = document.createElement('button');
            button.type = 'button';
            button.id = 'sp-add-location';
            button.className = 'sp-add-location-button';
            button.innerHTML = '<i class="fas fa-plus-circle" aria-hidden="true"></i> Add Location';
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
            // selectedTier is the API TierLabel, e.g. "24-47", "48-71", "72-144", "145-576"
            // Parse to get min and max values
            const [min, max] = this.state.selectedTier.split('-').map(Number);

            // For LTM tiers with quantity input, show exact quantity
            let tierText;
            if (this.isLtmTier(this.state.selectedTier)) {
                tierText = `${this.state.selectedTier} pieces (${this.state.quantity} selected)`;
            } else {
                tierText = max >= 576
                    ? `${min}+ pieces`
                    : `${min}-${max} pieces`;
            }

            tierLabel.textContent = tierText;
            tierDisplay.style.display = 'flex';
        } else if (tierDisplay) {
            tierDisplay.style.display = 'none';
        }

        // Update per-shirt price (now includes LTM fee)
        if (this.state.pricingData) {
            priceElement.textContent = `$${pricing.perShirtTotal.toFixed(2)}`;

            // Add simple "all fees included" note instead of showing math
            const priceRow = priceElement.closest('.sp-price-per-shirt');
            let existingSubtitle = priceRow?.querySelector('.sp-ltm-included-note');

            if (pricing.ltmImpactPerShirt > 0 || pricing.setupFee > 0) {
                const subtitleText = '(all fees included)';

                if (existingSubtitle) {
                    existingSubtitle.textContent = subtitleText;
                } else if (priceRow) {
                    const subtitle = document.createElement('div');
                    subtitle.className = 'sp-ltm-included-note';
                    subtitle.textContent = subtitleText;
                    priceRow.appendChild(subtitle);
                }
            } else if (existingSubtitle) {
                existingSubtitle.remove();
            }
        } else {
            priceElement.textContent = '$0.00';
        }

        // REMOVED: Quantity calculation row
        // REMOVED: Setup fees section (now only in detailed breakdown)
        // REMOVED: LTM fee section (already included in per-shirt price)
        // REMOVED: Order total displays (users calculate from tier ranges)

        // All detailed pricing is now shown only in the expandable breakdown section

        // Show/hide breakdown toggle button
        const breakdownToggle = document.getElementById('sp-breakdown-toggle');
        // Show breakdown if there's setup fee OR LTM fee to explain
        if (pricing.setupFee > 0 || pricing.ltmImpactPerShirt > 0) {
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


        // Update the UI to reflect new state
        this.updateAdditionalLocationsUI();
        this.updateLocationButtonVisibility();
        this.updateDisplay();
    }

    removeLocation(index) {
        // Remove from state
        this.state.additionalLocations.splice(index, 1);


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

        this.updateDisplay();
    }

    reindexLocations() {
        // No longer needed with new state-driven UI
        // The updateAdditionalLocationsUI() method rebuilds from state
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

        if (!pricingData || quantity === 0) {
            return pricing;
        }

        // Dark-garment white underbase is a SETUP screen (+1 per printed location), never a
        // per-piece price bump — the per-piece lookup always uses the raw design color count.
        // Parity with screenprint-quote-builder.js (CLAUDE.md Rule 7).
        let frontScreens = frontColors;
        if (isDarkGarment && frontColors > 0) {
            frontScreens += 1;
        }
        pricing.colorBreakdown.front = frontScreens;

        // Cap lookup colors at the maximum available in pricing data
        const maxAvailableColors = Math.max(...Object.keys(pricingData.primaryLocationPricing || {})
            .filter(key => !isNaN(parseInt(key)))
            .map(key => parseInt(key)));

        const frontLookupColors = Math.min(frontColors, maxAvailableColors);

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
            const frontPricingData = pricingData.primaryLocationPricing?.[frontLookupColors.toString()];
            if (frontPricingData?.tiers) {
                const tier = frontPricingData.tiers.find(t => quantity >= t.minQty && (!t.maxQty || quantity <= t.maxQty));
                if (tier?.prices) {
                    const sizes = Object.keys(tier.prices);
                    if (sizes.length > 0) {
                        // SIMPLIFIED PRICING: Uses first/smallest size as base for ALL pieces
                        // Does NOT account for 2XL/3XL/4XL upcharges (intentional design choice)
                        // For accurate size-specific pricing, see Quote Builder (screenprint-quote-builder.html)
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

        let totalSetupForAdditionalLocations = 0;
        if (pricingData.additionalLocationPricing) {
            const additionalPricingMaster = pricingData.additionalLocationPricing;
            additionalLocations.forEach(loc => {
                let costPerPieceForThisLoc = 0;
                const designColorsThisLoc = loc.colors;
                // Screens drive the setup fee (underbase +1 on darks); the per-piece price
                // lookup stays on the raw design color count (builder parity, Rule 7)
                let screensForThisLoc = designColorsThisLoc;

                if (designColorsThisLoc > 0) {
                    if (isDarkGarment) {
                        screensForThisLoc += 1;
                    }

                    // Cap lookup colors at the maximum available in additional location pricing data
                    const maxAvailableAddlColors = Math.max(...Object.keys(additionalPricingMaster || {})
                        .filter(key => !isNaN(parseInt(key)))
                        .map(key => parseInt(key)));

                    const lookupColorsForThisLoc = Math.min(designColorsThisLoc, maxAvailableAddlColors);

                    const locPricingData = additionalPricingMaster[lookupColorsForThisLoc.toString()];
                    if (locPricingData?.tiers) {
                        const tier = locPricingData.tiers.find(t => quantity >= t.minQty && (!t.maxQty || quantity <= t.maxQty));
                        if (tier?.pricePerPiece !== undefined) {
                            costPerPieceForThisLoc = parseFloat(tier.pricePerPiece) || 0;
                        }
                    }
                }
                pricing.additionalCost += costPerPieceForThisLoc;
                const setupForThisLoc = screensForThisLoc * this.config.setupFeePerColor;
                totalSetupForAdditionalLocations += setupForThisLoc;
                pricing.colorBreakdown.locations.push({
                    ...loc,
                    totalColors: screensForThisLoc,
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
        
        // Prices are always pre-calculated in the new format
        if (pricingData.embellishmentType === 'screenprint') {
            // Prices already include garment, print, and margin
            pricing.totalPerShirtPrintOnlyCost = pricing.basePrice + pricing.additionalCost + safetyStripesSurcharge;

            // Calculate LTM per shirt impact
            pricing.ltmImpactPerShirt = (pricing.ltmFee > 0 && quantity > 0) ? pricing.ltmFee / quantity : 0;

            // CRITICAL CHANGE: Include LTM fee in the per-shirt price (all-in price)
            pricing.perShirtTotal = pricing.totalPerShirtPrintOnlyCost + pricing.ltmImpactPerShirt;

            // Setup is separate (one-time cost)
            // SYNC FIX: Round subtotal to 2 decimal places to match quote builder (line 2794)
            pricing.subtotal = Math.round((pricing.perShirtTotal * quantity) * 100) / 100;
            pricing.grandTotal = pricing.subtotal + pricing.setupFee;
            pricing.setupPerShirt = quantity > 0 ? pricing.setupFee / quantity : 0;
        } else {
            // Legacy calculation where basePrice needs margin applied
            pricing.totalPerShirtPrintOnlyCost = pricing.basePrice + pricing.additionalCost;
            pricing.ltmImpactPerShirt = (pricing.ltmFee > 0 && quantity > 0) ? pricing.ltmFee / quantity : 0;

            // Include LTM in per-shirt price
            pricing.perShirtTotal = quantity > 0 ? pricing.totalPerShirtPrintOnlyCost + pricing.ltmImpactPerShirt : 0;

            // SYNC FIX: Round subtotal to 2 decimal places to match quote builder (line 2794)
            pricing.subtotal = Math.round((pricing.perShirtTotal * quantity) * 100) / 100;
            pricing.grandTotal = pricing.subtotal + pricing.setupFee;
            pricing.setupPerShirt = quantity > 0 ? pricing.setupFee / quantity : 0;
        }
        
        return pricing;
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

    }

    /**
     * Update detailed pricing breakdown (shows under "Show Details")
     */
    updatePricingDetailsBreakdown(pricing) {
        // Find or create breakdown container
        let breakdownContainer = document.getElementById('sp-pricing-details-breakdown');
        let wasVisible = false; // Track if breakdown was open

        if (!breakdownContainer) {
            const priceDisplay = document.querySelector('.sp-live-price-display');
            if (priceDisplay) {
                breakdownContainer = document.createElement('div');
                breakdownContainer.id = 'sp-pricing-details-breakdown';
                breakdownContainer.className = 'sp-pricing-details-breakdown';
                breakdownContainer.style.display = 'none';
                priceDisplay.appendChild(breakdownContainer);
            } else {
                return;
            }
        } else {
            // Store current visibility state
            wasVisible = breakdownContainer.style.display !== 'none';
        }

        let html = '<div class="sp-breakdown-content">';

        // Front location breakdown
        if (this.state.frontColors > 0 && pricing.basePrice > 0) {
            html += '<div class="sp-breakdown-section">';
            html += '<div class="sp-breakdown-header">Front Location</div>';

            if (pricing.garmentCost && pricing.frontPrintCost) {
                html += `<div class="sp-breakdown-item">`;
                html += `<span>Shirt:</span><span>$${pricing.garmentCost.toFixed(2)}</span>`;
                html += `</div>`;

                // Per-piece print price is by raw design colors (underbase is a setup screen only)
                const printLabel = `Print (${this.state.frontColors} color${this.state.frontColors !== 1 ? 's' : ''})`;

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
            html += '</div>';
        }

        // Additional locations breakdown
        if (pricing.colorBreakdown.locations && pricing.colorBreakdown.locations.length > 0) {
            pricing.colorBreakdown.locations.forEach(loc => {
                if (loc.colors > 0) {
                    const locLabel = this.config.locationOptions.find(opt => opt.value === loc.location)?.label || loc.location;

                    html += '<div class="sp-breakdown-section">';
                    html += `<div class="sp-breakdown-header">${locLabel}</div>`;

                    // Per-piece print price is by raw design colors (underbase is a setup screen only)
                    const locPrintLabel = `Print (${loc.colors} color${loc.colors !== 1 ? 's' : ''})`;

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
                    html += '</div>';
                }
            });
        }

        // Add Setup Fees breakdown
        if (pricing.setupFee > 0) {
            html += '<div class="sp-breakdown-section">';
            html += '<div class="sp-breakdown-header">Setup Fees (One-Time Charge)</div>';

            // Front setup
            if (pricing.colorBreakdown.front > 0) {
                const frontSetup = pricing.colorBreakdown.front * this.config.setupFeePerColor;
                const underbaseNote = (this.state.isDarkGarment && this.state.frontColors > 0)
                    ? ` (${this.state.frontColors} design + 1 underbase)`
                    : '';
                html += `<div class="sp-breakdown-item">`;
                html += `<span>Front${underbaseNote}:</span><span>${pricing.colorBreakdown.front} colors × $${this.config.setupFeePerColor.toFixed(2)}</span>`;
                html += `</div>`;
                html += `<div class="sp-breakdown-item sp-breakdown-subtotal">`;
                html += `<span>Front Setup:</span><span>$${frontSetup.toFixed(2)}</span>`;
                html += `</div>`;
            }

            // Additional locations setup
            if (pricing.colorBreakdown.locations && pricing.colorBreakdown.locations.length > 0) {
                pricing.colorBreakdown.locations.forEach(loc => {
                    if (loc.colors > 0 && loc.setupCost > 0) {
                        const locLabel = this.config.locationOptions.find(opt => opt.value === loc.location)?.label || loc.location;
                        const underbaseNote = (this.state.isDarkGarment && loc.colors > 0)
                            ? ` (${loc.colors} design + 1 underbase)`
                            : '';
                        html += `<div class="sp-breakdown-item">`;
                        html += `<span>${locLabel}${underbaseNote}:</span><span>${loc.totalColors} colors × $${this.config.setupFeePerColor.toFixed(2)}</span>`;
                        html += `</div>`;
                        html += `<div class="sp-breakdown-item sp-breakdown-subtotal">`;
                        html += `<span>${locLabel} Setup:</span><span>$${loc.setupCost.toFixed(2)}</span>`;
                        html += `</div>`;
                    }
                });
            }

            // Total setup
            html += `<div class="sp-breakdown-item sp-breakdown-subtotal" style="margin-top: 12px; border-top: 2px solid #f3f4f6; padding-top: 12px;">`;
            html += `<span>Total Setup:</span><span>$${pricing.setupFee.toFixed(2)}</span>`;
            html += `</div>`;

            // Note
            html += `<div class="sp-breakdown-note">`;
            html += `<i class="fas fa-info-circle" aria-hidden="true"></i> Setup fees are charged once per order, not per shirt`;
            html += `</div>`;

            html += '</div>';
        }

        // Add LTM fee breakdown if applicable
        if (pricing.ltmImpactPerShirt > 0) {
            html += '<div class="sp-breakdown-section sp-breakdown-ltm-section">';
            html += '<div class="sp-breakdown-header">Small Batch Fee</div>';
            html += `<div class="sp-breakdown-item">`;
            html += `<span>Fee Amount:</span><span>$${pricing.ltmFee.toFixed(2)}</span>`;
            html += `</div>`;
            html += `<div class="sp-breakdown-item">`;
            html += `<span>Quantity:</span><span>${pricing.quantity} shirts</span>`;
            html += `</div>`;
            html += `<div class="sp-breakdown-item sp-breakdown-subtotal">`;
            html += `<span>Fee per Shirt:</span><span>$${pricing.ltmImpactPerShirt.toFixed(2)}</span>`;
            html += `</div>`;
            html += `<div class="sp-breakdown-note">`;
            html += `<i class="fas fa-info-circle" aria-hidden="true"></i> The $${pricing.ltmFee.toFixed(2)} small batch fee is divided across all ${pricing.quantity} shirts`;
            html += `</div>`;
            html += '</div>';
        }

        // Grand total per shirt (now includes LTM if applicable)
        html += '<div class="sp-breakdown-grand-total">';
        if (pricing.ltmImpactPerShirt > 0) {
            const baseWithoutLTM = pricing.perShirtTotal - pricing.ltmImpactPerShirt;
            html += '<div class="sp-breakdown-total-item">';
            html += `<span>Subtotal:</span><span>$${baseWithoutLTM.toFixed(2)}</span>`;
            html += '</div>';
            html += '<div class="sp-breakdown-total-item">';
            html += `<span>Small Batch Fee:</span><span>+$${pricing.ltmImpactPerShirt.toFixed(2)}</span>`;
            html += '</div>';
            html += '<div class="sp-breakdown-total-divider"></div>';
        }
        html += '<div class="sp-breakdown-total-item sp-breakdown-final-total">';
        html += `<span>Price per Shirt:</span><span>$${pricing.perShirtTotal.toFixed(2)}</span>`;
        html += '</div>';
        html += '</div>';

        html += '</div>';
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

        // Tier prices use the raw design color count — underbase is a setup screen,
        // never part of the per-piece price (builder parity, Rule 7)
        let effectiveFrontColors = this.state.frontColors;

        // Cap at maximum available in pricing data
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
                noteText = `Prices shown are per shirt for garment + ${colorText} front print. Dark garments add one white underbase screen to the one-time setup fee — it does not change the per-shirt price.`;
            } else {
                noteText = `Prices shown are per shirt for garment + ${colorText} front print.`;
            }
        }
        html += `<p class="sp-tiers-note">${noteText}</p>`;
        html += '<p class="sp-tiers-note sp-mt-8">Minimum order quantity: 24 pieces</p>';
        
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
        
        // Front print part - per-piece price is by raw design colors (underbase is setup-only)
        if (this.state.frontColors > 0 && pricing.basePrice >= 0) {
            const displayPrice = this.state.frontHasSafetyStripes ?
                pricing.basePrice + this.state.safetyStripeSurcharge :
                pricing.basePrice;

            // Show breakdown: Shirt + Print with individual costs
            if (pricing.garmentCost && pricing.frontPrintCost) {
                subtitleParts.push(
                    `Shirt + ${this.state.frontColors} Color Front: $${displayPrice.toFixed(2)} ` +
                    `<span style="color: #666; font-size: 0.9em;">(Shirt: $${pricing.garmentCost.toFixed(2)} + Print: $${pricing.frontPrintCost.toFixed(2)})</span>`
                );
            } else {
                // Fallback if breakdown not available
                subtitleParts.push(`${this.state.frontColors} Color Front $${displayPrice.toFixed(2)}`);
            }
        }

        // Additional locations part - per-piece price is by raw design colors
        pricing.colorBreakdown.locations.forEach(loc => {
            if (loc.colors > 0 ) { // Only add if design colors > 0 for this location
                const locLabel = this.config.locationOptions.find(opt => opt.value === loc.location)?.label || loc.location;
                const displayPrice = loc.hasSafetyStripes ?
                    loc.costPerPiece + this.state.safetyStripeSurcharge :
                    loc.costPerPiece;
                subtitleParts.push(`${loc.colors} Color ${locLabel} $${displayPrice.toFixed(2)}`);
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
                <p>The table below shows the <strong>per-piece cost</strong> for adding a print to an additional location. Setup fees apply per screen, per location — dark garments add one white underbase screen per location (setup only, never per piece).</p>
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
                // Per-piece price is by raw design color count (underbase is setup-only)
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
            </div>
            <p class="sp-tiers-note">Setup fee per screen, per additional location: $${this.config.setupFeePerColor.toFixed(2)}. Dark garments add one white underbase screen per location (setup only — the per-piece price is unchanged).</p>
            <p class="sp-tiers-note sp-mt-8">Minimum order quantity: 24 pieces</p>
        `;
        this.elements.additionalLocationGuideContent.innerHTML = html;
    }

    // (a second showError(message) — alert() — used to sit here; the later banner version always won. Removed 2026-09-06.)

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
        this.state.masterBundle = data;
        this.renderTierButtons(); // the tier strip is API-driven (2026-09-06)
        this.state.pricingData = data;

        // Store pricing data globally for size upcharges display
        window.screenPrintPricingData = data;

        // Dispatch event for size upcharges display
        window.dispatchEvent(new CustomEvent('screenPrintPricingLoaded', {
            detail: data
        }));

        if (data.styleNumber) this.state.styleNumber = data.styleNumber;
        if (data.productTitle) this.state.productTitle = data.productTitle;

        // Update breadcrumb Products link with current style (matches DTG behavior)
        const productsBreadcrumb = document.getElementById('products-breadcrumb');
        if (productsBreadcrumb && this.state.styleNumber) {
            productsBreadcrumb.href = `/product.html?style=${this.state.styleNumber}`;
        }

        // Toggle prices removed - only "STEP 3: YOUR PRICE" display shows pricing

        this.updateDisplay();
        
        if (this.tiersLoaded && document.getElementById('pricing-tiers')?.style.display !== 'none') {
            this.updatePricingTiers();
        }
        if (this.locationGuideLoaded && document.getElementById('location-pricing')?.style.display !== 'none') {
            this.updateAdditionalLocationPricingGuide();
        }
    }

    // Helper: Find tier for given quantity
    findTierForQuantity(quantity, tierData) {
        // Handle both array (tiersR) and object (tierData) formats
        const tiers = Array.isArray(tierData) ? tierData : Object.values(tierData);

        for (const tier of tiers) {
            if (quantity >= tier.MinQuantity && quantity <= tier.MaxQuantity) {
                return tier;
            }
        }
        console.warn(`[ScreenPrintV2] No tier found for quantity ${quantity}`);
        return null;
    }

    // ==================== LOADING & ERROR STATES ====================

    /**
     * Show loading indicator
     */
    showLoading() {
        const container = this.elements.container;
        if (!container) return;

        // Create loading overlay if it doesn't exist
        let loadingOverlay = document.getElementById('sp-loading-overlay');
        if (!loadingOverlay) {
            loadingOverlay = document.createElement('div');
            loadingOverlay.id = 'sp-loading-overlay';
            loadingOverlay.style.cssText = `
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(255, 255, 255, 0.9);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 1000;
            `;
            loadingOverlay.innerHTML = `
                <div class="sp-loading-inner">
                    <div class="sp-loading-spinner"></div>
                    <p class="sp-loading-text">Loading pricing data...</p>
                </div>
            `;
            container.style.position = 'relative';
            container.appendChild(loadingOverlay);
        }
        loadingOverlay.style.display = 'flex';
    }

    /**
     * Hide loading indicator
     */
    hideLoading() {
        const loadingOverlay = document.getElementById('sp-loading-overlay');
        if (loadingOverlay) {
            loadingOverlay.style.display = 'none';
        }
    }

    /**
     * Show error message
     */
    showError(message) {
        const container = this.elements.container;
        if (!container) return;

        // Create or update error banner
        let errorBanner = document.getElementById('sp-error-banner');
        if (!errorBanner) {
            errorBanner = document.createElement('div');
            errorBanner.id = 'sp-error-banner';
            errorBanner.style.cssText = `
                background: #fee2e2;
                border: 1px solid #ef4444;
                color: #991b1b;
                padding: 1rem;
                border-radius: 8px;
                margin-bottom: 1rem;
                display: flex;
                align-items: center;
                gap: 0.5rem;
            `;
            container.insertBefore(errorBanner, container.firstChild);
        }
        errorBanner.innerHTML = `
            <i class="fas fa-exclamation-triangle" aria-hidden="true"></i>
            <span>${message}</span>
            <button type="button" class="sp-error-dismiss" aria-label="Dismiss">&times;</button>
        `;
        errorBanner.style.display = 'flex';
        const dismiss = errorBanner.querySelector('.sp-error-dismiss');
        if (dismiss) dismiss.addEventListener('click', () => errorBanner.remove());

        // Auto-hide after 10 seconds
        setTimeout(() => {
            if (errorBanner) errorBanner.style.display = 'none';
        }, 10000);
    }
}

// Class available globally, but NOT auto-instantiated
// Instantiation is handled in the HTML page for explicit control