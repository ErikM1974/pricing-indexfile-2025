console.log('[PRICING-MATRIX-FIX] Loading enhanced pricing matrix capture fix v2');

(function() {
    'use strict';
    
    // Store original functions
    const originalCapturePricingMatrix = window.capturePricingMatrix;
    const originalCheckForPricingData = window.checkForPricingData;
    const originalInitialize = window.PricingMatrixCapture?.initialize;
    
    // Flag to track if DTG data is available
    let dtgDataAvailable = false;
    let captureInterval = null;
    
    // Clear any existing intervals
    function clearAllCaptureIntervals() {
        // Clear any intervals in the 1-10000 range (common interval IDs)
        for (let i = 1; i < 10000; i++) {
            clearInterval(i);
        }
        console.log('[PRICING-MATRIX-FIX] Cleared all potential capture intervals');
    }
    
    // Monitor for DTG pricing data
    window.addEventListener('pricingDataLoaded', function(event) {
        if (event.detail && event.detail.embellishmentType === 'dtg') {
            console.log('[PRICING-MATRIX-FIX] DTG pricing data received, marking as processed');
            dtgDataAvailable = true;
            
            // Clear all intervals when DTG data is available
            clearAllCaptureIntervals();
            
            // Also clear our own interval if it exists
            if (captureInterval) {
                clearInterval(captureInterval);
                captureInterval = null;
            }
        }
    });
    
    // Check if this is a DTG page
    function isDTGPage() {
        const url = window.location.href.toLowerCase();
        return url.includes('/dtg') || url.includes('dtg-pricing');
    }
    
    // If this is a DTG page, override capture behavior immediately
    if (isDTGPage()) {
        console.log('[PRICING-MATRIX-FIX] DTG page detected, overriding capture behavior');
        
        // Clear any existing intervals immediately
        setTimeout(clearAllCaptureIntervals, 100);
        
        // Override the initialize function to prevent interval creation
        if (window.PricingMatrixCapture) {
            window.PricingMatrixCapture.initialize = function() {
                console.log('[PRICING-MATRIX-FIX] Blocked PricingMatrixCapture.initialize on DTG page');
                
                // Still dispatch the initialized event that other systems might be waiting for
                window.dispatchEvent(new CustomEvent('pricingMatrixInitialized'));
                
                // Return a fake interval ID
                return 999999;
            };
        }
        
        // Override checkForPricingData to prevent execution
        window.checkForPricingData = function() {
            if (dtgDataAvailable) {
                console.log('[PRICING-MATRIX-FIX] Blocked checkForPricingData - DTG data already available');
                return;
            }
            
            // Allow limited attempts if DTG data isn't available yet
            if (window.captureAttempts === undefined) {
                window.captureAttempts = 0;
            }
            
            window.captureAttempts++;
            
            if (window.captureAttempts > 5) {
                console.log('[PRICING-MATRIX-FIX] Stopped checkForPricingData after 5 attempts');
                clearAllCaptureIntervals();
                return;
            }
            
            // Call original function with limited attempts
            if (originalCheckForPricingData) {
                originalCheckForPricingData.call(this);
            }
        };
        
        // Override capturePricingMatrix for DTG pages
        window.capturePricingMatrix = function(table, styleNumber, color, embellishmentType) {
            console.log('[PRICING-MATRIX-FIX] capturePricingMatrix called for DTG page');
            
            // If DTG data is already available, don't capture from DOM
            if (dtgDataAvailable) {
                console.log('[PRICING-MATRIX-FIX] DTG data already available via adapter, skipping DOM capture');
                return null;
            }
            
            // For DTG, we need to handle the tier mapping differently
            if (embellishmentType === 'dtg') {
                console.log('[PRICING-MATRIX-FIX] Attempting DTG capture with flexible tier mapping');
                
                // Try to capture with flexible tier detection
                const headers = [];
                const headerCells = table.querySelectorAll('thead th');
                
                headerCells.forEach((cell, index) => {
                    if (index > 0) { // Skip first column
                        const text = cell.textContent.trim();
                        if (text) {
                            headers.push(text);
                        }
                    }
                });
                
                // If we found headers, try to map them to DTG tiers
                if (headers.length > 0) {
                    const tierMapping = {
                        '24-47': ['24-47', '24 - 47', '24 to 47', '24-47 pcs'],
                        '48-71': ['48-71', '48 - 71', '48 to 71', '48-71 pcs'],
                        '72+': ['72+', '72 +', '72 or more', '72+ pcs', '72 and up']
                    };
                    
                    // Create a mapped result
                    const mappedHeaders = headers.map(header => {
                        for (const [tier, variations] of Object.entries(tierMapping)) {
                            if (variations.some(v => header.toLowerCase().includes(v.toLowerCase()))) {
                                return tier;
                            }
                        }
                        return header; // Return original if no mapping found
                    });
                    
                    console.log('[PRICING-MATRIX-FIX] Mapped headers:', mappedHeaders);
                    
                    // Continue with original capture logic but with mapped headers
                    // This is a simplified version - you'd need to implement full capture logic
                    return {
                        headers: mappedHeaders,
                        prices: {},
                        tierData: {},
                        embellishmentType: 'dtg'
                    };
                }
            }
            
            // Fall back to original function for non-DTG
            if (originalCapturePricingMatrix) {
                return originalCapturePricingMatrix.call(this, table, styleNumber, color, embellishmentType);
            }
            
            return null;
        };
    }
    
    // Ensure required UI elements exist for cart integration
    function ensureCartUIElements() {
        // Check if size-quantity-grid-container exists
        let sizeQuantityContainer = document.getElementById('size-quantity-grid-container');
        if (!sizeQuantityContainer) {
            // Try to find the add-to-cart section
            const addToCartSection = document.querySelector('.add-to-cart-section');
            if (addToCartSection) {
                sizeQuantityContainer = document.createElement('div');
                sizeQuantityContainer.id = 'size-quantity-grid-container';
                sizeQuantityContainer.className = 'size-quantity-grid-container';
                addToCartSection.appendChild(sizeQuantityContainer);
                console.log('[PRICING-MATRIX-FIX] Created size-quantity-grid-container');
            }
        }
        
        // Ensure pricing table has the right class
        const pricingTable = document.querySelector('#custom-pricing-grid');
        if (pricingTable && !pricingTable.classList.contains('matrix-price-table')) {
            pricingTable.classList.add('matrix-price-table');
            console.log('[PRICING-MATRIX-FIX] Added matrix-price-table class');
        }
        
        // Ensure matrix-note exists
        let matrixNote = document.getElementById('matrix-note');
        if (!matrixNote) {
            matrixNote = document.createElement('div');
            matrixNote.id = 'matrix-note';
            matrixNote.className = 'matrix-note';
            matrixNote.innerHTML = '<p class="note-text">Note: Prices shown are per piece and include decoration.</p>';
            
            // Insert after pricing table
            const pricingTable = document.querySelector('#custom-pricing-grid');
            if (pricingTable && pricingTable.parentNode) {
                pricingTable.parentNode.insertBefore(matrixNote, pricingTable.nextSibling);
                console.log('[PRICING-MATRIX-FIX] Created matrix-note div');
            }
        }
    }
    
    // Set up UI elements when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', ensureCartUIElements);
    } else {
        ensureCartUIElements();
    }
    
    // Also check after a delay to ensure elements are created
    setTimeout(ensureCartUIElements, 2000);
    
    // Final cleanup after 5 seconds to ensure no lingering intervals
    setTimeout(() => {
        clearAllCaptureIntervals();
        console.log('[PRICING-MATRIX-FIX] Final interval cleanup completed');
    }, 5000);
    
    console.log('[PRICING-MATRIX-FIX] Enhanced pricing matrix capture fix initialized v2');
})();