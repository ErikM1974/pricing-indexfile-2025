// Screen Print Caspio Loader
// This script creates and manages the Caspio iframe for screen print pricing

(function() {
    'use strict';
    
    console.log('[ScreenPrintCaspioLoader] Initializing');
    
    // Configuration
    const CASPIO_APP_KEY = 'a0e150002eb94f9e91e34e2c9990'; // Screen print app key
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
        
        if (!styleNumber || !color) {
            console.warn('[ScreenPrintCaspioLoader] Missing StyleNumber or COLOR parameters');
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
            console.log('[ScreenPrintCaspioLoader] Loading Caspio iframe:', caspioUrl);
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