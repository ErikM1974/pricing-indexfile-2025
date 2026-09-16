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

    var API_BASE = window.APP_CONFIG.API.BASE_URL;

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
        var was = !!state.adv.scpDark;
        if (!state.scpDarkUserSet) state.adv.scpDark = state.color ? isDarkGarment(state.color.name) : false;
        if (was !== !!state.adv.scpDark) ++configVersion; // shared with the line sheet
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
        lineQty: null,      // No requested quantity: show verified sample prices for each tier.
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
        handback: null,       // {token} when opened from the AE Order Intake (?from=aeo&hb=) —
                              // cards grow a "Use on order form" button that hands the price
                              // back to the intake tab via localStorage (storage event)
        pinOnce: null,        // ?method= deep-link — pins that method on the first product load
        // ----- LINE SHEET MODE (method-first multi-style mini-catalog -> PDF) -----
        mode: 'linesheet',    // DEFAULT (AEs prefer line-item) | 'quick' (one style, every method)
        lineMethod: 'emb',     // locked imprint method id for the sheet: emb|capemb|dtg|scp|dtf
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
                parts.push({ text: twoLoc ? 'front + back' : state.front ? 'front' : 'back' });
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
    function isFlatHeadwear(product) { return !!(product && product.headwear && product.headwear.isFlat); }
    function oneSize(product) { return !!(product && product.isCap) || isFlatHeadwear(product); }
    function frontLogoLabel(cap, product) { return cap ? 'Cap front' : isFlatHeadwear(product) ? 'Front' : 'Left chest'; }
    function defaultSizes() { return oneSize(state.product) ? ['OSFA'] : ['S', 'M', 'L', 'XL', '2XL', '3XL', '4XL']; }
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
    // Cap vs garment comes from the shared classifier: Richardson caps have no category and
    // Richardson/New Era also sell apparel. Flat headwear (beanies, knit caps) is not a cap: it is
    // one size and priced as flat (garment) embroidery, as the EMB builder does (Erik 2026-09-16).
    function classifyHeadwear(meta) {
        if (!window.HeadwearClassifier) throw lookupError('The product type check did not load. Refresh the page.', false);
        return window.HeadwearClassifier.classify(meta);
    }
    // Rule 9: flat only when the EMB builder agrees. Its isCapProduct() asks ProductCategoryFilter about
    // the style-search label ("STYLE - TITLE") before the category, so fleece headbands, gaiters and skull
    // caps in "Caps" stay caps there — and here. Blank-category ones keep the rep's choice on a line sheet.
    function matchBuilderFlat(headwear, style, title) {
        if (!headwear.isFlat) return headwear;
        if (!window.ProductCategoryFilter) throw lookupError('The product type check did not load. Refresh the page.', false);
        if (window.ProductCategoryFilter.isFlatHeadwear({ PRODUCT_TITLE: style + ' - ' + title })) return headwear;
        return Object.assign({}, headwear, { kind: 'cap', isCap: true, isFlat: false, confident: headwear.reason === 'category', reason: 'builder' });
    }
    function lookupError(message, notFound) {
        var err = new Error(message); err.notFound = notFound; return err;
    }
    // A style number has a digit and no spaces; anything else is searched by name.
    function looksLikeStyle(value) {
        return /^[A-Z0-9._/-]{2,20}$/i.test(value) && /\d/.test(value);
    }
    function lookupMessage(err, style) {
        if (err && err.notFound) return 'No product found for ' + style + '.';
        if (err && err.notFound === false) return err.message;
        return 'Product lookup failed. Check your connection and try again.';
    }

    var lookupSeq = 0;
    var sizeSeq = 0;
    var LOOKUP_PAUSE = 450;     // ms after the last keystroke before a typed style is looked up
    var quickStyleTimer;

    // Fetch + normalize a product (style -> { style, name, isCap, colors:[{name,catalog,swatch,image}] }).
    // Pure: returns the product, mutates no global state — so BOTH the single-style lookup (Quick Price)
    // and the Line Sheet's per-row add-style can reuse it.
    function fetchProduct(style) {
        return fetch(API_BASE + '/api/product-details?styleNumber=' + encodeURIComponent(style))
            .then(function (r) {
                if (r.status === 404) throw lookupError('No product found for ' + style + '.', true);
                if (!r.ok) throw lookupError('Product lookup failed (' + r.status + '). Try again.', false);
                return r.json();
            })
            .then(function (rows) {
                if (!Array.isArray(rows) || rows.length === 0) throw lookupError('No product found for ' + style + '.', true);
                var meta = rows[0];
                var title = meta.PRODUCT_TITLE || style;
                var category = meta.CATEGORY_NAME || '';
                var subcat = meta.SUBCATEGORY_NAME || '';
                var desc = meta.PRODUCT_DESCRIPTION || '';
                var headwear = matchBuilderFlat(classifyHeadwear(meta), style, meta.PRODUCT_TITLE || '');
                var cap = headwear.isCap;
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
                    style: style, name: cleanName(title, style), isCap: cap, headwear: headwear,
                    category: category, subcategory: subcat, description: desc,
                    colors: colors, sizes: null
                };
            });
    }

    function lookupStyle(raw) {
        var style = String(raw || '').trim().toUpperCase();
        ++lookupSeq; ++sizeSeq; state.product = null; invalidateQuick();
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
                    state.product.eligibility = elig;
                    applyProduct(elig);
                    loadSizes(); // refines the real size run for this style/color, then reprices
                });
            })
            .catch(function (err) {
                if (token !== lookupSeq) return;
                state.product = null;
                statusEl.innerHTML = '<span class="err">' + esc(err && err.notFound
                    ? 'Couldn’t find “' + style + '” — check the style number.'
                    : lookupMessage(err, style)) + '</span>';
                renderAll();
                if (err && err.notFound && window.QuickQuoteWorkspace) window.QuickQuoteWorkspace.suggest($('qqStyle'));
            });
    }

    function cleanName(title, style) {
        return String(title || '').replace(new RegExp('[.\\s]+' + style + '\\s*$', 'i'), '').trim() || style;
    }

    function resolveEligibility(product) {
        if (product.isCap) return Promise.resolve(null); // caps → cap embroidery only
        // Flat headwear → garment embroidery only (the "Caps" category rule lists no garment methods).
        if (isFlatHeadwear(product)) return Promise.resolve({ EMB: true, DTG: 'no', SCP: false, DTF: false, source: 'flat-headwear' });
        return categoryEligibility(product);
    }
    // The category rules for any product (never null); the line sheet also asks this for unconfirmed caps.
    function categoryEligibility(product) {
        if (!window.DecorationMethods || typeof window.DecorationMethods.eligibleFor !== 'function') {
            return Promise.resolve({ EMB: true, DTG: 'no', SCP: false, DTF: false, source: 'fallback' });
        }
        try {
            var p = window.DecorationMethods.eligibleFor({
                STYLE: product.style, CATEGORY_NAME: product.category,
                SUBCATEGORY_NAME: product.subcategory, PRODUCT_DESCRIPTION: product.description
            });
            // A rules failure is the same embroidery-only fallback, which callers must announce.
            // categoriesFor() is null only when the rules feed itself did not load.
            return Promise.resolve(p).catch(function () { return { EMB: true, DTG: 'no', SCP: false, DTF: false, source: 'fallback' }; })
                .then(function (elig) {
                    if (!elig || elig.source !== 'fallback' || typeof window.DecorationMethods.categoriesFor !== 'function') return elig;
                    return Promise.resolve(window.DecorationMethods.categoriesFor('emb')).catch(function () { return null; })
                        .then(function (list) { return Object.assign({}, elig, { rulesDown: !list }); });
                });
        } catch (e) {
            return Promise.resolve({ EMB: true, DTG: 'no', SCP: false, DTF: false, source: 'fallback' });
        }
    }
    // DTG eligibility is 'yes' | 'warn' | 'no'; the other methods are booleans.
    function methodAllowed(elig, key) {
        var v = elig && elig[key];
        return v === true || v === 'yes' || v === 'warn';
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
        ++configVersion; // resets placements, logos and cap style shared with the line sheet
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
        // one-shot ?method= deep-link (AE round-trip): pin that method on the
        // FIRST product load only — later style switches auto-follow best value
        if (state.pinOnce && state.methods.some(function (m) { return m.id === state.pinOnce; })) {
            state.selectedMethod = state.pinOnce;
            state.methodPinned = true;
        }
        state.pinOnce = null;
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
        state.quickVersion = configVersion;
        if (!state.product || state.methods.length === 0) { renderResults(); return; }
        if (totalQty() <= 0) { state.results = {}; renderResults(); return; }
        var token = ++state.seq;
        state.results = {};
        state.quickVersion = configVersion;
        state.methods.forEach(function (m) { priceMethod(m.id, token); });
    }
    function invalidateQuick() { ++state.seq; state.results = {}; renderResults(); }
    var scheduleQuickPrice = debounce(repriceAll, 300);
    function repriceDebounced() { invalidateQuick(); scheduleQuickPrice(); }

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
        state.inventory = null; state.invStatus = null; state.invError = false;
        var token = ++_invSeq;
        if (!style || !keys.length) { box.innerHTML = ''; return; }
        state.invLoading = true; renderInventory();
        (function tryKey(i) {
            if (i >= keys.length) { if (token === _invSeq) { state.inventory = {}; state.invLoading = false; renderInventory(); } return; }
            fetch(API_BASE + '/api/inventory?styleNumber=' + encodeURIComponent(style) + '&color=' + encodeURIComponent(keys[i]))
                .then(function (r) { if (!r.ok) throw new Error("Inventory unavailable"); return r.json(); })
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
                .catch(function () { if (token !== _invSeq) return; state.invLoading = false; state.invError = true; renderInventory(); });
        })(0);
    }
    function renderInventory() {
        var box = $('qqInventory'); if (!box) return;
        if (state.invLoading) { box.innerHTML = '<div class="qq-inv-note">Checking stock…</div>'; return; }
        if (state.invError) {
            box.innerHTML = '<div class="qq-inv-error">Stock could not be checked. Confirm availability before ordering.<br><button type="button" class="btn qq-inv-retry">Retry stock check</button></div>';
            box.querySelector('button').addEventListener('click', loadInventory);
            return;
        }
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
        keepFocus($('qqFront'), function () { $('qqFront').innerHTML = chips(FRONT_OPTS, state.front, 'front'); });
        keepFocus($('qqBack'), function () { $('qqBack').innerHTML = chips(BACK_OPTS, state.back, 'back'); });
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
        var primaryLabel = state.front ? 'Front' : 'Back';
        $('qqInkFront').closest('.qq-ink-loc').querySelector('.qq-ink-lbl').textContent = primaryLabel;
        $('qqInkFront').setAttribute('aria-label', primaryLabel + ' ink colors');
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
            keepFocus($('qqCapEmbType'), function () {
                $('qqCapEmbType').innerHTML = CAP_EMB_OPTS.map(function (o) {
                    return '<button type="button" class="qq-place-chip' + (o.code === state.capEmb ? ' is-active' : '')
                        + '" data-cap-emb="' + o.code + '">' + esc(o.label) + '</button>';
                }).join('');
            });
        } else {
            capWrap.hidden = true;
        }
        var rows = [embLogoRow('primary', frontLogoLabel(isCap, state.mode === 'linesheet' ? null : state.product), state.adv.embStitch, false)];
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
            : state.mode === 'linesheet' ? 'Up to 10,000 stitches included. Additional logos priced separately.'
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
    // Engine-authoritative: prices each tier through the SAME singleItemPreview()
    // the cards use, so the ladder can't disagree with the quote. The small-batch
    // (LTM) fee is shown on its own row, mirroring our standard pricing matrix.
    // ============================================================
    // Probe each tier at its LOWEST quantity (today's Caspio tiers). Freight and small-batch
    // shares only fall as quantity rises inside a tier — DTF freight steps at 50/100/200 — so
    // the first quantity is the tier's highest price and exactly what the builder charges there.
    // The lowest probe lands in the small-batch tier: EMB 1-7, DTG 1-11, DTF 10-23, SCP 24-47.
    var PROBE_QTYS = { emb: [1, 8, 24, 48, 72], capemb: [1, 8, 24, 48, 72], dtg: [1, 12, 24, 48, 72], scp: [24, 48, 72, 145], dtf: [10, 24, 48, 72] };
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
    // config. Returns [{label, base, ltmFee, range, setup, preview}] sorted by tier, each priced
    // through the SAME singleItemPreview() the cards use, so a ladder can't disagree with a live
    // quote. Shared by the Quick-Price matrix AND the Line Sheet (one ladder per style).
    // Throws when the engine could not be reached, so a column never silently disappears.
    async function probeLadder(id, product, color) {
        var def = METHODS[id];
        if (!def || !product || !window.QuoteCartEngine) return [];
        var probes = PROBE_QTYS[id] || [12, 36, 60, 100];
        var size = stdSizeFor(product);
        var byTier = {};
        var lastTierTable = null;   // discovered from the engine's own trace (live Caspio tiers)
        var probeMode = 'discover'; // discover: first price per tier · anchor: tier minimum wins · highest: larger base wins
        var failure = null;

        // Probe ONE qty and record its tier row. Base = everything that scales
        // with qty EXCEPT the one-time setup fees and the flat small-batch (LTM) fee,
        // which is disclosed on its own row. Derive from groupTotal (which already folds
        // in per-piece service lines — stitch surcharge, AL — and any cap upcharge) so it
        // is mode-agnostic: correct whether the engine's baseUnit is LTM-stripped
        // (EMB/SCP/DTG) OR LTM-inclusive (DTF). Mirrors pdp-configurator.js probe math so
        // the 3 surfaces can't disagree. probeMode decides whether a later probe of an
        // already-seen tier may replace its row (see the steps below).
        async function probeQty(pq) {
            var sz = {}; sz[size] = pq;
            var item = buildItemFor(def, product, color, sz);
            var preview;
            try {
                preview = await window.QuoteCartEngine.singleItemPreview(item, { groups: def.groups(), deps: engineDeps(), nudge: false });
            } catch (e) { failure = e; preview = null; }
            // Only "below the minimum order" means no price at this quantity; anything else is a failure.
            if (preview && !preview.ok && (!preview.error || preview.error.code !== 'BELOW_MINIMUM')) failure = preview.error || new Error('pricing failed');
            if (!(preview && preview.ok && preview.lines && preview.lines.length)) return;
            if (preview.trace && preview.trace.tierTable && preview.trace.tierTable.length) {
                lastTierTable = preview.trace.tierTable;
            }
            var label = preview.tierLabel || ('q' + pq);
            var prior = byTier[label];
            if (prior && probeMode === 'discover') return;
            var oneTimeT = (preview.fees || []).reduce(function (s, f) { return s + (f.oneTime ? (Number(f.amount) || 0) : 0); }, 0);
            var ltmFlat = (preview.ltm && preview.ltm.fee) || 0;
            var base = Math.max(0, (preview.groupTotal - oneTimeT - ltmFlat) / pq);
            if (prior && probeMode === 'highest' && !(base > prior.exactBase)) return;
            byTier[label] = { label: label, base: r2(base), exactBase: base, ltmFee: ltmFlat, range: parseRange(label), sampleQuantity: pq, setup: r2(oneTimeT), preview: preview };
        }

        // 1) Bootstrap: probe the representative qtys (the lowest quantity of each tier we
        //    KNOW about today). These also make the engine hand back its live tierTable.
        for (var i = 0; i < probes.length; i++) {
            await probeQty(probes[i]);
        }

        // 2) Self-heal against a Caspio tier restructure: probe the min qty of any LIVE
        //    tier the constants didn't already land in, so a re-tiering (added/renamed
        //    tier) can't silently drop a row from the ladder.
        if (lastTierTable) {
            var seenMins = {};
            Object.keys(byTier).forEach(function (k) { seenMins[byTier[k].range.min] = true; });
            var missing = lastTierTable
                .map(function (t) { return Number(t.minQty); })
                .filter(function (m) { return Number.isFinite(m) && m > 0 && !seenMins[m]; })
                .sort(function (a, b) { return a - b; });
            probeMode = 'self-heal';
            for (var j = 0; j < missing.length; j++) {
                await probeQty(missing[j]);
            }
        }

        // 3) If a tier moved, re-price it at its new lowest quantity (the tier's highest price).
        probeMode = 'anchor';
        var moved = Object.keys(byTier).map(function (k) { return byTier[k]; })
            .filter(function (t) { return t.range.min > 0 && t.sampleQuantity !== t.range.min; });
        for (var k = 0; k < moved.length; k++) {
            await probeQty(moved[k].range.min);
        }

        // 4) DTF rounds each piece up after spreading the small-batch fee, so its fee-free price
        //    drifts inside that tier. Keep the highest, so "per pc × qty + fee" never under-quotes.
        if (id === 'dtf') {
            probeMode = 'highest';
            var small = Object.keys(byTier).map(function (k2) { return byTier[k2]; })
                .filter(function (t) { return t.ltmFee > 0 && isFinite(t.range.max) && t.range.max - t.range.min <= 60; });
            for (var s = 0; s < small.length; s++) {
                for (var q = small[s].range.min + 1; q <= small[s].range.max; q++) await probeQty(q);
            }
        }

        if (failure) throw new Error('Some quantity prices could not be checked. Try again.');
        // Where the fee is added on paper, round the per-piece price up to the cent so
        // "per pc × qty + fee" is never below the engine total.
        return Object.keys(byTier).map(function (k3) {
            var t = byTier[k3];
            if (t.ltmFee > 0) t.base = Math.max(t.base, Math.ceil(t.exactBase * 100 - 1e-6) / 100);
            return t;
        }).sort(function (a, b) { return a.range.min - b.range.min; });
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
        box.innerHTML = '<p class="qq-matrix-title">Price breaks — ' + esc(def.label) + '</p><div class="qq-skeleton"></div>';
        var tiers = [];
        try { tiers = await probeLadder(id, state.product, state.color); }
        catch (err) { console.error('[quick-quote] price-breaks build failed:', err); }
        finally { delete _ladderFetching[key]; }
        if (tiers.length && ladderKey(id) === key) _ladderCache[key] = tiers;   // failures and mixed-setting tables are never cached
        // only paint if this is still the current selection/config
        if (state.selectedMethod !== id || ladderKey(id) !== key) return;
        if (tiers.length) paintMatrix(id, tiers);
        else box.innerHTML = '<p class="qq-matrix-title">Price breaks — ' + esc(def.label) + '</p><p class="qq-matrix-msg">Price breaks could not be loaded. <button type="button" class="qq-link-btn qq-matrix-retry">Retry</button></p>';
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
        notifyWorkspace();
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
        // decoration-methods.js contract: an unknown category must say that only embroidery is shown.
        var elig = state.product.eligibility;
        var eligNote = elig && elig.source === 'fallback'
            ? '<p class="qq-elig-note" role="status">' + (elig.rulesDown
                ? 'Decoration rules didn’t load, so only embroidery is shown. Refresh to see the other methods.'
                : 'This product’s category isn’t in our decoration rules, so only embroidery is shown. Other methods may work — confirm before quoting, or price one on the Line Sheet.') + '</p>'
            : elig && elig.source === 'flat-headwear'
            ? '<p class="qq-elig-note" role="status">Beanies and knit caps are priced as flat embroidery, the same as the Embroidery builder.</p>'
            : '';
        box.innerHTML = eligNote + state.methods.map(function (m) {
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
                    var target = addLineStyle(false);   // null when the sheet is full
                    if (target) {
                        var inp = document.querySelector('.qq-line-row[data-uid="' + target.uid + '"] .qq-line-style');
                        if (inp) inp.value = style;
                        onLineStyleInput(target.uid, style);
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
        return builderHrefFor(id, state.product, state.color, currentSizes());
    }
    function builderHrefFor(id, product, color, sizes) {
        if (!product || !BUILDER_PATHS[id]) return '';
        var p = new URLSearchParams();
        p.set('from', 'quickquote');
        p.set('style', product.style);
        if (color) {
            if (color.catalog) p.set('color', color.catalog);
            if (color.name) p.set('colorName', color.name);
        }
        var qty = Object.values(sizes).reduce(function (a, b) { return a + b; }, 0);
        if (qty > 0) p.set('qty', String(qty));
        var csv = Object.keys(sizes).map(function (sz) { return sz + ':' + sizes[sz]; }).join(',');
        if (csv) p.set('sizes', csv);
        if (id === 'dtg') { var loc = dtgCode(); if (loc) p.set('location', loc); }
        p.set('decoration', JSON.stringify(decorationPayload(id)));
        return BUILDER_PATHS[id] + '?' + p.toString();
    }
    function decorationPayload(id) {
        var d = { version: 1, method: id };
        if (id === 'emb' || id === 'capemb') {
            d.primary = { stitchCount: state.adv.embStitch, needsDigitizing: !!state.adv.digitizing, embellishmentType: id === 'capemb' ? state.capEmb : 'embroidery' };
            d.additional = state.embAddl.map(function (a) { return { stitchCount: a.stitch }; });
        } else if (id === 'dtg') d.location = dtgCode();
        else if (id === 'dtf') d.locations = dtfLocations();
        else Object.assign(d, { front: state.front, back: state.back, frontInk: state.frontInk, backInk: state.backInk, sleeveInkL: state.sleeveInkL, sleeveInkR: state.sleeveInkR, left: state.sleeves.left, right: state.sleeves.right, dark: !!state.adv.scpDark, stripes: !!state.adv.scpStripes });
        return d;
    }
    function openBuilderHtml(id) {
        var href = builderHref(id);
        if (!href) return '';
        // Promoted from a dotted text link to the card's primary next step
        // (guided-quote Phase A, 2026-07-07): the builder is the FRONT DOOR the
        // AEs reach through Quick Quote — style/color/sizes carry over, so they
        // never face a blank builder. Styling: .qq-open-builder in quick-quote.css.
        return '<a class="qq-open-builder" href="' + esc(href) + '" target="_blank" rel="noopener"'
            + ' title="Opens the full quote builder with this style, color and sizes already filled in — add the customer and push it to ShopWorks">'
            + 'Turn this into a full quote &rarr;</a>';
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
                + (n.ltmDisappears ? ' · small-batch fee gone' : '') + save
                + (n.nextTotal != null ? ' · order total ' + fmt(n.nextTotal) + ' (now ' + fmt(n.currentTotal) + ')' : '') + '</button>';
        }

        // Per-piece breakdown (rate-card style): blank garment + each print/logo location
        // + a per-shirt small-batch line, all summing to the engine per-piece. See buildBreakdown.
        var breakdownHtml = buildBreakdown(id, s, r, unitWord);
        var oneTimeHtml = buildOneTime(s);

        return '<div class="qq-card is-clickable' + (isBest ? ' is-best' : '') + (sel ? ' is-selected' : '') + '"' + (changed ? ' data-flash="1"' : '') + dm + '>'
            + '<div class="qq-card-top">' + head
            + '<div class="qq-card-price"><div class="qq-card-pp">' + fmt(s.perPiece) + '<span class="per">/' + unitWord + '</span></div>'
            + '<div class="qq-card-total">' + fmt(s.total) + ' total' + (isBest ? ' <span class="qq-best-tag"><svg class="qq-star" viewBox="0 0 24 24" width="11" height="11" fill="currentColor" aria-hidden="true"><path d="M12 2l2.9 6.3 6.9.7-5.1 4.7 1.4 6.8L12 17.8 6 21.2l1.4-6.8L2.3 9.7l6.9-.7z"/></svg>lowest price</span>' : '') + '</div></div></div>'
            + configChips(id)
            + breakdownHtml
            + oneTimeHtml
            + (meta.length ? '<div class="qq-card-meta">' + meta.join('') + '</div>' : '')
            + nudgeHtml
            + (state.handback ? '<button type="button" class="qq-use-price" data-id="' + esc(id)
                + '" title="Send this price back to the AE Order Intake form">'
                + '<i class="fas fa-reply" aria-hidden="true"></i> Use on order form — ' + fmt(s.perPiece) + '/' + unitWord + '</button>' : '')
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
        else pf.hidden = oneSize(state.product);
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
    var configVersion = 0;   // bumps on every decoration/quantity change
    function repriceActive() { ++configVersion; if (state.mode === 'linesheet') repriceLineAll(); else repriceAll(); }
    var scheduleActivePrice = debounce(function () {
        if (state.mode !== 'linesheet') { repriceAll(); return; }
        // A row looked up while the typing pause ran was already priced with these settings.
        state.lineStyles.forEach(function (row) { if (row.product && row.pricedVersion !== configVersion) priceLineRow(row); });
        renderLinePreview();
    }, 350);
    function repriceActiveDebounced() {
        ++configVersion;
        if (state.mode === 'linesheet') state.lineStyles.forEach(invalidateLine);
        else invalidateQuick();
        notifyWorkspace(); scheduleActivePrice();
    }
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
        // A cap style chosen in Quick Price must not ride along on an Embroidery sheet's caps.
        if (mode === 'linesheet' && state.lineMethod !== 'capemb' && state.capEmb !== 'embroidery') { state.capEmb = 'embroidery'; ++configVersion; }
        renderMode();
        renderConfigControls();
        // Both modes share decoration settings: re-price anything priced with older ones.
        if (mode === 'linesheet') state.lineStyles.forEach(function (row) { if (row.product && row.pricedVersion !== configVersion) priceLineRow(row); });
        else if (state.product && state.quickVersion !== configVersion) repriceAll();
        renderAll();
    }
    function renderMode() {
        notifyWorkspace();
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
        document.querySelector('.qq-line-quantity').hidden = !line;
    }

    // Chip groups are rebuilt on every choice; keep keyboard focus on the same chip.
    function keepFocus(host, render) {
        var active = document.activeElement, selector = null;
        if (host && active && host.contains(active)) {
            selector = ['data-line-method', 'data-cap-emb'].filter(function (a) { return active.hasAttribute(a); })
                .map(function (a) { return '[' + a + '="' + active.getAttribute(a) + '"]'; })[0]
                || (active.hasAttribute('data-kind') ? '[data-kind="' + active.getAttribute('data-kind') + '"][data-code="' + active.getAttribute('data-code') + '"]' : null);
        }
        render();
        var next = selector && host.querySelector(selector);
        if (next) next.focus({ preventScroll: true });
    }

    // ---- method selector (one tap) ----
    function renderLineMethods() {
        var box = $('qqLineMethodChips'); if (!box) return;
        keepFocus(box, function () {
            box.innerHTML = LINE_METHODS.map(function (m) {
                return '<button type="button" class="qq-place-chip' + (m.id === state.lineMethod ? ' is-active' : '')
                    + '" data-line-method="' + m.id + '">' + esc(m.label) + '</button>';
            }).join('');
        });
    }
    function setLineMethod(id) {
        if (!METHODS[id] || id === state.lineMethod) return;
        state.lineMethod = id;
        if (id === 'scp' || id === 'dtg' || id === 'dtf') {
            state.front = 'LC'; state.back = ''; state.sleeves = { left: false, right: false };
            if (id === 'scp') { state.frontInk = 1; state.backInk = 1; }
        }
        if (id === 'emb' || id === 'capemb') { state.adv.embStitch = 8000; state.embAddl = []; state.capEmb = 'embroidery'; }
        ++configVersion;
        renderLineMethods();
        renderConfigControls();
        repriceLineAll();
        renderSafetyRecs();  // re-eval safety-apparel recs when the line method changes
    }

    // ---- style list (input panel) ----
    function lineRow(uid) { return state.lineStyles.filter(function (r) { return r.uid === uid; })[0]; }
    // Returns the row to type into: an existing blank row, else a new one (null when full).
    function addLineStyle(focus) {
        var row = state.lineStyles.filter(function (r) { return !r.raw.trim(); })[0];
        if (!row) {
            if (state.lineStyles.length >= LINE_MAX) return null;
            row = { uid: ++_lineUid, raw: '', product: null, color: null, status: 'empty', tiers: null, pricing: false, error: '', notice: '', _tok: 0, _ptok: 0 };
            state.lineStyles.push(row);
            renderLineList();
        }
        if (focus !== false) { var inp = document.querySelector('.qq-line-style[data-uid="' + row.uid + '"]'); if (inp) inp.focus(); }
        return row;
    }
    function removeLineStyle(uid) {
        var row = lineRow(uid); if (row) { clearTimeout(row._lookup); invalidateLine(row); ++row._tok; }
        var index = state.lineStyles.indexOf(row);
        state.lineStyles = state.lineStyles.filter(function (r) { return r.uid !== uid; });
        if (state.lineStyles.length) renderLineList(); else addLineStyle(false); // always one row ready to type into
        var next = state.lineStyles[Math.min(Math.max(index, 0), state.lineStyles.length - 1)];
        var input = next && document.querySelector('.qq-line-style[data-uid="' + next.uid + '"]');
        if (input) input.focus({ preventScroll: true });
        renderLinePreview();
    }
    function moveLineStyle(uid, dir) {
        var i = state.lineStyles.findIndex(function (r) { return r.uid === uid; });
        var j = i + dir;
        if (i < 0 || j < 0 || j >= state.lineStyles.length) return;
        var a = state.lineStyles[i]; state.lineStyles[i] = state.lineStyles[j]; state.lineStyles[j] = a;
        renderLineList(); renderLinePreview();
        var moved = document.querySelector('.qq-line-mv[data-uid="' + uid + '"][data-dir="' + dir + '"]');
        if (moved && moved.disabled) moved = document.querySelector('.qq-line-mv[data-uid="' + uid + '"][data-dir="' + (-dir) + '"]');
        if (moved) moved.focus({ preventScroll: true });
    }

    // renderLineList renders the row SHELLS (style input + controls) — called only on add/remove/move
    // so the style input is never replaced mid-type. updateLineRow fills the dynamic content.
    function renderLineList() {
        var box = $('qqLineList'); if (!box) return;
        var searchPanel = $('qqSearchPanel');
        if (searchPanel && box.contains(searchPanel)) { box.after(searchPanel); searchPanel.hidden = true; }
        box.innerHTML = state.lineStyles.map(function (r, idx) {
            return '<div class="qq-line-row" data-uid="' + r.uid + '">'
                + '<div class="qq-line-head">'
                + '<input class="qq-line-style input" type="text" inputmode="text" autocomplete="off" spellcheck="false" placeholder="Style #, e.g. PC55" value="' + esc(r.raw) + '" data-uid="' + r.uid + '">'
                + '<div class="qq-line-ctrls">'
                + '<button type="button" class="qq-line-mv" data-uid="' + r.uid + '" data-dir="-1" aria-label="Move up"' + (idx === 0 ? ' disabled' : '') + '>&uarr;</button>'
                + '<button type="button" class="qq-line-mv" data-uid="' + r.uid + '" data-dir="1" aria-label="Move down"' + (idx === state.lineStyles.length - 1 ? ' disabled' : '') + '>&darr;</button>'
                + '<button type="button" class="qq-line-rm" data-uid="' + r.uid + '" aria-label="Remove style">&times;</button>'
                + '</div></div>'
                + '<div class="qq-line-content" id="qqlc-' + r.uid + '"></div>'
                + '</div>';
        }).join('');
        state.lineStyles.forEach(updateLineRow);
        var searching = state.lineStyles.filter(function (r) { return r.status === 'search'; })[0];
        if (searching && window.QuickQuoteWorkspace) window.QuickQuoteWorkspace.reattach(document.querySelector('.qq-line-style[data-uid="' + searching.uid + '"]'));
        updateLineActions();
    }
    function updateLineRow(row) {
        var el = document.getElementById('qqlc-' + row.uid); if (!el) return;
        if (row.status === 'empty') { el.innerHTML = ''; return; }
        if (row.status === 'loading') { el.innerHTML = '<span class="qq-line-stat loading">Looking up&hellip;</span>'; return; }
        if (row.status === 'search') { el.innerHTML = '<span class="qq-line-stat">Choose a product below, or type a style number.</span>'; return; }
        if (row.status === 'error') {
            el.innerHTML = '<span class="qq-line-stat err">' + esc(row.error || 'No product found.') + '</span>'
                + (row.retry ? '<button type="button" class="qq-link-btn qq-line-retry" data-uid="' + row.uid + '">Retry</button>' : '');
            return;
        }
        var img = row.color && row.color.image;
        var thumb = img
            ? '<img class="qq-line-thumb" src="' + esc(img) + '" alt="" referrerpolicy="no-referrer">'
            : '<span class="qq-line-thumb is-empty"></span>';
        var colorSel = '';
        if (row.product && row.product.colors.length) {
            colorSel = '<select class="qq-line-color" data-uid="' + row.uid + '" aria-label="Color for ' + esc(row.product.style) + '">'
                + row.product.colors.map(function (c) {
                    return '<option value="' + esc(c.catalog) + '"' + (row.color && c.catalog === row.color.catalog ? ' selected' : '') + '>' + esc(c.name) + '</option>';
                }).join('') + '</select>';
        }
        var status = row.error ? '<span class="qq-line-stat err">' + esc(row.error) + '</span>'
            : row.pricing ? '<span class="qq-line-stat loading">Pricing&hellip;</span>'
            : row.notice ? '<span class="qq-line-stat">' + esc(row.notice) + '</span>' : '';
        // Re-rendering replaces the color menu; keep keyboard focus on it.
        var hadFocus = document.activeElement && document.activeElement.matches('.qq-line-color[data-uid="' + row.uid + '"]');
        el.innerHTML = thumb + '<div class="qq-line-meta"><span class="qq-line-name">' + esc(row.product.name) + '</span>' + colorSel + status + '</div>';
        if (hadFocus) { var sel = el.querySelector('.qq-line-color'); if (sel) sel.focus({ preventScroll: true }); }
    }
    function updateLineActions() {
        var full = state.lineStyles.length >= LINE_MAX && state.lineStyles.every(function (r) { return r.raw.trim(); });
        $('qqLineAdd').disabled = full;
        $('qqLineAdd').textContent = full ? 'Max ' + LINE_MAX + ' styles' : '+ Add style';
        notifyWorkspace();
    }

    function onLineStyleInput(uid, raw) {
        var row = lineRow(uid); if (!row) return;
        clearTimeout(row._lookup);
        invalidateLine(row); row.pricing = false;
        row.raw = raw;
        var style = String(raw || '').trim().toUpperCase();
        row.product = null; row.color = null; row.tiers = null; row.error = ''; row.notice = ''; row.retry = false;
        if (!style) { row.status = 'empty'; ++row._tok; updateLineRow(row); updateLineActions(); renderLinePreview(); return; }
        row.status = 'loading'; updateLineRow(row); notifyWorkspace();
        var token = ++state.lineSeq; row._tok = token;
        fetchProduct(style).then(function (product) {
            if (row._tok !== token) return;
            return loadProductSizes(product).then(function () {
                if (row._tok !== token) return;
                row.product = product;
                row.color = product.colors.length ? product.colors[0] : null;
                row.status = 'ok';
                updateLineRow(row);
                priceLineRow(row);
            });
        }).catch(function (err) {
            if (row._tok !== token) return;
            row.status = 'error'; row.error = lookupMessage(err, style); row.retry = !(err && err.notFound);
            updateLineRow(row); updateLineActions(); renderLinePreview();
            if (err && err.notFound && window.QuickQuoteWorkspace) window.QuickQuoteWorkspace.suggest(document.querySelector('.qq-line-style[data-uid="' + uid + '"]'));
        });
    }
    function onLineColorChange(uid, catalog) {
        var row = lineRow(uid); if (!row || !row.product) return;
        row.color = (row.product.colors || []).filter(function (c) { return c.catalog === catalog; })[0] || row.color;
        row.tiers = null; row.colorChanged = false;
        priceLineRow(row);
    }

    // Per-row size run (so stdSizeFor finds a real size). The bundle is the same one the engine
    // fetches for pricing, so it's warm in cache; falls back to a default run on failure.
    function loadProductSizes(product) {
        if (!product || product.sizes) return Promise.resolve();
        var fallback = oneSize(product) ? ['OSFA'] : ['S', 'M', 'L', 'XL', '2XL', '3XL', '4XL'];
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
    function invalidateLine(row) {
        if (!row) return;
        row._ptok = ++state.lineSeq; row.preview = null; row.tiers = null; row.pricing = true;
    }
    // Embroidery follows a confirmed product (cap → cap embroidery; garment or flat headwear →
    // embroidery), as the EMB builder does per row. The builder's own cap check still differs on
    // some styles (New Era and Richardson apparel, visors). Unconfirmed products keep the rep's choice.
    function lineMethodFor(row) {
        var m = state.lineMethod, h = row.product && row.product.headwear;
        if ((m !== 'emb' && m !== 'capemb') || !h || !h.confident) return m;
        return h.isCap ? 'capemb' : 'emb';
    }
    async function priceLineRow(row) {
        invalidateLine(row);
        if (!state.lineMethod || !row.product) { row.pricing = false; updateLineRow(row); renderLinePreview(); return; }
        var token = row._ptok, method = lineMethodFor(row), def = METHODS[method];
        var product = row.product, color = row.color, qty = state.lineQty, headwear = product.headwear || {}, flat = isFlatHeadwear(product);
        row.pricedVersion = configVersion;
        var embroidery = method === 'emb' || method === 'capemb', notices = [];
        row.method = method; row.error = ''; row.notice = '';
        updateLineRow(row); notifyWorkspace();
        try {
            if (qty !== null && (!Number.isInteger(qty) || qty < 1 || qty > 100000)) throw new Error('Enter a whole quantity between 1 and 100,000, or leave it blank for price breaks.');
            if ((product.isCap || flat) && headwear.confident && !embroidery) throw new Error(product.style + (flat ? ' is headwear' : ' is a cap') + ' — choose Embroidery or Cap embroidery.');
            if (method === 'capemb' && state.embAddl.length > 1) throw new Error('Caps take one extra logo (cap back). Remove the other logos to price ' + product.style + '.');
            var methodWords = def.label.replace(/^[A-Z](?=[a-z])/, function (c) { return c.toLowerCase(); }); // "DTG print" keeps its capitals
            if (method !== state.lineMethod) notices.push('Priced as ' + methodWords + (flat ? ' — beanies are flat embroidery, as in the Embroidery builder.' : '.'));
            else if (method === 'capemb' && !headwear.confident) notices.push('Not confirmed as a cap — priced as cap embroidery, as chosen.');
            if (row.colorChanged) notices.push('The saved color is no longer offered — check the color.');
            // Cap pricing and flat headwear skip the category rules (the "Caps" rule lists no garment methods).
            if (method !== 'capemb' && !(embroidery && (product.isCap || flat))) {
                var eligibility = await categoryEligibility(product);
                if (row._ptok !== token) return;
                // decoration-methods.js contract: an unknown category is a visible warning, never a block.
                if (eligibility.source === 'fallback') {
                    if (eligibility.rulesDown) notices.push('Decoration rules didn’t load — confirm ' + methodWords + ' works for this product, or refresh.');
                    else if (!methodAllowed(eligibility, def.engineMethod)) notices.push('This category isn’t in our decoration rules — confirm ' + methodWords + ' works for it.');
                }
                else if (!methodAllowed(eligibility, def.engineMethod)) throw new Error(def.label + ' isn’t offered for ' + (product.category || 'this product') + '.');
                else if (eligibility[def.engineMethod] === 'warn') notices.push('Check the fabric — DTG prints best on cotton.');
            }
            if (def.available && !def.available()) throw new Error('Choose a supported decoration placement.');
            var sizes = {}; sizes[stdSizeFor(product)] = qty;
            var values = await Promise.all([
                probeLadder(method, product, color),
                qty === null ? Promise.resolve(null) : window.QuoteCartEngine.singleItemPreview(buildItemFor(def, product, color, sizes), { groups: def.groups(), deps: engineDeps(), nudge: false })
            ]);
            if (row._ptok !== token) return;
            if (values[1] && !values[1].ok) throw new Error(values[1].error?.message || 'Pricing unavailable. Try again.');
            if (!values[0].length) throw new Error('Quantity prices are unavailable. Try again.');
            row.tiers = values[0]; row.preview = values[1] || values[0][0].preview; row.pricing = false; row.notice = notices.join(' ');
        } catch (error) {
            if (row._ptok !== token) return;
            row.tiers = []; row.preview = null; row.pricing = false; row.error = (error && error.message) || 'Pricing unavailable. Try again.';
        }
        updateLineRow(row); updateLineActions(); renderLinePreview();
    }

    function renderLinePreview() { notifyWorkspace(); }
    function notifyWorkspace() { if (window.QuickQuoteWorkspace) window.QuickQuoteWorkspace.refresh(); }
    function stitchText(n) { return (num(n) || 8000).toLocaleString('en-US') + ' stitches'; }
    function decorationDescription(id, product) {
        if (id === 'emb' || id === 'capemb') {
            var cap = id === 'capemb';
            var parts = [frontLogoLabel(cap, product) + ' ' + stitchText(state.adv.embStitch)];
            state.embAddl.forEach(function (a) { parts.push((cap ? 'cap back ' : 'additional logo ') + stitchText(a.stitch)); });
            if (cap && state.capEmb !== 'embroidery') parts.push(state.capEmb === '3d-puff' ? '3D puff' : 'laser patch');
            if (state.adv.digitizing) parts.push('new-logo digitizing');
            return parts.join(', ');
        }
        return configText(id);
    }
    function workspaceBridge() {
        return {
            state: state,
            options: function () {
                if (state.mode === 'linesheet') return state.lineStyles.filter(function (r) { return r.status === 'ok' && r.product && r.preview && !r.pricing && !r.error; }).map(function (r) {
                    var m = r.method || state.lineMethod, sizes = {};
                    sizes[stdSizeFor(r.product)] = state.lineQty;
                    return { key: String(r.uid), product: r.product, color: r.color, method: m, preview: r.preview, tiers: r.tiers, quantityRequested: state.lineQty !== null,
                        unitWord: m === 'capemb' ? 'cap' : 'pc', description: decorationDescription(m, r.product),
                        builderHref: state.lineQty === null ? '' : builderHrefFor(m, r.product, r.color, sizes) };
                });
                var sizeMix = state.useSizes ? 'Sizes: ' + Object.entries(currentSizes()).map(function (p) { return p[0] + ' ' + p[1]; }).join(', ') : '';
                return state.methods.filter(function (m) { return state.results[m.id]?.status === 'ok'; }).map(function (m) {
                    return { key: m.id, product: state.product, color: state.color, method: m.id, preview: state.results[m.id].preview, sizes: sizeMix,
                        unitWord: state.product.isCap ? 'cap' : 'pc', description: decorationDescription(m.id, state.product), builderHref: builderHref(m.id) };
                });
            },
            // The sheet header names the method and its decoration once for the whole sheet.
            subtitle: function () { return state.mode === 'linesheet' && state.lineMethod ? METHODS[state.lineMethod].label + ' · ' + decorationDescription(state.lineMethod) : ''; },
            method: function () { return state.mode === 'linesheet' ? state.lineMethod : ''; },
            pending: function () {
                if (state.mode !== 'linesheet') {
                    if (!state.product) return false;
                    return state.quickVersion !== configVersion || state.methods.some(function (m) { return !state.results[m.id] || state.results[m.id].status === 'loading'; });
                }
                return state.lineStyles.some(function (r) { return r.status === 'loading' || (r.status === 'ok' && !r.error && (r.pricing || !r.preview || r.pricedVersion !== configVersion)); });
            },
            errors: function () {
                if (state.mode !== 'linesheet') return [];
                return state.lineStyles.filter(function (r) { return r.error || r.status === 'search'; }).map(function (r) {
                    var name = r.product ? r.product.style : r.raw.trim().toUpperCase();
                    if (r.status === 'search') return '“' + r.raw.trim() + '”: choose a product from the list or type a style number.';
                    return r.error.indexOf(name) >= 0 ? r.error : name + ': ' + r.error;
                });
            },
            choose: function (style, uid) {
                if (state.mode === 'linesheet') {
                    var row = uid ? lineRow(uid) : null;
                    if (!row) row = state.lineStyles.filter(function (r) { return r.status === 'search'; })[0] || addLineStyle(false);
                    if (!row) throw new Error('A sheet holds ' + LINE_MAX + ' styles. Remove one to add another.');
                    document.querySelector('.qq-line-style[data-uid="' + row.uid + '"]').value = style;
                    onLineStyleInput(row.uid, style);
                } else { $('qqStyle').value = style; lookupStyle(style); }
            },
            // Enter in a style box: look it up now instead of waiting for the typing pause.
            commit: function (input) {
                var style = input.value.trim().toUpperCase();
                if (input.id === 'qqStyle') {
                    clearTimeout(quickStyleTimer);
                    if (!(state.product && state.product.style === style)) lookupStyle(input.value);
                    return;
                }
                var row = lineRow(Number(input.dataset.uid)); if (!row) return;
                clearTimeout(row._lookup);
                if (!(row.product && row.product.style === style && row.status === 'ok')) onLineStyleInput(row.uid, input.value);
            },
            setQuantity: function (qty) { state.lineQty = qty; $('qqLineQty').value = qty === null ? '' : qty; repriceActiveDebounced(); },
            reprice: repriceActive,
            restore: restoreWorkspaceInputs
        };
    }
    async function restoreWorkspaceInputs(draft) {
        setMode(draft.mode === 'quick' ? 'quick' : 'linesheet');
        var fields = ['front', 'back', 'sleeves', 'frontInk', 'backInk', 'sleeveInkL', 'sleeveInkR', 'adv', 'embAddl', 'capEmb', 'qty', 'sizes', 'useSizes', 'lineQty', 'scpDarkUserSet'];
        function config() {
            fields.forEach(function (key) { if (Object.prototype.hasOwnProperty.call(draft, key)) state[key] = draft[key]; });
            if (state.mode === 'linesheet' && state.lineMethod !== 'capemb') state.capEmb = 'embroidery';
            ++configVersion;
            $('qqQty').value = state.qty; $('qqLineQty').value = state.lineQty; renderConfigControls();
        }
        if (state.mode === 'linesheet') {
            state.lineStyles = []; state.lineMethod = draft.lineMethod || 'emb'; config(); renderLineMethods();
            // Each saved style restores on its own; one discontinued style never blocks the rest.
            for (var saved of (draft.products || []).slice(0, LINE_MAX)) {
                var row = addLineStyle(false); row.raw = saved.style;
                try {
                    var product = await fetchProduct(saved.style); await loadProductSizes(product);
                    row.product = product; row.status = 'ok';
                    row.color = product.colors.find(function (c) { return c.catalog === saved.color; }) || product.colors[0] || null;
                    row.colorChanged = !!row.color && row.color.catalog !== saved.color;
                } catch (err) {
                    row.status = 'error'; row.error = lookupMessage(err, saved.style); row.retry = !(err && err.notFound);
                }
            }
            if (!state.lineStyles.length) addLineStyle(false);
            renderLineList(); repriceLineAll();
        } else if (draft.products?.length) {
            var savedProduct = draft.products[0]; state.product = await fetchProduct(savedProduct.style); await loadProductSizes(state.product);
            var elig = await resolveEligibility(state.product);
            state.product.eligibility = elig; applyProduct(elig); config();
            state.color = state.product.colors.find(function (c) { return c.catalog === savedProduct.color; }) || state.product.colors[0] || null;
            if (state.color && state.color.catalog !== savedProduct.color) $('qqStyleStatus').innerHTML = '<span class="err">The saved color is no longer offered — check the color.</span>';
            $('qqStyle').value = savedProduct.style; $('qqSizes').hidden = !state.useSizes; $('qqQty').disabled = state.useSizes;
            if (state.useSizes) buildSizeGrid(); renderColorSwatches(); renderThumb(); loadInventory(); repriceAll();
        }
        renderMode(); notifyWorkspace();
    }

    // ============================================================
    // ORDER-FORM HANDBACK (?from=aeo) — send a priced method back to the
    // AE Order Intake tab. localStorage 'storage' events fire in OTHER
    // same-origin tabs, so this works regardless of how the tab was opened
    // (the 💰 link is rel=noopener — window.opener is unavailable by design).
    // ============================================================
    function sendHandback(id, btn) {
        var r = state.results[id];
        if (!state.handback || !state.product || !r || r.status !== 'ok') return;
        var def = METHODS[id];
        var s = r.summary;
        var unitWord = state.product.isCap ? 'cap' : 'pc';
        var cfg = configText(id);
        var provenance = 'Quick Quote: ' + def.label + (cfg ? ' — ' + cfg : '')
            + ' · ' + totalQty() + ' ' + (state.product.isCap ? 'caps' : 'pcs')
            + (s.tierLabel ? ' (' + s.tierLabel + ' tier)' : '')
            + ' → ' + fmt(s.perPiece) + '/' + unitWord
            + (s.ltm && s.ltm.fee > 0 ? ' incl. small-batch fee' : '');
        var msg = {
            token: state.handback.token || '',
            style: state.product.style,
            color: state.color ? state.color.name : '',
            method: id,
            methodLabel: def.label,
            config: cfg,
            qty: totalQty(),
            perPiece: s.perPiece,
            total: s.total,
            tierLabel: s.tierLabel || '',
            provenance: provenance,
            ts: Date.now()
        };
        try {
            localStorage.setItem('nwca-qq-handback', JSON.stringify(msg));
        } catch (err) {
            console.error('[quick-quote] handback failed:', err);
            btn.textContent = '✗ Could not send — copy the price by hand';
            return;
        }
        btn.classList.add('is-sent');
        btn.innerHTML = '<i class="fas fa-check" aria-hidden="true"></i> Sent to the order form — switch back to that tab';
    }

    // ============================================================
    // WIRING
    // ============================================================
    function wire() {
        if (!window.QuoteCartEngine) { $('qqEngineError').hidden = false; }

        $('qqStyle').addEventListener('input', function (e) {
            ++lookupSeq; ++sizeSeq; state.product = null; invalidateQuick();
            clearTimeout(quickStyleTimer);
            var value = e.target.value.trim();
            // Product names are searched by the workspace; style numbers price after a short pause.
            if (value && !looksLikeStyle(value)) {
                $('qqStyleStatus').innerHTML = '<span class="loading">Choose a product below, or type a style number.</span>';
                renderAll();
                return;
            }
            quickStyleTimer = setTimeout(function () { lookupStyle(e.target.value); }, LOOKUP_PAUSE);
        });

        // Click a priced method card to show its price-breaks matrix below.
        $('qqResults').addEventListener('click', function (e) {
            if (e.target.closest('.qq-open-builder')) return; // builder handoff link — let the browser navigate
            if (e.target.closest('.qq-retry')) return; // retry has its own handler
            var use = e.target.closest('.qq-use-price');
            if (use) { sendHandback(use.getAttribute('data-id'), use); return; }
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
        $('qqLineAdd').addEventListener('click', function () { addLineStyle(); });
        // Typing a style number looks it up after a pause (each row keeps its own timer);
        // a product name is searched by the workspace instead.
        $('qqLineList').addEventListener('input', function (e) {
            var si = e.target.closest('.qq-line-style'); if (!si) return;
            var row = lineRow(Number(si.getAttribute('data-uid'))); if (!row) return;
            var value = si.value.trim();
            clearTimeout(row._lookup);
            invalidateLine(row); row.pricing = false; ++row._tok;
            row.raw = si.value; row.product = null; row.color = null; row.tiers = null; row.error = ''; row.notice = ''; row.retry = false;
            row.status = !value ? 'empty' : looksLikeStyle(value) ? 'loading' : 'search';
            updateLineRow(row); updateLineActions();
            if (row.status === 'loading') row._lookup = setTimeout(function () { onLineStyleInput(row.uid, si.value); }, LOOKUP_PAUSE);
        });
        $('qqLineList').addEventListener('change', function (e) {
            var cs = e.target.closest('.qq-line-color'); if (cs) onLineColorChange(Number(cs.getAttribute('data-uid')), cs.value);
        });
        $('qqLineList').addEventListener('click', function (e) {
            var mv = e.target.closest('.qq-line-mv'); if (mv && !mv.disabled) { moveLineStyle(Number(mv.getAttribute('data-uid')), Number(mv.getAttribute('data-dir'))); return; }
            var rm = e.target.closest('.qq-line-rm'); if (rm) { removeLineStyle(Number(rm.getAttribute('data-uid'))); return; }
            var retry = e.target.closest('.qq-line-retry'); if (retry) { var row = lineRow(Number(retry.getAttribute('data-uid'))); if (row) onLineStyleInput(row.uid, row.raw); }
        });
        // A product photo that fails to load is hidden rather than shown broken.
        $('qqLineList').addEventListener('error', function (e) {
            if (e.target.matches && e.target.matches('img.qq-line-thumb')) { e.target.removeAttribute('src'); e.target.classList.add('is-empty'); }
        }, true);
        $('qqMatrix').addEventListener('click', function (e) { if (e.target.closest('.qq-matrix-retry')) renderMatrix(); });
        $('qqLineQty').addEventListener('input', function (e) { state.lineQty = e.target.validity.badInput ? NaN : e.target.value === '' ? null : Number(e.target.value); repriceActiveDebounced(); });
        window.QuickQuoteWorkspace.mount(workspaceBridge());

        // init: render both modes' scaffolding (Quick Price is the default view)
        // ?mode=quick — the dashboard's New Quote launcher deep-links straight to
        // Quick Price ("not sure which method — compare them") (2026-07-07).
        try {
            var qParams = new URLSearchParams(window.location.search);
            if (qParams.get('mode') === 'quick') setMode('quick');
            // ?style=PC61&qty=24 — deep-link prefill (AE Order Intake's 💰 button,
            // 2026-07-11). Prefills INPUTS only; pricing runs the normal engine path.
            var qStyle = (qParams.get('style') || '').trim();
            var qQty = parseInt(qParams.get('qty'), 10);
            if (qQty > 0) { $('qqQty').value = qQty; state.qty = qQty; }
            // ?from=aeo&hb=<token>&method=<emb|dtg|scp|dtf> — round-trip mode for the
            // AE Order Intake (2026-07-11): every priced card gets a "Use on order
            // form" button that hands {price, config} back to the intake tab via
            // localStorage; hb echoes back so the form knows which row asked.
            if (qParams.get('from') === 'aeo') {
                state.handback = { token: qParams.get('hb') || '' };
                var qMethod = qParams.get('method');
                if (qMethod && METHODS[qMethod]) state.pinOnce = qMethod; // consumed by applyProduct
                $('qqHandbackBar').hidden = false;
            }
            if (qStyle) {
                setMode('quick'); // a style deep-link means "price THIS style" — Quick Price panel
                $('qqStyle').value = qStyle.toUpperCase();
                lookupStyle(qStyle.toUpperCase());
            }
        } catch (err) { console.error('[quick-quote] could not read the page link settings:', err); }
        renderMode();
        renderLineMethods();
        if (!state.lineStyles.length) addLineStyle(false);   // one row ready to type into
        renderLineList();
        renderConfigControls();
        renderLinePreview();
        renderResults();
        // Line Sheet opens ready for a style number.
        var first = document.querySelector('.qq-line-style');
        if (state.mode === 'linesheet' && first && document.activeElement === document.body) first.focus({ preventScroll: true });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', wire);
    } else {
        wire();
    }
})();
