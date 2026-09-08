// Paid storefront submission stage; contracts cover Stripe gates and the resulting order.
const { buildStorefrontLines } = require('./lines');
const { buildStorefrontArtwork } = require('./artwork');
const { buildStorefrontNotes } = require('./notes');

function buildStorefrontPayload(
    {
        tempOrderNumber,
        customerData,
        colorConfigs,
        orderTotals,
        pricingData,
        orderSettings,
        paymentConfirmed,
        stripeSessionId,
        paymentAmount,
    },
    { channelConfig, nowPacificNaiveIso }
) {
    // Channel registry: push constants + banners come from the entry for
    // orderSettings.channel (absent/unknown → legacy 3DT defaults).
    const pushCfg = channelConfig(orderSettings && orderSettings.channel);
    const pushC = pushCfg.push;
    const lineItems = buildStorefrontLines(
        { colorConfigs, orderSettings, pricingData, orderTotals },
        pushCfg
    );
    const art = buildStorefrontArtwork({ colorConfigs, orderSettings, tempOrderNumber }, pushCfg);
    const { designs, attachments } = art;
    const { placementBlock, artReviewBanner, rightsLine, stockLine, shipPromiseLine } =
        buildStorefrontNotes(orderSettings, pushCfg, art);
    // Tax labeling — rate comes from the order (DOR destination lookup),
    // never assume Milton 10.2 (legacy bug mislabeled out-of-town orders).
    const taxRateNum = Number(orderTotals?.taxRate);
    const taxPct =
        Number.isFinite(taxRateNum) && taxRateNum > 0
            ? String(Math.round(taxRateNum * 10000) / 100)
            : null;
    const taxPartNumber = pushC.taxPartNumber(taxPct);
    const taxPartDescription = taxPct
        ? `${orderTotals?.taxAccountName || 'WA Sales Tax'} ${taxPct}%${orderTotals?.taxAccount ? ` (acct ${orderTotals.taxAccount})` : ''}`
        : 'No sales tax (out of state)';

    // Transform to ManageOrders API format
    const manageOrdersPayload = {
        orderNumber: tempOrderNumber,
        customerPurchaseOrder: tempOrderNumber, // Set PO Number to Order ID
        customer: {
            company: customerData.company || '', // Maps to CompanyName in proxy
            firstName: customerData.firstName || '',
            lastName: customerData.lastName || '',
            email: customerData.email || '',
            phone: customerData.phone || '',
        },
        lineItems: lineItems,
        designs: designs, // Artwork URLs for production
        attachments: attachments, // File attachments for OnSite download
        shipping: {
            company: customerData.company || '',
            firstName: customerData.firstName || '',
            lastName: customerData.lastName || '',
            address1: customerData.address1 || customerData.address || '',
            address2: customerData.address2 || '',
            city: customerData.city || '',
            state: customerData.state || '',
            zip: customerData.zip || customerData.zipCode || '',
            country: 'USA',
            method: customerData.deliveryMethod === 'pickup' ? 'Customer Pickup' : 'UPS Ground',
        },
        // Billing block - proxy reads from orderData.billing (not Customer)
        billing: {
            company: customerData.billingCompany || customerData.company || '',
            address1: customerData.billingAddress1 || customerData.address1 || '',
            address2: '',
            city: customerData.billingCity || customerData.city || '',
            state: customerData.billingState || customerData.state || '',
            zip: customerData.billingZip || customerData.zip || '',
            country: 'USA',
        },
        // Additional notes - send as array for proxy to process.
        // Service banner is channel/rush-aware (2026-06-10, registry): legacy
        // 3DT is always rush; Custom-Tees standard orders are 7-10 business
        // days — a hardcoded RUSH banner here would make production rush them.
        notes: [
            {
                type: 'Notes On Order',
                note: `${pushC.serviceBanner(!!orderSettings?.rush)}
${customerData.deliveryMethod === 'pickup' ? '\n*** CUSTOMER PICKUP - Milton, WA ***\n' : ''}${artReviewBanner}${stockLine}${rightsLine}${shipPromiseLine}${placementBlock}
Customer: ${customerData.firstName} ${customerData.lastName}
Email: ${customerData.email}
Phone: ${customerData.phone}
Company: ${customerData.company || 'N/A'}
Delivery: ${customerData.deliveryMethod === 'pickup' ? 'Customer Pickup - NW Custom Apparel, Milton, WA 98354' : 'Ship to: ' + (customerData.address1 || '') + ', ' + (customerData.city || '') + ', ' + (customerData.state || '') + ' ' + (customerData.zip || '')}
Bill To: ${customerData.billingAddress1 || customerData.address1 || ''}, ${customerData.billingCity || customerData.city || ''}, ${customerData.billingState || customerData.state || ''} ${customerData.billingZip || customerData.zip || ''}
Special Instructions: ${customerData.notes || 'None'}

Payment Information:
Stripe Session: ${stripeSessionId || 'N/A'}
Payment Amount: $${paymentAmount ? (paymentAmount / 100).toFixed(2) : orderTotals?.grandTotal || 0}
Payment Status: ${paymentConfirmed ? 'succeeded' : 'pending'}

Total: $${orderTotals?.grandTotal || 0}${taxPct ? ` (includes ${taxPct}% sales tax${customerData.deliveryMethod === 'pickup' ? ', Milton pickup' : ''})` : ' (no sales tax - out of state)'}
TAX: ${taxPct ? `APPLY ${taxPartDescription}` : 'DO NOT APPLY - out-of-state shipment'}`,
            },
        ],
        // OnSite ORDER type → production queue + GL account. Channel-set: caps
        // send 21 (Custom Embroidery / acct 4050). When a channel omits it (the
        // DTG tee channels), the field is ABSENT and the proxy's push-client
        // defaults to 6 (Online Store / acct 4003) — byte-identical to the
        // pre-2026-06-12 storefront payload, so this is a caps-only change. The
        // proxy reads root-level `idOrderType` (same as the Order Form push).
        ...(pushC.idOrderType ? { idOrderType: pushC.idOrderType } : {}),
        // Order date = the PACIFIC day. Left absent, the proxy defaults to the
        // UTC day, which stamps evening orders (after ~5pm PT) with TOMORROW's
        // date in ShopWorks — DTG0831-2727 paid Sun 8/30 7:38pm PT showed
        // date_OrderPlaced 08/31. (2026-09-01)
        orderDate: nowPacificNaiveIso().split('T')[0],
        // Binding promised ship date (stamped at checkout, shipPromise.iso) →
        // ShopWorks date_OrderRequestedToShip, so production sees a real date
        // field instead of only the PROMISED SHIP DATE note line. (2026-09-01)
        ...(orderSettings?.shipPromise?.iso
            ? { requestedShipDate: orderSettings.shipPromise.iso }
            : {}),
        // Channel-aware (registry): Custom-Tees standard orders are NOT rush
        // (legacy 3DT always is)
        rushOrder: pushC.rushOrderFlag(orderSettings),
        printLocation: orderSettings?.printLocationName || 'Left Chest',
        // Tax fields - proxy expects at root level (not nested in totals).
        // 3DT pushes REAL tax (unlike Order Form's TaxTotal=0) — rate + account
        // come from the order's DOR destination lookup, not a Milton constant.
        taxTotal: orderTotals?.salesTax || 0,
        taxPartNumber: taxPartNumber,
        taxPartDescription: taxPartDescription,
        // Shipping - proxy expects at root level
        cur_Shipping: orderTotals?.shipping || 0,
        totals: {
            subtotal: orderTotals?.subtotal || 0,
            rushFee: orderTotals?.rushFee || 0,
            salesTax: orderTotals?.salesTax || 0,
            shipping: orderTotals?.shipping || 0,
            grandTotal: orderTotals?.grandTotal || 0,
        },
        // Payment information from Stripe
        payments: paymentConfirmed
            ? [
                  {
                      // PACIFIC day (YYYY-MM-DD) — UTC day dated evening payments +1 in
                      // ShopWorks (same off-by-one as orderDate above). (2026-09-01)
                      date: nowPacificNaiveIso().split('T')[0],
                      amount: parseFloat(
                          (paymentAmount
                              ? paymentAmount / 100
                              : orderTotals?.grandTotal || 0
                          ).toFixed(2)
                      ), // Round to 2 decimals
                      status: 'success',
                      gateway: 'Stripe',
                      authCode: stripeSessionId || '',
                      accountNumber: String(stripeSessionId || ''), // Ensure string type for full session ID
                      cardCompany: 'Stripe Checkout',
                      responseCode: 'approved',
                      responseReasonCode: 'checkout_complete',
                      responseReasonText: 'Payment completed via Stripe Checkout',
                  },
              ]
            : [],
    };
    return manageOrdersPayload;
}
module.exports = { buildStorefrontPayload };
