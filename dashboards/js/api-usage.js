/**
 * api-usage.js — controller for dashboards/api-usage.html
 *
 * Caspio Integrations-quota ATTRIBUTION. Answers the question Caspio's own
 * billing page cannot: which tables and endpoints are burning the 500,000
 * calls/period allowance. Built 2026-07-26 after a $358 overage that took hours
 * to attribute by hand.
 *
 * IT IS NOT A BILLING GAUGE. Caspio → Plan and billing → Usage remains the
 * authority on the billed total, and the page says so. Two reasons this matters:
 * the proxy's counters are per-dyno and reset when Heroku cycles a dyno, and the
 * hourly rollup can miss a dyno's final partial hour. Both make our number a
 * lower bound. Presenting a lower bound as authoritative is precisely the
 * mistake that let the overage run for 30 days.
 *
 * Requests go to /api/crm-proxy/admin/* on THIS origin, not the proxy directly —
 * the upstream routes are secret-gated and the browser must never hold the
 * secret. Those forwarders are requireCrmRole(['admin']).
 *
 * Rule 4: every failure surfaces in the error banner. Never render a zero or a
 * stale value in place of an error — a wrong "0" here reads as "we're fine".
 */
(function () {
    'use strict';

    var MONTHLY_LIMIT = 500000;

    document.addEventListener('DOMContentLoaded', function () {
        var refresh = document.getElementById('au-refresh');
        if (refresh) refresh.addEventListener('click', function () { load(); });
        load();
    });

    async function load() {
        setLoading();
        try {
            // Pacing first — it also tells us which data source we're on, which
            // changes how much the rest of the page should be trusted.
            var pacing = await getJson('/api/crm-proxy/admin/usage');
            var metrics = await getJson('/api/crm-proxy/admin/metrics?full=1');
            render(pacing.data || {}, (metrics.data) || {});
        } catch (err) {
            console.error('[api-usage] load failed:', err);
            showError(
                'Unable to load API usage: ' + (err.message || 'request failed') +
                '. Nothing below is current — check Caspio → Plan and billing → Usage directly.'
            );
            blankOut();
        }
    }

    /**
     * Surface an error without depending on DashPage having loaded.
     *
     * The error path must not itself require a script that might be the thing
     * that failed: if /shared_components/js/dash-page-helpers.js 404s, calling
     * DashPage.showError() throws inside the catch, the rejection goes unhandled
     * and the page sits on "Loading…" forever — an outage that looks like a slow
     * network. Falls back to writing the banner directly.
     */
    function showError(message) {
        if (window.DashPage && typeof window.DashPage.showError === 'function') {
            window.DashPage.showError(message);
            return;
        }
        var banner = document.querySelector('.dash-error-banner');
        var slot = document.querySelector('.dash-error-banner-message');
        if (slot) slot.textContent = message;
        // `show` is the class dash-shell.css keys the banner on (dash-shell.css:116).
        if (banner) banner.classList.add('show');
        else console.error('[api-usage]', message);
    }

    async function getJson(path) {
        // Same-origin: the app server injects the CRM secret and forwards.
        var resp = await fetch(path, { credentials: 'same-origin' });
        if (!resp.ok) {
            if (resp.status === 401 || resp.status === 403) {
                throw new Error('not authorised (admin only)');
            }
            throw new Error('HTTP ' + resp.status);
        }
        var body = await resp.json();
        if (body && body.success === false) {
            throw new Error(body.error || 'request failed');
        }
        return body;
    }

    /* ---------------- render ---------------- */

    function render(pacing, metrics) {
        renderScope(pacing, metrics);
        renderStats(pacing);
        renderMeter(pacing);
        renderAttribution('au-tables', metrics.callsByTable, 'table');
        renderAttribution('au-endpoints', metrics.callsByEndpoint, 'endpoint');
        renderMethods(metrics.callsByMethod);
        renderTrend(pacing);
    }

    function renderScope(pacing, metrics) {
        var el = document.getElementById('au-mode');
        if (!el) return;
        el.classList.remove('au-scope-mode--degraded');

        var uptime = metrics.processUptimeHours;
        var attribution = 'Attribution below is from one dyno, ' +
            (uptime != null ? uptime + 'h' : 'a partial window') + ' since its last restart.';

        if (pacing.mode === 'rollup') {
            el.textContent = 'Source: API_Usage_Daily rollup, summed across dynos — period totals are reliable. ' + attribution;
        } else if (pacing.mode === 'insufficient') {
            el.classList.add('au-scope-mode--degraded');
            el.textContent = 'This dyno restarted under an hour ago, so there is not enough history to project a rate yet. ' +
                'Set API_USAGE_ROLLUP_TABLE for figures that survive dyno cycling.';
        } else {
            el.classList.add('au-scope-mode--degraded');
            el.textContent = 'Source: a single dyno since its last restart — a LOWER BOUND, not the billed total. ' +
                'Set API_USAGE_ROLLUP_TABLE for a real period figure. ' + attribution;
        }

        if (pacing.rollupError) {
            el.classList.add('au-scope-mode--degraded');
            el.textContent += ' ⚠ Rollup read failed: ' + pacing.rollupError;
        }
    }

    function renderStats(p) {
        var period = p.period || {};
        text('au-projected', p.projected == null ? 'n/a' : num(p.projected));
        text('au-period-to-date', p.periodToDate == null ? '—' : num(p.periodToDate));
        text('au-budget', p.budgetPerDay == null ? '—' : num(p.budgetPerDay));
        text('au-overage', p.estimatedOverageUsd ? '$' + num(p.estimatedOverageUsd) : '$0');
        text('au-period-label', period.startYmd
            ? period.startYmd + ' → ' + period.endYmd + ' · day ' + period.daysElapsed + ' of ' + period.daysInPeriod
            : '');
    }

    function renderMeter(p) {
        var fill = document.getElementById('au-meter-fill');
        var caption = document.getElementById('au-meter-caption');
        if (!fill || !caption) return;

        if (p.percentOfLimit == null) {
            fill.style.width = '0%';
            fill.className = 'au-meter-fill';
            caption.textContent = p.note || 'Not enough data to project a period total yet.';
            return;
        }

        var pct = p.percentOfLimit;
        // Cap the visual at 110% so an extreme projection doesn't blow the layout;
        // the caption always states the true number.
        fill.style.width = Math.min(pct, 110) + '%';
        fill.className = 'au-meter-fill' +
            (pct >= 100 ? ' au-meter-fill--over' : pct >= 90 ? ' au-meter-fill--warn' : '');

        caption.textContent = pct >= 100
            ? 'Projected ' + num(p.projected) + ' — about ' + num(p.projected - MONTHLY_LIMIT) +
              ' over the 500,000 cap (~$' + num(p.estimatedOverageUsd) + ' at $0.002/call).'
            : 'Projected ' + num(p.projected) + ' of 500,000 (' + pct + '%). Alert fires at ' +
              (p.alertAtPercent || 90) + '%.';
    }

    function renderAttribution(elId, rows, kind) {
        var el = document.getElementById(elId);
        if (!el) return;
        el.classList.remove('dash-loading');

        if (!rows || !rows.length) {
            el.innerHTML = '<p class="au-empty">No calls recorded on this dyno yet.</p>';
            return;
        }

        var top = rows.slice(0, 12);
        var total = rows.reduce(function (s, r) { return s + r.count; }, 0);
        var max = top[0].count || 1;

        el.innerHTML = '<div class="au-rows">' + top.map(function (r) {
            var label = kind === 'table' ? r.table : r.endpoint;
            var share = total ? Math.round((r.count / total) * 100) : 0;
            // A single table over a fifth of all calls is the shape worth spotting —
            // Shopworks_Thumbnail_Report was ~25% when the overage was traced.
            var hot = share >= 20 ? ' au-row--hot' : '';
            return '<div class="au-row' + hot + '">' +
                '<span class="au-row-label" title="' + esc(label) + '">' + esc(label) + '</span>' +
                '<span class="au-row-count">' + num(r.count) + ' <small>(' + share + '%)</small></span>' +
                '<span class="au-row-share"><span style="width:' + Math.round((r.count / max) * 100) + '%"></span></span>' +
            '</div>';
        }).join('') + '</div>';
    }

    function renderMethods(byMethod) {
        var el = document.getElementById('au-methods');
        if (!el) return;
        el.classList.remove('dash-loading');

        var keys = byMethod ? Object.keys(byMethod) : [];
        if (!keys.length) {
            el.innerHTML = '<p class="au-empty">No calls recorded on this dyno yet.</p>';
            return;
        }
        el.innerHTML = '<div class="au-methods">' + keys.sort(function (a, b) {
            return byMethod[b] - byMethod[a];
        }).map(function (m) {
            return '<span class="au-method">' + esc(m) + ' <b>' + num(byMethod[m]) + '</b></span>';
        }).join('') + '</div>';
    }

    function renderTrend(p) {
        var el = document.getElementById('au-trend');
        var hint = document.getElementById('au-trend-hint');
        if (!el) return;
        el.classList.remove('dash-loading');

        var byDay = p.rollupByDay;
        if (!byDay || !Object.keys(byDay).length) {
            el.innerHTML = '<p class="au-empty">No daily history. This needs the ' +
                '<code>API_Usage_Daily</code> rollup table — without it, counts reset every time a dyno cycles.</p>';
            if (hint) hint.textContent = 'Requires the rollup table';
            return;
        }

        var days = Object.keys(byDay).sort();
        var budget = p.budgetPerDay || 0;
        var max = Math.max.apply(null, days.map(function (d) { return byDay[d]; }).concat([budget]));

        if (hint) hint.textContent = 'Red bars are days over the ' + num(budget) + '/day budget';

        el.innerHTML =
            '<div class="au-trend">' + days.map(function (d) {
                var v = byDay[d];
                var h = max ? Math.max(Math.round((v / max) * 100), 2) : 2;
                return '<div class="au-bar' + (budget && v > budget ? ' au-bar--over' : '') + '"' +
                    ' style="height:' + h + '%" title="' + esc(d) + ': ' + num(v) + ' calls"></div>';
            }).join('') + '</div>' +
            '<div class="au-trend-axis"><span>' + esc(days[0]) + '</span><span>' + esc(days[days.length - 1]) + '</span></div>';
    }

    /* ---------------- helpers ---------------- */

    function setLoading() {
        ['au-tables', 'au-endpoints', 'au-methods', 'au-trend'].forEach(function (id) {
            var el = document.getElementById(id);
            if (el) { el.classList.add('dash-loading'); el.textContent = 'Loading…'; }
        });
    }

    // On failure show em-dashes, never zeros — a zero reads as "no usage".
    function blankOut() {
        ['au-projected', 'au-period-to-date', 'au-budget', 'au-overage'].forEach(function (id) {
            text(id, '—');
        });
        ['au-tables', 'au-endpoints', 'au-methods', 'au-trend'].forEach(function (id) {
            var el = document.getElementById(id);
            if (el) { el.classList.remove('dash-loading'); el.innerHTML = '<p class="au-empty">Unavailable — see the error above.</p>'; }
        });
        var fill = document.getElementById('au-meter-fill');
        if (fill) { fill.style.width = '0%'; fill.className = 'au-meter-fill'; }
        text('au-meter-caption', 'Unavailable.');
    }

    function text(id, value) {
        var el = document.getElementById(id);
        if (el) el.textContent = value;
    }

    function num(n) {
        return Number(n || 0).toLocaleString();
    }

    function esc(str) {
        return String(str == null ? '' : str)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }
})();
