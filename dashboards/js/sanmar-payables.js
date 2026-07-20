/* sanmar-payables.js — native SanMar Payables controller.
 *
 * Replaces the Caspio-embedded "Sanmar Vendor Portal" DataPage + the manual
 * email-parse workflow. Two tabs:
 *
 *   • Invoices = the OPEN PAYABLES worklist — SanMar invoices + credits we still
 *     owe (SanMar's GetUnpaidInvoices), vendor 1002 only (marketing excluded),
 *     recent by default. Cross-referenced against ShopWorks' payables so each row
 *     shows Imported? (a bill exists in ShopWorks) and Paid? (ShopWorks date_Paid).
 *     The ShopWorks side comes from an uploaded payables export now, and from the
 *     automated bandit ODBC sync later (same shape). Default view = what still
 *     needs to be imported + paid; export the standard ShopWorks 1002 CSV.
 *
 *   • Marketing Fund = the annual SanMar marketing allotment (vendor 2425): all
 *     MRKFUND charges YTD vs the allotment, year-end projection, its own 2425 CSV.
 *
 * Data: GET /api/staff/sanmar-invoices/unpaid + /by-date (same-origin, requireStaff
 * → proxy). Invoice drill reuses the shared SanMarInvoiceViewer (by-po/:po).
 * Failures are VISIBLE (DashPage.showError + in-table row) — never a silent table.
 * SanMar's per-invoice invoiceStatus is NOT used (unreliable — "Unpaid" even for
 * paid); paid truth = ShopWorks date_Paid, off-SanMar's-unpaid-list = they got paid.
 */
(function () {
    'use strict';

    var YEAR = new Date().getFullYear();
    // SanMar's 2026 marketing-fund allotment (Erik, 2026-07-20) — editable on the tab.
    var DEFAULT_ALLOWANCE = 35110.95;
    var RECENT_DAYS = 90;

    var state = {
        activeTab: 'invoices',
        unpaid: [], range: { start: '', end: '' },
        sw: null,       // { map: Map(normInv → {datePaid, outstanding}), count, at } from the ShopWorks payables upload
        mkt: null
    };

    function esc(v) {
        return String(v == null ? '' : v)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }
    function el(id) { return document.getElementById(id); }
    function toMDY(iso) {
        var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ''));
        return m ? Number(m[2]) + '/' + Number(m[3]) + '/' + m[1] : String(iso || '');
    }
    function fmtWhen(iso) {
        var s = String(iso == null ? '' : iso).slice(0, 10);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return esc(iso);
        var d = new Date(s + 'T12:00:00');
        if (isNaN(d.getTime())) return esc(s);
        return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    }
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

    // Normalized invoice key for matching SanMar (raw "162398367") ↔ ShopWorks
    // ("INV-162398367" / "CR-5670868" / "FTC-001031473"): strip the prefix + any
    // non-alphanumerics, uppercase. Sign is tracked separately (never in the key).
    // NB: also strip leading zeros — ShopWorks zero-pads credit/freight numbers
    // (CR-005615563, FTC-001124876) while SanMar returns them bare (5615563), so
    // without this every padded credit would falsely read "not imported".
    function normInv(s) {
        return String(s == null ? '' : s).trim().toUpperCase().replace(/^(INV|CR|FTC)-?/, '').replace(/[^A-Z0-9]/g, '').replace(/^0+/, '') || '0';
    }

    function csvCell(v) {
        var s = String(v == null ? '' : v);
        if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
        if (/[",\r\n]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
        return s;
    }
    function csvAmount(v) {
        var n = Number(v) || 0;
        return (n < 0 ? '-$' : '$') + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ';
    }
    var CSV_HEADER = ['PayableDate', 'InvoiceNumber', 'Amount', 'Id_Vendor', 'PONumber', 'Id_Vendor_Charge', 'PayableDueDateOverride', '', '', ''];
    function csvRow(i, vendorId) {
        var neg = (Number(i.totalAmount) || 0) < 0;
        return [
            toMDY(i.invoiceDate), (neg ? 'CR-' : 'INV-') + String(i.invoiceNumber || ''),
            csvAmount(i.totalAmount), vendorId, String(i.purchaseOrderNo || ''), vendorId,
            toMDY(i.dueDate), '', '', ''
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

    function fetchJson(url) {
        return fetch(url, { credentials: 'same-origin' }).then(function (resp) {
            if (!resp.ok) throw new Error('HTTP ' + resp.status);
            return resp.json();
        });
    }

    document.addEventListener('DOMContentLoaded', function () {
        Array.prototype.forEach.call(document.querySelectorAll('.smp-tab'), function (btn) {
            btn.addEventListener('click', function () { switchTab(btn.dataset.tab); });
        });
        el('smp-start').value = isoDaysAgo(RECENT_DAYS);
        el('smp-end').value = todayIso();
        el('smp-refresh').addEventListener('click', function () {
            if (state.activeTab === 'marketing') loadMarketing(); else loadInvoices();
        });
        el('smp-start').addEventListener('change', loadInvoices);
        el('smp-end').addEventListener('change', loadInvoices);
        el('smp-search-po').addEventListener('input', renderInvoiceTable);
        el('smp-search-inv').addEventListener('input', renderInvoiceTable);
        el('smp-status-filter').addEventListener('change', renderInvoiceTable);
        el('smp-sw-file').addEventListener('change', onShopworksFile);
        el('smp-sw-clear').addEventListener('click', clearShopworks);
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
        loadShopworksFeed();   // auto ShopWorks cross-ref when the ODBC sync is live; else upload fallback
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

    // ==================== INVOICES TAB — open payables worklist ====================

    function loadInvoices() {
        var start = el('smp-start').value, end = el('smp-end').value;
        if (!start || !end) { DashPage.showError('Choose a start and end date.'); return; }
        if (start > end) { DashPage.showError('Start date must be on or before the end date.'); return; }
        DashPage.hideError();
        state.range = { start: start, end: end };
        el('smp-tbody').innerHTML = '<tr><td colspan="8" class="smp-empty dash-loading">Loading open SanMar payables…</td></tr>';
        el('smp-select-all').checked = false;
        // GetUnpaidInvoices returns the full open ledger; filter to vendor-1002 (non-MRKFUND) in the date window.
        fetchJson('/api/staff/sanmar-invoices/unpaid').then(function (data) {
            var all = (data.invoices || []).filter(function (i) { return !isMarketing(i); });
            state.olderCount = all.filter(function (i) { return String(i.invoiceDate) < start; }).length;
            state.unpaid = all.filter(function (i) {
                var d = String(i.invoiceDate);
                return d >= start && d <= end;
            }).sort(function (a, b) {
                return String(b.invoiceDate).localeCompare(String(a.invoiceDate)) ||
                       String(b.invoiceNumber).localeCompare(String(a.invoiceNumber));
            });
            renderInvoiceStats();
            renderInvoiceTable();
            el('smp-updated').textContent = 'SanMar open payables · ' +
                new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) +
                ' · ' + toMDY(start) + ' – ' + toMDY(end);
        }).catch(function (err) {
            DashPage.showError('Could not load open payables: ' + err.message + ' — refresh to retry.');
            el('smp-tbody').innerHTML = '<tr><td colspan="8" class="smp-empty">Not loaded — ' + esc(err.message) + '</td></tr>';
            state.unpaid = []; renderInvoiceStats();
        });
    }

    // ShopWorks status for one invoice. known=false until a ShopWorks export is loaded.
    function swStatus(inv) {
        if (!state.sw) return { known: false, imported: false, paid: false, datePaid: '' };
        var m = state.sw.map.get(normInv(inv.invoiceNumber));
        if (!m) return { known: true, imported: false, paid: false, datePaid: '' };
        var paid = !!(m.datePaid && m.datePaid.trim());
        return { known: true, imported: true, paid: paid, datePaid: m.datePaid };
    }

    function matchesStatus(inv) {
        if (!state.sw) return true;                 // no cross-ref → show all open
        var f = el('smp-status-filter').value, st = swStatus(inv);
        if (f === 'all') return true;
        if (f === 'open') return !st.paid;          // everything we still owe (our books)
        if (f === 'topay') return st.imported && !st.paid;
        return !st.imported && !st.paid;            // 'needimport' (default)
    }

    function filteredInvoices() {
        var po = el('smp-search-po').value.trim().toLowerCase();
        var inv = el('smp-search-inv').value.trim().toLowerCase();
        return state.unpaid.filter(function (i) {
            if (po && String(i.purchaseOrderNo || '').toLowerCase().indexOf(po) === -1) return false;
            if (inv && String(i.invoiceNumber || '').toLowerCase().indexOf(inv) === -1) return false;
            if (!matchesStatus(i)) return false;
            return true;
        });
    }

    function renderInvoiceStats() {
        var owed = state.unpaid.reduce(function (s, i) { return s + (Number(i.totalAmount) || 0); }, 0);
        el('smp-stat-count').textContent = state.unpaid.length;
        el('smp-stat-net').textContent = money(owed);
        var notImp = state.sw ? state.unpaid.filter(function (i) { return !swStatus(i).imported && !swStatus(i).paid; }).length : null;
        el('smp-stat-notimported').textContent = state.sw ? notImp : '—';
        // older-unpaid hint
        var hint = el('smp-older-hint');
        if (state.olderCount) { hint.textContent = '⚠ ' + state.olderCount + ' older unpaid item' + (state.olderCount === 1 ? '' : 's') + ' before ' + toMDY(state.range.start) + ' — widen the start date to review.'; hint.hidden = false; }
        else hint.hidden = true;
        updateSelectionCount();
    }

    function statusBadge(inv) {
        var st = swStatus(inv);
        if (!st.known) return '<span class="smp-badge smp-badge--zero" title="Upload a ShopWorks payables export to see status">—</span>';
        if (st.paid) return '<span class="smp-badge smp-badge--paid">PAID</span>';
        if (st.imported) return '<span class="smp-badge smp-badge--imported">IMPORTED · UNPAID</span>';
        return '<span class="smp-badge smp-badge--todo">NOT IMPORTED</span>';
    }

    function renderInvoiceTable() {
        var rows = filteredInvoices();
        if (!rows.length) {
            el('smp-tbody').innerHTML = '<tr><td colspan="8" class="smp-empty">' +
                (state.unpaid.length ? 'No open payables match the current filters.' : 'No open SanMar payables in this date range.') + '</td></tr>';
            el('smp-select-all').checked = false; updateSelectionCount(); return;
        }
        el('smp-tbody').innerHTML = rows.map(function (i, idx) {
            var neg = (Number(i.totalAmount) || 0) < 0;
            var ship = (i.shipTo && i.shipTo.name) ? i.shipTo.name : '';
            var st = swStatus(i);
            var box = '<input type="checkbox" class="smp-row-check" data-idx="' + idx + '"' + (st.paid ? '' : ' checked') + '>';
            return '<tr class="' + (neg ? 'smp-tr--credit' : '') + (st.paid ? ' smp-tr--excluded' : '') + '">' +
                '<td class="smp-check-cell">' + box + '</td>' +
                '<td>' + fmtWhen(i.invoiceDate) + '</td>' +
                '<td class="smp-inv">' + (neg ? 'CR-' : 'INV-') + esc(i.invoiceNumber) + '</td>' +
                '<td class="smp-po">' + esc(i.purchaseOrderNo || '—') + '</td>' +
                '<td class="smp-ship">' + esc(ship || '—') + '</td>' +
                '<td class="smp-amt ' + (neg ? 'smp-amt--credit' : '') + '">' + money(i.totalAmount) + '</td>' +
                '<td>' + statusBadge(i) + (st.paid && st.datePaid ? ' <span class="smp-paiddate">' + esc(st.datePaid) + '</span>' : '') + '</td>' +
                '<td>' + viewBtn(i, ship) + '</td>' +
                '</tr>';
        }).join('');
        Array.prototype.forEach.call(el('smp-tbody').querySelectorAll('.smp-row-check'), function (cb, i) {
            cb._invoice = rows[i];
            cb.addEventListener('change', function () { syncSelectAll(); updateSelectionCount(); });
        });
        wireViewButtons(el('smp-tbody'));
        syncSelectAll(); updateSelectionCount();
    }

    function syncSelectAll() {
        var boxes = el('smp-tbody').querySelectorAll('.smp-row-check:not([disabled])');
        var checked = el('smp-tbody').querySelectorAll('.smp-row-check:not([disabled]):checked');
        el('smp-select-all').checked = boxes.length > 0 && boxes.length === checked.length;
    }
    function selectedInvoices() {
        return Array.prototype.map.call(el('smp-tbody').querySelectorAll('.smp-row-check:checked'), function (cb) { return cb._invoice; }).filter(Boolean);
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

    // ---------- ShopWorks payables cross-reference (upload now; ODBC later) ----------

    // Minimal RFC-4180 parser — the ShopWorks export quotes money like "$1,189.96 ".
    function parseCsv(text) {
        var rows = [], row = [], cur = '', q = false;
        text = String(text).replace(/^﻿/, '');
        for (var i = 0; i < text.length; i++) {
            var c = text[i];
            if (q) {
                if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; }
                else cur += c;
            } else if (c === '"') { q = true; }
            else if (c === ',') { row.push(cur); cur = ''; }
            else if (c === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; }
            else if (c === '\r') { /* skip */ }
            else cur += c;
        }
        if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
        return rows;
    }

    function onShopworksFile(ev) {
        var file = ev.target.files && ev.target.files[0];
        if (!file) return;
        var reader = new FileReader();
        reader.onload = function () {
            try {
                ingestShopworks(String(reader.result));
                DashPage.hideError();
            } catch (e) {
                DashPage.showError('Could not read the ShopWorks export: ' + e.message);
            }
        };
        reader.onerror = function () { DashPage.showError('Could not read that file.'); };
        reader.readAsText(file);
        ev.target.value = '';
    }

    // Apply a ShopWorks payables map (from the auto ODBC feed OR a manual upload) →
    // enables the status filter, defaults to the worklist, re-renders.
    function applySw(map, statusText, allowClear) {
        state.sw = { map: map, count: map.size, at: new Date() };
        el('smp-status-filter').disabled = false;
        if (el('smp-status-filter').value === 'all') el('smp-status-filter').value = 'needimport';
        el('smp-sw-status').textContent = statusText;
        el('smp-sw-clear').hidden = !allowClear;
        renderInvoiceStats();
        renderInvoiceTable();
    }

    function ingestShopworks(text) {
        var rows = parseCsv(text);
        if (!rows.length) throw new Error('empty file');
        var header = rows[0].map(function (h) { return h.trim(); });
        var iInv = header.indexOf('InvoiceNumber');
        var iPaid = header.indexOf('date_Paid');
        var iOut = header.indexOf('cnCur_PayableOutstanding');
        if (iInv < 0) throw new Error('no "InvoiceNumber" column — is this the ShopWorks payables export?');
        var map = new Map();
        for (var r = 1; r < rows.length; r++) {
            var cells = rows[r];
            if (!cells || !cells[iInv]) continue;
            var key = normInv(cells[iInv]);
            if (!key) continue;
            map.set(key, { datePaid: iPaid >= 0 ? String(cells[iPaid] || '').trim() : '', outstanding: iOut >= 0 ? cells[iOut] : '' });
        }
        applySw(map, 'ShopWorks export loaded — ' + map.size + ' payable rows matched by invoice #.', true);
    }

    // Auto ODBC feed (bandit → Caspio ShopWorks_Payables). When it has rows, the page
    // skips the manual upload; when it's empty (sync not live yet) it silently leaves
    // the upload fallback in place. Optional — never surfaces an error banner.
    function loadShopworksFeed() {
        fetchJson('/api/staff/shopworks-payables?sinceDays=365').then(function (d) {
            if (!d || !d.count) return;              // sync not populated yet → keep upload fallback
            var map = new Map();
            (d.rows || []).forEach(function (row) {
                var key = normInv(row.InvoiceNumber);
                if (key && key !== '0') map.set(key, { datePaid: String(row.date_Paid || '').trim(), outstanding: row.cnCur_PayableOutstanding });
            });
            applySw(map, 'Auto-synced from ShopWorks · ' + map.size + ' payables (refreshes ~every 15 min).', false);
        }).catch(function () { /* optional feed — keep the upload fallback */ });
    }

    function clearShopworks() {
        state.sw = null;
        el('smp-status-filter').disabled = true;
        el('smp-status-filter').value = 'all';
        el('smp-sw-status').textContent = 'No ShopWorks export loaded — showing all open payables.';
        el('smp-sw-clear').hidden = true;
        renderInvoiceStats();
        renderInvoiceTable();
    }

    // ==================== MARKETING FUND TAB ====================

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
    function fetchByDate(start, end) {
        return fetchJson('/api/staff/sanmar-invoices/by-date?start=' + encodeURIComponent(start) + '&end=' + encodeURIComponent(end))
            .then(function (d) { return d.invoices || []; });
    }

    function loadMarketing() {
        DashPage.hideError();
        el('smp-mkt-tbody').innerHTML = '<tr><td colspan="5" class="smp-empty dash-loading">Loading marketing-fund activity…</td></tr>';
        el('smp-mkt-monthbars').innerHTML = '<div class="smp-empty dash-loading">Loading…</div>';
        Promise.all(ytdWindows().map(function (w) { return fetchByDate(w[0], w[1]); })).then(function (results) {
            var items = [];
            results.forEach(function (arr) { arr.forEach(function (i) { if (isMarketing(i)) items.push(i); }); });
            items.sort(function (a, b) {
                return String(b.invoiceDate).localeCompare(String(a.invoiceDate)) ||
                       String(b.invoiceNumber).localeCompare(String(a.invoiceNumber));
            });
            var byMonth = {};
            items.forEach(function (i) { var m = String(i.invoiceDate).slice(0, 7); byMonth[m] = (byMonth[m] || 0) + (Number(i.totalAmount) || 0); });
            state.mkt = { items: items, byMonth: byMonth, net: items.reduce(function (s, i) { return s + (Number(i.totalAmount) || 0); }, 0) };
            el('smp-mkt-updated').textContent = 'Pulled live from SanMar · ' + new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) + ' · Jan 1 – today';
            renderMarketingTable(); renderMarketingMonths(); renderMarketingSummary();
        }).catch(function (err) {
            DashPage.showError('Could not load marketing-fund activity: ' + err.message + ' — refresh to retry.');
            el('smp-mkt-tbody').innerHTML = '<tr><td colspan="5" class="smp-empty">Not loaded — ' + esc(err.message) + '</td></tr>';
            el('smp-mkt-monthbars').innerHTML = '';
        });
    }

    function renderMarketingSummary() {
        if (!state.mkt) return;
        var allowance = Number(el('smp-mkt-allowance').value) || 0;
        var spent = state.mkt.net, remaining = allowance - spent;
        var pct = allowance > 0 ? (spent / allowance) * 100 : 0;
        el('smp-mkt-spent').textContent = money0(spent);
        el('smp-mkt-remaining').textContent = money0(remaining);
        el('smp-mkt-used-pct').textContent = (allowance > 0 ? pct.toFixed(0) : '—') + '%';
        var yearStart = new Date(YEAR, 0, 1), now = new Date();
        var daysElapsed = Math.max(1, Math.round((now - yearStart) / 86400000));
        var daysInYear = (YEAR % 4 === 0 && (YEAR % 100 !== 0 || YEAR % 400 === 0)) ? 366 : 365;
        var projectedSpend = spent / daysElapsed * daysInYear;
        var projectedUnused = allowance - projectedSpend;
        var perMonth = spent / (daysElapsed / 30.44);
        el('smp-mkt-projected').textContent = money0(Math.max(0, projectedUnused));
        el('smp-mkt-projnote').textContent = projectedUnused > 0
            ? 'At the current pace (~' + money0(perMonth) + '/mo) you’re on track to spend ~' + money0(projectedSpend) + ' and leave ~' + money0(projectedUnused) + ' of the fund UNUSED by Dec 31.'
            : 'At the current pace (~' + money0(perMonth) + '/mo) you’re on track to spend ~' + money0(projectedSpend) + ' — about ' + money0(-projectedUnused) + ' OVER the fund by Dec 31.';
        var fillPct = allowance > 0 ? Math.min(100, Math.max(0, pct)) : 0;
        var bar = el('smp-mkt-bar');
        bar.style.width = fillPct.toFixed(1) + '%';
        bar.classList.toggle('smp-progress-fill--over', spent > allowance);
        el('smp-mkt-bar-spent').textContent = money0(spent);
        el('smp-mkt-bar-left').textContent = money0(Math.max(0, remaining));
    }

    function renderMarketingMonths() {
        if (!state.mkt) return;
        var byMonth = state.mkt.byMonth, keys = Object.keys(byMonth).sort();
        if (!keys.length) { el('smp-mkt-monthbars').innerHTML = '<p class="smp-empty">No marketing charges yet this year.</p>'; return; }
        var max = Math.max.apply(null, keys.map(function (k) { return Math.abs(byMonth[k]); }).concat([1]));
        el('smp-mkt-monthbars').innerHTML = keys.map(function (k) {
            var v = byMonth[k], label = new Date(k + '-01T12:00:00').toLocaleDateString('en-US', { month: 'short' });
            var w = (Math.abs(v) / max) * 100;
            return '<div class="smp-monthrow"><span class="smp-monthlbl">' + esc(label) + '</span>' +
                '<span class="smp-monthbar-track"><span class="smp-monthbar-fill' + (v < 0 ? ' smp-monthbar-fill--credit' : '') + '" style="width:' + w.toFixed(1) + '%"></span></span>' +
                '<span class="smp-monthval">' + money(v) + '</span></div>';
        }).join('');
    }

    function renderMarketingTable() {
        if (!state.mkt) return;
        var items = state.mkt.items;
        el('smp-mkt-item-count').textContent = items.length;
        if (!items.length) { el('smp-mkt-tbody').innerHTML = '<tr><td colspan="5" class="smp-empty">No marketing-fund charges this year.</td></tr>'; return; }
        el('smp-mkt-tbody').innerHTML = items.map(function (i) {
            var neg = (Number(i.totalAmount) || 0) < 0;
            var ship = (i.shipTo && i.shipTo.name) ? i.shipTo.name : '';
            return '<tr class="' + (neg ? 'smp-tr--credit' : '') + '">' +
                '<td>' + fmtWhen(i.invoiceDate) + '</td>' +
                '<td class="smp-inv">' + (neg ? 'CR-' : 'INV-') + esc(i.invoiceNumber) + '</td>' +
                '<td class="smp-po">' + esc(i.purchaseOrderNo || '—') + '</td>' +
                '<td class="smp-amt ' + (neg ? 'smp-amt--credit' : '') + '">' + money(i.totalAmount) + '</td>' +
                '<td>' + viewBtn(i, ship) + '</td></tr>';
        }).join('');
        wireViewButtons(el('smp-mkt-tbody'));
    }

    function downloadMarketingCsv() {
        if (!state.mkt || !state.mkt.items.length) { DashPage.showError('No marketing-fund charges to export.'); return; }
        DashPage.hideError();
        downloadCsvFile(state.mkt.items.map(function (i) { return csvRow(i, '2425'); }), 'Sanmar_Marketing_2425_' + YEAR + '_YTD.csv');
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

    // Test seam: harness pre-loads a ShopWorks payables fixture (no file dialog).
    if (window.__SMP_TEST_SW__) { try { ingestShopworks(window.__SMP_TEST_SW__); } catch (e) { /* harness only */ } }
})();
