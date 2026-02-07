/**
 * Global Fetch Timeout Wrapper
 * Adds a 15-second AbortController timeout to all fetch() calls
 * that don't already have a signal. Prevents hung requests from
 * leaving the UI waiting indefinitely.
 *
 * Load this script BEFORE any other JS files that make fetch calls.
 */
(function() {
    'use strict';

    const DEFAULT_TIMEOUT_MS = 15000;
    const originalFetch = window.fetch;

    window.fetch = function(url, options) {
        options = options || {};

        // Don't override if caller already set an AbortController signal
        if (options.signal) {
            return originalFetch.call(this, url, options);
        }

        const controller = new AbortController();
        const timer = setTimeout(function() {
            controller.abort();
        }, DEFAULT_TIMEOUT_MS);

        return originalFetch.call(this, url, Object.assign({}, options, { signal: controller.signal }))
            .finally(function() {
                clearTimeout(timer);
            });
    };
})();
