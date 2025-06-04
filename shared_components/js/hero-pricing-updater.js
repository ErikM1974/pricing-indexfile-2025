/**
 * Hero Pricing Updater
 * Updates pricing display to work with new unit-price-focused layout
 */

(function() {
    'use strict';

    // Store original updatePricing function
    const originalUpdatePricing = window.updateHeroPricing || function() {};

    // Override the pricing update function
    window.updateHeroPricing = function(unitPrice, totalPrice) {
        // Update unit price (now primary)
        const unitPriceElement = document.querySelector('.hero-price-amount');
        if (unitPriceElement) {
            const formattedUnit = typeof unitPrice === 'number' 
                ? '$' + unitPrice.toFixed(2) 
                : unitPrice;
            
            // Add animation
            unitPriceElement.classList.add('updating');
            unitPriceElement.textContent = formattedUnit;
            
            setTimeout(() => {
                unitPriceElement.classList.remove('updating');
            }, 300);
        }

        // Update total price (now secondary)
        const totalPriceElement = document.getElementById('hero-total-price');
        if (totalPriceElement) {
            const formattedTotal = typeof totalPrice === 'number' 
                ? '$' + totalPrice.toFixed(2) 
                : totalPrice;
            
            // Keep the prefix
            totalPriceElement.innerHTML = '<span class="hero-price-prefix">Total:</span> ' + formattedTotal;
        }

        // Call original function if it exists
        if (typeof originalUpdatePricing === 'function') {
            originalUpdatePricing(unitPrice, totalPrice);
        }
    };

    // Helper function to extract price value
    window.extractPriceValue = function(priceText) {
        if (typeof priceText === 'string') {
            const match = priceText.match(/\$?([\d,]+\.?\d*)/);
            return match ? parseFloat(match[1].replace(/,/g, '')) : 0;
        }
        return priceText;
    };

    // Listen for pricing updates
    document.addEventListener('pricingCalculated', function(e) {
        if (e.detail && e.detail.unitPrice && e.detail.totalPrice) {
            updateHeroPricing(e.detail.unitPrice, e.detail.totalPrice);
        }
    });

    // Fix any existing code that updates the old way
    const observer = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
            if (mutation.target.id === 'hero-unit-price' && mutation.type === 'childList') {
                // Old code is trying to update - intercept and fix
                const text = mutation.target.textContent;
                const match = text.match(/\$?([\d.]+)/);
                if (match) {
                    const unitPrice = parseFloat(match[1]);
                    const unitPriceElement = document.querySelector('.hero-price-amount');
                    if (unitPriceElement) {
                        unitPriceElement.textContent = '$' + unitPrice.toFixed(2);
                    }
                }
            }
        });
    });

    // Start observing once DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            const unitPriceDiv = document.getElementById('hero-unit-price');
            if (unitPriceDiv) {
                observer.observe(unitPriceDiv, { childList: true, characterData: true, subtree: true });
            }
        });
    }

    console.log('[HERO-PRICING] Updater initialized');

})();