// sample-pricing.js — blank-sample pricing math (samples channel, 2026-07-06)
//
// ONE formula, dual-loaded: the browser (sample-cart-service.js buttons/cart)
// and server.js's /api/samples/create-checkout-session authoritative reprice
// both call THIS module, so the customer's screen and the Stripe charge can
// never disagree (same dual-load pattern as custom-tees/custom-caps pricing).
//
// Rule (Erik, unchanged from the retired showcase):
//   blank min cost < $10        → FREE sample
//   otherwise                   → cost ÷ Caspio BLANK MarginDenominator,
//                                 rounded UP to the half dollar (= regular
//                                 blank retail) + the size's upcharge
// Margin missing/invalid → NOT eligible (visible absence, never a guess).
//
// Inputs are RAW API responses (no fetching here — pure logic, jest-locked):
//   sizePricingRows — GET /api/size-pricing?styleNumber=X   (array)
//   blankBundle     — GET /api/pricing-bundle?method=BLANK&styleNumber=X
//                     (only consulted for paid styles; pass null for free)
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.SamplePricing = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var FREE_THRESHOLD = 10; // blank min cost under this ships FREE

  var SIZE_ORDER = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL', '6XL'];

  function halfDollarCeil(v) {
    return Math.ceil(v * 2) / 2;
  }

  /** Lowest positive blank cost across the first row's basePrices, or null. */
  function minBlankCost(sizePricingRows) {
    if (!Array.isArray(sizePricingRows) || !sizePricingRows.length) return null;
    var prices = (sizePricingRows[0] && sizePricingRows[0].basePrices) || {};
    var values = Object.keys(prices)
      .map(function (k) { return Number(prices[k]); })
      .filter(function (p) { return p > 0; });
    return values.length ? Math.min.apply(Math, values) : null;
  }

  /** All sizes offered across the style's rows, size-order sorted. */
  function sizesFrom(sizePricingRows) {
    var set = {};
    (Array.isArray(sizePricingRows) ? sizePricingRows : []).forEach(function (item) {
      Object.keys((item && item.basePrices) || {}).forEach(function (s) { set[s] = true; });
    });
    return Object.keys(set).sort(function (a, b) {
      var ai = SIZE_ORDER.indexOf(a), bi = SIZE_ORDER.indexOf(b);
      if (ai !== -1 && bi !== -1) return ai - bi;
      if (ai !== -1) return -1;
      if (bi !== -1) return 1;
      return String(a).localeCompare(String(b));
    });
  }

  /** Tier-1 MarginDenominator from a BLANK pricing bundle, or null. */
  function marginDenominator(blankBundle) {
    var tiers = (blankBundle && blankBundle.tiersR) || [];
    var tier1 = tiers.find(function (t) {
      return Number(t.MinQuantity) <= 1 && Number(t.MaxQuantity) >= 1;
    }) || tiers[0];
    var m = parseFloat(tier1 && tier1.MarginDenominator);
    return (m > 0 && m < 1) ? m : null;
  }

  /** Size upcharge from the bundle's display add-ons (0 when absent). */
  function upchargeFor(blankBundle, size) {
    var addOns = (blankBundle && blankBundle.sellingPriceDisplayAddOns) || {};
    var u = parseFloat(addOns[size]);
    return Number.isFinite(u) && u > 0 ? u : 0;
  }

  /**
   * Price one sample. → {
   *   eligible, reason?,             // reason: 'not_sanmar'|'no_pricing'|'no_margin'|'bad_size'
   *   type: 'free'|'paid', base, upcharge, price, sizes: []
   * }
   * `size` optional — when given it is validated against the style's sizes
   * and its upcharge lands in `price` (paid styles only; free stays $0).
   */
  function priceSample(opts) {
    var rows = opts && opts.sizePricingRows;
    var bundle = opts && opts.blankBundle;
    var size = opts && opts.size;

    if (!Array.isArray(rows) || !rows.length || rows.error) {
      return { eligible: false, reason: 'not_sanmar' };
    }
    var minCost = minBlankCost(rows);
    if (minCost == null) return { eligible: false, reason: 'no_pricing' };

    var sizes = sizesFrom(rows);
    if (size && sizes.indexOf(size) === -1) {
      return { eligible: false, reason: 'bad_size' };
    }

    if (minCost < FREE_THRESHOLD) {
      return { eligible: true, type: 'free', base: 0, upcharge: 0, price: 0, minCost: minCost, sizes: sizes };
    }

    var margin = marginDenominator(bundle);
    if (!margin) return { eligible: false, reason: 'no_margin' };
    var base = halfDollarCeil(minCost / margin);
    var upcharge = size ? upchargeFor(bundle, size) : 0;
    return {
      eligible: true, type: 'paid',
      base: base, upcharge: upcharge,
      price: Math.round((base + upcharge) * 100) / 100,
      minCost: minCost, sizes: sizes
    };
  }

  return {
    FREE_THRESHOLD: FREE_THRESHOLD,
    halfDollarCeil: halfDollarCeil,
    minBlankCost: minBlankCost,
    sizesFrom: sizesFrom,
    marginDenominator: marginDenominator,
    upchargeFor: upchargeFor,
    priceSample: priceSample
  };
}));
