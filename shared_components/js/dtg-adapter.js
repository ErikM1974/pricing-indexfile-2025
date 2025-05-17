// shared_components/js/dtg-adapter.js
console.log("[ADAPTER:DTG] DTG Adapter loaded. Master Bundle Version.");

(function() {
    "use strict";

    let dtgCaspioMessageTimeoutId = null;
    let dtgCaspioDataProcessed = false;  // Indicates if any valid message from Caspio was processed
    window.dtgMasterPriceBundle = null; // To store the master bundle from Caspio
    window.currentSelectedPrintLocation = ""; // Useful for knowing the dropdown's state

    const DTG_APP_KEY = 'a0e150002eb9491a50104c1d99d7'; // DTG Specific AppKey
    const ERROR_MESSAGE_DIV_ID = 'caspio-dtg-error-message';
    const FALLBACK_UI_DIV_ID = 'cart-fallback-ui';
    const EXPECTED_CASPIO_ORIGIN_1 = 'https://c3eku948.caspio.com'; // Primary Caspio domain
    const EXPECTED_CASPIO_ORIGIN_2 = 'https://nwcustom.caspio.com'; // Custom Caspio domain

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
    }

    async function displayPricingForSelectedLocation(locationCode) {
        console.log(`[ADAPTER:DTG] Displaying pricing for location: ${locationCode}`);
        if (!window.dtgMasterPriceBundle || !window.dtgMasterPriceBundle.allLocationPrices) {
            console.error('[ADAPTER:DTG] Master bundle not available to display pricing.');
            displayError('Pricing data is not loaded. Please refresh.');
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

        const singleLocationDataPayload = {
            styleNumber: masterBundle.styleNumber,
            color: masterBundle.color,
            embellishmentType: "dtg",
            headers: masterBundle.uniqueSizes || [], 
            prices: locationPriceProfile,          
            tierData: masterBundle.tierData,
            uniqueSizes: masterBundle.uniqueSizes || [], 
            selectedLocationValue: locationCode,
            productTitle: masterBundle.productTitle || masterBundle.styleNumber, 
            capturedAt: new Date().toISOString(),
            hasError: false, // Assuming if we have a profile, it's not an error state for this location
            errorMessage: ""
        };
        
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
            console.log('[ADAPTER:DTG] Received caspioDtgMasterBundleReady. Origin:', event.origin);
            const isExpectedOrigin = event.origin === EXPECTED_CASPIO_ORIGIN_1 || event.origin === EXPECTED_CASPIO_ORIGIN_2;
            const isDevelopmentEnv = window.location.hostname === 'localhost';

            if (isExpectedOrigin || isDevelopmentEnv) {
                if (!isExpectedOrigin && isDevelopmentEnv) {
                    console.warn(`[ADAPTER:DTG] MasterBundle from unexpected origin (${event.origin}) but allowing in dev.`);
                }
                processMasterBundle(event.data.detail);
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
    }

    window.DTGAdapter = {
        APP_KEY: DTG_APP_KEY,
        init: initDTGPricing,
        processMasterBundle: processMasterBundle, 
        displayPricingForSelectedLocation: displayPricingForSelectedLocation
    };
    
    const CASPIO_IFRAME_TIMEOUT_DURATION = 25000; 

    function resetDtgCaspioMessageTimeout() {
        if (dtgCaspioMessageTimeoutId) {
            clearTimeout(dtgCaspioMessageTimeoutId);
        }
        dtgCaspioDataProcessed = false;
        console.log('[ADAPTER:DTG] Setting Caspio message timeout for', CASPIO_IFRAME_TIMEOUT_DURATION / 1000, 'seconds.');
        dtgCaspioMessageTimeoutId = setTimeout(() => {
            if (!dtgCaspioDataProcessed) {
                console.error('[ADAPTER:DTG] Timeout: No master bundle message received from Caspio.');
                displayError('The pricing module did not respond with complete data. Please refresh or try again later.');
                const dtgPricingGrid = document.getElementById('custom-pricing-grid');
                if (dtgPricingGrid) {
                    const tbody = dtgPricingGrid.querySelector('tbody');
                    if (tbody) tbody.innerHTML = '<tr><td colspan="100%" style="text-align:center; padding:20px; color:red;">Failed to load pricing data.</td></tr>';
                }
            }
        }, CASPIO_IFRAME_TIMEOUT_DURATION);
    }

    function setupParentLocationSelector() {
        const parentLocationDropdown = document.getElementById('parent-dtg-location-select');
        if (parentLocationDropdown) {
            window.currentSelectedPrintLocation = parentLocationDropdown.value; 

            parentLocationDropdown.addEventListener('change', function() {
                const selectedValue = this.value;
                console.log('[ADAPTER:DTG] Parent location dropdown changed to:', selectedValue);
                window.currentSelectedPrintLocation = selectedValue; 

                if (window.dtgMasterPriceBundle) { 
                    displayPricingForSelectedLocation(selectedValue);
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

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initDTGPricing);
    } else {
        initDTGPricing(); 
    }

})();