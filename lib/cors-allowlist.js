/**
 * CORS origin allowlist — EXACT-match only (roadmap 1.2).
 *
 * Replaces the old `origin.endsWith(allowed)` check in server.js, which let
 * any look-alike domain through (`https://evil-teamnwca.com` ends with
 * `teamnwca.com`), and the `/\.herokuapp\.com$/` regex, which trusted every
 * Heroku app on the internet — both exploitable cross-origin credential
 * theft while the middleware also sent `Access-Control-Allow-Credentials`.
 *
 * Rules enforced here:
 *  - An origin matches only by exact string equality against the allowlist.
 *  - localhost / 127.0.0.1 (any port) are allowed ONLY outside production.
 *  - A missing origin (same-origin navigation, curl, server-to-server, the
 *    internal loopback crons) gets NO CORS headers — it doesn't need any.
 *
 * Extend per deployment WITHOUT a deploy via the CORS_ALLOWED_ORIGINS env var
 * (comma-separated exact origins, e.g. "https://a.com,https://b.com").
 * Phase 2 (task 2.1) swaps buildAllowlist() to per-tenant config.
 */

const DEFAULT_ALLOWED_ORIGINS = [
    'https://nwcustom.caspio.com',
    'https://c2aby672.caspio.com',
    'https://c3eku948.caspio.com',
    'https://www.teamnwca.com',
    'https://teamnwca.com',
    // Our own app, exact — the old regex trusted ANY *.herokuapp.com origin.
    'https://sanmar-inventory-app-4cd7b252508d.herokuapp.com',
];

// Dev-only conveniences; never matched when nodeEnv === 'production'.
const DEV_ORIGIN_PATTERNS = [/^https?:\/\/localhost:\d+$/, /^https?:\/\/127\.0\.0\.1:\d+$/];

/**
 * Resolve the active allowlist. CORS_ALLOWED_ORIGINS (comma-separated exact
 * origins) REPLACES the default list when set, so a tenant deployment fully
 * controls its own origins.
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {string[]}
 */
function buildAllowlist(env = process.env) {
    if (env.CORS_ALLOWED_ORIGINS) {
        return env.CORS_ALLOWED_ORIGINS.split(',')
            .map((s) => s.trim())
            .filter(Boolean);
    }
    return DEFAULT_ALLOWED_ORIGINS.slice();
}

/**
 * Exact-match origin check. No substring, suffix, or wildcard matching.
 * @param {string|undefined} origin - the request's Origin header
 * @param {{allowlist: string[], nodeEnv?: string}} opts
 * @returns {boolean}
 */
function isOriginAllowed(origin, { allowlist, nodeEnv = process.env.NODE_ENV } = { allowlist: [] }) {
    if (!origin) return false;
    if (allowlist.includes(origin)) return true;
    if (nodeEnv !== 'production') {
        return DEV_ORIGIN_PATTERNS.some((re) => re.test(origin));
    }
    return false;
}

module.exports = { DEFAULT_ALLOWED_ORIGINS, DEV_ORIGIN_PATTERNS, buildAllowlist, isOriginAllowed };
