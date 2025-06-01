// pricing-matrix-capture-dtg-fix.js
// Fix for DTG pricing matrix capture infinite retry issue

(function() {
    "use strict";
    
    console.log("[DTG-FIX] Loading DTG pricing matrix capture fix");
    
    // Override the checkForPricingData function to handle DTG specially
    const originalCheckForPricingData = window.checkForPricingData;
    
    // Monitor for DTG adapter data
    let dtgDataReceived = false;
    
    // Listen for the pricingDataLoaded event from DTG adapter
    window.addEventListener('pricingDataLoaded', function(event) {
        if (event.detail && event.detail.embellishmentType === 'dtg') {
            console.log("[DTG-FIX] DTG pricing data received from adapter, stopping matrix capture");
            dtgDataReceived = true;
            
            // Stop the capture interval if it exists
            if (window.captureInterval) {
                clearInterval(window.captureInterval);
                window.captureInterval = null;
            }
            
            // Ensure the pricing data is available globally
            if (!window.nwcaPricingData) {
                window.nwcaPricingData = event.detail;
            }
            
            // Set available sizes for UI components
            if (event.detail.uniqueSizes) {
                window.availableSizesFromTable = event.detail.uniqueSizes;
            }
        }
    });
    
    // Override the capture check for DTG pages
    if (window.location.href.includes('dtg')) {
        console.log("[DTG-FIX] DTG page detected, modifying capture behavior");
        
        // Wait for DOM ready
        function waitForDOMAndFix() {
            // Check if we're on a DTG page and if the adapter has already loaded data
            if (window.dtgMasterPriceBundle || window.nwcaPricingData) {
                console.log("[DTG-FIX] DTG data already available, preventing capture loop");
                
                // Clear any existing capture interval
                if (window.captureInterval) {
                    clearInterval(window.captureInterval);
                    window.captureInterval = null;
                }
                
                // Mark capture as completed
                if (window.captureCompleted !== undefined) {
                    window.captureCompleted = true;
                }
                
                return;
            }
            
            // If pricing matrix capture is trying to run, intercept it
            const captureScript = document.querySelector('script[src*="pricing-matrix-capture.js"]');
            if (captureScript) {
                // Add a mutation observer to detect when the capture starts
                const observer = new MutationObserver(function(mutations) {
                    if (dtgDataReceived || window.dtgMasterPriceBundle) {
                        console.log("[DTG-FIX] Stopping capture attempts due to DTG data availability");
                        if (window.captureInterval) {
                            clearInterval(window.captureInterval);
                            window.captureInterval = null;
                        }
                        observer.disconnect();
                    }
                });
                
                observer.observe(document.body, {
                    childList: true,
                    subtree: true
                });
            }
        }
        
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', waitForDOMAndFix);
        } else {
            waitForDOMAndFix();
        }
    }
    
    // Fix for missing cart UI elements
    window.addEventListener('pricingDataLoaded', function(event) {
        if (event.detail && event.detail.embellishmentType === 'dtg') {
            console.log("[DTG-FIX] Creating missing UI elements for cart integration");
            
            // Create size-quantity-grid-container if it doesn't exist
            if (!document.getElementById('size-quantity-grid-container')) {
                const container = document.createElement('div');
                container.id = 'size-quantity-grid-container';
                container.className = 'size-quantity-grid-container';
                
                // Find appropriate parent element
                const cartSection = document.querySelector('.add-to-cart-section') || 
                                  document.querySelector('#add-to-cart-section') ||
                                  document.querySelector('.cart-section');
                
                if (cartSection) {
                    cartSection.appendChild(container);
                    console.log("[DTG-FIX] Created size-quantity-grid-container");
                }
            }
            
            // Ensure pricing table has correct class
            const pricingTable = document.getElementById('custom-pricing-grid');
            if (pricingTable && !pricingTable.classList.contains('matrix-price-table')) {
                pricingTable.classList.add('matrix-price-table');
                console.log("[DTG-FIX] Added matrix-price-table class to pricing grid");
            }
        }
    });
    
    console.log("[DTG-FIX] DTG pricing matrix capture fix initialized");
})();