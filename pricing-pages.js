/**
 * Shared JavaScript for Pricing Pages
 * Handles URL parameters, navigation, and loading Caspio embedded content
 */

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
    const colorCode = getUrlParameter('COLOR');
    const colorName = colorCode ? decodeURIComponent(colorCode.replace(/\+/g, ' ')) : 'N/A';
    
    console.log(`Product Context: StyleNumber=${styleNumber}, COLOR=${colorCode}, decoded=${colorName}`);
    
    // Update product details text
    document.getElementById('product-style').textContent = styleNumber || 'N/A';
    document.getElementById('product-color').textContent = colorName;
    
    // Update back to product link
    const backLink = document.getElementById('back-to-product');
    if (backLink) {
        backLink.href = `/product?StyleNumber=${encodeURIComponent(styleNumber || '')}&COLOR=${encodeURIComponent(colorCode || '')}`;
    }
    
    // Fetch product details to get image and title
    if (styleNumber) {
        fetchProductDetails(styleNumber, colorCode);
    } else {
        document.getElementById('product-title').textContent = 'Product Not Found';
        document.getElementById('product-image').src = ''; // Placeholder or default image
    }
}

// Fetch product details from API
async function fetchProductDetails(styleNumber, colorCode) {
    try {
        let detailApiUrl = `${API_PROXY_BASE_URL}/api/product-details?styleNumber=${encodeURIComponent(styleNumber)}`;
        
        if (colorCode) {
            // Use both COLOR_NAME and CATALOG_COLOR to ensure we get the right color
            detailApiUrl += `&COLOR_NAME=${encodeURIComponent(colorCode)}&CATALOG_COLOR=${encodeURIComponent(colorCode)}`;
            console.log(`Using color code for API request: ${colorCode}`);
        } else {
            console.log("No color code provided for product details");
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
            document.getElementById('product-image').alt = `${details.PRODUCT_TITLE || styleNumber} - ${colorCode || 'Default'}`;
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
    
    // Get color parameter if available
    const colorCode = getUrlParameter('COLOR');
    console.log(`Caspio Embed: Using color code from URL: ${colorCode || 'None'}`);
    
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
    
    // Add parameters to the URL
    const params = new URLSearchParams();
    params.append('StyleNumber', styleNumber);
    if (colorCode) {
        params.append('COLOR', colorCode);
    }
    
    // Set the script src with parameters
    script.src = `${caspioUrl}?${params.toString()}`;
    
    // Add event listeners for script loading
    script.onload = function() {
        console.log(`${caspioAppKey} script loaded successfully`);
        // Remove loading message when script is loaded
        const loadingMsg = container.querySelector('.loading-message');
        if (loadingMsg) loadingMsg.style.display = 'none';
    };
    
    script.onerror = function() {
        console.error(`Error loading ${caspioAppKey} script`);
        container.innerHTML = '<div class="error-message">Error loading pricing calculator. Please try again later.</div>';
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
    } else if (currentPage.includes('cap-embroidery-pricing') || currentPage.includes('/pricing/cap-embroidery')) {
        loadCaspioEmbed('pricing-calculator', 'a0e150004ecd0739f853449c8d7f', styleNumber);
    } else if (currentPage.includes('dtg-pricing') || currentPage.includes('/pricing/dtg')) {
        loadCaspioEmbed('pricing-calculator', 'a0e150002eb9491a50104c1d99d7', styleNumber);
    } else if (currentPage.includes('screen-print-pricing') || currentPage.includes('/pricing/screen-print')) {
        loadCaspioEmbed('pricing-calculator', 'a0e1500026349f420e494800b43e', styleNumber);
    } else if (currentPage.includes('dtf-pricing') || currentPage.includes('/pricing/dtf')) {
        // For DTF, use a special app key that will trigger the coming soon message
        loadCaspioEmbed('pricing-calculator', 'dtf', styleNumber);
    }
}

// Run initialization when DOM is loaded
document.addEventListener('DOMContentLoaded', initPricingPage);