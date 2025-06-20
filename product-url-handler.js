/**
 * Product URL Parameter Handler
 * 
 * This script handles URL parameters for the product page, specifically:
 * - StyleNumber: The style number to load
 * - COLOR: Optional color code to select
 */

document.addEventListener('DOMContentLoaded', function() {
    console.log('Product URL Handler: Initializing...');
    
    // Skip if we're on a page that handles its own URL parameters
    if (window.location.pathname.includes('cap-embroidery') || 
        window.location.pathname.includes('embroidery-pricing') ||
        window.location.pathname.includes('dtg-pricing')) {
        console.log('Product URL Handler: Skipping - page handles its own URL parameters');
        return;
    }
    
    // Get URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const styleNumber = urlParams.get('StyleNumber');
    const colorCode = urlParams.get('COLOR');
    
    if (styleNumber) {
        console.log('URL StyleNumber parameter:', styleNumber);
        
        // Set the style number in the search input
        const styleInput = document.getElementById('style-search-input');
        if (styleInput) {
            styleInput.value = styleNumber;
        }
        
        // Trigger the product details loading
        if (typeof loadProductDetails === 'function') {
            // Small delay to ensure all scripts are loaded
            setTimeout(() => {
                loadProductDetails(styleNumber);
                
                // If a color code is specified, select it after product details are loaded
                if (colorCode) {
                    console.log('URL COLOR parameter:', colorCode);
                    
                    // Wait for swatches to load before selecting color
                    const checkSwatches = setInterval(() => {
                        const swatches = document.querySelectorAll('.color-swatch');
                        if (swatches.length > 0) {
                            clearInterval(checkSwatches);
                            
                            // Find the swatch with the matching color code
                            let found = false;
                            swatches.forEach(swatch => {
                                if (swatch.getAttribute('data-color') === colorCode) {
                                    found = true;
                                    // Trigger a click on the swatch
                                    swatch.click();
                                }
                            });
                            
                            if (!found) {
                                console.warn(`Color code ${colorCode} not found in available swatches`);
                            }
                        }
                    }, 500); // Check every 500ms
                }
            }, 100);
        } else {
            console.error('Product URL Handler: loadProductDetails function not found');
        }
    } else {
        console.log('Product URL Handler: No StyleNumber parameter found in URL');
    }
});