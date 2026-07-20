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
        el('pp-invoice-close').addEventListener('click', closeInvoiceModal);
        el('pp-invoice-overlay').addEventListener('click', closeInvoiceModal);
        el('pp-invoice-print').addEventListener('click', printInvoice);
        document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeInvoiceModal(); });
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
                        sanmarPos: o.sanmarPos || [],
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
            el('pp-tbody').innerHTML = '<tr><td colspan="11" class="pp-empty">No purchase requests match.</td></tr>';
            return;
        }
        el('pp-tbody').innerHTML = rows.map(function (r) {
            var invBtn = (r.sanmarPos && r.sanmarPos.length)
                ? '<button type="button" class="pp-invoice-btn" data-wo="' + esc(r.wo) + '" data-company="' + esc(r.company) + '" data-pos="' + esc(r.sanmarPos.join(',')) + '" data-ordered="' + esc(r.orderedDate || '') + '"><i class="fas fa-file-invoice-dollar"></i> View</button>'
                : '—';
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
                '<td>' + invBtn + '</td>' +
                '</tr>';
        }).join('');
        Array.prototype.forEach.call(el('pp-tbody').querySelectorAll('.pp-invoice-btn'), function (btn) {
            btn.addEventListener('click', function () {
                openInvoiceModal(btn.dataset.wo, btn.dataset.company, btn.dataset.pos.split(',').filter(Boolean), btn.dataset.ordered);
            });
        });
    }

    // ---------- SanMar invoice modal (on-screen + Print / Save PDF) ----------
    // SanMar's GetInvoiceByPurchaseOrderNo is keyed by our PO number (the
    // ShopWorks ID_PO on SanMar orders — same match the inbound dashboard
    // uses). Fetched browser-direct from the proxy (rate-limited GET).

    function money2(v) {
        return '$' + (Math.round((Number(v) || 0) * 100) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    function invoiceHtml(inv, wo, company) {
        var lines = (inv.lineItems || []).map(function (li) {
            return '<tr>' +
                '<td>' + esc(li.styleNo) + '</td>' +
                '<td>' + esc(li.description || '') + '</td>' +
                '<td>' + esc(li.color || '') + '</td>' +
                '<td>' + esc(li.size || '') + '</td>' +
                '<td class="pp-inv-num">' + (li.quantity || 0) + '</td>' +
                '<td class="pp-inv-num">' + money2(li.unitPrice) + '</td>' +
                '<td class="pp-inv-num">' + money2(li.lineTotal) + '</td>' +
                '</tr>';
        }).join('');
        var ship = inv.shipTo || {};
        return '<div class="pp-inv">' +
            '<div class="pp-inv-top">' +
            '<div class="pp-inv-brand">SanMar Corporation<small>Invoice — Northwest Custom Apparel' + (wo ? ' · WO #' + esc(wo) : '') + (company ? ' · ' + esc(company) : '') + '</small></div>' +
            '<div class="pp-inv-no"><strong>Invoice ' + esc(inv.invoiceNumber || '—') + '</strong><br>' + esc(inv.invoiceDate || '') +
            (inv.invoiceStatus ? '<br><span class="pp-inv-badge">' + esc(inv.invoiceStatus) + '</span>' : '') + '</div>' +
            '</div>' +
            '<dl class="pp-inv-meta">' +
            '<div><dt>PO #</dt><dd>' + esc(inv.purchaseOrderNo || '—') + '</dd></div>' +
            '<div><dt>Order date</dt><dd>' + esc(inv.orderDate || '—') + '</dd></div>' +
            '<div><dt>Terms</dt><dd>' + esc(inv.terms || '—') + '</dd></div>' +
            '<div><dt>Due date</dt><dd>' + esc(inv.dueDate || '—') + '</dd></div>' +
            '<div><dt>Ship via</dt><dd>' + esc(inv.shipVia || '—') + '</dd></div>' +
            '<div><dt>Ship to</dt><dd>' + esc([ship.name, ship.city, ship.state].filter(Boolean).join(', ') || '—') + '</dd></div>' +
            '</dl>' +
            '<table><thead><tr><th>Style</th><th>Description</th><th>Color</th><th>Size</th><th>Qty</th><th>Unit</th><th>Ext</th></tr></thead>' +
            '<tbody>' + (lines || '<tr><td colspan="7">No line items returned.</td></tr>') + '</tbody></table>' +
            '<div class="pp-inv-totals">' +
            '<div><span>Subtotal</span><span class="pp-inv-num">' + money2(inv.subtotal) + '</span></div>' +
            '<div><span>Shipping &amp; handling</span><span class="pp-inv-num">' + money2(inv.shippingCharges) + '</span></div>' +
            (inv.freightSavings ? '<div><span>Freight savings</span><span class="pp-inv-num">-' + money2(inv.freightSavings) + '</span></div>' : '') +
            '<div><span>Sales tax</span><span class="pp-inv-num">' + money2(inv.salesTax) + '</span></div>' +
            '<div class="pp-inv-grand"><span>Total</span><span class="pp-inv-num">' + money2(inv.totalAmount) + '</span></div>' +
            '</div></div>';
    }

    function openInvoiceModal(wo, company, pos, orderedDate) {
        el('pp-invoice-overlay').hidden = false;
        el('pp-invoice-modal').hidden = false;
        el('pp-invoice-title').innerHTML = '<i class="fas fa-file-invoice-dollar"></i> SanMar Invoice — WO #' + esc(wo);
        el('pp-invoice-print').disabled = true;
        var body = el('pp-invoice-body');
        body.innerHTML = '<div class="dash-loading">Fetching the invoice from SanMar…</div>';

        // orderedDate narrows the server's SanMar invoice-date search window.
        var dateParam = /^\d{4}-\d{2}-\d{2}$/.test(orderedDate || '') ? '?orderedDate=' + orderedDate : '';
        Promise.all(pos.map(function (po) {
            return DashPage.fetchJson('/api/sanmar-invoices/by-po/' + encodeURIComponent(po) + dateParam)
                .then(function (r) { return { po: po, invoices: r.invoices || [] }; })
                .catch(function (err) { return { po: po, error: err.message }; });
        })).then(function (results) {
            var html = '';
            results.forEach(function (r) {
                if (r.error) {
                    html += '<div class="pp-empty">PO ' + esc(r.po) + ': invoice lookup failed (' + esc(r.error) + ').</div>';
                } else if (!r.invoices.length) {
                    html += '<div class="pp-empty">PO ' + esc(r.po) + ': SanMar has not invoiced this PO yet — it may still be open or very recent.</div>';
                } else {
                    r.invoices.forEach(function (inv) { html += invoiceHtml(inv, wo, company); });
                }
            });
            body.innerHTML = html || '<div class="pp-empty">No invoices found.</div>';
            el('pp-invoice-print').disabled = !body.querySelector('.pp-inv');
        });
    }

    function closeInvoiceModal() {
        el('pp-invoice-overlay').hidden = true;
        el('pp-invoice-modal').hidden = true;
    }

    /** Print just the invoice(s): clone into a print sheet, body class hides
     *  everything else (same pattern as the SanMar inbound print report). */
    function printInvoice() {
        var invoices = el('pp-invoice-body').querySelectorAll('.pp-inv');
        if (!invoices.length) return;
        var old = document.getElementById('pp-print-sheet');
        if (old) old.remove();
        var sheet = document.createElement('div');
        sheet.id = 'pp-print-sheet';
        Array.prototype.forEach.call(invoices, function (inv) { sheet.appendChild(inv.cloneNode(true)); });
        document.body.appendChild(sheet);
        document.body.classList.add('pp-printing');
        var cleanup = function () {
            document.body.classList.remove('pp-printing');
            var s = document.getElementById('pp-print-sheet');
            if (s) s.remove();
            window.removeEventListener('afterprint', cleanup);
        };
        window.addEventListener('afterprint', cleanup);
        window.print();
        setTimeout(function () { if (document.body.classList.contains('pp-printing')) cleanup(); }, 1500);
    }
})();
