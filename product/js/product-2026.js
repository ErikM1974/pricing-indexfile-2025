/**
 * product-2026.js — rebuilt product detail page (root /product.html)
 * on the NWCA 2026 design system.
 *
 * Data flows (all live API, never hardcoded prices — Erik's #1 rule):
 *   - /api/product-details?styleNumber=X   product info, per-color images + swatches
 *   - /api/sanmar/inventory/:style         live warehouse stock (CATALOG_COLOR keyed)
 *   - /api/products/search?category=...    related products
 *   - Decoration pricing via the SAME shared pricing services the
 *     calculators / quote builders use (formula source of truth):
 *       EmbroideryPricingService, CapEmbroideryPricingService,
 *       DTGPricingService, ScreenPrintPricingService, DTFPricingService
 *   - Decoration METHOD ELIGIBILITY via shared DecorationMethods module
 *     (/api/decoration-methods): only producible tabs render; DTG cotton
 *     gate ('warn' → inline blend note, 'no' → tab absent); rules
 *     unavailable → embroidery-only tabs + visible alert-warn (methodAlert).
 *     Caps branch unchanged.
 *
 * URL contract (preserved from the legacy /product app):
 *   ?style= | ?StyleNumber=    style number (required)
 *   ?color= | ?COLOR=          COLOR_NAME (display) — CATALOG_COLOR also accepted
 */
(function () {
    'use strict';

    const API_BASE = (window.APP_CONFIG && window.APP_CONFIG.API && window.APP_CONFIG.API.BASE_URL)
        || 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';
    const SALES_EMAIL = 'sales@nwcustomapparel.com';
    const LOW_STOCK_QTY = 24; // below one standard order tier = "low stock"
    const SANMAR_CDN_FALLBACK = 'https://cdnm.sanmar.com/catalog/images/';

    const GALLERY_VIEWS = [
        ['front_model', 'Front'],
        ['back_model', 'Back'],
        ['front_flat', 'Flat front'],
        ['back_flat', 'Flat back']
    ];

    const SIZE_ORDER = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', '2XL', '3XL', '4XL', '5XL', '6XL',
        'LT', 'XLT', '2XLT', '3XLT', '4XLT', 'S/M', 'M/L', 'L/XL', 'XL/2XL', 'OSFA', 'ONE SIZE', 'ADJ'];

    // ============================================================
    // STATE
    // ============================================================
    const state = {
        style: null,
        product: null,      // { title, name, brand, category, subcategory, description, status, fallbackImage }
        colors: [],         // [{ name, catalog, swatch, images:{view:url}, productImage }]
        selected: null,
        view: 'front_model',
        isCap: false,
        inventoryRows: null, // raw rows from /api/sanmar/inventory (all colors)
        qty: 24,
        decoration: null,   // DecorationMethods.eligibleFor() result (garments only)
        methods: [],        // [{ id, label, loader }]
        panels: {},         // id -> { status: idle|loading|ready|error, data }
        activeTab: null
    };

    // ============================================================
    // UTILS
    // ============================================================
    function $(id) { return document.getElementById(id); }

    function escapeHtml(str) {
        if (str == null) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function formatPrice(value) {
        const n = Number(value);
        if (value == null || isNaN(n)) return '—';
        return '$' + n.toFixed(2);
    }

    function num(v) {
        const n = parseFloat(v);
        return isNaN(n) ? 0 : n;
    }

    /** SanMar titles often end with the style number ("Essential Tee. PC61"). */
    function cleanProductName(raw) {
        if (!raw) return '';
        return String(raw)
            .replace(/\.\s*[A-Z0-9/]+\s*$/, '')
            .replace(/\s{2,}[A-Z0-9/]+\s*$/, '')
            .trim();
    }

    function normColor(s) {
        return String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
    }

    /** "24-47" → {min:24,max:47} · "72+" → {min:72,max:Infinity} */
    function parseRange(label) {
        const m = String(label || '').match(/^(\d+)\s*-\s*(\d+)/);
        if (m) return { min: parseInt(m[1], 10), max: parseInt(m[2], 10) };
        const p = String(label || '').match(/^(\d+)\s*\+/);
        if (p) return { min: parseInt(p[1], 10), max: Infinity };
        return { min: 0, max: Infinity };
    }

    /** Standard display size: S, else OSFA, else first — mirrors the pricing services. */
    function pickStdSize(sizes) {
        const list = (sizes || []).filter(Boolean);
        return list.find(function (s) { return String(s).toUpperCase() === 'S'; })
            || list.find(function (s) { return String(s).toUpperCase() === 'OSFA'; })
            || list[0]
            || null;
    }

    function sizeSortKey(size, idx) {
        const i = SIZE_ORDER.indexOf(String(size).toUpperCase());
        return i === -1 ? 1000 + idx : i;
    }

    function alertHtml(kind, title, msg) {
        return '<div class="alert alert-' + kind + '"' + (kind === 'error' ? ' role="alert"' : '') + '>'
            + '<svg class="alert-icon" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">'
            + '<path d="M10 1 1 18h18L10 1zm1 13h-2v2h2v-2zm0-7h-2v5h2V7z"/></svg>'
            + '<div class="alert-body"><strong class="alert-title">' + escapeHtml(title) + '</strong>'
            + '<p>' + escapeHtml(msg) + '</p></div></div>';
    }

    // ============================================================
    // CHROME (masthead drawer + search) — mirrors home-2026.js behavior
    // ============================================================
    function wireChrome() {
        const sidebar = $('sidebar');
        const overlay = $('sidebarOverlay');
        const openBtn = $('mobileMenuBtn');
        const closeBtn = $('drawerClose');

        function setDrawer(open) {
            if (!sidebar || !overlay) return;
            sidebar.classList.toggle('show', open);
            overlay.classList.toggle('show', open);
            document.body.classList.toggle('drawer-open', open);
        }
        if (openBtn) openBtn.addEventListener('click', function () { setDrawer(true); });
        if (closeBtn) closeBtn.addEventListener('click', function () { setDrawer(false); });
        if (overlay) overlay.addEventListener('click', function () { setDrawer(false); });
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') setDrawer(false);
        });

        // Masthead search → homepage catalog search (/?q=)
        const input = $('navSearchInput');
        const btn = $('navSearchBtn');
        function goSearch() {
            const term = (input && input.value || '').trim();
            if (term) window.location.href = '/?q=' + encodeURIComponent(term);
        }
        if (btn) btn.addEventListener('click', goSearch);
        if (input) input.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') goSearch();
        });
    }

    // ============================================================
    // PRODUCT LOAD
    // ============================================================
    function getParams() {
        const p = new URLSearchParams(window.location.search);
        return {
            style: (p.get('style') || p.get('StyleNumber') || '').trim(),
            color: (p.get('color') || p.get('COLOR') || '').trim()
        };
    }

    async function fetchProduct(style) {
        const url = API_BASE + '/api/product-details?styleNumber=' + encodeURIComponent(style);
        const resp = await fetch(url);
        if (!resp.ok) throw new Error('Product lookup failed (' + resp.status + ')');
        const rows = await resp.json();
        if (!Array.isArray(rows) || rows.length === 0) throw new Error('NOT_FOUND');
        return rows;
    }

    function buildProduct(rows) {
        const first = rows[0];
        const colorMap = new Map(); // keyed by CATALOG_COLOR (the API/inventory key)
        rows.forEach(function (r) {
            const catalog = (r.CATALOG_COLOR || r.COLOR_NAME || '').trim();
            if (!catalog || colorMap.has(catalog)) return;
            colorMap.set(catalog, {
                name: (r.COLOR_NAME || catalog).trim(), // display label
                catalog: catalog,                        // API / inventory / PO key
                swatch: r.COLOR_SQUARE_IMAGE || '',
                productImage: r.PRODUCT_IMAGE || '',
                images: {
                    front_model: r.FRONT_MODEL || '',
                    back_model: r.BACK_MODEL || '',
                    front_flat: r.FRONT_FLAT || '',
                    back_flat: r.BACK_FLAT || ''
                }
            });
        });

        state.product = {
            title: first.PRODUCT_TITLE || '',
            name: cleanProductName(first.PRODUCT_TITLE || ''),
            brand: first.BRAND_NAME || '',
            category: (first.CATEGORY_NAME || '').trim(),
            subcategory: (first.SUBCATEGORY_NAME || '').trim(),
            description: (first.PRODUCT_DESCRIPTION || '').trim(),
            status: first.PRODUCT_STATUS || ''
        };
        state.colors = Array.from(colorMap.values());
        state.isCap = detectCap(state.product, state.style);
    }

    function detectCap(product, style) {
        if (product.category === 'Caps') return true;
        if (product.category) return false;
        // Empty category (e.g. Richardson rows in Sanmar_Bulk): numeric style or "cap" in title
        if (/^\d{2,3}$/.test(style)) return true;
        return /\bcaps?\b/i.test(product.title || '');
    }

    function pickInitialColor(colorParam) {
        if (colorParam) {
            const want = normColor(colorParam);
            const hit = state.colors.find(function (c) {
                return normColor(c.name) === want || normColor(c.catalog) === want;
            });
            if (hit) return hit;
        }
        return state.colors[0] || null;
    }

    // ============================================================
    // RENDER — header / SEO
    // ============================================================
    function renderHead() {
        const p = state.product;
        const displayName = p.name || state.style;

        $('productTitle').textContent = displayName;
        $('productSub').textContent = [p.brand, 'Style ' + state.style].filter(Boolean).join(' · ');

        const bullets = descriptionBullets();
        $('productBlurb').textContent = bullets.lead;

        const crumbCat = $('crumbCategory');
        if (p.category) {
            crumbCat.textContent = p.category;
            crumbCat.href = '/?category=' + encodeURIComponent(p.category);
        }
        $('crumbStyle').textContent = state.style;

        // SEO
        const canonical = window.location.origin + '/product.html?style=' + encodeURIComponent(state.style);
        document.title = state.style + ' ' + displayName + ' — Custom ' + (state.isCap ? 'Caps' : 'Apparel')
            + ' | Northwest Custom Apparel';
        const desc = (bullets.lead || displayName) + ' Live inventory and decoration pricing — embroidery'
            + (state.isCap ? '' : ', screen print, DTG, and DTF') + ' from Northwest Custom Apparel, Milton WA.';
        setMeta('name', 'description', desc.slice(0, 300));
        setMeta('property', 'og:title', document.title);
        setMeta('property', 'og:description', desc.slice(0, 300));
        const img = state.selected && (state.selected.images.front_model || state.selected.images.front_flat);
        if (img) setMeta('property', 'og:image', img);
        setMeta('property', 'og:url', canonical);
        const link = $('canonicalLink');
        if (link) link.href = canonical;

        injectJsonLd(canonical, displayName, desc, img);
    }

    function setMeta(attr, key, value) {
        let el = document.head.querySelector('meta[' + attr + '="' + key + '"]');
        if (!el) {
            el = document.createElement('meta');
            el.setAttribute(attr, key);
            document.head.appendChild(el);
        }
        el.setAttribute('content', value);
    }

    /** JSON-LD Product schema — intentionally NO price/offers (price varies by decoration). */
    function injectJsonLd(canonical, name, desc, image) {
        const old = $('productJsonLd');
        if (old) old.remove();
        const ld = {
            '@context': 'https://schema.org',
            '@type': 'Product',
            name: name,
            sku: state.style,
            url: canonical,
            description: desc
        };
        if (state.product.brand) ld.brand = { '@type': 'Brand', name: state.product.brand };
        if (image) ld.image = [image];
        const script = document.createElement('script');
        script.type = 'application/ld+json';
        script.id = 'productJsonLd';
        script.textContent = JSON.stringify(ld);
        document.head.appendChild(script);
    }

    function descriptionBullets() {
        const parts = state.product.description
            .split(/\s{2,}|\r?\n/)
            .map(function (s) { return s.trim(); })
            .filter(Boolean);
        return { lead: parts[0] || '', rest: parts.slice(1) };
    }

    function renderDetails() {
        const rest = descriptionBullets().rest;
        if (rest.length === 0) return;
        $('detailBullets').innerHTML = rest.slice(0, 12).map(function (b) {
            return '<li>' + escapeHtml(b) + '</li>';
        }).join('');
        $('detailsSection').hidden = false;
    }

    // ============================================================
    // RENDER — gallery
    // ============================================================
    function availableViews(color) {
        return GALLERY_VIEWS.filter(function (v) { return color && color.images[v[0]]; });
    }

    function renderGallery() {
        const color = state.selected;
        const views = availableViews(color);
        if (views.length && !views.some(function (v) { return v[0] === state.view; })) {
            state.view = views[0][0];
        }

        const main = $('galleryMainImg');
        const src = (color && (color.images[state.view] || color.productImage))
            || SANMAR_CDN_FALLBACK + encodeURIComponent(state.style) + '.jpg';
        main.dataset.fallbackStep = '0';
        main.src = src;
        main.alt = [state.product.name || state.style, color ? color.name : '',
            (GALLERY_VIEWS.find(function (v) { return v[0] === state.view; }) || [])[1] || ''
        ].filter(Boolean).join(' — ');

        const thumbs = $('galleryThumbs');
        thumbs.innerHTML = views.map(function (v) {
            const pressed = v[0] === state.view ? 'true' : 'false';
            return '<button class="pdp-thumb" type="button" data-view="' + v[0] + '" aria-pressed="' + pressed + '"'
                + ' aria-label="View ' + escapeHtml(v[1]) + '">'
                + '<span><img src="' + escapeHtml(color.images[v[0]]) + '" alt="" loading="lazy">'
                + '<span class="pdp-thumb-label">' + escapeHtml(v[1]) + '</span></span>'
                + '</button>';
        }).join('');

        Array.prototype.forEach.call(thumbs.querySelectorAll('.pdp-thumb'), function (btn) {
            btn.addEventListener('click', function () {
                state.view = btn.dataset.view;
                renderGallery();
            });
        });
    }

    function wireGalleryFallback() {
        const main = $('galleryMainImg');
        main.addEventListener('error', function () {
            const step = parseInt(main.dataset.fallbackStep || '0', 10);
            if (step === 0 && state.selected && state.selected.productImage
                && main.src !== state.selected.productImage) {
                main.dataset.fallbackStep = '1';
                main.src = state.selected.productImage;
            } else if (step <= 1) {
                main.dataset.fallbackStep = '2';
                main.src = SANMAR_CDN_FALLBACK + encodeURIComponent(state.style) + '.jpg';
            }
            // step 2 failed too → give up silently (alt text shows)
        });
    }

    // ============================================================
    // RENDER — color swatches
    // ============================================================
    function renderSwatches() {
        const grid = $('swatchGrid');
        $('colorCount').textContent = '(' + state.colors.length + ')';

        grid.innerHTML = state.colors.map(function (c, i) {
            const pressed = state.selected && c.catalog === state.selected.catalog ? 'true' : 'false';
            return '<button class="pdp-swatch" type="button" data-idx="' + i + '" aria-pressed="' + pressed + '"'
                + ' title="' + escapeHtml(c.name) + '">'
                + (c.swatch
                    ? '<img src="' + escapeHtml(c.swatch) + '" alt="" loading="lazy">'
                    : '<img src="' + escapeHtml(c.productImage || '') + '" alt="" loading="lazy">')
                + '<span class="pdp-swatch-name">' + escapeHtml(c.name) + '</span>'
                + '</button>';
        }).join('');

        Array.prototype.forEach.call(grid.querySelectorAll('.pdp-swatch'), function (btn) {
            btn.addEventListener('click', function () {
                selectColor(state.colors[parseInt(btn.dataset.idx, 10)]);
            });
        });

        updateSelectedColorLabels();
    }

    function updateSelectedColorLabels() {
        const name = state.selected ? state.selected.name : '—';
        $('selectedColorName').textContent = name;
        $('invColorName').textContent = state.selected ? '— ' + name : '';
    }

    function selectColor(color) {
        if (!color || (state.selected && color.catalog === state.selected.catalog)) return;
        state.selected = color;

        Array.prototype.forEach.call($('swatchGrid').querySelectorAll('.pdp-swatch'), function (btn) {
            const c = state.colors[parseInt(btn.dataset.idx, 10)];
            btn.setAttribute('aria-pressed', c.catalog === color.catalog ? 'true' : 'false');
        });

        updateSelectedColorLabels();
        renderGallery();
        renderInventory();
        updateCtas();

        // URL keeps the display COLOR_NAME (today's contract with homepage/catalog links)
        const url = new URL(window.location.href);
        url.searchParams.set('style', state.style);
        url.searchParams.set('color', color.name);
        window.history.replaceState({}, '', url);
    }

    // ============================================================
    // INVENTORY (live, aggregated by CATALOG_COLOR — never COLOR_NAME)
    // ============================================================
    async function loadInventory() {
        const body = $('inventoryBody');
        body.innerHTML = '<div class="skeleton skeleton-block" aria-hidden="true"></div>';
        try {
            const resp = await fetch(API_BASE + '/api/sanmar/inventory/' + encodeURIComponent(state.style));
            if (!resp.ok) throw new Error('Inventory feed returned ' + resp.status);
            const json = await resp.json();
            state.inventoryRows = Array.isArray(json.inventory) ? json.inventory : [];
            renderInventory();
        } catch (err) {
            console.error('[product-2026] Inventory load failed:', err);
            state.inventoryRows = null;
            renderInventoryError();
        }
    }

    function renderInventoryError() {
        const body = $('inventoryBody');
        body.innerHTML = alertHtml('warn', 'Inventory unavailable',
            'We couldn\'t reach the live stock feed. Call 253-922-5793 to confirm availability.')
            + '<button class="btn btn-ghost" id="invRetry" type="button">Retry</button>';
        const retry = $('invRetry');
        if (retry) retry.addEventListener('click', loadInventory);
    }

    function renderInventory() {
        const body = $('inventoryBody');
        if (state.inventoryRows == null) return; // still loading or errored

        if (!state.selected) { body.innerHTML = ''; return; }
        const want = normColor(state.selected.catalog);
        const rows = state.inventoryRows.filter(function (r) { return normColor(r.color) === want; });

        if (rows.length === 0) {
            body.innerHTML = alertHtml('warn', 'No live stock data for this color',
                'The supplier feed has no entries for this color right now. Call us to confirm availability.');
            return;
        }

        // Aggregate qty per size (stale duplicate partIds exist — sum them)
        const bySize = new Map();
        rows.forEach(function (r) {
            const size = String(r.size || '').trim() || '—';
            bySize.set(size, (bySize.get(size) || 0) + num(r.totalQty));
        });

        const sizes = Array.from(bySize.keys());
        const sortKeys = new Map(sizes.map(function (s, i) { return [s, sizeSortKey(s, i)]; }));
        sizes.sort(function (a, b) { return sortKeys.get(a) - sortKeys.get(b); });

        let total = 0;
        const cells = sizes.map(function (size) {
            const qty = bySize.get(size) || 0;
            total += qty;
            let badge = '<span class="badge badge-ok badge-dot">In stock</span>';
            if (qty <= 0) badge = '<span class="badge badge-bad badge-dot">Out of stock</span>';
            else if (qty < LOW_STOCK_QTY) badge = '<span class="badge badge-warn badge-dot">Low stock</span>';
            return '<div class="pdp-inv-cell"><span class="pdp-inv-size">' + escapeHtml(size) + '</span>' + badge + '</div>';
        }).join('');

        body.innerHTML = '<div class="pdp-inv-grid">' + cells + '</div>'
            + '<p class="pdp-inv-note">Live supplier warehouse stock'
            + (total > 0 ? ' — about ' + total.toLocaleString() + ' pieces available across all sizes.' : '.')
            + '</p>';
    }

    // ============================================================
    // DECORATION PRICING TABS
    // ============================================================
    /**
     * Garment eligibility via the shared DecorationMethods module.
     * Failure mode = embroidery-only safe set + a visible alert-warn
     * (renderMethodAlert) — never silently offer a method we can't produce.
     */
    async function getEligibility() {
        if (window.DecorationMethods) {
            try {
                return await window.DecorationMethods.eligibleFor({
                    CATEGORY_NAME: state.product.category,
                    SUBCATEGORY_NAME: state.product.subcategory,
                    PRODUCT_DESCRIPTION: state.product.description,
                    styleNumber: state.style
                });
            } catch (err) {
                console.error('[product-2026] Eligibility lookup failed:', err);
            }
        } else {
            console.error('[product-2026] DecorationMethods module missing — embroidery-only fallback');
        }
        return { EMB: true, DTG: 'no', SCP: false, DTF: false, source: 'fallback' };
    }

    async function buildMethods() {
        state.decoration = null;
        if (state.isCap) {
            // Caps branch unchanged — cap embroidery tab as-is
            state.methods = [
                { id: 'capemb', label: 'Embroidery', loader: loadCapEmb }
            ];
        } else {
            const elig = await getEligibility();
            state.decoration = elig;
            state.methods = [
                { id: 'emb', label: 'Embroidery', loader: loadEmb, on: elig.EMB },
                { id: 'dtg', label: 'DTG Print', loader: loadDtg, on: elig.DTG !== 'no' },
                { id: 'scp', label: 'Screen Print', loader: loadScp, on: elig.SCP },
                { id: 'dtf', label: 'DTF Transfer', loader: loadDtf, on: elig.DTF }
            ].filter(function (m) { return m.on; });
        }
        state.methods.forEach(function (m) { state.panels[m.id] = { status: 'idle', data: null }; });
    }

    /** Visible warning whenever eligibility fell back to the safe set. */
    function renderMethodAlert() {
        const slot = $('methodAlert');
        if (!slot) return;
        if (!state.isCap && state.decoration && state.decoration.source === 'fallback') {
            slot.innerHTML = alertHtml('warn', 'Showing embroidery pricing',
                'Other decoration options may be available for this garment — call 253-922-5793 and a real person will confirm.');
        } else {
            slot.innerHTML = '';
        }
    }

    function renderTabs() {
        const tablist = $('methodTabs');
        const panels = $('methodPanels');

        if (state.methods.length === 0) {
            // Shouldn't happen (eligibility fallback is embroidery-only), but
            // never dead-end — route to a human instead of an empty section.
            tablist.innerHTML = '';
            panels.innerHTML = '<div class="empty-state">'
                + '<div class="empty-state-icon" aria-hidden="true">🧵</div>'
                + '<h3 class="empty-state-title">Let\'s price this one personally</h3>'
                + '<p class="empty-state-sub">This garment needs a quick human look to pick the right decoration method — it takes a minute.</p>'
                + '<a class="btn btn-primary" href="tel:253-922-5793">Call 253-922-5793</a> '
                + '<a class="btn btn-ghost" href="mailto:' + SALES_EMAIL + '?subject='
                + encodeURIComponent('Quote request — ' + state.style) + '">Email for a quote</a>'
                + '</div>';
            return;
        }

        tablist.innerHTML = state.methods.map(function (m, i) {
            return '<button class="pdp-tab" type="button" role="tab" id="tab-' + m.id + '"'
                + ' aria-controls="panel-' + m.id + '"'
                + ' aria-selected="' + (i === 0 ? 'true' : 'false') + '"'
                + ' tabindex="' + (i === 0 ? '0' : '-1') + '">'
                + escapeHtml(m.label) + '</button>';
        }).join('');

        panels.innerHTML = state.methods.map(function (m, i) {
            return '<div class="pdp-panel" role="tabpanel" id="panel-' + m.id + '"'
                + ' aria-labelledby="tab-' + m.id + '"' + (i === 0 ? '' : ' hidden') + '></div>';
        }).join('');

        const tabs = Array.prototype.slice.call(tablist.querySelectorAll('[role="tab"]'));
        tabs.forEach(function (tab, i) {
            tab.addEventListener('click', function () { selectTab(state.methods[i].id); });
        });
        // ARIA tabs pattern: roving tabindex + arrow keys (selection follows focus)
        tablist.addEventListener('keydown', function (e) {
            const idx = state.methods.findIndex(function (m) { return m.id === state.activeTab; });
            let next = -1;
            if (e.key === 'ArrowRight') next = (idx + 1) % state.methods.length;
            else if (e.key === 'ArrowLeft') next = (idx - 1 + state.methods.length) % state.methods.length;
            else if (e.key === 'Home') next = 0;
            else if (e.key === 'End') next = state.methods.length - 1;
            if (next === -1) return;
            e.preventDefault();
            selectTab(state.methods[next].id);
            $('tab-' + state.methods[next].id).focus();
        });

        selectTab(state.methods[0].id);
    }

    function selectTab(id) {
        state.activeTab = id;
        state.methods.forEach(function (m) {
            const tab = $('tab-' + m.id);
            const panel = $('panel-' + m.id);
            const on = m.id === id;
            tab.setAttribute('aria-selected', on ? 'true' : 'false');
            tab.tabIndex = on ? 0 : -1;
            panel.hidden = !on;
        });
        updateCtas();
        if (state.panels[id].status === 'idle') loadMethod(id); // lazy: fetch on first open
    }

    async function loadMethod(id) {
        const method = state.methods.find(function (m) { return m.id === id; });
        const panel = $('panel-' + id);
        state.panels[id].status = 'loading';
        panel.setAttribute('aria-busy', 'true');
        panel.innerHTML = '<div class="skeleton skeleton-title"></div><div class="skeleton skeleton-block"></div>';
        try {
            const data = await method.loader(state.style);
            state.panels[id] = { status: 'ready', data: data };
            renderPanel(id);
        } catch (err) {
            console.error('[product-2026] Pricing load failed for ' + id + ':', err);
            state.panels[id] = { status: 'error', data: null };
            // Visible failure, never a stale/hardcoded fallback (Erik's #1 rule)
            panel.innerHTML = alertHtml('error', 'Unable to load ' + method.label + ' pricing',
                'Live pricing is unavailable right now. Please retry, or call 253-922-5793 for a quote — we never guess at prices.')
                + '<button class="btn btn-primary" type="button" data-retry="' + id + '">Retry</button>';
            const retry = panel.querySelector('[data-retry]');
            if (retry) retry.addEventListener('click', function () { loadMethod(id); });
        } finally {
            panel.removeAttribute('aria-busy');
        }
    }

    /**
     * Normalized tier model every loader returns:
     *   { note, foot, warn?, stdSize, multiSize, tiers: [{label, min, max, price, ltmFee}] }
     * `warn` (optional) renders as an inline alert-warn above the table
     * (used by the DTG cotton gate's blend case).
     */
    function renderPanel(id) {
        const panel = $('panel-' + id);
        const d = state.panels[id].data;
        const showFeeRow = d.tiers.some(function (t) { return t.ltmFee > 0; });

        const head = d.tiers.map(function (t) {
            return '<th data-min="' + t.min + '" data-max="' + (t.max === Infinity ? '' : t.max) + '">'
                + escapeHtml(t.label) + '</th>';
        }).join('');
        const priceRow = d.tiers.map(function (t) {
            return '<td>' + formatPrice(t.price) + '</td>';
        }).join('');
        const feeRow = showFeeRow ? '<tr><td>Small-order fee</td>' + d.tiers.map(function (t) {
            return '<td>' + (t.ltmFee > 0 ? '+' + formatPrice(t.ltmFee) + ' per order' : '—') + '</td>';
        }).join('') + '</tr>' : '';

        panel.innerHTML =
            (d.warn ? alertHtml('warn', 'Cotton-blend garment', d.warn) : '')
            + '<p class="pdp-panel-note">' + escapeHtml(d.note) + '</p>'
            + '<div class="table-wrap"><table class="data-table tier-table">'
            + '<thead><tr><th>Quantity</th>' + head + '</tr></thead>'
            + '<tbody><tr><td>Price per piece</td>' + priceRow + '</tr>' + feeRow + '</tbody>'
            + '</table></div>'
            + '<p class="pdp-panel-foot">'
            + (d.multiSize ? 'Prices shown for size ' + escapeHtml(d.stdSize) + ' — extended sizes carry a small upcharge. ' : '')
            + escapeHtml(d.foot || '')
            + ' Final pricing is confirmed in your quote.</p>';

        highlightTier(panel);
    }

    function highlightTier(panel) {
        const table = panel.querySelector('table');
        if (!table) return;
        const ths = Array.prototype.slice.call(table.querySelectorAll('thead th'));
        let activeCol = -1;
        ths.forEach(function (th, col) {
            if (!th.hasAttribute('data-min')) return;
            const min = parseInt(th.getAttribute('data-min'), 10);
            const maxAttr = th.getAttribute('data-max');
            const max = maxAttr === '' ? Infinity : parseInt(maxAttr, 10);
            if (state.qty >= min && state.qty <= max) activeCol = col;
        });
        ths.forEach(function (th, col) { th.classList.toggle('is-active-tier', col === activeCol); });
        Array.prototype.forEach.call(table.querySelectorAll('tbody tr'), function (tr) {
            Array.prototype.forEach.call(tr.children, function (td, col) {
                td.classList.toggle('is-active-tier', col === activeCol);
            });
        });
    }

    function rehighlightAll() {
        state.methods.forEach(function (m) {
            if (state.panels[m.id].status === 'ready') highlightTier($('panel-' + m.id));
        });
    }

    // ── Method loaders — each mirrors its calculator's shared service ──

    /** Flat embroidery: EmbroideryPricingService (bundle.pricing[tier][size], CeilDollar, 8K stitches). */
    async function loadEmb(style) {
        if (typeof EmbroideryPricingService === 'undefined') throw new Error('EmbroideryPricingService not loaded');
        const svc = new EmbroideryPricingService();
        const b = await svc.fetchPricingData(style);
        if (!b || !b.pricing) throw new Error('Empty embroidery pricing bundle');
        const std = pickStdSize(b.uniqueSizes);
        const tiers = (b.tierData || []).slice()
            .sort(function (a, z) { return num(a.MinQuantity) - num(z.MinQuantity); })
            .map(function (t) {
                return {
                    label: t.TierLabel,
                    min: num(t.MinQuantity) || parseRange(t.TierLabel).min,
                    max: t.MaxQuantity != null && num(t.MaxQuantity) > 0 ? num(t.MaxQuantity) : parseRange(t.TierLabel).max,
                    price: b.pricing[t.TierLabel] ? b.pricing[t.TierLabel][std] : null,
                    ltmFee: num(t.LTM_Fee)
                };
            });
        if (tiers.length === 0) throw new Error('No embroidery tiers returned');
        return {
            note: 'Includes an embroidered logo up to 8,000 stitches in one location (left chest, sleeve, or back yoke).',
            foot: 'Larger logos and extra locations are quoted per design.',
            stdSize: std,
            multiSize: (b.uniqueSizes || []).length > 1,
            tiers: tiers
        };
    }

    /** Cap embroidery: CapEmbroideryPricingService (8K-stitch front logo, CeilDollar, cap tiers). */
    async function loadCapEmb(style) {
        if (typeof CapEmbroideryPricingService === 'undefined') throw new Error('CapEmbroideryPricingService not loaded');
        const svc = new CapEmbroideryPricingService();
        const b = await svc.fetchPricingData(style);
        if (!b || !b.pricing) throw new Error('Empty cap pricing bundle');
        const std = pickStdSize(b.uniqueSizes);
        const tiers = (b.tierData || []).slice()
            .sort(function (a, z) { return num(a.MinQuantity) - num(z.MinQuantity); })
            .map(function (t) {
                return {
                    label: t.TierLabel,
                    min: num(t.MinQuantity) || parseRange(t.TierLabel).min,
                    max: t.MaxQuantity != null && num(t.MaxQuantity) > 0 ? num(t.MaxQuantity) : parseRange(t.TierLabel).max,
                    price: b.pricing[t.TierLabel] ? b.pricing[t.TierLabel][std] : null,
                    ltmFee: num(t.LTM_Fee)
                };
            });
        if (tiers.length === 0) throw new Error('No cap tiers returned');
        return {
            note: 'Includes an embroidered front logo up to 8,000 stitches.',
            foot: 'Side and back logos are quoted per design.',
            stdSize: std,
            multiSize: (b.uniqueSizes || []).length > 1,
            tiers: tiers
        };
    }

    /** DTG: DTGPricingService.calculateAllTierPricesForLocation(data,'LC') — half-dollar-ceil, LTM 1-23. */
    async function loadDtg(style) {
        if (typeof DTGPricingService === 'undefined') throw new Error('DTGPricingService not loaded');
        const svc = new DTGPricingService();
        const data = await svc.fetchPricingData(style);
        if (!data || !data.sizes || data.sizes.length === 0) throw new Error('Empty DTG pricing bundle');
        const rows = svc.calculateAllTierPricesForLocation(data, 'LC');
        if (!rows || rows.length === 0) throw new Error('No DTG tiers returned');
        const std = pickStdSize(data.sizes.map(function (s) { return s.size; }));
        const tiers = rows.map(function (r) {
            const range = parseRange(r.label);
            return {
                label: r.label,
                min: range.min,
                max: range.max,
                price: r.basePrices ? r.basePrices[std] : null,
                ltmFee: num(r.ltmFee)
            };
        });
        return {
            note: 'Includes a full-color DTG print, left-chest size. Photo-quality, no color limits.',
            warn: state.decoration && state.decoration.DTG === 'warn'
                ? 'DTG prints best on 100% cotton — this blend prints with a softer, vintage look. We confirm on your proof.'
                : '',
            foot: 'Full-front, full-back, and combo placements are priced in your quote. DTG color availability is confirmed on your proof.',
            stdSize: std,
            multiSize: data.sizes.length > 1,
            tiers: tiers
        };
    }

    /** Screen print: ScreenPrintPricingService.finalPrices.PrimaryLocation[tier][colors][size]. */
    async function loadScp(style) {
        if (typeof ScreenPrintPricingService === 'undefined') throw new Error('ScreenPrintPricingService not loaded');
        const svc = new ScreenPrintPricingService();
        const b = await svc.fetchPricingData(style);
        if (!b || !b.finalPrices || !b.finalPrices.PrimaryLocation) throw new Error('Empty screen print bundle');
        const std = pickStdSize(b.uniqueSizes);
        const counts = (b.availableColorCounts || []).slice().sort(function (a, z) { return a - z; });
        const cc = String(counts[0] != null ? counts[0] : 1);
        const tiers = Object.keys(b.tierData || {})
            .map(function (label) { return b.tierData[label]; })
            .sort(function (a, z) { return num(a.MinQuantity) - num(z.MinQuantity); })
            .map(function (t) {
                const cell = b.finalPrices.PrimaryLocation[t.TierLabel];
                return {
                    label: t.TierLabel,
                    min: num(t.MinQuantity) || parseRange(t.TierLabel).min,
                    max: t.MaxQuantity != null && num(t.MaxQuantity) > 0 ? num(t.MaxQuantity) : parseRange(t.TierLabel).max,
                    price: cell && cell[cc] ? cell[cc][std] : null,
                    ltmFee: num(t.LTM_Fee)
                };
            });
        if (tiers.length === 0) throw new Error('No screen print tiers returned');
        const setup = num(b.screenSetupFeePerScreen);
        return {
            note: 'Includes a ' + cc + '-color front print. The classic choice for bigger runs.',
            foot: 'Plus a one-time screen setup of ' + formatPrice(setup) + ' per color. More colors and locations are quoted per design.',
            stdSize: std,
            multiSize: (b.uniqueSizes || []).length > 1,
            tiers: tiers
        };
    }

    /** DTF: DTFPricingService.calculateAllTierPrices(garmentCost, data, 'small') — garment cost from
     *  the bundle's own sizes (S or first by sortOrder), matching the services' standard-garment rule. */
    async function loadDtf(style) {
        if (typeof DTFPricingService === 'undefined') throw new Error('DTFPricingService not loaded');
        const svc = new DTFPricingService();
        const data = await svc.fetchPricingData(style);
        const rawSizes = (data && data.raw && data.raw.sizes) || [];
        if (rawSizes.length === 0) throw new Error('DTF bundle missing garment sizes');
        const sorted = rawSizes.slice().sort(function (a, z) {
            return (a.sortOrder || Infinity) - (z.sortOrder || Infinity);
        });
        const stdEntry = sorted.find(function (s) { return String(s.size).toUpperCase() === 'S'; }) || sorted[0];
        const garmentCost = num(stdEntry.price);
        if (!(garmentCost > 0)) throw new Error('DTF bundle missing garment cost');
        const sizeName = (data.transferSizes && data.transferSizes.small && data.transferSizes.small.name) || 'small';
        const rows = svc.calculateAllTierPrices(garmentCost, data, 'small');
        if (!rows || rows.length === 0) throw new Error('No DTF tiers returned');
        const tiers = rows.map(function (r) {
            const range = parseRange(r.label);
            return { label: r.label, min: range.min, max: range.max, price: r.basePrice, ltmFee: num(r.ltmFee) };
        });
        return {
            note: 'Includes a full-color DTF transfer (' + sizeName + ' — left-chest size) pressed in one location. Great on blends and dark garments.',
            foot: 'Larger transfers and extra locations are quoted per design.',
            stdSize: stdEntry.size,
            multiSize: rawSizes.length > 1,
            tiers: tiers
        };
    }

    // ============================================================
    // CTAs (quote mailto / sample link) — kept in sync with selections
    // ============================================================
    function updateCtas() {
        const name = state.product ? (state.product.name || state.style) : state.style;
        const method = state.methods.find(function (m) { return m.id === state.activeTab; });
        const subject = 'Quote request — ' + state.style + ' ' + name;
        const body = 'Hi NWCA,\n\nI\'d like a quote for:\n\n'
            + 'Style: ' + state.style + ' — ' + name + '\n'
            + 'Color: ' + (state.selected ? state.selected.name : '') + '\n'
            + 'Quantity: ' + state.qty + '\n'
            + 'Decoration: ' + (method ? method.label : '') + '\n\n'
            + 'My name:\nCompany:\nPhone:\n';
        const href = 'mailto:' + SALES_EMAIL
            + '?subject=' + encodeURIComponent(subject)
            + '&body=' + encodeURIComponent(body);
        $('ctaQuote').href = href;
        $('ctaQuoteMobile').href = href;

        // Existing sample flow (legacy param shape kept on purpose)
        const sample = '/pages/top-sellers-product.html?style=' + encodeURIComponent(state.style) + '&mode=sample';
        $('ctaSample').href = sample;
        $('ctaSampleMobile').href = sample;
    }

    function wireQty() {
        const input = $('qtyInput');
        input.addEventListener('input', function () {
            const v = parseInt(input.value, 10);
            if (!isNaN(v) && v > 0) {
                state.qty = v;
                rehighlightAll();
                updateCtas();
            }
        });
    }

    // ============================================================
    // RELATED PRODUCTS
    // ============================================================
    async function loadRelated() {
        const cat = state.product.category;
        const section = $('relatedSection');
        const grid = $('relatedGrid');
        if (!cat) return; // no category to relate on — leave hidden
        try {
            const url = API_BASE + '/api/products/search?category=' + encodeURIComponent(cat) + '&limit=9';
            const resp = await fetch(url);
            if (!resp.ok) throw new Error('Related search returned ' + resp.status);
            const json = await resp.json();
            const products = ((json.data && json.data.products) || [])
                .filter(function (p) { return p.styleNumber && p.styleNumber !== state.style; })
                .slice(0, 4);
            if (products.length === 0) return;
            grid.innerHTML = products.map(function (p) {
                const img = (p.images && (p.images.thumbnail || p.images.main))
                    || SANMAR_CDN_FALLBACK + encodeURIComponent(p.styleNumber) + '.jpg';
                return '<a class="pdp-related-card" href="/product.html?style=' + encodeURIComponent(p.styleNumber) + '">'
                    + '<span class="pdp-related-photo"><img src="' + escapeHtml(img) + '" alt="" loading="lazy"></span>'
                    + '<span class="pdp-related-body">'
                    + '<span class="pdp-related-style">' + escapeHtml(p.brand || '') + ' · ' + escapeHtml(p.styleNumber) + '</span>'
                    + '<span class="pdp-related-name">' + escapeHtml(cleanProductName(p.productName || p.styleNumber)) + '</span>'
                    + '</span></a>';
            }).join('');
            section.hidden = false;
        } catch (err) {
            console.error('[product-2026] Related products failed:', err);
            grid.innerHTML = alertHtml('warn', 'Couldn\'t load related products',
                'The catalog search is unavailable right now.');
            section.hidden = false;
        }
    }

    // ============================================================
    // PAGE STATES
    // ============================================================
    function showFatal(title, sub, allowRetry) {
        $('pdpSkeleton').hidden = true;
        $('pdpContent').hidden = true;
        $('mobileCtaBar').hidden = true;
        document.body.classList.remove('pdp-has-mobile-cta');
        $('fatalTitle').textContent = title;
        $('fatalSub').textContent = sub;
        $('fatalRetry').hidden = !allowRetry;
        $('pdpFatal').hidden = false;
    }

    function showContent() {
        $('pdpSkeleton').hidden = true;
        $('pdpFatal').hidden = true;
        $('pdpContent').hidden = false;
        $('mobileCtaBar').hidden = false;
        document.body.classList.add('pdp-has-mobile-cta');
    }

    // ============================================================
    // BOOT
    // ============================================================
    async function loadAll(colorParam) {
        $('pdpFatal').hidden = true;
        $('pdpContent').hidden = true;
        $('pdpSkeleton').hidden = false;

        try {
            const rows = await fetchProduct(state.style);
            buildProduct(rows);
        } catch (err) {
            console.error('[product-2026] Product load failed:', err);
            if (err && err.message === 'NOT_FOUND') {
                showFatal('Product not found',
                    'We couldn\'t find style "' + state.style + '" in the catalog. It may have been discontinued.', false);
            } else {
                showFatal('We couldn\'t load this product',
                    'Something went wrong fetching product data. Check your connection and try again.', true);
            }
            return;
        }

        if (state.colors.length === 0) {
            showFatal('Product not found', 'No colors are listed for style "' + state.style + '".', false);
            return;
        }

        state.selected = pickInitialColor(colorParam);
        renderHead();
        renderGallery();
        renderSwatches();
        renderDetails();
        updateCtas();

        // Skeleton in the pricing section while eligibility rules load
        $('methodAlert').innerHTML = '';
        $('methodTabs').innerHTML = '';
        $('methodPanels').innerHTML = '<div class="skeleton skeleton-block" aria-hidden="true"></div>';
        showContent();

        // Non-blocking secondary loads
        loadInventory();
        loadRelated();

        // Decoration tabs gated by eligibility (cached 1h in sessionStorage)
        await buildMethods();
        renderMethodAlert();
        renderTabs();
        updateCtas();
    }

    function init() {
        wireChrome();
        wireGalleryFallback();
        wireQty();

        const params = getParams();
        if (!params.style) {
            showFatal('No product selected',
                'This page needs a style number — try browsing the catalog or searching above.', false);
            return;
        }
        state.style = params.style;
        $('fatalRetry').addEventListener('click', function () { loadAll(params.color); });
        loadAll(params.color);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
