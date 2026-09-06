/* pricing-negotiation-policy.js — page script (extracted from inline <script>, Rule 3, 2026-09-05). */
(function () {
    'use strict';
    var backToTop = document.getElementById('backToTop');
    function syncBackToTop() {
        if (!backToTop) return;
        backToTop.hidden = !(document.body.scrollTop > 100 || document.documentElement.scrollTop > 100);
    }
    window.addEventListener('scroll', syncBackToTop, { passive: true });
    syncBackToTop();
    if (backToTop) backToTop.addEventListener('click', function () { window.scrollTo({ top: 0, behavior: 'smooth' }); });

    document.querySelectorAll('a[href^="#"]').forEach(function (anchor) {
        anchor.addEventListener('click', function (e) {
            var target = document.querySelector(anchor.getAttribute('href'));
            if (!target) return;
            e.preventDefault();
            target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
    });
})();
