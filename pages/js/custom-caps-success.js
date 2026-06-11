/**
 * custom-caps-success.js — post-payment page for the Custom Hats storefront
 * ('custom-caps' channel; clone of custom-tees-success.js adapted to the
 * proof-first cap flow).
 *
 * Flow (webhook-driven, this page only OBSERVES):
 *   1. Stripe redirects here with ?session_id=…&quote_id=… (the registry's
 *      stripeSuccessPath for 'custom-caps').
 *   2. Poll the quote session in Caspio every 3s (max ~75s):
 *        'Processed'                            → full success
 *        'Payment Confirmed'                    → success (push lands seconds later)
 *        'Payment Confirmed - ShopWorks Failed' → success-with-delay copy
 *        'Pending Payment'                      → webhook hasn't landed, keep polling
 *   3. On first confirmed status: the Stripe webhook is the AUTHORITATIVE
 *      email sender — when it stamps orderSettings.emailsSentAt this page
 *      sends NOTHING. Browser sends are the FALLBACK only (stamp absent:
 *      webhook email failure / missing EmailJS env keys on the server).
 *
 * Channel facts come from the SERVER-STAMPED OrderSettingsJSON (styleName,
 * printLocationName, backLogo, shipPromise{mode:'proof-first-standard'}) —
 * never recomputed in the browser.
 *
 * The quote row lookup uses ?quoteID= + .find(QuoteID===id) — never
 * sessions[0] (the 2026-06-01 wrong-quote lesson).
 */
(function () {
    'use strict';

    const API_BASE = (window.APP_CONFIG && window.APP_CONFIG.API && window.APP_CONFIG.API.BASE_URL)
        || 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';
    // Same EmailJS service the tee storefront confirmations use — the
    // 'custom-caps' registry entry reuses the tee templates (decision #15).
    const EMAILJS_PUBLIC_KEY = '4qSbDO-SQs19TbP80';
    const EMAILJS_SERVICE = 'service_1c4k67j';
    const POLL_MS = 3000;
    const MAX_POLLS = 25;

    const params = new URLSearchParams(location.search);
    const quoteID = params.get('quote_id');
    const sessionId = params.get('session_id') || '';

    const $ = (id) => document.getElementById(id);
    const money = (v) => '$' + (Number(v) || 0).toFixed(2);
    function escapeHTML(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
        }[c]));
    }

    let polls = 0;
    let emailed = false;

    function show(id) {
        ['s-working', 's-done', 's-delayed', 's-error'].forEach((x) => { $(x).hidden = x !== id; });
    }

    async function fetchSession() {
        // refresh=true: the proxy caches lookups for 5 min — without it this
        // poll would never see the webhook flip the status to Processed.
        const res = await fetch(`${API_BASE}/api/quote_sessions?quoteID=${encodeURIComponent(quoteID)}&refresh=true`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const rows = await res.json();
        const list = Array.isArray(rows) ? rows : (rows.data || []);
        return list.find((s) => s.QuoteID === quoteID) || null;
    }

    function parseBlobs(row) {
        const j = (s) => { try { return JSON.parse(s || '{}'); } catch (_) { return {}; } };
        return {
            customerData: j(row.CustomerDataJSON),
            colorConfigs: j(row.ColorConfigsJSON),
            orderTotals: j(row.OrderTotalsJSON),
            orderSettings: j(row.OrderSettingsJSON),
        };
    }

    async function poll() {
        polls++;
        let row = null;
        try { row = await fetchSession(); } catch (e) { console.error('[Caps Success] Lookup failed:', e); }

        if (!row) {
            // Transient lookup failures keep polling — never bail to the
            // "couldn't look up" screen mid-healthy-flow.
            if (polls < MAX_POLLS) { setTimeout(poll, POLL_MS); return; }
            $('s-delayed-num').textContent = quoteID;
            show('s-delayed');
            return;
        }

        const status = String(row.Status || '');
        if (status === 'Processed' || status === 'Payment Confirmed' || status.indexOf('ShopWorks Failed') !== -1) {
            renderSuccess(row, status);
            sendEmailsOnce(row);
            return;
        }
        if (polls >= MAX_POLLS) {
            $('s-delayed-num').textContent = quoteID;
            show('s-delayed');
            return;
        }
        $('s-working-msg').textContent = polls > 6
            ? 'Still working — payments sometimes take up to a minute to confirm. Don’t close this tab.'
            : 'Payment received — we’re writing your order into our production system.';
        setTimeout(poll, POLL_MS);
    }

    function renderSuccess(row, status) {
        const { customerData, orderTotals, orderSettings } = parseBlobs(row);
        const isPickup = customerData.deliveryMethod === 'pickup';

        $('s-order-num').textContent = row.QuoteID;
        // Server-stamped ship promise (proof-first-standard mode) — the
        // honest wording: the window starts at PROOF APPROVAL.
        const sp = orderSettings.shipPromise || {};
        const windowLabel = sp.rangeLabel || sp.label || '7–10 business days';
        $('s-ship-line').innerHTML =
            `<i class="fas ${isPickup ? 'fa-store' : 'fa-truck-fast'}"></i> ` +
            (isPickup ? 'Ready for pickup ' : 'Ships ') +
            escapeHTML(windowLabel) +
            ' — clock starts when you approve your digital proof';

        // No client mockups on this channel — show the customer's own logo
        // files (the digitized proof comes by email).
        const figs = [];
        const logoFig = (l, label) => {
            if (l && l.fileUrl) {
                figs.push(`<figure><img src="${escapeHTML(l.fileUrl)}" alt="${escapeHTML(label)}">` +
                    `<figcaption>${escapeHTML(label)}</figcaption></figure>`);
            }
        };
        logoFig(orderSettings.frontLogo, 'Front logo');
        logoFig(orderSettings.backLogo, 'Back logo');
        ((orderSettings.mockups || []).slice(0, 6)).forEach((m) => {
            figs.push(`<figure><img src="${escapeHTML(m.url)}" alt="Mockup ${escapeHTML(m.color || '')}">` +
                `<figcaption>${escapeHTML(m.color || '')}${m.view ? ' · ' + escapeHTML(m.view) : ''}</figcaption></figure>`);
        });
        $('s-mockups').innerHTML = figs.join('');

        // Totals — straight from the server-stamped order of record
        let h = '';
        const qty = orderTotals.totalQuantity || 0;
        h += `<div class="tot-row"><span>Caps (${qty}) — front logo included</span><span>${money(orderTotals.subtotal)}</span></div>`;
        h += `<div class="tot-row"><span>Logo setup &amp; digitizing</span><span>FREE</span></div>`;
        const shipPaid = !isPickup && orderTotals.shipping > 0;
        h += `<div class="tot-row"><span>${isPickup ? 'Pickup — Milton, WA' : 'Shipping'}</span><span>${shipPaid ? money(orderTotals.shipping) : 'FREE'}</span></div>`;
        h += `<div class="tot-row"><span>Sales tax</span><span>${money(orderTotals.salesTax)}</span></div>`;
        h += `<div class="tot-row is-grand"><span>Paid</span><span>${money(orderTotals.grandTotal)}</span></div>`;
        $('s-summary').innerHTML = h;

        // Timeline — ALWAYS proof-first on this channel (decision #11)
        const steps = [
            { icon: 'fa-circle-check', title: 'Payment confirmed', sub: 'Receipt emailed by Stripe', done: true },
            { icon: 'fa-stamp', title: 'Digital proof by email (2–3 business days)', sub: 'Nothing stitches until you approve it', done: false },
            { icon: 'fa-compact-disc', title: 'Embroidery', sub: `Stitched in our Milton WA shop${orderSettings.backLogo ? ' — front + back logos' : ''}`, done: false },
            {
                icon: isPickup ? 'fa-store' : 'fa-truck-fast',
                title: isPickup ? 'Ready for pickup' : 'Ships free',
                sub: isPickup
                    ? '2025 Freeman Rd E, Milton, WA 98354 — 7–10 business days after proof approval'
                    : '7–10 business days after proof approval',
                done: false,
            },
        ];
        $('s-timeline').innerHTML = steps.map((s) =>
            `<div class="success-step ${s.done ? '' : 'is-pending'}"><i class="fas ${s.icon}"></i>` +
            `<span><strong>${escapeHTML(s.title)}</strong><small>${escapeHTML(s.sub)}</small></span></div>`).join('');

        if (status.indexOf('ShopWorks Failed') !== -1) {
            $('s-email-note').textContent =
                'Our team is completing your production setup by hand — your confirmation email may take a little longer.';
        }

        const qEl = $('s-questions');
        if (qEl) {
            const subj = encodeURIComponent(`Order ${row.QuoteID} — question or change`);
            qEl.innerHTML = `Questions or changes? Call <a href="tel:253-922-5793">253-922-5793</a> ` +
                `or email <a href="mailto:sales@nwcustomapparel.com?subject=${subj}">sales@nwcustomapparel.com</a> — ` +
                `mention order <strong>${escapeHTML(row.QuoteID)}</strong>. Changes are free until we stitch.`;
        }

        // A confirmed order means the studio cart is done — start fresh next
        // time. Leaving the key behind would reload an already-PAID cart on
        // "Start another order" (the tees double-order lesson).
        try { sessionStorage.removeItem('caps_studio_v1'); } catch (_) { /* ok */ }

        show('s-done');
    }

    // ── EmailJS fallback (webhook-authoritative; see header) ────────
    function sendEmailsOnce(row) {
        if (emailed) return;
        const guard = 'caps_emails_sent_' + quoteID;
        try {
            if (sessionStorage.getItem(guard)) return;
            sessionStorage.setItem(guard, '1');
        } catch (_) { /* still attempt once per page load */ }
        emailed = true;

        const { customerData, colorConfigs, orderTotals, orderSettings } = parseBlobs(row);

        // Webhook stamp present → the server already sent both emails.
        if (orderSettings.emailsSentAt) {
            console.log('[Caps Success] Emails already sent by webhook at', orderSettings.emailsSentAt, '— skipping browser sends');
            return;
        }
        if (!customerData.email) return;

        // Product name from the server-stamped order settings; registry
        // fallback name covers legacy rows.
        const productLabel = escapeHTML(orderSettings.styleName || orderSettings.productTitle || 'Custom Embroidered Cap');
        let productsTable = '<table><thead><tr><th>Product</th><th>Color</th><th>Size</th><th>Qty</th><th>Price</th></tr></thead><tbody>';
        Object.values(colorConfigs).forEach((config) => {
            Object.entries(config.sizeBreakdown || {}).forEach(([size, sd]) => {
                if (sd && sd.quantity > 0) {
                    productsTable += `<tr><td>${productLabel} — front logo embroidered${orderSettings.backLogo ? ' + back logo' : ''}</td>` +
                        `<td>${escapeHTML(config.displayColor)}</td>` +
                        `<td>${escapeHTML(size)}</td><td>${sd.quantity}</td><td>${money(sd.unitPrice)}</td></tr>`;
                }
            });
        });
        productsTable += '</tbody></table>';

        const paymentConfirmation =
            `<div class="alert-success"><strong>✓ Payment Confirmed</strong><br>` +
            `<span style="font-size:14px;">Amount: ${money(orderTotals.grandTotal)}</span><br>` +
            `<span style="font-size:12px;color:#6b7280;">Stripe Session: ${escapeHTML(sessionId.substring(0, 20))}…</span></div>`;

        const messageSection = customerData.notes
            ? `<div class="section"><h2>📝 Special Instructions</h2><p style="background:#f9fafb;padding:15px;border-radius:6px;border-left:4px solid #2d5f3f;">${escapeHTML(customerData.notes)}</p></div>`
            : '';

        const sp = orderSettings.shipPromise || {};
        const shipPromiseLabel = (sp.rangeLabel || sp.label || '7–10 business days') + ' after proof approval';
        const isPickup = customerData.deliveryMethod === 'pickup';
        const deliverySection = isPickup
            ? '<p><strong>Pickup</strong> — 2025 Freeman Rd E, Milton, WA 98354<br>' +
              '<span style="font-size:13px;color:#6b7280;">We’ll call you the moment your caps are ready.</span></p>'
            : `<p><strong>Ship to:</strong><br>` +
              `${escapeHTML(`${customerData.firstName || ''} ${customerData.lastName || ''}`.trim())}<br>` +
              `${escapeHTML(customerData.address1 || '')}<br>` +
              `${escapeHTML(customerData.city || '')}, ${escapeHTML(customerData.state || '')} ${escapeHTML(customerData.zip || '')}</p>`;

        const totRow = (label, txt) =>
            `<div style="display:flex;justify-content:space-between;padding:3px 0;font-size:14px;">` +
            `<span>${label}</span><span>${txt}</span></div>`;
        const shippingRow = isPickup ? ''
            : totRow('Shipping', orderTotals.shipping > 0 ? money(orderTotals.shipping) : 'FREE');
        const taxRow = orderTotals.salesTax > 0 ? totRow('Sales tax', money(orderTotals.salesTax)) : '';

        const mailSubject = encodeURIComponent(`Order ${row.QuoteID} — question or change`);
        const questionsCta =
            `<p style="font-size:13px;color:#374151;">Questions or changes? Call 253-922-5793 or email ` +
            `<a href="mailto:sales@nwcustomapparel.com?subject=${mailSubject}">sales@nwcustomapparel.com</a> — ` +
            `mention order ${escapeHTML(row.QuoteID)}. Changes are free until we stitch.</p>`;

        // Proof-first banner replaces the tee templates' rush banner slot —
        // ONE shared template serves both channels (registry decision #15).
        const proofBanner =
            '<div style="background:#e3f1e4;border:1px solid #2f7d3b;border-radius:8px;padding:12px 16px;margin:14px 0;">' +
            '<strong style="color:#1b4424;">🪡 Digital proof first</strong>' +
            '<span style="font-size:13px;color:#1b4424;"> — we email your sew-out proof within 2–3 business days. Nothing stitches until you approve it.</span></div>';

        // Customer-typed fields are escaped — these land in HTML email bodies.
        const base = {
            order_number: escapeHTML(row.QuoteID),
            customer_name: escapeHTML(`${customerData.firstName || ''} ${customerData.lastName || ''}`.trim()),
            customer_email: escapeHTML(customerData.email),
            customer_phone: escapeHTML(customerData.phone || ''),
            company_name: escapeHTML(customerData.company || ''),
            print_location: escapeHTML(orderSettings.printLocationName || 'Cap Front'),
            payment_confirmation: paymentConfirmation,
            products_table: productsTable,
            subtotal: money(orderTotals.subtotal),
            total: money(orderTotals.grandTotal),
            ship_promise: escapeHTML(shipPromiseLabel),
            delivery_section: deliverySection,
            shipping_row: shippingRow,
            tax_row: taxRow,
            ltm_row: '',                       // NO LTM on this channel, ever
            rush_flag: '',                     // no rush on caps v1
            rush_banner: proofBanner,          // banner slot reused for the proof promise
            questions_cta: questionsCta,
            message_section: messageSection,
            company_phone: '253-922-5793',
            reply_to: 'sales@nwcustomapparel.com',
        };

        // Order-status link (HMAC token stamped into OrderSettingsJSON by the
        // Stripe webhook). Absent token → omit the param.
        if (orderSettings.statusToken) {
            base.order_status_url = `${location.origin}/order-status?id=${encodeURIComponent(row.QuoteID)}&t=${encodeURIComponent(orderSettings.statusToken)}`;
        }

        try { emailjs.init(EMAILJS_PUBLIC_KEY); } catch (_) { /* already init */ }
        emailjs.send(EMAILJS_SERVICE, 'template_sample_customer', Object.assign({
            to_email: customerData.email,
            to_name: base.customer_name,
        }, base)).then(
            () => console.log('[Caps Success] Customer email sent'),
            (e) => console.error('[Caps Success] Customer email failed:', e)
        );
        emailjs.send(EMAILJS_SERVICE, 'template_sample_sales', Object.assign({
            to_email: 'erik@nwcustomapparel.com',
            to_name: 'NWCA Sales',
        }, base)).then(
            () => console.log('[Caps Success] Staff email sent'),
            (e) => console.error('[Caps Success] Staff email failed:', e)
        );
    }

    // ── Go ──────────────────────────────────────────────────────────
    document.addEventListener('DOMContentLoaded', () => {
        if (!quoteID) {
            $('s-error-msg').textContent = 'This page needs an order reference in the link. ' +
                'If you just paid, your payment is safe with Stripe — call 253-922-5793 and we’ll find your order.';
            show('s-error');
            return;
        }
        show('s-working');
        poll();
    });
})();
