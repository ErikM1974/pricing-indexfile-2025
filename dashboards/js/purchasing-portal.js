/* purchasing-portal.js — company-wide Purchasing Portal controller.
 *
 * Data: GET /api/crm-proxy/purchasing-portal (same-origin, any logged-in
 * staff) → the JotForm "Purchasing" form (requests the AEs send Bradley)
 * joined server-side to the ShopWorks PurchaseOrders mirror + ORDER_ODBC.
 * One flat table, client-side search + requester/status filters.
 * Failures are VISIBLE (DashPage.showError + in-table error row) — never a
 * silently empty portal.
 */
(function () {
    'use strict';

    var STATUS_LABEL = {
        sent: 'Sent to Bradley', ordered: 'Ordered', partial: 'Partially received',
        received: 'Received', invoiced: 'Invoiced', shipped: 'Shipped',
    };

    var state = { rows: [], data: null };

    function esc(v) {
        return String(v == null ? '' : v)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }
    function el(id) { return document.getElementById(id); }
    function fmtWhen(iso) {
        var s = String(iso == null ? '' : iso);
        var d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(s.slice(0, 10)) ? s.slice(0, 10) + 'T12:00:00' : s);
        if (isNaN(d.getTime())) return esc(s);
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
    function firstName(full) { return String(full || '').split(/\s+/)[0] || ''; }

    document.addEventListener('DOMContentLoaded', function () {
        el('pp-refresh').addEventListener('click', load);
        el('pp-search').addEventListener('input', renderTable);
        el('pp-filter-rep').addEventListener('change', renderTable);
        el('pp-filter-status').addEventListener('change', renderTable);
        load();
    });

    function load() {
        DashPage.hideError();
        el('pp-tbody').innerHTML = '<tr><td colspan="10" class="pp-empty dash-loading">Loading purchase requests…</td></tr>';
        fetch('/api/crm-proxy/purchasing-portal', { credentials: 'same-origin' }).then(function (resp) {
            if (!resp.ok) throw new Error('HTTP ' + resp.status);
            return resp.json();
        }).then(function (data) {
            state.data = data;
            // Flatten: one table row per work order on each request.
            state.rows = [];
            (data.items || []).forEach(function (m) {
                (m.orders || []).forEach(function (o) {
                    state.rows.push({
                        wo: o.orderNumber, company: o.company || '', status: o.status,
                        vendors: (o.vendors || []).join(', '),
                        orderedDate: o.orderedDate, receivedDate: o.receivedDate,
                        requestedBy: m.requestedBy || '', requestedByName: m.requestedByName || m.requestedBy || '',
                        submittedAt: m.submittedAt, orderType: m.orderType || '', bradleyPo: m.bradleyPo || '',
                    });
                });
            });
            renderStats(data);
            renderRepFilter();
            renderTable();
            var bits = ['Updated ' + new Date(data.generatedAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })];
            if (data.cacheHit) bits.push('cached (refreshes every 15 min)');
            bits.push('last ' + data.windowDays + ' days');
            el('pp-updated').textContent = bits.join(' · ');
        }).catch(function (err) {
            DashPage.showError('Could not load the purchasing feed: ' + err.message + ' — refresh to retry.');
            el('pp-tbody').innerHTML = '<tr><td colspan="10" class="pp-empty">Not loaded — ' + esc(err.message) + '</td></tr>';
        });
    }

    function renderStats(data) {
        var c = data.counts || {};
        el('pp-stat-total').textContent = data.submissionCount != null ? data.submissionCount : '—';
        el('pp-stat-sent').textContent = c.sent || 0;
        el('pp-stat-ordered').textContent = (c.ordered || 0) + (c.partial || 0);
        el('pp-stat-received').textContent = c.received || 0;
        el('pp-stat-done').textContent = (c.invoiced || 0) + (c.shipped || 0);
    }

    function renderRepFilter() {
        var sel = el('pp-filter-rep');
        var current = sel.value;
        var reps = {};
        state.rows.forEach(function (r) { if (r.requestedBy) reps[r.requestedBy] = r.requestedByName; });
        sel.innerHTML = '<option value="">All requesters</option>' + Object.keys(reps).sort().map(function (em) {
            return '<option value="' + esc(em) + '">' + esc(reps[em]) + '</option>';
        }).join('');
        sel.value = current;
    }

    function renderTable() {
        var q = el('pp-search').value.trim().toLowerCase();
        var repF = el('pp-filter-rep').value;
        var statusF = el('pp-filter-status').value;
        var rows = state.rows.filter(function (r) {
            if (repF && r.requestedBy !== repF) return false;
            if (statusF && r.status !== statusF) return false;
            if (q) {
                var hay = (r.wo + ' ' + r.company + ' ' + r.bradleyPo + ' ' + r.vendors + ' ' + r.requestedByName).toLowerCase();
                if (hay.indexOf(q) === -1) return false;
            }
            return true;
        });
        if (!rows.length) {
            el('pp-tbody').innerHTML = '<tr><td colspan="10" class="pp-empty">No purchase requests match.</td></tr>';
            return;
        }
        el('pp-tbody').innerHTML = rows.map(function (r) {
            return '<tr>' +
                '<td class="pp-wo">' + esc(r.wo) + '</td>' +
                '<td class="pp-company">' + esc(r.company || '—') + '</td>' +
                '<td>' + esc(firstName(r.requestedByName)) + '</td>' +
                '<td>' + fmtWhen(r.submittedAt) + '</td>' +
                '<td>' + esc(r.orderType || '—') + '</td>' +
                '<td>' + esc(r.bradleyPo || '—') + '</td>' +
                '<td>' + esc(r.vendors || '—') + '</td>' +
                '<td>' + (r.orderedDate ? fmtWhen(r.orderedDate) : '—') + '</td>' +
                '<td>' + (r.receivedDate ? fmtWhen(r.receivedDate) : '—') + '</td>' +
                '<td><span class="pp-chip pp-chip--' + esc(r.status) + '">' + esc(STATUS_LABEL[r.status] || r.status) + '</span></td>' +
                '</tr>';
        }).join('');
    }
})();
