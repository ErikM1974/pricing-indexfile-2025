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
    downloadQuotePdfBtn: document.getElementById('download-quote-pdf-btn'),

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

  // Current step
  let currentStep = 1;

  // Customer data
  let customerData = {};

  function debugCartUI(level, message, data = null) {
      console.log(`[CartUI-${level}] ${message}`, data);
  }

  async function handleRemoveItem(itemId) {
      debugCartUI("ACTION", `Attempting to remove item: ${itemId}`);
      const itemIdNumber = parseInt(itemId, 10);
      if (isNaN(itemIdNumber)) {
          showNotification('Error: Invalid item ID format.', 'danger');
          debugCartUI("ACTION-ERROR", `Invalid item ID for removal: ${itemId}`);
          return; 
      }
      const result = await NWCACart.removeItem(itemIdNumber); 
      if (!result || !result.success) {
          showNotification(result?.error || `Failed to remove item ${itemIdNumber}`, 'danger');
          debugCartUI("ACTION-ERROR", `Failed removal for item: ${itemIdNumber}`, result);
      } else {
         showNotification(`Item removed successfully`, 'success');
         debugCartUI("ACTION-SUCCESS", `Successfully removed item: ${itemIdNumber}`);
      }
  }

  async function handleQuantityChange(event) {
      const input = event.target;
      const itemId = input.dataset.itemId; 
      const size = input.dataset.size;
      const newQuantity = parseInt(input.value);

      if (isNaN(newQuantity) || newQuantity < 0) {
          showNotification('Please enter a valid quantity.', 'warning');
          return;
      }
      const itemIdNumber = parseInt(itemId, 10); 
      if (isNaN(itemIdNumber)) { 
          showNotification('Error: Invalid item ID format for quantity update.', 'danger');
          debugCartUI("ACTION-ERROR", `Invalid item ID for quantity update: ${itemId}`);
          return; 
      }
      debugCartUI("ACTION", `Attempting to update quantity for item ${itemIdNumber}, size ${size} to ${newQuantity}`); 
      input.disabled = true;
      const result = await NWCACart.updateQuantity(itemIdNumber, size, newQuantity); 
      input.disabled = false; 
      if (!result || !result.success) {
          showNotification(result?.error || `Failed to update quantity for ${size}`, 'danger');
          debugCartUI("ACTION-ERROR", `Failed quantity update for item ${itemIdNumber}, size ${size}`, result);
      } else {
           debugCartUI("ACTION-SUCCESS", `Successfully updated quantity for item ${itemIdNumber}, size ${size}`);
      }
  }

  function initialize() {
    if (elements.saveForLaterBtn) elements.saveForLaterBtn.addEventListener('click', handleSaveForLater);
    if (elements.proceedToCheckoutBtn) elements.proceedToCheckoutBtn.addEventListener('click', () => goToStep(2));
    if (elements.backToCartBtn) elements.backToCartBtn.addEventListener('click', () => goToStep(1));
    if (elements.shippingForm) elements.shippingForm.addEventListener('submit', handleShippingFormSubmit);
    if (elements.backToShippingBtn) elements.backToShippingBtn.addEventListener('click', () => goToStep(2));
    if (elements.submitOrderBtn) elements.submitOrderBtn.addEventListener('click', handleSubmitQuoteRequest);
    initImageZoomModal();
    NWCACart.addEventListener('cartUpdated', () => {
      if (!isRendering) renderCart();
    });
    debugCartUI("INFO","Initializing cart UI, syncing with server...");
    NWCACart.syncWithServer()
      .then(async () => { 
        debugCartUI("INFO","Cart sync complete, rendering cart...");
        await renderCart(); 
        goToStep(1);
      })
      .catch(async error => { 
        console.error("Error syncing cart:", error);
        await renderCart(); 
      });
  }

  async function renderCart() { 
    if (isRendering) {
      debugCartUI("RENDER-WARN", "Render already in progress, skipping this render call");
      return;
    }
    isRendering = true;
    try {
     const activeItemsOriginal = NWCACart.getCartItems('Active');
     const savedItemsOriginal = NWCACart.getCartItems('SavedForLater');
     const activeItems = activeItemsOriginal.map(adaptItemFormat);
     const savedItems = savedItemsOriginal.map(adaptItemFormat);
    debugCartUI("RENDER", "Starting renderCart function. Active items count:", activeItems?.length);

    if (NWCACart.isLoading() && elements.cartItemsContainer) {
       debugCartUI("RENDER", "Cart is loading, showing spinner.");
      elements.cartItemsContainer.innerHTML = `<div class="cart-loading"><div class="spinner-border text-primary" role="status"><span class="sr-only">Loading...</span></div><p>Loading your cart...</p></div>`;
      if (elements.emptyCartMessage) elements.emptyCartMessage.style.display = 'none';
      if (elements.cartSummary) elements.cartSummary.style.display = 'none';
      return;
    }
    if (NWCACart.getError() && elements.cartItemsContainer) {
      debugCartUI("RENDER-ERROR", "Cart has error, showing error message:", NWCACart.getError());
      elements.cartItemsContainer.innerHTML = `<div class="alert alert-danger" role="alert"><h4 class="alert-heading">Error</h4><p>${NWCACart.getError()}</p><hr><p class="mb-0">Please try refreshing the page or contact support if the problem persists.</p></div>`;
      if (elements.emptyCartMessage) elements.emptyCartMessage.style.display = 'none';
      if (elements.cartSummary) elements.cartSummary.style.display = 'none';
      return;
    }
    if (!activeItems || activeItems.length === 0) {
      debugCartUI("RENDER", "Cart is empty, showing empty cart message");
      if (elements.cartItemsContainer) elements.cartItemsContainer.innerHTML = '';
      if (elements.emptyCartMessage) elements.emptyCartMessage.style.display = 'block';
      if (elements.cartSummary) elements.cartSummary.style.display = 'none';
      await renderSavedItems(savedItems); 
      return;
    }
    if (elements.cartItemsContainer) {
      elements.cartItemsContainer.innerHTML = '';
      debugCartUI("RENDER", `Rendering ${activeItems.length} active items.`);
      const itemElementsPromises = activeItems.map(item => renderCartItem(item)); 
      const itemElements = await Promise.all(itemElementsPromises); 
      itemElements.forEach(itemElement => {
          if (itemElement) elements.cartItemsContainer.appendChild(itemElement);
          else debugCartUI("RENDER-WARN", "renderCartItem returned null for an item.");
      });
      if (elements.emptyCartMessage) elements.emptyCartMessage.style.display = 'none';
      if (elements.cartSummary) elements.cartSummary.style.display = 'block';
    }
    await renderSavedItems(savedItems); 
    updateCartSummary();
    if (elements.downloadQuotePdfBtn) {
        const newPdfButton = elements.downloadQuotePdfBtn.cloneNode(true);
        elements.downloadQuotePdfBtn.parentNode.replaceChild(newPdfButton, elements.downloadQuotePdfBtn);
        elements.downloadQuotePdfBtn = newPdfButton; 
        if (activeItems && activeItems.length > 0) {
             elements.downloadQuotePdfBtn.disabled = false; 
             elements.downloadQuotePdfBtn.addEventListener('click', window.NWCAOrderFormPDF.generate);
             debugCartUI("RENDER", "PDF download button listener attached.");
        } else {
             elements.downloadQuotePdfBtn.disabled = true; 
             debugCartUI("RENDER", "PDF download button disabled (cart empty).");
        }
    } else {
        debugCartUI("RENDER-WARN", "PDF download button element not found.");
    }
      debugCartUI("RENDER", "Finished renderCart function."); 
    } finally {
      isRendering = false;
    }
  }

  function _createCartItemHeaderHTML(item, formattedEmbType, totalQuantityForType, pricingTier) {
      const ltmFeePerItem = (totalQuantityForType > 0 && totalQuantityForType < 24) ? (50 / totalQuantityForType).toFixed(2) : 0;
      return `
        <div class="d-flex justify-content-between align-items-start mb-2">
            <div>
                 <h5 class="card-title item-title mb-1">
                   <a href="${NWCAUtils.createProductUrl(item)}" class="item-link" title="View product details">${item.productTitle || `${item.styleNumber} - ${item.color}`}</a>
                 </h5>
                 <span class="item-embellishment badge" style="background-color: ${NWCAUtils.getEmbellishmentColor(item.embellishmentType)}; color: white;">${formattedEmbType}</span>
                 <div class="mt-1">
                    <small class="text-muted">Total ${formattedEmbType} Quantity: <span class="font-weight-bold">${totalQuantityForType}</span> (${pricingTier} pricing tier)</small>
                    ${ltmFeePerItem > 0 ?
                      `<br><small class="text-danger"><strong>Less Than Minimum Fee Applied:</strong> $50.00 total fee ÷ ${totalQuantityForType} items = $${ltmFeePerItem} per item</small>` :
                      ''}
                 </div>
            </div>
            <button class="remove-item-btn btn btn-sm btn-outline-danger" data-item-id="${item.id}">&times;</button>
        </div>`;
  }

  function _createCartItemDetailsHTML(item) {
      // Debug image URL being used
      console.log(`[CART-UI] Creating item ${item.id} with imageUrl: '${item.imageUrl || "none"}'`);
      
      return `
        <div class="cart-item-details row">
            <div class="col-md-3 item-image-container mb-2 mb-md-0">
                 <img src="${item.imageUrl || ''}"
                      alt="${item.styleNumber} - ${item.color}"
                      class="item-image img-fluid rounded border"
                      style="max-height: 150px; object-fit: contain;"
                      onerror="console.warn('[CART-UI] Image failed to load for item ${item.id}: ' + this.src); this.style.display='none'; this.parentElement.innerHTML = '<div class=\'img-placeholder border rounded bg-light d-flex align-items-center justify-content-center\' style=\'height: 150px; width: 100%;\'><div class=\'text-center\'><small class=\'text-muted\'>Image Unavailable</small><br><small>${item.styleNumber} - ${item.color}</small></div></div>';">
            </div>
          <div class="col-md-9">
              <p class="cart-item-color text-muted mb-1">Color: <span class="font-weight-bold text-body">${item.color || 'N/A'}</span></p>
              <div class="cart-item-options mb-2">
                ${renderEmbellishmentOptions(item.embellishmentOptions)}
              </div>
              <div class="cart-item-sizes">
                 <h6 class="sizes-header" style="background-color: #e9ecef; padding: 5px 10px; border-radius: 4px; margin-bottom: 10px;">Sizes & Quantities</h6>
              </div>
          </div>
        </div>`;
  }

  async function _populateSizesContainer(sizesContainerEl, item) {
      if (!sizesContainerEl || !item.sizes || !Array.isArray(item.sizes)) {
          debugCartUI("RENDER-WARN", `No sizes array or container for item ${item.id}`);
          if (sizesContainerEl) sizesContainerEl.innerHTML += 'No size details available.';
          return;
      }
      const validSizes = item.sizes.filter(sizeInfo => sizeInfo && sizeInfo.size && typeof sizeInfo.quantity !== 'undefined' && parseInt(sizeInfo.quantity) > 0);
      if (validSizes.length === 0) {
          debugCartUI("RENDER", `No valid sizes with quantity > 0 for item ${item.id}.`);
          sizesContainerEl.innerHTML += '<p><i>No sizes added for this item yet.</i></p>';
          return;
      }
      let sizeGroupsOrder = [];
      try {
          const lookupUrl = `/api/pricing-matrix/lookup?styleNumber=${encodeURIComponent(item.styleNumber)}&color=${encodeURIComponent(item.color)}&embellishmentType=${encodeURIComponent(item.embellishmentType)}`;
          const lookupResponse = await fetch(lookupUrl);
          if (lookupResponse.ok) {
              const lookupResult = await lookupResponse.json();
              const pricingMatrixId = lookupResult.pricingMatrixId;
              if (pricingMatrixId && window.PricingMatrixAPI) {
                  const pricingData = await window.PricingMatrixAPI.getPricingData(pricingMatrixId);
                  if (pricingData && Array.isArray(pricingData.headers)) {
                      sizeGroupsOrder = pricingData.headers;
                  }
              }
          }
      } catch (error) {
          console.error(`[CartUI] Error fetching size order for item ${item.id}:`, error);
      }
      const sortedSizes = NWCAUtils.sortSizesByGroupOrder(validSizes, sizeGroupsOrder); 
      sortedSizes.forEach(sizeInfo => {
          const sizeElement = renderSizeItem(sizeInfo, item.id, item.embellishmentType); 
          if (sizeElement) sizesContainerEl.appendChild(sizeElement);
      });
  }
  
  async function renderCartItem(item) {
      if (!item || !item.id || !item.styleNumber || !item.color || !item.embellishmentType) {
          debugCartUI("RENDER-ERROR", "Invalid item for renderCartItem", item);
          return null;
      }
      debugCartUI("RENDER", "Rendering cart item:", item);
      const itemElement = document.createElement('div');
      itemElement.className = 'cart-item card mb-3';
      itemElement.dataset.itemId = item.id;
      itemElement.style.borderLeft = `4px solid ${item.isSaved ? '#6c757d' : '#0056b3'}`;
      if (item.isSaved) itemElement.style.backgroundColor = '#f8f9fa';

      const formattedEmbType = NWCAUtils.formatEmbellishmentType(item.embellishmentType); 
      const totalQuantityForType = getTotalQuantityForEmbellishmentType(item.embellishmentType); 
      const pricingTier = getPricingTierForQuantity(totalQuantityForType); 

      itemElement.innerHTML = `
        <div class="card-body">
          ${_createCartItemHeaderHTML(item, formattedEmbType, totalQuantityForType, pricingTier)}
          ${_createCartItemDetailsHTML(item)}
        </div>`;
      const sizesContainer = itemElement.querySelector('.cart-item-sizes');
      await _populateSizesContainer(sizesContainer, item);
      const removeButton = itemElement.querySelector('.remove-item-btn');
      if (removeButton) {
          const newRemoveButton = removeButton.cloneNode(true);
          removeButton.parentNode.replaceChild(newRemoveButton, removeButton);
          newRemoveButton.addEventListener('click', (event) => {
              event.preventDefault();
              const itemIdToRemove = event.target.closest('.cart-item').dataset.itemId;
              if (itemIdToRemove) handleRemoveItem(itemIdToRemove);
          });
      }
      if (item.isSaved) {
          const header = itemElement.querySelector('.d-flex.justify-content-between');
          const moveToCartBtn = document.createElement('button');
          moveToCartBtn.className = 'btn btn-sm btn-primary mr-2 move-to-cart-btn';
          moveToCartBtn.textContent = 'Move to Cart';
          moveToCartBtn.dataset.itemId = item.id;
          moveToCartBtn.style.marginRight = '5px';
          moveToCartBtn.addEventListener('click', async (event) => {
              event.preventDefault();
              moveToCartBtn.disabled = true;
              moveToCartBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Moving...';
              await moveToCart(item.id);
          });
          if (header && header.lastElementChild) {
              header.insertBefore(moveToCartBtn, header.lastElementChild);
          }
          itemElement.querySelectorAll('.quantity-input').forEach(input => input.disabled = true);
      }
      const itemImage = itemElement.querySelector('.item-image');
      if (itemImage) {
          itemImage.addEventListener('click', (event) => {
              event.preventDefault();
              openImageZoomModal(itemImage.src, `${item.styleNumber} - ${item.color}`);
          });
          itemImage.title = "Click to zoom";
      }
      return itemElement;
  }

function initImageZoomModal() {
    debugCartUI("INIT", "Initializing image zoom modal");
    const modal = document.getElementById('image-zoom-modal');
    const closeBtn = document.querySelector('.close-modal');
    const modalOverlay = document.querySelector('.modal-overlay');
    const zoomedImage = document.getElementById('zoomed-image');
    if (!modal || !closeBtn || !modalOverlay || !zoomedImage) {
        debugCartUI("INIT-ERROR", "Could not find all required modal elements");
        return;
    }
    const textCloseBtn = document.createElement('button');
    textCloseBtn.className = 'btn btn-danger modal-close-button';
    textCloseBtn.textContent = 'Close';
    textCloseBtn.setAttribute('aria-label', 'Close image');
    textCloseBtn.style.position = 'absolute';
    textCloseBtn.style.bottom = '70px';
    textCloseBtn.style.left = '50%';
    textCloseBtn.style.transform = 'translateX(-50%)';
    textCloseBtn.style.zIndex = '1053';
    modal.querySelector('.modal-content').appendChild(textCloseBtn);
    closeBtn.addEventListener('click', closeImageZoomModal);
    textCloseBtn.addEventListener('click', closeImageZoomModal);
    modalOverlay.addEventListener('click', closeImageZoomModal);
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && modal.style.display === 'block') {
            closeImageZoomModal();
        }
    });
}

function openImageZoomModal(imageSrc, imageAlt = 'Product Image') {
    debugCartUI("MODAL", `Opening image zoom modal for: ${imageSrc}`);
    const modal = document.getElementById('image-zoom-modal');
    const zoomedImage = document.getElementById('zoomed-image');
    if (!modal || !zoomedImage) {
        debugCartUI("MODAL-ERROR", "Could not find modal elements");
        return;
    }
    zoomedImage.src = imageSrc;
    zoomedImage.alt = imageAlt;
    let closeHint = modal.querySelector('.modal-close-hint');
    if (!closeHint) {
        closeHint = document.createElement('div');
        closeHint.className = 'modal-close-hint';
        closeHint.textContent = 'Click the X button, click outside, or press ESC to close';
        modal.querySelector('.modal-content').appendChild(closeHint);
    }
    modal.style.display = 'block';
    setTimeout(() => {
        zoomedImage.classList.add('show');
    }, 10);
    document.body.style.overflow = 'hidden';
}

function closeImageZoomModal() {
    debugCartUI("MODAL", "Closing image zoom modal");
    const modal = document.getElementById('image-zoom-modal');
    const zoomedImage = document.getElementById('zoomed-image');
    if (!modal || !zoomedImage) {
        debugCartUI("MODAL-ERROR", "Could not find modal elements");
        return;
    }
    zoomedImage.classList.remove('show');
    setTimeout(() => {
        modal.style.display = 'none';
        zoomedImage.src = ''; 
    }, 300); 
    document.body.style.overflow = '';
}

  function renderSizeItem(sizeInfo, itemId, embellishmentType) {
      if (!sizeInfo || typeof sizeInfo.size !== 'string' || sizeInfo.size.trim() === '' || typeof sizeInfo.quantity === 'undefined' || isNaN(parseInt(sizeInfo.quantity))) {
          debugCartUI("RENDER-SIZE-ERROR", "Invalid sizeInfo", {sizeInfo, itemId});
          return null;
      }
      const quantity = parseInt(sizeInfo.quantity);
      if (isNaN(quantity) || quantity <= 0) {
          debugCartUI("RENDER-SIZE", `Skipping size ${sizeInfo.size} with invalid/zero quantity ${sizeInfo.quantity}`);
          return null;
      }
      const sizeElement = document.createElement('div');
      sizeElement.className = 'cart-item-size-row d-flex justify-content-between align-items-center mb-2 p-2 rounded';
      sizeElement.style.backgroundColor = '#f8f9fa';
      sizeElement.dataset.itemId = itemId;
      sizeElement.dataset.size = sizeInfo.size;

      const unitPrice = typeof sizeInfo.unitPrice === 'string' ? parseFloat(sizeInfo.unitPrice.replace(/[^0-9.-]+/g,"")) : parseFloat(sizeInfo.unitPrice);
      const formattedPrice = !isNaN(unitPrice) && unitPrice > 0 ? NWCAUtils.formatCurrency(unitPrice) : 'N/A'; 
      const lineTotal = (!isNaN(unitPrice) ? unitPrice : 0) * quantity;
      const formattedLineTotal = NWCAUtils.formatCurrency(lineTotal); 

      const totalQuantityForType = embellishmentType ? getTotalQuantityForEmbellishmentType(embellishmentType) : 0; 
      const hasLtmFee = totalQuantityForType > 0 && totalQuantityForType < 24;
      const ltmFeePerItem = hasLtmFee ? (50 / totalQuantityForType) : 0;
      const basePrice = !isNaN(unitPrice) ? (unitPrice - ltmFeePerItem) : 0;
      const formattedBasePrice = NWCAUtils.formatCurrency(basePrice); 
      
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
      const quantityInput = sizeElement.querySelector('.quantity-input');
      if (quantityInput) {
          const newQuantityInput = quantityInput.cloneNode(true);
          quantityInput.parentNode.replaceChild(newQuantityInput, quantityInput);
          newQuantityInput.addEventListener('change', handleQuantityChange);
      }
      return sizeElement;
  }

   // --- START: Utility functions to keep local or adapt if NWCACart is not global ---
  function getTotalQuantityForEmbellishmentType(embellishmentType) {
    if (!embellishmentType || typeof NWCACart === 'undefined') {
      return 0;
    }
    let totalQuantity = 0;
    const cartItems = NWCACart.getCartItems('Active'); 
    const itemsOfType = cartItems.filter(item => item.ImprintType === embellishmentType);
    itemsOfType.forEach(item => {
      if (item.sizes && Array.isArray(item.sizes)) {
        item.sizes.forEach(size => {
          totalQuantity += parseInt(size.Quantity) || 0;
        });
      }
    });
    return totalQuantity;
  }
  
  function getPricingTierForQuantity(quantity) { 
    if (quantity <= 0) return "N/A";
    if (quantity >= 1 && quantity <= 23) return "1-23";
    if (quantity >= 24 && quantity <= 47) return "24-47";
    if (quantity >= 48 && quantity <= 71) return "48-71";
    if (quantity >= 72) return "72+";
    return "Unknown";
  }

   function renderEmbellishmentOptions(options) {
       if (!options || typeof options !== 'object' || Object.keys(options).length === 0) {
           return '<p><i>Standard decoration options apply.</i></p>';
       }
       let optionsHtml = '<ul style="list-style-type: none; padding-left: 0; margin-bottom: 0; font-size: 0.9em;">';
       for (const [key, value] of Object.entries(options)) {
           if (value !== null && value !== '' || typeof value === 'boolean') {
                optionsHtml += `<li style="margin-bottom: 3px;"><strong>${NWCAUtils.formatOptionName(key)}:</strong> ${NWCAUtils.formatOptionValue(key, value)}</li>`; 
           }
       }
       optionsHtml += '</ul>';
       return optionsHtml;
   }

    function adaptItemFormat(originalItem) {
        if (!originalItem) return null;
        
        // Start with detailed logging for debugging
        debugCartUI("ITEM-FORMAT", `Adapting item format for: ${originalItem.StyleNumber || 'unknown'} - ${originalItem.Color || 'unknown'}`);
        if (originalItem.CartItemID) {
            debugCartUI("ITEM-FORMAT", `Item ID: ${originalItem.CartItemID}`);
        }
        
        // Get product title
        let productTitle = originalItem.PRODUCT_TITLE;
        debugCartUI("TITLE-DEBUG", `Initial PRODUCT_TITLE property: '${productTitle || 'not found'}'`);
        
        // Prioritize direct imageUrl property first (case-sensitive check)
        let imageUrl = originalItem.imageUrl;
        debugCartUI("IMAGE-DEBUG", `Initial imageUrl direct property: '${imageUrl || 'not found'}'`);
        
        // Check for alternate casing versions (API responses might vary)
        if (!imageUrl) {
            // Check common variations of the property name
            const possibleProperties = [
                'ImageUrl', 'IMAGEURL', 'image_url', 'IMAGE_URL',
                'FRONT_MODEL', 'IMAGE_URL_FRONT', 'productImageUrl',
                'ProductImage', 'imageURL'
            ];
            
            for (const prop of possibleProperties) {
                if (originalItem[prop]) {
                    imageUrl = originalItem[prop];
                    debugCartUI("IMAGE-FOUND", `Found image URL in property: ${prop}`, originalItem[prop]);
                    break;
                }
            }
        }
        
        // Check if we have it in window.productContext that might have been stored
        if (!imageUrl && window.productContext) {
            const possibleContextProps = ['IMAGE_URL_FRONT', 'FRONT_MODEL', 'imageUrl', 'productImage'];
            for (const prop of possibleContextProps) {
                if (window.productContext[prop]) {
                    imageUrl = window.productContext[prop];
                    debugCartUI("IMAGE-FOUND", `Found image URL in window.productContext.${prop}`, imageUrl);
                    break;
                }
            }
        }
        
        // Check if image URL is embedded in EmbellishmentOptions
        if (!imageUrl && originalItem.EmbellishmentOptions) {
            try {
                // Parse if it's a string, otherwise use as is
                let options;
                if (typeof originalItem.EmbellishmentOptions === 'string') {
                    try {
                        options = JSON.parse(originalItem.EmbellishmentOptions || '{}');
                    } catch (parseError) {
                        debugCartUI("IMAGE-ERROR", "Error parsing EmbellishmentOptions string:", parseError);
                        options = {};
                    }
                } else {
                    options = originalItem.EmbellishmentOptions || {};
                }
                
                // Log for debugging
                debugCartUI("IMAGE-DEBUG", "EmbellishmentOptions content:", options);
                
                // Check for image URL in options under various possible property names
                const optionProps = [
                    'imageUrl', 'image_url', 'productImage', 'IMAGE_URL',
                    'FRONT_MODEL', 'image', 'product_image'
                ];
                
                for (const prop of optionProps) {
                    if (options[prop]) {
                        imageUrl = options[prop];
                        debugCartUI("IMAGE-FOUND", `Found image URL in EmbellishmentOptions.${prop}`, imageUrl);
                        break;
                    }
                }
            } catch (e) {
                debugCartUI("IMAGE-ERROR", "Error processing EmbellishmentOptions:", e);
            }
        }
        
        // Try source URL parameters (might have been stored during add to cart)
        if (!imageUrl && originalItem.sourceUrl && originalItem.sourceUrl.includes('?')) {
            try {
                const urlParams = new URLSearchParams(originalItem.sourceUrl.split('?')[1]);
                if (urlParams.has('img')) {
                    imageUrl = urlParams.get('img');
                    debugCartUI("IMAGE-FOUND", "Found image URL in source URL parameters", imageUrl);
                }
            } catch (e) {
                debugCartUI("IMAGE-ERROR", "Error extracting image from URL params:", e);
            }
        }
        
        // Try to construct a SanMar image URL if we have style and color
        if (!imageUrl && originalItem.StyleNumber && originalItem.Color) {
            const styleNum = originalItem.StyleNumber.trim().toUpperCase();
            const color = originalItem.Color.replace(/\s+/g, '').toUpperCase().trim();
            const sanmarUrl = `https://www.sanmar.com/cs/images/products/large/${styleNum}_${color}_lrg.jpg`;
            debugCartUI("IMAGE-FALLBACK", `Constructing SanMar URL: ${sanmarUrl}`);
            imageUrl = sanmarUrl;
        }
        
        // Local fallback path as last resort
        if (!imageUrl && originalItem.StyleNumber) {
            debugCartUI("IMAGE-FALLBACK", "Using local placeholder image path for item:", originalItem.StyleNumber);
            imageUrl = `/images/products/${originalItem.StyleNumber}/${originalItem.Color}.jpg`;
        }
        
        // Final image URL check
        debugCartUI("IMAGE-FINAL", `Final imageUrl for item: '${imageUrl || "none"}'`);
        
        return {
            id: originalItem.CartItemID,
            styleNumber: originalItem.StyleNumber,
            color: originalItem.Color,
            embellishmentType: originalItem.ImprintType,
            imageUrl: imageUrl,
            productTitle: productTitle || `${originalItem.StyleNumber} - ${originalItem.Color}`,
            sourceUrl: originalItem.sourceUrl || null,
            sourcePage: originalItem.sourcePage || null,
            embellishmentOptions: typeof originalItem.EmbellishmentOptions === 'string' ? JSON.parse(originalItem.EmbellishmentOptions || '{}') : (originalItem.EmbellishmentOptions || {}),
            sizes: (originalItem.sizes || []).map(s => ({
                 size: s.Size,
                 quantity: s.Quantity,
                 unitPrice: s.UnitPrice
            })),
             isSaved: originalItem.CartStatus === 'SavedForLater'
        };
    }

   async function renderSavedItems(savedItems) { 
     debugCartUI("RENDER", `Rendering ${savedItems?.length || 0} saved items.`);
     if (elements.savedItemsContainer && elements.savedItemsList) {
       if (savedItems && savedItems.length > 0) {
         elements.savedItemsContainer.style.display = 'block';
         elements.savedItemsList.innerHTML = ''; 
         const itemElementsPromises = savedItems.map(item => {
             const adaptedItem = item.isSaved ? item : { ...item, isSaved: true };
             return renderCartItem(adaptedItem); 
         });
         const itemElements = await Promise.all(itemElementsPromises); 
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
   // --- END: Utility functions to keep local ---

  function updateCartSummary() {
    const activeItems = NWCACart.getCartItems('Active');
    let subtotal = 0;
    activeItems.forEach(item => {
      if (item.sizes && Array.isArray(item.sizes)) {
        item.sizes.forEach(size => {
          subtotal += (parseFloat(size.UnitPrice) || 0) * (parseInt(size.Quantity) || 0);
        });
      }
    });
    let ltmFeeAmount = 0; // LTM fee is already included in subtotal via item prices
    // const embellishmentTypes = [...new Set(activeItems.map(item => item.ImprintType))];
    // embellishmentTypes.forEach(embType => {
    //   let totalQuantity = 0;
    //   activeItems.filter(item => item.ImprintType === embType).forEach(item => {
    //     if (item.sizes && Array.isArray(item.sizes)) {
    //       item.sizes.forEach(size => {
    //         totalQuantity += parseInt(size.Quantity) || 0;
    //       });
    //     }
    //   });
    //   if (totalQuantity > 0 && totalQuantity < 24) {
    //     ltmFeeAmount += 50.00;
    //   }
    // });
    const total = subtotal; // LTM fee is part of subtotal, so total is just subtotal
    debugCartUI("SUMMARY", `Updating summary: Subtotal=${subtotal}, LTM Fee=${ltmFeeAmount}, Total=${total}`);

    if (elements.cartSubtotal) elements.cartSubtotal.textContent = NWCAUtils.formatCurrency(subtotal); 
    if (elements.cartTotal) elements.cartTotal.textContent = NWCAUtils.formatCurrency(total); 
    if (elements.ltmFee) {
      elements.ltmFee.textContent = NWCAUtils.formatCurrency(ltmFeeAmount); 
      if (ltmFeeAmount > 0) {
        let ltmExplanation = document.getElementById('ltm-fee-explanation');
        if (!ltmExplanation) {
          ltmExplanation = document.createElement('small');
          ltmExplanation.id = 'ltm-fee-explanation';
          ltmExplanation.className = 'text-danger d-block mt-1';
          elements.ltmFee.parentNode.appendChild(ltmExplanation);
        }
        const embTypesWithLtm = embellishmentTypes.filter(embType => {
          const typeQuantity = getTotalQuantityForEmbellishmentType(embType); 
          return typeQuantity > 0 && typeQuantity < 24;
        });
        ltmExplanation.innerHTML = `Applied to ${embTypesWithLtm.length} embellishment type${embTypesWithLtm.length !== 1 ? 's' : ''} with less than 24 items`;
      } else {
        const ltmExplanation = document.getElementById('ltm-fee-explanation');
        if (ltmExplanation) ltmExplanation.remove();
      }
    }
    if (elements.ltmFeeRow) {
      const displayStyle = elements.ltmFeeRow.tagName === 'TR' ? 'table-row' : 'flex';
      elements.ltmFeeRow.style.display = ltmFeeAmount > 0 ? displayStyle : 'none';
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
    if (elements.reviewSubtotal) elements.reviewSubtotal.textContent = NWCAUtils.formatCurrency(subtotal); 
    if (elements.reviewTotal) elements.reviewTotal.textContent = NWCAUtils.formatCurrency(total); 
    if (elements.reviewLtmFee) {
      elements.reviewLtmFee.textContent = NWCAUtils.formatCurrency(ltmFeeAmount); 
      const reviewLtmRow = elements.reviewLtmFee.closest('tr') || elements.reviewLtmFee.closest('.row');
      if (reviewLtmRow) {
        reviewLtmRow.style.display = ltmFeeAmount > 0 ? '' : 'none'; 
        if (ltmFeeAmount > 0) {
          reviewLtmRow.style.backgroundColor = '#fff8e8';
          reviewLtmRow.style.padding = '5px';
          reviewLtmRow.style.borderRadius = '4px';
          let reviewLtmExplanation = document.getElementById('review-ltm-explanation');
          if (!reviewLtmExplanation) {
            reviewLtmExplanation = document.createElement('small');
            reviewLtmExplanation.id = 'review-ltm-explanation';
            reviewLtmExplanation.className = 'text-danger d-block mt-1';
            elements.reviewLtmFee.parentNode.appendChild(reviewLtmExplanation);
          }
          const embTypesWithLtm = embellishmentTypes.filter(embType => {
            const typeQuantity = getTotalQuantityForEmbellishmentType(embType); 
            return typeQuantity > 0 && typeQuantity < 24;
          });
          reviewLtmExplanation.innerHTML = `Applied to ${embTypesWithLtm.length} embellishment type${embTypesWithLtm.length !== 1 ? 's' : ''} with less than 24 items`;
        } else {
          reviewLtmRow.style.backgroundColor = '';
          reviewLtmRow.style.padding = '';
          reviewLtmRow.style.borderRadius = '';
          const reviewLtmExplanation = document.getElementById('review-ltm-explanation');
          if (reviewLtmExplanation) reviewLtmExplanation.remove();
        }
      }
    }
  }

  async function handleSaveForLater() {
     debugCartUI("ACTION", "Attempting to save cart for later.");
    const result = await NWCACart.saveForLater();
    if (result.success) {
       debugCartUI("ACTION-SUCCESS", "Save for later successful.");
      showNotification('Your cart has been saved for later', 'success');
    } else {
        debugCartUI("ACTION-ERROR", "Save for later failed.", result.error);
      showNotification(result.error || 'Failed to save cart for later', 'danger');
    }
  }

  async function moveToCart(itemId) {
     debugCartUI("ACTION", `Attempting to move item ${itemId} to cart.`);
    try {
        const originalItem = NWCACart.getCartItems().find(item => item.CartItemID == itemId); 
        if (!originalItem) {
            throw new Error(`Item with ID ${itemId} not found in saved items.`);
        }
        const response = await fetch(`/api/cart-items/${itemId}`, { 
             method: 'PUT',
             headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify({ ...originalItem, CartStatus: 'Active' })
        });
        if (!response.ok) {
             const errorData = await response.text(); 
             throw new Error(`API Error (${response.status}): ${errorData}`);
        }
        debugCartUI("ACTION-SUCCESS", `API call successful for moving item ${itemId} to cart.`);
        await NWCACart.syncWithServer(); 
        showNotification('Item moved to cart', 'success');
    } catch (error) {
        console.error('Error moving item to cart:', error);
        debugCartUI("ACTION-ERROR", `Error moving item ${itemId} to cart:`, error.message);
        showNotification(`Failed to move item to cart: ${error.message}`, 'danger');
        renderCart();
    }
}

  function handleShippingFormSubmit(event) {
    event.preventDefault();
     debugCartUI("ACTION", "Handling shipping form submission.");
    const formData = new FormData(elements.shippingForm);
    customerData = Object.fromEntries(formData.entries());
     debugCartUI("DATA", "Customer Shipping Data:", customerData);
    const requiredFields = ['name', 'email', 'phone', 'address1', 'city', 'state', 'zipCode', 'country'];
    const missingFields = requiredFields.filter(field => !customerData[field] || customerData[field].trim() === '');
    if (missingFields.length > 0) {
       const message = `Please fill in all required fields: ${missingFields.join(', ')}`;
       debugCartUI("VALIDATE-ERROR", message);
      showNotification(message, 'danger');
      return;
    }
    renderCustomerInfo();
    renderReviewItems();
    goToStep(3);
  }

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
      ${customerData.notes ? `<p><strong>Notes:</strong> ${customerData.notes}</p>` : ''}
    `;
  }

  function renderReviewItems() {
    if (!elements.reviewItemsList) {
         debugCartUI("RENDER-WARN", "Review items list element not found.");
         return;
    }
     debugCartUI("RENDER", "Rendering items for review step.");
    elements.reviewItemsList.innerHTML = '';
    const activeItemsOriginal = NWCACart.getCartItems('Active');
    const activeItems = activeItemsOriginal.map(adaptItemFormat);
    if (!activeItems || activeItems.length === 0) {
         elements.reviewItemsList.innerHTML = '<p>Your cart is empty.</p>';
         return;
    }
    activeItems.forEach(item => {
       if (!item || !item.id) {
           debugCartUI("RENDER-WARN", "Skipping invalid item in renderReviewItems", item);
           return;
       }
      const itemElement = document.createElement('div');
      itemElement.className = 'review-item mb-3 p-3 border rounded'; 
      let sizesHtml = '';
      let totalQuantity = 0;
      let itemTotal = 0;
       if (item.sizes && Array.isArray(item.sizes)) {
            item.sizes.forEach(sizeInfo => {
                 const quantity = parseInt(sizeInfo.quantity);
                 if (sizeInfo && sizeInfo.size && !isNaN(quantity) && quantity > 0) {
                      const unitPrice = parseFloat(sizeInfo.unitPrice) || 0;
                      const lineTotal = unitPrice * quantity;
                      itemTotal += lineTotal;
                      totalQuantity += quantity;
                      const totalQuantityForType = getTotalQuantityForEmbellishmentType(item.embellishmentType); 
                      const hasLtmFee = totalQuantityForType < 24 && totalQuantityForType > 0;
                      const ltmFeePerItem = hasLtmFee ? 50 / totalQuantityForType : 0;
                      const basePrice = unitPrice - ltmFeePerItem;
                      let unitPriceDisplay = NWCAUtils.formatCurrency(unitPrice); 
                      if (hasLtmFee) {
                          unitPriceDisplay = `${NWCAUtils.formatCurrency(basePrice)} + ${NWCAUtils.formatCurrency(ltmFeePerItem)} LTM`; 
                      }
                      sizesHtml += `
                      <div class="d-flex justify-content-between align-items-center py-1 border-bottom">
                          <span class="font-weight-bold" style="min-width: 50px;">${sizeInfo.size}</span>
                          <span style="min-width: 50px; text-align: center;">${quantity}</span>
                          <span style="min-width: 120px; text-align: right;">${unitPriceDisplay}</span>
                          <span style="min-width: 80px; text-align: right; font-weight: bold;">${NWCAUtils.formatCurrency(lineTotal)}</span>
                      </div>`; 
                 }
            });
       } else {
           debugCartUI("RENDER-WARN", `Item ${item.id} has no valid sizes array for review rendering.`);
            sizesHtml = '<p><i>No size details for this item.</i></p>';
       }
      const totalQuantityForType = getTotalQuantityForEmbellishmentType(item.embellishmentType); 
      const pricingTier = getPricingTierForQuantity(totalQuantityForType); 
      const hasLtmFee = totalQuantityForType < 24 && totalQuantityForType > 0;
      const ltmFeePerItem = hasLtmFee ? 50 / totalQuantityForType : 0;
      itemElement.innerHTML = `
        <div class="d-flex justify-content-between align-items-center mb-2">
          <div>
            <h5 class="mb-1"><a href="${NWCAUtils.createProductUrl(item)}" class="item-link" title="View product details">${item.productTitle || `${item.styleNumber} - ${item.color}`}</a></h5>
            <p class="mb-1">Embellishment: ${NWCAUtils.formatEmbellishmentType(item.embellishmentType)}</p>
            <p class="mb-1"><small class="text-muted">Total ${NWCAUtils.formatEmbellishmentType(item.embellishmentType)} Quantity: <span class="font-weight-bold">${totalQuantityForType}</span> (${pricingTier} pricing tier)</small></p>
            ${hasLtmFee ?
              `<p class="mb-1"><small class="text-danger"><strong>Less Than Minimum Fee Applied:</strong> $50.00 total fee ÷ ${totalQuantityForType} items = $${ltmFeePerItem.toFixed(2)} per item</small></p>` :
              ''}
             <div class="embellishment-options small text-muted mt-2">
                ${renderEmbellishmentOptions(item.embellishmentOptions)}
             </div>
          </div>
          <div class="text-right">
            <p class="mb-1">Item Quantity: ${totalQuantity}</p>
            <p class="mb-0 font-weight-bold">Item Total: ${NWCAUtils.formatCurrency(itemTotal)}</p>
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
        </div>`; 
      elements.reviewItemsList.appendChild(itemElement);
    });
  }

  async function handleSubmitQuoteRequest() {
     debugCartUI("ACTION", "Attempting to submit quote request.");
    const items = NWCACart.getCartItems('Active'); 
    if (items.length === 0) {
      showNotification('Your quote request list is empty.', 'warning');
      return;
    }
    if (elements.submitOrderBtn) elements.submitOrderBtn.disabled = true;
    showNotification('Submitting quote request...', 'info'); 
    try {
       const result = await NWCACart.submitQuoteRequest(); 
       if (result.success) {
           debugCartUI("ACTION-SUCCESS", "Quote Request Submitted Successfully!");
           showNotification('Quote Request Submitted Successfully!', 'success');
           renderCart(); 
       } else {
           debugCartUI("ACTION-ERROR", "Error submitting quote request", result.error);
           showNotification(`Error submitting quote request: ${result.error || 'Unknown error.'}`, 'danger');
       }
    } catch (error) {
       console.error('Critical error submitting quote request:', error);
       debugCartUI("ACTION-CRITICAL-ERROR", "An unexpected error occurred.", error);
       showNotification('An unexpected critical error occurred while submitting your quote request. Please try again later.', 'danger');
    } finally {
        if (elements.submitOrderBtn) elements.submitOrderBtn.disabled = false;
    }
  }

  function goToStep(step) {
     debugCartUI("NAVIGATION", `Going to step: ${step}`);
    currentStep = step;
    if (elements.progressSteps) {
      elements.progressSteps.forEach((stepElement, index) => {
         const stepNum = parseInt(stepElement.dataset.step || (index + 1));
         stepElement.classList.remove('active', 'completed'); 
         if (stepNum < step) {
             stepElement.classList.add('completed');
         } else if (stepNum === step) {
             stepElement.classList.add('active');
         }
      });
    }
    const stepContainers = [
        elements.cartItemsContainer?.parentElement, 
        elements.cartSummary,
        elements.savedItemsContainer,
        elements.shippingFormContainer,
        elements.reviewOrderContainer,
        elements.orderConfirmationContainer
    ];
     stepContainers.forEach(container => {
         if (container) container.style.display = 'none'; 
     });
     switch (step) {
         case 1: 
             if (elements.cartItemsContainer) elements.cartItemsContainer.parentElement.style.display = 'block';
             const hasActiveItems = NWCACart.getCartItems('Active').length > 0;
             if (elements.emptyCartMessage) elements.emptyCartMessage.style.display = hasActiveItems ? 'none' : 'block';
             if (elements.cartSummary) elements.cartSummary.style.display = hasActiveItems ? 'block' : 'none'; 
             if (elements.savedItemsContainer) {
                const hasSavedItems = NWCACart.getCartItems('SavedForLater').length > 0;
                elements.savedItemsContainer.style.display = hasSavedItems ? 'block' : 'none';
             }
             break;
         case 2: 
             if (elements.shippingFormContainer) elements.shippingFormContainer.style.display = 'block';
             break;
         case 3: 
             if (elements.reviewOrderContainer) elements.reviewOrderContainer.style.display = 'block';
             break;
         case 4: 
             if (elements.orderConfirmationContainer) elements.orderConfirmationContainer.style.display = 'block';
             break;
     }
      window.scrollTo(0, 0);
  }

  function showNotification(message, type = 'info') {
     console.log(`[Notification-${type}]: ${message}`);
    if (typeof $ !== 'undefined' && $.fn.alert) {
        const notificationContainer = document.getElementById('notification-area') || document.body; 
         if (!document.getElementById('notification-area') && notificationContainer === document.body) {
             const containerDiv = document.createElement('div');
             containerDiv.id = 'notification-area';
             containerDiv.style.position = 'fixed';
             containerDiv.style.top = '20px';
             containerDiv.style.right = '20px';
             containerDiv.style.zIndex = '1050'; 
             containerDiv.style.maxWidth = '400px';
             document.body.appendChild(containerDiv);
         }
        const notification = document.createElement('div');
        notification.className = `alert alert-${type} alert-dismissible fade show m-2`; 
        notification.setAttribute('role', 'alert');
        notification.innerHTML = `
          ${message}
          <button type="button" class="close" data-dismiss="alert" aria-label="Close">
            <span aria-hidden="true">&times;</span>
          </button>
        `;
         const targetContainer = document.getElementById('notification-area') || document.body;
        targetContainer.appendChild(notification);
        $(notification).alert(); 
        setTimeout(() => {
            $(notification).alert('close');
        }, 5000); 
     } else {
         alert(`(${type}): ${message}`); 
     }
  }

  // Public API
  return {
    initialize,
    renderCart, 
    goToStep, 
    showNotification 
  };
})();

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
  // Ensure NWCACart and NWCAUtils are loaded before initializing UI
  if (typeof NWCACart !== 'undefined' && typeof NWCAUtils !== 'undefined') { 
     NWCACartUI.initialize();
  } else {
      console.error("NWCACart or NWCAUtils is not defined. Cart UI cannot initialize.");
      const cartContainer = document.getElementById('cart-items-container');
      if (cartContainer) {
          cartContainer.innerHTML = '<div class="alert alert-danger">Could not load shopping cart module. Please refresh or contact support.</div>';
      }
  }
});