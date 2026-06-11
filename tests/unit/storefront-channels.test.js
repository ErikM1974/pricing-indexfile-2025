/**
 * storefront-channels.test.js — characterization lock for the channel registry
 * (config/storefront-channels.js).
 *
 * Every expected string/value below was transcribed VERBATIM from the inline
 * server.js code as of 2026-06-11 (pre-registry: checkout route isCTS
 * ternaries, submit-3day-order banners/constants, save3DTQuoteSession Notes,
 * sendOrderShippedEmail whitelist). These tests prove the registry reproduces
 * the live money-path behavior for BOTH existing channels exactly — they must
 * stay green through any refactor. Changing an expectation here means you are
 * changing what production orders/emails/pushes look like: don't, unless Erik
 * asked for it.
 */

const {
  CHANNELS,
  DEFAULT_CHANNEL,
  buildDateRandQuoteId,
} = require('../../config/storefront-channels.js');

const CTS = CHANNELS['custom-tees'];
const TDT = CHANNELS['3-day-tees'];

// The server.js resolver semantics (absent/unknown channel → legacy 3DT;
// exact lookup for whitelist-gated paths). Mirrored here so the contract is
// locked even though the tiny resolver lives in server.js.
const resolve = (ch) => CHANNELS[String(ch || '')] || CHANNELS[DEFAULT_CHANNEL];
const resolveExact = (ch) => CHANNELS[String(ch || '')] || null;

describe('registry shape', () => {
  test('exactly the two live channels exist — custom-caps is NOT registered yet', () => {
    expect(Object.keys(CHANNELS).sort()).toEqual(['3-day-tees', 'custom-tees']);
    expect(CHANNELS['custom-caps']).toBeUndefined();
  });

  test('default channel is legacy 3-day-tees (historical rows have no channel)', () => {
    expect(DEFAULT_CHANNEL).toBe('3-day-tees');
    expect(resolve(undefined)).toBe(TDT);
    expect(resolve('')).toBe(TDT);
    expect(resolve('custom-caps')).toBe(TDT);   // unknown → legacy, same as the old `isCTS` binary
    expect(resolve('custom-tees')).toBe(CTS);
  });

  test('exact-match lookup (shipped-email whitelist semantics): unknown/absent stays silent', () => {
    expect(resolveExact('custom-tees')).toBe(CTS);
    expect(resolveExact('3-day-tees')).toBe(TDT);
    expect(resolveExact('')).toBeNull();
    expect(resolveExact(undefined)).toBeNull();
    expect(resolveExact('custom-caps')).toBeNull();
  });

  test('every channel entry carries the full required field set (additive-entry contract)', () => {
    const topFields = [
      'label', 'logPrefix', 'quoteIdPrefix', 'buildQuoteId', 'requireRightsAck',
      'rushEligible', 'orderNoteLabel', 'stripeSource', 'stripeLineName',
      'stripeSuccessPath', 'stripeCancelPath', 'fallbackProductName', 'push', 'emails',
    ];
    const pushFields = [
      'fallbackStyleNumber', 'ltmPartNumber', 'designTypeId', 'artistId',
      'designExternalIdPrefix', 'designLocationColors', 'designDetails',
      'swLocationMap', 'defaultFrontLocationName', 'defaultBackLocationName',
      'serviceBanner', 'artReviewClock', 'stockBanner', 'rushOrderFlag', 'taxPartNumber',
    ];
    const emailFields = [
      'confirmationCustomerTemplate', 'confirmationSalesTemplate',
      'shippedEnabled', 'shippedTemplate',
    ];
    Object.entries(CHANNELS).forEach(([name, cfg]) => {
      topFields.forEach((f) => expect([name, f, cfg[f]]).toEqual([name, f, expect.anything()]));
      pushFields.forEach((f) => expect([name, f, cfg.push[f]]).toEqual([name, f, expect.anything()]));
      emailFields.forEach((f) => expect([name, f, cfg.emails[f]]).toEqual([name, f, expect.anything()]));
    });
  });
});

describe('QuoteID builders (was generateCtsQuoteID / generate3DTQuoteID in server.js)', () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date(2026, 5, 11, 14, 30)); // Jun 11 2026 local
  });
  afterEach(() => jest.useRealTimers());

  test('custom-tees: DTG{MMDD}-{4-digit random}', () => {
    for (let i = 0; i < 25; i++) {
      expect(CTS.buildQuoteId()).toMatch(/^DTG0611-\d{4}$/);
    }
    expect(CTS.quoteIdPrefix).toBe('DTG');
  });

  test('3-day-tees: 3DT{MMDD}-{4-digit random}', () => {
    for (let i = 0; i < 25; i++) {
      expect(TDT.buildQuoteId()).toMatch(/^3DT0611-\d{4}$/);
    }
    expect(TDT.quoteIdPrefix).toBe('3DT');
  });

  test('random suffix is zero-padded to 4 digits (single-digit month/day padded too)', () => {
    jest.setSystemTime(new Date(2026, 0, 5, 9, 0)); // Jan 5
    const id = buildDateRandQuoteId('XX');
    expect(id).toMatch(/^XX0105-\d{4}$/);
  });
});

describe('Caspio Notes label (was save3DTQuoteSession + post-Stripe Notes PUT ternaries)', () => {
  test('custom-tees rush', () => {
    expect(CTS.orderNoteLabel({ rush: true, styleNumber: 'PC54' }))
      .toBe('Custom T-Shirts DTG Order (3-Day Rush) — PC54');
  });
  test('custom-tees standard', () => {
    expect(CTS.orderNoteLabel({ rush: false, styleNumber: 'BC3001' }))
      .toBe('Custom T-Shirts DTG Order — BC3001');
  });
  test('custom-tees with no style (trailing em-dash preserved, exactly like the old template)', () => {
    expect(CTS.orderNoteLabel({})).toBe('Custom T-Shirts DTG Order — ');
    expect(CTS.orderNoteLabel()).toBe('Custom T-Shirts DTG Order — ');
  });
  test('3-day-tees is the fixed legacy label regardless of args', () => {
    expect(TDT.orderNoteLabel({ rush: true, styleNumber: 'PC54' })).toBe('3-Day Tees Rush Order');
    expect(TDT.orderNoteLabel()).toBe('3-Day Tees Rush Order');
  });
});

describe('checkout-route values (was isCTS ternaries)', () => {
  test('log prefixes', () => {
    expect(CTS.logPrefix).toBe('[Custom Tees Checkout]');
    expect(TDT.logPrefix).toBe('[3-Day Tees Checkout]');
  });

  test('rights-ack gate only on custom-tees', () => {
    expect(CTS.requireRightsAck).toBe(true);
    expect(TDT.requireRightsAck).toBe(false);
  });

  test('rush-eligible launch scope is PC54', () => {
    expect(CTS.rushEligible).toEqual(['PC54']);
  });

  test('Stripe metadata.source — note the legacy "3day-tees" spelling', () => {
    expect(CTS.stripeSource).toBe('custom-tees');
    expect(TDT.stripeSource).toBe('3day-tees');
  });

  test('Stripe line-item names', () => {
    const line = { colorName: 'Jet Black', size: 'M' };
    expect(CTS.stripeLineName({ style: 'PC54', productName: 'Port & Company Core Cotton Tee', rush: false }, line))
      .toBe('PC54 — Port & Company Core Cotton Tee — Jet Black, M');
    expect(CTS.stripeLineName({ style: 'PC54', productName: 'Port & Company Core Cotton Tee', rush: true }, line))
      .toBe('PC54 — Port & Company Core Cotton Tee — Jet Black, M (3-Day Rush)');
    // no product name → 'Tee' filler, exactly like the old template
    expect(CTS.stripeLineName({ style: 'PC54', productName: '', rush: false }, line))
      .toBe('PC54 Tee — Jet Black, M');
    // product name sliced to 60 chars
    const longName = 'X'.repeat(80);
    expect(CTS.stripeLineName({ style: 'PC54', productName: longName, rush: false }, line))
      .toBe(`PC54 — ${'X'.repeat(60)} — Jet Black, M`);
    // legacy 3DT ignores priced entirely
    expect(TDT.stripeLineName({ style: 'WHATEVER', productName: 'Nope', rush: true }, line))
      .toBe('PC54 Tee — Jet Black, M');
  });

  test('Stripe redirect paths (success keeps the {CHECKOUT_SESSION_ID} placeholder literal)', () => {
    expect(CTS.stripeSuccessPath('DTG0611-1234'))
      .toBe('/pages/custom-tees-success.html?session_id={CHECKOUT_SESSION_ID}&quote_id=DTG0611-1234');
    expect(CTS.stripeCancelPath()).toBe('/custom-tees?canceled=1');
    expect(TDT.stripeSuccessPath('3DT0611-1234'))
      .toBe('/pages/3-day-tees-success.html?session_id={CHECKOUT_SESSION_ID}&quote_id=3DT0611-1234');
    expect(TDT.stripeCancelPath()).toBe('/pages/3-day-tees.html?canceled=1');
  });
});

describe('ShopWorks push constants (was inline in /api/submit-3day-order)', () => {
  test('fallback product identity (the PC54 tee, in all three fallback sites)', () => {
    [CTS, TDT].forEach((cfg) => {
      expect(cfg.push.fallbackStyleNumber).toBe('PC54');
      expect(cfg.fallbackProductName).toBe('Port & Company Core Cotton Tee');
    });
  });

  test('LTM fee part number is the stable SW SKU', () => {
    expect(CTS.push.ltmPartNumber).toBe('LTM-75');
    expect(TDT.push.ltmPartNumber).toBe('LTM-75');
  });

  test('design block ids: DTG type 45, artist 224 (3-Day Tees routing), 3DT- external prefix', () => {
    [CTS, TDT].forEach((cfg) => {
      expect(cfg.push.designTypeId).toBe(45);
      expect(cfg.push.artistId).toBe(224);
      expect(cfg.push.designExternalIdPrefix).toBe('3DT-');
      expect(cfg.push.designLocationColors).toBe('Full Color');
      expect(cfg.push.designDetails()).toEqual([{
        color: 'Full Color DTG',
        paramLabel: 'Print Type',
        paramValue: 'Direct to Garment',
      }]);
      // fresh array each call — two locations must not share one mutable object
      expect(cfg.push.designDetails()).not.toBe(cfg.push.designDetails());
    });
  });

  test('SW_LOC dropdown map (jumbos collapse to the nearest OnSite dropdown value)', () => {
    [CTS, TDT].forEach((cfg) => {
      expect(cfg.push.swLocationMap).toEqual({
        LC: 'Left Chest', FF: 'Full Front', JF: 'Full Front', FB: 'Full Back', JB: 'Full Back',
      });
      expect(cfg.push.defaultFrontLocationName).toBe('Left Chest');
      expect(cfg.push.defaultBackLocationName).toBe('Full Back');
    });
  });

  test('service banner: CTS standard ≠ rush; legacy 3DT always rush', () => {
    expect(CTS.push.serviceBanner(false))
      .toBe('STANDARD DTG SERVICE - 7-10 business days from artwork approval.');
    expect(CTS.push.serviceBanner(true))
      .toBe('3-DAY RUSH SERVICE - Ship within 72 hours from artwork approval.');
    expect(TDT.push.serviceBanner(false))
      .toBe('3-DAY RUSH SERVICE - Ship within 72 hours from artwork approval.');
    expect(TDT.push.serviceBanner(true))
      .toBe('3-DAY RUSH SERVICE - Ship within 72 hours from artwork approval.');
  });

  test('art-review clock wording (was _isCtsStandard ternary)', () => {
    expect(CTS.push.artReviewClock(false)).toBe('production clock');
    expect(CTS.push.artReviewClock(true)).toBe('3-day clock');
    expect(TDT.push.artReviewClock(false)).toBe('3-day clock');
    expect(TDT.push.artReviewClock(true)).toBe('3-day clock');
  });

  test('stock-not-verified banner only exists on the channel with a stock gate', () => {
    expect(CTS.push.stockBanner).toBe(true);
    expect(TDT.push.stockBanner).toBe(false);
  });

  test('ManageOrders rushOrder flag (was channel ternary): CTS follows the toggle, 3DT always true', () => {
    expect(CTS.push.rushOrderFlag({ rush: true })).toBe(true);
    expect(CTS.push.rushOrderFlag({ rush: false })).toBe(false);
    expect(CTS.push.rushOrderFlag({})).toBe(false);
    expect(CTS.push.rushOrderFlag(undefined)).toBe(false);
    expect(TDT.push.rushOrderFlag({ rush: false })).toBe(true);
    expect(TDT.push.rushOrderFlag(undefined)).toBe(true);
  });

  test('Tax_{pct} part convention', () => {
    [CTS, TDT].forEach((cfg) => {
      expect(cfg.push.taxPartNumber('10.1')).toBe('Tax_10.1');
      expect(cfg.push.taxPartNumber('8.8')).toBe('Tax_8.8');
      expect(cfg.push.taxPartNumber(null)).toBe('Tax_0');
    });
  });
});

describe('EmailJS wiring (confirmation + shipped)', () => {
  test('both live channels share the tee templates today', () => {
    [CTS, TDT].forEach((cfg) => {
      expect(cfg.emails.confirmationCustomerTemplate).toBe('template_sample_customer');
      expect(cfg.emails.confirmationSalesTemplate).toBe('template_sample_sales');
      expect(cfg.emails.shippedTemplate).toBe('template_order_shipped');
    });
  });

  test('shipped email enabled for both live channels (the old hardcoded whitelist)', () => {
    expect(CTS.emails.shippedEnabled).toBe(true);
    expect(TDT.emails.shippedEnabled).toBe(true);
  });
});
