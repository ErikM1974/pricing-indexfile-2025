/**
 * product-2026.js — rebuilt product detail page (root /product.html)
 * on the NWCA 2026 design system.
 *
 * Data flows (all live API, never hardcoded prices — Erik's #1 rule):
 *   - /api/product-details?styleNumber=X   product info, per-color images + swatches
 *   - /api/sanmar/inventory/:style         live warehouse stock (CATALOG_COLOR keyed)
 *   - /api/products/search?category=...    related products
 *   - Decoration pricing via the 3-question CONFIGURATOR
 *     (product/js/pdp-configurator.js), powered by QuoteCartEngine —
 *     the same authorities the staff quote builders use. This page owns
 *     product/gallery/inventory/related/CTAs; the configurator owns
 *     qty/placement/method selection and all price rendering.
 *   - Decoration METHOD ELIGIBILITY via shared DecorationMethods module
 *     (/api/decoration-methods): only producible method chips render; DTG
 *     cotton gate ('warn' → blend note on the chip, 'no' → chip absent);
 *     rules unavailable → embroidery-only chip + visible alert-warn
 *     (methodAlert). Caps branch: cap placements + cap-embroidery pricing.
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
        decoration: null    // DecorationMethods.eligibleFor() result (garments only)
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

        // EMB prices per color (/api/size-pricing matched on COLOR_NAME) —
        // the configurator re-prices on swatch change.
        if (window.PdpConfigurator) window.PdpConfigurator.setColor();

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
    // DECORATION PRICING — 3-question configurator
    // (qty → placement → priced method chips, product/js/pdp-configurator.js)
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

    /**
     * Resolve eligibility, then hand pricing entirely to the configurator.
     * Eligibility gating decides which method chips render; the configurator
     * + QuoteCartEngine own every price (never computed in page code).
     */
    async function initConfigurator() {
        state.decoration = state.isCap ? null : await getEligibility();
        renderMethodAlert();

        if (!window.PdpConfigurator) {
            // Script failed to load — visible failure, never a silent dead section
            console.error('[product-2026] PdpConfigurator module missing');
            $('methodAlert').innerHTML = alertHtml('error', 'Unable to load live pricing',
                'The pricing tool didn\'t load. Please refresh, or call 253-922-5793 for a quote — we never guess at prices.');
            return;
        }

        window.PdpConfigurator.init({
            style: state.style,
            isCap: state.isCap,
            productName: state.product.name || state.style,
            eligibility: state.decoration,
            getColor: function () {
                return state.selected
                    ? { name: state.selected.name, catalog: state.selected.catalog }
                    : null;
            },
            onChange: updateCtas
        });

        renderSafetyStripeRecs();
    }

    // Recommended hi-vis styles for safety stripes — customer-facing cards shown
    // whenever screen print is an available decoration method for this garment
    // (per Erik 2026-06-28). No sales numbers (audience:'customer'); each card
    // links to that style's product page.
    function renderSafetyStripeRecs() {
        var el = document.getElementById('cfgSafetyStripesRecs');
        if (!el) return;
        var scp = state.decoration && state.decoration.SCP;
        var scpAvailable = !!scp && scp !== 'no';
        if (!scpAvailable || !window.SafetyStripeRecs) { el.hidden = true; el.innerHTML = ''; return; }
        window.SafetyStripeRecs.render('cfgSafetyStripesRecs', {
            variant: 'catalog', audience: 'customer', limit: 6,
            title: 'Recommended for safety stripes',
            subtitle: 'Popular hi-vis styles — pair them with screen-printed safety stripes'
        });
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

    // ============================================================
    // CTAs (quote mailto / sample link) — kept in sync with the
    // configurator selection (style/color/qty/placement/method/price)
    // ============================================================
    function updateCtas() {
        const name = state.product ? (state.product.name || state.style) : state.style;
        const sel = (window.PdpConfigurator && window.PdpConfigurator.getSelection)
            ? window.PdpConfigurator.getSelection()
            : null;

        const subject = 'Quote request — ' + state.style + ' ' + name;
        const lines = [
            'Hi NWCA,',
            '',
            'I\'d like a quote for:',
            '',
            'Style: ' + state.style + ' — ' + name,
            'Color: ' + (state.selected ? state.selected.name : '')
        ];
        if (sel) {
            lines.push('Quantity: ' + sel.qty);
            lines.push('Placement: ' + sel.locationLabel);
            lines.push('Method: ' + sel.methodLabel);
            if (sel.inkColors != null) lines.push('Ink colors: ' + sel.inkColors);
            if (sel.price) {
                // Live engine price only — never an estimated/guessed number
                lines.push('Online price: $' + sel.price.total.toFixed(2) + ' total — $'
                    + sel.price.perPiece.toFixed(2) + '/pc (' + (sel.price.tierLabel || '') + ' tier)');
                (sel.price.oneTimeFees || []).forEach(function (f) {
                    lines.push('+ One-time ' + f.label + ': $' + Number(f.amount).toFixed(2));
                });
            }
        }
        lines.push('', 'My name:', 'Company:', 'Phone:', '');

        const href = 'mailto:' + SALES_EMAIL
            + '?subject=' + encodeURIComponent(subject)
            + '&body=' + encodeURIComponent(lines.join('\n'));
        $('ctaQuote').href = href;
        $('ctaQuoteMobile').href = href;
        const emailLink = $('cfgEmailQuote');
        if (emailLink) emailLink.href = href;

        updateAddToQuote(sel);

        // Existing sample flow (legacy param shape kept on purpose)
        const sample = '/pages/top-sellers-product.html?style=' + encodeURIComponent(state.style) + '&mode=sample';
        $('ctaSample').href = sample;
        $('ctaSampleMobile').href = sample;
    }

    // ============================================================
    // ADD TO QUOTE (Phase 2 quote-cart) — pushes the configurator
    // selection into QuoteCartStore. ZERO price math here: the price
    // shown came from the engine, and the cart page re-prices through
    // the same engine on every view.
    // ============================================================
    function updateAddToQuote(sel) {
        const btn = $('cfgAddToQuote');
        const reason = $('cfgAddReason');
        if (!btn || !reason) return;
        let ok = false;
        let why = '';
        if (!window.QuoteCartStore) {
            why = 'The quote cart didn\'t load — use the email button instead.';
        } else if (!sel) {
            why = '';
        } else if (sel.status === 'ok' && sel.price && sel.sizes) {
            ok = true;
        } else if (sel.status === 'loading') {
            why = 'Getting your live price…';
        } else if (sel.status === 'belowmin') {
            why = 'DTF starts at 10 pieces — bump the quantity to add it.';
        } else if (sel.status === 'unavailable') {
            why = (sel.methodLabel || 'This method') + ' isn\'t offered for this placement — pick another look.';
        } else {
            why = 'Live pricing is unavailable — retry above, or email us.';
        }
        btn.disabled = !ok;
        reason.textContent = why;
        reason.hidden = !why;
    }

    /**
     * Pooling-scope guard (staff-builder rule, design doc §Grouping): pieces
     * of one decoration method share ONE placement/design so quantities pool —
     * a mismatched add would price a configuration staff can't reproduce.
     */
    function quoteConflictMessage(sel) {
        const existing = window.QuoteCartStore.getItems().filter(function (i) {
            return i.method === sel.engineMethod;
        });
        if (existing.length === 0) return null;
        const first = existing[0];
        if (first.placement !== sel.locationKey) {
            return 'Your quote\'s ' + (sel.methodLabel || 'decorated') + ' pieces use "'
                + (first.placementLabel || first.placement)
                + '" — one placement per decoration type so quantities pool for the discount. '
                + 'Switch the placement to match, or email us for a mixed layout.';
        }
        if (sel.engineMethod === 'SCP' && Number(first.inkColors) !== Number(sel.inkColors)) {
            return 'Your quote\'s screen print pieces use ' + first.inkColors
                + ' ink color' + (Number(first.inkColors) === 1 ? '' : 's')
                + ' — one design per quote so screens and discounts pool. Match the ink colors, or email us.';
        }
        return null;
    }

    function onAddToQuote() {
        const sel = (window.PdpConfigurator && window.PdpConfigurator.getSelection)
            ? window.PdpConfigurator.getSelection()
            : null;
        if (!window.QuoteCartStore || !sel || sel.status !== 'ok' || !sel.price || !sel.sizes) return;
        const conflict = quoteConflictMessage(sel);
        if (conflict) {
            showToast('warn', escapeHtml(conflict));
            return;
        }
        const name = state.product ? (state.product.name || state.style) : state.style;
        window.QuoteCartStore.add({
            style: state.style,
            productTitle: name,
            color: state.selected ? state.selected.name : '',
            catalogColor: state.selected ? state.selected.catalog : '',
            qty: sel.qty,
            sizes: sel.sizes,
            method: sel.engineMethod,
            placement: sel.locationKey,
            placementLabel: sel.locationLabel,
            methodLabel: sel.methodLabel,
            inkColors: sel.inkColors,
            safetyStripes: sel.safetyStripes,
            isCap: sel.isCap
        });
        const n = window.QuoteCartStore.count();
        const unit = sel.isCap ? 'cap' : 'piece';
        showToast('success', 'Added — ' + sel.qty + ' ' + unit + (sel.qty === 1 ? '' : 's')
            + ' · ' + escapeHtml(sel.methodLabel)
            + ' &nbsp;<a href="/quote-cart">View quote (' + n + ')</a>');
    }

    /** Core .toast primitive — html must already be escaped by the caller. */
    function showToast(kind, html) {
        const stack = $('toastStack');
        if (!stack) return;
        const toast = document.createElement('div');
        toast.className = 'toast' + (kind ? ' toast-' + kind : '');
        toast.innerHTML = (kind === 'success'
            ? '<svg class="toast-icon" width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M6.5 11.2 3.3 8l-1 1 4.2 4.2 7.2-7.2-1-1z"/></svg>'
            : '')
            + '<span>' + html + '</span>'
            + '<button class="toast-dismiss" type="button" aria-label="Dismiss">&times;</button>';
        toast.querySelector('.toast-dismiss').addEventListener('click', function () { toast.remove(); });
        stack.appendChild(toast);
        setTimeout(function () { if (toast.parentNode) toast.remove(); }, 8000);
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
            const url = API_BASE + '/api/products/search?category=' + encodeURIComponent(cat) + '&limit=24';
            const resp = await fetch(url);
            if (!resp.ok) throw new Error('Related search returned ' + resp.status);
            const json = await resp.json();
            const candidates = ((json.data && json.data.products) || [])
                .filter(function (p) { return p.styleNumber && p.styleNumber !== state.style; });
            if (candidates.length === 0) return;

            // SanMar's catalog-search image URLs serve an "image not yet
            // available" placeholder as a real jpg (HTTP 200) for some styles
            // (Allmade — Erik flagged the blue badges 2026-06-11), and the CDN
            // serves the same placeholder for ANY missing filename, so no URL
            // or dimension heuristic can detect it reliably. The trustworthy
            // photo source is /api/product-details FRONT_MODEL — real model
            // photography exists there even when the catalog jpg is a
            // placeholder (it's what this page's own hero uses). Fetch details
            // for the four picks and render those photos.
            const products = candidates.slice(0, 4);
            const detailImages = await Promise.all(products.map(function (p) {
                const detailUrl = API_BASE + '/api/product-details?styleNumber='
                    + encodeURIComponent(p.styleNumber);
                return fetch(detailUrl)
                    .then(function (r) { return r.ok ? r.json() : null; })
                    .then(function (rows) {
                        if (!Array.isArray(rows)) return null;
                        const row = rows.find(function (x) {
                            return x && (x.FRONT_MODEL || x.FRONT_FLAT);
                        });
                        return row ? (row.FRONT_MODEL || row.FRONT_FLAT) : null;
                    })
                    .catch(function () { return null; });
            }));
            grid.innerHTML = products.map(function (p, i) {
                const img = detailImages[i];
                const photoHtml = img
                    ? '<span class="pdp-related-photo"><img src="' + escapeHtml(img) + '" alt="" loading="lazy"></span>'
                    : '<span class="pdp-related-photo is-pending">Photo coming soon</span>';
                return '<a class="pdp-related-card" href="/product.html?style=' + encodeURIComponent(p.styleNumber) + '">'
                    + photoHtml
                    + '<span class="pdp-related-body">'
                    + '<span class="pdp-related-style">' + escapeHtml(p.brand || '') + ' · ' + escapeHtml(p.styleNumber) + '</span>'
                    + '<span class="pdp-related-name">' + escapeHtml(cleanProductName(p.productName || p.styleNumber)) + '</span>'
                    + '</span></a>';
            }).join('');
            // True load failures fall back to the same styled tile.
            grid.querySelectorAll('.pdp-related-photo img').forEach(function (im) {
                im.addEventListener('error', function () {
                    const photo = im.parentElement;
                    im.remove();
                    if (photo) { photo.classList.add('is-pending'); photo.textContent = 'Photo coming soon'; }
                });
            });
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
        $('methodAlert').innerHTML = '<div class="skeleton skeleton-block" aria-hidden="true"></div>';
        $('pdpConfigurator').hidden = true;
        showContent();

        // Non-blocking secondary loads
        loadInventory();
        loadRelated();

        // Configurator gated by eligibility (cached 1h in sessionStorage);
        // it calls onChange → updateCtas as prices land.
        await initConfigurator();
        updateCtas();
    }

    function init() {
        wireChrome();
        wireGalleryFallback();

        const params = getParams();
        if (!params.style) {
            showFatal('No product selected',
                'This page needs a style number — try browsing the catalog or searching above.', false);
            return;
        }
        state.style = params.style;
        $('fatalRetry').addEventListener('click', function () { loadAll(params.color); });
        const addBtn = $('cfgAddToQuote');
        if (addBtn) addBtn.addEventListener('click', onAddToQuote);
        loadAll(params.color);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
