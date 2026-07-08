/**
 * Sentry PII scrubber (roadmap 1.10) — server-side beforeSend.
 *
 * Error events routinely embed customer emails/phones (quote payloads in
 * breadcrumbs, request bodies, error messages built from form fields).
 * This walks the ENTIRE event and masks both patterns before anything
 * leaves the building, so error tracking never becomes a PII leak.
 *
 * The browser twin lives inline in shared_components/js/observability.js
 * (classic script — can't require this file); keep the regexes in sync.
 */

const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.-]+/g;
// 7+ digit runs with optional separators — matches (253) 922-5793, 253.922.5793, +1 253...
const PHONE_RE = /(\+?\(?\d[\d\s().-]{5,}\d)/g;

/** @param {string} s */
function scrubString(s) {
    return s.replace(EMAIL_RE, '[email]').replace(PHONE_RE, (m) => (m.replace(/\D/g, '').length >= 7 ? '[phone]' : m));
}

/**
 * Recursively mask emails/phones in any JSON-safe structure (mutates copies,
 * never the original). Cycle-safe via seen set; depth-capped defensively.
 * @template T @param {T} value @returns {T}
 */
function scrubPII(value, _depth = 0, _seen = new WeakSet()) {
    if (typeof value === 'string') return /** @type {any} */ (scrubString(value));
    if (!value || typeof value !== 'object' || _depth > 12) return value;
    if (_seen.has(value)) return value;
    _seen.add(value);
    if (Array.isArray(value)) return /** @type {any} */ (value.map((v) => scrubPII(v, _depth + 1, _seen)));
    const out = /** @type {any} */ ({});
    for (const k of Object.keys(value)) out[k] = scrubPII(value[k], _depth + 1, _seen);
    return out;
}

module.exports = { scrubPII, scrubString };
