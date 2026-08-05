/**
 * box-url.js — normalise Box asset URLs onto this origin.
 *
 * WHY THIS EXISTS
 * The proxy's Box READ routes used to be anonymous: /api/box/download/:fileId
 * served any file the Box service account could see and /api/box/art-folders
 * enumerated 9,147 customer folders. They are moving behind the app's
 * session-gated forwarder (server.js, `boxForward`) so the browser's SAML
 * cookie — which rides along automatically, including on plain <img> requests —
 * is what authorises them.
 *
 * The catch: absolute proxy URLs were already WRITTEN INTO CASPIO. Transfer and
 * mockup records store `Thumbnail_URL` / `File_URL` as
 * `https://caspio-pricing-proxy-…herokuapp.com/api/box/thumbnail/<id>`
 * (see transfer-actions-shared.js, "Backend assigns File_Order"). Once the proxy
 * routes are gated, every one of those stored URLs 401s. Rewriting the rows is
 * possible but destructive and would have to be repeated for anything already
 * in flight, so instead every consumer passes stored URLs through boxUrl()
 * at RENDER time and the data can stay exactly as it is.
 *
 * Only READ routes are rewritten. The four write routes (shared-link,
 * create-mockup-folder, upload-to-folder, file delete) still go directly to the
 * proxy and are left untouched here.
 *
 * Idempotent, null-safe, and leaves anything it does not recognise alone — a
 * URL that is already same-origin, a plain Box link, or a data: URI all pass
 * straight through.
 */
(function (root) {
    'use strict';

    // Read routes only. A URL naming anything else is returned unchanged.
    var READ_PATHS = [
        '/api/box/thumbnail/',
        '/api/box/download/',
        '/api/box/art-folders',
        '/api/box/mockup-folders',
        '/api/box/folder-files',
        '/api/box/search',
        '/api/box/shared-image'
    ];

    function isBoxReadPath(pathname) {
        for (var i = 0; i < READ_PATHS.length; i++) {
            if (pathname.indexOf(READ_PATHS[i]) === 0) return true;
        }
        return false;
    }

    /**
     * @param {string} url a stored or freshly built URL
     * @returns {string} the same URL served from THIS origin when it points at
     *          a Box read route on any host; otherwise the input, untouched.
     */
    function boxUrl(url) {
        if (!url || typeof url !== 'string') return url;
        // Already relative — nothing to do (this is the shape we want).
        if (url.charAt(0) === '/') return url;
        if (url.indexOf('/api/box/') === -1) return url;
        var parsed;
        try {
            parsed = new URL(url, root.location ? root.location.href : undefined);
        } catch (e) {
            return url;                       // not a URL we can reason about
        }
        if (!isBoxReadPath(parsed.pathname)) return url;   // a write route, or something else
        // Drop the origin, keep path + query. Same-origin means the session
        // cookie is sent, which is the entire point.
        return parsed.pathname + parsed.search;
    }

    root.boxUrl = boxUrl;
    if (typeof module === 'object' && module.exports) module.exports = { boxUrl: boxUrl };
}(typeof self !== 'undefined' ? self : this));
