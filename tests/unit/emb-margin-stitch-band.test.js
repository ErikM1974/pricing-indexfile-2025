/**
 * EMB pricing — per-tier margin (N2) + AS-Garm flat stitch band.
 * Locks the quote builder to the live customer pages:
 *   teamnwca.com/pricing/embroidery?StyleNumber=J790   (garment)
 *   teamnwca.com/pricing/cap-embroidery?StyleNumber=112 (cap)
 * If a future edit re-flattens the margin or breaks the band parse, these fail loudly.
 */
const Calc = require('../../shared_components/js/embroidery-quote-pricing.js');

function makeCalc() {
  const c = new Calc();
  c.roundingMethod = 'CeilDollar';
  c.marginDenominator = 0.55;    // global garment fallback (tiersR[0] = 1-7)
  c.capMarginDenominator = 0.53; // global cap fallback (capTiersR[0] = 24-47)
  // Per-tier data exactly as initialize() builds it from Caspio Pricing_Tiers + Embroidery_Costs
  c.tiers = {
    '1-7':   { embCost: 18, marginDenominator: 0.55, hasLTM: true },
    '8-23':  { embCost: 18, marginDenominator: 0.53 },
    '24-47': { embCost: 14, marginDenominator: 0.53 },
    '48-71': { embCost: 13, marginDenominator: 0.53 },
    '72+':   { embCost: 12, marginDenominator: 0.53 },
  };
  c.capTiers = {
    '1-7':   { embCost: 17, marginDenominator: 0.55 },
    '8-23':  { embCost: 17, marginDenominator: 0.53 },
    '24-47': { embCost: 13, marginDenominator: 0.53 },
    '48-71': { embCost: 11, marginDenominator: 0.53 },
    '72+':   { embCost: 10, marginDenominator: 0.53 },
  };
  // AS-Garm flat band as parsed from the canonical Mid/Large rows ($0 / $4 / $10, 10K included)
  c.stitchSurchargeTiers = [
    { max: 10000, fee: 0 },
    { max: 15000, fee: 4 },
    { max: 25000, fee: 10 },
  ];
  return c;
}

describe('N2 per-tier margin — builder matches the live customer pages', () => {
  const c = makeCalc();
  const g = (t) => c.roundPrice(34.19 / c.getMarginDenominator(t) + c.getEmbroideryCost(t));   // J790 blank $34.19
  const cap = (t) => c.roundCapPrice(6.75 / c.getCapMarginDenominator(t) + c.getCapEmbroideryCost(t)); // 112 blank $6.75

  test('garment margin is per-tier: 1-7 = 0.55, 8+ = 0.53', () => {
    expect(c.getMarginDenominator('1-7')).toBe(0.55);
    expect(c.getMarginDenominator('8-23')).toBe(0.53);
    expect(c.getMarginDenominator('24-47')).toBe(0.53);
    expect(c.getMarginDenominator('72+')).toBe(0.53);
  });

  test('J790 garment prices match teamnwca.com/pricing/embroidery', () => {
    expect(g('8-23')).toBe(83);
    expect(g('24-47')).toBe(79);
    expect(g('48-71')).toBe(78);
    expect(g('72+')).toBe(77);
  });

  test('112 cap prices match teamnwca.com/pricing/cap-embroidery', () => {
    expect(cap('8-23')).toBe(30);
    expect(cap('24-47')).toBe(26);
    expect(cap('48-71')).toBe(24);
    expect(cap('72+')).toBe(23);
  });

  test('regression: the flatten bug under-charged 24-47 ($77, not $79)', () => {
    expect(c.roundPrice(34.19 / 0.55 + 14)).toBe(77); // old flattened-to-0.55 behavior
    expect(g('24-47')).toBe(79);                        // per-tier fix
  });
});

describe('AS-Garm stitch band — flat $0/$4/$10 from canonical Mid/Large', () => {
  const c = makeCalc();
  test('band boundaries are correct (10K included, +$4 to 15K, +$10 to 25K)', () => {
    expect(c.getStitchSurcharge(8000)).toBe(0);
    expect(c.getStitchSurcharge(10000)).toBe(0);
    expect(c.getStitchSurcharge(10001)).toBe(4);
    expect(c.getStitchSurcharge(12000)).toBe(4);
    expect(c.getStitchSurcharge(15000)).toBe(4);
    expect(c.getStitchSurcharge(15001)).toBe(10);
    expect(c.getStitchSurcharge(25000)).toBe(10);
    expect(c.getStitchSurcharge(26000)).toBe(10); // >25K caps at the Large-tier fee (from Caspio, not hardcoded)
  });

  test('band is monotonic — more stitches never costs less', () => {
    let prev = -1;
    for (const s of [5000, 10000, 12000, 15000, 18000, 25000, 30000]) {
      const fee = c.getStitchSurcharge(s);
      expect(fee).toBeGreaterThanOrEqual(prev);
      prev = fee;
    }
  });
});
