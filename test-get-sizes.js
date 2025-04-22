// test-get-sizes.js - Script to test retrieving cart item sizes

require('dotenv').config();
const fetch = require('node-fetch');

// API endpoints
const API_BASE_URL = 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api';
const ENDPOINTS = {
  cartItemSizes: {
    getAll: `${API_BASE_URL}/cart-item-sizes`,
    getByCartItem: (cartItemId) => `${API_BASE_URL}/cart-item-sizes?cartItemID=${cartItemId}`
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
async function testGetSizes() {
  try {
    console.log('Starting Get Cart Item Sizes test...');
    
    // Step 1: Get all cart item sizes
    console.log('\n--- Step 1: Get all cart item sizes ---');
    const allSizesResponse = await fetch(ENDPOINTS.cartItemSizes.getAll);
    const allSizes = await logResponse(allSizesResponse, 'All Cart Item Sizes');
    
    // Step 2: Get cart item sizes for a specific cart item
    console.log('\n--- Step 2: Get cart item sizes for cart item 35 ---');
    const cartItemId = 35; // This is the cart item we created sizes for in the previous test
    const sizesResponse = await fetch(ENDPOINTS.cartItemSizes.getByCartItem(cartItemId));
    const sizes = await logResponse(sizesResponse, `Cart Item Sizes for CartItemID ${cartItemId}`);
    
    console.log('\nTest completed.');
    
  } catch (error) {
    console.error('Error during test:', error);
  }
}

// Run the test
testGetSizes().catch(console.error);