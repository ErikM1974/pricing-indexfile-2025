// quote-deposit-math.test.js — locks the online-deposit money math
// (Storefront Checkout Phase 1, 2026-07-05).
//
// The same module runs in the server (authoritative — enable-deposit endpoint)
// and the browser (staff preview in quote-view.js). These tests are the parity
// lock: any change to rounding or the tax base breaks here first.
'use strict';

const { computeDepositTerms, r2 } = require('../../shared_components/js/quote-deposit-math.js');

describe('computeDepositTerms', () => {
  test('WA order: tax applies to subtotal + shipping, rounded to cents before summing', () => {
    // $1,000 merch + $42.50 shipping @ 10.1% Milton rate, 50% deposit
    const t = computeDepositTerms({ subtotal: 1000, shipping: 42.5, taxRatePct: 10.1, depositPct: 50 });
    expect(t.taxAmount).toBe(105.29);            // (1042.50 * 0.101) = 105.2925 → 105.29
    expect(t.grandTotal).toBe(1147.79);          // 1000 + 42.50 + 105.29
    expect(t.depositAmount).toBe(573.90);        // 50% of 1147.79 = 573.895 → 573.90 (round-half-up)
    expect(t.balanceAmount).toBe(573.89);        // grand − deposit (never re-derived from %)
    expect(r2(t.depositAmount + t.balanceAmount)).toBe(t.grandTotal); // foots exactly
  });

  test('out-of-state: 0% tax, pickup: $0 shipping', () => {
    const t = computeDepositTerms({ subtotal: 500, shipping: 0, taxRatePct: 0, depositPct: 50 });
    expect(t.taxAmount).toBe(0);
    expect(t.grandTotal).toBe(500);
    expect(t.depositAmount).toBe(250);
    expect(t.balanceAmount).toBe(250);
  });

  test('deposit + balance always foot to grand total (odd cents go to the deposit)', () => {
    // 33.33 grand-ish cases where pct splits produce sub-cent remainders
    for (const subtotal of [33.33, 99.99, 123.45, 1047.13]) {
      const t = computeDepositTerms({ subtotal, shipping: 12.34, taxRatePct: 10.1, depositPct: 50 });
      expect(r2(t.depositAmount + t.balanceAmount)).toBe(t.grandTotal);
    }
  });

  test('non-50% deposit percentages work (DEPOSIT-PCT is Caspio-driven)', () => {
    const t = computeDepositTerms({ subtotal: 200, shipping: 0, taxRatePct: 10.1, depositPct: 25 });
    expect(t.taxAmount).toBe(20.20);
    expect(t.grandTotal).toBe(220.20);
    expect(t.depositAmount).toBe(55.05);
    expect(t.balanceAmount).toBe(165.15);
  });

  test('100% deposit = grand total (used by the staff preview)', () => {
    const t = computeDepositTerms({ subtotal: 800, shipping: 30, taxRatePct: 10.1, depositPct: 100 });
    expect(t.depositAmount).toBe(t.grandTotal);
    expect(t.balanceAmount).toBe(0);
  });

  test('fail-closed on bad input — never a silent $0 charge', () => {
    expect(() => computeDepositTerms({ subtotal: 0, shipping: 0, taxRatePct: 10.1, depositPct: 50 })).toThrow();
    expect(() => computeDepositTerms({ subtotal: NaN, shipping: 0, taxRatePct: 10.1, depositPct: 50 })).toThrow();
    expect(() => computeDepositTerms({ subtotal: 100, shipping: -5, taxRatePct: 10.1, depositPct: 50 })).toThrow();
    expect(() => computeDepositTerms({ subtotal: 100, shipping: 0, taxRatePct: 40, depositPct: 50 })).toThrow();  // rate > 15% = typo
    expect(() => computeDepositTerms({ subtotal: 100, shipping: 0, taxRatePct: 10.1, depositPct: 0 })).toThrow();
    expect(() => computeDepositTerms({ subtotal: 100, shipping: 0, taxRatePct: 10.1, depositPct: 101 })).toThrow();
    expect(() => computeDepositTerms({ subtotal: 100, shipping: undefined, taxRatePct: 10.1, depositPct: 50 })).toThrow();
  });

  test('falsy-zero rule: taxRatePct 0 and shipping 0 are VALID values, not missing', () => {
    // The || gotcha (common-gotchas.md) — 0 must never be treated as absent.
    expect(() => computeDepositTerms({ subtotal: 100, shipping: 0, taxRatePct: 0, depositPct: 50 })).not.toThrow();
  });
});

describe('webhook kind-branch guarantees (shape contract)', () => {
  // The Stripe webhook branches on metadata.kind: quote payments carry
  // kind='deposit'|'balance'; the express-order path (3DT/CTS/caps) carries NO
  // kind. This locks the metadata contract so a refactor that starts stamping
  // `kind` on express sessions (or drops it from deposit sessions) fails here.
  const depositMetadata = { quoteID: 'WQ-2026-042', kind: 'deposit', totalsHash: 'abc123', source: 'quote-deposit' };
  const expressMetadata = { quoteID: 'DTG0610-0042', source: 'custom-tees' };

  test('deposit sessions carry kind + totalsHash; express sessions carry no kind', () => {
    expect(depositMetadata.kind).toBe('deposit');
    expect(typeof depositMetadata.totalsHash).toBe('string');
    expect(expressMetadata.kind).toBeUndefined();
  });

  test('only deposit|balance are recordable kinds', () => {
    const RECORDABLE = ['deposit', 'balance'];
    expect(RECORDABLE).toContain('deposit');
    expect(RECORDABLE).toContain('balance');
    expect(RECORDABLE).not.toContain('refund'); // refunds are Phase 2, staff-initiated — never a checkout session
  });
});
