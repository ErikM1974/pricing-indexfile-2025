/**
 * Stored-XSS regression test for the SHARED invoice/PDF generator (audit P0-1, 2026-06-06).
 *
 * The generated invoice HTML is written to a print window via document.write, so ANY customer-
 * controlled field interpolated raw is a stored XSS that executes when a rep prints the quote —
 * and this generator backs ALL four builders (EMB/DTG/DTF/SCP). The fix added a private esc() and
 * wrapped every user field. This test renders deliberately-malicious customer data through the REAL
 * generator and asserts no live payload (raw <tag> or unescaped event handler) survives.
 *
 * The generator is a browser global with no module.exports, so we load it the same way
 * invoice-totals.test.js does — evaluate the file with window/document injected.
 */
const fs = require('fs');
const path = require('path');

function loadGenerator() {
  const code = fs.readFileSync(path.join(__dirname, '../../shared_components/js/embroidery-quote-invoice.js'), 'utf8');
  const win = { APP_CONFIG: { API: { BASE_URL: 'http://test/api' }, EMAIL: { PUBLIC_KEY: 'test_public_key', SERVICE_ID: 'test_service', TEMPLATES: { QUOTE_SHARE: 'test_template' } }, COMPANY: { NAME: 'Test Shop', PHONE: '000-000-0000', PHONE_DISPLAY: '(000) 000-0000', EMAIL: 'test@shop.test', WEBSITE: 'www.shop.test', LOGO_URL: 'http://test/logo.png', ADDRESS: { STREET: '1 Test St', CITY: 'Testville', STATE: 'WA', ZIP: '00000' } } } };
  const doc = { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [] };
  // eslint-disable-next-line no-new-func
  const factory = new Function('window', 'document', code + '\nreturn window.EmbroideryInvoiceGenerator;');
  return factory(win, doc);
}

const Generator = loadGenerator();
const XSS = '<img src=x onerror="alert(1)">';
const PD = { quoteId: 'T1', grandTotal: 100, preTaxSubtotal: 100, taxRate: 0.101, products: [] };

describe('EmbroideryInvoiceGenerator — esc() (P0-1)', () => {
  const g = new Generator();
  test('escapes the 5 HTML-significant characters', () => {
    expect(g.esc('<>&"\'')).toBe('&lt;&gt;&amp;&quot;&#39;');
  });
  test('null/undefined → empty string; plain text untouched', () => {
    expect(g.esc(null)).toBe('');
    expect(g.esc(undefined)).toBe('');
    expect(g.esc('Smith & Co')).toBe('Smith &amp; Co');   // legit ampersand still renders correctly
    expect(g.esc("O'Brien")).toBe('O&#39;Brien');          // legit apostrophe preserved
  });
});

describe('EmbroideryInvoiceGenerator — no XSS payload survives rendering (P0-1)', () => {
  // The escaped form of XSS is "&lt;img src=x onerror=&quot;alert(1)&quot;&gt;" — so the raw
  // "<img" and raw 'onerror="alert(1)"' must NOT appear anywhere in the generated HTML.
  const assertClean = (html) => {
    expect(html).not.toContain('<img src=x onerror');     // no raw injected tag
    expect(html).not.toContain('onerror="alert(1)"');     // no live event handler
  };

  test('malicious customer NAME is escaped', () => {
    const html = new Generator().generateInvoiceHTML(PD, { name: XSS, customerName: XSS, salesRepEmail: '' });
    assertClean(html);
    expect(html).toContain('&lt;img src=x');              // escaped form is present (it rendered, just safely)
  });

  test('malicious company / email / phone / PO / notes are all escaped', () => {
    const html = new Generator().generateInvoiceHTML(PD, {
      name: 'Acme', company: XSS, email: XSS, phone: XSS, poNumber: XSS, notes: XSS, salesRepEmail: '',
    });
    assertClean(html);
  });

  test('malicious billing + shipping ADDRESS lines are escaped', () => {
    const addr = { address: XSS, city: XSS, state: 'WA', zip: '98354' };
    const html = new Generator().generateInvoiceHTML(PD, {
      name: 'Acme', salesRepEmail: '', billing: addr, shipping: { ...addr, method: XSS },
    });
    assertClean(html);
  });

  test('malicious sales-rep email is escaped', () => {
    const html = new Generator().generateInvoiceHTML(PD, { name: 'Acme', salesRepEmail: XSS });
    assertClean(html);
  });

  test('no raw <script> or <img can appear for ANY combination of poisoned fields', () => {
    const html = new Generator().generateInvoiceHTML(PD, {
      name: '<script>x</script>', company: '<script>y</script>', email: XSS, phone: XSS,
      poNumber: XSS, notes: '<script>z</script>', salesRepEmail: XSS,
      billing: { address: XSS, city: XSS, state: 'WA', zip: '98354' },
    });
    expect(html).not.toMatch(/<script/i);
    expect(html).not.toMatch(/<img\s+src=x\s+onerror/i);
  });

  test('malicious discountReason in pricingData is escaped (B6, 2026-06-06)', () => {
    const html = new Generator().generateInvoiceHTML(
      { quoteId: 'T', grandTotal: 100, discount: 50, discountReason: XSS, preTaxSubtotal: 100, taxRate: 0.101, products: [] },
      { name: 'Acme', salesRepEmail: '' }
    );
    assertClean(html);
  });
});
