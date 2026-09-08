// Payment order-records: explicit shared application dependencies.
module.exports = function create(ctx) {
    const { CASPIO_PROXY_BASE, buildStorefrontQuoteItems, channelConfig, fetch, withProxySecret } =
        ctx;

    async function fetchQuoteSessionRow(quoteID) {
        const url = `${CASPIO_PROXY_BASE}/api/quote_sessions?quoteID=${encodeURIComponent(quoteID)}&refresh=true`;
        const resp = await fetch(url, { headers: withProxySecret() });
        if (!resp.ok) {
            const err = Object.assign(new Error(`Quote lookup failed: HTTP ${resp.status}`), { httpStatus: resp.status });

            throw err;
        }
        const rows = await resp.json();
        const list = Array.isArray(rows) ? rows : (rows && rows.data) || [];
        return list.find((s) => s.QuoteID === quoteID) || null;
    }

    async function save3DTQuoteSession(data) {
        const { quoteID, customerData, orderTotals, stripeSessionId, colorConfigs, orderSettings } =
            data;

        const expiresAtDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
        const formattedExpiresAt = expiresAtDate.toISOString().replace(/\.\d{3}Z$/, '');

        // Reader contract (2026-06-12, Erik): TotalAmount = PRE-TAX products subtotal,
        // TaxAmount + TaxRate stored separately — so /invoice (trusts TaxAmount) and
        // /quote (recomputes from TaxRate) both foot correctly + show the WA tax line.
        // (Was: TotalAmount = grandTotal tax-inclusive with no TaxAmount → /quote
        // double-taxed to $894.61, /invoice showed $0 tax.) The Stripe charge + the
        // webhook→ShopWorks push read OrderTotalsJSON, NOT these columns — unaffected.
        const subtotal = parseFloat((orderTotals.subtotal || 0).toFixed(2));
        const salesTax = parseFloat((orderTotals.salesTax || 0).toFixed(2));
        const taxRate = Number(orderTotals.taxRate) || 0;

        const sessionData = {
            QuoteID: quoteID,
            SessionID: stripeSessionId ? `stripe_${stripeSessionId}` : `3dt_${Date.now()}`,
            Status: 'Pending Payment',
            CustomerName: `${customerData.firstName} ${customerData.lastName}`,
            CompanyName: customerData.company || '',
            CustomerEmail: customerData.email,
            Phone: customerData.phone || '',
            TotalQuantity: orderTotals.totalQuantity || 0,
            SubtotalAmount: subtotal,
            LTMFeeTotal: parseFloat((orderTotals.ltmFee || 0).toFixed(2)),
            TotalAmount: subtotal,
            TaxAmount: salesTax,
            TaxRate: taxRate,
            ExpiresAt: formattedExpiresAt,
            Notes:
                channelConfig(orderSettings && orderSettings.channel).orderNoteLabel({
                    rush: orderSettings && orderSettings.rush,
                    styleNumber: orderSettings && orderSettings.styleNumber,
                }) + (stripeSessionId ? ` | Stripe Session: ${stripeSessionId}` : ''),

            // Store full order data as JSON (for webhook retrieval)
            // This eliminates Stripe metadata size constraints
            CustomerDataJSON: customerData ? JSON.stringify(customerData) : '{}',
            ColorConfigsJSON: colorConfigs ? JSON.stringify(colorConfigs) : '{}',
            OrderTotalsJSON: orderTotals ? JSON.stringify(orderTotals) : '{}',
            OrderSettingsJSON: orderSettings ? JSON.stringify(orderSettings) : '{}',
        };

        const apiUrl = `${CASPIO_PROXY_BASE}/api/quote_sessions`;
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: withProxySecret({ 'Content-Type': 'application/json' }),
            body: JSON.stringify(sessionData),
        });

        if (!response.ok) {
            throw new Error(`Failed to save quote session: ${response.statusText}`);
        }

        const result = await response.json();
        console.log('[3-Day Tees] Quote session created:', quoteID);

        // Write quote_items rows so /quote + /invoice render line items. Fire-and-
        // forget: a display-row failure must NEVER block the sale (the order data is
        // fully in the JSON blobs and the ShopWorks push reads those). Sync never
        // touches quote_items (verified 2026-06-12), so no duplicate risk.
        try {
            const lineItems = buildStorefrontQuoteItems(
                quoteID,
                colorConfigs,
                orderTotals,
                orderSettings
            );
            const itemsUrl = `${CASPIO_PROXY_BASE}/api/quote_items`;
            const results = await Promise.allSettled(
                lineItems.map((item) =>
                    fetch(itemsUrl, {
                        method: 'POST',
                        headers: withProxySecret({ 'Content-Type': 'application/json' }),
                        body: JSON.stringify(item),
                    }).then((r) => {
                        if (!r.ok) throw new Error(`HTTP ${r.status}`);
                    })
                )
            );
            const failed = results.filter((r) => r.status === 'rejected').length;
            if (failed > 0) {
                console.error(
                    `[Storefront] ${quoteID}: ${failed}/${lineItems.length} quote_items failed to write (order still valid — data is in JSON blobs).`
                );
            } else {
                console.log(
                    `[Storefront] ${quoteID}: wrote ${lineItems.length} quote_items row(s).`
                );
            }
        } catch (itemsErr) {
            console.error(
                `[Storefront] ${quoteID}: quote_items synthesis failed (non-fatal):`,
                itemsErr.message
            );
        }

        return result;
    }

    return { fetchQuoteSessionRow, save3DTQuoteSession };
};
