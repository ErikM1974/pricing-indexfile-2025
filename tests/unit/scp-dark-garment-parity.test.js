/**
 * Regression lock: dark-garment underbase parity between the customer screen-print
 * calculator (screenprint-pricing-v2.js, /calculators/screen-print-pricing.html) and the
 * staff quote builder (screenprint-quote-builder.js). CLAUDE.md Rule 7 (2026-06-11 fix).
 *
 * BUILDER RULE (authoritative, codified in the 2026-06-09 order-form parity fix):
 *   - Per-piece price lookups ALWAYS use the RAW design color count.
 *   - Dark-garment white underbase adds +1 SCREEN per printed location to the one-time
 *     setup fee (screens × SPSU $30) — it NEVER changes the per-piece price.
 *
 * The old calculator bug bumped the color count +1 on darks for the per-piece lookup too,
 * overcharging every dark-garment piece (e.g. 48× PC61 Jet Black 2c front: $15.50/pc from
 * the 3-color bucket instead of $14.50 — +$48/order).
 *
 * Expected values come from memory/CUSTOMER_QUOTE_CART_DESIGN_2026-06.md SCP worked
 * example (b): 48× PC61, tier 37-71 (MD 0.48), 2c front $14.50, 1c back $5.50, LTM $50 —
 * produced from the live API + builder rules on 2026-06-11.
 *
 * Classes are browser globals (no module.exports); loaded via Function injection like
 * scp-tax-base.test.js. Constructors are DOM-heavy, so instances are built from the
 * prototype with config/state injected — calculatePricing() itself is DOM-free (except
 * the manual calculator's manual mode, which gets a document stub).
 */
const fs = require('fs');
const path = require('path');

function loadClass(file, className, doc) {
  const code = fs.readFileSync(path.join(__dirname, '../../shared_components/js', file), 'utf8');
  const win = {};
  const docStub = doc || { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [] };
  const quietConsole = { log() {}, warn() {}, error() {}, info() {} };
  // eslint-disable-next-line no-new-func
  const factory = new Function('window', 'document', 'console', code + `\nreturn ${className};`);
  return factory(win, docStub, quietConsole);
}

// Bundle fixture in the ScreenPrintPricingService transformed shape (tier 37-71, PC61).
// Bucket "3" front / "2" back hold DIFFERENT prices so the test proves which bucket the
// dark-garment path reads.
const bundle = () => ({
  embellishmentType: 'screenprint',
  primaryLocationPricing: {
    '0': { tiers: [{ minQty: 37, maxQty: 71, prices: { S: 7.5 } }] },
    '2': { tiers: [{ minQty: 37, maxQty: 71, prices: { S: 14.5 }, ltmFee: 50 }] },
    '3': { tiers: [{ minQty: 37, maxQty: 71, prices: { S: 15.5 }, ltmFee: 50 }] },
  },
  additionalLocationPricing: {
    '1': { tiers: [{ minQty: 37, maxQty: 71, pricePerPiece: 5.5 }] },
    '2': { tiers: [{ minQty: 37, maxQty: 71, pricePerPiece: 6.0 }] },
  },
  tierData: { '37-71': { TierLabel: '37-71', MinQuantity: 37, MaxQuantity: 71, MarginDenominator: 0.48, LTM_Fee: 50 } },
  rulesR: { FlashCharge: '0.35' },
  // Raw cost rows for the manual calculator's manual mode (live 37-71 values)
  allScreenprintCostsR: [
    { TierLabel: '37-71', ColorCount: 2, CostType: 'PrimaryLocation', BasePrintCost: 2.65 },
    { TierLabel: '37-71', ColorCount: 3, CostType: 'PrimaryLocation', BasePrintCost: 3.5 },
    { TierLabel: '37-71', ColorCount: 1, CostType: 'AdditionalLocation', BasePrintCost: 5.25 },
    { TierLabel: '37-71', ColorCount: 2, CostType: 'AdditionalLocation', BasePrintCost: 6.0 },
  ],
});

function mkCalc(Cls, stateOver, configOver) {
  const calc = Object.create(Cls.prototype);
  calc.config = Object.assign({ setupFeePerColor: 30, isManualMode: false, maxAdditionalLocations: 3, locationOptions: [] }, configOver);
  calc.state = Object.assign({
    quantity: 48, frontColors: 2, additionalLocations: [], isDarkGarment: false,
    frontHasSafetyStripes: false, safetyStripeSurcharge: 2, pricingData: bundle(),
  }, stateOver);
  return calc;
}

describe('SCP calculator dark-garment underbase parity (Rule 7 lock)', () => {
  const ScreenPrintPricing = loadClass('screenprint-pricing-v2.js', 'ScreenPrintPricing');

  test('repro: 48× PC61 Jet Black, 2-color front — dark per-piece equals light (raw-color bucket)', () => {
    const light = mkCalc(ScreenPrintPricing).calculatePricing();
    const dark = mkCalc(ScreenPrintPricing, { isDarkGarment: true }).calculatePricing();

    expect(light.basePrice).toBeCloseTo(14.5, 2);    // builder: 2-color bucket
    expect(dark.basePrice).toBeCloseTo(14.5, 2);     // NOT 15.50 (3-color bucket = old bug)
    expect(dark.basePrice).toBe(light.basePrice);

    // Underbase lands in setup only: 2 screens light, 2+1 screens dark
    expect(light.setupFee).toBeCloseTo(60, 2);
    expect(dark.setupFee).toBeCloseTo(90, 2);
    expect(dark.colorBreakdown.front).toBe(3);       // screens (drives setup display)

    // Grand totals: subtotal (incl. $50 LTM amortized) + setup
    expect(light.grandTotal).toBeCloseTo(806, 2);    // 48×(14.50+50/48)=746 + 60
    expect(dark.grandTotal).toBeCloseTo(836, 2);     // 746 + 90 — old bug gave 884
  });

  test('front + back on dark: per-piece $20.00 both shades, setup $150 dark / $90 light (worked example b)', () => {
    const back = [{ location: 'back', colors: 1, hasSafetyStripes: false }];
    const light = mkCalc(ScreenPrintPricing, { additionalLocations: back }).calculatePricing();
    const dark = mkCalc(ScreenPrintPricing, { additionalLocations: back, isDarkGarment: true }).calculatePricing();

    // Per-piece: front 14.50 + back 5.50 = 20.00 regardless of garment shade
    expect(light.totalPerShirtPrintOnlyCost).toBeCloseTo(20, 2);
    expect(dark.totalPerShirtPrintOnlyCost).toBeCloseTo(20, 2);
    expect(dark.additionalCost).toBeCloseTo(5.5, 2); // 1-color bucket, NOT 6.00 (2-color)

    // Setup: light (2+1)×$30=90; dark adds +1 screen PER printed location → (3+2)×$30=150
    expect(light.setupFee).toBeCloseTo(90, 2);
    expect(dark.setupFee).toBeCloseTo(150, 2);

    // Builder separate-mode grand totals (worked example b): light $1100, dark $1160
    expect(light.grandTotal).toBeCloseTo(1100, 2);
    expect(dark.grandTotal).toBeCloseTo(1160, 2);

    // LTM read off the matched tier row (37-71 carries $50)
    expect(dark.ltmFee).toBeCloseTo(50, 2);
  });
});

describe('SCP manual calculator stays synced (same underbase rule)', () => {
  test('automated mode: dark per-piece equals light, setup +$30/location', () => {
    const ScreenPrintManualPricing = loadClass('screenprint-manual-pricing.js', 'ScreenPrintManualPricing');
    const back = [{ location: 'back', colors: 1, hasSafetyStripes: false }];
    const light = mkCalc(ScreenPrintManualPricing, { additionalLocations: back }).calculatePricing();
    const dark = mkCalc(ScreenPrintManualPricing, { additionalLocations: back, isDarkGarment: true }).calculatePricing();

    expect(dark.basePrice).toBeCloseTo(14.5, 2);
    expect(dark.basePrice).toBe(light.basePrice);
    expect(dark.additionalCost).toBeCloseTo(5.5, 2);
    expect(light.setupFee).toBeCloseTo(90, 2);
    expect(dark.setupFee).toBeCloseTo(150, 2);
  });

  test('manual mode: raw-color print cost + flash × raw colors; underbase is setup-only', () => {
    // document stub feeds the manual garment cost ($3.53 = PC61 S)
    const doc = { getElementById: (id) => (id === 'manual-base-cost' ? { value: '3.53' } : null), querySelector: () => null, querySelectorAll: () => [] };
    const ScreenPrintManualPricing = loadClass('screenprint-manual-pricing.js', 'ScreenPrintManualPricing', doc);
    const light = mkCalc(ScreenPrintManualPricing, {}, { isManualMode: true }).calculatePricing();
    const dark = mkCalc(ScreenPrintManualPricing, { isDarkGarment: true }, { isManualMode: true }).calculatePricing();

    // ceil((3.53/0.48 + (2.65 + 0.35×2)/0.48) × 2)/2 = ceil(14.3333×2)/2 = 14.50
    expect(light.basePrice).toBeCloseTo(14.5, 2);
    expect(dark.basePrice).toBeCloseTo(14.5, 2);  // NOT priced off ColorCount 3 / flash ×3
    expect(light.setupFee).toBeCloseTo(60, 2);
    expect(dark.setupFee).toBeCloseTo(90, 2);
  });
});
