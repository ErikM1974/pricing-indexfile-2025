/**
 * catalog-samples.js — sample-program layer for /catalog (Top Sellers view)
 *
 * Successor to the retired pages/top-sellers-showcase.html sample UI. Renders
 * "Request FREE sample" / "Order sample — $X.XX" buttons into the
 * .pcard-sample-slot placeholders that catalog-2026.js emits in the Top
 * Sellers view, opens the shared cart drawer (cart-drawer.js) for color/size
 * selection, and keeps the header Samples badge in sync. Checkout stays on
 * /pages/sample-cart.html (same sessionStorage cart).
 *
 * Data + pricing come from shared_components/js/sample-cart-service.js —
 * this file renders, it never prices. Entirely optional: catalog-2026.js
 * guards every call, so the catalog works if this module is absent.
 */
(function () {
    'use strict';

    var CONCURRENCY = 6; // parallel eligibility checks (be polite to the proxy)

    function escapeHtml(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    /** Product info by style for drawer previews (image/name/description). */
    var productInfo = {};
    var renderSeq = 0;

    function cart() { return window.sampleCart || null; }

    function buttonLabel(style, eligibility) {
        var c = cart();
        if (c && c.has(style)) return { text: '✓ In sample cart', cls: 'btn-sample in-cart', disabled: false };
        if (eligibility.type === 'free') return { text: 'Request FREE sample', cls: 'btn-sample btn-sample-free', disabled: false };
        return { text: 'Order sample — $' + Number(eligibility.price).toFixed(2), cls: 'btn-sample btn-sample-paid', disabled: false };
    }

    function renderButton(slot, style, eligibility) {
        if (!eligibility || !eligibility.eligible) {
            slot.innerHTML = ''; // no sample offered — quiet slot, price still shows above
            return;
        }
        var label = buttonLabel(style, eligibility);
        slot.innerHTML = '<button type="button" class="' + label.cls + '" data-style="' + escapeHtml(style) + '">' +
            escapeHtml(label.text) + '</button>';
    }

    /** Decorate the current grid's sample slots (called per render). */
    async function decorate() {
        var seq = ++renderSeq;
        var c = cart();
        if (!c) return;
        var slots = Array.prototype.slice.call(document.querySelectorAll('.pcard-sample-slot'));
        if (!slots.length) return;

        slots.forEach(function (slot) {
            slot.innerHTML = '<span class="pcard-sample-loading">Checking sample availability…</span>';
        });

        // Small worker pool over the slots
        var queue = slots.slice();
        async function worker() {
            while (queue.length) {
                if (seq !== renderSeq) return; // a newer render superseded this pass
                var slot = queue.shift();
                var style = slot.getAttribute('data-style');
                try {
                    var eligibility = await c.checkEligibility(style);
                    if (seq !== renderSeq || !document.contains(slot)) return;
                    renderButton(slot, style, eligibility);
                } catch (error) {
                    console.error('[CatalogSamples] Eligibility failed for ' + style + ':', error);
                    if (document.contains(slot)) slot.innerHTML = '';
                }
            }
        }
        var workers = [];
        for (var i = 0; i < CONCURRENCY; i++) workers.push(worker());
        await Promise.all(workers);
    }

    function onResults(products, topSellersMode) {
        (products || []).forEach(function (p) {
            var images = p.images || {};
            productInfo[p.styleNumber] = {
                name: p.productName || p.styleNumber,
                description: p.brand || '',
                imageUrl: images.display || images.main || images.thumbnail || ''
            };
        });
        if (topSellersMode) decorate();
        updateBadge();
    }

    /** Open the shared drawer with color/size picker for one style. */
    async function openSamplePicker(button, style) {
        var c = cart();
        if (!c || !window.cartDrawer) return;

        var original = button.textContent;
        button.disabled = true;
        button.textContent = 'Loading options…';
        try {
            var settled = await Promise.all([c.checkEligibility(style), c.getVariants(style)]);
            var eligibility = settled[0];
            var variants = settled[1];
            if (!eligibility.eligible) {
                c.showNotification('Samples aren’t available online for this style — call 253-922-5793', 'info');
                return;
            }
            var info = productInfo[style] || { name: style, description: '', imageUrl: '' };
            window.cartDrawer.open({
                style: style,
                name: info.name,
                description: info.description,
                imageUrl: info.imageUrl,
                price: eligibility.price,
                type: eligibility.type,
                colors: variants.colors,
                sizes: variants.sizes
            });
        } catch (error) {
            console.error('[CatalogSamples] Could not open sample picker:', error);
            if (c) c.showNotification('Couldn’t load sample options — please try again', 'warning');
        } finally {
            button.disabled = false;
            button.textContent = original;
        }
    }

    /** Refresh button states after cart changes (added/removed elsewhere). */
    function refreshButtons() {
        var c = cart();
        if (!c) return;
        document.querySelectorAll('.pcard-sample-slot .btn-sample').forEach(function (btn) {
            var style = btn.getAttribute('data-style');
            var eligibility = c.eligibilityCache[style];
            if (!eligibility || !eligibility.eligible) return;
            var label = buttonLabel(style, eligibility);
            btn.textContent = label.text;
            btn.className = label.cls;
        });
    }

    /* ── Header Samples badge (next to the quote badge) ──────────── */

    function updateBadge() {
        var badge = document.querySelector('[data-sample-badge]');
        if (!badge) return;
        var c = cart();
        var count = c ? c.count : 0;
        badge.hidden = count === 0;
        var countEl = badge.querySelector('[data-sample-badge-count]');
        if (countEl) countEl.textContent = String(count);
    }

    function wire() {
        // Sample buttons (delegated — the grid re-renders)
        document.addEventListener('click', function (e) {
            var btn = e.target.closest('.pcard-sample-slot .btn-sample');
            if (btn) {
                e.preventDefault();
                openSamplePicker(btn, btn.getAttribute('data-style'));
                return;
            }
            // Badge opens the drawer in view-cart mode (href is the no-JS fallback)
            var badge = e.target.closest('[data-sample-badge]');
            if (badge && window.cartDrawer) {
                e.preventDefault();
                window.cartDrawer.open();
            }
        });

        window.addEventListener('cartUpdated', function () {
            updateBadge();
            refreshButtons();
        });

        updateBadge();
    }

    window.CatalogSamples = { onResults: onResults };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', wire);
    } else {
        wire();
    }
})();
