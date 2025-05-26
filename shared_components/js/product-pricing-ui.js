// product-pricing-ui.js - UI handling for product pricing pages

/**
 * Product Pricing UI Module for Northwest Custom Apparel
 * Handles dynamic interactions on product pricing pages like embroidery-pricing.html
 */
const NWCAProductPricingUI = (function() {
    'use strict';

    // DOM elements (will be populated in initialize)
    const elements = {
        // Product page specific elements
        pricingGrid: null,
        sizeQuantityInputs: [], // NodeList of all quantity inputs for sizes
        // Elements for dynamic price display per size (e.g., spans next to inputs)
        sizePriceDisplays: [],
        // Sticky cart summary elements
        stickyCartSummaryContainer: null,
        stickyTotalQuantityDisplay: null,
        stickyTotalPriceDisplay: null,
        stickyAddToCartButton: null,
        // Tier info display elements (within .pricing-tier-info)
        pricingTierInfoSection: null,
        dynamicPricingSummaryHeading: null,
        combinedItemsMessage: null,
        currentTierNameDisplay: null,
        currentTierPriceDisplay: null,
        tierProgressFill: null,
        tierProgressMessage: null,
        ltmExplanationSection: null,
        ltmPerItemDisplay: null,
        // Collapsible section toggles/containers
        collapsibleSectionToggles: [],
        collapsibleSections: [],
        // Additional Logo Pricing Table
        additionalLogoPricingGrid: null,
        additionalPricingLoading: null
    };

    // Configuration (example)
    const config = {
        ltmFee: 50.00, // Standard LTM fee amount
        ltmThreshold: 24, // Default LTM quantity threshold (e.g., less than 24 pieces)
        pricingTiers: [ // Example structure, actual tiers come from pricing data
            { minQty: 1, maxQty: 23, label: "1-23" },
            { minQty: 24, maxQty: 47, label: "24-47" },
            { minQty: 48, maxQty: 71, label: "48-71" },
            { minQty: 72, maxQty: Infinity, label: "72+" }
        ],
        // This would ideally be fetched or configured elsewhere
        productSpecificPricing: null // To store fetched pricing data for the current product
    };

    function debugProductUI(level, message, data = null) {
        console.log(`[ProductPricingUI-${level}] ${message}`, data);
    }

    /**
     * Initializes the product pricing UI enhancements.
     */
    async function initialize() {
        debugProductUI("INFO", "Initializing Product Pricing UI.");
        _cacheDOMElements();
        _bindEventListeners();
        // It's better to fetch pricing data first if possible, or have it passed.
        // The initial call to updateAllPricingDisplays will now be driven by add-to-cart.js
        // once it has all necessary data (cart, pricing, etc.)
        // await _initialRenderUpdates(); // REMOVED - Let add-to-cart.js trigger the first full update.
        
        debugProductUI("INFO", "NWCAProductPricingUI Initialized (DOM cached, listeners bound).");
        window.isNWCAProductPricingUIReady = true; // Set flag
        document.dispatchEvent(new CustomEvent('nwcaProductPricingUIReady'));
        debugProductUI("INFO", "'nwcaProductPricingUIReady' event dispatched.");
    }

    /**
     * Caches references to frequently used DOM elements.
     */
    function _cacheDOMElements() {
        debugProductUI("INFO", "Caching DOM elements.");
        elements.pricingGrid = document.getElementById('custom-pricing-grid');
        elements.sizeQuantityInputs = document.querySelectorAll('.size-card .quantity-input');
        elements.sizePriceDisplays = document.querySelectorAll('.size-card .dynamic-unit-price');

        elements.stickyCartSummaryContainer = document.getElementById('sticky-product-cart-summary');
        if (elements.stickyCartSummaryContainer) {
            elements.stickyTotalQuantityDisplay = elements.stickyCartSummaryContainer.querySelector('.total-quantity');
            elements.stickyTotalPriceDisplay = elements.stickyCartSummaryContainer.querySelector('.total-price');
            elements.stickyAddToCartButton = elements.stickyCartSummaryContainer.querySelector('.add-to-cart-button');
        }
        
        elements.pricingTierInfoSection = document.querySelector('.pricing-tier-info');
        if (elements.pricingTierInfoSection) {
            elements.dynamicPricingSummaryHeading = elements.pricingTierInfoSection.querySelector('#dynamic-pricing-summary');
            elements.combinedItemsMessage = elements.pricingTierInfoSection.querySelector('#combined-items-message');
            elements.currentTierNameDisplay = elements.pricingTierInfoSection.querySelector('#current-tier-name-display');
            elements.currentTierPriceDisplay = elements.pricingTierInfoSection.querySelector('#current-tier-price-display');
            
            const tierProgressDiv = elements.pricingTierInfoSection.querySelector('.tier-progress');
            if (tierProgressDiv) {
                elements.tierProgressFill = tierProgressDiv.querySelector('.tier-progress-fill');
                elements.tierProgressMessage = tierProgressDiv.querySelector('#tier-progress-message'); // Corrected from tierProgressDiv
            }
            
            elements.ltmExplanationSection = elements.pricingTierInfoSection.querySelector('.ltm-explanation');
            if (elements.ltmExplanationSection) {
                elements.ltmPerItemDisplay = elements.ltmExplanationSection.querySelector('.ltm-per-item');
            }
        }

        // Cache elements for additional logo pricing table
        elements.additionalLogoPricingGrid = document.getElementById('additional-logo-pricing-grid');
        elements.additionalPricingLoading = document.getElementById('additional-pricing-loading');

        debugProductUI("INFO", "DOM elements cached:", elements);
    }

    /**
     * Binds event listeners to interactive elements.
     */
    function _bindEventListeners() {
        debugProductUI("INFO", "Binding event listeners.");
        elements.sizeQuantityInputs.forEach(input => {
            input.addEventListener('change', handleQuantityChangeOnProductPage);
            input.addEventListener('input', handleQuantityChangeOnProductPage);
        });

        // Listen for pricing data to build the table for screen print
        debugProductUI("INFO", "Attempting to add pricingDataLoaded listener to document.");
        document.addEventListener('pricingDataLoaded', _handlePricingDataForTable);
        debugProductUI("INFO", "pricingDataLoaded listener ADDED to document.");
    }

    /**
     * Performs initial UI updates on page load.
     */
    async function _initialRenderUpdates() {
        debugProductUI("INFO", "Performing initial render updates.");
        // In a real scenario, fetch actual product pricing data and cart data here
        // config.productSpecificPricing = await NWCALocalStorage.getItem('currentProductPricingData'); // Example
        // config.pricingTiers = config.productSpecificPricing ? mapPricingDataToTiers(config.productSpecificPricing) : config.pricingTiers;
        
        const itemsCurrentlyAdding = _calculateTotalQuantityFromInputs();
        const itemsFromCart = await _getCartItemCountForCurrentProduct(); // Placeholder for actual cart integration
        
        updateAllPricingDisplays(itemsCurrentlyAdding, itemsFromCart);
    }

    /**
     * Calculates the total quantity from all size inputs on the current page.
     * @returns {number} The total quantity being added.
     */
    function _calculateTotalQuantityFromInputs() {
        let totalQuantity = 0;
        elements.sizeQuantityInputs.forEach(input => {
            totalQuantity += parseInt(input.value, 10) || 0;
        });
        debugProductUI("CALC", "Calculated total quantity from inputs:", totalQuantity);
        return totalQuantity;
    }

    /**
     * Placeholder: Gets the count of the current product already in the cart.
     * This needs to integrate with the actual cart system (e.g., NWCACart).
     * @returns {Promise<number>}
     */
    async function _getCartItemCountForCurrentProduct() {
        // const currentProductId = document.body.dataset.productId; // Assuming product ID is available
        // if (window.NWCACart && currentProductId) {
        //     const cartItems = await NWCACart.getCartItems();
        //     const productInCart = cartItems.find(item => item.id === currentProductId);
        //     return productInCart ? productInCart.quantity : 0;
        // }
        return 0; // Mock: No items in cart
    }

    /**
     * Handles quantity changes on the product page.
     * @param {Event} event - The input or change event.
     */
    async function handleQuantityChangeOnProductPage(event) {
        const input = event.target;
        const newQuantity = parseInt(input.value, 10);

        if (isNaN(newQuantity) || newQuantity < 0) {
            input.value = input.dataset.previousValue || '0';
            debugProductUI("WARN", "Invalid quantity entered.", { value: input.value });
            return;
        }
        input.dataset.previousValue = newQuantity;

        const itemsCurrentlyAdding = _calculateTotalQuantityFromInputs();
        const itemsFromCart = await _getCartItemCountForCurrentProduct();
        
        updateAllPricingDisplays(itemsCurrentlyAdding, itemsFromCart);
    }

    /**
     * Central function to update all dynamic pricing related displays.
     * @param {number} itemsCurrentlyAdding - Quantity from page inputs.
     * @param {number} itemsFromCart - Quantity of this item already in cart.
     */
    function updateAllPricingDisplays(itemsCurrentlyAdding, itemsFromCart, calculatedPricingData = null) {
        if (!calculatedPricingData) {
            debugProductUI("WARN", "updateAllPricingDisplays called without calculatedPricingData. UI might not be accurate.");
            // Attempt to fallback or simply return if critical data is missing
            // For now, let's try to proceed with what product-pricing-ui can derive, but this indicates an issue.
            const combinedTotalQuantityFallback = itemsCurrentlyAdding + itemsFromCart;
            const currentProductPricingFallback = config.productSpecificPricing || {};
            const pricingTiersToUseFallback = currentProductPricingFallback.tiers || config.pricingTiers;
            const currentTierFallback = getCurrentPricingTier(combinedTotalQuantityFallback, pricingTiersToUseFallback);
            const unitPriceAtCurrentTierFallback = getUnitPriceForTier(currentTierFallback, currentProductPricingFallback);

            updateDynamicPriceDisplaysPerSize(combinedTotalQuantityFallback, currentTierFallback, currentProductPricingFallback); // This will use mocks if no real data
            highlightActivePricingTierInGrid(combinedTotalQuantityFallback, currentTierFallback);
            // updateStickyCartSummary is handled by add-to-cart.js now
            updateComprehensiveTierInfo(itemsCurrentlyAdding, itemsFromCart, {
                combinedQuantity: combinedTotalQuantityFallback,
                tierKey: currentTierFallback ? currentTierFallback.label : null,
                tierObject: currentTierFallback,
                // items: {}, // No specific item prices in this fallback path
                ltmFeeApplies: combinedTotalQuantityFallback > 0 && combinedTotalQuantityFallback < (config.productSpecificPricing?.ltmThreshold || config.ltmThreshold),
                // nextTier, quantityForNextTier would be hard to get here without full calc data
            }, unitPriceAtCurrentTierFallback, pricingTiersToUseFallback);
            return;
        }

        debugProductUI("INFO", "updateAllPricingDisplays called with calculatedPricingData:", calculatedPricingData);

        const { combinedQuantity, tierKey, items, ltmFeeApplies, ltmFeePerItem, nextTierDetails, tierObject } = calculatedPricingData;
        const pricingTiersToUse = config.productSpecificPricing?.tiers || config.pricingTiers; // Still need all tiers for progress bar
        
        // Determine a representative unit price. If items exist, use the first one. Otherwise, null.
        let representativeUnitPrice = null;
        if (items && Object.keys(items).length > 0) {
            const firstSizeWithData = Object.keys(items)[0];
            if (items[firstSizeWithData] && items[firstSizeWithData].displayUnitPrice !== undefined) {
                representativeUnitPrice = items[firstSizeWithData].displayUnitPrice;
            }
        }
        
        // The currentTier object should ideally come from calculatedPricingData.tierObject
        // If not, derive it from tierKey and pricingTiersToUse
        const currentTierFull = tierObject || getCurrentPricingTier(combinedQuantity, pricingTiersToUse);


        updateDynamicPriceDisplaysPerSize(calculatedPricingData); // Pass the whole object
        debugProductUI("HIGHLIGHT-CHECK", "Calling highlightActivePricingTierInGrid with Combined Qty:", combinedQuantity, "Target Tier:", currentTierFull?.label);
        highlightActivePricingTierInGrid(combinedQuantity, currentTierFull);
        // updateStickyCartSummary is now primarily handled by add-to-cart.js
        // updateComprehensiveTierInfo call removed as the target HTML section is deleted.
        debugProductUI("INFO", "Skipping updateComprehensiveTierInfo as its HTML section was removed.");
    }

    /**
     * Updates the price displayed next to each size's quantity input.
     * @param {number} combinedTotalQuantity - For determining the tier.
     * @param {object} calculatedPricingData - The comprehensive pricing data object from pricing-calculator.
     */
    function updateDynamicPriceDisplaysPerSize(calculatedPricingData) {
        if (!calculatedPricingData || !calculatedPricingData.items) {
            debugProductUI("WARN", "updateDynamicPriceDisplaysPerSize: Missing calculatedPricingData or items.", calculatedPricingData);
            
            // Update all price displays to N/A
            const allPriceDisplays = document.querySelectorAll('.size-price-display, .dynamic-unit-price');
            allPriceDisplays.forEach(display => {
                display.textContent = "N/A";
            });
            return;
        }
        debugProductUI("UI-UPDATE", "Updating dynamic price displays per size using calculatedPricingData.items", calculatedPricingData.items);
        
        // Handle matrix layout (uses .size-price-display)
        const matrixPriceDisplays = document.querySelectorAll('.size-price-display');
        matrixPriceDisplays.forEach(display => {
            const size = display.dataset.size;
            if (size && calculatedPricingData.items[size] && calculatedPricingData.items[size].displayUnitPrice !== undefined) {
                const unitPrice = parseFloat(calculatedPricingData.items[size].displayUnitPrice);
                if (!isNaN(unitPrice)) {
                    display.innerHTML = `Unit Price: <span style="font-weight: bold;">$${unitPrice.toFixed(2)}</span>`;
                } else {
                    display.textContent = "Unit Price: N/A";
                }
            } else {
                display.textContent = "Unit Price: N/A";
            }
        });
        
        // Handle grid layout (uses .dynamic-unit-price inside .size-card)
        elements.sizeQuantityInputs.forEach((input) => {
            const size = input.dataset.size;
            const priceDisplayElement = input.closest('.size-card')?.querySelector('.dynamic-unit-price');

            if (priceDisplayElement) {
                let unitPriceText = "N/A";
                if (calculatedPricingData.items[size] && calculatedPricingData.items[size].displayUnitPrice !== undefined) {
                    const unitPrice = parseFloat(calculatedPricingData.items[size].displayUnitPrice);
                    if (!isNaN(unitPrice)) {
                        unitPriceText = `$${unitPrice.toFixed(2)}`;
                    }
                }
                priceDisplayElement.textContent = unitPriceText;
            }
        });
    }
    
    /**
     * MOCK: Calculates a tiered price. Replace with actual logic from pricing data.
     */
    function calculateTieredPrice(basePrice, tierLabel) {
        // This function should ideally not be needed if productPricingData is comprehensive.
        // It's a fallback.
        if (tierLabel === "72+") return basePrice * 0.8;
        if (tierLabel === "48-71") return basePrice * 0.85;
        if (tierLabel === "24-47") return basePrice * 0.9;
        return basePrice; // 1-23 or LTM
    }

    /**
     * Placeholder: Gets the unit price for a given tier from product pricing data.
     * This is a simplified version. Real logic would depend on productPricingData structure.
     * @param {object} tier - The current tier object.
     * @param {object} productPricingData - The product's pricing data.
     * @returns {number|null}
     */
    function getUnitPriceForTier(tier, productPricingData) {
        if (!tier || !productPricingData) return null;
        // This is a MAJOR simplification. Assumes a general price for the tier.
        // In reality, price can vary by size even within the same tier.
        // The `updateDynamicPriceDisplaysPerSize` is more accurate for individual size prices.
        // This function might return an "average" or "starting at" price for the tier if needed for summary.
        // For now, let's use the first size's price at that tier as a representative.
        if (productPricingData.sizes) {
            const firstSizeKey = Object.keys(productPricingData.sizes)[0];
            if (firstSizeKey && productPricingData.sizes[firstSizeKey].prices_by_tier_label) {
                const price = productPricingData.sizes[firstSizeKey].prices_by_tier_label[tier.label];
                return price !== undefined ? parseFloat(price) : null;
            }
        }
        return calculateTieredPrice(10.00, tier.label); // Fallback to mock
    }

    /**
     * Updates the content of the sticky cart summary.
     * @param {number} itemsCurrentlyAdding - Quantity from page inputs.
     * @param {number|null} unitPriceAtCurrentTier - Representative unit price for the current tier.
     * @param {number} combinedTotalQuantity - Combined quantity for LTM check.
     */
    function updateStickyCartSummary(itemsCurrentlyAdding, unitPriceAtCurrentTier, combinedTotalQuantity) {
        if (!elements.stickyCartSummaryContainer) return;
        debugProductUI("UI-UPDATE", "Updating sticky cart summary for items adding:", itemsCurrentlyAdding);

        let estimatedTotalPrice = 0;
        // Calculate estimated total price based on individual size quantities and their dynamic prices
        elements.sizeQuantityInputs.forEach(input => {
            const quantity = parseInt(input.value, 10) || 0;
            const priceDisplayElement = input.closest('.size-card').querySelector('.dynamic-unit-price');
            if (priceDisplayElement && priceDisplayElement.textContent.startsWith('$')) {
                const unitPrice = parseFloat(priceDisplayElement.textContent.substring(1));
                if (!isNaN(unitPrice)) {
                    estimatedTotalPrice += quantity * unitPrice;
                }
            }
        });
        
        const ltmFeeThreshold = config.productSpecificPricing?.ltmThreshold || config.ltmThreshold;
        const ltmFeeAmount = config.productSpecificPricing?.ltmFee || config.ltmFee;
        const ltmFeeApplies = combinedTotalQuantity > 0 && combinedTotalQuantity < ltmFeeThreshold;
        
        if (ltmFeeApplies) {
            estimatedTotalPrice += ltmFeeAmount;
        }
        // Update LTM notice in sticky summary (assuming an element exists, e.g., .ltm-fee-notice)
        const ltmNoticeElement = elements.stickyCartSummaryContainer.querySelector('.ltm-fee-notice');
        if (ltmNoticeElement) {
            ltmNoticeElement.style.display = ltmFeeApplies ? 'flex' : 'none';
        }

        if (elements.stickyTotalQuantityDisplay) {
            elements.stickyTotalQuantityDisplay.textContent = itemsCurrentlyAdding; // Show only items being added now
        }
        if (elements.stickyTotalPriceDisplay) {
            elements.stickyTotalPriceDisplay.textContent = `$${estimatedTotalPrice.toFixed(2)}`;
        }
        if (elements.stickyAddToCartButton) {
            elements.stickyAddToCartButton.disabled = itemsCurrentlyAdding === 0;
        }
    }
    
    /**
     * Updates the comprehensive pricing tier information display.
     * @param {number} itemsCurrentlyAdding - Quantity from page inputs.
     * @param {number} itemsFromCart - Quantity of this item already in cart.
     * @param {number} itemsCurrentlyAdding - Quantity from page inputs.
     * @param {number} itemsFromCart - Quantity of this item already in cart.
     * @param {object} calculatedPricingData - The comprehensive pricing data from pricing-calculator.
     * @param {number|null} representativeUnitPrice - A representative unit price for the current tier (can be null).
     * @param {Array} allPricingTiersForProgress - Array of all tier objects, primarily for progress bar.
     */
    // function updateComprehensiveTierInfo(itemsCurrentlyAdding, itemsFromCart, calculatedPricingData, representativeUnitPrice, allPricingTiersForProgress) {
    //     // This function is no longer called as its target HTML section was removed.
    //     // Keeping the function definition commented out for now in case parts of its logic are needed elsewhere,
    //     // or if the section is reinstated later.
    //     /*
    //     if (!elements.pricingTierInfoSection || !calculatedPricingData) {
    //         debugProductUI("WARN", "updateComprehensiveTierInfo: Missing elements or calculatedPricingData.", {
    //             hasElements: !!elements.pricingTierInfoSection,
    //             hasData: !!calculatedPricingData
    //         });
    //         return;
    //     }

    //     const { combinedQuantity, tierKey, ltmFeeApplies, ltmFeePerItem, nextTierDetails, tierObject } = calculatedPricingData;
    //     const currentTierToDisplay = tierObject || getCurrentPricingTier(combinedQuantity, allPricingTiersForProgress);

    //     debugProductUI("UI-UPDATE", "Updating comprehensive tier info with data:", { itemsCurrentlyAdding, itemsFromCart, ...calculatedPricingData });

    //     if (elements.combinedItemsMessage) {
    //         let message = `You are considering ${itemsCurrentlyAdding} item(s). `;
    //         if (itemsFromCart > 0) {
    //             message += `With ${itemsFromCart} item(s) already in your cart, your `;
    //         } else {
    //             message += `Your `;
    //         }
    //         message += `combined total of ${combinedQuantity} item(s) qualifies you for `;
    //         if (tierKey) {
    //             message += `the <strong>${tierKey}</strong> pricing.`;
    //         } else {
    //             message += `the base pricing.`; // Or some other default if tierKey is missing
    //         }
    //         elements.combinedItemsMessage.innerHTML = message;
    //     }

    //     if (elements.currentTierNameDisplay) {
    //         elements.currentTierNameDisplay.textContent = tierKey || 'N/A';
    //     }

    //     if (elements.currentTierPriceDisplay) {
    //         if (combinedQuantity === 0) {
    //             elements.currentTierPriceDisplay.textContent = 'N/A';
    //         } else if (representativeUnitPrice !== null && !isNaN(representativeUnitPrice)) {
    //             elements.currentTierPriceDisplay.textContent = `$${parseFloat(representativeUnitPrice).toFixed(2)}`;
    //         } else {
    //              // Try to get a price from the first item in calculatedPricingData.items if representativeUnitPrice is null
    //             let foundPrice = null;
    //             if (calculatedPricingData.items && Object.keys(calculatedPricingData.items).length > 0) {
    //                 const firstSizeKey = Object.keys(calculatedPricingData.items)[0];
    //                 const item = calculatedPricingData.items[firstSizeKey];
    //                 if (item && item.displayUnitPrice !== undefined) {
    //                     foundPrice = parseFloat(item.displayUnitPrice);
    //                 }
    //             }
    //             elements.currentTierPriceDisplay.textContent = (foundPrice !== null && !isNaN(foundPrice)) ? `$${foundPrice.toFixed(2)}` : 'N/A';
    //         }
    //     }

    //     // Tier Progress Bar Logic
    //     if (elements.tierProgressFill && elements.tierProgressMessage && currentTierToDisplay && allPricingTiersForProgress) {
    //         const currentTierIndex = allPricingTiersForProgress.findIndex(t => t.label === currentTierToDisplay.label);
    //         let progressPercent = 0;
    //         let progressMessageText = `You are in the ${currentTierToDisplay.label} tier.`;

    //         if (nextTierDetails && nextTierDetails.tier && nextTierDetails.quantityNeeded > 0) {
    //             progressMessageText = `Add ${nextTierDetails.quantityNeeded} more item(s) to reach the ${nextTierDetails.tier.label} tier for better pricing.`;
    //             const rangeForCurrentTier = (nextTierDetails.tier.minQty -1) - currentTierToDisplay.minQty;
    //             const progressInCurrentTier = combinedQuantity - currentTierToDisplay.minQty;
    //             if (rangeForCurrentTier > 0) {
    //                 progressPercent = Math.min(100, (progressInCurrentTier / rangeForCurrentTier) * 100);
    //             } else if (combinedQuantity >= currentTierToDisplay.minQty) {
    //                 progressPercent = 100; // If it's the last tier or range is 0 but in tier
    //             }
    //         } else if (currentTierIndex === allPricingTiersForProgress.length - 1) { // Last tier
    //             progressMessageText = `You've reached the best pricing tier (${currentTierToDisplay.label})!`;
    //             progressPercent = 100;
    //         } else if (currentTierIndex === -1 && combinedQuantity < allPricingTiersForProgress[0]?.minQty && combinedQuantity > 0) { // Below first tier (LTM usually)
    //              progressMessageText = `Add ${allPricingTiersForProgress[0].minQty - combinedQuantity} more item(s) to reach the ${allPricingTiersForProgress[0].label} tier.`;
    //              progressPercent = (combinedQuantity / (allPricingTiersForProgress[0].minQty -1)) * 100;

    //         } else if (combinedQuantity === 0) {
    //             progressMessageText = `Add items to see pricing tiers.`;
    //             progressPercent = 0;
    //         }


    //         elements.tierProgressFill.style.width = `${Math.max(0, Math.min(100, progressPercent))}%`;
    //         elements.tierProgressMessage.textContent = progressMessageText;
    //     }


    //     if (elements.ltmExplanationSection) {
    //         elements.ltmExplanationSection.style.display = ltmFeeApplies ? 'block' : 'none';
    //         if (ltmFeeApplies && elements.ltmPerItemDisplay && combinedQuantity > 0) {
    //             elements.ltmPerItemDisplay.textContent = `$${parseFloat(ltmFeePerItem || 0).toFixed(2)}`;
    //         } else if (elements.ltmPerItemDisplay) {
    //             elements.ltmPerItemDisplay.textContent = '$0.00';
    //         }
    //     }
    //     */
    // }

    /**
     * Highlights the active pricing tier in the main pricing grid.
     * @param {number} combinedTotalQuantity - The current total quantity for the item.
     * @param {object|null} currentTier - The active pricing tier object.
     */
    function highlightActivePricingTierInGrid(combinedTotalQuantity, currentTier) {
        if (!elements.pricingGrid) return;
        debugProductUI("UI-UPDATE", "Highlighting active pricing tier in grid for combined quantity:", combinedTotalQuantity);

        if (!currentTier) return;

        // Remove previous row highlight
        elements.pricingGrid.querySelectorAll('tbody tr.current-pricing-level-highlight').forEach(row => {
            row.classList.remove('current-pricing-level-highlight');
        });
        // Remove previous column header highlight (if any, from old logic)
        elements.pricingGrid.querySelectorAll('thead th.active-tier-highlight').forEach(el => {
            el.classList.remove('active-tier-highlight');
        });


        if (!currentTier || !currentTier.label) {
            debugProductUI("WARN", "highlightActivePricingTierInGrid: currentTier or currentTier.label is undefined.", currentTier);
            return;
        }

        // Highlight the row in tbody
        const rows = elements.pricingGrid.querySelectorAll('tbody tr');
        rows.forEach(row => {
            const firstCell = row.querySelector('td:first-child');
            if (firstCell) {
                const cellText = firstCell.textContent.trim();
                const tierLabelToMatch = currentTier.label;
                // Ensure tierLabelToMatch is also a string and trimmed, though it should be from tierKey
                const safeTierLabelToMatch = String(tierLabelToMatch || '').trim();

                debugProductUI("MATCH-DETAIL", `Comparing cell content: "'${cellText}'" with target tier label: "'${safeTierLabelToMatch}'"`);
                
                if (cellText === safeTierLabelToMatch) {
                    row.classList.add('current-pricing-level-highlight');
                    debugProductUI("UI-UPDATE", `Applied .current-pricing-level-highlight to row for tier: ${currentTier.label}`);
                }
            } else {
                debugProductUI("WARN", "A row in pricing grid tbody is missing its first td.", row);
            }
        });
    }

    /**
     * Gets the current pricing tier object based on total quantity.
     * @param {number} totalQuantity - The total quantity.
     * @param {Array} tiersToUse - The array of tier objects to check against.
     * @returns {object|null} The tier object or null if not found.
     */
    function getCurrentPricingTier(totalQuantity, tiersToUse) {
        tiersToUse = tiersToUse || config.pricingTiers; // Fallback to default config if not provided
        for (const tier of tiersToUse) {
            if (totalQuantity >= tier.minQty && totalQuantity <= tier.maxQty) {
                return tier;
            }
        }
        // If quantity is 0 or doesn't fit, default to the first tier or handle as LTM case explicitly
        if (totalQuantity === 0 && tiersToUse.length > 0) return tiersToUse[0];
        // If LTM is handled by the first tier (e.g. 1-23), this is fine.
        // Otherwise, might need specific logic for quantities below the first defined tier's minQty.
        return tiersToUse.length > 0 ? tiersToUse[0] : null;
    }

    /**
     * Toggles the visibility of a collapsible section (for mobile).
     * @param {HTMLElement} toggleButton - The button that was clicked.
     */
    function toggleMobileCollapsibleSection(toggleButton) {
        const targetId = toggleButton.dataset.target;
        const section = document.querySelector(targetId);
        if (section) {
            section.classList.toggle('is-expanded');
            toggleButton.setAttribute('aria-expanded', section.classList.contains('is-expanded'));
            debugProductUI("UI-ACTION", "Toggled collapsible section:", { targetId, expanded: section.classList.contains('is-expanded') });
        }
    }

    function _handlePricingDataForTable(event) {
        debugProductUI("EVENT", "_handlePricingDataForTable CALLED.", { type: event.type, detailKeys: event.detail ? Object.keys(event.detail) : 'no-detail' });

        // Check if this event is from screenprint-adapter.js (has 'tiers' array and 'fees' object)
        // and not from pricing-matrix-capture.js (which has 'prices' object and 'tierData' object)
        if (event.detail &&
            event.detail.embellishmentType === 'screen-print' &&
            Array.isArray(event.detail.tiers) && // screenprint-adapter dispatches 'tiers' as an array
            typeof event.detail.fees === 'object' && // screenprint-adapter dispatches 'fees' as an object
            !event.detail.hasOwnProperty('prices') && // pricing-matrix-capture dispatches 'prices'
            !event.detail.hasOwnProperty('tierData'))   // pricing-matrix-capture dispatches 'tierData'
        {
            debugProductUI("INFO", "Processing 'pricingDataLoaded' event (likely from screenprint-adapter) for screen-print table.", event.detail);
            const { uniqueSizes, tiers, fees } = event.detail;

            if (elements.pricingGrid && Array.isArray(uniqueSizes) && uniqueSizes.length > 0 && Array.isArray(tiers) && tiers.length > 0) {
                _buildScreenPrintPricingTable(uniqueSizes, tiers, fees);
                const loadingElement = document.getElementById('pricing-loading');
                if (loadingElement) {
                    loadingElement.style.display = 'none';
                }
                elements.pricingGrid.style.display = 'table';
                debugProductUI("INFO", "Screen print pricing table built and display set to 'table'.");

                // Now, try to build the additional logo pricing table
                if (event.detail.fullAdditionalLocationPricing) {
                    if (elements.additionalLogoPricingGrid) {
                        _buildAdditionalLogoPricingTable(event.detail.fullAdditionalLocationPricing);
                        if (elements.additionalPricingLoading) {
                            elements.additionalPricingLoading.style.display = 'none';
                        }
                        elements.additionalLogoPricingGrid.style.display = 'table';
                        debugProductUI("INFO", "Additional logo pricing table built and display set to 'table'.");
                    } else {
                        debugProductUI("WARN", "Additional logo pricing grid element not found.");
                    }
                } else {
                    debugProductUI("INFO", "No fullAdditionalLocationPricing data found in event.detail. Skipping additional logo table.");
                    if (elements.additionalPricingLoading) elements.additionalPricingLoading.textContent = 'Additional location pricing not available.';
                }

            } else {
                debugProductUI("WARN", "Cannot build screen print table: Missing pricingGrid, or uniqueSizes/tiers are invalid/empty.", {
                    hasGrid: !!elements.pricingGrid,
                    uniqueSizesValid: Array.isArray(uniqueSizes) && uniqueSizes.length > 0,
                    tiersValid: Array.isArray(tiers) && tiers.length > 0,
                    receivedUniqueSizes: uniqueSizes,
                    receivedTiers: tiers
                });
                 if (elements.additionalPricingLoading) elements.additionalPricingLoading.textContent = 'Primary pricing data missing, cannot load additional pricing.';
            }
        } else if (event.detail && event.detail.embellishmentType === 'screen-print') {
            debugProductUI("EVENT", `_handlePricingDataForTable: Received 'screen-print' event, but structure not from screenprint-adapter (e.g., has 'prices' or 'tierData' instead of 'tiers' array). Skipping table build for this event.`, event.detail);
        } else if (event.detail) {
            debugProductUI("EVENT", `_handlePricingDataForTable: Skipped. EmbellishmentType is '${event.detail.embellishmentType}', expected 'screen-print' with specific structure.`, event.detail);
        } else {
            debugProductUI("EVENT", "_handlePricingDataForTable: Skipped. event.detail is missing.", event);
        }
    }

    function _buildScreenPrintPricingTable(uniqueSizes, tiersData, feesData) {
        if (!elements.pricingGrid) return;

        const table = elements.pricingGrid;
        let thead = table.querySelector('thead');
        if (!thead) {
            thead = document.createElement('thead');
            table.appendChild(thead);
        }
        thead.innerHTML = ''; // Clear existing header

        let tbody = table.querySelector('tbody');
        if (!tbody) {
            tbody = document.createElement('tbody');
            table.appendChild(tbody);
        }
        tbody.innerHTML = ''; // Clear existing body

        // Build Header Row: "Qty Range" | Size1 | Size2 | ...
        const headerRow = document.createElement('tr');
        headerRow.id = 'pricing-header-row';
        const thQty = document.createElement('th');
        thQty.textContent = 'Qty Range';
        headerRow.appendChild(thQty);

        uniqueSizes.forEach(size => {
            const thSizeHeader = document.createElement('th');
            thSizeHeader.textContent = size;
            headerRow.appendChild(thSizeHeader);
        });
        thead.appendChild(headerRow);

        // Build Body Rows: TierLabel | PriceForSize1 | PriceForSize2 | ...
        tiersData.forEach(tier => {
            const tr = document.createElement('tr');
            const tdTierLabel = document.createElement('td');
            tdTierLabel.style.fontWeight = 'bold';
            let tierLabelText = `${tier.minQty}${tier.maxQty ? '-' + tier.maxQty : '+'}`;
            if (tier.label && tier.label !== tierLabelText && !tierLabelText.includes(tier.label)) { // If Caspio tier.label is different and more descriptive
                tierLabelText = tier.label; // Use Caspio's label
            }

            // Append LTM fee information directly to the tier label cell if applicable
            // This LTM_Fee comes from the screenprint-adapter's processed tier data,
            // which should originate from Caspio's tierData.LTM_Fee
            if (tier.ltmFee && parseFloat(tier.ltmFee) > 0) {
                tierLabelText += `<br><small style="font-weight:normal; font-style:italic;">(LTM Fee: $${parseFloat(tier.ltmFee).toFixed(2)})</small>`;
            }
            tdTierLabel.innerHTML = tierLabelText;
            tr.appendChild(tdTierLabel);

            uniqueSizes.forEach(size => {
                const tdPrice = document.createElement('td');
                let priceForSizeInTier = 'N/A';
                // tier.prices is expected to be an object like { "S": 10.00, "M": 10.00, "2XL": 12.00 }
                // This structure comes from screenprint-adapter.js, which processes the Caspio masterBundle.
                // The Caspio masterBundle's primaryLocationPricing[colorCount].tiers[tierIndex].prices object
                // is already structured per individual size by the calcPriLocProf function in Caspio HTML Block 2.
                if (tier.prices && tier.prices[size] !== undefined) {
                    priceForSizeInTier = tier.prices[size];
                }
                tdPrice.textContent = typeof priceForSizeInTier === 'number' ? `$${priceForSizeInTier.toFixed(2)}` : priceForSizeInTier;
                tr.appendChild(tdPrice);
            });
            tbody.appendChild(tr);
        });
        
        // Add fees information if available
        if (feesData && (feesData.setup || feesData.flash)) {
            let tfoot = table.querySelector('tfoot');
            if (!tfoot) {
                tfoot = document.createElement('tfoot');
                table.appendChild(tfoot);
            }
            tfoot.innerHTML = '';
            const feesRow = document.createElement('tr');
            const feesCell = document.createElement('td');
            feesCell.colSpan = tiersData.length + 1; // Span all columns
            feesCell.style.textAlign = 'left';
            feesCell.style.paddingTop = '10px';
            feesCell.style.fontSize = '0.9em';
            
            let feesHtml = '<strong>Additional Notes:</strong><ul>';
            if (feesData.setup) {
                feesHtml += `<li>Setup Fee: $${parseFloat(feesData.setup).toFixed(2)} per color.</li>`;
            }
            if (feesData.flash) {
                feesHtml += `<li>Flash Charge: $${parseFloat(feesData.flash).toFixed(2)} (if applicable, for dark garments).</li>`;
            }
            feesHtml += '<li>Dark garments may require a white base (counts as an extra color).</li>';
            feesHtml += '</ul>';
            feesCell.innerHTML = feesHtml;
            feesRow.appendChild(feesCell);
            tfoot.appendChild(feesRow);
        }
        debugProductUI("INFO", "Screen print pricing table built.");
    }

    function _buildAdditionalLogoPricingTable(fullAdditionalPricingData) {
        if (!elements.additionalLogoPricingGrid) {
            debugProductUI("ERROR", "_buildAdditionalLogoPricingTable: additionalLogoPricingGrid element not found.");
            return;
        }

        const table = elements.additionalLogoPricingGrid;
        let thead = table.querySelector('thead');
        if (!thead) { thead = document.createElement('thead'); table.appendChild(thead); }
        thead.innerHTML = '';

        let tbody = table.querySelector('tbody');
        if (!tbody) { tbody = document.createElement('tbody'); table.appendChild(tbody); }
        tbody.innerHTML = '';
        
        let tfoot = table.querySelector('tfoot');
        if (!tfoot) { tfoot = document.createElement('tfoot'); table.appendChild(tfoot); }
        tfoot.innerHTML = '';


        // Header: Qty Range | 1 Color | 2 Colors | ... | 6 Colors
        const headerRow = document.createElement('tr');
        const thQty = document.createElement('th');
        thQty.textContent = 'Qty Range';
        thQty.style.textAlign = 'left';
        headerRow.appendChild(thQty);

        const colorCounts = ["1", "2", "3", "4", "5", "6"]; // Standard color counts for additional location
        colorCounts.forEach(count => {
            const thColor = document.createElement('th');
            thColor.textContent = `${count} Color${parseInt(count) > 1 ? 's' : ''}`;
            thColor.style.textAlign = 'center';
            headerRow.appendChild(thColor);
        });
        thead.appendChild(headerRow);

        // Determine common tier labels from the "1 Color" data (or first available)
        const firstColorCountData = fullAdditionalPricingData["1"] || fullAdditionalPricingData[Object.keys(fullAdditionalPricingData)[0]];
        if (!firstColorCountData || !firstColorCountData.tiers || firstColorCountData.tiers.length === 0) {
            debugProductUI("WARN", "No tier data available for additional logo pricing table.", firstColorCountData);
            tbody.innerHTML = '<tr><td colspan="7">Additional location pricing data not available.</td></tr>';
            return;
        }
        const commonTiers = firstColorCountData.tiers.map(t => ({
            label: t.label || `${t.minQty}${t.maxQty ? '-' + t.maxQty : '+'}`,
            minQty: t.minQty,
            maxQty: t.maxQty,
            ltmFee: t.ltmFee
        }));
        
        let overallSetupNote = "";

        commonTiers.forEach(tierInfo => {
            const tr = document.createElement('tr');
            const tdTierLabel = document.createElement('td');
            tdTierLabel.style.fontWeight = 'bold';
            tdTierLabel.style.textAlign = 'left';
            let tierLabelText = tierInfo.label;
            if (tierInfo.ltmFee && parseFloat(tierInfo.ltmFee) > 0) {
                 tierLabelText += `<br><small style="font-weight:normal; font-style:italic;">(LTM Fee: $${parseFloat(tierInfo.ltmFee).toFixed(2)})</small>`;
            }
            tdTierLabel.innerHTML = tierLabelText;
            tr.appendChild(tdTierLabel);

            colorCounts.forEach(colorCountKey => {
                const tdPrice = document.createElement('td');
                tdPrice.style.textAlign = 'center';
                let pricePerPiece = 'N/A';
                const colorCountPricing = fullAdditionalPricingData[colorCountKey];
                if (colorCountPricing && colorCountPricing.tiers) {
                    const matchingTier = colorCountPricing.tiers.find(t => (t.label || `${t.minQty}${t.maxQty ? '-' + t.maxQty : '+'}`) === tierInfo.label);
                    if (matchingTier && matchingTier.pricePerPiece !== undefined && matchingTier.pricePerPiece !== null) {
                        pricePerPiece = parseFloat(matchingTier.pricePerPiece);
                    }
                }
                tdPrice.textContent = typeof pricePerPiece === 'number' ? `$${pricePerPiece.toFixed(2)}` : pricePerPiece;
                tr.appendChild(tdPrice);
                
                // Collect setup fee info for the footer note (once per color count)
                if (tierInfo.minQty === commonTiers[0].minQty && colorCountPricing && colorCountPricing.setupFee > 0) {
                    if (overallSetupNote) overallSetupNote += ", ";
                    overallSetupNote += `${colorCountKey} clr: $${parseFloat(colorCountPricing.setupFee).toFixed(2)}`;
                }
            });
            tbody.appendChild(tr);
        });
        
        if (overallSetupNote) {
            const feesRow = document.createElement('tr');
            const feesCell = document.createElement('td');
            feesCell.colSpan = colorCounts.length + 1;
            feesCell.style.textAlign = 'left';
            feesCell.style.paddingTop = '10px';
            feesCell.style.fontSize = '0.85em';
            feesCell.innerHTML = `<strong>Note:</strong> Additional location setup fees (per location): ${overallSetupNote}.`;
            feesRow.appendChild(feesCell);
            tfoot.appendChild(feesRow);
        }
        debugProductUI("INFO", "Additional logo pricing table built.");
    }


    // Public API
    return {
        initialize,
        // Expose for potential external updates if cart changes elsewhere
        updateAllPricingDisplays,
        // Expose for screenprint adapter to directly call if needed, or for testing
        _buildScreenPrintPricingTable,
        _buildAdditionalLogoPricingTable
    };

})();

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    if (document.getElementById('custom-pricing-grid')) { // Check if on a product pricing page
        // Ensure the module is assigned to window if not already (e.g. if script is bundled differently later)
        if (!window.NWCAProductPricingUI) {
            window.NWCAProductPricingUI = NWCAProductPricingUI;
        }
        window.NWCAProductPricingUI.initialize();
    }
});
// Also, ensure the IIFE result is assigned to window if this script is loaded directly
if (NWCAProductPricingUI && !window.NWCAProductPricingUI) {
    window.NWCAProductPricingUI = NWCAProductPricingUI;
}