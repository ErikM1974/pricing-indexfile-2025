/**
 * Cap Embroidery Pricing Fix
 * Fixes the issue where stitch count changes don't update the quick quote pricing
 */

(function() {
    'use strict';
    
    console.log('[Cap Embroidery Fix] Initializing pricing fix...');
    
    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeFix);
    } else {
        initializeFix();
    }
    
    function initializeFix() {
        console.log('[Cap Embroidery Fix] DOM ready, applying fixes...');
        
        // Fix 1: Ensure we have pricing data for all stitch counts
        ensurePricingData();
        
        // Fix 2: Override the handleStitchCountChange function
        fixStitchCountHandler();
        
        // Fix 3: Fix back logo pricing updates
        fixBackLogoPricing();
        
        // Fix 4: Listen for pricing data events and ensure proper structure
        listenForPricingEvents();
    }
    
    function ensurePricingData() {
        // Create default pricing structure if it doesn't exist
        if (!window.capEmbroideryMasterData) {
            window.capEmbroideryMasterData = {
                allPriceProfiles: {},
                groupedHeaders: ['OSFA'],
                tierDefinitions: {
                    '24-47': { MinQuantity: 24, MaxQuantity: 47, TierLabel: '24-47' },
                    '48-71': { MinQuantity: 48, MaxQuantity: 71, TierLabel: '48-71' },
                    '72+': { MinQuantity: 72, MaxQuantity: 99999, TierLabel: '72+' }
                }
            };
        }
        
        // Ensure we have pricing profiles for each stitch count
        const stitchCounts = ['5000', '8000', '10000'];
        const basePrices = {
            '5000': { '24-47': 23.00, '48-71': 22.00, '72+': 20.00 },
            '8000': { '24-47': 24.00, '48-71': 23.00, '72+': 21.00 },
            '10000': { '24-47': 25.00, '48-71': 24.00, '72+': 22.00 }
        };
        
        stitchCounts.forEach(count => {
            if (!window.capEmbroideryMasterData.allPriceProfiles[count]) {
                window.capEmbroideryMasterData.allPriceProfiles[count] = {
                    OSFA: basePrices[count]
                };
                console.log(`[Cap Embroidery Fix] Added pricing profile for ${count} stitches`);
            }
        });
        
        console.log('[Cap Embroidery Fix] Pricing data structure:', window.capEmbroideryMasterData);
    }
    
    function fixStitchCountHandler() {
        // Store the original handler if it exists
        const originalHandler = window.handleStitchCountChange;
        
        // Create an enhanced handler
        window.handleStitchCountChange = function() {
            console.log('[Cap Embroidery Fix] Stitch count change detected');
            
            const stitchCountEl = document.getElementById('stitch-count');
            if (!stitchCountEl) {
                console.error('[Cap Embroidery Fix] Stitch count element not found');
                return;
            }
            
            const newStitchCount = stitchCountEl.value;
            console.log('[Cap Embroidery Fix] New stitch count:', newStitchCount);
            
            // Update the state
            if (window.state) {
                window.state.frontLogoStitches = parseInt(newStitchCount);
            }
            
            // Ensure we have pricing data for this stitch count
            ensurePricingData();
            
            // Call the original handler if it exists
            if (originalHandler && typeof originalHandler === 'function') {
                originalHandler.call(this);
            }
            
            // Force a pricing update
            setTimeout(() => {
                if (window.updatePricingForStitchCount) {
                    console.log('[Cap Embroidery Fix] Calling updatePricingForStitchCount');
                    window.updatePricingForStitchCount();
                }
                
                // Also force update the pricing display
                if (window.updatePricing) {
                    console.log('[Cap Embroidery Fix] Calling updatePricing');
                    window.updatePricing();
                }
                
                if (window.updatePricingDisplay) {
                    console.log('[Cap Embroidery Fix] Calling updatePricingDisplay');
                    window.updatePricingDisplay();
                }
                
                if (window.updateBreakdown) {
                    console.log('[Cap Embroidery Fix] Calling updateBreakdown');
                    window.updateBreakdown();
                }
                
                // Dispatch a custom event to notify other components
                window.dispatchEvent(new CustomEvent('capEmbroideryPricingUpdated', {
                    detail: {
                        stitchCount: newStitchCount,
                        prices: window.capEmbroideryMasterData.allPriceProfiles[newStitchCount]
                    }
                }));
            }, 100);
        };
        
        // Also fix the visual toggle function
        const originalSetFrontStitchCount = window.setFrontStitchCount;
        window.setFrontStitchCount = function(value) {
            console.log('[Cap Embroidery Fix] setFrontStitchCount called with:', value);
            
            // Update the hidden select
            const select = document.getElementById('stitch-count');
            if (select) {
                select.value = value;
                
                // Update visual toggles
                document.querySelectorAll('.stitch-toggle-option').forEach(option => {
                    if (parseInt(option.dataset.value) === value) {
                        option.classList.add('active');
                    } else {
                        option.classList.remove('active');
                    }
                });
                
                // Trigger the handler
                window.handleStitchCountChange();
            }
        };
    }
    
    function fixBackLogoPricing() {
        // Store the original function
        const originalUpdateBackLogo = window.updateBackLogoFromSlider;
        
        // Create an enhanced version
        window.updateBackLogoFromSlider = function(value) {
            console.log('[Cap Embroidery Fix] Back logo slider updated to:', value);
            
            // Call the original function if it exists
            if (originalUpdateBackLogo && typeof originalUpdateBackLogo === 'function') {
                originalUpdateBackLogo.call(this, value);
            }
            
            // Ensure state is updated
            if (window.state) {
                window.state.backLogoStitches = parseInt(value);
                
                // Force pricing update if back logo is enabled
                if (window.state.backLogoEnabled) {
                    setTimeout(() => {
                        if (window.updatePricing) {
                            console.log('[Cap Embroidery Fix] Updating pricing after back logo change');
                            window.updatePricing();
                        }
                        if (window.updatePricingDisplay) {
                            window.updatePricingDisplay();
                        }
                        if (window.updateBreakdown) {
                            window.updateBreakdown();
                        }
                    }, 50);
                }
            }
        };
        
        // Also fix the toggle function
        const originalToggleBackLogo = window.toggleBackLogo;
        window.toggleBackLogo = function() {
            console.log('[Cap Embroidery Fix] Back logo toggled');
            
            // Call the original function if it exists
            if (originalToggleBackLogo && typeof originalToggleBackLogo === 'function') {
                originalToggleBackLogo.call(this);
            }
            
            // Force pricing update
            setTimeout(() => {
                if (window.updatePricing) {
                    console.log('[Cap Embroidery Fix] Updating pricing after back logo toggle');
                    window.updatePricing();
                }
                if (window.updatePricingDisplay) {
                    window.updatePricingDisplay();
                }
                if (window.updateBreakdown) {
                    window.updateBreakdown();
                }
            }, 50);
        };
    }
    
    function listenForPricingEvents() {
        // Listen for Caspio pricing data
        window.addEventListener('caspioCapPricingCalculated', function(event) {
            console.log('[Cap Embroidery Fix] Received Caspio pricing data:', event.detail);
            
            if (event.detail && event.detail.masterData) {
                // Merge with our default data
                window.capEmbroideryMasterData = {
                    ...window.capEmbroideryMasterData,
                    ...event.detail.masterData
                };
                
                // Ensure all stitch count profiles exist
                ensurePricingData();
                
                // Trigger a pricing update
                if (window.handleStitchCountChange) {
                    window.handleStitchCountChange();
                }
            }
        });
        
        // Listen for pricing data loaded events
        window.addEventListener('pricingDataLoaded', function(event) {
            console.log('[Cap Embroidery Fix] Pricing data loaded event:', event.detail);
            
            // Extract pricing tiers if available
            if (event.detail && event.detail.prices && window.state) {
                const currentStitchCount = window.state.frontLogoStitches || 8000;
                
                // Update master data if needed
                if (!window.capEmbroideryMasterData.allPriceProfiles[currentStitchCount]) {
                    window.capEmbroideryMasterData.allPriceProfiles[currentStitchCount] = {
                        OSFA: event.detail.prices.OSFA || {}
                    };
                }
            }
        });
    }
    
    // Additional fix: Ensure pricing updates are triggered after page load
    window.addEventListener('load', function() {
        setTimeout(() => {
            console.log('[Cap Embroidery Fix] Page fully loaded, ensuring pricing is correct');
            
            // Trigger initial pricing update
            if (window.handleStitchCountChange) {
                window.handleStitchCountChange();
            }
            
            // Also check if we need to extract pricing from the table
            if (window.extractPricingFromTable) {
                window.extractPricingFromTable();
            }
        }, 1500);
    });
    
})();