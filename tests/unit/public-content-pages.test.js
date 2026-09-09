/**
 * Public content families — 2026-09-05/06 review locks.
 *   12 *-webstores pages, golf pages, custom-safety-apparel, laser tumbler calculator, fall catalog,
 *   brands, embroidery contract pricing, resources/sale: icons decorative, no inline handlers, no inline
 *   <style>, `hidden` attribute instead of display toggles, brands proxy host from APP_CONFIG.
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const strip = (h) => h.replace(/<!--[\s\S]*?-->/g, '').replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/g, '');
const BARE = /<i class="(?:fa[sr]|fab|fa-solid|fa-regular) [^"]*"><\/i>/;
const WEBSTORES = fs.readdirSync(path.join(ROOT, 'pages')).filter((f) => /-webstores\.html$/.test(f)).map((f) => 'pages/' + f);
const OTHERS = ['pages/golf-tournaments-2026.html', 'pages/golf-tournament-product.html', 'pages/custom-safety-apparel.html',
    'calculators/laser-tumbler-polarcamel.html', 'pages/fall-catalog-2026.html', 'brands.html',
    'pages/embroidery-contract-pricing.html', 'pages/resources.html', 'pages/sale.html', 'pages/custom-richardson.html'];

describe('content pages — shared hygiene', () => {
    test('12 webstore family pages exist', () => { expect(WEBSTORES.length).toBe(12); });
    test.each([...WEBSTORES, ...OTHERS])('%s', (rel) => {
        const html = strip(read(rel));
        expect(html).not.toMatch(BARE);
        expect(html).not.toMatch(/<style[\s>]/);
        expect(html).not.toMatch(/\son(click|error|change|submit|input)=/);
        expect(html).not.toMatch(/ style="(?!--)/);
        expect(html).not.toMatch(/(href|src)="\/(?!config\/app\.config\.js)[^"?]+\.(css|js)"/);
    });
});

describe('content pages — specifics', () => {
    test('fall catalog clear-filters forwards via data attribute', () => {
        expect(read('pages/fall-catalog-2026.html')).toMatch(/<button class="btn btn-ghost" type="button" data-fc-clear>Clear filters<\/button>/);
        expect(read('pages/js/fall-catalog-2026.js')).toMatch(/querySelectorAll\('\[data-fc-clear\]'\)/);
    });
    test('brands: APP_CONFIG host, hidden toggles, delegated image fallback, no console.log', () => {
        const html = read('brands.html');
        const js = read('brands.js');
        expect(html).toMatch(/<script src="\/config\/app\.config\.js"><\/script>\s*<script src="\/shared_components\/js\/brands-registry\.js/);
        expect(html).toMatch(/id="errorState" class="error-state" role="alert" hidden>/);
        expect(html).toMatch(/id="brandsContainer" class="brands-container" hidden>/);
        expect(html).toMatch(/<button type="button" id="brandsRetry" class="btn-retry">Retry<\/button>/);
        expect(js).not.toMatch(/caspio-pricing-proxy-ab30/);
        expect(js).not.toMatch(/\.style\.display/);
        expect(js.replace(/data-onerror/g, '')).not.toMatch(/onerror=/);
        expect(js).toMatch(/data-onerror="hide"/);
        expect(js).not.toMatch(/console\.log\(/);
        expect(read('brands.css')).toMatch(/\[hidden\] \{ display: none !important; \}/);
    });
    test('embroidery contract pricing: print via listener, hidden content, css versioned', () => {
        const html = read('pages/embroidery-contract-pricing.html');
        const js = read('pages/embroidery-contract-pricing.js');
        expect(html).toMatch(/<button type="button" class="print-btn" id="ecp-print">/);
        expect(html).toMatch(/id="pricingContent" hidden>/);
        expect(js).toMatch(/getElementById\('ecp-print'\)/);
        expect(js).not.toMatch(/\.style\.display/);
        expect(read('pages/embroidery-contract-pricing.css')).toMatch(/\[hidden\] \{ display: none !important; \}/);
    });
    test('resources + sale share one extracted stylesheet and have ONE h1', () => {
        for (const p of ['pages/resources.html', 'pages/sale.html']) {
            const html = read(p);
            expect(html).toContain('/pages/css/simple-notice-page.css?v=');
            expect((html.match(/<h1\b/g) || []).length).toBe(1);
            expect(html).toMatch(/<p class="page-title">/);
            expect(html).toContain('data-ui="unified"');
            expect(html).toContain('/shared_components/css/components.css?v=');
        }
        expect(read('shared_components/css/components.css')).toMatch(/\[hidden\]\s*\{[^}]*display:\s*none;/);
        expect(read('pages/css/simple-notice-page.css')).not.toMatch(/!important/);
    });
    test('laser tumbler: spinner/error via hidden attribute', () => {
        const html = read('calculators/laser-tumbler-polarcamel.html');
        const js = read('shared_components/js/laser-tumbler-simple.js');
        const css = read('shared_components/css/laser-tumbler-simple.css');
        expect(html).toMatch(/<div id="loading-spinner" hidden>/);
        expect(html).toMatch(/<div id="error-message" role="alert" hidden><\/div>/);
        expect(html).toMatch(/id="color-loading" class="color-loading" hidden>/);
        expect(js).not.toMatch(/\.style\.display/);
        expect(js).not.toMatch(BARE);
        expect(read('shared_components/js/laser-tumbler-mockup.js')).not.toMatch(BARE);
        expect(css).toMatch(/\.pricing-table th\.th-center \{ text-align: center; \}/);
        expect(css).toMatch(/\[hidden\] \{ display: none !important; \}/);
        expect(css).not.toMatch(/#loading-spinner \{\n\s*display: none;/);
    });
});
