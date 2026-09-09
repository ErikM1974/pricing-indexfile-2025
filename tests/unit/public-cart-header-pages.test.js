/**
 * Public cart pages + JS-rendered shared components — 2026-09-06 review locks.
 *   universal-cart-header.js no longer injects a <style> block (it is a real stylesheet, linked by the page);
 *   its cart indicator is a link with no inline handler/style, badge via hidden. sample-cart: proxy host from
 *   APP_CONFIG (no silent fallback), hidden toggles, remove/reload via delegated listeners, icons decorative,
 *   render-error card via classes. quote-cart: no fallback host. PDP modules: inventory print button wired by
 *   listener, safety-stripe swatches via --swatch, cart drawer close named.
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const BARE = /<i class="(?:fa[sr]|fab|fa-solid|fa-regular) [^"]*"><\/i>/;
const HOST = /caspio-pricing-proxy-ab30/;

describe('universal cart header component', () => {
    const js = read('shared_components/js/universal-cart-header.js');
    test('no injected <style>, no inline handler/style, badge via hidden, icons decorative', () => {
        expect(js).not.toMatch(/<style>/);
        expect(js).toMatch(/return '';\s*\}/);
        expect(js).not.toMatch(/onclick=/);
        expect(js).not.toMatch(/style="/);
        expect(js).not.toMatch(/\.style\.(display|animation)/);
        expect(js).toMatch(/badge\.hidden = !\(this\.cartCount > 0\);/);
        expect(js).toMatch(/<a class="\$\{cartIndicatorClass\}" href=/);
        expect(js).not.toMatch(BARE);
        expect(fs.existsSync(path.join(ROOT, 'shared_components/css/universal-cart-header.css'))).toBe(false);
        expect(read('shared_components/css/components.css')).toMatch(/\[hidden\]\s*\{[^}]*display:\s*none;/);
        expect(read('shared_components/css/product-detail-tools.css')).toContain('.universal-header');
    });
    test('its one consumer links shared style ownership and versions every asset', () => {
        const html = read('pages/dtg-compatible-products.html');
        expect(html).toContain('/shared_components/css/components.css?v=');
        expect(html).toContain('/shared_components/css/product-detail-tools.css?v=');
        expect(html).not.toMatch(/(href|src)="\/(?!config\/app\.config\.js)[^"?]+\.(css|js)"/);
    });
});

describe('sample cart', () => {
    const js = read('pages/js/sample-cart-page.js');
    test('APP_CONFIG host, hidden toggles, delegated controls, icons, no console.log', () => {
        expect(js).not.toMatch(HOST);
        expect(js).toMatch(/const apiBase = \(window\.APP_CONFIG && window\.APP_CONFIG\.API && window\.APP_CONFIG\.API\.BASE_URL\) \|\| '';/);
        expect(js).not.toMatch(/\.style\.display/);
        expect(js).not.toMatch(/onclick=/);
        expect(js).toMatch(/<button type="button" class="item-remove" data-remove="\$\{index\}" aria-label="Remove \$\{escText\(/);
        expect(js).toMatch(/e\.target\.closest\('\[data-remove\]'\)/);
        expect(js).toMatch(/class="alert alert-danger sc-render-error" role="alert"/);
        expect(js).not.toMatch(BARE);
        expect(js).not.toMatch(/console\.log\(/);
        expect(read('pages/sample-cart.html')).toMatch(/id="shipping-section" class="form-block shipping-address-section" hidden>/);
        expect(read('pages/css/sample-cart.css')).toMatch(/\[hidden\] \{ display: none !important; \}/);
        expect(read('pages/css/sample-cart.css')).toMatch(/\.sc-render-error \{/);
    });
});

describe('quote cart + PDP modules', () => {
    test('quote-cart: no fallback host', () => {
        const js = read('pages/js/quote-cart-page.js');
        expect(js).not.toMatch(HOST);
        expect(js).toMatch(/APP_CONFIG\.API\.BASE_URL missing/);
    });
    test('inventory print button via listener', () => {
        const js = read('product/components/inventory.js');
        expect(js).not.toMatch(/onclick=/);
        expect(js).toMatch(/e\.target\.closest\('\.print-inventory'\)/);
    });
    test('safety-stripe swatches via --swatch; drawer close named', () => {
        expect(read('shared_components/js/safety-stripe-recs.js')).not.toMatch(/style="background/);
        expect(read('shared_components/js/safety-stripe-recs.js')).toMatch(/style="--swatch:/);
        // the fallback became a token on 2026-09-07 (CSS standardization: no raw hex outside tokens.css)
        expect(read('shared_components/css/safety-stripe-recs.css')).toMatch(/\.ssr-swatch \{\s*background: var\(--swatch, (?:#ddd|var\(--[a-z0-9-]+\))\);\s*\}/);
        expect(read('shared_components/js/cart-drawer.js')).toMatch(/id="drawer-close" aria-label="Close cart"/);
        expect(read('shared_components/js/cart-drawer.js')).not.toMatch(BARE);
    });
});
