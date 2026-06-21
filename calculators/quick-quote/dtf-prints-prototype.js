/*
 * Prints prototype — "logo = size + position" model (DTF + DTG)
 * ------------------------------------------------------------------
 * COMPONENT-ROUNDED ("round each part") pricing experiment:
 *
 *     Price per shirt = Blank+margin (→$0.50) + Σ each print (→$0.50) + small-batch fee/shirt
 *
 * Every building block is rounded UP to the next $0.50, so the lines ADD UP to
 * the per-shirt price by hand — no separate rounding step. The small-batch fee
 * ($50 ÷ qty, floored to cents) is a per-shirt LINE ITEM, so the shirt price is
 * all-in. The only line with odd cents is that fee (a flat $50 across N shirts).
 *
 * This is a DIFFERENT formula than the live tools (which round the final total
 * once) — it's the model under evaluation. Rates are live: DTF = transfer+labor+
 * freight from DTFPricingService; DTG = verified server-pricer rates (Small=LC,
 * Large=FF/FB, Jumbo=JF/JB; qty<24 uses the 24-47 print costs).
 *
 * Touches no live tool. Not linked from anywhere. Safe to iterate on.
 */
(function () {
    'use strict';

    var dtfSvc = new window.DTFPricingService();
    var API = (window.APP_CONFIG && window.APP_CONFIG.API && window.APP_CONFIG.API.BASE_URL) || '';

    var METHODS = { dtf: { label: 'DTF' }, dtg: { label: 'DTG' } };
    // ONE shared size ladder. Small + Large are the same size in both methods; Medium is
    // DTF-only (DTG has no 9×12 rate) and Jumbo is DTG-only (DTF's biggest transfer is 12×16.5").
    var SIZE_LADDER = [
        { key: 'small',  label: 'Small',  dtf: '≤ 5×5"',     dtg: '4×4" · left chest' },
        { key: 'medium', label: 'Medium', dtf: '≤ 9×12"',    dtg: null },
        { key: 'large',  label: 'Large',  dtf: '≤ 12×16.5"', dtg: '12×16" · full' },
        { key: 'jumbo',  label: 'Jumbo',  dtf: null,         dtg: '16×20"' }
    ];
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
    function hdc(x) { return Math.ceil(x * 2 - 1e-9) / 2; }  // round UP to the next $0.50
    function round2(x) { return Math.round(x * 100) / 100; }
    function bandFor(key) { var s = SIZE_LADDER.find(function (x) { return x.key === key; }); return s ? s[state.method] : null; }
    function available(key) { return !!bandFor(key); }
    function sizeMeta(key) { return SIZE_LADDER.find(function (x) { return x.key === key; }) || SIZE_LADDER[0]; }
    function onlyMethodLabel(s) { if (s.dtf && !s.dtg) return 'DTF'; if (s.dtg && !s.dtf) return 'DTG'; return null; }
    function baseGarment(sizes) {
        var prices = (sizes || []).map(function (x) { return Number(x.price) || 0; }).filter(function (p) { return p > 0; });
        return prices.length ? Math.min.apply(null, prices) : 0; // base (S–XL); 2XL+ carry upcharges
    }
    // Map a size to one valid for the current method (medium↔large, jumbo↔large).
    function clampSize(key) {
        if (available(key)) return key;
        if ((key === 'medium' || key === 'jumbo') && available('large')) return 'large'; // nearest available
        var first = SIZE_LADDER.find(function (s) { return available(s.key); });
        return first ? first.key : 'small';
    }

    // ---------- raw per-print rates (before the $0.50 round) ----------
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
    function rawRate(size) { return state.method === 'dtf' ? dtfPrintCost(size) : dtgRate(size); }
    function displayRate(size) { return hdc(rawRate(size)); } // the published, rounded per-print rate

    // ---------- component-rounded price ----------
    function priceAll() {
        var m = state.method;
        if (!state.bundles[m] || !state.prints.length) return null;
        var denom, ltmFlat, tierLabel;
        if (m === 'dtf') {
            var mt = (state.bundles.dtf.pricingTiers || []).find(function (t) { return state.qty >= t.minQuantity && state.qty <= t.maxQuantity; });
            if (!mt) return { error: 'No DTF price tier for qty ' + state.qty };
            denom = mt.marginDenominator; ltmFlat = mt.ltmFee > 0 ? mt.ltmFee : 0; tierLabel = mt.tierLabel;
        } else {
            var mt2 = dtgMarginTier();
            if (!mt2) return { error: 'No DTG price tier for qty ' + state.qty };
            denom = Number(mt2.MarginDenominator); ltmFlat = Number(mt2.LTM_Fee) > 0 ? Number(mt2.LTM_Fee) : 0; tierLabel = mt2.TierLabel;
        }
        var blank = hdc(state.garment[m] / denom);
        var prints = state.prints.map(function (p) { return { size: p.size, position: p.position, rate: displayRate(p.size) }; });
        var printsSum = prints.reduce(function (s, p) { return s + p.rate; }, 0);
        var ltmPerShirt = ltmFlat > 0 ? Math.floor((ltmFlat / state.qty) * 100) / 100 : 0; // flat $50 spread per shirt
        var perPiece = round2(blank + printsSum + ltmPerShirt);
        return {
            blank: blank, prints: prints, ltmFlat: ltmFlat, ltmPerShirt: ltmPerShirt, ltmThreshold: 24,
            perPiece: perPiece, orderTotal: round2(perPiece * state.qty), tierLabel: tierLabel
        };
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
            var sizeOpts = SIZE_LADDER.map(function (s) {
                var band = s[state.method], avail = !!band;
                var lbl = avail ? (s.label + ' (' + band + ')') : (s.label + ' — ' + onlyMethodLabel(s) + ' only');
                return '<option value="' + s.key + '"' + (s.key === p.size ? ' selected' : '') + (avail ? '' : ' disabled') + '>' + esc(lbl) + '</option>';
            }).join('');
            var posOpts = POSITIONS.map(function (o) {
                return '<option value="' + esc(o.value) + '"' + (o.value === p.position ? ' selected' : '') + '>' + esc(o.value) + '</option>';
            }).join('');
            var cost = state.bundles[state.method] ? ('+' + fmt(displayRate(p.size)) + '/pc') : '';
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
        sub.textContent = 'for ' + state.qty + ' shirts · ' + esc(state.style) + ' · ' + METHODS[state.method].label;

        var rows = '<div class="proto-bd-row"><span>Blank + margin</span><span>' + fmt(res.blank) + '/pc</span></div>';
        res.prints.forEach(function (p, i) {
            var meta = sizeMeta(p.size);
            rows += '<div class="proto-bd-row"><span>Print ' + (i + 1) + ' &middot; ' + esc(meta.label)
                + ' <span class="proto-band">' + esc(bandFor(p.size) || '') + '</span> &middot; ' + esc(p.position) + '</span>'
                + '<span>+' + fmt(p.rate) + '/pc</span></div>';
        });
        if (res.ltmPerShirt > 0) {
            rows += '<div class="proto-bd-row proto-ltm"><span>Small-batch fee ($' + res.ltmFlat + ' ÷ ' + state.qty + ' shirts)</span><span>+' + fmt(res.ltmPerShirt) + '/pc</span></div>';
        }
        rows += '<div class="proto-bd-row proto-total"><span>Price per shirt</span><span>' + fmt(res.perPiece) + '/pc</span></div>';

        box.innerHTML = '<div class="proto-headline"><span class="proto-pp">' + fmt(res.perPiece) + '<span class="per">/pc</span></span>'
            + '<span class="proto-order">' + fmt(res.orderTotal) + ' total</span></div>'
            + '<div class="proto-bd">' + rows + '</div>'
            + '<p class="proto-round">' + (res.ltmPerShirt > 0
                ? 'Blank + each print are rounded to $0.50, so they add up by hand. The small-batch fee ($' + res.ltmFlat + ' spread across ' + state.qty + ' shirts) is the one line with odd cents &mdash; that&rsquo;s just $' + res.ltmFlat + ' &divide; ' + state.qty + '. The shirt price is all-in (tier ' + esc(res.tierLabel) + ').'
                : 'Blank + each print are rounded to $0.50, so the lines add up to the per-shirt price by hand &mdash; no separate rounding step, and the shirt price is all-in (tier ' + esc(res.tierLabel) + ').') + '</p>';
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
