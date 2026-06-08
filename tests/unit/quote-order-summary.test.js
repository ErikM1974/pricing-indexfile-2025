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

function setup(logos, opts) {
  opts = opts || {};
  const dom = new JSDOM(`<!DOCTYPE html><html><body>${FIELDS}</body></html>`, { runScripts: 'outside-only', pretendToBeVisual: true });
  const { window } = dom;
  window.eval(SRC);
  const cfg = {
    orderRecap: '#order-recap', shipToCard: '#ship-to-card',
    ship: { address: '#ship-address', city: '#ship-city', state: '#ship-state', zip: '#ship-zip', method: '#ship-method', fee: '#shipping-fee', residential: '#ship-residential' },
    recap: { company: '#company-name', name: '#customer-name', custNum: '#customer-number', shippingDisplay: '#it-shipping-amt', logos: () => (logos || []) },
    reestimateOnclick: 'reestimateShipFromCard()',
  };
  if (!opts.noEstimate) cfg.estimate = () => null;            // EMB-like: estimator present -> Re-estimate shows
  if (!opts.noEdit) cfg.editOnclick = 'openShippingModal()';  // EMB-like: editor present -> Edit shows
  window.QuoteOrderSummary.configure(cfg);
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
  test('hides Re-estimate + Edit when the builder supplies no estimator/editor (DTF-like config)', () => {
    const w = setup(null, { noEstimate: true, noEdit: true });
    setV(w, 'company-name', 'Acme Co'); setV(w, 'ship-address', '1 A St'); setV(w, 'ship-method', 'UPS Ground');
    w.QuoteOrderSummary.renderShipToCard();
    const h = html(w, 'ship-to-card');
    expect(h).not.toContain('st-actions');
    expect(h).not.toContain('Re-estimate');
    expect(h).not.toContain('>Edit<');
    expect(h).toContain('<div class="st-line st-co">Acme Co</div>');
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

// ---- DTF integration: the ACTUAL DTF selector config (fee=#dtf-shipping-fee, no shippingDisplay, no estimator) ----
const DTF_FIELDS = `
  <div id="order-recap"></div>
  <div id="ship-to-card"></div>
  <input id="company-name">
  <input id="customer-name">
  <input id="customer-number">
  <input id="ship-address">
  <input id="ship-city">
  <input id="ship-state">
  <input id="ship-zip">
  <input id="ship-method">
  <input id="dtf-shipping-fee" value="0">
`;
function setupDTF() {
  const dom = new JSDOM(`<!DOCTYPE html><html><body>${DTF_FIELDS}</body></html>`, { runScripts: 'outside-only', pretendToBeVisual: true });
  const { window } = dom;
  window.eval(SRC);
  window.QuoteOrderSummary.configure({
    orderRecap: '#order-recap', shipToCard: '#ship-to-card',
    ship: { address: '#ship-address', city: '#ship-city', state: '#ship-state', zip: '#ship-zip', method: '#ship-method', fee: '#dtf-shipping-fee' },
    recap: { company: '#company-name', name: '#customer-name', custNum: '#customer-number' },
    // no shippingDisplay, no logos, no estimate, no editOnclick — DTF Phase 2
  });
  return window;
}

describe('DTF config (selector-agnostic: #dtf-shipping-fee, no shippingDisplay, no estimator)', () => {
  test('recap shows Customer (+#) but NO Shipping row (shippingDisplay omitted)', () => {
    const w = setupDTF();
    w.document.getElementById('company-name').value = 'DTF Co';
    w.document.getElementById('customer-number').value = '1234';
    w.QuoteOrderSummary.renderOrderRecap();
    const h = w.document.getElementById('order-recap').innerHTML;
    expect(h).toContain('DTF Co');
    expect(h).toContain('#1234');
    expect(h).not.toContain('Shipping');
    expect(h).not.toContain('Logo');
  });
  test('ship-to card reads #dtf-shipping-fee + renders NO action buttons', () => {
    const w = setupDTF();
    w.document.getElementById('ship-address').value = '1 A St';
    w.document.getElementById('ship-method').value = 'Ground';
    w.document.getElementById('dtf-shipping-fee').value = '25';
    w.QuoteOrderSummary.renderShipToCard();
    const h = w.document.getElementById('ship-to-card').innerHTML;
    expect(h).toContain('1 A St');
    expect(h).toContain('Ground');
    expect(h).toContain('$25.00');
    expect(h).not.toContain('st-actions');
    expect(h).not.toContain('Re-estimate');
  });
  test('ship-to card hides on Customer Pickup', () => {
    const w = setupDTF();
    w.document.getElementById('ship-address').value = '1 A St';
    w.document.getElementById('ship-method').value = 'Customer Pickup';
    w.QuoteOrderSummary.renderShipToCard();
    expect(w.document.getElementById('ship-to-card').innerHTML).toBe('');
  });
});

// ---- SCP integration: CLASS-based .os-ship-* selectors SCOPED to #spc-order-fields (the real selector-agnostic test) ----
const SCP_FIELDS = `
  <div id="order-recap"></div>
  <div id="ship-to-card"></div>
  <input id="company-name">
  <input id="customer-name">
  <input id="customer-number">
  <div id="spc-order-fields">
    <input class="os-ship-address">
    <input class="os-ship-city">
    <input class="os-ship-state">
    <input class="os-ship-zip">
    <input class="os-ship-method">
    <input class="os-shipping-fee" value="0">
  </div>
`;
function setupSCP() {
  const dom = new JSDOM(`<!DOCTYPE html><html><body>${SCP_FIELDS}</body></html>`, { runScripts: 'outside-only', pretendToBeVisual: true });
  const { window } = dom;
  window.eval(SRC);
  window.QuoteOrderSummary.configure({
    orderRecap: '#order-recap', shipToCard: '#ship-to-card',
    ship: { address: '#spc-order-fields .os-ship-address', city: '#spc-order-fields .os-ship-city', state: '#spc-order-fields .os-ship-state', zip: '#spc-order-fields .os-ship-zip', method: '#spc-order-fields .os-ship-method', fee: '#spc-order-fields .os-shipping-fee' },
    recap: { company: '#company-name', name: '#customer-name', custNum: '#customer-number' },
  });
  return window;
}
const scpq = (w, sel) => w.document.querySelector('#spc-order-fields ' + sel);

describe('SCP config (selector-agnostic: scoped .os-ship-* classes, no estimator)', () => {
  test('recap shows Customer (+#) but NO Shipping/Logo rows', () => {
    const w = setupSCP();
    w.document.getElementById('company-name').value = 'SCP Co';
    w.document.getElementById('customer-number').value = '7788';
    w.QuoteOrderSummary.renderOrderRecap();
    const h = w.document.getElementById('order-recap').innerHTML;
    expect(h).toContain('SCP Co');
    expect(h).toContain('#7788');
    expect(h).not.toContain('Shipping');
    expect(h).not.toContain('Logo');
  });
  test('ship-to card reads SCOPED .os-ship-* / .os-shipping-fee + NO action buttons', () => {
    const w = setupSCP();
    scpq(w, '.os-ship-address').value = '1 A St';
    scpq(w, '.os-ship-city').value = 'Milton';
    scpq(w, '.os-ship-state').value = 'WA';
    scpq(w, '.os-ship-zip').value = '98354';
    scpq(w, '.os-ship-method').value = 'Ground';
    scpq(w, '.os-shipping-fee').value = '40';
    w.QuoteOrderSummary.renderShipToCard();
    const h = w.document.getElementById('ship-to-card').innerHTML;
    expect(h).toContain('1 A St');
    expect(h).toContain('Milton, WA 98354');
    expect(h).toContain('Ground');
    expect(h).toContain('$40.00');
    expect(h).not.toContain('st-actions');
    expect(h).not.toContain('Re-estimate');
  });
  test('ship-to card hides on Customer Pickup', () => {
    const w = setupSCP();
    scpq(w, '.os-ship-address').value = '1 A St';
    scpq(w, '.os-ship-method').value = 'Customer Pickup';
    w.QuoteOrderSummary.renderShipToCard();
    expect(w.document.getElementById('ship-to-card').innerHTML).toBe('');
  });
  test('getShipFields resolves the SCOPED selectors uniquely', () => {
    const w = setupSCP();
    scpq(w, '.os-ship-zip').value = '98354';
    scpq(w, '.os-shipping-fee').value = '40';
    const f = w.QuoteOrderSummary.getShipFields();
    expect(f.zip).toBe('98354');
    expect(f.fee).toBe(40);
  });
  test('card empties once the ship fields are blanked (reset path — must clear .os-ship-* explicitly)', () => {
    const w = setupSCP();
    scpq(w, '.os-ship-address').value = '2025 Freeman Rd E';
    scpq(w, '.os-ship-method').value = 'Ground';
    w.QuoteOrderSummary.renderShipToCard();
    expect(w.document.getElementById('ship-to-card').innerHTML).toContain('2025 Freeman Rd E'); // populated
    ['.os-ship-address', '.os-ship-city', '.os-ship-zip', '.os-ship-method'].forEach(s => { scpq(w, s).value = ''; });
    w.QuoteOrderSummary.renderShipToCard();
    expect(w.document.getElementById('ship-to-card').innerHTML).toBe(''); // empty after blanking → no stale address
  });
});

// ---- Shipping estimator (box-math lifted byte-for-byte from EMB — money path; lock the weight/box calc) ----
function setupEst(products) {
  const dom = new JSDOM(`<!DOCTYPE html><html><body>
    <div id="order-recap"></div><div id="ship-to-card"></div>
    <input id="company-name"><input id="customer-name"><input id="customer-number">
    <input id="ship-address" value="1 A St"><input id="ship-city" value="Milton">
    <input id="ship-state" value="WA"><input id="ship-zip" value="98354">
    <input id="ship-method" value="Ground"><input id="shipping-fee" value="0">
    <input type="checkbox" id="ship-residential">
    <button id="est-btn"></button><div id="est-result"></div>
  </body></html>`, { runScripts: 'outside-only', pretendToBeVisual: true });
  const { window } = dom;
  window.eval(SRC);
  window._boxDensity = undefined; window._shipWtCache = undefined; window._lastShipEstimate = undefined;
  const calls = [];
  window.fetch = function (url, opts) {
    calls.push({ url: String(url), body: opts && opts.body ? JSON.parse(opts.body) : null });
    const ok = (body) => Promise.resolve({ ok: true, json: () => Promise.resolve(body) });
    if (String(url).includes('box-density')) return ok({ density: {} });
    if (String(url).includes('/api/inventory')) return ok([
      { SIZE: 'S', PIECE_WEIGHT: '0.35', CASE_SIZE: '72', CATEGORY_NAME: 'T-Shirts' },
      { SIZE: 'M', PIECE_WEIGHT: '0.35', CASE_SIZE: '72', CATEGORY_NAME: 'T-Shirts' },
      { SIZE: 'XL', PIECE_WEIGHT: '0.40', CASE_SIZE: '72', CATEGORY_NAME: 'T-Shirts' },
    ]);
    if (String(url).includes('estimate-ups-ground')) return ok({ estimate: 18.5, boxes: 1, zone: 4, billableWeightLb: 15, basis: 'list' });
    return ok({});
  };
  window.QuoteOrderSummary.configure({
    orderRecap: '#order-recap', shipToCard: '#ship-to-card',
    ship: { address: '#ship-address', city: '#ship-city', state: '#ship-state', zip: '#ship-zip', method: '#ship-method', fee: '#shipping-fee', residential: '#ship-residential' },
    recap: { company: '#company-name', name: '#customer-name', custNum: '#customer-number' },
    estimateHooks: { collectProducts: () => products, onApplied: () => {}, btn: '#est-btn', result: '#est-result' },
    apiBase: 'http://proxy.test',
  });
  return { window, calls };
}

describe('Shipping estimator (box-math byte-lock)', () => {
  test('weight + box count from SanMar data, posts the right body, sets fee + _lastShipEstimate', async () => {
    const { window, calls } = setupEst([{ style: 'PC54', sizeBreakdown: { S: 12, M: 24, XL: 6 } }]);
    await window.QuoteOrderSummary.estimateShipping();
    const est = calls.find(c => c.url.includes('estimate-ups-ground'));
    expect(est).toBeTruthy();
    expect(est.body.weightLb).toBeCloseTo(15.0, 5);   // 12*.35 + 24*.35 + 6*.40
    expect(est.body.boxes).toBe(1);                    // 42 pcs / 58 per-box (T-Shirt) = 0.72 → ceil 1
    expect(est.body.boxWeightsLb).toHaveLength(1);
    expect(est.body.boxWeightsLb[0]).toBeCloseTo(15.0, 5);
    expect(est.body.residential).toBe(false);
    expect(window.document.getElementById('shipping-fee').value).toBe('18.50');
    expect(window._lastShipEstimate).toEqual({ estimate: 18.5, boxes: 1, zone: 4, weight: 15 });
  });
  test('estimateHooks auto-lights the ship-to card Re-estimate button', () => {
    const { window } = setupEst([]);
    window.QuoteOrderSummary.renderShipToCard();
    expect(window.document.getElementById('ship-to-card').innerHTML).toContain('Re-estimate');
  });
  test('residential checkbox flows into the request body', async () => {
    const { window, calls } = setupEst([{ style: 'PC54', sizeBreakdown: { M: 10 } }]);
    window.document.getElementById('ship-residential').checked = true;
    await window.QuoteOrderSummary.estimateShipping();
    expect(calls.find(c => c.url.includes('estimate-ups-ground')).body.residential).toBe(true);
  });
  test('skips service / styleless rows — no /api/inventory?styleNumber=undefined', async () => {
    const { window, calls } = setupEst([
      { style: 'PC54', sizeBreakdown: { M: 10 } },
      { isService: true, sizeBreakdown: { SVC: 1 } },
      { style: '', sizeBreakdown: { M: 5 } },
    ]);
    await window.QuoteOrderSummary.estimateShipping();
    const inv = calls.filter(c => c.url.includes('/api/inventory'));
    expect(inv.length).toBe(1);
    expect(inv[0].url).toContain('styleNumber=PC54');
    expect(calls.some(c => c.url.includes('styleNumber=undefined'))).toBe(false);
  });
});
