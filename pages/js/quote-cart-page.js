/**
 * quote-cart-page.js — the customer quote-cart page (/quote-cart →
 * pages/quote-cart.html). Phase 2 of the customer quote-cart project.
 *
 * Design: memory/CUSTOMER_QUOTE_CART_DESIGN_2026-06.md (§Cart) + the
 * Erik-approved cart demo behaviors (CUSTOMER_SITE_REDESIGN decision #17):
 * per-print-type group cards each with its own tier meter (pooling NEVER
 * crosses methods), quantities pool across styles/colors within a method,
 * amber "add N more — any style or color" nudges, honest small-batch lines,
 * one grand total.
 *
 * IRON RULE: zero price math here. Every number comes from
 * QuoteCartEngine.priceCart() (shared_components/js/quote-cart-engine.js),
 * which calls the same authorities the staff quote builders use. The cart
 * re-prices on every load and after every mutation, so a Caspio price change
 * reprices the cart on the next view.
 *
 * Failure posture (Erik's #1 rule): a failed group renders a visible
 * alert-error card with Retry (its items stay editable so the customer can
 * fix below-minimum quantities), and the GRAND TOTAL IS WITHHELD — the
 * engine returns grandTotal:null when any group fails; we never sum around
 * a missing group.
 */
(function () {
    'use strict';

    // ============================================================
    // UTILS
    // ============================================================
    function $(id) { return document.getElementById(id); }

    function escapeHtml(str) {
        if (str == null) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function formatPrice(value) {
        const n = Number(value);
        if (value == null || isNaN(n)) return '—';
        return '$' + n.toFixed(2);
    }

    function num(v) {
        const n = parseFloat(v);
        return isNaN(n) ? 0 : n;
    }

    /** "24-47" → {min:24,max:47} · "72+" → {min:72,max:Infinity} */
    function parseRange(label) {
        const m = String(label || '').match(/^(\d+)\s*-\s*(\d+)/);
        if (m) return { min: parseInt(m[1], 10), max: parseInt(m[2], 10) };
        const p = String(label || '').match(/^(\d+)\s*\+/);
        if (p) return { min: parseInt(p[1], 10), max: Infinity };
        return { min: 0, max: Infinity };
    }

    function alertHtml(kind, title, msg) {
        return '<div class="alert alert-' + kind + '"' + (kind === 'error' ? ' role="alert"' : '') + '>'
            + '<svg class="alert-icon" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">'
            + '<path d="M10 1 1 18h18L10 1zm1 13h-2v2h2v-2zm0-7h-2v5h2V7z"/></svg>'
            + '<div class="alert-body"><strong class="alert-title">' + escapeHtml(title) + '</strong>'
            + '<p>' + escapeHtml(msg) + '</p></div></div>';
    }

    // ============================================================
    // CHROME (masthead drawer + search) — same pattern as product-2026.js
    // ============================================================
    function wireChrome() {
        const sidebar = $('sidebar');
        const overlay = $('sidebarOverlay');
        const openBtn = $('mobileMenuBtn');
        const closeBtn = $('drawerClose');

        function setDrawer(open) {
            if (!sidebar || !overlay) return;
            sidebar.classList.toggle('show', open);
            overlay.classList.toggle('show', open);
            document.body.classList.toggle('drawer-open', open);
        }
        if (openBtn) openBtn.addEventListener('click', function () { setDrawer(true); });
        if (closeBtn) closeBtn.addEventListener('click', function () { setDrawer(false); });
        if (overlay) overlay.addEventListener('click', function () { setDrawer(false); });
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') setDrawer(false);
        });

        const input = $('navSearchInput');
        const btn = $('navSearchBtn');
        function goSearch() {
            const term = (input && input.value || '').trim();
            if (term) window.location.href = '/?q=' + encodeURIComponent(term);
        }
        if (btn) btn.addEventListener('click', goSearch);
        if (input) input.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') goSearch();
        });
    }

    // ============================================================
    // METHOD METADATA + GROUP-OPTION MAPS
    // The placement → engine-options maps mirror product/js/pdp-configurator.js
    // exactly (structural codes, not prices) so a cart reprice is the same
    // engine call the product page previewed.
    // ============================================================
    const ICONS = {
        EMB: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="M5 14c3-4 11-4 14 0"></path><path d="M5 10c3 4 11 4 14 0"></path></svg>',
        CAP: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M4 14a8 8 0 0 1 16 0"></path><path d="M2 16h20l-2 3H4z"></path></svg>',
        DTG: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 3c3 4.5 6 7.7 6 11a6 6 0 1 1-12 0c0-3.3 3-6.5 6-11z"></path></svg>',
        SCP: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="2"></rect><path d="M4 14l16-6"></path></svg>',
        DTF: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="5" y="3" width="14" height="14" rx="2"></rect><path d="M8 21h8"></path><path d="M12 17v4"></path></svg>'
    };

    const METHOD_META = {
        EMB: { label: 'Embroidered garments', unit: 'piece' },
        CAP: { label: 'Embroidered caps', unit: 'cap' },
        DTG: { label: 'DTG print', unit: 'piece' },
        SCP: { label: 'Screen print', unit: 'piece' },
        DTF: { label: 'DTF transfers', unit: 'piece' }
    };

    const DTG_CODES = { leftChest: 'LC', fullFront: 'FF', back: 'FB', frontBack: 'LC_FB' };
    const DTF_LOCS = {
        leftChest: ['left-chest'],
        fullFront: ['full-front'],
        back: ['full-back'],
        frontBack: ['left-chest', 'full-back']
    };

    /** Mirror of the engine's pooling scope (quote-cart-engine.js groupIdForItem). */
    function groupIdFor(item) {
        const m = String(item.method || '').toUpperCase();
        if (m === 'CAP' || (m === 'EMB' && item.isCap === true)) return 'emb:cap';
        if (m === 'EMB') return 'emb:garment';
        if (m === 'DTG') return 'dtg:main';
        if (m === 'DTF') return 'dtf:main';
        if (m === 'SCP') return 'scp:design-1';
        return null;
    }

    /** Engine group options from a stored item's placement choices. */
    function optionsFor(item) {
        const m = String(item.method || '').toUpperCase();
        const loc = item.placement;
        if (m === 'EMB') {
            return {
                logos: {
                    primary: { position: loc === 'back' ? 'Back' : 'Left Chest', stitchCount: 8000, needsDigitizing: false },
                    additional: loc === 'frontBack'
                        ? [{ position: 'Back', stitchCount: 8000, needsDigitizing: false }]
                        : []
                }
            };
        }
        if (m === 'CAP') {
            return {
                logos: {
                    primary: { position: 'Cap Front', stitchCount: 8000, needsDigitizing: false },
                    additional: loc === 'frontBack'
                        ? [{ position: 'Cap Back', stitchCount: 5000, needsDigitizing: false }]
                        : []
                }
            };
        }
        if (m === 'DTG') return { locationCode: DTG_CODES[loc] || 'LC' };
        if (m === 'SCP') {
            return {
                frontColors: Number(item.inkColors) || 1,
                backColors: loc === 'frontBack' ? (Number(item.inkColors) || 1) : 0,
                darkGarment: false,
                safetyStripes: false
            };
        }
        if (m === 'DTF') return { locations: DTF_LOCS[loc] || DTF_LOCS.leftChest };
        return {};
    }

    // ============================================================
    // SHARED EMB CALCULATOR SINGLETON (same pattern as pdp-configurator.js —
    // keeps the calculator's config + size-pricing caches alive across
    // qty-stepper reprices).
    // ============================================================
    let sharedEmbCalc = null;
    function SharedEmbCalc(opts) {
        if (!sharedEmbCalc) {
            sharedEmbCalc = new window.EmbroideryPricingCalculator(opts || { skipInit: true });
        }
        return sharedEmbCalc;
    }
    function resetEmbCalc() { sharedEmbCalc = null; }

    function engineDeps() {
        const deps = {};
        if (window.EmbroideryPricingCalculator) deps.EmbroideryPricingCalculator = SharedEmbCalc;
        return deps;
    }

    // ============================================================
    // STATE + REPRICING
    // ============================================================
    const state = {
        seq: 0,
        repriceTimer: null,
        firstLoad: true,
        items: [],     // store items at last reprice
        priced: null   // last engine result
    };

    function buildCart() {
        const items = window.QuoteCartStore.getItems();
        const engineItems = items.map(function (i) {
            return {
                id: i.id,
                method: i.method,
                styleNumber: i.style,
                title: i.productTitle,
                colorName: i.color,
                catalogColor: i.catalogColor,
                sizes: i.sizes,
                isCap: i.isCap === true
            };
        });
        const groups = {};
        const order = [];
        items.forEach(function (item) {
            const gid = groupIdFor(item);
            if (gid && !groups[gid]) {
                groups[gid] = optionsFor(item);
                order.push(gid);
            }
        });
        return { items: engineItems, groups: groups, order: order, storeItems: items };
    }

    function scheduleReprice() {
        if (state.repriceTimer) clearTimeout(state.repriceTimer);
        state.repriceTimer = setTimeout(reprice, 250);
    }

    async function reprice() {
        const token = ++state.seq;
        const cart = buildCart();
        state.items = cart.storeItems;

        if (cart.items.length === 0) {
            state.priced = null;
            showState('empty');
            return;
        }

        if (state.firstLoad) {
            showState('skeleton');
        } else {
            const layout = $('qcLayout');
            layout.classList.add('is-repricing');
            layout.setAttribute('aria-busy', 'true');
        }

        let res;
        try {
            res = await window.QuoteCartEngine.priceCart(
                { items: cart.items, groups: cart.groups },
                { deps: engineDeps(), nudge: true }
            );
        } catch (err) {
            console.error('[quote-cart] priceCart failed:', err);
            res = {
                groups: [], grandTotal: null, warnings: [],
                errors: [{ groupId: null, method: null, code: 'ENGINE_ERROR', message: err.message }]
            };
            resetEmbCalc(); // un-poison a failed init for the next retry
        }
        if (token !== state.seq) return;

        state.priced = res;
        state.firstLoad = false;
        render(cart, res);
    }

    function showState(which) {
        $('qcSkeleton').hidden = which !== 'skeleton';
        $('qcEmpty').hidden = which !== 'empty';
        $('qcLayout').hidden = which !== 'cart';
        if (which !== 'cart') {
            $('qcLayout').classList.remove('is-repricing');
            $('qcLayout').removeAttribute('aria-busy');
        }
    }

    // ============================================================
    // RENDER
    // ============================================================
    function render(cart, res) {
        showState('cart');
        const layout = $('qcLayout');
        layout.classList.remove('is-repricing');
        layout.removeAttribute('aria-busy');

        // Page-level warnings (fee fallbacks etc. — visible, never silent)
        $('qcAlert').innerHTML = (res.warnings || []).length
            ? alertHtml('warn', 'Heads up', res.warnings.join(' '))
            : '';

        const resultByGid = {};
        (res.groups || []).forEach(function (g) { resultByGid[g.groupId] = g; });
        const errorByGid = {};
        (res.errors || []).forEach(function (e) { errorByGid[e.groupId || '__cart__'] = e; });

        const parts = [];
        cart.order.forEach(function (gid, idx) {
            if (idx > 0) {
                parts.push('<p class="qc-pool-note">Quantity discounts pool <strong>within</strong> each decoration type — styles and colors count together, but print types never combine.</p>');
            }
            const itemsInGroup = state.items.filter(function (it) { return groupIdFor(it) === gid; });
            if (resultByGid[gid]) {
                parts.push(groupCardHtml(gid, resultByGid[gid], itemsInGroup));
            } else {
                parts.push(errorCardHtml(gid, errorByGid[gid] || errorByGid['__cart__'], itemsInGroup));
            }
        });
        $('qcGroups').innerHTML = parts.join('');

        renderTotals(cart, res);
        wireGroupEvents();
    }

    function methodOf(gid, items) {
        if (gid === 'emb:cap') return 'CAP';
        if (gid === 'emb:garment') return 'EMB';
        if (gid === 'dtg:main') return 'DTG';
        if (gid === 'dtf:main') return 'DTF';
        if (items && items[0]) return String(items[0].method || 'SCP').toUpperCase();
        return 'SCP';
    }

    function groupHeadHtml(method, titleSuffix, pooledQty, tierLabel) {
        const meta = METHOD_META[method] || { label: method, unit: 'piece' };
        return '<header class="qc-group-head">'
            + '<span class="qc-group-ico" aria-hidden="true">' + (ICONS[method] || ICONS.SCP) + '</span>'
            + '<h2 class="qc-group-title">' + escapeHtml(meta.label) + (titleSuffix ? ' <span class="qc-group-sub">' + escapeHtml(titleSuffix) + '</span>' : '') + '</h2>'
            + (pooledQty != null
                ? '<span class="qc-group-pool">' + pooledQty + ' ' + meta.unit + (pooledQty === 1 ? '' : 's') + ' pooled</span>'
                : '')
            + (tierLabel
                ? '<span class="badge badge-ok">' + escapeHtml(tierLabel) + ' tier</span>'
                : '')
            + '</header>';
    }

    /** Placement + options summary for the group head ("Left chest · 2-color ink"). */
    function groupOptionsSummary(items) {
        const first = items[0];
        if (!first) return '';
        let s = first.placementLabel || first.placement || '';
        if (first.inkColors != null && String(first.method).toUpperCase() === 'SCP') {
            s += (s ? ' · ' : '') + first.inkColors + '-color ink';
        }
        return s;
    }

    function nextTierMin(gr) {
        const table = gr.trace && gr.trace.tierTable;
        if (Array.isArray(table) && table.length) {
            const next = table.filter(function (t) { return num(t.minQty) > gr.pooledQty; })
                .sort(function (a, b) { return num(a.minQty) - num(b.minQty); })[0];
            return next ? { min: num(next.minQty), label: next.label || null } : null;
        }
        // DTG: derive from the API's own tier label (no table in the response)
        const m = /^(\d+)\s*-\s*(\d+)/.exec(gr.tierLabelBase || gr.tierLabel || '');
        if (m) return { min: parseInt(m[2], 10) + 1, label: null };
        return null;
    }

    /** Tier-progress meter across the method's real (API-label) tier bounds. */
    function meterHtml(gr, unit) {
        const cur = parseRange(gr.tierLabel);
        const next = nextTierMin(gr);
        let pct, rightLabel;
        if (!next) {
            pct = 100;
            rightLabel = 'Best pricing tier unlocked';
        } else {
            const span = Math.max(1, next.min - cur.min);
            pct = Math.round(Math.min(1, Math.max(0.04, (gr.pooledQty - cur.min) / span)) * 100);
            const need = next.min - gr.pooledQty;
            rightLabel = need + ' more to ' + (next.label ? next.label : next.min + '+');
        }
        return '<div class="qc-meter" role="img" aria-label="Tier progress: '
            + gr.pooledQty + ' ' + unit + 's in the ' + escapeHtml(gr.tierLabel || '') + ' tier">'
            + '<div class="qc-meter-bar"><span class="qc-meter-fill" data-meter-fill="' + pct + '"></span></div>'
            + '<div class="qc-meter-labels"><span>' + escapeHtml(gr.tierLabel || '') + ' tier</span>'
            + '<span>' + escapeHtml(rightLabel) + '</span></div>'
            + '</div>';
    }

    function lineRowsHtml(items, gr) {
        // Display footing: in BAKED-LTM mode the line total shown is the
        // full-precision effective unit × qty so "each × qty = line total"
        // reads true (it foots EXACTLY to the engine's group total because
        // effectiveUnit carries fee/categoryQty unrounded). In itemized mode
        // (SCP) the engine's base lineTotal is shown — the fee has its own
        // row. Group/grand totals always come from the engine, never re-summed.
        const baked = !!(gr && gr.ltm && gr.ltm.mode === 'baked' && gr.ltm.fee > 0);
        return items.map(function (item) {
            const lines = gr ? gr.lines.filter(function (l) { return l.itemId === item.id; }) : [];
            const effTotal = lines.reduce(function (s, l) { return s + l.effectiveUnit * l.qty; }, 0);
            const lineTotal = baked ? effTotal : lines.reduce(function (s, l) { return s + l.lineTotal; }, 0);
            const qty = Number(item.qty) || 0;
            // Per-piece effective (LTM share included) — display only.
            let perPiece = null;
            if (lines.length && qty > 0) {
                perPiece = effTotal / qty;
            }
            return '<div class="qc-line" data-item="' + escapeHtml(item.id) + '">'
                + '<div class="qc-line-info">'
                + '<span class="qc-line-name">' + escapeHtml(item.style) + ' — ' + escapeHtml(item.productTitle) + '</span>'
                + '<span class="qc-line-meta">' + escapeHtml(item.color || '') + ' · ' + escapeHtml(item.placementLabel || item.placement || '') + '</span>'
                + '</div>'
                + '<div class="qc-line-qty">'
                + '<button class="qc-step" type="button" data-act="dec" data-id="' + escapeHtml(item.id) + '" aria-label="One fewer">&minus;</button>'
                + '<input type="number" inputmode="numeric" min="1" max="9999" step="1" value="' + qty + '"'
                + ' data-act="qty" data-id="' + escapeHtml(item.id) + '" aria-label="Quantity for ' + escapeHtml(item.style) + '">'
                + '<button class="qc-step" type="button" data-act="inc" data-id="' + escapeHtml(item.id) + '" aria-label="One more">+</button>'
                + '</div>'
                + '<div class="qc-line-price">'
                + '<span class="qc-line-each">' + (perPiece != null ? formatPrice(perPiece) + '/' + (item.isCap ? 'cap' : 'pc') : '—') + '</span>'
                + '<span class="qc-line-total">' + (lines.length ? formatPrice(lineTotal) : '—') + '</span>'
                + '</div>'
                + '<button class="qc-remove" type="button" data-act="remove" data-id="' + escapeHtml(item.id) + '" aria-label="Remove ' + escapeHtml(item.style) + ' from quote">&times;</button>'
                + '</div>';
        }).join('');
    }

    function groupCardHtml(gid, gr, items) {
        const method = gr.method;
        const meta = METHOD_META[method] || { label: method, unit: 'piece' };
        const unit = meta.unit;
        const rows = [];

        rows.push(groupHeadHtml(method, groupOptionsSummary(items), gr.pooledQty, gr.tierLabel));
        rows.push(meterHtml(gr, unit));
        rows.push('<div class="qc-lines">' + lineRowsHtml(items, gr) + '</div>');

        // Per-piece service lines (EMB additional logo / cap back logo / AS surcharges)
        if ((gr.serviceLines || []).length) {
            rows.push('<div class="qc-svc">' + gr.serviceLines.map(function (sl) {
                return '<div class="qc-svc-row"><span>' + escapeHtml(sl.label || sl.code)
                    + ' — ' + formatPrice(sl.unitPrice) + '/' + unit + ' × ' + sl.quantity + '</span>'
                    + '<span class="num">' + formatPrice(sl.total) + '</span></div>';
            }).join('') + '</div>');
        }

        // Order-level fees (SCP screen setup + itemized small-order fee)
        if ((gr.fees || []).length) {
            rows.push('<div class="qc-fees">' + gr.fees.map(function (f) {
                return '<div class="qc-fee-row"><span>' + escapeHtml(f.label)
                    + (f.oneTime ? ' <em>(one-time)</em>' : '') + '</span>'
                    + '<span class="num">' + formatPrice(f.amount) + '</span></div>';
            }).join('') + '</div>');
        }

        // Honest small-batch line (baked modes — the fee is already inside the
        // per-piece price; never re-added)
        if (gr.ltm && gr.ltm.fee > 0 && gr.ltm.mode === 'baked') {
            rows.push('<p class="qc-ltm-note">$' + Math.round(gr.ltm.fee)
                + ' small-batch fee included in the per-piece price ('
                + formatPrice(gr.ltm.perUnit) + '/' + unit + ').</p>');
        }

        // Amber tier nudge (engine-computed effective-per-piece diff)
        if (gr.nudge) {
            const n = gr.nudge;
            const anyStyle = ' — any style or color — ';
            let copy;
            if (n.ltmDisappears) {
                copy = 'Add ' + n.addQty + ' more' + anyStyle + 'and the $' + Math.round(gr.ltm.fee)
                    + ' small-batch fee disappears: ' + formatPrice(n.nextPerPiece) + '/' + unit + '.';
            } else {
                copy = 'Add ' + n.addQty + ' more' + anyStyle + 'to reach the '
                    + escapeHtml(n.nextTierLabel || (n.nextTierMinQty + '+')) + ' tier and pay '
                    + formatPrice(n.nextPerPiece) + '/' + unit
                    + ' (save ' + formatPrice(n.perPieceSavings) + '/' + unit + ').';
            }
            rows.push('<div class="qc-nudge">' + copy + '</div>');
        }

        rows.push('<footer class="qc-group-foot"><span>'
            + escapeHtml(meta.label) + ' subtotal</span><span class="qc-group-total">'
            + formatPrice(gr.groupTotal) + '</span></footer>');

        return '<section class="qc-group" data-gid="' + escapeHtml(gid) + '">' + rows.join('') + '</section>';
    }

    function errorCardHtml(gid, err, items) {
        const method = methodOf(gid, items);
        const rows = [];
        rows.push(groupHeadHtml(method, groupOptionsSummary(items), null, null));
        rows.push(alertHtml('error', 'Unable to price this group',
            (err && err.message ? err.message + ' ' : '')
            + 'The grand total is withheld until every group prices — we never guess at prices.'));
        rows.push('<div class="qc-lines">' + lineRowsHtml(items, null) + '</div>');
        rows.push('<div class="qc-group-retry"><button class="btn btn-primary" type="button" data-act="retry">Retry pricing</button>'
            + '<a class="btn btn-ghost" href="tel:253-922-5793">Call 253-922-5793</a></div>');
        return '<section class="qc-group qc-group-error" data-gid="' + escapeHtml(gid) + '">' + rows.join('') + '</section>';
    }

    function renderTotals(cart, res) {
        const box = $('qcTotalsBody');
        const pieces = state.items.reduce(function (s, it) { return s + (Number(it.qty) || 0); }, 0);
        const groupCount = cart.order.length;
        const rows = [];

        rows.push('<h2 class="qc-totals-title">Quote summary</h2>');
        rows.push('<div class="qc-totals-row"><span>Pieces</span><span class="num">' + pieces + '</span></div>');
        rows.push('<div class="qc-totals-row"><span>Print types</span><span class="num">' + groupCount + '</span></div>');
        (res.groups || []).forEach(function (g) {
            const meta = METHOD_META[g.method] || { label: g.method };
            rows.push('<div class="qc-totals-row"><span>' + escapeHtml(meta.label) + '</span><span class="num">'
                + formatPrice(g.groupTotal) + '</span></div>');
        });

        if (res.grandTotal != null) {
            rows.push('<div class="qc-grand"><span>Grand total</span><span>' + formatPrice(res.grandTotal) + '</span></div>');
        } else {
            rows.push(alertHtml('error', 'Grand total withheld',
                'Part of your quote couldn\'t be priced. Fix or remove the group above — partial totals are wrong prices.'));
        }

        rows.push('<div class="qc-actions">');
        rows.push('<button class="btn btn-cta" type="button" id="qcSaveBtn"'
            + (res.grandTotal == null ? ' disabled title="Fix or remove the unpriced group first"' : '')
            + '>Save &amp; email my quote</button>');
        rows.push('<a class="btn btn-ghost" id="qcEmailQuote" href="' + escapeHtml(buildMailto(res)) + '">Email instead</a>');
        rows.push('<a class="btn btn-ghost" href="/catalog">Keep shopping</a>');
        rows.push('</div>');
        rows.push('<p class="qc-totals-foot">Prices are live from our pricing system and match what our team quotes. '
            + 'WA sales tax and shipping are added when your rep confirms. Final pricing confirmed with your free proof.</p>');

        box.innerHTML = rows.join('');
        syncSavePanel(cart);
    }

    // ============================================================
    // EMAIL (mailto from the full grouped summary — Phase 1 CTA pattern, terse)
    // ============================================================
    function buildMailto(res) {
        const lines = ['Hi NWCA,', '', 'My quote from teamnwca.com:'];
        const items = state.items;
        (res.groups || []).forEach(function (g) {
            const meta = METHOD_META[g.method] || { label: g.method, unit: 'piece' };
            lines.push('');
            lines.push(meta.label.toUpperCase() + ' — ' + g.pooledQty + ' pcs (' + (g.tierLabel || '') + ' tier)');
            items.filter(function (it) { return groupIdFor(it) === g.groupId; })
                .forEach(function (it) {
                    const itLines = g.lines.filter(function (l) { return l.itemId === it.id; });
                    const total = itLines.reduce(function (s, l) { return s + l.lineTotal; }, 0);
                    lines.push('- ' + it.style + ' ' + (it.color || '') + ' x' + it.qty
                        + ' (' + (it.placementLabel || it.placement || '') + ')'
                        + (itLines.length ? ' = $' + total.toFixed(2) : ''));
                });
            (g.serviceLines || []).forEach(function (sl) {
                lines.push('- ' + (sl.label || sl.code) + ' = $' + Number(sl.total).toFixed(2));
            });
            (g.fees || []).forEach(function (f) {
                lines.push('- ' + f.label + ' = $' + Number(f.amount).toFixed(2));
            });
            lines.push('Subtotal: $' + Number(g.groupTotal).toFixed(2));
        });
        (res.errors || []).forEach(function (e) {
            lines.push('');
            lines.push('(One group could not be priced online: ' + (e.message || e.code) + ')');
        });
        lines.push('');
        lines.push(res.grandTotal != null
            ? 'Grand total: $' + Number(res.grandTotal).toFixed(2)
            : 'Grand total: please price for me');
        lines.push('', 'My name:', 'Company:', 'Phone:', '');
        const subject = 'Quote request — my online quote (' +
            state.items.reduce(function (s, it) { return s + (Number(it.qty) || 0); }, 0) + ' pieces)';
        return 'mailto:sales@nwcustomapparel.com?subject=' + encodeURIComponent(subject)
            + '&body=' + encodeURIComponent(lines.join('\n'));
    }

    // ============================================================
    // SAVE / SHARE / EMAIL (Phase 3 — web-quote-service.js, WQ prefix)
    //
    // The panel lives in #qcSavePanel, a SEPARATE container from the
    // re-rendered totals body, so typing survives reprices. All money in the
    // save comes from the engine result; the service re-prices with
    // forceRefresh just before saving and gates on any change (1-cent
    // tolerance) so we never save totals the customer didn't see.
    //
    // Saved quotes are FROZEN snapshots (locked decision): the success panel
    // offers the share link + a request-changes mailto; the cart itself stays
    // editable — edit + save again mints a NEW quote number.
    // ============================================================

    // Dry-run for preview walk-throughs only (localhost + ?dryrun=1): logs the
    // exact payloads instead of POSTing. Production customers can never hit it.
    const DRY_RUN = /[?&]dryrun=1\b/.test(window.location.search)
        && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

    const MAX_ART_BYTES = 20 * 1024 * 1024; // proxy files API cap (custom-tees pattern)
    const ART_OK = /\.(png|jpe?g|gif|webp|svg|pdf)$/i;

    const saveState = {
        open: false,
        phase: 'form',            // form | saving | price-changed | success
        fields: { name: '', email: '', phone: '', company: '', notes: '' },
        files: {},                // gid → File (validated on pick)
        errorMsg: '',
        warnings: [],             // artwork-upload warnings (visible, non-blocking)
        saved: null,              // successful saveQuote result
        emailStatus: null,        // sendEmails result
        gidsKey: ''               // group-set signature at last form render
    };

    function freshEngineDeps() {
        // Fresh authority classes (NOT the page's warm singleton) so the
        // service's forceRefresh reprice really re-fetches config.
        const deps = {};
        if (window.EmbroideryPricingCalculator) deps.EmbroideryPricingCalculator = window.EmbroideryPricingCalculator;
        return deps;
    }

    function gidsKeyOf(cart) { return cart.order.join('|'); }

    function fieldHtml(id, label, type, required, placeholder) {
        return '<div class="field"><label class="field-label" for="' + id + '">' + label
            + (required ? ' <span class="req" aria-hidden="true">*</span>' : '') + '</label>'
            + '<input class="field-input" type="' + type + '" id="' + id + '" data-save-field="' + id.replace('qcSv', '').toLowerCase() + '"'
            + (required ? ' required' : '') + ' placeholder="' + escapeHtml(placeholder || '') + '"'
            + ' value="' + escapeHtml(saveState.fields[id.replace('qcSv', '').toLowerCase()] || '') + '">'
            + '</div>';
    }

    function savePanelFormHtml(cart) {
        const rows = [];
        rows.push('<h2 class="qc-save-title">Save &amp; email my quote</h2>');
        if (DRY_RUN) rows.push('<div class="alert alert-warn"><div class="alert-body"><p>DRY RUN — payloads will be logged, nothing saved.</p></div></div>');
        if (saveState.errorMsg) rows.push(alertHtml('error', 'Couldn\'t save', saveState.errorMsg));
        if (saveState.phase === 'price-changed') {
            rows.push(alertHtml('warn', 'Prices refreshed',
                'A price changed since you loaded the page. The cart above now shows the current numbers — review them, then save again to confirm.'));
        }
        rows.push(fieldHtml('qcSvName', 'Your name', 'text', true, 'Jane Smith'));
        rows.push(fieldHtml('qcSvEmail', 'Email', 'email', true, 'jane@company.com'));
        rows.push(fieldHtml('qcSvPhone', 'Phone', 'tel', false, '253-555-0100'));
        rows.push(fieldHtml('qcSvCompany', 'Company', 'text', false, 'Acme Co.'));
        rows.push('<div class="field"><label class="field-label" for="qcSvNotes">Anything else we should price?</label>'
            + '<textarea class="field-textarea" id="qcSvNotes" data-save-field="notes" rows="3" '
            + 'placeholder="Names &amp; numbers, rush date, extra locations, delivery — your rep prices these for you.">'
            + escapeHtml(saveState.fields.notes || '') + '</textarea></div>');

        // Optional artwork — one file per print-type group (proxy files API,
        // 20 MB, image/PDF). Upload failures warn visibly; the save still goes.
        rows.push('<fieldset class="qc-save-art"><legend>Artwork (optional)</legend>');
        cart.order.forEach(function (gid) {
            const items = state.items.filter(function (it) { return groupIdFor(it) === gid; });
            const meta = METHOD_META[methodOf(gid, items)] || { label: gid };
            const picked = saveState.files[gid];
            rows.push('<div class="qc-art-row"><label class="qc-art-label" for="qcArt-' + escapeHtml(gid) + '">' + escapeHtml(meta.label) + '</label>'
                + '<input type="file" id="qcArt-' + escapeHtml(gid) + '" accept="image/*,.pdf" data-art-gid="' + escapeHtml(gid) + '">'
                + (picked ? '<span class="qc-art-picked">' + escapeHtml(picked.name) + '</span>' : '')
                + '</div>');
        });
        rows.push('<p class="field-help">PNG, JPG, SVG or PDF up to 20&nbsp;MB each. No file yet? No problem — your rep will ask.</p>');
        rows.push('</fieldset>');

        rows.push('<div class="qc-save-actions">'
            + '<button class="btn btn-cta" type="button" data-save-act="submit">'
            + (saveState.phase === 'price-changed' ? 'Confirm new prices &amp; save' : 'Save my quote')
            + '</button>'
            + '<button class="btn btn-ghost" type="button" data-save-act="cancel">Cancel</button>'
            + '</div>');
        rows.push('<p class="field-help">Saving emails a copy to you and to our sales team, with a link you can share. '
            + 'Saved quotes are a snapshot — keep editing here and save again for a new number.</p>');
        return rows.join('');
    }

    function savePanelSavingHtml() {
        return '<div class="qc-save-busy" role="status"><span class="qc-spin" aria-hidden="true"></span>'
            + '<p>Confirming live prices and saving your quote&hellip;</p></div>';
    }

    function savePanelSuccessHtml() {
        const saved = saveState.saved;
        const rows = [];
        rows.push('<h2 class="qc-save-title">Quote ' + escapeHtml(saved.quoteId) + ' saved' + (saved.dryRun ? ' (DRY RUN)' : '') + '</h2>');
        if (saved.idFallback) {
            rows.push(alertHtml('warn', 'Temporary quote number',
                'Our numbering service was briefly unreachable, so this quote has a temporary number. Your rep will confirm it.'));
        }
        rows.push('<div class="qc-share"><label class="field-label" for="qcShareUrl">Your share link</label>'
            + '<div class="qc-share-row">'
            + '<input class="field-input" type="text" id="qcShareUrl" readonly value="' + escapeHtml(saved.shareUrl) + '">'
            + '<button class="btn btn-primary" type="button" data-save-act="copy">Copy</button>'
            + '</div>'
            + '<a class="qc-share-open" href="' + escapeHtml(saved.sharePath) + '" target="_blank" rel="noopener">Open my quote &rarr;</a>'
            + '</div>');
        if (saved.warning) rows.push(alertHtml('warn', 'Heads up', saved.warning));
        saveState.warnings.forEach(function (w) { rows.push(alertHtml('warn', 'Artwork', w)); });

        const es = saveState.emailStatus;
        let emailLine;
        if (es == null) emailLine = 'Sending your email copy&hellip;';
        else if (es.customerSent) emailLine = 'We emailed a copy to ' + escapeHtml(saveState.fields.email) + ' and alerted our sales team — we\'re on it.';
        else if (es.salesSent) emailLine = 'Our sales team has been alerted. We couldn\'t send your email copy — bookmark the link above.';
        else emailLine = 'We got your quote! The confirmation email didn\'t go through, so bookmark the link above — our team sees every saved quote.';
        rows.push('<p class="qc-save-emailline" id="qcEmailLine">' + emailLine + '</p>');

        const subject = 'Change request — quote ' + saved.quoteId;
        const body = 'Hi NWCA,\n\nI\'d like to change my web quote ' + saved.quoteId + ' (' + saved.shareUrl + '):\n\n';
        rows.push('<div class="qc-save-actions">'
            + '<a class="btn btn-ghost" href="mailto:sales@nwcustomapparel.com?subject=' + encodeURIComponent(subject)
            + '&body=' + encodeURIComponent(body) + '">Request changes</a>'
            + '<button class="btn btn-ghost" type="button" data-save-act="close">Done</button>'
            + '</div>');
        rows.push('<p class="field-help">This saved quote is a frozen snapshot. Your cart is still editable — '
            + 'change anything here and save again to get a new quote number.</p>');
        return rows.join('');
    }

    function renderSavePanel(cart) {
        const panel = $('qcSavePanel');
        if (!panel) return;
        panel.hidden = !saveState.open;
        if (!saveState.open) return;
        if (saveState.phase === 'saving') panel.innerHTML = savePanelSavingHtml();
        else if (saveState.phase === 'success') panel.innerHTML = savePanelSuccessHtml();
        else panel.innerHTML = savePanelFormHtml(cart);
        saveState.gidsKey = gidsKeyOf(cart);
    }

    /** Called from renderTotals on every reprice — rebuild the form ONLY when
     *  the group set changed (otherwise typing/file picks survive). */
    function syncSavePanel(cart) {
        if (!saveState.open) { renderSavePanel(cart); return; }
        if (saveState.phase === 'saving' || saveState.phase === 'success') return;
        if (gidsKeyOf(cart) !== saveState.gidsKey) {
            // Drop artwork picks for groups that no longer exist
            Object.keys(saveState.files).forEach(function (gid) {
                if (cart.order.indexOf(gid) === -1) delete saveState.files[gid];
            });
            renderSavePanel(cart);
        }
    }

    function openSavePanel() {
        saveState.open = true;
        saveState.phase = 'form';
        saveState.errorMsg = '';
        renderSavePanel(buildCart());
        const panel = $('qcSavePanel');
        if (panel) panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        const name = $('qcSvName');
        if (name) name.focus();
    }

    function readSaveFields() {
        ['qcSvName', 'qcSvEmail', 'qcSvPhone', 'qcSvCompany', 'qcSvNotes'].forEach(function (id) {
            const el = $(id);
            if (el) saveState.fields[id.replace('qcSv', '').toLowerCase()] = el.value.trim();
        });
    }

    async function doSave() {
        readSaveFields();
        const f = saveState.fields;
        if (!f.name || !f.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email)) {
            saveState.errorMsg = 'Please enter your name and a valid email so we can send your quote.';
            renderSavePanel(buildCart());
            return;
        }
        if (!window.WebQuoteService) {
            saveState.errorMsg = 'The save service didn\'t load — please refresh, or call 253-922-5793.';
            renderSavePanel(buildCart());
            return;
        }
        if (!state.priced || state.priced.grandTotal == null) {
            saveState.errorMsg = 'Your quote isn\'t fully priced yet — fix the group above first.';
            renderSavePanel(buildCart());
            return;
        }

        const cart = buildCart();
        saveState.phase = 'saving';
        saveState.errorMsg = '';
        saveState.warnings = [];
        renderSavePanel(cart);

        const svc = new window.WebQuoteService({ engine: window.QuoteCartEngine, dryRun: DRY_RUN });

        // Optional artwork uploads — failures warn visibly, never block the save.
        const artwork = [];
        for (const gid of Object.keys(saveState.files)) {
            const file = saveState.files[gid];
            if (!file) continue;
            try {
                const up = await svc.uploadArtwork(file);
                artwork.push({ groupId: gid, externalKey: up.externalKey, fileName: up.fileName, url: up.url });
            } catch (err) {
                console.error('[quote-cart] Artwork upload failed for', gid, err);
                saveState.warnings.push('We couldn\'t upload "' + file.name + '" — your quote saved without it. '
                    + 'Email it to sales@nwcustomapparel.com and we\'ll attach it.');
            }
        }

        let res;
        try {
            res = await svc.saveQuote({
                cart: { items: cart.items, groups: cart.groups },
                storeItems: cart.storeItems,
                displayedResult: state.priced,
                customer: { name: f.name, email: f.email, phone: f.phone, company: f.company, notes: f.notes },
                artwork: artwork,
                engineOptions: { deps: freshEngineDeps() }
            });
        } catch (err) {
            console.error('[quote-cart] saveQuote threw:', err);
            res = { success: false, code: 'SAVE_FAILED', message: err.message };
        }

        if (!res.success && res.code === 'PRICING_CHANGED') {
            // Show the customer the CURRENT prices, then ask them to re-confirm.
            state.priced = res.fresh;
            render(cart, res.fresh);
            saveState.phase = 'price-changed';
            renderSavePanel(cart);
            return;
        }
        if (!res.success) {
            saveState.phase = 'form';
            saveState.errorMsg = res.message || 'Something went wrong — nothing was saved. Please try again or call 253-922-5793.';
            renderSavePanel(cart);
            return;
        }

        saveState.saved = res;
        saveState.emailStatus = null;
        saveState.phase = 'success';
        renderSavePanel(cart);

        // Fire-and-forget notifications (locked decision: sales@ + immediate
        // customer copy w/ the share link). Never blocks or fails the save.
        svc.sendEmails({
            quoteId: res.quoteId,
            shareUrl: res.shareUrl,
            customer: { name: f.name, email: f.email, company: f.company }
        }).then(function (status) {
            saveState.emailStatus = status;
            if (saveState.phase === 'success') renderSavePanel(buildCart());
        });
    }

    function onSavePanelClick(e) {
        const btn = e.target.closest('[data-save-act]');
        if (!btn) return;
        const act = btn.getAttribute('data-save-act');
        if (act === 'submit') { doSave(); return; }
        if (act === 'cancel' || act === 'close') {
            saveState.open = false;
            if (act === 'close') { saveState.phase = 'form'; saveState.saved = null; }
            renderSavePanel(buildCart());
            return;
        }
        if (act === 'copy') {
            const input = $('qcShareUrl');
            if (!input) return;
            const url = input.value;
            const done = function () { btn.textContent = 'Copied!'; setTimeout(function () { btn.textContent = 'Copy'; }, 2000); };
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(url).then(done, function () { input.select(); });
            } else {
                input.select();
                try { document.execCommand('copy'); done(); } catch (err) { /* selection left for manual copy */ }
            }
        }
    }

    function onSavePanelInput(e) {
        const el = e.target.closest('[data-save-field]');
        if (!el) return;
        saveState.fields[el.getAttribute('data-save-field')] = el.value;
    }

    function onSavePanelChange(e) {
        const input = e.target.closest('input[data-art-gid]');
        if (!input) return;
        const gid = input.getAttribute('data-art-gid');
        const file = input.files && input.files[0];
        if (!file) { delete saveState.files[gid]; return; }
        if (file.size > MAX_ART_BYTES) {
            alertInPanel('That file is over 20 MB — email it to sales@nwcustomapparel.com instead and we\'ll attach it.');
            input.value = '';
            delete saveState.files[gid];
            return;
        }
        if (!ART_OK.test(file.name)) {
            alertInPanel('We can take PNG, JPG, GIF, WEBP, SVG or PDF files here. Email other formats to sales@nwcustomapparel.com.');
            input.value = '';
            delete saveState.files[gid];
            return;
        }
        saveState.files[gid] = file;
    }

    function alertInPanel(msg) {
        saveState.errorMsg = msg;
        renderSavePanel(buildCart());
    }

    // ============================================================
    // EVENTS (delegated on the groups container; rebuilt-safe)
    // ============================================================
    function wireGroupEvents() {
        // Meter fills (no inline styles — width set via JS after render)
        Array.prototype.forEach.call(document.querySelectorAll('[data-meter-fill]'), function (el) {
            el.style.width = parseInt(el.getAttribute('data-meter-fill'), 10) + '%';
        });
    }

    function onGroupsClick(e) {
        const btn = e.target.closest('[data-act]');
        if (!btn) return;
        const act = btn.getAttribute('data-act');
        const id = btn.getAttribute('data-id');
        if (act === 'retry') {
            resetEmbCalc();
            reprice();
            return;
        }
        if (act === 'remove') {
            window.QuoteCartStore.remove(id); // onChange → reprice
            return;
        }
        if (act === 'inc' || act === 'dec') {
            const item = window.QuoteCartStore.getItems().filter(function (i) { return i.id === id; })[0];
            if (!item) return;
            const next = Math.max(1, (Number(item.qty) || 1) + (act === 'inc' ? 1 : -1));
            if (next !== item.qty) window.QuoteCartStore.updateQty(id, next); // onChange → reprice
        }
    }

    function onGroupsChange(e) {
        const input = e.target.closest('input[data-act="qty"]');
        if (!input) return;
        const id = input.getAttribute('data-id');
        const v = parseInt(input.value, 10);
        if (!isNaN(v) && v > 0) {
            window.QuoteCartStore.updateQty(id, Math.min(9999, v));
        } else {
            // restore the stored value on junk input
            const item = window.QuoteCartStore.getItems().filter(function (i) { return i.id === id; })[0];
            if (item) input.value = item.qty;
        }
    }

    // ============================================================
    // BOOT
    // ============================================================
    function init() {
        wireChrome();

        if (!window.QuoteCartStore || !window.QuoteCartEngine) {
            $('qcSkeleton').hidden = true;
            $('qcAlert').innerHTML = alertHtml('error', 'Unable to load your quote',
                'The quote tools didn\'t load. Please refresh, or call 253-922-5793 — we never guess at prices.');
            return;
        }

        $('qcGroups').addEventListener('click', onGroupsClick);
        $('qcGroups').addEventListener('change', onGroupsChange);

        // Save panel (Phase 3) — the totals body re-renders on every reprice,
        // so the save button binds by delegation on the static aside.
        $('qcTotals').addEventListener('click', function (e) {
            if (e.target.closest('#qcSaveBtn')) openSavePanel();
        });
        $('qcSavePanel').addEventListener('click', onSavePanelClick);
        $('qcSavePanel').addEventListener('input', onSavePanelInput);
        $('qcSavePanel').addEventListener('change', onSavePanelChange);

        // Store changes (this tab's steppers/removes AND other-tab storage
        // events) → debounced reprice. The badge updates itself via the
        // store's own [data-quote-badge] auto-init.
        window.QuoteCartStore.onChange(scheduleReprice);

        reprice();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
