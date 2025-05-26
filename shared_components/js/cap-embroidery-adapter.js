// shared_components/js/cap-embroidery-adapter.js
console.log("[ADAPTER:CAP-EMB] Cap Embroidery Adapter loaded. V2 with client-side stitch count.");

window.capEmbroideryMasterData = null; // Global storage for cap embroidery pricing data

(function() {
    "use strict";

    const CAP_EMBROIDERY_APP_KEY = 'a0e150004ecd0739f853449c8d7f'; // Keep for reference
    
    // Function to fix the "72-9999" label
    function fixTierLabels() {
        // Use a more aggressive approach to find and fix the label
        const elements = document.querySelectorAll('td, th');
        let found = false;
        
        elements.forEach(function(element) {
            // Check for exact match or contains
            if (element.textContent.trim() === '72-9999' ||
                element.textContent.trim() === '72-99999' ||
                element.textContent.includes('72-9999')) {
                console.log("[ADAPTER:CAP-EMB] Found '72-9999' label, changing to '72+'");
                element.textContent = '72+';
                found = true;
            }
        });
        
        return found;
    }
    
    // Set up a polling mechanism to check for the label every 100ms
    let checkInterval;
    let checkCount = 0;
    const MAX_CHECKS = 50; // 5 seconds max
    
    function startLabelChecker() {
        console.log("[ADAPTER:CAP-EMB] Starting label checker");
        
        // Clear any existing interval
        if (checkInterval) {
            clearInterval(checkInterval);
        }
        
        checkCount = 0;
        
        // Check immediately
        fixTierLabels();
        
        // Then set up interval
        checkInterval = setInterval(function() {
            checkCount++;
            
            // Try to fix labels
            const found = fixTierLabels();
            
            // If we've checked enough times or found and fixed the label, stop checking
            if (checkCount >= MAX_CHECKS) {
                console.log("[ADAPTER:CAP-EMB] Max checks reached, stopping label checker");
                clearInterval(checkInterval);
            }
        }, 100);
    }
    
    // Start the label checker when the page loads
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', startLabelChecker);
    } else {
        startLabelChecker();
    }
    
    // Also start the checker when the Caspio data is loaded
    document.addEventListener('caspioCapPricingCalculated', function() {
        console.log("[ADAPTER:CAP-EMB] Caspio data loaded, starting label checker");
        startLabelChecker();
    });

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
     * Shows a loading indicator while the pricing table is updating
     */
    function showPricingUpdateIndicator() {
        const pricingGrid = document.getElementById('custom-pricing-grid');
        if (!pricingGrid) return;
        
        // Add loading overlay to the pricing grid
        let loadingOverlay = document.getElementById('pricing-loading-overlay');
        if (!loadingOverlay) {
            loadingOverlay = document.createElement('div');
            loadingOverlay.id = 'pricing-loading-overlay';
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
                border-radius: var(--radius-sm);
                font-weight: bold;
                color: var(--primary-color);
                font-size: 1.1em;
            `;
            loadingOverlay.innerHTML = `
                <div style="text-align: center;">
                    <div style="margin-bottom: 8px;">🔄</div>
                    <div>Updating pricing...</div>
                </div>
            `;
            
            // Make sure the pricing grid container is positioned relatively
            const gridContainer = pricingGrid.closest('.pricing-grid-container') || pricingGrid.parentElement;
            if (gridContainer) {
                gridContainer.style.position = 'relative';
                gridContainer.appendChild(loadingOverlay);
            }
        }
        loadingOverlay.style.display = 'flex';
    }

    /**
     * Hides the loading indicator
     */
    function hidePricingUpdateIndicator() {
        const loadingOverlay = document.getElementById('pricing-loading-overlay');
        if (loadingOverlay) {
            loadingOverlay.style.display = 'none';
        }
    }

    /**
     * Shows a brief success message when pricing is updated
     */
    function showPricingUpdateSuccess(stitchCount) {
        const formattedStitchCount = parseInt(stitchCount, 10).toLocaleString();
        
        // Create or update success indicator
        let successIndicator = document.getElementById('pricing-update-success');
        if (!successIndicator) {
            successIndicator = document.createElement('div');
            successIndicator.id = 'pricing-update-success';
            successIndicator.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                background: #28a745;
                color: white;
                padding: 12px 20px;
                border-radius: var(--radius-sm);
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                z-index: 10000;
                font-weight: bold;
                transform: translateX(100%);
                transition: transform 0.3s ease;
            `;
            document.body.appendChild(successIndicator);
        }
        
        successIndicator.innerHTML = `✅ Pricing updated for ${formattedStitchCount} stitches`;
        successIndicator.style.transform = 'translateX(0)';
        
        // Hide after 3 seconds
        setTimeout(() => {
            successIndicator.style.transform = 'translateX(100%)';
        }, 3000);
    }

    /**
     * Updates the table header to clearly show the current stitch count
     */
    function updateTableHeaderWithStitchCount(stitchCount) {
        const formattedStitchCount = parseInt(stitchCount, 10).toLocaleString();
        
        // Update the section title to include stitch count
        const sectionTitle = document.querySelector('.pricing-header .section-title');
        if (sectionTitle) {
            sectionTitle.innerHTML = `Detailed Pricing per Quantity Tier <span style="color: var(--primary-color); font-weight: normal; font-size: 0.9em;">(${formattedStitchCount} stitches)</span>`;
        }
        
        // Add or update a stitch count indicator in the table
        const pricingGrid = document.getElementById('custom-pricing-grid');
        if (pricingGrid) {
            // Add a data attribute to the table for styling purposes
            pricingGrid.setAttribute('data-current-stitch-count', stitchCount);
            
            // Add a subtle indicator to the table caption or create one
            let tableCaption = pricingGrid.querySelector('caption');
            if (!tableCaption) {
                tableCaption = document.createElement('caption');
                tableCaption.style.cssText = `
                    caption-side: top;
                    text-align: center;
                    padding: 8px;
                    background: var(--primary-light);
                    color: var(--primary-color);
                    font-weight: bold;
                    border-radius: var(--radius-sm) var(--radius-sm) 0 0;
                    margin-bottom: 0;
                `;
                pricingGrid.insertBefore(tableCaption, pricingGrid.firstChild);
            }
            tableCaption.textContent = `Current Pricing: ${formattedStitchCount} Stitch Count`;
        }
    }

    /**
     * Updates the custom pricing grid display based on the selected stitch count
     * and the data stored in window.capEmbroideryMasterData.
     */
    function updateCapPricingDisplay() {
        console.log('[ADAPTER:CAP-EMB] updateCapPricingDisplay CALLED. Current window.capEmbroideryMasterData:', window.capEmbroideryMasterData ? JSON.parse(JSON.stringify(window.capEmbroideryMasterData)) : window.capEmbroideryMasterData);
        console.log("[ADAPTER:CAP-EMB] Updating cap pricing display...");
        
        // Show loading indicator
        showPricingUpdateIndicator();
        
        const stitchCountSelect = document.getElementById('client-stitch-count-select');
        if (!stitchCountSelect) {
            console.error("[ADAPTER:CAP-EMB] Stitch count select dropdown (#client-stitch-count-select) not found.");
            hidePricingUpdateIndicator();
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
                
                // Fix for 72+ tier label
                if (tierDefinition && tierDefinition.MinQuantity === 72 &&
                    (tierDefinition.MaxQuantity === 99999 || tierDefinition.MaxQuantity === undefined)) {
                    tdTierLabel.textContent = "72+";
                } else {
                    tdTierLabel.textContent = (tierDefinition && tierDefinition.TierLabel) ? tierDefinition.TierLabel : currentTierKey;
                }

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

        // Update pricing explanation text with current stitch count and back logo info
        const pricingExplanationP = document.querySelector('.pricing-explanation p');
        if (pricingExplanationP) {
            const formattedStitchCount = parseInt(selectedStitchCount, 10).toLocaleString();
            let explanationText = `<strong>Note:</strong> Prices shown are per item and include a ${formattedStitchCount} stitch embroidered logo.`;
            
            // Add back logo information if enabled
            if (window.capEmbroideryBackLogo && window.capEmbroideryBackLogo.isEnabled()) {
                const backLogoStitchCount = window.capEmbroideryBackLogo.getStitchCount();
                const backLogoPrice = window.capEmbroideryBackLogo.getPricePerItem();
                const formattedBackStitchCount = backLogoStitchCount.toLocaleString();
                explanationText = `<strong>Note:</strong> Prices shown are per item and include a ${formattedStitchCount} stitch embroidered logo. <span style="color: var(--primary-color); font-weight: bold;">Back logo (${formattedBackStitchCount} stitches) adds $${backLogoPrice.toFixed(2)} per item.</span>`;
            }
            
            pricingExplanationP.innerHTML = explanationText;
        }
        
        // Update table header to show current stitch count
        updateTableHeaderWithStitchCount(selectedStitchCount);
        
        // Hide loading indicator and show success feedback
        hidePricingUpdateIndicator();
        showPricingUpdateSuccess(selectedStitchCount);
        
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
            
            // Force pricing-matrix-capture.js to use our complete data
            if (typeof capturePricingMatrix === 'function') {
                console.log("[ADAPTER:CAP-EMB] Triggering pricing-matrix-capture to use our complete data");
                // This will use our modified capturePricingMatrix function that prioritizes capEmbroideryMasterData
                const pricingTable = document.querySelector('.matrix-price-table') || document.querySelector('.cbResultSetTable');
                if (pricingTable) {
                    const urlParams = new URLSearchParams(window.location.search);
                    const styleNumber = urlParams.get('StyleNumber');
                    const colorCode = urlParams.get('COLOR');
                    const embType = 'cap-embroidery';
                    if (styleNumber && colorCode) {
                        setTimeout(function() {
                            console.log("[ADAPTER:CAP-EMB] Forcing pricing-matrix-capture to use our complete data");
                            if (typeof capturePricingMatrix === 'function') {
                                capturePricingMatrix(pricingTable, styleNumber, colorCode, embType);
                            }
                        }, 100);
                    }
                }
            }
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
            stitchCountSelect.addEventListener('change', function() {
                // Show immediate feedback on the dropdown
                const indicator = document.getElementById('stitch-count-indicator');
                if (indicator) {
                    indicator.style.opacity = '1';
                    setTimeout(() => {
                        indicator.style.opacity = '0';
                    }, 2000);
                }
                
                // Add visual feedback to the dropdown itself
                stitchCountSelect.style.borderColor = 'var(--primary-color)';
                stitchCountSelect.style.boxShadow = '0 0 0 3px var(--primary-light)';
                
                setTimeout(() => {
                    stitchCountSelect.style.borderColor = '#ddd';
                    stitchCountSelect.style.boxShadow = 'none';
                }, 1000);
                
                // Update the pricing display
                updateCapPricingDisplay();
                
                // Update the window.nwcaPricingData with the new stitch count's pricing
                if (window.capEmbroideryMasterData) {
                    const selectedStitchCount = stitchCountSelect.value;
                    const masterData = window.capEmbroideryMasterData;
                    const pricingDataForStitchCount = masterData.allPriceProfiles[selectedStitchCount];
                    
                    if (pricingDataForStitchCount && window.nwcaPricingData) {
                        console.log(`[ADAPTER:CAP-EMB] Updating window.nwcaPricingData for stitch count ${selectedStitchCount}`);
                        
                        // Update the prices in window.nwcaPricingData
                        const headers = masterData.groupedHeaders || [];
                        const prices = {};
                        
                        headers.forEach(sizeHeader => {
                            prices[sizeHeader] = {};
                            Object.keys(masterData.tierDefinitions).forEach(tierKey => {
                                if (pricingDataForStitchCount[sizeHeader] && pricingDataForStitchCount[sizeHeader][tierKey] !== undefined) {
                                    prices[sizeHeader][tierKey] = pricingDataForStitchCount[sizeHeader][tierKey];
                                }
                            });
                        });
                        
                        // Update the global pricing data
                        window.nwcaPricingData.prices = prices;
                        window.nwcaPricingData.currentStitchCount = selectedStitchCount;
                        
                        console.log("[ADAPTER:CAP-EMB] Updated pricing data:", JSON.stringify(window.nwcaPricingData.prices, null, 2));
                        
                        // Dispatch event to notify other components
                        window.dispatchEvent(new CustomEvent('pricingDataUpdated', {
                            detail: {
                                stitchCount: selectedStitchCount,
                                prices: prices
                            }
                        }));
                    }
                }
                
                // Trigger cart total recalculation to update add to cart prices
                if (window.updateCartTotal && typeof window.updateCartTotal === 'function') {
                    console.log("[ADAPTER:CAP-EMB] Triggering cart total update after stitch count change");
                    window.updateCartTotal();
                } else {
                    console.warn("[ADAPTER:CAP-EMB] updateCartTotal function not available");
                }
            });
            console.log("[ADAPTER:CAP-EMB] Event listener for stitch count dropdown (#client-stitch-count-select) attached.");
            
            // Trigger an initial update with the default selected stitch count
            // This ensures we display complete pricing data on page load
            if (window.capEmbroideryMasterData) {
                console.log("[ADAPTER:CAP-EMB] Master data already available on DOMContentLoaded, triggering initial display update");
                updateCapPricingDisplay();
            } else {
                console.log("[ADAPTER:CAP-EMB] Master data not yet available on DOMContentLoaded, will wait for caspioCapPricingCalculated event");
            }
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
        
        // If master data is already available, trigger an initial display update
        if (window.capEmbroideryMasterData) {
            console.log("[ADAPTER:CAP-EMB] Master data already available in init, triggering display update");
            updateCapPricingDisplay();
        }
    }

    // Expose necessary parts to the global window object
    window.CapEmbroideryAdapter = {
        APP_KEY: CAP_EMBROIDERY_APP_KEY,
        init: initCapEmbroideryPricing, // Expose init if it's called directly or by other scripts
        updateDisplay: updateCapPricingDisplay // Expose for debugging or manual refresh capabilities
    };

})();