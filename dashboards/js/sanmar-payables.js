/* sanmar-payables.js — native SanMar Payables controller (Phase 1).
 *
 * Replaces the Caspio-embedded "Sanmar Vendor Portal" DataPage + the manual
 * email-parse workflow. Two tabs:
 *   • Invoices — pulls SanMar invoices LIVE (SOAP Invoicing) for a date range,
 *     filterable, and exports the exact ShopWorks vendor-payables import CSV
 *     (vendor 1002, Net30 incl. credits). MRKFUND marketing charges are shown
 *     but NOT part of this import (they belong to vendor 2425 — see below).
 *   • Marketing Fund — tracks the annual SanMar marketing allotment (vendor
 *     2425 "6920-0001 Marketing (Sanmar)"): allotment − net MRKFUND charges YTD
 *     = remaining, with a year-end projection + its own 2425 import CSV.
 *
 * Data: GET /api/staff/sanmar-invoices/by-date?start=&end=  (same-origin,
 *   requireStaff → proxy /api/sanmar-invoices/by-date, ≤3-month window).
 * Invoice drill reuses the shared SanMarInvoiceViewer (by-po/:po).
 *
 * Failures are VISIBLE (DashPage.showError + in-table error row) — never a
 * silently empty table (CLAUDE.md rule #4). SanMar's per-invoice invoiceStatus
 * is intentionally NOT shown: it reads "Unpaid" even for long-paid invoices —
 * true paid/imported status arrives in Phase 2 from the ShopWorks payables match.
 */
(function () {
    'use strict';

    var YEAR = new Date().getFullYear();
    // SanMar's 2026 marketing-fund allotment (Erik, 2026-07-20). Not carried in
    // the SanMar feed — it's the ceiling the MRKFUND charges draw against. The
    // Marketing Fund tab exposes it as an editable field so it can be corrected /
    // updated each year without a code change.
    var DEFAULT_ALLOWANCE = 35110.95;

    var state = {
        activeTab: 'invoices',
        invoices: [], range: { start: '', end: '' },
        mkt: null // { items, byMonth, charges, credits, net }
    };

    function esc(v) {
        return String(v == null ? '' : v)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }
    function el(id) { return document.getElementById(id); }

    // ISO 'YYYY-MM-DD' → 'M/D/YYYY' (no leading zeros) to match the ShopWorks CSV.
    function toMDY(iso) {
        var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ''));
        if (!m) return String(iso || '');
        return Number(m[2]) + '/' + Number(m[3]) + '/' + m[1];
    }
    function fmtWhen(iso) {
        var s = String(iso == null ? '' : iso).slice(0, 10);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return esc(iso);
        var d = new Date(s + 'T12:00:00');
        if (isNaN(d.getTime())) return esc(s);
        return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    }
    // Display money with sign, thousands, 2dp (credits negative).
    function money(v) {
        var n = Number(v) || 0;
        return (n < 0 ? '-$' : '$') + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    function money0(v) {
        var n = Number(v) || 0;
        return (n < 0 ? '-$' : '$') + Math.abs(n).toLocaleString('en-US', { maximumFractionDigits: 0 });
    }
    function basePo(po) { return String(po || '').replace(/\s+[A-Za-z]+$/, '').trim(); }
    function isoDaysAgo(n) { var d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); }
    function todayIso() { return new Date().toISOString().slice(0, 10); }
    function termsOf(i) { return String(i.terms || '').toUpperCase(); }
    function isMarketing(i) { return termsOf(i) === 'MRKFUND'; }

    // One RFC-4180 CSV cell, hardened against Excel formula injection (same rule
    // as dashboards/js/leads-common.js csvCell — inlined so this page is self-contained).
    function csvCell(v) {
        var s = String(v == null ? '' : v);
        if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
        if (/[",\r\n]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
        return s;
    }
    // ShopWorks Amount cell: "$1,222.47 " (trailing space; comma-grouped; credits negative).
    function csvAmount(v) {
        var n = Number(v) || 0;
        return (n < 0 ? '-$' : '$') + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ';
    }
    var CSV_HEADER = ['PayableDate', 'InvoiceNumber', 'Amount', 'Id_Vendor', 'PONumber', 'Id_Vendor_Charge', 'PayableDueDateOverride', '', '', ''];
    // One golden-format CSV row for an invoice, booked to the given vendor id.
    function csvRow(i, vendorId) {
        var neg = (Number(i.totalAmount) || 0) < 0;
        return [
            toMDY(i.invoiceDate),
            (neg ? 'CR-' : 'INV-') + String(i.invoiceNumber || ''),
            csvAmount(i.totalAmount),
            vendorId,
            String(i.purchaseOrderNo || ''),
            vendorId,
            toMDY(i.dueDate),
            '', '', ''
        ].map(csvCell).join(',');
    }
    function downloadCsvFile(rows, filename) {
        var lines = [CSV_HEADER.map(csvCell).join(',')].concat(rows);
        var blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url; a.download = filename;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    }

    // Fetch invoices for a date range through the staff-gated forwarder.
    function fetchByDate(start, end) {
        var url = '/api/staff/sanmar-invoices/by-date?start=' + encodeURIComponent(start) + '&end=' + encodeURIComponent(end);
        return fetch(url, { credentials: 'same-origin' }).then(function (resp) {
            if (!resp.ok) throw new Error('HTTP ' + resp.status);
            return resp.json();
        }).then(function (d) { return d.invoices || []; });
    }

    document.addEventListener('DOMContentLoaded', function () {
        // Tabs
        Array.prototype.forEach.call(document.querySelectorAll('.smp-tab'), function (btn) {
            btn.addEventListener('click', function () { switchTab(btn.dataset.tab); });
        });
        // Invoices tab
        el('smp-start').value = isoDaysAgo(30);
        el('smp-end').value = todayIso();
        el('smp-refresh').addEventListener('click', function () {
            if (state.activeTab === 'marketing') loadMarketing(); else loadInvoices();
        });
        el('smp-start').addEventListener('change', loadInvoices);
        el('smp-end').addEventListener('change', loadInvoices);
        el('smp-search-po').addEventListener('input', renderInvoiceTable);
        el('smp-search-inv').addEventListener('input', renderInvoiceTable);
        el('smp-download').addEventListener('click', downloadStandardCsv);
        el('smp-select-all').addEventListener('change', function () {
            var on = el('smp-select-all').checked;
            Array.prototype.forEach.call(el('smp-tbody').querySelectorAll('.smp-row-check:not([disabled])'), function (cb) { cb.checked = on; });
            updateSelectionCount();
        });
        // Marketing tab
        el('smp-mkt-year').textContent = YEAR;
        el('smp-mkt-allowance').addEventListener('input', renderMarketingSummary);
        el('smp-mkt-download').addEventListener('click', downloadMarketingCsv);

        loadInvoices();
    });

    function switchTab(tab) {
        if (tab === state.activeTab) return;
        state.activeTab = tab;
        Array.prototype.forEach.call(document.querySelectorAll('.smp-tab'), function (b) {
            b.classList.toggle('is-active', b.dataset.tab === tab);
        });
        el('smp-panel-invoices').hidden = tab !== 'invoices';
        el('smp-panel-marketing').hidden = tab !== 'marketing';
        DashPage.hideError();
        if (tab === 'marketing' && !state.mkt) loadMarketing();
    }

    // ==================== INVOICES TAB ====================

    // Classify by SanMar terms. The ShopWorks vendor-payables import (Id_Vendor
    // 1002) covers Net30 invoices AND credits (verified: the live ShopWorks
    // payables carry 1820 INV + 82 CR rows, all vendor 1002). Marketing-fund
    // charges come back with terms "MRKFUND" on a SEPARATE vendor account (2425)
    // — shown here but NOT exportable into this 1002 import; they live on the
    // Marketing Fund tab. $0 invoices are exportable but unchecked by default.
    function classify(i) {
        var amt = Number(i.totalAmount) || 0;
        var standard = termsOf(i) === 'NET30';
        var badge = '';
        if (!standard) badge = (termsOf(i) === 'MRKFUND') ? 'MARKETING' : (termsOf(i) || 'OTHER');
        else if (amt < 0) badge = 'CREDIT';
        else if (amt === 0) badge = 'ZERO';
        return { exportable: standard, defaultChecked: standard && amt !== 0, badge: badge };
    }
    var BADGE_CLASS = { MARKETING: 'smp-badge--mkt', CREDIT: 'smp-badge--credit', ZERO: 'smp-badge--zero', OTHER: 'smp-badge--mkt' };

    function loadInvoices() {
        var start = el('smp-start').value, end = el('smp-end').value;
        if (!start || !end) { DashPage.showError('Choose a start and end date.'); return; }
        if (start > end) { DashPage.showError('Start date must be on or before the end date.'); return; }
        DashPage.hideError();
        state.range = { start: start, end: end };
        el('smp-tbody').innerHTML = '<tr><td colspan="7" class="smp-empty dash-loading">Loading SanMar invoices…</td></tr>';
        el('smp-select-all').checked = false;
        fetchByDate(start, end).then(function (invoices) {
            state.invoices = invoices.slice().sort(function (a, b) {
                return String(b.invoiceDate).localeCompare(String(a.invoiceDate)) ||
                       String(b.invoiceNumber).localeCompare(String(a.invoiceNumber));
            });
            renderInvoiceStats();
            renderInvoiceTable();
            el('smp-updated').textContent = 'Pulled live from SanMar · ' +
                new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) +
                ' · ' + toMDY(start) + ' – ' + toMDY(end);
        }).catch(function (err) {
            DashPage.showError('Could not pull SanMar invoices: ' + err.message + ' — check the date range and refresh to retry.');
            el('smp-tbody').innerHTML = '<tr><td colspan="7" class="smp-empty">Not loaded — ' + esc(err.message) + '</td></tr>';
            state.invoices = [];
            renderInvoiceStats();
        });
    }

    function filteredInvoices() {
        var po = el('smp-search-po').value.trim().toLowerCase();
        var inv = el('smp-search-inv').value.trim().toLowerCase();
        return state.invoices.filter(function (i) {
            if (po && String(i.purchaseOrderNo || '').toLowerCase().indexOf(po) === -1) return false;
            if (inv && String(i.invoiceNumber || '').toLowerCase().indexOf(inv) === -1) return false;
            return true;
        });
    }

    function renderInvoiceStats() {
        var invs = state.invoices;
        var credits = invs.filter(function (i) { return (Number(i.totalAmount) || 0) < 0; });
        var net = invs.reduce(function (s, i) { return s + (Number(i.totalAmount) || 0); }, 0);
        el('smp-stat-count').textContent = invs.length;
        el('smp-stat-net').textContent = money(net);
        el('smp-stat-credits').textContent = credits.length;
        updateSelectionCount();
    }

    function renderInvoiceTable() {
        var rows = filteredInvoices();
        if (!rows.length) {
            el('smp-tbody').innerHTML = '<tr><td colspan="7" class="smp-empty">' +
                (state.invoices.length ? 'No invoices match the filters.' : 'No SanMar invoices in this date range.') + '</td></tr>';
            el('smp-select-all').checked = false;
            updateSelectionCount();
            return;
        }
        el('smp-tbody').innerHTML = rows.map(function (i, idx) {
            var amt = Number(i.totalAmount) || 0;
            var neg = amt < 0;
            var cls = classify(i);
            var ship = (i.shipTo && i.shipTo.name) ? i.shipTo.name : '';
            var badge = cls.badge ? ' <span class="smp-badge ' + (BADGE_CLASS[cls.badge] || 'smp-badge--mkt') + '">' + esc(cls.badge) + '</span>' : '';
            var box = '<input type="checkbox" class="smp-row-check" data-idx="' + idx + '"' +
                (cls.exportable ? '' : ' disabled title="Marketing-fund charge — vendor 2425, tracked on the Marketing Fund tab"') +
                (cls.defaultChecked ? ' checked' : '') + '>';
            return '<tr class="' + (neg ? 'smp-tr--credit' : '') + (cls.exportable ? '' : ' smp-tr--excluded') + '">' +
                '<td class="smp-check-cell">' + box + '</td>' +
                '<td>' + fmtWhen(i.invoiceDate) + '</td>' +
                '<td class="smp-inv">' + (neg ? 'CR-' : 'INV-') + esc(i.invoiceNumber) + badge + '</td>' +
                '<td class="smp-po">' + esc(i.purchaseOrderNo || '—') + '</td>' +
                '<td class="smp-ship">' + esc(ship || '—') + '</td>' +
                '<td class="smp-amt ' + (neg ? 'smp-amt--credit' : '') + '">' + money(i.totalAmount) + '</td>' +
                '<td>' + fmtWhen(i.dueDate) + '</td>' +
                '<td>' + viewBtn(i, ship) + '</td>' +
                '</tr>';
        }).join('');
        Array.prototype.forEach.call(el('smp-tbody').querySelectorAll('.smp-row-check'), function (cb, i) {
            cb._invoice = rows[i];
            cb.addEventListener('change', function () { syncSelectAll(); updateSelectionCount(); });
        });
        wireViewButtons(el('smp-tbody'));
        syncSelectAll();
        updateSelectionCount();
    }

    function syncSelectAll() {
        var boxes = el('smp-tbody').querySelectorAll('.smp-row-check:not([disabled])');
        var checked = el('smp-tbody').querySelectorAll('.smp-row-check:not([disabled]):checked');
        el('smp-select-all').checked = boxes.length > 0 && boxes.length === checked.length;
    }

    function selectedInvoices() {
        return Array.prototype.map.call(el('smp-tbody').querySelectorAll('.smp-row-check:checked'), function (cb) { return cb._invoice; })
            .filter(Boolean);
    }

    function updateSelectionCount() {
        var n = el('smp-tbody').querySelectorAll('.smp-row-check:checked').length;
        el('smp-stat-selected').textContent = n;
        var btn = el('smp-download');
        btn.disabled = n === 0;
        btn.querySelector('.smp-download-count').textContent = n;
    }

    function downloadStandardCsv() {
        var picks = selectedInvoices();
        if (!picks.length) { DashPage.showError('Select at least one invoice to export.'); return; }
        DashPage.hideError();
        downloadCsvFile(picks.map(function (i) { return csvRow(i, '1002'); }),
            'Sanmar_Payables_1002_' + state.range.start + '_to_' + state.range.end + '.csv');
    }

    // ==================== MARKETING FUND TAB ====================

    // Quarter windows (each ≤92 days, under the forwarder's ≤100-day cap) from
    // Jan 1 of YEAR through today — so a full year is at most 4 SanMar calls.
    function ytdWindows() {
        var today = todayIso();
        var q = [['-01-01', '-03-31'], ['-04-01', '-06-30'], ['-07-01', '-09-30'], ['-10-01', '-12-31']];
        var out = [];
        q.forEach(function (w) {
            var s = YEAR + w[0], e = YEAR + w[1];
            if (s > today) return;
            out.push([s, e > today ? today : e]);
        });
        return out;
    }

    function loadMarketing() {
        DashPage.hideError();
        el('smp-mkt-tbody').innerHTML = '<tr><td colspan="5" class="smp-empty dash-loading">Loading marketing-fund activity…</td></tr>';
        el('smp-mkt-monthbars').innerHTML = '<div class="smp-empty dash-loading">Loading…</div>';
        var windows = ytdWindows();
        Promise.all(windows.map(function (w) { return fetchByDate(w[0], w[1]); })).then(function (results) {
            var items = [];
            results.forEach(function (arr) { arr.forEach(function (i) { if (isMarketing(i)) items.push(i); }); });
            items.sort(function (a, b) {
                return String(b.invoiceDate).localeCompare(String(a.invoiceDate)) ||
                       String(b.invoiceNumber).localeCompare(String(a.invoiceNumber));
            });
            var byMonth = {};
            items.forEach(function (i) {
                var m = String(i.invoiceDate).slice(0, 7);
                byMonth[m] = (byMonth[m] || 0) + (Number(i.totalAmount) || 0);
            });
            var net = items.reduce(function (s, i) { return s + (Number(i.totalAmount) || 0); }, 0);
            state.mkt = { items: items, byMonth: byMonth, net: net };
            el('smp-mkt-updated').textContent = 'Pulled live from SanMar · ' +
                new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) + ' · Jan 1 – today';
            renderMarketingTable();
            renderMarketingMonths();
            renderMarketingSummary();
        }).catch(function (err) {
            DashPage.showError('Could not load marketing-fund activity: ' + err.message + ' — refresh to retry.');
            el('smp-mkt-tbody').innerHTML = '<tr><td colspan="5" class="smp-empty">Not loaded — ' + esc(err.message) + '</td></tr>';
            el('smp-mkt-monthbars').innerHTML = '';
        });
    }

    function renderMarketingSummary() {
        if (!state.mkt) return;
        var allowance = Number(el('smp-mkt-allowance').value) || 0;
        var spent = state.mkt.net;
        var remaining = allowance - spent;
        var pct = allowance > 0 ? (spent / allowance) * 100 : 0;

        el('smp-mkt-spent').textContent = money0(spent);
        el('smp-mkt-remaining').textContent = money0(remaining);
        el('smp-mkt-used-pct').textContent = (allowance > 0 ? pct.toFixed(0) : '—') + '%';

        // Year-end projection from the current daily burn rate.
        var yearStart = new Date(YEAR, 0, 1), now = new Date();
        var daysElapsed = Math.max(1, Math.round((now - yearStart) / 86400000));
        var daysInYear = (YEAR % 4 === 0 && (YEAR % 100 !== 0 || YEAR % 400 === 0)) ? 366 : 365;
        var projectedSpend = spent / daysElapsed * daysInYear;
        var projectedUnused = allowance - projectedSpend;
        var perMonth = spent / (daysElapsed / 30.44);

        el('smp-mkt-projected').textContent = money0(Math.max(0, projectedUnused));
        var note;
        if (projectedUnused > 0) {
            note = 'At the current pace (~' + money0(perMonth) + '/mo) you’re on track to spend ~' + money0(projectedSpend) +
                ' and leave ~' + money0(projectedUnused) + ' of the fund UNUSED by Dec 31.';
        } else {
            note = 'At the current pace (~' + money0(perMonth) + '/mo) you’re on track to spend ~' + money0(projectedSpend) +
                ' — about ' + money0(-projectedUnused) + ' OVER the fund by Dec 31.';
        }
        el('smp-mkt-projnote').textContent = note;

        // Progress bar (spent vs allowance).
        var fillPct = allowance > 0 ? Math.min(100, Math.max(0, pct)) : 0;
        var bar = el('smp-mkt-bar');
        bar.style.width = fillPct.toFixed(1) + '%';
        bar.classList.toggle('smp-progress-fill--over', spent > allowance);
        el('smp-mkt-bar-spent').textContent = money0(spent);
        el('smp-mkt-bar-left').textContent = money0(Math.max(0, remaining));
    }

    function renderMarketingMonths() {
        if (!state.mkt) return;
        var byMonth = state.mkt.byMonth;
        var keys = Object.keys(byMonth).sort();
        if (!keys.length) { el('smp-mkt-monthbars').innerHTML = '<p class="smp-empty">No marketing charges yet this year.</p>'; return; }
        var max = Math.max.apply(null, keys.map(function (k) { return Math.abs(byMonth[k]); }).concat([1]));
        el('smp-mkt-monthbars').innerHTML = keys.map(function (k) {
            var v = byMonth[k];
            var label = new Date(k + '-01T12:00:00').toLocaleDateString('en-US', { month: 'short' });
            var w = (Math.abs(v) / max) * 100;
            return '<div class="smp-monthrow">' +
                '<span class="smp-monthlbl">' + esc(label) + '</span>' +
                '<span class="smp-monthbar-track"><span class="smp-monthbar-fill' + (v < 0 ? ' smp-monthbar-fill--credit' : '') + '" style="width:' + w.toFixed(1) + '%"></span></span>' +
                '<span class="smp-monthval">' + money(v) + '</span>' +
                '</div>';
        }).join('');
    }

    function renderMarketingTable() {
        if (!state.mkt) return;
        var items = state.mkt.items;
        el('smp-mkt-item-count').textContent = items.length;
        if (!items.length) {
            el('smp-mkt-tbody').innerHTML = '<tr><td colspan="5" class="smp-empty">No marketing-fund charges this year.</td></tr>';
            return;
        }
        el('smp-mkt-tbody').innerHTML = items.map(function (i) {
            var neg = (Number(i.totalAmount) || 0) < 0;
            var ship = (i.shipTo && i.shipTo.name) ? i.shipTo.name : '';
            return '<tr class="' + (neg ? 'smp-tr--credit' : '') + '">' +
                '<td>' + fmtWhen(i.invoiceDate) + '</td>' +
                '<td class="smp-inv">' + (neg ? 'CR-' : 'INV-') + esc(i.invoiceNumber) + '</td>' +
                '<td class="smp-po">' + esc(i.purchaseOrderNo || '—') + '</td>' +
                '<td class="smp-amt ' + (neg ? 'smp-amt--credit' : '') + '">' + money(i.totalAmount) + '</td>' +
                '<td>' + viewBtn(i, ship) + '</td>' +
                '</tr>';
        }).join('');
        wireViewButtons(el('smp-mkt-tbody'));
    }

    function downloadMarketingCsv() {
        if (!state.mkt || !state.mkt.items.length) { DashPage.showError('No marketing-fund charges to export.'); return; }
        DashPage.hideError();
        downloadCsvFile(state.mkt.items.map(function (i) { return csvRow(i, '2425'); }),
            'Sanmar_Marketing_2425_' + YEAR + '_YTD.csv');
    }

    // ==================== shared invoice viewer ====================

    function viewBtn(i, ship) {
        return '<button type="button" class="smp-view-btn" data-po="' + esc(basePo(i.purchaseOrderNo)) +
            '" data-company="' + esc(ship || '') + '" data-ordered="' + esc(i.orderDate || '') +
            '"><i class="fas fa-file-invoice-dollar"></i> View</button>';
    }
    function wireViewButtons(scope) {
        Array.prototype.forEach.call(scope.querySelectorAll('.smp-view-btn'), function (btn) {
            btn.addEventListener('click', function () {
                if (!window.SanMarInvoiceViewer) { DashPage.showError('Invoice viewer failed to load — refresh the page.'); return; }
                var po = btn.dataset.po;
                if (!po) { DashPage.showError('This invoice has no numeric PO to look up.'); return; }
                window.SanMarInvoiceViewer.open({ pos: [po], company: btn.dataset.company, orderedDate: btn.dataset.ordered });
            });
        });
    }
})();
