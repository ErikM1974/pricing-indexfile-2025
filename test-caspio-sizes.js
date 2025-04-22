// test-caspio-sizes.js - Script to test Caspio API cart item sizes endpoint

require('dotenv').config();
const fetch = require('node-fetch');

// API endpoints
const API_BASE_URL = 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api';
const ENDPOINTS = {
  cartItems: {
    getAll: `${API_BASE_URL}/cart-items`,
    getBySession: (sessionId) => `${API_BASE_URL}/cart-items?sessionID=${sessionId}`,
    create: `${API_BASE_URL}/cart-items`,
    update: (id) => `${API_BASE_URL}/cart-items/${id}`,
    delete: (id) => `${API_BASE_URL}/cart-items/${id}`
  },
  cartItemSizes: {
    getAll: `${API_BASE_URL}/cart-item-sizes`,
    getByCartItem: (cartItemId) => `${API_BASE_URL}/cart-item-sizes?cartItemID=${cartItemId}`,
    create: `${API_BASE_URL}/cart-item-sizes`,
    update: (id) => `${API_BASE_URL}/cart-item-sizes/${id}`,
    delete: (id) => `${API_BASE_URL}/cart-item-sizes/${id}`
  }
};

// Helper function to log responses
async function logResponse(response, label) {
  const contentType = response.headers.get('content-type');
  let data;
  
  try {
    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else {
      data = await response.text();
    }
  } catch (error) {
    data = `Error parsing response: ${error.message}`;
  }
  
  console.log(`\n=== ${label} ===`);
  console.log(`Status: ${response.status} ${response.statusText}`);
  console.log('Headers:', Object.fromEntries([...response.headers.entries()]));
  console.log('Body:', data);
  
  return data;
}

// Main test function
async function testCartItemSizes() {
  try {
    console.log('Starting Cart Item Sizes API test...');
    
    // Step 1: Get all cart items to find a valid CartItemID
    console.log('\n--- Step 1: Get all cart items to find a valid CartItemID ---');
    const cartItemsResponse = await fetch(ENDPOINTS.cartItems.getAll);
    const cartItems = await logResponse(cartItemsResponse, 'All Cart Items');
    
    if (!Array.isArray(cartItems) || cartItems.length === 0) {
      console.log('No cart items found. Cannot proceed with test.');
      return;
    }
    
    // Find the most recent cart item
    const cartItem = cartItems.reduce((latest, item) => {
      if (!latest || new Date(item.DateAdded) > new Date(latest.DateAdded)) {
        return item;
      }
      return latest;
    }, null);
    
    console.log(`\nSelected cart item for testing:`, cartItem);
    
    // Step 2: Try to create a cart item size with the real CartItemID
    console.log('\n--- Step 2: Try to create a cart item size with real CartItemID ---');
    const sizeData = {
      CartItemID: cartItem.CartItemID,
      Size: 'L',
      Quantity: 5,
      UnitPrice: 19.99
    };
    
    console.log('Cart item size data:', sizeData);
    
    try {
      const sizeResponse = await fetch(ENDPOINTS.cartItemSizes.create, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(sizeData)
      });
      
      await logResponse(sizeResponse, 'Create Cart Item Size Response');
      
      if (!sizeResponse.ok) {
        console.log('\nTrying to get more detailed error information...');
        
        // Try to get more detailed error information
        const errorResponse = await fetch(`${API_BASE_URL}/error-log`, {
          method: 'GET'
        });
        
        await logResponse(errorResponse, 'Error Log Response');
      }
    } catch (error) {
      console.error('Error creating cart item size:', error);
    }
    
    // Step 3: Try different variations of the size data
    console.log('\n--- Step 3: Try different variations of the size data ---');
    
    const variations = [
      {
        label: 'Variation 1: Different field names',
        data: {
          CartItemID: cartItem.CartItemID,
          SizeValue: 'L',
          Quantity: 5,
          Price: 19.99
        }
      },
      {
        label: 'Variation 2: Additional fields',
        data: {
          CartItemID: cartItem.CartItemID,
          Size: 'L',
          Quantity: 5,
          UnitPrice: 19.99,
          WarehouseSource: 'Main',
          DateAdded: new Date().toISOString()
        }
      },
      {
        label: 'Variation 3: Minimal fields',
        data: {
          CartItemID: cartItem.CartItemID,
          Size: 'L',
          Quantity: 5
        }
      },
      {
        label: 'Variation 4: Using PK_ID instead of CartItemID',
        data: {
          CartItemID: cartItem.PK_ID,
          Size: 'L',
          Quantity: 5,
          UnitPrice: 19.99
        }
      }
    ];
    
    for (const variation of variations) {
      console.log(`\nTrying ${variation.label}`);
      console.log('Data:', variation.data);
      
      try {
        const response = await fetch(ENDPOINTS.cartItemSizes.create, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(variation.data)
        });
        
        await logResponse(response, `Response for ${variation.label}`);
      } catch (error) {
        console.error(`Error with ${variation.label}:`, error);
      }
    }
    
    // Step 4: Check if there's a schema or structure issue
    console.log('\n--- Step 4: Check if there\'s a schema or structure issue ---');
    
    // Try to get the database schema or structure
    try {
      const schemaResponse = await fetch(`${API_BASE_URL}/schema/cart-item-sizes`, {
        method: 'GET'
      });
      
      await logResponse(schemaResponse, 'Schema Response');
    } catch (error) {
      console.log('Schema endpoint not available:', error.message);
    }
    
    // Try to get any documentation
    try {
      const docsResponse = await fetch(`${API_BASE_URL}/docs`, {
        method: 'GET'
      });
      
      await logResponse(docsResponse, 'API Documentation Response');
    } catch (error) {
      console.log('Documentation endpoint not available:', error.message);
    }
    
    console.log('\nAPI test completed.');
    
  } catch (error) {
    console.error('Error during API test:', error);
  }
}

// Run the test
testCartItemSizes().catch(console.error);