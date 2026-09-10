/**
 * Public lead-form + account pages — 2026-09-05 review locks.
 *   request-a-quote / webstore-inquiry (shared form assets versioned, icons decorative), order-status,
 *   company-webstores, quote-view (proxy host from APP_CONFIG, no inline handlers in rendered HTML,
 *   keyboard style cells, typed/labelled modal close), customer-portal (account lookup fails VISIBLY,
 *   local calendar day for the reward window), customer-invoice (hidden attribute, no display toggles).
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const strip = (h) => h.replace(/<!--[\s\S]*?-->/g, '').replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/g, '');
const BARE = /<i class="(?:fa[sr]|fab|fa-solid|fa-regular) [^"]*"><\/i>/;

describe('lead forms + status + hub pages', () => {
    test.each(['request-a-quote', 'webstore-inquiry', 'order-status', 'company-webstores', 'customer-login'])('%s icons + no bare shared form assets', (name) => {
        const html = strip(read(`pages/${name}.html`));
        expect(html).not.toMatch(BARE);
        expect(html).not.toMatch(/(href|src)="\/pages\/forms\/[^"?]+\.(css|js)"/);
        expect(html).not.toMatch(/\son(click|error|change|submit|input)=/);
    });
    test('order-status + request-a-quote JS templates carry decorative icons', () => {
        expect(read('pages/js/order-status.js')).not.toMatch(BARE);
        expect(read('pages/js/order-status.js')).not.toMatch(/<i class="fas \$\{[^}]+\}"><\/i>/);
        expect(read('pages/request-a-quote.js')).not.toMatch(BARE);
        expect(read('pages/css/order-status.css')).toMatch(/\[hidden\] \{ display: none !important; \}/);
    });
});

describe('quote-view', () => {
    const html = read('pages/quote-view.html');
    const js = read('pages/js/quote-view.js');
    test('proxy host from APP_CONFIG; no inline handlers; keyboard style cells; modal close typed', () => {
        expect(html).toMatch(/<script src="\/config\/app\.config\.js"><\/script>\s*<script src="\/pages\/js\/quote-view\.js\?v=/);
        expect(js).not.toMatch(/caspio-pricing-proxy-ab30/);
        expect(js).toMatch(/this\.apiBaseUrl = \(window\.APP_CONFIG && window\.APP_CONFIG\.API && window\.APP_CONFIG\.API\.BASE_URL\) \|\| '';/);
        expect(js).not.toMatch(/onclick=/);
        expect(js).toMatch(/e\.target\.closest\('\[data-qv-close-modal\]'\)/);
        expect(js).toMatch(/<td class="style-col clickable" data-qv-group="\$\{groupIndex\}" role="button" tabindex="0"/);
        expect(js).toMatch(/<button type="button" class="product-modal-close" data-qv-close-modal aria-label="Close">/);
        expect(js).not.toMatch(BARE);
        expect(read('pages/css/quote-view.css')).toMatch(/\[hidden\] \{ display: none !important; \}/);
    });
});

describe('customer portal + customer invoice', () => {
    test('portal: account lookup fails visibly; local calendar day', () => {
        const js = read('pages/js/customer-portal.js');
        expect(js).toMatch(/if \(!r\.ok\) throw new Error\('me ' \+ r\.status\);/);
        expect(js).toMatch(/setText\('cp-acct-email', 'Unavailable — refresh to retry'\);/);
        expect(js).not.toMatch(/toISOString\(\)\.slice\(0, 10\)/);
    });
    test('customer invoice: hidden attribute, no display toggles', () => {
        const html = read('pages/customer-invoice.html');
        const js = read('pages/js/customer-invoice.js');
        expect(html).not.toMatch(/style="/);
        expect(html).toMatch(/id="ci-error" role="alert" hidden>/);
        expect(html).toMatch(/id="ci-paper" hidden>/);
        expect(js).not.toMatch(/\.style\.display/);
        expect(html).toContain('data-ui="unified"');
        expect(read('shared_components/css/components.css')).toMatch(/\[hidden\]\s*\{\s*display:\s*none;/);
    });
});
