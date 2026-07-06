// samples-order-payload.js — ManageOrders push payload for PAID sample orders
// (samples channel, 2026-07-06). Pure logic, no I/O — jest-locked.
//
// Mirrors the payload shape the FREE sample flow has always sent
// (shared_components/js/sample-order-service.js → POST
// /api/manageorders/orders/create: base part number + plain size per line,
// CATALOG_COLOR in `color`, tax via root taxTotal/taxPartNumber), plus the
// Stripe payment block the 3DT/CTS storefront push records — so the order
// lands in ShopWorks ALREADY PAID. Customer #2791 / web order type come from
// the proxy defaults (idOrderType deliberately omitted, like the tee channels).
//
// Consumed by server.js's webhook handler (metadata.kind === 'samples-order').
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.SamplesOrderPayload = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function r2(v) {
    return Math.round((Number(v) + Number.EPSILON) * 100) / 100;
  }

  /**
   * @param {Object} o
   *   quoteID          SAM{MMDD}-{rand4}
   *   customerData     the sample-cart form fields (firstName/lastName/email/
   *                    phone/company/salesRep, billing_* and shipping_* blocks,
   *                    shippingMethod, notes)
   *   samples          SERVER-priced samples: [{ style, name, color,
   *                    catalogColor, size, price, type:'free'|'paid' }]
   *   totals           { paidSubtotal, salesTax, taxRate, grandTotal,
   *                     taxAccount?, taxAccountName? }
   *   stripeSessionId  paid Stripe checkout session id
   *   paymentAmount    session.amount_total in CENTS
   *   serviceBanner    first line of the order note (channel registry)
   * @returns ManageOrders payload for POST /api/manageorders/orders/create
   */
  function buildSamplesPushPayload(o) {
    var quoteID = o.quoteID;
    var c = o.customerData || {};
    var samples = Array.isArray(o.samples) ? o.samples : [];
    var totals = o.totals || {};
    var paidCount = samples.filter(function (s) { return s.type === 'paid'; }).length;
    var freeCount = samples.length - paidCount;

    // One line per sample (qty 1, one size each — the drawer add contract).
    // Base part number + plain size: ShopWorks' Size Translation Table owns
    // the suffixing, exactly like the free flow.
    var lineItems = samples.map(function (s) {
      var price = r2(s.type === 'paid' ? s.price : 0);
      return {
        partNumber: s.style,
        description: s.name || s.style,
        color: s.catalogColor || s.color || '',   // CATALOG_COLOR — inventory/PO key
        size: s.size || '',
        quantity: 1,
        price: price,
        notes: s.type === 'paid'
          ? 'PAID SAMPLE - PAID ONLINE $' + price.toFixed(2)
          : 'FREE SAMPLE'
      };
    });

    // Tax labeling — rate comes from the order's DOR destination lookup
    // (same conversion as the storefront push; never assume Milton).
    var taxRateNum = Number(totals.taxRate);
    var taxPct = (Number.isFinite(taxRateNum) && taxRateNum > 0)
      ? String(Math.round(taxRateNum * 10000) / 100) : null;
    var taxPartNumber = taxPct ? 'Tax_' + taxPct : 'Tax_0';
    var taxPartDescription = taxPct
      ? (totals.taxAccountName || 'WA Sales Tax') + ' ' + taxPct + '%' +
        (totals.taxAccount ? ' (acct ' + totals.taxAccount + ')' : '')
      : 'No sales tax (out of state)';

    var paidAmount = r2(o.paymentAmount != null ? o.paymentAmount / 100 : totals.grandTotal || 0);
    var fullName = ((c.firstName || '').trim() + ' ' + (c.lastName || '').trim()).trim();

    return {
      orderNumber: quoteID,
      customerPurchaseOrder: quoteID,
      salesRep: c.salesRep || 'House',
      terms: 'Prepaid',
      customer: {
        company: c.company || '',
        firstName: c.firstName || '',
        lastName: c.lastName || '',
        email: c.email || '',
        phone: c.phone || ''
      },
      billing: {
        company: c.company || fullName,
        address1: c.billing_address1 || '',
        address2: c.billing_address2 || '',
        city: c.billing_city || '',
        state: c.billing_state || '',
        zip: c.billing_zip || '',
        country: 'USA'
      },
      shipping: {
        company: c.company || fullName,
        firstName: c.firstName || '',
        lastName: c.lastName || '',
        address1: c.shipping_address1 || '',
        address2: c.shipping_address2 || '',
        city: c.shipping_city || '',
        state: c.shipping_state || '',
        zip: c.shipping_zip || '',
        country: 'USA',
        method: c.shippingMethod || 'UPS Ground'
      },
      lineItems: lineItems,
      notes: [
        (c.notes && String(c.notes).trim())
          ? { type: 'Notes On Order', text: 'Note From Customer:\n' + String(c.notes).trim() }
          : null,
        {
          type: 'Notes On Order',
          text: (o.serviceBanner || 'BLANK SAMPLE ORDER - ships blank, no decoration.') + '\n' +
            'PAID ' + paidCount + ' + FREE ' + freeCount +
            ' - $' + r2(totals.paidSubtotal || 0).toFixed(2) +
            ' + $' + r2(totals.salesTax || 0).toFixed(2) + ' tax = $' + paidAmount.toFixed(2) + '\n' +
            'Sample cost is credited toward the customer\'s first decorated order.\n' +
            '\nPayment Information:\n' +
            'Stripe Session: ' + (o.stripeSessionId || 'N/A') + '\n' +
            'Payment Amount: $' + paidAmount.toFixed(2) + '\n' +
            'Payment Status: succeeded\n' +
            '\nTAX: ' + (taxPct ? 'APPLY ' + taxPartDescription : 'DO NOT APPLY - out-of-state shipment')
        }
      ].filter(Boolean),
      taxTotal: r2(totals.salesTax || 0),
      taxPartNumber: taxPartNumber,
      taxPartDescription: taxPartDescription,
      cur_Shipping: 0,   // samples always ship free (Erik decision 2026-07-06)
      totals: {
        subtotal: r2(totals.paidSubtotal || 0),
        rushFee: 0,
        salesTax: r2(totals.salesTax || 0),
        shipping: 0,
        grandTotal: r2(totals.grandTotal || 0)
      },
      payments: [{
        date: (o.paymentDate || new Date().toISOString().split('T')[0]),
        amount: paidAmount,
        status: 'success',
        gateway: 'Stripe',
        authCode: o.stripeSessionId || '',
        accountNumber: String(o.stripeSessionId || ''),
        cardCompany: 'Stripe Checkout',
        responseCode: 'approved',
        responseReasonCode: 'checkout_complete',
        responseReasonText: 'Payment completed via Stripe Checkout'
      }]
    };
  }

  return { buildSamplesPushPayload: buildSamplesPushPayload, r2: r2 };
}));
