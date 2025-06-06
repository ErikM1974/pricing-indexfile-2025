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
            
            // Dispatch event for other components
            window.dispatchEvent(new CustomEvent('backLogoChanged', {
                detail: {
                    enabled: BACK_LOGO_CONFIG.enabled,
                    price: BACK_LOGO_CONFIG.price,
                    stitchCount: BACK_LOGO_CONFIG.stitchCount
                }
            }));
            
            // Also dispatch the events that other components are listening for
            window.dispatchEvent(new CustomEvent('backLogoToggled', {
                detail: {
                    enabled: BACK_LOGO_CONFIG.enabled,
                    price: BACK_LOGO_CONFIG.price,
                    stitchCount: BACK_LOGO_CONFIG.stitchCount
                }
            }));
            
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
                
                // Dispatch event for components listening to stitch count changes
                window.dispatchEvent(new CustomEvent('backLogoUpdated', {
                    detail: {
                        enabled: BACK_LOGO_CONFIG.enabled,
                        price: BACK_LOGO_CONFIG.price,
                        stitchCount: BACK_LOGO_CONFIG.stitchCount
                    }
                }));
                
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
                        if (this.checked) {
                            detailsDiv.style.display = 'block';
                            detailsDiv.classList.add('show');
                            // Force a reflow to ensure the change takes effect
                            detailsDiv.offsetHeight;
                        } else {
                            detailsDiv.style.display = 'none';
                            detailsDiv.classList.remove('show');
                        }
                        console.log('[CAP-EMB-BACK-LOGO] Details div display:', detailsDiv.style.display, 'computed:', window.getComputedStyle(detailsDiv).display);
                    } else {
                        console.warn('[CAP-EMB-BACK-LOGO] #back-logo-details not found');
                    }
                    
                    if (pricingDisplaySectionDiv) {
                        pricingDisplaySectionDiv.style.setProperty('display', this.checked ? 'block' : 'none', 'important');
                        console.log('[CAP-EMB-BACK-LOGO] Set pricingDisplaySectionDiv.style.display to:', pricingDisplaySectionDiv.style.display);
                    }
                    
                    // Force hero calculator update
                    if (window.HeroQuantityCalculator && window.HeroQuantityCalculator.updateDisplay) {
                        console.log('[CAP-EMB-BACK-LOGO] Forcing hero calculator update');
                        setTimeout(() => {
                            window.HeroQuantityCalculator.updateBackLogoState();
                            window.HeroQuantityCalculator.updateDisplay();
                        }, 100);
                    }
                    
                    // Also force hero breakdown update
                    if (window.updateCapEmbroideryHeroBreakdown) {
                        console.log('[CAP-EMB-BACK-LOGO] Forcing hero breakdown update');
                        window.updateCapEmbroideryHeroBreakdown();
                    }

                });
                
                // Set initial state from checkbox or config
                BACK_LOGO_CONFIG.enabled = checkbox.checked;
                console.log('[CAP-EMB-BACK-LOGO] Initial checkbox state:', checkbox.checked, 'Setting config to match');
            } else {
                console.warn('[CAP-EMB-BACK-LOGO] No existing back logo checkbox found');
            }
            
            // Listen for back logo stitch count changes (using increment/decrement buttons)
            const backLogoIncrementBtn = document.getElementById('back-logo-increment');
            const backLogoDecrementBtn = document.getElementById('back-logo-decrement');
            const backLogoStitchDisplay = document.getElementById('back-logo-stitch-display');
            
            if (backLogoIncrementBtn && backLogoDecrementBtn && backLogoStitchDisplay) {
                console.log('[CAP-EMB-BACK-LOGO] Found back logo stitch count controls');
                
                const updateStitchCount = (delta) => {
                    // Parse current value from display
                    const currentText = backLogoStitchDisplay.textContent;
                    const currentValue = parseInt(currentText.replace(/[^0-9]/g, '')) || 5000;
                    
                    // Calculate new value
                    let newValue = currentValue + delta;
                    
                    // Clamp to 5000-15000 range
                    newValue = Math.max(5000, Math.min(15000, newValue));
                    
                    // Update display
                    backLogoStitchDisplay.textContent = newValue.toLocaleString();
                    
                    // Update internal state
                    window.capEmbroideryBackLogo.setStitchCount(newValue);
                    
                    // Update price display
                    const priceForDisplay = BACK_LOGO_CONFIG.price;
                    const priceDisplayElement = document.getElementById('back-logo-price');
                    if (priceDisplayElement) {
                        priceDisplayElement.textContent = `Additional Cost: $${priceForDisplay.toFixed(2)} per cap`;
                    }
                    
                    // Force hero calculator update
                    if (window.HeroQuantityCalculator && window.HeroQuantityCalculator.updateDisplay) {
                        console.log('[CAP-EMB-BACK-LOGO] Forcing hero calculator update after stitch count change');
                        setTimeout(() => {
                            window.HeroQuantityCalculator.updateBackLogoState();
                            window.HeroQuantityCalculator.updateDisplay();
                        }, 100);
                    }
                    
                    // Also force hero breakdown update
                    if (window.updateCapEmbroideryHeroBreakdown) {
                        console.log('[CAP-EMB-BACK-LOGO] Forcing hero breakdown update after stitch count change');
                        window.updateCapEmbroideryHeroBreakdown();
                    }
                };
                
                // Remove existing listeners
                const newIncrementBtn = backLogoIncrementBtn.cloneNode(true);
                const newDecrementBtn = backLogoDecrementBtn.cloneNode(true);
                backLogoIncrementBtn.parentNode.replaceChild(newIncrementBtn, backLogoIncrementBtn);
                backLogoDecrementBtn.parentNode.replaceChild(newDecrementBtn, backLogoDecrementBtn);
                
                // Add event listeners
                newIncrementBtn.addEventListener('click', () => updateStitchCount(1000));
                newDecrementBtn.addEventListener('click', () => updateStitchCount(-1000));
                
                // Set initial stitch count
                window.capEmbroideryBackLogo.setStitchCount(BACK_LOGO_CONFIG.stitchCount);
            }
            
            // Also check for old-style select element (fallback)
            const backLogoStitchSelect = document.getElementById('back-logo-stitch-count');
            if (backLogoStitchSelect) {
                console.log('[CAP-EMB-BACK-LOGO] Found old-style stitch count select');
                // Remove any existing listeners
                const newSelect = backLogoStitchSelect.cloneNode(true);
                backLogoStitchSelect.parentNode.replaceChild(newSelect, backLogoStitchSelect);
                
                newSelect.addEventListener('input', function() {
                    const stitchCount = parseInt(this.value);
                    if (!isNaN(stitchCount) && stitchCount > 0) {
                        window.capEmbroideryBackLogo.setStitchCount(stitchCount);
                    }
                });
                
                // Set initial stitch count
                const initialCount = parseInt(newSelect.value);
                if (!isNaN(initialCount)) {
                    window.capEmbroideryBackLogo.setStitchCount(initialCount);
                }
            }

            console.log('[CAP-EMB-BACK-LOGO] Initialization complete');
            
            // Trigger initial update if back logo is enabled
            if (BACK_LOGO_CONFIG.enabled) {
                console.log('[CAP-EMB-BACK-LOGO] Back logo is enabled on init, triggering update');
                // Dispatch events to notify other components
                window.dispatchEvent(new CustomEvent('backLogoToggled', {
                    detail: {
                        enabled: BACK_LOGO_CONFIG.enabled,
                        price: BACK_LOGO_CONFIG.price,
                        stitchCount: BACK_LOGO_CONFIG.stitchCount
                    }
                }));
                
                // Force hero breakdown update
                if (window.updateCapEmbroideryHeroBreakdown) {
                    setTimeout(() => {
                        window.updateCapEmbroideryHeroBreakdown();
                    }, 500);
                }
            }
        }
    };
    
    // Create alias for compatibility with other components
    window.CapEmbroideryBackLogoAddon = {
        isEnabled: function() {
            return window.capEmbroideryBackLogo.isEnabled();
        },
        getPrice: function() {
            return window.capEmbroideryBackLogo.getPricePerItem();
        },
        getStitchCount: function() {
            return window.capEmbroideryBackLogo.getStitchCount();
        }
    };

    // Initialize when DOM is ready
    function initialize() {
        // Only initialize on cap embroidery pages
        const isCapEmbroidery = window.location.href.toLowerCase().includes('cap-embroidery') || 
                               window.location.href.toLowerCase().includes('cap_embroidery') ||
                               window.location.href.toLowerCase().includes('test-back-logo') ||
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