// test-cart-endpoints.js - Comprehensive test script for cart endpoints and functionality

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
  },
  inventory: {
    getByStyleAndColor: (styleNumber, color) =>
      `${API_BASE_URL}/inventory?styleNumber=${encodeURIComponent(styleNumber)}&color=${encodeURIComponent(color)}`
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

// Test results tracking
const testResults = {
  passed: 0,
  failed: 0,
  tests: []
};

// Helper function to record test results
function recordTest(name, passed, error = null) {
  const result = {
    name,
    passed,
    error: error ? error.message || String(error) : null,
    timestamp: new Date().toISOString()
  };
  
  testResults.tests.push(result);
  
  if (passed) {
    testResults.passed++;
    console.log(`✅ PASSED: ${name}`);
  } else {
    testResults.failed++;
    console.log(`❌ FAILED: ${name} - ${result.error}`);
  }
  
  return result;
}

// Main test function
async function testCartEndpoints() {
  try {
    console.log('Starting comprehensive cart endpoints test...');
    console.log('==============================================');
    
    // Variables to store created IDs for use in subsequent tests
    let sessionId;
    let cartItemId;
    let sizeItemId;
    
    // Test 1: Create a cart session
    try {
      console.log('\n--- Test 1: Create a cart session ---');
      sessionId = 'test_sess_' + Date.now();
      const sessionData = {
        SessionID: sessionId,
        CreateDate: new Date().toISOString(),
        LastActivity: new Date().toISOString(),
        UserAgent: 'Test Script',
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
      
      recordTest('Create Cart Session', sessionResponse.ok, 
        sessionResponse.ok ? null : new Error(`Failed with status ${sessionResponse.status}`));
    } catch (error) {
      recordTest('Create Cart Session', false, error);
    }
    
    // Test 2: Get cart sessions
    try {
      console.log('\n--- Test 2: Get cart sessions ---');
      const sessionsResponse = await fetch(ENDPOINTS.cartSessions.getAll);
      const sessions = await logResponse(sessionsResponse, 'Get All Sessions Response');
      
      recordTest('Get All Cart Sessions', sessionsResponse.ok && Array.isArray(sessions),
        sessionsResponse.ok && Array.isArray(sessions) ? null : new Error('Failed to get sessions or response is not an array'));
    } catch (error) {
      recordTest('Get All Cart Sessions', false, error);
    }
    
    // Test 3: Get cart session by ID
    try {
      console.log('\n--- Test 3: Get cart session by ID ---');
      const sessionResponse = await fetch(ENDPOINTS.cartSessions.getById(sessionId));
      const session = await logResponse(sessionResponse, `Get Session ${sessionId} Response`);
      
      recordTest('Get Cart Session By ID', sessionResponse.ok && Array.isArray(session) && session.length > 0,
        sessionResponse.ok && Array.isArray(session) && session.length > 0 ? null : new Error('Failed to get session or session not found'));
    } catch (error) {
      recordTest('Get Cart Session By ID', false, error);
    }
    
    // Test 4: Create a cart item
    try {
      console.log('\n--- Test 4: Create a cart item ---');
      const cartItemData = {
        SessionID: sessionId,
        ProductID: 'TEST_PRODUCT_' + Date.now(),
        StyleNumber: 'PC61',
        Color: 'Black',
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
      
      recordTest('Create Cart Item', cartItemResponse.ok,
        cartItemResponse.ok ? null : new Error(`Failed with status ${cartItemResponse.status}`));
      
      // Get the cart item ID for subsequent tests
      if (cartItemResponse.ok) {
        // Get the most recently created cart item for this session
        const itemsResponse = await fetch(ENDPOINTS.cartItems.getBySession(sessionId));
        const items = await itemsResponse.json();
        
        if (Array.isArray(items) && items.length > 0) {
          // Sort by DateAdded (most recent first)
          items.sort((a, b) => new Date(b.DateAdded) - new Date(a.DateAdded));
          cartItemId = items[0].CartItemID;
          console.log(`\nUsing cart item ID: ${cartItemId}`);
        }
      }
    } catch (error) {
      recordTest('Create Cart Item', false, error);
    }
    
    // Test 5: Get cart items by session
    try {
      console.log('\n--- Test 5: Get cart items by session ---');
      const itemsResponse = await fetch(ENDPOINTS.cartItems.getBySession(sessionId));
      const items = await logResponse(itemsResponse, `Get Items for Session ${sessionId} Response`);
      
      recordTest('Get Cart Items By Session', itemsResponse.ok && Array.isArray(items) && items.length > 0,
        itemsResponse.ok && Array.isArray(items) && items.length > 0 ? null : new Error('Failed to get items or no items found'));
    } catch (error) {
      recordTest('Get Cart Items By Session', false, error);
    }
    
    // Test 6: Create a cart item size
    try {
      console.log('\n--- Test 6: Create a cart item size ---');
      
      if (!cartItemId) {
        throw new Error('No cart item ID available for testing');
      }
      
      // Ensure cartItemId is a number
      const numericCartItemId = typeof cartItemId === 'string' ? parseInt(cartItemId, 10) : cartItemId;
      
      if (isNaN(numericCartItemId)) {
        throw new Error(`Invalid cart item ID: ${cartItemId}`);
      }
      
      const sizeData = {
        CartItemID: numericCartItemId,
        Size: 'L',
        Quantity: 5,
        UnitPrice: 19.99
      };
      
      console.log('Cart item size data:', sizeData);
      
      const sizeResponse = await fetch(ENDPOINTS.cartItemSizes.create, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(sizeData)
      });
      
      const sizeResult = await logResponse(sizeResponse, 'Create Cart Item Size Response');
      
      recordTest('Create Cart Item Size', sizeResponse.ok,
        sizeResponse.ok ? null : new Error(`Failed with status ${sizeResponse.status}`));
      
      // If successful, try to get the size item ID
      if (sizeResponse.ok) {
        const sizesResponse = await fetch(ENDPOINTS.cartItemSizes.getByCartItem(numericCartItemId));
        const sizes = await sizesResponse.json();
        
        if (Array.isArray(sizes) && sizes.length > 0) {
          sizeItemId = sizes[0].SizeItemID;
          console.log(`\nUsing size item ID: ${sizeItemId}`);
        }
      }
    } catch (error) {
      recordTest('Create Cart Item Size', false, error);
    }
    
    // Test 7: Get cart item sizes by cart item
    try {
      console.log('\n--- Test 7: Get cart item sizes by cart item ---');
      
      if (!cartItemId) {
        throw new Error('No cart item ID available for testing');
      }
      
      // Ensure cartItemId is a number
      const numericCartItemId = typeof cartItemId === 'string' ? parseInt(cartItemId, 10) : cartItemId;
      
      const sizesResponse = await fetch(ENDPOINTS.cartItemSizes.getByCartItem(numericCartItemId));
      const sizes = await logResponse(sizesResponse, `Get Sizes for Cart Item ${numericCartItemId} Response`);
      
      recordTest('Get Cart Item Sizes By Cart Item', sizesResponse.ok && Array.isArray(sizes) && sizes.length > 0,
        sizesResponse.ok && Array.isArray(sizes) && sizes.length > 0 ? null : new Error('Failed to get sizes or no sizes found'));
    } catch (error) {
      recordTest('Get Cart Item Sizes By Cart Item', false, error);
    }
    
    // Test 8: Update a cart item size
    try {
      console.log('\n--- Test 8: Update a cart item size ---');
      
      if (!sizeItemId) {
        throw new Error('No size item ID available for testing');
      }
      
      // Ensure cartItemId is a number
      const numericCartItemId = typeof cartItemId === 'string' ? parseInt(cartItemId, 10) : cartItemId;
      
      const updateData = {
        CartItemID: numericCartItemId,
        Size: 'L',
        Quantity: 10, // Updated quantity
        UnitPrice: 19.99
      };
      
      console.log('Update size data:', updateData);
      
      const updateResponse = await fetch(ENDPOINTS.cartItemSizes.update(sizeItemId), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updateData)
      });
      
      const updateResult = await logResponse(updateResponse, 'Update Cart Item Size Response');
      
      recordTest('Update Cart Item Size', updateResponse.ok,
        updateResponse.ok ? null : new Error(`Failed with status ${updateResponse.status}`));
    } catch (error) {
      recordTest('Update Cart Item Size', false, error);
    }
    
    // Test 9: Check inventory
    try {
      console.log('\n--- Test 9: Check inventory ---');
      const inventoryResponse = await fetch(ENDPOINTS.inventory.getByStyleAndColor('PC61', 'Black'));
      const inventory = await logResponse(inventoryResponse, 'Get Inventory Response');
      
      recordTest('Check Inventory', inventoryResponse.ok && Array.isArray(inventory),
        inventoryResponse.ok && Array.isArray(inventory) ? null : new Error('Failed to get inventory or response is not an array'));
    } catch (error) {
      recordTest('Check Inventory', false, error);
    }
    
    // Test 10: Delete a cart item size
    try {
      console.log('\n--- Test 10: Delete a cart item size ---');
      
      if (!sizeItemId) {
        throw new Error('No size item ID available for testing');
      }
      
      const deleteResponse = await fetch(ENDPOINTS.cartItemSizes.delete(sizeItemId), {
        method: 'DELETE'
      });
      
      const deleteResult = await logResponse(deleteResponse, 'Delete Cart Item Size Response');
      
      recordTest('Delete Cart Item Size', deleteResponse.ok,
        deleteResponse.ok ? null : new Error(`Failed with status ${deleteResponse.status}`));
    } catch (error) {
      recordTest('Delete Cart Item Size', false, error);
    }
    
    // Test 11: Delete a cart item
    try {
      console.log('\n--- Test 11: Delete a cart item ---');
      
      if (!cartItemId) {
        throw new Error('No cart item ID available for testing');
      }
      
      const deleteResponse = await fetch(ENDPOINTS.cartItems.delete(cartItemId), {
        method: 'DELETE'
      });
      
      const deleteResult = await logResponse(deleteResponse, 'Delete Cart Item Response');
      
      recordTest('Delete Cart Item', deleteResponse.ok,
        deleteResponse.ok ? null : new Error(`Failed with status ${deleteResponse.status}`));
    } catch (error) {
      recordTest('Delete Cart Item', false, error);
    }
    
    // Test 12: Delete a cart session
    try {
      console.log('\n--- Test 12: Delete a cart session ---');
      
      if (!sessionId) {
        throw new Error('No session ID available for testing');
      }
      
      const deleteResponse = await fetch(ENDPOINTS.cartSessions.delete(sessionId), {
        method: 'DELETE'
      });
      
      const deleteResult = await logResponse(deleteResponse, 'Delete Cart Session Response');
      
      recordTest('Delete Cart Session', deleteResponse.ok,
        deleteResponse.ok ? null : new Error(`Failed with status ${deleteResponse.status}`));
    } catch (error) {
      recordTest('Delete Cart Session', false, error);
    }
    
    // Print test summary
    console.log('\n==============================================');
    console.log('TEST SUMMARY');
    console.log('==============================================');
    console.log(`Total Tests: ${testResults.passed + testResults.failed}`);
    console.log(`Passed: ${testResults.passed}`);
    console.log(`Failed: ${testResults.failed}`);
    console.log('==============================================');
    
    if (testResults.failed > 0) {
      console.log('\nFailed Tests:');
      testResults.tests.filter(test => !test.passed).forEach(test => {
        console.log(`- ${test.name}: ${test.error}`);
      });
    }
    
    console.log('\nTest completed.');
    
  } catch (error) {
    console.error('Error during test:', error);
  }
}

// Run the test
testCartEndpoints().catch(console.error);