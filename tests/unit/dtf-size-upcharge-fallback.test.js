/**
 * dtf-size-upcharge-fallback.test.js — locks the DTF-1 fix (2026-06-20 pricing-engine audit).
 *
 * The DTF staff builder's getSizeUpcharge() substitutes a documented hardcoded extended-size
 * upcharge ({2XL:2..6XL:6}) when the live API (sellingPriceDisplayAddOns) lacks that size.
 * Per Erik's #1 rule a hardcoded price is allowed ONLY as a fallback AND must surface a VISIBLE
 * warning — never a silent hardcoded price. (The customer engine THROWS PRICE_UNAVAILABLE in the
 * same situation — quote-cart-engine.js dtfSizeUpcharge.) Before the fix the builder's save/print
 * money path silently billed the default.
 *
 * These tests prove: (1) the live API upcharge is used + NO fallback flagged when present;
 * (2) a missing size flags the fallback AND fires a visible warning via calculateFromState();
 * (3) the warning is de-duped across re-prices; (4) the fallback PRICE is unchanged (no under-bill)
 * — the fix is the warning, not a price change. Reuses the dtf-childrow-state harness pattern
 * (runs the REAL class source against stubs).
 */
const fs = require('fs');
const path = require('path');

function loadBuilderClass() {
  // D1 (2026-07-08): the class moved to builders/dtf/quote-builder-class.js — strip the
  // `export ` prefix so the classic new Function() harness can evaluate it.
  const code = fs.readFileSync(path.join(__dirname, '../../shared_components/js/builders/dtf/quote-builder-class.js'), 'utf8')
      .replace(/^export (class|function|let|const)/gm, '$1')
      // D2: the module imports { dtfState, sizeDetectionCache } from state.js —
      // strip the import and inject equivalent stubs for the classic harness.
      .replace(/^import .*$/gm, '')
      .replace(/^/, 'const dtfState = { _dtfPushQuoteId: null, _dtfPushInFlight: false, hasChanges: false };\nconst sizeDetectionCache = new Map();\n');
  const doc = { addEventListener: () => {}, getElementById: () => null, querySelector: () => null, querySelectorAll: () => [] };
  const quietConsole = { log() {}, warn() {}, error() {}, info() {} };
  // eslint-disable-next-line no-new-func
  const factory = new Function('window', 'document', 'console', code + '\nreturn DTFQuoteBuilder;');
  return factory({}, doc, quietConsole);
}

/** Bare instance with a 10-23 LTM-tier fixture (mirrors dtf-childrow-state). */
function makeBuilder(cls) {
  const b = Object.create(cls.prototype);
  b.products = [{
    id: 1, styleNumber: 'ST350', description: 'Tee', baseCost: 5.16,
    sizeUpcharges: {}, quantities: { S: 0, M: 6, L: 6, XL: 6, '2XL': 0 },
  }];
  b.childRows = new Map();
  b.selectedLocations = ['left-chest', 'full-back'];
  b.currentPricingData = {
    tier: '10-23', marginDenom: 0.55, ltmPerUnit: 2.17, totalLtmFee: 50,
    transferBreakdown: { breakdown: [], total: 21.5 }, laborCostPerLoc: 2.5, freightPerTransfer: 0.5,
  };
  b.pricingCalculator = { applyRounding: (p) => Math.ceil(p * 2) / 2 };
  return b;
}

describe('DTF-1: extended-size upcharge fallback is flagged + warned, never silent (2026-06-20 audit)', () => {
  test('API upcharge PRESENT → used, NO fallback flagged, NO warning', () => {
    const cls = loadBuilderClass();
    const b = makeBuilder(cls);
    b.registerChildRow(7, { parentId: 1, size: '2XL', qty: 4, baseCost: 5.16, sizeUpcharges: { '2XL': 2 } });
    const warnings = [];
    b.showToast = (msg, type) => warnings.push({ msg, type });

    const calc = b.calculateFromState();
    // 2XL with the API $2 upcharge: 5.16/0.55 + 2 + 21.5 + 5 + 1 + 2.17 = 41.05 → 41.50
    expect(calc.childTotals.get('row-7').unitPrice).toBeCloseTo(41.5, 2);
    expect(b._upchargeFallbackSizes.size).toBe(0);
    expect(warnings.length).toBe(0);
  });

  test('API MISSING the size → hardcoded default used, fallback FLAGGED + visible warning fired', () => {
    const cls = loadBuilderClass();
    const b = makeBuilder(cls);
    b.registerChildRow(7, { parentId: 1, size: '2XL', qty: 4, baseCost: 5.16, sizeUpcharges: {} });
    const warnings = [];
    b.showToast = (msg, type) => warnings.push({ msg, type });

    const calc = b.calculateFromState();
    // SAME price as the API path ($2 default == live ladder) — the fix is the WARNING, not a price change.
    expect(calc.childTotals.get('row-7').unitPrice).toBeCloseTo(41.5, 2);
    expect(b._upchargeFallbackSizes.has('2XL')).toBe(true);
    expect(warnings.length).toBe(1);
    expect(warnings[0].type).toBe('warning');
    expect(warnings[0].msg).toMatch(/2XL/);
    expect(warnings[0].msg).toMatch(/estimate/i);
  });

  test('warning is de-duped across re-prices for the same fallback set', () => {
    const cls = loadBuilderClass();
    const b = makeBuilder(cls);
    b.registerChildRow(7, { parentId: 1, size: '2XL', qty: 4, baseCost: 5.16, sizeUpcharges: {} });
    const warnings = [];
    b.showToast = (msg) => warnings.push(msg);

    b.calculateFromState();
    b.calculateFromState();
    b.calculateFromState();
    expect(warnings.length).toBe(1); // only warned once for the same {2XL} set
  });

  test('standard sizes (no hardcoded default) never trigger a fallback warning', () => {
    const cls = loadBuilderClass();
    const b = makeBuilder(cls); // empty product.sizeUpcharges, only standard M/L/XL priced
    const warnings = [];
    b.showToast = (msg) => warnings.push(msg);

    b.calculateFromState();
    expect(b._upchargeFallbackSizes.size).toBe(0);
    expect(warnings.length).toBe(0);
  });
});
