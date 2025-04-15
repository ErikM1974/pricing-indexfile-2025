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
        
        // Set parameters for the Caspio DataPage
        if (typeof CPFF !== 'undefined' && CPFF.dpObj && CPFF.dpObj.dp5) {
            console.log("Setting Caspio DP5 parameters for style:", styleNumber);
            CPFF.dpObj.dp5.setParam('StyleNumber', styleNumber);
            CPFF.dpObj.dp5.refresh();
        } else {
            console.log("Caspio DP5 object not ready, reloading iframe");
            // If Caspio object isn't available, reload the iframe with the style parameter
            const caspioSrc = `https://c3eku948.caspio.com/dp/a0e150001c7143d027a54c439c01/emb?StyleNumber=${encodeURIComponent(styleNumber)}`;
            dpWrapper.innerHTML = `<iframe src="${caspioSrc}" width="100%" height="600" frameborder="0"></iframe>`;
        }
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
        
        // Set parameters for the Caspio DataPage
        if (typeof CPFF !== 'undefined' && CPFF.dpObj && CPFF.dpObj.dp7) {
            console.log("Setting Caspio DP7 parameters for style:", styleNumber);
            CPFF.dpObj.dp7.setParam('StyleNumber', styleNumber);
            CPFF.dpObj.dp7.refresh();
        } else {
            console.log("Caspio DP7 object not ready, reloading iframe");
            // If Caspio object isn't available, reload the iframe with the style parameter
            const caspioSrc = `https://c3eku948.caspio.com/dp/a0e150004ecd0739f853449c8d7f/emb?StyleNumber=${encodeURIComponent(styleNumber)}`;
            dpWrapper.innerHTML = `<iframe src="${caspioSrc}" width="100%" height="600" frameborder="0"></iframe>`;
        }
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
        
        // Set parameters for the Caspio DataPage
        if (typeof CPFF !== 'undefined' && CPFF.dpObj && CPFF.dpObj.dp6) {
            console.log("Setting Caspio DP6 parameters for style:", styleNumber);
            CPFF.dpObj.dp6.setParam('StyleNumber', styleNumber);
            CPFF.dpObj.dp6.refresh();
        } else {
            console.log("Caspio DP6 object not ready, reloading iframe");
            // If Caspio object isn't available, reload the iframe with the style parameter
            const caspioSrc = `https://c3eku948.caspio.com/dp/a0e150002eb9491a50104c1d99d7/emb?StyleNumber=${encodeURIComponent(styleNumber)}`;
            dpWrapper.innerHTML = `<iframe src="${caspioSrc}" width="100%" height="600" frameborder="0"></iframe>`;
        }
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
        
        // Set parameters for the Caspio DataPage
        if (typeof CPFF !== 'undefined' && CPFF.dpObj && CPFF.dpObj.dp8) {
            console.log("Setting Caspio DP8 parameters for style:", styleNumber);
            CPFF.dpObj.dp8.setParam('StyleNumber', styleNumber);
            CPFF.dpObj.dp8.refresh();
        } else {
            console.log("Caspio DP8 object not ready, reloading iframe");
            // If Caspio object isn't available, reload the iframe with the style parameter
            const caspioSrc = `https://c3eku948.caspio.com/dp/a0e1500026349f420e494800b43e/emb?StyleNumber=${encodeURIComponent(styleNumber)}`;
            dpWrapper.innerHTML = `<iframe src="${caspioSrc}" width="100%" height="600" frameborder="0"></iframe>`;
        }
    } catch (error) {
        console.error("Error initializing screen print data:", error);
        showTabError('dp8-wrapper', `Error loading screen print data: ${error.message}`);
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