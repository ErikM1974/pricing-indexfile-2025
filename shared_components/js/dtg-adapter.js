// shared_components/js/dtg-adapter.js
console.log("[ADAPTER:DTG] DTG Adapter loaded. Version 2 (Event-Driven).");

(function() {
    "use strict";

    const DTG_APP_KEY = 'a0e150002eb9491a50104c1d99d7'; // DTG Specific AppKey
    const PRICING_CONTAINER_ID = 'pricing-calculator'; // Standard container ID

    // Listen for the custom event from Caspio DataPage
    document.addEventListener('caspioDtgDataReady', function(event) {
        console.log('[ADAPTER:DTG] Received caspioDtgDataReady event.', event.detail);
        if (event.detail) {
            window.nwcaPricingData = event.detail; // Set the global variable our other scripts expect
            
            // Dispatch the standard event that dp5-helper and add-to-cart listen for
            document.dispatchEvent(new CustomEvent('pricingDataLoaded', { detail: window.nwcaPricingData }));
            console.log('[ADAPTER:DTG] Dispatched pricingDataLoaded event with Caspio-sourced DTG data.');

            // Optionally, disable the original pricing-matrix-capture.js for this page type if it's still trying to run
            if (window.PricingMatrixCapture && typeof window.PricingMatrixCapture.stop === 'function') {
                console.log('[ADAPTER:DTG] Attempting to stop generic PricingMatrixCapture.');
                try {
                    window.PricingMatrixCapture.stop();
                    console.log('[ADAPTER:DTG] Successfully called PricingMatrixCapture.stop().');
                } catch (e) {
                    console.error('[ADAPTER:DTG] Error calling PricingMatrixCapture.stop():', e);
                }
            }
        } else {
            console.error('[ADAPTER:DTG] caspioDtgDataReady event received, but no detail (data) found.');
        }
    });

    async function initDTGPricing() {
        console.log("[ADAPTER:DTG] Initializing DTG pricing (now primarily event-driven)...");

        // getUrlParameter is expected to be globally available via NWCAUtils
        const styleNumber = typeof NWCAUtils !== 'undefined' ? NWCAUtils.getUrlParameter('StyleNumber') : null;
        const colorName = (typeof NWCAUtils !== 'undefined' && NWCAUtils.getUrlParameter('COLOR')) ? decodeURIComponent(NWCAUtils.getUrlParameter('COLOR').replace(/\+/g, ' ')) : null;

        if (!styleNumber) {
            console.error("[ADAPTER:DTG] StyleNumber not found in URL. Cannot initialize DTG context fully.");
            // No longer directly manipulating DOM here as pricing data comes via event.
            // Error display for missing style can be handled by the page or Caspio itself.
        }

        console.log(`[ADAPTER:DTG] DTG pricing context: Style: ${styleNumber || 'N/A'}, Color: ${colorName || 'N/A'}`);
        console.log(`[ADAPTER:DTG] Associated AppKey: ${DTG_APP_KEY}`);
        console.log("[ADAPTER:DTG] Waiting for 'caspioDtgDataReady' event from Caspio page to load pricing data...");
        
        // The actual Caspio DataPage load is typically triggered by other scripts (e.g., pricing-pages.js or direct embed)
        // This adapter now primarily focuses on receiving and processing the data once Caspio makes it available.
    }

    window.DTGAdapter = {
        APP_KEY: DTG_APP_KEY,
        init: initDTGPricing
    };

})();