/**
 * Money invariants over the LOCKED pricing baselines — A-grade Batch 2.2.
 *
 * The capture gate proves live pages still produce these numbers; THIS suite
 * proves the numbers themselves are internally coherent, so a bad re-lock
 * (fat-fingered edit, half-captured run) can't smuggle in an inconsistent
 * golden. Locks, for every scenario across all 4 builders:
 *   1. sizeTotal == perPiece × qty          (per size, to the cent)
 *   2. Σ sizeTotal == lineSubtotal
 *   3. grandTotalBeforeTax == lineSubtotal + ltmFee + screenSetupFee
 *      (EMB bills LTM as a separate line; SCP adds screen setup; DTG/DTF
 *      bake LTM into perPiece — their ltmFee field is 0 by construction)
 */
const path = require('path');

const locked = require(path.join(__dirname, '../../tests/pricing-baselines/baselines.locked.json'));

const SCENARIOS = Object.entries(locked).filter(([id]) => id !== '_meta');
const r2 = (n) => Math.round(n * 100) / 100;

describe.each(SCENARIOS)('%s', (id, scenario) => {
  const e = scenario.expected;

  test('per-size totals foot: sizeTotal == perPiece × qty', () => {
    for (const [size, row] of Object.entries(e.perSizeBreakdown || {})) {
      expect({ size, total: r2(row.perPiece * row.qty) }).toEqual({ size, total: r2(row.sizeTotal) });
    }
  });

  test('line subtotal == Σ size totals', () => {
    const sum = Object.values(e.perSizeBreakdown || {}).reduce((a, b) => a + b.sizeTotal, 0);
    expect(r2(sum)).toBe(r2(e.lineSubtotal));
  });

  test('grand total == line + LTM + screen setup', () => {
    const expected = r2(e.lineSubtotal + (e.ltmFee || 0) + (e.screenSetupFee || 0));
    expect(r2(e.grandTotalBeforeTax)).toBe(expected);
  });

  test('quantities foot to the scenario inputs', () => {
    const sizeQty = Object.values(e.perSizeBreakdown || {}).reduce((a, b) => a + b.qty, 0);
    expect(sizeQty).toBe(scenario.inputs.qty);
  });
});
