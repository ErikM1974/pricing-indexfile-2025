/**
 * test-embroidery-bonus-stub.js — fetch stub for tests/ui/test-embroidery-bonus.html
 *
 * Payload is REAL output captured from computeEmbroideryBonus/computeDormant against
 * live ORDER_ODBC on 2026-07-25, so this harness renders the same numbers the verified
 * backend produces (Q3-to-date, config in fallback state so the warning banner shows).
 * Regenerate by re-running the helpers and dumping to JSON.
 */
(function () {
    'use strict';
    var BONUS = {
        "program": "EMB",
        "quarter": "Q3",
        "year": 2026,
        "dateRange": {
            "start": "2026-07-01",
            "end": "2026-09-30"
        },
        "configSource": "fallback",
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
                            "pct": 85,
                            "pay": 150,
                            "threshold": 199750
                        },
                        {
                            "pct": 100,
                            "pay": 400,
                            "threshold": 235000
                        },
                        {
                            "pct": 115,
                            "pay": 700,
                            "threshold": 270250
                        },
                        {
                            "pct": 130,
                            "pay": 1200,
                            "threshold": 305500
                        }
                    ],
                    "rungReached": null,
                    "nextRung": {
                        "pct": 85,
                        "pay": 150,
                        "threshold": 199750
                    },
                    "amountToNextRung": 145900.56,
                    "payout": 0
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
                    "payout": 0
                },
                "totalBonus": 300
            }
        },
        "generatedAt": "2026-07-25T14:28:24.367Z",
        "warning": "Bonus config could not be read from Caspio table Rep_Bonus_Config. Showing built-in default rates — these may not match the current plan. Verify before paying."
    };
    var DORMANT = {
        "quarter": "Q3",
        "year": 2026,
        "asOf": "2026-07-01",
        "dormancyMonths": 12,
        "configSource": "fallback",
        "reps": {
            "Nika Lao": {
                "count": 104,
                "lifetimeEmbroideryTotal": 454356.46,
                "stillDormantCount": 99,
                "stillDormantLifetimeTotal": 430712.67,
                "alreadyReactivatedCount": 5,
                "accounts": [
                    {
                        "idCustomer": "753",
                        "company": "International Belt & Rubber",
                        "tier": "GOLD '26 - NIKA",
                        "lifetimeEmbroidery": 69502.66,
                        "embroideryOrders": 9,
                        "lastEmbroideryDate": "2024-11-26",
                        "monthsDormant": 19,
                        "bountyIfWon": 50,
                        "quarterToDateRevenue": 0,
                        "alreadyReactivated": false
                    },
                    {
                        "idCustomer": "11858",
                        "company": "Stella Jones - Poles Sales",
                        "tier": "GOLD '26 - NIKA",
                        "lifetimeEmbroidery": 40415,
                        "embroideryOrders": 13,
                        "lastEmbroideryDate": "2024-04-09",
                        "monthsDormant": 26,
                        "bountyIfWon": 50,
                        "quarterToDateRevenue": 0,
                        "alreadyReactivated": false
                    },
                    {
                        "idCustomer": "11781",
                        "company": "Tilth Land Care",
                        "tier": "SILVER '26 -NIKA",
                        "lifetimeEmbroidery": 36376.76,
                        "embroideryOrders": 13,
                        "lastEmbroideryDate": "2024-12-12",
                        "monthsDormant": 18,
                        "bountyIfWon": 50,
                        "quarterToDateRevenue": 0,
                        "alreadyReactivated": false
                    },
                    {
                        "idCustomer": "11974",
                        "company": "Emerald Fire",
                        "tier": "SILVER '26 -NIKA",
                        "lifetimeEmbroidery": 32816.68,
                        "embroideryOrders": 3,
                        "lastEmbroideryDate": "2024-12-11",
                        "monthsDormant": 18,
                        "bountyIfWon": 50,
                        "quarterToDateRevenue": 0,
                        "alreadyReactivated": false
                    },
                    {
                        "idCustomer": "1240",
                        "company": "D.L. Henricksen",
                        "tier": "SILVER '26 -NIKA",
                        "lifetimeEmbroidery": 22897.5,
                        "embroideryOrders": 6,
                        "lastEmbroideryDate": "2025-05-01",
                        "monthsDormant": 13,
                        "bountyIfWon": 50,
                        "quarterToDateRevenue": 0,
                        "alreadyReactivated": false
                    },
                    {
                        "idCustomer": "11357",
                        "company": "Capital Lumber",
                        "tier": "SILVER '26 -NIKA",
                        "lifetimeEmbroidery": 22561.97,
                        "embroideryOrders": 32,
                        "lastEmbroideryDate": "2025-02-04",
                        "monthsDormant": 16,
                        "bountyIfWon": 50,
                        "quarterToDateRevenue": 0,
                        "alreadyReactivated": false
                    },
                    {
                        "idCustomer": "7421",
                        "company": "Puyallup Tribal Housing",
                        "tier": "SILVER '26 -NIKA",
                        "lifetimeEmbroidery": 15540.2,
                        "embroideryOrders": 5,
                        "lastEmbroideryDate": "2025-04-24",
                        "monthsDormant": 14,
                        "bountyIfWon": 50,
                        "quarterToDateRevenue": 4669,
                        "alreadyReactivated": true
                    },
                    {
                        "idCustomer": "3001",
                        "company": "Green Effects, Inc.",
                        "tier": "SILVER '26 -NIKA",
                        "lifetimeEmbroidery": 14218.41,
                        "embroideryOrders": 6,
                        "lastEmbroideryDate": "2025-04-02",
                        "monthsDormant": 14,
                        "bountyIfWon": 50,
                        "quarterToDateRevenue": 0,
                        "alreadyReactivated": false
                    },
                    {
                        "idCustomer": "11894",
                        "company": "CBRE",
                        "tier": "House-2026",
                        "lifetimeEmbroidery": 9659.91,
                        "embroideryOrders": 17,
                        "lastEmbroideryDate": "2025-02-19",
                        "monthsDormant": 16,
                        "bountyIfWon": 50,
                        "quarterToDateRevenue": 0,
                        "alreadyReactivated": false
                    },
                    {
                        "idCustomer": "12237",
                        "company": "Chavira & Associates LLC",
                        "tier": "House-2026",
                        "lifetimeEmbroidery": 9461.42,
                        "embroideryOrders": 17,
                        "lastEmbroideryDate": "2025-02-21",
                        "monthsDormant": 16,
                        "bountyIfWon": 50,
                        "quarterToDateRevenue": 0,
                        "alreadyReactivated": false
                    },
                    {
                        "idCustomer": "8727",
                        "company": "Fife Junior Football",
                        "tier": "BRONZE '26-NIKA",
                        "lifetimeEmbroidery": 8564.58,
                        "embroideryOrders": 10,
                        "lastEmbroideryDate": "2024-03-22",
                        "monthsDormant": 27,
                        "bountyIfWon": 50,
                        "quarterToDateRevenue": 0,
                        "alreadyReactivated": false
                    },
                    {
                        "idCustomer": "297",
                        "company": "Elfin Cove Lodge",
                        "tier": "SILVER '26 -NIKA",
                        "lifetimeEmbroidery": 8441.5,
                        "embroideryOrders": 6,
                        "lastEmbroideryDate": "2023-05-22",
                        "monthsDormant": 37,
                        "bountyIfWon": 50,
                        "quarterToDateRevenue": 0,
                        "alreadyReactivated": false
                    },
                    {
                        "idCustomer": "12475",
                        "company": "Wenatchee School District",
                        "tier": "House-2026",
                        "lifetimeEmbroidery": 8198.13,
                        "embroideryOrders": 7,
                        "lastEmbroideryDate": "2024-11-19",
                        "monthsDormant": 19,
                        "bountyIfWon": 50,
                        "quarterToDateRevenue": 0,
                        "alreadyReactivated": false
                    },
                    {
                        "idCustomer": "12020",
                        "company": "Vermeer Mountain West",
                        "tier": "House-2026",
                        "lifetimeEmbroidery": 7514.55,
                        "embroideryOrders": 9,
                        "lastEmbroideryDate": "2025-04-24",
                        "monthsDormant": 14,
                        "bountyIfWon": 50,
                        "quarterToDateRevenue": 0,
                        "alreadyReactivated": false
                    },
                    {
                        "idCustomer": "2426",
                        "company": "General Mechanical",
                        "tier": "GOLD '26 - NIKA",
                        "lifetimeEmbroidery": 7380,
                        "embroideryOrders": 5,
                        "lastEmbroideryDate": "2025-06-04",
                        "monthsDormant": 12,
                        "bountyIfWon": 50,
                        "quarterToDateRevenue": 0,
                        "alreadyReactivated": false
                    },
                    {
                        "idCustomer": "12429",
                        "company": "Evergreen Goodwill Of NW Washington",
                        "tier": "BRONZE '26-NIKA",
                        "lifetimeEmbroidery": 6710,
                        "embroideryOrders": 2,
                        "lastEmbroideryDate": "2024-07-17",
                        "monthsDormant": 23,
                        "bountyIfWon": 50,
                        "quarterToDateRevenue": 0,
                        "alreadyReactivated": false
                    },
                    {
                        "idCustomer": "12048",
                        "company": "ProEnd Painting",
                        "tier": "House-2026",
                        "lifetimeEmbroidery": 6674.2,
                        "embroideryOrders": 5,
                        "lastEmbroideryDate": "2024-05-16",
                        "monthsDormant": 25,
                        "bountyIfWon": 50,
                        "quarterToDateRevenue": 0,
                        "alreadyReactivated": false
                    },
                    {
                        "idCustomer": "12230",
                        "company": "Gafco Roofing and Construction",
                        "tier": "House-2026",
                        "lifetimeEmbroidery": 4826.6,
                        "embroideryOrders": 6,
                        "lastEmbroideryDate": "2025-02-19",
                        "monthsDormant": 16,
                        "bountyIfWon": 50,
                        "quarterToDateRevenue": 0,
                        "alreadyReactivated": false
                    },
                    {
                        "idCustomer": "12586",
                        "company": "Valley Property Services",
                        "tier": "BRONZE '26-NIKA",
                        "lifetimeEmbroidery": 4770.4,
                        "embroideryOrders": 4,
                        "lastEmbroideryDate": "2025-06-04",
                        "monthsDormant": 12,
                        "bountyIfWon": 50,
                        "quarterToDateRevenue": 0,
                        "alreadyReactivated": false
                    },
                    {
                        "idCustomer": "12948",
                        "company": "NuuCo Electric",
                        "tier": "SILVER '26 -NIKA",
                        "lifetimeEmbroidery": 4602.5,
                        "embroideryOrders": 1,
                        "lastEmbroideryDate": "2024-06-17",
                        "monthsDormant": 24,
                        "bountyIfWon": 50,
                        "quarterToDateRevenue": 0,
                        "alreadyReactivated": false
                    },
                    {
                        "idCustomer": "9081",
                        "company": "High Country Homes",
                        "tier": "House-2026",
                        "lifetimeEmbroidery": 4344.04,
                        "embroideryOrders": 6,
                        "lastEmbroideryDate": "2025-04-22",
                        "monthsDormant": 14,
                        "bountyIfWon": 50,
                        "quarterToDateRevenue": 0,
                        "alreadyReactivated": false
                    },
                    {
                        "idCustomer": "12349",
                        "company": "Grandview Early Learning Center",
                        "tier": "BRONZE '26-NIKA",
                        "lifetimeEmbroidery": 4182.1,
                        "embroideryOrders": 7,
                        "lastEmbroideryDate": "2025-06-19",
                        "monthsDormant": 12,
                        "bountyIfWon": 50,
                        "quarterToDateRevenue": 0,
                        "alreadyReactivated": false
                    },
                    {
                        "idCustomer": "13109",
                        "company": "Pacific Fish Company",
                        "tier": "BRONZE '26-NIKA",
                        "lifetimeEmbroidery": 4080.4,
                        "embroideryOrders": 1,
                        "lastEmbroideryDate": "2025-02-03",
                        "monthsDormant": 16,
                        "bountyIfWon": 50,
                        "quarterToDateRevenue": 0,
                        "alreadyReactivated": false
                    },
                    {
                        "idCustomer": "10754",
                        "company": "Geo Resources",
                        "tier": "House-2026",
                        "lifetimeEmbroidery": 3875.59,
                        "embroideryOrders": 30,
                        "lastEmbroideryDate": "2022-05-24",
                        "monthsDormant": 49,
                        "bountyIfWon": 50,
                        "quarterToDateRevenue": 0,
                        "alreadyReactivated": false
                    },
                    {
                        "idCustomer": "10428",
                        "company": "Tacoma Longshoremen Credit Union",
                        "tier": "House-2026",
                        "lifetimeEmbroidery": 3825.59,
                        "embroideryOrders": 5,
                        "lastEmbroideryDate": "2025-06-05",
                        "monthsDormant": 12,
                        "bountyIfWon": 50,
                        "quarterToDateRevenue": 1626,
                        "alreadyReactivated": true
                    },
                    {
                        "idCustomer": "12280",
                        "company": "Degrees Of change",
                        "tier": "House-2026",
                        "lifetimeEmbroidery": 3747,
                        "embroideryOrders": 6,
                        "lastEmbroideryDate": "2023-05-25",
                        "monthsDormant": 37,
                        "bountyIfWon": 50,
                        "quarterToDateRevenue": 0,
                        "alreadyReactivated": false
                    },
                    {
                        "idCustomer": "12692",
                        "company": "Stella Jones - Wilbur Plant",
                        "tier": "GOLD '26 - NIKA",
                        "lifetimeEmbroidery": 3284,
                        "embroideryOrders": 1,
                        "lastEmbroideryDate": "2025-01-13",
                        "monthsDormant": 17,
                        "bountyIfWon": 50,
                        "quarterToDateRevenue": 0,
                        "alreadyReactivated": false
                    },
                    {
                        "idCustomer": "10545",
                        "company": "Mechanical & Control Services, Inc",
                        "tier": "House-2026",
                        "lifetimeEmbroidery": 3165,
                        "embroideryOrders": 5,
                        "lastEmbroideryDate": "2024-02-08",
                        "monthsDormant": 28,
                        "bountyIfWon": 50,
                        "quarterToDateRevenue": 0,
                        "alreadyReactivated": false
                    },
                    {
                        "idCustomer": "13269",
                        "company": "Jake Faccone",
                        "tier": "SILVER '26 -NIKA",
                        "lifetimeEmbroidery": 3154.1,
                        "embroideryOrders": 1,
                        "lastEmbroideryDate": "2025-04-16",
                        "monthsDormant": 14,
                        "bountyIfWon": 50,
                        "quarterToDateRevenue": 0,
                        "alreadyReactivated": false
                    },
                    {
                        "idCustomer": "12993",
                        "company": "Terenn Houk",
                        "tier": "House-2026",
                        "lifetimeEmbroidery": 2998.9,
                        "embroideryOrders": 3,
                        "lastEmbroideryDate": "2025-03-25",
                        "monthsDormant": 15,
                        "bountyIfWon": 50,
                        "quarterToDateRevenue": 0,
                        "alreadyReactivated": false
                    }
                ]
            },
            "Taneisha Clark": {
                "count": 284,
                "lifetimeEmbroideryTotal": 1235089.36,
                "stillDormantCount": 282,
                "stillDormantLifetimeTotal": 1232062.36,
                "alreadyReactivatedCount": 2,
                "accounts": [
                    {
                        "idCustomer": "6273",
                        "company": "Materials Testing & Consulting",
                        "tier": "SILVER '26-TANEISHA",
                        "lifetimeEmbroidery": 75687.8,
                        "embroideryOrders": 8,
                        "lastEmbroideryDate": "2024-12-02",
                        "monthsDormant": 18,
                        "bountyIfWon": 50,
                        "quarterToDateRevenue": 0,
                        "alreadyReactivated": false
                    },
                    {
                        "idCustomer": "7693",
                        "company": "Caliber Concrete Construction",
                        "tier": "GOLD '26- TANEISHA",
                        "lifetimeEmbroidery": 58424.77,
                        "embroideryOrders": 19,
                        "lastEmbroideryDate": "2024-12-10",
                        "monthsDormant": 18,
                        "bountyIfWon": 50,
                        "quarterToDateRevenue": 0,
                        "alreadyReactivated": false
                    },
                    {
                        "idCustomer": "3815",
                        "company": "Architectural Woods, L.P.",
                        "tier": "BRONZE '26-TANEISHA",
                        "lifetimeEmbroidery": 47643,
                        "embroideryOrders": 9,
                        "lastEmbroideryDate": "2024-06-05",
                        "monthsDormant": 24,
                        "bountyIfWon": 50,
                        "quarterToDateRevenue": 0,
                        "alreadyReactivated": false
                    },
                    {
                        "idCustomer": "12472",
                        "company": "Utility Trailer Sales of WA",
                        "tier": "BRONZE '26-TANEISHA",
                        "lifetimeEmbroidery": 44078.4,
                        "embroideryOrders": 44,
                        "lastEmbroideryDate": "2025-03-06",
                        "monthsDormant": 15,
                        "bountyIfWon": 50,
                        "quarterToDateRevenue": 0,
                        "alreadyReactivated": false
                    },
                    {
                        "idCustomer": "7466",
                        "company": "Fountainhead Development",
                        "tier": "SILVER '26-TANEISHA",
                        "lifetimeEmbroidery": 36108.5,
                        "embroideryOrders": 8,
                        "lastEmbroideryDate": "2024-11-05",
                        "monthsDormant": 19,
                        "bountyIfWon": 50,
                        "quarterToDateRevenue": 0,
                        "alreadyReactivated": false
                    },
                    {
                        "idCustomer": "123",
                        "company": "Fugate Ford",
                        "tier": "GOLD '26- TANEISHA",
                        "lifetimeEmbroidery": 33463.7,
                        "embroideryOrders": 15,
                        "lastEmbroideryDate": "2024-11-05",
                        "monthsDormant": 19,
                        "bountyIfWon": 50,
                        "quarterToDateRevenue": 0,
                        "alreadyReactivated": false
                    },
                    {
                        "idCustomer": "11833",
                        "company": "Gray Lumber",
                        "tier": "SILVER '26-TANEISHA",
                        "lifetimeEmbroidery": 23802,
                        "embroideryOrders": 11,
                        "lastEmbroideryDate": "2023-11-13",
                        "monthsDormant": 31,
                        "bountyIfWon": 50,
                        "quarterToDateRevenue": 0,
                        "alreadyReactivated": false
                    },
                    {
                        "idCustomer": "5144",
                        "company": "The Henson Company Inc.",
                        "tier": "SILVER '26-TANEISHA",
                        "lifetimeEmbroidery": 23044.5,
                        "embroideryOrders": 4,
                        "lastEmbroideryDate": "2024-12-20",
                        "monthsDormant": 18,
                        "bountyIfWon": 50,
                        "quarterToDateRevenue": 0,
                        "alreadyReactivated": false
                    },
                    {
                        "idCustomer": "416",
                        "company": "Waste Connections (Murrey Disposal)",
                        "tier": "SILVER '26-TANEISHA",
                        "lifetimeEmbroidery": 22604.69,
                        "embroideryOrders": 29,
                        "lastEmbroideryDate": "2024-06-25",
                        "monthsDormant": 24,
                        "bountyIfWon": 50,
                        "quarterToDateRevenue": 0,
                        "alreadyReactivated": false
                    },
                    {
                        "idCustomer": "12078",
                        "company": "Alpenrose Dairy",
                        "tier": "Win Back '26 TANEISHA",
                        "lifetimeEmbroidery": 20435.5,
                        "embroideryOrders": 19,
                        "lastEmbroideryDate": "2024-08-16",
                        "monthsDormant": 22,
                        "bountyIfWon": 50,
                        "quarterToDateRevenue": 0,
                        "alreadyReactivated": false
                    },
                    {
                        "idCustomer": "12309",
                        "company": "Sterling Septic & Plumbing, LLC",
                        "tier": "SILVER '26-TANEISHA",
                        "lifetimeEmbroidery": 19965.45,
                        "embroideryOrders": 17,
                        "lastEmbroideryDate": "2025-05-14",
                        "monthsDormant": 13,
                        "bountyIfWon": 50,
                        "quarterToDateRevenue": 0,
                        "alreadyReactivated": false
                    },
                    {
                        "idCustomer": "10887",
                        "company": "Designed Groundwater Services",
                        "tier": "SILVER '26-TANEISHA",
                        "lifetimeEmbroidery": 18668.34,
                        "embroideryOrders": 15,
                        "lastEmbroideryDate": "2024-10-31",
                        "monthsDormant": 19,
                        "bountyIfWon": 50,
                        "quarterToDateRevenue": 0,
                        "alreadyReactivated": false
                    },
                    {
                        "idCustomer": "3163",
                        "company": "Pierce County Noxious Weed Control",
                        "tier": "SILVER '26-TANEISHA",
                        "lifetimeEmbroidery": 18116,
                        "embroideryOrders": 6,
                        "lastEmbroideryDate": "2024-05-22",
                        "monthsDormant": 25,
                        "bountyIfWon": 50,
                        "quarterToDateRevenue": 0,
                        "alreadyReactivated": false
                    },
                    {
                        "idCustomer": "1438",
                        "company": "Takehara Landscape",
                        "tier": "GOLD '26- TANEISHA",
                        "lifetimeEmbroidery": 13836.2,
                        "embroideryOrders": 8,
                        "lastEmbroideryDate": "2024-12-02",
                        "monthsDormant": 18,
                        "bountyIfWon": 50,
                        "quarterToDateRevenue": 0,
                        "alreadyReactivated": false
                    },
                    {
                        "idCustomer": "11454",
                        "company": "Swire Coca-Cola- Bellevue",
                        "tier": "SILVER '26-TANEISHA",
                        "lifetimeEmbroidery": 13220.5,
                        "embroideryOrders": 5,
                        "lastEmbroideryDate": "2024-04-17",
                        "monthsDormant": 26,
                        "bountyIfWon": 50,
                        "quarterToDateRevenue": 0,
                        "alreadyReactivated": false
                    },
                    {
                        "idCustomer": "11915",
                        "company": "Flagstone Construction LLC",
                        "tier": "BRONZE '26-TANEISHA",
                        "lifetimeEmbroidery": 12355.74,
                        "embroideryOrders": 11,
                        "lastEmbroideryDate": "2023-12-21",
                        "monthsDormant": 30,
                        "bountyIfWon": 50,
                        "quarterToDateRevenue": 0,
                        "alreadyReactivated": false
                    },
                    {
                        "idCustomer": "9646",
                        "company": "Fluke Metal Products",
                        "tier": "SILVER '26-TANEISHA",
                        "lifetimeEmbroidery": 12282.2,
                        "embroideryOrders": 2,
                        "lastEmbroideryDate": "2024-01-12",
                        "monthsDormant": 29,
                        "bountyIfWon": 50,
                        "quarterToDateRevenue": 0,
                        "alreadyReactivated": false
                    },
                    {
                        "idCustomer": "10611",
                        "company": "The Truck Shop",
                        "tier": "SILVER '26-TANEISHA",
                        "lifetimeEmbroidery": 11775,
                        "embroideryOrders": 7,
                        "lastEmbroideryDate": "2023-08-30",
                        "monthsDormant": 34,
                        "bountyIfWon": 50,
                        "quarterToDateRevenue": 0,
                        "alreadyReactivated": false
                    },
                    {
                        "idCustomer": "10687",
                        "company": "McKee Enterprises",
                        "tier": "Win Back '26 TANEISHA",
                        "lifetimeEmbroidery": 11471.15,
                        "embroideryOrders": 8,
                        "lastEmbroideryDate": "2022-09-21",
                        "monthsDormant": 45,
                        "bountyIfWon": 50,
                        "quarterToDateRevenue": 0,
                        "alreadyReactivated": false
                    },
                    {
                        "idCustomer": "11021",
                        "company": "Full Tilt Fabrication LLC",
                        "tier": "SILVER '26-TANEISHA",
                        "lifetimeEmbroidery": 11405.4,
                        "embroideryOrders": 11,
                        "lastEmbroideryDate": "2024-03-12",
                        "monthsDormant": 27,
                        "bountyIfWon": 50,
                        "quarterToDateRevenue": 0,
                        "alreadyReactivated": false
                    },
                    {
                        "idCustomer": "2575",
                        "company": "Northwest Indian Fisheries Commission",
                        "tier": "BRONZE '26-TANEISHA",
                        "lifetimeEmbroidery": 11374,
                        "embroideryOrders": 7,
                        "lastEmbroideryDate": "2025-05-14",
                        "monthsDormant": 13,
                        "bountyIfWon": 50,
                        "quarterToDateRevenue": 0,
                        "alreadyReactivated": false
                    },
                    {
                        "idCustomer": "3238",
                        "company": "KM Resorts of America",
                        "tier": "SILVER '26-TANEISHA",
                        "lifetimeEmbroidery": 11343.19,
                        "embroideryOrders": 6,
                        "lastEmbroideryDate": "2025-04-22",
                        "monthsDormant": 14,
                        "bountyIfWon": 50,
                        "quarterToDateRevenue": 0,
                        "alreadyReactivated": false
                    },
                    {
                        "idCustomer": "10282",
                        "company": "Commercial Fence Corporation",
                        "tier": "SILVER '26-TANEISHA",
                        "lifetimeEmbroidery": 10408.6,
                        "embroideryOrders": 6,
                        "lastEmbroideryDate": "2024-11-21",
                        "monthsDormant": 19,
                        "bountyIfWon": 50,
                        "quarterToDateRevenue": 0,
                        "alreadyReactivated": false
                    },
                    {
                        "idCustomer": "9701",
                        "company": "CondoCare",
                        "tier": "GOLD '26- TANEISHA",
                        "lifetimeEmbroidery": 9912,
                        "embroideryOrders": 7,
                        "lastEmbroideryDate": "2025-06-09",
                        "monthsDormant": 12,
                        "bountyIfWon": 50,
                        "quarterToDateRevenue": 0,
                        "alreadyReactivated": false
                    },
                    {
                        "idCustomer": "8651",
                        "company": "Roto-Rooter Services Co",
                        "tier": "GOLD '26- TANEISHA",
                        "lifetimeEmbroidery": 9561.01,
                        "embroideryOrders": 29,
                        "lastEmbroideryDate": "2024-10-07",
                        "monthsDormant": 20,
                        "bountyIfWon": 50,
                        "quarterToDateRevenue": 0,
                        "alreadyReactivated": false
                    },
                    {
                        "idCustomer": "12320",
                        "company": "Accessibath, LLC",
                        "tier": "Win Back '26 TANEISHA",
                        "lifetimeEmbroidery": 9244.99,
                        "embroideryOrders": 21,
                        "lastEmbroideryDate": "2024-06-10",
                        "monthsDormant": 24,
                        "bountyIfWon": 50,
                        "quarterToDateRevenue": 0,
                        "alreadyReactivated": false
                    },
                    {
                        "idCustomer": "12615",
                        "company": "East Bay Structural & Termite Co",
                        "tier": "SILVER '26-TANEISHA",
                        "lifetimeEmbroidery": 9196,
                        "embroideryOrders": 2,
                        "lastEmbroideryDate": "2024-12-10",
                        "monthsDormant": 18,
                        "bountyIfWon": 50,
                        "quarterToDateRevenue": 0,
                        "alreadyReactivated": false
                    },
                    {
                        "idCustomer": "3057",
                        "company": "Alaska Premier Charters",
                        "tier": "House-2026",
                        "lifetimeEmbroidery": 9187.23,
                        "embroideryOrders": 5,
                        "lastEmbroideryDate": "2007-02-19",
                        "monthsDormant": 232,
                        "bountyIfWon": 50,
                        "quarterToDateRevenue": 0,
                        "alreadyReactivated": false
                    },
                    {
                        "idCustomer": "13073",
                        "company": "UW Dept. Of Emergency Medicine",
                        "tier": "SILVER '26-TANEISHA",
                        "lifetimeEmbroidery": 9104.5,
                        "embroideryOrders": 1,
                        "lastEmbroideryDate": "2024-09-10",
                        "monthsDormant": 21,
                        "bountyIfWon": 50,
                        "quarterToDateRevenue": 0,
                        "alreadyReactivated": false
                    },
                    {
                        "idCustomer": "11165",
                        "company": "Commercial Technician Services",
                        "tier": "SILVER '26-TANEISHA",
                        "lifetimeEmbroidery": 9049.55,
                        "embroideryOrders": 12,
                        "lastEmbroideryDate": "2024-12-19",
                        "monthsDormant": 18,
                        "bountyIfWon": 50,
                        "quarterToDateRevenue": 0,
                        "alreadyReactivated": false
                    }
                ]
            }
        }
    };

    function ok(body) {
        return Promise.resolve({ ok: true, status: 200, json: function () { return Promise.resolve(body); } });
    }

    var realFetch = window.fetch.bind(window);
    window.fetch = function (url, opts) {
        var u = String(url);
        if (u.indexOf('/embroidery-bonus/dormant') !== -1) return ok(Object.assign({ success: true }, DORMANT));
        // /team mirrors production: the server forces scope=team and blanks `reps`, so the
        // shared staff dashboard can never receive per-rep compensation. Keeping that shape
        // here means the harness fails if the strip ever starts reading rep dollars.
        if (u.indexOf('/embroidery-bonus/team') !== -1) {
            return ok(Object.assign({ success: true }, BONUS, { reps: {}, scope: 'team' }));
        }
        if (u.indexOf('/embroidery-bonus') !== -1) return ok(Object.assign({ success: true }, BONUS));
        console.warn('[stub] unstubbed fetch:', u);
        return realFetch(url, opts);
    };
})();
