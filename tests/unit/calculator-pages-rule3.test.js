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
        } else {
            expect(html).toContain(`/calculators/css/${pg}.css?v=`);
            expect(read(`calculators/css/${pg}.css`)).toMatch(/\[hidden\] \{ display: none !important; \}/);
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
    test('embroidery keeps its cascade: overrides file linked after the in-between stylesheet', () => {
        const html = read('calculators/embroidery-pricing.html');
        const a = html.indexOf('/calculators/css/embroidery-pricing.css?v=');
        const b = html.indexOf('/calculators/css/embroidery-pricing-overrides.css?v=');
        expect(a).toBeGreaterThan(-1);
        expect(b).toBeGreaterThan(a);
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
