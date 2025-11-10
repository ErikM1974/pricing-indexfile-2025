/**
 * Comprehensive verification of all 60 products from process-new-products.py
 * Checks each product individually via /api/product-details endpoint
 */

const ALL_60_STYLES = [
    'EB120', 'EB121', 'EB122', 'EB123', 'EB124', 'EB125', 'EB126', 'EB127', 'EB128',
    'EB130', 'EB131', 'EB132', 'EB133', 'EB201', 'EB202',
    'DT700', 'DT710', 'DT715', 'DT720', 'DT730', 'DT740', 'DT750', 'DT760', 'DT770',
    'DT620', 'DT624', 'DT625', 'DT626',
    'CT100617', 'CT103828', 'CT104597', 'CT104670', 'CTK121',
    'CTB100632', 'CTB109900', 'CTG100893', 'CTC05', 'CTC04', 'CTC1001',
    'NE410', 'NE411', 'NE412',
    'C136', 'C138', 'C141', 'C144',
    'OG710',
    'ST850', 'ST851', 'ST860', 'ST861', 'ST880', 'ST881', 'ST890', 'ST891',
    'NF0A7V85', 'NF0A84JZ',
    'BB18200',
    'CS410', 'CS415'
];

const API_BASE = 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';

// Track results
const results = {
    found: [],
    notFound: [],
    errors: []
};

// Rate limiting: 30 requests per minute = 1 request every 2 seconds
const DELAY_MS = 2100;

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function checkProduct(style) {
    try {
        const response = await fetch(`${API_BASE}/api/product-details?styleNumber=${style}`);

        if (!response.ok) {
            results.errors.push({ style, error: `HTTP ${response.status}` });
            return;
        }

        const data = await response.json();

        if (Array.isArray(data) && data.length > 0) {
            // Product exists!
            const firstVariant = data[0];
            results.found.push({
                style: style,
                title: firstVariant.PRODUCT_TITLE || 'Unknown',
                brand: firstVariant.BRAND_NAME || 'Unknown',
                variants: data.length,
                isNew: firstVariant.isNew || false,
                category: firstVariant.CATEGORY_NAME || 'Unknown'
            });
        } else {
            // Product not found
            results.notFound.push(style);
        }
    } catch (error) {
        results.errors.push({ style, error: error.message });
    }
}

async function verifyAllProducts() {
    console.log('🔍 Starting comprehensive verification of 60 products...\n');
    console.log('⏱️  This will take ~2 minutes (rate limiting: 1 request every 2 seconds)\n');

    let completed = 0;

    for (const style of ALL_60_STYLES) {
        process.stdout.write(`\rChecking ${++completed}/60: ${style}...`);
        await checkProduct(style);
        if (completed < ALL_60_STYLES.length) {
            await sleep(DELAY_MS);
        }
    }

    console.log('\n\n' + '='.repeat(80));
    console.log('VERIFICATION RESULTS');
    console.log('='.repeat(80) + '\n');

    // Summary
    console.log(`✅ Found: ${results.found.length} products`);
    console.log(`❌ Not Found: ${results.notFound.length} products`);
    if (results.errors.length > 0) {
        console.log(`⚠️  Errors: ${results.errors.length} products`);
    }
    console.log('');

    // Found products breakdown
    if (results.found.length > 0) {
        console.log('='.repeat(80));
        console.log('FOUND PRODUCTS (' + results.found.length + ')');
        console.log('='.repeat(80) + '\n');

        // Group by vendor
        const byVendor = {};
        results.found.forEach(p => {
            const prefix = p.style.match(/^[A-Z]+/)[0];
            if (!byVendor[prefix]) byVendor[prefix] = [];
            byVendor[prefix].push(p);
        });

        Object.keys(byVendor).sort().forEach(prefix => {
            const products = byVendor[prefix];
            console.log(`${prefix} (${products.length} products):`);
            products.forEach(p => {
                const newFlag = p.isNew ? '🆕' : '  ';
                const styleCol = (p.style + '            ').substring(0, 12);
                console.log(`  ${newFlag} ${styleCol} - ${p.title}`);
                console.log(`     Brand: ${p.brand}, Category: ${p.category}, Variants: ${p.variants}`);
            });
            console.log('');
        });

        // Check how many already marked as new
        const alreadyMarked = results.found.filter(p => p.isNew).length;
        const needMarking = results.found.filter(p => !p.isNew).length;

        console.log('Status:');
        console.log(`  ✅ Already marked as new: ${alreadyMarked}`);
        console.log(`  📝 Need marking: ${needMarking}`);
        console.log('');
    }

    // Not found products
    if (results.notFound.length > 0) {
        console.log('='.repeat(80));
        console.log('NOT FOUND IN DATABASE (' + results.notFound.length + ')');
        console.log('='.repeat(80) + '\n');

        // Group by prefix
        const byPrefix = {};
        results.notFound.forEach(style => {
            const prefix = style.match(/^[A-Z]+/)[0];
            if (!byPrefix[prefix]) byPrefix[prefix] = [];
            byPrefix[prefix].push(style);
        });

        Object.keys(byPrefix).sort().forEach(prefix => {
            console.log(`${prefix}: ${byPrefix[prefix].join(', ')}`);
        });
        console.log('');
    }

    // Errors
    if (results.errors.length > 0) {
        console.log('='.repeat(80));
        console.log('ERRORS (' + results.errors.length + ')');
        console.log('='.repeat(80) + '\n');

        results.errors.forEach(e => {
            console.log(`❌ ${e.style}: ${e.error}`);
        });
        console.log('');
    }

    // Next steps
    if (results.found.length > 0) {
        const needMarking = results.found.filter(p => !p.isNew);
        if (needMarking.length > 0) {
            console.log('='.repeat(80));
            console.log('NEXT STEPS');
            console.log('='.repeat(80) + '\n');
            console.log('To mark the remaining products as new, run:');
            console.log('');
            console.log('curl -X POST https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/admin/products/mark-as-new \\');
            console.log('  -H "Content-Type: application/json" \\');
            console.log(`  -d '{"styles": ${JSON.stringify(needMarking.map(p => p.style))}}'`);
            console.log('');
        } else {
            console.log('🎉 All found products are already marked as new!');
        }
    }
}

// Run verification
verifyAllProducts().catch(console.error);
