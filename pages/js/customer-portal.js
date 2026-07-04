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
    // A "Your Products" card links to its full product-detail PAGE (preview-aware).
    var PRODUCT_URL_BASE = PREVIEW ? ('/portal-admin/preview/' + PREVIEW + '/product/') : '/portal/product/';
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
            // Box proof URLs are ALREADY caspio-proxy image endpoints — load them DIRECTLY (grid +
            // lightbox). Double-proxying through /api/image-proxy stalls under page-load concurrency
            // (~30 images at once). Direct also puts them on a separate host from the product images.
            // Grid = 256px thumbnail; lightbox = ?size=large (1024/full). Non-proxy URLs (raw box.com /
            // sanmar) still go through the FE image-proxy.
            var isBox = /\/api\/box\/thumbnail\//.test(l.img);
            var gridSrc = isBox ? l.img : ('/api/image-proxy?url=' + encodeURIComponent(l.img));
            var largeRaw = isBox ? (l.img + (l.img.indexOf('?') === -1 ? '?' : '&') + 'size=large') : l.img;
            var largeSrc = isBox ? largeRaw : ('/api/image-proxy?url=' + encodeURIComponent(largeRaw));
            // eager (not lazy): My Logos is a small showcase below the fold — lazy left the proof
            // images blank until the customer scrolled far enough. Few images, so eager is fine.
            var img = '<img src="' + gridSrc + '" alt="" loading="eager" '
                + 'onerror="this.parentElement.innerHTML=\'<div class=cp-card-placeholder>&#127912;</div>\'">';
            var badge = l.approved ? '<div class="cp-logo-approved">&#10003; Approved</div>' : '';
            return '<div class="cp-card cp-logo-card" role="button" tabindex="0"'
                + ' data-img="' + escapeAttr(largeSrc) + '" data-title="' + escapeAttr(l.name) + '" data-meta="' + escapeAttr(l.meta || '') + '">'
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
        // A "Your Products" card opens the full product-detail PAGE; recs keep the quick modal.
        var productHref = (kind === 'product' && p.style) ? (PRODUCT_URL_BASE + encodeURIComponent(p.style)) : '';
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
        // Style-level volume ("you order a lot of this") — pieces over the ~3yr history window.
        var totalLine = (kind === 'product' && Number(p.styleTotalQty) > 0)
            ? '<div class="cp-product-total">You&rsquo;ve ordered ' + Number(p.styleTotalQty).toLocaleString() + '</div>'
            : '';
        // Ordered colors + per-color totals → the modal picker marks them and shows "N ordered".
        var orderedColorsJson = JSON.stringify((kind === 'product' && p.colors ? p.colors : []).map(function (c) {
            return { name: c.name, cat: c.catalogColor || '', qty: Number(c.totalQty) || 0 };
        }));
        // Reward pill (premium recommendations only) — marketing label, no money moves. Blank = hidden.
        var reward = (kind === 'rec' && p.rewardText)
            ? '<div class="cp-rec-reward"><span class="cp-rec-reward-star">&#9733;</span> ' + escapeHtml(p.rewardText) + '</div>'
            : '';
        // Carry the exact sizes the customer last ordered so the modal can pre-fill the grid.
        var sizesJson = JSON.stringify(p.sizes || {});
        return '<div class="cp-product-card' + (comingSoon ? ' cp-product-card--soon' : '') + '">' +
            '<div class="cp-product-img">' + (productHref ? '<a class="cp-product-imglink" href="' + productHref + '">' + img + '</a>' : img) + '</div>' +
            '<div class="cp-product-body">' +
                '<div class="cp-product-title">' + (productHref ? '<a class="cp-product-titlelink" href="' + productHref + '">' + escapeHtml(title) + '</a>' : escapeHtml(title)) + '</div>' +
                (sub ? '<div class="cp-product-sub">' + escapeHtml(sub) + '</div>' : '') +
                swatches +
                totalLine +
                (meta ? '<div class="cp-product-meta">' + escapeHtml(meta) + '</div>' : '') +
                reward +
                ((kind === 'product' && productHref)
                    // Your Products re-order → the method-aware product PAGE (decoration picker + API
                    // minimum live there). Same destination as the card image/title.
                    ? '<a class="cp-product-btn" href="' + productHref + '">' + btnLabel + '</a>'
                    // Recommendations → the quick "ask for a quote" modal (exploratory; no method needed).
                    : '<button class="cp-product-btn" type="button" data-kind="' + kind + '"' +
                        ' data-style="' + escapeHtml(p.style) + '" data-color="' + escapeHtml(p.color || '') + '"' +
                        ' data-image="' + escapeHtml(p.image || '') + '"' +
                        ' data-title="' + escapeHtml(title) + '" data-design="' + escapeHtml(String(p.designNumber || '')) + '"' +
                        ' data-designname="' + escapeHtml(p.designName || '') + '"' +
                        " data-colors='" + escapeAttr(orderedColorsJson) + "'" +
                        " data-sizes='" + escapeAttr(sizesJson) + "'>" +
                        btnLabel + '</button>') +
            '</div></div>';
    }

    // JSON goes inside a single-quoted attribute — escape the few chars that would break it.
    function escapeAttr(s) {
        return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/'/g, '&#39;').replace(/</g, '&lt;');
    }

    // "Your Products" now supports search + sort + show-more so a 25-style account isn't a wall of cards.
    var _products = [];
    var _productSort = 'ordered';
    var _productLimit = 12;

    function loadProducts() {
        fetch(MYPRODUCTS_URL, { credentials: 'same-origin' })
            .then(function (r) { return r.ok ? r.json() : { products: [] }; })
            .then(function (d) {
                _products = (d && d.products) || [];
                document.getElementById('cp-section-products').style.display = 'block';
                var empty = document.getElementById('cp-products-empty');
                var toolbar = document.getElementById('cp-products-toolbar');
                if (!_products.length) {
                    document.getElementById('cp-products-count').textContent = 0;
                    document.getElementById('cp-products-grid').innerHTML = '';
                    empty.style.display = 'block';
                    return;
                }
                empty.style.display = 'none';
                if (toolbar && _products.length > 6) toolbar.style.display = 'flex'; // aids only when they help
                renderProducts();
            })
            .catch(function () { /* catalog is non-critical — stay quiet */ });
    }

    function renderProducts() {
        var grid = document.getElementById('cp-products-grid');
        if (!grid) return;
        var searchEl = document.getElementById('cp-products-search');
        var q = ((searchEl && searchEl.value) || '').trim().toLowerCase();
        var list = _products.slice();
        if (q) {
            list = list.filter(function (p) {
                var hay = [p.title, p.description, p.style, p.designNumber, p.designName]
                    .concat((p.colors || []).map(function (c) { return c.name; }))
                    .join(' ').toLowerCase();
                return hay.indexOf(q) !== -1;
            });
        }
        list.sort(function (a, b) {
            if (_productSort === 'recent') return String(b.lastOrdered || '').localeCompare(String(a.lastOrdered || ''));
            if (_productSort === 'colors') return (Number(b.colorCount) || 0) - (Number(a.colorCount) || 0);
            return (Number(b.styleTotalQty) || 0) - (Number(a.styleTotalQty) || 0); // 'ordered' (default)
        });
        var total = list.length;
        var shown = q ? list : list.slice(0, _productLimit); // a search shows all matches; browsing paginates
        document.getElementById('cp-products-count').textContent = total;
        grid.innerHTML = shown.map(function (p) { return productCardHtml(p, 'product'); }).join('');
        var moreWrap = document.getElementById('cp-products-more');
        var moreBtn = document.getElementById('cp-products-more-btn');
        if (moreWrap) {
            if (!q && total > _productLimit) { moreWrap.style.display = 'block'; if (moreBtn) moreBtn.textContent = 'Show all ' + total; }
            else { moreWrap.style.display = 'none'; }
        }
    }

    (function wireProductControls() {
        var search = document.getElementById('cp-products-search');
        var sort = document.getElementById('cp-products-sort');
        var moreBtn = document.getElementById('cp-products-more-btn');
        if (search) search.addEventListener('input', renderProducts);
        if (sort) sort.addEventListener('change', function () { _productSort = sort.value; renderProducts(); });
        if (moreBtn) moreBtn.addEventListener('click', function () { _productLimit = 9999; renderProducts(); });
    })();

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
        var btn = e.target.closest && e.target.closest('button.cp-product-btn'); // <a> product-page links navigate normally
        if (btn) openReqModal(btn);
    });

    var SIZE_ORDER = ['S', 'M', 'L', 'XL', '2XL', '3XL'];

    function openReqModal(btn) {
        var parsedSizes = {};
        try { parsedSizes = JSON.parse(btn.getAttribute('data-sizes') || '{}') || {}; } catch (e) { parsedSizes = {}; }
        var parsedColors = [];
        try { parsedColors = JSON.parse(btn.getAttribute('data-colors') || '[]') || []; } catch (e) { parsedColors = []; }
        reqState = {
            kind: btn.getAttribute('data-kind'),
            style: btn.getAttribute('data-style'),
            color: btn.getAttribute('data-color'),
            image: btn.getAttribute('data-image') || '',
            title: btn.getAttribute('data-title'),
            design: btn.getAttribute('data-design'),
            designName: btn.getAttribute('data-designname'),
            sizes: parsedSizes,
            orderedColors: parsedColors
        };
        document.getElementById('cp-req-title').textContent = reqState.kind === 'product' ? 'Re-order this product' : 'Ask for a quote';
        document.getElementById('cp-req-product').innerHTML =
            '<div class="cp-req-prod-title">' + escapeHtml(reqState.title) + '</div>' +
            '<div class="cp-req-prod-sub">' + escapeHtml('Style ' + (reqState.style || '') + (reqState.design ? ' · Design #' + reqState.design : '')) + '</div>';
        setReqImage(reqState.image);
        buildSizeGrid(reqState.sizes);
        // Catalog-style color picker: a hidden input (#cp-req-color) holds the chosen color;
        // render the swatch grid, mark previously-ordered colors + their piece totals.
        document.getElementById('cp-req-color').value = reqState.color || '';
        renderColorPicker(reqState.style, reqState.color, reqState.image);
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

    // ── Catalog-style color picker (replaces the old native <select>) ──
    // The color the customer ordered is a ShopWorks CATALOG_COLOR ("Hthrd Charcoal"); the backend
    // resolves it to the SanMar COLOR_NAME ("Heathered Charcoal") and passes BOTH (name + cat), so
    // we match ordered → available on EITHER field exactly — no abbreviation guessing.
    function normColor(s) { return String(s == null ? '' : s).toLowerCase().replace(/[^a-z0-9]/g, ''); }
    function orderedQtyMap() {
        var map = {};
        ((reqState && reqState.orderedColors) || []).forEach(function (c) {
            if (!c) return;
            var q = Number(c.qty) || 0;
            if (c.name) map[normColor(c.name)] = q;      // key by COLOR_NAME
            if (c.cat) map[normColor(c.cat)] = q;        // …and by CATALOG_COLOR
        });
        return map;
    }
    // Caption next to the "Color" label: "· N ordered before" for a previously-bought color.
    function setColorStat(colorName) {
        var el = document.getElementById('cp-req-colorstat');
        if (!el) return;
        var q = orderedQtyMap()[normColor(colorName)] || 0;
        el.textContent = q > 0 ? ('· ' + q.toLocaleString() + ' ordered before') : '';
    }

    // Render the swatch grid: every available color, previously-ordered ones marked with their
    // piece total and sorted to the front. Seeds instantly with the ordered color(s), then enriches
    // from the live product-colors list. The chosen color lives in the hidden #cp-req-color input.
    function renderColorPicker(style, orderedColor, orderedImage) {
        var grid = document.getElementById('cp-req-colors');
        if (!grid) return;

        function renderTiles(colors) {
            reqState.colorImages = {};
            // Ordered colors carry COLOR_NAME (name) + CATALOG_COLOR (cat); a one-time "used" flag
            // binds each qty to at most one catalog tile (never double-counts).
            var ordered = ((reqState && reqState.orderedColors) || []).map(function (oc) {
                return { name: oc.name, nk: normColor(oc.name), ck: normColor(oc.cat || ''), qty: Number(oc.qty) || 0, used: false };
            });
            function takeQty(nameKey, catKey) {
                for (var i = 0; i < ordered.length; i++) {
                    var o = ordered[i];
                    if (o.used) continue;
                    if ((o.nk && o.nk === nameKey) || (o.ck && catKey && o.ck === catKey)) { o.used = true; return o.qty; }
                }
                return 0;
            }
            var enriched = colors.map(function (c, i) {
                var name = c.name || c.catalogColor || '';
                var cat = c.catalogColor || '';
                return { name: name, cat: cat, image: c.image || '', swatch: c.swatch || '', qty: name ? takeQty(normColor(name), normColor(cat)) : 0, i: i };
            }).filter(function (c) { return c.name; });
            // Ordered colors with no catalog tile (truly discontinued) → show as a no-image tile.
            ordered.forEach(function (o) {
                if (!o.used) { enriched.unshift({ name: o.name, cat: '', image: '', swatch: '', qty: o.qty, i: -1 }); o.used = true; }
            });
            // Ordered colors first (by piece total desc), then the rest in catalog order.
            enriched.sort(function (a, b) {
                if ((b.qty > 0) !== (a.qty > 0)) return (b.qty > 0 ? 1 : 0) - (a.qty > 0 ? 1 : 0);
                if (b.qty !== a.qty) return b.qty - a.qty;
                return a.i - b.i;
            });
            // Default selection = the card's shown color (orderedColor may be a COLOR_NAME or a raw
            // CATALOG_COLOR) → its tile; else the top-ordered color; else the first tile.
            var hidden = document.getElementById('cp-req-color');
            var selKey = normColor(hidden.value || orderedColor);
            var selName = '';
            enriched.forEach(function (c) { if (!selName && selKey && (normColor(c.name) === selKey || normColor(c.cat) === selKey)) selName = c.name; });
            if (!selName) { var top = enriched.filter(function (c) { return c.qty > 0; })[0]; selName = top ? top.name : (enriched[0] ? enriched[0].name : ''); }
            hidden.value = selName;
            var topName = (enriched.length && enriched[0].qty > 0) ? enriched[0].name : null;
            grid.innerHTML = enriched.map(function (c) {
                reqState.colorImages[c.name] = c.image || '';
                var isSel = c.name === selName;
                var sq = c.swatch
                    ? '<span class="cp-swatch-sq"><img src="' + escapeHtml(c.swatch) + '" alt="" loading="lazy" onerror="this.remove();"></span>'
                    : '<span class="cp-swatch-sq cp-swatch-sq--noimg"></span>';
                var tag = (topName && c.name === topName) ? '<span class="cp-swatch-tag">Top color</span>' : '';
                var qtyLine = c.qty > 0 ? '<span class="cp-swatch-qty">' + c.qty.toLocaleString() + ' ordered</span>' : '';
                return '<button type="button" class="cp-swatch-btn' + (isSel ? ' is-selected' : '') + '" data-color="' + escapeHtml(c.name) + '">' +
                    tag + sq + '<span class="cp-swatch-nm">' + escapeHtml(c.name) + '</span>' + qtyLine + '</button>';
            }).join('');
            setColorStat(selName);
            var selImg = reqState.colorImages[selName] || orderedImage || '';
            if (selImg) setReqImage(selImg);
        }

        // Seed with the ordered color(s) so the picker is never empty, then load the full list.
        renderTiles(((reqState && reqState.orderedColors) || []).map(function (c) {
            return { name: c.name, catalogColor: c.cat || '', image: '', swatch: '' };
        }));
        fetch(COLORS_URL_BASE + encodeURIComponent(style), { credentials: 'same-origin' })
            .then(function (r) { return r.ok ? r.json() : { colors: [] }; })
            .then(function (d) { var colors = (d && d.colors) || []; if (colors.length) renderTiles(colors); })
            .catch(function () { /* keep the seeded ordered-color tiles */ });
    }

    // Swatch click → select that color (updates the hidden input, preview image, and caption).
    document.addEventListener('click', function (e) {
        var sw = e.target.closest && e.target.closest('.cp-swatch-btn');
        if (!sw) return;
        var grid = document.getElementById('cp-req-colors');
        if (!grid || !grid.contains(sw)) return;
        var name = sw.getAttribute('data-color') || '';
        document.getElementById('cp-req-color').value = name;
        var sibs = grid.querySelectorAll('.cp-swatch-btn');
        for (var i = 0; i < sibs.length; i++) sibs[i].classList.remove('is-selected');
        sw.classList.add('is-selected');
        setReqImage((reqState && reqState.colorImages && reqState.colorImages[name]) || (reqState && reqState.image) || '');
        setColorStat(name);
    });

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
