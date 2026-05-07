/**
 * JDS Catalog Service
 *
 * Frontend wrapper for the /api/jds-catalog endpoints. Returns curated
 * NWCA-side product metadata used by the AE intake picker. Live JDS pricing
 * and inventory still come from JDSApiService.
 *
 * Cache: sessionStorage, 5 min TTL. Catalog mutates rarely (Erik edits via
 * Caspio Bridge for v1) so a small cache spares repeated network on every
 * tab open.
 *
 * Usage:
 *   const catalog = new JDSCatalogService();
 *   await catalog.listAll();                          // full active catalog
 *   await catalog.listByCategory('Drinkware');        // filtered
 *   await catalog.listCategories();                   // category cards
 *   await catalog.getBySku('LTM752');                 // single row
 */

class JDSCatalogService {
    constructor() {
        var apiBase = (window.APP_CONFIG && window.APP_CONFIG.API && window.APP_CONFIG.API.BASE_URL)
            || 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';
        this.baseURL = apiBase + '/api/jds-catalog';
        this.cacheTtlMs = 5 * 60 * 1000;
        this.cachePrefix = 'jdsCatalog::';
    }

    /**
     * Read a cache entry from sessionStorage; returns null on miss/expiry/error.
     */
    _readCache(key) {
        try {
            const raw = sessionStorage.getItem(this.cachePrefix + key);
            if (!raw) return null;
            const entry = JSON.parse(raw);
            if (!entry || Date.now() - entry.ts > this.cacheTtlMs) return null;
            return entry.data;
        } catch (_e) {
            return null;
        }
    }

    _writeCache(key, data) {
        try {
            sessionStorage.setItem(this.cachePrefix + key, JSON.stringify({ ts: Date.now(), data: data }));
        } catch (_e) {
            // sessionStorage full / private mode — silently skip cache
        }
    }

    /**
     * Clear all JDS catalog cache entries.
     */
    clearCache() {
        try {
            const keys = [];
            for (let i = 0; i < sessionStorage.length; i++) {
                const k = sessionStorage.key(i);
                if (k && k.indexOf(this.cachePrefix) === 0) keys.push(k);
            }
            keys.forEach(k => sessionStorage.removeItem(k));
        } catch (_e) { /* ignore */ }
    }

    async _fetchJson(url) {
        const resp = await fetch(url);
        if (!resp.ok) {
            throw new Error('JDSCatalogService request failed: ' + resp.status + ' ' + url);
        }
        return resp.json();
    }

    /**
     * List all active catalog rows. Sorted by Category, DisplayOrder, DisplayName.
     */
    async listAll(forceRefresh) {
        const cacheKey = 'all';
        if (!forceRefresh) {
            const cached = this._readCache(cacheKey);
            if (cached) return cached;
        }
        const data = await this._fetchJson(this.baseURL + (forceRefresh ? '?refresh=true' : ''));
        const rows = (data && data.result) || [];
        this._writeCache(cacheKey, rows);
        return rows;
    }

    /**
     * List rows in a single category.
     */
    async listByCategory(category, forceRefresh) {
        if (!category) return [];
        const cacheKey = 'cat::' + category.toLowerCase();
        if (!forceRefresh) {
            const cached = this._readCache(cacheKey);
            if (cached) return cached;
        }
        const url = this.baseURL + '?category=' + encodeURIComponent(category) + (forceRefresh ? '&refresh=true' : '');
        const data = await this._fetchJson(url);
        const rows = (data && data.result) || [];
        this._writeCache(cacheKey, rows);
        return rows;
    }

    /**
     * List distinct categories (with counts + sample thumbnail) for the picker landing.
     */
    async listCategories(forceRefresh) {
        const cacheKey = 'categories';
        if (!forceRefresh) {
            const cached = this._readCache(cacheKey);
            if (cached) return cached;
        }
        const data = await this._fetchJson(this.baseURL + '/categories' + (forceRefresh ? '?refresh=true' : ''));
        const rows = (data && data.result) || [];
        this._writeCache(cacheKey, rows);
        return rows;
    }

    /**
     * Single row by SKU. Throws on 404.
     */
    async getBySku(sku, forceRefresh) {
        if (!sku) throw new Error('SKU required');
        const cacheKey = 'sku::' + sku.toLowerCase();
        if (!forceRefresh) {
            const cached = this._readCache(cacheKey);
            if (cached) return cached;
        }
        const url = this.baseURL + '/' + encodeURIComponent(sku) + (forceRefresh ? '?refresh=true' : '');
        const data = await this._fetchJson(url);
        const row = data && data.result;
        if (!row) throw new Error('SKU not found in JDS_Catalog: ' + sku);
        this._writeCache(cacheKey, row);
        return row;
    }
}

window.JDSCatalogService = JDSCatalogService;
