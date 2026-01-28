/**
 * CRM Gap Analysis Script
 * Analyzes discrepancy between Team Performance and CRM dashboards
 *
 * Run: node tests/diagnostics/analyze-gap.js
 */

const https = require('https');
require('dotenv').config();

const API_BASE = 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api';
const CRM_API_SECRET = process.env.CRM_API_SECRET;

// Expected values from screenshots
const EXPECTED = {
    nika: {
        teamPerformance: 152610,
        crmTotal: 147197,
        expectedGap: 5413
    },
    taneisha: {
        teamPerformance: 91207,
        crmTotal: 89112,
        expectedGap: 2095
    }
};

function fetch(url, headers = {}) {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url);
        const options = {
            hostname: urlObj.hostname,
            path: urlObj.pathname + urlObj.search,
            method: 'GET',
            headers: headers
        };

        https.get(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    reject(new Error(`Failed to parse JSON: ${e.message}\nResponse: ${data.substring(0, 200)}`));
                }
            });
        }).on('error', reject);
    });
}

function formatCurrency(amount) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(amount);
}

async function fetchCrmAccounts(endpoint) {
    if (!CRM_API_SECRET) {
        throw new Error('CRM_API_SECRET not found in environment. Make sure .env file exists.');
    }

    const url = `${API_BASE}/${endpoint}`;
    const data = await fetch(url, {
        'X-CRM-API-Secret': CRM_API_SECRET
    });

    return data.accounts || data.Result || data || [];
}

async function analyzeManageOrders() {
    console.log('='.repeat(70));
    console.log('CRM GAP ANALYSIS - Full Investigation');
    console.log('='.repeat(70));
    console.log();

    const today = new Date();
    const year = today.getFullYear();
    const startDate = `${year}-01-01`;
    const endDate = today.toISOString().split('T')[0];

    console.log(`Date range: ${startDate} to ${endDate}`);
    console.log();

    // Fetch ManageOrders data
    console.log('Fetching ManageOrders data...');
    const ordersUrl = `${API_BASE}/manageorders/orders?date_Invoiced_start=${startDate}&date_Invoiced_end=${endDate}`;
    const ordersData = await fetch(ordersUrl);
    const orders = ordersData.result || [];
    console.log(`Total orders fetched: ${orders.length}`);

    // Fetch CRM accounts for both reps
    console.log('Fetching Nika CRM accounts...');
    const nikaAccounts = await fetchCrmAccounts('nika-accounts');
    console.log(`Nika CRM accounts: ${nikaAccounts.length}`);

    console.log('Fetching Taneisha CRM accounts...');
    const taneishaAccounts = await fetchCrmAccounts('taneisha-accounts');
    console.log(`Taneisha CRM accounts: ${taneishaAccounts.length}`);

    console.log();

    // Analyze each rep
    await analyzeRep('Nika Lao', orders, nikaAccounts, EXPECTED.nika);
    console.log();
    await analyzeRep('Taneisha Clark', orders, taneishaAccounts, EXPECTED.taneisha);

    console.log();
    console.log('='.repeat(70));
    console.log('INVESTIGATION COMPLETE');
    console.log('='.repeat(70));
}

async function analyzeRep(repName, allOrders, crmAccounts, expected) {
    console.log('='.repeat(70));
    console.log(`ANALYSIS: ${repName}`);
    console.log('='.repeat(70));
    console.log();

    // Filter orders to this rep
    const repOrders = allOrders.filter(o => o.CustomerServiceRep === repName);

    // Calculate ManageOrders total
    let manageOrdersTotal = 0;
    const ordersByCustomer = new Map();

    repOrders.forEach(order => {
        const subtotal = parseFloat(order.cur_SubTotal) || 0;
        const customerId = String(order.id_Customer || '');
        const customerName = order.CustomerName || 'Unknown';

        manageOrdersTotal += subtotal;

        if (!ordersByCustomer.has(customerId)) {
            ordersByCustomer.set(customerId, {
                id: customerId,
                name: customerName,
                revenue: 0,
                orders: 0
            });
        }
        const cust = ordersByCustomer.get(customerId);
        cust.revenue += subtotal;
        cust.orders += 1;
    });

    // Build CRM customer ID set
    const crmCustomerIds = new Set();
    const crmCustomerMap = new Map();
    let crmYtdTotal = 0;

    crmAccounts.forEach(account => {
        const id = String(account.ID_Customer || account.id_Customer || '');
        const ytd = parseFloat(account.YTD_Sales_2026) || 0;

        if (id) {
            crmCustomerIds.add(id);
            crmCustomerMap.set(id, {
                name: account.CompanyName || 'Unknown',
                ytd: ytd,
                tier: account.Account_Tier || 'Unclassified'
            });
        }
        crmYtdTotal += ytd;
    });

    // Identify missing customers (in ManageOrders but not in CRM)
    const missingCustomers = [];
    const matchedCustomers = [];
    let missingRevenue = 0;
    let matchedRevenue = 0;

    ordersByCustomer.forEach((cust, customerId) => {
        if (crmCustomerIds.has(customerId)) {
            matchedRevenue += cust.revenue;
            const crmData = crmCustomerMap.get(customerId);
            matchedCustomers.push({
                ...cust,
                crmYtd: crmData?.ytd || 0,
                tier: crmData?.tier || 'Unknown'
            });
        } else {
            missingRevenue += cust.revenue;
            missingCustomers.push(cust);
        }
    });

    // Sort by revenue
    missingCustomers.sort((a, b) => b.revenue - a.revenue);
    matchedCustomers.sort((a, b) => b.revenue - a.revenue);

    // Display results
    console.log('SUMMARY');
    console.log('-'.repeat(50));
    console.log(`ManageOrders Total (orders written):  ${formatCurrency(manageOrdersTotal)}`);
    console.log(`CRM YTD_Sales_2026 Total:             ${formatCurrency(crmYtdTotal)}`);
    console.log(`Gap (ManageOrders - CRM):             ${formatCurrency(manageOrdersTotal - crmYtdTotal)}`);
    console.log();
    console.log(`Expected Team Performance:            ${formatCurrency(expected.teamPerformance)}`);
    console.log(`Expected CRM Total:                   ${formatCurrency(expected.crmTotal)}`);
    console.log(`Expected Gap:                         ${formatCurrency(expected.expectedGap)}`);
    console.log();

    console.log('CUSTOMER BREAKDOWN');
    console.log('-'.repeat(50));
    console.log(`Total customers with orders:          ${ordersByCustomer.size}`);
    console.log(`Customers IN CRM:                     ${matchedCustomers.length} (${formatCurrency(matchedRevenue)})`);
    console.log(`Customers NOT IN CRM:                 ${missingCustomers.length} (${formatCurrency(missingRevenue)})`);
    console.log();

    console.log('MISSING CUSTOMERS (not in CRM - explains the gap)');
    console.log('-'.repeat(50));

    if (missingCustomers.length === 0) {
        console.log('  (none found)');
    } else {
        missingCustomers.slice(0, 20).forEach((cust, i) => {
            const name = (cust.name || 'Unknown').substring(0, 35).padEnd(37);
            const id = (cust.id || 'N/A').toString().padEnd(8);
            console.log(`  ${(i + 1).toString().padStart(2)}. ID:${id} ${name} ${formatCurrency(cust.revenue).padStart(10)} (${cust.orders} orders)`);
        });

        if (missingCustomers.length > 20) {
            console.log(`  ... and ${missingCustomers.length - 20} more customers`);
        }

        console.log();
        console.log(`  TOTAL MISSING REVENUE: ${formatCurrency(missingRevenue)}`);
    }

    console.log();

    // Check for discrepancy between ManageOrders matched revenue and CRM YTD
    const matchedVsCrmDiff = matchedRevenue - crmYtdTotal;
    if (Math.abs(matchedVsCrmDiff) > 100) {
        console.log('CRM SYNC DISCREPANCY');
        console.log('-'.repeat(50));
        console.log(`Revenue for matched customers (ManageOrders): ${formatCurrency(matchedRevenue)}`);
        console.log(`Revenue for matched customers (CRM YTD):      ${formatCurrency(crmYtdTotal)}`);
        console.log(`Difference:                                   ${formatCurrency(matchedVsCrmDiff)}`);
        console.log();
        console.log('This suggests the CRM YTD_Sales_2026 field may not be synced with ManageOrders.');
        console.log('The CRM might include orders written by OTHER reps for these customers.');
        console.log();
    }
}

analyzeManageOrders().catch(err => {
    console.error('Error:', err.message);
    process.exit(1);
});
