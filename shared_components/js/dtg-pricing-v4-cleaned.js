/**
 * DTG Pricing v4 - Direct API Only Version
 * Cleaned up version with master bundle system removed
 * Fixes race conditions and intermittent pricing failures
 */

(function() {
    'use strict';

    console.log('[DTG-v4] Initializing Direct API only DTG pricing interface');

    // Configuration
    const DTG_LOCATIONS = {
        'LC': {
            name: 'Left Chest',
            size: '4" × 4"',
            image: 'https://cdn.caspio.com/A0E15000/Safety%20Stripes/dtg-location-left-chest-png.png?ver=1',
            isPopular: true,
            displayOrder: 1
        },
        'FF': {
            name: 'Full Front',
            size: '12" × 16"',
            image: 'https://cdn.caspio.com/A0E15000/Safety%20Stripes/dtg-location-full-front.png.png?ver=1',
            isPopular: true,
            displayOrder: 2
        },
        'LC_FB': {
            name: 'Left Chest + Full Back',
            size: '4"×4" + 12"×16"',
            image: 'https://cdn.caspio.com/A0E15000/Safety%20Stripes/dtg-location-combo-lc-fb.png?ver=1',
            isPopular: true,
            displayOrder: 3,
            isCombo: true
        },
        'FB': {
            name: 'Full Back',
            size: '12" × 16"',
            image: 'https://c3eku948.caspio.com/dp/a0e150004df4984fb1ef4d30b01a/files/9037959',
            isPopular: false,
            displayOrder: 4
        },
        'JF': {
            name: 'Jumbo Front',
            size: '16" × 20"',
            image: 'https://cdn.caspio.com/A0E15000/Safety%20Stripes/dtg-location-jumbo-front.png?ver=1',
            isPopular: false,
            displayOrder: 5
        },
        'JB': {
            name: 'Jumbo Back',
            size: '16" × 20"',
            image: 'https://cdn.caspio.com/A0E15000/Safety%20Stripes/dtg-location-Jumbo-back.png.png?ver=1',
            isPopular: false,
            displayOrder: 6
        },
        'LC_JB': {
            name: 'Left Chest + Jumbo Back',
            size: '4"×4" + 16"×20"',
            image: 'https://cdn.caspio.com/A0E15000/Safety%20Stripes/dtg-location-combo-lc-jb.png?ver=1',
            isPopular: false,
            displayOrder: 7,
            isCombo: true
        },
        'FF_FB': {
            name: 'Full Front + Full Back',
            size: '12"×16" + 12"×16"',
            image: 'https://c3eku948.caspio.com/dp/a0e150004df4984fb1ef4d30b01a/files/9037971',
            isPopular: false,
            displayOrder: 8,
            isCombo: true
        },
        'JF_JB': {
            name: 'Jumbo Front + Back',
            size: '16"×20" + 16"×20"',
            image: 'https://c3eku948.caspio.com/dp/a0e150004df4984fb1ef4d30b01a/files/9037968',
            isPopular: false,
            displayOrder: 9,
            isCombo: true
        }
    };

    // State management
    let state = {
        selectedLocation: 'LC',
        quantity: 24,
        showAllLocations: false,
        isInitialized: false,
        isLoading: false,
        styleNumber: null,
        color: null,
        pricingData: null,
        retryCount: 0,
        maxRetries: 3
    };
    
    // Direct API Service instance
    let directAPIService = null;
    let directAPIData = null;

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        initialize();
    }

    async function initialize() {
        console.log('[DTG-v4] DOM ready, initializing components');
        
        try {
            // Get product info from URL
            const params = new URLSearchParams(window.location.search);
            state.styleNumber = params.get('StyleNumber');
            state.color = params.get('COLOR') ? decodeURIComponent(params.get('COLOR').replace(/\+/g, ' ')) : null;
            
            if (!state.styleNumber) {
                console.error('[DTG-v4] No StyleNumber in URL');
                showError('Product style not specified. Please select a product.');
                return;
            }

            // Debug logging if enabled
            if (window.DTG_PERFORMANCE?.debug) {
                console.log('[DTG-v4 DEBUG] Initializing with:', {
                    styleNumber: state.styleNumber,
                    color: state.color,
                    quantity: state.quantity,
                    location: state.selectedLocation
                });
            }

            // Initialize Direct API Service
            directAPIService = new window.DTGPricingService();
            
            // Inject UI
            injectUIStructure();
            
            // Setup event listeners
            setupEventListeners();
            
            // Load pricing data immediately (no arbitrary delays!)
            await loadPricingData();
            
            state.isInitialized = true;
            console.log('[DTG-v4] Initialization complete');

            // Ensure recommendations button is added (backup call)
            setTimeout(() => {
                if (!document.getElementById('dtg-recommendations-btn-container')) {
                    console.log('[DTG-v4] Adding recommendations button as backup');
                    addRecommendationsButton();
                }
            }, 1000);

        } catch (error) {
            console.error('[DTG-v4] Initialization failed:', error);
            showError('Failed to initialize pricing calculator. Please refresh the page.');
        }
    }

    async function loadPricingData() {
        if (!directAPIService || !state.styleNumber) {
            console.error('[DTG-v4] Cannot load pricing: missing service or style');
            return;
        }

        // Prevent concurrent loads
        if (state.isLoading) {
            console.log('[DTG-v4] Already loading, skipping duplicate request');
            return;
        }

        state.isLoading = true;
        showLoadingState();

        const startTime = performance.now();
        
        try {
            if (window.DTG_PERFORMANCE?.debug) {
                console.log('[DTG-v4 DEBUG] Loading pricing for:', state.styleNumber, state.color);
            }

            // Fetch pricing data with retry logic
            directAPIData = await fetchWithRetry(
                () => directAPIService.fetchPricingData(state.styleNumber, state.color),
                state.maxRetries
            );
            
            const fetchTime = performance.now() - startTime;
            console.log(`[DTG-v4] ✅ Data loaded in ${fetchTime.toFixed(0)}ms`);
            
            // Store pricing data in state
            state.pricingData = directAPIService.calculateAllLocationPrices(directAPIData, state.quantity);
            
            // Log performance metrics
            if (window.DTG_PERFORMANCE) {
                window.DTG_PERFORMANCE.metrics.apiLoadTime = fetchTime;
                window.DTG_PERFORMANCE.metrics.totalLoadTime = performance.now() - window.DTG_PERFORMANCE.loadStartTime;
                
                if (window.DTG_PERFORMANCE.debug) {
                    console.log('📊 PERFORMANCE METRICS:');
                    console.log(`  API Load: ${fetchTime.toFixed(0)}ms`);
                    console.log(`  Total Time: ${window.DTG_PERFORMANCE.metrics.totalLoadTime.toFixed(0)}ms`);
                }
            }

            // Special logging for PC78ZH debugging
            if (state.styleNumber === 'PC78ZH' && window.DTG_PERFORMANCE?.debug) {
                console.log('[DTG-v4 DEBUG] PC78ZH pricing loaded:', {
                    quantity: state.quantity,
                    tier: getPriceTier(state.quantity),
                    locationPrices: state.pricingData?.[state.selectedLocation]
                });
            }
            
            // Update all displays
            updatePricing();
            updateLocationPrices();
            
            // Reset retry count on success
            state.retryCount = 0;
            
            // Build compatibility bundle for proper event format
            const compatBundle = directAPIService.buildCompatibilityBundle(
                directAPIData, 
                state.quantity, 
                state.selectedLocation
            );
            
            // Dispatch properly formatted event for DP5-Helper and other components
            window.dispatchEvent(new CustomEvent('pricingDataLoaded', {
                detail: compatBundle
            }));

            // Also dispatch dtg-specific event with full bundle for universal pricing grid
            window.dispatchEvent(new CustomEvent('dtgPricingDataLoaded', {
                detail: {
                    bundle: masterBundle,
                    embellishmentType: 'dtg'
                }
            }));

            if (window.DTG_PERFORMANCE?.debug) {
                console.log('[DTG-v4] Dispatched pricingDataLoaded with format:', {
                    hasHeaders: !!compatBundle.headers,
                    hasPrices: !!compatBundle.prices,
                    hasTierData: !!compatBundle.tierData,
                    headers: compatBundle.headers,
                    selectedLocation: compatBundle.selectedLocationValue
                });
            }
            
        } catch (error) {
            console.error('[DTG-v4] Failed to load pricing after retries:', error);
            
            // Special handling for problematic styles
            const debugStyles = ['PC78', 'S700'];
            const isDebugStyle = debugStyles.some(style => state.styleNumber && state.styleNumber.startsWith(style));
            
            if (isDebugStyle) {
                console.error(`[DTG-v4] Debug info for ${state.styleNumber}:`, {
                    color: state.color || 'Not selected',
                    error: error.message
                });
                
                // Clear cache for this style
                if (directAPIService && directAPIService.cache) {
                    const cacheKey = `${state.styleNumber}-${state.color || 'all'}`;
                    directAPIService.cache.delete(cacheKey);
                    console.log('[DTG-v4] Cleared cache for:', cacheKey);
                }
                
                showError(`Unable to load pricing for ${state.styleNumber}. Cache cleared - please try selecting the product again.`);
            } else {
                showError(`Unable to load pricing data. ${error.message || 'Please try refreshing the page.'}`);
            }
        } finally {
            state.isLoading = false;
        }
    }

    async function fetchWithRetry(fetchFn, maxRetries = 3) {
        let lastError;
        
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                if (attempt > 1) {
                    // Exponential backoff: 1s, 2s, 4s
                    const delay = Math.pow(2, attempt - 1) * 1000;
                    console.log(`[DTG-v4] Retry attempt ${attempt} after ${delay}ms delay`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
                
                return await fetchFn();
                
            } catch (error) {
                lastError = error;
                console.error(`[DTG-v4] Attempt ${attempt} failed:`, error);
                
                // Don't retry on 4xx errors (client errors)
                if (error.status && error.status >= 400 && error.status < 500) {
                    throw error;
                }
            }
        }
        
        throw lastError || new Error('Max retries exceeded');
    }

    function showLoadingState() {
        const unitPriceEl = document.getElementById('dtg-unit-price');
        const totalPriceEl = document.getElementById('dtg-total-price');
        
        if (unitPriceEl) unitPriceEl.textContent = 'Loading...';
        if (totalPriceEl) totalPriceEl.textContent = '';
        
        // Disable controls during loading
        document.querySelectorAll('.quantity-btn, .quantity-input, input[name="dtg-location"]').forEach(el => {
            el.disabled = true;
        });
    }

    function showError(message) {
        const unitPriceEl = document.getElementById('dtg-unit-price');
        const totalPriceEl = document.getElementById('dtg-total-price');
        
        if (unitPriceEl) unitPriceEl.textContent = 'Error';
        if (totalPriceEl) totalPriceEl.textContent = message;
        
        // Show error in breakdown section too
        const breakdownEl = document.getElementById('pricing-breakdown');
        if (breakdownEl) {
            breakdownEl.innerHTML = `<div style="color: red; padding: 10px;">${message}</div>`;
        }
    }

    function updatePricing() {
        const unitPriceEl = document.getElementById('dtg-unit-price');
        const totalPriceEl = document.getElementById('dtg-total-price');
        const basePriceEl = document.getElementById('base-price-display');
        const locationEl = document.getElementById('location-display');
        const ltmFeeEl = document.getElementById('ltm-fee-display');
        const ltmValueEl = document.getElementById('ltm-fee-value');

        if (!unitPriceEl || !totalPriceEl) return;

        // Re-enable controls after loading
        document.querySelectorAll('.quantity-btn, .quantity-input, input[name="dtg-location"]').forEach(el => {
            el.disabled = false;
        });

        if (!state.pricingData) {
            console.log('[DTG-v4] No pricing data available yet');
            return;
        }

        const tier = getPriceTier(state.quantity);
        let basePrice = 0;

        // Get price for selected location
        if (state.pricingData[state.selectedLocation]) {
            const locationPrices = state.pricingData[state.selectedLocation];
            // Use size M as default, or S if M not available
            const size = locationPrices['M'] ? 'M' : (locationPrices['S'] ? 'S' : Object.keys(locationPrices)[0]);

            if (locationPrices[size] && locationPrices[size][tier] !== undefined) {
                basePrice = parseFloat(locationPrices[size][tier]);
            }
        }

        if (basePrice > 0) {
            let totalPrice = basePrice * state.quantity;
            let ltmFeePerUnit = 0;

            // Apply LTM fee if under 24
            if (state.quantity < 24) {
                ltmFeePerUnit = 50 / state.quantity;
                totalPrice += 50;
            }

            const displayPrice = basePrice + ltmFeePerUnit;

            // Update displays
            unitPriceEl.textContent = `$${displayPrice.toFixed(2)}`;
            totalPriceEl.textContent = `Total: $${totalPrice.toFixed(2)}`;

            if (basePriceEl) {
                basePriceEl.textContent = `$${basePrice.toFixed(2)}`;
            }

            if (locationEl && DTG_LOCATIONS[state.selectedLocation]) {
                locationEl.textContent = DTG_LOCATIONS[state.selectedLocation].name;
            }

            if (ltmFeeEl && ltmValueEl) {
                if (state.quantity < 24) {
                    ltmFeeEl.style.display = 'flex';
                    ltmValueEl.textContent = `+$${ltmFeePerUnit.toFixed(2)}/shirt`;
                } else {
                    ltmFeeEl.style.display = 'none';
                }
            }

            // Update header
            updateHeaderPricing(state.quantity, displayPrice);

            // Debug logging for PC78ZH
            if (state.styleNumber === 'PC78ZH' && window.DTG_PERFORMANCE?.debug) {
                console.log('[DTG-v4 DEBUG] PC78ZH price calculation:', {
                    quantity: state.quantity,
                    tier: tier,
                    location: state.selectedLocation,
                    basePrice: basePrice,
                    ltmFee: ltmFeePerUnit,
                    displayPrice: displayPrice,
                    total: totalPrice
                });
            }
        } else {
            // No price available for this configuration
            unitPriceEl.textContent = 'N/A';
            totalPriceEl.textContent = 'Pricing not available for this selection';

            if (window.DTG_PERFORMANCE?.debug) {
                console.log('[DTG-v4 DEBUG] No price found for:', {
                    location: state.selectedLocation,
                    tier: tier,
                    pricingData: state.pricingData
                });
            }
        }

        // Generate pricing table when pricing updates
        generatePricingTable();
    }

    function updateLocationPrices() {
        if (!state.pricingData) return;
        
        const tier = getPriceTier(state.quantity);
        
        Object.entries(DTG_LOCATIONS).forEach(([code, location]) => {
            const priceEl = document.getElementById(`price-${code}`);
            if (priceEl) {
                let basePrice = 0;
                
                if (state.pricingData[code]) {
                    const locationPrices = state.pricingData[code];
                    const size = locationPrices['M'] ? 'M' : (locationPrices['S'] ? 'S' : Object.keys(locationPrices)[0]);
                    
                    if (locationPrices[size] && locationPrices[size][tier] !== undefined) {
                        basePrice = parseFloat(locationPrices[size][tier]);
                    }
                }
                
                // Add LTM fee if applicable
                if (state.quantity < 24 && basePrice > 0) {
                    basePrice += 50 / state.quantity;
                }
                
                if (basePrice > 0) {
                    priceEl.textContent = `$${basePrice.toFixed(2)}`;
                } else {
                    priceEl.textContent = 'N/A';
                }
            }
        });
    }

    function getPriceTier(quantity) {
        // Fix for quantity 166 - ensure it gets 72+ tier
        if (quantity >= 72) return '72+';
        if (quantity >= 48) return '48-71';
        if (quantity >= 24) return '24-47';
        // Under 24 still uses 24-47 tier with LTM fee
        return '24-47';
    }

    function updateHeaderPricing(quantity, unitPrice) {
        const headerQty = document.getElementById('header-quantity');
        const headerPrice = document.getElementById('header-unit-price');
        
        if (headerQty) {
            headerQty.textContent = quantity;
        }
        
        if (headerPrice) {
            if (typeof unitPrice === 'number' && !isNaN(unitPrice) && unitPrice > 0) {
                headerPrice.textContent = `$${unitPrice.toFixed(2)}`;
            } else {
                headerPrice.textContent = 'N/A';
            }
        }
    }

    async function handleQuantityChange(quantity) {
        console.log('[DTG-v4] Quantity changed:', quantity);
        state.quantity = quantity;

        // Dispatch event for other components
        window.dispatchEvent(new CustomEvent('quantityChanged', {
            detail: { totalQuantity: quantity }
        }));

        // Recalculate prices with new quantity
        if (directAPIData) {
            state.pricingData = directAPIService.calculateAllLocationPrices(directAPIData, state.quantity);
            updatePricing();
            updateLocationPrices();
            
            // Dispatch updated pricing event with proper format
            const compatBundle = directAPIService.buildCompatibilityBundle(
                directAPIData, 
                state.quantity, 
                state.selectedLocation
            );
            window.dispatchEvent(new CustomEvent('pricingDataLoaded', {
                detail: compatBundle
            }));
        } else {
            // If no data yet, try loading
            await loadPricingData();
        }
    }

    async function handleLocationSelection(locationCode) {
        console.log('[DTG-v4] Location selected:', locationCode);
        state.selectedLocation = locationCode;

        // Update pricing display immediately if we have data
        if (state.pricingData) {
            updatePricing();
            
            // Dispatch updated pricing event with new location
            if (directAPIData) {
                const compatBundle = directAPIService.buildCompatibilityBundle(
                    directAPIData, 
                    state.quantity, 
                    state.selectedLocation
                );
                window.dispatchEvent(new CustomEvent('pricingDataLoaded', {
                    detail: compatBundle
                }));
            }
        } else {
            // If no data yet, try loading
            await loadPricingData();
        }
    }

    function setupEventListeners() {
        // Quantity controls removed - display-only pricing table like embroidery calculator

        // Location selection removed - display-only pricing table

        // Show more locations
        const showMoreBtn = document.getElementById('show-more-locations');
        if (showMoreBtn) {
            showMoreBtn.addEventListener('click', () => {
                state.showAllLocations = !state.showAllLocations;
                const additionalLocations = document.getElementById('additional-locations');
                const showText = showMoreBtn.querySelector('.show-text');
                const hideText = showMoreBtn.querySelector('.hide-text');
                
                if (state.showAllLocations) {
                    additionalLocations.style.display = 'grid';
                    showText.style.display = 'none';
                    hideText.style.display = 'inline';
                    showMoreBtn.classList.add('expanded');
                } else {
                    additionalLocations.style.display = 'none';
                    showText.style.display = 'inline';
                    hideText.style.display = 'none';
                    showMoreBtn.classList.remove('expanded');
                }
            });
        }

        // Product recommendations toggle
        const toggleRecommendations = document.getElementById('toggle-recommendations');
        if (toggleRecommendations) {
            toggleRecommendations.addEventListener('click', () => {
                const event = new CustomEvent('toggleDTGRecommendations');
                window.dispatchEvent(event);
            });
        }

        // Setup table-specific event listeners
        setupTableEventListeners();
    }

    // UI injection functions (same as before but with error handling)
    function injectUIStructure() {
        const container = document.querySelector('.pricing-content-wrapper');
        if (!container) {
            console.error('[DTG-v4] Could not find .pricing-content-wrapper container');
            return;
        }

        console.log('[DTG-v4] Found container, injecting UI structure');

        // Hide existing elements
        const existingElements = container.querySelectorAll('.dtg-steps-container, #quick-quote-container');
        existingElements.forEach(el => el.style.display = 'none');

        // Create new simplified structure - display-only like embroidery calculator
        const html = `
            <div class="dtg-v4-container">
                <!-- Display-Only Header (No Quantity Controls) -->
                <div class="dtg-pricing-header" style="display: none;">
                    <!-- Quantity controls removed - this is now display-only like embroidery calculator -->
                </div>

                <!-- DTG Product Recommendations Button -->
                <div class="product-recommendations-toggle" style="margin-bottom: 20px;">
                    <button class="recommendations-btn" id="toggle-recommendations" style="
                        background: linear-gradient(135deg, #2e5827 0%, #3a7c52 100%);
                        color: white;
                        border: none;
                        padding: 12px 24px;
                        border-radius: 8px;
                        font-size: 16px;
                        font-weight: 600;
                        cursor: pointer;
                        display: flex;
                        align-items: center;
                        gap: 10px;
                        box-shadow: 0 2px 8px rgba(0,0,0,0.15);
                        transition: all 0.3s ease;
                    " onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 4px 12px rgba(0,0,0,0.2)'"
                       onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 2px 8px rgba(0,0,0,0.15)'">
                        <i class="fas fa-star"></i>
                        <span>View DTG Product Recommendations</span>
                        <span style="background: rgba(255,255,255,0.2); padding: 2px 8px; border-radius: 12px; font-size: 12px;">
                            Based on 50,000+ prints
                        </span>
                    </button>
                </div>

                <!-- Interactive elements removed - display-only pricing table like embroidery calculator -->

                <!-- Full Pricing Table -->
                <div class="pricing-table-section">
                    <h3>Complete Pricing Reference</h3>
                    <div id="pricing-grid-container">
                        <!-- Universal pricing grid will populate this -->
                    </div>
                </div>
            </div>
        `;

        // Insert the new structure
        const pricingGrid = document.getElementById('pricing-grid-container');
        if (pricingGrid) {
            console.log('[DTG-v4] Inserting HTML before pricing-grid-container');
            pricingGrid.insertAdjacentHTML('beforebegin', html);
        } else {
            console.log('[DTG-v4] Inserting HTML at end of container');
            container.insertAdjacentHTML('beforeend', html);
        }

        // Add styles
        addStyles();

        // Populate location cards
        populateLocationCards();

        // Add recommendations button separately to ensure it appears
        addRecommendationsButton();
    }

    // Separate function to ensure recommendations button is added
    function addRecommendationsButton() {
        console.log('[DTG-v4] Adding recommendations button - attempting insertion');

        // Check if button already exists
        if (document.getElementById('dtg-recommendations-btn-container')) {
            console.log('[DTG-v4] Recommendations button already exists');
            return;
        }

        // More robust button HTML with fixed positioning as fallback
        const buttonHTML = `
            <div id="dtg-recommendations-btn-container" style="
                position: fixed;
                top: 200px;
                right: 20px;
                z-index: 9999;
                background: white;
                padding: 15px;
                border-radius: 10px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            ">
                <button class="recommendations-btn" id="toggle-recommendations-standalone" style="
                    background: linear-gradient(135deg, #2e5827 0%, #3a7c52 100%);
                    color: white !important;
                    border: none !important;
                    padding: 14px 28px;
                    border-radius: 8px;
                    font-size: 16px;
                    font-weight: 600;
                    cursor: pointer;
                    display: flex !important;
                    align-items: center;
                    gap: 10px;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.15);
                    transition: all 0.3s ease;
                    width: auto;
                    white-space: nowrap;
                " onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 4px 12px rgba(0,0,0,0.25)'"
                   onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 2px 8px rgba(0,0,0,0.15)'">
                    <i class="fas fa-star" style="font-size: 18px; color: white;"></i>
                    <span>View DTG Product Recommendations</span>
                </button>
                <p style="font-size: 12px; color: #666; margin: 8px 0 0 0; text-align: center;">
                    Based on 50,000+ prints
                </p>
            </div>
        `;

        // Always insert into body for guaranteed visibility
        document.body.insertAdjacentHTML('beforeend', buttonHTML);
        console.log('[DTG-v4] Recommendations button forcefully added to body with fixed positioning');

        // Attach event listener
        const button = document.getElementById('toggle-recommendations-standalone');
        if (button) {
            button.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('[DTG-v4] Recommendations button clicked - dispatching event');

                // Try multiple ways to trigger the modal
                const event = new CustomEvent('toggleDTGRecommendations', { bubbles: true });
                document.dispatchEvent(event);
                window.dispatchEvent(event);

                // Also try calling the modal directly if it exists
                if (window.DTGRecommendationsModal && typeof window.DTGRecommendationsModal.show === 'function') {
                    console.log('[DTG-v4] Calling modal show directly');
                    window.DTGRecommendationsModal.show();
                }
            });

            // Make absolutely sure button is visible
            button.style.visibility = 'visible';
            button.style.opacity = '1';

            // Log button status
            const rect = button.getBoundingClientRect();
            console.log('[DTG-v4] Button verification:', {
                exists: true,
                visible: rect.width > 0 && rect.height > 0,
                position: { top: rect.top, left: rect.left, right: rect.right },
                dimensions: { width: rect.width, height: rect.height },
                display: window.getComputedStyle(button).display,
                visibility: window.getComputedStyle(button).visibility
            });
        } else {
            console.error('[DTG-v4] Failed to find button after insertion!');
        }
    }

    function populateLocationCards() {
        const popularContainer = document.getElementById('popular-locations');
        const additionalContainer = document.getElementById('additional-locations');
        
        if (!popularContainer || !additionalContainer) return;

        // Sort locations by display order
        const sortedLocations = Object.entries(DTG_LOCATIONS).sort((a, b) => 
            a[1].displayOrder - b[1].displayOrder
        );

        sortedLocations.forEach(([code, location]) => {
            const card = createLocationCard(code, location);
            if (location.isPopular) {
                popularContainer.appendChild(card);
            } else {
                additionalContainer.appendChild(card);
            }
        });

        // Select first location by default
        const firstRadio = popularContainer.querySelector('input[type="radio"]');
        if (firstRadio) {
            firstRadio.checked = true;
        }
    }

    function createLocationCard(code, location) {
        const label = document.createElement('label');
        label.className = 'location-card';
        label.dataset.location = code;

        const badgeHTML = location.isCombo ? 
            '<span class="combo-badge">COMBO</span>' : '';

        label.innerHTML = `
            <input type="radio" name="dtg-location" value="${code}" ${code === state.selectedLocation ? 'checked' : ''}>
            <div class="location-content">
                ${badgeHTML}
                <div class="location-image">
                    <img src="${location.image}" alt="${location.name}">
                </div>
                <div class="location-info">
                    <div class="location-name">${location.name}</div>
                    <div class="location-size">${location.size}</div>
                    <div class="location-price" id="price-${code}">Loading...</div>
                </div>
            </div>
        `;

        return label;
    }

    function addStyles() {
        // Add the same styles as before
        const style = document.createElement('style');
        style.textContent = `
            /* DTG v4 Container */
            .dtg-v4-container {
                max-width: 1200px;
                margin: 0 auto;
            }

            /* Pricing Header */
            .dtg-pricing-header {
                background: white;
                border-radius: 12px;
                padding: 24px;
                margin-bottom: 24px;
                box-shadow: 0 2px 8px rgba(0,0,0,0.08);
                display: flex;
                justify-content: space-between;
                align-items: center;
                flex-wrap: wrap;
                gap: 24px;
            }

            /* Quantity Section */
            .quantity-section {
                display: flex;
                align-items: center;
                gap: 16px;
                flex-wrap: wrap;
            }

            .quantity-label {
                font-size: 16px;
                font-weight: 600;
                color: #333;
            }

            .quantity-controls {
                display: flex;
                align-items: center;
                gap: 0;
                background: #f5f5f5;
                border-radius: 8px;
                overflow: hidden;
            }

            .quantity-btn {
                width: 40px;
                height: 40px;
                border: none;
                background: transparent;
                font-size: 20px;
                cursor: pointer;
                transition: all 0.2s;
                color: #2e5827;
            }

            .quantity-btn:hover:not(:disabled) {
                background: #e8f5e9;
            }

            .quantity-btn:disabled {
                opacity: 0.5;
                cursor: not-allowed;
            }

            .quantity-input {
                width: 80px;
                height: 40px;
                border: none;
                text-align: center;
                font-size: 18px;
                font-weight: 600;
                background: transparent;
            }

            .quantity-input:focus {
                outline: none;
            }

            .quantity-input:disabled {
                opacity: 0.5;
            }

            /* Price Display */
            .price-display-section {
                text-align: right;
            }

            .price-per-unit {
                display: flex;
                align-items: baseline;
                gap: 8px;
                justify-content: flex-end;
            }

            .price-value {
                font-size: 36px;
                font-weight: bold;
                color: #2e5827;
            }

            .price-label {
                font-size: 16px;
                color: #666;
            }

            .total-price {
                font-size: 18px;
                color: #333;
                margin-top: 4px;
            }

            /* Location Selection */
            .location-selection-section {
                background: white;
                border-radius: 12px;
                padding: 24px;
                margin-bottom: 24px;
                box-shadow: 0 2px 8px rgba(0,0,0,0.08);
            }

            .section-title {
                font-size: 20px;
                font-weight: 600;
                color: #333;
                margin-bottom: 20px;
            }

            .popular-locations,
            .additional-locations {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                gap: 16px;
                margin-bottom: 20px;
            }

            .location-card {
                position: relative;
                cursor: pointer;
            }

            .location-card input[type="radio"] {
                position: absolute;
                opacity: 0;
            }

            .location-card input[type="radio"]:disabled + .location-content {
                opacity: 0.5;
                cursor: not-allowed;
            }

            .location-content {
                border: 2px solid #e0e0e0;
                border-radius: 10px;
                padding: 0;
                transition: all 0.3s ease;
                overflow: hidden;
                background: white;
            }

            .location-card:hover .location-content {
                border-color: #2e5827;
                transform: translateY(-2px);
                box-shadow: 0 4px 12px rgba(46, 88, 39, 0.15);
            }

            .location-card input[type="radio"]:checked + .location-content {
                border-color: #2e5827;
                background: #f8fcf9;
            }

            .location-card input[type="radio"]:checked + .location-content::after {
                content: '✓';
                position: absolute;
                top: 8px;
                right: 8px;
                width: 24px;
                height: 24px;
                background: #2e5827;
                color: white;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                font-weight: bold;
            }

            .location-image {
                width: 100%;
                height: 140px;
                background: #fafafa;
                display: flex;
                align-items: center;
                justify-content: center;
                overflow: hidden;
            }

            .location-image img {
                width: 100%;
                height: 100%;
                object-fit: contain;
                padding: 10px;
            }

            .location-info {
                padding: 12px;
                text-align: center;
            }

            .location-name {
                font-weight: 600;
                font-size: 14px;
                margin-bottom: 4px;
            }

            .location-size {
                font-size: 12px;
                color: #666;
                margin-bottom: 8px;
            }

            .location-price {
                font-size: 18px;
                font-weight: bold;
                color: #2e5827;
            }

            /* Show More Button */
            .show-more-btn {
                width: 100%;
                padding: 12px;
                border: 1px solid #e0e0e0;
                background: white;
                border-radius: 8px;
                font-size: 14px;
                color: #666;
                cursor: pointer;
                transition: all 0.2s;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 8px;
            }

            .show-more-btn:hover {
                background: #f8f9fa;
                border-color: #2e5827;
                color: #2e5827;
            }

            .show-more-btn i {
                transition: transform 0.3s;
            }

            .show-more-btn.expanded i {
                transform: rotate(180deg);
            }

            /* Pricing Breakdown */
            .pricing-breakdown-section {
                background: #f8fcf9;
                border: 1px solid #e1ece2;
                border-radius: 8px;
                padding: 16px 20px;
                margin-bottom: 24px;
            }

            .breakdown-content {
                display: flex;
                flex-wrap: wrap;
                gap: 24px;
                justify-content: space-between;
            }

            .breakdown-item,
            .ltm-fee-item {
                display: flex;
                align-items: center;
                gap: 8px;
            }

            .breakdown-label {
                font-size: 14px;
                color: #666;
            }

            .breakdown-value {
                font-size: 14px;
                font-weight: 600;
                color: #333;
            }

            .ltm-fee-item .breakdown-value {
                color: #e67e22;
            }

            /* Product Recommendations Toggle */
            .product-recommendations-toggle {
                margin-bottom: 24px;
            }

            .recommendations-btn {
                padding: 10px 16px;
                border: 1px solid #e0e0e0;
                background: white;
                border-radius: 8px;
                font-size: 14px;
                color: #666;
                cursor: pointer;
                transition: all 0.2s;
                display: flex;
                align-items: center;
                gap: 8px;
            }

            .recommendations-btn:hover {
                background: #f8f9fa;
                border-color: #2e5827;
                color: #2e5827;
            }

            /* Pricing Table Section */
            .pricing-table-section {
                background: white;
                border-radius: 12px;
                padding: 24px;
                box-shadow: 0 2px 8px rgba(0,0,0,0.08);
            }

            .pricing-table-section h3 {
                font-size: 20px;
                font-weight: 600;
                color: #333;
                margin-bottom: 20px;
                text-align: center;
            }

            /* Combo Badge */
            .combo-badge {
                position: absolute;
                top: 8px;
                left: 8px;
                background: #ff9800;
                color: white;
                padding: 4px 10px;
                border-radius: 16px;
                font-size: 10px;
                font-weight: 600;
                text-transform: uppercase;
                letter-spacing: 0.5px;
                z-index: 1;
            }

            /* Mobile Responsive */
            @media (max-width: 768px) {
                .dtg-pricing-header {
                    flex-direction: column;
                    text-align: center;
                }

                .price-display-section {
                    text-align: center;
                }

                .price-per-unit {
                    justify-content: center;
                }

                .popular-locations,
                .additional-locations {
                    grid-template-columns: 1fr;
                }

                .breakdown-content {
                    flex-direction: column;
                    gap: 12px;
                }
            }
        `;
        document.head.appendChild(style);
    }

    // Calculate pricing for all tiers (for pricing matrix table)
    function calculateAllTierPricing(apiData, tiers) {
        const allTierPricing = {};

        // For each tier, calculate pricing for all locations
        tiers.forEach(tierLabel => {
            // Find the quantity for this tier to calculate with
            const tierQuantity = getTierQuantity(tierLabel);

            // Use the pricing service to calculate prices for this tier
            const tierPricing = directAPIService.calculateAllLocationPrices(apiData, tierQuantity);

            // Store the pricing data for this tier
            Object.keys(tierPricing).forEach(locationCode => {
                if (!allTierPricing[locationCode]) {
                    allTierPricing[locationCode] = {};
                }

                // For each size in this location
                Object.keys(tierPricing[locationCode]).forEach(size => {
                    if (!allTierPricing[locationCode][size]) {
                        allTierPricing[locationCode][size] = {};
                    }

                    // Store the price for this tier
                    allTierPricing[locationCode][size][tierLabel] = tierPricing[locationCode][size][tierLabel];
                });
            });
        });

        return allTierPricing;
    }

    // Generate and populate pricing table
    function generatePricingTable() {
        const tbody = document.getElementById('dtg-pricing-tbody');
        const sizeTbody = document.getElementById('dtg-sizes-tbody');

        if (!tbody || !directAPIData) {
            console.log('[DTG-v4] Table generation failed - tbody:', !!tbody, 'directAPIData:', !!directAPIData);
            return;
        }

        // Clear existing content
        tbody.innerHTML = '';

        // Extract quantity tiers from API data instead of hardcoding
        const tiers = directAPIData.pricing.tiers.map(t => t.TierLabel);

        // Calculate pricing for ALL tiers (not just current quantity)
        const allTierPricing = calculateAllTierPricing(directAPIData, tiers);
        console.log('[DTG-v4] Tiers from API:', tiers);
        console.log('[DTG-v4] All tier pricing calculated:', allTierPricing);

        // Sort locations by display order
        const sortedLocations = Object.entries(DTG_LOCATIONS).sort((a, b) =>
            a[1].displayOrder - b[1].displayOrder
        );

        // Track if we've added the divider
        let dividerAdded = false;
        let showingAll = state.showAllLocations;

        // Generate rows for each location
        sortedLocations.forEach(([code, location]) => {
            // Skip locations that don't exist in API data
            if (!directAPIData.pricing.locations.some(loc => loc.code === code)) return;

            // Skip non-popular locations if not showing all
            if (!showingAll && !location.isPopular) return;

            // Add divider between single and combo locations
            if (!dividerAdded && location.isCombo) {
                const dividerRow = document.createElement('tr');
                dividerRow.className = 'location-divider-row';
                dividerRow.innerHTML = `
                    <td colspan="4" class="location-divider">
                        <span>Combination Locations</span>
                    </td>
                `;
                tbody.appendChild(dividerRow);
                dividerAdded = true;
            }

            const row = createLocationRow(code, location, tiers, allTierPricing);
            tbody.appendChild(row);
        });

        // Add show more/less button row if there are more locations to show
        const hasMoreLocations = sortedLocations.some(([code, loc]) => !loc.isPopular);
        if (hasMoreLocations) {
            const expandRow = document.createElement('tr');
            expandRow.className = 'expand-row';
            expandRow.innerHTML = `
                <td colspan="4" style="text-align: center; padding: 10px;">
                    <button id="show-more-table-locations" class="btn-show-more" style="
                        background: #f8f9fa;
                        border: 1px solid #dee2e6;
                        padding: 8px 20px;
                        border-radius: 4px;
                        cursor: pointer;
                        font-size: 14px;
                        color: #495057;
                        transition: all 0.2s;
                    ">
                        <span class="show-text" style="${showingAll ? 'display:none;' : ''}">
                            <i class="fas fa-plus-circle"></i> Show All Locations
                        </span>
                        <span class="hide-text" style="${!showingAll ? 'display:none;' : ''}">
                            <i class="fas fa-minus-circle"></i> Show Less
                        </span>
                    </button>
                </td>
            `;
            tbody.appendChild(expandRow);
        }

        // Generate size upcharges section if we have the data
        if (directAPIData && directAPIData.sizes && sizeTbody) {
            generateSizeUpcharges(sizeTbody);
        }

        // Highlight current selection
        highlightCurrentSelection();
    }

    // Create a single location row
    function createLocationRow(code, location, tiers, allTierPricing) {
        const row = document.createElement('tr');
        row.className = 'location-row';
        row.dataset.location = code;

        // Location name cell
        const locationCell = document.createElement('td');
        locationCell.className = 'location-name-cell';
        locationCell.innerHTML = `
            <div class="location-info">
                <span class="location-name">${location.name}</span>
                <span class="location-size">${location.size}</span>
            </div>
        `;
        row.appendChild(locationCell);

        // Price cells for each tier
        tiers.forEach(tier => {
            const cell = document.createElement('td');
            cell.className = 'price-cell clickable';
            cell.dataset.location = code;
            cell.dataset.tier = tier;

            // Get quantity for this tier
            const quantity = getTierQuantity(tier);
            cell.dataset.quantity = quantity;

            // Get price for this location and tier from the all-tier pricing data
            let price = 0;
            if (allTierPricing && allTierPricing[code]) {
                const locationPrices = allTierPricing[code];
                const size = locationPrices['M'] ? 'M' : (locationPrices['S'] ? 'S' : Object.keys(locationPrices)[0]);

                if (locationPrices[size] && locationPrices[size][tier] !== undefined) {
                    price = parseFloat(locationPrices[size][tier]);
                }
            }

            if (price > 0) {
                // Add asterisk for 24-47 tier (LTM fee applies under 24)
                const asterisk = tier === '24-47' ? '*' : '';
                cell.textContent = `$${price.toFixed(2)}${asterisk}`;
            } else {
                cell.textContent = 'N/A';
                cell.classList.add('na-price');
            }

            // Add click handler
            cell.addEventListener('click', () => selectFromTable(code, quantity));

            row.appendChild(cell);
        });

        return row;
    }

    // Generate size upcharges section
    function generateSizeUpcharges(tbody) {
        tbody.innerHTML = '';

        // Get sizes and upcharges from API data
        const sizes = directAPIData.sizes || [];
        const upcharges = directAPIData.sellingPriceDisplayAddOns || {};

        // Get list of available size names from the sizes array
        const availableSizes = sizes.map(sizeInfo => sizeInfo.size);

        // Group sizes by upcharge amount - ONLY for sizes that exist in the product
        const upchargeGroups = {};

        // Only process upcharges for sizes that actually exist for this product
        Object.entries(upcharges).forEach(([size, upchargeAmount]) => {
            // Skip this upcharge if the size doesn't exist for this product
            if (!availableSizes.includes(size)) {
                return;
            }

            if (!upchargeGroups[upchargeAmount]) {
                upchargeGroups[upchargeAmount] = [];
            }
            upchargeGroups[upchargeAmount].push(size);
        });

        // Sort groups by upcharge amount
        const sortedGroups = Object.entries(upchargeGroups).sort((a, b) =>
            parseFloat(a[0]) - parseFloat(b[0])
        );

        // Create rows for each upcharge group
        sortedGroups.forEach(([upcharge, sizesInGroup]) => {
            const row = document.createElement('tr');

            // Sizes cell
            const sizesCell = document.createElement('td');
            sizesCell.className = 'sizes-cell';
            sizesCell.textContent = sizesInGroup.join(', ');
            row.appendChild(sizesCell);

            // Upcharge cell
            const upchargeCell = document.createElement('td');
            upchargeCell.className = 'upcharge-cell';

            const upchargeAmount = parseFloat(upcharge);
            if (upchargeAmount === 0) {
                upchargeCell.textContent = 'Base Price';
                upchargeCell.classList.add('base-price');
            } else {
                upchargeCell.textContent = `+$${upchargeAmount.toFixed(2)}`;
            }

            row.appendChild(upchargeCell);
            tbody.appendChild(row);
        });
    }

    // Highlight current location and quantity selection
    function highlightCurrentSelection() {
        // Remove existing highlights
        document.querySelectorAll('.location-row').forEach(row => {
            row.classList.remove('selected-location');
        });
        document.querySelectorAll('.price-cell').forEach(cell => {
            cell.classList.remove('selected-cell');
        });

        // Highlight selected location row
        const selectedRow = document.querySelector(`.location-row[data-location="${state.selectedLocation}"]`);
        if (selectedRow) {
            selectedRow.classList.add('selected-location');

            // Highlight specific cell for current quantity
            const tier = getPriceTier(state.quantity);
            const selectedCell = selectedRow.querySelector(`.price-cell[data-tier="${tier}"]`);
            if (selectedCell) {
                selectedCell.classList.add('selected-cell');
            }
        }
    }

    // Handle selection from table
    function selectFromTable(locationCode, quantity) {
        console.log('[DTG-v4] Selected from table:', locationCode, quantity);

        // Update location
        const radio = document.querySelector(`input[name="dtg-location"][value="${locationCode}"]`);
        if (radio) {
            radio.checked = true;
            state.selectedLocation = locationCode;
        }

        // Update quantity
        const quantityInput = document.getElementById('dtg-quantity');
        if (quantityInput) {
            quantityInput.value = quantity;
            state.quantity = quantity;
        }

        // Update pricing and highlight
        updatePricing();
        updateLocationPrices();

        // Dispatch events
        window.dispatchEvent(new CustomEvent('quantityChanged', {
            detail: { totalQuantity: quantity }
        }));

        if (directAPIData) {
            const compatBundle = directAPIService.buildCompatibilityBundle(
                directAPIData,
                state.quantity,
                state.selectedLocation
            );
            window.dispatchEvent(new CustomEvent('pricingDataLoaded', {
                detail: compatBundle
            }));
        }
    }

    // Get representative quantity for a tier
    function getTierQuantity(tier) {
        switch(tier) {
            case '24-47': return 24;
            case '48-71': return 48;
            case '72+': return 72;
            default: return 24;
        }
    }

    // Setup table event listeners
    function setupTableEventListeners() {
        // Use event delegation for the show all locations button
        document.addEventListener('click', (e) => {
            // Check if clicked element is the show more button in the table
            const btn = e.target.closest('#show-more-table-locations');
            if (btn) {
                console.log('[DTG-v4] Show All Locations button clicked, toggling from:', state.showAllLocations);
                state.showAllLocations = !state.showAllLocations;

                // Regenerate table with new state
                generatePricingTable();
            }
        });
    }

    // Expose API for external access and debugging
    window.DTGPricingV4 = {
        getState: () => state,
        setLocation: (code) => {
            const radio = document.querySelector(`input[name="dtg-location"][value="${code}"]`);
            if (radio) {
                radio.checked = true;
                handleLocationSelection(code);
            }
        },
        setQuantity: (qty) => {
            const input = document.getElementById('dtg-quantity');
            if (input) {
                input.value = qty;
                handleQuantityChange(qty);
            }
        },
        reloadPricing: () => loadPricingData(),
        getService: () => directAPIService,
        getData: () => directAPIData,
        generateTable: () => generatePricingTable(),
        debug: {
            testPC78ZH: async () => {
                console.log('Testing PC78ZH with quantity 166...');
                state.styleNumber = 'PC78ZH';
                state.quantity = 166;
                await loadPricingData();
                console.log('Result:', {
                    tier: getPriceTier(166),
                    pricingData: state.pricingData
                });
            }
        }
    };

})();