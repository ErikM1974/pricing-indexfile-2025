/**
 * test-sanmar-payables-stub.js — fetch stub + fixtures for the SanMar Payables harness.
 * Renders both tabs without SAML / live SanMar:
 *   • /api/staff/sanmar-invoices/unpaid  → open-payables fixture (Net30 + credits +
 *     an excluded MRKFUND + older-than-90d items to exercise the "older" hint).
 *   • /api/staff/sanmar-invoices/by-date → MRKFUND spread across the year (Marketing tab).
 *   • /api/sanmar-invoices/by-po/:po     → viewer payload.
 * Also pre-loads a ShopWorks payables CSV via window.__SMP_TEST_SW__ (the controller's
 * test seam) so Imported/Paid status + the status filter render without a file dialog.
 */
(function () {
    'use strict';

    function iso(d) { return d.toISOString().slice(0, 10); }
    function daysAgo(n) { return iso(new Date(Date.now() - n * 86400000)); }
    function addDays(s, n) { var d = new Date(s + 'T12:00:00'); d.setDate(d.getDate() + n); return iso(d); }
    var YEAR = new Date().getFullYear(), THIS_MONTH = new Date().getMonth();

    function mk(inv, dateStr, po, amt, terms, ship) {
        return {
            invoiceNumber: inv, invoiceDate: dateStr,
            dueDate: terms === 'MRKFUND' ? dateStr : addDays(dateStr, 30),
            purchaseOrderNo: po, orderDate: addDays(dateStr, -3), invoiceStatus: 'Unpaid',
            terms: terms, subtotal: amt, salesTax: 0, shippingCharges: 0, freightSavings: 0, totalAmount: amt,
            shipTo: { name: ship || 'NORTHWEST EMBROIDERY INC', city: 'Milton', state: 'WA', zip: '98354' },
            lineItems: [{ styleNo: 'PC54', color: 'Navy', description: 'Core Cotton Tee', size: 'L', quantity: 12, unitPrice: (Math.abs(amt) / 12) || 0, lineTotal: amt }]
        };
    }

    // Open payables (GetUnpaidInvoices) fixture.
    var unpaid = [
        mk('162398367', daysAgo(2), '113686', 122.05, 'Net30'),          // in SW, unpaid → IMPORTED·UNPAID
        mk('162395846', daysAgo(2), '113693', 170.40, 'Net30'),          // in SW, date_Paid → PAID
        mk('162394919', daysAgo(3), '113683', 40.96, 'Net30'),           // not in SW → NOT IMPORTED
        mk('162391874', daysAgo(3), '113682', 1991.77, 'Net30', 'Korsmo Construction <script>alert(1)</script>'),
        mk('5670868', daysAgo(2), '113612', -81.51, 'Net30'),            // credit, not in SW
        mk('5615563', daysAgo(6), '113372', -36.50, 'Net30'),            // credit, in SW zero-padded (CR-005615563) → must match
        mk('162009107', daysAgo(5), '113552 BW', 249.60, 'Net30'),       // not in SW
        mk('161990010', daysAgo(4), '113610', 164.87, 'MRKFUND'),        // marketing → EXCLUDED from tab
        mk('157400001', daysAgo(200), '111853', 875.07, 'Net30'),        // older than 90d → olderCount
        mk('157400002', daysAgo(210), '111854', 100.00, 'Net30')         // older than 90d
    ];

    // Marketing charges across the year (Marketing tab).
    var MKT = [520, 1180, 875, 640, 1490, 980, 730, 1210, 560, 890, 400, 300];
    var byDateFixture = [];
    for (var m = 0; m <= THIS_MONTH; m++) {
        byDateFixture.push(mk('1574' + (10000 + m * 137), iso(new Date(YEAR, m, 15)), '11' + (1800 + m), MKT[m] || 500, 'MRKFUND'));
    }

    // ShopWorks payables export fixture — matches two of the unpaid rows. Includes a
    // quoted comma amount + a paid + an unpaid row to exercise the parser + status.
    window.__SMP_TEST_SW__ =
        'id_PO,VendorName,cur_Payable,date_Paid,ID_Payable,id_Vendor,InvoiceNumber,cnCur_PayableOutstanding\r\n' +
        '113686,SANMAR,122.05 ,,148300,1002,INV-162398367,122.05\r\n' +
        '113693,SANMAR,"1,170.40 ",07/18/2026,148301,1002,INV-162395846,\r\n' +
        '113372,SANMAR,-36.50 ,,148302,1002,CR-005615563,\r\n';

    function byDate(start, end) {
        return byDateFixture.filter(function (i) { return i.invoiceDate >= start && i.invoiceDate <= end; })
            .sort(function (a, b) { return b.invoiceDate.localeCompare(a.invoiceDate); });
    }

    var realFetch = window.fetch;
    window.fetch = function (url) {
        var u = String(url);
        if (u.indexOf('/api/staff/sanmar-invoices/unpaid') !== -1) {
            return Promise.resolve(new Response(JSON.stringify({ invoices: unpaid }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
        }
        if (u.indexOf('/api/staff/shopworks-payables') !== -1) {
            // Empty auto-feed in the harness → the __SMP_TEST_SW__ seam drives the cross-ref.
            return Promise.resolve(new Response(JSON.stringify({ success: true, count: 0, rows: [] }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
        }
        if (u.indexOf('/api/staff/sanmar-invoices/by-date') !== -1) {
            var p = new URLSearchParams((u.split('?')[1] || ''));
            return Promise.resolve(new Response(JSON.stringify({ dateRange: {}, invoices: byDate(p.get('start'), p.get('end')) }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
        }
        if (u.indexOf('/api/sanmar-invoices/by-po/') !== -1) {
            var po = u.split('/by-po/')[1].split('?')[0];
            return Promise.resolve(new Response(JSON.stringify({ purchaseOrder: po, invoices: [mk('16199' + po.slice(-4), daysAgo(2), po, 245.60, 'Net30')] }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
        }
        return realFetch.apply(window, arguments);
    };

    console.log('[test-stub] SanMar Payables fetch stub active');
})();
