// test-caspio-api.js - Script to test Caspio API endpoints for cart functionality

require('dotenv').config();
const fetch = require('node-fetch');

// API endpoints
const API_BASE_URL = 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api';
const ENDPOINTS = {
  cartSessions: {
    getAll: `${API_BASE_URL}/cart-sessions`,
    getById: (id) => `${API_BASE_URL}/cart-sessions?sessionID=${id}`,
    create: `${API_BASE_URL}/cart-sessions`,
    update: (id) => `${API_BASE_URL}/cart-sessions/${id}`,
    delete: (id) => `${API_BASE_URL}/cart-sessions/${id}`
  },
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
async function testCaspioAPI() {
  try {
    console.log('Starting Caspio API test...');
    
    // Step 1: Create a cart session
    console.log('\n--- Step 1: Create a cart session ---');
    const sessionId = 'test_sess_' + Date.now();
    const sessionData = {
      SessionID: sessionId,
      CreateDate: new Date().toISOString(),
      LastActivity: new Date().toISOString(),
      UserAgent: 'API Test Script',
      IPAddress: '127.0.0.1',
      IsActive: true
    };
    
    console.log('Session data:', sessionData);
    
    const sessionResponse = await fetch(ENDPOINTS.cartSessions.create, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(sessionData)
    });
    
    const sessionResult = await logResponse(sessionResponse, 'Create Session Response');
    
    if (!sessionResponse.ok) {
      throw new Error(`Failed to create session: ${sessionResponse.status} ${sessionResponse.statusText}`);
    }
    
    // Step 2: Create a cart item
    console.log('\n--- Step 2: Create a cart item ---');
    const cartItemData = {
      SessionID: sessionId,
      ProductID: 'TEST_PRODUCT_' + Date.now(),
      StyleNumber: 'TEST123',
      Color: 'Test Color',
      ImprintType: 'embroidery',
      EmbellishmentOptions: JSON.stringify({
        stitchCount: 8000,
        location: 'left-chest'
      }),
      DateAdded: new Date().toISOString(),
      CartStatus: 'Active'
    };
    
    console.log('Cart item data:', cartItemData);
    
    const cartItemResponse = await fetch(ENDPOINTS.cartItems.create, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(cartItemData)
    });
    
    const cartItemResult = await logResponse(cartItemResponse, 'Create Cart Item Response');
    
    if (!cartItemResponse.ok) {
      throw new Error(`Failed to create cart item: ${cartItemResponse.status} ${cartItemResponse.statusText}`);
    }
    
    // Extract CartItemID from the response
    let cartItemId;
    
    if (cartItemResult.cartItem && cartItemResult.cartItem.CartItemID) {
      cartItemId = cartItemResult.cartItem.CartItemID;
    } else if (cartItemResult.CartItemID) {
      cartItemId = cartItemResult.CartItemID;
    } else if (cartItemResult.message && typeof cartItemResult.message === 'string') {
      const idMatch = cartItemResult.message.match(/ID:?\s*(\d+)/i);
      if (idMatch && idMatch[1]) {
        cartItemId = parseInt(idMatch[1], 10);
      }
    }
    
    if (!cartItemId) {
      // Generate a test ID for continuing the test
      cartItemId = 'TEST_ITEM_' + Date.now();
      console.log(`\nWarning: Could not extract CartItemID from response. Using generated ID: ${cartItemId}`);
    } else {
      console.log(`\nExtracted CartItemID: ${cartItemId}`);
    }
    
    // Step 3: Create a cart item size
    console.log('\n--- Step 3: Create a cart item size ---');
    
    // First, let's check the structure of existing cart item sizes
    console.log('\nChecking existing cart item sizes structure...');
    const existingSizesResponse = await fetch(ENDPOINTS.cartItemSizes.getAll);
    const existingSizes = await logResponse(existingSizesResponse, 'Existing Cart Item Sizes');
    
    // Analyze the structure of existing sizes
    let sizeStructure = 'Unknown';
    if (Array.isArray(existingSizes) && existingSizes.length > 0) {
      const sampleSize = existingSizes[0];
      sizeStructure = JSON.stringify(sampleSize, null, 2);
      console.log('\nSample size structure:', sizeStructure);
    }
    
    // Now create a new size
    const sizeData = {
      CartItemID: cartItemId,
      Size: 'L',
      Quantity: 5,
      UnitPrice: 19.99
    };
    
    console.log('\nCart item size data:', sizeData);
    
    const sizeResponse = await fetch(ENDPOINTS.cartItemSizes.create, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(sizeData)
    });
    
    await logResponse(sizeResponse, 'Create Cart Item Size Response');
    
    if (!sizeResponse.ok) {
      console.log('\nTrying alternative size data formats...');
      
      // Try with different field names based on Caspio's naming conventions
      const alternativeSizeData1 = {
        CartItemID: cartItemId,
        SizeValue: 'L',
        Quantity: 5,
        Price: 19.99
      };
      
      console.log('\nAlternative size data 1:', alternativeSizeData1);
      
      const sizeResponse1 = await fetch(ENDPOINTS.cartItemSizes.create, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(alternativeSizeData1)
      });
      
      await logResponse(sizeResponse1, 'Create Cart Item Size Response (Alternative 1)');
      
      // Try with different field names based on Caspio's naming conventions
      const alternativeSizeData2 = {
        CartItemID: cartItemId,
        Size: 'L',
        Qty: 5,
        UnitPrice: 19.99
      };
      
      console.log('\nAlternative size data 2:', alternativeSizeData2);
      
      const sizeResponse2 = await fetch(ENDPOINTS.cartItemSizes.create, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(alternativeSizeData2)
      });
      
      await logResponse(sizeResponse2, 'Create Cart Item Size Response (Alternative 2)');
    }
    
    // Step 4: Check Caspio table structure
    console.log('\n--- Step 4: Checking Caspio table structure ---');
    
    // Get all cart sessions
    const allSessionsResponse = await fetch(ENDPOINTS.cartSessions.getAll);
    await logResponse(allSessionsResponse, 'All Cart Sessions');
    
    // Get all cart items
    const allItemsResponse = await fetch(ENDPOINTS.cartItems.getAll);
    await logResponse(allItemsResponse, 'All Cart Items');
    
    // Get all cart item sizes
    const allSizesResponse = await fetch(ENDPOINTS.cartItemSizes.getAll);
    await logResponse(allSizesResponse, 'All Cart Item Sizes');
    
    console.log('\nAPI test completed.');
    
  } catch (error) {
    console.error('Error during API test:', error);
  }
}

// Run the test
testCaspioAPI().catch(console.error);