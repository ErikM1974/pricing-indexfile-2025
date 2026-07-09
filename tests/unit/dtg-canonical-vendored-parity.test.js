/**
 * DTG canonical engine — vendored-copy BYTE parity (Batch 6, 2026-07-09).
 *
 * THE one DTG formula lives in caspio-pricing-proxy/lib/dtg-canonical-pricing.js
 * (UMD). This repo vendors it byte-identical at
 * shared_components/js/dtg-canonical-pricing.js (window.DTGCanonicalPricing);
 * dtg-pricing-service.js + dtg-inline-form.js delegate ALL math to it.
 * This test replaces the old "DO NOT diverge" comments: any one-sided edit
 * fails CI here (and in the proxy's mirror test). Fix = edit the proxy file,
 * re-copy, re-run both suites.
 */
const fs = require('fs');
const path = require('path');

const VENDORED = path.join(__dirname, '../../shared_components/js/dtg-canonical-pricing.js');
const PROXY = path.join(__dirname, '../../../caspio-pricing-proxy/lib/dtg-canonical-pricing.js');

describe('vendored dtg-canonical-pricing.js', () => {
  test('BYTE-IDENTICAL to the proxy canonical (skip if sibling repo absent)', () => {
    if (!fs.existsSync(PROXY)) {
      console.warn('[vendored-parity] sibling caspio-pricing-proxy not checked out — skipping byte assertion');
      return;
    }
    expect(fs.readFileSync(VENDORED, 'utf8')).toBe(fs.readFileSync(PROXY, 'utf8'));
  });

  test('loads as CJS with the full surface (UMD)', () => {
    const m = require(VENDORED);
    for (const k of ['FALLBACK_MARGIN_DENOM', 'roundUpToHalfDollar', 'tierForCombinedQty', 'ltmPerUnit', 'priceForLocationCombo', 'priceLines']) {
      expect(m[k]).toBeDefined();
    }
    expect(m.roundUpToHalfDollar(12.01)).toBe(12.5);
    expect(m.ltmPerUnit({ LTM_Fee: 50 }, 12)).toBe(4.16);
  });

  test('exposes window.DTGCanonicalPricing in a browser-like scope (UMD)', () => {
    const src = fs.readFileSync(VENDORED, 'utf8');
    const win = {};
    new Function('window', src)(win); // no `module` param → browser branch
    expect(typeof win.DTGCanonicalPricing.priceForLocationCombo).toBe('function');
  });
});
