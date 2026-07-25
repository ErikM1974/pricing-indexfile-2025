/**
 * Brands Flyout Menu
 * Masthead Brands mega-dropdown: a featured tier of the brands we actually
 * promote, plus a type-to-filter box that reaches every brand in the catalog.
 * @version 7.0.0
 *
 * Update 7.0.0 (2026-07-25): featured tier + filter, and the dropdown can no
 *   longer render empty.
 *   - WHY: the dropdown showed "No brands available". Root cause was proxy-side
 *     (/api/all-brands cached its own empty result — `[]` is truthy, so one bad
 *     Caspio read pinned "no brands" for 24h server-side and 6h in every
 *     browser). Fixed there, but the front end also dead-ended on empty instead
 *     of degrading, which is what made a backend blip a visibly broken menu.
 *   - FEATURED_BRANDS is static, so the tier paints on init with zero network
 *     dependency and is the fallback whenever the API is slow, empty or down.
 *     Layered: static tier -> CDN logo -> 🏷️ glyph + name. Never blank.
 *   - 15 tiles (the brands with a /custom-<brand> landing page) instead of a
 *     30-logo wall: 3 rows, no internal scrollbar, and clicks land on the
 *     landing pages rather than a generic catalog filter.
 *   - Filter searches all ~46 API brands; long-tail hits go to /?brand=<name>.
 * Update 6.0.0: Priority brand loading - Carhartt and top brands appear first
 * Update 5.0.0: Progressive image loading (batches of 10, 200ms stagger)
 * Update 4.0.0: On-demand loading - eliminates 8-second homepage delay
 * Update 3.0.0: Added lazy loading for performance optimization
 * Update 2.0.0: Added brand logo support from API
 */

/**
 * The featured tier. This is deliberately STATIC, and that is not a violation of
 * the "pricing comes from the API" rule — no price is involved. *Which* brands
 * we promote, and which have a landing page, is an editorial decision that
 * changes a couple of times a year, so hardcoding it buys an instant, offline-
 * proof menu. The full brand list stays API-driven (see loadBrands).
 *
 * Rule: one entry per /custom-<brand> landing page. Ship a landing page -> add
 * a tile here. `brand` MUST match the /api/all-brands spelling exactly (all 15
 * verified against the live payload 2026-07-25) so filtering de-dupes cleanly.
 * `logo` URLs verified 200 on the SanMar CDN — note Bella's needs %20 escapes.
 */
const FEATURED_BRANDS = [
    { brand: 'Carhartt',        href: '/custom-carhartt',          logo: 'https://cdnm.sanmar.com/catalog/images/Carharttheader.jpg' },
    { brand: 'Port & Company',  href: '/custom-port-and-company',  logo: 'https://cdnm.sanmar.com/catalog/images/portandcompanyheader.jpg' },
    { brand: 'Port Authority',  href: '/custom-port-authority',    logo: 'https://cdnm.sanmar.com/catalog/images/portauthorityheader.jpg' },
    { brand: 'Sport-Tek',       href: '/custom-sport-tek',         logo: 'https://cdnm.sanmar.com/catalog/images/sporttekheader.jpg' },
    { brand: 'Richardson',      href: '/custom-richardson',        logo: 'https://cdnm.sanmar.com/catalog/images/richardsonheader.jpg' },
    { brand: 'Nike',            href: '/custom-nike',              logo: 'https://cdnm.sanmar.com/catalog/images/nikegolfheader.jpg' },
    { brand: 'New Era',         href: '/custom-new-era',           logo: 'https://cdnm.sanmar.com/catalog/images/neweraheader.jpg' },
    { brand: 'Gildan',          href: '/custom-gildan',            logo: 'https://cdnm.sanmar.com/catalog/images/gildanheader.jpg' },
    { brand: 'Bella + Canvas',  href: '/custom-bella-canvas',      logo: 'https://cdnm.sanmar.com/catalog/images/Bella%20Logo%202000.jpg' },
    { brand: 'District',        href: '/custom-district',          logo: 'https://cdnm.sanmar.com/catalog/images/districtheader.jpg' },
    { brand: 'CornerStone',     href: '/custom-cornerstone',       logo: 'https://cdnm.sanmar.com/catalog/images/cornerstoneheader.jpg' },
    { brand: 'The North Face',  href: '/custom-north-face',        logo: 'https://cdnm.sanmar.com/catalog/images/northfaceheader.jpg' },
    { brand: 'OGIO',            href: '/custom-ogio',              logo: 'https://cdnm.sanmar.com/catalog/images/ogioheader.jpg' },
    { brand: 'Eddie Bauer',     href: '/custom-eddie-bauer',       logo: 'https://cdnm.sanmar.com/catalog/images/eddiebauerheader.jpg' },
    { brand: 'TravisMathew',    href: '/custom-travismathew',      logo: 'https://cdnm.sanmar.com/catalog/images/travismathewheader.jpg' }
];

/**
 * Brand name -> landing page, DERIVED from FEATURED_BRANDS so the two can never
 * drift. Plus aliases: the API really does return both 'Port & Co' and
 * 'Port & Company' as separate brands sharing one logo, and both OGIO variants
 * should reach the OGIO page.
 */
const BRAND_LANDING_PAGES = FEATURED_BRANDS.reduce((map, b) => {
    map[b.brand] = b.href;
    return map;
}, {
    'Port & Co': '/custom-port-and-company',
    'OGIO Endurance': '/custom-ogio'
});

class BrandsFlyout {
    constructor() {
        this.apiBase = 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';
        this.brandsContainer = document.getElementById('navBrandsGrid');
        this.allBrands = [];
        this.maxBrandsToShow = 30;   // cap on filter results
        this.brandsLoaded = false;
        this.isLoading = false;
        this.filterQuery = '';
        this.degraded = false;       // API empty/unreachable -> featured tier only

        this.init();
    }

    init() {
        if (!this.brandsContainer) {
            console.warn('[BrandsFlyout] Brands container not found, skipping initialization');
            return;
        }

        // Paint the featured tier synchronously. The dropdown is now useful
        // before any network call resolves — and stays useful if none ever does.
        this.injectFilterUI();
        this.renderFeatured();

        // The full list only powers the filter + the footer count, so it can
        // load whenever. Warm it on first interaction and during idle time.
        this.setupLazyLoading();
        this.prefetchWhenIdle();
    }

    prefetchWhenIdle() {
        const warm = () => {
            if (!this.brandsLoaded && !this.isLoading) this.loadBrands();
        };
        if (typeof window.requestIdleCallback === 'function') {
            window.requestIdleCallback(warm, { timeout: 4000 });
        } else {
            setTimeout(warm, 2500);
        }
    }

    /**
     * Insert the filter box above the grid. Markup is injected here (rather than
     * living in the 5 pages that ship this masthead) to match how the sibling
     * Products dropdown builds its own search — see the `.brands-grid` and
     * `.dropdown-search-*` notes in nwca-2026-core.css. Classes are REUSED from
     * that dropdown so no new styling is introduced.
     */
    injectFilterUI() {
        const content = this.brandsContainer.parentElement;
        if (!content || content.querySelector('.brands-filter-container')) return;

        const wrap = document.createElement('div');
        wrap.className = 'dropdown-search-container brands-filter-container';
        wrap.innerHTML = `
            <svg class="dropdown-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" stroke-width="2.5" aria-hidden="true">
                <circle cx="11" cy="11" r="7"></circle><line x1="16.5" y1="16.5" x2="21" y2="21"></line>
            </svg>
            <input type="search" class="dropdown-search-input" id="navBrandsFilter"
                   placeholder="Filter brands — Carhartt, Nike…" autocomplete="off"
                   aria-label="Filter brands">
        `;
        content.insertBefore(wrap, this.brandsContainer);

        const input = wrap.querySelector('#navBrandsFilter');
        let debounce;
        input.addEventListener('input', () => {
            clearTimeout(debounce);
            debounce = setTimeout(() => this.applyFilter(input.value), 120);
        });
        // Esc clears the filter rather than closing the whole dropdown
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && input.value) {
                e.stopPropagation();
                input.value = '';
                this.applyFilter('');
            }
        });
    }

    /**
     * Featured tier — the default view, and the fallback whenever the API can't
     * be reached. Marked-up identically to filter results so hover/focus styles
     * and the logo loader behave the same.
     */
    renderFeatured() {
        const html = FEATURED_BRANDS.map(b => this.createBrandLink(b, b.logo)).join('');
        const note = this.degraded
            ? `<p class="brands-note">Showing our top brands — the full list is briefly unavailable.</p>`
            : '';
        this.brandsContainer.innerHTML = note + html;
        this.initProgressiveLoading();
    }

    /**
     * Skeleton tiles at the FINAL tile size, so swapping in real content never
     * changes the panel height (the old one-line "Loading brands…" made the
     * dropdown jump several rows). Only used for filter results, since the
     * featured tier paints instantly from static data.
     */
    showFilterSkeleton(count = 10) {
        this.brandsContainer.innerHTML = Array.from({ length: count }, () =>
            `<div class="brand-tile-skeleton" aria-hidden="true"></div>`
        ).join('');
    }

    /**
     * Set up on-demand loading of the full list (for the filter)
     */
    setupLazyLoading() {
        const brandsButton = document.querySelector('.nav-item[data-dropdown="brands"]') ||
                           document.querySelector('.brands-nav-item') ||
                           document.querySelector('[href*="brands"]')?.closest('.nav-item');

        if (!brandsButton) {
            console.warn('[BrandsFlyout] Brands trigger not found, falling back to immediate load');
            this.loadBrands();
            return;
        }

        const loadOnce = () => {
            if (!this.brandsLoaded && !this.isLoading) this.loadBrands();
        };

        brandsButton.addEventListener('mouseenter', loadOnce, { once: true });
        brandsButton.addEventListener('click', loadOnce, { once: true });
    }

    /**
     * Fetch the full brand list from the API. Only powers the filter and the
     * footer count — a failure here degrades to the featured tier and NEVER
     * blanks the menu.
     */
    async loadBrands() {
        if (this.isLoading || this.brandsLoaded) return;
        this.isLoading = true;

        try {
            const response = await fetch(`${this.apiBase}/api/all-brands`);

            // The proxy now answers 503 (never a cacheable empty 200) when its
            // upstream read comes back empty — treat it as "degrade", not "fail".
            if (!response.ok) {
                throw new Error(`API request failed: ${response.status}`);
            }

            const data = await response.json();

            // Bare array today; tolerate the wrapped shapes older builds returned.
            const brands = data.brands || data.data?.brands || data;

            if (!Array.isArray(brands)) {
                throw new Error('Invalid brands data format');
            }
            if (brands.length === 0) {
                throw new Error('API returned an empty brand list');
            }

            this.allBrands = this.sortBrandsByPriority(brands);
            this.brandsLoaded = true;
            this.degraded = false;

            this.updateFooterCount(this.allBrands.length);

            // Only repaint if the user is mid-filter; otherwise leave the
            // featured tier alone so nothing flickers under the cursor.
            if (this.filterQuery) this.applyFilter(this.filterQuery);

        } catch (error) {
            // Degrade, don't dead-end. The featured tier is already on screen.
            console.error('[BrandsFlyout] Could not load the full brand list — showing featured brands only:', error);
            this.degraded = true;
            if (!this.filterQuery) this.renderFeatured();
        } finally {
            this.isLoading = false;
        }
    }

    /**
     * Sort brands with the featured names first (in FEATURED_BRANDS order), then
     * everything else alphabetically.
     */
    sortBrandsByPriority(brands) {
        const priority = FEATURED_BRANDS.map(b => b.brand);
        const nameOf = (brand) => {
            if (typeof brand === 'string') return brand;
            if (typeof brand === 'object' && brand !== null) {
                return brand.brand || brand.name || brand.BrandName || brand.Brand || '';
            }
            return String(brand);
        };

        return [...brands].sort((a, b) => {
            const nameA = nameOf(a);
            const nameB = nameOf(b);
            const indexA = priority.indexOf(nameA);
            const indexB = priority.indexOf(nameB);

            if (indexA !== -1 && indexB !== -1) return indexA - indexB;
            if (indexA !== -1) return -1;
            if (indexB !== -1) return 1;
            return nameA.toUpperCase().localeCompare(nameB.toUpperCase());
        });
    }

    /**
     * Filter across every known brand. Falls back to filtering the featured
     * tier when the API list hasn't arrived (or never will).
     */
    applyFilter(rawQuery) {
        const query = (rawQuery || '').trim().toLowerCase();
        this.filterQuery = query;

        if (!query) {
            this.renderFeatured();
            return;
        }

        const source = this.allBrands.length ? this.allBrands : FEATURED_BRANDS;
        const nameOf = (b) => (typeof b === 'string' ? b : (b.brand || b.name || ''));
        const matches = source.filter(b => nameOf(b).toLowerCase().includes(query));

        if (matches.length === 0) {
            // If the list is still in flight, say so rather than claiming no match.
            if (!this.brandsLoaded && this.isLoading) {
                this.showFilterSkeleton(5);
                return;
            }
            this.brandsContainer.innerHTML = `
                <div class="dropdown-no-results">
                    <p>No brands match “${this.escapeHtml(rawQuery.trim())}”</p>
                    <a href="/brands.html" class="view-all-brands-link">Browse all brands →</a>
                </div>
            `;
            return;
        }

        this.brandsContainer.innerHTML = matches
            .slice(0, this.maxBrandsToShow)
            .map(b => this.createBrandLink(b, typeof b === 'object' ? b.logo : null))
            .join('');
        this.initProgressiveLoading();
    }

    /** Footer link picks up the real brand count once it's known. */
    updateFooterCount(count) {
        const link = document.querySelector('.brands-dropdown .view-all-brands-link');
        if (link && count > 0) link.textContent = `View all ${count} brands →`;
    }

    /**
     * Initialize progressive image loading
     */
    initProgressiveLoading() {
        this.addPreconnectHint();

        const brandImages = this.brandsContainer.querySelectorAll('.brand-link-logo[data-src]');
        if (brandImages.length === 0) return;

        this.loadImagesBatched(brandImages);
    }

    /**
     * Load images in batches to prevent network congestion
     */
    loadImagesBatched(images) {
        const BATCH_SIZE = 10;
        const BATCH_DELAY = 200; // ms between batches

        const imageArray = Array.from(images);
        const batches = [];

        for (let i = 0; i < imageArray.length; i += BATCH_SIZE) {
            batches.push(imageArray.slice(i, i + BATCH_SIZE));
        }

        batches.forEach((batch, batchIndex) => {
            setTimeout(() => {
                batch.forEach(img => this.loadImage(img));
            }, batchIndex * BATCH_DELAY);
        });
    }

    /**
     * Load a single image with fade-in effect
     */
    loadImage(img) {
        const src = img.getAttribute('data-src');
        if (!src) return;

        const loader = new Image();

        loader.onload = () => {
            img.src = src;
            img.removeAttribute('data-src');
            img.classList.add('brand-logo-loaded');
            img.classList.remove('brand-logo-loading');
        };

        loader.onerror = () => {
            // Last layer of the fallback chain: drop the image, show the glyph.
            console.warn(`[BrandsFlyout] Failed to load image: ${src}`);
            img.classList.add('brand-logo-failed');
            const fallback = img.nextElementSibling;
            if (fallback && fallback.classList.contains('brand-link-icon-fallback')) {
                fallback.classList.add('is-shown');
            }
            img.classList.remove('brand-logo-loading');
        };

        loader.src = src;
    }

    /**
     * Add preconnect hint for faster CDN connection
     */
    addPreconnectHint() {
        if (document.querySelector('link[rel="preconnect"][href*="cdnm.sanmar.com"]')) return;

        const preconnect = document.createElement('link');
        preconnect.rel = 'preconnect';
        preconnect.href = 'https://cdnm.sanmar.com';
        preconnect.crossOrigin = 'anonymous';
        document.head.appendChild(preconnect);
    }

    /**
     * Create a brand link element with logo support and progressive loading
     */
    createBrandLink(brand, logo) {
        const brandName = typeof brand === 'object' ? (brand.brand || brand.name) : brand;
        const logoUrl = typeof brand === 'object' ? brand.logo : logo;
        if (!brandName) return '';

        let iconHtml;
        if (logoUrl) {
            iconHtml = `
                <img data-src="${this.escapeHtml(logoUrl)}"
                     alt="${this.escapeHtml(brandName)}"
                     class="brand-link-logo brand-logo-loading"
                     decoding="async">
                <span class="brand-link-icon brand-link-icon-fallback">🏷️</span>
            `;
        } else {
            iconHtml = `<span class="brand-link-icon">🏷️</span>`;
        }

        // Featured/aliased brands go to their landing page; the long tail goes to
        // the catalog filter on the homepage (verified: sets the brand checkbox,
        // shows a chip and renders matching products).
        const landingPage = (typeof brand === 'object' && brand.href) || BRAND_LANDING_PAGES[brandName];
        const href = landingPage || `/?brand=${encodeURIComponent(brandName)}`;

        return `
            <a href="${href}" class="brand-link">
                ${iconHtml}
                <span class="brand-link-name">${this.escapeHtml(brandName)}</span>
            </a>
        `;
    }

    /**
     * Escape HTML to prevent XSS
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.brandsFlyout = new BrandsFlyout();
});
