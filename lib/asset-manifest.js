/**
 * Asset-manifest helpers for the esbuild pipeline (roadmap task 0.1).
 *
 * The build (scripts/build.js) emits content-hashed copies of the quote-builder
 * assets into /dist and writes dist/asset-manifest.json mapping the clean
 * source URL to the hashed URL:
 *
 *   { "/shared_components/js/quote-builder-utils.js":
 *       "/dist/shared_components/js/quote-builder-utils.4f8a1c2b9d.js", ... }
 *
 * server.js uses rewriteHtmlAssets() to swap `src`/`href` references (with or
 * without a legacy `?v=` query) when serving the three builder HTML pages.
 * When the manifest is missing the pages fall through to the original static
 * files untouched — the build is an overlay, never a requirement (strangler).
 *
 * Pure functions only — no fs access in rewrite logic — so jest can lock the
 * behavior without touching disk (tests/unit/build/asset-manifest.test.js).
 */

const fs = require('fs');
const path = require('path');

/** Escape a string for literal use inside a RegExp. */
function escapeRegExp(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Rewrite src="..." / href="..." attributes per the manifest.
 * Matches the exact source path with an optional ?v=… (any query string)
 * suffix, in either single or double quotes. Anything not in the manifest
 * (CDN URLs, unlisted files) is left untouched.
 *
 * @param {string} html
 * @param {Record<string,string>} manifest  clean source URL → hashed dist URL
 * @returns {string}
 */
function rewriteHtmlAssets(html, manifest) {
    if (!manifest || typeof html !== 'string') return html;
    let out = html;
    for (const [sourceUrl, hashedUrl] of Object.entries(manifest)) {
        const pattern = new RegExp(
            '((?:src|href)\\s*=\\s*["\'])' + escapeRegExp(sourceUrl) + '(?:\\?[^"\']*)?(["\'])',
            'g'
        );
        out = out.replace(pattern, `$1${hashedUrl}$2`);
    }
    return out;
}

/**
 * True when a stylesheet contains url() references that are *relative*
 * (would resolve against the file's own URL and therefore break when the
 * file is served from /dist/...). Absolute paths (/x), full URLs, data:
 * URIs and fragment refs are safe to serve from a moved location.
 *
 * @param {string} css
 * @returns {boolean}
 */
function cssHasRelativeUrls(css) {
    const urlRe = /url\(\s*(?:'([^']*)'|"([^"]*)"|([^)'"\s]+))\s*\)/gi;
    let m;
    while ((m = urlRe.exec(css)) !== null) {
        const ref = (m[1] || m[2] || m[3] || '').trim();
        if (!ref) continue;
        if (
            ref.startsWith('/') ||
            ref.startsWith('data:') ||
            ref.startsWith('#') ||
            /^https?:/i.test(ref) ||
            ref.startsWith('//')
        ) {
            continue;
        }
        return true;
    }
    return false;
}

/**
 * Cached-by-mtime manifest loader. Re-reads only when the file changes,
 * so a rebuild is picked up without a server restart, and production pays
 * one stat() per request, not a read+parse.
 *
 * @param {string} manifestPath absolute path to dist/asset-manifest.json
 * @returns {() => (Record<string,string>|null)} loader returning the manifest, or null when absent/broken
 */
function createManifestLoader(manifestPath) {
    let cached = null;
    let cachedMtimeMs = 0;
    return function loadManifest() {
        let stat;
        try {
            stat = fs.statSync(manifestPath);
        } catch {
            cached = null;
            cachedMtimeMs = 0;
            return null; // no build yet — callers fall through to source files
        }
        if (!cached || stat.mtimeMs !== cachedMtimeMs) {
            try {
                cached = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
                cachedMtimeMs = stat.mtimeMs;
            } catch (err) {
                console.error('[asset-manifest] unreadable manifest, serving source paths:', err.message);
                cached = null;
                cachedMtimeMs = 0;
            }
        }
        return cached;
    };
}

/**
 * Cached-by-mtime HTML file loader (same pattern as the manifest loader) —
 * builder pages are read from disk once per edit, not once per request.
 */
function createHtmlLoader() {
    const cache = new Map(); // absPath → { mtimeMs, html }
    return function loadHtml(absPath) {
        const stat = fs.statSync(absPath);
        const hit = cache.get(absPath);
        if (hit && hit.mtimeMs === stat.mtimeMs) return hit.html;
        const html = fs.readFileSync(absPath, 'utf8');
        cache.set(absPath, { mtimeMs: stat.mtimeMs, html });
        return html;
    };
}

module.exports = {
    escapeRegExp,
    rewriteHtmlAssets,
    cssHasRelativeUrls,
    createManifestLoader,
    createHtmlLoader,
    MANIFEST_RELATIVE_PATH: path.join('dist', 'asset-manifest.json'),
};
