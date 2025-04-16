/**
 * Tab Initialization Functions for Product Page
 * 
 * This file contains the initialization functions for the different tabs
 * in the product.html page (embroidery, cap embroidery, DTG, screenprint).
 * 
 * These functions are called when a tab is clicked to load the appropriate data.
 */

// Base API URL
const API_PROXY_BASE_URL = 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';

/**
 * Initialize Embroidery Tab Data
 * @param {string} styleNumber - The product style number
 */
function initDp5ApiFetch(styleNumber) {
    console.log("Initializing Embroidery tab data for style:", styleNumber);
    
    if (!styleNumber) {
        console.error("No style number provided for embroidery data initialization");
        showTabError('dp5-wrapper', 'No style number provided. Please search for a product first.');
        return;
    }
    
    try {
        // Get the DP wrapper element
        const dpWrapper = document.getElementById('dp5-wrapper');
        if (!dpWrapper) {
            console.error("Embroidery tab wrapper element not found");
            return;
        }
        
        // Show loading indicator
        dpWrapper.innerHTML = '<div class="loading-message">Loading embroidery pricing data...</div>';
        
        // Use the direct Caspio iframe approach
        console.log("Loading embroidery data via Caspio iframe for style:", styleNumber);
        
        // Create the iframe URL with the style parameter
        const caspioSrc = `https://c3eku948.caspio.com/dp/a0e15000c5d8e1f2e9e94c3c9a5a/emb?StyleNumber=${encodeURIComponent(styleNumber)}`;
        
        // Create a new iframe element
        const iframe = document.createElement('iframe');
        iframe.src = caspioSrc;
        iframe.width = "100%";
        iframe.height = "600";
        iframe.frameBorder = "0";
        iframe.title = "Embroidery Pricing Calculator";
        iframe.style.display = "block";
        iframe.style.visibility = "visible";
        iframe.style.border = "none";
        iframe.scrolling = "auto";
        
        // Add loading and error handling
        iframe.onload = function() {
            console.log("Embroidery iframe loaded successfully");
            // Hide loading message if it still exists
            const loadingMsg = dpWrapper.querySelector('.loading-message');
            if (loadingMsg) loadingMsg.style.display = 'none';
        };
        
        iframe.onerror = function() {
            console.error("Error loading embroidery iframe");
            dpWrapper.innerHTML = '<div class="error-message">Error loading embroidery pricing calculator. Please try again later.</div>';
        };
        
        // Clear the wrapper and append the iframe
        dpWrapper.innerHTML = '';
        dpWrapper.appendChild(iframe);
    } catch (error) {
        console.error("Error initializing embroidery data:", error);
        showTabError('dp5-wrapper', `Error loading embroidery data: ${error.message}`);
    }
}

/**
 * Initialize Cap Embroidery Tab Data
 * @param {string} styleNumber - The product style number
 */
function initDp7ApiFetch(styleNumber) {
    console.log("Initializing Cap Embroidery tab data for style:", styleNumber);
    
    if (!styleNumber) {
        console.error("No style number provided for cap embroidery data initialization");
        showTabError('dp7-wrapper', 'No style number provided. Please search for a product first.');
        return;
    }
    
    try {
        // Get the DP wrapper element
        const dpWrapper = document.getElementById('dp7-wrapper');
        if (!dpWrapper) {
            console.error("Cap Embroidery tab wrapper element not found");
            return;
        }
        
        // Show loading indicator
        dpWrapper.innerHTML = '<div class="loading-message">Loading cap embroidery pricing data...</div>';
        
        // Use the direct Caspio iframe approach
        console.log("Loading cap embroidery data via Caspio iframe for style:", styleNumber);
        
        // Create the iframe URL with the style parameter
        const caspioSrc = `https://c3eku948.caspio.com/dp/a0e150004ecd0739f853449c8d7f/emb?StyleNumber=${encodeURIComponent(styleNumber)}`;
        
        // Create a new iframe element
        const iframe = document.createElement('iframe');
        iframe.src = caspioSrc;
        iframe.width = "100%";
        iframe.height = "600";
        iframe.frameBorder = "0";
        iframe.title = "Cap Embroidery Pricing Calculator";
        iframe.style.display = "block";
        iframe.style.visibility = "visible";
        iframe.style.border = "none";
        iframe.scrolling = "auto";
        
        // Add loading and error handling
        iframe.onload = function() {
            console.log("Cap Embroidery iframe loaded successfully");
            // Hide loading message if it still exists
            const loadingMsg = dpWrapper.querySelector('.loading-message');
            if (loadingMsg) loadingMsg.style.display = 'none';
        };
        
        iframe.onerror = function() {
            console.error("Error loading cap embroidery iframe");
            dpWrapper.innerHTML = '<div class="error-message">Error loading cap embroidery pricing calculator. Please try again later.</div>';
        };
        
        // Clear the wrapper and append the iframe
        dpWrapper.innerHTML = '';
        dpWrapper.appendChild(iframe);
    } catch (error) {
        console.error("Error initializing cap embroidery data:", error);
        showTabError('dp7-wrapper', `Error loading cap embroidery data: ${error.message}`);
    }
}

/**
 * Initialize DTG Tab Data
 * @param {string} styleNumber - The product style number
 */
function initDp6ApiFetch(styleNumber) {
    console.log("Initializing DTG tab data for style:", styleNumber);
    
    if (!styleNumber) {
        console.error("No style number provided for DTG data initialization");
        showTabError('dp6-wrapper', 'No style number provided. Please search for a product first.');
        return;
    }
    
    try {
        // Get the DP wrapper element
        const dpWrapper = document.getElementById('dp6-wrapper');
        if (!dpWrapper) {
            console.error("DTG tab wrapper element not found");
            return;
        }
        
        // Show loading indicator
        dpWrapper.innerHTML = '<div class="loading-message">Loading DTG pricing data...</div>';
        
        // Use the direct Caspio iframe approach
        console.log("Loading DTG data via Caspio iframe for style:", styleNumber);
        
        // Create the iframe URL with the style parameter
        const caspioSrc = `https://c3eku948.caspio.com/dp/a0e150002eb9491a50104c1d99d7/emb?StyleNumber=${encodeURIComponent(styleNumber)}`;
        
        // Create a new iframe element
        const iframe = document.createElement('iframe');
        iframe.src = caspioSrc;
        iframe.width = "100%";
        iframe.height = "600";
        iframe.frameBorder = "0";
        iframe.title = "DTG Pricing Calculator";
        iframe.style.display = "block";
        iframe.style.visibility = "visible";
        iframe.style.border = "none";
        iframe.scrolling = "auto";
        
        // Add loading and error handling
        iframe.onload = function() {
            console.log("DTG iframe loaded successfully");
            // Hide loading message if it still exists
            const loadingMsg = dpWrapper.querySelector('.loading-message');
            if (loadingMsg) loadingMsg.style.display = 'none';
        };
        
        iframe.onerror = function() {
            console.error("Error loading DTG iframe");
            dpWrapper.innerHTML = '<div class="error-message">Error loading DTG pricing calculator. Please try again later.</div>';
        };
        
        // Clear the wrapper and append the iframe
        dpWrapper.innerHTML = '';
        dpWrapper.appendChild(iframe);
    } catch (error) {
        console.error("Error initializing DTG data:", error);
        showTabError('dp6-wrapper', `Error loading DTG data: ${error.message}`);
    }
}

/**
 * Initialize Screen Print Tab Data
 * @param {string} styleNumber - The product style number
 */
function initDp8ApiFetch(styleNumber) {
    console.log("Initializing Screen Print tab data for style:", styleNumber);
    
    if (!styleNumber) {
        console.error("No style number provided for screen print data initialization");
        showTabError('dp8-wrapper', 'No style number provided. Please search for a product first.');
        return;
    }
    
    try {
        // Get the DP wrapper element
        const dpWrapper = document.getElementById('dp8-wrapper');
        if (!dpWrapper) {
            console.error("Screen Print tab wrapper element not found");
            return;
        }
        
        // Show loading indicator
        dpWrapper.innerHTML = '<div class="loading-message">Loading screen print pricing data...</div>';
        
        // Use the direct Caspio iframe approach
        console.log("Loading Screen Print data via Caspio iframe for style:", styleNumber);
        
        // Create the iframe URL with the style parameter
        const caspioSrc = `https://c3eku948.caspio.com/dp/a0e1500026349f420e494800b43e/emb?StyleNumber=${encodeURIComponent(styleNumber)}`;
        
        // Set the iframe directly using innerHTML
        dpWrapper.innerHTML = `<iframe src="${caspioSrc}" width="100%" height="600" frameborder="0" title="Screen Print Pricing Calculator"></iframe>`;
    } catch (error) {
        console.error("Error initializing screen print data:", error);
        showTabError('dp8-wrapper', `Error loading screen print data: ${error.message}`);
    }
}

/**
 * Initialize DTF Tab Data (Coming Soon)
 * @param {string} styleNumber - The product style number
 */
function initDtfApiFetch(styleNumber) {
    console.log("Initializing DTF tab data for style:", styleNumber);
    
    if (!styleNumber) {
        console.error("No style number provided for DTF data initialization");
        showTabError('dtf-wrapper', 'No style number provided. Please search for a product first.');
        return;
    }
    
    try {
        // Get the DP wrapper element
        const dpWrapper = document.getElementById('dtf-wrapper');
        if (!dpWrapper) {
            console.error("DTF tab wrapper element not found");
            return;
        }
        
        // Show a "Coming Soon" message for DTF pricing
        console.log("Showing DTF 'Coming Soon' message for style:", styleNumber);
        
        // Create a styled "Coming Soon" message
        const comingSoonHtml = `
            <div style="text-align: center; padding: 40px 20px;">
                <h3 style="color: #0056b3; margin-bottom: 20px;">DTF Pricing Coming Soon</h3>
                <p style="color: #555; max-width: 600px; margin: 0 auto; line-height: 1.5;">
                    We're currently working on adding Direct-to-Film (DTF) pricing to our catalog.
                    DTF offers exceptional quality prints with vibrant colors and excellent durability.
                    <br><br>
                    Please check back soon for pricing information, or contact our sales team for custom quotes.
                </p>
                <div style="margin-top: 20px; font-size: 0.9em; color: #777;">
                    Style: ${styleNumber}
                </div>
            </div>
        `;
        
        // Set the HTML content
        dpWrapper.innerHTML = comingSoonHtml;
    } catch (error) {
        console.error("Error initializing DTF data:", error);
        showTabError('dtf-wrapper', `Error loading DTF data: ${error.message}`);
    }
}

/**
 * Helper function to show error messages in tab content
 * @param {string} wrapperId - The ID of the wrapper element
 * @param {string} message - The error message to display
 */
function showTabError(wrapperId, message) {
    const wrapper = document.getElementById(wrapperId);
    if (wrapper) {
        wrapper.innerHTML = `
            <div class="error-message" style="padding: 15px; background-color: #fff0f0; border-left: 4px solid #c00; margin: 15px 0;">
                <p style="color: #c00; font-weight: bold;">${message}</p>
                <p>Try searching for a different product or refreshing the page.</p>
            </div>
        `;
    }
}

/**
 * Helper function to clean up script content from tab panels
 * This is a simplified version since we're using iframes properly
 * @param {string} panelId - The ID of the tab panel to clean
 */
function cleanScriptContentFromPanel(panelId) {
    const panel = document.getElementById(panelId);
    if (!panel) return;
    
    console.log(`Cleaning script content from panel: ${panelId}`);
    
    // Add a style tag to hide script content
    const styleId = `clean-script-style-${panelId}`;
    if (!document.getElementById(styleId)) {
        const styleTag = document.createElement('style');
        styleTag.id = styleId;
        styleTag.textContent = `
            /* Hide script-like content in ${panelId} */
            #${panelId} > *:not([id$="-wrapper"]):not(.loading-message):not(.iframe-container):not(.error-message) {
                display: none !important;
                visibility: hidden !important;
            }
            
            /* Ensure iframe container and loading message are visible */
            #${panelId} [id$="-wrapper"],
            #${panelId} .loading-message,
            #${panelId} .iframe-container,
            #${panelId} iframe,
            #${panelId} .error-message {
                display: block !important;
                visibility: visible !important;
            }
        `;
        document.head.appendChild(styleTag);
    }
    
    console.log(`Finished cleaning script content from panel: ${panelId}`);
}

// Add a MutationObserver to clean script content whenever the DOM changes
document.addEventListener('DOMContentLoaded', () => {
    const tabLinks = document.querySelectorAll('.tab-link');
    const tabContentPanels = document.querySelectorAll('.tab-content-panel');

    tabLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();

            // Remove .active from all tabs and panels
            tabLinks.forEach(l => l.classList.remove('active'));
            tabContentPanels.forEach(p => p.classList.remove('active'));

            // Add .active to clicked tab and its panel
            link.classList.add('active');
            const targetId = link.getAttribute('data-tab-target');
            if (targetId) {
                const panel = document.querySelector(targetId);
                if (panel) {
                    panel.classList.add('active');
                    setTimeout(() => {
                        cleanScriptContentFromPanel(targetId.substring(1));
                    }, 100);

                    // Call the correct initializer based on the panel
                    const styleNumber = window.selectedStyleNumber;
                    if (styleNumber) {
                        switch (targetId) {
                            case '#embroidery-panel':
                                initDp5ApiFetch(styleNumber);
                                break;
                            case '#cap-emb-panel':
                                initDp7ApiFetch(styleNumber);
                                break;
                            case '#dtg-panel':
                                initDp6ApiFetch(styleNumber);
                                break;
                            case '#screenprint-panel':
                                initDp8ApiFetch(styleNumber);
                                break;
                            case '#dtf-panel':
                                initDtfApiFetch(styleNumber);
                                break;
                            // Add more cases as needed
                        }
                    }
                }
            }
        });
    });

    // Set up a simpler approach for each tab panel
    const tabPanels = [
        'embroidery-panel',
        'cap-emb-panel',
        'dtg-panel',
        'screenprint-panel',
        'dtf-panel'
    ];
    
    // Apply initial style to hide any script content
    tabPanels.forEach(panelId => {
        const panel = document.getElementById(panelId);
        if (panel) {
            cleanScriptContentFromPanel(panelId);
        }
    });
    
    // Clean content when tabs are clicked (simplified)
    const tabLinks2 = document.querySelectorAll('.tab-link');
    tabLinks2.forEach(link => {
        link.addEventListener('click', () => {
            const targetId = link.getAttribute('data-tab-target');
            if (targetId) {
                // Remove the # from the ID
                const panelId = targetId.substring(1);
                
                // Apply the clean-up style
                cleanScriptContentFromPanel(panelId);
                
                // Also apply after a delay to catch any dynamic content
                setTimeout(() => {
                    cleanScriptContentFromPanel(panelId);
                }, 500);
            }
        });
    });
});