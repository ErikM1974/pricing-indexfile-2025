/**
 * Staff calculators — Rule 3 extraction locks (2026-09-06).
 *   dtf / dtg / embroidery / cap-embroidery-integrated / digitizingform / monogramform / laser-manual carried
 *   inline <style> (up to 1,250 lines) and inline <script> (up to 1,416 lines) blocks, hardcoded proxy hosts,
 *   `onload=` handlers, bare icons and unversioned assets. Now: calculators/css/<page>.css + calculators/js/<page>-page.js,
 *   APP_CONFIG host, gated logging, inline role=alert instead of alert(), icons decorative, assets versioned.
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const exists = (rel) => fs.existsSync(path.join(ROOT, rel));
const strip = (h) => h.replace(/<!--[\s\S]*?-->/g, '');
const BARE = /<i class="(?:fa[sr]|fab|fa-solid|fa-regular) [^"]*"><\/i>/;
const HOST = /caspio-pricing-proxy-ab30/;
const PAGES = ['dtf-pricing', 'dtg-pricing', 'embroidery-pricing', 'cap-embroidery-pricing-integrated', 'digitizingform', 'monogramform', 'laser-manual-pricing'];

describe('calculator pages — Rule 3', () => {
    test.each(PAGES)('%s', (pg) => {
        const html = strip(read(`calculators/${pg}.html`));
        expect(html).not.toMatch(/<style[\s>]/);
        expect(html).not.toMatch(/<script>\s*[^\s<]/);
        expect(html).not.toMatch(/\son(click|error|change|submit|input|load)=/);
        expect(html).not.toMatch(BARE);
        expect(html).not.toMatch(HOST);
        expect(html).not.toMatch(/(href|src)="\/(?!config\/app\.config\.js)[^"?]+\.(css|js)"/);
        if (['digitizingform', 'monogramform'].includes(pg)) {
            expect(html).toContain('data-ui="unified"');
            expect(html).toContain('/shared_components/css/components.css?v=');
            expect(html).toContain('/shared_components/css/customer-intake.css?v=');
            expect(read('shared_components/css/components.css')).toMatch(/\[hidden\]\s*\{\s*display: none;/);
        } else if (pg === 'laser-manual-pricing') {
            // The unified laser page inherits hidden-state behavior from the
            // shared component layer instead of duplicating an !important rule.
            expect(html).toContain('data-ui="unified"');
            expect(html).toContain('/shared_components/css/components.css?v=');
            expect(html).toContain('/shared_components/css/calculator-reference.css?v=');
            expect(html).toContain(`/calculators/css/${pg}.css?v=`);
            expect(read('shared_components/css/components.css')).toMatch(/\[hidden\]\s*\{\s*display: none;/);
        } else {
            expect(html).toContain(`/calculators/css/${pg}.css?v=`);
            expect(html).toContain('data-ui="unified"');
            expect(html).toContain('/shared_components/css/components.css?v=');
            expect(html).toContain('/shared_components/css/core-calculators.css?v=');
            expect(read('shared_components/css/components.css')).toMatch(/\[hidden\]\s*\{\s*display: none;/);
        }
        if (exists(`calculators/js/${pg}-page.js`)) {
            expect(html).toContain(`/calculators/js/${pg}-page.js?v=`);
            const js = read(`calculators/js/${pg}-page.js`);
            expect(js).not.toMatch(HOST);
            expect(js).not.toMatch(/console\.log\(/);
            expect(js).not.toMatch(/\balert\(/);
            if (/_API_BASE/.test(js)) {
                expect(js).toMatch(/_LOG_ON \? console\.log\.bind\(console\)/);
                expect(js).toMatch(/_API_BASE = \(window\.APP_CONFIG && window\.APP_CONFIG\.API && window\.APP_CONFIG\.API\.BASE_URL\) \|\| '';/);
                expect(html).toMatch(/<script src="\/config\/app\.config\.js"><\/script>/);
            }
        }
    });
    test('embroidery uses canonical components, common calculator styles, then its scoped owner', () => {
        const html = read('calculators/embroidery-pricing.html');
        const order = ['components.css', 'core-calculators.css', 'embroidery-pricing.css'];
        const indexes = order.map(file => html.indexOf('/' + file + '?v='));
        indexes.forEach(index => expect(index).toBeGreaterThan(-1));
        for (let i = 1; i < indexes.length; i++) expect(indexes[i]).toBeGreaterThan(indexes[i - 1]);
        expect(html).not.toContain('/embroidery-pricing-overrides.css');
    });
    test('digitizing form iframe load is a listener', () => {
        expect(read('calculators/digitizingform.html')).not.toMatch(/onload=/);
        expect(read('calculators/js/digitizingform-page.js')).toMatch(/digiFrame\.addEventListener\('load', hideLoading\)/);
    });
    test('dtf/dtg failures are inline alerts', () => {
        expect(read('calculators/js/dtf-pricing-page.js')).toMatch(/dtfInlineAlert\('Failed to load manual pricing mode/);
        expect(read('calculators/js/dtg-pricing-page.js')).toMatch(/dtgInlineAlert\('DTG Pricing Error: ' \+ message\)/);
    });
});
