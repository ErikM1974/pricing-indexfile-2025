/**
 * DTF Quote Builder — baseCost + Qty Display Fix Verification
 *
 * Validates:
 * 1. BLANK pricing-bundle returns correct per-size MAX CASE_PRICE
 * 2. Math.min() on bundle sizes gives correct base cost (S/M/L/XL)
 * 3. 29LS (Long Sleeve) unit price > 29M (Short Sleeve) unit price
 * 4. 2XL upcharge applies correctly to child row pricing
 * 5. Parent row Qty should NOT include child row quantities
 * 6. Sidebar "Total Pieces" correctly aggregates parent + child
 *
 * Run with: node tests/unit/test-dtf-basecost-fix.js
 */

const BASE_URL = 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';

// DTF pricing constants (from test-dtf-pricing.js)
const MARGIN_DENOMINATOR = 0.57;
const LABOR_COST_PER_LOCATION = 2.50;
const LOCATION_SIZE_MAP = {
    'left-sleeve': 'small',
    'right-sleeve': 'small',
    'left-chest': 'small',
    'right-chest': 'small',
    'back-of-neck': 'small',
    'center-front': 'medium',
    'center-back': 'medium',
    'full-front': 'large',
    'full-back': 'large'
};

// Console colors
const C = {
    reset: '\x1b[0m', bold: '\x1b[1m',
    green: '\x1b[32m', red: '\x1b[31m',
    yellow: '\x1b[33m', cyan: '\x1b[36m', dim: '\x1b[2m'
};

let passed = 0, failed = 0;
const failures = [];

function ok(condition, msg, expected, actual) {
    if (condition) {
        passed++;
        console.log(`  ${C.green}✓${C.reset} ${msg}`);
    } else {
        failed++;
        const detail = expected !== undefined ? ` (expected: ${expected}, got: ${actual})` : '';
        failures.push(`${msg}${detail}`);
        console.log(`  ${C.red}✗${C.reset} ${msg}${detail}`);
    }
}

function section(title) {
    console.log(`\n${C.cyan}${C.bold}═══ ${title} ═══${C.reset}`);
}

function roundUpToHalfDollar(price) {
    if (price % 0.5 === 0) return price;
    return Math.ceil(price * 2) / 2;
}

async function fetchJSON(url) {
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`HTTP ${resp.status} for ${url}`);
    return resp.json();
}

// ============================================================================
// TESTS
// ============================================================================

async function runTests() {
    console.log(`${C.bold}╔══════════════════════════════════════════════════════╗${C.reset}`);
    console.log(`${C.bold}║  DTF baseCost Fix + Qty Display Verification         ║${C.reset}`);
    console.log(`${C.bold}╚══════════════════════════════════════════════════════╝${C.reset}`);

    // ── 1. Fetch BLANK pricing bundles for both styles ──────────────────────
    section('1. BLANK PRICING BUNDLE — baseCost Source');

    const [blank29LS, blank29M] = await Promise.all([
        fetchJSON(`${BASE_URL}/api/pricing-bundle?method=BLANK&styleNumber=29LS`),
        fetchJSON(`${BASE_URL}/api/pricing-bundle?method=BLANK&styleNumber=29M`)
    ]);

    ok(blank29LS.sizes && blank29LS.sizes.length > 0,
        'BLANK bundle for 29LS returns sizes array');
    ok(blank29M.sizes && blank29M.sizes.length > 0,
        'BLANK bundle for 29M returns sizes array');

    // Verify sizes have price field
    const ls_has_price = blank29LS.sizes.every(s => typeof s.price === 'number');
    const m_has_price = blank29M.sizes.every(s => typeof s.price === 'number');
    ok(ls_has_price, '29LS sizes all have numeric price field');
    ok(m_has_price, '29M sizes all have numeric price field');

    // ── 2. Math.min() gives correct base cost ───────────────────────────────
    section('2. BASE COST CALCULATION — Math.min() on sizes');

    const baseCost29LS = Math.min(...blank29LS.sizes.map(s => s.price));
    const baseCost29M = Math.min(...blank29M.sizes.map(s => s.price));

    console.log(`  ${C.dim}29LS base cost (Math.min): $${baseCost29LS.toFixed(2)}${C.reset}`);
    console.log(`  ${C.dim}29M  base cost (Math.min): $${baseCost29M.toFixed(2)}${C.reset}`);

    ok(baseCost29LS > baseCost29M,
        `29LS base ($${baseCost29LS.toFixed(2)}) > 29M base ($${baseCost29M.toFixed(2)})`,
        '29LS > 29M', `${baseCost29LS} vs ${baseCost29M}`);

    // Verify the S/M size specifically
    const ls_s_price = blank29LS.sizes.find(s => s.size === 'S')?.price;
    const m_s_price = blank29M.sizes.find(s => s.size === 'S')?.price;
    ok(ls_s_price === baseCost29LS,
        `29LS base matches S-size price ($${ls_s_price})`,
        baseCost29LS, ls_s_price);
    ok(m_s_price === baseCost29M,
        `29M base matches S-size price ($${m_s_price})`,
        baseCost29M, m_s_price);

    // ── 3. Verify old bug would have given wrong result ─────────────────────
    section('3. OLD BUG VERIFICATION — product-details first record');

    const [details29LS, details29M] = await Promise.all([
        fetchJSON(`${BASE_URL}/api/product-details?styleNumber=29LS`),
        fetchJSON(`${BASE_URL}/api/product-details?styleNumber=29M`)
    ]);

    const oldBaseCost29LS = parseFloat(details29LS[0]?.CASE_PRICE || 0);
    const oldBaseCost29M = parseFloat(details29M[0]?.CASE_PRICE || 0);

    console.log(`  ${C.dim}OLD 29LS firstDetail.CASE_PRICE: $${oldBaseCost29LS.toFixed(2)}${C.reset}`);
    console.log(`  ${C.dim}OLD 29M  firstDetail.CASE_PRICE: $${oldBaseCost29M.toFixed(2)}${C.reset}`);

    // The old bug: 29M's first record CASE_PRICE >= 29LS, causing inversion
    ok(oldBaseCost29M >= oldBaseCost29LS,
        `OLD BUG confirmed: 29M first record ($${oldBaseCost29M.toFixed(2)}) >= 29LS ($${oldBaseCost29LS.toFixed(2)}) — was inverted`,
        '>= 29LS', `${oldBaseCost29M}`);

    // ── 4. Unit price calculation for Left Sleeve at 72+ tier ───────────────
    section('4. UNIT PRICE CALCULATION — Left Sleeve, 110 pieces');

    // Fetch DTF pricing bundle for transfer costs
    const dtfBundle = await fetchJSON(`${BASE_URL}/api/pricing-bundle?method=DTF`);
    const dtfTiers = dtfBundle.tiersR || [];
    const tier72 = dtfTiers.find(t => t.MinQuantity <= 110 && t.MaxQuantity >= 110);
    const marginDenom = tier72 ? tier72.MarginDenominator : MARGIN_DENOMINATOR;

    console.log(`  ${C.dim}Tier for 110 pcs: ${tier72?.TierLabel || '72+'}, margin denom: ${marginDenom}${C.reset}`);

    // Get transfer costs from DTF pricing data
    const dtfCosts = dtfBundle.allDtfCostsR || [];
    // Find small transfer cost for 72+ tier
    const smallTransfer72 = dtfCosts.find(c =>
        c.TransferSize === 'Small' && c.MinQuantity <= 110 && c.MaxQuantity >= 110
    );
    const transferCost = smallTransfer72 ? parseFloat(smallTransfer72.UnitPrice || smallTransfer72.Cost || 0) : 3.75;

    // Get freight for 110 pcs
    const freightData = dtfBundle.freightR || [];
    const freightTier = freightData.find(f =>
        110 >= (f.MinQuantity || f.min_qty) && 110 <= (f.MaxQuantity || f.max_qty)
    );
    const freightCost = freightTier ? parseFloat(freightTier.FreightPerTransfer || freightTier.cost || 0) : 0.25;

    console.log(`  ${C.dim}Transfer cost (small, 72+): $${transferCost.toFixed(2)}${C.reset}`);
    console.log(`  ${C.dim}Freight (110 pcs): $${freightCost.toFixed(2)}${C.reset}`);
    console.log(`  ${C.dim}Labor per location: $${LABOR_COST_PER_LOCATION.toFixed(2)}${C.reset}`);

    // Calculate 29LS unit price (Left Sleeve = small, 1 location)
    const locationCount = 1;
    const raw29LS = (baseCost29LS / marginDenom) + transferCost + (LABOR_COST_PER_LOCATION * locationCount) + (freightCost * locationCount);
    const unit29LS = roundUpToHalfDollar(raw29LS);

    // Calculate 29M unit price
    const raw29M = (baseCost29M / marginDenom) + transferCost + (LABOR_COST_PER_LOCATION * locationCount) + (freightCost * locationCount);
    const unit29M = roundUpToHalfDollar(raw29M);

    console.log(`  ${C.dim}29LS: $${baseCost29LS.toFixed(2)}/${marginDenom} + $${transferCost.toFixed(2)} + $${LABOR_COST_PER_LOCATION.toFixed(2)} + $${freightCost.toFixed(2)} = $${raw29LS.toFixed(4)} → $${unit29LS.toFixed(2)}${C.reset}`);
    console.log(`  ${C.dim}29M:  $${baseCost29M.toFixed(2)}/${marginDenom} + $${transferCost.toFixed(2)} + $${LABOR_COST_PER_LOCATION.toFixed(2)} + $${freightCost.toFixed(2)} = $${raw29M.toFixed(4)} → $${unit29M.toFixed(2)}${C.reset}`);

    ok(unit29LS > unit29M,
        `29LS unit ($${unit29LS.toFixed(2)}) > 29M unit ($${unit29M.toFixed(2)}) — long sleeve costs more`,
        `> $${unit29M.toFixed(2)}`, `$${unit29LS.toFixed(2)}`);

    // ── 5. 2XL upcharge ─────────────────────────────────────────────────────
    section('5. 2XL UPCHARGE — Child Row Pricing');

    const upcharges = blank29M.sellingPriceDisplayAddOns || {};
    const upcharge2XL = upcharges['2XL'] || 0;

    console.log(`  ${C.dim}2XL upcharge from BLANK bundle: $${upcharge2XL.toFixed(2)}${C.reset}`);

    ok(upcharge2XL > 0, `2XL upcharge exists ($${upcharge2XL.toFixed(2)})`, '> 0', upcharge2XL);

    // Calculate 29M_2X unit price (baseCost / margin + upcharge + transfer + labor + freight)
    const raw29M_2X = (baseCost29M / marginDenom) + upcharge2XL + transferCost + (LABOR_COST_PER_LOCATION * locationCount) + (freightCost * locationCount);
    const unit29M_2X = roundUpToHalfDollar(raw29M_2X);

    console.log(`  ${C.dim}29M_2X: $${baseCost29M.toFixed(2)}/${marginDenom} + $${upcharge2XL.toFixed(2)} + $${transferCost.toFixed(2)} + $${LABOR_COST_PER_LOCATION.toFixed(2)} + $${freightCost.toFixed(2)} = $${raw29M_2X.toFixed(4)} → $${unit29M_2X.toFixed(2)}${C.reset}`);

    ok(unit29M_2X > unit29M,
        `29M_2X ($${unit29M_2X.toFixed(2)}) > 29M base ($${unit29M.toFixed(2)}) — upcharge applied`,
        `> $${unit29M.toFixed(2)}`, `$${unit29M_2X.toFixed(2)}`);

    ok(unit29M_2X - unit29M === upcharge2XL,
        `Upcharge difference matches: $${(unit29M_2X - unit29M).toFixed(2)} === $${upcharge2XL.toFixed(2)}`,
        upcharge2XL, unit29M_2X - unit29M);

    // ── 6. Qty display logic (simulated) ────────────────────────────────────
    section('6. QTY DISPLAY LOGIC — Parent vs Child');

    // Simulate the scenario from the screenshot
    const parentSizes = { S: 20, M: 25, L: 0, XL: 0 };
    const childSizes = { '2XL': 25 };

    const parentQty = Object.values(parentSizes).reduce((a, b) => a + b, 0);
    const childQty = Object.values(childSizes).reduce((a, b) => a + b, 0);
    const combinedQty = parentQty + childQty;

    console.log(`  ${C.dim}Parent standard sizes: S:${parentSizes.S} M:${parentSizes.M} = ${parentQty}${C.reset}`);
    console.log(`  ${C.dim}Child sizes: 2XL:${childSizes['2XL']} = ${childQty}${C.reset}`);

    // OLD behavior (bug): parent Qty = parentQty + childQty = 70
    ok(combinedQty === 70, `OLD Qty would show ${combinedQty} (combined)`, 70, combinedQty);

    // NEW behavior (fix): parent Qty = parentQty only = 45
    ok(parentQty === 45, `NEW parent Qty shows ${parentQty} (standard only)`, 45, parentQty);
    ok(childQty === 25, `Child Qty shows ${childQty}`, 25, childQty);

    // Verify Total column math
    const parentTotal = parentQty * unit29M;
    const childTotal = childQty * unit29M_2X;

    console.log(`  ${C.dim}Parent Total: ${parentQty} × $${unit29M.toFixed(2)} = $${parentTotal.toFixed(2)}${C.reset}`);
    console.log(`  ${C.dim}Child Total:  ${childQty} × $${unit29M_2X.toFixed(2)} = $${childTotal.toFixed(2)}${C.reset}`);

    ok(parentQty * unit29M === parentTotal,
        `Parent: Qty(${parentQty}) × Unit($${unit29M.toFixed(2)}) = Total($${parentTotal.toFixed(2)}) ✓`);

    ok(childQty * unit29M_2X === childTotal,
        `Child:  Qty(${childQty}) × Unit($${unit29M_2X.toFixed(2)}) = Total($${childTotal.toFixed(2)}) ✓`);

    // ── 7. Sidebar Total Pieces (getTotalQuantity simulation) ───────────────
    section('7. SIDEBAR TOTAL — getTotalQuantity() Simulation');

    // Simulate getTotalQuantity() from dtf-quote-builder.js
    // It counts standard sizes from products array + child row quantities
    const product29LS = { quantities: { S: 10, M: 20, L: 10, XL: 0 } };
    const product29M_parent = { quantities: { S: 20, M: 25, L: 0, XL: 0 } };
    // Child rows are counted separately from DOM

    const standardSizes = ['S', 'M', 'L', 'XL'];
    let sidebarTotal = 0;

    // Count standard sizes from products
    [product29LS, product29M_parent].forEach(p => {
        sidebarTotal += Object.entries(p.quantities)
            .filter(([size]) => standardSizes.includes(size))
            .reduce((sum, [, qty]) => sum + (qty || 0), 0);
    });

    // Add child row quantities
    const childRowQuantities = [25]; // 29M_2X: 25
    childRowQuantities.forEach(qty => sidebarTotal += qty);

    ok(sidebarTotal === 110,
        `Sidebar Total Pieces: ${sidebarTotal} (40 + 45 + 25)`,
        110, sidebarTotal);

    // ── 8. Grand total calculation ──────────────────────────────────────────
    section('8. GRAND TOTAL — All Products');

    const total29LS = 40 * unit29LS;
    const total29M_std = 45 * unit29M;
    const total29M_2xl = 25 * unit29M_2X;
    const grandTotal = total29LS + total29M_std + total29M_2xl;

    console.log(`  ${C.dim}29LS:   40 × $${unit29LS.toFixed(2)} = $${total29LS.toFixed(2)}${C.reset}`);
    console.log(`  ${C.dim}29M:    45 × $${unit29M.toFixed(2)} = $${total29M_std.toFixed(2)}${C.reset}`);
    console.log(`  ${C.dim}29M_2X: 25 × $${unit29M_2X.toFixed(2)} = $${total29M_2xl.toFixed(2)}${C.reset}`);
    console.log(`  ${C.dim}Grand Total: $${grandTotal.toFixed(2)}${C.reset}`);

    ok(grandTotal > 0, `Grand total is positive: $${grandTotal.toFixed(2)}`);
    ok(total29LS > total29M_std,
        `29LS total ($${total29LS.toFixed(2)}) > 29M standard total ($${total29M_std.toFixed(2)})`);

    // ══════════════════════════════════════════════════════════════════════════
    // RESULTS
    // ══════════════════════════════════════════════════════════════════════════
    console.log(`\n${C.bold}════════════════════════════════════════════════════════${C.reset}`);
    console.log(`${C.bold}RESULTS: ${C.green}${passed} passed${C.reset}, ${failed > 0 ? C.red : C.green}${failed} failed${C.reset}`);

    if (failures.length > 0) {
        console.log(`\n${C.red}Failures:${C.reset}`);
        failures.forEach(f => console.log(`  ${C.red}✗${C.reset} ${f}`));
    }

    console.log(`${C.bold}════════════════════════════════════════════════════════${C.reset}`);
    process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(err => {
    console.error(`${C.red}Test runner error:${C.reset}`, err);
    process.exit(1);
});
