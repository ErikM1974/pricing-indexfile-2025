// Payment quote-emails: explicit shared application dependencies.
module.exports = function create(ctx) {
    const { parseNotesJson, quoteShareUrl, sendEmailJSTemplate } = ctx;

    // Quote-acceptance emails (customer receipt + rep alert). Fully fail-soft — missing
    // env keys or not-yet-created EmailJS templates → warn + skip, NEVER throws, so it is
    // safe to ship before the templates exist. Templates (Erik creates on emailjs.com):
    //   template_quote_accepted_customer — params: to_name, to_email, quote_id, quote_amount
    //   quote_accepted_staff             — params: quote_id, customer_name, customer_email,
    //                                                company_name, quote_amount, quote_url, to_email
    //   NOTE: EmailJS caps Template IDs at 24 chars, so the staff ID is short —
    //   "template_quote_accepted_staff" (29) gets silently truncated in their editor.
    const QUOTE_ACCEPTED_CUSTOMER_TEMPLATE = 'template_quote_accepted_customer';

    const QUOTE_ACCEPTED_STAFF_TEMPLATE = 'quote_accepted_staff';

    async function sendQuoteAcceptedEmails(session, acceptName, acceptEmail) {
        if (!process.env.EMAILJS_PUBLIC_KEY || !process.env.EMAILJS_PRIVATE_KEY) {
            console.warn('[QuoteAccept] EMAILJS keys not set — skipping acceptance emails.');
            return;
        }
        const quoteId = session.QuoteID;
        const amount = Number(session.TotalAmount || 0).toFixed(2);
        const companyName = session.CompanyName || '';
        const repEmail =
            session.SalesRepEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(session.SalesRepEmail)
                ? session.SalesRepEmail
                : 'sales@nwcustomapparel.com';
        const quoteUrl = quoteShareUrl(quoteId, session);
        // Customer receipt → the person who just accepted.
        sendEmailJSTemplate(QUOTE_ACCEPTED_CUSTOMER_TEMPLATE, {
            to_email: acceptEmail,
            to_name: acceptName,
            quote_id: quoteId,
            quote_amount: amount,
        }).then(
            () => console.log('[QuoteAccept] ✓ customer receipt sent for', quoteId),
            (e) =>
                console.error('[QuoteAccept] customer receipt failed for', quoteId, ':', e.message)
        );
        // Rep alert → the quote's sales rep (fallback to the sales inbox).
        sendEmailJSTemplate(QUOTE_ACCEPTED_STAFF_TEMPLATE, {
            to_email: repEmail,
            to_name: session.SalesRepName || 'NWCA Sales',
            quote_id: quoteId,
            customer_name: session.CustomerName || acceptName,
            customer_email: session.CustomerEmail || acceptEmail,
            company_name: companyName,
            quote_amount: amount,
            quote_url: quoteUrl,
        }).then(
            () => console.log('[QuoteAccept] ✓ rep alert sent for', quoteId),
            (e) => console.error('[QuoteAccept] rep alert failed for', quoteId, ':', e.message)
        );
    }

    // Deposit receipts — fail-soft like the acceptance emails above; safe to ship
    // before the templates exist. Erik creates on emailjs.com (IDs ≤ 24 chars):
    //   template_deposit_cust  — to_name, to_email, quote_id, amount_paid, balance_due, grand_total
    //   template_deposit_staff — to_email, to_name, quote_id, customer_name, customer_email,
    //                            company_name, amount_paid, balance_due, quote_url
    const DEPOSIT_CUSTOMER_TEMPLATE = 'template_deposit_cust';

    const DEPOSIT_STAFF_TEMPLATE = 'template_deposit_staff';

    // Deposit/balance receipts (customer + rep). Fully fail-soft, fire-and-forget.
    function sendQuotePaymentEmails(row, payment) {
        if (!process.env.EMAILJS_PUBLIC_KEY || !process.env.EMAILJS_PRIVATE_KEY) {
            console.warn('[QuoteDeposit] EMAILJS keys not set — skipping payment receipts.');
            return;
        }
        const quoteId = row.QuoteID;
        const dep = parseNotesJson(row.Notes).deposit || {};
        const paid = Number(payment.amount || 0).toFixed(2);
        const balance =
            payment.kind === 'balance'
                ? '0.00'
                : Number(dep.balanceAmount != null ? dep.balanceAmount : 0).toFixed(2);
        const grand = Number(dep.grandTotal != null ? dep.grandTotal : 0).toFixed(2);
        const custEmail = payment.payerEmail || row.CustomerEmail || '';
        const repEmail =
            row.SalesRepEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.SalesRepEmail)
                ? row.SalesRepEmail
                : 'sales@nwcustomapparel.com';
        const quoteUrl = quoteShareUrl(quoteId, row);
        if (custEmail) {
            sendEmailJSTemplate(DEPOSIT_CUSTOMER_TEMPLATE, {
                to_email: custEmail,
                to_name: row.CustomerName || 'there',
                quote_id: quoteId,
                amount_paid: paid,
                balance_due: balance,
                grand_total: grand,
            }).then(
                () => console.log('[QuoteDeposit] ✓ customer receipt sent for', quoteId),
                (e) =>
                    console.error(
                        '[QuoteDeposit] customer receipt failed for',
                        quoteId,
                        ':',
                        e.message
                    )
            );
        }
        sendEmailJSTemplate(DEPOSIT_STAFF_TEMPLATE, {
            to_email: repEmail,
            to_name: row.SalesRepName || 'NWCA Sales',
            quote_id: quoteId,
            customer_name: row.CustomerName || '',
            customer_email: row.CustomerEmail || custEmail,
            company_name: row.CompanyName || '',
            // grand_total included because the live template (created 2026-07-05 via
            // dashboard clone) shares the receipt body with the customer template.
            amount_paid: paid,
            balance_due: balance,
            grand_total: grand,
            quote_url: quoteUrl,
        }).then(
            () => console.log('[QuoteDeposit] ✓ rep alert sent for', quoteId),
            (e) => console.error('[QuoteDeposit] rep alert failed for', quoteId, ':', e.message)
        );
    }

    return { sendQuoteAcceptedEmails, sendQuotePaymentEmails };
};
