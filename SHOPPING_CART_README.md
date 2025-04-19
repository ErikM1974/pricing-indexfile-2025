# Shopping Cart Implementation for Northwest Custom Apparel

This document provides instructions for setting up and using the shopping cart feature for the Northwest Custom Apparel online catalog.

## Overview

The shopping cart implementation allows customers to:

1. Add products to their cart
2. View and modify their cart contents
3. Enter customer information
4. Submit a quote request to Northwest Custom Apparel

The implementation uses:
- Frontend: HTML, CSS, JavaScript
- Backend: Node.js with Express
- Data Storage: Caspio tables (Cart_Sessions, Cart_Items, Cart_Item_Sizes, Customer_Info, Orders)

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

This will install the required dependencies:
- express
- node-fetch
- body-parser
- dotenv

### 2. Configure Environment Variables

Update the `.env` file with your Caspio API credentials:

```
CASPIO_API_BASE_URL=https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api
CASPIO_API_KEY=your-caspio-api-key-here
PORT=3000
```

Replace `your-caspio-api-key-here` with your actual Caspio API key.

### 3. Start the Server

```bash
npm start
```

The server will start on port 3000 (or the port specified in your .env file).

## Using the Shopping Cart

### Adding "Add to Cart" Functionality to Product Pages

1. Include the add-to-cart.js script in your product page:

```html
<script src="add-to-cart.js"></script>
```

2. Add a container for the "Add to Cart" button:

```html
<div id="add-to-cart-container"></div>
```

3. Create a function that returns the product data:

```javascript
function getProductData() {
    // Get selected sizes and quantities
    const sizes = [];
    const sizeInputs = document.querySelectorAll('.size-input');
    
    sizeInputs.forEach(input => {
        const size = input.dataset.size;
        const quantity = parseInt(input.value) || 0;
        
        if (quantity > 0) {
            sizes.push({
                size: size,
                quantity: quantity,
                unitPrice: parseFloat(input.dataset.price)
            });
        }
    });
    
    // Get product details
    return {
        productId: document.getElementById('product-id').value,
        styleNumber: document.getElementById('style-number').textContent,
        color: document.getElementById('selected-color').value,
        imprintType: document.querySelector('input[name="imprint-type"]:checked').value,
        sizes: sizes
    };
}
```

4. Initialize the "Add to Cart" button:

```javascript
document.addEventListener('DOMContentLoaded', function() {
    window.addToCartModule.createAddToCartButton('add-to-cart-container', getProductData);
});
```

### Adding Cart Icon to Navigation

Add the following HTML to your navigation bar:

```html
<a href="cart.html" class="cart-icon">
    🛒
    <span class="cart-count" id="cart-count">0</span>
</a>
```

### Customizing the Cart Page

The cart.html page is already set up with the following features:
- Cart item display
- Quantity adjustment
- Item removal
- Customer information form
- Order review
- Quote submission

You can customize the styling by modifying cart-styles.css.

## API Endpoints

The server provides the following API endpoints:

### Cart Sessions
- GET /api/cart-sessions - Get all cart sessions
- GET /api/cart-sessions/:id - Get a specific cart session
- POST /api/cart-sessions - Create a new cart session
- PUT /api/cart-sessions/:id - Update a cart session
- DELETE /api/cart-sessions/:id - Delete a cart session

### Cart Items
- GET /api/cart-items - Get all cart items
- GET /api/cart-items/session/:sessionId - Get cart items for a specific session
- POST /api/cart-items - Create a new cart item
- PUT /api/cart-items/:id - Update a cart item
- DELETE /api/cart-items/:id - Delete a cart item

### Cart Item Sizes
- GET /api/cart-item-sizes - Get all cart item sizes
- GET /api/cart-item-sizes/cart-item/:cartItemId - Get sizes for a specific cart item
- POST /api/cart-item-sizes - Create a new cart item size
- PUT /api/cart-item-sizes/:id - Update a cart item size
- DELETE /api/cart-item-sizes/:id - Delete a cart item size

### Customers
- GET /api/customers - Get all customers
- GET /api/customers/email/:email - Get a customer by email
- POST /api/customers - Create a new customer
- PUT /api/customers/:id - Update a customer

### Orders
- POST /api/orders - Create a new order

## Data Flow

1. When a user adds an item to the cart:
   - A cart session is created (or an existing one is used)
   - A cart item is created with the product details
   - Cart item sizes are created with the selected sizes and quantities

2. When a user submits a quote request:
   - Customer information is saved to the Customer_Info table
   - An order is created in the Orders table
   - Cart items are updated with the order ID and marked as "Converted"
   - The cart session is marked as inactive

## Troubleshooting

### Cart Not Loading
- Check that the Caspio API key is correct in the .env file
- Verify that the Caspio tables are set up correctly
- Check the browser console for any JavaScript errors

### Items Not Being Added to Cart
- Verify that the product data is being collected correctly
- Check that the API endpoints are working properly
- Ensure that the session ID is being stored in localStorage

### Quote Submission Failing
- Check that all required customer information is being provided
- Verify that the Orders table is set up correctly
- Check the server logs for any API errors