/* purchasing-portal.js — company-wide Purchasing Portal controller.
 *
 * Data: GET /api/crm-proxy/purchasing-portal (same-origin, any logged-in
 * staff) → the JotForm "Purchasing" form (requests the AEs send Bradley)
 * joined server-side to the ShopWorks PurchaseOrders mirror + ORDER_ODBC.
 * One flat table, client-side search + requester/status filters.
 * Failures are VISIBLE (DashPage.showError + in-table error row) — never a
 * silently empty portal.
 *
 * 2026-09-05 review: the feed's `truncated` count is shown (it was ignored —
 * 25 of 275 requests were missing with no notice); open work is the default
 * view with a "Show finished" toggle; the stat tiles filter the table; each
 * row links to its JotForm submission; a request→PO turnaround tile; Refresh
 * passes ?refresh=1 through to the proxy; vendors are trimmed/deduped; the
 * invoice buttons carry aria-labels; the board re-reads every 5 minutes while
 * the tab is visible.
 */
(function () {
    'use strict';

    var STATUS_LABEL = {
        sent: 'Sent to Bradley', ordered: 'Ordered', partial: 'Partially received',
        received: 'Received', invoiced: 'Invoiced', shipped: 'Shipped',
    };
    var FINISHED = { invoiced: true, shipped: true };
    var JOTFORM_SUBMISSION = 'https://www.jotform.com/submission/';
    var REFRESH_INTERVAL_MS = 5 * 60 * 1000;

    var state = { rows: [], data: null, loading: false, loadedAt: 0, tile: '' };

    function esc(v) {
        return String(v == null ? '' : v)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }
    function el(id) { return document.getElementById(id); }
    function put(id, text) { var n = el(id); if (n) n.textContent = text; }
    function fmtWhen(iso) {
        var s = String(iso == null ? '' : iso);
        var d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(s.slice(0, 10)) ? s.slice(0, 10) + 'T12:00:00' : s);
        if (isNaN(d.getTime())) return esc(s);
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
    function clockTime(d) {
        return new Date(d || Date.now()).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    }
    function firstName(full) { return String(full || '').split(/\s+/)[0] || ''; }

    // JotForm vendor strings arrive with stray whitespace / carriage returns
    // ("JDS Industries, Inc. \r") and near-duplicates — normalise before display
    // and search so "SANMAR" is one vendor, not three.
    function cleanVendors(list) {
        var seen = {}, out = [];
        (list || []).forEach(function (v) {
            var s = String(v || '').replace(/\s+/g, ' ').trim();
            if (!s) return;
            var key = s.toLowerCase();
            if (seen[key]) return;
            seen[key] = true;
            out.push(s);
        });
        return out;
    }

    document.addEventListener('DOMContentLoaded', function () {
        el('pp-refresh').addEventListener('click', function () { load(true); });
        el('pp-search').addEventListener('input', renderTable);
        el('pp-filter-rep').addEventListener('change', renderTable);
        el('pp-filter-status').addEventListener('change', function () { state.tile = ''; renderTable(); });
        var toggle = el('pp-show-finished');
        if (toggle) toggle.addEventListener('change', renderTable);
        // Stat tiles filter the table. `done` = both finished statuses (and turns
        // the finished toggle on, or the click would show an empty table).
        Array.prototype.forEach.call(document.querySelectorAll('.pp-tile[data-filter]'), function (btn) {
            btn.addEventListener('click', function () { applyTile(btn.getAttribute('data-filter') || ''); });
        });
        load(false);

        setInterval(function () {
            if (document.visibilityState === 'visible' && !state.loading) load(false);
        }, REFRESH_INTERVAL_MS);
        document.addEventListener('visibilitychange', function () {
            if (document.visibilityState === 'visible' && !state.loading
                && Date.now() - state.loadedAt >= REFRESH_INTERVAL_MS) load(false);
        });
    });

    function applyTile(key) {
        state.tile = key;
        var status = el('pp-filter-status');
        var toggle = el('pp-show-finished');
        if (key === 'done') {
            if (status) status.value = '';
            if (toggle) toggle.checked = true;
        } else {
            if (status) status.value = key;           // '' clears; sent/ordered/received
            if (toggle && key && !FINISHED[key]) toggle.checked = false;
        }
        renderTable();
    }

    function load(force) {
        if (state.loading) return;
        state.loading = true;
        DashPage.hideError();
        var tbody = el('pp-tbody');
        if (!state.rows.length) {
            tbody.innerHTML = '<tr><td colspan="11" class="pp-empty dash-loading">Loading purchase requests…</td></tr>';
        }
        var url = '/api/crm-proxy/purchasing-portal' + (force ? '?refresh=1' : '');
        fetch(url, { credentials: 'same-origin' }).then(function (resp) {
            if (!resp.ok) throw new Error('HTTP ' + resp.status);
            return resp.json();
        }).then(function (data) {
            if (data && data.error) throw new Error(data.details || data.error);
            state.data = data;
            state.loadedAt = Date.now();
            // Flatten: one table row per work order on each request.
            state.rows = [];
            (data.items || []).forEach(function (m) {
                (m.orders || []).forEach(function (o) {
                    state.rows.push({
                        wo: o.orderNumber, company: o.company || '', status: o.status,
                        vendors: cleanVendors(o.vendors).join(', '),
                        sanmarPos: o.sanmarPos || [],
                        orderedDate: o.orderedDate, receivedDate: o.receivedDate,
                        requestedBy: m.requestedBy || '', requestedByName: m.requestedByName || m.requestedBy || '',
                        submittedAt: m.submittedAt, orderType: m.orderType || '', bradleyPo: m.bradleyPo || '',
                        submissionId: m.submissionId || '',
                    });
                });
            });
            renderStats(data);
            renderTurnaround();
            renderTruncation(data);
            renderRepFilter();
            renderTable();
            var bits = ['Feed built ' + clockTime(data.generatedAt)];
            if (data.cacheHit) bits.push('cached up to 15 min — Refresh rebuilds it');
            bits.push('last ' + data.windowDays + ' days');
            bits.push('loaded ' + clockTime());
            put('pp-updated', bits.join(' · '));
        }).catch(function (err) {
            DashPage.showError('Could not load the purchasing feed: ' + err.message + ' — refresh to retry.');
            // Never leave the previous list looking current.
            state.rows = [];
            state.data = null;
            renderStats(null);
            tbody.innerHTML = '<tr><td colspan="11" class="pp-empty">Not loaded — ' + esc(err.message) + '</td></tr>';
            var tr = el('pp-trunc'); if (tr) tr.hidden = true;
            put('pp-shown', '');
        }).then(function () { state.loading = false; });
    }

    function renderStats(data) {
        if (!data) {
            ['pp-stat-total', 'pp-stat-sent', 'pp-stat-ordered', 'pp-stat-received', 'pp-stat-done', 'pp-stat-turnaround']
                .forEach(function (id) { put(id, '—'); });
            ['pp-stat-total-sub', 'pp-stat-sent-sub', 'pp-stat-ordered-sub', 'pp-stat-received-sub', 'pp-stat-done-sub', 'pp-stat-turnaround-sub']
                .forEach(function (id) { put(id, ''); });
            return;
        }
        var c = data.counts || {};
        put('pp-stat-total', data.submissionCount != null ? data.submissionCount : '—');
        put('pp-stat-total-sub', state.rows.length + ' work order' + (state.rows.length === 1 ? '' : 's'));
        put('pp-stat-sent', c.sent || 0);
        put('pp-stat-sent-sub', (c.sent || 0) ? 'Bradley has not ordered yet' : 'Bradley is caught up');
        // The Ordered count folds in partially-received; say so instead of hiding it.
        put('pp-stat-ordered', (c.ordered || 0) + (c.partial || 0));
        put('pp-stat-ordered-sub', (c.partial || 0) ? (c.partial + ' partially received') : 'none partially received');
        put('pp-stat-received', c.received || 0);
        put('pp-stat-received-sub', 'blanks in, job not invoiced');
        put('pp-stat-done', (c.invoiced || 0) + (c.shipped || 0));
        put('pp-stat-done-sub', (c.invoiced || 0) + ' invoiced · ' + (c.shipped || 0) + ' shipped');
    }

    // Bradley's turnaround from the rows themselves: request submitted → PO issued.
    // orderedDate is a calendar day, so it is read as end-of-business (5 PM) and a
    // same-day PO counts as < 24 h. Median + same-day share; nothing typed.
    function renderTurnaround() {
        var hrs = [];
        state.rows.forEach(function (r) {
            if (!r.orderedDate || !r.submittedAt) return;
            var ordered = String(r.orderedDate);
            var od = new Date(/^\d{4}-\d{2}-\d{2}$/.test(ordered.slice(0, 10)) ? ordered.slice(0, 10) + 'T17:00:00' : ordered);
            var sd = new Date(String(r.submittedAt).replace(' ', 'T'));
            if (isNaN(od.getTime()) || isNaN(sd.getTime())) return;
            hrs.push(Math.max(0, (od - sd) / 36e5));
        });
        if (!hrs.length) { put('pp-stat-turnaround', '—'); put('pp-stat-turnaround-sub', 'no ordered requests yet'); return; }
        hrs.sort(function (a, b) { return a - b; });
        var median = hrs[Math.floor(hrs.length / 2)];
        var sameDay = hrs.filter(function (h) { return h < 24; }).length;
        put('pp-stat-turnaround', median < 48 ? median.toFixed(1) + ' h' : (median / 24).toFixed(1) + ' d');
        put('pp-stat-turnaround-sub', sameDay + ' of ' + hrs.length + ' ordered the same day');
    }

    // The feed caps how many submissions it returns; anything past the cap is
    // counted in `truncated`. Say it — a table that silently drops 25 requests
    // reads as complete.
    function renderTruncation(data) {
        var box = el('pp-trunc');
        if (!box) return;
        var n = Number(data && data.truncated) || 0;
        if (!n) { box.hidden = true; box.textContent = ''; return; }
        box.innerHTML = '<i class="fas fa-triangle-exclamation" aria-hidden="true"></i> '
            + esc(n) + ' older request' + (n === 1 ? '' : 's') + ' in the ' + esc(data.windowDays)
            + '-day window ' + (n === 1 ? 'is' : 'are') + ' not in this table — the feed returns the newest '
            + esc((data.items || []).length) + '. The "Requests" tile counts all ' + esc(data.submissionCount) + '.';
        box.hidden = false;
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
        var toggle = el('pp-show-finished');
        var showFinished = toggle ? toggle.checked : true;
        // An explicit finished status in the dropdown means the user wants those rows.
        if (FINISHED[statusF]) showFinished = true;
        var finishedTotal = state.rows.filter(function (r) { return FINISHED[r.status]; }).length;
        put('pp-finished-n', finishedTotal ? '(' + finishedTotal + ')' : '');

        var rows = state.rows.filter(function (r) {
            if (!showFinished && FINISHED[r.status]) return false;
            if (state.tile === 'done' && !FINISHED[r.status]) return false;
            if (repF && r.requestedBy !== repF) return false;
            if (statusF && r.status !== statusF) return false;
            if (q) {
                var hay = (r.wo + ' ' + r.company + ' ' + r.bradleyPo + ' ' + r.vendors + ' ' + r.requestedByName).toLowerCase();
                if (hay.indexOf(q) === -1) return false;
            }
            return true;
        });

        Array.prototype.forEach.call(document.querySelectorAll('.pp-tile[data-filter]'), function (btn) {
            var key = btn.getAttribute('data-filter') || '';
            var on = state.tile ? key === state.tile : (key === statusF && (key !== '' || (!showFinished === false && !statusF && false)));
            btn.classList.toggle('is-active', !!on && key !== '');
            btn.setAttribute('aria-pressed', (!!on && key !== '') ? 'true' : 'false');
        });

        put('pp-shown', state.rows.length
            ? rows.length + ' of ' + state.rows.length + ' shown' + (!showFinished && finishedTotal ? ' · ' + finishedTotal + ' finished hidden' : '')
            : '');

        if (!rows.length) {
            el('pp-tbody').innerHTML = '<tr><td colspan="11" class="pp-empty">'
                + (state.rows.length && !showFinished && finishedTotal && !q && !repF && !statusF
                    ? 'Nothing open — every request in the window is invoiced or shipped. Tick “Show finished” to see them.'
                    : 'No purchase requests match.')
                + '</td></tr>';
            return;
        }
        el('pp-tbody').innerHTML = rows.map(function (r) {
            var who = esc(r.company || 'this order');
            var reqLink = r.submissionId
                ? '<a class="pp-req-link" href="' + JOTFORM_SUBMISSION + esc(r.submissionId) + '" target="_blank" rel="noopener"'
                  + ' title="Open the original purchase request for WO ' + esc(r.wo) + ' (' + who + ') in JotForm"'
                  + ' aria-label="Open the purchase request for work order ' + esc(r.wo) + '"><i class="fas fa-arrow-up-right-from-square" aria-hidden="true"></i> Request</a>'
                : '';
            var invBtn = (r.sanmarPos && r.sanmarPos.length)
                ? '<button type="button" class="pp-invoice-btn" data-wo="' + esc(r.wo) + '" data-company="' + esc(r.company) + '"'
                  + ' data-pos="' + esc(r.sanmarPos.join(',')) + '" data-ordered="' + esc(r.orderedDate || '') + '"'
                  + ' aria-label="View the SanMar invoice for work order ' + esc(r.wo) + ', ' + who + '"'
                  + ' title="SanMar invoice · PO ' + esc(r.sanmarPos.join(', ')) + '"><i class="fas fa-file-invoice-dollar" aria-hidden="true"></i> Invoice</button>'
                : '';
            return '<tr>' +
                '<td class="pp-wo">' + esc(r.wo) + '</td>' +
                '<td class="pp-company">' + esc(r.company || '—') + '</td>' +
                '<td class="pp-col-phone-hide">' + esc(firstName(r.requestedByName)) + '</td>' +
                '<td>' + fmtWhen(r.submittedAt) + '</td>' +
                '<td class="pp-col-phone-hide">' + esc(r.orderType || '—') + '</td>' +
                '<td>' + esc(r.bradleyPo || '—') + '</td>' +
                '<td>' + esc(r.vendors || '—') + '</td>' +
                '<td class="pp-col-phone-hide">' + (r.orderedDate ? fmtWhen(r.orderedDate) : '—') + '</td>' +
                '<td class="pp-col-phone-hide">' + (r.receivedDate ? fmtWhen(r.receivedDate) : '—') + '</td>' +
                '<td><span class="pp-chip pp-chip--' + esc(r.status) + '">' + esc(STATUS_LABEL[r.status] || r.status) + '</span></td>' +
                '<td class="pp-actions">' + (reqLink + invBtn || '—') + '</td>' +
                '</tr>';
        }).join('');
        Array.prototype.forEach.call(el('pp-tbody').querySelectorAll('.pp-invoice-btn'), function (btn) {
            btn.addEventListener('click', function () {
                openInvoiceModal(btn.dataset.wo, btn.dataset.company, btn.dataset.pos.split(',').filter(Boolean), btn.dataset.ordered);
            });
        });
    }

    // ---------- SanMar invoice (shared viewer) ----------
    // Delegates to window.SanMarInvoiceViewer (shared_components/js/
    // sanmar-invoice-viewer.js) — the SAME modal + Print/Save PDF the AE
    // Mission Control purchasing card uses, so the document never drifts.
    function openInvoiceModal(wo, company, pos, orderedDate) {
        if (!window.SanMarInvoiceViewer) {
            DashPage.showError('Invoice viewer failed to load — refresh the page.');
            return;
        }
        window.SanMarInvoiceViewer.open({ wo: wo, company: company, pos: pos, orderedDate: orderedDate });
    }
})();
