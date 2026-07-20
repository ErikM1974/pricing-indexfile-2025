/**
 * test-sanmar-payables-stub.js — fetch stub for tests/ui/test-sanmar-payables.html
 * Replaces window.fetch so the SanMar Payables page renders BOTH tabs without a
 * SAML session or live SanMar. Returns invoices filtered to the requested
 * [start,end] window (so the marketing tab's quarterly pulls partition cleanly),
 * with a realistic mix: Net30 invoices + a credit + a $0 + MRKFUND marketing
 * charges spread across the year (+ an XSS probe in a ship-to name).
 */
(function () {
    'use strict';

    function iso(d) { return d.toISOString().slice(0, 10); }
    function daysAgo(n) { return iso(new Date(Date.now() - n * 86400000)); }
    function addDays(isoStr, n) { var d = new Date(isoStr + 'T12:00:00'); d.setDate(d.getDate() + n); return iso(d); }
    var YEAR = new Date().getFullYear();
    var THIS_MONTH = new Date().getMonth();

    function mk(invNo, dateStr, po, amt, terms, ship) {
        return {
            invoiceNumber: invNo, invoiceDate: dateStr,
            dueDate: terms === 'MRKFUND' ? dateStr : addDays(dateStr, 30),
            purchaseOrderNo: po, orderDate: addDays(dateStr, -3), invoiceStatus: 'Unpaid',
            terms: terms, subtotal: amt, salesTax: 0, shippingCharges: 0, freightSavings: 0, totalAmount: amt,
            shipTo: { name: ship || 'NORTHWEST EMBROIDERY INC', city: 'Milton', state: 'WA', zip: '98354' },
            lineItems: [{ styleNo: 'PC54', color: 'Navy', description: 'Core Cotton Tee', size: 'L', quantity: 12, unitPrice: (Math.abs(amt) / 12) || 0, lineTotal: amt }]
        };
    }

    // Standard Net30 payables (recent, so the Invoices tab's last-30-days default shows them).
    var fixture = [
        mk('161990001', daysAgo(1), '113600', 245.60, 'Net30'),
        mk('161990002', daysAgo(3), '113601 BW', 1222.47, 'Net30', 'Korsmo Construction <script>alert(1)</script>'),
        mk('161990003', daysAgo(5), '113602', 26.06, 'Net30'),
        mk('5590001', daysAgo(6), '113603', -40.99, 'Net30'),          // credit (CR-)
        mk('161990004', daysAgo(7), 'LEGEND0611', 0, 'Net30'),          // $0 (unchecked by default)
        mk('161990010', daysAgo(4), '113610', 164.87, 'MRKFUND')        // recent marketing charge
    ];
    // Marketing-fund charges across the year (populate the month bars + fund math).
    var MKT = [520, 1180, 875, 640, 1490, 980, 730, 1210, 560, 890, 400, 300];
    for (var m = 0; m <= THIS_MONTH; m++) {
        var dateStr = iso(new Date(YEAR, m, 15));
        fixture.push(mk('1574' + (10000 + m * 137), dateStr, '11' + (1800 + m), MKT[m] || 500, 'MRKFUND'));
    }
    fixture.push(mk('5591002', iso(new Date(YEAR, Math.max(0, THIS_MONTH - 1), 20)), '112900', -200.88, 'MRKFUND')); // marketing credit

    function byDate(start, end) {
        return fixture.filter(function (i) { return i.invoiceDate >= start && i.invoiceDate <= end; })
            .sort(function (a, b) { return b.invoiceDate.localeCompare(a.invoiceDate); });
    }

    var realFetch = window.fetch;
    window.fetch = function (url) {
        var u = String(url);
        if (u.indexOf('/api/staff/sanmar-invoices/by-date') !== -1) {
            var q = u.split('?')[1] || '';
            var p = new URLSearchParams(q);
            var start = p.get('start'), end = p.get('end');
            return Promise.resolve(new Response(JSON.stringify({ dateRange: { start: start, end: end }, invoices: byDate(start, end) }),
                { status: 200, headers: { 'Content-Type': 'application/json' } }));
        }
        if (u.indexOf('/api/sanmar-invoices/by-po/') !== -1) {
            var po = u.split('/by-po/')[1].split('?')[0];
            return Promise.resolve(new Response(JSON.stringify({ purchaseOrder: po, invoices: [mk('16199' + po.slice(-4), daysAgo(2), po, 245.60, 'Net30')] }),
                { status: 200, headers: { 'Content-Type': 'application/json' } }));
        }
        return realFetch.apply(window, arguments);
    };

    console.log('[test-stub] SanMar Payables fetch stub active');
})();
