/**
 * test-api-usage-stub.js — fetch stub + fixtures for the API Usage harness.
 *
 * ⚠️ RENDER harness, NEVER a CONTRACT harness. It replaces window.fetch wholesale,
 * so it CANNOT detect an unregistered route, a changed response shape or a broken
 * auth gate — a page can render perfectly here while 404ing in production (that
 * exact failure hid a dead ae-mission-control route for a week, 2026-07-26).
 * Route registration is proven separately with a live probe:
 *   curl -o /dev/null -w '%{http_code}' localhost:3010/api/crm-proxy/admin/usage
 *   401/403 = registered · 404 = NOT registered (check against a fake path too).
 *
 * Scenarios via ?scenario= :
 *   rollup (default) — healthy rollup-backed period, over budget, thumbnail table hot
 *   dyno             — no rollup table: single-dyno LOWER BOUND labelling
 *   insufficient     — dyno restarted minutes ago: refuses to project
 *   error            — both endpoints fail: error banner + em-dashes, never zeros
 */
(function () {
    'use strict';

    var scenario = new URLSearchParams(location.search).get('scenario') || 'rollup';

    var TABLES = [
        { table: 'Shopworks_Thumbnail_Report', count: 4032 },
        { table: 'Sanmar_Bulk_251816_Feb2024', count: 3810 },
        { table: 'ORDER_ODBC', count: 1120 },
        { table: 'Supacolor_Jobs', count: 640 },
        { table: 'ArtRequests', count: 410 },
        { table: '__oauth_token__', count: 96 },
        { table: 'Quote_Sessions', count: 48 }
    ];

    var ENDPOINTS = [
        { endpoint: '/tables/Shopworks_Thumbnail_Report/records', count: 4032 },
        { endpoint: '/tables/Sanmar_Bulk_251816_Feb2024/records', count: 3810 },
        { endpoint: '/tables/ORDER_ODBC/records', count: 1120 },
        { endpoint: '/oauth/token', count: 96 }
    ];

    // 14 days of the real July shape: ~23K/day against a 16,667 budget.
    function byDay() {
        var out = {};
        for (var i = 0; i < 14; i++) {
            var d = new Date(Date.UTC(2026, 5, 27 + i)).toISOString().slice(0, 10);
            out[d] = i === 6 ? 67606 : 20000 + (i * 400);
        }
        return out;
    }

    var PERIOD = { startYmd: '2026-06-27', endYmd: '2026-07-26', daysInPeriod: 30, daysElapsed: 14 };

    function pacing() {
        if (scenario === 'insufficient') {
            return {
                mode: 'insufficient', period: PERIOD, budgetPerDay: 16667,
                periodToDate: 6, projected: null, monthlyLimit: 500000, percentOfLimit: null,
                estimatedOverageUsd: 0, shouldAlert: false, alertAtPercent: 90,
                note: 'Dyno restarted less than an hour ago — too little history to project a rate. ' +
                      'Not judging, and deliberately not alerting.',
                topTables: TABLES.slice(0, 3)
            };
        }
        if (scenario === 'dyno') {
            return {
                mode: 'dyno', period: PERIOD, budgetPerDay: 16667,
                periodToDate: 48210, projected: 690000, monthlyLimit: 500000, percentOfLimit: 138,
                estimatedOverageUsd: 380, shouldAlert: true, alertAtPercent: 90,
                rollupByDay: null, topTables: TABLES.slice(0, 3)
            };
        }
        return {
            mode: 'rollup', period: PERIOD, budgetPerDay: 16667,
            periodToDate: 322000, projected: 690000, monthlyLimit: 500000, percentOfLimit: 138,
            estimatedOverageUsd: 380, shouldAlert: true, alertAtPercent: 90,
            rollupByDay: byDay(), topTables: TABLES.slice(0, 3)
        };
    }

    var metrics = {
        totalCallsSinceStart: 10156,
        processUptimeHours: 6.4,
        callsPerHourSinceStart: 1587,
        callsByTable: TABLES,
        callsByEndpoint: ENDPOINTS,
        callsByMethod: { GET: 8740, PUT: 1102, POST: 288, DELETE: 26 }
    };

    var realFetch = window.fetch.bind(window);

    window.fetch = function (input) {
        var url = String((input && input.url) || input || '');

        if (url.indexOf('/api/crm-proxy/admin/') !== -1) {
            if (scenario === 'error') {
                return Promise.resolve(new Response(
                    JSON.stringify({ success: false, error: 'upstream unavailable' }),
                    { status: 502, headers: { 'Content-Type': 'application/json' } }
                ));
            }
            var body = url.indexOf('/admin/usage') !== -1
                ? { success: true, data: pacing() }
                : { success: true, data: metrics };
            return Promise.resolve(new Response(JSON.stringify(body), {
                status: 200, headers: { 'Content-Type': 'application/json' }
            }));
        }

        return realFetch(input, arguments[1]);
    };

    console.log('[test-api-usage-stub] scenario =', scenario);
})();
