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
                { orderNumber: 142501, company: 'Harbor Electric', status: 'sent', poCount: 0, vendors: [], orderedDate: '', receivedDate: '' }] },
            { submissionId: '2', submittedAt: daysAgoDay(2) + ' 14:40:00', orderType: 'Rush', bradleyPo: '3691', requestedBy: 'taneisha@nwcustomapparel.com', requestedByName: 'Taneisha Clark', orders: [
                { orderNumber: 142449, company: 'Korsmo Construction', status: 'ordered', poCount: 1, vendors: ['SanMar'], orderedDate: daysAgoDay(1), receivedDate: '' }] },
            { submissionId: '3', submittedAt: daysAgoDay(5) + ' 10:05:00', orderType: 'Regular Order', bradleyPo: '3668', requestedBy: 'nika@nwcustomapparel.com', requestedByName: 'Nika Lao', orders: [
                { orderNumber: 142398, company: 'Power Science Engineering <script>alert(1)</script>', status: 'partial', poCount: 2, vendors: ['SanMar', 'Supacolor'], orderedDate: daysAgoDay(4), receivedDate: daysAgoDay(1) }] },
            { submissionId: '4', submittedAt: daysAgoDay(8) + ' 16:22:00', orderType: 'Regular Order', bradleyPo: '', requestedBy: 'taneisha@nwcustomapparel.com', requestedByName: 'Taneisha Clark', orders: [
                { orderNumber: 142312, company: 'Temple Fitness', status: 'received', poCount: 1, vendors: ['SanMar'], orderedDate: daysAgoDay(7), receivedDate: daysAgoDay(3) }] },
            { submissionId: '5', submittedAt: daysAgoDay(12) + ' 08:00:00', orderType: 'Regular Order', bradleyPo: '3640', requestedBy: 'nika@nwcustomapparel.com', requestedByName: 'Nika Lao', orders: [
                { orderNumber: 142290, company: 'UnCruise Adventures', status: 'shipped', poCount: 1, vendors: ['SanMar'], orderedDate: daysAgoDay(11), receivedDate: daysAgoDay(7) }] },
        ],
    };

    var realFetch = window.fetch;
    window.fetch = function (url, options) {
        if (String(url).indexOf('/api/crm-proxy/purchasing-portal') !== -1) {
            return Promise.resolve(new Response(JSON.stringify(payload), {
                status: 200, headers: { 'Content-Type': 'application/json' },
            }));
        }
        return realFetch.apply(window, arguments);
    };

    console.log('[test-stub] Purchasing Portal fetch stub active');
})();
