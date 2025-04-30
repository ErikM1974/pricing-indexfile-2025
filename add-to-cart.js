// Add to Cart functionality for embroidery pricing pages
(function() {
    "use strict";

    console.log("[ADD-TO-CART] Initializing add to cart functionality (v3 Refactored)");

    // Function to fetch current cart contents
    async function fetchCartContents() {
        console.log("[ADD-TO-CART] Fetching current cart contents");
        try {
            const cartSystem = window.detectAvailableCartSystem ? window.detectAvailableCartSystem() : null;
            if (!cartSystem) {
                console.warn("[ADD-TO-CART] No cart system available for cart content fetch");
                return { embroideryItems: 0, totalItems: 0, items: [] };
            }
            const cartResult = await cartSystem.api.getCartItems();
            if (!cartResult || !cartResult.success || !Array.isArray(cartResult.items)) {
                console.warn("[ADD-TO-CART] Failed to get cart items or no items returned");
                return { embroideryItems: 0, totalItems: 0, items: [] };
            }

            const currentEmbType = detectEmbellishmentType();
            let embroideryItemCount = 0;
            let totalItemCount = 0;
            cartResult.items.forEach(item => {
                if (Array.isArray(item.sizes)) {
                    const itemQuantity = item.sizes.reduce((sum, size) => sum + (parseInt(size.quantity) || 0), 0);
                    totalItemCount += itemQuantity;
                    if (item.embellishmentType === currentEmbType) {
                        embroideryItemCount += itemQuantity;
                    }
                }
            });
            console.log(`[ADD-TO-CART] Cart contains ${embroideryItemCount} items of type '${currentEmbType}' out of ${totalItemCount} total items`);
            return {
                embroideryItems: embroideryItemCount,
                totalItems: totalItemCount,
                items: cartResult.items
            };
        } catch (error) {
            console.error("[ADD-TO-CART] Error fetching cart contents:", error);
            return { embroideryItems: 0, totalItems: 0, items: [] };
        }
    }

    // Function to initialize the Add to Cart section
    function initAddToCart() {
        if (window.addToCartInitialized) {
            console.log("[ADD-TO-CART] Already initialized, just updating cart total");
            updateCartTotal();
            return;
        }
        window.addToCartInitialized = true;

        const addToCartButton = document.getElementById('add-to-cart-button');
        if (addToCartButton) {
            try {
                const newButton = addToCartButton.cloneNode(true);
                if (addToCartButton.parentNode) {
                    addToCartButton.parentNode.replaceChild(newButton, addToCartButton);
                    newButton.addEventListener('click', handleAddToCart);
                    console.log("[ADD-TO-CART] Add to Cart button listener attached.");
                }
            } catch (error) {
                console.error("[ADD-TO-CART] Error setting up Add to Cart button:", error);
                addToCartButton.addEventListener('click', handleAddToCart);
            }
        } else {
            console.warn("[ADD-TO-CART] Add to Cart button not found.");
        }
        updateCartTotal(); // Initial calculation
    }

    // Flag to prevent recursive updateCartTotal calls
    let updatingCartTotal = false;

    // Function to update cart total when quantities change
    // REFACTORED: Uses NWCAPricingCalculator and PricingPageUI
    function updateCartTotal() {
        if (updatingCartTotal) {
            // console.log("[ADD-TO-CART] Already updating cart total, skipping recursive call");
            return;
        }
        updatingCartTotal = true;

        try {
            console.log("[ADD-TO-CART] Updating cart total (Refactored v4 - Dynamic Pricing)");
            window.updateCartTotal = updateCartTotal; // Ensure global access

            // 1. Gather current quantities from UI inputs
            let quantityInputs = [];
            const sizeQuantities = {}; // { size: quantity } for items being added *now*
            let newQuantityTotal = 0;
            try {
                const useGrid = window.PricingPageUI?.determineLayoutPreference ? window.PricingPageUI.determineLayoutPreference() : false; // Use PricingPageUI version
                const containerSelector = useGrid ? '#size-quantity-grid-container' : '#quantity-matrix';
                const container = document.querySelector(containerSelector);
                if (container) {
                    quantityInputs = container.querySelectorAll('.quantity-input') || [];
                    Array.from(quantityInputs).forEach(input => {
                        if (!input || !input.dataset) return;
                        const size = input.dataset.size;
                        const quantity = parseInt(input.value) || 0;
                        if (size && quantity >= 0) {
                            newQuantityTotal += quantity;
                            sizeQuantities[size] = quantity;
                        }
                    });
                    // console.log(`[ADD-TO-CART] Found ${quantityInputs.length} inputs in ${containerSelector}. New Qty: ${newQuantityTotal}`);
                } else {
                     console.warn(`[ADD-TO-CART] Could not find container ${containerSelector}. Cannot get quantities.`);
                }
            } catch (err) {
                console.error("[ADD-TO-CART] Error getting quantity inputs:", err);
            }

            // 2. Ensure cart contents are loaded (async fetch if needed)
            if (!window.cartContents) {
                console.log("[ADD-TO-CART] Cart contents not available, fetching...");
                updatingCartTotal = false; // Release lock before async call
                fetchCartContents().then(contents => {
                    window.cartContents = contents;
                    updateCartTotal(); // Re-run with fetched contents
                }).catch(error => {
                    console.error("[ADD-TO-CART] Error fetching cart contents:", error);
                    window.cartContents = { embroideryItems: 0, totalItems: 0, items: [] }; // Provide default empty cart
                    updateCartTotal(); // Continue with empty cart contents
                });
                return; // Exit and wait for fetch
            }

            // 3. Get existing cart quantity for the current embellishment type
            // const cartContents = window.cartContents || { embroideryItems: 0, totalItems: 0, items: [] }; // No longer rely on pre-fetched cartContents for count
            const currentEmbType = detectEmbellishmentType();

            // --- FIX: Calculate existing quantity directly from NWCACart ---
            let existingEmbroideryItems = 0;
            if (window.NWCACart && typeof window.NWCACart.getCartItems === 'function') {
                const activeCartItems = window.NWCACart.getCartItems('Active'); // Get current active items
                if (activeCartItems && Array.isArray(activeCartItems)) {
                    activeCartItems.forEach(item => {
                        // Use ImprintType as per cart.js structure
                        if (item.ImprintType === currentEmbType && item.CartStatus === 'Active' && Array.isArray(item.sizes)) {
                            existingEmbroideryItems += item.sizes.reduce((sum, size) => sum + (parseInt(size.Quantity) || 0), 0);
                        }
                    });
                }
                 console.log(`[ADD-TO-CART] Calculated existing ${currentEmbType} items directly from NWCACart: ${existingEmbroideryItems}`); // New log
            } else {
                 console.warn("[ADD-TO-CART] NWCACart.getCartItems not available to calculate existing quantity.");
            }
            // --- END FIX ---


            // 4. Get pricing data (captured by pricing-matrix-capture.js)
            const pricingData = window.nwcaPricingData;
            if (!pricingData) {
                console.error("[ADD-TO-CART] Pricing data (window.nwcaPricingData) not available. Cannot calculate prices.");
                 const totalAmountDisplay = document.querySelector('.total-amount');
                 if(totalAmountDisplay) totalAmountDisplay.textContent = 'Error: Pricing Unavailable';
                updatingCartTotal = false;
                return;
            }

            // 5. Call the Pricing Calculator with PROSPECTIVE calculation
            // This is the key change: we always use the combined quantity to determine pricing tier
            if (!window.NWCAPricingCalculator || typeof window.NWCAPricingCalculator.calculatePricing !== 'function') {
                 console.error("[ADD-TO-CART] NWCAPricingCalculator is not available!");
                 updatingCartTotal = false;
                 return;
            }
            // --- Verification Log ---
            console.log("[ADD-TO-CART] Data for Pricing Calculator:", {
                sizeQuantities: JSON.parse(JSON.stringify(sizeQuantities)), // Log deep copy
                existingCartQuantity: existingEmbroideryItems, // Use the newly calculated value
                pricingDataAvailable: !!pricingData
            });
            // --- End Verification Log ---

            const calculatedPricing = window.NWCAPricingCalculator.calculatePricing(
                sizeQuantities,
                existingEmbroideryItems, // Pass the correctly calculated value
                pricingData
            );

            // --- LTM Discrepancy Investigation Log ---
            // Log the full result immediately after calculation to compare with UI updates
             console.log("[ADD-TO-CART] Full calculatedPricing result:", JSON.parse(JSON.stringify(calculatedPricing || {})));
            // --- End LTM Log ---


            if (!calculatedPricing) {
                console.error("[ADD-TO-CART] Pricing calculation failed.");
                 const totalAmountDisplay = document.querySelector('.total-amount');
                 if(totalAmountDisplay) totalAmountDisplay.textContent = 'Error: Calculation Failed';
                updatingCartTotal = false;
                return;
            }

            // 6. Store the detailed calculation result globally
            window.cartItemData = {
                ...calculatedPricing,
                cartQuantity: existingEmbroideryItems,
                totalQuantity: newQuantityTotal, // Explicitly store quantity being added now
                prospectiveTotal: calculatedPricing.combinedQuantity // Store the prospective total
            };
            console.log("[ADD-TO-CART] Prospective total calculation:", {
                new: newQuantityTotal,
                existing: existingEmbroideryItems,
                combined: calculatedPricing.combinedQuantity,
                tier: calculatedPricing.tierKey,
                ltmApplies: calculatedPricing.ltmFeeApplies
            });


            // 7. Update UI Elements using PricingPageUI module

            // Update LTM fee notice display with prospective calculation info
            const ltmFeeNotice = document.querySelector('.ltm-fee-notice');
            if (ltmFeeNotice) {
                ltmFeeNotice.style.display = calculatedPricing.ltmFeeApplies ? 'block' : 'none';
                if (calculatedPricing.ltmFeeApplies) {
                    const ltmText = ltmFeeNotice.querySelector('.ltm-text');
                    if (ltmText) {
                         const ltmQuantityNeeded = Math.max(0, 24 - calculatedPricing.combinedQuantity);
                         ltmText.innerHTML = `
                            <div style="display:flex;align-items:center;margin-bottom:5px;">
                                <span style="font-size:1.3em;margin-right:8px;">⚠️</span>
                                <span style="font-size:1.1em;font-weight:bold;">Less Than Minimum Fee</span>
                            </div>
                            <div style="margin-bottom:5px;">
                                <div>Total LTM Fee: <span style="color:#663c00;font-weight:bold;font-size:1.1em;">$${calculatedPricing.ltmFeeTotal.toFixed(2)}</span></div>
                                <div>Per Item: <span style="color:#663c00;font-weight:bold;">$${calculatedPricing.ltmFeePerItem.toFixed(2)}</span> × ${calculatedPricing.combinedQuantity} items</div>
                            </div>
                            ${ltmQuantityNeeded > 0 ? `<div style="font-size:0.9em;font-style:italic;margin-top:5px;padding-top:5px;border-top:1px dashed #ffc107;">
                                Add ${ltmQuantityNeeded} more items to reach 24 pieces and eliminate this fee
                            </div>` : ''}
                            ${existingEmbroideryItems > 0 ? `<div style="font-size:0.9em;background-color:#e8f4ff;padding:5px;margin-top:5px;border-radius:4px;border-left:3px solid #0d6efd;">
                                <span style="font-weight:bold;">Prospective Pricing:</span> Includes ${existingEmbroideryItems} items already in cart.
                            </div>` : ''}
                        `;
                    }
                    // Apply notice styling
                    ltmFeeNotice.style.backgroundColor = '#fff3cd';
                    ltmFeeNotice.style.border = '1px solid #ffeeba';
                    ltmFeeNotice.style.padding = '12px';
                    ltmFeeNotice.style.borderRadius = '6px';
                    ltmFeeNotice.style.marginBottom = '15px';
                    ltmFeeNotice.style.boxShadow = '0 2px 4px rgba(0,0,0,0.05)';
                }
            }

            // Update Tier progress and Cart info summary using PricingPageUI
            if (window.PricingPageUI) {
                window.PricingPageUI.updateTierInfoDisplay(calculatedPricing.tierKey, calculatedPricing.nextTier, calculatedPricing.quantityForNextTier, calculatedPricing.combinedQuantity);
                window.PricingPageUI.updateCartInfoDisplay(newQuantityTotal, calculatedPricing.combinedQuantity, calculatedPricing.tierKey);
            } else {
                console.error("[ADD-TO-CART] PricingPageUI not available for UI updates.");
            }

            // Update individual price displays for each size input field using PricingPageUI
            const allAvailableSizes = Object.keys(calculatedPricing.baseUnitPrices || {});
            allAvailableSizes.forEach(size => {
                const quantity = sizeQuantities[size] || 0;
                const itemData = calculatedPricing.items[size];
                const baseUnitPrice = calculatedPricing.baseUnitPrices[size] || 0;

                if (window.PricingPageUI && typeof window.PricingPageUI.updatePriceDisplayForSize === 'function') {
                    window.PricingPageUI.updatePriceDisplayForSize(
                        size, quantity, baseUnitPrice,
                        itemData ? itemData.displayUnitPrice : baseUnitPrice,
                        itemData ? itemData.itemTotal : 0,
                        calculatedPricing.ltmFeeApplies, calculatedPricing.ltmFeePerItem,
                        calculatedPricing.combinedQuantity, calculatedPricing.ltmFeeTotal
                    );
                } else {
                     console.error(`[ADD-TO-CART] PricingPageUI.updatePriceDisplayForSize not available for size ${size}.`);
                }
            });


            // Update final total display in the cart summary with enhanced prospective pricing info
            const totalAmountDisplay = document.querySelector('.total-amount');
            if (totalAmountDisplay) {
                 if (calculatedPricing.ltmFeeApplies && newQuantityTotal > 0) {
                     let baseTotalPrice = 0;
                      baseTotalPrice = Object.values(calculatedPricing.items)
                                         .filter(item => item.quantity > 0)
                                         .reduce((sum, item) => sum + (item.baseUnitPrice * item.quantity || 0), 0);

                     let prospectiveInfoHtml = '';
                     if (existingEmbroideryItems > 0) {
                         prospectiveInfoHtml = `
                             <div class="prospective-pricing-info" style="background-color:#e8f4ff;padding:6px;margin:5px 0;border-radius:4px;border-left:4px solid #0d6efd;font-size:0.9em;">
                                 <div style="font-weight:bold;margin-bottom:3px;">Prospective Pricing Calculation:</div>
                                 <div style="display:flex;justify-content:space-between;">
                                     <span>Items being added:</span>
                                     <span>${newQuantityTotal}</span>
                                 </div>
                                 <div style="display:flex;justify-content:space-between;">
                                     <span>Items in cart:</span>
                                     <span>${existingEmbroideryItems}</span>
                                 </div>
                                 <div style="display:flex;justify-content:space-between;border-top:1px dashed #0d6efd;padding-top:3px;margin-top:3px;font-weight:bold;">
                                     <span>Combined total:</span>
                                     <span>${calculatedPricing.combinedQuantity} → ${calculatedPricing.tierKey} tier</span>
                                 </div>
                             </div>`;
                     }

                     totalAmountDisplay.innerHTML = `
                         <div class="total-breakdown">
                             <div style="text-align:center;background-color:#ffc107;color:#212529;padding:5px;margin-bottom:8px;border-radius:4px;font-weight:bold;font-size:1.1em;">⚠️ LTM FEE APPLIED TO ORDER ⚠️</div>
                             ${prospectiveInfoHtml}
                             <div class="base-price" style="margin-bottom:5px;">Base Price (${calculatedPricing.tierKey} tier): $${baseTotalPrice.toFixed(2)}</div>
                             <div class="ltm-fee" style="background-color:#fff3cd;padding:6px;margin:5px 0;border-radius:4px;border-left:4px solid #ffc107;">
                                 <strong>LTM Fee:</strong> $${calculatedPricing.ltmFeeTotal.toFixed(2)} ÷ ${calculatedPricing.combinedQuantity} items = <span style="color:#663c00;font-weight:bold;">$${calculatedPricing.ltmFeePerItem.toFixed(2)}/item</span>
                             </div>
                             <div class="total-with-ltm" style="margin-top:8px;font-size:1.2em;"><strong>Total: $${calculatedPricing.totalPrice.toFixed(2)}</strong></div>
                         </div>`;
                 } else {
                     // Standard pricing display with prospective info if needed
                     if (existingEmbroideryItems > 0 && newQuantityTotal > 0) {
                         totalAmountDisplay.innerHTML = `
                             <div class="total-breakdown">
                                 <div class="prospective-pricing-info" style="background-color:#e8f4ff;padding:6px;margin-bottom:8px;border-radius:4px;border-left:4px solid #0d6efd;font-size:0.9em;">
                                     <div style="font-weight:bold;margin-bottom:3px;">Prospective Pricing Calculation:</div>
                                     <div style="display:flex;justify-content:space-between;">
                                         <span>Items being added:</span>
                                         <span>${newQuantityTotal}</span>
                                     </div>
                                     <div style="display:flex;justify-content:space-between;">
                                         <span>Items in cart:</span>
                                         <span>${existingEmbroideryItems}</span>
                                     </div>
                                     <div style="display:flex;justify-content:space-between;border-top:1px dashed #0d6efd;padding-top:3px;margin-top:3px;font-weight:bold;">
                                         <span>Combined total:</span>
                                         <span>${calculatedPricing.combinedQuantity} → ${calculatedPricing.tierKey} tier</span>
                                     </div>
                                 </div>
                                 <div class="total-with-tier" style="font-size:1.2em;"><strong>Total: $${calculatedPricing.totalPrice.toFixed(2)}</strong></div>
                             </div>`;
                     } else {
                         totalAmountDisplay.textContent = `$${calculatedPricing.totalPrice.toFixed(2)}`;
                     }
                 }
                 
                 // Store calculated values in dataset
                 totalAmountDisplay.dataset.calculatedTotal = calculatedPricing.totalPrice.toFixed(2);
                 totalAmountDisplay.dataset.totalQuantity = newQuantityTotal;
                 totalAmountDisplay.dataset.tierKey = calculatedPricing.tierKey;
                 totalAmountDisplay.dataset.ltmFeeApplies = calculatedPricing.ltmFeeApplies;
                 totalAmountDisplay.dataset.ltmFee = calculatedPricing.ltmFeeTotal;
                 totalAmountDisplay.dataset.prospectiveTotal = calculatedPricing.combinedQuantity;
                 totalAmountDisplay.dataset.existingCartQty = existingEmbroideryItems;
            }

            // Dispatch event for other components
            document.dispatchEvent(new Event('cartTotalUpdated'));

        } catch (error) {
            console.error("[ADD-TO-CART] Error in updateCartTotal (Refactored v3):", error);
        } finally {
            updatingCartTotal = false;
        }
    }

    // == UI Update Functions REMOVED ==
    // updatePriceDisplayForSize, updateCartInfoDisplay, updateTierInfoDisplay
    // These are now expected to be in pricing-pages.js and accessed via window.PricingPageUI


    // Function to validate prices before adding to cart
    // REFACTORED: Uses NWCAPricingCalculator result (window.cartItemData) and captured data (window.nwcaPricingData)
    function validatePricesBeforeAddingToCart() {
        console.log("[ADD-TO-CART] Validating prices before adding to cart (Refactored)");

        // Check if we have calculated cartItemData from the calculator
        if (!window.cartItemData || !window.cartItemData.items || !window.cartItemData.tierKey) {
            console.error("[ADD-TO-CART:VALIDATION] No calculated cartItemData available for validation. Triggering recalculation.");
            updateCartTotal(); // Attempt recalculation
            if (!window.cartItemData || !window.cartItemData.items || !window.cartItemData.tierKey) {
                 console.error("[ADD-TO-CART:VALIDATION] Recalculation failed. Cannot validate prices.");
                 alert("Price calculation error. Please refresh the page and try again.");
                 return false;
            }
        }

        // Check if we have the source pricing data
        const sourcePricingData = window.nwcaPricingData;
        if (!sourcePricingData || !sourcePricingData.prices || !sourcePricingData.tierData) {
             console.error("[ADD-TO-CART:VALIDATION] Cannot validate prices: Missing source pricing data (window.nwcaPricingData).");
             alert("Pricing data is missing or invalid. Please refresh the page.");
             return false;
        }

        const { tierKey, ltmFeeApplies, ltmFeePerItem, items: calculatedItems } = window.cartItemData;
        const sourcePrices = sourcePricingData.prices;
        const sourceTierData = sourcePricingData.tierData;

        let allPricesValid = true;
        let invalidSizes = [];

        // Determine the reference tier for LTM lookup
        let ltmReferenceTier = null;
        if (ltmFeeApplies) {
             ltmReferenceTier = Object.keys(sourceTierData).find(t => {
                 const td = sourceTierData[t];
                 return (td.MinQuantity || 0) <= 24 && (td.MaxQuantity === undefined || td.MaxQuantity >= 24);
             }) || tierKey; // Fallback
        }

        for (const size in calculatedItems) {
            const itemData = calculatedItems[size];
            const quantity = itemData.quantity;
            if (quantity <= 0) continue; // Skip items not being added

            let expectedBasePrice = 0;
            const pricingTierForLookup = ltmFeeApplies ? ltmReferenceTier : tierKey;

            // Find expected base price from source data
            if (sourcePrices[size] && sourcePrices[size][pricingTierForLookup] !== undefined) {
                expectedBasePrice = parseFloat(sourcePrices[size][pricingTierForLookup]);
            } else if (size === 'OSFA' && sourcePrices['OSFA'] && sourcePrices['OSFA'][pricingTierForLookup] !== undefined) {
                 expectedBasePrice = parseFloat(sourcePrices['OSFA'][pricingTierForLookup]); // OSFA fallback check
            } else {
                console.warn(`[ADD-TO-CART:VALIDATION] Could not find source price for Size: ${size}, Tier: ${pricingTierForLookup}. Validation might be inaccurate.`);
                expectedBasePrice = itemData.baseUnitPrice; // Use calculated base as fallback
            }

            expectedBasePrice = isNaN(expectedBasePrice) ? 0 : expectedBasePrice;
            let expectedDisplayPrice = expectedBasePrice + (ltmFeeApplies ? ltmFeePerItem : 0);

            const actualDisplayPrice = itemData.displayUnitPrice;
            const tolerance = 0.011; // ~1 cent tolerance
            const priceDifference = Math.abs(expectedDisplayPrice - actualDisplayPrice);

            // console.log(`[ADD-TO-CART:VALIDATION] Size ${size}: Expected Display $${expectedDisplayPrice.toFixed(2)}, Actual Display $${actualDisplayPrice.toFixed(2)}, Diff: $${priceDifference.toFixed(2)}`);

            if (priceDifference > tolerance) {
                allPricesValid = false;
                invalidSizes.push({
                    size,
                    expected: expectedDisplayPrice.toFixed(2),
                    actual: actualDisplayPrice.toFixed(2)
                });
            }
        }

        if (!allPricesValid) {
            console.error("[ADD-TO-CART:VALIDATION] Price validation failed:", invalidSizes);
            const errorMessage = `Price synchronization error detected. The following sizes have incorrect prices:\n${invalidSizes.map(item => `${item.size}: Expected $${item.expected}, Found $${item.actual}`).join('\n')}\n\nPlease refresh the page or contact support if the issue persists.`;
            alert(errorMessage);
            return false;
        }

        console.log("[ADD-TO-CART:VALIDATION] All prices are valid");
        return true;
    }

    // Function to handle Add to Cart button click
    function handleAddToCart() {
        console.log("[ADD-TO-CART] Add to Cart button clicked");
        const addToCartButton = document.getElementById('add-to-cart-button');

        if (addToCartButton) {
             if (addToCartButton.disabled) {
                 console.log("[ADD-TO-CART] Button already processing, ignoring click");
                 return;
             }
             addToCartButton.disabled = true;
             addToCartButton._originalText = addToCartButton.textContent;
             addToCartButton.textContent = 'Processing...';
        }

        // 1. Ensure cart contents are loaded
        if (!window.cartContents) {
            console.log("[ADD-TO-CART] Cart contents not available, fetching before adding...");
            fetchCartContents().then(contents => {
                window.cartContents = contents;
                handleAddToCart(); // Re-call
            }).catch(error => {
                console.error("[ADD-TO-CART] Error fetching cart contents before add:", error);
                alert("Could not verify cart contents. Please try adding again.");
                if (addToCartButton) { addToCartButton.textContent = addToCartButton._originalText || 'Add to Cart'; addToCartButton.disabled = false; }
            });
            return;
        }

        // 2. Ensure latest prices are calculated and stored
        console.log("[ADD-TO-CART] Step 2: Forcing price recalculation..."); // ADDED LOG
        updateCartTotal(); // Force recalculation
        console.log("[ADD-TO-CART] Step 2: Price recalculation complete. Checking window.cartItemData:", JSON.parse(JSON.stringify(window.cartItemData || {}))); // ADDED LOG + Deep copy for logging
        if (!window.cartItemData || !window.cartItemData.items) {
             console.error("[ADD-TO-CART] Price calculation failed or window.cartItemData is invalid before add. Aborting."); // Enhanced log
             alert("Could not calculate final prices. Please refresh and try again.");
              if (addToCartButton) { addToCartButton.textContent = addToCartButton._originalText || 'Add to Cart'; addToCartButton.disabled = false; }
             return;
        }
        console.log("[ADD-TO-CART] Step 2: window.cartItemData seems valid."); // ADDED LOG

        // 3. Validate prices
        console.log("[ADD-TO-CART] Step 3: Starting price validation..."); // ADDED LOG
        let pricesAreValid = false;
        try {
            pricesAreValid = validatePricesBeforeAddingToCart();
        } catch (validationError) {
            console.error("[ADD-TO-CART] CRITICAL ERROR during price validation:", validationError);
            alert("A critical error occurred during price validation. Please refresh.");
            if (addToCartButton) { addToCartButton.textContent = addToCartButton._originalText || 'Add to Cart'; addToCartButton.disabled = false; }
            return;
        }
        console.log(`[ADD-TO-CART] Step 3: Price validation result: ${pricesAreValid}`); // ADDED LOG

        if (!pricesAreValid) {
            console.log("[ADD-TO-CART] Step 3: Price validation failed. Aborting add to cart."); // ADDED LOG
            // Alert is shown inside validatePricesBeforeAddingToCart
            if (addToCartButton) { addToCartButton.textContent = addToCartButton._originalText || 'Add to Cart'; addToCartButton.disabled = false; }
            return; // Exit if validation failed
        }
        console.log("[ADD-TO-CART] Step 3: Price validation passed."); // ADDED LOG

        // 4. Collect final data using validated window.cartItemData
        console.log("[ADD-TO-CART] Step 4: Collecting final product data..."); // ADDED LOG
        const {
            tierKey, ltmFeeApplies, totalQuantity, items: calculatedItems,
            ltmFeeTotal, ltmFeePerItem, combinedQuantity, cartQuantity, baseUnitPrices
        } = window.cartItemData;

        console.log(`[ADD-TO-CART] Handle Add: Using Tier: ${tierKey}, LTM Applies: ${ltmFeeApplies} from validated cartItemData`);

        if (totalQuantity === 0) {
            alert('Please select at least one size and quantity.');
            if (addToCartButton) { addToCartButton.textContent = addToCartButton._originalText || 'Add to Cart'; addToCartButton.disabled = false; }
            return;
        }

        // Format sizes for the cart API payload
        const sizesForCart = [];
        try {
            Object.keys(calculatedItems).forEach(size => {
                const item = calculatedItems[size];
                if (item.quantity > 0) {
                    sizesForCart.push({
                        size: size,
                        quantity: item.quantity,
                        unitPrice: item.displayUnitPrice,
                        totalPrice: item.itemTotal
                    });
                }
            });
        } catch (e) {
             console.error("[ADD-TO-CART] Error formatting size data for cart:", e);
             alert("Error preparing items for cart. Please try again.");
              if (addToCartButton) { addToCartButton.textContent = addToCartButton._originalText || 'Add to Cart'; addToCartButton.disabled = false; }
             return;
        }

        // Get product info
        const styleNumber = getUrlParameter('StyleNumber') || document.getElementById('product-style-number')?.value || 'UNKNOWN_STYLE';
        const colorCode = getUrlParameter('COLOR') || document.getElementById('product-color-code')?.value || 'UNKNOWN_COLOR';
        const embType = detectEmbellishmentType();

        // Capture the EXACT product image URL from the specific required element
        const productImageElement = document.getElementById('product-image'); // Only use this specific ID
        const specificImageUrl = productImageElement ? productImageElement.getAttribute('src') : '';
        console.log("[ADD-TO-CART] Captured product image URL from #product-image:", specificImageUrl);

        // Construct the final payload
        const productData = {
            styleNumber: styleNumber, color: colorCode, embellishmentType: embType,
            pricingTier: tierKey, ltmFeeApplied: ltmFeeApplies, totalQuantity: totalQuantity,
            sizes: sizesForCart,
            imageUrl: specificImageUrl, // Add the captured image URL to productData
            pricingInfo: {
                tierKey, ltmFeeApplied: ltmFeeApplies, ltmFeeTotal, ltmFeePerItem,
                combinedQuantity, existingCartQuantity: cartQuantity, baseUnitPrices
            }
        };

        // Final data validation
        if (!productData.styleNumber || productData.styleNumber === 'UNKNOWN_STYLE' || !productData.color || productData.color === 'UNKNOWN_COLOR' || productData.sizes.length === 0) {
            console.error("[ADD-TO-CART] Invalid final product data:", productData);
            alert('Error: Required product style or color information is missing.');
             if (addToCartButton) { addToCartButton.textContent = addToCartButton._originalText || 'Add to Cart'; addToCartButton.disabled = false; }
            return;
        }

        // 5. Send to Cart API
        if (window.NWCACart && typeof window.NWCACart.addToCart === 'function') {
            if (addToCartButton) addToCartButton.textContent = 'Adding...';
            console.log("[ADD-TO-CART] Step 5: Preparing to call NWCACart.addToCart with data:", JSON.parse(JSON.stringify(productData))); // MODIFIED LOG

            window.NWCACart.addToCart(productData) // <<< THE CALL
                .then(result => {
                    console.log("[ADD-TO-CART] Step 5: NWCACart.addToCart call completed. Result:", result); // ADDED LOG
                    if (result && result.success) {
                        console.log("[ADD-TO-CART] Step 5: Add to cart reported SUCCESS."); // ADDED LOG
                        // Call the success notification function from PricingPageUI
                        if (window.PricingPageUI && typeof window.PricingPageUI.showSuccessNotification === 'function') {
                            window.PricingPageUI.showSuccessNotification(productData);
                        } else {
                            console.error("[ADD-TO-CART] PricingPageUI.showSuccessNotification not available.");
                            alert('Items added to cart successfully!'); // Fallback alert
                        }
                        // Refresh cart contents state AFTER successful add
                        return fetchCartContents(); // Chain the promise
                    } else {
                        console.error("[ADD-TO-CART] Cart API reported failure:", result);
                        let errorMessage = 'Error adding to cart' + ((result?.error || result?.message) ? `: ${result.error || result.message}` : ': Unknown error.');
                        alert(errorMessage);
                        throw new Error(errorMessage);
                    }
                })
                 .then(newCartContents => {
                     window.cartContents = newCartContents;
                     console.log("[ADD-TO-CART] Cart contents refreshed after successful add.");
                     updateCartTotal(); // Re-run update to reflect new state
                     if (window.NWCACart?.recalculatePrices) {
                         console.log("[ADD-TO-CART] Triggering price recalculation after successful add");
                         window.NWCACart.recalculatePrices(embType).catch(err => console.error("Error during post-add recalculation:", err));
                     }
                     window.dispatchEvent(new CustomEvent('cartItemAdded', { detail: { embellishmentType: embType, success: true } }));
                     if (addToCartButton) { addToCartButton.textContent = addToCartButton._originalText || 'Add to Cart'; addToCartButton.disabled = false; }
                 })
                .catch(error => {
                    console.error("[ADD-TO-CART] Error during add to cart process:", error);
                    if (addToCartButton) { addToCartButton.textContent = addToCartButton._originalText || 'Add to Cart'; addToCartButton.disabled = false; }
                     window.dispatchEvent(new CustomEvent('cartAddFailed', { detail: { error: error.message || 'Unknown error', productData } }));
                });
        } else {
            console.error("[ADD-TO-CART] Cart system (NWCACart.addToCart) not available");
            alert('Cart system not available. Please try again later.');
            if (addToCartButton) { addToCartButton.textContent = addToCartButton._originalText || 'Add to Cart'; addToCartButton.disabled = false; }
        }
    }


    // Helper function to get URL parameter
    function getUrlParameter(name) {
        try {
            const urlParams = new URLSearchParams(window.location.search);
            return urlParams.get(name);
        } catch (e) {
            console.error("Error getting URL parameter:", e);
            return null;
        }
    }

    // Helper function to detect embellishment type
    function detectEmbellishmentType() {
        const url = window.location.href.toLowerCase();
        const titleElement = document.querySelector('h1, h2, title');
        const title = titleElement ? titleElement.textContent.toLowerCase() : document.title.toLowerCase();

        if (url.includes('cap-embroidery') || title.includes('cap embroidery')) return 'cap-embroidery';
        if (url.includes('embroidery') || title.includes('embroidery')) return 'embroidery';
        if (url.includes('dtg') || title.includes('dtg')) return 'dtg';
        if (url.includes('screen-print') || url.includes('screenprint') || title.includes('screen print')) return 'screen-print';
        if (url.includes('dtf') || title.includes('dtf')) return 'dtf';

        const matrixTitle = document.getElementById('matrix-title')?.textContent.toLowerCase();
        if (matrixTitle) {
             if (matrixTitle.includes('cap embroidery')) return 'cap-embroidery';
             if (matrixTitle.includes('embroidery')) return 'embroidery';
             if (matrixTitle.includes('dtg')) return 'dtg';
             if (matrixTitle.includes('screen print')) return 'screen-print';
             if (matrixTitle.includes('dtf')) return 'dtf';
        }

        console.warn("[ADD-TO-CART] Could not detect embellishment type, defaulting to 'embroidery'");
        return 'embroidery';
    }

    // Flag to prevent multiple initializations
    let isInitializing = false;
    let uiInitialized = false; // Add flag for UI/listener init

    // Function to run after pricing data is confirmed available
    function handlePricingDataReady(event) {
         if (uiInitialized) return; // Prevent double init
         console.log("[ADD-TO-CART] 'pricingDataLoaded' event received or data found. Initializing UI and listeners.", event?.detail);
         initializeUIAndListeners();
    }

    // Separated UI/Listener initialization
    function initializeUIAndListeners() {
         if (uiInitialized) { console.log("[ADD-TO-CART] UI and Listeners already initialized."); return; }

         // Ensure pricing data is actually available before proceeding
         if (!window.nwcaPricingData || !window.availableSizesFromTable) {
             console.error("[ADD-TO-CART:INIT-UI] Pricing data or available sizes missing. Aborting UI initialization.");
             handlePricingDataError({ detail: { message: 'Pricing data missing during UI initialization.' } });
             return;
         }
         uiInitialized = true; // Set flag *after* check

         console.log("[ADD-TO-CART:INIT-UI] Proceeding with UI initialization.");

         // Sync sizes and create UI elements (uses window.availableSizesFromTable)
         syncSizesWithPricingMatrix(); // Should now have data

         // Initialize Add to Cart button listener
         // initAddToCartButton(); // REMOVED - Listener attached via delegation now

         // Perform initial total calculation
         updateCartTotal(); // Should now have data

         // Attach listeners for quantity changes AFTER inputs are created
         attachQuantityChangeListeners();

         // Apply mobile adjustments (Call function from PricingPageUI)
         if (window.PricingPageUI?.handleMobileAdjustments) {
             window.PricingPageUI.handleMobileAdjustments();
             // Add resize listener only once
             if (!window.hasMobileResizeListener) {
                  window.addEventListener('resize', window.PricingPageUI.handleMobileAdjustments);
                  window.hasMobileResizeListener = true;
             }
         } else {
              console.error("[ADD-TO-CART] PricingPageUI.handleMobileAdjustments not available.");
         }

         console.log("[ADD-TO-CART] UI and Listeners Initialized.");
         isInitializing = false; // Mark main init process as complete
         window.addToCartInitialized = true; // Set the original flag
    }

    // Main initialization function
    function initialize() {
        if (isInitializing || window.addToCartInitialized) {
            console.log("[ADD-TO-CART] Initialization already in progress or completed.");
            return;
        }
        isInitializing = true;
        console.log("[ADD-TO-CART] DOM ready, starting initialization...");

        // Fetch cart contents first (less critical dependency)
        fetchCartContents().then(cartContents => {
            window.cartContents = cartContents;
            console.log("[ADD-TO-CART] Initial cart contents fetched.");

            // Now, check for pricing data and wait if necessary
            console.log("[ADD-TO-CART] Checking for pricing data...");
            if (window.nwcaPricingData && window.availableSizesFromTable) {
                 console.log("[ADD-TO-CART] Pricing data already available. Proceeding with UI init.");
                 // Use setTimeout to ensure this runs after the current execution stack clears,
                 // allowing other initializations (like PricingPageUI) to potentially finish.
                 setTimeout(handlePricingDataReady, 0);
            } else {
                 console.log("[ADD-TO-CART] Pricing data not yet available. Waiting for 'pricingDataLoaded' or 'pricingDataError' event.");
                 // Listen for the events
                 window.addEventListener('pricingDataLoaded', handlePricingDataReady, { once: true });
                 window.addEventListener('pricingDataError', handlePricingDataError, { once: true });

                 // Attach delegated event listener ONCE during initial setup
                 attachDelegatedAddToCartListener();

            }

        }).catch(error => {
            console.error("[ADD-TO-CART] Initialization failed during cart fetch:", error);
            // Display an error message but don't proceed with pricing-dependent UI
            const errorDisplay = document.getElementById('cart-error-display');
            if(errorDisplay) errorDisplay.textContent = "Error loading cart data. Pricing may be inaccurate.";
            isInitializing = false;
            // Do not set uiInitialized or addToCartInitialized here, let the pricing data error handler manage that state.
        });
    }

    // Handler for pricing data error
    function handlePricingDataError(event) {
        // Ensure this doesn't run if UI init already succeeded somehow
        if (uiInitialized) return;

        console.error("[ADD-TO-CART] Received 'pricingDataError' event:", event?.detail?.message);
        // Display an error message in the quantity section
        const quantitySection = document.getElementById('quantity-section') || document.getElementById('size-quantity-grid-container') || document.getElementById('quantity-matrix');
        if (quantitySection) {
            quantitySection.innerHTML = `<p style="color: red; font-weight: bold; padding: 10px; border: 1px solid red; background-color: #ffeeee;">Error: Could not load pricing data. ${event?.detail?.message || 'Pricing table not found or failed to load.'}</p>`;
        }
         isInitializing = false;
         uiInitialized = true; // Prevent further UI init attempts
         window.addToCartInitialized = true; // Mark as 'done' even though failed
    }

    // Function to (re)attach event listeners to quantity inputs
    function attachQuantityChangeListeners() {
        console.log("[ADD-TO-CART] Attaching/Re-attaching listeners to quantity inputs...");
        const quantityInputs = document.querySelectorAll('.quantity-input');
        quantityInputs.forEach(input => {
            input.removeEventListener('change', updateCartTotal);
            input.removeEventListener('input', updateCartTotal);
            input.addEventListener('change', updateCartTotal);
            input.addEventListener('input', updateCartTotal);

            const controlDiv = input.closest('.quantity-control') || input.closest('.size-quantity-item');
             if (controlDiv) {
                 const decreaseBtn = controlDiv.querySelector('.decrease-btn');
                 const increaseBtn = controlDiv.querySelector('.increase-btn');
                 if (decreaseBtn) {
                     decreaseBtn.removeEventListener('click', handleQuantityButtonClick);
                     decreaseBtn.addEventListener('click', handleQuantityButtonClick);
                 }
                 if (increaseBtn) {
                     increaseBtn.removeEventListener('click', handleQuantityButtonClick);
                     increaseBtn.addEventListener('click', handleQuantityButtonClick);
                 }
             }
        });
        console.log(`[ADD-TO-CART] Attached listeners to ${quantityInputs.length} inputs.`);
    }

    // Handler for +/- button clicks
    function handleQuantityButtonClick(event) {
        const button = event.currentTarget;
        const controlDiv = button.closest('.quantity-control') || button.closest('.size-quantity-item');
        const input = controlDiv ? controlDiv.querySelector('.quantity-input') : null;

        if (input) {
            let currentValue = parseInt(input.value) || 0;
            if (button.classList.contains('decrease-btn')) {
                currentValue = Math.max(0, currentValue - 1);
            } else if (button.classList.contains('increase-btn')) {
                currentValue += 1;
            }
            input.value = currentValue;
            input.dispatchEvent(new Event('change', { bubbles: true }));
            updateCartTotal(); // Ensure immediate update
        }
    }

    // == UI Update Functions REMOVED ==
    // handleMobileAdjustments (This function itself is removed, call is updated below)
    // This is now expected to be in pricing-pages.js and accessed via window.PricingPageUI

    // =========================================================================
    // == UI CREATION MOVED TO product-quantity-ui.js ==
    // =========================================================================

    // Function to synchronize sizes shown in the Add to Cart section with the pricing matrix
    // MODIFIED: Uses window.availableSizesFromTable and calls ProductQuantityUI module
    function syncSizesWithPricingMatrix() {
        console.log("[ADD-TO-CART] Syncing sizes with pricing matrix...");

        // Prioritize parsed sizes from the table (set by pricing-matrix-capture.js)
        const availableSizes = window.availableSizesFromTable;

        if (!availableSizes || availableSizes.length === 0) {
            console.error("[ADD-TO-CART] Cannot sync sizes: No sizes available from parsed table data (window.availableSizesFromTable).");
            const quantitySection = document.getElementById('quantity-section') || document.getElementById('size-quantity-grid-container') || document.getElementById('quantity-matrix');
            if (quantitySection) {
                quantitySection.innerHTML = '<p style="color: red; font-weight: bold; padding: 10px; border: 1px solid red; background-color: #ffeeee;">Error: Could not load size information from the pricing table.</p>';
            }
            return;
        }

        console.log("[ADD-TO-CART] Sizes to use for UI:", availableSizes);

        // Determine preferred layout and create the appropriate UI using the external module
        const useGrid = window.PricingPageUI?.determineLayoutPreference ? window.PricingPageUI.determineLayoutPreference() : false; // Use PricingPageUI version
        let uiCreated = false;
        if (useGrid) {
            console.log("[ADD-TO-CART] Using grid layout for quantity inputs.");
            if (window.ProductQuantityUI && typeof window.ProductQuantityUI.createSizeQuantityGrid === 'function') {
                uiCreated = window.ProductQuantityUI.createSizeQuantityGrid(availableSizes);
                 const matrixContainer = document.getElementById('quantity-matrix');
                 if(matrixContainer) matrixContainer.style.display = 'none';
            } else {
                console.error("[ADD-TO-CART] ProductQuantityUI.createSizeQuantityGrid function not found!");
            }
        } else {
            console.log("[ADD-TO-CART] Using matrix layout for quantity inputs.");
             if (window.ProductQuantityUI && typeof window.ProductQuantityUI.createQuantityMatrix === 'function') {
                uiCreated = window.ProductQuantityUI.createQuantityMatrix(availableSizes);
                 const gridContainer = document.getElementById('size-quantity-grid-container');
                 if(gridContainer) gridContainer.style.display = 'none';
            } else {
                 console.error("[ADD-TO-CART] ProductQuantityUI.createQuantityMatrix function not found!");
            }
        }

        if (uiCreated) {
             // Apply mobile adjustments AFTER creating the UI elements (Call moved to initializeUIAndListeners)

             // Re-attach listeners AFTER creating the UI elements
             attachQuantityChangeListeners();
        } else {
             console.error("[ADD-TO-CART] Failed to create quantity UI.");
        }
    }

    // == determineLayoutPreference function REMOVED (Moved to pricing-pages.js) ==

    // == UI Creation Functions REMOVED (createQuantityMatrix, createSizeQuantityGrid) ==


    // =========================================================================
    // == END OF UI CREATION REFACTOR ==
    // =========================================================================


    // == UI Update Functions REMOVED ==
    // showSuccessWithViewCartButton (Now handled by PricingPageUI.showSuccessNotification)
    // initAddToCartButton REMOVED - Replaced with event delegation below

    // =========================================================================
    // == Initialization Trigger ==
    // =========================================================================
    // Safely initialize when DOM is ready
    try {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initialize);
        } else {
            initialize(); // DOM already loaded
        }
    } catch (error) {
        console.error("[ADD-TO-CART] Critical error during initialization setup:", error);
    }

    // =========================================================================
    // == Test Functions (Keep for debugging/development) ==
    // =========================================================================
    function testAddToCartMatrix() { console.log("[TEST] testAddToCartMatrix function placeholder."); }
    function testMatrixInitialization() { console.log("[TEST] testMatrixInitialization function placeholder."); return true;}
    function testPricingCalculations() { console.log("[TEST] testPricingCalculations function placeholder."); return true;}
    function testAddToCartButton() { console.log("[TEST] testAddToCartButton function placeholder."); return true;}
    function setupMockCartIntegration() { console.log("[TEST] setupMockCartIntegration function placeholder."); }

     if (window.location.search.includes('test=add-to-cart')) {
         console.log("[TEST] Scheduling add-to-cart tests...");
         document.addEventListener('DOMContentLoaded', () => {
             setTimeout(testAddToCartMatrix, 1500);
         });
     }

    // Function to attach the delegated listener
    function attachDelegatedAddToCartListener() {
        // Find a suitable static parent container. Use body as a fallback.
        // Let's try a container likely wrapping the add-to-cart section
        const parentContainer = document.getElementById('add-to-cart-controls') || document.getElementById('quantity-section') || document.body;
        console.log(`[ADD-TO-CART] Attaching delegated click listener to: ${parentContainer.id || 'document.body'}`);

        // Remove listener first to ensure it's only attached once, even if initialize runs multiple times
        parentContainer.removeEventListener('click', delegatedClickListener);
        parentContainer.addEventListener('click', delegatedClickListener);
    }

    // The actual delegated listener function
    function delegatedClickListener(event) {
        // Check if the clicked element *is* or *is inside* the add-to-cart button
        const button = event.target.closest('#add-to-cart-button');
        if (button) {
            console.log("[ADD-TO-CART] Delegated click listener detected click on #add-to-cart-button");
            // Prevent default if the button is inside a form or link
            event.preventDefault();
            handleAddToCart(); // Call the original handler
        }
    }

})(); // End of IIFE
