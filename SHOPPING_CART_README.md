# Northwest Custom Apparel Shopping Cart

This is a comprehensive shopping cart implementation for Northwest Custom Apparel that integrates with Caspio tables through the API proxy. The shopping cart allows customers to add products with different embellishment types, manage quantities, and submit quote requests.

## Features

- **Session Management**: Maintains cart sessions across page visits
- **Embellishment Types**: Supports multiple embellishment types:
  - Embroidery
  - Cap Embroidery
  - DTG (Direct to Garment)
  - Screen Print
- **Inventory Validation**: Checks inventory before adding items to cart
- **Save for Later**: Allows customers to save their cart for future use
- **Multi-step Checkout**: Three-step checkout process (Cart → Ship → Review)
- **Quote Generation**: Creates quote requests in Caspio

## Files

- **cart.js**: Core shopping cart functionality
- **add-to-cart.js**: Reusable component for adding items to cart
- **cart.html**: Shopping cart page with checkout process
- **cart-styles.css**: Styling for the cart page
- **server.js**: API endpoints for interacting with Caspio tables

## Setup

### Prerequisites

- Node.js and npm installed
- Caspio account with the required tables set up

### Installation

1. Clone the repository
2. Install dependencies:
   ```
   npm install
   ```
3. Create a `.env` file with the following variables:
   ```
   CASPIO_API_BASE_URL=https://c3eku948.caspio.com/rest/v2
   CASPIO_API_KEY=your-caspio-api-key-here
   
   PORT=3000
   ```
4. Start the server:
   ```
   npm start
   ```

## API Endpoints

The shopping cart interacts with the following API endpoints:

### Cart Sessions

- `GET /api/cart-sessions`: Get all cart sessions
- `GET /api/cart-sessions/:id`: Get a specific cart session
- `POST /api/cart-sessions`: Create a new cart session
- `PUT /api/cart-sessions/:id`: Update a cart session
- `DELETE /api/cart-sessions/:id`: Delete a cart session

### Cart Items

- `GET /api/cart-items`: Get all cart items
- `GET /api/cart-items/session/:sessionId`: Get cart items for a specific session
- `POST /api/cart-items`: Create a new cart item
- `PUT /api/cart-items/:id`: Update a cart item
- `DELETE /api/cart-items/:id`: Delete a cart item

### Cart Item Sizes

- `GET /api/cart-item-sizes`: Get all cart item sizes
- `GET /api/cart-item-sizes/cart-item/:cartItemId`: Get sizes for a specific cart item
- `POST /api/cart-item-sizes`: Create a new cart item size
- `PUT /api/cart-item-sizes/:id`: Update a cart item size
- `DELETE /api/cart-item-sizes/:id`: Delete a cart item size

### Customers

- `GET /api/customers`: Get all customers
- `GET /api/customers/email/:email`: Get a customer by email
- `POST /api/customers`: Create a new customer
- `PUT /api/customers/:id`: Update a customer

### Orders

- `GET /api/orders`: Get all orders
- `GET /api/orders/:id`: Get a specific order
- `POST /api/orders`: Create a new order
- `PUT /api/orders/:id`: Update an order

### Inventory

- `GET /api/inventory?styleNumber=:styleNumber&color=:color`: Get inventory for a specific style and color

## Usage

### Adding the "Add to Cart" Button to Product Pages

1. Include the required scripts:
   ```html
   <script src="cart.js"></script>
   <script src="add-to-cart.js"></script>
   ```

2. Add the embellishment type selection:
   ```html
   <div class="embellishment-selection">
     <h3>Select Embellishment Type:</h3>
     <div class="embellishment-options">
       <label><input type="radio" name="embellishment-type" value="embroidery" checked> Embroidery</label>
       <label><input type="radio" name="embellishment-type" value="cap-embroidery"> Cap Embroidery</label>
       <label><input type="radio" name="embellishment-type" value="dtg"> DTG</label>
       <label><input type="radio" name="embellishment-type" value="screen-print"> Screen Print</label>
     </div>
   </div>
   ```

3. Add containers for embellishment options and the "Add to Cart" button:
   ```html
   <div id="embellishment-options-container"></div>
   <div id="add-to-cart-container"></div>
   ```

4. Add size and quantity inputs to your inventory display:
   ```html
   <input type="number" class="qty-input" data-size="S" data-price="15.99" data-warehouse="Seattle, WA" min="0" max="100">
   ```

### Customizing the Shopping Cart

The shopping cart can be customized by modifying the following files:

- **cart-styles.css**: Change the appearance of the cart
- **cart.html**: Modify the structure of the cart page
- **cart.js**: Adjust the behavior of the cart

## Embellishment Options

Each embellishment type has specific options that are stored in the `EmbellishmentOptions` field of the Cart_Items table:

### Embroidery
```json
{
  "stitchCount": 8000,
  "location": "left-chest"
}
```

### Cap Embroidery
```json
{
  "stitchCount": 8000,
  "location": "front"
}
```

### DTG
```json
{
  "location": "FF",
  "colorType": "full-color"
}
```

### Screen Print
```json
{
  "colorCount": 3,
  "additionalLocations": [
    {
      "location": "back",
      "colorCount": 1
    }
  ],
  "requiresWhiteBase": true,
  "specialInk": false
}
```

## Session Synchronization

The cart uses a hybrid approach for session storage:

1. **localStorage**: Stores session ID and cart items for fast access
2. **Caspio Database**: Stores complete cart details for persistence
3. **Synchronization**: Syncs between localStorage and the database when:
   - The cart is initialized
   - Items are added, updated, or removed
   - The user navigates to the cart page

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Commit your changes: `git commit -m 'Add some feature'`
4. Push to the branch: `git push origin feature-name`
5. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.