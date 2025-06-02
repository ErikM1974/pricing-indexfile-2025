// Cap Embroidery Back Logo Add-on Handler
// Independent calculator for back logo pricing
(function() {
    'use strict';
    
    console.log('[CAP-BACK-LOGO-ADDON] Initializing back logo add-on functionality');
    
    // Back logo add-on state
    const backLogoState = {
        enabled: false,
        stitchCount: 5000,
        price: 5.00
    };
    
    // Calculate back logo price based on stitch count
    function calculateBackLogoPrice(stitchCount) {
        const basePrice = 5.00; // $5 for 5,000 stitches
        const additionalThousands = Math.max(0, Math.ceil((stitchCount - 5000) / 1000));
        return basePrice + additionalThousands;
    }
    
    // Update back logo price display
    function updateBackLogoPriceDisplay() {
        const priceDisplay = document.getElementById('back-logo-addon-price-display');
        const priceBreakdown = document.getElementById('back-logo-price-breakdown');
        
        if (priceDisplay) {
            priceDisplay.textContent = `+$${backLogoState.price.toFixed(2)} per cap`;
        }
        
        if (priceBreakdown) {
            const basePrice = 5.00;
            const additionalPrice = backLogoState.price - basePrice;
            const additionalStitches = backLogoState.stitchCount - 5000;
            
            if (additionalPrice > 0) {
                priceBreakdown.textContent = `$${basePrice.toFixed(2)} (5,000 stitches) + $${additionalPrice.toFixed(2)} (${additionalStitches.toLocaleString()} additional stitches)`;
            } else {
                priceBreakdown.textContent = `$${basePrice.toFixed(2)} (5,000 stitches)`;
            }
        }
        
        console.log(`[CAP-BACK-LOGO-ADDON] Updated price display: ${backLogoState.stitchCount} stitches = $${backLogoState.price.toFixed(2)}`);
    }
    
    // Handle checkbox toggle
    function handleCheckboxToggle(enabled) {
        backLogoState.enabled = enabled;
        
        const details = document.getElementById('back-logo-addon-details');
        const priceDisplay = document.getElementById('back-logo-addon-price-display');
        
        if (details) {
            details.style.display = enabled ? 'block' : 'none';
        }
        
        if (priceDisplay) {
            priceDisplay.style.display = enabled ? 'block' : 'none';
        }
        
        console.log(`[CAP-BACK-LOGO-ADDON] Back logo ${enabled ? 'enabled' : 'disabled'}`);
        
        // Dispatch event for other components to listen to
        document.dispatchEvent(new CustomEvent('backLogoToggled', {
            detail: {
                enabled: enabled,
                stitchCount: backLogoState.stitchCount,
                price: backLogoState.price
            }
        }));
    }
    
    // Handle stitch count change
    function handleStitchCountChange(stitchCount) {
        backLogoState.stitchCount = parseInt(stitchCount);
        backLogoState.price = calculateBackLogoPrice(backLogoState.stitchCount);
        
        updateBackLogoPriceDisplay();
        
        console.log(`[CAP-BACK-LOGO-ADDON] Stitch count changed to ${backLogoState.stitchCount}, price: $${backLogoState.price.toFixed(2)}`);
        
        // Dispatch event for other components to listen to
        if (backLogoState.enabled) {
            document.dispatchEvent(new CustomEvent('backLogoUpdated', {
                detail: {
                    enabled: backLogoState.enabled,
                    stitchCount: backLogoState.stitchCount,
                    price: backLogoState.price
                }
            }));
        }
    }
    
    // Initialize the back logo add-on functionality
    function initialize() {
        console.log('[CAP-BACK-LOGO-ADDON] Setting up event listeners');
        
        // Checkbox event listener
        const checkbox = document.getElementById('back-logo-addon-checkbox');
        if (checkbox) {
            checkbox.addEventListener('change', function() {
                handleCheckboxToggle(this.checked);
            });
            console.log('[CAP-BACK-LOGO-ADDON] Checkbox listener attached');
        } else {
            console.warn('[CAP-BACK-LOGO-ADDON] Checkbox not found');
        }
        
        // Stitch count dropdown event listener
        const stitchDropdown = document.getElementById('back-logo-stitch-dropdown');
        if (stitchDropdown) {
            stitchDropdown.addEventListener('change', function() {
                handleStitchCountChange(this.value);
            });
            
            // Set initial values
            backLogoState.stitchCount = parseInt(stitchDropdown.value);
            backLogoState.price = calculateBackLogoPrice(backLogoState.stitchCount);
            updateBackLogoPriceDisplay();
            
            console.log('[CAP-BACK-LOGO-ADDON] Stitch dropdown listener attached');
        } else {
            console.warn('[CAP-BACK-LOGO-ADDON] Stitch dropdown not found');
        }
    }
    
    // Expose public API
    window.CapEmbroideryBackLogoAddon = {
        isEnabled: function() {
            return backLogoState.enabled;
        },
        
        getStitchCount: function() {
            return backLogoState.stitchCount;
        },
        
        getPrice: function() {
            return backLogoState.price;
        },
        
        getState: function() {
            return { ...backLogoState };
        }
    };
    
    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        initialize();
    }
    
})();