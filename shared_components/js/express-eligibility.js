/**
 * Express Eligibility — which styles can be BOUGHT ONLINE right now, and the
 * deep link that takes a customer there.
 * @version 1.0.0 (2026-08-25, buy-online bridge — Erik's Option A: quote stays
 * primary for crew orders; express is the small/fast lane)
 *
 * THE RULE: eligibility comes from the storefronts' OWN checkout whitelists —
 * /api/dtg/top-sellers/styles (custom-tees) and /api/caps/catalog
 * (custom-caps) — never a hand-maintained list here. Those endpoints gate what
 * the express checkouts will actually sell, so a badge can never point at a
 * style the storefront then refuses.
 *
 * This is an ENHANCEMENT, not a price surface: on any failure it resolves to
 * empty sets and pages simply show no badge. It must never block a render.
 *
 * Consumers: /catalog cards + quick view (catalog-2026.js), the PDP express
 * lane (product-2026.js), the homepage best-seller band (home-2026.js).
 */
(function (global) {
    'use strict';

    var CACHE_KEY = 'nwca.expressEligibility.v1';
    var CACHE_TTL_MS = 30 * 60 * 1000;

    /** API origin, WITHOUT adding a new host literal (no-hardcoded-hosts
     *  ratchet): prefer APP_CONFIG where a page loads it; otherwise borrow
     *  ProductSearchService's baseURL (both are on every consumer page). */
    function apiBase() {
        try {
            if (global.APP_CONFIG && global.APP_CONFIG.API && global.APP_CONFIG.API.BASE_URL) {
                return global.APP_CONFIG.API.BASE_URL + '/api';
            }
            if (global.ProductSearchService) {
                return new global.ProductSearchService().baseURL;
            }
        } catch (e) { /* fall through */ }
        return null;
    }

    function readCache() {
        try {
            var raw = global.sessionStorage && global.sessionStorage.getItem(CACHE_KEY);
            if (!raw) return null;
            var parsed = JSON.parse(raw);
            if (!parsed || (Date.now() - parsed.at) > CACHE_TTL_MS) return null;
            return { tees: parsed.tees || [], caps: parsed.caps || [] };
        } catch (e) { return null; }
    }

    function writeCache(lists) {
        try {
            global.sessionStorage && global.sessionStorage.setItem(
                CACHE_KEY, JSON.stringify({ at: Date.now(), tees: lists.tees, caps: lists.caps }));
        } catch (e) { /* per-viewer convenience only */ }
    }

    /** Pure: normalize the two endpoint payloads to uppercase style arrays. */
    function parseLists(teesJson, capsJson) {
        var tees = [];
        var caps = [];
        var records = (teesJson && Array.isArray(teesJson.records)) ? teesJson.records : [];
        records.forEach(function (r) { if (r && r.style) tees.push(String(r.style).toUpperCase()); });
        var rows = Array.isArray(capsJson) ? capsJson
            : ((capsJson && Array.isArray(capsJson.data)) ? capsJson.data : []);
        rows.forEach(function (r) { if (r && r.style) caps.push(String(r.style).toUpperCase()); });
        return { tees: dedupe(tees), caps: dedupe(caps) };
    }

    function dedupe(arr) {
        var seen = {};
        return arr.filter(function (s) { return seen[s] ? false : (seen[s] = true); });
    }

    /** Pure: the deep link for an eligible style, or null. Caps win a tie —
     *  a style in both lists is headwear, and the caps storefront prices it.
     *  colorName rides only on the tees link (custom-caps has no color param). */
    function linkFor(lists, style, colorName) {
        var s = String(style || '').toUpperCase();
        if (!s) return null;
        if (lists.caps.indexOf(s) !== -1) {
            return {
                url: '/custom-caps?style=' + encodeURIComponent(s),
                kind: 'caps',
                label: 'Buy online — embroidered, 8-cap minimum'
            };
        }
        if (lists.tees.indexOf(s) !== -1) {
            return {
                url: '/custom-tees?style=' + encodeURIComponent(s)
                    + (colorName ? '&color=' + encodeURIComponent(colorName) : ''),
                kind: 'tees',
                label: 'Buy online — full-color print, no minimum'
            };
        }
        return null;
    }

    var _pending = null;

    /** Resolves to {tees:[], caps:[], linkFor(style, colorName)} — never rejects. */
    function get() {
        if (_pending) return _pending;
        _pending = (function () {
            var cached = readCache();
            if (cached) return Promise.resolve(cached);
            var base = apiBase();
            if (!base) return Promise.resolve({ tees: [], caps: [] });
            var grab = function (url) {
                return fetch(url).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; });
            };
            return Promise.all([
                grab(base + '/dtg/top-sellers/styles'),
                grab(base + '/caps/catalog')
            ]).then(function (results) {
                var lists = parseLists(results[0], results[1]);
                if (lists.tees.length || lists.caps.length) writeCache(lists);
                return lists;
            }).catch(function () { return { tees: [], caps: [] }; });
        })().then(function (lists) {
            return {
                tees: lists.tees,
                caps: lists.caps,
                linkFor: function (style, colorName) { return linkFor(lists, style, colorName); }
            };
        });
        return _pending;
    }

    var api = { get: get, _parseLists: parseLists, _linkFor: linkFor };

    if (typeof global !== 'undefined') global.ExpressEligibility = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : this);
