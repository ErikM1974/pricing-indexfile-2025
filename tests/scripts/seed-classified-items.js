/**
 * Seed Classified Items to Caspio
 *
 * Adds service codes and non-SanMar products discovered from ShopWorks imports
 * that weren't previously in the database.
 *
 * Usage: node tests/scripts/seed-classified-items.js
 *
 * Safe to run multiple times - API will reject duplicates with 409 or skip them.
 */

const API_BASE_URL = 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';

// ============================================
// SERVICE CODES TO ADD
// ============================================
const SERVICE_CODES = [
    {
        ServiceCode: 'CDP',
        ServiceType: 'FEE',
        DisplayName: 'Customer Digital Print',
        Category: 'Fees',
        PricingMethod: 'FLAT',
        TierLabel: '',
        UnitCost: 0,
        SellPrice: 0,
        PerUnit: 'varies',
        Notes: 'Price varies by job - handled manually'
    },
    {
        ServiceCode: 'SPSU',
        ServiceType: 'FEE',
        DisplayName: 'Screen Print Set Up',
        Category: 'Fees',
        PricingMethod: 'FLAT',
        TierLabel: '',
        UnitCost: 25.00,
        SellPrice: 50.00,
        PerUnit: 'per screen/color'
    },
    // NOTE: CS (Cap Side) already exists in Caspio with TIERED pricing (127-130)
    // No need to add a FLAT version - the tiered version is correct
    {
        ServiceCode: 'Transfer',
        ServiceType: 'FEE',
        DisplayName: 'Heat Press Transfer',
        Category: 'Fees',
        PricingMethod: 'FLAT',
        TierLabel: '',
        UnitCost: 2.50,
        SellPrice: 5.00,
        PerUnit: 'per transfer'
    },
    {
        ServiceCode: 'SPRESET',
        ServiceType: 'FEE',
        DisplayName: 'Screen Print Reset',
        Category: 'Fees',
        PricingMethod: 'FLAT',
        TierLabel: '',
        UnitCost: 12.50,
        SellPrice: 25.00,
        PerUnit: 'per reset',
        Notes: 'Color change fee between runs'
    },
    {
        ServiceCode: 'Shipping',
        ServiceType: 'FEE',
        DisplayName: 'Shipping Charge',
        Category: 'Fees',
        PricingMethod: 'FLAT',
        TierLabel: '',
        UnitCost: 0,
        SellPrice: 0,
        PerUnit: 'pass-through',
        Notes: 'Pass-through cost from shipping provider'
    },
    {
        ServiceCode: 'Freight',
        ServiceType: 'FEE',
        DisplayName: 'Freight Charge',
        Category: 'Fees',
        PricingMethod: 'FLAT',
        TierLabel: '',
        UnitCost: 0,
        SellPrice: 0,
        PerUnit: 'pass-through',
        Notes: 'Pass-through cost for heavy/bulk shipments'
    },
    {
        ServiceCode: 'Name/Number',
        ServiceType: 'EMBROIDERY',
        DisplayName: 'Name & Number Combo',
        Category: 'Special',
        PricingMethod: 'FLAT',
        TierLabel: '',
        UnitCost: 7.50,
        SellPrice: 15.00,
        PerUnit: 'each',
        Notes: 'Sports personalization (name + jersey number)'
    },
    {
        ServiceCode: 'emblem',
        ServiceType: 'DECORATION',
        DisplayName: 'Embroidered Emblem',
        Category: 'Emblems',
        PricingMethod: 'FLAT',
        TierLabel: '',
        UnitCost: 4.00,
        SellPrice: 8.00,
        PerUnit: 'each',
        Notes: 'Pre-made embroidered emblem (sewing separate)'
    }
];

// ============================================
// NON-SANMAR PRODUCTS TO ADD
// ============================================
const NON_SANMAR_PRODUCTS = [
    // Richardson Caps (VendorCode: RICH)
    { StyleNumber: '112', Brand: 'Richardson', ProductName: 'Trucker Cap', Category: 'Caps', DefaultCost: 8.00, DefaultSellPrice: 16.00, VendorCode: 'RICH' },
    { StyleNumber: '110', Brand: 'Richardson', ProductName: 'R-Flex Cap', Category: 'Caps', DefaultCost: 10.00, DefaultSellPrice: 20.00, VendorCode: 'RICH' },
    { StyleNumber: '115', Brand: 'Richardson', ProductName: 'Low Pro Trucker', Category: 'Caps', DefaultCost: 9.00, DefaultSellPrice: 18.00, VendorCode: 'RICH' },
    { StyleNumber: '258', Brand: 'Richardson', ProductName: '5 Panel Rope Cap', Category: 'Caps', DefaultCost: 12.00, DefaultSellPrice: 24.00, VendorCode: 'RICH' },
    { StyleNumber: '511', Brand: 'Richardson', ProductName: 'Flatbill Trucker', Category: 'Caps', DefaultCost: 10.00, DefaultSellPrice: 20.00, VendorCode: 'RICH' },
    { StyleNumber: 'PTS65', Brand: 'Richardson', ProductName: 'Surge Fitted Cap', Category: 'Caps', DefaultCost: 14.00, DefaultSellPrice: 28.00, VendorCode: 'RICH' },

    // Callaway Golf (VendorCode: CALL)
    { StyleNumber: 'CGM211', Brand: 'Callaway', ProductName: 'Core Performance Polo (M)', Category: 'Polos', DefaultCost: 35.00, DefaultSellPrice: 70.00, VendorCode: 'CALL' },
    { StyleNumber: 'CGW212', Brand: 'Callaway', ProductName: 'Core Performance Polo (W)', Category: 'Polos', DefaultCost: 35.00, DefaultSellPrice: 70.00, VendorCode: 'CALL' },

    // Cutter & Buck (VendorCode: CB)
    { StyleNumber: 'MQK00075', Brand: 'Cutter & Buck', ProductName: 'Spin Pique Polo', Category: 'Polos', DefaultCost: 45.00, DefaultSellPrice: 90.00, VendorCode: 'CB' },
    { StyleNumber: 'MCK01127', Brand: 'Cutter & Buck', ProductName: 'Advantage Polo', Category: 'Polos', DefaultCost: 42.00, DefaultSellPrice: 84.00, VendorCode: 'CB' },
    { StyleNumber: 'MCK01144', Brand: 'Cutter & Buck', ProductName: 'Forge Heather Polo', Category: 'Polos', DefaultCost: 40.00, DefaultSellPrice: 80.00, VendorCode: 'CB' },

    // Hi-Vis Safety (VendorCode: HIVIS)
    { StyleNumber: '1712', Brand: 'Hi-Vis', ProductName: 'Hype-Lite Vest', Category: 'Safety', DefaultCost: 18.00, DefaultSellPrice: 36.00, VendorCode: 'HIVIS' },
    { StyleNumber: '1715', Brand: 'Hi-Vis', ProductName: 'VPO Vest', Category: 'Safety', DefaultCost: 20.00, DefaultSellPrice: 40.00, VendorCode: 'HIVIS' },
    { StyleNumber: '8001', Brand: 'Hi-Vis', ProductName: 'Safety Bomber Jacket', Category: 'Jackets', DefaultCost: 45.00, DefaultSellPrice: 90.00, VendorCode: 'HIVIS' },
    { StyleNumber: '3131', Brand: 'GSS Safety', ProductName: 'Visibility Vest', Category: 'Safety', DefaultCost: 15.00, DefaultSellPrice: 30.00, VendorCode: 'HIVIS' },

    // Promotional Items (VendorCode: PROMO)
    { StyleNumber: 'LTM752', Brand: 'Polar Camel', ProductName: '16 oz Pint Glass', Category: 'Drinkware', DefaultCost: 5.00, DefaultSellPrice: 12.00, VendorCode: 'PROMO' },
    { StyleNumber: 'LTM761', Brand: 'Polar Camel', ProductName: '20 oz Tumbler', Category: 'Drinkware', DefaultCost: 8.00, DefaultSellPrice: 18.00, VendorCode: 'PROMO' },
    { StyleNumber: 'LTM765', Brand: 'Polar Camel', ProductName: 'Pint with Slider Lid', Category: 'Drinkware', DefaultCost: 7.00, DefaultSellPrice: 15.00, VendorCode: 'PROMO' },
    { StyleNumber: 'LTM768', Brand: 'Polar Camel', ProductName: 'Pint with Slider (Alt)', Category: 'Drinkware', DefaultCost: 7.00, DefaultSellPrice: 15.00, VendorCode: 'PROMO' },

    // Specialty Items (VendorCode: SPEC)
    { StyleNumber: 'CP96', Brand: 'Custom', ProductName: 'Hops n Drops Hat', Category: 'Caps', DefaultCost: 12.00, DefaultSellPrice: 24.00, VendorCode: 'SPEC' },
    { StyleNumber: 'HT01', Brand: 'Specialty', ProductName: 'Skull Cap', Category: 'Caps', DefaultCost: 6.00, DefaultSellPrice: 12.00, VendorCode: 'SPEC' },
    { StyleNumber: '470CB', Brand: 'Specialty', ProductName: 'Velcro Strap Cap', Category: 'Caps', DefaultCost: 10.00, DefaultSellPrice: 20.00, VendorCode: 'SPEC' },
    { StyleNumber: '2375', Brand: 'Badger', ProductName: 'Pacesetter Hoodie', Category: 'Sweatshirts', DefaultCost: 28.00, DefaultSellPrice: 56.00, VendorCode: 'SPEC' },
    { StyleNumber: 'STK-GLS-SQR', Brand: 'Sticker Mule', ProductName: '2.5" Glossy Sticker', Category: 'Stickers', DefaultCost: 0.50, DefaultSellPrice: 1.50, VendorCode: 'SPEC' },

    // From ShopWorks (VendorCode: OTHER)
    { StyleNumber: 'CE701', Brand: 'Core 365', ProductName: 'Fleece Bonded Vest', Category: 'Vests', DefaultCost: 35.00, DefaultSellPrice: 70.00, VendorCode: 'OTHER' },
    { StyleNumber: 'BA920', Brand: 'Bayside', ProductName: 'Quarter-Zip Pullover', Category: 'Sweatshirts', DefaultCost: 25.00, DefaultSellPrice: 50.00, VendorCode: 'OTHER' }
];

// ============================================
// HELPER FUNCTIONS
// ============================================

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function postServiceCode(record) {
    const response = await fetch(`${API_BASE_URL}/api/service-codes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(record)
    });

    const data = await response.json();
    return { status: response.status, data };
}

async function postProduct(record) {
    const response = await fetch(`${API_BASE_URL}/api/non-sanmar-products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(record)
    });

    const data = await response.json();
    return { status: response.status, data };
}

// ============================================
// FETCH EXISTING DATA
// ============================================

async function fetchExistingServiceCodes() {
    const response = await fetch(`${API_BASE_URL}/api/service-codes?refresh=true`);
    const result = await response.json();
    if (!result.success) throw new Error('Failed to fetch service codes');

    // Build set of existing codes (ServiceCode + TierLabel)
    const existing = new Set();
    for (const sc of result.data) {
        existing.add(`${sc.ServiceCode}|${sc.TierLabel || ''}`);
    }
    return existing;
}

async function fetchExistingProducts() {
    const response = await fetch(`${API_BASE_URL}/api/non-sanmar-products?refresh=true`);
    const result = await response.json();
    if (!result.success) throw new Error('Failed to fetch products');

    // Build set of existing StyleNumbers
    const existing = new Set();
    for (const p of result.data) {
        existing.add(p.StyleNumber);
    }
    return existing;
}

// ============================================
// MAIN EXECUTION
// ============================================

async function main() {
    console.log('='.repeat(60));
    console.log('SEEDING CLASSIFIED ITEMS TO CASPIO');
    console.log(`API: ${API_BASE_URL}`);
    console.log('='.repeat(60));
    console.log('');

    const results = {
        serviceCodes: { inserted: 0, skipped: 0, failed: 0, errors: [] },
        products: { inserted: 0, skipped: 0, failed: 0, errors: [] }
    };

    // ========== FETCH EXISTING DATA ==========
    console.log('Fetching existing data to avoid duplicates...');
    let existingServiceCodes, existingProducts;

    try {
        existingServiceCodes = await fetchExistingServiceCodes();
        console.log(`  Found ${existingServiceCodes.size} existing service codes`);
    } catch (err) {
        console.log(`  ERROR fetching service codes: ${err.message}`);
        existingServiceCodes = new Set();
    }

    await sleep(1500);

    try {
        existingProducts = await fetchExistingProducts();
        console.log(`  Found ${existingProducts.size} existing products`);
    } catch (err) {
        console.log(`  ERROR fetching products: ${err.message}`);
        existingProducts = new Set();
    }

    console.log('');

    // ========== SERVICE CODES ==========
    console.log('--- SERVICE CODES ---');
    console.log(`Processing ${SERVICE_CODES.length} service codes...`);
    console.log('');

    for (const code of SERVICE_CODES) {
        const key = `${code.ServiceCode}|${code.TierLabel || ''}`;

        // Skip if already exists
        if (existingServiceCodes.has(key)) {
            results.serviceCodes.skipped++;
            console.log(`  ○ ${code.ServiceCode} - already exists`);
            continue;
        }

        try {
            const { status, data } = await postServiceCode(code);

            if (status === 201) {
                results.serviceCodes.inserted++;
                existingServiceCodes.add(key); // Track newly inserted
                console.log(`  ✓ ${code.ServiceCode} - ${code.DisplayName}`);
            } else if (status === 409 || (data.error && data.error.includes('duplicate'))) {
                results.serviceCodes.skipped++;
                console.log(`  ○ ${code.ServiceCode} - already exists`);
            } else {
                results.serviceCodes.failed++;
                results.serviceCodes.errors.push({ code: code.ServiceCode, error: data.error || data.details });
                console.log(`  ✗ ${code.ServiceCode} - FAILED: ${data.error || data.details}`);
            }
        } catch (err) {
            results.serviceCodes.failed++;
            results.serviceCodes.errors.push({ code: code.ServiceCode, error: err.message });
            console.log(`  ✗ ${code.ServiceCode} - ERROR: ${err.message}`);
        }

        // Delay to avoid rate limiting (1.5s between requests)
        await sleep(1500);
    }

    console.log('');
    console.log(`Service codes: ${results.serviceCodes.inserted} inserted, ${results.serviceCodes.skipped} skipped, ${results.serviceCodes.failed} failed`);
    console.log('');

    // ========== NON-SANMAR PRODUCTS ==========
    console.log('--- NON-SANMAR PRODUCTS ---');
    console.log(`Processing ${NON_SANMAR_PRODUCTS.length} products...`);
    console.log('');

    for (const product of NON_SANMAR_PRODUCTS) {
        // Skip if already exists
        if (existingProducts.has(product.StyleNumber)) {
            results.products.skipped++;
            console.log(`  ○ ${product.StyleNumber} - already exists`);
            continue;
        }

        try {
            const { status, data } = await postProduct(product);

            if (status === 201) {
                results.products.inserted++;
                existingProducts.add(product.StyleNumber); // Track newly inserted
                console.log(`  ✓ ${product.StyleNumber} - ${product.Brand} ${product.ProductName}`);
            } else if (status === 409 || (data.error && data.error.includes('duplicate'))) {
                results.products.skipped++;
                console.log(`  ○ ${product.StyleNumber} - already exists`);
            } else {
                results.products.failed++;
                results.products.errors.push({ style: product.StyleNumber, error: data.error || data.details });
                console.log(`  ✗ ${product.StyleNumber} - FAILED: ${data.error || data.details}`);
            }
        } catch (err) {
            results.products.failed++;
            results.products.errors.push({ style: product.StyleNumber, error: err.message });
            console.log(`  ✗ ${product.StyleNumber} - ERROR: ${err.message}`);
        }

        // Delay to avoid rate limiting (1.5s between requests)
        await sleep(1500);
    }

    console.log('');
    console.log(`Products: ${results.products.inserted} inserted, ${results.products.skipped} skipped, ${results.products.failed} failed`);
    console.log('');

    // ========== SUMMARY ==========
    console.log('='.repeat(60));
    console.log('SUMMARY');
    console.log('='.repeat(60));
    console.log(`Service Codes: ${results.serviceCodes.inserted}/${SERVICE_CODES.length} inserted`);
    console.log(`Products: ${results.products.inserted}/${NON_SANMAR_PRODUCTS.length} inserted`);

    const totalFailed = results.serviceCodes.failed + results.products.failed;
    if (totalFailed > 0) {
        console.log('');
        console.log('ERRORS:');
        for (const err of results.serviceCodes.errors) {
            console.log(`  - Service code ${err.code}: ${err.error}`);
        }
        for (const err of results.products.errors) {
            console.log(`  - Product ${err.style}: ${err.error}`);
        }
    }

    console.log('');
    console.log('Done!');
}

main().catch(console.error);
