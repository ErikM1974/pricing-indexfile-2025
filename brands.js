/* Brand directory: native named links, API priority order, and retry preserving search. */
class BrandsPage {
    constructor() {
        const base = window.APP_CONFIG?.API?.BASE_URL || '';
        this.apiBase = base ? base + '/api' : '';
        this.allBrands = [];
        this.PRIORITY_BRANDS = window.NWCA_BRANDS?.PRIORITY_ORDER || [];
        this.search = document.getElementById('brandSearchInput');
        this.container = document.getElementById('brandsContainer');
        this.loading = document.getElementById('loadingState');
        this.error = document.getElementById('errorState');
        this.retry = document.getElementById('brandsRetry');
        this.context = document.getElementById('brandsResultContext');
        this.loading.setAttribute('role', 'status');
        this.search.addEventListener('input', () => this.displayBrands());
        this.retry.addEventListener('click', () => this.loadBrands(true));
        document.addEventListener('error', event => {
            const img = event.target;
            if (img.tagName === 'IMG' && img.dataset.onerror === 'hide') img.hidden = true;
        }, true);
        this.loadBrands();
    }
    async loadBrands(fromRetry = false) {
        if (this.requesting) return;
        this.requesting = true;
        this.loading.hidden = false;
        this.error.hidden = true;
        this.container.hidden = true;
        this.context.textContent = '';
        this.retry.disabled = true;
        try {
            if (!this.apiBase) throw new Error('The catalogue service is not configured.');
            const response = await fetch(this.apiBase + '/all-brands', { signal: AbortSignal.timeout(20000) });
            if (!response.ok) throw new Error('Brand service returned ' + response.status);
            const data = await response.json();
            const brands = data?.brands ?? data?.data?.brands ?? data;
            if (!Array.isArray(brands) || brands.some(brand => !this.brandName(brand))) throw new Error('The brand service returned an invalid list.');
            this.allBrands = this.sortBrandsByPriority(brands);
            this.displayBrands();
            this.container.hidden = false;
            if (fromRetry) this.search.focus();
        } catch (error) {
            console.error('[BrandsPage] Unable to load brands:', error);
            this.error.hidden = false;
        } finally {
            this.loading.hidden = true;
            this.retry.disabled = false;
            this.requesting = false;
        }
    }
    brandName(brand) {
        const name = typeof brand === 'string' ? brand : brand?.brand || brand?.name;
        return typeof name === 'string' ? name.trim() : '';
    }
    sortBrandsByPriority(brands) {
        return [...brands].sort((a, b) => {
            const first = this.brandName(a), second = this.brandName(b);
            const ia = this.PRIORITY_BRANDS.indexOf(first), ib = this.PRIORITY_BRANDS.indexOf(second);
            if (ia !== -1 && ib !== -1) return ia - ib;
            if (ia !== -1) return -1;
            if (ib !== -1) return 1;
            return first.toUpperCase().localeCompare(second.toUpperCase());
        });
    }
    displayBrands() {
        const term = this.search.value.trim().toLowerCase();
        const brands = this.allBrands.filter(brand => this.brandName(brand).toLowerCase().includes(term));
        this.filteredBrands = brands;
        this.context.textContent = brands.length + ' of ' + this.allBrands.length + ' brands' + (term ? ' — matching “' + this.search.value.trim() + '”' : '');
        this.container.replaceChildren();
        if (!brands.length) {
            const empty = document.createElement('p');
            empty.className = 'no-brands';
            empty.textContent = this.allBrands.length ? 'No brands found matching your search.' : 'No brands are available right now.';
            this.container.append(empty);
            return;
        }
        const grid = document.createElement('div');
        grid.className = 'brand-grid';
        for (const brand of brands) {
            const name = this.brandName(brand), card = document.createElement('a');
            card.className = 'brand-card';
            card.dataset.brand = encodeURIComponent(name);
            card.href = window.NWCA_BRANDS?.landingPageFor(name) || '/catalog?brand=' + encodeURIComponent(name);
            const logo = typeof brand === 'object' && typeof brand.logo === 'string' ? brand.logo : '';
            if (/^https?:\/\//i.test(logo) || /^\/(?!\/)/.test(logo)) {
                const img = document.createElement('img');
                img.src = logo;
                img.alt = '';
                img.className = 'brand-card-logo';
                img.loading = 'lazy';
                img.decoding = 'async';
                img.dataset.onerror = 'hide';
                card.append(img);
            }
            const label = document.createElement('span');
            label.className = 'brand-name';
            label.textContent = name;
            card.append(label);
            grid.append(card);
        }
        this.container.append(grid);
    }
}
document.addEventListener('DOMContentLoaded', () => { new BrandsPage(); });
