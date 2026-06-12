/**
 * Regression lock for the 2026-06-11 DTF child-row STATE model (P2 closure).
 *
 * Extended-size child rows (2XL/3XL/XS/talls…) used to live ONLY in the DOM
 * (.cell-qty text + window.childRowMap), forcing calculateFromState() and
 * getTotalQuantity() to parse the DOM — the documented exception to the
 * builder's "calculateFromState never parses DOM" rule. They now live in
 * DTFQuoteBuilder.childRows (Map: childRowId → {parentId, size, qty, baseCost,
 * sizeUpcharges}), written ONLY via registerChildRow()/setChildRowQty()/
 * removeProduct() at the same chokepoints that mutate the DOM
 * (createChildRow / onChildSizeChange / parent-2XL sync / removeChildRow).
 *
 * These tests run the REAL class source against a document stub whose
 * query methods THROW — proving the money path computes child-row totals
 * with zero DOM child rows present (and zero DOM reads at all).
 *
 * Fixture numbers mirror tests/unit/dtf-save-parity.test.js: ST350 @ 5.16
 * base, 0.55 margin, LC+FB transfers 21.50, labor 2.50×2, freight 0.50×2,
 * LTM 2.17/unit → std 39.50, 3XL (+3.00) 42.50, XS 39.50; subtotal 917.50.
 */
const fs = require('fs');
const path = require('path');

function loadBuilderClass() {
  const code = fs.readFileSync(path.join(__dirname, '../../shared_components/js/dtf-quote-builder.js'), 'utf8');
  const win = {};
  // Lenient stubs for load time (the file registers a DOMContentLoaded handler
  // and window.* exports at top level). Tests re-arm these as tripwires.
  const doc = {
    addEventListener: () => {},
    getElementById: () => null,
    querySelector: () => null,
    querySelectorAll: () => [],
  };
  const quietConsole = { log() {}, warn() {}, error() {}, info() {} };
  // eslint-disable-next-line no-new-func
  const factory = new Function('window', 'document', 'console', code + '\nreturn DTFQuoteBuilder;');
  const cls = factory(win, doc, quietConsole);
  return { cls, doc, win };
}

/** Bare instance via prototype (skips the constructor's service wiring). */
function makeBuilder(cls) {
  const b = Object.create(cls.prototype);
  b.products = [{
    id: 1,
    styleNumber: 'ST350',
    description: 'Sport-Tek Competitor Tee',
    baseCost: 5.16,
    sizeUpcharges: { '3XL': 3 },
    quantities: { S: 0, M: 6, L: 6, XL: 6, '2XL': 0 },
  }];
  b.childRows = new Map();
  b.selectedLocations = ['left-chest', 'full-back'];
  b.currentPricingData = {
    tier: '10-23',
    marginDenom: 0.55,
    ltmPerUnit: 2.17,
    totalLtmFee: 50,
    transferBreakdown: { breakdown: [], total: 21.5 },
    laborCostPerLoc: 2.5,
    freightPerTransfer: 0.5,
  };
  // DTF rounding: half-dollar ceil
  b.pricingCalculator = { applyRounding: (p) => Math.ceil(p * 2) / 2 };
  return b;
}

/** Any DOM read during the money path fails the test. */
function armDomTripwire(doc) {
  const boom = (m) => () => { throw new Error(`money path read the DOM via ${m}`); };
  doc.getElementById = boom('getElementById');
  doc.querySelector = boom('querySelector');
  doc.querySelectorAll = boom('querySelectorAll');
}

describe('DTF child-row state model — money paths never parse the DOM (2026-06-11 P2)', () => {
  test('class loads from source', () => {
    expect(typeof loadBuilderClass().cls).toBe('function');
  });

  test('getTotalQuantity counts child rows from JS state with ZERO DOM child rows', () => {
    const { cls, doc } = loadBuilderClass();
    const b = makeBuilder(cls);
    b.registerChildRow(7, { parentId: 1, size: '3XL', qty: 3, baseCost: 5.16, sizeUpcharges: { '3XL': 3 } });
    b.registerChildRow(9, { parentId: 1, size: 'XS', qty: 2, baseCost: 5.16, sizeUpcharges: { '3XL': 3 } });

    armDomTripwire(doc);
    expect(b.getTotalQuantity()).toBe(23); // 18 standard + 3 + 2
  });

  test('calculateFromState prices child rows from JS state with ZERO DOM child rows', () => {
    const { cls, doc } = loadBuilderClass();
    const b = makeBuilder(cls);
    b.registerChildRow(7, { parentId: 1, size: '3XL', qty: 3, baseCost: 5.16, sizeUpcharges: { '3XL': 3 } });
    b.registerChildRow(9, { parentId: 1, size: 'XS', qty: 2, baseCost: 5.16, sizeUpcharges: { '3XL': 3 } });

    armDomTripwire(doc);
    const calc = b.calculateFromState();

    // Standard sizes: 5.16/0.55 + 21.50 + 5.00 + 1.00 + 2.17 = 39.05 → 39.50
    expect(calc.productTotals.get(1).standardUnitPrice).toBeCloseTo(39.5, 2);
    expect(calc.productTotals.get(1).standardTotal).toBeCloseTo(711, 2); // 18 × 39.50

    // childTotals keyed `row-${id}` (unchanged contract for save/print lookups)
    const x3 = calc.childTotals.get('row-7');
    expect(x3).toBeTruthy();
    expect(x3.unitPrice).toBeCloseTo(42.5, 2); // +3.00 upcharge → 42.05 → 42.50
    expect(x3.total).toBeCloseTo(127.5, 2);

    const xs = calc.childTotals.get('row-9');
    expect(xs).toBeTruthy();
    expect(xs.unitPrice).toBeCloseTo(39.5, 2); // XS: no upcharge in API map → 0
    expect(xs.total).toBeCloseTo(79, 2);

    expect(calc.subtotal).toBeCloseTo(917.5, 2); // 711 + 127.50 + 79
  });

  test('legacy XXL alias prices with the 2XL upcharge (alias normalized in getSizeUpcharge)', () => {
    const { cls, doc } = loadBuilderClass();
    const b = makeBuilder(cls);
    // Rows created before the XXXL→3XL key fix can still register as 'XXL'
    b.registerChildRow(5, { parentId: 1, size: 'XXL', qty: 4, baseCost: 5.16, sizeUpcharges: { '2XL': 2 } });

    armDomTripwire(doc);
    const calc = b.calculateFromState();
    // 5.16/0.55 + 2.00 + 21.50 + 5.00 + 1.00 + 2.17 = 41.05 → 41.50
    expect(calc.childTotals.get('row-5').unitPrice).toBeCloseTo(41.5, 2);
    expect(b.getTotalQuantity()).toBe(22); // 18 + 4
  });

  test('setChildRowQty / removeProduct keep state in sync (chokepoint contract)', () => {
    const { cls, doc } = loadBuilderClass();
    const b = makeBuilder(cls);
    b.registerChildRow(7, { parentId: 1, size: '3XL', qty: 3, baseCost: 5.16, sizeUpcharges: { '3XL': 3 } });
    b.registerChildRow(9, { parentId: 1, size: 'XS', qty: 2, baseCost: 5.16, sizeUpcharges: { '3XL': 3 } });

    // onChildSizeChange / applyExtendedSizes / parent-2XL sync chokepoint
    b.setChildRowQty(7, 5);
    // removeChildRow / deleteRow funnel through removeProduct (getElementById
    // stays lenient here: markAsUnsaved touches a display indicator — that's
    // a display write, not a money read)
    doc.querySelector = () => { throw new Error('money path read the DOM'); };
    doc.querySelectorAll = () => { throw new Error('money path read the DOM'); };
    b.removeProduct(9);

    expect(b.getTotalQuantity()).toBe(23); // 18 + 5, XS gone
    const calc = b.calculateFromState();
    expect(calc.childTotals.get('row-7').total).toBeCloseTo(212.5, 2); // 5 × 42.50
    expect(calc.childTotals.has('row-9')).toBe(false);
    expect(calc.subtotal).toBeCloseTo(923.5, 2); // 711 + 212.50
  });

  test('getChildRowsForParent filters by parent and tolerates string/number id mix', () => {
    const { cls } = loadBuilderClass();
    const b = makeBuilder(cls);
    b.registerChildRow(7, { parentId: 1, size: '3XL', qty: 3, baseCost: 5.16, sizeUpcharges: {} });
    b.registerChildRow('8', { parentId: '2', size: '2XL', qty: 6, baseCost: 4.1, sizeUpcharges: {} });

    expect(b.getChildRowsForParent(1).map(c => c.size)).toEqual(['3XL']);
    expect(b.getChildRowsForParent(2).map(c => c.size)).toEqual(['2XL']); // '2' registered → 2 queried
    expect(b.getChildRowsForParent('1').length).toBe(1); // string query → number compare
  });
});
