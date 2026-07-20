/**
 * test-purchasing-portal-stub.js — fetch stub for tests/ui/test-purchasing-portal.html
 * Replaces window.fetch for the portal's one same-origin call so the page
 * renders + filters without SAML/Caspio/JotForm.
 */
(function () {
    'use strict';

    function daysAgoDay(d) { return new Date(Date.now() - d * 86400000).toISOString().slice(0, 10); }

    var payload = {
        rep: null, generatedAt: new Date().toISOString(), windowDays: 60,
        submissionCount: 5, truncated: 0, cacheHit: false,
        counts: { sent: 1, ordered: 1, partial: 1, received: 1, shipped: 1 },
        items: [
            { submissionId: '1', submittedAt: daysAgoDay(0) + ' 09:12:00', orderType: 'Regular Order', bradleyPo: '3702', requestedBy: 'nika@nwcustomapparel.com', requestedByName: 'Nika Lao', orders: [
                { orderNumber: 142501, company: 'Harbor Electric', status: 'sent', poCount: 0, vendors: [], sanmarPos: [], orderedDate: '', receivedDate: '' }] },
            { submissionId: '2', submittedAt: daysAgoDay(2) + ' 14:40:00', orderType: 'Rush', bradleyPo: '3691', requestedBy: 'taneisha@nwcustomapparel.com', requestedByName: 'Taneisha Clark', orders: [
                { orderNumber: 142449, company: 'Korsmo Construction', status: 'ordered', poCount: 1, vendors: ['SanMar'], sanmarPos: [882301], orderedDate: daysAgoDay(1), receivedDate: '' }] },
            { submissionId: '3', submittedAt: daysAgoDay(5) + ' 10:05:00', orderType: 'Regular Order', bradleyPo: '3668', requestedBy: 'nika@nwcustomapparel.com', requestedByName: 'Nika Lao', orders: [
                { orderNumber: 142398, company: 'Power Science Engineering <script>alert(1)</script>', status: 'partial', poCount: 2, vendors: ['SanMar', 'Supacolor'], sanmarPos: [882290], orderedDate: daysAgoDay(4), receivedDate: daysAgoDay(1) }] },
            { submissionId: '4', submittedAt: daysAgoDay(8) + ' 16:22:00', orderType: 'Regular Order', bradleyPo: '', requestedBy: 'taneisha@nwcustomapparel.com', requestedByName: 'Taneisha Clark', orders: [
                { orderNumber: 142312, company: 'Temple Fitness', status: 'received', poCount: 1, vendors: ['SanMar'], sanmarPos: [882270], orderedDate: daysAgoDay(7), receivedDate: daysAgoDay(3) }] },
            { submissionId: '5', submittedAt: daysAgoDay(12) + ' 08:00:00', orderType: 'Regular Order', bradleyPo: '3640', requestedBy: 'nika@nwcustomapparel.com', requestedByName: 'Nika Lao', orders: [
                { orderNumber: 142290, company: 'UnCruise Adventures', status: 'shipped', poCount: 1, vendors: ['SanMar'], sanmarPos: [882240], orderedDate: daysAgoDay(11), receivedDate: daysAgoDay(7) }] },
        ],
    };

    var realFetch = window.fetch;
    window.fetch = function (url, options) {
        if (String(url).indexOf('/api/sanmar-invoices/by-po/') !== -1) {
            var po = String(url).split('/by-po/')[1].split('?')[0];
            return Promise.resolve(new Response(JSON.stringify({
                purchaseOrder: po,
                invoices: [{
                    invoiceNumber: 'INV-77' + po.slice(-3), invoiceDate: daysAgoDay(2), dueDate: daysAgoDay(-28),
                    purchaseOrderNo: po, orderDate: daysAgoDay(4), invoiceStatus: 'Open', shipVia: 'UPS GROUND',
                    terms: 'NET 30', subtotal: 412.5, salesTax: 0, shippingCharges: 18.4, freightSavings: 6.2, totalAmount: 424.7,
                    shipTo: { name: 'Northwest Custom Apparel <script>alert(1)</script>', city: 'Milton', state: 'WA' },
                    lineItems: [
                        { styleNo: 'PC54', color: 'Navy', description: 'Port & Company Core Cotton Tee', size: 'L', quantity: 48, unitPrice: 3.42, lineTotal: 164.16 },
                        { styleNo: 'PC54', color: 'Navy', description: 'Port & Company Core Cotton Tee', size: 'XL', quantity: 36, unitPrice: 3.42, lineTotal: 123.12 },
                        { styleNo: 'CT104670', color: 'Black', description: 'Carhartt Gilliam Jacket', size: 'M', quantity: 5, unitPrice: 25.04, lineTotal: 125.22 }
                    ]
                }],
                fetchedAt: new Date().toISOString()
            }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
        }
        if (String(url).indexOf('/api/crm-proxy/purchasing-portal') !== -1) {
            return Promise.resolve(new Response(JSON.stringify(payload), {
                status: 200, headers: { 'Content-Type': 'application/json' },
            }));
        }
        return realFetch.apply(window, arguments);
    };

    console.log('[test-stub] Purchasing Portal fetch stub active');
})();
