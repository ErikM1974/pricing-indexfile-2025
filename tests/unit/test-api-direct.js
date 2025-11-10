// Direct API test to submit a Christmas bundle order
// Run this with: node test-api-direct.js

const https = require('https');

async function makeRequest(options, data) {
    return new Promise((resolve, reject) => {
        const req = https.request(options, (res) => {
            let responseData = '';
            res.on('data', (chunk) => responseData += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(responseData));
                } catch (e) {
                    resolve(responseData);
                }
            });
        });
        req.on('error', reject);
        if (data) req.write(JSON.stringify(data));
        req.end();
    });
}

async function testSubmitOrder() {
    console.log('=== DIRECT API TEST ===');

    // Generate unique quote ID
    const date = new Date();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const random = Math.floor(Math.random() * 1000);
    const quoteID = `XMAS${month}${day}-${random}`;

    console.log('Creating test order:', quoteID);

    // Step 1: Create session
    const sessionID = `test_sess_${Date.now()}_${random}`;
    const sessionData = {
        QuoteID: quoteID,
        SessionID: sessionID,
        CustomerName: 'API Test User',
        CustomerEmail: 'apitest@example.com',
        CompanyName: 'Test Company',
        Phone: '2531234567',
        TotalQuantity: 4,
        SubtotalAmount: 200,
        TotalAmount: 200,
        Status: 'Sample Request',
        Notes: 'API Test Order'
    };

    const sessionOptions = {
        hostname: 'caspio-pricing-proxy-ab30a049961a.herokuapp.com',
        path: '/api/quote_sessions',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        }
    };

    const sessionResult = await makeRequest(sessionOptions, sessionData);
    console.log('Session response:', JSON.stringify(sessionResult));
    console.log('Session created:', sessionResult.PK_ID ? 'Success' : 'Failed');

    // Step 2: Create item
    const itemData = {
        QuoteID: quoteID,
        LineNumber: 1,
        StyleNumber: 'XMAS-BUNDLE',
        ProductName: 'Christmas Gift Box Bundle',
        Quantity: 4,
        FinalUnitPrice: 50,
        LineTotal: 200,
        Company: 'Test Company',
        First: 'API',
        Last: 'Test',
        Email: 'apitest@example.com',
        Phone: '2531234567',

        // Test shipping data
        DeliveryMethod: 'Ship',
        Shipping_Address: '789 Test API Street',
        Shipping_City: 'Seattle',
        Shipping_State: 'WA',
        Shipping_Zip: '98101',  // THIS SHOULD SAVE

        // Test other fields
        DeliveryDate: '2025-02-14',  // THIS SHOULD SAVE
        RushOrder: true,
        Thread_Colors: 'Red, Blue, Green',
        Notes: 'API Test Special Instructions',

        // Bundle configuration with gloves color
        BundleConfiguration: JSON.stringify({
            jacket: 'CT104670 - XL - Black',
            hoodie: 'F281 - XL - Red',
            beanie: 'CT104597 - Navy',
            gloves: 'CTGD0794 - L - Black Barley'  // WITH COLOR
        })
    };

    const itemOptions = {
        hostname: 'caspio-pricing-proxy-ab30a049961a.herokuapp.com',
        path: '/api/quote_items',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        }
    };

    const itemResult = await makeRequest(itemOptions, itemData);
    console.log('Item response:', JSON.stringify(itemResult));
    console.log('Item created:', itemResult.PK_ID ? 'Success' : 'Failed');

    // Step 3: Verify what was saved
    console.log('\n=== VERIFYING SAVED DATA ===');

    const checkOptions = {
        hostname: 'caspio-pricing-proxy-ab30a049961a.herokuapp.com',
        path: `/api/quote_items?quoteID=${encodeURIComponent(quoteID)}`,
        method: 'GET'
    };

    const savedItems = await makeRequest(checkOptions, null);

    if (savedItems && savedItems[0]) {
        const item = savedItems[0];
        console.log('\nChecking critical fields:');
        console.log('✓ Shipping_Zip:', item.Shipping_Zip || '❌ MISSING');
        console.log('✓ DeliveryDate:', item.DeliveryDate || '❌ MISSING');
        console.log('✓ DeliveryMethod:', item.DeliveryMethod || '❌ MISSING');
        console.log('✓ BundleConfiguration:', item.BundleConfiguration ? 'Saved' : '❌ MISSING');

        if (item.BundleConfiguration) {
            const bundle = JSON.parse(item.BundleConfiguration);
            console.log('  - Gloves:', bundle.gloves || '❌ MISSING');
        }
    }

    console.log('\n=== TEST COMPLETE ===');
    console.log('Check dashboard for:', quoteID);

    return quoteID;
}

// Run the test
testSubmitOrder().catch(console.error);