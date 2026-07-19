/**
 * marketing-shipments.js — controller for dashboards/marketing-shipments.html.
 *
 * Mikalah's kit-fulfillment queue. Reads/writes go through the SAME-ORIGIN
 * session-gated /api/crm-proxy/marketing-shipments* forwarder (the upstream
 * Marketing_Shipments table holds recipient PII → secret-only on the proxy).
 * NO polling — loads on open + Refresh. Every rendered value passes esc()
 * (recipient/company/notes originate from lead data = attacker-controlled).
 */
(function () {
    'use strict';

    var esc = (window.LeadsCommon && window.LeadsCommon.esc) || function (s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    };

    var state = { status: 'Requested', rows: [], loadSeq: 0 };

    document.addEventListener('DOMContentLoaded', function () {
        document.getElementById('btn-refresh').addEventListener('click', load);
        Array.prototype.forEach.call(document.querySelectorAll('.ms-tab'), function (tab) {
            tab.addEventListener('click', function () {
                state.status = tab.getAttribute('data-status');
                Array.prototype.forEach.call(document.querySelectorAll('.ms-tab'), function (t) {
                    t.setAttribute('aria-pressed', t === tab ? 'true' : 'false');
                });
                load();
            });
        });
        load();
    });

    function msFetch(path, options) {
        return fetch('/api/crm-proxy/marketing-shipments' + (path || ''), options).then(function (resp) {
            return resp.json().catch(function () { return {}; }).then(function (body) {
                if (!resp.ok) throw new Error(body.error || ('HTTP ' + resp.status));
                return body;
            });
        });
    }

    function fmtWhen(iso) {
        if (!iso) return '—';
        var t = Date.parse(iso);
        if (isNaN(t)) return esc(String(iso).slice(0, 16));
        var d = new Date(t);
        return (d.getMonth() + 1) + '/' + d.getDate() + ' ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    }

    function itemsText(json) {
        try {
            var items = JSON.parse(json || '[]');
            if (!Array.isArray(items) || !items.length) return '—';
            return items.map(function (it) {
                var q = Number(it.qty) > 1 ? (it.qty + '× ') : '';
                return q + (it.label || it.code || '');
            }).join(', ');
        } catch (e) { return '—'; }
    }

    function load() {
        DashPage.hideError();
        var tbody = document.getElementById('ms-tbody');
        tbody.innerHTML = '<tr><td colspan="6" class="ld-empty dash-loading">Loading…</td></tr>';
        var seq = ++state.loadSeq;
        msFetch('?status=' + encodeURIComponent(state.status)).then(function (body) {
            if (seq !== state.loadSeq) return;
            state.rows = body.shipments || [];
            render();
        }).catch(function (err) {
            if (seq !== state.loadSeq) return;
            console.error('[marketing-shipments] load failed:', err);
            DashPage.showError('Could not load the queue (' + err.message + '). Refresh to retry.');
            tbody.innerHTML = '<tr><td colspan="6" class="ld-empty"><i class="fas fa-triangle-exclamation"></i> Queue unavailable.</td></tr>';
        });
    }

    function render() {
        var rows = state.rows;
        document.getElementById('ms-count').textContent = rows.length + ' ' + state.status.toLowerCase();
        var tbody = document.getElementById('ms-tbody');
        if (!rows.length) {
            tbody.innerHTML = '<tr><td colspan="6" class="ld-empty">Nothing ' + esc(state.status.toLowerCase()) + '.</td></tr>';
            return;
        }
        tbody.innerHTML = rows.map(function (s) {
            var addr = [s.Address1, s.Address2, [s.City, s.State].filter(Boolean).join(', '), s.Zip].filter(Boolean).join(' · ');
            var leadLink = s.Submission_ID
                ? '<a class="ld-id" href="/dashboards/lead.html#' + encodeURIComponent(s.Submission_ID) + '" target="_blank" rel="noopener">' + esc(s.Submission_ID) + '</a>'
                : '';
            var shipped = s.Status === 'Shipped';
            var actions = shipped
                ? (s.Tracking_Number ? '<span class="ms-track">' + esc(s.Carrier || '') + ' ' + esc(s.Tracking_Number) + '</span>' : '<span class="ld-muted">shipped</span>')
                : '<div class="ms-actions" data-id="' + esc(s.Shipment_ID) + '">' +
                  (s.Status === 'Requested' ? '<button type="button" class="lw-chip ms-pack">Mark packed</button>' : '') +
                  '<button type="button" class="ld-btn ms-ship">Mark shipped…</button></div>';
            return '<tr data-id="' + esc(s.Shipment_ID) + '">' +
                '<td class="ld-when">' + fmtWhen(s.Created_At) + '<div class="ld-muted">' + esc(s.Shipment_ID) + '</div></td>' +
                '<td>' + esc(s.Recipient_Name || '—') + '<div class="ld-muted">' + esc(s.Company || '') + '</div>' + (leadLink ? '<div>' + leadLink + '</div>' : '') + '</td>' +
                '<td>' + esc(addr || '—') + (s.Phone ? '<div class="ld-muted">' + esc(s.Phone) + '</div>' : '') + '</td>' +
                '<td>' + esc(itemsText(s.Items_JSON)) + (s.Notes ? '<div class="ld-muted">' + esc(s.Notes) + '</div>' : '') + '</td>' +
                '<td>' + esc(s.Sales_Rep || '—') + '</td>' +
                '<td>' + actions + '</td>' +
                '</tr>';
        }).join('');

        Array.prototype.forEach.call(tbody.querySelectorAll('.ms-pack'), function (btn) {
            btn.addEventListener('click', function () { updateStatus(btn.closest('.ms-actions').getAttribute('data-id'), { Status: 'Packed' }); });
        });
        Array.prototype.forEach.call(tbody.querySelectorAll('.ms-ship'), function (btn) {
            btn.addEventListener('click', function () { openShipForm(btn.closest('.ms-actions')); });
        });
    }

    // Reveal an inline tracking form in the actions cell, then PUT Status=Shipped.
    function openShipForm(container) {
        var id = container.getAttribute('data-id');
        container.innerHTML =
            '<div class="ms-ship-form">' +
            '<select class="ms-carrier ld-select"><option>USPS</option><option>UPS</option><option>FedEx</option><option>Other</option></select>' +
            '<input type="text" class="ms-tracking ld-select" placeholder="Tracking #" autocomplete="off">' +
            '<button type="button" class="ld-btn ld-btn--primary ms-ship-go">Ship</button>' +
            '<button type="button" class="lw-chip ms-ship-cancel">Cancel</button>' +
            '</div>';
        container.querySelector('.ms-tracking').focus();
        container.querySelector('.ms-ship-cancel').addEventListener('click', load);
        container.querySelector('.ms-ship-go').addEventListener('click', function () {
            var carrier = container.querySelector('.ms-carrier').value;
            var tracking = container.querySelector('.ms-tracking').value.trim();
            updateStatus(id, { Status: 'Shipped', Carrier: carrier, Tracking_Number: tracking });
        });
    }

    function updateStatus(id, fields) {
        DashPage.hideError();
        fields.Updated_By = (window.__staffEmail || '') || 'shipping';
        msFetch('/' + encodeURIComponent(id), {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(fields),
        }).then(function () { load(); })
          .catch(function (err) { DashPage.showError('Could not update ' + id + ' (' + err.message + ').'); });
    }

    // Best-effort staff email for the Updated_By stamp (also stamped server-side).
    fetch('/api/crm-session/me').then(function (r) { return r.json(); })
        .then(function (me) { window.__staffEmail = me.email || ''; })
        .catch(function () { /* server stamps a fallback */ });
})();
