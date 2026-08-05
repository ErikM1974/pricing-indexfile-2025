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

    // Rule #6: read the proxy URL from the shared config (config/app.config.js,
    // loaded just before this script). Literal fallback kept only so the page
    // still works if that config script ever fails to load.
    var API_BASE_URL = (window.APP_CONFIG && window.APP_CONFIG.API && window.APP_CONFIG.API.BASE_URL)
        || 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';

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
        // Round 12 (2026-08-04): facts parsed from a dropped .DST file, or
        // null when the rep is typing the stitch count by hand. Immutable
        // snapshot of the file — presentation (min-clamp note, full-back
        // suggestion) is derived fresh in renderDstCard() on every change.
        // This is LOCATION 1; state.product/stitches are its product + count.
        dst: null,            // {name, label, stitches, widthMM, heightMM, colors, trims, stats, risk, thumb}
        // Round 13 (2026-08-05): locations 2+ on the SAME garments (left chest
        // + full back). Each owns its product + stitch count; quantity is
        // shared. Empty array = the single-location behaviour that shipped in
        // Round 12, unchanged.
        extraLines: [],       // [{id, product, stitches, file, primary:false}]
    };

    /* ---------------------- Helpers ---------------------- */

    function fmtMoney(n) {
        if (n == null || isNaN(n)) return '0.00';
        return Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    function fmtInt(n) { return Number(n || 0).toLocaleString('en-US'); }

    // Round 12 (2026-08-04): stitch counts are no longer always round
    // thousands — a parsed DST gives e.g. 9,412. "9.41K" for odd counts,
    // "8K" for round ones. The MATH always uses the exact count; this is
    // display only.
    function fmtK(stitches) {
        return (stitches / 1000).toFixed(2).replace(/\.?0+$/, '') + 'K';
    }

    function fmtInches(mm) {
        return (mm / 25.4).toFixed(1).replace(/\.0$/, '') + '"';
    }

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
        // Round 13 (2026-08-05): price EVERY decorated location and combine.
        // With one location this is arithmetically identical to the Round 8
        // single-line path (jest-locked in dst-quote-math.test.js), so the
        // common case is unchanged.
        var result = priceAllLines();
        var calc = result ? result.priced[0].calc : null;
        var combo = result ? result.combo : null;
        var multi = result ? result.priced.length > 1 : false;

        // Result panel — header + hero price (all-in)
        document.getElementById('resProductLabel').textContent =
            multi ? result.priced.length + ' locations' : p.label;
        if (calc && combo) {
            document.getElementById('resTier').textContent = 'Tier ' + TIER_LABELS[calc.tierIdx];
            document.getElementById('unitPrice').textContent = fmtMoney(combo.finalUnit);
            // Sub-line — rate breakdown for a single location; a combined
            // summary once there are several (the per-location rates are
            // spelled out in the breakdown list below).
            var subText;
            if (multi) {
                subText = '<b>$' + fmtMoney(combo.baseUnit) + '</b> across ' +
                    result.priced.length + ' locations';
            } else {
                subText = fmtK(state.stitches) + ' × <b>$' + calc.rate.toFixed(2) + '/1K</b>';
                if (calc.minChargeApplied) subText += ' · min charge applied';
            }
            if (combo.hasLtm) {
                subText += ' · incl. $' + fmtMoney(combo.ltmFee) + ' LTM ÷ ' + state.qty +
                    ' = <b>+$' + fmtMoney(combo.ltmPerPiece) + '/pc</b>';
            }
            document.getElementById('unitSub').innerHTML = subText;
        } else {
            document.getElementById('resTier').textContent = '—';
            document.getElementById('unitPrice').textContent = '—';
            document.getElementById('unitSub').innerHTML = 'Pricing unavailable';
        }

        renderResultLines(result);

        // Single Order Total card (replaces Subtotal + LTM cards)
        var orderTotal = combo ? combo.orderTotal : 0;
        document.getElementById('orderTotal').textContent = '$' + fmtMoney(orderTotal);
        var orderTotalNote = document.getElementById('orderTotalNote');
        if (orderTotalNote) {
            orderTotalNote.textContent = combo
                ? fmtInt(state.qty) + ' × $' + fmtMoney(combo.finalUnit)
                : '';
        }

        // LTM helper chip — REMOVED in Round 9 (2026-05-14). The table's
        // intersection cell now shows the all-in price, matching the hero —
        // no gap to explain, no warning needed. Defensive null-check kept
        // in case the markup ever returns.
        var ltmHelp = document.getElementById('ltmHelp');
        if (ltmHelp) ltmHelp.hidden = !(combo && combo.hasLtm);
    }

    /** Per-location breakdown under the hero. Hidden for a single location. */
    function renderResultLines(result) {
        var host = document.getElementById('resLines');
        if (!host) return;
        host.textContent = '';
        if (!result || result.priced.length < 2) { host.hidden = true; return; }
        host.hidden = false;
        result.priced.forEach(function (pr, i) {
            var li = document.createElement('li');
            var name = document.createElement('span');
            name.className = 'rl-name';
            // File name is user data — textContent, never innerHTML.
            name.textContent = (pr.line.file ? pr.line.file.name : PRODUCT_META[pr.product].label);
            var meta = document.createElement('span');
            meta.className = 'rl-meta';
            meta.textContent = PRODUCT_META[pr.product].label + ' · ' + fmtK(pr.stitches);
            var amt = document.createElement('span');
            amt.className = 'rl-amt';
            amt.textContent = '$' + fmtMoney(pr.unit);
            li.appendChild(name);
            li.appendChild(meta);
            li.appendChild(amt);
            host.appendChild(li);
        });
    }

    /* ---------------------- Segmented picker + presets ---------------------- */

    function renderSegmentedActiveStates() {
        // Item type picker
        var itemBtns = document.querySelectorAll('#segItemType button');
        for (var i = 0; i < itemBtns.length; i++) {
            var itemActive = itemBtns[i].getAttribute('data-product') === state.product;
            itemBtns[i].classList.toggle('active', itemActive);
            // Keep ARIA in sync with the visual state — the container is a
            // role="tablist", so each button must report aria-selected.
            itemBtns[i].setAttribute('aria-selected', itemActive ? 'true' : 'false');
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
        // Round 13: the all-in intersection swap is only honest for a SINGLE
        // location. With a combo the hero price is the sum across locations,
        // so stamping it into one location's rate cell would misread as that
        // location costing the whole quote.
        var productMatches = state.product === state.tableProduct && state.extraLines.length === 0;
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
        var result = priceAllLines();
        if (!result) return;
        var combo = result.combo;
        // Customer-friendly format — single per-piece price (LTM built in), no
        // separate "LTM fee" jargon that the customer would need to decode.
        var ltmNote = combo.hasLtm
            ? ' (incl. $' + fmtMoney(combo.ltmPerPiece) + ' LTM/pc)'
            : '';
        var lines = [];
        if (result.priced.length > 1) {
            lines.push(fmtInt(state.qty) + ' pcs · ' + result.priced.length + ' locations');
            result.priced.forEach(function (pr) {
                lines.push('  · ' + PRODUCT_META[pr.product].label + ' ' +
                    fmtK(pr.stitches) + ' stitches — $' + fmtMoney(pr.unit) + '/pc');
            });
        } else {
            lines.push(PRODUCT_META[state.product].label + ' · ' + fmtInt(state.qty) +
                ' pcs · ' + fmtK(state.stitches) + ' stitches');
        }
        lines.push('Unit: $' + fmtMoney(combo.finalUnit) + ' / piece' + ltmNote +
            '  •  Total: $' + fmtMoney(combo.orderTotal));
        copyToClipboard(lines.join('\n'))
            .then(function () { showToast('Quote text copied'); })
            .catch(function () { showToast('Couldn\'t copy — try again'); });
    }

    /* ---------------------- Product switching ---------------------- */

    // ONE path for changing the item type — used by the segmented picker and
    // the DST card's suggestion button. Keeps the "bump stitches below the
    // new product's minimum" rule in a single place.
    function setProduct(newProduct) {
        if (!PRODUCT_META[newProduct] || newProduct === state.product) return;
        state.product = newProduct;
        state.tableProduct = newProduct;
        var newMin = minStitchesFor(newProduct);
        if (state.stitches < newMin) state.stitches = newMin;
        document.getElementById('stitch').value = state.stitches;
        renderStitchPresets();
        renderSegmentedActiveStates();
        renderCalculator();
        renderPriceTable();
        renderDstCard();
        if (aiState.opened) updateContextPill();
    }

    /* =====================================================
       DST stitch files → exact stitch counts, per LOCATION
       (Round 12, 2026-08-04 · multi-location + production read Round 13, 2026-08-05)

       Contract partners hold the production DST — drop it on the
       calculator and the quote prices from the file's ACTUAL stitch
       count instead of a typed guess. Parsing is fully client-side
       via /pages/js/dst-parser.js (shared with the Embroidery
       Studio, jest-locked) — the file never leaves the browser and
       no new pricing path is created: each parsed count flows into
       the same computeUnit() per-1K × tier math as a typed count,
       and DSTQuoteMath.combineLines only SUMS the already-priced
       locations and picks the LTM.

       STATE MODEL — deliberately additive so the single-location
       behaviour is bit-for-bit what shipped in Round 12:
         state.product / state.stitches  →  location 1, driven by the
                                            top picker + stitch input
         state.dst                       →  location 1's file (or null)
         state.extraLines[]              →  locations 2+, each owning
                                            its own product + stitches
       With extraLines empty, combineLines([one]) returns exactly what
       calculateUnitPriceWithLTM used to (jest-locked in
       tests/unit/dst-quote-math.test.js).
       ===================================================== */

    var QuoteMath = window.DSTQuoteMath;

    // Locations 2+ ; location 1 lives in state.product/stitches/dst.
    var nextLineId = 1;

    // Contract minimums come from Caspio where the API supplies them (the
    // "pricing = API, never hardcoded" rule) — PRODUCT_META is the offline
    // fallback only. Without this, the full-back SUGGESTION would trigger at
    // the API's minimum while the CLAMP used the hardcoded 25K, so a Caspio
    // change would quietly split the two apart.
    function minStitchesFor(product) {
        if (product === 'fullback' && pricing && pricing.fullBack && pricing.fullBack.minStitches) {
            return pricing.fullBack.minStitches;
        }
        return PRODUCT_META[product].minStitches;
    }

    /** Every decorated location, location 1 first. */
    function allLines() {
        var lines = [{
            id: 0,
            product: state.product,
            stitches: state.stitches,
            file: state.dst,
            primary: true
        }];
        for (var i = 0; i < state.extraLines.length; i++) lines.push(state.extraLines[i]);
        return lines;
    }

    /**
     * The stitch count a location is actually PRICED at.
     *
     * A location's raw `stitches` is whatever is in its input, including the
     * half-typed states ("2" on the way to "26000"). Clamping the input itself
     * on every keystroke makes any count whose prefix is below the minimum
     * impossible to type, so the minimum is enforced HERE — the quote can
     * never price below contract minimum, and typing still works.
     */
    function effectiveStitches(line) {
        return Math.max(minStitchesFor(line.product), Number(line.stitches) || 0);
    }

    /** Price every location through the ONE pricing function, then combine. */
    function priceAllLines() {
        var lines = allLines();
        var priced = [];
        for (var i = 0; i < lines.length; i++) {
            var calc = computeUnit(lines[i].product, state.qty, effectiveStitches(lines[i]));
            if (!calc) return null;               // pricing not loaded → caller shows the error state
            priced.push({
                line: lines[i],
                calc: calc,
                unit: calc.unit,
                product: lines[i].product,
                // The count this line is actually priced at — always use THIS
                // for display and saving, never line.stitches (which can hold
                // a half-typed value).
                stitches: effectiveStitches(lines[i])
            });
        }
        var combo = QuoteMath.combineLines(priced, state.qty, {
            threshold: pricing ? pricing.ltmThreshold : 23,
            feeFor: ltmFeeForProduct
        });
        return { priced: priced, combo: combo };
    }

    /** LTM band for a product. Full back carries its own higher fee. */
    function ltmFeeForProduct(product) {
        return product === 'fullback' ? 100 : (pricing ? pricing.ltmFee : 50);
    }

    /* =====================================================
       Round 14 (2026-08-05) — reorder recall + staff margin

       RECALL: contract business is repeat business. Every dropped file is
       fingerprinted (SHA-256 of the bytes) and, once a quote is saved, the
       fingerprint remembers which quote it became. Re-drop the same file and
       the card says so. Deliberately localStorage: exact matches, no false
       positives, no schema change — and it is Ruthie's desk that quotes.

       MARGIN: staff-only. See the big comment on the markup — this page is
       PUBLIC, so the rates arrive from a requireStaff endpoint and a 401
       (i.e. anyone who is not signed-in staff) leaves the panel unrendered.
       ===================================================== */

    var RECALL_KEY = 'nwca.contractEmb.fileHistory.v1';
    var RECALL_MAX = 60;               // newest-first; keeps localStorage bounded

    function loadRecall() {
        try {
            var raw = JSON.parse(localStorage.getItem(RECALL_KEY));
            return Array.isArray(raw) ? raw : [];
        } catch (e) { return []; }     // corrupt/again-quota → behave as empty
    }

    function saveRecall(list) {
        try {
            localStorage.setItem(RECALL_KEY, JSON.stringify(list.slice(0, RECALL_MAX)));
        } catch (e) { /* quota or private mode — recall is a nicety, never fatal */ }
    }

    function recallFor(fp) {
        if (!fp) return null;
        var list = loadRecall();
        for (var i = 0; i < list.length; i++) if (list[i].fp === fp) return list[i];
        return null;
    }

    /** Record (or refresh) what a fingerprint became. Newest entry first. */
    function rememberQuote(fp, entry) {
        if (!fp) return;
        var list = loadRecall().filter(function (e) { return e.fp !== fp; });
        list.unshift(Object.assign({ fp: fp }, entry));
        saveRecall(list);
    }

    /** Stamp every currently-loaded file with the quote it just became. */
    function rememberCurrentQuote(quoteID) {
        var result = priceAllLines();
        if (!result) return;
        var nowISO = new Date().toISOString();
        result.priced.forEach(function (pr) {
            var f = pr.line.file;
            if (!f || !f.fp) return;
            rememberQuote(f.fp, {
                name: f.name,
                stitches: f.stitches,
                quoteID: quoteID || null,
                qty: state.qty,
                unit: Number(pr.unit.toFixed(2)),
                product: pr.product,
                at: nowISO
            });
        });
        renderDstCard();   // the card can now say "quoted before"
    }

    /* ---------- staff cost model ---------- */

    // null = not fetched yet · false = not staff (401) · object = staff
    var costModel = null;

    function loadCostModel() {
        // Same-origin by design: the gate is the app's SAML session cookie, and
        // API_BASE_URL (the proxy) has no session to check.
        return fetch('/api/contract-embroidery/cost-model', { credentials: 'same-origin' })
            .then(function (r) {
                if (r.status === 401 || r.status === 403) { costModel = false; return null; }
                if (!r.ok) throw new Error('cost-model returned ' + r.status);
                return r.json();
            })
            .then(function (data) {
                if (data) costModel = data;
                renderMargin();
            })
            .catch(function (err) {
                // Not a customer-facing failure: the quote is unaffected and the
                // panel simply stays hidden. Logged, never surfaced as an error
                // banner, because for a distributor this path is EXPECTED.
                costModel = false;
                console.warn('[contract-embroidery] cost model unavailable:', err.message);
                renderMargin();
            });
    }

    function renderMargin() {
        var wrap = document.getElementById('dstMargin');
        if (!wrap) return;
        var grid = document.getElementById('dstMarginGrid');
        var result = costModel ? priceAllLines() : null;

        // Machine time only exists when a file is loaded — without one there is
        // no cost basis, so show nothing rather than a made-up number.
        var machineHours = 0;
        if (result) {
            result.priced.forEach(function (pr) {
                if (pr.line.file && pr.line.file.stats) {
                    machineHours += QuoteMath.estimateMachineHours(
                        DSTParser, pr.line.file.stats, state.qty, {}).totalHours;
                }
            });
        }
        var m = (result && machineHours > 0)
            ? QuoteMath.estimateMargin(result.combo.orderTotal, machineHours, costModel, state.qty)
            : null;
        if (!m) { wrap.hidden = true; return; }
        wrap.hidden = false;

        document.getElementById('dstMarginAsOf').textContent =
            'model ' + (costModel.asOf || '—') + ' · $' +
            Number(costModel.productionHourRate).toFixed(2) + '/hr + $' +
            Number(costModel.orderPool).toFixed(0) + ' order';

        grid.textContent = '';
        var neg = m.margin < 0;
        [
            ['Revenue', '$' + fmtMoney(result.combo.orderTotal), ''],
            ['Est. cost', '$' + fmtMoney(m.cost), ''],
            ['Margin', (neg ? '−$' : '$') + fmtMoney(Math.abs(m.margin)), neg ? 'neg' : 'pos'],
            ['Margin %', m.marginPct == null ? '—' : m.marginPct.toFixed(1) + '%', neg ? 'neg' : 'pos']
        ].forEach(function (row) {
            var cell = el('div', 'dm-cell' + (row[2] ? ' ' + row[2] : ''));
            cell.appendChild(el('span', 'dm-k', row[0]));
            cell.appendChild(el('span', 'dm-v', row[1]));
            grid.appendChild(cell);
        });
    }

    function showDstError(msg) {
        var el = document.getElementById('dstError');
        if (!el) return;
        el.textContent = msg;   // textContent — file names are user data (XSS)
        el.hidden = false;
    }

    function clearDstError() {
        var el = document.getElementById('dstError');
        if (el) { el.textContent = ''; el.hidden = true; }
    }

    function currentDstErrorText() {
        var el = document.getElementById('dstError');
        return el && !el.hidden ? el.textContent : '';
    }

    /* ---------- thumbnail ---------- */

    // Small standalone stitch render. Deliberately NOT imported from
    // dst-viewer.js — that renderer is coupled to the Studio's canvas, zoom
    // and palette state. This draws the colour runs at a fixed thumbnail size
    // and returns a data URL, so the heavy points array can be released
    // immediately afterwards (a 60K-stitch design holds ~60K objects).
    var THUMB_PX = 128;

    function renderThumb(parsed) {
        try {
            var bb = parsed.bbox;
            var wMM = Math.max(bb.widthMM, 1), hMM = Math.max(bb.heightMM, 1);
            var scale = (THUMB_PX - 8) / Math.max(wMM, hMM);
            var cv = document.createElement('canvas');
            cv.width = THUMB_PX; cv.height = THUMB_PX;
            var c = cv.getContext('2d');
            if (!c) return null;
            var offX = (THUMB_PX - wMM * scale) / 2;
            var offY = (THUMB_PX - hMM * scale) / 2;
            var X = function (p) { return (p.x - bb.minX) / 10 * scale + offX; };
            var Y = function (p) { return (bb.maxY - p.y) / 10 * scale + offY; };

            c.lineCap = 'round';
            c.lineJoin = 'round';
            c.lineWidth = Math.max(0.7, scale * 0.35);
            c.strokeStyle = 'rgba(52,58,66,0.92)';

            var path = new Path2D();
            var pts = parsed.points;
            var prev = null;
            for (var i = 0; i < pts.length; i++) {
                var p = pts[i];
                if (p.type === DSTParser.STITCH_NORMAL) {
                    if (prev && prev.type === DSTParser.STITCH_NORMAL) {
                        path.moveTo(X(prev), Y(prev));
                        path.lineTo(X(p), Y(p));
                    }
                    prev = p;
                } else {
                    prev = p;   // jumps/colour changes break the run
                }
            }
            c.stroke(path);
            return cv.toDataURL('image/png');
        } catch (e) {
            return null;   // a thumbnail is a nicety; never fail a quote over it
        }
    }

    /* ---------- rendering ---------- */

    function productChip(product, active, onPick) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'dst-chip' + (active ? ' active' : '');
        b.textContent = PRODUCT_META[product].label;
        b.setAttribute('aria-pressed', active ? 'true' : 'false');
        b.addEventListener('click', onPick);
        return b;
    }

    function el(tag, cls, text) {
        var n = document.createElement(tag);
        if (cls) n.className = cls;
        if (text != null) n.textContent = text;
        return n;
    }

    /**
     * Build one location card. `line` is the entry from allLines(); `priced`
     * is its computeUnit result (may be null while pricing loads).
     *
     * Location 1's product + stitch count are owned by the top picker and
     * stitch input, so its card shows facts only — two controls for one value
     * would be ambiguous. Locations 2+ carry their own controls.
     */
    function buildLineCard(line, priced, index, total) {
        var f = line.file;
        var card = el('div', 'dst-card');
        if (!f) card.classList.add('is-manual');

        var head = el('div', 'dst-card-head');
        if (f && f.thumb) {
            var img = document.createElement('img');
            img.className = 'dst-thumb';
            img.src = f.thumb;
            img.alt = '';                 // decorative; the facts below carry the meaning
            head.appendChild(img);
        } else {
            var ico = el('span', 'dst-card-ico');
            ico.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>';
            head.appendChild(ico);
        }

        var names = el('span', 'dst-card-names');
        if (total > 1) names.appendChild(el('span', 'dst-loc-badge', 'Location ' + (index + 1)));
        names.appendChild(el('span', 'dst-file-name', f ? f.name : 'Typed stitch count'));
        if (f && f.label) names.appendChild(el('span', 'dst-file-label', 'Design: ' + f.label));
        head.appendChild(names);

        var price = el('span', 'dst-line-price', priced ? '$' + fmtMoney(priced.unit) : '—');
        price.title = 'Per piece, this location, before LTM';
        head.appendChild(price);

        // Location 1 with no file is the TYPED base line — it is not removable
        // (its stitch count lives in the top input and there is nothing to take
        // away). Rendering a ✕ there gave a live control that silently did
        // nothing; omit it instead.
        if (f || !line.primary) {
            var rm = el('button', 'dst-remove');
            rm.type = 'button';
            rm.setAttribute('aria-label', f
                ? 'Remove ' + f.name
                : 'Remove location ' + (index + 1));
            rm.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6L6 18M6 6l12 12"/></svg>';
            rm.addEventListener('click', function () { removeLine(line); });
            head.appendChild(rm);
        }
        card.appendChild(head);

        if (f) {
            var facts = el('dl', 'dst-facts');
            [['Stitches', fmtInt(f.stitches)],
             ['Size', fmtInches(f.widthMM) + ' × ' + fmtInches(f.heightMM)],
             ['Colors', String(f.colors)],
             ['Trims', String(f.trims)]].forEach(function (pair) {
                var d = el('div', 'df');
                d.appendChild(el('dt', null, pair[0]));
                d.appendChild(el('dd', null, pair[1]));
                facts.appendChild(d);
            });
            card.appendChild(facts);
        }

        // Locations 2+ own their product + stitch controls.
        if (!line.primary) {
            var ctl = el('div', 'dst-line-ctl');
            var chips = el('div', 'dst-chips');
            ['garment', 'cap', 'fullback'].forEach(function (p) {
                chips.appendChild(productChip(p, p === line.product, function () {
                    line.product = p;
                    var min = minStitchesFor(p);
                    if (line.stitches < min) line.stitches = min;
                    refreshAll();
                }));
            });
            ctl.appendChild(chips);

            var sw = el('label', 'dst-line-stitch');
            sw.appendChild(el('span', null, 'Stitches'));
            var inp = document.createElement('input');
            inp.type = 'number';
            inp.className = 'input num';
            inp.min = String(minStitchesFor(line.product));
            inp.step = '500';
            inp.value = String(line.stitches);
            // Live typing must NOT rebuild the card — the rebuild replaces this
            // very input, dropping focus to <body> after one keystroke. Update
            // the prices in place instead, and normalise on blur.
            inp.addEventListener('input', function () {
                var v = parseInt(inp.value, 10);
                line.stitches = isNaN(v) ? 0 : v;
                refreshPricesOnly();
            });
            // 🔴 blur fires on MOUSEDOWN, before the click it belongs to. A full
            // card rebuild here removes the very button being pressed, so its
            // click never dispatches and every ✕/chip needs TWO clicks. Nothing
            // structural changes on blur anyway — effectiveStitches() already
            // clamped during typing — so only normalise the visible value.
            inp.addEventListener('blur', function () {
                line.stitches = effectiveStitches(line);
                inp.value = String(line.stitches);
                refreshPricesOnly();
            });
            sw.appendChild(inp);
            ctl.appendChild(sw);
            card.appendChild(ctl);
        }

        // Reorder recall — this exact file has been quoted before.
        if (f && f.recall) {
            var r = f.recall;
            var rc = el('div', 'dst-recall');
            var when = '';
            try { when = new Date(r.at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); }
            catch (e) { when = ''; }
            var bits = ['Quoted before'];
            if (r.quoteID) bits.push(r.quoteID);
            if (r.qty) bits.push(fmtInt(r.qty) + ' pc' + (r.qty === 1 ? '' : 's'));
            if (r.unit != null) bits.push('$' + fmtMoney(r.unit) + '/pc');
            if (when) bits.push(when);
            rc.appendChild(el('span', 'dst-recall-ico', '↺'));
            rc.appendChild(el('span', null, bits.join(' · ')));
            card.appendChild(rc);
        }

        var notes = buildLineNotes(line);
        notes.forEach(function (n) { card.appendChild(n); });
        return card;
    }

    /**
     * The note + suggestion rows for a location, as a fresh array of nodes.
     * Split out of buildLineCard so refreshPricesOnly() can swap JUST these
     * rows in place — the ✕ and the product chips must survive, because
     * destroying them mid-interaction eats the click.
     */
    function buildLineNotes(line) {
        var out = [];
        var f = line.file;
        if (f) {
            var min2 = minStitchesFor(line.product);
            var target = Math.max(min2, f.stitches);
            // Compare the EFFECTIVE count — a raw half-typed value would make
            // the "edited by hand" note flicker on during typing.
            if (effectiveStitches(line) !== target) {
                var n1 = el('div', 'dst-note');
                n1.appendChild(el('span', null,
                    'Stitch count was edited by hand — the file reads ' + fmtInt(f.stitches) + '.'));
                var b1 = el('button', 'dst-mini-btn', 'Use file count');
                b1.type = 'button';
                b1.addEventListener('click', function () { applyFileCount(line); });
                n1.appendChild(b1);
                out.push(n1);
            } else if (f.stitches < min2) {
                out.push(el('div', 'dst-note',
                    'File sews ' + fmtInt(f.stitches) + ' stitches — priced at the ' +
                    fmtK(min2) + ' contract minimum for ' +
                    PRODUCT_META[line.product].label.toLowerCase() + 's.'));
            }

            // Size-based suggestion that this belongs on another rate table.
            var fbMin = minStitchesFor('fullback');
            var suggestTo = null, suggestMsg = '', suggestBtn = '';
            if (line.product !== 'fullback' && f.stitches >= fbMin) {
                suggestTo = 'fullback';
                suggestMsg = 'Looks like a full-back design (' + fmtK(fbMin) + '+ stitches).';
                suggestBtn = 'Switch to Full Back';
            } else if (line.product === 'fullback' && f.stitches < fbMin) {
                suggestTo = 'garment';
                suggestMsg = 'This file is under the ' + fmtK(fbMin) + ' full-back minimum.';
                suggestBtn = 'Price as Garment';
            }
            if (suggestTo) {
                var sg = el('div', 'dst-suggest');
                sg.appendChild(el('span', null, suggestMsg));
                var sb = el('button', 'dst-mini-btn', suggestBtn);
                sb.type = 'button';
                sb.addEventListener('click', function () {
                    if (line.primary) {
                        setProduct(suggestTo);
                        applyFileCount(line);
                    } else {
                        line.product = suggestTo;
                        applyFileCount(line);
                    }
                });
                sg.appendChild(sb);
                out.push(sg);
            }
        }

        return out;
    }

    /** Re-render every location card from state. */
    function renderDstCard() {
        var host = document.getElementById('dstLines');
        if (!host) return;
        var result = priceAllLines();
        var lines = allLines();
        var drop = document.getElementById('dstDrop');
        var anyFile = lines.some(function (l) { return !!l.file; });

        host.textContent = '';
        // Only render cards once at least one FILE exists — with no file the
        // top picker + stitch input already are the location-1 UI, and an
        // empty "Typed stitch count" card would be pure noise.
        if (anyFile) {
            lines.forEach(function (line, i) {
                host.appendChild(buildLineCard(
                    line,
                    result ? result.priced[i] : null,
                    i,
                    lines.length
                ));
            });
        }

        if (drop) {
            drop.classList.toggle('is-compact', anyFile);
            var strong = drop.querySelector('.dst-drop-text strong');
            var hint = drop.querySelector('.dst-drop-text .hint');
            if (strong) strong.textContent = anyFile ? 'Add another location' : 'Drop the .DST here';
            if (hint) {
                hint.textContent = anyFile
                    ? 'Left chest + full back on the same garments? Drop the second file.'
                    : 'Reads the exact stitch count in your browser — the file never leaves your computer';
            }
            drop.setAttribute('aria-label', anyFile
                ? 'Add another location — drop a .DST or click to browse'
                : 'Drop the .DST here or click to browse');
        }

        renderProductionRead(lines);
        renderMargin();
    }

    /** Advisory production read across every loaded file. Never prices. */
    function renderProductionRead(lines) {
        var wrap = document.getElementById('dstProd');
        var timeEl = document.getElementById('dstTime');
        var risksEl = document.getElementById('dstRisks');
        if (!wrap || !timeEl || !risksEl) return;

        var withFiles = lines.filter(function (l) { return l.file && l.file.stats; });
        if (!withFiles.length) { wrap.hidden = true; return; }
        wrap.hidden = false;

        // Machine time — every location is sewn on every piece, so the run's
        // time is the sum across locations.
        var totalHours = 0, totalStopped = 0;
        withFiles.forEach(function (l) {
            var t = QuoteMath.estimateMachineHours(DSTParser, l.file.stats, state.qty, {});
            totalHours += t.totalHours;
            totalStopped += t.stoppedMin;
        });
        timeEl.textContent = '';
        var big = el('span', 'dst-time-big', fmtHours(totalHours));
        timeEl.appendChild(big);
        timeEl.appendChild(el('span', 'dst-time-sub',
            'single-head machine time for ' + fmtInt(state.qty) + ' pc' + (state.qty === 1 ? '' : 's') +
            (withFiles.length > 1 ? ' across ' + withFiles.length + ' locations' : '') +
            ' · not a delivery date'));

        // Risk flags. Grouped by code so the same problem in two files reads as
        // one entry — but EVERY affected file is named and the WORST instance's
        // detail is kept. (Plain dedupe silently hid the second file's problem,
        // which on a production read is the opposite of the point.)
        risksEl.textContent = '';
        var groups = [];
        var byCode = {};
        withFiles.forEach(function (l) {
            (l.file.risk || []).forEach(function (flag) {
                var g = byCode[flag.code];
                if (!g) {
                    g = byCode[flag.code] = { flag: flag, files: [], worst: Number(flag.value) || 0 };
                    groups.push(g);
                }
                if ((Number(flag.value) || 0) > g.worst) { g.worst = Number(flag.value) || 0; g.flag = flag; }
                if (g.files.indexOf(l.file.name) === -1) g.files.push(l.file.name);
            });
        });
        groups.forEach(function (g) {
            var li = el('li', 'dst-risk ' + g.flag.level);
            li.appendChild(el('span', 'dst-risk-title',
                g.flag.title + (withFiles.length > 1 ? ' · ' + g.files.join(', ') : '')));
            li.appendChild(el('span', 'dst-risk-detail', g.flag.detail));
            risksEl.appendChild(li);
        });
        if (!risksEl.children.length) {
            var ok = el('li', 'dst-risk ok');
            ok.appendChild(el('span', 'dst-risk-title', 'No production flags'));
            ok.appendChild(el('span', 'dst-risk-detail',
                'Stitch length, density, trims and colour changes all read normal.'));
            risksEl.appendChild(ok);
        }
    }

    function fmtHours(h) {
        if (!isFinite(h) || h <= 0) return '—';
        if (h < 1) return Math.round(h * 60) + ' min';
        return h.toFixed(1) + ' hr';
    }

    /* ---------- mutations ---------- */

    /** Push a line's file count into its stitch count (clamped to the minimum). */
    function applyFileCount(line) {
        if (!line.file) return;
        var v = Math.max(minStitchesFor(line.product), line.file.stitches);
        if (line.primary) {
            state.stitches = v;
            document.getElementById('stitch').value = v;
        } else {
            line.stitches = v;
        }
        refreshAll();
    }

    function removeLine(line) {
        if (line.primary) {
            // Deliberate: the stitch count STAYS — removing the file must not
            // zero out a quote the rep is mid-way through.
            state.dst = null;
        } else {
            var i = state.extraLines.indexOf(line);
            if (i > -1) state.extraLines.splice(i, 1);
        }
        clearDstError();
        refreshAll();
        var drop = document.getElementById('dstDrop');
        if (drop) drop.focus();
    }

    /** One redraw path for every mutation that changes the SET of locations. */
    function refreshAll() {
        renderSegmentedActiveStates();
        renderCalculator();
        renderPriceTable();
        renderDstCard();
        if (aiState.opened) updateContextPill();
    }

    /**
     * Redraw prices WITHOUT rebuilding the location cards.
     *
     * Used while a per-location stitch input is being typed into: a full
     * renderDstCard() would replace the focused input mid-keystroke. Only text
     * inside existing cards is rewritten, so focus and caret survive.
     */
    function refreshPricesOnly() {
        renderSegmentedActiveStates();
        renderCalculator();
        renderPriceTable();
        var result = priceAllLines();
        var host = document.getElementById('dstLines');
        if (host) {
            var cards = host.querySelectorAll('.dst-card');
            var lines = allLines();
            for (var i = 0; i < cards.length && i < lines.length; i++) {
                if (result && result.priced[i]) {
                    var pe = cards[i].querySelector('.dst-line-price');
                    if (pe) pe.textContent = '$' + fmtMoney(result.priced[i].unit);
                }
                // Swap ONLY the note/suggest rows — leaving the head (✕) and the
                // product chips untouched so an in-flight click still lands.
                var old = cards[i].querySelectorAll('.dst-note, .dst-suggest');
                for (var k = 0; k < old.length; k++) old[k].parentNode.removeChild(old[k]);
                buildLineNotes(lines[i]).forEach(function (n) { cards[i].appendChild(n); });
            }
        }
        renderProductionRead(allLines());
        renderMargin();
        if (aiState.opened) updateContextPill();
    }

    /* ---------- file intake ---------- */

    // Real production DSTs are tiny (a 63K-stitch jacket back ≈ 190 KB). A
    // multi-MB file is either not a DST or pathological, and decoding it
    // would build millions of point objects and lock the tab before any
    // validity check could run — so bound it before the read.
    var DST_MAX_BYTES = 8 * 1024 * 1024;
    var MAX_LOCATIONS = 6;

    /**
     * Read + validate one file and attach it as a location.
     * Returns a Promise that always RESOLVES (never rejects) so a bad file in
     * a multi-file drop doesn't strand the ones after it.
     */
    function handleDstFile(file, opts) {
        opts = opts || {};
        if (!file) return Promise.resolve(false);
        if (!/\.dst$/i.test(file.name)) {
            showDstError('"' + file.name + '" is not a .DST file. Export the design as ' +
                'Tajima DST from your digitizing software — PES/EXP/JEF aren\'t supported here yet.');
            return Promise.resolve(false);
        }
        if (file.size > DST_MAX_BYTES) {
            showDstError('"' + file.name + '" is ' + (file.size / 1048576).toFixed(1) +
                ' MB — far larger than any real stitch file (a 63,000-stitch back design ' +
                'is about 0.2 MB). Check that this is the DST and not a packed archive.');
            return Promise.resolve(false);
        }
        if (allLines().filter(function (l) { return l.file; }).length >= MAX_LOCATIONS) {
            showDstError('That is ' + MAX_LOCATIONS + ' locations already — more than fits on ' +
                'one garment. Remove one before adding another.');
            return Promise.resolve(false);
        }
        return new Promise(function (resolve) {

        // Keyboard users activate the drop zone itself; it may lose focus when
        // the cards re-render, so remember to re-place it.
        var drop = document.getElementById('dstDrop');
        var hadFocus = drop && drop.contains(document.activeElement);

        var reader = new FileReader();
        reader.onload = function (e) {
            try {
                var data = DSTParser.parse(e.target.result);
                // Tajima DST has no magic bytes — random binary "decodes" into
                // nonsense stitches, and on a PRICING surface that becomes a
                // silent wrong price (Erik's #1 rule). Every real DST declares
                // its record count in the ST: header — refuse loudly when the
                // decoded records disagree with it (25% tolerance absorbs
                // digitizer counting quirks; garbage fails by miles).
                var declared = (data.header && data.header.stitchCount) || 0;
                var decoded = data.stats.totalStitches + data.stats.jumps + data.stats.colorChanges;
                if (!declared || Math.abs(declared - decoded) / declared > 0.25) {
                    throw new Error('the header declares ' + fmtInt(declared) +
                        ' stitches but ' + fmtInt(decoded) +
                        ' decoded — the file looks corrupt or is not a Tajima DST.');
                }
                clearDstError();

                var density = QuoteMath.densityFor(DSTParser, data);
                var buf = e.target.result;
                var facts = {
                    name: file.name,
                    label: (data.header && data.header.label) || '',
                    stitches: data.stats.totalStitches,
                    widthMM: data.bbox.widthMM,
                    heightMM: data.bbox.heightMM,
                    colors: data.stats.totalColors,
                    trims: data.stats.trims,
                    // Kept for the production read; `points` is deliberately NOT
                    // retained — the thumbnail is rasterised here and the array
                    // released so six locations don't pin millions of objects.
                    stats: data.stats,
                    risk: QuoteMath.assessRisk(data, density),
                    thumb: renderThumb(data),
                    // Filled asynchronously below — the card renders immediately
                    // and gains its "quoted before" line a tick later.
                    fp: null,
                    recall: null
                };

                var target;
                if (!state.dst) {
                    state.dst = facts;
                    target = allLines()[0];
                } else {
                    target = {
                        id: nextLineId++,
                        product: state.product === 'fullback' ? 'garment' : state.product,
                        stitches: 0,
                        file: facts,
                        primary: false
                    };
                    // A second file that is clearly a back design lands on the
                    // full-back table rather than making the rep notice.
                    if (facts.stitches >= minStitchesFor('fullback')) target.product = 'fullback';
                    target.stitches = Math.max(minStitchesFor(target.product), facts.stitches);
                    state.extraLines.push(target);
                }
                applyFileCount(target);

                var n = allLines().filter(function (l) { return l.file; }).length;
                var summary = file.name + ' — ' + fmtInt(facts.stitches) + ' stitches read from the file' +
                    (n > 1 ? ' · location ' + n : '');
                if (!opts.quiet) showToast(summary);

                var statusEl = document.getElementById('dstStatus');
                if (statusEl) {
                    statusEl.textContent = summary + '. Quote is now $' +
                        document.getElementById('unitPrice').textContent + ' per piece.';
                }
                // Identity + prior-quote recall. Never blocks the quote: a
                // failed digest just means no "quoted before" line.
                QuoteMath.fingerprint(buf).then(function (fp) {
                    facts.fp = fp;
                    facts.recall = recallFor(fp);
                    renderDstCard();
                }).catch(function () { /* recall is a nicety */ });

                if (hadFocus && drop) drop.focus();
                resolve(true);
            } catch (err) {
                showDstError('Couldn\'t read this DST: ' + err.message);
                resolve(false);
            }
        };
        reader.onerror = function () {
            showDstError('File read failed — try dropping it again.');
            resolve(false);
        };
        reader.readAsArrayBuffer(file);
        });
    }

    /**
     * Load a FileList as separate locations.
     *
     * Reads are SEQUENTIAL on purpose: FileReader resolves on a later tick, so
     * firing them in parallel lets two files both observe "no location 1 yet"
     * and race to claim it — one silently overwrites the other. Chaining also
     * keeps the "Location 1/2/3" numbering matching drop order.
     */
    function handleDstFiles(fileList) {
        var files = Array.prototype.slice.call(fileList || []);
        if (!files.length) return Promise.resolve(0);
        var multi = files.length > 1;
        if (multi) showToast('Reading ' + files.length + ' stitch files as separate locations');
        var loaded = 0;
        var rejected = [];
        return files.reduce(function (chain, f) {
            return chain.then(function () {
                return handleDstFile(f, { quiet: multi }).then(function (ok) {
                    if (ok) { loaded++; return; }
                    // A LATER success calls clearDstError(), which used to wipe
                    // the message explaining why an EARLIER file was rejected —
                    // the file just vanished with no reason given. Collect the
                    // rejections and re-state them once the batch settles.
                    rejected.push({ name: f.name, why: currentDstErrorText() });
                });
            });
        }, Promise.resolve()).then(function () {
            if (rejected.length) {
                if (rejected.length === 1 && rejected[0].why) {
                    showDstError(rejected[0].why);
                } else {
                    showDstError(rejected.length + ' of ' + files.length +
                        ' files could not be used: ' +
                        rejected.map(function (r) { return r.name; }).join(', ') +
                        '. Drop one at a time to see why.');
                }
            }
            if (multi && loaded > 0) {
                showToast(loaded + ' of ' + files.length + ' files loaded as locations');
            }
            return loaded;
        });
    }

    function bindDstEvents() {
        var field = document.getElementById('dstField');
        if (!field) return;
        // Parser or math module failed to load → leave the whole field hidden
        // and the manual stitch input untouched (graceful degradation).
        if (!window.DSTParser || !window.DSTQuoteMath) return;
        field.hidden = false;

        var drop = document.getElementById('dstDrop');
        var input = document.getElementById('dstFileInput');

        drop.addEventListener('click', function () { input.click(); });
        drop.addEventListener('keydown', function (e) {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); }
        });
        input.addEventListener('change', function () {
            handleDstFiles(input.files);
            input.value = '';   // allow re-selecting the same file after ✕
        });

        ['dragover', 'dragenter'].forEach(function (ev) {
            field.addEventListener(ev, function (e) {
                e.preventDefault();
                field.classList.add('dragging');
            });
        });
        field.addEventListener('dragleave', function (e) {
            // dragleave fires when crossing INTO children — only clear when
            // actually leaving the field (relatedTarget null = left window).
            if (!e.relatedTarget || !field.contains(e.relatedTarget)) {
                field.classList.remove('dragging');
            }
        });
        field.addEventListener('drop', function (e) {
            e.preventDefault();
            field.classList.remove('dragging');
            if (!e.dataTransfer || !e.dataTransfer.files.length) return;
            handleDstFiles(e.dataTransfer.files);
        });

        // A drop that misses the target would navigate the tab straight to
        // the file — swallow stray drops at the document level.
        document.addEventListener('dragover', function (e) { e.preventDefault(); });
        document.addEventListener('drop', function (e) { e.preventDefault(); });

        // Hand-edits to location 1's stitch input flip its note row live.
        document.getElementById('stitch').addEventListener('input', renderDstCard);
    }
    /* ---------------------- Event wiring ---------------------- */

    function bindEvents() {
        // Segmented item type picker (Round 12: switch logic extracted to
        // setProduct so the DST card's suggestion button shares ONE path)
        document.getElementById('segItemType').addEventListener('click', function (e) {
            var btn = e.target.closest('button[data-product]');
            if (!btn) return;
            setProduct(btn.getAttribute('data-product'));
        });

        // Quantity input — shared by every location (same garments), so a
        // change re-renders the cards' per-location prices and the run's
        // machine time too.
        var qtyInput = document.getElementById('qty');
        qtyInput.addEventListener('input', function () {
            state.qty = Math.max(1, parseInt(qtyInput.value, 10) || 1);
            renderDstCard();
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
        bindDstEvents();
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

        // SAME-ORIGIN, deliberately (2026-07-29). This chat can reach a
    // lookup_customer tool that returns customer email, phone, address, sales
    // rep and payment terms, so it goes through the app's session-gated
    // forwarder rather than straight to the proxy. The browser holds no
    // credential; the app proves the SAML session and talks to the proxy with
    // the server secret. Do NOT put API_BASE_URL back in front of this.
var AI_ENDPOINT = '/api/contract-embroidery-ai/chat';
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

    // Phase 7.1 (2026-05-14): defensive Markdown-code-fence stripper.
    // The prompt explicitly tells Claude not to wrap structured output
    // in ```fences```, but Claude has a strong habit of wrapping JSON
    // and "formatted output" in fences anyway. This helper strips:
    //   - Leading "```json\n" / "```text\n" / bare "```\n"
    //   - Trailing "\n```"
    //   - Any orphan fence lines mid-text
    // Idempotent on plain text — safe to call unconditionally.
    function stripCodeFences(text) {
        if (!text) return text;
        var out = String(text);
        out = out.replace(/^\s*```[a-zA-Z]*\s*\n/, '');   // leading fence with optional lang
        out = out.replace(/\n\s*```\s*$/, '');             // trailing fence
        out = out.replace(/^```[a-zA-Z]*\s*$/gm, '');      // orphan fence lines
        out = out.replace(/^```\s*$/gm, '');
        return out.trim();
    }

    // Parse the EMAIL DRAFT block emitted by Claude. Returns {to, subject,
    // body} for downstream use (mailto, copy-to-clipboard, save-to-quote).
    function parseEmailDraft(blockText) {
        // blockText is the content between START / END markers (already
        // stripped by the caller). Phase 7.1: strip any Markdown fences
        // the AI may have wrapped the content in.
        blockText = stripCodeFences(blockText);
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

    // Phase 7 (2026-05-14): parse the CUSTOMER_FINAL JSON block emitted
    // by the AI after the pre-flight checklist completes. Returns the
    // parsed object OR null if the block is missing/invalid. Source of
    // truth for the saved quote_sessions row when present.
    function parseCustomerFinal(fullText) {
        var startMarker = 'CUSTOMER_FINAL START';
        var endMarker = 'CUSTOMER_FINAL END';
        var startIdx = fullText.indexOf(startMarker);
        var endIdx = fullText.indexOf(endMarker);
        if (startIdx === -1 || endIdx === -1 || endIdx < startIdx) return null;
        var jsonText = fullText.slice(startIdx + startMarker.length, endIdx).trim();
        // Phase 7.1: strip any Markdown code fences Claude wrapped the JSON
        // in. Without this, JSON.parse fails and we fall back to defaults,
        // which silently undoes the rep's pre-flight answers (tax/shipping).
        jsonText = stripCodeFences(jsonText);
        try {
            var parsed = JSON.parse(jsonText);
            // Minimal sanity check
            if (!parsed || typeof parsed !== 'object') return null;
            return parsed;
        } catch (err) {
            console.warn('[ai-chat] CUSTOMER_FINAL JSON parse failed:', err.message,
                '\nRaw text:', jsonText.slice(0, 200));
            return null;
        }
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
        var cfBundle = opts.cfBundle || null;  // Phase 7: shipping + tax info
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
        // Round 12: exact-count label ("9.41K") — StitchCount already stores
        // the exact integer; the label should not round it away either.
        var stitchLabel = fmtK(calcContext.stitches);
        // Phase 6: fullback uses DECG-FB to match the calculator's
        // segmented-picker label + the corporate embroidery pricing page +
        // ShopWorks. CTR-FB was a Phase 3 mistake; renderer accepts both.
        function skuFor(product) {
            return product === 'cap' ? 'CTR-Cap'
                : product === 'fullback' ? 'DECG-FB'
                : 'CTR-Garmt';
        }
        function locationFor(product) {
            return product === 'cap' ? 'Cap'
                : product === 'fullback' ? 'Full Back'
                : 'Left Chest';
        }
        var skuBase = skuFor(calcContext.product);
        var locationLabel = locationFor(calcContext.product);
        // Round 13: one saved line item per decorated location. Falls back to
        // the single-location shape when `locations` is absent.
        var quoteLocations = (calcContext.locations && calcContext.locations.length)
            ? calcContext.locations
            : [{
                product: calcContext.product,
                productLabel: productLabel,
                stitches: calcContext.stitches,
                unit: calcContext.baseUnit,
                file: calcContext.dstFile ? calcContext.dstFile.name : null,
            }];

        // Phase 7 (+ Phase 8 ship method): assemble shipping + tax + reseller
        // permit data from the cfBundle (pre-flight checklist result).
        // Defaults when no pre-flight ran: shipping=same as billing,
        // tax=taxable, no permit.
        var shippingAddr = '';
        var shippingCity = '';
        var shippingState = '';
        var shippingZip = '';
        var shipMethod = '';
        var taxable = true;
        var resellerPermit = null;
        if (cfBundle) {
            taxable = cfBundle.taxable !== false;
            resellerPermit = cfBundle.reseller_permit || null;
            var s = cfBundle.shipping || {};
            if (s.pickup) {
                shipMethod = 'Customer Pickup';
            } else if (s.same_as_billing) {
                // Leave Shipping* empty; method tells the renderer to display
                // "Same as billing" + Via: <method>. Default UPS Ground if
                // AI omitted (per Phase 8 prompt requirement).
                shipMethod = s.method || 'UPS Ground';
            } else if (s.address || s.city) {
                shippingAddr = s.address || '';
                shippingCity = s.city || '';
                shippingState = s.state || '';
                shippingZip = s.zip || '';
                shipMethod = s.method || 'UPS Ground';
            }
        }

        // Phase 7 (+ Phase 8): Notes lines. Phase 8 dropped the "Shipping to:"
        // line — info now renders on the middle "Ship To" card directly.
        // Phase 9 (2026-05-14): hardcoded the tax-exempt line to a reminder
        // for the rep ("verify WA Reseller Permit on file") instead of a
        // typed-in permit number — Ruthie no longer enters one in the chat.
        var notesLines;
        if (quoteLocations.length > 1) {
            notesLines = ['Contract embroidery quote · ' + quoteLocations.length + ' locations'];
            quoteLocations.forEach(function (loc) {
                notesLines.push('  · ' + loc.productLabel + ' — ' + fmtK(loc.stitches) +
                    ' stitches' + (loc.file ? ' (' + loc.file + ')' : ''));
            });
        } else {
            notesLines = ['Contract embroidery quote · ' + productLabel + ' · ' + stitchLabel + ' stitches'];
        }
        if (cfBundle && !taxable) {
            notesLines.push('Tax-exempt · WA Reseller Permit on file (verify)');
        }

        // 2. Session row.
        // Phase 4: stamp CustomerNumber + Phone + ShipTo address from the
        // lookup snapshot when available (graceful empties otherwise).
        // Phase 5: also stamp Account_Owner / Email_Salesrep (reflects the
        // customer's actual assigned rep instead of always Ruthie) and
        // Payment_Terms (e.g. "Net 10" — shown in Quote Details card).
        // Phase 7: TaxRate flips to 0 when tax-exempt; Shipping* fields hold
        // the destination address (separate from billing on ShipTo*); Notes
        // gets reseller permit + shipping info packed in for the renderer.
        var session = {
            QuoteID: quoteID,
            SessionID: 'cemb_ai_' + Date.now() + '_' + Math.random().toString(36).slice(2, 11),
            CustomerEmail: customer.email || '',
            CustomerName: customer.name || 'AI Draft',
            CompanyName: customer.company || '',
            CustomerNumber: customer.customer_number || '',
            Phone: customer.phone || '',
            // ShipTo* = BILLING address (Phase 6 renderer relabel)
            ShipToAddress: customer.address || '',
            ShipToCity: customer.city || '',
            ShipToState: customer.state || '',
            ShipToZip: customer.zip || '',
            // Shipping* = actual shipping address when different from billing
            ShippingAddress: shippingAddr,
            ShippingCity: shippingCity,
            ShippingState: shippingState,
            ShippingZip: shippingZip,
            ShipMethod: shipMethod,
            // Phase 5: rep identity reflects the CRM's account-owner record.
            // Email is still SIGNED by Ruthie in the body (system-prompt
            // locked to Ruthie). Saved record captures the real owner for
            // routing/reporting. Falls back to Ruthie when CRM missing.
            SalesRepEmail: customer.email_salesrep || 'ruth@nwcustomapparel.com',
            SalesRepName: customer.account_owner || 'Ruthie Nhoung',
            // Phase 5: payment terms surface as "Terms: Net 10" in Quote
            // Details card. Empty by default — only set when CRM has one.
            PaymentTerms: customer.payment_terms || '',
            // Phase 7: tax rate — 0 for tax-exempt, 0.102 for taxable (Milton DOR, updated 2026-07-06).
            // Renderer reads this and shows "Tax-exempt" vs "WA Sales Tax".
            TaxRate: taxable ? 0.102 : 0,
            TotalQuantity: calcContext.qty,
            SubtotalAmount: parseFloat(calcContext.orderTotal.toFixed(2)),
            LTMFeeTotal: parseFloat((calcContext.ltmFee || 0).toFixed(2)),
            TotalAmount: parseFloat(calcContext.orderTotal.toFixed(2)),
            Status: 'Open',
            CreatedAt_Quote: nowISO,
            ExpiresAt: expiresISO,
            Notes: notesLines.join('\n'),
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
        //
        // Round 13: ONE row per decorated location. The LTM stays rolled into
        // a per-piece price (the convention every NWCA surface uses — no
        // separate "LTM" invoice row), and it is added to the FIRST line only,
        // because it is one fee per ORDER (Erik 2026-08-04). That keeps
        // Σ LineTotal === session TotalAmount, which is what the quote
        // renderer and ShopWorks both reconcile against.
        // 🔴 Σ LineTotal MUST equal session TotalAmount. The quote renderer sums
        // LineTotal for the products table but prints TotalAmount as the grand
        // total (and taxes it), so any drift shows the customer a table that
        // doesn't add up to its own total. Per-line rounding drifts by cents, so
        // the LAST line absorbs the residual — the standard invoice treatment,
        // and for a single location it reduces to the exact pre-Phase-2 value.
        var ltmPerPiece = Number(calcContext.ltmPerPiece) || 0;
        var orderTotalExact = Number(calcContext.orderTotal) || 0;
        var allocated = 0;
        for (var li = 0; li < quoteLocations.length; li++) {
            var loc = quoteLocations[li];
            var unit = (Number(loc.unit) || 0) + (li === 0 ? ltmPerPiece : 0);
            var isLast = li === quoteLocations.length - 1;
            var lineTotal = isLast
                ? Number((orderTotalExact - allocated).toFixed(2))
                : Number((unit * calcContext.qty).toFixed(2));
            if (!isLast) allocated += lineTotal;
            var locLabel = locationFor(loc.product);
            var item = {
                QuoteID: quoteID,
                LineNumber: li + 1,
                StyleNumber: skuFor(loc.product),
                ProductName: 'Contract ' + (loc.productLabel || productLabel) +
                    ' embroidery · ' + fmtK(loc.stitches) + ' stitches' +
                    (loc.file ? ' · ' + loc.file : ''),
                Quantity: calcContext.qty,
                FinalUnitPrice: parseFloat(unit.toFixed(2)),
                LineTotal: lineTotal,
                SizeBreakdown: '',
                EmbellishmentType: 'customer-supplied',
                PrintLocation: locLabel,
                PrintLocationName: locLabel,
                AddedAt: nowISO,
            };
            var itemRes = await fetch(proxyBase + '/api/quote_items', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(item),
            });
            if (!itemRes.ok) {
                var t2 = await itemRes.text();
                // Session was saved but a line item failed — log and surface.
                console.warn('[ai-chat] quote_items POST failed on line ' + (li + 1) + ': ' +
                    itemRes.status + ' ' + t2.slice(0, 120) +
                    ' — session ' + quoteID + ' is saved but incomplete.');
                throw new Error('quote_items POST returned ' + itemRes.status +
                    ' on line ' + (li + 1) + ' of ' + quoteLocations.length);
            }
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

            // Phase 10 (2026-05-14): open the saved quote view in a new
            // tab with ?autoPdf=1 so the PDF auto-downloads while Outlook
            // is opening. Ruthie can then drag the PDF into the Outlook
            // compose to attach. mailto: URLs can't carry attachments —
            // this is the pragmatic workaround.
            if (aiState.quoteID) {
                try {
                    // Phase 10.1 (2026-05-14): use the server's clean
                    // /quote/<ID> path route (handled by server.js:4086).
                    // The old /pages/quote-view.html?quoteId=... format
                    // didn't match getQuoteIdFromUrl()'s path regex →
                    // "Quote Not Found" error.
                    var viewUrl = window.location.origin
                        + '/quote/' + encodeURIComponent(aiState.quoteID)
                        + '?autoPdf=1';
                    var w = window.open(viewUrl, '_blank');
                    if (!w) {
                        // Popup blocked — surface a fallback message
                        showToast('Popup blocked — open the quote view manually to download the PDF.');
                    } else {
                        showToast('PDF downloading in a new tab — drag it into Outlook to attach.');
                    }
                } catch (err) {
                    console.warn('[ai-chat] auto-PDF tab open failed:', err);
                }
            }

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
        // Phase 7: if the AI emitted a CUSTOMER_FINAL block (post-pre-flight),
        // use it as the source of truth. Skips all trust-check gymnastics
        // since Ruthie literally just confirmed/edited every field in chat.
        var customer;
        var cfBundle = null;
        if (draft.confirmedCustomer && typeof draft.confirmedCustomer === 'object') {
            var cf = draft.confirmedCustomer;
            var billing = cf.billing || {};
            var shipping = cf.shipping || {};
            customer = {
                email: cf.email || draft.to || '',
                name: cf.name || extractGreetingName(draft.body) || '',
                company: cf.company || '',
                customer_number: cf.customer_number || '',
                phone: cf.phone || '',
                // Billing address → ShipTo* columns (Phase 6 relabels as "Billing")
                address: billing.address || '',
                city: billing.city || '',
                state: billing.state || '',
                zip: billing.zip || '',
                account_owner: cf.account_owner || '',
                email_salesrep: cf.email_salesrep || '',
                payment_terms: cf.payment_terms || '',
            };
            // Phase 7 extras — packed onto a separate bundle for the save call
            cfBundle = {
                shipping: shipping,
                taxable: cf.taxable !== false,         // default true if missing/null
                reseller_permit: cf.reseller_permit || null,
            };
        } else {
            // Pre-flight skipped or AI didn't emit CUSTOMER_FINAL — fall
            // back to the Phase 4/5 lookupSnapshot logic with trust checks.
            var lookup = draft.lookupSnapshot || aiState.lastLookup;
            var draftEmail = (draft.to || '').toLowerCase();
            var lookupEmail = (lookup && lookup.email || '').toLowerCase();
            var lookupTrusted = !!lookup && draftEmail && draftEmail === lookupEmail;
            var greetingFirst = (extractGreetingName(draft.body) || '').toLowerCase();
            var lookupName = (lookup && lookup.contact_name || '');
            var lookupFirst = (lookup && lookup.contact_first || lookupName.split(/\s+/)[0] || '').toLowerCase();
            var nameTrusted = !!lookupName && (
                lookupTrusted ||
                (greetingFirst && lookupFirst && lookupFirst === greetingFirst)
            );
            customer = {
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
                account_owner: (lookupTrusted ? lookup.account_owner : '') || '',
                email_salesrep: (lookupTrusted ? lookup.email_salesrep : '') || '',
                payment_terms: (lookupTrusted ? lookup.payment_terms : '') || '',
            };
        }
        // Phase 4: pass the pre-generated quote ID through so we don't burn
        // a fresh sequence at click-time (the AI's email already references
        // this ID, so they must match).
        saveContractEmbroideryQuote({
            calcContext: calcCtx,
            customer: customer,
            quoteID: aiState.quoteID || null,
            cfBundle: cfBundle,  // Phase 7: shipping + tax info
        })
            .then(function (quoteID) {
                showToast('Saved as ' + quoteID);
                // Round 14: bind every loaded file to the quote it became, so a
                // re-drop months later recalls it.
                rememberCurrentQuote(quoteID);
            })
            .catch(function (err) {
                console.warn('[ai-chat] quote save failed:', err);
                showToast('Email ready. (Couldn\'t save quote — see console.)');
            });
    }

    function buildCalcContext() {
        var result = priceAllLines();
        if (!result) return null;
        var combo = result.combo;
        var calc = result.priced[0].calc;

        // Machine time across every location, for the run.
        var machineHours = 0;
        result.priced.forEach(function (pr) {
            if (pr.line.file && pr.line.file.stats) {
                machineHours += QuoteMath.estimateMachineHours(
                    DSTParser, pr.line.file.stats, state.qty, {}).totalHours;
            }
        });

        return {
            // product/stitches stay LOCATION 1 so an older proxy that only
            // knows the single-location shape still renders a correct quote
            // for the primary location instead of breaking.
            product: state.product,
            qty: state.qty,
            stitches: state.stitches,
            baseUnit: Number(combo.baseUnit.toFixed(2)),
            finalUnit: Number(combo.finalUnit.toFixed(2)),
            ltmFee: combo.ltmFee,
            // Phase 4: include the pre-generated CEMB quote ID so the AI can
            // reference it in the subject + intro. May be null if first
            // message hasn't fired yet OR ensureQuoteID() failed — the AI
            // gracefully omits it in that case.
            quoteID: aiState.quoteID || null,
            ltmPerPiece: Number(combo.ltmPerPiece.toFixed(2)),
            orderTotal: Number(combo.orderTotal.toFixed(2)),
            // Round 12/13: file-derived facts so the AI can write "priced from
            // your file EAGLE_LC.dst — 9,412 stitches" instead of a round
            // number the customer might dispute. dstFile stays LOCATION 1 for
            // back-compat; `locations` carries the full picture.
            dstFile: state.dst ? {
                name: state.dst.name,
                exactStitches: state.dst.stitches,
                widthMM: Number(state.dst.widthMM.toFixed(1)),
                heightMM: Number(state.dst.heightMM.toFixed(1)),
                colors: state.dst.colors,
            } : null,
            locations: result.priced.map(function (pr) {
                var f = pr.line.file;
                return {
                    product: pr.product,
                    productLabel: PRODUCT_META[pr.product].label,
                    stitches: pr.stitches,
                    unit: Number(pr.unit.toFixed(2)),
                    file: f ? f.name : null,
                    exactStitches: f ? f.stitches : null,
                    widthMM: f ? Number(f.widthMM.toFixed(1)) : null,
                    heightMM: f ? Number(f.heightMM.toFixed(1)) : null,
                    colors: f ? f.colors : null,
                };
            }),
            // Advisory production read. The AI is instructed to mention these
            // only as pre-production notes — they never move a price.
            production: machineHours > 0 ? {
                machineHours: Number(machineHours.toFixed(1)),
                risks: result.priced.reduce(function (acc, pr) {
                    var f = pr.line.file;
                    if (f && f.risk) {
                        f.risk.forEach(function (r) {
                            if (!acc.some(function (a) { return a.code === r.code; })) {
                                acc.push({ code: r.code, level: r.level, title: r.title, detail: r.detail });
                            }
                        });
                    }
                    return acc;
                }, []),
            } : null,
            tierLabel: TIER_LABELS[calc.tierIdx],
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
        var multi = ctx.locations && ctx.locations.length > 1;
        pill.innerHTML =
            '<b>' + fmtInt(ctx.qty) + ' ' + (multi ? 'pcs' : label.toLowerCase() + (ctx.qty === 1 ? '' : 's')) + '</b>' +
            ' · ' + (multi
                ? ctx.locations.length + ' locations'
                : fmtK(ctx.stitches) + ' stitches') +
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
        // Phase 7: also capture the CUSTOMER_FINAL JSON block (output
        // before EMAIL DRAFT). The preamble is everything before the
        // FIRST of either marker — we want to strip both administrative
        // blocks from the conversational text.
        var customerFinal = parseCustomerFinal(fullText);
        var preambleEnd = startIdx;
        var customerFinalStartIdx = fullText.indexOf('CUSTOMER_FINAL START');
        if (customerFinalStartIdx !== -1 && customerFinalStartIdx < preambleEnd) {
            preambleEnd = customerFinalStartIdx;
        }
        var preamble = fullText.slice(0, preambleEnd).trim();
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
            // Phase 7: structured customer data from the pre-flight checklist.
            // When present, this is the source of truth for the saved quote
            // (overrides lookupSnapshot). Captured per-draft so each card
            // saves its own checklist state.
            confirmedCustomer: customerFinal,
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

            // Abort the request if the stream stalls (no data for AI_IDLE_MS).
            // Without this, a hung backend leaves isStreaming=true forever and
            // permanently disables the send button.
            var aiController = new AbortController();
            var AI_IDLE_MS = 45000;
            var aiIdleTimer = setTimeout(function () { aiController.abort(); }, AI_IDLE_MS);

            var response = await fetch(AI_ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: aiState.messages,
                    calcContext: buildCalcContext(),
                }),
                signal: aiController.signal,
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
                // Each received chunk extends the idle deadline — only a truly
                // stalled stream trips the abort.
                clearTimeout(aiIdleTimer);
                aiIdleTimer = setTimeout(function () { aiController.abort(); }, AI_IDLE_MS);
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
            var errMsg = (err && err.name === 'AbortError')
                ? "The AI took too long to respond. Please try again, or copy the quote details from the calculator manually."
                : "Hmm, I couldn't reach the AI right now. Please try again in a moment, or copy the quote details from the calculator manually.";
            appendChatBubble('assistant', errMsg, { error: true });
        } finally {
            clearTimeout(aiIdleTimer);
            aiState.isStreaming = false;
            if (sendBtn) sendBtn.disabled = false;
            var ta = document.getElementById('aiChatTextarea');
            if (ta) ta.focus();
        }
    }

    function openAiChatPanel() {
        var panel = document.getElementById('aiChatPanel');
        if (!panel) return;

        // Guard: don't let the AI draft a quote off missing pricing. Without
        // this, buildCalcContext() returns null and the assistant would draft
        // a $0 / blank quote. Mirrors the DTG page's pre-open guard.
        if (!pricing) {
            showToast('Pricing is still loading — try again in a moment.');
            return;
        }

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
        ['qty', 'stitch'].forEach(function (id) {
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
                // Rule #4: never leave stale placeholder pricing on screen when
                // the live fetch fails. Blank every figure so a rep can't mistake
                // the HTML defaults ($172.80 / "Tier 24–47") for a real quote.
                document.getElementById('unitPrice').textContent = '—';
                document.getElementById('unitSub').textContent = 'Pricing unavailable';
                document.getElementById('orderTotal').textContent = '—';
                document.getElementById('orderTotalNote').textContent = '';
                document.getElementById('resTier').textContent = '—';
            });

        bindEvents();

        // Staff cost model. Fire-and-forget: a 401 (every non-staff visitor)
        // simply leaves the margin panel unrendered, and the quote is
        // unaffected either way.
        if (window.DSTQuoteMath) loadCostModel();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
