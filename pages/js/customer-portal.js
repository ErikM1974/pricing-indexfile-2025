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

    // Staff PREVIEW mode: /portal-admin/preview/<id> reuses this page READ-ONLY so staff
    // can see exactly what a customer sees. The server gates that route by staff role; here
    // we just point the fetches at the staff mirror endpoints, fix the 401 target, and label
    // the page. A logged-in CUSTOMER never lands here (different route + no staff session).
    var PREVIEW = (function () { var m = location.pathname.match(/^\/portal-admin\/preview\/(\d+)/); return m ? m[1] : null; })();
    var AGG_URL = PREVIEW ? ('/api/portal-admin/preview/' + PREVIEW) : '/api/portal';
    var ORDERS_URL = PREVIEW ? ('/api/portal-admin/preview/' + PREVIEW + '/orders') : '/api/portal/orders';
    var MYPRODUCTS_URL = PREVIEW ? ('/api/portal-admin/preview/' + PREVIEW + '/my-products') : '/api/portal/my-products';
    var RECS_URL = PREVIEW ? ('/api/portal-admin/preview/' + PREVIEW + '/recommendations') : '/api/portal/recommendations';
    var REWARDS_URL = PREVIEW ? ('/api/portal-admin/preview/' + PREVIEW + '/rewards') : '/api/portal/rewards';
    var INVOICE_BASE = PREVIEW ? ('/portal-admin/preview/' + PREVIEW + '/invoice/') : '/portal/invoice/';
    var LOGIN_URL = PREVIEW ? '/auth/saml/login' : '/customer/login';
    if (PREVIEW) showPreviewRibbon();

    // ── Load portal data (session-scoped, single gated same-origin call) ──
    // Phase 2 (#6): the customer is identified by their verified LOGIN SESSION, not the URL.
    // The server returns this customer's id (data.customerId) so we can build detail links.
    loadPortalData();
    loadOrders();
    // Phase 4 catalog — shows for customers AND in staff preview (preview uses the
    // role-gated mirror endpoints). In preview the request button is view-only.
    loadProducts();
    loadRecs();
    loadRewards();

    function loadPortalData() {
        fetch(AGG_URL, { credentials: 'same-origin' })
            .then(function (resp) {
                if (resp.status === 401) { window.location.href = LOGIN_URL; throw new Error('auth'); }
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

    // Staff-preview banner — makes it unmistakable this is the staff console viewing a
    // customer's portal (not a customer's own session). Styled by .cp-preview-ribbon.
    function showPreviewRibbon() {
        document.addEventListener('DOMContentLoaded', function () {
            var bar = document.createElement('div');
            bar.className = 'cp-preview-ribbon';
            bar.innerHTML = '<span><strong>Staff preview</strong> &middot; this is exactly what the customer sees (read-only)</span>' +
                '<a href="/dashboards/customer-portal-admin.html">&larr; Back to Customer Portals</a>';
            document.body.insertBefore(bar, document.body.firstChild);
            document.body.classList.add('cp-has-ribbon');
        });
    }

    // ── Orders + Invoices (Phase 3) — one same-origin call feeds both tables ──
    function loadOrders() {
        fetch(ORDERS_URL, { credentials: 'same-origin' })
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
                '<td><a class="cp-link" href="' + INVOICE_BASE + encodeURIComponent(o.orderNumber) + '">#' + escapeHtml(String(o.orderNumber || '')) + '</a></td>' +
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
                '<td><a class="cp-link" href="' + INVOICE_BASE + encodeURIComponent(o.orderNumber) + '">#' + escapeHtml(String(o.orderNumber || '')) + '</a></td>' +
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

    // ── Phase 4: Your Products + Recommendations + request-to-rep ──
    var reqState = null;

    function productCardHtml(p, kind) {
        var title = p.title || p.description || p.style;
        var img = p.image
            ? '<img src="' + escapeHtml(p.image) + '" alt="" loading="lazy" onerror="this.parentElement.classList.add(\'cp-noimg\');this.remove();">'
            : '';
        var sub = [p.color, (p.designNumber ? 'Design #' + p.designNumber : '')].filter(Boolean).join(' · ');
        var meta = (kind === 'product' && p.lastOrdered) ? 'Last ordered ' + formatDate(p.lastOrdered) : (p.blurb || '');
        var btnLabel = kind === 'product' ? 'Request re-order' : 'Request this';
        return '<div class="cp-product-card">' +
            '<div class="cp-product-img">' + img + '</div>' +
            '<div class="cp-product-body">' +
                '<div class="cp-product-title">' + escapeHtml(title) + '</div>' +
                (sub ? '<div class="cp-product-sub">' + escapeHtml(sub) + '</div>' : '') +
                (meta ? '<div class="cp-product-meta">' + escapeHtml(meta) + '</div>' : '') +
                '<button class="cp-product-btn" type="button" data-kind="' + kind + '"' +
                    ' data-style="' + escapeHtml(p.style) + '" data-color="' + escapeHtml(p.color || '') + '"' +
                    ' data-title="' + escapeHtml(title) + '" data-design="' + escapeHtml(String(p.designNumber || '')) + '"' +
                    ' data-designname="' + escapeHtml(p.designName || '') + '" data-qty="' + escapeHtml(String(p.lastQty || '')) + '">' +
                    btnLabel + '</button>' +
            '</div></div>';
    }

    function loadProducts() {
        fetch(MYPRODUCTS_URL, { credentials: 'same-origin' })
            .then(function (r) { return r.ok ? r.json() : { products: [] }; })
            .then(function (d) {
                var list = (d && d.products) || [];
                document.getElementById('cp-section-products').style.display = 'block';
                document.getElementById('cp-products-count').textContent = list.length;
                var grid = document.getElementById('cp-products-grid');
                var empty = document.getElementById('cp-products-empty');
                if (!list.length) { grid.innerHTML = ''; empty.style.display = 'block'; return; }
                empty.style.display = 'none';
                grid.innerHTML = list.map(function (p) { return productCardHtml(p, 'product'); }).join('');
            })
            .catch(function () { /* catalog is non-critical — stay quiet */ });
    }

    function loadRecs() {
        fetch(RECS_URL, { credentials: 'same-origin' })
            .then(function (r) { return r.ok ? r.json() : { recommendations: [] }; })
            .then(function (d) {
                var list = (d && d.recommendations) || [];
                if (!list.length) return;
                document.getElementById('cp-section-recs').style.display = 'block';
                document.getElementById('cp-recs-grid').innerHTML = list.map(function (p) { return productCardHtml(p, 'rec'); }).join('');
            })
            .catch(function () { });
    }

    document.addEventListener('click', function (e) {
        var btn = e.target.closest && e.target.closest('.cp-product-btn');
        if (btn) openReqModal(btn);
    });

    function openReqModal(btn) {
        reqState = {
            kind: btn.getAttribute('data-kind'),
            style: btn.getAttribute('data-style'),
            color: btn.getAttribute('data-color'),
            title: btn.getAttribute('data-title'),
            design: btn.getAttribute('data-design'),
            designName: btn.getAttribute('data-designname')
        };
        document.getElementById('cp-req-title').textContent = reqState.kind === 'product' ? 'Request a Re-order' : 'Request a Quote';
        document.getElementById('cp-req-product').innerHTML =
            '<div class="cp-req-prod-title">' + escapeHtml(reqState.title) + '</div>' +
            '<div class="cp-req-prod-sub">' + escapeHtml([reqState.color, (reqState.design ? 'Design #' + reqState.design : '')].filter(Boolean).join(' · ')) + '</div>';
        document.getElementById('cp-req-qty').value = btn.getAttribute('data-qty') || '';
        document.getElementById('cp-req-note').value = '';
        document.getElementById('cp-req-error').textContent = '';
        document.getElementById('cp-req-modal').style.display = 'flex';
    }
    function closeReqModal() { document.getElementById('cp-req-modal').style.display = 'none'; }

    function submitReq() {
        if (!reqState) return;
        if (PREVIEW) { closeReqModal(); showToast('Staff preview — the customer would send this request to their rep.'); return; }
        var err = document.getElementById('cp-req-error');
        err.textContent = '';
        var submitBtn = document.getElementById('cp-req-submit');
        submitBtn.disabled = true; submitBtn.textContent = 'Sending…';
        fetch('/api/portal/reorder-request', {
            method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                style: reqState.style, color: reqState.color, product_title: reqState.title,
                design_number: reqState.design, design_name: reqState.designName,
                qty: document.getElementById('cp-req-qty').value.trim(),
                note: document.getElementById('cp-req-note').value.trim(),
                source: reqState.kind === 'rec' ? 'recommendation' : 'reorder'
            })
        })
            .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
            .then(function (x) {
                submitBtn.disabled = false; submitBtn.textContent = 'Send to my rep';
                if (!x.ok || !x.j.ok) { err.textContent = (x.j && x.j.error) || 'Could not send. Please try again.'; return; }
                closeReqModal();
                showToast('Request sent! ' + (x.j.rep ? escapeHtml(x.j.rep) + ' will' : "We'll") + ' follow up with a quote.');
            })
            .catch(function () { submitBtn.disabled = false; submitBtn.textContent = 'Send to my rep'; err.textContent = 'Could not send. Please try again or call (253) 922-5793.'; });
    }

    function showToast(msg) {
        var t = document.getElementById('cp-toast');
        if (!t) return;
        t.innerHTML = msg;
        t.className = 'cp-toast show';
        setTimeout(function () { t.className = 'cp-toast'; }, 4000);
    }

    (function wireReqModal() {
        var close = document.getElementById('cp-req-close'); if (close) close.addEventListener('click', closeReqModal);
        var cancel = document.getElementById('cp-req-cancel'); if (cancel) cancel.addEventListener('click', closeReqModal);
        var submit = document.getElementById('cp-req-submit'); if (submit) submit.addEventListener('click', submitReq);
        var ov = document.getElementById('cp-req-modal'); if (ov) ov.addEventListener('click', function (e) { if (e.target === ov) closeReqModal(); });
    })();

    // ── Phase 5: reward dollars (read balance + redeem-as-request) ──
    var rewardBalance = 0;
    function loadRewards() {
        fetch(REWARDS_URL, { credentials: 'same-origin' })
            .then(function (r) { return r.ok ? r.json() : { balance: 0 }; })
            .then(function (d) {
                rewardBalance = Number(d && d.balance) || 0;
                if (rewardBalance > 0) {
                    document.getElementById('cp-rewards-balance').textContent = money(rewardBalance);
                    document.getElementById('cp-rewards').style.display = 'flex';
                }
            })
            .catch(function () { });
    }
    function openRedeem() {
        if (PREVIEW) { showToast('Staff preview — the customer would redeem their rewards here.'); return; }
        document.getElementById('cp-redeem-avail').textContent = money(rewardBalance);
        document.getElementById('cp-redeem-amt').value = '';
        document.getElementById('cp-redeem-error').textContent = '';
        document.getElementById('cp-redeem-modal').style.display = 'flex';
    }
    function closeRedeem() { document.getElementById('cp-redeem-modal').style.display = 'none'; }
    function submitRedeem() {
        var amt = parseFloat(document.getElementById('cp-redeem-amt').value);
        var err = document.getElementById('cp-redeem-error');
        err.textContent = '';
        if (!(amt > 0)) { err.textContent = 'Enter a valid amount.'; return; }
        if (amt > rewardBalance + 0.001) { err.textContent = 'You have ' + money(rewardBalance) + ' available.'; return; }
        var btn = document.getElementById('cp-redeem-submit');
        btn.disabled = true; btn.textContent = 'Sending…';
        fetch('/api/portal/rewards/redeem-request', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ amount: amt }) })
            .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
            .then(function (x) {
                btn.disabled = false; btn.textContent = 'Send request to my rep';
                if (!x.ok || !x.j.ok) { err.textContent = (x.j && x.j.error) || 'Could not send. Please try again.'; return; }
                closeRedeem();
                showToast('Redemption request sent! ' + (x.j.rep ? escapeHtml(x.j.rep) + ' will' : "We'll") + ' apply it to your next order.');
            })
            .catch(function () { btn.disabled = false; btn.textContent = 'Send request to my rep'; err.textContent = 'Could not send. Please try again.'; });
    }
    (function wireRedeem() {
        var b = document.getElementById('cp-redeem-btn'); if (b) b.addEventListener('click', openRedeem);
        var c = document.getElementById('cp-redeem-close'); if (c) c.addEventListener('click', closeRedeem);
        var ca = document.getElementById('cp-redeem-cancel'); if (ca) ca.addEventListener('click', closeRedeem);
        var s = document.getElementById('cp-redeem-submit'); if (s) s.addEventListener('click', submitRedeem);
        var ov = document.getElementById('cp-redeem-modal'); if (ov) ov.addEventListener('click', function (e) { if (e.target === ov) closeRedeem(); });
    })();
})();
