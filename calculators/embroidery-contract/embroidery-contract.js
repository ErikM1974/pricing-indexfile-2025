/* =====================================================
   CONTRACT EMBROIDERY CALCULATOR — Editorial UI
   ----------------------------------------------------------
   Round 7 (2026-05-14) — Rewritten to drive the new editorial
   layout extracted from the Claude Designer mockup. Same data
   pipeline as Round 6 (fetches /api/contract-pricing, runs
   the per-1K-stitch × tier math), but the UI is now:

     · Segmented item type picker (3 buttons, not a <select>)
     · Quantity input + 6 preset chips
     · Stitch count input + product-specific preset chips
     · 72px serif hero unit-price + tier badge
     · Subtotal / LTM / Order Total cards
     · Tabbed pricing tables (Garment / Cap / Full Back) with
       LIVE highlighting — active tier column + current stitch
       row + intersection cell rendered as solid pink with
       white text. This is the killer feature: reps see
       exactly which cell their quote came from.
     · Copy Quote Link (URL with ?type=&qty=&stitches=) and
       Copy Quote Text (formatted summary).

   URL param names kept from Round 6 (?type=&qty=&stitches=)
   so existing share-links keep working. Also accepts the
   Designer prototype's shorter names (?p=&q=&s=) as aliases.

   Pure browser JS (no ES modules, no React, no Babel) —
   keeps the page lean and the dependency surface tiny.
   ===================================================== */

(function () {
    'use strict';

    var API_BASE_URL = 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';

    /* ---------------------- Constants ---------------------- */

    var TIER_ORDER = ['1-7', '8-23', '24-47', '48-71', '72+'];
    var TIER_LABELS = ['1–7', '8–23', '24–47', '48–71', '72+'];

    var QTY_PRESETS = [12, 24, 48, 72, 144, 288];
    var STITCH_PRESETS_GARMENT = [4000, 6000, 8000, 10000, 12000, 15000];
    var STITCH_PRESETS_FULLBACK = [25000, 30000, 40000, 50000];

    // 1K increments from 8K-20K covers the realistic range for most contract
    // logos. Round 9 (2026-05-14) — was [8K,10K,12K,14K,16K,18K,20K,25K] in 2K
    // steps; tighter precision matches reality (logos rarely land on 2K boundaries).
    var CONTRACT_STITCH_COUNTS = [8000, 9000, 10000, 11000, 12000, 13000, 14000, 15000, 16000, 17000, 18000, 19000, 20000];
    // Round 9b (2026-05-14): expanded to 1K increments to match the new
    // contract garment table precision. Most jacket-back / full-back designs
    // are 25K-35K with the occasional outlier — 26 rows give reps 1K
    // resolution across the entire range without forcing them to interpolate.
    var FB_STITCH_COUNTS = [
        25000, 26000, 27000, 28000, 29000, 30000,
        31000, 32000, 33000, 34000, 35000,
        36000, 37000, 38000, 39000, 40000,
        41000, 42000, 43000, 44000, 45000,
        46000, 47000, 48000, 49000, 50000
    ];

    var PRODUCT_META = {
        garment:  {
            label: 'Garment',     code: 'CTR-Garmt',
            title: 'Contract Garments',
            subtitle: 'Flat embroidery on shirts, jackets, bags & soft goods',
            iconSvg: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 4l3-2 3 1 3-1 3 2 3 4-3 2-1-1v12H7V9L6 10 3 8z"/></svg>',
            stitchCounts: CONTRACT_STITCH_COUNTS,
            stitchPresets: STITCH_PRESETS_GARMENT,
            minStitches: 8000,
        },
        cap:      {
            // Round 10 (2026-05-14): renamed from "Cap Front" to "Cap" — the
            // CTR-Cap part covers ANY single panel on a cap (front, back,
            // or side). Same per-1K rate regardless of panel. Subtitle makes
            // the scope explicit so reps don't think one charge covers a
            // multi-panel cap (it doesn't — pricing is per panel).
            label: 'Cap',   code: 'CTR-Cap',
            title: 'Contract Caps',
            subtitle: 'Embroidery on any cap panel — front, back, or side',
            iconSvg: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 16h18l-2-2H5z"/><path d="M5 14c0-4.5 3-7 7-7s7 2.5 7 7"/><path d="M12 7V4"/></svg>',
            stitchCounts: CONTRACT_STITCH_COUNTS,
            stitchPresets: STITCH_PRESETS_GARMENT,
            minStitches: 8000,
        },
        fullback: {
            label: 'Full Back',   code: 'DECG-FB',
            title: 'Full Back Embroidery',
            subtitle: 'Large back designs — 25K minimum stitches',
            iconSvg: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/></svg>',
            stitchCounts: FB_STITCH_COUNTS,
            stitchPresets: STITCH_PRESETS_FULLBACK,
            minStitches: 25000,
            minCharge: 20.00,
        },
    };

    /* ---------------------- State ---------------------- */

    var pricing = null;   // populated by /api/contract-pricing
    var state = {
        product: 'garment',
        qty: 24,
        stitches: 8000,
        tableProduct: 'garment',  // which table tab is active (independent of calculator product)
    };

    /* ---------------------- Helpers ---------------------- */

    function fmtMoney(n) {
        if (n == null || isNaN(n)) return '0.00';
        return Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    function fmtInt(n) { return Number(n || 0).toLocaleString('en-US'); }

    function tierIndexForQty(qty) {
        if (qty <= 7)  return 0;
        if (qty <= 23) return 1;
        if (qty <= 47) return 2;
        if (qty <= 71) return 3;
        return 4;
    }

    function getRatesFor(product) {
        if (!pricing) return null;
        if (product === 'fullback') return pricing.fullBack && pricing.fullBack.perThousandRates;
        if (product === 'cap')      return pricing.caps     && pricing.caps.perThousandRates;
        return pricing.garments && pricing.garments.perThousandRates;
    }

    function computeUnit(product, qty, stitchCount) {
        var rates = getRatesFor(product);
        if (!rates) return null;
        var idx = tierIndexForQty(qty);
        var tier = TIER_ORDER[idx];
        var rate = rates[tier];
        if (rate == null) return null;
        var kStitches = stitchCount / 1000;
        var unit = rate * kStitches;
        var minChargeApplied = false;
        if (product === 'fullback') {
            var minPrice = (pricing.fullBack && pricing.fullBack.minPrice) || 20.00;
            if (unit < minPrice) { unit = minPrice; minChargeApplied = true; }
        }
        return { unit: unit, rate: rate, kStitches: kStitches, tierIdx: idx, tier: tier, minChargeApplied: minChargeApplied };
    }

    /**
     * Calculate unit price with LTM fee built into the per-piece price.
     * Matches the convention in embroidery-pricing-all.js calculateUnitPriceWithLTM
     * (and every other NWCA pricing surface) — for orders at/below the LTM
     * threshold, divide the flat LTM fee across the pieces and add to per-piece.
     * Reps see ONE all-in unit price; ShopWorks gets one line item instead of
     * a separate "LTM" line.
     */
    function calculateUnitPriceWithLTM(baseUnitPrice, quantity, ltmThreshold, ltmFee) {
        if (quantity > 0 && quantity <= ltmThreshold) {
            var ltmPerPiece = ltmFee / quantity;
            return {
                finalUnitPrice: baseUnitPrice + ltmPerPiece,
                baseUnitPrice: baseUnitPrice,
                ltmPerPiece: ltmPerPiece,
                ltmFee: ltmFee,
                hasLtm: true
            };
        }
        return {
            finalUnitPrice: baseUnitPrice,
            baseUnitPrice: baseUnitPrice,
            ltmPerPiece: 0,
            ltmFee: 0,
            hasLtm: false
        };
    }

    /* ---------------------- Data fetch ---------------------- */

    function fetchContractPricing() {
        return fetch(API_BASE_URL + '/api/contract-pricing')
            .then(function (r) {
                if (!r.ok) throw new Error('Contract pricing API error: ' + r.status);
                return r.json();
            })
            .then(function (data) {
                return {
                    garments: data.garments,
                    caps: data.caps,
                    fullBack: {
                        perThousandRates: data.fullBack.perThousandRates,
                        minStitches: data.fullBack.minStitches || 25000,
                        minPrice: data.fullBack.minPrice || 20.00
                    },
                    ltmFee: data.ltmFee || 50,
                    ltmThreshold: data.ltmThreshold || 23
                };
            });
    }

    /* ---------------------- Calculator render ---------------------- */

    function renderCalculator() {
        var p = PRODUCT_META[state.product];
        var calc = computeUnit(state.product, state.qty, state.stitches);

        // Round 8 (2026-05-14): roll LTM into the per-piece price the same way
        // every other NWCA calculator does. Reps see ONE all-in unit price —
        // no separate "LTM fee" line in the totals, no extra ShopWorks invoice
        // row. The pricing tables still show base rates; the LTM warning
        // chip under the qty input bridges the gap.
        var ltmThreshold = pricing ? pricing.ltmThreshold : 23;
        var ltmFeeBase = state.product === 'fullback' ? 100 : (pricing ? pricing.ltmFee : 50);
        var baseUnit = calc ? calc.unit : 0;
        var ltmCalc = calculateUnitPriceWithLTM(baseUnit, state.qty, ltmThreshold, ltmFeeBase);
        var orderTotal = ltmCalc.finalUnitPrice * state.qty;

        // Result panel — header + hero price (now all-in)
        document.getElementById('resProductLabel').textContent = p.label;
        if (calc) {
            document.getElementById('resTier').textContent = 'Tier ' + TIER_LABELS[calc.tierIdx];
            document.getElementById('unitPrice').textContent = fmtMoney(ltmCalc.finalUnitPrice);
            // Sub-line — show the rate breakdown, plus LTM math when it applies
            var subText = (state.stitches / 1000).toFixed(0) + 'K × <b>$' + calc.rate.toFixed(2) + '/1K</b>';
            if (calc.minChargeApplied) subText += ' · min charge applied';
            if (ltmCalc.hasLtm) {
                subText += ' · incl. $' + fmtMoney(ltmCalc.ltmFee) + ' LTM ÷ ' + state.qty +
                    ' = <b>+$' + fmtMoney(ltmCalc.ltmPerPiece) + '/pc</b>';
            }
            document.getElementById('unitSub').innerHTML = subText;
        } else {
            document.getElementById('resTier').textContent = '—';
            document.getElementById('unitPrice').textContent = '—';
            document.getElementById('unitSub').innerHTML = 'Pricing unavailable';
        }

        // Single Order Total card (replaces Subtotal + LTM cards)
        document.getElementById('orderTotal').textContent = '$' + fmtMoney(orderTotal);
        var orderTotalNote = document.getElementById('orderTotalNote');
        if (orderTotalNote) {
            orderTotalNote.textContent = fmtInt(state.qty) + ' × $' + fmtMoney(ltmCalc.finalUnitPrice);
        }

        // LTM helper chip — REMOVED in Round 9 (2026-05-14). The table's
        // intersection cell now shows the all-in price, matching the hero —
        // no gap to explain, no warning needed. Defensive null-check kept
        // in case the markup ever returns.
        var ltmHelp = document.getElementById('ltmHelp');
        if (ltmHelp) ltmHelp.hidden = !ltmCalc.hasLtm;
    }

    /* ---------------------- Segmented picker + presets ---------------------- */

    function renderSegmentedActiveStates() {
        // Item type picker
        var itemBtns = document.querySelectorAll('#segItemType button');
        for (var i = 0; i < itemBtns.length; i++) {
            itemBtns[i].classList.toggle('active', itemBtns[i].getAttribute('data-product') === state.product);
        }
        // Qty preset chips
        var qtyBtns = document.querySelectorAll('#qtyPresets button');
        for (var j = 0; j < qtyBtns.length; j++) {
            qtyBtns[j].classList.toggle('active', parseInt(qtyBtns[j].getAttribute('data-q'), 10) === state.qty);
        }
        // Stitch preset chips
        var stitchBtns = document.querySelectorAll('#stitchPresets button');
        for (var k = 0; k < stitchBtns.length; k++) {
            stitchBtns[k].classList.toggle('active', parseInt(stitchBtns[k].getAttribute('data-s'), 10) === state.stitches);
        }
        // Pricing-table tabs
        var tabBtns = document.querySelectorAll('#tableTabs button');
        for (var t = 0; t < tabBtns.length; t++) {
            tabBtns[t].classList.toggle('active', tabBtns[t].getAttribute('data-product') === state.tableProduct);
        }
    }

    function renderStitchPresets() {
        // Round 9 (2026-05-14): preset chips + helper text removed from the
        // markup. This function is mostly a no-op now but kept so the call
        // sites don't have to be conditional. We still update the input's
        // `min` attribute so the rep can't type a value below the product's
        // minimum (browser-level enforcement).
        var p = PRODUCT_META[state.product];
        var stitchInput = document.getElementById('stitch');
        if (stitchInput) stitchInput.setAttribute('min', p.minStitches);
        // If the legacy preset container is still in the DOM, populate it.
        var container = document.getElementById('stitchPresets');
        if (container) {
            var html = '';
            p.stitchPresets.forEach(function (s) {
                html += '<button type="button" data-s="' + s + '">' + (s / 1000) + 'K</button>';
            });
            container.innerHTML = html;
        }
        // Legacy helper text — only update if the element is still present.
        var stitchHelp = document.getElementById('stitchHelp');
        if (stitchHelp) {
            var helpText = 'Minimum: <strong>' + (p.minStitches / 1000) + 'K</strong> stitches';
            if (p.minCharge) helpText += ' · Min charge <strong>$' + p.minCharge.toFixed(2) + '</strong>';
            stitchHelp.innerHTML = helpText;
        }
    }

    /* ---------------------- Pricing tables ---------------------- */

    function renderPriceTable() {
        var p = PRODUCT_META[state.tableProduct];
        var rates = getRatesFor(state.tableProduct);

        // Card header
        document.getElementById('cardIcon').innerHTML = p.iconSvg;
        document.getElementById('cardTitle').textContent = p.title;
        document.getElementById('cardSubtitle').textContent = p.subtitle;
        document.getElementById('cardCode').textContent = p.code;
        var minsHtml = '<span>Min stitches <b>' + (p.minStitches / 1000) + 'K</b></span>';
        if (p.minCharge) minsHtml = '<span style="margin-right:14px">Min charge <b>$' + p.minCharge.toFixed(2) + '</b></span>' + minsHtml;
        document.getElementById('cardMins').innerHTML = minsHtml;

        if (!rates) {
            document.querySelector('#priceTable tbody').innerHTML =
                '<tr><td colspan="6">Pricing unavailable — refresh the page.</td></tr>';
            return;
        }

        // Round 9c (2026-05-14): column + row highlighting ALWAYS apply
        // (qty + stitch are method-agnostic — they help reps locate the
        // comparable cell on any tab). Only the intersection-cell ALL-IN
        // swap is gated on product match — rolling LTM into a different
        // method's price would be misleading, so non-matching intersection
        // cells stay at base rate.
        var productMatches = state.product === state.tableProduct;
        var activeTierIdx = tierIndexForQty(state.qty);
        var activeStitches = state.stitches;

        // Update thead with active column
        var theadCells = document.querySelectorAll('#priceTable thead th');
        for (var i = 0; i < theadCells.length; i++) {
            theadCells[i].classList.toggle('qty-col', (i - 1) === activeTierIdx);
        }

        // Round 9 (2026-05-14): the active INTERSECTION cell (row matching the
        // current stitch count × column matching the current tier) shows the
        // ALL-IN price (base + LTM÷qty), not the base. Matches the hero exactly
        // — that cell IS the rep's quote. Other cells stay base as the rate
        // card. Pre-compute LTM details once so we don't redo the math per cell.
        var ltmThreshold = pricing ? pricing.ltmThreshold : 23;
        var ltmFeeBase = state.tableProduct === 'fullback' ? 100 : (pricing ? pricing.ltmFee : 50);

        // Build body rows
        var rowsHtml = '';
        var stitchCounts = p.stitchCounts;
        stitchCounts.forEach(function (stitches, ri) {
            var isHi = (stitches === activeStitches);
            rowsHtml += '<tr' + (isHi ? ' class="row-hi"' : '') + '>';
            rowsHtml += '<td>' + (stitches / 1000) + 'K</td>';
            TIER_ORDER.forEach(function (tier, ci) {
                var stitchesK = stitches / 1000;
                var price = stitchesK * rates[tier];
                if (state.tableProduct === 'fullback') {
                    var minPrice = (pricing.fullBack && pricing.fullBack.minPrice) || 20;
                    if (price < minPrice) price = minPrice;
                }
                // Intersection cell ALL-IN swap — only when the rep is
                // actually quoting this product. Reps browsing OTHER tabs see
                // base rates in the intersection cell (LTM rollin would be
                // misleading since they're not quoting that method).
                if (isHi && ci === activeTierIdx && productMatches) {
                    var ltmCalc = calculateUnitPriceWithLTM(price, state.qty, ltmThreshold, ltmFeeBase);
                    price = ltmCalc.finalUnitPrice;
                }
                var classes = [];
                if (ci === activeTierIdx) classes.push('qty-col');
                if (isHi && ci === activeTierIdx) classes.push('cell-hi');
                rowsHtml += '<td' + (classes.length ? ' class="' + classes.join(' ') + '"' : '') + '>$' + fmtMoney(price) + '</td>';
            });
            rowsHtml += '</tr>';
        });
        document.querySelector('#priceTable tbody').innerHTML = rowsHtml;

        // tfoot rates row
        var tfootCells = document.querySelectorAll('#priceTable tfoot td');
        // First cell stays as label
        for (var c = 1; c < tfootCells.length; c++) {
            var tier = TIER_ORDER[c - 1];
            var rate = rates[tier];
            tfootCells[c].textContent = '$' + rate.toFixed(2);
            tfootCells[c].classList.toggle('qty-col', (c - 1) === activeTierIdx);
            tfootCells[c].classList.toggle('cell-hi', (c - 1) === activeTierIdx);
        }
    }

    /* ---------------------- URL params ---------------------- */

    function readUrlParams() {
        var params = new URLSearchParams(window.location.search);
        // Accept both Round 6 names (type/qty/stitches) and Designer prototype names (p/q/s).
        var product = params.get('type') || params.get('p');
        var qty = params.get('qty') || params.get('q');
        var stitches = params.get('stitches') || params.get('s');
        if (product && PRODUCT_META[product]) {
            state.product = product;
            state.tableProduct = product;
        }
        if (qty && !isNaN(parseInt(qty, 10))) {
            state.qty = Math.max(1, parseInt(qty, 10));
        }
        if (stitches && !isNaN(parseInt(stitches, 10))) {
            state.stitches = Math.max(1000, parseInt(stitches, 10));
        }
        // If the URL-supplied stitches is below the product's minimum, bump it
        var p = PRODUCT_META[state.product];
        if (state.stitches < p.minStitches) state.stitches = p.minStitches;
    }

    function buildShareUrl() {
        var url = new URL(window.location.href);
        url.search = '';
        url.searchParams.set('type', state.product);
        url.searchParams.set('qty', String(state.qty));
        url.searchParams.set('stitches', String(state.stitches));
        return url.toString();
    }

    function showToast(message) {
        var toast = document.getElementById('shareToast');
        if (!toast) return;
        if (message) document.getElementById('shareToastText').textContent = message;
        toast.classList.add('is-visible');
        setTimeout(function () { toast.classList.remove('is-visible'); }, 2400);
    }

    function copyToClipboard(text) {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            return navigator.clipboard.writeText(text);
        }
        // Fallback for older browsers / non-HTTPS
        return new Promise(function (resolve, reject) {
            var ta = document.createElement('textarea');
            ta.value = text;
            ta.style.position = 'fixed';
            ta.style.opacity = '0';
            document.body.appendChild(ta);
            ta.select();
            try { document.execCommand('copy'); resolve(); }
            catch (e) { reject(e); }
            finally { document.body.removeChild(ta); }
        });
    }

    function copyShareLink() {
        copyToClipboard(buildShareUrl())
            .then(function () { showToast('Quote link copied — paste into your email or chat'); })
            .catch(function () { showToast('Couldn\'t copy — please copy from the address bar'); });
    }

    function copyQuoteText() {
        var p = PRODUCT_META[state.product];
        var calc = computeUnit(state.product, state.qty, state.stitches);
        if (!calc) return;
        var ltmThreshold = pricing ? pricing.ltmThreshold : 23;
        var ltmFeeBase = state.product === 'fullback' ? 100 : (pricing ? pricing.ltmFee : 50);
        var ltmCalc = calculateUnitPriceWithLTM(calc.unit, state.qty, ltmThreshold, ltmFeeBase);
        var total = ltmCalc.finalUnitPrice * state.qty;
        // Customer-friendly format — single per-piece price (LTM built in), no
        // separate "LTM fee" jargon that the customer would need to decode.
        var ltmNote = ltmCalc.hasLtm
            ? ' (incl. $' + fmtMoney(ltmCalc.ltmPerPiece) + ' LTM/pc)'
            : '';
        var text =
            p.label + ' · ' + fmtInt(state.qty) + ' pcs · ' + (state.stitches / 1000).toFixed(0) + 'K stitches\n' +
            'Unit: $' + fmtMoney(ltmCalc.finalUnitPrice) + ' / piece' + ltmNote +
            '  •  Total: $' + fmtMoney(total);
        copyToClipboard(text)
            .then(function () { showToast('Quote text copied'); })
            .catch(function () { showToast('Couldn\'t copy — try again'); });
    }

    /* ---------------------- Event wiring ---------------------- */

    function bindEvents() {
        // Segmented item type picker
        document.getElementById('segItemType').addEventListener('click', function (e) {
            var btn = e.target.closest('button[data-product]');
            if (!btn) return;
            var newProduct = btn.getAttribute('data-product');
            if (newProduct === state.product) return;
            state.product = newProduct;
            state.tableProduct = newProduct;
            // Bump stitches if below the new product's minimum
            var p = PRODUCT_META[newProduct];
            if (state.stitches < p.minStitches) state.stitches = p.minStitches;
            document.getElementById('stitch').value = state.stitches;
            renderStitchPresets();
            renderSegmentedActiveStates();
            renderCalculator();
            renderPriceTable();
        });

        // Quantity input
        var qtyInput = document.getElementById('qty');
        qtyInput.addEventListener('input', function () {
            state.qty = Math.max(1, parseInt(qtyInput.value, 10) || 1);
            renderSegmentedActiveStates();
            renderCalculator();
            renderPriceTable();
        });

        // Qty preset chips — REMOVED in Round 9 (2026-05-14). Reps type the
        // exact quantity directly. Defensive: if the markup ever returns,
        // wire the handler.
        var qtyPresets = document.getElementById('qtyPresets');
        if (qtyPresets) {
            qtyPresets.addEventListener('click', function (e) {
                var btn = e.target.closest('button[data-q]');
                if (!btn) return;
                state.qty = parseInt(btn.getAttribute('data-q'), 10);
                qtyInput.value = state.qty;
                renderSegmentedActiveStates();
                renderCalculator();
                renderPriceTable();
            });
        }

        // Stitch count input
        var stitchInput = document.getElementById('stitch');
        stitchInput.addEventListener('input', function () {
            var p = PRODUCT_META[state.product];
            state.stitches = Math.max(p.minStitches, parseInt(stitchInput.value, 10) || p.minStitches);
            renderSegmentedActiveStates();
            renderCalculator();
            renderPriceTable();
        });

        // Stitch preset chips — REMOVED in Round 9 (2026-05-14).
        var stitchPresets = document.getElementById('stitchPresets');
        if (stitchPresets) {
            stitchPresets.addEventListener('click', function (e) {
                var btn = e.target.closest('button[data-s]');
                if (!btn) return;
                state.stitches = parseInt(btn.getAttribute('data-s'), 10);
                stitchInput.value = state.stitches;
                renderSegmentedActiveStates();
                renderCalculator();
                renderPriceTable();
            });
        }

        // Pricing table tabs (independent from calculator product — reps can browse
        // any table without changing their calculator inputs)
        document.getElementById('tableTabs').addEventListener('click', function (e) {
            var btn = e.target.closest('button[data-product]');
            if (!btn) return;
            state.tableProduct = btn.getAttribute('data-product');
            renderSegmentedActiveStates();
            renderPriceTable();
        });

        // Round 11 (2026-05-14): replaced the Copy buttons with the AI
        // assistant button. Legacy copyShareLink + copyQuoteText functions
        // remain in this file for back-compat and as fallback (a future
        // round may revive them in the AI panel).
        var aiBtn = document.getElementById('aiDraftBtn');
        if (aiBtn) aiBtn.addEventListener('click', openAiChatPanel);

        bindAiChat();
    }

    /* =====================================================
       AI Quote Assistant — chat panel + SSE streaming
       Round 11 (2026-05-14, Phase 1)

       Opens a right-side panel with a chat UI. Sends the page's current
       calculator state (state.product / qty / stitches + computed prices)
       to /api/contract-embroidery-ai/chat on every turn. Streams Claude's
       response token-by-token via SSE. When Claude outputs the email
       between "EMAIL DRAFT START" and "EMAIL DRAFT END" markers, we
       render an email-draft-card with a Copy button.
       ===================================================== */

    var AI_ENDPOINT = API_BASE_URL + '/api/contract-embroidery-ai/chat';
    var aiState = {
        opened: false,
        messages: [],          // [{role: 'user'|'assistant', content: string}, ...]
        isStreaming: false,
        // Phase 3 (2026-05-14): track lookup_customer single-match result so
        // we can stamp CompanyName / ContactName / Email onto the saved
        // quote_session row when Ruthie clicks Copy or Open in Outlook.
        // Phase 4 extended the shape to include customer_number, contact_first,
        // contact_last, phone, address, address2, city, state, zip.
        lastLookup: null,
        // Phase 3: most recently rendered email-draft block. Parsed once on
        // stream-complete; reused by both action buttons + the save call.
        currentDraft: null,    // {to, subject, body, lookupSnapshot}
        // Phase 4 (2026-05-14): pre-generated CEMB quote ID for this panel
        // session. Generated lazily on the first AI message (so opening +
        // closing the panel without sending doesn't burn an ID). Reused
        // across iterations + on save (so we don't fetch a fresh sequence
        // at click time). quoteIDPromise serializes concurrent fetches.
        quoteID: null,
        quoteIDPromise: null,
    };

    /* ---------- Phase 4 — quote ID pre-generation ---------- */

    // Lazy + idempotent. First call fires a single fetch; subsequent calls
    // (within the same panel session) return the cached string. Failure is
    // soft: returns null so the AI just skips the quote-# reference; the
    // save call later falls back to fetching a fresh sequence.
    function ensureQuoteID() {
        if (aiState.quoteID) return Promise.resolve(aiState.quoteID);
        if (aiState.quoteIDPromise) return aiState.quoteIDPromise;
        aiState.quoteIDPromise = (async function () {
            try {
                var r = await fetch(API_BASE_URL + '/api/quote-sequence/CEMB');
                if (!r.ok) throw new Error('quote-sequence returned ' + r.status);
                var d = await r.json();
                aiState.quoteID = d.prefix + '-' + d.year + '-' + String(d.sequence).padStart(3, '0');
                return aiState.quoteID;
            } catch (err) {
                console.warn('[ai-chat] ensureQuoteID failed — proceeding without pre-assigned ID:', err);
                aiState.quoteIDPromise = null;
                return null;
            }
        })();
        return aiState.quoteIDPromise;
    }

    /* ---------- Phase 3 helpers ---------- */

    // Parse the EMAIL DRAFT block emitted by Claude. Returns {to, subject,
    // body} for downstream use (mailto, copy-to-clipboard, save-to-quote).
    function parseEmailDraft(blockText) {
        // blockText is the content between START / END markers (already
        // stripped by the caller).
        var toMatch = blockText.match(/^To:\s*(.*)$/m);
        var subjMatch = blockText.match(/^Subject:\s*(.*)$/m);
        // Strip the To: + Subject: administrative lines from the body
        var body = blockText
            .replace(/^To:\s*.*$/m, '')
            .replace(/^Subject:\s*.*$/m, '')
            .replace(/^\n+/, '');
        return {
            to: (toMatch && toMatch[1] || '').trim(),
            subject: (subjMatch && subjMatch[1] || '').trim(),
            body: body.trim(),
        };
    }

    // Extract first-name from "Hi <name>," greeting in the body, used as a
    // fallback for the customer record when lookup wasn't called.
    function extractGreetingName(body) {
        var m = body.match(/^Hi\s+([^,\n]+),/m);
        return m ? m[1].trim() : '';
    }

    // Build a mailto: URL. URL-encodes subject + body per RFC. Caps body at
    // 1,800 chars defensively — some Windows mail handlers truncate URLs
    // around the 2KB mark, which would silently drop the end of the email.
    function buildMailto(draft) {
        var BODY_CAP = 1800;
        var body = draft.body || '';
        var truncated = false;
        if (body.length > BODY_CAP) {
            body = body.slice(0, BODY_CAP);
            truncated = true;
            console.warn('[ai-chat] mailto body capped at ' + BODY_CAP + ' chars (full body still available in clipboard if you Copy).');
        }
        var params = [];
        if (draft.subject) params.push('subject=' + encodeURIComponent(draft.subject));
        if (body) params.push('body=' + encodeURIComponent(body));
        var qs = params.length ? '?' + params.join('&') : '';
        var to = (draft.to || '').trim();
        // encodeURIComponent over the email is RFC-safe and tolerates '+' and other delims.
        return 'mailto:' + encodeURIComponent(to) + qs;
    }

    // POST the AI-drafted quote to /api/quote_sessions + /api/quote_items.
    // Fire-and-forget pattern: caller doesn't await — see handleCommitDraft.
    //
    // Phase 4 (2026-05-14):
    //   - Accepts opts.quoteID (pre-generated). Falls back to fetching a
    //     fresh sequence only if no ID was provided (legacy / failure path).
    //   - Accepts an extended customer shape: {email, name, company,
    //     customer_number, phone, address, address2, city, state, zip}.
    //     Maps onto quote_sessions fields the schema already had reserved
    //     but Phase 3 left blank.
    async function saveContractEmbroideryQuote(opts) {
        var calcContext = opts.calcContext;
        var customer = opts.customer || {};
        if (!calcContext) throw new Error('calcContext required');

        var proxyBase = API_BASE_URL;

        // 1. Reuse the pre-generated CEMB ID when available; otherwise burn
        // a fresh one (legacy save path / panel where ensureQuoteID failed).
        var quoteID = opts.quoteID;
        if (!quoteID) {
            var seqRes = await fetch(proxyBase + '/api/quote-sequence/CEMB');
            if (!seqRes.ok) throw new Error('quote-sequence returned ' + seqRes.status);
            var seqData = await seqRes.json();
            quoteID = seqData.prefix + '-' + seqData.year + '-' + String(seqData.sequence).padStart(3, '0');
        }

        var nowISO = new Date().toISOString().replace(/\.\d{3}Z$/, '');
        var expiresISO = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString().replace(/\.\d{3}Z$/, '');

        var productLabel = (PRODUCT_META[calcContext.product] && PRODUCT_META[calcContext.product].label) || calcContext.product;
        var stitchK = Math.round(calcContext.stitches / 1000);
        // Phase 6: fullback uses DECG-FB to match the calculator's
        // segmented-picker label + the corporate embroidery pricing page +
        // ShopWorks. CTR-FB was a Phase 3 mistake; renderer accepts both.
        var skuBase = calcContext.product === 'cap' ? 'CTR-Cap'
            : calcContext.product === 'fullback' ? 'DECG-FB'
            : 'CTR-Garmt';
        var locationLabel = calcContext.product === 'cap' ? 'Cap'
            : calcContext.product === 'fullback' ? 'Full Back'
            : 'Left Chest';

        // 2. Session row — uses the same fields embroidery-quote-service maps to.
        // Phase 4: stamp CustomerNumber + Phone + ShipTo address from the
        // lookup snapshot when available (graceful empties otherwise).
        // Phase 5: also stamp Account_Owner / Email_Salesrep (reflects the
        // customer's actual assigned rep instead of always Ruthie) and
        // Payment_Terms (e.g. "Net 10" — shown in Quote Details card).
        var session = {
            QuoteID: quoteID,
            SessionID: 'cemb_ai_' + Date.now() + '_' + Math.random().toString(36).slice(2, 11),
            CustomerEmail: customer.email || '',
            CustomerName: customer.name || 'AI Draft',
            CompanyName: customer.company || '',
            CustomerNumber: customer.customer_number || '',
            Phone: customer.phone || '',
            ShipToAddress: customer.address || '',
            ShipToCity: customer.city || '',
            ShipToState: customer.state || '',
            ShipToZip: customer.zip || '',
            // Phase 5: rep identity reflects the CRM's account-owner record.
            // Email is still SIGNED by Ruthie in the body (system-prompt
            // locked to Ruthie). Saved record captures the real owner for
            // routing/reporting. Falls back to Ruthie when CRM missing.
            SalesRepEmail: customer.email_salesrep || 'ruth@nwcustomapparel.com',
            SalesRepName: customer.account_owner || 'Ruthie Nhoung',
            // Phase 5: payment terms surface as "Terms: Net 10" in Quote
            // Details card. Empty by default — only set when CRM has one.
            PaymentTerms: customer.payment_terms || '',
            TotalQuantity: calcContext.qty,
            SubtotalAmount: parseFloat(calcContext.orderTotal.toFixed(2)),
            LTMFeeTotal: parseFloat((calcContext.ltmFee || 0).toFixed(2)),
            TotalAmount: parseFloat(calcContext.orderTotal.toFixed(2)),
            Status: 'Open',
            CreatedAt_Quote: nowISO,
            ExpiresAt: expiresISO,
            Notes: 'AI-drafted contract embroidery quote · ' + productLabel + ' · ' + stitchK + 'K stitches',
            StitchCount: calcContext.stitches,
            PrintLocation: locationLabel,
        };
        var sessRes = await fetch(proxyBase + '/api/quote_sessions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(session),
        });
        if (!sessRes.ok) {
            var t = await sessRes.text();
            throw new Error('quote_sessions POST returned ' + sessRes.status + ': ' + t.slice(0, 120));
        }

        // 3. Line item row
        // Phase 5: EmbellishmentType: 'customer-supplied' routes the item
        // through quote-view.js's renderCustomerSuppliedRows() path, which
        // doesn't require a SizeBreakdown (contract embroidery is per-piece,
        // not per-size). Without this flag, the line item falls into the
        // standard product-rows path where parseSizeBreakdown('') returns {}
        // and NO row gets rendered — table headers without a body.
        // (locationLabel hoisted above for re-use on the session row.)
        var item = {
            QuoteID: quoteID,
            LineNumber: 1,
            StyleNumber: skuBase,
            ProductName: 'Contract ' + productLabel + ' embroidery · ' + stitchK + 'K stitches',
            Quantity: calcContext.qty,
            FinalUnitPrice: parseFloat(calcContext.finalUnit.toFixed(2)),
            LineTotal: parseFloat(calcContext.orderTotal.toFixed(2)),
            SizeBreakdown: '',
            EmbellishmentType: 'customer-supplied',
            PrintLocation: locationLabel,
            PrintLocationName: locationLabel,
            AddedAt: nowISO,
        };
        var itemRes = await fetch(proxyBase + '/api/quote_items', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(item),
        });
        if (!itemRes.ok) {
            var t2 = await itemRes.text();
            // Session was saved but line item failed — log and surface to caller.
            console.warn('[ai-chat] quote_items POST failed: ' + itemRes.status + ' ' + t2.slice(0, 120) +
                ' — session ' + quoteID + ' was saved but has no line items.');
            throw new Error('quote_items POST returned ' + itemRes.status);
        }

        return quoteID;
    }

    // Action handler shared by Copy + Open in Outlook. Takes the action
    // immediately, then fires the quote save in the background. Receives
    // the draft as a closed-over arg so each rendered email-card is bound
    // to ITS specific draft — clicking an older card's button still pulls
    // the correct text even if a newer draft has been rendered since.
    function handleCommitDraft(action, btn, draft) {
        if (!draft) draft = aiState.currentDraft;
        if (!draft) return;

        // Take the immediate action
        if (action === 'copy') {
            copyToClipboard(draft.body).then(function () {
                if (btn) {
                    btn.classList.add('copied');
                    var span = btn.querySelector('span');
                    if (span) {
                        var orig = span.textContent;
                        span.textContent = 'Copied!';
                        setTimeout(function () {
                            btn.classList.remove('copied');
                            span.textContent = orig;
                        }, 2200);
                    }
                }
            });
        } else if (action === 'outlook') {
            // Also copy the body to clipboard as a safety net in case the
            // mailto: truncated long bodies — Ruthie can paste-replace.
            copyToClipboard(draft.body).catch(function () { /* non-fatal */ });
            var url = buildMailto(draft);
            window.location.href = url;
            if (btn) {
                btn.classList.add('opened');
                var span2 = btn.querySelector('span');
                if (span2) {
                    var orig2 = span2.textContent;
                    span2.textContent = 'Opening Outlook…';
                    setTimeout(function () {
                        btn.classList.remove('opened');
                        span2.textContent = orig2;
                    }, 2200);
                }
            }
        }

        // Fire-and-forget quote save. Don't block the click.
        var calcCtx = buildCalcContext();
        if (!calcCtx) {
            console.warn('[ai-chat] no calcContext at save time — skipping quote save');
            return;
        }
        // Prefer the snapshot taken at draft-render time (closed over by the
        // card's buttons) over the live aiState.lastLookup — clicks happen
        // potentially much later than the render, and lastLookup may have
        // moved on. Fall back to live aiState only if no snapshot is attached.
        var lookup = draft.lookupSnapshot || aiState.lastLookup;
        // Strict trust check — defensive against stale lookups across turns.
        // Used for company/phone/customer_number/address/payment_terms/rep
        // (anything where stale data could be misleading or wrong).
        var draftEmail = (draft.to || '').toLowerCase();
        var lookupEmail = (lookup && lookup.email || '').toLowerCase();
        var lookupTrusted = !!lookup && draftEmail && draftEmail === lookupEmail;

        // Phase 5: relaxed-trust check for the contact's full NAME only.
        // The AI just used this name in "Hi <first>," — if the lookup's
        // contact_name starts with the same first name, it's almost
        // certainly the right person even if the email-trust check failed
        // (case differences, alt email fields, etc.). Identity-low-risk.
        var greetingFirst = (extractGreetingName(draft.body) || '').toLowerCase();
        var lookupName = (lookup && lookup.contact_name || '');
        var lookupFirst = (lookup && lookup.contact_first || lookupName.split(/\s+/)[0] || '').toLowerCase();
        var nameTrusted = !!lookupName && (
            lookupTrusted ||
            (greetingFirst && lookupFirst && lookupFirst === greetingFirst)
        );

        // Phase 4 + 5: extended customer shape — name uses relaxed trust;
        // everything else uses strict email-match trust.
        var customer = {
            email: draft.to || (lookupTrusted ? lookup.email : '') || '',
            name: (nameTrusted ? lookupName : '') || extractGreetingName(draft.body) || '',
            company: (lookupTrusted ? lookup.company : '') || '',
            customer_number: (lookupTrusted ? lookup.customer_number : '') || '',
            phone: (lookupTrusted ? lookup.phone : '') || '',
            address: (lookupTrusted ? lookup.address : '') || '',
            address2: (lookupTrusted ? lookup.address2 : '') || '',
            city: (lookupTrusted ? lookup.city : '') || '',
            state: (lookupTrusted ? lookup.state : '') || '',
            zip: (lookupTrusted ? lookup.zip : '') || '',
            // Phase 5: rep + terms — all strict-trust-gated.
            account_owner: (lookupTrusted ? lookup.account_owner : '') || '',
            email_salesrep: (lookupTrusted ? lookup.email_salesrep : '') || '',
            payment_terms: (lookupTrusted ? lookup.payment_terms : '') || '',
        };
        // Phase 4: pass the pre-generated quote ID through so we don't burn
        // a fresh sequence at click-time (the AI's email already references
        // this ID, so they must match).
        saveContractEmbroideryQuote({
            calcContext: calcCtx,
            customer: customer,
            quoteID: aiState.quoteID || null,
        })
            .then(function (quoteID) {
                showToast('Saved as ' + quoteID);
            })
            .catch(function (err) {
                console.warn('[ai-chat] quote save failed:', err);
                showToast('Email ready. (Couldn\'t save quote — see console.)');
            });
    }

    function buildCalcContext() {
        var calc = computeUnit(state.product, state.qty, state.stitches);
        if (!calc) return null;
        var ltmThreshold = pricing ? pricing.ltmThreshold : 23;
        var ltmFeeBase = state.product === 'fullback' ? 100 : (pricing ? pricing.ltmFee : 50);
        var ltmCalc = calculateUnitPriceWithLTM(calc.unit, state.qty, ltmThreshold, ltmFeeBase);
        return {
            product: state.product,
            qty: state.qty,
            stitches: state.stitches,
            baseUnit: Number(calc.unit.toFixed(2)),
            finalUnit: Number(ltmCalc.finalUnitPrice.toFixed(2)),
            ltmFee: ltmCalc.hasLtm ? ltmFeeBase : 0,
            // Phase 4: include the pre-generated CEMB quote ID so the AI can
            // reference it in the subject + intro. May be null if first
            // message hasn't fired yet OR ensureQuoteID() failed — the AI
            // gracefully omits it in that case.
            quoteID: aiState.quoteID || null,
            ltmPerPiece: Number(ltmCalc.ltmPerPiece.toFixed(2)),
            orderTotal: Number((ltmCalc.finalUnitPrice * state.qty).toFixed(2)),
        };
    }

    function updateContextPill() {
        var pill = document.getElementById('aiChatContextPill');
        if (!pill) return;
        var ctx = buildCalcContext();
        if (!ctx) {
            pill.innerHTML = '<i>Pricing unavailable — close and refresh.</i>';
            return;
        }
        var label = PRODUCT_META[ctx.product]?.label || ctx.product;
        pill.innerHTML =
            '<b>' + fmtInt(ctx.qty) + ' ' + label.toLowerCase() + (ctx.qty === 1 ? '' : 's') + '</b>' +
            ' · ' + (ctx.stitches / 1000) + 'K stitches' +
            ' · <b>$' + fmtMoney(ctx.finalUnit) + '/pc</b>' +
            ' · Total <b>$' + fmtMoney(ctx.orderTotal) + '</b>' +
            (ctx.ltmFee > 0 ? ' · incl. $' + ctx.ltmFee + ' LTM' : '');
    }

    function appendChatBubble(role, text, opts) {
        opts = opts || {};
        var container = document.getElementById('aiChatMessages');
        var msg = document.createElement('div');
        msg.className = 'chat-message ' + role + (opts.error ? ' error' : '');
        var bubble = document.createElement('div');
        bubble.className = 'chat-bubble';
        bubble.textContent = text;
        msg.appendChild(bubble);
        container.appendChild(msg);
        container.scrollTop = container.scrollHeight;
        return bubble;
    }

    function appendTypingIndicator() {
        var container = document.getElementById('aiChatMessages');
        var msg = document.createElement('div');
        msg.className = 'chat-message assistant typing-wrap';
        var typing = document.createElement('div');
        typing.className = 'chat-typing';
        typing.innerHTML = '<span></span><span></span><span></span>';
        msg.appendChild(typing);
        container.appendChild(msg);
        container.scrollTop = container.scrollHeight;
        return msg;
    }

    function removeTypingIndicator(typingEl) {
        if (typingEl && typingEl.parentNode) typingEl.parentNode.removeChild(typingEl);
    }

    /**
     * Look for the EMAIL DRAFT START / END markers in the assistant's
     * reply. If found, split the reply into the conversational part
     * (before the marker) + the email draft (between markers). Render
     * the conversational part in a normal bubble; render the email in
     * an email-draft-card with Copy + Open in Outlook buttons.
     *
     * Phase 3 (2026-05-14): also parses To/Subject out of the draft and
     * stashes the structured draft on aiState.currentDraft so the action
     * buttons can build a mailto: URL and save the quote.
     */
    function renderAssistantReply(bubbleEl, fullText) {
        var startMarker = 'EMAIL DRAFT START';
        var endMarker = 'EMAIL DRAFT END';
        var startIdx = fullText.indexOf(startMarker);
        var endIdx = fullText.indexOf(endMarker);
        if (startIdx === -1) {
            bubbleEl.textContent = fullText;
            return;
        }
        var preamble = fullText.slice(0, startIdx).trim();
        var emailEnd = endIdx === -1 ? fullText.length : endIdx;
        var blockText = fullText.slice(startIdx + startMarker.length, emailEnd).trim();

        // Parse the To: / Subject: lines into structured fields. We bind
        // each card's buttons to THIS draft via closure (see below) so
        // older cards keep working even after newer drafts arrive — but
        // we also stash the latest on aiState for any caller that wants
        // "the most recent" (e.g. external integrations).
        var parsed = parseEmailDraft(blockText);
        var cardDraft = {
            to: parsed.to,
            subject: parsed.subject,
            body: parsed.body,
            // Snapshot of the lookup at the moment this draft was generated.
            // Prevents staleness when Ruthie iterates on multiple customers
            // in a single session — each card's save uses its own snapshot.
            lookupSnapshot: aiState.lastLookup ? Object.assign({}, aiState.lastLookup) : null,
        };
        aiState.currentDraft = cardDraft;

        // Render the preamble (conversational text) in the existing bubble
        bubbleEl.textContent = preamble || '(Email drafted — see below.)';

        // Build the email-draft-card AFTER the conversational bubble
        var msgEl = bubbleEl.closest('.chat-message');
        var card = document.createElement('div');
        card.className = 'email-draft-card';
        var label = document.createElement('div');
        label.className = 'draft-label';
        label.textContent = 'Email draft';
        var body = document.createElement('div');
        body.className = 'draft-body';
        body.textContent = parsed.body;

        // Meta row: To / Subject for visibility (only renders if populated)
        if (parsed.to || parsed.subject) {
            var meta = document.createElement('div');
            meta.className = 'draft-meta';
            if (parsed.to) {
                var toRow = document.createElement('div');
                toRow.className = 'draft-meta-row';
                toRow.innerHTML = '<span class="draft-meta-label">To</span><span class="draft-meta-val">' +
                    String(parsed.to).replace(/[<>&]/g, function (m) { return ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' })[m]; }) +
                    '</span>';
                meta.appendChild(toRow);
            }
            if (parsed.subject) {
                var subjRow = document.createElement('div');
                subjRow.className = 'draft-meta-row';
                subjRow.innerHTML = '<span class="draft-meta-label">Subject</span><span class="draft-meta-val">' +
                    String(parsed.subject).replace(/[<>&]/g, function (m) { return ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' })[m]; }) +
                    '</span>';
                meta.appendChild(subjRow);
            }
            card.appendChild(label);
            card.appendChild(meta);
        } else {
            card.appendChild(label);
        }
        card.appendChild(body);

        var actions = document.createElement('div');
        actions.className = 'email-draft-actions';

        // Open in Outlook (primary action — pre-fills To/Subject/Body)
        var outlookBtn = document.createElement('button');
        outlookBtn.type = 'button';
        outlookBtn.className = 'btn-outlook';
        outlookBtn.innerHTML =
            '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
            '<path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>' +
            '<polyline points="22,6 12,13 2,6"/>' +
            '</svg><span>Open in Outlook</span>';
        outlookBtn.addEventListener('click', function () {
            handleCommitDraft('outlook', outlookBtn, cardDraft);
        });
        actions.appendChild(outlookBtn);

        // Copy email (secondary action)
        var copyBtn = document.createElement('button');
        copyBtn.type = 'button';
        copyBtn.className = 'btn-copy-email';
        copyBtn.innerHTML =
            '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
            '<rect x="9" y="9" width="11" height="11" rx="2"/>' +
            '<path d="M5 15V5a2 2 0 0 1 2-2h10"/>' +
            '</svg><span>Copy email</span>';
        copyBtn.addEventListener('click', function () {
            handleCommitDraft('copy', copyBtn, cardDraft);
        });
        actions.appendChild(copyBtn);

        card.appendChild(actions);
        msgEl.appendChild(card);
        document.getElementById('aiChatMessages').scrollTop = document.getElementById('aiChatMessages').scrollHeight;
    }

    /**
     * Send the current messages array + calcContext to the SSE endpoint.
     * Stream the response into a new assistant bubble. When done, parse
     * for an EMAIL DRAFT block and render the card if present.
     */
    async function sendChatMessage() {
        if (aiState.isStreaming) return;
        aiState.isStreaming = true;
        var sendBtn = document.getElementById('aiChatSend');
        if (sendBtn) sendBtn.disabled = true;

        var typingEl = appendTypingIndicator();

        try {
            // Phase 4: pre-fetch the CEMB quote ID before the AI runs, so the
            // first emitted draft can already reference it in subject + intro.
            // Failure is soft — ensureQuoteID returns null and the AI omits.
            await ensureQuoteID();

            var response = await fetch(AI_ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: aiState.messages,
                    calcContext: buildCalcContext(),
                }),
            });

            if (!response.ok) {
                throw new Error('AI server returned ' + response.status);
            }

            // Replace typing indicator with the actual assistant bubble
            removeTypingIndicator(typingEl);
            var bubble = appendChatBubble('assistant', '');

            var reader = response.body.getReader();
            var decoder = new TextDecoder();
            var accumulated = '';
            var sseBuffer = '';

            while (true) {
                var chunk = await reader.read();
                if (chunk.done) break;
                sseBuffer += decoder.decode(chunk.value, { stream: true });

                // Parse SSE events from the buffer. Each event is delimited
                // by a blank line (\n\n) and consists of "event: TYPE" +
                // "data: JSON" lines.
                var events = sseBuffer.split('\n\n');
                sseBuffer = events.pop(); // Last (possibly incomplete) chunk

                for (var i = 0; i < events.length; i++) {
                    var lines = events[i].split('\n');
                    var eventType = null, dataJson = null;
                    for (var j = 0; j < lines.length; j++) {
                        if (lines[j].startsWith('event: ')) eventType = lines[j].slice(7).trim();
                        if (lines[j].startsWith('data: ')) dataJson = lines[j].slice(6).trim();
                    }
                    if (!eventType || !dataJson) continue;
                    var data;
                    try { data = JSON.parse(dataJson); } catch (e) { continue; }
                    if (eventType === 'delta' && data.text) {
                        accumulated += data.text;
                        bubble.textContent = accumulated;
                        document.getElementById('aiChatMessages').scrollTop = document.getElementById('aiChatMessages').scrollHeight;
                    } else if (eventType === 'tool_result' && data.tool === 'lookup_customer') {
                        // Phase 3: capture the single-match (or first match) so
                        // the quote save knows the company + contact + email.
                        // Multi-match results bypass auto-capture — Claude will
                        // ask Ruthie which one, and a follow-up lookup with the
                        // narrowed query will give us a single match.
                        var matches = (data.result && data.result.matches) || [];
                        if (matches.length === 1) {
                            aiState.lastLookup = matches[0];
                        } else if (matches.length > 1 && !aiState.lastLookup) {
                            // No prior match — stash first as a best-effort fallback.
                            // Will be overwritten when Ruthie narrows down.
                            aiState.lastLookup = matches[0];
                        }
                    } else if (eventType === 'error') {
                        throw new Error(data.message || 'AI stream error');
                    }
                    // 'done' event — we let the stream-end handle finalization
                }
            }

            // Stream complete — store in history + render any EMAIL DRAFT block
            aiState.messages.push({ role: 'assistant', content: accumulated });
            renderAssistantReply(bubble, accumulated);
        } catch (err) {
            console.error('[ai-chat] error:', err);
            removeTypingIndicator(typingEl);
            appendChatBubble(
                'assistant',
                "Hmm, I couldn't reach the AI right now. Please try again in a moment, or copy the quote details from the calculator manually.",
                { error: true }
            );
        } finally {
            aiState.isStreaming = false;
            if (sendBtn) sendBtn.disabled = false;
            var ta = document.getElementById('aiChatTextarea');
            if (ta) ta.focus();
        }
    }

    function openAiChatPanel() {
        var panel = document.getElementById('aiChatPanel');
        if (!panel) return;
        panel.classList.add('is-open');
        panel.setAttribute('aria-hidden', 'false');
        aiState.opened = true;
        updateContextPill();

        // First-open greeting — send an empty user message so Claude
        // greets Ruthie with the calc context.
        if (aiState.messages.length === 0) {
            aiState.messages.push({
                role: 'user',
                content: '(Open the chat — greet Ruthie and ask for the customer details.)',
            });
            sendChatMessage();
        }

        setTimeout(function () {
            var ta = document.getElementById('aiChatTextarea');
            if (ta) ta.focus();
        }, 360);
    }

    function closeAiChatPanel() {
        var panel = document.getElementById('aiChatPanel');
        if (!panel) return;
        panel.classList.remove('is-open');
        panel.setAttribute('aria-hidden', 'true');
        aiState.opened = false;
    }

    function bindAiChat() {
        var closeBtn = document.getElementById('aiChatClose');
        if (closeBtn) closeBtn.addEventListener('click', closeAiChatPanel);

        var form = document.getElementById('aiChatForm');
        var ta = document.getElementById('aiChatTextarea');
        if (form) {
            form.addEventListener('submit', function (e) {
                e.preventDefault();
                var text = (ta.value || '').trim();
                if (!text || aiState.isStreaming) return;
                aiState.messages.push({ role: 'user', content: text });
                appendChatBubble('user', text);
                ta.value = '';
                ta.style.height = 'auto';
                updateContextPill();
                sendChatMessage();
            });
        }
        if (ta) {
            ta.addEventListener('keydown', function (e) {
                // Enter sends; Shift+Enter newline
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    if (form) form.dispatchEvent(new Event('submit'));
                }
            });
            // Auto-grow textarea
            ta.addEventListener('input', function () {
                ta.style.height = 'auto';
                ta.style.height = Math.min(ta.scrollHeight, 120) + 'px';
            });
        }
        // Refresh the context pill whenever the calculator inputs change
        ['ecQuantity', 'ecStitches', 'qty', 'stitch'].forEach(function (id) {
            var el = document.getElementById(id);
            if (el) el.addEventListener('input', function () {
                if (aiState.opened) updateContextPill();
            });
        });
        // Escape closes the panel
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && aiState.opened) closeAiChatPanel();
        });
    }

    /* ---------------------- Init ---------------------- */

    function init() {
        readUrlParams();

        // Set initial DOM values from state
        document.getElementById('qty').value = state.qty;
        document.getElementById('stitch').value = state.stitches;
        renderStitchPresets();
        renderSegmentedActiveStates();

        // Fetch live pricing
        fetchContractPricing()
            .then(function (data) {
                pricing = data;
                document.getElementById('pricingError').hidden = true;
                renderCalculator();
                renderPriceTable();
            })
            .catch(function (err) {
                console.error('[contract-embroidery] Failed to load pricing:', err);
                document.getElementById('pricingError').hidden = false;
                document.getElementById('unitPrice').textContent = '—';
                document.getElementById('unitSub').textContent = 'Pricing unavailable';
            });

        bindEvents();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
