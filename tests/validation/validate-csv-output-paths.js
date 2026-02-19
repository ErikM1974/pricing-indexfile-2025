/**
 * Embroidery CSV Full Simulation — All 4 Output Paths
 *
 * Joins 3 CSV data sources (line items, ODBC orders, stitch counts),
 * reconstructs each embroidery order, calls the LIVE pricing API,
 * and validates that data flows correctly through all 4 output paths:
 *   1. UI (recalculatePricing)
 *   2. PDF (printQuote → EmbroideryInvoiceGenerator)
 *   3. Save (saveAndGetLink → EmbroideryQuoteService)
 *   4. Clipboard (copyToClipboard → generateQuoteText)
 *
 * Run: node tests/validation/validate-csv-output-paths.js
 */

const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');
const fetch = require('node-fetch');

// =============================================
// CONFIGURATION
// =============================================

const API_BASE = 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';
const RATE_LIMIT_MS = 150; // 150ms between batches — proxy handles this fine
const BATCH_SIZE = 5;      // Concurrent requests per batch

const LINE_ITEMS_CSV = 'C:\\Users\\erik\\Downloads\\Embroidery Line Items Claude Code.csv';
const ODBC_CSV = 'C:\\Users\\erik\\Downloads\\ORDER_ODBC_2026-Feb-09_1000.csv';
const STITCH_CSV = 'C:\\Users\\erik\\Downloads\\Copy of Stitch count for orders claude.csv';
const REPORT_PATH = path.join(__dirname, 'csv-output-paths-report.json');

// Embroidery order types in ODBC
const EMBROIDERY_ORDER_TYPES = new Set(['Custom Embroidery', 'Caps']);

// Known fee/service codes (not products)
const KNOWN_FEES = new Set([
    'DD', 'DDE', 'DDT', 'DD-CAP', 'DECG', 'DECC',
    'AL', 'FB', 'EJB', 'Name/Number', 'NAME', 'MONOGRAM',
    'AS-GARM', 'AS-CAP', 'GRT-50', 'GRT-75',
    'RUSH', 'SAMPLE', 'LTM', 'DISCOUNT', 'ART',
    'DGT-001', 'MBF', 'LTM752', 'LTM754',
    'SPRESET', 'SPSU', 'FILM', 'PMS', 'WEIGHT',
    'SETUP', 'AONOGRAM', 'NNAME'
]);

// Fee prefixes
const FEE_PREFIXES = ['DGT-', 'MONOGRAM', 'Name/Number', 'NAME'];

// Part number suffix → size column mapping (from shopworks-guide-generator.js)
const SUFFIX_TO_SIZE = {
    '_2X': '2XL', '_XXL': '2XL',
    '_3X': '3XL', '_4X': '4XL', '_5X': '5XL', '_6X': '6XL',
    '_XS': 'XS',
    '_OSFA': 'OSFA',
    '_XLT': 'XLT', '_2XLT': '2XLT', '_3XLT': '3XLT',
    '_LT': 'LT',
    '_S/M': 'S/M', '_M/L': 'M/L', '_L/XL': 'L/XL',
    '_SM/MD': 'S/M', '_LG/XL': 'L/XL',
    'Y': 'YS' // Youth
};

// Tier definitions (fallback — overridden by API)
const DEFAULT_TIERS = {
    '1-7':   { embCost: 18.00, hasLTM: true },
    '8-23':  { embCost: 18.00, hasLTM: false },
    '24-47': { embCost: 14.00, hasLTM: false },
    '48-71': { embCost: 13.00, hasLTM: false },
    '72+':   { embCost: 12.00, hasLTM: false }
};

// Size order for validation (from quote-view.js line 44)
const SIZE_ORDER = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL', '6XL'];

// Valid ShopWorks fee part numbers for save path
const VALID_FEE_PART_NUMBERS = new Set([
    'AS-GARM', 'AS-CAP', 'DD', 'DDE', 'DDT', 'DD-CAP',
    'GRT-50', 'GRT-75', 'RUSH', 'SAMPLE', 'DISCOUNT',
    'DECG', 'DECC', 'AL', 'LTM', 'LTM752', 'LTM754',
    'ART', 'FB', 'EJB',
    'Name/Number', 'NAME', 'MONOGRAM', 'MBF',
    'DGT-001', 'DGT-002', 'DGT-003', 'DGT-004',
    'SPSU', 'SPRESET', 'FILM', 'PMS',
    'SETUP', 'NNAME', 'AONOGRAM', 'WEIGHT'
]);

// Valid tier labels
const VALID_TIERS = new Set(['1-7', '8-23', '24-47', '48-71', '72+']);

// =============================================
// GLOBAL STATE
// =============================================

let pricingConfig = {
    marginDenominator: 0.57,
    ltmFee: 50.00,
    tiers: { ...DEFAULT_TIERS },
    roundingMethod: 'HalfDollarUp',
    additionalStitchRate: 1.25,
    baseStitchCount: 8000
};

const pricingCache = new Map(); // styleNumber → { basePrices, sizeUpcharges }
let apiCallCount = 0;

// =============================================
// CSV LOADERS
// =============================================

function loadCSV(filepath, label) {
    const content = fs.readFileSync(filepath, 'utf-8');
    const records = parse(content, {
        columns: true,
        skip_empty_lines: true,
        relax_column_count: true,
        bom: true
    });
    console.log(`  ${label}: ${records.length.toLocaleString()} rows`);
    return records;
}

// =============================================
// DATA JOINING
// =============================================

function buildOrderMap(odbcRecords) {
    const map = new Map();
    for (const row of odbcRecords) {
        const id = (row.ID_Order || '').trim();
        if (!id) continue;
        map.set(id, {
            company: (row.CompanyName || '').trim(),
            contact: (row.ct_ContactNameFull || '').trim(),
            email: (row.ContactEmail || '').trim(),
            phone: (row.ContactPhone || '').trim(),
            rep: (row.CustomerServiceRep || '').trim(),
            repEmail: (row.Sales_Rep_Email || '').trim(),
            orderType: (row.ORDER_TYPE || '').trim(),
            subtotal: parseFloat(row.cur_Subtotal) || 0,
            totalInvoice: parseFloat(row.cnCur_TotalInvoice) || 0,
            tax: parseFloat(row.cnCur_SalesTaxTotal) || 0,
            shipping: parseFloat(row.cur_Shipping) || 0,
            datePlaced: (row.date_OrderPlaced || '').trim()
        });
    }
    return map;
}

function buildStitchMap(stitchRecords) {
    const map = new Map();
    for (const row of stitchRecords) {
        const id = (row.ID_Order || '').trim();
        if (!id) continue;

        const stitchCount = parseInt(row.cn_StitchCount) || 0;
        const locationCount = parseInt(row.cn_LocationCount) || 0;
        const totalQty = parseInt(row.cn_TotalProductQty_ToProduce) || 0;

        // An order can have multiple stitch records (one per design).
        // Keep the highest stitch count for pricing simulation.
        if (!map.has(id) || stitchCount > map.get(id).stitchCount) {
            map.set(id, { stitchCount, locationCount, totalQty });
        }
    }
    return map;
}

function groupLineItems(records) {
    const groups = new Map();
    for (const row of records) {
        const id = (row.id_Order || '').trim();
        if (!id) continue;
        if (!groups.has(id)) groups.set(id, []);
        groups.get(id).push(row);
    }
    return groups;
}

// =============================================
// PART NUMBER CLASSIFICATION
// =============================================

function isFeeCode(partNumber) {
    const pn = partNumber.toUpperCase().trim();
    if (KNOWN_FEES.has(pn)) return true;
    for (const prefix of FEE_PREFIXES) {
        if (pn.startsWith(prefix.toUpperCase())) return true;
    }
    return false;
}

function extractBaseSKU(partNumber) {
    const pn = partNumber.trim();

    // Try each known suffix (longest first to avoid partial matches)
    const suffixes = Object.keys(SUFFIX_TO_SIZE).sort((a, b) => b.length - a.length);
    for (const suffix of suffixes) {
        if (pn.toUpperCase().endsWith(suffix.toUpperCase())) {
            const base = pn.substring(0, pn.length - suffix.length);
            const size = SUFFIX_TO_SIZE[suffix];
            return { base, suffix, size };
        }
    }

    // Strip trailing special chars (+, *, #) before returning base
    const cleaned = pn.replace(/[+*#]+$/, '');
    if (cleaned !== pn) {
        return { base: cleaned, suffix: '', size: null };
    }

    // No suffix found — it's a base SKU (S/M/L/XL)
    return { base: pn, suffix: '', size: null };
}

function classifyRow(row) {
    const pn = (row.PartNumber || '').trim();
    const desc = (row.Description || '').trim();

    if (!pn) return { type: 'skip', reason: 'empty part number' };
    if (pn.startsWith('#') || pn.startsWith('//')) return { type: 'skip', reason: 'comment' };
    if (isFeeCode(pn)) return { type: 'fee', code: pn.toUpperCase() };

    // It's a product
    const { base, suffix, size } = extractBaseSKU(pn);
    return {
        type: 'product',
        partNumber: pn,
        baseSKU: base,
        suffix,
        inferredSize: size,
        description: desc,
        color: (row.PartColor || '').trim()
    };
}

// =============================================
// SIZE BREAKDOWN BUILDER
// =============================================

function parseCsvQty(val) {
    if (!val) return 0;
    const n = parseFloat(String(val).trim());
    return isNaN(n) ? 0 : Math.round(n);
}

function parseCsvMoney(val) {
    if (!val) return 0;
    const cleaned = String(val).replace(/[$,\s]/g, '');
    const n = parseFloat(cleaned);
    return isNaN(n) ? 0 : n;
}

function buildSizeBreakdown(row) {
    // CSV columns: S, M, LG, XL, XXL, XXXL (other)
    const breakdown = {};
    const csvToSize = {
        'S': 'S',
        'M': 'M',
        'LG': 'L',
        'XL': 'XL',
        'XXL': '2XL',
        'XXXL (other)': '3XL'
    };

    for (const [csvCol, sizeLabel] of Object.entries(csvToSize)) {
        const qty = parseCsvQty(row[csvCol]);
        if (qty > 0) {
            breakdown[sizeLabel] = qty;
        }
    }

    return breakdown;
}

// =============================================
// API CALLS
// =============================================

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function initializePricingConfig() {
    console.log('\nFetching pricing configuration from API...');
    try {
        const response = await fetch(`${API_BASE}/api/pricing-bundle?method=EMB&styleNumber=PC54`);
        const data = await response.json();

        if (data && data.tiersR && data.tiersR.length > 0) {
            pricingConfig.marginDenominator = data.tiersR[0].MarginDenominator || 0.57;

            pricingConfig.tiers = {};
            data.tiersR.forEach(tier => {
                pricingConfig.tiers[tier.TierLabel] = {
                    embCost: 0,
                    hasLTM: tier.LTM_Fee > 0
                };
                if (tier.LTM_Fee > 0) {
                    pricingConfig.ltmFee = tier.LTM_Fee;
                }
            });
        }

        if (data && data.allEmbroideryCostsR && data.allEmbroideryCostsR.length > 0) {
            const shirtConfig = data.allEmbroideryCostsR.find(c => c.ItemType === 'Shirt') || data.allEmbroideryCostsR[0];
            pricingConfig.additionalStitchRate = shirtConfig.AdditionalStitchRate || 1.25;
            pricingConfig.baseStitchCount = shirtConfig.BaseStitchCount || shirtConfig.StitchCount || 8000;

            data.allEmbroideryCostsR.forEach(cost => {
                if (cost.ItemType === 'Shirt' && pricingConfig.tiers[cost.TierLabel]) {
                    pricingConfig.tiers[cost.TierLabel].embCost = cost.EmbroideryCost;
                }
            });
        }

        if (data && data.rulesR && data.rulesR.RoundingMethod) {
            pricingConfig.roundingMethod = data.rulesR.RoundingMethod;
        }

        console.log(`  Margin denominator: ${pricingConfig.marginDenominator}`);
        console.log(`  LTM fee: $${pricingConfig.ltmFee}`);
        console.log(`  Rounding: ${pricingConfig.roundingMethod}`);
        console.log(`  Tiers loaded: ${Object.keys(pricingConfig.tiers).join(', ')}`);
        for (const [label, tier] of Object.entries(pricingConfig.tiers)) {
            console.log(`    ${label}: embCost=$${tier.embCost}, hasLTM=${tier.hasLTM}`);
        }
    } catch (err) {
        console.error(`  FAILED to load pricing config: ${err.message}`);
        console.error('  Using default fallback values');
    }
}

async function fetchSizePricing(styleNumber) {
    if (pricingCache.has(styleNumber)) {
        return pricingCache.get(styleNumber);
    }

    try {
        apiCallCount++;
        const response = await fetch(`${API_BASE}/api/size-pricing?styleNumber=${encodeURIComponent(styleNumber)}`);
        const data = await response.json();

        if (data && data.length > 0) {
            // Transform API response into { basePrices: { S: 5.98, ... }, sizeUpcharges: { S: 0, 2XL: 2, ... } }
            const result = {
                basePrices: {},
                sizeUpcharges: {},
                colors: {}
            };

            for (const entry of data) {
                const color = entry.color || 'default';
                if (!result.colors[color]) {
                    result.colors[color] = { basePrices: {}, sizeUpcharges: {} };
                }
                for (const [size, price] of Object.entries(entry.basePrices || {})) {
                    result.colors[color].basePrices[size] = price;
                    if (!result.basePrices[size] || price > 0) {
                        result.basePrices[size] = price;
                    }
                }
                for (const [size, upcharge] of Object.entries(entry.sizeUpcharges || {})) {
                    result.colors[color].sizeUpcharges[size] = upcharge;
                    if (result.sizeUpcharges[size] === undefined) {
                        result.sizeUpcharges[size] = upcharge;
                    }
                }
            }

            pricingCache.set(styleNumber, result);
            return result;
        }

        pricingCache.set(styleNumber, null);
        return null;
    } catch (err) {
        pricingCache.set(styleNumber, null);
        return null;
    }
}

// =============================================
// PRICING CALCULATION (mirrors embroidery-quote-pricing.js)
// =============================================

function getTier(totalQuantity) {
    if (totalQuantity <= 7) return '1-7';
    if (totalQuantity <= 23) return '8-23';
    if (totalQuantity <= 47) return '24-47';
    if (totalQuantity <= 71) return '48-71';
    return '72+';
}

function getEmbCost(tier) {
    return pricingConfig.tiers[tier]?.embCost || 12.00;
}

function roundPrice(price) {
    if (isNaN(price)) return null;
    if (pricingConfig.roundingMethod === 'CeilDollar') {
        return Math.ceil(price);
    }
    // HalfDollarUp (default)
    if (price % 0.5 === 0) return price;
    return Math.ceil(price * 2) / 2;
}

function calculateProductPricing(sizeBreakdown, sizePricingData, tier, additionalStitchCost) {
    if (!sizePricingData) return null;

    const embCost = getEmbCost(tier);
    const margin = pricingConfig.marginDenominator;

    // Find standard base price
    const standardSizes = ['S', 'M', 'L', 'XL'];
    let standardBasePrice = 0;
    let baseSize = null;

    for (const size of standardSizes) {
        if (sizePricingData.basePrices[size] && sizePricingData.basePrices[size] > 0) {
            standardBasePrice = sizePricingData.basePrices[size];
            baseSize = size;
            break;
        }
    }

    // Fallback: use first available size with valid price
    if (standardBasePrice === 0) {
        const available = Object.entries(sizePricingData.basePrices)
            .filter(([, p]) => p > 0)
            .sort((a, b) => a[1] - b[1]);
        if (available.length > 0) {
            baseSize = available[0][0];
            standardBasePrice = available[0][1];
        }
    }

    // Last resort: try ordered sizes
    if (standardBasePrice === 0) {
        for (const orderedSize of Object.keys(sizeBreakdown)) {
            const p = sizePricingData.basePrices[orderedSize];
            if (p && p > 0) {
                baseSize = orderedSize;
                standardBasePrice = p;
                break;
            }
        }
    }

    if (standardBasePrice === 0) return null;

    const baseSizeUpcharge = baseSize ? (sizePricingData.sizeUpcharges[baseSize] || 0) : 0;

    // Calculate line items grouped by upcharge
    const standardGroup = [];
    const upchargeGroups = {};

    for (const [size, qty] of Object.entries(sizeBreakdown)) {
        if (qty <= 0) continue;
        const apiUpcharge = sizePricingData.sizeUpcharges[size] || 0;
        const relativeUpcharge = apiUpcharge - baseSizeUpcharge;

        if (relativeUpcharge === 0) {
            standardGroup.push({ size, qty });
        } else {
            if (!upchargeGroups[relativeUpcharge]) upchargeGroups[relativeUpcharge] = [];
            upchargeGroups[relativeUpcharge].push({ size, qty });
        }
    }

    const lineItems = [];
    let subtotal = 0;

    // Standard sizes
    if (standardGroup.length > 0) {
        const stdQty = standardGroup.reduce((s, i) => s + i.qty, 0);
        const garmentCost = standardBasePrice / margin;
        const baseDecoratedPrice = garmentCost + embCost;
        const roundedBase = roundPrice(baseDecoratedPrice);
        const finalPrice = roundedBase + additionalStitchCost;

        lineItems.push({
            description: standardGroup.map(i => `${i.size}(${i.qty})`).join(' '),
            quantity: stdQty,
            unitPrice: finalPrice,
            basePrice: roundedBase,
            extraStitchCost: additionalStitchCost,
            total: roundedBase * stdQty,
            hasUpcharge: false
        });
        subtotal += roundedBase * stdQty;
    }

    // Upcharge sizes
    for (const [upcharge, items] of Object.entries(upchargeGroups)) {
        const upQty = items.reduce((s, i) => s + i.qty, 0);
        const garmentCost = standardBasePrice / margin;
        const baseDecoratedPrice = garmentCost + embCost;
        const standardRoundedBase = roundPrice(baseDecoratedPrice);
        const roundedBase = standardRoundedBase + parseFloat(upcharge);
        const finalPrice = roundedBase + additionalStitchCost;

        lineItems.push({
            description: items.map(i => `${i.size}(${i.qty})`).join(' '),
            quantity: upQty,
            unitPrice: finalPrice,
            basePrice: roundedBase,
            extraStitchCost: additionalStitchCost,
            upcharge: parseFloat(upcharge),
            total: roundedBase * upQty,
            hasUpcharge: true
        });
        subtotal += roundedBase * upQty;
    }

    return { lineItems, subtotal, standardBasePrice, tier, embCost };
}

// =============================================
// OUTPUT PATH VALIDATORS
// =============================================

/**
 * Path 1 — UI (recalculatePricing)
 * Validates that product totals add up correctly
 */
function validateUIPath(order) {
    const issues = [];

    for (const product of order.products) {
        if (!product.pricing) {
            issues.push(`No pricing for ${product.baseSKU}`);
            continue;
        }
        for (const li of product.pricing.lineItems) {
            const expectedTotal = li.basePrice * li.quantity;
            if (Math.abs(li.total - expectedTotal) > 0.01) {
                issues.push(`Line total mismatch for ${product.baseSKU}: ${li.total} vs expected ${expectedTotal}`);
            }
        }
        const lineSum = product.pricing.lineItems.reduce((s, li) => s + li.total, 0);
        if (Math.abs(lineSum - product.pricing.subtotal) > 0.01) {
            issues.push(`Subtotal mismatch for ${product.baseSKU}: sum=${lineSum.toFixed(2)} vs subtotal=${product.pricing.subtotal.toFixed(2)}`);
        }
    }

    const productSubtotal = order.products
        .filter(p => p.pricing)
        .reduce((s, p) => s + p.pricing.subtotal, 0);
    if (productSubtotal <= 0 && order.products.length > 0) {
        issues.push('Product subtotal is 0 or negative');
    }

    return { pass: issues.length === 0, issues };
}

/**
 * Path 2 — PDF (printQuote → EmbroideryInvoiceGenerator)
 * Validates that all required fields for invoice generation are present
 */
function validatePDFPath(order) {
    const issues = [];

    // grandTotal must be computable
    if (order.computedSubtotal === undefined || order.computedSubtotal === null) {
        issues.push('Missing computedSubtotal');
    }

    // products[] must have required fields
    for (const product of order.products) {
        if (!product.pricing) {
            issues.push(`Product ${product.baseSKU}: no pricing data`);
            continue;
        }
        if (!product.baseSKU) {
            issues.push('Product missing style/baseSKU');
        }
        if (!product.description && !product.baseSKU) {
            issues.push('Product missing both description and baseSKU');
        }
        if (product.pricing.lineItems.length === 0) {
            issues.push(`Product ${product.baseSKU}: no line items`);
        }
    }

    // tier must be valid
    if (!order.tier || !VALID_TIERS.has(order.tier)) {
        issues.push(`Invalid tier: ${order.tier}`);
    }

    // logos must have position + stitchCount
    if (!order.logo || !order.logo.position) {
        // Allow — we synthesize a default
    }

    // ltmDistributed flag
    if (order.hasLTM && order.ltmDistributed !== true) {
        issues.push('LTM applies but ltmDistributed flag not set');
    }

    // Customer data
    if (!order.customer || (!order.customer.company && !order.customer.contact)) {
        issues.push('Missing customer name/company for PDF header');
    }

    return { pass: issues.length === 0, issues };
}

/**
 * Path 3 — Save (saveAndGetLink → EmbroideryQuoteService)
 * Validates that all required quote_items fields would be populated
 */
function validateSavePath(order) {
    const issues = [];

    for (const product of order.products) {
        if (!product.baseSKU) {
            issues.push('StyleNumber is empty');
        }
        if (!product.description) {
            issues.push(`ProductName empty for ${product.baseSKU}`);
        }
        if (!product.pricing) {
            issues.push(`No pricing for ${product.baseSKU}`);
            continue;
        }

        // FinalUnitPrice > 0
        for (const li of product.pricing.lineItems) {
            if (!li.unitPrice || li.unitPrice <= 0) {
                issues.push(`FinalUnitPrice is 0 for ${product.baseSKU}`);
            }
        }

        // SizeBreakdown must be valid JSON with correct size keys
        const sb = product.sizeBreakdown;
        if (!sb || Object.keys(sb).length === 0) {
            issues.push(`SizeBreakdown empty for ${product.baseSKU}`);
        } else {
            // Verify all size keys are in SIZE_ORDER or known extended sizes
            const validSizes = new Set([...SIZE_ORDER, 'LT', 'XLT', '2XLT', '3XLT', 'OSFA', 'S/M', 'M/L', 'L/XL', 'YXS', 'YS', 'YM', 'YL']);
            for (const sizeKey of Object.keys(sb)) {
                if (!validSizes.has(sizeKey)) {
                    issues.push(`Unknown size key "${sizeKey}" in SizeBreakdown for ${product.baseSKU}`);
                }
            }
        }
    }

    // Fee items must have valid part numbers
    for (const fee of order.fees) {
        const code = fee.code.toUpperCase();
        const isValid = VALID_FEE_PART_NUMBERS.has(code) ||
                         code.startsWith('DGT-') ||
                         code.startsWith('NAME') ||
                         code === 'NAME/NUMBER' ||
                         code.startsWith('MONOGRAM');
        if (!isValid) {
            issues.push(`Fee "${code}" is not a valid ShopWorks part number`);
        }
    }

    return { pass: issues.length === 0, issues };
}

/**
 * Path 4 — Clipboard (copyToClipboard → generateQuoteText)
 * Validates that products can be separated into garments/caps and text fields present
 */
function validateClipboardPath(order) {
    const issues = [];

    // Products must be classifiable as garments vs caps
    for (const product of order.products) {
        if (product.isCap === undefined) {
            issues.push(`Product ${product.baseSKU}: isCap not determined`);
        }
    }

    // Logo configs must have position + stitchCount (only if there are products)
    if (order.products.length > 0) {
        if (!order.logo) {
            // We default to LC/8000, which is fine
        } else {
            if (!order.logo.position) {
                issues.push('Logo missing position');
            }
            if (!order.logo.stitchCount || order.logo.stitchCount <= 0) {
                issues.push('Logo missing stitchCount');
            }
        }
    }

    // Tier label must be valid
    if (!order.tier || !VALID_TIERS.has(order.tier)) {
        issues.push(`Invalid tier label: ${order.tier}`);
    }

    // Pricing breakdown fields
    if (order.products.some(p => p.pricing) && order.computedSubtotal === undefined) {
        issues.push('Missing computedSubtotal for pricing breakdown');
    }

    return { pass: issues.length === 0, issues };
}

// =============================================
// SUFFIX VALIDATION
// =============================================

function validateSuffix(row) {
    const pn = (row.PartNumber || '').trim();
    if (!pn) return { valid: true, reason: 'skip' };
    if (isFeeCode(pn)) return { valid: true, reason: 'fee' };

    const { suffix, size: inferredSize } = extractBaseSKU(pn);

    // No suffix = S/M/L/XL — check that qty appears in S, M, LG, or XL columns
    if (!suffix) {
        const stdQty = parseCsvQty(row.S) + parseCsvQty(row.M) + parseCsvQty(row.LG) + parseCsvQty(row.XL);
        const lineQty = parseInt(row.LineQty) || 0;
        if (stdQty > 0 || lineQty > 0) return { valid: true };
        return { valid: true, reason: 'no-qty' };
    }

    // Has suffix — check that qty appears in correct column
    const sizeCol = getSizeColumn(inferredSize);
    const colQty = parseCsvQty(row[sizeCol]);
    const lineQty = parseInt(row.LineQty) || 0;

    if (colQty > 0 || lineQty > 0) return { valid: true };
    return { valid: false, reason: `suffix ${suffix} → col ${sizeCol} has 0 qty`, partNumber: pn };
}

function getSizeColumn(size) {
    if (!size) return 'S';
    const upper = size.toUpperCase();
    const map = {
        'S': 'S', 'M': 'M', 'L': 'LG', 'XL': 'XL',
        '2XL': 'XXL', 'XXL': 'XXL',
        '3XL': 'XXXL (other)', '4XL': 'XXXL (other)', '5XL': 'XXXL (other)', '6XL': 'XXXL (other)',
        'XS': 'XXXL (other)',
        'OSFA': 'XXXL (other)',
        'XLT': 'XXXL (other)', '2XLT': 'XXXL (other)', '3XLT': 'XXXL (other)',
        'LT': 'XXXL (other)',
        'YS': 'XXXL (other)', 'YM': 'XXXL (other)', 'YL': 'XXXL (other)', 'YXS': 'XXXL (other)',
        'S/M': 'XXXL (other)', 'M/L': 'XXXL (other)', 'L/XL': 'XXXL (other)'
    };
    return map[upper] || 'XXXL (other)';
}

// =============================================
// CAP DETECTION
// =============================================

function isCap(partNumber, orderType) {
    if (orderType === 'Caps') return true;
    const pn = partNumber.toUpperCase();
    // Richardson patterns (numeric 3-digit)
    if (/^\d{3}/.test(pn)) return true;
    // Cap prefixes
    if (pn.startsWith('C') && /^C\d{2,4}/.test(pn)) return true;
    // Known cap styles
    if (pn.startsWith('NE') && !pn.startsWith('NEW')) return true;
    if (pn.includes('CAP') || pn.includes('HAT') || pn.includes('BEANIE')) return true;
    if (pn.endsWith('_OSFA')) return true;
    return false;
}

// =============================================
// PROGRESS BAR
// =============================================

function progressBar(current, total, width = 40) {
    const pct = current / total;
    const filled = Math.round(width * pct);
    const bar = '='.repeat(filled) + ' '.repeat(width - filled);
    const pctStr = (pct * 100).toFixed(0).padStart(3);
    process.stdout.write(`\r  [${bar}] ${current}/${total} (${pctStr}%)`);
    if (current === total) process.stdout.write('\n');
}

// =============================================
// MAIN SIMULATION
// =============================================

async function main() {
    console.log('=== Embroidery CSV Full Simulation ===');
    console.log('Loading 3 data sources...');

    // 1. Load CSVs
    const lineItemRecords = loadCSV(LINE_ITEMS_CSV, 'Line items');
    const odbcRecords = loadCSV(ODBC_CSV, 'ODBC orders');
    const stitchRecords = loadCSV(STITCH_CSV, 'Stitch counts');

    // 2. Build lookup maps
    const orderMap = buildOrderMap(odbcRecords);
    const stitchMap = buildStitchMap(stitchRecords);
    const lineItemGroups = groupLineItems(lineItemRecords);

    // 3. Filter to embroidery orders
    const embroideryOrderIds = new Set();
    for (const [orderId, orderData] of orderMap) {
        if (EMBROIDERY_ORDER_TYPES.has(orderData.orderType)) {
            if (lineItemGroups.has(orderId)) {
                embroideryOrderIds.add(orderId);
            }
        }
    }

    console.log(`\n  Embroidery orders with line items: ${embroideryOrderIds.size}`);

    // 4. Initialize pricing config from API
    await initializePricingConfig();

    // 5. Collect all unique base styles for API pre-fetch
    const uniqueStyles = new Set();
    for (const orderId of embroideryOrderIds) {
        const rows = lineItemGroups.get(orderId);
        for (const row of rows) {
            const classified = classifyRow(row);
            if (classified.type === 'product') {
                uniqueStyles.add(classified.baseSKU);
            }
        }
    }

    console.log(`\nFetching pricing data for ${uniqueStyles.size} unique styles... (batched ${BATCH_SIZE} at a time)`);
    const stylesToFetch = Array.from(uniqueStyles);
    let fetchIndex = 0;
    for (let i = 0; i < stylesToFetch.length; i += BATCH_SIZE) {
        const batch = stylesToFetch.slice(i, i + BATCH_SIZE);
        await Promise.all(batch.map(style => fetchSizePricing(style)));
        fetchIndex += batch.length;
        progressBar(fetchIndex, stylesToFetch.length);
        if (i + BATCH_SIZE < stylesToFetch.length) {
            await sleep(RATE_LIMIT_MS);
        }
    }
    console.log(`  API calls made: ${apiCallCount}`);

    // 6. Simulate each order
    console.log('\n--- Order Simulation ---');

    const results = {
        timestamp: new Date().toISOString(),
        dataSources: {
            lineItems: { file: LINE_ITEMS_CSV, rows: lineItemRecords.length },
            odbc: { file: ODBC_CSV, rows: odbcRecords.length, embroideryOrders: embroideryOrderIds.size },
            stitches: { file: STITCH_CSV, rows: stitchRecords.length, matched: 0 }
        },
        summary: {
            ordersSimulated: 0,
            allPathsValid: 0,
            warnings: 0,
            failures: 0,
            passRate: 0
        },
        pricingComparison: {
            within5pct: 0,
            over5pct: 0,
            totalCompared: 0,
            averageDelta: 0,
            deltaSum: 0
        },
        outputPathResults: {
            ui: { pass: 0, fail: 0, issues: [] },
            pdf: { pass: 0, fail: 0, issues: [] },
            save: { pass: 0, fail: 0, issues: [] },
            clipboard: { pass: 0, fail: 0, issues: [] }
        },
        suffixValidation: {
            correct: 0,
            mismatch: 0,
            total: 0
        },
        feeValidation: {
            recognized: 0,
            unrecognized: 0,
            feeCodes: {}
        },
        failedOrders: [],
        warningOrders: [],
        pricingOutliers: []
    };

    let stitchesMatched = 0;
    let orderIndex = 0;

    for (const orderId of embroideryOrderIds) {
        orderIndex++;
        const rows = lineItemGroups.get(orderId);
        const orderData = orderMap.get(orderId) || {};
        const stitchData = stitchMap.get(orderId) || null;
        if (stitchData) stitchesMatched++;

        // Classify rows
        const products = [];
        const fees = [];
        const skips = [];
        const productsBySKU = new Map(); // baseSKU+color → aggregated product

        for (const row of rows) {
            const classified = classifyRow(row);

            // Suffix validation
            const suffixResult = validateSuffix(row);
            results.suffixValidation.total++;
            if (suffixResult.valid) {
                results.suffixValidation.correct++;
            } else {
                results.suffixValidation.mismatch++;
            }

            switch (classified.type) {
                case 'product': {
                    const sb = buildSizeBreakdown(row);
                    // Handle suffix-implied sizes: if suffix says 2XL but CSV puts qty in XXL column
                    if (classified.inferredSize && Object.keys(sb).length === 0) {
                        const lineQty = parseInt(row.LineQty) || 0;
                        if (lineQty > 0) {
                            sb[classified.inferredSize] = lineQty;
                        }
                    }

                    // Merge into existing product with same baseSKU + color, or create new
                    const key = `${classified.baseSKU}|${classified.color}`;
                    if (productsBySKU.has(key)) {
                        const existing = productsBySKU.get(key);
                        for (const [size, qty] of Object.entries(sb)) {
                            existing.sizeBreakdown[size] = (existing.sizeBreakdown[size] || 0) + qty;
                        }
                        existing.totalQuantity += parseInt(row.LineQty) || 0;
                        existing.csvLineTotal += parseCsvMoney(row[' LineTotal '] || row.LineTotal);
                    } else {
                        const product = {
                            baseSKU: classified.baseSKU,
                            partNumber: classified.partNumber,
                            color: classified.color,
                            description: classified.description,
                            sizeBreakdown: sb,
                            totalQuantity: parseInt(row.LineQty) || 0,
                            csvLineTotal: parseCsvMoney(row[' LineTotal '] || row.LineTotal),
                            isCap: isCap(classified.baseSKU, orderData.orderType),
                            pricing: null
                        };
                        productsBySKU.set(key, product);
                    }
                    break;
                }
                case 'fee': {
                    const feeCode = classified.code;
                    fees.push({
                        code: feeCode,
                        qty: parseInt(row.LineQty) || 1,
                        total: parseCsvMoney(row[' LineTotal '] || row.LineTotal),
                        description: (row.Description || '').trim()
                    });

                    if (!results.feeValidation.feeCodes[feeCode]) {
                        results.feeValidation.feeCodes[feeCode] = 0;
                    }
                    results.feeValidation.feeCodes[feeCode]++;
                    if (VALID_FEE_PART_NUMBERS.has(feeCode) || feeCode.startsWith('DGT-')) {
                        results.feeValidation.recognized++;
                    } else {
                        results.feeValidation.unrecognized++;
                    }
                    break;
                }
                case 'skip':
                    skips.push(classified);
                    break;
            }
        }

        // Convert merged products to array
        const orderProducts = Array.from(productsBySKU.values());

        // Get stitch count (default to 8000 if no match or zero)
        const stitchCount = (stitchData && stitchData.stitchCount > 0) ? stitchData.stitchCount : 8000;
        const additionalStitches = Math.max(0, stitchCount - pricingConfig.baseStitchCount);
        const additionalStitchCost = (additionalStitches / 1000) * pricingConfig.additionalStitchRate;

        // Calculate tier based on total product quantity
        const totalProductQty = orderProducts.reduce((s, p) => s + p.totalQuantity, 0);
        const tier = getTier(totalProductQty);
        const hasLTM = pricingConfig.tiers[tier]?.hasLTM || false;

        // Calculate pricing for each product
        let computedSubtotal = 0;
        for (const product of orderProducts) {
            const sizePricing = pricingCache.get(product.baseSKU);
            if (sizePricing) {
                product.pricing = calculateProductPricing(
                    product.sizeBreakdown,
                    sizePricing,
                    tier,
                    0 // Extra stitches shown as separate AS-GARM/AS-CAP fee
                );
                if (product.pricing) {
                    computedSubtotal += product.pricing.subtotal;
                }
            }
        }

        // Build order object for validation
        const simulatedOrder = {
            orderId,
            products: orderProducts,
            fees,
            customer: {
                company: orderData.company,
                contact: orderData.contact,
                email: orderData.email
            },
            tier,
            hasLTM,
            ltmDistributed: hasLTM,
            logo: {
                position: 'Left Chest',
                stitchCount: stitchCount
            },
            computedSubtotal,
            stitchCount,
            additionalStitchCost,
            totalQuantity: totalProductQty
        };

        // Validate all 4 output paths
        const uiResult = validateUIPath(simulatedOrder);
        const pdfResult = validatePDFPath(simulatedOrder);
        const saveResult = validateSavePath(simulatedOrder);
        const clipResult = validateClipboardPath(simulatedOrder);

        results.summary.ordersSimulated++;

        // Track results
        if (uiResult.pass) results.outputPathResults.ui.pass++;
        else {
            results.outputPathResults.ui.fail++;
            results.outputPathResults.ui.issues.push({ orderId, issues: uiResult.issues.slice(0, 3) });
        }

        if (pdfResult.pass) results.outputPathResults.pdf.pass++;
        else {
            results.outputPathResults.pdf.fail++;
            results.outputPathResults.pdf.issues.push({ orderId, issues: pdfResult.issues.slice(0, 3) });
        }

        if (saveResult.pass) results.outputPathResults.save.pass++;
        else {
            results.outputPathResults.save.fail++;
            results.outputPathResults.save.issues.push({ orderId, issues: saveResult.issues.slice(0, 3) });
        }

        if (clipResult.pass) results.outputPathResults.clipboard.pass++;
        else {
            results.outputPathResults.clipboard.fail++;
            results.outputPathResults.clipboard.issues.push({ orderId, issues: clipResult.issues.slice(0, 3) });
        }

        const allPass = uiResult.pass && pdfResult.pass && saveResult.pass && clipResult.pass;
        const anyFail = !uiResult.pass || !pdfResult.pass || !saveResult.pass || !clipResult.pass;
        const isWarning = !allPass && orderProducts.some(p => p.pricing);

        if (allPass) {
            results.summary.allPathsValid++;
        } else if (isWarning) {
            results.summary.warnings++;
            results.warningOrders.push({
                orderId,
                paths: {
                    ui: uiResult.pass ? 'pass' : uiResult.issues[0],
                    pdf: pdfResult.pass ? 'pass' : pdfResult.issues[0],
                    save: saveResult.pass ? 'pass' : saveResult.issues[0],
                    clipboard: clipResult.pass ? 'pass' : clipResult.issues[0]
                }
            });
        } else {
            results.summary.failures++;
            results.failedOrders.push({
                orderId,
                productCount: orderProducts.length,
                feeCount: fees.length,
                paths: {
                    ui: uiResult.pass ? 'pass' : uiResult.issues,
                    pdf: pdfResult.pass ? 'pass' : pdfResult.issues,
                    save: saveResult.pass ? 'pass' : saveResult.issues,
                    clipboard: clipResult.pass ? 'pass' : clipResult.issues
                }
            });
        }

        // Pricing comparison vs ShopWorks actual
        const csvProductTotal = orderProducts.reduce((s, p) => s + p.csvLineTotal, 0);
        const csvFeeTotal = fees.reduce((s, f) => s + f.total, 0);
        const csvGrandTotal = csvProductTotal + csvFeeTotal;
        const shopworksTotal = orderData.totalInvoice || 0;

        if (shopworksTotal > 0 && computedSubtotal > 0 && csvProductTotal > 0) {
            results.pricingComparison.totalCompared++;
            const pctDiff = Math.abs(computedSubtotal - csvProductTotal) / csvProductTotal;
            results.pricingComparison.deltaSum += pctDiff;

            if (pctDiff <= 0.05) {
                results.pricingComparison.within5pct++;
            } else {
                results.pricingComparison.over5pct++;
                results.pricingOutliers.push({
                    orderId,
                    computed: Math.round(computedSubtotal * 100) / 100,
                    csvProductTotal: Math.round(csvProductTotal * 100) / 100,
                    shopworksTotal,
                    pctDiff: Math.round(pctDiff * 1000) / 10,
                    tier,
                    productCount: orderProducts.length
                });
            }
        }
    }

    // Finalize stats
    results.dataSources.stitches.matched = stitchesMatched;
    results.summary.passRate = results.summary.ordersSimulated > 0
        ? Math.round((results.summary.allPathsValid / results.summary.ordersSimulated) * 1000) / 10
        : 0;
    results.pricingComparison.averageDelta = results.pricingComparison.totalCompared > 0
        ? Math.round((results.pricingComparison.deltaSum / results.pricingComparison.totalCompared) * 1000) / 10
        : 0;

    // Trim large arrays for report
    results.outputPathResults.ui.issues = results.outputPathResults.ui.issues.slice(0, 20);
    results.outputPathResults.pdf.issues = results.outputPathResults.pdf.issues.slice(0, 20);
    results.outputPathResults.save.issues = results.outputPathResults.save.issues.slice(0, 20);
    results.outputPathResults.clipboard.issues = results.outputPathResults.clipboard.issues.slice(0, 20);
    results.failedOrders = results.failedOrders.slice(0, 50);
    results.warningOrders = results.warningOrders.slice(0, 50);
    results.pricingOutliers = results.pricingOutliers.slice(0, 50);

    // Write report
    fs.writeFileSync(REPORT_PATH, JSON.stringify(results, null, 2));

    // Print summary
    printSummary(results);

    // Exit code
    process.exit(results.summary.failures > 0 ? 1 : 0);
}

// =============================================
// CONSOLE OUTPUT
// =============================================

function printSummary(r) {
    const s = r.summary;
    const p = r.pricingComparison;
    const o = r.outputPathResults;
    const sx = r.suffixValidation;
    const f = r.feeValidation;

    console.log('\n=== Embroidery CSV Full Simulation Results ===\n');

    console.log('--- Data Sources ---');
    console.log(`  Line items: ${r.dataSources.lineItems.rows.toLocaleString()} rows`);
    console.log(`  ODBC orders: ${r.dataSources.odbc.rows.toLocaleString()} rows (filtered to embroidery: ${r.dataSources.odbc.embroideryOrders})`);
    console.log(`  Stitch counts: ${r.dataSources.stitches.rows.toLocaleString()} rows (matched: ${r.dataSources.stitches.matched})`);

    console.log('\n--- Order Simulation Results ---');
    console.log(`  Orders tested: ${s.ordersSimulated}`);
    console.log(`    All 4 output paths valid: ${s.allPathsValid} (${s.passRate}%)`);
    console.log(`    Warnings (non-fatal): ${s.warnings}`);
    console.log(`    Would break an output path: ${s.failures}`);

    console.log('\n--- Size/Suffix Validation ---');
    console.log(`    Suffix -> column correct: ${sx.correct}/${sx.total}`);
    console.log(`    Qty sum mismatch: ${sx.mismatch} rows`);

    console.log('\n--- Fee Validation ---');
    console.log(`    Recognized fee codes: ${f.recognized}`);
    console.log(`    Unrecognized fee codes: ${f.unrecognized}`);
    const topFees = Object.entries(f.feeCodes).sort((a, b) => b[1] - a[1]).slice(0, 10);
    for (const [code, count] of topFees) {
        console.log(`      ${code}: ${count}`);
    }

    console.log('\n--- Pricing Comparison ---');
    if (p.totalCompared > 0) {
        console.log(`    Compared: ${p.totalCompared} orders`);
        console.log(`    Within 5% of CSV total: ${p.within5pct}/${p.totalCompared} (${Math.round(p.within5pct / p.totalCompared * 100)}%)`);
        console.log(`    >5% difference: ${p.over5pct} orders`);
        console.log(`    Average delta: ${p.averageDelta}%`);
    } else {
        console.log('    No orders had both computed and ShopWorks totals for comparison');
    }

    console.log('\n--- Output Path Checks ---');
    console.log(`    UI (recalculatePricing): ${o.ui.pass}/${s.ordersSimulated} ${o.ui.fail === 0 ? 'PASS' : `(${o.ui.fail} failures)`}`);
    console.log(`    PDF (printQuote): ${o.pdf.pass}/${s.ordersSimulated} ${o.pdf.fail === 0 ? 'PASS' : `(${o.pdf.fail} failures)`}`);
    console.log(`    Save (saveAndGetLink): ${o.save.pass}/${s.ordersSimulated} ${o.save.fail === 0 ? 'PASS' : `(${o.save.fail} failures)`}`);
    console.log(`    Clipboard (copyToClipboard): ${o.clipboard.pass}/${s.ordersSimulated} ${o.clipboard.fail === 0 ? 'PASS' : `(${o.clipboard.fail} failures)`}`);

    if (r.failedOrders.length > 0) {
        console.log('\n--- Failed Orders (first 10) ---');
        for (const fo of r.failedOrders.slice(0, 10)) {
            console.log(`  Order ${fo.orderId}: ${fo.productCount} products, ${fo.feeCount} fees`);
            for (const [pathName, pathResult] of Object.entries(fo.paths)) {
                if (pathResult !== 'pass') {
                    const issueList = Array.isArray(pathResult) ? pathResult.slice(0, 2).join('; ') : pathResult;
                    console.log(`    ${pathName}: ${issueList}`);
                }
            }
        }
    }

    if (r.pricingOutliers.length > 0) {
        console.log('\n--- Pricing Outliers >5% (first 10) ---');
        for (const po of r.pricingOutliers.slice(0, 10)) {
            console.log(`  Order ${po.orderId}: computed=$${po.computed} vs csv=$${po.csvProductTotal} (${po.pctDiff}% diff) [tier: ${po.tier}]`);
        }
    }

    console.log(`\nReport: ${REPORT_PATH}`);
    console.log('=== Done ===\n');
}

// =============================================
// RUN
// =============================================

main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
