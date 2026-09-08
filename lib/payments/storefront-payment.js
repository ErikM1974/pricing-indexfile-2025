// storefront-payment: invoked only after Stripe signature verification.
module.exports = function create(ctx) {
    const {
        CASPIO_PROXY_BASE,
        INTERNAL_CALL_KEY,
        PORT,
        alert3DT,
        computeOrderStatusToken,
        fetch,
        fetchQuoteSessionRow,
        recordOrderPayment,
        sendOrderConfirmationEmails,
        withProxySecret,
    } = ctx;
    return async function handleStorefrontOrderPaid(session, quoteID, res) {
        console.log('[Webhook] Processing payment for QuoteID:', quoteID);

        // Check idempotency - has this webhook already been processed?
        // fetchQuoteSessionRow: refresh=true bypasses the proxy's 5-min lookup
        // cache (a stale [] here would orphan a PAID order) and exact-matches
        // the QuoteID — never sessions[0] (the 2026-06-01 wrong-quote lesson).
        let matched;
        try {
            matched = await fetchQuoteSessionRow(quoteID);
        } catch (lookupErr) {
            // A FAILED lookup is not "no record" — return 5xx so Stripe RETRIES
            // the webhook (transient Caspio outages must self-heal, not orphan a
            // paid order behind a misleading no-record alert).
            console.error(
                '[Webhook] Quote lookup failed:',
                lookupErr.message,
                '— asking Stripe to retry'
            );
            return res.status(503).send('Quote lookup unavailable — retry');
        }

        if (!matched) {
            // Customer PAID but we have no order record — this must never be silent.
            alert3DT(
                `PAYMENT WITHOUT ORDER RECORD — Stripe session ${session.id} paid $${(session.amount_total / 100).toFixed(2)} for QuoteID ${quoteID}, but no quote_sessions row matches. Recover from the Stripe dashboard.`
            );
            return res.json({ received: true, status: 'no-record' });
        }

        {
            const quoteSession = matched;

            // Idempotency: 'Processed' and 'ShopWorks Failed' are terminal.
            // 'Payment Confirmed' is INTERMEDIATE — a crash between the status
            // PUT and the push would strand a paid order there forever; a Stripe
            // redelivery that finds it raises an alert instead of silently
            // skipping. (3DT rebuild review fix, 2026-06-09)
            if (
                quoteSession.Status === 'Processed' ||
                String(quoteSession.Status).indexOf('ShopWorks Failed') !== -1
            ) {
                console.log('[Webhook] Already processed, skipping:', quoteID);
                return res.json({ received: true, status: 'duplicate' });
            }
            if (quoteSession.Status === 'Payment Confirmed') {
                alert3DT(
                    `Webhook redelivery found ${quoteID} stuck at 'Payment Confirmed' — the ShopWorks push may not have completed. Verify in ShopWorks before re-pushing (duplicate-order risk).`
                );
                return res.json({ received: true, status: 'stuck-payment-confirmed' });
            }

            // ── Server-authoritative confirmation emails (2026-06-10) ──────────
            // Sent HERE (not the success page) so a closed tab can't lose the
            // confirmation. Payment is already verified (signature + idempotency
            // checks above) and the params come from the Caspio blobs, so this
            // runs BEFORE the ShopWorks push — i.e. regardless of push outcome —
            // and BEFORE the status flips to 'Payment Confirmed', so the success
            // page's poller always sees the emailsSentAt dedup stamp together
            // with a confirmed status (no duplicate-send race). Fail-soft: email
            // errors never block the webhook or the push; when the stamp is
            // absent the success page falls back to browser sends.
            const statusToken = computeOrderStatusToken(quoteID); // null when ORDER_STATUS_SECRET unset
            let emailResult = { customerOk: false, salesOk: false };
            try {
                emailResult = await sendOrderConfirmationEmails(
                    quoteSession,
                    session.id,
                    statusToken
                );
            } catch (emailErr) {
                console.error('[Webhook] Confirmation email step failed (non-fatal):', emailErr);
            }

            // Merge the dedup stamp + order-status token into OrderSettingsJSON,
            // preserving every existing key (the success page, push transformer
            // and status API all read this blob).
            let mergedSettingsJSON = null;
            try {
                const settings = JSON.parse(quoteSession.OrderSettingsJSON || '{}');
                if (statusToken) settings.statusToken = statusToken;
                if (emailResult.customerOk) settings.emailsSentAt = new Date().toISOString();
                if (statusToken || emailResult.customerOk)
                    mergedSettingsJSON = JSON.stringify(settings);
            } catch (mergeErr) {
                console.error(
                    '[Webhook] Could not merge OrderSettingsJSON stamps (non-fatal):',
                    mergeErr.message
                );
            }

            // Update status to Payment Confirmed (+ email/status-token stamps)
            const updateUrl = `${CASPIO_PROXY_BASE}/api/quote_sessions/${quoteSession.PK_ID}`;
            const confirmedPut = await fetch(updateUrl, {
                method: 'PUT',
                headers: withProxySecret({ 'Content-Type': 'application/json' }),
                body: JSON.stringify(
                    Object.assign(
                        {
                            Status: 'Payment Confirmed',
                            Notes: `${quoteSession.Notes}\nPayment Confirmed: ${new Date().toISOString()}\nStripe Payment Intent: ${session.payment_intent}\nAmount: $${(session.amount_total / 100).toFixed(2)}`,
                        },
                        mergedSettingsJSON ? { OrderSettingsJSON: mergedSettingsJSON } : {}
                    )
                ),
            });

            if (!confirmedPut.ok) {
                console.error(
                    '[Webhook] Payment marker write failed:',
                    quoteID,
                    confirmedPut.status
                );
                return res.status(503).send('Payment record write failed — retry');
            }

            console.log('[Webhook] ✓ Payment confirmed for:', quoteID);

            // Order_Payments ledger mirror (fail-soft, idempotent on session id) —
            // storefront orders (3DT/CTS/CAP) now feed the staff dashboard's Money
            // Collected widget like quote deposits and samples do (2026-07-06)
            recordOrderPayment({
                quoteID,
                type: 'order',
                amount: Math.round(session.amount_total) / 100,
                stripeSessionId: session.id,
                paymentIntent: session.payment_intent || '',
                payerEmail:
                    (session.customer_details && session.customer_details.email) ||
                    session.customer_email ||
                    '',
                customerName: quoteSession.CustomerName || '',
                companyName: quoteSession.CompanyName || '',
            });

            // Now submit to ShopWorks
            try {
                // Retrieve order data from Caspio (instead of Stripe metadata)
                // This avoids Stripe's 500-character metadata limit
                const orderData = {
                    customerData: JSON.parse(quoteSession.CustomerDataJSON || '{}'),
                    colorConfigs: JSON.parse(quoteSession.ColorConfigsJSON || '{}'),
                    orderTotals: JSON.parse(quoteSession.OrderTotalsJSON || '{}'),
                    orderSettings: JSON.parse(quoteSession.OrderSettingsJSON || '{}'),
                };

                console.log('[Webhook] Retrieved order data from Caspio');

                // Call existing ShopWorks submission endpoint
                // Use production domain instead of localhost for Heroku compatibility
                const baseUrl = process.env.BASE_URL || `http://localhost:${PORT}`;
                const shopWorksResponse = await fetch(`${baseUrl}/api/submit-3day-order`, {
                    method: 'POST',
                    // Internal key: bypasses strictLimiter AND marks the payment as
                    // already signature-verified by this webhook.
                    headers: {
                        'Content-Type': 'application/json',
                        'x-nwca-internal': INTERNAL_CALL_KEY,
                    },
                    body: JSON.stringify({
                        tempOrderNumber: quoteID,
                        customerData: orderData.customerData,
                        colorConfigs: orderData.colorConfigs,
                        orderTotals: orderData.orderTotals,
                        orderSettings: orderData.orderSettings,
                        paymentConfirmed: true,
                        stripeSessionId: session.id,
                        paymentAmount: session.amount_total,
                    }),
                });

                // /api/submit-3day-order returns HTTP 200 with {success:false} on a
                // ManageOrders rejection — checking only response.ok used to mark
                // paid-but-unpushed orders 'Processed' with no alert (fixed 2026-06-09).
                const result = shopWorksResponse.ok
                    ? await shopWorksResponse.json().catch(() => ({}))
                    : {};
                if (!shopWorksResponse.ok || result.success !== true) {
                    throw new Error(
                        result.error || `ShopWorks API returned HTTP ${shopWorksResponse.status}`
                    );
                }

                // Update to Processed — and notice when the bookkeeping PUT itself
                // fails (otherwise a redelivery could double-push to ShopWorks).
                try {
                    const processedPut = await fetch(updateUrl, {
                        method: 'PUT',
                        headers: withProxySecret({ 'Content-Type': 'application/json' }),
                        body: JSON.stringify({
                            Status: 'Processed',
                            Notes: `${quoteSession.Notes}\nShopWorks Order Created: ${result.orderNumber || 'N/A'}\nSubmitted: ${new Date().toISOString()}`,
                        }),
                    });
                    if (!processedPut.ok) throw new Error(`HTTP ${processedPut.status}`);
                } catch (recordError) {
                    alert3DT(
                        `${quoteID} pushed to ShopWorks OK but the Caspio status update to 'Processed' failed (${recordError.message}) — fix the row manually; do not re-push the order.`
                    );
                }

                console.log('[Webhook] ✓ ShopWorks order created:', quoteID);
            } catch (shopWorksError) {
                console.error('[Webhook] ShopWorks submission failed:', shopWorksError);
                alert3DT(
                    `PAID ORDER NEEDS MANUAL PUSH — ${quoteID} ($${(session.amount_total / 100).toFixed(2)}, ${session.customer_email || 'no email'}) failed the ShopWorks push: ${shopWorksError.message}. Status set to 'Payment Confirmed - ShopWorks Failed'.`
                );

                // Update status to indicate failure
                await fetch(updateUrl, {
                    method: 'PUT',
                    headers: withProxySecret({ 'Content-Type': 'application/json' }),
                    body: JSON.stringify({
                        Status: 'Payment Confirmed - ShopWorks Failed',
                        Notes: `${quoteSession.Notes}\nShopWorks Error: ${shopWorksError.message}\nRequires manual processing`,
                    }),
                });
            }
        }

        return res.json({ received: true });
    };
};
