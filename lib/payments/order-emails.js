// Payment order-emails: explicit shared application dependencies.
module.exports = function create(ctx) {
    const { buildOrderStatusUrl, channelConfig, sendEmailJSTemplate } = ctx;

    function escapeHTMLSrv(s) {
        return String(s == null ? '' : s).replace(
            /[&<>"']/g,
            (c) =>
                ({
                    '&': '&amp;',
                    '<': '&lt;',
                    '>': '&gt;',
                    '"': '&quot;',
                    "'": '&#39;',
                })[c]
        );
    }

    const moneySrv = (v) => '$' + (Number(v) || 0).toFixed(2);

    // Builds the shared template params for template_sample_customer +
    // template_sample_sales from the Caspio row's JSON blobs. Returns
    // { params, customerEmail } or null when the row has no customer email.
    function buildOrderConfirmationParams(quoteSession, stripeSessionId, orderStatusUrl) {
        const parse = (s) => {
            try {
                return JSON.parse(s || '{}');
            } catch (_) {
                return {};
            }
        };
        const customerData = parse(quoteSession.CustomerDataJSON);
        const colorConfigs = parse(quoteSession.ColorConfigsJSON);
        const orderTotals = parse(quoteSession.OrderTotalsJSON);
        const orderSettings = parse(quoteSession.OrderSettingsJSON);
        if (!customerData.email) return null;

        const esc = escapeHTMLSrv;
        const money = moneySrv;
        const quoteID = quoteSession.QuoteID;
        const sessionId = String(stripeSessionId || '');

        // Product name from the server-stamped order settings (multi-style);
        // legacy rows without one fall back to the channel's default (PC54 name).
        const productLabel =
            esc(
                orderSettings.styleName || channelConfig(orderSettings.channel).fallbackProductName
            ) + (orderSettings.rush ? ' <strong>(3-Day Rush)</strong>' : '');
        let productsTable =
            '<table><thead><tr><th>Product</th><th>Color</th><th>Size</th><th>Qty</th><th>Price</th></tr></thead><tbody>';
        Object.values(colorConfigs || {}).forEach((config) => {
            Object.entries((config && config.sizeBreakdown) || {}).forEach(([size, sd]) => {
                if (sd && sd.quantity > 0) {
                    productsTable +=
                        `<tr><td>${productLabel}</td><td>${esc(config.displayColor)}</td>` +
                        `<td>${esc(size)}</td><td>${sd.quantity}</td><td>${money(sd.unitPrice)}</td></tr>`;
                }
            });
        });
        productsTable += '</tbody></table>';

        const paymentConfirmation =
            `<div class="alert-success"><strong>✓ Payment Confirmed</strong><br>` +
            `<span style="font-size:14px;">Amount: ${money(orderTotals.grandTotal)}</span><br>` +
            `<span style="font-size:12px;color:#6b7280;">Stripe Session: ${esc(sessionId.substring(0, 20))}…</span></div>`;

        const messageSection = customerData.notes
            ? `<div class="section"><h2>📝 Special Instructions</h2><p style="background:#f9fafb;padding:15px;border-radius:6px;border-left:4px solid #2d5f3f;">${esc(customerData.notes)}</p></div>`
            : '';

        // Ship promise + delivery section (server-stamped — never recomputed)
        const sp = orderSettings.shipPromise || {};
        const shipPromiseLabel = sp.rangeLabel || sp.label || '7–10 business days';
        const isPickup = customerData.deliveryMethod === 'pickup';
        const deliverySection = isPickup
            ? '<p><strong>Pickup</strong> — 2025 Freeman Rd E, Milton, WA 98354<br>' +
              '<span style="font-size:13px;color:#6b7280;">We’ll call you the moment your order is ready.</span></p>'
            : `<p><strong>Ship to (UPS Ground):</strong><br>` +
              `${esc(`${customerData.firstName || ''} ${customerData.lastName || ''}`.trim())}<br>` +
              `${esc(customerData.address1 || '')}<br>` +
              `${esc(customerData.city || '')}, ${esc(customerData.state || '')} ${esc(customerData.zip || '')}</p>`;

        // Money rows that make Subtotal → Total visibly foot. Empty string when the
        // row doesn't apply so the template row collapses. A SHIP order with $0
        // shipping is free-over-threshold → show FREE.
        const totRow = (label, txt) =>
            `<div style="display:flex;justify-content:space-between;padding:3px 0;font-size:14px;">` +
            `<span>${label}</span><span>${txt}</span></div>`;
        const shippingRow = isPickup
            ? ''
            : totRow(
                  'UPS Ground shipping',
                  orderTotals.shipping > 0 ? money(orderTotals.shipping) : 'FREE'
              );
        const taxRow =
            orderTotals.salesTax > 0 ? totRow('Sales tax', money(orderTotals.salesTax)) : '';
        const ltmRow =
            orderTotals.ltmFee > 0 ? totRow('Small-batch fee', money(orderTotals.ltmFee)) : '';

        const mailSubject = encodeURIComponent(`Order ${quoteID} — question or change`);
        const questionsCta =
            `<p style="font-size:13px;color:#374151;">Questions or changes? Call 253-922-5793 or email ` +
            `<a href="mailto:sales@nwcustomapparel.com?subject=${mailSubject}">sales@nwcustomapparel.com</a> — ` +
            `mention order ${esc(quoteID)}. Changes are free until we print.</p>`;

        // Customer-typed fields are escaped — these land in HTML email bodies.
        const params = {
            order_number: esc(quoteID),
            customer_name: esc(
                `${customerData.firstName || ''} ${customerData.lastName || ''}`.trim()
            ),
            customer_email: esc(customerData.email),
            customer_phone: esc(customerData.phone || ''),
            company_name: esc(customerData.company || ''),
            print_location: esc(orderSettings.printLocationName || 'Left Chest'),
            payment_confirmation: paymentConfirmation,
            products_table: productsTable,
            subtotal: money(orderTotals.subtotal),
            total: money(orderTotals.grandTotal),
            ship_promise: esc(shipPromiseLabel),
            delivery_section: deliverySection,
            shipping_row: shippingRow,
            tax_row: taxRow,
            ltm_row: ltmRow,
            rush_flag: orderSettings.rush ? '3-DAY RUSH' : '',
            // HTML banner block — yellow rush callout on rush orders, empty
            // (collapses) on standard ones. Templates render {{{rush_banner}}}
            // so ONE template serves both modes (EmailJS has no conditionals).
            rush_banner: orderSettings.rush
                ? '<div style="background:#fef3c7;border:1px solid #f59e0b;border-radius:8px;padding:12px 16px;margin:14px 0;">' +
                  '<strong style="color:#92400e;">⚡ 3-Day Rush Service</strong>' +
                  '<span style="font-size:13px;color:#92400e;"> — this order is on the rush production schedule.</span></div>'
                : '',
            questions_cta: questionsCta,
            message_section: messageSection,
            company_phone: '253-922-5793',
            reply_to: 'sales@nwcustomapparel.com',
        };
        // Status-page link (Feature B). Omitted when no token — the template's
        // {{order_status_url}} placeholder renders unresolved, which is acceptable.
        if (orderStatusUrl) params.order_status_url = orderStatusUrl;

        return { params, customerEmail: customerData.email };
    }

    // Sends BOTH confirmation emails (customer + sales) in parallel. Fail-soft:
    // missing env keys → one warn + skip (local dev; browser fallback sends);
    // send errors → console.error, never throw. Returns { customerOk, salesOk }.
    async function sendOrderConfirmationEmails(quoteSession, stripeSessionId, statusToken) {
        if (!process.env.EMAILJS_PUBLIC_KEY || !process.env.EMAILJS_PRIVATE_KEY) {
            console.warn(
                '[Webhook] EMAILJS_PUBLIC_KEY / EMAILJS_PRIVATE_KEY not set — skipping server-side confirmation emails (browser fallback will send).'
            );
            return { customerOk: false, salesOk: false };
        }
        const orderStatusUrl = statusToken
            ? buildOrderStatusUrl(quoteSession.QuoteID, statusToken)
            : null;
        const built = buildOrderConfirmationParams(quoteSession, stripeSessionId, orderStatusUrl);
        if (!built) {
            console.warn(
                '[Webhook] No customer email on',
                quoteSession.QuoteID,
                '— skipping confirmation emails.'
            );
            return { customerOk: false, salesOk: false };
        }
        const { params, customerEmail } = built;
        // Template ids come from the channel registry (legacy/absent channel →
        // 3DT default — both live channels share the tee templates today).
        let osForTemplates = {};
        try {
            osForTemplates = JSON.parse(quoteSession.OrderSettingsJSON || '{}');
        } catch (_) {
            /* legacy row */
        }
        const emailCfg = channelConfig(osForTemplates.channel).emails;
        const [customerOk, salesOk] = await Promise.all([
            sendEmailJSTemplate(
                emailCfg.confirmationCustomerTemplate,
                Object.assign(
                    {
                        to_email: customerEmail,
                        to_name: params.customer_name,
                    },
                    params
                )
            ).then(
                () => {
                    console.log(
                        '[Webhook] ✓ Customer confirmation email sent for',
                        quoteSession.QuoteID
                    );
                    return true;
                },
                (e) => {
                    console.error(
                        '[Webhook] Customer confirmation email failed for',
                        quoteSession.QuoteID,
                        ':',
                        e.message
                    );
                    return false;
                }
            ),
            sendEmailJSTemplate(
                emailCfg.confirmationSalesTemplate,
                Object.assign(
                    {
                        to_email: 'erik@nwcustomapparel.com',
                        to_name: 'NWCA Sales',
                    },
                    params
                )
            ).then(
                () => {
                    console.log(
                        '[Webhook] ✓ Sales confirmation email sent for',
                        quoteSession.QuoteID
                    );
                    return true;
                },
                (e) => {
                    console.error(
                        '[Webhook] Sales confirmation email failed for',
                        quoteSession.QuoteID,
                        ':',
                        e.message
                    );
                    return false;
                }
            ),
        ]);
        return { customerOk, salesOk };
    }

    return { escapeHTMLSrv, sendOrderConfirmationEmails };
};
