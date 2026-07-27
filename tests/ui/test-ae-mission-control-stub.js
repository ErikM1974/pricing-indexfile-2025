/**
 * test-ae-mission-control-stub.js — fetch stub for tests/ui/test-ae-mission-control.html
 *
 * Replaces window.fetch for everything the Mission Control controller calls —
 * crm-session, the ae-dashboard summary aggregate, marketing-shipments (items +
 * POST), lead-outreach (preview + send), sanmar inbound-today, and the art
 * notification poll — so the SAML-gated page renders and clicks through with
 * zero backend. Session is stubbed as ADMIN so the view-as pill shows.
 *
 * ⚠️ THIS IS A *RENDER* HARNESS, NEVER A *CONTRACT* HARNESS.
 * It replaces window.fetch wholesale, so it answers every URL the controller asks for
 * whether or not that route exists on the server. It cannot detect an unregistered
 * endpoint, a changed response shape, or a broken auth gate — and it didn't: the
 * /api/crm-proxy/ae-dashboard/due-dates forwarder was dropped by a revert on 2026-07-19
 * and 404'd in production for a week while this harness stayed green (it answers that URL
 * itself, below). Route registration and payload shape are verified by LIVE probes only;
 * see the Verification section of the redesign plan. Use this file for layout, empty
 * states, error states, XSS escaping and click-through — nothing that touches the network
 * contract.
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
            // Daily trend + streak + personal records (added 2026-07-26; derived server-side
            // from rows the sales read already fetched, so it costs no extra Caspio calls).
            // archiveStartsAt is deliberately present: NW_Daily_Sales_By_Rep has no 2025 rows,
            // so a "record" can only mean "best since the archive began" and the UI must say so.
            trend: trendFor(isT),
            // ⚠️ LIVE REALITY (verified 2026-07-26): Quote_Sessions holds 8 rows for all of
            // 2026 and only ONE carries a SalesRepEmail, so in production BOTH reps get
            // attributed:0 / ratePct:null and the panel is empty. The stub ships REAL numbers
            // here on purpose — the empty case is exercised by ?degrade=quotes below — so the
            // populated layout can be designed, but nothing should be built that *requires*
            // this to be non-zero. See the spawned "Quote_Sessions rep attribution" task.
            quoteConversion: {
                windowDays: 90,
                attributed: isT ? 24 : 17,
                quotedValue: isT ? 84210.5 : 61300,
                pushed: isT ? 9 : 7,
                pushedValue: isT ? 31120.25 : 24800,
                ratePct: isT ? 38 : 41,
                staleCount: isT ? 3 : 1,
                staleValue: isT ? 9410 : 2200,
            },
            errors: undefined,
        };
    }

    // Synthetic 90-day series with a believable shape: weekends empty, a live streak, and one
    // standout day/week/month so the records UI has something to render.
    function trendFor(isT) {
        var series = [];
        var end = new Date(); end.setHours(12, 0, 0, 0);
        end.setDate(end.getDate() - 2);                       // mirror the 2-day archive lag
        for (var i = 89; i >= 0; i--) {
            var d = new Date(end.getTime() - i * 86400000);
            var dow = d.getDay();
            var weekend = (dow === 0 || dow === 6);
            var rev = weekend ? 0 : Math.round((isT ? 2600 : 4200) * (0.45 + ((i * 37) % 100) / 100) * 100) / 100;
            series.push({ d: d.toISOString().slice(0, 10), r: rev, o: weekend ? 0 : 1 + (i % 4) });
        }
        var peak = series[series.length - 12];
        if (peak) { peak.r = isT ? 30443.36 : 23002; peak.o = 9; }
        return {
            asOf: series[series.length - 1].d,
            archiveStartsAt: '2026-01-05',
            dailySeries: series,
            streak: { currentDays: isT ? 2 : 7, bestDays: isT ? 19 : 40 },
            records: {
                bestDay: { d: peak ? peak.d : series[0].d, r: isT ? 30443.36 : 23002 },
                bestWeek: { weekStart: '2026-02-02', r: isT ? 44722.52 : 50145.41 },
                bestMonth: { m: isT ? '2026-02' : '2026-01', r: isT ? 117778.43 : 169951.78 },
            },
        };
    }

    // ?degrade=<key>[,<key>] — force a source to come back null the way the real aggregate
    // does when one of its seven Caspio reads fails, so the DEGRADED path gets designed too.
    // e.g. ?degrade=trend,quotes  → no sparkline, no streak, no conversion, visible errors.
    var DEGRADE = (new URLSearchParams(location.search).get('degrade') || '')
        .split(',').map(function (s) { return s.trim(); }).filter(Boolean);
    // ?as=rep | ?as=nika — stub a plain rep session instead of Erik-as-admin (see the
    // /api/crm-session/me handler for why this exists).
    var AS_REP = (function () {
        var v = (new URLSearchParams(location.search).get('as') || '').toLowerCase().trim();
        return (v === 'rep' || v === 'taneisha') ? 'taneisha' : (v === 'nika' ? 'nika' : '');
    }());
    function applyDegrade(payload) {
        if (!DEGRADE.length) return payload;
        var errors = {};
        DEGRADE.forEach(function (k) {
            if (k === 'trend' || k === 'sales') { payload.trend = null; errors.sales = 'stubbed failure'; }
            if (k === 'quotes') {
                payload.quoteConversion = null;
                payload.counts.quotes = null;
                payload.panels.quotes = null;
                errors.quotes = 'stubbed failure';
            }
            // Simulates the CURRENTLY-DEPLOYED proxy: the fields simply don't exist yet, with
            // NO entry in `errors`. The page must hide those pieces rather than report a
            // failure — the app and the proxy deploy independently, so this is the real state
            // of production between the two pushes.
            if (k === 'old-proxy') {
                delete payload.trend;
                delete payload.quoteConversion;
            }
            if (k === 'empty-quotes') {                        // the REAL production shape today
                payload.quoteConversion = {
                    windowDays: 90, attributed: 0, quotedValue: 0, pushed: 0,
                    pushedValue: 0, ratePct: null, staleCount: 0, staleValue: 0,
                };
                payload.counts.quotes = { openQuotes: 0, staleQuotes: 0 };
                payload.panels.quotes = [];
            }
        });
        if (Object.keys(errors).length) payload.errors = errors;
        return payload;
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

    var EMB_TARGETS = {
        "quarter": "Q3",
        "year": 2026,
        "asOf": "2026-07-01",
        "minAccountRevenue": 1000,
        "dormancyMonths": 12,
        "configSource": "caspio",
        "reps": {
            "Nika Lao": {
                "winBack": [
                    {
                        "idCustomer": "753",
                        "company": "International Belt & Rubber",
                        "tier": "GOLD '26 - NIKA",
                        "lifetimeEmbroidery": 69502.66,
                        "embroideryOrders": 9,
                        "avgOrderValue": 7722.52,
                        "monthsDormant": 19,
                        "medianReorderDays": 108,
                        "q3SharePct": 33,
                        "bounty": 100,
                        "score": 10296.69
                    },
                    {
                        "idCustomer": "3001",
                        "company": "Green Effects, Inc.",
                        "tier": "SILVER '26 -NIKA",
                        "lifetimeEmbroidery": 14218.41,
                        "embroideryOrders": 6,
                        "avgOrderValue": 2369.74,
                        "monthsDormant": 14,
                        "medianReorderDays": 107,
                        "q3SharePct": 33,
                        "bounty": 100,
                        "score": 3159.65
                    },
                    {
                        "idCustomer": "12429",
                        "company": "Evergreen Goodwill Of NW Washington",
                        "tier": "BRONZE '26-NIKA",
                        "lifetimeEmbroidery": 6710,
                        "embroideryOrders": 2,
                        "avgOrderValue": 3355,
                        "monthsDormant": 23,
                        "medianReorderDays": 842,
                        "q3SharePct": 50,
                        "bounty": 100,
                        "score": 1677.5
                    },
                    {
                        "idCustomer": "12230",
                        "company": "Gafco Roofing and Construction",
                        "tier": "House-2026",
                        "lifetimeEmbroidery": 4826.6,
                        "embroideryOrders": 6,
                        "avgOrderValue": 804.43,
                        "monthsDormant": 16,
                        "medianReorderDays": 78,
                        "q3SharePct": 17,
                        "bounty": 100,
                        "score": 938.51
                    },
                    {
                        "idCustomer": "12586",
                        "company": "Valley Property Services",
                        "tier": "BRONZE '26-NIKA",
                        "lifetimeEmbroidery": 4770.4,
                        "embroideryOrders": 4,
                        "avgOrderValue": 1192.6,
                        "monthsDormant": 12,
                        "medianReorderDays": 301,
                        "q3SharePct": 0,
                        "bounty": 100,
                        "score": 795.07
                    },
                    {
                        "idCustomer": "12948",
                        "company": "NuuCo Electric",
                        "tier": "SILVER '26 -NIKA",
                        "lifetimeEmbroidery": 4602.5,
                        "embroideryOrders": 1,
                        "avgOrderValue": 4602.5,
                        "monthsDormant": 24,
                        "medianReorderDays": 0,
                        "q3SharePct": 0,
                        "bounty": 100,
                        "score": 767.08
                    },
                    {
                        "idCustomer": "9081",
                        "company": "High Country Homes",
                        "tier": "House-2026",
                        "lifetimeEmbroidery": 4344.04,
                        "embroideryOrders": 6,
                        "avgOrderValue": 724.01,
                        "monthsDormant": 14,
                        "medianReorderDays": 91,
                        "q3SharePct": 0,
                        "bounty": 100,
                        "score": 724.01
                    },
                    {
                        "idCustomer": "13043",
                        "company": "RS Lending",
                        "tier": "House-2026",
                        "lifetimeEmbroidery": 2583,
                        "embroideryOrders": 3,
                        "avgOrderValue": 861,
                        "monthsDormant": 17,
                        "medianReorderDays": 87,
                        "q3SharePct": 67,
                        "bounty": 100,
                        "score": 717.5
                    },
                    {
                        "idCustomer": "13109",
                        "company": "Pacific Fish Company",
                        "tier": "BRONZE '26-NIKA",
                        "lifetimeEmbroidery": 4080.4,
                        "embroideryOrders": 1,
                        "avgOrderValue": 4080.4,
                        "monthsDormant": 16,
                        "medianReorderDays": 0,
                        "q3SharePct": 0,
                        "bounty": 100,
                        "score": 680.07
                    },
                    {
                        "idCustomer": "12048",
                        "company": "ProEnd Painting",
                        "tier": "House-2026",
                        "lifetimeEmbroidery": 6674.2,
                        "embroideryOrders": 5,
                        "avgOrderValue": 1334.84,
                        "monthsDormant": 25,
                        "medianReorderDays": 270,
                        "q3SharePct": 0,
                        "bounty": 100,
                        "score": 667.42
                    },
                    {
                        "idCustomer": "12993",
                        "company": "Terenn Houk",
                        "tier": "House-2026",
                        "lifetimeEmbroidery": 2998.9,
                        "embroideryOrders": 3,
                        "avgOrderValue": 999.63,
                        "monthsDormant": 15,
                        "medianReorderDays": 112,
                        "q3SharePct": 33,
                        "bounty": 100,
                        "score": 666.42
                    },
                    {
                        "idCustomer": "12237",
                        "company": "Chavira & Associates LLC",
                        "tier": "House-2026",
                        "lifetimeEmbroidery": 9461.42,
                        "embroideryOrders": 17,
                        "avgOrderValue": 556.55,
                        "monthsDormant": 16,
                        "medianReorderDays": 36,
                        "q3SharePct": 18,
                        "bounty": 100,
                        "score": 654.77
                    }
                ],
                "firstProgram": [
                    {
                        "idCustomer": "8409",
                        "company": "Ketchikan Fire Dept",
                        "tier": "House-2026",
                        "otherSpend": 9165,
                        "otherOrders": 4,
                        "monthsSinceOrder": 1,
                        "bounty": 150,
                        "score": 9165
                    },
                    {
                        "idCustomer": "13515",
                        "company": "MICHELS",
                        "tier": "SILVER '26 -NIKA",
                        "otherSpend": 5641,
                        "otherOrders": 1,
                        "monthsSinceOrder": 6,
                        "bounty": 150,
                        "score": 5641
                    },
                    {
                        "idCustomer": "13295",
                        "company": "Holy Family School",
                        "tier": "BRONZE '26-NIKA",
                        "otherSpend": 4924.5,
                        "otherOrders": 2,
                        "monthsSinceOrder": 2,
                        "bounty": 150,
                        "score": 4924.5
                    },
                    {
                        "idCustomer": "12734",
                        "company": "Bumblebee Services Inc.",
                        "tier": "BRONZE '26-NIKA",
                        "otherSpend": 4691.4,
                        "otherOrders": 4,
                        "monthsSinceOrder": 2,
                        "bounty": 150,
                        "score": 4691.4
                    },
                    {
                        "idCustomer": "13206",
                        "company": "Parkland ER",
                        "tier": "House-2026",
                        "otherSpend": 4342.8,
                        "otherOrders": 7,
                        "monthsSinceOrder": 4,
                        "bounty": 150,
                        "score": 4342.8
                    },
                    {
                        "idCustomer": "13561",
                        "company": "R.L. Alia Company",
                        "tier": "House-2026",
                        "otherSpend": 4225,
                        "otherOrders": 2,
                        "monthsSinceOrder": 1,
                        "bounty": 150,
                        "score": 4225
                    },
                    {
                        "idCustomer": "12820",
                        "company": "Church For All",
                        "tier": "BRONZE '26-NIKA",
                        "otherSpend": 3843,
                        "otherOrders": 4,
                        "monthsSinceOrder": 0,
                        "bounty": 150,
                        "score": 3843
                    },
                    {
                        "idCustomer": "12521",
                        "company": "Church 4 All",
                        "tier": "BRONZE '26-NIKA",
                        "otherSpend": 2752.5,
                        "otherOrders": 2,
                        "monthsSinceOrder": 6,
                        "bounty": 150,
                        "score": 2752.5
                    },
                    {
                        "idCustomer": "13536",
                        "company": "Groff Electric Inc.",
                        "tier": "BRONZE '26-NIKA",
                        "otherSpend": 2640,
                        "otherOrders": 1,
                        "monthsSinceOrder": 0,
                        "bounty": 150,
                        "score": 2640
                    },
                    {
                        "idCustomer": "13654",
                        "company": "JSB Contractor LLC",
                        "tier": "House-2026",
                        "otherSpend": 2570,
                        "otherOrders": 1,
                        "monthsSinceOrder": 0,
                        "bounty": 150,
                        "score": 2570
                    },
                    {
                        "idCustomer": "13267",
                        "company": "Looker Properties",
                        "tier": "BRONZE '26-NIKA",
                        "otherSpend": 2550,
                        "otherOrders": 2,
                        "monthsSinceOrder": 14,
                        "bounty": 150,
                        "score": 2550
                    },
                    {
                        "idCustomer": "535",
                        "company": "Cannon Companies",
                        "tier": "BRONZE '26-NIKA",
                        "otherSpend": 2478,
                        "otherOrders": 2,
                        "monthsSinceOrder": 4,
                        "bounty": 150,
                        "score": 2478
                    }
                ],
                "almostThere": [
                    {
                        "idCustomer": "12069",
                        "company": "Chris Holstrom Concepts",
                        "tier": "House-2026",
                        "quarterRevenue": 675,
                        "gapToBounty": 325,
                        "category": "Reactivated",
                        "bounty": 100
                    },
                    {
                        "idCustomer": "13681",
                        "company": "Light Work Electrical",
                        "tier": "House-2026",
                        "quarterRevenue": 531.5,
                        "gapToBounty": 468.5,
                        "category": "New",
                        "bounty": 150
                    },
                    {
                        "idCustomer": "12979",
                        "company": "Holden Village - Volunteer",
                        "tier": "House-2026",
                        "quarterRevenue": 240,
                        "gapToBounty": 760,
                        "category": "Reactivated",
                        "bounty": 100
                    },
                    {
                        "idCustomer": "13669",
                        "company": "Concrete Technology Corporation",
                        "tier": "House-2026",
                        "quarterRevenue": 100,
                        "gapToBounty": 900,
                        "category": "New",
                        "bounty": 150
                    }
                ],
                "summary": {
                    "winBackCount": 68,
                    "winBackLifetime": 200673.43,
                    "firstProgramCount": 72,
                    "firstProgramSpend": 103352.32,
                    "almostThereCount": 4,
                    "almostThereGap": 2453.5,
                    "almostThereBounty": 500
                }
            },
            "Taneisha Clark": {
                "winBack": [
                    {
                        "idCustomer": "6273",
                        "company": "Materials Testing & Consulting",
                        "tier": "SILVER '26-TANEISHA",
                        "lifetimeEmbroidery": 75687.8,
                        "embroideryOrders": 8,
                        "avgOrderValue": 9460.98,
                        "monthsDormant": 18,
                        "medianReorderDays": 76,
                        "q3SharePct": 0,
                        "bounty": 100,
                        "score": 9460.98
                    },
                    {
                        "idCustomer": "7466",
                        "company": "Fountainhead Development",
                        "tier": "SILVER '26-TANEISHA",
                        "lifetimeEmbroidery": 36108.5,
                        "embroideryOrders": 8,
                        "avgOrderValue": 4513.56,
                        "monthsDormant": 19,
                        "medianReorderDays": 109,
                        "q3SharePct": 25,
                        "bounty": 100,
                        "score": 5641.95
                    },
                    {
                        "idCustomer": "5144",
                        "company": "The Henson Company Inc.",
                        "tier": "SILVER '26-TANEISHA",
                        "lifetimeEmbroidery": 23044.5,
                        "embroideryOrders": 4,
                        "avgOrderValue": 5761.13,
                        "monthsDormant": 18,
                        "medianReorderDays": 329,
                        "q3SharePct": 0,
                        "bounty": 100,
                        "score": 3840.75
                    },
                    {
                        "idCustomer": "13073",
                        "company": "UW Dept. Of Emergency Medicine",
                        "tier": "SILVER '26-TANEISHA",
                        "lifetimeEmbroidery": 9104.5,
                        "embroideryOrders": 1,
                        "avgOrderValue": 9104.5,
                        "monthsDormant": 21,
                        "medianReorderDays": 0,
                        "q3SharePct": 100,
                        "bounty": 100,
                        "score": 3034.83
                    },
                    {
                        "idCustomer": "123",
                        "company": "Fugate Ford",
                        "tier": "GOLD '26- TANEISHA",
                        "lifetimeEmbroidery": 33463.7,
                        "embroideryOrders": 15,
                        "avgOrderValue": 2230.91,
                        "monthsDormant": 19,
                        "medianReorderDays": 89,
                        "q3SharePct": 13,
                        "bounty": 100,
                        "score": 2528.37
                    },
                    {
                        "idCustomer": "3238",
                        "company": "KM Resorts of America",
                        "tier": "SILVER '26-TANEISHA",
                        "lifetimeEmbroidery": 11343.19,
                        "embroideryOrders": 6,
                        "avgOrderValue": 1890.53,
                        "monthsDormant": 14,
                        "medianReorderDays": 236,
                        "q3SharePct": 33,
                        "bounty": 100,
                        "score": 2520.71
                    },
                    {
                        "idCustomer": "12854",
                        "company": "Pease Construction",
                        "tier": "SILVER '26-TANEISHA",
                        "lifetimeEmbroidery": 8408,
                        "embroideryOrders": 2,
                        "avgOrderValue": 4204,
                        "monthsDormant": 19,
                        "medianReorderDays": 91,
                        "q3SharePct": 50,
                        "bounty": 100,
                        "score": 2102
                    },
                    {
                        "idCustomer": "9701",
                        "company": "CondoCare",
                        "tier": "GOLD '26- TANEISHA",
                        "lifetimeEmbroidery": 9912,
                        "embroideryOrders": 7,
                        "avgOrderValue": 1416,
                        "monthsDormant": 12,
                        "medianReorderDays": 145,
                        "q3SharePct": 43,
                        "bounty": 100,
                        "score": 2022.86
                    },
                    {
                        "idCustomer": "11454",
                        "company": "Swire Coca-Cola- Bellevue",
                        "tier": "SILVER '26-TANEISHA",
                        "lifetimeEmbroidery": 13220.5,
                        "embroideryOrders": 5,
                        "avgOrderValue": 2644.1,
                        "monthsDormant": 26,
                        "medianReorderDays": 127,
                        "q3SharePct": 40,
                        "bounty": 100,
                        "score": 1850.87
                    },
                    {
                        "idCustomer": "10282",
                        "company": "Commercial Fence Corporation",
                        "tier": "SILVER '26-TANEISHA",
                        "lifetimeEmbroidery": 10408.6,
                        "embroideryOrders": 6,
                        "avgOrderValue": 1734.77,
                        "monthsDormant": 19,
                        "medianReorderDays": 157,
                        "q3SharePct": 0,
                        "bounty": 100,
                        "score": 1734.77
                    },
                    {
                        "idCustomer": "1438",
                        "company": "Takehara Landscape",
                        "tier": "GOLD '26- TANEISHA",
                        "lifetimeEmbroidery": 13836.2,
                        "embroideryOrders": 8,
                        "avgOrderValue": 1729.53,
                        "monthsDormant": 18,
                        "medianReorderDays": 0,
                        "q3SharePct": 0,
                        "bounty": 100,
                        "score": 1729.53
                    },
                    {
                        "idCustomer": "2575",
                        "company": "Northwest Indian Fisheries Commission",
                        "tier": "BRONZE '26-TANEISHA",
                        "lifetimeEmbroidery": 11374,
                        "embroideryOrders": 7,
                        "avgOrderValue": 1624.86,
                        "monthsDormant": 13,
                        "medianReorderDays": 113,
                        "q3SharePct": 0,
                        "bounty": 100,
                        "score": 1624.86
                    }
                ],
                "firstProgram": [
                    {
                        "idCustomer": "13565",
                        "company": "JMS Concrete Finishing LLC",
                        "tier": "SILVER '26-TANEISHA",
                        "otherSpend": 6358,
                        "otherOrders": 1,
                        "monthsSinceOrder": 4,
                        "bounty": 150,
                        "score": 6358
                    },
                    {
                        "idCustomer": "13629",
                        "company": "AutoShield",
                        "tier": "House-2026",
                        "otherSpend": 4734.5,
                        "otherOrders": 3,
                        "monthsSinceOrder": 0,
                        "bounty": 150,
                        "score": 4734.5
                    },
                    {
                        "idCustomer": "13510",
                        "company": "Lake Tapps Shrink Wraps",
                        "tier": "BRONZE '26-TANEISHA",
                        "otherSpend": 4420,
                        "otherOrders": 3,
                        "monthsSinceOrder": 1,
                        "bounty": 150,
                        "score": 4420
                    },
                    {
                        "idCustomer": "13179",
                        "company": "Bullseye Abatement",
                        "tier": "SILVER '26-TANEISHA",
                        "otherSpend": 3424.25,
                        "otherOrders": 1,
                        "monthsSinceOrder": 17,
                        "bounty": 150,
                        "score": 3424.25
                    },
                    {
                        "idCustomer": "13584",
                        "company": "Skyline Mail Carriers",
                        "tier": "House-2026",
                        "otherSpend": 3420,
                        "otherOrders": 1,
                        "monthsSinceOrder": 3,
                        "bounty": 150,
                        "score": 3420
                    },
                    {
                        "idCustomer": "13573",
                        "company": "Envy Create",
                        "tier": "House-2026",
                        "otherSpend": 2760,
                        "otherOrders": 1,
                        "monthsSinceOrder": 4,
                        "bounty": 150,
                        "score": 2760
                    },
                    {
                        "idCustomer": "13609",
                        "company": "Downtown Tacoma Cleaners Partnership",
                        "tier": "House-2026",
                        "otherSpend": 2552,
                        "otherOrders": 2,
                        "monthsSinceOrder": 1,
                        "bounty": 150,
                        "score": 2552
                    },
                    {
                        "idCustomer": "13265",
                        "company": "Future Dig",
                        "tier": "BRONZE '26-TANEISHA",
                        "otherSpend": 2339,
                        "otherOrders": 3,
                        "monthsSinceOrder": 6,
                        "bounty": 150,
                        "score": 2339
                    },
                    {
                        "idCustomer": "13470",
                        "company": "REIC dba CHI Companies",
                        "tier": "BRONZE '26-TANEISHA",
                        "otherSpend": 2167.35,
                        "otherOrders": 3,
                        "monthsSinceOrder": 2,
                        "bounty": 150,
                        "score": 2167.35
                    },
                    {
                        "idCustomer": "13453",
                        "company": "Bob Perry",
                        "tier": "BRONZE '26-TANEISHA",
                        "otherSpend": 2087.92,
                        "otherOrders": 2,
                        "monthsSinceOrder": 7,
                        "bounty": 150,
                        "score": 2087.92
                    },
                    {
                        "idCustomer": "13450",
                        "company": "Wa Na Wari LLC",
                        "tier": "BRONZE '26-TANEISHA",
                        "otherSpend": 2078.3,
                        "otherOrders": 1,
                        "monthsSinceOrder": 8,
                        "bounty": 150,
                        "score": 2078.3
                    },
                    {
                        "idCustomer": "13583",
                        "company": "Kerry Ingredients",
                        "tier": "House-2026",
                        "otherSpend": 1985,
                        "otherOrders": 2,
                        "monthsSinceOrder": 3,
                        "bounty": 150,
                        "score": 1985
                    }
                ],
                "almostThere": [
                    {
                        "idCustomer": "12989",
                        "company": "UnCruise Adventures",
                        "tier": "Win Back '26 TANEISHA",
                        "quarterRevenue": 892.5,
                        "gapToBounty": 107.5,
                        "category": "Reactivated",
                        "bounty": 100
                    },
                    {
                        "idCustomer": "13670",
                        "company": "Bioclear",
                        "tier": "House-2026",
                        "quarterRevenue": 730,
                        "gapToBounty": 270,
                        "category": "New",
                        "bounty": 150
                    },
                    {
                        "idCustomer": "12337",
                        "company": "Torco Construction",
                        "tier": "SILVER '26-TANEISHA",
                        "quarterRevenue": 426,
                        "gapToBounty": 574,
                        "category": "Reactivated",
                        "bounty": 100
                    },
                    {
                        "idCustomer": "13000",
                        "company": "Temple Fitness",
                        "tier": "BRONZE '26-TANEISHA",
                        "quarterRevenue": 360,
                        "gapToBounty": 640,
                        "category": "New",
                        "bounty": 150
                    },
                    {
                        "idCustomer": "13693",
                        "company": "Darren Diss",
                        "tier": "House-2026",
                        "quarterRevenue": 187.5,
                        "gapToBounty": 812.5,
                        "category": "New",
                        "bounty": 150
                    }
                ],
                "summary": {
                    "winBackCount": 189,
                    "winBackLifetime": 770895.65,
                    "firstProgramCount": 80,
                    "firstProgramSpend": 72855.95,
                    "almostThereCount": 5,
                    "almostThereGap": 2404,
                    "almostThereBounty": 650
                }
            }
        }
    };
    var EMB_BONUS = {
        "program": "EMB",
        "quarter": "Q3",
        "year": 2026,
        "dateRange": {
            "start": "2026-07-01",
            "end": "2026-09-30"
        },
        "configSource": "caspio",
        "orderTypeIds": [
            21
        ],
        "historyOrderTypeIds": [
            21,
            1
        ],
        "minAccountRevenue": 1000,
        "dormancyMonths": 12,
        "teamKicker": {
            "companyRevenue": 73328.48,
            "companyOrders": 66,
            "tiers": [
                {
                    "target": 310000,
                    "pay": 500
                },
                {
                    "target": 340000,
                    "pay": 1000
                }
            ],
            "reached": null,
            "next": {
                "target": 310000,
                "pay": 500
            },
            "amountToNext": 236671.52,
            "payoutEach": 0
        },
        "reps": {
            "Nika Lao": {
                "rep": "Nika Lao",
                "accounts": {
                    "new": [],
                    "reactivated": [
                        {
                            "idCustomer": "7421",
                            "company": "Puyallup Tribal Housing",
                            "tier": "SILVER '26 -NIKA",
                            "revenue": 4669,
                            "orders": 1,
                            "lifetimeEmbroidery": 15540.2,
                            "lastEmbroideryDate": "2025-04-24",
                            "bounty": 100
                        },
                        {
                            "idCustomer": "7557",
                            "company": "MG Car Club ",
                            "tier": "House-2026",
                            "revenue": 1060,
                            "orders": 1,
                            "lifetimeEmbroidery": 1216.4,
                            "lastEmbroideryDate": "2024-02-06",
                            "bounty": 100
                        }
                    ],
                    "repeat": [
                        {
                            "idCustomer": "12142",
                            "company": "Alexandria ",
                            "tier": "SILVER '26 -NIKA",
                            "revenue": 5109.5,
                            "orders": 2,
                            "lifetimeEmbroidery": 61305.34,
                            "lastEmbroideryDate": "2025-12-09"
                        },
                        {
                            "idCustomer": "13347",
                            "company": "JamesHardie ",
                            "tier": "SILVER '26 -NIKA",
                            "revenue": 5084.5,
                            "orders": 1,
                            "lifetimeEmbroidery": 7639.5,
                            "lastEmbroideryDate": "2025-12-09"
                        },
                        {
                            "idCustomer": "12229",
                            "company": "Canber Landscaping ",
                            "tier": "GOLD '26 - NIKA",
                            "revenue": 1520,
                            "orders": 1,
                            "lifetimeEmbroidery": 18186.78,
                            "lastEmbroideryDate": "2026-02-20"
                        }
                    ]
                },
                "counts": {
                    "new": 0,
                    "reactivated": 2,
                    "repeat": 3
                },
                "bounties": {
                    "newAccountBounty": 150,
                    "reactivatedBounty": 100,
                    "payout": 200
                },
                "ladder": {
                    "baseline": 104189,
                    "revenue": 24779.58,
                    "pctOfBaseline": 23.78,
                    "excludedOnlineStoreAccounts": 16,
                    "excludedOnlineStoreRevenue": 29069.86,
                    "rate": {
                        "startPct": 85,
                        "perPoint": 60,
                        "pointsEarned": 0,
                        "revenueAtStart": 88560.65,
                        "payout": 0
                    },
                    "payout": 0,
                    "rungs": [],
                    "rungReached": null,
                    "nextRung": null,
                    "amountToNextRung": 0,
                    "pace": {
                        "asOf": "2026-07-26",
                        "pctOfQuarterElapsed": 25.2,
                        "basis": "seasonal (Jul 30% / Aug 37% / Sep 33%, 2021-25 avg)",
                        "projectedRevenue": 98482.95,
                        "projectedPct": 94.52,
                        "onPaceForPay": 571.4,
                        "shortfallToStartAtPace": 0,
                        "status": "earning"
                    }
                },
                "totalBonus": 200
            },
            "Taneisha Clark": {
                "rep": "Taneisha Clark",
                "accounts": {
                    "new": [
                        {
                            "idCustomer": "13656",
                            "company": "Lobo Roofing",
                            "tier": "House-2026",
                            "revenue": 1541,
                            "orders": 1,
                            "lifetimeEmbroidery": 0,
                            "lastEmbroideryDate": null,
                            "bounty": 150
                        },
                        {
                            "idCustomer": "13644",
                            "company": "Robert The plumber and HVAC 2",
                            "tier": "House-2026",
                            "revenue": 1379.48,
                            "orders": 1,
                            "lifetimeEmbroidery": 0,
                            "lastEmbroideryDate": null,
                            "bounty": 150
                        },
                        {
                            "idCustomer": "12436",
                            "company": "J & H Construction and Hauling ",
                            "tier": "Win Back '26 TANEISHA",
                            "revenue": 1300,
                            "orders": 1,
                            "lifetimeEmbroidery": 0,
                            "lastEmbroideryDate": null,
                            "bounty": 150
                        }
                    ],
                    "reactivated": [],
                    "repeat": [
                        {
                            "idCustomer": "4691",
                            "company": "Crowley Fuels LLC",
                            "tier": "GOLD '26- TANEISHA",
                            "revenue": 5400,
                            "orders": 1,
                            "lifetimeEmbroidery": 63817.1,
                            "lastEmbroideryDate": "2025-09-24"
                        },
                        {
                            "idCustomer": "13542",
                            "company": "Braun Northwest Inc.",
                            "tier": "GOLD '26- TANEISHA",
                            "revenue": 2230,
                            "orders": 1,
                            "lifetimeEmbroidery": 22041.36,
                            "lastEmbroideryDate": "2026-06-29"
                        }
                    ]
                },
                "counts": {
                    "new": 3,
                    "reactivated": 0,
                    "repeat": 2
                },
                "bounties": {
                    "newAccountBounty": 150,
                    "reactivatedBounty": 100,
                    "payout": 450
                },
                "ladder": {
                    "baseline": 89039,
                    "revenue": 15841.48,
                    "pctOfBaseline": 17.79,
                    "excludedOnlineStoreAccounts": 3,
                    "excludedOnlineStoreRevenue": 2563,
                    "rate": {
                        "startPct": 85,
                        "perPoint": 60,
                        "pointsEarned": 0,
                        "revenueAtStart": 75683.15,
                        "payout": 0
                    },
                    "payout": 0,
                    "rungs": [],
                    "rungReached": null,
                    "nextRung": null,
                    "amountToNextRung": 0,
                    "pace": {
                        "asOf": "2026-07-26",
                        "pctOfQuarterElapsed": 25.2,
                        "basis": "seasonal (Jul 30% / Aug 37% / Sep 33%, 2021-25 avg)",
                        "projectedRevenue": 62959.73,
                        "projectedPct": 70.71,
                        "onPaceForPay": 0,
                        "shortfallToStartAtPace": 12723.42,
                        "status": "below-start"
                    }
                },
                "totalBonus": 450
            }
        },
        "generatedAt": "2026-07-26T15:39:18.793Z"
    };
    var realFetch = window.fetch;
    window.fetch = function (url, options) {
        var u = String(url);
        var method = (options && options.method) || 'GET';

        // --- Call list (2026-07-27). Shapes taken from the live endpoint, then bent to cover
        // the states real data won't reliably produce on any given day: email-only, no phone
        // at all, a follow-up already due, one already called, and one missing from the rep's
        // CRM table (the no_row write path). Those are the branches that rot unseen. ---
        if (u.indexOf('/api/crm-proxy/embroidery-bonus/call-list') !== -1) {
            var wantAll = u.indexOf('hydrate=all') !== -1;
            var cm = u.match(/viewAs=([^&]+)/);
            var cEmail = cm ? decodeURIComponent(cm[1]) : REP.email;
            var cWho = cEmail === NIKA.email ? NIKA.fullName : REP.fullName;
            var mk = function (o) {
                return Object.assign({
                    tier: '', bounty: 100, expectedOrder: 1200, callScore: 40,
                    confidence: 'Fair', calledToday: false, lastContactDate: '',
                    contactStatus: '', nextFollowUp: '', followUpDue: false, inRepTable: true,
                    contactName: 'Pat Rivera', email: 'pat@example.com', phone: '(253) 555-0111',
                    phoneDisplay: '(253) 555-0111', hydrated: true
                }, o);
            };
            var callItems = [
                mk({ idCustomer: '9001', company: 'Sterling Septic & Plumbing', play: 'winBack', playLabel: 'Win back',
                     callScore: 256.55, confidence: 'Strong', bounty: 100,
                     nextFollowUp: '2026-07-20', followUpDue: true,
                     why: 'Embroidered 17 times, typically $1,174, quiet 13 months — and Jul-Sep is historically their season.' }),
                mk({ idCustomer: '9002', company: 'Temple Fitness', play: 'almostThere', playLabel: 'Almost there',
                     callScore: 126.06, confidence: 'Strong', bounty: 150,
                     why: '$640 more embroidery pays you $150. Already ordering — at $360 this quarter.' }),
                mk({ idCustomer: '9003', company: 'Fountainhead Development', play: 'winBack', playLabel: 'Win back',
                     callScore: 140.04, confidence: 'Strong', phone: '', phoneDisplay: '',
                     email: 'orders@fountainhead.example', contactName: 'Dana Wu',
                     why: 'Embroidered 8 times, typically $4,514, quiet 19 months — and Jul-Sep is historically their season.' }),
                mk({ idCustomer: '9004', company: 'UW Dept. Of Emergency Medicine', play: 'winBack', playLabel: 'Win back',
                     callScore: 70.14, confidence: 'Strong', phone: '', phoneDisplay: '', email: '', contactName: '',
                     why: 'Embroidered once, $9,105, 21 months ago — one order only, so there’s no reorder pattern to go on.' }),
                mk({ idCustomer: '9005', company: 'MG Car Club', play: 'winBack', playLabel: 'Win back',
                     callScore: 6.2, confidence: 'Long shot', calledToday: true, contactStatus: 'Left Message',
                     lastContactDate: '2026-07-27',
                     why: 'Embroidered 3 times, typically $410, quiet 26 months.' }),
                mk({ idCustomer: '9006', company: 'Griot’s Motors', play: 'firstProgram', playLabel: 'Never embroidered',
                     callScore: 12.4, confidence: 'Fair', bounty: 150, inRepTable: false,
                     why: 'Spends about $1,800 an order with you on other decoration, last order 4 months ago — has never bought embroidery.' })
            ];
            // 20 filler rows so "See more" has something to reveal and the 15-row cut shows.
            for (var ci = 0; ci < 20; ci++) {
                callItems.push(mk({ idCustomer: '95' + (10 + ci), company: 'Filler Account ' + (ci + 1),
                    play: 'winBack', playLabel: 'Win back', callScore: 5 - ci * 0.2,
                    confidence: 'Long shot', hydrated: wantAll,
                    phone: wantAll ? '(253) 555-02' + String(10 + ci) : '',
                    why: 'Embroidered 2 times, typically $380, quiet 29 months.' }));
            }
            var cScoped = {};
            cScoped[cWho] = {
                items: callItems,
                hydratedThrough: wantAll ? callItems.length : 15,
                counts: { total: callItems.length, almostThere: 1, winBack: 24, firstProgram: 1,
                          withPhone: 14, noPhone: 1, notInRepTable: 1 }
            };
            return json({ success: true, quarter: 'Q3', year: 2026, asOf: '2026-07-01',
                minAccountRevenue: 1000, dormancyMonths: 12, today: '2026-07-27',
                configSource: 'caspio', configWarning: null, reps: cScoped });
        }
        // Log-a-call write. 9006 is deliberately absent from the rep's CRM table so the
        // no_row path — which used to report a false success — is exercised every run.
        if (u.indexOf('-accounts/') !== -1 && u.indexOf('/crm') !== -1 && method === 'PUT') {
            var idm = u.match(/-accounts\/(\d+)\/crm/);
            var putId = idm ? idm[1] : '';
            if (putId === '9006') {
                return Promise.resolve(new Response(JSON.stringify({
                    success: false, error: 'no_row',
                    message: 'No row in Taneisha_All_Accounts_Caspio for ID_Customer=9006',
                    idCustomer: 9006
                }), { status: 404, headers: { 'Content-Type': 'application/json' } }));
            }
            return json({ success: true, message: 'CRM fields updated successfully',
                          updatedFields: ['Last_Contact_Date', 'Contact_Status'], recordsAffected: 1 });
        }

        if (u.indexOf('/api/crm-proxy/embroidery-bonus/targets') !== -1) {
            var tm = u.match(/viewAs=([^&]+)/);
            var tEmail = tm ? decodeURIComponent(tm[1]) : REP.email;
            var tWho = tEmail === NIKA.email ? NIKA.fullName : REP.fullName;
            var tScoped = {}; if (EMB_TARGETS.reps[tWho]) tScoped[tWho] = EMB_TARGETS.reps[tWho];
            return json(Object.assign({ success: true }, EMB_TARGETS, { reps: tScoped }));
        }
        // --- Q3 Embroidery Bonus (added 2026-07-25). Real captured backend payload, so the
        // hero and win-back card render the same figures production produces. The server
        // injects identity, so this returns ONLY the viewed rep. ---
        if (u.indexOf('/api/crm-proxy/embroidery-bonus/dormant') !== -1) {
            return json(Object.assign({ success: true }, EMB_DORMANT));
        }
        if (u.indexOf('/api/crm-proxy/embroidery-bonus') !== -1) {
            var vm = u.match(/viewAs=([^&]+)/);
            var vEmail = vm ? decodeURIComponent(vm[1]) : REP.email;
            var who = vEmail === NIKA.email ? NIKA.fullName : REP.fullName;
            var scoped = {}; if (EMB_BONUS.reps[who]) scoped[who] = EMB_BONUS.reps[who];
            return json(Object.assign({ success: true }, EMB_BONUS, { reps: scoped, scope: 'rep' }));
        }
        if (u.indexOf('/api/crm-session/me') !== -1) {
            // ?as=rep (or ?as=nika) stubs a NON-ADMIN rep session.
            // This matters: the harness only ever stubbed Erik-as-admin, so the experience
            // that actually ships to Nika and Taneisha had never been exercised here. Several
            // behaviours are deliberately admin-suppressed — the view-as pill must be hidden,
            // confetti must not fire, and the "since you last looked" baseline must not be
            // written while an admin is looking over a rep's shoulder — and none of that is
            // reachable from an admin session. Default stays admin so existing use is unchanged.
            if (AS_REP) {
                var who = AS_REP === 'nika' ? NIKA : REP;
                return json({
                    authenticated: true, name: who.fullName, firstName: who.firstName,
                    email: who.email, permissions: [AS_REP === 'nika' ? 'nika' : 'taneisha'],
                });
            }
            return json({ authenticated: true, name: 'Erik Mickelson', firstName: 'Erik', email: 'erik@nwcustomapparel.com', permissions: ['admin', 'accountant', 'house', 'policies-admin', 'taneisha', 'nika'] });
        }
        if (u.indexOf('/api/crm-proxy/ae-dashboard/summary') !== -1) {
            // Mirror the server: identity comes from the SESSION, and ?viewAs= is honored only
            // for an admin. A rep never sends viewAs, so keying off it alone made ?as=nika
            // greet Taneisha — a harness that contradicts the real identity rules is how a
            // real identity bug hides in plain sight.
            var email;
            if (AS_REP) {
                email = AS_REP === 'nika' ? NIKA.email : REP.email;
            } else {
                var m = u.match(/viewAs=([^&]+)/);
                email = m ? decodeURIComponent(m[1]) : REP.email;
            }
            return json(applyDegrade(summaryFor(email === NIKA.email ? NIKA : REP)));
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
            // 7 orders + 6 customers so the "show 5 + expand" accordion triggers
            // in both sections. All orders are OPEN/in-process (invoiced &
            // webstore rows are filtered out server-side now — no stage field).
            var o = function (id, cust, company, placedAgo, issues) {
                return { idOrder: id, idCustomer: cust, company: company, placedDate: daysAgoDay(placedAgo),
                    errCount: issues.filter(function (i) { return i.severity === 'err'; }).length, issues: issues };
            };
            var e = function (field, text) { return { field: field, severity: 'err', text: text }; };
            var w = function (field, text) { return { field: field, severity: 'warn', text: text }; };
            return json({
                rep: REP, generatedAt: new Date().toISOString(), windowDays: 30,
                ordersScanned: 47, ordersExcluded: 78, customersScanned: 28, cacheHit: false,
                counts: { ordersFlagged: 7, customersFlagged: 6, orderErrors: 12 },
                orders: [
                    o(142510, 3310, 'Harbor Electric <script>alert(1)</script>', 1, [e('phone', 'no contact phone'), e('terms', 'no payment terms'), e('due-date', 'no requested-ship date')]),
                    o(142488, 5120, 'Korsmo Construction', 3, [e('ship-address', 'ship method "UPS Ground" chosen but NO ship-to address'), e('email', 'no contact email')]),
                    o(142371, 7881, 'Cintas', 4, [e('tax', 'taxable order but $0 sales tax (customer is not tax-exempt)')]),
                    o(142365, 6002, 'Puget Powerwash', 5, [e('last-name', 'no contact last name'), w('ship-address', 'no ship-to address (OK only if pickup)')]),
                    o(142340, 6110, 'Sound Transit Crew', 6, [e('terms', 'no payment terms')]),
                    o(142322, 6220, 'Tacoma Tug & Barge', 8, [e('phone', 'no contact phone')]),
                    o(142301, 6330, 'CITC of Washington', 11, [e('terms', 'no payment terms'), e('phone', 'no contact phone')]),
                ],
                customers: [
                    { idCustomer: 3310, company: 'Harbor Electric', errCount: 2, issues: [e('customer-type', 'customer type not set'), e('phone', 'no phone on the customer record')] },
                    { idCustomer: 5120, company: 'Korsmo Construction', errCount: 0, issues: [w('terms', 'no default payment terms'), w('address', 'address incomplete')] },
                    { idCustomer: 6002, company: 'Puget Powerwash', errCount: 1, issues: [e('customer-type', 'customer type not set')] },
                    { idCustomer: 6110, company: 'Sound Transit Crew', errCount: 1, issues: [e('tax', 'marked tax-exempt but no exemption # on file')] },
                    { idCustomer: 6220, company: 'Tacoma Tug & Barge', errCount: 0, issues: [w('address', 'address incomplete')] },
                    { idCustomer: 6330, company: 'CITC of Washington', errCount: 1, issues: [e('phone', 'no phone on the customer record')] },
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
        // Wins → "Work that shipped". ?degrade=photos exercises the visible-error path, and
        // ?degrade=empty-photos the zero-state, because a rep with no photos yet is the
        // common case early on and that empty state has to read well.
        if (u.indexOf('/api/staff/finished-photos/library') !== -1) {
            if (DEGRADE.indexOf('photos') !== -1) return json({ error: 'Stubbed failure' }, 500);
            if (DEGRADE.indexOf('empty-photos') !== -1) return json({ totalCount: 0, count: 0, photos: [] });
            var shot = function (n, company, design) {
                return {
                    imageUrl: 'https://cdn.caspio.com/A0E15000/Safety%20Stripes/web%20northwest%20custom%20apparel%20logo.png?ver=' + n,
                    companyName: company, designName: design, idOrder: 141000 + n,
                };
            };
            return json({
                totalCount: 37, count: 6, truncated: true,
                photos: [
                    shot(1, 'Boeing Employees Club', 'Left chest logo'),
                    shot(2, 'Elfin Cove Lodge Sportfishing', 'Cap front'),
                    shot(3, 'Archterra Landscape Service', 'Back print'),
                    shot(4, 'CITC of Washington', 'Safety hoodie'),
                    shot(5, 'Harbor Electric <b>xss</b>', 'Jacket back'),   // escaping probe
                    shot(6, 'Puget Sound Marine', 'Polo left chest'),
                ],
            });
        }
        return realFetch.apply(window, arguments);
    };

    console.log('[test-stub] AE Mission Control fetch stub active');
})();
