/**
 * Cap Embroidery Hero Pricing Breakdown
 * Shows detailed pricing breakdown in the quick quote section
 */

(function() {
    'use strict';

    // Helper function to update the pricing breakdown
    function updatePricingBreakdown() {
        // Get current stitch count
        const stitchCountSelect = document.getElementById('client-stitch-count-select');
        const stitchCount = stitchCountSelect ? stitchCountSelect.value : '8000';
        
        // Get current quantity
        const quantityInput = document.getElementById('hero-quantity-input');
        const quantity = parseInt(quantityInput?.value || 24);
        
        // Update stitch count display
        const stitchCountSpan = document.getElementById('hero-stitch-count');
        if (stitchCountSpan) {
            stitchCountSpan.textContent = parseInt(stitchCount).toLocaleString();
        }
        
        // Get current pricing data
        if (window.nwcaPricingData && window.nwcaPricingData.prices) {
            // Determine the tier based on quantity
            let tierKey = '24-47'; // default
            if (quantity >= 72) {
                tierKey = '72+';
            } else if (quantity >= 48) {
                tierKey = '48-71';
            } else if (quantity >= 24) {
                tierKey = '24-47';
            }
            
            // Get the base price for the first available size
            const prices = window.nwcaPricingData.prices;
            const sizeKeys = Object.keys(prices);
            let basePrice = 0;
            
            if (sizeKeys.length > 0) {
                const firstSize = sizeKeys[0];
                if (prices[firstSize] && prices[firstSize][tierKey]) {
                    basePrice = prices[firstSize][tierKey];
                }
            }
            
            // Update base price display
            const basePriceSpan = document.getElementById('hero-base-price');
            if (basePriceSpan) {
                basePriceSpan.textContent = basePrice.toFixed(2);
            }
            
            // Check if back logo is enabled
            let backLogoPrice = 0;
            const backLogoLine = document.getElementById('hero-back-logo-line');
            if (window.CapEmbroideryBackLogoAddon && window.CapEmbroideryBackLogoAddon.isEnabled()) {
                backLogoPrice = window.CapEmbroideryBackLogoAddon.getPrice();
                if (backLogoLine) {
                    backLogoLine.style.display = 'block';
                    const backLogoPriceSpan = document.getElementById('hero-back-logo-price');
                    if (backLogoPriceSpan) {
                        backLogoPriceSpan.textContent = backLogoPrice.toFixed(2);
                    }
                }
            } else {
                if (backLogoLine) {
                    backLogoLine.style.display = 'none';
                }
            }
            
            // Check for setup fees (LTM)
            let setupFee = 0;
            const setupFeeLine = document.getElementById('hero-setup-fee-line');
            if (quantity < 24) {
                setupFee = 12.50; // LTM fee per item
                if (setupFeeLine) {
                    setupFeeLine.style.display = 'block';
                    const setupFeeSpan = document.getElementById('hero-setup-fee');
                    if (setupFeeSpan) {
                        setupFeeSpan.textContent = setupFee.toFixed(2);
                    }
                }
            } else {
                if (setupFeeLine) {
                    setupFeeLine.style.display = 'none';
                }
            }
            
            // Calculate total per cap
            const totalPerCap = basePrice + backLogoPrice + setupFee;
            const totalPerCapSpan = document.getElementById('hero-total-per-cap');
            if (totalPerCapSpan) {
                totalPerCapSpan.textContent = totalPerCap.toFixed(2);
            }
            
            // Update the main pricing display
            window.updateHeroPricing(totalPerCap, totalPerCap * quantity);
        }
    }
    
    // Listen for pricing data updates
    document.addEventListener('pricingDataUpdated', function(e) {
        console.log('[HERO-BREAKDOWN] Pricing data updated, refreshing breakdown');
        updatePricingBreakdown();
    });
    
    // Listen for quantity changes
    document.addEventListener('DOMContentLoaded', function() {
        const quantityInput = document.getElementById('hero-quantity-input');
        if (quantityInput) {
            quantityInput.addEventListener('input', updatePricingBreakdown);
            quantityInput.addEventListener('change', updatePricingBreakdown);
        }
        
        // Listen for quantity button clicks
        const decreaseBtn = document.getElementById('hero-quantity-decrease');
        const increaseBtn = document.getElementById('hero-quantity-increase');
        
        if (decreaseBtn) {
            decreaseBtn.addEventListener('click', function() {
                setTimeout(updatePricingBreakdown, 50);
            });
        }
        
        if (increaseBtn) {
            increaseBtn.addEventListener('click', function() {
                setTimeout(updatePricingBreakdown, 50);
            });
        }
        
        // Listen for stitch count changes
        const stitchCountSelect = document.getElementById('client-stitch-count-select');
        if (stitchCountSelect) {
            stitchCountSelect.addEventListener('change', updatePricingBreakdown);
        }
        
        // Listen for back logo changes
        document.addEventListener('backLogoToggled', updatePricingBreakdown);
        document.addEventListener('backLogoUpdated', updatePricingBreakdown);
        
        // Initial update
        setTimeout(updatePricingBreakdown, 500);
    });
    
    // Export for external use
    window.updateCapEmbroideryHeroBreakdown = updatePricingBreakdown;
    
    console.log('[HERO-BREAKDOWN] Cap embroidery hero pricing breakdown initialized');
})();