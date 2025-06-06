/**
 * Cap Embroidery LTM Fix
 * Ensures LTM (Less Than Minimum) fee is properly included in pricing
 */

(function() {
    'use strict';
    
    console.log('[LTM-FIX] Initializing LTM pricing fix');
    
    // Disable the old hero breakdown completely
    if (window.updateCapEmbroideryHeroBreakdown) {
        const oldFunc = window.updateCapEmbroideryHeroBreakdown;
        window.updateCapEmbroideryHeroBreakdown = function() {
            console.log('[LTM-FIX] Blocked old hero breakdown update');
            // Don't call the old function
        };
    }
    
    // Function to calculate and display correct pricing
    function updatePricingWithLTM() {
        console.log('[LTM-FIX] Updating pricing with LTM calculation');
        
        const quantityInput = document.getElementById('hero-quantity-input');
        const quantity = parseInt(quantityInput?.value) || 24;
        
        // Determine base price from tier
        let basePrice = 18.00; // 24-47
        if (quantity >= 72) {
            basePrice = 15.00;
        } else if (quantity >= 48) {
            basePrice = 17.00;
        }
        
        // Calculate LTM if applicable
        let ltmFeePerCap = 0;
        if (quantity < 24) {
            ltmFeePerCap = 50 / quantity;
            console.log('[LTM-FIX] Order under 24 - LTM fee per cap: $' + ltmFeePerCap.toFixed(2));
        }
        
        // Get back logo price if enabled
        let backLogoPrice = 0;
        const backLogoCheckbox = document.getElementById('back-logo-checkbox');
        if (backLogoCheckbox?.checked) {
            const backStitchDisplay = document.getElementById('back-logo-stitch-display');
            if (backStitchDisplay) {
                const stitchCount = parseInt(backStitchDisplay.textContent.replace(/[^0-9]/g, '')) || 5000;
                backLogoPrice = Math.ceil(stitchCount / 1000);
            }
        }
        
        // Calculate total per cap
        const totalPerCap = basePrice + backLogoPrice + ltmFeePerCap;
        
        console.log('[LTM-FIX] Pricing calculation:', {
            quantity: quantity,
            basePrice: basePrice,
            backLogoPrice: backLogoPrice,
            ltmFeePerCap: ltmFeePerCap,
            totalPerCap: totalPerCap
        });
        
        // Update all displays
        // 1. Main unit price
        const heroUnitPriceEl = document.querySelector('.hero-price-amount');
        if (heroUnitPriceEl) {
            heroUnitPriceEl.textContent = '$' + totalPerCap.toFixed(2);
        }
        
        // 2. Total order price
        const totalPriceEl = document.getElementById('hero-total-price');
        if (totalPriceEl) {
            const totalOrder = totalPerCap * quantity;
            totalPriceEl.innerHTML = '<span class="hero-price-prefix">Total:</span> $' + totalOrder.toFixed(2);
        }
        
        // 3. Update breakdown if it exists
        const totalPerCapSpan = document.getElementById('hero-total-per-cap');
        if (totalPerCapSpan) {
            totalPerCapSpan.textContent = totalPerCap.toFixed(2);
        }
        
        // 4. Ensure LTM line is visible if needed
        const setupFeeLine = document.getElementById('hero-setup-fee-line');
        const setupFeeSpan = document.getElementById('hero-setup-fee');
        
        if (quantity < 24) {
            if (setupFeeLine) {
                setupFeeLine.style.display = 'block';
            }
            if (setupFeeSpan) {
                setupFeeSpan.textContent = ltmFeePerCap.toFixed(2);
            }
        } else {
            if (setupFeeLine) {
                setupFeeLine.style.display = 'none';
            }
        }
    }
    
    // Override any function that might update pricing
    const functionsToOverride = [
        'updateHeroPricing',
        'fixHeroBreakdown',
        'updateCapEmbroideryHeroBreakdown'
    ];
    
    functionsToOverride.forEach(funcName => {
        if (window[funcName]) {
            const oldFunc = window[funcName];
            window[funcName] = function() {
                console.log('[LTM-FIX] Intercepting ' + funcName);
                // Call our update instead
                updatePricingWithLTM();
            };
        }
    });
    
    // Setup event listeners
    function setupListeners() {
        // Quantity changes
        const quantityInput = document.getElementById('hero-quantity-input');
        const decreaseBtn = document.getElementById('hero-quantity-decrease');
        const increaseBtn = document.getElementById('hero-quantity-increase');
        
        if (quantityInput) {
            quantityInput.addEventListener('input', updatePricingWithLTM);
            quantityInput.addEventListener('change', updatePricingWithLTM);
        }
        
        if (decreaseBtn) {
            decreaseBtn.addEventListener('click', () => setTimeout(updatePricingWithLTM, 50));
        }
        
        if (increaseBtn) {
            increaseBtn.addEventListener('click', () => setTimeout(updatePricingWithLTM, 50));
        }
        
        // Back logo changes
        const backLogoCheckbox = document.getElementById('back-logo-checkbox');
        if (backLogoCheckbox) {
            backLogoCheckbox.addEventListener('change', updatePricingWithLTM);
        }
        
        // Back logo stitch count
        window.addEventListener('backLogoUpdated', updatePricingWithLTM);
    }
    
    // Initialize
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            setTimeout(() => {
                setupListeners();
                updatePricingWithLTM();
            }, 1500);
        });
    } else {
        setTimeout(() => {
            setupListeners();
            updatePricingWithLTM();
        }, 1500);
    }
    
    // Single update after a delay to ensure it wins
    setTimeout(() => {
        updatePricingWithLTM();
    }, 2000);
    
    // Export for manual use
    window.updatePricingWithLTM = updatePricingWithLTM;
    
    console.log('[LTM-FIX] LTM fix loaded. Call updatePricingWithLTM() to manually update.');
})();