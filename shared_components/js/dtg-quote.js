// DTG Quote Functionality
console.log("[DTG-QUOTE] Loading DTG quote functionality...");

/**
 * Prints the current quote
 */
function printQuote() {
    console.log("[DTG-QUOTE] Preparing quote for printing...");
    
    // Add print-specific styles
    const printStyles = document.createElement('style');
    printStyles.id = 'print-styles-temp';
    printStyles.innerHTML = `
        @media print {
            /* Hide elements that shouldn't print */
            .no-print, 
            #add-to-cart-button,
            .navigation-area,
            .color-swatches-container,
            .quote-actions,
            .show-more-colors,
            .image-thumbnails,
            .image-zoom-overlay,
            #view-cart-summary-button,
            .back-to-product,
            #parent-dtg-location-select,
            .quantity-controls,
            .size-grid-container { 
                display: none !important; 
            }
            
            /* Ensure pricing grid prints nicely */
            .pricing-grid { 
                box-shadow: none !important;
                page-break-inside: avoid;
            }
            
            /* Make sure the page uses full width */
            .container {
                max-width: 100% !important;
                padding: 0 !important;
            }
            
            /* Adjust columns for print */
            .product-page-columns-container {
                display: block !important;
            }
            
            .product-context-column,
            .product-interactive-column {
                width: 100% !important;
                flex: none !important;
                margin: 0 !important;
            }
            
            /* Style the quote header */
            .quote-header-print {
                page-break-after: avoid;
                margin-bottom: 30px;
            }
            
            /* Ensure product image prints at reasonable size */
            .main-image-container img {
                max-width: 300px !important;
                height: auto !important;
                margin: 0 auto !important;
                display: block !important;
            }
            
            /* Clean up spacing */
            .product-header {
                margin-bottom: 20px !important;
            }
            
            /* Show print-only elements */
            .print-only {
                display: block !important;
            }
        }
        
        @page {
            margin: 0.75in;
        }
    `;
    document.head.appendChild(printStyles);
    
    // Get product information
    const productTitle = document.getElementById('product-title-context')?.textContent || 'Product';
    const styleNumber = document.getElementById('product-style-context')?.textContent || '';
    const selectedColor = document.getElementById('pricing-color-name')?.textContent || 'Not Selected';
    const selectedLocation = document.getElementById('parent-dtg-location-select');
    const locationText = selectedLocation?.options[selectedLocation.selectedIndex]?.text || 'Not Selected';
    
    // Get total quantity and price
    const totalQuantity = document.querySelector('.total-quantity')?.textContent || '0';
    const totalPrice = document.querySelector('.total-price')?.textContent || '$0.00';
    
    // Create quote header
    const quoteHeader = document.createElement('div');
    quoteHeader.className = 'quote-header-print print-only';
    quoteHeader.style.cssText = 'display: none; text-align: center; margin-bottom: 30px; padding: 20px; border: 2px solid #2e5827;';
    quoteHeader.innerHTML = `
        <div style="margin-bottom: 20px;">
            <img src="/images/nwca-logo.png" alt="Northwest Custom Apparel" style="max-width: 200px; height: auto;">
        </div>
        <h2 style="color: #2e5827; margin-bottom: 20px;">DTG Pricing Quote</h2>
        <div style="text-align: left; max-width: 600px; margin: 0 auto;">
            <p><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
            <p><strong>Valid for:</strong> 30 days</p>
            <p><strong>Product:</strong> ${productTitle} (${styleNumber})</p>
            <p><strong>Color:</strong> ${selectedColor}</p>
            <p><strong>Print Location:</strong> ${locationText}</p>
            <p><strong>Total Quantity:</strong> ${totalQuantity} items</p>
            <p><strong>Estimated Total:</strong> ${totalPrice}</p>
            <hr style="margin: 20px 0; border-color: #dee2e6;">
            <p><strong>Contact:</strong></p>
            <p>Email: sales@northwestcustomapparel.com</p>
            <p>Phone: 253-922-5793</p>
            <p>Website: www.northwestcustomapparel.com</p>
        </div>
    `;
    
    // Insert quote header at the beginning of the pricing section
    const pricingSection = document.querySelector('.pricing-section');
    if (pricingSection) {
        pricingSection.insertBefore(quoteHeader, pricingSection.firstChild);
    }
    
    // Add quote details section
    const quoteDetails = document.createElement('div');
    quoteDetails.className = 'quote-details-print print-only';
    quoteDetails.style.cssText = 'display: none; margin-top: 30px; padding: 20px; background-color: #f8f9fa; border-radius: 8px;';
    quoteDetails.innerHTML = `
        <h4 style="color: #2e5827; margin-bottom: 15px;">Quote Details:</h4>
        <ul style="list-style-type: none; padding: 0;">
            <li>✓ Pricing includes full-color DTG print on selected location</li>
            <li>✓ No setup fees</li>
            <li>✓ Fast turnaround time</li>
            <li>✓ Minimum order: 12 pieces</li>
            <li>✓ Volume discounts automatically applied</li>
        </ul>
        <p style="margin-top: 20px; font-style: italic; color: #666;">
            * Prices subject to change. Final pricing confirmed at time of order.
        </p>
    `;
    
    // Add details after the pricing grid
    const pricingGrid = document.getElementById('custom-pricing-grid');
    if (pricingGrid && pricingGrid.parentNode) {
        pricingGrid.parentNode.insertBefore(quoteDetails, pricingGrid.nextSibling);
    }
    
    // Trigger print dialog
    setTimeout(() => {
        window.print();
        
        // Cleanup after print
        setTimeout(() => {
            printStyles.remove();
            quoteHeader.remove();
            quoteDetails.remove();
        }, 1000);
    }, 100);
}

/**
 * Emails the quote (placeholder for now)
 */
function emailQuote() {
    console.log("[DTG-QUOTE] Email quote functionality...");
    
    // Get product information
    const productTitle = document.getElementById('product-title-context')?.textContent || 'Product';
    const styleNumber = document.getElementById('product-style-context')?.textContent || '';
    const selectedColor = document.getElementById('pricing-color-name')?.textContent || 'Not Selected';
    const selectedLocation = document.getElementById('parent-dtg-location-select');
    const locationText = selectedLocation?.options[selectedLocation.selectedIndex]?.text || 'Not Selected';
    const totalQuantity = document.querySelector('.total-quantity')?.textContent || '0';
    const totalPrice = document.querySelector('.total-price')?.textContent || '$0.00';
    
    // Create email subject and body
    const subject = `DTG Quote Request - ${productTitle}`;
    const body = `Hello,

I would like to request a formal quote for the following:

Product: ${productTitle} (${styleNumber})
Color: ${selectedColor}
Print Location: ${locationText}
Total Quantity: ${totalQuantity} items
Estimated Total: ${totalPrice}

Please send me a formal quote for this order.

Thank you!`;
    
    // Open email client
    const mailtoLink = `mailto:sales@northwestcustomapparel.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = mailtoLink;
}

// Make functions globally available
window.printQuote = printQuote;
window.emailQuote = emailQuote;

console.log("[DTG-QUOTE] Quote functionality loaded");