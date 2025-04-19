// Cart functionality for Northwest Custom Apparel

// API endpoints
const API_BASE_URL = '/api'; // This will be proxied to the Caspio API
const ENDPOINTS = {
    cartSessions: {
        getAll: `${API_BASE_URL}/cart-sessions`,
        getById: (id) => `${API_BASE_URL}/cart-sessions/${id}`,
        create: `${API_BASE_URL}/cart-sessions`,
        update: (id) => `${API_BASE_URL}/cart-sessions/${id}`,
        delete: (id) => `${API_BASE_URL}/cart-sessions/${id}`
    },
    cartItems: {
        getAll: `${API_BASE_URL}/cart-items`,
        getBySession: (sessionId) => `${API_BASE_URL}/cart-items/session/${sessionId}`,
        create: `${API_BASE_URL}/cart-items`,
        update: (id) => `${API_BASE_URL}/cart-items/${id}`,
        delete: (id) => `${API_BASE_URL}/cart-items/${id}`
    },
    cartItemSizes: {
        getAll: `${API_BASE_URL}/cart-item-sizes`,
        getByCartItem: (cartItemId) => `${API_BASE_URL}/cart-item-sizes/cart-item/${cartItemId}`,
        create: `${API_BASE_URL}/cart-item-sizes`,
        update: (id) => `${API_BASE_URL}/cart-item-sizes/${id}`,
        delete: (id) => `${API_BASE_URL}/cart-item-sizes/${id}`
    },
    customers: {
        getAll: `${API_BASE_URL}/customers`,
        getByEmail: (email) => `${API_BASE_URL}/customers/email/${email}`,
        create: `${API_BASE_URL}/customers`,
        update: (id) => `${API_BASE_URL}/customers/${id}`
    }
};

// Cart state
let cartState = {
    sessionId: null,
    items: [],
    customer: null,
    loading: true,
    error: null
};

// DOM elements
const cartContentEl = document.getElementById('cart-content');
const cartCountEl = document.getElementById('cart-count');
const checkoutContainerEl = document.getElementById('checkout-container');
const confirmationContainerEl = document.getElementById('confirmation-container');

// Step navigation elements
const prevStepBtn = document.getElementById('prev-step');
const nextStepBtn = document.getElementById('next-step');
const submitOrderBtn = document.getElementById('submit-order');
const stepElements = document.querySelectorAll('.step');
const stepContentElements = document.querySelectorAll('.step-content');

// Current checkout step
let currentStep = 'cart';

// Initialize the cart
document.addEventListener('DOMContentLoaded', async () => {
    try {
        await initializeCart();
        updateCartDisplay();
    } catch (error) {
        console.error('Error initializing cart:', error);
        showError('There was an error loading your cart. Please try again later.');
    }

    // Set up checkout navigation
    setupCheckoutNavigation();
});

// Initialize the cart - get or create a session
async function initializeCart() {
    cartState.loading = true;
    
    // Check if we have a session ID in localStorage
    const storedSessionId = localStorage.getItem('nwca_cart_session_id');
    
    if (storedSessionId) {
        try {
            // Try to get the session from the API
            const response = await fetch(ENDPOINTS.cartSessions.getById(storedSessionId));
            
            if (response.ok) {
                const session = await response.json();
                
                // Check if the session is still active
                if (session.IsActive) {
                    cartState.sessionId = storedSessionId;
                    await loadCartItems();
                } else {
                    // Session is no longer active, create a new one
                    await createNewSession();
                }
            } else {
                // Session not found or other error, create a new one
                await createNewSession();
            }
        } catch (error) {
            console.error('Error retrieving session:', error);
            await createNewSession();
        }
    } else {
        // No stored session ID, create a new one
        await createNewSession();
    }
    
    cartState.loading = false;
}

// Create a new cart session
async function createNewSession() {
    try {
        const userAgent = navigator.userAgent;
        
        const sessionData = {
            CreateDate: new Date().toISOString(),
            LastActivity: new Date().toISOString(),
            UserAgent: userAgent,
            IsActive: true
        };
        
        const response = await fetch(ENDPOINTS.cartSessions.create, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(sessionData)
        });
        
        if (response.ok) {
            const newSession = await response.json();
            cartState.sessionId = newSession.SessionID;
            localStorage.setItem('nwca_cart_session_id', newSession.SessionID);
            cartState.items = [];
        } else {
            throw new Error('Failed to create a new session');
        }
    } catch (error) {
        console.error('Error creating new session:', error);
        cartState.error = 'Unable to create a shopping cart session. Please try again later.';
    }
}

// Load cart items for the current session
async function loadCartItems() {
    try {
        const response = await fetch(ENDPOINTS.cartItems.getBySession(cartState.sessionId));
        
        if (response.ok) {
            const items = await response.json();
            cartState.items = [];
            
            // For each cart item, load its sizes
            for (const item of items) {
                const sizesResponse = await fetch(ENDPOINTS.cartItemSizes.getByCartItem(item.CartItemID));
                
                if (sizesResponse.ok) {
                    const sizes = await sizesResponse.json();
                    cartState.items.push({
                        ...item,
                        sizes: sizes
                    });
                }
            }
        } else {
            throw new Error('Failed to load cart items');
        }
    } catch (error) {
        console.error('Error loading cart items:', error);
        cartState.error = 'Unable to load your cart items. Please try again later.';
    }
}

// Update the cart display
function updateCartDisplay() {
    // Update cart count
    updateCartCount();
    
    // Clear the cart content
    cartContentEl.innerHTML = '';
    
    // Show loading, error, or cart content
    if (cartState.loading) {
        showLoading();
    } else if (cartState.error) {
        showError(cartState.error);
    } else if (cartState.items.length === 0) {
        showEmptyCart();
    } else {
        showCartItems();
        // Show the checkout container
        checkoutContainerEl.style.display = 'block';
    }
}

// Update the cart count in the header
function updateCartCount() {
    let totalItems = 0;
    
    cartState.items.forEach(item => {
        item.sizes.forEach(size => {
            totalItems += size.Quantity;
        });
    });
    
    cartCountEl.textContent = totalItems;
}

// Show loading indicator
function showLoading() {
    cartContentEl.innerHTML = `
        <div class="loading">
            <div class="spinner"></div>
            <p>Loading your cart...</p>
        </div>
    `;
}

// Show error message
function showError(message) {
    cartContentEl.innerHTML = `
        <div class="error-message">
            <p>${message}</p>
            <button class="btn btn-primary" onclick="location.reload()">Try Again</button>
        </div>
    `;
}

// Show empty cart message
function showEmptyCart() {
    cartContentEl.innerHTML = `
        <div class="empty-cart">
            <h3>Your cart is empty</h3>
            <p>Looks like you haven't added any items to your cart yet.</p>
            <a href="index.html" class="btn btn-primary">Browse Catalog</a>
        </div>
    `;
    
    // Hide the checkout container
    checkoutContainerEl.style.display = 'none';
}

// Show cart items
function showCartItems() {
    // Create the cart table
    let cartHTML = `
        <table class="cart-table">
            <thead>
                <tr>
                    <th>Product</th>
                    <th>Size</th>
                    <th>Quantity</th>
                    <th>Unit Price</th>
                    <th>Total</th>
                    <th></th>
                </tr>
            </thead>
            <tbody>
    `;
    
    // Add each item to the table
    let subtotal = 0;
    
    cartState.items.forEach(item => {
        item.sizes.forEach(size => {
            const itemTotal = size.Quantity * size.UnitPrice;
            subtotal += itemTotal;
            
            cartHTML += `
                <tr data-cart-item-id="${item.CartItemID}" data-size-item-id="${size.SizeItemID}">
                    <td>
                        <div class="product-info">
                            <img src="https://via.placeholder.com/80" alt="${item.StyleNumber}" class="product-image">
                            <div class="product-details">
                                <div class="product-name">${item.StyleNumber}</div>
                                <div class="product-meta">
                                    Color: ${item.Color}<br>
                                    Imprint: ${item.ImprintType}
                                </div>
                            </div>
                        </div>
                    </td>
                    <td>${size.Size}</td>
                    <td>
                        <div class="quantity-control">
                            <div class="quantity-btn" onclick="updateQuantity(${size.SizeItemID}, ${size.Quantity - 1})">-</div>
                            <input type="number" class="quantity-input" value="${size.Quantity}" min="1" onchange="updateQuantity(${size.SizeItemID}, this.value)">
                            <div class="quantity-btn" onclick="updateQuantity(${size.SizeItemID}, ${size.Quantity + 1})">+</div>
                        </div>
                    </td>
                    <td>$${size.UnitPrice.toFixed(2)}</td>
                    <td>$${itemTotal.toFixed(2)}</td>
                    <td>
                        <button class="remove-btn" onclick="removeItem(${size.SizeItemID})">×</button>
                    </td>
                </tr>
            `;
        });
    });
    
    cartHTML += `
            </tbody>
        </table>
    `;
    
    // Add cart summary
    cartHTML += `
        <div class="cart-summary">
            <div class="summary-row">
                <div class="summary-label">Subtotal:</div>
                <div class="summary-value">$${subtotal.toFixed(2)}</div>
            </div>
            <div class="summary-row">
                <div class="summary-label">Estimated Tax:</div>
                <div class="summary-value">Calculated at checkout</div>
            </div>
            <div class="summary-row">
                <div class="summary-label">Estimated Total:</div>
                <div class="summary-value">$${subtotal.toFixed(2)}</div>
            </div>
        </div>
        
        <div class="cart-actions">
            <a href="index.html" class="btn btn-secondary">Continue Shopping</a>
            <button class="btn btn-primary" onclick="proceedToCheckout()">Proceed to Checkout</button>
        </div>
    `;
    
    cartContentEl.innerHTML = cartHTML;
    
    // Also update the cart summary in the checkout step
    document.getElementById('step-cart').innerHTML = `
        <div class="cart-summary">
            <div class="summary-row">
                <div class="summary-label">Items:</div>
                <div class="summary-value">${cartState.items.length}</div>
            </div>
            <div class="summary-row">
                <div class="summary-label">Subtotal:</div>
                <div class="summary-value">$${subtotal.toFixed(2)}</div>
            </div>
            <div class="summary-row">
                <div class="summary-label">Estimated Tax:</div>
                <div class="summary-value">Calculated at checkout</div>
            </div>
            <div class="summary-row">
                <div class="summary-label">Estimated Total:</div>
                <div class="summary-value">$${subtotal.toFixed(2)}</div>
            </div>
        </div>
    `;
}

// Update item quantity
async function updateQuantity(sizeItemId, newQuantity) {
    // Ensure quantity is at least 1
    newQuantity = Math.max(1, parseInt(newQuantity));
    
    try {
        // Find the size item in the cart state
        let sizeItem = null;
        let cartItem = null;
        
        for (const item of cartState.items) {
            for (const size of item.sizes) {
                if (size.SizeItemID === sizeItemId) {
                    sizeItem = size;
                    cartItem = item;
                    break;
                }
            }
            if (sizeItem) break;
        }
        
        if (!sizeItem) {
            throw new Error('Size item not found');
        }
        
        // Update the quantity in the API
        const response = await fetch(ENDPOINTS.cartItemSizes.update(sizeItemId), {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                ...sizeItem,
                Quantity: newQuantity
            })
        });
        
        if (response.ok) {
            // Update the quantity in the cart state
            sizeItem.Quantity = newQuantity;
            
            // Update the cart display
            updateCartDisplay();
        } else {
            throw new Error('Failed to update quantity');
        }
    } catch (error) {
        console.error('Error updating quantity:', error);
        alert('There was an error updating the quantity. Please try again.');
    }
}

// Remove item from cart
async function removeItem(sizeItemId) {
    try {
        // Find the size item in the cart state
        let sizeItemIndex = -1;
        let cartItemIndex = -1;
        
        for (let i = 0; i < cartState.items.length; i++) {
            const item = cartState.items[i];
            for (let j = 0; j < item.sizes.length; j++) {
                if (item.sizes[j].SizeItemID === sizeItemId) {
                    sizeItemIndex = j;
                    cartItemIndex = i;
                    break;
                }
            }
            if (sizeItemIndex !== -1) break;
        }
        
        if (sizeItemIndex === -1) {
            throw new Error('Size item not found');
        }
        
        // Delete the size item from the API
        const response = await fetch(ENDPOINTS.cartItemSizes.delete(sizeItemId), {
            method: 'DELETE'
        });
        
        if (response.ok) {
            // Remove the size item from the cart state
            const cartItem = cartState.items[cartItemIndex];
            cartItem.sizes.splice(sizeItemIndex, 1);
            
            // If there are no more sizes for this cart item, remove the cart item
            if (cartItem.sizes.length === 0) {
                // Delete the cart item from the API
                await fetch(ENDPOINTS.cartItems.delete(cartItem.CartItemID), {
                    method: 'DELETE'
                });
                
                // Remove the cart item from the cart state
                cartState.items.splice(cartItemIndex, 1);
            }
            
            // Update the cart display
            updateCartDisplay();
        } else {
            throw new Error('Failed to remove item');
        }
    } catch (error) {
        console.error('Error removing item:', error);
        alert('There was an error removing the item. Please try again.');
    }
}

// Proceed to checkout
function proceedToCheckout() {
    // Show the checkout container
    checkoutContainerEl.style.display = 'block';
    
    // Scroll to the checkout container
    checkoutContainerEl.scrollIntoView({ behavior: 'smooth' });
}

// Set up checkout navigation
function setupCheckoutNavigation() {
    // Previous step button
    prevStepBtn.addEventListener('click', () => {
        if (currentStep === 'customer') {
            goToStep('cart');
        } else if (currentStep === 'review') {
            goToStep('customer');
        }
    });
    
    // Next step button
    nextStepBtn.addEventListener('click', () => {
        if (currentStep === 'cart') {
            goToStep('customer');
        } else if (currentStep === 'customer') {
            // Validate customer form
            if (validateCustomerForm()) {
                // Save customer info
                saveCustomerInfo();
                goToStep('review');
            }
        }
    });
    
    // Submit order button
    submitOrderBtn.addEventListener('click', async () => {
        // Check if terms are agreed
        const termsAgree = document.getElementById('terms-agree');
        if (!termsAgree.checked) {
            alert('Please agree to the terms to submit your quote request.');
            return;
        }
        
        // Submit the order
        await submitOrder();
    });
}

// Go to a specific checkout step
function goToStep(step) {
    // Update current step
    currentStep = step;
    
    // Update step indicators
    stepElements.forEach(el => {
        el.classList.remove('active', 'completed');
        
        if (el.dataset.step === step) {
            el.classList.add('active');
        } else if (
            (step === 'customer' && el.dataset.step === 'cart') ||
            (step === 'review' && (el.dataset.step === 'cart' || el.dataset.step === 'customer'))
        ) {
            el.classList.add('completed');
        }
    });
    
    // Show the current step content
    stepContentElements.forEach(el => {
        el.style.display = el.id === `step-${step}` ? 'block' : 'none';
    });
    
    // Update navigation buttons
    if (step === 'cart') {
        prevStepBtn.style.display = 'none';
        nextStepBtn.style.display = 'block';
        nextStepBtn.textContent = 'Continue to Customer Information';
        submitOrderBtn.style.display = 'none';
    } else if (step === 'customer') {
        prevStepBtn.style.display = 'block';
        nextStepBtn.style.display = 'block';
        nextStepBtn.textContent = 'Continue to Review';
        submitOrderBtn.style.display = 'none';
    } else if (step === 'review') {
        prevStepBtn.style.display = 'block';
        nextStepBtn.style.display = 'none';
        submitOrderBtn.style.display = 'block';
        
        // Update review content
        updateReviewContent();
    }
}

// Validate customer form
function validateCustomerForm() {
    const form = document.getElementById('customer-form');
    const requiredFields = form.querySelectorAll('[required]');
    
    let isValid = true;
    
    requiredFields.forEach(field => {
        if (!field.value.trim()) {
            isValid = false;
            field.classList.add('invalid');
        } else {
            field.classList.remove('invalid');
        }
    });
    
    if (!isValid) {
        alert('Please fill in all required fields.');
    }
    
    return isValid;
}

// Save customer information
function saveCustomerInfo() {
    const form = document.getElementById('customer-form');
    
    cartState.customer = {
        name: form.elements.name.value,
        email: form.elements.email.value,
        phone: form.elements.phone.value,
        company: form.elements.company.value,
        address1: form.elements.address1.value,
        address2: form.elements.address2.value,
        city: form.elements.city.value,
        state: form.elements.state.value,
        zipcode: form.elements.zipcode.value,
        country: form.elements.country.value,
        notes: form.elements.notes.value
    };
}

// Update review content
function updateReviewContent() {
    // Update cart summary in review
    const reviewCartSummary = document.getElementById('review-cart-summary');
    let subtotal = 0;
    let itemsHtml = '';
    
    cartState.items.forEach(item => {
        item.sizes.forEach(size => {
            const itemTotal = size.Quantity * size.UnitPrice;
            subtotal += itemTotal;
            
            itemsHtml += `
                <div class="review-item">
                    <div class="review-item-details">
                        <strong>${item.StyleNumber}</strong> - ${item.Color}
                        <div>Size: ${size.Size}, Quantity: ${size.Quantity}</div>
                        <div>Imprint: ${item.ImprintType}</div>
                    </div>
                    <div class="review-item-price">
                        $${itemTotal.toFixed(2)}
                    </div>
                </div>
            `;
        });
    });
    
    reviewCartSummary.innerHTML = `
        <div class="review-items">
            ${itemsHtml}
        </div>
        <div class="review-totals">
            <div class="summary-row">
                <div class="summary-label">Subtotal:</div>
                <div class="summary-value">$${subtotal.toFixed(2)}</div>
            </div>
            <div class="summary-row">
                <div class="summary-label">Estimated Tax:</div>
                <div class="summary-value">Calculated at checkout</div>
            </div>
            <div class="summary-row">
                <div class="summary-label">Estimated Total:</div>
                <div class="summary-value">$${subtotal.toFixed(2)}</div>
            </div>
        </div>
    `;
    
    // Update customer info in review
    const reviewCustomerInfo = document.getElementById('review-customer-info');
    
    reviewCustomerInfo.innerHTML = `
        <div class="review-row">
            <div class="review-label">Name:</div>
            <div class="review-value">${cartState.customer.name}</div>
        </div>
        <div class="review-row">
            <div class="review-label">Email:</div>
            <div class="review-value">${cartState.customer.email}</div>
        </div>
        ${cartState.customer.phone ? `
            <div class="review-row">
                <div class="review-label">Phone:</div>
                <div class="review-value">${cartState.customer.phone}</div>
            </div>
        ` : ''}
        ${cartState.customer.company ? `
            <div class="review-row">
                <div class="review-label">Company:</div>
                <div class="review-value">${cartState.customer.company}</div>
            </div>
        ` : ''}
        ${cartState.customer.address1 ? `
            <div class="review-row">
                <div class="review-label">Address:</div>
                <div class="review-value">
                    ${cartState.customer.address1}<br>
                    ${cartState.customer.address2 ? cartState.customer.address2 + '<br>' : ''}
                    ${cartState.customer.city ? cartState.customer.city + ', ' : ''}
                    ${cartState.customer.state || ''} ${cartState.customer.zipcode || ''}<br>
                    ${cartState.customer.country || ''}
                </div>
            </div>
        ` : ''}
        ${cartState.customer.notes ? `
            <div class="review-row">
                <div class="review-label">Notes:</div>
                <div class="review-value">${cartState.customer.notes}</div>
            </div>
        ` : ''}
    `;
}

// Submit order
async function submitOrder() {
    try {
        // First, save the customer information to the database
        const customerData = {
            Name: cartState.customer.name,
            Email: cartState.customer.email,
            Phone: cartState.customer.phone || '',
            Company: cartState.customer.company || '',
            Address1: cartState.customer.address1 || '',
            Address2: cartState.customer.address2 || '',
            City: cartState.customer.city || '',
            State: cartState.customer.state || '',
            ZipCode: cartState.customer.zipcode || '',
            Country: cartState.customer.country || 'USA',
            DateCreated: new Date().toISOString(),
            LastUpdated: new Date().toISOString(),
            Notes: cartState.customer.notes || ''
        };
        
        // Check if customer already exists
        const customerResponse = await fetch(ENDPOINTS.customers.getByEmail(cartState.customer.email));
        let customerId;
        
        if (customerResponse.ok) {
            const existingCustomers = await customerResponse.json();
            
            if (existingCustomers && existingCustomers.length > 0) {
                // Update existing customer
                customerId = existingCustomers[0].CustomerID;
                
                await fetch(ENDPOINTS.customers.update(customerId), {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        ...existingCustomers[0],
                        ...customerData
                    })
                });
            } else {
                // Create new customer
                const createResponse = await fetch(ENDPOINTS.customers.create, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(customerData)
                });
                
                if (createResponse.ok) {
                    const newCustomer = await createResponse.json();
                    customerId = newCustomer.CustomerID;
                } else {
                    throw new Error('Failed to create customer');
                }
            }
        } else {
            throw new Error('Failed to check if customer exists');
        }
        
        // Calculate order total
        let totalAmount = 0;
        cartState.items.forEach(item => {
            item.sizes.forEach(size => {
                totalAmount += size.Quantity * size.UnitPrice;
            });
        });
        
        // Determine imprint type (use the first item's imprint type)
        const imprintType = cartState.items.length > 0 ? cartState.items[0].ImprintType : '';
        
        // Create order
        const orderData = {
            CustomerID: customerId,
            OrderDate: new Date().toISOString(),
            TotalAmount: totalAmount,
            OrderStatus: 'New',
            ImprintType: imprintType,
            PaymentStatus: 'Pending',
            Notes: cartState.customer.notes || ''
        };
        
        const orderResponse = await fetch('/api/orders', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(orderData)
        });
        
        if (orderResponse.ok) {
            const newOrder = await orderResponse.json();
            
            // Update cart items with the order ID
            for (const item of cartState.items) {
                await fetch(ENDPOINTS.cartItems.update(item.CartItemID), {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        ...item,
                        OrderID: newOrder.OrderID,
                        CartStatus: 'Converted'
                    })
                });
            }
            
            // Mark the session as inactive
            await fetch(ENDPOINTS.cartSessions.update(cartState.sessionId), {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    SessionID: cartState.sessionId,
                    IsActive: false,
                    LastActivity: new Date().toISOString()
                })
            });
            
            // Clear the cart session from localStorage
            localStorage.removeItem('nwca_cart_session_id');
            
            // Show order confirmation
            showOrderConfirmation(newOrder.OrderID);
        } else {
            throw new Error('Failed to create order');
        }
    } catch (error) {
        console.error('Error submitting order:', error);
        alert('There was an error submitting your order. Please try again later.');
    }
}

// Show order confirmation
function showOrderConfirmation(orderId) {
    // Hide checkout container
    checkoutContainerEl.style.display = 'none';
    
    // Show confirmation container
    confirmationContainerEl.style.display = 'block';
    
    // Set quote reference
    document.getElementById('quote-reference').textContent = `Q${orderId}`;
    
    // Scroll to confirmation
    confirmationContainerEl.scrollIntoView({ behavior: 'smooth' });
}

// Add to cart function (to be called from product page)
window.addToCart = async function(productData) {
    try {
        // Initialize cart if needed
        if (!cartState.sessionId) {
            await initializeCart();
        }
        
        // Create cart item
        const cartItemData = {
            SessionID: cartState.sessionId,
            ProductID: productData.productId,
            StyleNumber: productData.styleNumber,
            Color: productData.color,
            ImprintType: productData.imprintType,
            DateAdded: new Date().toISOString(),
            CartStatus: 'Active'
        };
        
        const response = await fetch(ENDPOINTS.cartItems.create, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(cartItemData)
        });
        
        if (response.ok) {
            const newCartItem = await response.json();
            
            // Create cart item sizes
            for (const size of productData.sizes) {
                const sizeData = {
                    CartItemID: newCartItem.CartItemID,
                    Size: size.size,
                    Quantity: size.quantity,
                    UnitPrice: size.unitPrice
                };
                
                await fetch(ENDPOINTS.cartItemSizes.create, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(sizeData)
                });
            }
            
            // Reload cart items
            await loadCartItems();
            
            // Update cart count
            updateCartCount();
            
            return true;
        } else {
            throw new Error('Failed to add item to cart');
        }
    } catch (error) {
        console.error('Error adding to cart:', error);
        return false;
    }
};