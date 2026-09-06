/**
 * Screen Print Pricing calculator — 2026-09-06 review locks.
 *   The page carried a 1,100-line inline <style> and two inline <script> blocks (447 + 410 lines) with a
 *   hardcoded proxy host, 67 console.log lines, forced-visibility style hacks and 6 inline display:none.
 *   Now: CSS in calculators/css/screen-print-pricing.css, JS in calculators/js/screen-print-pricing-{product,page}.js,
 *   proxy host from APP_CONFIG, logging gated (SP_DEBUG), hidden attribute + guard, every asset versioned.
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const BARE = /<i class="(?:fa[sr]|fab|fa-solid|fa-regular) [^"]*"><\/i>/;
const strip = (h) => h.replace(/<!--[\s\S]*?-->/g, '');

describe('screen-print-pricing.html', () => {
    const html = strip(read('calculators/screen-print-pricing.html'));
    test('Rule 3: no inline style/script, no handlers, no inline styles, assets versioned', () => {
        expect(html).not.toMatch(/<style[\s>]/);
        expect(html).not.toMatch(/<script>\s*[^\s<]/);
        expect(html).not.toMatch(/\son(click|error|change|submit|input|load)=/);
        expect(html).not.toMatch(/ style="(?!--)/);
        expect(html).not.toMatch(/(href|src)="\/(?!config\/app\.config\.js)[^"?]+\.(css|js)"/);
        expect(html).not.toMatch(BARE);
        expect(html).not.toMatch(/caspio-pricing-proxy-ab30/);
    });
    test('script order: config → product script → pricing-pages → … → v2 → page script', () => {
        const order = ['/config/app.config.js', '/calculators/js/screen-print-pricing-product.js', '/shared_components/js/pricing-pages.js',
            '/shared_components/js/screenprint-pricing-v2.js', '/calculators/js/screen-print-pricing-page.js'];
        const idx = order.map((o) => html.indexOf(o));
        idx.forEach((i) => expect(i).toBeGreaterThan(-1));
        for (let i = 1; i < idx.length; i++) expect(idx[i]).toBeGreaterThan(idx[i - 1]);
    });
    test('hidden attribute on the six formerly display:none regions', () => {
        for (const id of ['productImage', 'imageThumbnails', 'colorSwatchesSection', 'caspio-iframe-container']) {
            expect(html).toMatch(new RegExp('id="' + id + '"[^>]* hidden>'));
        }
        expect(read('calculators/css/screen-print-pricing.css')).toMatch(/\[hidden\] \{ display: none !important; \}/);
    });
});

describe('screen-print page scripts', () => {
    const product = read('calculators/js/screen-print-pricing-product.js');
    const page = read('calculators/js/screen-print-pricing-page.js');
    test('proxy host from APP_CONFIG, no console.log, hidden toggles, no forced-visibility hacks, no alert', () => {
        for (const js of [product, page]) {
            expect(js).not.toMatch(/caspio-pricing-proxy-ab30/);
            expect(js).not.toMatch(/console\.log\(/);
            expect(js).toMatch(/var spLog = SP_DEBUG \? console\.log\.bind\(console\) : function \(\) \{\};/);
            expect(js).not.toMatch(/\.style\.(display|visibility|opacity|zIndex)/);
            expect(js).not.toMatch(/\balert\(/);
            expect(js).not.toMatch(BARE);
        }
        expect(product).toMatch(/var SP_API_BASE = \(window\.APP_CONFIG && window\.APP_CONFIG\.API && window\.APP_CONFIG\.API\.BASE_URL\) \|\| '';/);
        expect(product).toMatch(/swatch\.style\.setProperty\('--swatch'/);
        expect(product).toMatch(/class="sp-inline-alert" role="alert"/);
        expect(page).toMatch(/window\.SCREENPRINT_DEBUG = \{/); // the console helpers survive, just gated
    });
});
