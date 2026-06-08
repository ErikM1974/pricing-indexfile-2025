/**
 * quote-order-summary.js — Shared "order at a glance" band for the NWCA quote builders.
 *
 * Renders the Order Recap (#order-recap) + Ship-To card (#ship-to-card) that sit in the
 * `.invoice-totals-wrap` band, LEFT of the totals box. Extracted from embroidery-quote-builder.js
 * (2026-06-08, Phase 0 of the DTF/SCP parity) so EMB, DTF, and SCP share ONE implementation.
 *
 * SELECTOR-AGNOSTIC: each builder calls QuoteOrderSummary.configure(cfg) once with a map of CSS
 * selectors — id-based for EMB/DTF ('#ship-zip'), class-based for SCP ('.os-ship-zip') — plus
 * content callbacks (logos, estimate). Every read/write goes through cfg, so the same code serves
 * all three. EMB output is byte-identical to the pre-extraction private functions (regression-locked
 * by tests/unit/quote-order-summary.test.js).
 *
 * Usage:
 *   QuoteOrderSummary.configure({
 *     orderRecap: '#order-recap', shipToCard: '#ship-to-card',
 *     ship:  { address, city, state, zip, method, fee, residential },          // selectors
 *     recap: { company, name, custNum, shippingDisplay, logos: () => [{text, thumbUrl, label}] },
 *     estimate: () => Promise|null,                     // re-estimate handler (optional)
 *     reestimateOnclick: 'reestimateShipFromCard()',    // Re-estimate button onclick
 *     editOnclick: 'openShippingModal()',               // omit to hide the Edit button
 *   });
 *   QuoteOrderSummary.renderOrderRecap();   // also aliased to window.renderOrderRecap
 *
 * MUST load BEFORE the per-builder *-quote-builder.js (which calls configure() at eval time).
 */
(function (global) {
    'use strict';
    var _cfg = null;

    var esc = function (s) {
        return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
            return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c];
        });
    };
    function _el(sel) { try { return sel ? global.document.querySelector(sel) : null; } catch (_) { return null; } }
    function _val(sel) {
        var e = _el(sel);
        if (!e) return '';
        var v = (e.value != null) ? e.value : (e.textContent || '');
        return String(v).trim();
    }

    function configure(cfg) { _cfg = cfg || null; }

    // Selector-agnostic ship-field accessor — the linchpin that lets one band serve #ship-* AND .os-ship-*.
    function getShipFields() {
        var s = (_cfg && _cfg.ship) || {};
        var resEl = s.residential ? _el(s.residential) : null;
        return {
            address: _val(s.address),
            city: _val(s.city),
            state: _val(s.state),
            zip: _val(s.zip),
            method: _val(s.method),
            fee: parseFloat(_val(s.fee)) || 0,
            residential: !!(resEl && resEl.checked),
        };
    }

    function renderShipToCard() {
        if (!_cfg) return;
        var el = _el(_cfg.shipToCard || '#ship-to-card');
        if (!el) return;
        var f = getShipFields();
        var isPickup = /pickup|will[\s-]?call/i.test(f.method);
        if (isPickup || !(f.address || f.city || f.zip)) { el.innerHTML = ''; return; }  // hidden for pickup / no address
        var company = _val((_cfg.recap && _cfg.recap.company) || '#company-name');
        var cityLine = ([f.city, f.state].filter(Boolean).join(', ') + (f.zip ? ' ' + f.zip : '')).trim();
        var lines = [];
        if (company) lines.push('<div class="st-line st-co">' + esc(company) + '</div>');
        if (f.address) lines.push('<div class="st-line">' + esc(f.address) + '</div>');
        if (cityLine) lines.push('<div class="st-line">' + esc(cityLine) + '</div>');
        // shipping line: method · charge · (boxes/zone — ONLY when the charge IS still the estimate, not a manual override)
        var est = global._lastShipEstimate;
        var shipLine = esc(f.method || 'UPS Ground');
        if (f.fee > 0) shipLine += ' &middot; $' + f.fee.toFixed(2);
        if (est && Math.abs((est.estimate || 0) - f.fee) < 0.01 && est.boxes) {
            shipLine += ' &middot; ' + est.boxes + ' box' + (est.boxes > 1 ? 'es' : '') + ' &middot; zone ' + esc(String(est.zone));
        }
        lines.push('<div class="st-line st-method">' + shipLine + '</div>');
        // Re-estimate renders ONLY when the builder supplied an estimator (EMB has one; DTF/SCP not until Phase 1).
        // Edit renders only when editOnclick is set. If neither, omit the .st-actions wrapper (no empty bar).
        var acts = '';
        if (typeof _cfg.estimate === 'function') {
            var reestOnclick = _cfg.reestimateOnclick || 'reestimateShipFromCard()';
            acts += '<button type="button" class="st-btn st-btn-reest" onclick="' + reestOnclick + '" title="Re-run the UPS estimate for this address + the current item weight"><i class="fas fa-rotate"></i> Re-estimate</button>';
        }
        if (_cfg.editOnclick) {
            acts += '<button type="button" class="st-btn st-btn-edit" onclick="' + _cfg.editOnclick + '" title="Edit the ship-to address / method / charge"><i class="fas fa-pen"></i> Edit</button>';
        }
        var actions = acts ? '<div class="st-actions">' + acts + '</div>' : '';
        el.innerHTML = '<div class="st-title">Ship To</div>' + lines.join('') + actions;
    }

    // Re-estimate shipping in place from the Ship-To card (no modal). MANUAL only — never auto (would
    // clobber a rep's hand-tuned charge). Gives button feedback, runs the builder's estimate(), re-renders.
    function reestimateShipFromCard() {
        var card = _el((_cfg && _cfg.shipToCard) || '#ship-to-card');
        var btn = card ? card.querySelector('.st-btn-reest') : null;
        if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Estimating…'; }
        var done = function () { renderShipToCard(); };
        try {
            var p = (_cfg && typeof _cfg.estimate === 'function') ? _cfg.estimate() : null;
            if (p && typeof p.then === 'function') { return p.then(done, done); }
        } catch (_) {}
        done();
    }

    function renderOrderRecap() {
        if (!_cfg) return;
        var el = _el(_cfg.orderRecap || '#order-recap');
        if (!el) return;
        var r = _cfg.recap || {};
        var company = _val(r.company || '#company-name');
        var name = _val(r.name || '#customer-name');
        var custNum = _val(r.custNum || '#customer-number');
        var ship = _val(r.shippingDisplay || '#it-shipping-amt');
        // Logos + thumbnails come from the builder's callback (EMB supplies them; DTF/SCP return []).
        var logos = [], thumbs = [];
        try {
            if (typeof r.logos === 'function') {
                var out = r.logos() || [];
                for (var i = 0; i < out.length; i++) {
                    var x = out[i];
                    if (!x) continue;
                    if (x.text) logos.push(x.text);
                    if (x.thumbUrl) thumbs.push({ url: x.thumbUrl, label: x.label || x.text || '' });
                }
            }
        } catch (_) {}
        var cust = company || name;
        var rows = [];
        if (cust) rows.push('<div class="or-row"><span class="or-label">Customer</span><span class="or-val">' + esc(cust) + (custNum ? ' · #' + esc(custNum) : '') + '</span></div>');
        if (ship) rows.push('<div class="or-row"><span class="or-label">Shipping</span><span class="or-val">' + esc(ship) + '</span></div>');  // #it-shipping-amt is a charge/method, not a destination
        if (logos.length) rows.push('<div class="or-row"><span class="or-label">Logo' + (logos.length > 1 ? 's' : '') + '</span><span class="or-val">' + esc(logos.join('   ·   ')) + '</span></div>');
        if (thumbs.length) rows.push('<div class="or-thumbs">' + thumbs.map(function (t) {
            return '<figure class="or-thumb"><img src="' + esc(t.url) + '" alt="' + esc(t.label) + '" loading="lazy" onerror="this.closest(\'.or-thumb\').style.display=\'none\'"><figcaption>' + esc(t.label) + '</figcaption></figure>';
        }).join('') + '</div>');
        el.innerHTML = rows.length ? '<div class="or-title">Order at a glance</div>' + rows.join('') : '';
        renderShipToCard();  // keep the ship-to card in sync with the glance panel
    }

    global.QuoteOrderSummary = {
        configure: configure,
        getShipFields: getShipFields,
        renderOrderRecap: renderOrderRecap,
        renderShipToCard: renderShipToCard,
        reestimateShipFromCard: reestimateShipFromCard,
    };
    // Back-compat globals — existing bare call sites + inline onclick keep working unchanged.
    global.renderOrderRecap = renderOrderRecap;
    global.renderShipToCard = renderShipToCard;
    global.reestimateShipFromCard = reestimateShipFromCard;

    // CommonJS export for the jest regression lock (no-op in the browser).
    if (typeof module !== 'undefined' && module.exports) { module.exports = global.QuoteOrderSummary; }
})(typeof window !== 'undefined' ? window : this);
