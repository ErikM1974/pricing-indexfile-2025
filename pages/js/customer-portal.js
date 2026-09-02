/**
 * Customer Portal — /portal (session-gated) · staff preview at /portal-admin/preview/:id
 *
 * 2026-09-01 redesign. App-shell (sidebar spine + top bar + mobile bottom nav) with
 * seven views: Overview · Your products · Orders · Invoices · Logos & proofs · Quotes ·
 * Account & help. Every view loads independently; the Overview composes whatever has
 * landed so far (attention list, KPI tiles, recent orders, logo strip).
 *
 * Data comes ONLY from the gated, customer-safe same-origin endpoints (/api/portal/*),
 * which return allowlist projections — internal fields never reach this file. Staff
 * preview points the same fetches at the /api/portal-admin/preview/:id/* mirrors and
 * turns every write into a toast.
 *
 * Erik's #1 rule throughout: a failed load is a visible error + Retry, never a
 * reassuring empty state or a false "$0".
 */
(function () {
    'use strict';

    // ── Mode + endpoints ─────────────────────────────────────────────────────
    var PREVIEW = (function () { var m = location.pathname.match(/^\/portal-admin\/preview\/(\d+)/); return m ? m[1] : null; })();
    var API = PREVIEW ? ('/api/portal-admin/preview/' + PREVIEW) : '/api/portal';
    var AGG_URL = API;
    var ORDERS_URL = API + '/orders';
    var MYPRODUCTS_URL = API + '/my-products';
    var RECS_URL = API + '/recommendations';
    var REWARDS_URL = API + '/rewards';
    var ME_URL = API + '/me';
    var QUOTES_URL = API + '/quotes';
    var COLORS_URL_BASE = API + '/product-colors/';
    var INVOICE_API_BASE = API + '/invoice/';
    var TRACKING_URL = function (orderNo) { return API + '/order/' + encodeURIComponent(orderNo) + '/tracking'; };
    var PRODUCT_URL_BASE = PREVIEW ? ('/portal-admin/preview/' + PREVIEW + '/product/') : '/portal/product/';
    var INVOICE_BASE = PREVIEW ? ('/portal-admin/preview/' + PREVIEW + '/invoice/') : '/portal/invoice/';
    var LOGIN_URL = PREVIEW ? '/auth/saml/login' : '/customer/login';
    var PHONE_TXT = '(253) 922-5793';
    var PHONE_HREF = 'tel:+12539225793';

    // ── Tiny DOM helpers ─────────────────────────────────────────────────────
    function $(sel) { return document.querySelector(sel); }
    function $$(sel) { return Array.prototype.slice.call(document.querySelectorAll(sel)); }
    function byId(id) { return document.getElementById(id); }
    function show(el, on) { if (el) el.hidden = !on; }
    function setText(id, v) { var el = byId(id); if (el) el.textContent = v == null ? '' : String(v); }
    function escapeHtml(str) {
        if (str == null || str === '') return '';
        var div = document.createElement('div');
        div.appendChild(document.createTextNode(String(str)));
        // textContent→innerHTML escapes & < > but NOT " — values land in double-quoted attributes too.
        return div.innerHTML.replace(/"/g, '&quot;');
    }
    function escapeAttr(s) {
        return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;');
    }
    function money(n) {
        var v = Number(n) || 0;
        return '$' + v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    function money0(n) {
        var v = Number(n) || 0;
        return '$' + v.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
    }
    // Parse the DATE portion at LOCAL midnight and render with LOCAL getters — never a UTC
    // shift (a July 4 order must never read July 3). Mirrors customer-product.js.
    function parseDay(dateStr) {
        if (!dateStr) return null;
        var d = new Date(String(dateStr).slice(0, 10) + 'T00:00:00');
        return isNaN(d.getTime()) ? null : d;
    }
    function formatDate(dateStr) {
        var d = parseDay(dateStr);
        if (!d) return dateStr ? String(dateStr).slice(0, 10) : '';
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }
    function formatDateShort(dateStr) {
        var d = parseDay(dateStr);
        if (!d) return '';
        var now = new Date();
        return d.toLocaleDateString('en-US', d.getFullYear() === now.getFullYear() ? { month: 'short', day: 'numeric' } : { month: 'short', day: 'numeric', year: 'numeric' });
    }
    function daysUntil(dateStr) {
        var d = parseDay(dateStr);
        if (!d) return null;
        var today = new Date(); today.setHours(0, 0, 0, 0);
        return Math.round((d.getTime() - today.getTime()) / 86400000);
    }
    function icon(name, cls) { return '<svg class="cp-icon' + (cls ? ' ' + cls : '') + '" aria-hidden="true"><use href="#i-' + name + '"/></svg>'; }
    function initials(name) {
        var parts = String(name || '').trim().split(/\s+/).filter(Boolean);
        if (!parts.length) return 'NW';
        return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
    }
    function plural(n, one, many) { return n + ' ' + (n === 1 ? one : (many || one + 's')); }
    function showToast(msg) {
        var t = byId('cp-toast');
        if (!t) return;
        t.innerHTML = msg;
        t.className = 'cp-toast show';
        clearTimeout(showToast._t);
        showToast._t = setTimeout(function () { t.className = 'cp-toast'; }, 4200);
    }
    function renderStatusBadge(status, extraSlug) {
        if (!status || status === '—') {
            return '<span class="cp-status cp-status--neutral">' + escapeHtml(status || 'Unknown') + '</span>';
        }
        var slug = extraSlug || status.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        return '<span class="cp-status cp-status--' + slug + '">' + escapeHtml(status) + '</span>';
    }
    // Visible failure state for a portal list: retry banner in place of the rows, count "—",
    // empty-state copy suppressed so a failure never reads as "you have none".
    function renderLoadError(wrapId, emptyId, countId, retryKey, msg) {
        var wrap = byId(wrapId), empty = byId(emptyId), count = byId(countId);
        if (count) count.textContent = '—';
        show(empty, false);
        if (wrap) {
            wrap.innerHTML = '<div class="cp-load-error" role="alert">' +
                '<p>' + escapeHtml(msg) + ' right now.</p>' +
                '<p class="cp-load-error-sub">Refresh the page or call us at <a href="' + PHONE_HREF + '">' + PHONE_TXT + '</a> and we\'ll help.</p>' +
                '<button type="button" class="cp-load-retry" data-cp-retry="' + escapeAttr(retryKey) + '">Retry</button>' +
                '</div>';
        }
    }

    // ── State ────────────────────────────────────────────────────────────────
    var S = {
        custId: PREVIEW || '',
        companyName: '',
        me: null,
        rep: null,
        orders: [], ordersLoaded: false, ordersFailed: false,
        products: [], productsLoaded: false,
        recs: [],
        quotes: [], quotesLoaded: false, quotesFailed: false,
        logos: { approved: [], mockups: [], finished: [] }, logosLoaded: false, logosFailed: false,
        awaiting: [],          // proofs waiting on the customer: { name, design, date, approveUrl, kind }
        actionKeys: {},
        rewardBalance: 0, rewardEntries: [], rewardsLoaded: false, rewardProgram: null, rewardEarned: 0,
        orderFilter: 'all', invoiceFilter: 'all', logoQuery: '',
        currentTab: 'overview',
    };

    // ══════════════════════════════════════════════════════════════════════
    // SHELL — router, sidebar, search
    // ══════════════════════════════════════════════════════════════════════
    var TABS = ['overview', 'products', 'orders', 'invoices', 'logos', 'quotes', 'account'];
    var TAB_TITLES = { overview: 'Overview', products: 'Your products', orders: 'Orders', invoices: 'Invoices', logos: 'Logos & proofs', quotes: 'Quotes', account: 'Account & help' };

    function tabFromHash() {
        var raw = String(location.hash || '').replace(/^#/, '');
        var m = raw.match(/(?:^|&)tab=([a-z]+)/);
        var t = m ? m[1] : raw;
        return TABS.indexOf(t) >= 0 ? t : 'overview';
    }
    function switchTab(name, opts) {
        opts = opts || {};
        if (TABS.indexOf(name) < 0) name = 'overview';
        $$('.cp-panel').forEach(function (p) { p.hidden = p.getAttribute('data-panel') !== name; });
        $$('.cp-nav a[data-tab], .cp-bottomnav a[data-tab]').forEach(function (a) {
            if (a.getAttribute('data-tab') === name) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
        });
        S.currentTab = name;
        if (!opts.silent) {
            var h = '#tab=' + name;
            if (location.hash !== h) { try { history.replaceState(null, '', h); } catch (e) { location.hash = h; } }
        }
        closeSidebar();
        if (opts.scroll !== false) { try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch (e) { window.scrollTo(0, 0); } }
        if (opts.focus) { var panel = byId('cp-panel-' + name); if (panel) { try { panel.focus({ preventScroll: true }); } catch (e) { /* older browsers */ } } }
        updateTitle();
    }
    function updateTitle() {
        var t = TAB_TITLES[S.currentTab] || 'Your account';
        document.title = (S.companyName ? S.companyName + ' · ' : '') + t + ' | NWCA';
    }

    function openSidebar() {
        var side = byId('cp-side'), bd = byId('cp-side-backdrop'), btn = byId('cp-menu-btn');
        if (!side) return;
        side.classList.add('is-open'); show(bd, true);
        if (btn) btn.setAttribute('aria-expanded', 'true');
    }
    function closeSidebar() {
        var side = byId('cp-side'), bd = byId('cp-side-backdrop'), btn = byId('cp-menu-btn');
        if (!side) return;
        side.classList.remove('is-open'); show(bd, false);
        if (btn) btn.setAttribute('aria-expanded', 'false');
    }

    // One delegated click handler for the shell: tabs, chips, retries, request buttons, rows.
    document.addEventListener('click', function (e) {
        if (!e.target.closest) return;
        var t;
        if ((t = e.target.closest('[data-tab]'))) {
            e.preventDefault();
            var name = t.getAttribute('data-tab');
            if (t.hasAttribute('data-invfilter')) setInvoiceFilter(t.getAttribute('data-invfilter'));
            if (t.hasAttribute('data-ordfilter')) setOrderFilter(t.getAttribute('data-ordfilter'));
            switchTab(name, { focus: true });
            return;
        }
        if ((t = e.target.closest('[data-open-request]'))) { e.preventDefault(); openGenModal(t.getAttribute('data-open-request'), {}); return; }
        if ((t = e.target.closest('[data-cp-retry]'))) {
            e.preventDefault();
            var what = t.getAttribute('data-cp-retry');
            if (what === 'orders') loadOrders(); else if (what === 'products') loadProducts(); else if (what === 'quotes') loadQuotes(); else if (what === 'logos') loadPortalData();
            return;
        }
        if ((t = e.target.closest('.cp-rows-more'))) { toggleRows(t); return; }
        if ((t = e.target.closest('#cp-orders-filters .cp-chip'))) { setOrderFilter(t.getAttribute('data-filter')); renderOrders(); return; }
        if ((t = e.target.closest('#cp-invoices-filters .cp-chip'))) { setInvoiceFilter(t.getAttribute('data-filter')); renderInvoices(); return; }
        if ((t = e.target.closest('.cp-subtab[data-subtab]'))) { e.preventDefault(); switchLogoSubtab(t.getAttribute('data-subtab')); return; }
        if ((t = e.target.closest('[data-open-order]'))) {
            // A row is clickable, but its own buttons/links keep their own jobs.
            if (e.target.closest('a, button') && !t.matches('button')) return;
            e.preventDefault(); openOrderDrawer(t.getAttribute('data-open-order'));
            return;
        }
        if ((t = e.target.closest('.cp-row-reorder'))) { reorderFromOrder(t); return; }
        if ((t = e.target.closest('button.cp-product-btn'))) { openReqModal(t); return; }
        if ((t = e.target.closest('.cp-strip-item[data-logo-idx]'))) { openLogoLightboxFromItem(t); return; }
        if ((t = e.target.closest('.cp-logo-card'))) {
            if (e.target.closest('a')) return;   // the "Review & approve" link navigates
            openLogoLightbox(t); return;
        }
        var lb = byId('cp-logo-lightbox');
        if (lb && !lb.hidden && (e.target === lb || e.target.id === 'cp-lightbox-close')) { closeLogoLightbox(); return; }
    });
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') {
            closeLogoLightbox(); closeOrderDrawer(); closeSidebar(); closeReqModal(); closeRedeem(); closeGenModal(); closeStatement(); hideSearchResults();
            return;
        }
        var card = e.target.closest && e.target.closest('.cp-logo-card');
        if (card && (e.key === 'Enter' || e.key === ' ') && !e.target.closest('a, button')) { e.preventDefault(); openLogoLightbox(card); }
    });
    window.addEventListener('hashchange', function () { switchTab(tabFromHash(), { silent: true }); });
    (function wireShell() {
        var mb = byId('cp-menu-btn'); if (mb) mb.addEventListener('click', function () { if (byId('cp-side').classList.contains('is-open')) closeSidebar(); else openSidebar(); });
        var bd = byId('cp-side-backdrop'); if (bd) bd.addEventListener('click', closeSidebar);
        var logo = byId('cp-side-logo'); if (logo) logo.addEventListener('error', function () { this.style.display = 'none'; });
        var st = byId('cp-action-statement'); if (st) st.addEventListener('click', openStatement);
        var st2 = byId('cp-statement-btn'); if (st2) st2.addEventListener('click', openStatement);
        if (PREVIEW) {
            var so = byId('cp-signout-link');
            if (so) { so.setAttribute('href', '/dashboards/customer-portal-admin.html'); so.textContent = 'Exit preview'; }
        }
        switchTab(tabFromHash(), { silent: true, scroll: false });
    })();

    // ── Global search: results grouped from whatever has loaded ──
    var _searchItems = [];
    function hideSearchResults() {
        var box = byId('cp-search-results'), inp = byId('cp-global-search');
        if (box) { box.hidden = true; box.innerHTML = ''; }
        if (inp) inp.setAttribute('aria-expanded', 'false');
        _searchItems = [];
    }
    function runSearch(q) {
        q = String(q || '').trim().toLowerCase();
        var box = byId('cp-search-results'), inp = byId('cp-global-search');
        if (!box) return;
        if (q.length < 2) { hideSearchResults(); return; }
        var hits = [];
        var has = function (v) { return v != null && String(v).toLowerCase().indexOf(q) !== -1; };
        S.orders.forEach(function (o) {
            if (has(o.orderNumber) || has(o.designName) || has(o.poNumber)) hits.push({ group: 'Orders', icon: 'box', label: 'Order #' + o.orderNumber + (o.designName ? ' · ' + o.designName : ''), sub: formatDateShort(o.orderDate) + ' · ' + money(o.total), act: function () { openOrderDrawer(o.orderNumber); } });
        });
        S.products.forEach(function (p) {
            var hay = [p.title, p.description, p.style, p.designName].concat((p.colors || []).map(function (c) { return c.name; }));
            if (hay.some(has)) hits.push({ group: 'Your products', icon: 'shirt', label: p.title || p.style, sub: p.style + (p.color ? ' · ' + p.color : ''), href: PRODUCT_URL_BASE + encodeURIComponent(p.style) });
        });
        allLogoItems().forEach(function (l, i) {
            if (has(l.name) || has(l.design) || has(l.meta)) hits.push({ group: 'Logos & proofs', icon: 'palette', label: l.name, sub: (l.design ? 'Design #' + l.design : '') + (l.typeName ? ' · ' + l.typeName : ''), act: function () { switchTab('logos'); switchLogoSubtab(l.bucket); setTimeout(function () { var c = $('.cp-logo-card[data-key="' + CSS.escape(l.key) + '"]'); if (c) openLogoLightbox(c); }, 80); } });
        });
        S.quotes.forEach(function (qt) {
            if (has(qt.quoteId) || has(qt.projectName)) hits.push({ group: 'Quotes', icon: 'file', label: qt.quoteId + (qt.projectName ? ' · ' + qt.projectName : ''), sub: qt.status + ' · ' + money(qt.total), href: qt.viewUrl || '', act: qt.viewUrl ? null : function () { switchTab('quotes'); } });
        });
        hits = hits.slice(0, 9);
        _searchItems = hits;
        if (!hits.length) { box.innerHTML = '<div class="cp-search-none">Nothing matches &ldquo;' + escapeHtml(q) + '&rdquo;' + (S.ordersLoaded ? '' : ' yet &mdash; still loading') + '.</div>'; box.hidden = false; return; }
        var html = '', lastGroup = '';
        hits.forEach(function (h, i) {
            if (h.group !== lastGroup) { html += '<div class="cp-search-group">' + escapeHtml(h.group) + '</div>'; lastGroup = h.group; }
            var inner = icon(h.icon) + '<span>' + escapeHtml(h.label) + '</span>' + (h.sub ? '<small>' + escapeHtml(h.sub) + '</small>' : '');
            html += h.href
                ? '<a class="cp-search-item" role="option" href="' + escapeAttr(h.href) + '" data-sidx="' + i + '">' + inner + '</a>'
                : '<button class="cp-search-item" role="option" type="button" data-sidx="' + i + '">' + inner + '</button>';
        });
        box.innerHTML = html; box.hidden = false;
        if (inp) inp.setAttribute('aria-expanded', 'true');
    }
    (function wireSearch() {
        var inp = byId('cp-global-search'), form = byId('cp-search-form'), box = byId('cp-search-results');
        if (!inp || !form) return;
        inp.addEventListener('input', function () { runSearch(inp.value); });
        inp.addEventListener('focus', function () { if (inp.value.trim().length >= 2) runSearch(inp.value); });
        form.addEventListener('submit', function (e) {
            e.preventDefault();
            var first = box && box.querySelector('.cp-search-item');
            if (first) first.click();
        });
        if (box) box.addEventListener('click', function (e) {
            var it = e.target.closest('.cp-search-item'); if (!it) return;
            var h = _searchItems[Number(it.getAttribute('data-sidx'))];
            if (h && h.act) { e.preventDefault(); h.act(); }
            hideSearchResults(); inp.value = '';
        });
        document.addEventListener('click', function (e) { if (!e.target.closest('#cp-search-form')) hideSearchResults(); });
    })();

    // ── Global alert (a feed failed) ──
    var _alertRetry = null;
    function showGlobalAlert(msg, retry) {
        var el = byId('cp-global-alert');
        if (!el) return;
        setText('cp-global-alert-text', msg);
        _alertRetry = retry || null;
        show(byId('cp-global-alert-retry'), !!retry);
        show(el, true);
    }
    function hideGlobalAlert() { show(byId('cp-global-alert'), false); _alertRetry = null; }
    (function wireAlert() { var b = byId('cp-global-alert-retry'); if (b) b.addEventListener('click', function () { if (_alertRetry) _alertRetry(); }); })();

    // Staff-preview banner — unmistakable that this is the staff console viewing a customer.
    function showPreviewRibbon() {
        var col = byId('cp-col');
        if (!col) return;
        var bar = document.createElement('div');
        bar.className = 'cp-preview-ribbon';
        bar.innerHTML = '<span><strong>Staff preview</strong> &middot; this is exactly what the customer sees (read-only)</span>' +
            '<a href="/dashboards/customer-portal-admin.html">&larr; Back to Customer Portals</a>';
        col.insertBefore(bar, col.firstChild);
        document.body.classList.add('cp-has-ribbon');
    }
    if (PREVIEW) showPreviewRibbon();

    // ══════════════════════════════════════════════════════════════════════
    // LOADERS — every view loads on its own; the Overview composes what landed
    // ══════════════════════════════════════════════════════════════════════
    loadPortalData();
    loadOrders();
    loadProducts();
    loadRecs();
    loadRewards();
    loadMe();
    loadQuotes();

    function setCompany(name) {
        S.companyName = name || '';
        var disp = S.companyName || 'Your account';
        setText('cp-topbar-company', disp);
        setText('cp-topbar-sub', S.custId ? 'Customer #' + S.custId : 'Your account overview');
        setText('cp-acct-company', S.companyName || '—');
        setText('cp-acct-number', S.custId || '—');
        var h = new Date().getHours();
        var greet = h < 12 ? 'Good morning' : (h < 17 ? 'Good afternoon' : 'Good evening');
        var g = byId('cp-greeting');
        if (g) g.innerHTML = escapeHtml(greet) + ', <em>' + escapeHtml(S.companyName || 'welcome back') + '</em>.';
        setText('cp-greet-kicker', new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }));
        updateTitle();
    }

    function loadPortalData() {
        hideGlobalAlert();
        fetch(AGG_URL, { credentials: 'same-origin' })
            .then(function (resp) {
                if (resp.status === 401) { window.location.href = LOGIN_URL; throw new Error('auth'); }
                if (!resp.ok) throw new Error('Portal load failed: ' + resp.status);
                return resp.json();
            })
            .then(function (data) {
                S.custId = String(data.customerId || S.custId || '');
                setCompany((data.company && data.company.name) || S.companyName);
                S.logosFailed = false; S.logosLoaded = true;
                renderMyLogos(data.mockups || [], data.artRequests || [], data.logoLibrary || [], data.finishedPhotos || []);
                renderOverview();
            })
            .catch(function (err) {
                if (err && err.message === 'auth') return;
                console.error('Portal load error:', err);
                S.logosFailed = true; S.logosLoaded = false;
                if (!S.companyName) setCompany('');
                showGlobalAlert("We couldn't load your logos and proofs right now.", loadPortalData);
                renderLoadError('cp-approved-grid', 'cp-approved-empty', 'cp-logos-count', 'logos', "We couldn't load your logos");
                show(byId('cp-logos-subtabs'), false);
                renderOverview();
            });
    }

    function loadMe() {
        fetch(ME_URL, { credentials: 'same-origin' })
            .then(function (r) { return r.ok ? r.json() : null; })
            .then(function (d) {
                if (!d) return;
                S.me = d;
                if (d.customerId && !S.custId) S.custId = String(d.customerId);
                if (!S.companyName && d.companyName) setCompany(d.companyName);
                setText('cp-acct-email', d.email || '—');
                setText('cp-quotes-email', d.email || 'your sign-in email');
            })
            .catch(function () { /* the account panel just shows a dash */ });
    }

    function loadOrders() {
        fetch(ORDERS_URL, { credentials: 'same-origin' })
            .then(function (resp) { if (!resp.ok) throw new Error('orders ' + resp.status); return resp.json(); })
            .then(function (data) {
                S.ordersFailed = false; S.ordersLoaded = true;
                S.orders = (data && data.orders) || [];
                renderRep(data && data.rep);
                renderOrders();
                renderInvoices();
                renderOverview();
            })
            .catch(function (err) {
                console.error('Portal orders load failed:', err);
                S.ordersFailed = true; S.ordersLoaded = false;
                show(byId('cp-orders-toolbar'), false);
                show(byId('cp-invoices-toolbar'), false);
                show(byId('cp-inv-summary'), false);
                renderLoadError('cp-orders-wrap', 'cp-orders-empty', 'cp-orders-count', 'orders', "We couldn't load your orders");
                renderLoadError('cp-invoices-wrap', 'cp-invoices-empty', 'cp-invoices-count', 'orders', "We couldn't load your invoices");
                renderOverview();
            });
    }

    function loadProducts() {
        fetch(MYPRODUCTS_URL, { credentials: 'same-origin' })
            .then(function (r) { if (!r.ok) throw new Error('products ' + r.status); return r.json(); })
            .then(function (d) {
                S.products = (d && d.products) || [];
                S.productsLoaded = true;
                var empty = byId('cp-products-empty'), toolbar = byId('cp-products-toolbar');
                if (!S.products.length) {
                    setText('cp-products-count', 0);
                    byId('cp-products-grid').innerHTML = '';
                    show(empty, true);
                } else {
                    show(empty, false);
                    show(toolbar, S.products.length > 6);
                    renderProducts();
                }
                renderOverview();
            })
            .catch(function (err) {
                console.error('Portal products load failed:', err);
                show(byId('cp-products-toolbar'), false);
                byId('cp-products-grid').innerHTML = '';
                renderLoadError('cp-products-grid', 'cp-products-empty', 'cp-products-count', 'products', "We couldn't load your products");
            });
    }

    function loadRecs() {
        fetch(RECS_URL, { credentials: 'same-origin' })
            .then(function (r) { return r.ok ? r.json() : { recommendations: [] }; })
            .then(function (d) {
                S.recs = (d && d.recommendations) || [];
                if (!S.recs.length) return;
                var html = S.recs.map(function (p) { return productCardHtml(p, 'rec'); }).join('');
                ['cp-recs-grid', 'cp-ov-recs-grid'].forEach(function (id) { var g = byId(id); if (g) g.innerHTML = html; });
                show(byId('cp-section-recs'), true);
                show(byId('cp-ov-recs-section'), true);
            })
            .catch(function () { });
    }

    function loadQuotes() {
        fetch(QUOTES_URL, { credentials: 'same-origin' })
            .then(function (r) { if (!r.ok) throw new Error('quotes ' + r.status); return r.json(); })
            .then(function (d) {
                S.quotes = (d && d.quotes) || [];
                S.quotesLoaded = true; S.quotesFailed = false;
                renderQuotes();
                renderOverview();
            })
            .catch(function (err) {
                console.error('Portal quotes load failed:', err);
                S.quotesFailed = true; S.quotesLoaded = false;
                renderLoadError('cp-quotes-wrap', 'cp-quotes-empty', 'cp-quotes-count', 'quotes', "We couldn't load your quotes");
                renderOverview();
            });
    }

    // ══════════════════════════════════════════════════════════════════════
    // REP — sidebar card, overview card, account row
    // ══════════════════════════════════════════════════════════════════════
    function renderRep(rep) {
        S.rep = rep && rep.name ? rep : null;
        var els = { side: byId('cp-side-rep'), ov: byId('cp-ov-rep') };
        if (!S.rep) { show(els.side, false); show(els.ov, false); setText('cp-acct-rep', 'Our sales team · ' + PHONE_TXT); return; }
        var email = rep.email || '';
        var mail = email ? 'mailto:' + email : 'mailto:sales@nwcustomapparel.com';
        setText('cp-rep-avatar', initials(rep.name)); setText('cp-ov-rep-avatar', initials(rep.name));
        setText('cp-rep-name', rep.name); setText('cp-ov-rep-name', rep.name);
        var se = byId('cp-rep-email'); if (se) { se.setAttribute('href', mail); se.querySelector('span').textContent = email || 'sales@nwcustomapparel.com'; }
        var oe = byId('cp-ov-rep-email'); if (oe) oe.setAttribute('href', mail);
        setText('cp-acct-rep', rep.name + (email ? ' · ' + email : ' · ' + PHONE_TXT));
        var sub = byId('cp-greet-sub');
        if (sub) sub.innerHTML = 'Everything you&rsquo;ve ordered, every logo on file, and every invoice &mdash; in one place. Your rep is <a href="' + escapeAttr(mail) + '">' + escapeHtml(rep.name) + '</a>.';
        show(els.side, true); show(els.ov, true);
    }

    // ══════════════════════════════════════════════════════════════════════
    // OVERVIEW — attention list, KPIs, recent orders, logo strip
    // ══════════════════════════════════════════════════════════════════════
    function invoiceRows() { return S.orders.filter(function (o) { return o.invoiceDate || o.total > 0; }); }
    function invoiceState(o) {
        var bal = Number(o.balance) || 0;
        if (bal <= 0.005) return 'paid';
        var days = daysUntil(o.dueDate);
        if (days != null && days < 0) return 'pastdue';
        return 'open';
    }

    function renderOverview() {
        // Attention list — waits for the two feeds that can put a ball in the customer's court.
        var settled = (S.ordersLoaded || S.ordersFailed) && (S.logosLoaded || S.logosFailed);
        var list = byId('cp-attn-list'), clear = byId('cp-attn-clear'), attn = byId('cp-attn');
        var items = [];
        S.awaiting.forEach(function (p) {
            items.push({ ico: 'proof', svg: 'palette', title: 'A proof for ' + (p.name || 'your design') + ' is waiting for your approval',
                sub: [p.design ? 'Design #' + p.design : '', p.date ? 'Sent ' + formatDateShort(p.date) : ''].filter(Boolean).join(' · '),
                cta: p.approveUrl ? '<a class="cp-btn cp-btn--gold cp-btn--sm" href="' + escapeAttr(p.approveUrl) + '">Review &amp; approve</a>'
                    : '<button class="cp-btn cp-btn--gold cp-btn--sm" type="button" data-tab="logos">Review</button>' });
        });
        if (S.ordersLoaded) {
            var inv = invoiceRows();
            var past = inv.filter(function (o) { return invoiceState(o) === 'pastdue'; });
            var soon = inv.filter(function (o) { var d = daysUntil(o.dueDate); return invoiceState(o) === 'open' && d != null && d <= 7; });
            if (past.length) {
                var pSum = past.reduce(function (s, o) { return s + (Number(o.balance) || 0); }, 0);
                items.push({ ico: 'money', svg: 'receipt', title: plural(past.length, 'invoice is', 'invoices are') + ' past due &middot; ' + money(pSum),
                    sub: 'Questions? accounting@nwcustomapparel.com &middot; ' + PHONE_TXT,
                    cta: '<button class="cp-btn cp-btn--danger cp-btn--sm" type="button" data-tab="invoices" data-invfilter="pastdue">View invoices</button>' });
            }
            if (soon.length) {
                var sSum = soon.reduce(function (s, o) { return s + (Number(o.balance) || 0); }, 0);
                items.push({ ico: 'soon', svg: 'clock', title: plural(soon.length, 'invoice is', 'invoices are') + ' due within 7 days &middot; ' + money(sSum),
                    sub: soon.map(function (o) { return '#' + o.orderNumber + ' due ' + formatDateShort(o.dueDate); }).join(' · '),
                    cta: '<button class="cp-btn cp-btn--ghost cp-btn--sm" type="button" data-tab="invoices" data-invfilter="open">View invoices</button>' });
            }
        }
        S.quotes.forEach(function (q) {
            var d = daysUntil(q.expires);
            if (q.status === 'Open' && d != null && d >= 0 && d <= 7) {
                items.push({ ico: 'quote', svg: 'file', title: 'Quote ' + q.quoteId + ' expires ' + (d === 0 ? 'today' : 'in ' + plural(d, 'day')),
                    sub: [q.projectName, money(q.total)].filter(Boolean).join(' · '),
                    cta: q.viewUrl ? '<a class="cp-btn cp-btn--ghost cp-btn--sm" href="' + escapeAttr(q.viewUrl) + '">View quote</a>' : '<button class="cp-btn cp-btn--ghost cp-btn--sm" type="button" data-tab="quotes">View quotes</button>' });
            }
        });
        if (list) {
            if (items.length) {
                list.innerHTML = items.map(function (it) {
                    return '<div class="cp-attn-item"><span class="cp-attn-ico cp-attn-ico--' + it.ico + '">' + icon(it.svg) + '</span>' +
                        '<div class="cp-attn-text"><div class="cp-attn-title">' + it.title + '</div>' + (it.sub ? '<div class="cp-attn-sub">' + it.sub + '</div>' : '') + '</div>' + it.cta + '</div>';
                }).join('');
                show(list, true); show(clear, false);
                attn.classList.remove('cp-attn--clear');
                setText('cp-attn-count', items.length); show(byId('cp-attn-count'), true);
            } else if (settled) {
                list.innerHTML = ''; show(list, false); show(clear, true);
                attn.classList.add('cp-attn--clear');
                show(byId('cp-attn-count'), false);
                if (S.ordersFailed || S.logosFailed) {
                    clear.querySelector('span:last-child').textContent = 'Nothing waiting that we can see — but one of your feeds didn\'t load, so refresh to be sure.';
                    attn.classList.remove('cp-attn--clear');
                }
            }
        }

        // KPI tiles
        var balEl = byId('cp-kpi-balance');
        if (balEl) {
            if (!S.ordersLoaded) { balEl.textContent = '—'; balEl.classList.remove('cp-kpi-val--due'); setText('cp-kpi-balance-sub', S.ordersFailed ? 'Unavailable — retry' : ''); }
            else {
                var inv2 = invoiceRows();
                var open = inv2.filter(function (o) { return (Number(o.balance) || 0) > 0.005; });
                var openSum = open.reduce(function (s, o) { return s + (Number(o.balance) || 0); }, 0);
                var pastN = open.filter(function (o) { return invoiceState(o) === 'pastdue'; }).length;
                balEl.textContent = open.length ? money(openSum) : '$0';
                balEl.classList.toggle('cp-kpi-val--due', pastN > 0);
                setText('cp-kpi-balance-sub', open.length ? plural(open.length, 'open invoice') + (pastN ? ' · ' + pastN + ' past due' : '') : 'Nothing owing');
            }
        }
        if (S.ordersLoaded) {
            var inProc = S.orders.filter(function (o) { return o.status === 'In Process'; });
            setText('cp-kpi-inprocess', inProc.length);
            setText('cp-kpi-inprocess-sub', inProc.length ? 'of ' + plural(S.orders.length, 'order') + ' on file' : plural(S.orders.length, 'order') + ' on file');
            setText('cp-ochip-inprocess', inProc.length || '');
        } else if (S.ordersFailed) { setText('cp-kpi-inprocess', '—'); setText('cp-kpi-inprocess-sub', 'Unavailable — retry'); }
        if (S.logosLoaded) {
            var a = S.logos.approved.length, m = S.logos.mockups.length, f = S.logos.finished.length;
            setText('cp-kpi-logos', a);
            setText('cp-kpi-logos-sub', [m ? plural(m, 'proof') : '', f ? plural(f, 'photo') : ''].filter(Boolean).join(' · ') || 'Approved artwork');
        } else if (S.logosFailed) { setText('cp-kpi-logos', '—'); setText('cp-kpi-logos-sub', 'Unavailable — retry'); }
        if (S.productsLoaded) {
            var colors = S.products.reduce(function (s, p) { return s + (Number(p.colorCount) || 0); }, 0);
            setText('cp-kpi-products', S.products.length);
            setText('cp-kpi-products-sub', S.products.length ? plural(colors, 'color') + ' · last 3 years' : 'Nothing yet');
        }

        // Recent orders
        var rec = byId('cp-recent-orders');
        if (rec && (S.ordersLoaded || S.ordersFailed)) {
            if (S.ordersFailed) rec.innerHTML = '<div class="cp-card-body cp-muted">Orders didn&rsquo;t load. <button type="button" class="cp-btn cp-btn--link cp-btn--xs" data-cp-retry="orders">Retry</button></div>';
            else if (!S.orders.length) rec.innerHTML = '<div class="cp-card-body cp-muted">No orders on file yet.</div>';
            else rec.innerHTML = S.orders.slice().sort(byDateDesc('orderDate')).slice(0, 5).map(function (o) {
                return '<button class="cp-recent-row" type="button" data-open-order="' + escapeAttr(String(o.orderNumber || '')) + '">' +
                    '<div class="cp-recent-main"><div class="cp-recent-title">#' + escapeHtml(String(o.orderNumber || '')) + (o.designName ? ' &middot; ' + escapeHtml(o.designName) : '') + '</div>' +
                    '<div class="cp-recent-sub">' + escapeHtml(formatDate(o.orderDate)) + (o.quantity ? ' &middot; ' + escapeHtml(String(o.quantity)) + ' pcs' : '') + '</div></div>' +
                    '<div class="cp-recent-right">' + renderStatusBadge(o.shipDate && o.status !== 'Invoiced' ? 'Shipped' : o.status) + '<span class="cp-recent-amt">' + money(o.total) + '</span>' + icon('chev') + '</div></button>';
            }).join('');
        }

        // Logo strip — approved first, then proofs
        var strip = byId('cp-ov-logos');
        if (strip && S.logosLoaded) {
            var all = S.logos.approved.concat(S.logos.mockups).slice(0, 10);
            if (all.length) {
                strip.innerHTML = all.map(function (l) {
                    return '<button class="cp-strip-item" type="button" data-logo-idx="' + escapeAttr(l.key) + '">' +
                        '<div class="cp-strip-img"><img src="' + escapeAttr(l.gridSrc) + '" alt="" loading="lazy"></div>' +
                        '<div class="cp-strip-cap">' + escapeHtml(l.name) + '<small>' + escapeHtml(l.design ? 'Design #' + l.design : (l.typeName || '')) + '</small></div></button>';
                }).join('');
                setText('cp-ov-logos-count', S.logos.approved.length + S.logos.mockups.length);
                show(byId('cp-ov-logos-section'), true);
            } else show(byId('cp-ov-logos-section'), false);
        }

        // Nav badges
        setBadge('logos', S.awaiting.length);
        var pastDueN = S.ordersLoaded ? invoiceRows().filter(function (o) { return invoiceState(o) === 'pastdue'; }).length : 0;
        setBadge('invoices', pastDueN);
        setBadge('quotes', S.quotes.filter(function (q) { return q.status === 'Open'; }).length);
    }
    function setBadge(tab, n) {
        ['cp-nav-badge-' + tab, 'cp-bnav-badge-' + tab].forEach(function (id) { var el = byId(id); if (!el) return; el.textContent = n; el.hidden = !(n > 0); });
    }

    // ══════════════════════════════════════════════════════════════════════
    // LOGOS & PROOFS
    // ══════════════════════════════════════════════════════════════════════
    // ShopWorks design-type codes → labels (same map as invoice.js / quote-view.js TYPE_NAMES).
    var LOGO_TYPE_NAMES = { 1: 'Screenprint', 2: 'Embroidery', 4: 'Sticker', 5: 'Emblem', 8: 'DTF Transfer', 45: 'DTG' };
    var _logoTypeByDesign = {};

    // Box + Caspio /api/files URLs are already proxy image endpoints on an allowed host — load
    // them DIRECTLY (grid; lightbox ?size=large). Non-proxy URLs go via the FE image-proxy.
    // /api/portal/proof-image/<token> is the CUSTOMER-side Box image route (the raw
    // /api/box/thumbnail/ one is staff-only and 401s here). It must be recognised as a proxy
    // image AND as size=large-capable, or it gets shoved through /api/image-proxy, which
    // cannot fetch it either.
    function logoSources(img) {
        var isBox = /\/api\/box\/thumbnail\/|\/api\/portal\/proof-image\//.test(img);
        var isProxyImg = isBox || /\/api\/files\//.test(img);
        var gridSrc = isProxyImg ? img : ('/api/image-proxy?url=' + encodeURIComponent(img));
        var largeRaw = isBox ? (img + (img.indexOf('?') === -1 ? '?' : '&') + 'size=large') : img;
        var largeSrc = isProxyImg ? largeRaw : ('/api/image-proxy?url=' + encodeURIComponent(largeRaw));
        return { gridSrc: gridSrc, largeSrc: largeSrc };
    }

    //  • "Approved logos"   = the ShopWorks thumbnail library (master logo art, full history).
    //  • "Proofs & mockups" = design proofs, chipped Graphic Art (Steve/art) or Embroidery (Ruth/mockup). 2026+.
    //  • "Finished photos"  = factory product shots a staffer approved for the customer.
    // Buckets dedup INDEPENDENTLY (a design can appear in both). The attention list + per-card
    // badges come from the proofs — the library is never awaiting.
    function renderMyLogos(mockups, artRequests, logoLibrary, finishedPhotos) {
        // Approved/Completed = the customer's FINAL artwork. Exact match — NOT a substring, or
        // "Awaiting Approval" would wrongly count as approved.
        var isApproved = function (s) { var t = String(s || '').trim().toLowerCase(); return t === 'approved' || t === 'completed' || t === 'complete'; };
        // "Awaiting Approval" = the ball is in the CUSTOMER's court. Deliberately NOT "Revision
        // Requested" — there the customer already acted and the art team is working.
        var isAwaiting = function (s) { return String(s || '').trim().toLowerCase().replace(/\s+/g, '-') === 'awaiting-approval'; };
        var cidQ = '?view=customer&cid=' + encodeURIComponent(S.custId || '');

        _logoTypeByDesign = {};
        (logoLibrary || []).forEach(function (d) {
            var nm = LOGO_TYPE_NAMES[Number(d.designType)];
            if (d.idDesign != null && nm) _logoTypeByDesign[String(d.idDesign)] = nm;
        });

        var proofItems = [];
        (mockups || []).forEach(function (m) {
            var img = m.Box_Mockup_1 || m.Box_Mockup_2 || m.Box_Mockup_3;
            if (!img) return;
            proofItems.push({
                design: String(m.Design_Number || ''),
                name: m.Design_Name || (m.Design_Number ? 'Design #' + m.Design_Number : 'Design'),
                meta: [m.Print_Location, m.Mockup_Type].filter(Boolean).join(' · '),
                img: img, date: m.Submitted_Date || '', kind: 'mockup', approved: isApproved(m.Status), awaiting: isAwaiting(m.Status),
                // The approval page is the existing customer view of the mockup (approve / request changes).
                approveUrl: m.ID ? ('/mockup/' + encodeURIComponent(m.ID) + cidQ) : ''
            });
        });
        (artRequests || []).forEach(function (a) {
            // ONLY a real design proof. MAIN_IMAGE_URL_1 is a plain SanMar stock photo — deliberately NOT used.
            var img = a.Final_Approved_Mockup || a.Box_File_Mockup || a.Box_File_Link;
            if (!img) return;
            proofItems.push({
                design: String(a.Design_Num_SW || ''),
                name: a.Design_Num_SW ? 'Design #' + a.Design_Num_SW : (a.GarmentStyle || 'Design'),
                meta: [a.GarmentStyle, a.GarmentColor].filter(Boolean).join(' · '),
                img: img, date: a.Date_Created || '', kind: 'art', approved: isApproved(a.Status), awaiting: isAwaiting(a.Status),
                approveUrl: a.ID_Design ? ('/art-request/' + encodeURIComponent(a.ID_Design) + cidQ) : ''
            });
        });
        var libraryItems = [];
        (logoLibrary || []).forEach(function (d) {
            if (!d.thumbnailUrl) return;
            libraryItems.push({
                design: String(d.idDesign || ''),
                name: d.designName || (d.idDesign ? 'Design #' + d.idDesign : 'Design'),
                meta: '', img: d.thumbnailUrl, date: d.dateCreated || '', kind: 'library', approved: false, awaiting: false, approveUrl: ''
            });
        });

        // Designs with ANY proof awaiting approval → attention list + per-card badge.
        var actionKeys = {};
        var awaiting = [];
        proofItems.forEach(function (it) {
            if (!it.awaiting) return;
            var k = it.design ? ('d:' + it.design) : ('u:' + it.img);
            if (actionKeys[k]) return;
            actionKeys[k] = true;
            awaiting.push({ name: it.name, design: it.design, date: it.date, approveUrl: it.approveUrl, kind: it.kind });
        });
        S.actionKeys = actionKeys; S.awaiting = awaiting;

        // Dedup within a bucket: one card per design #, preferring APPROVED > mockup > art > newest.
        var rank = function (it) { return (it.approved ? 100 : 0) + (it.kind === 'mockup' ? 10 : 0); };
        var dedup = function (items) {
            var byKey = {};
            items.forEach(function (it) {
                var key = it.design ? ('d:' + it.design) : ('u:' + it.img);
                var ex = byKey[key];
                if (!ex) { byKey[key] = it; return; }
                var better = rank(it) > rank(ex) || (rank(it) === rank(ex) && String(it.date) > String(ex.date));
                if (better) byKey[key] = it;
            });
            return Object.keys(byKey).map(function (k) { return byKey[k]; })
                .sort(function (a, b) { return String(b.date).localeCompare(String(a.date)); });
        };
        var finishedList = [];
        (finishedPhotos || []).forEach(function (p) {
            if (!p.imageUrl) return;
            finishedList.push({
                design: String(p.designNumber || ''),
                name: p.designName || (p.designNumber ? 'Design #' + p.designNumber : 'Finished photo'),
                meta: p.caption || '', img: p.imageUrl, date: p.uploadedDate || '', kind: 'finished', approved: false, awaiting: false, approveUrl: ''
            });
        });
        finishedList.sort(function (a, b) { return String(b.date).localeCompare(String(a.date)); });

        // Decorate every item once: sources, type name, stable key, bucket.
        var decorate = function (list, bucket) {
            return list.map(function (l, i) {
                var src = logoSources(l.img);
                l.gridSrc = src.gridSrc; l.largeSrc = src.largeSrc;
                l.typeName = _logoTypeByDesign[String(l.design)] || '';
                l.bucket = bucket; l.key = bucket + ':' + (l.design || i) + ':' + i;
                l.needs = !!actionKeys[l.design ? ('d:' + l.design) : ('u:' + l.img)];
                return l;
            });
        };
        S.logos.approved = decorate(dedup(libraryItems), 'approved');
        S.logos.mockups = decorate(dedup(proofItems), 'mockups');
        S.logos.finished = decorate(finishedList, 'finished');

        var total = S.logos.approved.length + S.logos.mockups.length + S.logos.finished.length;
        setText('cp-logos-count', total);
        setText('cp-approved-count', S.logos.approved.length);
        setText('cp-mockups-count', S.logos.mockups.length);
        setText('cp-finished-count', S.logos.finished.length);

        if (!total) {
            show(byId('cp-logos-subtabs'), false); show(byId('cp-logos-toolbar'), false);
            $$('#cp-panel-logos .cp-subpanel').forEach(function (p) { p.hidden = true; });
            show(byId('cp-logos-empty'), true);
            return;
        }
        show(byId('cp-logos-empty'), false);
        show(byId('cp-logos-subtabs'), true);
        show(byId('cp-logos-toolbar'), total > 6);
        renderLogoBuckets();
        // Land on the tab that needs attention; else the first non-empty bucket.
        switchLogoSubtab(awaiting.length ? 'mockups' : S.logos.approved.length ? 'approved' : S.logos.mockups.length ? 'mockups' : 'finished');
        populateGenDesignSelect();
    }
    function allLogoItems() { return S.logos.approved.concat(S.logos.mockups, S.logos.finished); }
    function logoMatches(l, q) { return !q || [l.name, l.design, l.meta, l.typeName].join(' ').toLowerCase().indexOf(q) !== -1; }

    function renderLogoBuckets() {
        var q = S.logoQuery;
        renderLogoBucket('cp-approved-grid', 'cp-approved-empty', S.logos.approved.filter(function (l) { return logoMatches(l, q); }), null);
        renderLogoBucket('cp-mockups-grid', 'cp-mockups-empty', S.logos.mockups.filter(function (l) { return logoMatches(l, q); }), function (it) { return it.kind === 'art' ? 'Graphic Art' : 'Embroidery'; });
        renderLogoBucket('cp-finished-grid', 'cp-finished-empty', S.logos.finished.filter(function (l) { return logoMatches(l, q); }), null);
    }
    function renderLogoBucket(gridId, emptyId, logos, typeLabelFn) {
        var grid = byId(gridId), empty = byId(emptyId);
        if (!grid) return;
        if (!logos.length) {
            grid.innerHTML = S.logoQuery ? '<div class="cp-table-noresults">No matches for &ldquo;' + escapeHtml(S.logoQuery) + '&rdquo;.</div>' : '';
            show(empty, !S.logoQuery); return;
        }
        show(empty, false);
        grid.innerHTML = logos.map(function (l) { return renderLogoCard(l, typeLabelFn ? typeLabelFn(l) : ''); }).join('');
    }
    function renderLogoCard(l, typeLabel) {
        // eager (not lazy): a small showcase — lazy left proofs blank until the customer scrolled.
        var img = '<img src="' + escapeAttr(l.gridSrc) + '" alt="" loading="eager" data-fallback="1">';
        var badge = l.needs
            ? '<div class="cp-action-badge">Needs approval</div>'
            : (l.approved ? '<div class="cp-logo-approved">&#10003; Approved</div>' : '');
        var designLabel = (l.design && l.name !== ('Design #' + l.design)) ? ('Design #' + l.design) : '';
        var line1 = [designLabel, l.meta].filter(Boolean).join(' · ');
        var metaAll = [line1, l.typeName].filter(Boolean).join(' · ');
        var approve = (l.needs && l.approveUrl)
            ? '<a class="cp-btn cp-btn--gold cp-btn--sm cp-tile-approve" href="' + escapeAttr(l.approveUrl) + '">' + icon('check') + 'Review &amp; approve</a>'
            : '';
        return '<div class="cp-tile cp-logo-card' + (l.needs ? ' cp-tile--action' : '') + '" role="button" tabindex="0"' +
            ' data-key="' + escapeAttr(l.key) + '" data-img="' + escapeAttr(l.largeSrc) + '" data-title="' + escapeAttr(l.name) + '" data-meta="' + escapeAttr(metaAll) + '"' +
            ' data-design="' + escapeAttr(l.design) + '" data-kind="' + escapeAttr(l.kind) + '" data-approve="' + escapeAttr(l.needs ? l.approveUrl : '') + '">' +
            '<div class="cp-tile-image' + (l.kind === 'finished' ? ' cp-tile-image--photo' : '') + '">' + img + badge + '</div>' +
            '<div class="cp-tile-body">' +
                '<div class="cp-tile-title">' + escapeHtml(l.name) + '</div>' +
                (line1 || l.typeName ? '<div class="cp-tile-sub">' + escapeHtml([line1, l.typeName].filter(Boolean).join(' · ')) + '</div>' : '') +
                (typeLabel ? '<div class="cp-tile-type">' + escapeHtml(typeLabel) + '</div>' : '') +
                approve +
                '<div class="cp-tile-foot"><span class="cp-tile-view">View</span><span class="cp-tile-date">' + escapeHtml(formatDate(l.date)) + '</span></div>' +
            '</div></div>';
    }
    // Broken thumbnails → placeholder (delegated; no inline onerror).
    document.addEventListener('error', function (e) {
        var im = e.target;
        if (!(im && im.tagName === 'IMG')) return;
        if (im.hasAttribute('data-fallback')) { im.parentElement.innerHTML = '<div class="cp-card-placeholder">&#127912;</div>'; return; }
        if (im.closest('.cp-product-img')) { im.parentElement.classList.add('cp-noimg'); im.remove(); return; }
        if (im.closest('.cp-req-image, .cp-swatch-sq, .cp-strip-img')) { im.remove(); return; }
        if (im.classList.contains('cp-swatch')) im.style.display = 'none';
    }, true);

    function switchLogoSubtab(name) {
        $$('#cp-panel-logos .cp-subpanel').forEach(function (p) { p.hidden = p.getAttribute('data-subpanel') !== name; });
        $$('#cp-panel-logos .cp-subtab').forEach(function (t) {
            var on = t.getAttribute('data-subtab') === name;
            t.classList.toggle('is-active', on); t.setAttribute('aria-selected', on ? 'true' : 'false');
        });
    }
    (function wireLogoSearch() {
        var s = byId('cp-logos-search');
        if (s) s.addEventListener('input', function () { S.logoQuery = s.value.trim().toLowerCase(); renderLogoBuckets(); });
    })();

    // ── Lightbox: view full-size, download, approve, order/change with this logo ──
    var _lbCurrent = null;
    function openLogoLightbox(card) {
        var lb = byId('cp-logo-lightbox');
        if (!lb) return;
        var img = card.getAttribute('data-img') || '';
        var title = card.getAttribute('data-title') || '';
        var design = card.getAttribute('data-design') || '';
        var approve = card.getAttribute('data-approve') || '';
        _lbCurrent = { design: design, name: title, kind: card.getAttribute('data-kind') || '' };
        byId('cp-lightbox-img').src = img;
        setText('cp-lightbox-title', title);
        setText('cp-lightbox-meta', card.getAttribute('data-meta') || '');
        var dl = byId('cp-lb-download');
        if (dl) { dl.setAttribute('href', img); dl.setAttribute('download', (design ? 'Design-' + design : title.replace(/[^a-z0-9]+/gi, '-') || 'design') + '.jpg'); }
        var ap = byId('cp-lb-approve');
        if (ap) { ap.setAttribute('href', approve || '#'); ap.hidden = !approve; }
        show(byId('cp-lb-order'), _lbCurrent.kind !== 'finished');
        show(byId('cp-lb-change'), _lbCurrent.kind !== 'finished');
        lb.hidden = false;
        try { byId('cp-lightbox-close').focus(); } catch (e) { }
    }
    function openLogoLightboxFromItem(btn) {
        var key = btn.getAttribute('data-logo-idx');
        var item = allLogoItems().filter(function (l) { return l.key === key; })[0];
        if (!item) return;
        var fake = document.createElement('div');
        fake.setAttribute('data-img', item.largeSrc); fake.setAttribute('data-title', item.name);
        fake.setAttribute('data-meta', [item.design ? 'Design #' + item.design : '', item.meta, item.typeName].filter(Boolean).join(' · '));
        fake.setAttribute('data-design', item.design); fake.setAttribute('data-kind', item.kind); fake.setAttribute('data-approve', item.needs ? item.approveUrl : '');
        openLogoLightbox(fake);
    }
    function closeLogoLightbox() {
        var lb = byId('cp-logo-lightbox');
        if (lb && !lb.hidden) { lb.hidden = true; var im = byId('cp-lightbox-img'); if (im) im.src = ''; }
    }
    (function wireLightbox() {
        var o = byId('cp-lb-order'); if (o) o.addEventListener('click', function () { var c = _lbCurrent || {}; closeLogoLightbox(); openGenModal('quote', { design: c.design, designName: c.name }); });
        var c = byId('cp-lb-change'); if (c) c.addEventListener('click', function () { var cur = _lbCurrent || {}; closeLogoLightbox(); openGenModal('logo-change', { design: cur.design, designName: cur.name }); });
    })();

    // ══════════════════════════════════════════════════════════════════════
    // ORDERS — filters, table, drawer
    // ══════════════════════════════════════════════════════════════════════
    var ROW_CAP = 10;
    function byDateDesc(field, alt) {
        return function (a, b) {
            var av = Date.parse(a[field] || (alt && a[alt]) || '') || 0;
            var bv = Date.parse(b[field] || (alt && b[alt]) || '') || 0;
            return bv - av;
        };
    }
    function moreControl(total, noun) {
        if (total <= ROW_CAP) return '';
        var more = 'Show all ' + total + ' ' + noun;
        return '<div class="cp-rows-morewrap"><button type="button" class="cp-rows-more" aria-expanded="false" data-expanded="0" data-more="' + escapeAttr(more) + '" data-less="Show fewer">' + escapeHtml(more) + '</button></div>';
    }
    function toggleRows(btn) {
        var wrap = btn.closest('.cp-table-wrap'); if (!wrap) return;
        var expanded = btn.getAttribute('data-expanded') === '1';
        wrap.querySelectorAll('.cp-row-extra').forEach(function (r) { r.style.display = expanded ? 'none' : 'table-row'; });
        btn.setAttribute('data-expanded', expanded ? '0' : '1');
        btn.setAttribute('aria-expanded', expanded ? 'false' : 'true');
        btn.textContent = expanded ? btn.getAttribute('data-more') : btn.getAttribute('data-less');
    }
    function setChips(groupId, value) {
        $$('#' + groupId + ' .cp-chip').forEach(function (c) { c.setAttribute('aria-pressed', c.getAttribute('data-filter') === value ? 'true' : 'false'); });
    }
    function setOrderFilter(v) { S.orderFilter = v || 'all'; setChips('cp-orders-filters', S.orderFilter); }
    function setInvoiceFilter(v) { S.invoiceFilter = v || 'all'; setChips('cp-invoices-filters', S.invoiceFilter); }
    function orderMatchesFilter(o) {
        switch (S.orderFilter) {
            case 'inprocess': return o.status === 'In Process';
            case 'shipped': return !!o.shipDate;
            case 'invoiced': return o.status === 'Invoiced';
            default: return true;
        }
    }

    function renderOrders() {
        var all = S.orders;
        setText('cp-orders-count', all.length);
        var wrap = byId('cp-orders-wrap'), empty = byId('cp-orders-empty'), toolbar = byId('cp-orders-toolbar');
        if (!all.length) { show(toolbar, false); wrap.innerHTML = ''; show(empty, true); return; }
        show(empty, false);
        show(toolbar, all.length > 3);
        var searchEl = byId('cp-orders-search');
        var q = ((searchEl && searchEl.value) || '').trim().toLowerCase();
        var list = all.slice().sort(byDateDesc('orderDate')).filter(orderMatchesFilter);
        if (q) list = list.filter(function (o) { return [o.designName, o.orderNumber, o.poNumber].map(function (x) { return x == null ? '' : String(x); }).join(' ').toLowerCase().indexOf(q) !== -1; });
        if (!list.length) { wrap.innerHTML = '<div class="cp-table-noresults">No orders match' + (q ? ' &ldquo;' + escapeHtml(q) + '&rdquo;' : ' that filter') + '.</div>'; return; }
        var capped = !q && S.orderFilter === 'all';
        var rows = list.map(function (o, i) {
            var shipPill = o.shipDate ? ' <span class="cp-status cp-status--shipped">Shipped ' + escapeHtml(formatDateShort(o.shipDate)) + '</span>' : '';
            return '<tr class="is-clickable' + (capped && i >= ROW_CAP ? ' cp-row-extra' : '') + '" data-open-order="' + escapeAttr(String(o.orderNumber || '')) + '">' +
                '<td><span class="cp-link">#' + escapeHtml(String(o.orderNumber || '')) + '</span></td>' +
                '<td>' + escapeHtml(formatDate(o.orderDate)) + '</td>' +
                '<td>' + escapeHtml(o.designName || '—') + (o.poNumber ? '<span class="cp-cell-sub">PO ' + escapeHtml(o.poNumber) + '</span>' : '') + '</td>' +
                '<td class="cp-num">' + escapeHtml(String(o.quantity || '')) + '</td>' +
                '<td class="cp-num cp-strong">' + money(o.total) + '</td>' +
                '<td>' + renderStatusBadge(o.status) + shipPill + '</td>' +
                '<td class="cp-cell-actions"><button type="button" class="cp-btn cp-btn--ghost cp-btn--xs" data-open-order="' + escapeAttr(String(o.orderNumber || '')) + '">Details</button>' +
                    '<button type="button" class="cp-btn cp-btn--soft cp-btn--xs cp-row-reorder" data-order="' + escapeAttr(String(o.orderNumber || '')) + '" data-design="' + escapeAttr(o.designName || '') + '">Re-order</button></td>' +
                '</tr>';
        }).join('');
        wrap.innerHTML = '<table class="cp-table"><thead><tr>' +
            '<th>Order</th><th>Date</th><th>Design</th><th class="cp-num">Qty</th><th class="cp-num">Total</th><th>Status</th><th aria-label="Actions"></th>' +
            '</tr></thead><tbody>' + rows + '</tbody></table>' + (capped ? moreControl(list.length, 'orders') : '');
    }
    (function wireOrderSearch() { var s = byId('cp-orders-search'); if (s) s.addEventListener('input', renderOrders); })();

    // ── Order drawer: header + timeline + meta, then line items + tracking (lazy, parallel) ──
    var _drawerOrder = null, _drawerInvoice = null, _drawerSeq = 0;
    function timelineHtml(o) {
        var shipped = !!o.shipDate, invoiced = !!o.invoiceDate;
        var steps = [
            { label: 'Ordered', date: o.orderDate, done: true },
            { label: 'In production', date: '', done: shipped || invoiced },
            { label: shipped ? 'Shipped' : 'Shipped / pickup', date: o.shipDate, done: shipped || invoiced },
            { label: 'Invoiced', date: o.invoiceDate, done: invoiced },
        ];
        var currentSet = false;
        return steps.map(function (s) {
            var cls = s.done ? 'is-done' : (!currentSet ? 'is-current' : '');
            if (!s.done && !currentSet) currentSet = true;
            return '<div class="cp-tl-step ' + cls + '">' + escapeHtml(s.label) + '<span class="cp-tl-date">' + escapeHtml(s.date ? formatDateShort(s.date) : (cls === 'is-current' ? 'now' : '')) + '</span></div>';
        }).join('');
    }
    function openOrderDrawer(orderNo) {
        var o = S.orders.filter(function (x) { return String(x.orderNumber) === String(orderNo); })[0];
        if (!o) return;
        _drawerOrder = o; _drawerInvoice = null;
        var seq = ++_drawerSeq;
        setText('cp-drawer-title', 'Order #' + o.orderNumber);
        byId('cp-drawer-status').innerHTML = renderStatusBadge(o.status);
        byId('cp-drawer-timeline').innerHTML = timelineHtml(o);
        var bal = Number(o.balance) || 0;
        byId('cp-drawer-meta').innerHTML =
            '<div><div class="k">Ordered</div><div class="v">' + escapeHtml(formatDate(o.orderDate) || '—') + '</div></div>' +
            '<div><div class="k">Design</div><div class="v" title="' + escapeAttr(o.designName || '') + '">' + escapeHtml(o.designName || '—') + '</div></div>' +
            '<div><div class="k">PO</div><div class="v">' + escapeHtml(o.poNumber || '—') + '</div></div>' +
            '<div><div class="k">Pieces</div><div class="v">' + escapeHtml(String(o.quantity || '—')) + '</div></div>' +
            '<div><div class="k">Total</div><div class="v">' + money(o.total) + '</div></div>' +
            '<div><div class="k">Balance</div><div class="v' + (bal > 0.005 ? ' v--due' : '') + '">' + (o.total ? money(bal) : '—') + (o.dueDate && bal > 0.005 ? '<span class="cp-cell-sub">due ' + escapeHtml(formatDateShort(o.dueDate)) + '</span>' : '') + '</div></div>';
        byId('cp-drawer-items').innerHTML = '<div class="cp-card-body cp-skel-rows"><div class="cp-skel cp-skel-line"></div><div class="cp-skel cp-skel-line"></div></div>';
        byId('cp-drawer-tracking').innerHTML = '<div class="cp-skel cp-skel-line"></div>';
        var link = byId('cp-drawer-invoice-link'); if (link) link.setAttribute('href', INVOICE_BASE + encodeURIComponent(o.orderNumber));
        var rb = byId('cp-drawer-reorder'); if (rb) { rb.disabled = true; rb.textContent = 'Loading…'; }
        var dr = byId('cp-drawer'); dr.hidden = false;
        try { byId('cp-drawer-panel').focus({ preventScroll: true }); } catch (e) { }

        fetch(INVOICE_API_BASE + encodeURIComponent(o.orderNumber), { credentials: 'same-origin' })
            .then(function (r) { if (r.status === 401) throw new Error('signedOut'); if (!r.ok) throw new Error('invoice ' + r.status); return r.json(); })
            .then(function (inv) {
                if (seq !== _drawerSeq) return;
                _drawerInvoice = inv;
                renderDrawerItems(inv);
                if (rb) { rb.disabled = false; rb.innerHTML = icon('refresh') + 'Re-order this'; }
            })
            .catch(function (err) {
                if (seq !== _drawerSeq) return;
                console.error('Portal invoice load failed:', err);
                byId('cp-drawer-items').innerHTML = '<div class="cp-card-body cp-muted">' + (err && err.message === 'signedOut' ? 'Your session expired — sign in again to see the items.' : 'Items didn&rsquo;t load. Open the invoice instead, or try again.') + '</div>';
                if (rb) { rb.disabled = true; rb.textContent = 'Re-order unavailable'; }
            });
        fetch(TRACKING_URL(o.orderNumber), { credentials: 'same-origin' })
            .then(function (r) { if (!r.ok) throw new Error('tracking ' + r.status); return r.json(); })
            .then(function (d) { if (seq === _drawerSeq) renderDrawerTracking(o, (d && d.tracking) || []); })
            .catch(function () { if (seq === _drawerSeq) byId('cp-drawer-tracking').innerHTML = '<div class="cp-muted">Tracking isn&rsquo;t available right now.' + (o.shipDate ? ' Shipped ' + escapeHtml(formatDate(o.shipDate)) + '.' : '') + '</div>'; });
    }
    var SIZE_LABELS = ['S', 'M', 'L', 'XL', '2XL', '3XL'];
    function renderDrawerItems(inv) {
        var items = (inv && inv.items) || [];
        if (!items.length) { byId('cp-drawer-items').innerHTML = '<div class="cp-card-body cp-muted">No line items on this order.</div>'; return; }
        var html = items.map(function (it) {
            var sz = [];
            // Size breakdown only means something on a garment line (fees/decoration carry the qty in Size01).
            if (it.color) (it.sizes || []).forEach(function (v, i) { var n = Number(v) || 0; if (n > 0) sz.push(SIZE_LABELS[i] + ' ' + n); });
            return '<div class="cp-item"><div class="cp-item-name">' + escapeHtml(it.description || it.partNumber || 'Item') + '</div>' +
                '<div class="cp-item-qty">' + escapeHtml(String(it.quantity || '')) + (it.quantity ? ' pcs' : '') + '</div>' +
                '<div class="cp-item-sub">' + escapeHtml([it.partNumber, it.color, sz.join(' · ')].filter(Boolean).join(' · ')) + '</div></div>';
        }).join('');
        html += '<div class="cp-item-total"><span>Total' + (inv.totalQuantity ? ' · ' + escapeHtml(String(inv.totalQuantity)) + ' pcs' : '') + '</span><span>' + money(inv.total) + '</span></div>';
        byId('cp-drawer-items').innerHTML = html;
    }
    function trackingLink(carrier, num) {
        var c = String(carrier || '').toLowerCase(), n = String(num || '').replace(/\s+/g, '');
        if (!n) return '';
        if (/ups/.test(c) || /^1Z/i.test(n)) return 'https://www.ups.com/track?tracknum=' + encodeURIComponent(n);
        if (/fedex/.test(c) || /^(\d{12}|\d{15}|\d{20})$/.test(n)) return 'https://www.fedex.com/fedextrack/?trknbr=' + encodeURIComponent(n);
        if (/usps|postal/.test(c) || /^(9[2-5]\d{20,24}|[A-Z]{2}\d{9}US)$/i.test(n)) return 'https://tools.usps.com/go/TrackConfirmAction?tLabels=' + encodeURIComponent(n);
        if (/dhl/.test(c)) return 'https://www.dhl.com/us-en/home/tracking.html?tracking-id=' + encodeURIComponent(n);
        return '';
    }
    function renderDrawerTracking(o, rows) {
        var box = byId('cp-drawer-tracking');
        if (!rows.length) {
            box.innerHTML = '<div class="cp-muted">' + (o.shipDate
                ? 'Shipped ' + escapeHtml(formatDate(o.shipDate)) + ' &mdash; no carrier tracking on file (local delivery or pickup).'
                : (o.status === 'Invoiced' ? 'No tracking on file &mdash; this order was picked up or delivered locally.' : 'Not shipped yet. Tracking appears here the moment it leaves our shop.')) + '</div>';
            return;
        }
        box.innerHTML = rows.map(function (t, i) {
            var url = trackingLink(t.carrier, t.trackingNumber);
            var num = url ? '<a href="' + escapeAttr(url) + '" target="_blank" rel="noopener">' + escapeHtml(t.trackingNumber) + '</a>' : '<strong>' + escapeHtml(t.trackingNumber) + '</strong>';
            return '<div class="cp-track-row">' + icon('truck') + '<span>' + escapeHtml(t.carrier || 'Carrier') + (rows.length > 1 ? ' · box ' + (t.boxNumber != null ? escapeHtml(String(t.boxNumber)) : (i + 1)) : '') + '</span>' + num + (t.shipDate ? '<small>' + escapeHtml(formatDateShort(t.shipDate)) + '</small>' : '') + '</div>';
        }).join('');
    }
    function closeOrderDrawer() { var d = byId('cp-drawer'); if (d && !d.hidden) { d.hidden = true; _drawerSeq++; } }
    (function wireDrawer() {
        var d = byId('cp-drawer'); if (d) d.addEventListener('click', function (e) { if (e.target === d) closeOrderDrawer(); });
        var c = byId('cp-drawer-close'); if (c) c.addEventListener('click', closeOrderDrawer);
        var rb = byId('cp-drawer-reorder');
        if (rb) rb.addEventListener('click', function () {
            if (!_drawerOrder || !_drawerInvoice) return;
            var ok = reorderFromInvoice(_drawerInvoice, String(_drawerOrder.orderNumber), _drawerOrder.designName || '');
            if (ok) closeOrderDrawer();
        });
    })();

    // ══════════════════════════════════════════════════════════════════════
    // INVOICES — summary, filters, table, printable statement
    // ══════════════════════════════════════════════════════════════════════
    function renderInvoices() {
        var inv = invoiceRows();
        setText('cp-invoices-count', inv.length);
        var wrap = byId('cp-invoices-wrap'), empty = byId('cp-invoices-empty');
        if (!inv.length) { wrap.innerHTML = ''; show(empty, true); show(byId('cp-inv-summary'), false); show(byId('cp-invoices-toolbar'), false); show(byId('cp-statement-btn'), false); return; }
        show(empty, false);
        var open = inv.filter(function (o) { return invoiceState(o) !== 'paid'; });
        var past = inv.filter(function (o) { return invoiceState(o) === 'pastdue'; });
        var openSum = open.reduce(function (s, o) { return s + (Number(o.balance) || 0); }, 0);
        var pastSum = past.reduce(function (s, o) { return s + (Number(o.balance) || 0); }, 0);
        var yearAgo = new Date(); yearAgo.setFullYear(yearAgo.getFullYear() - 1);
        var paid12 = inv.filter(function (o) { var d = parseDay(o.invoiceDate || o.orderDate); return d && d >= yearAgo; });
        var paid12Sum = paid12.reduce(function (s, o) { return s + (Number(o.paid) || 0); }, 0);
        setText('cp-inv-open', open.length ? money(openSum) : '$0.00'); setText('cp-inv-open-sub', open.length ? plural(open.length, 'open invoice') : 'Nothing owing');
        var pd = byId('cp-inv-pastdue'); if (pd) { pd.textContent = past.length ? money(pastSum) : '$0.00'; pd.classList.toggle('cp-summary-val--due', past.length > 0); }
        setText('cp-inv-pastdue-sub', past.length ? plural(past.length, 'invoice') + ' past due' : 'All current');
        setText('cp-inv-paid12', money(paid12Sum)); setText('cp-inv-paid12-sub', plural(paid12.length, 'invoice'));
        setText('cp-ichip-open', open.length || ''); setText('cp-ichip-pastdue', past.length || '');
        show(byId('cp-inv-summary'), true);
        show(byId('cp-invoices-toolbar'), inv.length > 3);
        show(byId('cp-statement-btn'), open.length > 0);

        var list = inv.slice().sort(byDateDesc('invoiceDate', 'orderDate')).filter(function (o) {
            var st = invoiceState(o);
            switch (S.invoiceFilter) {
                case 'open': return st !== 'paid';
                case 'pastdue': return st === 'pastdue';
                case 'paid': return st === 'paid';
                default: return true;
            }
        });
        if (!list.length) { wrap.innerHTML = '<div class="cp-table-noresults">No invoices match that filter.</div>'; return; }
        var capped = S.invoiceFilter === 'all';
        var rows = list.map(function (o, i) {
            var href = INVOICE_BASE + encodeURIComponent(o.orderNumber);
            return '<tr' + (capped && i >= ROW_CAP ? ' class="cp-row-extra"' : '') + '>' +
                '<td><a class="cp-link" href="' + escapeAttr(href) + '">#' + escapeHtml(String(o.orderNumber || '')) + '</a>' + (o.designName ? '<span class="cp-cell-sub">' + escapeHtml(o.designName) + '</span>' : '') + '</td>' +
                '<td>' + (escapeHtml(formatDate(o.invoiceDate)) || '—') + '</td>' +
                '<td>' + (escapeHtml(formatDate(o.dueDate)) || '—') + dueWarnBadge(o) + '</td>' +
                '<td class="cp-num">' + money(o.total) + '</td>' +
                '<td class="cp-num">' + money(o.paid) + '</td>' +
                '<td class="cp-num cp-strong">' + money(o.balance) + '</td>' +
                '<td>' + renderStatusBadge(o.paidStatus) + '</td>' +
                '<td class="cp-cell-actions"><a class="cp-btn cp-btn--ghost cp-btn--xs" href="' + escapeAttr(href) + '">' + icon('download') + 'PDF</a></td>' +
                '</tr>';
        }).join('');
        wrap.innerHTML = '<table class="cp-table"><thead><tr>' +
            '<th>Invoice</th><th>Invoiced</th><th>Due</th><th class="cp-num">Total</th><th class="cp-num">Paid</th><th class="cp-num">Balance</th><th>Status</th><th aria-label="Actions"></th>' +
            '</tr></thead><tbody>' + rows + '</tbody></table>' + (capped ? moreControl(list.length, 'invoices') : '');
    }
    // Warn badge next to the Due date — only for invoices that still OWE money.
    function dueWarnBadge(o) {
        if (!o || !o.dueDate || !(Number(o.balance) > 0)) return '';
        var days = daysUntil(o.dueDate);
        if (days == null) return '';
        if (days < 0) return ' <span class="cp-due-badge cp-due-badge--past">Past due</span>';
        if (days <= 7) return ' <span class="cp-due-badge">Due soon</span>';
        return '';
    }

    // ── Statement: every open invoice, aged, printable ──
    function openStatement() {
        if (!S.ordersLoaded) { showToast(S.ordersFailed ? 'Your invoices didn\'t load — retry from the Invoices tab.' : 'Still loading your invoices — one moment.'); return; }
        var open = invoiceRows().filter(function (o) { return (Number(o.balance) || 0) > 0.005; })
            .sort(function (a, b) { return String(a.dueDate || a.invoiceDate || '').localeCompare(String(b.dueDate || b.invoiceDate || '')); });
        var buckets = { current: 0, d30: 0, d60: 0, d90: 0, d90p: 0 };
        var rows = open.map(function (o) {
            var days = daysUntil(o.dueDate); var over = days == null ? 0 : -days; var bal = Number(o.balance) || 0;
            var age = over <= 0 ? 'Current' : over <= 30 ? '1–30 days' : over <= 60 ? '31–60 days' : over <= 90 ? '61–90 days' : '90+ days';
            if (over <= 0) buckets.current += bal; else if (over <= 30) buckets.d30 += bal; else if (over <= 60) buckets.d60 += bal; else if (over <= 90) buckets.d90 += bal; else buckets.d90p += bal;
            return '<tr><td>#' + escapeHtml(String(o.orderNumber)) + '</td><td>' + escapeHtml(o.designName || '') + (o.poNumber ? ' <span class="cp-muted">(PO ' + escapeHtml(o.poNumber) + ')</span>' : '') + '</td><td>' + escapeHtml(formatDate(o.invoiceDate) || '—') + '</td><td>' + escapeHtml(formatDate(o.dueDate) || '—') + '</td><td>' + escapeHtml(age) + '</td><td class="num">' + money(o.total) + '</td><td class="num">' + money(o.paid) + '</td><td class="num">' + money(bal) + '</td></tr>';
        }).join('');
        var total = open.reduce(function (s, o) { return s + (Number(o.balance) || 0); }, 0);
        var body = byId('cp-statement-body');
        body.innerHTML =
            '<div class="cp-stmt-head"><div><img src="/images/nwca-logo.png" alt="Northwest Custom Apparel"><div class="cp-muted" style="font-size:11.5px;margin-top:4px">2025 Freeman Rd E, Milton, WA 98354 &middot; (253) 922-5793 &middot; accounting@nwcustomapparel.com</div></div>' +
            '<div><div class="cp-stmt-title">Statement of account</div><div class="cp-stmt-meta"><strong>' + escapeHtml(S.companyName || 'Your account') + '</strong>' + (S.custId ? ' &middot; Customer #' + escapeHtml(S.custId) : '') + '<br>As of ' + escapeHtml(new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })) + '</div></div></div>' +
            (open.length
                ? '<div class="cp-stmt-scroll"><table><thead><tr><th>Invoice</th><th>Description</th><th>Invoiced</th><th>Due</th><th>Aging</th><th class="num">Total</th><th class="num">Paid</th><th class="num">Balance</th></tr></thead><tbody>' + rows + '</tbody>' +
                  '<tfoot><tr><td colspan="7">Total balance due</td><td class="num">' + money(total) + '</td></tr></tfoot></table></div>' +
                  '<div class="cp-stmt-aging">' +
                    '<div><div class="k">Current</div><div class="v">' + money(buckets.current) + '</div></div>' +
                    '<div><div class="k">1–30 days</div><div class="v' + (buckets.d30 ? ' v--due' : '') + '">' + money(buckets.d30) + '</div></div>' +
                    '<div><div class="k">31–60 days</div><div class="v' + (buckets.d60 ? ' v--due' : '') + '">' + money(buckets.d60) + '</div></div>' +
                    '<div><div class="k">61–90 days</div><div class="v' + (buckets.d90 ? ' v--due' : '') + '">' + money(buckets.d90) + '</div></div>' +
                    '<div><div class="k">90+ days</div><div class="v' + (buckets.d90p ? ' v--due' : '') + '">' + money(buckets.d90p) + '</div></div>' +
                  '</div>'
                : '<div class="cp-empty" style="margin-top:8px"><div class="cp-empty-icon">&#10003;</div>No open balance &mdash; every invoice on file is paid. Thank you!</div>') +
            '<div class="cp-stmt-foot">Balances reflect payments posted in our system as of the date above. To pay or ask about terms, contact accounting@nwcustomapparel.com or call (253) 922-5793.</div>';
        byId('cp-statement-modal').hidden = false;
        try { byId('cp-statement-print').focus(); } catch (e) { }
    }
    function closeStatement() { var m = byId('cp-statement-modal'); if (m) m.hidden = true; }
    (function wireStatement() {
        var m = byId('cp-statement-modal'); if (m) m.addEventListener('click', function (e) { if (e.target === m) closeStatement(); });
        var c = byId('cp-statement-close'); if (c) c.addEventListener('click', closeStatement);
        var p = byId('cp-statement-print'); if (p) p.addEventListener('click', function () { window.print(); });
    })();

    // ══════════════════════════════════════════════════════════════════════
    // PRODUCTS + RECOMMENDATIONS
    // ══════════════════════════════════════════════════════════════════════
    var _productSort = 'ordered';
    var _productLimit = 12;

    function productCardHtml(p, kind) {
        var title = p.title || p.description || p.style;
        var productHref = (kind === 'product' && p.style) ? (PRODUCT_URL_BASE + encodeURIComponent(p.style)) : '';
        var comingSoon = kind === 'rec' && p.comingSoon;
        var img = p.image
            ? '<img src="' + escapeAttr(p.image) + '" alt="" loading="lazy">'
            : (comingSoon ? '<div class="cp-coming-soon">Coming soon</div>' : '');
        var colors = (kind === 'product' && p.colors) ? p.colors : [];
        var sub = (colors.length > 1)
            ? (colors.length + ' colors ordered' + (p.designNumber ? ' · Design #' + p.designNumber : ''))
            : [p.color, (p.designNumber ? 'Design #' + p.designNumber : '')].filter(Boolean).join(' · ');
        var swatches = (colors.length > 1)
            ? ('<div class="cp-swatches">' + colors.slice(0, 8).map(function (c) {
                return c.swatch
                    ? '<img class="cp-swatch" src="' + escapeAttr(c.swatch) + '" alt="' + escapeAttr(c.name) + '" title="' + escapeAttr(c.name) + '" loading="lazy">'
                    : '<span class="cp-swatch cp-swatch--noimg" title="' + escapeAttr(c.name) + '"></span>';
            }).join('') + (colors.length > 8 ? '<span class="cp-swatch-more">+' + (colors.length - 8) + '</span>' : '') + '</div>')
            : '';
        var meta = (kind === 'product' && p.lastOrdered) ? 'Last ordered ' + formatDate(p.lastOrdered) : (p.blurb || '');
        var btnLabel = kind === 'product' ? 'Re-order' : 'Ask for a quote';
        var totalLine = (kind === 'product' && Number(p.styleTotalQty) > 0)
            ? '<div class="cp-product-total">You&rsquo;ve ordered ' + Number(p.styleTotalQty).toLocaleString() + '</div>' : '';
        var orderedColorsJson = JSON.stringify((kind === 'product' && p.colors ? p.colors : []).map(function (c) { return { name: c.name, cat: c.catalogColor || '', qty: Number(c.totalQty) || 0 }; }));
        var reward = (kind === 'rec' && p.rewardText)
            ? '<div class="cp-rec-reward"><span class="cp-rec-reward-star">&#9733;</span> ' + escapeHtml(p.rewardText) + '</div>' : '';
        var sizesJson = JSON.stringify(p.sizes || {});
        return '<div class="cp-product-card' + (comingSoon ? ' cp-product-card--soon' : '') + '">' +
            '<div class="cp-product-img">' + (productHref ? '<a class="cp-product-imglink" href="' + escapeAttr(productHref) + '">' + img + '</a>' : img) + '</div>' +
            '<div class="cp-product-body">' +
                '<div class="cp-product-title">' + (productHref ? '<a class="cp-product-titlelink" href="' + escapeAttr(productHref) + '">' + escapeHtml(title) + '</a>' : escapeHtml(title)) + '</div>' +
                (sub ? '<div class="cp-product-sub">' + escapeHtml(sub) + '</div>' : '') +
                swatches + totalLine +
                (meta ? '<div class="cp-product-meta">' + escapeHtml(meta) + '</div>' : '') +
                reward +
                ((kind === 'product' && productHref)
                    // Your Products re-order → the method-aware product PAGE (decoration picker + API minimum live there).
                    ? '<a class="cp-product-btn" href="' + escapeAttr(productHref) + '">' + btnLabel + '</a>'
                    // Recommendations → the quick "ask for a quote" modal (exploratory; no method needed).
                    : '<button class="cp-product-btn" type="button" data-kind="' + escapeAttr(kind) + '"' +
                        ' data-style="' + escapeAttr(p.style) + '" data-color="' + escapeAttr(p.color || '') + '" data-image="' + escapeAttr(p.image || '') + '"' +
                        ' data-title="' + escapeAttr(title) + '" data-design="' + escapeAttr(String(p.designNumber || '')) + '" data-designname="' + escapeAttr(p.designName || '') + '"' +
                        " data-colors='" + escapeAttr(orderedColorsJson) + "' data-sizes='" + escapeAttr(sizesJson) + "'>" + btnLabel + '</button>') +
            '</div></div>';
    }
    function renderProducts() {
        var grid = byId('cp-products-grid');
        if (!grid) return;
        var searchEl = byId('cp-products-search');
        var q = ((searchEl && searchEl.value) || '').trim().toLowerCase();
        var list = S.products.slice();
        if (q) list = list.filter(function (p) {
            return [p.title, p.description, p.style, p.designNumber, p.designName].concat((p.colors || []).map(function (c) { return c.name; })).join(' ').toLowerCase().indexOf(q) !== -1;
        });
        list.sort(function (a, b) {
            if (_productSort === 'recent') return String(b.lastOrdered || '').localeCompare(String(a.lastOrdered || ''));
            if (_productSort === 'colors') return (Number(b.colorCount) || 0) - (Number(a.colorCount) || 0);
            return (Number(b.styleTotalQty) || 0) - (Number(a.styleTotalQty) || 0);
        });
        var total = list.length;
        var shown = q ? list : list.slice(0, _productLimit);
        setText('cp-products-count', total);
        grid.innerHTML = shown.length ? shown.map(function (p) { return productCardHtml(p, 'product'); }).join('') : '<div class="cp-table-noresults">No products match &ldquo;' + escapeHtml(q) + '&rdquo;.</div>';
        var moreWrap = byId('cp-products-more'), moreBtn = byId('cp-products-more-btn');
        if (!q && total > _productLimit) { show(moreWrap, true); if (moreBtn) moreBtn.textContent = 'Show all ' + total; } else show(moreWrap, false);
    }
    (function wireProductControls() {
        var search = byId('cp-products-search'), sort = byId('cp-products-sort'), moreBtn = byId('cp-products-more-btn');
        if (search) search.addEventListener('input', renderProducts);
        if (sort) sort.addEventListener('change', function () { _productSort = sort.value; renderProducts(); });
        if (moreBtn) moreBtn.addEventListener('click', function () { _productLimit = 9999; renderProducts(); });
    })();

    // ══════════════════════════════════════════════════════════════════════
    // RE-ORDER REQUEST MODAL (recommendations + past orders) — ported intact
    // ══════════════════════════════════════════════════════════════════════
    var reqState = null;
    var SIZE_ORDER = ['S', 'M', 'L', 'XL', '2XL', '3XL'];

    function openReqModal(btn) {
        var parsedSizes = {}, parsedColors = [];
        try { parsedSizes = JSON.parse(btn.getAttribute('data-sizes') || '{}') || {}; } catch (e) { parsedSizes = {}; }
        try { parsedColors = JSON.parse(btn.getAttribute('data-colors') || '[]') || []; } catch (e) { parsedColors = []; }
        openReqModalState({
            kind: btn.getAttribute('data-kind'), style: btn.getAttribute('data-style'), color: btn.getAttribute('data-color'),
            image: btn.getAttribute('data-image') || '', title: btn.getAttribute('data-title'), design: btn.getAttribute('data-design'),
            designName: btn.getAttribute('data-designname'), sizes: parsedSizes, orderedColors: parsedColors
        }, '');
    }
    function openReqModalState(state, note) {
        reqState = state;
        setText('cp-req-title', reqState.kind === 'product' ? 'Re-order this product' : 'Ask for a quote');
        byId('cp-req-product').innerHTML =
            '<div class="cp-req-prod-title">' + escapeHtml(reqState.title) + '</div>' +
            '<div class="cp-req-prod-sub">' + escapeHtml('Style ' + (reqState.style || '') + (reqState.design ? ' · Design #' + reqState.design : '')) + '</div>';
        setReqImage(reqState.image);
        buildSizeGrid(reqState.sizes);
        byId('cp-req-color').value = reqState.color || '';
        renderColorPicker(reqState.style, reqState.color, reqState.image);
        byId('cp-req-note').value = note || '';
        setText('cp-req-error', '');
        byId('cp-req-modal').hidden = false;
    }
    function closeReqModal() { var m = byId('cp-req-modal'); if (m) m.hidden = true; }

    // Quick re-order from an Orders row: pull THAT order's invoice line items (ownership-checked
    // endpoint), derive garment style/color/sizes, open the request modal pre-filled.
    function reorderFromOrder(btn) {
        var orderNo = btn.getAttribute('data-order') || '';
        var rowDesign = btn.getAttribute('data-design') || '';
        if (!orderNo) return;
        var orig = btn.textContent;
        btn.disabled = true; btn.textContent = 'Loading…';
        fetch(INVOICE_API_BASE + encodeURIComponent(orderNo), { credentials: 'same-origin' })
            .then(function (r) { if (r.status === 401) throw new Error('signedOut'); if (!r.ok) throw new Error('invoice ' + r.status); return r.json(); })
            .then(function (inv) {
                btn.disabled = false; btn.textContent = orig;
                var ok = reorderFromInvoice(inv, orderNo, rowDesign);
                if (!ok) { btn.disabled = true; btn.textContent = 'Service-only order'; }
            })
            .catch(function (err) {
                console.error('Portal re-order load failed:', err);
                btn.disabled = false; btn.textContent = orig;
                showToast(err && err.message === 'signedOut' ? 'Your session expired &mdash; please sign in again to re-order.' : "We couldn't load that order right now. Please try again or call " + PHONE_TXT + '.');
            });
    }
    // Shared by the table button and the drawer. Returns false for a service-only order.
    function reorderFromInvoice(inv, orderNo, rowDesign) {
        var items = (inv && inv.items) || [];
        var feeRe = /^(SETUP|LTM|FEE|TAX|SHIP|DISC|RUSH|ART|GRT|MOCK|DIGI)/i;
        var garment = null;
        for (var i = 0; i < items.length; i++) { var it = items[i]; if (it && it.partNumber && it.color && !feeRe.test(String(it.partNumber))) { garment = it; break; } }
        if (!garment) {
            showToast('Order #' + escapeHtml(orderNo) + ' has no garments to re-order &mdash; use Your Products or call ' + PHONE_TXT + '.');
            return false;
        }
        var style = String(garment.partNumber).split('_')[0];   // ST254_2X → ST254 (size-suffix SKUs)
        var color = garment.color || '';
        var sizes = {}, totalQty = 0;
        items.forEach(function (it) {
            if (!it || !it.partNumber || feeRe.test(String(it.partNumber))) return;
            if (String(it.partNumber).split('_')[0] !== style || (it.color || '') !== color) return;
            (it.sizes || []).forEach(function (v, idx) { var n = Number(v) || 0; if (n > 0 && SIZE_ORDER[idx]) sizes[SIZE_ORDER[idx]] = (sizes[SIZE_ORDER[idx]] || 0) + n; });
            totalQty += Number(it.quantity) || 0;
        });
        var designName = (inv && inv.designName) || rowDesign || '';
        openReqModalState({
            kind: 'product', style: style, color: color, image: '', title: garment.description || style,
            design: String((inv && inv.designId) || ''), designName: designName, sizes: sizes,
            // PartColor is a ShopWorks CATALOG_COLOR — pass it as BOTH name and cat so the picker binds either way.
            orderedColors: [{ name: color, cat: color, qty: totalQty }]
        }, 'Re-order of order #' + orderNo + (designName ? ' — ' + designName : ''));
        return true;
    }
    function setReqImage(url) {
        var box = byId('cp-req-image');
        if (!box) return;
        box.innerHTML = url ? '<img src="' + escapeAttr(url) + '" alt="">' : '<div class="cp-req-noimg">&#128085;</div>';
    }

    // Catalog-style color picker. The ordered color is a ShopWorks CATALOG_COLOR ("Hthrd Charcoal");
    // the backend resolves it to the SanMar COLOR_NAME and passes BOTH, so we match on EITHER.
    function normColor(s) { return String(s == null ? '' : s).toLowerCase().replace(/[^a-z0-9]/g, ''); }
    function orderedQtyMap() {
        var map = {};
        ((reqState && reqState.orderedColors) || []).forEach(function (c) {
            if (!c) return;
            var q = Number(c.qty) || 0;
            if (c.name) map[normColor(c.name)] = q;
            if (c.cat) map[normColor(c.cat)] = q;
        });
        return map;
    }
    function setColorStat(colorName) {
        var el = byId('cp-req-colorstat');
        if (!el) return;
        var q = orderedQtyMap()[normColor(colorName)] || 0;
        el.textContent = q > 0 ? ('· ' + q.toLocaleString() + ' ordered before') : '';
    }
    function renderColorPicker(style, orderedColor, orderedImage) {
        var grid = byId('cp-req-colors');
        if (!grid) return;
        function renderTiles(colors) {
            reqState.colorImages = {};
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
            ordered.forEach(function (o) { if (!o.used) { enriched.unshift({ name: o.name, cat: '', image: '', swatch: '', qty: o.qty, i: -1 }); o.used = true; } });
            enriched.sort(function (a, b) {
                if ((b.qty > 0) !== (a.qty > 0)) return (b.qty > 0 ? 1 : 0) - (a.qty > 0 ? 1 : 0);
                if (b.qty !== a.qty) return b.qty - a.qty;
                return a.i - b.i;
            });
            var hidden = byId('cp-req-color');
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
                    ? '<span class="cp-swatch-sq"><img src="' + escapeAttr(c.swatch) + '" alt="" loading="lazy"></span>'
                    : '<span class="cp-swatch-sq cp-swatch-sq--noimg"></span>';
                var tag = (topName && c.name === topName) ? '<span class="cp-swatch-tag">Top color</span>' : '';
                var qtyLine = c.qty > 0 ? '<span class="cp-swatch-qty">' + c.qty.toLocaleString() + ' ordered</span>' : '';
                return '<button type="button" class="cp-swatch-btn' + (isSel ? ' is-selected' : '') + '" data-color="' + escapeAttr(c.name) + '">' +
                    tag + sq + '<span class="cp-swatch-nm">' + escapeHtml(c.name) + '</span>' + qtyLine + '</button>';
            }).join('');
            setColorStat(selName);
            var selImg = reqState.colorImages[selName] || orderedImage || '';
            if (selImg) setReqImage(selImg);
        }
        renderTiles(((reqState && reqState.orderedColors) || []).map(function (c) { return { name: c.name, catalogColor: c.cat || '', image: '', swatch: '' }; }));
        // Stale-response guard: if a different modal opened before this resolves, discard.
        var pickerReqState = reqState;
        fetch(COLORS_URL_BASE + encodeURIComponent(style), { credentials: 'same-origin' })
            .then(function (r) { return r.ok ? r.json() : { colors: [] }; })
            .then(function (d) { if (reqState !== pickerReqState) return; var colors = (d && d.colors) || []; if (colors.length) renderTiles(colors); })
            .catch(function () { /* keep the seeded ordered-color tiles */ });
    }
    document.addEventListener('click', function (e) {
        var sw = e.target.closest && e.target.closest('.cp-swatch-btn');
        if (!sw) return;
        var grid = byId('cp-req-colors');
        if (!grid || !grid.contains(sw)) return;
        var name = sw.getAttribute('data-color') || '';
        byId('cp-req-color').value = name;
        grid.querySelectorAll('.cp-swatch-btn').forEach(function (b) { b.classList.remove('is-selected'); });
        sw.classList.add('is-selected');
        setReqImage((reqState && reqState.colorImages && reqState.colorImages[name]) || (reqState && reqState.image) || '');
        setColorStat(name);
    });
    function buildSizeGrid(sizes) {
        var grid = byId('cp-size-grid');
        if (!grid) return;
        grid.innerHTML = SIZE_ORDER.map(function (sz) {
            var v = Number(sizes && sizes[sz]) || 0;
            return '<label class="cp-size-cell"><span class="cp-size-name">' + sz + '</span>' +
                '<input type="number" min="0" inputmode="numeric" class="cp-size-input" data-size="' + sz + '" value="' + (v > 0 ? v : '') + '" placeholder="0"></label>';
        }).join('');
        grid.querySelectorAll('.cp-size-input').forEach(function (i) { i.addEventListener('input', updateSizeTotal); });
        updateSizeTotal();
    }
    function collectSizes() {
        var out = {}, total = 0;
        $$('#cp-size-grid .cp-size-input').forEach(function (inp) { var n = parseInt(inp.value, 10); if (n > 0) { out[inp.getAttribute('data-size')] = n; total += n; } });
        return { sizes: out, total: total };
    }
    function updateSizeTotal() { setText('cp-size-total', collectSizes().total); }
    function submitReq() {
        if (!reqState) return;
        var err = byId('cp-req-error'); err.textContent = '';
        var picked = collectSizes();
        if (picked.total <= 0) { err.textContent = 'Enter a quantity for at least one size.'; return; }
        if (PREVIEW) { closeReqModal(); showToast('Staff preview — the customer would send this request to their rep.'); return; }
        var color = byId('cp-req-color').value || reqState.color || '';
        var breakdown = SIZE_ORDER.filter(function (s) { return picked.sizes[s]; }).map(function (s) { return s + ':' + picked.sizes[s]; }).join(', ');
        var submitBtn = byId('cp-req-submit');
        submitBtn.disabled = true; submitBtn.textContent = 'Sending…';
        fetch('/api/portal/reorder-request', {
            method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                style: reqState.style, color: color, product_title: reqState.title, design_number: reqState.design, design_name: reqState.designName,
                qty: String(picked.total), size_breakdown: breakdown, note: byId('cp-req-note').value.trim(),
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
            .catch(function () { submitBtn.disabled = false; submitBtn.textContent = 'Send to my rep'; err.textContent = 'Could not send. Please try again or call ' + PHONE_TXT + '.'; });
    }
    (function wireReqModal() {
        var close = byId('cp-req-close'); if (close) close.addEventListener('click', closeReqModal);
        var cancel = byId('cp-req-cancel'); if (cancel) cancel.addEventListener('click', closeReqModal);
        var submit = byId('cp-req-submit'); if (submit) submit.addEventListener('click', submitReq);
        var ov = byId('cp-req-modal'); if (ov) ov.addEventListener('click', function (e) { if (e.target === ov) closeReqModal(); });
    })();

    // ══════════════════════════════════════════════════════════════════════
    // GENERAL REQUEST MODAL — quote · new logo · logo change (+ account form)
    // ══════════════════════════════════════════════════════════════════════
    var GEN_TYPES = {
        'quote': { title: 'Request a quote', intro: 'Tell us what you have in mind &mdash; your rep replies with pricing and a proof. Nothing is charged until you approve a quote.', descLabel: 'What do you need?', placeholder: 'e.g. 36 polos with our logo on the left chest, plus 12 caps', details: true, logo: true, ok: 'Request sent! {rep} will follow up with a quote.' },
        'logo': { title: 'Send us a new logo', intro: 'Describe the logo (name, colors, where it goes). Your rep replies with where to send the file &mdash; vector (AI, EPS, PDF) or a high-resolution PNG works best.', descLabel: 'About the logo', placeholder: 'e.g. New 2026 event logo, 3 colors, for the back of hoodies', details: false, logo: false, ok: 'Got it! {rep} will reach out about the file.' },
        'logo-change': { title: 'Request a logo change', intro: 'Tell us what should change. We&rsquo;ll send a revised proof for your approval before anything runs.', descLabel: 'What should change?', placeholder: 'e.g. Update the phone number and make the text white', details: false, logo: true, ok: 'Change request sent! {rep} will follow up with a new proof.' },
    };
    function populateGenDesignSelect() {
        var sel = byId('cp-gen-design');
        if (!sel) return;
        var opts = ['<option value="">No logo / not sure yet</option>'];
        S.logos.approved.concat(S.logos.mockups.filter(function (m) { return !S.logos.approved.some(function (a) { return a.design && a.design === m.design; }); })).forEach(function (l) {
            if (!l.design && !l.name) return;
            opts.push('<option value="' + escapeAttr(l.design) + '" data-name="' + escapeAttr(l.name) + '">' + escapeHtml((l.design ? 'Design #' + l.design + ' — ' : '') + l.name) + '</option>');
        });
        opts.push('<option value="NEW">New logo — I\'ll send it</option>');
        sel.innerHTML = opts.join('');
    }
    function openGenModal(type, prefill) {
        var cfg = GEN_TYPES[type] || GEN_TYPES.quote;
        prefill = prefill || {};
        byId('cp-gen-type').value = GEN_TYPES[type] ? type : 'quote';
        setText('cp-gen-title', cfg.title);
        byId('cp-gen-intro').innerHTML = cfg.intro;
        setText('cp-gen-desc-label', cfg.descLabel);
        var desc = byId('cp-gen-desc'); desc.value = ''; desc.placeholder = cfg.placeholder;
        byId('cp-gen-method').value = ''; byId('cp-gen-qty').value = ''; byId('cp-gen-note').value = '';
        show(byId('cp-gen-row-details'), cfg.details);
        show(byId('cp-gen-logo-field'), cfg.logo);
        if (!byId('cp-gen-design').options.length) populateGenDesignSelect();
        var sel = byId('cp-gen-design');
        sel.value = prefill.design || '';
        if (prefill.design && sel.value !== prefill.design) {
            // A design not in the list (e.g. a finished photo's #) — add it so the rep sees the reference.
            var o = document.createElement('option'); o.value = prefill.design; o.setAttribute('data-name', prefill.designName || ''); o.textContent = 'Design #' + prefill.design + (prefill.designName ? ' — ' + prefill.designName : '');
            sel.appendChild(o); sel.value = prefill.design;
        }
        setText('cp-gen-error', '');
        byId('cp-gen-modal').hidden = false;
        try { desc.focus(); } catch (e) { }
    }
    function closeGenModal() { var m = byId('cp-gen-modal'); if (m) m.hidden = true; }
    function postRequest(payload, btn, idleLabel, okMsg, errEl, onOk) {
        if (PREVIEW) { showToast('Staff preview — the customer would send this to their rep.'); if (onOk) onOk(); return; }
        btn.disabled = true; btn.textContent = 'Sending…';
        fetch('/api/portal/request', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
            .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
            .then(function (x) {
                btn.disabled = false; btn.textContent = idleLabel;
                if (!x.ok || !x.j.ok) { errEl.textContent = (x.j && x.j.error) || 'Could not send. Please try again.'; return; }
                if (onOk) onOk();
                showToast(okMsg.replace('{rep}', x.j.rep ? escapeHtml(x.j.rep) : 'Your rep'));
            })
            .catch(function () { btn.disabled = false; btn.textContent = idleLabel; errEl.textContent = 'Could not send. Please try again or call ' + PHONE_TXT + '.'; });
    }
    function submitGen() {
        var type = byId('cp-gen-type').value, cfg = GEN_TYPES[type] || GEN_TYPES.quote;
        var err = byId('cp-gen-error'); err.textContent = '';
        var desc = byId('cp-gen-desc').value.trim();
        if (desc.length < 3) { err.textContent = 'Tell us a little about what you need.'; return; }
        var sel = byId('cp-gen-design'), opt = sel.options[sel.selectedIndex];
        var design = cfg.logo ? (sel.value === 'NEW' ? '' : sel.value) : '';
        var designName = cfg.logo ? (sel.value === 'NEW' ? 'New logo (customer will send)' : ((opt && opt.getAttribute('data-name')) || '')) : '';
        postRequest({
            type: type, description: desc,
            method: cfg.details ? byId('cp-gen-method').value : '', qty: cfg.details ? byId('cp-gen-qty').value.trim() : '',
            design_number: design, design_name: designName, note: byId('cp-gen-note').value.trim()
        }, byId('cp-gen-submit'), 'Send to my rep', cfg.ok, err, closeGenModal);
    }
    (function wireGenModal() {
        var c = byId('cp-gen-close'); if (c) c.addEventListener('click', closeGenModal);
        var ca = byId('cp-gen-cancel'); if (ca) ca.addEventListener('click', closeGenModal);
        var s = byId('cp-gen-submit'); if (s) s.addEventListener('click', submitGen);
        var ov = byId('cp-gen-modal'); if (ov) ov.addEventListener('click', function (e) { if (e.target === ov) closeGenModal(); });
        var form = byId('cp-acct-form');
        if (form) form.addEventListener('submit', function (e) {
            e.preventDefault();
            var err = byId('cp-acct-error'); err.textContent = '';
            var contact = byId('cp-acct-contact').value.trim(), phone = byId('cp-acct-phone').value.trim(), msg = byId('cp-acct-msg').value.trim();
            if (!msg && !contact && !phone) { err.textContent = 'Tell us what changed.'; return; }
            var desc = [contact ? 'Contact: ' + contact : '', phone ? 'Phone: ' + phone : '', msg].filter(Boolean).join(' · ');
            postRequest({ type: 'account', description: desc }, byId('cp-acct-submit'), 'Send to my rep', 'Thanks! {rep} will update your account details.', err, function () { form.reset(); });
        });
    })();

    // ══════════════════════════════════════════════════════════════════════
    // REWARD DOLLARS — read balance + redeem-as-request (ported)
    // ══════════════════════════════════════════════════════════════════════
    function renderRewardsCard() {
        var card = byId('cp-rewards'), balEl = byId('cp-rewards-balance'), subEl = byId('cp-rewards-sub'), btn = byId('cp-redeem-btn');
        if (!card || !balEl) return;
        balEl.textContent = money(S.rewardBalance);
        var zero = !(S.rewardBalance > 0);
        card.classList.toggle('cp-rewards--zero', zero);
        // Program copy comes from the API (rates are Erik-editable in Caspio); the cost thresholds
        // that define "premium" never reach the browser.
        var prog = S.rewardProgram;
        var earnLine = (prog && prog.configured && prog.baseRatePct > 0)
            ? ('You earn ' + prog.baseRatePct + '% back on every paid order' + (prog.premiumRatePct > prog.baseRatePct ? ' — ' + prog.premiumRatePct + '% on premium garments' : '') + '.')
            : 'Earn reward dollars on premium picks — look for the ★ tag under Recommended for You.';
        var earnedTxt = S.rewardEarned > 0 ? ' Earned in the last ' + ((prog && prog.months) || 12) + ' months: ' + money(S.rewardEarned) + '.' : '';
        if (subEl) subEl.textContent = zero
            ? (earnLine + earnedTxt)
            : ('Apply them to your next order — your rep takes it from there.' + earnedTxt);
        if (btn) btn.textContent = zero ? 'See ways to earn ★' : 'Redeem on your next order';
    }
    function loadRewards() {
        fetch(REWARDS_URL, { credentials: 'same-origin' })
            .then(function (r) { if (!r.ok) throw new Error('rewards ' + r.status); return r.json(); })
            .then(function (d) {
                S.rewardBalance = Number(d && d.balance) || 0;
                S.rewardEntries = (d && d.entries) || [];
                S.rewardProgram = (d && d.program) || null;
                S.rewardEarned = Number(d && d.earnedInWindow) || 0;
                S.rewardsLoaded = true;
                renderRewardsCard();
            })
            .catch(function (err) {
                // A blip must not silently hide a real balance — say "unavailable", never a false $0.
                console.error('Portal rewards load failed:', err);
                if (!S.rewardsLoaded) {
                    var balEl = byId('cp-rewards-balance'); if (balEl) balEl.textContent = '—';
                    var sub = byId('cp-rewards-sub'); if (sub) sub.textContent = 'Balance unavailable right now — refresh to try again.';
                    var card = byId('cp-rewards'); if (card) card.classList.add('cp-rewards--zero');
                }
            });
    }
    function renderRewardHistory() {
        var wrap = byId('cp-redeem-history'), list = byId('cp-redeem-history-list');
        if (!wrap || !list) return;
        var rows = (S.rewardEntries || []).slice(0, 5);
        if (!rows.length) { show(wrap, false); return; }
        list.innerHTML = rows.map(function (e) {
            var amt = Number(e.amount) || 0;
            var label = e.reason || (e.type === 'redeem' ? 'Redeemed' : e.type === 'grant' ? 'Reward earned' : 'Adjustment');
            return '<div class="cp-rh-row"><span class="cp-rh-amt ' + (amt < 0 ? 'is-neg' : 'is-pos') + '">' + (amt < 0 ? '−' : '+') + money(Math.abs(amt)) + '</span>' +
                '<span class="cp-rh-label">' + escapeHtml(label) + '</span>' + (e.created ? '<span class="cp-rh-date">' + escapeHtml(formatDate(e.created)) + '</span>' : '') + '</div>';
        }).join('');
        show(wrap, true);
    }
    function openRedeem() {
        if (!(S.rewardBalance > 0)) {
            // $0 — the button is an earn-nudge: jump to the ★-tagged Recommended picks.
            var target = byId('cp-ov-recs-section');
            if (target && !target.hidden) { switchTab('overview', { scroll: false }); setTimeout(function () { try { target.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (e) { target.scrollIntoView(); } }, 60); }
            else switchTab('products');
            showToast('&#9733; Premium picks with the gold tag earn reward dollars — ask your rep for details.');
            return;
        }
        if (PREVIEW) { showToast('Staff preview — the customer would redeem their rewards here.'); return; }
        setText('cp-redeem-avail', money(S.rewardBalance));
        byId('cp-redeem-amt').value = '';
        setText('cp-redeem-error', '');
        renderRewardHistory();
        byId('cp-redeem-modal').hidden = false;
    }
    function closeRedeem() { var m = byId('cp-redeem-modal'); if (m) m.hidden = true; }
    function submitRedeem() {
        var amt = parseFloat(byId('cp-redeem-amt').value);
        var err = byId('cp-redeem-error'); err.textContent = '';
        if (!(amt > 0)) { err.textContent = 'Enter a valid amount.'; return; }
        if (amt > S.rewardBalance + 0.001) { err.textContent = 'You have ' + money(S.rewardBalance) + ' available.'; return; }
        var btn = byId('cp-redeem-submit');
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
        var b = byId('cp-redeem-btn'); if (b) b.addEventListener('click', openRedeem);
        var c = byId('cp-redeem-close'); if (c) c.addEventListener('click', closeRedeem);
        var ca = byId('cp-redeem-cancel'); if (ca) ca.addEventListener('click', closeRedeem);
        var s = byId('cp-redeem-submit'); if (s) s.addEventListener('click', submitRedeem);
        var ov = byId('cp-redeem-modal'); if (ov) ov.addEventListener('click', function (e) { if (e.target === ov) closeRedeem(); });
    })();

    // ══════════════════════════════════════════════════════════════════════
    // QUOTES — sessions tied to the sign-in email
    // ══════════════════════════════════════════════════════════════════════
    var QUOTE_SLUG = { 'Open': 'open-quote', 'Ordered': 'ordered', 'Shipped': 'shipped', 'Expired': 'expired', 'Cancelled': 'cancelled' };
    function renderQuotes() {
        var list = S.quotes;
        setText('cp-quotes-count', list.length);
        var wrap = byId('cp-quotes-wrap'), empty = byId('cp-quotes-empty');
        if (!list.length) { wrap.innerHTML = ''; show(empty, true); return; }
        show(empty, false);
        var rows = list.map(function (q) {
            var d = daysUntil(q.expires);
            var expires = q.expires ? escapeHtml(formatDate(q.expires)) + (q.status === 'Open' && d != null && d >= 0 && d <= 7 ? ' <span class="cp-due-badge">' + (d === 0 ? 'Today' : d + 'd left') + '</span>' : '') : '—';
            var track = q.tracking && q.tracking.number
                ? (function () { var url = q.tracking.url || trackingLink(q.tracking.carrier, q.tracking.number); return url ? '<a class="cp-btn cp-btn--ghost cp-btn--xs" href="' + escapeAttr(url) + '" target="_blank" rel="noopener">' + icon('truck') + 'Track</a>' : ''; })()
                : '';
            var view = q.viewUrl ? '<a class="cp-btn cp-btn--soft cp-btn--xs" href="' + escapeAttr(q.viewUrl) + '">View quote</a>' : '';
            return '<tr>' +
                '<td>' + (q.viewUrl ? '<a class="cp-link" href="' + escapeAttr(q.viewUrl) + '">' + escapeHtml(q.quoteId) + '</a>' : '<span class="cp-link">' + escapeHtml(q.quoteId) + '</span>') + (q.projectName ? '<span class="cp-cell-sub">' + escapeHtml(q.projectName) + '</span>' : '') + '</td>' +
                '<td>' + escapeHtml(formatDate(q.created) || '—') + '</td>' +
                '<td>' + expires + '</td>' +
                '<td class="cp-num">' + (q.quantity ? escapeHtml(String(q.quantity)) : '—') + '</td>' +
                '<td class="cp-num cp-strong">' + (q.total ? money(q.total) : '—') + '</td>' +
                '<td>' + renderStatusBadge(q.status, QUOTE_SLUG[q.status] || 'neutral') + '</td>' +
                '<td class="cp-cell-actions">' + track + view + '</td>' +
                '</tr>';
        }).join('');
        wrap.innerHTML = '<table class="cp-table"><thead><tr><th>Quote</th><th>Created</th><th>Expires</th><th class="cp-num">Qty</th><th class="cp-num">Total</th><th>Status</th><th aria-label="Actions"></th></tr></thead><tbody>' + rows + '</tbody></table>';
    }
})();
