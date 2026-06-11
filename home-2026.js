/**
 * home-2026.js — homepage chrome glue for the 2026 redesign.
 * Drawer close button, Escape-to-close, body scroll lock, and the
 * "All categories" tile. Drawer open + overlay-close handlers live in
 * app-modern.js (setupMobileMenu) — this file only adds what that lacks.
 */
(function () {
    'use strict';

    function ready(fn) {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', fn);
        } else {
            fn();
        }
    }

    ready(function () {
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('sidebarOverlay');
        const closeBtn = document.getElementById('drawerClose');
        const allCats = document.getElementById('allCategoriesTile');
        if (!sidebar || !overlay) return;

        function closeDrawer() {
            sidebar.classList.remove('show');
            overlay.classList.remove('show');
        }

        function openDrawer() {
            sidebar.classList.add('show');
            overlay.classList.add('show');
        }

        if (closeBtn) {
            closeBtn.addEventListener('click', closeDrawer);
        }

        if (allCats) {
            allCats.addEventListener('click', function (e) {
                e.preventDefault();
                openDrawer();
            });
        }

        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') closeDrawer();
        });

        // Scroll lock follows the drawer's `show` class regardless of which
        // script toggled it (app-modern.js or this file).
        new MutationObserver(function () {
            document.body.classList.toggle('drawer-open', sidebar.classList.contains('show'));
        }).observe(sidebar, { attributes: true, attributeFilter: ['class'] });

        // catalog-search.js hides the hero two different ways: searchByBrand sets
        // an inline display:none that clearSearch's classList.remove('hidden')
        // never undoes. Normalize: whenever the hidden class comes off, clear the
        // stale inline display so the hero actually comes back.
        const hero = document.querySelector('.hero-section');
        if (hero) {
            new MutationObserver(function () {
                if (!hero.classList.contains('hidden') && hero.style.display === 'none') {
                    hero.style.display = '';
                }
            }).observe(hero, { attributes: true, attributeFilter: ['class'] });
        }
    });
})();
