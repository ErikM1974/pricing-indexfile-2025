/**
 * Public storefronts — 2026-09-05 review locks.
 *   custom-tees / custom-caps studios + their success pages, custom-stickers, custom-banners.
 *   Icons decorative (HTML and the JS templates, including the `${…}` dynamic ones), hidden file inputs
 *   named, "(optional)" hints via a class (no inline style), and — Rule 6 / Erik's #1 rule — NO silent
 *   hardcoded proxy fallback: a missing APP_CONFIG surfaces a visible message instead of guessing a host.
 *   Tees zoom lightbox locks scroll via a class; success pages carry no console.log.
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const strip = (h) => h.replace(/<!--[\s\S]*?-->/g, '').replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/g, '');
const BARE = /<i class="(?:fa[sr]|fab|fa-solid|fa-regular) [^"]*"><\/i>/;
const HOST = /caspio-pricing-proxy-ab30/;

const HTML = ['custom-tees', 'custom-caps', 'custom-stickers', 'custom-banners', 'custom-tees-success', 'custom-caps-success'];
const JS = ['custom-tees-app', 'custom-caps-app', 'custom-tees-success', 'custom-caps-success'];

describe('storefront HTML hygiene', () => {
    test.each(HTML)('%s', (name) => {
        const html = strip(read(`pages/${name}.html`));
        expect(html).not.toMatch(BARE);
        expect(html).not.toMatch(/<style[\s>]/);
        expect(html).not.toMatch(/<script>\s*[^\s<]/);
        expect(html).not.toMatch(/\son(click|error|change|submit|input)=/);
        expect(html).not.toMatch(HOST);
        expect(html).not.toMatch(/ style="(?!--)/); // custom properties only
    });
    test('hidden file inputs are named', () => {
        expect(read('pages/custom-tees.html')).toMatch(/id="art-input"[^>]*aria-label="Choose an artwork file"/);
        expect(read('pages/custom-caps.html')).toMatch(/id="front-input"[^>]*aria-label="Choose the front logo file"/);
        expect(read('pages/custom-caps.html')).toMatch(/id="back-input"[^>]*aria-label="Choose the back logo file"/);
    });
    test('"(optional)" hint is a class on both instant-quote pages', () => {
        expect((read('pages/custom-stickers.html').match(/class="stk-optional"/g) || []).length).toBe(3);
        expect((read('pages/custom-banners.html').match(/class="stk-optional"/g) || []).length).toBe(3);
        expect(read('pages/css/instant-quote.css').replace(/\s+/g, ' ')).toMatch(/\.stk-optional \{ font-weight: 400; \}/);
    });
});

describe('storefront JS hygiene', () => {
    test.each(JS)('%s', (name) => {
        const js = read(`pages/js/${name}.js`);
        expect(js).not.toMatch(BARE);
        expect(js).not.toMatch(/<i class="fas \$\{[^}]+\}"><\/i>/); // dynamic icons decorative too
        expect(js).not.toMatch(HOST); // no silent fallback host
        expect(js).toMatch(/const API_BASE = \(window\.APP_CONFIG && window\.APP_CONFIG\.API && window\.APP_CONFIG\.API\.BASE_URL\) \|\| '';/);
        expect(js).toMatch(/if \(!API_BASE\) \{/); // visible failure path
        expect(js).not.toMatch(/console\.log\(/);
    });
    test('missing config is VISIBLE, not guessed', () => {
        expect(read('pages/js/custom-tees-app.js')).toMatch(/Pricing is unavailable right now \(site configuration did not load\)/);
        expect(read('pages/js/custom-caps-app.js')).toMatch(/Pricing is unavailable right now \(site configuration did not load\)/);
        expect(read('pages/js/custom-tees-success.js')).toMatch(/if \(err\) err\.hidden = false;/);
        expect(read('pages/js/custom-caps-success.js')).toMatch(/if \(err\) err\.hidden = false;/);
    });
    test('tees zoom lightbox scroll lock via class', () => {
        const js = read('pages/js/custom-tees-app.js');
        expect(js).not.toMatch(/body\.style\.overflow/);
        expect(js).toMatch(/document\.body\.classList\.add\('is-modal-open'\);/);
        expect(read('pages/css/custom-tees.css')).toMatch(/body\.is-modal-open \{ overflow: hidden; \}/);
    });
});
