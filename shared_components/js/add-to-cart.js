// Add to Cart functionality for embroidery pricing pages
(function() {
    "use strict";

    console.log("[ADD-TO-CART] Initializing add to cart functionality (v3 Refactored)");

    async function fetchCartContents() {
        console.log("[ADD-TO-CART] Fetching current cart contents");
        try {
            const cartSystem = window.detectAvailableCartSystem ? window.detectAvailableCartSystem() : null;
            if (!cartSystem) {
                console.warn("[ADD-TO-CART] No cart system available for cart content fetch");
                return { itemsOfCurrentType: 0, totalItems: 0, items: [] };
            }
            const cartResult = await cartSystem.api.getCartItems();
            if (!cartResult || !cartResult.success || !Array.isArray(cartResult.items)) {
                console.warn("[ADD-TO-CART] Failed to get cart items or no items returned");
                return { itemsOfCurrentType: 0, totalItems: 0, items: [] };
            }
            const currentEmbType = detectEmbellishmentType();
            let itemsOfCurrentTypeCount = 0;
            let totalItemCount = 0;
            cartResult.items.forEach(item => {
                if (Array.isArray(item.sizes)) {
                    const itemQuantity = item.sizes.reduce((sum, size) => sum + (parseInt(size.quantity) || 0), 0);
                    totalItemCount += itemQuantity;
                    if (item.embellishmentType === currentEmbType) {
                        itemsOfCurrentTypeCount += itemQuantity;
                    }
                }
            });
            console.log(`[ADD-TO-CART] Cart contains ${itemsOfCurrentTypeCount} items of type '${currentEmbType}' out of ${totalItemCount} total items`);
            return {
                itemsOfCurrentType: itemsOfCurrentTypeCount,
                totalItems: totalItemCount,
                items: cartResult.items
            };
        } catch (error) {
            console.error("[ADD-TO-CART] Error fetching cart contents:", error);
            return { itemsOfCurrentType: 0, totalItems: 0, items: [] };
        }
    }

    let updatingCartTotal = false;

    function updateCartTotal() {
        if (updatingCartTotal) {
            return;
        }
        updatingCartTotal = true;
        try {
            console.log("[ADD-TO-CART] Updating cart total (Refactored v5 - Screen Print Integration)");
            window.updateCartTotal = updateCartTotal;
            let quantityInputs = [];
            const sizeQuantities = {};
            let newQuantityTotal = 0;
            try {
                const useGrid = window.PricingPageUI?.determineLayoutPreference ? window.PricingPageUI.determineLayoutPreference() : false;
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
                } else {
                     console.warn(`[ADD-TO-CART] Could not find container ${containerSelector}. Cannot get quantities.`);
                }
            } catch (err) {
                console.error("[ADD-TO-CART] Error getting quantity inputs:", err);
            }

            if (!window.cartContents) {
                console.log("[ADD-TO-CART] Cart contents not available, fetching...");
                updatingCartTotal = false;
                fetchCartContents().then(contents => {
                    window.cartContents = contents;
                    updateCartTotal();
                }).catch(error => {
                    console.error("[ADD-TO-CART] Error fetching cart contents:", error);
                    window.cartContents = { itemsOfCurrentType: 0, totalItems: 0, items: [] };
                    updateCartTotal();
                });
                return;
            }

            const currentEmbType = detectEmbellishmentType();
            let existingItemsOfCurrentType = 0;
            if (window.NWCACart && typeof window.NWCACart.getCartItems === 'function') {
                const activeCartItems = window.NWCACart.getCartItems('Active');
                if (activeCartItems && Array.isArray(activeCartItems)) {
                    activeCartItems.forEach(item => {
                        if (item.ImprintType === currentEmbType && item.CartStatus === 'Active' && Array.isArray(item.sizes)) {
                            existingItemsOfCurrentType += item.sizes.reduce((sum, size) => sum + (parseInt(size.Quantity) || 0), 0);
                        }
                    });
                }
                 console.log(`[ADD-TO-CART:DEBUG] Calculated existing ${currentEmbType} items directly from NWCACart: ${existingItemsOfCurrentType}. Active cart items found:`, activeCartItems);
            } else {
                 console.warn("[ADD-TO-CART] NWCACart.getCartItems not available to calculate existing quantity.");
            }
            
            let calculatedPricing;
            const pricingDataForCalc = window.nwcaPricingData; // General pricing data

            // For all embellishment types, including screen-print, use NWCAPricingCalculator
            // with window.nwcaPricingData, which should be populated by the respective adapter/capture script.
            if (!pricingDataForCalc) {
                console.error(`[ADD-TO-CART] Pricing data (window.nwcaPricingData) not available for ${currentEmbType}. Cannot calculate prices.`);
                const totalAmountDisplay = document.querySelector('.total-amount');
                if(totalAmountDisplay) totalAmountDisplay.textContent = 'Error: Pricing Unavailable';
                updatingCartTotal = false;
                return;
            }
            if (!window.NWCAPricingCalculator || typeof window.NWCAPricingCalculator.calculatePricing !== 'function') {
                console.error("[ADD-TO-CART] NWCAPricingCalculator is not available!");
                updatingCartTotal = false;
                return;
            }
            
            console.log(`[ADD-TO-CART] Using NWCAPricingCalculator for ${currentEmbType}. Data:`, {
                sizeQuantities: JSON.parse(JSON.stringify(sizeQuantities)),
                existingCartQuantity: existingItemsOfCurrentType,
                pricingData: JSON.parse(JSON.stringify(pricingDataForCalc)) // Log the actual pricing data being used
            });
            
            calculatedPricing = window.NWCAPricingCalculator.calculatePricing(
                sizeQuantities,
                existingItemsOfCurrentType,
                pricingDataForCalc // This is window.nwcaPricingData
            );

            // More direct logging of the calculatedPricing object itself
            console.log(`[ADD-TO-CART] Direct calculatedPricing object for ${currentEmbType}:`, calculatedPricing);
            
            if (!calculatedPricing || typeof calculatedPricing !== 'object' || Object.keys(calculatedPricing).length === 0) {
                console.error("[ADD-TO-CART] Pricing calculation failed or returned non-object/empty object. Value:", calculatedPricing);
                const totalAmountDisplay = document.querySelector('.total-amount');
                if (totalAmountDisplay) {
                    totalAmountDisplay.textContent = 'Error: Calc Failed'; // Shorter error for UI
                    totalAmountDisplay.style.color = 'red'; // Make error more visible
                }
                updatingCartTotal = false;
                return;
            }
            // If we reach here, calculatedPricing is a valid, non-empty object.
            console.log(`[ADD-TO-CART] Pricing calculation successful for ${currentEmbType}. Proceeding to update UI.`);

            window.cartItemData = {
                ...calculatedPricing, 
                cartQuantity: existingItemsOfCurrentType, 
                totalQuantity: newQuantityTotal,
                prospectiveTotal: calculatedPricing.combinedQuantity
            };
            console.log("[ADD-TO-CART] Prospective total calculation:", {
                new: newQuantityTotal,
                existing: existingItemsOfCurrentType,
                combined: calculatedPricing.combinedQuantity,
                tier: calculatedPricing.tierKey,
                ltmApplies: calculatedPricing.ltmFeeApplies
            });

            const ltmFeeNotice = document.querySelector('.ltm-fee-notice');
            if (ltmFeeNotice) {
                ltmFeeNotice.style.display = calculatedPricing.ltmFeeApplies ? 'block' : 'none';
                if (calculatedPricing.ltmFeeApplies) {
                    const ltmText = ltmFeeNotice.querySelector('.ltm-text');
                    if (ltmText) {
                         const ltmQuantityNeeded = Math.max(0, (window.LTM_MINIMUM_QUANTITY || 24) - calculatedPricing.combinedQuantity); 
                         ltmText.innerHTML = `
                            <div style="display:flex;align-items:center;margin-bottom:5px;">
                                <span style="font-size:1.3em;margin-right:8px;">⚠️</span>
                                <span style="font-size:1.1em;font-weight:bold;">Less Than Minimum Fee</span>
                            </div>
                            <div style="margin-bottom:5px;">
                                <div>Total LTM Fee: <span style="color:#663c00;font-weight:bold;font-size:1.1em;">$${(calculatedPricing.ltmFeeTotal || 0).toFixed(2)}</span></div>
                                <div>Per Item: <span style="color:#663c00;font-weight:bold;">$${(calculatedPricing.ltmFeePerItem || 0).toFixed(2)}</span> × ${calculatedPricing.combinedQuantity} items</div>
                            </div>
                            ${ltmQuantityNeeded > 0 ? `<div style="font-size:0.9em;font-style:italic;margin-top:5px;padding-top:5px;border-top:1px dashed #ffc107;">
                                Add ${ltmQuantityNeeded} more items to reach ${(window.LTM_MINIMUM_QUANTITY || 24)} pieces and eliminate this fee
                            </div>` : ''}
                            ${existingItemsOfCurrentType > 0 ? `<div style="font-size:0.9em;background-color:#e8f4ff;padding:5px;margin-top:5px;border-radius:4px;border-left:3px solid #0d6efd;">
                                <span style="font-weight:bold;">Prospective Pricing:</span> Includes ${existingItemsOfCurrentType} items already in cart.
                            </div>` : ''}
                        `;
                    }
                    ltmFeeNotice.style.backgroundColor = '#fff3cd';
                    ltmFeeNotice.style.border = '1px solid #ffeeba';
                    ltmFeeNotice.style.padding = '12px';
                    ltmFeeNotice.style.borderRadius = '6px';
                    ltmFeeNotice.style.marginBottom = '15px';
                    ltmFeeNotice.style.boxShadow = '0 2px 4px rgba(0,0,0,0.05)';
                }
            }

            const callUpdateAllPricingDisplays = () => {
                if (window.NWCAProductPricingUI && typeof window.NWCAProductPricingUI.updateAllPricingDisplays === 'function') {
                    try {
                        window.NWCAProductPricingUI.updateAllPricingDisplays(newQuantityTotal, existingItemsOfCurrentType, calculatedPricing);
                        console.log("[ADD-TO-CART] Successfully called NWCAProductPricingUI.updateAllPricingDisplays with calculatedPricing.");
                    } catch (uiError) {
                        console.error("[ADD-TO-CART] Error calling NWCAProductPricingUI.updateAllPricingDisplays:", uiError, calculatedPricing);
                    }
                } else {
                    if (!window.NWCAProductPricingUI) {
                        console.warn("[ADD-TO-CART] NWCAProductPricingUI object not found on window when attempting to call updateAllPricingDisplays.");
                    } else {
                        console.warn("[ADD-TO-CART] NWCAProductPricingUI.updateAllPricingDisplays function not found when attempting to call.");
                    }
                }
            };

            if (window.isNWCAProductPricingUIReady) {
                callUpdateAllPricingDisplays();
            } else {
                console.warn("[ADD-TO-CART] NWCAProductPricingUI not yet ready. Listening for 'nwcaProductPricingUIReady' event.");
                document.addEventListener('nwcaProductPricingUIReady', function onUIReady() {
                    console.log("[ADD-TO-CART] 'nwcaProductPricingUIReady' event received. Attempting to call updateAllPricingDisplays.");
                    document.removeEventListener('nwcaProductPricingUIReady', onUIReady); 
                    callUpdateAllPricingDisplays();
                }, { once: true });
            }

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

            const totalAmountDisplay = document.querySelector('#sticky-product-cart-summary .total-amount');
            const totalQuantityDisplay = document.querySelector('#sticky-product-cart-summary .total-quantity');
            const ltmFeeNoticeInStickySummary = document.querySelector('#sticky-product-cart-summary .ltm-fee-notice');

            if (totalQuantityDisplay) {
                totalQuantityDisplay.textContent = newQuantityTotal;
            }

            if (totalAmountDisplay) {
                console.log(`[ADD-TO-CART:UI_UPDATE] Attempting to update totalAmountDisplay. Current textContent: '${totalAmountDisplay.textContent}'`);
                if (calculatedPricing && typeof calculatedPricing.totalPrice === 'number' && !isNaN(calculatedPricing.totalPrice)) {
                    const newTotalText = `$${calculatedPricing.totalPrice.toFixed(2)}`;
                    totalAmountDisplay.textContent = newTotalText;
                    totalAmountDisplay.style.color = ''; // Reset color if it was red
                    console.log(`[ADD-TO-CART:UI_UPDATE] Successfully updated totalAmountDisplay to: '${newTotalText}'`);
                } else {
                    console.error(`[ADD-TO-CART:UI_UPDATE_ERROR] calculatedPricing.totalPrice is invalid. Value:`, calculatedPricing ? calculatedPricing.totalPrice : 'calculatedPricing is null/undefined');
                    totalAmountDisplay.textContent = 'Error: Price Invalid';
                    totalAmountDisplay.style.color = 'red';
                }
                totalAmountDisplay.dataset.calculatedTotal = (calculatedPricing && typeof calculatedPricing.totalPrice === 'number') ? calculatedPricing.totalPrice.toFixed(2) : '0.00';
                totalAmountDisplay.dataset.totalQuantity = newQuantityTotal;
                totalAmountDisplay.dataset.tierKey = calculatedPricing ? calculatedPricing.tierKey : '';
                totalAmountDisplay.dataset.ltmFeeApplies = calculatedPricing ? calculatedPricing.ltmFeeApplies : 'false';
                totalAmountDisplay.dataset.ltmFeeTotal = (calculatedPricing && typeof calculatedPricing.ltmFeeTotal === 'number') ? calculatedPricing.ltmFeeTotal.toFixed(2) : '0.00';
                totalAmountDisplay.dataset.combinedQuantity = calculatedPricing ? calculatedPricing.combinedQuantity : '0';
                totalAmountDisplay.dataset.existingCartQty = existingItemsOfCurrentType;
            } else {
                console.warn("[ADD-TO-CART:UI_UPDATE] totalAmountDisplay element not found in sticky summary.");
            }

            if (ltmFeeNoticeInStickySummary) {
                if (calculatedPricing.ltmFeeApplies && newQuantityTotal > 0) {
                    ltmFeeNoticeInStickySummary.style.display = 'flex'; 
                    const ltmTextElement = ltmFeeNoticeInStickySummary.querySelector('.ltm-text');
                    let ltmDetailElement = ltmFeeNoticeInStickySummary.querySelector('.ltm-detail-text');

                    if (ltmTextElement) {
                        ltmTextElement.textContent = `LTM Fee Applied ($${(calculatedPricing.ltmFeeTotal || 0).toFixed(2)})`;
                    }

                    if (!ltmDetailElement) {
                        ltmDetailElement = document.createElement('div');
                        ltmDetailElement.className = 'ltm-detail-text';
                        ltmDetailElement.style.fontSize = '0.85em';
                        ltmDetailElement.style.marginTop = '5px';
                        ltmDetailElement.style.color = '#6c757d'; 
                        if(ltmTextElement && ltmTextElement.parentNode === ltmFeeNoticeInStickySummary) {
                            ltmTextElement.insertAdjacentElement('afterend', ltmDetailElement);
                        } else {
                            ltmFeeNoticeInStickySummary.appendChild(ltmDetailElement);
                        }
                    }
                    const ltmMinQty = window.LTM_MINIMUM_QUANTITY || 24;
                    const ltmFeeValue = window.LTM_FEE_VALUE || 50;
                    ltmDetailElement.innerHTML = `<small>Orders under ${ltmMinQty} pcs incur a $${ltmFeeValue.toFixed(2)} LTM fee, added to the ${ltmMinQty}-pc price and distributed per item. (e.g., 10 items: ${ltmMinQty}-pc price + $${(ltmFeeValue / (calculatedPricing.combinedQuantity || 1)).toFixed(2)}/item).</small>`;
                } else {
                    ltmFeeNoticeInStickySummary.style.display = 'none';
                }
            }
            document.dispatchEvent(new Event('cartTotalUpdated'));
            
            const addToCartButton = document.getElementById('add-to-cart-button');
            if (addToCartButton) {
                if (newQuantityTotal > 0) {
                    addToCartButton.disabled = false;
                    console.log("[ADD-TO-CART] Enabling Add to Cart button - quantities selected:", newQuantityTotal);
                } else {
                    addToCartButton.disabled = true;
                    console.log("[ADD-TO-CART] Add to Cart button remains disabled - no quantities selected");
                }
            }
        } catch (error) {
            console.error("[ADD-TO-CART] Error in updateCartTotal (Refactored v5):", error);
        } finally {
            updatingCartTotal = false;
        }
    }

    function validatePricesBeforeAddingToCart() {
        const currentEmbType = detectEmbellishmentType();
        if (currentEmbType === 'screen-print') {
            console.log("[ADD-TO-CART:VALIDATION] Skipping price validation for screen-print as pricing data source is different.");
            return true;
        }

        console.log("[ADD-TO-CART] Validating prices before adding to cart (Refactored)");
        if (!window.cartItemData || !window.cartItemData.items || !window.cartItemData.tierKey) {
            console.error("[ADD-TO-CART:VALIDATION] No calculated cartItemData available for validation. Triggering recalculation.");
            updateCartTotal(); 
            if (!window.cartItemData || !window.cartItemData.items || !window.cartItemData.tierKey) {
                 console.error("[ADD-TO-CART:VALIDATION] Recalculation failed. Cannot validate prices.");
                 alert("Price calculation error. Please refresh the page and try again.");
                 return false;
            }
        }
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
        let ltmReferenceTier = null;
        const ltmMinQty = window.LTM_MINIMUM_QUANTITY || 24;
        if (ltmFeeApplies) {
             ltmReferenceTier = Object.keys(sourceTierData).find(t => {
                 const td = sourceTierData[t];
                 return (td.MinQuantity || 0) <= ltmMinQty && (td.MaxQuantity === undefined || td.MaxQuantity >= ltmMinQty);
             }) || tierKey; 
        }
        for (const size in calculatedItems) {
            const itemData = calculatedItems[size];
            const quantity = itemData.quantity;
            if (quantity <= 0) continue; 
            let expectedBasePrice = 0;
            const pricingTierForLookup = ltmFeeApplies ? ltmReferenceTier : tierKey;
            if (sourcePrices[size] && sourcePrices[size][pricingTierForLookup] !== undefined) {
                expectedBasePrice = parseFloat(sourcePrices[size][pricingTierForLookup]);
            } else if (size === 'OSFA' && sourcePrices['OSFA'] && sourcePrices['OSFA'][pricingTierForLookup] !== undefined) {
                 expectedBasePrice = parseFloat(sourcePrices['OSFA'][pricingTierForLookup]); 
            } else {
                console.warn(`[ADD-TO-CART:VALIDATION] Could not find source price for Size: ${size}, Tier: ${pricingTierForLookup}. Validation might be inaccurate.`);
                expectedBasePrice = itemData.baseUnitPrice; 
            }
            expectedBasePrice = isNaN(expectedBasePrice) ? 0 : expectedBasePrice;
            let expectedDisplayPrice = expectedBasePrice + (ltmFeeApplies ? (ltmFeePerItem || 0) : 0);
            const actualDisplayPrice = itemData.displayUnitPrice;
            const tolerance = 0.011; 
            const priceDifference = Math.abs(expectedDisplayPrice - actualDisplayPrice);
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

    async function handleAddToCart() { 
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

        const pageEmbType = detectEmbellishmentType(); 

        if (window.NWCACart && typeof window.NWCACart.getEmbellishmentType === 'function' && typeof window.NWCACart.getCartItems === 'function') {
            const cartEmbType = window.NWCACart.getEmbellishmentType();
            const activeCartItems = window.NWCACart.getCartItems('Active');
            const isCartEmpty = !activeCartItems || activeCartItems.length === 0;

            console.log(`[ADD-TO-CART] Page Embellishment Type: ${pageEmbType}, Cart Embellishment Type: ${cartEmbType}, Cart Empty: ${isCartEmpty}`);

            if (cartEmbType && cartEmbType !== pageEmbType && !isCartEmpty) {
                if (confirm(`Your cart contains items with a different embellishment type ('${cartEmbType.replace(/-/g, ' ')}'). Adding this '${pageEmbType.replace(/-/g, ' ')}' item will clear your current cart. Proceed?`)) {
                    console.log("[ADD-TO-CART] User confirmed to clear cart.");
                    if (typeof window.NWCACart.clearCart === 'function') {
                        await window.NWCACart.clearCart(); 
                        console.log("[ADD-TO-CART] Cart cleared.");
                        if (typeof window.NWCACart.setEmbellishmentType === 'function') {
                            window.NWCACart.setEmbellishmentType(pageEmbType);
                            console.log(`[ADD-TO-CART] Cart embellishment type set to ${pageEmbType}.`);
                        } else {
                            console.warn("[ADD-TO-CART] NWCACart.setEmbellishmentType not available after clear.");
                        }
                        window.cartContents = await fetchCartContents(); 
                        updateCartTotal(); 
                    } else {
                        console.error("[ADD-TO-CART] NWCACart.clearCart function not available. Cannot proceed.");
                        alert("Error: Could not clear cart. Please manage your cart manually or contact support.");
                        if (addToCartButton) { addToCartButton.textContent = addToCartButton._originalText || 'Add to Cart'; addToCartButton.disabled = false; }
                        return;
                    }
                } else {
                    console.log("[ADD-TO-CART] User cancelled cart clearing. Aborting add to cart.");
                    if (addToCartButton) { addToCartButton.textContent = addToCartButton._originalText || 'Add to Cart'; addToCartButton.disabled = false; }
                    return;
                }
            } else if (isCartEmpty && typeof window.NWCACart.setEmbellishmentType === 'function') {
                window.NWCACart.setEmbellishmentType(pageEmbType);
                console.log(`[ADD-TO-CART] Cart was empty. Cart embellishment type set to ${pageEmbType}.`);
            }
        } else {
            console.warn("[ADD-TO-CART] NWCACart.getEmbellishmentType or NWCACart.getCartItems not available for embellishment type check.");
        }


        if (!window.cartContents) { 
            console.log("[ADD-TO-CART] Cart contents not available, fetching before adding...");
            try {
                window.cartContents = await fetchCartContents();
            } catch (error) {
                console.error("[ADD-TO-CART] Error fetching cart contents before add:", error);
                alert("Could not verify cart contents. Please try adding again.");
                if (addToCartButton) { addToCartButton.textContent = addToCartButton._originalText || 'Add to Cart'; addToCartButton.disabled = false; }
                return;
            }
        }

        console.log("[ADD-TO-CART] Step 2: Forcing price recalculation...");
        updateCartTotal(); 
        console.log("[ADD-TO-CART] Step 2: Price recalculation complete. Checking window.cartItemData:", JSON.parse(JSON.stringify(window.cartItemData || {})));
        if (!window.cartItemData || !window.cartItemData.items) {
             console.error("[ADD-TO-CART] Price calculation failed or window.cartItemData is invalid before add. Aborting.");
             alert("Could not calculate final prices. Please refresh and try again.");
              if (addToCartButton) { addToCartButton.textContent = addToCartButton._originalText || 'Add to Cart'; addToCartButton.disabled = false; }
             return;
        }
        console.log("[ADD-TO-CART] Step 2: window.cartItemData seems valid.");
        console.log("[ADD-TO-CART] Step 3: Starting price validation...");
        let pricesAreValid = false;
        try {
            pricesAreValid = validatePricesBeforeAddingToCart(); 
        } catch (validationError) {
            console.error("[ADD-TO-CART] CRITICAL ERROR during price validation:", validationError);
            alert("A critical error occurred during price validation. Please refresh.");
            if (addToCartButton) { addToCartButton.textContent = addToCartButton._originalText || 'Add to Cart'; addToCartButton.disabled = false; }
            return;
        }
        console.log(`[ADD-TO-CART] Step 3: Price validation result: ${pricesAreValid}`);
        if (!pricesAreValid) {
            console.log("[ADD-TO-CART] Step 3: Price validation failed. Aborting add to cart.");
            if (addToCartButton) { addToCartButton.textContent = addToCartButton._originalText || 'Add to Cart'; addToCartButton.disabled = false; }
            return;
        }
        console.log("[ADD-TO-CART] Step 3: Price validation passed.");
        console.log("[ADD-TO-CART] Step 4: Collecting final product data...");
        const {
            tierKey, ltmFeeApplies, totalQuantity, items: calculatedItems,
            ltmFeeTotal, ltmFeePerItem, combinedQuantity, cartQuantity, baseUnitPrices,
        } = window.cartItemData;

        console.log(`[ADD-TO-CART] Handle Add: Using Tier: ${tierKey}, LTM Applies: ${ltmFeeApplies} from validated cartItemData`);
        if (totalQuantity === 0) {
            alert('Please select at least one size and quantity.');
            if (addToCartButton) { addToCartButton.textContent = addToCartButton._originalText || 'Add to Cart'; addToCartButton.disabled = false; }
            return;
        }
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
         const styleNumber = NWCAUtils.getUrlParameter('StyleNumber') || document.getElementById('product-style-number')?.value || 'UNKNOWN_STYLE';
         const colorCode = NWCAUtils.getUrlParameter('COLOR') || document.getElementById('product-color-code')?.value || 'UNKNOWN_COLOR';
        let specificImageUrl = '';
        
        let productTitle = '';
        
        const productTitleElement = document.getElementById('product-title-context');
        if (productTitleElement && productTitleElement.textContent) {
            productTitle = productTitleElement.textContent.trim();
            console.log('[ADD-TO-CART] Found product title from #product-title-context:', productTitle);
        } else {
            console.log('[ADD-TO-CART] Could not find #product-title-context element, using fallbacks');
            
            if (window.productContext && window.productContext.PRODUCT_TITLE) {
                productTitle = window.productContext.PRODUCT_TITLE;
                console.log("[ADD-TO-CART] Captured product title from window.productContext:", productTitle);
            } else {
                const titleSelectors = [
                    'h1.product-title', 'h2.product-title', '.product-name h1',
                    '#product-title', '.product-title', 'h1', 'title'
                ];
                
                for (const selector of titleSelectors) {
                    const titleElement = document.querySelector(selector);
                    if (titleElement && titleElement.textContent.trim()) {
                        productTitle = titleElement.textContent.trim();
                        console.log(`[ADD-TO-CART] Captured product title from ${selector}:`, productTitle);
                        break;
                    }
                }
                
                if (!productTitle) {
                    const style = NWCAUtils.getUrlParameter('StyleNumber') || document.getElementById('product-style-number')?.value;
                    const color = NWCAUtils.getUrlParameter('COLOR') || document.getElementById('product-color-code')?.value;
                    if (style && color) {
                        productTitle = `${style} - ${color}`;
                        console.log("[ADD-TO-CART] Created product title from style and color:", productTitle);
                    }
                }
            }
        }
        
        console.log(`[ADD-TO-CART:TITLE] Final product title: '${productTitle}'`);
        
        const productImageElement = document.getElementById('product-image');
        if (productImageElement && productImageElement.getAttribute('src')) {
            specificImageUrl = productImageElement.getAttribute('src');
            console.log("[ADD-TO-CART] Captured product image URL from #product-image:", specificImageUrl);
        } else {
            console.warn("[ADD-TO-CART:IMAGE] No product image URL found in #product-image element or src is empty");
            
            if (window.productContext) {
                const contextImageProps = ['IMAGE_URL_FRONT', 'FRONT_MODEL', 'imageUrl', 'ImageURL'];
                for (const prop of contextImageProps) {
                    if (window.productContext[prop]) {
                        specificImageUrl = window.productContext[prop];
                        console.log(`[ADD-TO-CART:IMAGE] Found image URL in window.productContext.${prop}:`, specificImageUrl);
                        break;
                    }
                }
            }
            
            if (!specificImageUrl) {
                const altSelectors = [
                    '.product-image', 'img.product', '.main-product-image',
                    '.product-thumbnail', '#main-product-image', 'img[alt*="product"]',
                    '#ProductImg', '.product-single__photo', '.featured-image'
                ];
                
                const altImages = document.querySelectorAll(altSelectors.join(', '));
                
                if (altImages.length > 0) {
                    for (let i = 0; i < altImages.length; i++) {
                        const altUrl = altImages[i].src || altImages[i].getAttribute('src');
                        if (altUrl) {
                            specificImageUrl = altUrl;
                            console.log(`[ADD-TO-CART:IMAGE] Found alternative image from selector at index ${i}:`, altUrl);
                            break; 
                        }
                    }
                }
                
                if (!specificImageUrl) {
                    const style = NWCAUtils.getUrlParameter('StyleNumber') || document.getElementById('product-style-number')?.value;
                    const color = NWCAUtils.getUrlParameter('COLOR') || document.getElementById('product-color-code')?.value;

                    if (style && color) {
                        specificImageUrl = `https://cdnm.sanmar.com/imglib/mresjpg/2014/f19/${style}_${color.toLowerCase()}_model_front_082010.jpg`;
                        console.log(`[ADD-TO-CART:IMAGE] Constructed SanMar URL as fallback:`, specificImageUrl);
                    }
                }
            }
        }
        
        console.log(`[ADD-TO-CART:IMAGE] Final image URL details - Type: ${typeof specificImageUrl}, Length: ${specificImageUrl.length}, Value: '${specificImageUrl}'`);
        const currentPageUrl = window.location.href;
        const currentPagePath = window.location.pathname;
        if (!productTitle) {
            console.warn("[ADD-TO-CART] No product title found, creating one from style and color");
            productTitle = `${styleNumber} - ${colorCode}`;
        }
        console.log("[ADD-TO-CART] Setting PRODUCT_TITLE before adding to cart:", productTitle);

        let embellishmentOptionsForCart = {};
        if (pageEmbType === 'screen-print' && window.cartItemData) {
            const screenPrintConfig = window.screenPrintAdapter && typeof window.screenPrintAdapter.getSelectedConfiguration === 'function' ?
                                      window.screenPrintAdapter.getSelectedConfiguration() : null;

            if (screenPrintConfig && screenPrintConfig.selectedColorCount) {
                embellishmentOptionsForCart.numberOfColors = parseInt(screenPrintConfig.selectedColorCount);
            } else if (window.cartItemData.numberOfColors) { // Fallback if adapter doesn't provide it but calculator did (older versions)
                embellishmentOptionsForCart.numberOfColors = window.cartItemData.numberOfColors;
            } else {
                 // Attempt to get from the color select dropdown directly as a last resort
                const colorSelectDropdown = document.getElementById('color-select');
                if (colorSelectDropdown && colorSelectDropdown.value) {
                    embellishmentOptionsForCart.numberOfColors = parseInt(colorSelectDropdown.value);
                }
            }
            
            // Fees from the calculator result (window.cartItemData)
            embellishmentOptionsForCart.setupFee = typeof window.cartItemData.setupFee === 'number' ? window.cartItemData.setupFee : 0;
            embellishmentOptionsForCart.flashCharge = typeof window.cartItemData.flashCharge === 'number' ? window.cartItemData.flashCharge : 0;
            
            // LTM details
            embellishmentOptionsForCart.ltmFeeApplies = window.cartItemData.ltmFeeApplies || false;
            embellishmentOptionsForCart.ltmFeeTotal = window.cartItemData.ltmFeeTotal || 0;

            // If primary/additional location details are still part of cartItemData (they might not be with calc v2.0)
            // These might need to be sourced differently if they represent complex objects.
            // For now, let's assume they are simple or not strictly needed by NWCACart for screen-print in this exact structure.
            // If NWCACart needs detailed breakdown of primary vs additional costs, that's a deeper integration.
            // embellishmentOptionsForCart.primaryLocationDetails = window.cartItemData.primaryLocation;
            // embellishmentOptionsForCart.additionalLocationDetails = window.cartItemData.additionalLocation;

            console.log("[ADD-TO-CART] Populated screen print details into embellishmentOptionsForCart:", JSON.parse(JSON.stringify(embellishmentOptionsForCart)));
        }

        const stitchCountSelect = document.getElementById('client-stitch-count-select');
        if (stitchCountSelect && stitchCountSelect.value && pageEmbType === 'cap-embroidery') {
            const selectedStitchCount = stitchCountSelect.value;
            embellishmentOptionsForCart.stitchCount = selectedStitchCount;
            console.log(`[ADD-TO-CART:CAP-EMB] Added stitchCount to embellishmentOptionsForCart: ${selectedStitchCount}`);
        }
        // TODO: Add UI-driven options for other embellishment types (embroidery, DTG, DTF) here if add-to-cart.js manages their UI elements.
        // Example:
        // if (pageEmbType === 'embroidery') {
        //     const embroideryLocation = document.getElementById('embroidery-location-select')?.value;
        //     if (embroideryLocation) embellishmentOptionsForCart.location = embroideryLocation;
        // }
        
        let productData = {
            styleNumber: styleNumber, color: colorCode, embellishmentType: pageEmbType,
            // pricingTier, ltmFeeApplied, totalQuantity are part of pricingInfo or derivable, not directly on productData for NWCACart
            sizes: sizesForCart,
            imageUrl: specificImageUrl,
            PRODUCT_TITLE: productTitle,
            productTitle: productTitle, // Keep for potential local use, NWCACart uses PRODUCT_TITLE
            sourceUrl: currentPageUrl,
            sourcePage: currentPagePath,
            embellishmentOptions: embellishmentOptionsForCart, // Key change: storing detailed options here
            pricingInfo: {
                tierKey: tierKey,
                ltmFeeApplies: ltmFeeApplies,
                ltmFeeTotal: ltmFeeTotal,
                ltmFeePerItem: ltmFeePerItem,
                combinedQuantity: combinedQuantity,
                existingCartQuantity: cartQuantity, // This is existing items of same type in cart
                baseUnitPrices: baseUnitPrices, // Base unit prices for each size at the determined tier
                
                // Specific fees from calculator, ensuring they are numbers
                setupFee: (typeof window.cartItemData.setupFee === 'number') ? window.cartItemData.setupFee : 0,
                flashCharge: (typeof window.cartItemData.flashCharge === 'number') ? window.cartItemData.flashCharge : 0,
                
                // Number of colors from embellishmentOptions if available
                numberOfColors: embellishmentOptionsForCart.numberOfColors || null
                // primaryLocation and additionalLocation details might be too complex for simple pricingInfo
                // and are better suited for embellishmentOptions if needed by the cart in detail.
            }
        };
        for (const key in productData.pricingInfo) {
            if (productData.pricingInfo[key] === undefined) {
                delete productData.pricingInfo[key];
            }
        }
        
        console.log("[ADD-TO-CART:FINAL] Product data for cart:", {
            embellishmentOptions: JSON.parse(JSON.stringify(productData.embellishmentOptions)), // Log the crucial part
            imageUrl: specificImageUrl ? `'${specificImageUrl}'` : "MISSING",
            productTitle: productTitle ? `'${productTitle}'` : "MISSING",
            PRODUCT_TITLE: productData.PRODUCT_TITLE ? `'${productData.PRODUCT_TITLE}'` : "MISSING",
            pricingInfo: JSON.parse(JSON.stringify(productData.pricingInfo))
        });
        
        if (!productData.PRODUCT_TITLE) {
            console.warn("[ADD-TO-CART:FINAL] PRODUCT_TITLE is missing, explicitly setting it");
            productData.PRODUCT_TITLE = productTitle || `${styleNumber} - ${colorCode}`;
            console.log("[ADD-TO-CART:FINAL] Set PRODUCT_TITLE to:", productData.PRODUCT_TITLE);
        }
        console.log("[ADD-TO-CART] Storing source URL with item:", currentPageUrl);
        if (!productData.styleNumber || productData.styleNumber === 'UNKNOWN_STYLE' || !productData.color || productData.color === 'UNKNOWN_COLOR' || productData.sizes.length === 0) {
            console.error("[ADD-TO-CART] Invalid final product data:", productData);
            alert('Error: Required product style or color information is missing.');
             if (addToCartButton) { addToCartButton.textContent = addToCartButton._originalText || 'Add to Cart'; addToCartButton.disabled = false; }
            return;
        }
        if (window.NWCACart && typeof window.NWCACart.addToCart === 'function') {
            if (addToCartButton) addToCartButton.textContent = 'Adding...';
            console.log("[ADD-TO-CART] Step 5: Preparing to call NWCACart.addToCart with data:", JSON.parse(JSON.stringify(productData)));
            
            const verifyPayload = (data) => {
                console.log("[ADD-TO-CART:TEST] Verifying payload structure before sending to API:");
                console.log("[ADD-TO-CART:TEST] PRODUCT_TITLE present:", !!data.PRODUCT_TITLE);
                console.log("[ADD-TO-CART:TEST] PRODUCT_TITLE value:", data.PRODUCT_TITLE);
                
                if (!data.PRODUCT_TITLE) {
                    console.warn("[ADD-TO-CART:TEST] PRODUCT_TITLE missing from payload, adding it");
                    data.PRODUCT_TITLE = data.productTitle || `${data.styleNumber} - ${data.color}`;
                    console.log("[ADD-TO-CART:TEST] Added PRODUCT_TITLE:", data.PRODUCT_TITLE);
                }
                
                console.log("[ADD-TO-CART:TEST] Image URL being sent:", data.imageUrl || "MISSING");
                console.log("[ADD-TO-CART:TEST] PRODUCT_TITLE being sent:", data.PRODUCT_TITLE || "MISSING");
                
                return data;
            };
            
            window.NWCACart.addToCart(verifyPayload(productData))
                .then(result => {
                    console.log("[ADD-TO-CART] Step 5: NWCACart.addToCart call completed. Result:", result); 
                    if (result && result.success) {
                        console.log("[ADD-TO-CART] Step 5: Add to cart reported SUCCESS."); 
                        showSuccessWithImageAndTitle(productData);
                        return fetchCartContents(); 
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
                     updateCartTotal(); 
                     if (window.NWCACart?.recalculatePrices) {
                         console.log("[ADD-TO-CART] Triggering price recalculation after successful add");
                         window.NWCACart.recalculatePrices(pageEmbType).catch(err => console.error("Error during post-add recalculation:", err));
                     }
                     window.dispatchEvent(new CustomEvent('cartItemAdded', { detail: { embellishmentType: pageEmbType, success: true } }));
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

    let isInitializing = false;
    let uiInitialized = false; 

    function handlePricingDataReady(event) {
         if (uiInitialized) return;
         console.log("[ADD-TO-CART] 'pricingDataLoaded' event received or data found. Checking NWCACart status...", event?.detail);
         
         if (window.NWCACart && window.NWCACart.isInitialized) {
             console.log("[ADD-TO-CART] NWCACart is already initialized. Proceeding with UI initialization.");
             initializeUIAndListeners();
         } else {
             console.log("[ADD-TO-CART] NWCACart not yet initialized. Waiting for nwcacartInitialized event.");
             document.addEventListener('nwcacartInitialized', function onNwcacartReadyForAddToCart() {
                 document.removeEventListener('nwcacartInitialized', onNwcacartReadyForAddToCart);
                 console.log("[ADD-TO-CART] NWCACart ready event received. Proceeding with UI initialization.");
                 initializeUIAndListeners();
             });
         }
    }

    function initializeUIAndListeners() {
         if (uiInitialized) { console.log("[ADD-TO-CART] UI and Listeners already initialized."); return; }
         
         const currentEmbType = detectEmbellishmentType();
         // For screen-print, nwcaPricingData might not be the primary source if screenPrintAdapter handles its own data.
         // However, uniqueSizes might still come from a shared source or be set by the adapter.
         if (currentEmbType !== 'screen-print' && 
             (!window.nwcaPricingData ||
             !window.nwcaPricingData.prices ||
             !window.nwcaPricingData.uniqueSizes ||
             window.nwcaPricingData.uniqueSizes.length === 0)) {
             console.error("[ADD-TO-CART:INIT-UI] Essential pricing data (nwcaPricingData) missing for non-screen-print. Aborting UI initialization. Data:", {
                nwcaPricingData: JSON.stringify(window.nwcaPricingData || {})
             });
             handlePricingDataError({ detail: { message: 'Pricing data missing or incomplete during UI initialization.' } });
             return;
         } else if (currentEmbType === 'screen-print' && (!window.screenPrintAdapter || !window.screenPrintAdapter.isInitialized())) {
            // For screen-print, we might depend on the adapter being ready.
            // Or, if uniqueSizes are still expected on window.nwcaPricingData even for screen-print:
            if (!window.nwcaPricingData || !window.nwcaPricingData.uniqueSizes || window.nwcaPricingData.uniqueSizes.length === 0) {
                 console.error("[ADD-TO-CART:INIT-UI] Essential uniqueSizes data missing for screen-print. Aborting UI initialization. Data:", {
                    nwcaPricingData: JSON.stringify(window.nwcaPricingData || {})
                 });
                 handlePricingDataError({ detail: { message: 'Size data missing or incomplete for screen print UI initialization.' } });
                 return;
            }
             console.log("[ADD-TO-CART:INIT-UI] Screen print page, proceeding with UI initialization, assuming adapter will provide full pricing later or uniqueSizes are available.");
         }


         uiInitialized = true;
         console.log("[ADD-TO-CART:INIT-UI] Proceeding with UI initialization. NWCACart is initialized and ready.");
         syncSizesWithPricingMatrix();

        const buttonElement = document.getElementById('add-to-cart-button');
        console.log("[ADD-TO-CART:INIT-UI] Attempting to find #add-to-cart-button. Found:", buttonElement);

        if (buttonElement) {
            if (buttonElement.dataset.listenerAttached !== 'true') {
                console.log("[ADD-TO-CART:INIT-UI] #add-to-cart-button found, listener not yet attached. Proceeding to attach.");
                const buttonParent = buttonElement.parentNode;
                const newButtonInstance = buttonElement.cloneNode(true);
                
                console.log("[ADD-TO-CART:INIT-UI] About to attach 'click' event listener to the new button instance.");
                newButtonInstance.addEventListener('click', handleAddToCart);
                newButtonInstance.dataset.listenerAttached = 'true'; 
                console.log("[ADD-TO-CART:INIT-UI] 'click' event listener for handleAddToCart supposedly attached.");
                
                if (buttonParent) {
                    buttonParent.replaceChild(newButtonInstance, buttonElement);
                    console.log("[ADD-TO-CART:INIT-UI] Add to Cart button listener attached by replacing node. New button is now in DOM.");
                } else {
                    console.warn("[ADD-TO-CART:INIT-UI] Add to Cart button parentNode not found. Listener attached to cloned button, but it might not be in DOM correctly.");
                }
            } else {
                console.log("[ADD-TO-CART:INIT-UI] Add to Cart button listener was already marked as attached.");
            }
        } else {
            console.warn("[ADD-TO-CART:INIT-UI] Add to Cart button (#add-to-cart-button) not found during UI initialization phase.");
        }
 
         updateCartTotal(); 
         attachQuantityChangeListeners();
         if (window.PricingPageUI?.handleMobileAdjustments) {
             window.PricingPageUI.handleMobileAdjustments();
             if (!window.hasMobileResizeListener) {
                  window.addEventListener('resize', window.PricingPageUI.handleMobileAdjustments);
                  window.hasMobileResizeListener = true;
             }
         } else {
              console.error("[ADD-TO-CART] PricingPageUI.handleMobileAdjustments not available.");
         }
         console.log("[ADD-TO-CART] UI and Listeners Initialized.");
         isInitializing = false; 
         window.addToCartInitialized = true; 
    }

    function initialize() {
        if (isInitializing || window.addToCartInitialized) {
            console.log("[ADD-TO-CART] Initialization already in progress or completed.");
            return;
        }
        isInitializing = true;
        console.log("[ADD-TO-CART] DOM ready, starting initialization...");
        
        function setupWhenDataReady(cartContents) {
            window.cartContents = cartContents;
            console.log("[ADD-TO-CART] Initial cart contents fetched.");
            console.log("[ADD-TO-CART] Checking for pricing data / adapter readiness...");

            const currentEmbType = detectEmbellishmentType();
            let dataReadyForInit = false;

            if (currentEmbType === 'screen-print') {
                // For screen print, we might primarily wait for the adapter to be ready,
                // and ensure uniqueSizes are available (either from adapter or nwcaPricingData)
                if (window.screenPrintAdapter && typeof window.screenPrintAdapter.isInitialized === 'function' && window.screenPrintAdapter.isInitialized()) {
                     if (window.nwcaPricingData && window.nwcaPricingData.uniqueSizes && window.nwcaPricingData.uniqueSizes.length > 0) {
                        dataReadyForInit = true;
                        console.log("[ADD-TO-CART] Screen print adapter initialized and uniqueSizes available. Proceeding.");
                     } else if (window.screenPrintAdapter.getUniqueSizes && window.screenPrintAdapter.getUniqueSizes().length > 0) {
                        dataReadyForInit = true;
                         console.log("[ADD-TO-CART] Screen print adapter initialized and provides uniqueSizes. Proceeding.");
                     } else {
                         console.log("[ADD-TO-CART] Screen print adapter initialized, but uniqueSizes not found. Waiting for 'pricingDataLoaded' or 'screenPrintAdapterReady'.");
                     }
                } else {
                    console.log("[ADD-TO-CART] Screen print adapter not yet initialized. Waiting for 'screenPrintAdapterReady' or 'pricingDataLoaded'.");
                }
            } else {
                // For other types, rely on nwcaPricingData and availableSizesFromTable
                if (window.nwcaPricingData && window.availableSizesFromTable) { // Or just window.nwcaPricingData.uniqueSizes
                    dataReadyForInit = true;
                    console.log("[ADD-TO-CART] Pricing data (nwcaPricingData/availableSizesFromTable) already available for non-screen-print. Proceeding.");
                } else {
                    console.log("[ADD-TO-CART] Pricing data not yet available for non-screen-print. Waiting for 'pricingDataLoaded'.");
                }
            }

            if (dataReadyForInit) {
                 setTimeout(handlePricingDataReady, 0); // Call with a timeout to ensure event loop clears
            } else {
                 console.log("[ADD-TO-CART] Data not fully ready. Attaching listeners: 'pricingDataLoaded', 'screenPrintAdapterReady'.");
                 window.addEventListener('pricingDataLoaded', handlePricingDataReady, { once: true });
                 window.addEventListener('screenPrintAdapterReady', handlePricingDataReady, { once: true }); // If adapter dispatches this
                 window.addEventListener('pricingDataError', handlePricingDataError, { once: true });
            }
        }
        
        fetchCartContents().then(setupWhenDataReady).catch(error => {
            console.error("[ADD-TO-CART] Initialization failed during cart fetch:", error);
            const errorDisplay = document.getElementById('cart-error-display');
            if(errorDisplay) errorDisplay.textContent = "Error loading cart data. Pricing may be inaccurate.";
            isInitializing = false;
        });
    }

    function handlePricingDataError(event) {
        if (uiInitialized) return;
        console.error("[ADD-TO-CART] Received 'pricingDataError' event:", event?.detail?.message);
        const quantitySection = document.getElementById('quantity-section') || document.getElementById('size-quantity-grid-container') || document.getElementById('quantity-matrix');
        if (quantitySection) {
            quantitySection.innerHTML = `<p style="color: red; font-weight: bold; padding: 10px; border: 1px solid red; background-color: #ffeeee;">Error: Could not load pricing data. ${event?.detail?.message || 'Pricing table not found or failed to load.'}</p>`;
        }
         isInitializing = false;
         uiInitialized = true; 
         window.addToCartInitialized = true; 
    }

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
            updateCartTotal(); 
        }
    }

    function syncSizesWithPricingMatrix() {
        console.log("[ADD-TO-CART] Syncing sizes with pricing matrix...");
        let sizesToUse = [];
        let sourceOfSizes = "";
        const currentEmbType = detectEmbellishmentType();

        if (currentEmbType === 'screen-print' && window.screenPrintAdapter && typeof window.screenPrintAdapter.getUniqueSizes === 'function') {
            sizesToUse = window.screenPrintAdapter.getUniqueSizes();
            sourceOfSizes = "screenPrintAdapter.getUniqueSizes()";
            // If adapter doesn't provide sizes, try nwcaPricingData as a fallback even for screen-print
            if (!sizesToUse || sizesToUse.length === 0) {
                if (window.nwcaPricingData && window.nwcaPricingData.uniqueSizes && window.nwcaPricingData.uniqueSizes.length > 0) {
                    sizesToUse = window.nwcaPricingData.uniqueSizes;
                    sourceOfSizes = "nwcaPricingData.uniqueSizes (fallback for screen-print)";
                }
            }
        } else if (window.nwcaPricingData && window.nwcaPricingData.uniqueSizes && window.nwcaPricingData.uniqueSizes.length > 0) {
            sizesToUse = window.nwcaPricingData.uniqueSizes;
            sourceOfSizes = "nwcaPricingData.uniqueSizes";
        } else if (window.availableSizesFromTable && window.availableSizesFromTable.length > 0) { // Older fallback
            sizesToUse = window.availableSizesFromTable;
            sourceOfSizes = "availableSizesFromTable";
        }


        if (sizesToUse.length === 0) {
            console.error("[ADD-TO-CART] Cannot sync sizes: No sizes available from any source.");
            const quantitySection = document.getElementById('quantity-section') || document.getElementById('size-quantity-grid-container') || document.getElementById('quantity-matrix');
            if (quantitySection) {
                if (!quantitySection.querySelector('.error-message')) { 
                    quantitySection.innerHTML = '<p class="error-message" style="color: red; font-weight: bold; padding: 10px; border: 1px solid red; background-color: #ffeeee;">Error: Could not load size information.</p>';
                }
            }
            return;
        }
        console.log(`[ADD-TO-CART] Sizes to use for UI (from ${sourceOfSizes}):`, sizesToUse);

        const sizeQuantityGrid = document.getElementById('size-quantity-grid');
        const existingRows = sizeQuantityGrid ? sizeQuantityGrid.querySelectorAll('.size-quantity-row .quantity-input') : null;

        let uiAlreadyExists = existingRows && existingRows.length > 0 && existingRows.length === sizesToUse.length;

        if (uiAlreadyExists) {
            console.log("[ADD-TO-CART] Quantity input UI elements seem to already exist. Attaching listeners.");
            const gridContainerParent = document.getElementById('size-quantity-grid-container');
            if (gridContainerParent) {
                gridContainerParent.style.display = 'block'; 
                 console.log("[ADD-TO-CART] Ensured #size-quantity-grid-container is visible (UI already existed).");
                const matrixContainer = document.getElementById('quantity-matrix'); 
                if(matrixContainer) matrixContainer.style.display = 'none';
            }
            attachQuantityChangeListeners(); 
        } else {
            console.log("[ADD-TO-CART] Quantity input UI elements do not exist or mismatch. Attempting to create them via ProductQuantityUI.");
            const useGrid = window.PricingPageUI?.determineLayoutPreference ? window.PricingPageUI.determineLayoutPreference() : false;
            let uiCreatedByThisFunction = false;
            if (useGrid) {
                console.log("[ADD-TO-CART] Using grid layout for quantity inputs.");
                if (window.ProductQuantityUI && typeof window.ProductQuantityUI.createSizeQuantityGrid === 'function') {
                    uiCreatedByThisFunction = window.ProductQuantityUI.createSizeQuantityGrid(sizesToUse);
                    const matrixContainer = document.getElementById('quantity-matrix');
                    if (matrixContainer) matrixContainer.style.display = 'none';
                } else {
                    console.error("[ADD-TO-CART] ProductQuantityUI.createSizeQuantityGrid function not found!");
                }
            } else {
                console.log("[ADD-TO-CART] Using matrix layout for quantity inputs.");
                if (window.ProductQuantityUI && typeof window.ProductQuantityUI.createQuantityMatrix === 'function') {
                    uiCreatedByThisFunction = window.ProductQuantityUI.createQuantityMatrix(sizesToUse);
                    const gridContainer = document.getElementById('size-quantity-grid-container');
                    if (gridContainer) gridContainer.style.display = 'none';
                } else {
                    console.error("[ADD-TO-CART] ProductQuantityUI.createQuantityMatrix function not found!");
                }
            }

            if (uiCreatedByThisFunction) {
                attachQuantityChangeListeners();
            } else {
                console.error("[ADD-TO-CART] Failed to create quantity UI in syncSizesWithPricingMatrix.");
            }
        }
    }

    try {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initialize);
        } else {
            initialize(); 
        }
    } catch (error) {
        console.error("[ADD-TO-CART] Critical error during initialization setup:", error);
    }
    // Function to show success notification with product image and title
    function showSuccessWithImageAndTitle(productData) {
        console.log("[ADD-TO-CART] Showing success notification with image and title");
        console.log(`[ADD-TO-CART:SUCCESS] Product data:`, {
            imageUrl: productData.imageUrl || "none",
            productTitle: productData.PRODUCT_TITLE || "none"
        });
        
        const existingNotification = document.querySelector('.success-notification-modal');
        if (existingNotification) {
            existingNotification.remove();
        }
        
        const notification = document.createElement('div');
        notification.className = 'success-notification-modal';
        notification.style.position = 'fixed';
        notification.style.top = '50%';
        notification.style.left = '50%';
        notification.style.transform = 'translate(-50%, -50%)';
        notification.style.backgroundColor = 'white';
        notification.style.padding = '20px';
        notification.style.borderRadius = '8px';
        notification.style.boxShadow = '0 4px 20px rgba(0,0,0,0.2)';
        notification.style.zIndex = '1050';
        notification.style.minWidth = '300px';
        notification.style.maxWidth = '90%';
        notification.style.display = 'flex';
        notification.style.flexDirection = 'column';
        notification.style.alignItems = 'center';
        
        const header = document.createElement('h4');
        header.textContent = 'Item Added to Cart';
        header.style.color = '#28a745';
        header.style.marginBottom = '15px';
        notification.appendChild(header);
        
        const imageContainer = document.createElement('div');
        imageContainer.style.marginBottom = '15px';
        imageContainer.style.width = '100%';
        imageContainer.style.textAlign = 'center';
        
        if (productData.imageUrl) {
            console.log(`[ADD-TO-CART:SUCCESS] Using image URL in modal: '${productData.imageUrl}'`);
            
            const image = document.createElement('img');
            image.src = productData.imageUrl;
            image.alt = `${productData.styleNumber} - ${productData.color}`;
            image.className = 'product-thumbnail';
            image.style.maxWidth = '150px';
            image.style.maxHeight = '150px';
            image.style.objectFit = 'contain';
            image.style.border = '1px solid #ddd';
            image.style.borderRadius = '4px';
            image.style.padding = '5px';
            
            image.onerror = function() {
                console.warn(`[ADD-TO-CART:SUCCESS] Image failed to load: '${productData.imageUrl}'`);
                this.src = ''; 
                this.style.display = 'none';
                createFallbackImage(imageContainer, productData);
            };
            
            imageContainer.appendChild(image);
        } else {
            console.warn(`[ADD-TO-CART:SUCCESS] No image URL available for product ${productData.styleNumber}`);
            createFallbackImage(imageContainer, productData);
        }
        
        notification.appendChild(imageContainer);
        
        function createFallbackImage(container, data) {
            const fallback = document.createElement('div');
            fallback.className = 'image-fallback';
            fallback.style.width = '150px';
            fallback.style.height = '150px';
            fallback.style.margin = '0 auto';
            fallback.style.backgroundColor = '#f8f9fa';
            fallback.style.display = 'flex';
            fallback.style.alignItems = 'center';
            fallback.style.justifyContent = 'center';
            fallback.style.border = '1px solid #ddd';
            fallback.style.borderRadius = '4px';
            fallback.style.padding = '10px';
            fallback.style.textAlign = 'center';
            
            const content = document.createElement('div');
            content.innerHTML = `
                <div style="font-weight:bold;margin-bottom:5px;">${data.styleNumber}</div>
                <div>${data.color}</div>
            `;
            fallback.appendChild(content);
            container.appendChild(fallback);
        }
        
        const details = document.createElement('div');
        details.style.marginBottom = '15px';
        details.style.width = '100%';
        details.style.textAlign = 'center';
        
        const productName = document.createElement('p');
        productName.textContent = productData.PRODUCT_TITLE || `${productData.styleNumber} - ${productData.color}`;
        productName.style.fontWeight = 'bold';
        productName.style.marginBottom = '5px';
        details.appendChild(productName);
        
        if (productData.PRODUCT_TITLE && productData.PRODUCT_TITLE !== `${productData.styleNumber} - ${productData.color}`) {
            const styleColor = document.createElement('p');
            styleColor.textContent = `${productData.styleNumber} - ${productData.color}`;
            styleColor.style.fontSize = '0.9em';
            styleColor.style.color = '#666';
            styleColor.style.marginBottom = '5px';
            details.appendChild(styleColor);
        }
        
        const embType = document.createElement('p');
        embType.textContent = `Embellishment: ${productData.embellishmentType.replace(/-/g, ' ')}`;
        embType.style.fontSize = '0.9em';
        embType.style.marginBottom = '5px';
        details.appendChild(embType);
        
        const qtyAdded = document.createElement('p');
        qtyAdded.textContent = `Quantity: ${productData.totalQuantity}`;
        qtyAdded.style.fontSize = '0.9em';
        details.appendChild(qtyAdded);
        
        notification.appendChild(details);
        
        const buttonContainer = document.createElement('div');
        buttonContainer.style.display = 'flex';
        buttonContainer.style.justifyContent = 'space-between';
        buttonContainer.style.width = '100%';
        buttonContainer.style.marginTop = '10px';
        
        const viewCartBtn = document.createElement('button');
        viewCartBtn.textContent = 'View Cart';
        viewCartBtn.style.backgroundColor = '#0056b3';
        viewCartBtn.style.color = 'white';
        viewCartBtn.style.border = 'none';
        viewCartBtn.style.borderRadius = '4px';
        viewCartBtn.style.padding = '8px 16px';
        viewCartBtn.style.cursor = 'pointer';
        viewCartBtn.style.marginRight = '10px';
        viewCartBtn.addEventListener('click', () => {
            notification.remove();
            window.location.href = '/cart.html';
        });
        
        const closeBtn = document.createElement('button');
        closeBtn.textContent = 'Continue Shopping';
        closeBtn.style.backgroundColor = '#6c757d';
        closeBtn.style.color = 'white';
        closeBtn.style.border = 'none';
        closeBtn.style.borderRadius = '4px';
        closeBtn.style.padding = '8px 16px';
        closeBtn.style.cursor = 'pointer';
        closeBtn.addEventListener('click', () => {
            notification.remove();
        });
        
        buttonContainer.appendChild(viewCartBtn);
        buttonContainer.appendChild(closeBtn);
        notification.appendChild(buttonContainer);
        
        const overlay = document.createElement('div');
        overlay.style.position = 'fixed';
        overlay.style.top = '0';
        overlay.style.left = '0';
        overlay.style.width = '100%';
        overlay.style.height = '100%';
        overlay.style.backgroundColor = 'rgba(0,0,0,0.5)';
        overlay.style.zIndex = '1040';
        overlay.addEventListener('click', () => {
            notification.remove();
            overlay.remove();
        });
        
        document.body.appendChild(overlay);
        document.body.appendChild(notification);
        
        setTimeout(() => {
            if (document.body.contains(notification)) {
                notification.remove();
                overlay.remove();
            }
        }, 5000);
    }
})();