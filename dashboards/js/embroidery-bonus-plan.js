/* =====================================================
   Q3 EMBROIDERY BONUS PLAN — figures come from the API, never the markup

   WHY THIS FILE EXISTS. Every number on this page used to be typed into the HTML.
   `Rep_Bonus_Config` is deliberately editable in Caspio with no deploy, so the first
   time a baseline moved (Taneisha $89,039 → $66,609, 2026-07-26) the handout began
   telling a rep a goal her own dashboard contradicted — in five places. Nothing
   warned: both surfaces rendered perfectly, they just disagreed. Same defect class
   as the four hand-maintained brand lists (LESSONS 2026-07-25): one fact, two homes,
   one of them hand-typed.

   🔴 THE HTML CONTAINS NO FIGURES — every slot ships as an em dash. That is
   deliberate and is the whole guarantee. A hardcoded "last known good" value would
   render silently during an outage and be indistinguishable from a live one, which
   is exactly Erik's #1 rule (a visible error beats a wrong number). If this fetch
   fails the dashes stay, a banner explains why, and the print stylesheet keeps the
   banner — so a handout printed during an outage is obviously broken rather than
   quietly stale.

   Reads /api/crm-proxy/embroidery-bonus/config, which is SAML-gated to the two AEs
   plus admin — the same audience as this page, so no extra exposure.
   ===================================================== */

(function () {
    'use strict';

    var ENDPOINT = '/api/crm-proxy/embroidery-bonus/config';

    // Display rows for the rate table. 100/115/130 are illustrative waypoints; the start
    // percentage is whatever Caspio says, so a change from 85% to 90% re-renders correctly.
    var WAYPOINTS = [100, 115, 130];

    function money0(n) {
        return '$' + Math.round(Number(n) || 0).toLocaleString('en-US');
    }
    // Half a point can be a fractional dollar if perPoint is ever odd, so this one keeps cents
    // when it needs to and drops them when it doesn't ($30, not $30.00).
    function moneyLoose(n) {
        var v = Number(n) || 0;
        return '$' + (v % 1 === 0 ? v.toLocaleString('en-US')
            : v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
    }
    function el(id) { return document.getElementById(id); }
    function txt(node, s) { if (node) node.textContent = s; }

    function setSlots(cfg) {
        var map = {
            bountyNew: money0(cfg.newAccountBounty),
            bountyReact: money0(cfg.reactivatedBounty),
            dormancy: String(cfg.dormancyMonths),
            minAccount: money0(cfg.minAccountRevenue),
            startPct: cfg.rateStartPct + '%',
            perPoint: money0(cfg.ratePerPoint),
            halfPoint: moneyLoose(cfg.ratePerPoint / 2),
        };
        var tiers = (cfg.teamKickers || []).slice().sort(function (a, b) { return a.target - b.target; });
        if (tiers[0]) { map.kick1Pay = money0(tiers[0].pay); map.kick1Target = money0(tiers[0].target); }
        if (tiers[1]) { map.kick2Pay = money0(tiers[1].pay); map.kick2Target = money0(tiers[1].target); }

        Object.keys(map).forEach(function (k) {
            var nodes = document.querySelectorAll('[data-ebp="' + k + '"]');
            for (var i = 0; i < nodes.length; i++) nodes[i].textContent = map[k];
        });
    }

    function renderTable(cfg) {
        var head = el('ebp-rate-head'), body = el('ebp-rate-body'), table = el('ebp-rate-table');
        if (!head || !body || !table) return;

        // Sorted by name so column order is stable. Relying on object key order would tie the
        // handout's layout to Caspio row order — a re-import would silently swap the columns.
        var reps = Object.keys(cfg.reps || {}).sort();
        if (!reps.length) throw new Error('config carried no reps');

        var startPct = Number(cfg.rateStartPct);
        var perPoint = Number(cfg.ratePerPoint);

        var pcts = [startPct].concat(WAYPOINTS.filter(function (p) { return p > startPct; }));

        head.innerHTML = '<th>Where you finish</th><th class="ebp-r">Rate pays</th>' +
            reps.map(function (name) {
                var first = name.split(' ')[0];
                return '<th class="ebp-r">' + first +
                    '<br><span class="ebp-th-sub">goal ' + money0(cfg.reps[name].baselineRevenue) + '</span></th>';
            }).join('');

        body.innerHTML = pcts.map(function (pct, idx) {
            var label = pct + '%';
            if (pct === startPct) label += ' — earning starts';
            else if (pct === 100) label += ' — at your goal';
            var pay = money0(Math.max(0, pct - startPct) * perPoint);
            var cells = reps.map(function (name) {
                return '<td class="ebp-r">' + money0(cfg.reps[name].baselineRevenue * pct / 100) + '</td>';
            }).join('');
            return '<tr' + (idx === pcts.length - 1 ? ' class="ebp-top"' : '') + '>' +
                '<td>' + label + '</td><td class="ebp-r ebp-pay">' + pay + '</td>' + cells + '</tr>';
        }).join('');

        table.hidden = false;
    }

    function fail(message) {
        var banner = el('ebp-config-status');
        txt(el('ebp-config-status-msg'), message);
        if (banner) banner.hidden = false;
        var table = el('ebp-rate-table');
        if (table) table.hidden = true;
    }

    function load() {
        fetch(ENDPOINT, { credentials: 'same-origin' })
            .then(function (resp) {
                if (!resp.ok) throw new Error('HTTP ' + resp.status);
                return resp.json();
            })
            .then(function (data) {
                var cfg = data && data.config;
                if (!cfg || data.success === false) throw new Error(data && data.error || 'no config returned');
                setSlots(cfg);
                renderTable(cfg);
                var banner = el('ebp-config-status');
                if (banner) banner.hidden = true;

                // The endpoint says when IT fell back to built-in defaults. Pass that through
                // rather than presenting a default as the approved plan.
                if (cfg.configSource === 'fallback') {
                    fail('These figures could not be read from the bonus configuration, so the ' +
                         'built-in defaults are shown. They may not match the approved plan — ' +
                         'check with Erik before relying on them.');
                    var t = el('ebp-rate-table');
                    if (t) t.hidden = false;      // the numbers ARE shown here, just flagged as unverified
                }
            })
            .catch(function (err) {
                // Never leave a figure on screen that might be wrong — the slots stay as dashes.
                fail('Could not load the current bonus figures. Nothing is shown rather than ' +
                     'something out of date — reload the page, and tell Erik if it keeps happening.');
                console.error('[bonus-plan] config load failed:', err);
            });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', load);
    } else {
        load();
    }
})();
