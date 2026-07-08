/**
 * Browser error tracking (roadmap 1.10) — Sentry init for the quote builders.
 *
 * Loads as a classic script in <head>, right after the VENDORED Sentry bundle
 * (shared_components/vendor/sentry/bundle.min.js — no CDN, per 1.3). Flow:
 *   1. Immediately buffer window error/unhandledrejection events, so crashes
 *      that happen while the config fetch is in flight are not lost.
 *   2. Fetch /api/version → { sentryDsn, sha }. No DSN → tracking stays OFF
 *      and the buffer is dropped (dev/preview default; zero behavior change).
 *   3. Sentry.init tagged with the exact release SHA + tenant + builder
 *      method, PII scrubbed in beforeSend (emails/phones masked — twin of
 *      lib/sentry-scrub.js; keep the regexes in sync), then replay buffer.
 *
 * Never load-bearing: every path is wrapped so a failure here can never
 * break a builder page.
 */

(function () {
    'use strict';
    if (typeof window === 'undefined' || typeof window.Sentry === 'undefined') return;

    // ---- 1. early-error buffer (pre-init crashes still get reported) ----
    var earlyErrors = [];
    function bufferError(e) {
        if (earlyErrors.length < 20) earlyErrors.push(e);
    }
    window.addEventListener('error', bufferError);
    window.addEventListener('unhandledrejection', bufferError);

    // ---- PII scrub (browser twin of lib/sentry-scrub.js) ----
    var EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.-]+/g;
    var PHONE_RE = /(\+?\(?\d[\d\s().-]{5,}\d)/g;
    function scrubString(s) {
        return s
            .replace(EMAIL_RE, '[email]')
            .replace(PHONE_RE, function (m) { return m.replace(/\D/g, '').length >= 7 ? '[phone]' : m; });
    }
    function scrubPII(value, depth) {
        depth = depth || 0;
        if (typeof value === 'string') return scrubString(value);
        if (!value || typeof value !== 'object' || depth > 12) return value;
        if (Array.isArray(value)) {
            return value.map(function (v) { return scrubPII(v, depth + 1); });
        }
        var out = {};
        for (var k in value) {
            if (Object.prototype.hasOwnProperty.call(value, k)) out[k] = scrubPII(value[k], depth + 1);
        }
        return out;
    }

    // ---- 2+3. config fetch → init → replay ----
    fetch('/api/version')
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (cfg) {
            window.removeEventListener('error', bufferError);
            window.removeEventListener('unhandledrejection', bufferError);
            if (!cfg || !cfg.sentryDsn) return; // tracking off — drop buffer

            var tenant = (window.TENANT && window.TENANT.id) || 'nwca';
            var method = (location.pathname.match(/(embroidery|screenprint|dtf|dtg)-quote-builder/) || [])[1] || 'page';
            window.Sentry.init({
                dsn: cfg.sentryDsn,
                release: cfg.sha || undefined,
                environment: tenant,
                tracesSampleRate: 0, // errors only
                beforeSend: function (event) {
                    try { return scrubPII(event); } catch (_) { return event; }
                },
                initialScope: { tags: { tenant: tenant, method: method } },
            });

            earlyErrors.forEach(function (e) {
                try {
                    if (e && e.reason !== undefined) window.Sentry.captureException(e.reason);
                    else if (e && e.error) window.Sentry.captureException(e.error);
                    else if (e && e.message) window.Sentry.captureMessage(String(e.message), 'error');
                } catch (_) { /* never load-bearing */ }
            });
            earlyErrors = [];
        })
        .catch(function () { /* observability must never break the page */ });
})();
