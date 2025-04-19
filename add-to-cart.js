// Add to Cart functionality for product pages

/**
 * Add a product to the cart
 * @param {Object} productData - Product data object
 * @param {string} productData.productId - Product ID
 * @param {string} productData.styleNumber - Style number
 * @param {string} productData.color - Color
 * @param {string} productData.imprintType - Imprint type (Embroidery, Cap Embroidery, Screen Print, DTG, DTF)
 * @param {Array} productData.sizes - Array of size objects with size, quantity, and unitPrice
 * @returns {Promise<boolean>} - True if successful, false otherwise
 */
async function addToCart(productData) {
    try {
        // Validate product data
        if (!productData.productId || !productData.styleNumber || !productData.color || !productData.imprintType) {
            console.error('Missing required product data');
            return false;
        }

        if (!productData.sizes || !Array.isArray(productData.sizes) || productData.sizes.length === 0) {
            console.error('No sizes specified');
            return false;
        }

        // Check if any sizes have a quantity
        const hasSizes = productData.sizes.some(size => size.quantity > 0);
        if (!hasSizes) {
            console.error('No quantities specified');
            return false;
        }

        // Filter out sizes with zero quantity
        const sizesWithQuantity = productData.sizes.filter(size => size.quantity > 0);
        
        // Create a modified product data object with only sizes that have quantity
        const modifiedProductData = {
            ...productData,
            sizes: sizesWithQuantity
        };

        // If window.addToCart exists (from cart.js), use it
        if (window.addToCart) {
            return await window.addToCart(modifiedProductData);
        } else {
            // Otherwise, make a direct API call
            // First, check if we have a session ID in localStorage
            let sessionId = localStorage.getItem('nwca_cart_session_id');
            
            if (!sessionId) {
                // Create a new session
                const sessionResponse = await fetch('/api/cart-sessions', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        CreateDate: new Date().toISOString(),
                        LastActivity: new Date().toISOString(),
                        UserAgent: navigator.userAgent,
                        IsActive: true
                    })
                });
                
                if (!sessionResponse.ok) {
                    throw new Error('Failed to create session');
                }
                
                const sessionData = await sessionResponse.json();
                sessionId = sessionData.SessionID;
                localStorage.setItem('nwca_cart_session_id', sessionId);
            }
            
            // Create cart item
            const cartItemResponse = await fetch('/api/cart-items', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    SessionID: sessionId,
                    ProductID: modifiedProductData.productId,
                    StyleNumber: modifiedProductData.styleNumber,
                    Color: modifiedProductData.color,
                    ImprintType: modifiedProductData.imprintType,
                    DateAdded: new Date().toISOString(),
                    CartStatus: 'Active'
                })
            });
            
            if (!cartItemResponse.ok) {
                throw new Error('Failed to create cart item');
            }
            
            const cartItemData = await cartItemResponse.json();
            
            // Add sizes
            for (const size of modifiedProductData.sizes) {
                const sizeResponse = await fetch('/api/cart-item-sizes', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        CartItemID: cartItemData.CartItemID,
                        Size: size.size,
                        Quantity: size.quantity,
                        UnitPrice: size.unitPrice
                    })
                });
                
                if (!sizeResponse.ok) {
                    throw new Error('Failed to add size to cart item');
                }
            }
            
            return true;
        }
    } catch (error) {
        console.error('Error adding to cart:', error);
        return false;
    }
}

/**
 * Create an "Add to Cart" button
 * @param {string} containerId - ID of the container element
 * @param {Function} getProductDataFn - Function that returns the product data
 */
function createAddToCartButton(containerId, getProductDataFn) {
    const container = document.getElementById(containerId);
    if (!container) {
        console.error(`Container element with ID "${containerId}" not found`);
        return;
    }
    
    // Create the button
    const button = document.createElement('button');
    button.className = 'add-to-cart-btn';
    button.innerHTML = 'Add to Cart';
    
    // Add click event listener
    button.addEventListener('click', async () => {
        // Show loading state
        button.disabled = true;
        button.innerHTML = 'Adding...';
        
        // Get product data
        const productData = getProductDataFn();
        
        // Add to cart
        const success = await addToCart(productData);
        
        // Reset button state
        button.disabled = false;
        
        if (success) {
            // Show success message
            button.innerHTML = 'Added to Cart ✓';
            setTimeout(() => {
                button.innerHTML = 'Add to Cart';
            }, 2000);
            
            // Update cart count if it exists
            const cartCountEl = document.getElementById('cart-count');
            if (cartCountEl) {
                const currentCount = parseInt(cartCountEl.textContent) || 0;
                let totalQuantity = 0;
                productData.sizes.forEach(size => {
                    totalQuantity += size.quantity;
                });
                cartCountEl.textContent = currentCount + totalQuantity;
            }
        } else {
            // Show error message
            button.innerHTML = 'Error - Try Again';
            setTimeout(() => {
                button.innerHTML = 'Add to Cart';
            }, 2000);
        }
    });
    
    // Add the button to the container
    container.appendChild(button);
}

// Export functions
window.addToCartModule = {
    addToCart,
    createAddToCartButton
};