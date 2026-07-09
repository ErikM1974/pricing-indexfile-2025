/**
 * DTG cross-repo FULL-FORMULA golden vectors — A-grade Batch 2.4.
 *
 * The DTG engine exists TWICE: the SERVER canonical pricer
 * (caspio-pricing-proxy/lib/dtg-canonical-pricing.js — customer catalog +
 * Quick Quote via /api/dtg/quote-pricing) and the CLIENT service
 * (shared_components/js/dtg-pricing-service.js — staff builder preview/PDF).
 * They are algorithm-identical today, held together by a "DO NOT diverge"
 * comment; the fallback-margin constant already drifted once (0.57 vs 0.53).
 * This test feeds IDENTICAL synthetic bundles to BOTH and asserts equal
 * per-size numbers across the full tier × location matrix — margin division,
 * combo print-cost summing, the LTM-tier print-cost fallback, ceil-to-half-
 * dollar, upcharge-after-rounding, unavailable-size flagging, tier resolution,
 * and LTM amortization. Any one-sided edit fails here.
 *
 * Cross-repo: proxy assertions skip if the sibling repo isn't checked out
 * (FE-only CI) — the client-vs-golden assertions still run. Batch 6 (formula
 * collapse: client delegates to the canonical module) turns this file into
 * the proof the collapse changed nothing.
 */
const fs = require('fs');
const path = require('path');

const CLIENT = path.join(__dirname, '..', '..', 'shared_components', 'js', 'dtg-pricing-service.js');
const PROXY = path.join(__dirname, '..', '..', '..', 'caspio-pricing-proxy', 'lib', 'dtg-canonical-pricing.js');

// ---------------------------------------------------------------------------
// Load the CLIENT service class from source (classic script → window global).
// ---------------------------------------------------------------------------
function loadClientService() {
  const src = fs.readFileSync(CLIENT, 'utf8');
  const win = {};
  const quiet = { log() {}, warn() {}, error() {}, info() {} };
  const factory = new Function('window', 'console', 'fetch', src + '\nreturn window.DTGPricingService;');
  const DTGPricingService = factory(win, quiet, () => Promise.reject(new Error('no network in tests')));
  return new DTGPricingService();
}

const proxyAvailable = fs.existsSync(PROXY);
// eslint-disable-next-line import/no-dynamic-require
const canonical = proxyAvailable ? require(PROXY) : null;

// ---------------------------------------------------------------------------
// One synthetic bundle, Caspio-shaped, exercising every formula branch:
// margin per tier · LTM tier WITHOUT cost rows (print-cost fallback) · combo
// location summing · half-dollar ceil boundary · upcharges after rounding ·
// a zero-price (unavailable) size.
// ---------------------------------------------------------------------------
const TIERS = [
  { TierLabel: '1-23', MinQuantity: 1, MaxQuantity: 23, MarginDenominator: 0.55, LTM_Fee: 50 },
  { TierLabel: '24-47', MinQuantity: 24, MaxQuantity: 47, MarginDenominator: 0.6, LTM_Fee: 0 },
  { TierLabel: '48-71', MinQuantity: 48, MaxQuantity: 71, MarginDenominator: 0.65, LTM_Fee: 0 },
  { TierLabel: '72+', MinQuantity: 72, MaxQuantity: 99999, MarginDenominator: 0.7, LTM_Fee: 0 },
];
// No '1-23' rows on purpose — the LTM tier must fall back to 24-47 print costs.
const COSTS = [];
for (const [label, lc, fb] of [['24-47', 6.25, 8.5], ['48-71', 5.5, 7.75], ['72+', 4.75, 7.0]]) {
  COSTS.push({ PrintLocationCode: 'LC', TierLabel: label, PrintCost: lc });
  COSTS.push({ PrintLocationCode: 'FB', TierLabel: label, PrintCost: fb });
}
const SIZES = [
  { size: 'S', price: 3.53 },
  { size: 'M', price: 3.53 },
  { size: 'L', price: 3.53 },
  { size: 'XL', price: 3.53 },
  { size: '2XL', price: 5.11 },
  { size: '3XL', price: 6.42 },
  { size: '4XL', price: 0 }, // unavailable — both sides must flag, never price $0
];
const UPCHARGES = { '2XL': 2, '3XL': 4 };
const LOCATIONS = ['LC', 'FB', 'LC_FB'];
const AVAILABLE = ['S', 'M', 'L', 'XL', '2XL', '3XL'];

const svc = loadClientService();

function clientPrices(locationCode, tierLabel) {
  const tier = TIERS.find((t) => t.TierLabel === tierLabel);
  return svc.calculateLocationPrices(locationCode, tier, COSTS, SIZES, UPCHARGES, TIERS);
}

describe('DTG client ↔ server full-formula parity (golden vectors)', () => {
  const maybe = proxyAvailable ? describe : describe.skip;

  maybe('per-size base prices identical across the tier × location matrix', () => {
    for (const tierLabel of TIERS.map((t) => t.TierLabel)) {
      for (const loc of LOCATIONS) {
        test(`${tierLabel} @ ${loc}`, () => {
          const server = canonical.priceForLocationCombo({
            bundle: { pricing: { tiers: TIERS, costs: COSTS, sizes: SIZES, upcharges: UPCHARGES } },
            locationCode: loc,
            tierLabel,
          });
          const client = clientPrices(loc, tierLabel);
          for (const size of AVAILABLE) {
            expect(client[size][tierLabel]).toBeCloseTo(server.perSize[size], 10);
          }
          // Unavailable size: both sides flag it — never a silent $0 (Erik's #1 rule).
          expect(client['4XL'][tierLabel]).toBe('N/A');
          expect(server.perSize['4XL']).toBeNull();
        });
      }
    }
  });

  maybe('tier resolution identical at every boundary', () => {
    test.each([1, 23, 24, 47, 48, 71, 72, 500])('qty %i', (qty) => {
      const client = svc.getTierForQuantity(TIERS, qty);
      const server = canonical.tierForCombinedQty(TIERS, qty);
      expect(client.TierLabel).toBe(server.TierLabel);
    });
  });

  maybe('LTM amortization: floor-to-cents per unit (never over-charge)', () => {
    test('LTM_Fee 50 across qtys', () => {
      const ltmTier = TIERS[0];
      for (const qty of [1, 3, 7, 10, 23]) {
        const expected = Math.floor((50 / qty) * 100) / 100; // the inline-form spec (dtg-inline-form.js)
        expect(canonical.ltmPerUnit(ltmTier, qty)).toBe(expected);
      }
      expect(canonical.ltmPerUnit(TIERS[1], 30)).toBe(0); // non-LTM tier → 0
    });
  });

  // Frozen golden numbers — catches BOTH copies drifting together.
  // 24-47 @ LC: ceil((3.53/0.6 + 6.25)*2)/2 = ceil(12.133*2)/2 = 12.5 → S 12.5, 2XL 14.5, 3XL 16.5
  // 1-23 @ LC (LTM fallback → 24-47 print cost, margin 0.55): ceil((3.53/0.55 + 6.25)*2)/2 = 13.0
  // 24-47 @ LC_FB: ceil((3.53/0.6 + 14.75)*2)/2 = 21.0
  test('frozen golden vectors (client)', () => {
    expect(clientPrices('LC', '24-47').S['24-47']).toBe(12.5);
    expect(clientPrices('LC', '24-47')['2XL']['24-47']).toBe(14.5);
    expect(clientPrices('LC', '24-47')['3XL']['24-47']).toBe(16.5);
    expect(clientPrices('LC', '1-23').S['1-23']).toBe(13.0);
    expect(clientPrices('LC_FB', '24-47').S['24-47']).toBe(21.0);
  });
});
