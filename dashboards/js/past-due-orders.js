/**
 * past-due-orders.js — controller for dashboards/past-due-orders.html
 *
 * Every ShopWorks order that has missed its requested-ship date and is neither shipped
 * nor invoiced, grouped by sales rep. Not SanMar-specific: the SanMar Inbound board only
 * sees orders with freight arriving, which is a fraction of the shop. Blanks vendors on
 * this list include Logomark, Augusta, Richardson, Supacolor and "no PO raised yet".
 *
 * ⚠️ Same-origin fetch, NOT DashPage.fetchJson. fetchJson prefixes
 * APP_CONFIG.API.BASE_URL (the Heroku proxy), and this endpoint lives on THIS server:
 * /api/crm-proxy/ae-dashboard/due-dates-all is a requireStaff forwarder that attaches
 * the CRM secret server-side. Routing it through the proxy base would 401 — the proxy
 * side is secret-only and a browser cannot hold a secret.
 */
(function () {
    'use strict';

    var ENDPOINT = '/api/crm-proxy/ae-dashboard/due-dates-all';

    document.addEventListener('DOMContentLoaded', function () {
        var days = document.getElementById('pdo-days');
        var refresh = document.getElementById('pdo-refresh');
        var print = document.getElementById('pdo-print');
        if (days) days.addEventListener('change', function () { load(false); });
        if (refresh) refresh.addEventListener('click', function () { load(true); });
        if (print) print.addEventListener('click', function () { window.print(); });
        load(false);
    });

    function selectedDays() {
        var el = document.getElementById('pdo-days');
        return (el && el.value) || '30';
    }

    async function load(force) {
        var root = document.getElementById('content-root');
        if (root) { root.className = 'dash-loading'; root.textContent = 'Loading…'; }
        try {
            var url = ENDPOINT + '?days=' + encodeURIComponent(selectedDays()) + (force ? '&refresh=1' : '');
            var resp = await fetch(url, { credentials: 'same-origin' });
            if (!resp.ok) throw new Error('HTTP ' + resp.status + ' ' + (resp.statusText || ''));
            var data = await resp.json();
            if (data.error) throw new Error(data.details || data.error);
            DashPage.hideError();
            render(data);
        } catch (err) {
            console.error('[past-due-orders] load failed:', err);
            // Never leave a stale or empty table looking like "nothing is late".
            if (root) { root.className = 'pdo-failed'; root.textContent = 'Could not load the past-due list — nothing is shown rather than something wrong.'; }
            setStats(null);
            DashPage.showError('Unable to load past-due orders (' + err.message + '). Nothing is displayed, because a blank list would read as "nothing is late". Try Refresh.');
        }
    }

    function setStats(d) {
        var noPO = d ? (d.late || []).filter(function (o) { return o.blanks === 'none'; }).length : null;
        put('stat-late', d ? d.counts.late : '—');
        put('stat-risk', d ? d.counts.atRisk : '—');
        put('stat-nopo', d ? noPO : '—');
        put('stat-ontrack', d ? d.counts.dueSoonOnTrack : '—');
    }

    function put(id, v) {
        var el = document.getElementById(id);
        if (el) el.textContent = (v === null || v === undefined) ? '—' : String(v);
    }

    function render(d) {
        setStats(d);
        var asOf = document.getElementById('pdo-asof');
        if (asOf) {
            asOf.textContent = 'as of ' + d.today + ' · ' + d.lookbackDays + '-day window · '
                + d.ordersScanned + ' orders scanned';
        }

        var root = document.getElementById('content-root');
        if (!root) return;
        root.className = '';

        var reps = (d.reps || []).filter(function (r) {
            var g = d.byRep[r];
            return g && (g.late.length || g.atRisk.length);
        });

        if (!reps.length) {
            root.innerHTML = '<p class="pdo-none"><i class="fas fa-check-circle"></i> '
                + 'Nothing past due or at risk in the last ' + esc(d.lookbackDays) + ' days.</p>';
            return;
        }

        var html = '';
        if (d.lateTruncated) {
            html += '<p class="pdo-trunc">Showing the first entries — ' + esc(d.lateTruncated)
                + ' more past-due orders were not returned.</p>';
        }
        reps.forEach(function (rep) {
            var g = d.byRep[rep];
            html += '<section class="pdo-rep">'
                + '<h3 class="pdo-rep-name">' + esc(rep)
                + '<span class="pdo-rep-count">' + g.late.length + ' past due'
                + (g.atRisk.length ? ' · ' + g.atRisk.length + ' at risk' : '') + '</span></h3>'
                + table(g.late.concat(g.atRisk))
                + '</section>';
        });
        root.innerHTML = html;
    }

    function table(rows) {
        if (!rows.length) return '';
        var h = '<div class="pdo-scroll"><table class="pdo-table"><thead><tr>'
            + '<th>WO</th><th>Customer</th><th>Due</th><th class="pdo-num">Late</th>'
            + '<th class="pdo-num">Value</th><th>Blanks</th><th>Type</th></tr></thead><tbody>';
        rows.sort(function (a, b) { return a.daysUntilDue - b.daysUntilDue; });
        rows.forEach(function (o) {
            var late = o.daysUntilDue < 0;
            h += '<tr class="' + (late ? 'pdo-late' : 'pdo-risk') + '">'
                + '<td class="pdo-wo">' + esc(o.idOrder) + '</td>'
                + '<td>' + esc(o.company) + '</td>'
                + '<td>' + esc(o.dueDate) + '</td>'
                + '<td class="pdo-num">' + (late
                    ? '<span class="pdo-badge">' + Math.abs(o.daysUntilDue) + 'd late</span>'
                    : (o.daysUntilDue === 0 ? 'today' : 'in ' + o.daysUntilDue + 'd')) + '</td>'
                + '<td class="pdo-num">' + money(o.subtotal) + '</td>'
                + '<td class="' + (o.blanks === 'none' ? 'pdo-nopo' : '') + '">' + blanks(o.blanks) + '</td>'
                + '<td>' + esc(o.orderType || '') + '</td>'
                + '</tr>';
        });
        return h + '</tbody></table></div>';
    }

    function blanks(b) {
        if (b === 'none') return 'no PO raised';
        if (b === 'ordered') return 'ordered, not in';
        if (b === 'partial') return 'partial';
        if (b === 'received') return 'received';
        return esc(b || '');
    }

    function money(n) {
        var v = Number(n) || 0;
        return v ? '$' + v.toLocaleString('en-US', { maximumFractionDigits: 0 }) : '';
    }

    function esc(s) {
        return String(s === null || s === undefined ? '' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }
})();
