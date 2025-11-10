/**
 * Verify New Products Status
 * Checks if the 15 featured products are already marked with IsNew=true
 *
 * Usage: node scripts/verify-new-products-status.js
 */

const API_BASE = 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';

// The 15 products that should be marked as new (from validation results)
const EXPECTED_NEW_PRODUCTS = [
    // Outerwear/Jackets (5)
    'EB120',   // Eddie Bauer Adventurer 1/4-Zip
    'EB121',   // Eddie Bauer Women's Adventurer Full-Zip
    'CT100617', // Carhartt Rain Defender Paxton Sweatshirt
    'CT103828', // Carhartt Waterproof Jacket
    'CT104670', // Carhartt Rain Defender Jacket

    // Headwear (4)
    'CT104597', // Carhartt Knit Cap
    'DT620',    // District Thin Beanie
    'DT624',    // District Slouch Beanie
    'NE410',    // New Era Snapback Cap

    // Fleece/Sweatshirts (2)
    'ST850',    // Sport-Tek Sport-Wick Stretch 1/4-Zip
    'ST851',    // Sport-Tek Sport-Wick Stretch Pullover

    // Apparel (2)
    'BB18200',  // Brooks Brothers Non-Iron Stretch Shirt
    'CS410',    // CornerStone Select Snag-Proof Polo
    'CS415',    // CornerStone Select Lightweight Polo

    // Bags (1)
    'EB201'     // Eddie Bauer Travex Carry-On
];

/**
 * Query the API to get products marked as new
 */
async function queryNewProducts() {
    try {
        console.log('='.repeat(70));
        console.log('QUERYING NEW PRODUCTS FROM API');
        console.log('='.repeat(70));
        console.log(`Endpoint: ${API_BASE}/api/products/new`);
        console.log('Fetching all new products...\n');

        const response = await fetch(`${API_BASE}/api/products/new?limit=100`);

        if (!response.ok) {
            throw new Error(`API returned ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();

        console.log(`✓ API Response: ${data.count} products marked as new`);
        console.log(`  Cached: ${data.cached}`);

        return data.products;

    } catch (error) {
        console.error('✗ Error querying API:', error.message);
        return null;
    }
}

/**
 * Extract unique style numbers from product records
 */
function extractUniqueStyles(products) {
    const styles = new Set();

    products.forEach(product => {
        if (product.STYLE) {
            styles.add(product.STYLE);
        }
    });

    return Array.from(styles).sort();
}

/**
 * Check each expected product against API results
 */
function verifyProducts(apiProducts) {
    const apiStyles = extractUniqueStyles(apiProducts);

    console.log('\n' + '='.repeat(70));
    console.log('VERIFICATION RESULTS');
    console.log('='.repeat(70));

    const results = {
        alreadyMarked: [],
        notMarked: [],
        extraMarked: []
    };

    // Check if expected products are marked
    EXPECTED_NEW_PRODUCTS.forEach(style => {
        if (apiStyles.includes(style)) {
            results.alreadyMarked.push(style);
        } else {
            results.notMarked.push(style);
        }
    });

    // Check if any unexpected products are marked
    apiStyles.forEach(style => {
        if (!EXPECTED_NEW_PRODUCTS.includes(style)) {
            results.extraMarked.push(style);
        }
    });

    return results;
}

/**
 * Display detailed results
 */
function displayResults(results, apiProducts) {
    console.log('\n[1/3] EXPECTED PRODUCTS ALREADY MARKED AS NEW:');
    console.log('-'.repeat(70));

    if (results.alreadyMarked.length === 0) {
        console.log('  (none)');
    } else {
        results.alreadyMarked.forEach((style, index) => {
            // Find product details
            const product = apiProducts.find(p => p.STYLE === style);
            const title = product ? product.PRODUCT_TITLE : 'Unknown';
            console.log(`  ${index + 1}. ${style.padEnd(12)} - ${title}`);
        });
    }

    console.log(`\n  Total: ${results.alreadyMarked.length} of ${EXPECTED_NEW_PRODUCTS.length} products`);

    // Products NOT yet marked
    console.log('\n[2/3] EXPECTED PRODUCTS NOT YET MARKED AS NEW:');
    console.log('-'.repeat(70));

    if (results.notMarked.length === 0) {
        console.log('  ✓ All expected products are already marked!');
    } else {
        results.notMarked.forEach((style, index) => {
            console.log(`  ${index + 1}. ${style}`);
        });
        console.log(`\n  Total: ${results.notMarked.length} products need to be marked`);
    }

    // Extra products marked
    console.log('\n[3/3] OTHER PRODUCTS MARKED AS NEW (NOT IN EXPECTED LIST):');
    console.log('-'.repeat(70));

    if (results.extraMarked.length === 0) {
        console.log('  (none - only expected products are marked)');
    } else {
        results.extraMarked.forEach((style, index) => {
            const product = apiProducts.find(p => p.STYLE === style);
            const title = product ? product.PRODUCT_TITLE : 'Unknown';
            console.log(`  ${index + 1}. ${style.padEnd(12)} - ${title}`);
        });
        console.log(`\n  Total: ${results.extraMarked.length} unexpected products`);
    }
}

/**
 * Generate summary and recommendations
 */
function generateSummary(results) {
    console.log('\n' + '='.repeat(70));
    console.log('SUMMARY & RECOMMENDATIONS');
    console.log('='.repeat(70));

    const percentComplete = Math.round((results.alreadyMarked.length / EXPECTED_NEW_PRODUCTS.length) * 100);

    console.log(`\nStatus: ${results.alreadyMarked.length}/${EXPECTED_NEW_PRODUCTS.length} products marked (${percentComplete}%)`);

    if (results.alreadyMarked.length === EXPECTED_NEW_PRODUCTS.length) {
        console.log('\n✓✓✓ SUCCESS! All expected products are already marked as new.');
        console.log('    No action needed - the feature is ready to use.');

        if (results.extraMarked.length > 0) {
            console.log(`\n⚠ Note: ${results.extraMarked.length} additional products are also marked.`);
            console.log('   Review if these should remain marked as new.');
        }

    } else {
        console.log('\n⚠ ACTION REQUIRED:');
        console.log(`   ${results.notMarked.length} products still need to be marked.\n`);
        console.log('   Run the following command to mark them:\n');
        console.log('   curl -X POST ' + API_BASE + '/api/admin/products/mark-as-new \\');
        console.log('     -H "Content-Type: application/json" \\');
        console.log('     -d \'{"styles": ' + JSON.stringify(results.notMarked) + '}\'');
    }

    console.log('\n' + '='.repeat(70));
}

/**
 * Main execution
 */
async function main() {
    console.log('\n' + '='.repeat(70));
    console.log('NEW PRODUCTS STATUS VERIFICATION');
    console.log('='.repeat(70));
    console.log('Checking if 15 featured products are marked as new...\n');

    // Step 1: Query API
    const apiProducts = await queryNewProducts();

    if (!apiProducts) {
        console.log('\n✗ Unable to verify - API query failed');
        console.log('  Check that the API endpoint is accessible');
        process.exit(1);
    }

    // Step 2: Verify against expected list
    const results = verifyProducts(apiProducts);

    // Step 3: Display detailed results
    displayResults(results, apiProducts);

    // Step 4: Generate summary
    generateSummary(results);

    // Exit code
    const allMarked = results.alreadyMarked.length === EXPECTED_NEW_PRODUCTS.length;
    process.exit(allMarked ? 0 : 1);
}

// Run verification
main().catch(error => {
    console.error('\n✗ Unexpected error:', error);
    process.exit(1);
});
