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
    function hdc(v) { return Math.ceil(v * 2 - 1e-9) / 2; }   // round UP to the next $0.50 (matches the rate-card prototype)
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
        { code: 'CF', label: 'Center front' },
        { code: 'FF', label: 'Full front' },
        { code: 'JF', label: 'Jumbo front' }
    ];
    var BACK_OPTS = [
        { code: '', label: 'None' },
        { code: 'CB', label: 'Center back' },
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
    // DTG has no MEDIUM size band → a Center-front (≤9×12) prints as Full front; Center-back as Full back.
    var DTG_FRONT_FROM = { CF: 'FF' };
    var DTG_BACK_FROM = { CB: 'FB' };
    // DTF size bands: Center-front/Center-back = the MEDIUM (≤9×12) transfer; DTF has no "jumbo" so
    // Jumbo-front maps to the largest (full-front) location.
    var DTF_FRONT = { LC: 'left-chest', CF: 'center-front', FF: 'full-front', JF: 'full-front' };
    var DTF_BACK = { CB: 'center-back', FB: 'full-back', JB: 'full-back' };
    var FRONT_LABELS = { LC: 'Left chest', CF: 'Center front', FF: 'Full front', JF: 'Jumbo front' };
    var BACK_LABELS = { CB: 'Center back', FB: 'Full back', JB: 'Jumbo back' };
    // DTF prices by transfer SIZE (DTF_Pricing.unit_price keys on these bands). Show the band on
    // the card so the AE sees what each location includes — size drives the price (bigger = pricier).
    var DTF_LOC_LABEL = { 'left-chest': 'Left chest', 'center-front': 'Center front', 'full-front': 'Full front', 'center-back': 'Center back', 'full-back': 'Full back', 'left-sleeve': 'L sleeve', 'right-sleeve': 'R sleeve' };
    var DTF_SIZE_BAND = { 'left-chest': '≤5×5"', 'center-front': '≤9×12"', 'full-front': '≤12×16.5"', 'center-back': '≤9×12"', 'full-back': '≤12×16.5"', 'left-sleeve': '≤5×5"', 'right-sleeve': '≤5×5"' };
    // DTG standard platen print sizes per location (dtg-pricing-service.js location set; 16×20 = the
    // pricer's max platen clamp). DTG has no medium → Center front/back print FULL (FF/FB size). Info only.
    var DTG_SIZE = { LC: '4×4"', CF: '12×16"', FF: '12×16"', JF: '16×20"', CB: '12×16"', FB: '12×16"', JB: '16×20"' };
    // Print size shown ON each front/back placement chip — method-aware (DTF size bands vs DTG platen
    // sizes); '' for Screen Print / Embroidery (front size doesn't change SCP price). Uses the active
    // size-bearing method: the locked Line-Sheet method, else the first eligible print method (DTF>DTG).
    function sizeMethod() {
        if (state.mode === 'linesheet') return (state.lineMethod === 'dtf' || state.lineMethod === 'dtg') ? state.lineMethod : null;
        if (hasActive('dtf')) return 'dtf';
        if (hasActive('dtg')) return 'dtg';
        return null;
    }
    function chipSize(method, code, kind) {
        if (!method || !code) return '';
        if (method === 'dtg') return DTG_SIZE[code] || '';
        if (method === 'dtf') { var loc = (kind === 'front') ? DTF_FRONT[code] : DTF_BACK[code]; return loc ? (DTF_SIZE_BAND[loc] || '') : ''; }
        return '';
    }

    // --- placement → per-method mapping (reads state.front / state.back / state.sleeves) ---
    function dtgCode() { var f = DTG_FRONT_FROM[state.front] || state.front, b = DTG_BACK_FROM[state.back] || state.back; return (f && b) ? (f + '_' + b) : (f || b || ''); }
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

    // Dark garments need a white underbase screen (a real cost driver). We SUGGEST it from the
    // selected color name so a rushed AE doesn't under-quote a black tee — but never force it:
    // once the AE toggles the box themselves (scpDarkUserSet) we stop overriding their choice.
    function isDarkGarment(name) {
        return /black|navy|royal|red|maroon|cardinal|forest|hunter|charcoal|graphite|purple|brown|chocolate|burgundy|wine|midnight|olive|teal|dark|deep|bottle/i.test(String(name || ''));
    }
    function maybeSuggestDark() {
        if (!state.scpDarkUserSet) state.adv.scpDark = state.color ? isDarkGarment(state.color.name) : false;
        var cb = $('qqScpDark'); if (cb) cb.checked = !!state.adv.scpDark;
    }

    // Print breakdown helpers: the back/sleeve location is priced INTO the per-piece base (no
    // service line), so we derive its cost by re-pricing the FRONT only and showing the difference.
    // printAddlLabel returns the additional-location label, or null when there's nothing to split.
    function printAddlLabel(id) {
        if ((id !== 'dtg' && id !== 'scp' && id !== 'dtf') || !state.front) return null;
        var parts = [];
        if (state.back && BACK_LABELS[state.back]) parts.push(BACK_LABELS[state.back]);
        if (id === 'dtf' || id === 'scp') { if (state.sleeves.left) parts.push('L sleeve'); if (state.sleeves.right) parts.push('R sleeve'); }
        return parts.length ? parts.join(' + ') : null;
    }
    function frontOnlyGroups(id) {
        if (id === 'dtg') return { 'dtg:main': { locationCode: DTG_FRONT_FROM[state.front] || state.front } };
        if (id === 'scp') return { 'scp:design-1': { frontColors: state.frontInk, backColors: 0, darkGarment: !!state.adv.scpDark, safetyStripes: !!state.adv.scpStripes } };
        if (id === 'dtf') return { 'dtf:main': { locations: DTF_FRONT[state.front] ? [DTF_FRONT[state.front]] : [] } };
        return null;
    }

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
                        frontColors: state.frontInk,                          // primary location colors (front size is cosmetic for SCP)
                        backColors: scpLocCount() >= 2 ? state.backInk : 0,   // 2nd location (back) prices on its OWN color count
                        sleeveColorsList: [].concat(                          // each checked sleeve at its OWN color count (L/R may differ)
                            state.sleeves.left ? [state.sleeveInkL] : [],
                            state.sleeves.right ? [state.sleeveInkR] : []),
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
        sleeves: { left: false, right: false }, // DTF (≤5×5" transfer) and/or SCP (add-location) sleeves
        frontInk: 1,          // SCP front (primary location) ink colors — each color = 1 screen
        backInk: 1,           // SCP back (additional location) ink colors — priced on its own
        sleeveInkL: 1,        // SCP left-sleeve ink colors  — its own additional location
        sleeveInkR: 1,        // SCP right-sleeve ink colors — its own additional location (may differ from left)
        scpDarkUserSet: false,// true once the AE manually toggles dark garment (stops auto-suggest)
        adv: { embStitch: 8000, embBackStitch: 8000, digitizing: false, scpDark: false, scpStripes: false },
        embAddl: [],          // additional embroidery logos: [{stitch}] (garment AL / cap back)
        capEmb: 'embroidery', // cap embellishment: 'embroidery' | '3d-puff' | 'laser-patch'
        methods: [],          // [{id}]
        results: {},          // id -> { status, preview, summary, message }
        selectedMethod: null, // which method's price-breaks matrix is shown
        methodPinned: false,  // true once the rep clicks a card (stop auto-following best value)
        seq: 0,
        prevPP: {},           // id -> last REAL per-piece price (survives the loading flicker)
        flashUntil: {},       // id -> timestamp; the tasteful "price changed" flash window
        // ----- LINE SHEET MODE (method-first multi-style mini-catalog -> PDF) -----
        mode: 'linesheet',    // DEFAULT (AEs prefer line-item) | 'quick' (one style, every method)
        lineMethod: null,     // locked imprint method id for the sheet: emb|capemb|dtg|scp|dtf
        lineStyles: [],       // [{ uid, raw, product, color, status, tiers, error }] — each priced independently
        lineSeq: 0            // reprice token for the line-sheet rows
    };
    var _lineUid = 0;

    function placementLabel() {
        var parts = [];
        if (FRONT_LABELS[state.front]) parts.push(FRONT_LABELS[state.front]);
        if (BACK_LABELS[state.back]) parts.push(BACK_LABELS[state.back]);
        if (state.sleeves.left) parts.push('L sleeve');
        if (state.sleeves.right) parts.push('R sleeve');
        return parts.join(' + ') || '—';
    }

    // Per-method config summary — the live options that shaped THIS method's price, so each
    // result card + its matrix can say exactly what's included (cards were option-blind before).
    // UI ONLY — reads the same state the engine reads; never changes the engine inputs.
    function configParts(id) {
        var parts = [];
        if (id === 'scp') {
            var twoLoc = scpLocCount() >= 2;
            if (twoLoc && state.frontInk !== state.backInk) {
                parts.push({ text: 'Front ' + state.frontInk + 'c + Back ' + state.backInk + 'c' });
            } else {
                parts.push({ text: state.frontInk + '-color' });
                parts.push({ text: twoLoc ? 'front + back' : 'front' });
            }
            var slv = [];
            if (state.sleeves.left) slv.push('L ' + state.sleeveInkL + 'c');
            if (state.sleeves.right) slv.push('R ' + state.sleeveInkR + 'c');
            if (slv.length) parts.push({ text: (slv.length === 1 ? 'sleeve' : 'sleeves') + ' · ' + slv.join(' · ') });
            if (state.adv.scpDark) parts.push({ text: 'dark garment' });
            if (state.adv.scpStripes) parts.push({ text: 'safety stripes', on: true });
        } else if (id === 'dtg') {
            // one chip per location with its print size, mirroring DTF (so AEs/customers see the size)
            if (state.front && FRONT_LABELS[state.front]) parts.push({ text: FRONT_LABELS[state.front] + (DTG_SIZE[state.front] ? ' · ' + DTG_SIZE[state.front] : '') });
            if (state.back && BACK_LABELS[state.back]) parts.push({ text: BACK_LABELS[state.back] + (DTG_SIZE[state.back] ? ' · ' + DTG_SIZE[state.back] : '') });
        } else if (id === 'dtf') {
            // one chip per location, tagged with its transfer-size band (≤5×5" / ≤12×16.5")
            dtfLocations().forEach(function (loc) {
                parts.push({ text: (DTF_LOC_LABEL[loc] || loc) + ' · ' + (DTF_SIZE_BAND[loc] || '') });
            });
        } else if (id === 'emb' || id === 'capemb') {
            var n = 1 + state.embAddl.length;
            parts.push({ text: n + (n === 1 ? ' logo' : ' logos') });
            if (id === 'capemb' && state.capEmb !== 'embroidery') {
                parts.push({ text: state.capEmb === '3d-puff' ? '3D puff' : 'laser patch', on: true });
            }
            if (state.adv.digitizing) parts.push({ text: 'digitizing', on: true });
        }
        return parts;
    }
    function configChips(id) {
        var parts = configParts(id);
        if (!parts.length) return '';
        return '<div class="qq-card-config">' + parts.map(function (p) {
            return '<span class="qq-cfg-chip' + (p.on ? ' on' : '') + '">' + esc(p.text) + '</span>';
        }).join('') + '</div>';
    }
    function configText(id) {
        return configParts(id).map(function (p) { return p.text; }).join(', ');
    }

    function sizeList() { return (state.product && state.product.sizes) || []; }
    function defaultSizes() { return (state.product && state.product.isCap) ? ['OSFA'] : ['S', 'M', 'L', 'XL', '2XL', '3XL', '4XL']; }
    function stdSizeFor(product) {
        var sizes = (product && product.sizes) || [];
        if (product && product.isCap) return sizes.indexOf('OSFA') >= 0 ? 'OSFA' : (sizes[0] || 'OSFA');
        return sizes.indexOf('S') >= 0 ? 'S' : (sizes.indexOf('OSFA') >= 0 ? 'OSFA' : (sizes[0] || 'S'));
    }
    function stdSize() { return stdSizeFor(state.product); }

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

    // Fetch + normalize a product (style -> { style, name, isCap, colors:[{name,catalog,swatch,image}] }).
    // Pure: returns the product, mutates no global state — so BOTH the single-style lookup (Quick Price)
    // and the Line Sheet's per-row add-style can reuse it.
    function fetchProduct(style) {
        return fetch(API_BASE + '/api/product-details?styleNumber=' + encodeURIComponent(style))
            .then(function (r) { if (!r.ok) throw new Error('not found (' + r.status + ')'); return r.json(); })
            .then(function (rows) {
                if (!Array.isArray(rows) || rows.length === 0) throw new Error('no product');
                var meta = rows[0];
                var title = meta.PRODUCT_TITLE || style;
                var category = meta.CATEGORY_NAME || '';
                var subcat = meta.SUBCATEGORY_NAME || '';
                var desc = meta.PRODUCT_DESCRIPTION || '';
                var cap = isCapProduct(category, title, style);
                // unique colors keyed by CATALOG_COLOR (+ swatch & image for the picker / line sheet)
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
                return {
                    style: style, name: cleanName(title, style), isCap: cap,
                    category: category, subcategory: subcat, description: desc,
                    colors: colors, sizes: null
                };
            });
    }

    function lookupStyle(raw) {
        var style = String(raw || '').trim().toUpperCase();
        var statusEl = $('qqStyleStatus');
        if (!style) { statusEl.innerHTML = ''; state.product = null; renderAll(); return; }
        statusEl.innerHTML = '<span class="loading">Looking up ' + esc(style) + '…</span>';
        var token = ++lookupSeq;

        fetchProduct(style)
            .then(function (product) {
                if (token !== lookupSeq) return;
                state.product = product;
                state.color = product.colors.length ? product.colors[0] : null;
                state.scpDarkUserSet = false;  // new style → let the color re-suggest underbase
                maybeSuggestDark();
                statusEl.innerHTML = '';
                loadInventory(); // blank-stock check for the default color

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
        renderPlacementVisibility();
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
    function buildItemFor(def, product, color, sizes) {
        var c = color || {};
        return {
            id: '__qq__', method: def.engineMethod,
            styleNumber: product.style, title: product.name,
            colorName: c.name || '', catalogColor: c.catalog || '',
            isCap: def.isCap === true, sizes: sizes
        };
    }
    function buildItem(def) {
        return buildItemFor(def, state.product, state.color, currentSizes());
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
                if (printAddlLabel(id)) priceFrontOnly(id, token); // derive the back's cost for the card breakdown
                loadGarmentMeta(id); // best-effort blank-garment cost so the breakdown can split off the "blank" line
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

    // Best-effort: re-price the FRONT location only so the card can show front vs back/sleeves.
    // Non-blocking — the all-in price renders immediately; this patches the split in when it lands.
    function priceFrontOnly(id, token) {
        var def = METHODS[id], grp = frontOnlyGroups(id);
        if (!grp) return;
        var run;
        try { run = window.QuoteCartEngine.singleItemPreview(buildItem(def), { groups: grp, deps: engineDeps(), nudge: false }); }
        catch (e) { return; }
        run.then(function (preview) {
            if (token !== state.seq) return;
            var r = state.results[id];
            if (!r || r.status !== 'ok' || !preview.ok) return;
            r.frontOnlyUnit = summarize(preview).perPiece;
            renderResults();
        }).catch(function () { /* breakdown is best-effort; never blocks the price */ });
    }

    // ---- garment ("blank") line for the rate-card-style breakdown ----------------
    // DISPLAY ONLY. Quick Quote computes no PRICES (IRON RULE) — the per-piece + total
    // ALWAYS come from the engine. This only re-derives the blank garment cost so the
    // engine's first line can be SPLIT into "blank" + "the print on top" for the rep.
    // The print/logo lines below are engine MARGINALS, so the rows sum to the engine's
    // exact per-piece by construction; a wrong blank can only mislabel a line, never
    // change a total — and buildBreakdown's parity guard drops the split if they don't sum.
    var _garmentMeta = {};   // `${bundleMethod}|${style}` -> { garment, tiers:[{min,max,denom}] }
    function bundleMethodFor(id) {
        return { dtg: 'DTG', dtf: 'DTF', scp: 'ScreenPrint', emb: 'EMB', capemb: 'CAP' }[id] || null;
    }
    function loadGarmentMeta(id) {
        var bm = bundleMethodFor(id); if (!bm || !state.product) return;
        var style = state.product.style, key = bm + '|' + style;
        if (_garmentMeta[key]) return;
        _garmentMeta[key] = { loading: true };
        fetch(API_BASE + '/api/pricing-bundle?method=' + bm + '&styleNumber=' + encodeURIComponent(style))
            .then(function (r) { return r.ok ? r.json() : null; })
            .then(function (b) {
                if (!b) { delete _garmentMeta[key]; return; }
                var prices = (b.sizes || []).map(function (s) { return Number(s.price) || 0; }).filter(function (p) { return p > 0; });
                _garmentMeta[key] = {
                    garment: prices.length ? Math.min.apply(null, prices) : 0,
                    tiers: (b.tiersR || []).map(function (t) { return { min: Number(t.MinQuantity), max: Number(t.MaxQuantity), denom: Number(t.MarginDenominator) }; })
                };
                renderResults();
            })
            .catch(function () { delete _garmentMeta[key]; });   // best-effort: breakdown falls back to by-location
    }
    function blankUnit(id) {
        var bm = bundleMethodFor(id); if (!bm || !state.product) return null;
        var meta = _garmentMeta[bm + '|' + state.product.style];
        if (!meta || meta.loading || !(meta.garment > 0)) return null;
        var qty = totalQty();
        var tiers = meta.tiers || [];
        // Match findPricingTier's clamp semantics: exact-tier match, else if qty is
        // ABOVE the top tier's max clamp to the TOP tier (NOT tiers[0] — that would
        // silently use the lowest/LTM tier's MarginDenominator and misprice the blank
        // display line at high qty). Display-only; the card total comes from the engine.
        var tier = tiers.find(function (t) { return qty >= t.min && qty <= t.max; });
        if (!tier && tiers.length) {
            var top = tiers.reduce(function (a, b) { return (b.max > a.max) ? b : a; }, tiers[0]);
            tier = (qty > top.max) ? top : tiers.reduce(function (a, b) { return (b.min < a.min) ? b : a; }, tiers[0]);
        }
        if (!tier || !(tier.denom > 0)) return null;
        return hdc(meta.garment / tier.denom);
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

    // ---- SanMar blank-garment inventory for the picked color (phone-quote aid) -----
    // SOFT, glanceable signal: per-size blank stock + a discontinued / out-of-stock flag.
    // It's the BLANK-garment availability (decoration is made-to-order on top) and reflects
    // the SanMar sync — labelled "approx, confirm at order", NEVER a hard block on quoting.
    var INV_SIZE_ORDER = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '2XL', '3XL', '4XL', '5XL', '6XL', 'OSFA', 'S/M', 'M/L', 'L/XL'];
    var _invSeq = 0;
    function loadInventory() {
        var box = $('qqInventory'); if (!box) return;
        var style = state.product && state.product.style;
        // The SanMar /api/inventory feed keys on COLOR_NAME ("Athletic Maroon"), NOT the
        // abbreviated CATALOG_COLOR ("Ath. Maroon"). Try the display name first; fall back
        // to the catalog code so it's robust for either keying.
        var keys = [];
        if (state.color) {
            if (state.color.name) keys.push(state.color.name);
            if (state.color.catalog && state.color.catalog !== state.color.name) keys.push(state.color.catalog);
        }
        state.inventory = null; state.invStatus = null;
        if (!style || !keys.length) { box.innerHTML = ''; return; }
        state.invLoading = true; renderInventory();
        var token = ++_invSeq;
        (function tryKey(i) {
            if (i >= keys.length) { if (token === _invSeq) { state.inventory = {}; state.invLoading = false; renderInventory(); } return; }
            fetch(API_BASE + '/api/inventory?styleNumber=' + encodeURIComponent(style) + '&color=' + encodeURIComponent(keys[i]))
                .then(function (r) { return r.ok ? r.json() : null; })
                .then(function (data) {
                    if (token !== _invSeq) return;   // stale — color/style changed mid-flight
                    var rows = data ? (Array.isArray(data) ? data : Object.keys(data).map(function (k) { return data[k]; })) : [];
                    var sized = rows.filter(function (r) { return r && typeof r === 'object' && (r.SIZE || r.size); });
                    if (!sized.length) { tryKey(i + 1); return; }   // this color key didn't match → try the next
                    var bySize = {}, status = null;
                    sized.forEach(function (r) {
                        var sz = r.SIZE || r.size, q = parseInt(r.QTY != null ? r.QTY : r.quantity, 10);
                        bySize[sz] = (bySize[sz] || 0) + (isNaN(q) ? 0 : q);
                        if (r.PRODUCT_STATUS) status = r.PRODUCT_STATUS;
                    });
                    state.inventory = bySize; state.invStatus = status; state.invLoading = false;
                    renderInventory();
                })
                .catch(function () { if (token === _invSeq) tryKey(i + 1); });
        })(0);
    }
    function renderInventory() {
        var box = $('qqInventory'); if (!box) return;
        if (state.invLoading) { box.innerHTML = '<div class="qq-inv-note">Checking stock…</div>'; return; }
        if (!state.inventory || typeof state.inventory !== 'object') { box.innerHTML = ''; return; }
        var sizes = Object.keys(state.inventory);
        if (!sizes.length) { box.innerHTML = ''; return; }
        sizes.sort(function (a, b) { var ia = INV_SIZE_ORDER.indexOf(a), ib = INV_SIZE_ORDER.indexOf(b); return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib); });
        var total = sizes.reduce(function (s, k) { return s + state.inventory[k]; }, 0);
        var discontinued = state.invStatus && !/active/i.test(String(state.invStatus));
        var html = '';
        if (discontinued) html += '<div class="qq-inv-flag is-disc">⚠ ' + esc(state.invStatus) + ' — confirm before quoting</div>';
        else if (total <= 0) html += '<div class="qq-inv-flag is-oos">⚠ Out of stock in this color</div>';
        html += '<div class="qq-inv-head">Blank stock <span class="muted">· ' + total.toLocaleString() + ' total · approx — confirm at order</span></div>';
        html += '<div class="qq-inv-grid">' + sizes.map(function (sz) {
            var q = state.inventory[sz], cls = q <= 0 ? 'is-out' : (q < 100 ? 'is-low' : 'is-good'); // matches shared inventory-badges thresholds
            return '<span class="qq-inv-cell ' + cls + '" title="' + q.toLocaleString() + ' in stock"><span class="qq-inv-sz">' + esc(sz) + '</span><span class="qq-inv-qty">' + q.toLocaleString() + '</span></span>';
        }).join('') + '</div>';
        box.innerHTML = html;
    }

    function renderPlacements() {
        function chips(opts, sel, kind) {
            var m = sizeMethod();
            return opts.map(function (o) {
                var sz = chipSize(m, o.code, kind);
                return '<button type="button" class="qq-place-chip' + (o.code === sel ? ' is-active' : '') + (sz ? ' has-size' : '')
                    + '" data-kind="' + kind + '" data-code="' + esc(o.code) + '">' + esc(o.label)
                    + (sz ? '<span class="qq-chip-size">' + esc(sz) + '</span>' : '') + '</button>';
            }).join('');
        }
        $('qqFront').innerHTML = chips(FRONT_OPTS, state.front, 'front');
        $('qqBack').innerHTML = chips(BACK_OPTS, state.back, 'back');
        var sl = $('qqSleeveL'), sr = $('qqSleeveR');
        if (sl) sl.checked = !!state.sleeves.left;
        if (sr) sr.checked = !!state.sleeves.right;
        var siL = $('qqSleeveInkL'); if (siL) siL.value = state.sleeveInkL;
        var siR = $('qqSleeveInkR'); if (siR) siR.value = state.sleeveInkR;
        // highlight the common-placement preset that matches the current front/back (no sleeves)
        var presets = $('qqPlacePresets');
        if (presets) Array.prototype.forEach.call(presets.querySelectorAll('button'), function (b) {
            var m = (b.getAttribute('data-front') || '') === (state.front || '')
                && (b.getAttribute('data-back') || '') === (state.back || '')
                && !state.sleeves.left && !state.sleeves.right;
            b.classList.toggle('is-active', m);
        });
        renderInkField(); // back-colors stepper visibility tracks the back placement
    }

    function renderInkField() {
        var hasScp = hasActive('scp');
        $('qqInkField').hidden = !hasScp;
        var backWrap = $('qqInkBackWrap'); if (backWrap) backWrap.hidden = !(hasScp && scpLocCount() >= 2);
        $('qqScpOptsField').hidden = !hasScp; // dark garment + safety stripes, inline (one-click upsell)
    }

    function renderAdvancedGroups() { /* SCP options moved inline (see renderInkField); nothing advanced remains */ }

    function syncAdvancedInputs() {
        $('qqInkFront').value = state.frontInk;
        $('qqInkBack').value = state.backInk;
        $('qqScpDark').checked = !!state.adv.scpDark;
        $('qqScpStripes').checked = !!state.adv.scpStripes;
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

    function updateEmbWarn() {
        var el = $('qqEmbWarn'); if (!el) return;
        var isCap = configIsCap();
        // The PRIMARY (chest) logo's stitch surcharge CAPS at +$10 above ~25K — a large back/front
        // must be its OWN logo to price per stitch. Warn instead of silently under-quoting.
        if (!isCap && (num(state.adv.embStitch) || 0) > 25000) {
            el.textContent = 'Heads up: over 25,000 stitches on the main logo caps the upcharge at +$10/pc. For a full back/front that large, add it as a separate logo so it prices per stitch.';
            el.hidden = false;
        } else {
            el.hidden = true;
        }
    }

    function renderEmbPanel() {
        var field = $('qqEmbField');
        var hasEmb = hasActive('emb') || hasActive('capemb');
        if (!hasEmb) { field.hidden = true; return; }
        field.hidden = false;
        var isCap = configIsCap();
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
            : 'Up to 10,000 stitches included. Each additional logo priced at our additional-logo (AL) rate. Typical stitches — left chest ~8K · full front ~15–30K · jacket back ~25–40K (add a back/front as its own logo).';
        updateEmbWarn();
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
    // Each method's LOWEST probe must land inside its small-batch (LTM) tier so the matrix + line
    // sheet surface the "+$50 small-batch" row: EMB 1-7 (probe 4), DTG 1-11 (probe 6), DTF 10-23
    // (probe 15), SCP 24-47 (probe 24). DTG used to start at 12 and skipped its 1-11 LTM tier.
    var PROBE_QTYS = { emb: [4, 12, 36, 60, 100], capemb: [4, 12, 36, 60, 100], dtg: [6, 12, 36, 60, 100], scp: [24, 50, 100, 200], dtf: [15, 36, 60, 100] };
    var _ladderCache = {};
    var _ladderFetching = {};

    function ladderKey(id) {
        return (state.product ? state.product.style : '') + '|' + id
            + '|' + state.front + state.back + (state.sleeves.left ? 'L' : '') + (state.sleeves.right ? 'R' : '') + '|' + state.frontInk + 'x' + state.backInk + 's' + state.sleeveInkL + '/' + state.sleeveInkR
            + '|' + state.adv.embStitch + '|A' + state.embAddl.map(function (a) { return a.stitch; }).join(',') + '|' + state.capEmb
            + '|' + (state.adv.digitizing ? 1 : 0) + '|' + (state.adv.scpDark ? 1 : 0) + '|' + (state.adv.scpStripes ? 1 : 0)
            + '|' + (state.color ? state.color.catalog : '');
    }
    // (placementLabel defined above — combo of front/back/sleeves)
    function rangeLabel(t) {
        var r = t.range || parseRange(t.label);
        return (!isFinite(r.max)) ? r.min + '+' : r.min + '–' + r.max;
    }

    // Engine-probe a per-piece price ladder for a product+color under a method's CURRENT shared
    // config. Returns [{label, base, ltmFee, range}] sorted by tier. Prices a representative qty in
    // each tier through the SAME singleItemPreview() the cards use, so a ladder can't disagree with
    // a live quote. Shared by the Quick-Price matrix AND the Line Sheet (one ladder per style).
    async function probeLadder(id, product, color) {
        var def = METHODS[id];
        if (!def || !product || !window.QuoteCartEngine) return [];
        var probes = PROBE_QTYS[id] || [12, 36, 60, 100];
        var size = stdSizeFor(product);
        var byTier = {};
        var lastTierTable = null;   // discovered from the engine's own trace (live Caspio tiers)

        // Probe ONE qty and, if new, record its tier row. Base = everything that scales
        // with qty EXCEPT the one-time setup fees and the flat small-batch (LTM) fee,
        // which is disclosed on its own row. Derive from groupTotal (which already folds
        // in per-piece service lines — stitch surcharge, AL — and any cap upcharge) so it
        // is mode-agnostic: correct whether the engine's baseUnit is LTM-stripped
        // (EMB/SCP/DTG) OR LTM-inclusive (DTF). Mirrors pdp-configurator.js probe math so
        // the 3 surfaces can't disagree. Guarded by `!byTier[label]` → additive only:
        // re-probing an already-seen tier can NEVER overwrite/change its recorded price.
        async function probeQty(pq) {
            var sz = {}; sz[size] = pq;
            var item = buildItemFor(def, product, color, sz);
            var preview;
            try {
                preview = await window.QuoteCartEngine.singleItemPreview(item, { groups: def.groups(), deps: engineDeps(), nudge: false });
            } catch (e) { preview = null; }
            if (!(preview && preview.ok && preview.lines && preview.lines.length)) return;
            if (preview.trace && preview.trace.tierTable && preview.trace.tierTable.length) {
                lastTierTable = preview.trace.tierTable;
            }
            var label = preview.tierLabel || ('q' + pq);
            if (byTier[label]) return;
            var oneTimeT = (preview.fees || []).reduce(function (s, f) { return s + (f.oneTime ? (Number(f.amount) || 0) : 0); }, 0);
            var ltmFlat = (preview.ltm && preview.ltm.fee) || 0;
            var base = Math.max(0, (preview.groupTotal - oneTimeT - ltmFlat) / pq);
            byTier[label] = { label: label, base: r2(base), ltmFee: ltmFlat, range: parseRange(label) };
        }

        // 1) Bootstrap: probe the hardcoded representative qtys (one inside each tier we
        //    KNOW about today). These also make the engine hand back its live tierTable.
        for (var i = 0; i < probes.length; i++) {
            await probeQty(probes[i]);
        }

        // 2) Self-heal against a Caspio tier restructure: probe the min qty of any LIVE
        //    tier the constants didn't already land in, so a re-tiering (added/renamed
        //    tier) can't silently drop a row from the ladder. Purely additive — tiers
        //    already covered above are skipped by the `!byTier[label]` guard, and a
        //    tier's base is constant within it, so this never changes an existing row.
        if (lastTierTable) {
            var seenMins = {};
            Object.keys(byTier).forEach(function (k) { seenMins[byTier[k].range.min] = true; });
            var missing = lastTierTable
                .map(function (t) { return Number(t.minQty); })
                .filter(function (m) { return Number.isFinite(m) && m > 0 && !seenMins[m]; })
                .sort(function (a, b) { return a - b; });
            for (var j = 0; j < missing.length; j++) {
                await probeQty(missing[j]);
            }
        }

        return Object.keys(byTier).map(function (k) { return byTier[k]; }).sort(function (a, b) { return a.range.min - b.range.min; });
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
        var tiers = [];
        try { tiers = await probeLadder(id, state.product, state.color); }
        catch (err) { console.error('[quick-quote] price-breaks build failed:', err); }
        finally { delete _ladderFetching[key]; }
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
        var descr = configText(id);
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

        // Arm a short "price changed" flash window per method on a real price MOVE. Compare
        // real->real only (and never clobber prevPP with null) so the streaming per-method
        // re-renders + loading flicker don't false-trigger or cut the flash short.
        var nowT = Date.now();
        state.methods.forEach(function (m) {
            var rr = state.results[m.id];
            var pp = (rr && rr.status === 'ok' && rr.summary) ? rr.summary.perPiece : null;
            if (pp == null) return;
            if (state.prevPP[m.id] != null && state.prevPP[m.id] !== pp) state.flashUntil[m.id] = nowT + 600;
            state.prevPP[m.id] = pp;
        });
        box.innerHTML = state.methods.map(function (m) {
            var changed = !!(state.flashUntil[m.id] && nowT < state.flashUntil[m.id]);
            return renderCard(m.id, m.id === bestId, changed);
        }).join('');

        // wire retry buttons
        Array.prototype.forEach.call(box.querySelectorAll('.qq-retry'), function (btn) {
            btn.addEventListener('click', function () { var id = btn.getAttribute('data-id'); priceMethod(id, ++state.seq); });
        });

        refreshMatrix();
        renderSafetyRecs();
    }

    // Recommended safety apparel (curated hi-vis top sellers) — shown ONLY when
    // screen print is eligible AND safety stripes are on. Clicking a card prices
    // that style here in Quick Quote. The component caches, so re-rendering on each
    // reprice is cheap (and robust — no stale "shown once" flag to get stuck on).
    function renderSafetyRecs() {
        var el = document.getElementById('qqSafetyRecs');
        if (!el) return;
        // Show only for screen print OR DTF — not embroidery / cap-emb / DTG (Erik 2026-06-28).
        // Quick Price: SCP or DTF eligible + a product loaded. Line Sheet: SCP/DTF is the picked method.
        var show = (hasActive('scp') || hasActive('dtf')) && (state.mode === 'linesheet' || !!state.product);
        if (!show) { el.hidden = true; el.innerHTML = ''; return; }
        if (!window.SafetyStripeRecs) return;
        var isLine = state.mode === 'linesheet';
        window.SafetyStripeRecs.render('qqSafetyRecs', {
            variant: 'builder', audience: 'staff', collapsible: true,
            addLabel: isLine ? 'Add to sheet' : 'Price this style',
            title: 'Safety apparel top sellers',
            subtitle: isLine ? 'Popular hi-vis garments — click to add one to the line sheet'
                             : 'Popular hi-vis garments — click to price one here',
            onAdd: function (style) {
                if (state.mode === 'linesheet') {
                    if (state.lineStyles.length >= LINE_MAX) return;  // sheet full
                    addLineStyle();
                    var last = state.lineStyles[state.lineStyles.length - 1];
                    if (last) {
                        var inp = document.querySelector('.qq-line-row[data-uid="' + last.uid + '"] .qq-line-style');
                        if (inp) inp.value = style;
                        onLineStyleInput(last.uid, style);
                    }
                } else {
                    var input = document.getElementById('qqStyle');
                    if (input) input.value = style;
                    if (typeof lookupStyle === 'function') lookupStyle(style);
                }
            }
        });
    }

    // Rate-card-style per-piece breakdown: blank garment + each print/logo + per-shirt
    // small-batch line. The blank is display-only (loadGarmentMeta); every other line is an
    // engine MARGINAL, so the rows reconstruct the engine per-piece by construction. The
    // parity guard drops the whole split if the rows ever fail to sum (never mislead the rep).
    // SCP additional-location breakdown label — lists each add-location with ITS OWN color count
    // (back + per-sleeve). The breakdown shows the COMBINED marginal cost on one line (parity-guarded);
    // this label names what's in it so a 2c-left + 4c-right reads honestly.
    function scpAddlBreakdownLabel() {
        var parts = [];
        if (scpLocCount() >= 2 && state.back && BACK_LABELS[state.back]) parts.push(BACK_LABELS[state.back] + ' ' + state.backInk + 'c');
        if (state.sleeves.left) parts.push('L sleeve ' + state.sleeveInkL + 'c');
        if (state.sleeves.right) parts.push('R sleeve ' + state.sleeveInkR + 'c');
        return parts.join(' + ');
    }
    function buildBreakdown(id, s, r, unitWord) {
        var pp = s.perPiece || 0, qtyNow = totalQty(), blank = blankUnit(id);
        var ltmPP = (s.ltm && s.ltm.fee > 0 && qtyNow > 0) ? Math.floor((s.ltm.fee / qtyNow) * 100) / 100 : 0;
        var capBlankLbl = state.product.isCap ? 'Cap blank' : 'Garment (blank)';
        // SCP teaches its cost by color count: each color = 1 screen. Front + back price separately.
        var scpFrontC = (id === 'scp') ? (' — ' + state.frontInk + ' color') : '';
        var rows = [], sum = 0, didSplit = false;
        function add(lbl, val, plus, cls) {
            val = Number(val) || 0; sum += val;
            rows.push('<div class="qq-bd-row' + (cls ? ' ' + cls : '') + '"><span>' + esc(lbl) + '</span><span>' + (plus ? '+' : '') + fmt(val) + '/' + unitWord + '</span></div>');
        }
        if (s.serviceLines && s.serviceLines.length) {
            var svcSum = s.serviceLines.reduce(function (a, sl) { return a + (Number(sl.unitPrice) || 0); }, 0);
            var baseUnit = r2(pp - svcSum);                       // garment + primary logo (+ LTM if any)
            var primary = r2(baseUnit - (blank || 0) - ltmPP);
            if (blank != null && primary > -0.005) {
                add(capBlankLbl, blank, false, 'is-blank');
                add(state.product.isCap ? 'Cap front logo' : 'Primary logo', primary, false);
                didSplit = true;
            } else {
                add((state.product.isCap ? 'Cap' : 'Garment') + ' + main logo', baseUnit, false);
            }
            s.serviceLines.forEach(function (sl) { add(String(sl.label || '').replace(/^AL[\s-]+/i, ''), Number(sl.unitPrice) || 0, true); });
        } else if (r.frontOnlyUnit != null && printAddlLabel(id)) {
            var addlU = r2(pp - r.frontOnlyUnit);                 // back/sleeve marginal
            var frontPrint = r2(r.frontOnlyUnit - (blank || 0) - ltmPP);
            if (blank != null && frontPrint > -0.005) {
                add(capBlankLbl, blank, false, 'is-blank');
                add((FRONT_LABELS[state.front] || 'Front') + scpFrontC, frontPrint, false);
                didSplit = true;
            } else {
                add((FRONT_LABELS[state.front] || 'Front') + scpFrontC, r.frontOnlyUnit, false);
            }
            add(id === 'scp' ? scpAddlBreakdownLabel() : printAddlLabel(id), addlU, true);
        } else if (blank != null) {                              // single print location OR single logo
            var printU = r2(pp - blank - ltmPP);
            if (printU > -0.005) {
                var soloLbl = (id === 'emb') ? 'Primary logo'
                    : (id === 'capemb') ? 'Cap front logo'
                    : ((FRONT_LABELS[state.front] || 'Print') + scpFrontC);
                add(capBlankLbl, blank, false, 'is-blank');
                add(soloLbl, printU, false);
                didSplit = true;
            }
        }
        if (didSplit && ltmPP > 0) add('Small-batch (per ' + unitWord + ')', ltmPP, true, 'is-ltm');
        if (!rows.length) return '';
        // PARITY GUARD: the rows MUST reconstruct the engine per-piece (±1¢) or we show nothing.
        if (Math.abs(sum - pp) > 0.01) { if (window.console && console.warn) console.warn('[quick-quote] breakdown parity off', id, sum, pp); return ''; }
        return '<div class="qq-card-breakdown">'
            + ((s.oneTimeFees && s.oneTimeFees.length) ? '<div class="qq-bd-head">Per piece</div>' : '')
            + rows.join('') + '</div>';
    }

    // One-time fees (screen setup, digitizing) shown as their OWN section below the per-piece
    // breakdown — they're per-order, not per-piece, so they must NOT enter the parity-guarded sum.
    function buildOneTime(s) {
        if (!s.oneTimeFees || !s.oneTimeFees.length) return '';
        var rows = s.oneTimeFees.map(function (f) {
            return '<div class="qq-bd-row"><span>' + esc(f.label) + '</span><span>' + fmt(f.amount) + '</span></div>';
        });
        var html = '<div class="qq-bd-head">One-time setup <span class="qq-bd-sub">· per order, not per piece</span></div>' + rows.join('');
        if (s.oneTimeFees.length > 1) {
            var tot = s.oneTimeFees.reduce(function (a, f) { return a + (Number(f.amount) || 0); }, 0);
            html += '<div class="qq-bd-row is-total"><span>One-time total</span><span>' + fmt(tot) + '</span></div>';
        }
        return '<div class="qq-card-onetime">' + html + '</div>';
    }

    // ============================================================
    // "Open in quote builder →" handoff (item #6, 2026-07-05)
    // Each priced method card links to its staff quote builder with the CURRENT
    // config URL-encoded, so the rep can graduate a phone quote into a real quote
    // without retyping. The builder prefills through its EXISTING add-product path
    // (same engine, same setters) — these params carry IDENTITY (style/color/qty),
    // never a price.
    //
    // PARAM SCHEMA (canonical copy + parser: getQuickQuotePrefill() in
    // shared_components/js/quote-builder-utils.js):
    //   from=quickquote                      sentinel
    //   style=PC54                           style number
    //   color=<CATALOG_COLOR>                API-safe color code
    //   colorName=<COLOR_NAME>               display name (DTG fuzzy-match)
    //   qty=<total>                          total pieces
    //   sizes=S:10,M:14                      size:qty CSV — exactly what was priced here
    //   location=<code>                      DTG only — dtgCode() front[_back]
    // NOT transferred (method-specific, rep re-enters): EMB stitch counts/logos,
    // SCP ink colors/dark garment, DTF transfer locations.
    // ============================================================
    var BUILDER_PATHS = {
        emb: '/quote-builders/embroidery-quote-builder.html',
        capemb: '/quote-builders/embroidery-quote-builder.html',   // EMB builder handles caps
        dtg: '/quote-builders/dtg-quote-builder.html',
        scp: '/quote-builders/screenprint-quote-builder.html',
        dtf: '/quote-builders/dtf-quote-builder.html'
    };
    function builderHref(id) {
        if (!state.product || !BUILDER_PATHS[id]) return '';
        var p = new URLSearchParams();
        p.set('from', 'quickquote');
        p.set('style', state.product.style);
        if (state.color) {
            if (state.color.catalog) p.set('color', state.color.catalog);
            if (state.color.name) p.set('colorName', state.color.name);
        }
        var qty = totalQty();
        if (qty > 0) p.set('qty', String(qty));
        var sizes = currentSizes();
        var csv = Object.keys(sizes).map(function (sz) { return sz + ':' + sizes[sz]; }).join(',');
        if (csv) p.set('sizes', csv);
        if (id === 'dtg') { var loc = dtgCode(); if (loc) p.set('location', loc); }
        return BUILDER_PATHS[id] + '?' + p.toString();
    }
    function openBuilderHtml(id) {
        var href = builderHref(id);
        if (!href) return '';
        return '<a class="qq-open-builder" href="' + esc(href) + '" target="_blank" rel="noopener"'
            + ' title="Open the staff quote builder with this style, color and quantity prefilled"'
            + ' style="display:inline-block;margin-top:8px;font-size:12px;font-weight:600;color:#166534;text-decoration:underline;text-decoration-style:dotted;text-underline-offset:2px;">'
            + 'Open in quote builder &rarr;</a>';
    }

    function renderCard(id, isBest, changed) {
        var def = METHODS[id];
        var r = state.results[id];
        var head = '<div class="qq-card-method">' + def.icon + '<span>' + esc(def.label) + '</span></div>';

        var dm = ' data-method="' + esc(id) + '"';
        if (!r || r.status === 'loading') {
            return '<div class="qq-card"' + dm + '><div class="qq-card-top">' + head + '<div class="qq-skeleton" style="width:120px"></div></div></div>';
        }
        if (r.status === 'unavailable' || r.status === 'belowmin') {
            var stCls = (r.status === 'belowmin') ? 'is-belowmin' : 'is-unavailable';
            return '<div class="qq-card ' + stCls + '"' + dm + '><div class="qq-card-top">' + head + '</div><div class="qq-card-msg">' + esc(r.message) + '</div></div>';
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
        // one-time fees now render as their own section (buildOneTime), not a meta chip

        var nudgeHtml = '';
        if (s.nudge && s.nudge.addQty > 0 && (s.nudge.nextPerPiece != null || s.nudge.perPieceSavings > 0)) {
            var n = s.nudge;
            var to = n.nextPerPiece != null ? (' → ' + fmt(n.nextPerPiece) + '/' + unitWord) : '';
            var save = (n.nextPerPiece == null && n.perPieceSavings > 0) ? (' — save ' + fmt(n.perPieceSavings) + '/' + unitWord) : '';
            nudgeHtml = '<button type="button" class="qq-card-nudge" data-addqty="' + n.addQty + '" title="Bump the quantity to this price break">↑ Add ' + n.addQty + ' more' + to
                + (n.ltmDisappears ? ' · small-batch fee gone' : '') + save + '</button>';
        }

        // Per-piece breakdown (rate-card style): blank garment + each print/logo location
        // + a per-shirt small-batch line, all summing to the engine per-piece. See buildBreakdown.
        var breakdownHtml = buildBreakdown(id, s, r, unitWord);
        var oneTimeHtml = buildOneTime(s);

        return '<div class="qq-card is-clickable' + (isBest ? ' is-best' : '') + (sel ? ' is-selected' : '') + '"' + (changed ? ' data-flash="1"' : '') + dm + '>'
            + '<div class="qq-card-top">' + head
            + '<div class="qq-card-price"><div class="qq-card-pp">' + fmt(s.perPiece) + '<span class="per">/' + unitWord + '</span></div>'
            + '<div class="qq-card-total">' + fmt(s.total) + ' total' + (isBest ? ' <span class="qq-best-tag"><svg class="qq-star" viewBox="0 0 24 24" width="11" height="11" fill="currentColor" aria-hidden="true"><path d="M12 2l2.9 6.3 6.9.7-5.1 4.7 1.4 6.8L12 17.8 6 21.2l1.4-6.8L2.3 9.7l6.9-.7z"/></svg>best value</span>' : '') + '</div></div></div>'
            + configChips(id)
            + breakdownHtml
            + oneTimeHtml
            + (meta.length ? '<div class="qq-card-meta">' + meta.join('') + '</div>' : '')
            + nudgeHtml
            + openBuilderHtml(id)
            + (sel ? '<div class="qq-card-selhint">price breaks below ↓</div>' : '')
            + '</div>';
    }

    function renderAll() {
        if (state.mode === 'linesheet') renderLinePreview();
        else renderResults();
        renderSafetyRecs();  // safety-apparel recs (shows only when SCP + stripes; both modes)
    }

    // ============================================================
    // LINE SHEET MODE — method-first multi-style mini-catalog -> PDF
    // One imprint method, several styles. Each style is priced INDEPENDENTLY via
    // probeLadder() (the same engine probe the matrix uses) and NEVER summed, so
    // every number on the sheet is identical-by-construction to the rest of the app.
    // ============================================================
    var NWCA_LOGO = 'https://cdn.caspio.com/A0E15000/Safety%20Stripes/web%20northwest%20custom%20apparel%20logo.png?ver=1';
    var LINE_METHODS = [
        { id: 'emb', label: 'Embroidery' },
        { id: 'capemb', label: 'Cap embroidery' },
        { id: 'dtg', label: 'DTG print' },
        { id: 'scp', label: 'Screen print' },
        { id: 'dtf', label: 'DTF transfer' }
    ];
    var LINE_MAX = 6;

    // active method(s) for shared config-control visibility: quick = the eligible set; line = the locked one
    function activeMethodIds() {
        if (state.mode === 'linesheet') return state.lineMethod ? [state.lineMethod] : [];
        return state.methods.map(function (m) { return m.id; });
    }
    function hasActive(id) { return activeMethodIds().indexOf(id) >= 0; }
    function configIsCap() {
        return state.mode === 'linesheet' ? (state.lineMethod === 'capemb') : !!(state.product && state.product.isCap);
    }
    function renderPlacementVisibility() {
        var pf = $('qqPlacementField'); if (!pf) return;
        if (state.mode === 'linesheet') pf.hidden = !(hasActive('dtg') || hasActive('scp') || hasActive('dtf'));
        else pf.hidden = !!(state.product && state.product.isCap);
        renderSleeveRow();
    }
    // Sleeve row: DTF (≤5×5" transfer, priced like a left chest) and/or screen print (each sleeve =
    // an additional print location). DTG has no sleeves; embroidered sleeve logos go through the logo
    // panel. Label is method-aware; the ink-color stepper shows only for SCP (a sleeve prices on colors).
    function renderSleeveRow() {
        var row = $('qqSleeveRow'); if (!row) return;
        var dtf = hasActive('dtf'), scp = hasActive('scp');
        row.hidden = !(dtf || scp);
        var lbl = $('qqSleeveLabel');
        if (lbl) {
            var bits = [];
            if (dtf) bits.push('DTF · ≤5×5"');
            if (scp) bits.push('screen print');
            lbl.innerHTML = 'Sleeves' + (bits.length ? ' <span class="muted">· ' + bits.join(' · ') + '</span>' : '');
        }
        var lWrap = $('qqSleeveInkLWrap'); if (lWrap) lWrap.hidden = !(scp && state.sleeves.left);
        var rWrap = $('qqSleeveInkRWrap'); if (rWrap) rWrap.hidden = !(scp && state.sleeves.right);
    }
    function repriceActive() { if (state.mode === 'linesheet') repriceLineAll(); else repriceAll(); }
    var repriceActiveDebounced = debounce(repriceActive, 350);
    // refresh the shared config controls (placement / ink / embroidery) for the current mode+method
    function renderConfigControls() {
        renderPlacements();          // -> renderInkField (placement + ink visibility)
        renderEmbPanel();
        renderPlacementVisibility();
        syncAdvancedInputs();
    }

    // ---- mode toggle ----
    function setMode(mode) {
        if (mode === state.mode) return;
        state.mode = mode;
        renderMode();
        renderConfigControls();
        renderAll();
    }
    function renderMode() {
        var line = state.mode === 'linesheet';
        document.body.classList.toggle('qq-mode-line', line); // scopes the print stylesheet
        Array.prototype.forEach.call(document.querySelectorAll('#qqModeToggle [data-mode]'), function (b) {
            b.classList.toggle('is-active', b.getAttribute('data-mode') === state.mode);
        });
        $('qqQuickInputs').hidden = line;        // style + color + qty (quick only)
        $('qqLineMethodField').hidden = !line;   // method selector (line only)
        $('qqLineStylesField').hidden = !line;   // style list (line only)
        $('qqQuickResults').hidden = line;
        $('qqLineResults').hidden = !line;
    }

    // ---- method selector ----
    function renderLineMethods() {
        var box = $('qqLineMethodChips'); if (!box) return;
        box.innerHTML = LINE_METHODS.map(function (m) {
            return '<button type="button" class="qq-place-chip' + (m.id === state.lineMethod ? ' is-active' : '')
                + '" data-line-method="' + m.id + '">' + esc(m.label) + '</button>';
        }).join('');
    }
    function setLineMethod(id) {
        state.lineMethod = id;
        if (id === 'scp' || id === 'dtg' || id === 'dtf') {
            state.front = 'LC'; state.back = ''; state.sleeves = { left: false, right: false };
            if (id === 'scp') { state.frontInk = 1; state.backInk = 1; }
        }
        if (id === 'emb' || id === 'capemb') { state.adv.embStitch = 8000; state.embAddl = []; state.capEmb = 'embroidery'; }
        renderLineMethods();
        renderConfigControls();
        repriceLineAll();
        renderSafetyRecs();  // re-eval safety-apparel recs when the line method changes
    }

    // ---- style list (input panel) ----
    function lineRow(uid) { return state.lineStyles.filter(function (r) { return r.uid === uid; })[0]; }
    function addLineStyle() {
        if (state.lineStyles.length >= LINE_MAX) return;
        state.lineStyles.push({ uid: ++_lineUid, raw: '', product: null, color: null, status: 'empty', tiers: null, pricing: false, error: '' });
        renderLineList();
        var inp = document.querySelector('.qq-line-row:last-child .qq-line-style'); if (inp) inp.focus();
    }
    function removeLineStyle(uid) {
        state.lineStyles = state.lineStyles.filter(function (r) { return r.uid !== uid; });
        renderLineList(); renderLinePreview();
    }
    function moveLineStyle(uid, dir) {
        var i = state.lineStyles.findIndex(function (r) { return r.uid === uid; });
        var j = i + dir;
        if (i < 0 || j < 0 || j >= state.lineStyles.length) return;
        var a = state.lineStyles[i]; state.lineStyles[i] = state.lineStyles[j]; state.lineStyles[j] = a;
        renderLineList(); renderLinePreview();
    }

    // renderLineList renders the row SHELLS (style input + controls) — called only on add/remove/move
    // so the style input is never replaced mid-type. updateLineRow fills the dynamic content.
    function renderLineList() {
        var box = $('qqLineList'); if (!box) return;
        if (!state.lineStyles.length) {
            box.innerHTML = '<p class="qq-line-empty">Add a style to start the sheet.</p>';
        } else {
            box.innerHTML = state.lineStyles.map(function (r, idx) {
                return '<div class="qq-line-row" data-uid="' + r.uid + '">'
                    + '<div class="qq-line-head">'
                    + '<input class="qq-line-style input" type="text" inputmode="text" autocomplete="off" placeholder="Style #" value="' + esc(r.raw) + '" data-uid="' + r.uid + '">'
                    + '<div class="qq-line-ctrls">'
                    + '<button type="button" class="qq-line-mv" data-uid="' + r.uid + '" data-dir="-1" aria-label="Move up"' + (idx === 0 ? ' disabled' : '') + '>&uarr;</button>'
                    + '<button type="button" class="qq-line-mv" data-uid="' + r.uid + '" data-dir="1" aria-label="Move down"' + (idx === state.lineStyles.length - 1 ? ' disabled' : '') + '>&darr;</button>'
                    + '<button type="button" class="qq-line-rm" data-uid="' + r.uid + '" aria-label="Remove style">&times;</button>'
                    + '</div></div>'
                    + '<div class="qq-line-content" id="qqlc-' + r.uid + '"></div>'
                    + '</div>';
            }).join('');
            state.lineStyles.forEach(updateLineRow);
        }
        updateLineActions();
    }
    function updateLineRow(row) {
        var el = document.getElementById('qqlc-' + row.uid); if (!el) return;
        if (row.status === 'empty') { el.innerHTML = ''; return; }
        if (row.status === 'loading') { el.innerHTML = '<span class="qq-line-stat loading">Looking up&hellip;</span>'; return; }
        if (row.status === 'error') { el.innerHTML = '<span class="qq-line-stat err">' + esc(row.error || 'Not found') + '</span>'; return; }
        var img = row.color && row.color.image;
        var thumb = img
            ? '<img class="qq-line-thumb" src="' + esc(img) + '" alt="" referrerpolicy="no-referrer" onerror="this.style.visibility=\'hidden\'">'
            : '<span class="qq-line-thumb is-empty"></span>';
        var colorSel = '';
        if (row.product && row.product.colors.length) {
            colorSel = '<select class="qq-line-color" data-uid="' + row.uid + '" aria-label="Color">'
                + row.product.colors.map(function (c) {
                    return '<option value="' + esc(c.catalog) + '"' + (row.color && c.catalog === row.color.catalog ? ' selected' : '') + '>' + esc(c.name) + '</option>';
                }).join('') + '</select>';
        }
        var price = row.pricing ? '<span class="qq-line-stat loading">Pricing&hellip;</span>'
            : (row.tiers && row.tiers.length) ? '<span class="qq-line-price">from ' + fmt(row.tiers[row.tiers.length - 1].base) + '/' + (row.product.isCap ? 'cap' : 'pc') + '</span>'
            : (row.tiers && !row.tiers.length) ? '<span class="qq-line-stat err">No price for this method</span>' : '';
        el.innerHTML = thumb + '<div class="qq-line-meta"><span class="qq-line-name">' + esc(row.product.name) + '</span>' + colorSel + price + '</div>';
    }
    function updateLineActions() {
        var n = state.lineStyles.length;
        $('qqLineAdd').disabled = n >= LINE_MAX;
        $('qqLineAdd').textContent = n >= LINE_MAX ? 'Max ' + LINE_MAX + ' styles' : '+ Add style';
        var hasPriced = state.lineStyles.some(function (r) { return r.tiers && r.tiers.length; });
        $('qqLineDownload').disabled = !hasPriced;
        $('qqLinePrint').disabled = !hasPriced;
    }

    function onLineStyleInput(uid, raw) {
        var row = lineRow(uid); if (!row) return;
        row.raw = raw;
        var style = String(raw || '').trim().toUpperCase();
        if (!style) { row.product = null; row.color = null; row.status = 'empty'; row.tiers = null; updateLineRow(row); updateLineActions(); renderLinePreview(); return; }
        row.status = 'loading'; row.error = ''; updateLineRow(row);
        var token = ++state.lineSeq; row._tok = token;
        fetchProduct(style).then(function (product) {
            if (row._tok !== token) return;
            row.product = product;
            row.color = product.colors.length ? product.colors[0] : null;
            row.status = 'ok'; row.tiers = null;
            return loadProductSizes(product).then(function () {
                if (row._tok !== token) return;
                updateLineRow(row);
                priceLineRow(row);
            });
        }).catch(function () {
            if (row._tok !== token) return;
            row.product = null; row.color = null; row.status = 'error'; row.error = 'Not found'; row.tiers = null;
            updateLineRow(row); updateLineActions(); renderLinePreview();
        });
    }
    function onLineColorChange(uid, catalog) {
        var row = lineRow(uid); if (!row || !row.product) return;
        row.color = (row.product.colors || []).filter(function (c) { return c.catalog === catalog; })[0] || row.color;
        row.tiers = null;
        updateLineRow(row);
        priceLineRow(row);
    }

    // Per-row size run (so stdSizeFor finds a real size). The bundle is the same one the engine
    // fetches for pricing, so it's warm in cache; falls back to a default run on failure.
    function loadProductSizes(product) {
        if (!product || product.sizes) return Promise.resolve();
        var fallback = product.isCap ? ['OSFA'] : ['S', 'M', 'L', 'XL', '2XL', '3XL', '4XL'];
        return fetch(API_BASE + '/api/pricing-bundle?method=BLANK&styleNumber=' + encodeURIComponent(product.style))
            .then(function (r) { return r.ok ? r.json() : null; })
            .then(function (d) {
                var arr = d && (d.sizes || (d.pricing && d.pricing.sizes) || (d.data && d.data.sizes));
                product.sizes = (Array.isArray(arr) && arr.length)
                    ? arr.map(function (s) { return (s && s.size) ? s.size : s; }).filter(Boolean) : fallback;
            })
            .catch(function () { product.sizes = fallback; });
    }

    // ---- pricing (each row independent — NEVER summed; Rule 9) ----
    function repriceLineAll() {
        if (state.mode !== 'linesheet') return;
        if (!state.lineMethod) { renderLineList(); renderLinePreview(); return; }
        state.lineStyles.forEach(function (row) { if (row.product) { row.tiers = null; priceLineRow(row); } });
        renderLinePreview();
    }
    function priceLineRow(row) {
        if (!state.lineMethod || !row.product) { renderLinePreview(); return; }
        var token = ++state.lineSeq; row._ptok = token;
        row.pricing = true; updateLineRow(row);
        probeLadder(state.lineMethod, row.product, row.color).then(function (tiers) {
            if (row._ptok !== token) return;
            row.tiers = tiers; row.pricing = false;
            updateLineRow(row); updateLineActions(); renderLinePreview();
        }).catch(function () {
            if (row._ptok !== token) return;
            row.tiers = []; row.pricing = false;
            updateLineRow(row); updateLineActions(); renderLinePreview();
        });
    }

    // ---- the line-sheet preview (becomes the PDF via window.print) ----
    function lineConfigLabel() {
        if (!state.lineMethod) return '';
        var m = LINE_METHODS.filter(function (x) { return x.id === state.lineMethod; })[0];
        var cfg = configText(state.lineMethod);
        return (m ? m.label : '') + (cfg ? ' · ' + cfg : '');
    }
    function lineLadderHtml(tiers, isCap) {
        if (!tiers || !tiers.length) return '';
        var unit = isCap ? 'cap' : 'pc';
        var hasLtm = tiers.some(function (t) { return t.ltmFee > 0; });
        var qcells = tiers.map(function (t) { return '<th>' + esc(rangeLabel(t)) + '</th>'; }).join('');
        var pcells = tiers.map(function (t) { return '<td>' + fmt(t.base) + '</td>'; }).join('');
        var ltmRow = hasLtm ? '<tr><td class="lbl">Small-batch</td>' + tiers.map(function (t) {
            return '<td' + (t.ltmFee > 0 ? ' class="warn"' : '') + '>' + (t.ltmFee > 0 ? '+' + fmt(t.ltmFee) : '&mdash;') + '</td>';
        }).join('') + '</tr>' : '';
        return '<div class="qq-sheet-ladder-wrap"><table class="qq-sheet-ladder"><thead><tr><th class="lbl">Qty</th>' + qcells + '</tr></thead>'
            + '<tbody><tr><td class="lbl">Per ' + unit + '</td>' + pcells + '</tr>' + ltmRow + '</tbody></table></div>';
    }
    function renderLinePreview() {
        var box = $('qqSheet'); if (!box) return;
        if (!state.lineMethod) {
            box.innerHTML = '<div class="qq-sheet-placeholder">Pick an imprint method, then add styles to build the line sheet.</div>';
            return;
        }
        var priced = state.lineStyles.filter(function (r) { return r.product && r.tiers && r.tiers.length; });
        var head = '<div class="qq-sheet-head">'
            + '<img class="qq-sheet-logo" src="' + NWCA_LOGO + '" alt="Northwest Custom Apparel" referrerpolicy="no-referrer">'
            + '<div class="qq-sheet-htext"><div class="qq-sheet-brand">Northwest Custom Apparel</div>'
            + '<div class="qq-sheet-sub">Line Sheet &middot; ' + esc(lineConfigLabel()) + '</div></div></div>';
        var body;
        if (!priced.length) {
            body = '<div class="qq-sheet-placeholder">Add styles on the left &mdash; each appears here with its price ladder.</div>';
        } else {
            body = '<div class="qq-sheet-body">' + priced.map(function (r) {
                var img = r.color && r.color.image;
                var imgHtml = img
                    ? '<img class="qq-sheet-img" src="' + esc(img) + '" alt="" referrerpolicy="no-referrer" onerror="this.style.visibility=\'hidden\'">'
                    : '<span class="qq-sheet-img is-empty"></span>';
                return '<div class="qq-sheet-item">' + imgHtml
                    + '<div class="qq-sheet-item-main">'
                    + '<div class="qq-sheet-item-head"><span class="qq-sheet-style">' + esc(r.product.style) + '</span> &middot; '
                    + esc(r.product.name) + '<span class="qq-sheet-color">Color: ' + esc(r.color ? r.color.name : '') + '</span></div>'
                    + lineLadderHtml(r.tiers, r.product.isCap)
                    + '</div></div>';
            }).join('') + '</div>';
        }
        var foot = '<div class="qq-sheet-foot">'
            + '<div>Estimate only &middot; pricing valid 30 days &middot; confirm stock &amp; sizes at order time.</div>'
            + '<div>Northwest Custom Apparel &middot; (253) 922-5793 &middot; sales@nwcustomapparel.com</div></div>';
        box.innerHTML = head + body + foot;
    }
    function printLineSheet() { window.print(); }

    // ============================================================
    // WIRING
    // ============================================================
    function wire() {
        if (!window.QuoteCartEngine) { $('qqEngineError').hidden = false; }

        $('qqStyle').addEventListener('input', debounce(function (e) { lookupStyle(e.target.value); }, 450));

        // Click a priced method card to show its price-breaks matrix below.
        $('qqResults').addEventListener('click', function (e) {
            if (e.target.closest('.qq-open-builder')) return; // builder handoff link — let the browser navigate
            if (e.target.closest('.qq-retry')) return; // retry has its own handler
            var nudge = e.target.closest('.qq-card-nudge[data-addqty]');
            if (nudge) { // one-click "add N more" → bump qty to the next price break
                if (state.useSizes) return;
                var add = parseInt(nudge.getAttribute('data-addqty'), 10) || 0;
                if (add > 0) { state.qty = (num(state.qty) || 0) + add; $('qqQty').value = state.qty; repriceAll(); }
                return;
            }
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
            maybeSuggestDark(); // re-suggest underbase for the newly-picked color (unless AE set it)
            renderColorSwatches();
            renderThumb();
            loadInventory(); // refresh blank-stock for the newly-picked color
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

        $('qqPlacePresets').addEventListener('click', function (e) {
            var b = e.target.closest('[data-front]'); if (!b) return;
            state.front = b.getAttribute('data-front') || '';
            state.back = b.getAttribute('data-back') || '';
            state.sleeves = { left: false, right: false }; // presets set a clean common combo
            renderPlacements();
            repriceActive();
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
            repriceActive();
        }
        $('qqFront').addEventListener('click', onPlaceChip);
        $('qqBack').addEventListener('click', onPlaceChip);
        $('qqSleeveL').addEventListener('change', function (e) { state.sleeves.left = e.target.checked; renderSleeveRow(); repriceActive(); });
        $('qqSleeveR').addEventListener('change', function (e) { state.sleeves.right = e.target.checked; renderSleeveRow(); repriceActive(); });
        $('qqSleeveInkL').addEventListener('input', function (e) {
            state.sleeveInkL = Math.min(6, Math.max(1, parseInt(e.target.value, 10) || 1));
            repriceActiveDebounced();
        });
        $('qqSleeveInkR').addEventListener('input', function (e) {
            state.sleeveInkR = Math.min(6, Math.max(1, parseInt(e.target.value, 10) || 1));
            repriceActiveDebounced();
        });

        $('qqInkFront').addEventListener('input', function (e) {
            state.frontInk = Math.min(6, Math.max(1, parseInt(e.target.value, 10) || 1));
            repriceActiveDebounced();
        });
        $('qqInkBack').addEventListener('input', function (e) {
            state.backInk = Math.min(6, Math.max(1, parseInt(e.target.value, 10) || 1));
            repriceActiveDebounced();
        });

        // embroidery logo panel (primary + additional logos)
        $('qqEmbLogos').addEventListener('input', function (e) {
            var inp = e.target.closest('.qq-emb-stitch'); if (!inp) return;
            var key = inp.getAttribute('data-logo');
            var val = Math.max(1000, parseInt(inp.value, 10) || 8000);
            if (key === 'primary') state.adv.embStitch = val;
            else if (state.embAddl[Number(key)]) state.embAddl[Number(key)].stitch = val;
            updateEmbWarn();
            repriceActiveDebounced();
        });
        $('qqEmbLogos').addEventListener('click', function (e) {
            var rm = e.target.closest('.qq-emb-remove'); if (!rm) return;
            state.embAddl.splice(Number(rm.getAttribute('data-i')), 1);
            renderEmbPanel(); repriceActive();
        });
        $('qqEmbAddBtn').addEventListener('click', function () {
            var isCap = configIsCap();
            if (isCap && state.embAddl.length >= 1) return;
            state.embAddl.push({ stitch: isCap ? 5000 : 8000 });
            renderEmbPanel(); repriceActive();
        });
        $('qqEmbDigitizing').addEventListener('change', function (e) { state.adv.digitizing = e.target.checked; repriceActive(); });
        $('qqCapEmbType').addEventListener('click', function (e) {
            var b = e.target.closest('[data-cap-emb]'); if (!b) return;
            state.capEmb = b.getAttribute('data-cap-emb');
            renderEmbPanel(); repriceActive();
        });
        $('qqScpDark').addEventListener('change', function (e) { state.adv.scpDark = e.target.checked; state.scpDarkUserSet = true; repriceActive(); });
        $('qqScpStripes').addEventListener('change', function (e) { state.adv.scpStripes = e.target.checked; repriceActive(); renderSafetyRecs(); });

        // ----- Line Sheet mode wiring -----
        $('qqModeToggle').addEventListener('click', function (e) {
            var b = e.target.closest('[data-mode]'); if (!b) return;
            setMode(b.getAttribute('data-mode'));
        });
        $('qqLineMethodChips').addEventListener('click', function (e) {
            var b = e.target.closest('[data-line-method]'); if (!b) return;
            setLineMethod(b.getAttribute('data-line-method'));
        });
        $('qqLineAdd').addEventListener('click', addLineStyle);
        var onLineStyleInputDebounced = debounce(function (uid, val) { onLineStyleInput(uid, val); }, 450);
        $('qqLineList').addEventListener('input', function (e) {
            var si = e.target.closest('.qq-line-style'); if (si) onLineStyleInputDebounced(Number(si.getAttribute('data-uid')), si.value);
        });
        $('qqLineList').addEventListener('change', function (e) {
            var cs = e.target.closest('.qq-line-color'); if (cs) onLineColorChange(Number(cs.getAttribute('data-uid')), cs.value);
        });
        $('qqLineList').addEventListener('click', function (e) {
            var mv = e.target.closest('.qq-line-mv'); if (mv && !mv.disabled) { moveLineStyle(Number(mv.getAttribute('data-uid')), Number(mv.getAttribute('data-dir'))); return; }
            var rm = e.target.closest('.qq-line-rm'); if (rm) { removeLineStyle(Number(rm.getAttribute('data-uid'))); return; }
        });
        $('qqLineDownload').addEventListener('click', printLineSheet);
        $('qqLinePrint').addEventListener('click', printLineSheet);

        // init: render both modes' scaffolding (Quick Price is the default view)
        renderMode();
        renderLineMethods();
        renderLineList();
        renderLinePreview();
        renderResults();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', wire);
    } else {
        wire();
    }
})();
