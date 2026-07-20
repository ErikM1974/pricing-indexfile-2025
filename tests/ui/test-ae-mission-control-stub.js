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
                commissionQtd: isT ? 60.75 : 0,
                commissionQuarter: 'Q3 2026',
                leadWinRate: isT ? 38 : 52,
                leadsWon90: isT ? 6 : 11,
            },
            bonus: {
                year: 2026, currentQuarter: 'Q3', previousQuarter: 'Q2',
                previous: {
                    rows: [
                        // Realistic stored shape: base = TOTAL quarter revenue, rate = nominal 1%,
                        // amount = composite math → caption must be SUPPRESSED (base×rate ≠ amount).
                        { type: 'Online Store', quarter: 'Q2', amount: isT ? 131.7 : 2.97, base: isT ? 34639.68 : 25340.84, rate: 0.01, status: 'Calculated', paycheckDate: '', payrollNumber: '' },
                        { type: 'Garment Spiff', quarter: 'Q2', amount: isT ? 53.75 : 128.25, base: 0, rate: 0, status: 'Calculated', paycheckDate: '' },
                        { type: 'Win-Back Bounty', quarter: 'Q2', amount: isT ? 350.15 : 0, base: isT ? 7003 : 0, rate: 0.05, status: 'Calculated', paycheckDate: '' },
                    ],
                    total: isT ? 535.6 : 131.22, allPaid: false,
                },
                current: {
                    rows: [
                        { type: 'Online Store', quarter: 'Q3', amount: 0, base: 0, rate: 0.01, status: 'Calculated' },
                        { type: 'Garment Spiff', quarter: 'Q3', amount: 0, base: 0, rate: 0, status: 'Calculated' },
                        { type: 'Win-Back Bounty', quarter: 'Q3', amount: isT ? 60.75 : 0, base: isT ? 1215 : 0, rate: 0.05, status: 'Calculated' },
                    ],
                    total: isT ? 60.75 : 0,
                },
                paidYtd: isT ? 1241.14 : 1314.38,
            },
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
        if (u.indexOf('/api/crm-proxy/ae-dashboard/growth') !== -1) {
            return json({
                rep: REP, generatedAt: new Date().toISOString(), windowMonths: 24,
                accountsScanned: 214, flaggedCount: 9, potentialTotal: 18420.5, truncated: 0, cacheHit: false,
                items: [
                    { idCustomer: '7881', company: 'Cintas', orderCount24mo: 14, medianGapDays: 42, daysSinceLastOrder: 93, lastOrderDate: daysAgoDay(93), avgOrderValue: 1450.25, lyUpcoming45d: 0, estValue: 1450.25, reasons: [{ type: 'rhythm', text: 'usually orders every ~42 days — quiet for 93' }] },
                    { idCustomer: '5120', company: 'Korsmo Construction', orderCount24mo: 9, medianGapDays: 61, daysSinceLastOrder: 44, lastOrderDate: daysAgoDay(44), avgOrderValue: 890, lyUpcoming45d: 4200, estValue: 4200, reasons: [{ type: 'season', text: 'spent $4,200 in the next 45 days LAST year' }] },
                    { idCustomer: '3310', company: 'Harbor Electric', orderCount24mo: 11, medianGapDays: 38, daysSinceLastOrder: 71, lastOrderDate: daysAgoDay(71), avgOrderValue: 2140, lyUpcoming45d: 980, estValue: 2140, reasons: [{ type: 'rhythm', text: 'usually orders every ~38 days — quiet for 71' }, { type: 'season', text: 'spent $980 in the next 45 days LAST year' }] },
                ],
            });
        }
        if (u.indexOf('/api/crm-proxy/ae-dashboard/data-quality') !== -1) {
            return json({
                rep: REP, generatedAt: new Date().toISOString(), windowDays: 30,
                ordersScanned: 41, customersScanned: 28, cacheHit: false,
                counts: { ordersFlagged: 3, customersFlagged: 2, orderErrors: 6 },
                orders: [
                    { idOrder: 142510, idCustomer: 3310, company: 'Harbor Electric <script>alert(1)</script>', placedDate: daysAgoDay(1), requestedShipDate: '', invoiced: false, shipped: false, errCount: 3, issues: [
                        { field: 'phone', severity: 'err', text: 'no contact phone' },
                        { field: 'terms', severity: 'err', text: 'no payment terms' },
                        { field: 'due-date', severity: 'err', text: 'no requested-ship date' }] },
                    { idOrder: 142488, idCustomer: 5120, company: 'Korsmo Construction', placedDate: daysAgoDay(3), requestedShipDate: daysAgoDay(-10), invoiced: false, shipped: false, errCount: 2, issues: [
                        { field: 'ship-address', severity: 'err', text: 'shipping charged but NO ship-to address' },
                        { field: 'email', severity: 'err', text: 'no contact email' }] },
                    { idOrder: 142371, idCustomer: 7881, company: 'Cintas', placedDate: daysAgoDay(9), requestedShipDate: daysAgoDay(-2), invoiced: true, shipped: true, errCount: 1, issues: [
                        { field: 'tax', severity: 'err', text: 'taxable order but $0 sales tax (customer is not tax-exempt)' }] },
                ],
                customers: [
                    { idCustomer: 3310, company: 'Harbor Electric', errCount: 2, issues: [
                        { field: 'customer-type', severity: 'err', text: 'customer type not set' },
                        { field: 'phone', severity: 'err', text: 'no phone on the customer record' }] },
                    { idCustomer: 5120, company: 'Korsmo Construction', errCount: 0, issues: [
                        { field: 'terms', severity: 'warn', text: 'no default payment terms' },
                        { field: 'address', severity: 'warn', text: 'address incomplete' }] },
                ],
                ordersTruncated: 0, customersTruncated: 0,
            });
        }
        if (u.indexOf('/api/crm-proxy/ae-dashboard/due-dates') !== -1) {
            return json({
                rep: REP, generatedAt: new Date().toISOString(), today: daysAgoDay(0),
                dueSoonDays: 7, lookbackDays: 60, ordersScanned: 41, cacheHit: false,
                counts: { late: 2, atRisk: 2, dueSoonOnTrack: 3 },
                late: [
                    { idOrder: 142280, idCustomer: 3310, company: 'Harbor Electric <b>xss</b>', orderType: 'Embroidery', placedDate: daysAgoDay(14), dueDate: daysAgoDay(5), daysUntilDue: -5, subtotal: 2140.75, invoiced: false, blanks: 'ordered', poCount: 1, vendors: ['SanMar'], flag: 'late', reason: '5d past due · blanks ordered, not received' },
                    { idOrder: 142315, idCustomer: 5120, company: 'Korsmo Construction', orderType: 'DTG', placedDate: daysAgoDay(10), dueDate: daysAgoDay(1), daysUntilDue: -1, subtotal: 890, invoiced: true, blanks: 'received', poCount: 2, vendors: ['SanMar', 'S&S Activewear'], flag: 'late', reason: '1d past due' },
                ],
                atRisk: [
                    { idOrder: 142501, idCustomer: 7881, company: 'Cintas', orderType: 'Screen Print', placedDate: daysAgoDay(3), dueDate: daysAgoDay(0), daysUntilDue: 0, subtotal: 1450.25, invoiced: false, blanks: 'none', poCount: 0, vendors: [], flag: 'risk', reason: 'due TODAY · blanks not purchased (no PO on this WO)' },
                    { idOrder: 142449, idCustomer: 1102, company: 'Puget Powerwash', orderType: 'Embroidery', placedDate: daysAgoDay(6), dueDate: daysAgoDay(-4), daysUntilDue: 4, subtotal: 812, invoiced: false, blanks: 'partial', poCount: 2, vendors: ['SanMar'], flag: 'risk', reason: 'due in 4d · blanks only partially received' },
                ],
                lateTruncated: 0, atRiskTruncated: 0,
            });
        }
        if (u.indexOf('/api/crm-proxy/ae-dashboard/purchasing') !== -1) {
            return json({
                rep: REP, generatedAt: new Date().toISOString(), windowDays: 60,
                submissionCount: 4, truncated: 0, cacheHit: false,
                counts: { sent: 1, ordered: 1, received: 1, shipped: 1 },
                items: [
                    { submissionId: '1', submittedAt: daysAgoDay(1) + ' 09:12:00', orderType: 'Regular Order', bradleyPo: '3702', orders: [
                        { orderNumber: 142501, company: 'Harbor Electric', status: 'sent', poCount: 0, vendors: [], orderedDate: '', receivedDate: '' }] },
                    { submissionId: '2', submittedAt: daysAgoDay(3) + ' 14:40:00', orderType: 'Rush', bradleyPo: '3691', orders: [
                        { orderNumber: 142449, company: 'Korsmo Construction', status: 'ordered', poCount: 1, vendors: ['SanMar'], sanmarPos: [113777], orderedDate: daysAgoDay(2), receivedDate: '' }] },
                    { submissionId: '3', submittedAt: daysAgoDay(7) + ' 10:05:00', orderType: 'Regular Order', bradleyPo: '3668', orders: [
                        { orderNumber: 142398, company: 'CITC of Washington', status: 'received', poCount: 2, vendors: ['SanMar', 'S&S Activewear'], sanmarPos: [113606], orderedDate: daysAgoDay(6), receivedDate: daysAgoDay(2) }] },
                    { submissionId: '4', submittedAt: daysAgoDay(12) + ' 16:22:00', orderType: 'Regular Order', bradleyPo: '', orders: [
                        { orderNumber: 142301, company: 'Boeing Employees Club', status: 'shipped', poCount: 1, vendors: ['SanMar'], orderedDate: daysAgoDay(11), receivedDate: daysAgoDay(6) }] },
                ],
            });
        }
        if (u.indexOf('/api/sanmar-invoices/by-po/') !== -1) {
            var po = u.split('/by-po/')[1].split('?')[0];
            return json({ purchaseOrder: po, invoices: [{
                invoiceNumber: 'INV-88' + po.slice(-3), invoiceDate: daysAgoDay(2), dueDate: daysAgoDay(-28),
                purchaseOrderNo: po, orderDate: daysAgoDay(4), invoiceStatus: 'Unpaid', shipVia: 'UPS GROUND', terms: 'NET 30',
                subtotal: 164.16, salesTax: 0, shippingCharges: 12.1, freightSavings: 0, totalAmount: 176.26,
                shipTo: { name: 'Northwest Custom Apparel', city: 'Milton', state: 'WA' },
                lineItems: [{ styleNo: 'PC54', color: 'Navy', description: 'Port & Company Core Cotton Tee', size: 'L', quantity: 48, unitPrice: 3.42, lineTotal: 164.16 }]
            }], fetchedAt: new Date().toISOString() });
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
