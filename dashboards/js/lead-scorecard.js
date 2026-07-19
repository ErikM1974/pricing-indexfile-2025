/**
 * lead-scorecard.js — controller for dashboards/lead-scorecard.html
 *
 * Per-rep lead-close report: how many leads each rep closed in a date range and
 * the order value those leads drove. Data comes from the SAME-ORIGIN session-
 * gated /api/crm-proxy/lead-scorecard forwarder (proxy buildScorecard):
 *   - "Order value" = orders placed AFTER the inquiry (attributed) — an
 *     established customer's back-catalog never inflates rep credit.
 *   - "Lifetime" = the customer's total with us (health context).
 *   - Conversion date = first order after the inquiry; the date range filters on it.
 * NO POLLING — loads on open + Apply. Every rendered value is escaped.
 */
(function () {
    'use strict';

    var state = { since: '', until: '', repFilter: '', data: null };

    function esc(v) {
        return String(v == null ? '' : v)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }
    function money(n) {
        var v = Number(n);
        if (!isFinite(v)) return '$0';
        return '$' + Math.round(v).toLocaleString('en-US');
    }
    function fmtDay(iso) {
        var s = String(iso || '');
        if (!/^\d{4}-\d{2}-\d{2}/.test(s)) return '—';
        var d = new Date(s.slice(0, 10) + 'T12:00:00');
        return isNaN(d.getTime()) ? esc(s) : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }
    function todayIso() {
        var d = new Date();
        return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    }
    function isoDaysAgo(n) {
        var d = new Date(); d.setDate(d.getDate() - n);
        return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    }

    document.addEventListener('DOMContentLoaded', function () {
        wire();
        applyPreset('taneisha-oct'); // default view: the "since Oct 2025" story
    });

    function wire() {
        var rf = document.getElementById('sc-refresh');
        if (rf) rf.addEventListener('click', load);
        document.getElementById('sc-apply').addEventListener('click', function () {
            state.since = document.getElementById('sc-since').value;
            state.until = document.getElementById('sc-until').value;
            load();
        });
        Array.prototype.forEach.call(document.querySelectorAll('.sc-preset'), function (b) {
            b.addEventListener('click', function () { applyPreset(b.getAttribute('data-preset')); });
        });
        document.getElementById('sc-rep-filter').addEventListener('change', function () {
            state.repFilter = this.value;
            renderLeads();
        });
    }

    function applyPreset(preset) {
        var since = '', until = '';
        if (preset === 'taneisha-oct') { since = '2025-10-01'; }
        else if (preset === 'ytd') { since = new Date().getFullYear() + '-01-01'; }
        else if (preset === '90d') { since = isoDaysAgo(90); }
        else if (preset === 'all') { since = ''; }
        state.since = since; state.until = until;
        document.getElementById('sc-since').value = since;
        document.getElementById('sc-until').value = until;
        Array.prototype.forEach.call(document.querySelectorAll('.sc-preset'), function (b) {
            b.classList.toggle('is-active', b.getAttribute('data-preset') === preset);
        });
        load();
    }

    function load() {
        DashPage.hideError();
        document.getElementById('rep-tbody').innerHTML = '<tr><td colspan="4" class="sc-empty dash-loading">Loading…</td></tr>';
        var params = new URLSearchParams();
        if (state.since) params.set('since', state.since);
        if (state.until) params.set('until', state.until);
        fetch('/api/crm-proxy/lead-scorecard?' + params.toString()).then(function (resp) {
            return resp.json().catch(function () { return {}; }).then(function (b) {
                if (!resp.ok) throw new Error((b && b.error) || ('HTTP ' + resp.status));
                return b;
            });
        }).then(function (body) {
            state.data = body;
            render();
        }).catch(function (err) {
            console.error('[scorecard] load failed:', err);
            DashPage.showError('Unable to load the scorecard (' + err.message + '). Refresh to retry.');
            document.getElementById('rep-tbody').innerHTML = '<tr><td colspan="4" class="sc-empty"><i class="fas fa-triangle-exclamation"></i> Unavailable.</td></tr>';
        });
    }

    function render() {
        var d = state.data || {};
        var t = d.totals || {};
        document.getElementById('stat-closed').textContent = t.leadsClosed != null ? t.leadsClosed : '0';
        document.getElementById('stat-sales').textContent = money(t.attributedSales);
        document.getElementById('stat-reps').textContent = t.repsWithCloses != null ? t.repsWithCloses : '0';
        document.getElementById('stat-range').textContent =
            (d.since ? fmtDay(d.since) : 'Start') + ' → ' + (d.until ? fmtDay(d.until) : 'Now');

        var reps = d.reps || [];
        var repBody = document.getElementById('rep-tbody');
        if (!reps.length) {
            repBody.innerHTML = '<tr><td colspan="4" class="sc-empty">No closes in this range.</td></tr>';
        } else {
            var max = reps[0].attributedSales || 1;
            repBody.innerHTML = reps.map(function (r) {
                var pct = Math.max(2, Math.round((r.attributedSales / max) * 100));
                return '<tr>' +
                    '<td><span class="sc-bar" style="width:' + pct + '%"></span><span class="sc-rep-name">' + esc(r.rep) + '</span></td>' +
                    '<td class="sc-num">' + r.leadsClosed + '</td>' +
                    '<td class="sc-num sc-strong">' + money(r.attributedSales) + '</td>' +
                    '<td class="sc-num sc-muted">' + money(r.lifetimeSales) + '</td>' +
                    '</tr>';
            }).join('');
        }

        // rep filter options
        var sel = document.getElementById('sc-rep-filter');
        var cur = sel.value;
        sel.innerHTML = '<option value="">All reps</option>' + reps.map(function (r) {
            return '<option value="' + esc(r.rep) + '">' + esc(r.rep) + '</option>';
        }).join('');
        sel.value = cur; if (sel.value !== cur) sel.value = '';
        renderLeads();
    }

    function renderLeads() {
        var leads = (state.data && state.data.leads) || [];
        if (state.repFilter) leads = leads.filter(function (l) { return l.rep === state.repFilter; });
        document.getElementById('leads-count').textContent = leads.length + ' lead' + (leads.length === 1 ? '' : 's');
        var body = document.getElementById('leads-tbody');
        if (!leads.length) {
            body.innerHTML = '<tr><td colspan="6" class="sc-empty">No closed leads in this range.</td></tr>';
            return;
        }
        body.innerHTML = leads.map(function (l) {
            var link = l.submissionId ? '/dashboards/lead.html#' + encodeURIComponent(l.submissionId) : '';
            var company = l.company || l.contact || l.submissionId || '—';
            return '<tr>' +
                '<td>' + (link ? '<a href="' + esc(link) + '">' + esc(company) + '</a>' : esc(company)) +
                    (l.custId ? ' <span class="sc-cust">#' + esc(l.custId) + '</span>' : '') + '</td>' +
                '<td>' + esc(l.rep) + '</td>' +
                '<td>' + fmtDay(l.inquiry) + '</td>' +
                '<td>' + fmtDay(l.conversionDate) + '</td>' +
                '<td class="sc-num sc-strong">' + money(l.attributed) + '</td>' +
                '<td class="sc-num sc-muted">' + money(l.lifetime) + '</td>' +
                '</tr>';
        }).join('');
    }
})();
