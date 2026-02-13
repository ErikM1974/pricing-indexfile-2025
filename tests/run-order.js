/**
 * Ad-hoc ShopWorks order test runner
 * Usage: node tests/run-order.js path/to/order.txt
 * Supports single-order files and multi-order batch files
 * (batch files use ==================== ORDER N ==================== delimiters)
 */
require('./setup');
const fs = require('fs');
const path = require('path');
const ShopWorksImportParser = require('../shared_components/js/shopworks-import-parser');

const filePath = process.argv[2];
if (!filePath) {
    console.error('Usage: node tests/run-order.js <path-to-order.txt>');
    process.exit(1);
}

const resolved = path.resolve(filePath);
if (!fs.existsSync(resolved)) {
    console.error(`File not found: ${resolved}`);
    process.exit(1);
}

const text = fs.readFileSync(resolved, 'utf8');

// Detect multi-order batch file
const batchDelimiter = /^={10,}\s*ORDER\s+\d+\s*={10,}$/m;
if (batchDelimiter.test(text)) {
    runBatch(text);
} else {
    runSingle(text);
}

function runSingle(orderText) {
    const parser = new ShopWorksImportParser();
    const r = parser.parse(orderText);
    printResult(r);
    return r;
}

function runBatch(batchText) {
    // Split by ===== ORDER N ===== lines
    const chunks = batchText.split(/^={10,}\s*ORDER\s+\d+\s*={10,}$/m);
    // First chunk is usually empty or preamble text before ORDER 1
    const orders = chunks.filter(c => c.trim().length > 0);

    let unmatchedCount = 0;
    let warningCount = 0;

    orders.forEach((chunk, i) => {
        // Strip any trailing ===== footer lines from the chunk
        const cleaned = chunk.replace(/^={10,}\s*$/gm, '').trim();
        if (!cleaned) return;

        const parser = new ShopWorksImportParser();
        const r = parser.parse(cleaned);
        const orderNum = r.orderId || '(unknown)';

        console.log(`\n--- Order ${i + 1} of ${orders.length}: #${orderNum} ---`);
        printResult(r);

        if (r.unmatchedLines?.length) unmatchedCount++;
        if (r.warnings?.length) warningCount++;
    });

    console.log(`\n========================================`);
    console.log(`${orders.length} orders parsed. ${unmatchedCount} with unmatched lines. ${warningCount} with warnings.`);
    console.log(`========================================\n`);
}

function printResult(r) {
    console.log('\n=== ORDER PARSE RESULTS ===\n');
    console.log(`Order #:    ${r.orderId || '(none)'}`);
    console.log(`Customer:   ${r.customer?.contactName || '(none)'}`);
    console.log(`Company:    ${r.customer?.company || '(none)'}`);
    console.log(`Email:      ${r.customer?.email || '(none)'}`);
    console.log(`Sales Rep:  ${r.salesRep?.name || '(none)'}`);

    console.log(`\nProducts:   ${r.products.length}`);
    r.products.forEach(p => console.log(`  - ${p.partNumber} | ${p.description} | qty ${p.quantity} | $${p.unitPrice}`));

    const svc = r.services || {};
    const active = Object.entries(svc).filter(([, v]) => v && (v === true || (Array.isArray(v) && v.length) || (typeof v === 'object' && !Array.isArray(v))));
    console.log(`\nServices:   ${active.length ? active.map(([k]) => k).join(', ') : '(none)'}`);

    const sum = r.orderSummary || {};
    console.log('\nOrder Summary:');
    console.log(`  Subtotal:     $${(sum.subtotal || 0).toFixed(2)}`);
    console.log(`  Tax:          $${(sum.salesTax || 0).toFixed(2)}  (${(sum.taxRate || 0).toFixed(1)}%)`);
    console.log(`  Shipping:     $${(sum.shipping || 0).toFixed(2)}`);
    console.log(`  Total:        $${(sum.total || 0).toFixed(2)}`);
    console.log(`  Paid To Date: $${(sum.paidToDate || 0).toFixed(2)}`);
    console.log(`  Balance:      $${(sum.balance || 0).toFixed(2)}`);

    if (r.orderNotes) console.log(`\nOrder Notes:\n  ${r.orderNotes.replace(/\n/g, '\n  ')}`);
    if (r.designNumbers?.length) console.log(`\nDesign #s:  ${r.designNumbers.join(', ')}`);

    const ship = r.shippingInfo || {};
    if (ship.method || ship.address) {
        console.log('\nShipping:');
        if (ship.method) console.log(`  Method:  ${ship.method}`);
        if (ship.address) console.log(`  Address: ${ship.address}`);
    }

    if (r.unmatchedLines?.length) {
        console.log(`\n⚠️  UNMATCHED LINES (${r.unmatchedLines.length}):`);
        r.unmatchedLines.forEach(u => console.log(`  [${u.section}] ${u.line}`));
    } else {
        console.log('\n✅ No unmatched lines');
    }

    if (r.warnings?.length) {
        console.log(`\n⚠️  WARNINGS (${r.warnings.length}):`);
        r.warnings.forEach(w => console.log(`  - ${w}`));
    }

    console.log('');
}
