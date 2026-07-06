/**
 * sample-pricing.test.js — locks the blank-sample pricing formula
 * (samples channel, 2026-07-06).
 *
 * The SAME module prices the browser buttons/cart AND the server's
 * /api/samples/create-checkout-session authoritative reprice — these tests
 * are the drift guard. Formula (Erik, from the retired showcase):
 *   blank min cost < $10 → FREE; else halfDollarCeil(cost / BLANK margin)
 *   + size upcharge. Missing margin → NOT eligible (never a guessed price).
 */
const SP = require('../../shared_components/js/sample-pricing.js');

const rows = (basePrices, extra = []) => [{ color: 'Jet Black', basePrices }, ...extra];
const bundle = (margin, addOns = {}) => ({
  tiersR: [{ MinQuantity: 1, MaxQuantity: 23, MarginDenominator: margin }],
  sellingPriceDisplayAddOns: addOns,
});

describe('SamplePricing.priceSample', () => {
  test('blank under $10 → FREE (classic tee)', () => {
    const r = SP.priceSample({ sizePricingRows: rows({ S: 3.41, M: 3.41, '2XL': 5.2 }) });
    expect(r).toMatchObject({ eligible: true, type: 'free', price: 0, base: 0, upcharge: 0 });
    expect(r.sizes).toEqual(['S', 'M', '2XL']);
  });

  test('boundary: exactly $10 is PAID, $9.99 is FREE', () => {
    const paid = SP.priceSample({ sizePricingRows: rows({ M: 10 }), blankBundle: bundle(0.5) });
    expect(paid.type).toBe('paid');
    const free = SP.priceSample({ sizePricingRows: rows({ M: 9.99 }) });
    expect(free.type).toBe('free');
  });

  test('paid = halfDollarCeil(minCost / margin) — Carhartt-style jacket', () => {
    // 84.53 / 0.53 = 159.49… → ceil to half dollar = 159.50 (live-verified label)
    const r = SP.priceSample({ sizePricingRows: rows({ M: 84.53, '2XL': 90 }), blankBundle: bundle(0.53) });
    expect(r).toMatchObject({ eligible: true, type: 'paid', base: 159.5, price: 159.5 });
  });

  test('paid price uses the LOWEST size cost, not the largest', () => {
    const r = SP.priceSample({ sizePricingRows: rows({ S: 12, '3XL': 20 }), blankBundle: bundle(0.5) });
    expect(r.base).toBe(24); // 12/0.5, not 20/0.5
  });

  test('size upcharge lands in price (paid only)', () => {
    const b = bundle(0.5, { '2XL': 2, '3XL': 3 });
    const r = SP.priceSample({ sizePricingRows: rows({ M: 12, '2XL': 12 }), blankBundle: b, size: '2XL' });
    expect(r.base).toBe(24);
    expect(r.upcharge).toBe(2);
    expect(r.price).toBe(26);
    // free styles never gain an upcharge
    const f = SP.priceSample({ sizePricingRows: rows({ M: 4, '2XL': 4 }), blankBundle: b, size: '2XL' });
    expect(f.price).toBe(0);
  });

  test('unknown size → bad_size (a crafted size key must not price $0/base)', () => {
    const r = SP.priceSample({ sizePricingRows: rows({ M: 12 }), blankBundle: bundle(0.5), size: 'XXXL' });
    expect(r).toEqual({ eligible: false, reason: 'bad_size' });
  });

  test('missing/invalid margin → no_margin, NEVER a guessed price', () => {
    for (const bad of [null, {}, bundle(0), bundle(1.2), bundle('nope')]) {
      const r = SP.priceSample({ sizePricingRows: rows({ M: 15 }), blankBundle: bad });
      expect(r).toEqual({ eligible: false, reason: 'no_margin' });
    }
  });

  test('not in SanMar / no pricing rows → ineligible', () => {
    expect(SP.priceSample({ sizePricingRows: [] }).reason).toBe('not_sanmar');
    expect(SP.priceSample({ sizePricingRows: null }).reason).toBe('not_sanmar');
    expect(SP.priceSample({ sizePricingRows: rows({}) }).reason).toBe('no_pricing');
    expect(SP.priceSample({ sizePricingRows: rows({ M: 0, L: -2 }) }).reason).toBe('no_pricing');
  });

  test('sizes union across rows, size-order sorted', () => {
    const r = SP.priceSample({
      sizePricingRows: rows({ M: 3, S: 3 }, [{ color: 'Red', basePrices: { '4XL': 6, L: 3 } }]),
    });
    expect(r.sizes).toEqual(['S', 'M', 'L', '4XL']);
  });

  test('half-dollar ceiling behavior', () => {
    expect(SP.halfDollarCeil(23.01)).toBe(23.5);
    expect(SP.halfDollarCeil(23.5)).toBe(23.5);
    expect(SP.halfDollarCeil(23.51)).toBe(24);
  });
});
