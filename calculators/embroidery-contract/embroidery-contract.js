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

    var CONTRACT_STITCH_COUNTS = [8000, 10000, 12000, 14000, 16000, 18000, 20000, 25000];
    var FB_STITCH_COUNTS = [25000, 30000, 35000, 40000, 45000, 50000];

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
            label: 'Cap Front',   code: 'CTR-Cap',
            title: 'Contract Cap Fronts',
            subtitle: 'Front-panel embroidery on caps & headwear',
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

        // Result panel — header + hero price
        document.getElementById('resProductLabel').textContent = p.label;
        if (calc) {
            document.getElementById('resTier').textContent = 'Tier ' + TIER_LABELS[calc.tierIdx];
            document.getElementById('unitPrice').textContent = fmtMoney(calc.unit);
            var subText = (state.stitches / 1000).toFixed(0) + 'K × <b>$' + calc.rate.toFixed(2) + '/1K</b>';
            if (calc.minChargeApplied) subText += ' · min charge applied';
            document.getElementById('unitSub').innerHTML = subText;
        } else {
            document.getElementById('resTier').textContent = '—';
            document.getElementById('unitPrice').textContent = '—';
            document.getElementById('unitSub').innerHTML = 'Pricing unavailable';
        }

        // Totals
        var ltmApplies = state.qty <= (pricing ? pricing.ltmThreshold : 23);
        var ltmFee = state.product === 'fullback' ? 100 : (pricing ? pricing.ltmFee : 50);
        var unit = calc ? calc.unit : 0;
        var subtotal = unit * state.qty;
        var ltm = ltmApplies ? ltmFee : 0;
        var total = subtotal + ltm;
        var perPieceAllIn = state.qty > 0 ? (total / state.qty) : 0;

        document.getElementById('subtotal').textContent = '$' + fmtMoney(subtotal);
        document.getElementById('subtotalNote').textContent = fmtInt(state.qty) + ' × $' + fmtMoney(unit);
        var ltmCard = document.getElementById('ltmCard');
        if (ltm) {
            ltmCard.classList.add('alert');
            document.getElementById('ltmValue').textContent = '+ $' + fmtMoney(ltm);
            document.getElementById('ltmNote').textContent = 'Orders 1–' + (pricing ? pricing.ltmThreshold : 23);
        } else {
            ltmCard.classList.remove('alert');
            document.getElementById('ltmValue').textContent = '—';
            document.getElementById('ltmNote').textContent = 'Not applicable';
        }
        document.getElementById('orderTotal').textContent = '$' + fmtMoney(total);
        document.getElementById('perPieceAllIn').textContent = fmtMoney(perPieceAllIn);

        // LTM helper line under the quantity field
        var ltmHelp = document.getElementById('ltmHelp');
        if (ltmApplies && state.qty > 0) {
            ltmHelp.hidden = false;
            document.getElementById('ltmHelpAmount').textContent = '$' + ltmFee;
        } else {
            ltmHelp.hidden = true;
        }
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
        var p = PRODUCT_META[state.product];
        var container = document.getElementById('stitchPresets');
        var html = '';
        p.stitchPresets.forEach(function (s) {
            html += '<button type="button" data-s="' + s + '">' + (s / 1000) + 'K</button>';
        });
        container.innerHTML = html;
        // Help text under input
        var helpText = 'Minimum: <strong>' + (p.minStitches / 1000) + 'K</strong> stitches';
        if (p.minCharge) helpText += ' · Min charge <strong>$' + p.minCharge.toFixed(2) + '</strong>';
        document.getElementById('stitchHelp').innerHTML = helpText;
        // Stitch input min attribute
        document.getElementById('stitch').setAttribute('min', p.minStitches);
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

        // Active tier (only highlight if the calculator's product matches the table's product
        // — otherwise the highlight is misleading)
        var highlightActive = state.product === state.tableProduct;
        var activeTierIdx = highlightActive ? tierIndexForQty(state.qty) : -1;
        var activeStitches = highlightActive ? state.stitches : -1;

        // Update thead with active column
        var theadCells = document.querySelectorAll('#priceTable thead th');
        for (var i = 0; i < theadCells.length; i++) {
            theadCells[i].classList.toggle('qty-col', (i - 1) === activeTierIdx);
        }

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
        var ltmApplies = state.qty <= (pricing ? pricing.ltmThreshold : 23);
        var ltmFee = state.product === 'fullback' ? 100 : (pricing ? pricing.ltmFee : 50);
        var subtotal = calc.unit * state.qty;
        var ltm = ltmApplies ? ltmFee : 0;
        var total = subtotal + ltm;
        var text =
            p.label + ' · ' + fmtInt(state.qty) + ' pcs · ' + (state.stitches / 1000).toFixed(0) + 'K stitches\n' +
            'Unit: $' + fmtMoney(calc.unit) +
            '  Subtotal: $' + fmtMoney(subtotal) +
            (ltm ? '  LTM: $' + fmtMoney(ltm) : '') +
            '  Total: $' + fmtMoney(total);
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

        // Quantity preset chips
        document.getElementById('qtyPresets').addEventListener('click', function (e) {
            var btn = e.target.closest('button[data-q]');
            if (!btn) return;
            state.qty = parseInt(btn.getAttribute('data-q'), 10);
            qtyInput.value = state.qty;
            renderSegmentedActiveStates();
            renderCalculator();
            renderPriceTable();
        });

        // Stitch count input
        var stitchInput = document.getElementById('stitch');
        stitchInput.addEventListener('input', function () {
            var p = PRODUCT_META[state.product];
            state.stitches = Math.max(p.minStitches, parseInt(stitchInput.value, 10) || p.minStitches);
            renderSegmentedActiveStates();
            renderCalculator();
            renderPriceTable();
        });

        // Stitch preset chips (delegated — re-rendered when product changes)
        document.getElementById('stitchPresets').addEventListener('click', function (e) {
            var btn = e.target.closest('button[data-s]');
            if (!btn) return;
            state.stitches = parseInt(btn.getAttribute('data-s'), 10);
            stitchInput.value = state.stitches;
            renderSegmentedActiveStates();
            renderCalculator();
            renderPriceTable();
        });

        // Pricing table tabs (independent from calculator product — reps can browse
        // any table without changing their calculator inputs)
        document.getElementById('tableTabs').addEventListener('click', function (e) {
            var btn = e.target.closest('button[data-product]');
            if (!btn) return;
            state.tableProduct = btn.getAttribute('data-product');
            renderSegmentedActiveStates();
            renderPriceTable();
        });

        // Copy buttons
        document.getElementById('copyLinkBtn').addEventListener('click', copyShareLink);
        document.getElementById('copyTextBtn').addEventListener('click', copyQuoteText);
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
