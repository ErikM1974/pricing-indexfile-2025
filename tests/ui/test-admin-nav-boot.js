/* Boot shim for test-admin-nav.html — guarantees the harness measures what is on
 * DISK, not what the browser cached.
 *
 * Why this exists (2026-07-28): the browser caches ES modules and stylesheets by
 * URL, and neither a normal reload, location.reload(true), nor a forced
 * navigation evicts them. Two false results came out of that in one sitting:
 *   1. An edited test-admin-nav.js kept reporting the OLD assertion count, so
 *      new checks silently never ran.
 *   2. A fixed dashboard-v3-theme.css kept computing the OLD max-height, so the
 *      harness "verified" a stylesheet that no longer existed.
 * For a harness whose entire job is asserting on computed CSS, that is worse
 * than having no harness — it manufactures confidence.
 *
 * This file itself never changes, so caching IT is harmless. It re-points every
 * stylesheet at a timestamped URL, waits for them to actually apply, then pulls
 * the harness in the same way.
 *
 * NOTE: the HTML document can still be cached (a 304 keeps a stale <script src>).
 * If the assertion count looks wrong, load the page with a throwaway query:
 *     /tests/ui/test-admin-nav.html?bust=<anything>
 */
const stamp = Date.now();

await Promise.all(
    [...document.querySelectorAll('link[rel="stylesheet"]')].map((link) => new Promise((resolve) => {
        const url = new URL(link.href, location.href);
        url.searchParams.set('t', String(stamp));
        // Resolve on error too — a missing sheet should surface as a failed
        // assertion in the harness, not as a hang with no output at all.
        link.addEventListener('load', resolve, { once: true });
        link.addEventListener('error', resolve, { once: true });
        link.href = url.href;
    }))
);

try {
    await import(`./test-admin-nav.js?t=${stamp}`);
} catch (err) {
    document.getElementById('qaAssertions').innerHTML =
        `<li class="fail">FAIL — harness failed to load: ${err.message}</li>`;
}
