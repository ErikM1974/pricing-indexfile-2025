#!/usr/bin/env node
/**
 * Batch Price Audit Report — Service Pricing Analysis
 *
 * Loads all batch fixture files, compares ShopWorks prices vs 2026 API prices
 * for service items (DECG, AL, Monogram, DD, etc.), and outputs 3 reports:
 *   A) Per-order summary
 *   B) Service item breakdown (REVIEW/MISMATCH only)
 *   C) Aggregated by rep + service type
 *
 * Usage:
 *   node tests/scripts/batch-price-audit-report.js
 *   node tests/scripts/batch-price-audit-report.js --rep "Nika"
 *   node tests/scripts/batch-price-audit-report.js --service DECG
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
            const apiPrice = decg.calculatedUnitPrice || 0;
            const qty = decg.quantity || 1;
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
        // AL 2026 pricing: use service code map if available
        let apiPrice = 0;
        const alCode = serviceCodeMap['AL-1-7'] || serviceCodeMap['AL-8-23'];
        // For AL, we need tier-based lookup
        const alQty = al.quantity || 1;
        const alTierKey = getALTierKey(alQty);
        const alRecord = serviceCodeMap[alTierKey];
        if (alRecord && alRecord.SellPrice != null) {
            apiPrice = parseFloat(alRecord.SellPrice);
        } else {
            // Fallback AL prices
            apiPrice = getALFallbackPrice(alQty, false);
        }

        serviceComparisons.push({
            type: 'AL',
            qty: alQty,
            swPerUnit: swPrice,
            apiPerUnit: apiPrice,
            apiAllIn: apiPrice,
            ltmFee: 0,
            tier: alTierKey,
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

    return {
        orderNum,
        company,
        rep,
        swSubtotal,
        serviceComparisons
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
    // Fallback AL garment prices (2026)
    const garmentTiers = { '1-7': 8.00, '8-23': 7.00, '24-47': 6.00, '48-71': 5.50, '72+': 5.00 };
    const capTiers = { '1-7': 8.00, '8-23': 7.00, '24-47': 6.00, '48-71': 5.50, '72+': 5.00 };
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
    console.log('\n  Done.\n');
}

main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
