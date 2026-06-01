/**
 * Regression test for the SHARED invoice/PDF generator total math.
 * Guards the 2026-06-01 fix (workflow wp2s2j3as): the printed GRAND TOTAL must equal
 * the on-screen pre-tax subtotal + tax, with fees/discount folded in. Contract:
 *   - builders pass preTaxSubtotal = the on-screen pre-tax adjusted subtotal
 *   - GRAND TOTAL = (preTaxSubtotal || grandTotal) * (1 + taxRate)
 *   - taxRate normalized (a value > 1 is a percent -> /100)
 *   - includeTax === false suppresses tax entirely
 * The generator is a browser global with no module.exports, so we load it by
 * evaluating the file with window/document injected (environment-agnostic).
 */
const fs = require('fs');
const path = require('path');

function loadGenerator() {
  const code = fs.readFileSync(path.join(__dirname, '../../shared_components/js/embroidery-quote-invoice.js'), 'utf8');
  const win = {};
  const doc = { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [] };
  // eslint-disable-next-line no-new-func
  const factory = new Function('window', 'document', code + '\nreturn window.EmbroideryInvoiceGenerator;');
  return factory(win, doc);
}

function parseTotals(html) {
  const gt = [...html.matchAll(/GRAND TOTAL:<\/span>\s*<span>\$([\d,]+\.\d{2})<\/span>/g)];
  const grand = gt.length ? parseFloat(gt[gt.length - 1][1].replace(/,/g, '')) : null;
  const taxM = html.match(/Sales Tax \([\d.]+%\):<\/span>\s*<span>\$([\d,]+\.\d{2})<\/span>/);
  const tax = taxM ? parseFloat(taxM[1].replace(/,/g, '')) : 0;
  return { grand, tax };
}

const Generator = loadGenerator();
const CUST = { customerName: 'Test Co', salesRepEmail: '' };
const render = (pd) => parseTotals(new Generator().generateInvoiceHTML(pd, CUST));

describe('EmbroideryInvoiceGenerator total math (2026-06-01 PDF regression)', () => {
  test('class loads from the source file', () => {
    expect(typeof Generator).toBe('function');
  });
  test('folds fees + discount into GRAND TOTAL (they were display-only)', () => {
    const { grand, tax } = render({ quoteId: 'T1', grandTotal: 1000, preTaxSubtotal: 1100, artCharge: 75, graphicDesignCharge: 75, rushFee: 50, discount: 100, taxRate: 0.101, products: [] });
    expect(tax).toBeCloseTo(111.10, 2);
    expect(grand).toBeCloseTo(1211.10, 2);
  });
  test('no-fee quote is unchanged (backward compatible)', () => {
    const { grand, tax } = render({ quoteId: 'T2', grandTotal: 300, taxRate: 0.101, products: [] });
    expect(tax).toBeCloseTo(30.30, 2);
    expect(grand).toBeCloseTo(330.30, 2);
  });
  test('normalizes a PERCENT tax rate (SCP/DTF store 10.1, not 0.101)', () => {
    const { grand, tax } = render({ quoteId: 'T3', grandTotal: 510, preTaxSubtotal: 560, rushFee: 50, taxRate: 10.1, products: [] });
    expect(tax).toBeCloseTo(56.56, 2);
    expect(grand).toBeCloseTo(616.56, 2);
  });
  test('taxes the pre-tax base exactly ONCE (no double-tax)', () => {
    const { grand } = render({ quoteId: 'T4', grandTotal: 500, preTaxSubtotal: 500, taxRate: 0.101, products: [] });
    expect(grand).toBeCloseTo(550.50, 2);
  });
  test('includeTax=false adds no tax (tax-exempt)', () => {
    const { grand, tax } = render({ quoteId: 'T5', grandTotal: 1000, preTaxSubtotal: 1100, artCharge: 100, includeTax: false, taxRate: 0.101, products: [] });
    expect(tax).toBe(0);
    expect(grand).toBeCloseTo(1100.00, 2);
  });
  test('renders a Shipping row and folds it into the total (rows foot to GRAND TOTAL)', () => {
    // base 200 + art 50 + shipping 30 = 280 pre-tax; x1.101 = 308.28
    const html = new Generator().generateInvoiceHTML({
      quoteId: 'T6', grandTotal: 200, preTaxSubtotal: 280, artCharge: 50, shippingFee: 30,
      taxRate: 0.101, products: [],
    }, CUST);
    expect(html).toMatch(/Shipping:<\/span>\s*<span>\$30\.00<\/span>/);
    const { grand } = parseTotals(html);
    expect(grand).toBeCloseTo(308.28, 2);
  });
  test('GRAND TOTAL always equals (preTaxSubtotal || grandTotal) x (1 + normalizedRate)', () => {
    const cases = [
      { grandTotal: 1000, preTaxSubtotal: 1234.56, taxRate: 0.101 },
      { grandTotal: 800, taxRate: 0.088 },
      { grandTotal: 800, preTaxSubtotal: 900, taxRate: 0 },
      { grandTotal: 250, preTaxSubtotal: 250, taxRate: 8.8 },
    ];
    for (const c of cases) {
      const base = c.preTaxSubtotal != null ? c.preTaxSubtotal : c.grandTotal;
      const rate = c.taxRate > 1 ? c.taxRate / 100 : c.taxRate;
      const expected = +(base * (1 + rate)).toFixed(2);
      const { grand } = render({ quoteId: 'T', products: [], ...c });
      expect(grand).toBeCloseTo(expected, 2);
    }
  });
});
