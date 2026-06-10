/**
 * 3-day-tees-success.js — post-payment page for 3-Day Tees.
 *
 * Flow (webhook-driven, this page only OBSERVES):
 *   1. Stripe redirects here with ?session_id=…&quote_id=3DT….
 *   2. Poll the quote session in Caspio every 3s (max ~75s):
 *        'Processed'                          → full success
 *        'Payment Confirmed'                  → keep polling briefly, then success
 *        'Payment Confirmed - ShopWorks Failed' → success-with-delay copy
 *        'Pending Payment'                    → webhook hasn't landed yet, keep polling
 *   3. On first confirmed status: send the customer + staff EmailJS
 *      confirmations ONCE (sessionStorage guard), from the Caspio JSON blobs
 *      (NOT browser state — works even if the tab was reopened).
 *
 * The quote row lookup uses ?quoteID= + .find(QuoteID===id) — never
 * sessions[0] (the 2026-06-01 wrong-quote lesson).
 */
(function () {
    'use strict';

    const API_BASE = (window.APP_CONFIG && window.APP_CONFIG.API && window.APP_CONFIG.API.BASE_URL)
        || 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';
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
        try { row = await fetchSession(); } catch (e) { console.error('[3DT Success] Lookup failed:', e); }

        if (!row) {
            // Transient lookup failures keep polling — never bail to the
            // "couldn't look up" screen mid-healthy-flow (review fix 2026-06-09).
            if (polls < MAX_POLLS) { setTimeout(poll, POLL_MS); return; }
            $('s-delayed-num').textContent = quoteID;
            show('s-delayed');
            return;
        }

        const status = String(row.Status || '');
        if (status === 'Processed' || status === 'Payment Confirmed') {
            renderSuccess(row, status);
            sendEmailsOnce(row);
            // 'Payment Confirmed' is normally seconds away from 'Processed' —
            // we still show success now; production status is an internal detail.
            return;
        }
        if (status.indexOf('ShopWorks Failed') !== -1) {
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
        const { customerData, colorConfigs, orderTotals, orderSettings } = parseBlobs(row);

        $('s-order-num').textContent = row.QuoteID;
        const promise = orderSettings.shipPromise && orderSettings.shipPromise.label;
        $('s-ship-line').innerHTML = promise
            ? `<i class="fas fa-truck-fast"></i> Ships ${escapeHTML(promise)} from Milton, WA`
            : '<i class="fas fa-truck-fast"></i> Ships in 3 business days from Milton, WA';

        // Mockups straight from the saved order
        const mocks = (orderSettings.mockups || []).slice(0, 6);
        $('s-mockups').innerHTML = mocks.map((m) =>
            `<figure><img src="${escapeHTML(m.url)}" alt="Mockup ${escapeHTML(m.color)} ${escapeHTML(m.view)}">` +
            `<figcaption>${escapeHTML(m.color)} · ${escapeHTML(m.view)}</figcaption></figure>`).join('');

        // Totals
        let h = '';
        const qty = orderTotals.totalQuantity || 0;
        h += `<div class="tot-row"><span>Shirts (${qty})</span><span>${money(orderTotals.subtotal)}</span></div>`;
        if (orderTotals.ltmFee > 0) h += `<div class="tot-row"><span>Small-batch fee</span><span>${money(orderTotals.ltmFee)}</span></div>`;
        h += `<div class="tot-row"><span>${customerData.deliveryMethod === 'pickup' ? 'Pickup — Milton, WA' : 'UPS Ground shipping'}</span><span>${customerData.deliveryMethod === 'pickup' ? 'FREE' : money(orderTotals.shipping)}</span></div>`;
        h += `<div class="tot-row"><span>Sales tax</span><span>${money(orderTotals.salesTax)}</span></div>`;
        h += `<div class="tot-row is-grand"><span>Paid</span><span>${money(orderTotals.grandTotal)}</span></div>`;
        $('s-summary').innerHTML = h;

        // Timeline — proof-first when art needs human review
        const needsReview = !!orderSettings.needsArtReview;
        const steps = [];
        steps.push({ icon: 'fa-circle-check', title: 'Payment confirmed', sub: 'Receipt emailed by Stripe', done: true });
        if (needsReview) {
            steps.push({ icon: 'fa-palette', title: 'Art proof by email (~2 business hours)', sub: 'Your 3-day clock starts when you approve the proof', done: false });
        } else {
            steps.push({ icon: 'fa-palette', title: 'Artwork check (today)', sub: 'We verify your file prints exactly like your preview', done: false });
        }
        steps.push({ icon: 'fa-print', title: 'Printing', sub: 'Full-color DTG in our Milton shop', done: false });
        steps.push({
            icon: customerData.deliveryMethod === 'pickup' ? 'fa-store' : 'fa-truck-fast',
            title: customerData.deliveryMethod === 'pickup' ? 'Ready for pickup' : 'Ships UPS Ground',
            sub: promise ? `Promised: ${promise}` : 'Within 3 business days', done: false,
        });
        $('s-timeline').innerHTML = steps.map((s) =>
            `<div class="success-step ${s.done ? '' : 'is-pending'}"><i class="fas ${s.icon}"></i>` +
            `<span><strong>${escapeHTML(s.title)}</strong><small>${escapeHTML(s.sub)}</small></span></div>`).join('');

        if (status.indexOf('ShopWorks Failed') !== -1) {
            $('s-email-note').textContent =
                'Our team is completing your production setup by hand — your confirmation email may take a little longer.';
        }

        // A confirmed order means the studio cart is done — start fresh next time.
        try { sessionStorage.removeItem('3dt_studio_v1'); } catch (_) { /* ok */ }

        show('s-done');
    }

    // ── EmailJS (same templates the legacy page used) ────────────────
    function sendEmailsOnce(row) {
        if (emailed) return;
        const guard = '3dt_emails_sent_' + quoteID;
        try {
            if (sessionStorage.getItem(guard)) return;
            sessionStorage.setItem(guard, '1');
        } catch (_) { /* still attempt once per page load */ }
        emailed = true;

        const { customerData, colorConfigs, orderTotals, orderSettings } = parseBlobs(row);
        if (!customerData.email) return;
        // Since 2026-06-10 the Stripe WEBHOOK sends the confirmation emails
        // server-side and stamps emailsSentAt — browser send is only the
        // fallback for rows the webhook couldn't email (mirrors custom-tees).
        if (orderSettings && orderSettings.emailsSentAt) {
            console.log('[3DT Success] Emails already sent server-side — skipping browser send.');
            return;
        }

        let productsTable = '<table><thead><tr><th>Product</th><th>Color</th><th>Size</th><th>Qty</th><th>Price</th></tr></thead><tbody>';
        Object.values(colorConfigs).forEach((config) => {
            Object.entries(config.sizeBreakdown || {}).forEach(([size, sd]) => {
                if (sd && sd.quantity > 0) {
                    productsTable += `<tr><td>Port &amp; Company Core Cotton Tee</td><td>${escapeHTML(config.displayColor)}</td>` +
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

        // Customer-typed fields are escaped — these land in HTML email bodies.
        const base = {
            order_number: escapeHTML(row.QuoteID),
            customer_name: escapeHTML(`${customerData.firstName || ''} ${customerData.lastName || ''}`.trim()),
            customer_email: escapeHTML(customerData.email),
            customer_phone: escapeHTML(customerData.phone || ''),
            company_name: escapeHTML(customerData.company || ''),
            print_location: escapeHTML(orderSettings.printLocationName || 'Left Chest'),
            payment_confirmation: paymentConfirmation,
            products_table: productsTable,
            subtotal: money(orderTotals.subtotal),
            total: money(orderTotals.grandTotal),
            message_section: messageSection,
            company_phone: '253-922-5793',
            reply_to: 'erik@nwcustomapparel.com',
        };

        try { emailjs.init(EMAILJS_PUBLIC_KEY); } catch (_) { /* already init */ }
        emailjs.send(EMAILJS_SERVICE, 'template_sample_customer', Object.assign({
            to_email: customerData.email,
            to_name: base.customer_name,
        }, base)).then(
            () => console.log('[3DT Success] Customer email sent'),
            (e) => console.error('[3DT Success] Customer email failed:', e)
        );
        emailjs.send(EMAILJS_SERVICE, 'template_sample_sales', Object.assign({
            to_email: 'erik@nwcustomapparel.com',
            to_name: 'NWCA Sales',
        }, base)).then(
            () => console.log('[3DT Success] Staff email sent'),
            (e) => console.error('[3DT Success] Staff email failed:', e)
        );
    }

    // ── Go ──────────────────────────────────────────────────────────
    document.addEventListener('DOMContentLoaded', () => {
        if (!quoteID) {
            $('s-error-msg').textContent = 'This page needs an order reference in the link. ' +
                'If you just paid, your payment is safe — call us and we’ll confirm your order.';
            show('s-error');
            return;
        }
        show('s-working');
        poll();
    });
})();
