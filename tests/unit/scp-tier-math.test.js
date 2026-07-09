/**
 * SCP tier lookup — A-grade Batch 2.2 money-math lock.
 *
 * SCP had ZERO unit tests on its tier machinery (EMB was the only builder
 * with money-math units). Locks builders/scp/pricing-sync.js:
 *   - getScreenPrintTier fallback boundaries (2026-06-19 remap: 24-47 / 48-71 /
 *     72-144 / 145+) and the SCP rule that qty<24 prices at the 24-47 tier
 *     (the $50 LTM fee is charged separately — and per Caspio, THROUGH the
 *     24-47 tier, unlike DTG/DTF's <24-only)
 *   - findPricingTier (Caspio-tier matcher): boundary inclusion + top-tier
 *     clamp above the cap (a capped 145-576 must not reprice qty 999 at the
 *     bottom tier) + below-min floor + null on empty
 *
 * The functions are module-private on purpose (web-quote-cart-parity
 * byte-compares that region), so this test extracts them from source —
 * identical technique to size-constants-drift.
 */
const fs = require('fs');
const path = require('path');

const SRC = fs.readFileSync(
  path.join(__dirname, '../../shared_components/js/builders/scp/pricing-sync.js'),
  'utf8'
);

function extractFns() {
  const tiers = SRC.match(/const SCREENPRINT_TIERS = \[[\s\S]*?\];/);
  const getTier = SRC.match(/function getScreenPrintTier\(qty\) \{[\s\S]*?\n\}/);
  const findTier = SRC.match(/function findPricingTier\(tiers, qty\) \{[\s\S]*?\n\}/);
  if (!tiers || !getTier || !findTier) throw new Error('tier functions not found in scp/pricing-sync.js');
  return new Function(
    tiers[0] + '\n' + getTier[0] + '\n' + findTier[0] + '\nreturn { SCREENPRINT_TIERS, getScreenPrintTier, findPricingTier };'
  )();
}

const { SCREENPRINT_TIERS, getScreenPrintTier, findPricingTier } = extractFns();

describe('getScreenPrintTier fallback boundaries (2026-06-19 remap)', () => {
  test.each([
    [1, '24-47'], // <24 prices at the 24-47 tier; LTM billed separately
    [23, '24-47'],
    [24, '24-47'],
    [47, '24-47'],
    [48, '48-71'],
    [71, '48-71'],
    [72, '72-144'],
    [144, '72-144'],
    [145, '145+'],
    [5000, '145+'],
  ])('qty %i → %s', (qty, label) => {
    expect(getScreenPrintTier(qty).label).toBe(label);
  });

  test('fallback tier labels are exactly the 2026-06-19 set (old 24-36/37-72/73-144 must never return)', () => {
    expect(SCREENPRINT_TIERS.map((t) => t.label)).toEqual(['24-47', '48-71', '72-144', '145+']);
  });
});

describe('findPricingTier (Caspio tier matcher)', () => {
  const CASPIO_TIERS = [
    { label: '24-47', minQty: 24, maxQty: 47 },
    { label: '48-71', minQty: 48, maxQty: 71 },
    { label: '72-144', minQty: 72, maxQty: 144 },
    { label: '145-576', minQty: 145, maxQty: 576 }, // capped top tier — the clamp case
  ];

  test.each([
    [24, '24-47'],
    [47, '24-47'],
    [48, '48-71'],
    [144, '72-144'],
    [145, '145-576'],
    [576, '145-576'],
  ])('qty %i → %s', (qty, label) => {
    expect(findPricingTier(CASPIO_TIERS, qty).label).toBe(label);
  });

  test('qty ABOVE the capped top tier clamps to the top (never silently reprices at the bottom)', () => {
    expect(findPricingTier(CASPIO_TIERS, 999).label).toBe('145-576');
  });

  test('qty below every tier floors to the lowest tier', () => {
    expect(findPricingTier(CASPIO_TIERS, 5).label).toBe('24-47');
  });

  test('null-open maxQty matches to infinity; empty tiers → null', () => {
    const open = [{ label: '72+', minQty: 72, maxQty: null }];
    expect(findPricingTier(open, 100000).label).toBe('72+');
    expect(findPricingTier([], 24)).toBeNull();
    expect(findPricingTier(null, 24)).toBeNull();
  });
});
