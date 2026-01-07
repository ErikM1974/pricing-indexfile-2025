/**
 * DTF Quote Builder Pricing Tests
 *
 * Tests verify correct pricing calculations for DTF transfers including:
 * - Transfer costs by size and tier
 * - Labor costs per location
 * - Freight costs by quantity tier
 * - LTM fee distribution (qty < 24)
 * - Half-dollar ceiling rounding
 * - Multi-location pricing
 * - Size upcharges
 *
 * Run with: node tests/unit/test-dtf-pricing.js
 */

const fetch = require('node-fetch');

// ============================================================================
// CONFIGURATION
// ============================================================================

const BASE_URL = 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';

// Expected pricing values (from live API - updated 2026-01-06)
const EXPECTED_TRANSFER_COSTS = {
    'small': {
        '10-23': 6.50,
        '24-47': 5.75,
        '48-71': 4.50,
        '72+': 3.75
    },
    'medium': {
        '10-23': 10.00,
        '24-47': 8.75,
        '48-71': 7.00,
        '72+': 5.50
    },
    'large': {
        '10-23': 15.00,
        '24-47': 13.00,
        '48-71': 10.50,
        '72+': 8.50
    }
};

const EXPECTED_FREIGHT_COSTS = [
    { minQty: 10, maxQty: 49, cost: 0.50 },
    { minQty: 50, maxQty: 99, cost: 0.35 },
    { minQty: 100, maxQty: 199, cost: 0.25 },
    { minQty: 200, maxQty: 999999, cost: 0.15 }
];

const LABOR_COST_PER_LOCATION = 2.50;
const MARGIN_DENOMINATOR = 0.57;
const LTM_FEE = 50.00;
const LTM_THRESHOLD = 24; // LTM applies when qty < 24

// Location to size mapping
const LOCATION_SIZE_MAP = {
    'left-chest': 'small',
    'right-chest': 'small',
    'left-sleeve': 'small',
    'right-sleeve': 'small',
    'back-of-neck': 'small',
    'center-front': 'medium',
    'center-back': 'medium',
    'full-front': 'large',
    'full-back': 'large'
};

// Console colors
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m'
};

// ============================================================================
// PRICING FUNCTIONS (mirror the production code)
// ============================================================================

/**
 * Round up to nearest half dollar (ceiling)
 */
function roundUpToHalfDollar(price) {
    if (price % 0.5 === 0) return price;
    return Math.ceil(price * 2) / 2;
}

/**
 * Get tier label for quantity
 */
function getTierLabel(quantity) {
    if (quantity < 24) return '10-23';
    if (quantity < 48) return '24-47';
    if (quantity < 72) return '48-71';
    return '72+';
}

/**
 * Get transfer cost for size and quantity
 */
function getTransferCost(sizeKey, quantity) {
    const tierLabel = getTierLabel(quantity);
    return EXPECTED_TRANSFER_COSTS[sizeKey]?.[tierLabel] || 0;
}

/**
 * Get freight cost per transfer for quantity
 */
function getFreightCost(quantity) {
    const tier = EXPECTED_FREIGHT_COSTS.find(t => quantity >= t.minQty && quantity <= t.maxQty);
    return tier ? tier.cost : 0.15;
}

/**
 * Calculate LTM per unit
 */
function getLTMPerUnit(quantity) {
    if (quantity >= LTM_THRESHOLD) return 0;
    return Math.floor((LTM_FEE / quantity) * 100) / 100;
}

/**
 * Calculate full unit price
 *
 * Formula:
 * UnitPrice = ceil_half_dollar(
 *   (GarmentCost / 0.57)
 *   + TransferCost(size, tier)
 *   + Labor × LocationCount
 *   + Freight × LocationCount
 *   + LTM / Qty
 * )
 */
function calculateUnitPrice(garmentCost, locations, quantity, sizeUpcharge = 0) {
    const effectiveCost = garmentCost + sizeUpcharge;
    const garmentWithMargin = effectiveCost / MARGIN_DENOMINATOR;

    // Calculate transfer costs for all locations
    let totalTransferCost = 0;
    locations.forEach(loc => {
        const sizeKey = LOCATION_SIZE_MAP[loc];
        totalTransferCost += getTransferCost(sizeKey, quantity);
    });

    const locationCount = locations.length;
    const totalLabor = LABOR_COST_PER_LOCATION * locationCount;
    const totalFreight = getFreightCost(quantity) * locationCount;
    const ltmPerUnit = getLTMPerUnit(quantity);

    const subtotal = garmentWithMargin + totalTransferCost + totalLabor + totalFreight + ltmPerUnit;
    const finalPrice = roundUpToHalfDollar(subtotal);

    return {
        garmentCost,
        sizeUpcharge,
        effectiveCost,
        garmentWithMargin,
        transferCost: totalTransferCost,
        laborCost: totalLabor,
        freightCost: totalFreight,
        ltmPerUnit,
        subtotal,
        finalPrice,
        tierLabel: getTierLabel(quantity)
    };
}

// ============================================================================
// TEST FRAMEWORK
// ============================================================================

let testsPassed = 0;
let testsFailed = 0;
const failures = [];

function assert(condition, message, expected, actual) {
    if (condition) {
        testsPassed++;
        console.log(`  ${colors.green}✓${colors.reset} ${message}`);
    } else {
        testsFailed++;
        const failureMsg = `${message} (expected: ${expected}, actual: ${actual})`;
        failures.push(failureMsg);
        console.log(`  ${colors.red}✗${colors.reset} ${failureMsg}`);
    }
}

function assertClose(actual, expected, tolerance, message) {
    const diff = Math.abs(actual - expected);
    assert(diff <= tolerance, message, expected, actual);
}

function section(title) {
    console.log(`\n${colors.cyan}${colors.bright}═══ ${title} ═══${colors.reset}`);
}

// ============================================================================
// TESTS
// ============================================================================

async function runTests() {
    console.log(`${colors.bright}╔════════════════════════════════════════════════╗${colors.reset}`);
    console.log(`${colors.bright}║     DTF Quote Builder Pricing Tests            ║${colors.reset}`);
    console.log(`${colors.bright}╚════════════════════════════════════════════════╝${colors.reset}`);

    // -------------------------------------------------------------------------
    section('1. ROUNDING TESTS');
    // -------------------------------------------------------------------------

    // Test half-dollar ceiling rounding
    assert(roundUpToHalfDollar(10.00) === 10.00, 'Exact dollar stays same', 10.00, roundUpToHalfDollar(10.00));
    assert(roundUpToHalfDollar(10.50) === 10.50, 'Exact half-dollar stays same', 10.50, roundUpToHalfDollar(10.50));
    assert(roundUpToHalfDollar(10.01) === 10.50, '$10.01 rounds to $10.50', 10.50, roundUpToHalfDollar(10.01));
    assert(roundUpToHalfDollar(10.49) === 10.50, '$10.49 rounds to $10.50', 10.50, roundUpToHalfDollar(10.49));
    assert(roundUpToHalfDollar(10.51) === 11.00, '$10.51 rounds to $11.00', 11.00, roundUpToHalfDollar(10.51));
    assert(roundUpToHalfDollar(10.99) === 11.00, '$10.99 rounds to $11.00', 11.00, roundUpToHalfDollar(10.99));
    assert(roundUpToHalfDollar(0.25) === 0.50, '$0.25 rounds to $0.50', 0.50, roundUpToHalfDollar(0.25));

    // -------------------------------------------------------------------------
    section('2. TIER BOUNDARY TESTS');
    // -------------------------------------------------------------------------

    assert(getTierLabel(10) === '10-23', 'Qty 10 is tier 10-23', '10-23', getTierLabel(10));
    assert(getTierLabel(23) === '10-23', 'Qty 23 is tier 10-23 (last in tier)', '10-23', getTierLabel(23));
    assert(getTierLabel(24) === '24-47', 'Qty 24 is tier 24-47 (LTM boundary)', '24-47', getTierLabel(24));
    assert(getTierLabel(47) === '24-47', 'Qty 47 is tier 24-47 (last in tier)', '24-47', getTierLabel(47));
    assert(getTierLabel(48) === '48-71', 'Qty 48 is tier 48-71', '48-71', getTierLabel(48));
    assert(getTierLabel(71) === '48-71', 'Qty 71 is tier 48-71 (last in tier)', '48-71', getTierLabel(71));
    assert(getTierLabel(72) === '72+', 'Qty 72 is tier 72+', '72+', getTierLabel(72));
    assert(getTierLabel(500) === '72+', 'Qty 500 is tier 72+', '72+', getTierLabel(500));

    // -------------------------------------------------------------------------
    section('3. TRANSFER COST TESTS');
    // -------------------------------------------------------------------------

    // Small transfer costs (from API)
    assert(getTransferCost('small', 10) === 6.50, 'Small @ 10 pcs = $6.50', 6.50, getTransferCost('small', 10));
    assert(getTransferCost('small', 24) === 5.75, 'Small @ 24 pcs = $5.75', 5.75, getTransferCost('small', 24));
    assert(getTransferCost('small', 48) === 4.50, 'Small @ 48 pcs = $4.50', 4.50, getTransferCost('small', 48));
    assert(getTransferCost('small', 72) === 3.75, 'Small @ 72 pcs = $3.75', 3.75, getTransferCost('small', 72));

    // Medium transfer costs (from API)
    assert(getTransferCost('medium', 10) === 10.00, 'Medium @ 10 pcs = $10.00', 10.00, getTransferCost('medium', 10));
    assert(getTransferCost('medium', 24) === 8.75, 'Medium @ 24 pcs = $8.75', 8.75, getTransferCost('medium', 24));
    assert(getTransferCost('medium', 48) === 7.00, 'Medium @ 48 pcs = $7.00', 7.00, getTransferCost('medium', 48));
    assert(getTransferCost('medium', 72) === 5.50, 'Medium @ 72 pcs = $5.50', 5.50, getTransferCost('medium', 72));

    // Large transfer costs (from API)
    assert(getTransferCost('large', 10) === 15.00, 'Large @ 10 pcs = $15.00', 15.00, getTransferCost('large', 10));
    assert(getTransferCost('large', 24) === 13.00, 'Large @ 24 pcs = $13.00', 13.00, getTransferCost('large', 24));
    assert(getTransferCost('large', 48) === 10.50, 'Large @ 48 pcs = $10.50', 10.50, getTransferCost('large', 48));
    assert(getTransferCost('large', 72) === 8.50, 'Large @ 72 pcs = $8.50', 8.50, getTransferCost('large', 72));

    // -------------------------------------------------------------------------
    section('4. FREIGHT COST TESTS');
    // -------------------------------------------------------------------------

    assert(getFreightCost(10) === 0.50, 'Freight @ 10 pcs = $0.50', 0.50, getFreightCost(10));
    assert(getFreightCost(49) === 0.50, 'Freight @ 49 pcs = $0.50', 0.50, getFreightCost(49));
    assert(getFreightCost(50) === 0.35, 'Freight @ 50 pcs = $0.35', 0.35, getFreightCost(50));
    assert(getFreightCost(99) === 0.35, 'Freight @ 99 pcs = $0.35', 0.35, getFreightCost(99));
    assert(getFreightCost(100) === 0.25, 'Freight @ 100 pcs = $0.25', 0.25, getFreightCost(100));
    assert(getFreightCost(199) === 0.25, 'Freight @ 199 pcs = $0.25', 0.25, getFreightCost(199));
    assert(getFreightCost(200) === 0.15, 'Freight @ 200 pcs = $0.15', 0.15, getFreightCost(200));

    // -------------------------------------------------------------------------
    section('5. LTM FEE TESTS');
    // -------------------------------------------------------------------------

    // LTM applies when qty < 24
    assert(getLTMPerUnit(10) === 5.00, 'LTM @ 10 pcs = $5.00/ea', 5.00, getLTMPerUnit(10));
    assert(getLTMPerUnit(23) === 2.17, 'LTM @ 23 pcs = $2.17/ea', 2.17, getLTMPerUnit(23));
    assert(getLTMPerUnit(24) === 0.00, 'LTM @ 24 pcs = $0.00 (no LTM)', 0.00, getLTMPerUnit(24));
    assert(getLTMPerUnit(25) === 0.00, 'LTM @ 25 pcs = $0.00 (no LTM)', 0.00, getLTMPerUnit(25));
    assert(getLTMPerUnit(72) === 0.00, 'LTM @ 72 pcs = $0.00 (no LTM)', 0.00, getLTMPerUnit(72));

    // Edge case: LTM at minimum quantity
    const ltmAt10 = Math.floor((50 / 10) * 100) / 100;
    assert(getLTMPerUnit(10) === ltmAt10, 'LTM formula: floor((50/10)*100)/100', ltmAt10, getLTMPerUnit(10));

    // -------------------------------------------------------------------------
    section('6. FULL PRICING CALCULATIONS');
    // -------------------------------------------------------------------------

    // Test case: PC61 ($2.32 cost), Left Chest (small), 24 pcs
    // Expected: (2.32/0.57) + 5.75 + 2.50 + 0.50 + 0 = 4.07 + 5.75 + 2.50 + 0.50 = 12.82 → $13.00
    const test1 = calculateUnitPrice(2.32, ['left-chest'], 24);
    assertClose(test1.garmentWithMargin, 4.07, 0.01, 'PC61 garment margin: $2.32/0.57 = ~$4.07');
    assert(test1.transferCost === 5.75, 'PC61 transfer (small@24): $5.75', 5.75, test1.transferCost);
    assert(test1.laborCost === 2.50, 'PC61 labor (1 loc): $2.50', 2.50, test1.laborCost);
    assert(test1.freightCost === 0.50, 'PC61 freight (24 pcs): $0.50', 0.50, test1.freightCost);
    assert(test1.ltmPerUnit === 0.00, 'PC61 LTM (24 pcs): $0.00', 0.00, test1.ltmPerUnit);
    assertClose(test1.subtotal, 12.82, 0.01, 'PC61 subtotal: ~$12.82');
    assert(test1.finalPrice === 13.00, 'PC61 final (rounded): $13.00', 13.00, test1.finalPrice);

    // Test case: Same product at 23 pcs (with LTM)
    // LTM = $50/23 = $2.17
    const test2 = calculateUnitPrice(2.32, ['left-chest'], 23);
    assert(test2.tierLabel === '10-23', 'PC61@23 tier: 10-23', '10-23', test2.tierLabel);
    assert(test2.transferCost === 6.50, 'PC61 transfer (small@23): $6.50', 6.50, test2.transferCost);
    assert(test2.ltmPerUnit === 2.17, 'PC61 LTM (23 pcs): $2.17', 2.17, test2.ltmPerUnit);
    // (2.32/0.57) + 6.50 + 2.50 + 0.50 + 2.17 = 4.07 + 6.50 + 2.50 + 0.50 + 2.17 = 15.74 → $16.00
    assertClose(test2.subtotal, 15.74, 0.01, 'PC61@23 subtotal: ~$15.74');
    assert(test2.finalPrice === 16.00, 'PC61@23 final (rounded): $16.00', 16.00, test2.finalPrice);

    // -------------------------------------------------------------------------
    section('7. LTM BOUNDARY TEST (23 vs 24)');
    // -------------------------------------------------------------------------

    const at23 = calculateUnitPrice(2.32, ['left-chest'], 23);
    const at24 = calculateUnitPrice(2.32, ['left-chest'], 24);

    console.log(`\n  ${colors.yellow}Price at 23 pcs: $${at23.finalPrice}${colors.reset}`);
    console.log(`  ${colors.yellow}Price at 24 pcs: $${at24.finalPrice}${colors.reset}`);
    console.log(`  ${colors.yellow}Difference: $${(at23.finalPrice - at24.finalPrice).toFixed(2)}${colors.reset}`);

    assert(at23.finalPrice > at24.finalPrice, 'Price at 23 > price at 24 (LTM effect)', true, at23.finalPrice > at24.finalPrice);
    assert(at23.ltmPerUnit > 0, 'LTM exists at 23 pcs', true, at23.ltmPerUnit > 0);
    assert(at24.ltmPerUnit === 0, 'No LTM at 24 pcs', 0, at24.ltmPerUnit);

    // -------------------------------------------------------------------------
    section('8. MULTI-LOCATION TESTS');
    // -------------------------------------------------------------------------

    // Test: 2 locations (left-chest + center-back)
    const multiLoc1 = calculateUnitPrice(2.32, ['left-chest', 'center-back'], 24);
    // Transfer: small(5.75) + medium(8.75) = 14.50
    // Labor: 2 × $2.50 = $5.00
    // Freight: 2 × $0.50 = $1.00
    assert(multiLoc1.transferCost === 14.50, '2-loc transfer: $5.75+$8.75=$14.50', 14.50, multiLoc1.transferCost);
    assert(multiLoc1.laborCost === 5.00, '2-loc labor: 2×$2.50=$5.00', 5.00, multiLoc1.laborCost);
    assert(multiLoc1.freightCost === 1.00, '2-loc freight: 2×$0.50=$1.00', 1.00, multiLoc1.freightCost);
    // Total: 4.07 + 14.50 + 5.00 + 1.00 = 24.57 → $25.00
    assertClose(multiLoc1.subtotal, 24.57, 0.01, '2-loc subtotal: ~$24.57');
    assert(multiLoc1.finalPrice === 25.00, '2-loc final: $25.00', 25.00, multiLoc1.finalPrice);

    // Test: 3 locations (left-chest + center-back + full-back)
    const multiLoc2 = calculateUnitPrice(2.32, ['left-chest', 'center-back', 'full-back'], 24);
    // Transfer: small(5.75) + medium(8.75) + large(13.00) = 27.50
    // Labor: 3 × $2.50 = $7.50
    // Freight: 3 × $0.50 = $1.50
    assert(multiLoc2.transferCost === 27.50, '3-loc transfer: $5.75+$8.75+$13.00=$27.50', 27.50, multiLoc2.transferCost);
    assert(multiLoc2.laborCost === 7.50, '3-loc labor: 3×$2.50=$7.50', 7.50, multiLoc2.laborCost);
    assert(multiLoc2.freightCost === 1.50, '3-loc freight: 3×$0.50=$1.50', 1.50, multiLoc2.freightCost);
    // Total: 4.07 + 27.50 + 7.50 + 1.50 = 40.57 → $41.00
    assertClose(multiLoc2.subtotal, 40.57, 0.01, '3-loc subtotal: ~$40.57');
    assert(multiLoc2.finalPrice === 41.00, '3-loc final: $41.00', 41.00, multiLoc2.finalPrice);

    // -------------------------------------------------------------------------
    section('9. SIZE UPCHARGE TESTS');
    // -------------------------------------------------------------------------

    // Test: 2XL with $2.00 upcharge
    const upcharge1 = calculateUnitPrice(2.32, ['left-chest'], 24, 2.00);
    // Effective cost: 2.32 + 2.00 = 4.32
    // Garment margin: 4.32 / 0.57 = 7.58
    // Total: 7.58 + 5.75 + 2.50 + 0.50 = 16.33 → $16.50
    assert(upcharge1.effectiveCost === 4.32, '2XL effective cost: $2.32+$2.00=$4.32', 4.32, upcharge1.effectiveCost);
    assertClose(upcharge1.garmentWithMargin, 7.58, 0.01, '2XL garment margin: $4.32/0.57=~$7.58');
    assertClose(upcharge1.subtotal, 16.33, 0.01, '2XL subtotal: ~$16.33');
    assert(upcharge1.finalPrice === 16.50, '2XL final: $16.50', 16.50, upcharge1.finalPrice);

    // Test: 3XL with $4.00 upcharge
    const upcharge2 = calculateUnitPrice(2.32, ['left-chest'], 24, 4.00);
    // Effective cost: 2.32 + 4.00 = 6.32
    // Garment margin: 6.32 / 0.57 = 11.09
    // Total: 11.09 + 5.75 + 2.50 + 0.50 = 19.84 → $20.00
    assert(upcharge2.effectiveCost === 6.32, '3XL effective cost: $2.32+$4.00=$6.32', 6.32, upcharge2.effectiveCost);
    assertClose(upcharge2.garmentWithMargin, 11.09, 0.01, '3XL garment margin: $6.32/0.57=~$11.09');
    assertClose(upcharge2.subtotal, 19.84, 0.01, '3XL subtotal: ~$19.84');
    assert(upcharge2.finalPrice === 20.00, '3XL final: $20.00', 20.00, upcharge2.finalPrice);

    // -------------------------------------------------------------------------
    section('10. HIGH QUANTITY TIER TESTS');
    // -------------------------------------------------------------------------

    // Test at 72+ tier (note: 72 is in freight tier 50-99 = $0.35)
    const tier72 = calculateUnitPrice(2.32, ['left-chest'], 72);
    assert(tier72.tierLabel === '72+', 'Tier at 72 pcs: 72+', '72+', tier72.tierLabel);
    assert(tier72.transferCost === 3.75, 'Transfer (small@72+): $3.75', 3.75, tier72.transferCost);
    assert(tier72.freightCost === 0.35, 'Freight at 72 pcs: $0.35 (50-99 tier)', 0.35, tier72.freightCost);
    assert(tier72.ltmPerUnit === 0, 'No LTM at 72+', 0, tier72.ltmPerUnit);
    // Total: 4.07 + 3.75 + 2.50 + 0.35 = 10.67 → $11.00
    assertClose(tier72.subtotal, 10.67, 0.02, '72+ subtotal: ~$10.67');
    assert(tier72.finalPrice === 11.00, '72+ final: $11.00', 11.00, tier72.finalPrice);

    // Test at 100+ (different freight tier)
    const tier100 = calculateUnitPrice(2.32, ['left-chest'], 100);
    assert(tier100.freightCost === 0.25, 'Freight at 100 pcs: $0.25', 0.25, tier100.freightCost);
    // Total: 4.07 + 3.75 + 2.50 + 0.25 = 10.57 → $11.00
    assertClose(tier100.subtotal, 10.57, 0.01, '100+ subtotal: ~$10.57');
    assert(tier100.finalPrice === 11.00, '100+ final: $11.00', 11.00, tier100.finalPrice);

    // -------------------------------------------------------------------------
    section('11. API VALIDATION (Live Data)');
    // -------------------------------------------------------------------------

    try {
        console.log(`\n  ${colors.blue}Fetching live API data...${colors.reset}`);
        const response = await fetch(`${BASE_URL}/api/pricing-bundle?method=DTF&styleNumber=PC61`);

        if (response.ok) {
            const apiData = await response.json();

            // Validate API structure
            assert(!!apiData.tiersR, 'API returns tiersR', true, !!apiData.tiersR);
            assert(!!apiData.allDtfCostsR, 'API returns allDtfCostsR', true, !!apiData.allDtfCostsR);
            assert(!!apiData.freightR, 'API returns freightR', true, !!apiData.freightR);

            // Validate tier structure
            if (apiData.tiersR && apiData.tiersR.length > 0) {
                const tier = apiData.tiersR[0];
                assert('TierLabel' in tier, 'Tier has TierLabel', true, 'TierLabel' in tier);
                assert('MinQuantity' in tier, 'Tier has MinQuantity', true, 'MinQuantity' in tier);
                assert('MaxQuantity' in tier, 'Tier has MaxQuantity', true, 'MaxQuantity' in tier);
                assert('MarginDenominator' in tier, 'Tier has MarginDenominator', true, 'MarginDenominator' in tier);
            }

            // Validate DTF costs structure
            if (apiData.allDtfCostsR && apiData.allDtfCostsR.length > 0) {
                const cost = apiData.allDtfCostsR[0];
                assert('size' in cost, 'DTF cost has size', true, 'size' in cost);
                assert('unit_price' in cost, 'DTF cost has unit_price', true, 'unit_price' in cost);
                assert('PressingLaborCost' in cost, 'DTF cost has PressingLaborCost', true, 'PressingLaborCost' in cost);
            }

            // Validate freight structure
            if (apiData.freightR && apiData.freightR.length > 0) {
                const freight = apiData.freightR[0];
                assert('min_quantity' in freight, 'Freight has min_quantity', true, 'min_quantity' in freight);
                assert('cost_per_transfer' in freight, 'Freight has cost_per_transfer', true, 'cost_per_transfer' in freight);
            }

            // Verify API values are reasonable (not exact - API data can be updated)
            const smallTier1 = apiData.allDtfCostsR?.find(c => c.size === 'Up to 5" x 5"' && c.min_quantity === 10);
            if (smallTier1) {
                const price = smallTier1.unit_price;
                assert(price >= 5.00 && price <= 8.00, `API: Small@10-23 in range $5-8 (actual: $${price})`, true, price >= 5.00 && price <= 8.00);
            }

            console.log(`  ${colors.green}API validation complete${colors.reset}`);
        } else {
            console.log(`  ${colors.yellow}⚠ API unavailable (${response.status}) - skipping live tests${colors.reset}`);
        }
    } catch (error) {
        console.log(`  ${colors.yellow}⚠ API error: ${error.message} - skipping live tests${colors.reset}`);
    }

    // -------------------------------------------------------------------------
    // SUMMARY
    // -------------------------------------------------------------------------

    console.log(`\n${colors.bright}╔════════════════════════════════════════════════╗${colors.reset}`);
    console.log(`${colors.bright}║                 TEST SUMMARY                   ║${colors.reset}`);
    console.log(`${colors.bright}╚════════════════════════════════════════════════╝${colors.reset}`);

    console.log(`\n  ${colors.green}Passed: ${testsPassed}${colors.reset}`);
    console.log(`  ${colors.red}Failed: ${testsFailed}${colors.reset}`);

    if (failures.length > 0) {
        console.log(`\n${colors.red}Failures:${colors.reset}`);
        failures.forEach((f, i) => {
            console.log(`  ${i + 1}. ${f}`);
        });
    }

    const exitCode = testsFailed > 0 ? 1 : 0;
    console.log(`\n${colors.bright}Exit code: ${exitCode}${colors.reset}\n`);
    process.exit(exitCode);
}

// Run tests
runTests().catch(error => {
    console.error(`${colors.red}Fatal error: ${error.message}${colors.reset}`);
    process.exit(1);
});
