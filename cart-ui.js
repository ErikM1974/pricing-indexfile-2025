// cart-ui.js - UI handling for the shopping cart page

/**
 * Cart UI Module for Northwest Custom Apparel
 * Handles rendering and interaction with the shopping cart UI
 */
const NWCACartUI = (function() {
  // Flag to prevent multiple simultaneous renders
  let isRendering = false;
  
  // DOM elements
  const elements = {
    cartItemsContainer: document.getElementById('cart-items-container'),
    emptyCartMessage: document.getElementById('empty-cart-message'),
    cartSummary: document.getElementById('cart-summary'),
    cartSubtotal: document.getElementById('cart-subtotal'),
    cartTotal: document.getElementById('cart-total'),
    ltmFee: document.getElementById('ltm-fee'),
    ltmFeeRow: document.querySelector('.ltm-fee-row'),
    savedItemsContainer: document.getElementById('saved-items-container'),
    savedItemsList: document.getElementById('saved-items-list'),
    proceedToCheckoutBtn: document.getElementById('proceed-to-checkout-btn'),
    saveForLaterBtn: document.getElementById('save-for-later-btn'),
    downloadQuotePdfBtn: document.getElementById('download-quote-pdf-btn'), // Added PDF button

    // Step 2: Shipping
    shippingFormContainer: document.getElementById('shipping-form-container'),
    shippingForm: document.getElementById('shipping-form'),
    backToCartBtn: document.getElementById('back-to-cart-btn'),

    // Step 3: Review
    reviewOrderContainer: document.getElementById('review-order-container'),
    reviewCustomerInfo: document.getElementById('review-customer-info'),
    reviewSubtotal: document.getElementById('review-subtotal'),
    reviewTotal: document.getElementById('review-total'),
    reviewLtmFee: document.getElementById('review-ltm-fee'),
    reviewItemsList: document.getElementById('review-items-list'),
    backToShippingBtn: document.getElementById('back-to-shipping-btn'),
    submitOrderBtn: document.getElementById('submit-order-btn'),

    // Confirmation
    orderConfirmationContainer: document.getElementById('order-confirmation-container'),
    quoteReference: document.getElementById('quote-reference'),

    // Progress steps
    progressSteps: document.querySelectorAll('.progress-steps .step')
  };

  // Templates (Keep original template references if needed, though new functions don't use them)
  const templates = {
    // cartItem: document.getElementById('cart-item-template'), // New renderCartItem doesn't use this
    // sizeItem: document.getElementById('size-item-template') // New renderSizeItem doesn't use this
  };

  // Current step
  let currentStep = 1;

  // Customer data
  let customerData = {};

  // --- Add definitions for debugCartUI, handleRemoveItem, handleQuantityChange ---
  // Placeholder for debug function - replace with actual implementation or remove calls
  function debugCartUI(level, message, data = null) {
      console.log(`[CartUI-${level}] ${message}`, data);
  }

  // Placeholder for remove item handler - Needs to interact with NWCACart
  async function handleRemoveItem(itemId) {
      debugCartUI("ACTION", `Attempting to remove item: ${itemId}`);
      
      // Parse the itemId string to an integer
      const itemIdNumber = parseInt(itemId, 10);

      if (isNaN(itemIdNumber)) {
          showNotification('Error: Invalid item ID format.', 'danger');
          debugCartUI("ACTION-ERROR", `Invalid item ID for removal: ${itemId}`);
          return; // Stop if ID is not a valid number
      }

      // Example: Assuming NWCACart expects the ID as passed
      const result = await NWCACart.removeItem(itemIdNumber); // Pass the number
      if (!result || !result.success) {
          showNotification(result?.error || `Failed to remove item ${itemIdNumber}`, 'danger');
          debugCartUI("ACTION-ERROR", `Failed removal for item: ${itemIdNumber}`, result);
      } else {
         showNotification(`Item removed successfully`, 'success');
         debugCartUI("ACTION-SUCCESS", `Successfully removed item: ${itemIdNumber}`);
         // Cart should re-render automatically via the cartUpdated event listener
      }
  }

  // Placeholder for quantity change handler - Needs to interact with NWCACart
  async function handleQuantityChange(event) {
      const input = event.target;
      const itemId = input.dataset.itemId; // This is a string
      const size = input.dataset.size;
      const newQuantity = parseInt(input.value);

      if (isNaN(newQuantity) || newQuantity < 0) {
          showNotification('Please enter a valid quantity.', 'warning');
          // Optionally reset to previous value - NWCACart event should handle this
          return;
      }

      // Parse the itemId string to an integer
      const itemIdNumber = parseInt(itemId, 10); // <-- ADDED PARSING

      if (isNaN(itemIdNumber)) { // <-- ADDED VALIDATION
          showNotification('Error: Invalid item ID format for quantity update.', 'danger');
          debugCartUI("ACTION-ERROR", `Invalid item ID for quantity update: ${itemId}`);
          return; // Stop if ID is not a valid number
      }

      debugCartUI("ACTION", `Attempting to update quantity for item ${itemIdNumber}, size ${size} to ${newQuantity}`); // <-- Use itemIdNumber in log

      // Show loading state? (Disable input?)
      input.disabled = true;

      // Example: Assuming NWCACart.updateQuantity exists and takes itemId, size, quantity
      // Pass the number ID
      const result = await NWCACart.updateQuantity(itemIdNumber, size, newQuantity); // <--- PASS itemIdNumber

      input.disabled = false; // Re-enable input

      if (!result || !result.success) {
          showNotification(result?.error || `Failed to update quantity for ${size}`, 'danger');
           // <-- Use itemIdNumber in log
          debugCartUI("ACTION-ERROR", `Failed quantity update for item ${itemIdNumber}, size ${size}`, result);
          // The cart re-render triggered by cartUpdated should reset the input value if the update failed server-side
      } else {
          // Success feedback is optional, re-render handles visual update
           // <-- Use itemIdNumber in log
           debugCartUI("ACTION-SUCCESS", `Successfully updated quantity for item ${itemIdNumber}, size ${size}`);
      }
  }
  // --- End of added definitions ---


  /**
   * Initialize the cart UI
   */
  function initialize() {
    // Add event listeners
    if (elements.saveForLaterBtn) {
      elements.saveForLaterBtn.addEventListener('click', handleSaveForLater);
    }

    if (elements.proceedToCheckoutBtn) {
      elements.proceedToCheckoutBtn.addEventListener('click', () => goToStep(2));
    }

    if (elements.backToCartBtn) {
      elements.backToCartBtn.addEventListener('click', () => goToStep(1));
    }

    if (elements.shippingForm) {
      elements.shippingForm.addEventListener('submit', handleShippingFormSubmit);
    }

    if (elements.backToShippingBtn) {
      elements.backToShippingBtn.addEventListener('click', () => goToStep(2));
    }

    if (elements.submitOrderBtn) {
      elements.submitOrderBtn.addEventListener('click', handleSubmitQuoteRequest);
    }

    // Listen for cart updates
    NWCACart.addEventListener('cartUpdated', () => {
      // Only render if we're not already rendering
      if (!isRendering) {
        renderCart();
      }
    });

    // Force a sync with the server before initial render
    console.log("Initializing cart UI, syncing with server...");
    NWCACart.syncWithServer()
      .then(async () => { // <-- Make anonymous function async
        console.log("Cart sync complete, rendering cart...");
        await renderCart(); // <-- Await the async renderCart

        // Initialize progress steps
        goToStep(1);
      })
      .catch(async error => { // <-- Make anonymous function async
        console.error("Error syncing cart:", error);
        // Render anyway even if sync fails
        await renderCart(); // <-- Await the async renderCart
      });
  }

  /**
   * Render the cart
   */
  async function renderCart() { // <-- Make renderCart async
    // If already rendering, don't start another render
    if (isRendering) {
      debugCartUI("RENDER-WARN", "Render already in progress, skipping this render call");
      return;
    }
    
    // Set rendering flag
    isRendering = true;
    
    try {
    // Get cart items - **ADJUST based on how NWCACart provides items**
    // Assuming NWCACart now returns items matching the new function's expectations
    // (e.g., using 'id', 'styleNumber', 'embellishmentType', 'unitPrice')
    // If NWCACart still uses CartStatus, StyleNumber etc., you'll need an adapter here
    // or modify the new render functions.

    // Example assuming NWCACart still uses original format & CartStatus:
     const activeItemsOriginal = NWCACart.getCartItems('Active');
     const savedItemsOriginal = NWCACart.getCartItems('SavedForLater');

     // *** ADAPTATION NEEDED HERE ***
     // Convert original item format to the format expected by new render functions
     console.log('[CART-UI] Raw items from NWCACart.getCartItems():', JSON.stringify(activeItemsOriginal, null, 2));
     const activeItems = activeItemsOriginal.map(adaptItemFormat);
     console.log('[CART-UI] Items AFTER adaptItemFormat:', JSON.stringify(activeItems, null, 2));
     const savedItems = savedItemsOriginal.map(adaptItemFormat);
     // *** END ADAPTATION ***


    console.log("Rendering cart with active items:", activeItems);
    debugCartUI("RENDER", "Starting renderCart function. Active items count:", activeItems?.length); // Added debug

    // Check if cart is loading
    if (NWCACart.isLoading() && elements.cartItemsContainer) {
       debugCartUI("RENDER", "Cart is loading, showing spinner."); // Added debug
      elements.cartItemsContainer.innerHTML = `
        <div class="cart-loading">
          <div class="spinner-border text-primary" role="status">
            <span class="sr-only">Loading...</span>
          </div>
          <p>Loading your cart...</p>
        </div>
      `;

      if (elements.emptyCartMessage) {
        elements.emptyCartMessage.style.display = 'none';
      }

      if (elements.cartSummary) {
        elements.cartSummary.style.display = 'none';
      }

      return;
    }

    // Check if there's an error
    if (NWCACart.getError() && elements.cartItemsContainer) {
      debugCartUI("RENDER-ERROR", "Cart has error, showing error message:", NWCACart.getError()); // Added debug
      elements.cartItemsContainer.innerHTML = `
        <div class="alert alert-danger" role="alert">
          <h4 class="alert-heading">Error</h4>
          <p>${NWCACart.getError()}</p>
          <hr>
          <p class="mb-0">Please try refreshing the page or contact support if the problem persists.</p>
        </div>
      `;

      if (elements.emptyCartMessage) {
        elements.emptyCartMessage.style.display = 'none';
      }

      if (elements.cartSummary) {
        elements.cartSummary.style.display = 'none';
      }

      return;
    }

    // Handle empty cart
    // Use the adapted activeItems array
    if (!activeItems || activeItems.length === 0) {
      debugCartUI("RENDER", "Cart is empty, showing empty cart message"); // Added debug
      console.log("Cart is empty, showing empty cart message");
      if (elements.cartItemsContainer) {
        elements.cartItemsContainer.innerHTML = '';
      }

      if (elements.emptyCartMessage) {
        elements.emptyCartMessage.style.display = 'block';
      }

      if (elements.cartSummary) {
        elements.cartSummary.style.display = 'none';
      }

      // Still need to render saved items if any
      await renderSavedItems(savedItems); // Pass adapted savedItems and await

      return;
    }

    // Render active items
    if (elements.cartItemsContainer) {
      elements.cartItemsContainer.innerHTML = '';
      debugCartUI("RENDER", `Rendering ${activeItems.length} active items.`); // Added debug

      // Handle async rendering of items
      const itemElementsPromises = activeItems.map(item => renderCartItem(item)); // This now returns promises
      const itemElements = await Promise.all(itemElementsPromises); // Wait for all items to be rendered

      itemElements.forEach(itemElement => {
          if (itemElement) {
              elements.cartItemsContainer.appendChild(itemElement);
          } else {
              // Handle cases where renderCartItem returned null (e.g., invalid item)
              debugCartUI("RENDER-WARN", "renderCartItem returned null for an item.");
          }
      });


      if (elements.emptyCartMessage) {
        elements.emptyCartMessage.style.display = 'none';
      }

      if (elements.cartSummary) {
        elements.cartSummary.style.display = 'block';
      }
    }

    // Render saved items (using a separate helper function for clarity)
    await renderSavedItems(savedItems); // Pass adapted savedItems and await

    // Update cart summary
    updateCartSummary();

    // Attach PDF download listener *after* cart is rendered and summary is updated
    // Use cloning to prevent duplicate listeners if renderCart is called multiple times
    if (elements.downloadQuotePdfBtn) {
        const newPdfButton = elements.downloadQuotePdfBtn.cloneNode(true);
        elements.downloadQuotePdfBtn.parentNode.replaceChild(newPdfButton, elements.downloadQuotePdfBtn);
        elements.downloadQuotePdfBtn = newPdfButton; // Update reference in elements object

        // Only add listener if the cart is not empty
        if (activeItems && activeItems.length > 0) {
             elements.downloadQuotePdfBtn.disabled = false; // Ensure button is enabled
             elements.downloadQuotePdfBtn.addEventListener('click', window.NWCAOrderFormPDF.generate);
             debugCartUI("RENDER", "PDF download button listener attached.");
        } else {
             elements.downloadQuotePdfBtn.disabled = true; // Disable button if cart is empty
             debugCartUI("RENDER", "PDF download button disabled (cart empty).");
        }
    } else {
        debugCartUI("RENDER-WARN", "PDF download button element not found.");
    }

      debugCartUI("RENDER", "Finished renderCart function."); // Added debug
    } finally {
      // Clear rendering flag when done, even if there was an error
      isRendering = false;
    }
  }


  // --- START OF REPLACEMENT ---
  // Renders a single item in the cart
  async function renderCartItem(item) { // <-- Make renderCartItem async
    // Added check for item validity
    if (!item || !item.id || !item.styleNumber || !item.color || !item.embellishmentType) { // Added more checks for required fields
        debugCartUI("RENDER-ERROR", "Invalid or incomplete item passed to renderCartItem", item);
        return null; // Don't render if item is invalid
    }
    debugCartUI("RENDER", "Rendering cart item:", item);
    const itemElement = document.createElement('div');
    itemElement.className = 'cart-item card mb-3'; // Added bootstrap card styling
    itemElement.dataset.itemId = item.id; // Use item.id from adapted object
    itemElement.style.borderLeft = '4px solid #0056b3'; // Style from original

    // Format embellishment type using the helper
    const formattedEmbType = formatEmbellishmentType(item.embellishmentType);
    
    // Get total quantity for this embellishment type
    const totalQuantityForType = getTotalQuantityForEmbellishmentType(item.embellishmentType);
    
    // Get pricing tier based on total quantity
    const pricingTier = getPricingTierForQuantity(totalQuantityForType);

    // Basic item structure - Improved with Bootstrap structure
    itemElement.innerHTML = `
      <div class="card-body">
        <div class="d-flex justify-content-between align-items-start mb-2">
            <div>
                 <h5 class="card-title item-title mb-1">${item.styleNumber} - ${item.color}</h5>
                 <span class="item-embellishment badge" style="background-color: ${getEmbellishmentColor(item.embellishmentType)}; color: white;">${formattedEmbType}</span>
                 <div class="mt-1">
                    <small class="text-muted">Total ${formattedEmbType} Quantity: <span class="font-weight-bold">${totalQuantityForType}</span> (${pricingTier} pricing tier)</small>
                    ${totalQuantityForType < 24 ?
                      `<br><small class="text-danger"><strong>Less Than Minimum Fee Applied:</strong> $50.00 total fee ÷ ${totalQuantityForType} items = $${(50/totalQuantityForType).toFixed(2)} per item</small>` :
                      ''}
                 </div>
            </div>
            <button class="remove-item-btn btn btn-sm btn-outline-danger" data-item-id="${item.id}">&times;</button>
        </div>
        <div class="cart-item-details row">
            <div class="col-md-3 item-image-container mb-2 mb-md-0">
                 <img src="${item.imageUrl || ''}" alt="${item.styleNumber} - ${item.color}" class="item-image img-fluid rounded border" style="max-height: 150px; object-fit: contain;" onerror="this.style.display='none'; this.parentElement.innerHTML = '<div class=\'img-placeholder border rounded bg-light d-flex align-items-center justify-content-center\' style=\'height: 150px; width: 100%;\'><small class=\'text-muted\'>Image Error</small></div>';">
            </div>
          <div class="col-md-9">
              <div class="cart-item-options mb-2">
                ${renderEmbellishmentOptions(item.embellishmentOptions)}
              </div>
              <div class="cart-item-sizes">
                 <h6 class="sizes-header" style="background-color: #e9ecef; padding: 5px 10px; border-radius: 4px; margin-bottom: 10px;">Sizes & Quantities</h6>
                 {/* Sizes will be added below */}
              </div>
          </div>
        </div>
      </div>
    `;

    const sizesContainer = itemElement.querySelector('.cart-item-sizes');
    if (sizesContainer && item.sizes && Array.isArray(item.sizes)) {
        // Check if there are any valid sizes to render *before* clearing
        const validSizes = item.sizes.filter(sizeInfo => sizeInfo && sizeInfo.size && typeof sizeInfo.quantity !== 'undefined' && parseInt(sizeInfo.quantity) > 0);

        if (validSizes.length > 0) {
             sizesContainer.innerHTML = '<h6 class="sizes-header" style="background-color: #e9ecef; padding: 5px 10px; border-radius: 4px; margin-bottom: 10px;">Sizes & Quantities</h6>'; // Clear previous sizes but keep header

             // --- Fetch Pricing Matrix ID and Size Order ---
             let sizeGroupsOrder = []; // Default to empty array
             try {
                 debugCartUI("FETCH", `Looking up PricingMatrixID for ${item.styleNumber}/${item.color}/${item.embellishmentType}`);
                 const lookupUrl = `/api/pricing-matrix/lookup?styleNumber=${encodeURIComponent(item.styleNumber)}&color=${encodeURIComponent(item.color)}&embellishmentType=${encodeURIComponent(item.embellishmentType)}`;
                 const lookupResponse = await fetch(lookupUrl);

                 if (lookupResponse.ok) {
                     const lookupResult = await lookupResponse.json();
                     const pricingMatrixId = lookupResult.pricingMatrixId;
                     debugCartUI("FETCH", `Found PricingMatrixID: ${pricingMatrixId}`);

                     if (pricingMatrixId && window.PricingMatrixAPI) {
                         const pricingData = await window.PricingMatrixAPI.getPricingData(pricingMatrixId);
                         if (pricingData && Array.isArray(pricingData.headers)) {
                             sizeGroupsOrder = pricingData.headers; // Use 'headers' which contains the parsed SizeGroups
                             debugCartUI("FETCH", `Using SizeGroups order for item ${item.id}:`, sizeGroupsOrder);
                         } else {
                             debugCartUI("FETCH-WARN", `No valid size order (headers) found in pricing data for matrix ID ${pricingMatrixId}. Using default sort.`);
                         }
                     } else {
                          debugCartUI("FETCH-WARN", `No PricingMatrixID found or PricingMatrixAPI not available for item ${item.id}. Using default sort.`);
                     }
                 } else {
                     debugCartUI("FETCH-ERROR", `Failed to lookup PricingMatrixID for item ${item.id}. Status: ${lookupResponse.status}. Using default sort.`);
                 }
             } catch (error) {
                 console.error(`[CartUI] Error fetching size order for item ${item.id}:`, error);
                 debugCartUI("FETCH-ERROR", `Exception during size order fetch for item ${item.id}. Using default sort.`, error);
             }
             // --- End Fetch ---

             // Sort sizes according to the fetched group order
             const sortedSizes = sortSizesByGroupOrder(validSizes, sizeGroupsOrder);
             debugCartUI("RENDER", `Sorted sizes for item ${item.id} using group order: ${sortedSizes.map(s => s.size).join(', ')}`);

             sortedSizes.forEach(sizeInfo => {
                 const sizeElement = renderSizeItem(sizeInfo, item.id); // Use item.id here
                 if (sizeElement) {
                     sizesContainer.appendChild(sizeElement);
                 }
             });
         } else {
             debugCartUI("RENDER", `No valid sizes with quantity > 0 for item ${item.id}.`);
             // Keep header, maybe add message?
             sizesContainer.innerHTML += '<p><i>No sizes added for this item yet.</i></p>';
         }

    } else {
        debugCartUI("RENDER-WARN", `No sizes array found or sizes container missing for item ${item.id}`);
        if (sizesContainer) sizesContainer.innerHTML += 'No size details available.'; // Append to header
    }

    // Add event listener for the remove button within this item
    const removeButton = itemElement.querySelector('.remove-item-btn');
    if (removeButton) {
        // Remove existing listener to prevent duplicates if re-rendering
        // Cloning is a common way to achieve this simply
        const newRemoveButton = removeButton.cloneNode(true);
        removeButton.parentNode.replaceChild(newRemoveButton, removeButton);

        newRemoveButton.addEventListener('click', (event) => {
            // Prevent default if it's somehow inside a form/link
            event.preventDefault();
            const itemIdToRemove = event.target.closest('.cart-item').dataset.itemId; // More robust way to get itemId
            if (itemIdToRemove) {
                handleRemoveItem(itemIdToRemove);
            } else {
                 debugCartUI("RENDER-ERROR", "Could not find itemId on remove button click", event.target);
            }
        });
    }

    // --- Add Saved Item Specific Logic (Move to Cart button) ---
    if (item.isSaved) { // Assuming the adapted item has an 'isSaved' flag
        itemElement.style.backgroundColor = '#f8f9fa'; // Style from original
        itemElement.style.borderLeft = '4px solid #6c757d'; // Style from original

        const cardBody = itemElement.querySelector('.card-body');
        const header = itemElement.querySelector('.d-flex.justify-content-between');

        // Create Move to Cart Button
        const moveToCartBtn = document.createElement('button');
        moveToCartBtn.className = 'btn btn-sm btn-primary mr-2 move-to-cart-btn'; // Added class
        moveToCartBtn.textContent = 'Move to Cart';
        moveToCartBtn.dataset.itemId = item.id; // Use item.id here
        moveToCartBtn.style.marginRight = '5px'; // Add spacing

        // Add listener for Move to Cart
        moveToCartBtn.addEventListener('click', async (event) => {
            event.preventDefault();
            const itemIdToMove = event.target.dataset.itemId;
            moveToCartBtn.disabled = true;
            moveToCartBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Moving...';
            await moveToCart(itemIdToMove); // Call existing moveToCart function
            // No need to manually re-enable button, renderCart will redraw
        });

         // Insert Move button before Remove button
        if (header && header.lastElementChild) { // header.lastElementChild should be the remove button
            header.insertBefore(moveToCartBtn, header.lastElementChild);
        }

        // Disable quantity inputs for saved items
        itemElement.querySelectorAll('.quantity-input').forEach(input => input.disabled = true);
    }
     // --- End Saved Item Specific Logic ---

    return itemElement;
}


// Renders a single size line within a cart item
// sizeInfo: { size: 'L', quantity: 2, unitPrice: 25.99 }
// itemId: ID of the parent cart item
function renderSizeItem(sizeInfo, itemId) {
    // Add more robust check for valid sizeInfo properties
    if (!sizeInfo || typeof sizeInfo.size !== 'string' || sizeInfo.size.trim() === '' || typeof sizeInfo.quantity === 'undefined' || isNaN(parseInt(sizeInfo.quantity))) {
        debugCartUI("RENDER-SIZE-ERROR", "Invalid sizeInfo passed to renderSizeItem", {sizeInfo, itemId});
        return null; // Don't render if data is invalid
    }

    const quantity = parseInt(sizeInfo.quantity);
    // Also check for non-numeric or negative quantities explicitly
    if (isNaN(quantity) || quantity <= 0) {
        debugCartUI("RENDER-SIZE", `Skipping render for size ${sizeInfo.size} with invalid or zero quantity ${sizeInfo.quantity}`);
        return null; // Don't render items with 0 or negative quantity
    }

    const sizeElement = document.createElement('div');
    // Use d-flex for better alignment with Bootstrap
    sizeElement.className = 'cart-item-size-row d-flex justify-content-between align-items-center mb-2 p-2 rounded';
    sizeElement.style.backgroundColor = '#f8f9fa'; // Style from original
    // Add data attributes for potential updates
    sizeElement.dataset.itemId = itemId;
    sizeElement.dataset.size = sizeInfo.size;

    // Ensure unitPrice is treated as a number
    const unitPrice = typeof sizeInfo.unitPrice === 'string' ? parseFloat(sizeInfo.unitPrice.replace(/[^0-9.-]+/g,"")) : parseFloat(sizeInfo.unitPrice);
    // Use the formatCurrency helper for consistency
    const formattedPrice = !isNaN(unitPrice) && unitPrice > 0 ? formatCurrency(unitPrice) : 'N/A'; // Handle potential 0 or invalid price
    const lineTotal = (!isNaN(unitPrice) ? unitPrice : 0) * quantity;
    const formattedLineTotal = formatCurrency(lineTotal); // Use helper

    // Get embellishment type from the parent item
    // We need to find the embellishment type from the cart items since it's not passed to this function
    const parentItem = NWCACart.getCartItems('Active').find(item => item.CartItemID == itemId);
    const embellishmentType = parentItem ? parentItem.ImprintType : null;
    
    // Check if LTM fee applies
    const totalQuantityForType = embellishmentType ? getTotalQuantityForEmbellishmentType(embellishmentType) : 0;
    const hasLtmFee = totalQuantityForType < 24 && totalQuantityForType > 0;
    const ltmFeePerItem = hasLtmFee ? 50 / totalQuantityForType : 0;
    
    // Calculate base price and total price with LTM fee
    const basePrice = !isNaN(unitPrice) ? unitPrice - ltmFeePerItem : 0;
    const formattedBasePrice = formatCurrency(basePrice);
    
    sizeElement.innerHTML = `
        <span class="size-label font-weight-bold" style="min-width: 50px;">${sizeInfo.size}</span>
        <span class="size-quantity d-flex align-items-center">
             <label for="qty-${itemId}-${sizeInfo.size}" class="sr-only">Quantity for ${sizeInfo.size}</label>
             <input type="number" id="qty-${itemId}-${sizeInfo.size}" class="quantity-input form-control form-control-sm" value="${quantity}" min="0" data-item-id="${itemId}" data-size="${sizeInfo.size}" style="width: 60px; text-align: center; margin-left: 5px;">
        </span>
         <div class="text-right" style="min-width: 150px;">
             <span class="size-line-total d-block font-weight-bold" style="color: #0056b3;">${formattedLineTotal}</span>
             ${hasLtmFee ?
                `<span class="size-price d-block" style="font-size: 0.8em; color: #6c757d;">
                    (${formattedBasePrice} + $${ltmFeePerItem.toFixed(2)} LTM = ${formattedPrice} each)
                </span>` :
                `<span class="size-price d-block" style="font-size: 0.8em; color: #6c757d;">(${formattedPrice} each)</span>`
             }
         </div>
    `;

    // Add event listener for quantity changes
    const quantityInput = sizeElement.querySelector('.quantity-input');
    if (quantityInput) {
        // Cloning method to ensure old listeners are removed
        const newQuantityInput = quantityInput.cloneNode(true);
        quantityInput.parentNode.replaceChild(newQuantityInput, quantityInput);

        newQuantityInput.addEventListener('change', handleQuantityChange);
        // Optional: Add 'input' event listener for real-time updates if needed
        // newQuantityInput.addEventListener('input', debounce(handleQuantityChange, 300)); // Use debounce for 'input'
    }

    return sizeElement;
}
  // --- END OF REPLACEMENT ---


   // --- START: Added Helper Functions based on New Code ---

   /* Helper function to sort sizes based on a specific group order */
   function sortSizesByGroupOrder(sizesToSort, groupOrder) {
       if (!Array.isArray(groupOrder) || groupOrder.length === 0) {
           debugCartUI("SORT-WARN", "No valid groupOrder provided, returning original order.");
           // Fallback: Sort alphabetically or by a standard order if no groupOrder
           return [...sizesToSort].sort((a, b) => a.size.localeCompare(b.size)); // Example: Alphabetical fallback
       }

       // Create a map for quick lookup of order index
       const orderMap = new Map(groupOrder.map((size, index) => [size.toUpperCase(), index])); // Store uppercase for case-insensitive match

       return [...sizesToSort].sort((a, b) => {
           const sizeA = a.size.toUpperCase();
           const sizeB = b.size.toUpperCase();
           const indexA = orderMap.get(sizeA);
           const indexB = orderMap.get(sizeB);

           // Both sizes are in the groupOrder
           if (indexA !== undefined && indexB !== undefined) {
               return indexA - indexB;
           }
           // Only size A is in the groupOrder (comes first)
           if (indexA !== undefined) {
               return -1;
           }
           // Only size B is in the groupOrder (comes first)
           if (indexB !== undefined) {
               return 1;
           }
           // Neither size is in the groupOrder, maintain relative order or sort alphabetically
           // return 0; // Maintain original relative order
            return sizeA.localeCompare(sizeB); // Sort unknown sizes alphabetically (case-insensitive)
       });
   }


   // Helper to render embellishment options (similar to original but simplified)
   function renderEmbellishmentOptions(options) {
       if (!options || typeof options !== 'object' || Object.keys(options).length === 0) {
           return '<p><i>Standard decoration options apply.</i></p>'; // Default message
       }

       let optionsHtml = '<ul style="list-style-type: none; padding-left: 0; margin-bottom: 0; font-size: 0.9em;">';
       for (const [key, value] of Object.entries(options)) {
           // Skip empty or null values unless it's a boolean 'false'
           if (value !== null && value !== '' || typeof value === 'boolean') {
                optionsHtml += `<li style="margin-bottom: 3px;"><strong>${formatOptionName(key)}:</strong> ${formatOptionValue(key, value)}</li>`;
           }
       }
       optionsHtml += '</ul>';
       return optionsHtml;
   }


    // Helper function to adapt item format (if needed)
    // Modify this based on the actual differences between NWCACart output and new function input
    function adaptItemFormat(originalItem) {
        if (!originalItem) return null;
        return {
            id: originalItem.CartItemID, // Map CartItemID to id
            styleNumber: originalItem.StyleNumber, // Map StyleNumber to styleNumber
            color: originalItem.Color, // Map Color to color
            embellishmentType: originalItem.ImprintType, // Map ImprintType to embellishmentType
            imageUrl: originalItem.imageUrl || null, // Use existing imageUrl if present
            // Parse EmbellishmentOptions if they exist and are a string
            embellishmentOptions: typeof originalItem.EmbellishmentOptions === 'string' ? JSON.parse(originalItem.EmbellishmentOptions || '{}') : (originalItem.EmbellishmentOptions || {}),
            // Map sizes array, ensuring size/quantity/unitPrice format
            sizes: (originalItem.sizes || []).map(s => ({
                 size: s.Size, // Map Size to size
                 quantity: s.Quantity, // Map Quantity to quantity
                 unitPrice: s.UnitPrice // Map UnitPrice to unitPrice (ensure it's a number if needed)
            })),
             isSaved: originalItem.CartStatus === 'SavedForLater' // Add flag for saved items
        };
    }


   // Helper function to render saved items section
   async function renderSavedItems(savedItems) { // <-- Make renderSavedItems async
     debugCartUI("RENDER", `Rendering ${savedItems?.length || 0} saved items.`);
     if (elements.savedItemsContainer && elements.savedItemsList) {
       if (savedItems && savedItems.length > 0) {
         elements.savedItemsContainer.style.display = 'block';
         elements.savedItemsList.innerHTML = ''; // Clear previous

         // Handle async rendering of saved items
         const itemElementsPromises = savedItems.map(item => {
             // Ensure the item has the 'isSaved' flag or adapt here
             const adaptedItem = item.isSaved ? item : { ...item, isSaved: true };
             return renderCartItem(adaptedItem); // Returns a promise
         });
         const itemElements = await Promise.all(itemElementsPromises); // Wait for all saved items

         itemElements.forEach(itemElement => {
             if (itemElement) {
                 elements.savedItemsList.appendChild(itemElement);
             } else {
                 debugCartUI("RENDER-WARN", "renderCartItem returned null for a saved item.");
             }
         });

       } else {
         elements.savedItemsContainer.style.display = 'none';
       }
     } else {
        debugCartUI("RENDER-WARN", "Saved items container or list element not found.");
     }
   }

   // --- END: Added Helper Functions ---


  /**
   * Update the cart summary
   */
  function updateCartSummary() {
    // Get cart items and calculate totals
    const activeItems = NWCACart.getCartItems('Active');
    
    // Calculate subtotal from items
    let subtotal = 0;
    activeItems.forEach(item => {
      if (item.sizes && Array.isArray(item.sizes)) {
        item.sizes.forEach(size => {
          subtotal += (parseFloat(size.UnitPrice) || 0) * (parseInt(size.Quantity) || 0);
        });
      }
    });
    
    // Calculate LTM fee based on embellishment types
    let ltmFeeAmount = 0;
    
    // Get unique embellishment types
    const embellishmentTypes = [...new Set(activeItems.map(item => item.ImprintType))];
    
    // For each embellishment type, check if LTM fee applies
    embellishmentTypes.forEach(embType => {
      // Calculate total quantity for this embellishment type
      let totalQuantity = 0;
      activeItems.filter(item => item.ImprintType === embType).forEach(item => {
        if (item.sizes && Array.isArray(item.sizes)) {
          item.sizes.forEach(size => {
            totalQuantity += parseInt(size.Quantity) || 0;
          });
        }
      });
      
      // If quantity is less than 24, add LTM fee
      if (totalQuantity > 0 && totalQuantity < 24) {
        ltmFeeAmount += 50.00; // Add $50 LTM fee for each embellishment type below threshold
      }
    });
    
    const total = subtotal + ltmFeeAmount;
    debugCartUI("SUMMARY", `Updating summary: Subtotal=${subtotal}, LTM Fee=${ltmFeeAmount}, Total=${total}`);

    // Update cart summary
    if (elements.cartSubtotal) {
      elements.cartSubtotal.textContent = formatCurrency(subtotal);
    }

    if (elements.cartTotal) {
      elements.cartTotal.textContent = formatCurrency(total);
    }

    if (elements.ltmFee) {
      elements.ltmFee.textContent = formatCurrency(ltmFeeAmount);
      
      // Add explanation for LTM fee if it exists
      if (ltmFeeAmount > 0) {
        // Find or create the explanation element
        let ltmExplanation = document.getElementById('ltm-fee-explanation');
        if (!ltmExplanation) {
          ltmExplanation = document.createElement('small');
          ltmExplanation.id = 'ltm-fee-explanation';
          ltmExplanation.className = 'text-danger d-block mt-1';
          elements.ltmFee.parentNode.appendChild(ltmExplanation);
        }
        
        // Count embellishment types with LTM fee
        const embTypesWithLtm = embellishmentTypes.filter(embType => {
          const typeQuantity = getTotalQuantityForEmbellishmentType(embType);
          return typeQuantity > 0 && typeQuantity < 24;
        });
        
        ltmExplanation.innerHTML = `Applied to ${embTypesWithLtm.length} embellishment type${embTypesWithLtm.length !== 1 ? 's' : ''} with less than 24 items`;
      } else {
        // Remove explanation if it exists
        const ltmExplanation = document.getElementById('ltm-fee-explanation');
        if (ltmExplanation) {
          ltmExplanation.remove();
        }
      }
    }

    if (elements.ltmFeeRow) {
      // Check if display should be flex or table-row depending on original CSS
      const displayStyle = elements.ltmFeeRow.tagName === 'TR' ? 'table-row' : 'flex';
      elements.ltmFeeRow.style.display = ltmFeeAmount > 0 ? displayStyle : 'none';
      
      // Add a highlight to the row if LTM fee exists
      if (ltmFeeAmount > 0) {
        elements.ltmFeeRow.style.backgroundColor = '#fff8e8';
        elements.ltmFeeRow.style.padding = '5px';
        elements.ltmFeeRow.style.borderRadius = '4px';
      } else {
        elements.ltmFeeRow.style.backgroundColor = '';
        elements.ltmFeeRow.style.padding = '';
        elements.ltmFeeRow.style.borderRadius = '';
      }
    }

    // Update review summary (if these elements exist)
    if (elements.reviewSubtotal) {
      elements.reviewSubtotal.textContent = formatCurrency(subtotal);
    }

    if (elements.reviewTotal) {
      elements.reviewTotal.textContent = formatCurrency(total);
    }

    if (elements.reviewLtmFee) {
      elements.reviewLtmFee.textContent = formatCurrency(ltmFeeAmount);
      const reviewLtmRow = elements.reviewLtmFee.closest('tr') || elements.reviewLtmFee.closest('.row'); // Try to find parent row
      
      if (reviewLtmRow) {
        reviewLtmRow.style.display = ltmFeeAmount > 0 ? '' : 'none'; // Show/hide row
        
        // Add highlighting and explanation if LTM fee exists
        if (ltmFeeAmount > 0) {
          reviewLtmRow.style.backgroundColor = '#fff8e8';
          reviewLtmRow.style.padding = '5px';
          reviewLtmRow.style.borderRadius = '4px';
          
          // Add explanation for LTM fee
          let reviewLtmExplanation = document.getElementById('review-ltm-explanation');
          if (!reviewLtmExplanation) {
            reviewLtmExplanation = document.createElement('small');
            reviewLtmExplanation.id = 'review-ltm-explanation';
            reviewLtmExplanation.className = 'text-danger d-block mt-1';
            elements.reviewLtmFee.parentNode.appendChild(reviewLtmExplanation);
          }
          
          // Count embellishment types with LTM fee
          const embTypesWithLtm = embellishmentTypes.filter(embType => {
            const typeQuantity = getTotalQuantityForEmbellishmentType(embType);
            return typeQuantity > 0 && typeQuantity < 24;
          });
          
          reviewLtmExplanation.innerHTML = `Applied to ${embTypesWithLtm.length} embellishment type${embTypesWithLtm.length !== 1 ? 's' : ''} with less than 24 items`;
        } else {
          reviewLtmRow.style.backgroundColor = '';
          reviewLtmRow.style.padding = '';
          reviewLtmRow.style.borderRadius = '';
          
          // Remove explanation if it exists
          const reviewLtmExplanation = document.getElementById('review-ltm-explanation');
          if (reviewLtmExplanation) {
            reviewLtmExplanation.remove();
          }
        }
      }
    }
  }

  /**
   * Handle save for later
   */
  async function handleSaveForLater() {
     debugCartUI("ACTION", "Attempting to save cart for later.");
    // Assuming NWCACart.saveForLater still works as intended
    const result = await NWCACart.saveForLater();

    if (result.success) {
       debugCartUI("ACTION-SUCCESS", "Save for later successful.");
      showNotification('Your cart has been saved for later', 'success');
    } else {
        debugCartUI("ACTION-ERROR", "Save for later failed.", result.error);
      showNotification(result.error || 'Failed to save cart for later', 'danger');
    }
  }

  /**
   * Move an item to the cart
   * @param {string|number} itemId - Cart item ID (use the ID format expected by the API)
   */
  async function moveToCart(itemId) {
     debugCartUI("ACTION", `Attempting to move item ${itemId} to cart.`);
    try {
        // *** ADAPTATION POINT ***
        // Find the item in the *original* format if NWCACart uses that internally
        const originalItem = NWCACart.getCartItems().find(item => item.CartItemID == itemId); // Use == for potential type mismatch

        if (!originalItem) {
            throw new Error(`Item with ID ${itemId} not found in saved items.`);
        }

        // Call the API - Ensure the API endpoint and payload match requirements
        // The original code used PUT /api/cart-items/:cartItemId
        // Ensure the payload uses the correct status ('Active') and includes necessary fields
        const response = await fetch(`/api/cart-items/${itemId}`, { // Assuming API uses the ID directly
             method: 'PUT',
             headers: {
                 'Content-Type': 'application/json'
             },
             body: JSON.stringify({
                 // Send necessary fields, ensure CartStatus is correct
                 ...originalItem, // Spread original fields (may need filtering/mapping)
                 CartStatus: 'Active' // Target status
             })
        });

        if (!response.ok) {
             const errorData = await response.text(); // Get more error info
             throw new Error(`API Error (${response.status}): ${errorData}`);
        }

        debugCartUI("ACTION-SUCCESS", `API call successful for moving item ${itemId} to cart.`);

        // *** IMPORTANT: Rely on NWCACart to update its internal state ***
        // Instead of manually updating local state, trigger a sync or let the
        // cartUpdated event handle the refresh after NWCACart syncs.
        await NWCACart.syncWithServer(); // Trigger a refresh from the server

        showNotification('Item moved to cart', 'success');

    } catch (error) {
        console.error('Error moving item to cart:', error);
        debugCartUI("ACTION-ERROR", `Error moving item ${itemId} to cart:`, error.message);
        showNotification(`Failed to move item to cart: ${error.message}`, 'danger');
        // Re-render might be needed to reset button states if sync fails
        renderCart();
    }
}


  /**
   * Handle shipping form submission
   * @param {Event} event - Form submission event
   */
  function handleShippingFormSubmit(event) {
    event.preventDefault();
     debugCartUI("ACTION", "Handling shipping form submission.");

    // Get form data
    const formData = new FormData(elements.shippingForm);
    customerData = Object.fromEntries(formData.entries());
     debugCartUI("DATA", "Customer Shipping Data:", customerData);

    // Validate form
    const requiredFields = ['name', 'email', 'phone', 'address1', 'city', 'state', 'zipCode', 'country'];
    const missingFields = requiredFields.filter(field => !customerData[field] || customerData[field].trim() === '');

    if (missingFields.length > 0) {
       const message = `Please fill in all required fields: ${missingFields.join(', ')}`;
       debugCartUI("VALIDATE-ERROR", message);
      showNotification(message, 'danger');
      return;
    }

    // Render customer info in review step
    renderCustomerInfo();

    // Render items in review step
    renderReviewItems();

    // Go to review step
    goToStep(3);
  }

  /**
   * Render customer info in review step
   */
  function renderCustomerInfo() {
    if (!elements.reviewCustomerInfo) {
         debugCartUI("RENDER-WARN", "Review customer info element not found.");
         return;
    }
     debugCartUI("RENDER", "Rendering customer info for review.");

    elements.reviewCustomerInfo.innerHTML = `
      <h5>${customerData.name}</h5>
      <p>${customerData.email}</p>
      <p>${customerData.phone}</p>
      ${customerData.company ? `<p>${customerData.company}</p>` : ''}
      <p>${customerData.address1}</p>
      ${customerData.address2 ? `<p>${customerData.address2}</p>` : ''}
      <p>${customerData.city}, ${customerData.state} ${customerData.zipCode}</p>
      <p>${customerData.country}</p>
      ${customerData.notes ? `<p><strong>Notes:</strong> ${customerData.notes}</p>` : ''} {/* Added Notes */}
    `;
  }

  /**
   * Render items in review step
   */
  function renderReviewItems() {
    if (!elements.reviewItemsList) {
         debugCartUI("RENDER-WARN", "Review items list element not found.");
         return;
    }
     debugCartUI("RENDER", "Rendering items for review step.");

    elements.reviewItemsList.innerHTML = '';

    // Get ACTIVE items using the original NWCACart method and adapt format
    const activeItemsOriginal = NWCACart.getCartItems('Active');
    const activeItems = activeItemsOriginal.map(adaptItemFormat); // Use the same adapter

    if (!activeItems || activeItems.length === 0) {
         elements.reviewItemsList.innerHTML = '<p>Your cart is empty.</p>';
         return;
    }

    activeItems.forEach(item => {
       // Ensure item is valid before processing
       if (!item || !item.id) {
           debugCartUI("RENDER-WARN", "Skipping invalid item in renderReviewItems", item);
           return;
       }

      const itemElement = document.createElement('div');
      itemElement.className = 'review-item mb-3 p-3 border rounded'; // Added styling

      let sizesHtml = '';
      let totalQuantity = 0;
      let itemTotal = 0;

       // Check if sizes exist and is an array
       if (item.sizes && Array.isArray(item.sizes)) {
            item.sizes.forEach(sizeInfo => {
                 // Validate sizeInfo and quantity
                 const quantity = parseInt(sizeInfo.quantity);
                 if (sizeInfo && sizeInfo.size && !isNaN(quantity) && quantity > 0) {
                      const unitPrice = parseFloat(sizeInfo.unitPrice) || 0;
                      const lineTotal = unitPrice * quantity;
                      itemTotal += lineTotal;
                      totalQuantity += quantity;

                      // Get total quantity for this embellishment type
                      const totalQuantityForType = getTotalQuantityForEmbellishmentType(item.embellishmentType);
                      const hasLtmFee = totalQuantityForType < 24 && totalQuantityForType > 0;
                      const ltmFeePerItem = hasLtmFee ? 50 / totalQuantityForType : 0;
                      const basePrice = unitPrice - ltmFeePerItem;
                      
                      // Format the unit price display
                      let unitPriceDisplay = formatCurrency(unitPrice);
                      if (hasLtmFee) {
                          unitPriceDisplay = `${formatCurrency(basePrice)} + ${formatCurrency(ltmFeePerItem)} LTM`;
                      }
                      
                      sizesHtml += `
                      <div class="d-flex justify-content-between align-items-center py-1 border-bottom">
                          <span class="font-weight-bold" style="min-width: 50px;">${sizeInfo.size}</span>
                          <span style="min-width: 50px; text-align: center;">${quantity}</span>
                          <span style="min-width: 120px; text-align: right;">${unitPriceDisplay}</span>
                          <span style="min-width: 80px; text-align: right; font-weight: bold;">${formatCurrency(lineTotal)}</span>
                      </div>
                      `;
                 }
            });
       } else {
           debugCartUI("RENDER-WARN", `Item ${item.id} has no valid sizes array for review rendering.`);
            sizesHtml = '<p><i>No size details for this item.</i></p>';
       }


      // Get total quantity for this embellishment type across all items
      const totalQuantityForType = getTotalQuantityForEmbellishmentType(item.embellishmentType);
      const pricingTier = getPricingTierForQuantity(totalQuantityForType);
      const hasLtmFee = totalQuantityForType < 24 && totalQuantityForType > 0;
      const ltmFeePerItem = hasLtmFee ? 50 / totalQuantityForType : 0;
      
      itemElement.innerHTML = `
        <div class="d-flex justify-content-between align-items-center mb-2">
          <div>
             <!-- Use adapted item properties -->
            <h5 class="mb-1">${item.styleNumber} - ${item.color}</h5>
            <p class="mb-1">Embellishment: ${formatEmbellishmentType(item.embellishmentType)}</p>
            <p class="mb-1"><small class="text-muted">Total ${formatEmbellishmentType(item.embellishmentType)} Quantity: <span class="font-weight-bold">${totalQuantityForType}</span> (${pricingTier} pricing tier)</small></p>
            ${hasLtmFee ?
              `<p class="mb-1"><small class="text-danger"><strong>Less Than Minimum Fee Applied:</strong> $50.00 total fee ÷ ${totalQuantityForType} items = $${ltmFeePerItem.toFixed(2)} per item</small></p>` :
              ''}
             <!-- Embellishment options -->
             <div class="embellishment-options small text-muted mt-2">
                ${renderEmbellishmentOptions(item.embellishmentOptions)}
             </div>
          </div>
          <div class="text-right">
            <p class="mb-1">Item Quantity: ${totalQuantity}</p>
            <p class="mb-0 font-weight-bold">Item Total: ${formatCurrency(itemTotal)}</p>
          </div>
        </div>
        <div class="sizes-container mt-2">
          <div class="d-flex justify-content-between font-weight-bold border-bottom pb-1 mb-1">
            <span>Size</span>
            <span>Quantity</span>
            <span>Unit Price</span>
            <span>Total</span>
          </div>
          ${sizesHtml || '<p><i>No items with quantity > 0.</i></p>'}
        </div>
      `;

      elements.reviewItemsList.appendChild(itemElement);
    });
  }

  /**
   * Handle submit quote request
   */
  async function handleSubmitQuoteRequest() {
     debugCartUI("ACTION", "Attempting to submit quote request.");
    
    // Get active items first to check if cart is empty locally
    const items = NWCACart.getCartItems('Active'); // Ensure NWCACart.getCartItems exists and works
    if (items.length === 0) {
      showNotification('Your quote request list is empty.', 'warning');
      return;
    }

    // Disable button, show loading state (optional, add if needed)
    if (elements.submitOrderBtn) elements.submitOrderBtn.disabled = true;
    // You might want to add a loading spinner indicator here
    showNotification('Submitting quote request...', 'info'); 

    try {
       const result = await NWCACart.submitQuoteRequest(); // Call the function in cart.js

       if (result.success) {
           debugCartUI("ACTION-SUCCESS", "Quote Request Submitted Successfully!");
           showNotification('Quote Request Submitted Successfully!', 'success');
           // Option 1: Clear cart display (NWCACart already removes items locally)
           renderCart(); // Re-render to show the empty cart (if items were removed locally)
           // Option 2: Redirect to a confirmation page
           // window.location.href = '/quote-submitted.html'; // Create this page if needed
       } else {
           debugCartUI("ACTION-ERROR", "Error submitting quote request", result.error);
           showNotification(`Error submitting quote request: ${result.error || 'Unknown error.'}`, 'danger');
       }
    } catch (error) {
       console.error('Critical error submitting quote request:', error);
       debugCartUI("ACTION-CRITICAL-ERROR", "An unexpected error occurred.", error);
       showNotification('An unexpected critical error occurred while submitting your quote request. Please try again later.', 'danger');
    } finally {
        // Re-enable button, hide loading state (optional)
        if (elements.submitOrderBtn) elements.submitOrderBtn.disabled = false;
        // Hide loading spinner here
    }
  }

  /**
   * Go to a specific step
   * @param {number} step - Step number
   */
  function goToStep(step) {
     debugCartUI("NAVIGATION", `Going to step: ${step}`);
    currentStep = step;

    // Update progress steps
    if (elements.progressSteps) {
      elements.progressSteps.forEach((stepElement, index) => {
         // Get step number from data attribute or index
         const stepNum = parseInt(stepElement.dataset.step || (index + 1));
         stepElement.classList.remove('active', 'completed'); // Reset first
         if (stepNum < step) {
             stepElement.classList.add('completed');
         } else if (stepNum === step) {
             stepElement.classList.add('active');
         }
      });
    }

    // Show/hide containers based on step
    // Use a more robust way to hide/show all relevant sections
    const stepContainers = [
        elements.cartItemsContainer?.parentElement, // Assuming items are in a main cart area
        elements.cartSummary,
        elements.savedItemsContainer,
        elements.shippingFormContainer,
        elements.reviewOrderContainer,
        elements.orderConfirmationContainer
        // Add any other step-specific containers here
    ];

     stepContainers.forEach(container => {
         if (container) container.style.display = 'none'; // Hide all first
     });

     // Now show the correct one(s) for the current step
     switch (step) {
         case 1: // Cart View
             if (elements.cartItemsContainer) elements.cartItemsContainer.parentElement.style.display = 'block';
             // Handle empty cart message visibility
             const hasActiveItems = NWCACart.getCartItems('Active').length > 0;
             if (elements.emptyCartMessage) elements.emptyCartMessage.style.display = hasActiveItems ? 'none' : 'block';
             if (elements.cartSummary) elements.cartSummary.style.display = hasActiveItems ? 'block' : 'none'; // Or 'table' etc.
             if (elements.savedItemsContainer) {
                // Check if saved items exist before showing
                const hasSavedItems = NWCACart.getCartItems('SavedForLater').length > 0;
                elements.savedItemsContainer.style.display = hasSavedItems ? 'block' : 'none';
             }
             break;
         case 2: // Shipping
             if (elements.shippingFormContainer) elements.shippingFormContainer.style.display = 'block';
             break;
         case 3: // Review
             if (elements.reviewOrderContainer) elements.reviewOrderContainer.style.display = 'block';
             break;
         case 4: // Confirmation
             if (elements.orderConfirmationContainer) elements.orderConfirmationContainer.style.display = 'block';
             break;
     }

      // Scroll to top might be helpful
      window.scrollTo(0, 0);
  }

  /**
   * Show a notification
   * @param {string} message - Notification message
   * @param {string} type - Notification type (success, danger, warning, info)
   */
  function showNotification(message, type = 'info') {
    // Simple console log as fallback or addition
     console.log(`[Notification-${type}]: ${message}`);

    // Check if Bootstrap's alert component is available
    if (typeof $ !== 'undefined' && $.fn.alert) {
        // Create notification element using Bootstrap classes
        const notificationContainer = document.getElementById('notification-area') || document.body; // Prefer a dedicated area
         if (!document.getElementById('notification-area') && notificationContainer === document.body) {
             // Add a container if using body
             const containerDiv = document.createElement('div');
             containerDiv.id = 'notification-area';
             containerDiv.style.position = 'fixed';
             containerDiv.style.top = '20px';
             containerDiv.style.right = '20px';
             containerDiv.style.zIndex = '1050'; // Ensure it's above modals etc.
             containerDiv.style.maxWidth = '400px';
             document.body.appendChild(containerDiv);
         }


        const notification = document.createElement('div');
        notification.className = `alert alert-${type} alert-dismissible fade show m-2`; // Added margin
        notification.setAttribute('role', 'alert');
        notification.innerHTML = `
          ${message}
          <button type="button" class="close" data-dismiss="alert" aria-label="Close">
            <span aria-hidden="true">&times;</span>
          </button>
        `;

        // Add to page (prefer dedicated container)
         const targetContainer = document.getElementById('notification-area') || document.body;
        targetContainer.appendChild(notification);

        // Use Bootstrap's alert close mechanism and auto-dismiss
        $(notification).alert(); // Initialize the Bootstrap alert
        setTimeout(() => {
            $(notification).alert('close');
        }, 5000); // Auto-close after 5 seconds

     } else {
         // Fallback if Bootstrap JS isn't loaded
         alert(`(${type}): ${message}`); // Simple browser alert
     }
  }


  /**
   * Format currency
   * @param {number|string} amount - Amount to format
   * @returns {string} - Formatted currency
   */
  function formatCurrency(amount) {
     // Ensure amount is a number, handle potential strings like "$15.00"
     const numericAmount = typeof amount === 'string' ? parseFloat(amount.replace(/[^0-9.-]+/g,"")) : Number(amount);

     if (isNaN(numericAmount)) {
         // Handle cases where conversion fails, return default or input
         // console.warn("formatCurrency received non-numeric value:", amount);
         return '$?.??'; // Or return original string, or '$0.00'
     }

    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(numericAmount);
  }

  /**
   * Format embellishment type
   * @param {string} type - Embellishment type
   * @returns {string} - Formatted embellishment type
   */
  function formatEmbellishmentType(type) {
     if (!type) return 'Unknown'; // Handle null/undefined types
     const typeLower = type.toLowerCase(); // Standardize comparison
    switch (typeLower) {
      case 'embroidery':
        return 'Embroidery';
      case 'cap-embroidery':
        return 'Cap Embroidery';
      case 'dtg':
        return 'DTG Print'; // Clarified name
      case 'dtf':
        return 'DTF Transfer'; // Clarified name
      case 'screen-print':
      case 'screenprint': // Added alias
        return 'Screen Print';
       case 'vinyl':
            return 'Vinyl/Heat Transfer'; // Added option
      default:
        // Capitalize first letter if unknown
        return type.charAt(0).toUpperCase() + type.slice(1);
    }
  }
  
  /**
   * Get total quantity for a specific embellishment type across all cart items
   * @param {string} embellishmentType - The embellishment type to calculate total for
   * @returns {number} - Total quantity
   */
  function getTotalQuantityForEmbellishmentType(embellishmentType) {
    if (!embellishmentType || typeof NWCACart === 'undefined') {
      return 0;
    }
    
    let totalQuantity = 0;
    const cartItems = NWCACart.getCartItems('Active');
    
    // Filter items by embellishment type
    const itemsOfType = cartItems.filter(item => item.ImprintType === embellishmentType);
    
    // Calculate total quantity
    itemsOfType.forEach(item => {
      if (item.sizes && Array.isArray(item.sizes)) {
        item.sizes.forEach(size => {
          totalQuantity += parseInt(size.Quantity) || 0;
        });
      }
    });
    
    return totalQuantity;
  }
  
  /**
   * Get pricing tier description based on quantity
   * @param {number} quantity - The total quantity
   * @returns {string} - Pricing tier description
   */
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

  /**
   * Get color for embellishment type badge
   * @param {string} type - Embellishment type
   * @returns {string} - Color code
   */
  function getEmbellishmentColor(type) {
      if (!type) return '#6c757d'; // Default Gray
      const typeLower = type.toLowerCase();
    switch (typeLower) {
      case 'embroidery':
        return '#28a745'; // Green
      case 'cap-embroidery':
        return '#20c997'; // Teal
      case 'dtg':
        return '#007bff'; // Blue
      case 'dtf':
        return '#6f42c1'; // Purple (Bootstrap purple)
      case 'screen-print':
      case 'screenprint':
        return '#fd7e14'; // Orange
       case 'vinyl':
            return '#dc3545'; // Red
      default:
        return '#6c757d'; // Gray
    }
  }

  /**
   * Format option name
   * @param {string} name - Option name
   * @returns {string} - Formatted option name
   */
  function formatOptionName(name) {
     if (!name) return '';
    // Convert camelCase or snake_case to Title Case with Spaces
    return name
       .replace(/([A-Z])/g, ' $1') // Add space before capitals
       .replace(/_/g, ' ')        // Replace underscores with spaces
       .replace(/^./, str => str.toUpperCase()) // Capitalize first letter
       .trim();                   // Remove leading/trailing spaces
  }

  /**
   * Format option value
   * @param {string} key - Option key
   * @param {any} value - Option value
   * @returns {string} - Formatted option value
   */
  function formatOptionValue(key, value) {
    if (value === null || typeof value === 'undefined') {
        return 'N/A';
    }
    if (typeof value === 'boolean') {
      return value ? 'Yes' : 'No';
    }

     // Format specific keys nicely
     const keyLower = key.toLowerCase();
    if (keyLower.includes('stitchcount') || keyLower.includes('stitches')) {
      return `${Number(value).toLocaleString()} stitches`;
    }
     if (keyLower.includes('colorcount') || keyLower.includes('colors')) {
       const count = Number(value);
       return `${count} color${count !== 1 ? 's' : ''}`;
     }
     // Example: Format location names if needed
     // if (keyLower === 'location' && typeof value === 'string') {
     //    return value.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()); // Title case location
     // }

    // Default: return value as string
    return String(value);
  }

  // Public API
  return {
    initialize,
    renderCart, // Expose main render function
    goToStep, // Expose navigation function
    showNotification // Expose notification function maybe?
    // Expose other functions if they need to be called externally
  };
})();

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
  // Ensure NWCACart is loaded before initializing UI
  if (typeof NWCACart !== 'undefined') {
     NWCACartUI.initialize();
  } else {
      console.error("NWCACart is not defined. Cart UI cannot initialize.");
      // Optionally display an error message to the user on the page
      const cartContainer = document.getElementById('cart-items-container');
      if (cartContainer) {
          cartContainer.innerHTML = '<div class="alert alert-danger">Could not load shopping cart module. Please refresh or contact support.</div>';
      }
  }
});