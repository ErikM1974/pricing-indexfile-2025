/**
 * 2025 Embroidery Pricing Validation Script
 *
 * Validates embroidery pricing by comparing actual charged prices (cnCur_UnitPriceUsed)
 * against calculated prices using the EmbroideryPricingCalculator formula.
 *
 * Uses 6,220 line items from 2025 CSV data to validate pricing accuracy.
 *
 * Categories tested:
 * - SANMAR: Products in SanMar Bulk CSV (uses embroidery pricing formula)
 * - SERVICE_CODE: Service codes (DECG, DD, AL, etc.) - separate pricing
 * - RICHARDSON_FD: Richardson Factory Direct caps (cap pricing formula)
 * - NON_SANMAR: Other vendor products (flagged for manual review)
 * - ODDBALL: Cannot classify (skipped)
 *
 * Run: npm run test:emb-pricing
 * Verbose: npm run test:emb-pricing-verbose
 */

const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');

// ============================================
// CONFIGURATION
// ============================================

// File paths
const ORDERS_CSV_PATH = 'C:\\Users\\erik\\Downloads\\embroidery orders raw data 2025.csv';
const SANMAR_CSV_PATH = 'C:\\Users\\erik\\Downloads\\Sanmar_Bulk_251816_Feb2024_2026-Feb-01_1317.csv';
const REPORT_CSV_PATH = path.join(__dirname, '../reports/embroidery-pricing-validation.csv');
const SUMMARY_JSON_PATH = path.join(__dirname, '../reports/embroidery-pricing-summary.json');

// API endpoint for pricing config
const API_BASE = 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';

// Tolerance levels for matching (in dollars)
const TOLERANCE = {
    EXACT: 0.50,      // Matched (±$0.50)
    CLOSE: 2.00,      // Close (±$2.00)
    ACCEPTABLE: 5.00, // Acceptable (±$5.00) - minor cost differences
    DISCREPANCY: 5.01 // Discrepancy (>$5.00) - likely custom pricing
};

// Command line options
const VERBOSE = process.argv.includes('--verbose') || process.argv.includes('-v');
const CALIBRATE_MODE = process.argv.includes('--calibrate');
const LTM_ANALYSIS = process.argv.includes('--ltm-analysis');
const USE_2026_PARAMS = process.argv.includes('--year') && process.argv.includes('2026');

// LTM (Less Than Minimum) constants
const LTM_FEE = 50.00;
const LTM_THRESHOLD = 24;

// 2025 vs 2026 parameters
const PRICING_PARAMS = {
    2025: {
        marginDenominator: 0.60,  // 40% margin
        embCosts: [12, 11, 10, 9],  // Will be calibrated if --calibrate
        roundingMethod: 'CeilDollar'
    },
    2026: {
        marginDenominator: 0.57,  // 43% margin
        embCosts: [16, 14, 13, 12],  // From API
        roundingMethod: 'CeilDollar'
    }
};

// Manual override for embroidery costs (from CLI or calibration)
let MANUAL_EMB_COSTS = null;
const embCostsArg = process.argv.find(arg => arg.startsWith('--emb-costs='));
if (embCostsArg) {
    MANUAL_EMB_COSTS = embCostsArg.split('=')[1].split(',').map(Number);
}

// ============================================
// SERVICE CODE PATTERNS (from validate-2025-orders.js)
// ============================================

const SERVICE_CODE_PATTERNS = {
    exact: [
        'DECG', 'DECC', 'AL', 'DD', 'DDE', 'DDT', 'DD-CAP',
        'FB', 'LTM', 'GRT-50', 'GRT-75', 'RUSH', 'ART', 'EJB',
        'NAME', 'MONOGRAM', 'SPRESET', 'SPSU', 'FILM', 'PMS', 'MBF'
    ],
    prefixed: ['DGT-', 'MONOGRAM', 'NAME'],
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

// ============================================
// PRICING CALCULATOR (Node.js version of browser code)
// ============================================

class PricingCalculator {
    constructor(year = 2025) {
        this.year = year;
        const params = PRICING_PARAMS[year] || PRICING_PARAMS[2025];

        // Set margin based on year
        this.marginDenominator = params.marginDenominator;
        this.roundingMethod = params.roundingMethod;

        // Default tier structure
        const embCosts = MANUAL_EMB_COSTS || params.embCosts;
        this.tiers = {
            '1-23': { embCost: embCosts[0], hasLTM: true },
            '24-47': { embCost: embCosts[1], hasLTM: false },
            '48-71': { embCost: embCosts[2], hasLTM: false },
            '72+': { embCost: embCosts[3], hasLTM: false }
        };
        this.additionalStitchRate = 1.25;
        this.baseStitchCount = 8000;
    }

    /**
     * Load pricing configuration from API (2026 only)
     */
    async loadConfig() {
        // For 2025, use hardcoded/calibrated values
        if (this.year === 2025 && !USE_2026_PARAMS) {
            console.log('Using 2025 pricing parameters:');
            console.log('  Margin denominator:', this.marginDenominator, '(40% margin)');
            console.log('  Tiers:', JSON.stringify(this.tiers));
            console.log('  Rounding method:', this.roundingMethod);
            return;
        }

        const fetch = require('node-fetch');

        try {
            console.log('Fetching embroidery pricing config from API (2026)...');
            const response = await fetch(`${API_BASE}/api/pricing-bundle?method=EMB&styleNumber=PC54`);
            const data = await response.json();

            if (data && data.tiersR && data.tiersR.length > 0) {
                this.marginDenominator = data.tiersR[0].MarginDenominator || 0.57;

                // Build tiers from API data
                this.tiers = {};
                data.tiersR.forEach(tier => {
                    this.tiers[tier.TierLabel] = {
                        embCost: 0,
                        hasLTM: tier.LTM_Fee > 0
                    };
                });
            }

            if (data && data.allEmbroideryCostsR) {
                const shirtConfig = data.allEmbroideryCostsR.find(c => c.ItemType === 'Shirt') || data.allEmbroideryCostsR[0];
                if (shirtConfig) {
                    this.additionalStitchRate = shirtConfig.AdditionalStitchRate || 1.25;
                    this.baseStitchCount = shirtConfig.BaseStitchCount || 8000;
                }

                // Update tier embroidery costs
                data.allEmbroideryCostsR.forEach(cost => {
                    if (cost.ItemType === 'Shirt' && this.tiers[cost.TierLabel]) {
                        this.tiers[cost.TierLabel].embCost = cost.EmbroideryCost;
                    }
                });
            }

            if (data && data.rulesR && data.rulesR.RoundingMethod) {
                this.roundingMethod = data.rulesR.RoundingMethod;
            }

            console.log('  Margin denominator:', this.marginDenominator);
            console.log('  Tiers:', JSON.stringify(this.tiers));
            console.log('  Rounding method:', this.roundingMethod);
            console.log('  Additional stitch rate:', this.additionalStitchRate);

        } catch (error) {
            console.error('Failed to load API config, using defaults:', error.message);
        }
    }

    /**
     * Set embroidery costs manually (for calibration)
     */
    setEmbroideryCosts(costs) {
        const tierLabels = ['1-23', '24-47', '48-71', '72+'];
        tierLabels.forEach((label, i) => {
            if (this.tiers[label] && costs[i] !== undefined) {
                this.tiers[label].embCost = costs[i];
            }
        });
    }

    /**
     * Get tier based on quantity
     */
    getTier(quantity) {
        if (quantity < 24) return '1-23';
        if (quantity < 48) return '24-47';
        if (quantity < 72) return '48-71';
        return '72+';
    }

    /**
     * Get embroidery cost for tier
     */
    getEmbroideryCost(tier) {
        return this.tiers[tier]?.embCost || 12.00;
    }

    /**
     * Round price based on rounding method
     */
    roundPrice(price) {
        if (isNaN(price)) return null;

        if (this.roundingMethod === 'CeilDollar') {
            return Math.ceil(price);
        }

        // HalfDollarUp - round UP to nearest $0.50
        if (price % 0.5 === 0) return price;
        return Math.ceil(price * 2) / 2;
    }

    /**
     * Calculate decorated unit price for a garment
     *
     * Formula:
     * 1. Get base garment cost from SanMar
     * 2. Apply margin: garmentCost = baseCost / marginDenominator
     * 3. Add embroidery cost based on tier
     * 4. Round using method (CeilDollar for shirts)
     * 5. Add size upcharge (not included in base formula)
     *
     * @param {number} baseCost - SanMar base cost (PIECE_PRICE)
     * @param {number} quantity - Order quantity for tier calculation
     * @param {number} stitchCount - Stitch count (default 8000)
     * @param {number} sizeUpcharge - Size upcharge (2XL: $2, 3XL: $3, etc.)
     */
    calculateDecoratedPrice(baseCost, quantity, stitchCount = 8000, sizeUpcharge = 0) {
        const tier = this.getTier(quantity);
        const embCost = this.getEmbroideryCost(tier);

        // Step 1: Calculate garment cost with margin
        const garmentCost = baseCost / this.marginDenominator;

        // Step 2: Calculate extra stitch cost (over 8000 base)
        const extraStitches = Math.max(0, stitchCount - this.baseStitchCount);
        const extraStitchCost = (extraStitches / 1000) * this.additionalStitchRate;

        // Step 3: Calculate base decorated price (before upcharge)
        const baseDecoratedPrice = garmentCost + embCost;

        // Step 4: Round the base price
        const roundedBase = this.roundPrice(baseDecoratedPrice);

        // Step 5: Add upcharge AFTER rounding (upcharges are already whole numbers)
        const finalPrice = roundedBase + sizeUpcharge + extraStitchCost;

        return {
            tier,
            embCost,
            garmentCost,
            baseDecoratedPrice,
            roundedBase,
            extraStitchCost,
            sizeUpcharge,
            finalPrice
        };
    }
}

// ============================================
// CALIBRATION MODE
// ============================================

/**
 * Calculate implied embroidery costs from actual 2025 order data
 *
 * Formula: impliedEmbCost = actualPrice - ceil(baseCost / 0.60) - sizeUpcharge
 *
 * Groups results by tier and calculates median/average
 */
async function runCalibration() {
    console.log('\n=== Calibrating 2025 Embroidery Costs ===\n');

    // Load data
    const sanmarPricing = loadSanmarPricing();
    const richardsonStyles = loadRichardsonStyles();
    const serviceCodes = await fetchServiceCodes();
    const orders = loadOrders();

    const marginDenom = PRICING_PARAMS[2025].marginDenominator;
    console.log(`\nAnalyzing with 2025 margin (${marginDenom})...\n`);

    // Group orders by order ID to determine tier
    const orderGroups = new Map();
    for (const row of orders) {
        const orderId = row.id_Order || 'UNKNOWN';
        if (!orderGroups.has(orderId)) {
            orderGroups.set(orderId, []);
        }
        orderGroups.get(orderId).push(row);
    }

    // Collect implied embroidery costs by tier
    const impliedByTier = {
        '1-23': [],
        '24-47': [],
        '48-71': [],
        '72+': []
    };

    let processed = 0;
    let skipped = 0;

    for (const row of orders) {
        const partNumber = (row.PartNumber || '').trim();
        const actualPrice = parseFloat(row.cnCur_UnitPriceUsed) || 0;
        const orderId = row.id_Order;
        const sizeInfo = extractSizeFromRow(row);

        // Skip empty, zero-price, service codes
        if (!partNumber || actualPrice <= 0) {
            skipped++;
            continue;
        }

        const serviceMatch = matchServiceCode(partNumber, serviceCodes);
        if (serviceMatch.isMatch) {
            skipped++;
            continue;
        }

        // Only process SanMar products
        const sanmarMatch = matchSanmarProduct(partNumber, sanmarPricing);
        if (!sanmarMatch.isMatch) {
            skipped++;
            continue;
        }

        const styleData = sanmarPricing.get(sanmarMatch.style);
        if (!styleData || !styleData.basePrice) {
            skipped++;
            continue;
        }

        // Get size and pricing info
        const size = sizeInfo?.size || 'M';
        const sizeUpcharge = styleData.sizeUpcharges[size] || 0;
        const baseCost = styleData.basePrices[size] || styleData.basePrice;

        // Calculate order total for tier
        const orderItems = orderGroups.get(orderId) || [];
        const orderTotalQty = orderItems.reduce((sum, item) => sum + getTotalQuantity(item), 0);

        // Determine tier
        let tier;
        if (orderTotalQty < 24) tier = '1-23';
        else if (orderTotalQty < 48) tier = '24-47';
        else if (orderTotalQty < 72) tier = '48-71';
        else tier = '72+';

        // Calculate implied embroidery cost
        // actualPrice = ceil(baseCost / marginDenom + embCost) + sizeUpcharge
        // embCost = actualPrice - sizeUpcharge - ceil(baseCost / marginDenom)
        const garmentMarkup = Math.ceil(baseCost / marginDenom);
        const impliedEmbCost = actualPrice - sizeUpcharge - garmentMarkup;

        // Only include reasonable values (embroidery shouldn't be negative or > $30)
        if (impliedEmbCost > 0 && impliedEmbCost < 30) {
            impliedByTier[tier].push({
                value: impliedEmbCost,
                partNumber,
                orderId,
                actualPrice,
                baseCost,
                sizeUpcharge,
                garmentMarkup
            });
            processed++;
        } else {
            skipped++;
        }
    }

    console.log(`Processed ${processed} items, skipped ${skipped}\n`);

    // Calculate statistics for each tier
    console.log('IMPLIED EMBROIDERY COSTS BY TIER:');
    console.log('-'.repeat(60));

    const tierLabels = ['1-23', '24-47', '48-71', '72+'];
    const calibratedCosts = [];

    for (const tier of tierLabels) {
        const values = impliedByTier[tier].map(v => v.value).sort((a, b) => a - b);

        if (values.length === 0) {
            console.log(`  Tier ${tier.padEnd(6)}: No data`);
            calibratedCosts.push(null);
            continue;
        }

        // Calculate median
        const mid = Math.floor(values.length / 2);
        const median = values.length % 2 === 0
            ? (values[mid - 1] + values[mid]) / 2
            : values[mid];

        // Calculate average
        const avg = values.reduce((a, b) => a + b, 0) / values.length;

        // Calculate mode (most common rounded value)
        const roundedCounts = {};
        values.forEach(v => {
            const rounded = Math.round(v);
            roundedCounts[rounded] = (roundedCounts[rounded] || 0) + 1;
        });
        const mode = Object.entries(roundedCounts)
            .sort((a, b) => b[1] - a[1])[0][0];

        console.log(`  Tier ${tier.padEnd(6)}: median=$${median.toFixed(2)}, avg=$${avg.toFixed(2)}, mode=$${mode}, samples=${values.length}`);
        calibratedCosts.push(Math.round(median));

        if (VERBOSE && values.length > 0) {
            // Show distribution
            console.log(`           Distribution: min=$${values[0].toFixed(2)}, max=$${values[values.length - 1].toFixed(2)}`);
            console.log(`           Most common: $${mode} (${roundedCounts[mode]} items)`);
        }
    }

    console.log('\n' + '='.repeat(60));
    console.log('\nRECOMMENDED 2025 CONFIG:');
    console.log(`  --emb-costs="${calibratedCosts.join(',')}"`);
    console.log('\nTo validate with these costs, run:');
    console.log(`  npm run test:emb-pricing -- --emb-costs="${calibratedCosts.join(',')}"`);
    console.log('\n');

    // Save calibration results
    const calibrationReport = {
        timestamp: new Date().toISOString(),
        marginDenominator: marginDenom,
        itemsAnalyzed: processed,
        itemsSkipped: skipped,
        tiers: {}
    };

    for (const tier of tierLabels) {
        const values = impliedByTier[tier].map(v => v.value).sort((a, b) => a - b);
        if (values.length > 0) {
            const mid = Math.floor(values.length / 2);
            const median = values.length % 2 === 0 ? (values[mid - 1] + values[mid]) / 2 : values[mid];
            const avg = values.reduce((a, b) => a + b, 0) / values.length;

            calibrationReport.tiers[tier] = {
                median: Math.round(median * 100) / 100,
                average: Math.round(avg * 100) / 100,
                samples: values.length,
                min: values[0],
                max: values[values.length - 1]
            };
        }
    }

    calibrationReport.recommendedCosts = calibratedCosts;

    const calibrationPath = path.join(__dirname, '../reports/embroidery-calibration.json');
    fs.writeFileSync(calibrationPath, JSON.stringify(calibrationReport, null, 2));
    console.log(`Calibration saved: ${calibrationPath}\n`);

    return calibratedCosts;
}

// ============================================
// DATA LOADING FUNCTIONS
// ============================================

/**
 * Load SanMar products with prices from bulk CSV
 * Returns Map of style -> { basePrices: {size: price}, sizeUpcharges: {size: upcharge} }
 */
function loadSanmarPricing() {
    console.log('Loading SanMar Bulk CSV...');
    const content = fs.readFileSync(SANMAR_CSV_PATH, 'utf-8');
    const records = parse(content, {
        columns: true,
        skip_empty_lines: true,
        relax_column_count: true,
        bom: true
    });

    // Group by style, then by color
    const styleMap = new Map();
    const sizeOrder = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL', '6XL',
                       'LT', 'XLT', '2XLT', '3XLT', '4XLT', '5XLT',
                       'OSFA', 'S/M', 'M/L', 'L/XL'];

    for (const row of records) {
        const style = (row.STYLE || '').trim().toUpperCase();
        const size = (row.SIZE || '').trim();
        // Use CASE_PRICE for bulk pricing (what NWCA actually pays)
        const price = parseFloat(row.CASE_PRICE) || parseFloat(row.PIECE_PRICE) || 0;
        const color = (row.COLOR_NAME || '').trim();

        if (!style || !size || price <= 0) continue;

        if (!styleMap.has(style)) {
            styleMap.set(style, {
                colors: new Map(),
                allPrices: new Map()
            });
        }

        const styleData = styleMap.get(style);

        // Store by color
        if (!styleData.colors.has(color)) {
            styleData.colors.set(color, new Map());
        }
        styleData.colors.get(color).set(size, price);

        // Store all prices for fallback
        styleData.allPrices.set(size, price);
    }

    // Calculate size upcharges for each style
    for (const [style, styleData] of styleMap) {
        styleData.basePrices = {};
        styleData.sizeUpcharges = {};

        // Find base price (lowest price among standard sizes S-XL)
        let basePrice = Infinity;
        const standardSizes = ['S', 'M', 'L', 'XL'];

        for (const size of standardSizes) {
            const price = styleData.allPrices.get(size);
            if (price && price < basePrice) {
                basePrice = price;
            }
        }

        // If no standard sizes, use lowest available
        if (basePrice === Infinity) {
            for (const [size, price] of styleData.allPrices) {
                if (price < basePrice) {
                    basePrice = price;
                }
            }
        }

        // Calculate upcharges relative to base
        for (const [size, price] of styleData.allPrices) {
            styleData.basePrices[size] = price;
            styleData.sizeUpcharges[size] = Math.round((price - basePrice) * 100) / 100;
        }

        styleData.basePrice = basePrice;
    }

    console.log(`  Loaded ${styleMap.size} unique SanMar styles with CASE_PRICE pricing`);
    return styleMap;
}

/**
 * Load Richardson Factory Direct styles
 */
function loadRichardsonStyles() {
    const factoryDirectStyles = [
        'PTS20M', 'PTS205', 'PTS30S', 'PTS50S', 'PTS65',
        'R15', 'R18', 'R20', 'R22', 'R45', 'R55', 'R65S', 'R75S',
        '110', '111', '111P', '111PT', '111T',
        '112', '112FP', '112FPC', '112FPR', '112PT', '112T', '112P', '112PFP', '112PM',
        '112+', '112RE', '112WF', '112WH', '112LN',
        '113', '115', '115CH', '121', '126', '130', '134', '135', '137', '139RE',
        '141', '143', '145', '146', '147', '148', '149', '154', '157',
        '160', '163', '168', '168P', '169', '172', '173', '176', '185',
        '203', '212', '213', '214', '217', '220', '222', '224RE', '225',
        '252', '252L', '253', '254RE', '255', '256', '256P', '257', '258', '262',
        '309', '312', '320T', '323FPC', '324', '324RE', '326', '336', '355', '380', '382',
        '414', '420', '435', '436', '485', '487', '495',
        '510', '511', '512', '514', '525', '530', '533', '535', '540', '543', '545', '550', '585',
        '632', '633', '634', '643', '653',
        '707', '709', '712', '715', '733', '740', '743', '753', '785', '787',
        '810', '822', '824', '827', '828', '835', '840', '843',
        '862', '863', '865', '870', '874', '882', '882FP', '884',
        '909', '910', '930', '931', '932', '933', '934', '935', '937', '938', '939', '942', '943'
    ];
    return new Set(factoryDirectStyles.map(s => s.toUpperCase()));
}

/**
 * Fetch service codes from API
 */
async function fetchServiceCodes() {
    const fetch = require('node-fetch');

    try {
        const response = await fetch(`${API_BASE}/api/service-codes`);
        const result = await response.json();
        const codes = new Set();

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
        console.warn('  Could not fetch service codes, using built-in patterns');
        return new Set(SERVICE_CODE_PATTERNS.exact.map(c => c.toUpperCase()));
    }
}

/**
 * Load orders CSV
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

// ============================================
// CLASSIFICATION FUNCTIONS
// ============================================

/**
 * Check if part number is a service code
 */
function matchServiceCode(partNumber, apiServiceCodes) {
    const normalized = partNumber.toUpperCase().trim();

    if (apiServiceCodes.has(normalized)) {
        return { isMatch: true, code: normalized };
    }

    for (const code of SERVICE_CODE_PATTERNS.exact) {
        if (normalized === code.toUpperCase()) {
            return { isMatch: true, code };
        }
    }

    for (const prefix of SERVICE_CODE_PATTERNS.prefixed) {
        if (normalized.startsWith(prefix.toUpperCase())) {
            return { isMatch: true, code: normalized };
        }
    }

    for (const [alias, canonical] of Object.entries(SERVICE_CODE_PATTERNS.aliases)) {
        if (normalized === alias.toUpperCase()) {
            return { isMatch: true, code: canonical };
        }
    }

    return { isMatch: false };
}

/**
 * Check if part number matches SanMar product
 */
function matchSanmarProduct(partNumber, sanmarPricing) {
    const normalized = partNumber.toUpperCase().trim();

    // Direct match
    if (sanmarPricing.has(normalized)) {
        return { isMatch: true, style: normalized };
    }

    // Strip size suffix
    const baseStyle = normalized.replace(/_(2X|3X|4X|5X|6X|XS|XXL|LT|XLT|2XLT|3XLT|4XLT|5XLT|XLR|LR|SR|MR|OSFA|S\/M|L\/XL|M\/L|NB)$/i, '');
    if (sanmarPricing.has(baseStyle)) {
        return { isMatch: true, style: baseStyle };
    }

    // Try _OSFA suffix
    if (sanmarPricing.has(normalized + '_OSFA')) {
        return { isMatch: true, style: normalized + '_OSFA' };
    }

    // Strip C prefix (caps)
    if (normalized.startsWith('C') && normalized.length > 2) {
        const withoutC = normalized.substring(1);
        if (sanmarPricing.has(withoutC)) {
            return { isMatch: true, style: withoutC };
        }
    }

    return { isMatch: false };
}

/**
 * Check if part number matches Richardson Factory Direct
 */
function matchRichardson(partNumber, richardsonStyles) {
    const normalized = partNumber.toUpperCase().trim();

    if (richardsonStyles.has(normalized)) {
        return { isMatch: true, style: normalized };
    }

    // Strip size suffix
    const baseStyle = normalized.replace(/_(SM\/MD|LG\/XL|MG-LG|S\/M|M\/L|L\/XL|OSFA|2X|3X)$/i, '');
    if (richardsonStyles.has(baseStyle)) {
        return { isMatch: true, style: baseStyle };
    }

    // Strip C prefix
    if (normalized.startsWith('C') && normalized.length > 2) {
        const withoutC = normalized.substring(1);
        if (richardsonStyles.has(withoutC)) {
            return { isMatch: true, style: withoutC };
        }
    }

    return { isMatch: false };
}

/**
 * Extract size from size columns
 * Returns the size that has a quantity
 */
function extractSizeFromRow(row) {
    const sizeMap = {
        'Size01_Req': 'S',
        'Size02_Req': 'M',
        'Size03_Req': 'L',
        'Size04_Req': 'XL',
        'Size05_Req': '2XL',
        'Size06_Req': '3XL'
    };

    // Find which size column has quantity
    // Note: This CSV format has quantities spread across size columns
    for (const [col, sizeName] of Object.entries(sizeMap)) {
        const qty = parseFloat(row[col] || 0);
        if (qty > 0) {
            return { size: sizeName, quantity: qty };
        }
    }

    return null;
}

/**
 * Get total quantity across all size columns
 */
function getTotalQuantity(row) {
    let total = 0;
    for (let i = 1; i <= 6; i++) {
        const val = parseFloat(row[`Size0${i}_Req`] || 0);
        if (!isNaN(val)) {
            total += val;
        }
    }
    return total;
}

// ============================================
// MAIN VALIDATION LOGIC
// ============================================

async function validatePricing() {
    const year = USE_2026_PARAMS ? 2026 : 2025;
    console.log(`\n=== ${year} Embroidery Pricing Validation ===\n`);

    // Load data sources
    const sanmarPricing = loadSanmarPricing();
    const richardsonStyles = loadRichardsonStyles();
    const serviceCodes = await fetchServiceCodes();
    const orders = loadOrders();

    // Initialize pricing calculator with correct year
    const calculator = new PricingCalculator(year);
    await calculator.loadConfig();

    // Results tracking
    const results = {
        totalItems: 0,
        byCategory: {
            SANMAR: { total: 0, matched: 0, close: 0, acceptable: 0, discrepancy: 0, zeroPrice: 0, noPricing: 0, items: [] },
            SERVICE_CODE: { total: 0, items: [] },
            RICHARDSON_FD: { total: 0, items: [] },
            NON_SANMAR: { total: 0, items: [] },
            ODDBALL: { total: 0, items: [] },
            SKIP: { total: 0 }
        },
        discrepancies: [],
        summary: {
            matchRate: 0,
            avgDifference: 0,
            maxDifference: 0,
            testedItems: 0  // Items with valid pricing comparison
        }
    };

    // Group orders by order ID to determine tier
    const orderGroups = new Map();
    for (const row of orders) {
        const orderId = row.id_Order || 'UNKNOWN';
        if (!orderGroups.has(orderId)) {
            orderGroups.set(orderId, []);
        }
        orderGroups.get(orderId).push(row);
    }

    console.log(`\nValidating ${orders.length} line items across ${orderGroups.size} orders...\n`);

    // Progress tracking
    let processed = 0;
    const progressInterval = Math.floor(orders.length / 20);

    // Process each line item
    for (const row of orders) {
        results.totalItems++;
        processed++;

        // Progress indicator
        if (processed % progressInterval === 0) {
            const pct = Math.floor((processed / orders.length) * 100);
            process.stdout.write(`  [${pct}%] ${processed}/${orders.length}\r`);
        }

        const partNumber = (row.PartNumber || '').trim();
        const actualPrice = parseFloat(row.cnCur_UnitPriceUsed) || 0;
        const unitCost = parseFloat(row.cnCur_UnitCostProduct) || 0;
        const orderId = row.id_Order;
        const quantity = getTotalQuantity(row);
        const sizeInfo = extractSizeFromRow(row);

        // Skip empty rows
        if (!partNumber) {
            results.byCategory.SKIP.total++;
            continue;
        }

        // Check service code first
        const serviceMatch = matchServiceCode(partNumber, serviceCodes);
        if (serviceMatch.isMatch) {
            results.byCategory.SERVICE_CODE.total++;
            results.byCategory.SERVICE_CODE.items.push({
                orderId,
                partNumber,
                code: serviceMatch.code,
                actualPrice,
                quantity
            });
            continue;
        }

        // Check SanMar
        const sanmarMatch = matchSanmarProduct(partNumber, sanmarPricing);
        if (sanmarMatch.isMatch) {
            results.byCategory.SANMAR.total++;

            // Skip items with $0 actual price (adjustments, included items, etc.)
            if (actualPrice <= 0) {
                results.byCategory.SANMAR.zeroPrice++;
                results.byCategory.SANMAR.items.push({
                    orderId,
                    partNumber,
                    style: sanmarMatch.style,
                    actualPrice,
                    calculatedPrice: null,
                    difference: null,
                    status: 'ZERO_PRICE',
                    notes: 'Zero price - likely adjustment or included item'
                });
                continue;
            }

            // Get pricing data for this style
            const styleData = sanmarPricing.get(sanmarMatch.style);

            if (!styleData || !styleData.basePrice) {
                // No pricing data available
                results.byCategory.SANMAR.noPricing++;
                results.byCategory.SANMAR.items.push({
                    orderId,
                    partNumber,
                    style: sanmarMatch.style,
                    actualPrice,
                    calculatedPrice: null,
                    difference: null,
                    status: 'NO_PRICING_DATA',
                    notes: 'No SanMar base price found'
                });
                continue;
            }

            // Determine size and upcharge
            const size = sizeInfo?.size || 'M';
            const sizeUpcharge = styleData.sizeUpcharges[size] || 0;
            const baseCost = styleData.basePrices[size] || styleData.basePrice;

            // Calculate expected price using our formula
            // Note: We assume 8K stitches as default (most common)
            // Order-level quantity is used for tier determination
            const orderItems = orderGroups.get(orderId) || [];
            const orderTotalQty = orderItems.reduce((sum, item) => sum + getTotalQuantity(item), 0);

            const pricing = calculator.calculateDecoratedPrice(
                baseCost,
                orderTotalQty,
                8000,
                sizeUpcharge
            );

            const calculatedPrice = pricing.finalPrice;
            const difference = Math.abs(actualPrice - calculatedPrice);

            // Classify the result
            let status;
            if (difference <= TOLERANCE.EXACT) {
                status = 'MATCHED';
                results.byCategory.SANMAR.matched++;
            } else if (difference <= TOLERANCE.CLOSE) {
                status = 'CLOSE';
                results.byCategory.SANMAR.close++;
            } else if (difference <= TOLERANCE.ACCEPTABLE) {
                status = 'ACCEPTABLE';
                results.byCategory.SANMAR.acceptable++;
            } else {
                status = 'DISCREPANCY';
                results.byCategory.SANMAR.discrepancy++;
            }

            const item = {
                orderId,
                partNumber,
                style: sanmarMatch.style,
                size,
                quantity,
                orderQty: orderTotalQty,
                tier: pricing.tier,
                baseCost,
                sizeUpcharge,
                actualPrice,
                calculatedPrice: Math.round(calculatedPrice * 100) / 100,
                difference: Math.round(difference * 100) / 100,
                status,
                embCost: pricing.embCost,
                garmentCost: Math.round(pricing.garmentCost * 100) / 100,
                roundedBase: pricing.roundedBase
            };

            results.byCategory.SANMAR.items.push(item);

            if (status === 'DISCREPANCY') {
                results.discrepancies.push(item);
            }

            continue;
        }

        // Check Richardson
        const richardsonMatch = matchRichardson(partNumber, richardsonStyles);
        if (richardsonMatch.isMatch) {
            results.byCategory.RICHARDSON_FD.total++;
            results.byCategory.RICHARDSON_FD.items.push({
                orderId,
                partNumber,
                style: richardsonMatch.style,
                actualPrice,
                quantity,
                notes: 'Cap pricing - separate validation needed'
            });
            continue;
        }

        // Check known vendors (from known-vendors.js)
        const { identifyNonSanmarVendor } = require('./known-vendors');
        const vendorMatch = identifyNonSanmarVendor(partNumber);
        if (vendorMatch) {
            results.byCategory.NON_SANMAR.total++;
            results.byCategory.NON_SANMAR.items.push({
                orderId,
                partNumber,
                vendor: vendorMatch.vendor,
                productType: vendorMatch.productType,
                actualPrice,
                quantity
            });
            continue;
        }

        // Oddball - cannot classify
        results.byCategory.ODDBALL.total++;
        results.byCategory.ODDBALL.items.push({
            orderId,
            partNumber,
            description: row.PartDescriptionUnits,
            actualPrice,
            quantity
        });
    }

    console.log('\n');

    // Calculate summary statistics (only for items with valid pricing comparison)
    const testedItems = results.byCategory.SANMAR.items.filter(i =>
        i.status && i.status !== 'ZERO_PRICE' && i.status !== 'NO_PRICING_DATA' && i.difference !== null
    );
    results.summary.testedItems = testedItems.length;

    if (testedItems.length > 0) {
        const totalDiff = testedItems.reduce((sum, i) => sum + i.difference, 0);
        results.summary.avgDifference = Math.round((totalDiff / testedItems.length) * 100) / 100;
        results.summary.maxDifference = Math.round(Math.max(...testedItems.map(i => i.difference)) * 100) / 100;
        results.summary.matchRate = Math.round((results.byCategory.SANMAR.matched / testedItems.length) * 1000) / 10;
    }

    return results;
}

/**
 * Generate CSV report of discrepancies
 */
function generateCsvReport(results) {
    const headers = [
        'Order ID',
        'Part Number',
        'Style',
        'Size',
        'Line Qty',
        'Order Qty',
        'Tier',
        'Base Cost',
        'Upcharge',
        'Actual Price',
        'Calculated Price',
        'Difference',
        'Status',
        'Emb Cost',
        'Garment Cost',
        'Rounded Base'
    ];

    const rows = [headers.join(',')];

    // Write all SANMAR items (not just discrepancies) for full analysis
    for (const item of results.byCategory.SANMAR.items) {
        if (item.status) {
            rows.push([
                item.orderId,
                item.partNumber,
                item.style,
                item.size,
                item.quantity,
                item.orderQty,
                item.tier,
                item.baseCost,
                item.sizeUpcharge,
                item.actualPrice,
                item.calculatedPrice,
                item.difference,
                item.status,
                item.embCost,
                item.garmentCost,
                item.roundedBase
            ].join(','));
        }
    }

    return rows.join('\n');
}

/**
 * Print summary to console
 */
function printSummary(results) {
    console.log('='.repeat(50));
    console.log('VALIDATION RESULTS');
    console.log('='.repeat(50));

    console.log(`\nTotal line items: ${results.totalItems}`);

    console.log('\nBY CATEGORY:');
    console.log(`  - SANMAR products: ${results.byCategory.SANMAR.total} (testable)`);
    console.log(`  - Service codes: ${results.byCategory.SERVICE_CODE.total} (separate pricing)`);
    console.log(`  - Richardson caps: ${results.byCategory.RICHARDSON_FD.total} (cap pricing)`);
    console.log(`  - Non-SanMar/vendors: ${results.byCategory.NON_SANMAR.total} (manual review)`);
    console.log(`  - Oddballs: ${results.byCategory.ODDBALL.total} (skipped)`);
    console.log(`  - Empty/skipped: ${results.byCategory.SKIP.total}`);

    console.log('\nSANMAR PRICING RESULTS:');
    const sm = results.byCategory.SANMAR;
    const tested = results.summary.testedItems;
    console.log(`  Total SANMAR items: ${sm.total}`);
    console.log(`  - Zero price (skipped): ${sm.zeroPrice || 0}`);
    console.log(`  - No pricing data: ${sm.noPricing || 0}`);
    console.log(`  - Tested: ${tested}`);
    if (tested > 0) {
        const formulaCorrect = sm.matched + sm.close + sm.acceptable;
        console.log(`\n  PRICING ACCURACY (of ${tested} tested):`);
        console.log(`    MATCHED (±$${TOLERANCE.EXACT}): ${sm.matched} (${Math.round(sm.matched/tested*1000)/10}%)`);
        console.log(`    CLOSE (±$${TOLERANCE.CLOSE}): ${sm.close} (${Math.round(sm.close/tested*1000)/10}%)`);
        console.log(`    ACCEPTABLE (±$${TOLERANCE.ACCEPTABLE}): ${sm.acceptable} (${Math.round(sm.acceptable/tested*1000)/10}%)`);
        console.log(`    ────────────────────────────────`);
        console.log(`    FORMULA CORRECT (≤$5): ${formulaCorrect} (${Math.round(formulaCorrect/tested*1000)/10}%)`);
        console.log(`    CUSTOM PRICED (>$5): ${sm.discrepancy} (${Math.round(sm.discrepancy/tested*1000)/10}%)`);
    }

    console.log('\nSTATISTICS:');
    console.log(`  Average difference: $${results.summary.avgDifference}`);
    console.log(`  Maximum difference: $${results.summary.maxDifference}`);
    console.log(`  Match rate: ${results.summary.matchRate}%`);

    if (VERBOSE && results.discrepancies.length > 0) {
        console.log('\nTOP 10 DISCREPANCIES:');
        const topDiscrepancies = results.discrepancies
            .sort((a, b) => b.difference - a.difference)
            .slice(0, 10);

        for (const d of topDiscrepancies) {
            console.log(`  Order ${d.orderId}: ${d.partNumber} ${d.size}`);
            console.log(`    Actual: $${d.actualPrice} | Calc: $${d.calculatedPrice} | Diff: $${d.difference}`);
            console.log(`    Tier: ${d.tier} | Base: $${d.baseCost} | Emb: $${d.embCost}`);
        }
    }

    console.log('\n' + '='.repeat(50));
}

// ============================================
// LTM (LESS THAN MINIMUM) ANALYSIS
// ============================================

/**
 * Analyze 2025 orders for LTM (Less Than Minimum) fee potential
 *
 * LTM orders have <24 total pieces across ALL line items in the order.
 * This analysis calculates potential revenue from consistently charging $50 LTM fee.
 */
async function runLtmAnalysis() {
    console.log('\n=== 2025 LTM (Less Than Minimum) Analysis ===\n');

    const orders = loadOrders();

    // Group by order ID and calculate total pieces per order
    const orderTotals = new Map();
    for (const row of orders) {
        const orderId = row.id_Order || 'UNKNOWN';
        const lineQty = getTotalQuantity(row);
        orderTotals.set(orderId, (orderTotals.get(orderId) || 0) + lineQty);
    }

    console.log(`Loaded ${orders.length} line items across ${orderTotals.size} orders\n`);

    // Analyze LTM vs non-LTM
    let ltmOrders = 0;
    let nonLtmOrders = 0;
    const ltmBuckets = { '1-5': 0, '6-11': 0, '12-17': 0, '18-23': 0 };
    const ltmOrderIds = [];

    for (const [orderId, totalQty] of orderTotals) {
        if (totalQty < LTM_THRESHOLD) {
            ltmOrders++;
            ltmOrderIds.push({ orderId, qty: totalQty });

            if (totalQty <= 5) ltmBuckets['1-5']++;
            else if (totalQty <= 11) ltmBuckets['6-11']++;
            else if (totalQty <= 17) ltmBuckets['12-17']++;
            else ltmBuckets['18-23']++;
        } else {
            nonLtmOrders++;
        }
    }

    // Print results
    const totalOrders = ltmOrders + nonLtmOrders;
    const potentialRevenue = ltmOrders * LTM_FEE;

    console.log('─'.repeat(50));
    console.log(`Total Orders: ${totalOrders.toLocaleString()}`);
    console.log(`LTM Orders (<${LTM_THRESHOLD} pieces): ${ltmOrders.toLocaleString()} (${(ltmOrders/totalOrders*100).toFixed(1)}%)`);
    console.log(`Non-LTM Orders (≥${LTM_THRESHOLD} pieces): ${nonLtmOrders.toLocaleString()} (${(nonLtmOrders/totalOrders*100).toFixed(1)}%)`);
    console.log('─'.repeat(50));

    console.log('\nLTM ORDER BREAKDOWN:');
    for (const [range, count] of Object.entries(ltmBuckets)) {
        const pct = ltmOrders > 0 ? (count / ltmOrders * 100).toFixed(1) : '0.0';
        console.log(`  ${range.padEnd(12)} pieces: ${count.toString().padStart(4)} orders (${pct}% of LTM)`);
    }

    console.log('\n' + '─'.repeat(50));
    console.log('POTENTIAL 2026 REVENUE:');
    console.log(`  LTM orders:        ${ltmOrders.toLocaleString()}`);
    console.log(`  LTM fee:           $${LTM_FEE.toFixed(2)}`);
    console.log('  ─────────────────────────────');
    console.log(`  Potential revenue: $${potentialRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
    console.log('─'.repeat(50));

    console.log('\nNote: Assumes consistent $50 LTM fee charged on all orders <24 pieces');

    // Verbose: show sample LTM orders
    if (VERBOSE) {
        console.log('\nSAMPLE LTM ORDERS (first 20):');
        const samples = ltmOrderIds.slice(0, 20);
        for (const { orderId, qty } of samples) {
            console.log(`  Order ${orderId}: ${qty} pieces`);
        }
    }

    // Save analysis to JSON
    const analysisReport = {
        timestamp: new Date().toISOString(),
        summary: {
            totalOrders,
            ltmOrders,
            nonLtmOrders,
            ltmPercentage: Math.round(ltmOrders / totalOrders * 1000) / 10,
            ltmFee: LTM_FEE,
            ltmThreshold: LTM_THRESHOLD,
            potentialRevenue
        },
        ltmBreakdown: ltmBuckets
    };

    const reportPath = path.join(__dirname, '../reports/ltm-analysis.json');
    fs.writeFileSync(reportPath, JSON.stringify(analysisReport, null, 2));
    console.log(`\nAnalysis saved: ${reportPath}\n`);
}

// ============================================
// HELP TEXT
// ============================================

function printHelp() {
    console.log(`
2025 Embroidery Pricing Validation Script

USAGE:
  npm run test:emb-pricing           Validate with 2025 parameters
  npm run test:emb-calibrate         Calculate implied 2025 embroidery costs
  npm run test:emb-ltm               Analyze LTM orders and revenue potential
  npm run test:emb-pricing-verbose   Verbose output with top discrepancies

OPTIONS:
  --calibrate          Run calibration mode to calculate implied embroidery costs
  --ltm-analysis       Analyze Less Than Minimum (<24 pieces) orders for 2026 fee revenue
  --verbose, -v        Show detailed output including top discrepancies
  --year 2026          Use 2026 API parameters instead of 2025 hardcoded values
  --emb-costs="X,X,X,X"  Override embroidery costs (tier1,tier2,tier3,tier4)
  --help, -h           Show this help

EXAMPLES:
  node validate-2025-embroidery-pricing.js --calibrate
  node validate-2025-embroidery-pricing.js --ltm-analysis
  node validate-2025-embroidery-pricing.js --emb-costs="12,11,10,9"
  node validate-2025-embroidery-pricing.js --year 2026 --verbose
`);
}

// ============================================
// MAIN EXECUTION
// ============================================

async function main() {
    // Show help if requested
    if (process.argv.includes('--help') || process.argv.includes('-h')) {
        printHelp();
        return;
    }

    try {
        // Run calibration mode if requested
        if (CALIBRATE_MODE) {
            await runCalibration();
            return;
        }

        // Run LTM analysis mode if requested
        if (LTM_ANALYSIS) {
            await runLtmAnalysis();
            return;
        }

        // Run validation
        const results = await validatePricing();

        // Generate reports
        const csvReport = generateCsvReport(results);
        fs.writeFileSync(REPORT_CSV_PATH, csvReport);
        console.log(`Report saved: ${REPORT_CSV_PATH}`);

        fs.writeFileSync(SUMMARY_JSON_PATH, JSON.stringify(results, null, 2));
        console.log(`Summary saved: ${SUMMARY_JSON_PATH}`);

        // Print summary
        printSummary(results);

    } catch (error) {
        console.error('Validation failed:', error);
        process.exit(1);
    }
}

main();
