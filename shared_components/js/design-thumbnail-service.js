/**
 * Design Thumbnail Service
 * ========================
 * Fetches and caches design thumbnail images from the Shopworks_Thumbnail_Report table
 * via the /api/thumbnails endpoints. Used by the embroidery quote builder and quote view.
 *
 * Usage:
 *   const url = await DesignThumbnailService.fetchThumbnail('29988');
 *   const map = await DesignThumbnailService.fetchThumbnailsBatch(['29988', '39112']);
 */

const DesignThumbnailService = (() => {
    'use strict';

    // Cache: designNumber → imageUrl (string) or null (no thumbnail)
    const _cache = new Map();

    // Pending fetches to avoid duplicate in-flight requests
    const _pending = new Map();

    function _getApiBase() {
        return (window.APP_CONFIG && APP_CONFIG.API && APP_CONFIG.API.BASE_URL)
            || 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';
    }

    /**
     * Fetch a single design thumbnail URL
     * @param {string} designNumber - Numeric design ID
     * @returns {Promise<string|null>} Image URL or null if not found
     */
    async function fetchThumbnail(designNumber) {
        if (!designNumber) return null;
        const dn = String(designNumber).trim();
        if (!dn || !/^\d+$/.test(dn)) return null;

        // Check cache
        if (_cache.has(dn)) return _cache.get(dn);

        // Check if there's already a pending fetch for this design
        if (_pending.has(dn)) return _pending.get(dn);

        const promise = (async () => {
            try {
                const resp = await fetch(`${_getApiBase()}/api/thumbnails/by-design/${dn}`);
                if (!resp.ok) {
                    _cache.set(dn, null);
                    return null;
                }
                const data = await resp.json();
                const url = (data.found && data.imageUrl) ? data.imageUrl : null;
                _cache.set(dn, url);
                return url;
            } catch (err) {
                console.warn(`[DesignThumbnailService] Failed to fetch thumbnail for ${dn}:`, err.message);
                _cache.set(dn, null);
                return null;
            } finally {
                _pending.delete(dn);
            }
        })();

        _pending.set(dn, promise);
        return promise;
    }

    /**
     * Batch fetch thumbnail URLs for multiple designs
     * @param {string[]} designNumbers - Array of numeric design IDs
     * @returns {Promise<Object>} Map of { designNumber: imageUrl|null }
     */
    async function fetchThumbnailsBatch(designNumbers) {
        if (!designNumbers || designNumbers.length === 0) return {};

        const validIds = designNumbers
            .map(dn => String(dn).trim())
            .filter(dn => dn && /^\d+$/.test(dn));

        if (validIds.length === 0) return {};

        // Split into cached and uncached
        const result = {};
        const uncached = [];

        for (const dn of validIds) {
            if (_cache.has(dn)) {
                result[dn] = _cache.get(dn);
            } else {
                uncached.push(dn);
            }
        }

        // Fetch uncached in one batch call
        if (uncached.length > 0) {
            try {
                const resp = await fetch(`${_getApiBase()}/api/thumbnails/by-designs?ids=${uncached.join(',')}`);
                if (resp.ok) {
                    const data = await resp.json();
                    const thumbnails = data.thumbnails || {};
                    for (const dn of uncached) {
                        const entry = thumbnails[dn];
                        const url = (entry && entry.found && entry.imageUrl) ? entry.imageUrl : null;
                        _cache.set(dn, url);
                        result[dn] = url;
                    }
                } else {
                    // API error — cache null for all uncached
                    for (const dn of uncached) {
                        _cache.set(dn, null);
                        result[dn] = null;
                    }
                }
            } catch (err) {
                console.warn('[DesignThumbnailService] Batch fetch failed:', err.message);
                for (const dn of uncached) {
                    _cache.set(dn, null);
                    result[dn] = null;
                }
            }
        }

        return result;
    }

    /**
     * Get cached thumbnail URL without making an API call
     * @param {string} designNumber
     * @returns {string|null|undefined} URL, null (known missing), or undefined (not cached)
     */
    function getCached(designNumber) {
        const dn = String(designNumber || '').trim();
        return _cache.has(dn) ? _cache.get(dn) : undefined;
    }

    /**
     * Clear the entire cache (e.g., on quote reset)
     */
    function clearCache() {
        _cache.clear();
        _pending.clear();
    }

    return {
        fetchThumbnail,
        fetchThumbnailsBatch,
        getCached,
        clearCache
    };
})();
