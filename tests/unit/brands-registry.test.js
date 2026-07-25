/**
 * Drift lock for the brands registry (shared_components/js/brands-registry.js).
 *
 * Brand data used to live in four hand-maintained copies (mega-menu, header
 * search, /brands.html, drawer HTML) that silently disagreed. The damage by
 * 2026-07-25:
 *   - Sport-Tek / District / CornerStone / Eddie Bauer / TravisMathew had
 *     landing pages but no search keyword.
 *   - 'bella canvas' mapped to 'Bella+Canvas' while the catalog spells it
 *     'Bella + Canvas' — verified live returning ZERO products for a top
 *     seller. Same class of bug for 'Stanley' vs 'Stanley/Stella'.
 *
 * These tests fail the build if any of that comes back. The drawer stays as
 * static HTML on purpose (crawlable internal links), so it can't consume the
 * registry at runtime — instead it's asserted against it here.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const R = require(path.join(ROOT, 'shared_components', 'js', 'brands-registry.js'));

const catalog = new Set(R.CATALOG_BRANDS);

/** Mirrors the consumer's scan in product-search-service.js parseSmartQuery(). */
function resolveBrand(query) {
    const lower = String(query).toLowerCase().trim();
    for (const [keyword, brandName] of Object.entries(R.SEARCH_KEYWORDS)) {
        if (lower.includes(keyword)) return brandName;
    }
    return null;
}

describe('registry internal consistency', () => {
    test('every featured brand is a real catalog brand name', () => {
        const unknown = R.FEATURED.map(b => b.brand).filter(b => !catalog.has(b));
        expect(unknown).toEqual([]);
    });

    test('every landing-page alias is a real catalog brand name', () => {
        const unknown = Object.keys(R.LANDING_ALIASES).filter(b => !catalog.has(b));
        expect(unknown).toEqual([]);
    });

    test('EVERY search keyword resolves to a real catalog brand — the Bella+Canvas bug', () => {
        const bad = Object.entries(R.SEARCH_KEYWORDS)
            .filter(([, brand]) => !catalog.has(brand))
            .map(([kw, brand]) => `${kw} -> ${brand}`);
        expect(bad).toEqual([]);
    });

    test('featured brands are unique and each has a landing page', () => {
        const names = R.FEATURED.map(b => b.brand);
        expect(new Set(names).size).toBe(names.length);
        names.forEach(n => expect(R.landingPageFor(n)).toMatch(/^\/custom-/));
    });

    test('every featured logo is an absolute, properly-escaped URL', () => {
        R.FEATURED.forEach(b => {
            expect(b.logo).toMatch(/^https:\/\//);
            // Bella's CDN filename contains spaces; they must be %20-escaped or
            // the URL 404s when fetched outside a browser.
            expect(b.logo).not.toMatch(/ /);
        });
    });
});

describe('search keyword safety', () => {
    test('no keyword is shorter than 3 chars', () => {
        const short = Object.keys(R.SEARCH_KEYWORDS).filter(k => k.length < 3);
        expect(short).toEqual([]);
    });

    test('keywords are ordered longest-first so specific names win', () => {
        const lengths = Object.keys(R.SEARCH_KEYWORDS).map(k => k.length);
        const sorted = [...lengths].sort((a, b) => b - a);
        expect(lengths).toEqual(sorted);
    });

    test('specific brand beats its own prefix', () => {
        expect(resolveBrand('ogio endurance')).toBe('OGIO Endurance');
        expect(resolveBrand('ogio')).toBe('OGIO');
        expect(resolveBrand('canvas for good')).toBe('Canvas for Good');
    });

    test('ordinary product searches are NOT hijacked into a brand filter', () => {
        // A 2-letter keyword ('pa') once turned "pants"/"apparel" into Port
        // Authority, and 'pc' turned the style number PC61 into a brand filter.
        const queries = [
            'pants', 'apparel', 'pack', 'space', 'polo shirt', 't-shirt',
            'hoodie', 'cap', 'caps', 'jacket', 'safety vest', 'long sleeve',
            'beanie', 'tote bag', 'quarter zip', 'crewneck', 'PC61', 'PC54'
        ];
        const hijacked = queries
            .map(q => [q, resolveBrand(q)])
            .filter(([, brand]) => brand !== null)
            .map(([q, brand]) => `${q} -> ${brand}`);
        expect(hijacked).toEqual([]);
    });

    test('brands we do not carry apply NO filter (text search beats a dead filter)', () => {
        // These used to map to themselves, filtering to a brand with zero
        // products and showing the customer an empty page.
        ['yeti', 'adidas', 'under armour', 'columbia', 'patagonia']
            .forEach(q => expect(resolveBrand(q)).toBeNull());
    });

    test('the brands that had pages but no keyword now resolve', () => {
        // The exact five that drifted.
        expect(resolveBrand('sport-tek')).toBe('Sport-Tek');
        expect(resolveBrand('district')).toBe('District');
        expect(resolveBrand('cornerstone')).toBe('CornerStone');
        expect(resolveBrand('eddie bauer')).toBe('Eddie Bauer');
        expect(resolveBrand('travismathew')).toBe('TravisMathew');
    });

    test('every featured brand is reachable from a plain-text search', () => {
        const unreachable = R.FEATURED
            .map(b => b.brand)
            .filter(name => resolveBrand(name) !== name);
        expect(unreachable).toEqual([]);
    });

    test('the exact spellings that returned zero products now resolve correctly', () => {
        expect(resolveBrand('bella canvas')).toBe('Bella + Canvas');
        expect(resolveBrand('bella+canvas')).toBe('Bella + Canvas');
        expect(resolveBrand('stanley')).toBe('Stanley/Stella');
    });
});

describe('landing pages exist on disk', () => {
    test('every registry href maps to a real pages/*.html file', () => {
        const missing = Object.values(R.LANDING_PAGES)
            .filter((v, i, a) => a.indexOf(v) === i)
            .filter(href => !fs.existsSync(path.join(ROOT, 'pages', `${href.replace(/^\//, '')}.html`)));
        expect(missing).toEqual([]);
    });
});

describe('static drawer HTML matches the registry', () => {
    // The drawer is intentionally static markup (crawlable internal links), so
    // it can't read the registry at runtime — assert it here instead.
    const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    const drawer = html.slice(html.indexOf('drawer-links'), html.indexOf('</nav>', html.indexOf('drawer-links')));

    test('drawer links every featured brand landing page', () => {
        const missing = R.FEATURED.filter(b => !drawer.includes(`href="${b.href}"`)).map(b => b.brand);
        expect(missing).toEqual([]);
    });

    test('drawer has no /custom-<brand> link the registry does not know about', () => {
        // Product-type pages (tees/stickers/banners/caps) are not brands.
        const NON_BRAND = ['/custom-tees', '/custom-stickers', '/custom-banners', '/custom-caps'];
        const known = new Set(Object.values(R.LANDING_PAGES).concat(NON_BRAND));
        const hrefs = [...drawer.matchAll(/href="(\/custom-[^"]+)"/g)].map(m => m[1]);
        const orphans = hrefs.filter(h => !known.has(h));
        expect(orphans).toEqual([]);
    });
});
