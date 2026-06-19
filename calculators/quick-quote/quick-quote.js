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
    function parseRange(label) {
        var m = String(label || '').match(/^(\d+)\s*-\s*(\d+)/);
        if (m) return { min: parseInt(m[1], 10), max: parseInt(m[2], 10) };
        var p = String(label || '').match(/^(\d+)\s*\+/);
        if (p) return { min: parseInt(p[1], 10), max: Infinity };
        return { min: 0, max: Infinity };
    }
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
    // Print placement (DTG/SCP/DTF only — embroidery is logo-based). Independent
    // FRONT + BACK pickers + DTF sleeves, mirroring the staff builders.
    var FRONT_OPTS = [
        { code: '', label: 'None' },
        { code: 'LC', label: 'Left chest' },
        { code: 'FF', label: 'Full front' },
        { code: 'JF', label: 'Jumbo front' }
    ];
    var BACK_OPTS = [
        { code: '', label: 'None' },
        { code: 'FB', label: 'Full back' },
        { code: 'JB', label: 'Jumbo back' }
    ];
    // Cap embellishment type (cap embroidery only) — priced by the engine via the cap primary logo.
    var CAP_EMB_OPTS = [
        { code: 'embroidery', label: 'Flat embroidery' },
        { code: '3d-puff', label: '3D puff' },
        { code: 'laser-patch', label: 'Laser patch' }
    ];
    // DTG combos the canonical pricer accepts (FF_JB / JF_FB have no DTG_Costs data → blocked).
    var DTG_LOCATION_CODES = ['LC', 'FF', 'FB', 'JF', 'JB', 'LC_FB', 'FF_FB', 'JF_JB', 'LC_JB'];
    // DTF has no "jumbo" transfer size → jumbo maps to the largest (full) location.
    var DTF_FRONT = { LC: 'left-chest', FF: 'full-front', JF: 'full-front' };
    var DTF_BACK = { FB: 'full-back', JB: 'full-back' };
    var FRONT_LABELS = { LC: 'Left chest', FF: 'Full front', JF: 'Jumbo front' };
    var BACK_LABELS = { FB: 'Full back', JB: 'Jumbo back' };

    // --- placement → per-method mapping (reads state.front / state.back / state.sleeves) ---
    function dtgCode() { var f = state.front, b = state.back; return (f && b) ? (f + '_' + b) : (f || b || ''); }
    function dtgPriceable() { var c = dtgCode(); return !!c && DTG_LOCATION_CODES.indexOf(c) >= 0; }
    function dtfLocations() {
        var L = [];
        if (state.front && DTF_FRONT[state.front]) L.push(DTF_FRONT[state.front]);
        if (state.back && DTF_BACK[state.back]) L.push(DTF_BACK[state.back]);
        if (state.sleeves.left) L.push('left-sleeve');
        if (state.sleeves.right) L.push('right-sleeve');
        return L;
    }
    function scpLocCount() { return (state.front ? 1 : 0) + (state.back ? 1 : 0); }

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
            // Embroidery is LOGO-based, not placement-based: a primary left-chest
            // logo + any additional logos (each priced at the AL rate). It ignores
            // the print-placement chips (those drive DTG/SCP/DTF only).
            available: function () { return true; },
            groups: function () {
                return {
                    'emb:garment': {
                        logos: {
                            primary: { position: 'Left Chest', stitchCount: num(state.adv.embStitch) || 8000, needsDigitizing: !!state.adv.digitizing },
                            additional: state.embAddl.map(function (a) {
                                return { position: 'Additional Logo', stitchCount: num(a.stitch) || 8000, needsDigitizing: false };
                            })
                        }
                    }
                };
            }
        },
        capemb: {
            label: 'Cap embroidery', engineMethod: 'CAP', isCap: true, icon: ICONS.capemb,
            // Cap front (primary) + optional cap back(s) — cap back priced at the
            // quote builder's cap-back rate. Ignores print placement.
            available: function () { return true; },
            groups: function () {
                return {
                    'emb:cap': {
                        logos: {
                            primary: { position: 'Cap Front', stitchCount: num(state.adv.embStitch) || 8000, needsDigitizing: !!state.adv.digitizing, embellishmentType: state.capEmb },
                            additional: state.embAddl.map(function (a) {
                                return { position: 'Cap Back', stitchCount: num(a.stitch) || 5000, needsDigitizing: false };
                            })
                        }
                    }
                };
            }
        },
        dtg: {
            label: 'DTG print', engineMethod: 'DTG', icon: ICONS.dtg,
            available: function () { return dtgPriceable(); },
            groups: function () { return { 'dtg:main': { locationCode: dtgCode() } }; }
        },
        scp: {
            label: 'Screen print', engineMethod: 'SCP', icon: ICONS.scp,
            available: function () { return scpLocCount() >= 1; },
            groups: function () {
                return {
                    'scp:design-1': {
                        frontColors: state.ink,                          // location size is cosmetic for SCP
                        backColors: scpLocCount() >= 2 ? state.ink : 0,  // 2nd location (back) = additional location
                        darkGarment: !!state.adv.scpDark,
                        safetyStripes: !!state.adv.scpStripes
                    }
                };
            }
        },
        dtf: {
            label: 'DTF transfer', engineMethod: 'DTF', icon: ICONS.dtf,
            available: function () { return dtfLocations().length >= 1; },
            groups: function () { return { 'dtf:main': { locations: dtfLocations() } }; }
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
        front: 'LC',          // print FRONT placement: '' | LC | FF | JF
        back: '',             // print BACK placement: '' | FB | JB
        sleeves: { left: false, right: false }, // DTF sleeves
        ink: 1,
        adv: { embStitch: 8000, embBackStitch: 8000, digitizing: false, scpDark: false, scpStripes: false },
        embAddl: [],          // additional embroidery logos: [{stitch}] (garment AL / cap back)
        capEmb: 'embroidery', // cap embellishment: 'embroidery' | '3d-puff' | 'laser-patch'
        methods: [],          // [{id}]
        results: {},          // id -> { status, preview, summary, message }
        selectedMethod: null, // which method's price-breaks matrix is shown
        methodPinned: false,  // true once the rep clicks a card (stop auto-following best value)
        seq: 0
    };

    function placementLabel() {
        var parts = [];
        if (FRONT_LABELS[state.front]) parts.push(FRONT_LABELS[state.front]);
        if (BACK_LABELS[state.back]) parts.push(BACK_LABELS[state.back]);
        if (state.sleeves.left) parts.push('L sleeve');
        if (state.sleeves.right) parts.push('R sleeve');
        return parts.join(' + ') || '—';
    }
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
            state.front = 'LC'; state.back = ''; state.sleeves = { left: false, right: false };
            state.adv.embStitch = 8000; state.adv.embBackStitch = 5000;
        } else {
            var e = elig || { EMB: true, DTG: 'no', SCP: false, DTF: false };
            state.methods = [
                { id: 'emb', on: e.EMB },
                { id: 'dtg', on: e.DTG && e.DTG !== 'no' },
                { id: 'scp', on: e.SCP },
                { id: 'dtf', on: e.DTF }
            ].filter(function (m) { return m.on; }).map(function (m) { return { id: m.id }; });
            state.front = 'LC'; state.back = ''; state.sleeves = { left: false, right: false };
            state.adv.embStitch = 8000; state.adv.embBackStitch = 8000;
        }
        state.results = {}; // drop the previous product's cards while the new ones load
        state.selectedMethod = null;
        state.methodPinned = false;
        state.embAddl = [];
        state.capEmb = 'embroidery';
        var mb = $('qqMatrix'); if (mb) mb.innerHTML = '';
        // caps are embroidery-only — the print-placement chips don't apply to them
        $('qqPlacementField').hidden = !!state.product.isCap;
        renderColorSwatches();
        renderThumb();
        renderPlacements();
        renderInkField();
        renderEmbPanel();
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
            serviceLines: p.serviceLines || [],
            nudge: p.nudge || null
        };
    }

    function priceMethod(id, token) {
        var def = METHODS[id];
        state.results[id] = { status: 'loading' };
        renderResults();
        var run;
        if (def.available && !def.available()) {
            var pmsg = id === 'dtg' && dtgCode()
                ? "DTG can't combine those front + back sizes — try Full front + Full back, or Left chest + back."
                : 'Pick a front or back placement above.';
            state.results[id] = { status: 'unavailable', message: pmsg };
            renderResults(); return;
        }
        if (!window.QuoteCartEngine) {
            state.results[id] = { status: 'error', message: 'Pricing engine not loaded' };
            renderResults(); return;
        }
        try {
            run = window.QuoteCartEngine.singleItemPreview(buildItem(def), { groups: def.groups(), deps: engineDeps(), nudge: true });
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
        function chips(opts, sel, kind) {
            return opts.map(function (o) {
                return '<button type="button" class="qq-place-chip' + (o.code === sel ? ' is-active' : '')
                    + '" data-kind="' + kind + '" data-code="' + esc(o.code) + '">' + esc(o.label) + '</button>';
            }).join('');
        }
        $('qqFront').innerHTML = chips(FRONT_OPTS, state.front, 'front');
        $('qqBack').innerHTML = chips(BACK_OPTS, state.back, 'back');
        var sl = $('qqSleeveL'), sr = $('qqSleeveR');
        if (sl) sl.checked = !!state.sleeves.left;
        if (sr) sr.checked = !!state.sleeves.right;
    }

    function renderInkField() {
        var hasScp = state.methods.some(function (m) { return m.id === 'scp'; });
        $('qqInkField').hidden = !hasScp;
    }

    function renderAdvancedGroups() {
        var hasScp = state.methods.some(function (m) { return m.id === 'scp'; });
        $('qqAdvScp').hidden = !hasScp;
        $('qqAdvanced').hidden = !hasScp; // stitch counts moved to the embroidery panel
    }

    function syncAdvancedInputs() {
        $('qqInk').value = state.ink;
        $('qqQty').value = state.qty;
    }

    // ---- Embroidery logo panel (logo-based, decoupled from print placement) ----
    function embLogoRow(key, label, stitch, removable) {
        var badge = key === 'primary' ? 'Logo 1' : 'Logo ' + (Number(key) + 2);
        return '<div class="qq-emb-row">'
            + '<span class="qq-emb-badge' + (key === 'primary' ? ' is-primary' : '') + '">' + badge + '</span>'
            + '<span class="qq-emb-pos">' + esc(label) + '</span>'
            + '<span class="qq-emb-stitchwrap">'
            + '<input class="qq-emb-stitch input num" type="number" min="1000" step="500" data-logo="' + esc(key) + '" value="' + (num(stitch) || 8000) + '">'
            + '<span class="qq-emb-st">stitches</span>'
            + (removable ? '<button type="button" class="qq-emb-remove" data-i="' + esc(key) + '" aria-label="Remove logo">&times;</button>' : '')
            + '</span></div>';
    }

    function renderEmbPanel() {
        var field = $('qqEmbField');
        var hasEmb = state.methods.some(function (m) { return m.id === 'emb' || m.id === 'capemb'; });
        if (!hasEmb) { field.hidden = true; return; }
        field.hidden = false;
        var isCap = !!(state.product && state.product.isCap);
        $('qqEmbLabel').textContent = isCap ? 'Cap embroidery logos' : 'Embroidery logos';
        // cap embellishment selector (flat / 3D puff / laser patch) — caps only
        var capWrap = $('qqCapEmbWrap');
        if (isCap) {
            capWrap.hidden = false;
            $('qqCapEmbType').innerHTML = CAP_EMB_OPTS.map(function (o) {
                return '<button type="button" class="qq-place-chip' + (o.code === state.capEmb ? ' is-active' : '')
                    + '" data-cap-emb="' + o.code + '">' + esc(o.label) + '</button>';
            }).join('');
        } else {
            capWrap.hidden = true;
        }
        var rows = [embLogoRow('primary', isCap ? 'Cap front' : 'Left chest', state.adv.embStitch, false)];
        state.embAddl.forEach(function (a, i) {
            rows.push(embLogoRow(String(i), isCap ? 'Cap back' : 'Additional logo', a.stitch, true));
        });
        $('qqEmbLogos').innerHTML = rows.join('');
        var addBtn = $('qqEmbAddBtn');
        var atMax = isCap && state.embAddl.length >= 1;
        addBtn.style.display = atMax ? 'none' : '';
        addBtn.textContent = isCap ? '+ Add cap back' : '+ Add another logo';
        $('qqEmbHint').textContent = isCap
            ? 'Up to 10,000 stitches included. Cap back priced at our cap-back rate.'
            : 'Up to 10,000 stitches included. Each additional logo priced at our additional-logo (AL) rate.';
        var dig = $('qqEmbDigitizing'); if (dig) dig.checked = !!state.adv.digitizing;
    }

    function buildSizeGrid() {
        $('qqSizeGrid').innerHTML = sizeList().map(function (sz) {
            return '<div class="qq-size-cell"><label for="qqs_' + sz + '">' + esc(sz) + '</label>'
                + '<input id="qqs_' + sz + '" type="number" min="0" step="1" data-size="' + sz + '" value="' + (state.sizes[sz] || '') + '"></div>';
        }).join('');
    }

    // ============================================================
    // PRICE-BREAKS MATRIX (selected method)
    // Engine-authoritative: prices a representative qty in each tier through the
    // SAME singleItemPreview() the cards use, so the ladder can't disagree with
    // the quote. The base unit is constant within a tier; the small-batch (LTM)
    // fee is shown on its own row, mirroring our standard pricing matrix.
    // ============================================================
    var PROBE_QTYS = { emb: [4, 12, 36, 60, 100], capemb: [4, 12, 36, 60, 100], dtg: [12, 36, 60, 100], scp: [24, 50, 100, 200], dtf: [15, 36, 60, 100] };
    var _ladderCache = {};
    var _ladderFetching = {};

    function ladderKey(id) {
        return (state.product ? state.product.style : '') + '|' + id
            + '|' + state.front + state.back + (state.sleeves.left ? 'L' : '') + (state.sleeves.right ? 'R' : '') + '|' + state.ink
            + '|' + state.adv.embStitch + '|A' + state.embAddl.map(function (a) { return a.stitch; }).join(',') + '|' + state.capEmb
            + '|' + (state.adv.digitizing ? 1 : 0) + '|' + (state.adv.scpDark ? 1 : 0) + '|' + (state.adv.scpStripes ? 1 : 0)
            + '|' + (state.color ? state.color.catalog : '');
    }
    // (placementLabel defined above — combo of front/back/sleeves)
    function rangeLabel(t) {
        var r = t.range || parseRange(t.label);
        return (!isFinite(r.max)) ? r.min + '+' : r.min + '–' + r.max;
    }

    async function renderMatrix() {
        var box = $('qqMatrix'); if (!box) return;
        var id = state.selectedMethod;
        if (!id || !state.product || !METHODS[id]) { box.innerHTML = ''; return; }
        var def = METHODS[id];
        if (def.available && !def.available()) {
            box.innerHTML = '<p class="qq-matrix-title">Price breaks</p><p class="qq-matrix-msg">'
                + esc(def.label) + " isn't available for this placement.</p>";
            return;
        }
        var key = ladderKey(id);
        if (_ladderCache[key]) { paintMatrix(id, _ladderCache[key]); return; }
        if (_ladderFetching[key]) { return; } // a probe for this exact config is already running
        _ladderFetching[key] = true;
        box.innerHTML = '<p class="qq-matrix-title">Price breaks — ' + esc(def.label) + '</p><div class="qq-skeleton" style="height:84px"></div>';
        var probes = PROBE_QTYS[id] || [12, 36, 60, 100];
        var byTier = {};
        try {
            for (var i = 0; i < probes.length; i++) {
                var item = buildItem(def);
                item.sizes = {}; item.sizes[stdSize()] = probes[i];
                var preview;
                try {
                    preview = await window.QuoteCartEngine.singleItemPreview(item, { groups: def.groups(), deps: engineDeps(), nudge: false });
                } catch (e) { preview = null; }
                if (preview && preview.ok && preview.lines && preview.lines.length) {
                    var label = preview.tierLabel || ('q' + probes[i]);
                    if (!byTier[label]) {
                        // per-piece base = baseUnit + per-piece service lines (AS-GARM stitch
                        // surcharge, additional-logo AL) + any residual per-piece upcharge that
                        // only shows in groupTotal (cap 3D-puff / laser-patch). Clamp >=0 so a
                        // DTG LTM tier's floor under-recovery never shaves a cent.
                        var pq = probes[i];
                        var bu = preview.lines[0].baseUnit;
                        var svcPerPc = (preview.serviceLines || []).reduce(function (s, sl) { return s + (Number(sl.total) || 0); }, 0) / pq;
                        var oneTimeT = (preview.fees || []).reduce(function (s, f) { return s + (f.oneTime ? (Number(f.amount) || 0) : 0); }, 0);
                        var ltmFlat = (preview.ltm && preview.ltm.fee) || 0;
                        var residual = Math.max(0, (preview.groupTotal - oneTimeT - ltmFlat - (bu + svcPerPc) * pq) / pq);
                        byTier[label] = { label: label, base: r2(bu + svcPerPc + residual), ltmFee: ltmFlat, range: parseRange(label) };
                    }
                }
            }
        } catch (err) {
            console.error('[quick-quote] price-breaks build failed:', err);
        } finally {
            delete _ladderFetching[key];
        }
        var tiers = Object.keys(byTier).map(function (k) { return byTier[k]; }).sort(function (a, b) { return a.range.min - b.range.min; });
        _ladderCache[key] = tiers;
        // only paint if this is still the current selection/config
        if (state.selectedMethod === id && ladderKey(id) === key) paintMatrix(id, tiers);
    }

    function paintMatrix(id, tiers) {
        var box = $('qqMatrix'); if (!box) return;
        var def = METHODS[id];
        if (!tiers || !tiers.length) { box.innerHTML = ''; return; }
        var unit = state.product.isCap ? 'cap' : 'pc';
        var res = state.results[id];
        var curTier = (res && res.status === 'ok' && res.summary) ? res.summary.tierLabel : null;
        var hasLtm = tiers.some(function (t) { return t.ltmFee > 0; });
        var head = tiers.map(function (t) { return '<th' + (t.label === curTier ? ' class="is-cur"' : '') + '>' + esc(rangeLabel(t)) + '</th>'; }).join('');
        var priceRow = tiers.map(function (t) { return '<td' + (t.label === curTier ? ' class="is-cur"' : '') + '>' + fmt(t.base) + '</td>'; }).join('');
        var ltmRow = '';
        if (hasLtm) {
            ltmRow = '<tr><td class="lbl">Small-batch fee</td>' + tiers.map(function (t) {
                var cls = (t.label === curTier ? 'is-cur ' : '') + (t.ltmFee > 0 ? 'warn' : '');
                return '<td' + (cls.trim() ? ' class="' + cls.trim() + '"' : '') + '>' + (t.ltmFee > 0 ? '+' + fmt(t.ltmFee) : '—') + '</td>';
            }).join('') + '</tr>';
        }
        var descr = (id === 'emb' || id === 'capemb')
            ? (state.product.isCap && state.capEmb !== 'embroidery' ? (state.capEmb === '3d-puff' ? '3D puff' : 'Laser patch') : '')
            : placementLabel();
        box.innerHTML = '<p class="qq-matrix-title">Price breaks — ' + esc(def.label) + (descr ? ' · ' + esc(descr) : '') + '</p>'
            + '<div class="qq-matrix-wrap"><table class="qq-matrix"><thead><tr><th class="lbl">Quantity</th>' + head + '</tr></thead>'
            + '<tbody><tr><td class="lbl">Per ' + unit + '</td>' + priceRow + '</tr>' + ltmRow + '</tbody></table></div>'
            + '<p class="qq-matrix-note">Highlighted column = your current quantity. Per ' + unit + ' for a standard size — extended sizes (2XL+) add their upcharge. Small-batch fee is one-time per order.</p>';
    }

    var refreshMatrix = debounce(function () { renderMatrix(); }, 250);

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

        // selected method (drives the price-breaks matrix): auto-follow the
        // best-value method until the rep pins one by clicking it.
        var stillValid = state.methods.some(function (m) { return m.id === state.selectedMethod; });
        if (!state.methodPinned || !stillValid) {
            state.selectedMethod = bestId || (state.selectedMethod && stillValid ? state.selectedMethod : (state.methods[0] && state.methods[0].id)) || null;
        }

        box.innerHTML = state.methods.map(function (m) { return renderCard(m.id, m.id === bestId); }).join('');

        // wire retry buttons
        Array.prototype.forEach.call(box.querySelectorAll('.qq-retry'), function (btn) {
            btn.addEventListener('click', function () { var id = btn.getAttribute('data-id'); priceMethod(id, ++state.seq); });
        });

        refreshMatrix();
    }

    function renderCard(id, isBest) {
        var def = METHODS[id];
        var r = state.results[id];
        var head = '<div class="qq-card-method">' + def.icon + '<span>' + esc(def.label) + '</span></div>';

        var dm = ' data-method="' + esc(id) + '"';
        if (!r || r.status === 'loading') {
            return '<div class="qq-card"' + dm + '><div class="qq-card-top">' + head + '<div class="qq-skeleton" style="width:120px"></div></div></div>';
        }
        if (r.status === 'unavailable' || r.status === 'belowmin') {
            return '<div class="qq-card is-unavailable"' + dm + '><div class="qq-card-top">' + head + '</div><div class="qq-card-msg">' + esc(r.message) + '</div></div>';
        }
        if (r.status === 'error') {
            return '<div class="qq-card is-error"' + dm + '><div class="qq-card-top">' + head + '</div>'
                + '<div class="qq-card-msg">Pricing unavailable — ' + esc(r.message) + '</div>'
                + '<button type="button" class="qq-retry" data-id="' + id + '">Retry</button></div>';
        }

        var sel = (id === state.selectedMethod);
        var s = r.summary;
        var unitWord = state.product.isCap ? 'cap' : 'pc';
        var meta = [];
        if (s.tierLabel) meta.push('<span class="item tier">' + esc(s.tierLabel) + ' tier</span>');
        if (s.ltm && s.ltm.fee > 0) meta.push('<span class="item ltm">incl. $' + Math.round(s.ltm.fee) + ' small-batch fee</span>');
        s.oneTimeFees.forEach(function (f) { meta.push('<span class="item fee">+ ' + fmt(f.amount) + ' ' + esc(f.label) + ' (one-time)</span>'); });

        var nudgeHtml = '';
        if (s.nudge && s.nudge.addQty > 0 && (s.nudge.nextPerPiece != null || s.nudge.perPieceSavings > 0)) {
            var n = s.nudge;
            var to = n.nextPerPiece != null ? (' → ' + fmt(n.nextPerPiece) + '/' + unitWord) : '';
            var save = (n.nextPerPiece == null && n.perPieceSavings > 0) ? (' — save ' + fmt(n.perPieceSavings) + '/' + unitWord) : '';
            nudgeHtml = '<div class="qq-card-nudge">↑ Add ' + n.addQty + ' more' + to
                + (n.ltmDisappears ? ' · small-batch fee gone' : '') + save + '</div>';
        }

        return '<div class="qq-card is-clickable' + (isBest ? ' is-best' : '') + (sel ? ' is-selected' : '') + '"' + dm + '>'
            + '<div class="qq-card-top">' + head
            + '<div class="qq-card-price"><div class="qq-card-pp">' + fmt(s.perPiece) + '<span class="per">/' + unitWord + '</span></div>'
            + '<div class="qq-card-total">' + fmt(s.total) + ' total' + (isBest ? ' <span class="qq-best-tag">best value</span>' : '') + '</div></div></div>'
            + (meta.length ? '<div class="qq-card-meta">' + meta.join('') + '</div>' : '')
            + nudgeHtml
            + (sel ? '<div class="qq-card-selhint">price breaks below ↓</div>' : '')
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

        // Click a priced method card to show its price-breaks matrix below.
        $('qqResults').addEventListener('click', function (e) {
            if (e.target.closest('.qq-retry')) return; // retry has its own handler
            var card = e.target.closest('.qq-card[data-method]'); if (!card) return;
            var id = card.getAttribute('data-method');
            var r = state.results[id];
            if (!r || r.status !== 'ok' || id === state.selectedMethod) return;
            state.selectedMethod = id;
            state.methodPinned = true;
            renderResults();   // refresh selection highlight + matrix
        });

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

        $('qqQtyPresets').addEventListener('click', function (e) {
            var b = e.target.closest('[data-qty]'); if (!b || state.useSizes) return;
            state.qty = parseInt(b.getAttribute('data-qty'), 10);
            $('qqQty').value = state.qty;
            repriceAll();
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

        function onPlaceChip(e) {
            var btn = e.target.closest('.qq-place-chip'); if (!btn) return;
            var kind = btn.getAttribute('data-kind'), code = btn.getAttribute('data-code');
            if (kind === 'front') state.front = code; else state.back = code;
            renderPlacements();
            repriceAll();
        }
        $('qqFront').addEventListener('click', onPlaceChip);
        $('qqBack').addEventListener('click', onPlaceChip);
        $('qqSleeveL').addEventListener('change', function (e) { state.sleeves.left = e.target.checked; repriceAll(); });
        $('qqSleeveR').addEventListener('change', function (e) { state.sleeves.right = e.target.checked; repriceAll(); });

        $('qqInk').addEventListener('input', function (e) {
            state.ink = Math.min(6, Math.max(1, parseInt(e.target.value, 10) || 1));
            repriceDebounced();
        });

        // embroidery logo panel (primary + additional logos)
        $('qqEmbLogos').addEventListener('input', function (e) {
            var inp = e.target.closest('.qq-emb-stitch'); if (!inp) return;
            var key = inp.getAttribute('data-logo');
            var val = Math.max(1000, parseInt(inp.value, 10) || 8000);
            if (key === 'primary') state.adv.embStitch = val;
            else if (state.embAddl[Number(key)]) state.embAddl[Number(key)].stitch = val;
            repriceDebounced();
        });
        $('qqEmbLogos').addEventListener('click', function (e) {
            var rm = e.target.closest('.qq-emb-remove'); if (!rm) return;
            state.embAddl.splice(Number(rm.getAttribute('data-i')), 1);
            renderEmbPanel(); repriceAll();
        });
        $('qqEmbAddBtn').addEventListener('click', function () {
            var isCap = !!(state.product && state.product.isCap);
            if (isCap && state.embAddl.length >= 1) return;
            state.embAddl.push({ stitch: isCap ? 5000 : 8000 });
            renderEmbPanel(); repriceAll();
        });
        $('qqEmbDigitizing').addEventListener('change', function (e) { state.adv.digitizing = e.target.checked; repriceAll(); });
        $('qqCapEmbType').addEventListener('click', function (e) {
            var b = e.target.closest('[data-cap-emb]'); if (!b) return;
            state.capEmb = b.getAttribute('data-cap-emb');
            renderEmbPanel(); repriceAll();
        });
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
