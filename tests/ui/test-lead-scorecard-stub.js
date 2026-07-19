/**
 * test-lead-scorecard-stub.js — fetch stub for tests/ui/test-lead-scorecard.html
 * Replaces window.fetch for /api/crm-proxy/lead-scorecard so the scorecard
 * controller + CSS render against fixture data with no SAML/Caspio. Honors the
 * since/until query so preset switching visibly changes the result.
 */
(function () {
    'use strict';

    // fixture: closed leads with a conversion date, attributed (post-inquiry) $,
    // and lifetime $. One re-inquiry style row where attributed << lifetime.
    var LEADS = [
        { submissionId: 'JFL0630-5551', company: 'Bluestone Property Group', contact: 'Dustin Ramsdell', rep: 'Taneisha Clark', custId: '13694', attributed: 574, lifetime: 574, orders: 1, inquiry: '2026-07-01', conversionDate: '2026-07-08' },
        { submissionId: 'JFL0604-8182', company: 'Edwards Mother Earth Foundation', contact: 'Bruce Reed', rep: 'Taneisha Clark', custId: '13663', attributed: 798, lifetime: 798, orders: 2, inquiry: '2026-06-04', conversionDate: '2026-06-20' },
        { submissionId: 'JFL1225-1000', company: 'Braun Northwest Inc.', contact: 'Jennifer Kent', rep: 'Taneisha Clark', custId: '13542', attributed: 51537, lifetime: 51537, orders: 16, inquiry: '2025-12-19', conversionDate: '2025-12-19' },
        { submissionId: 'JFL1101-2000', company: 'Shift Innovations Car Co', contact: 'Sam', rep: 'Taneisha Clark', custId: '13516', attributed: 11657, lifetime: 11657, orders: 22, inquiry: '2025-11-25', conversionDate: '2025-11-25' },
        { submissionId: 'JFL0206-3000', company: 'Port of Seattle', contact: 'AP', rep: 'Nika Lao', custId: '12899', attributed: 78317, lifetime: 78317, orders: 40, inquiry: '2024-02-06', conversionDate: '2024-02-08' },
        { submissionId: 'JFL1010-4000', company: 'Amazon (re-inquiry)', contact: 'Martin', rep: 'Nika Lao', custId: '10809', attributed: 1200, lifetime: 46000, orders: 30, inquiry: '2025-10-16', conversionDate: '2025-10-20' },
    ];

    function inRange(l, since, until) {
        var d = l.conversionDate;
        if (since && d < since) return false;
        if (until && d > until) return false;
        return true;
    }

    window.fetch = function (url) {
        var u = String(url);
        if (u.indexOf('/api/crm-proxy/lead-scorecard') === -1) {
            return Promise.resolve({ ok: false, status: 404, json: function () { return Promise.resolve({ error: 'stub: ' + u }); } });
        }
        var q = new URLSearchParams(u.split('?')[1] || '');
        var since = q.get('since') || '', until = q.get('until') || '';
        var leads = LEADS.filter(function (l) { return inRange(l, since, until); });
        var perRep = {};
        leads.forEach(function (l) {
            if (!perRep[l.rep]) perRep[l.rep] = { rep: l.rep, leadsClosed: 0, attributedSales: 0, lifetimeSales: 0, withOrders: 0 };
            var r = perRep[l.rep];
            r.leadsClosed += 1; r.attributedSales += l.attributed; r.lifetimeSales += l.lifetime; r.withOrders += 1;
        });
        var reps = Object.keys(perRep).map(function (k) { return perRep[k]; }).sort(function (a, b) { return b.attributedSales - a.attributedSales; });
        var body = {
            success: true, since: since || null, until: until || null,
            totals: { repsWithCloses: reps.length, leadsClosed: leads.length, attributedSales: leads.reduce(function (s, l) { return s + l.attributed; }, 0) },
            reps: reps, leads: leads.slice().sort(function (a, b) { return b.attributed - a.attributed; }),
        };
        return Promise.resolve({ ok: true, status: 200, json: function () { return Promise.resolve(body); } });
    };
})();
