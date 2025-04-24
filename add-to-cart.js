// Add to Cart functionality for embroidery pricing pages
(function() {
    "use strict";

    console.log("[ADD-TO-CART] Initializing add to cart functionality");

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
                    padding: 15px !important;
                    background-color: #f8f8f8 !important;
                    border-radius: 5px !important;
                    border: 1px solid #ddd !important;
                    z-index: 1000 !important;
                }
                
                #add-to-cart-button {
                    display: block !important;
                    background-color: #0056b3 !important;
                    color: white !important;
                    border: none !important;
                    border-radius: 4px !important;
                    padding: 10px 20px !important;
                    cursor: pointer !important;
                    font-weight: bold !important;
                    margin-top: 15px !important;
                }
                
                .size-input-grid {
                    display: grid !important;
                    grid-template-columns: repeat(auto-fill, minmax(80px, 1fr)) !important;
                    gap: 10px !important;
                    margin-bottom: 15px !important;
                }
                
                .size-input-group {
                    display: flex !important;
                    flex-direction: column !important;
                    align-items: center !important;
                    padding: 8px !important;
                    border: 1px solid #e0e0e0 !important;
                    border-radius: 4px !important;
                    background-color: #f9f9f9 !important;
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
        container.appendChild(heading);
        
        // Add size inputs section
        const sizeInputs = document.createElement('div');
        sizeInputs.className = 'size-input-grid';
        sizeInputs.style.display = 'grid';
        sizeInputs.style.gridTemplateColumns = 'repeat(auto-fill, minmax(80px, 1fr))';
        sizeInputs.style.gap = '10px';
        sizeInputs.style.marginBottom = '15px';
        
        // Get the product info from URL
        const urlParams = new URLSearchParams(window.location.search);
        const styleNumber = urlParams.get('StyleNumber');
        const colorCode = urlParams.get('COLOR');
        
        // Create a loading message
        const loadingMsg = document.createElement('div');
        loadingMsg.textContent = 'Loading available sizes...';
        loadingMsg.style.fontStyle = 'italic';
        loadingMsg.style.color = '#666';
        loadingMsg.style.width = '100%';
        sizeInputs.appendChild(loadingMsg);
        
        // Always try to fetch inventory data, even if we need to retry
        if (styleNumber && colorCode) {
            console.log("[ADD-TO-CART] Fetching inventory sizes for", styleNumber, colorCode);
            
            // Function to fetch inventory with retries
            const fetchInventoryWithRetry = (retryCount = 0, maxRetries = 3) => {
                fetch(`${window.location.origin}/api/inventory?styleNumber=${encodeURIComponent(styleNumber)}&color=${encodeURIComponent(colorCode)}`)
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
                            // Extract unique sizes and sort them
                            const sizeSet = new Set();
                            data.forEach(item => {
                                if (item.size) {
                                    sizeSet.add(item.size);
                                }
                            });
                            sizes = Array.from(sizeSet).sort();
                            console.log("[ADD-TO-CART] Found sizes from inventory:", sizes);
                        }
                        
                        if (sizes.length === 0) {
                            // If no sizes found, try to fetch from a different endpoint
                            console.log("[ADD-TO-CART] No sizes found in inventory, trying alternative endpoint");
                            fetch(`${window.location.origin}/api/sizes?styleNumber=${encodeURIComponent(styleNumber)}`)
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
        
        // Helper function to add a single size input
        function addSizeInput(container, size) {
            const sizeGroup = document.createElement('div');
            sizeGroup.className = 'size-input-group';
            sizeGroup.style.display = 'flex';
            sizeGroup.style.flexDirection = 'column';
            sizeGroup.style.alignItems = 'center';
            sizeGroup.style.padding = '8px';
            sizeGroup.style.border = '1px solid #e0e0e0';
            sizeGroup.style.borderRadius = '4px';
            sizeGroup.style.backgroundColor = '#f9f9f9';
            
            const label = document.createElement('label');
            label.textContent = size;
            label.style.marginBottom = '5px';
            label.style.fontWeight = 'bold';
            
            const input = document.createElement('input');
            input.type = 'number';
            input.min = '0';
            input.value = '0';
            input.className = 'size-quantity-input';
            input.dataset.size = size;
            input.style.width = '60px';
            input.style.padding = '5px';
            input.style.textAlign = 'center';
            
            sizeGroup.appendChild(label);
            sizeGroup.appendChild(input);
            container.appendChild(sizeGroup);
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
        button.style.padding = '10px 20px';
        button.style.cursor = 'pointer';
        button.style.fontWeight = 'bold';
        button.style.display = 'block';
        button.style.marginTop = '15px';
        
        // Add click event
        button.addEventListener('click', function() {
            alert('Add to Cart functionality is being implemented. Please check back soon!');
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