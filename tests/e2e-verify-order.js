#!/usr/bin/env node
/**
 * E2E Order Verification Script
 *
 * Full pipeline: Parse → Price → Save to Caspio → Return quote-view URL
 * Replicates exactly what the embroidery quote builder does in the browser.
 *
 * Usage:
 *   node tests/e2e-verify-order.js tests/fixtures/shopworks-orders/some-order.txt
 *   node tests/e2e-verify-order.js tests/fixtures/shopworks-orders/some-order.txt --dry-run
 *   node tests/e2e-verify-order.js tests/fixtures/shopworks-orders/some-order.txt --save
 *   node tests/e2e-verify-order.js tests/fixtures/shopworks-orders/some-order.txt --save --no-cleanup
 *
 * Flags:
 *   --dry-run      Parse + price + show tables, but do NOT save to Caspio (default)
 *   --save         Save to Caspio + verify + cleanup
 *   --no-cleanup   Keep quote after verification (use with --save)
 *   --raw          Show raw items from parser
 */
const path = require('path');
const fs = require('fs');

// ── Stub browser globals before loading modules ─────────────────────────────
// The pricing engine and parser check for window/document/APP_CONFIG
if (typeof window === 'undefined') global.window = undefined;
if (typeof document === 'undefined') {
    // Stub DOM so pricing engine's showAPIWarning() doesn't crash
    const makeElement = () => ({
        style: {},
        className: '',
        id: '',
        innerHTML: '',
        textContent: '',
        appendChild: () => {},
        insertBefore: () => {},
        removeChild: () => {},
        setAttribute: () => {},
        addEventListener: () => {},
        querySelector: () => null,
        querySelectorAll: () => [],
        parentNode: null,
        children: [],
        value: '',
        checked: false
    });
    global.document = {
        getElementById: () => null,
        querySelector: () => null,
        querySelectorAll: () => [],
        createElement: () => makeElement(),
        createTextNode: () => makeElement(),
        body: makeElement()
    };
}

const BASE_URL = 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';

const ShopWorksImportParser = require('../shared_components/js/shopworks-import-parser');
const EmbroideryPricingCalculator = require('../shared_components/js/embroidery-quote-pricing');

// ── Display Helpers ─────────────────────────────────────────────────────────

function pad(label, width = 24) {
    return (label + ':').padEnd(width);
}

function currency(val) {
    if (val == null || isNaN(val)) return '—';
    return '$' + Number(val).toFixed(2);
}

function printSection(title) {
    const line = '─'.repeat(70);
    console.log(`\n${line}`);
    console.log(`  ${title}`);
    console.log(line);
}

function printField(label, value, indent = 2) {
    const prefix = ' '.repeat(indent);
    const display = value == null || value === '' ? '—' : value;
    console.log(`${prefix}${pad(label)} ${display}`);
}

function printTable(headers, rows) {
    // Calculate column widths
    const widths = headers.map((h, i) => {
        const maxData = rows.reduce((max, row) => Math.max(max, String(row[i] || '').length), 0);
        return Math.max(h.length, maxData) + 2;
    });

    // Header
    const headerLine = headers.map((h, i) => h.padEnd(widths[i])).join('│');
    const separator = widths.map(w => '─'.repeat(w)).join('┼');
    console.log(`  ${headerLine}`);
    console.log(`  ${separator}`);

    // Rows
    for (const row of rows) {
        const rowLine = row.map((cell, i) => String(cell ?? '').padEnd(widths[i])).join('│');
        console.log(`  ${rowLine}`);
    }
}

// ── API Helpers ─────────────────────────────────────────────────────────────

async function fetchJSON(url) {
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`API ${resp.status}: ${url}`);
    return resp.json();
}

async function postJSON(url, data) {
    const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });
    if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`POST ${resp.status}: ${text.substring(0, 200)}`);
    }
    return resp;
}

async function deleteJSON(url) {
    const resp = await fetch(url, { method: 'DELETE' });
    if (!resp.ok) throw new Error(`DELETE ${resp.status}: ${url}`);
    return resp;
}

// ── Price Audit Helper ────────────────────────────────────────────────────

function buildPriceAudit(parsed, pricing, mergedProducts, serviceCodeMap = {}) {
    const swSubtotal = parsed.orderSummary.subtotal || 0;
    const ourSubtotal = pricing.grandTotal || 0;
    const deltaSubtotal = ourSubtotal - swSubtotal;
    const deltaPct = swSubtotal > 0 ? Math.abs(deltaSubtotal / swSubtotal) * 100 : 0;
    const flag = deltaPct <= 5 ? 'OK' : deltaPct <= 15 ? 'REVIEW' : 'MISMATCH';

    const products = [];
    for (const pp of (pricing.products || [])) {
        const firstLi = (pp.lineItems || [pp])[0];
        const ourUnit = firstLi?.unitPriceWithLTM || firstLi?.unitPrice || 0;
        const swUnit = pp.product?._swUnitPrice || 0;
        const qty = pp.product?.totalQuantity || 0;
        const pDelta = ourUnit - swUnit;
        const pPct = swUnit > 0 ? Math.abs(pDelta / swUnit) * 100 : 0;
        products.push({
            style: pp.product?.style || '?',
            color: pp.product?.color || '?',
            qty,
            swUnit: parseFloat(swUnit.toFixed(2)),
            ourUnit: parseFloat(ourUnit.toFixed(2)),
            delta: parseFloat(pDelta.toFixed(2)),
            flag: pPct <= 5 ? 'OK' : pPct <= 15 ? 'REVIEW' : 'MISMATCH'
        });
    }

    // ── Append service items (AL, Monogram, Weight, Digitizing, DECG/DECC) ──
    const alFallback = serviceCodeMap['AL']?.SellPrice || 6.50;
    const alUnitPrice = pricing.additionalServices?.length > 0
        ? (pricing.additionalServices[0]?.unitPrice || alFallback)
        : alFallback;
    (parsed.services.additionalLogos || []).forEach(al => {
        const swU = parseFloat(al.unitPrice || al.price || 0);
        const ourU = parseFloat(alUnitPrice.toFixed(2));
        const d = ourU - swU;
        const p = swU > 0 ? Math.abs(d / swU) * 100 : 0;
        products.push({ style: 'AL', color: 'Service', qty: parseInt(al.quantity || al.qty || 0),
            swUnit: parseFloat(swU.toFixed(2)), ourUnit: ourU,
            delta: parseFloat(d.toFixed(2)), flag: p <= 5 ? 'OK' : p <= 15 ? 'REVIEW' : 'MISMATCH', isService: true });
    });
    (parsed.services.monograms || []).forEach(m => {
        const swU = parseFloat(m.unitPrice || m.price || 0);
        const ourU = serviceCodeMap['Monogram']?.SellPrice || 12.50;
        const d = ourU - swU;
        const p = swU > 0 ? Math.abs(d / swU) * 100 : 0;
        products.push({ style: 'Monogram', color: 'Service', qty: parseInt(m.quantity || m.qty || 0),
            swUnit: parseFloat(swU.toFixed(2)), ourUnit: ourU,
            delta: parseFloat(d.toFixed(2)), flag: p <= 5 ? 'OK' : p <= 15 ? 'REVIEW' : 'MISMATCH', isService: true });
    });
    (parsed.services.weights || []).forEach(w => {
        const swU = parseFloat(w.unitPrice || w.price || 0);
        const ourU = serviceCodeMap['WEIGHT']?.SellPrice || 6.25;
        const d = ourU - swU;
        const p = swU > 0 ? Math.abs(d / swU) * 100 : 0;
        products.push({ style: 'Weight', color: 'Service', qty: parseInt(w.quantity || w.qty || 0),
            swUnit: parseFloat(swU.toFixed(2)), ourUnit: ourU,
            delta: parseFloat(d.toFixed(2)), flag: p <= 5 ? 'OK' : p <= 15 ? 'REVIEW' : 'MISMATCH', isService: true });
    });
    (parsed.services.digitizingFees || []).forEach(df => {
        const swU = parseFloat(df.amount || df.unitPrice || 0);
        products.push({ style: df.code || 'DD', color: 'Service', qty: 1,
            swUnit: parseFloat(swU.toFixed(2)), ourUnit: parseFloat(swU.toFixed(2)),
            delta: 0, flag: 'OK', isService: true });
    });
    (parsed.decgItems || []).forEach(pd => {
        const swU = parseFloat(pd.unitPrice || 0);
        const ourU = parseFloat(pd.calculatedUnitPrice || pd.unitPrice || 0);
        const qty = parseInt(pd.quantity || 0);
        const d = ourU - swU;
        const p = swU > 0 ? Math.abs(d / swU) * 100 : 0;
        const label = pd.serviceType === 'decc' ? 'DECC' : 'DECG';
        products.push({ style: label, color: 'Service', qty,
            swUnit: parseFloat(swU.toFixed(2)), ourUnit: parseFloat(ourU.toFixed(2)),
            delta: parseFloat(d.toFixed(2)), flag: p <= 5 ? 'OK' : p <= 15 ? 'REVIEW' : 'MISMATCH', isService: true });
    });

    return {
        swTotal: parsed.orderSummary.total || 0,
        swSubtotal,
        ourSubtotal: parseFloat(ourSubtotal.toFixed(2)),
        deltaSubtotal: parseFloat(deltaSubtotal.toFixed(2)),
        deltaPct: parseFloat(deltaPct.toFixed(1)),
        flag,
        products
    };
}

// ── Verify & Cleanup Helpers ──────────────────────────────────────────────

async function verifyQuote(quoteId, expectedProducts, expectedTotal, savedSessionData) {
    try {
        // Fetch session and items separately (backend doesn't have /api/public/quote combo endpoint)
        const sessResp = await fetch(`${BASE_URL}/api/quote_sessions?filter=QuoteID%3D'${encodeURIComponent(quoteId)}'`);
        if (!sessResp.ok) return { ok: false, checks: [{ name: 'Fetch session', ok: false, detail: `HTTP ${sessResp.status}` }] };
        const sessions = await sessResp.json();
        if (!sessions || sessions.length === 0) return { ok: false, checks: [{ name: 'Session exists', ok: false, detail: 'No session found' }] };
        const session = sessions[0];

        const itemsResp = await fetch(`${BASE_URL}/api/quote_items?filter=QuoteID%3D'${encodeURIComponent(quoteId)}'`);
        if (!itemsResp.ok) return { ok: false, checks: [{ name: 'Fetch items', ok: false, detail: `HTTP ${itemsResp.status}` }] };
        const allItems = await itemsResp.json();
        const items = (allItems || []).filter(i => i.QuoteID === quoteId);
        const checks = [];

        // ── Core checks ─────────────────────────────────────────────────
        checks.push({ name: 'QuoteID match', ok: session.QuoteID === quoteId });
        checks.push({ name: 'Status=Open', ok: session.Status === 'Open' });
        checks.push({ name: 'Items saved', ok: items.length > 0, detail: `${items.length} items` });

        const productItems = items.filter(i => i.EmbellishmentType === 'embroidery');
        checks.push({ name: 'Product count', ok: productItems.length >= expectedProducts,
            detail: `got ${productItems.length}, expected ${expectedProducts}` });

        const itemsTotal = items.reduce((sum, i) => sum + (parseFloat(i.LineTotal) || 0), 0);
        const sessionTotal = parseFloat(session.TotalAmount) || 0;
        const totalDiff = Math.abs(itemsTotal - sessionTotal);
        checks.push({ name: 'Total math', ok: totalDiff < 2.00,
            detail: `items=$${itemsTotal.toFixed(2)} session=$${sessionTotal.toFixed(2)} diff=$${totalDiff.toFixed(2)}` });

        checks.push({ name: 'Customer data', ok: !!session.CustomerName && !!session.CustomerEmail });
        checks.push({ name: 'Item QuoteIDs', ok: items.every(i => i.QuoteID === quoteId) });

        const validTypes = new Set(['embroidery', 'embroidery-additional', 'customer-supplied', 'fee', 'monogram']);
        checks.push({ name: 'Item types valid', ok: items.every(i => validTypes.has(i.EmbellishmentType)) });

        // ── Round-trip session field checks ──────────────────────────────
        if (savedSessionData) {
            const savedQty = savedSessionData.TotalQuantity || 0;
            const loadedQty = parseInt(session.TotalQuantity) || 0;
            checks.push({ name: 'TotalQuantity RT', ok: savedQty === loadedQty,
                detail: `saved=${savedQty} loaded=${loadedQty}` });

            checks.push({ name: 'CustomerName RT', ok: session.CustomerName === savedSessionData.CustomerName });
            checks.push({ name: 'CompanyName RT', ok: session.CompanyName === savedSessionData.CompanyName });

            const savedTaxRate = parseFloat(savedSessionData.TaxRate) || 0;
            const loadedTaxRate = parseFloat(session.TaxRate) || 0;
            checks.push({ name: 'TaxRate RT', ok: Math.abs(savedTaxRate - loadedTaxRate) < 0.001,
                detail: `saved=${savedTaxRate} loaded=${loadedTaxRate}` });

            if (savedSessionData.OrderNumber) {
                checks.push({ name: 'OrderNumber RT', ok: session.OrderNumber === savedSessionData.OrderNumber });
            }
            if (savedSessionData.ShipToState) {
                checks.push({ name: 'ShipToState RT', ok: session.ShipToState === savedSessionData.ShipToState });
            }
            if (savedSessionData.DigitizingCodes) {
                checks.push({ name: 'DigitizingCodes RT', ok: (session.DigitizingCodes || '') === savedSessionData.DigitizingCodes,
                    detail: `saved="${savedSessionData.DigitizingCodes}" loaded="${session.DigitizingCodes || ''}"` });
            }

            // ShopWorks pricing audit round-trip
            const savedSW = parseFloat(savedSessionData.SWTotal) || 0;
            const loadedSW = parseFloat(session.SWTotal) || 0;
            if (savedSW > 0) {
                checks.push({ name: 'SWTotal RT', ok: Math.abs(savedSW - loadedSW) < 0.01,
                    detail: `saved=${savedSW} loaded=${loadedSW}` });
            }
            const savedSWSub = parseFloat(savedSessionData.SWSubtotal) || 0;
            const loadedSWSub = parseFloat(session.SWSubtotal) || 0;
            if (savedSWSub > 0) {
                checks.push({ name: 'SWSubtotal RT', ok: Math.abs(savedSWSub - loadedSWSub) < 0.01,
                    detail: `saved=${savedSWSub} loaded=${loadedSWSub}` });
            }
        }

        // ── Line item detail checks ─────────────────────────────────────
        const feeItems = items.filter(i => i.EmbellishmentType === 'fee');
        const feePartNumbers = new Set(feeItems.map(i => i.StyleNumber));
        const validFeePNs = new Set([
            'AS-Garm', 'AS-CAP', 'DD', 'DDE', 'DDT', 'GRT-50', 'GRT-75', 'RUSH', 'SAMPLE',
            'DISCOUNT', '3D-EMB', 'Laser Patch', 'SHIP', 'TAX',
            'Monogram', 'NAME', 'WEIGHT', 'SEG', 'SECC', 'DT',
            'CTR-GARMT', 'CTR-CAP'
        ]);
        const unknownFees = [...feePartNumbers].filter(pn => !validFeePNs.has(pn));
        checks.push({ name: 'Fee PNs valid', ok: unknownFees.length === 0,
            detail: unknownFees.length > 0 ? `unknown: ${unknownFees.join(', ')}` : `${feePartNumbers.size} fee type(s)` });

        const zeroPrice = productItems.filter(i => !parseFloat(i.FinalUnitPrice));
        checks.push({ name: 'Product prices', ok: zeroPrice.length === 0,
            detail: zeroPrice.length > 0 ? `${zeroPrice.length} with $0` : `${productItems.length} priced` });

        const noSizes = productItems.filter(i => !i.SizeBreakdown || i.SizeBreakdown === '{}');
        checks.push({ name: 'Size breakdowns', ok: noSizes.length === 0,
            detail: noSizes.length > 0 ? `${noSizes.length} missing` : `all ${productItems.length} have sizes` });

        return { ok: checks.every(c => c.ok), checks, session, items };
    } catch (err) {
        return { ok: false, checks: [{ name: 'Verify error', ok: false, detail: err.message }] };
    }
}

async function cleanupQuote(quoteId) {
    let deleted = 0;
    let errors = 0;
    try {
        // Fetch session and items separately (backend doesn't have /api/public/quote combo endpoint)
        const sessResp = await fetch(`${BASE_URL}/api/quote_sessions?filter=QuoteID%3D'${encodeURIComponent(quoteId)}'`);
        if (!sessResp.ok) return { deleted: 0, errors: 1 };
        const sessions = await sessResp.json();
        if (!sessions || sessions.length === 0) return { deleted: 0, errors: 1 };
        const session = sessions[0];

        const itemsResp = await fetch(`${BASE_URL}/api/quote_items?filter=QuoteID%3D'${encodeURIComponent(quoteId)}'`);
        const items = itemsResp.ok ? ((await itemsResp.json()) || []).filter(i => i.QuoteID === quoteId) : [];

        for (const item of items) {
            if (item.PK_ID) {
                try { await deleteJSON(`${BASE_URL}/api/quote_items/${item.PK_ID}`); deleted++; }
                catch (e) { errors++; }
            }
        }
        if (session.PK_ID) {
            try { await deleteJSON(`${BASE_URL}/api/quote_sessions/${session.PK_ID}`); deleted++; }
            catch (e) { errors++; }
        }
    } catch (e) { errors++; }
    return { deleted, errors };
}

// ── Cap Detection ───────────────────────────────────────────────────────────

const CAP_STYLES = ['C112', 'NE1000', 'NE400', 'C130', 'STC22', 'NE1020', 'NE204', 'C112P'];
const CAP_KEYWORDS = ['cap', 'hat', 'snapback', 'trucker', 'visor', 'beanie'];

function isCap(product) {
    const pn = (product.partNumber || product.style || '').toUpperCase();
    if (CAP_STYLES.some(c => pn === c || pn.startsWith(c + '_'))) return true;
    const desc = (product.description || '').toLowerCase();
    return CAP_KEYWORDS.some(k => desc.includes(k));
}

// ── Main Pipeline ───────────────────────────────────────────────────────────

async function main() {
    const args = process.argv.slice(2);
    const filePath = args.find(a => !a.startsWith('--'));
    const doSave = args.includes('--save');
    const noCleanup = args.includes('--no-cleanup');
    const showRaw = args.includes('--raw');

    if (!filePath) {
        console.error('Usage: node tests/e2e-verify-order.js <fixture-file> [--save] [--dry-run] [--raw]');
        process.exit(1);
    }

    const absPath = path.resolve(filePath);
    if (!fs.existsSync(absPath)) {
        console.error(`File not found: ${absPath}`);
        process.exit(1);
    }

    const text = fs.readFileSync(absPath, 'utf8');

    // Suppress parser debug logs
    const origLog = console.log;
    const origWarn = console.warn;
    console.log = (...a) => {
        if (typeof a[0] === 'string' && a[0].includes('[ShopWorksImportParser]')) return;
        origLog.apply(console, a);
    };
    console.warn = (...a) => {
        if (typeof a[0] === 'string' && (a[0].includes('[Embroidery') || a[0].includes('[ShopWorks'))) return;
        origWarn.apply(console, a);
    };

    // ═══════════════════════════════════════════════════════════════════════
    // STEP 1: PARSE
    // ═══════════════════════════════════════════════════════════════════════
    const parser = new ShopWorksImportParser();
    const parsed = parser.parse(text);

    console.log = origLog;
    console.warn = origWarn;

    console.log('\n' + '═'.repeat(70));
    console.log(`  E2E VERIFICATION — Order #${parsed.orderId || 'UNKNOWN'}`);
    console.log(`  Mode: ${doSave ? 'SAVE TO CASPIO' : 'DRY RUN (use --save to write)'}`);
    console.log('═'.repeat(70));

    // ── Step 1 Table: Parsed Data ────────────────────────────────────────
    printSection('STEP 1: PARSER OUTPUT');

    printField('Order #', parsed.orderId);
    printField('Customer', `${parsed.customer.company || '—'} (${parsed.customer.contactName || '—'})`);
    printField('Email', parsed.customer.email);
    printField('Sales Rep', `${parsed.salesRep.name || '—'} (${parsed.salesRep.email || '—'})`);
    printField('PO #', parsed.purchaseOrderNumber);
    printField('Ship State', parsed.shipping?.state || '—');

    console.log('\n  Products parsed:');
    printTable(
        ['Part #', 'Description', 'Color', 'Qty', 'SW Price', 'Cap?', 'Sizes'],
        parsed.products.map(p => [
            p.partNumber,
            (p.description || '').substring(0, 30),
            p.color || '—',
            p.quantity,
            currency(p.unitPrice),
            isCap(p) ? 'CAP' : 'GARM',
            Object.entries(p.sizes || {}).filter(([, q]) => q > 0).map(([s, q]) => `${s}:${q}`).join(' ')
        ])
    );

    if (parsed.customProducts.length > 0) {
        console.log('\n  Custom / Non-SanMar products:');
        printTable(
            ['Part #', 'Description', 'Qty', 'SW Price'],
            parsed.customProducts.map(p => [
                p.partNumber,
                (p.description || '').substring(0, 40),
                p.quantity,
                currency(p.unitPrice)
            ])
        );
    }

    if (parsed.decgItems.length > 0) {
        console.log('\n  Customer-supplied items (DECG/DECC):');
        printTable(
            ['Part #', 'Description', 'Qty', 'Price'],
            parsed.decgItems.map(d => [d.partNumber, d.description || '—', d.quantity, currency(d.unitPrice)])
        );
    }

    // Services table
    const svcRows = [];
    if (parsed.services.digitizing) svcRows.push(['Digitizing (DD)', `x${parsed.services.digitizingCount}`, currency(100 * parsed.services.digitizingCount)]);
    if (parsed.services.additionalLogo) svcRows.push(['Additional Logo', `x${parsed.services.additionalLogo.quantity}`, parsed.services.additionalLogo.position || 'AL']);
    if (parsed.services.rush) svcRows.push(['Rush', '1', currency(parsed.services.rush.amount)]);
    if (parsed.services.artCharges) svcRows.push(['Art Charges (GRT-50)', '1', currency(parsed.services.artCharges.amount)]);
    if (parsed.services.graphicDesign) svcRows.push(['Graphic Design (GRT-75)', `${parsed.services.graphicDesign.hours}h`, currency(parsed.services.graphicDesign.amount)]);
    if (parsed.services.patchSetup) svcRows.push(['Patch Setup', '1', currency(50)]);
    if (parsed.services.monograms.length > 0) parsed.services.monograms.forEach(m => svcRows.push(['Monogram', `x${m.quantity}`, m.description || '']));
    if (parsed.services.shipping) svcRows.push(['Shipping (parsed)', '1', currency(parsed.services.shipping.amount)]);

    if (svcRows.length > 0) {
        console.log('\n  Services detected:');
        printTable(['Service', 'Qty', 'Amount/Detail'], svcRows);
    }

    if (parsed.designNumbers.length > 0) {
        console.log('\n  Design numbers:');
        parsed.designNumbers.forEach(d => console.log(`    ${d}`));
    }

    console.log('\n  Order Summary (from ShopWorks):');
    printTable(
        ['Field', 'Value'],
        [
            ['Subtotal', currency(parsed.orderSummary.subtotal)],
            ['Sales Tax', currency(parsed.orderSummary.salesTax)],
            ['Tax Rate', parsed.orderSummary.taxRate != null ? `${parsed.orderSummary.taxRate.toFixed(1)}%` : '—'],
            ['Shipping', currency(parsed.orderSummary.shipping)],
            ['Total', currency(parsed.orderSummary.total)]
        ]
    );

    if (parsed.warnings.length > 0) {
        console.log('\n  Warnings:');
        parsed.warnings.forEach(w => console.log(`    ⚠ ${w}`));
    }
    if (parsed.unmatchedLines.length > 0) {
        console.log('\n  Unmatched lines:');
        parsed.unmatchedLines.forEach(l => {
            if (typeof l === 'object' && l.section) {
                console.log(`    ? [${l.section}] ${l.line}`);
            } else {
                console.log(`    ? ${l}`);
            }
        });
    }

    // ═══════════════════════════════════════════════════════════════════════
    // STEP 2: PRICING ENGINE (live API calls)
    // ═══════════════════════════════════════════════════════════════════════
    printSection('STEP 2: PRICING ENGINE (live API)');

    // Load service codes from API for audit price lookups (replaces hardcoded prices)
    let serviceCodeMap = {};
    try {
        const scResp = await fetchJSON(`${BASE_URL}/api/service-codes`);
        if (scResp.success && Array.isArray(scResp.data)) {
            for (const sc of scResp.data) {
                if (sc.ServiceCode) serviceCodeMap[sc.ServiceCode] = sc;
            }
            console.log(`  Service codes loaded: ${Object.keys(serviceCodeMap).length} codes`);
        }
    } catch (e) {
        console.log(`  Service codes API unavailable, using fallback prices: ${e.message}`);
    }

    // Initialize calculator with real API data
    const calc = new EmbroideryPricingCalculator({ skipInit: true });

    // Fetch real embroidery pricing bundle
    console.log('  Fetching embroidery pricing bundle...');
    try {
        const bundleResp = await fetch(`${BASE_URL}/api/embroidery-pricing-bundle`);
        if (bundleResp.ok) {
            const bundle = await bundleResp.json();
            // Apply bundle data to calculator (same as initializeConfig)
            if (bundle.embroideryTiers) {
                calc.tiers = {};
                for (const tier of bundle.embroideryTiers) {
                    calc.tiers[tier.tierName] = { embCost: tier.embCost, hasLTM: tier.hasLTM };
                }
            }
            if (bundle.marginDenominator) calc.marginDenominator = bundle.marginDenominator;
            if (bundle.roundingMethod) calc.roundingMethod = bundle.roundingMethod;
            if (bundle.capTiers) {
                calc.capTiers = {};
                for (const tier of bundle.capTiers) {
                    calc.capTiers[tier.tierName] = { embCost: tier.embCost };
                }
            }
            if (bundle.capRoundingMethod) calc.capRoundingMethod = bundle.capRoundingMethod;
            if (bundle.alTiers) {
                calc.alTiers = {};
                for (const tier of bundle.alTiers) {
                    calc.alTiers[tier.tierName] = { embCost: tier.embCost };
                }
            }
            if (bundle.capAlTiers) {
                calc.capAlTiers = {};
                for (const tier of bundle.capAlTiers) {
                    calc.capAlTiers[tier.tierName] = { embCost: tier.embCost };
                }
            }
            if (bundle.stitchSurcharges) {
                calc.stitchSurchargeTiers = bundle.stitchSurcharges.map(s => ({
                    max: s.maxStitchCount,
                    fee: s.fee
                }));
            }
            console.log('  ✓ Pricing bundle loaded from API');
        } else {
            console.log('  ⚠ Pricing bundle API failed, using defaults');
        }
    } catch (e) {
        console.log(`  ⚠ Pricing bundle fetch error: ${e.message}, using defaults`);
    }

    // Set AL tier defaults if API didn't provide them
    // These match the test helper defaults from pricing-test-helper.js
    if (!calc.alTiers || Object.keys(calc.alTiers).length === 0) {
        calc.alTiers = {
            '1-7': { embCost: 8.00 },
            '8-23': { embCost: 8.00 },
            '24-47': { embCost: 6.00 },
            '48-71': { embCost: 5.00 },
            '72+': { embCost: 4.00 }
        };
    }
    if (!calc.capAlTiers || Object.keys(calc.capAlTiers).length === 0) {
        calc.capAlTiers = {
            '1-7': { embCost: 6.00 },
            '8-23': { embCost: 6.00 },
            '24-47': { embCost: 5.00 },
            '48-71': { embCost: 4.00 },
            '72+': { embCost: 3.50 }
        };
    }
    if (!calc.capTiers || Object.keys(calc.capTiers).length === 0) {
        calc.capTiers = {
            '1-7': { embCost: 14.00 },
            '8-23': { embCost: 14.00 },
            '24-47': { embCost: 11.00 },
            '48-71': { embCost: 10.00 },
            '72+': { embCost: 9.00 }
        };
    }

    calc.initialized = true;
    calc.capInitialized = true;

    // Build products in the format calculateQuote() expects
    const pricingProducts = [];

    // Merge parser products by base style + color (combine size variants like PC61LS + PC61LS_3X)
    const productMap = new Map();
    for (const p of parsed.products) {
        // Extract base style (strip _2X, _3X, etc.)
        const baseStyle = (p.partNumber || '').replace(/_\w+$/, '');
        const key = `${baseStyle}||${p.color || ''}`;

        if (!productMap.has(key)) {
            productMap.set(key, {
                style: baseStyle,
                color: p.color || 'Unknown',
                catalogColor: p.catalogColor || p.color || '',
                title: p.description || baseStyle,
                productName: p.description || baseStyle,
                sizeBreakdown: {},
                totalQuantity: 0,
                isCap: isCap(p),
                sellPriceOverride: 0,
                sizeOverrides: {},
                imageUrl: '',
                logoAssignments: { primary: null, additional: [] }
            });
        }

        const merged = productMap.get(key);
        // Merge sizes
        const sizes = p.sizes || {};
        for (const [sz, qty] of Object.entries(sizes)) {
            if (qty > 0) {
                merged.sizeBreakdown[sz] = (merged.sizeBreakdown[sz] || 0) + qty;
                merged.totalQuantity += qty;
            }
        }
    }

    // Add custom products with sellPriceOverride
    for (const p of parsed.customProducts) {
        const key = `custom_${p.partNumber}||${p.color || ''}`;
        productMap.set(key, {
            style: p.partNumber || 'Custom',
            color: p.color || 'Unknown',
            catalogColor: '',
            title: p.description || p.partNumber || 'Custom Item',
            productName: p.description || p.partNumber || 'Custom Item',
            sizeBreakdown: p.sizes && Object.keys(p.sizes).length > 0
                ? p.sizes
                : { 'OSFA': p.quantity || 1 },
            totalQuantity: p.quantity || 1,
            isCap: isCap(p),
            sellPriceOverride: p.unitPrice || 0,
            sizeOverrides: {},
            imageUrl: '',
            logoAssignments: { primary: null, additional: [] }
        });
    }

    const mergedProducts = Array.from(productMap.values());

    // Build logo configuration
    const garmentProducts = mergedProducts.filter(p => !p.isCap);
    const capProductsList = mergedProducts.filter(p => p.isCap);
    const garmentQty = garmentProducts.reduce((s, p) => s + p.totalQuantity, 0);
    const capQty = capProductsList.reduce((s, p) => s + p.totalQuantity, 0);

    // Default logo config — primary logo for each type
    const primaryGarmentLogo = garmentQty > 0 ? {
        id: 'primary',
        position: 'Left Chest',
        stitchCount: 8000,
        needsDigitizing: parsed.services.digitizing,
        isPrimary: true
    } : null;

    const primaryCapLogo = capQty > 0 ? {
        id: 'cap-primary',
        position: 'Cap Front',
        stitchCount: 5000,
        needsDigitizing: parsed.services.digitizing && parsed.services.digitizingCount > 1,
        isPrimary: true,
        embellishmentType: 'embroidery'
    } : null;

    // Additional logos
    const garmentALLogos = [];
    const capALLogos = [];
    if (parsed.services.additionalLogo) {
        const al = parsed.services.additionalLogo;
        if (garmentQty > 0) {
            garmentALLogos.push({
                id: 'global-al-garment',
                position: 'AL',
                stitchCount: 8000,
                needsDigitizing: false,
                isPrimary: false
            });
        }
    }

    // Assign logos to products
    for (const p of mergedProducts) {
        if (p.isCap) {
            p.logoAssignments.primary = primaryCapLogo
                ? { logoId: 'cap-primary', quantity: p.totalQuantity }
                : null;
        } else {
            p.logoAssignments.primary = primaryGarmentLogo
                ? { logoId: 'primary', quantity: p.totalQuantity }
                : null;
            if (garmentALLogos.length > 0 && parsed.services.additionalLogo) {
                p.logoAssignments.additional = [{
                    id: 'global-al-garment',
                    position: 'AL',
                    stitchCount: 8000,
                    quantity: p.totalQuantity
                }];
            }
        }
    }

    const logoConfigs = {
        garment: {
            primary: primaryGarmentLogo,
            additional: garmentALLogos
        },
        cap: {
            primary: primaryCapLogo,
            additional: capALLogos
        }
    };

    const allLogos = [primaryGarmentLogo, ...garmentALLogos, primaryCapLogo, ...capALLogos].filter(Boolean);

    // Run the pricing engine with live API calls for fetchSizePricing
    console.log('  Calculating prices (fetching SanMar costs from API)...');
    let pricing;
    try {
        pricing = await calc.calculateQuote(mergedProducts, allLogos, logoConfigs);
        if (!pricing || pricing.error) {
            console.error(`  ✗ Pricing engine error: ${pricing?.error || 'null result'}`);
            process.exit(1);
        }
        console.log('  ✓ Pricing calculated successfully');
    } catch (e) {
        console.error(`  ✗ Pricing engine threw: ${e.message}`);
        process.exit(1);
    }

    // ── Step 2 Table: Pricing Results ────────────────────────────────────
    console.log('\n  Tier determination:');
    printTable(
        ['Category', 'Qty', 'Tier', 'Emb Cost/pc'],
        [
            ['Garments', garmentQty, pricing.garmentTier || '—', currency(calc.getEmbroideryCost(pricing.garmentTier || '1-7'))],
            ['Caps', capQty, pricing.capTier || '—', capQty > 0 ? currency(calc.capTiers[pricing.capTier]?.embCost) : '—']
        ]
    );

    console.log('\n  Product pricing (our calculated prices):');
    const pricingRows = [];
    for (const pp of pricing.products) {
        for (const li of pp.lineItems) {
            pricingRows.push([
                pp.product.style,
                li.description.substring(0, 20),
                li.quantity,
                currency(li.unitPrice),
                currency(li.ltmPerUnit),
                currency(li.unitPriceWithLTM),
                currency(li.total),
                pp.isCap ? 'CAP' : 'GARM'
            ]);
        }
    }
    printTable(
        ['Style', 'Sizes', 'Qty', 'Unit $', 'LTM/pc', 'Final/pc', 'Line $', 'Type'],
        pricingRows
    );

    if (pricing.additionalServices.length > 0) {
        console.log('\n  Additional services (AL/FB/Mono):');
        printTable(
            ['Part #', 'Description', 'Qty', 'Unit $', 'Total'],
            pricing.additionalServices.map(s => [
                s.partNumber,
                s.description.substring(0, 30),
                s.quantity,
                currency(s.unitPrice),
                currency(s.total)
            ])
        );
    }

    // Calculate fees from parsed services
    const artCharge = parsed.services.artCharges?.amount || 0;
    const graphicDesignHours = parsed.services.graphicDesign?.hours || 0;
    const graphicDesignCharge = parsed.services.graphicDesign?.amount || 0;
    const rushFee = parsed.services.rush?.amount || 0;
    const shippingFee = parsed.orderSummary.shipping || 0;
    const taxRate = (parsed.orderSummary.taxRate || 0) / 100; // Convert from percent to decimal

    console.log('\n  Totals summary:');
    printTable(
        ['Component', 'Amount'],
        [
            ['Product subtotal', currency(pricing.subtotal)],
            ['LTM fee (baked in)', currency(pricing.ltmFee)],
            ['Setup/Digitizing', currency(pricing.setupFees)],
            ['Stitch surcharges', currency(pricing.additionalStitchTotal)],
            ['Additional services', currency(pricing.additionalServicesTotal)],
            ['Grand total (pre-fees)', currency(pricing.grandTotal)],
            ['Art charge', currency(artCharge)],
            ['Graphic design', currency(graphicDesignCharge)],
            ['Rush fee', currency(rushFee)],
            ['Shipping', currency(shippingFee)],
            ['Tax rate', taxRate > 0 ? `${(taxRate * 100).toFixed(1)}%` : 'Out of state (0%)'],
            ['Tax amount', currency(Math.round((pricing.grandTotal + artCharge + graphicDesignCharge + rushFee + shippingFee) * taxRate * 100) / 100)]
        ]
    );

    // ═══════════════════════════════════════════════════════════════════════
    // STEP 3: BUILD SAVE PAYLOAD
    // ═══════════════════════════════════════════════════════════════════════
    printSection('STEP 3: SAVE PAYLOAD');

    const customerData = {
        email: parsed.customer.email || 'import@nwcustomapparel.com',
        name: parsed.customer.contactName || parsed.customer.company || 'Import',
        company: parsed.customer.company || '',
        salesRepEmail: parsed.salesRep.email || 'sales@nwcustomapparel.com',
        salesRepName: parsed.salesRep.name || '',
        phone: parsed.customer.phone || '',
        notes: parsed.notes.join('\n'),
        artCharge,
        graphicDesignHours,
        graphicDesignCharge,
        rushFee,
        sampleFee: 0,
        sampleQty: 0,
        discount: 0,
        discountPercent: 0,
        discountReason: '',
        orderNumber: parsed.orderId || '',
        customerNumber: parsed.customer.customerId || '',
        purchaseOrderNumber: parsed.purchaseOrderNumber || '',
        shipToAddress: parsed.shipping?.street || '',
        shipToCity: parsed.shipping?.city || '',
        shipToState: parsed.shipping?.state || '',
        shipToZip: parsed.shipping?.zip || '',
        shipMethod: parsed.shipping?.method || '',
        dateOrderPlaced: parsed.dateOrderPlaced || null,
        reqShipDate: parsed.reqShipDate || null,
        dropDeadDate: parsed.dropDeadDate || null,
        paymentTerms: parsed.paymentTerms || '',
        taxRate: taxRate,
        taxAmount: Math.round((pricing.grandTotal + artCharge + graphicDesignCharge + rushFee + shippingFee) * taxRate * 100) / 100,
        designNumbers: parsed.designNumbers,
        importNotes: [...parsed.warnings, ...parsed.unmatchedLines]
    };

    const totalAmount = pricing.grandTotal + artCharge + graphicDesignCharge + rushFee - 0 + customerData.taxAmount + shippingFee;

    console.log('  Session data preview:');
    printTable(
        ['Field', 'Value'],
        [
            ['CustomerEmail', customerData.email],
            ['CustomerName', customerData.name],
            ['CompanyName', customerData.company],
            ['SalesRepName', customerData.salesRepName],
            ['TotalQuantity', pricing.totalQuantity],
            ['SubtotalAmount', currency(pricing.subtotal + pricing.ltmFee)],
            ['TotalAmount', currency(totalAmount)],
            ['OrderNumber', customerData.orderNumber],
            ['PurchaseOrderNumber', customerData.purchaseOrderNumber],
            ['ShipToState', customerData.shipToState],
            ['TaxRate', customerData.taxRate],
            ['TaxAmount', currency(customerData.taxAmount)],
            ['DesignNumbers', JSON.stringify(customerData.designNumbers)]
        ]
    );

    // Build line items preview
    const lineItemsPreview = [];
    let lineNum = 1;

    // Products
    for (const pp of pricing.products) {
        for (const li of pp.lineItems) {
            lineItemsPreview.push({
                line: lineNum++,
                styleNumber: pp.product.style,
                productName: `${pp.product.title} - ${pp.product.color}`,
                embType: 'embroidery',
                qty: li.quantity,
                unitPrice: parseFloat((li.unitPriceWithLTM || li.unitPrice).toFixed(2)),
                lineTotal: parseFloat(((li.unitPriceWithLTM || li.unitPrice) * li.quantity).toFixed(2)),
                type: pp.isCap ? 'CAP' : 'GARM'
            });
        }
    }

    // Additional services
    for (const svc of pricing.additionalServices) {
        lineItemsPreview.push({
            line: lineNum++,
            styleNumber: svc.partNumber,
            productName: svc.description,
            embType: 'embroidery-additional',
            qty: svc.quantity,
            unitPrice: parseFloat(svc.unitPrice.toFixed(2)),
            lineTotal: parseFloat(svc.total.toFixed(2)),
            type: 'SVC'
        });
    }

    // Fee items
    const feeItems = [];
    if (pricing.garmentStitchTotal > 0) {
        const gQty = pricing.garmentQuantity || 1;
        feeItems.push({ pn: 'AS-Garm', name: 'Extra Stitches - Garments', qty: gQty, unit: parseFloat((pricing.garmentStitchTotal / gQty).toFixed(4)), total: pricing.garmentStitchTotal });
    }
    if (pricing.capStitchTotal > 0) {
        const cQty = pricing.capQuantity || 1;
        feeItems.push({ pn: 'AS-CAP', name: 'Extra Stitches - Caps', qty: cQty, unit: parseFloat((pricing.capStitchTotal / cQty).toFixed(4)), total: pricing.capStitchTotal });
    }
    if (pricing.garmentSetupFees > 0) {
        feeItems.push({ pn: 'DD', name: 'Digitizing - Garments', qty: 1, unit: pricing.garmentSetupFees, total: pricing.garmentSetupFees });
    }
    if (pricing.capSetupFees > 0) {
        feeItems.push({ pn: 'DD', name: 'Digitizing - Caps', qty: 1, unit: pricing.capSetupFees, total: pricing.capSetupFees });
    }
    if (artCharge > 0) {
        feeItems.push({ pn: 'GRT-50', name: 'Art/Setup Fee', qty: 1, unit: artCharge, total: artCharge });
    }
    if (graphicDesignCharge > 0) {
        feeItems.push({ pn: 'GRT-75', name: 'Graphic Design Services', qty: graphicDesignHours || 1, unit: 75, total: graphicDesignCharge });
    }
    if (rushFee > 0) {
        feeItems.push({ pn: 'RUSH', name: 'Rush Order Fee', qty: 1, unit: rushFee, total: rushFee });
    }
    if (shippingFee > 0) {
        feeItems.push({ pn: 'SHIP', name: 'Shipping', qty: 1, unit: shippingFee, total: shippingFee });
    }
    if (customerData.taxAmount > 0) {
        feeItems.push({ pn: 'TAX', name: `Sales Tax (${(taxRate * 100).toFixed(1)}%)`, qty: 1, unit: taxRate * 100, total: customerData.taxAmount });
    }

    for (const fee of feeItems) {
        lineItemsPreview.push({
            line: lineNum++,
            styleNumber: fee.pn,
            productName: fee.name,
            embType: 'fee',
            qty: fee.qty,
            unitPrice: fee.unit,
            lineTotal: parseFloat(fee.total.toFixed(2)),
            type: 'FEE'
        });
    }

    console.log('\n  Line items to save:');
    printTable(
        ['#', 'Part #', 'Name', 'Type', 'Qty', 'Unit $', 'Line $', 'Cat'],
        lineItemsPreview.map(li => [
            li.line,
            li.styleNumber,
            li.productName.substring(0, 30),
            li.embType.substring(0, 12),
            li.qty,
            currency(li.unitPrice),
            currency(li.lineTotal),
            li.type
        ])
    );

    // ═══════════════════════════════════════════════════════════════════════
    // STEP 4: SAVE TO CASPIO (only with --save flag)
    // ═══════════════════════════════════════════════════════════════════════
    if (!doSave) {
        printSection('STEP 4: SAVE (SKIPPED — dry run)');
        console.log('  Use --save flag to actually write to Caspio.');
        console.log('  Review the tables above to verify data looks correct first.');
    } else {
        printSection('STEP 4: SAVING TO CASPIO');

        try {
            // Generate quote ID
            console.log('  Generating quote ID...');
            const seqResp = await fetchJSON(`${BASE_URL}/api/quote-sequence/EMB`);
            const quoteID = `${seqResp.prefix}-${seqResp.year}-${String(seqResp.sequence).padStart(3, '0')}`;
            const sessionID = `emb_e2e_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().replace(/\.\d{3}Z$/, '');
            const addedAt = new Date().toISOString().replace(/\.\d{3}Z$/, '');

            console.log(`  Quote ID: ${quoteID}`);

            // Build session data (exact replica of EmbroideryQuoteService.saveQuote)
            const primaryLogo = allLogos.find(l => l?.id === 'primary' || l?.isPrimary);
            const additionalLogo = allLogos.find(l => l?.id?.includes('additional') && !l?.id?.includes('cap'));
            const capPrimLogo = allLogos.find(l => l?.id === 'cap-primary');

            const sessionData = {
                QuoteID: quoteID,
                SessionID: sessionID,
                CustomerEmail: customerData.email,
                CustomerName: customerData.name,
                CompanyName: customerData.company || 'Not Provided',
                SalesRepEmail: customerData.salesRepEmail,
                SalesRepName: customerData.salesRepName || '',
                TotalQuantity: pricing.totalQuantity || 0,
                SubtotalAmount: parseFloat(((pricing.subtotal || 0) + (pricing.ltmFee || 0)).toFixed(2)),
                LTMFeeTotal: parseFloat((pricing.ltmFee || 0).toFixed(2)),
                TotalAmount: parseFloat(totalAmount.toFixed(2)),
                Status: 'Open',
                CreatedAt_Quote: addedAt,
                ExpiresAt: expiresAt,
                Notes: customerData.notes || '',
                PrintLocation: primaryLogo?.position || 'Left Chest',
                StitchCount: primaryLogo?.stitchCount || 8000,
                DigitizingFee: primaryLogo?.needsDigitizing ? 100 : 0,
                AdditionalLogoLocation: additionalLogo?.position || '',
                AdditionalStitchCount: pricing.additionalServices?.find(s => !s.isCap && s.type === 'additional_logo')?.stitchCount || 0,
                CapPrintLocation: capPrimLogo?.position || '',
                CapStitchCount: capPrimLogo?.stitchCount || 0,
                CapDigitizingFee: capPrimLogo?.needsDigitizing ? 100 : 0,
                CapEmbellishmentType: pricing.capEmbellishmentType || 'embroidery',
                GarmentStitchCharge: parseFloat(pricing.garmentStitchTotal?.toFixed(2)) || 0,
                CapStitchCharge: parseFloat(pricing.capStitchTotal?.toFixed(2)) || 0,
                AdditionalStitchCharge: parseFloat(pricing.additionalStitchTotal?.toFixed(2)) || 0,
                ALChargeGarment: parseFloat(pricing.additionalServices?.filter(s => !s.isCap)?.reduce((sum, s) => sum + (s.total || 0), 0)?.toFixed(2)) || 0,
                ALChargeCap: parseFloat(pricing.additionalServices?.filter(s => s.isCap)?.reduce((sum, s) => sum + (s.total || 0), 0)?.toFixed(2)) || 0,
                ALGarmentQty: pricing.garmentQuantity || 0,
                ALCapQty: pricing.capQuantity || 0,
                ALGarmentUnitPrice: pricing.additionalServices?.find(s => !s.isCap)?.unitPrice || 0,
                ALCapUnitPrice: pricing.additionalServices?.find(s => s.isCap)?.unitPrice || 0,
                ALGarmentDesc: pricing.additionalServices?.find(s => !s.isCap)?.description || '',
                ALCapDesc: pricing.additionalServices?.find(s => s.isCap)?.description || '',
                GarmentDigitizing: parseFloat(pricing.garmentSetupFees?.toFixed(2)) || 0,
                CapDigitizing: parseFloat(pricing.capSetupFees?.toFixed(2)) || 0,
                AdditionalStitchUnitPrice: pricing.totalQuantity > 0
                    ? parseFloat((pricing.additionalStitchTotal / pricing.totalQuantity).toFixed(4)) || 0
                    : 0,
                ArtCharge: parseFloat(artCharge.toFixed(2)) || 0,
                GraphicDesignHours: graphicDesignHours || 0,
                GraphicDesignCharge: parseFloat(graphicDesignCharge.toFixed(2)) || 0,
                RushFee: parseFloat(rushFee.toFixed(2)) || 0,
                SampleFee: 0,
                SampleQty: 0,
                LTM_Garment: 0,
                LTM_Cap: 0,
                Discount: 0,
                DiscountPercent: 0,
                DiscountReason: '',
                Phone: customerData.phone || '',
                OrderNumber: customerData.orderNumber || '',
                CustomerNumber: customerData.customerNumber || '',
                PurchaseOrderNumber: customerData.purchaseOrderNumber || '',
                ShipToAddress: customerData.shipToAddress || '',
                ShipToCity: customerData.shipToCity || '',
                ShipToState: customerData.shipToState || '',
                ShipToZip: customerData.shipToZip || '',
                ShipMethod: customerData.shipMethod || '',
                DateOrderPlaced: customerData.dateOrderPlaced ? new Date(customerData.dateOrderPlaced).toISOString() : null,
                ReqShipDate: customerData.reqShipDate ? new Date(customerData.reqShipDate).toISOString() : null,
                DropDeadDate: customerData.dropDeadDate ? new Date(customerData.dropDeadDate).toISOString() : null,
                PaymentTerms: customerData.paymentTerms || '',
                DesignNumbers: JSON.stringify(customerData.designNumbers || []),
                DigitizingCodes: (parsed.services.digitizingCodes || []).join(','),
                TaxRate: customerData.taxRate ?? 0,
                TaxAmount: customerData.taxAmount ?? 0,
                ImportNotes: JSON.stringify(customerData.importNotes || []),
                // ShopWorks pricing audit (2026-02-13)
                SWTotal: parsed.orderSummary.total || 0,
                SWSubtotal: parsed.orderSummary.subtotal || 0,
                PriceAuditJSON: JSON.stringify(buildPriceAudit(parsed, pricing, mergedProducts, serviceCodeMap))
            };

            // Save session
            console.log('  Saving quote session...');
            await postJSON(`${BASE_URL}/api/quote_sessions`, sessionData);
            console.log('  ✓ Session saved');

            // Save line items
            let savedLineNum = 1;
            let savedCount = 0;
            let failCount = 0;

            // Product items
            let isFirstItem = true;
            for (const pp of pricing.products) {
                for (const li of pp.lineItems) {
                    let logoSpecsData = '';
                    if (isFirstItem) {
                        try {
                            logoSpecsData = JSON.stringify({
                                logos: allLogos.map(l => ({
                                    pos: l.position,
                                    stitch: l.stitchCount,
                                    digit: l.needsDigitizing ? 1 : 0,
                                    primary: l.isPrimary ? 1 : 0
                                })),
                                tier: pricing.tier,
                                setup: pricing.setupFees
                            });
                        } catch (e) { logoSpecsData = ''; }
                    }

                    const sizeBreakdown = {};
                    const sizeRegex = /([A-Z0-9\/]+)\((\d+)\)/gi;
                    let match;
                    while ((match = sizeRegex.exec(li.description)) !== null) {
                        sizeBreakdown[match[1].toUpperCase()] = parseInt(match[2]);
                    }

                    const itemData = {
                        QuoteID: quoteID,
                        LineNumber: savedLineNum++,
                        StyleNumber: pp.product.style,
                        ProductName: `${pp.product.title} - ${pp.product.color}`,
                        Color: pp.product.color,
                        ColorCode: pp.product.catalogColor || '',
                        EmbellishmentType: 'embroidery',
                        PrintLocation: allLogos.map(l => l.positionCode || l.position).join('_'),
                        PrintLocationName: allLogos.map(l => l.position).join(' + '),
                        Quantity: li.quantity,
                        HasLTM: pricing.ltmFee > 0 ? 'Yes' : 'No',
                        BaseUnitPrice: parseFloat((li.unitPriceWithLTM || li.unitPrice).toFixed(2)),
                        LTMPerUnit: parseFloat((li.ltmPerUnit || 0).toFixed(2)),
                        FinalUnitPrice: parseFloat((li.unitPriceWithLTM || li.unitPrice).toFixed(2)),
                        LineTotal: parseFloat(((li.unitPriceWithLTM || li.unitPrice) * li.quantity).toFixed(2)),
                        SizeBreakdown: JSON.stringify(sizeBreakdown),
                        PricingTier: pp.isCap ? pricing.capTier : pricing.garmentTier,
                        ImageURL: pp.product.imageUrl || '',
                        AddedAt: addedAt,
                        LogoSpecs: logoSpecsData
                    };

                    try {
                        await postJSON(`${BASE_URL}/api/quote_items`, itemData);
                        savedCount++;
                    } catch (e) {
                        console.error(`  ✗ Failed to save item ${savedLineNum - 1}: ${e.message}`);
                        failCount++;
                    }
                    isFirstItem = false;
                }
            }

            // Additional service items
            for (const svc of pricing.additionalServices) {
                const itemData = {
                    QuoteID: quoteID,
                    LineNumber: savedLineNum++,
                    StyleNumber: svc.partNumber,
                    ProductName: svc.description,
                    Color: '',
                    ColorCode: '',
                    EmbellishmentType: svc.type === 'monogram' ? 'monogram' : 'embroidery-additional',
                    PrintLocation: svc.location || '',
                    PrintLocationName: svc.location || '',
                    Quantity: svc.quantity,
                    HasLTM: 'No',
                    BaseUnitPrice: parseFloat(svc.unitPrice.toFixed(2)),
                    LTMPerUnit: 0,
                    FinalUnitPrice: parseFloat(svc.unitPrice.toFixed(2)),
                    LineTotal: parseFloat(svc.total.toFixed(2)),
                    SizeBreakdown: JSON.stringify(svc.metadata || {}),
                    PricingTier: pricing.tier,
                    ImageURL: '',
                    AddedAt: addedAt,
                    LogoSpecs: ''
                };

                try {
                    await postJSON(`${BASE_URL}/api/quote_items`, itemData);
                    savedCount++;
                } catch (e) {
                    console.error(`  ✗ Failed to save AL item: ${e.message}`);
                    failCount++;
                }
            }

            // Fee items
            for (const fee of feeItems) {
                const itemData = {
                    QuoteID: quoteID,
                    LineNumber: savedLineNum++,
                    StyleNumber: fee.pn,
                    ProductName: fee.name,
                    Color: '',
                    ColorCode: '',
                    EmbellishmentType: 'fee',
                    PrintLocation: '',
                    PrintLocationName: '',
                    Quantity: fee.qty,
                    HasLTM: 'No',
                    BaseUnitPrice: parseFloat(fee.unit.toFixed(2)),
                    LTMPerUnit: 0,
                    FinalUnitPrice: parseFloat(fee.unit.toFixed(2)),
                    LineTotal: parseFloat(fee.total.toFixed(2)),
                    SizeBreakdown: '',
                    PricingTier: '',
                    ImageURL: '',
                    AddedAt: addedAt,
                    LogoSpecs: ''
                };

                try {
                    await postJSON(`${BASE_URL}/api/quote_items`, itemData);
                    savedCount++;
                } catch (e) {
                    console.error(`  ✗ Failed to save fee ${fee.pn}: ${e.message}`);
                    failCount++;
                }
            }

            console.log(`\n  ✓ Saved ${savedCount} line items (${failCount} failed)`);

            // Print the quote view URL
            const quoteURL = `https://nwcustomapparel.com/pages/quote-view.html?quoteId=${quoteID}`;
            printSection('STEP 5: QUOTE URL');
            console.log(`  Quote ID:  ${quoteID}`);
            console.log(`  View URL:  ${quoteURL}`);

            // ═══════════════════════════════════════════════════════════════
            // STEP 6: VERIFY SAVED QUOTE
            // ═══════════════════════════════════════════════════════════════
            printSection('STEP 6: VERIFY SAVED QUOTE');
            console.log('  Waiting for Caspio to process...');
            await new Promise(r => setTimeout(r, 1500));

            const productCount = pricing.products.reduce((sum, pp) => sum + pp.lineItems.length, 0);
            const verify = await verifyQuote(quoteID, productCount, totalAmount, sessionData);

            console.log('');
            for (const c of verify.checks) {
                const icon = c.ok ? 'v' : 'x';
                console.log(`  ${icon} ${c.name}${c.detail ? ` — ${c.detail}` : ''}`);
            }

            if (verify.ok) {
                console.log('\n  All verification checks PASSED.');
            } else {
                console.log('\n  VERIFICATION FAILED. Some checks did not pass.');
            }

            // ═══════════════════════════════════════════════════════════════
            // STEP 7: CLEANUP
            // ═══════════════════════════════════════════════════════════════
            if (!noCleanup) {
                printSection('STEP 7: CLEANUP');
                const cleanup = await cleanupQuote(quoteID);
                console.log(`  Deleted ${cleanup.deleted} records (${cleanup.errors} errors).`);
                if (cleanup.errors === 0) {
                    console.log('  Test quote cleaned up successfully.');
                }
            } else {
                printSection('STEP 7: CLEANUP (SKIPPED — --no-cleanup)');
                console.log(`  Quote kept for manual inspection: ${quoteURL}`);
            }

        } catch (e) {
            console.error(`\n  ✗ SAVE FAILED: ${e.message}`);
            process.exit(1);
        }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // FINAL SUMMARY
    // ═══════════════════════════════════════════════════════════════════════
    console.log('\n' + '═'.repeat(70));
    console.log(`  VERIFICATION COMPLETE — Order #${parsed.orderId}`);
    console.log(`  ${parsed.warnings.length} warning(s), ${parsed.unmatchedLines.length} unmatched line(s)`);
    if (!doSave) console.log(`  Run with --save to write to Caspio`);
    console.log('═'.repeat(70) + '\n');
}

main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
