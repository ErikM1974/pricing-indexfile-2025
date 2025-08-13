// Complete Quote API Test Suite
// Tests all endpoints: Sessions, Items, and Analytics
// For Northwest Custom Apparel - June 2025

const API_BASE = 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api';

// Helper function to generate unique IDs
const generateId = (prefix) => `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;

// Helper function to make API requests
async function makeRequest(endpoint, method = 'GET', body = null) {
    const options = {
        method,
        headers: {
            'Content-Type': 'application/json'
        }
    };
    
    if (body && (method === 'POST' || method === 'PUT')) {
        options.body = JSON.stringify(body);
    }
    
    try {
        const response = await fetch(`${API_BASE}${endpoint}`, options);
        const data = await response.json();
        
        return {
            status: response.status,
            ok: response.ok,
            data: data
        };
    } catch (error) {
        return {
            status: 0,
            ok: false,
            error: error.message
        };
    }
}

// Test data
let testQuoteId = generateId('Q');
let testSessionId = generateId('sess');
let createdSessionPkId = null;
let createdItemPkId = null;
let createdAnalyticsPkId = null;

// Main test function
async function runAllTests() {
    console.log('🚀 Starting Complete Quote API Tests');
    console.log('=====================================\n');
    
    console.log(`Test Quote ID: ${testQuoteId}`);
    console.log(`Test Session ID: ${testSessionId}\n`);
    
    // Test 1: Create Quote Session
    console.log('📋 TEST 1: CREATE QUOTE SESSION');
    console.log('--------------------------------');
    
    const sessionData = {
        QuoteID: testQuoteId,
        SessionID: testSessionId,
        Status: 'Active',
        CustomerEmail: 'api-test@capembroidery.com',
        CustomerName: 'API Test User',
        CompanyName: 'Cap Embroidery Test Co',
        Phone: '555-0123',
        TotalQuantity: 48,
        SubtotalAmount: 479.52,
        LTMFeeTotal: 0,
        TotalAmount: 479.52,
        ExpiresAt: new Date(Date.now() + 30*24*60*60*1000).toISOString(),
        Notes: JSON.stringify({
            embellishmentType: 'cap-embroidery',
            testRun: true,
            timestamp: new Date().toISOString()
        })
    };
    
    const createSessionResult = await makeRequest('/quote_sessions', 'POST', sessionData);
    console.log('Create Session Result:', createSessionResult);
    
    if (createSessionResult.ok && createSessionResult.data) {
        createdSessionPkId = createSessionResult.data.PK_ID || createSessionResult.data.id;
        console.log(`✅ Session created with PK_ID: ${createdSessionPkId}`);
    } else {
        console.log('❌ Failed to create session');
    }
    console.log('\n');
    
    // Test 2: Get Quote Session
    console.log('📋 TEST 2: GET QUOTE SESSION');
    console.log('----------------------------');
    
    const getSessionResult = await makeRequest(`/quote_sessions?quoteID=${testQuoteId}`);
    console.log('Get Session Result:', getSessionResult);
    console.log('\n');
    
    // Test 3: Create Quote Item
    console.log('📦 TEST 3: CREATE QUOTE ITEM');
    console.log('----------------------------');
    
    // Store cap-specific data in SizeBreakdown field
    const extendedData = {
        sizes: { "OS": 48 },
        capDetails: {
            stitchCount: '10000',
            hasBackLogo: true,
            backLogoStitchCount: 5000,
            backLogoPrice: 5.00
        }
    };

    const itemData = {
        QuoteID: testQuoteId,
        LineNumber: 1,
        StyleNumber: 'RICH-112',
        ProductName: 'Richardson 112 Trucker Cap',
        Color: 'Black/White',
        ColorCode: 'BLK_WHT',
        EmbellishmentType: 'cap-embroidery',
        PrintLocation: 'CAP_FRONT_BACK',  // Indicates back logo
        PrintLocationName: 'Cap Front & Back',
        Quantity: 48,
        HasLTM: 'No',
        BaseUnitPrice: 9.99,
        LTMPerUnit: 0,
        FinalUnitPrice: 14.99,  // Including back logo price
        LineTotal: 719.52,
        SizeBreakdown: JSON.stringify(extendedData),  // Contains both sizes and cap details
        PricingTier: '48-71',
        ImageURL: 'https://example.com/rich112.jpg',
        AddedAt: new Date().toISOString()
    };
    
    const createItemResult = await makeRequest('/quote_items', 'POST', itemData);
    console.log('Create Item Result:', createItemResult);
    
    if (createItemResult.status === 201 || createItemResult.ok) {
        // Try to get the created item
        const getItemsResult = await makeRequest(`/quote_items?quoteID=${testQuoteId}`);
        if (getItemsResult.ok && getItemsResult.data && getItemsResult.data.length > 0) {
            createdItemPkId = getItemsResult.data[0].PK_ID;
            console.log(`✅ Item created with PK_ID: ${createdItemPkId}`);
        }
    } else {
        console.log('❌ Failed to create item');
    }
    console.log('\n');
    
    // Test 4: Get Quote Items
    console.log('📦 TEST 4: GET QUOTE ITEMS');
    console.log('--------------------------');
    
    const getItemsResult = await makeRequest(`/quote_items?quoteID=${testQuoteId}`);
    console.log('Get Items Result:', getItemsResult);
    console.log('\n');
    
    // Test 5: Create Analytics Event
    console.log('📊 TEST 5: CREATE ANALYTICS EVENT');
    console.log('---------------------------------');
    
    const analyticsData = {
        SessionID: testSessionId,
        EventType: 'quote_created',
        QuoteID: testQuoteId,
        StyleNumber: 'RICH-112',
        Color: 'Black/White',
        PrintLocation: 'CAP_FRONT',
        Quantity: 48,
        HasLTM: 'No',
        PriceShown: 9.99,
        UserAgent: 'Quote API Test Script',
        IPAddress: '127.0.0.1',
        Timestamp: new Date().toISOString()
    };
    
    const createAnalyticsResult = await makeRequest('/quote_analytics', 'POST', analyticsData);
    console.log('Create Analytics Result:', createAnalyticsResult);
    
    if (createAnalyticsResult.ok && createAnalyticsResult.data) {
        createdAnalyticsPkId = createAnalyticsResult.data.PK_ID || createAnalyticsResult.data.id;
        console.log(`✅ Analytics event created with PK_ID: ${createdAnalyticsPkId}`);
    } else {
        console.log('❌ Failed to create analytics event');
    }
    console.log('\n');
    
    // Test 6: Get Analytics Events
    console.log('📊 TEST 6: GET ANALYTICS EVENTS');
    console.log('-------------------------------');
    
    const getAnalyticsResult = await makeRequest(`/quote_analytics?sessionID=${testSessionId}`);
    console.log('Get Analytics Result:', getAnalyticsResult);
    console.log('\n');
    
    // Test 7: Update Quote Session
    console.log('📋 TEST 7: UPDATE QUOTE SESSION');
    console.log('-------------------------------');
    
    if (createdSessionPkId) {
        const updateData = {
            Status: 'Completed',
            TotalQuantity: 48,
            TotalAmount: 959.52,
            UpdatedAt: new Date().toISOString(),
            Notes: JSON.stringify({
                embellishmentType: 'cap-embroidery',
                testRun: true,
                updated: true,
                backLogoAdded: true
            })
        };
        
        const updateResult = await makeRequest(`/quote_sessions/${createdSessionPkId}`, 'PUT', updateData);
        console.log('Update Session Result:', updateResult);
    } else {
        console.log('⚠️  No session to update');
    }
    console.log('\n');
    
    // Test 8: Add another analytics event
    console.log('📊 TEST 8: ADD ANOTHER ANALYTICS EVENT');
    console.log('--------------------------------------');
    
    const analyticsData2 = {
        SessionID: testSessionId,
        EventType: 'back_logo_added',
        QuoteID: testQuoteId,
        StyleNumber: 'RICH-112',
        Color: 'Black/White',
        PrintLocation: 'CAP_BACK',
        Quantity: 48,
        HasLTM: 'No',
        PriceShown: 5.00,
        UserAgent: 'Quote API Test Script',
        IPAddress: '127.0.0.1',
        Timestamp: new Date().toISOString()
    };
    
    const createAnalytics2Result = await makeRequest('/quote_analytics', 'POST', analyticsData2);
    console.log('Create Analytics 2 Result:', createAnalytics2Result);
    console.log('\n');
    
    // Summary
    console.log('📈 TEST SUMMARY');
    console.log('===============');
    console.log(`Quote ID: ${testQuoteId}`);
    console.log(`Session ID: ${testSessionId}`);
    console.log(`Session PK_ID: ${createdSessionPkId || 'Not created'}`);
    console.log(`Item PK_ID: ${createdItemPkId || 'Not created'}`);
    console.log(`Analytics PK_ID: ${createdAnalyticsPkId || 'Not created'}`);
    console.log('\n');
    
    console.log('✅ All tests completed!');
    console.log('\nYou can now check the following endpoints:');
    console.log(`1. Quote Sessions: ${API_BASE}/quote_sessions`);
    console.log(`2. Quote Items: ${API_BASE}/quote_items`);
    console.log(`3. Quote Analytics: ${API_BASE}/quote_analytics`);
    console.log('\nOr filter by this test:');
    console.log(`- Sessions by Quote ID: ${API_BASE}/quote_sessions?quoteID=${testQuoteId}`);
    console.log(`- Items by Quote ID: ${API_BASE}/quote_items?quoteID=${testQuoteId}`);
    console.log(`- Analytics by Session: ${API_BASE}/quote_analytics?sessionID=${testSessionId}`);
}

// Run all tests
runAllTests().catch(error => {
    console.error('Test suite error:', error);
});