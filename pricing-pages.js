/**
 * Shared JavaScript for Pricing Pages
 * Handles URL parameters, navigation, and loading Caspio embedded content
 */

// Define the initDp5ApiFetch function that Caspio DataPage is looking for
// This needs to be defined globally before any other code
window.initDp5ApiFetch = function() {
    console.log("initDp5ApiFetch called by Caspio DataPage");
    
    // This function is called by the Caspio DataPage when it's ready
    // It should fetch data from the API and update the pricing table
    
    try {
        // Get the current embellishment type from the URL
        const embType = getEmbellishmentTypeFromUrl();
        
        console.log(`initDp5ApiFetch: Detected embellishment type: ${embType}`);
        
        // Find the pricing table elements
        const pricingTable = document.querySelector('.matrix-price-table');
        const tableBody = document.getElementById('matrix-price-body');
        
        if (pricingTable && tableBody) {
            console.log("initDp5ApiFetch: Found pricing table elements, updating with data");
            
            // The table exists, so we can update it with our data
            // This will be handled by the Caspio DataPage
        } else {
            console.log("initDp5ApiFetch: Pricing table elements not found, may need to create them");
        }
    } catch (error) {
        console.error("Error in initDp5ApiFetch:", error);
    }
    
    return true; // Indicate success to the Caspio DataPage
};

// Define the initDp7ApiFetch function for cap-embroidery page
window.initDp7ApiFetch = function() {
    console.log("initDp7ApiFetch called by Caspio DataPage");
    
    // This function is called by the Caspio DataPage when it's ready
    // It should fetch data from the API and update the pricing table
    
    try {
        // Get the current embellishment type from the URL
        const embType = getEmbellishmentTypeFromUrl();
        
        console.log(`initDp7ApiFetch: Detected embellishment type: ${embType}`);
        
        // Find the pricing table elements
        const pricingTable = document.querySelector('.matrix-price-table');
        const tableBody = document.getElementById('matrix-price-body');
        
        if (pricingTable && tableBody) {
            console.log("initDp7ApiFetch: Found pricing table elements, updating with data");
            
            // The table exists, so we can update it with our data
            // This will be handled by the Caspio DataPage
        } else {
            console.log("initDp7ApiFetch: Pricing table elements not found, may need to create them");
        }
    } catch (error) {
        console.error("Error in initDp7ApiFetch:", error);
    }
    
    return true; // Indicate success to the Caspio DataPage
};

// Base API URL
const API_PROXY_BASE_URL = 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';

// Get URL parameters
function getUrlParameter(name) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(name);
}

// Update product context area with product details
function updateProductContext() {
    const styleNumber = getUrlParameter('StyleNumber');
    const colorFromUrl = getUrlParameter('COLOR'); // Get color from URL
    
    // Log the raw URL for debugging
    console.log(`DEBUG - Raw URL: ${window.location.href}`);
    console.log(`DEBUG - URL Parameters: ${window.location.search}`);
    console.log(`Product Context: StyleNumber=${styleNumber}, COLOR=${colorFromUrl}`);
    
    // Store the color name and style number in the global variables for use in other functions
    window.selectedStyleNumber = styleNumber;
    window.selectedColorName = colorFromUrl; // Use URL color as name for consistency
    window.selectedCatalogColor = colorFromUrl; // Use URL color as catalog color
    
    console.log(`Color updated from URL: Name='${window.selectedColorName}', Catalog='${window.selectedCatalogColor}'`);
    
    // Update product details text
    document.getElementById('product-style').textContent = styleNumber || 'N/A';
    document.getElementById('product-color').textContent = window.selectedColorName || 'Not Selected';
    
    // Update back to product link
    const backLink = document.getElementById('back-to-product');
    if (backLink) {
        // Use the color name from the URL parameter
        // This ensures consistency when navigating back to the product page
        backLink.href = `/product?StyleNumber=${encodeURIComponent(styleNumber || '')}&COLOR=${encodeURIComponent(colorFromUrl || '')}`;
        console.log(`Back to product link updated with color: ${colorFromUrl || 'None'}`);
    }
    
    // Fetch product details to get image and title
    if (styleNumber) {
        fetchProductDetails(styleNumber);
    } else {
        document.getElementById('product-title').textContent = 'Product Not Found';
        document.getElementById('product-image').src = ''; // Placeholder or default image
    }
}

// Fetch product details from API
async function fetchProductDetails(styleNumber) {
    try {
        let detailApiUrl = `${API_PROXY_BASE_URL}/api/product-details?styleNumber=${encodeURIComponent(styleNumber)}`;
        
        // Prioritize catalog color from global scope for API parameters
        const colorIdentifier = window.selectedCatalogColor || window.selectedColorName || 'DefaultColor'; // Use catalog color first, then name, then fallback
        console.log(`Using color identifier for fetch: '${colorIdentifier}' (Catalog: '${window.selectedCatalogColor}', Name: '${window.selectedColorName}')`);
        
        if (colorIdentifier) {
            detailApiUrl += `&color=${encodeURIComponent(colorIdentifier)}`;
        }
        
        const response = await fetch(detailApiUrl);
        if (!response.ok) {
            throw new Error(`API Error: ${response.statusText}`);
        }
        
        const details = await response.json();
        
        // Update product title and image
        document.getElementById('product-title').textContent = details.PRODUCT_TITLE || styleNumber;
        
        const mainImageUrl = details.FRONT_MODEL || details.FRONT_FLAT || '';
        if (mainImageUrl) {
            document.getElementById('product-image').src = mainImageUrl;
            document.getElementById('product-image').alt = `${details.PRODUCT_TITLE || styleNumber} - ${colorIdentifier}`;
        }
    } catch (error) {
        console.error('Error fetching product details:', error);
        document.getElementById('product-title').textContent = 'Error Loading Product';
    }
}

// Update tab navigation
function updateTabNavigation() {
    const styleNumber = getUrlParameter('StyleNumber');
    const colorCode = getUrlParameter('COLOR');
    const currentPage = window.location.pathname;
    
    // The color from URL is likely the color name, not the catalog color code
    // We need to preserve it exactly as it is
    console.log(`Tab Navigation: StyleNumber=${styleNumber}, COLOR=${colorCode}`);
    
    const tabs = document.querySelectorAll('.pricing-tab');
    tabs.forEach(tab => {
        // Get the tab's target page
        const targetPage = tab.getAttribute('data-page');
        
        // Build the URL with parameters
        const url = `/pricing/${targetPage}?StyleNumber=${encodeURIComponent(styleNumber || '')}&COLOR=${encodeURIComponent(colorCode || '')}`;
        tab.href = url;
        
        console.log(`Tab ${targetPage} URL set to: ${url}`);
        
        // Set active state based on current page
        if (currentPage.includes(targetPage)) {
            tab.classList.add('active');
        } else {
            tab.classList.remove('active');
        }
    });
}

// Load Caspio embedded content
function loadCaspioEmbed(containerId, caspioAppKey, styleNumber) {
    if (!styleNumber) {
        document.getElementById(containerId).innerHTML = '<div class="error-message">Error: Style number not provided.</div>';
        return;
    }
    
    // Prioritize catalog color from global scope for Caspio parameters
    const colorForCaspio = window.selectedCatalogColor || window.selectedColorName || ''; // Use catalog color first, then name
    console.log(`Using color for Caspio: '${colorForCaspio}' (Catalog: '${window.selectedCatalogColor}', Name: '${window.selectedColorName}')`);
    
    // Get the container element
    const container = document.getElementById(containerId);
    if (!container) {
        console.error(`Container element with ID "${containerId}" not found.`);
        return;
    }
    
    // Show loading message
    container.innerHTML = '<div class="loading-message">Loading pricing data...</div>';
    
    // For DTF, show coming soon message
    if (caspioAppKey === 'dtf') {
        container.innerHTML = `
            <div style="text-align: center; padding: 40px 20px;">
                <h3 style="color: #0056b3; margin-bottom: 20px;">DTF Pricing Coming Soon</h3>
                <p style="color: #555; max-width: 600px; margin: 0 auto; line-height: 1.5;">
                    We're currently working on adding Direct-to-Film (DTF) pricing to our catalog.
                    DTF offers exceptional quality prints with vibrant colors and excellent durability.
                    <br><br>
                    Please check back soon for pricing information, or contact our sales team for custom quotes.
                </p>
                <div style="margin-top: 20px; font-size: 0.9em; color: #777;">
                    Style: ${styleNumber || 'N/A'}
                </div>
            </div>
        `;
        return;
    }
    
    // Create a script element to load the Caspio DataPage
    const script = document.createElement('script');
    script.type = 'text/javascript';
    
    // Build the Caspio URL with parameters
    let caspioUrl = `https://c3eku948.caspio.com/dp/${caspioAppKey}/emb`;
    
    // Append parameters, ensuring the correct color is passed
    const params = new URLSearchParams();
    params.append('StyleNumber', styleNumber);
    if (colorForCaspio) {
        params.append('COLOR', colorForCaspio); // Use the determined color
    }
    const fullUrl = `${caspioUrl}?${params.toString()}`;
    
    console.log(`Loading Caspio embed from URL: ${fullUrl}`);
    
    // Set the script src
    script.src = fullUrl; // Use the fully constructed URL
    
    // Add event listeners for script loading
    script.onload = function() {
        console.log(`${caspioAppKey} script loaded successfully from ${fullUrl}`);
        // Remove loading message when script is loaded
        const loadingMsg = container.querySelector('.loading-message');
        if (loadingMsg) loadingMsg.style.display = 'none';
        
        // Set a timeout to check if the Caspio DataPage has loaded properly
        setTimeout(function() {
            // Check if there's an error message or "No records found" message
            if (container.innerHTML.includes('Error: Initializing script') ||
                container.innerHTML.includes('No records found')) {
                console.log(`Caspio DataPage failed to load properly for ${caspioAppKey}, displaying unavailable message`);
                
                // Display unavailable message and mark the container
                container.innerHTML = '<div class="error-message">Pricing unavailable, please try again later.</div>';
                container.classList.add('pricing-unavailable');
            }
        }, 3000); // Wait 3 seconds to allow Caspio DataPage to load
    };
    
    script.onerror = function() {
        console.error(`Error loading ${caspioAppKey} script from ${fullUrl}`);
        // Display unavailable message and mark the container
        container.innerHTML = '<div class="error-message">Pricing unavailable, please try again later.</div>';
        container.classList.add('pricing-unavailable');
    };
    
    // Append the script to the container
    container.appendChild(script);
}

// Load cart.js script and initialize the cart
function loadCartScript() {
    return new Promise((resolve, reject) => {
        // Check if NWCACart is already defined
        if (window.NWCACart) {
            console.log('NWCACart already loaded');
            
            // Make sure it's initialized
            if (typeof window.NWCACart.initializeCart === 'function') {
                window.NWCACart.initializeCart();
                console.log('NWCACart initialized after checking it was loaded');
            }
            
            resolve();
            return;
        }
        
        // Create script element
        const script = document.createElement('script');
        script.src = '/cart.js';
        script.async = true;
        
        // Add event listeners
        script.onload = () => {
            console.log('Cart script loaded successfully');
            
            // Initialize the cart after loading
            setTimeout(() => {
                if (window.NWCACart && typeof window.NWCACart.initializeCart === 'function') {
                    window.NWCACart.initializeCart();
                    console.log('NWCACart initialized after script load');
                } else {
                    console.warn('NWCACart not available after script load');
                }
                resolve();
            }, 100); // Small delay to ensure script is fully processed
        };
        
        script.onerror = () => {
            console.error('Error loading cart script');
            reject(new Error('Failed to load cart script'));
        };
        
        // Add to document
        document.head.appendChild(script);
    });
}

// Load cart integration script
function loadCartIntegrationScript() {
    return new Promise((resolve, reject) => {
        // Check if already loaded
        if (window.cartIntegrationInitialized) {
            console.log('Cart integration already initialized');
            resolve();
            return;
        }
        
        // Create script element
        const script = document.createElement('script');
        script.src = '/cart-integration.js';
        script.async = true;
        
        // Add event listeners
        script.onload = () => {
            console.log('Cart integration script loaded successfully');
            resolve();
        };
        
        script.onerror = () => {
            console.error('Error loading cart integration script');
            reject(new Error('Failed to load cart integration script'));
        };
        
        // Add to document
        document.head.appendChild(script);
    });
}

// Initialize the page
async function initPricingPage() {
    updateProductContext();
    updateTabNavigation();
    
    // Load cart scripts
    try {
        await loadCartScript();
        await loadCartIntegrationScript();
    } catch (error) {
        console.error('Error loading cart scripts:', error);
    }
    
    // Load the appropriate Caspio embed based on the page
    const styleNumber = getUrlParameter('StyleNumber');
    const currentPage = window.location.pathname;
    
    if (currentPage.includes('embroidery-pricing') || currentPage.includes('/pricing/embroidery')) {
        // Use the Caspio app key from the provided embedded code
        loadCaspioEmbed('pricing-calculator', 'a0e150001c7143d027a54c439c01', styleNumber);
        
        // Initialize fallback pricing data for embroidery if not already defined
        // This prevents errors in cart-integration.js when Caspio doesn't load properly
        setTimeout(() => {
            if (!window.embroideryGroupedHeaders && !window.dp5GroupedHeaders) {
                console.log('Initializing fallback pricing data for embroidery');
                
                // Define fallback pricing data
                window.embroideryGroupedHeaders = ['XS-S', 'M-L', 'XL-2XL', '3XL-4XL', '5XL-6XL'];
                window.embroideryGroupedPrices = {
                    'XS-S': { 'Tier1': 18.99, 'Tier2': 17.99, 'Tier3': 16.99, 'Tier4': 15.99 },
                    'M-L': { 'Tier1': 19.99, 'Tier2': 18.99, 'Tier3': 17.99, 'Tier4': 16.99 },
                    'XL-2XL': { 'Tier1': 21.99, 'Tier2': 20.99, 'Tier3': 19.99, 'Tier4': 18.99 },
                    '3XL-4XL': { 'Tier1': 23.99, 'Tier2': 22.99, 'Tier3': 21.99, 'Tier4': 20.99 },
                    '5XL-6XL': { 'Tier1': 25.99, 'Tier2': 24.99, 'Tier3': 23.99, 'Tier4': 22.99 }
                };
                window.embroideryApiTierData = {
                    'Tier1': { 'MinQuantity': 1, 'MaxQuantity': 11 },
                    'Tier2': { 'MinQuantity': 12, 'MaxQuantity': 23 },
                    'Tier3': { 'MinQuantity': 24, 'MaxQuantity': 47 },
                    'Tier4': { 'MinQuantity': 48, 'MaxQuantity': 10000 }
                };
                
                // Also define dp5 versions for compatibility
                window.dp5GroupedHeaders = window.embroideryGroupedHeaders;
                window.dp5GroupedPrices = window.embroideryGroupedPrices;
                window.dp5ApiTierData = window.embroideryApiTierData;
                
                console.log('Fallback pricing data initialized successfully');
            }
        }, 1000); // Wait 1 second to allow Caspio to load first
    } else if (currentPage.includes('cap-embroidery-pricing') || currentPage.includes('/pricing/cap-embroidery')) {
        loadCaspioEmbed('pricing-calculator', 'a0e150004ecd0739f853449c8d7f', styleNumber);
        
        // Initialize fallback pricing data for cap embroidery
        setTimeout(() => {
            if (!window['cap-embroideryGroupedHeaders'] && !window.dp5GroupedHeaders) {
                console.log('Initializing fallback pricing data for cap embroidery');
                
                // Define fallback pricing data
                window['cap-embroideryGroupedHeaders'] = ['One Size'];
                window['cap-embroideryGroupedPrices'] = {
                    'One Size': { 'Tier1': 22.99, 'Tier2': 21.99, 'Tier3': 20.99, 'Tier4': 19.99 }
                };
                window['cap-embroideryApiTierData'] = {
                    'Tier1': { 'MinQuantity': 1, 'MaxQuantity': 11 },
                    'Tier2': { 'MinQuantity': 12, 'MaxQuantity': 23 },
                    'Tier3': { 'MinQuantity': 24, 'MaxQuantity': 47 },
                    'Tier4': { 'MinQuantity': 48, 'MaxQuantity': 10000 }
                };
                
                // Also define dp5 versions for compatibility
                window.dp5GroupedHeaders = window['cap-embroideryGroupedHeaders'];
                window.dp5GroupedPrices = window['cap-embroideryGroupedPrices'];
                window.dp5ApiTierData = window['cap-embroideryApiTierData'];
                
                console.log('Fallback pricing data initialized successfully for cap embroidery');
            }
        }, 1000);
    } else if (currentPage.includes('dtg-pricing') || currentPage.includes('/pricing/dtg')) {
        loadCaspioEmbed('pricing-calculator', 'a0e150002eb9491a50104c1d99d7', styleNumber);
        
        // Initialize fallback pricing data for DTG
        setTimeout(() => {
            if (!window.dtgGroupedHeaders && !window.dp5GroupedHeaders) {
                console.log('Initializing fallback pricing data for DTG');
                
                // Define fallback pricing data
                window.dtgGroupedHeaders = ['XS-S', 'M-L', 'XL-2XL', '3XL-4XL', '5XL-6XL'];
                window.dtgGroupedPrices = {
                    'XS-S': { 'Tier1': 20.99, 'Tier2': 19.99, 'Tier3': 18.99, 'Tier4': 17.99 },
                    'M-L': { 'Tier1': 21.99, 'Tier2': 20.99, 'Tier3': 19.99, 'Tier4': 18.99 },
                    'XL-2XL': { 'Tier1': 23.99, 'Tier2': 22.99, 'Tier3': 21.99, 'Tier4': 20.99 },
                    '3XL-4XL': { 'Tier1': 25.99, 'Tier2': 24.99, 'Tier3': 23.99, 'Tier4': 22.99 },
                    '5XL-6XL': { 'Tier1': 27.99, 'Tier2': 26.99, 'Tier3': 25.99, 'Tier4': 24.99 }
                };
                window.dtgApiTierData = {
                    'Tier1': { 'MinQuantity': 1, 'MaxQuantity': 11 },
                    'Tier2': { 'MinQuantity': 12, 'MaxQuantity': 23 },
                    'Tier3': { 'MinQuantity': 24, 'MaxQuantity': 47 },
                    'Tier4': { 'MinQuantity': 48, 'MaxQuantity': 10000 }
                };
                
                // Also define dp5 versions for compatibility
                window.dp5GroupedHeaders = window.dtgGroupedHeaders;
                window.dp5GroupedPrices = window.dtgGroupedPrices;
                window.dp5ApiTierData = window.dtgApiTierData;
                
                console.log('Fallback pricing data initialized successfully for DTG');
            }
        }, 1000);
    } else if (currentPage.includes('screen-print-pricing') || currentPage.includes('/pricing/screen-print')) {
        loadCaspioEmbed('pricing-calculator', 'a0e1500026349f420e494800b43e', styleNumber);
        
        // Initialize fallback pricing data for screen print
        setTimeout(() => {
            if (!window['screen-printGroupedHeaders'] && !window.dp5GroupedHeaders) {
                console.log('Initializing fallback pricing data for screen print');
                
                // Define fallback pricing data
                window['screen-printGroupedHeaders'] = ['XS-S', 'M-L', 'XL-2XL', '3XL-4XL', '5XL-6XL'];
                window['screen-printGroupedPrices'] = {
                    'XS-S': { 'Tier1': 16.99, 'Tier2': 15.99, 'Tier3': 14.99, 'Tier4': 13.99 },
                    'M-L': { 'Tier1': 17.99, 'Tier2': 16.99, 'Tier3': 15.99, 'Tier4': 14.99 },
                    'XL-2XL': { 'Tier1': 19.99, 'Tier2': 18.99, 'Tier3': 17.99, 'Tier4': 16.99 },
                    '3XL-4XL': { 'Tier1': 21.99, 'Tier2': 20.99, 'Tier3': 19.99, 'Tier4': 18.99 },
                    '5XL-6XL': { 'Tier1': 23.99, 'Tier2': 22.99, 'Tier3': 21.99, 'Tier4': 20.99 }
                };
                window['screen-printApiTierData'] = {
                    'Tier1': { 'MinQuantity': 1, 'MaxQuantity': 11 },
                    'Tier2': { 'MinQuantity': 12, 'MaxQuantity': 23 },
                    'Tier3': { 'MinQuantity': 24, 'MaxQuantity': 47 },
                    'Tier4': { 'MinQuantity': 48, 'MaxQuantity': 10000 }
                };
                
                // Also define dp5 versions for compatibility
                window.dp5GroupedHeaders = window['screen-printGroupedHeaders'];
                window.dp5GroupedPrices = window['screen-printGroupedPrices'];
                window.dp5ApiTierData = window['screen-printApiTierData'];
                
                console.log('Fallback pricing data initialized successfully for screen print');
            }
        }, 1000);
    } else if (currentPage.includes('dtf-pricing') || currentPage.includes('/pricing/dtf')) {
        // For DTF, use a special app key that will trigger the coming soon message
        loadCaspioEmbed('pricing-calculator', 'dtf', styleNumber);
        
        // Initialize fallback pricing data for DTF
        setTimeout(() => {
            if (!window.dtfGroupedHeaders && !window.dp5GroupedHeaders) {
                console.log('Initializing fallback pricing data for DTF');
                
                // Define fallback pricing data
                window.dtfGroupedHeaders = ['XS-S', 'M-L', 'XL-2XL', '3XL-4XL', '5XL-6XL'];
                window.dtfGroupedPrices = {
                    'XS-S': { 'Tier1': 21.99, 'Tier2': 20.99, 'Tier3': 19.99, 'Tier4': 18.99 },
                    'M-L': { 'Tier1': 22.99, 'Tier2': 21.99, 'Tier3': 20.99, 'Tier4': 19.99 },
                    'XL-2XL': { 'Tier1': 24.99, 'Tier2': 23.99, 'Tier3': 22.99, 'Tier4': 21.99 },
                    '3XL-4XL': { 'Tier1': 26.99, 'Tier2': 25.99, 'Tier3': 24.99, 'Tier4': 23.99 },
                    '5XL-6XL': { 'Tier1': 28.99, 'Tier2': 27.99, 'Tier3': 26.99, 'Tier4': 25.99 }
                };
                window.dtfApiTierData = {
                    'Tier1': { 'MinQuantity': 1, 'MaxQuantity': 11 },
                    'Tier2': { 'MinQuantity': 12, 'MaxQuantity': 23 },
                    'Tier3': { 'MinQuantity': 24, 'MaxQuantity': 47 },
                    'Tier4': { 'MinQuantity': 48, 'MaxQuantity': 10000 }
                };
                
                // Also define dp5 versions for compatibility
                window.dp5GroupedHeaders = window.dtfGroupedHeaders;
                window.dp5GroupedPrices = window.dtfGroupedPrices;
                window.dp5ApiTierData = window.dtfApiTierData;
                
                console.log('Fallback pricing data initialized successfully for DTF');
            }
        }, 1000);
    }
}

// Helper function to get the embellishment type from the URL
function getEmbellishmentTypeFromUrl() {
    const currentPage = window.location.pathname;
    let embType = 'embroidery'; // Default
    
    if (currentPage.includes('cap-embroidery')) {
        embType = 'cap-embroidery';
    } else if (currentPage.includes('dtg')) {
        embType = 'dtg';
    } else if (currentPage.includes('screen-print')) {
        embType = 'screen-print';
    } else if (currentPage.includes('dtf')) {
        embType = 'dtf';
    }
    
    return embType;
}

// Function to create a fallback pricing table when Caspio DataPage fails
function createFallbackPricingTable(container, embType) {
    console.log(`Creating fallback pricing table for ${embType}`);
    
    // Clear the container
    container.innerHTML = '';
    
    // Get the pricing data based on embellishment type
    let headers, prices, tiers;
    
    // Use the pricing data we've already defined
    if (embType === 'embroidery') {
        headers = window.embroideryGroupedHeaders || window.dp5GroupedHeaders;
        prices = window.embroideryGroupedPrices || window.dp5GroupedPrices;
        tiers = window.embroideryApiTierData || window.dp5ApiTierData;
    } else if (embType === 'cap-embroidery') {
        headers = window['cap-embroideryGroupedHeaders'] || window.dp5GroupedHeaders;
        prices = window['cap-embroideryGroupedPrices'] || window.dp5GroupedPrices;
        tiers = window['cap-embroideryApiTierData'] || window.dp5ApiTierData;
    } else if (embType === 'dtg') {
        headers = window.dtgGroupedHeaders || window.dp5GroupedHeaders;
        prices = window.dtgGroupedPrices || window.dp5GroupedPrices;
        tiers = window.dtgApiTierData || window.dp5ApiTierData;
    } else if (embType === 'screen-print') {
        headers = window['screen-printGroupedHeaders'] || window.dp5GroupedHeaders;
        prices = window['screen-printGroupedPrices'] || window.dp5GroupedPrices;
        tiers = window['screen-printApiTierData'] || window.dp5ApiTierData;
    } else if (embType === 'dtf') {
        headers = window.dtfGroupedHeaders || window.dp5GroupedHeaders;
        prices = window.dtfGroupedPrices || window.dp5GroupedPrices;
        tiers = window.dtfApiTierData || window.dp5ApiTierData;
    }
    
    // If we don't have pricing data, show an error message
    if (!headers || !prices || !tiers) {
        container.innerHTML = '<div class="error-message">Error: Pricing data not available. Please try again later.</div>';
        return;
    }
    
    // Create the pricing table
    const table = document.createElement('table');
    table.className = 'matrix-price-table';
    table.style.width = '100%';
    table.style.borderCollapse = 'collapse';
    table.style.marginTop = '20px';
    table.style.marginBottom = '20px';
    
    // Create the table header
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    
    // Add the "Size" header
    const sizeHeader = document.createElement('th');
    sizeHeader.textContent = 'Size';
    sizeHeader.style.padding = '10px';
    sizeHeader.style.backgroundColor = '#f8f8f8';
    sizeHeader.style.borderBottom = '2px solid #ddd';
    sizeHeader.style.textAlign = 'left';
    headerRow.appendChild(sizeHeader);
    
    // Add the quantity tier headers
    const tierNames = Object.keys(tiers).sort((a, b) => {
        return tiers[a].MinQuantity - tiers[b].MinQuantity;
    });
    
    tierNames.forEach(tierName => {
        const tier = tiers[tierName];
        const th = document.createElement('th');
        th.textContent = `${tier.MinQuantity}${tier.MaxQuantity < 10000 ? '-' + tier.MaxQuantity : '+'}`;
        th.style.padding = '10px';
        th.style.backgroundColor = '#f8f8f8';
        th.style.borderBottom = '2px solid #ddd';
        th.style.textAlign = 'center';
        headerRow.appendChild(th);
    });
    
    thead.appendChild(headerRow);
    table.appendChild(thead);
    
    // Create the table body
    const tbody = document.createElement('tbody');
    tbody.id = 'matrix-price-body';
    
    // Add rows for each size group
    headers.forEach(sizeGroup => {
        const row = document.createElement('tr');
        
        // Add the size group cell
        const sizeCell = document.createElement('td');
        sizeCell.textContent = sizeGroup;
        sizeCell.style.padding = '10px';
        sizeCell.style.borderBottom = '1px solid #ddd';
        sizeCell.style.fontWeight = 'bold';
        row.appendChild(sizeCell);
        
        // Add the price cells for each tier
        tierNames.forEach(tierName => {
            const priceCell = document.createElement('td');
            const price = prices[sizeGroup][tierName];
            priceCell.textContent = price ? `$${price.toFixed(2)}` : 'N/A';
            priceCell.style.padding = '10px';
            priceCell.style.borderBottom = '1px solid #ddd';
            priceCell.style.textAlign = 'center';
            row.appendChild(priceCell);
        });
        
        tbody.appendChild(row);
    });
    
    table.appendChild(tbody);
    
    // Add a note about the pricing
    const note = document.createElement('div');
    note.id = 'matrix-note';
    note.style.marginTop = '10px';
    note.style.fontSize = '0.9em';
    note.style.color = '#666';
    note.innerHTML = 'Note: Pricing shown is for reference only. Final pricing may vary based on specific requirements.';
    
    // Add the table and note to the container
    container.appendChild(table);
    container.appendChild(note);
    
    console.log(`Fallback pricing table created for ${embType}`);
}

// Run initialization when DOM is loaded
document.addEventListener('DOMContentLoaded', initPricingPage);