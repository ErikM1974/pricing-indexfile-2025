/**
 * Update New Products Flags Script
 * Sets isNew=true for 15 Active products identified in validation
 *
 * Usage:
 *   node scripts/update-new-products-flags.js [--test]
 *
 * Options:
 *   --test    Test mode - only update one product (NE410)
 */

const API_BASE = 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api';

// 15 Active products that need isNew flag set
const PRODUCTS_TO_UPDATE = [
    // Outerwear/Jackets (5)
    { style: 'EB120', category: 'Outerwear/Jackets', title: 'Eddie Bauer Adventurer 1/4-Zip' },
    { style: 'EB121', category: 'Outerwear/Jackets', title: 'Eddie Bauer Women\'s Adventurer Full-Zip' },
    { style: 'CT100617', category: 'Outerwear/Jackets', title: 'Carhartt Rain Defender Paxton Sweatshirt' },
    { style: 'CT103828', category: 'Outerwear/Jackets', title: 'Carhartt Duck Detroit Jacket' },
    { style: 'CT104670', category: 'Outerwear/Jackets', title: 'Carhartt Storm Defender Jacket' },

    // Headwear (4)
    { style: 'CT104597', category: 'Headwear', title: 'Carhartt Watch Cap 2.0' },
    { style: 'DT620', category: 'Headwear', title: 'District Spaced-Dyed Beanie' },
    { style: 'DT624', category: 'Headwear', title: 'District Flat Bill Snapback Trucker Cap' },
    { style: 'NE410', category: 'Headwear', title: 'New Era Foam Rope Trucker Cap' },

    // Fleece/Sweatshirts (2)
    { style: 'ST850', category: 'Fleece/Sweatshirts', title: 'Sport-Tek Sport-Wick Stretch 1/4-Zip' },
    { style: 'ST851', category: 'Fleece/Sweatshirts', title: 'Sport-Tek Sport-Wick Stretch 1/2-Zip' },

    // Apparel (3)
    { style: 'BB18200', category: 'Apparel', title: 'Brooks Brothers Pima Cotton Pique Polo' },
    { style: 'CS410', category: 'Apparel', title: 'CornerStone Select Snag-Proof Tactical Polo' },
    { style: 'CS415', category: 'Apparel', title: 'CornerStone Select Snag-Proof Tipped Pocket Polo' },

    // Bags (1)
    { style: 'EB201', category: 'Bags', title: 'Eddie Bauer Women\'s Full-Zip Fleece Jacket' }
];

/**
 * Update a single product's isNew flag
 */
async function updateProductFlag(styleNumber, dryRun = false) {
    console.log(`\n[${styleNumber}] Processing...`);

    try {
        // First, verify product exists
        const checkUrl = `${API_BASE}/product-details?styleNumber=${styleNumber}`;
        const checkResponse = await fetch(checkUrl);

        if (!checkResponse.ok) {
            throw new Error(`Product verification failed: ${checkResponse.status}`);
        }

        const productData = await checkResponse.json();

        if (!Array.isArray(productData) || productData.length === 0) {
            throw new Error('Product not found in database');
        }

        const firstVariant = productData[0];
        console.log(`[${styleNumber}] Found: ${firstVariant.PRODUCT_TITLE || 'No title'}`);
        console.log(`[${styleNumber}] Current isNew: ${firstVariant.isNew}`);
        console.log(`[${styleNumber}] Status: ${firstVariant.PRODUCT_STATUS || 'Unknown'}`);

        // Check if discontinued
        const title = firstVariant.PRODUCT_TITLE || '';
        if (title.toUpperCase().includes('DISCONTINUED')) {
            throw new Error('Product is DISCONTINUED - should not be marked as new');
        }

        // Check if already marked as new
        if (firstVariant.isNew === true || firstVariant.isNew === 'true') {
            console.log(`[${styleNumber}] ✓ Already marked as new`);
            return { success: true, alreadySet: true };
        }

        if (dryRun) {
            console.log(`[${styleNumber}] [DRY RUN] Would update isNew to true`);
            return { success: true, dryRun: true };
        }

        // Update the flag
        const updateUrl = `${API_BASE}/products/${styleNumber}`;
        const updateResponse = await fetch(updateUrl, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                isNew: true
            })
        });

        if (!updateResponse.ok) {
            const errorText = await updateResponse.text();
            throw new Error(`Update failed (${updateResponse.status}): ${errorText}`);
        }

        console.log(`[${styleNumber}] ✓ Successfully updated to isNew=true`);
        return { success: true };

    } catch (error) {
        console.error(`[${styleNumber}] ✗ Error: ${error.message}`);
        return { success: false, error: error.message };
    }
}

/**
 * Batch update with delay between requests
 */
async function batchUpdate(products, dryRun = false, delayMs = 1000) {
    console.log('='.repeat(70));
    console.log('NEW PRODUCTS FLAG UPDATE SCRIPT');
    console.log('='.repeat(70));
    console.log(`Mode: ${dryRun ? 'DRY RUN (no changes)' : 'LIVE UPDATE'}`);
    console.log(`Products to update: ${products.length}`);
    console.log(`Delay between requests: ${delayMs}ms`);
    console.log('='.repeat(70));

    const results = {
        success: [],
        alreadySet: [],
        failed: [],
        dryRun: []
    };

    for (let i = 0; i < products.length; i++) {
        const product = products[i];

        console.log(`\n[${i + 1}/${products.length}] ${product.style} - ${product.title}`);

        const result = await updateProductFlag(product.style, dryRun);

        if (result.success) {
            if (result.dryRun) {
                results.dryRun.push(product.style);
            } else if (result.alreadySet) {
                results.alreadySet.push(product.style);
            } else {
                results.success.push(product.style);
            }
        } else {
            results.failed.push({ style: product.style, error: result.error });
        }

        // Delay before next request (except last one)
        if (i < products.length - 1) {
            await new Promise(resolve => setTimeout(resolve, delayMs));
        }
    }

    // Print summary
    console.log('\n' + '='.repeat(70));
    console.log('SUMMARY');
    console.log('='.repeat(70));

    if (dryRun) {
        console.log(`DRY RUN - Would update: ${results.dryRun.length} products`);
        console.log(`Already set: ${results.alreadySet.length} products`);
    } else {
        console.log(`✓ Successfully updated: ${results.success.length} products`);
        console.log(`✓ Already set: ${results.alreadySet.length} products`);
    }

    if (results.failed.length > 0) {
        console.log(`✗ Failed: ${results.failed.length} products`);
        console.log('\nFailed Products:');
        results.failed.forEach(f => {
            console.log(`  - ${f.style}: ${f.error}`);
        });
    }

    console.log('='.repeat(70));

    return results;
}

/**
 * Main execution
 */
async function main() {
    const args = process.argv.slice(2);
    const isTest = args.includes('--test');
    const isDryRun = args.includes('--dry-run');

    let productsToProcess = PRODUCTS_TO_UPDATE;

    if (isTest) {
        console.log('TEST MODE: Only updating NE410');
        productsToProcess = PRODUCTS_TO_UPDATE.filter(p => p.style === 'NE410');

        if (productsToProcess.length === 0) {
            console.error('Error: NE410 not found in products list');
            process.exit(1);
        }
    }

    try {
        const results = await batchUpdate(productsToProcess, isDryRun);

        // Exit code based on results
        if (results.failed.length > 0) {
            process.exit(1); // Some failures
        } else {
            process.exit(0); // All success
        }

    } catch (error) {
        console.error('Fatal error:', error);
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    main();
}

module.exports = { updateProductFlag, batchUpdate, PRODUCTS_TO_UPDATE };
