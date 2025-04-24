// Add to Cart functionality for embroidery pricing pages
(function() {
    "use strict";

    console.log("[ADD-TO-CART] Initializing add to cart functionality");

    // Function to add necessary elements for cart integration
    function addCartIntegrationElements() {
        console.log("[ADD-TO-CART] Adding cart integration elements");

        // Check if elements already exist
        if (document.getElementById('matrix-note') && document.getElementById('matrix-title')) {
            console.log("[ADD-TO-CART] Cart integration elements already exist");
            return;
        }

        // 1. Add matrix-title element
        const pricingInfo = document.querySelector('.pricing-info');
        if (pricingInfo) {
            const titleElement = document.createElement('div');
            titleElement.id = 'matrix-title';
            titleElement.style.display = 'none'; // Hide it as it's just for cart integration
            pricingInfo.appendChild(titleElement);
            console.log("[ADD-TO-CART] Added matrix-title element");
        }

        // 2. Add matrix-note element
        const pricingCalculator = document.getElementById('pricing-calculator');
        if (pricingCalculator) {
            const noteElement = document.createElement('div');
            noteElement.id = 'matrix-note';
            noteElement.style.display = 'block'; // This needs to be visible for the cart button
            pricingCalculator.appendChild(noteElement);
            console.log("[ADD-TO-CART] Added matrix-note element");
        }
    }

    // Function to initialize cart integration
    function initializeCartIntegration() {
        console.log("[ADD-TO-CART] Initializing cart integration");
        
        // First add the necessary elements
        addCartIntegrationElements();
        
        // Then initialize cart integration if available
        if (window.initCartIntegration && typeof window.initCartIntegration === 'function') {
            console.log("[ADD-TO-CART] Calling initCartIntegration");
            window.initCartIntegration();
        } else {
            console.warn("[ADD-TO-CART] initCartIntegration function not found");
            
            // Try again after a short delay
            setTimeout(() => {
                if (window.initCartIntegration && typeof window.initCartIntegration === 'function') {
                    console.log("[ADD-TO-CART] Calling initCartIntegration after delay");
                    window.initCartIntegration();
                } else {
                    console.error("[ADD-TO-CART] initCartIntegration function still not found after delay");
                }
            }, 1000);
        }
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeCartIntegration);
    } else {
        // DOM already loaded, initialize immediately
        initializeCartIntegration();
    }

    // Also initialize when Caspio content is loaded
    // This is a backup in case the DOM ready event fires before Caspio content is loaded
    const observer = new MutationObserver(function(mutations) {
        if (document.querySelector('.matrix-price-table') || 
            document.querySelector('.cbResultSetTable') || 
            document.querySelector('#matrix-price-body') || 
            document.querySelector('.cbResultSet')) {
            
            console.log("[ADD-TO-CART] Caspio content detected, initializing cart integration");
            initializeCartIntegration();
            observer.disconnect();
        }
    });

    // Start observing the document
    observer.observe(document.body, { childList: true, subtree: true });

    // Also try after a fixed delay as a fallback
    setTimeout(initializeCartIntegration, 3000);

})();