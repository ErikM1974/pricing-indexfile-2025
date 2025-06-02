// Cap Embroidery Back Logo functionality
(function() {
    'use strict';

    console.log('[CAP-EMB-BACK-LOGO] Initializing back logo functionality');

    // Back logo configuration
    const BACK_LOGO_CONFIG = {
        enabled: false, // Default to disabled
        price: 5.00,    // Default price per item
        stitchCount: 5000 // Default stitch count for back logo
    };

    // Create global object for back logo functionality
    window.capEmbroideryBackLogo = {
        isEnabled: function() {
            return BACK_LOGO_CONFIG.enabled;
        },

        setEnabled: function(enabled) {
            BACK_LOGO_CONFIG.enabled = !!enabled;
            console.log(`[CAP-EMB-BACK-LOGO] Back logo ${enabled ? 'enabled' : 'disabled'}`);
            
            // Trigger UI update
            if (window.updateCartTotal) {
                window.updateCartTotal();
            }
        },

        getPricePerItem: function() {
            return BACK_LOGO_CONFIG.price;
        },

        setPrice: function(price) {
            const numPrice = parseFloat(price);
            if (!isNaN(numPrice) && numPrice >= 0) {
                BACK_LOGO_CONFIG.price = numPrice;
                console.log(`[CAP-EMB-BACK-LOGO] Back logo price set to $${numPrice.toFixed(2)}`);
                
                // Trigger UI update
                if (window.updateCartTotal) {
                    window.updateCartTotal();
                }
            }
        },

        getStitchCount: function() {
            return BACK_LOGO_CONFIG.stitchCount;
        },

        setStitchCount: function(count) {
            const numCount = parseInt(count);
            if (!isNaN(numCount) && numCount > 0) {
                BACK_LOGO_CONFIG.stitchCount = numCount;
                // Calculate price based on stitch count (same as front logo pricing)
                BACK_LOGO_CONFIG.price = Math.ceil(numCount / 1000);
                console.log(`[CAP-EMB-BACK-LOGO] Back logo stitch count set to ${numCount}, price: $${BACK_LOGO_CONFIG.price}`);
                
                // Trigger UI update
                if (window.updateCartTotal) {
                    window.updateCartTotal();
                }
            }
        },

        // Initialize UI elements for back logo option
        initializeUI: function() {
            console.log('[CAP-EMB-BACK-LOGO] Initializing UI elements');
            
            // Check if checkbox already exists from cap-embroidery-enhanced.js
            let checkbox = document.getElementById('back-logo-checkbox');
            
            if (checkbox) {
                console.log('[CAP-EMB-BACK-LOGO] Found existing back logo checkbox, attaching listener');
                
                // Remove any existing listeners to avoid duplicates
                const newCheckbox = checkbox.cloneNode(true);
                checkbox.parentNode.replaceChild(newCheckbox, checkbox);
                checkbox = newCheckbox;
                
                // Add our event listener
                checkbox.addEventListener('change', function() {
                    window.capEmbroideryBackLogo.setEnabled(this.checked);
                    console.log('[CAP-EMB-BACK-LOGO] Back logo toggled:', this.checked);

                    // Also handle visibility of details here, as this listener is the one firing
                    const detailsDiv = document.getElementById('back-logo-details');
                    const pricingDisplaySectionDiv = document.getElementById('back-logo-pricing-display');

                    if (detailsDiv) {
                        detailsDiv.style.setProperty('display', this.checked ? 'block' : 'none', 'important');
                        console.log('[CAP-EMB-BACK-LOGO] Set detailsDiv.style.display to:', detailsDiv.style.display);
                    } else {
                        console.warn('[CAP-EMB-BACK-LOGO] #back-logo-details not found in its own listener.');
                    }
                    if (pricingDisplaySectionDiv) {
                        pricingDisplaySectionDiv.style.setProperty('display', this.checked ? 'block' : 'none', 'important');
                        console.log('[CAP-EMB-BACK-LOGO] Set pricingDisplaySectionDiv.style.display to:', pricingDisplaySectionDiv.style.display);
                    }

                });
                
                // Set initial state
                checkbox.checked = BACK_LOGO_CONFIG.enabled;
            } else {
                console.warn('[CAP-EMB-BACK-LOGO] No existing back logo checkbox found');
            }
            
            // Listen for back logo stitch count changes
            const backLogoStitchSelect = document.getElementById('back-logo-stitch-count');
            if (backLogoStitchSelect) {
                // Remove any existing listeners
                const newSelect = backLogoStitchSelect.cloneNode(true);
                backLogoStitchSelect.parentNode.replaceChild(newSelect, backLogoStitchSelect);
                
                newSelect.addEventListener('input', function() { // Changed to 'input' for better responsiveness
                    const stitchCount = parseInt(this.value);
                    console.log('[CAP-EMB-BACK-LOGO] Back logo stitch count INPUT event. Value: ' + this.value + ', Parsed: ' + stitchCount);
                    
                    if (!isNaN(stitchCount) && stitchCount > 0) {
                        window.capEmbroideryBackLogo.setStitchCount(stitchCount); // This updates BACK_LOGO_CONFIG and calls updateCartTotal

                        // Now, directly update the UI elements for back logo price display
                        const priceForDisplay = BACK_LOGO_CONFIG.price; // Get the price calculated by setStitchCount

                        const priceDisplayElement = document.getElementById('back-logo-price'); // Next to input
                        if (priceDisplayElement) {
                            priceDisplayElement.textContent = `Price: $${priceForDisplay.toFixed(2)} per item`;
                            console.log(`[CAP-EMB-BACK-LOGO] UI Updated #back-logo-price to: ${priceDisplayElement.textContent}`);
                        }

                        const displayStitchCountElement = document.getElementById('back-logo-display-stitch-count'); // In separate blue box
                        if (displayStitchCountElement) {
                            displayStitchCountElement.textContent = `${stitchCount.toLocaleString()} stitches`;
                            console.log(`[CAP-EMB-BACK-LOGO] UI Updated #back-logo-display-stitch-count to: ${displayStitchCountElement.textContent}`);
                        }

                        const displayPriceElementInSection = document.getElementById('back-logo-display-price'); // In separate blue box
                        if (displayPriceElementInSection) {
                            displayPriceElementInSection.textContent = `$${priceForDisplay.toFixed(2)} per item`;
                            console.log(`[CAP-EMB-BACK-LOGO] UI Updated #back-logo-display-price to: ${displayPriceElementInSection.textContent}`);
                        }
                        
                        // Also, ensure the main pricing explanation note updates
                        if (typeof updatePricingExplanation === 'function') { // This function is in cap-embroidery-enhanced.js
                            updatePricingExplanation();
                        } else if (window.CapEmbroideryEnhanced && typeof window.CapEmbroideryEnhanced.updatePricingExplanation === 'function'){
                            // This is not how it's exposed. updatePricingExplanation is not part of the CapEmbroideryEnhanced object.
                            // It's a private function within the IIFE of cap-embroidery-enhanced.js.
                            // For now, we rely on updateCartTotal to trigger other necessary updates.
                            // A better solution would be a custom event or a shared update manager.
                        }
                         if (window.updatePricingExplanation) window.updatePricingExplanation();


                    } else {
                        console.log('[CAP-EMB-BACK-LOGO] Invalid stitch count input:', this.value);
                    }
                });
                
                // Set initial stitch count
                const initialCount = parseInt(newSelect.value);
                if (!isNaN(initialCount)) {
                    window.capEmbroideryBackLogo.setStitchCount(initialCount);
                }
            }

            console.log('[CAP-EMB-BACK-LOGO] Initialization complete');
        }
    };

    // Initialize when DOM is ready
    function initialize() {
        // Only initialize on cap embroidery pages
        const isCapEmbroidery = window.location.href.toLowerCase().includes('cap-embroidery') || 
                               document.title.toLowerCase().includes('cap embroidery');
        
        if (!isCapEmbroidery) {
            console.log('[CAP-EMB-BACK-LOGO] Not a cap embroidery page, skipping initialization');
            return;
        }

        window.capEmbroideryBackLogo.initializeUI();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        // DOM is already loaded
        setTimeout(initialize, 100); // Small delay to ensure other scripts are loaded
    }

})();