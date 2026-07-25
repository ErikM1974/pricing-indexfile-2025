/**
 * Brands Registry — THE single source of truth for brand names, landing pages
 * and search keywords across the public site.
 * @version 1.0.0 (2026-07-25)
 *
 * WHY THIS EXISTS
 * Brand data used to live in four hand-maintained copies that drifted apart:
 *   1. BRAND_LANDING_PAGES  (brands-flyout.js)   — mega-menu links
 *   2. BRAND_KEYWORDS       (product-search-service.js) — header search
 *   3. the drawer's <a href="/custom-*"> block   (index.html + siblings)
 *   4. PRIORITY_BRANDS      (brands.js)          — /brands.html ordering
 * By 2026-07-25 they disagreed in ways that cost real money:
 *   - Sport-Tek, District, CornerStone, Eddie Bauer and TravisMathew had
 *     landing pages but NO search keyword, so typing them applied no filter.
 *   - Seven BRAND_KEYWORDS values named brands the catalog does not have, so
 *     the search filtered to a brand with zero products and returned NOTHING
 *     instead of falling back to a text search. The worst was 'Bella+Canvas'
 *     (catalog spells it 'Bella + Canvas') — verified live returning 0 products
 *     for one of our best sellers. Also 'Stanley' (catalog: 'Stanley/Stella')
 *     and adidas / Under Armour / Columbia / Patagonia / YETI, none of which
 *     SanMar carries at all.
 *
 * THE RULE THAT PREVENTS ALL OF THAT: a brand's canonical name here MUST be
 * its exact /api/all-brands spelling, and every search keyword is DERIVED from
 * that name rather than typed by hand. A keyword can therefore never point at
 * a brand the catalog doesn't have. All 46 CATALOG_BRANDS names below were
 * verified against the live API on 2026-07-25.
 *
 * TO ADD A BRAND LANDING PAGE: add one FEATURED entry. The mega-menu tile, the
 * search keywords and the /brands.html link all follow automatically. The only
 * manual step left is the drawer link in the page HTML (kept as static markup
 * on purpose — those are crawlable internal links), and
 * tests/unit/brands-registry.test.js fails if you forget it.
 */

(function (global) {
    'use strict';

    /**
     * Brands with a dedicated /custom-<brand> landing page. Order = display
     * order in the mega-menu featured tier (5 cols x 3 rows) and the priority
     * sort everywhere else. `brand` MUST match the /api/all-brands spelling.
     */
    var FEATURED = [
        { brand: 'Carhartt',       href: '/custom-carhartt',         logo: 'https://cdnm.sanmar.com/catalog/images/Carharttheader.jpg' },
        { brand: 'Port & Company', href: '/custom-port-and-company', logo: 'https://cdnm.sanmar.com/catalog/images/portandcompanyheader.jpg' },
        { brand: 'Port Authority', href: '/custom-port-authority',   logo: 'https://cdnm.sanmar.com/catalog/images/portauthorityheader.jpg' },
        { brand: 'Sport-Tek',      href: '/custom-sport-tek',        logo: 'https://cdnm.sanmar.com/catalog/images/sporttekheader.jpg' },
        { brand: 'Richardson',     href: '/custom-richardson',       logo: 'https://cdnm.sanmar.com/catalog/images/richardsonheader.jpg' },
        { brand: 'Nike',           href: '/custom-nike',             logo: 'https://cdnm.sanmar.com/catalog/images/nikegolfheader.jpg' },
        { brand: 'New Era',        href: '/custom-new-era',          logo: 'https://cdnm.sanmar.com/catalog/images/neweraheader.jpg' },
        { brand: 'Gildan',         href: '/custom-gildan',           logo: 'https://cdnm.sanmar.com/catalog/images/gildanheader.jpg' },
        { brand: 'Bella + Canvas', href: '/custom-bella-canvas',     logo: 'https://cdnm.sanmar.com/catalog/images/Bella%20Logo%202000.jpg' },
        { brand: 'District',       href: '/custom-district',         logo: 'https://cdnm.sanmar.com/catalog/images/districtheader.jpg' },
        { brand: 'CornerStone',    href: '/custom-cornerstone',      logo: 'https://cdnm.sanmar.com/catalog/images/cornerstoneheader.jpg' },
        { brand: 'The North Face', href: '/custom-north-face',       logo: 'https://cdnm.sanmar.com/catalog/images/northfaceheader.jpg' },
        { brand: 'OGIO',           href: '/custom-ogio',             logo: 'https://cdnm.sanmar.com/catalog/images/ogioheader.jpg' },
        { brand: 'Eddie Bauer',    href: '/custom-eddie-bauer',      logo: 'https://cdnm.sanmar.com/catalog/images/eddiebauerheader.jpg' },
        { brand: 'TravisMathew',   href: '/custom-travismathew',     logo: 'https://cdnm.sanmar.com/catalog/images/travismathewheader.jpg' }
    ];

    /**
     * Catalog brands that share a featured brand's landing page. The API really
     * does return these as separate brands ('Port & Co' alongside
     * 'Port & Company'), so they need their own mapping or they fall through to
     * the generic catalog filter.
     */
    var LANDING_ALIASES = {
        'Port & Co': '/custom-port-and-company',
        'OGIO Endurance': '/custom-ogio'
    };

    /**
     * Every brand name /api/all-brands returns (verified 2026-07-25, n=46).
     * Search keywords are generated from this list, which is what guarantees a
     * keyword can only ever resolve to a brand the catalog actually has.
     * Stale entries are harmless (they just stop matching); MISSING entries only
     * mean that brand falls back to plain text search, which still works.
     */
    var CATALOG_BRANDS = [
        'A4', 'AllMade', 'Alternative Apparel', 'American Apparel', 'Anvil',
        'Bella + Canvas', 'Brooks Brothers', 'Bulwark', 'Canvas for Good',
        'Carhartt', 'Champion', 'Comfort Colors', 'CornerStone', 'Cotopaxi',
        'District', 'Eddie Bauer', 'Flexfit', 'Fruit of the Loom', 'Gildan',
        'Hanes', 'Jerzees', 'Mercer+Mettle', 'MiiR', 'New Era',
        'Next Level Apparel', 'Nike', 'OGIO', 'OGIO Endurance',
        'Outdoor Research', 'Port & Co', 'Port & Company', 'Port Authority',
        'Rabbit Skins', 'Red House', 'Red Kap', 'Richardson',
        'Russell Outdoors', 'Spacecraft', 'Sport-Tek', 'Stanley/Stella',
        'The North Face', 'Tommy Bahama', 'TravisMathew', 'Volunteer Knitwear',
        'Wink', 'tentree'
    ];

    /**
     * Extra spellings a customer might type that the generator can't derive.
     * Values MUST be canonical CATALOG_BRANDS names — the test enforces it.
     * (This is where 'stanley' correctly resolves to 'Stanley/Stella' instead
     * of the old bare 'Stanley', which matched nothing.)
     *
     * NO ABBREVIATIONS SHORTER THAN 3 CHARS. The consumer matches with
     * `query.includes(keyword)`, so a 2-letter keyword hijacks ordinary words:
     * 'pa' turned "pants", "apparel" and "pack" into Port Authority searches,
     * and 'pc' turned the style number "PC61" into a brand filter. Caught by
     * the false-positive test before it ever shipped — keep it that way.
     */
    var MANUAL_KEYWORDS = {
        'port and company': 'Port & Company',
        'port co': 'Port & Company',
        'sporttek': 'Sport-Tek',
        'tnf': 'The North Face',
        'stanley': 'Stanley/Stella',
        'stella': 'Stanley/Stella',
        'travis': 'TravisMathew',
        'fotl': 'Fruit of the Loom',
        'north face': 'The North Face',
        'ten tree': 'tentree'
    };

    /**
     * Generate the spellings a customer plausibly types for a brand name.
     * 'Bella + Canvas' -> bella + canvas, bella canvas, bellacanvas, bella+canvas
     * 'The North Face' -> the north face, north face, thenorthface
     * 'Sport-Tek'      -> sport-tek, sport tek, sporttek
     */
    function keywordsFor(name) {
        var lower = String(name).toLowerCase().trim();
        var out = [lower];

        // punctuation -> space (bella + canvas -> bella   canvas), collapse runs
        var spaced = lower.replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
        out.push(spaced);
        // all separators removed (bellacanvas, sporttek, northface)
        out.push(lower.replace(/[^a-z0-9]+/g, ''));
        // spaces removed but punctuation KEPT — 'Bella + Canvas' -> 'bella+canvas',
        // which is how people actually type that brand.
        out.push(lower.replace(/\s+/g, ''));
        // '&' spelled out
        if (lower.indexOf('&') !== -1) out.push(lower.replace(/&/g, 'and').replace(/\s+/g, ' ').trim());
        // drop a leading article ('the north face' -> 'north face')
        if (spaced.indexOf('the ') === 0) {
            out.push(spaced.slice(4));
            out.push(spaced.slice(4).replace(/\s+/g, ''));
        }
        // split camelCase ('TravisMathew' -> 'travis mathew')
        var camel = String(name).replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();
        if (camel !== lower) out.push(camel);

        // >=3 chars: see the MANUAL_KEYWORDS note — 2-letter keywords match
        // inside ordinary words and hijack non-brand searches.
        return out.filter(function (k, i) { return k.length >= 3 && out.indexOf(k) === i; });
    }

    // ---- derived maps -----------------------------------------------------

    /** Canonical brand name -> /custom-<brand> landing page. */
    var LANDING_PAGES = FEATURED.reduce(function (map, b) {
        map[b.brand] = b.href;
        return map;
    }, {});
    Object.keys(LANDING_ALIASES).forEach(function (name) {
        LANDING_PAGES[name] = LANDING_ALIASES[name];
    });

    /**
     * keyword -> canonical catalog brand name.
     *
     * Sorted LONGEST-FIRST because the consumer matches with
     * `query.includes(keyword)` and stops at the first hit: without this,
     * 'ogio' would shadow 'ogio endurance' and 'port' would shadow
     * 'port authority'. Order is part of the contract, not a detail.
     */
    var SEARCH_KEYWORDS = (function () {
        var pairs = {};
        // Longer/more specific brand names claim their keywords first.
        CATALOG_BRANDS.slice().sort(function (a, b) { return b.length - a.length; })
            .forEach(function (name) {
                keywordsFor(name).forEach(function (kw) {
                    if (!pairs[kw]) pairs[kw] = name;
                });
            });
        Object.keys(MANUAL_KEYWORDS).forEach(function (kw) {
            pairs[kw] = MANUAL_KEYWORDS[kw]; // manual wins — it's the curated answer
        });

        var ordered = {};
        Object.keys(pairs).sort(function (a, b) {
            return b.length - a.length || a.localeCompare(b);
        }).forEach(function (kw) { ordered[kw] = pairs[kw]; });
        return ordered;
    })();

    /** Display/priority order: featured brands first, then the rest A-Z. */
    var PRIORITY_ORDER = FEATURED.map(function (b) { return b.brand; });

    var registry = {
        FEATURED: FEATURED,
        LANDING_ALIASES: LANDING_ALIASES,
        LANDING_PAGES: LANDING_PAGES,
        CATALOG_BRANDS: CATALOG_BRANDS,
        MANUAL_KEYWORDS: MANUAL_KEYWORDS,
        SEARCH_KEYWORDS: SEARCH_KEYWORDS,
        PRIORITY_ORDER: PRIORITY_ORDER,
        keywordsFor: keywordsFor,
        /** Landing page for a brand, or null if it has none. */
        landingPageFor: function (brandName) {
            return LANDING_PAGES[brandName] || null;
        }
    };

    if (typeof global !== 'undefined') global.NWCA_BRANDS = registry;
    if (typeof module !== 'undefined' && module.exports) module.exports = registry;
})(typeof window !== 'undefined' ? window : this);
