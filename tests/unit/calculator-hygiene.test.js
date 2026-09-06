/**
 * Every calculator page — hygiene lock (2026-09-06, the end of the calculator sweep).
 *   No bare icons, no inline handlers, no unversioned assets, no proxy host in HTML; the page scripts carry no
 *   host, no bare icons and no console.log (christmas-bundles' 185 are gated). compare-pricing and
 *   safety-stripe-creator route their former inline handlers through data-call-delegator.js.
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const strip = (h) => h.replace(/<!--[\s\S]*?-->/g, '').replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/g, '');
const BARE = /<i class="(?:fa[sr]|fab|fa-solid|fa-regular) [^"]*"(?![^>]*aria-hidden)[^>]*><\/i>/;
const HOST = /caspio-pricing-proxy-ab30/;
const PAGES = fs.readdirSync(path.join(ROOT, 'calculators')).filter((f) => f.endsWith('.html') && !/emailjs-template/.test(f)).map((f) => 'calculators/' + f);
const SCRIPTS = ['calculators/compare-pricing.js', 'calculators/manual-pricing.js', 'calculators/safety-stripe-calculator.js', 'calculators/webstores-calculator.js',
    'calculators/js/christmas-bundles.js', 'calculators/js/purchasingform.js', 'calculators/service-price-cheat-sheet.js'];

describe('calculator pages', () => {
    test('there are calculator pages to check', () => { expect(PAGES.length).toBeGreaterThan(15); });
    test.each(PAGES)('%s', (rel) => {
        const html = strip(read(rel));
        expect(html).not.toMatch(BARE);
        expect(html).not.toMatch(/\son(click|change|error|input|submit|keyup|keypress|load)=/);
        expect(html).not.toMatch(/(href|src)="\/(?!config\/app\.config\.js)[^"?]+\.(css|js)"/);
        expect(html).not.toMatch(HOST);
        expect(html).not.toMatch(/<style[\s>]/);
        expect(html).not.toMatch(/<script>\s*[^\s<]/);
    });
});

describe('calculator page scripts', () => {
    test.each(SCRIPTS)('%s', (rel) => {
        const js = read(rel);
        expect(js).not.toMatch(HOST);
        expect(js).not.toMatch(BARE);
        expect(js).not.toMatch(/<i class="fas fa-\$\{[^}]+\}"><\/i>/);
        expect(js).not.toMatch(/console\.log\(/);
    });
    test('christmas-bundles + cheat sheet: host from APP_CONFIG, visible when missing', () => {
        expect(read('calculators/js/christmas-bundles.js')).toMatch(/var CB_API_BASE = \(window\.APP_CONFIG/);
        expect(read('calculators/christmas-bundles.html')).toMatch(/<script src="\/config\/app\.config\.js"><\/script>/);
        expect(read('calculators/service-price-cheat-sheet.js')).toMatch(/APP_CONFIG\.API\.BASE_URL missing/);
    });
});

describe('delegated handlers', () => {
    test('compare-pricing: data-change/data-call + delegator + Enter listener + h1', () => {
        const html = read('calculators/compare-pricing.html');
        expect((html.match(/data-change="compareCalc\./g) || []).length).toBe(17);
        expect(html).toMatch(/data-call="compareCalc\.lookUp"/);
        expect(html).toMatch(/data-call-delegator\.js\?v=/);
        expect(html).toMatch(/<h1 class="page-title">/);
        expect(read('calculators/compare-pricing.js')).toMatch(/getElementById\('styleInput'\)/);
        expect(read('calculators/compare-pricing.js')).toMatch(/window\.compareCalc = compareCalc;/);
    });
    test('safety-stripe-creator: tiles are keyboard buttons through the delegator', () => {
        const html = read('calculators/safety-stripe-creator.html');
        expect((html.match(/data-call="selectStripeStyle" data-args='\["\w+"\]' role="button" tabindex="0"/g) || []).length).toBe(4);
        expect(html).toMatch(/data-call="openSendModal"/);
        expect(html).toMatch(/data-call-delegator\.js\?v=/);
        expect(read('calculators/safety-stripe-calculator.js')).toMatch(/closest\('\.stripe-option\[data-style\]'\)/);
    });
    test('webstores hero image fallback via data-onerror', () => {
        expect(read('calculators/webstores.html')).toMatch(/data-onerror="hide"/);
        expect(read('calculators/webstores-calculator.js')).toMatch(/img\.dataset\.onerror === 'hide'/);
    });
});
