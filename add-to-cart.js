// Add to Cart functionality for embroidery pricing pages
(function() {
    "use strict";

    console.log("[ADD-TO-CART] Initializing add to cart functionality");

    // Function to initialize the Add to Cart section
    function initAddToCart() {
        // Mark that add-to-cart has initialized
        window.addToCartInitialized = true;
        
        // Get the container for size quantity inputs
        const sizeQuantityGrid = document.querySelector('.size-quantity-grid');
        if (!sizeQuantityGrid) return;
        
        // Check if DIRECT-FIX has already populated the grid
        if (window.directFixApplied) {
            console.log("[ADD-TO-CART] Size quantity grid already populated by DIRECT-FIX, skipping creation");
            
            // Just attach event listeners to existing inputs
            const existingInputs = sizeQuantityGrid.querySelectorAll('.quantity-input');
            existingInputs.forEach(input => {
                input.removeEventListener('change', window.updateCartTotal); // Remove any existing listeners
                input.addEventListener('change', updateCartTotal); // Add our listener
            });
        } else {
            console.log("[ADD-TO-CART] Initializing size quantity grid");
            
            // Clear existing content
            sizeQuantityGrid.innerHTML = '';
            
            // Get available sizes from pricing data
            const sizes = window.dp5UniqueSizes || [];
            if (!sizes.length) return;
            
            // Create input rows for each size
            sizes.forEach(size => {
                const row = document.createElement('div');
                row.className = 'size-quantity-row';
                
                // Size label
                const sizeLabel = document.createElement('div');
                sizeLabel.className = 'size-label';
                sizeLabel.textContent = size;
                
                // Quantity input with +/- buttons
                const inputContainer = document.createElement('div');
                inputContainer.className = 'quantity-input-container';
                
                const decreaseBtn = document.createElement('button');
                decreaseBtn.className = 'quantity-btn decrease';
                decreaseBtn.textContent = '-';
                decreaseBtn.addEventListener('click', () => {
                    const input = inputContainer.querySelector('input');
                    const currentValue = parseInt(input.value) || 0;
                    if (currentValue > 0) {
                        input.value = currentValue - 1;
                        input.dispatchEvent(new Event('change'));
                    }
                });
                
                const input = document.createElement('input');
                input.type = 'number';
                input.className = 'quantity-input';
                input.dataset.size = size;
                input.min = '0';
                input.value = '0';
                input.addEventListener('change', updateCartTotal);
                
                const increaseBtn = document.createElement('button');
                increaseBtn.className = 'quantity-btn increase';
                increaseBtn.textContent = '+';
                increaseBtn.addEventListener('click', () => {
                    const input = inputContainer.querySelector('input');
                    const currentValue = parseInt(input.value) || 0;
                    input.value = currentValue + 1;
                    input.dispatchEvent(new Event('change'));
                });
                
                inputContainer.appendChild(decreaseBtn);
                inputContainer.appendChild(input);
                inputContainer.appendChild(increaseBtn);
                
                // Price display for this size
                const priceDisplay = document.createElement('div');
                priceDisplay.className = 'size-price';
                priceDisplay.dataset.size = size;
                priceDisplay.textContent = '$0.00';
                
                // Add elements to row
                row.appendChild(sizeLabel);
                row.appendChild(inputContainer);
                row.appendChild(priceDisplay);
                
                // Add row to grid
                sizeQuantityGrid.appendChild(row);
            });
        }
        
        // Initialize Add to Cart button
        const addToCartButton = document.getElementById('add-to-cart-button');
        if (addToCartButton) {
            // Remove any existing click listeners
            const newButton = addToCartButton.cloneNode(true);
            addToCartButton.parentNode.replaceChild(newButton, addToCartButton);
            newButton.addEventListener('click', handleAddToCart);
        }
        
        // Initial update of cart total
        updateCartTotal();
    }

    // Function to update cart total when quantities change
    function updateCartTotal() {
        console.log("[ADD-TO-CART] Updating cart total");
        
        // Make this function available globally
        window.updateCartTotal = updateCartTotal;
        
        // Get all quantity inputs
        const quantityInputs = document.querySelectorAll('.quantity-input');
        let totalQuantity = 0;
        let totalPrice = 0;
        
        // Calculate total quantity
        quantityInputs.forEach(input => {
            const quantity = parseInt(input.value) || 0;
            totalQuantity += quantity;
        });
        
        console.log("[ADD-TO-CART] Total quantity:", totalQuantity);
        
        // Determine pricing tier based on total quantity
        let tierKey = '';
        if (totalQuantity >= 72) {
            tierKey = '72+';
        } else if (totalQuantity >= 48) {
            tierKey = '48-71';
        } else if (totalQuantity >= 24) {
            tierKey = '24-47';
        } else if (totalQuantity >= 12) {
            tierKey = '12-23';
        } else if (totalQuantity > 0) {
            tierKey = '1-11';
        }
        
        console.log("[ADD-TO-CART] Using tier key:", tierKey);
        
        // Check if LTM fee applies
        const ltmFeeNotice = document.querySelector('.ltm-fee-notice');
        let ltmFeeApplies = false;
        let ltmFee = 0;
        
        if (totalQuantity > 0 && totalQuantity < 24 && window.dp5ApiTierData) {
            const tierData = window.dp5ApiTierData[tierKey];
            if (tierData && tierData.LTM_Fee) {
                ltmFeeApplies = true;
                ltmFee = tierData.LTM_Fee;
                console.log("[ADD-TO-CART] LTM fee applies:", ltmFee);
            }
        }
        
        if (ltmFeeNotice) {
            ltmFeeNotice.style.display = ltmFeeApplies ? 'block' : 'none';
        }
        
        // Important: Always recalculate prices based on the current tier
        // This ensures prices update correctly when quantity changes
        if (window.dp5GroupedPrices && tierKey) {
            console.log("[ADD-TO-CART] Recalculating all prices based on tier:", tierKey);
            
            // Calculate price for each size and update displays
            quantityInputs.forEach(input => {
                const size = input.dataset.size;
                const quantity = parseInt(input.value) || 0;
                const priceDisplay = document.querySelector(`.size-price[data-size="${size}"]`);
                
                if (priceDisplay) {
                    if (quantity > 0 && window.dp5GroupedPrices[size] && window.dp5GroupedPrices[size][tierKey] !== undefined) {
                        const unitPrice = window.dp5GroupedPrices[size][tierKey];
                        const itemTotal = quantity * unitPrice;
                        totalPrice += itemTotal;
                        
                        console.log(`[ADD-TO-CART] Size ${size}: ${quantity} x $${unitPrice} = $${itemTotal.toFixed(2)}`);
                        priceDisplay.textContent = `$${itemTotal.toFixed(2)}`;
                        
                        // Add data attributes for debugging
                        priceDisplay.dataset.quantity = quantity;
                        priceDisplay.dataset.unitPrice = unitPrice;
                        priceDisplay.dataset.tier = tierKey;
                    } else {
                        priceDisplay.textContent = '$0.00';
                        
                        // Clear data attributes
                        priceDisplay.dataset.quantity = '0';
                        priceDisplay.dataset.unitPrice = '0';
                        priceDisplay.dataset.tier = '';
                    }
                }
            });
        } else {
            console.warn("[ADD-TO-CART] Missing pricing data or invalid tier key");
        }
        
        // Add LTM fee if applicable
        if (ltmFeeApplies) {
            totalPrice += ltmFee;
            console.log("[ADD-TO-CART] Added LTM fee:", ltmFee);
        }
        
        // Update total display
        const totalAmountDisplay = document.querySelector('.total-amount');
        if (totalAmountDisplay) {
            totalAmountDisplay.textContent = `$${totalPrice.toFixed(2)}`;
            console.log("[ADD-TO-CART] Updated total amount:", totalPrice.toFixed(2));
            
            // Add data attribute for debugging
            totalAmountDisplay.dataset.calculatedTotal = totalPrice.toFixed(2);
        }
    }

    // Function to handle Add to Cart button click
    function handleAddToCart() {
        // Get all quantity inputs
        const quantityInputs = document.querySelectorAll('.quantity-input');
        const sizes = [];
        let totalQuantity = 0;
        
        // Collect size and quantity data
        quantityInputs.forEach(input => {
            const size = input.dataset.size;
            const quantity = parseInt(input.value) || 0;
            
            if (quantity > 0) {
                sizes.push({
                    size: size,
                    quantity: quantity
                });
                totalQuantity += quantity;
            }
        });
        
        // Check if any sizes were selected
        if (sizes.length === 0) {
            alert('Please select at least one size and quantity.');
            return;
        }
        
        // Get product info
        const styleNumber = getUrlParameter('StyleNumber');
        const colorCode = getUrlParameter('COLOR');
        const embType = detectEmbellishmentType();
        
        // Create product data object
        const productData = {
            styleNumber: styleNumber,
            color: colorCode,
            embellishmentType: embType,
            sizes: sizes
        };
        
        // Add to cart using NWCACart if available
        if (window.NWCACart && typeof window.NWCACart.addToCart === 'function') {
            // Show loading state on button
            const addToCartButton = document.getElementById('add-to-cart-button');
            const originalText = addToCartButton.textContent;
            addToCartButton.textContent = 'Adding...';
            addToCartButton.disabled = true;
            
            window.NWCACart.addToCart(productData)
                .then(result => {
                    if (result.success) {
                        // Show success message
                        addToCartButton.textContent = 'Added Successfully!';
                        setTimeout(() => {
                            addToCartButton.textContent = originalText;
                            addToCartButton.disabled = false;
                        }, 2000);
                        
                        // Reset quantity inputs
                        quantityInputs.forEach(input => {
                            input.value = '0';
                        });
                        
                        // Update cart total
                        updateCartTotal();
                    } else {
                        // Show error
                        addToCartButton.textContent = originalText;
                        addToCartButton.disabled = false;
                        alert('Error adding to cart: ' + (result.error || 'Unknown error'));
                    }
                })
                .catch(error => {
                    // Show error
                    addToCartButton.textContent = originalText;
                    addToCartButton.disabled = false;
                    alert('Error adding to cart: ' + error.message);
                });
        } else {
            alert('Cart system not available. Please try again later.');
        }
    }

    // Helper function to get URL parameter
    function getUrlParameter(name) {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get(name);
    }
    
    // Helper function to detect embellishment type
    function detectEmbellishmentType() {
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

    // Initialize when DOM is ready
    function initialize() {
        console.log("[ADD-TO-CART] DOM ready, initializing");
        
        // Initialize Add to Cart section
        initAddToCart();
        
        // Listen for pricing data loaded event
        window.addEventListener('pricingDataLoaded', function(event) {
            console.log("[ADD-TO-CART] Pricing data loaded event received, updating Add to Cart section");
            
            // Wait a short time to ensure other scripts have processed the event
            setTimeout(() => {
                initAddToCart();
            }, 100);
        });
        
        // Apply mobile adjustments
        handleMobileAdjustments();
        window.addEventListener('resize', handleMobileAdjustments);
        
        // Make updateCartTotal available globally
        window.updateCartTotal = updateCartTotal;
    }
    
    // Function to handle mobile-specific adjustments
    function handleMobileAdjustments() {
        const isMobile = window.innerWidth <= 768;
        const isSmallMobile = window.innerWidth <= 480;
        
        // Adjust Add to Cart section for mobile
        const sizeQuantityGrid = document.querySelector('.size-quantity-grid');
        if (sizeQuantityGrid) {
            if (isSmallMobile) {
                sizeQuantityGrid.style.display = 'flex';
                sizeQuantityGrid.style.flexDirection = 'column';
                sizeQuantityGrid.style.gap = '10px';
            } else if (isMobile) {
                sizeQuantityGrid.style.display = 'grid';
                sizeQuantityGrid.style.gridTemplateColumns = 'repeat(2, 1fr)';
                sizeQuantityGrid.style.gap = '15px';
            } else {
                sizeQuantityGrid.style.display = 'grid';
                sizeQuantityGrid.style.gridTemplateColumns = 'repeat(auto-fill, minmax(250px, 1fr))';
                sizeQuantityGrid.style.gap = '15px';
            }
        }
        
        // Adjust size quantity rows for mobile
        const sizeQuantityRows = document.querySelectorAll('.size-quantity-row');
        sizeQuantityRows.forEach(row => {
            if (isSmallMobile) {
                row.style.padding = '8px';
            } else {
                row.style.padding = '10px';
            }
        });
        
        // Adjust quantity buttons for mobile
        const quantityBtns = document.querySelectorAll('.quantity-btn');
        quantityBtns.forEach(btn => {
            if (isSmallMobile) {
                btn.style.width = '25px';
                btn.style.height = '25px';
            } else {
                btn.style.width = '30px';
                btn.style.height = '30px';
            }
        });
        
        // Adjust quantity inputs for mobile
        const quantityInputs = document.querySelectorAll('.quantity-input');
        quantityInputs.forEach(input => {
            if (isSmallMobile) {
                input.style.width = '40px';
                input.style.height = '25px';
                input.style.fontSize = '0.9em';
            } else {
                input.style.width = '50px';
                input.style.height = '30px';
                input.style.fontSize = '1em';
            }
        });
        
        // Adjust cart summary for mobile
        const cartSummary = document.querySelector('.cart-summary');
        if (cartSummary) {
            if (isMobile) {
                cartSummary.style.padding = '15px';
            } else {
                cartSummary.style.padding = '20px';
            }
        }
        
        // Adjust add to cart button for mobile
        const addToCartButton = document.getElementById('add-to-cart-button');
        if (addToCartButton) {
            if (isSmallMobile) {
                addToCartButton.style.padding = '8px 16px';
                addToCartButton.style.fontSize = '1em';
            } else {
                addToCartButton.style.padding = '12px 24px';
                addToCartButton.style.fontSize = '1.1em';
            }
        }
    }

    // Check if DOM is already loaded
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        // DOM already loaded, initialize immediately
        initialize();
    }
})();