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

  // inventorylevels is the standing example of a path that must NOT be forwarded:
  // /calculators/laser-tumbler-polarcamel.html is customer-facing (server.js says so
  // outright: "Do NOT blanket-gate /calculators"), so it has no staff session and the
  // same-origin forwarder would 401 on every anonymous visitor. It therefore stays a
  // direct proxy call, and the proxy keeps that route ungated.
  test('non-forwardable path (inventorylevels) goes straight to the proxy — never /api/mo', async () => {
    await moFetch('inventorylevels?PartNumber=PC54');
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe('https://proxy.example/api/manageorders/inventorylevels?PartNumber=PC54');
  });

  // 2026-08-10 security fix. These four answered the public internet — the proxy gates
  // /orders, /lineitems, /tracking and /auth, but the router mounts at /api, so nothing
  // else in that file was covered. Verified live: GET /api/manageorders/customers
  // returned ~85 KB including ContactEmail and ContactPhone with no credentials.
  // If any of these stops routing through /api/mo the proxy gate starts 401ing real
  // staff pages, so this test is the canary for that.
  describe.each([
    ['customers', 'customers'],
    ['payments', 'payments'],
    ['payments/142552', 'payments/142552'],
    ['getorderno/ABC-1', 'getorderno/ABC-1'],
    ['order/ABC-1/snapshot', 'order/ABC-1/snapshot'],
  ])('PII read %s', (path, expectedSuffix) => {
    test('goes through the staff-gated same-origin forwarder first', async () => {
      await moFetch(path);
      expect(calls[0].url).toBe('/api/mo/' + expectedSuffix);
      expect(calls[0].opts.credentials).toBe('same-origin');
    });
  });
});
