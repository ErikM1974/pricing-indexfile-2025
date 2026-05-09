/**
 * WorkOrderPicker — Browse-on-focus picker for ShopWorks Work Order #
 * on AE intake forms. Mirrors DesignNamePicker UX one-to-one but sources
 * data from ManageOrders (the OnSite/ShopWorks ERP proxy) rather than
 * Caspio's Design_Lookup_2026.
 *
 * Backend:
 *   - GET /api/manageorders/orders?id_Customer=<n>
 *     Returns { result: [...orders sorted by date_Ordered DESC] }
 *     Each order has id_Order (= Work Order #), date_Ordered, DesignName,
 *     id_Design, CustomerPurchaseOrder, etc.
 *
 * UX:
 *   - Click empty Work Order # field → dropdown opens with this customer's
 *     most recent ShopWorks orders (newest first, top 25).
 *   - Type to filter (client-side, since MO doesn't have a query param —
 *     we already have the full list cached).
 *   - Click an order → fill Work Order # input + invoke onSelect(order)
 *     so the form's submit handler can also smart-fill design fields if
 *     they're empty.
 *   - No company picked → "Pick a company first" hint.
 *
 * Reuses .ccp-* CSS injected by company-contact-picker.js.
 */
(function (global) {
    'use strict';

    var DEFAULT_BASE_URL = (global.APP_CONFIG && global.APP_CONFIG.API && global.APP_CONFIG.API.BASE_URL)
        || 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';
    var BROWSE_DISPLAY_CAP = 25;
    var DEBOUNCE_MS = 200;
    var CACHE_TTL = 5 * 60 * 1000;
    var ordersCache = new Map();
    var debounceTimer = null;

    function escapeHtml(str) {
        if (str == null) return '';
        var div = document.createElement('div');
        div.textContent = String(str);
        return div.innerHTML;
    }

    function formatOrderDate(iso) {
        if (!iso) return '';
        try {
            var d = new Date(iso);
            if (isNaN(d.getTime())) return '';
            return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        } catch (e) { return ''; }
    }

    function fetchOrders(customerId) {
        var key = String(customerId);
        var cached = ordersCache.get(key);
        if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
            return Promise.resolve(cached.data);
        }
        var url = DEFAULT_BASE_URL + '/api/manageorders/orders?id_Customer=' + encodeURIComponent(key);
        return fetch(url)
            .then(function (r) {
                if (!r.ok) throw new Error('manageorders/orders ' + r.status);
                return r.json();
            })
            .then(function (data) {
                var result = (data && data.result) || [];
                // Sort newest first by date_Ordered (server may return any order)
                result.sort(function (a, b) {
                    var ad = new Date(a.date_Ordered || 0).getTime();
                    var bd = new Date(b.date_Ordered || 0).getTime();
                    return bd - ad;
                });
                ordersCache.set(key, { data: result, timestamp: Date.now() });
                if (ordersCache.size > 30) {
                    ordersCache.delete(ordersCache.keys().next().value);
                }
                return result;
            })
            .catch(function (err) {
                console.warn('[WorkOrderPicker] fetch failed:', err);
                return [];
            });
    }

    function filterOrders(orders, query) {
        if (!query) return orders;
        var q = query.toLowerCase();
        return orders.filter(function (o) {
            return (String(o.id_Order || '').indexOf(q) !== -1)
                || ((o.DesignName || '').toLowerCase().indexOf(q) !== -1)
                || ((o.CustomerPurchaseOrder || '').toLowerCase().indexOf(q) !== -1);
        });
    }

    function bind(opts) {
        var input = document.getElementById(opts.inputId);
        if (!input) {
            console.error('[WorkOrderPicker] input not found:', opts.inputId);
            return null;
        }
        var getCustomerId = opts.getCustomerId || function () { return 0; };

        var dropdown = document.createElement('div');
        dropdown.className = 'ccp-dropdown';
        dropdown.id = opts.inputId + '-wop-dropdown';
        if (input.parentNode) {
            input.parentNode.style.position = 'relative';
            input.parentNode.appendChild(dropdown);
        }

        var allOrders = [];   // last fetched full list for the current customer
        var lastResults = []; // currently rendered (may be filtered by query)

        function show() { dropdown.classList.add('ccp-open'); }
        function hide() { dropdown.classList.remove('ccp-open'); }

        function renderEmpty(msg) {
            dropdown.innerHTML = '<div class="ccp-empty">' + escapeHtml(msg) + '</div>';
            show();
        }

        function renderResults(orders, mode) {
            if (!orders.length) {
                renderEmpty(mode === 'browse'
                    ? 'No ShopWorks orders on file for this customer'
                    : 'No matching orders for this customer');
                return;
            }
            var heading = (mode === 'browse')
                ? 'Recent orders (newest first)'
                : 'Orders matching your search';
            var html = '<div class="ccp-section-header">' + heading + '</div>';
            orders.forEach(function (o, i) {
                var orderNum = String(o.id_Order || '');
                var design = o.DesignName || '(no design)';
                var date = formatOrderDate(o.date_Ordered);
                var designNum = o.id_Design ? ' · Design #' + escapeHtml(String(o.id_Design)) : '';
                html += '<div class="ccp-item" data-kind="order" data-index="' + i + '">'
                    + '  <div class="ccp-item-body">'
                    + '    <div class="ccp-item-primary">#' + escapeHtml(orderNum) + ' · ' + escapeHtml(design) + '</div>'
                    + '    <div class="ccp-item-secondary">'
                    +        (date ? 'Ordered ' + escapeHtml(date) : '')
                    +        designNum
                    + '    </div>'
                    + '  </div>'
                    + '</div>';
            });
            dropdown.innerHTML = html;
            show();
        }

        function loadAndRender() {
            var q = input.value.trim();
            var customerId = getCustomerId();
            if (!customerId) {
                renderEmpty('Pick a company first to see their orders');
                return;
            }
            // First time for this customer — fetch full order list. Subsequent
            // typing filters client-side from the cached list.
            if (!allOrders.length || allOrders._customerId !== customerId) {
                dropdown.innerHTML = '<div class="ccp-loading">Loading orders for this customer…</div>';
                show();
                fetchOrders(customerId).then(function (orders) {
                    allOrders = orders;
                    allOrders._customerId = customerId;
                    var filtered = filterOrders(allOrders, q).slice(0, BROWSE_DISPLAY_CAP);
                    lastResults = filtered;
                    renderResults(filtered, q ? 'search' : 'browse');
                });
                return;
            }
            var filtered = filterOrders(allOrders, q).slice(0, BROWSE_DISPLAY_CAP);
            lastResults = filtered;
            renderResults(filtered, q ? 'search' : 'browse');
        }

        // Input — debounced (covers typing-to-filter and clearing)
        input.addEventListener('input', function () {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(loadAndRender, DEBOUNCE_MS);
        });

        // Focus — open dropdown immediately
        input.addEventListener('focus', function () {
            // If the customer changed since last fetch, force a refetch by
            // resetting the cached list.
            var currentCust = getCustomerId();
            if (allOrders._customerId && allOrders._customerId !== currentCust) {
                allOrders = [];
            }
            loadAndRender();
        });

        // Click handler — same propagation-stop pattern the other pickers use
        dropdown.addEventListener('mousedown', function (e) {
            e.stopPropagation();
            var item = e.target.closest('.ccp-item');
            if (!item) return;
            e.preventDefault();
            var idx = parseInt(item.getAttribute('data-index'), 10);
            var order = lastResults[idx];
            if (!order) return;
            input.value = String(order.id_Order || '');
            hide();
            if (typeof opts.onSelect === 'function') opts.onSelect(order);
        });

        // Click-outside-to-close
        document.addEventListener('mousedown', function (e) {
            if (!dropdown.contains(e.target) && e.target !== input) {
                hide();
            }
        });

        // Keyboard nav
        input.addEventListener('keydown', function (e) {
            var items = dropdown.querySelectorAll('.ccp-item');
            if (!items.length || !dropdown.classList.contains('ccp-open')) return;
            var current = -1;
            for (var i = 0; i < items.length; i++) {
                if (items[i].classList.contains('ccp-highlight')) { current = i; break; }
            }
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                var next = current < items.length - 1 ? current + 1 : 0;
                items.forEach(function (it) { it.classList.remove('ccp-highlight'); });
                items[next].classList.add('ccp-highlight');
                items[next].scrollIntoView({ block: 'nearest' });
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                var prev = current > 0 ? current - 1 : items.length - 1;
                items.forEach(function (it) { it.classList.remove('ccp-highlight'); });
                items[prev].classList.add('ccp-highlight');
                items[prev].scrollIntoView({ block: 'nearest' });
            } else if (e.key === 'Enter' && current >= 0) {
                e.preventDefault();
                items[current].dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
            } else if (e.key === 'Escape') {
                hide();
                if (typeof opts.onClear === 'function') opts.onClear();
            }
        });

        return {
            clear: function () {
                input.value = '';
                hide();
                if (typeof opts.onClear === 'function') opts.onClear();
            }
        };
    }

    global.WorkOrderPicker = { bind: bind };
})(typeof window !== 'undefined' ? window : this);
