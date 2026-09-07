/**
 * product-seo-head.test.js — the product-page SEO head reads the proxy's compact
 * /api/product-heads/:style record, never /api/product-details.
 *
 * WHY THIS EXISTS (2026-09-07)
 * Search-engine crawlers (Semrush, Amazonbot, Googlebot, bingbot) walk every
 * /product.html?style= URL overnight at ~50 pages an hour. headForStyle() used
 * to fetch /api/product-details per page — a full every-colour read of the
 * 251k-row Sanmar_Bulk table at Caspio, ~1,000–1,500 calls a day, all for bots.
 * /api/product-heads serves the same fields from a whole-catalog map the proxy
 * builds with ONE query per 24 h. This locks:
 *   • the URL is /api/product-heads/<style> and product-details is never touched
 *   • a repeat call inside the TTL is served from memory (no second fetch)
 *   • a 404 is a quiet null — no product-details fallback, no error log — so a
 *     junk ?style= a crawler invents cannot buy itself a Caspio read
 *   • any other failure is a null head and IS logged (fail-open, visible)
 */

jest.mock('node-fetch', () => jest.fn());

const HEAD_ROW = {
  STYLE: 'PC54',
  PRODUCT_TITLE: 'Port & Co Core Cotton Tee. PC54',
  BRAND_NAME: 'Port & Co',
  PRODUCT_DESCRIPTION: 'An indispensable t-shirt in our classic silhouette.',
  CATEGORY_NAME: 'T-Shirts',
  PRODUCT_IMAGE: 'https://cdnm.sanmar.com/imglib/mresjpg/PC54.jpg',
  FRONT_MODEL: 'https://cdnm.sanmar.com/imglib/mresjpg/PC54_black_model_front.jpg',
  source: 'sanmar',
};

const okResponse = (body) => ({ ok: true, status: 200, json: async () => body });
const errResponse = (status) => ({ ok: false, status, json: async () => ({}) });

let fetch;
let productSeo;
let errorSpy;
beforeEach(() => {
  // Fresh module registry per test = fresh headCache. The mock must be
  // re-required AFTER the reset so it is the instance product-seo.js binds to.
  jest.resetModules();
  fetch = require('node-fetch');
  fetch.mockReset();
  productSeo = require('../../lib/product-seo');
  errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => errorSpy.mockRestore());

test('reads /api/product-heads/<style>, never /api/product-details, and builds the head from it', async () => {
  fetch.mockResolvedValue(okResponse(HEAD_ROW));
  const head = await productSeo.headForStyle('pc54');
  expect(fetch).toHaveBeenCalledTimes(1);
  const [url, opts] = fetch.mock.calls[0];
  expect(url).toMatch(/\/api\/product-heads\/PC54$/);
  expect(url).not.toMatch(/product-details/);
  expect(opts.signal).toBeDefined(); // timeout-guarded
  expect(head.title).toBe('Port & Co Core Cotton Tee (PC54) — Custom Screen Printed & DTG | Northwest Custom Apparel');
  expect(head.description).toMatch(/^An indispensable t-shirt in our classic silhouette\. — decorated in-house/);
  expect(head.image).toBe(HEAD_ROW.FRONT_MODEL);
  expect(head.canonical).toBe('https://www.teamnwca.com/product.html?style=PC54');
  expect(head.jsonLd).toMatchObject({ '@type': 'Product', sku: 'PC54', brand: { name: 'Port & Co' } });
  expect(head.jsonLd.offers).toBeUndefined(); // no price in schema, ever
});

test('a repeat call inside the TTL is served from memory', async () => {
  fetch.mockResolvedValue(okResponse(HEAD_ROW));
  const a = await productSeo.headForStyle('PC54');
  const b = await productSeo.headForStyle('PC54');
  expect(b).toEqual(a);
  expect(fetch).toHaveBeenCalledTimes(1);
});

test('a 404 is a quiet null: no product-details fallback, nothing logged', async () => {
  fetch.mockResolvedValue(errResponse(404));
  expect(await productSeo.headForStyle('NOPE99')).toBeNull();
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(fetch.mock.calls[0][0]).toMatch(/\/api\/product-heads\/NOPE99$/);
  expect(errorSpy).not.toHaveBeenCalled();
});

test('any other failure is a null head and is logged', async () => {
  fetch.mockResolvedValue(errResponse(502));
  expect(await productSeo.headForStyle('PC54')).toBeNull();
  expect(errorSpy).toHaveBeenCalledTimes(1);
  expect(errorSpy.mock.calls[0][0]).toMatch(/head fetch failed for PC54/);
  expect(fetch).toHaveBeenCalledTimes(1);
});

test('a malformed style never reaches the proxy', async () => {
  expect(await productSeo.headForStyle("PC54'; DROP")).toBeNull();
  expect(fetch).not.toHaveBeenCalled();
});
