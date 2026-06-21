/*
 * Prints prototype — the "logo = size + position" model (DTF + DTG)
 * ------------------------------------------------------------------
 * Self-contained experiment. Prices a LIST of prints, each one a (size,
 * position), by SIZE — the price driver — for both DTF and DTG.
 *
 *   DTF  → DTFPricingService.calculatePriceForQuantity (the live engine code).
 *   DTG  → a replica of the server canonical pricer, VERIFIED to match it to
 *          the cent (probed 2026-06-21): baseUnit = ceil((garment/denom + ΣprintCost)*2)/2,
 *          finalUnit = round(baseUnit + floor(LTM/qty), cents). DTG size→rate:
 *          Small=LC, Large=FF(=FB), Jumbo=JF(=JB). qty<24 uses 24-47 print costs.
 *
 * Touches no live tool. Not linked from anywhere. Safe to iterate on.
 */
(function () {
    'use strict';

    var dtfSvc = new window.DTFPricingService();
    var API = (window.APP_CONFIG && window.APP_CONFIG.API && window.APP_CONFIG.API.BASE_URL) || '';

    // Per-method size ladders. Price keys on these.
    var METHODS = {
        dtf: {
            label: 'DTF',
            sizes: [
                { key: 'small', label: 'Small', band: '≤ 5×5"' },
                { key: 'medium', label: 'Medium', band: '≤ 9×12"' },
                { key: 'large', label: 'Large', band: '≤ 12×16.5"' }
            ]
        },
        dtg: {
            label: 'DTG',
            sizes: [
                { key: 'small', label: 'Small', band: '~4×4" (left chest)' },
                { key: 'large', label: 'Large', band: '~12×16" (full)' },
                { key: 'jumbo', label: 'Jumbo', band: '~14×18"' }
            ]
        }
    };
    // DTG size → DTG_Costs PrintLocationCode (front/back identical, so one each).
    var DTG_SIZE_CODE = { small: 'LC', large: 'FF', jumbo: 'JF' };

    // Positions are just placement labels — they do NOT change price. `typical`
    // is the default size suggested when you pick that position.
    var POSITIONS = [
        { value: 'Left chest', typical: 'small' },
        { value: 'Right chest', typical: 'small' },
        { value: 'Left sleeve', typical: 'small' },
        { value: 'Right sleeve', typical: 'small' },
        { value: 'Back of neck', typical: 'small' },
        { value: 'Center front', typical: 'medium' },
        { value: 'Center back', typical: 'medium' },
        { value: 'Full front', typical: 'large' },
        { value: 'Full back', typical: 'large' }
    ];

    var state = {
        method: 'dtf',
        style: 'PC61',
        qty: 24,
        loading: false,
        bundles: { dtf: null, dtg: null },     // cached per method
        bundleStyle: { dtf: null, dtg: null },  // which style each bundle is for
        garment: { dtf: 0, dtg: 0 },
        prints: [
            { size: 'small', position: 'Left chest' },
            { size: 'large', position: 'Full back' }
        ]
    };

    function $(id) { return document.getElementById(id); }
    function fmt(n) { return '$' + (Math.round((Number(n) || 0) * 100) / 100).toFixed(2); }
    function esc(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }
    function sizesNow() { return METHODS[state.method].sizes; }
    function sizeMeta(key) { return sizesNow().find(function (s) { return s.key === key; }) || sizesNow()[0]; }
    function baseGarment(sizes) {
        var prices = (sizes || []).map(function (x) { return Number(x.price) || 0; }).filter(function (p) { return p > 0; });
        return prices.length ? Math.min.apply(null, prices) : 0; // base (S–XL); 2XL+ carry upcharges
    }
    // Map a size to one valid for the current method (medium↔large, jumbo↔large).
    function clampSize(key) {
        var valid = sizesNow().map(function (s) { return s.key; });
        if (valid.indexOf(key) >= 0) return key;
        if (key === 'medium') return valid.indexOf('large') >= 0 ? 'large' : valid[0];
        if (key === 'jumbo') return valid.indexOf('large') >= 0 ? 'large' : valid[0];
        return valid[0];
    }

    // ---------- DTF pricing (live engine code) ----------
    function dtfTransferRate(size) {
        var d = state.bundles.dtf; if (!d) return 0;
        var s = d.transferSizes[size]; if (!s) return 0;
        var t = s.pricingTiers.find(function (p) { return state.qty >= p.minQty && state.qty <= p.maxQty; });
        return t ? t.unitPrice : 0;
    }
    function dtfFreight() {
        var d = state.bundles.dtf; if (!d) return 0;
        var f = (d.freightTiers || []).find(function (t) { return state.qty >= t.minQty && state.qty <= t.maxQty; });
        return f ? f.costPerTransfer : 0;
    }
    function dtfPrintCost(size) { return dtfTransferRate(size) + (state.bundles.dtf ? state.bundles.dtf.laborCostPerLocation : 0) + dtfFreight(); }
    function priceDtf() {
        var d = state.bundles.dtf; if (!d) return null;
        try {
            var r = dtfSvc.calculatePriceForQuantity(state.garment.dtf, d, state.prints.map(function (p) { return p.size; }), state.qty);
            return { finalUnit: r.finalUnitPrice, garmentWithMargin: r.garmentWithMargin, ltmPerUnit: r.ltmFeePerUnit, ltmFee: r.ltmFee, tierLabel: r.tierLabel };
        } catch (e) { return { error: e.message }; }
    }

    // ---------- DTG pricing (verified replica of the server canonical pricer) ----------
    function dtgMarginTier() {
        var b = state.bundles.dtg; if (!b) return null;
        return (b.tiersR || []).find(function (t) { return state.qty >= t.MinQuantity && state.qty <= t.MaxQuantity; });
    }
    // Print-cost tier label: the non-LTM cost tier for qty; qty<24 (LTM) falls back to the lowest (24-47).
    function dtgCostTierLabel() {
        var b = state.bundles.dtg; if (!b) return null;
        var nonLtm = (b.tiersR || []).filter(function (t) { return !(Number(t.LTM_Fee) > 0); })
            .sort(function (a, c) { return a.MinQuantity - c.MinQuantity; });
        var t = nonLtm.find(function (t) { return state.qty >= t.MinQuantity && state.qty <= t.MaxQuantity; }) || nonLtm[0];
        return t ? t.TierLabel : null;
    }
    function dtgRate(size) {
        var b = state.bundles.dtg; if (!b) return 0;
        var code = DTG_SIZE_CODE[size], lbl = dtgCostTierLabel();
        var row = (b.allDtgCostsR || []).find(function (c) { return c.PrintLocationCode === code && c.TierLabel === lbl; });
        return row ? Number(row.PrintCost) || 0 : 0;
    }
    function priceDtg() {
        var b = state.bundles.dtg; if (!b) return null;
        var mt = dtgMarginTier(); if (!mt) return { error: 'No DTG tier for qty ' + state.qty };
        var denom = Number(mt.MarginDenominator), ltmFee = Number(mt.LTM_Fee) || 0;
        var printCost = state.prints.reduce(function (s, p) { return s + dtgRate(p.size); }, 0);
        var garmentWithMargin = state.garment.dtg / denom;
        var baseUnit = Math.ceil((garmentWithMargin + printCost) * 2) / 2;       // half-dollar round on garment+print
        var ltm = ltmFee > 0 ? Math.floor((ltmFee / state.qty) * 100) / 100 : 0; // floored, added after
        return { finalUnit: Math.round((baseUnit + ltm) * 100) / 100, garmentWithMargin: garmentWithMargin, ltmPerUnit: ltm, ltmFee: ltmFee, tierLabel: mt.TierLabel };
    }

    function printCost(size) { return state.method === 'dtf' ? dtfPrintCost(size) : dtgRate(size); }
    function priceAll() {
        if (!state.bundles[state.method] || !state.prints.length) return null;
        return state.method === 'dtf' ? priceDtf() : priceDtg();
    }

    // ---------- rendering ----------
    function renderMethod() {
        Array.prototype.forEach.call(document.querySelectorAll('#methodToggle button'), function (b) {
            b.classList.toggle('is-active', b.getAttribute('data-method') === state.method);
        });
    }
    function renderPrints() {
        var box = $('printsList');
        box.innerHTML = state.prints.map(function (p, i) {
            var sizeOpts = sizesNow().map(function (s) {
                return '<option value="' + s.key + '"' + (s.key === p.size ? ' selected' : '') + '>' + esc(s.label + ' (' + s.band + ')') + '</option>';
            }).join('');
            var posOpts = POSITIONS.map(function (o) {
                return '<option value="' + esc(o.value) + '"' + (o.value === p.position ? ' selected' : '') + '>' + esc(o.value) + '</option>';
            }).join('');
            var cost = state.bundles[state.method] ? ('+' + fmt(printCost(p.size)) + '/pc') : '';
            return '<div class="proto-print-row" data-i="' + i + '">'
                + '<span class="proto-print-n">' + (i + 1) + '</span>'
                + '<select class="input proto-print-size" data-i="' + i + '" aria-label="Print ' + (i + 1) + ' size">' + sizeOpts + '</select>'
                + '<span class="proto-print-at">at</span>'
                + '<select class="input proto-print-pos" data-i="' + i + '" aria-label="Print ' + (i + 1) + ' position">' + posOpts + '</select>'
                + '<span class="proto-print-cost">' + cost + '</span>'
                + '<button type="button" class="proto-print-x" data-i="' + i + '" title="Remove this print" aria-label="Remove print ' + (i + 1) + '">×</button>'
                + '</div>';
        }).join('') || '<p class="proto-empty">No prints yet &mdash; add one to see pricing.</p>';
    }
    function renderResult() {
        var box = $('result'), sub = $('resultSub');
        if (state.loading) { box.innerHTML = '<p class="proto-muted">Loading pricing…</p>'; sub.textContent = ''; return; }
        if (!state.bundles[state.method]) { box.innerHTML = ''; sub.textContent = 'Enter a style to begin'; return; }
        if (!state.prints.length) { box.innerHTML = '<p class="proto-muted">Add a print to see pricing.</p>'; sub.textContent = ''; return; }

        var res = priceAll();
        if (!res || res.error) { box.innerHTML = '<p class="proto-muted">' + esc((res && res.error) || 'Unable to price.') + '</p>'; return; }
        sub.textContent = 'for ' + state.qty + ' pieces · ' + esc(state.style) + ' · ' + METHODS[state.method].label;

        var rows = '<div class="proto-bd-row"><span>Garment + margin</span><span>' + fmt(res.garmentWithMargin) + '/pc</span></div>';
        state.prints.forEach(function (p, i) {
            var m = sizeMeta(p.size);
            rows += '<div class="proto-bd-row"><span>Print ' + (i + 1) + ' &middot; ' + esc(m.label)
                + ' <span class="proto-band">' + esc(m.band) + '</span> &middot; ' + esc(p.position) + '</span>'
                + '<span>+' + fmt(printCost(p.size)) + '/pc</span></div>';
        });
        if (res.ltmPerUnit > 0) {
            rows += '<div class="proto-bd-row proto-ltm"><span>Small-batch fee ($' + res.ltmFee + ' ÷ ' + state.qty + ')</span><span>+' + fmt(res.ltmPerUnit) + '/pc</span></div>';
        }
        box.innerHTML = '<div class="proto-headline"><span class="proto-pp">' + fmt(res.finalUnit) + '<span class="per">/pc</span></span>'
            + '<span class="proto-order">' + fmt(res.finalUnit * state.qty) + ' total</span></div>'
            + '<div class="proto-bd">' + rows + '</div>'
            + '<p class="proto-round">' + (state.method === 'dtf'
                ? 'Per-piece rounded up to the nearest $0.50 (tier ' + esc(res.tierLabel) + ').'
                : 'Garment + print rounded up to $0.50, then the small-batch fee added (tier ' + esc(res.tierLabel) + ').') + '</p>';
    }
    function render() { renderMethod(); renderPrints(); renderResult(); }

    // ---------- data load (lazy per method, cached) ----------
    function fetchDtgBundle(style) {
        return fetch(API + '/api/pricing-bundle?method=DTG&styleNumber=' + encodeURIComponent(style)).then(function (r) {
            if (!r.ok) throw new Error('HTTP ' + r.status); return r.json();
        });
    }
    function ensureBundle() {
        var m = state.method, style = (state.style || '').trim().toUpperCase();
        $('protoError').hidden = true;
        if (!style) { state.bundles[m] = null; render(); return; }
        if (state.bundles[m] && state.bundleStyle[m] === style) { render(); return; }
        state.loading = true; $('styleStatus').textContent = 'Loading…'; renderResult();
        var p = (m === 'dtf')
            ? dtfSvc.fetchPricingData(style).then(function (d) {
                if (!d || !d.transferSizes || !d.transferSizes.small) throw new Error('No DTF pricing for ' + style);
                state.bundles.dtf = d; state.garment.dtf = baseGarment(d.raw && d.raw.sizes);
            })
            : fetchDtgBundle(style).then(function (b) {
                if (!b || !b.allDtgCostsR || !b.allDtgCostsR.length) throw new Error('No DTG pricing for ' + style);
                state.bundles.dtg = b; state.garment.dtg = baseGarment(b.sizes);
            });
        p.then(function () {
            if ((state.style || '').trim().toUpperCase() !== style || state.method !== m) return; // stale
            state.bundleStyle[m] = style; state.loading = false;
            $('styleStatus').textContent = style + ' · base garment ' + fmt(state.garment[m]);
            render();
        }).catch(function (err) {
            if (state.method !== m) return;
            state.loading = false; state.bundles[m] = null; $('styleStatus').textContent = '';
            var e = $('protoError'); e.hidden = false;
            e.innerHTML = '<strong>Couldn’t load ' + METHODS[m].label + ' pricing for ' + esc(style) + '.</strong> ' + esc((err && err.message) || 'Check the style number.');
            render();
        });
    }
    var loadTimer = null;
    function ensureBundleDebounced() { clearTimeout(loadTimer); loadTimer = setTimeout(ensureBundle, 350); }

    // ---------- events ----------
    function bind() {
        $('methodToggle').addEventListener('click', function (e) {
            var b = e.target.closest('button'); if (!b) return;
            var m = b.getAttribute('data-method'); if (!m || m === state.method) return;
            state.method = m;
            state.prints.forEach(function (p) { p.size = clampSize(p.size); }); // keep sizes valid for the new ladder
            ensureBundle();
        });
        $('style').addEventListener('input', function (e) { state.style = e.target.value; ensureBundleDebounced(); });
        $('qty').addEventListener('input', function (e) { state.qty = Math.max(1, parseInt(e.target.value, 10) || 1); render(); });
        Array.prototype.forEach.call(document.querySelectorAll('.qq-qty-presets button'), function (b) {
            b.addEventListener('click', function () { state.qty = parseInt(b.getAttribute('data-qty'), 10); $('qty').value = state.qty; render(); });
        });
        $('addPrint').addEventListener('click', function () {
            state.prints.push({ size: clampSize('small'), position: 'Left chest' });
            render();
        });
        $('printsList').addEventListener('change', function (e) {
            var i = parseInt(e.target.getAttribute('data-i'), 10);
            if (isNaN(i) || !state.prints[i]) return;
            if (e.target.classList.contains('proto-print-size')) { state.prints[i].size = e.target.value; render(); }
            else if (e.target.classList.contains('proto-print-pos')) {
                state.prints[i].position = e.target.value;
                var pos = POSITIONS.find(function (o) { return o.value === e.target.value; });
                if (pos) state.prints[i].size = clampSize(pos.typical); // snap to the position's typical size
                render();
            }
        });
        $('printsList').addEventListener('click', function (e) {
            if (!e.target.classList.contains('proto-print-x')) return;
            var i = parseInt(e.target.getAttribute('data-i'), 10);
            if (!isNaN(i)) { state.prints.splice(i, 1); render(); }
        });
    }

    function init() {
        if (!window.DTFPricingService) {
            var e = $('protoError'); e.hidden = false;
            e.innerHTML = '<strong>Pricing engine didn’t load.</strong> Refresh the page.';
            return;
        }
        bind();
        render();
        ensureBundle();
    }

    if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', init); }
    else { init(); }
})();
