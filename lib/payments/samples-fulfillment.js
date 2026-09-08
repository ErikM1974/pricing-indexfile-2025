// Payment samples-fulfillment: explicit shared application dependencies.
module.exports = function create(ctx) {
    const {
        CASPIO_PROXY_BASE,
        CRM_API_SECRET,
        TDT_PROXY,
        alert3DT,
        buildSamplesPushPayload,
        channelConfig,
        fetch,
        fetchQuoteSessionRow,
        nowPacificNaiveIso,
        recordOrderPayment,
        sendEmailJSTemplate,
        withProxySecret,
    } = ctx;

    // ============================================================================
    // 3-Day Tees Helper Functions (following Christmas Bundles pattern)
    // ============================================================================

    // Quote ID builders ('3DT{MMDD}-{rand4}' / 'DTG{MMDD}-{rand4}' — the DTG
    // prefix is deliberate, Erik 2026-06-10: storefront orders land in Quote
    // Management alongside the internal builder's DTG quotes) now live in the
    // channel registry: config/storefront-channels.js `buildQuoteId` (jest-locked
    // format). The checkout route's uniqueness check still applies per candidate.

    // Save 3-Day Tees order to quote_sessions (Christmas Bundles pattern)
    // ══ Paid-sample fulfillment (webhook metadata.kind === 'samples-order') ═════
    // Mirrors the express-order webhook path's guarantees for the samples channel:
    // failed lookup → 5xx so Stripe retries; terminal statuses are idempotent;
    // 'Payment Confirmed' is stamped BEFORE the push; a failed push flags the row
    // for manual entry and alerts — the money is real either way. The payload
    // builder is pure + jest-locked (shared_components/js/samples-order-payload.js).
    async function handleSamplesOrderPaid(session, quoteID, res) {
        const chCfg = channelConfig('samples');
        const chLog = '[Samples Webhook]';
        let row;
        try {
            row = await fetchQuoteSessionRow(quoteID);
        } catch (lookupErr) {
            console.error(
                `${chLog} Quote lookup failed:`,
                lookupErr.message,
                '— asking Stripe to retry'
            );
            return res.status(503).send('Quote lookup unavailable — retry');
        }
        if (!row) {
            alert3DT(
                `PAYMENT WITHOUT ORDER RECORD — Stripe session ${session.id} paid $${(session.amount_total / 100).toFixed(2)} for SAMPLES ${quoteID}, but no quote_sessions row matches. Recover from the Stripe dashboard.`
            );
            return res.json({ received: true, status: 'no-record' });
        }
        if (row.Status === 'Processed' || String(row.Status).indexOf('ShopWorks Failed') !== -1) {
            console.log(`${chLog} Already processed, skipping:`, quoteID);
            return res.json({ received: true, status: 'duplicate' });
        }
        if (row.Status === 'Payment Confirmed') {
            alert3DT(
                `Webhook redelivery found SAMPLES ${quoteID} stuck at 'Payment Confirmed' — the ShopWorks push may not have completed. Verify in ShopWorks before re-pushing (duplicate-order risk).`
            );
            return res.json({ received: true, status: 'stuck-payment-confirmed' });
        }

        // Idempotency marker BEFORE the push (a redelivery mid-push must not double-order)
        const confirmedPut = await fetch(`${TDT_PROXY}/api/quote_sessions/${row.PK_ID}`, {
            method: 'PUT',
            headers: withProxySecret({ 'Content-Type': 'application/json' }),
            body: JSON.stringify({
                Status: 'Payment Confirmed',
                Notes: `${row.Notes}\nPayment Confirmed: ${new Date().toISOString()}\nStripe Payment Intent: ${session.payment_intent}\nAmount: $${(session.amount_total / 100).toFixed(2)}`,
            }),
        });
        if (!confirmedPut.ok) {
            console.error(`${chLog} Payment marker write failed:`, quoteID, confirmedPut.status);
            return res.status(503).send('Payment record write failed — retry');
        }
        console.log(`${chLog} ✓ Payment confirmed for:`, quoteID);

        // Order_Payments ledger mirror (fail-soft, idempotent on session id) — feeds
        // the staff dashboard's Money Collected widget (2026-07-06)
        recordOrderPayment({
            quoteID,
            type: 'samples-order',
            amount: Math.round(session.amount_total) / 100,
            stripeSessionId: session.id,
            paymentIntent: session.payment_intent || '',
            payerEmail:
                (session.customer_details && session.customer_details.email) ||
                session.customer_email ||
                '',
            customerName: row.CustomerName || '',
            companyName: row.CompanyName || '',
        });

        let customerData = {},
            orderTotals = {},
            orderSettings = {};
        try {
            customerData = JSON.parse(row.CustomerDataJSON || '{}');
            orderTotals = JSON.parse(row.OrderTotalsJSON || '{}');
            orderSettings = JSON.parse(row.OrderSettingsJSON || '{}');
        } catch (parseErr) {
            console.error(`${chLog} Blob parse failed for ${quoteID}:`, parseErr.message);
        }
        const samples = Array.isArray(orderSettings.samples) ? orderSettings.samples : [];

        try {
            if (!samples.length)
                throw new Error('No samples in OrderSettingsJSON — cannot build the push');
            const payload = buildSamplesPushPayload({
                quoteID,
                customerData,
                samples,
                totals: {
                    paidSubtotal: orderTotals.subtotal,
                    salesTax: orderTotals.salesTax,
                    taxRate: orderTotals.taxRate,
                    grandTotal: orderTotals.grandTotal,
                    taxAccount: orderTotals.taxAccount,
                    taxAccountName: orderTotals.taxAccountName,
                },
                stripeSessionId: session.id,
                paymentAmount: session.amount_total,
                serviceBanner: chCfg.push.serviceBanner(false),
                // Pacific day for both ShopWorks dates — the UTC-day defaults stamp
                // evening orders (after ~5pm PT) with tomorrow's date. (2026-09-01)
                orderDate: nowPacificNaiveIso().split('T')[0],
                paymentDate: nowPacificNaiveIso().split('T')[0],
            });
            const pushResp = await fetch(`${CASPIO_PROXY_BASE}/api/manageorders/orders/create`, {
                method: 'POST',
                // Secret required since proxy v2026.08.05.9 gated this route.
                headers: { 'Content-Type': 'application/json', 'X-CRM-API-Secret': CRM_API_SECRET },
                body: JSON.stringify(payload),
            });
            const pushResult = await pushResp.json().catch(() => ({}));
            if (!pushResp.ok || pushResult.success === false) {
                throw new Error(
                    `ManageOrders push failed (${pushResp.status}): ${pushResult.error || pushResult.message || 'unknown'}`
                );
            }
            const extOrderId = pushResult.extOrderId || pushResult.orderNumber || quoteID;
            try {
                const processedPut = await fetch(`${TDT_PROXY}/api/quote_sessions/${row.PK_ID}`, {
                    method: 'PUT',
                    headers: withProxySecret({ 'Content-Type': 'application/json' }),
                    body: JSON.stringify({
                        Status: 'Processed',
                        Notes: `${row.Notes}\nShopWorks Order: ${extOrderId}\nProcessed: ${new Date().toISOString()}`,
                    }),
                });
                if (!processedPut.ok) throw new Error(`HTTP ${processedPut.status}`);
            } catch (recordError) {
                alert3DT(
                    `${quoteID} pushed to ShopWorks OK but the Caspio status update to Processed failed (${recordError.message}) — fix the row manually; do not re-push the order.`
                );
            }
            // Sales alert — the SAME proven Sample-Order-API template the free flow
            // sends (registry emails.confirmationSalesTemplate). Customer gets the
            // Stripe receipt + the success-page confirmation (free-flow parity).
            sendEmailJSTemplate(chCfg.emails.confirmationSalesTemplate, {
                to_email: 'erik@nwcustomapparel.com',
                to_name: 'Erik',
                subject: `PAID Sample Order ${extOrderId} - ${customerData.company || customerData.lastName || ''}`,
                order_number: extOrderId,
                company: customerData.company || customerData.lastName || '',
                message: `Paid sample order ($${(session.amount_total / 100).toFixed(2)} via Stripe, session ${session.id}) pushed to ShopWorks. View details in OnSite.`,
                order_date: new Date().toLocaleDateString(),
            }).then(
                () => console.log(`${chLog} ✓ Sales alert email sent for`, quoteID),
                (e) =>
                    console.error(`${chLog} Sales alert email failed for`, quoteID, ':', e.message)
            );
            alert3DT(
                `✅ SAMPLES ${quoteID}: $${(session.amount_total / 100).toFixed(2)} PAID (${samples.filter((s) => s.type === 'paid').length} paid + ${samples.filter((s) => s.type !== 'paid').length} free) → ShopWorks ${extOrderId}.`
            );
            console.log(`${chLog} ✓ Pushed to ShopWorks:`, extOrderId);
            return res.json({ received: true, status: 'samples-order-processed' });
        } catch (pushErr) {
            console.error(`${chLog} ShopWorks push failed for ${quoteID}:`, pushErr.message);
            alert3DT(
                `PAID SAMPLE ORDER NEEDS MANUAL PUSH — ${quoteID} ($${(session.amount_total / 100).toFixed(2)}, ${session.customer_email || customerData.email || 'no email'}) failed the ShopWorks push: ${pushErr.message}. Status set to 'Payment Confirmed - ShopWorks Failed'.`
            );
            try {
                await fetch(`${TDT_PROXY}/api/quote_sessions/${row.PK_ID}`, {
                    method: 'PUT',
                    headers: withProxySecret({ 'Content-Type': 'application/json' }),
                    body: JSON.stringify({ Status: 'Payment Confirmed - ShopWorks Failed' }),
                });
            } catch (statusErr) {
                console.error(
                    `${chLog} Could not flag ${quoteID} as ShopWorks Failed:`,
                    statusErr.message
                );
            }
            // Payment is recorded and a human is alerted — ack the webhook (a retry
            // would find the terminal status and no-op).
            return res.json({ received: true, status: 'samples-order-push-failed' });
        }
    }

    return { handleSamplesOrderPaid };
};
