/**
 * catalog-2026.js — dedicated /catalog page (NWCA 2026 redesign, P2)
 *
 * URL-driven product discovery: every search/filter/sort/page change lives in
 * the query string (?q=&category=&subcategory=&brand=&color=&size=&minPrice=
 * &maxPrice=&sort=&page=&method=) via history.pushState; popstate restores;
 * landing with params searches immediately. Data layer =
 * product-search-service.js (shared, read-only). Chrome population (mega-nav
 * categories, drawer list, brands flyout) comes from app-modern.js +
 * brands-flyout.js — this file intercepts their navigation so category/brand
 * clicks stay on /catalog.
 *
 * DECORATION FILTER (?method=emb|dtg|scp|dtf, single-select): maps the method
 * to its eligible-category set from the shared DecorationMethods rules feed
 * and applies it as the search API's category array param. Rules feed
 * unavailable → the group renders DISABLED with a note (never hidden
 * silently), and an active ?method= param shows a visible "not narrowed"
 * warning instead of silently filtering wrong.
 *
 * PRICE RULE (Erik's iron rule): render server-computed displayPriceLabel
 * when the API provides it; otherwise a neutral "See pricing →" link.
 * NEVER compute a price client-side. NOTE: ProductSearchService.processProducts
 * overwrites product.displayPrice with a client-margin string — that field is
 * deliberately IGNORED here; only the server-only displayPriceLabel is used.
 */
(function () {
    'use strict';

    /* ── Config / utilities ──────────────────────────────────────── */

    var PAGE_SIZE = 48;
    var POPULAR_CATEGORIES = ['T-Shirts', 'Caps', 'Sweatshirts/Fleece', 'Polos/Knits'];
    var SIZE_ORDER = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL', '6XL'];
    var SORT_VALUES = ['', 'price_asc', 'price_desc', 'name_asc', 'name_desc', 'style', 'newest'];
    var METHOD_VALUES = ['emb', 'dtg', 'scp', 'dtf'];
    var METHOD_LABELS = { emb: 'Embroidery', dtg: 'DTG Print', scp: 'Screen Print', dtf: 'DTF Transfer' };

    function escapeHtml(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function debounce(fn, ms) {
        var t = null;
        return function () {
            var args = arguments, self = this;
            clearTimeout(t);
            t = setTimeout(function () { fn.apply(self, args); }, ms);
        };
    }

    function byId(id) { return document.getElementById(id); }

    function formatCount(n) {
        return Number(n || 0).toLocaleString('en-US');
    }

    /* ── DOM handles (every id exists in pages/catalog.html) ─────── */

    var els = {
        searchInput: byId('navSearchInput'),
        searchBtn: byId('navSearchBtn'),
        acList: byId('navAutocompleteList'),
        sidebar: byId('sidebar'),
        sidebarOverlay: byId('sidebarOverlay'),
        drawerClose: byId('drawerClose'),
        filtersRail: byId('filtersRail'),
        filtersClose: byId('filtersClose'),
        filtersOpen: byId('filtersOpen'),
        filtersOpenCount: byId('filtersOpenCount'),
        filtersOverlay: byId('filtersOverlay'),
        filterGroups: byId('filterGroups'),
        clearAllFilters: byId('clearAllFilters'),
        crumbs: byId('catalogCrumbs'),
        title: byId('catalogTitle'),
        sub: byId('catalogSub'),
        status: byId('resultsStatus'),
        sortSelect: byId('sortSelect'),
        chips: byId('activeChips'),
        alertSlot: byId('alertSlot'),
        grid: byId('resultsGrid'),
        pager: byId('pager'),
        qvModal: byId('quickViewModal'),
        qvTitle: byId('qvTitle'),
        qvBody: byId('qvBody'),
        qvClose: byId('qvClose'),
        brandsGrid: byId('navBrandsGrid')
    };

    var service = new window.ProductSearchService();

    /* ── State ⇄ URL ─────────────────────────────────────────────── */

    function defaultState() {
        return {
            q: '', category: '', subcategory: '',
            brand: [], color: [], size: [],
            minPrice: '', maxPrice: '',
            method: '',
            sort: '', page: 1
        };
    }

    var state = defaultState();
    var lastResults = null;
    var lastFacets = null;
    var lastShownProducts = [];
    var searchSeq = 0;
    var railUI = { expanded: {}, brandQuery: '' };

    /* ── Decoration eligibility rules (shared DecorationMethods module) ──
       status: 'loading' until the first load settles, then 'ready' (map
       filled: method → eligible category array) or 'unavailable' (rules feed
       unreachable / module missing — the filter group renders disabled). */
    var deco = { status: 'loading', map: null, promise: null };

    function loadDecoRules() {
        if (deco.promise) return deco.promise;
        if (!window.DecorationMethods) {
            console.error('[Catalog] DecorationMethods module missing — Decoration filter disabled');
            deco.status = 'unavailable';
            deco.promise = Promise.resolve(null);
            return deco.promise;
        }
        deco.promise = Promise.all(METHOD_VALUES.map(function (m) {
            return window.DecorationMethods.categoriesFor(m);
        })).then(function (lists) {
            if (lists.some(function (l) { return l === null; })) {
                deco.status = 'unavailable';
                deco.map = null;
            } else {
                deco.map = {};
                METHOD_VALUES.forEach(function (m, i) { deco.map[m] = lists[i]; });
                deco.status = 'ready';
            }
            return deco.map;
        }).catch(function (error) {
            console.error('[Catalog] Decoration rules load failed:', error);
            deco.status = 'unavailable';
            deco.map = null;
            return null;
        });
        return deco.promise;
    }

    function listHasCi(list, value) {
        var want = String(value || '').trim().toLowerCase();
        return list.some(function (v) { return String(v || '').trim().toLowerCase() === want; });
    }

    /** True when the active method filter contradicts the selected category. */
    function methodCategoryConflict() {
        return !!(state.method && deco.map && state.category &&
            !listHasCi(deco.map[state.method] || [], state.category));
    }

    function stateFromUrl() {
        var p = new URLSearchParams(window.location.search);
        var s = defaultState();
        s.q = (p.get('q') || '').trim();
        s.category = (p.get('category') || '').trim();
        s.subcategory = (p.get('subcategory') || '').trim();
        s.brand = p.getAll('brand').filter(Boolean);
        s.color = p.getAll('color').filter(Boolean);
        s.size = p.getAll('size').filter(Boolean);
        s.minPrice = (p.get('minPrice') || '').trim();
        s.maxPrice = (p.get('maxPrice') || '').trim();
        var method = (p.get('method') || '').trim().toLowerCase();
        s.method = METHOD_VALUES.indexOf(method) !== -1 ? method : '';
        var sort = (p.get('sort') || '').trim();
        s.sort = SORT_VALUES.indexOf(sort) !== -1 ? sort : '';
        var page = parseInt(p.get('page'), 10);
        s.page = isFinite(page) && page > 0 ? page : 1;
        return s;
    }

    function urlFromState(s) {
        var p = new URLSearchParams();
        if (s.q) p.set('q', s.q);
        if (s.category) p.set('category', s.category);
        if (s.subcategory) p.set('subcategory', s.subcategory);
        s.brand.forEach(function (v) { p.append('brand', v); });
        s.color.forEach(function (v) { p.append('color', v); });
        s.size.forEach(function (v) { p.append('size', v); });
        if (s.minPrice !== '') p.set('minPrice', s.minPrice);
        if (s.maxPrice !== '') p.set('maxPrice', s.maxPrice);
        if (s.method) p.set('method', s.method);
        if (s.sort) p.set('sort', s.sort);
        if (s.page > 1) p.set('page', String(s.page));
        var qs = p.toString();
        return window.location.pathname + (qs ? '?' + qs : '');
    }

    function urlForPatch(patch) {
        var next = JSON.parse(JSON.stringify(state));
        Object.keys(patch).forEach(function (k) { next[k] = patch[k]; });
        return urlFromState(next);
    }

    /** Apply a state patch, push the URL, and search. */
    function navigate(patch, opts) {
        Object.keys(patch).forEach(function (k) { state[k] = patch[k]; });
        if (!('page' in patch)) state.page = 1;
        window.history.pushState({ nwcaCatalog: true }, '', urlFromState(state));
        runSearch();
        if (opts && opts.scrollTop) scrollToResults();
    }

    function scrollToResults() {
        var shell = document.querySelector('.catalog-shell');
        if (shell) shell.scrollIntoView({ block: 'start' });
    }

    function activeFilterCount() {
        return (state.category ? 1 : 0) + (state.subcategory ? 1 : 0) +
            state.brand.length + state.color.length + state.size.length +
            ((state.minPrice !== '' || state.maxPrice !== '') ? 1 : 0) +
            (state.method ? 1 : 0);
    }

    /* ── Document title / page header / breadcrumb ───────────────── */

    function updateHeader(total) {
        var crumbsHtml = '<a href="/">Home</a><span class="crumbs-sep">/</span>';
        var h1, docTitle, sub;

        if (state.q) {
            crumbsHtml += '<a href="/catalog">Catalog</a><span class="crumbs-sep">/</span>' +
                '<span aria-current="page">Search</span>';
            h1 = 'Search: “' + escapeHtml(state.q) + '”';
            docTitle = state.q + ' — Search — NWCA Catalog';
            sub = total != null
                ? formatCount(total) + ' matching style' + (total === 1 ? '' : 's') + ' from our live supplier catalog.'
                : 'Searching the live supplier catalog…';
        } else if (state.category) {
            crumbsHtml += '<a href="/catalog">Catalog</a><span class="crumbs-sep">/</span>';
            if (state.subcategory) {
                crumbsHtml += '<a href="' + escapeHtml(urlForPatch({ subcategory: '', page: 1 })) + '" class="js-crumb-link">' +
                    escapeHtml(state.category) + '</a><span class="crumbs-sep">/</span>' +
                    '<span aria-current="page">' + escapeHtml(state.subcategory) + '</span>';
                h1 = escapeHtml(state.subcategory);
                docTitle = state.subcategory + ' ' + state.category + ' — NWCA Catalog';
            } else {
                crumbsHtml += '<span aria-current="page">' + escapeHtml(state.category) + '</span>';
                h1 = escapeHtml(state.category);
                docTitle = state.category + ' — NWCA Catalog';
            }
            sub = total != null
                ? formatCount(total) + ' customizable style' + (total === 1 ? '' : 's') + ' — embroidery, screen print, DTG, and DTF done in-house.'
                : 'Loading styles…';
        } else {
            crumbsHtml += '<span aria-current="page">Catalog</span>';
            h1 = 'Product Catalog';
            docTitle = 'Catalog — Northwest Custom Apparel';
            sub = 'Thousands of styles, live from our supplier catalog — filter by brand, color, size, and price.';
        }

        els.crumbs.innerHTML = crumbsHtml;
        els.title.innerHTML = h1;
        els.sub.textContent = sub;
        document.title = docTitle;
    }

    /* ── Search execution ────────────────────────────────────────── */

    function buildExtraParams() {
        var params = { limit: PAGE_SIZE, page: state.page };
        if (state.brand.length) params.brand = state.brand.slice();
        if (state.color.length) params.color = state.color.slice();
        if (state.size.length) params.size = state.size.slice();
        if (state.minPrice !== '') params.minPrice = state.minPrice;
        if (state.maxPrice !== '') params.maxPrice = state.maxPrice;
        if (state.sort) params.sort = state.sort;
        return params;
    }

    async function runSearch() {
        var seq = ++searchSeq;
        renderLoading();
        updateHeader(null);

        try {
            // Decoration filter: resolve the method's eligible-category set
            // first (cached after the first load; fails fast when the rules
            // feed is down — in that case the filter is NOT applied and
            // renderNotices shows a visible warning instead).
            var methodCats = null;
            if (state.method) {
                // Earlier failure isn't terminal — the rules feed may be live
                // now (module never caches failures), so retry per search.
                if (deco.status === 'unavailable' && window.DecorationMethods) deco.promise = null;
                await loadDecoRules();
                if (seq !== searchSeq) return;
                methodCats = deco.map ? (deco.map[state.method] || []) : null;
            }

            // Honest zero: selected category isn't producible with the
            // selected method — skip the API call, renderNotices explains.
            if (methodCats && state.category && !listHasCi(methodCats, state.category)) {
                lastResults = { products: [], pagination: { page: 1, total: 0, totalPages: 1, limit: PAGE_SIZE } };
                renderResults(lastResults);
                return;
            }

            var extras = buildExtraParams();
            var results;

            if (state.q) {
                // smartSearch handles style numbers, brand/category keyword
                // detection, and the zero-result category-drift guard.
                if (state.category) extras.category = state.category;
                else if (methodCats) extras.category = methodCats.slice(); // category array param
                if (state.subcategory) extras.subcategory = state.subcategory;
                results = await service.smartSearch(state.q, extras);
            } else if (state.category) {
                // Category landing — smart fallback (cat+sub → sub → cat) with
                // metadata.searchStrategy so we can show a visible notice.
                // (Method filter already validated above: category is eligible.)
                results = await service.searchByCategory(state.category, state.subcategory || null, extras);
            } else {
                extras.includeFacets = true;
                if (methodCats) extras.category = methodCats.slice(); // category array param
                results = await service.searchWithFacets(extras);
            }

            if (seq !== searchSeq) return; // a newer search superseded this one
            lastResults = results;
            if (results && results.facets) lastFacets = results.facets;
            renderResults(results);
        } catch (error) {
            if (seq !== searchSeq) return;
            console.error('[Catalog] Search failed:', error);
            renderError(error);
        }
    }

    /* ── Rendering: loading / error / results ────────────────────── */

    function skeletonCard() {
        return '<div class="pcard pcard-skel" aria-hidden="true">' +
            '<div class="skeleton pcard-skel-img"></div>' +
            '<div class="pcard-body">' +
            '<div class="skeleton skeleton-text skel-w40"></div>' +
            '<div class="skeleton skeleton-text skel-w70"></div>' +
            '<div class="skeleton skeleton-text skel-w55"></div>' +
            '</div></div>';
    }

    function renderLoading() {
        els.grid.setAttribute('aria-busy', 'true');
        var cards = '';
        for (var i = 0; i < 12; i++) cards += skeletonCard();
        els.grid.innerHTML = cards;
        els.pager.innerHTML = '';
        els.alertSlot.innerHTML = '';
        els.status.textContent = 'Loading products…';
    }

    function renderError(error) {
        els.grid.setAttribute('aria-busy', 'false');
        els.grid.innerHTML = '';
        els.pager.innerHTML = '';
        els.status.textContent = 'Catalog unavailable';
        els.alertSlot.innerHTML =
            '<div class="alert alert-error" role="alert">' +
            '<svg class="alert-icon" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path d="M10 1 1 18h18L10 1zm1 13h-2v2h2v-2zm0-7h-2v5h2V7z"/></svg>' +
            '<div class="alert-body">' +
            '<strong class="alert-title">Unable to load the catalog</strong>' +
            '<p>Live product data is unavailable right now (' + escapeHtml(error && error.message ? error.message : 'network error') + '). ' +
            'Please try again, or call <a href="tel:253-922-5793">253-922-5793</a> — a human answers.</p>' +
            '<button class="btn btn-primary alert-retry" id="retrySearchBtn" type="button">Try again</button>' +
            '</div></div>';
        var retry = byId('retrySearchBtn');
        if (retry) retry.addEventListener('click', function () { runSearch(); });
    }

    function priceHtml(product) {
        // Server-computed label ONLY (survives processProducts untouched).
        var label = product && typeof product.displayPriceLabel === 'string' && product.displayPriceLabel
            ? product.displayPriceLabel : null;
        if (label) return '<p class="pcard-price">' + escapeHtml(label) + '</p>';
        var href = '/product.html?style=' + encodeURIComponent(product.styleNumber || '');
        return '<a class="pcard-price-link" href="' + escapeHtml(href) + '">See pricing →</a>';
    }

    function buildCard(product) {
        var style = product.styleNumber || '';
        var images = product.images || {};
        var imageUrl = images.display || images.main || images.thumbnail || '';
        var colorCount = Array.isArray(product.colors) ? product.colors.length : 0;
        var productUrl = '/product.html?style=' + encodeURIComponent(style);
        var isTop = !!(product.features && product.features.isTopSeller);

        return '<article class="pcard" data-style="' + escapeHtml(style) + '">' +
            '<div class="pcard-media' + (imageUrl ? '' : ' no-img') + '">' +
            (isTop ? '<span class="pcard-flag">Best seller</span>' : '') +
            '<a class="pcard-media-link" href="' + escapeHtml(productUrl) + '" tabindex="-1" aria-hidden="true">' +
            (imageUrl ? '<img src="' + escapeHtml(imageUrl) + '" alt="" loading="lazy">' : '') +
            '</a>' +
            '<button class="pcard-quick" type="button" data-style="' + escapeHtml(style) + '">' +
            '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"/><circle cx="12" cy="12" r="3"/></svg>' +
            'Quick view<span class="sr-only">: ' + escapeHtml(style) + '</span></button>' +
            '</div>' +
            '<div class="pcard-body">' +
            (product.brand ? '<span class="pcard-brand">' + escapeHtml(product.brand) + '</span>' : '') +
            '<span class="pcard-style">' + escapeHtml(style) + '</span>' +
            '<h3 class="pcard-name"><a href="' + escapeHtml(productUrl) + '">' + escapeHtml(product.productName || style) + '</a></h3>' +
            '<p class="pcard-colors">' + (colorCount > 1 ? formatCount(colorCount) + ' colors' : ' ') + '</p>' +
            priceHtml(product) +
            '</div></article>';
    }

    function emptyStateHtml() {
        var actions = '';
        if (activeFilterCount() > 0 || state.q) {
            actions += '<button class="btn btn-primary js-clear-all" type="button">Clear all filters</button> ';
        }
        if (state.subcategory) {
            actions += '<button class="btn btn-ghost js-cat-jump" type="button" data-category="' + escapeHtml(state.category) + '">Show all ' + escapeHtml(state.category) + '</button>';
        }
        var popular = POPULAR_CATEGORIES.map(function (cat) {
            return '<a class="chip-btn js-cat-jump" data-category="' + escapeHtml(cat) + '" href="' + escapeHtml('/catalog?category=' + encodeURIComponent(cat)) + '">' + escapeHtml(cat) + '</a>';
        }).join(' ');

        return '<div class="empty-state">' +
            '<div class="empty-state-icon" aria-hidden="true">🔍</div>' +
            '<h3 class="empty-state-title">No products found</h3>' +
            '<p class="empty-state-sub">Try a different spelling or style number, remove a filter, or browse a popular category below.</p>' +
            '<p>' + actions + '</p>' +
            '<p class="empty-state-sub">' + popular + '</p>' +
            '</div>';
    }

    function renderNotices(results) {
        var html = '';
        var strategy = results && results.metadata && results.metadata.searchStrategy;
        if (strategy === 'subcategory-only' || strategy === 'category-only') {
            html += '<div class="alert alert-info">' +
                '<svg class="alert-icon" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path d="M10 0a10 10 0 100 20 10 10 0 000-20zm1 15H9v-6h2v6zm0-8H9V5h2v2z"/></svg>' +
                '<div class="alert-body"><p>No exact matches for that combination — showing broader results instead.</p></div></div>';
        }
        if (results && Array.isArray(results.smartFilters) && results.smartFilters.length) {
            var parts = results.smartFilters.map(function (f) {
                return escapeHtml(f.type) + ': <strong>' + escapeHtml(f.value) + '</strong>';
            }).join(' · ');
            html += '<div class="alert alert-info">' +
                '<svg class="alert-icon" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path d="M10 0a10 10 0 100 20 10 10 0 000-20zm1 15H9v-6h2v6zm0-8H9V5h2v2z"/></svg>' +
                '<div class="alert-body"><p>Smart search applied — ' + parts + '</p></div></div>';
        }
        html += decorationNoticesHtml();
        els.alertSlot.innerHTML = html;
    }

    /** Notices tied to the active ?method= filter (visible, never silent). */
    function decorationNoticesHtml() {
        if (!state.method) return '';
        var label = METHOD_LABELS[state.method] || state.method;
        if (deco.status === 'unavailable') {
            // Rules feed down — the filter could NOT be applied. Say so.
            return '<div class="alert alert-warn">' +
                '<svg class="alert-icon" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path d="M10 1 1 18h18L10 1zm1 13h-2v2h2v-2zm0-7h-2v5h2V7z"/></svg>' +
                '<div class="alert-body"><strong class="alert-title">Decoration filter unavailable</strong>' +
                '<p>These results are not narrowed to ' + escapeHtml(label) + ' right now. Each product page shows its available methods, or call <a href="tel:253-922-5793">253-922-5793</a>.</p></div></div>';
        }
        if (methodCategoryConflict()) {
            return '<div class="alert alert-info">' +
                '<svg class="alert-icon" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path d="M10 0a10 10 0 100 20 10 10 0 000-20zm1 15H9v-6h2v6zm0-8H9V5h2v2z"/></svg>' +
                '<div class="alert-body"><p>' + escapeHtml(label) + ' isn’t offered on ' + escapeHtml(state.category) +
                ' in our shop — remove the Decoration or Category filter to see results, or call <a href="tel:253-922-5793">253-922-5793</a>.</p></div></div>';
        }
        if (state.method === 'dtg') {
            return '<div class="alert alert-info">' +
                '<svg class="alert-icon" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path d="M10 0a10 10 0 100 20 10 10 0 000-20zm1 15H9v-6h2v6zm0-8H9V5h2v2z"/></svg>' +
                '<div class="alert-body"><p>Showing categories DTG can print — exact fabric suitability is shown on each product.</p></div></div>';
        }
        return '';
    }

    function renderResults(results) {
        els.grid.setAttribute('aria-busy', 'false');
        var rawProducts = (results && results.products) || [];
        // Safety net mirrored from the homepage: some rows are PRODUCT_STATUS
        // 'Active' but titled DISCONTINUED — never show those to customers.
        var products = rawProducts.filter(function (p) {
            var name = (p.productName || '').toUpperCase();
            var desc = (p.description || '').toUpperCase();
            return name.indexOf('DISCONTINUED') === -1 && desc.indexOf('DISCONTINUED') === -1;
        });
        var pagination = (results && results.pagination) || { page: 1, total: rawProducts.length, totalPages: 1, limit: rawProducts.length };
        var total = pagination.total != null ? pagination.total : rawProducts.length;

        lastShownProducts = products; // facet re-renders reuse the filtered set
        updateHeader(total);
        renderNotices(results);
        renderChips();
        renderFacets(lastFacets, products);

        if (!products.length) {
            els.grid.innerHTML = emptyStateHtml();
            els.pager.innerHTML = '';
            els.status.textContent = '0 products';
            return;
        }

        els.grid.innerHTML = products.map(buildCard).join('');
        renderPager(pagination);

        var pageNum = pagination.page || 1;
        var pageSize = pagination.limit || rawProducts.length;
        var start = (pageNum - 1) * pageSize + 1;
        var end = Math.min(start + rawProducts.length - 1, total);
        els.status.textContent = total > rawProducts.length
            ? 'Showing ' + formatCount(start) + '–' + formatCount(end) + ' of ' + formatCount(total) + ' products'
            : formatCount(total) + ' product' + (total === 1 ? '' : 's');
    }

    /* ── Pagination ──────────────────────────────────────────────── */

    function pageSequence(current, totalPages) {
        if (totalPages <= 7) {
            var all = [];
            for (var i = 1; i <= totalPages; i++) all.push(i);
            return all;
        }
        var seq = [1];
        if (current > 3) seq.push('gap');
        for (var p = Math.max(2, current - 1); p <= Math.min(totalPages - 1, current + 1); p++) seq.push(p);
        if (current < totalPages - 2) seq.push('gap');
        seq.push(totalPages);
        return seq;
    }

    function renderPager(pagination) {
        var totalPages = pagination.totalPages || 1;
        var current = pagination.page || 1;
        if (totalPages <= 1) { els.pager.innerHTML = ''; return; }

        var html = '';
        html += current > 1
            ? '<a class="pager-btn" data-page="' + (current - 1) + '" href="' + escapeHtml(urlForPatch({ page: current - 1 })) + '">← Prev</a>'
            : '<button class="pager-btn" type="button" disabled>← Prev</button>';

        pageSequence(current, totalPages).forEach(function (p) {
            if (p === 'gap') { html += '<span class="pager-gap" aria-hidden="true">…</span>'; return; }
            html += p === current
                ? '<a class="pager-btn is-current" aria-current="page" data-page="' + p + '" href="' + escapeHtml(urlForPatch({ page: p })) + '">' + p + '</a>'
                : '<a class="pager-btn" data-page="' + p + '" href="' + escapeHtml(urlForPatch({ page: p })) + '">' + p + '</a>';
        });

        html += current < totalPages
            ? '<a class="pager-btn" data-page="' + (current + 1) + '" href="' + escapeHtml(urlForPatch({ page: current + 1 })) + '">Next →</a>'
            : '<button class="pager-btn" type="button" disabled>Next →</button>';

        els.pager.innerHTML = html;
    }

    /* ── Applied-filter chips ────────────────────────────────────── */

    function chip(kind, label, type, value) {
        return '<span class="fchip"><span class="fchip-kind">' + escapeHtml(kind) + '</span> ' + escapeHtml(label) +
            '<button class="fchip-x" type="button" data-chip-type="' + escapeHtml(type) + '" data-chip-value="' + escapeHtml(value) + '"' +
            ' aria-label="Remove filter: ' + escapeHtml(kind + ' ' + label) + '">&times;</button></span>';
    }

    function renderChips() {
        var html = '';
        if (state.q) html += chip('Search', '“' + state.q + '”', 'q', '');
        if (state.category) html += chip('Category', state.category, 'category', '');
        if (state.subcategory) html += chip('Type', state.subcategory, 'subcategory', '');
        if (state.method) html += chip('Decoration', METHOD_LABELS[state.method] || state.method, 'method', '');
        state.brand.forEach(function (b) { html += chip('Brand', b, 'brand', b); });
        state.color.forEach(function (c) { html += chip('Color', c, 'color', c); });
        state.size.forEach(function (s) { html += chip('Size', s, 'size', s); });
        if (state.minPrice !== '' || state.maxPrice !== '') {
            var label = (state.minPrice !== '' ? '$' + state.minPrice : '$0') +
                ' – ' + (state.maxPrice !== '' ? '$' + state.maxPrice : 'up');
            html += chip('Price', label, 'price', '');
        }
        if (html) html += '<button class="fchip-clear js-clear-all" type="button">Clear all</button>';
        els.chips.innerHTML = html;

        var count = activeFilterCount();
        els.filtersOpenCount.hidden = count === 0;
        els.filtersOpenCount.textContent = String(count);
        els.clearAllFilters.hidden = count === 0 && !state.q;
    }

    function removeChip(type, value) {
        switch (type) {
            case 'q': navigate({ q: '' }); break;
            case 'category': navigate({ category: '', subcategory: '' }); break;
            case 'subcategory': navigate({ subcategory: '' }); break;
            case 'brand': navigate({ brand: state.brand.filter(function (v) { return v !== value; }) }); break;
            case 'color': navigate({ color: state.color.filter(function (v) { return v !== value; }) }); break;
            case 'size': navigate({ size: state.size.filter(function (v) { return v !== value; }) }); break;
            case 'price': navigate({ minPrice: '', maxPrice: '' }); break;
            case 'method': navigate({ method: '' }); break;
        }
    }

    function clearAll() {
        var sort = state.sort;
        state = defaultState();
        state.sort = sort;
        els.searchInput.value = '';
        window.history.pushState({ nwcaCatalog: true }, '', urlFromState(state));
        runSearch();
    }

    /* ── Facet rail ──────────────────────────────────────────────── */

    function optionRow(group, inputType, value, label, count, checked, disabled) {
        var name = 'f-' + group;
        return '<li><label class="fopt' + (disabled ? ' is-disabled' : '') + '"' +
            (disabled ? ' title="Temporarily unavailable"' : '') + '>' +
            '<input type="' + inputType + '" name="' + name + '" value="' + escapeHtml(value) + '"' +
            (checked ? ' checked' : '') + (disabled ? ' disabled' : '') + '>' +
            '<span class="fopt-label">' + escapeHtml(label) + '</span>' +
            (count != null ? '<span class="fopt-count">' + formatCount(count) + '</span>' : '') +
            '</label></li>';
    }

    function facetGroup(key, title, rowsHtml, opts) {
        opts = opts || {};
        var expanded = !!railUI.expanded[key];
        return '<fieldset class="fgroup' + (expanded ? ' expanded' : '') + '" data-group="' + key + '">' +
            '<legend class="fgroup-title">' + escapeHtml(title) + '</legend>' +
            (opts.note ? '<p class="fgroup-note">' + escapeHtml(opts.note) + '</p>' : '') +
            (opts.searchable ? '<div class="fgroup-search"><input type="search" data-fsearch="' + key + '" placeholder="Find a ' + escapeHtml(title.toLowerCase()) + '…" aria-label="Find a ' + escapeHtml(title.toLowerCase()) + '" value="' + escapeHtml(railUI.brandQuery) + '"></div>' : '') +
            '<ul class="fopts" role="list">' + rowsHtml + '</ul>' +
            (opts.overflowCount ? '<button class="fgroup-more" type="button" data-more="' + key + '">' + (expanded ? 'Show fewer' : 'Show all (' + opts.overflowCount + ')') + '</button>' : '') +
            (opts.extraHtml || '') +
            '</fieldset>';
    }

    function listWithOverflow(items, visibleMax) {
        // items: array of { html, pinned } — pinned (checked) options always visible
        var visible = 0, overflow = 0, html = '';
        items.forEach(function (item) {
            var show = item.pinned || visible < visibleMax;
            if (show) visible++;
            else overflow++;
            html += show ? item.html : item.html.replace('<li>', '<li class="is-overflow">');
        });
        return { html: html, overflow: overflow };
    }

    function colorSizeOptions(products, field) {
        var counts = {};
        (products || []).forEach(function (p) {
            if (field === 'color') {
                (p.colors || []).forEach(function (c) {
                    if (c && c.name) counts[c.name] = (counts[c.name] || 0) + 1;
                });
            } else {
                (p.sizes || []).forEach(function (s) {
                    if (s) counts[s] = (counts[s] || 0) + 1;
                });
            }
        });
        // Currently-applied values stay listed even when absent from this page
        state[field].forEach(function (v) { if (!(v in counts)) counts[v] = null; });
        var names = Object.keys(counts);
        if (field === 'size') {
            names.sort(function (a, b) {
                var ai = SIZE_ORDER.indexOf(a), bi = SIZE_ORDER.indexOf(b);
                if (ai !== -1 && bi !== -1) return ai - bi;
                if (ai !== -1) return -1;
                if (bi !== -1) return 1;
                return a.localeCompare(b);
            });
        } else {
            names.sort(function (a, b) { return (counts[b] || 0) - (counts[a] || 0) || a.localeCompare(b); });
        }
        return names.map(function (name) { return { name: name, count: counts[name] }; });
    }

    /** "Decoration" facet group — radio single-select over the 4 methods. */
    function decorationGroupHtml() {
        var disabled = deco.status !== 'ready';
        var note;
        if (deco.status === 'unavailable') {
            note = 'Temporarily unavailable — every product page still shows its decoration options.';
        } else if (deco.status === 'loading') {
            note = 'Loading decoration options…';
        } else {
            note = 'Methods we run in-house. Fabric fit is confirmed on each product.';
        }
        var rows = optionRow('method', 'radio', '', 'All methods', null, !state.method, disabled);
        METHOD_VALUES.forEach(function (m) {
            rows += optionRow('method', 'radio', m, METHOD_LABELS[m], null, state.method === m, disabled);
        });
        return facetGroup('method', 'Decoration', rows, { note: note });
    }

    function renderFacets(facets, products) {
        var html = '';

        // Category (single-select)
        var categories = (facets && facets.categories) || [];
        if (categories.length || state.category) {
            var catItems = [{
                html: optionRow('category', 'radio', '', 'All categories', null, !state.category),
                pinned: true
            }];
            var seen = {};
            categories.forEach(function (c) {
                seen[c.name] = true;
                catItems.push({
                    html: optionRow('category', 'radio', c.name, c.name, c.count, state.category === c.name),
                    pinned: state.category === c.name
                });
            });
            if (state.category && !seen[state.category]) {
                catItems.splice(1, 0, {
                    html: optionRow('category', 'radio', state.category, state.category, null, true),
                    pinned: true
                });
            }
            var catList = listWithOverflow(catItems, 9);
            html += facetGroup('category', 'Category', catList.html, { overflowCount: catList.overflow || 0 });
        }

        // Decoration method (single-select, from the shared rules feed).
        // Rules unavailable → disabled with a note, never hidden silently.
        html += decorationGroupHtml();

        // Subcategory (taxonomy from app-modern.js's CATEGORY_DATA — the same
        // source the mega-menu uses; the API returns no subcategory facets)
        var taxonomy = window.CATEGORY_DATA || {};
        if (state.category && Array.isArray(taxonomy[state.category]) && taxonomy[state.category].length) {
            var subItems = [{
                html: optionRow('subcategory', 'radio', '', 'All ' + state.category, null, !state.subcategory),
                pinned: true
            }];
            var subSeen = {};
            taxonomy[state.category].forEach(function (sub) {
                subSeen[sub] = true;
                subItems.push({
                    html: optionRow('subcategory', 'radio', sub, sub, null, state.subcategory === sub),
                    pinned: state.subcategory === sub
                });
            });
            if (state.subcategory && !subSeen[state.subcategory]) {
                subItems.splice(1, 0, { html: optionRow('subcategory', 'radio', state.subcategory, state.subcategory, null, true), pinned: true });
            }
            var subList = listWithOverflow(subItems, 9);
            html += facetGroup('subcategory', 'Type', subList.html, { overflowCount: subList.overflow || 0 });
        }

        // Brand (multi-select)
        var brands = (facets && facets.brands) || [];
        if (brands.length || state.brand.length) {
            var brandItems = [];
            var brandSeen = {};
            brands.forEach(function (b) {
                brandSeen[b.name] = true;
                brandItems.push({
                    html: optionRow('brand', 'checkbox', b.name, b.name, b.count, state.brand.indexOf(b.name) !== -1),
                    pinned: state.brand.indexOf(b.name) !== -1
                });
            });
            state.brand.forEach(function (b) {
                if (!brandSeen[b]) brandItems.unshift({ html: optionRow('brand', 'checkbox', b, b, null, true), pinned: true });
            });
            var brandList = listWithOverflow(brandItems, 10);
            html += facetGroup('brand', 'Brand', brandList.html, {
                searchable: brandItems.length > 10,
                overflowCount: brandList.overflow || 0
            });
        }

        // Price (buckets from facets + custom range)
        var ranges = (facets && facets.priceRanges) || [];
        var anyBucketChecked = false;
        var priceRows = ranges.map(function (r) {
            var value = (r.min != null ? r.min : '') + '|' + (r.max != null ? r.max : '');
            var checked = String(state.minPrice) === String(r.min != null ? r.min : '') &&
                String(state.maxPrice) === String(r.max != null ? r.max : '');
            if (checked) anyBucketChecked = true;
            return optionRow('price', 'radio', value, r.label, r.count, checked);
        }).join('');
        if (ranges.length || state.minPrice !== '' || state.maxPrice !== '') {
            priceRows = optionRow('price', 'radio', '|', 'Any price', null,
                !anyBucketChecked && state.minPrice === '' && state.maxPrice === '') + priceRows;
            var customHtml = '<div class="fprice-custom">' +
                '<input type="number" min="0" step="1" inputmode="numeric" id="fPriceMin" aria-label="Minimum price, dollars" placeholder="Min" value="' + escapeHtml(state.minPrice) + '">' +
                '<span class="fprice-sep" aria-hidden="true">–</span>' +
                '<input type="number" min="0" step="1" inputmode="numeric" id="fPriceMax" aria-label="Maximum price, dollars" placeholder="Max" value="' + escapeHtml(state.maxPrice) + '">' +
                '<button class="fprice-apply" type="button" id="fPriceApply">Go</button>' +
                '</div>';
            html += facetGroup('price', 'Garment price', priceRows, {
                note: 'Blank-garment price, before decoration.',
                extraHtml: customHtml
            });
        }

        // Color + Size (live union of the current results — the API exposes
        // color/size FILTERS but no color/size facet counts)
        var colorOpts = colorSizeOptions(products, 'color');
        if (colorOpts.length) {
            var colorItems = colorOpts.map(function (o) {
                return {
                    html: optionRow('color', 'checkbox', o.name, o.name, o.count, state.color.indexOf(o.name) !== -1),
                    pinned: state.color.indexOf(o.name) !== -1
                };
            });
            var colorList = listWithOverflow(colorItems, 10);
            html += facetGroup('color', 'Color', colorList.html, {
                note: 'Colors available in these results.',
                overflowCount: colorList.overflow || 0
            });
        }
        var sizeOpts = colorSizeOptions(products, 'size');
        if (sizeOpts.length) {
            var sizeItems = sizeOpts.map(function (o) {
                return {
                    html: optionRow('size', 'checkbox', o.name, o.name, o.count, state.size.indexOf(o.name) !== -1),
                    pinned: state.size.indexOf(o.name) !== -1
                };
            });
            var sizeList = listWithOverflow(sizeItems, 10);
            html += facetGroup('size', 'Size', sizeList.html, { overflowCount: sizeList.overflow || 0 });
        }

        els.filterGroups.innerHTML = html ||
            '<p class="fgroup-note">Filters appear once the catalog loads.</p>';

        applyBrandSearchFilter();
        var priceApply = byId('fPriceApply');
        if (priceApply) priceApply.addEventListener('click', applyCustomPrice);
    }

    function applyCustomPrice() {
        var minEl = byId('fPriceMin');
        var maxEl = byId('fPriceMax');
        var min = minEl && minEl.value !== '' ? String(Math.max(0, parseFloat(minEl.value) || 0)) : '';
        var max = maxEl && maxEl.value !== '' ? String(Math.max(0, parseFloat(maxEl.value) || 0)) : '';
        navigate({ minPrice: min, maxPrice: max });
    }

    function applyBrandSearchFilter() {
        var input = els.filterGroups.querySelector('[data-fsearch="brand"]');
        if (!input) return;
        var apply = function () {
            railUI.brandQuery = input.value.trim().toLowerCase();
            var group = input.closest('.fgroup');
            group.classList.toggle('expanded', !!railUI.brandQuery || !!railUI.expanded.brand);
            group.querySelectorAll('.fopts li').forEach(function (li) {
                var label = li.textContent.toLowerCase();
                li.style.display = !railUI.brandQuery || label.indexOf(railUI.brandQuery) !== -1 ? '' : 'none';
            });
        };
        input.addEventListener('input', apply);
        if (railUI.brandQuery) apply();
    }

    function onFilterChange(e) {
        var input = e.target;
        if (!input || !input.name || input.name.indexOf('f-') !== 0) return;
        var group = input.name.slice(2);
        var value = input.value;

        switch (group) {
            case 'category':
                navigate({ category: value, subcategory: '' });
                break;
            case 'subcategory':
                navigate({ subcategory: value });
                break;
            case 'brand':
            case 'color':
            case 'size': {
                var arr = state[group].slice();
                var idx = arr.indexOf(value);
                if (input.checked && idx === -1) arr.push(value);
                if (!input.checked && idx !== -1) arr.splice(idx, 1);
                var patch = {};
                patch[group] = arr;
                navigate(patch);
                break;
            }
            case 'price': {
                var parts = value.split('|');
                navigate({ minPrice: parts[0] || '', maxPrice: parts[1] || '' });
                break;
            }
            case 'method':
                navigate({ method: value });
                break;
        }
    }

    /* ── Mobile filter drawer + browse drawer chrome ─────────────── */

    function updateScrollLock() {
        var locked = els.sidebar.classList.contains('show') ||
            els.filtersRail.classList.contains('show') ||
            !els.qvModal.hidden;
        document.body.classList.toggle('drawer-open', locked);
    }

    function openFilters() {
        els.filtersRail.classList.add('show');
        els.filtersOverlay.classList.add('show');
        els.filtersOpen.setAttribute('aria-expanded', 'true');
        updateScrollLock();
    }

    function closeFilters() {
        els.filtersRail.classList.remove('show');
        els.filtersOverlay.classList.remove('show');
        els.filtersOpen.setAttribute('aria-expanded', 'false');
        updateScrollLock();
    }

    function closeBrowseDrawer() {
        els.sidebar.classList.remove('show');
        els.sidebarOverlay.classList.remove('show');
        updateScrollLock();
    }

    function closeMegaDropdown(fromEl) {
        var dropdown = fromEl && fromEl.closest ? fromEl.closest('.nav-dropdown') : null;
        if (!dropdown) return;
        dropdown.style.opacity = '0';
        dropdown.style.visibility = 'hidden';
        dropdown.style.pointerEvents = 'none';
        setTimeout(function () {
            dropdown.style.opacity = '';
            dropdown.style.visibility = '';
            dropdown.style.pointerEvents = '';
        }, 350);
    }

    /* ── Quick view modal ────────────────────────────────────────── */

    var qvTriggerEl = null;
    var qvProduct = null;

    async function openQuickView(styleNumber, triggerEl) {
        qvTriggerEl = triggerEl || null;
        els.qvTitle.textContent = 'Quick view';
        els.qvBody.innerHTML = '<p class="qv-loading">Loading product…</p>';
        els.qvModal.hidden = false;
        updateScrollLock();
        els.qvClose.focus();

        var product = null;
        if (lastResults && Array.isArray(lastResults.products)) {
            product = lastResults.products.find(function (p) { return p.styleNumber === styleNumber; }) || null;
        }
        if (!product) {
            try {
                var result = await service.searchByStyle(styleNumber);
                if (result && result.products && result.products.length) product = result.products[0];
            } catch (error) {
                console.error('[Catalog] Quick view fetch failed:', error);
            }
        }
        if (els.qvModal.hidden) return; // closed while loading
        if (!product) {
            els.qvBody.innerHTML = '<div class="alert alert-error" role="alert">' +
                '<div class="alert-body"><strong class="alert-title">Product unavailable</strong>' +
                '<p>We couldn’t load ' + escapeHtml(styleNumber) + ' right now. Please try again.</p></div></div>';
            return;
        }

        qvProduct = product;
        renderQuickView(product);
    }

    function qvProductUrl(product, colorName) {
        var url = '/product.html?style=' + encodeURIComponent(product.styleNumber || '');
        if (colorName) url += '&color=' + encodeURIComponent(colorName);
        return url;
    }

    function renderQuickView(product) {
        var colors = Array.isArray(product.colors) ? product.colors : [];
        var selected = colors.length ? colors[0] : null;
        var images = product.images || {};
        var imageUrl = (selected && selected.productImageUrl) || images.display || images.main || images.thumbnail || '';
        var priceLabel = typeof product.displayPriceLabel === 'string' && product.displayPriceLabel ? product.displayPriceLabel : null;

        els.qvTitle.textContent = (product.styleNumber || '') + ' — ' + (product.productName || 'Quick view');

        var swatches = colors.map(function (c, i) {
            var swatchImg = c.swatchUrl
                ? '<img src="' + escapeHtml(c.swatchUrl) + '" alt="" loading="lazy">'
                : '';
            return '<button class="qv-swatch' + (i === 0 ? ' selected' : '') + '" type="button" data-color-index="' + i + '"' +
                ' aria-label="Color: ' + escapeHtml(c.name || '') + '" title="' + escapeHtml(c.name || '') + '">' + swatchImg + '</button>';
        }).join('');

        els.qvBody.innerHTML =
            '<div class="qv-grid">' +
            '<div class="qv-media" id="qvMedia">' + (imageUrl ? '<img id="qvImage" src="' + escapeHtml(imageUrl) + '" alt="' + escapeHtml(product.productName || '') + '">' : '') + '</div>' +
            '<div>' +
            '<p class="qv-style">' + escapeHtml(product.styleNumber || '') + '</p>' +
            '<h3 class="qv-name">' + escapeHtml(product.productName || '') + '</h3>' +
            (priceLabel
                ? '<p class="qv-price">' + escapeHtml(priceLabel) + '</p>'
                : '<a class="qv-price-link" id="qvPricingLink" href="' + escapeHtml(qvProductUrl(product, selected && selected.name)) + '">See pricing →</a>') +
            (product.sizes && product.sizes.length
                ? '<div class="qv-section"><h3>Sizes</h3><p class="qv-sizes">' + escapeHtml(product.sizes.join(' · ')) + '</p></div>'
                : '') +
            (colors.length
                ? '<div class="qv-section"><h3>Color: <span class="qv-selected-color" id="qvColorName">' + escapeHtml(selected.name || '') + '</span></h3>' +
                  '<div class="qv-swatches" id="qvSwatches">' + swatches + '</div></div>'
                : '') +
            (product.description
                ? '<div class="qv-section"><h3>Description</h3><p class="qv-desc">' + escapeHtml(product.description) + '</p></div>'
                : '') +
            '<div class="qv-actions">' +
            '<a class="btn btn-primary" id="qvDetailsLink" href="' + escapeHtml(qvProductUrl(product, selected && selected.name)) + '">View full product details</a>' +
            '</div>' +
            '</div></div>';

        var swatchWrap = byId('qvSwatches');
        if (swatchWrap) {
            swatchWrap.addEventListener('click', function (e) {
                var btn = e.target.closest('.qv-swatch');
                if (!btn) return;
                selectQuickViewColor(parseInt(btn.getAttribute('data-color-index'), 10));
            });
        }
    }

    function selectQuickViewColor(index) {
        if (!qvProduct || !Array.isArray(qvProduct.colors)) return;
        var color = qvProduct.colors[index];
        if (!color) return;

        var nameEl = byId('qvColorName');
        if (nameEl) nameEl.textContent = color.name || '';

        var img = byId('qvImage');
        if (img && color.productImageUrl) img.src = color.productImageUrl;

        var details = byId('qvDetailsLink');
        if (details) details.href = qvProductUrl(qvProduct, color.name);
        var pricing = byId('qvPricingLink');
        if (pricing) pricing.href = qvProductUrl(qvProduct, color.name);

        document.querySelectorAll('#qvSwatches .qv-swatch').forEach(function (sw, i) {
            sw.classList.toggle('selected', i === index);
        });
    }

    function closeQuickView() {
        if (els.qvModal.hidden) return;
        els.qvModal.hidden = true;
        qvProduct = null;
        updateScrollLock();
        if (qvTriggerEl && document.contains(qvTriggerEl)) qvTriggerEl.focus();
        qvTriggerEl = null;
    }

    function trapModalFocus(e) {
        if (e.key !== 'Tab' || els.qvModal.hidden) return;
        var focusables = els.qvModal.querySelectorAll('a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])');
        if (!focusables.length) return;
        var first = focusables[0];
        var last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
            e.preventDefault(); last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault(); first.focus();
        }
    }

    /* ── Autocomplete v2 (thumbnails + style numbers) ────────────── */

    var acState = { items: [], index: -1, open: false, seq: 0, suppressBlurClose: false };

    function acClose() {
        acState.open = false;
        acState.index = -1;
        els.acList.classList.remove('active');
        els.acList.innerHTML = '';
        els.searchInput.setAttribute('aria-expanded', 'false');
        els.searchInput.removeAttribute('aria-activedescendant');
    }

    function acOpen(html) {
        els.acList.innerHTML = html;
        els.acList.classList.add('active');
        acState.open = true;
        els.searchInput.setAttribute('aria-expanded', 'true');
    }

    function acThumb(item) {
        return item.thumb
            ? '<span class="ac-thumb"><img src="' + escapeHtml(item.thumb) + '" alt="" loading="lazy"></span>'
            : '<span class="ac-thumb" aria-hidden="true"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M16 3l5 3-2 4-2-1v12H7V9L5 10 3 6l5-3a4 4 0 0 0 8 0z"/></svg></span>';
    }

    function acRender() {
        if (!acState.items.length) {
            acOpen('<div class="ac-status">No matches — press Enter to search the full catalog.</div>');
            return;
        }
        var html = '<div class="ac-list">' + acState.items.map(function (item, i) {
            return '<div class="autocomplete-item" id="acOpt' + i + '" role="option" aria-selected="' + (i === acState.index) + '"' +
                ' data-index="' + i + '" data-style="' + escapeHtml(item.styleNumber) + '">' +
                acThumb(item) +
                '<span class="ac-main">' +
                '<span class="suggestion-style-number">' + escapeHtml(item.styleNumber) +
                (item.exact ? '<span class="suggestion-badge">Exact match</span>' : '') + '</span>' +
                '<span class="ac-name">' + escapeHtml(item.productName || '') + '</span>' +
                (item.colorCount > 1 ? '<span class="ac-colors">' + formatCount(item.colorCount) + ' colors</span>' : '') +
                '</span></div>';
        }).join('') + '</div>' +
            '<div class="autocomplete-footer">Press <kbd>Enter</kbd> for all results · <kbd>Esc</kbd> to close</div>';
        acOpen(html);
    }

    function acMove(delta) {
        if (!acState.open || !acState.items.length) return;
        acState.index += delta;
        if (acState.index < 0) acState.index = acState.items.length - 1;
        if (acState.index >= acState.items.length) acState.index = 0;
        els.acList.querySelectorAll('.autocomplete-item').forEach(function (el, i) {
            var sel = i === acState.index;
            el.classList.toggle('selected', sel);
            el.setAttribute('aria-selected', String(sel));
            if (sel) el.scrollIntoView({ block: 'nearest' });
        });
        els.searchInput.setAttribute('aria-activedescendant', 'acOpt' + acState.index);
    }

    async function acFetch(query) {
        var seq = ++acState.seq;
        var isStyle = service.isStyleNumber(query);
        var upperQuery = query.toUpperCase();

        var stylePromise = isStyle
            ? fetch('/api/stylesearch?term=' + encodeURIComponent(query))
                .then(function (r) { return r.ok ? r.json() : []; })
                .catch(function () { return []; })
            : Promise.resolve([]);
        var productPromise = service.searchProducts({ q: query, limit: 10, status: '' })
            .catch(function () { return null; });

        var settled = await Promise.all([stylePromise, productPromise]);
        if (seq !== acState.seq) return;

        var styleHits = settled[0] || [];
        var productHits = (settled[1] && settled[1].products) || [];

        var byStyle = {};
        var items = [];

        styleHits.forEach(function (hit) {
            if (!hit || !hit.value) return;
            var upper = String(hit.value).toUpperCase();
            if (byStyle[upper]) return;
            var item = {
                styleNumber: hit.value,
                productName: hit.label || '',
                thumb: '',
                colorCount: 0,
                exact: upper === upperQuery,
                priority: upper === upperQuery ? 0 : (upper.indexOf(upperQuery) === 0 ? 1 : 2)
            };
            byStyle[upper] = item;
            items.push(item);
        });

        productHits.forEach(function (p) {
            if (!p || !p.styleNumber) return;
            var upper = String(p.styleNumber).toUpperCase();
            var thumb = (p.images && (p.images.thumbnail || p.images.display || p.images.main)) ||
                (p.colors && p.colors[0] && p.colors[0].productImageThumbnail) || '';
            if (byStyle[upper]) {
                byStyle[upper].thumb = byStyle[upper].thumb || thumb;
                byStyle[upper].colorCount = Array.isArray(p.colors) ? p.colors.length : 0;
                if (!byStyle[upper].productName) byStyle[upper].productName = p.productName || '';
            } else {
                var exact = upper === upperQuery;
                var item = {
                    styleNumber: p.styleNumber,
                    productName: p.productName || '',
                    thumb: thumb,
                    colorCount: Array.isArray(p.colors) ? p.colors.length : 0,
                    exact: exact,
                    priority: exact ? 0 : (upper.indexOf(upperQuery) === 0 ? 1 : 3)
                };
                byStyle[upper] = item;
                items.push(item);
            }
        });

        items.sort(function (a, b) {
            return a.priority - b.priority || a.styleNumber.localeCompare(b.styleNumber);
        });
        acState.items = items.slice(0, 8);
        acState.index = -1;
        acRender();
    }

    var acFetchDebounced = debounce(function (query) { acFetch(query); }, 250);

    function submitSearch(query) {
        acClose();
        var sort = state.sort;
        state = defaultState();
        state.q = query;
        state.sort = sort;
        window.history.pushState({ nwcaCatalog: true }, '', urlFromState(state));
        runSearch();
    }

    function wireAutocomplete() {
        els.searchInput.addEventListener('input', function () {
            var query = els.searchInput.value.trim();
            if (query.length < 2) { acClose(); return; }
            acOpen('<div class="ac-status">Searching…</div>');
            acState.items = [];
            acFetchDebounced(query);
        });

        els.searchInput.addEventListener('keydown', function (e) {
            switch (e.key) {
                case 'ArrowDown': e.preventDefault(); acMove(1); break;
                case 'ArrowUp': e.preventDefault(); acMove(-1); break;
                case 'Enter': {
                    e.preventDefault();
                    if (acState.open && acState.index >= 0 && acState.items[acState.index]) {
                        window.location.href = '/product.html?style=' + encodeURIComponent(acState.items[acState.index].styleNumber);
                    } else if (els.searchInput.value.trim().length >= 2) {
                        submitSearch(els.searchInput.value.trim());
                    }
                    break;
                }
                case 'Escape':
                    if (acState.open) { e.stopPropagation(); acClose(); }
                    break;
                case 'Tab': acClose(); break;
            }
        });

        els.searchInput.addEventListener('blur', function () {
            setTimeout(function () {
                if (!acState.suppressBlurClose) acClose();
                acState.suppressBlurClose = false;
            }, 150);
        });

        els.acList.addEventListener('mousedown', function (e) {
            var item = e.target.closest('.autocomplete-item');
            if (!item) { acState.suppressBlurClose = true; return; }
            e.preventDefault();
            window.location.href = '/product.html?style=' + encodeURIComponent(item.getAttribute('data-style') || '');
        });

        els.searchBtn.addEventListener('click', function () {
            var query = els.searchInput.value.trim();
            if (query.length >= 2) submitSearch(query);
        });
    }

    /* ── Chrome navigation intercepts (drawer / mega-nav / brands) ── */

    function wireChromeNavigation() {
        document.addEventListener('click', function (e) {
            // Drawer category links (built by app-modern.js)
            var catLink = e.target.closest('.category-link');
            if (catLink && catLink.dataset.category) {
                e.preventDefault();
                closeBrowseDrawer();
                navigate({ q: '', category: catLink.dataset.category, subcategory: '', brand: [], color: [], size: [], minPrice: '', maxPrice: '', method: '' });
                els.searchInput.value = '';
                return;
            }

            // Drawer flyout items (category + optional subcategory)
            var flyout = e.target.closest('.flyout-item');
            if (flyout && flyout.dataset.category) {
                e.preventDefault();
                closeBrowseDrawer();
                var fly = document.getElementById('categoryFlyout');
                if (fly) fly.classList.remove('show');
                navigate({ q: '', category: flyout.dataset.category, subcategory: flyout.dataset.subcategory || '', brand: [], color: [], size: [], minPrice: '', maxPrice: '', method: '' });
                els.searchInput.value = '';
                return;
            }

            // Mega-dropdown subcategory links (built by app-modern.js)
            var subLink = e.target.closest('.nav-subcategory-link');
            if (subLink && subLink.dataset.category) {
                e.preventDefault();
                closeMegaDropdown(subLink);
                navigate({ q: '', category: subLink.dataset.category, subcategory: subLink.dataset.subcategory || '', brand: [], color: [], size: [], minPrice: '', maxPrice: '', method: '' });
                els.searchInput.value = '';
                return;
            }

            // Brands flyout links (brands-flyout.js renders /?brand=X — keep
            // the user on /catalog with the same brand filter)
            var brandLink = e.target.closest('#navBrandsGrid .brand-link');
            if (brandLink) {
                var brandName = '';
                try {
                    brandName = new URL(brandLink.href, window.location.origin).searchParams.get('brand') || '';
                } catch (err) { brandName = ''; }
                if (brandName) {
                    e.preventDefault();
                    closeMegaDropdown(brandLink);
                    navigate({ q: '', category: '', subcategory: '', brand: [brandName], color: [], size: [], minPrice: '', maxPrice: '', method: '' });
                    els.searchInput.value = '';
                }
                return;
            }
        });
    }

    /* ── Page wiring ─────────────────────────────────────────────── */

    function syncControls() {
        els.searchInput.value = state.q;
        els.sortSelect.value = SORT_VALUES.indexOf(state.sort) !== -1 ? state.sort : '';
    }

    function wirePage() {
        // Sort
        els.sortSelect.addEventListener('change', function () {
            navigate({ sort: els.sortSelect.value });
        });

        // Filter rail (delegated)
        els.filterGroups.addEventListener('change', onFilterChange);
        els.filterGroups.addEventListener('click', function (e) {
            var more = e.target.closest('.fgroup-more');
            if (!more) return;
            var key = more.getAttribute('data-more');
            railUI.expanded[key] = !railUI.expanded[key];
            var group = more.closest('.fgroup');
            group.classList.toggle('expanded', railUI.expanded[key]);
            more.textContent = railUI.expanded[key] ? 'Show fewer' : 'Show all';
        });
        els.clearAllFilters.addEventListener('click', clearAll);

        // Chips + grid actions (delegated)
        els.chips.addEventListener('click', function (e) {
            var x = e.target.closest('.fchip-x');
            if (x) { removeChip(x.getAttribute('data-chip-type'), x.getAttribute('data-chip-value')); return; }
            if (e.target.closest('.js-clear-all')) clearAll();
        });
        els.grid.addEventListener('click', function (e) {
            var quick = e.target.closest('.pcard-quick');
            if (quick) {
                e.preventDefault();
                openQuickView(quick.getAttribute('data-style'), quick);
                return;
            }
            var jump = e.target.closest('.js-cat-jump');
            if (jump) {
                e.preventDefault();
                navigate({ q: '', category: jump.getAttribute('data-category') || '', subcategory: '', brand: [], color: [], size: [], minPrice: '', maxPrice: '', method: '' });
                els.searchInput.value = '';
                return;
            }
            if (e.target.closest('.js-clear-all')) { e.preventDefault(); clearAll(); }
        });

        // Pagination (delegated; real links stay middle-clickable)
        els.pager.addEventListener('click', function (e) {
            var link = e.target.closest('a.pager-btn');
            if (!link) return;
            if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
            e.preventDefault();
            var page = parseInt(link.getAttribute('data-page'), 10);
            if (isFinite(page) && page !== state.page) {
                navigate({ page: page }, { scrollTop: true });
            }
        });

        // Breadcrumb intermediate links (category landing inside subcategory)
        els.crumbs.addEventListener('click', function (e) {
            var link = e.target.closest('.js-crumb-link');
            if (!link) return;
            e.preventDefault();
            navigate({ subcategory: '' });
        });

        // Mobile filter drawer
        els.filtersOpen.addEventListener('click', openFilters);
        els.filtersClose.addEventListener('click', closeFilters);
        els.filtersOverlay.addEventListener('click', closeFilters);

        // Browse drawer close (open + overlay-close handled by app-modern.js)
        els.drawerClose.addEventListener('click', closeBrowseDrawer);
        new MutationObserver(updateScrollLock)
            .observe(els.sidebar, { attributes: true, attributeFilter: ['class'] });

        // Quick view
        els.qvClose.addEventListener('click', closeQuickView);
        els.qvModal.addEventListener('click', function (e) {
            if (e.target === els.qvModal) closeQuickView();
        });
        els.qvModal.addEventListener('keydown', trapModalFocus);

        // Escape priority: quick view → filter drawer → browse drawer
        document.addEventListener('keydown', function (e) {
            if (e.key !== 'Escape') return;
            if (!els.qvModal.hidden) { closeQuickView(); return; }
            if (els.filtersRail.classList.contains('show')) { closeFilters(); return; }
            if (els.sidebar.classList.contains('show')) closeBrowseDrawer();
        });

        // Broken-image fallback (error events don't bubble — capture phase)
        document.addEventListener('error', function (e) {
            var img = e.target;
            if (!img || img.tagName !== 'IMG') return;
            var media = img.closest('.pcard-media, .ac-thumb, .qv-media');
            if (!media) return;
            img.remove();
            if (media.classList.contains('pcard-media')) media.classList.add('no-img');
        }, true);

        // Back/forward restores prior state
        window.addEventListener('popstate', function () {
            state = stateFromUrl();
            syncControls();
            runSearch();
        });

        wireAutocomplete();
        wireChromeNavigation();
    }

    function init() {
        if (!window.ProductSearchService) {
            console.error('[Catalog] ProductSearchService missing — cannot start');
            return;
        }
        state = stateFromUrl();
        syncControls();
        wirePage();
        runSearch(); // landing with params searches immediately; bare /catalog browses page 1

        // Warm the decoration rules and refresh the rail once they settle so
        // the Decoration group flips from "Loading…" to enabled/disabled.
        loadDecoRules().then(function () {
            if (lastResults) renderFacets(lastFacets, lastShownProducts);
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
