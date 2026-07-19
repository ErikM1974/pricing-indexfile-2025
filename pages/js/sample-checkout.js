/**
 * sample-checkout.js — Stripe checkout for PAID samples (samples channel, 2026-07-06)
 *
 * Loaded by pages/sample-cart.html. The page's submit handler delegates here
 * when the cart contains ANY paid sample; free-only carts keep the direct
 * ShopWorks request flow untouched (sample-order-service.js).
 *
 * Flow: form submit → POST /api/samples/create-checkout-session (the SERVER
 * reprices everything through the shared sample-pricing.js module and adds
 * DOR tax; the subtotal sent here is advisory) → redirect to Stripe hosted
 * checkout. Payment lands on the webhook, which pushes ONE ManageOrders order
 * (paid + free lines, payment recorded) — nothing is ordered until Stripe
 * confirms. Returning ?success=1&quote_id=SAM… clears the cart and shows the
 * page's success panel; ?canceled=1 keeps the cart and shows a notice.
 */
(function () {
    'use strict';

    function hasPaid(samples) {
        return (samples || []).some(function (s) {
            return s.type === 'paid' || (s.sampleType === 'paid');
        });
    }

    /** Pre-tax paid subtotal, same math as the page's summary bar
     *  (base price + size upcharge per unit; free items are $0). */
    function paidSubtotal(samples) {
        var total = 0;
        (samples || []).forEach(function (item) {
            if ((item.type || item.sampleType) !== 'paid') return;
            var upcharges = item.upcharges || {};
            var base = parseFloat(item.price) || 0;
            Object.keys(item.sizes || {}).forEach(function (size) {
                var qty = parseInt(item.sizes[size], 10) || 0;
                total += qty * (base + (parseFloat(upcharges[size]) || 0));
            });
        });
        return Math.round(total * 100) / 100;
    }

    function banner(kind, html) {
        var slot = document.getElementById('sampleCheckoutBanner');
        if (!slot) {
            slot = document.createElement('div');
            slot.id = 'sampleCheckoutBanner';
            var anchor = document.getElementById('cartSummaryBar') || document.body.firstElementChild;
            anchor.parentNode.insertBefore(slot, anchor);
        }
        slot.innerHTML = '<div class="checkout-validation-alert" style="' +
            (kind === 'error' ? '' : 'border-color:#2d5f3f;') + 'margin:1rem 0;">' +
            '<i class="fas ' + (kind === 'error' ? 'fa-exclamation-triangle' : 'fa-info-circle') + '"></i>' +
            '<div class="alert-content">' + html + '</div></div>';
        slot.scrollIntoView({ block: 'center' });
    }

    /**
     * Kick off Stripe checkout for a paid cart. Called by the page's submit
     * handler AFTER its own validation (inventory check, form validity).
     */
    async function start(opts) {
        var customerData = opts.customerData;
        var samples = opts.samples || [];
        var form = opts.form;
        var submitBtn = form && form.querySelector('[type="submit"]');
        var original = submitBtn && submitBtn.innerHTML;
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Preparing secure checkout…';
        }
        try {
            // One entry per sample: single size (the drawer-add contract)
            var payloadSamples = samples.map(function (item) {
                var size = item.size || Object.keys(item.sizes || {})[0] || '';
                return {
                    style: item.style,
                    name: item.name,
                    color: item.color,
                    catalogColor: item.catalogColor || item.color,
                    size: size
                };
            });
            var resp = await fetch('/api/samples/create-checkout-session', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    customerData: customerData,
                    samples: payloadSamples,
                    clientSubtotal: paidSubtotal(samples)
                })
            });
            var data = await resp.json().catch(function () { return {}; });
            if (!resp.ok || !data.url) {
                throw new Error(data.error || 'Checkout is unavailable right now — nothing was charged. Please try again or call 253-922-5793.');
            }
            window.location.href = data.url;   // Stripe hosted checkout
        } catch (error) {
            console.error('[SampleCheckout] Failed to start checkout:', error);
            banner('error', '<h3>Couldn’t start checkout</h3><p>' + String(error.message || error) + '</p>');
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = original;
            }
        }
    }

    /** Paid-cart copy: button label + credit line under the summary bar. */
    function refreshUi() {
        var cart = [];
        try {
            var stored = JSON.parse(sessionStorage.getItem('sampleCart') || 'null');
            cart = Array.isArray(stored) ? stored : ((stored && stored.samples) || []);
        } catch (e) { /* corrupt cart — page handles it */ }
        var paid = hasPaid(cart);

        var btn = document.querySelector('#sampleRequestForm [type="submit"]');
        if (btn && paid) {
            btn.innerHTML = '<i class="fas fa-lock"></i> Continue to secure payment';
        }
        // 2026 reskin: the credit note is static markup in the summary band
        // (styled by pages/css/sample-cart.css) — reveal it for paid carts
        var note = document.getElementById('sampleCreditNote');
        if (paid && note) note.hidden = false;
    }

    /** Handle ?success=1&quote_id= / ?canceled=1 returns from Stripe. */
    function handleReturnParams() {
        var params = new URLSearchParams(window.location.search);
        if (params.get('success') === '1') {
            var quoteId = params.get('quote_id') || '';
            sessionStorage.removeItem('sampleCart');
            // If an AE started this from a lead, log it to the lead's timeline + clear
            // the handoff stash (no-op for real customers). Defined in sample-cart-page.js.
            if (typeof window.finishSampleLeadHandoff === 'function') window.finishSampleLeadHandoff(quoteId);
            var cartContainer = document.getElementById('cartContainer');
            var success = document.getElementById('successMessage');
            if (cartContainer) cartContainer.style.display = 'none';
            if (success) {
                success.style.display = 'block';
                var h2 = success.querySelector('h2');
                var p = success.querySelector('p');
                if (h2) h2.textContent = 'Payment received — samples on the way!';
                if (p) p.textContent = 'Thanks! Your payment went through and your sample order is in our system. We’ll ship your samples within 2–3 business days — and the sample cost is credited toward your first decorated order.';
                var idSpan = document.getElementById('confirmationId');
                if (idSpan) idSpan.textContent = quoteId;
            }
            return true;
        }
        if (params.get('canceled') === '1') {
            banner('info', '<h3>Checkout canceled</h3><p>No worries — your sample cart is still here. Check out whenever you’re ready, or call 253-922-5793 with questions.</p>');
        }
        return false;
    }

    window.SampleCheckout = { hasPaid: hasPaid, start: start, paidSubtotal: paidSubtotal };

    function boot() {
        if (!handleReturnParams()) {
            // cart renders async — refresh the copy after load settles
            setTimeout(refreshUi, 1500);
            window.addEventListener('cartUpdated', refreshUi);
        }
    }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }
})();
