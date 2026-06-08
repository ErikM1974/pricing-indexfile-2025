/**
 * Regression lock for shared_components/js/quote-order-summary.js (Phase 0, DTF/SCP parity).
 *
 * Locks the byte-structure of the shared Order Recap + Ship-To card so the module never silently
 * diverges from the EMB flagship it was extracted from. Renders through the EMB selector config
 * (#ship-*, #company-name, etc.) — the same config embroidery-quote-builder.js installs in production.
 *
 * Loads the module into a jsdom window via window.eval (matches emb-edit-reload-roundtrip's harness —
 * no jest-environment-jsdom dependency).
 */
const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

const SRC = fs.readFileSync(path.join(__dirname, '..', '..', 'shared_components', 'js', 'quote-order-summary.js'), 'utf8');

const FIELDS = `
  <div id="order-recap"></div>
  <div id="ship-to-card"></div>
  <input id="company-name">
  <input id="customer-name">
  <input id="customer-number">
  <span id="it-shipping-amt"></span>
  <input id="ship-address">
  <input id="ship-city">
  <input id="ship-state">
  <input id="ship-zip">
  <input id="ship-method">
  <input id="shipping-fee" value="0">
  <input type="checkbox" id="ship-residential">
  <input id="primary-position">
`;

function setup(logos) {
  const dom = new JSDOM(`<!DOCTYPE html><html><body>${FIELDS}</body></html>`, { runScripts: 'outside-only', pretendToBeVisual: true });
  const { window } = dom;
  window.eval(SRC);
  window.QuoteOrderSummary.configure({
    orderRecap: '#order-recap', shipToCard: '#ship-to-card',
    ship: { address: '#ship-address', city: '#ship-city', state: '#ship-state', zip: '#ship-zip', method: '#ship-method', fee: '#shipping-fee', residential: '#ship-residential' },
    recap: { company: '#company-name', name: '#customer-name', custNum: '#customer-number', shippingDisplay: '#it-shipping-amt', logos: () => (logos || []) },
    estimate: () => null, reestimateOnclick: 'reestimateShipFromCard()', editOnclick: 'openShippingModal()',
  });
  return window;
}
const setV = (w, id, v) => { w.document.getElementById(id).value = v; };
const html = (w, id) => w.document.getElementById(id).innerHTML;

describe('Ship-To card', () => {
  test('hidden for Customer Pickup even with an address', () => {
    const w = setup();
    setV(w, 'ship-method', 'Customer Pickup'); setV(w, 'ship-address', '123 Main');
    w.QuoteOrderSummary.renderShipToCard();
    expect(html(w, 'ship-to-card')).toBe('');
  });
  test('hidden when no address/city/zip', () => {
    const w = setup();
    setV(w, 'ship-method', 'UPS Ground');
    w.QuoteOrderSummary.renderShipToCard();
    expect(html(w, 'ship-to-card')).toBe('');
  });
  test('renders company, address, city line, method + both action buttons', () => {
    const w = setup();
    setV(w, 'company-name', 'Acme Co'); setV(w, 'ship-address', '2025 Freeman Rd E');
    setV(w, 'ship-city', 'Milton'); setV(w, 'ship-state', 'WA'); setV(w, 'ship-zip', '98354');
    setV(w, 'ship-method', 'UPS Ground'); setV(w, 'shipping-fee', '30');
    w.QuoteOrderSummary.renderShipToCard();
    const h = html(w, 'ship-to-card');
    expect(h).toContain('<div class="st-title">Ship To</div>');
    expect(h).toContain('<div class="st-line st-co">Acme Co</div>');
    expect(h).toContain('<div class="st-line">2025 Freeman Rd E</div>');
    expect(h).toContain('<div class="st-line">Milton, WA 98354</div>');
    expect(h).toContain('class="st-line st-method"');
    expect(h).toContain('UPS Ground');
    expect(h).toContain('$30.00');
    expect(h).toContain('class="st-btn st-btn-reest"');
    expect(h).toContain('onclick="reestimateShipFromCard()"');
    expect(h).toContain('onclick="openShippingModal()"');
  });
  test('appends boxes/zone ONLY when the estimate still equals the fee', () => {
    const w = setup();
    setV(w, 'ship-address', '1 A St'); setV(w, 'ship-method', 'UPS Ground'); setV(w, 'shipping-fee', '42.5');
    w._lastShipEstimate = { estimate: 42.5, boxes: 3, zone: 4 };
    w.QuoteOrderSummary.renderShipToCard();
    const h = html(w, 'ship-to-card');
    expect(h).toContain('3 boxes');
    expect(h).toContain('zone 4');
  });
  test('no boxes/zone once the fee is manually overridden (≠ estimate)', () => {
    const w = setup();
    setV(w, 'ship-address', '1 A St'); setV(w, 'ship-method', 'UPS Ground'); setV(w, 'shipping-fee', '99');
    w._lastShipEstimate = { estimate: 42.5, boxes: 3, zone: 4 };
    w.QuoteOrderSummary.renderShipToCard();
    expect(html(w, 'ship-to-card')).not.toContain('boxes');
  });
  test('escapes < > & in the company name (no raw injection)', () => {
    const w = setup();
    setV(w, 'company-name', '<b>&x'); setV(w, 'ship-address', '1 A St'); setV(w, 'ship-method', 'UPS Ground');
    w.QuoteOrderSummary.renderShipToCard();
    const h = html(w, 'ship-to-card');
    expect(h).toContain('&lt;b&gt;');
    expect(h).not.toContain('<b>&x</');
  });
});

describe('Order Recap', () => {
  test('empty when there is no data', () => {
    const w = setup();
    w.QuoteOrderSummary.renderOrderRecap();
    expect(html(w, 'order-recap')).toBe('');
  });
  test('renders customer (+ number), shipping, a single logo + its thumbnail', () => {
    const w = setup([{ text: '#19074 Left Chest', thumbUrl: 'http://x/y.png', label: '#19074' }]);
    setV(w, 'company-name', 'Acme Co'); setV(w, 'customer-number', '6326');
    w.document.getElementById('it-shipping-amt').textContent = 'UPS Ground';
    w.QuoteOrderSummary.renderOrderRecap();
    const h = html(w, 'order-recap');
    expect(h).toContain('<div class="or-title">Order at a glance</div>');
    expect(h).toContain('Acme Co');
    expect(h).toContain('#6326');
    expect(h).toContain('<span class="or-label">Shipping</span><span class="or-val">UPS Ground</span>');
    expect(h).toContain('<span class="or-label">Logo</span>');
    expect(h).toContain('#19074 Left Chest');
    expect(h).toContain('class="or-thumb"');
    expect(h).toContain('src="http://x/y.png"');
  });
  test('"Logos" pluralizes with 2+ logos; thumb omitted when no thumbUrl', () => {
    const w = setup([{ text: '#1', thumbUrl: '', label: '#1' }, { text: 'Cap #2', thumbUrl: '', label: 'Cap #2' }]);
    setV(w, 'company-name', 'Acme');
    w.QuoteOrderSummary.renderOrderRecap();
    const h = html(w, 'order-recap');
    expect(h).toContain('<span class="or-label">Logos</span>');
    expect(h).not.toContain('or-thumb');
  });
  test('falls back to customer-name when company is blank', () => {
    const w = setup();
    setV(w, 'customer-name', 'Jane Rep');
    w.QuoteOrderSummary.renderOrderRecap();
    expect(html(w, 'order-recap')).toContain('Jane Rep');
  });
});

describe('getShipFields accessor (selector-agnostic linchpin)', () => {
  test('reads values through the configured selectors', () => {
    const w = setup();
    setV(w, 'ship-zip', '98354'); setV(w, 'ship-method', 'UPS Ground'); setV(w, 'shipping-fee', '30');
    w.document.getElementById('ship-residential').checked = true;
    const f = w.QuoteOrderSummary.getShipFields();
    expect(f.zip).toBe('98354');
    expect(f.method).toBe('UPS Ground');
    expect(f.fee).toBe(30);
    expect(f.residential).toBe(true);
  });
});
