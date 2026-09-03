/* Boot shim for test-workspaces.html — guarantees the harness measures what is on
 * DISK, not what the browser cached. (Same shim the retired test-admin-nav harness
 * used; see LESSONS 2026-07-28 — a hard-cached module twice "verified" code that
 * was no longer on disk.)
 *
 * It re-points every stylesheet at a timestamped URL, waits for them to apply,
 * then imports the harness the same way. This file itself never changes.
 *
 * The HTML document can still be cached (a 304 keeps a stale <script src>). If the
 * assertion count looks wrong, load the page with a throwaway query:
 *     /tests/ui/test-workspaces.html?bust=<anything>
 */
const stamp = Date.now();

await Promise.all(
    [...document.querySelectorAll('link[rel="stylesheet"]')]
        .filter((link) => new URL(link.href, location.href).origin === location.origin)
        .map((link) => new Promise((resolve) => {
            const url = new URL(link.href, location.href);
            url.searchParams.set('t', String(stamp));
            link.addEventListener('load', resolve, { once: true });
            link.addEventListener('error', resolve, { once: true });
            link.href = url.href;
        }))
);

try {
    await import(`./test-workspaces.js?t=${stamp}`);
} catch (err) {
    document.getElementById('qaAssertions').innerHTML =
        `<li class="fail">FAIL — harness failed to load: ${err.message}</li>`;
}
