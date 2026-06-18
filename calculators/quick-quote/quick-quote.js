/**
 * quick-quote.js — staff "Quick Quote" tool.
 *
 * A fast, customer-record-free price lookup for reps on the phone or mid-order
 * in ShopWorks. Type a style + quantity + placement → see every eligible
 * decoration method's price at once.
 *
 * IRON RULE (same as the product-page configurator): every price comes from
 * QuoteCartEngine.singleItemPreview() — the SAME authorities the staff quote
 * builders and the customer catalog use. This file computes ZERO prices of its
 * own, so Quick Quote, the Quote Builder, and the online catalog cannot drift.
 *
 * More detail than the catalog (real stitch counts, exact placements, per-size
 * 2XL+ upcharges, all methods at once) — less ceremony than the Quote Builder
 * (no customer, no shipping, no save).
 */
(function () {
    'use strict';

    var API_BASE = (window.APP_CONFIG && window.APP_CONFIG.API && window.APP_CONFIG.API.BASE_URL)
        || 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';

    function $(id) { return document.getElementById(id); }
    function r2(v) { return Math.round((v + Number.EPSILON) * 100) / 100; }
    function num(v) { var n = parseFloat(v); return isNaN(n) ? 0 : n; }
    function fmt(v) { var n = Number(v); return (v == null || isNaN(n)) ? '—' : '$' + n.toFixed(2); }
    function esc(s) {
        if (s == null) return '';
        return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }
    function debounce(fn, ms) {
        var t; return function () { var a = arguments, c = this; clearTimeout(t); t = setTimeout(function () { fn.apply(c, a); }, ms); };
    }

    // ============================================================
    // Shared EMB calculator singleton (mirrors pdp-configurator.js — one
    // EmbroideryPricingCalculator instance so its promise-cached config and
    // per-style size-pricing cache survive across reprices).
    // ============================================================
    var sharedEmbCalc = null;
    function SharedEmbCalc(opts) {
        if (!sharedEmbCalc) sharedEmbCalc = new window.EmbroideryPricingCalculator(opts || { skipInit: true });
        return sharedEmbCalc;
    }
    function resetEmbCalc() { sharedEmbCalc = null; }
    function engineDeps() {
        var d = {};
        if (window.EmbroideryPricingCalculator) d.EmbroideryPricingCalculator = SharedEmbCalc;
        return d;
    }

    // ============================================================
    // Placements (cap-aware) — same combos the staff authorities price natively.
    // ============================================================
    var GARMENT_LOCATIONS = [
        { key: 'leftChest', label: 'Left chest', sub: 'Logo size' },
        { key: 'fullFront', label: 'Full front', sub: 'Big center print' },
        { key: 'back', label: 'Back', sub: 'Full back' },
        { key: 'frontBack', label: 'Front + back', sub: 'Left chest + full back' }
    ];
    var CAP_LOCATIONS = [
        { key: 'front', label: 'Cap front', sub: 'Front logo' },
        { key: 'frontBack', label: 'Front + back', sub: 'Front + back logos' }
    ];
    var DTG_CODES = { leftChest: 'LC', fullFront: 'FF', back: 'FB', frontBack: 'LC_FB' };
    var DTF_KEYS = {
        leftChest: { locations: ['left-chest'] },
        fullFront: { locations: ['full-front'] },
        back: { locations: ['full-back'] },
        frontBack: { locations: ['left-chest', 'full-back'] }
    };

    var ICONS = {
        emb: '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="8"/><path d="M12 4v16M4 12h16"/></svg>',
        capemb: '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 16h18l-2-2H5z"/><path d="M5 14c0-4.5 3-7 7-7s7 2.5 7 7"/></svg>',
        dtg: '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="6" y="9" width="12" height="7" rx="1"/><path d="M6 13H4v-3h2M18 13h2v-3h-2M8 16v3h8v-3"/></svg>',
        scp: '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l9 5-9 5-9-5 9-5z"/><path d="M3 13l9 5 9-5"/></svg>',
        dtf: '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3c2 3 4 5 4 8a4 4 0 0 1-8 0c0-1 .5-2 1-3 .5 2 2 2 2 0 0-2-1-3 1-5z"/></svg>'
    };

    // ============================================================
    // Method definitions — group builders parameterized by the advanced inputs.
    // groupId / option shapes match quote-cart-engine.js exactly.
    // ============================================================
    var METHODS = {
        emb: {
            label: 'Embroidery', engineMethod: 'EMB', icon: ICONS.emb,
            supports: { leftChest: true, fullFront: false, back: true, frontBack: true },
            groups: function () {
                var primary = {
                    position: state.loc === 'back' ? 'Back' : 'Left Chest',
                    stitchCount: num(state.adv.embStitch) || 8000,
                    needsDigitizing: !!state.adv.digitizing
                };
                var additional = state.loc === 'frontBack'
                    ? [{ position: 'Back', stitchCount: num(state.adv.embBackStitch) || 8000, needsDigitizing: !!state.adv.digitizing }]
                    : [];
                return { 'emb:garment': { logos: { primary: primary, additional: additional } } };
            }
        },
        capemb: {
            label: 'Cap embroidery', engineMethod: 'CAP', isCap: true, icon: ICONS.capemb,
            supports: { front: true, frontBack: true },
            groups: function () {
                var additional = state.loc === 'frontBack'
                    ? [{ position: 'Cap Back', stitchCount: num(state.adv.embBackStitch) || 5000, needsDigitizing: !!state.adv.digitizing }]
                    : [];
                return {
                    'emb:cap': {
                        logos: {
                            primary: { position: 'Cap Front', stitchCount: num(state.adv.embStitch) || 8000, needsDigitizing: !!state.adv.digitizing },
                            additional: additional
                        }
                    }
                };
            }
        },
        dtg: {
            label: 'DTG print', engineMethod: 'DTG', icon: ICONS.dtg,
            supports: { leftChest: true, fullFront: true, back: true, frontBack: true },
            groups: function () { return { 'dtg:main': { locationCode: DTG_CODES[state.loc] } }; }
        },
        scp: {
            label: 'Screen print', engineMethod: 'SCP', icon: ICONS.scp,
            supports: { leftChest: true, fullFront: true, back: true, frontBack: true },
            groups: function () {
                return {
                    'scp:design-1': {
                        frontColors: state.ink,
                        backColors: state.loc === 'frontBack' ? state.ink : 0,
                        darkGarment: !!state.adv.scpDark,
                        safetyStripes: !!state.adv.scpStripes
                    }
                };
            }
        },
        dtf: {
            label: 'DTF transfer', engineMethod: 'DTF', icon: ICONS.dtf,
            supports: { leftChest: true, fullFront: true, back: true, frontBack: true },
            groups: function () { return { 'dtf:main': { locations: DTF_KEYS[state.loc].locations } }; }
        }
    };

    // ============================================================
    // STATE
    // ============================================================
    var state = {
        product: null,      // { style, name, isCap, colors:[{name,catalog}], category }
        color: null,        // { name, catalog }
        qty: 24,
        useSizes: false,
        sizes: {},          // { 'S':n, ... } when useSizes
        loc: 'leftChest',
        ink: 1,
        adv: { embStitch: 8000, embBackStitch: 8000, digitizing: false, scpDark: false, scpStripes: false },
        methods: [],        // [{id}]
        results: {},        // id -> { status, preview, summary, message }
        seq: 0
    };

    function currentLocations() { return state.product && state.product.isCap ? CAP_LOCATIONS : GARMENT_LOCATIONS; }
    function sizeList() { return (state.product && state.product.sizes) || []; }
    function defaultSizes() { return (state.product && state.product.isCap) ? ['OSFA'] : ['S', 'M', 'L', 'XL', '2XL', '3XL', '4XL']; }
    function stdSize() {
        var sizes = sizeList();
        if (state.product && state.product.isCap) return sizes.indexOf('OSFA') >= 0 ? 'OSFA' : (sizes[0] || 'OSFA');
        return sizes.indexOf('S') >= 0 ? 'S' : (sizes.indexOf('OSFA') >= 0 ? 'OSFA' : (sizes[0] || 'S'));
    }

    function totalQty() {
        if (state.useSizes) {
            return sizeList().reduce(function (s, sz) { return s + (num(state.sizes[sz]) || 0); }, 0);
        }
        return num(state.qty) || 0;
    }
    function currentSizes() {
        if (state.useSizes) {
            var out = {};
            sizeList().forEach(function (sz) { var q = num(state.sizes[sz]) || 0; if (q > 0) out[sz] = q; });
            return out;
        }
        var m = {}; m[stdSize()] = num(state.qty) || 0; return m;
    }

    // ============================================================
    // STYLE LOOKUP
    // ============================================================
    function isCapProduct(category, title, style) {
        return /cap|hat|beanie|visor/i.test(category || '')
            || /\bcaps?\b|beanie|trucker|snapback/i.test(title || '')
            || /^(c\d{2,4}|ne\d{3,4})$/i.test(style || '');
    }

    var lookupSeq = 0;
    var sizeSeq = 0;
    function lookupStyle(raw) {
        var style = String(raw || '').trim().toUpperCase();
        var statusEl = $('qqStyleStatus');
        if (!style) { statusEl.innerHTML = ''; state.product = null; renderAll(); return; }
        statusEl.innerHTML = '<span class="loading">Looking up ' + esc(style) + '…</span>';
        var token = ++lookupSeq;

        fetch(API_BASE + '/api/product-details?styleNumber=' + encodeURIComponent(style))
            .then(function (r) { if (!r.ok) throw new Error('not found (' + r.status + ')'); return r.json(); })
            .then(function (rows) {
                if (token !== lookupSeq) return;
                if (!Array.isArray(rows) || rows.length === 0) throw new Error('no product');
                var meta = rows[0];
                var title = meta.PRODUCT_TITLE || style;
                var category = meta.CATEGORY_NAME || '';
                var subcat = meta.SUBCATEGORY_NAME || '';
                var desc = meta.PRODUCT_DESCRIPTION || '';
                var cap = isCapProduct(category, title, style);

                // unique colors keyed by CATALOG_COLOR (+ swatch & image for the picker)
                var seen = {}, colors = [];
                rows.forEach(function (row) {
                    var cat = row.CATALOG_COLOR; if (!cat || seen[cat]) return;
                    seen[cat] = 1;
                    colors.push({
                        name: row.COLOR_NAME || cat, catalog: cat,
                        swatch: row.COLOR_SQUARE_IMAGE || '',
                        image: row.MAIN_IMAGE_URL || row.FRONT_MODEL || row.PRODUCT_IMAGE || row.FRONT_FLAT || ''
                    });
                });

                state.product = {
                    style: style, name: cleanName(title, style), isCap: cap,
                    category: category, subcategory: subcat, description: desc,
                    colors: colors, sizes: null
                };
                state.color = colors.length ? colors[0] : null;
                statusEl.innerHTML = '';

                return resolveEligibility(state.product).then(function (elig) {
                    if (token !== lookupSeq) return;
                    applyProduct(elig);
                    loadSizes(); // refines the real size run for this style/color, then reprices
                });
            })
            .catch(function (err) {
                if (token !== lookupSeq) return;
                state.product = null;
                statusEl.innerHTML = '<span class="err">Couldn\'t find “' + esc(style) + '” — check the style number.</span>';
                renderAll();
            });
    }

    function cleanName(title, style) {
        return String(title || '').replace(new RegExp('[.\\s]+' + style + '\\s*$', 'i'), '').trim() || style;
    }

    function resolveEligibility(product) {
        if (product.isCap) return Promise.resolve(null); // caps → cap embroidery only
        if (!window.DecorationMethods || typeof window.DecorationMethods.eligibleFor !== 'function') {
            return Promise.resolve({ EMB: true, DTG: 'no', SCP: false, DTF: false, source: 'fallback' });
        }
        try {
            var p = window.DecorationMethods.eligibleFor({
                STYLE: product.style, CATEGORY_NAME: product.category,
                SUBCATEGORY_NAME: product.subcategory, PRODUCT_DESCRIPTION: product.description
            });
            return Promise.resolve(p);
        } catch (e) {
            return Promise.resolve({ EMB: true, DTG: 'no', SCP: false, DTF: false, source: 'fallback' });
        }
    }

    // Real per-style size run (XS–6XL, tall, youth, OSFA…) — same endpoint the
    // quote builders use, so the breakdown shows exactly what's orderable and
    // the engine applies each size's real upcharge.
    function loadSizes() {
        if (!state.product) return;
        var style = state.product.style;
        var token = ++sizeSeq;
        // The BLANK garment bundle is the reliable source for a style's real size
        // run (incl. 5XL/6XL). /api/sizes-by-style-color is currently unreliable
        // (500s upstream). This is also the same bundle the engine fetches for
        // pricing, so it's already warm in cache.
        var url = API_BASE + '/api/pricing-bundle?method=BLANK&styleNumber=' + encodeURIComponent(style);
        fetch(url)
            .then(function (r) { return r.ok ? r.json() : null; })
            .then(function (d) {
                if (token !== sizeSeq) return;
                var arr = d && (d.sizes || (d.pricing && d.pricing.sizes) || (d.data && d.data.sizes));
                var sizes = (Array.isArray(arr) && arr.length)
                    ? arr.map(function (s) { return (s && s.size) ? s.size : s; }).filter(Boolean)
                    : defaultSizes();
                finishSizes(sizes);
            })
            .catch(function () { if (token !== sizeSeq) return; finishSizes(defaultSizes()); });
    }

    function finishSizes(sizes) {
        state.product.sizes = sizes;
        // keep only quantities for sizes this style/color actually offers
        var kept = {};
        sizes.forEach(function (s) { if (state.sizes[s]) kept[s] = state.sizes[s]; });
        state.sizes = kept;
        // a single-size product (most caps) doesn't need the breakdown
        $('qqSizesToggle').style.display = sizes.length > 1 ? '' : 'none';
        if (state.useSizes && sizes.length <= 1) {
            state.useSizes = false; $('qqSizes').hidden = true; $('qqQty').disabled = false;
            $('qqSizesToggle').setAttribute('aria-expanded', 'false');
            $('qqSizesToggle').textContent = '+ Add sizes (2XL upcharges)';
        }
        if (state.useSizes) { buildSizeGrid(); $('qqQty').value = totalQty(); }
        repriceAll();
    }

    function applyProduct(elig) {
        if (state.product.isCap) {
            state.methods = [{ id: 'capemb' }];
            state.loc = 'front';
            state.adv.embStitch = 8000; state.adv.embBackStitch = 5000;
        } else {
            var e = elig || { EMB: true, DTG: 'no', SCP: false, DTF: false };
            state.methods = [
                { id: 'emb', on: e.EMB },
                { id: 'dtg', on: e.DTG && e.DTG !== 'no' },
                { id: 'scp', on: e.SCP },
                { id: 'dtf', on: e.DTF }
            ].filter(function (m) { return m.on; }).map(function (m) { return { id: m.id }; });
            state.loc = 'leftChest';
            state.adv.embStitch = 8000; state.adv.embBackStitch = 8000;
        }
        state.results = {}; // drop the previous product's cards while the new ones load
        renderColorSwatches();
        renderThumb();
        renderPlacements();
        renderInkField();
        renderAdvancedGroups();
        syncAdvancedInputs();
        renderAll();
        // reprice happens in loadSizes() once the real size run is known
    }

    // ============================================================
    // PRICING
    // ============================================================
    function buildItem(def) {
        var c = state.color || {};
        return {
            id: '__qq__', method: def.engineMethod,
            styleNumber: state.product.style, title: state.product.name,
            colorName: c.name || '', catalogColor: c.catalog || '',
            isCap: def.isCap === true, sizes: currentSizes()
        };
    }

    function summarize(p) {
        var fees = p.fees || [];
        var oneTime = fees.reduce(function (s, f) { return s + (f.oneTime ? f.amount : 0); }, 0);
        var qty = p.itemQuantity || totalQty();
        return {
            total: p.groupTotal,
            perPiece: qty > 0 ? r2((p.groupTotal - oneTime) / qty) : null,
            oneTimeFees: fees.filter(function (f) { return f.oneTime; }),
            ltm: p.ltm || { fee: 0 },
            tierLabel: p.tierLabel,
            serviceLines: p.serviceLines || []
        };
    }

    function priceMethod(id, token) {
        var def = METHODS[id];
        state.results[id] = { status: 'loading' };
        renderResults();
        var run;
        if (!def.supports[state.loc]) {
            state.results[id] = { status: 'unavailable', message: def.label + " isn't offered for this placement." };
            renderResults(); return;
        }
        if (!window.QuoteCartEngine) {
            state.results[id] = { status: 'error', message: 'Pricing engine not loaded' };
            renderResults(); return;
        }
        try {
            run = window.QuoteCartEngine.singleItemPreview(buildItem(def), { groups: def.groups(), deps: engineDeps(), nudge: false });
        } catch (e) {
            state.results[id] = { status: 'error', message: e.message || 'pricing error' };
            renderResults(); return;
        }
        run.then(function (preview) {
            if (token !== state.seq) return;
            if (!preview.ok) {
                if (preview.error && preview.error.code === 'BELOW_MINIMUM') {
                    state.results[id] = { status: 'belowmin', message: preview.error.message, minQuantity: preview.error.minQuantity };
                } else {
                    state.results[id] = { status: 'error', message: (preview.error && preview.error.message) || 'Pricing failed' };
                }
            } else {
                state.results[id] = { status: 'ok', preview: preview, summary: summarize(preview) };
            }
            renderResults();
        }).catch(function (err) {
            if (token !== state.seq) return;
            console.error('[quick-quote] price failed', id, err);
            state.results[id] = { status: 'error', message: (err && err.message) || 'pricing error' };
            if (id === 'emb' || id === 'capemb') resetEmbCalc();
            renderResults();
        });
    }

    function repriceAll() {
        if (!state.product || state.methods.length === 0) { renderResults(); return; }
        if (totalQty() <= 0) { state.results = {}; renderResults(); return; }
        var token = ++state.seq;
        state.results = {};
        state.methods.forEach(function (m) { priceMethod(m.id, token); });
    }
    var repriceDebounced = debounce(repriceAll, 300);

    // ============================================================
    // RENDER
    // ============================================================
    function renderColorSwatches() {
        var field = $('qqColorField'), box = $('qqColorSwatches');
        var colors = (state.product && state.product.colors) || [];
        if (colors.length <= 1) { field.hidden = true; box.innerHTML = ''; return; }
        field.hidden = false;
        box.innerHTML = colors.map(function (c) {
            var active = state.color && c.catalog === state.color.catalog;
            var swatchUrl = String(c.swatch || '').replace(/["'()\\\s]/g, '');
            var bg = /^https?:\/\//i.test(swatchUrl)
                ? "background-image:url('" + swatchUrl + "')"
                : 'background-color:#cccccc';
            return '<button type="button" class="qq-swatch' + (active ? ' is-active' : '')
                + '" data-cat="' + esc(c.catalog) + '" title="' + esc(c.name) + '" aria-label="' + esc(c.name) + '" style="' + bg + '"></button>';
        }).join('');
    }

    function renderThumb() {
        var wrap = $('qqProduct'), img = $('qqThumb'), name = $('qqProductName'), colorEl = $('qqColorSelected');
        if (!state.product) { wrap.hidden = true; return; }
        wrap.hidden = false;
        name.innerHTML = esc(state.product.name) + (state.product.isCap ? ' <span class="cap">CAP</span>' : '');
        var imgUrl = state.color && state.color.image ? state.color.image : '';
        if (imgUrl) { img.src = imgUrl; img.style.display = ''; } else { img.removeAttribute('src'); img.style.display = 'none'; }
        colorEl.textContent = state.color ? state.color.name : '';
    }

    function renderPlacements() {
        var box = $('qqPlacements');
        box.innerHTML = currentLocations().map(function (l) {
            return '<button type="button" class="qq-chip' + (l.key === state.loc ? ' is-active' : '')
                + '" data-loc="' + l.key + '"><span class="t">' + esc(l.label) + '</span>'
                + '<span class="s">' + esc(l.sub) + '</span></button>';
        }).join('');
    }

    function renderInkField() {
        var hasScp = state.methods.some(function (m) { return m.id === 'scp'; });
        $('qqInkField').hidden = !hasScp;
    }

    function renderAdvancedGroups() {
        var hasEmb = state.methods.some(function (m) { return m.id === 'emb' || m.id === 'capemb'; });
        var hasScp = state.methods.some(function (m) { return m.id === 'scp'; });
        $('qqAdvEmb').hidden = !hasEmb;
        $('qqAdvScp').hidden = !hasScp;
        // Back-logo input only relevant on a front+back placement
        $('qqEmbBackField').style.display = state.loc === 'frontBack' ? '' : 'none';
        $('qqEmbBackLabel').textContent = (state.product && state.product.isCap) ? 'Cap back logo' : 'Back logo';
    }

    function syncAdvancedInputs() {
        $('qqEmbStitch').value = state.adv.embStitch;
        $('qqEmbBackStitch').value = state.adv.embBackStitch;
        $('qqInk').value = state.ink;
        $('qqQty').value = state.qty;
    }

    function buildSizeGrid() {
        $('qqSizeGrid').innerHTML = sizeList().map(function (sz) {
            return '<div class="qq-size-cell"><label for="qqs_' + sz + '">' + esc(sz) + '</label>'
                + '<input id="qqs_' + sz + '" type="number" min="0" step="1" data-size="' + sz + '" value="' + (state.sizes[sz] || '') + '"></div>';
        }).join('');
    }

    function renderResults() {
        var box = $('qqResults');
        var sub = $('qqResultsSub');
        if (!state.product) { box.innerHTML = '<div class="qq-empty">Enter a style number to see pricing.</div>'; sub.textContent = 'Enter a style to begin'; return; }
        if (state.methods.length === 0) { box.innerHTML = '<div class="qq-empty">No standard decoration method for this product — price it personally.</div>'; sub.textContent = ''; return; }
        if (totalQty() <= 0) { box.innerHTML = '<div class="qq-empty">Enter a quantity.</div>'; sub.textContent = ''; return; }

        var qty = totalQty();
        var cName = state.color ? (' · ' + state.color.name) : '';
        sub.textContent = 'for ' + qty + ' ' + (state.product.isCap ? (qty === 1 ? 'cap' : 'caps') : (qty === 1 ? 'piece' : 'pieces')) + cName;

        // cheapest by total among ok results → "best value" tag
        var bestId = null, bestTotal = Infinity;
        state.methods.forEach(function (m) {
            var r = state.results[m.id];
            if (r && r.status === 'ok' && r.summary.total != null && r.summary.total < bestTotal) { bestTotal = r.summary.total; bestId = m.id; }
        });

        box.innerHTML = state.methods.map(function (m) { return renderCard(m.id, m.id === bestId); }).join('');

        // wire retry buttons
        Array.prototype.forEach.call(box.querySelectorAll('.qq-retry'), function (btn) {
            btn.addEventListener('click', function () { var id = btn.getAttribute('data-id'); priceMethod(id, ++state.seq); });
        });
    }

    function renderCard(id, isBest) {
        var def = METHODS[id];
        var r = state.results[id];
        var head = '<div class="qq-card-method">' + def.icon + '<span>' + esc(def.label) + '</span></div>';

        if (!r || r.status === 'loading') {
            return '<div class="qq-card"><div class="qq-card-top">' + head + '<div class="qq-skeleton" style="width:120px"></div></div></div>';
        }
        if (r.status === 'unavailable') {
            return '<div class="qq-card is-unavailable"><div class="qq-card-top">' + head + '</div><div class="qq-card-msg">' + esc(r.message) + '</div></div>';
        }
        if (r.status === 'belowmin') {
            return '<div class="qq-card is-unavailable"><div class="qq-card-top">' + head + '</div><div class="qq-card-msg">' + esc(r.message) + '</div></div>';
        }
        if (r.status === 'error') {
            return '<div class="qq-card is-error"><div class="qq-card-top">' + head + '</div>'
                + '<div class="qq-card-msg">Pricing unavailable — ' + esc(r.message) + '</div>'
                + '<button type="button" class="qq-retry" data-id="' + id + '">Retry</button></div>';
        }

        var s = r.summary;
        var unitWord = state.product.isCap ? 'cap' : 'pc';
        var meta = [];
        if (s.tierLabel) meta.push('<span class="item tier">' + esc(s.tierLabel) + ' tier</span>');
        if (s.ltm && s.ltm.fee > 0) meta.push('<span class="item ltm">incl. $' + Math.round(s.ltm.fee) + ' small-batch fee</span>');
        s.oneTimeFees.forEach(function (f) { meta.push('<span class="item fee">+ ' + fmt(f.amount) + ' ' + esc(f.label) + ' (one-time)</span>'); });

        return '<div class="qq-card' + (isBest ? ' is-best' : '') + '">'
            + '<div class="qq-card-top">' + head
            + '<div class="qq-card-price"><div class="qq-card-pp">' + fmt(s.perPiece) + '<span class="per">/' + unitWord + '</span></div>'
            + '<div class="qq-card-total">' + fmt(s.total) + ' total' + (isBest ? ' <span class="qq-best-tag">best value</span>' : '') + '</div></div></div>'
            + (meta.length ? '<div class="qq-card-meta">' + meta.join('') + '</div>' : '')
            + '</div>';
    }

    function renderAll() {
        renderResults();
    }

    // ============================================================
    // WIRING
    // ============================================================
    function wire() {
        if (!window.QuoteCartEngine) { $('qqEngineError').hidden = false; }

        $('qqStyle').addEventListener('input', debounce(function (e) { lookupStyle(e.target.value); }, 450));

        $('qqColorSwatches').addEventListener('click', function (e) {
            var b = e.target.closest('.qq-swatch'); if (!b || !state.product) return;
            var cat = b.getAttribute('data-cat');
            state.color = (state.product.colors || []).filter(function (c) { return c.catalog === cat; })[0] || state.color;
            renderColorSwatches();
            renderThumb();
            repriceAll(); // sizes are style-level; just re-price (EMB cost varies by color)
        });

        $('qqQty').addEventListener('input', function (e) {
            if (state.useSizes) return; // qty is computed from sizes
            state.qty = Math.max(1, parseInt(e.target.value, 10) || 0);
            repriceDebounced();
        });

        $('qqSizesToggle').addEventListener('click', function () {
            state.useSizes = !state.useSizes;
            var panel = $('qqSizes');
            panel.hidden = !state.useSizes;
            $('qqSizesToggle').setAttribute('aria-expanded', String(state.useSizes));
            $('qqSizesToggle').textContent = state.useSizes ? '− Use a single quantity' : '+ Add sizes (2XL upcharges)';
            $('qqQty').disabled = state.useSizes;
            if (state.useSizes) {
                if (!Object.keys(state.sizes).length) { state.sizes[stdSize()] = state.qty; }
                buildSizeGrid();
            }
            $('qqQty').value = totalQty();
            repriceAll();
        });

        $('qqSizeGrid').addEventListener('input', function (e) {
            var sz = e.target.getAttribute('data-size'); if (!sz) return;
            state.sizes[sz] = Math.max(0, parseInt(e.target.value, 10) || 0);
            $('qqQty').value = totalQty();
            repriceDebounced();
        });

        $('qqPlacements').addEventListener('click', function (e) {
            var btn = e.target.closest('.qq-chip'); if (!btn) return;
            state.loc = btn.getAttribute('data-loc');
            renderPlacements();
            renderAdvancedGroups();
            repriceAll();
        });

        $('qqInk').addEventListener('input', function (e) {
            state.ink = Math.min(6, Math.max(1, parseInt(e.target.value, 10) || 1));
            repriceDebounced();
        });

        $('qqEmbStitch').addEventListener('input', function (e) { state.adv.embStitch = Math.max(1000, parseInt(e.target.value, 10) || 8000); repriceDebounced(); });
        $('qqEmbBackStitch').addEventListener('input', function (e) { state.adv.embBackStitch = Math.max(1000, parseInt(e.target.value, 10) || 8000); repriceDebounced(); });
        $('qqEmbDigitizing').addEventListener('change', function (e) { state.adv.digitizing = e.target.checked; repriceAll(); });
        $('qqScpDark').addEventListener('change', function (e) { state.adv.scpDark = e.target.checked; repriceAll(); });
        $('qqScpStripes').addEventListener('change', function (e) { state.adv.scpStripes = e.target.checked; repriceAll(); });

        renderResults();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', wire);
    } else {
        wire();
    }
})();
