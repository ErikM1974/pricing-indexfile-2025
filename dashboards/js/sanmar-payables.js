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
        loadError: '', invoicesLoading: true, invoiceRequest: 0, marking: false,
        imports: null, importsLoaded: false, // Map(normInv → {date}) — self-managed "imported to ShopWorks" stamps (primary)
        sw: null,       // { map: Map(normInv → {datePaid, outstanding}) } — optional ShopWorks feed/upload (adds Paid)
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
    // LOCAL calendar day — toISOString() is UTC, which after 5 PM Pacific is already tomorrow (the
    // default date range and the import-stamp date were a day ahead every evening).
    function localIso(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
    function isoDaysAgo(n) { var d = new Date(); d.setDate(d.getDate() - n); return localIso(d); }
    function todayIso() { return localIso(new Date()); }
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
        var blob = new Blob(['\uFEFF' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
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
        var tabs = Array.prototype.slice.call(document.querySelectorAll('.smp-tab'));
        tabs.forEach(function (btn, i) {
            btn.addEventListener('click', function () { switchTab(btn.dataset.tab); });
            // WAI-ARIA tabs: arrow keys move between Invoices / Marketing Fund
            btn.addEventListener('keydown', function (e) {
                if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
                var n = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
                n.focus(); switchTab(n.dataset.tab);
            });
        });
        // Stat tiles set the Show filter (click the active tile to go back to "Not imported & unpaid")
        Array.prototype.forEach.call(document.querySelectorAll('.smp-stat-btn'), function (t) {
            t.addEventListener('click', function () {
                var sel = el('smp-status-filter');
                if (sel.disabled) return;
                var f = t.dataset.filter;
                sel.value = (sel.value === f) ? 'needimport' : f;
                renderInvoiceTable();
            });
        });
        // The visible native file input owns keyboard file selection.
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
        el('smp-markimported').addEventListener('click', markSelectedImported);
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
        loadImports();         // PRIMARY imported cross-ref = your own stamp log (no ShopWorks needed)
        loadShopworksFeed();   // OPTIONAL: adds Paid status when the ODBC sync is live / you upload
    });

    function switchTab(tab) {
        if (tab === state.activeTab) return;
        state.activeTab = tab;
        Array.prototype.forEach.call(document.querySelectorAll('.smp-tab'), function (b) {
            var on = b.dataset.tab === tab;
            b.classList.toggle('is-active', on);
            b.setAttribute('aria-selected', on ? 'true' : 'false');
            b.tabIndex = on ? 0 : -1;
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
        var request = ++state.invoiceRequest;
        state.invoicesLoading = true; state.loadError = ''; state.unpaid = []; state.olderCount = 0;
        el('smp-updated').textContent = 'Loading open payables…';
        renderInvoiceStats();
        el('smp-tbody').innerHTML = '<tr><td colspan="8" class="smp-empty dash-loading">Loading open SanMar payables…</td></tr>';
        el('smp-select-all').checked = false;
        // GetUnpaidInvoices returns the full open ledger; filter to vendor-1002 (non-MRKFUND) in the date window.
        fetchJson('/api/staff/sanmar-invoices/unpaid').then(function (data) {
            if (request !== state.invoiceRequest) return;
            var all = invoiceRows(data).filter(function (i) { return !isMarketing(i); });
            state.loadError = ''; state.invoicesLoading = false;
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
            if (request !== state.invoiceRequest) return;
            state.invoicesLoading = false;
            el('smp-updated').textContent = 'Not loaded — retry to update balances.';
            DashPage.showError('Could not load open payables: ' + err.message);
            // Remember the failure: renderInvoiceTable() is also called by the imports/ShopWorks feeds
            // when THEY land, and used to overwrite this row with "No open payables in this range".
            state.loadError = err.message || 'request failed';
            state.unpaid = []; renderInvoiceStats(); renderInvoiceTable();
        });
    }

    // Combined imported/paid status for one invoice, from BOTH the import-stamp log
    // (Erik marks it on import — the PRIMARY signal, no ShopWorks needed) and the
    // optional ShopWorks feed/upload (adds the paid date). known=false until at least
    // one source has loaded.
    function swStatus(inv) {
        var known = state.importsLoaded || !!state.sw;
        if (!known) return { known: false, imported: false, paid: false, datePaid: '', importedDate: '' };
        var norm = normInv(inv.invoiceNumber);
        var stamp = state.imports ? state.imports.get(norm) : null;
        var m = state.sw ? state.sw.map.get(norm) : null;
        var paid = !!(m && m.datePaid && m.datePaid.trim());
        return { known: true, imported: !!(stamp || m), paid: paid, datePaid: m ? m.datePaid : '', importedDate: stamp ? stamp.date : '' };
    }

    function syncStatTiles() {
        var sel = el('smp-status-filter');
        Array.prototype.forEach.call(document.querySelectorAll('.smp-stat-btn'), function (t) {
            t.setAttribute('aria-pressed', (!sel.disabled && sel.value === t.dataset.filter) ? 'true' : 'false');
        });
    }

    function matchesStatus(inv) {
        var st = swStatus(inv);
        if (!st.known) return true;                 // nothing loaded yet → show all open
        var f = el('smp-status-filter').value;
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
        if (state.invoicesLoading || state.loadError) {
            ['smp-stat-count', 'smp-stat-net', 'smp-stat-notimported'].forEach(function (id) { el(id).textContent = '—'; });
            el('smp-older-hint').hidden = true; updateSelectionCount(); return;
        }
        var owed = state.unpaid.reduce(function (s, i) { return s + (Number(i.totalAmount) || 0); }, 0);
        el('smp-stat-count').textContent = state.unpaid.length;
        el('smp-stat-net').textContent = money(owed);
        var known = state.importsLoaded || !!state.sw;
        var notImp = known ? state.unpaid.filter(function (i) { var s = swStatus(i); return !s.imported && !s.paid; }).length : null;
        el('smp-stat-notimported').textContent = known ? notImp : '—';
        // older-unpaid hint
        var hint = el('smp-older-hint');
        if (state.olderCount) { hint.textContent = '⚠ ' + state.olderCount + ' older unpaid item' + (state.olderCount === 1 ? '' : 's') + ' before ' + toMDY(state.range.start) + ' — widen the start date to review.'; hint.hidden = false; }
        else hint.hidden = true;
        updateSelectionCount();
    }

    function statusBadge(inv) {
        var st = swStatus(inv);
        if (!st.known) return '<span class="smp-badge smp-badge--zero">—</span>';
        if (st.paid) return '<span class="smp-badge smp-badge--paid">PAID</span>';
        if (st.imported) return '<span class="smp-badge smp-badge--imported">IMPORTED' + (st.importedDate ? ' ' + esc(st.importedDate) : '') + '</span>';
        return '<span class="smp-badge smp-badge--todo">NOT IMPORTED</span>';
    }

    function renderInvoiceTable() {
        syncStatTiles();
        var rows = filteredInvoices();
        if (state.invoicesLoading) {
            el('smp-tbody').innerHTML = '<tr><td colspan="8" class="smp-empty dash-loading">Loading open SanMar payables…</td></tr>';
            updateSelectionCount(); return;
        }
        if (!rows.length && state.loadError) {
            el('smp-tbody').innerHTML = '<tr><td colspan="8" class="smp-empty" role="alert">Not loaded — ' + esc(state.loadError) + ' ' +
                '<button type="button" class="dash-btn smp-retry btn btn-secondary" id="smp-inv-retry">Retry</button></td></tr>';
            var rb = el('smp-inv-retry'); if (rb) rb.addEventListener('click', loadInvoices);
            el('smp-select-all').checked = false; updateSelectionCount(); return;
        }
        if (!rows.length) {
            el('smp-tbody').innerHTML = '<tr><td colspan="8" class="smp-empty">' +
                (state.unpaid.length ? 'No open payables match the current filters.' : 'No open SanMar payables in this date range.') + '</td></tr>';
            el('smp-select-all').checked = false; updateSelectionCount(); return;
        }
        el('smp-tbody').innerHTML = rows.map(function (i, idx) {
            var neg = (Number(i.totalAmount) || 0) < 0;
            var ship = (i.shipTo && i.shipTo.name) ? i.shipTo.name : '';
            var st = swStatus(i);
            var done = st.imported || st.paid;
            var box = '<input type="checkbox" class="smp-row-check" aria-label="Select invoice" data-idx="' + idx + '"' + (done ? '' : ' checked') + '>';
            return '<tr class="' + (neg ? 'smp-tr--credit' : '') + (done ? ' smp-tr--excluded' : '') + '">' +
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
        var dl = el('smp-download');
        var unavailable = state.invoicesLoading || !!state.loadError || !(state.importsLoaded || state.sw);
        dl.disabled = n === 0 || unavailable;
        dl.querySelector('.smp-download-count').textContent = n;
        var mk = el('smp-markimported');
        if (mk) { mk.disabled = n === 0 || unavailable || state.marking; var c = mk.querySelector('.smp-mark-count'); if (c) c.textContent = n; }
    }

    function downloadStandardCsv() {
        if (el('smp-download').disabled) { DashPage.showError('Wait for invoice and imported-status data before exporting.'); return; }
        var picks = selectedInvoices();
        if (!picks.length) { DashPage.showError('Select at least one invoice to export.'); return; }
        DashPage.hideError();
        downloadCsvFile(picks.map(function (i) { return csvRow(i, '1002'); }),
            'Sanmar_Payables_1002_' + state.range.start + '_to_' + state.range.end + '.csv');
    }

    // ---------- Import-stamp log (the self-managed "imported to ShopWorks" record) ----------

    // Normalize a Caspio Date/Time to M/D/YYYY for display.
    function fmtStamp(v) {
        var s = String(v || ''), m = /(\d{4})-(\d{2})-(\d{2})/.exec(s);
        if (m) return Number(m[2]) + '/' + Number(m[3]) + '/' + m[1];
        m = /(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(s);
        return m ? Number(m[1]) + '/' + Number(m[2]) + '/' + m[3] : s.slice(0, 10);
    }
    function enableStatusFilter() {
        el('smp-status-filter').disabled = false;
        if (el('smp-status-filter').value === 'all') el('smp-status-filter').value = 'needimport';
    }
    function statusLine() {
        var parts = [];
        if (state.importsLoaded && state.imports) parts.push(state.imports.size + ' marked imported (your log)');
        if (state.sw) parts.push('ShopWorks paid status loaded');
        return parts.length ? parts.join(' · ') : 'Loading imported status…';
    }

    // Load the import-stamp log → the PRIMARY imported cross-reference (no ShopWorks needed).
    function loadImports() {
        state.importsLoaded = false; state.imports = null;
        if (!state.sw) { el('smp-status-filter').disabled = true; el('smp-status-filter').value = 'all'; }
        updateSelectionCount();
        fetchJson('/api/staff/sanmar-invoices/imports').then(function (d) {
            if (!d || !Array.isArray(d.imports) || d.imports.some(function (row) { return !row || !row.InvoiceNumber; })) throw new Error('Incomplete imported-status response');
            var map = new Map();
            d.imports.forEach(function (row) {
                var key = normInv(row.InvoiceNumber);
                if (key && key !== '0') map.set(key, { date: fmtStamp(row.Date_Imported) });
            });
            state.imports = map; state.importsLoaded = true;
            el('smp-sw-status').classList.remove('smp-sw-status--warn');
            enableStatusFilter();
            el('smp-sw-status').textContent = statusLine();
            renderInvoiceStats(); renderInvoiceTable();
        }).catch(function (err) {
            // Rule 4: the imported cross-reference failing must be SEEN — otherwise every row reads
            // "NOT IMPORTED" and looks like fresh work.
            state.importsLoaded = false; state.imports = null;
            var st = el('smp-sw-status');
            st.textContent = '\u26a0 Import log unavailable (' + (err.message || 'request failed') + ') — retry or load a ShopWorks export to check imported status. ';
            st.classList.add('smp-sw-status--warn');
            var rb = document.createElement('button');
            rb.type = 'button'; rb.className = 'smp-linkbtn btn btn-secondary'; rb.textContent = 'Retry';
            rb.addEventListener('click', function () { st.classList.remove('smp-sw-status--warn'); st.textContent = 'Loading imported status…'; state.importsLoaded = false; loadImports(); });
            st.appendChild(rb);
            renderInvoiceStats(); renderInvoiceTable();
        });
    }

    // Stamp the selected (not-yet-imported) invoices → they drop off the worklist.
    function markSelectedImported() {
        if (el('smp-markimported').disabled) return;
        var picks = selectedInvoices().filter(function (i) { return !swStatus(i).imported; });
        if (!picks.length) { DashPage.showError('Select invoices that are not already imported.'); return; }
        if (!window.confirm('Mark ' + picks.length + ' invoice' + (picks.length === 1 ? '' : 's') + ' as imported into ShopWorks? They will drop off the "not imported" list.')) return;
        DashPage.hideError();
        var payload = { invoices: picks.map(function (i) {
            var neg = (Number(i.totalAmount) || 0) < 0;
            return { invoiceNumber: (neg ? 'CR-' : 'INV-') + String(i.invoiceNumber), payableDate: toMDY(i.invoiceDate), amount: Number(i.totalAmount) || 0, poNumber: String(i.purchaseOrderNo || ''), vendor: '1002' };
        }) };
        var btn = el('smp-markimported'); state.marking = true; btn.disabled = true;
        fetch('/api/staff/sanmar-invoices/mark-imported', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
            .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
            .then(function (res) {
                var when = fmtStamp(res.date || todayIso());
                if (!state.imports) state.imports = new Map();
                picks.forEach(function (i) { state.imports.set(normInv(i.invoiceNumber), { date: when }); });
                state.importsLoaded = true;
                renderInvoiceStats(); renderInvoiceTable();
                el('smp-sw-status').textContent = '✓ Marked ' + (res.stamped != null ? res.stamped : picks.length) + ' imported · ' + statusLine();
            })
            .catch(function (err) { DashPage.showError('Could not mark imported: ' + err.message); })
            .then(function () { state.marking = false; updateSelectionCount(); });
    }

    // ---------- ShopWorks payables cross-reference (upload now; ODBC later) ----------

    // Minimal RFC-4180 parser — the ShopWorks export quotes money like "$1,189.96 ".
    function parseCsv(text) {
        var rows = [], row = [], cur = '', q = false;
        text = String(text).replace(/^\uFEFF/, '');
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
        el('purchasing-feed-status').textContent = statusText;
        el('purchasing-feed-status').classList.remove('smp-sw-status--warn');
        enableStatusFilter();
        el('smp-sw-status').textContent = statusLine();
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
    // skips the manual upload. Empty or unavailable sync is explained beside the
    // manual fallback so absence of paid-status data cannot look like a complete sync.
    function loadShopworksFeed() {
        fetchJson('/api/staff/shopworks-payables?sinceDays=365').then(function (d) {
            if (!d || !Array.isArray(d.rows) || d.rows.some(function (row) { return !row || !row.InvoiceNumber; })) throw new Error('Incomplete ShopWorks response');
            if (!d.rows.length) { el('purchasing-feed-status').textContent = 'ShopWorks paid-status sync has no data. Upload an export to check payments.'; return; }
            var map = new Map();
            d.rows.forEach(function (row) {
                var key = normInv(row.InvoiceNumber);
                if (key && key !== '0') map.set(key, { datePaid: String(row.date_Paid || '').trim(), outstanding: row.cnCur_PayableOutstanding });
            });
            applySw(map, 'Auto-synced from ShopWorks · ' + map.size + ' payables (refreshes ~every 15 min).', false);
        }).catch(function (err) {
            var status = el('purchasing-feed-status');
            status.textContent = 'ShopWorks paid-status sync unavailable (' + (err.message || 'request failed') + '). Upload an export to check payments.';
            status.classList.add('smp-sw-status--warn');
        });
    }

    function clearShopworks() {
        state.sw = null;
        el('purchasing-feed-status').textContent = 'ShopWorks paid status cleared. Upload an export to check payments.';
        if (!(state.importsLoaded && state.imports)) { el('smp-status-filter').disabled = true; el('smp-status-filter').value = 'all'; }
        el('smp-sw-clear').hidden = true;
        el('smp-sw-status').textContent = statusLine();
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
    // Reject missing or invalid ledger data before it can look like a zero balance.
    function invoiceRows(data) {
        if (!data || !Array.isArray(data.invoices) || data.invoices.some(function (i) {
            return !i || !i.invoiceNumber || !/^\d{4}-\d{2}-\d{2}$/.test(String(i.invoiceDate)) ||
                i.totalAmount == null || String(i.totalAmount).trim() === '' || !Number.isFinite(Number(i.totalAmount));
        })) throw new Error('Incomplete invoice response');
        return data.invoices;
    }

    function fetchByDate(start, end) {
        return fetchJson('/api/staff/sanmar-invoices/by-date?start=' + encodeURIComponent(start) + '&end=' + encodeURIComponent(end))
            .then(invoiceRows);
    }

    function loadMarketing() {
        state.mkt = null;
        el('smp-mkt-download').disabled = true;
        ['smp-mkt-spent', 'smp-mkt-remaining', 'smp-mkt-used-pct', 'smp-mkt-projected', 'smp-mkt-bar-spent', 'smp-mkt-bar-left', 'smp-mkt-item-count'].forEach(function (id) { el(id).textContent = '—'; });
        el('smp-mkt-projnote').textContent = '';
        el('smp-mkt-bar').style.setProperty('--w', '0%');
        el('smp-mkt-progress').removeAttribute('aria-valuenow');
        el('smp-mkt-updated').textContent = 'Loading marketing-fund activity…';
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
            el('smp-mkt-download').disabled = !items.length;
        }).catch(function (err) {
            el('smp-mkt-updated').textContent = 'Not loaded — retry to update the fund.';
            DashPage.showError('Could not load marketing-fund activity: ' + err.message);
            el('smp-mkt-tbody').innerHTML = '<tr><td colspan="5" class="smp-empty" role="alert">Not loaded — ' + esc(err.message) + ' ' +
                '<button type="button" class="dash-btn smp-retry btn btn-secondary" id="smp-mkt-retry">Retry</button></td></tr>';
            var rb = el('smp-mkt-retry'); if (rb) rb.addEventListener('click', loadMarketing);
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
        bar.style.setProperty('--w', fillPct.toFixed(1) + '%');
        bar.classList.toggle('smp-progress-fill--over', spent > allowance);
        var prog = el('smp-mkt-progress');
        if (prog) prog.setAttribute('aria-valuenow', String(Math.round(fillPct)));
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
                '<span class="smp-monthbar-track"><span class="smp-monthbar-fill' + (v < 0 ? ' smp-monthbar-fill--credit' : '') + '" style="--w:' + w.toFixed(1) + '%"></span></span>' +
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
        return '<button type="button" class="smp-view-btn btn btn-secondary" data-po="' + esc(basePo(i.purchaseOrderNo)) +
            '" data-company="' + esc(ship || '') + '" data-ordered="' + esc(i.orderDate || '') +
            '" aria-label="View SanMar invoice ' + esc(i.invoiceNumber || '') + '"><i class="fas fa-file-invoice-dollar" aria-hidden="true"></i> View</button>';
    }
    function wireViewButtons(scope) {
        Array.prototype.forEach.call(scope.querySelectorAll('.smp-view-btn'), function (btn) {
            btn.addEventListener('click', function () {
                if (!window.SanMarInvoiceViewer) { DashPage.showError('Invoice viewer failed to load — refresh the page.'); return; }
                var po = btn.dataset.po;
                if (!po) { DashPage.showError('This invoice has no numeric PO to look up.'); return; }
                window.SanMarInvoiceViewer.open({ pos: [po], company: btn.dataset.company, orderedDate: btn.dataset.ordered, returnFocus: btn });
            });
        });
    }

    // Test seam: harness pre-loads a ShopWorks payables fixture (no file dialog).
    if (window.__SMP_TEST_SW__) { try { ingestShopworks(window.__SMP_TEST_SW__); } catch (e) { /* harness only */ } }
})();
