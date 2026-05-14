/* =====================================================
   CONTRACT EMBROIDERY CALCULATOR
   Standalone page split off from embroidery-pricing-all
   in Round 6 (2026-05-13). Single-tier wholesale pricing
   for production accounts — no segment tabs.

   Functions:
     1. Fetch CTR-Garmt + CTR-Cap + DECG-FB rates from the
        proxy's /api/pricing-bundle?method=EMB endpoint.
     2. Build the 3 pricing matrices on init.
     3. Quick Price Calculator that recalculates on every
        input change.
     4. URL-param read on page load — ?type=&qty=&stitches=
        pre-fills the calculator so a customer clicking
        Ruthie's share-link sees their exact quote.
     5. Copy Quote Link — builds a URL with current state
        and copies it to the clipboard. Shows a toast on
        success.

   No imports / no modules. Pure browser JS so the page
   loads cleanly without an ES-module dependency chain.
   ===================================================== */

(function () {
    'use strict';

    var API_BASE_URL = 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';

    var TIER_ORDER = ['1-7', '8-23', '24-47', '48-71', '72+'];
    var CONTRACT_STITCH_COUNTS = [8000, 10000, 12000, 14000, 16000, 18000, 20000, 25000];
    var FB_STITCH_COUNTS = [25000, 30000, 35000, 40000, 45000, 50000];

    var pricing = null;   // populated from API

    /* ---------------------- Helpers ---------------------- */

    function formatPrice(price) {
        if (price == null || isNaN(price)) return '—';
        return '$' + Number(price).toFixed(2);
    }

    function getTierForQuantity(qty) {
        if (qty <= 7) return '1-7';
        if (qty <= 23) return '8-23';
        if (qty <= 47) return '24-47';
        if (qty <= 71) return '48-71';
        return '72+';
    }

    function calculateUnitPriceWithLTM(baseUnitPrice, quantity, ltmThreshold, ltmFee) {
        if (quantity > 0 && quantity <= ltmThreshold) {
            var ltmPerPiece = ltmFee / quantity;
            return {
                finalUnitPrice: baseUnitPrice + ltmPerPiece,
                ltmPerPiece: ltmPerPiece,
                hasLtm: true
            };
        }
        return { finalUnitPrice: baseUnitPrice, ltmPerPiece: 0, hasLtm: false };
    }

    /* ---------------------- Data fetch ---------------------- */

    async function fetchContractPricing() {
        // Same endpoint embroidery-pricing-all.js uses for the Contract tab.
        // Returns { garments, caps, fullBack, ltmFee, ltmThreshold }.
        var response = await fetch(API_BASE_URL + '/api/contract-pricing');
        if (!response.ok) {
            throw new Error('Contract pricing API error: ' + response.status);
        }
        var data = await response.json();
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
    }

    /* ---------------------- Matrix builders ---------------------- */

    function buildGarmentsMatrix() {
        var tbody = document.querySelector('#ecGarmentsMatrix tbody');
        if (!tbody) return;
        if (!pricing || !pricing.garments || !pricing.garments.perThousandRates) {
            tbody.innerHTML = '<tr><td colspan="6" class="error-cell">Contract pricing not available</td></tr>';
            return;
        }
        var rates = pricing.garments.perThousandRates;
        var html = '';
        CONTRACT_STITCH_COUNTS.forEach(function (stitches) {
            html += '<tr>';
            html += '<td>' + (stitches / 1000).toFixed(0) + 'K</td>';
            TIER_ORDER.forEach(function (tier, idx) {
                var price = (stitches / 1000) * rates[tier];
                var cellClass = idx <= 1 ? 'ltm-col' : (idx === TIER_ORDER.length - 1 ? 'best-col' : '');
                html += '<td class="' + cellClass + '">' + formatPrice(price) + '</td>';
            });
            html += '</tr>';
        });
        html += '<tr class="rate-footer"><td><strong>$/1K</strong></td>';
        TIER_ORDER.forEach(function (tier, idx) {
            var cellClass = idx <= 1 ? 'ltm-col' : (idx === TIER_ORDER.length - 1 ? 'best-col' : '');
            html += '<td class="' + cellClass + '"><strong>' + formatPrice(rates[tier]) + '</strong></td>';
        });
        html += '</tr>';
        tbody.innerHTML = html;
    }

    function buildCapsMatrix() {
        var tbody = document.querySelector('#ecCapsMatrix tbody');
        if (!tbody) return;
        if (!pricing || !pricing.caps || !pricing.caps.perThousandRates) {
            tbody.innerHTML = '<tr><td colspan="6" class="error-cell">Contract pricing not available</td></tr>';
            return;
        }
        var rates = pricing.caps.perThousandRates;
        var html = '';
        CONTRACT_STITCH_COUNTS.forEach(function (stitches) {
            html += '<tr>';
            html += '<td>' + (stitches / 1000).toFixed(0) + 'K</td>';
            TIER_ORDER.forEach(function (tier, idx) {
                var price = (stitches / 1000) * rates[tier];
                var cellClass = idx <= 1 ? 'ltm-col' : (idx === TIER_ORDER.length - 1 ? 'best-col' : '');
                html += '<td class="' + cellClass + '">' + formatPrice(price) + '</td>';
            });
            html += '</tr>';
        });
        html += '<tr class="rate-footer"><td><strong>$/1K</strong></td>';
        TIER_ORDER.forEach(function (tier, idx) {
            var cellClass = idx <= 1 ? 'ltm-col' : (idx === TIER_ORDER.length - 1 ? 'best-col' : '');
            html += '<td class="' + cellClass + '"><strong>' + formatPrice(rates[tier]) + '</strong></td>';
        });
        html += '</tr>';
        tbody.innerHTML = html;
    }

    function buildFullBackMatrix() {
        var tbody = document.querySelector('#ecFullBackMatrix tbody');
        if (!tbody) return;
        if (!pricing || !pricing.fullBack || !pricing.fullBack.perThousandRates) {
            tbody.innerHTML = '<tr><td colspan="6" class="error-cell">Full Back pricing not available</td></tr>';
            return;
        }
        var rates = pricing.fullBack.perThousandRates;
        var minPrice = pricing.fullBack.minPrice;
        var html = '';
        FB_STITCH_COUNTS.forEach(function (stitches) {
            html += '<tr>';
            html += '<td>' + (stitches / 1000).toFixed(0) + 'K</td>';
            TIER_ORDER.forEach(function (tier, idx) {
                var stitchesK = stitches / 1000;
                var price = Math.max(stitchesK * rates[tier], minPrice);
                var cellClass = idx <= 1 ? 'ltm-col' : (idx === TIER_ORDER.length - 1 ? 'best-col' : '');
                html += '<td class="' + cellClass + '">' + formatPrice(price) + '</td>';
            });
            html += '</tr>';
        });
        html += '<tr class="rate-footer"><td><strong>$/1K</strong></td>';
        TIER_ORDER.forEach(function (tier, idx) {
            var cellClass = idx <= 1 ? 'ltm-col' : (idx === TIER_ORDER.length - 1 ? 'best-col' : '');
            html += '<td class="' + cellClass + '"><strong>' + formatPrice(rates[tier]) + '</strong></td>';
        });
        html += '</tr>';
        tbody.innerHTML = html;
    }

    /* ---------------------- Quick calculator ---------------------- */

    function recalculate() {
        var typeEl = document.getElementById('ecItemType');
        var qtyEl = document.getElementById('ecQuantity');
        var stitchesEl = document.getElementById('ecStitches');
        var breakdownLabel = document.getElementById('ecBreakdownLabel');
        var breakdownValue = document.getElementById('ecBreakdownValue');
        var ltmRow = document.getElementById('ecLtmBreakdownRow');
        var ltmValue = document.getElementById('ecLtmBreakdownValue');
        var finalEl = document.getElementById('ecFinalUnitPrice');
        if (!typeEl || !qtyEl || !stitchesEl || !pricing) return;

        var itemType = typeEl.value;
        var qty = Math.max(1, parseInt(qtyEl.value, 10) || 1);
        var stitches = Math.max(1000, parseInt(stitchesEl.value, 10) || 8000);
        var tier = getTierForQuantity(qty);

        var rates;
        if (itemType === 'cap') {
            rates = pricing.caps && pricing.caps.perThousandRates;
        } else {
            // 'garment' and 'laser-patch' both use garment matrix rates per
            // the existing contract tab logic (the laser-patch upgrade fee
            // is handled separately in the corporate calculator; on the
            // contract page we just price the base embroidery).
            rates = pricing.garments && pricing.garments.perThousandRates;
        }
        if (!rates || rates[tier] == null) {
            finalEl.textContent = '—';
            return;
        }

        var ratePer1K = rates[tier];
        var baseUnit = (stitches / 1000) * ratePer1K;

        var ltm = calculateUnitPriceWithLTM(baseUnit, qty, pricing.ltmThreshold, pricing.ltmFee);

        breakdownLabel.textContent = (stitches / 1000).toFixed(0) + 'K × $' + ratePer1K.toFixed(2) + '/1K:';
        breakdownValue.textContent = formatPrice(baseUnit);

        if (ltm.hasLtm) {
            ltmRow.classList.remove('hidden');
            ltmValue.textContent = '+' + formatPrice(ltm.ltmPerPiece);
        } else {
            ltmRow.classList.add('hidden');
        }

        finalEl.textContent = formatPrice(ltm.finalUnitPrice);
    }

    /* ---------------------- URL params (share link in/out) ---------------------- */

    function readUrlParams() {
        var params = new URLSearchParams(window.location.search);
        var type = params.get('type');
        var qty = params.get('qty');
        var stitches = params.get('stitches');
        var typeEl = document.getElementById('ecItemType');
        var qtyEl = document.getElementById('ecQuantity');
        var stitchesEl = document.getElementById('ecStitches');
        if (type && typeEl && ['garment', 'cap', 'laser-patch'].indexOf(type) !== -1) {
            typeEl.value = type;
        }
        if (qty && qtyEl && !isNaN(parseInt(qty, 10))) {
            qtyEl.value = parseInt(qty, 10);
        }
        if (stitches && stitchesEl && !isNaN(parseInt(stitches, 10))) {
            stitchesEl.value = parseInt(stitches, 10);
        }
    }

    function buildShareUrl() {
        var typeEl = document.getElementById('ecItemType');
        var qtyEl = document.getElementById('ecQuantity');
        var stitchesEl = document.getElementById('ecStitches');
        var url = new URL(window.location.href);
        // Reset to clean origin+pathname so we don't accumulate cruft from
        // previous shares (?cb=... etc.).
        url.search = '';
        url.searchParams.set('type', typeEl.value);
        url.searchParams.set('qty', qtyEl.value);
        url.searchParams.set('stitches', stitchesEl.value);
        return url.toString();
    }

    function showToast() {
        var toast = document.getElementById('ecShareToast');
        if (!toast) return;
        toast.classList.add('is-visible');
        setTimeout(function () { toast.classList.remove('is-visible'); }, 2400);
    }

    async function copyShareLink() {
        var url = buildShareUrl();
        try {
            await navigator.clipboard.writeText(url);
            showToast();
        } catch (err) {
            // Fallback for old browsers: select an offscreen textarea and execCommand('copy')
            var ta = document.createElement('textarea');
            ta.value = url;
            ta.style.position = 'fixed';
            ta.style.opacity = '0';
            document.body.appendChild(ta);
            ta.select();
            try { document.execCommand('copy'); showToast(); } catch (e) { /* swallow */ }
            document.body.removeChild(ta);
        }
    }

    /* ---------------------- Init ---------------------- */

    async function init() {
        // Pre-fill from URL params BEFORE the first calc runs so the
        // calculator displays the customer-shared quote on first paint.
        readUrlParams();

        try {
            pricing = await fetchContractPricing();
        } catch (err) {
            console.error('[contract-embroidery] Failed to load pricing:', err);
            var finalEl = document.getElementById('ecFinalUnitPrice');
            if (finalEl) finalEl.textContent = 'Pricing unavailable';
            return;
        }

        buildGarmentsMatrix();
        buildCapsMatrix();
        buildFullBackMatrix();

        // Wire up live recalculation
        ['ecItemType', 'ecQuantity', 'ecStitches'].forEach(function (id) {
            var el = document.getElementById(id);
            if (el) el.addEventListener('input', recalculate);
            if (el) el.addEventListener('change', recalculate);
        });

        // Share button
        var shareBtn = document.getElementById('ecShareBtn');
        if (shareBtn) shareBtn.addEventListener('click', copyShareLink);

        // First calc
        recalculate();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
