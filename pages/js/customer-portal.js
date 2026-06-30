/**
 * Customer Portal — /portal/:customerId
 * Shows all mockups and art requests for a company.
 *
 * Data comes from the gated, customer-safe APP endpoint /api/portal/:customerId
 * (same-origin) — the server fetches raw rows from the proxy and returns an
 * ALLOWLIST projection, so internal fields (YTD sales, staff emails, art
 * charges, internal notes) never reach the browser. No login yet — Phase 2
 * (magic-link) will add per-customer auth and the server endpoint stays the same.
 */
(function () {
    'use strict';

    // ── Load portal data (session-scoped, single gated same-origin call) ──
    // Phase 2 (#6): the customer is identified by their verified LOGIN SESSION, not the URL.
    // The server returns this customer's id (data.customerId) so we can build detail links.
    loadPortalData();
    loadOrders();

    function loadPortalData() {
        fetch('/api/portal', { credentials: 'same-origin' })
            .then(function (resp) {
                if (resp.status === 401) { window.location.href = '/customer/login'; throw new Error('auth'); }
                if (!resp.ok) throw new Error('Portal load failed: ' + resp.status);
                return resp.json();
            })
            .then(function (data) {
                var custId = data.customerId;
                var companyName = (data.company && data.company.name) || 'Your Company';
                document.getElementById('cp-company-name').textContent = companyName;
                document.title = companyName + ' — Design Portal | NWCA';

                renderMockups(data.mockups || [], custId);
                renderArtRequests(data.artRequests || [], custId);

                // Show content, hide loading
                document.getElementById('cp-loading').style.display = 'none';
                document.getElementById('cp-content').style.display = 'block';
            })
            .catch(function (err) {
                if (err && err.message === 'auth') return; // redirecting to login
                console.error('Portal load error:', err);
                showError('Unable to Load', 'Something went wrong loading your portal. Please refresh the page or call us at (253) 922-5793.');
            });
    }

    // ── Render mockup cards ──
    function renderMockups(mockups, custId) {
        var grid = document.getElementById('cp-mockup-grid');
        var countEl = document.getElementById('cp-mockup-count');
        var emptyEl = document.getElementById('cp-mockup-empty');

        countEl.textContent = mockups.length;

        if (mockups.length === 0) {
            grid.style.display = 'none';
            emptyEl.style.display = 'block';
            return;
        }

        // Sort: action-needed first, then newest
        mockups.sort(function (a, b) {
            var aAction = needsAction(a.Status) ? 0 : 1;
            var bAction = needsAction(b.Status) ? 0 : 1;
            if (aAction !== bAction) return aAction - bAction;
            return new Date(b.Submitted_Date || 0) - new Date(a.Submitted_Date || 0);
        });

        var html = '';
        mockups.forEach(function (m) {
            var imgUrl = m.Box_Mockup_1 ? ('/api/image-proxy?url=' + encodeURIComponent(m.Box_Mockup_1)) : '';
            var isAction = needsAction(m.Status);
            var designLabel = m.Design_Number ? ('Design #' + escapeHtml(m.Design_Number)) : 'Mockup';
            var meta = [m.Print_Location, m.Mockup_Type].filter(Boolean).join(' · ');

            html += '<a class="cp-card' + (isAction ? ' cp-card--action-needed' : '') + '" '
                + 'href="/mockup/' + encodeURIComponent(m.ID) + '?view=customer&cid=' + encodeURIComponent(custId) + '" target="_blank">'
                + '<div class="cp-card-image">';

            if (imgUrl) {
                html += '<img src="' + imgUrl + '" alt="Mockup" loading="lazy" onerror="this.parentElement.innerHTML=\'<div class=cp-card-placeholder>&#128085;</div>\'">';
            } else {
                html += '<div class="cp-card-placeholder">&#128085;</div>';
            }

            if (isAction) {
                html += '<div class="cp-action-badge">Action Needed</div>';
            }

            html += '</div>'
                + '<div class="cp-card-body">'
                + '<div class="cp-card-design">' + designLabel + '</div>'
                + '<div class="cp-card-name">' + escapeHtml(m.Design_Name || '') + '</div>';

            if (meta) {
                html += '<div class="cp-card-meta">' + escapeHtml(meta) + '</div>';
            }

            html += '<div class="cp-card-footer">'
                + renderStatusBadge(m.Status)
                + '<div class="cp-card-date">' + formatDate(m.Submitted_Date) + '</div>'
                + '</div>'
                + '</div></a>';
        });

        grid.innerHTML = html;
    }

    // ── Render art request cards ──
    function renderArtRequests(artRequests, custId) {
        var grid = document.getElementById('cp-art-grid');
        var countEl = document.getElementById('cp-art-count');
        var emptyEl = document.getElementById('cp-art-empty');

        countEl.textContent = artRequests.length;

        if (artRequests.length === 0) {
            grid.style.display = 'none';
            emptyEl.style.display = 'block';
            return;
        }

        // Sort: action-needed first, then newest
        artRequests.sort(function (a, b) {
            var aAction = needsAction(a.Status) ? 0 : 1;
            var bAction = needsAction(b.Status) ? 0 : 1;
            if (aAction !== bAction) return aAction - bAction;
            return new Date(b.Date_Created || 0) - new Date(a.Date_Created || 0);
        });

        var html = '';
        artRequests.forEach(function (ar) {
            var imgUrl = ar.MAIN_IMAGE_URL_1 ? ('/api/image-proxy?url=' + encodeURIComponent(ar.MAIN_IMAGE_URL_1)) : '';
            var isAction = needsAction(ar.Status);
            var designLabel = ar.Design_Num_SW ? ('Design #' + escapeHtml(String(ar.Design_Num_SW))) : 'Art Request';
            var garmentInfo = [ar.GarmentStyle, ar.GarmentColor].filter(Boolean).join(' · ');
            var orderType = ar.Order_Type || '';

            // Deep-link by ID_Design (the key the detail page queries on), carrying
            // cid so the gated detail endpoint can authorize the row → this customer.
            html += '<a class="cp-card' + (isAction ? ' cp-card--action-needed' : '') + '" '
                + 'href="/art-request/' + encodeURIComponent(ar.ID_Design) + '?view=customer&cid=' + encodeURIComponent(custId) + '" target="_blank">'
                + '<div class="cp-card-image">';

            if (imgUrl) {
                html += '<img src="' + imgUrl + '" alt="Design" loading="lazy" onerror="this.parentElement.innerHTML=\'<div class=cp-card-placeholder>&#127912;</div>\'">';
            } else {
                html += '<div class="cp-card-placeholder">&#127912;</div>';
            }

            if (isAction) {
                html += '<div class="cp-action-badge">Action Needed</div>';
            }

            html += '</div>'
                + '<div class="cp-card-body">'
                + '<div class="cp-card-design">' + designLabel + '</div>';

            if (garmentInfo) {
                html += '<div class="cp-card-name">' + escapeHtml(garmentInfo) + '</div>';
            }

            if (orderType) {
                html += '<div class="cp-card-meta">' + escapeHtml(String(orderType)) + '</div>';
            }

            html += '<div class="cp-card-footer">'
                + renderStatusBadge(ar.Status)
                + '<div class="cp-card-date">' + formatDate(ar.Date_Created) + '</div>'
                + '</div>'
                + '</div></a>';
        });

        grid.innerHTML = html;
    }

    // ── Helpers ──

    function needsAction(status) {
        if (!status) return false;
        var s = status.toLowerCase().replace(/\s+/g, '-');
        return s === 'awaiting-approval' || s === 'revision-requested';
    }

    function renderStatusBadge(status) {
        if (!status) return '<span class="cp-status">Unknown</span>';
        var slug = status.toLowerCase().replace(/\s+/g, '-');
        return '<span class="cp-status cp-status--' + slug + '">' + escapeHtml(status) + '</span>';
    }

    function formatDate(dateStr) {
        if (!dateStr) return '';
        try {
            var d = new Date(dateStr);
            if (isNaN(d.getTime())) return '';
            var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            return months[d.getUTCMonth()] + ' ' + d.getUTCDate() + ', ' + d.getUTCFullYear();
        } catch (e) {
            return '';
        }
    }

    function escapeHtml(str) {
        if (!str) return '';
        var div = document.createElement('div');
        div.appendChild(document.createTextNode(str));
        return div.innerHTML;
    }

    function showError(title, message) {
        document.getElementById('cp-loading').style.display = 'none';
        document.getElementById('cp-error').style.display = 'block';
        document.getElementById('cp-error-title').textContent = title;
        document.getElementById('cp-error-message').textContent = message;
    }

    // ── Orders + Invoices (Phase 3) — one same-origin call feeds both tables ──
    function loadOrders() {
        fetch('/api/portal/orders', { credentials: 'same-origin' })
            .then(function (resp) { return resp.ok ? resp.json() : { orders: [] }; })
            .then(function (data) {
                var orders = (data && data.orders) || [];
                renderOrders(orders);
                renderInvoices(orders);
            })
            .catch(function () { renderOrders([]); renderInvoices([]); });
    }

    function money(n) {
        var v = Number(n) || 0;
        return '$' + v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    function renderOrders(orders) {
        document.getElementById('cp-orders-count').textContent = orders.length;
        var wrap = document.getElementById('cp-orders-wrap');
        var empty = document.getElementById('cp-orders-empty');
        if (!orders.length) { wrap.innerHTML = ''; empty.style.display = 'block'; return; }
        empty.style.display = 'none';
        var rows = orders.map(function (o) {
            return '<tr>' +
                '<td><a class="cp-link" href="/portal/invoice/' + encodeURIComponent(o.orderNumber) + '">#' + escapeHtml(String(o.orderNumber || '')) + '</a></td>' +
                '<td>' + escapeHtml(formatDate(o.orderDate)) + '</td>' +
                '<td>' + escapeHtml(o.designName || '—') + '</td>' +
                '<td>' + escapeHtml(o.poNumber || '—') + '</td>' +
                '<td class="cp-num">' + escapeHtml(String(o.quantity || '')) + '</td>' +
                '<td class="cp-num">' + money(o.total) + '</td>' +
                '<td>' + renderStatusBadge(o.status) + '</td>' +
                '<td>' + (escapeHtml(formatDate(o.shipDate)) || '—') + '</td>' +
                '</tr>';
        }).join('');
        wrap.innerHTML = '<table class="cp-table"><thead><tr>' +
            '<th>Order</th><th>Date</th><th>Design</th><th>PO</th><th class="cp-num">Qty</th>' +
            '<th class="cp-num">Total</th><th>Status</th><th>Shipped</th>' +
            '</tr></thead><tbody>' + rows + '</tbody></table>';
    }

    function renderInvoices(orders) {
        // Only invoiced orders (or with a money total) appear in the invoices/balances view.
        var inv = orders.filter(function (o) { return o.invoiceDate || o.total > 0; });
        document.getElementById('cp-invoices-count').textContent = inv.length;
        var wrap = document.getElementById('cp-invoices-wrap');
        var empty = document.getElementById('cp-invoices-empty');
        if (!inv.length) { wrap.innerHTML = ''; empty.style.display = 'block'; return; }
        empty.style.display = 'none';
        var rows = inv.map(function (o) {
            return '<tr>' +
                '<td><a class="cp-link" href="/portal/invoice/' + encodeURIComponent(o.orderNumber) + '">#' + escapeHtml(String(o.orderNumber || '')) + '</a></td>' +
                '<td>' + (escapeHtml(formatDate(o.invoiceDate)) || '—') + '</td>' +
                '<td class="cp-num">' + money(o.total) + '</td>' +
                '<td class="cp-num">' + money(o.paid) + '</td>' +
                '<td class="cp-num">' + money(o.balance) + '</td>' +
                '<td>' + renderStatusBadge(o.paidStatus) + '</td>' +
                '</tr>';
        }).join('');
        wrap.innerHTML = '<table class="cp-table"><thead><tr>' +
            '<th>Order</th><th>Invoice Date</th><th class="cp-num">Total</th>' +
            '<th class="cp-num">Paid</th><th class="cp-num">Balance</th><th>Status</th>' +
            '</tr></thead><tbody>' + rows + '</tbody></table>';
    }
})();
