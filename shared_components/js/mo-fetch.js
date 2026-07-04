/**
 * mo-fetch.js — ManageOrders READ fetch with a same-origin-first, proxy-fallback path.
 *
 * WHY: staff pages historically called the proxy's /api/manageorders/* directly, which
 * exposed customer-PII reads to anonymous enumeration. The airtight fix routes reads
 * through the main app's SAML-authed forwarder (/api/mo/*). This helper tries that first
 * and FALLS BACK to the direct proxy call on 401 (customer context / no staff session),
 * 404, 5xx, or a network error — so repointing a caller can NEVER break a page, and the
 * proxy gate stays as the backstop until the migration is verified and tightened.
 *
 * USAGE (drop-in for the old pattern):
 *   OLD: fetch(API_BASE + '/api/manageorders/orders/' + wo)
 *   NEW: moFetch('orders/' + wo)                       // → Promise<Response>
 *   moFetch('lineitems/' + wo)
 *   moFetch('orders?id_Customer=' + cid + '&...')
 *
 * Only `orders` and `lineitems` reads are forwarded (the PII paths). Anything else goes
 * straight to the proxy unchanged.
 */
(function (global) {
    'use strict';

    function apiBase() {
        try {
            return (global.APP_CONFIG && global.APP_CONFIG.API && global.APP_CONFIG.API.BASE_URL) || '';
        } catch (e) { return ''; }
    }

    // path = everything AFTER '/api/manageorders/' — e.g. 'orders/123', 'lineitems/123',
    // 'orders?id_Customer=5&date_Ordered_start=...'. Returns a Response (like fetch).
    function moFetch(path, opts) {
        opts = opts || {};
        var forwardable = /^(orders|lineitems)(\/|\?|$)/.test(path);
        var proxyCall = function () { return fetch(apiBase() + '/api/manageorders/' + path, opts); };
        if (!forwardable) return proxyCall();
        var sameOriginOpts = {};
        for (var k in opts) { if (Object.prototype.hasOwnProperty.call(opts, k)) sameOriginOpts[k] = opts[k]; }
        if (!sameOriginOpts.credentials) sameOriginOpts.credentials = 'same-origin';
        return fetch('/api/mo/' + path, sameOriginOpts).then(function (r) {
            if (r && r.ok) return r;
            // 401 (customer view / not staff), 404, 5xx → fall back to the proxy (current behavior).
            return proxyCall();
        }, function () {
            // Network error reaching the same-origin forwarder → fall back to the proxy.
            return proxyCall();
        });
    }

    global.moFetch = moFetch;
    if (typeof module !== 'undefined' && module.exports) { module.exports = { moFetch: moFetch }; }
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
