/**
 * chrome-drift.test.js — ONE CHROME lock (M-6, 2026-08-26).
 *
 * The customer-facing chrome was five different navs across six pages, two
 * competing "Webstores" destinations, and drawers that each forgot different
 * links. The chrome is still copy-pasted per page (a build-time component is
 * a later refactor), so THIS test is what keeps the copies identical:
 *
 *  1. The top nav's (label, href) SEQUENCE is exactly the canonical list on
 *     every standard page — order included.
 *  2. Every drawer contains the canonical core link set (pages may add
 *     extras, e.g. the homepage's brand directory).
 *  3. Nothing links the retired /pages/webstore-info.html or the legacy
 *     homepage results engine (/?category=, /?q=).
 *
 * Editing the chrome on ONE page means editing it on ALL pages (and this
 * canon) in the same commit — that is the point.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const PAGES = [
    'index.html', 'pages/catalog.html', 'product.html', 'pages/quote-cart.html',
    'brands.html', 'calculators/laser-tumbler-polarcamel.html',
];

const CANONICAL_NAV = [
    ['Products', '/catalog'],
    ['Brands', '/brands.html'],
    ['Top Sellers', '/catalog?topSellers=1'],
    ["Fall Catalog '26", '/pages/fall-catalog-2026.html'],
    ['Custom Tees', '/custom-tees'],
    ['Custom Hats', '/custom-caps'],
    ['Webstores', '/company-webstores'],
    ['Blog', '/blog'],
    ['Stickers', '/custom-stickers'],
    ['Get a Quote', '/pages/request-a-quote.html'],
];

const DRAWER_CORE = [
    '/', '/catalog', '/pages/fall-catalog-2026.html', '/custom-tees', '/custom-caps',
    '/custom-stickers', '/custom-banners', '/catalog?topSellers=1', '/brands.html',
    '/company-webstores', '/blog', '/pages/request-a-quote.html',
];

function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }

function navSequence(html) {
    const m = html.match(/<ul class="nav-menu">([\s\S]*?)<\/ul>/);
    if (!m) return null;
    const out = [];
    const re = /<a href="([^"]+)" class="nav-link[^"]*"[^>]*>\s*([A-Za-z][^<\n]*)/g;
    let a;
    while ((a = re.exec(m[1])) !== null) out.push([a[2].trim().replace(/\s+/g, ' '), a[1]]);
    return out;
}

describe.each(PAGES)('%s', (rel) => {
    const html = read(rel);

    test('top nav is the canonical sequence, order included', () => {
        expect(navSequence(html)).toEqual(CANONICAL_NAV);
    });

    test('drawer contains every canonical core link', () => {
        const m = html.match(/<nav class="drawer-links"[\s\S]*?<\/nav>/);
        expect(m).not.toBeNull();
        const hrefs = new Set([...m[0].matchAll(/href="([^"]+)"/g)].map(x => x[1]));
        const missing = DRAWER_CORE.filter(h => !hrefs.has(h));
        expect({ file: rel, missingDrawerLinks: missing }).toEqual({ file: rel, missingDrawerLinks: [] });
    });

    test('no retired destinations (orphan webstore page, legacy inline engine)', () => {
        expect({ file: rel, orphanWebstore: html.includes('/pages/webstore-info.html') })
            .toEqual({ file: rel, orphanWebstore: false });
        expect({ file: rel, legacyCategoryLinks: /href="\/\?(category|q)=/.test(html) })
            .toEqual({ file: rel, legacyCategoryLinks: false });
    });
});
