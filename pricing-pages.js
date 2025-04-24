/**
 * Shared JavaScript for Pricing Pages v2 (Corrected Initialization Logic)
 * Handles URL parameters, navigation, and loading Caspio embedded content
 * Addresses premature failure detection in Caspio callbacks.
 */

// --- Configuration ---
const API_PROXY_BASE_URL = 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';
const FALLBACK_API_BASE_URL = 'https://caspio-pricing-proxy-backup.herokuapp.com'; // Keep for potential future use
let usingFallbackApi = false; // Keep for potential future use

// --- Global Functions Called by Caspio ---

// Define the initDp5ApiFetch function (Called by DP5 Embroidery DataPage)
// IMPORTANT: This function should *not* determine failure. Caspio's internal
// scripts (HTML Blocks) handle fetching and rendering. This just acknowledges the callback.
window.initDp5ApiFetch = function() {
    console.log("PricingPages: initDp5ApiFetch called by Caspio DataPage (DP5). Letting Caspio manage its rendering.");
    // DO NOT check for '.matrix-price-table' or call displayContactMessage here.
    return true; // Indicate callback received
};

// Define the initDp7ApiFetch function (Called by DP7 Cap Embroidery DataPage)
// IMPORTANT: Same reasoning as above. Let Caspio manage its rendering.
window.initDp7ApiFetch = function() {
    console.log("PricingPages: initDp7ApiFetch called by Caspio DataPage (DP7). Letting Caspio manage its rendering.");
    // DO NOT check for '.matrix-price-table' or call displayContactMessage here.
    return true; // Indicate callback received
};

// Define similar stub functions if other Caspio DPs (DTG, Screenprint) also call back
window.initDp6ApiFetch = function() { // Assuming DP6 for DTG
    console.log("PricingPages: initDp6ApiFetch called by Caspio DataPage (DP6?). Letting Caspio manage its rendering.");
    return true;
};
window.initDp8ApiFetch = function() { // Assuming DP8 for Screenprint
    console.log("PricingPages: initDp8ApiFetch called by Caspio DataPage (DP8?). Letting Caspio manage its rendering.");
    return true;
};


// --- Helper Functions ---

// Get URL parameters
function getUrlParameter(name) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(name);
}

// Helper function to get the embellishment type from the URL path
function getEmbellishmentTypeFromUrl() {
    const currentPage = window.location.pathname.toLowerCase();
    if (currentPage.includes('cap-embroidery')) return 'cap-embroidery';
    if (currentPage.includes('embroidery')) return 'embroidery'; // Check after cap
    if (currentPage.includes('dtg')) return 'dtg';
    if (currentPage.includes('screenprint') || currentPage.includes('screen-print')) return 'screenprint'; // Allow both common spellings
    if (currentPage.includes('dtf')) return 'dtf';
    console.warn("PricingPages: Could not determine embellishment type from URL path:", currentPage);
    return 'unknown'; // Default to unknown if not identifiable
}


// --- Page Initialization Functions ---

// Update product context area (Style, Color, Title, Image)
function updateProductContext() {
    const styleNumber = getUrlParameter('StyleNumber');
    const colorFromUrl = getUrlParameter('COLOR'); // Raw color parameter from URL

    console.log(`PricingPages: DEBUG - Raw URL: ${window.location.href}`);
    console.log(`PricingPages: DEBUG - URL Parameters: ${window.location.search}`);
    console.log(`PricingPages: Product Context: StyleNumber=${styleNumber}, COLOR=${colorFromUrl}`);

    // Store globally for potential use elsewhere (like loadCaspioEmbed)
    window.selectedStyleNumber = styleNumber;
    // Decode the color name for display, but keep raw value for consistency if needed
    window.selectedColorName = colorFromUrl ? decodeURIComponent(colorFromUrl.replace(/\+/g, ' ')) : null;
    
    // Check if the color name contains a catalog color code pattern (e.g., "Atlantic Blue/ Chrome" -> "AtlBlue/Chrome")
    // This is a common pattern where the catalog color code is an abbreviated version of the color name
    if (window.selectedColorName) {
        // Try to extract catalog color code from the color name
        // For example, "Atlantic Blue/ Chrome" might correspond to catalog code "AtlBlue/Chrome"
        // We'll make a best effort to transform it
        const colorName = window.selectedColorName;
        
        // Check if we're dealing with a color that might have a catalog code
        if (colorName.includes('Atlantic Blue') && colorName.includes('Chrome')) {
            window.selectedCatalogColor = 'AtlBlue/Chrome';
        } else if (colorName.includes('Black') && colorName.includes('Chrome')) {
            window.selectedCatalogColor = 'Black/Chrome';
        } else if (colorName.includes('Smoke Grey') && colorName.includes('Chrome')) {
            window.selectedCatalogColor = 'Smk Gry/Chrome';
        } else {
            // For other colors, use the color name as a fallback
            window.selectedCatalogColor = colorName;
        }
    } else {
        window.selectedCatalogColor = null;
    }

    console.log(`PricingPages: Color updated from URL: Name='${window.selectedColorName}', Catalog='${window.selectedCatalogColor}'`);

    // Update display elements if they exist
    const styleEl = document.getElementById('product-style');
    const colorEl = document.getElementById('product-color');
    if (styleEl) styleEl.textContent = styleNumber || 'N/A';
    if (colorEl) colorEl.textContent = window.selectedColorName || 'Not Selected';

    // Update back to product link
    const backLink = document.getElementById('back-to-product');
    if (backLink && styleNumber) { // Only update if styleNumber exists
        // Use the RAW colorFromUrl for the link to match how it was likely generated
        backLink.href = `/product?StyleNumber=${encodeURIComponent(styleNumber)}&COLOR=${encodeURIComponent(colorFromUrl || '')}`;
        console.log(`PricingPages: Back to product link updated using Style: ${styleNumber}, Raw COLOR: ${colorFromUrl || 'None'}`);
    } else if (backLink) {
        console.warn("PricingPages: Could not update back link - StyleNumber missing.");
        backLink.href = '/'; // Default to homepage or search page
    }

    // Fetch product details (Title, Image)
    if (styleNumber) {
        fetchProductDetails(styleNumber);
    } else {
        const titleEl = document.getElementById('product-title');
        const imageEl = document.getElementById('product-image');
        if (titleEl) titleEl.textContent = 'Product Not Found';
        if (imageEl) imageEl.src = ''; // Placeholder or default image
    }
}

// Fetch product details from API
async function fetchProductDetails(styleNumber) {
    console.log(`PricingPages: Fetching product details for Style: ${styleNumber}`);
    try {
        // Use the most reliable color identifier available
        const colorIdentifier = window.selectedCatalogColor || window.selectedColorName;
        let detailApiUrl = `${API_PROXY_BASE_URL}/api/product-details?styleNumber=${encodeURIComponent(styleNumber)}`;

        if (colorIdentifier) {
            detailApiUrl += `&color=${encodeURIComponent(colorIdentifier)}`;
            console.log(`PricingPages: Using color identifier for fetch: '${colorIdentifier}'`);
        } else {
            console.log(`PricingPages: No color identifier available for fetch.`);
        }

        const response = await fetch(detailApiUrl);
        if (!response.ok) {
            throw new Error(`API Error fetching details: ${response.status} ${response.statusText}`);
        }

        const details = await response.json();

        // Update product title and image elements if they exist
        const titleEl = document.getElementById('product-title');
        const imageEl = document.getElementById('product-image');

        if (titleEl) titleEl.textContent = details.PRODUCT_TITLE || styleNumber;

        // Prefer FRONT_MODEL, fallback to FRONT_FLAT
        const mainImageUrl = details.FRONT_MODEL || details.FRONT_FLAT || '';
        if (imageEl && mainImageUrl) {
            imageEl.src = mainImageUrl;
            imageEl.alt = `${details.PRODUCT_TITLE || styleNumber} - ${colorIdentifier || ''}`;
        } else if (imageEl) {
            console.warn("PricingPages: No main image URL found in product details.");
            imageEl.src = ''; // Set to empty or a placeholder
            imageEl.alt = titleEl ? titleEl.textContent : styleNumber;
        }

    } catch (error) {
        console.error('PricingPages: Error fetching product details:', error);
        const titleEl = document.getElementById('product-title');
        if (titleEl) titleEl.textContent = 'Error Loading Product Info';
        // Optionally clear image or set placeholder
        const imageEl = document.getElementById('product-image');
         if (imageEl) imageEl.src = '';
    }
}

// Update tab navigation based on current URL parameters
function updateTabNavigation() {
    const styleNumber = getUrlParameter('StyleNumber');
    const colorCode = getUrlParameter('COLOR'); // Keep the raw URL parameter
    const currentPage = window.location.pathname.toLowerCase();

    if (!styleNumber) {
        console.warn("PricingPages: Cannot update tabs, StyleNumber missing from URL.");
        return;
    }

    console.log(`PricingPages: Updating Tabs: StyleNumber=${styleNumber}, Raw COLOR=${colorCode}`);

    const tabs = document.querySelectorAll('.pricing-tab');
    tabs.forEach(tab => {
        const targetPage = tab.getAttribute('data-page'); // e.g., 'embroidery', 'cap-embroidery'
        if (!targetPage) return;

        // Build the URL with parameters, preserving raw COLOR parameter
        const url = `/pricing/${targetPage}?StyleNumber=${encodeURIComponent(styleNumber)}&COLOR=${encodeURIComponent(colorCode || '')}`;
        tab.href = url;

        // console.log(`PricingPages: Tab ${targetPage} URL set to: ${url}`); // Reduce log noise

        // Set active state
        if (currentPage.includes(`/pricing/${targetPage}`)) {
            tab.classList.add('active');
        } else {
            tab.classList.remove('active');
        }
    });
}

// --- Caspio Loading and Handling ---

/**
 * Loads the Caspio embed script and checks for success/failure after a delay.
 */
function loadCaspioEmbed(containerId, caspioAppKey, styleNumber) {
    const container = document.getElementById(containerId);
    if (!container) {
        console.error(`PricingPages: Container element with ID "${containerId}" not found.`);
        return; // Stop if container doesn't exist
    }

    // Ensure style number is provided
    if (!styleNumber) {
        console.error(`PricingPages: Style number not provided for Caspio load.`);
        container.innerHTML = '<div class="error-message">Error: Style number missing. Cannot load pricing.</div>';
        container.dataset.loadFailed = 'true'; // Mark as failed immediately
        container.classList.add('pricing-unavailable');
        return;
    }

    // Use the globally set color (prefer catalog, fallback to name)
    const colorForCaspio = window.selectedCatalogColor || window.selectedColorName || '';
    console.log(`PricingPages: Using color for Caspio embed: '${colorForCaspio}'`);

    // Show loading message
    container.innerHTML = '<div class="loading-message">Loading pricing data...</div>';
    container.classList.add('loading');
    container.classList.remove('pricing-unavailable'); // Ensure unavailable class is removed initially
    delete container.dataset.loadFailed; // Reset failure flag

    // Build the Caspio URL
    const params = new URLSearchParams();
    params.append('StyleNumber', styleNumber);
    
    // Use the COLOR parameter with the catalog color code
    // This is the color code used in the inventory table (e.g., "AtlBlue/Chrome")
    if (window.selectedCatalogColor) {
        params.append('COLOR', window.selectedCatalogColor);
        console.log(`PricingPages: Using COLOR parameter with value (catalog code): '${window.selectedCatalogColor}'`);
    } else if (window.selectedColorName) {
        // If we only have a color name, use COLOR parameter with the color name
        params.append('COLOR', window.selectedColorName);
        console.log(`PricingPages: Using COLOR parameter with value (color name): '${window.selectedColorName}'`);
    }
    
    const fullUrl = `https://c3eku948.caspio.com/dp/${caspioAppKey}/emb?${params.toString()}`;
    console.log(`PricingPages: Loading Caspio embed from URL: ${fullUrl}`);

    // Create and append the script element
    const script = document.createElement('script');
    script.type = 'text/javascript';
    script.src = fullUrl;
    script.async = true; // Load asynchronously

    script.onload = function() {
        console.log(`PricingPages: Caspio script ${caspioAppKey} loaded successfully from ${fullUrl}`);
        container.classList.remove('loading'); // Remove loading class, not the message yet
        // NOTE: Do not remove the loading message here. The Caspio DP itself should replace it.

        // Check after a delay if Caspio rendered correctly.
        // This gives Caspio's internal scripts (HTML Blocks) time to run.
        setTimeout(() => {
            console.log(`PricingPages: Performing check for ${caspioAppKey} after 5 seconds...`);

            // Check for known Caspio-generated error messages within the container
            const hasExplicitError = /Error:|Failed to load|Unable to load|Initializing script \(1\) not found/i.test(container.innerText);

            // Check if the Caspio DataPage has loaded successfully but has no records
            const noRecordsFound = container.innerText.includes('No records found');
            
            // If "No records found" is displayed, we'll consider this a successful load
            // but we'll still want to display our contact message
            if (noRecordsFound) {
                console.log(`PricingPages: Caspio DataPage loaded successfully for ${caspioAppKey}, but no records found. Will display contact message.`);
                
                // Mark as failed so we display the contact message
                container.dataset.loadFailed = 'true';
                container.classList.add('pricing-unavailable');
                
                // Display contact message directly
                displayContactMessage(container, getEmbellishmentTypeFromUrl());
                
                // Initialize fallback pricing data
                initializeFallbackPricingData(getEmbellishmentTypeFromUrl());
                
                return; // Exit early
            }
            
            // Check if any table elements were rendered by Caspio's scripts
            // This is a more lenient check that doesn't rely on specific class names or IDs
            const hasTable = !!container.querySelector('table');
            const hasCbResultSetTable = !!container.querySelector('.cbResultSetTable');
            const hasMatrixPriceTable = !!container.querySelector('.matrix-price-table');
            const hasMatrixPriceBody = !!container.querySelector('#matrix-price-body');
            const hasCbResultSet = !!container.querySelector('.cbResultSet');
            const hasLoadingMessage = !!container.querySelector('.loading-message');
            const hasCbResultSetAndNoLoadingMessage = hasCbResultSet && !hasLoadingMessage;
            
            // Log what elements were found for debugging
            console.log(`PricingPages: Caspio DataPage check details for ${caspioAppKey}:
                hasTable: ${hasTable}
                hasCbResultSetTable: ${hasCbResultSetTable}
                hasMatrixPriceTable: ${hasMatrixPriceTable}
                hasMatrixPriceBody: ${hasMatrixPriceBody}
                hasCbResultSet: ${hasCbResultSet}
                hasLoadingMessage: ${hasLoadingMessage}
                hasCbResultSetAndNoLoadingMessage: ${hasCbResultSetAndNoLoadingMessage}
            `);
            
            const hasTableElements = !!(
                hasTable ||
                hasCbResultSetTable ||
                hasMatrixPriceTable ||
                hasMatrixPriceBody ||
                // Check for any content that indicates successful loading
                hasCbResultSetAndNoLoadingMessage
            );

            if (hasExplicitError || !hasTableElements) {
                console.warn(`PricingPages: Caspio DataPage check FAILED for ${caspioAppKey}. HasExplicitError: ${hasExplicitError}, HasTableElements: ${hasTableElements}.`);
                // Log snippet of HTML for debugging
                // console.log(`Container HTML (first 300 chars): ${container.innerHTML.substring(0, 300)}...`);

                // Mark as failed for the retry logic (important!)
                container.dataset.loadFailed = 'true';
                container.classList.add('pricing-unavailable'); // Add class for retry detection

                // Call displayContactMessage ONLY if this is the final state after retries (handled by tryLoadCaspioSequentially)
                // Do NOT call displayContactMessage here directly, as it interferes with retries.

            } else {
                console.log(`PricingPages: Caspio DataPage check PASSED for ${caspioAppKey}. Essential elements found.`);
                container.classList.remove('pricing-unavailable'); // Ensure this class is removed on success
                container.dataset.loadFailed = 'false'; // Explicitly mark as not failed

                // Ensure hidden elements needed for cart integration exist IF Caspio succeeded
                ensureHiddenCartElements(container);
            }
        }, 5000); // 5-second delay - adjust if needed, but ensure it's longer than Caspio's internal processing
    };

    script.onerror = function() {
        console.error(`PricingPages: Error loading Caspio script ${caspioAppKey} from ${fullUrl}`);
        container.classList.remove('loading');
        container.classList.add('pricing-unavailable'); // Add class for retry detection
        container.dataset.loadFailed = 'true'; // Mark as failed

        // Do NOT call displayContactMessage here directly
    };

    container.appendChild(script);
}

/**
 * Ensures hidden #matrix-title and #matrix-note elements exist
 * for cart-integration.js, adding them if necessary.
 * Should be called *after* confirming Caspio loaded successfully or when showing fallback.
 */
function ensureHiddenCartElements(container) {
    // Ensure #matrix-title exists (hidden)
    if (!container.querySelector('#matrix-title')) {
        const titleElement = document.createElement('h3');
        titleElement.id = 'matrix-title';
        const caspioTitle = container.querySelector('h3, h2'); // Try to grab Caspio's title
        titleElement.textContent = caspioTitle ? caspioTitle.textContent.trim() : `${getEmbellishmentTypeFromUrl()} Pricing`;
        titleElement.style.display = 'none';
        container.insertBefore(titleElement, container.firstChild);
        console.log('PricingPages: Added missing #matrix-title element (hidden).');
    }

    // Ensure #matrix-note exists (hidden)
    if (!container.querySelector('#matrix-note')) {
        const noteElement = document.createElement('div');
        noteElement.id = 'matrix-note';
        noteElement.style.display = 'none';
        const caspioNote = container.querySelector('.cbResultSetInstructions, .cbResultSetMessage'); // Try to grab Caspio's note
        noteElement.innerHTML = caspioNote ? caspioNote.innerHTML : '';
        container.appendChild(noteElement); // Append at the end
        console.log('PricingPages: Added missing #matrix-note element (hidden).');
    }
}

// --- Cart Script Loading ---

// Load cart.js script and initialize the cart
function loadCartScript() {
    return new Promise((resolve, reject) => {
        if (window.NWCACart) {
            console.log('PricingPages: NWCACart already loaded/defined.');
            // Attempt initialization if available
            if (typeof window.NWCACart.initializeCart === 'function') {
                 // Use try-catch as initializeCart might fail
                 try {
                     window.NWCACart.initializeCart();
                     console.log('PricingPages: NWCACart.initializeCart() called.');
                 } catch (initError) {
                     console.error('PricingPages: Error calling NWCACart.initializeCart():', initError);
                 }
            }
            resolve();
            return;
        }

        console.log('PricingPages: Loading cart.js...');
        const script = document.createElement('script');
        script.src = '/cart.js'; // Adjust path if needed
        script.async = true;

        script.onload = () => {
            console.log('PricingPages: cart.js script loaded successfully.');
            // Initialize the cart after loading, give it a moment
            setTimeout(() => {
                if (window.NWCACart && typeof window.NWCACart.initializeCart === 'function') {
                     try {
                         window.NWCACart.initializeCart();
                         console.log('PricingPages: NWCACart initialized after script load.');
                     } catch (initError) {
                          console.error('PricingPages: Error initializing NWCACart after script load:', initError);
                     }
                } else {
                    console.warn('PricingPages: NWCACart object or initializeCart function not available after cart.js loaded.');
                }
                resolve(); // Resolve even if initialization failed, let other things proceed
            }, 100);
        };

        script.onerror = () => {
            console.error('PricingPages: Error loading cart.js script.');
            reject(new Error('Failed to load cart.js script'));
        };
        document.head.appendChild(script);
    });
}

// Load cart integration script
function loadCartIntegrationScript() {
    return new Promise((resolve, reject) => {
        // Check if the script's main object/flag already exists FIRST
        if (window.cartIntegrationInitialized) { // Assuming cart-integration sets this flag
            console.log('PricingPages: Cart integration script already loaded/initialized.');
            resolve(); // Already loaded, resolve successfully
            return;
        }

        console.log('PricingPages: Loading cart-integration.js...');
        const script = document.createElement('script');
        script.src = '/cart-integration.js'; // Adjust path if needed
        script.async = true;

        script.onload = () => {
            console.log('PricingPages: cart-integration.js script loaded successfully.');
            // Initialization is likely handled within cart-integration.js itself
            // (e.g., via its own DOMContentLoaded or the initCartIntegration() call from Caspio Block 4)
            // Set the flag here to be safe, though cart-integration.js might also set it.
            window.cartIntegrationInitialized = true; 
            resolve();
        };

        script.onerror = () => {
            console.error('PricingPages: Error loading cart-integration.js script.');
            reject(new Error('Failed to load cart-integration.js script'));
        };
        document.head.appendChild(script);
    });
}


// --- Main Initialization ---

// Initialize the page (Called on DOMContentLoaded)
async function initPricingPage() {
    console.log("PricingPages: Initializing pricing page...");
    updateProductContext();
    updateTabNavigation();

    // Load cart scripts first - important they are ready before integration tries to use them
    try {
        await loadCartScript();
        await loadCartIntegrationScript();
        console.log("PricingPages: Core cart scripts loaded.");
    } catch (error) {
        console.error('PricingPages: Error loading core cart scripts, subsequent functionality may be affected:', error);
        // Decide if we should stop or continue without cart integration
        // For now, let's continue to try loading Caspio pricing
    }

    // Determine which Caspio DP to load
    const styleNumber = getUrlParameter('StyleNumber');
    const currentPage = window.location.pathname.toLowerCase();
    let pricingContainerId = 'pricing-calculator'; // Default container ID
    let appKeys = [];
    let embType = getEmbellishmentTypeFromUrl(); // Get type early

    // --- DEFINE YOUR CASPIO APP KEYS HERE ---
    const CASPIO_APP_KEYS = {
        embroidery: ['a0e150001c7143d027a54c439c01'], // Add alternatives if needed
        'cap-embroidery': ['a0e150004ecd0739f853449c8d7f'], // Add alternatives if needed
        dtg: ['a0e150002eb9491a50104c1d99d7'], // !!! VERIFY THIS KEY !!!
        screenprint: ['a0e1500026349f420e494800b43e'], // !!! VERIFY THIS KEY !!!
        dtf: ['dtf'] // Special key to trigger 'coming soon'
    };
    // --- Adjust container IDs if necessary ---
    const CONTAINER_IDS = {
        embroidery: 'pricing-calculator',
        'cap-embroidery': 'pricing-calculator', // Assuming same container
        dtg: 'pricing-calculator', // Assuming same container
        screenprint: 'pricing-calculator', // Use the same container ID as other pages
        dtf: 'pricing-calculator'
    };

    appKeys = CASPIO_APP_KEYS[embType] || [];
    pricingContainerId = CONTAINER_IDS[embType] || 'pricing-calculator';

    const pricingContainer = document.getElementById(pricingContainerId);
    if (!pricingContainer) {
        console.error(`PricingPages: Pricing container #${pricingContainerId} not found for type ${embType}.`);
        return; // Cannot proceed
    }

    if (embType === 'unknown' || appKeys.length === 0) {
        console.error(`PricingPages: Unknown page type or no AppKeys defined for ${embType}. Path: ${currentPage}`);
        displayContactMessage(pricingContainer, embType);
        return;
    }

    // Handle DTF separately - show contact message directly
    if (embType === 'dtf') {
        console.log("PricingPages: Handling DTF page (coming soon).");
        // Display contact message directly instead of trying to load Caspio
        displayContactMessage(pricingContainer, embType);
        initializeFallbackPricingData(embType); // Init fallback for cart integration consistency
        return;
    }

    // Try loading the appropriate Caspio DataPage sequentially using the defined keys
    await tryLoadCaspioSequentially(pricingContainer, appKeys, styleNumber, embType);
}

/**
 * Tries loading Caspio DataPages sequentially using a list of AppKeys.
 * Waits after each attempt to check for success using the flag set by loadCaspioEmbed.
 */
async function tryLoadCaspioSequentially(container, appKeys, styleNumber, embType) {
    console.log(`PricingPages: Starting sequential load for ${embType} with keys:`, appKeys);
    let loadedSuccessfully = false;

    for (let i = 0; i < appKeys.length; i++) {
        const currentKey = appKeys[i];
        console.log(`PricingPages: Attempting load for ${embType} with key #${i + 1}: ${currentKey}`);

        // Load the embed script
        loadCaspioEmbed(container.id, currentKey, styleNumber);

        // Wait for the check inside loadCaspioEmbed to complete (plus a buffer)
        // The check runs after 5 seconds, so we wait 6 seconds total.
        await new Promise(resolve => setTimeout(resolve, 6000));

        // Check the result flag set by loadCaspioEmbed's internal check
        const loadFailed = container.dataset.loadFailed === 'true';

        if (!loadFailed) {
            console.log(`PricingPages: Successfully loaded ${embType} pricing with key: ${currentKey}`);
            loadedSuccessfully = true;
            // Note: ensureHiddenCartElements is called inside loadCaspioEmbed on success check
            break; // Exit loop on success
        } else {
            console.warn(`PricingPages: Failed to load ${embType} pricing with key: ${currentKey}.`);
            if (i < appKeys.length - 1) {
                console.log("PricingPages: Trying next key...");
            }
        }
    }

    if (!loadedSuccessfully) {
        console.error(`PricingPages: All attempts to load ${embType} pricing failed using keys:`, appKeys);
        // Display contact message as the final fallback
        displayContactMessage(container, embType);
        // Initialize fallback pricing data AFTER confirming all attempts failed
        initializeFallbackPricingData(embType);
    }
}


// --- Fallback Mechanisms ---

/**
 * Initializes fallback global pricing variables if Caspio fails.
 * Prevents errors in cart-integration.js when it tries to read pricing.
 */
function initializeFallbackPricingData(embType) {
    console.warn(`PricingPages: Initializing FALLBACK pricing data for ${embType}. Caspio DP failed to load.`);

    // Define fallback structures - ADJUST THESE VALUES AS NEEDED
    let headers = ['S-XL', '2XL', '3XL'];
    let prices = {
        'S-XL': { 'Tier1': 20.00, 'Tier2': 19.00, 'Tier3': 18.00, 'Tier4': 17.00 },
        '2XL': { 'Tier1': 22.00, 'Tier2': 21.00, 'Tier3': 20.00, 'Tier4': 19.00 },
        '3XL': { 'Tier1': 23.00, 'Tier2': 22.00, 'Tier3': 21.00, 'Tier4': 20.00 },
    };
    let tiers = {
        'Tier1': { 'MinQuantity': 1, 'MaxQuantity': 11, LTM_Fee: 50 },
        'Tier2': { 'MinQuantity': 12, 'MaxQuantity': 23, LTM_Fee: 25 },
        'Tier3': { 'MinQuantity': 24, 'MaxQuantity': 47 },
        'Tier4': { 'MinQuantity': 48, 'MaxQuantity': 10000 },
    };
    let uniqueSizes = ['S', 'M', 'L', 'XL', '2XL', '3XL']; // Match headers

    // Customize fallbacks per type if necessary
    if (embType === 'cap-embroidery') {
        headers = ['One Size'];
        prices = { 'One Size': { 'Tier1': 22.99, 'Tier2': 21.99, 'Tier3': 20.99, 'Tier4': 19.99 } };
        uniqueSizes = ['OS'];
    } else if (embType === 'dtg') {
        // Use default or define specific DTG fallback
    } else if (embType === 'screenprint') {
        // Use default or define specific Screenprint fallback
    } else if (embType === 'dtf') {
         // DTF should show coming soon, but provide fallback data just in case
    }

    // Set global variables expected by cart-integration.js getPrice()
    // Use generic dp5 names as cart-integration seems hardcoded to them
    window.dp5GroupedHeaders = headers;
    window.dp5GroupedPrices = prices;
    window.dp5ApiTierData = tiers;
    // Also set potentially needed dp5UniqueSizes if cart integration uses it
    window.dp5UniqueSizes = uniqueSizes;

    console.log('PricingPages: Fallback pricing global variables initialized.');

    // Optionally, build a simplified fallback table visually?
    // For now, displayContactMessage handles the UI.
}


/**
 * Displays a standard contact message when pricing cannot be loaded.
 */
function displayContactMessage(container, embType) {
    if (!container) {
        console.error("PricingPages: Cannot display contact message - container not found.");
        return;
    }
    console.log(`PricingPages: Displaying contact message for ${embType} pricing in container #${container.id}`);

    // Clear the container and remove loading state
    container.innerHTML = '';
    container.classList.remove('loading');
    container.classList.add('pricing-unavailable'); // Ensure class is added

    // Add hidden title element needed by cart integration
    const titleElement = document.createElement('h3');
    titleElement.id = 'matrix-title';
    titleElement.textContent = `${embType.charAt(0).toUpperCase() + embType.slice(1)} Pricing`;
    titleElement.style.display = 'none';
    container.appendChild(titleElement);

    // Add message content
    const messageElement = document.createElement('div');
    messageElement.style.textAlign = 'center';
    messageElement.style.padding = '30px 20px';
    messageElement.style.backgroundColor = '#f8f9fa';
    messageElement.style.borderRadius = '8px';
    messageElement.style.border = '1px solid #dee2e6';
    messageElement.style.margin = '20px 0';
    messageElement.innerHTML = `
        <h3 style="color: #0056b3; margin-bottom: 15px;">Pricing Currently Unavailable</h3>
        <p style="font-size: 16px; color: #495057; margin-bottom: 20px;">
            We apologize, but the pricing details for this item are currently unavailable.
        </p>
        <p style="font-size: 16px; color: #495057; margin-bottom: 20px;">
            Please call <strong style="color: #0056b3; font-size: 18px;">253-922-5793</strong> for an accurate quote.
        </p>
        <p style="font-size: 14px; color: #6c757d;">
            Our team is ready to assist you.
        </p>
    `;
    container.appendChild(messageElement);

    // Add hidden note element needed by cart integration
    const noteElement = document.createElement('div');
    noteElement.id = 'matrix-note';
    noteElement.style.display = 'none';
    container.appendChild(noteElement);

    console.log(`PricingPages: Contact message displayed for ${embType}.`);
}


// --- Event Listeners ---

// Run initialization when DOM is loaded
document.addEventListener('DOMContentLoaded', initPricingPage);

// Add a global error handler as a safety net
window.addEventListener('error', function(event) {
    console.error('PricingPages: Global error caught:', event.message, event.error);

    // Attempt recovery if it seems Caspio-related and pricing isn't already marked unavailable
    const pricingContainer = document.getElementById('pricing-calculator') || document.getElementById('screenprint-pricing-calculator'); // Check both common IDs
    if (pricingContainer && !pricingContainer.classList.contains('pricing-unavailable')) {
        if (event.message.toLowerCase().includes('caspio') ||
            event.message.toLowerCase().includes('datapage') ||
            event.filename.toLowerCase().includes('caspio.com') ||
            (event.error && event.error.stack && event.error.stack.toLowerCase().includes('caspio')))
        {
            console.warn('PricingPages: Attempting recovery from Caspio-related error by displaying contact message.');
            displayContactMessage(pricingContainer, getEmbellishmentTypeFromUrl());
            initializeFallbackPricingData(getEmbellishmentTypeFromUrl()); // Init fallback data too
        }
    }
});

console.log("PricingPages: Shared pricing page script loaded.");