#!/usr/bin/env node
/**
 * Quick Order Verification Script
 *
 * Parses a ShopWorks order fixture file and prints a human-readable summary.
 * Used for verifying real order imports during development.
 *
 * Usage:
 *   node tests/verify-order.js tests/fixtures/shopworks-orders/some-order.txt
 *   node tests/verify-order.js --text "paste raw order text here"
 */
const path = require('path');
const fs = require('fs');

// Load test setup (stubs fetch, etc.)
require('./setup');

const ShopWorksImportParser = require('../shared_components/js/shopworks-import-parser');

// ── Helpers ──────────────────────────────────────────────────────────────────

function pad(label, width = 22) {
    return (label + ':').padEnd(width);
}

function currency(val) {
    if (val == null) return '—';
    return '$' + Number(val).toFixed(2);
}

function printSection(title) {
    const line = '─'.repeat(60);
    console.log(`\n${line}`);
    console.log(`  ${title}`);
    console.log(line);
}

function printField(label, value, indent = 2) {
    const prefix = ' '.repeat(indent);
    const display = value == null || value === '' ? '—' : value;
    console.log(`${prefix}${pad(label)} ${display}`);
}

// ── Main ─────────────────────────────────────────────────────────────────────

function main() {
    const args = process.argv.slice(2);
    let text;

    if (args[0] === '--text') {
        text = args.slice(1).join(' ');
    } else if (args[0]) {
        const filePath = path.resolve(args[0]);
        if (!fs.existsSync(filePath)) {
            console.error(`File not found: ${filePath}`);
            process.exit(1);
        }
        text = fs.readFileSync(filePath, 'utf8');
    } else {
        console.error('Usage: node tests/verify-order.js <fixture-file>');
        console.error('       node tests/verify-order.js --text "<order text>"');
        process.exit(1);
    }

    // Suppress parser debug logs during verification
    const origLog = console.log;
    console.log = (...a) => {
        if (typeof a[0] === 'string' && a[0].includes('[ShopWorksImportParser]')) return;
        origLog.apply(console, a);
    };

    const parser = new ShopWorksImportParser();
    const r = parser.parse(text);

    // Restore console.log for our output
    console.log = origLog;

    // ── Header ───────────────────────────────────────────────────────────
    console.log('\n' + '═'.repeat(60));
    console.log(`  SHOPWORKS ORDER VERIFICATION — #${r.orderId || 'UNKNOWN'}`);
    console.log('═'.repeat(60));

    // ── Customer ─────────────────────────────────────────────────────────
    printSection('CUSTOMER');
    printField('Customer #', r.customer.customerId);
    printField('Company', r.customer.company);
    printField('Contact', r.customer.contactName);
    printField('Email', r.customer.email);
    printField('Phone', r.customer.phone);

    // ── Sales Rep ────────────────────────────────────────────────────────
    printSection('SALES REP');
    printField('Name', r.salesRep.name);
    printField('Email', r.salesRep.email);

    // ── Order Details ────────────────────────────────────────────────────
    printSection('ORDER DETAILS');
    printField('PO #', r.purchaseOrderNumber);
    printField('Date Placed', r.dateOrderPlaced);
    printField('Req Ship Date', r.reqShipDate);
    printField('Drop Dead Date', r.dropDeadDate);
    printField('Terms', r.paymentTerms);

    // ── Products ─────────────────────────────────────────────────────────
    printSection(`PRODUCTS (${r.products.length} SanMar + ${r.customProducts.length} custom)`);
    for (const p of r.products) {
        const sizes = p.sizes || {};
        const sizeStr = Object.entries(sizes)
            .filter(([, qty]) => qty > 0)
            .map(([sz, qty]) => `${sz}:${qty}`)
            .join(', ');
        console.log(`  [${p.partNumber}] ${p.description || ''}`);
        console.log(`    Color: ${p.color || '—'}  Qty: ${p.quantity || 0}  Price: ${currency(p.unitPrice)}`);
        if (sizeStr) console.log(`    Sizes: ${sizeStr}`);
    }

    if (r.customProducts.length > 0) {
        console.log('\n  Custom / Non-SanMar:');
        for (const p of r.customProducts) {
            console.log(`  [${p.partNumber}] ${p.description || ''}`);
            console.log(`    Qty: ${p.quantity || 0}  Price: ${currency(p.unitPrice)}`);
        }
    }

    // ── DECG Items ───────────────────────────────────────────────────────
    if (r.decgItems.length > 0) {
        printSection(`CUSTOMER-SUPPLIED (${r.decgItems.length})`);
        for (const d of r.decgItems) {
            console.log(`  [${d.partNumber}] ${d.description || ''}`);
            console.log(`    Qty: ${d.quantity || 0}  Price: ${currency(d.unitPrice)}`);
        }
    }

    // ── Services ─────────────────────────────────────────────────────────
    printSection('SERVICES');
    printField('Digitizing', r.services.digitizing ? `YES (×${r.services.digitizingCount})` : 'No');
    printField('Additional Logo', r.services.additionalLogo
        ? `${r.services.additionalLogo.position || 'AL'} × ${r.services.additionalLogo.quantity}`
        : 'No');
    printField('Rush', r.services.rush ? currency(r.services.rush.amount) : 'No');
    printField('Art Charges', r.services.artCharges ? currency(r.services.artCharges.amount) : 'No');
    printField('Graphic Design', r.services.graphicDesign
        ? `${r.services.graphicDesign.hours}h @ ${currency(r.services.graphicDesign.amount)}`
        : 'No');
    printField('Patch Setup', r.services.patchSetup ? 'YES' : 'No');
    printField('Shipping Svc', r.services.shipping
        ? `${currency(r.services.shipping.amount)} — ${r.services.shipping.description || ''}`
        : 'No');
    if (r.services.monograms.length > 0) {
        printField('Monograms', `${r.services.monograms.length} entries`);
        for (const m of r.services.monograms) {
            console.log(`    × ${m.quantity}: ${m.description || '—'}`);
        }
    } else {
        printField('Monograms', 'No');
    }

    // ── Design Numbers ───────────────────────────────────────────────────
    if (r.designNumbers.length > 0) {
        printSection(`DESIGN NUMBERS (${r.designNumbers.length})`);
        for (const d of r.designNumbers) {
            console.log(`  ${d}`);
        }
    }

    // ── Shipping ─────────────────────────────────────────────────────────
    printSection('SHIPPING');
    if (r.shipping) {
        printField('Method', r.shipping.method);
        printField('Street', r.shipping.street);
        printField('City', r.shipping.city);
        printField('State', r.shipping.state);
        printField('ZIP', r.shipping.zip);
        printField('Raw Address', r.shipping.rawAddress);
    } else {
        console.log('  (no shipping info parsed)');
    }

    // ── Order Summary ────────────────────────────────────────────────────
    printSection('ORDER SUMMARY');
    printField('Subtotal', currency(r.orderSummary.subtotal));
    printField('Sales Tax', currency(r.orderSummary.salesTax));
    printField('Tax Rate', r.orderSummary.taxRate != null ? `${r.orderSummary.taxRate.toFixed(1)}%` : '—');
    printField('Shipping', currency(r.orderSummary.shipping));
    printField('Total', currency(r.orderSummary.total));

    // ── Notes ────────────────────────────────────────────────────────────
    if (r.notes.length > 0) {
        printSection(`NOTES (${r.notes.length})`);
        for (const n of r.notes) {
            console.log(`  • ${n}`);
        }
    }

    // ── Warnings ─────────────────────────────────────────────────────────
    if (r.warnings.length > 0) {
        printSection(`⚠ WARNINGS (${r.warnings.length})`);
        for (const w of r.warnings) {
            console.log(`  ⚠ ${w}`);
        }
    }

    // ── Review Items ─────────────────────────────────────────────────────
    if (r.reviewItems.length > 0) {
        printSection(`REVIEW ITEMS (${r.reviewItems.length})`);
        for (const ri of r.reviewItems) {
            console.log(`  ? [${ri.partNumber || '—'}] ${ri.reason || ri.description || JSON.stringify(ri)}`);
        }
    }

    // ── Unmatched Lines ──────────────────────────────────────────────────
    if (r.unmatchedLines.length > 0) {
        printSection(`UNMATCHED LINES (${r.unmatchedLines.length})`);
        for (const line of r.unmatchedLines) {
            if (typeof line === 'object' && line.section) {
                console.log(`  ? [${line.section}] ${line.line}`);
            } else {
                console.log(`  ? ${line}`);
            }
        }
    }

    // ── Raw Items Debug ──────────────────────────────────────────────────
    if (args.includes('--raw')) {
        printSection(`RAW ITEMS (${r.rawItems.length})`);
        for (const ri of r.rawItems) {
            console.log(`  [${ri.partNumber}] qty:${ri.quantity} price:${currency(ri.unitPrice)} — ${ri.description || ''}`);
        }
    }

    console.log('\n' + '═'.repeat(60));
    console.log(`  Parse complete. ${r.warnings.length} warning(s), ${r.unmatchedLines.length} unmatched line(s).`);
    console.log('═'.repeat(60) + '\n');
}

main();
