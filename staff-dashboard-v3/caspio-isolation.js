/* =====================================================
   STAFF DASHBOARD v3 — CASPIO CSS ISOLATION
   ----------------------------------------------------------
   The hidden Caspio auth DataPage embed (a0e15000a0bb470ed2be4ec5943e)
   injects 4 stylesheets into <head> at runtime AFTER our dashboard CSS
   loads: semantic.css, responsive576.css, responsive1024.css, and a
   per-DataPage stylesheet. Those override our colors and produce the
   "dashboard renders correct then half-a-second later reverts dim" bug.

   This script sets up a MutationObserver on <head> that disables any
   newly-added <link> stylesheet whose href contains "caspio.com",
   IMMEDIATELY as it's added. We keep the Caspio JS (which populates
   the [@authfield:*] divs the auth-controller reads). We just block
   its CSS side-effects.

   Loaded as a non-module <script> in <head> BEFORE the Caspio embed
   script runs so the observer is active when Caspio starts injecting.
   ===================================================== */

(function () {
    'use strict';

    function isCaspioStylesheet(node) {
        if (!node || node.tagName !== 'LINK') return false;
        if (node.rel !== 'stylesheet') return false;
        return node.href && node.href.indexOf('caspio.com') !== -1;
    }

    function disableCaspioStylesheet(link) {
        try {
            // disabled = true keeps the <link> in the DOM but tells the
            // browser not to apply its rules. Safer than removeChild because
            // some Caspio scripts may track their own elements.
            link.disabled = true;
            // Also widen media to "not all" — defense in depth in case some
            // browser version ignores .disabled on dynamically-added links.
            link.media = 'not all';
            console.info('[caspio-isolation] Blocked Caspio stylesheet:', link.href);
        } catch (err) {
            console.warn('[caspio-isolation] Failed to disable Caspio CSS:', err);
        }
    }

    // Pass 1: any Caspio stylesheets that already exist in <head> at the
    // time this script runs (shouldn't be any, but defensive)
    document.querySelectorAll('head link[rel="stylesheet"]').forEach(function (link) {
        if (isCaspioStylesheet(link)) disableCaspioStylesheet(link);
    });

    // Pass 2: catch every future addition to <head>
    const observer = new MutationObserver(function (mutations) {
        for (const mutation of mutations) {
            for (const node of mutation.addedNodes) {
                if (isCaspioStylesheet(node)) {
                    disableCaspioStylesheet(node);
                }
            }
        }
    });
    observer.observe(document.head, { childList: true, subtree: true });

    // Optional: also stop observing after a reasonable window — Caspio
    // typically injects within 1-3 seconds. After 30s, no more new sheets.
    setTimeout(function () {
        observer.disconnect();
    }, 30000);
})();
