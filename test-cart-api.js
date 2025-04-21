// test-cart-api.js - Script to test the cart API endpoints

// API Base URL
const API_BASE_URL = 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api';

// Test functions
async function testCreateSession() {
    console.log('Testing create session...');
    
    try {
        // Generate a unique session ID
        const generatedSessionId = 'sess_' + Math.random().toString(36).substring(2, 10);
        
        // Create a new session
        const response = await fetch(`${API_BASE_URL}/cart-sessions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                SessionID: generatedSessionId,
                CreateDate: new Date().toISOString(),
                LastActivity: new Date().toISOString(),
                UserAgent: 'Test Script',
                IPAddress: '',
                IsActive: true
            })
        });
        
        if (!response.ok) {
            throw new Error(`API Error: ${response.status} ${response.statusText}`);
        }
        
        const responseData = await response.json();
        console.log('Session created successfully:', responseData);
        console.log('Generated Session ID:', generatedSessionId);
        
        return generatedSessionId;
    } catch (error) {
        console.error('Error creating session:', error);
        return null;
    }
}

async function testGetSession(sessionId) {
    console.log(`Testing get session for ID: ${sessionId}...`);
    
    try {
        // Get session from server
        const response = await fetch(`${API_BASE_URL}/cart-sessions?sessionID=${sessionId}`);
        
        if (!response.ok) {
            throw new Error(`API Error: ${response.status} ${response.statusText}`);
        }
        
        const sessions = await response.json();
        console.log('Sessions retrieved:', sessions);
        
        return sessions;
    } catch (error) {
        console.error('Error getting session:', error);
        return null;
    }
}

async function testAddCartItem(sessionId) {
    console.log(`Testing add cart item for session ID: ${sessionId}...`);
    
    try {
        // Create test item data
        const testItem = {
            ProductID: 'PROD123', // Added ProductID field
            StyleNumber: 'TEST123',
            Color: 'Test Color',
            ImprintType: 'embroidery',
            CartStatus: 'Active',
            SessionID: sessionId,
            DateAdded: new Date().toISOString(),
            EmbellishmentOptions: JSON.stringify({ stitchCount: 8000, location: 'left-chest' })
        };
        
        console.log('Sending cart item data:', testItem);
        
        // Add to server
        const response = await fetch(`${API_BASE_URL}/cart-items`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(testItem)
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('Server response:', errorText);
            throw new Error(`API Error: ${response.status} ${response.statusText}`);
        }
        
        const newItem = await response.json();
        console.log('Cart item added successfully:', newItem);
        
        // Since the API doesn't return the cart item ID, we need to fetch it
        if (!newItem.cartItem || !newItem.cartItem.CartItemID) {
            console.log('Cart item created, but no ID returned. Fetching cart items to get ID...');
            
            // Get the cart items for this session
            const itemsResponse = await fetch(`${API_BASE_URL}/cart-items?sessionID=${sessionId}`);
            
            if (!itemsResponse.ok) {
                throw new Error(`API Error fetching items: ${itemsResponse.status} ${itemsResponse.statusText}`);
            }
            
            const items = await itemsResponse.json();
            console.log('Retrieved cart items:', items);
            
            if (items && items.length > 0) {
                // Use the most recently added item (should be the one we just created)
                const latestItem = items[items.length - 1];
                console.log('Using latest cart item:', latestItem);
                return latestItem;
            } else {
                throw new Error('No cart items found after creating item');
            }
        }
        
        return newItem.cartItem;
    } catch (error) {
        console.error('Error adding cart item:', error);
        return null;
    }
}

async function testAddCartItemSize(cartItemId) {
    console.log(`Testing add cart item size for cart item ID: ${cartItemId}...`);
    
    try {
        // Add test size
        const testSize = {
            CartItemID: cartItemId,
            Size: 'L',
            Quantity: 10,
            UnitPrice: 15.99
        };
        
        const response = await fetch(`${API_BASE_URL}/cart-item-sizes`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(testSize)
        });
        
        if (!response.ok) {
            throw new Error(`API Error: ${response.status} ${response.statusText}`);
        }
        
        const newSize = await response.json();
        console.log('Cart item size added successfully:', newSize);
        
        return newSize;
    } catch (error) {
        console.error('Error adding cart item size:', error);
        return null;
    }
}

async function testGetCartItems(sessionId) {
    console.log(`Testing get cart items for session ID: ${sessionId}...`);
    
    try {
        // Get items from server
        const response = await fetch(`${API_BASE_URL}/cart-items?sessionID=${sessionId}`);
        
        if (!response.ok) {
            throw new Error(`API Error: ${response.status} ${response.statusText}`);
        }
        
        const items = await response.json();
        console.log('Cart items retrieved:', items);
        
        return items;
    } catch (error) {
        console.error('Error getting cart items:', error);
        return null;
    }
}

async function testGetCartItemSizes(cartItemId) {
    console.log(`Testing get cart item sizes for cart item ID: ${cartItemId}...`);
    
    try {
        // Get sizes from server
        const response = await fetch(`${API_BASE_URL}/cart-item-sizes?cartItemID=${cartItemId}`);
        
        if (!response.ok) {
            throw new Error(`API Error: ${response.status} ${response.statusText}`);
        }
        
        const sizes = await response.json();
        console.log('Cart item sizes retrieved:', sizes);
        
        return sizes;
    } catch (error) {
        console.error('Error getting cart item sizes:', error);
        return null;
    }
}

// Run tests
async function runTests() {
    console.log('Starting cart API tests...');
    
    // Test create session
    const sessionId = await testCreateSession();
    if (!sessionId) {
        console.error('Failed to create session, aborting tests.');
        return;
    }
    
    // Test get session
    const sessions = await testGetSession(sessionId);
    if (!sessions || sessions.length === 0) {
        console.error('Failed to get session, aborting tests.');
        return;
    }
    
    // Test add cart item
    const cartItem = await testAddCartItem(sessionId);
    if (!cartItem) {
        console.error('Failed to add cart item, aborting tests.');
        return;
    }
    
    // Test add cart item size
    const cartItemSize = await testAddCartItemSize(cartItem.CartItemID);
    if (!cartItemSize) {
        console.error('Failed to add cart item size, aborting tests.');
        return;
    }
    
    // Test get cart items
    const cartItems = await testGetCartItems(sessionId);
    if (!cartItems) {
        console.error('Failed to get cart items, aborting tests.');
        return;
    }
    
    // Test get cart item sizes
    const cartItemSizes = await testGetCartItemSizes(cartItem.CartItemID);
    if (!cartItemSizes) {
        console.error('Failed to get cart item sizes, aborting tests.');
        return;
    }
    
    console.log('All tests completed successfully!');
}

// Run the tests
runTests().catch(error => {
    console.error('Error running tests:', error);
});