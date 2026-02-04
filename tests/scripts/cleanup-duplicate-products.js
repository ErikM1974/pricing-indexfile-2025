/**
 * Cleanup Duplicate Products from Caspio
 *
 * Removes duplicate entries from Non_SanMar_Products table,
 * keeping only the first (oldest) entry for each StyleNumber.
 *
 * Usage: node tests/scripts/cleanup-duplicate-products.js
 */

const API_BASE_URL = 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
    console.log('='.repeat(60));
    console.log('CLEANUP DUPLICATE PRODUCTS');
    console.log(`API: ${API_BASE_URL}`);
    console.log('='.repeat(60));
    console.log('');

    // 1. Fetch all products
    console.log('Fetching all non-SanMar products...');
    const response = await fetch(`${API_BASE_URL}/api/non-sanmar-products?refresh=true`);
    const result = await response.json();

    if (!result.success) {
        console.log('ERROR: Failed to fetch products');
        console.log(result);
        return;
    }

    const products = result.data;
    console.log(`Found ${products.length} products`);
    console.log('');

    // 2. Group by StyleNumber and find duplicates
    const byStyle = {};
    for (const p of products) {
        if (!byStyle[p.StyleNumber]) {
            byStyle[p.StyleNumber] = [];
        }
        byStyle[p.StyleNumber].push(p);
    }

    // 3. Identify duplicates (keep first, delete rest)
    const toDelete = [];
    for (const [style, entries] of Object.entries(byStyle)) {
        if (entries.length > 1) {
            // Sort by ID_Product ascending (oldest first)
            entries.sort((a, b) => a.ID_Product - b.ID_Product);
            // Keep first, mark rest for deletion
            const keep = entries[0];
            const dupes = entries.slice(1);
            console.log(`${style}: keeping ID ${keep.ID_Product}, deleting ${dupes.length} duplicates`);
            toDelete.push(...dupes);
        }
    }

    console.log('');
    console.log(`Total duplicates to delete: ${toDelete.length}`);
    console.log('');

    if (toDelete.length === 0) {
        console.log('No duplicates found. Database is clean!');
        return;
    }

    // 4. Delete duplicates (hard delete)
    let deleted = 0;
    let failed = 0;

    for (const product of toDelete) {
        try {
            const delResponse = await fetch(
                `${API_BASE_URL}/api/non-sanmar-products/${product.ID_Product}?hard=true`,
                { method: 'DELETE' }
            );
            const delResult = await delResponse.json();

            if (delResult.success) {
                deleted++;
                console.log(`  ✓ Deleted ${product.StyleNumber} (ID: ${product.ID_Product})`);
            } else {
                failed++;
                console.log(`  ✗ Failed to delete ${product.StyleNumber} (ID: ${product.ID_Product}): ${delResult.error}`);
            }
        } catch (err) {
            failed++;
            console.log(`  ✗ Error deleting ${product.StyleNumber}: ${err.message}`);
        }

        // Delay to avoid rate limiting (1.5s between requests)
        await sleep(1500);
    }

    console.log('');
    console.log('='.repeat(60));
    console.log('CLEANUP COMPLETE');
    console.log('='.repeat(60));
    console.log(`Deleted: ${deleted}`);
    console.log(`Failed: ${failed}`);
}

main().catch(console.error);
