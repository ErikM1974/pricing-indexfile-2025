/**
 * Cap Embroidery Back Logo Complete Fix
 * Fixes back logo stitch count updates and adds green confirmation
 */

(function() {
    'use strict';
    
    console.log('[BACK-LOGO-COMPLETE-FIX] Initializing complete back logo fix');
    
    // Function to show green confirmation message
    function showConfirmation(message) {
        // Look for existing confirmation element or create one
        let confirmation = document.getElementById('stitch-count-confirmation');
        
        if (!confirmation) {
            // Create confirmation element if it doesn't exist
            confirmation = document.createElement('div');
            confirmation.id = 'stitch-count-confirmation';
            confirmation.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                background-color: #d4edda;
                color: #155724;
                padding: 15px 20px;
                border-radius: 5px;
                box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                z-index: 10000;
                font-size: 16px;
                font-weight: 500;
                display: none;
                align-items: center;
                gap: 10px;
            `;
            document.body.appendChild(confirmation);
        }
        
        // Show the message
        confirmation.innerHTML = `<span style="color: #28a745; font-size: 20px;">✓</span> ${message}`;
        confirmation.style.display = 'flex';
        
        // Hide after 3 seconds
        setTimeout(() => {
            confirmation.style.display = 'none';
        }, 3000);
        
        console.log('[BACK-LOGO-COMPLETE-FIX] Showing confirmation:', message);
    }
    
    // Function to update back logo price everywhere
    function updateBackLogoPrice(stitchCount) {
        const price = Math.ceil(stitchCount / 1000);
        
        console.log('[BACK-LOGO-COMPLETE-FIX] Updating back logo - Stitch count:', stitchCount, 'Price: $' + price);
        
        // 1. Update the internal module state
        if (window.capEmbroideryBackLogo) {
            window.capEmbroideryBackLogo.setStitchCount(stitchCount);
            console.log('[BACK-LOGO-COMPLETE-FIX] Updated module stitch count');
        }
        
        // 2. Update the customization section price display
        const customizationPriceEl = document.getElementById('back-logo-price');
        if (customizationPriceEl) {
            customizationPriceEl.textContent = `Additional Cost: $${price.toFixed(2)} per cap`;
        }
        
        // 3. Update the hero breakdown price
        const heroBackLogoPriceEl = document.getElementById('hero-back-logo-price');
        if (heroBackLogoPriceEl) {
            heroBackLogoPriceEl.textContent = price.toFixed(2);
            console.log('[BACK-LOGO-COMPLETE-FIX] Updated hero back logo price to $' + price);
        }
        
        // 4. Recalculate and update the total
        updateHeroTotal();
        
        // 5. Force all update functions
        if (window.updateCapEmbroideryHeroBreakdown) {
            window.updateCapEmbroideryHeroBreakdown();
            console.log('[BACK-LOGO-COMPLETE-FIX] Called updateCapEmbroideryHeroBreakdown');
        }
        
        if (window.fixHeroBreakdown) {
            window.fixHeroBreakdown();
            console.log('[BACK-LOGO-COMPLETE-FIX] Called fixHeroBreakdown');
        }
        
        // 6. Dispatch events for other components
        window.dispatchEvent(new CustomEvent('backLogoUpdated', {
            detail: {
                enabled: true,
                price: price,
                stitchCount: stitchCount
            }
        }));
        
        // 7. Show confirmation message
        showConfirmation(`Back logo updated to ${stitchCount.toLocaleString()} stitches`);
    }
    
    // Function to update hero total
    function updateHeroTotal() {
        const basePriceEl = document.getElementById('hero-base-price');
        const backLogoPriceEl = document.getElementById('hero-back-logo-price');
        const totalEl = document.getElementById('hero-total-per-cap');
        const backLogoLine = document.getElementById('hero-back-logo-line');
        
        if (basePriceEl && totalEl) {
            let total = parseFloat(basePriceEl.textContent) || 0;
            
            // Add back logo if visible
            if (backLogoLine && backLogoLine.style.display !== 'none' && backLogoPriceEl) {
                total += parseFloat(backLogoPriceEl.textContent) || 0;
            }
            
            totalEl.textContent = total.toFixed(2);
            console.log('[BACK-LOGO-COMPLETE-FIX] Updated total per cap to $' + total);
        }
        
        // Also update the main unit price display
        const heroUnitPriceEl = document.querySelector('.hero-price-amount');
        if (heroUnitPriceEl && totalEl) {
            heroUnitPriceEl.textContent = '$' + totalEl.textContent;
        }
        
        // Update total order price
        const quantityInput = document.getElementById('hero-quantity-input');
        const totalPriceEl = document.getElementById('hero-total-price');
        if (quantityInput && totalPriceEl && totalEl) {
            const quantity = parseInt(quantityInput.value) || 24;
            const unitPrice = parseFloat(totalEl.textContent) || 0;
            const totalPrice = quantity * unitPrice;
            totalPriceEl.innerHTML = '<span class="hero-price-prefix">Total:</span> $' + totalPrice.toFixed(2);
        }
    }
    
    // Function to fix the increment/decrement buttons
    function fixBackLogoButtons() {
        const incrementBtn = document.getElementById('back-logo-increment');
        const decrementBtn = document.getElementById('back-logo-decrement');
        const stitchDisplay = document.getElementById('back-logo-stitch-display');
        
        if (!incrementBtn || !decrementBtn || !stitchDisplay) {
            console.log('[BACK-LOGO-COMPLETE-FIX] Buttons not found yet, retrying...');
            setTimeout(fixBackLogoButtons, 500);
            return;
        }
        
        console.log('[BACK-LOGO-COMPLETE-FIX] Found buttons, fixing handlers');
        
        // Remove any existing click handlers
        const newIncrementBtn = incrementBtn.cloneNode(true);
        const newDecrementBtn = decrementBtn.cloneNode(true);
        incrementBtn.parentNode.replaceChild(newIncrementBtn, incrementBtn);
        decrementBtn.parentNode.replaceChild(newDecrementBtn, decrementBtn);
        
        // Add our complete handlers
        newIncrementBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            
            // Get current stitch count
            const currentText = stitchDisplay.textContent;
            const currentValue = parseInt(currentText.replace(/[^0-9]/g, '')) || 5000;
            
            // Increment by 1000
            let newValue = currentValue + 1000;
            newValue = Math.min(15000, newValue); // Max 15,000
            
            console.log('[BACK-LOGO-COMPLETE-FIX] Increment clicked - changing from', currentValue, 'to', newValue);
            
            // Update display
            stitchDisplay.textContent = newValue.toLocaleString();
            
            // Update everything
            updateBackLogoPrice(newValue);
        });
        
        newDecrementBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            
            // Get current stitch count
            const currentText = stitchDisplay.textContent;
            const currentValue = parseInt(currentText.replace(/[^0-9]/g, '')) || 5000;
            
            // Decrement by 1000
            let newValue = currentValue - 1000;
            newValue = Math.max(5000, newValue); // Min 5,000
            
            console.log('[BACK-LOGO-COMPLETE-FIX] Decrement clicked - changing from', currentValue, 'to', newValue);
            
            // Update display
            stitchDisplay.textContent = newValue.toLocaleString();
            
            // Update everything
            updateBackLogoPrice(newValue);
        });
        
        console.log('[BACK-LOGO-COMPLETE-FIX] Button handlers attached successfully');
    }
    
    // Also fix the checkbox to ensure back logo shows when checked
    function fixBackLogoCheckbox() {
        const checkbox = document.getElementById('back-logo-checkbox');
        if (!checkbox) return;
        
        checkbox.addEventListener('change', function() {
            const backLogoLine = document.getElementById('hero-back-logo-line');
            if (backLogoLine) {
                backLogoLine.style.display = this.checked ? 'block' : 'none';
            }
            
            if (this.checked) {
                // Get current stitch count and update price
                const stitchDisplay = document.getElementById('back-logo-stitch-display');
                if (stitchDisplay) {
                    const stitchCount = parseInt(stitchDisplay.textContent.replace(/[^0-9]/g, '')) || 5000;
                    updateBackLogoPrice(stitchCount);
                }
            } else {
                // Update totals when unchecked
                updateHeroTotal();
            }
        });
    }
    
    // Initialize everything
    function initialize() {
        console.log('[BACK-LOGO-COMPLETE-FIX] Starting initialization');
        
        // Fix the buttons
        fixBackLogoButtons();
        
        // Fix the checkbox
        fixBackLogoCheckbox();
        
        // If back logo is already checked, update the display
        const checkbox = document.getElementById('back-logo-checkbox');
        if (checkbox && checkbox.checked) {
            const stitchDisplay = document.getElementById('back-logo-stitch-display');
            if (stitchDisplay) {
                const stitchCount = parseInt(stitchDisplay.textContent.replace(/[^0-9]/g, '')) || 5000;
                setTimeout(() => updateBackLogoPrice(stitchCount), 500);
            }
        }
        
        console.log('[BACK-LOGO-COMPLETE-FIX] Initialization complete');
    }
    
    // Start initialization when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            setTimeout(initialize, 1000);
        });
    } else {
        setTimeout(initialize, 1000);
    }
    
    // Export for manual testing
    window.updateBackLogoPrice = updateBackLogoPrice;
    
    console.log('[BACK-LOGO-COMPLETE-FIX] Complete fix loaded');
})();