/**
 * Shared calculator components — 2026-09-06 locks.
 *   screenprint-pricing-v2 / calculator-inventory / manual-mode-indicator / pricing-pages / dp5-helper /
 *   dtg-page-setup / universal-image-gallery / universal-header-component: no hardcoded proxy host (APP_CONFIG,
 *   visible when missing), no injected <style> (real stylesheets linked by the consumer pages), no inline
 *   handlers, icons decorative, console.log gated. pricing-pages no longer carries a duplicate of the inventory
 *   IIFE nor the unused "backup host". Every consumer page loads app.config.js in <head>, before any of them.
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const BARE = /<i class="(?:fa[sr]|fab|fa-solid|fa-regular) [^"]*"><\/i>/;
const HOST = /caspio-pricing-proxy/;
const J = 'shared_components/js/';
const SHARED = ['screenprint-pricing-v2.js', 'calculator-inventory.js', 'manual-mode-indicator.js', 'pricing-pages.js', 'dp5-helper.js', 'dtg-page-setup.js', 'universal-image-gallery.js', 'universal-header-component.js'];
const PAGES = ['screen-print-pricing', 'dtf-pricing', 'dtg-pricing', 'embroidery-pricing', 'cap-embroidery-pricing-integrated'];

describe('shared calculator scripts', () => {
    test.each(SHARED)('%s', (f) => {
        const js = read(J + f);
        expect(js).not.toMatch(HOST);
        expect(js).not.toMatch(/createElement\('style'\)/);
        expect(js).not.toMatch(/onclick=/);
        expect(js).not.toMatch(BARE);
        expect(js).not.toMatch(/<i class="fas \$\{[^}]+\}"><\/i>/);
        expect(js).not.toMatch(/console\.log\(/);
    });
    test('hosts come from APP_CONFIG and fail visibly', () => {
        for (const f of ['screenprint-pricing-v2.js', 'calculator-inventory.js', 'pricing-pages.js', 'dp5-helper.js', 'dtg-page-setup.js']) {
            const js = read(J + f);
            expect(js).toMatch(/\(window\.APP_CONFIG && window\.APP_CONFIG\.API && window\.APP_CONFIG\.API\.BASE_URL\) \|\| ''/);
            expect(js).toMatch(/APP_CONFIG\.API\.BASE_URL missing/);
        }
    });
    test('pricing-pages: no duplicate inventory IIFE, no backup host, no cart notification', () => {
        const js = read(J + 'pricing-pages.js');
        expect(js).not.toMatch(/window\.loadCalculatorInventory = function/);
        expect(js).not.toMatch(/FALLBACK_API_BASE_URL|usingFallbackApi/);
        expect(js).not.toMatch(/showSuccessWithViewCartButton|cart-notification-styles/);
        expect(read(J + 'calculator-inventory.js')).toMatch(/window\.loadCalculatorInventory = function/);
    });
    test('delegated handlers replace the inline ones', () => {
        expect(read(J + 'calculator-inventory.js')).toMatch(/data-calc-inv-toggle role="button" tabindex="0"/);
        expect(read(J + 'calculator-inventory.js')).toMatch(/closest\('\[data-calc-inv-toggle\]'\)/);
        expect(read(J + 'manual-mode-indicator.js')).toMatch(/closest\('\.manual-mode-exit'\)/);
        expect(read(J + 'screenprint-pricing-v2.js')).toMatch(/class="sp-error-dismiss" aria-label="Dismiss"/);
    });
    test('screen-print v2: the tier strip and every fee label come from the API tiers (2026-09-06)', () => {
        // Live Caspio had moved to 24-47 (+$50) / 48-71 ($0) while the UI still said 24-36 (+$75) / 37-71 (+$50):
        // the engine priced from the API, the buttons and "$X ÷ qty" hints did not. Never type a tier or a fee here again.
        const js = read('shared_components/js/screenprint-pricing-v2.js');
        expect(js).toMatch(/renderTierButtons\(\)\s*\{/);
        expect(js).toMatch(/id="sp-tier-list"/);
        expect(js).toMatch(/LTM_Fee/);
        expect(js).not.toMatch(/sp-tier-24-36|sp-qty-tier-1|Small Batch Fee<\/small>\s*<\/button>\s*\n\s*<!--/);
        expect(js).not.toMatch(/\$75 Small Batch|\$50 Small Batch|\(75 \/ clamped\)|\(50 \/ clamped\)|'24-36'|'37-71'/);
        expect(js).toMatch(/map\['GRT-50'\]/); // art-setup tooltip amount from Service_Codes
    });

    test('DTG calculator: tier strip from the API tiers, sub-24 priced through the canonical engine (2026-09-06)', () => {
        // Caspio split the DTG LTM row into 1-11 (fee) and 12-23 (none); the page still typed "Less than 24 + $50"
        // and priced every sub-24 quantity as 24-47 + $50 — disagreeing with Quick Quote and the builders.
        const html = read('calculators/dtg-pricing.html');
        expect(html).toMatch(/id="dtg-tier-list"/);
        expect(html).not.toMatch(/data-tier="1-23"|Less than 24 pieces|\$50 Small Batch|\$50 ÷ 12/);
        const js = read('calculators/js/dtg-pricing-page.js');
        expect(js).toMatch(/function renderTierButtons\(\)/);
        expect(js).toMatch(/DTGCanonicalPricing\.ltmPerUnit\(/);
        expect(js).toMatch(/DTGCanonicalPricing\.priceForLocationCombo\(/);
        expect(js).not.toMatch(/'1-23'|'24-47' : tierLabel|Less than 24|: 50\.00/);
    });

    test('DTF adapter: a stored sessionStorage copy never overrides the API garment cost (2026-09-06)', () => {
        // `Object.assign(data, parsedData, data)` overwrote the fresh $3 with a stored 0 and then "restored" from
        // the already-overwritten object — every DTF calculator load after the first in a tab priced at $0.00.
        const js = read('shared_components/js/dtf-adapter.js');
        expect(js).not.toMatch(/Object\.assign\(data, parsedData, data\)/);
        expect(js).toMatch(/if \(!\(parseFloat\(stored\.garmentCost\) > 0\)\) delete stored\.garmentCost;/);
        expect(js).toMatch(/Object\.assign\(data, stored, fresh\);/);
    });

    test('the extracted stylesheets exist', () => {
        expect(read('shared_components/css/calculator-inventory.css')).toMatch(/\.calc-inv-bar \{/);
        expect(read('shared_components/css/manual-mode-indicator.css')).toMatch(/\.manual-mode-banner/);
        expect(read('shared_components/css/screenprint-pricing-v2.css')).toMatch(/@keyframes spin/);
    });
});

describe('consumer pages', () => {
    test.each(PAGES)('%s loads app.config.js in <head> before every shared script and links the stylesheets', (pg) => {
        const html = read(`calculators/${pg}.html`);
        const head = html.indexOf('</head>');
        const cfg = html.indexOf('/config/app.config.js');
        expect(cfg).toBeGreaterThan(-1);
        expect(cfg).toBeLessThan(head);
        expect((html.match(/\/config\/app\.config\.js/g) || []).length).toBe(1);
        for (const f of SHARED) {
            const i = html.indexOf('/shared_components/js/' + f);
            if (i > -1) expect(i).toBeGreaterThan(cfg);
        }
        expect(html).toContain('/shared_components/css/calculator-inventory.css?v=');
        expect(html).toContain('/shared_components/css/manual-mode-indicator.css?v=');
        if (pg === 'screen-print-pricing') expect(html).toContain('/shared_components/css/screenprint-pricing-v2.css?v=');
    });
});
