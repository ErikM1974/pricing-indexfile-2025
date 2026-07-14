/**
 * seo-strategy.js — controller for dashboards/seo-strategy.html
 *
 * Static strategy reference page — no API data. This controller only wires
 * the sticky table of contents: smooth-scroll on click + scroll-spy that
 * highlights the section currently in view.
 */
(function () {
    'use strict';

    document.addEventListener('DOMContentLoaded', function () {
        var links = Array.prototype.slice.call(document.querySelectorAll('.seo-toc-link'));
        var sections = links
            .map(function (link) { return document.querySelector(link.getAttribute('href')); })
            .filter(Boolean);

        // Smooth scroll
        links.forEach(function (link) {
            link.addEventListener('click', function (e) {
                var target = document.querySelector(link.getAttribute('href'));
                if (!target) return;
                e.preventDefault();
                target.scrollIntoView({ behavior: 'smooth', block: 'start' });
                history.replaceState(null, '', link.getAttribute('href'));
            });
        });

        // Scroll-spy — highlight the TOC link for the topmost visible section
        function setActive(id) {
            links.forEach(function (link) {
                link.classList.toggle('is-active', link.getAttribute('href') === '#' + id);
            });
        }

        if ('IntersectionObserver' in window) {
            var visible = {};
            var observer = new IntersectionObserver(function (entries) {
                entries.forEach(function (entry) {
                    visible[entry.target.id] = entry.isIntersecting;
                });
                var current = sections.find(function (s) { return visible[s.id]; });
                if (current) setActive(current.id);
            }, { rootMargin: '-10% 0px -70% 0px' });
            sections.forEach(function (s) { observer.observe(s); });
        }

        if (sections.length) setActive(sections[0].id);
    });
})();
