/* Fetch stub for the Embroidery Bonus Plan harness.
 *
 * The config payload is the REAL shape returned by /api/embroidery-bonus/config on
 * 2026-07-26 (configSource: caspio), so the harness renders what the live page renders.
 * Regenerate by curling the endpoint with x-crm-api-secret and pasting `config`.
 *
 * Scenario 2's baselines are deliberately the OLD pre-webstore numbers, because that is
 * what FALLBACK_CONFIG in the proxy actually holds when Caspio can't be read — the point
 * of the flag is that those numbers look perfectly plausible. */
(function () {
    'use strict';

    var LIVE = {
        program: 'EMB', quarter: 'Q3', year: 2026,
        dateStart: '2026-07-01', dateEnd: '2026-09-30',
        minAccountRevenue: 1000, dormancyMonths: 12,
        excludeOnlineStore: true,
        rateStartPct: 85, ratePerPoint: 60,
        newAccountBounty: 150, reactivatedBounty: 100,
        teamKickers: [{ target: 310000, pay: 500 }, { target: 340000, pay: 1000 }],
        reps: {
            'Nika Lao': { baselineRevenue: 104189 },
            'Taneisha Clark': { baselineRevenue: 66609 },
        },
        configSource: 'caspio',
    };

    function clone(o) { return JSON.parse(JSON.stringify(o)); }

    var scenario = 'ok';
    var realFetch = window.fetch;

    window.fetch = function (url) {
        if (String(url).indexOf('embroidery-bonus/config') === -1) {
            return realFetch.apply(this, arguments);
        }
        if (scenario === 'fail') return Promise.reject(new Error('network down'));
        if (scenario === 'http500') {
            return Promise.resolve(new Response('{"error":"boom"}', { status: 500 }));
        }
        var cfg = clone(LIVE);
        if (scenario === 'fallback') {
            cfg.configSource = 'fallback';
            cfg.reps['Nika Lao'].baselineRevenue = 235000;
            cfg.reps['Taneisha Clark'].baselineRevenue = 100000;
        }
        return Promise.resolve(new Response(JSON.stringify({ success: true, config: cfg }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }));
    };

    function slot(name) {
        var n = document.querySelector('[data-ebp="' + name + '"]');
        return n ? n.textContent.trim() : '(absent)';
    }

    function report() {
        var table = document.getElementById('ebp-rate-table');
        var banner = document.getElementById('ebp-config-status');
        var rows = [].slice.call(document.querySelectorAll('#ebp-rate-body tr'))
            .map(function (tr) {
                return [].slice.call(tr.cells).map(function (c) { return c.textContent.trim(); }).join(' | ');
            });
        var head = [].slice.call(document.querySelectorAll('#ebp-rate-head th'))
            .map(function (th) { return th.textContent.replace(/\s+/g, ' ').trim(); }).join(' | ');

        var dashes = ['bountyNew', 'bountyReact', 'startPct', 'perPoint', 'halfPoint',
            'minAccount', 'dormancy', 'kick1Pay', 'kick1Target', 'kick2Pay', 'kick2Target']
            .filter(function (s) { return slot(s) === '—'; });

        document.getElementById('h-result').textContent = [
            'scenario:       ' + scenario,
            'table visible:  ' + (table && !table.hidden),
            'banner visible: ' + (banner && !banner.hidden),
            'banner text:    ' + (document.getElementById('ebp-config-status-msg').textContent || '(none)'),
            'slots still --: ' + (dashes.length ? dashes.join(', ') : 'none'),
            'bounties:       ' + slot('bountyNew') + ' new / ' + slot('bountyReact') + ' react',
            'rate:           ' + slot('perPoint') + ' per 1% above ' + slot('startPct')
                              + ' (half point ' + slot('halfPoint') + ')',
            'kicker:         ' + slot('kick1Pay') + ' at ' + slot('kick1Target')
                              + '  |  ' + slot('kick2Pay') + ' at ' + slot('kick2Target'),
            'head:           ' + (head || '(empty)'),
            'rows:',
        ].concat(rows.map(function (r) { return '  ' + r; })).join('\n');
    }

    function reset() {
        var nodes = document.querySelectorAll('[data-ebp]');
        for (var i = 0; i < nodes.length; i++) nodes[i].textContent = '—';
        document.getElementById('ebp-rate-table').hidden = true;
        document.getElementById('ebp-rate-body').innerHTML = '';
        document.getElementById('ebp-rate-head').innerHTML = '';
        document.getElementById('ebp-config-status').hidden = true;
        document.getElementById('ebp-config-status-msg').textContent = '';
    }

    function run(name) {
        scenario = name;
        reset();
        // Re-trigger the page script's loader by re-dispatching what it listens for is brittle;
        // it exposes nothing, so re-inject the tag. Same file, fresh execution.
        var s = document.createElement('script');
        s.src = '/dashboards/js/embroidery-bonus-plan.js?t=' + Math.random();
        s.onload = function () { setTimeout(report, 120); };
        document.body.appendChild(s);
    }

    window.addEventListener('DOMContentLoaded', function () {
        document.getElementById('h-ok').onclick = function () { run('ok'); };
        document.getElementById('h-fallback').onclick = function () { run('fallback'); };
        document.getElementById('h-fail').onclick = function () { run('fail'); };
        document.getElementById('h-500').onclick = function () { run('http500'); };
        setTimeout(report, 200);
    });
})();
