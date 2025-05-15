// shared_components/js/cap-embroidery-adapter.js
console.log("[ADAPTER:CAP-EMB] Cap Embroidery Adapter loaded. V2 with client-side stitch count.");

window.capEmbroideryMasterData = null; // Global storage for cap embroidery pricing data

(function() {
    "use strict";

    const CAP_EMBROIDERY_APP_KEY = 'a0e150004ecd0739f853449c8d7f'; // Keep for reference

    /**
     * Formats a numeric price into a string like $X.XX.
     * @param {string|number} price - The price to format.
     * @returns {string} Formatted price string or 'N/A'.
     */
    function formatPrice(price) {
        const num = parseFloat(price);
        if (isNaN(num)) {
            return 'N/A'; // Or return original price, or an empty string
        }
        return '$' + num.toFixed(2);
    }

    /**
     * Updates the custom pricing grid display based on the selected stitch count
     * and the data stored in window.capEmbroideryMasterData.
     */
    function updateCapPricingDisplay() {
        console.log('[ADAPTER:CAP-EMB] updateCapPricingDisplay CALLED. Current window.capEmbroideryMasterData:', window.capEmbroideryMasterData ? JSON.parse(JSON.stringify(window.capEmbroideryMasterData)) : window.capEmbroideryMasterData);
        console.log("[ADAPTER:CAP-EMB] Updating cap pricing display...");
        const stitchCountSelect = document.getElementById('client-stitch-count-select');
        if (!stitchCountSelect) {
            console.error("[ADAPTER:CAP-EMB] Stitch count select dropdown (#client-stitch-count-select) not found.");
            return;
        }
        const selectedStitchCount = stitchCountSelect.value;

        console.log('[ADAPTER:CAP-EMB] updateCapPricingDisplay - Checking masterData.allPriceProfiles:', window.capEmbroideryMasterData ? JSON.stringify(window.capEmbroideryMasterData.allPriceProfiles) : 'undefined/null');
        console.log('[ADAPTER:CAP-EMB] updateCapPricingDisplay - Checking masterData.groupedHeaders:', window.capEmbroideryMasterData ? JSON.stringify(window.capEmbroideryMasterData.groupedHeaders) : 'undefined/null');
        console.log('[ADAPTER:CAP-EMB] updateCapPricingDisplay - Checking masterData.tierDefinitions:', window.capEmbroideryMasterData ? JSON.stringify(window.capEmbroideryMasterData.tierDefinitions) : 'undefined/null');

        if (!window.capEmbroideryMasterData ||
            !window.capEmbroideryMasterData.allPriceProfiles ||
            typeof window.capEmbroideryMasterData.allPriceProfiles !== 'object' ||
            Object.keys(window.capEmbroideryMasterData.allPriceProfiles).length === 0 ||
            !window.capEmbroideryMasterData.groupedHeaders ||
            !Array.isArray(window.capEmbroideryMasterData.groupedHeaders) ||
            window.capEmbroideryMasterData.groupedHeaders.length === 0 ||
            !window.capEmbroideryMasterData.tierDefinitions ||
            typeof window.capEmbroideryMasterData.tierDefinitions !== 'object' ||
            Object.keys(window.capEmbroideryMasterData.tierDefinitions).length === 0) {

            console.error('[ADAPTER:CAP-EMB] Master data validation FAILED in updateCapPricingDisplay. Current Data:', window.capEmbroideryMasterData ? JSON.parse(JSON.stringify(window.capEmbroideryMasterData)) : 'undefined/null');
            const pricingTableBody = document.querySelector('#custom-pricing-grid tbody');
            if (pricingTableBody) {
                const colSpan = document.querySelector('#custom-pricing-grid thead tr th')?.colSpan || (window.capEmbroideryMasterData?.groupedHeaders?.length || 0) + 1;
                pricingTableBody.innerHTML = `<tr><td colspan="${colSpan}">Pricing data is currently unavailable or incomplete. Please try again shortly.</td></tr>`;
            }
            return;
        }

        const masterData = window.capEmbroideryMasterData;
        
        // Attempt to find the pricing data for the selected stitch count.
        // Caspio field names can vary, so check a few common ones for stitch count.
        // Retrieve pricing data directly from masterData.allPriceProfiles,
        // assuming it's an object keyed by stitch count strings (e.g., "5000", "7500")
        // and values are the pricing records (e.g., { "1-11": 10.00, "12-23": 9.50, ... }).
        let pricingDataForStitchCount = masterData.allPriceProfiles[selectedStitchCount];
        // pricingDataForStitchCount is expected to be in the format: { "SIZE_KEY": { "TIER_KEY": price } }
        // e.g., { "OSFA": { "1-23": 10.00, "24-47": 9.50 }, "Youth": { "1-23": 9.00, ... } }
        console.log(`[ADAPTER:CAP-EMB] For stitch count ${selectedStitchCount}, using profile:`, pricingDataForStitchCount ? JSON.parse(JSON.stringify(pricingDataForStitchCount)) : pricingDataForStitchCount);

        const tierDefinitions = masterData.tierDefinitions || {};
        // actualTierKeys: sorted list of keys from tierDefinitions (e.g., "1-23", "24-47")
        const actualTierKeys = Object.keys(tierDefinitions).sort((a, b) => {
            const tierA = tierDefinitions[a];
            const tierB = tierDefinitions[b];
            // Prioritize TierOrder if present and numeric
            if (tierA && typeof tierA.TierOrder !== 'undefined' && tierB && typeof tierB.TierOrder !== 'undefined') {
                const orderA = parseFloat(tierA.TierOrder);
                const orderB = parseFloat(tierB.TierOrder);
                if (!isNaN(orderA) && !isNaN(orderB)) {
                    if (orderA !== orderB) return orderA - orderB;
                }
            }
            // Fallback for basic numeric prefix in tier keys like "1-11", "12-23"
            const numA = parseInt(String(a).split('-')[0], 10);
            const numB = parseInt(String(b).split('-')[0], 10);
            if (!isNaN(numA) && !isNaN(numB) && numA !== numB) {
                return numA - numB;
            }
            return String(a).localeCompare(String(b)); // Final fallback: string comparison
        });

        // sizeHeadersToDisplay: from masterData.groupedHeaders (e.g., ["OSFA", "S/M", "L/XL"])
        const sizeHeadersToDisplay = (masterData.groupedHeaders && Array.isArray(masterData.groupedHeaders)) ? masterData.groupedHeaders : [];

        console.log('[ADAPTER:CAP-EMB] actualTierKeys:', JSON.parse(JSON.stringify(actualTierKeys)));
        console.log('[ADAPTER:CAP-EMB] sizeHeadersToDisplay:', JSON.parse(JSON.stringify(sizeHeadersToDisplay)));
        
        const pricingGrid = document.getElementById('custom-pricing-grid');
        const pricingGridBody = pricingGrid?.getElementsByTagName('tbody')[0];
        const pricingHeaderRow = document.getElementById('pricing-header-row');

        if (!pricingGridBody || !pricingHeaderRow) {
            console.error("[ADAPTER:CAP-EMB] Pricing grid table elements (#custom-pricing-grid tbody or #pricing-header-row) not found.");
            return;
        }

        pricingGridBody.innerHTML = ''; // Clear existing rows

        // Old tierLabels and sizeHeaders definitions are removed as they are replaced by actualTierKeys and sizeHeadersToDisplay

        // Rebuild Table Header (<thead> identified by pricingHeaderRow)
        pricingHeaderRow.innerHTML = ''; // Clear existing headers
        const thTierHeader = document.createElement('th');
        thTierHeader.textContent = 'Tier'; // Or "Quantity"
        pricingHeaderRow.appendChild(thTierHeader);

        if (sizeHeadersToDisplay.length > 0) {
            sizeHeadersToDisplay.forEach(sizeHeader => {
                const th = document.createElement('th');
                th.textContent = sizeHeader;
                pricingHeaderRow.appendChild(th);
            });
        } else {
            console.warn("[ADAPTER:CAP-EMB] No sizeHeadersToDisplay found for table header. Columns might be incomplete.");
            // Optionally add a placeholder if no sizes are available to maintain table structure
            const thPlaceholder = document.createElement('th');
            thPlaceholder.textContent = 'N/A'; // Or 'Sizes not applicable'
            pricingHeaderRow.appendChild(thPlaceholder);
        }

        // Rebuild Table Body (<tbody> identified by pricingTableBody, which is pricingGridBody here)
        if (pricingDataForStitchCount && typeof pricingDataForStitchCount === 'object' && actualTierKeys.length > 0 && sizeHeadersToDisplay.length > 0) {
            actualTierKeys.forEach(currentTierKey => {
                const tr = pricingGridBody.insertRow();

                // First Cell (Tier Label)
                const tdTierLabel = tr.insertCell();
                const tierDefinition = tierDefinitions[currentTierKey];
                tdTierLabel.textContent = (tierDefinition && tierDefinition.TierLabel) ? tierDefinition.TierLabel : currentTierKey;

                // Inner Loop: Iterate through sizeHeadersToDisplay to create price cells
                sizeHeadersToDisplay.forEach(currentSizeKey => {
                    const priceCell = tr.insertCell();
                    let price = undefined;

                    // Price Lookup (CRITICAL)
                    if (pricingDataForStitchCount[currentSizeKey]) {
                        price = pricingDataForStitchCount[currentSizeKey][currentTierKey]; // Use currentTierKey from outer loop
                    }

                    // Console Log (CRITICAL)
                    console.log(`[ADAPTER:CAP-EMB] Stitch: ${selectedStitchCount}, Size: ${currentSizeKey}, Tier: ${currentTierKey}, Price: ${price !== undefined ? formatPrice(price) : price}`);
                    
                    priceCell.textContent = (price !== undefined && price !== null) ? formatPrice(price) : 'N/A';
                });
            });
        } else {
            // Handle cases where data is missing or malformed for table body generation
            let message = `No pricing available for ${selectedStitchCount} stitches.`;
            if (!pricingDataForStitchCount || typeof pricingDataForStitchCount !== 'object' || Object.keys(pricingDataForStitchCount).length === 0) {
                message = `Pricing data structure for ${selectedStitchCount} stitches is missing or invalid.`;
            } else if (actualTierKeys.length === 0) {
                message = `No tier definitions found to create pricing rows for ${selectedStitchCount} stitches.`;
            } else if (sizeHeadersToDisplay.length === 0) {
                message = `No size headers found to create pricing columns for ${selectedStitchCount} stitches.`;
            }
            console.warn(`[ADAPTER:CAP-EMB] ${message}`);
            // Colspan should be 1 (for Tier column) + number of size columns (or 1 if no size columns for placeholder).
            const colSpan = 1 + (sizeHeadersToDisplay.length > 0 ? sizeHeadersToDisplay.length : 1);
            pricingGridBody.innerHTML = `<tr><td colspan="${colSpan}">${message} Please select another option or check data source.</td></tr>`;
        }

        // Update pricing explanation text
        const pricingExplanationP = document.querySelector('.pricing-explanation p');
        if (pricingExplanationP) {
            const formattedStitchCount = parseInt(selectedStitchCount, 10).toLocaleString();
            pricingExplanationP.innerHTML = `<strong>Note:</strong> Prices shown are per item and include a ${formattedStitchCount} stitch embroidered logo.`;
        }
        console.log("[ADAPTER:CAP-EMB] Cap pricing display updated for stitch count:", selectedStitchCount);
    }

    // Listen for the custom event that signals Caspio pricing data is ready
    document.addEventListener('caspioCapPricingCalculated', function(event) {
        if (event.detail && event.detail.success) {
            console.log("[ADAPTER:CAP-EMB] Received 'caspioCapPricingCalculated' event with data:", event.detail);
            window.capEmbroideryMasterData = event.detail;
            console.log('[ADAPTER:CAP-EMB] Master data ASSIGNED in event listener:', window.capEmbroideryMasterData ? JSON.parse(JSON.stringify(window.capEmbroideryMasterData)) : window.capEmbroideryMasterData);
            // Initial population of the table with default stitch count (or currently selected)
            updateCapPricingDisplay();
        } else {
            const errorMessage = event.detail ? event.detail.message : "Unknown error";
            console.error("[ADAPTER:CAP-EMB] Received 'caspioCapPricingCalculated' event with failure:", errorMessage);
            const pricingGridBody = document.getElementById('custom-pricing-grid')?.getElementsByTagName('tbody')[0];
            if (pricingGridBody) {
                 const colspan = (document.getElementById('pricing-header-row')?.children.length || 1);
                 pricingGridBody.innerHTML = `<tr><td colspan="${colspan}">Error loading pricing data: ${errorMessage}</td></tr>`;
            }
        }
    });

    // Set up event listener for the stitch count dropdown once the DOM is loaded
    document.addEventListener('DOMContentLoaded', function() {
        const stitchCountSelect = document.getElementById('client-stitch-count-select');
        if (stitchCountSelect) {
            stitchCountSelect.addEventListener('change', updateCapPricingDisplay);
            console.log("[ADAPTER:CAP-EMB] Event listener for stitch count dropdown (#client-stitch-count-select) attached.");
        } else {
            console.error("[ADAPTER:CAP-EMB] Stitch count select dropdown (#client-stitch-count-select) not found on DOMContentLoaded.");
        }

        // The original initCapEmbroideryPricing function's role is diminished if 'caspioCapPricingCalculated'
        // is the primary trigger after Caspio data is fetched by shared scripts (e.g., pricing-pages.js).
        // It's kept here mainly for exposing APP_KEY or if other legacy parts call it.
    });

    /**
     * Original initialization function. Its primary role might be reduced if Caspio loading
     * and data processing are handled by shared scripts firing events.
     */
    async function initCapEmbroideryPricing() {
        console.log("[ADAPTER:CAP-EMB] Original initCapEmbroideryPricing function called (its role may be limited now).");
        // This function was likely intended to ensure the correct AppKey was known for Caspio loading.
        // If pricing-pages.js or similar handles Caspio loading based on page context and fires
        // 'caspioCapPricingCalculated', this init might not need to do much beyond setup
        // that must happen before data arrives, if any.
        const styleNumber = new URLSearchParams(window.location.search).get('StyleNumber');
         if (!styleNumber) {
             console.warn("[ADAPTER:CAP-EMB] StyleNumber not found in URL during init. Pricing might depend on it being available for Caspio calls.");
         }
    }

    // Expose necessary parts to the global window object
    window.CapEmbroideryAdapter = {
        APP_KEY: CAP_EMBROIDERY_APP_KEY,
        init: initCapEmbroideryPricing, // Expose init if it's called directly or by other scripts
        updateDisplay: updateCapPricingDisplay // Expose for debugging or manual refresh capabilities
    };

})();