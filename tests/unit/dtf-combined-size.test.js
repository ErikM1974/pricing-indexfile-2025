/**
 * dtf-combined-size.test.js — locks the CSV105 fix (2026-06-24).
 *
 * Products with COMBINED / RANGE size names (safety vests + jackets price as S/M, L/XL, 2/3X, 4/5X,
 * not the standard S–6XL) couldn't price DTF: quote-cart-engine.js dtfSizeUpcharge only knew the
 * standard sizes (the `sellingPriceDisplayAddOns` map + a base list) and THREW PRICE_UNAVAILABLE on
 * anything else — so the Quick Quote showed "No price for this method" for e.g. CSV105.
 *
 * The fix: when a non-standard size's OWN garment price equals the base cost, it's a BASE size → 0
 * upcharge (lets these products price at their base size — what the Quick Quote estimate uses). We
 * do NOT invent a positive upcharge from the price delta for EXTENDED combined sizes — that would
 * under-charge vs the real selling upcharge — so those still throw (Erik's #1 rule: never a silent
 * wrong/low price).
 */
const QuoteCartEngine = require('../../shared_components/js/quote-cart-engine.js');
const dtfSizeUpcharge = QuoteCartEngine._internals.dtfSizeUpcharge;

// CSV105 (CornerStone ANSI 107 vest), live data: S/M $12.50 (base), L/XL $12.50, 2/3X $13.50, 4/5X $14.50.
const BLANK_SIZES = [
  { size: 'S/M', price: 12.5 }, { size: 'L/XL', price: 12.5 },
  { size: '2/3X', price: 13.5 }, { size: '4/5X', price: 14.5 },
];
const BASE = 12.5;
// The upcharge map is keyed on STANDARD sizes only — the vest's combined sizes are NOT in it.
const ADDONS = { '2XL': 2, '3XL': 3, '4XL': 4 };

describe('DTF combined/range sizes (vests, jackets) — CSV105 fix (2026-06-24)', () => {
  test('BASE combined size (garment price == base) → 0 upcharge, no throw', () => {
    expect(dtfSizeUpcharge('S/M', ADDONS, BLANK_SIZES, BASE)).toBe(0);
    expect(dtfSizeUpcharge('L/XL', ADDONS, BLANK_SIZES, BASE)).toBe(0);
  });

  test('EXTENDED combined size (price > base) STILL throws — never under-charge from the cost delta', () => {
    expect(() => dtfSizeUpcharge('2/3X', ADDONS, BLANK_SIZES, BASE)).toThrow(/size-upcharge data for 2\/3X/);
    expect(() => dtfSizeUpcharge('4/5X', ADDONS, BLANK_SIZES, BASE)).toThrow(/size-upcharge data for 4\/5X/);
  });

  test('standard sizes unchanged: S = 0 (base list), 2XL = the live API upcharge', () => {
    expect(dtfSizeUpcharge('S', ADDONS, BLANK_SIZES, BASE)).toBe(0);
    expect(dtfSizeUpcharge('2XL', ADDONS, BLANK_SIZES, BASE)).toBe(2);
  });

  test('backward compatible: without garment prices, an unknown size still throws', () => {
    expect(() => dtfSizeUpcharge('S/M', ADDONS)).toThrow(/size-upcharge data for S\/M/);
  });
});
