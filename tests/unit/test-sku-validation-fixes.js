/**
 * Test SKU Validation Fixes
 * Verifies XXL_STYLES, lowercase suffixes, and infant sizes work correctly
 *
 * Run: node tests/unit/test-sku-validation-fixes.js
 */

const fs = require('fs');
const path = require('path');

// Read the service file
const servicePath = path.join(__dirname, '../../shared_components/js/sku-validation-service.js');
let serviceCode = fs.readFileSync(servicePath, 'utf8');

// Remove browser-specific code
serviceCode = serviceCode.replace(/window\.skuValidationService\s*=.*/g, '');
serviceCode = serviceCode.replace(/if\s*\(\s*typeof\s+module\s*!==\s*'undefined'.*\{[\s\S]*?\}/g, '');

// Create the class using Function constructor
const createClass = new Function(serviceCode + '; return SKUValidationService;');
const ServiceClass = createClass();
const service = new ServiceClass();

// Test cases
const tests = [
    // ==============================================
    // XXL_STYLES tests (should return _XXL not _2X)
    // ==============================================
    { style: 'L500', size: 'XXL', expected: 'L500_XXL', note: 'Ladies Silk Touch' },
    { style: 'LPC54', size: 'XXL', expected: 'LPC54_XXL', note: 'Ladies Core Tee' },
    { style: 'LST104', size: 'XXL', expected: 'LST104_XXL', note: 'Ladies Sport-Tek' },
    { style: 'DT5001', size: 'XXL', expected: 'DT5001_XXL', note: 'District Perfect Weight' },
    { style: 'CS411', size: 'XXL', expected: 'CS411_XXL', note: 'Cornerstone' },
    { style: 'RH79', size: 'XXL', expected: 'RH79_XXL', note: 'Red House' },
    { style: 'OR322226', size: 'XXL', expected: 'OR322226_XXL', note: 'Outdoor Research' },

    // ==============================================
    // Non-XXL products (should return _2X)
    // ==============================================
    { style: 'PC54', size: 'XXL', expected: 'PC54_2X', note: 'Unisex tee - normal _2X' },
    { style: 'G500', size: 'XXL', expected: 'G500_2X', note: 'Gildan - normal _2X' },
    { style: 'ST350', size: 'XXL', expected: 'ST350_2X', note: 'Sport-Tek (not Ladies)' },

    // ==============================================
    // Lowercase suffix tests
    // ==============================================
    { style: 'WW3150S', size: 'SS', expected: 'WW3150S_ss', note: 'Lowercase _ss' },
    { style: 'WW3150S', size: 'ss', expected: 'WW3150S_ss', note: 'Lowercase input' },
    { style: 'OR322226', size: 'XXXL', expected: 'OR322226_xxxl', note: 'Lowercase _xxxl' },
    { style: 'OR322227', size: 'XXXL', expected: 'OR322227_xxxl', note: 'Lowercase _xxxl' },

    // Other products should use uppercase XXXL → _3X
    { style: 'PC54', size: 'XXXL', expected: 'PC54_3X', note: 'Normal XXXL → _3X' },

    // ==============================================
    // Infant sizes (new 4-digit with leading zeros)
    // ==============================================
    { style: 'BC100B', size: '0003', expected: 'BC100B_0003', note: '0-3 months' },
    { style: 'BC100B', size: '0306', expected: 'BC100B_0306', note: '3-6 months (4-digit)' },
    { style: 'BC100B', size: '0612', expected: 'BC100B_0612', note: '6-12 months (4-digit)' },
    { style: 'BC100B', size: '1218', expected: 'BC100B_1218', note: '12-18 months' },
    { style: 'BC100B', size: '1824', expected: 'BC100B_1824', note: '18-24 months' },

    // Existing infant sizes (still work)
    { style: 'BC100B', size: '306', expected: 'BC100B_306', note: '3-6 months (3-digit)' },
    { style: 'BC100B', size: '612', expected: 'BC100B_612', note: '6-12 months (3-digit)' },

    // ==============================================
    // Standard sizes (no suffix)
    // ==============================================
    { style: 'PC54', size: 'S', expected: 'PC54', note: 'Standard S' },
    { style: 'PC54', size: 'M', expected: 'PC54', note: 'Standard M' },
    { style: 'PC54', size: 'L', expected: 'PC54', note: 'Standard L' },
    { style: 'PC54', size: 'XL', expected: 'PC54', note: 'Standard XL' },

    // ==============================================
    // Waist sizes
    // ==============================================
    { style: 'PT66', size: 'W32', expected: 'PT66_W32', note: 'Shorts waist 32' },
    { style: 'PT66', size: 'W38', expected: 'PT66_W38', note: 'Shorts waist 38' },

    // ==============================================
    // Extended sizes
    // ==============================================
    { style: 'PC54', size: '2XL', expected: 'PC54_2X', note: '2XL → _2X' },
    { style: 'PC54', size: '3XL', expected: 'PC54_3X', note: '3XL → _3X' },
    { style: 'PC54', size: '4XL', expected: 'PC54_4X', note: '4XL → _4X' },
    { style: 'S608ES', size: '7XL', expected: 'S608ES_7X', note: '7XL → _7X' },
];

console.log('SKU Validation Fixes Test\n');
console.log('='.repeat(70));

let passed = 0;
let failed = 0;

tests.forEach(test => {
    const result = service.sanmarToShopWorksSKU(test.style, test.size);
    const isPass = result === test.expected;

    if (isPass) {
        passed++;
        console.log(`✓ ${test.style} + ${test.size} → ${result}`);
    } else {
        failed++;
        console.log(`✗ ${test.style} + ${test.size} → ${result}`);
        console.log(`  Expected: ${test.expected} | ${test.note}`);
    }
});

console.log('='.repeat(70));
console.log(`\nResults: ${passed} passed, ${failed} failed`);

if (failed > 0) {
    process.exit(1);
} else {
    console.log('\n✓ All SKU validation fixes verified!');
}
