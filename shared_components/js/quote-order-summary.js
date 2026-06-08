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

    function configure(cfg) {
        _cfg = cfg || null;
        // Auto-point the ship-to card's Re-estimate button at the module estimator when a builder supplies
        // estimateHooks (so each builder doesn't re-wire _cfg.estimate). EMB may still set its own.
        if (_cfg && _cfg.estimateHooks && typeof _cfg.estimate !== 'function') {
            _cfg.estimate = function () { return estimateShipping(); };
        }
    }

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

    // ============================================================
    // Shipping estimator (UPS Ground prepay) — extracted from embroidery-quote-builder.js (2026-06-08, Commit 4).
    // perBoxForCategory + the box-consolidation loop are LIFTED BYTE-FOR-BYTE — validated against real ShopWorks/UPS
    // invoices (2026-06-07). DO NOT edit the math; only the I/O boundary (zip/fee/residential via getShipFields,
    // products via _cfg.estimateHooks.collectProducts, fee write via _cfg.ship.fee, post-apply via onApplied) is
    // parameterized so EMB/DTF/SCP share ONE estimator.
    // ============================================================
    function _apiBase() {
        return (_cfg && _cfg.apiBase)
            || (global.APP_CONFIG && global.APP_CONFIG.API && global.APP_CONFIG.API.BASE_URL)
            || 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';
    }
    function _hasEstimator() { return !!(_cfg && _cfg.estimateHooks); }

    function perBoxForCategory(avgWtLb, caseSize, catName) {
        const m = window._boxDensity || {};
        const c = String(catName || '').toLowerCase();
        if (c) {
            if (c.includes('cap') || c.includes('hat') || c.includes('headwear') || c.includes('beanie')) return m.Cap || 60;
            if (c.includes('outerwear') || c.includes('jacket') || c.includes('vest')) {
                return avgWtLb >= 1.7 ? (m.Outerwear || 15) : (m.Jacket || 17);
            }
            if (c.includes('sweatshirt') || c.includes('fleece') || c.includes('hood')) return m.Sweatshirt || m.Hoodie || 16;
            if (c.includes('polo') || c.includes('knit') || c.includes('woven') || c.includes('dress shirt')) return m.Polo || 36;
            if (c.includes('t-shirt') || c.includes('tee') || c.includes('tank')) return m['T-Shirt'] || 58;
        }
        if (caseSize >= 100) return m.Cap || 60;
        if (avgWtLb >= 1.7) return m.Outerwear || 15;
        if (avgWtLb >= 1.0) return m.Jacket || m.Sweatshirt || 16;
        if (avgWtLb >= 0.5) return m.Polo || 36;
        return m['T-Shirt'] || 58;
    }

    async function estimateShipping() {
        var hooks = (_cfg && _cfg.estimateHooks) || {};
        var btn = hooks.btn ? _el(hooks.btn) : null;
        var resultEl = hooks.result ? _el(hooks.result) : null;
        var setMsg = function (msg, color) { if (resultEl) { resultEl.innerHTML = msg; resultEl.style.color = color || '#64748b'; } };
        var f = getShipFields();
        var zip = f.zip;
        if (!zip) return setMsg('Enter the ship-to ZIP first.', '#dc2626');
        var products = (typeof hooks.collectProducts === 'function') ? (hooks.collectProducts() || []) : [];
        products = products.filter(function (p) { return p && p.style && !p.isService; });  // p.style guards SCP service/fee rows (no isService flag); !isService matches EMB
        if (products.length === 0) return setMsg('Add products first.', '#dc2626');
        var API_BASE = _apiBase();

        if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Estimating…'; }
        try {
            if (!window._boxDensity) {
                try { const dr = await fetch(`${API_BASE}/api/shipping/box-density`); if (dr.ok) window._boxDensity = (await dr.json()).density || {}; } catch (e) { window._boxDensity = {}; }
            }
            window._shipWtCache = window._shipWtCache || {};
            let totalWeightLb = 0, boxEquivalents = 0, usedFallback = false;
            for (const p of products) {
                const style = p.style;
                const sizes = p.sizeBreakdown || {};
                if (!window._shipWtCache[style]) {
                    try {
                        const r = await fetch(`${API_BASE}/api/inventory?styleNumber=${encodeURIComponent(style)}`);
                        const data = r.ok ? await r.json() : [];
                        const rows = Array.isArray(data) ? data : (data.rows || data.Result || data.data || []);
                        const bySize = {};
                        let category = '';
                        rows.forEach(row => {
                            const sz = row.SIZE || row.size || row.Size;
                            if (sz && bySize[sz] === undefined) {
                                bySize[sz] = { wt: parseFloat(row.PIECE_WEIGHT) || 0, casePack: parseInt(row.CASE_SIZE) || 0 };
                            }
                            if (!category) category = row.CATEGORY_NAME || row.category || '';
                        });
                        window._shipWtCache[style] = { bySize, category };
                    } catch (e) { window._shipWtCache[style] = { bySize: {}, category: '' }; }
                }
                const { bySize, category } = window._shipWtCache[style];
                let prodQty = 0, prodWt = 0, maxCase = 0;
                for (const [size, qty] of Object.entries(sizes)) {
                    const meta = bySize[size] || bySize[String(size).toUpperCase()] || Object.values(bySize)[0];
                    const wt = (meta && meta.wt) || 0.5;
                    if (!meta) usedFallback = true;
                    const q = parseInt(qty) || 0;
                    totalWeightLb += wt * q;
                    prodQty += q;
                    prodWt += wt * q;
                    if (meta && meta.casePack) maxCase = Math.max(maxCase, meta.casePack);
                }
                const avgWt = prodQty > 0 ? prodWt / prodQty : 0.5;
                const ppb = perBoxForCategory(avgWt, maxCase, category);
                if (prodQty > 0 && ppb > 0) boxEquivalents += prodQty / ppb;
            }
            const totalBoxes = Math.max(1, Math.ceil(boxEquivalents));
            const boxWeightsLb = Array.from({ length: totalBoxes }, () => totalWeightLb / totalBoxes);
            const resp = await fetch(`${API_BASE}/api/shipping/estimate-ups-ground`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ toZip: zip, weightLb: totalWeightLb, boxes: totalBoxes, boxWeightsLb, residential: !!f.residential })
            });
            if (!resp.ok) throw new Error('estimate endpoint ' + resp.status);
            const est = await resp.json();
            var feeEl = (_cfg && _cfg.ship && _cfg.ship.fee) ? _el(_cfg.ship.fee) : null;
            if (feeEl) { feeEl.value = Number(est.estimate).toFixed(2); }
            if (typeof hooks.onApplied === 'function') hooks.onApplied();
            window._lastShipEstimate = { estimate: Number(est.estimate) || 0, boxes: est.boxes, zone: est.zone, weight: est.billableWeightLb };
            renderShipToCard();
            setMsg(`&approx; <strong>$${Number(est.estimate).toFixed(2)}</strong> UPS Ground &middot; ${est.billableWeightLb} lb &middot; ${est.boxes} box${est.boxes > 1 ? 'es' : ''} &middot; zone ${est.zone}${usedFallback ? ' <span style="color:#d97706;">(some weights estimated)</span>' : ''} <span style="color:#94a3b8;">— ${est.basis === 'list' ? 'UPS list rate' : ('est. cost +' + Math.round((est.markupPct || 0) * 100) + '% handling')}${est.rough ? ' · approx zone' : ''}, adjust as needed</span>`, '#166534');
        } catch (e) {
            console.error('[estimateShipping]', e);
            setMsg('Could not estimate shipping — enter it manually.', '#dc2626');
        } finally {
            if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-truck-fast"></i> Estimate UPS Ground'; }
        }
    }

    function openShippingModal() {
        var sel = (_cfg && _cfg.shippingModal) || '#shipping-modal';
        var m = _el(sel); if (m) m.classList.add('open');
    }
    function closeShippingModal() {
        var sel = (_cfg && _cfg.shippingModal) || '#shipping-modal';
        var m = _el(sel); if (m) m.classList.remove('open');
        var hooks = (_cfg && _cfg.estimateHooks) || {};
        if (typeof hooks.onModalClose === 'function') hooks.onModalClose();
        renderShipToCard();
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
        estimateShipping: estimateShipping,
        openShippingModal: openShippingModal,
        closeShippingModal: closeShippingModal,
        _hasEstimator: _hasEstimator,
    };
    // Back-compat globals — existing bare call sites + inline onclick keep working unchanged.
    global.renderOrderRecap = renderOrderRecap;
    global.renderShipToCard = renderShipToCard;
    global.reestimateShipFromCard = reestimateShipFromCard;
    // estimateShipping / openShippingModal / closeShippingModal are invoked from inline onclick= strings
    // (EMB modal + Estimate button), so they MUST be globals.
    global.estimateShipping = estimateShipping;
    global.openShippingModal = openShippingModal;
    global.closeShippingModal = closeShippingModal;

    // CommonJS export for the jest regression lock (no-op in the browser).
    if (typeof module !== 'undefined' && module.exports) { module.exports = global.QuoteOrderSummary; }
})(typeof window !== 'undefined' ? window : this);
