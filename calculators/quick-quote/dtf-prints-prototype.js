/*
 * DTF Prints — prototype (the "logo = size + position" model)
 * --------------------------------------------------------------
 * Self-contained DTF-only experiment. Prices a LIST of prints, each one a
 * (size, position), through the live DTFPricingService — the same engine the
 * Quick Quote / quote builder / catalog use. Price comes from the SIZE; the
 * position is just placement (a small print costs the same anywhere).
 *
 * Touches no live tool. Not linked from anywhere. Safe to iterate on.
 */
(function () {
    'use strict';

    var svc = new window.DTFPricingService();

    // DTF transfer sizes (DTF_Pricing.size). Price keys on these.
    var SIZES = [
        { key: 'small', label: 'Small', band: '≤ 5×5"' },
        { key: 'medium', label: 'Medium', band: '≤ 9×12"' },
        { key: 'large', label: 'Large', band: '≤ 12×16.5"' }
    ];
    // Positions are just placement labels — they do NOT change the price. The
    // "typical" size is only a default suggestion when you add that position.
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
        style: 'PC61',
        qty: 24,
        data: null,        // fetchPricingData() result
        garment: 0,        // base (S–XL) garment cost
        loading: false,
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
    function bandFor(sizeKey) { var s = SIZES.find(function (x) { return x.key === sizeKey; }); return s ? s.band : ''; }

    // ---- pricing helpers (read straight from the engine's data) ----
    function tierFreight() {
        if (!state.data) return 0;
        var f = (state.data.freightTiers || []).find(function (t) { return state.qty >= t.minQty && state.qty <= t.maxQty; });
        return f ? f.costPerTransfer : 0;
    }
    function transferRate(sizeKey) {
        if (!state.data) return 0;
        var s = state.data.transferSizes[sizeKey];
        if (!s) return 0;
        var t = s.pricingTiers.find(function (p) { return state.qty >= p.minQty && state.qty <= p.maxQty; });
        return t ? t.unitPrice : 0;
    }
    // Marginal per-piece cost of one print: its transfer (by size) + labor + freight.
    function printCost(sizeKey) {
        return transferRate(sizeKey) + (state.data ? state.data.laborCostPerLocation : 0) + tierFreight();
    }
    // Whole per-piece price via the authoritative engine method.
    function priceAll() {
        if (!state.data || !state.prints.length) return null;
        var sizeKeys = state.prints.map(function (p) { return p.size; });
        try { return svc.calculatePriceForQuantity(state.garment, state.data, sizeKeys, state.qty); }
        catch (e) { return { error: e.message }; }
    }

    function baseGarment(data) {
        var sizes = (data && data.raw && data.raw.sizes) || [];
        var prices = sizes.map(function (x) { return Number(x.price) || 0; }).filter(function (p) { return p > 0; });
        return prices.length ? Math.min.apply(null, prices) : 0; // base (S–XL) shares the lowest; 2XL+ carry upcharges
    }

    // ---- rendering ----
    function renderPrints() {
        var box = $('printsList');
        box.innerHTML = state.prints.map(function (p, i) {
            var sizeOpts = SIZES.map(function (s) {
                return '<option value="' + s.key + '"' + (s.key === p.size ? ' selected' : '') + '>' + esc(s.label + ' (' + s.band + ')') + '</option>';
            }).join('');
            var posOpts = POSITIONS.map(function (o) {
                return '<option value="' + esc(o.value) + '"' + (o.value === p.position ? ' selected' : '') + '>' + esc(o.value) + '</option>';
            }).join('');
            var cost = state.data ? ('+' + fmt(printCost(p.size)) + '/pc') : '';
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
        if (!state.data) { box.innerHTML = ''; sub.textContent = 'Enter a style to begin'; return; }
        if (!state.prints.length) { box.innerHTML = '<p class="proto-muted">Add a print to see pricing.</p>'; sub.textContent = ''; return; }

        var res = priceAll();
        if (!res || res.error) {
            box.innerHTML = '<p class="proto-muted">' + esc((res && res.error) || 'Unable to price.') + '</p>';
            return;
        }
        sub.textContent = 'for ' + state.qty + ' pieces · ' + esc(state.style);

        var rows = '';
        rows += '<div class="proto-bd-row"><span>Garment + margin</span><span>' + fmt(res.garmentWithMargin) + '/pc</span></div>';
        state.prints.forEach(function (p, i) {
            rows += '<div class="proto-bd-row"><span>Print ' + (i + 1) + ' &middot; ' + esc(SIZES.find(function (s) { return s.key === p.size; }).label)
                + ' <span class="proto-band">' + esc(bandFor(p.size)) + '</span> &middot; ' + esc(p.position) + '</span>'
                + '<span>+' + fmt(printCost(p.size)) + '/pc</span></div>';
        });
        if (res.ltmFeePerUnit > 0) {
            rows += '<div class="proto-bd-row proto-ltm"><span>Small-batch fee ($' + res.ltmFee + ' ÷ ' + state.qty + ')</span><span>+' + fmt(res.ltmFeePerUnit) + '/pc</span></div>';
        }

        var orderTotal = res.finalUnitPrice * state.qty;
        box.innerHTML = '<div class="proto-headline"><span class="proto-pp">' + fmt(res.finalUnitPrice) + '<span class="per">/pc</span></span>'
            + '<span class="proto-order">' + fmt(orderTotal) + ' total</span></div>'
            + '<div class="proto-bd">' + rows + '</div>'
            + '<p class="proto-round">Per-piece rounded up to the nearest $0.50 (tier ' + esc(res.tierLabel) + ').</p>';
    }

    function render() { renderPrints(); renderResult(); }

    // ---- data load ----
    var loadTimer = null;
    function loadStyle() {
        var style = (state.style || '').trim().toUpperCase();
        $('protoError').hidden = true;
        if (!style) { state.data = null; render(); return; }
        state.loading = true; $('styleStatus').textContent = 'Loading…'; renderResult();
        svc.fetchPricingData(style).then(function (data) {
            if ((state.style || '').trim().toUpperCase() !== style) return; // stale
            if (!data || !data.transferSizes || !data.transferSizes.small) { throw new Error('No DTF pricing for ' + style); }
            state.data = data;
            state.garment = baseGarment(data);
            state.loading = false;
            $('styleStatus').textContent = state.garment ? (style + ' · base garment ' + fmt(state.garment)) : style;
            render();
        }).catch(function (err) {
            state.loading = false; state.data = null;
            $('styleStatus').textContent = '';
            var e = $('protoError'); e.hidden = false;
            e.innerHTML = '<strong>Couldn’t load DTF pricing for ' + esc(style) + '.</strong> ' + esc((err && err.message) || 'Check the style number.');
            render();
        });
    }
    function loadStyleDebounced() { clearTimeout(loadTimer); loadTimer = setTimeout(loadStyle, 350); }

    // ---- events ----
    function bind() {
        $('style').addEventListener('input', function (e) { state.style = e.target.value; loadStyleDebounced(); });
        $('qty').addEventListener('input', function (e) { state.qty = Math.max(1, parseInt(e.target.value, 10) || 1); render(); });
        Array.prototype.forEach.call(document.querySelectorAll('.qq-qty-presets button'), function (b) {
            b.addEventListener('click', function () { state.qty = parseInt(b.getAttribute('data-qty'), 10); $('qty').value = state.qty; render(); });
        });
        $('addPrint').addEventListener('click', function () {
            state.prints.push({ size: 'small', position: 'Left chest' });
            render();
        });
        // delegated handlers on the prints list
        $('printsList').addEventListener('change', function (e) {
            var i = parseInt(e.target.getAttribute('data-i'), 10);
            if (isNaN(i) || !state.prints[i]) return;
            if (e.target.classList.contains('proto-print-size')) { state.prints[i].size = e.target.value; render(); }
            else if (e.target.classList.contains('proto-print-pos')) {
                state.prints[i].position = e.target.value;
                // when you pick a position, snap the size to that position's typical size (a one-time helper)
                var pos = POSITIONS.find(function (o) { return o.value === e.target.value; });
                if (pos) { state.prints[i].size = pos.typical; }
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
        loadStyle();
    }

    if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', init); }
    else { init(); }
})();
