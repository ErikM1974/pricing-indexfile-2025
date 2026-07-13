/**
 * custom-carhartt.js — chrome wiring for the /custom-carhartt landing page.
 * Drawer open/close + masthead search → homepage catalog search, mirroring
 * product-2026.js wireChrome(). The page content itself is fully static
 * (that's the point — indexable SEO landing page, no client rendering).
 */
(function () {
    'use strict';

    function $(id) { return document.getElementById(id); }

    function init() {
        var sidebar = $('sidebar');
        var overlay = $('sidebarOverlay');
        var openBtn = $('mobileMenuBtn');
        var closeBtn = $('drawerClose');

        function setDrawer(open) {
            if (!sidebar || !overlay) return;
            sidebar.classList.toggle('show', open);
            overlay.classList.toggle('show', open);
            document.body.classList.toggle('drawer-open', open);
            // WCAG 4.1.2 — expose open/closed state of the hamburger to assistive tech.
            if (openBtn) openBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
        }
        if (openBtn) openBtn.setAttribute('aria-expanded', 'false'); // baseline in case HTML omits it
        if (openBtn) openBtn.addEventListener('click', function () { setDrawer(true); });
        if (closeBtn) closeBtn.addEventListener('click', function () { setDrawer(false); });
        if (overlay) overlay.addEventListener('click', function () { setDrawer(false); });
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') setDrawer(false);
        });

        var input = $('navSearchInput');
        var btn = $('navSearchBtn');
        function goSearch() {
            var term = (input && input.value || '').trim();
            if (term) window.location.href = '/?q=' + encodeURIComponent(term);
        }
        if (btn) btn.addEventListener('click', goSearch);
        if (input) input.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') goSearch();
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
