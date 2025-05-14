// shared_components/js/cap-embroidery-adapter.js
console.log("[ADAPTER:CAP-EMB] Cap Embroidery Adapter loaded.");

(function() {
    "use strict";

    const CAP_EMBROIDERY_APP_KEY = 'a0e150004ecd0739f853449c8d7f';
    const PRICING_CONTAINER_ID = 'pricing-calculator'; // Standard container ID

    /**
     * Initializes the Cap Embroidery pricing data retrieval and processing.
     * This function will be called by the cap-embroidery-pricing.html page.
     */
    async function initCapEmbroideryPricing() {
        console.log("[ADAPTER:CAP-EMB] Initializing Cap Embroidery pricing...");

        const styleNumber = getUrlParameter('StyleNumber');
        const colorName = getUrlParameter('COLOR') ? decodeURIComponent(getUrlParameter('COLOR').replace(/\+/g, ' ')) : null;

        if (!styleNumber) {
            console.error("[ADAPTER:CAP-EMB] StyleNumber not found in URL. Cannot load pricing.");
            // Display error to user on the page
            const container = document.getElementById(PRICING_CONTAINER_ID);
            if (container) {
                container.innerHTML = "<p style='color:red; font-weight:bold;'>Error: Product style information is missing. Cannot load pricing.</p>";
            }
            return;
        }

        // The pricing-pages.js (now shared) should handle the Caspio loading via tryLoadCaspioSequentially
        // We need to ensure that the correct appKey and containerId are used.
        // The shared pricing-pages.js already has a getEmbellishmentTypeFromUrl function.
        // We might need to ensure it correctly identifies 'cap-embroidery' and uses CAP_EMBROIDERY_APP_KEY.

        // For now, this adapter's main role is to ensure the correct AppKey is known.
        // The actual data fetching and parsing is largely handled by pricing-matrix-capture.js
        // and the processing by pricing-calculator.js.
        // This adapter could be expanded to transform data if the Caspio output for caps is significantly different.

        console.log(`[ADAPTER:CAP-EMB] Cap Embroidery pricing initialization for Style: ${styleNumber}, Color: ${colorName}`);
        console.log(`[ADAPTER:CAP-EMB] Associated AppKey: ${CAP_EMBROIDERY_APP_KEY}`);

        // The shared pricing-pages.js script, when included in cap-embroidery-pricing.html,
        // should pick up the 'cap-embroidery' type from the URL (if URL is structured like /cap-embroidery-pricing.html)
        // or we might need a way to explicitly tell it the embellishment type if the URL isn't distinct enough.

        // If pricing-pages.js's getEmbellishmentTypeFromUrl() correctly identifies 'cap-embroidery',
        // it will use the CASPIO_APP_KEYS['cap-embroidery'] which we've confirmed.
        // No specific action needed here for *triggering* the load if pricing-pages.js is correctly configured.
    }

    // Expose an initialization function if needed, or rely on pricing-pages.js to drive.
    // For now, let's assume pricing-pages.js will handle the main sequence.
    // This adapter primarily serves as a configuration point and potential data transformer.

    // Example of how it might be called if cap-embroidery-pricing.html had a specific init script:
    // document.addEventListener('DOMContentLoaded', initCapEmbroideryPricing);

    // Make AppKey available if other scripts need to reference it specifically for caps
    window.CapEmbroideryAdapter = {
        APP_KEY: CAP_EMBROIDERY_APP_KEY,
        init: initCapEmbroideryPricing // Expose init if direct call is preferred
    };

})();