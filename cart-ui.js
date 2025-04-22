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
  
  // Templates
  const templates = {
    cartItem: document.getElementById('cart-item-template'),
    sizeItem: document.getElementById('size-item-template')
  };
  
  // Current step
  let currentStep = 1;
  
  // Customer data
  let customerData = {};
  
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
      elements.submitOrderBtn.addEventListener('click', handleSubmitOrder);
    }
    
    // Listen for cart updates
    NWCACart.addEventListener('cartUpdated', renderCart);
    
    // Force a sync with the server before initial render
    console.log("Initializing cart UI, syncing with server...");
    NWCACart.syncWithServer()
      .then(() => {
        console.log("Cart sync complete, rendering cart...");
        renderCart();
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
    // Get cart items
    const activeItems = NWCACart.getCartItems('Active');
    const savedItems = NWCACart.getCartItems('SavedForLater');
    
    console.log("Rendering cart with active items:", activeItems);
    
    // Check if cart is loading
    if (NWCACart.isLoading() && elements.cartItemsContainer) {
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
    if (!activeItems || activeItems.length === 0) {
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
      
      return;
    }
    
    // Render active items
    if (elements.cartItemsContainer) {
      elements.cartItemsContainer.innerHTML = '';
      
      activeItems.forEach(item => {
        const itemElement = renderCartItem(item);
        elements.cartItemsContainer.appendChild(itemElement);
      });
      
      if (elements.emptyCartMessage) {
        elements.emptyCartMessage.style.display = 'none';
      }
      
      if (elements.cartSummary) {
        elements.cartSummary.style.display = 'block';
      }
    }
    
    // Render saved items
    if (elements.savedItemsContainer && elements.savedItemsList) {
      if (savedItems.length > 0) {
        elements.savedItemsContainer.style.display = 'block';
        elements.savedItemsList.innerHTML = '';
        
        savedItems.forEach(item => {
          const itemElement = renderCartItem(item, true);
          elements.savedItemsList.appendChild(itemElement);
        });
      } else {
        elements.savedItemsContainer.style.display = 'none';
      }
    }
    
    // Update cart summary
    updateCartSummary();
  }
  
  /**
   * Render a cart item
   * @param {Object} item - Cart item
   * @param {boolean} isSaved - Whether the item is saved for later
   * @returns {HTMLElement} - Cart item element
   */
  function renderCartItem(item, isSaved = false) {
    if (!templates.cartItem) return document.createElement('div');
    
    // Clone the template
    const template = templates.cartItem.content.cloneNode(true);
    const itemElement = template.querySelector('.cart-item');
    
    // Set item data
    const titleElement = itemElement.querySelector('.cart-item-title');
    const styleElement = itemElement.querySelector('.cart-item-style span');
    const colorElement = itemElement.querySelector('.cart-item-color span');
    const embellishmentTypeElement = itemElement.querySelector('.cart-item-embellishment-type span');
    const embellishmentOptionsElement = itemElement.querySelector('.cart-item-embellishment-options');
    const sizesContainer = itemElement.querySelector('.cart-item-sizes');
    const imageElement = itemElement.querySelector('.cart-item-image');
    const removeButton = itemElement.querySelector('.remove-item-btn');
    
    // Set basic item info
    if (titleElement) {
      titleElement.textContent = `${item.StyleNumber} - ${item.Color}`;
    }
    
    if (styleElement) {
      styleElement.textContent = item.StyleNumber;
    }
    
    if (colorElement) {
      colorElement.textContent = item.Color;
    }
    
    if (embellishmentTypeElement) {
      embellishmentTypeElement.textContent = formatEmbellishmentType(item.ImprintType);
    }
    
    // Set embellishment options
    if (embellishmentOptionsElement) {
      try {
        const options = JSON.parse(item.EmbellishmentOptions || '{}');
        embellishmentOptionsElement.innerHTML = '';
        
        for (const [key, value] of Object.entries(options)) {
          if (key === 'additionalLocations' && Array.isArray(value)) {
            const locationsElement = document.createElement('p');
            locationsElement.textContent = `Additional Locations: ${value.length}`;
            embellishmentOptionsElement.appendChild(locationsElement);
          } else {
            const optionElement = document.createElement('p');
            optionElement.textContent = `${formatOptionName(key)}: ${formatOptionValue(key, value)}`;
            embellishmentOptionsElement.appendChild(optionElement);
          }
        }
      } catch (error) {
        console.error('Error parsing embellishment options:', error);
        embellishmentOptionsElement.innerHTML = '<p>Error displaying options</p>';
      }
    }
    
    // Set image (placeholder for now)
    if (imageElement) {
      imageElement.src = `https://via.placeholder.com/150?text=${encodeURIComponent(item.StyleNumber)}`;
      imageElement.alt = `${item.StyleNumber} - ${item.Color}`;
    }
    
    // Render sizes
    if (sizesContainer && item.sizes) {
      sizesContainer.innerHTML = '';
      
      item.sizes.forEach(size => {
        const sizeElement = renderSizeItem(size, item.CartItemID, isSaved);
        sizesContainer.appendChild(sizeElement);
      });
    }
    
    // Add event listener to remove button
    if (removeButton) {
      removeButton.addEventListener('click', async () => {
        // Show loading state
        removeButton.disabled = true;
        removeButton.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>';
        
        const result = await NWCACart.removeItem(item.CartItemID);
        
        if (!result.success) {
          // Reset button state
          removeButton.disabled = false;
          removeButton.textContent = 'Remove';
          
          // Show error notification
          showNotification(result.error || 'Failed to remove item', 'danger');
        }
      });
      
      // Change button text for saved items
      if (isSaved) {
        removeButton.textContent = 'Delete';
        
        // Add "Move to Cart" button
        const moveToCartBtn = document.createElement('button');
        moveToCartBtn.className = 'btn btn-sm btn-primary mr-2';
        moveToCartBtn.textContent = 'Move to Cart';
        moveToCartBtn.addEventListener('click', async () => {
          // Show loading state
          moveToCartBtn.disabled = true;
          moveToCartBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Moving...';
          
          await moveToCart(item.CartItemID);
          
          // Button state will be updated by renderCart
        });
        
        removeButton.parentElement.insertBefore(moveToCartBtn, removeButton);
      }
    }
    
    return itemElement;
  }
  
  /**
   * Render a size item
   * @param {Object} size - Size item
   * @param {number} cartItemId - Cart item ID
   * @param {boolean} isSaved - Whether the item is saved for later
   * @returns {HTMLElement} - Size item element
   */
  function renderSizeItem(size, cartItemId, isSaved = false) {
    if (!templates.sizeItem) return document.createElement('div');
    
    // Clone the template
    const template = templates.sizeItem.content.cloneNode(true);
    const sizeElement = template.querySelector('.size-item');
    
    // Set size data
    const sizeLabel = sizeElement.querySelector('.size-label');
    const quantityInput = sizeElement.querySelector('.quantity-input');
    const decreaseBtn = sizeElement.querySelector('.quantity-decrease');
    const increaseBtn = sizeElement.querySelector('.quantity-increase');
    const priceElement = sizeElement.querySelector('.size-price');
    
    if (sizeLabel) {
      sizeLabel.textContent = size.Size;
    }
    
    if (quantityInput) {
      quantityInput.value = size.Quantity;
      quantityInput.disabled = isSaved;
      
      // Add event listener for quantity changes
      if (!isSaved) {
        quantityInput.addEventListener('change', async () => {
          const newQuantity = parseInt(quantityInput.value) || 0;
          
          // Show loading state
          quantityInput.disabled = true;
          
          const result = await NWCACart.updateQuantity(cartItemId, size.Size, newQuantity);
          
          // Reset input state
          quantityInput.disabled = false;
          
          if (!result.success) {
            // Show error notification
            showNotification(result.error || 'Failed to update quantity', 'danger');
            
            // Reset to previous value (will be updated by renderCart)
          }
        });
      }
    }
    
    if (decreaseBtn) {
      decreaseBtn.disabled = isSaved;
      
      if (!isSaved) {
        decreaseBtn.addEventListener('click', async () => {
          const currentQuantity = parseInt(quantityInput.value) || 0;
          const newQuantity = Math.max(0, currentQuantity - 1);
          
          // Update input value immediately for better UX
          quantityInput.value = newQuantity;
          
          // Disable controls during update
          decreaseBtn.disabled = true;
          increaseBtn.disabled = true;
          quantityInput.disabled = true;
          
          const result = await NWCACart.updateQuantity(cartItemId, size.Size, newQuantity);
          
          // Reset controls state
          decreaseBtn.disabled = isSaved;
          increaseBtn.disabled = isSaved;
          quantityInput.disabled = isSaved;
          
          if (!result.success) {
            // Show error notification
            showNotification(result.error || 'Failed to update quantity', 'danger');
          }
        });
      }
    }
    
    if (increaseBtn) {
      increaseBtn.disabled = isSaved;
      
      if (!isSaved) {
        increaseBtn.addEventListener('click', async () => {
          const currentQuantity = parseInt(quantityInput.value) || 0;
          const newQuantity = currentQuantity + 1;
          
          // Update input value immediately for better UX
          quantityInput.value = newQuantity;
          
          // Disable controls during update
          decreaseBtn.disabled = true;
          increaseBtn.disabled = true;
          quantityInput.disabled = true;
          
          const result = await NWCACart.updateQuantity(cartItemId, size.Size, newQuantity);
          
          // Reset controls state
          decreaseBtn.disabled = isSaved;
          increaseBtn.disabled = isSaved;
          quantityInput.disabled = isSaved;
          
          if (!result.success) {
            // Show error notification
            showNotification(result.error || 'Failed to update quantity', 'danger');
          }
        });
      }
    }
    
    if (priceElement) {
      const totalPrice = size.Quantity * size.UnitPrice;
      priceElement.textContent = formatCurrency(totalPrice);
    }
    
    return sizeElement;
  }
  
  /**
   * Update the cart summary
   */
  function updateCartSummary() {
    const subtotal = NWCACart.getCartTotal();
    const ltmFeeAmount = subtotal < 100 ? 15 : 0; // Example: Less Than Minimum fee
    const total = subtotal + ltmFeeAmount;
    
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
      elements.ltmFeeRow.style.display = ltmFeeAmount > 0 ? 'flex' : 'none';
    }
    
    // Update review summary
    if (elements.reviewSubtotal) {
      elements.reviewSubtotal.textContent = formatCurrency(subtotal);
    }
    
    if (elements.reviewTotal) {
      elements.reviewTotal.textContent = formatCurrency(total);
    }
    
    if (elements.reviewLtmFee) {
      elements.reviewLtmFee.textContent = formatCurrency(ltmFeeAmount);
    }
  }
  
  /**
   * Handle save for later
   */
  async function handleSaveForLater() {
    const result = await NWCACart.saveForLater();
    
    if (result.success) {
      showNotification('Your cart has been saved for later', 'success');
    } else {
      showNotification(result.error || 'Failed to save cart for later', 'danger');
    }
  }
  
  /**
   * Move an item to the cart
   * @param {number} cartItemId - Cart item ID
   */
  async function moveToCart(cartItemId) {
    try {
      // Find the item
      const item = NWCACart.getCartItems().find(item => item.CartItemID === cartItemId);
      
      if (!item) {
        throw new Error('Item not found');
      }
      
      // Update the item status
      const response = await fetch(`/api/cart-items/${cartItemId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...item,
          CartStatus: 'Active'
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to move item to cart');
      }
      
      // Update local state
      item.CartStatus = 'Active';
      
      // Save to localStorage
      NWCACart.syncWithServer();
      
      showNotification('Item moved to cart', 'success');
    } catch (error) {
      console.error('Error moving item to cart:', error);
      showNotification('Failed to move item to cart', 'danger');
    }
  }
  
  /**
   * Handle shipping form submission
   * @param {Event} event - Form submission event
   */
  function handleShippingFormSubmit(event) {
    event.preventDefault();
    
    // Get form data
    const formData = new FormData(elements.shippingForm);
    customerData = Object.fromEntries(formData.entries());
    
    // Validate form
    const requiredFields = ['name', 'email', 'phone', 'address1', 'city', 'state', 'zipCode', 'country'];
    const missingFields = requiredFields.filter(field => !customerData[field]);
    
    if (missingFields.length > 0) {
      showNotification(`Please fill in all required fields: ${missingFields.join(', ')}`, 'danger');
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
    if (!elements.reviewCustomerInfo) return;
    
    elements.reviewCustomerInfo.innerHTML = `
      <h5>${customerData.name}</h5>
      <p>${customerData.email}</p>
      <p>${customerData.phone}</p>
      ${customerData.company ? `<p>${customerData.company}</p>` : ''}
      <p>${customerData.address1}</p>
      ${customerData.address2 ? `<p>${customerData.address2}</p>` : ''}
      <p>${customerData.city}, ${customerData.state} ${customerData.zipCode}</p>
      <p>${customerData.country}</p>
    `;
  }
  
  /**
   * Render items in review step
   */
  function renderReviewItems() {
    if (!elements.reviewItemsList) return;
    
    elements.reviewItemsList.innerHTML = '';
    
    const activeItems = NWCACart.getCartItems('Active');
    
    activeItems.forEach(item => {
      const itemElement = document.createElement('div');
      itemElement.className = 'review-item mb-3';
      
      let sizesHtml = '';
      let totalQuantity = 0;
      
      item.sizes.forEach(size => {
        sizesHtml += `
          <div class="d-flex justify-content-between">
            <span>${size.Size}</span>
            <span>${size.Quantity}</span>
            <span>${formatCurrency(size.Quantity * size.UnitPrice)}</span>
          </div>
        `;
        totalQuantity += size.Quantity;
      });
      
      itemElement.innerHTML = `
        <div class="d-flex justify-content-between align-items-center">
          <div>
            <h5>${item.StyleNumber} - ${item.Color}</h5>
            <p>Embellishment: ${formatEmbellishmentType(item.ImprintType)}</p>
          </div>
          <div class="text-right">
            <p>Total Quantity: ${totalQuantity}</p>
          </div>
        </div>
        <div class="sizes-container mt-2">
          <div class="d-flex justify-content-between font-weight-bold">
            <span>Size</span>
            <span>Quantity</span>
            <span>Price</span>
          </div>
          ${sizesHtml}
        </div>
      `;
      
      elements.reviewItemsList.appendChild(itemElement);
    });
  }
  
  /**
   * Handle submit order
   */
  async function handleSubmitOrder() {
    try {
      // Show loading state
      elements.submitOrderBtn.disabled = true;
      elements.submitOrderBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Submitting...';
      
      // Get cart items
      const activeItems = NWCACart.getCartItems('Active');
      
      if (activeItems.length === 0) {
        throw new Error('Your cart is empty');
      }
      
      // Create customer if needed
      const customerResponse = await fetch('/api/customers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(customerData)
      });
      
      if (!customerResponse.ok) {
        throw new Error('Failed to create customer');
      }
      
      const customer = await customerResponse.json();
      
      // Create order
      const orderData = {
        CustomerID: customer.CustomerID,
        OrderDate: new Date().toISOString(),
        TotalAmount: NWCACart.getCartTotal(),
        OrderStatus: 'New',
        ImprintType: activeItems[0].ImprintType, // Use the first item's imprint type
        PaymentStatus: 'Pending',
        Notes: customerData.notes || ''
      };
      
      const orderResponse = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(orderData)
      });
      
      if (!orderResponse.ok) {
        throw new Error('Failed to create order');
      }
      
      const order = await orderResponse.json();
      
      // Update cart items with order ID
      for (const item of activeItems) {
        await fetch(`/api/cart-items/${item.CartItemID}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            ...item,
            OrderID: order.OrderID,
            CartStatus: 'Converted'
          })
        });
      }
      
      // Generate a quote reference
      const quoteRef = `Q${Date.now().toString().substring(3)}`;
      
      // Show confirmation
      if (elements.quoteReference) {
        elements.quoteReference.textContent = quoteRef;
      }
      
      // Go to confirmation step
      goToStep(4);
      
      // Clear the cart
      await NWCACart.syncWithServer();
    } catch (error) {
      console.error('Error submitting order:', error);
      showNotification(`Failed to submit order: ${error.message}`, 'danger');
      
      // Reset button state
      elements.submitOrderBtn.disabled = false;
      elements.submitOrderBtn.textContent = 'Submit Quote Request';
    }
  }
  
  /**
   * Go to a specific step
   * @param {number} step - Step number
   */
  function goToStep(step) {
    currentStep = step;
    
    // Update progress steps
    if (elements.progressSteps) {
      elements.progressSteps.forEach((stepElement, index) => {
        if (index + 1 < step) {
          stepElement.classList.remove('active');
          stepElement.classList.add('completed');
        } else if (index + 1 === step) {
          stepElement.classList.add('active');
          stepElement.classList.remove('completed');
        } else {
          stepElement.classList.remove('active', 'completed');
        }
      });
    }
    
    // Show/hide containers based on step
    if (elements.cartItemsContainer) {
      elements.cartItemsContainer.style.display = step === 1 ? 'block' : 'none';
    }
    
    if (elements.emptyCartMessage) {
      elements.emptyCartMessage.style.display = step === 1 && NWCACart.getCartItems('Active').length === 0 ? 'block' : 'none';
    }
    
    if (elements.cartSummary) {
      elements.cartSummary.style.display = step === 1 && NWCACart.getCartItems('Active').length > 0 ? 'block' : 'none';
    }
    
    if (elements.savedItemsContainer) {
      elements.savedItemsContainer.style.display = step === 1 && NWCACart.getCartItems('SavedForLater').length > 0 ? 'block' : 'none';
    }
    
    if (elements.shippingFormContainer) {
      elements.shippingFormContainer.style.display = step === 2 ? 'block' : 'none';
    }
    
    if (elements.reviewOrderContainer) {
      elements.reviewOrderContainer.style.display = step === 3 ? 'block' : 'none';
    }
    
    if (elements.orderConfirmationContainer) {
      elements.orderConfirmationContainer.style.display = step === 4 ? 'block' : 'none';
    }
  }
  
  /**
   * Show a notification
   * @param {string} message - Notification message
   * @param {string} type - Notification type (success, danger, warning, info)
   */
  function showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `alert alert-${type} alert-dismissible fade show`;
    notification.setAttribute('role', 'alert');
    notification.innerHTML = `
      ${message}
      <button type="button" class="close" data-dismiss="alert" aria-label="Close">
        <span aria-hidden="true">&times;</span>
      </button>
    `;
    
    // Add to page
    document.body.appendChild(notification);
    
    // Position the notification
    notification.style.position = 'fixed';
    notification.style.top = '20px';
    notification.style.right = '20px';
    notification.style.zIndex = '9999';
    notification.style.maxWidth = '400px';
    
    // Remove after 5 seconds
    setTimeout(() => {
      notification.classList.remove('show');
      setTimeout(() => {
        notification.remove();
      }, 150);
    }, 5000);
  }
  
  /**
   * Format currency
   * @param {number} amount - Amount to format
   * @returns {string} - Formatted currency
   */
  function formatCurrency(amount) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  }
  
  /**
   * Format embellishment type
   * @param {string} type - Embellishment type
   * @returns {string} - Formatted embellishment type
   */
  function formatEmbellishmentType(type) {
    switch (type) {
      case 'embroidery':
        return 'Embroidery';
      case 'cap-embroidery':
        return 'Cap Embroidery';
      case 'dtg':
        return 'DTG (Direct to Garment)';
      case 'screen-print':
        return 'Screen Print';
      default:
        return type;
    }
  }
  
  /**
   * Format option name
   * @param {string} name - Option name
   * @returns {string} - Formatted option name
   */
  function formatOptionName(name) {
    // Convert camelCase to Title Case with Spaces
    return name
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase());
  }
  
  /**
   * Format option value
   * @param {string} key - Option key
   * @param {any} value - Option value
   * @returns {string} - Formatted option value
   */
  function formatOptionValue(key, value) {
    if (typeof value === 'boolean') {
      return value ? 'Yes' : 'No';
    }
    
    if (key === 'stitchCount') {
      return `${value.toLocaleString()} stitches`;
    }
    
    if (key === 'colorCount') {
      return `${value} color${value !== 1 ? 's' : ''}`;
    }
    
    return value;
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
  NWCACartUI.initialize();
});