// pricing-matrix-capture.js - Captures pricing matrix data from Caspio tables
console.log("[PRICING-MATRIX:LOAD] Pricing matrix capture system loaded (v4 Resilient)");

(function() {
    "use strict";

    // State
    let initialized = false;
    let captureInterval = null;
    let captureAttempts = 0;
    const MAX_CAPTURE_ATTEMPTS = 40; // Further increased attempts (80 seconds)
    const CHECK_INTERVAL_MS = 2000;
    let captureCompleted = false; // Flag to prevent multiple captures/event dispatches
// --- Configuration ---
    // Use the same base URL as other scripts for consistency
    const API_BASE_URL = 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api';

    // --- Helper Function to Save Matrix ---
    async function savePricingMatrixToServer(capturedData) {
        if (!capturedData || !capturedData.styleNumber || !capturedData.color || !capturedData.embellishmentType) {
            console.error("[PRICING-MATRIX:SAVE-ERROR] Invalid or incomplete data provided for saving.");
            return;
        }

        // Check if we're in quote-only mode
        if (window.NWCA && NWCA.config && NWCA.config.features && !NWCA.config.features.cartEnabled) {
            console.log("[PRICING-MATRIX:SAVE] Quote mode active, skipping server save");
            return;
        }
        
        // Also check app config for quote mode
        if (window.NWCA_APP_CONFIG && NWCA_APP_CONFIG.FEATURES && NWCA_APP_CONFIG.FEATURES.QUOTE_MODE) {
            console.log("[PRICING-MATRIX:SAVE] Quote-only workflow detected, skipping pricing matrix server save");
            return;
        }

        // Attempt to get the current SessionID from NWCACart
        let currentSessionId = null;
        if (window.NWCACart && typeof window.NWCACart.getCartState === 'function') {
            currentSessionId = window.NWCACart.getCartState().sessionId;
        }

        if (!currentSessionId) {
             console.error("[PRICING-MATRIX:SAVE-ERROR] Cannot save matrix: SessionID is missing or NWCACart not ready.");
             // Optionally, you could try to initialize the cart here or queue the save,
             // but for now, we'll just prevent the save attempt.
             return;
        }

        const payload = {
            StyleNumber: capturedData.styleNumber,
            Color: capturedData.color, // Use the colorCode passed during capture
            EmbellishmentType: capturedData.embellishmentType,
            PriceMatrix: JSON.stringify(capturedData.prices || {}), // Ensure it's stringified JSON
            SizeGroups: JSON.stringify(capturedData.headers || []), // Ensure it's stringified JSON
            CaptureDate: capturedData.capturedAt || new Date().toISOString(), // Use captured date or now
            SessionID: currentSessionId // Include the SessionID
        };

        console.log("[PRICING-MATRIX:SAVE] Attempting to save pricing matrix to server (with SessionID):", payload);

        try {
            const response = await fetch(`${API_BASE_URL}/pricing-matrix`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error(`[PRICING-MATRIX:SAVE-ERROR] API Error (${response.status}): ${errorText}`);
                throw new Error(`API request failed with status ${response.status}: ${errorText}`);
            }

            const result = await response.json();
            console.log("[PRICING-MATRIX:SAVE-SUCCESS] Pricing matrix saved successfully:", result);
            // Optionally store the returned ID back into the captured data if needed elsewhere
            if (window.nwcaPricingData && result && result.PK_ID) {
                 window.nwcaPricingData.matrixId = result.PK_ID;
                 console.log(`[PRICING-MATRIX:SAVE] Stored matrix ID ${result.PK_ID} in window.nwcaPricingData`);
            }

        } catch (error) {
            console.error("[PRICING-MATRIX:SAVE-ERROR] Failed to save pricing matrix:", error);
            // Decide if you want to notify the user or just log the error
        }
    }

    function initialize() {
        if (initialized) return;
        console.log("[PRICING-MATRIX:INIT] Initializing pricing matrix capture system");
        if (captureInterval) clearInterval(captureInterval);
        captureAttempts = 0;
        captureCompleted = false; // Reset flag on init
        captureInterval = setInterval(checkForPricingData, CHECK_INTERVAL_MS);
        checkForPricingData(); // Initial check
        initialized = true;
    }

    function checkForPricingData() {
        if (captureCompleted) {
            // console.log("[PRICING-MATRIX:CHECK] Capture already completed, stopping interval.");
            if (captureInterval) clearInterval(captureInterval);
            captureInterval = null;
            return;
        }

        captureAttempts++;
        // console.log(`[PRICING-MATRIX:CHECK] Checking for pricing table (Attempt ${captureAttempts}/${MAX_CAPTURE_ATTEMPTS})`);

        const pricingTable = document.querySelector('.matrix-price-table') ||
                            document.querySelector('.cbResultSetTable');

        if (pricingTable) {
            console.log("[PRICING-MATRIX:CHECK] Pricing table found. Attempting capture.");
            const urlParams = new URLSearchParams(window.location.search);
            const styleNumber = urlParams.get('StyleNumber');
            const colorCode = urlParams.get('COLOR'); // Use the raw URL param
            const embType = detectEmbellishmentType(); // Assuming this helper exists in pricing-pages.js

            if (styleNumber && colorCode && embType) {
                const capturedData = capturePricingMatrix(pricingTable, styleNumber, colorCode, embType);
                if (capturedData) {
                    console.log("[PRICING-MATRIX:CHECK] Capture successful. Stopping interval check.");
                    // captureCompleted flag is set inside capturePricingMatrix on success
                    clearInterval(captureInterval);
                    captureInterval = null;
                } else {
                    console.warn("[PRICING-MATRIX:CHECK] Table found, but capture failed. Will retry.");
                }
            } else {
                console.warn("[PRICING-MATRIX:CHECK] Pricing table found, but missing StyleNumber, COLOR, or Embellishment Type.");
            }
        } else if (captureAttempts >= MAX_CAPTURE_ATTEMPTS) {
            console.error(`[PRICING-MATRIX:CHECK] Max attempts (${MAX_CAPTURE_ATTEMPTS}) reached. Pricing table not found. Stopping interval check.`);
            clearInterval(captureInterval);
            captureInterval = null;
            if (!captureCompleted) { // Only dispatch error if not already successful
                 window.dispatchEvent(new CustomEvent('pricingDataError', { detail: { message: 'Pricing table not found after multiple attempts.' } }));
                 // Initialize fallback data if capture fails completely
                 initializeFallbackPricingData(detectEmbellishmentType());
            }
        }
    }

    // Detect embellishment type (copied from pricing-pages.js for self-containment if needed, but assumes it exists globally)
    function detectEmbellishmentType() {
        if (typeof getEmbellishmentTypeFromUrl === 'function') {
            return getEmbellishmentTypeFromUrl();
        }
        // Fallback logic if global function isn't available (less ideal)
        console.warn("[PRICING-MATRIX:DETECT] getEmbellishmentTypeFromUrl not found globally, using fallback detection.");
        const url = window.location.href.toLowerCase(); const titleElement = document.querySelector('h1, h2, title'); const title = titleElement ? titleElement.textContent.toLowerCase() : document.title.toLowerCase(); if (url.includes('cap-embroidery') || title.includes('cap embroidery')) return 'cap-embroidery'; if (url.includes('embroidery') || title.includes('embroidery')) return 'embroidery'; if (url.includes('dtg') || title.includes('dtg')) return 'dtg'; if (url.includes('screen-print') || url.includes('screenprint') || title.includes('screen print')) return 'screen-print'; if (url.includes('dtf') || title.includes('dtf')) return 'dtf'; const matrixTitle = document.getElementById('matrix-title')?.textContent.toLowerCase(); if (matrixTitle) { if (matrixTitle.includes('cap embroidery')) return 'cap-embroidery'; if (matrixTitle.includes('embroidery')) return 'embroidery'; if (matrixTitle.includes('dtg')) return 'dtg'; if (matrixTitle.includes('screen print')) return 'screen-print'; if (matrixTitle.includes('dtf')) return 'dtf'; } console.warn("[PRICING-MATRIX:DETECT-FALLBACK] Could not detect embellishment type, defaulting to 'embroidery'"); return 'embroidery';
    }


    function capturePricingMatrix(pricingTable, styleNumber, colorCode, embType) {
        // Check if we already have complete data from the caspioCapPricingCalculated event
        if (window.capEmbroideryMasterData && embType === 'cap-embroidery') {
            console.log("[PRICING-MATRIX:CAPTURE] Complete cap embroidery data already available from caspioCapPricingCalculated event. Using that instead of capturing from table.");
            
            // Create a compatible data structure from the master data
            const masterData = window.capEmbroideryMasterData;
            const selectedStitchCount = document.getElementById('client-stitch-count-select')?.value || '8000';
            const pricingDataForStitchCount = masterData.allPriceProfiles[selectedStitchCount];
            
            console.log(`[PRICING-MATRIX:CAPTURE] Using stitch count ${selectedStitchCount} for initial capture`);
            
            if (pricingDataForStitchCount) {
                const headers = masterData.groupedHeaders || [];
                const prices = {};
                const tierData = {};
                
                // Convert the data format
                headers.forEach(sizeHeader => {
                    prices[sizeHeader] = {};
                    Object.keys(masterData.tierDefinitions).forEach(tierKey => {
                        if (pricingDataForStitchCount[sizeHeader] && pricingDataForStitchCount[sizeHeader][tierKey] !== undefined) {
                            prices[sizeHeader][tierKey] = pricingDataForStitchCount[sizeHeader][tierKey];
                        }
                        
                        // Copy the tier definition
                        tierData[tierKey] = {...masterData.tierDefinitions[tierKey]};
                        
                        // Add LTM_Fee for tiers under 24 items
                        const minQty = tierData[tierKey].MinQuantity || 0;
                        const maxQty = tierData[tierKey].MaxQuantity;
                        if (minQty > 0 && (maxQty === undefined || maxQty < 24)) {
                            tierData[tierKey].LTM_Fee = 50.00;
                        }
                        
                        // Ensure the tier label is preserved correctly
                        if (tierKey === "72+" || (tierData[tierKey].MinQuantity === 72 &&
                            (tierData[tierKey].MaxQuantity === 99999 || tierData[tierKey].MaxQuantity === undefined))) {
                            // Make sure the label property is set to "72+"
                            tierData[tierKey].label = "72+";
                        }
                    });
                });
                
                window.nwcaPricingData = {
                    styleNumber,
                    color: colorCode,
                    embellishmentType: embType,
                    headers,
                    prices,
                    tierData,
                    uniqueSizes: embType === 'cap-embroidery'
                        ? [...new Set(headers)] // For cap embroidery, use headers directly without filtering slashes
                        : [...new Set(headers.filter(h => !h.includes('-') && !h.includes('/')))],
                    capturedAt: new Date().toISOString(),
                    fromMasterData: true,
                    currentStitchCount: selectedStitchCount
                };
                
                console.log("[PRICING-MATRIX:CAPTURE] Created complete pricing data from master data:", JSON.stringify(window.nwcaPricingData, null, 2));
                captureCompleted = true;
                
                const event = new CustomEvent('pricingDataLoaded', { detail: window.nwcaPricingData });
                window.dispatchEvent(event);
                console.log("[PRICING-MATRIX:CAPTURE] 'pricingDataLoaded' event dispatched with complete data.");
                
                // Call the save function asynchronously
                savePricingMatrixToServer(window.nwcaPricingData);
                
                return window.nwcaPricingData;
            }
        }
        
        if (captureCompleted) {
             console.log("[PRICING-MATRIX:CAPTURE] Capture already completed, skipping redundant capture.");
             return window.nwcaPricingData;
        }
        console.log(`[PRICING-MATRIX:CAPTURE] Capturing data for ${styleNumber}, ${colorCode}, ${embType}`);
        try {
            const headers = [];
            const headerRow = pricingTable.querySelector('tr');
            if (!headerRow) { console.error("[PRICING-MATRIX:CAPTURE-ERROR] Header row not found."); return null; }
            const headerCells = headerRow.querySelectorAll('th');
            if (headerCells.length <= 1) { console.error("[PRICING-MATRIX:CAPTURE-ERROR] Header cells not found/insufficient."); return null; }
            headerCells.forEach((cell, index) => { if (index > 0) headers.push(cell.textContent.trim()); });
            if (headers.length === 0) { console.error("[PRICING-MATRIX:CAPTURE-ERROR] No size headers extracted."); return null; }
            console.log("[PRICING-MATRIX:DEBUG] Setting window.availableSizesFromTable:", headers); // DEBUG LOG
            window.availableSizesFromTable = headers; // Set this early for UI builders

            const priceMatrix = {};
            const tierData = {};
            const dataRows = pricingTable.querySelectorAll('tr:not(:first-child)');
            if (dataRows.length === 0) { console.error("[PRICING-MATRIX:CAPTURE-ERROR] No data rows found."); return null; }

            dataRows.forEach(row => {
                const cells = row.querySelectorAll('td');
                if (cells.length > 1) {
                    const tierText = cells[0].textContent.trim();
                    if (!tierText) return;
                    const parsedTier = parseTierText(tierText);
                    if (parsedTier) {
                        // Ensure the tier label is preserved correctly
                        if (tierText.includes('+') || (parsedTier.MinQuantity === 72 &&
                            (parsedTier.MaxQuantity === 99999 || parsedTier.MaxQuantity === undefined))) {
                            // For tiers like "72+" that have no upper limit or a very high one
                            const tierKey = tierText.includes('+') ? tierText : parsedTier.MinQuantity + "+";
                            tierData[tierKey] = parsedTier;
                            // Also set the label property to ensure it displays correctly
                            tierData[tierKey].label = tierKey;
                        } else {
                            tierData[tierText] = parsedTier;
                        }
                    }
                    for (let i = 1; i < cells.length; i++) {
                        if (i - 1 < headers.length) {
                            const size = headers[i - 1];
                            const priceText = cells[i].textContent.trim();
                            const price = parseFloat(priceText.replace(/[$,]/g, ''));
                            if (!isNaN(price)) {
                                if (!priceMatrix[size]) priceMatrix[size] = {};
                                priceMatrix[size][tierText] = price;
                            } else {
                                console.warn(`[PRICING-MATRIX:CAPTURE] Could not parse price "${priceText}" for Size: ${size}, Tier: ${tierText}`);
                            }
                        }
                    }
                }
            });
            
            // For DTG, check if we have all expected tiers
            if (embType === 'dtg') {
                const expectedDTGTiers = ['24-47', '48-71', '72+'];
                const capturedTierKeys = Object.keys(tierData);
                const missingTiers = expectedDTGTiers.filter(tier => !capturedTierKeys.includes(tier));
                
                if (missingTiers.length > 0) {
                    console.warn(`[PRICING-MATRIX:CAPTURE] DTG pricing missing expected tiers: ${missingTiers.join(', ')}. Table may not be fully loaded yet.`);
                    // Return null to trigger retry
                    return null;
                }
            }

             if (Object.keys(priceMatrix).length === 0 || Object.keys(tierData).length === 0) {
                 console.error("[PRICING-MATRIX:CAPTURE-ERROR] Failed to extract valid price matrix or tier data.");
                 return null;
             }

            console.log("[PRICING-MATRIX:DEBUG] Preparing to set window.nwcaPricingData"); // DEBUG LOG
            window.nwcaPricingData = {
                styleNumber, color: colorCode, embellishmentType: embType,
                headers, prices: priceMatrix, tierData,
                uniqueSizes: embType === 'cap-embroidery'
                    ? [...new Set(headers)] // For cap embroidery, use headers directly without filtering slashes
                    : [...new Set(headers.filter(h => !h.includes('-') && !h.includes('/')))],
                capturedAt: new Date().toISOString()
            };

            console.log("[PRICING-MATRIX:CAPTURE] Data captured successfully. Value:", JSON.stringify(window.nwcaPricingData, null, 2)); // DEBUG LOG (Stringified)
            captureCompleted = true; // Set flag *after* successful capture and data assignment

            const event = new CustomEvent('pricingDataLoaded', { detail: window.nwcaPricingData });
            console.log("[PRICING-MATRIX:DEBUG] Dispatching 'pricingDataLoaded' event."); // DEBUG LOG
            window.dispatchEvent(event);
            console.log("[PRICING-MATRIX:CAPTURE] 'pricingDataLoaded' event dispatched.");
// Call the save function asynchronously after dispatching the event
            savePricingMatrixToServer(window.nwcaPricingData);

            return window.nwcaPricingData;

        } catch (error) {
            console.error("[PRICING-MATRIX:CAPTURE-ERROR] Error during capture:", error);
            console.log("[PRICING-MATRIX:DEBUG] Setting pricing data to null due to error."); // DEBUG LOG
            window.nwcaPricingData = null; window.availableSizesFromTable = null;
            window.dispatchEvent(new CustomEvent('pricingDataError', { detail: { message: 'Error capturing pricing data.', error: error } }));
            return null;
        }
    }

    function parseTierText(tierText) {
        if (!tierText) return null; let minQuantity = 0; let maxQuantity = undefined; let ltmFee = 0; const rangeMatch = tierText.match(/^(\d+)\s*-\s*(\d+)$/); const plusMatch = tierText.match(/^(\d+)\s*\+$/); const singleMatch = tierText.match(/^(\d+)$/); if (rangeMatch) { minQuantity = parseInt(rangeMatch[1], 10); maxQuantity = parseInt(rangeMatch[2], 10); } else if (plusMatch) { minQuantity = parseInt(plusMatch[1], 10); maxQuantity = undefined; } else if (singleMatch) { minQuantity = parseInt(singleMatch[1], 10); if (minQuantity === 1) maxQuantity = 11; } else { console.warn(`[PRICING-MATRIX:PARSE-TIER] Could not parse tier text: "${tierText}"`); return null; } if (minQuantity > 0 && (maxQuantity === undefined || maxQuantity < 24)) { ltmFee = 50.00; } return { MinQuantity: minQuantity, MaxQuantity: maxQuantity, LTM_Fee: ltmFee > 0 ? ltmFee : undefined };
    }

    // Fallback data initialization (called if capture fails after max attempts)
    function initializeFallbackPricingData(embType) {
        if (window.nwcaPricingData || captureCompleted) return; // Don't overwrite if data was captured
        console.warn(`[PRICING-MATRIX] Initializing FALLBACK pricing data for ${embType}.`);
        let headers = ['S-XL', '2XL', '3XL']; let prices = { 'S-XL': { 'Tier1': 20.00, 'Tier2': 19.00, 'Tier3': 18.00, 'Tier4': 17.00 }, '2XL': { 'Tier1': 22.00, 'Tier2': 21.00, 'Tier3': 20.00, 'Tier4': 19.00 }, '3XL': { 'Tier1': 23.00, 'Tier2': 22.00, 'Tier3': 21.00, 'Tier4': 20.00 }, }; let tiers = { 'Tier1': { 'MinQuantity': 1, 'MaxQuantity': 11, LTM_Fee: 50 }, 'Tier2': { 'MinQuantity': 12, 'MaxQuantity': 23, LTM_Fee: 25 }, 'Tier3': { 'MinQuantity': 24, 'MaxQuantity': 47 }, 'Tier4': { 'MinQuantity': 48, 'MaxQuantity': 71 }, 'Tier5': { 'MinQuantity': 72, 'MaxQuantity': 10000 }, }; let uniqueSizes = ['S', 'M', 'L', 'XL', '2XL', '3XL']; if (embType === 'cap-embroidery') { headers = ['One Size']; prices = { 'One Size': { 'Tier1': 22.99, 'Tier2': 21.99, 'Tier3': 20.99, 'Tier4': 19.99, 'Tier5': 18.99 } }; uniqueSizes = ['OS']; }
        window.nwcaPricingData = { styleNumber: window.selectedStyleNumber || 'FALLBACK', color: window.selectedColorName || 'FALLBACK', embellishmentType: embType, headers: headers, prices: prices, tierData: tiers, uniqueSizes: uniqueSizes, capturedAt: new Date().toISOString(), isFallback: true };
        window.availableSizesFromTable = headers;
        console.log('PricingPages: Fallback pricing global variables initialized.', JSON.stringify(window.nwcaPricingData, null, 2)); // DEBUG LOG (Stringified)
        // Dispatch event so other components know data (even fallback) is ready
        console.log("[PRICING-MATRIX:DEBUG] Dispatching 'pricingDataLoaded' event (Fallback)."); // DEBUG LOG
        window.dispatchEvent(new CustomEvent('pricingDataLoaded', { detail: window.nwcaPricingData }));
        captureCompleted = true; // Mark as completed even with fallback
    }


     if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        initialize();
    }

    window.PricingMatrixCapture = {
        getCurrentData: () => window.nwcaPricingData
    };

})();