#!/usr/bin/env node
/**
 * Batch Price Audit Report — Service Pricing Analysis
 *
 * Loads all batch fixture files, compares ShopWorks prices vs 2026 API prices
 * for service items (DECG, AL, Monogram, DD, etc.), and outputs 4 reports:
 *   A) Per-order summary
 *   B) Service item breakdown (REVIEW/MISMATCH only)
 *   C) Aggregated by rep + service type
 *   D) Revenue impact summary (total dollars left on the table)
 *
 * Usage:
 *   node tests/scripts/batch-price-audit-report.js
 *   node tests/scripts/batch-price-audit-report.js --rep "Nika"
 *   node tests/scripts/batch-price-audit-report.js --service DECG
 *   node tests/scripts/batch-price-audit-report.js --html     (generates dashboard HTML)
 */
const path = require('path');
const fs = require('fs');

// ── Stub browser globals ────────────────────────────────────────────────────
if (typeof window === 'undefined') global.window = undefined;
if (typeof document === 'undefined') {
    const makeElement = () => ({
        style: {}, className: '', id: '', innerHTML: '', textContent: '',
        appendChild: () => {}, insertBefore: () => {}, removeChild: () => {},
        setAttribute: () => {}, addEventListener: () => {},
        querySelector: () => null, querySelectorAll: () => [],
        parentNode: null, children: [], value: '', checked: false
    });
    global.document = {
        getElementById: () => null,
        querySelector: () => null,
        querySelectorAll: () => [],
        createElement: () => makeElement(),
        createTextNode: () => makeElement(),
        head: makeElement(),
        body: makeElement()
    };
}

const BASE_URL = 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';
const ShopWorksImportParser = require('../../shared_components/js/shopworks-import-parser');

// ── CLI Args ────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const repFilter = args.includes('--rep') ? args[args.indexOf('--rep') + 1] : null;
const serviceFilter = args.includes('--service') ? args[args.indexOf('--service') + 1]?.toUpperCase() : null;
const generateHTML = args.includes('--html');

// ── Helpers ─────────────────────────────────────────────────────────────────
function currency(val) {
    if (val == null || isNaN(val)) return '—';
    return '$' + Number(val).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function pct(val) {
    if (val == null || isNaN(val)) return '—';
    const sign = val >= 0 ? '+' : '';
    return sign + val.toFixed(1) + '%';
}

function flag(deltaPct) {
    const abs = Math.abs(deltaPct);
    if (abs <= 5) return 'OK';
    if (abs <= 15) return 'REVIEW';
    return 'MISMATCH';
}

function padR(str, len) { return (str + '').slice(0, len).padEnd(len); }
function padL(str, len) { return (str + '').slice(0, len).padStart(len); }

async function fetchJSON(url) {
    const https = require('https');
    const http = require('http');
    const mod = url.startsWith('https') ? https : http;
    return new Promise((resolve, reject) => {
        mod.get(url, res => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try { resolve(JSON.parse(data)); }
                catch (e) { reject(new Error(`JSON parse error: ${e.message}`)); }
            });
        }).on('error', reject);
    });
}

// ── Load batch files ────────────────────────────────────────────────────────
function loadAllBatchOrders() {
    const fixtureDir = path.join(__dirname, '..', 'fixtures', 'shopworks-orders');
    const batchFiles = fs.readdirSync(fixtureDir)
        .filter(f => f.startsWith('shopworks_orders_batch') && f.endsWith('.txt'))
        .sort();

    const allOrders = [];

    for (const file of batchFiles) {
        const batchName = file.replace('.txt', '').replace('shopworks_orders_', '');
        const text = fs.readFileSync(path.join(fixtureDir, file), 'utf8');

        const batchDelimiter = /^={10,}\s*ORDER\s+\d+\s*={10,}$/m;
        let orderTexts;

        if (batchDelimiter.test(text)) {
            const chunks = text.split(batchDelimiter);
            orderTexts = chunks
                .map(c => c.replace(/^={10,}\s*$/gm, '').trim())
                .filter(c => c.length > 0 && /Order\s*#:/i.test(c));
        } else {
            orderTexts = [text.trim()];
        }

        for (const orderText of orderTexts) {
            allOrders.push({ batchName, orderText });
        }
    }

    return allOrders;
}

// ── Parse & analyze service pricing ─────────────────────────────────────────
function analyzeOrder(orderText, parser, serviceCodeMap) {
    // Suppress parser console noise
    const origLog = console.log;
    const origWarn = console.warn;
    console.log = () => {};
    console.warn = () => {};

    let result;
    try {
        result = parser.parse(orderText);
    } finally {
        console.log = origLog;
        console.warn = origWarn;
    }

    if (!result || !result.orderId) return null;

    const orderNum = result.orderId;
    const company = result.customer?.company || '';
    const rep = result.salesRep?.name || '';

    // Collect service items with SW vs 2026 prices
    const serviceComparisons = [];

    // --- DECG items ---
    if (result.decgItems && result.decgItems.length > 0) {
        for (const decg of result.decgItems) {
            const swPrice = decg.unitPrice || 0;
            const qty = decg.quantity || 1;
            // Use hardcoded 2026 tier prices (calculatedUnitPrice is 0 in fixture-only mode)
            const apiPrice = getDECGTierPrice(qty, decg.isCap);
            const ltmFee = decg.ltmFee || 0;
            const allInApi = apiPrice + (ltmFee / qty);

            serviceComparisons.push({
                type: decg.isCap ? 'DECC' : 'DECG',
                qty,
                swPerUnit: swPrice,
                apiPerUnit: apiPrice,
                apiAllIn: allInApi,
                ltmFee,
                tier: decg.tier || '',
                delta: swPrice - apiPrice,
                deltaPct: apiPrice > 0 ? ((swPrice - apiPrice) / apiPrice) * 100 : 0
            });
        }
    }

    // --- AL items ---
    const alItems = result.services?.additionalLogos || [];
    if (alItems.length === 0 && result.services?.additionalLogo) {
        alItems.push(result.services.additionalLogo);
    }
    for (const al of alItems) {
        const swPrice = al.unitPrice || 0;
        const alQty = al.quantity || 1;
        const isCap = al.isCap || false;
        // AL uses tier-based pricing — service code map doesn't have AL tier keys,
        // so always use hardcoded 2026 tier prices directly
        const apiPrice = getALFallbackPrice(alQty, isCap);
        const tierLabel = getALTierKey(alQty);

        serviceComparisons.push({
            type: isCap ? 'AL-CAP' : 'AL',
            qty: alQty,
            swPerUnit: swPrice,
            apiPerUnit: apiPrice,
            apiAllIn: apiPrice,
            ltmFee: 0,
            tier: tierLabel,
            delta: swPrice - apiPrice,
            deltaPct: apiPrice > 0 ? ((swPrice - apiPrice) / apiPrice) * 100 : 0
        });
    }

    // --- Monogram / Name items ---
    const monograms = result.services?.monograms || [];
    for (const mono of monograms) {
        const swPrice = mono.unitPrice || 0;
        const monoRecord = serviceCodeMap['Monogram'];
        const apiPrice = monoRecord ? parseFloat(monoRecord.SellPrice) : 12.50;

        serviceComparisons.push({
            type: 'MONOGRAM',
            qty: mono.quantity || 1,
            swPerUnit: swPrice,
            apiPerUnit: apiPrice,
            apiAllIn: apiPrice,
            ltmFee: 0,
            tier: '',
            delta: swPrice - apiPrice,
            deltaPct: apiPrice > 0 ? ((swPrice - apiPrice) / apiPrice) * 100 : 0
        });
    }

    // --- Digitizing (DD/DDE/DDT) ---
    const digItems = result.services?.digitizingFees || [];
    for (const dig of digItems) {
        const swPrice = dig.amount || dig.unitPrice || 0;
        const code = (dig.code || dig.partNumber || 'DD').toUpperCase();
        const digRecord = serviceCodeMap[code];
        const apiPrice = digRecord ? parseFloat(digRecord.SellPrice) : (code === 'DD' ? 100 : 50);

        serviceComparisons.push({
            type: code,
            qty: 1,
            swPerUnit: swPrice,
            apiPerUnit: apiPrice,
            apiAllIn: apiPrice,
            ltmFee: 0,
            tier: '',
            delta: swPrice - apiPrice,
            deltaPct: apiPrice > 0 ? ((swPrice - apiPrice) / apiPrice) * 100 : 0
        });
    }

    // --- Sewing (SEG/SECC) ---
    const sewItems = result.services?.sewing || [];
    for (const sew of sewItems) {
        const swPrice = sew.unitPrice || 0;
        const code = (sew.partNumber || 'SEG').toUpperCase();
        const sewRecord = serviceCodeMap[code];
        const apiPrice = sewRecord ? parseFloat(sewRecord.SellPrice) : 10.00;

        serviceComparisons.push({
            type: code,
            qty: sew.quantity || 1,
            swPerUnit: swPrice,
            apiPerUnit: apiPrice,
            apiAllIn: apiPrice,
            ltmFee: 0,
            tier: '',
            delta: swPrice - apiPrice,
            deltaPct: apiPrice > 0 ? ((swPrice - apiPrice) / apiPrice) * 100 : 0
        });
    }

    // --- Weight items ---
    const weights = result.services?.weights || [];
    for (const w of weights) {
        const swPrice = w.unitPrice || 0;
        const weightRecord = serviceCodeMap['WEIGHT'];
        const apiPrice = weightRecord ? parseFloat(weightRecord.SellPrice) : 6.25;

        serviceComparisons.push({
            type: 'WEIGHT',
            qty: w.quantity || 1,
            swPerUnit: swPrice,
            apiPerUnit: apiPrice,
            apiAllIn: apiPrice,
            ltmFee: 0,
            tier: '',
            delta: swPrice - apiPrice,
            deltaPct: apiPrice > 0 ? ((swPrice - apiPrice) / apiPrice) * 100 : 0
        });
    }

    // --- Design Transfer (DT) ---
    const dtItems = result.services?.designTransfers || [];
    for (const dt of dtItems) {
        const swPrice = dt.unitPrice || dt.amount || 0;
        const dtRecord = serviceCodeMap['DT'];
        const apiPrice = dtRecord ? parseFloat(dtRecord.SellPrice) : 50.00;

        serviceComparisons.push({
            type: 'DT',
            qty: 1,
            swPerUnit: swPrice,
            apiPerUnit: apiPrice,
            apiAllIn: apiPrice,
            ltmFee: 0,
            tier: '',
            delta: swPrice - apiPrice,
            deltaPct: apiPrice > 0 ? ((swPrice - apiPrice) / apiPrice) * 100 : 0
        });
    }

    // --- Graphic Design (GRT-75 / "Design Prep") ---
    if (result.services?.graphicDesign) {
        const gd = result.services.graphicDesign;
        const swPrice = gd.amount || 0;
        const gdRecord = serviceCodeMap['GRT-75'];
        const apiPrice = gdRecord ? parseFloat(gdRecord.SellPrice) : 75.00;

        serviceComparisons.push({
            type: 'GRT-75',
            qty: gd.hours || 1,
            swPerUnit: swPrice,
            apiPerUnit: apiPrice,
            apiAllIn: apiPrice,
            ltmFee: 0,
            tier: '',
            delta: swPrice - apiPrice,
            deltaPct: apiPrice > 0 ? ((swPrice - apiPrice) / apiPrice) * 100 : 0
        });
    }

    // --- Patch Setup (GRT-50) ---
    if (result.services?.patchSetup) {
        const ps = result.services.patchSetup;
        const swPrice = ps.amount || ps.fee || 0;
        const psRecord = serviceCodeMap['GRT-50'];
        const apiPrice = psRecord ? parseFloat(psRecord.SellPrice) : 50.00;

        serviceComparisons.push({
            type: 'GRT-50',
            qty: 1,
            swPerUnit: swPrice,
            apiPerUnit: apiPrice,
            apiAllIn: apiPrice,
            ltmFee: 0,
            tier: '',
            delta: swPrice - apiPrice,
            deltaPct: apiPrice > 0 ? ((swPrice - apiPrice) / apiPrice) * 100 : 0
        });
    }

    // Calculate order-level SW subtotal vs our subtotal (products only)
    const swSubtotal = result.orderSummary?.subtotal || 0;

    // --- LTM impact tracking ---
    // Count total product qty across garments, caps, and DECG items
    const totalProductQty = (result.products || []).reduce((sum, p) => sum + (p.totalQuantity || 0), 0)
        + (result.decgItems || []).reduce((sum, d) => sum + (d.quantity || 0), 0);
    // Check if ShopWorks order had an LTM fee
    const hasLTMFee = (result.services?.ltm && result.services.ltm.amount > 0)
        || (result.orderSummary?.fees || []).some(f => /ltm|less than min/i.test(f.description || ''));
    const ltmNeeded = totalProductQty > 0 && totalProductQty <= 7;

    return {
        orderNum,
        company,
        rep,
        swSubtotal,
        serviceComparisons,
        totalProductQty,
        ltmNeeded,
        ltmPresent: hasLTMFee
    };
}

function getALTierKey(qty) {
    if (qty <= 7) return 'AL-1-7';
    if (qty <= 23) return 'AL-8-23';
    if (qty <= 47) return 'AL-24-47';
    if (qty <= 71) return 'AL-48-71';
    return 'AL-72+';
}

function getALFallbackPrice(qty, isCap) {
    // 2026 AL tier prices (garment vs cap)
    const garmentTiers = { '1-7': 10.00, '8-23': 9.00, '24-47': 8.00, '48-71': 7.50, '72+': 7.00 };
    const capTiers = { '1-7': 6.50, '8-23': 6.00, '24-47': 5.75, '48-71': 5.50, '72+': 5.25 };
    const tiers = isCap ? capTiers : garmentTiers;
    if (qty <= 7) return tiers['1-7'];
    if (qty <= 23) return tiers['8-23'];
    if (qty <= 47) return tiers['24-47'];
    if (qty <= 71) return tiers['48-71'];
    return tiers['72+'];
}

function getDECGTierPrice(qty, isCap) {
    // 2026 DECG/DECC tier prices
    const garmentTiers = { '1-7': 28, '8-23': 26, '24-47': 24, '48-71': 22, '72+': 20 };
    const capTiers = { '1-7': 22.50, '8-23': 21, '24-47': 19, '48-71': 17.50, '72+': 16 };
    const tiers = isCap ? capTiers : garmentTiers;
    if (qty <= 7) return tiers['1-7'];
    if (qty <= 23) return tiers['8-23'];
    if (qty <= 47) return tiers['24-47'];
    if (qty <= 71) return tiers['48-71'];
    return tiers['72+'];
}

// ── Main ────────────────────────────────────────────────────────────────────
async function main() {
    console.log('\n' + '═'.repeat(78));
    console.log('  BATCH PRICE AUDIT REPORT — Service Pricing Analysis');
    if (repFilter) console.log(`  Filter: Rep = "${repFilter}"`);
    if (serviceFilter) console.log(`  Filter: Service = "${serviceFilter}"`);
    console.log('═'.repeat(78));

    // Load service codes from API
    let serviceCodeMap = {};
    try {
        const scResp = await fetchJSON(`${BASE_URL}/api/service-codes`);
        if (scResp.success && Array.isArray(scResp.data)) {
            for (const sc of scResp.data) {
                if (sc.ServiceCode) serviceCodeMap[sc.ServiceCode] = sc;
            }
            console.log(`\n  Service codes loaded: ${Object.keys(serviceCodeMap).length} codes (API)`);
        }
    } catch (e) {
        console.log(`\n  Service codes API unavailable — using fallback prices: ${e.message}`);
    }

    // Load all batch fixture files
    const allOrders = loadAllBatchOrders();
    console.log(`  Batch files loaded: ${allOrders.length} orders from fixture files\n`);

    // Parse all orders
    const parser = new ShopWorksImportParser();
    const results = [];

    for (const { batchName, orderText } of allOrders) {
        const analysis = analyzeOrder(orderText, parser, serviceCodeMap);
        if (!analysis) continue;

        // Apply filters
        if (repFilter && !analysis.rep.toLowerCase().includes(repFilter.toLowerCase())) continue;
        if (serviceFilter && !analysis.serviceComparisons.some(s => s.type === serviceFilter)) continue;

        analysis.batch = batchName;
        results.push(analysis);
    }

    console.log(`  Orders analyzed: ${results.length}${repFilter || serviceFilter ? ' (filtered)' : ''}\n`);

    // ── REPORT A: Per-Order Summary ─────────────────────────────────────────
    console.log('─'.repeat(78));
    console.log('  REPORT A: Per-Order Summary');
    console.log('─'.repeat(78));
    console.log(
        padR('Order', 8) +
        padR('Batch', 9) +
        padR('Company', 26) +
        padR('Rep', 18) +
        padR('Services', 10) +
        padR('Worst', 12)
    );
    console.log('─'.repeat(78));

    let totalOrders = 0;
    let ordersWithIssues = 0;

    for (const r of results) {
        totalOrders++;
        const svcCount = r.serviceComparisons.length;
        const svcWithFilter = serviceFilter
            ? r.serviceComparisons.filter(s => s.type === serviceFilter)
            : r.serviceComparisons;

        let worstFlag = 'OK';
        let worstDelta = 0;
        for (const s of svcWithFilter) {
            const f = flag(s.deltaPct);
            if (f === 'MISMATCH') { worstFlag = 'MISMATCH'; worstDelta = s.deltaPct; }
            else if (f === 'REVIEW' && worstFlag !== 'MISMATCH') { worstFlag = 'REVIEW'; worstDelta = s.deltaPct; }
            if (Math.abs(s.deltaPct) > Math.abs(worstDelta)) worstDelta = s.deltaPct;
        }

        if (worstFlag !== 'OK') ordersWithIssues++;

        const flagColor = worstFlag === 'MISMATCH' ? '\x1b[31m' : worstFlag === 'REVIEW' ? '\x1b[33m' : '\x1b[32m';
        const reset = '\x1b[0m';

        console.log(
            padR(r.orderNum, 8) +
            padR(r.batch, 9) +
            padR(r.company.slice(0, 25), 26) +
            padR(r.rep.slice(0, 17), 18) +
            padR(svcCount + ' items', 10) +
            flagColor + padR(worstFlag + (worstFlag !== 'OK' ? ` ${pct(worstDelta)}` : ''), 12) + reset
        );
    }

    console.log('─'.repeat(78));
    console.log(`  Total: ${totalOrders} orders, ${ordersWithIssues} with pricing issues\n`);

    // ── REPORT B: Service Item Breakdown (REVIEW/MISMATCH only) ─────────────
    console.log('─'.repeat(78));
    console.log('  REPORT B: Service Item Breakdown (REVIEW/MISMATCH only)');
    console.log('─'.repeat(78));
    console.log(
        padR('Order', 8) +
        padR('Type', 10) +
        padL('Qty', 5) +
        padL('SW/pc', 10) +
        padL('2026/pc', 10) +
        padL('Delta', 10) +
        padL('Delta%', 9) +
        '  ' + padR('Flag', 10) +
        padR('Note', 20)
    );
    console.log('─'.repeat(78));

    let issueCount = 0;
    for (const r of results) {
        for (const s of r.serviceComparisons) {
            if (serviceFilter && s.type !== serviceFilter) continue;

            const f = flag(s.deltaPct);
            if (f === 'OK') continue;

            issueCount++;
            const flagColor = f === 'MISMATCH' ? '\x1b[31m' : '\x1b[33m';
            const reset = '\x1b[0m';
            let note = '';
            if (s.ltmFee > 0) note = `incl $${s.ltmFee} LTM`;
            if (s.tier) note += (note ? ', ' : '') + `tier ${s.tier}`;

            console.log(
                padR(r.orderNum, 8) +
                padR(s.type, 10) +
                padL(s.qty, 5) +
                padL(currency(s.swPerUnit), 10) +
                padL(currency(s.apiPerUnit), 10) +
                padL(currency(s.delta), 10) +
                padL(pct(s.deltaPct), 9) +
                '  ' + flagColor + padR(f, 10) + reset +
                padR(note, 20)
            );
        }
    }

    if (issueCount === 0) {
        console.log('  No pricing issues found.');
    }
    console.log('─'.repeat(78));
    console.log(`  Total: ${issueCount} service items with pricing discrepancies\n`);

    // ── REPORT C: Aggregated by Rep + Service Type ──────────────────────────
    console.log('─'.repeat(78));
    console.log('  REPORT C: Aggregated by Rep + Service Type');
    console.log('─'.repeat(78));
    console.log(
        padR('Rep', 22) +
        padR('Service', 10) +
        padL('Orders', 8) +
        padL('Items', 8) +
        padL('Avg Delta%', 12) +
        padL('Worst Delta%', 14) +
        '  ' + padR('Worst Flag', 12)
    );
    console.log('─'.repeat(78));

    // Build aggregation map: rep → serviceType → { orders, items, deltas }
    const aggMap = {};
    for (const r of results) {
        const rep = r.rep || '(unknown)';
        if (!aggMap[rep]) aggMap[rep] = {};

        // Track per-service-type for this rep
        const orderServiceTypes = new Set();
        for (const s of r.serviceComparisons) {
            if (serviceFilter && s.type !== serviceFilter) continue;
            const t = s.type;
            if (!aggMap[rep][t]) aggMap[rep][t] = { orderSet: new Set(), items: 0, deltas: [], worstDelta: 0 };
            aggMap[rep][t].orderSet.add(r.orderNum);
            aggMap[rep][t].items++;
            aggMap[rep][t].deltas.push(s.deltaPct);
            if (Math.abs(s.deltaPct) > Math.abs(aggMap[rep][t].worstDelta)) {
                aggMap[rep][t].worstDelta = s.deltaPct;
            }
            orderServiceTypes.add(t);
        }

        // If rep has no service items in filtered view, track as "(none)"
        if (orderServiceTypes.size === 0 && !serviceFilter) {
            if (!aggMap[rep]['(none)']) aggMap[rep]['(none)'] = { orderSet: new Set(), items: 0, deltas: [], worstDelta: 0 };
            aggMap[rep]['(none)'].orderSet.add(r.orderNum);
        }
    }

    // Sort reps alphabetically, service types alphabetically within each rep
    const sortedReps = Object.keys(aggMap).sort();
    for (const rep of sortedReps) {
        const serviceTypes = Object.keys(aggMap[rep]).sort();
        for (const svcType of serviceTypes) {
            const agg = aggMap[rep][svcType];
            const orders = agg.orderSet.size;
            const items = agg.items;
            const avgDelta = agg.deltas.length > 0
                ? agg.deltas.reduce((a, b) => a + b, 0) / agg.deltas.length
                : 0;
            const worstDelta = agg.worstDelta;
            const worstF = items > 0 ? flag(worstDelta) : 'N/A';

            const flagColor = worstF === 'MISMATCH' ? '\x1b[31m' : worstF === 'REVIEW' ? '\x1b[33m' : '\x1b[32m';
            const reset = '\x1b[0m';

            console.log(
                padR(rep.slice(0, 21), 22) +
                padR(svcType, 10) +
                padL(orders, 8) +
                padL(items, 8) +
                padL(items > 0 ? pct(avgDelta) : 'N/A', 12) +
                padL(items > 0 ? pct(worstDelta) : 'N/A', 14) +
                '  ' + flagColor + padR(worstF, 12) + reset
            );
        }
    }

    console.log('─'.repeat(78));

    // ── REPORT D: Revenue Impact Summary ─────────────────────────────────────
    console.log('\n' + '═'.repeat(78));
    console.log('  REPORT D: Revenue Impact Summary');
    console.log('═'.repeat(78));

    // Aggregate undercharges by service type
    const impactByType = {};
    for (const r of results) {
        for (const s of r.serviceComparisons) {
            if (serviceFilter && s.type !== serviceFilter) continue;
            // Only count undercharges (SW charged less than 2026 price)
            // delta = swPrice - apiPrice, negative means undercharged
            if (s.delta < 0) {
                const t = s.type;
                if (!impactByType[t]) impactByType[t] = { items: 0, orderSet: new Set(), totalDollars: 0 };
                impactByType[t].items += s.qty;
                impactByType[t].orderSet.add(r.orderNum);
                // Revenue gap = qty × (2026 price - SW price) per unit
                impactByType[t].totalDollars += s.qty * Math.abs(s.delta);
            }
        }
    }

    // LTM impact
    let ltmMissingCount = 0;
    const ltmMissingOrders = [];
    for (const r of results) {
        if (r.ltmNeeded && !r.ltmPresent) {
            ltmMissingCount++;
            ltmMissingOrders.push(r.orderNum);
        }
    }
    const ltmRevenue = ltmMissingCount * 50;

    let grandTotalGap = 0;
    let grandTotalOrders = new Set();

    // Print each service type impact
    const sortedTypes = Object.keys(impactByType).sort((a, b) => impactByType[b].totalDollars - impactByType[a].totalDollars);
    for (const t of sortedTypes) {
        const imp = impactByType[t];
        const avgPerOrder = imp.orderSet.size > 0 ? imp.totalDollars / imp.orderSet.size : 0;
        grandTotalGap += imp.totalDollars;
        for (const o of imp.orderSet) grandTotalOrders.add(o);

        console.log(`\n  ${t} Underpricing:`);
        console.log(`    ${imp.items} items across ${imp.orderSet.size} orders`);
        console.log(`    Total $ left on table: ${currency(imp.totalDollars)}`);
        console.log(`    Avg per order: ${currency(avgPerOrder)}`);
    }

    if (ltmMissingCount > 0) {
        grandTotalGap += ltmRevenue;
        for (const o of ltmMissingOrders) grandTotalOrders.add(o);

        console.log(`\n  LTM Fee Not Applied:`);
        console.log(`    ${ltmMissingCount} orders with <=7 pieces, no LTM charged`);
        console.log(`    Potential revenue: ${currency(ltmRevenue)} ($50 x ${ltmMissingCount} orders)`);
    } else if (!serviceFilter) {
        console.log(`\n  LTM Fee Not Applied:`);
        console.log(`    All small orders (<= 7 pcs) had LTM — none missing`);
    }

    // Also show overcharges summary (where SW charged more than 2026)
    let overchargeTotal = 0;
    let overchargeItems = 0;
    for (const r of results) {
        for (const s of r.serviceComparisons) {
            if (serviceFilter && s.type !== serviceFilter) continue;
            if (s.delta > 0 && s.apiPerUnit > 0) {
                overchargeTotal += s.qty * s.delta;
                overchargeItems++;
            }
        }
    }
    if (overchargeItems > 0) {
        console.log(`\n  Overcharges (SW > 2026):`);
        console.log(`    ${overchargeItems} items — total overcharged: ${currency(overchargeTotal)}`);
    }

    console.log('\n  ' + '─'.repeat(57));
    console.log(`  TOTAL ESTIMATED REVENUE GAP: \x1b[31m${currency(grandTotalGap)}\x1b[0m across ${grandTotalOrders.size} orders`);
    console.log('  ' + '═'.repeat(57));

    // ── Generate HTML report if --html flag ──────────────────────────────────
    if (generateHTML) {
        const htmlData = {
            results,
            aggMap,
            impactByType,
            sortedTypes,
            ltmMissingCount,
            ltmMissingOrders,
            ltmRevenue,
            grandTotalGap,
            grandTotalOrders: grandTotalOrders.size,
            overchargeTotal,
            overchargeItems,
            totalOrders,
            ordersWithIssues,
            issueCount
        };
        const htmlPath = generateHTMLReport(htmlData);
        console.log(`\n  HTML report generated: ${htmlPath}`);
    }

    console.log('\n  Done.\n');
}

// ── HTML Report Generator ────────────────────────────────────────────────────
function esc(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function generateHTMLReport(data) {
    const {
        results, aggMap, impactByType, sortedTypes,
        ltmMissingCount, ltmMissingOrders, ltmRevenue,
        grandTotalGap, grandTotalOrders,
        overchargeTotal, overchargeItems,
        totalOrders, ordersWithIssues, issueCount
    } = data;

    const now = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

    // Build Report A rows
    const reportARows = results.map(r => {
        const svcCount = r.serviceComparisons.length;
        let worstFlag = 'OK', worstDelta = 0;
        for (const s of r.serviceComparisons) {
            const f = flag(s.deltaPct);
            if (f === 'MISMATCH') { worstFlag = 'MISMATCH'; worstDelta = s.deltaPct; }
            else if (f === 'REVIEW' && worstFlag !== 'MISMATCH') { worstFlag = 'REVIEW'; worstDelta = s.deltaPct; }
            if (Math.abs(s.deltaPct) > Math.abs(worstDelta)) worstDelta = s.deltaPct;
        }
        const ltmNote = r.ltmNeeded && !r.ltmPresent ? ' *' : '';
        return `<tr class="flag-${worstFlag.toLowerCase()}">
            <td>${esc(r.orderNum)}</td>
            <td>${esc(r.batch)}</td>
            <td>${esc(r.company)}</td>
            <td>${esc(r.rep)}</td>
            <td class="num">${svcCount}</td>
            <td class="num">${r.totalProductQty}${ltmNote}</td>
            <td><span class="badge badge-${worstFlag.toLowerCase()}">${worstFlag}${worstFlag !== 'OK' ? ' ' + pct(worstDelta) : ''}</span></td>
        </tr>`;
    }).join('\n');

    // Build Report B rows
    const reportBRows = [];
    for (const r of results) {
        for (const s of r.serviceComparisons) {
            const f = flag(s.deltaPct);
            if (f === 'OK') continue;
            let note = '';
            if (s.ltmFee > 0) note = `incl $${s.ltmFee} LTM`;
            if (s.tier) note += (note ? ', ' : '') + `tier ${s.tier}`;
            reportBRows.push(`<tr class="flag-${f.toLowerCase()}">
                <td>${esc(r.orderNum)}</td>
                <td>${esc(r.company)}</td>
                <td>${esc(r.rep)}</td>
                <td>${esc(s.type)}</td>
                <td class="num">${s.qty}</td>
                <td class="num">${currency(s.swPerUnit)}</td>
                <td class="num">${currency(s.apiPerUnit)}</td>
                <td class="num ${s.delta < 0 ? 'negative' : s.delta > 0 ? 'positive' : ''}">${currency(s.delta)}</td>
                <td class="num">${pct(s.deltaPct)}</td>
                <td><span class="badge badge-${f.toLowerCase()}">${f}</span></td>
                <td class="note">${esc(note)}</td>
            </tr>`);
        }
    }

    // Build Report C rows
    const reportCRows = [];
    const sortedReps = Object.keys(aggMap).sort();
    for (const rep of sortedReps) {
        const serviceTypes = Object.keys(aggMap[rep]).sort();
        for (const svcType of serviceTypes) {
            if (svcType === '(none)') continue;
            const agg = aggMap[rep][svcType];
            const orders = agg.orderSet.size;
            const items = agg.items;
            const avgDelta = agg.deltas.length > 0 ? agg.deltas.reduce((a, b) => a + b, 0) / agg.deltas.length : 0;
            const worstDelta = agg.worstDelta;
            const worstF = items > 0 ? flag(worstDelta) : 'N/A';
            // Calculate $ impact for this rep+service combo
            let repSvcDollars = 0;
            for (const r of results) {
                if ((r.rep || '(unknown)') !== rep) continue;
                for (const s of r.serviceComparisons) {
                    if (s.type !== svcType) continue;
                    if (s.delta < 0) repSvcDollars += s.qty * Math.abs(s.delta);
                }
            }
            reportCRows.push(`<tr class="flag-${worstF.toLowerCase()}">
                <td>${esc(rep)}</td>
                <td>${esc(svcType)}</td>
                <td class="num">${orders}</td>
                <td class="num">${items}</td>
                <td class="num">${pct(avgDelta)}</td>
                <td class="num">${pct(worstDelta)}</td>
                <td class="num ${repSvcDollars > 0 ? 'negative' : ''}">${repSvcDollars > 0 ? currency(repSvcDollars) : '—'}</td>
                <td><span class="badge badge-${worstF.toLowerCase()}">${worstF}</span></td>
            </tr>`);
        }
    }

    // Build impact cards
    const impactCards = sortedTypes.map(t => {
        const imp = impactByType[t];
        const avgPerOrder = imp.orderSet.size > 0 ? imp.totalDollars / imp.orderSet.size : 0;
        return `<div class="impact-card">
            <div class="impact-type">${esc(t)}</div>
            <div class="impact-amount">${currency(imp.totalDollars)}</div>
            <div class="impact-detail">${imp.items} items across ${imp.orderSet.size} orders</div>
            <div class="impact-detail">Avg ${currency(avgPerOrder)} per order</div>
        </div>`;
    }).join('\n');

    // Training tips — context-specific advice
    const tips = [];
    if (impactByType['DECG']) {
        tips.push({
            icon: 'fa-shirt',
            title: 'Customer-Supplied Garment Embroidery (DECG)',
            body: `Our 2026 DECG price is <strong>$20–$28/pc</strong> depending on qty tier. Many orders were charged $15–$20.
            <strong>Action:</strong> When a customer brings their own garments, use the quote builder — it calculates the correct tier automatically.`
        });
    }
    if (impactByType['AL'] || impactByType['AL-CAP']) {
        const alTotal = (impactByType['AL']?.totalDollars || 0) + (impactByType['AL-CAP']?.totalDollars || 0);
        tips.push({
            icon: 'fa-clone',
            title: 'Additional Logo Locations (AL)',
            body: `AL pricing gap: <strong>${currency(alTotal)}</strong>. 2026 garment AL is <strong>$7–$10/pc</strong> by tier, caps are <strong>$5.25–$6.50</strong>.
            Old pricing was $5–$8, sometimes lower. <strong>Action:</strong> Always add AL as a separate line — the builder calculates the tier price.`
        });
    }
    if (ltmMissingCount > 0) {
        tips.push({
            icon: 'fa-coins',
            title: `Less Than Minimum (LTM) Fee — ${ltmMissingCount} Orders Missing`,
            body: `Orders with <strong>7 or fewer pieces</strong> should include a <strong>$50 LTM fee</strong>. That's ${currency(ltmRevenue)} in missed revenue.
            <strong>Action:</strong> The quote builder adds LTM automatically — baked into per-piece price. Just double-check orders under 8 pcs.`
        });
    }
    if (impactByType['DD']) {
        tips.push({
            icon: 'fa-pencil-ruler',
            title: 'Digitizing (DD)',
            body: `Standard digitizing is <strong>$100</strong> in 2026, revisions (DDE/DDT/DGT) are <strong>$50</strong>. Some orders charged $50 for a full DD.
            <strong>Action:</strong> New designs = DD ($100). Revisions to existing = DDE/DDT ($50). The Service Price Cheat Sheet has all codes.`
        });
    }
    if (impactByType['GRT-50']) {
        tips.push({
            icon: 'fa-paint-roller',
            title: 'Patch Setup Fee (GRT-50) Missing',
            body: `${impactByType['GRT-50'].orderSet.size} orders were missing the <strong>$50 patch setup fee</strong>.
            <strong>Action:</strong> Every laser patch or embroidered patch order needs a GRT-50 setup fee. The builder adds it automatically.`
        });
    }

    const tipsHTML = tips.map(t => `
        <div class="tip-card">
            <div class="tip-header"><i class="fas ${t.icon}"></i> ${t.title}</div>
            <div class="tip-body">${t.body}</div>
        </div>
    `).join('\n');

    // 2026 tier reference tables
    const tierRefHTML = `
        <div class="tier-tables">
            <div class="tier-table">
                <h4>DECG Garment Tiers</h4>
                <table><thead><tr><th>Qty</th><th>Price/pc</th></tr></thead><tbody>
                <tr><td>1–7</td><td>$28.00</td></tr>
                <tr><td>8–23</td><td>$26.00</td></tr>
                <tr><td>24–47</td><td>$24.00</td></tr>
                <tr><td>48–71</td><td>$22.00</td></tr>
                <tr><td>72+</td><td>$20.00</td></tr>
                </tbody></table>
            </div>
            <div class="tier-table">
                <h4>DECG Cap Tiers</h4>
                <table><thead><tr><th>Qty</th><th>Price/pc</th></tr></thead><tbody>
                <tr><td>1–7</td><td>$22.50</td></tr>
                <tr><td>8–23</td><td>$21.00</td></tr>
                <tr><td>24–47</td><td>$19.00</td></tr>
                <tr><td>48–71</td><td>$17.50</td></tr>
                <tr><td>72+</td><td>$16.00</td></tr>
                </tbody></table>
            </div>
            <div class="tier-table">
                <h4>AL Garment Tiers</h4>
                <table><thead><tr><th>Qty</th><th>Price/pc</th></tr></thead><tbody>
                <tr><td>1–7</td><td>$10.00</td></tr>
                <tr><td>8–23</td><td>$9.00</td></tr>
                <tr><td>24–47</td><td>$8.00</td></tr>
                <tr><td>48–71</td><td>$7.50</td></tr>
                <tr><td>72+</td><td>$7.00</td></tr>
                </tbody></table>
            </div>
            <div class="tier-table">
                <h4>AL Cap Tiers</h4>
                <table><thead><tr><th>Qty</th><th>Price/pc</th></tr></thead><tbody>
                <tr><td>1–7</td><td>$6.50</td></tr>
                <tr><td>8–23</td><td>$6.00</td></tr>
                <tr><td>24–47</td><td>$5.75</td></tr>
                <tr><td>48–71</td><td>$5.50</td></tr>
                <tr><td>72+</td><td>$5.25</td></tr>
                </tbody></table>
            </div>
            <div class="tier-table">
                <h4>Fixed-Price Services</h4>
                <table><thead><tr><th>Code</th><th>Price</th></tr></thead><tbody>
                <tr><td>DD (New Digitizing)</td><td>$100.00</td></tr>
                <tr><td>DDE/DDT (Revision)</td><td>$50.00</td></tr>
                <tr><td>Monogram</td><td>$12.50</td></tr>
                <tr><td>NAME</td><td>$12.50</td></tr>
                <tr><td>SEG (Sewing)</td><td>$10.00</td></tr>
                <tr><td>WEIGHT</td><td>$6.25</td></tr>
                <tr><td>GRT-50 (Patch Setup)</td><td>$50.00</td></tr>
                <tr><td>GRT-75 (Design Prep)</td><td>$75.00/hr</td></tr>
                <tr><td>LTM (≤7 pcs)</td><td>$50.00</td></tr>
                </tbody></table>
            </div>
        </div>
    `;

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Price Audit Report — NWCA 2026</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
    <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css" rel="stylesheet">
    <link rel="stylesheet" href="/dashboards/reports/price-audit-report.css">
</head>
<body>
    <header>
        <div class="header-content">
            <div class="header-left">
                <a href="/staff-dashboard.html" class="back-link"><i class="fas fa-arrow-left"></i> Staff Dashboard</a>
                <h1><i class="fas fa-chart-bar"></i> Price Audit Report</h1>
                <p class="subtitle">ShopWorks 2025 vs 2026 Pricing — ${now} — ${totalOrders} Orders Analyzed</p>
            </div>
        </div>
    </header>

    <main>
        <!-- Revenue Impact Hero -->
        <section class="hero-section">
            <div class="hero-grid">
                <div class="hero-card hero-gap">
                    <div class="hero-label">Estimated Revenue Gap</div>
                    <div class="hero-value">${currency(grandTotalGap)}</div>
                    <div class="hero-detail">across ${grandTotalOrders} of ${totalOrders} orders</div>
                </div>
                <div class="hero-card">
                    <div class="hero-label">Orders with Issues</div>
                    <div class="hero-value">${ordersWithIssues}</div>
                    <div class="hero-detail">${(ordersWithIssues / totalOrders * 100).toFixed(0)}% of all orders</div>
                </div>
                <div class="hero-card">
                    <div class="hero-label">Service Items Off</div>
                    <div class="hero-value">${issueCount}</div>
                    <div class="hero-detail">REVIEW or MISMATCH</div>
                </div>
                <div class="hero-card">
                    <div class="hero-label">LTM Fees Missing</div>
                    <div class="hero-value">${ltmMissingCount}</div>
                    <div class="hero-detail">${currency(ltmRevenue)} potential</div>
                </div>
            </div>
        </section>

        <!-- Impact Breakdown -->
        <section class="section">
            <h2><i class="fas fa-dollar-sign"></i> Revenue Gap by Service Type</h2>
            <div class="impact-grid">
                ${impactCards}
                ${ltmMissingCount > 0 ? `<div class="impact-card impact-ltm">
                    <div class="impact-type">LTM Fee (≤7 pcs)</div>
                    <div class="impact-amount">${currency(ltmRevenue)}</div>
                    <div class="impact-detail">${ltmMissingCount} orders, no $50 LTM</div>
                </div>` : ''}
            </div>
            ${overchargeItems > 0 ? `<p class="overcharge-note"><i class="fas fa-info-circle"></i> Note: ${overchargeItems} items were <em>overcharged</em> by ${currency(overchargeTotal)} total (SW price > 2026 price). This partially offsets the gap above.</p>` : ''}
        </section>

        <!-- Training Tips -->
        <section class="section tips-section">
            <h2><i class="fas fa-graduation-cap"></i> What to Change — Training Notes</h2>
            <div class="tips-grid">
                ${tipsHTML}
            </div>
        </section>

        <!-- 2026 Tier Reference -->
        <section class="section">
            <h2><i class="fas fa-table"></i> 2026 Price Reference</h2>
            ${tierRefHTML}
        </section>

        <!-- Report C: By Rep -->
        <section class="section">
            <h2><i class="fas fa-users"></i> Report: By Rep &amp; Service Type</h2>
            <div class="table-wrapper">
                <table class="data-table">
                    <thead><tr>
                        <th>Rep</th><th>Service</th><th class="num">Orders</th><th class="num">Items</th>
                        <th class="num">Avg Delta</th><th class="num">Worst Delta</th><th class="num">$ Under</th><th>Status</th>
                    </tr></thead>
                    <tbody>${reportCRows.join('\n')}</tbody>
                </table>
            </div>
        </section>

        <!-- Report B: Item Breakdown -->
        <section class="section">
            <h2><i class="fas fa-list"></i> Report: All Pricing Discrepancies</h2>
            <p class="section-note">Showing ${reportBRows.length} items flagged REVIEW or MISMATCH (${reportBRows.length === 0 ? 'none found' : 'sorted by order'})</p>
            <div class="table-wrapper">
                <table class="data-table" id="discrepancy-table">
                    <thead><tr>
                        <th>Order</th><th>Company</th><th>Rep</th><th>Type</th><th class="num">Qty</th>
                        <th class="num">SW/pc</th><th class="num">2026/pc</th><th class="num">Delta</th>
                        <th class="num">Delta%</th><th>Flag</th><th>Note</th>
                    </tr></thead>
                    <tbody>${reportBRows.join('\n')}</tbody>
                </table>
            </div>
        </section>

        <!-- Report A: Per-Order -->
        <section class="section">
            <h2><i class="fas fa-clipboard-list"></i> Report: All ${totalOrders} Orders</h2>
            <div class="table-wrapper">
                <table class="data-table" id="order-table">
                    <thead><tr>
                        <th>Order</th><th>Batch</th><th>Company</th><th>Rep</th>
                        <th class="num">Svcs</th><th class="num">Qty</th><th>Status</th>
                    </tr></thead>
                    <tbody>${reportARows}</tbody>
                </table>
            </div>
            <p class="section-note">* = LTM fee needed but not present</p>
        </section>
    </main>

    <footer>
        <p>Generated ${now} from ${totalOrders} ShopWorks orders (batches 2–13) &bull; NWCA 2026 Pricing Audit</p>
    </footer>

    <script>
        // Simple table filter by rep name
        document.querySelectorAll('.data-table').forEach(table => {
            const headers = table.querySelectorAll('th');
            headers.forEach((th, idx) => {
                th.style.cursor = 'pointer';
                th.addEventListener('click', () => {
                    const tbody = table.querySelector('tbody');
                    const rows = Array.from(tbody.querySelectorAll('tr'));
                    const isNum = th.classList.contains('num');
                    const dir = th.dataset.sortDir === 'asc' ? 'desc' : 'asc';
                    th.dataset.sortDir = dir;
                    rows.sort((a, b) => {
                        let aVal = a.children[idx]?.textContent?.trim() || '';
                        let bVal = b.children[idx]?.textContent?.trim() || '';
                        if (isNum) {
                            aVal = parseFloat(aVal.replace(/[^\\d.\\-]/g, '')) || 0;
                            bVal = parseFloat(bVal.replace(/[^\\d.\\-]/g, '')) || 0;
                            return dir === 'asc' ? aVal - bVal : bVal - aVal;
                        }
                        return dir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
                    });
                    rows.forEach(r => tbody.appendChild(r));
                });
            });
        });
    </script>
</body>
</html>`;

    const outPath = path.join(__dirname, '..', '..', 'dashboards', 'reports', 'price-audit-report.html');
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, html, 'utf8');
    return outPath;
}

main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
