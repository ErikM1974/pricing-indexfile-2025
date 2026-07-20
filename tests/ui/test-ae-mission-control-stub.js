/**
 * test-ae-mission-control-stub.js — fetch stub for tests/ui/test-ae-mission-control.html
 *
 * Replaces window.fetch for everything the Mission Control controller calls —
 * crm-session, the ae-dashboard summary aggregate, marketing-shipments (items +
 * POST), lead-outreach (preview + send), sanmar inbound-today, and the art
 * notification poll — so the SAML-gated page renders and clicks through with
 * zero backend. Session is stubbed as ADMIN so the view-as pill shows.
 */
(function () {
    'use strict';

    function hoursAgo(h) { return new Date(Date.now() - h * 3600000).toISOString(); }
    function daysAgoDay(d) { return new Date(Date.now() - d * 86400000).toISOString().slice(0, 10); }

    var REP = { email: 'taneisha@nwcustomapparel.com', fullName: 'Taneisha Clark', firstName: 'Taneisha' };
    var NIKA = { email: 'nika@nwcustomapparel.com', fullName: 'Nika Lao', firstName: 'Nika' };

    function summaryFor(rep) {
        var isT = rep.email === REP.email;
        return {
            rep: rep,
            generatedAt: new Date().toISOString(),
            cacheHit: false,
            kpis: {
                ytdSales: isT ? 514178.8 : 796082.9,
                mtdSales: isT ? 32572.96 : 66595.04,
                salesAsOf: daysAgoDay(2),
                openQuoteCount: isT ? 4 : 2,
                openQuoteValue: isT ? 6890.5 : 3120,
                commissionQtd: isT ? 1284.22 : 2210.4,
                commissionQuarter: 'Q3 2026',
                leadWinRate: isT ? 38 : 52,
                leadsWon90: isT ? 6 : 11,
            },
            commission: { quarter: 'Q3', year: 2026, totalCommission: isT ? 1284.22 : 2210.4, baselineMet: true, baselineProgress: 112.4 },
            actionQueue: {
                overdueLeads: [{
                    submissionId: 'JFL0714-1001', formId: 'jotform-lead', company: 'Rainier Roofing <script>alert(1)</script>',
                    contactName: 'Dana Fox', email: 'dana@rainierroof.com', status: 'Contacted',
                    dueDate: daysAgoDay(3), daysOverdue: 3, leadValue: 900, submittedAt: hoursAgo(120),
                }],
                dueTodayLeads: [{
                    submissionId: 'JFL0719-1002', formId: 'quote-request', company: 'Puget Powerwash',
                    contactName: 'Sam Lee', email: 'sam@pugetpw.com', status: 'Quoted',
                    dueDate: daysAgoDay(0), leadValue: 0, submittedAt: hoursAgo(80),
                }],
                newUntouchedLeads: [{
                    submissionId: 'JFL0717-1003', formId: 'jotform-lead', company: 'CITC of Washington',
                    contactName: 'Alex Popescu', email: 'alex@citcwa.com', status: 'New',
                    dueDate: '', leadValue: 450, submittedAt: hoursAgo(50),
                }, {
                    submissionId: 'MNL0716-1004', formId: 'manual-lead', company: 'Tacoma Tug & Barge',
                    contactName: 'Rob Ortiz', email: '', status: 'New',
                    dueDate: '', leadValue: 0, submittedAt: hoursAgo(70),
                }],
                staleQuotes: [{
                    quoteId: 'EMB0710-3', customerName: 'Kim Vo', companyName: 'Harbor Electric',
                    customerEmail: 'kim@harborelec.com', totalAmount: 2140.75, status: 'Open',
                    createdAt: hoursAgo(9 * 24), updatedAt: hoursAgo(7 * 24),
                }],
                artAwaitingApproval: [{
                    idDesign: 53041, companyName: 'Wagon Fest', status: 'Awaiting Approval',
                    dueDate: daysAgoDay(-3), dateCreated: hoursAgo(48),
                }],
                kitsPending: [{
                    shipmentId: 'KIT0718-4410', submissionId: 'JFL0717-1003', recipientName: 'Alex Popescu',
                    company: 'CITC of Washington', status: 'Requested', createdAt: hoursAgo(26),
                }],
            },
            counts: {
                leads: { overdue: 1, dueToday: 1, newUntouched: 2, activeLeads: 14 },
                quotes: { openQuotes: isT ? 4 : 2, staleQuotes: 1 },
                art: { awaitingApproval: 1, openArt: 5 },
                orders: { orders30: isT ? 69 : 139 },
                kits: { kitsPending: 1 },
            },
            panels: {
                leads: [
                    { submissionId: 'JFL0717-1003', company: 'CITC of Washington', contactName: 'Alex Popescu', status: 'New', leadValue: 450, submittedAt: hoursAgo(50) },
                    { submissionId: 'JFL0714-1001', company: 'Rainier Roofing', contactName: 'Dana Fox', status: 'Contacted', leadValue: 900, submittedAt: hoursAgo(120) },
                ],
                quotes: [
                    { quoteId: 'EMB0710-3', companyName: 'Harbor Electric', customerName: 'Kim Vo', totalAmount: 2140.75, status: 'Open', createdAt: hoursAgo(9 * 24) },
                    { quoteId: 'DTG0716-1', companyName: 'Puget Powerwash', customerName: 'Sam Lee', totalAmount: 812, status: 'Open', createdAt: hoursAgo(3 * 24) },
                ],
                art: [
                    { idDesign: 53041, companyName: 'Wagon Fest', status: 'Awaiting Approval', dueDate: daysAgoDay(-3), dateCreated: hoursAgo(48) },
                    { idDesign: 53012, companyName: 'Harbor Electric', status: 'Submitted', dueDate: '', dateCreated: hoursAgo(90) },
                ],
                orders: [
                    { idOrder: 141220, companyName: 'Boeing Employees Club', subtotal: 3480.5, invoicedDate: daysAgoDay(1), shipped: true, orderType: 'Embroidery' },
                    { idOrder: 141201, companyName: 'CITC of Washington', subtotal: 940, invoicedDate: daysAgoDay(4), shipped: false, orderType: 'DTG' },
                ],
            },
            orders30Total: isT ? 51840.22 : 90210.11,
            errors: undefined,
        };
    }

    var kitItems = [
        { Item_Code: 'CATALOG', Label: 'SanMar Catalog 2026', Sort: 1, Active: true },
        { Item_Code: 'STICKERS', Label: 'NWCA Sticker Pack', Sort: 2, Active: true },
        { Item_Code: 'SAMPLE-TEE', Label: 'Sample Tee (printed)', Sort: 3, Active: true },
    ];

    var inbound = {
        date: daysAgoDay(0),
        orders: [
            { sanmarPO: '882211', workOrder: '55123', company: 'Harbor Electric', salesRep: 'Taneisha Clark', boxes: 3, piecesShipped: 96, received: false },
            { sanmarPO: '882244', workOrder: '55140', company: 'Sound Transit Crew', salesRep: 'Nika Lao', boxes: 5, piecesShipped: 180, received: false },
            { sanmarPO: '882250', workOrder: '', company: '', salesRep: '', boxes: 1, piecesShipped: 24, received: true },
        ],
    };

    function json(body, status) {
        return Promise.resolve(new Response(JSON.stringify(body), {
            status: status || 200, headers: { 'Content-Type': 'application/json' },
        }));
    }

    var realFetch = window.fetch;
    window.fetch = function (url, options) {
        var u = String(url);
        var method = (options && options.method) || 'GET';

        if (u.indexOf('/api/crm-session/me') !== -1) {
            return json({ authenticated: true, name: 'Erik Mickelson', firstName: 'Erik', email: 'erik@nwcustomapparel.com', permissions: ['admin', 'accountant', 'house', 'policies-admin', 'taneisha', 'nika'] });
        }
        if (u.indexOf('/api/crm-proxy/ae-dashboard/summary') !== -1) {
            var m = u.match(/viewAs=([^&]+)/);
            var email = m ? decodeURIComponent(m[1]) : REP.email;
            return json(summaryFor(email === NIKA.email ? NIKA : REP));
        }
        if (u.indexOf('/api/crm-proxy/marketing-shipments/items') !== -1) {
            return json({ items: kitItems });
        }
        if (u.indexOf('/api/crm-proxy/marketing-shipments') !== -1 && method === 'POST') {
            var body = JSON.parse(options.body || '{}');
            if (!body.items || !body.items.length) return json({ error: 'Select at least one item to send' }, 400);
            return json({ shipmentId: 'KIT0719-9999' }, 201);
        }
        if (u.indexOf('/api/crm-proxy/lead-outreach') !== -1) {
            var ob = JSON.parse(options.body || '{}');
            if (ob.preview) {
                return json({
                    subject: 'Quick intro from Northwest Custom Apparel',
                    bodyHtml: '<p>Hi ' + (ob.lead.contactName || 'there') + ',</p><p>(stubbed template body — real HTML comes from lead-outreach-templates.js)</p>',
                    label: 'Introduction',
                });
            }
            return json({ sent: true, to: ob.lead.email, label: 'Introduction' });
        }
        if (u.indexOf('/api/sanmar-orders/inbound-today') !== -1) {
            return json(inbound);
        }
        if (u.indexOf('/api/art-notifications') !== -1) {
            return json({ notifications: [], serverTime: Date.now() });
        }
        return realFetch.apply(window, arguments);
    };

    console.log('[test-stub] AE Mission Control fetch stub active');
})();
