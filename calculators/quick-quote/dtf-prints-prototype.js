/*
 * Prints + Embroidery prototype — "decoration = blank + line items" model (DTF · DTG · EMB)
 * ------------------------------------------------------------------------------------------
 * COMPONENT-ROUNDED ("round each part") pricing experiment:
 *
 *     Price per shirt = Blank+margin (→$0.50) + Σ each decoration line (→$0.50) + small-batch fee/shirt
 *
 * Every building block is rounded UP to the next $0.50, so the lines ADD UP to the per-shirt
 * price by hand — no separate rounding step. Small-batch fee ($50 ÷ qty) is a per-shirt LINE ITEM.
 *
 * The decoration line differs by method (all surfaced as a unified `parts` list):
 *   DTF / DTG  → each part is a print SIZE (Small/Med/Large/Jumbo). DTF = transfer+labor+freight;
 *               DTG = LC/FF/JF print cost. Goes anywhere (size is the price; placement is a builder detail).
 *   EMB        → each part is a LOGO by STITCH COUNT. Primary = embBase(tier) + stitch surcharge;
 *               Additional = AL base(tier) + $1.25/1K over 8K. (Live EMB rounds to whole-dollar
 *               'CeilDollar'; this prototype rounds parts to $0.50 to match DTF/DTG.)
 *
 * A DIFFERENT formula than the live tools (which round the final total once) — model under eval.
 * Touches no live tool. Not linked from anywhere.
 */
(function () {
    'use strict';

    var dtfSvc = new window.DTFPricingService();
    var API = (window.APP_CONFIG && window.APP_CONFIG.API && window.APP_CONFIG.API.BASE_URL) || '';

    var METHODS = { dtf: { label: 'DTF' }, dtg: { label: 'DTG' }, emb: { label: 'Embroidery' }, scp: { label: 'Screen print' } };
    function isEmb() { return state.method === 'emb'; }
    function isScp() { return state.method === 'scp'; }
    function partNoun() { return isScp() ? 'location' : isEmb() ? 'logo' : 'print'; }

    // Shared size ladder for the PRINT methods. Small + Large are the same in both; Medium is
    // DTF-only (DTG has no 9×12 rate), Jumbo is DTG-only (DTF caps at 12×16.5").
    var SIZE_LADDER = [
        { key: 'small',  label: 'Small',  dtf: '≤ 5×5"',     dtg: '4×4"' },
        { key: 'medium', label: 'Medium', dtf: '≤ 9×12"',    dtg: null },
        { key: 'large',  label: 'Large',  dtf: '≤ 12×16.5"', dtg: '12×16"' },
        { key: 'jumbo',  label: 'Jumbo',  dtf: null,         dtg: '16×20"' }
    ];
    var DTG_SIZE_CODE = { small: 'LC', large: 'FF', jumbo: 'JF' };
    var DEFAULT_STITCHES = 8000;

    var state = {
        method: 'dtf',
        style: 'PC61',
        qty: 24,
        loading: false,
        embCap: false,   // EMB only: is the current style a cap (cap embroidery costs) vs a garment?
        bundles: { dtf: null, dtg: null, emb: null, scp: null },
        bundleStyle: { dtf: null, dtg: null, emb: null, scp: null },
        garment: { dtf: 0, dtg: 0, emb: 0, scp: 0 },
        addons: { dtf: {}, dtg: {}, emb: {}, scp: {} },  // size → blank upcharge (sellingPriceDisplayAddOns)
        extSizes: {},        // 2XL/3XL/… → how many of the order qty are this extended size
        extSizesOpen: false,
        // each item carries a size (print methods), a stitch count (EMB) and an ink-color count (SCP)
        // so switching method needs no conversion — each method reads the field it cares about.
        prints: [
            { size: 'small', stitches: 8000, colors: 1 },
            { size: 'large', stitches: 8000, colors: 1 }
        ]
    };

    function $(id) { return document.getElementById(id); }
    function fmt(n) { return '$' + (Math.round((Number(n) || 0) * 100) / 100).toFixed(2); }
    function esc(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }
    function hdc(x) { return Math.ceil(x * 2 - 1e-9) / 2; }  // round UP to next $0.50
    function round2(x) { return Math.round(x * 100) / 100; }
    // Cap detection (mirrors the builder's fallback patterns: CP*, NE*, C+digit, 2-3 digit Richardson).
    // Beanies are flat headwear → garment pricing, so exclude obvious knit/beanie styles isn't needed at
    // the style-number level; the user can flip the Garment/Cap toggle if a detection is wrong.
    function isCapStyle(s) { s = (s || '').trim().toUpperCase(); return /^(CP|NE)/.test(s) || /^C\d/.test(s) || /^\d{2,3}$/.test(s); }
    function fmtSt(st) { return (Number(st) || 0).toLocaleString() + ' st'; }
    function jsonOk(r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); }
    var EXT_SIZES = ['2XL', '3XL', '4XL', '5XL', '6XL'];
    function addonsNow() { return state.addons[state.method] || {}; }
    function addonFor(sz) { return Number(addonsNow()[sz]) || 0; }
    function extSizesOffered() {
        if (state.method === 'emb' && state.embCap) return []; // caps are OSFA — no extended sizes
        var a = addonsNow(); return EXT_SIZES.filter(function (s) { return Number(a[s]) > 0; });
    }
    // Blend the standard per-shirt with any extended-size allocations (2XL+ add their blank upcharge to the per-shirt).
    function sizeBreakdown(res) {
        var ext = [], extTotal = 0;
        extSizesOffered().forEach(function (sz) {
            var c = Math.max(0, parseInt(state.extSizes[sz], 10) || 0);
            if (c > 0) { ext.push({ size: sz, count: c, add: addonFor(sz), pp: round2(res.perPiece + addonFor(sz)) }); extTotal += c; }
        });
        var over = extTotal > state.qty;
        var stdCount = Math.max(0, state.qty - extTotal);
        var orderTotal = round2(stdCount * res.perPiece + ext.reduce(function (s, e) { return s + e.count * e.pp; }, 0));
        return { stdCount: stdCount, ext: ext, orderTotal: orderTotal, over: over };
    }
    function bandFor(key) { var s = SIZE_LADDER.find(function (x) { return x.key === key; }); return s ? s[state.method] : null; }
    function available(key) { return !!bandFor(key); }
    function sizeMeta(key) { return SIZE_LADDER.find(function (x) { return x.key === key; }) || SIZE_LADDER[0]; }
    function onlyMethodLabel(s) { if (s.dtf && !s.dtg) return 'DTF'; if (s.dtg && !s.dtf) return 'DTG'; return null; }
    function baseGarment(sizes) {
        var prices = (sizes || []).map(function (x) { return Number(x.price) || 0; }).filter(function (p) { return p > 0; });
        return prices.length ? Math.min.apply(null, prices) : 0;
    }
    function clampSize(key) {
        if (available(key)) return key;
        if ((key === 'medium' || key === 'jumbo') && available('large')) return 'large';
        var first = SIZE_LADDER.find(function (s) { return available(s.key); });
        return first ? first.key : 'small';
    }

    // ---------- print (DTF/DTG) per-part raw rates ----------
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
    function dtgCostTierLabel() {
        var b = state.bundles.dtg; if (!b) return null;
        var nonLtm = (b.tiersR || []).filter(function (t) { return !(Number(t.LTM_Fee) > 0); }).sort(function (a, c) { return a.MinQuantity - c.MinQuantity; });
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
    function displayRate(size) { return hdc(rawRate(size)); }

    // ---------- embroidery per-logo raw rates ----------
    function embTierFor(qty) {
        var b = state.bundles.emb; if (!b) return null;
        return b.tiers.find(function (t) { return qty >= t.min && qty <= t.max; });
    }
    function embSurcharge(stitches) {
        var bands = (state.bundles.emb && state.bundles.emb.surcharge) || [];
        for (var i = 0; i < bands.length; i++) { if (stitches <= bands[i].max) return bands[i].fee; }
        return bands.length ? bands[bands.length - 1].fee : 0; // >25K caps at the top band
    }
    function embLogoRate(i) { // rounded per-logo rate for the current tier/qty
        var b = state.bundles.emb, t = embTierFor(state.qty);
        if (!b || !t || !state.prints[i]) return 0;
        var st = Math.max(0, parseInt(state.prints[i].stitches, 10) || 0);
        if (i === 0) return hdc((b.embBase[t.label] || 0) + embSurcharge(st)); // primary
        var al = b.al[t.label] || { base: 0, baseStitch: 8000, rate: 1.25 };
        return hdc(al.base + Math.max(0, (st - al.baseStitch) / 1000) * al.rate); // additional
    }

    // ---------- unified component-rounded price ----------
    function priceAll() {
        var m = state.method;
        if (!state.bundles[m] || !state.prints.length) return null;
        if (m === 'emb') return embPrice();
        if (m === 'scp') return scpPrice();

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
        var parts = state.prints.map(function (p, i) {
            var meta = sizeMeta(p.size);
            return { label: 'Print ' + (i + 1) + ' · ' + meta.label, short: meta.label, sub: bandFor(p.size) || '', rate: displayRate(p.size) };
        });
        var ltmPerShirt = ltmFlat > 0 ? Math.floor((ltmFlat / state.qty) * 100) / 100 : 0;
        var perPiece = round2(blank + parts.reduce(function (s, p) { return s + p.rate; }, 0) + ltmPerShirt);
        return { blank: blank, parts: parts, ltmFlat: ltmFlat, ltmPerShirt: ltmPerShirt, ltmThreshold: 24, perPiece: perPiece, orderTotal: round2(perPiece * state.qty), tierLabel: tierLabel };
    }
    function embPrice() {
        var b = state.bundles.emb; if (!b) return null;
        var t = embTierFor(state.qty); if (!t) return { error: 'No EMB price tier for qty ' + state.qty };
        var blank = hdc(b.garment / t.denom);
        var cap = b.isCap;
        var parts = state.prints.map(function (p, i) {
            var st = Math.max(0, parseInt(p.stitches, 10) || 0);
            if (i === 0) return { label: cap ? 'Cap front' : 'Primary logo', short: cap ? 'Front' : 'Primary', sub: fmtSt(st), rate: embLogoRate(i) };
            if (cap) return { label: i === 1 ? 'Cap back' : 'Cap location ' + (i + 1), short: i === 1 ? 'Back' : 'Loc ' + (i + 1), sub: fmtSt(st), rate: embLogoRate(i) };
            return { label: 'Additional logo ' + (i + 1), short: 'Logo ' + (i + 1), sub: fmtSt(st), rate: embLogoRate(i) };
        });
        var ltmPerShirt = t.ltm > 0 ? Math.floor((t.ltm / state.qty) * 100) / 100 : 0;
        var perPiece = round2(blank + parts.reduce(function (s, p) { return s + p.rate; }, 0) + ltmPerShirt);
        return { blank: blank, parts: parts, ltmFlat: t.ltm, ltmPerShirt: ltmPerShirt, ltmThreshold: 8, perPiece: perPiece, orderTotal: round2(perPiece * state.qty), tierLabel: t.label };
    }
    // ---------- screen-print per-location rates (each part = a location at N ink colors) ----------
    function scpTierFor(qty) {
        var b = state.bundles.scp; if (!b) return null;
        return b.tiers.find(function (t) { return qty >= t.min && qty <= t.max; });
    }
    function scpEdCost(costType, tierLabel, colors) {
        var b = state.bundles.scp; if (!b) return 0;
        var row = b.costs.find(function (c) { return c.CostType === costType && c.TierLabel === tierLabel && c.ColorCount === colors; });
        return row ? row.Ed_Cost : 0;
    }
    function scpColors(i) { return Math.min(6, Math.max(1, parseInt(state.prints[i] && state.prints[i].colors, 10) || 1)); }
    function scpLocRate(i) { // rounded per-location rate (front = +flash on every color; back = no flash)
        var b = state.bundles.scp, t = scpTierFor(state.qty);
        if (!b || !t || !state.prints[i]) return 0;
        var colors = scpColors(i);
        if (i === 0) return hdc((scpEdCost('PrimaryLocation', t.label, colors) + b.flash * colors) / t.denom);
        return hdc(scpEdCost('AdditionalLocation', t.label, colors) / t.denom);
    }
    function scpPrice() {
        var b = state.bundles.scp; if (!b) return null;
        var t = scpTierFor(state.qty); if (!t) return { error: 'Screen print starts at 24 pieces (qty ' + state.qty + ' is below the minimum).' };
        var blank = hdc(b.garment / t.denom);
        var parts = state.prints.map(function (p, i) {
            var colors = scpColors(i);
            var loc = i === 0 ? 'Front' : (i === 1 ? 'Back' : 'Location ' + (i + 1));
            return { label: loc + ' · ' + colors + '-color', short: loc, sub: i === 0 ? 'incl. flash' : '', rate: scpLocRate(i) };
        });
        var ltmPerShirt = t.ltm > 0 ? Math.floor((t.ltm / state.qty) * 100) / 100 : 0;
        var perPiece = round2(blank + parts.reduce(function (s, p) { return s + p.rate; }, 0) + ltmPerShirt);
        return { blank: blank, parts: parts, ltmFlat: t.ltm, ltmPerShirt: ltmPerShirt, ltmThreshold: 48, perPiece: perPiece, orderTotal: round2(perPiece * state.qty), tierLabel: t.label };
    }
    function priceAtQty(q) { var saved = state.qty; state.qty = q; var r = priceAll(); state.qty = saved; return r; }

    // ---------- rate card (DTF + DTG, printable PDF) ----------
    function rateCardData(method) {
        var sm = state.method, sq = state.qty;
        state.method = method;
        var sizes = SIZE_LADDER.filter(function (s) { return s[method]; });
        var rows = [12, 24, 48, 72].map(function (q) {
            state.qty = q;
            var denom = null, ltmFlat = 0;
            if (method === 'dtf') {
                var mt = (state.bundles.dtf.pricingTiers || []).find(function (t) { return q >= t.minQuantity && q <= t.maxQuantity; });
                if (mt) { denom = mt.marginDenominator; ltmFlat = mt.ltmFee > 0 ? mt.ltmFee : 0; }
            } else {
                var mt2 = dtgMarginTier();
                if (mt2) { denom = Number(mt2.MarginDenominator); ltmFlat = Number(mt2.LTM_Fee) > 0 ? Number(mt2.LTM_Fee) : 0; }
            }
            var blank = denom ? hdc(state.garment[method] / denom) : null;
            var sizeRates = {};
            sizes.forEach(function (s) { sizeRates[s.key] = displayRate(s.key); });
            return { qty: q, blank: blank, ltm: ltmFlat > 0 ? Math.floor((ltmFlat / q) * 100) / 100 : 0, sizeRates: sizeRates };
        });
        state.method = sm; state.qty = sq;
        return { sizes: sizes, rows: rows };
    }
    function rateCardTable(method) {
        if (!state.bundles[method]) return '';
        var d = rateCardData(method);
        var head = '<th>' + METHODS[method].label + '</th>' + d.rows.map(function (r) { return '<th>' + r.qty + '</th>'; }).join('');
        var body = '<tr class="rc-blank"><td>Blank + margin</td>' + d.rows.map(function (r) { return '<td>' + (r.blank != null ? fmt(r.blank) : '&mdash;') + '</td>'; }).join('') + '</tr>';
        d.sizes.forEach(function (s) {
            body += '<tr><td>+ ' + esc(s.label) + ' <span class="rc-band">' + esc(s[method]) + '</span></td>'
                + d.rows.map(function (r) { return '<td>+' + fmt(r.sizeRates[s.key]) + '</td>'; }).join('') + '</tr>';
        });
        body += '<tr class="rc-ltm"><td>Small-batch / shirt</td>' + d.rows.map(function (r) { return '<td>' + (r.ltm > 0 ? '+' + fmt(r.ltm) : '&mdash;') + '</td>'; }).join('') + '</tr>';
        return '<table class="rc-table"><thead><tr>' + head + '</tr></thead><tbody>' + body + '</tbody></table>';
    }
    function buildRateCardSheet(style) {
        var now = new Date();
        var date = (now.getMonth() + 1) + '/' + now.getDate() + '/' + now.getFullYear();
        $('rateCardSheet').innerHTML =
            '<div class="rc-head"><img class="rc-logo" src="https://cdn.caspio.com/A0E15000/Safety%20Stripes/web%20northwest%20custom%20apparel%20logo.png?ver=1" alt="Northwest Custom Apparel">'
            + '<div class="rc-titlewrap"><div class="rc-title">Print Pricing Rate Card</div>'
            + '<div class="rc-meta">Style ' + esc(style) + ' &middot; base garment ' + fmt(state.garment.dtf || state.garment.dtg) + ' &middot; ' + esc(date) + '</div></div></div>'
            + rateCardTable('dtf') + rateCardTable('dtg')
            + '<p class="rc-howto"><strong>How to read:</strong> price per shirt = <strong>Blank + margin + each print&rsquo;s size</strong> (plus the small-batch fee on orders under 24). Every part is rounded to $0.50, so the lines add up by hand. A print prices the same wherever it goes on the shirt. Estimate only &mdash; not a saved quote.</p>';
    }
    function downloadRateCard() {
        var style = (state.style || '').trim().toUpperCase();
        if (!style) return;
        var btn = $('rateCardBtn'), label = btn.innerHTML;
        btn.disabled = true; btn.textContent = 'Preparing…';
        Promise.all([
            loadMethodBundle('dtf', style).catch(function () { return null; }),
            loadMethodBundle('dtg', style).catch(function () { return null; })
        ]).then(function () {
            btn.disabled = false; btn.innerHTML = label;
            if (!state.bundles.dtf && !state.bundles.dtg) {
                var e = $('protoError'); e.hidden = false; e.innerHTML = '<strong>No pricing to build a rate card for ' + esc(style) + '.</strong>';
                return;
            }
            buildRateCardSheet(style);
            window.print();
        });
    }

    // ---------- rendering ----------
    function renderMethod() {
        Array.prototype.forEach.call(document.querySelectorAll('#methodToggle button'), function (b) {
            b.classList.toggle('is-active', b.getAttribute('data-method') === state.method);
        });
    }
    function renderPrints() {
        var box = $('printsList');
        var lbl = $('printsLabel'), addBtn = $('addPrint');
        if (lbl) lbl.innerHTML = isScp() ? 'Locations <span class="muted">&middot; each priced by ink colors</span>' : isEmb() ? 'Logos <span class="muted">&middot; each priced by stitch count</span>' : 'Prints <span class="muted">&middot; each one priced by its size</span>';
        if (addBtn) addBtn.textContent = isScp() ? '+ Add location' : isEmb() ? '+ Add logo' : '+ Add print';
        if (isScp()) {
            box.innerHTML = state.prints.map(function (p, i) {
                var colors = scpColors(i);
                var loc = i === 0 ? 'Front' : (i === 1 ? 'Back' : 'Location ' + (i + 1));
                var cost = state.bundles.scp ? ('+' + fmt(scpLocRate(i)) + '/pc') : '';
                return '<div class="proto-print-row" data-i="' + i + '">'
                    + '<span class="proto-print-n">' + (i + 1) + '</span>'
                    + '<span class="proto-logo-role">' + loc + (i === 0 ? ' <span class="proto-flash">+ flash</span>' : '') + '</span>'
                    + '<input class="input proto-color-count" type="number" min="1" max="6" step="1" data-i="' + i + '" value="' + colors + '" aria-label="' + loc + ' ink colors">'
                    + '<span class="proto-logo-unit">color' + (colors === 1 ? '' : 's') + '</span>'
                    + '<span class="proto-print-cost">' + cost + '</span>'
                    + '<button type="button" class="proto-print-x" data-i="' + i + '" title="Remove this location" aria-label="Remove location ' + (i + 1) + '">×</button>'
                    + '</div>';
            }).join('') || '<p class="proto-empty">No locations yet &mdash; add one to see pricing.</p>';
            return;
        }
        if (isEmb()) {
            var cap = state.bundles.emb && state.bundles.emb.isCap;
            box.innerHTML = state.prints.map(function (p, i) {
                var st = (p.stitches != null) ? p.stitches : DEFAULT_STITCHES;
                var role = cap ? (i === 0 ? 'Cap front' : (i === 1 ? 'Cap back' : 'Cap loc ' + (i + 1))) : (i === 0 ? 'Primary logo' : 'Additional logo');
                var cost = state.bundles.emb ? ('+' + fmt(embLogoRate(i)) + '/pc') : '';
                return '<div class="proto-print-row" data-i="' + i + '">'
                    + '<span class="proto-print-n">' + (i + 1) + '</span>'
                    + '<span class="proto-logo-role">' + role + '</span>'
                    + '<input class="input proto-logo-stitch" type="number" min="0" step="500" data-i="' + i + '" value="' + st + '" aria-label="Logo ' + (i + 1) + ' stitch count">'
                    + '<span class="proto-logo-unit">stitches</span>'
                    + '<span class="proto-print-cost">' + cost + '</span>'
                    + '<button type="button" class="proto-print-x" data-i="' + i + '" title="Remove this logo" aria-label="Remove logo ' + (i + 1) + '">×</button>'
                    + '</div>';
            }).join('') || '<p class="proto-empty">No logos yet &mdash; add one to see pricing.</p>';
            return;
        }
        box.innerHTML = state.prints.map(function (p, i) {
            var sizeOpts = SIZE_LADDER.map(function (s) {
                var band = s[state.method], avail = !!band;
                var lbl = avail ? (s.label + ' (' + band + ')') : (s.label + ' — ' + onlyMethodLabel(s) + ' only');
                return '<option value="' + s.key + '"' + (s.key === p.size ? ' selected' : '') + (avail ? '' : ' disabled') + '>' + esc(lbl) + '</option>';
            }).join('');
            var cost = state.bundles[state.method] ? ('+' + fmt(displayRate(p.size)) + '/pc') : '';
            return '<div class="proto-print-row" data-i="' + i + '">'
                + '<span class="proto-print-n">' + (i + 1) + '</span>'
                + '<select class="input proto-print-size" data-i="' + i + '" aria-label="Print ' + (i + 1) + ' size">' + sizeOpts + '</select>'
                + '<span class="proto-print-cost">' + cost + '</span>'
                + '<button type="button" class="proto-print-x" data-i="' + i + '" title="Remove this print" aria-label="Remove print ' + (i + 1) + '">×</button>'
                + '</div>';
        }).join('') || '<p class="proto-empty">No prints yet &mdash; add one to see pricing.</p>';
    }
    function renderResult() {
        var box = $('result'), sub = $('resultSub');
        if (state.loading) { box.innerHTML = '<p class="proto-muted">Loading pricing…</p>'; sub.textContent = ''; return; }
        if (!state.bundles[state.method]) { box.innerHTML = ''; sub.textContent = 'Enter a style to begin'; return; }
        if (!state.prints.length) { box.innerHTML = '<p class="proto-muted">Add a ' + partNoun() + ' to see pricing.</p>'; sub.textContent = ''; return; }

        var res = priceAll();
        if (!res || res.error) { box.innerHTML = '<p class="proto-muted">' + esc((res && res.error) || 'Unable to price.') + '</p>'; return; }
        sub.textContent = 'for ' + state.qty + ' shirts · ' + esc(state.style) + ' · ' + METHODS[state.method].label;

        var rows = '<div class="proto-bd-row"><span>Blank + margin</span><span>' + fmt(res.blank) + '/pc</span></div>';
        res.parts.forEach(function (p) {
            rows += '<div class="proto-bd-row"><span>' + esc(p.label) + ' <span class="proto-band">' + esc(p.sub || '') + '</span></span>'
                + '<span>+' + fmt(p.rate) + '/pc</span></div>';
        });
        if (res.ltmPerShirt > 0) {
            rows += '<div class="proto-bd-row proto-ltm"><span>Small-batch fee ($' + res.ltmFlat + ' ÷ ' + state.qty + ' shirts)</span><span>+' + fmt(res.ltmPerShirt) + '/pc</span></div>';
        }
        rows += '<div class="proto-bd-row proto-total"><span>Price per shirt</span><span>' + fmt(res.perPiece) + '/pc</span></div>';

        var sb = sizeBreakdown(res);
        var sizesHtml = '';
        if (sb.ext.length) {
            sizesHtml = '<div class="proto-bd proto-sizes-sec"><div class="proto-sizes-head">Order by size</div>'
                + '<div class="proto-bd-row"><span>S–XL × ' + sb.stdCount + '</span><span>' + fmt(res.perPiece) + '/pc</span></div>';
            sb.ext.forEach(function (e) {
                sizesHtml += '<div class="proto-bd-row"><span>' + esc(e.size) + ' × ' + e.count + ' <span class="proto-band">+' + fmt(e.add) + ' blank</span></span><span>' + fmt(e.pp) + '/pc</span></div>';
            });
            sizesHtml += '<div class="proto-bd-row proto-total"><span>Order total</span><span>' + fmt(sb.orderTotal) + '</span></div>'
                + (sb.over ? '<p class="proto-ext-warn">Extended sizes exceed the quantity — raise the quantity.</p>' : '') + '</div>';
        }

        box.innerHTML = '<div class="proto-headline"><span class="proto-pp">' + fmt(res.perPiece) + '<span class="per">/pc</span></span>'
            + '<span class="proto-order">' + fmt(sb.orderTotal) + ' total</span></div>'
            + '<div class="proto-bd">' + rows + '</div>'
            + sizesHtml
            + '<p class="proto-round">' + (res.ltmPerShirt > 0
                ? 'Blank + each ' + partNoun() + ' are rounded to $0.50, so they add up by hand. The small-batch fee ($' + res.ltmFlat + ' ÷ ' + state.qty + ' shirts) is the one line with odd cents. The shirt price is all-in (tier ' + esc(res.tierLabel) + ').'
                : 'Blank + each ' + partNoun() + ' are rounded to $0.50, so the lines add up to the per-shirt price by hand — no separate rounding step (tier ' + esc(res.tierLabel) + ').'
              ) + (isEmb() ? ' <em>Live embroidery rounds to the whole dollar; this prototype uses $0.50 to match the print methods.</em>' : '') + '</p>';
    }
    function renderMatrix() {
        var box = $('protoMatrix'); if (!box) return;
        if (!state.bundles[state.method] || !state.prints.length) { box.innerHTML = ''; return; }
        var qtys = [12, 24, 48, 72];
        if (qtys.indexOf(state.qty) < 0) qtys.push(state.qty);
        qtys.sort(function (a, b) { return a - b; });
        var rows = qtys.map(function (q) { return { qty: q, r: priceAtQty(q) }; }).filter(function (x) { return x.r && !x.r.error; });
        if (!rows.length) { box.innerHTML = ''; return; }
        var parts0 = rows[0].r.parts;
        var head = '<th>Qty</th><th>Blank</th>' + parts0.map(function (p) { return '<th>' + esc(p.short) + '</th>'; }).join('') + '<th>Small-batch</th><th>Per shirt</th><th>Order</th>';
        var body = rows.map(function (x) {
            var r = x.r;
            var cells = '<td>' + x.qty + '</td><td>' + fmt(r.blank) + '</td>'
                + r.parts.map(function (p) { return '<td>+' + fmt(p.rate) + '</td>'; }).join('')
                + '<td>' + (r.ltmPerShirt > 0 ? '+' + fmt(r.ltmPerShirt) : '&mdash;') + '</td>'
                + '<td class="proto-mx-pp">' + fmt(r.perPiece) + '</td><td>' + fmt(r.orderTotal) + '</td>';
            return '<tr data-qty="' + x.qty + '"' + (x.qty === state.qty ? ' class="is-current"' : '') + '>' + cells + '</tr>';
        }).join('');
        box.innerHTML = '<div class="proto-matrix">'
            + '<div class="proto-matrix-head">Price by quantity <span class="muted">&middot; ' + esc(state.style) + ' &middot; ' + METHODS[state.method].label + ' &middot; your selected ' + partNoun() + 's' + '</span></div>'
            + '<div class="proto-mx-scroll"><table class="proto-mx-table"><thead><tr>' + head + '</tr></thead><tbody>' + body + '</tbody></table></div>'
            + '<p class="proto-mx-note">Each row is the full per-shirt build at that quantity &mdash; blank + each ' + partNoun() + ' + small-batch all add across. Click a row to make it the active quantity.</p>'
            + '</div>';
    }
    function renderEmbType() {
        var f = $('embTypeField'); if (!f) return;
        f.hidden = !isEmb();
        Array.prototype.forEach.call(document.querySelectorAll('#embTypeToggle button'), function (b) {
            b.classList.toggle('is-active', (b.getAttribute('data-embtype') === 'cap') === state.embCap);
        });
    }
    function renderExtSizes() {
        var toggle = $('extSizesToggle'), box = $('extSizes');
        if (!toggle || !box) return;
        var offered = state.bundles[state.method] ? extSizesOffered() : [];
        if (!offered.length) { toggle.hidden = true; box.hidden = true; box.innerHTML = ''; return; }
        toggle.hidden = false;
        toggle.textContent = (state.extSizesOpen ? '− ' : '+ ') + '2XL+ sizes (upcharges)';
        box.hidden = !state.extSizesOpen;
        if (!state.extSizesOpen) { box.innerHTML = ''; return; }
        box.innerHTML = '<p class="proto-ext-note">Allocate some of the ' + state.qty + ' to extended sizes — each adds its blank upcharge.</p>'
            + '<div class="proto-ext-grid">' + offered.map(function (sz) {
                var c = Math.max(0, parseInt(state.extSizes[sz], 10) || 0);
                return '<label class="proto-ext-cell"><span class="proto-ext-lbl">' + sz + ' <span class="muted">+' + fmt(addonFor(sz)) + '</span></span>'
                    + '<input class="input proto-ext-count" type="number" min="0" step="1" data-size="' + sz + '" value="' + c + '"></label>';
            }).join('') + '</div>';
    }
    function render() { renderMethod(); renderEmbType(); renderExtSizes(); renderPrints(); renderResult(); renderMatrix(); }

    // ---------- data load (lazy per method, cached) ----------
    function loadMethodBundle(method, style) {
        if (state.bundles[method] && state.bundleStyle[method] === style && !(method === 'emb' && state.bundles.emb.isCap !== state.embCap)) return Promise.resolve(state.bundles[method]);
        if (method === 'dtf') {
            return dtfSvc.fetchPricingData(style).then(function (d) {
                if (!d || !d.transferSizes || !d.transferSizes.small) throw new Error('No DTF pricing for ' + style);
                state.bundles.dtf = d; state.garment.dtf = baseGarment(d.raw && d.raw.sizes); state.bundleStyle.dtf = style;
                state.addons.dtf = (d.raw && d.raw.sellingPriceDisplayAddOns) || {}; return d;
            });
        }
        if (method === 'dtg') {
            return fetch(API + '/api/pricing-bundle?method=DTG&styleNumber=' + encodeURIComponent(style)).then(jsonOk).then(function (b) {
                if (!b || !b.allDtgCostsR || !b.allDtgCostsR.length) throw new Error('No DTG pricing for ' + style);
                state.bundles.dtg = b; state.garment.dtg = baseGarment(b.sizes); state.bundleStyle.dtg = style;
                state.addons.dtg = b.sellingPriceDisplayAddOns || {}; return b;
            });
        }
        if (method === 'scp') {
            return fetch(API + '/api/pricing-bundle?method=ScreenPrint&styleNumber=' + encodeURIComponent(style)).then(jsonOk).then(function (d) {
                if (!d || !d.allScreenprintCostsR || !d.tiersR) throw new Error('No screen-print pricing for ' + style);
                var bundle = {
                    garment: baseGarment(d.sizes),
                    flash: Number((d.rulesR || {}).FlashCharge) || 0.35,
                    tiers: d.tiersR.map(function (t) { return { label: t.TierLabel, min: t.MinQuantity, max: t.MaxQuantity, denom: Number(t.MarginDenominator), ltm: Number(t.LTM_Fee) || 0 }; }).sort(function (a, b) { return a.min - b.min; }),
                    costs: d.allScreenprintCostsR.map(function (c) { return { CostType: c.CostType, TierLabel: c.TierLabel, ColorCount: Number(c.ColorCount), Ed_Cost: Number(c.Ed_Cost) }; })
                };
                state.bundles.scp = bundle; state.garment.scp = bundle.garment; state.bundleStyle.scp = style;
                state.addons.scp = d.sellingPriceDisplayAddOns || {}; return bundle;
            });
        }
        // emb — garment OR cap. cap = CAP + CAP-AL bundles (ItemType Cap / AL-CAP, AL base 5K @ $1/1K);
        // garment = EMB + EMB-AL (ItemType Shirt / AL, AL base 8K @ $1.25/1K). Same structure either way.
        var cap = state.embCap;
        var costMethod = cap ? 'CAP' : 'EMB', alMethod = cap ? 'CAP-AL' : 'EMB-AL';
        var baseType = cap ? 'Cap' : 'Shirt', alType = cap ? 'AL-CAP' : 'AL';
        var asType = cap ? 'AS-Cap' : 'AS-Garm', alBaseStitch = cap ? 5000 : 8000, alRate = cap ? 1 : 1.25;
        return Promise.all([
            fetch(API + '/api/pricing-bundle?method=' + costMethod + '&styleNumber=' + encodeURIComponent(style)).then(jsonOk),
            fetch(API + '/api/pricing-bundle?method=' + alMethod + '&styleNumber=' + encodeURIComponent(style)).then(jsonOk).catch(function () { return null; })
        ]).then(function (res) {
            var emb = res[0], al = res[1];
            if (!emb || !emb.allEmbroideryCostsR || !emb.tiersR) throw new Error('No ' + (cap ? 'cap ' : '') + 'embroidery pricing for ' + style);
            var costs = emb.allEmbroideryCostsR;
            var embBase = {};
            costs.filter(function (c) { return c.ItemType === baseType; }).forEach(function (c) { embBase[c.TierLabel] = Number(c.EmbroideryCost); });
            var mid = costs.find(function (c) { return c.ItemType === asType && c.TierLabel === 'Mid'; });
            var large = costs.find(function (c) { return c.ItemType === asType && c.TierLabel === 'Large'; });
            var surcharge = [
                { max: 10000, fee: 0 },
                { max: 15000, fee: mid ? Number(mid.EmbroideryCost) : 4 },
                { max: 25000, fee: large ? Number(large.EmbroideryCost) : 10 }
            ];
            var alMap = {};
            ((al && al.allEmbroideryCostsR) || []).filter(function (c) { return c.ItemType === alType; }).forEach(function (c) {
                alMap[c.TierLabel] = { base: Number(c.EmbroideryCost), baseStitch: Number(c.BaseStitchCount) || alBaseStitch, rate: Number(c.AdditionalStitchRate) || alRate };
            });
            var bundle = {
                isCap: cap,
                garment: baseGarment(emb.sizes),
                tiers: emb.tiersR.map(function (t) { return { label: t.TierLabel, min: t.MinQuantity, max: t.MaxQuantity, denom: Number(t.MarginDenominator), ltm: Number(t.LTM_Fee) || 0 }; }).sort(function (a, b) { return a.min - b.min; }),
                embBase: embBase, surcharge: surcharge, al: alMap
            };
            state.bundles.emb = bundle; state.garment.emb = bundle.garment; state.bundleStyle.emb = style;
            state.addons.emb = emb.sellingPriceDisplayAddOns || {}; return bundle;
        });
    }
    function ensureBundle() {
        var m = state.method, style = (state.style || '').trim().toUpperCase();
        $('protoError').hidden = true;
        if (!style) { state.bundles[m] = null; render(); return; }
        if (state.bundles[m] && state.bundleStyle[m] === style && !(m === 'emb' && state.bundles.emb.isCap !== state.embCap)) { render(); return; }
        state.loading = true; $('styleStatus').textContent = 'Loading…'; renderResult();
        loadMethodBundle(m, style).then(function () {
            if ((state.style || '').trim().toUpperCase() !== style || state.method !== m) return;
            state.loading = false;
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
            if (m === 'dtf' || m === 'dtg') state.prints.forEach(function (p) { p.size = clampSize(p.size); }); // keep sizes valid for print methods
            if (m === 'emb') state.embCap = isCapStyle(state.style); // auto-detect cap vs garment on switch
            ensureBundle();
        });
        $('embTypeToggle').addEventListener('click', function (e) {
            var b = e.target.closest('button'); if (!b) return;
            var cap = b.getAttribute('data-embtype') === 'cap';
            if (cap === state.embCap) return;
            state.embCap = cap; state.bundles.emb = null; // force reload of the cap/garment variant
            ensureBundle();
        });
        $('style').addEventListener('input', function (e) { state.style = e.target.value; if (isEmb()) state.embCap = isCapStyle(state.style); ensureBundleDebounced(); });
        $('qty').addEventListener('input', function (e) { state.qty = Math.max(1, parseInt(e.target.value, 10) || 1); render(); });
        Array.prototype.forEach.call(document.querySelectorAll('.qq-qty-presets button'), function (b) {
            b.addEventListener('click', function () { state.qty = parseInt(b.getAttribute('data-qty'), 10); $('qty').value = state.qty; render(); });
        });
        $('addPrint').addEventListener('click', function () {
            state.prints.push({ size: clampSize('small'), stitches: DEFAULT_STITCHES, colors: 1 });
            render();
        });
        $('printsList').addEventListener('change', function (e) {
            var i = parseInt(e.target.getAttribute('data-i'), 10);
            if (isNaN(i) || !state.prints[i]) return;
            if (e.target.classList.contains('proto-print-size')) { state.prints[i].size = e.target.value; render(); }
        });
        // live stitch / color update — patch the row's cost + results WITHOUT re-rendering the input (keeps focus)
        $('printsList').addEventListener('input', function (e) {
            var i = parseInt(e.target.getAttribute('data-i'), 10);
            if (isNaN(i) || !state.prints[i]) return;
            var liveRate = null;
            if (e.target.classList.contains('proto-logo-stitch')) {
                state.prints[i].stitches = Math.max(0, parseInt(e.target.value, 10) || 0); liveRate = embLogoRate(i);
            } else if (e.target.classList.contains('proto-color-count')) {
                state.prints[i].colors = Math.min(6, Math.max(1, parseInt(e.target.value, 10) || 1)); liveRate = scpLocRate(i);
            } else { return; }
            var row = e.target.closest('.proto-print-row');
            var costSpan = row && row.querySelector('.proto-print-cost');
            if (costSpan && state.bundles[state.method]) costSpan.textContent = '+' + fmt(liveRate) + '/pc';
            renderResult(); renderMatrix();
        });
        $('printsList').addEventListener('click', function (e) {
            if (!e.target.classList.contains('proto-print-x')) return;
            var i = parseInt(e.target.getAttribute('data-i'), 10);
            if (!isNaN(i)) { state.prints.splice(i, 1); render(); }
        });
        $('protoMatrix').addEventListener('click', function (e) {
            var tr = e.target.closest('tr[data-qty]'); if (!tr) return;
            var q = parseInt(tr.getAttribute('data-qty'), 10);
            if (!isNaN(q)) { state.qty = q; $('qty').value = q; render(); }
        });
        $('rateCardBtn').addEventListener('click', downloadRateCard);
        $('extSizesToggle').addEventListener('click', function () { state.extSizesOpen = !state.extSizesOpen; renderExtSizes(); });
        $('extSizes').addEventListener('input', function (e) {
            if (!e.target.classList.contains('proto-ext-count')) return;
            var sz = e.target.getAttribute('data-size');
            state.extSizes[sz] = Math.max(0, parseInt(e.target.value, 10) || 0);
            renderResult(); // live (don't re-render the inputs → keep focus)
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
