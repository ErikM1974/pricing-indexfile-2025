// cart-ui.js - UI handling for the shopping cart page

/**
 * Cart UI Module for Northwest Custom Apparel
 * Handles rendering and interaction with the shopping cart UI
 */
const NWCACartUI = (function() {
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
    NWCACart.addEventListener('cartUpdated', renderCart);

    // Force a sync with the server before initial render
    console.log("Initializing cart UI, syncing with server...");
    NWCACart.syncWithServer()
      .then(() => {
        console.log("Cart sync complete, rendering cart..."); // This log might be premature
        // renderCart(); // <-- Removed direct call

        // Initialize progress steps
        goToStep(1);
      })
      .catch(error => {
        console.error("Error syncing cart:", error);
        // Render anyway even if sync fails
        renderCart();
      });
  }

  /**
   * Render the cart
   */
  function renderCart() {
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
      renderSavedItems(savedItems); // Pass adapted savedItems

      return;
    }

    // Render active items
    if (elements.cartItemsContainer) {
      elements.cartItemsContainer.innerHTML = '';
      debugCartUI("RENDER", `Rendering ${activeItems.length} active items.`); // Added debug

      activeItems.forEach(item => {
        // Pass the adapted item to the new renderCartItem
        const itemElement = renderCartItem(item); // Use the NEW function
        if (itemElement) { // Check if renderCartItem returned an element
             elements.cartItemsContainer.appendChild(itemElement);
        } else {
            debugCartUI("RENDER-WARN", "renderCartItem returned null for item:", item);
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
    renderSavedItems(savedItems); // Pass adapted savedItems

    // Update cart summary
    updateCartSummary();
     debugCartUI("RENDER", "Finished renderCart function."); // Added debug
  }


  // --- START OF REPLACEMENT ---
  // Renders a single item in the cart
  function renderCartItem(item) {
    // Added check for item validity
    if (!item || !item.id) {
        debugCartUI("RENDER-ERROR", "Invalid item passed to renderCartItem", item);
        return null; // Don't render if item is invalid
    }
    debugCartUI("RENDER", "Rendering cart item:", item);
    const itemElement = document.createElement('div');
    itemElement.className = 'cart-item card mb-3'; // Added bootstrap card styling
    itemElement.dataset.itemId = item.id; // Use item.id from adapted object
    itemElement.style.borderLeft = '4px solid #0056b3'; // Style from original

    // Format embellishment type using the helper
    const formattedEmbType = formatEmbellishmentType(item.embellishmentType);

    // Basic item structure - Improved with Bootstrap structure
    itemElement.innerHTML = `
      <div class="card-body">
        <div class="d-flex justify-content-between align-items-start mb-2">
            <div>
                 <h5 class="card-title item-title mb-1">${item.styleNumber} - ${item.color}</h5>
                 <span class="item-embellishment badge" style="background-color: ${getEmbellishmentColor(item.embellishmentType)}; color: white;">${formattedEmbType}</span>
            </div>
            <button class="remove-item-btn btn btn-sm btn-outline-danger" data-item-id="${item.id}">&times;</button>
        </div>
        <div class="cart-item-details row">
          ${item.imageUrl ? `
            <div class="col-md-3 item-image-container">
                 <img src="${item.imageUrl}" alt="${item.styleNumber}" class="item-image img-fluid rounded border">
            </div>
          ` : ''}
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
             validSizes.forEach(sizeInfo => {
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

    sizeElement.innerHTML = `
        <span class="size-label font-weight-bold" style="min-width: 50px;">${sizeInfo.size}</span>
        <span class="size-quantity d-flex align-items-center">
             <label for="qty-${itemId}-${sizeInfo.size}" class="sr-only">Quantity for ${sizeInfo.size}</label>
             <input type="number" id="qty-${itemId}-${sizeInfo.size}" class="quantity-input form-control form-control-sm" value="${quantity}" min="0" data-item-id="${itemId}" data-size="${sizeInfo.size}" style="width: 60px; text-align: center; margin-left: 5px;">
        </span>
         <div class="text-right" style="min-width: 100px;">
             <span class="size-line-total d-block font-weight-bold" style="color: #0056b3;">${formattedLineTotal}</span>
             <span class="size-price d-block" style="font-size: 0.8em; color: #6c757d;">(${formattedPrice} each)</span>
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
   function renderSavedItems(savedItems) {
     debugCartUI("RENDER", `Rendering ${savedItems?.length || 0} saved items.`);
     if (elements.savedItemsContainer && elements.savedItemsList) {
       if (savedItems && savedItems.length > 0) {
         elements.savedItemsContainer.style.display = 'block';
         elements.savedItemsList.innerHTML = ''; // Clear previous

         savedItems.forEach(item => {
           // Ensure the item has the 'isSaved' flag or adapt here
           const adaptedItem = item.isSaved ? item : { ...item, isSaved: true };
           const itemElement = renderCartItem(adaptedItem); // Use the NEW renderCartItem
           if (itemElement) {
               elements.savedItemsList.appendChild(itemElement);
           } else {
                debugCartUI("RENDER-WARN", "renderCartItem returned null for saved item:", adaptedItem);
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
    // *** IMPORTANT: NWCACart.getCartTotal() might need adjustment ***
    // If NWCACart calculated totals based on the OLD item structure,
    // ensure it now correctly calculates based on the potentially NEW structure
    // (e.g., using 'unitPrice' instead of 'UnitPrice').
    // Or, if NWCACart still works correctly, this part is fine.
    const subtotal = NWCACart.getCartTotal(); // Assuming this still works
    const ltmFeeAmount = subtotal < 100 ? 15 : 0; // Example: Less Than Minimum fee
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
    }

    if (elements.ltmFeeRow) {
      // Check if display should be flex or table-row depending on original CSS
       const displayStyle = elements.ltmFeeRow.tagName === 'TR' ? 'table-row' : 'flex';
      elements.ltmFeeRow.style.display = ltmFeeAmount > 0 ? displayStyle : 'none';
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

                      sizesHtml += `
                      <div class="d-flex justify-content-between">
                          <span>${sizeInfo.size}</span>
                          <span>${quantity}</span>
                          <span>${formatCurrency(lineTotal)}</span>
                      </div>
                      `;
                 }
            });
       } else {
           debugCartUI("RENDER-WARN", `Item ${item.id} has no valid sizes array for review rendering.`);
            sizesHtml = '<p><i>No size details for this item.</i></p>';
       }


      itemElement.innerHTML = `
        <div class="d-flex justify-content-between align-items-center mb-2">
          <div>
             {/* Use adapted item properties */}
            <h5 class="mb-1">${item.styleNumber} - ${item.color}</h5>
            <p class="mb-1">Embellishment: ${formatEmbellishmentType(item.embellishmentType)}</p>
             {/* Optionally show embellishment options again here if needed */}
          </div>
          <div class="text-right">
            <p class="mb-1">Total Quantity: ${totalQuantity}</p>
            <p class="mb-0 font-weight-bold">Item Total: ${formatCurrency(itemTotal)}</p>
          </div>
        </div>
        <div class="sizes-container mt-2">
          <div class="d-flex justify-content-between font-weight-bold border-bottom pb-1 mb-1">
            <span>Size</span>
            <span>Quantity</span>
            <span>Price</span>
          </div>
          ${sizesHtml || '<p><i>No items with quantity > 0.</i></p>'} {/* Fallback message */}
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