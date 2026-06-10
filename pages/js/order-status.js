/**
 * order-status.js — customer-safe order status page (no login).
 *
 * URL is the credential: /order-status?id=<QuoteID>&t=<12-hex HMAC token>.
 * Calls same-origin GET /api/order-status/:quoteId?t=… (server.js), which
 * validates the token timing-safe and returns ONLY a customer-safe
 * projection. Wrong/missing token and unknown order are the same generic
 * 404 — this page just shows the friendly not-found state.
 *
 * Everything rendered is escaped — the projection includes customer-typed
 * data (colors come from Caspio, but defense in depth is free).
 */
(function () {
    'use strict';

    const params = new URLSearchParams(location.search);
    const quoteID = params.get('id') || '';
    const token = params.get('t') || '';

    const $ = (id) => document.getElementById(id);
    const money = (v) => '$' + (Number(v) || 0).toFixed(2);
    function escapeHTML(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
        }[c]));
    }

    function show(id) {
        ['st-loading', 'st-order', 'st-error'].forEach((x) => { $(x).hidden = x !== id; });
    }

    function showError(msg) {
        if (msg) $('st-error-msg').textContent = msg;
        show('st-error');
    }

    // Map the API's customer-safe status to the highlighted timeline step.
    // Steps: 0 Order received · 1 In production · 2 Shipped/Ready · 3 Delivery promise.
    const STEP_FOR_STATUS = {
        'pending-payment': 0,
        'paid': 1,
        'in-production': 1,
        'shipped': 2,
        'pickup-ready-soon': 2,
    };

    function promiseLabel(order) {
        const sp = order.shipPromise || {};
        if (sp.mode === 'standard-7to10' && sp.rangeLabel) return sp.rangeLabel;
        return sp.label || sp.rangeLabel || '';
    }

    function render(order) {
        const isPickup = order.deliveryMethod === 'pickup';
        const promise = promiseLabel(order);

        $('st-order-num').textContent = order.quoteID;
        $('st-style').innerHTML = escapeHTML(order.styleName || '')
            + (order.rush ? ' <span class="status-rush"><i class="fas fa-bolt"></i> 3-Day Rush</span>' : '');
        if (order.orderDate) {
            const d = new Date(order.orderDate);
            if (!isNaN(d)) {
                $('st-style').innerHTML += `<span class="status-date">Placed ${escapeHTML(d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }))}</span>`;
            }
        }

        // Promised date — prominent pill (server-stamped, never recomputed)
        if (promise) {
            $('st-promise').innerHTML = isPickup
                ? `<i class="fas fa-store"></i> Promised ready for pickup: <strong>${escapeHTML(promise)}</strong>`
                : `<i class="fas fa-truck-fast"></i> Ships from Milton, WA: <strong>${escapeHTML(promise)}</strong>`;
            $('st-promise').hidden = false;
        }

        // UPS tracking link
        if (order.trackingNumber) {
            const tn = String(order.trackingNumber);
            $('st-tracking').innerHTML =
                `<a class="btn btn-primary" target="_blank" rel="noopener" ` +
                `href="https://www.ups.com/track?tracknum=${encodeURIComponent(tn)}">` +
                `<i class="fas fa-truck-fast"></i> Track with UPS — ${escapeHTML(tn)}</a>`;
            $('st-tracking').hidden = false;
        }

        // Timeline — 4 steps, current one highlighted from status
        const current = STEP_FOR_STATUS[order.status] != null ? STEP_FOR_STATUS[order.status] : 0;
        const steps = [
            {
                icon: 'fa-circle-check',
                title: 'Order received',
                sub: order.status === 'pending-payment'
                    ? 'Waiting for payment confirmation from Stripe'
                    : 'Payment confirmed — you’re on the press schedule',
            },
            {
                icon: 'fa-print',
                title: 'In production',
                sub: 'Full-color DTG printing in our Milton, WA shop',
            },
            isPickup
                ? { icon: 'fa-store', title: 'Ready for pickup', sub: '2025 Freeman Rd E, Milton, WA 98354 — we’ll call you' }
                : { icon: 'fa-truck-fast', title: 'Shipped', sub: order.trackingNumber ? 'On its way via UPS Ground' : 'UPS Ground from Milton, WA' },
            {
                icon: 'fa-flag-checkered',
                title: isPickup ? 'Pickup promise' : 'Delivery promise',
                sub: promise ? `Promised: ${promise}` : (order.rush ? 'Within 3 business days' : 'Within 7–10 business days'),
            },
        ];
        $('st-timeline').innerHTML = steps.map((s, i) => {
            const state = i < current ? 'is-done' : (i === current ? 'is-current' : 'is-pending');
            return `<div class="status-step ${state}">` +
                `<span class="status-step-dot"><i class="fas ${i < current ? 'fa-check' : s.icon}"></i></span>` +
                `<span class="status-step-body"><strong>${escapeHTML(s.title)}</strong><small>${escapeHTML(s.sub)}</small></span></div>`;
        }).join('');

        // Pickup card
        $('st-pickup').hidden = !isPickup;

        // Mockup thumbnails
        const mocks = (order.mockups || []).slice(0, 6);
        $('st-mockups').innerHTML = mocks.map((m) =>
            `<figure><img src="${escapeHTML(m.url)}" alt="Mockup ${escapeHTML(m.color)} ${escapeHTML(m.view)}" loading="lazy">` +
            `<figcaption>${escapeHTML(m.color)} · ${escapeHTML(m.view)}</figcaption></figure>`).join('');

        // Items table
        $('st-items').innerHTML = (order.items || []).map((it) =>
            `<tr><td>${escapeHTML(it.color)}</td><td>${escapeHTML(it.size)}</td>` +
            `<td>${Number(it.qty) || 0}</td><td>${money(it.unitPrice)}</td></tr>`).join('');

        // Totals — $0 shipping on a SHIP order = free-over-threshold → FREE
        const t = order.totals || {};
        const qty = (order.items || []).reduce((sum, it) => sum + (Number(it.qty) || 0), 0);
        let h = `<div class="tot-row"><span>Shirts (${qty})</span><span>${money(t.subtotal)}</span></div>`;
        // ltmFee is 0 on baked-small-batch orders (folded into unit prices) —
        // the row only renders for legacy/unbaked orders so totals foot.
        if (t.ltmFee > 0) h += `<div class="tot-row"><span>Small-batch fee</span><span>${money(t.ltmFee)}</span></div>`;
        h += `<div class="tot-row"><span>${isPickup ? 'Pickup — Milton, WA' : 'UPS Ground shipping'}</span>` +
            `<span>${!isPickup && t.shipping > 0 ? money(t.shipping) : 'FREE'}</span></div>`;
        if (t.tax > 0) h += `<div class="tot-row"><span>Sales tax</span><span>${money(t.tax)}</span></div>`;
        h += `<div class="tot-row is-grand"><span>Total</span><span>${money(t.grandTotal)}</span></div>`;
        $('st-summary').innerHTML = h;

        // Questions CTA — mailto carries the order # in the subject
        const subj = encodeURIComponent(`Order ${order.quoteID} — question or change`);
        $('st-questions').innerHTML = `Questions or changes? Call <a href="tel:253-922-5793">253-922-5793</a> ` +
            `or email <a href="mailto:sales@nwcustomapparel.com?subject=${subj}">sales@nwcustomapparel.com</a> — ` +
            `mention order <strong>${escapeHTML(order.quoteID)}</strong>.`;

        show('st-order');
    }

    async function load() {
        try {
            const res = await fetch(`/api/order-status/${encodeURIComponent(quoteID)}?t=${encodeURIComponent(token)}`);
            if (res.status === 404) {
                showError('We couldn’t match that link to an order. Try opening it again from your confirmation email, or call us and we’ll look it up.');
                return;
            }
            if (!res.ok) {
                showError('Order status is temporarily unavailable. Please try again in a few minutes, or call us.');
                return;
            }
            render(await res.json());
        } catch (e) {
            console.error('[OrderStatus] Load failed:', e);
            showError('Order status is temporarily unavailable. Please try again in a few minutes, or call us.');
        }
    }

    document.addEventListener('DOMContentLoaded', () => {
        if (!quoteID || !token) {
            showError('This page needs the full link from your confirmation email — the one ending in your order code.');
            return;
        }
        show('st-loading');
        load();
    });
})();
