// Composes quote links, payment records, notifications and fulfillment helpers.
module.exports = function createPaymentServices(ctx) {
    const {
        CASPIO_PROXY_BASE,
        CRM_API_SECRET,
        INTERNAL_CALL_KEY,
        PORT,
        TDT_PROXY,
        buildSamplesPushPayload,
        buildStorefrontQuoteItems,
        channelConfig,
        crypto,
        fetch,
        nowPacificNaiveIso,
        resolveTdtTax,
        withProxySecret,
    } = ctx;
    const {
        PUBLIC_SITE_ORIGIN,
        buildOrderStatusUrl,
        computeOrderStatusToken,
        mintShareToken,
        parseNotesJson,
        quoteShareUrl,
        shareTokenOk,
    } = require('./quote-links')({ crypto });
    const { QUOTE_TOTALS_HASH_VERSION, computeQuoteTotalsHash, totalsHashMatches } =
        require('./quote-integrity')({ crypto });
    const { sendEmailJSTemplate } = require('./email-transport')({ fetch });
    const { escapeHTMLSrv, sendOrderConfirmationEmails } = require('./order-emails')({
        buildOrderStatusUrl,
        channelConfig,
        sendEmailJSTemplate,
    });
    const { sendQuoteAcceptedEmails, sendQuotePaymentEmails } = require('./quote-emails')({
        parseNotesJson,
        quoteShareUrl,
        sendEmailJSTemplate,
    });
    const { alert3DT, alertQuotePay } = require('./alerts')({ fetch, sendEmailJSTemplate });
    const { QuoteDepositMath, autoEnablePickupDeposit, getDepositPct, recordOrderPayment } =
        require('./deposits')({
            QUOTE_TOTALS_HASH_VERSION,
            TDT_PROXY,
            alertQuotePay,
            computeQuoteTotalsHash,
            fetch,
            resolveTdtTax,
        });
    const { fetchQuoteSessionRow, save3DTQuoteSession } = require('./order-records')({
        CASPIO_PROXY_BASE,
        buildStorefrontQuoteItems,
        channelConfig,
        fetch,
        withProxySecret,
    });
    const { handleSamplesOrderPaid } = require('./samples-fulfillment')({
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
    });
    const handleQuotePayment = require('./quote-payment')({
        TDT_PROXY,
        alertQuotePay,
        fetch,
        fetchQuoteSessionRow,
        handleSamplesOrderPaid,
        parseNotesJson,
        recordOrderPayment,
        sendQuotePaymentEmails,
        withProxySecret,
    });
    const handleStorefrontOrderPaid = require('./storefront-payment')({
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
    });
    return {
        handleQuotePayment,
        handleStorefrontOrderPaid,
        PUBLIC_SITE_ORIGIN,
        QUOTE_TOTALS_HASH_VERSION,
        QuoteDepositMath,
        alert3DT,
        alertQuotePay,
        autoEnablePickupDeposit,
        buildOrderStatusUrl,
        computeOrderStatusToken,
        computeQuoteTotalsHash,
        escapeHTMLSrv,
        fetchQuoteSessionRow,
        getDepositPct,
        handleSamplesOrderPaid,
        mintShareToken,
        parseNotesJson,
        quoteShareUrl,
        recordOrderPayment,
        save3DTQuoteSession,
        sendEmailJSTemplate,
        sendOrderConfirmationEmails,
        sendQuoteAcceptedEmails,
        sendQuotePaymentEmails,
        shareTokenOk,
        totalsHashMatches,
    };
};
