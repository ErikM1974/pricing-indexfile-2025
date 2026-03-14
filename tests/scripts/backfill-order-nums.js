/**
 * backfill-order-nums.js — One-time script to backfill Order_Num_SW
 * on recent art requests by matching to ShopWorks orders via customer ID.
 *
 * Usage:
 *   node tests/scripts/backfill-order-nums.js --dry-run     # Report only
 *   node tests/scripts/backfill-order-nums.js                # Apply updates
 *   node tests/scripts/backfill-order-nums.js --limit=10     # Only first 10
 */

const API_BASE = 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const LIMIT_ARG = args.find(a => a.startsWith('--limit='));
const LIMIT = LIMIT_ARG ? parseInt(LIMIT_ARG.split('=')[1], 10) : 25;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function fetchJson(url) {
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`HTTP ${resp.status} for ${url}`);
    return resp.json();
}

async function putJson(url, body) {
    const resp = await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status} for PUT ${url}`);
    return resp.json();
}

function isEmpty(val) {
    return !val || val === '' || val === '--' || val === 'null' || val === 'undefined';
}

async function main() {
    const mode = DRY_RUN ? 'DRY RUN' : 'LIVE UPDATE';
    console.log('');
    console.log('═══════════════════════════════════════════════════');
    console.log(`  Art Request Order Backfill — ${mode}`);
    console.log('═══════════════════════════════════════════════════');
    console.log('');

    // Step 1: Fetch recent art requests
    process.stdout.write('Fetching art requests... ');
    const artData = await fetchJson(
        `${API_BASE}/api/artrequests?orderBy=Date_Created+DESC&limit=100`
    );
    const allRequests = artData.Result || artData.result || artData || [];
    console.log(`found ${allRequests.length}`);

    // Step 2: Filter to unlinked only
    const unlinked = allRequests.filter(r => isEmpty(r.Order_Num_SW));
    console.log(`Filtering unlinked... found ${unlinked.length}`);

    if (unlinked.length === 0) {
        console.log('\nAll art requests already have Order # linked. Nothing to do.');
        return;
    }

    // Apply limit
    const toProcess = unlinked.slice(0, LIMIT);
    console.log(`\nProcessing ${toProcess.length} art requests (1s delay between lookups)...\n`);

    // Step 3: Pre-fetch all recent customers for name-match fallback
    let allCustomers = [];
    try {
        const custData = await fetchJson(`${API_BASE}/api/manageorders/customers`);
        allCustomers = custData.customers || [];
    } catch (e) {
        console.log('  ⚠ Could not fetch customer list for name matching:', e.message);
    }

    // Results tracking
    const results = { matched: [], review: [], noMatch: [], noData: [], errors: [] };

    for (let i = 0; i < toProcess.length; i++) {
        const req = toProcess[i];
        const designNum = req.Design_Num_SW || req.ID_Design || '?';
        const company = req.CompanyName || '(unknown)';
        const custId = req.Shopwork_customer_number || req.Shopworks_Customer_Number || '';
        const pkId = req.PK_ID;
        const prefix = `${String(i + 1).padStart(2)}. `;

        if (i > 0) await sleep(4000); // Rate limit: 30 req/min on ManageOrders proxy

        try {
            let orders = [];
            let matchType = '';
            let matchedCustId = custId;

            if (!isEmpty(custId)) {
                // Path A: Search by customer ID
                const orderData = await fetchJson(
                    `${API_BASE}/api/manageorders/orders?id_Customer=${encodeURIComponent(custId)}`
                );
                orders = orderData.result || [];
                matchType = 'cust-id';
            } else if (!isEmpty(company)) {
                // Path B: Fuzzy name match via customer list
                const nameLower = company.toLowerCase();
                const match = allCustomers.find(c => {
                    const cn = (c.CustomerName || '').toLowerCase();
                    return cn.indexOf(nameLower) !== -1 || nameLower.indexOf(cn) !== -1;
                });
                if (match) {
                    matchedCustId = match.id_Customer;
                    const orderData = await fetchJson(
                        `${API_BASE}/api/manageorders/orders?id_Customer=${encodeURIComponent(matchedCustId)}`
                    );
                    orders = orderData.result || [];
                    matchType = 'name-match';
                } else {
                    matchType = 'no-name-match';
                }
            } else {
                // No customer # or company name
                console.log(`${prefix}✗ #${designNum} "${company}"  → No customer data available`);
                results.noData.push({ designNum, company });
                continue;
            }

            if (orders.length === 0) {
                console.log(`${prefix}✗ #${designNum} "${company}"  Cust#${custId || '--'} → No orders found (60-day window)`);
                results.noMatch.push({ designNum, company, custId });
                continue;
            }

            // Pick order closest to art request creation date
            const artDate = new Date(req.Date_Created || 0);
            orders.sort((a, b) => {
                const diffA = Math.abs(new Date(a.date_Ordered || 0) - artDate);
                const diffB = Math.abs(new Date(b.date_Ordered || 0) - artDate);
                return diffA - diffB;
            });
            const bestOrder = orders[0];
            const orderNum = bestOrder.id_Order;
            const orderDate = bestOrder.date_Ordered ? new Date(bestOrder.date_Ordered).toLocaleDateString() : '?';
            const artDateStr = artDate.toLocaleDateString();
            const daysDiff = Math.round(Math.abs(new Date(bestOrder.date_Ordered || 0) - artDate) / (1000 * 60 * 60 * 24));
            const tag = matchType === 'name-match' ? ', name-match' : '';
            const dateInfo = `art:${artDateStr} ord:${orderDate} (${daysDiff}d apart)`;

            if (orders.length === 1) {
                console.log(`${prefix}✓ #${designNum} "${company}"  Cust#${matchedCustId} → Order #${orderNum}  [exact match, ${dateInfo}${tag}]`);
                results.matched.push({ designNum, company, orderNum, custId: matchedCustId, pkId });
            } else if (daysDiff <= 7) {
                console.log(`${prefix}✓ #${designNum} "${company}"  Cust#${matchedCustId} → Order #${orderNum}  [closest of ${orders.length}, ${dateInfo}${tag}]`);
                results.matched.push({ designNum, company, orderNum, custId: matchedCustId, pkId });
            } else {
                console.log(`${prefix}⚠ #${designNum} "${company}"  Cust#${matchedCustId} → Order #${orderNum}  [${orders.length} orders, ${dateInfo}${tag}]`);
                results.review.push({ designNum, company, orderNum, custId: matchedCustId, pkId, orderCount: orders.length });
            }
        } catch (err) {
            console.log(`${prefix}✗ #${designNum} "${company}" → ERROR: ${err.message}`);
            results.errors.push({ designNum, company, error: err.message });
        }
    }

    // Summary
    const totalMatchable = results.matched.length + results.review.length;
    console.log('');
    console.log('═══════════════════════════════════════════════════');
    console.log('  SUMMARY');
    console.log('═══════════════════════════════════════════════════');
    console.log(`  Auto-matched:  ${results.matched.length}`);
    console.log(`  Review needed: ${results.review.length}  (multiple orders, picked newest)`);
    console.log(`  No match:      ${results.noMatch.length}  (no orders in 60-day window)`);
    console.log(`  No data:       ${results.noData.length}  (no customer # or company name)`);
    console.log(`  Errors:        ${results.errors.length}`);
    console.log(`  ─────────────────`);
    console.log(`  Total:         ${toProcess.length}`);
    console.log('');

    if (DRY_RUN) {
        console.log(`  Run without --dry-run to apply ${totalMatchable} updates.`);
        console.log('');
        return;
    }

    // Step 5: Apply updates
    if (totalMatchable === 0) {
        console.log('  No matches to apply.');
        return;
    }

    console.log(`  Applying ${totalMatchable} updates...\n`);
    const allMatches = [...results.matched, ...results.review];
    let updated = 0;
    let failed = 0;

    for (const match of allMatches) {
        try {
            const body = { Order_Num_SW: String(match.orderNum) };
            // Also set customer # if we have it
            if (match.custId) {
                body.Shopwork_customer_number = String(match.custId);
            }
            await putJson(`${API_BASE}/api/artrequests/${match.pkId}`, body);
            console.log(`  ✓ Updated #${match.designNum} → Order #${match.orderNum}`);
            updated++;
            await sleep(500); // Brief delay between updates
        } catch (err) {
            console.log(`  ✗ Failed #${match.designNum}: ${err.message}`);
            failed++;
        }
    }

    console.log(`\n  Done! Updated: ${updated}, Failed: ${failed}`);
    console.log('');
}

main().catch(err => {
    console.error('\nFATAL:', err.message);
    process.exit(1);
});
