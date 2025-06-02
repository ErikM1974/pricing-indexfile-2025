// Cap Embroidery Stitch Count Handler
(function() {
    'use strict';
    
    console.log('[CAP-STITCH-HANDLER] Initializing stitch count change handler');
    
    let currentStitchCount = '8000'; // Default
    
    // Function to update pricing when stitch count changes
    function handleStitchCountChange(newStitchCount) {
        console.log(`[CAP-STITCH-HANDLER] Stitch count changed from ${currentStitchCount} to ${newStitchCount}`);
        
        if (currentStitchCount === newStitchCount) {
            return; // No change, don't update
        }
        
        currentStitchCount = newStitchCount;
        
        // Show loading state
        if (window.CapEmbroideryEnhancedLoading && window.CapEmbroideryEnhancedLoading.showEnhancedLoadingState) {
            window.CapEmbroideryEnhancedLoading.showEnhancedLoadingState();
        }
        
        // Update the pricing table attribute
        const pricingGrid = document.getElementById('custom-pricing-grid');
        if (pricingGrid) {
            pricingGrid.setAttribute('data-current-stitch-count', newStitchCount);
        }
        
        // Update pricing explanation
        const explanation = document.querySelector('.pricing-explanation p');
        if (explanation) {
            const formattedStitchCount = parseInt(newStitchCount).toLocaleString();
            explanation.innerHTML = `<strong>Note:</strong> Prices shown are per item and include a ${formattedStitchCount} stitch embroidered logo.`;
        }
        
        // Show indicator
        const indicator = document.getElementById('stitch-count-indicator');
        if (indicator) {
            indicator.style.opacity = '1';
            setTimeout(() => {
                indicator.style.opacity = '0';
            }, 2000);
        }
        
        // Trigger pricing reload if necessary
        setTimeout(() => {
            // Try to trigger pricing data reload
            if (window.nwcaPricingData) {
                // Update the existing pricing data
                window.nwcaPricingData.stitchCount = newStitchCount;
                window.nwcaPricingData.capturedAt = new Date().toISOString();
                
                // Dispatch event to update pricing displays
                window.dispatchEvent(new CustomEvent('pricingDataLoaded', { 
                    detail: window.nwcaPricingData 
                }));
                
                console.log('[CAP-STITCH-HANDLER] Updated pricing data with new stitch count');
            }
            
            // Hide loading state
            if (window.CapEmbroideryEnhancedLoading && window.CapEmbroideryEnhancedLoading.hideLoadingShowTable) {
                setTimeout(() => {
                    window.CapEmbroideryEnhancedLoading.hideLoadingShowTable();
                }, 800);
            }
        }, 1200);
        
        // Dispatch custom event
        document.dispatchEvent(new CustomEvent('stitchCountChanged', {
            detail: { 
                oldStitchCount: currentStitchCount,
                newStitchCount: newStitchCount 
            }
        }));
    }
    
    // Set up event listener for stitch count dropdown
    function initializeStitchCountHandler() {
        const stitchCountSelect = document.getElementById('client-stitch-count-select');
        
        if (!stitchCountSelect) {
            console.warn('[CAP-STITCH-HANDLER] Stitch count select not found');
            return;
        }
        
        // Set initial value
        currentStitchCount = stitchCountSelect.value || '8000';
        console.log(`[CAP-STITCH-HANDLER] Initial stitch count: ${currentStitchCount}`);
        
        // Add change event listener
        stitchCountSelect.addEventListener('change', function(event) {
            handleStitchCountChange(event.target.value);
        });
        
        console.log('[CAP-STITCH-HANDLER] Stitch count change listener attached');
    }
    
    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeStitchCountHandler);
    } else {
        initializeStitchCountHandler();
    }
    
    // Export for external use
    window.CapStitchHandler = {
        handleStitchCountChange,
        getCurrentStitchCount: () => currentStitchCount
    };
    
})();