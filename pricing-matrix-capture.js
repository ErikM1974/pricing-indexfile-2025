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
        if (captureCompleted) {
             console.log("[PRICING-MATRIX:CAPTURE] Capture already completed, skipping redundant capture.");
             return window.nwcaPricingData;
        }
        console.log(`[PRICING-MATRIX:CAPTURE] Capturing data for ${styleNumber}, ${colorCode}, ${embType}`);
        try {
            // --- CAP EMBROIDERY: Use Master Data if available ---
            if (embType === 'cap-embroidery' && window.capEmbroideryMasterData) {
                console.log("[PRICING-MATRIX:CAPTURE-DEBUG] Entered cap master data path. Raw masterData:", JSON.stringify(window.capEmbroideryMasterData));
                const masterData = window.capEmbroideryMasterData;

                if (!masterData.success) { // Check for success property
                    console.warn("[PRICING-MATRIX:CAPTURE-WARN] masterData.success is not true or is missing. masterData.success value:", masterData.success);
                    // If not successful, or critical data is missing, fall through to table scraping.
                    if (!masterData.allPriceProfiles || !masterData.groupedHeaders) {
                         console.error("[PRICING-MATRIX:CAPTURE-ERROR] masterData is not successful or missing critical properties (allPriceProfiles, groupedHeaders). Will attempt table scrape.");
                         // By not returning null here, it will fall through to the table scraping logic below.
                    } else {
                        // It's not "success:true" but has profiles and headers, maybe proceed with caution?
                        // For now, let's be strict: if not success:true, we'd ideally fall through.
                        // However, the original log "Complete cap embroidery data already available" implies we should use it.
                        // This path is tricky. Let's assume if we are here, we try to use it.
                        console.warn("[PRICING-MATRIX:CAPTURE-WARN] masterData.success is not true, but attempting to proceed as allPriceProfiles and groupedHeaders might exist.");
                    }
                }
                
                // Ensure allPriceProfiles exists before trying to access it
                if (!masterData.allPriceProfiles) {
                    console.error("[PRICING-MATRIX:CAPTURE-ERROR] masterData.allPriceProfiles is missing. Cannot use master data path. Will attempt table scrape.");
                    // Fall through by not returning null. The table scraping logic will be attempted.
                } else {
                    // This is the main execution block for master data if allPriceProfiles exists
                    const stitchCountElement = document.getElementById('client-stitch-count-select');
                    const currentStitchCount = stitchCountElement ? stitchCountElement.value : (masterData.currentStitchCount || '8000');
                    const pricesForStitchCount = masterData.allPriceProfiles[currentStitchCount];

                    if (!pricesForStitchCount) {
                        console.error(`[PRICING-MATRIX:CAPTURE-ERROR] No price profile found for stitch count ${currentStitchCount} in master data.`);
                        window.dispatchEvent(new CustomEvent('pricingDataError', { detail: { message: `No price profile for stitch count ${currentStitchCount}.` } }));
                        return null; // Critical error, cannot proceed
                    }

                    // Original detailed logging for uniqueSizes derivation starts here
                    // Directly derive masterHeaders and masterUniqueSizes from masterData
                    // Prioritize groupedHeaders, then headers. If both are problematic, it will be an empty array.
                    let masterHeaders = (Array.isArray(masterData.groupedHeaders) && masterData.groupedHeaders.length > 0)
                                        ? masterData.groupedHeaders
                                        : (Array.isArray(masterData.headers) ? masterData.headers : []);
                    console.log("[PRICING-MATRIX:DEBUG-MASTER] Initial masterHeaders from masterData:", JSON.stringify(masterHeaders));
                    let masterUniqueSizes = Array.isArray(masterData.uniqueSizes) ? masterData.uniqueSizes : [];
                    console.log("[PRICING-MATRIX:DEBUG-MASTER] Initial masterUniqueSizes from masterData:", JSON.stringify(masterUniqueSizes));

                    if (masterUniqueSizes.length === 0 && masterHeaders.length > 0) {
                        masterUniqueSizes = [...new Set(masterHeaders)];
                        console.log("[PRICING-MATRIX:DEBUG-MASTER] Derived masterUniqueSizes directly from masterHeaders:", JSON.stringify(masterUniqueSizes));
                    } else {
                        // Fallback: if masterHeaders is empty, try to get sizes from price keys if masterData.uniqueSizes is also empty
                        const initialMasterUniqueSizes = Array.isArray(masterData.uniqueSizes) ? masterData.uniqueSizes : [];
                        if (initialMasterUniqueSizes.length === 0 && pricesForStitchCount && typeof pricesForStitchCount === 'object') {
                            masterHeaders = Object.keys(pricesForStitchCount); // These are the size keys like "S/M"
                            masterUniqueSizes = [...new Set(masterHeaders)];
                            console.warn("[PRICING-MATRIX:CAPTURE-MASTER-FALLBACK] masterHeaders was empty, derived masterUniqueSizes from price keys:", JSON.stringify(masterUniqueSizes));
                        } else {
                            masterUniqueSizes = initialMasterUniqueSizes; // Use whatever was in masterData.uniqueSizes (likely empty)
                            console.warn("[PRICING-MATRIX:CAPTURE-MASTER-FALLBACK] masterHeaders empty, and could not derive from price keys or masterData.uniqueSizes was already set. masterUniqueSizes:", JSON.stringify(masterUniqueSizes));
                        }
                    }

                    if (masterUniqueSizes.length === 0) {
                        console.error("[PRICING-MATRIX:CAPTURE-ERROR] CRITICAL: Could not determine unique sizes for cap embroidery from master data. masterHeaders:", JSON.stringify(masterHeaders), "masterData.uniqueSizes:", JSON.stringify(masterData.uniqueSizes));
                        window.dispatchEvent(new CustomEvent('pricingDataError', { detail: { message: 'Could not determine unique sizes for cap pricing from master data.' } }));
                        return null; // Critical error, cannot proceed
                    }
                    
                    window.availableSizesFromTable = masterHeaders; // Make headers available
                    
                    console.log("[PRICING-MATRIX:DEBUG] Before assigning to nwcaPricingData (master data path) - masterUniqueSizes:", JSON.stringify(masterUniqueSizes), "masterHeaders:", JSON.stringify(masterHeaders));

                    window.nwcaPricingData = {
                        styleNumber: styleNumber,
                        color: colorCode,
                        embellishmentType: embType,
                        headers: masterHeaders,
                        prices: pricesForStitchCount,
                        tierData: masterData.tierDefinitions || {},
                        uniqueSizes: masterUniqueSizes,
                        capturedAt: new Date().toISOString(),
                        fromMasterData: true,
                        currentStitchCount: currentStitchCount,
                        tiers: masterData.tierDefinitions || {}
                    };
                    console.log("[PRICING-MATRIX:CAPTURE] Created pricing data from MASTER DATA:", JSON.stringify(window.nwcaPricingData, null, 2));
                    captureCompleted = true;
                    window.dispatchEvent(new CustomEvent('pricingDataLoaded', { detail: window.nwcaPricingData }));
                    console.log("[PRICING-MATRIX:CAPTURE] 'pricingDataLoaded' event dispatched (from master data).");
                    savePricingMatrixToServer(window.nwcaPricingData);
                    return window.nwcaPricingData;
                } // End of if (masterData.allPriceProfiles)
                const stitchCountElement = document.getElementById('client-stitch-count-select');
                const currentStitchCount = stitchCountElement ? stitchCountElement.value : (masterData.currentStitchCount || '8000');
                
                const pricesForStitchCount = masterData.allPriceProfiles?.[currentStitchCount];
                if (!pricesForStitchCount) {
                    console.error(`[PRICING-MATRIX:CAPTURE-ERROR] No price profile found for stitch count ${currentStitchCount} in master data.`);
                    window.dispatchEvent(new CustomEvent('pricingDataError', { detail: { message: `No price profile for stitch count ${currentStitchCount}.` } }));
                    return null;
                }

                // Directly derive masterHeaders and masterUniqueSizes from masterData
                // Prioritize groupedHeaders, then headers. If both are problematic, it will be an empty array.
                let masterHeaders = (Array.isArray(masterData.groupedHeaders) && masterData.groupedHeaders.length > 0)
                                    ? masterData.groupedHeaders
                                    : (Array.isArray(masterData.headers) ? masterData.headers : []);
                
                let masterUniqueSizes = [];
                if (masterHeaders.length > 0) {
                    masterUniqueSizes = [...new Set(masterHeaders)];
                    console.log("[PRICING-MATRIX:DEBUG-MASTER] Derived masterUniqueSizes directly from masterHeaders:", JSON.stringify(masterUniqueSizes));
                } else {
                    // Fallback: if masterHeaders is empty, try to get sizes from price keys if masterData.uniqueSizes is also empty
                    const initialMasterUniqueSizes = Array.isArray(masterData.uniqueSizes) ? masterData.uniqueSizes : [];
                    if (initialMasterUniqueSizes.length === 0 && pricesForStitchCount && typeof pricesForStitchCount === 'object') {
                        masterHeaders = Object.keys(pricesForStitchCount); // These are the size keys like "S/M"
                        masterUniqueSizes = [...new Set(masterHeaders)];
                        console.warn("[PRICING-MATRIX:CAPTURE-MASTER-FALLBACK] masterHeaders was empty, derived masterUniqueSizes from price keys:", JSON.stringify(masterUniqueSizes));
                    } else {
                        masterUniqueSizes = initialMasterUniqueSizes; // Use whatever was in masterData.uniqueSizes (likely empty)
                        console.warn("[PRICING-MATRIX:CAPTURE-MASTER-FALLBACK] masterHeaders empty, and could not derive from price keys or masterData.uniqueSizes was already set. masterUniqueSizes:", JSON.stringify(masterUniqueSizes));
                    }
                }

                if (masterUniqueSizes.length === 0) {
                    console.error("[PRICING-MATRIX:CAPTURE-ERROR] CRITICAL: Could not determine unique sizes for cap embroidery from master data. masterHeaders:", JSON.stringify(masterHeaders), "masterData.uniqueSizes:", JSON.stringify(masterData.uniqueSizes));
                    window.dispatchEvent(new CustomEvent('pricingDataError', { detail: { message: 'Could not determine unique sizes for cap pricing from master data.' } }));
                    return null;
                }
                
                window.availableSizesFromTable = masterHeaders; // Make headers available
                
                console.log("[PRICING-MATRIX:DEBUG] Before assigning to nwcaPricingData (master data path) - masterUniqueSizes:", JSON.stringify(masterUniqueSizes), "masterHeaders:", JSON.stringify(masterHeaders));

                window.nwcaPricingData = {
                    styleNumber: styleNumber,
                    color: colorCode,
                    embellishmentType: embType,
                    headers: masterHeaders,
                    prices: pricesForStitchCount,
                    tierData: masterData.tierDefinitions || {},
                    uniqueSizes: masterUniqueSizes,
                    capturedAt: new Date().toISOString(),
                    fromMasterData: true,
                    currentStitchCount: currentStitchCount,
                    tiers: masterData.tierDefinitions || {}
                };
                console.log("[PRICING-MATRIX:CAPTURE] Created pricing data from MASTER DATA:", JSON.stringify(window.nwcaPricingData, null, 2));
                captureCompleted = true;
                window.dispatchEvent(new CustomEvent('pricingDataLoaded', { detail: window.nwcaPricingData }));
                console.log("[PRICING-MATRIX:CAPTURE] 'pricingDataLoaded' event dispatched (from master data).");
                savePricingMatrixToServer(window.nwcaPricingData);
                return window.nwcaPricingData;
            }

            // --- REGULAR TABLE SCRAPING LOGIC ---
            // This will run if the cap master data path above was not taken or failed early (e.g. masterData.allPriceProfiles was missing)
            console.log("[PRICING-MATRIX:CAPTURE] Proceeding with table scraping logic (either not a cap, or cap master data was not ready/valid).");
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
                    if (parsedTier) tierData[tierText] = parsedTier;
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

             if (Object.keys(priceMatrix).length === 0 || Object.keys(tierData).length === 0) {
                 console.error("[PRICING-MATRIX:CAPTURE-ERROR] Failed to extract valid price matrix or tier data.");
                 return null;
             }

            console.log("[PRICING-MATRIX:DEBUG] Preparing to set window.nwcaPricingData"); // DEBUG LOG
            // For uniqueSizes, we will directly use the headers obtained from the table.
            // The previous filtering was too aggressive for caps with sizes like "S/M".
            // If specific filtering is needed for garment pages (e.g. to exclude "S-XL" if S, M, L, XL are present),
            // that should be handled by a more sophisticated logic, possibly in the display modules.
            // const extractedUniqueSizes = [...new Set(headers)]; // Previous attempt
            // console.log("[PRICING-MATRIX:DEBUG] Using all headers as uniqueSizes:", extractedUniqueSizes);

            // Directly use headers for uniqueSizes, ensuring it's a new array from a Set to guarantee uniqueness.
            const uniqueSizesFromHeaders = [...new Set(headers)];
            console.log("[PRICING-MATRIX:DEBUG] Derived uniqueSizesFromHeaders:", JSON.stringify(uniqueSizesFromHeaders));

            // Determine uniqueSizes. For caps, always derive from headers if possible,
            // as masterData might have an empty uniqueSizes array.
            let finalUniqueSizes;
            if (embType === 'cap-embroidery' && headers && headers.length > 0) {
                finalUniqueSizes = [...new Set(headers)];
                console.log("[PRICING-MATRIX:DEBUG] Cap embroidery: Forcing uniqueSizes from headers:", JSON.stringify(finalUniqueSizes));
            } else {
                finalUniqueSizes = uniqueSizesFromHeaders; // From line 206: const uniqueSizesFromHeaders = [...new Set(headers)];
            }

            window.nwcaPricingData = {
                styleNumber, color: colorCode, embellishmentType: embType,
                headers, prices: priceMatrix, tierData,
                uniqueSizes: finalUniqueSizes,
                capturedAt: new Date().toISOString()
            };
            console.log("[PRICING-MATRIX:DEBUG] window.nwcaPricingData immediately after assignment, uniqueSizes:", JSON.stringify(window.nwcaPricingData.uniqueSizes));
            
            // The post-construction check below might now be redundant for caps if the above works,
            // but keeping it for safety / other scenarios.
            // Post-construction check specifically for caps if uniqueSizes ended up empty
            // This check is crucial if the data source (e.g., masterData for caps) doesn't provide uniqueSizes correctly.
            if (window.nwcaPricingData && typeof window.nwcaPricingData === 'object') {
                if (window.nwcaPricingData.embellishmentType === 'cap-embroidery') {
                    console.log("[PRICING-MATRIX:CAPTURE-FIX-CHECK] Checking cap data. Current uniqueSizes:", JSON.stringify(window.nwcaPricingData.uniqueSizes), "Headers:", JSON.stringify(window.nwcaPricingData.headers));
                    if ((!window.nwcaPricingData.uniqueSizes || window.nwcaPricingData.uniqueSizes.length === 0) &&
                        window.nwcaPricingData.headers && window.nwcaPricingData.headers.length > 0) {
                        console.warn("[PRICING-MATRIX:CAPTURE-FIX-APPLY] Cap embroidery data had empty/invalid uniqueSizes. Repopulating from headers.");
                        window.nwcaPricingData.uniqueSizes = [...new Set(window.nwcaPricingData.headers)];
                        console.warn("[PRICING-MATRIX:CAPTURE-FIX-APPLIED] After fix, uniqueSizes:", JSON.stringify(window.nwcaPricingData.uniqueSizes));
                    } else if (window.nwcaPricingData.uniqueSizes && window.nwcaPricingData.uniqueSizes.length > 0) {
                        console.log("[PRICING-MATRIX:CAPTURE-FIX-CHECK] Cap data uniqueSizes already populated:", JSON.stringify(window.nwcaPricingData.uniqueSizes));
                    } else {
                        console.warn("[PRICING-MATRIX:CAPTURE-FIX-CHECK] Cap data uniqueSizes empty, but headers also empty or invalid. Cannot fix uniqueSizes from headers.");
                    }
                }
            } else {
                console.error("[PRICING-MATRIX:CAPTURE-FIX-CHECK] window.nwcaPricingData is not an object or undefined before fix check.");
            }

            console.log("[PRICING-MATRIX:CAPTURE] Data captured successfully (pre-final-cap-fix). Value:", JSON.stringify(window.nwcaPricingData, null, 2));

            // FINAL ATTEMPT TO FIX CAP UNIQUE SIZES before dispatching
            if (window.nwcaPricingData && window.nwcaPricingData.embellishmentType === 'cap-embroidery') {
                if ((!window.nwcaPricingData.uniqueSizes || window.nwcaPricingData.uniqueSizes.length === 0) &&
                    window.nwcaPricingData.headers && window.nwcaPricingData.headers.length > 0) {
                    console.warn("[PRICING-MATRIX:FINAL-CAP-FIX] uniqueSizes empty for cap before dispatch. Forcing from headers.");
                    window.nwcaPricingData.uniqueSizes = [...new Set(window.nwcaPricingData.headers)];
                    console.warn("[PRICING-MATRIX:FINAL-CAP-FIX] uniqueSizes after forcing:", JSON.stringify(window.nwcaPricingData.uniqueSizes));
                } else {
                    console.log("[PRICING-MATRIX:FINAL-CAP-FIX] uniqueSizes for cap seems okay or headers unavailable:", JSON.stringify(window.nwcaPricingData.uniqueSizes));
                }
            }
            
            console.log("[PRICING-MATRIX:CAPTURE] Final nwcaPricingData before dispatch. Value:", JSON.stringify(window.nwcaPricingData, null, 2));
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
        let headers = ['S-XL', '2XL', '3XL']; let prices = { 'S-XL': { 'Tier1': 20.00, 'Tier2': 19.00, 'Tier3': 18.00, 'Tier4': 17.00 }, '2XL': { 'Tier1': 22.00, 'Tier2': 21.00, 'Tier3': 20.00, 'Tier4': 19.00 }, '3XL': { 'Tier1': 23.00, 'Tier2': 22.00, 'Tier3': 21.00, 'Tier4': 20.00 }, }; let tiers = { 'Tier1': { 'MinQuantity': 1, 'MaxQuantity': 11, LTM_Fee: 50 }, 'Tier2': { 'MinQuantity': 12, 'MaxQuantity': 23, LTM_Fee: 25 }, 'Tier3': { 'MinQuantity': 24, 'MaxQuantity': 47 }, 'Tier4': { 'MinQuantity': 48, 'MaxQuantity': 10000 }, }; let uniqueSizes = ['S', 'M', 'L', 'XL', '2XL', '3XL']; if (embType === 'cap-embroidery') { headers = ['One Size']; prices = { 'One Size': { 'Tier1': 22.99, 'Tier2': 21.99, 'Tier3': 20.99, 'Tier4': 19.99 } }; uniqueSizes = ['OS']; }
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