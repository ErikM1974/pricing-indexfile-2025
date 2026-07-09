/**
 * DTF single money pipeline — A-grade Batch 1.3 regression lock.
 *
 * updateTaxCalculation() (dtf-quote-page.js) used to re-implement the whole
 * fee/discount/tax pipeline and DRIFTED from the class copy (empty tax field
 * fell back to 10.1% on screen vs 10.2% in save/print). Locks the collapse:
 * the page function renders ONLY what DTFQuoteBuilder.calculateFromState() →
 * computeFeesAndTotals() returns, and contains no arithmetic of its own.
 */
const fs = require('fs');
const path = require('path');

// Batch 4.3: dtf-quote-page.js migrated into the bundle — the render-only
// updateTaxCalculation now lives in builders/dtf/page-ui.js (ES module).
const esbuild = require('esbuild');
const PAGE_SRC = fs.readFileSync(
  path.join(__dirname, '../../shared_components/js/builders/dtf/page-ui.js'),
  'utf8'
);
const BUNDLED = esbuild.buildSync({
  entryPoints: [path.join(__dirname, '../../shared_components/js/builders/dtf/page-ui.js')],
  bundle: true,
  format: 'cjs',
  target: 'es2020',
  write: false,
  logLevel: 'silent',
}).outputFiles[0].text;

function el(props) {
  return Object.assign(
    {
      value: '',
      textContent: '',
      checked: false,
      hidden: true,
      style: {},
      dataset: {},
      addEventListener: () => {},
    },
    props || {}
  );
}

function loadPage(win) {
  const registry = win.__els;
  const doc = {
    addEventListener: () => {},
    // Auto-create unknown ids: the classic script wires top-level listeners
    // (e.g. save-success-modal @1428) that aren't under test here.
    getElementById: (id) => registry[id] || (registry[id] = el()),
    querySelector: () => null,
    querySelectorAll: () => [],
    createElement: () => el(),
    body: el(),
  };
  const quiet = { log() {}, warn() {}, error() {}, info() {} };
  const moduleObj = { exports: {} };
  const factory = new Function('module', 'exports', 'window', 'document', 'console', BUNDLED);
  factory(moduleObj, moduleObj.exports, win, doc, quiet);
  return moduleObj.exports;
}

function makeWindow(els) {
  return {
    APP_CONFIG: { API: { BASE_URL: 'http://test/api' } },
    ExtendedSizesConfig: {}, // page hard-requires it at load (dtf-quote-page.js:444)
    __els: els,
  };
}

describe('updateTaxCalculation delegates to the class pipeline (Batch 1.3)', () => {
  test('renders exactly what computeFeesAndTotals returns', () => {
    const els = {
      'pre-tax-subtotal': el(),
      'tax-row': el(),
      'tax-amount': el(),
      'grand-total-with-tax': el(),
      'tax-rate-label': el(),
      'tax-rate-input': el({ value: '10.2' }),
      'sidebar-total-bar': el(),
      'sidebar-grand-total': el(),
    };
    const win = makeWindow(els);
    const stateCalc = { subtotal: 111 };
    const totals = {
      preTaxSubtotal: 130.5,
      includeTax: true,
      taxRatePct: 10.2,
      taxAmount: 13.31,
      grandTotal: 143.81,
    };
    win.dtfQuoteBuilder = {
      calculateFromState: jest.fn(() => stateCalc),
      computeFeesAndTotals: jest.fn(() => totals),
    };

    const { updateTaxCalculation } = loadPage(win);
    updateTaxCalculation();

    expect(win.dtfQuoteBuilder.computeFeesAndTotals).toHaveBeenCalledWith(stateCalc);
    expect(els['pre-tax-subtotal'].textContent).toBe('$130.50');
    expect(els['tax-amount'].textContent).toBe('$13.31');
    expect(els['grand-total-with-tax'].textContent).toBe('$143.81');
    expect(els['tax-rate-label'].textContent).toBe('Sales Tax (10.2%)');
    expect(els['sidebar-grand-total'].textContent).toBe('$143.81');
    expect(els['sidebar-total-bar'].hidden).toBe(false);
  });

  test('no builder yet (boot window) → silent no-op, no throw', () => {
    const els = { 'grand-total-with-tax': el() };
    const { updateTaxCalculation } = loadPage(makeWindow(els));
    expect(() => updateTaxCalculation()).not.toThrow();
    expect(els['grand-total-with-tax'].textContent).toBe('');
  });

  test('source ratchet: the page function does NO math of its own', () => {
    const m = PAGE_SRC.match(/function updateTaxCalculation\(\)[\s\S]*?\n\}/);
    expect(m).not.toBeNull();
    const body = m[0].replace(/\/\/.*$/gm, ''); // comments may narrate history; code may not
    expect(body).toMatch(/computeFeesAndTotals/);
    expect(body).toMatch(/calculateFromState/);
    // The drift class-of-bug: any re-introduced local pipeline shows up as one of these.
    expect(body).not.toMatch(/10\.1|10\.2|parseRatePercent|Math\.round|Math\.max/);
  });
});
