// quote-payment: invoked only after Stripe signature verification.
module.exports = function create(ctx) {
    const {
        TDT_PROXY,
        alertQuotePay,
        fetch,
        fetchQuoteSessionRow,
        handleSamplesOrderPaid,
        parseNotesJson,
        recordOrderPayment,
        sendQuotePaymentEmails,
        withProxySecret,
    } = ctx;
    return async function handleQuotePayment(session, quoteID, metadata, res) {
        // Paid SAMPLE orders (samples channel, 2026-07-06) — full-order
        // fulfillment (ManageOrders push), NOT a payment against an existing
        // quote, so it branches before the deposit/balance handling.
        if (metadata.kind === 'samples-order') {
            return handleSamplesOrderPaid(session, quoteID, res);
        }
        if (metadata.kind !== 'deposit' && metadata.kind !== 'balance') {
            alertQuotePay(
                `Stripe session ${session.id} has unknown metadata.kind '${metadata.kind}' for ${quoteID} — payment NOT auto-recorded; check the Stripe dashboard.`
            );
            return res.json({ received: true, status: 'unknown-kind' });
        }
        let row;
        try {
            row = await fetchQuoteSessionRow(quoteID);
        } catch (lookupErr) {
            // Failed lookup ≠ no record — 5xx so Stripe retries (same rule as 3DT).
            console.error(
                '[Webhook] Quote-payment lookup failed:',
                lookupErr.message,
                '— asking Stripe to retry'
            );
            return res.status(503).send('Quote lookup unavailable — retry');
        }
        if (!row) {
            alertQuotePay(
                `PAYMENT WITHOUT QUOTE ROW — Stripe session ${session.id} paid $${(session.amount_total / 100).toFixed(2)} as a ${metadata.kind} for ${quoteID}, but no quote_sessions row matches. Recover from the Stripe dashboard.`
            );
            return res.json({ received: true, status: 'no-record' });
        }
        const notes = parseNotesJson(row.Notes);
        const payments = Array.isArray(notes.payments) ? notes.payments : [];
        if (payments.some((p) => p && p.stripeSessionId === session.id)) {
            console.log('[Webhook] Quote payment already recorded, skipping:', quoteID);
            return res.json({ received: true, status: 'duplicate' });
        }
        // DOUBLE-PAYMENT guard (audit fix 2026-07-06): the per-session dedup
        // above only catches Stripe REDELIVERIES of the same session. A DIFFERENT
        // session of the same kind means the customer paid twice (e.g. two open
        // pay tabs, or a shared quote link paid by two people). We still record
        // it — the money is real and must appear in the ledger — but flag it
        // LOUDLY as a refund-needed duplicate instead of a normal success.
        const isDoublePayment = payments.some((p) => p && p.kind === metadata.kind);
        // The paid session was bound to a totals-hash at creation. A rep edit
        // between link-send and payment surfaces here — the money is already
        // taken, so record it and alert loudly instead of failing.
        if (
            notes.deposit &&
            metadata.totalsHash &&
            notes.deposit.totalsHash !== metadata.totalsHash
        ) {
            alertQuotePay(
                `${quoteID}: ${metadata.kind} of $${(session.amount_total / 100).toFixed(2)} was paid against a STALE totals-hash (quote edited after the pay link went out). Verify amounts with the customer.`
            );
        }
        const payment = {
            kind: metadata.kind,
            amount: Math.round(session.amount_total) / 100,
            stripeSessionId: session.id,
            paymentIntent: session.payment_intent || '',
            payerEmail:
                (session.customer_details && session.customer_details.email) ||
                session.customer_email ||
                '',
            at: new Date().toISOString(),
        };
        payments.push(payment);
        notes.payments = payments;
        if (notes.deposit) {
            if (payment.kind === 'deposit') notes.deposit.paidAt = payment.at;
            if (payment.kind === 'balance') notes.deposit.balancePaidAt = payment.at;
        }
        const notesPut = await fetch(`${TDT_PROXY}/api/quote_sessions/${row.PK_ID}`, {
            method: 'PUT',
            headers: withProxySecret({ 'Content-Type': 'application/json' }),
            body: JSON.stringify({ Notes: JSON.stringify(notes) }),
        });
        if (!notesPut.ok) {
            // Money is in Stripe but our record write failed — 5xx so Stripe
            // redelivers (the sessionId dedup above makes the retry safe).
            alertQuotePay(
                `${quoteID}: ${payment.kind} paid (session ${session.id}) but the quote_sessions Notes write failed (HTTP ${notesPut.status}) — Stripe will retry.`
            );
            return res.status(503).send('Record write failed — retry');
        }
        // Ledger mirror + receipts + rep ping — all fail-soft (Notes is the record).
        recordOrderPayment({
            quoteID,
            type: payment.kind,
            amount: payment.amount,
            stripeSessionId: session.id,
            paymentIntent: payment.paymentIntent,
            payerEmail: payment.payerEmail,
            customerName: row.CustomerName || '',
            companyName: row.CompanyName || '',
        });
        try {
            sendQuotePaymentEmails(row, payment);
        } catch (e) {
            console.error('[QuoteDeposit] receipt dispatch error:', e.message);
        }
        if (isDoublePayment) {
            alertQuotePay(
                `🚨 DUPLICATE PAYMENT — REFUND NEEDED: ${quoteID} received a SECOND '${payment.kind}' of $${payment.amount.toFixed(2)} (session ${session.id}) on top of an earlier one. The customer was charged twice — issue a refund in Stripe.`
            );
        } else {
            const balDue =
                payment.kind === 'balance'
                    ? 0
                    : Number((notes.deposit && notes.deposit.balanceAmount) || 0);
            alertQuotePay(
                `✅ ${quoteID}: ${payment.kind} of $${payment.amount.toFixed(2)} PAID by ${payment.payerEmail || row.CustomerEmail || 'unknown'}${row.CompanyName ? ' (' + row.CompanyName + ')' : ''}. Balance due: $${balDue.toFixed(2)}.`
            );
        }
        console.log(
            '[Webhook] ✓ Quote payment recorded:',
            quoteID,
            payment.kind,
            payment.amount,
            isDoublePayment ? '(DUPLICATE)' : ''
        );
        return res.json({
            received: true,
            status: isDoublePayment ? 'quote-payment-duplicate-recorded' : 'quote-payment-recorded',
        });
    };
};
