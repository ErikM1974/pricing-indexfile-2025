// Add to Cart functionality for embroidery pricing pages
(function() {
    "use strict";

    console.log("[ADD-TO-CART] Initializing add to cart functionality");
    
    // Detect embellishment type based on URL or page content
    function detectEmbellishmentType() {
        // Try to detect from URL or page title
        const url = window.location.href.toLowerCase();
        const title = document.title.toLowerCase();
        
        if (url.includes('cap-embroidery') || title.includes('cap embroidery')) {
            return 'cap-embroidery';
        }
        if (url.includes('embroidery') || title.includes('embroidery')) {
            return 'embroidery';
        }
        if (url.includes('dtg') || title.includes('dtg')) {
            return 'dtg';
        }
        if (url.includes('screen-print') || url.includes('screenprint') || title.includes('screen print')) {
            return 'screen-print';
        }
        if (url.includes('dtf') || title.includes('dtf')) {
            return 'dtf';
        }
        
        // Default if we can't detect
        return 'embroidery';
    }

    // Function to add necessary elements for cart integration
    function addCartIntegrationElements() {
        console.log("[ADD-TO-CART] Adding cart integration elements");

        // Check if elements already exist
        if (document.getElementById('matrix-note') && document.getElementById('matrix-title') && document.querySelector('.matrix-price-table')) {
            console.log("[ADD-TO-CART] Cart integration elements already exist");
            return;
        }

        // 1. Add matrix-title element
        const pricingInfo = document.querySelector('.pricing-info');
        if (pricingInfo) {
            const titleElement = document.createElement('div');
            titleElement.id = 'matrix-title';
            titleElement.style.display = 'none'; // Hide it as it's just for cart integration
            pricingInfo.appendChild(titleElement);
            console.log("[ADD-TO-CART] Added matrix-title element");
        }

        // 2. Add matrix-note element
        const pricingCalculator = document.getElementById('pricing-calculator');
        if (pricingCalculator) {
            const noteElement = document.createElement('div');
            noteElement.id = 'matrix-note';
            noteElement.style.display = 'block'; // This needs to be visible for the cart button
            pricingCalculator.appendChild(noteElement);
            console.log("[ADD-TO-CART] Added matrix-note element");
            
            // Add a style to make the cart button container visible when it's added
            const styleEl = document.createElement('style');
            styleEl.textContent = `
                #cart-button-container {
                    display: block !important;
                    margin-top: 20px !important;
                    padding: 20px !important;
                    background-color: #f8f8f8 !important;
                    border-radius: 8px !important;
                    border: 1px solid #ddd !important;
                    z-index: 1000 !important;
                    box-shadow: 0 2px 10px rgba(0,0,0,0.05) !important;
                }
                
                #cart-button-container h4 {
                    text-align: center !important;
                    color: #0056b3 !important;
                    font-size: 1.2rem !important;
                    margin-bottom: 15px !important;
                }
                
                .product-summary {
                    display: flex !important;
                    align-items: center !important;
                    justify-content: center !important;
                    flex-direction: column !important;
                    margin-bottom: 20px !important;
                    padding: 15px !important;
                    background-color: #f0f8ff !important;
                    border-radius: 5px !important;
                    border: 1px solid #d0e5ff !important;
                    text-align: center !important;
                }
                
                #add-to-cart-button {
                    display: block !important;
                    background-color: #0056b3 !important;
                    color: white !important;
                    border: none !important;
                    border-radius: 4px !important;
                    padding: 12px 25px !important;
                    cursor: pointer !important;
                    font-weight: bold !important;
                    margin: 20px auto 0 !important;
                    font-size: 1.1rem !important;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.2) !important;
                    transition: all 0.2s ease !important;
                }
                
                #add-to-cart-button:hover {
                    background-color: #003d80 !important;
                    transform: translateY(-2px) !important;
                    box-shadow: 0 4px 8px rgba(0,0,0,0.2) !important;
                }
                
                .size-input-grid {
                    display: flex !important;
                    flex-wrap: nowrap !important;
                    gap: 15px !important;
                    margin-bottom: 20px !important;
                    justify-content: center !important;
                    margin: 0 auto !important;
                    max-width: 100% !important;
                    overflow-x: auto !important;
                    padding: 10px 0 !important;
                }
                
                .size-input-group {
                    display: flex !important;
                    flex-direction: column !important;
                    align-items: center !important;
                    padding: 10px !important;
                    border: 1px solid #d0e5ff !important;
                    border-radius: 6px !important;
                    background-color: #f9f9f9 !important;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.05) !important;
                    transition: all 0.2s ease !important;
                }
                
                .size-input-group:hover {
                    background-color: #f0f8ff !important;
                    border-color: #90c3ff !important;
                }
                
                .size-input-group label {
                    margin-bottom: 8px !important;
                    font-weight: bold !important;
                    color: #0056b3 !important;
                }
                
                .size-quantity-input {
                    width: 65px !important;
                    padding: 8px !important;
                    text-align: center !important;
                    border: 1px solid #ccc !important;
                    border-radius: 4px !important;
                    font-size: 1rem !important;
                }
            `;
            document.head.appendChild(styleEl);
            console.log("[ADD-TO-CART] Added styles to ensure cart button visibility");
        }
        
        // 3. Add matrix-price-table element if it doesn't exist
        if (!document.querySelector('.matrix-price-table')) {
            // Find the actual pricing table that Caspio creates
            const existingTable = document.querySelector('table.cbResultSetTable') ||
                                  document.querySelector('table');
            
            if (existingTable) {
                // Add the matrix-price-table class to the existing table
                existingTable.classList.add('matrix-price-table');
                console.log("[ADD-TO-CART] Added matrix-price-table class to existing table");
            } else {
                // If no table exists yet, create a hidden one as a placeholder
                const tableElement = document.createElement('table');
                tableElement.className = 'matrix-price-table';
                tableElement.style.display = 'none'; // Hide it as it's just for cart integration
                
                // Add it to the pricing calculator
                if (pricingCalculator) {
                    pricingCalculator.appendChild(tableElement);
                    console.log("[ADD-TO-CART] Created placeholder matrix-price-table element");
                }
            }
        }
    }

    // Function to initialize cart integration
    function initializeCartIntegration() {
        console.log("[ADD-TO-CART] Initializing cart integration");
        
        // First add the necessary elements
        addCartIntegrationElements();
        
        // Then initialize cart integration if available
        if (window.initCartIntegration && typeof window.initCartIntegration === 'function') {
            console.log("[ADD-TO-CART] Calling initCartIntegration");
            window.initCartIntegration();
        } else {
            console.warn("[ADD-TO-CART] initCartIntegration function not found");
            
            // Try again after a short delay
            setTimeout(() => {
                if (window.initCartIntegration && typeof window.initCartIntegration === 'function') {
                    console.log("[ADD-TO-CART] Calling initCartIntegration after delay");
                    window.initCartIntegration();
                } else {
                    console.error("[ADD-TO-CART] initCartIntegration function still not found after delay");
                }
            }, 1000);
        }
        
        // Listen for cart updates to refresh price displays
        if (window.NWCACart) {
            console.log("[ADD-TO-CART] Setting up cart update listener");
            window.NWCACart.addEventListener('cartUpdated', function() {
                console.log("[ADD-TO-CART] Cart updated, refreshing price displays");
                updateAllPriceDisplays();
                
                // Also update pricing summary if it exists
                const pricingSummary = document.getElementById('pricing-tier-summary');
                if (pricingSummary && typeof updatePricingSummary === 'function') {
                    console.log("[ADD-TO-CART] Updating pricing summary after cart update");
                    updatePricingSummary();
                }
            });
        }
    }
    
    // Function to manually add the cart button if it's not being added by cart-integration.js
    function addCartButtonManually() {
        console.log("[ADD-TO-CART] Checking if cart button needs to be added manually");
        
        // Check if the cart button container already exists
        if (document.getElementById('cart-button-container')) {
            console.log("[ADD-TO-CART] Cart button container already exists, no need to add manually");
            return;
        }
        
        // Find the note element where the cart button should be added
        const noteElement = document.getElementById('matrix-note');
        if (!noteElement) {
            console.log("[ADD-TO-CART] Note element not found, cannot add cart button manually");
            return;
        }
        
        console.log("[ADD-TO-CART] Adding cart button manually");
        
        // Get the product info from URL first to avoid reference errors
        const urlParams = new URLSearchParams(window.location.search);
        const styleNumber = urlParams.get('StyleNumber') || '';
        const colorCode = urlParams.get('COLOR') || '';
        
        console.log("[ADD-TO-CART] Product info from URL:", styleNumber, colorCode);
        
        // Create the cart button container
        const container = document.createElement('div');
        container.id = 'cart-button-container';
        container.style.display = 'block';
        container.style.marginTop = '20px';
        container.style.padding = '15px';
        container.style.backgroundColor = '#f8f8f8';
        container.style.borderRadius = '5px';
        container.style.border = '1px solid #ddd';
        
        // Add heading
        const heading = document.createElement('h4');
        heading.textContent = 'Add to Quote';
        heading.style.marginBottom = '15px';
        heading.style.textAlign = 'center';
        heading.style.color = '#0056b3';
        heading.style.fontSize = '1.2rem';
        container.appendChild(heading);
        
        // Add product summary section
        const productSummary = document.createElement('div');
        productSummary.className = 'product-summary';
        productSummary.style.display = 'flex';
        productSummary.style.alignItems = 'center';
        productSummary.style.justifyContent = 'center';
        productSummary.style.marginBottom = '20px';
        productSummary.style.padding = '15px';
        productSummary.style.backgroundColor = '#f0f8ff';
        productSummary.style.borderRadius = '5px';
        productSummary.style.border = '1px solid #d0e5ff';
        productSummary.style.textAlign = 'center';
        productSummary.style.flexDirection = 'column'; // Stack image and text vertically
        
        // Add pricing tier summary
        const pricingSummary = document.createElement('div');
        pricingSummary.id = 'pricing-tier-summary';
        pricingSummary.style.marginTop = '15px';
        pricingSummary.style.padding = '8px 12px';
        pricingSummary.style.backgroundColor = '#e8f4ff';
        pricingSummary.style.borderRadius = '4px';
        pricingSummary.style.border = '1px dashed #90c3ff';
        pricingSummary.style.fontSize = '0.9rem';
        pricingSummary.style.color = '#0056b3';
        pricingSummary.style.fontWeight = 'bold';
        pricingSummary.textContent = 'Calculating pricing...';
        
        // Try to get product image
        const productImageSrc = document.querySelector('.product-image img')?.src ||
                               document.querySelector('#product-image')?.src ||
                               document.querySelector('img[alt*="product"]')?.src ||
                               document.querySelector('.cbResultSetData img')?.src;
        
        // Add product image if found
        if (productImageSrc) {
            const productImage = document.createElement('img');
            productImage.src = productImageSrc;
            productImage.alt = 'Product Image';
            productImage.style.width = '150px';
            productImage.style.height = 'auto';
            productImage.style.marginBottom = '15px';
            productImage.style.border = '1px solid #ddd';
            productImage.style.borderRadius = '4px';
            productImage.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)';
            productSummary.appendChild(productImage);
        }
        
        // Add product details
        const productDetails = document.createElement('div');
        productDetails.style.flex = '1';
        
        // Get product name
        const productName = document.querySelector('h1')?.textContent ||
                           document.querySelector('h2')?.textContent ||
                           `Product ${styleNumber}`;
        
        const productNameElem = document.createElement('div');
        productNameElem.style.fontWeight = 'bold';
        productNameElem.style.fontSize = '1.1rem';
        productNameElem.style.marginBottom = '5px';
        productNameElem.textContent = productName;
        productDetails.appendChild(productNameElem);
        
        const productStyle = document.createElement('div');
        productStyle.innerHTML = `<strong>Style:</strong> ${styleNumber}`;
        productStyle.style.marginBottom = '3px';
        productDetails.appendChild(productStyle);
        
        const productColor = document.createElement('div');
        productColor.innerHTML = `<strong>Color:</strong> ${colorCode}`;
        productDetails.appendChild(productColor);
        
        productSummary.appendChild(productDetails);
        productSummary.appendChild(pricingSummary);
        
        // Add the product summary to the container
        container.appendChild(productSummary);
        
        // Function to update the pricing tier summary
        async function updatePricingSummary() {
            const summary = document.getElementById('pricing-tier-summary');
            if (!summary) return;
            
            try {
                const totalQuantity = await getTotalQuantityForEmbellishmentType();
                const pricingTier = getPricingTierForQuantity(totalQuantity);
                const ltmFeePerItem = calculateLTMFeePerItem(totalQuantity);
                const embType = detectEmbellishmentType();
                
                // Format the embellishment type
                let formattedEmbType = embType;
                if (embType === 'embroidery') {
                    formattedEmbType = 'Embroidery';
                } else if (embType === 'cap-embroidery') {
                    formattedEmbType = 'Cap Embroidery';
                } else if (embType === 'dtg') {
                    formattedEmbType = 'DTG Print';
                } else if (embType === 'dtf') {
                    formattedEmbType = 'DTF Transfer';
                } else if (embType === 'screen-print') {
                    formattedEmbType = 'Screen Print';
                }
                
                // Update the summary text
                if (ltmFeePerItem > 0) {
                    summary.innerHTML = `Total ${formattedEmbType} Quantity: <span style="color: #dc3545;">${totalQuantity}</span> (${pricingTier} tier + $50.00 LTM fee)`;
                    summary.style.backgroundColor = '#fff8e8';
                    summary.style.borderColor = '#ffc107';
                    
                    // Add next tier info
                    if (totalQuantity < 24) {
                        const neededForNextTier = 24 - totalQuantity;
                        summary.innerHTML += `<br><span style="font-size: 0.85em; color: #6c757d;">Add ${neededForNextTier} more for 24-47 tier pricing (no LTM fee)</span>`;
                    }
                } else {
                    summary.innerHTML = `Total ${formattedEmbType} Quantity: <span style="color: #28a745;">${totalQuantity}</span> (${pricingTier} tier)`;
                    
                    // Add next tier info
                    if (totalQuantity >= 24 && totalQuantity < 48) {
                        const neededForNextTier = 48 - totalQuantity;
                        summary.innerHTML += `<br><span style="font-size: 0.85em; color: #6c757d;">Add ${neededForNextTier} more for 48-71 tier pricing</span>`;
                    } else if (totalQuantity >= 48 && totalQuantity < 72) {
                        const neededForNextTier = 72 - totalQuantity;
                        summary.innerHTML += `<br><span style="font-size: 0.85em; color: #6c757d;">Add ${neededForNextTier} more for 72+ tier pricing</span>`;
                    } else if (totalQuantity >= 72) {
                        summary.innerHTML += `<br><span style="font-size: 0.85em; color: #28a745;">You're getting our best quantity pricing!</span>`;
                    }
                }
            } catch (error) {
                console.error('[ADD-TO-CART] Error updating pricing summary:', error);
                summary.textContent = 'Pricing information unavailable';
                summary.style.color = '#dc3545';
            }
        }
        
        // Update pricing summary initially
        updatePricingSummary();
        
        // Add size inputs section with improved styling
        const sizeInputs = document.createElement('div');
        sizeInputs.className = 'size-input-grid';
        sizeInputs.style.display = 'flex';
        sizeInputs.style.flexWrap = 'nowrap';
        sizeInputs.style.gap = '15px';
        sizeInputs.style.marginBottom = '20px';
        sizeInputs.style.justifyContent = 'center';
        sizeInputs.style.margin = '0 auto';
        sizeInputs.style.maxWidth = '100%';
        sizeInputs.style.overflowX = 'auto';
        sizeInputs.style.padding = '10px 0';
        
        // Create a loading message with spinner
        const loadingMsg = document.createElement('div');
        loadingMsg.style.display = 'flex';
        loadingMsg.style.alignItems = 'center';
        loadingMsg.style.justifyContent = 'center';
        loadingMsg.style.width = '100%';
        loadingMsg.style.padding = '20px';
        
        // Add spinner
        const spinner = document.createElement('div');
        spinner.className = 'loading-spinner';
        spinner.style.display = 'inline-block';
        spinner.style.width = '20px';
        spinner.style.height = '20px';
        spinner.style.border = '3px solid rgba(0,86,179,0.3)';
        spinner.style.borderRadius = '50%';
        spinner.style.borderTopColor = '#0056b3';
        spinner.style.marginRight = '10px';
        spinner.style.animation = 'spin 1s linear infinite';
        
        // Add animation keyframes if not already added
        if (!document.getElementById('spinner-keyframes')) {
            const keyframes = document.createElement('style');
            keyframes.id = 'spinner-keyframes';
            keyframes.textContent = `
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
            `;
            document.head.appendChild(keyframes);
        }
        
        // Add text
        const loadingText = document.createElement('span');
        loadingText.textContent = 'Loading available sizes...';
        loadingText.style.fontStyle = 'italic';
        loadingText.style.color = '#0056b3';
        loadingText.style.fontWeight = 'bold';
        
        // Append spinner and text to loading message
        loadingMsg.appendChild(spinner);
        loadingMsg.appendChild(loadingText);
        sizeInputs.appendChild(loadingMsg);
        
        // Always try to fetch inventory data, even if we need to retry
        if (styleNumber && colorCode) {
            console.log("[ADD-TO-CART] Fetching inventory sizes for", styleNumber, colorCode);
            
            // Function to fetch inventory with retries - faster timeout
            const fetchInventoryWithRetry = (retryCount = 0, maxRetries = 3) => {
                // Use the same API endpoint format as cart-integration.js
                const apiUrl = `https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/inventory?styleNumber=${encodeURIComponent(styleNumber)}&color=${encodeURIComponent(colorCode)}`;
                console.log(`[ADD-TO-CART] Fetching inventory from: ${apiUrl}`);
                
                // Show loading animation more prominently
                spinner.style.width = '30px';
                spinner.style.height = '30px';
                spinner.style.border = '4px solid rgba(0,86,179,0.3)';
                spinner.style.borderTopColor = '#0056b3';
                loadingText.style.fontSize = '1.1rem';
                
                fetch(apiUrl)
                    .then(response => {
                        if (!response.ok) {
                            throw new Error(`API returned ${response.status}: ${response.statusText}`);
                        }
                        return response.json();
                    })
                    .then(data => {
                        // Remove loading message
                        if (loadingMsg.parentNode) {
                            loadingMsg.parentNode.removeChild(loadingMsg);
                        }
                        
                        // Extract unique sizes from inventory data
                        let sizes = [];
                        if (data && Array.isArray(data)) {
                            // Extract unique sizes and sort them by SizeSortOrder
                            const sizeMap = new Map(); // Use a map to store size and its sort order
                            data.forEach(item => {
                                if (item.size && !sizeMap.has(item.size)) {
                                    // Store the size with its sort order
                                    sizeMap.set(item.size, parseInt(item.SizeSortOrder) || 99);
                                }
                            });
                            
                            // Convert map to array, sort by sort order, then extract just the size names
                            sizes = Array.from(sizeMap.entries())
                                .sort((a, b) => a[1] - b[1]) // Sort by SizeSortOrder
                                .map(entry => entry[0]); // Get only the size name
                                
                            console.log("[ADD-TO-CART] Found sizes from inventory:", sizes);
                        }
                        
                        if (sizes.length === 0) {
                            // If no sizes found, try to fetch from a different endpoint
                            console.log("[ADD-TO-CART] No sizes found in inventory, trying alternative endpoint");
                            fetch(`https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/sizes?styleNumber=${encodeURIComponent(styleNumber)}`)
                                .then(response => response.json())
                                .then(sizeData => {
                                    if (sizeData && Array.isArray(sizeData) && sizeData.length > 0) {
                                        console.log("[ADD-TO-CART] Found sizes from alternative endpoint:", sizeData);
                                        // Add size inputs
                                        sizeData.forEach(size => {
                                            addSizeInput(sizeInputs, size);
                                        });
                                    } else {
                                        // If still no sizes, show error message
                                        const errorMsg = document.createElement('div');
                                        errorMsg.textContent = 'Unable to load sizes for this product. Please try again later.';
                                        errorMsg.style.color = 'red';
                                        errorMsg.style.fontWeight = 'bold';
                                        errorMsg.style.margin = '10px 0';
                                        sizeInputs.appendChild(errorMsg);
                                    }
                                })
                                .catch(error => {
                                    console.error("[ADD-TO-CART] Error fetching from alternative endpoint:", error);
                                    // Show error message
                                    const errorMsg = document.createElement('div');
                                    errorMsg.textContent = 'Unable to load sizes for this product. Please try again later.';
                                    errorMsg.style.color = 'red';
                                    errorMsg.style.fontWeight = 'bold';
                                    errorMsg.style.margin = '10px 0';
                                    sizeInputs.appendChild(errorMsg);
                                });
                        } else {
                            // Add size inputs for the sizes we found
                            sizes.forEach(size => {
                                addSizeInput(sizeInputs, size);
                            });
                        }
                    })
                    .catch(error => {
                        console.error("[ADD-TO-CART] Error fetching inventory:", error);
                        
                        // Retry if we haven't exceeded max retries
                        if (retryCount < maxRetries) {
                            console.log(`[ADD-TO-CART] Retrying inventory fetch (${retryCount + 1}/${maxRetries})`);
                            setTimeout(() => fetchInventoryWithRetry(retryCount + 1, maxRetries), 1000);
                        } else {
                            // If all retries fail, show error and remove loading message
                            if (loadingMsg.parentNode) {
                                loadingMsg.parentNode.removeChild(loadingMsg);
                            }
                            
                            // Show error message
                            const errorMsg = document.createElement('div');
                            errorMsg.textContent = 'Unable to load sizes for this product. Please try again later.';
                            errorMsg.style.color = 'red';
                            errorMsg.style.fontWeight = 'bold';
                            errorMsg.style.margin = '10px 0';
                            sizeInputs.appendChild(errorMsg);
                        }
                    });
            };
            
            // Start the fetch process with retries
            fetchInventoryWithRetry();
        } else {
            // If we don't have style/color info, show error
            if (loadingMsg.parentNode) {
                loadingMsg.parentNode.removeChild(loadingMsg);
            }
            
            const errorMsg = document.createElement('div');
            errorMsg.textContent = 'Missing product information. Please select a product first.';
            errorMsg.style.color = 'red';
            errorMsg.style.fontWeight = 'bold';
            errorMsg.style.margin = '10px 0';
            sizeInputs.appendChild(errorMsg);
        }
        
        // Helper function to get price for a size and quantity
        async function getPrice(size, quantity) {
            try {
                console.log(`[ADD-TO-CART] Getting price for ${size}, quantity ${quantity}`);
                
                // Get product info from URL
                const urlParams = new URLSearchParams(window.location.search);
                const styleNumber = urlParams.get('StyleNumber') || '';
                const colorCode = urlParams.get('COLOR') || '';
                const embType = detectEmbellishmentType();
                
                // First try to use the PricingMatrixAPI if available
                if (window.PricingMatrixAPI && typeof window.PricingMatrixAPI.getPrice === 'function') {
                    console.log(`[ADD-TO-CART] Using PricingMatrixAPI to get price`);
                    try {
                        const price = await window.PricingMatrixAPI.getPrice(styleNumber, colorCode, embType, size, quantity);
                        if (price && !isNaN(price) && price > 0) {
                            console.log(`[ADD-TO-CART] PricingMatrixAPI returned price: $${price}`);
                            return price;
                        }
                    } catch (apiError) {
                        console.error(`[ADD-TO-CART] Error using PricingMatrixAPI:`, apiError);
                    }
                }
                
                // Next try to use the PricingMatrix if available
                if (window.PricingMatrix && typeof window.PricingMatrix.getPrice === 'function') {
                    console.log(`[ADD-TO-CART] Using PricingMatrix to get price`);
                    try {
                        const price = await window.PricingMatrix.getPrice(styleNumber, colorCode, embType, size, quantity);
                        if (price && !isNaN(price) && price > 0) {
                            console.log(`[ADD-TO-CART] PricingMatrix returned price: $${price}`);
                            return price;
                        }
                    } catch (matrixError) {
                        console.error(`[ADD-TO-CART] Error using PricingMatrix:`, matrixError);
                    }
                }
                
                // Try to get price from the pricing matrix table in the DOM
                const priceTable = document.querySelector('.matrix-price-table');
                if (priceTable) {
                    // Find the row for the quantity tier
                    let quantityTier = '1-23'; // Default to lowest tier
                    
                    // Find the appropriate quantity tier
                    if (quantity >= 72) {
                        quantityTier = '72+';
                    } else if (quantity >= 48) {
                        quantityTier = '48-71';
                    } else if (quantity >= 24) {
                        quantityTier = '24-47';
                    }
                    
                    // Find the row with this quantity tier
                    const rows = priceTable.querySelectorAll('tr');
                    let priceCell = null;
                    
                    for (const row of rows) {
                        const firstCell = row.querySelector('td:first-child');
                        if (firstCell && firstCell.textContent.includes(quantityTier)) {
                            // Find the column for this size
                            let columnIndex = 0;
                            
                            // Map size to column header
                            let sizeHeader = size;
                            if (['S', 'M', 'L', 'XL'].includes(size)) {
                                sizeHeader = 'XS-XL';
                            } else if (size === '2XL' || size === 'XXL') {
                                sizeHeader = '2XL';
                            } else if (size === '3XL') {
                                sizeHeader = '3XL';
                            } else if (size === '4XL') {
                                sizeHeader = '4XL';
                            }
                            
                            // Find the column index for this size
                            const headers = priceTable.querySelectorAll('th');
                            for (let i = 0; i < headers.length; i++) {
                                if (headers[i].textContent.trim() === sizeHeader) {
                                    columnIndex = i;
                                    break;
                                }
                            }
                            
                            // Get the price cell
                            priceCell = row.querySelector(`td:nth-child(${columnIndex + 1})`);
                            break;
                        }
                    }
                    
                    if (priceCell) {
                        // Extract the price (remove $ and any other non-numeric characters)
                        const priceText = priceCell.textContent.trim();
                        const price = parseFloat(priceText.replace(/[^0-9.]/g, ''));
                        
                        if (!isNaN(price) && price > 0) {
                            console.log(`[ADD-TO-CART] Found price in DOM table for ${size}, quantity ${quantity}: $${price}`);
                            return price;
                        }
                    }
                }
                
                // Fallback pricing if we couldn't find the price in the table
                console.log(`[ADD-TO-CART] Using fallback pricing for ${size}, quantity ${quantity}`);
                
                // Base price by size
                let basePrice = 18.00; // Default for S-XL
                const upperSize = size.toUpperCase();
                
                if (upperSize === '2XL' || upperSize === 'XXL') {
                    basePrice = 22.00;
                } else if (upperSize === '3XL') {
                    basePrice = 23.00;
                } else if (upperSize === '4XL') {
                    basePrice = 25.00;
                }
                
                // Apply quantity discount
                if (quantity >= 72) {
                    basePrice -= 2.00;
                } else if (quantity >= 48) {
                    basePrice -= 1.00;
                }
                
                // Add embellishment cost based on type
                let embCost = 0;
                
                if (embType === 'embroidery' || embType === 'cap-embroidery') {
                    embCost = 3.50;
                } else if (embType === 'dtg' || embType === 'dtf') {
                    embCost = 4.00;
                } else if (embType === 'screen-print') {
                    embCost = 2.50;
                }
                
                const finalPrice = basePrice + embCost;
                console.log(`[ADD-TO-CART] Calculated fallback price: $${finalPrice.toFixed(2)}`);
                
                return parseFloat(finalPrice.toFixed(2));
            } catch (error) {
                console.error('[ADD-TO-CART] Error calculating price:', error);
                // Return a default price if all else fails
                return 25.00;
            }
        }
        
        // Helper function to add a single size input
        function addSizeInput(container, size) {
            const sizeGroup = document.createElement('div');
            sizeGroup.className = 'size-input-group';
            sizeGroup.style.display = 'flex';
            sizeGroup.style.flexDirection = 'column';
            sizeGroup.style.alignItems = 'center';
            sizeGroup.style.padding = '10px';
            sizeGroup.style.border = '1px solid #d0e5ff';
            sizeGroup.style.borderRadius = '6px';
            sizeGroup.style.backgroundColor = '#f9f9f9';
            sizeGroup.style.boxShadow = '0 2px 4px rgba(0,0,0,0.05)';
            sizeGroup.style.transition = 'all 0.2s ease';
            
            // Add hover effect
            sizeGroup.addEventListener('mouseenter', function() {
                this.style.backgroundColor = '#f0f8ff';
                this.style.borderColor = '#90c3ff';
            });
            
            sizeGroup.addEventListener('mouseleave', function() {
                this.style.backgroundColor = '#f9f9f9';
                this.style.borderColor = '#d0e5ff';
            });
            
            const label = document.createElement('label');
            label.textContent = size;
            label.style.marginBottom = '8px';
            label.style.fontWeight = 'bold';
            label.style.color = '#0056b3';
            
            // Add price display element
            const priceDisplay = document.createElement('div');
            priceDisplay.className = 'size-price-display';
            priceDisplay.dataset.size = size;
            priceDisplay.style.fontSize = '0.9rem';
            priceDisplay.style.color = '#28a745';
            priceDisplay.style.fontWeight = 'bold';
            priceDisplay.style.marginBottom = '5px';
            priceDisplay.style.height = '20px';
            priceDisplay.textContent = 'Calculating...';
            
            const input = document.createElement('input');
            input.type = 'number';
            input.min = '0';
            input.value = '0';
            input.className = 'size-quantity-input';
            input.dataset.size = size;
            input.style.width = '65px';
            input.style.padding = '8px';
            input.style.textAlign = 'center';
            input.style.border = '1px solid #ccc';
            input.style.borderRadius = '4px';
            input.style.fontSize = '1rem';
            
            // Add event listener to update prices when quantity changes
            input.addEventListener('input', function() {
                updateAllPriceDisplays();
                updatePricingSummary();
            });
            
            sizeGroup.appendChild(label);
            sizeGroup.appendChild(priceDisplay);
            sizeGroup.appendChild(input);
            container.appendChild(sizeGroup);
            
            // Initialize price display
            updatePriceDisplay(size);
        }
        
        // Function to get the total quantity for an embellishment type (cart + current form)
        async function getTotalQuantityForEmbellishmentType() {
            const embType = detectEmbellishmentType();
            let totalQuantity = 0;
            
            // Get quantity from cart if NWCACart is available
            if (window.NWCACart && typeof window.NWCACart.getCartItems === 'function') {
                try {
                    const cartItems = window.NWCACart.getCartItems('Active');
                    
                    // Filter items by embellishment type
                    const itemsOfType = cartItems.filter(item => item.ImprintType === embType);
                    
                    // Calculate total quantity from cart
                    itemsOfType.forEach(item => {
                        if (item.sizes && Array.isArray(item.sizes)) {
                            item.sizes.forEach(size => {
                                totalQuantity += parseInt(size.Quantity) || 0;
                            });
                        }
                    });
                    
                    console.log(`[ADD-TO-CART] Cart quantity for ${embType}: ${totalQuantity}`);
                } catch (error) {
                    console.error('[ADD-TO-CART] Error getting cart quantity:', error);
                }
            }
            
            // Add quantity from current form
            const sizeInputs = document.querySelectorAll('.size-quantity-input');
            let formQuantity = 0;
            
            sizeInputs.forEach(input => {
                const quantity = parseInt(input.value) || 0;
                formQuantity += quantity;
            });
            
            console.log(`[ADD-TO-CART] Form quantity for ${embType}: ${formQuantity}`);
            
            // Total = cart quantity + form quantity
            const grandTotal = totalQuantity + formQuantity;
            console.log(`[ADD-TO-CART] Total quantity for ${embType}: ${grandTotal}`);
            
            return grandTotal;
        }
        
        // Function to determine pricing tier based on quantity
        function getPricingTierForQuantity(quantity) {
            if (quantity <= 0) {
                return "N/A";
            } else if (quantity >= 1 && quantity <= 23) {
                return "1-23";
            } else if (quantity >= 24 && quantity <= 47) {
                return "24-47";
            } else if (quantity >= 48 && quantity <= 71) {
                return "48-71";
            } else if (quantity >= 72) {
                return "72+";
            } else {
                return "Unknown";
            }
        }
        
        // Function to calculate LTM fee per item
        function calculateLTMFeePerItem(totalQuantity) {
            const LTM_FEE = 50.00; // Less Than Minimum fee
            const LTM_THRESHOLD = 24; // Threshold for LTM fee
            
            if (totalQuantity < LTM_THRESHOLD && totalQuantity > 0) {
                // Calculate the per-item LTM fee
                const ltmFeePerItem = LTM_FEE / totalQuantity;
                return ltmFeePerItem;
            }
            return 0; // No LTM fee for quantities >= LTM_THRESHOLD
        }
        
        // Function to update price display for a specific size
        async function updatePriceDisplay(size) {
            const priceDisplay = document.querySelector(`.size-price-display[data-size="${size}"]`);
            if (!priceDisplay) return;
            
            try {
                // Get total quantity
                const totalQuantity = await getTotalQuantityForEmbellishmentType();
                
                // Get base price for this size and quantity
                const basePrice = await getPrice(size, totalQuantity);
                
                // Calculate LTM fee if applicable
                const ltmFeePerItem = calculateLTMFeePerItem(totalQuantity);
                const finalPrice = basePrice + ltmFeePerItem;
                
                // Get pricing tier
                const pricingTier = getPricingTierForQuantity(totalQuantity);
                
                // Format the price display
                if (ltmFeePerItem > 0) {
                    priceDisplay.innerHTML = `$${finalPrice.toFixed(2)} <span style="font-size: 0.8em; color: #dc3545;">(${pricingTier} + LTM)</span>`;
                    priceDisplay.title = `Base price: $${basePrice.toFixed(2)} + LTM fee: $${ltmFeePerItem.toFixed(2)}`;
                } else {
                    priceDisplay.innerHTML = `$${finalPrice.toFixed(2)} <span style="font-size: 0.8em; color: #6c757d;">(${pricingTier})</span>`;
                    priceDisplay.title = `Price tier: ${pricingTier}`;
                }
                
                // Update color based on tier
                if (pricingTier === "72+") {
                    priceDisplay.style.color = "#28a745"; // Green for best price
                } else if (pricingTier === "48-71") {
                    priceDisplay.style.color = "#17a2b8"; // Teal for good price
                } else if (pricingTier === "24-47") {
                    priceDisplay.style.color = "#007bff"; // Blue for better price
                } else {
                    priceDisplay.style.color = "#6c757d"; // Gray for base price
                }
            } catch (error) {
                console.error(`[ADD-TO-CART] Error updating price display for ${size}:`, error);
                priceDisplay.textContent = "Price unavailable";
                priceDisplay.style.color = "#dc3545"; // Red for error
            }
        }
        
        // Function to update all price displays
        async function updateAllPriceDisplays() {
            const priceDisplays = document.querySelectorAll('.size-price-display');
            
            for (const display of priceDisplays) {
                const size = display.dataset.size;
                await updatePriceDisplay(size);
            }
        }
        
        container.appendChild(sizeInputs);
        
        // Add the Add to Cart button
        const button = document.createElement('button');
        button.id = 'add-to-cart-button';
        button.textContent = 'Add to Cart';
        button.style.backgroundColor = '#0056b3';
        button.style.color = 'white';
        button.style.border = 'none';
        button.style.borderRadius = '4px';
        button.style.padding = '12px 25px';
        button.style.cursor = 'pointer';
        button.style.fontWeight = 'bold';
        button.style.display = 'block';
        button.style.margin = '20px auto 0';
        button.style.fontSize = '1.1rem';
        button.style.boxShadow = '0 2px 4px rgba(0,0,0,0.2)';
        button.style.transition = 'all 0.2s ease';
        
        // Add hover effect
        button.addEventListener('mouseenter', function() {
            this.style.backgroundColor = '#003d80';
            this.style.transform = 'translateY(-2px)';
            this.style.boxShadow = '0 4px 8px rgba(0,0,0,0.2)';
        });
        
        button.addEventListener('mouseleave', function() {
            this.style.backgroundColor = '#0056b3';
            this.style.transform = 'translateY(0)';
            this.style.boxShadow = '0 2px 4px rgba(0,0,0,0.2)';
        });
        
        // Add click event
        button.addEventListener('click', async function() {
            // Show loading state
            const originalText = this.textContent;
            this.disabled = true;
            this.textContent = 'Adding...';
            
            // Add loading spinner
            const spinner = document.createElement('span');
            spinner.className = 'loading-spinner';
            spinner.style.display = 'inline-block';
            spinner.style.width = '16px';
            spinner.style.height = '16px';
            spinner.style.border = '3px solid rgba(255,255,255,0.3)';
            spinner.style.borderRadius = '50%';
            spinner.style.borderTopColor = '#fff';
            spinner.style.animation = 'spin 1s linear infinite';
            spinner.style.marginLeft = '10px';
            spinner.style.verticalAlign = 'middle';
            this.appendChild(spinner);
            
            // Add animation keyframes if not already added
            if (!document.getElementById('spinner-keyframes')) {
                const keyframes = document.createElement('style');
                keyframes.id = 'spinner-keyframes';
                keyframes.textContent = `
                    @keyframes spin {
                        to { transform: rotate(360deg); }
                    }
                `;
                document.head.appendChild(keyframes);
            }
            
            try {
                // Collect product data
                const productData = {
                    styleNumber: styleNumber,
                    color: colorCode,
                    embellishmentType: detectEmbellishmentType(),
                    imageUrl: productImageSrc,
                    sizes: []
                };
                
                // Get embellishment options
                const embOptions = {};
                
                // Get options based on embellishment type
                if (productData.embellishmentType === 'embroidery' || productData.embellishmentType === 'cap-embroidery') {
                    const stitchCount = document.getElementById('stitch-count');
                    if (stitchCount) {
                        embOptions.stitchCount = parseInt(stitchCount.value) || 8000;
                    }
                    
                    const location = document.getElementById('location');
                    if (location) {
                        embOptions.location = location.value || (productData.embellishmentType === 'embroidery' ? 'left-chest' : 'front');
                    }
                } else if (productData.embellishmentType === 'dtg' || productData.embellishmentType === 'dtf') {
                    const location = document.getElementById('location');
                    if (location) {
                        embOptions.location = location.value || 'FF';
                    }
                    
                    const colorType = document.getElementById('color-type');
                    if (colorType) {
                        embOptions.colorType = colorType.value || 'full-color';
                    }
                } else if (productData.embellishmentType === 'screen-print') {
                    const colorCount = document.getElementById('color-count');
                    if (colorCount) {
                        embOptions.colorCount = parseInt(colorCount.value) || 1;
                    }
                    
                    const location = document.getElementById('location');
                    if (location) {
                        embOptions.location = location.value || 'front';
                    }
                    
                    const whiteBase = document.getElementById('white-base');
                    if (whiteBase) {
                        embOptions.requiresWhiteBase = whiteBase.checked;
                    }
                    
                    const specialInk = document.getElementById('special-ink');
                    if (specialInk) {
                        embOptions.specialInk = specialInk.checked;
                    }
                }
                
                productData.embellishmentOptions = embOptions;
                
                // Get sizes and quantities - need to handle async getPrice
                const sizeInputs = document.querySelectorAll('.size-quantity-input');
                let hasSizes = false;
                
                // Process each size input with quantity > 0
                const sizePromises = [];
                
                sizeInputs.forEach(input => {
                    const size = input.dataset.size;
                    const quantity = parseInt(input.value) || 0;
                    
                    if (quantity > 0) {
                        hasSizes = true;
                        // Create a promise for getting the price
                        const sizePromise = getPrice(size, quantity).then(price => {
                            return {
                                size: size,
                                quantity: quantity,
                                unitPrice: price
                            };
                        });
                        
                        sizePromises.push(sizePromise);
                    }
                });
                
                // Wait for all price promises to resolve
                productData.sizes = await Promise.all(sizePromises);
                
                // Calculate total quantity for this embellishment type
                const totalQuantity = productData.sizes.reduce((sum, size) => sum + size.quantity, 0);
                console.log(`[ADD-TO-CART] Total quantity for ${productData.embellishmentType}: ${totalQuantity}`);
                
                if (!hasSizes) {
                    throw new Error('Please select at least one size and quantity');
                }
                
                console.log("[ADD-TO-CART] Adding to cart with data:", productData);
                
                // Check if NWCACart is available
                if (!window.NWCACart || typeof window.NWCACart.addToCart !== 'function') {
                    throw new Error('Cart system not available. Please refresh the page and try again.');
                }
                
                // Add to cart
                const result = await window.NWCACart.addToCart(productData);
                
                if (result.success) {
                    // Show success message
                    console.log("[ADD-TO-CART] Item added to cart successfully");
                    
                    // Change button text to show success
                    this.disabled = false;
                    this.textContent = 'Added! ✓';
                    
                    // Remove spinner if it exists
                    const spinnerElement = this.querySelector('.loading-spinner');
                    if (spinnerElement) {
                        spinnerElement.remove();
                    }
                    
                    // Reset button text after a delay
                    setTimeout(() => {
                        this.textContent = originalText;
                    }, 1500);
                    
                    // Show success message
                    const successMsg = document.createElement('div');
                    successMsg.style.backgroundColor = '#d4edda';
                    successMsg.style.color = '#155724';
                    successMsg.style.padding = '10px';
                    successMsg.style.marginTop = '10px';
                    successMsg.style.borderRadius = '4px';
                    successMsg.style.textAlign = 'center';
                    successMsg.innerHTML = 'Item added to cart successfully! <a href="/cart.html" style="color: #155724; text-decoration: underline; font-weight: bold;">View Cart</a>';
                    
                    // Add success message after the button
                    this.parentNode.appendChild(successMsg);
                    
                    // Remove success message after a delay
                    setTimeout(() => {
                        if (successMsg.parentNode) {
                            successMsg.parentNode.removeChild(successMsg);
                        }
                    }, 5000);
                } else {
                    // Show error message
                    throw new Error(result.error || 'Failed to add item to cart');
                }
            } catch (error) {
                console.error("[ADD-TO-CART] Error adding to cart:", error);
                
                // Reset button state
                this.disabled = false;
                this.textContent = originalText;
                
                // Remove spinner if it exists
                const spinnerElement = this.querySelector('.loading-spinner');
                if (spinnerElement) {
                    spinnerElement.remove();
                }
                
                // Show error message
                const errorMsg = document.createElement('div');
                errorMsg.style.backgroundColor = '#f8d7da';
                errorMsg.style.color = '#721c24';
                errorMsg.style.padding = '10px';
                errorMsg.style.marginTop = '10px';
                errorMsg.style.borderRadius = '4px';
                errorMsg.style.textAlign = 'center';
                errorMsg.textContent = error.message || 'An error occurred while adding to cart';
                
                // Add error message after the button
                this.parentNode.appendChild(errorMsg);
                
                // Remove error message after a delay
                setTimeout(() => {
                    if (errorMsg.parentNode) {
                        errorMsg.parentNode.removeChild(errorMsg);
                    }
                }, 5000);
            }
        });
        
        container.appendChild(button);
        
        // Add the container to the page
        noteElement.appendChild(container);
        console.log("[ADD-TO-CART] Cart button added manually");
    }
    
    // Function to ensure cart button is visible
    function ensureCartButtonVisible() {
        console.log("[ADD-TO-CART] Checking for cart button container");
        const cartButtonContainer = document.getElementById('cart-button-container');
        
        if (cartButtonContainer) {
            console.log("[ADD-TO-CART] Found cart button container, ensuring visibility");
            cartButtonContainer.style.display = 'block';
            cartButtonContainer.style.visibility = 'visible';
            cartButtonContainer.style.opacity = '1';
            
            // Also ensure the Add to Cart button is visible
            const addToCartButton = document.getElementById('add-to-cart-button');
            if (addToCartButton) {
                addToCartButton.style.display = 'block';
                addToCartButton.style.visibility = 'visible';
                addToCartButton.style.opacity = '1';
                console.log("[ADD-TO-CART] Ensured Add to Cart button visibility");
            } else {
                console.log("[ADD-TO-CART] Add to Cart button not found");
            }
        } else {
            console.log("[ADD-TO-CART] Cart button container not found");
        }
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeCartIntegration);
    } else {
        // DOM already loaded, initialize immediately
        initializeCartIntegration();
    }

    // Also initialize when Caspio content is loaded
    // This is a backup in case the DOM ready event fires before Caspio content is loaded
    const observer = new MutationObserver(function(mutations) {
        // Check if Caspio content has been loaded
        const caspioContentLoaded = document.querySelector('.matrix-price-table') ||
                                   document.querySelector('.cbResultSetTable') ||
                                   document.querySelector('#matrix-price-body') ||
                                   document.querySelector('.cbResultSet');
        
        if (caspioContentLoaded) {
            console.log("[ADD-TO-CART] Caspio content detected, initializing cart integration");
            
            // If a Caspio table was loaded but doesn't have the matrix-price-table class, add it
            const caspioTable = document.querySelector('.cbResultSetTable');
            if (caspioTable && !document.querySelector('.matrix-price-table')) {
                caspioTable.classList.add('matrix-price-table');
                console.log("[ADD-TO-CART] Added matrix-price-table class to Caspio table");
            }
            
            initializeCartIntegration();
            observer.disconnect();
        }
    });

    // Start observing the document
    observer.observe(document.body, { childList: true, subtree: true });

    // Also try after a fixed delay as a fallback
    setTimeout(initializeCartIntegration, 3000);
    
    // Set up periodic checks to ensure cart button is visible
    const visibilityCheckIntervals = [1000, 2000, 3000, 5000, 8000];
    visibilityCheckIntervals.forEach(interval => {
        setTimeout(ensureCartButtonVisible, interval);
    });
    
    // Try to add the cart button manually if it's not added after a delay
    setTimeout(() => {
        if (!document.getElementById('cart-button-container')) {
            console.log("[ADD-TO-CART] Cart button container not found after delay, adding manually");
            addCartButtonManually();
        }
    }, 6000);

})();