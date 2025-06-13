// Screen Print Caspio Loader
// This script creates and manages the Caspio iframe for screen print pricing

(function() {
    'use strict';
    
    console.log('[ScreenPrintCaspioLoader] Initializing');
    
    // Configuration
    const CASPIO_APP_KEY = 'a0e1500026349f420e494800b43e'; // Screen print app key - Updated to confirmed correct AppKey
    const CASPIO_DOMAIN = 'https://c3eku948.caspio.com';
    
    // Create and inject the Caspio iframe
    function createCaspioIframe() {
        // Check if iframe already exists
        if (document.getElementById('screenprint-caspio-iframe')) {
            console.log('[ScreenPrintCaspioLoader] Iframe already exists');
            return;
        }
        
        // Get URL parameters
        const urlParams = new URLSearchParams(window.location.search);
        const styleNumber = urlParams.get('StyleNumber') || '';
        const color = urlParams.get('COLOR') || '';
        console.log(`[ScreenPrintCaspioLoader] URL Params: StyleNumber='${styleNumber}', COLOR='${color}'`);
        
        if (!styleNumber || !color) {
            console.warn('[ScreenPrintCaspioLoader] CRITICAL: Missing StyleNumber or COLOR parameters. Iframe will not be created.');
            return;
        }
        
        // Create iframe container
        const container = document.createElement('div');
        container.id = 'screenprint-caspio-container';
        container.style.cssText = 'display: none; position: absolute; left: -9999px;';
        
        // Create iframe
        const iframe = document.createElement('iframe');
        iframe.id = 'screenprint-caspio-iframe';
        iframe.name = 'screenprint-caspio-iframe';
        
        // For testing, use the mock page
        const isMockMode = window.location.search.includes('mock=true') ||
                          window.location.protocol === 'file:';
        
        if (isMockMode) {
            iframe.src = '/test-files/test-screenprint-caspio-mock.html';
            console.log('[ScreenPrintCaspioLoader] Using mock Caspio page for testing');
        } else {
            // Build Caspio URL
            const caspioUrl = `${CASPIO_DOMAIN}/dp/${CASPIO_APP_KEY}?StyleNumber=${encodeURIComponent(styleNumber)}&COLOR=${encodeURIComponent(color)}`;
            iframe.src = caspioUrl;
            console.log('[ScreenPrintCaspioLoader] Attempting to load REAL Caspio iframe. SRC:', caspioUrl);
        }
        
        // Set iframe attributes
        iframe.width = '1';
        iframe.height = '1';
        iframe.frameBorder = '0';
        iframe.setAttribute('aria-hidden', 'true');
        
        // Add to container and document
        container.appendChild(iframe);
        document.body.appendChild(container);
        
        console.log('[ScreenPrintCaspioLoader] Iframe created and added to page');
    }
    
    // Initialize when DOM is ready
    function init() {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', createCaspioIframe);
        } else {
            createCaspioIframe();
        }
    }
    
    // Auto-initialize
    init();
    
    // Export for manual control
    window.ScreenPrintCaspioLoader = {
        createCaspioIframe,
        init
    };
})();