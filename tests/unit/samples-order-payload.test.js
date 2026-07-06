/**
 * samples-order-payload.test.js — locks the ManageOrders push payload for
 * PAID sample orders (samples channel, 2026-07-06).
 *
 * The shape mirrors the FREE flow's proven payload (sample-order-service.js):
 * base part number + plain size per line (ShopWorks suffixes), CATALOG_COLOR
 * in `color`, root taxTotal/taxPartNumber — plus the storefront Stripe
 * payment block so the order lands in ShopWorks ALREADY PAID.
 */
const { buildSamplesPushPayload } = require('../../shared_components/js/samples-order-payload.js');

const base = () => ({
  quoteID: 'SAM0706-1234',
  customerData: {
    firstName: 'Pat', lastName: 'Jones', email: 'pat@acme.com', phone: '253-555-1212',
    company: 'Acme Co', salesRep: 'House', notes: 'Deciding on jackets for the crew',
    billing_address1: '1 Main St', billing_city: 'Tacoma', billing_state: 'WA', billing_zip: '98402',
    shipping_address1: '2 Dock Rd', shipping_city: 'Milton', shipping_state: 'WA', shipping_zip: '98354',
    shippingMethod: 'UPS Ground',
  },
  samples: [
    { style: 'CT103828', name: 'Carhartt Duck Detroit Jacket', color: 'Carhartt Brown', catalogColor: 'Carhartt Brown', size: 'L', price: 159.5, type: 'paid' },
    { style: 'PC54', name: 'Port & Co Core Cotton Tee', color: 'Jet Black', catalogColor: 'Jet Black', size: 'M', price: 0, type: 'free' },
  ],
  totals: { paidSubtotal: 159.5, salesTax: 16.27, taxRate: 0.102, grandTotal: 175.77, taxAccountName: 'City of Milton Sales Tax', taxAccount: '2200.102' },
  stripeSessionId: 'cs_test_abc123',
  paymentAmount: 17577, // cents
  serviceBanner: 'BLANK SAMPLE ORDER - ships blank, no decoration, no proof. PAID ONLINE via Stripe (see Payment Information below).',
  paymentDate: '2026-07-06',
});

describe('buildSamplesPushPayload', () => {
  test('line items: one per sample, base PN + plain size, CATALOG_COLOR, paid/free notes', () => {
    const p = buildSamplesPushPayload(base());
    expect(p.lineItems).toEqual([
      expect.objectContaining({
        partNumber: 'CT103828', size: 'L', quantity: 1, price: 159.5,
        color: 'Carhartt Brown', notes: 'PAID SAMPLE - PAID ONLINE $159.50',
      }),
      expect.objectContaining({
        partNumber: 'PC54', size: 'M', quantity: 1, price: 0,
        color: 'Jet Black', notes: 'FREE SAMPLE',
      }),
    ]);
  });

  test('payment block records the Stripe charge (order lands PAID, terms Prepaid)', () => {
    const p = buildSamplesPushPayload(base());
    expect(p.terms).toBe('Prepaid');
    expect(p.payments).toEqual([expect.objectContaining({
      amount: 175.77, gateway: 'Stripe', status: 'success',
      authCode: 'cs_test_abc123', date: '2026-07-06',
    })]);
  });

  test('tax fields use the order rate, never an assumed Milton constant', () => {
    const p = buildSamplesPushPayload(base());
    expect(p.taxTotal).toBe(16.27);
    expect(p.taxPartNumber).toBe('Tax_10.2');
    expect(p.taxPartDescription).toBe('City of Milton Sales Tax 10.2% (acct 2200.102)');
    // out-of-state → Tax_0 / no tax
    const oos = buildSamplesPushPayload({ ...base(), totals: { paidSubtotal: 159.5, salesTax: 0, taxRate: 0, grandTotal: 159.5 } });
    expect(oos.taxPartNumber).toBe('Tax_0');
    expect(oos.taxPartDescription).toBe('No sales tax (out of state)');
  });

  test('shipping is always free; no idOrderType (proxy defaults to web/2791 path)', () => {
    const p = buildSamplesPushPayload(base());
    expect(p.cur_Shipping).toBe(0);
    expect(p.totals.shipping).toBe(0);
    expect(p.idOrderType).toBeUndefined();
  });

  test('order note carries banner, paid/free summary, credit line, and payment info', () => {
    const p = buildSamplesPushPayload(base());
    const orderNote = p.notes[p.notes.length - 1].text;
    expect(orderNote).toContain('BLANK SAMPLE ORDER');
    expect(orderNote).toContain('PAID 1 + FREE 1 - $159.50 + $16.27 tax = $175.77');
    expect(orderNote).toContain('credited toward the customer\'s first decorated order');
    expect(orderNote).toContain('Stripe Session: cs_test_abc123');
    expect(orderNote).toContain('TAX: APPLY City of Milton Sales Tax 10.2%');
    // customer note rides first, prefixed
    expect(p.notes[0].text).toBe('Note From Customer:\nDeciding on jackets for the crew');
  });

  test('no customer note → single order note (no empty note rows: one bad note aborts a push)', () => {
    const b = base();
    delete b.customerData.notes;
    const p = buildSamplesPushPayload(b);
    expect(p.notes).toHaveLength(1);
    expect(p.notes[0].type).toBe('Notes On Order');
  });

  test('billing and shipping blocks map the sample-cart form fields', () => {
    const p = buildSamplesPushPayload(base());
    expect(p.billing).toMatchObject({ address1: '1 Main St', city: 'Tacoma', state: 'WA', zip: '98402' });
    expect(p.shipping).toMatchObject({ address1: '2 Dock Rd', city: 'Milton', state: 'WA', zip: '98354', method: 'UPS Ground' });
    expect(p.orderNumber).toBe('SAM0706-1234');
    expect(p.customerPurchaseOrder).toBe('SAM0706-1234');
  });

  test('payment amount falls back to grandTotal when cents amount is absent', () => {
    const b = base();
    delete b.paymentAmount;
    const p = buildSamplesPushPayload(b);
    expect(p.payments[0].amount).toBe(175.77);
  });
});
