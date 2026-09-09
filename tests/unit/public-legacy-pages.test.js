/**
 * Public legacy pages — Rule 3 extraction locks (2026-09-05).
 *   inventory-details, dtg-compatible-products, pricing-negotiation-policy carried
 *   whole <style> and <script> blocks plus inline onclick=/onerror= handlers on PUBLIC pages;
 *   design-view carried 4 inline handlers and display toggles. All moved to /pages/css + /pages/js,
 *   handlers replaced by listeners, proxy host taken from APP_CONFIG, icons decorative.
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const BARE = /<i class="(?:fa[sr]|fab|fa-solid|fa-regular) [^"]*"><\/i>/;
const strip = (h) => h.replace(/<!--[\s\S]*?-->/g, '').replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/g, '');

const PAGES = {
    'inventory-details': { css: 'pages/css/inventory-details.css', js: 'pages/js/inventory-details.js' },
    'dtg-compatible-products': { css: 'pages/css/dtg-compatible-products.css', js: 'pages/js/dtg-compatible-products.js' },
    'pricing-negotiation-policy': { css: 'pages/css/pricing-negotiation-policy.css', js: 'pages/js/pricing-negotiation-policy.js' },
    'design-view': { css: 'shared_components/css/design-preview-tools.css', js: 'pages/js/design-view.js' },
};

describe('public legacy pages — Rule 3', () => {
    test.each(Object.keys(PAGES))('%s', (name) => {
        const html = strip(read(`pages/${name}.html`));
        const { css, js } = PAGES[name];
        expect(html).not.toMatch(/<style[\s>]/);
        expect(html).not.toMatch(/<script(?: type="module")?>\s*[^\s<]/); // no inline script with content
        expect(html).not.toMatch(/\son(click|error|change|submit|input|keyup|scroll)=/);
        expect(html).toContain(css + '?v=');
        expect(html).toContain(js + '?v=');
        expect(html).not.toMatch(BARE);
        if (html.includes('data-ui="unified"')) {
            expect(html).toContain('/shared_components/css/components.css?v=');
            expect(read('shared_components/css/components.css')).toMatch(/\[hidden\]\s*\{[^}]*display:\s*none;/);
            expect(read(css)).not.toMatch(/!important/);
        } else expect(read(css)).toMatch(/\[hidden\] \{ display: none !important; \}/);
        const code = read(js);
        expect(code).not.toMatch(/onclick=/);
        expect(code.replace(/data-onerror/g, '')).not.toMatch(/onerror=/);
        expect(code).not.toMatch(/console\.log\(/);
    });
});

describe('public legacy pages — specifics', () => {
    test('dtg-compatible-products: proxy from APP_CONFIG, honest empty state, keyboard cards', () => {
        const html = read('pages/dtg-compatible-products.html');
        const js = read('pages/js/dtg-compatible-products.js');
        expect(html).toMatch(/<script src="\/config\/app\.config\.js"><\/script>/);
        expect(html).not.toMatch(/caspio-pricing-proxy-ab30/);
        expect(js).toMatch(/const API_BASE = \(window\.APP_CONFIG && window\.APP_CONFIG\.API && window\.APP_CONFIG\.API\.BASE_URL\)/);
        expect(js).toMatch(/Products could not be loaded/);
        expect(js).toMatch(/card\.setAttribute\('role', 'link'\);/);
        expect(js).toMatch(/data-onerror="fallback"/);
        expect(html).toMatch(/id="productsGrid" hidden>/);
        expect(html).not.toMatch(/style="/);
        expect(js).not.toMatch(/\.style\.display/);
    });
    test('inventory-details: disclosure pricing menu, keyboard colours, escaped search results', () => {
        const html = read('pages/inventory-details.html');
        const js = read('pages/js/inventory-details.js');
        expect(html).toMatch(/class="btn-pricing" aria-haspopup="true" aria-expanded="false" aria-controls="pricing-dropdown-menu"/);
        expect((html.match(/data-pricing="/g) || []).length).toBe(5);
        expect(html).toMatch(/<script type="module" src="\/pages\/js\/inventory-details\.js\?v=/);
        expect(js).toMatch(/option\.setAttribute\('aria-pressed'/);
        expect(js).toMatch(/<button type="button" class="search-result-item" data-style="\$\{esc\(styleNumber\)\}">/);
        expect(js).not.toMatch(/(?<!data-)style="/);
        expect(js).not.toMatch(/.style.background/);
        expect(html).toMatch(/<h1 id="header-product-name"/);
    });
    test('design-view: dialog lightbox with focus return, hidden attr, keyboard hero/grid', () => {
        const html = read('pages/design-view.html');
        const js = read('pages/js/design-view.js');
        const dialog = new (require('jsdom').JSDOM)(html).window.document.getElementById('dv-lightbox');
        expect(dialog.getAttribute('role')).toBe('dialog');
        expect(dialog.getAttribute('aria-modal')).toBe('true');
        expect(dialog.getAttribute('aria-label')).toBeTruthy();
        expect(dialog.hidden).toBe(true);
        expect(html).toMatch(/<button type="button" class="dv-hero-btn" id="dv-hero-btn"/);
        expect(html).not.toMatch(/style="/);
        expect(js).toMatch(/lightboxReturnFocus = document\.activeElement;/);
        expect(js).toMatch(/<button type="button" class="dv-grid-item" data-url=/);
        expect(js).not.toMatch(/\.style\.(display|overflow)/);
    });
});
