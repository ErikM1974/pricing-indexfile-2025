/**
 * Hero Pricing Clean Breakdown
 * Implements clean, non-redundant pricing display with proper calculations
 */

(function() {
    'use strict';
    
    console.log('[HERO-CLEAN-BREAKDOWN] Initializing clean pricing breakdown');
    
    // Function to completely rebuild the pricing breakdown
    function rebuildPricingBreakdown() {
        const breakdownDiv = document.getElementById('hero-pricing-breakdown');
        if (!breakdownDiv) {
            console.error('[HERO-CLEAN-BREAKDOWN] Breakdown div not found');
            return;
        }
        
        // Get current values
        const quantityInput = document.getElementById('hero-quantity-input');
        const quantity = parseInt(quantityInput?.value) || 24;
        
        // Get base price based on quantity tier
        let basePrice = 18.00; // Default 24-47
        if (quantity >= 72) {
            basePrice = 15.00;
        } else if (quantity >= 48) {
            basePrice = 17.00;
        }
        
        // Get front logo stitch count
        const stitchSelect = document.getElementById('client-stitch-count-select');
        const frontStitchCount = stitchSelect ? parseInt(stitchSelect.value) : 8000;
        
        // Clear and rebuild the breakdown
        breakdownDiv.innerHTML = '';
        
        // 1. Base cap price line
        const baseLine = document.createElement('div');
        baseLine.innerHTML = `
            <span>Base cap price:</span>
            <span>$<span id="hero-base-price">${basePrice.toFixed(2)}</span></span>
        `;
        breakdownDiv.appendChild(baseLine);
        
        // 2. Front logo line (always show as included)
        const frontLogoLine = document.createElement('div');
        frontLogoLine.innerHTML = `
            <span>Front logo (<span id="hero-stitch-count">${frontStitchCount.toLocaleString()}</span> stitches):</span>
            <span class="hero-pricing-included">included</span>
        `;
        breakdownDiv.appendChild(frontLogoLine);
        
        // 3. Back logo line (only if enabled)
        const backLogoLine = document.createElement('div');
        backLogoLine.id = 'hero-back-logo-line';
        backLogoLine.style.display = 'none';
        
        const backLogoCheckbox = document.getElementById('back-logo-checkbox');
        let backLogoPrice = 0;
        
        if (backLogoCheckbox?.checked) {
            // Get back logo stitch count and calculate price
            let backStitchCount = 5000; // Default
            const backStitchDisplay = document.getElementById('back-logo-stitch-display');
            if (backStitchDisplay) {
                backStitchCount = parseInt(backStitchDisplay.textContent.replace(/[^0-9]/g, '')) || 5000;
            }
            
            backLogoPrice = Math.ceil(backStitchCount / 1000);
            
            backLogoLine.innerHTML = `
                <span>Back logo (${backStitchCount.toLocaleString()} stitches):</span>
                <span><span class="hero-pricing-addon">+</span>$<span id="hero-back-logo-price">${backLogoPrice.toFixed(2)}</span></span>
            `;
            backLogoLine.style.display = 'block';
        }
        
        breakdownDiv.appendChild(backLogoLine);
        
        // 4. Setup fee line (LTM - only for orders under 24)
        const setupFeeLine = document.createElement('div');
        setupFeeLine.id = 'hero-setup-fee-line';
        setupFeeLine.style.display = 'none';
        
        let setupFeePerCap = 0;
        if (quantity < 24) {
            setupFeePerCap = 50 / quantity; // $50 total divided by quantity
            setupFeeLine.innerHTML = `
                <span>Setup fee <span class="ltm-tooltip">(LTM)</span>:</span>
                <span><span class="hero-pricing-addon">+</span>$<span id="hero-setup-fee">${setupFeePerCap.toFixed(2)}</span></span>
            `;
            setupFeeLine.style.display = 'block';
        }
        
        breakdownDiv.appendChild(setupFeeLine);
        
        // 5. Total per cap line
        const totalPerCap = basePrice + backLogoPrice + setupFeePerCap;
        const totalLine = document.createElement('div');
        totalLine.innerHTML = `
            <strong>Your price:</strong>
            <strong>$<span id="hero-total-per-cap">${totalPerCap.toFixed(2)}</span> /cap</strong>
        `;
        breakdownDiv.appendChild(totalLine);
        
        // Update the main displays
        updateMainPriceDisplays(totalPerCap, quantity);
        
        console.log('[HERO-CLEAN-BREAKDOWN] Breakdown rebuilt - Base: $' + basePrice + ', Back: $' + backLogoPrice + ', Setup: $' + setupFeePerCap.toFixed(2) + ', Total: $' + totalPerCap.toFixed(2));
    }
    
    // Function to update main price displays
    function updateMainPriceDisplays(unitPrice, quantity) {
        // Update the big unit price
        const unitPriceAmountEl = document.querySelector('.hero-price-amount');
        if (unitPriceAmountEl) {
            unitPriceAmountEl.textContent = '$' + unitPrice.toFixed(2);
            unitPriceAmountEl.classList.add('updating');
            setTimeout(() => {
                unitPriceAmountEl.classList.remove('updating');
            }, 300);
        }
        
        // Update total price
        const totalPrice = unitPrice * quantity;
        const totalPriceEl = document.getElementById('hero-total-price');
        if (totalPriceEl) {
            totalPriceEl.innerHTML = '<span class="hero-price-prefix">Total:</span> $' + totalPrice.toFixed(2);
        }
    }
    
    // Override the updateCapEmbroideryHeroBreakdown function
    const originalUpdate = window.updateCapEmbroideryHeroBreakdown;
    window.updateCapEmbroideryHeroBreakdown = function() {
        console.log('[HERO-CLEAN-BREAKDOWN] Intercepting breakdown update');
        
        // Don't call the original - we're replacing it
        rebuildPricingBreakdown();
    };
    
    
    // Function to handle all updates
    function handleUpdate() {
        rebuildPricingBreakdown();
    }
    
    // Setup all event listeners
    function setupListeners() {
        // Quantity changes
        const quantityInput = document.getElementById('hero-quantity-input');
        const decreaseBtn = document.getElementById('hero-quantity-decrease');
        const increaseBtn = document.getElementById('hero-quantity-increase');
        
        if (quantityInput) {
            quantityInput.addEventListener('input', handleUpdate);
            quantityInput.addEventListener('change', handleUpdate);
        }
        
        if (decreaseBtn) {
            decreaseBtn.addEventListener('click', () => setTimeout(handleUpdate, 50));
        }
        
        if (increaseBtn) {
            increaseBtn.addEventListener('click', () => setTimeout(handleUpdate, 50));
        }
        
        // Front stitch count changes
        const stitchSelect = document.getElementById('client-stitch-count-select');
        if (stitchSelect) {
            stitchSelect.addEventListener('change', handleUpdate);
        }
        
        // Back logo checkbox
        const backLogoCheckbox = document.getElementById('back-logo-checkbox');
        if (backLogoCheckbox) {
            backLogoCheckbox.addEventListener('change', handleUpdate);
        }
        
        // Back logo stitch count changes (handled by the complete fix)
        // Just listen for the custom event
        window.addEventListener('backLogoUpdated', handleUpdate);
        
        console.log('[HERO-CLEAN-BREAKDOWN] All listeners attached');
        
        // Removed observer to prevent update loops
    }
    
    // Initialize when DOM is ready
    function initialize() {
        console.log('[HERO-CLEAN-BREAKDOWN] Initializing...');
        
        setupListeners();
        
        // Do initial rebuild
        setTimeout(rebuildPricingBreakdown, 500);
        
        // Listen for pricing data updates
        document.addEventListener('pricingDataUpdated', handleUpdate);
    }
    
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        setTimeout(initialize, 1000);
    }
    
    // Export for manual use
    window.rebuildPricingBreakdown = rebuildPricingBreakdown;
    
    console.log('[HERO-CLEAN-BREAKDOWN] Clean breakdown system loaded');
})();