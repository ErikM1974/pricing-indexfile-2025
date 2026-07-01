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
    // Live color list for a style (name + swatch + product image). Preview uses the staff mirror.
    var COLORS_URL_BASE = PREVIEW ? ('/api/portal-admin/preview/' + PREVIEW + '/product-colors/') : '/api/portal/product-colors/';
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
                var companyName = (data.company && data.company.name) || '';
                var nameEl = document.getElementById('cp-company-name');
                if (companyName) {
                    nameEl.textContent = companyName;
                    document.title = companyName + ' — Your Account | NWCA';
                } else {
                    // No company name on file — don't show the "Your Company" placeholder.
                    nameEl.textContent = 'Your Account';
                    document.title = 'Your Account | NWCA';
                }

                renderMyLogos(data.mockups || [], data.artRequests || [], custId);

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

    // ── My Logos: the customer's logos + design proofs (mockups + art), grouped by design ──
    // Phase 0: pure front-end — /api/portal already returns customer-scoped, image-filtered,
    // allowlist-projected mockups + art (2026+ per PORTAL_DATE_CUTOFF). We just merge, dedup by
    // design #, and show one card per logo. (Phase 1 adds the not-date-gated brand-logo table.)
    function renderMyLogos(mockups, artRequests, custId) {
        var grid = document.getElementById('cp-logos-grid');
        var countEl = document.getElementById('cp-logos-count');
        var emptyEl = document.getElementById('cp-logos-empty');
        document.getElementById('cp-section-logos').style.display = 'block';

        // Approved/Completed = the customer's FINAL artwork ("Completed" = the job actually ran).
        // Exact match — NOT a substring, or "Awaiting Approval" would wrongly count as approved.
        var isApproved = function (s) { var t = String(s || '').trim().toLowerCase(); return t === 'approved' || t === 'completed' || t === 'complete'; };
        var items = [];
        (mockups || []).forEach(function (m) {
            var img = m.Box_Mockup_1 || m.Box_Mockup_2 || m.Box_Mockup_3;
            if (!img) return;
            items.push({
                design: String(m.Design_Number || ''),
                name: m.Design_Name || (m.Design_Number ? 'Design #' + m.Design_Number : 'Design'),
                meta: [m.Print_Location, m.Mockup_Type].filter(Boolean).join(' · '),
                img: img, date: m.Submitted_Date || '', kind: 'mockup', approved: isApproved(m.Status)
            });
        });
        (artRequests || []).forEach(function (a) {
            // ONLY a real design proof (the mockup Steve/AE made). MAIN_IMAGE_URL_1 is a plain SanMar
            // catalog stock photo of the blank garment/model — deliberately NOT used. A design with no
            // proof on file is SKIPPED (we never show "just the model" as if it were the logo).
            var img = a.Final_Approved_Mockup || a.Box_File_Mockup || a.Box_File_Link;
            if (!img) return;
            items.push({
                design: String(a.Design_Num_SW || ''),
                name: a.Design_Num_SW ? 'Design #' + a.Design_Num_SW : (a.GarmentStyle || 'Design'),
                meta: [a.GarmentStyle, a.GarmentColor].filter(Boolean).join(' · '),
                img: img, date: a.Date_Created || '', kind: 'art', approved: isApproved(a.Status)
            });
        });

        // Group by design # so a logo's proofs collapse into ONE card. Per design, prefer the
        // APPROVED/Completed proof (the customer's final artwork) > a mockup over art > the newest.
        // Nothing is hidden — a design with no approved proof yet still shows its latest.
        var rank = function (it) { return (it.approved ? 100 : 0) + (it.kind === 'mockup' ? 10 : 0); };
        var byKey = {};
        items.forEach(function (it) {
            var key = it.design ? ('d:' + it.design) : ('u:' + it.img);
            var ex = byKey[key];
            if (!ex) { byKey[key] = it; return; }
            var better = rank(it) > rank(ex) || (rank(it) === rank(ex) && String(it.date) > String(ex.date));
            if (better) byKey[key] = it;
        });
        var logos = Object.keys(byKey).map(function (k) { return byKey[k]; })
            .sort(function (a, b) { return String(b.date).localeCompare(String(a.date)); });

        countEl.textContent = logos.length;
        if (!logos.length) { grid.innerHTML = ''; emptyEl.style.display = 'flex'; return; }
        emptyEl.style.display = 'none';
        // The card opens a LIGHTBOX (not the internal staff art-request/mockup page, which errors
        // for customers). Store the proxied image so the lightbox shows the full design.
        grid.innerHTML = logos.map(function (l) {
            // Grid = fast 256px thumbnail; lightbox = the LARGE version (Box ?size=large → 1024 / full
            // original). ?size=large only applies to Box thumbnail URLs; other sources pass through.
            var isBox = /\/api\/box\/thumbnail\//.test(l.img);
            var largeRaw = isBox ? (l.img + (l.img.indexOf('?') === -1 ? '?' : '&') + 'size=large') : l.img;
            var proxied = '/api/image-proxy?url=' + encodeURIComponent(l.img);
            var proxiedLarge = '/api/image-proxy?url=' + encodeURIComponent(largeRaw);
            var img = '<img src="' + proxied + '" alt="" loading="lazy" '
                + 'onerror="this.parentElement.innerHTML=\'<div class=cp-card-placeholder>&#127912;</div>\'">';
            var badge = l.approved ? '<div class="cp-logo-approved">&#10003; Approved</div>' : '';
            return '<div class="cp-card cp-logo-card" role="button" tabindex="0"'
                + ' data-img="' + escapeAttr(proxiedLarge) + '" data-title="' + escapeAttr(l.name) + '" data-meta="' + escapeAttr(l.meta || '') + '">'
                + '<div class="cp-card-image">' + img + badge + '</div>'
                + '<div class="cp-card-body">'
                    + '<div class="cp-card-design">' + escapeHtml(l.name) + '</div>'
                    + (l.meta ? '<div class="cp-card-name">' + escapeHtml(l.meta) + '</div>' : '')
                    + '<div class="cp-card-footer">'
                        + '<span class="cp-card-view">View design</span>'
                        + '<div class="cp-card-date">' + formatDate(l.date) + '</div>'
                    + '</div>'
                + '</div></div>';
        }).join('');
    }

    // ── My Logos lightbox: click a design card → view the full design image (no staff page) ──
    function openLogoLightbox(card) {
        var lb = document.getElementById('cp-logo-lightbox');
        if (!lb) return;
        document.getElementById('cp-lightbox-img').src = card.getAttribute('data-img') || '';
        document.getElementById('cp-lightbox-title').textContent = card.getAttribute('data-title') || '';
        document.getElementById('cp-lightbox-meta').textContent = card.getAttribute('data-meta') || '';
        lb.style.display = 'flex';
    }
    function closeLogoLightbox() {
        var lb = document.getElementById('cp-logo-lightbox');
        if (lb) { lb.style.display = 'none'; var im = document.getElementById('cp-lightbox-img'); if (im) im.src = ''; }
    }
    document.addEventListener('click', function (e) {
        var card = e.target.closest && e.target.closest('.cp-logo-card');
        if (card) { openLogoLightbox(card); return; }
        var lb = document.getElementById('cp-logo-lightbox');
        if (lb && lb.style.display !== 'none' && (e.target === lb || e.target.id === 'cp-lightbox-close')) closeLogoLightbox();
    });
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') { closeLogoLightbox(); return; }
        var card = e.target.closest && e.target.closest('.cp-logo-card');
        if (card && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); openLogoLightbox(card); }
    });

    // ── Helpers ──

    function needsAction(status) {
        if (!status) return false;
        var s = status.toLowerCase().replace(/\s+/g, '-');
        return s === 'awaiting-approval' || s === 'revision-requested';
    }

    function renderStatusBadge(status) {
        // Route null AND '—' (server's zero-total payment marker) to a neutral pill so
        // we never emit a junk slug like "cp-status--—" or a naked (unstyled) pill.
        if (!status || status === '—') {
            return '<span class="cp-status cp-status--neutral">' + escapeHtml(status || 'Unknown') + '</span>';
        }
        var slug = status.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
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
                '</tr>';
        }).join('');
        wrap.innerHTML = '<table class="cp-table"><thead><tr>' +
            '<th>Order</th><th>Date</th><th>Design</th><th>PO</th><th class="cp-num">Qty</th>' +
            '<th class="cp-num">Total</th><th>Status</th>' +
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
        var comingSoon = kind === 'rec' && p.comingSoon;
        var img = p.image
            ? '<img src="' + escapeHtml(p.image) + '" alt="" loading="lazy" onerror="this.parentElement.classList.add(\'cp-noimg\');this.remove();">'
            : (comingSoon ? '<div class="cp-coming-soon">Coming soon</div>' : '');
        var colors = (kind === 'product' && p.colors) ? p.colors : [];
        var sub = (colors.length > 1)
            ? (colors.length + ' colors ordered' + (p.designNumber ? ' · Design #' + p.designNumber : ''))
            : [p.color, (p.designNumber ? 'Design #' + p.designNumber : '')].filter(Boolean).join(' · ');
        // Ordered-color swatches (catalog style) — only when the style was bought in more than one color.
        var swatches = (colors.length > 1)
            ? ('<div class="cp-swatches">' + colors.slice(0, 8).map(function (c) {
                return c.swatch
                    ? '<img class="cp-swatch" src="' + escapeHtml(c.swatch) + '" alt="' + escapeHtml(c.name) + '" title="' + escapeHtml(c.name) + '" loading="lazy" onerror="this.style.display=\'none\'">'
                    : '<span class="cp-swatch cp-swatch--noimg" title="' + escapeHtml(c.name) + '"></span>';
              }).join('') + (colors.length > 8 ? '<span class="cp-swatch-more">+' + (colors.length - 8) + '</span>' : '') + '</div>')
            : '';
        var meta = (kind === 'product' && p.lastOrdered) ? 'Last ordered ' + formatDate(p.lastOrdered) : (p.blurb || '');
        var btnLabel = kind === 'product' ? 'Re-order' : 'Ask for a quote';
        // Reward pill (premium recommendations only) — marketing label, no money moves. Blank = hidden.
        var reward = (kind === 'rec' && p.rewardText)
            ? '<div class="cp-rec-reward"><span class="cp-rec-reward-star">&#9733;</span> ' + escapeHtml(p.rewardText) + '</div>'
            : '';
        // Carry the exact sizes the customer last ordered so the modal can pre-fill the grid.
        var sizesJson = JSON.stringify(p.sizes || {});
        return '<div class="cp-product-card' + (comingSoon ? ' cp-product-card--soon' : '') + '">' +
            '<div class="cp-product-img">' + img + '</div>' +
            '<div class="cp-product-body">' +
                '<div class="cp-product-title">' + escapeHtml(title) + '</div>' +
                (sub ? '<div class="cp-product-sub">' + escapeHtml(sub) + '</div>' : '') +
                swatches +
                (meta ? '<div class="cp-product-meta">' + escapeHtml(meta) + '</div>' : '') +
                reward +
                '<button class="cp-product-btn" type="button" data-kind="' + kind + '"' +
                    ' data-style="' + escapeHtml(p.style) + '" data-color="' + escapeHtml(p.color || '') + '"' +
                    ' data-image="' + escapeHtml(p.image || '') + '"' +
                    ' data-title="' + escapeHtml(title) + '" data-design="' + escapeHtml(String(p.designNumber || '')) + '"' +
                    ' data-designname="' + escapeHtml(p.designName || '') + '"' +
                    " data-sizes='" + escapeAttr(sizesJson) + "'>" +
                    btnLabel + '</button>' +
            '</div></div>';
    }

    // JSON goes inside a single-quoted attribute — escape the few chars that would break it.
    function escapeAttr(s) {
        return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/'/g, '&#39;').replace(/</g, '&lt;');
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

    var SIZE_ORDER = ['S', 'M', 'L', 'XL', '2XL', '3XL'];

    function openReqModal(btn) {
        var parsedSizes = {};
        try { parsedSizes = JSON.parse(btn.getAttribute('data-sizes') || '{}') || {}; } catch (e) { parsedSizes = {}; }
        reqState = {
            kind: btn.getAttribute('data-kind'),
            style: btn.getAttribute('data-style'),
            color: btn.getAttribute('data-color'),
            image: btn.getAttribute('data-image') || '',
            title: btn.getAttribute('data-title'),
            design: btn.getAttribute('data-design'),
            designName: btn.getAttribute('data-designname'),
            sizes: parsedSizes
        };
        document.getElementById('cp-req-title').textContent = reqState.kind === 'product' ? 'Re-order this product' : 'Ask for a quote';
        document.getElementById('cp-req-product').innerHTML =
            '<div class="cp-req-prod-title">' + escapeHtml(reqState.title) + '</div>' +
            '<div class="cp-req-prod-sub">' + escapeHtml('Style ' + (reqState.style || '') + (reqState.design ? ' · Design #' + reqState.design : '')) + '</div>';
        setReqImage(reqState.image);
        buildSizeGrid(reqState.sizes);
        // Show the ordered color immediately, then enrich with the full color list.
        var sel = document.getElementById('cp-req-color');
        sel.innerHTML = '<option value="' + escapeHtml(reqState.color || '') + '" selected>' + escapeHtml(reqState.color || 'Same as before') + '</option>';
        loadColorOptions(reqState.style, reqState.color, reqState.image);
        document.getElementById('cp-req-note').value = '';
        document.getElementById('cp-req-error').textContent = '';
        document.getElementById('cp-req-modal').style.display = 'flex';
    }
    function closeReqModal() { document.getElementById('cp-req-modal').style.display = 'none'; }

    function setReqImage(url) {
        var box = document.getElementById('cp-req-image');
        if (!box) return;
        box.innerHTML = url
            ? '<img src="' + escapeHtml(url) + '" alt="" onerror="this.remove();">'
            : '<div class="cp-req-noimg">&#128085;</div>';
    }

    // Fetch every available color for this style; rebuild the dropdown and swap the image on change.
    function loadColorOptions(style, orderedColor, orderedImage) {
        if (!style) return;
        fetch(COLORS_URL_BASE + encodeURIComponent(style), { credentials: 'same-origin' })
            .then(function (r) { return r.ok ? r.json() : { colors: [] }; })
            .then(function (d) {
                var colors = (d && d.colors) || [];
                if (!colors.length) return; // keep the ordered-color-only dropdown
                var sel = document.getElementById('cp-req-color');
                var want = String(orderedColor || '').toLowerCase().replace(/[^a-z0-9]/g, '');
                // Map each color name → its image so we can swap the preview without re-fetching.
                reqState.colorImages = {};
                var html = '';
                var matched = false;
                colors.forEach(function (c) {
                    var name = c.name || c.catalogColor || '';
                    if (!name) return;
                    reqState.colorImages[name] = c.image || '';
                    var norm = name.toLowerCase().replace(/[^a-z0-9]/g, '');
                    var isOrdered = want && norm === want;
                    if (isOrdered) matched = true;
                    html += '<option value="' + escapeHtml(name) + '"' + (isOrdered ? ' selected' : '') + '>' +
                        escapeHtml(name) + (isOrdered ? ' (your last order)' : '') + '</option>';
                });
                // If the ordered color isn't in the list, keep it as the first, selected option.
                if (!matched && orderedColor) {
                    reqState.colorImages[orderedColor] = orderedImage || '';
                    html = '<option value="' + escapeHtml(orderedColor) + '" selected>' + escapeHtml(orderedColor) + ' (your last order)</option>' + html;
                }
                sel.innerHTML = html;
                sel.onchange = function () {
                    var img = reqState.colorImages[sel.value];
                    setReqImage(img || orderedImage || '');
                };
            })
            .catch(function () { /* dropdown already has the ordered color */ });
    }

    function buildSizeGrid(sizes) {
        var grid = document.getElementById('cp-size-grid');
        if (!grid) return;
        grid.innerHTML = SIZE_ORDER.map(function (sz) {
            var v = Number(sizes && sizes[sz]) || 0;
            return '<label class="cp-size-cell">' +
                '<span class="cp-size-name">' + sz + '</span>' +
                '<input type="number" min="0" inputmode="numeric" class="cp-size-input" data-size="' + sz + '" value="' + (v > 0 ? v : '') + '" placeholder="0">' +
                '</label>';
        }).join('');
        var inputs = grid.querySelectorAll('.cp-size-input');
        for (var i = 0; i < inputs.length; i++) inputs[i].addEventListener('input', updateSizeTotal);
        updateSizeTotal();
    }

    function collectSizes() {
        var out = {}, total = 0;
        var inputs = document.querySelectorAll('#cp-size-grid .cp-size-input');
        for (var i = 0; i < inputs.length; i++) {
            var n = parseInt(inputs[i].value, 10);
            if (n > 0) { out[inputs[i].getAttribute('data-size')] = n; total += n; }
        }
        return { sizes: out, total: total };
    }
    function updateSizeTotal() {
        var t = collectSizes().total;
        var el = document.getElementById('cp-size-total');
        if (el) el.textContent = t;
    }

    function submitReq() {
        if (!reqState) return;
        var err = document.getElementById('cp-req-error');
        err.textContent = '';
        var picked = collectSizes();
        if (picked.total <= 0) { err.textContent = 'Enter a quantity for at least one size.'; return; }
        if (PREVIEW) { closeReqModal(); showToast('Staff preview — the customer would send this request to their rep.'); return; }
        var color = document.getElementById('cp-req-color').value || reqState.color || '';
        var breakdown = SIZE_ORDER.filter(function (s) { return picked.sizes[s]; })
            .map(function (s) { return s + ':' + picked.sizes[s]; }).join(', ');
        var submitBtn = document.getElementById('cp-req-submit');
        submitBtn.disabled = true; submitBtn.textContent = 'Sending…';
        fetch('/api/portal/reorder-request', {
            method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                style: reqState.style, color: color, product_title: reqState.title,
                design_number: reqState.design, design_name: reqState.designName,
                qty: String(picked.total), size_breakdown: breakdown,
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
