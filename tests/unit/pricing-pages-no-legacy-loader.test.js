/**
 * pricing-pages.js — the legacy runtime script loader is gone (2026-09-06).
 *   It used to loadScript() cart.js / cart-integration.js / pricing-matrix-capture.js / pricing-calculator.js /
 *   add-to-cart.js / order-form-pdf.js at runtime; cart.js was force-skipped and half the files no longer existed.
 *   Calculators load what they need with their own <script> tags. The dead root files are deleted.
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

test('no runtime loader and no cart.js reference in pricing-pages.js', () => {
    const js = read('shared_components/js/pricing-pages.js');
    expect(js).not.toMatch(/function loadScript\(/);
    expect(js).not.toMatch(/loadScript\('/);
    expect(js).not.toMatch(/NWCACart/);
    expect(js).toMatch(/window\.dispatchEvent\(new CustomEvent\('productColorsReady'/); // the contract the calculators rely on
});

test('the dead cart-era root files stay deleted', () => {
    for (const f of ['cart.js', 'order-form-pdf.js', 'cart-price-recalculator.js', 'cart-integration.js', 'add-to-cart.js', 'pricing-matrix-capture.js']) {
        expect(fs.existsSync(path.join(ROOT, f))).toBe(false);
    }
});

test('both calculators version pricing-pages.js', () => {
    expect(read('calculators/screen-print-pricing.html')).toMatch(/pricing-pages\.js\?v=2026\./);
    expect(read('calculators/dtf-pricing.html')).toMatch(/pricing-pages\.js\?v=2026\./);
});
