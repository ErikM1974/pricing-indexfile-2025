/**
 * 2025 Embroidery Orders CSV Validation Script
 *
 * Analyzes 6,222 line items from embroidery orders to determine which can be
 * priced using the embroidery quote builder and Service_Codes pricing system.
 *
 * Categories:
 * - SERVICE_CODE: Items matching known service codes (priceable via API)
 * - SANMAR: Products in SanMar Bulk CSV (priceable via API)
 * - RICHARDSON_FD: Richardson Factory Direct products (priceable via calculator)
 * - NON_SANMAR: Products from other vendors (need manual lookup)
 * - ODDBALL: Cannot classify (typos, free-text, comments)
 * - SKIP: Empty/comment rows
 *
 * Run: node tests/validation/validate-2025-orders.js
 */

const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');

// File paths
const ORDERS_CSV_PATH = 'C:\\Users\\erik\\Downloads\\embroidery orders raw data 2025.csv';
const SANMAR_CSV_PATH = 'C:\\Users\\erik\\Downloads\\Sanmar_Bulk_251816_Feb2024_2026-Feb-01_1317.csv';
const OUTPUT_PATH = path.join(__dirname, '2025-orders-validation-report.json');

// API endpoint for service codes
const API_BASE = 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';

// Known service code patterns
const SERVICE_CODE_PATTERNS = {
    exact: [
        'DECG',      // Direct embroider customer garment
        'DECC',      // Direct embroider customer cap
        'AL',        // Additional logo
        'DD',        // Digitizing Setup
        'DDE',       // Edit Digitizing
        'DDT',       // Text Digitizing Setup
        'DD-CAP',    // Digitizing Setup CAP
        'FB',        // Full back
        'LTM',       // Less than minimum
        'GRT-50',    // Setup fee $50
        'GRT-75',    // Setup fee $75
        'RUSH',      // Rush fee
        'ART',       // Art/design fee
        'EJB',       // Full back alias
        'Name/Number', // Name & Number ($15)
        'NAME',      // Name personalization (legacy)
        'MONOGRAM',  // Monogram personalization
        // Screen print service codes
        'SPRESET',   // Screen Reset Charge
        'SPSU',      // New Screen Set Up
        'FILM',      // Film Output Fee
        'PMS',       // PMS Color Match
        // Other
        'MBF'        // Lines beyond 10 charge
    ],
    prefixed: [
        'DGT-',      // DGT-001, DGT-002, etc. digitizing fees (legacy, being deprecated)
        'MONOGRAM',  // Monogram variants
        'Name/Number', // Name & Number variants
        'NAME'       // Name variants (legacy)
    ],
    aliases: {
        'AONOGRAM': 'Monogram',
        'NNAME': 'Name',
        'EJB': 'FB',
        'SETUP': 'GRT-50',
        'SETUP ': 'GRT-50',
        'Setup ': 'GRT-50',
        'Setup': 'GRT-50',
        'LTM752': 'LTM',
        'LTM754': 'LTM'
    }
};

/**
 * Load SanMar product styles from bulk CSV
 * @returns {Set<string>} Set of product IDs (style numbers)
 */
function loadSanmarStyles() {
    console.log('Loading SanMar Bulk CSV...');
    const content = fs.readFileSync(SANMAR_CSV_PATH, 'utf-8');
    const records = parse(content, {
        columns: true,
        skip_empty_lines: true,
        relax_column_count: true,
        bom: true  // Handle UTF-8 BOM
    });

    const styles = new Set();
    for (const row of records) {
        // Bulk CSV uses STYLE column, Integration CSV uses ID_Product
        const productId = (row.STYLE || row.ID_Product || '').trim();
        if (productId) {
            // Add the full product ID (includes size suffix)
            styles.add(productId.toUpperCase());

            // Also add the base style without size suffix (includes tall sizes)
            const baseStyle = productId.replace(/_(2X|3X|4X|5X|6X|XS|XXL|LT|XLT|2XLT|3XLT|4XLT|5XLT|XLR|LR|SR|MR|OSFA|S\/M|L\/XL|M\/L|NB)$/i, '');
            styles.add(baseStyle.toUpperCase());
        }
    }

    console.log(`  Loaded ${styles.size} unique SanMar styles/SKUs`);
    return styles;
}

/**
 * Load Richardson Factory Direct styles (not in SanMar)
 * Source: calculators/richardson-factory-direct.js
 * @returns {Set<string>} Set of Richardson style numbers
 */
function loadRichardsonFactoryDirectStyles() {
    console.log('Loading Richardson Factory Direct styles...');
    // Complete list from calculators/richardson-factory-direct.js (154 styles)
    // Note: Some overlap with SanMar (112, 112FP, 112FPR, 112PFP, 112PL, 112PT)
    // Richardson FD check is done AFTER SanMar check, so overlapping styles go to SanMar
    const factoryDirectStyles = [
        // PTS and R series (accessories/beanies)
        'PTS20M', 'PTS205', 'PTS30S', 'PTS50S', 'PTS65',
        'R15', 'R18', 'R20', 'R22', 'R45', 'R55', 'R65S', 'R75S',
        // 100 series (truckers, beanies)
        '110', '111', '111P', '111PT', '111T',
        '112', '112FP', '112FPC', '112FPR', '112PT', '112T', '112P', '112PFP', '112PM',
        '112+', '112RE', '112WF', '112WH', '112LN',
        '113', '115', '115CH', '121', '126', '130', '134', '135', '137', '139RE',
        '141', '143', '145', '146', '147', '148', '149', '154', '157',
        '160', '163', '168', '168P', '169', '172', '173', '176', '185',
        // 200 series (dad hats, structured caps)
        '203', '212', '213', '214', '217', '220', '222', '224RE', '225',
        '252', '252L', '253', '254RE', '255', '256', '256P', '257', '258', '262',
        // 300 series (canvas, pigment dyed)
        '309', '312', '320T', '323FPC', '324', '324RE', '326', '336', '355', '380', '382',
        // 400-500 series (pro mesh, officials, flatbills)
        '414', '420', '435', '436', '485', '487', '495',
        '510', '511', '512', '514', '525', '530', '533', '535', '540', '543', '545', '550', '585',
        // 600 series (umpire caps)
        '632', '633', '634', '643', '653',
        // 700 series (visors, officials)
        '707', '709', '712', '715', '733', '740', '743', '753', '785', '787',
        // 800 series (wide brim, straw, camo)
        '810', '822', '824', '827', '828', '835', '840', '843',
        '862', '863', '865', '870', '874', '882', '882FP', '884',
        // 900 series (specialty outdoor)
        '909', '910', '930', '931', '932', '933', '934', '935', '937', '938', '939', '942', '943'
    ];
    const styles = new Set(factoryDirectStyles.map(s => s.toUpperCase()));
    console.log(`  Loaded ${styles.size} Richardson Factory Direct styles`);
    return styles;
}

/**
 * Check if a part number matches a Richardson Factory Direct product
 * @param {string} partNumber - The part number to check
 * @param {Set<string>} richardsonStyles - Richardson Factory Direct styles
 * @returns {{ isMatch: boolean, style?: string, sku?: string }}
 */
function matchRichardsonFactoryDirect(partNumber, richardsonStyles) {
    const normalized = partNumber.toUpperCase().trim();

    // Direct match
    if (richardsonStyles.has(normalized)) {
        return { isMatch: true, style: normalized, sku: partNumber };
    }

    // Try stripping size suffix (fitted caps have SM/MD, LG/XL, M/L sizes)
    const baseStyle = normalized.replace(/_(SM\/MD|LG\/XL|MG-LG|S\/M|M\/L|L\/XL|OSFA|2X|3X)$/i, '');
    if (richardsonStyles.has(baseStyle)) {
        return { isMatch: true, style: baseStyle, sku: partNumber };
    }

    // Try stripping "C" prefix (C110 = 110 cap)
    if (normalized.startsWith('C') && normalized.length > 2) {
        const withoutC = normalized.substring(1);
        if (richardsonStyles.has(withoutC)) {
            return { isMatch: true, style: withoutC, sku: partNumber };
        }
        // Also try stripping size suffix after removing C prefix
        const baseWithoutC = withoutC.replace(/_(SM\/MD|LG\/XL|MG-LG|S\/M|M\/L|L\/XL|OSFA)$/i, '');
        if (richardsonStyles.has(baseWithoutC)) {
            return { isMatch: true, style: baseWithoutC, sku: partNumber };
        }
    }

    // Try stripping trailing special characters (110+ = 110 with embroidery)
    const cleanedStyle = normalized.replace(/[+*#]+$/, '');
    if (cleanedStyle !== normalized && richardsonStyles.has(cleanedStyle)) {
        return { isMatch: true, style: cleanedStyle, sku: partNumber };
    }

    return { isMatch: false };
}

/**
 * Fetch service codes from API
 * @returns {Promise<Set<string>>} Set of service codes
 */
async function fetchServiceCodes() {
    console.log('Fetching service codes from API...');
    try {
        const fetch = require('node-fetch');
        const response = await fetch(`${API_BASE}/api/service-codes`);

        if (!response.ok) {
            throw new Error(`API returned ${response.status}`);
        }

        const result = await response.json();
        const codes = new Set();

        // API returns {success: true, data: [...]} with ServiceCode field
        const data = result.data || result;
        if (Array.isArray(data)) {
            for (const item of data) {
                const code = (item.ServiceCode || item.Service_Code || item.code || '').trim().toUpperCase();
                if (code) {
                    codes.add(code);
                }
            }
        }

        console.log(`  Fetched ${codes.size} service codes from API`);
        return codes;
    } catch (error) {
        console.warn(`  Warning: Could not fetch service codes from API: ${error.message}`);
        console.log('  Using built-in service code patterns only');
        return new Set(SERVICE_CODE_PATTERNS.exact.map(c => c.toUpperCase()));
    }
}

/**
 * Load and parse orders CSV
 * @returns {Array} Array of order line item records
 */
function loadOrders() {
    console.log('Loading orders CSV...');
    const content = fs.readFileSync(ORDERS_CSV_PATH, 'utf-8');
    const records = parse(content, {
        columns: true,
        skip_empty_lines: true,
        relax_column_count: true
    });

    console.log(`  Loaded ${records.length} line items`);
    return records;
}

/**
 * Group line items by order ID
 * @param {Array} records - Line item records
 * @returns {Map<string, Array>} Order ID to line items
 */
function groupByOrder(records) {
    const orderGroups = new Map();

    for (const row of records) {
        const orderId = row.id_Order || 'UNKNOWN';
        if (!orderGroups.has(orderId)) {
            orderGroups.set(orderId, []);
        }
        orderGroups.get(orderId).push(row);
    }

    console.log(`  Found ${orderGroups.size} unique orders`);
    return orderGroups;
}

/**
 * Check if a part number matches a service code pattern
 * @param {string} partNumber - The part number to check
 * @param {Set<string>} apiServiceCodes - Service codes from API
 * @returns {{ isMatch: boolean, code: string, original?: string }}
 */
function matchServiceCode(partNumber, apiServiceCodes) {
    const normalized = partNumber.toUpperCase().trim();

    // Check API service codes first (exact match)
    if (apiServiceCodes.has(normalized)) {
        return { isMatch: true, code: normalized };
    }

    // Check built-in exact matches
    for (const code of SERVICE_CODE_PATTERNS.exact) {
        if (normalized === code.toUpperCase()) {
            return { isMatch: true, code };
        }
    }

    // Check prefixed patterns
    for (const prefix of SERVICE_CODE_PATTERNS.prefixed) {
        if (normalized.startsWith(prefix.toUpperCase())) {
            return { isMatch: true, code: normalized };
        }
    }

    // Check aliases
    for (const [alias, canonical] of Object.entries(SERVICE_CODE_PATTERNS.aliases)) {
        if (normalized === alias.toUpperCase() || normalized.startsWith(alias.toUpperCase())) {
            return { isMatch: true, code: canonical, original: partNumber };
        }
    }

    return { isMatch: false };
}

/**
 * Check if a part number matches a SanMar product
 * @param {string} partNumber - The part number to check
 * @param {Set<string>} sanmarStyles - SanMar product styles
 * @returns {{ isMatch: boolean, style?: string, sku?: string, note?: string }}
 */
function matchSanmarProduct(partNumber, sanmarStyles) {
    const normalized = partNumber.toUpperCase().trim();

    // Direct match
    if (sanmarStyles.has(normalized)) {
        return { isMatch: true, style: normalized, sku: partNumber };
    }

    // Try stripping size suffix (includes tall sizes like 3XLT, 4XLT and tall regular XLR, LR)
    const baseStyle = normalized.replace(/_(2X|3X|4X|5X|6X|XS|XXL|LT|XLT|2XLT|3XLT|4XLT|5XLT|XLR|LR|SR|MR|OSFA|S\/M|L\/XL|M\/L|NB)$/i, '');
    if (sanmarStyles.has(baseStyle)) {
        return { isMatch: true, style: baseStyle, sku: partNumber };
    }

    // Try adding _OSFA suffix (for caps)
    if (sanmarStyles.has(normalized + '_OSFA')) {
        return { isMatch: true, style: normalized + '_OSFA', sku: partNumber };
    }

    // Try stripping "C" prefix (common for caps: C112 = 112 cap)
    if (normalized.startsWith('C') && normalized.length > 2) {
        const withoutC = normalized.substring(1);
        if (sanmarStyles.has(withoutC)) {
            return { isMatch: true, style: withoutC, sku: partNumber, note: 'C prefix stripped' };
        }
        if (sanmarStyles.has(withoutC + '_OSFA')) {
            return { isMatch: true, style: withoutC + '_OSFA', sku: partNumber, note: 'C prefix stripped, OSFA added' };
        }
    }

    // Try with base style + _OSFA
    if (sanmarStyles.has(baseStyle + '_OSFA')) {
        return { isMatch: true, style: baseStyle + '_OSFA', sku: partNumber };
    }

    // Try stripping trailing special characters (112+ = 112 with embroidery)
    const cleanedStyle = normalized.replace(/[+*#]+$/, '');
    if (cleanedStyle !== normalized) {
        if (sanmarStyles.has(cleanedStyle)) {
            return { isMatch: true, style: cleanedStyle, sku: partNumber, note: 'Special chars stripped' };
        }
        if (sanmarStyles.has(cleanedStyle + '_OSFA')) {
            return { isMatch: true, style: cleanedStyle + '_OSFA', sku: partNumber, note: 'Special chars stripped, OSFA added' };
        }
    }

    return { isMatch: false };
}

/**
 * Import the known vendors module
 */
const { identifyNonSanmarVendor } = require('./known-vendors');

/**
 * Identify the type of oddball for better categorization
 * @param {string} partNumber - The part number
 * @param {string} description - The description
 * @returns {string} Oddball type
 */
function identifyOddballType(partNumber, description) {
    const pn = (partNumber || '').toUpperCase();
    const desc = (description || '').toLowerCase();

    // Shipping/weight entries
    if (pn === 'WEIGHT' || desc.includes('weight') || desc.includes('shipping')) {
        return 'shipping';
    }

    // McKenzie/catalog items (MQK, MCK prefixes)
    if (pn.startsWith('MQK') || pn.startsWith('MCK')) {
        return 'mckenzie_catalog';
    }

    // Legacy/discontinued styles (check for common patterns)
    if (/^[A-Z]{1,3}\d{3,4}$/.test(pn)) {
        return 'possible_legacy_style';
    }

    // Custom product codes
    if (pn.includes('CB') || pn.includes('SPSU') || pn.includes('PTS')) {
        return 'custom_product_code';
    }

    // Size variants with non-standard suffixes
    if (/_SM\/|_LG\/|_MD\//.test(pn)) {
        return 'non_standard_size_suffix';
    }

    // Free-text descriptions
    if (desc && !pn) {
        return 'description_only';
    }

    return 'unknown';
}

/**
 * Classify a single line item
 * @param {Object} row - Line item record
 * @param {Set<string>} serviceCodes - Service codes from API
 * @param {Set<string>} sanmarStyles - SanMar product styles
 * @param {Set<string>} richardsonStyles - Richardson Factory Direct styles
 * @returns {Object} Classification result
 */
function classifyLineItem(row, serviceCodes, sanmarStyles, richardsonStyles) {
    const partNumber = (row.PartNumber || '').trim();
    const description = (row.PartDescriptionUnits || '').trim();

    // Skip empty or comment rows
    if (!partNumber) {
        // Check if it looks like a comment/header row
        if (description && (description.startsWith('#') || description.includes('Logo') && !partNumber)) {
            return { category: 'SKIP', reason: 'Comment/header row', description };
        }
        return { category: 'SKIP', reason: 'Empty PartNumber' };
    }

    // Skip obvious comment markers
    if (partNumber.startsWith('#') || partNumber.startsWith('//')) {
        return { category: 'SKIP', reason: 'Comment marker', partNumber };
    }

    // Check service codes first (highest priority)
    const serviceMatch = matchServiceCode(partNumber, serviceCodes);
    if (serviceMatch.isMatch) {
        return {
            category: 'SERVICE_CODE',
            code: serviceMatch.code,
            original: serviceMatch.original || partNumber
        };
    }

    // Check SanMar products (second priority)
    const sanmarMatch = matchSanmarProduct(partNumber, sanmarStyles);
    if (sanmarMatch.isMatch) {
        return {
            category: 'SANMAR',
            style: sanmarMatch.style,
            sku: sanmarMatch.sku
        };
    }

    // Check Richardson Factory Direct (third priority - not in SanMar)
    const richardsonMatch = matchRichardsonFactoryDirect(partNumber, richardsonStyles);
    if (richardsonMatch.isMatch) {
        return {
            category: 'RICHARDSON_FD',
            style: richardsonMatch.style,
            sku: richardsonMatch.sku
        };
    }

    // Check non-SanMar known vendors (fourth priority)
    const vendorMatch = identifyNonSanmarVendor(partNumber);
    if (vendorMatch) {
        return {
            category: 'NON_SANMAR',
            vendor: vendorMatch.vendor,
            productType: vendorMatch.productType,
            sku: partNumber
        };
    }

    // Oddball - cannot classify but try to identify pattern
    const oddballType = identifyOddballType(partNumber, description);
    return {
        category: 'ODDBALL',
        partNumber,
        description,
        oddballType
    };
}

/**
 * Sum quantities across all size columns
 * @param {Object} row - Line item record
 * @returns {number} Total quantity
 */
function sumQuantities(row) {
    let total = 0;
    for (let i = 1; i <= 6; i++) {
        const val = parseFloat(row[`Size0${i}_Req`] || 0);
        if (!isNaN(val)) {
            total += val;
        }
    }
    return total;
}

/**
 * Analyze all orders and generate report
 * @param {Map<string, Array>} orderGroups - Orders grouped by ID
 * @param {Set<string>} serviceCodes - Service codes from API
 * @param {Set<string>} sanmarStyles - SanMar product styles
 * @param {Set<string>} richardsonStyles - Richardson Factory Direct styles
 * @returns {Object} Full analysis report
 */
function analyzeOrders(orderGroups, serviceCodes, sanmarStyles, richardsonStyles) {
    console.log('Analyzing orders...');

    const report = {
        generatedAt: new Date().toISOString(),
        summary: {
            totalOrders: 0,
            fullyPriceable: 0,
            partiallyPriceable: 0,
            unpriceable: 0,
            totalLineItems: 0,
            priceableItems: 0,
            richardsonFdItems: 0,
            manualLookupItems: 0,
            oddballItems: 0,
            skippedItems: 0
        },
        serviceCodeUsage: {},
        topSanmarStyles: [],
        topRichardsonStyles: [],
        oddballs: [],
        oddballsByType: {},
        nonSanmarProducts: {},
        orders: []
    };

    // Track unique values for aggregation
    const sanmarStyleCounts = new Map();
    const richardsonStyleCounts = new Map();
    const oddballCounts = new Map();
    const oddballTypeCounts = new Map();
    const nonSanmarVendorStyles = new Map();

    for (const [orderId, lineItems] of orderGroups) {
        report.summary.totalOrders++;

        const orderSummary = {
            orderId,
            totalItems: lineItems.length,
            priceable: 0,
            needsManualLookup: 0,
            oddballs: 0,
            skipped: 0,
            items: []
        };

        for (const item of lineItems) {
            report.summary.totalLineItems++;

            const classification = classifyLineItem(item, serviceCodes, sanmarStyles, richardsonStyles);
            const quantity = sumQuantities(item);

            const itemSummary = {
                partNumber: item.PartNumber || '',
                quantity,
                category: classification.category,
                ...classification
            };

            orderSummary.items.push(itemSummary);

            switch (classification.category) {
                case 'SERVICE_CODE':
                    orderSummary.priceable++;
                    report.summary.priceableItems++;

                    // Track service code usage
                    const code = classification.code.toUpperCase();
                    if (!report.serviceCodeUsage[code]) {
                        report.serviceCodeUsage[code] = { count: 0, totalQuantity: 0 };
                    }
                    report.serviceCodeUsage[code].count++;
                    report.serviceCodeUsage[code].totalQuantity += quantity;
                    break;

                case 'SANMAR':
                    orderSummary.priceable++;
                    report.summary.priceableItems++;

                    // Track SanMar style usage
                    const style = classification.style;
                    sanmarStyleCounts.set(style, (sanmarStyleCounts.get(style) || 0) + 1);
                    break;

                case 'RICHARDSON_FD':
                    orderSummary.priceable++;
                    report.summary.priceableItems++;
                    report.summary.richardsonFdItems++;

                    // Track Richardson Factory Direct style usage
                    const richStyle = classification.style;
                    richardsonStyleCounts.set(richStyle, (richardsonStyleCounts.get(richStyle) || 0) + 1);
                    break;

                case 'NON_SANMAR':
                    orderSummary.needsManualLookup++;
                    report.summary.manualLookupItems++;

                    // Track non-SanMar vendor styles
                    const vendor = classification.vendor;
                    if (!nonSanmarVendorStyles.has(vendor)) {
                        nonSanmarVendorStyles.set(vendor, new Set());
                    }
                    nonSanmarVendorStyles.get(vendor).add(classification.sku);
                    break;

                case 'ODDBALL':
                    orderSummary.oddballs++;
                    report.summary.oddballItems++;

                    // Track oddball patterns
                    const key = classification.partNumber || '[empty]';
                    oddballCounts.set(key, (oddballCounts.get(key) || 0) + 1);

                    // Track oddball types
                    const oddType = classification.oddballType || 'unknown';
                    oddballTypeCounts.set(oddType, (oddballTypeCounts.get(oddType) || 0) + 1);
                    break;

                case 'SKIP':
                    orderSummary.skipped++;
                    report.summary.skippedItems++;
                    break;
            }
        }

        // Determine order priceability
        const effectiveItems = orderSummary.totalItems - orderSummary.skipped;
        if (effectiveItems === 0) {
            // All items were skipped (comments only)
            report.summary.unpriceable++;
        } else if (orderSummary.oddballs === 0 && orderSummary.needsManualLookup === 0) {
            orderSummary.canFullyPrice = true;
            report.summary.fullyPriceable++;
        } else if (orderSummary.priceable > 0) {
            orderSummary.canFullyPrice = false;
            report.summary.partiallyPriceable++;
        } else {
            orderSummary.canFullyPrice = false;
            report.summary.unpriceable++;
        }

        report.orders.push(orderSummary);
    }

    // Build top SanMar styles list
    report.topSanmarStyles = Array.from(sanmarStyleCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 50)
        .map(([style, count]) => ({ style, count }));

    // Build top Richardson Factory Direct styles list
    report.topRichardsonStyles = Array.from(richardsonStyleCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 20)
        .map(([style, count]) => ({ style, count }));

    // Build oddballs list
    report.oddballs = Array.from(oddballCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([partNumber, count]) => ({ partNumber, count }));

    // Build oddballs by type
    for (const [type, count] of oddballTypeCounts) {
        report.oddballsByType[type] = count;
    }

    // Build non-SanMar products summary
    for (const [vendor, styles] of nonSanmarVendorStyles) {
        report.nonSanmarProducts[vendor] = {
            styles: Array.from(styles),
            count: styles.size
        };
    }

    // Calculate average quantities for service codes
    for (const code in report.serviceCodeUsage) {
        const usage = report.serviceCodeUsage[code];
        usage.avgQuantity = Math.round((usage.totalQuantity / usage.count) * 10) / 10;
    }

    return report;
}

/**
 * Print summary to console
 * @param {Object} report - Analysis report
 */
function printSummary(report) {
    console.log('\n========================================');
    console.log('2025 EMBROIDERY ORDERS VALIDATION REPORT');
    console.log('========================================\n');

    const s = report.summary;
    console.log('OVERALL SUMMARY:');
    console.log(`  Total Orders: ${s.totalOrders}`);
    console.log(`  Fully Priceable: ${s.fullyPriceable} (${(s.fullyPriceable / s.totalOrders * 100).toFixed(1)}%)`);
    console.log(`  Partially Priceable: ${s.partiallyPriceable} (${(s.partiallyPriceable / s.totalOrders * 100).toFixed(1)}%)`);
    console.log(`  Unpriceable: ${s.unpriceable} (${(s.unpriceable / s.totalOrders * 100).toFixed(1)}%)`);
    console.log('');
    console.log('LINE ITEM BREAKDOWN:');
    console.log(`  Total Line Items: ${s.totalLineItems}`);
    console.log(`  Priceable (Service + SanMar + Richardson): ${s.priceableItems} (${(s.priceableItems / s.totalLineItems * 100).toFixed(1)}%)`);
    console.log(`    - Richardson Factory Direct: ${s.richardsonFdItems}`);
    console.log(`  Manual Lookup Needed: ${s.manualLookupItems} (${(s.manualLookupItems / s.totalLineItems * 100).toFixed(1)}%)`);
    console.log(`  Oddballs: ${s.oddballItems} (${(s.oddballItems / s.totalLineItems * 100).toFixed(1)}%)`);
    console.log(`  Skipped (empty/comments): ${s.skippedItems} (${(s.skippedItems / s.totalLineItems * 100).toFixed(1)}%)`);

    console.log('\nSERVICE CODE USAGE (Top 10):');
    const sortedCodes = Object.entries(report.serviceCodeUsage)
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 10);
    for (const [code, usage] of sortedCodes) {
        console.log(`  ${code}: ${usage.count} uses, avg qty: ${usage.avgQuantity}`);
    }

    console.log('\nTOP SANMAR STYLES (Top 10):');
    for (const item of report.topSanmarStyles.slice(0, 10)) {
        console.log(`  ${item.style}: ${item.count} orders`);
    }

    if (report.topRichardsonStyles.length > 0) {
        console.log('\nTOP RICHARDSON FACTORY DIRECT STYLES:');
        for (const item of report.topRichardsonStyles.slice(0, 10)) {
            console.log(`  ${item.style}: ${item.count} orders`);
        }
    }

    if (Object.keys(report.nonSanmarProducts).length > 0) {
        console.log('\nNON-SANMAR PRODUCTS:');
        for (const [vendor, data] of Object.entries(report.nonSanmarProducts)) {
            console.log(`  ${vendor}: ${data.count} styles - ${data.styles.slice(0, 5).join(', ')}${data.styles.length > 5 ? '...' : ''}`);
        }
    }

    if (report.oddballs.length > 0) {
        console.log('\nODDBALL TYPES:');
        for (const [type, count] of Object.entries(report.oddballsByType).sort((a, b) => b[1] - a[1])) {
            console.log(`  ${type}: ${count}`);
        }

        console.log('\nODDBALLS (Top 15 - Need Manual Review):');
        for (const item of report.oddballs.slice(0, 15)) {
            console.log(`  "${item.partNumber}": ${item.count} occurrences`);
        }
    }

    console.log('\n========================================');
    console.log(`Report saved to: ${OUTPUT_PATH}`);
    console.log('========================================\n');
}

/**
 * Main execution
 */
async function main() {
    console.log('Starting 2025 Embroidery Orders Validation...\n');

    try {
        // Load data sources
        const sanmarStyles = loadSanmarStyles();
        const richardsonStyles = loadRichardsonFactoryDirectStyles();
        const serviceCodes = await fetchServiceCodes();
        const orders = loadOrders();
        const orderGroups = groupByOrder(orders);

        // Analyze orders
        const report = analyzeOrders(orderGroups, serviceCodes, sanmarStyles, richardsonStyles);

        // Save report
        fs.writeFileSync(OUTPUT_PATH, JSON.stringify(report, null, 2));

        // Print summary
        printSummary(report);

    } catch (error) {
        console.error('Error during validation:', error);
        process.exit(1);
    }
}

main();
