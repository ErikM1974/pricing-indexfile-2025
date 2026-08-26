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

    // P2 cutover (2026-06-11): category/brand navigation lands on /catalog
    // (the URL-driven catalog page) instead of the legacy in-page homepage
    // SPA. Capture phase so the legacy handlers in app-modern.js /
    // catalog-search.js never fire. This file loads ONLY on index.html —
    // the catalog page has its own client-side interceptors.
    ready(function () {
        document.addEventListener('click', function (e) {
            const link = e.target.closest(
                '.category-link, .nav-subcategory-link, .nav-view-all, ' +
                '.category-flyout .flyout-item, .brand-link'
            );
            if (!link) return;

            const params = new URLSearchParams();
            if (link.classList.contains('brand-link')) {
                const brand = new URL(link.href, location.origin).searchParams.get('brand');
                if (!brand) return;
                params.set('brand', brand);
            } else {
                const cat = link.dataset.category;
                if (!cat) return;
                params.set('category', cat);
                if (link.dataset.subcategory) params.set('subcategory', link.dataset.subcategory);
            }
            e.preventDefault();
            e.stopPropagation();
            window.location.href = '/catalog?' + params.toString();
        }, true);
    });

    // Hero rotator — crossfade the real product prints inside the
    // registration frame. Static first image when reduced-motion is set
    // or JS is unavailable (first <img> ships with .is-active).
    ready(function () {
        const frame = document.querySelector('.hero-shirt');
        if (!frame) return;
        const imgs = frame.querySelectorAll('img');
        if (imgs.length < 2) return;
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

        let current = 0;
        setInterval(function () {
            if (document.hidden) return;
            imgs[current].classList.remove('is-active');
            current = (current + 1) % imgs.length;
            imgs[current].classList.add('is-active');
        }, 4500);
    });

    // Buy-online links on the best-seller shelf (bridge, 2026-08-25).
    // Eligibility comes from the express storefronts' own whitelists via
    // ExpressEligibility; a card whose style isn't sellable online (or any
    // load failure) simply keeps its single "View product" link.
    ready(function () {
        if (!window.ExpressEligibility) return;
        window.ExpressEligibility.get().then(function (elig) {
            document.querySelectorAll('.shelf-card .shelf-link[href*="/product.html?style="]').forEach(function (a) {
                try {
                    var style = new URL(a.href, window.location.origin).searchParams.get('style');
                    var color = new URL(a.href, window.location.origin).searchParams.get('color');
                    var link = elig.linkFor(style, color);
                    if (!link || a.parentElement.querySelector('.express-lane-link')) return;
                    var buy = document.createElement('a');
                    buy.className = 'express-lane-link';
                    buy.href = link.url;
                    buy.textContent = 'Buy online →';
                    buy.setAttribute('aria-label', link.label);
                    a.parentElement.appendChild(buy);
                } catch (e) { /* enhancement only */ }
            });
        });
    });
})();
