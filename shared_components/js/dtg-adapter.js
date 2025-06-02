// shared_components/js/dtg-adapter.js
console.log("[ADAPTER:DTG] DTG Adapter loaded. Master Bundle Version.");

(function() {
    "use strict";

    let dtgCaspioMessageTimeoutId = null;
    let dtgCaspioDataProcessed = false;  // Indicates if any valid message from Caspio was processed
    let dtgProcessingMasterBundle = false; // Prevent duplicate processing
    window.dtgMasterPriceBundle = null; // To store the master bundle from Caspio
    window.currentSelectedPrintLocation = ""; // Useful for knowing the dropdown's state

    const DTG_APP_KEY = 'a0e150002eb9491a50104c1d99d7'; // DTG Specific AppKey
    const ERROR_MESSAGE_DIV_ID = 'caspio-dtg-error-message';
    const FALLBACK_UI_DIV_ID = 'cart-fallback-ui';
    const EXPECTED_CASPIO_ORIGIN_1 = 'https://c3eku948.caspio.com'; // Primary Caspio domain
    const EXPECTED_CASPIO_ORIGIN_2 = 'https://nwcustom.caspio.com'; // Custom Caspio domain
    const EXPECTED_CASPIO_ORIGIN_3 = 'https://www.teamnwca.com'; // Production website domain

    function displayError(message) {
        const errorDiv = document.getElementById(ERROR_MESSAGE_DIV_ID);
        if (errorDiv) {
            errorDiv.textContent = message;
            errorDiv.style.display = 'block';
        }
        const fallbackDiv = document.getElementById(FALLBACK_UI_DIV_ID);
        if (fallbackDiv) fallbackDiv.style.display = 'none';
    }

    function displayFallbackUI(message) {
        const fallbackDiv = document.getElementById(FALLBACK_UI_DIV_ID);
        if (fallbackDiv) {
            fallbackDiv.innerHTML = `<p>${message}</p><p>Please contact us or <a href="mailto:sales@northwestcustomapparel.com?subject=Quote Request - DTG">email us for a quote</a>.</p>`;
            fallbackDiv.style.display = 'block';
        }
        const errorDiv = document.getElementById(ERROR_MESSAGE_DIV_ID);
        if (errorDiv) errorDiv.style.display = 'none';
    }

    function clearMessages() {
        const errorDiv = document.getElementById(ERROR_MESSAGE_DIV_ID);
        if (errorDiv) errorDiv.style.display = 'none';
        const fallbackDiv = document.getElementById(FALLBACK_UI_DIV_ID);
        if (fallbackDiv) fallbackDiv.style.display = 'none';
    }

    // Processes the Master Bundle received from Caspio
    async function processMasterBundle(masterBundle) {
        console.log('[ADAPTER:DTG] Processing Master Bundle.', masterBundle);
        clearMessages();
        dtgCaspioDataProcessed = true;
        if (dtgCaspioMessageTimeoutId) {
            clearTimeout(dtgCaspioMessageTimeoutId);
            console.log('[ADAPTER:DTG] Cleared Caspio message timeout after receiving master bundle.');
        }

        if (!masterBundle || typeof masterBundle !== 'object') {
            console.error('[ADAPTER:DTG] Invalid or empty master bundle received.');
            displayError('Pricing data is currently unavailable (invalid bundle).');
            return;
        }

        window.dtgMasterPriceBundle = masterBundle; // Store the master bundle globally

        if (masterBundle.hasError) {
            console.error('[ADAPTER:DTG] Master bundle indicates an error from Caspio:', masterBundle.errorMessage);
            displayError(masterBundle.errorMessage || 'An error occurred while fetching pricing information from Caspio.');
            displayFallbackUI(masterBundle.errorMessage || 'An error occurred while fetching pricing information.');
            return;
        }
        
        if (!masterBundle.allLocationPrices || Object.keys(masterBundle.allLocationPrices).length === 0) {
            console.warn('[ADAPTER:DTG] Master bundle received, but allLocationPrices is empty or missing.');
            displayError('No pricing information found for any location in the received data.');
            displayFallbackUI('No pricing information available for this product.');
            return;
        }

        console.log('[ADAPTER:DTG] Master bundle processed successfully.');

        const parentDropdown = document.getElementById('parent-dtg-location-select');
        let initialLocationCode = parentDropdown ? parentDropdown.value : null;

        if (!initialLocationCode && masterBundle.printLocationMeta && masterBundle.printLocationMeta.length > 0) {
            initialLocationCode = masterBundle.printLocationMeta[0].code;
            if (parentDropdown) parentDropdown.value = initialLocationCode;
        }
        
        // Add a small delay to ensure DOM is ready and all data is properly structured
        setTimeout(() => {
            if (initialLocationCode && masterBundle.allLocationPrices[initialLocationCode] !== undefined) {
                displayPricingForSelectedLocation(initialLocationCode);
            } else if (masterBundle.printLocationMeta && masterBundle.printLocationMeta.length > 0) {
                // Fallback if initialLocationCode from dropdown isn't in bundle, or dropdown was empty
                const firstValidLocation = masterBundle.printLocationMeta.find(loc => masterBundle.allLocationPrices[loc.code] !== undefined);
                if (firstValidLocation) {
                    initialLocationCode = firstValidLocation.code;
                    if (parentDropdown) parentDropdown.value = initialLocationCode;
                    displayPricingForSelectedLocation(initialLocationCode);
                } else {
                    console.warn('[ADAPTER:DTG] No valid initial location code with data found in master bundle.');
                    displayError('Pricing data available, but not for the default/selected location. Please choose another.');
                }
            } else {
                console.warn('[ADAPTER:DTG] No initial location code and no locations in bundle meta.');
                displayError('Please select a print location to view pricing.');
            }
        }, 500); // 500ms delay to ensure proper data structure
    }

    async function displayPricingForSelectedLocation(locationCode) {
        console.log(`[ADAPTER:DTG] Displaying pricing for location: ${locationCode}`);
        
        // Show loading state immediately with smooth transition
        showLoadingState();
        
        // Small delay to ensure loading state is visible
        await new Promise(resolve => setTimeout(resolve, 100));
        
        if (!window.dtgMasterPriceBundle || !window.dtgMasterPriceBundle.allLocationPrices) {
            console.error('[ADAPTER:DTG] Master bundle not available to display pricing.');
            displayError('Pricing data is not loaded. Please refresh.');
            if (initialState) initialState.style.display = 'none';
            if (loadingSpinner) loadingSpinner.style.display = 'none';
            if (pricingGrid) pricingGrid.style.display = 'table';
            return;
        }

        const masterBundle = window.dtgMasterPriceBundle;
        const locationPriceProfile = masterBundle.allLocationPrices[locationCode];

        if (locationPriceProfile === null || locationPriceProfile === undefined) { // Check for null if Caspio explicitly sends null for failed locations
            console.warn(`[ADAPTER:DTG] No price profile data found for location '${locationCode}' in master bundle.`);
            const dtgPricingGrid = document.getElementById('custom-pricing-grid'); 
            if (dtgPricingGrid) {
                const tbody = dtgPricingGrid.querySelector('tbody');
                if (tbody) tbody.innerHTML = `<tr><td colspan="100%" style="text-align:center; padding:20px;">Pricing not available for selected location: ${locationCode}.</td></tr>`;
            }
            if (typeof window.clearCartIntegrationUI === 'function') { 
                window.clearCartIntegrationUI();
            }
            // Do not call displayError here if it's an expected "no data for this specific combo"
            // Instead, the grid message should suffice. If it's a global error, processMasterBundle handles it.
            // However, if you want a more prominent error for this specific case:
            // displayError(`Pricing not available for location: ${locationCode}.`);
            return;
        }
        
        clearMessages(); 

        // Ensure tierData is properly structured with all expected tiers
        const ensuredTierData = masterBundle.tierData || {};
        
        // Check and ensure ALL standard DTG tiers are present
        const expectedTiers = {
            '24-47': { MinQuantity: 24, MaxQuantity: 47 },
            '48-71': { MinQuantity: 48, MaxQuantity: 71 },
            '72+': { MinQuantity: 72, MaxQuantity: 99999 }
        };
        
        // Add any missing tiers
        let tiersAdded = false;
        Object.keys(expectedTiers).forEach(tierKey => {
            if (!ensuredTierData[tierKey]) {
                console.warn(`[ADAPTER:DTG] Missing tier '${tierKey}', adding default values`);
                ensuredTierData[tierKey] = expectedTiers[tierKey];
                tiersAdded = true;
            }
        });
        
        if (tiersAdded) {
            console.log('[ADAPTER:DTG] Added missing tiers to ensure complete tier structure');
        }
        
        // Group sizes as requested: S-XL, 2XL, 3XL, 4XL
        const groupedHeaders = [];
        const groupedPrices = {};
        const sizeMapping = {
            'S': 'S-XL',
            'M': 'S-XL',
            'L': 'S-XL',
            'XL': 'S-XL',
            '2XL': '2XL',
            '3XL': '3XL',
            '4XL': '4XL',
            '5XL': '5XL',
            '6XL': '6XL'
        };
        
        // Create grouped headers
        const addedGroups = new Set();
        (masterBundle.uniqueSizes || []).forEach(size => {
            const group = sizeMapping[size] || size;
            if (!addedGroups.has(group)) {
                addedGroups.add(group);
                groupedHeaders.push(group);
            }
        });
        
        // Group prices - use the highest price within each group
        groupedHeaders.forEach(group => {
            groupedPrices[group] = {};
            Object.keys(ensuredTierData).forEach(tierKey => {
                let maxPrice = 0;
                let foundPrice = false;
                
                if (group === 'S-XL') {
                    // For S-XL group, check S, M, L, XL
                    ['S', 'M', 'L', 'XL'].forEach(size => {
                        if (locationPriceProfile[size] && locationPriceProfile[size][tierKey] !== undefined) {
                            const price = parseFloat(locationPriceProfile[size][tierKey]);
                            if (!isNaN(price) && price > maxPrice) {
                                maxPrice = price;
                                foundPrice = true;
                            }
                        }
                    });
                } else {
                    // For individual sizes (2XL, 3XL, 4XL, etc.)
                    if (locationPriceProfile[group] && locationPriceProfile[group][tierKey] !== undefined) {
                        const price = parseFloat(locationPriceProfile[group][tierKey]);
                        if (!isNaN(price)) {
                            maxPrice = price;
                            foundPrice = true;
                        }
                    }
                }
                
                groupedPrices[group][tierKey] = foundPrice ? maxPrice : 0;
            });
        });
        
        console.log('[ADAPTER:DTG] Size grouping applied:', {
            originalHeaders: masterBundle.uniqueSizes,
            groupedHeaders: groupedHeaders,
            samplePrices: groupedPrices['24-47'] || {}
        });
        
        const singleLocationDataPayload = {
            styleNumber: masterBundle.styleNumber,
            color: masterBundle.color,
            embellishmentType: "dtg",
            headers: groupedHeaders,
            prices: groupedPrices,
            tierData: ensuredTierData,
            tiers: ensuredTierData, // Add both for compatibility
            uniqueSizes: masterBundle.uniqueSizes || [], // Keep original for cart functionality
            selectedLocationValue: locationCode,
            productTitle: masterBundle.productTitle || masterBundle.styleNumber,
            capturedAt: new Date().toISOString(),
            hasError: false, // Assuming if we have a profile, it's not an error state for this location
            errorMessage: ""
        };
        
        console.log('[ADAPTER:DTG] Preparing to dispatch pricingDataLoaded with:', {
            headers: singleLocationDataPayload.headers,
            tierKeys: Object.keys(singleLocationDataPayload.tierData),
            uniqueSizes: singleLocationDataPayload.uniqueSizes,
            pricesForFirstSize: singleLocationDataPayload.headers[0] ? singleLocationDataPayload.prices[singleLocationDataPayload.headers[0]] : 'No sizes',
            embellishmentType: singleLocationDataPayload.embellishmentType
        });
        
        window.nwcaPricingData = singleLocationDataPayload;

        // Dispatch on window to match dp5-helper's listener target
        window.dispatchEvent(new CustomEvent('pricingDataLoaded', { detail: singleLocationDataPayload }));
        console.log('[ADAPTER:DTG] Dispatched pricingDataLoaded event ON WINDOW for selected location:', locationCode);

        // TEST: Directly call DP5Helper to see if it's reachable
        if (window.DP5Helper && typeof window.DP5Helper.testListenerReach === 'function') {
            window.DP5Helper.testListenerReach('dtg-adapter after dispatch', singleLocationDataPayload);
        } else {
            console.warn('[ADAPTER:DTG] DP5Helper.testListenerReach not found or not a function!');
        }
        
        // Hide loading spinner and initial state, show table with animation
        const initState = document.getElementById('pricing-initial-state');
        const spinner = document.getElementById('pricing-table-loading');
        const grid = document.getElementById('custom-pricing-grid');
        
        if (initState) initState.style.display = 'none';
        if (spinner) spinner.style.display = 'none';
        if (grid) {
            grid.style.display = 'table';
            // Trigger animation
            setTimeout(() => {
                grid.style.opacity = '1';
                grid.style.transform = 'translateY(0)';
            }, 50);
        }
        
        // Trigger price grouping after displaying pricing (only once per location change)
        if (!window.dtgPriceGroupingScheduled) {
            window.dtgPriceGroupingScheduled = true;
            setTimeout(() => {
                if (window.DTGPriceGroupingV4 && typeof window.DTGPriceGroupingV4.applyPriceGrouping === 'function') {
                    console.log('[ADAPTER:DTG] Triggering price grouping after location data display');
                    window.DTGPriceGroupingV4.applyPriceGrouping();
                }
                window.dtgPriceGroupingScheduled = false;
            }, 2000); // Wait 2 seconds for table to fully render
        }

        if (window.PricingMatrixCapture && typeof window.PricingMatrixCapture.stop === 'function') {
            window.PricingMatrixCapture.stop();
        }

        if (typeof window.initCartIntegrationWithData === 'function') {
            try {
                console.log('[ADAPTER:DTG] Calling initCartIntegrationWithData for location:', locationCode, singleLocationDataPayload);
                await window.initCartIntegrationWithData(singleLocationDataPayload);
                console.log('[ADAPTER:DTG] Cart integration updated for location:', locationCode);
            } catch (cartError) {
                console.error('[ADAPTER:DTG] Error updating cart integration for location:', locationCode, cartError);
                displayFallbackUI('There was an issue preparing the add-to-cart functionality for the selected location.');
            }
        } else {
            console.warn('[ADAPTER:DTG] initCartIntegrationWithData function not found.');
            displayFallbackUI('The add-to-cart functionality is not fully available.');
        }
    }

    function handleCaspioMessage(event) {
        if (event.data && event.data.type === 'caspioDtgMasterBundleReady') {
            // Prevent duplicate processing
            if (dtgProcessingMasterBundle) {
                console.log('[ADAPTER:DTG] Already processing master bundle, ignoring duplicate message');
                return;
            }
            
            console.log('[ADAPTER:DTG] Received caspioDtgMasterBundleReady. Origin:', event.origin);
            const isExpectedOrigin = event.origin === EXPECTED_CASPIO_ORIGIN_1 ||
                                    event.origin === EXPECTED_CASPIO_ORIGIN_2 ||
                                    event.origin === EXPECTED_CASPIO_ORIGIN_3 ||
                                    event.origin === window.location.origin; // Allow same origin as the page
            const isDevelopmentEnv = window.location.hostname === 'localhost';

            if (isExpectedOrigin || isDevelopmentEnv) {
                if (!isExpectedOrigin && isDevelopmentEnv) {
                    console.warn(`[ADAPTER:DTG] MasterBundle from unexpected origin (${event.origin}) but allowing in dev.`);
                }
                console.log(`[ADAPTER:DTG] Processing MasterBundle from origin: ${event.origin}`);
                dtgProcessingMasterBundle = true;
                processMasterBundle(event.data.detail);
                // Reset flag after a delay to allow for legitimate new bundles
                setTimeout(() => {
                    dtgProcessingMasterBundle = false;
                }, 1000);
            } else {
                console.error('[ADAPTER:DTG] MasterBundle from UNEXPECTED origin. Ignoring. Origin:', event.origin);
            }
            return;
        }
        // console.debug('[ADAPTER:DTG] Ignoring message of type:', event.data?.type);
    }

    async function initDTGPricing() {
        console.log("[ADAPTER:DTG] Initializing DTG pricing adapter (Master Bundle)...");
        clearMessages();

        window.addEventListener('message', handleCaspioMessage, false);
        console.log('[ADAPTER:DTG] Added window message listener for Caspio master bundle.');
        
        setupParentLocationSelector();

        dtgCaspioDataProcessed = false;
        resetDtgCaspioMessageTimeout();

        const styleNumber = typeof NWCAUtils !== 'undefined' ? NWCAUtils.getUrlParameter('StyleNumber') : null;
        const colorName = (typeof NWCAUtils !== 'undefined' && NWCAUtils.getUrlParameter('COLOR')) ? decodeURIComponent(NWCAUtils.getUrlParameter('COLOR').replace(/\+/g, ' ')) : null;

        if (!styleNumber) {
            console.error("[ADAPTER:DTG] StyleNumber not found in URL. Cannot initialize DTG context fully.");
            displayError("Product style not specified in URL. Pricing cannot be loaded.");
        }

        console.log(`[ADAPTER:DTG] DTG pricing context: Style: ${styleNumber || 'N/A'}, Color: ${colorName || 'N/A'}`);
        console.log(`[ADAPTER:DTG] Associated AppKey: ${DTG_APP_KEY}`);
        console.log("[ADAPTER:DTG] Waiting for 'caspioDtgMasterBundleReady' event from Caspio page...");
        
        // Show beautiful initial state
        const initialState = document.getElementById('pricing-initial-state');
        const dtgPricingGrid = document.getElementById('custom-pricing-grid');
        const loadingSpinner = document.getElementById('pricing-table-loading');
        
        // Show initial state, hide others
        if (initialState) initialState.style.display = 'block';
        if (loadingSpinner) loadingSpinner.style.display = 'none';
        if (dtgPricingGrid) dtgPricingGrid.style.display = 'none';
    }

    window.DTGAdapter = {
        APP_KEY: DTG_APP_KEY,
        init: initDTGPricing,
        processMasterBundle: processMasterBundle, 
        displayPricingForSelectedLocation: displayPricingForSelectedLocation
    };
    
    const CASPIO_IFRAME_TIMEOUT_DURATION = 15000; // 15 seconds to allow for initial load

    function resetDtgCaspioMessageTimeout() {
        if (dtgCaspioMessageTimeoutId) {
            clearTimeout(dtgCaspioMessageTimeoutId);
        }
        dtgCaspioDataProcessed = false;
        console.log('[ADAPTER:DTG] Setting Caspio message timeout for', CASPIO_IFRAME_TIMEOUT_DURATION / 1000, 'seconds.');
        dtgCaspioMessageTimeoutId = setTimeout(() => {
            if (!dtgCaspioDataProcessed) {
                console.error('[ADAPTER:DTG] Timeout: No master bundle message received from Caspio.');
                // Don't show error immediately - just log it
                // displayError('The pricing module did not respond with complete data. Please refresh or try again later.');
                const dtgPricingGrid = document.getElementById('custom-pricing-grid');
                if (dtgPricingGrid && dtgPricingGrid.style.display !== 'none') {
                    const tbody = dtgPricingGrid.querySelector('tbody');
                    if (tbody && tbody.innerHTML.trim() === '') {
                        tbody.innerHTML = '<tr><td colspan="100%" style="text-align:center; padding:20px;">Please select a print location to view pricing.</td></tr>';
                    }
                }
            }
        }, CASPIO_IFRAME_TIMEOUT_DURATION);
    }

    function setupParentLocationSelector() {
        const parentLocationDropdown = document.getElementById('parent-dtg-location-select');
        if (parentLocationDropdown) {
            // Style the dropdown to make it more prominent
            parentLocationDropdown.style.border = '2px solid #2e5827';
            parentLocationDropdown.style.fontWeight = 'bold';
            parentLocationDropdown.style.backgroundColor = '#f8f9fa';
            parentLocationDropdown.style.padding = '10px';
            parentLocationDropdown.style.fontSize = '1.1em';
            
            window.currentSelectedPrintLocation = parentLocationDropdown.value;
            
            // Add visual indicator for current selection
            updateLocationIndicator(parentLocationDropdown.value);

            parentLocationDropdown.addEventListener('change', function() {
                const selectedValue = this.value;
                console.log('[ADAPTER:DTG] Parent location dropdown changed to:', selectedValue);
                window.currentSelectedPrintLocation = selectedValue;
                
                // Update visual indicator
                updateLocationIndicator(selectedValue);
                
                // Show loading state immediately
                showLoadingState();

                if (window.dtgMasterPriceBundle) {
                    // Add a small delay to show loading state
                    setTimeout(() => {
                        displayPricingForSelectedLocation(selectedValue);
                    }, 300);
                } else {
                    console.warn('[ADAPTER:DTG] Location changed, but master bundle not yet loaded.');
                    const dtgPricingGrid = document.getElementById('custom-pricing-grid');
                    if (dtgPricingGrid) {
                        const tbody = dtgPricingGrid.querySelector('tbody');
                        if (tbody && (!tbody.textContent || tbody.textContent.trim() === "")) {
                           tbody.innerHTML = '<tr><td colspan="100%" style="text-align:center; padding:20px;">Loading pricing data...</td></tr>';
                        }
                    }
                }
            });
            console.log('[ADAPTER:DTG] Event listener added to parent-dtg-location-select.');
        } else {
            console.warn('[ADAPTER:DTG] parent-dtg-location-select dropdown not found.');
        }
    }
    
    function updateLocationIndicator(locationValue) {
        // Update the pricing header to show selected location
        const pricingHeader = document.querySelector('.pricing-header .section-title');
        if (pricingHeader && locationValue) {
            const locationText = document.querySelector(`#parent-dtg-location-select option[value="${locationValue}"]`)?.textContent || locationValue;
            pricingHeader.innerHTML = `Detailed Pricing per Quantity Tier <span style="color: #2e5827; font-size: 0.9em;">(${locationText})</span>`;
        }
        
        // Update dropdown visual state
        const dropdown = document.getElementById('parent-dtg-location-select');
        if (dropdown) {
            dropdown.style.borderColor = '#2e5827';
            dropdown.style.boxShadow = '0 0 5px rgba(46, 88, 39, 0.3)';
        }
    }
    
    // Enhanced loading simulation
    function simulateEnhancedLoading() {
        const loadingSteps = [
            { progress: 20, status: 'Loading your custom pricing...', step: 'Connecting to pricing database...' },
            { progress: 40, status: 'Processing location data...', step: 'Fetching DTG print locations...' },
            { progress: 60, status: 'Calculating pricing tiers...', step: 'Processing quantity discounts...' },
            { progress: 80, status: 'Finalizing your pricing...', step: 'Applying location-specific rates...' },
            { progress: 100, status: 'Complete!', step: 'Your pricing is ready' }
        ];
        
        let currentStep = 0;
        
        const updateProgress = () => {
            if (currentStep >= loadingSteps.length) return;
            
            const step = loadingSteps[currentStep];
            const statusEl = document.getElementById('loading-status');
            const stepEl = document.getElementById('loading-step');
            const progressEl = document.getElementById('loading-progress-bar');
            
            if (statusEl) statusEl.textContent = step.status;
            if (stepEl) stepEl.textContent = step.step;
            if (progressEl) progressEl.style.width = step.progress + '%';
            
            currentStep++;
            
            if (currentStep < loadingSteps.length) {
                setTimeout(updateProgress, 600 + Math.random() * 400);
            }
        };
        
        // Start the simulation
        setTimeout(updateProgress, 500);
    }

    function showLoadingState() {
        console.log('[DTG-ADAPTER] Showing enhanced loading state');
        
        const initialState = document.getElementById('pricing-initial-state');
        const loadingSpinner = document.getElementById('pricing-table-loading');
        const pricingGrid = document.getElementById('custom-pricing-grid');
        
        if (initialState) initialState.style.display = 'none';
        if (loadingSpinner) {
            loadingSpinner.style.display = 'block';
            // Start enhanced loading simulation
            simulateEnhancedLoading();
        }
        if (pricingGrid) {
            pricingGrid.style.opacity = '0';
            pricingGrid.style.transform = 'translateY(20px)';
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initDTGPricing);
    } else {
        initDTGPricing(); 
    }

})();