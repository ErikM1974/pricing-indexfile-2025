// Node.js script to test API endpoints
const https = require('https');

const baseUrl = 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';

function fetchData(path) {
    return new Promise((resolve, reject) => {
        const url = `${baseUrl}${path}`;
        console.log(`\nTesting: ${url}`);
        
        https.get(url, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    resolve(json);
                } catch (e) {
                    reject(e);
                }
            });
        }).on('error', reject);
    });
}

async function runTests() {
    console.log('=== TESTING ORDER DASHBOARD API ENDPOINTS ===\n');
    
    try {
        // Test 1: Basic (default 7 days)
        console.log('1. BASIC ENDPOINT (7 days default)');
        const basic = await fetchData('/api/order-dashboard');
        console.log('Response structure:', Object.keys(basic));
        if (basic.summary) {
            console.log('Summary fields:', Object.keys(basic.summary));
            console.log('Summary data:', basic.summary);
        }
        if (basic.breakdown) {
            console.log('Breakdown structure:', Object.keys(basic.breakdown));
            if (basic.breakdown.byCsr && basic.breakdown.byCsr[0]) {
                console.log('CSR item structure:', Object.keys(basic.breakdown.byCsr[0]));
                console.log('Sample CSR:', basic.breakdown.byCsr[0]);
            }
            if (basic.breakdown.byOrderType && basic.breakdown.byOrderType[0]) {
                console.log('OrderType structure:', Object.keys(basic.breakdown.byOrderType[0]));
                console.log('Sample OrderType:', basic.breakdown.byOrderType[0]);
            }
        }
        
        // Test 2: Today (1 day)
        console.log('\n\n2. TODAY (1 day)');
        const today = await fetchData('/api/order-dashboard?days=1');
        console.log('Today summary:', today.summary);
        
        // Test 3: 30 days
        console.log('\n\n3. LAST 30 DAYS');
        const month = await fetchData('/api/order-dashboard?days=30');
        console.log('30-day summary:', month.summary);
        
        // Test 4: Year-over-Year
        console.log('\n\n4. YEAR-OVER-YEAR COMPARISON');
        const yoy = await fetchData('/api/order-dashboard?compareYoY=true');
        if (yoy.yearOverYear) {
            console.log('YoY structure:', Object.keys(yoy.yearOverYear));
            console.log('YoY data:', JSON.stringify(yoy.yearOverYear, null, 2));
        }
        
        // Analysis
        console.log('\n\n=== ANALYSIS ===');
        console.log('\nDATA COMPARISON:');
        console.log(`Basic (7d): ${basic.summary.totalOrders} orders, $${basic.summary.totalSales}`);
        console.log(`Today (1d): ${today.summary.totalOrders} orders, $${today.summary.totalSales}`);
        console.log(`Month (30d): ${month.summary.totalOrders} orders, $${month.summary.totalSales}`);
        
        // Check if data is different
        const allSame = basic.summary.totalOrders === today.summary.totalOrders && 
                       today.summary.totalOrders === month.summary.totalOrders;
        
        if (allSame) {
            console.log('\n⚠️ WARNING: All date ranges return the SAME data!');
        } else {
            console.log('\n✅ SUCCESS: Different date ranges return different data');
        }
        
        // Field name confirmation
        console.log('\n\nFIELD NAME CONFIRMATION:');
        console.log('- Uses "totalSales" not "totalRevenue"');
        console.log('- CSR data has fields:', basic.breakdown.byCsr[0] ? Object.keys(basic.breakdown.byCsr[0]) : 'No CSR data');
        console.log('- Order type has fields:', basic.breakdown.byOrderType[0] ? Object.keys(basic.breakdown.byOrderType[0]) : 'No order type data');
        
    } catch (error) {
        console.error('Test failed:', error);
    }
}

runTests();