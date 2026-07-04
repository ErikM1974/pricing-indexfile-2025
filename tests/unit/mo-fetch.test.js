/**
 * mo-fetch.js — same-origin-first, proxy-fallback ManageOrders read helper.
 * Verifies the migration-safety contract: a repointed caller can never break a page.
 */
const path = require('path');

describe('moFetch — same-origin-first with proxy fallback', () => {
  let moFetch, calls;

  beforeEach(() => {
    jest.resetModules();
    calls = [];
    global.APP_CONFIG = { API: { BASE_URL: 'https://proxy.example' } };
    // default: same-origin forwarder succeeds
    global.fetch = jest.fn((url, opts) => {
      calls.push({ url, opts });
      return Promise.resolve({ ok: true, url });
    });
    moFetch = require(path.join(__dirname, '..', '..', 'shared_components', 'js', 'mo-fetch.js')).moFetch;
  });

  afterEach(() => { delete global.fetch; delete global.APP_CONFIG; });

  test('forwardable path hits the same-origin /api/mo/* first (with credentials)', async () => {
    await moFetch('orders/12345');
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe('/api/mo/orders/12345');
    expect(calls[0].opts.credentials).toBe('same-origin');
  });

  test('lineitems + query strings are forwarded too', async () => {
    await moFetch('lineitems/9');
    await moFetch('orders?id_Customer=2792&date_Ordered_start=x');
    expect(calls[0].url).toBe('/api/mo/lineitems/9');
    expect(calls[1].url).toBe('/api/mo/orders?id_Customer=2792&date_Ordered_start=x');
  });

  test('401 from the forwarder (customer context) falls back to the direct proxy', async () => {
    global.fetch = jest.fn((url) => {
      calls.push({ url });
      if (url.startsWith('/api/mo/')) return Promise.resolve({ ok: false, status: 401 });
      return Promise.resolve({ ok: true, url });
    });
    const r = await moFetch('orders/5');
    expect(calls.map(c => c.url)).toEqual(['/api/mo/orders/5', 'https://proxy.example/api/manageorders/orders/5']);
    expect(r.ok).toBe(true);
  });

  test('network error reaching the forwarder falls back to the proxy', async () => {
    global.fetch = jest.fn((url) => {
      calls.push({ url });
      if (url.startsWith('/api/mo/')) return Promise.reject(new Error('network'));
      return Promise.resolve({ ok: true, url });
    });
    const r = await moFetch('orders/5');
    expect(calls[1].url).toBe('https://proxy.example/api/manageorders/orders/5');
    expect(r.ok).toBe(true);
  });

  test('non-forwardable path (customers) goes straight to the proxy — never /api/mo', async () => {
    await moFetch('customers');
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe('https://proxy.example/api/manageorders/customers');
  });
});
