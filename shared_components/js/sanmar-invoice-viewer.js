/* sanmar-invoice-viewer.js — shared SanMar invoice modal (on-screen + Print/Save PDF).
 *
 * Used by BOTH the Purchasing Portal and the AE Mission Control purchasing
 * card, so the invoice document renders identically everywhere (one component,
 * never two drifting copies).
 *
 * Usage:
 *   <link rel="stylesheet" href="/shared_components/css/sanmar-invoice-viewer.css">
 *   <script src="/shared_components/js/sanmar-invoice-viewer.js"></script>
 *   SanMarInvoiceViewer.open({ wo: 142398, company: 'Acme', pos: ['113606'], orderedDate: '2026-07-09' });
 *
 * Data: GET {APP_CONFIG.API.BASE_URL}/api/sanmar-invoices/by-po/:po[?orderedDate=]
 * (browser-direct, rate-limited proxy GET). The modal DOM is created on first
 * open. Print clones the invoice(s) into #smiv-print-sheet and body.smiv-printing
 * hides everything else (same pattern as the SanMar inbound print report).
 * Failures are VISIBLE per-PO — never a silently empty invoice.
 */
(function () {
    'use strict';

    function unified() { return document.body.dataset.invoiceViewer === 'unified'; }
    function decorateInvoices(body) {
        if (!unified()) return;
        Array.prototype.forEach.call(body.querySelectorAll('.smiv-inv table'), function (table) {
            table.classList.add('data-table');
            var wrap = document.createElement('div'); wrap.className = 'table-wrap'; wrap.tabIndex = 0;
            wrap.setAttribute('role', 'region'); wrap.setAttribute('aria-label', 'SanMar invoice line items');
            table.replaceWith(wrap); wrap.appendChild(table);
        });
    }

    function esc(v) {
        return String(v == null ? '' : v)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }
    function money2(v) {
        return '$' + (Math.round((Number(v) || 0) * 100) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    function apiBase() {
        return (window.APP_CONFIG && window.APP_CONFIG.API && window.APP_CONFIG.API.BASE_URL) || '';
    }

    function ensureModal() {
        if (document.getElementById('smiv-modal')) return;
        var overlay = document.createElement('div');
        overlay.className = 'smiv-overlay';
        overlay.id = 'smiv-overlay';
        overlay.hidden = true;
        var modal = document.createElement(unified() ? 'dialog' : 'div');
        modal.className = 'smiv-modal' + (unified() ? ' ui-dialog' : '');
        modal.id = 'smiv-modal';
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-modal', 'true');
        modal.setAttribute('aria-labelledby', 'smiv-title');
        modal.hidden = true;
        modal.innerHTML =
            '<div class="smiv-head">' +
            '<h2 class="smiv-title" id="smiv-title"><i class="fas fa-file-invoice-dollar" aria-hidden="true"></i> SanMar Invoice</h2>' +
            '<div class="smiv-head-actions">' +
            '<button type="button" id="smiv-print" class="smiv-btn smiv-btn--primary"><i class="fas fa-print" aria-hidden="true"></i> Print / Save PDF</button>' +
            '<button type="button" class="smiv-close" id="smiv-close" aria-label="Close"><i class="fas fa-times" aria-hidden="true"></i></button>' +
            '</div></div>' +
            '<div class="smiv-body" id="smiv-body" role="status" aria-live="polite"></div>';
        document.body.appendChild(overlay);
        document.body.appendChild(modal);
        if (unified()) {
            document.getElementById('smiv-print').classList.add('btn', 'btn-primary');
            document.getElementById('smiv-close').classList.add('btn', 'btn-secondary');
            modal.addEventListener('cancel', function (event) { event.preventDefault(); close(); });
        }
        document.getElementById('smiv-close').addEventListener('click', close);
        overlay.addEventListener('click', close);
        document.getElementById('smiv-print').addEventListener('click', print);
        document.addEventListener('keydown', function (e) {
            var m = document.getElementById('smiv-modal');
            if (e.key === 'Escape' && m && !m.hidden) close();
            if (e.key === 'Tab' && unified() && m && m.open) {
                var items = Array.prototype.filter.call(m.querySelectorAll('a[href],button:not([disabled]),[tabindex="0"]'), function (n) { return n.checkVisibility(); });
                var first = items[0], last = items[items.length - 1];
                if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
                else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
            }
        });
    }

    var returnFocus = null;
    var requestSerial = 0;
    function close() {
        var o = document.getElementById('smiv-overlay'), m = document.getElementById('smiv-modal');
        var wasOpen = !!(m && !m.hidden);
        if (o) o.hidden = true;
        if (wasOpen) requestSerial++;
        if (m && typeof m.close === 'function' && m.open) m.close();
        if (m) m.hidden = true;
        if (wasOpen && returnFocus && document.body.contains(returnFocus)) { try { returnFocus.focus(); } catch (e) { /* gone */ } }
        returnFocus = null;
    }

    function invoiceHtml(inv, wo, company) {
        var lines = (inv.lineItems || []).map(function (li) {
            return '<tr>' +
                '<td>' + esc(li.styleNo) + '</td>' +
                '<td>' + esc(li.description || '') + '</td>' +
                '<td>' + esc(li.color || '') + '</td>' +
                '<td>' + esc(li.size || '') + '</td>' +
                '<td class="smiv-num">' + (li.quantity || 0) + '</td>' +
                '<td class="smiv-num">' + money2(li.unitPrice) + '</td>' +
                '<td class="smiv-num">' + money2(li.lineTotal) + '</td>' +
                '</tr>';
        }).join('');
        var ship = inv.shipTo || {};
        return '<div class="smiv-inv">' +
            '<div class="smiv-inv-top">' +
            '<div class="smiv-inv-brand">SanMar Corporation<small>Invoice — Northwest Custom Apparel' + (wo ? ' · WO #' + esc(wo) : '') + (company ? ' · ' + esc(company) : '') + '</small></div>' +
            '<div class="smiv-inv-no"><strong>Invoice ' + esc(inv.invoiceNumber || '—') + '</strong><br>' + esc(inv.invoiceDate || '') +
            (inv.invoiceStatus ? '<br><span class="smiv-badge">' + esc(inv.invoiceStatus) + '</span>' : '') + '</div>' +
            '</div>' +
            '<dl class="smiv-meta">' +
            '<div><dt>PO #</dt><dd>' + esc(inv.purchaseOrderNo || '—') + '</dd></div>' +
            '<div><dt>Order date</dt><dd>' + esc(inv.orderDate || '—') + '</dd></div>' +
            '<div><dt>Terms</dt><dd>' + esc(inv.terms || '—') + '</dd></div>' +
            '<div><dt>Due date</dt><dd>' + esc(inv.dueDate || '—') + '</dd></div>' +
            '<div><dt>Ship via</dt><dd>' + esc(inv.shipVia || '—') + '</dd></div>' +
            '<div><dt>Ship to</dt><dd>' + esc([ship.name, ship.city, ship.state].filter(Boolean).join(', ') || '—') + '</dd></div>' +
            '</dl>' +
            '<table><thead><tr><th>Style</th><th>Description</th><th>Color</th><th>Size</th><th>Qty</th><th>Unit</th><th>Ext</th></tr></thead>' +
            '<tbody>' + (lines || '<tr><td colspan="7">No line items returned.</td></tr>') + '</tbody></table>' +
            '<div class="smiv-totals">' +
            '<div><span>Subtotal</span><span class="smiv-num">' + money2(inv.subtotal) + '</span></div>' +
            '<div><span>Shipping &amp; handling</span><span class="smiv-num">' + money2(inv.shippingCharges) + '</span></div>' +
            (inv.freightSavings ? '<div><span>Freight savings</span><span class="smiv-num">-' + money2(inv.freightSavings) + '</span></div>' : '') +
            '<div><span>Sales tax</span><span class="smiv-num">' + money2(inv.salesTax) + '</span></div>' +
            '<div class="smiv-grand"><span>Total</span><span class="smiv-num">' + money2(inv.totalAmount) + '</span></div>' +
            '</div></div>';
    }

    function open(opts) {
        opts = opts || {};
        var wo = opts.wo, company = opts.company || '', pos = opts.pos || [], orderedDate = opts.orderedDate || '';
        if (!pos.length) return;
        ensureModal();
        var request = ++requestSerial;
        returnFocus = opts.returnFocus || document.activeElement;
        document.getElementById('smiv-overlay').hidden = unified();
        var modal = document.getElementById('smiv-modal');
        modal.hidden = false;
        if (unified() && !modal.open) modal.showModal();
        // Title names what was asked for: the WO when the caller has one, else the PO(s). (Was "WO #undefined"
        // whenever a page opened the viewer by PO only — SanMar Payables does.)
        var subject = wo ? 'WO #' + esc(wo) : 'PO ' + pos.map(esc).join(', ');
        document.getElementById('smiv-title').innerHTML = '<i class="fas fa-file-invoice-dollar" aria-hidden="true"></i> SanMar Invoice — ' + subject;
        document.getElementById('smiv-print').disabled = true;
        setTimeout(function () { var c = document.getElementById('smiv-close'); if (c) c.focus(); }, 30);
        var body = document.getElementById('smiv-body');
        body.innerHTML = '<div class="smiv-loading">Fetching the invoice from SanMar…</div>';

        var dateParam = /^\d{4}-\d{2}-\d{2}$/.test(orderedDate) ? '?orderedDate=' + orderedDate : '';
        Promise.all(pos.map(function (po) {
            return fetch(apiBase() + '/api/sanmar-invoices/by-po/' + encodeURIComponent(po) + dateParam)
                .then(function (resp) {
                    if (!resp.ok) throw new Error('HTTP ' + resp.status);
                    return resp.json();
                })
                .then(function (r) {
                    if (!r || !Array.isArray(r.invoices) || r.invoices.some(function (inv) {
                        return !inv || !inv.invoiceNumber || inv.totalAmount == null || String(inv.totalAmount).trim() === '' || !Number.isFinite(Number(inv.totalAmount));
                    })) throw new Error('Incomplete invoice response');
                    return { po: po, invoices: r.invoices };
                })
                .catch(function (err) { return { po: po, error: err.message }; });
        })).then(function (results) {
            if (request !== requestSerial) return;
            var html = '';
            results.forEach(function (r) {
                if (r.error) {
                    html += '<div class="smiv-note is-error">PO ' + esc(r.po) + ': invoice lookup failed (' + esc(r.error) + ').</div>';
                } else if (!r.invoices.length) {
                    html += '<div class="smiv-note">PO ' + esc(r.po) + ': SanMar has not invoiced this PO yet — invoices cut after shipment.</div>';
                } else {
                    r.invoices.forEach(function (inv) { html += invoiceHtml(inv, wo, company); });
                }
            });
            body.innerHTML = html || '<div class="smiv-note">No invoices found.</div>';
            decorateInvoices(body);
            document.getElementById('smiv-print').disabled = !body.querySelector('.smiv-inv');
        });
    }

    function print() {
        var invoices = document.getElementById('smiv-body').querySelectorAll('.smiv-inv');
        if (!invoices.length) return;
        var old = document.getElementById('smiv-print-sheet');
        if (old) old.remove();
        var sheet = document.createElement('div');
        sheet.id = 'smiv-print-sheet';
        sheet.className = 'smiv-print-sheet';
        var documents = document.getElementById('smiv-body').querySelectorAll('.smiv-inv,.smiv-note');
        Array.prototype.forEach.call(documents, function (inv) { sheet.appendChild(inv.cloneNode(true)); });
        document.body.appendChild(sheet);
        document.body.classList.add('smiv-printing');
        var cleanupTimer;
        var cleanup = function () {
            clearTimeout(cleanupTimer);
            if (document.getElementById('smiv-print-sheet') === sheet) document.body.classList.remove('smiv-printing');
            sheet.remove();
            window.removeEventListener('afterprint', cleanup);
        };
        window.addEventListener('afterprint', cleanup);
        cleanupTimer = setTimeout(cleanup, 1500);
        window.print();
    }

    window.SanMarInvoiceViewer = { open: open, close: close };
})();
