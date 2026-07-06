#!/usr/bin/env node
/**
 * seed-top-sellers.js — one-time seed of Caspio IsTopSeller flags
 * (top-sellers consolidation, 2026-07-06)
 *
 * The retired pages/top-sellers-showcase.html displayed a STATIC grid of 68
 * styles; the new /catalog?topSellers=1 view is driven by the Caspio
 * IsTopSeller flag (Sanmar_Bulk_251816_Feb2024). This seeds the flag for the
 * exact styles the old page showed, via the proxy's existing admin endpoint.
 * Erik curates from then on by toggling IsTopSeller in Caspio — no deploy.
 *
 * Run:    node tools/seed-top-sellers.js
 * Undo:   POST /api/admin/products/clear-topsellers (clears ALL flags)
 *
 * Safe to re-run (idempotent PUT). Styles not carried in Sanmar_Bulk are
 * reported as notFound and skipped (e.g. Richardson factory-direct caps).
 */
require('dotenv').config(); // /api/admin/products/* is X-CRM-API-Secret gated
const API = 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';
const SECRET = process.env.CRM_API_SECRET;
if (!SECRET) {
  console.error('CRM_API_SECRET not set (needed for the admin endpoint) — add it to .env');
  process.exit(1);
}

// Extracted from the retired showcase's completeTopSellers grid (git 5d9547bb~1)
const STYLES = [
  'PC54', 'PC450', 'PC61', 'PC78H', 'PC55', 'PC61LS', 'PC600', 'BC3001',
  'PC54LS', 'CTK87', 'C112', '112', 'NE1000', 'C110', 'CP90', 'C826', 'C114',
  'C912', 'TM1MU423', 'CP85', 'C865', 'CP82', 'NKDC1963', 'CT104670', 'EB532',
  '267020', 'CT100617', 'ST253', 'CTK121', 'CT103828', 'CT89176508', 'ST650',
  'CT104597', 'EB550', 'CT102286', 'ST850', 'PC90H', '18500', '996M', '5186',
  'PC55P', 'CS204', '5180', 'DT6100', 'PC43', 'PC340', 'PC330', 'DT6000',
  'DT6200', 'DT106', 'DM108', 'DT184', 'DT8000', 'DM130', 'DT2101', 'DT6065',
  'PC380', 'ST350', 'ST490', 'K200', 'K500', 'K240', 'CS450', 'MM1014',
  'DT6150', 'DT7800', 'STC39', 'STC54'
];

(async () => {
  const resp = await fetch(`${API}/api/admin/products/mark-as-topseller`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-CRM-API-Secret': SECRET },
    body: JSON.stringify({ styles: STYLES })
  });
  const data = await resp.json();
  if (!resp.ok || !data.success) {
    console.error('FAILED:', resp.status, data);
    process.exit(1);
  }
  console.log(data.message);
  if (data.stylesNotFound && data.stylesNotFound.length) {
    console.log('Not in Sanmar_Bulk (skipped):', data.stylesNotFound.join(', '));
  }
  const check = await fetch(`${API}/api/products/search?limit=1&isTopSeller=true`);
  console.log('Search-filter check:', check.status,
    check.ok ? `total=${(await check.json()).data?.pagination?.total}` : '(deploy the proxy isTopSeller fix first — d3f1868)');
})();
