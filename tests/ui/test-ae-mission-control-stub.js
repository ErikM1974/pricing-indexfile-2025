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
                        "bounty": 50,
                        "score": 10296.69
                    },
                    {
                        "idCustomer": "11974",
                        "company": "Emerald Fire",
                        "tier": "SILVER '26 -NIKA",
                        "lifetimeEmbroidery": 32816.68,
                        "embroideryOrders": 3,
                        "avgOrderValue": 10938.89,
                        "monthsDormant": 18,
                        "medianReorderDays": 372,
                        "q3SharePct": 0,
                        "bounty": 50,
                        "score": 5469.45
                    },
                    {
                        "idCustomer": "1240",
                        "company": "D.L. Henricksen",
                        "tier": "SILVER '26 -NIKA",
                        "lifetimeEmbroidery": 22897.5,
                        "embroideryOrders": 6,
                        "avgOrderValue": 3816.25,
                        "monthsDormant": 13,
                        "medianReorderDays": 125,
                        "q3SharePct": 17,
                        "bounty": 50,
                        "score": 4452.29
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
                        "bounty": 50,
                        "score": 3159.65
                    },
                    {
                        "idCustomer": "11781",
                        "company": "Tilth Land Care",
                        "tier": "SILVER '26 -NIKA",
                        "lifetimeEmbroidery": 36376.76,
                        "embroideryOrders": 13,
                        "avgOrderValue": 2798.21,
                        "monthsDormant": 18,
                        "medianReorderDays": 40,
                        "q3SharePct": 0,
                        "bounty": 50,
                        "score": 2798.21
                    },
                    {
                        "idCustomer": "11858",
                        "company": "Stella Jones - Poles Sales",
                        "tier": "GOLD '26 - NIKA",
                        "lifetimeEmbroidery": 40415,
                        "embroideryOrders": 13,
                        "avgOrderValue": 3108.85,
                        "monthsDormant": 26,
                        "medianReorderDays": 2,
                        "q3SharePct": 0,
                        "bounty": 50,
                        "score": 1865.31
                    },
                    {
                        "idCustomer": "2426",
                        "company": "General Mechanical",
                        "tier": "GOLD '26 - NIKA",
                        "lifetimeEmbroidery": 7380,
                        "embroideryOrders": 5,
                        "avgOrderValue": 1476,
                        "monthsDormant": 12,
                        "medianReorderDays": 51,
                        "q3SharePct": 40,
                        "bounty": 50,
                        "score": 1722
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
                        "bounty": 50,
                        "score": 1677.5
                    },
                    {
                        "idCustomer": "12475",
                        "company": "Wenatchee School District",
                        "tier": "House-2026",
                        "lifetimeEmbroidery": 8198.13,
                        "embroideryOrders": 7,
                        "avgOrderValue": 1171.16,
                        "monthsDormant": 19,
                        "medianReorderDays": 65,
                        "q3SharePct": 43,
                        "bounty": 50,
                        "score": 1673.09
                    },
                    {
                        "idCustomer": "12020",
                        "company": "Vermeer Mountain West",
                        "tier": "House-2026",
                        "lifetimeEmbroidery": 7514.55,
                        "embroideryOrders": 9,
                        "avgOrderValue": 834.95,
                        "monthsDormant": 14,
                        "medianReorderDays": 77,
                        "q3SharePct": 22,
                        "bounty": 50,
                        "score": 1020.49
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
                        "bounty": 50,
                        "score": 938.51
                    },
                    {
                        "idCustomer": "11357",
                        "company": "Capital Lumber",
                        "tier": "SILVER '26 -NIKA",
                        "lifetimeEmbroidery": 22561.97,
                        "embroideryOrders": 32,
                        "avgOrderValue": 705.06,
                        "monthsDormant": 16,
                        "medianReorderDays": 21,
                        "q3SharePct": 31,
                        "bounty": 50,
                        "score": 925.39
                    },
                    {
                        "idCustomer": "8727",
                        "company": "Fife Junior Football",
                        "tier": "BRONZE '26-NIKA",
                        "lifetimeEmbroidery": 8564.58,
                        "embroideryOrders": 10,
                        "avgOrderValue": 856.46,
                        "monthsDormant": 27,
                        "medianReorderDays": 156,
                        "q3SharePct": 60,
                        "bounty": 50,
                        "score": 822.2
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
                        "bounty": 50,
                        "score": 795.07
                    }
                ],
                "firstProgram": [
                    {
                        "idCustomer": "11954",
                        "company": "Stella Jones - SYP Operations",
                        "tier": "GOLD '26 - NIKA",
                        "otherSpend": 15980.37,
                        "otherOrders": 94,
                        "monthsSinceOrder": 4,
                        "bounty": 75,
                        "score": 15980.37
                    },
                    {
                        "idCustomer": "8409",
                        "company": "Ketchikan Fire Dept",
                        "tier": "House-2026",
                        "otherSpend": 9165,
                        "otherOrders": 4,
                        "monthsSinceOrder": 1,
                        "bounty": 75,
                        "score": 9165
                    },
                    {
                        "idCustomer": "12173",
                        "company": "Stella Jones - Resources",
                        "tier": "GOLD '26 - NIKA",
                        "otherSpend": 6305.1,
                        "otherOrders": 36,
                        "monthsSinceOrder": 0,
                        "bounty": 75,
                        "score": 6305.1
                    },
                    {
                        "idCustomer": "13515",
                        "company": "MICHELS",
                        "tier": "SILVER '26 -NIKA",
                        "otherSpend": 5641,
                        "otherOrders": 1,
                        "monthsSinceOrder": 6,
                        "bounty": 75,
                        "score": 5641
                    },
                    {
                        "idCustomer": "13295",
                        "company": "Holy Family School",
                        "tier": "BRONZE '26-NIKA",
                        "otherSpend": 4924.5,
                        "otherOrders": 2,
                        "monthsSinceOrder": 2,
                        "bounty": 75,
                        "score": 4924.5
                    },
                    {
                        "idCustomer": "12734",
                        "company": "Bumblebee Services Inc.",
                        "tier": "BRONZE '26-NIKA",
                        "otherSpend": 4691.4,
                        "otherOrders": 4,
                        "monthsSinceOrder": 2,
                        "bounty": 75,
                        "score": 4691.4
                    },
                    {
                        "idCustomer": "13206",
                        "company": "Parkland ER",
                        "tier": "House-2026",
                        "otherSpend": 4342.8,
                        "otherOrders": 7,
                        "monthsSinceOrder": 4,
                        "bounty": 75,
                        "score": 4342.8
                    },
                    {
                        "idCustomer": "13561",
                        "company": "R.L. Alia Company",
                        "tier": "House-2026",
                        "otherSpend": 4225,
                        "otherOrders": 2,
                        "monthsSinceOrder": 1,
                        "bounty": 75,
                        "score": 4225
                    },
                    {
                        "idCustomer": "12820",
                        "company": "Church For All",
                        "tier": "BRONZE '26-NIKA",
                        "otherSpend": 3843,
                        "otherOrders": 4,
                        "monthsSinceOrder": 0,
                        "bounty": 75,
                        "score": 3843
                    },
                    {
                        "idCustomer": "13066",
                        "company": "Cedar Crest Academy",
                        "tier": "BRONZE '26-NIKA",
                        "otherSpend": 3307.53,
                        "otherOrders": 21,
                        "monthsSinceOrder": 7,
                        "bounty": 75,
                        "score": 3307.53
                    },
                    {
                        "idCustomer": "2592",
                        "company": "Stella Jones Western Operations",
                        "tier": "GOLD '26 - NIKA",
                        "otherSpend": 3281.92,
                        "otherOrders": 33,
                        "monthsSinceOrder": 1,
                        "bounty": 75,
                        "score": 3281.92
                    },
                    {
                        "idCustomer": "13238",
                        "company": "Stella Jones - WOLT",
                        "tier": "GOLD '26 - NIKA",
                        "otherSpend": 3050.5,
                        "otherOrders": 39,
                        "monthsSinceOrder": 14,
                        "bounty": 75,
                        "score": 3050.5
                    },
                    {
                        "idCustomer": "12610",
                        "company": "Stella Jones - Customer Service",
                        "tier": "GOLD '26 - NIKA",
                        "otherSpend": 2979,
                        "otherOrders": 46,
                        "monthsSinceOrder": 5,
                        "bounty": 75,
                        "score": 2979
                    },
                    {
                        "idCustomer": "12521",
                        "company": "Church 4 All",
                        "tier": "BRONZE '26-NIKA",
                        "otherSpend": 2752.5,
                        "otherOrders": 2,
                        "monthsSinceOrder": 6,
                        "bounty": 75,
                        "score": 2752.5
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
                        "bounty": 50
                    },
                    {
                        "idCustomer": "13681",
                        "company": "Light Work Electrical",
                        "tier": "House-2026",
                        "quarterRevenue": 531.5,
                        "gapToBounty": 468.5,
                        "category": "New",
                        "bounty": 75
                    },
                    {
                        "idCustomer": "12979",
                        "company": "Holden Village - Volunteer",
                        "tier": "House-2026",
                        "quarterRevenue": 240,
                        "gapToBounty": 760,
                        "category": "Reactivated",
                        "bounty": 50
                    },
                    {
                        "idCustomer": "13669",
                        "company": "Concrete Technology Corporation",
                        "tier": "House-2026",
                        "quarterRevenue": 100,
                        "gapToBounty": 900,
                        "category": "New",
                        "bounty": 75
                    }
                ],
                "summary": {
                    "winBackCount": 99,
                    "winBackLifetime": 430712.67,
                    "firstProgramCount": 87,
                    "firstProgramSpend": 145505.83,
                    "almostThereCount": 4,
                    "almostThereGap": 2453.5,
                    "almostThereBounty": 250
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
                        "bounty": 50,
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
                        "bounty": 50,
                        "score": 5641.95
                    },
                    {
                        "idCustomer": "3815",
                        "company": "Architectural Woods, L.P.",
                        "tier": "BRONZE '26-TANEISHA",
                        "lifetimeEmbroidery": 47643,
                        "embroideryOrders": 9,
                        "avgOrderValue": 5293.67,
                        "monthsDormant": 24,
                        "medianReorderDays": 24,
                        "q3SharePct": 0,
                        "bounty": 50,
                        "score": 5293.67
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
                        "bounty": 50,
                        "score": 3840.75
                    },
                    {
                        "idCustomer": "7693",
                        "company": "Caliber Concrete Construction",
                        "tier": "GOLD '26- TANEISHA",
                        "lifetimeEmbroidery": 58424.77,
                        "embroideryOrders": 19,
                        "avgOrderValue": 3074.99,
                        "monthsDormant": 18,
                        "medianReorderDays": 51,
                        "q3SharePct": 16,
                        "bounty": 50,
                        "score": 3560.51
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
                        "bounty": 50,
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
                        "bounty": 50,
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
                        "bounty": 50,
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
                        "bounty": 50,
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
                        "bounty": 50,
                        "score": 2022.86
                    },
                    {
                        "idCustomer": "10887",
                        "company": "Designed Groundwater Services",
                        "tier": "SILVER '26-TANEISHA",
                        "lifetimeEmbroidery": 18668.34,
                        "embroideryOrders": 15,
                        "avgOrderValue": 1244.56,
                        "monthsDormant": 19,
                        "medianReorderDays": 115,
                        "q3SharePct": 53,
                        "bounty": 50,
                        "score": 1908.32
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
                        "bounty": 50,
                        "score": 1850.87
                    },
                    {
                        "idCustomer": "3163",
                        "company": "Pierce County Noxious Weed Control",
                        "tier": "SILVER '26-TANEISHA",
                        "lifetimeEmbroidery": 18116,
                        "embroideryOrders": 6,
                        "avgOrderValue": 3019.33,
                        "monthsDormant": 25,
                        "medianReorderDays": 0,
                        "q3SharePct": 0,
                        "bounty": 50,
                        "score": 1811.6
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
                        "bounty": 50,
                        "score": 1734.77
                    }
                ],
                "firstProgram": [
                    {
                        "idCustomer": "8742",
                        "company": "HOPSNDROPS - Lacey",
                        "tier": "GOLD '26- TANEISHA",
                        "otherSpend": 12864.19,
                        "otherOrders": 12,
                        "monthsSinceOrder": 0,
                        "bounty": 75,
                        "score": 12864.19
                    },
                    {
                        "idCustomer": "8701",
                        "company": "HOPSNDROPS - Silverdale",
                        "tier": "GOLD '26- TANEISHA",
                        "otherSpend": 10747.06,
                        "otherOrders": 10,
                        "monthsSinceOrder": 2,
                        "bounty": 75,
                        "score": 10747.06
                    },
                    {
                        "idCustomer": "7977",
                        "company": "HOPSNDROPS - Bonney Lake",
                        "tier": "GOLD '26- TANEISHA",
                        "otherSpend": 8621.8,
                        "otherOrders": 12,
                        "monthsSinceOrder": 0,
                        "bounty": 75,
                        "score": 8621.8
                    },
                    {
                        "idCustomer": "10419",
                        "company": "HOPSNDROPS - Richland",
                        "tier": "GOLD '26- TANEISHA",
                        "otherSpend": 8177.19,
                        "otherOrders": 11,
                        "monthsSinceOrder": 2,
                        "bounty": 75,
                        "score": 8177.19
                    },
                    {
                        "idCustomer": "11840",
                        "company": "HOPSNDROPS - Frederickson",
                        "tier": "GOLD '26- TANEISHA",
                        "otherSpend": 7960.08,
                        "otherOrders": 11,
                        "monthsSinceOrder": 0,
                        "bounty": 75,
                        "score": 7960.08
                    },
                    {
                        "idCustomer": "9055",
                        "company": "HOPSNDROPS - Spokane North",
                        "tier": "GOLD '26- TANEISHA",
                        "otherSpend": 7757.79,
                        "otherOrders": 10,
                        "monthsSinceOrder": 1,
                        "bounty": 75,
                        "score": 7757.79
                    },
                    {
                        "idCustomer": "11343",
                        "company": "HOPSNDROPS - Snohomish",
                        "tier": "GOLD '26- TANEISHA",
                        "otherSpend": 7538.34,
                        "otherOrders": 11,
                        "monthsSinceOrder": 2,
                        "bounty": 75,
                        "score": 7538.34
                    },
                    {
                        "idCustomer": "10211",
                        "company": "HOPSNDROPS - Spokane Valley",
                        "tier": "GOLD '26- TANEISHA",
                        "otherSpend": 7346.21,
                        "otherOrders": 18,
                        "monthsSinceOrder": 3,
                        "bounty": 75,
                        "score": 7346.21
                    },
                    {
                        "idCustomer": "13565",
                        "company": "JMS Concrete Finishing LLC",
                        "tier": "SILVER '26-TANEISHA",
                        "otherSpend": 6358,
                        "otherOrders": 1,
                        "monthsSinceOrder": 4,
                        "bounty": 75,
                        "score": 6358
                    },
                    {
                        "idCustomer": "11342",
                        "company": "HOPSNDROPS - Lakewood",
                        "tier": "GOLD '26- TANEISHA",
                        "otherSpend": 5452.4,
                        "otherOrders": 8,
                        "monthsSinceOrder": 1,
                        "bounty": 75,
                        "score": 5452.4
                    },
                    {
                        "idCustomer": "13282",
                        "company": "Heatherstone",
                        "tier": "SILVER '26-TANEISHA",
                        "otherSpend": 5139.77,
                        "otherOrders": 5,
                        "monthsSinceOrder": 1,
                        "bounty": 75,
                        "score": 5139.77
                    },
                    {
                        "idCustomer": "10460",
                        "company": "HOPSNDROPS - Kennewick",
                        "tier": "GOLD '26- TANEISHA",
                        "otherSpend": 4855.7,
                        "otherOrders": 10,
                        "monthsSinceOrder": 0,
                        "bounty": 75,
                        "score": 4855.7
                    },
                    {
                        "idCustomer": "11420",
                        "company": "HOPSNDROPS - Gig Harbor",
                        "tier": "GOLD '26- TANEISHA",
                        "otherSpend": 4795.47,
                        "otherOrders": 11,
                        "monthsSinceOrder": 1,
                        "bounty": 75,
                        "score": 4795.47
                    },
                    {
                        "idCustomer": "13629",
                        "company": "AutoShield",
                        "tier": "House-2026",
                        "otherSpend": 4734.5,
                        "otherOrders": 3,
                        "monthsSinceOrder": 0,
                        "bounty": 75,
                        "score": 4734.5
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
                        "bounty": 50
                    },
                    {
                        "idCustomer": "13670",
                        "company": "Bioclear",
                        "tier": "House-2026",
                        "quarterRevenue": 730,
                        "gapToBounty": 270,
                        "category": "New",
                        "bounty": 75
                    },
                    {
                        "idCustomer": "12337",
                        "company": "Torco Construction",
                        "tier": "SILVER '26-TANEISHA",
                        "quarterRevenue": 426,
                        "gapToBounty": 574,
                        "category": "Reactivated",
                        "bounty": 50
                    },
                    {
                        "idCustomer": "13000",
                        "company": "Temple Fitness",
                        "tier": "BRONZE '26-TANEISHA",
                        "quarterRevenue": 360,
                        "gapToBounty": 640,
                        "category": "New",
                        "bounty": 75
                    },
                    {
                        "idCustomer": "13693",
                        "company": "Darren Diss",
                        "tier": "House-2026",
                        "quarterRevenue": 187.5,
                        "gapToBounty": 812.5,
                        "category": "New",
                        "bounty": 75
                    }
                ],
                "summary": {
                    "winBackCount": 282,
                    "winBackLifetime": 1232062.36,
                    "firstProgramCount": 165,
                    "firstProgramSpend": 233811.22,
                    "almostThereCount": 5,
                    "almostThereGap": 2404,
                    "almostThereBounty": 325
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
            "companyRevenue": 166960.11,
            "companyOrders": 235,
            "tiers": [
                {
                    "target": 700000,
                    "pay": 250
                },
                {
                    "target": 740000,
                    "pay": 500
                }
            ],
            "reached": null,
            "next": {
                "target": 700000,
                "pay": 250
            },
            "amountToNext": 533039.89,
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
                            "bounty": 50
                        },
                        {
                            "idCustomer": "10428",
                            "company": "Tacoma Longshoremen Credit Union ",
                            "tier": "House-2026",
                            "revenue": 1626,
                            "orders": 1,
                            "lifetimeEmbroidery": 3825.59,
                            "lastEmbroideryDate": "2025-06-05",
                            "bounty": 50
                        },
                        {
                            "idCustomer": "7557",
                            "company": "MG Car Club ",
                            "tier": "House-2026",
                            "revenue": 1060,
                            "orders": 1,
                            "lifetimeEmbroidery": 1216.4,
                            "lastEmbroideryDate": "2024-02-06",
                            "bounty": 50
                        }
                    ],
                    "repeat": [
                        {
                            "idCustomer": "4537",
                            "company": "RPD (Rickabaugh Pentecost Development)",
                            "tier": "GOLD '26 - NIKA",
                            "revenue": 13485,
                            "orders": 2,
                            "lifetimeEmbroidery": 24597.94,
                            "lastEmbroideryDate": "2026-06-02"
                        },
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
                            "idCustomer": "6326",
                            "company": "Archterra Landscape Services",
                            "tier": "GOLD '26 - NIKA",
                            "revenue": 3808,
                            "orders": 2,
                            "lifetimeEmbroidery": 75600.01,
                            "lastEmbroideryDate": "2026-05-15"
                        },
                        {
                            "idCustomer": "12007",
                            "company": "Stella Jones",
                            "tier": "GOLD '26 - NIKA",
                            "revenue": 1924.5,
                            "orders": 1,
                            "lifetimeEmbroidery": 14397,
                            "lastEmbroideryDate": "2026-04-01"
                        },
                        {
                            "idCustomer": "2715",
                            "company": "Spartan Band Association",
                            "tier": "BRONZE '26-NIKA",
                            "revenue": 1897.5,
                            "orders": 2,
                            "lifetimeEmbroidery": 11504.5,
                            "lastEmbroideryDate": "2025-12-23"
                        },
                        {
                            "idCustomer": "10798",
                            "company": "MSHS Pacific Power Group",
                            "tier": "GOLD '26 - NIKA",
                            "revenue": 1792,
                            "orders": 1,
                            "lifetimeEmbroidery": 41912,
                            "lastEmbroideryDate": "2026-04-07"
                        },
                        {
                            "idCustomer": "12229",
                            "company": "Canber Landscaping ",
                            "tier": "GOLD '26 - NIKA",
                            "revenue": 1520,
                            "orders": 1,
                            "lifetimeEmbroidery": 18186.78,
                            "lastEmbroideryDate": "2026-02-20"
                        },
                        {
                            "idCustomer": "8469",
                            "company": "Wescraft RV & Truck In Fife",
                            "tier": "House-2026",
                            "revenue": 1230,
                            "orders": 1,
                            "lifetimeEmbroidery": 5115.1,
                            "lastEmbroideryDate": "2025-09-16"
                        }
                    ]
                },
                "counts": {
                    "new": 0,
                    "reactivated": 3,
                    "repeat": 9
                },
                "bounties": {
                    "newAccountBounty": 75,
                    "reactivatedBounty": 50,
                    "payout": 150
                },
                "ladder": {
                    "baseline": 235000,
                    "revenue": 53849.44,
                    "pctOfBaseline": 22.91,
                    "rungs": [
                        {
                            "pct": 70,
                            "pay": 150,
                            "threshold": 164500
                        },
                        {
                            "pct": 90,
                            "pay": 400,
                            "threshold": 211500
                        },
                        {
                            "pct": 110,
                            "pay": 700,
                            "threshold": 258500
                        },
                        {
                            "pct": 130,
                            "pay": 1200,
                            "threshold": 305500
                        }
                    ],
                    "rungReached": null,
                    "nextRung": {
                        "pct": 70,
                        "pay": 150,
                        "threshold": 164500
                    },
                    "amountToNextRung": 110650.56,
                    "payout": 0,
                    "pace": {
                        "asOf": "2026-07-26",
                        "pctOfQuarterElapsed": 25.2,
                        "basis": "seasonal (Jul 30% / Aug 37% / Sep 33%, 2021-25 avg)",
                        "projectedRevenue": 214017.01,
                        "onPaceForRungPct": 90,
                        "onPaceForPay": 400,
                        "nextRungAtPacePct": 110,
                        "shortfallToNextAtPace": 0,
                        "status": "on-pace"
                    }
                },
                "totalBonus": 150
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
                            "bounty": 75
                        },
                        {
                            "idCustomer": "13509",
                            "company": "GNW Excavation",
                            "tier": "SILVER '26-TANEISHA",
                            "revenue": 1464,
                            "orders": 1,
                            "lifetimeEmbroidery": 0,
                            "lastEmbroideryDate": null,
                            "bounty": 75
                        },
                        {
                            "idCustomer": "13644",
                            "company": "Robert The plumber and HVAC 2",
                            "tier": "House-2026",
                            "revenue": 1379.48,
                            "orders": 1,
                            "lifetimeEmbroidery": 0,
                            "lastEmbroideryDate": null,
                            "bounty": 75
                        },
                        {
                            "idCustomer": "12436",
                            "company": "J & H Construction and Hauling ",
                            "tier": "Win Back '26 TANEISHA",
                            "revenue": 1300,
                            "orders": 1,
                            "lifetimeEmbroidery": 0,
                            "lastEmbroideryDate": null,
                            "bounty": 75
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
                    "new": 4,
                    "reactivated": 0,
                    "repeat": 2
                },
                "bounties": {
                    "newAccountBounty": 75,
                    "reactivatedBounty": 50,
                    "payout": 300
                },
                "ladder": {
                    "baseline": 100000,
                    "revenue": 18404.48,
                    "pctOfBaseline": 18.4,
                    "rungs": [
                        {
                            "pct": 85,
                            "pay": 150,
                            "threshold": 85000
                        },
                        {
                            "pct": 100,
                            "pay": 400,
                            "threshold": 100000
                        },
                        {
                            "pct": 115,
                            "pay": 700,
                            "threshold": 115000
                        },
                        {
                            "pct": 130,
                            "pay": 1200,
                            "threshold": 130000
                        }
                    ],
                    "rungReached": null,
                    "nextRung": {
                        "pct": 85,
                        "pay": 150,
                        "threshold": 85000
                    },
                    "amountToNextRung": 66595.52,
                    "payout": 0,
                    "pace": {
                        "asOf": "2026-07-26",
                        "pctOfQuarterElapsed": 25.2,
                        "basis": "seasonal (Jul 30% / Aug 37% / Sep 33%, 2021-25 avg)",
                        "projectedRevenue": 73146.01,
                        "onPaceForRungPct": null,
                        "onPaceForPay": 0,
                        "nextRungAtPacePct": 85,
                        "shortfallToNextAtPace": 11853.99,
                        "status": "behind"
                    }
                },
                "totalBonus": 300
            }
        },
        "generatedAt": "2026-07-26T13:09:37.736Z"
    };

    var realFetch = window.fetch;
    window.fetch = function (url, options) {
        var u = String(url);
        var method = (options && options.method) || 'GET';

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
        return realFetch.apply(window, arguments);
    };

    console.log('[test-stub] AE Mission Control fetch stub active');
})();
